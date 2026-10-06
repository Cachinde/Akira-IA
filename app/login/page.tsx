"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Mail, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const authResult = new URLSearchParams(window.location.search).get("auth");
    if (authResult === "unavailable") {
      setIsError(true);
      setMessage("Este método de entrada está temporariamente indisponível. Usa o e-mail ou tenta mais tarde.");
    } else if (authResult === "error") {
      setIsError(true);
      setMessage("Não foi possível concluir a entrada. Confirma a tua conta e tenta novamente.");
    }
  }, []);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string" ? result.error : "Não foi possível enviar o link agora.";
        throw new Error(error);
      }
      setSent(true);
      setMessage("Se o endereço puder receber mensagens, enviámos um link de acesso. Verifica também a pasta de spam.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o link agora. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link href="/" className="login-back"><ArrowLeft size={15} /> Voltar ao chat</Link>
        <div className="login-brand"><Logo size={42} /><span>AKIRA</span></div>
        <span className="login-eyebrow"><Sparkles size={13} /> A TUA CONTA</span>
        <h1>Continua de onde<br />a tua ideia começa.</h1>
        <p className="login-intro">Entra com Google, com a tua conta SoftEdge ou recebe um link seguro no e-mail.</p>

        <div className="login-providers">
          <a className="login-provider" href="/api/auth/google">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar com Google
          </a>
          <a className="login-provider softedge" href="/api/auth/softedge">
            <span className="softedge-login-mark"><Sparkles size={15} /></span>
            Entrar com SoftEdge
          </a>
        </div>

        <div className="login-divider"><span>ou usa o teu e-mail</span></div>
        <form className="login-form" onSubmit={(event) => void requestLink(event)}>
          <label htmlFor="login-name">Como queres que a AKIRA te chame?</label>
          <input
            id="login-name"
            autoComplete="nickname"
            maxLength={40}
            minLength={2}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="O teu nome"
            required
          />
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => { setEmail(event.target.value); setSent(false); }}
            placeholder="tu@exemplo.com"
            required
          />
          {message && <div className={isError ? "login-message error" : "login-message"} role={isError ? "alert" : "status"}>{message}</div>}
          <button className="login-submit" type="submit" disabled={busy || sent}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <Mail size={16} />}
            {busy ? "A enviar…" : sent ? "Link enviado" : "Enviar link de acesso"}
          </button>
        </form>
        <p className="login-footnote">Sem palavra-passe. O link é pessoal e expira em 15 minutos.</p>
      </section>
    </main>
  );
}
