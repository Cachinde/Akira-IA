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

type StoredChat = Chat & { chatId?: string; historyScope?: string };

const DATABASE = "akira-bot-ui";
const STORE = "conversations";
let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Este navegador não suporta o histórico local."));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Não foi possível abrir o histórico."));
      request.onblocked = () => reject(new Error("O histórico está bloqueado por outra aba."));
    });
  }

  return databasePromise;
}

function isChat(value: unknown): value is Chat {
  if (!value || typeof value !== "object") return false;
  const chat = value as Partial<Chat>;
  return (
    typeof chat.id === "string" &&
    typeof chat.title === "string" &&
    Array.isArray(chat.messages) &&
    chat.messages.every(
      (message) =>
        !!message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
  );
}

function normalizeChat(chat: Chat, index: number): Chat {
  const now = new Date().toISOString();
  const messages = chat.messages.map((message, messageIndex) => {
    const candidate = message as Msg;
    const createdAt =
      typeof candidate.createdAt === "string" && !Number.isNaN(Date.parse(candidate.createdAt))
        ? candidate.createdAt
        : now;
    return {
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : `legacy-${index}-${messageIndex}`,
      role: candidate.role,
      content: candidate.content,
      createdAt,
      ...(typeof candidate.context === "string" ? { context: candidate.context } : {}),
      ...(typeof candidate.image === "string" ? { image: candidate.image } : {}),
      ...(typeof candidate.imageProviderModel === "string"
        ? { imageProviderModel: candidate.imageProviderModel }
        : {}),
      ...(typeof candidate.attachment === "string" ? { attachment: candidate.attachment } : {}),
      ...(typeof candidate.attachmentName === "string" ? { attachmentName: candidate.attachmentName } : {}),
      ...(candidate.feedback === "positive" || candidate.feedback === "negative"
        ? { feedback: candidate.feedback }
        : {}),
    };
  });
  const lastMessage = messages[messages.length - 1];
  return {
    id: chat.id || `legacy-${index}`,
    title: chat.title || "Nova conversa",
    messages,
    updatedAt:
      typeof chat.updatedAt === "string" && !Number.isNaN(Date.parse(chat.updatedAt))
        ? chat.updatedAt
        : lastMessage?.createdAt || now,
    ...(chat.pendingRequest &&
    typeof chat.pendingRequest.jobId === "string" &&
    (chat.pendingRequest.kind === "chat" || chat.pendingRequest.kind === "image") &&
    typeof chat.pendingRequest.completionText === "string" &&
    typeof chat.pendingRequest.userMessageId === "string" &&
    typeof chat.pendingRequest.createdAt === "string" &&
    !Number.isNaN(Date.parse(chat.pendingRequest.createdAt)) &&
    (!chat.pendingRequest.requestPayload ||
      ((chat.pendingRequest.requestPayload.endpoint === "/api/chat" ||
        chat.pendingRequest.requestPayload.endpoint === "/api/image") &&
        !!chat.pendingRequest.requestPayload.body &&
        typeof chat.pendingRequest.requestPayload.body === "object"))
      ? { pendingRequest: chat.pendingRequest }
      : {}),
  };
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível ler o histórico."));
  });
}

export async function loadChats(historyScope: string): Promise<Chat[]> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta deste histórico.");
  const database = await openDatabase();
  const saved = await readRequest<unknown[]>(
    database.transaction(STORE, "readonly").objectStore(STORE).getAll(),
  );
  const chats = saved
    .filter(
      (value): value is StoredChat =>
        isChat(value) &&
        !!value &&
        typeof value === "object" &&
        (value as StoredChat).historyScope === historyScope,
    )
    .map((chat, index) =>
      normalizeChat(
        { ...chat, id: typeof chat.chatId === "string" ? chat.chatId : chat.id },
        index,
      ),
    );
  return chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveChats(historyScope: string, chats: Chat[]): Promise<void> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta deste histórico.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const getAll = store.getAll();
    getAll.onsuccess = () => {
      const savedById = new Map(
        (getAll.result as StoredChat[])
          .filter((chat) => chat.historyScope === historyScope)
          .map((chat) => [chat.chatId || chat.id, chat]),
      );
      for (const chat of chats) {
        const saved = savedById.get(chat.id);
        if (saved && saved.updatedAt > chat.updatedAt) continue;
        const storageId = `${historyScope}:${chat.id}`;
        if (saved && saved.id !== storageId) store.delete(saved.id);
        store.put({ ...chat, id: storageId, chatId: chat.id, historyScope } satisfies StoredChat);
      }
    };
    getAll.onerror = () => transaction.abort();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar o histórico."));
    transaction.onabort = () => reject(transaction.error || new Error("A gravação do histórico foi cancelada."));
  });
}

export async function saveChat(historyScope: string, chat: Chat): Promise<void> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta deste histórico.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const storageId = `${historyScope}:${chat.id}`;
    const request = store.get(storageId);
    request.onsuccess = () => {
      const saved = request.result as StoredChat | undefined;
      if (saved && saved.updatedAt > chat.updatedAt) return;
      store.put({ ...chat, id: storageId, chatId: chat.id, historyScope } satisfies StoredChat);
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar a conversa."));
    transaction.onabort = () => reject(transaction.error || new Error("A gravação da conversa foi cancelada."));
  });
}

export async function deleteChat(historyScope: string, chatId: string): Promise<void> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta deste histórico.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      for (const chat of request.result as StoredChat[]) {
        if (chat.historyScope === historyScope && (chat.chatId || chat.id) === chatId) {
          store.delete(chat.id);
        }
      }
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível apagar a conversa."));
    transaction.onabort = () => reject(transaction.error || new Error("A remoção da conversa foi cancelada."));
  });
}

export async function clearChats(historyScope: string): Promise<void> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta deste histórico.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      for (const chat of request.result as StoredChat[]) {
        if (chat.historyScope === historyScope) store.delete(chat.id);
      }
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível limpar o histórico."));
    transaction.onabort = () => reject(transaction.error || new Error("A limpeza do histórico foi cancelada."));
  });
}
