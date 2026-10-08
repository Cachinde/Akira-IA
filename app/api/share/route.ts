import { NextRequest, NextResponse } from "next/server";
import { createSharedMessage } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const answer = payload?.content;
  const question = payload?.question;
  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ error: "Não há conteúdo para partilhar." }, { status: 400 });
  }
  if (question !== undefined && typeof question !== "string") {
    return NextResponse.json({ error: "A mensagem original é inválida." }, { status: 400 });
  }
  if (answer.length + (typeof question === "string" ? question.length : 0) > 20_000) {
    return NextResponse.json({ error: "A conversa é demasiado longa para partilhar." }, { status: 413 });
  }
  try {
    const id = await createSharedMessage(answer, typeof question === "string" ? question : undefined);
    return NextResponse.json({ url: new URL(`/share/${id}`, getPublicSiteUrl(request.url)).toString() });
  } catch (error) {
    console.error("Falha ao criar uma partilha AKIRA.", error);
    return NextResponse.json({ error: "Não foi possível criar a partilha agora. Tenta novamente mais tarde." }, { status: 503 });
  }
}
