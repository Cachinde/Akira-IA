import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Confirmar acesso",
  alternates: { canonical: "/account/verify" },
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ token?: string }> };

export default async function VerifyAccountPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const validToken = /^[A-Za-z0-9_-]{40,60}$/.test(token);
  return (
    <main className="account-verify-page">
      <section className="account-verify-card">
        <Link href="/" className="account-verify-brand"><Logo size={38} /><span>AKIRA</span></Link>
        <span className="account-verify-icon"><MailCheck size={23} /></span>
        <span className="account-eyebrow">ACESSO SEGURO</span>
        <h1>{validToken ? "Confirmar o teu e-mail" : "Link inválido"}</h1>
        <p>{validToken
          ? "Confirma para terminar de criar a tua conta e continuar a conversar com a AKIRA."
          : "Este link está incompleto. Pede um novo link de acesso na AKIRA."}</p>
        {validToken ? (
          <form action="/api/auth/verify" method="post">
            <input type="hidden" name="token" value={token} />
            <button className="account-submit" type="submit">Confirmar e entrar</button>
          </form>
        ) : (
          <Link className="account-submit account-verify-link" href="/">Voltar à AKIRA</Link>
        )}
        <Link className="account-verify-back" href="/"><ArrowLeft size={14} /> Voltar ao chat</Link>
      </section>
    </main>
  );
}
