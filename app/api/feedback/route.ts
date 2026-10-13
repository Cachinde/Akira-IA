import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, saveMessageFeedback, setUserCookie } from "@/lib/billing";
import { CHAT_MESSAGE_CHARACTER_LIMIT, CHAT_REQUEST_CHARACTER_LIMIT } from "@/lib/chat-limits";
import { apiBotUiFeedback } from "@/lib/space";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido de feedback não contém JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "O pedido de feedback é inválido." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { messageId, rating, prompt, response, isImage } = input;
  if (typeof messageId !== "string" || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: "A mensagem selecionada é inválida." }, { status: 400 });
  }
  if (rating !== "positive" && rating !== "negative") {
    return NextResponse.json({ error: "Escolhe uma reação válida." }, { status: 400 });
  }
  if (typeof isImage !== "boolean") {
    return NextResponse.json({ error: "O tipo de conteúdo do feedback é inválido." }, { status: 400 });
  }
  if (
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > CHAT_MESSAGE_CHARACTER_LIMIT ||
    typeof response !== "string" ||
    !response.trim() ||
    response.length > CHAT_REQUEST_CHARACTER_LIMIT
  ) {
    return NextResponse.json({ error: "O contexto do feedback é inválido ou demasiado longo." }, { status: 400 });
  }

  try {
    const identity = getOrCreateUser(request);
    await saveMessageFeedback(identity.userId, messageId, rating, prompt.trim(), response.trim());
    const akiraFeedback = await apiBotUiFeedback(messageId, rating, prompt.trim(), response.trim(), isImage);
    const result = NextResponse.json({
      saved: true,
      includedInTraining: akiraFeedback.includedInTraining,
    });
    if (identity.created) setUserCookie(result, identity.userId);
    return result;
  } catch (error) {
    console.error("Falha ao guardar o feedback da resposta.", error);
    return NextResponse.json({ error: "Não foi possível guardar o feedback agora." }, { status: 503 });
  }
}
