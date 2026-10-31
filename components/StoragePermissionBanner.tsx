"use client";

import { Cookie, CheckCircle2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const PROBE_STORAGE_KEY = "akira-storage-probe";
const DISMISS_STORAGE_KEY = "akira-storage-banner-dismissed-at";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;
const PROBE_RECORD_ID = "__akira-storage-probe-record";
const DATABASE = "akira-bot-ui";

type Status = "checking" | "ok" | "blocked";

function probeLocalStorage(): boolean {
  try {
    window.localStorage.setItem(PROBE_STORAGE_KEY, "1");
    const ok = window.localStorage.getItem(PROBE_STORAGE_KEY) === "1";
    window.localStorage.removeItem(PROBE_STORAGE_KEY);
    return ok;
  } catch {
    return false;
  }
}

function probeBrowserStorage(): Promise<{ local: boolean; database: boolean }> {
  const local = probeLocalStorage();

  if (typeof indexedDB === "undefined") {
    return Promise.resolve({ local, database: false });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (database: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ local, database });
    };

    try {
      const request = indexedDB.open(DATABASE);
      request.onupgradeneeded = () => {
        // Primeira utilização neste navegador: a criação das lojas acontece no app.
        finish(true);
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        if (!Array.from(database.objectStoreNames).includes("conversations")) {
          database.close();
          finish(true);
          return;
        }
        try {
          const transaction = database.transaction("conversations", "readwrite");
          const store = transaction.objectStore("conversations");
          store.put({
            id: PROBE_RECORD_ID,
            chatId: PROBE_RECORD_ID,
            historyScope: "__probe__",
            title: "teste",
            messages: [],
            updatedAt: "1970-01-01T00:00:00.000Z",
          });
          store.delete(PROBE_RECORD_ID);
          transaction.oncomplete = () => {
            database.close();
            finish(true);
          };
          transaction.onerror = () => finish(false);
          transaction.onabort = () => finish(false);
        } catch {
          database.close();
          finish(false);
        }
      };
      request.onerror = () => finish(false);
      request.onblocked = () => finish(true);
    } catch {
      finish(false);
    }
  });
}

function canPersistDismissal(): boolean {
  try {
    window.localStorage.setItem(PROBE_STORAGE_KEY, "1");
    window.localStorage.removeItem(PROBE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function StoragePermissionBanner() {
  const [status, setStatus] = useState<Status>("checking");
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const mountedRef = useRef(true);
  const lastProbeRef = useRef(0);
  const succeedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const runProbe = useCallback(async (isRetry: boolean) => {
    const now = Date.now();
    lastProbeRef.current = now;
    if (isRetry) setRetrying(true);
    const result = await probeBrowserStorage();
    if (!mountedRef.current) return;
    const blocked = !result.database || !result.local;
    setRetrying(false);
    setStatus(blocked ? "blocked" : "ok");
    if (!blocked && isRetry) {
      setSucceeded(true);
      if (succeedTimerRef.current) clearTimeout(succeedTimerRef.current);
      succeedTimerRef.current = setTimeout(() => setSucceeded(false), 3_000);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY));
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS) {
        setDismissed(true);
      }
    } catch {
      // Sem acesso a guardar: o aviso aparece sempre de novo, mas nunca bloqueia.
    }
    void runProbe(false);
    return () => {
      mountedRef.current = false;
      if (succeedTimerRef.current) clearTimeout(succeedTimerRef.current);
    };
  }, [runProbe]);

  useEffect(() => {
    if (status !== "blocked" && status !== "checking") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastProbeRef.current < 10_000) return;
      void runProbe(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [runProbe, status]);

  if (status !== "blocked" || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Aviso volta só na próxima visita quando guardar não está disponível.
    }
  };

  return (
    <div className="storage-permission-banner" role="dialog" aria-live="polite" aria-label="Aviso de cookies da AKIRA">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .storage-permission-banner {
              position: fixed;
              left: 50%;
              bottom: 30px;
              transform: translateX(-50%);
              z-index: 70;
              width: min(600px, calc(100vw - 26px));
              opacity: 0;
              animation: spb-enter .45s .2s cubic-bezier(.21,1.02,.73,1) forwards;
            }
            @keyframes spb-enter {
              from { opacity: 0; transform: translateX(-50%) translateY(24px) scale(.97); }
              to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
            @keyframes spb-spin { to { transform: rotate(360deg); } }
            .spb-card {
              display: flex;
              flex-direction: column;
              gap: 14px;
              border-radius: 22px;
              padding: 22px 22px 18px;
              background: linear-gradient(165deg, rgba(46,42,58,.92), rgba(20,19,24,.94) 46%, rgba(14,13,17,.96));
              border: 1px solid rgba(199, 183, 255, .18);
              box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              color: #f2f2f4;
              font-family: var(--font-display), sans-serif;
            }
            .spb-head { display: flex; align-items: center; gap: 13px; }
            .spb-badge {
              width: 42px; height: 42px; flex: none;
              display: grid; place-items: center;
              border-radius: 13px;
              background: linear-gradient(140deg, rgba(168,133,255,.32), rgba(110,86,200,.16));
              border: 1px solid rgba(199,183,255,.26);
              color: #cdb9ff;
            }
            .spb-eyebrow {
              margin: 0 0 3px;
              color: #b6a4ec;
              font-size: 10.5px;
              font-weight: 700;
              letter-spacing: .16em;
              text-transform: uppercase;
            }
            .spb-title { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -.01em; line-height: 1.35; }
            .spb-close {
              margin-left: auto; flex: none;
              width: 30px; height: 30px;
              display: grid; place-items: center;
              border-radius: 9px;
              border: 1px solid rgba(255,255,255,.09);
              background: rgba(255,255,255,.04);
              color: #97929f;
              cursor: pointer;
              transition: color .15s, border-color .15s;
            }
            .spb-close:hover { color: #fff; border-color: rgba(255,255,255,.22); }
            .spb-body { margin: 0; color: #b9b5c1; font-size: 13.5px; line-height: 1.65; }
            .spb-steps { margin: 0; padding-left: 18px; color: #b9b5c1; font-size: 13px; line-height: 1.7; }
            .spb-steps strong { color: #e8e6ee; font-weight: 600; }
            .spb-foot { display: flex; align-items: center; gap: 10px; margin-top: 2px; flex-wrap: wrap; }
            .spb-retry {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 9px 16px;
              border-radius: 11px;
              border: none;
              cursor: pointer;
              color: #0e0d12;
              font-size: 13px;
              font-weight: 700;
              background: linear-gradient(135deg, #b8a4ff, #8a6cf0);
              box-shadow: 0 8px 24px rgba(122, 92, 224, .35);
              transition: filter .15s, transform .15s;
            }
            .spb-retry:hover { filter: brightness(1.08); transform: translateY(-1px); }
            .spb-retry[disabled] { opacity: .6; cursor: wait; transform: none; }
            .spb-spin { animation: spb-spin .9s linear infinite; }
            .spb-later {
              padding: 9px 14px;
              border-radius: 11px;
              border: 1px solid rgba(255,255,255,.12);
              background: transparent;
              color: #a49fae;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: color .15s, border-color .15s;
            }
            .spb-later:hover { color: #fff; border-color: rgba(255,255,255,.24); }
            .spb-note { margin-left: auto; color: #7a7683; font-size: 11.5px; }
            .spb-success {
              display: flex; align-items: center; gap: 10px;
              color: #7ce6b1; font-size: 14px; font-weight: 600;
            }
            @media (max-width: 560px) {
              .storage-permission-banner { bottom: 18px; }
              .spb-card { padding: 18px 16px 15px; border-radius: 18px; }
              .spb-note { margin-left: 0; width: 100%; }
            }
          `,
        }}
      />
      <div className="spb-card">
        <div className="spb-head">
          <span className="spb-badge">
            <Cookie size={21} />
          </span>
          <div>
            <p className="spb-eyebrow">COOKIES DA AKIRA</p>
            <h3 className="spb-title">Permite os cookies e dados do site para guardares o teu histórico</h3>
          </div>
          <button className="spb-close" onClick={dismiss} aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </div>

        <p className="spb-body">
          O teu navegador está a bloquear cookies e bases de dados locais, por isso a AKIRA não consegue
          lembrar as tuas conversas neste dispositivo. O chat continua a funcionar — apenas não fica guardado.
        </p>
        <ol className="spb-steps">
          <li>Clica no ícone <strong>ao lado do endereço do site</strong> na barra do Chrome.</li>
          <li>Abrir <strong>"Cookies e dados de sites"</strong> → escolhe <strong>"Permitir"</strong>.</li>
          <li>Em Definições → <strong>Cookies</strong>: usa <strong>"Bloquear cookies de terceiros"</strong>, nunca "Bloquear todos".</li>
        </ol>

        <div className="spb-foot">
          <button
            className="spb-retry"
            onClick={() => void runProbe(true)}
            disabled={retrying}
          >
            {retrying ? <RefreshCw size={14} className="spb-spin" /> : <RefreshCw size={14} />}
            {retrying ? "A verificar..." : "Tentei permitir — verificar de novo"}
          </button>
          <button className="spb-later" onClick={dismiss}>
            Agora não
          </button>
          <span className="spb-note">Sem rastreadores: só guardam a tua sessão local.</span>
        </div>
      </div>
      {succeeded && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 9,
            justifyContent: "center",
            padding: "11px 16px",
            borderRadius: 14,
            background: "rgba(46, 122, 82, .28)",
            border: "1px solid rgba(124, 230, 177, .3)",
            color: "#8bf08c",
            fontSize: 13.5,
            fontWeight: 600,
            backdropFilter: "blur(12px)",
          }}
        >
          <CheckCircle2 size={16} />
          Cookies ativos! A AKIRA já pode guardar as tuas conversas neste dispositivo.
        </div>
      )}
    </div>
  );
}
