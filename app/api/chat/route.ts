import { NextRequest, NextResponse } from "next/server";
import { apiChat } from "@/lib/space";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "O pedido tem de ser um objeto JSON." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Escreve uma mensagem." }, { status: 400 });
  if (message.length > 8_000) {
    return NextResponse.json({ error: "A mensagem excede o limite de 8.000 caracteres." }, { status: 413 });
  }

  const history = Array.isArray(input.history)
    ? input.history
        .filter(
          (item): item is { role: "user" | "assistant"; content: string } =>
            !!item &&
            typeof item === "object" &&
            ((item as Record<string, unknown>).role === "user" ||
              (item as Record<string, unknown>).role === "assistant") &&
            typeof (item as Record<string, unknown>).content === "string",
        )
        .map(({ role, content }) => ({ role, content: content.slice(0, 8_000) }))
        .slice(-40)
    : [];

  try {
    return NextResponse.json(await apiChat(message, history));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Não foi possível ligar à AKIRA.";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
