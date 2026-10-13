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
  Sparkles,
  SquarePen,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Logo from "../components/Logo";
import { Chat, Msg, loadChats, saveChats } from "../lib/history";
import {
  CHAT_MESSAGE_CHARACTER_LIMIT,
  estimateTokens,
  IMAGE_GENERATION_CHARACTER_LIMIT,
} from "../lib/chat-limits";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AuthSnapshot = {
  displayName: string | null;
  email: string | null;
  authenticated: boolean;
  guestMessagesUsed: number;
  guestMessageLimit: number;
};

type AuthMode = "profile" | "account" | null;

class AccountRequiredError extends Error {}

class UsageLimitError extends Error {
  constructor(
    readonly metric: "messages" | "images",
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
  return /\b(pesquis\w*|procur\w*|busc\w*)\b.{0,40}\b(web|internet|online)\b|\b(web|internet|online)\b.{0,40}\b(pesquis\w*|procur\w*|busc\w*)\b/i.test(text);
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
    throw new Error(responseError(data, "O pedido à AKIRA não foi concluído."));
  }
  return data;
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
  const [busy, setBusy] = useState(false);
  const [slowRequest, setSlowRequest] = useState(false);
  const [activityMessages, setActivityMessages] = useState(["A AKIRA está a pensar"]);
  const [activityIndex, setActivityIndex] = useState(0);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLElement>(null);
  const shouldFollowMessages = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageViewerCloseRef = useRef<HTMLButtonElement>(null);

  const activeChat = chats.find((chat) => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];
  const messageCharacterLimit = imgMode || editTarget ? IMAGE_GENERATION_CHARACTER_LIMIT : CHAT_MESSAGE_CHARACTER_LIMIT;
  const messageExceedsLimit = input.length > messageCharacterLimit;
  const displayName = authSnapshot?.displayName?.trim() || "";
  const query = search.trim().toLocaleLowerCase("pt");
  const visibleChats = chats.filter(
    (chat) =>
      !query ||
      chat.title.toLocaleLowerCase("pt").includes(query) ||
      chat.messages.some((message) => message.content.toLocaleLowerCase("pt").includes(query)),
  );

  useEffect(() => {
    let active = true;
    loadChats()
      .then((list) => {
        if (!active) return;
        setChats(list);
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
  }, []);

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
    saveChats(chats).catch((error: unknown) => {
      setStorageError(error instanceof Error ? error.message : "Não foi possível guardar o histórico.");
    });
  }, [chats, historyReady, historyWritable]);

  useEffect(() => {
    shouldFollowMessages.current = true;
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [activeId]);

  useEffect(() => {
    if (messages.length === 0 && !busy) return;
    if (shouldFollowMessages.current && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [activeId, messages.length, busy]);

  useEffect(() => {
    if (!busy || activityMessages.length < 2 || activityIndex >= activityMessages.length - 1) return;
    const timer = setInterval(() => {
      setActivityIndex((current) => Math.min(current + 1, activityMessages.length - 1));
    }, 2400);
    return () => clearInterval(timer);
  }, [activityIndex, activityMessages.length, busy]);

  useEffect(() => {
    if (!quotaNotice?.retryAt) return;
    const timer = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quotaNotice?.retryAt]);

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
        setExpandedImage(null);
      }
    }

    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  function pushMessage(chatId: string, message: Msg) {
    setChats((current) =>
      current
        .map((chat) => {
          if (chat.id !== chatId) return chat;
          const firstUserMessage = !chat.messages.some((item) => item.role === "user") && message.role === "user";
          return {
            ...chat,
            title: firstUserMessage ? conversationTitle(message.content) : chat.title,
            updatedAt: message.createdAt,
            messages: [...chat.messages, message],
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  function newChat() {
    setActiveId(null);
    setGreetingRun((current) => current + 1);
    setInput("");
    setAttachment(null);
    setImgMode(false);
    setEditTarget(null);
    setToolsOpen(false);
    setStatus("");
    setStatusKind("");
    setSideOpen(false);
    inputRef.current?.focus();
  }

  function removeChat(id: string) {
    setChats((current) => current.filter((chat) => chat.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setEditTarget(null);
    }
    setChatMenu(null);
  }

  function clearHistory() {
    if (!chats.length || !window.confirm("Apagar todas as conversas guardadas neste navegador?")) return;
    setChats([]);
    setActiveId(null);
    setEditTarget(null);
    setStatus("O histórico foi apagado deste navegador.");
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
      setBusy(true);
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
        setAttachment({ name: result.name, text: result.text });
        setStatus("Ficheiro lido. Envia uma pergunta para a AKIRA o analisar.");
        setStatusKind("success");
        inputRef.current?.focus();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Não foi possível ler o ficheiro.");
        setStatusKind("error");
      } finally {
        setBusy(false);
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
        setStatus("Não foi possível ler esta imagem.");
        setStatusKind("error");
        return;
      }
      setAttachment({ name: file.name, dataUrl: reader.result });
      setStatus("");
      setStatusKind("");
      inputRef.current?.focus();
    };
    reader.onerror = () => {
      setStatus("Não foi possível ler esta imagem.");
      setStatusKind("error");
    };
    reader.readAsDataURL(file);
  }

  async function send(text?: string) {
    const rawContent = text ?? input;
    const content = rawContent.trim();
    const imageRequest = imgMode || Boolean(editTarget);
    const characterLimit = imageRequest ? IMAGE_GENERATION_CHARACTER_LIMIT : CHAT_MESSAGE_CHARACTER_LIMIT;
    if (rawContent.length > characterLimit) {
      if (text !== undefined) setInput(rawContent);
      inputRef.current?.focus();
      return;
    }
    if ((!content && !attachment) || busy) return;
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

    let chatId = activeId;
    if (!chatId) {
      chatId = uid();
      const now = new Date().toISOString();
      setChats((current) => [{ id: chatId!, title: "Nova conversa", messages: [], updatedAt: now }, ...current]);
      setActiveId(chatId);
    }

    const currentChat = chats.find((chat) => chat.id === chatId);
    const previousHistory = (currentChat?.messages || []).map((message) => ({
      role: message.role,
      content: message.context ? `${message.content}\n\n${message.context}` : message.content,
    }));
    const visibleContent = editTarget
      ? `Edita a imagem: ${content}`
      : imgMode
        ? `Cria uma imagem: ${content}`
        : content || (attachment?.text ? `Analisa o ficheiro ${attachment.name}.` : "Descreve esta imagem.");
    const userMessage = makeMessage("user", visibleContent, {
      attachment: editTarget?.image || attachment?.dataUrl,
      attachmentName: editTarget ? "Imagem original" : attachment?.name,
      context: attachment?.text,
    });

    pushMessage(chatId, userMessage);
    setInput("");
    setAttachment(null);
    const nextActivityMessages = editTarget
      ? [
          "A AKIRA está a analisar a imagem original",
          "A AKIRA está a aplicar as alterações pedidas",
          "A AKIRA está a finalizar a imagem editada",
        ]
      : imgMode
        ? [
            "A AKIRA está a preparar a imagem",
            "A AKIRA está a compor os elementos visuais",
            "A AKIRA está a gerar a imagem",
        ]
        : attachment?.dataUrl
          ? ["A AKIRA está a analisar a imagem", "A AKIRA está a interpretar os detalhes visuais"]
          : attachment?.text
            ? ["A AKIRA está a ler o ficheiro", "A AKIRA está a analisar o conteúdo"]
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
    setActivityMessages(nextActivityMessages);
    setActivityIndex(0);
    setBusy(true);
    setSlowRequest(false);
    const slowWaitTimer = setTimeout(() => setSlowRequest(true), 8_000);
    setStatus("");
    setStatusKind("");
    setToolsOpen(false);

    try {
      if (imageRequest) {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(editTarget
              ? {
                  action: "edit",
                  imageB64: editTarget.image,
                  ...(editTarget.providerModel
                    ? { imageProviderModel: editTarget.providerModel }
                    : {}),
                }
              : {}),
            prompt: content,
            style: imageStyle,
            history: previousHistory.slice(-8),
          }),
          signal: AbortSignal.timeout(15_000),
        });
        const started: unknown = await readJson(response);
        if (!started || typeof started !== "object" || !("jobId" in started) || typeof started.jobId !== "string") {
          throw new Error("A AKIRA não iniciou a geração da imagem corretamente.");
        }

        const deadline = Date.now() + 5 * 60_000;
        let result: unknown;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1_500));
          let pollResult: unknown;
          try {
            const pollResponse = await fetch(`/api/image?jobId=${encodeURIComponent(started.jobId)}`, {
              cache: "no-store",
              signal: AbortSignal.timeout(20_000),
            });
            pollResult = await readJson(pollResponse);
          } catch (error) {
            if (error instanceof DOMException && error.name === "TimeoutError") {
              console.warn("Timeout ao consultar o estado da imagem; a AKIRA continuará a verificar.", error);
              continue;
            }
            throw error;
          }
          if (pollResult && typeof pollResult === "object" && "status" in pollResult && pollResult.status === "processing") {
            continue;
          }
          result = pollResult;
          break;
        }
        if (!result) {
          throw new Error("A geração demorou mais de 5 minutos. O pedido foi restaurado para poderes tentar novamente.");
        }
        if (!result || typeof result !== "object" || !("image" in result) || typeof result.image !== "string") {
          throw new Error("A AKIRA não devolveu uma imagem válida.");
        }
        const resultProviderModel =
          "providerModel" in result && typeof result.providerModel === "string"
            ? result.providerModel
            : undefined;
        pushMessage(
          chatId,
          makeMessage(
            "assistant",
            editTarget ? "A imagem editada está pronta." : "A imagem está pronta.",
            {
              image: result.image,
              ...(resultProviderModel ? { imageProviderModel: resultProviderModel } : {}),
            },
          ),
        );
        if (!authSnapshot.authenticated) {
          const guestMessagesUsed = authSnapshot.guestMessagesUsed + 1;
          setAuthSnapshot((current) => current ? { ...current, guestMessagesUsed } : current);
          if (guestMessagesUsed >= authSnapshot.guestMessageLimit) setAuthMode("account");
        }
        setImgMode(false);
        setEditTarget(null);
      } else {
        let chatMessage = content || (attachment?.text ? `Analisa o ficheiro ${attachment.name}.` : "Descreve esta imagem em detalhe.");
        let chatContext = "";
        if (attachment) {
          if (attachment.text) {
            chatContext = `[Conteúdo extraído do ficheiro ${attachment.name}]\n${attachment.text}`;
          } else if (attachment.dataUrl) {
            const imageResponse = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageB64: attachment.dataUrl,
                prompt: content || "Descreve esta imagem em detalhe.",
              }),
              signal: AbortSignal.timeout(105_000),
            });
            const imageResult = await readJson(imageResponse);
            if (!imageResult || typeof imageResult !== "object" || !("description" in imageResult) || typeof imageResult.description !== "string") {
              throw new Error("A AKIRA não devolveu uma análise de imagem válida.");
            }
            const imageContext = `[imagem anexada: ${imageResult.description}]`;
            chatContext = imageContext;
            setActivityMessages(["A AKIRA está a pensar", "A AKIRA está a organizar as ideias", "A AKIRA está a preparar a resposta"]);
            setActivityIndex(0);
            setChats((current) =>
              current.map((chat) =>
                chat.id === chatId
                  ? {
                      ...chat,
                      messages: chat.messages.map((message) =>
                        message.id === userMessage.id ? { ...message, context: imageContext } : message,
                      ),
                    }
                  : chat,
              ),
            );
          }
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: chatMessage, context: chatContext, history: previousHistory }),
          signal: AbortSignal.timeout(300_000),
        });
        const result = await readJson(response);
        if (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string") {
          throw new Error("A AKIRA devolveu uma resposta inválida.");
        }
        pushMessage(chatId, makeMessage("assistant", result.reply));
        if (!authSnapshot.authenticated) {
          const guestMessagesUsed = authSnapshot.guestMessagesUsed + 1;
          setAuthSnapshot((current) => current ? { ...current, guestMessagesUsed } : current);
          if (guestMessagesUsed >= authSnapshot.guestMessageLimit) setAuthMode("account");
        }
      }
    } catch (error) {
      if (error instanceof AccountRequiredError) {
        setChats((current) => current.map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: chat.messages.filter((message) => message.id !== userMessage.id) }
            : chat,
        ));
        setInput(content);
        setAttachment(attachment);
        setAuthMode("account");
        setAuthMessage(error.message);
      } else if (error instanceof UsageLimitError) {
        setChats((current) => current.map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: chat.messages.filter((message) => message.id !== userMessage.id) }
            : chat,
        ));
        setInput(content);
        setAttachment(attachment);
        setQuotaNotice(error);
      } else if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
        if (imageRequest) {
          setInput(content);
          setStatus("O processamento da imagem excedeu o limite de 5 minutos. O pedido foi restaurado para poderes tentar novamente.");
        } else {
          setStatus("A resposta demorou mais de 5 minutos. A AKIRA pode ainda estar a processar o pedido; tenta novamente.");
        }
        setStatusKind("error");
      } else {
        if (imageRequest) setInput(content);
        setStatus(error instanceof Error ? error.message : "O pedido à AKIRA falhou.");
        setStatusKind("error");
      }
    } finally {
      clearTimeout(slowWaitTimer);
      setSlowRequest(false);
      setBusy(false);
      inputRef.current?.focus();
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

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function chooseSuggestion(text: string) {
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
      window.setTimeout(() => setCopiedId((current) => current === message.id ? null : current), 1800);
    } catch (error) {
      setStatus(error instanceof Error ? `Não foi possível copiar a resposta: ${error.message}` : "Não foi possível copiar a resposta.");
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
      const result = await readJson(response);
      if (
        !result ||
        typeof result !== "object" ||
        !("includedInTraining" in result) ||
        result.includedInTraining !== (rating === "positive" && !message.image)
      ) {
        throw new Error("A AKIRA não confirmou a gravação do feedback.");
      }
      setChats((current) => current.map((chat) => ({
        ...chat,
        messages: chat.messages.map((item) => item.id === message.id ? { ...item, feedback: rating } : item),
      })));
      setStatus(message.image
        ? "Obrigado. A avaliação da imagem foi guardada para revisão e não será usada como exemplo de treino."
        : rating === "positive"
        ? "Obrigado. O 👍 foi guardado na AKIRA e entrou no conjunto considerado nos próximos ciclos de treino; a execução depende do agendamento e do mínimo de exemplos."
        : "Obrigado. O 👎 foi guardado para revisão e não entra no conjunto de treino.");
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
      setStatus(message.image
        ? "Link copiado. Inclui a pergunta, a resposta e a imagem da AKIRA."
        : "Link da conversa copiado. Inclui a mensagem original e a resposta da AKIRA.");
      setStatusKind("success");
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
                onClick={() => { setActiveId(chat.id); setEditTarget(null); setSideOpen(false); setStatus(""); setStatusKind(""); }}
                title={chat.title}
              >
                <span className="history-item-title">{chat.title}</span>
                <span className="history-item-time">{formatTime(chat.updatedAt)}</span>
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
            <ChevronDown className="model-chevron" size={14} />
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
            shouldFollowMessages.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 100;
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
                          <button className="icon-button" onClick={() => editImage(message)} disabled={busy} aria-label="Editar imagem com um pedido" title="Editar imagem">
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
              {busy && (
                <div className="msg assistant">
                  <div className="assistant-mark"><Logo size={24} /></div>
                  <div className="typing" aria-live="polite">
                    <LoaderCircle size={15} className="spin" aria-hidden="true" />
                    <span>{activityMessages[activityIndex]}</span>
                    <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                    {slowRequest && (
                      <span className="typing-note">O pedido está a demorar. Mantém esta página aberta; a AKIRA continua a processá-lo.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="composer-zone">
          {(status || storageError) && (
            <div className={`status-notice ${statusKind === "error" || storageError ? "status-error" : ""}`} role="status">
              <span>{storageError || status}</span>
              <button className="icon-button" onClick={() => { setStatus(""); setStatusKind(""); setStorageError(""); }} aria-label="Fechar aviso">
                <X size={14} />
              </button>
            </div>
          )}
          {attachment && (
            <div className="attachment-card">
              {attachment.dataUrl ? <img src={attachment.dataUrl} alt="Pré-visualização da imagem" /> : <span className="attachment-file-icon"><Paperclip size={16} /></span>}
              <span>{attachment.name}</span>
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
              placeholder={editTarget ? "Descreve as alterações a fazer à imagem…" : imgMode ? "Descreve a imagem que tens em mente…" : "Escreve a tua mensagem…"}
              value={input}
              disabled={!historyReady || busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              aria-label="A tua mensagem"
              aria-invalid={messageExceedsLimit}
            />
            {messageExceedsLimit && (
              <div className="composer-limit-error" role="alert">
                A mensagem excede o limite de {messageCharacterLimit.toLocaleString("pt-PT")} caracteres. Encurta-a para a poderes enviar.
              </div>
            )}
            <div className={`composer-count ${messageExceedsLimit ? "over-limit" : ""}`} aria-live="polite">
              <span>{input.length.toLocaleString("pt-PT")} / {messageCharacterLimit.toLocaleString("pt-PT")} caracteres</span>
              <span title="Estimativa aproximada: cerca de 1 token por 4 caracteres; não é uma tokenização exata.">
                ~{estimateTokens(input).toLocaleString("pt-PT")} tokens (estimativa)
              </span>
            </div>
            <div className="composer-bar">
              <div className="composer-tools">
                <button
                  type="button"
                  className="icon-btn attach-btn"
                  aria-label="Anexar imagem ou documento"
                  onClick={() => fileRef.current?.click()}
                  disabled={!historyReady || busy || imgMode}
                >
                  <Paperclip size={17} />
                </button>
                <input ref={fileRef} type="file" accept="image/*,.txt,.md,.markdown,.csv,.json,.pdf,.docx" hidden onChange={onFile} disabled={busy || imgMode} />
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
                <span className="enter-hint">↵ enviar</span>
                <button
                  type="submit"
                  className="send-btn"
                  disabled={!historyReady || busy || (!input.trim() && !attachment)}
                  aria-label={imgMode ? "Gerar imagem" : "Enviar mensagem"}
                >
                  {busy ? <LoaderCircle className="spin" size={16} /> : imgMode ? <ImagePlus size={16} /> : <Send size={15} />}
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
           <span className="quota-icon"><Sparkles size={21} /></span>
           <span className="quota-eyebrow">LIMITE DO PLANO ATINGIDO</span>
           <h2 id="quota-title">{quotaNotice.metric === "images" ? "Queres criar mais imagens?" : "Continua a conversar com a AKIRA."}</h2>
           <p id="quota-description">{quotaNotice.message}</p>
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
