import { NextRequest, NextResponse } from "next/server";
import { getBillingCustomer, getOrCreateUser } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = getPublicSiteUrl(request.url);
  if (!secret || !/^sk_(test|live)_/.test(secret)) {
    console.error("Stripe billing portal is unavailable because the server API key is missing or invalid.");
    return NextResponse.json({ error: "A gestão de assinaturas está temporariamente indisponível." }, { status: 503 });
  }
  try {
    const { userId } = getOrCreateUser(request);
    const customerId = await getBillingCustomer(userId);
    if (!customerId) {
      return NextResponse.json({ error: "Não há uma assinatura para gerir neste navegador." }, { status: 404 });
    }
    const form = new URLSearchParams({
      customer: customerId,
      return_url: `${siteUrl}/plans`,
    });
    const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const result: unknown = await stripeResponse.json();
    if (!stripeResponse.ok || !result || typeof result !== "object") {
      throw new Error("O Stripe não conseguiu abrir o portal de faturação.");
    }
    const url = (result as Record<string, unknown>).url;
    if (typeof url !== "string" || !url.startsWith("https://billing.stripe.com/")) {
      throw new Error("O Stripe devolveu um endereço de faturação inválido.");
    }
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Stripe billing portal request failed.", error);
    return NextResponse.json({ error: "Não foi possível abrir a gestão da assinatura agora." }, { status: 502 });
  }
}
