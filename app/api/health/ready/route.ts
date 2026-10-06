import { billingPool, ensureBillingSchema } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.BILLING_COOKIE_SECRET || process.env.BILLING_COOKIE_SECRET.length < 32) {
      throw new Error("AKIRA session signing is unavailable.");
    }
    await ensureBillingSchema();
    await billingPool().query("SELECT 1");
    return Response.json({ status: "ready", database: "available" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("AKIRA readiness check failed.", error);
    return Response.json({ status: "not_ready" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
