import { NextResponse } from "next/server";

type StatRecord = {
  at: number;
  depth: number;
  verdict: string;
  okRate: number | null;
  tookMs: number;
  from?: string;
};

const store = {
  count: 0,
  startedAt: Date.now(),
  warnedAt: 0,
  last: null as StatRecord | null,
  history: [] as StatRecord[],
};

export async function GET() {
  const lastAgeMs = store.last ? Date.now() - store.last.at : -1;
  const active = lastAgeMs >= 0 ? lastAgeMs < 150_000 : false;
  if (!active && (Date.now() - store.warnedAt > 150_000)) {
    store.warnedAt = Date.now();
    console.log(`[KEEPALIVE] estado: INATIVO (última ronda há ${Math.round(lastAgeMs / 1000)}s, rondas=${store.count})`);
  }
  return NextResponse.json({
    ok: true,
    service: "akira-ui keepalive panel",
    active,
    count: store.count,
    last: store.last,
    lastAgeMs,
    windowsSec: Math.round((Date.now() - store.startedAt) / 1000),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const rec: StatRecord = {
      at: Date.now(),
      depth: Number(body?.depth ?? -1),
      verdict: String(body?.verdict ?? "?"),
      okRate: typeof body?.okRate === "number" ? body.okRate : null,
      tookMs: Number(body?.tookMs ?? 0),
      from: typeof body?.from === "string" ? body.from : undefined,
    };
    store.last = rec;
    store.count += 1;
    store.history.push(rec);
    if (store.history.length > 120) store.history.shift();
    console.log(`[KEEPALIVE] ronda recebida: depth=${rec.depth} verdict=${rec.verdict} okRate=${rec.okRate} ${rec.tookMs}ms (total=${store.count})`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}