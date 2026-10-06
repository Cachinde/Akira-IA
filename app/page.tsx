"use client";

import {
  ArrowUp,
  Check,
  Copy,
  ChevronDown,
  Clock3,
  FileDown,
  Globe,
  ImagePlus,
  Lightbulb,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Share2,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Logo from "../components/Logo";
import { Chat, Msg, loadChats, saveChats } from "../lib/history";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STYLES = ["foto realista", "anime", "ilustração", "3d", "cinematográfico", "aquarela"];
const FILE_LIMIT = 8 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "pdf", "docx"]);

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

function responseError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}

async function readJson(response: Response) {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(responseError(data, "O pedido à AKIRA não foi concluído."));
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [imgMode, setImgMode] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"error" | "success" | "">("");
  const [imageStyle, setImageStyle] = useState(STYLES[0]);
  const [attachment, setAttachment] = useState<{ name: string; dataUrl?: string; text?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatMenu, setChatMenu] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyWritable, setHistoryWritable] = useState(false);
  const [storageError, setStorageError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = chats.find((chat) => chat.id === activeId) || null;
  const messages = activeChat?.messages || [];
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
    if (!historyReady || !historyWritable) return;
    saveChats(chats).catch((error: unknown) => {
      setStorageError(error instanceof Error ? error.message : "Não foi possível guardar o histórico.");
    });
  }, [chats, historyReady, historyWritable]);

  useEffect(() => {
    if (messages.length === 0 && !busy) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeId, messages.length, busy]);

  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/health", { cache: "no-store", keepalive: true }).catch((error: unknown) => {
        console.warn("O ping de disponibilidade da AKIRA falhou.", error);
      });
    };
    const interval = window.setInterval(ping, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

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
    setInput("");
    setAttachment(null);
    setImgMode(false);
    setToolsOpen(false);
    setStatus("");
    setStatusKind("");
    setSideOpen(false);
    inputRef.current?.focus();
  }

  function removeChat(id: string) {
    setChats((current) => current.filter((chat) => chat.id !== id));
    if (activeId === id) setActiveId(null);
    setChatMenu(null);
  }

  function clearHistory() {
    if (!chats.length || !window.confirm("Apagar todas as conversas guardadas neste navegador?")) return;
    setChats([]);
    setActiveId(null);
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
    const content = (text ?? input).trim();
    if ((!content && !attachment) || busy) return;
    if (imgMode && !content) {
      setStatus("Escreve uma descrição para a imagem que queres criar.");
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
    const visibleContent = imgMode
      ? `Cria uma imagem: ${content}`
      : content || (attachment?.text ? `Analisa o ficheiro ${attachment.name}.` : "Descreve esta imagem.");
    const userMessage = makeMessage("user", visibleContent, {
      attachment: attachment?.dataUrl,
      attachmentName: attachment?.name,
      context: attachment?.text,
    });

    pushMessage(chatId, userMessage);
    setInput("");
    setAttachment(null);
    setBusy(true);
    setStatus("");
    setStatusKind("");
    setToolsOpen(false);

    try {
      if (imgMode) {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: content, style: imageStyle }),
        });
        const result = await readJson(response);
        if (!result || typeof result !== "object" || !("image" in result) || typeof result.image !== "string") {
          throw new Error("A AKIRA não devolveu uma imagem válida.");
        }
        pushMessage(chatId, makeMessage("assistant", "A imagem está pronta.", { image: result.image }));
        setImgMode(false);
      } else {
        let chatMessage = content || (attachment?.text ? `Analisa o ficheiro ${attachment.name}.` : "Descreve esta imagem em detalhe.");
        if (attachment) {
          if (attachment.text) {
            chatMessage += `\n\n[Conteúdo extraído do ficheiro ${attachment.name}]\n${attachment.text}`;
          } else if (attachment.dataUrl) {
            const imageResponse = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageB64: attachment.dataUrl,
                prompt: content || "Descreve esta imagem em detalhe.",
              }),
            });
            const imageResult = await readJson(imageResponse);
            if (!imageResult || typeof imageResult !== "object" || !("description" in imageResult) || typeof imageResult.description !== "string") {
              throw new Error("A AKIRA não devolveu uma análise de imagem válida.");
            }
            const imageContext = `[imagem anexada: ${imageResult.description}]`;
            chatMessage += `\n\n${imageContext}`;
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
          body: JSON.stringify({ message: chatMessage, history: previousHistory }),
        });
        const result = await readJson(response);
        if (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string") {
          throw new Error("A AKIRA devolveu uma resposta inválida.");
        }
        pushMessage(chatId, makeMessage("assistant", result.reply));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "O pedido à AKIRA falhou.");
      setStatusKind("error");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
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

  async function shareMessage(message: Msg) {
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message.content }),
      });
      const result = await readJson(response);
      if (!result || typeof result !== "object" || !("url" in result) || typeof result.url !== "string") {
        throw new Error("Não foi possível criar o link da resposta.");
      }
      await navigator.clipboard.writeText(result.url);
      setStatus("Link da resposta copiado. Está disponível durante 90 dias.");
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
                onClick={() => { setActiveId(chat.id); setSideOpen(false); setStatus(""); setStatusKind(""); }}
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
          <a className="plans-link" href="/plans"><Sparkles size={14} /> Planos de assinatura</a>
          {chats.length > 0 && (
            <>
              <button onClick={exportHistory}><FileDown size={14} /> Exportar histórico</button>
              <button className="clear-history" onClick={clearHistory}><Trash2 size={14} /> Limpar histórico</button>
            </>
          )}
          <div className="profile-row">
            <span className="profile-avatar">A</span>
            <span><strong>AKIRA SOFTEDGE</strong><small>Histórico neste navegador</small></span>
            <span className="profile-dot" aria-hidden="true" />
          </div>
        </div>
      </aside>

      {sideOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setSideOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="burger icon-button" onClick={() => setSideOpen(true)} aria-label="Abrir histórico">
              <Menu size={19} />
            </button>
            <span className="model">AKIRA <span className="model-separator">/</span> <span>GPU</span></span>
            <ChevronDown className="model-chevron" size={14} />
          </div>
          <div className="topbar-right">
            <span className="space-status"><span /> SOFTEDGE</span>
            <button className="topbar-new-chat" onClick={newChat}><MessageSquarePlus size={15} /> Nova conversa</button>
          </div>
        </header>

        <section className="thread" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty">
              <div className="hero-mark"><Logo size={92} /></div>
              <span className="hero-overline"><span /> INTELIGÊNCIA PARA AS TUAS IDEIAS</span>
              <h1>Como posso <em>te ajudar?</em></h1>
              <p className="hero-caption">Pergunta, imagina, cria. Vamos descobrir juntos.</p>
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
                  <div className="message-content">
                    {message.attachment && <img className="attached-image" src={message.attachment} alt="Imagem anexada" />}
                    <div className={`bubble ${message.role === "assistant" ? "markdown-content" : ""}`}>
                      {message.role === "assistant"
                        ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        : message.content}
                    </div>
                    {message.image && <img className="gen" src={message.image} alt="Imagem gerada pela AKIRA" />}
                    {message.attachmentName && <span className="message-attachment"><Paperclip size={12} /> {message.attachmentName}</span>}
                    {message.role === "assistant" && (
                      <div className="message-actions">
                        <button className="icon-button" onClick={() => void copyMessage(message)} aria-label="Copiar resposta" title="Copiar resposta">
                          {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedId === message.id ? "Copiado" : "Copiar"}</span>
                        </button>
                        <button className="icon-button" onClick={() => void shareMessage(message)} aria-label="Partilhar resposta" title="Copiar link para partilhar">
                          <Share2 size={14} /><span>Partilhar</span>
                        </button>
                      </div>
                    )}
                    <time className="message-time">{formatTime(message.createdAt)}</time>
                  </div>
                </article>
              ))}
              {busy && (
                <div className="msg assistant">
                  <div className="assistant-mark"><Logo size={24} /></div>
                  <div className="typing"><LoaderCircle size={15} className="spin" /> A AKIRA está a pensar</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
          {!activeChat && messages.length === 0 && <div ref={bottomRef} />}
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
          {imgMode && (
            <div className="image-mode-bar">
              <span><ImagePlus size={14} /> Criar imagem</span>
              <label>
                Estilo
                <select value={imageStyle} onChange={(event) => setImageStyle(event.target.value)}>
                  {STYLES.map((style) => <option key={style}>{style}</option>)}
                </select>
                <ChevronDown size={13} />
              </label>
              <button className="icon-button" onClick={() => setImgMode(false)} aria-label="Fechar modo de imagem"><X size={14} /></button>
            </div>
          )}
          {toolsOpen && (
            <div className="tools-pop">
              <div className="tools-heading">Ferramentas</div>
              <button onClick={() => { setAttachment(null); setImgMode(true); setToolsOpen(false); inputRef.current?.focus(); }}>
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
              maxLength={imgMode ? 1_000 : 8_000}
              placeholder={imgMode ? "Descreve a imagem que tens em mente…" : "Escreve a tua mensagem…"}
              value={input}
              disabled={!historyReady || busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              aria-label="A tua mensagem"
            />
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
    </div>
  );
}
