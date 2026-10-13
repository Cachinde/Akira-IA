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
  const image = payload?.image;
  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ error: "Não há conteúdo para partilhar." }, { status: 400 });
  }
  if (question !== undefined && typeof question !== "string") {
    return NextResponse.json({ error: "A mensagem original é inválida." }, { status: 400 });
  }
  if (image !== undefined && (
    typeof image !== "string" ||
    !/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(image)
  )) {
    return NextResponse.json({ error: "A imagem da partilha é inválida." }, { status: 400 });
  }
  if (typeof image === "string" && image.length > 17_000_000) {
    return NextResponse.json({ error: "A imagem excede o limite de 12 MB para partilha." }, { status: 413 });
  }
  if (
    typeof image === "string" &&
    Buffer.from(image.slice(image.indexOf(",") + 1), "base64").byteLength > 12 * 1024 * 1024
  ) {
    return NextResponse.json({ error: "A imagem excede o limite de 12 MB para partilha." }, { status: 413 });
  }
  if (answer.length + (typeof question === "string" ? question.length : 0) > 20_000) {
    return NextResponse.json({ error: "A conversa é demasiado longa para partilhar." }, { status: 413 });
  }
  try {
    const id = await createSharedMessage(
      answer,
      typeof question === "string" ? question : undefined,
      typeof image === "string" ? image : undefined,
    );
    return NextResponse.json({ url: new URL(`/share/${id}`, getPublicSiteUrl(request.url)).toString() });
  } catch (error) {
    console.error("Falha ao criar uma partilha AKIRA.", error);
    return NextResponse.json({ error: "Não foi possível criar a partilha agora. Tenta novamente mais tarde." }, { status: 503 });
  }
}
