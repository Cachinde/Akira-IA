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
    console.error("Falha ao carregar o estado de faturação.", error);
    return NextResponse.json({ error: "Não foi possível carregar os planos neste momento." }, { status: 503 });
  }
}
