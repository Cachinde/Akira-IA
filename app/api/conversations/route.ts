import { NextRequest, NextResponse } from "next/server";
import { billingPool } from "@/lib/billing";
import { Chat, parseChat } from "@/lib/history";
import {
  attachPersistentUserCookie,
  getPersistentUser,
  persistentScopeMatches,
} from "@/lib/persistent-user";

export const runtime = "nodejs";

const CHAT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_SAVED_CONVERSATION_BYTES = 64 * 1024 * 1024;
const MAX_CONVERSATIONS_PER_SAVE = 500;

export async function GET(request: NextRequest) {
  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega o histórico antes de continuar." }, { status: 403 });
    }
    const result = await billingPool().query<{
      conversation_id: string;
      title: string;
      messages: Chat["messages"];
      pending_request: Chat["pendingRequest"] | null;
      updated_at: Date;
    }>(
      `SELECT conversation_id, title, messages, pending_request, updated_at
       FROM akira_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [identity.userId],
    );
    const chats: Chat[] = result.rows.map((row) => ({
      id: row.conversation_id,
      title: row.title,
      messages: row.messages,
      updatedAt: new Date(row.updated_at).toISOString(),
      ...(row.pending_request ? { pendingRequest: row.pending_request } : {}),
    }));
    const response = NextResponse.json({ chats }, { headers: { "Cache-Control": "no-store" } });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao carregar as conversas da base de dados.", error);
    return NextResponse.json({ error: "Não foi possível carregar as conversas da tua conta." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SAVED_CONVERSATION_BYTES + 1024) {
    return NextResponse.json({ error: "O histórico excede o limite de dados por gravação." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).chats)) {
    return NextResponse.json({ error: "O pedido tem de conter uma lista de conversas." }, { status: 400 });
  }

  const rawChats = (body as { chats: unknown[] }).chats;
  if (rawChats.length > MAX_CONVERSATIONS_PER_SAVE) {
    return NextResponse.json({ error: "O histórico contém demasiadas conversas para guardar de uma só vez." }, { status: 413 });
  }
  const chats = rawChats.map(parseChat);
  if (
    chats.some(
      (chat) =>
        !chat ||
        !CHAT_ID_PATTERN.test(chat.id) ||
        chat.title.length > 200 ||
        chat.messages.length > 10_000,
    )
  ) {
    return NextResponse.json({ error: "Uma ou mais conversas têm dados inválidos." }, { status: 400 });
  }
  const validChats = chats as Chat[];
  if (Buffer.byteLength(JSON.stringify(validChats), "utf8") > MAX_SAVED_CONVERSATION_BYTES) {
    return NextResponse.json({ error: "O histórico excede o limite de dados por gravação." }, { status: 413 });
  }

  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega o histórico antes de continuar." }, { status: 403 });
    }
    const database = billingPool();
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      for (const chat of validChats) {
        const updatedAt = new Date(chat.updatedAt);
        const createdAt = chat.messages[0]?.createdAt
          ? new Date(chat.messages[0].createdAt)
          : updatedAt;
        await client.query(
          `INSERT INTO akira_conversations
             (user_id, conversation_id, title, messages, pending_request, created_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
           ON CONFLICT (user_id, conversation_id) DO UPDATE SET
             title = EXCLUDED.title,
             messages = EXCLUDED.messages,
             pending_request = EXCLUDED.pending_request,
             updated_at = EXCLUDED.updated_at
           WHERE akira_conversations.updated_at <= EXCLUDED.updated_at`,
          [
            identity.userId,
            chat.id,
            chat.title,
            JSON.stringify(chat.messages),
            chat.pendingRequest ? JSON.stringify(chat.pendingRequest) : null,
            createdAt,
            updatedAt,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const response = NextResponse.json({ saved: validChats.length });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao guardar conversas na base de dados.", error);
    return NextResponse.json({ error: "Não foi possível guardar as conversas na base de dados." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const chatId = new URL(request.url).searchParams.get("chatId");
  if (chatId && !CHAT_ID_PATTERN.test(chatId)) {
    return NextResponse.json({ error: "O identificador da conversa é inválido." }, { status: 400 });
  }
  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega o histórico antes de continuar." }, { status: 403 });
    }
    const result = chatId
      ? await billingPool().query(
          "DELETE FROM akira_conversations WHERE user_id = $1 AND conversation_id = $2",
          [identity.userId, chatId],
        )
      : await billingPool().query("DELETE FROM akira_conversations WHERE user_id = $1", [identity.userId]);
    const response = NextResponse.json({ deleted: result.rowCount || 0 });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao apagar conversas da base de dados.", error);
    return NextResponse.json({ error: "Não foi possível apagar as conversas da tua conta." }, { status: 503 });
  }
}
