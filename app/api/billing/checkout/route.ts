import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, planSnapshot, setUserCookie, type PaidPlan } from "@/lib/billing";

export const runtime = "nodejs";

const PRICE_ENV: Record<PaidPlan, string> = {
  pro: "STRIPE_PRICE_PRO",
  ultra: "STRIPE_PRICE_ULTRA",
};

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !siteUrl) {
    return NextResponse.json({ error: "Stripe ainda não está configurado no servidor." }, { status: 503 });
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
    return NextResponse.json({ error: `Configura o preço mensal ${plan} no Stripe e define ${PRICE_ENV[plan]} no Render.` }, { status: 503 });
  }

  try {
    const identity = getOrCreateUser(request);
    const current = await planSnapshot(identity.userId);
    if (current.plan !== "free") {
      return NextResponse.json({ error: "Já tens uma assinatura ativa. Gere-a no portal de faturação." }, { status: 409 });
    }

    const expectedAmount = plan === "pro" ? 500 : 1_200;
    const priceResponse = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
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
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
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
    const response = NextResponse.json({ url: checkoutUrl });
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
