import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { NextRequest, NextResponse } from "next/server";

export const PLAN_LIMITS = {
  free: { messages: 20, files: 3, period: "day" },
  pro: { messages: 1_000, files: 100, period: "month" },
  ultra: { messages: 5_000, files: 500, period: "month" },
} as const;

export type PaidPlan = "pro" | "ultra";
export type PlanId = keyof typeof PLAN_LIMITS;

const COOKIE_NAME = "akira_billing";
const COOKIE_AGE = 60 * 60 * 24 * 365;
const globalForBilling = globalThis as typeof globalThis & {
  akiraBillingPool?: Pool;
  akiraBillingSchema?: Promise<void>;
};

function pool(): Pool {
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

async function ensureSchema(): Promise<void> {
  if (!globalForBilling.akiraBillingSchema) {
    globalForBilling.akiraBillingSchema = (async () => {
      const database = pool();
      await database.query(`
        CREATE TABLE IF NOT EXISTS akira_billing_accounts (
          user_id UUID PRIMARY KEY,
          stripe_customer_id TEXT UNIQUE,
          stripe_subscription_id TEXT UNIQUE,
          plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'ultra')),
          subscription_status TEXT NOT NULL DEFAULT 'free',
          current_period_end TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
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
  const result = await client.query<{ plan: PlanId; subscription_status: string }>(
    "SELECT plan, subscription_status FROM akira_billing_accounts WHERE user_id = $1",
    [userId],
  );
  const row = result.rows[0];
  if (!row || !["active", "trialing"].includes(row.subscription_status)) return "free";
  return row.plan;
}

export async function planSnapshot(userId: string) {
  await ensureSchema();
  const database = pool();
  const client = await database.connect();
  try {
    const plan = await activePlan(client, userId);
    const limits = PLAN_LIMITS[plan];
    const periodStart = currentPeriod(limits.period);
    const usage = await client.query<{ metric: "messages" | "files"; usage_count: number }>(
      "SELECT metric, usage_count FROM akira_billing_usage WHERE user_id = $1 AND period_start = $2",
      [userId, periodStart],
    );
    const used = { messages: 0, files: 0 };
    for (const row of usage.rows) used[row.metric] = Number(row.usage_count);
    return { plan, limits: { messages: limits.messages, files: limits.files, period: limits.period }, used };
  } finally {
    client.release();
  }
}

export async function getBillingCustomer(userId: string): Promise<string | null> {
  await ensureSchema();
  const result = await pool().query<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM akira_billing_accounts WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]?.stripe_customer_id || null;
}

export async function consumeUsage(userId: string, metric: "messages" | "files") {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const plan = await activePlan(client, userId);
    const limits = PLAN_LIMITS[plan];
    const limit = limits[metric];
    const periodStart = currentPeriod(limits.period);
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
      return { allowed: false as const, plan, limit };
    }
    await client.query("COMMIT");
    return { allowed: true as const, plan, limit };
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
  await ensureSchema();
  const eventId = textField(event.id);
  const eventType = textField(event.type);
  const data = event.data as Record<string, unknown> | undefined;
  const object = data?.object as Record<string, unknown> | undefined;
  if (!eventId || !eventType || !object) throw new Error("Evento Stripe incompleto.");

  const client = await pool().connect();
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

    if (eventType === "checkout.session.completed") {
      if (userId && customerId && subscriptionId) {
        const metadataPlan = textField(metadata.plan);
        const plan: PaidPlan = metadataPlan === "ultra" ? "ultra" : "pro";
        await client.query(
          `INSERT INTO akira_billing_accounts
             (user_id, stripe_customer_id, stripe_subscription_id, plan, subscription_status, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             plan = EXCLUDED.plan,
             subscription_status = EXCLUDED.subscription_status,
             updated_at = NOW()`,
          [userId, customerId, subscriptionId, plan, object.payment_status === "paid" || object.payment_status === "no_payment_required" ? "active" : "incomplete"],
        );
      }
    } else if (eventType.startsWith("customer.subscription.")) {
      const resolvedUserId = userId || (customerId
        ? (await client.query<{ user_id: string }>("SELECT user_id FROM akira_billing_accounts WHERE stripe_customer_id = $1", [customerId])).rows[0]?.user_id
        : null);
      if (resolvedUserId) {
        const priceId = nestedText(object, "items", "data", "0", "price", "id");
        const plan = planForPrice(priceId);
        const status = textField(object.status) || "incomplete";
        const periodEnd = typeof object.current_period_end === "number"
          ? new Date(object.current_period_end * 1000).toISOString()
          : null;
        await client.query(
          `INSERT INTO akira_billing_accounts
             (user_id, stripe_customer_id, stripe_subscription_id, plan, subscription_status, current_period_end, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, akira_billing_accounts.stripe_customer_id),
             stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, akira_billing_accounts.stripe_subscription_id),
             plan = EXCLUDED.plan,
             subscription_status = EXCLUDED.subscription_status,
             current_period_end = EXCLUDED.current_period_end,
             updated_at = NOW()`,
          [resolvedUserId, customerId, textField(object.id), plan, status, periodEnd],
        );
      }
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
  await ensureSchema();
  const id = randomUUID();
  await pool().query("DELETE FROM akira_shared_messages WHERE expires_at <= NOW()");
  await pool().query(
    "INSERT INTO akira_shared_messages (id, content, expires_at) VALUES ($1, $2, NOW() + INTERVAL '90 days')",
    [id, content],
  );
  return id;
}

export async function loadSharedMessage(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await ensureSchema();
  const result = await pool().query<{ content: string }>(
    "SELECT content FROM akira_shared_messages WHERE id = $1 AND expires_at > NOW()",
    [id],
  );
  return result.rows[0]?.content || null;
}
