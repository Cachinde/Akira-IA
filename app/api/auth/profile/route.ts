import { NextRequest, NextResponse } from "next/server";
import { getAuthSnapshot, saveDisplayName } from "@/lib/auth";
import { getOrCreateUser, setUserCookie } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }
  const displayName = body && typeof body === "object" &&
    typeof (body as Record<string, unknown>).displayName === "string"
    ? (body as Record<string, string>).displayName.trim().replace(/\s+/g, " ")
    : "";
  if (displayName.length < 2 || displayName.length > 40) {
    return NextResponse.json({ error: "O nome deve ter entre 2 e 40 caracteres." }, { status: 400 });
  }
  try {
    const identity = getOrCreateUser(request);
    await saveDisplayName(identity.userId, displayName);
    const snapshot = await getAuthSnapshot(identity.userId);
    const response = NextResponse.json(snapshot);
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Falha ao guardar nome de tratamento AKIRA.", error);
    return NextResponse.json({ error: "Não foi possível guardar o teu nome." }, { status: 503 });
  }
}
