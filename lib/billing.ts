import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { NextRequest, NextResponse } from "next/server";

export const PLAN_LIMITS = {
  free: { messages: 20, files: 3, period: "day" },
  pro: { messages: 1_000, files: 100, period: "month" },
  ultra: { messages: 5_000, files: 500, period: "month" },
} as const;

export const GUEST_MESSAGE_LIMIT = 10;

export type PaidPlan = "pro" | "ultra";
export type PlanId = keyof typeof PLAN_LIMITS;

const COOKIE_NAME = "akira_billing";
const COOKIE_AGE = 60 * 60 * 24 * 365;
const globalForBilling = globalThis as typeof globalThis & {
  akiraBillingPool?: Pool;
  akiraBillingSchema?: Promise<void>;
};

export function billingPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("A faturação ainda não está configurada: liga um PostgreSQL e define DATABASE_URL no Render.");
  }
  if (!globalForBilling.akiraBillingPool) {
    globalForBilling.akiraBillingPool = new Pool({
      connectionString,
      ssl: connectionString.includes("render.com") ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForBilling.akiraBillingPool;
}

export async function ensureBillingSchema(): Promise<void> {
  if (!globalForBilling.akiraBillingSchema) {
    globalForBilling.akiraBillingSchema = (async () => {
      const database = billingPool();
      await database.query(`
        CREATE TABLE IF NOT EXISTS akira_billing_accounts (
          user_id UUID PRIMARY KEY,
          email TEXT,
          display_name TEXT,
          email_verified_at TIMESTAMPTZ,
          stripe_customer_id TEXT UNIQUE,
          stripe_subscription_id TEXT UNIQUE,
          plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'ultra')),
          subscription_status TEXT NOT NULL DEFAULT 'free',
          current_period_end TIMESTAMPTZ,
          stripe_event_created_at BIGINT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE akira_billing_accounts ADD COLUMN IF NOT EXISTS email TEXT;
        ALTER TABLE akira_billing_accounts ADD COLUMN IF NOT EXISTS display_name TEXT;
        ALTER TABLE akira_billing_accounts ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
        ALTER TABLE akira_billing_accounts ADD COLUMN IF NOT EXISTS stripe_event_created_at BIGINT;
        CREATE UNIQUE INDEX IF NOT EXISTS akira_billing_accounts_email_unique
          ON akira_billing_accounts (LOWER(email)) WHERE email IS NOT NULL;
        CREATE TABLE IF NOT EXISTS akira_billing_usage (
          user_id UUID NOT NULL REFERENCES akira_billing_accounts(user_id) ON DELETE CASCADE,
          metric TEXT NOT NULL CHECK (metric IN ('messages', 'files')),
          period_start DATE NOT NULL,
          usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
          PRIMARY KEY (user_id, metric, period_start)
        );
        CREATE TABLE IF NOT EXISTS akira_billing_events (
          event_id TEXT PRIMARY KEY,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS akira_auth_magic_links (
          token_hash TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES akira_billing_accounts(user_id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          display_name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS akira_auth_magic_links_email_created
          ON akira_auth_magic_links (LOWER(email), created_at DESC);
        CREATE TABLE IF NOT EXISTS akira_auth_email_limits (
          email TEXT PRIMARY KEY,
          window_started_at TIMESTAMPTZ NOT NULL,
          last_sent_at TIMESTAMPTZ NOT NULL,
          request_count INTEGER NOT NULL CHECK (request_count > 0)
        );
        CREATE TABLE IF NOT EXISTS akira_auth_identities (
          provider TEXT NOT NULL CHECK (provider IN ('google', 'softedge')),
          subject TEXT NOT NULL,
          user_id UUID NOT NULL REFERENCES akira_billing_accounts(user_id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (provider, subject)
        );
        CREATE INDEX IF NOT EXISTS akira_auth_identities_user
          ON akira_auth_identities (user_id);
        CREATE TABLE IF NOT EXISTS akira_auth_sso_tokens (
          token_id TEXT PRIMARY KEY,
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE TABLE IF NOT EXISTS akira_shared_messages (
          id UUID PRIMARY KEY,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        );
      `);
    })().catch((error: unknown) => {
      globalForBilling.akiraBillingSchema = undefined;
      throw error;
    });
  }
  return globalForBilling.akiraBillingSchema;
}

function cookieSecret(): string {
  const secret = process.env.BILLING_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Define BILLING_COOKIE_SECRET com pelo menos 32 caracteres no Render.");
  }
  return secret;
}

function signature(userId: string): string {
  return createHmac("sha256", cookieSecret()).update(userId).digest("base64url");
}

function parseUserId(token?: string): string | null {
  if (!token) return null;
  const parts = token.split(".");
  const userId = parts[0];
  const supplied = parts[1];
  if (parts.length !== 2 || !userId || !supplied || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const expected = Buffer.from(signature(userId));
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return userId;
}

export function getOrCreateUser(request: NextRequest): { userId: string; created: boolean } {
  cookieSecret();
  const userId = parseUserId(request.cookies.get(COOKIE_NAME)?.value);
  return userId ? { userId, created: false } : { userId: randomUUID(), created: true };
}

export function setUserCookie(response: NextResponse, userId: string): void {
  response.cookies.set(COOKIE_NAME, `${userId}.${signature(userId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_AGE,
  });
}

function currentPeriod(period: "day" | "month"): string {
  const now = new Date();
  if (period === "day") return now.toISOString().slice(0, 10);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function activePlan(client: PoolClient, userId: string): Promise<PlanId> {
  await client.query("INSERT INTO akira_billing_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [userId]);
  const result = await client.query<{ plan: PlanId; subscription_status: string; email: string | null; display_name: string | null }>(
    "SELECT plan, subscription_status, email, display_name FROM akira_billing_accounts WHERE user_id = $1",
    [userId],
  );
  const row = result.rows[0];
  if (!row || !row.email || !["active", "trialing"].includes(row.subscription_status)) return "free";
  return row.plan;
}

export async function planSnapshot(userId: string) {
  await ensureBillingSchema();
  const database = billingPool();
  const client = await database.connect();
  try {
    const plan = await activePlan(client, userId);
    const limits = PLAN_LIMITS[plan];
    const account = await client.query<{ email: string | null }>(
      "SELECT email FROM akira_billing_accounts WHERE user_id = $1",
      [userId],
    );
    const isGuest = !account.rows[0]?.email;
    const today = currentPeriod("day");
    const usage = await client.query<{ metric: "messages" | "files"; usage_count: number }>(
      `SELECT metric, usage_count
       FROM akira_billing_usage
       WHERE user_id = $1 AND (
         (metric = 'messages' AND period_start = $2) OR
         (metric = 'files' AND period_start = $3)
       )`,
      [userId, isGuest ? "1970-01-01" : currentPeriod(limits.period), today],
    );
    const used = { messages: 0, files: 0 };
    for (const row of usage.rows) used[row.metric] = Number(row.usage_count);
    return {
      plan,
      limits: { messages: isGuest ? GUEST_MESSAGE_LIMIT : limits.messages, files: limits.files, period: isGuest ? "lifetime" as const : limits.period },
      used,
    };
  } finally {
    client.release();
  }
}

export async function getBillingCustomer(userId: string): Promise<string | null> {
  await ensureBillingSchema();
  const result = await billingPool().query<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM akira_billing_accounts WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]?.stripe_customer_id || null;
}

export async function saveBillingCustomer(userId: string, customerId: string): Promise<void> {
  await ensureBillingSchema();
  await billingPool().query(
    `UPDATE akira_billing_accounts
     SET stripe_customer_id = $2, updated_at = NOW()
     WHERE user_id = $1 AND (stripe_customer_id IS NULL OR stripe_customer_id = $2)`,
    [userId, customerId],
  );
}

export async function consumeUsage(userId: string, metric: "messages" | "files") {
  await ensureBillingSchema();
  const client = await billingPool().connect();
  try {
    await client.query("BEGIN");
    const plan = await activePlan(client, userId);
    const registered = await client.query<{ email: string | null; display_name: string | null }>(
      "SELECT email, display_name FROM akira_billing_accounts WHERE user_id = $1",
      [userId],
    );
    const account = registered.rows[0];
    if (!account?.display_name && metric === "messages") {
      await client.query("COMMIT");
      return { allowed: false as const, plan, limit: GUEST_MESSAGE_LIMIT, requiresAccount: false, requiresProfile: true };
    }
    const isGuest = !account?.email;
    const limits = PLAN_LIMITS[plan];
    const limit = metric === "messages" && isGuest ? GUEST_MESSAGE_LIMIT : limits[metric];
    const periodStart = isGuest && metric === "messages" ? "1970-01-01" : currentPeriod(limits.period);
    const updated = await client.query(
      `INSERT INTO akira_billing_usage (user_id, metric, period_start, usage_count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, metric, period_start)
       DO UPDATE SET usage_count = akira_billing_usage.usage_count + 1
       WHERE akira_billing_usage.usage_count < $4
       RETURNING usage_count`,
      [userId, metric, periodStart, limit],
    );
    if (!updated.rowCount) {
      await client.query("COMMIT");
      return { allowed: false as const, plan, limit, requiresAccount: metric === "messages" && isGuest, requiresProfile: false };
    }
    await client.query("COMMIT");
    return { allowed: true as const, plan, limit, requiresAccount: false, requiresProfile: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function planForPrice(priceId?: string | null): PlanId {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId && priceId === process.env.STRIPE_PRICE_ULTRA) return "ultra";
  return "free";
}

function textField(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function nestedText(value: unknown, ...keys: string[]): string | null {
  let current: unknown = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return textField(current);
}

export async function applyStripeEvent(event: Record<string, unknown>): Promise<void> {
  await ensureBillingSchema();
  const eventId = textField(event.id);
  const eventType = textField(event.type);
  const data = event.data as Record<string, unknown> | undefined;
  const object = data?.object as Record<string, unknown> | undefined;
  if (!eventId || !eventType || !object) throw new Error("Evento Stripe incompleto.");

  const client = await billingPool().connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      "INSERT INTO akira_billing_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id",
      [eventId],
    );
    if (!inserted.rowCount) {
      await client.query("COMMIT");
      return;
    }

    const metadata = (object.metadata || {}) as Record<string, unknown>;
    const userId = textField(metadata.user_id) || textField(object.client_reference_id);
    const customerId = textField(object.customer);
    const subscriptionId = textField(object.subscription) || (eventType.startsWith("customer.subscription.") ? textField(object.id) : null);
    const eventCreated = typeof event.created === "number" && Number.isSafeInteger(event.created)
      ? event.created
      : 0;

    if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
      if (userId && customerId && subscriptionId) {
        const metadataPlan = textField(metadata.plan);
        if (metadataPlan !== "pro" && metadataPlan !== "ultra") {
          throw new Error("O checkout Stripe não identifica um plano AKIRA válido.");
        }
        const plan: PaidPlan = metadataPlan;
        await client.query(
          `INSERT INTO akira_billing_accounts
             (user_id, stripe_customer_id, stripe_subscription_id, plan, subscription_status, stripe_event_created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             plan = EXCLUDED.plan,
             subscription_status = EXCLUDED.subscription_status,
             stripe_event_created_at = EXCLUDED.stripe_event_created_at,
             updated_at = NOW()
           WHERE akira_billing_accounts.stripe_event_created_at IS NULL
             OR akira_billing_accounts.stripe_event_created_at <= EXCLUDED.stripe_event_created_at`,
          [userId, customerId, subscriptionId, plan, object.payment_status === "paid" || object.payment_status === "no_payment_required" ? "active" : "incomplete", eventCreated],
        );
      }
    } else if (eventType.startsWith("customer.subscription.")) {
      const resolvedUserId = userId || (customerId
        ? (await client.query<{ user_id: string }>("SELECT user_id FROM akira_billing_accounts WHERE stripe_customer_id = $1", [customerId])).rows[0]?.user_id
        : null);
      if (!resolvedUserId) {
        const priceId = nestedText(object, "items", "data", "0", "price", "id");
        if (userId || planForPrice(priceId) !== "free") {
          throw new Error("A assinatura Stripe ainda não está associada a uma conta AKIRA.");
        }
        await client.query("COMMIT");
        return;
      }
      const priceId = nestedText(object, "items", "data", "0", "price", "id");
      const plan = planForPrice(priceId);
      const status = textField(object.status) || "incomplete";
      const periodEnd = typeof object.current_period_end === "number"
        ? new Date(object.current_period_end * 1000).toISOString()
        : null;
      await client.query(
        `INSERT INTO akira_billing_accounts
           (user_id, stripe_customer_id, stripe_subscription_id, plan, subscription_status, current_period_end, stripe_event_created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, akira_billing_accounts.stripe_customer_id),
           stripe_subscription_id = CASE
             WHEN $5 IN ('canceled', 'incomplete_expired') THEN NULL
             ELSE COALESCE(EXCLUDED.stripe_subscription_id, akira_billing_accounts.stripe_subscription_id)
           END,
           plan = EXCLUDED.plan,
           subscription_status = EXCLUDED.subscription_status,
           current_period_end = EXCLUDED.current_period_end,
           stripe_event_created_at = EXCLUDED.stripe_event_created_at,
           updated_at = NOW()
         WHERE akira_billing_accounts.stripe_event_created_at IS NULL
           OR akira_billing_accounts.stripe_event_created_at <= EXCLUDED.stripe_event_created_at`,
        [resolvedUserId, customerId, textField(object.id), plan, status, periodEnd, eventCreated],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createSharedMessage(content: string): Promise<string> {
  await ensureBillingSchema();
  const id = randomUUID();
  await billingPool().query("DELETE FROM akira_shared_messages WHERE expires_at <= NOW()");
  await billingPool().query(
    "INSERT INTO akira_shared_messages (id, content, expires_at) VALUES ($1, $2, NOW() + INTERVAL '90 days')",
    [id, content],
  );
  return id;
}

export async function loadSharedMessage(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await ensureBillingSchema();
  const result = await billingPool().query<{ content: string }>(
    "SELECT content FROM akira_shared_messages WHERE id = $1 AND expires_at > NOW()",
    [id],
  );
  return result.rows[0]?.content || null;
}
