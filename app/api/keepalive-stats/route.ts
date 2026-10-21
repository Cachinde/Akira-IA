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
  last: null as StatRecord | null,
  history: [] as StatRecord[],
};

export async function GET() {
  const lastAgeMs = store.last ? Date.now() - store.last.at : -1;
  return NextResponse.json({
    ok: true,
    service: "akira-ui keepalive panel",
    active: lastAgeMs >= 0 ? lastAgeMs < 150_000 : false,
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
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}