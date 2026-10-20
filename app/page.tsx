"use client";

import {
  ArrowUpRight,
  ArrowUp,
  Check,
  Copy,
  ChevronDown,
  Clock3,
  Download,
  FileDown,
  Globe,
  ImagePlus,
  Lightbulb,
  ListTodo,
  LoaderCircle,
  Maximize2,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  SquarePen,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Logo from "../components/Logo";
import { Chat, Msg, clearChats, deleteChat, loadChats, saveChat, saveChats } from "../lib/history";
import { extractWebSearchQuery, isComputeRequest, isImageGenerationRequest } from "../lib/action-intents";
import {
  CHAT_MESSAGE_CHARACTER_LIMIT,
  estimateTokens,
  IMAGE_GENERATION_CHARACTER_LIMIT,
} from "../lib/chat-limits";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AuthSnapshot = {
  historyScope: string;
  displayName: string | null;
  email: string | null;
  authenticated: boolean;
  guestMessagesUsed: number;
  guestMessageLimit: number;
};

type AuthMode = "profile" | "account" | null;

class AccountRequiredError extends Error {}

class HttpResponseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

class ContentModerationError extends Error {}

class UsageLimitError extends Error {
  constructor(
    readonly metric: "messages" | "images" | "files",
    message: string,
    readonly retryAt: string | null,
  ) {
    super(message);
  }
}

const STYLES = ["foto realista", "anime", "ilustração", "3d", "cinematográfico", "aquarela"];
const FILE_LIMIT = 8 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "pdf", "docx"]);

function isWebSearchRequest(text: string) {
  return extractWebSearchQuery(text) !== null ||
    /\b(pesquis\w*|procur\w*|busc\w*|investig\w*)\b.{0,40}\b(web|internet|online)\b|\b(web|internet|online)\b.{0,40}\b(pesquis\w*|procur\w*|busc\w*|investig\w*)\b/i.test(text);
}

function uid() {
  return crypto.randomUUID();
}

function makeMessage(role: Msg["role"], content: string, extras: Partial<Msg> = {}): Msg {
  return { id: uid(), role, content, createdAt: new Date().toISOString(), ...extras };
}

function conversationTitle(text: string) {
  const title = text.trim().replace(/\s+/g, " ");
  return title.length > 38 ? `${title.slice(0, 38).trimEnd()}…` : title || "Nova conversa";
}

function formatTime(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("pt", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function resizeComposerTextarea(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function formatCountdown(retryAt: string, now: number) {
  const remaining = Date.parse(retryAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "00:00:00";
  const totalSeconds = Math.ceil(remaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  return days ? `${days}d ${clock}` : clock;
}

function responseError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}

async function readJson(response: Response) {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (data && typeof data === "object" && "code" in data && data.code === "content_moderation") {
      throw new ContentModerationError(responseError(data, "Reformula a descrição e tenta novamente."));
    }
    if (data && typeof data === "object" && "code" in data && data.code === "account_required") {
      throw new AccountRequiredError(responseError(data, "Cria uma conta grátis para continuares."));
    }
    if (
      data &&
      typeof data === "object" &&
      "code" in data &&
      data.code === "quota_exceeded" &&
      "metric" in data &&
      (data.metric === "messages" || data.metric === "images")
    ) {
      const retryAt = "retryAt" in data && typeof data.retryAt === "string" ? data.retryAt : null;
      throw new UsageLimitError(data.metric, responseError(data, "Atingiste o limite de utilização do teu plano."), retryAt);
    }
    throw new HttpResponseError(
      responseError(data, "O pedido à AKIRA não foi concluído."),
      response.status,
    );
  }
  return data;
}

async function waitForJob(endpoint: string, jobId: string): Promise<unknown> {
  let delay = 1_500;
  while (true) {
    try {
      const separator = endpoint.includes("?") ? "&" : "?";
      const response = await fetch(`${endpoint}${separator}jobId=${encodeURIComponent(jobId)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const result = await readJson(response);
      if (
        result &&
        typeof result === "object" &&
        "status" in result &&
        result.status === "processing"
      ) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay + 1_000, 8_000);
        continue;
      }
      return result;
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        console.warn("A consulta do pedido expirou; continuará a ser consultada.", error);
      } else if (!(error instanceof TypeError)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay + 1_000, 8_000);
    }
  }
}

const suggestions = [
  { icon: Lightbulb, label: "Explorar uma ideia", text: "Ajuda-me a desenvolver uma ideia criativa." },
  { icon: ImagePlus, label: "Criar uma imagem", text: "" },
  { icon: Globe, label: "Pesquisar na web", text: "pesquisa na web: " },
  { icon: SquarePen, label: "Escrever melhor", text: "Ajuda-me a escrever um texto claro sobre " },
];

export default function Page() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [fileReadingChatKeys, setFileReadingChatKeys] = useState<Set<string>>(() => new Set());
  const [activeSessionVersion, setActiveSessionVersion] = useState(0);
  const [pendingChatIds, setPendingChatIds] = useState<Set<string>>(() => new Set());
  const [queuedCounts, setQueuedCounts] = useState<Record<string, number>>({});
  const [requestActivities, setRequestActivities] = useState<
    Record<string, { messages: string[]; index: number; slow: boolean }>
  >({});
  const [greetingRun, setGreetingRun] = useState(0);
  const [typedGreeting, setTypedGreeting] = useState("");
  const [typedQuestion, setTypedQuestion] = useState("");
  const [greetingPhase, setGreetingPhase] = useState<"greeting" | "question" | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [imgMode, setImgMode] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"error" | "success" | "">("");
  const [quotaNotice, setQuotaNotice] = useState<UsageLimitError | null>(null);
  const [moderationNotice, setModerationNotice] = useState<{
    chatId: string;
    prompt: string;
    imageRequest: boolean;
    editRequest: boolean;
  } | null>(null);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [imageStyle, setImageStyle] = useState(STYLES[0]);
  const [editTarget, setEditTarget] = useState<{
    messageId: string;
    image: string;
    providerModel?: string;
  } | null>(null);
  const [attachment, setAttachment] = useState<{ name: string; dataUrl?: string; text?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authLinkSent, setAuthLinkSent] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [chatMenu, setChatMenu] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyWritable, setHistoryWritable] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [atLatest, setAtLatest] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLElement>(null);
  const shouldFollowMessages = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageViewerCloseRef = useRef<HTMLButtonElement>(null);
  const pendingChatIdsRef = useRef(new Set<string>());
  const activeJobPollsRef = useRef(new Set<string>());
  const queuedMessagesRef = useRef<Record<string, string[]>>({});
  const draftsRef = useRef<Record<string, { input: string; imgMode: boolean }>>({});
  const activeIdRef = useRef<string | null>(null);
  const activeSessionVersionRef = useRef(0);
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  const activeChat = chats.find((chat) => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];
  const activeChatPending = !!activeId && pendingChatIds.has(activeId);
  const activeQueuedCount = activeId ? queuedCounts[activeId] || 0 : 0;
  const activeQueuedMessages =
    activeId && activeChatPending ? queuedMessagesRef.current[activeId] || [] : [];
  const activity = activeId ? requestActivities[activeId] : undefined;
  const activeSessionKey = `${activeSessionVersion}:${activeId ?? "new"}`;
  const busy = fileReadingChatKeys.has(activeSessionKey);
  const automaticImagePrompt =
    !imgMode &&
    !editTarget &&
    isImageGenerationRequest(input) &&
    (!attachment || Boolean(attachment.dataUrl));
  const messageCharacterLimit =
    imgMode || editTarget || automaticImagePrompt
      ? IMAGE_GENERATION_CHARACTER_LIMIT
      : CHAT_MESSAGE_CHARACTER_LIMIT;
  const messageExceedsLimit = input.length > messageCharacterLimit;
  const messageNearLimit = !messageExceedsLimit && input.length > messageCharacterLimit * 0.9;
  const displayName = authSnapshot?.displayName?.trim() || "";
  const query = search.trim().toLocaleLowerCase("pt");
  const visibleChats = chats.filter(
    (chat) =>
      !query ||
      chat.title.toLocaleLowerCase("pt").includes(query) ||
      chat.messages.some((message) => message.content.toLocaleLowerCase("pt").includes(query)),
  );

  useEffect(() => {
    if (!authReady || !authSnapshot?.historyScope) return;
    let active = true;
    setHistoryReady(false);
    setHistoryWritable(false);
    setChats([]);
    setActiveId(null);
    activeIdRef.current = null;
    draftsRef.current = {};
    queuedMessagesRef.current = {};
    setQueuedCounts({});
    activeSessionVersionRef.current += 1;
    setActiveSessionVersion(activeSessionVersionRef.current);
    loadChats(authSnapshot.historyScope)
      .then((list) => {
        if (!active) return;
        setChats(list);
        chatsRef.current = list;
        setHistoryWritable(true);
        setHistoryReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStorageError(error instanceof Error ? error.message : "Não foi possível abrir o histórico local.");
        setHistoryReady(true);
      });
    return () => {
      active = false;
    };
  }, [authReady, authSnapshot?.historyScope]);

  useEffect(() => {
    const scope = authSnapshot?.historyScope;
    if (!historyReady || !scope) return;
    const pendingChats = chats.filter((chat) => chat.pendingRequest);
    pendingChatIdsRef.current = new Set(pendingChats.map((chat) => chat.id));
    setPendingChatIds(new Set(pendingChatIdsRef.current));
    for (const chat of pendingChats) {
      const pending = chat.pendingRequest;
      if (pending) void runPendingJob(chat.id, pending, scope);
    }
  }, [authSnapshot?.historyScope, chats, historyReady]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(readJson)
      .then((snapshot: unknown) => {
        if (!active || !snapshot || typeof snapshot !== "object") return;
        const auth = snapshot as AuthSnapshot;
        setAuthSnapshot(auth);
        setAuthName(auth.displayName || "");
        if (!auth.displayName) setAuthMode("profile");
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Não foi possível carregar a conta.");
        setStatusKind("error");
        setAuthReady(true);
        setHistoryReady(true);
      });
    const accountResult = new URLSearchParams(window.location.search).get("account");
    const authResult = new URLSearchParams(window.location.search).get("auth");
    if (authResult === "success") {
      setStatus("Sessão iniciada. Bem-vindo à AKIRA.");
      setStatusKind("success");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (authResult === "error") {
      setStatus("Não foi possível concluir a entrada. Tenta novamente ou escolhe outro método.");
      setStatusKind("error");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (authResult === "unavailable") {
      setStatus("Este método de entrada está temporariamente indisponível. Podes entrar com o teu e-mail.");
      setStatusKind("error");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (accountResult === "verified") {
      setStatus("E-mail confirmado. A tua conta AKIRA está pronta.");
      setStatusKind("success");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (accountResult === "expired-link" || accountResult === "invalid-link") {
      setStatus("Este link de acesso é inválido ou expirou. Pede um novo link.");
      setStatusKind("error");
      setAuthMode("account");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (accountResult === "verification-error") {
      setStatus("Não foi possível confirmar o link agora. Tenta novamente.");
      setStatusKind("error");
      window.history.replaceState({}, "", window.location.pathname);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady || messages.length > 0) return;

    const intro = displayName ? `Olá, ${displayName}.` : "";
    const question = "Como posso te ajudar?";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedGreeting(intro);
      setTypedQuestion(question);
      setGreetingPhase(null);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let phasePosition = 0;
    let active = true;

    setTypedGreeting("");
    setTypedQuestion("");

    const schedule = (callback: () => void, delay: number) => {
      timers.push(setTimeout(callback, delay));
    };
    const type = (
      text: string,
      update: (value: string) => void,
      onComplete: () => void,
    ) => {
      phasePosition = 0;
      const nextCharacter = () => {
        if (!active) return;
        phasePosition += 1;
        update(text.slice(0, phasePosition));
        if (phasePosition < text.length) {
          schedule(nextCharacter, 46);
        } else {
          onComplete();
        }
      };
      schedule(nextCharacter, 46);
    };
    const typeQuestion = () => {
      setGreetingPhase("question");
      type(question, setTypedQuestion, () => setGreetingPhase(null));
    };
    const startQuestion = () => schedule(typeQuestion, intro ? 320 : 0);

    if (intro) {
      setGreetingPhase("greeting");
      type(intro, setTypedGreeting, startQuestion);
    } else {
      startQuestion();
    }

    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, [activeId, authReady, displayName, greetingRun, messages.length]);

  useEffect(() => {
    if (!historyReady || !historyWritable) return;
    const scope = authSnapshot?.historyScope;
    if (!scope) return;
    saveChats(scope, chats).catch((error: unknown) => {
      setStorageError(error instanceof Error ? error.message : "Não foi possível guardar o histórico.");
    });
  }, [authSnapshot?.historyScope, chats, historyReady, historyWritable]);

  useEffect(() => {
    shouldFollowMessages.current = true;
    setAtLatest(true);
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [activeId]);

  useEffect(() => {
    if (messages.length === 0 && !busy && !activeChatPending) return;
    if (shouldFollowMessages.current && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [activeId, messages.length, busy, activeChatPending]);

  useEffect(() => {
    if (inputRef.current) resizeComposerTextarea(inputRef.current);
  }, [input]);

  useEffect(() => {
    function handleResize() {
      if (inputRef.current) resizeComposerTextarea(inputRef.current);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!pendingChatIds.size) return;
    const timer = setInterval(() => {
      setRequestActivities((current) => {
        const next = { ...current };
        for (const chatId of pendingChatIds) {
          const state = next[chatId];
          if (state && state.index < state.messages.length - 1) {
            next[chatId] = { ...state, index: state.index + 1 };
          }
        }
        return next;
      });
    }, 2400);
    return () => clearInterval(timer);
  }, [pendingChatIds]);

  useEffect(() => {
    if (!quotaNotice?.retryAt) return;
    const timer = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quotaNotice?.retryAt]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => {
      setStatus("");
      setStatusKind("");
    }, statusKind === "error" ? 5000 : 2400);
    return () => clearTimeout(timer);
  }, [status, statusKind]);

  useEffect(() => {
    if (
      authSnapshot &&
      !authSnapshot.authenticated &&
      authSnapshot.guestMessagesUsed >= authSnapshot.guestMessageLimit
    ) {
      setAuthMode("account");
    }
  }, [authSnapshot]);

  useEffect(() => {
    if (!expandedImage) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    imageViewerCloseRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [expandedImage]);

  useEffect(() => {
    function onShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        newChat();
      }
      if (event.key === "Escape") {
        setSideOpen(false);
        setToolsOpen(false);
        setChatMenu(null);
        setQuotaNotice(null);
        setModerationNotice(null);
        setExpandedImage(null);
      }
    }

    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  function finishPendingJob(
    chatId: string,
    pending: NonNullable<Chat["pendingRequest"]>,
    scope: string,
    result?: unknown,
    error?: string,
  ) {
    const currentChat = chatsRef.current.find((chat) => chat.id === chatId);
    if (currentChat?.pendingRequest?.jobId !== pending.jobId) return;

    let assistantMessage: Msg;
    if (error) {
      assistantMessage = makeMessage("assistant", `O pedido não foi concluído: ${error}`);
    } else if (
      result &&
      typeof result === "object" &&
      "image" in result &&
      typeof result.image === "string"
    ) {
      const providerModel =
        "providerModel" in result && typeof result.providerModel === "string"
          ? result.providerModel
          : undefined;
      const imageContext =
        "imageContext" in result &&
        typeof result.imageContext === "string" &&
        result.imageContext.trim()
          ? result.imageContext.trim().slice(0, 2000)
          : undefined;
      const content =
        "reply" in result && typeof result.reply === "string" && result.reply.trim()
          ? result.reply
          : pending.completionText;
      assistantMessage = makeMessage("assistant", content, {
        image: result.image,
        ...(providerModel ? { imageProviderModel: providerModel } : {}),
        ...(imageContext ? { context: imageContext } : {}),
      });
    } else if (
      pending.kind === "chat" &&
      result &&
      typeof result === "object" &&
      "reply" in result &&
      typeof result.reply === "string"
    ) {
      assistantMessage = makeMessage("assistant", result.reply);
    } else {
      assistantMessage = makeMessage("assistant", "A AKIRA devolveu um resultado inválido para este pedido.");
    }

    const { pendingRequest: _pendingRequest, ...chatWithoutPending } = currentChat;
    const resultContext =
      pending.kind === "chat" &&
      result &&
      typeof result === "object" &&
      "context" in result &&
      typeof result.context === "string"
        ? result.context
        : null;
    const messagesWithContext = resultContext
      ? currentChat.messages.map((message) =>
          message.id === pending.userMessageId ? { ...message, context: resultContext } : message,
        )
      : currentChat.messages;
    const updatedChat: Chat = {
      ...chatWithoutPending,
      messages: [...messagesWithContext, assistantMessage],
      updatedAt: assistantMessage.createdAt,
    };
    const updatedChats = chatsRef.current
      .map((chat) => (chat.id === chatId ? updatedChat : chat))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    chatsRef.current = updatedChats;
    setChats(updatedChats);
    saveChat(scope, updatedChat).catch((storageError: unknown) => {
      setStorageError(storageError instanceof Error ? storageError.message : "Não foi possível guardar a resposta.");
    });
  }

  function clearPendingJob(chatId: string, jobId: string, removeUserMessage = false) {
    const currentChat = chatsRef.current.find((chat) => chat.id === chatId);
    if (currentChat?.pendingRequest?.jobId !== jobId) return;
    const { pendingRequest: _pendingRequest, ...chatWithoutPending } = currentChat;
    const updatedChat: Chat = {
      ...chatWithoutPending,
      ...(removeUserMessage
        ? {
            messages: currentChat.messages.filter(
              (message) => message.id !== currentChat.pendingRequest?.userMessageId,
            ),
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    const updatedChats = chatsRef.current.map((chat) => (chat.id === chatId ? updatedChat : chat));
    chatsRef.current = updatedChats;
    setChats(updatedChats);
    const scope = authSnapshot?.historyScope;
    if (scope) {
      saveChat(scope, updatedChat).catch((storageError: unknown) => {
        setStorageError(storageError instanceof Error ? storageError.message : "Não foi possível atualizar o histórico.");
      });
    }
  }

  function rememberModerationBlock(
    chatId: string,
    pending: NonNullable<Chat["pendingRequest"]>,
  ) {
    const requestBody = pending.requestPayload?.body;
    const prompt =
      requestBody && typeof requestBody.prompt === "string"
        ? requestBody.prompt
        : chatsRef.current
            .find((chat) => chat.id === chatId)
            ?.messages.find((message) => message.id === pending.userMessageId)?.content || "";
    setModerationNotice({
      chatId,
      prompt,
      imageRequest: pending.kind === "image",
      editRequest: requestBody?.action === "edit",
    });
    clearPendingJob(chatId, pending.jobId);
  }

  function reformulateBlockedPrompt() {
    if (!moderationNotice) return;
    const { chatId, prompt, imageRequest, editRequest } = moderationNotice;
    stashDraft();
    delete draftsRef.current[chatId];
    const chat = chatsRef.current.find((item) => item.id === chatId);
    const userMessage = chat?.messages[chat.messages.length - 1];
    activeSessionVersionRef.current += 1;
    setActiveSessionVersion(activeSessionVersionRef.current);
    activeIdRef.current = chatId;
    setActiveId(chatId);
    setInput(prompt);
    setStatus("");
    setStatusKind("");
    if (imageRequest && !editRequest) {
      setImgMode(true);
      if (userMessage?.attachment?.startsWith("data:image/")) {
        setAttachment({
          name: userMessage.attachmentName || "Imagem de referência",
          dataUrl: userMessage.attachment,
        });
      }
    }
    if (editRequest && userMessage?.attachment) {
      const sourceImageMessage = chat?.messages.find(
        (message) => message.role === "assistant" && message.image === userMessage.attachment,
      );
      setEditTarget({
        messageId: sourceImageMessage?.id || userMessage.id,
        image: userMessage.attachment,
        ...(sourceImageMessage?.imageProviderModel
          ? { providerModel: sourceImageMessage.imageProviderModel }
          : {}),
      });
    }
    setModerationNotice(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function runPendingJob(
    chatId: string,
    pending: NonNullable<Chat["pendingRequest"]>,
    scope: string,
  ): Promise<boolean> {
    if (activeJobPollsRef.current.has(pending.jobId)) return false;
    activeJobPollsRef.current.add(pending.jobId);
    pendingChatIdsRef.current.add(chatId);
    setPendingChatIds(new Set(pendingChatIdsRef.current));
    try {
      const endpoint = pending.kind === "image" ? "/api/image" : "/api/chat";
      let result: unknown;
      try {
        result = await waitForJob(endpoint, pending.jobId);
      } catch (error) {
        const age = Date.now() - Date.parse(pending.createdAt);
        if (
          !(error instanceof HttpResponseError && error.status === 404) ||
          !pending.requestPayload ||
          age < 0 ||
          age > 24 * 60 * 60_000
        ) {
          throw error;
        }
        const userMessage = chatsRef.current
          .find((chat) => chat.id === chatId)
          ?.messages.find((message) => message.id === pending.userMessageId);
        const body: Record<string, unknown> = {
          ...pending.requestPayload.body,
          jobId: pending.jobId,
        };
        if (userMessage?.attachment?.startsWith("data:image/")) {
          body.imageB64 = userMessage.attachment;
        }
        await readJson(
          await fetch(pending.requestPayload.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        );
        result = await waitForJob(endpoint, pending.jobId);
      }
      if (
        pending.kind === "image" &&
        (!result || typeof result !== "object" || !("image" in result) || typeof result.image !== "string")
      ) {
        throw new Error("A AKIRA não devolveu uma imagem válida.");
      }
      if (
        pending.kind === "chat" &&
        (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string")
      ) {
        throw new Error("A AKIRA devolveu uma resposta inválida.");
      }
      finishPendingJob(chatId, pending, scope, result);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao consultar o pedido.";
      if (error instanceof ContentModerationError) {
        rememberModerationBlock(chatId, pending);
      } else {
        finishPendingJob(chatId, pending, scope, undefined, message);
        if (activeIdRef.current === chatId) {
          setStatus(message);
          setStatusKind("error");
        }
      }
      return false;
    } finally {
      activeJobPollsRef.current.delete(pending.jobId);
      pendingChatIdsRef.current.delete(chatId);
      setPendingChatIds(new Set(pendingChatIdsRef.current));
      setRequestActivities((current) => {
        const next = { ...current };
        delete next[chatId];
        return next;
      });
    }
  }

  function stashDraft() {
    const key = activeIdRef.current ?? "__new__";
    if (input.trim() || imgMode) draftsRef.current[key] = { input, imgMode };
    else delete draftsRef.current[key];
  }

  function restoreDraft(key: string | null) {
    const draft = draftsRef.current[key ?? "__new__"];
    setInput(draft?.input ?? "");
    setImgMode(draft?.imgMode ?? false);
  }

  function updateQueue(chatId: string, updater: (queue: string[]) => string[]) {
    const nextQueue = updater(queuedMessagesRef.current[chatId] || []);
    if (nextQueue.length) {
      queuedMessagesRef.current = { ...queuedMessagesRef.current, [chatId]: nextQueue };
    } else {
      const next = { ...queuedMessagesRef.current };
      delete next[chatId];
      queuedMessagesRef.current = next;
    }
    setQueuedCounts((current) => {
      const next = { ...current };
      const size = queuedMessagesRef.current[chatId]?.length || 0;
      if (size) next[chatId] = size;
      else delete next[chatId];
      return next;
    });
  }

  function flushQueuedMessage(chatId: string) {
    const queue = queuedMessagesRef.current[chatId];
    if (!queue?.length) return;
    const [next, ...rest] = queue;
    updateQueue(chatId, () => rest);
    window.setTimeout(() => {
      void send(next, chatId);
    }, 0);
  }

  function newChat() {
    stashDraft();
    activeSessionVersionRef.current += 1;
    setActiveSessionVersion(activeSessionVersionRef.current);
    activeIdRef.current = null;
    setActiveId(null);
    setGreetingRun((current) => current + 1);
    restoreDraft(null);
    setAttachment(null);
    setEditTarget(null);
    setToolsOpen(false);
    setStatus("");
    setStatusKind("");
    setSideOpen(false);
    inputRef.current?.focus();
  }

  function removeChat(id: string) {
    delete draftsRef.current[id];
    if (queuedMessagesRef.current[id]) updateQueue(id, () => []);
    const remainingChats = chatsRef.current.filter((chat) => chat.id !== id);
    chatsRef.current = remainingChats;
    setChats(remainingChats);
    if (activeId === id) {
      activeSessionVersionRef.current += 1;
      setActiveSessionVersion(activeSessionVersionRef.current);
      activeIdRef.current = null;
      setActiveId(null);
      restoreDraft(null);
      setAttachment(null);
      setEditTarget(null);
    }
    if (authSnapshot?.historyScope) {
      deleteChat(authSnapshot.historyScope, id).catch((error: unknown) => {
        setStorageError(error instanceof Error ? error.message : "Não foi possível apagar a conversa.");
      });
    }
    setChatMenu(null);
  }

  function clearHistory() {
    if (!chats.length || !window.confirm("Apagar todas as conversas desta conta guardadas neste navegador?")) return;
    chatsRef.current = [];
    setChats([]);
    draftsRef.current = {};
    queuedMessagesRef.current = {};
    setQueuedCounts({});
    activeSessionVersionRef.current += 1;
    setActiveSessionVersion(activeSessionVersionRef.current);
    activeIdRef.current = null;
    setActiveId(null);
    restoreDraft(null);
    setAttachment(null);
    setEditTarget(null);
    if (authSnapshot?.historyScope) {
      clearChats(authSnapshot.historyScope).catch((error: unknown) => {
        setStorageError(error instanceof Error ? error.message : "Não foi possível apagar o histórico.");
      });
    }
    setStatus("O histórico desta conta foi apagado deste navegador.");
    setStatusKind("success");
  }

  function exportHistory() {
    if (!chats.length) return;
    const file = new Blob([JSON.stringify(chats, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "akira-historico.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    if (input.length > CHAT_MESSAGE_CHARACTER_LIMIT) {
      event.currentTarget.value = "";
      inputRef.current?.focus();
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const targetChatId = activeIdRef.current;
    const targetSessionVersion = activeSessionVersionRef.current;
    const targetSessionKey = `${targetSessionVersion}:${targetChatId ?? "new"}`;
    if (imgMode && !file.type.startsWith("image/")) {
      setStatus("No modo de imagem, anexa uma imagem para servir de referência.");
      setStatusKind("error");
      return;
    }
    if (
      imgMode &&
      !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type.toLocaleLowerCase("en"))
    ) {
      setStatus("As imagens de referência têm de estar em PNG, JPEG ou WebP.");
      setStatusKind("error");
      return;
    }
    if (file.size > FILE_LIMIT) {
      setStatus("O ficheiro tem de ter menos de 8 MB.");
      setStatusKind("error");
      return;
    }

    if (!file.type.startsWith("image/")) {
      const extension = file.name.split(".").pop()?.toLocaleLowerCase("en");
      if (!extension || !DOCUMENT_EXTENSIONS.has(extension)) {
        setStatus("Formatos suportados: imagens, TXT, Markdown, CSV, JSON, PDF e DOCX.");
        setStatusKind("error");
        return;
      }
      setFileReadingChatKeys((current) => new Set(current).add(targetSessionKey));
      setStatus("");
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/files/read", { method: "POST", body: form });
        const result = await readJson(response);
        if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string" ||
          !("name" in result) || typeof result.name !== "string") {
          throw new Error("Não foi possível extrair texto válido do ficheiro.");
        }
        if (
          activeIdRef.current === targetChatId &&
          activeSessionVersionRef.current === targetSessionVersion
        ) {
          setAttachment({ name: result.name, text: result.text });
          setStatus("Ficheiro lido. Envia uma pergunta para a AKIRA o analisar.");
          setStatusKind("success");
          inputRef.current?.focus();
        }
      } catch (error) {
        if (
          activeIdRef.current === targetChatId &&
          activeSessionVersionRef.current === targetSessionVersion
        ) {
          setStatus(error instanceof Error ? error.message : "Não foi possível ler o ficheiro.");
          setStatusKind("error");
        } else {
          console.error("Não foi possível ler o ficheiro selecionado na conversa anterior.", error);
        }
      } finally {
        setFileReadingChatKeys((current) => {
          const next = new Set(current);
          next.delete(targetSessionKey);
          return next;
        });
      }
      return;
    }
    if (file.size === 0) {
      setStatus("A imagem está vazia.");
      setStatusKind("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) {
        if (
          activeIdRef.current === targetChatId &&
          activeSessionVersionRef.current === targetSessionVersion
        ) {
          setStatus("Não foi possível ler esta imagem.");
          setStatusKind("error");
        } else {
          console.error("Não foi possível ler a imagem selecionada na conversa anterior.");
        }
        return;
      }
      if (
        activeIdRef.current === targetChatId &&
        activeSessionVersionRef.current === targetSessionVersion
      ) {
        setAttachment({ name: file.name, dataUrl: reader.result });
        setStatus("");
        setStatusKind("");
        inputRef.current?.focus();
      }
    };
    reader.onerror = () => {
      if (
        activeIdRef.current === targetChatId &&
        activeSessionVersionRef.current === targetSessionVersion
      ) {
        setStatus("Não foi possível ler esta imagem.");
        setStatusKind("error");
      } else {
        console.error("Não foi possível ler a imagem selecionada na conversa anterior.");
      }
    };
    reader.readAsDataURL(file);
  }

  async function send(text?: string, targetChatId?: string) {
    const backgroundSend = Boolean(targetChatId);
    const rawContent = text ?? input;
    const content = rawContent.trim();
    const automaticImageRequest =
      !backgroundSend &&
      !imgMode &&
      !editTarget &&
      isImageGenerationRequest(content) &&
      (!attachment || Boolean(attachment.dataUrl));
    const imageRequest = !backgroundSend && (imgMode || Boolean(editTarget) || automaticImageRequest);
    const referenceImageRequest = imageRequest && !editTarget && Boolean(attachment?.dataUrl);
    const characterLimit = imageRequest ? IMAGE_GENERATION_CHARACTER_LIMIT : CHAT_MESSAGE_CHARACTER_LIMIT;
    if (rawContent.length > characterLimit) {
      if (!backgroundSend && text !== undefined) setInput(rawContent);
      if (!backgroundSend) inputRef.current?.focus();
      return;
    }
    if (!backgroundSend && !content && !attachment) return;
    if (backgroundSend && !content) return;
    if (busy) return;
    if (!authReady) return;
    if (!authSnapshot?.displayName) {
      setAuthMode("profile");
      return;
    }
    if (!authSnapshot.authenticated && authSnapshot.guestMessagesUsed >= authSnapshot.guestMessageLimit) {
      setAuthMode("account");
      return;
    }
    if (imageRequest && !content) {
      setStatus(editTarget
        ? "Descreve as alterações que queres fazer à imagem."
        : "Escreve uma descrição para a imagem que queres criar.");
      setStatusKind("error");
      return;
    }
    if (
      referenceImageRequest &&
      attachment?.dataUrl &&
      !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(attachment.dataUrl)
    ) {
      setStatus("As imagens de referência têm de estar em PNG, JPEG ou WebP.");
      setStatusKind("error");
      return;
    }

    if (!backgroundSend) {
      shouldFollowMessages.current = true;
      setAtLatest(true);
    }
    let chatId: string;
    if (targetChatId) {
      if (!chatsRef.current.some((chat) => chat.id === targetChatId)) return;
      chatId = targetChatId;
    } else {
      const currentId = activeIdRef.current ?? activeId;
      if (currentId) {
        chatId = currentId;
      } else {
        chatId = uid();
        const now = new Date().toISOString();
        const newChatEntry: Chat = { id: chatId, title: "Nova conversa", messages: [], updatedAt: now };
        const nextChats = [newChatEntry, ...chatsRef.current];
        chatsRef.current = nextChats;
        setChats(nextChats);
        activeIdRef.current = chatId;
        setActiveId(chatId);
        delete draftsRef.current["__new__"];
      }
    }
    if (pendingChatIdsRef.current.has(chatId)) {
      if (backgroundSend) {
        updateQueue(chatId, (queue) => [content, ...queue]);
        return;
      }
      if (content && !attachment && !imgMode && !editTarget && !automaticImageRequest) {
        updateQueue(chatId, (queue) => [...queue, content]);
        delete draftsRef.current[chatId];
        setInput("");
        setStatus("Mensagem adicionada à fila.");
        setStatusKind("success");
        inputRef.current?.focus();
      } else {
        setStatus("Espera pela resposta atual antes de enviares imagens ou ficheiros.");
        setStatusKind("error");
      }
      return;
    }
    pendingChatIdsRef.current.add(chatId);
    setPendingChatIds(new Set(pendingChatIdsRef.current));

    const existingChats = chatsRef.current;
    const currentChat = existingChats.find((chat) => chat.id === chatId);
    const previousHistory = (currentChat?.messages || []).map((message) => ({
      role: message.role,
      content: message.context ? `${message.content}\n\n${message.context}` : message.content,
    }));
    const computeRequest =
      !backgroundSend &&
      !imageRequest &&
      !isWebSearchRequest(content) &&
      isComputeRequest(content);
    let computeContext = "";
    if (computeRequest) {
      try {
        const computeResponse = await fetch("/api/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expression: content }),
        });
        if (computeResponse.ok) {
          const computeResult = await computeResponse.json();
          if (
            computeResult &&
            typeof computeResult === "object" &&
            typeof (computeResult as { value?: unknown }).value === "number" &&
            Number.isFinite((computeResult as { value: number }).value) &&
            typeof (computeResult as { expression?: unknown }).expression === "string" &&
            typeof (computeResult as { formatted?: unknown }).formatted === "string"
          ) {
            computeContext = [
              "[Ferramenta de cálculo exato executada pelo servidor]",
              `Pedido: ${content}`,
              `Expressão: ${(computeResult as { expression: string }).expression}`,
              `Resultado: ${(computeResult as { formatted: string }).formatted}`,
            ].join("\n");
          }
        }
      } catch (computeError) {
        console.warn("A ferramenta de cálculo não respondeu; a resposta segue sem cálculo exato.", computeError);
      }
    }
    const visibleContent = backgroundSend
      ? content
      : editTarget
        ? `Edita a imagem: ${content}`
        : referenceImageRequest
          ? `Cria uma imagem com base na referência: ${content}`
        : imgMode
          ? `Cria uma imagem: ${content}`
          : content || (attachment?.text ? `Analisa o ficheiro ${attachment.name}.` : "Descreve esta imagem.");
    const userMessage = makeMessage(
      "user",
      visibleContent,
      backgroundSend
        ? {}
        : {
            attachment: editTarget?.image || attachment?.dataUrl,
            attachmentName: editTarget ? "Imagem original" : attachment?.name,
            context: attachment?.text,
          },
    );

    const jobId = uid();
    const chatMessage =
      content ||
      (!backgroundSend && attachment?.text
        ? `Analisa o ficheiro ${attachment.name}.`
        : "Descreve esta imagem em detalhe.");
    const chatContext =
      !backgroundSend && attachment?.text
        ? `[Conteúdo extraído do ficheiro ${attachment.name}]\n${attachment.text}`
        : !backgroundSend && computeContext
          ? computeContext
          : "";
    const imageRequestBody: Record<string, unknown> = {
      jobId,
      ...(editTarget
        ? {
            action: "edit",
            imageB64: editTarget.image,
            ...(editTarget.providerModel ? { imageProviderModel: editTarget.providerModel } : {}),
          }
        : referenceImageRequest && attachment?.dataUrl
          ? { action: "reference", imageB64: attachment.dataUrl }
          : {}),
      prompt: content,
      style: imageStyle,
      history: previousHistory.slice(-8),
    };
    const chatRequestBody: Record<string, unknown> = {
      jobId,
      message: chatMessage,
      context: chatContext,
      ...(!backgroundSend && attachment?.dataUrl ? { imageB64: attachment.dataUrl } : {}),
      history: previousHistory,
    };
    const { imageB64: _imageBytes, ...imageRecoveryBody } = imageRequestBody;
    const { imageB64: _chatImageBytes, ...chatRecoveryBody } = chatRequestBody;
    const pendingRequest: NonNullable<Chat["pendingRequest"]> = {
      jobId,
      kind: imageRequest ? "image" : "chat",
      completionText: !backgroundSend && editTarget
        ? "A imagem editada está pronta."
        : referenceImageRequest
          ? "A imagem criada com base na referência está pronta."
          : "A imagem está pronta.",
      userMessageId: userMessage.id,
      createdAt: new Date().toISOString(),
      requestPayload: imageRequest
        ? { endpoint: "/api/image", body: imageRecoveryBody }
        : { endpoint: "/api/chat", body: chatRecoveryBody },
    };
    activeJobPollsRef.current.add(jobId);
    const baseChat: Chat = currentChat || {
      id: chatId,
      title: "Nova conversa",
      messages: [],
      updatedAt: userMessage.createdAt,
    };
    const queuedChat: Chat = {
      ...baseChat,
      title: baseChat.messages.some((item) => item.role === "user")
        ? baseChat.title
        : conversationTitle(userMessage.content),
      messages: [...baseChat.messages, userMessage],
      updatedAt: userMessage.createdAt,
      pendingRequest,
    };
    const queuedChats = currentChat
      ? existingChats.map((chat) => (chat.id === chatId ? queuedChat : chat))
      : [queuedChat, ...existingChats];
    chatsRef.current = queuedChats;
    setChats(queuedChats);
    if (!backgroundSend) {
      setInput("");
      setAttachment(null);
      delete draftsRef.current[chatId];
    }
    const nextActivityMessages = !backgroundSend && editTarget
      ? [
          "A AKIRA está a analisar a imagem original",
          "A AKIRA está a aplicar as alterações pedidas",
          "A AKIRA está a finalizar a imagem editada",
        ]
      : !backgroundSend && referenceImageRequest
        ? [
            "A AKIRA está a analisar a imagem de referência",
            "A AKIRA está a preparar a composição visual",
            "A AKIRA está a gerar uma nova imagem com base na referência",
          ]
      : !backgroundSend && imgMode
        ? [
            "A AKIRA está a preparar a imagem",
            "A AKIRA está a compor os elementos visuais",
            "A AKIRA está a gerar a imagem",
        ]
        : !backgroundSend && attachment?.dataUrl
          ? ["A AKIRA está a analisar a imagem", "A AKIRA está a interpretar os detalhes visuais"]
          : !backgroundSend && attachment?.text
            ? ["A AKIRA está a ler o ficheiro", "A AKIRA está a analisar o conteúdo"]
            : computeRequest && computeContext
              ? [
                  "A AKIRA está a calcular com precisão",
                  "A AKIRA está a conferir os números",
                  "A AKIRA está a compor a resposta",
                ]
              : isWebSearchRequest(content)
                ? [
                    "A AKIRA está a pesquisar na web",
                    "A AKIRA está a reunir e comparar informação",
                    "A AKIRA está a organizar os resultados da pesquisa",
                    "A AKIRA está a compor a resposta com a pesquisa",
                  ]
                : [
                    "A AKIRA está a analisar o teu pedido",
                    "A AKIRA está a organizar as ideias",
                    "A AKIRA está a estruturar a resposta",
                    "A AKIRA está a compor a resposta",
                  ];
    setRequestActivities((current) => ({
      ...current,
      [chatId]: { messages: nextActivityMessages, index: 0, slow: false },
    }));
    const slowWaitTimer = setTimeout(() => {
      setRequestActivities((current) => ({
        ...current,
        [chatId!]: current[chatId!]
          ? { ...current[chatId!], slow: true }
          : { messages: nextActivityMessages, index: 0, slow: true },
      }));
    }, 8_000);
    if (!backgroundSend) {
      setStatus("");
      setStatusKind("");
      setToolsOpen(false);
    }

    try {
      if (!authSnapshot.historyScope) {
        throw new Error("Não foi possível associar o pedido à conta atual.");
      }
      await saveChat(authSnapshot.historyScope, queuedChat);
      if (imageRequest) {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(imageRequestBody),
        });
        const started: unknown = await readJson(response);
        if (
          !started ||
          typeof started !== "object" ||
          !("jobId" in started) ||
          started.jobId !== jobId
        ) {
          throw new Error("A AKIRA não iniciou a geração da imagem corretamente.");
        }
        activeJobPollsRef.current.delete(jobId);
        const completed = await runPendingJob(chatId, pendingRequest, authSnapshot.historyScope);
        if (completed && !authSnapshot.authenticated) {
          setAuthSnapshot((current) => {
            if (!current) return current;
            const guestMessagesUsed = current.guestMessagesUsed + 1;
            return { ...current, guestMessagesUsed };
          });
        }
        if (completed && activeIdRef.current === chatId) {
          setImgMode(false);
          setEditTarget(null);
        }
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chatRequestBody),
        });
        await readJson(response);
        activeJobPollsRef.current.delete(jobId);
        const completed = await runPendingJob(chatId, pendingRequest, authSnapshot.historyScope);
        if (completed && !authSnapshot.authenticated) {
          setAuthSnapshot((current) => {
            if (!current) return current;
            const guestMessagesUsed = current.guestMessagesUsed + 1;
            return { ...current, guestMessagesUsed };
          });
        }
      }
    } catch (error) {
      activeJobPollsRef.current.delete(jobId);
      if (error instanceof TypeError && authSnapshot.historyScope) {
        await runPendingJob(chatId, pendingRequest, authSnapshot.historyScope);
        return;
      }
      if (error instanceof ContentModerationError) {
        rememberModerationBlock(chatId, pendingRequest);
        return;
      }
      clearPendingJob(
        chatId,
        jobId,
        error instanceof AccountRequiredError || error instanceof UsageLimitError,
      );
      if (error instanceof AccountRequiredError) {
        if (!backgroundSend && activeIdRef.current === chatId) {
          setInput(content);
          setAttachment(attachment);
        }
        setAuthMode("account");
        setAuthMessage(error.message);
      } else if (error instanceof UsageLimitError) {
        if (!backgroundSend && activeIdRef.current === chatId) {
          setInput(content);
          setAttachment(attachment);
        }
        setQuotaNotice(error);
      } else if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
        if (imageRequest && activeIdRef.current === chatId) {
          setInput(content);
          setStatus("A ligação foi interrompida antes de o pedido arrancar. A conversa foi guardada; volta a enviá-la para tentar novamente.");
        } else if (activeIdRef.current === chatId) {
          setStatus("A ligação foi interrompida antes de o pedido arrancar. A conversa foi guardada; volta a enviá-la para tentar novamente.");
        }
        if (activeIdRef.current === chatId) setStatusKind("error");
      } else {
        if (activeIdRef.current === chatId) {
          if (!backgroundSend && imageRequest) setInput(content);
          setStatus(error instanceof Error ? error.message : "O pedido à AKIRA falhou.");
          setStatusKind("error");
        }
      }
    } finally {
      clearTimeout(slowWaitTimer);
      pendingChatIdsRef.current.delete(chatId);
      setPendingChatIds(new Set(pendingChatIdsRef.current));
      setRequestActivities((current) => {
        const next = { ...current };
        delete next[chatId!];
        return next;
      });
      if (activeIdRef.current === chatId) inputRef.current?.focus();
      flushQueuedMessage(chatId);
    }
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: authName }),
      });
      const snapshot = await readJson(response) as AuthSnapshot;
      setAuthSnapshot(snapshot);
      setAuthName(snapshot.displayName || authName.trim());
      setAuthMode(null);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Não foi possível guardar o teu nome.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: authName, email: authEmail }),
      });
      const result = await readJson(response);
      setAuthLinkSent(true);
      setAuthMessage(result && typeof result === "object" && "message" in result && typeof result.message === "string"
        ? result.message
        : "Enviámos um link de acesso. Consulta a tua caixa de entrada.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Não foi possível enviar o link de acesso.");
    } finally {
      setAuthBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function jumpToLatest() {
    const thread = threadRef.current;
    if (!thread) return;
    shouldFollowMessages.current = true;
    setAtLatest(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    thread.scrollTo({ top: thread.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (coarsePointer && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    void send();
  }

  function chooseSuggestion(text: string) {
    if (authSnapshot && !authSnapshot.displayName) {
      setAuthMode("profile");
    } else if (
      authSnapshot &&
      !authSnapshot.authenticated &&
      authSnapshot.guestMessagesUsed >= authSnapshot.guestMessageLimit
    ) {
      setAuthMode("account");
    }
    if (!text) {
      setAttachment(null);
      setEditTarget(null);
      setImgMode(true);
      setToolsOpen(false);
      inputRef.current?.focus();
      return;
    }
    setInput(text);
    inputRef.current?.focus();
  }

  async function copyMessage(message: Msg) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setStatus("Mensagem copiada.");
      setStatusKind("");
      window.setTimeout(() => setCopiedId((current) => current === message.id ? null : current), 1800);
    } catch (error) {
      setStatus("Não foi possível copiar a resposta.");
      setStatusKind("error");
    }
  }

  function editImage(message: Msg) {
    if (!message.image) return;
    setImgMode(false);
    setAttachment(null);
    setInput("");
    setEditTarget({
      messageId: message.id,
      image: message.image,
      ...(message.imageProviderModel ? { providerModel: message.imageProviderModel } : {}),
    });
    setStatus("");
    setStatusKind("");
    inputRef.current?.focus();
  }

  function downloadImage(message: Msg) {
    if (!message.image) return;
    const extension = /^data:image\/(png|jpeg|jpg|webp);/i.exec(message.image)?.[1].toLowerCase();
    const link = document.createElement("a");
    link.href = message.image;
    link.download = `akira-imagem-${message.id.slice(0, 8)}.${extension === "jpeg" ? "jpg" : extension || "png"}`;
    link.click();
  }

  async function rateMessage(message: Msg, rating: "positive" | "negative") {
    if (feedbackBusyId) return;
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const prompt = messageIndex > 0
      ? [...messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user")?.content
      : undefined;
    if (!prompt) {
      setStatus("Não foi possível associar o feedback à pergunta original.");
      setStatusKind("error");
      return;
    }

    setFeedbackBusyId(message.id);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          rating,
          prompt,
          response: message.content,
          isImage: Boolean(message.image),
        }),
      });
      await readJson(response);
      setChats((current) => current.map((chat) => ({
        ...chat,
        messages: chat.messages.map((item) => item.id === message.id ? { ...item, feedback: rating } : item),
      })));
      setStatus(message.image
        ? "Avaliação da imagem guardada. Obrigado."
        : "Feedback guardado. Obrigado.");
      setStatusKind("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar o feedback.");
      setStatusKind("error");
    } finally {
      setFeedbackBusyId(null);
    }
  }

  async function shareMessage(message: Msg) {
    try {
      const messageIndex = messages.findIndex((item) => item.id === message.id);
      const question = messageIndex > 0
        ? [...messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user")?.content
        : undefined;
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message.content, question, ...(message.image ? { image: message.image } : {}) }),
      });
      const result = await readJson(response);
      if (!result || typeof result !== "object" || !("url" in result) || typeof result.url !== "string") {
        throw new Error("Não foi possível criar o link da resposta.");
      }
      await navigator.clipboard.writeText(result.url);
      setStatus("Link de partilha copiado.");
      setStatusKind("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível partilhar a resposta.");
      setStatusKind("error");
    }
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
        <div className="side-top">
          <a href="/" className="brand-lockup" aria-label="AKIRA — início">
            <Logo size={34} />
            <span className="side-title">AKIRA<span className="brand-dot">.</span></span>
          </a>
          <button className="icon-button close-sidebar" onClick={() => setSideOpen(false)} aria-label="Fechar histórico">
            <X size={18} />
          </button>
        </div>

        <button className="new-chat" onClick={newChat}>
          <SquarePen size={16} />
          <span>Nova conversa</span>
          <span className="new-chat-shortcut">Ctrl K</span>
        </button>

        <div className="history-heading">
          <span>Histórico</span>
          <button
            className="icon-button search-toggle"
            onClick={() => { setSearchOpen((open) => !open); setSearch(""); }}
            aria-label="Pesquisar no histórico"
          >
            <Search size={15} />
          </button>
        </div>
        {searchOpen && (
          <label className="history-search">
            <Search size={14} />
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar conversas" />
            <button className="icon-button" onClick={() => { setSearch(""); setSearchOpen(false); }} aria-label="Fechar pesquisa">
              <X size={14} />
            </button>
          </label>
        )}

        <div className="hist-list">
          {!historyReady && <div className="history-empty">A carregar conversas…</div>}
          {historyReady && visibleChats.length === 0 && (
            <div className="history-empty">{query ? "Nenhuma conversa encontrada." : "As tuas conversas aparecem aqui."}</div>
          )}
          {visibleChats.map((chat) => (
            <div className={`history-entry ${activeId === chat.id ? "active" : ""}`} key={chat.id}>
              <button
                className="hist-item"
                onClick={() => {
                  stashDraft();
                  activeSessionVersionRef.current += 1;
                  setActiveSessionVersion(activeSessionVersionRef.current);
                  activeIdRef.current = chat.id;
                  setActiveId(chat.id);
                  restoreDraft(chat.id);
                  setAttachment(null);
                  setEditTarget(null);
                  setToolsOpen(false);
                  setSideOpen(false);
                  setStatus("");
                  setStatusKind("");
                }}
                title={chat.title}
              >
                <span className="history-item-title">{chat.title}</span>
                <span className="history-item-meta">
                  <span className="history-item-time">{formatTime(chat.updatedAt)}</span>
                  {queuedCounts[chat.id] > 0 && (
                    <span className="history-item-queue" title={`${queuedCounts[chat.id]} na fila`}>
                      <Clock3 size={10} aria-hidden="true" />
                      {queuedCounts[chat.id]}
                    </span>
                  )}
                </span>
              </button>
              <button
                className="history-menu-button icon-button"
                aria-label={`Opções para ${chat.title}`}
                aria-expanded={chatMenu === chat.id}
                onClick={() => setChatMenu((current) => current === chat.id ? null : chat.id)}
              >
                <MoreHorizontal size={16} />
              </button>
              {chatMenu === chat.id && (
                <div className="history-context-menu">
                  <button onClick={() => removeChat(chat.id)}><Trash2 size={14} /> Apagar conversa</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="side-foot">
          <a
            className="softedge-card"
            href="https://softedge-corporation.up.railway.app/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visitar SoftEdge Corporation, abre numa nova aba"
          >
            <span className="softedge-symbol"><Sparkles size={16} /></span>
            <span className="softedge-copy">
              <strong>Desenvolvido pela SoftEdge</strong>
              <small>Software que transforma negócios</small>
            </span>
            <ArrowUpRight className="softedge-arrow" size={15} />
          </a>
          <a className="plans-link" href="/plans"><Sparkles size={14} /> Planos de assinatura</a>
          <a className="plans-link" href="/tasks"><ListTodo size={14} /> Tarefas</a>
          {!authSnapshot?.authenticated && <a className="plans-link" href="/login"><Sparkles size={14} /> Entrar ou criar conta</a>}
          {chats.length > 0 && (
            <>
              <button onClick={exportHistory}><FileDown size={14} /> Exportar histórico</button>
              <button className="clear-history" onClick={clearHistory}><Trash2 size={14} /> Limpar histórico</button>
            </>
          )}
          <button className="profile-row account-profile-button" onClick={() => {
            setAuthMode(authSnapshot?.authenticated ? "account" : "profile");
            setAuthName(authSnapshot?.displayName || "");
            setAuthLinkSent(false);
            setAuthMessage("");
          }}>
            <span className="profile-avatar">A</span>
            <span>
              <strong>{authSnapshot?.displayName || "A TUA CONTA"}</strong>
              <small>{authSnapshot?.email || (authSnapshot
                ? `${Math.min(authSnapshot.guestMessagesUsed, authSnapshot.guestMessageLimit)}/${authSnapshot.guestMessageLimit} mensagens grátis`
                : "A carregar conta…")}</small>
            </span>
            <span className="profile-dot" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {sideOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setSideOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="burger icon-button" onClick={() => setSideOpen(true)} aria-label="Abrir histórico">
              <Menu size={19} />
            </button>
            <span className="model">AKIRA</span>
          </div>
          <div className="topbar-right">
            <a
              className="space-status softedge-top-link"
              href="https://softedge-corporation.up.railway.app/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visitar SoftEdge Corporation, abre numa nova aba"
            >
              <span /> SOFTEDGE <ArrowUpRight size={12} />
            </a>
            <button className="topbar-new-chat" onClick={newChat}><MessageSquarePlus size={15} /> Nova conversa</button>
          </div>
        </header>

        <section
          className={`thread ${messages.length > 0 ? "has-messages" : ""}`}
          aria-live="polite"
          ref={threadRef}
          onScroll={(event) => {
            const thread = event.currentTarget;
            const nearLatest = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 100;
            shouldFollowMessages.current = nearLatest;
            setAtLatest(nearLatest);
          }}
        >
          {messages.length === 0 && (
            <div className="empty">
              <div className="hero-mark"><Logo size={92} /></div>
              <span className="hero-overline"><span /> INTELIGÊNCIA PARA AS TUAS IDEIAS</span>
              <h1
                className={`greeting-title ${displayName ? "has-name" : ""}`}
                aria-label={displayName ? `Olá, ${displayName}. Como posso te ajudar?` : "Como posso te ajudar?"}
              >
                <span className="greeting-line" aria-hidden="true">
                  {displayName && <>{typedGreeting}{greetingPhase === "greeting" && <span className="typing-caret" />}</>}
                </span>
                <span className="greeting-line" aria-hidden="true">
                  <span>{typedQuestion.slice(0, "Como posso ".length)}</span>
                  <em>{typedQuestion.slice("Como posso ".length)}</em>
                  {greetingPhase === "question" && <span className="typing-caret" />}
                </span>
              </h1>
              <p className="hero-caption">{authSnapshot?.displayName ? "O que vamos explorar hoje?" : "Pergunta, imagina, cria. Vamos descobrir juntos."}</p>
              <div className="suggestion-grid">
                {suggestions.map(({ icon: Icon, label, text }) => (
                  <button className="suggestion-card" key={label} onClick={() => chooseSuggestion(text)}>
                    <span className="suggestion-icon"><Icon size={17} strokeWidth={1.8} /></span>
                    <span>{label}</span>
                    <ArrowUp className="suggestion-arrow" size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeChat && messages.length > 0 && (
            <div className="messages">
              <div className="thread-heading">
                <span>CONVERSA</span>
                <h1>{activeChat.title}</h1>
              </div>
              {messages.map((message) => (
                <article key={message.id} className={`msg ${message.role}`}>
                  {message.role === "assistant" && <div className="assistant-mark"><Logo size={24} /></div>}
                  <div className={`message-content ${message.image ? "has-generated-image" : ""}`}>
                    {message.attachment && (
                      <button
                        className="image-expand-trigger"
                        onClick={() => setExpandedImage({ src: message.attachment!, alt: "Imagem anexada" })}
                        aria-label="Ampliar imagem anexada para ecrã inteiro"
                        title="Abrir imagem em ecrã inteiro"
                      >
                        <img className="attached-image" src={message.attachment} alt="Imagem anexada" onLoad={() => {
                          const thread = threadRef.current;
                          if (shouldFollowMessages.current && thread) thread.scrollTop = thread.scrollHeight;
                        }} />
                        <span className="image-expand-hint"><Maximize2 size={13} /> Ampliar</span>
                      </button>
                    )}
                    <div className={`bubble ${message.role === "assistant" ? "markdown-content" : ""}`}>
                      {message.role === "assistant"
                        ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        : message.content}
                    </div>
                    {message.role === "assistant" && message.context && (
                      <details className="source-card">
                        <summary><Search size={12} /> Fontes usadas nesta resposta <ChevronDown className="source-chevron" size={13} /></summary>
                        <pre>{message.context}</pre>
                      </details>
                    )}
                    {message.role === "user" && message.context && (
                      <details className="source-card">
                        <summary><Paperclip size={12} /> Conteúdo do ficheiro {message.attachmentName || "anexado"} <ChevronDown className="source-chevron" size={13} /></summary>
                        <pre>{message.context}</pre>
                      </details>
                    )}
                    {message.image && (
                      <button
                        className="image-expand-trigger generated-image-trigger"
                        onClick={() => setExpandedImage({ src: message.image!, alt: "Imagem gerada pela AKIRA" })}
                        aria-label="Ampliar imagem gerada para ecrã inteiro"
                        title="Abrir imagem em ecrã inteiro"
                      >
                        <img className="gen" src={message.image} alt="Imagem gerada pela AKIRA" onLoad={() => {
                          const thread = threadRef.current;
                          if (shouldFollowMessages.current && thread) thread.scrollTop = thread.scrollHeight;
                        }} />
                        <span className="image-expand-hint"><Maximize2 size={13} /> Ampliar</span>
                      </button>
                    )}
                    {message.attachmentName && <span className="message-attachment"><Paperclip size={12} /> {message.attachmentName}</span>}
                    <div className="message-actions">
                      <button
                        className="icon-button"
                        onClick={() => void copyMessage(message)}
                        aria-label={message.role === "assistant" ? "Copiar resposta" : "Copiar mensagem"}
                        title={message.role === "assistant" ? "Copiar resposta" : "Copiar mensagem"}
                      >
                        {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedId === message.id ? "Copiado" : "Copiar"}</span>
                      </button>
                      {message.role === "assistant" && (
                        <button className="icon-button" onClick={() => void shareMessage(message)} aria-label="Partilhar resposta" title="Copiar link para partilhar">
                          <Share2 size={14} /><span>Partilhar</span>
                        </button>
                      )}
                      {message.image && (
                        <>
                          <button className="icon-button" onClick={() => editImage(message)} disabled={busy || activeChatPending} aria-label="Editar imagem com um pedido" title="Editar imagem">
                            <Pencil size={14} /><span>Editar</span>
                          </button>
                          <button className="icon-button" onClick={() => downloadImage(message)} aria-label="Descarregar imagem" title="Descarregar imagem">
                            <Download size={14} /><span>Descarregar</span>
                          </button>
                        </>
                      )}
                      {message.role === "assistant" && (
                        <>
                          <button
                            className={`icon-button feedback-button ${message.feedback === "positive" ? "selected" : ""}`}
                            onClick={() => void rateMessage(message, "positive")}
                            disabled={feedbackBusyId === message.id}
                            aria-label="Marcar resposta útil; a pergunta e resposta serão guardadas para revisão de qualidade"
                            aria-pressed={message.feedback === "positive"}
                            title={message.feedback === "positive" ? "Feedback positivo enviado" : "Resposta útil; o par pergunta/resposta será guardado para revisão"}
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            className={`icon-button feedback-button ${message.feedback === "negative" ? "selected" : ""}`}
                            onClick={() => void rateMessage(message, "negative")}
                            disabled={feedbackBusyId === message.id}
                            aria-label="Marcar resposta não útil; a pergunta e resposta serão guardadas para revisão de qualidade"
                            aria-pressed={message.feedback === "negative"}
                            title={message.feedback === "negative" ? "Feedback negativo enviado" : "Resposta não útil; o par pergunta/resposta será guardado para revisão"}
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <time className="message-time">{formatTime(message.createdAt)}</time>
                  </div>
                </article>
              ))}
              {(activeChatPending || busy) && (
                <div className="msg assistant">
                  <div className="assistant-mark"><Logo size={24} /></div>
                  <div className="typing" aria-live="polite">
                    <LoaderCircle size={15} className="spin" aria-hidden="true" />
                    <span>{busy ? "A ler o ficheiro" : activity?.messages[activity.index] || "A AKIRA está a pensar"}</span>
                    <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                    {!busy && activity?.slow && (
                      <span className="typing-note">O pedido está a demorar. Mantém esta página aberta; a AKIRA continua a processá-lo.</span>
                    )}
                  </div>
                </div>
              )}
              {!busy && activeChatPending && activeQueuedMessages.length > 0 && (
                <div
                  className="queue-group"
                  role="list"
                  aria-label={
                    activeQueuedMessages.length === 1
                      ? "1 mensagem na fila"
                      : `${activeQueuedMessages.length} mensagens na fila`
                  }
                >
                  <div className="queue-heading">
                    <Clock3 size={11} aria-hidden="true" />
                    <span>Na fila</span>
                    <span className="queue-count">{activeQueuedMessages.length}</span>
                  </div>
                  {activeQueuedMessages.map((queued, index) => (
                    <article
                      className={`msg user queued ${index === 0 ? "next" : ""}`}
                      role="listitem"
                      key={`${index}-${queued.slice(0, 24)}`}
                    >
                      <div className="message-content">
                        <div className="bubble queue-bubble">{queued}</div>
                        <span className="queue-meta">
                          {index === 0 ? "A seguir · sai quando a resposta atual terminar" : `#${index + 1} na fila`}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="composer-zone">
          {messages.length > 0 && !atLatest && !toolsOpen && (
            <button
              type="button"
              className="jump-latest"
              onClick={jumpToLatest}
              aria-label="Ir para as mensagens mais recentes"
              title="Ir para as mensagens mais recentes"
            >
              <ChevronDown size={15} aria-hidden="true" />
              <span>Ir para o fim</span>
            </button>
          )}
          {attachment && (
            <div className="attachment-card">
              {attachment.dataUrl ? <img src={attachment.dataUrl} alt="Pré-visualização da imagem" /> : <span className="attachment-file-icon"><Paperclip size={16} /></span>}
              <span>
                {attachment.name}
                {(imgMode || automaticImagePrompt) && attachment.dataUrl && <small>Imagem de referência</small>}
              </span>
              <button className="icon-button" onClick={() => setAttachment(null)} aria-label="Remover imagem">
                <X size={15} />
              </button>
            </div>
          )}
          {(imgMode || editTarget) && (
            <div className="image-mode-bar">
              <span>{editTarget ? <Pencil size={14} /> : <ImagePlus size={14} />} {editTarget ? "Editar imagem" : "Criar imagem"}</span>
              {imgMode && (
                <label>
                  Estilo
                  <select value={imageStyle} onChange={(event) => setImageStyle(event.target.value)}>
                    {STYLES.map((style) => <option key={style}>{style}</option>)}
                  </select>
                  <ChevronDown size={13} />
                </label>
              )}
              <button
                className="icon-button"
                onClick={() => { setImgMode(false); setEditTarget(null); setInput(""); }}
                aria-label="Fechar modo de imagem"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {toolsOpen && (
            <div className="tools-pop">
              <div className="tools-heading">Ferramentas</div>
              <button onClick={() => { setAttachment(null); setEditTarget(null); setImgMode(true); setToolsOpen(false); inputRef.current?.focus(); }}>
                <span className="tool-icon"><ImagePlus size={16} /></span>
                <span><strong>Criar uma imagem</strong><small>Ilustra uma ideia à tua maneira</small></span>
                {imgMode && <Check className="tool-check" size={15} />}
              </button>
              <button onClick={() => { setInput("pesquisa na web: "); setToolsOpen(false); inputRef.current?.focus(); }}>
                <span className="tool-icon"><Globe size={16} /></span>
                <span><strong>Pesquisar na web</strong><small>Procura informação atualizada</small></span>
              </button>
              <button onClick={() => { setInput("Dá-me 3 ideias criativas para "); setToolsOpen(false); inputRef.current?.focus(); }}>
                <span className="tool-icon"><Lightbulb size={16} /></span>
                <span><strong>Explorar ideias</strong><small>Começa com uma nova inspiração</small></span>
              </button>
              <button onClick={() => { setToolsOpen(false); fileRef.current?.click(); }}>
                <span className="tool-icon"><Search size={16} /></span>
                <span><strong>Analisar uma imagem</strong><small>Faz uma pergunta sobre uma imagem</small></span>
              </button>
            </div>
          )}
          <form className="composer" onSubmit={onSubmit}>
              <textarea
                ref={inputRef}
                rows={1}
                placeholder={
                  editTarget
                    ? "Descreve as alterações a fazer à imagem…"
                    : imgMode
                      ? attachment?.dataUrl
                        ? "Descreve a imagem a criar com base na referência…"
                        : "Descreve a imagem que tens em mente…"
                      : "Escreve a tua mensagem…"
                }
                value={input}
                disabled={!historyReady || busy}
                onChange={(event) => {
                  setInput(event.target.value);
                  resizeComposerTextarea(event.target);
                }}
                onKeyDown={onKeyDown}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                      const file = item.getAsFile();
                      if (!file) continue;
                      e.preventDefault();
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setAttachment({ name: file.name || 'imagem-colada.png', dataUrl: reader.result });
                        }
                      };
                      reader.readAsDataURL(file);
                      return;
                    }
                  }
                }}
                aria-label="A tua mensagem"
                aria-invalid={messageExceedsLimit}
                aria-describedby="composer-count"
              />
            {messageExceedsLimit && (
              <div className="composer-limit-error" role="alert">
                A mensagem excede o limite de {messageCharacterLimit.toLocaleString("pt-PT")} caracteres. Encurta-a para a poderes enviar.
              </div>
            )}
            <div
              id="composer-count"
              className={`composer-count ${messageExceedsLimit ? "over-limit" : messageNearLimit ? "near-limit" : ""}`}
              aria-live="polite"
            >
              <span>{input.length.toLocaleString("pt-PT")} / {messageCharacterLimit.toLocaleString("pt-PT")} caracteres</span>
              <span title="Estimativa aproximada: cerca de 1 token por 4 caracteres; não é uma tokenização exata.">
                ~{estimateTokens(input).toLocaleString("pt-PT")} tokens (estimativa)
              </span>
            </div>
            <div className="composer-bar">
              <div className="composer-tools">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={imgMode ? "Anexar imagem de referência" : "Anexar imagem ou documento"}
                  onClick={() => fileRef.current?.click()}
                  disabled={!historyReady || busy || activeChatPending || Boolean(editTarget)}
                >
                  <Paperclip size={17} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={imgMode ? "image/png,image/jpeg,image/webp" : "image/*,.txt,.md,.markdown,.csv,.json,.pdf,.docx"}
                  hidden
                  onChange={onFile}
                  disabled={busy || activeChatPending || Boolean(editTarget)}
                />
                <button
                  type="button"
                  className={`tools-button ${toolsOpen ? "selected" : ""}`}
                  onClick={() => setToolsOpen((open) => !open)}
                  aria-expanded={toolsOpen}
                >
                  <Sparkles size={14} /> Ferramentas <ChevronDown size={13} />
                </button>
                {imgMode && <span className="active-tool"><ImagePlus size={12} /> Imagem</span>}
              </div>
              <div className="composer-submit">
                {activeChatPending && activeQueuedCount > 0 && (
                  <span className="queue-chip" title="Saem automaticamente a seguir à resposta atual">
                    <Clock3 size={11} aria-hidden="true" />
                    {activeQueuedCount === 1 ? "1 na fila" : `${activeQueuedCount} na fila`}
                  </span>
                )}
                <span className="enter-hint">↵ {activeChatPending ? "adicionar à fila" : "enviar"}</span>
                <button
                  type="submit"
                  className="send-btn"
                  disabled={!historyReady || busy || (!input.trim() && !attachment)}
                  aria-label={
                    activeChatPending
                      ? "Adicionar à fila"
                      : imgMode || automaticImagePrompt
                        ? "Gerar imagem"
                        : "Enviar mensagem"
                  }
                >
                  {busy ? <LoaderCircle className="spin" size={16} /> : imgMode || automaticImagePrompt ? <ImagePlus size={16} /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </form>
          <p className="composer-footer"><Clock3 size={12} /> A AKIRA pode cometer erros. Confirma informações importantes.</p>
        </div>
      </main>
      {expandedImage && (
        <div
          className="image-viewer-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExpandedImage(null);
          }}
        >
          <section
            className="image-viewer-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Imagem em ecrã inteiro"
          >
            <button
              ref={imageViewerCloseRef}
              className="image-viewer-close icon-button"
              onClick={() => setExpandedImage(null)}
              aria-label="Fechar imagem ampliada"
              title="Fechar (Esc)"
            >
              <X size={19} />
            </button>
            <img className="image-viewer-image" src={expandedImage.src} alt={expandedImage.alt} />
            <span className="image-viewer-hint">Pressiona Esc ou clica fora da imagem para fechar</span>
          </section>
        </div>
      )}
      {moderationNotice && (
        <div
          className="moderation-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModerationNotice(null);
          }}
        >
          <section
            className="moderation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="moderation-title"
            aria-describedby="moderation-description"
          >
            <button
              className="moderation-close icon-button"
              onClick={() => setModerationNotice(null)}
              aria-label="Fechar aviso"
            >
              <X size={17} />
            </button>
            <span className="moderation-icon"><ShieldAlert size={22} /></span>
            <span className="moderation-eyebrow">PEDIDO NÃO CONCLUÍDO</span>
            <h2 id="moderation-title">Vamos reformular a descrição?</h2>
            <p id="moderation-description">
              Esta descrição pode incluir conteúdo que não é permitido para geração de imagens.
              A imagem não foi criada. Tenta reformular o pedido de forma diferente.
            </p>
            <div className="moderation-actions">
              <button
                className="moderation-primary"
                onClick={reformulateBlockedPrompt}
                autoFocus
              >
                Reformular descrição
              </button>
              <button className="moderation-secondary" onClick={() => setModerationNotice(null)}>
                Fechar
              </button>
            </div>
          </section>
        </div>
      )}
      {quotaNotice && (
       <div
         className="quota-overlay"
         role="presentation"
         onMouseDown={(event) => {
           if (event.target === event.currentTarget) setQuotaNotice(null);
         }}
       >
         <section className="quota-dialog" role="dialog" aria-modal="true" aria-labelledby="quota-title" aria-describedby="quota-description">
           <button className="quota-close icon-button" onClick={() => setQuotaNotice(null)} aria-label="Fechar aviso">
             <X size={17} />
           </button>
            <span className="quota-icon">{quotaNotice.metric === "files" ? <FileDown size={21} /> : quotaNotice.metric === "images" ? <ImagePlus size={21} /> : <Sparkles size={21} />}</span>
            <span className="quota-eyebrow">{quotaNotice.metric === "files" ? "LIMITE DE FICHEIROS ATINGIDO" : quotaNotice.metric === "images" ? "LIMITE DE IMAGENS ATINGIDO" : "LIMITE DO PLANO ATINGIDO"}</span>
            <h2 id="quota-title">{quotaNotice.metric === "files" ? "Atingiste os 3 ficheiros do plano Free." : quotaNotice.metric === "images" ? "Queres criar mais imagens?" : "Continua a conversar com a AKIRA."}</h2>
            <p id="quota-description">{quotaNotice.metric === "files" ? "No plano Free podes analisar até 3 ficheiros por dia (PDF, DOCX, TXT, CSV, JSON). Volta amanhã ou passa para Pro/Ultra para continuares agora." : quotaNotice.message}</p>
           {quotaNotice.retryAt && (
             <p className="quota-countdown" role="timer">
               Repõe em <strong>{formatCountdown(quotaNotice.retryAt, countdownNow)}</strong>
             </p>
           )}
           <div className="quota-actions">
             <a
               className="quota-upgrade"
               href={`/plans?notice=${quotaNotice.metric}`}
               autoFocus
               onClick={() => setQuotaNotice(null)}
             >
               Ver planos e continuar <ArrowUpRight size={15} />
             </a>
             <button className="quota-dismiss" onClick={() => setQuotaNotice(null)}>Agora não</button>
           </div>
         </section>
       </div>
      )}
      {storageError && (
        <div className="toast-note toast-error toast-sticky" role="alert">
          <span className="toast-icon"><ShieldAlert size={13} /></span>
          <span className="toast-text">{storageError}</span>
          <button className="icon-button" onClick={() => setStorageError("")} aria-label="Fechar aviso">
            <X size={13} />
          </button>
        </div>
      )}
      {status && !storageError && (
        <div
          key={`${status}-${statusKind}`}
          className={`toast-note ${statusKind === "error" ? "toast-error" : statusKind === "success" ? "toast-good" : ""}`}
          role={statusKind === "error" ? "alert" : "status"}
        >
          <span className="toast-icon">
            {statusKind === "error"
              ? <ShieldAlert size={13} />
              : statusKind === "success"
                ? <Check size={13} />
                : <Sparkles size={13} />}
          </span>
          <span className="toast-text">{status}</span>
          <button className="icon-button" onClick={() => { setStatus(""); setStatusKind(""); }} aria-label="Fechar aviso">
            <X size={13} />
          </button>
        </div>
      )}
      {authMode && (
        <div className="account-overlay" role="presentation">
          <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <div className="account-dialog-brand"><Logo size={38} /><span>AKIRA</span></div>
            {authMode === "profile" ? (
              <>
                <span className="account-eyebrow">UM ESPAÇO TEU</span>
                <h2 id="account-title">Como queres que a AKIRA te chame?</h2>
                <p>Escolhe um nome. Podes conversar sem conta durante as primeiras dez mensagens.</p>
                <form onSubmit={(event) => void saveName(event)}>
                  <label htmlFor="akira-display-name">O teu nome</label>
                  <input
                    id="akira-display-name"
                    autoFocus
                    autoComplete="nickname"
                    maxLength={40}
                    minLength={2}
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Por exemplo, Alex"
                    required
                  />
                  {authMessage && <div className="account-error" role="alert">{authMessage}</div>}
                  <button className="account-submit" type="submit" disabled={authBusy || authName.trim().length < 2}>
                    {authBusy ? <LoaderCircle className="spin" size={16} /> : "Começar a conversar"}
                  </button>
                </form>
                <a className="account-login-link" href="/login">Já tens conta? Entrar</a>
                <span className="account-privacy">Sem palavra-passe. O teu nome fica guardado para esta conta.</span>
              </>
            ) : (
              <>
                <span className="account-eyebrow">{authSnapshot?.authenticated ? "A TUA CONTA" : "CONTINUA COM A AKIRA"}</span>
                <h2 id="account-title">{authSnapshot?.authenticated ? `Olá, ${authSnapshot.displayName}.` : "As dez mensagens passaram num instante."}</h2>
                <p>{authSnapshot?.authenticated
                  ? `Sessão iniciada como ${authSnapshot.email}.`
                  : "Cria a tua conta grátis com um link seguro enviado por e-mail. Sem palavra-passe."}</p>
                {!authSnapshot?.authenticated && (
                  <>
                    <div className="account-provider-links">
                      <a href="/api/auth/google">Continuar com Google</a>
                      <a href="/api/auth/softedge">Entrar com SoftEdge</a>
                    </div>
                  <form onSubmit={(event) => void requestMagicLink(event)}>
                    <label htmlFor="akira-account-name">Como queres que a AKIRA te chame?</label>
                    <input
                      id="akira-account-name"
                      autoComplete="nickname"
                      maxLength={40}
                      minLength={2}
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      required
                    />
                    <label htmlFor="akira-account-email">O teu e-mail</label>
                    <input
                      id="akira-account-email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={authEmail}
                      onChange={(event) => { setAuthEmail(event.target.value); setAuthLinkSent(false); }}
                      placeholder="tu@exemplo.com"
                      required
                    />
                    {authMessage && <div className={authLinkSent ? "account-success" : "account-error"} role="status">{authMessage}</div>}
                    <button className="account-submit" type="submit" disabled={authBusy || authLinkSent}>
                      {authBusy ? <LoaderCircle className="spin" size={16} /> : authLinkSent ? "Link enviado" : "Enviar link de acesso"}
                    </button>
                  </form>
                  </>
                )}
                {authSnapshot?.authenticated && <button className="account-submit" onClick={() => setAuthMode(null)}>Voltar ao chat</button>}
                {!authSnapshot?.authenticated && (
                  <button className="account-dismiss" onClick={() => setAuthMode(null)}>Agora não</button>
                )}
                <span className="account-privacy">Usamos o e-mail apenas para confirmar e proteger a tua conta.</span>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
