"use client";

import { useEffect, useState } from "react";

type KeepaliveStats = {
  ok: boolean;
  active: boolean;
  count: number;
  last: { at: number; verdict: string; tookMs: number; depth: number } | null;
  lastAgeMs: number;
};

export default function KeepaliveStatus() {
  const [stats, setStats] = useState<KeepaliveStats | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/keepalive-stats", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as KeepaliveStats;
        if (alive) setStats(j);
      } catch {
        if (alive) setStats(null);
      }
    };
    load();
    const t = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const active = stats?.active ?? false;
  const age = stats?.last ? `${Math.max(1, Math.round(stats.lastAgeMs / 1000))}s` : "—";

  return (
    <div
      aria-live="polite"
      title={`PresitEN anti-sleep: ${stats ? `${stats.count} rondas · última "${stats.last?.verdict}" (${Math.round((stats.last?.tookMs ?? 0) / 100) / 10}s)` : "à espera da primeira ronda"}`}
      style={{
        position: "fixed",
        bottom: 10,
        left: 10,
        zIndex: 40,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 11,
        lineHeight: 1,
        fontFamily: "var(--font-sans, sans-serif)",
        color: active ? "#9ef0b1" : "#f3c96b",
        background: "rgba(17,17,19,.78)",
        border: `1px solid ${active ? "rgba(94,222,138,.35)" : "rgba(240,180,70,.35)"}`,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: active ? "#5ede8a" : "#f0b446",
          boxShadow: active ? "0 0 6px rgba(94,222,138,.8)" : "0 0 6px rgba(240,180,70,.6)",
          animation: "ak-keepalive-pulse 2.4s ease-in-out infinite",
        }}
      />
      {active ? `Anti-sleep ativo · ${age}` : "Anti-sleep inativo"}
      <style>{`@keyframes ak-keepalive-pulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }`}</style>
    </div>
  );
}