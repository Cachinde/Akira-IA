"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Sparkles } from "lucide-react";

type Billing = {
  plan: "free" | "pro" | "ultra";
  limits: { messages: number; files: number; images: number; period: "day" | "month" | "lifetime" };
  used: { messages: number; files: number; images: number };
};

const plans = [
  { id: "free", name: "Gratuito", price: "0", period: "para sempre", messages: "10 mensagens grátis; 20/dia com conta", files: "3 ficheiros por dia", images: "3 imagens por dia", featured: false },
  { id: "pro", name: "Pro", price: "5", period: "por mês", messages: "1.000 mensagens por mês", files: "100 ficheiros por mês", images: "10 imagens por dia", featured: true },
  { id: "ultra", name: "Ultra", price: "12", period: "por mês", messages: "5.000 mensagens por mês", files: "500 ficheiros por mês", images: "30 imagens por dia", featured: false },
] as const;

export default function PlansPage() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/billing", { cache: "no-store" });
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(result && typeof result === "object" && "error" in result ? String(result.error) : "Não foi possível carregar os planos.");
    const snapshot = result as Billing;
    setBilling(snapshot);
    return snapshot;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    let active = true;
    if (checkout === "success") {
      setError("Pagamento recebido. Estamos a confirmar a assinatura…");
      const confirm = async () => {
        for (let attempt = 0; attempt < 10 && active; attempt += 1) {
          try {
            const snapshot = await refresh();
            if (snapshot.plan !== "free") {
              setError("Assinatura ativa. Já podes aproveitar o teu plano.");
              return;
            }
          } catch {
            if (attempt === 9) setError("Pagamento recebido, mas ainda não conseguimos confirmar a assinatura. Atualiza esta página dentro de alguns instantes.");
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        }
        if (active) setError("Pagamento recebido. A confirmação está a demorar; atualiza a página dentro de alguns instantes.");
      };
      void confirm();
    } else {
      refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar os planos."));
      if (checkout === "cancelled") setError("O checkout foi cancelado; não foi feita nenhuma cobrança.");
    }
    if (checkout) window.history.replaceState({}, "", window.location.pathname);
    return () => { active = false; };
  }, [refresh]);

  async function submit(action: "pro" | "ultra" | "portal") {
    setBusy(action);
    setError("");
    try {
      const response = await fetch(action === "portal" ? "/api/billing/portal" : "/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "portal" ? undefined : JSON.stringify({ plan: action }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("url" in result) || typeof result.url !== "string") {
        throw new Error(result && typeof result === "object" && "error" in result ? String(result.error) : "Não foi possível iniciar a operação.");
      }
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir o Stripe.");
      setBusy("");
    }
  }

  return (
    <main className="plans-page">
      <header className="plans-header"><Link href="/" className="plans-back"><ArrowLeft size={16} /> Voltar ao chat</Link><span><Sparkles size={15} /> AKIRA</span></header>
      <section className="plans-intro">
        <span className="plans-eyebrow">PLANOS AKIRA</span>
        <h1>Mais espaço para as tuas ideias.</h1>
        <p>Escolhe o plano que acompanha o teu ritmo. Cancela quando quiseres.</p>
        {billing && (
          <div className="plan-usage">
            Plano atual: <strong>{plans.find((plan) => plan.id === billing.plan)?.name}</strong>
            <span>{billing.used.messages}/{billing.limits.messages} mensagens · {billing.used.files}/{billing.limits.files} ficheiros · {billing.used.images}/{billing.limits.images} imagens hoje</span>
          </div>
        )}
        {error && <p className="plans-notice" role="status">{error}</p>}
      </section>
      <section className="plan-grid" aria-label="Planos de assinatura">
        {plans.map((plan) => {
          const current = billing?.plan === plan.id;
          return (
            <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.id}>
              {plan.featured && <span className="plan-badge">MAIS ESCOLHIDO</span>}
              <h2>{plan.name}</h2>
              <p className="plan-price"><span>$</span>{plan.price}<small> USD / {plan.period}</small></p>
              <p className="plan-description">{plan.id === "free" ? "O essencial para começares." : plan.id === "pro" ? "Para usar a AKIRA todos os dias." : "Para levar a produtividade mais longe."}</p>
              <ul><li><Check size={15} />{plan.messages}</li><li><Check size={15} />{plan.files}</li><li><Check size={15} />{plan.images}</li><li><Check size={15} />Histórico guardado no teu navegador</li></ul>
              {plan.id === "free" ? (
                <Link className={`plan-action ${current ? "current" : ""}`} href="/">{current ? "Plano atual" : "Começar grátis"}</Link>
              ) : current ? (
                <button className="plan-action" onClick={() => void submit("portal")} disabled={!!busy}>
                  {busy === "portal" ? <LoaderCircle className="spin" size={16} /> : "Gerir assinatura"}
                </button>
              ) : (
                <button className={`plan-action ${plan.featured ? "primary" : ""}`} onClick={() => void submit(plan.id)} disabled={!billing || !!busy}>
                  {busy === plan.id ? <LoaderCircle className="spin" size={16} /> : "Assinar com Stripe"}
                </button>
              )}
            </article>
          );
        })}
      </section>
      <p className="plans-footnote">Pagamentos processados com segurança pelo Stripe. Preços em dólares americanos (USD).</p>
    </main>
  );
}
