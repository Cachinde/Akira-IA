import { NextRequest, NextResponse } from "next/server";
import { sendMagicLink } from "@/lib/auth";
import { getOrCreateUser, setUserCookie } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const displayName = typeof input.displayName === "string" ? input.displayName.trim().replace(/\s+/g, " ") : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Introduz um endereço de e-mail válido." }, { status: 400 });
  }
  if (displayName.length < 2 || displayName.length > 40) {
    return NextResponse.json({ error: "O nome deve ter entre 2 e 40 caracteres." }, { status: 400 });
  }
  try {
    const identity = getOrCreateUser(request);
    await sendMagicLink(identity.userId, email, displayName, getPublicSiteUrl(request.url));
    const response = NextResponse.json({
      sent: true,
      message: "Se este endereço puder receber mensagens, enviámos um link de acesso válido por 15 minutos.",
    });
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar o link de acesso.";
    const status = message.startsWith("Espera um minuto") || message.startsWith("Atingiste o limite") ? 429 : 503;
    console.error("Falha ao enviar link de acesso AKIRA.", error);
    return NextResponse.json({ error: message }, { status });
  }
}
