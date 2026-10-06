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
  const content = body && typeof body === "object" ? (body as Record<string, unknown>).content : null;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Não há conteúdo para partilhar." }, { status: 400 });
  }
  if (content.length > 20_000) return NextResponse.json({ error: "A resposta é demasiado longa para partilhar." }, { status: 413 });
  try {
    const id = await createSharedMessage(content);
    return NextResponse.json({ url: new URL(`/share/${id}`, getPublicSiteUrl(request.url)).toString() });
  } catch (error) {
    console.error("Falha ao criar uma partilha AKIRA.", error);
    return NextResponse.json({ error: "Não foi possível criar a partilha agora. Tenta novamente mais tarde." }, { status: 503 });
  }
}
