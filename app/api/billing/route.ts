import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, planSnapshot, setUserCookie } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const identity = getOrCreateUser(request);
    const snapshot = await planSnapshot(identity.userId);
    const response = NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar o plano.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
