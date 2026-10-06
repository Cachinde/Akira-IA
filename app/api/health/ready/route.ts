import { billingPool, ensureBillingSchema } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const wakeOrigin = process.env.AKIRA_WAKE_ORIGIN || "https://akira-wake.onrender.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": wakeOrigin,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
  Vary: "Origin",
};

export function OPTIONS(request: Request) {
  if (request.headers.get("origin") !== wakeOrigin) {
    return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers = origin === wakeOrigin
    ? corsHeaders
    : { "Cache-Control": "no-store" };

  try {
    if (!process.env.BILLING_COOKIE_SECRET || process.env.BILLING_COOKIE_SECRET.length < 32) {
      throw new Error("AKIRA session signing is unavailable.");
    }
    await ensureBillingSchema();
    await billingPool().query("SELECT 1");
    return Response.json({ status: "ready", database: "available" }, { headers });
  } catch (error) {
    console.error("AKIRA readiness check failed.", error);
    return Response.json({ status: "not_ready" }, { status: 503, headers });
  }
}
