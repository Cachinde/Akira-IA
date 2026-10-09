import { NextRequest, NextResponse } from "next/server";
import { getAuthSnapshot } from "@/lib/auth";
import { getBillingCustomer, getOrCreateUser, planSnapshot, saveBillingCustomer, setUserCookie, type PaidPlan } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

const PRICE_ENV: Record<PaidPlan, string> = {
  pro: "STRIPE_PRICE_PRO",
  ultra: "STRIPE_PRICE_ULTRA",
};

function stripeErrorDetails(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return {};
  const error = value.error;
  if (!error || typeof error !== "object") return {};
  const details = error as Record<string, unknown>;
  return {
    code: typeof details.code === "string" ? details.code : undefined,
    type: typeof details.type === "string" ? details.type : undefined,
    param: typeof details.param === "string" ? details.param : undefined,
    message: typeof details.message === "string" ? details.message : undefined,
  };
}

function isMatchingMonthlyPrice(value: unknown, plan: PaidPlan, liveMode: boolean): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const price = value as Record<string, unknown>;
  const recurring = price.recurring && typeof price.recurring === "object"
    ? price.recurring as Record<string, unknown>
    : null;
  return price.active === true &&
    price.livemode === liveMode &&
    price.currency === "usd" &&
    price.unit_amount === (plan === "pro" ? 500 : 1_200) &&
    recurring?.interval === "month" &&
    recurring.interval_count === 1;
}

async function resolveStripePriceId(configuredId: string, plan: PaidPlan, secret: string): Promise<string> {
  const liveMode = secret.startsWith("sk_live_");
  const headers = { Authorization: `Bearer ${secret}` };
  const requestOptions = { headers, cache: "no-store" as RequestCache, signal: AbortSignal.timeout(15_000) };

  if (configuredId.startsWith("price_")) {
    const response = await fetch(
      `https://api.stripe.com/v1/prices/${encodeURIComponent(configuredId)}`,
      requestOptions,
    );
    const result: unknown = await response.json();
    if (!response.ok || !isMatchingMonthlyPrice(result, plan, liveMode) || result.id !== configuredId) {
      console.error("Stripe rejected the configured subscription price.", {
        plan,
        priceSetting: PRICE_ENV[plan],
        configuredIdPrefix: configuredId.slice(0, 8),
        status: response.status,
        ...stripeErrorDetails(result),
      });
      throw new Error("O preço Stripe configurado não corresponde ao plano.");
    }
    return configuredId;
  }

  if (!configuredId.startsWith("prod_")) {
    console.error(`Stripe checkout is unavailable because ${PRICE_ENV[plan]} must contain a Product ID or Price ID.`);
    throw new Error("A configuração deste plano está incompleta.");
  }

  const query = new URLSearchParams({ product: configuredId, active: "true", limit: "100" });
  const response = await fetch(`https://api.stripe.com/v1/prices?${query}`, requestOptions);
  const result: unknown = await response.json();
  const prices = result && typeof result === "object" && "data" in result
    ? (result as { data?: unknown }).data
    : null;
  const matchingPrices = Array.isArray(prices)
    ? prices.filter((price) =>
      isMatchingMonthlyPrice(price, plan, liveMode) &&
      price.product === configuredId &&
      typeof price.id === "string" &&
      price.id.startsWith("price_"))
    : [];

  if (!response.ok || matchingPrices.length !== 1) {
    console.error("Stripe product must have exactly one matching active monthly price for the plan.", {
      plan,
      priceSetting: PRICE_ENV[plan],
      productIdPrefix: configuredId.slice(0, 8),
      status: response.status,
      matchingPriceCount: matchingPrices.length,
      ...stripeErrorDetails(result),
    });
    throw new Error("O produto Stripe tem de ter exatamente um preço ativo correspondente ao plano.");
  }

  const resolvedPriceId = matchingPrices[0]?.id;
  if (typeof resolvedPriceId !== "string") {
    throw new Error("O Stripe não devolveu um Price ID válido para este produto.");
  }
  return resolvedPriceId;
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
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

  const priceId = process.env[PRICE_ENV[plan]]?.trim();
  if (!priceId) {
    console.error(`Stripe checkout is unavailable because ${PRICE_ENV[plan]} is missing.`);
    return NextResponse.json({ error: "As assinaturas estão temporariamente indisponíveis. Tenta novamente mais tarde." }, { status: 503 });
  }
  if (!priceId.startsWith("price_") && !priceId.startsWith("prod_")) {
    console.error(`Stripe checkout is unavailable because ${PRICE_ENV[plan]} must contain a Product ID or Price ID.`);
    return NextResponse.json({ error: "A configuração deste plano está incompleta. Contacta o suporte da AKIRA." }, { status: 503 });
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

    const stripePriceId = await resolveStripePriceId(priceId, plan, secret);

    const form = new URLSearchParams({
      mode: "subscription",
      success_url: `${siteUrl}/plans?checkout=success`,
      cancel_url: `${siteUrl}/plans?checkout=cancelled`,
      client_reference_id: identity.userId,
      "line_items[0][price]": stripePriceId,
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
