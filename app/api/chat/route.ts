import { NextRequest, NextResponse } from "next/server";
import { apiChat } from "@/lib/space";
import { consumeUsage, getOrCreateUser, setUserCookie } from "@/lib/billing";

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
  if (message.length > 60_000) {
    return NextResponse.json({ error: "A mensagem e os anexos excedem o limite de 60.000 caracteres." }, { status: 413 });
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
    const identity = getOrCreateUser(req);
    const usage = await consumeUsage(identity.userId, "messages");
    if (usage.requiresProfile) {
      const response = NextResponse.json(
        { code: "profile_required", error: "Escolhe primeiro o nome que a AKIRA deve usar contigo." },
        { status: 403 },
      );
      if (identity.created) setUserCookie(response, identity.userId);
      return response;
    }
    if (!usage.allowed) {
      const response = NextResponse.json(
        {
          ...(usage.requiresAccount ? { code: "account_required" } : {}),
          error: usage.requiresAccount
            ? "As cinco mensagens grátis terminaram. Cria a tua conta gratuita para continuares."
            : `Atingiste o limite de ${usage.limit} mensagens do plano ${usage.plan}.`,
        },
        { status: usage.requiresAccount ? 403 : 429 },
      );
      if (identity.created) setUserCookie(response, identity.userId);
      return response;
    }
    const response = NextResponse.json(await apiChat(message, history));
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Falha ao processar a mensagem da AKIRA.", error);
    return NextResponse.json({ error: "A AKIRA não conseguiu responder agora. Tenta novamente dentro de alguns instantes." }, { status: 503 });
  }
}
