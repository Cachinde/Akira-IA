import { NextRequest, NextResponse } from "next/server";
import { getAuthSnapshot } from "@/lib/auth";
import { getBillingCustomer, getOrCreateUser, planSnapshot, saveBillingCustomer, setUserCookie, type PaidPlan } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

const PRICE_ENV: Record<PaidPlan, string> = {
  pro: "STRIPE_PRICE_PRO",
  ultra: "STRIPE_PRICE_ULTRA",
};

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = getPublicSiteUrl(request.url);
  if (!secret || !/^sk_(test|live)_/.test(secret)) {
    console.error("Stripe checkout is unavailable because the server API key is missing or invalid.");
    return NextResponse.json({ error: "As assinaturas estão temporariamente indisponíveis. Tenta novamente mais tarde." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido de assinatura inválido." }, { status: 400 });
  }
  const plan = body && typeof body === "object" ? (body as Record<string, unknown>).plan : null;
  if (plan !== "pro" && plan !== "ultra") {
    return NextResponse.json({ error: "Escolhe um plano válido." }, { status: 400 });
  }

  const priceId = process.env[PRICE_ENV[plan]];
  if (!priceId) {
    console.error(`Stripe checkout is unavailable because ${PRICE_ENV[plan]} is missing.`);
    return NextResponse.json({ error: "As assinaturas estão temporariamente indisponíveis. Tenta novamente mais tarde." }, { status: 503 });
  }

  try {
    const identity = getOrCreateUser(request);
    const account = await getAuthSnapshot(identity.userId);
    if (!account.authenticated) {
      return NextResponse.json(
        { error: "Confirma primeiro o teu e-mail para associar a assinatura à tua conta." },
        { status: 403 },
      );
    }
    const current = await planSnapshot(identity.userId);
    if (current.plan !== "free") {
      return NextResponse.json({ error: "Já tens uma assinatura ativa. Gere-a no portal de faturação." }, { status: 409 });
    }

    const expectedAmount = plan === "pro" ? 500 : 1_200;
    const priceResponse = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const priceResult: unknown = await priceResponse.json();
    if (!priceResponse.ok || !priceResult || typeof priceResult !== "object") {
      throw new Error("Não foi possível validar o preço da assinatura no Stripe.");
    }
    const price = priceResult as Record<string, unknown>;
    const recurring = price.recurring as Record<string, unknown> | null;
    if (price.active !== true || price.currency !== "usd" || price.unit_amount !== expectedAmount ||
      recurring?.interval !== "month" || recurring.interval_count !== 1) {
      throw new Error(`O preço Stripe ${PRICE_ENV[plan]} tem de ser USD ${plan === "pro" ? "5" : "12"} por mês.`);
    }

    const form = new URLSearchParams({
      mode: "subscription",
      success_url: `${siteUrl}/plans?checkout=success`,
      cancel_url: `${siteUrl}/plans?checkout=cancelled`,
      client_reference_id: identity.userId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "metadata[user_id]": identity.userId,
      "metadata[plan]": plan,
      "subscription_data[metadata][user_id]": identity.userId,
      "subscription_data[metadata][plan]": plan,
      "billing_address_collection": "auto",
    });
    const existingCustomer = await getBillingCustomer(identity.userId);
    if (existingCustomer) form.set("customer", existingCustomer);
    else if (account.email) form.set("customer_email", account.email);
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Idempotency-Key": `akira-checkout-${identity.userId}-${plan}-${Math.floor(Date.now() / 30_000)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const result: unknown = await stripeResponse.json();
    if (!stripeResponse.ok || !result || typeof result !== "object") {
      const detail = result && typeof result === "object" && "error" in result &&
        (result.error as Record<string, unknown>)?.message;
      throw new Error(typeof detail === "string" ? detail : "O Stripe não conseguiu iniciar o checkout.");
    }
    const checkoutUrl = (result as Record<string, unknown>).url;
    if (typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://checkout.stripe.com/")) {
      throw new Error("O Stripe devolveu um endereço de checkout inválido.");
    }
    const customer = (result as Record<string, unknown>).customer;
    const customerId = typeof customer === "string" ? customer : null;
    if (!existingCustomer && customerId) await saveBillingCustomer(identity.userId, customerId);
    const response = NextResponse.json({ url: checkoutUrl });
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Stripe checkout request failed.", error);
    return NextResponse.json({ error: "Não foi possível iniciar a assinatura agora. Tenta novamente mais tarde." }, { status: 502 });
  }
}
