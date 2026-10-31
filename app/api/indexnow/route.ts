import { NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/site-url";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const BING_SUBMIT_BATCH_ENDPOINT = "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch";
const DEFAULT_KEY = "b4571f1d937cc8eac7944f439d619386";
const DEFAULT_PATHS = [
  "/",
  "/sobre",
  "/ia-angolana",
  "/gerar-imagens-ia",
  "/plans",
  "/login",
  "/tasks",
];
const MAX_URLS = 10_000;

function isAuthorized(request: Request) {
  const secret = process.env.SEO_INTERNAL_KEY;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) return true;

  return new URL(request.url).searchParams.get("key") === secret;
}

function normalizeUrls(siteUrl: string, input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const origin = new URL(siteUrl).origin;
  const urls = new Set<string>();

  for (const value of input) {
    if (typeof value !== "string") continue;

    try {
      const url = new URL(value, siteUrl);
      if (url.origin !== origin) continue;
      url.hash = "";
      urls.add(url.toString());
      if (urls.size >= MAX_URLS) break;
    } catch {
      // Ignore invalid URLs instead of failing the whole submission.
    }
  }

  return [...urls];
}

// Envia também para o indexador do Bing Webmaster Tools quando a chave existe
// (BING_WEBMASTER_API_KEY). Falhar aqui não deve falhar o pedido inteiro.
async function submitToBingWebmaster(siteUrl: string, urlList: string[]) {
  const apiKey = process.env.BING_WEBMASTER_API_KEY;
  if (!apiKey) return { configured: false };

  try {
    const response = await fetch(
      `${BING_SUBMIT_BATCH_ENDPOINT}?apikey=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ siteUrl, urlList }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    return { configured: true, ok: response.ok, status: response.status };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Falha ao contactar o Bing Webmaster Tools.",
    };
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = getPublicSiteUrl();
  const key = process.env.INDEXNOW_KEY || DEFAULT_KEY;

  return NextResponse.json({
    configured: Boolean(process.env.INDEXNOW_KEY),
    usingDefaultKey: !process.env.INDEXNOW_KEY,
    keyFile: new URL(`/${key}.txt`, siteUrl).toString(),
    endpoint: INDEXNOW_ENDPOINT,
    bingWebmasterConfigured: Boolean(process.env.BING_WEBMASTER_API_KEY),
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = getPublicSiteUrl();
  let body: { urls?: unknown } = {};

  try {
    body = await request.json();
  } catch {
    // An empty body is valid: submit the default public pages.
  }

  const requestedUrls = normalizeUrls(siteUrl, body.urls);
  const urlList = requestedUrls.length > 0
    ? requestedUrls
    : DEFAULT_PATHS.map((path) => new URL(path, siteUrl).toString());
  const key = process.env.INDEXNOW_KEY || DEFAULT_KEY;
  const host = new URL(siteUrl).host;

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: new URL(`/${key}.txt`, siteUrl).toString(),
      urlList,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const bing = await submitToBingWebmaster(siteUrl, urlList);

  return NextResponse.json(
    {
      ok: response.ok,
      indexNowStatus: response.status,
      bingWebmaster: bing,
      submitted: urlList,
    },
    { status: response.ok ? 200 : 502 },
  );
}
