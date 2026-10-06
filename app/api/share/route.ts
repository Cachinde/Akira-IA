import { NextRequest, NextResponse } from "next/server";
import { createSharedMessage } from "@/lib/billing";

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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    return NextResponse.json({ url: new URL(`/share/${id}`, siteUrl).toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a partilha.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
