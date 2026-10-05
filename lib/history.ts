export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: string;
  image?: string;
  attachment?: string;
  createdAt: string;
};

export type Chat = {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: string;
};

const DATABASE = "akira-bot-ui";
const STORE = "conversations";
const LEGACY_STORAGE_KEY = "akira_chats_v1";
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
      ...(typeof candidate.attachment === "string" ? { attachment: candidate.attachment } : {}),
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
  };
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível ler o histórico."));
  });
}

export async function loadChats(): Promise<Chat[]> {
  const database = await openDatabase();
  const saved = await readRequest<unknown[]>(
    database.transaction(STORE, "readonly").objectStore(STORE).getAll(),
  );
  const chats = saved.filter(isChat).map(normalizeChat);
  if (chats.length) {
    return chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return [];
  let oldChats: unknown;
  try {
    oldChats = JSON.parse(legacy);
  } catch {
    throw new Error("O histórico antigo está danificado e não pôde ser importado.");
  }

  const imported = Array.isArray(oldChats) ? oldChats.filter(isChat).map(normalizeChat) : [];
  if (!imported.length) return [];
  await saveChats(imported);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return imported.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveChats(chats: Chat[]): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    store.clear();
    for (const chat of chats) store.put(chat);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar o histórico."));
    transaction.onabort = () => reject(transaction.error || new Error("A gravação do histórico foi cancelada."));
  });
}

export async function clearChats(): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível limpar o histórico."));
    transaction.onabort = () => reject(transaction.error || new Error("A limpeza do histórico foi cancelada."));
  });
}
