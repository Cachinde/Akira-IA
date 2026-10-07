import { NextRequest, NextResponse } from "next/server";
import { apiImage, apiDescribe } from "@/lib/space";
import { consumeUsage, getOrCreateUser, setUserCookie } from "@/lib/billing";

export const runtime = "nodejs";

const IMAGE_STYLES = new Set(["foto realista", "anime", "ilustração", "3d", "cinematográfico", "aquarela"]);

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
  try {
    if (typeof input.imageB64 === "string") {
      if (!input.imageB64.startsWith("data:image/") || input.imageB64.length > 11_000_000) {
        return NextResponse.json({ error: "Anexa uma imagem válida com menos de 8 MB." }, { status: 413 });
      }

      const identity = getOrCreateUser(req);
      const usage = await consumeUsage(identity.userId, "files");
      if (!usage.allowed) {
        return NextResponse.json({ error: `Atingiste o limite de ${usage.limit} ficheiros do plano ${usage.plan}.` }, { status: 429 });
      }
      const response = NextResponse.json({
        description: await apiDescribe(
          input.imageB64,
          typeof input.prompt === "string" ? input.prompt : undefined,
        ),
      });
      if (identity.created) setUserCookie(response, identity.userId);
      return response;
    }

    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "Escreve uma descrição para a imagem." }, { status: 400 });
    if (prompt.length > 1_000) {
      return NextResponse.json({ error: "A descrição excede o limite de 1.000 caracteres." }, { status: 413 });
    }

    const style = typeof input.style === "string" && IMAGE_STYLES.has(input.style)
      ? input.style
      : "foto realista";
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
          .map(({ role, content }) => ({ role, content: content.trim().slice(0, 400) }))
          .filter(({ content }) => content.length > 0)
          .slice(-8)
      : [];

    const identity = getOrCreateUser(req);
    const usage = await consumeUsage(identity.userId, "messages");
    if (usage.requiresProfile) {
      const response = NextResponse.json({ error: "Escolhe primeiro o nome que a AKIRA deve usar contigo." }, { status: 403 });
      if (identity.created) setUserCookie(response, identity.userId);
      return response;
    }
    if (!usage.allowed) {
      const response = NextResponse.json({
        ...(usage.requiresAccount ? { code: "account_required" } : {}),
        error: usage.requiresAccount
          ? "As dez mensagens grátis terminaram. Cria a tua conta gratuita para continuares."
          : `Atingiste o limite de ${usage.limit} mensagens do plano ${usage.plan}.`,
      }, { status: usage.requiresAccount ? 403 : 429 });
      if (identity.created) setUserCookie(response, identity.userId);
      return response;
    }
    const response = NextResponse.json(await apiImage(prompt, style, history));
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Falha ao processar o pedido de imagem da AKIRA.", error);
    return NextResponse.json({ error: "Não foi possível concluir o pedido de imagem agora. Tenta novamente dentro de alguns instantes." }, { status: 503 });
  }
}
