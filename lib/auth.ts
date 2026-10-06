import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { billingPool, ensureBillingSchema } from "@/lib/billing";

const GUEST_MESSAGE_LIMIT = 5;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function mailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  const encryption = (process.env.SMTP_ENCRYPTION || "tls").toLowerCase();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !username || !password ||
    !process.env.SMTP_FROM_EMAIL || !["tls", "ssl"].includes(encryption)) {
    throw new Error("Configura no Render SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_ENCRYPTION e SMTP_FROM_EMAIL.");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: encryption === "ssl",
    requireTLS: encryption === "tls",
    auth: { user: username, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

export async function getAuthSnapshot(userId: string) {
  await ensureBillingSchema();
  const today = new Date().toISOString().slice(0, 10);
  const result = await billingPool().query<{
    email: string | null;
    display_name: string | null;
    message_count: number | null;
  }>(
    `SELECT account.email, account.display_name, usage.usage_count AS message_count
     FROM akira_billing_accounts AS account
     LEFT JOIN akira_billing_usage AS usage
       ON usage.user_id = account.user_id
       AND usage.metric = 'messages'
       AND usage.period_start = CASE WHEN account.email IS NULL THEN DATE '1970-01-01' ELSE $2::date END
     WHERE account.user_id = $1`,
    [userId, today],
  );
  const row = result.rows[0];
  return {
    displayName: row?.display_name || null,
    email: row?.email || null,
    authenticated: !!row?.email,
    guestMessagesUsed: Number(row?.message_count || 0),
    guestMessageLimit: GUEST_MESSAGE_LIMIT,
  };
}

export async function saveDisplayName(userId: string, displayName: string): Promise<void> {
  await ensureBillingSchema();
  await billingPool().query(
    `INSERT INTO akira_billing_accounts (user_id, display_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = CASE
         WHEN akira_billing_accounts.email IS NULL THEN EXCLUDED.display_name
         ELSE akira_billing_accounts.display_name
       END,
       updated_at = NOW()`,
    [userId, displayName],
  );
}

export async function sendMagicLink(
  guestUserId: string,
  email: string,
  displayName: string,
  siteUrl: string,
): Promise<void> {
  await ensureBillingSchema();
  const transporter = mailTransport();
  const normalizedEmail = email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const client = await billingPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [normalizedEmail]);
    await client.query(
      "INSERT INTO akira_billing_accounts (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
      [guestUserId, displayName],
    );
    const rate = await client.query<{
      window_started_at: Date;
      last_sent_at: Date;
      request_count: number;
    }>(
      "SELECT window_started_at, last_sent_at, request_count FROM akira_auth_email_limits WHERE email = $1 FOR UPDATE",
      [normalizedEmail],
    );
    const recent = rate.rows[0];
    const now = Date.now();
    if (recent && now - new Date(recent.window_started_at).getTime() < 60 * 60 * 1000 &&
      recent.request_count >= 5) {
      throw new Error("Atingiste o limite de links de acesso. Tenta novamente dentro de uma hora.");
    }
    if (recent && now - new Date(recent.last_sent_at).getTime() < 60_000) {
      throw new Error("Espera um minuto antes de pedir outro link de acesso.");
    }
    const existing = await client.query<{ user_id: string }>(
      "SELECT user_id FROM akira_billing_accounts WHERE LOWER(email) = $1 LIMIT 1",
      [normalizedEmail],
    );
    const userId = existing.rows[0]?.user_id || guestUserId;
    await client.query("DELETE FROM akira_auth_magic_links WHERE expires_at <= NOW()");
    await client.query(
      `INSERT INTO akira_auth_magic_links (token_hash, user_id, email, display_name, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes')`,
      [tokenHash(token), userId, normalizedEmail, displayName],
    );
    await client.query(
      `INSERT INTO akira_auth_email_limits (email, window_started_at, last_sent_at, request_count)
       VALUES ($1, NOW(), NOW(), 1)
       ON CONFLICT (email) DO UPDATE SET
         window_started_at = CASE
           WHEN akira_auth_email_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN NOW()
           ELSE akira_auth_email_limits.window_started_at
         END,
         request_count = CASE
           WHEN akira_auth_email_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN 1
           ELSE akira_auth_email_limits.request_count + 1
         END,
         last_sent_at = NOW()`,
      [normalizedEmail],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const verifyUrl = new URL(`/account/verify?token=${encodeURIComponent(token)}`, siteUrl).toString();
  const safeName = htmlEscape(displayName);
  const senderName = process.env.SMTP_FROM_NAME || "AKIRA";
  const sender = `"${senderName.replace(/["\r\n]/g, "")}" <${process.env.SMTP_FROM_EMAIL}>`;
  try {
    await transporter.sendMail({
      from: sender,
      to: normalizedEmail,
      subject: "O teu link de acesso à AKIRA",
      text: `Olá, ${displayName}.\n\nUsa este link para confirmar o teu e-mail e entrar na AKIRA (válido por 15 minutos):\n${verifyUrl}\n\nSe não pediste este link, ignora esta mensagem.`,
      html: `<div style="margin:0;background:#111113;padding:36px 16px;color:#efedf1;font-family:Arial,sans-serif"><div style="max-width:480px;margin:auto;padding:28px;border:1px solid #343039;border-radius:16px;background:#19191c"><p style="color:#c7b7ff;font-size:12px;font-weight:bold;letter-spacing:3px">AKIRA</p><h1 style="font-size:22px">Olá, ${safeName}.</h1><p style="color:#b9b4c1;line-height:1.6">Confirma o teu e-mail para criares a tua conta e continuares a conversar com a AKIRA.</p><p style="margin:26px 0"><a href="${verifyUrl}" style="display:inline-block;padding:13px 18px;border-radius:9px;background:#cbbdf4;color:#25202f;font-weight:bold;text-decoration:none">Confirmar e entrar</a></p><p style="color:#8e8995;font-size:12px;line-height:1.6">Este link expira em 15 minutos. Se não pediste acesso, podes ignorar este e-mail.</p></div></div>`,
    });
  } catch (error) {
    await billingPool().query("DELETE FROM akira_auth_magic_links WHERE token_hash = $1", [tokenHash(token)]);
    throw error;
  }
}

export async function consumeMagicLink(token: string): Promise<{ userId: string; displayName: string } | null> {
  await ensureBillingSchema();
  const client = await billingPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ user_id: string; email: string; display_name: string }>(
      `DELETE FROM akira_auth_magic_links
       WHERE token_hash = $1 AND expires_at > NOW()
       RETURNING user_id, email, display_name`,
      [tokenHash(token)],
    );
    const link = result.rows[0];
    if (!link) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `UPDATE akira_billing_accounts
       SET email = $2, email_verified_at = NOW(), display_name = $3, updated_at = NOW()
       WHERE user_id = $1`,
      [link.user_id, link.email, link.display_name],
    );
    await client.query("COMMIT");
    return { userId: link.user_id, displayName: link.display_name };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
