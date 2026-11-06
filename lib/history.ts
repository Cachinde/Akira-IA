import { deleteLegacyEntries, readLegacyEntries } from "./legacy-browser-storage";

export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: string;
  image?: string;
  imageProviderModel?: string;
  attachment?: string;
  attachmentName?: string;
  feedback?: "positive" | "negative";
  uiSpec?: { component: string; props: Record<string, unknown> };
  uiSpecSegments?: Array<Record<string, unknown>>;
  createdAt: string;
};

export type Chat = {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: string;
  pendingRequest?: {
    jobId: string;
    kind: "chat" | "image";
    completionText: string;
    userMessageId: string;
    createdAt: string;
    requestPayload?: {
      endpoint: "/api/chat" | "/api/image";
      body: Record<string, unknown>;
    };
  };
};

type RecordValue = Record<string, unknown>;
type LegacyChat = RecordValue & { id: string; historyScope: string; chatId?: string };

function isRecord(value: unknown): value is RecordValue {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPendingRequest(value: unknown): value is NonNullable<Chat["pendingRequest"]> {
  return (
    isRecord(value) &&
    typeof value.jobId === "string" &&
    (value.kind === "chat" || value.kind === "image") &&
    typeof value.completionText === "string" &&
    typeof value.userMessageId === "string" &&
    typeof value.createdAt === "string" &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    (value.requestPayload === undefined ||
      (isRecord(value.requestPayload) &&
        (value.requestPayload.endpoint === "/api/chat" ||
          value.requestPayload.endpoint === "/api/image") &&
        isRecord(value.requestPayload.body)))
  );
}

function normalizeChat(chat: RecordValue, index: number): Chat {
  const now = new Date().toISOString();
  const messages: Msg[] = (chat.messages as RecordValue[]).map((candidate, messageIndex): Msg => {
    const createdAt =
      typeof candidate.createdAt === "string" && !Number.isNaN(Date.parse(candidate.createdAt))
        ? candidate.createdAt
        : now;
    const feedback: Msg["feedback"] =
      candidate.feedback === "positive" || candidate.feedback === "negative"
        ? candidate.feedback
        : undefined;
    return {
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : `legacy-${index}-${messageIndex}`,
      role: candidate.role as Msg["role"],
      content: candidate.content as string,
      createdAt,
      ...(typeof candidate.context === "string" ? { context: candidate.context } : {}),
      ...(typeof candidate.image === "string" ? { image: candidate.image } : {}),
      ...(typeof candidate.imageProviderModel === "string"
        ? { imageProviderModel: candidate.imageProviderModel }
        : {}),
      ...(typeof candidate.attachment === "string" ? { attachment: candidate.attachment } : {}),
      ...(typeof candidate.attachmentName === "string" ? { attachmentName: candidate.attachmentName } : {}),
      ...(feedback ? { feedback } : {}),
      ...(isRecord(candidate.uiSpec) &&
      typeof candidate.uiSpec.component === "string" &&
      isRecord(candidate.uiSpec.props)
        ? { uiSpec: candidate.uiSpec as Msg["uiSpec"] }
        : {}),
      ...(Array.isArray(candidate.uiSpecSegments) &&
      candidate.uiSpecSegments.length > 0 &&
      candidate.uiSpecSegments.every(isRecord)
        ? { uiSpecSegments: candidate.uiSpecSegments as Array<Record<string, unknown>> }
        : {}),
    };
  });
  const lastMessage = messages[messages.length - 1];
  const pendingRequest = chat.pendingRequest;

  return {
    id: typeof chat.id === "string" && chat.id ? chat.id : `legacy-${index}`,
    title: typeof chat.title === "string" && chat.title ? chat.title : "Nova conversa",
    messages,
    updatedAt:
      typeof chat.updatedAt === "string" && !Number.isNaN(Date.parse(chat.updatedAt))
        ? chat.updatedAt
        : lastMessage?.createdAt || now,
    ...(isPendingRequest(pendingRequest) ? { pendingRequest } : {}),
  };
}

export function parseChat(value: unknown, index = 0): Chat | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
    typeof value.title !== "string" || !Array.isArray(value.messages)) {
    return null;
  }
  if (
    !value.messages.every(
      (message) =>
        isRecord(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
  ) {
    return null;
  }
  if (value.pendingRequest !== undefined && !isPendingRequest(value.pendingRequest)) return null;
  return normalizeChat(value, index);
}

async function requestJson<T>(url: string, historyScope: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("x-akira-account-scope", historyScope);
  const response = await fetch(url, { cache: "no-store", ...init, headers });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor não devolveu uma resposta válida para o histórico.");
  }
  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "Não foi possível guardar o histórico na base de dados.";
    throw new Error(message);
  }
  return data as T;
}

function storedChat(entry: unknown, index: number, historyScope: string): Chat | null {
  if (!isRecord(entry) || entry.historyScope !== historyScope || typeof entry.id !== "string") return null;
  const id = typeof entry.chatId === "string" ? entry.chatId : entry.id;
  return parseChat({ ...entry, id }, index);
}

async function migrateLegacyChats(historyScope: string): Promise<void> {
  const entries = await readLegacyEntries("conversations");
  const scopedEntries = entries.filter(
    (entry): entry is LegacyChat =>
      isRecord(entry) &&
      entry.historyScope === historyScope &&
      typeof entry.id === "string",
  );
  if (!scopedEntries.length) return;

  const chats = scopedEntries.map((entry, index) => storedChat(entry, index, historyScope));
  if (chats.some((chat) => !chat)) {
    throw new Error("Há conversas antigas inválidas; os dados locais foram mantidos para recuperação.");
  }
  await saveChats(historyScope, chats as Chat[]);
  await deleteLegacyEntries("conversations", scopedEntries.map((entry) => entry.id));
}

export async function loadChats(historyScope: string): Promise<Chat[]> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta deste histórico.");
  await migrateLegacyChats(historyScope);
  const data = await requestJson<{ chats?: unknown }>("/api/conversations", historyScope);
  if (!Array.isArray(data.chats)) throw new Error("A resposta do histórico tem um formato inválido.");
  const chats = data.chats.map(parseChat);
  if (chats.some((chat) => !chat)) throw new Error("O servidor devolveu uma conversa inválida.");
  return (chats as Chat[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveChats(_historyScope: string, chats: Chat[]): Promise<void> {
  if (!chats.length) return;
  await requestJson("/api/conversations", _historyScope, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chats }),
  });
}

export async function saveChat(historyScope: string, chat: Chat): Promise<void> {
  await saveChats(historyScope, [chat]);
}

export async function deleteChat(historyScope: string, chatId: string): Promise<void> {
  await requestJson(`/api/conversations?chatId=${encodeURIComponent(chatId)}`, historyScope, { method: "DELETE" });
}

export async function clearChats(historyScope: string): Promise<void> {
  await requestJson("/api/conversations", historyScope, { method: "DELETE" });
}
