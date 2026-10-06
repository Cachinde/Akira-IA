import { NextRequest, NextResponse } from "next/server";
import { getAuthSnapshot } from "@/lib/auth";
import { getOrCreateUser, setUserCookie } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const identity = getOrCreateUser(request);
    const snapshot = await getAuthSnapshot(identity.userId);
    const response = NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Falha ao carregar a sessão AKIRA.", error);
    return NextResponse.json({ error: "Não foi possível carregar a sessão." }, { status: 503 });
  }
}
