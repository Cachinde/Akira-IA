import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/billing";

export const runtime = "nodejs";

function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = header.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    if (!signature || !/^[a-f0-9]+$/i.test(signature)) return false;
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook Stripe não configurado." }, { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifySignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Assinatura do webhook Stripe inválida." }, { status: 400 });
  }
  try {
    const event: unknown = JSON.parse(payload);
    if (!event || typeof event !== "object") throw new Error("O evento Stripe não é válido.");
    await applyStripeEvent(event as Record<string, unknown>);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Falha ao processar webhook Stripe.", error);
    return NextResponse.json({ error: "Não foi possível processar o evento Stripe." }, { status: 500 });
  }
}
