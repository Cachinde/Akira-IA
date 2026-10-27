import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiChat, apiDescribe } from "@/lib/space";
import {
  activateChatJob,
  claimChatJob,
  consumeUsage,
  createChatJob,
  getChatJob,
  getOrCreateUser,
  setUserCookie,
  touchChatJob,
  updateChatJob,
  type ChatJobRequest,
} from "@/lib/billing";
import { getAuthSnapshot } from "@/lib/auth";
import {
  CHAT_MESSAGE_CHARACTER_LIMIT,
  CHAT_REQUEST_CHARACTER_LIMIT,
} from "@/lib/chat-limits";

export const runtime = "nodejs";
export const maxDuration = 300;

const activeChatJobs = new Set<string>();

async function startChatJob(jobId: string, userId: string): Promise<void> {
  if (activeChatJobs.has(jobId)) return;
  activeChatJobs.add(jobId);
  try {
    const request = await claimChatJob(jobId, userId);
    if (!request) return;

    const heartbeat = setInterval(() => {
      touchChatJob(jobId, userId).catch((error: unknown) => {
        console.error("Não foi possível renovar o processamento da conversa.", error);
      });
    }, 60_000);
    try {
      const imageDescription = request.imageB64
        ? await apiDescribe(request.imageB64, request.message || undefined)
        : "";
      const imageContext = imageDescription ? `[imagem anexada: ${imageDescription}]` : "";
      const requestMessage = imageContext
        ? `${request.message}\n\n${imageContext}`
        : request.message;
      const result = await apiChat(requestMessage, request.history, request.displayName, request.chatId);
      await updateChatJob(jobId, {
        status: "complete",
        result: { ...result, ...(imageContext ? { context: imageContext } : {}) },
      });
    } catch (error) {
      console.error("Falha ao processar um pedido de chat em segundo plano.", error);
      await updateChatJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "A AKIRA não conseguiu responder.",
      });
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    console.error("Falha ao iniciar o processamento do pedido de chat.", error);
    throw error;
  } finally {
    activeChatJobs.delete(jobId);
  }
}

export async function GET(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: "O identificador do pedido é inválido." }, { status: 400 });
  }
  const identity = getOrCreateUser(req);
  const job = await getChatJob(jobId, identity.userId);
  if (!job) {
    return NextResponse.json(
      { error: "Este pedido não existe ou já expirou." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  void startChatJob(jobId, identity.userId).catch((error: unknown) => {
    console.error("Não foi possível retomar o pedido de chat.", error);
  });
  if (job.status === "complete" && job.result) {
    return NextResponse.json(job.result, { headers: { "Cache-Control": "no-store" } });
  }
  if (job.status === "failed") {
    return NextResponse.json(
      { error: job.error || "A AKIRA não conseguiu responder." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { status: "processing" },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

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
  const rawMessage = typeof input.message === "string" ? input.message : "";
  if (rawMessage.length > CHAT_MESSAGE_CHARACTER_LIMIT) {
    return NextResponse.json(
      { error: `A mensagem excede o limite de ${CHAT_MESSAGE_CHARACTER_LIMIT.toLocaleString("pt-PT")} caracteres. Encurta-a para a poderes enviar.` },
      { status: 413 },
    );
  }
  const message = rawMessage.trim();
  if (!message) return NextResponse.json({ error: "Escreve uma mensagem." }, { status: 400 });
  const context = typeof input.context === "string" ? input.context : "";
  const requestMessage = context ? `${message}\n\n${context}` : message;
  if (requestMessage.length > CHAT_REQUEST_CHARACTER_LIMIT) {
    return NextResponse.json({ error: "A mensagem e os anexos excedem o limite de 60.000 caracteres." }, { status: 413 });
  }
  const imageB64 = typeof input.imageB64 === "string" ? input.imageB64 : "";
  if (
    imageB64 &&
    (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(imageB64) ||
      imageB64.length > 11_000_000)
  ) {
    return NextResponse.json({ error: "A imagem anexada é inválida ou excede o limite de 8 MB." }, { status: 413 });
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
  const jobId =
    typeof input.jobId === "string" && /^[0-9a-f-]{36}$/i.test(input.jobId)
      ? input.jobId
      : randomUUID();

  try {
    const identity = getOrCreateUser(req);
    const authSnapshot = await getAuthSnapshot(identity.userId);
    const displayName = authSnapshot.displayName?.trim();
    if (!displayName) {
      const response = NextResponse.json(
        { code: "profile_required", error: "Escolhe primeiro o nome que a AKIRA deve usar contigo." },
        { status: 403 },
      );
      if (identity.created) setUserCookie(response, identity.userId);
      return response;
    }
    const request: ChatJobRequest = {
      message: requestMessage,
      history,
      displayName,
      // Sessão por conversa: o ID do chat (IndexedDB do cliente) identifica a
      // sessão de memória na AKIRA — cada conversa tem o seu contexto isolado.
      chatId:
        typeof input.chatId === "string" &&
        /^[A-Za-z0-9_-]{6,128}$/.test(input.chatId.trim())
          ? input.chatId.trim()
          : undefined,
      ...(imageB64 ? { imageB64 } : {}),
    };
    const created = await createChatJob(identity.userId, jobId, request);
    if (created) {
      const usage = await consumeUsage(identity.userId, "messages");
      if (usage.requiresProfile || !usage.allowed) {
        const error = usage.requiresProfile
          ? "Escolhe primeiro o nome que a AKIRA deve usar contigo."
          : usage.requiresAccount
            ? "As dez mensagens grátis terminaram. Cria a tua conta gratuita para continuares."
            : `Atingiste o limite de ${usage.limit} mensagens do plano ${usage.plan}.`;
        await updateChatJob(jobId, { status: "failed", error });
        const response = NextResponse.json(
          {
            ...(usage.requiresProfile ? { code: "profile_required" } : {}),
            ...(usage.requiresAccount ? { code: "account_required" } : {}),
            ...(!usage.requiresAccount && !usage.requiresProfile
              ? { code: "quota_exceeded", metric: "messages" }
              : {}),
            ...(usage.retryAt ? { retryAt: usage.retryAt } : {}),
            error,
          },
          { status: usage.requiresProfile || usage.requiresAccount ? 403 : 429 },
        );
        if (identity.created) setUserCookie(response, identity.userId);
        return response;
      }
      if (imageB64) {
        const fileUsage = await consumeUsage(identity.userId, "files");
        if (!fileUsage.allowed) {
          const error = `Atingiste o limite de ${fileUsage.limit} ficheiros do plano ${fileUsage.plan}.`;
          await updateChatJob(jobId, { status: "failed", error });
          const response = NextResponse.json({ error }, { status: 429 });
          if (identity.created) setUserCookie(response, identity.userId);
          return response;
        }
      }
      await activateChatJob(jobId, identity.userId);
    }
    void startChatJob(jobId, identity.userId).catch((error: unknown) => {
      console.error("Não foi possível iniciar o pedido de chat em segundo plano.", error);
    });
    const response = NextResponse.json({ jobId, status: "processing" }, { status: 202 });
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Falha ao processar a mensagem da AKIRA.", error);
    return NextResponse.json({ error: "A AKIRA não conseguiu responder agora. Tenta novamente dentro de alguns instantes." }, { status: 503 });
  }
}
