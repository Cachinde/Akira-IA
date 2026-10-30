import { NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/site-url";

const MAX_PAYLOAD = 200_000;

function isAuthorized(request: Request) {
  const secret = process.env.SEO_INTERNAL_KEY;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) return true;

  return new URL(request.url).searchParams.get("key") === secret;
}

function cleanDomain(input: string | null, fallback: string) {
  return (input || fallback)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
}

async function readLimited(response: Response) {
  const text = await response.text();
  return text.length > MAX_PAYLOAD ? `${text.slice(0, MAX_PAYLOAD)}…` : text;
}

async function querySemrush(domain: string, database: string, apiKey: string) {
  const params = new URLSearchParams({
    type: "domain_ranks",
    key: apiKey,
    domain,
    database,
    export_columns: "Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac",
  });

  const response = await fetch(`https://api.semrush.com/?${params.toString()}`, {
    headers: { Accept: "text/csv,text/plain,*/*" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    data: await readLimited(response),
  };
}

async function queryAhrefs(domain: string, apiToken: string) {
  const date = new Date().toISOString().slice(0, 10);
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    Accept: "application/json",
  };
  const metricsParams = new URLSearchParams({
    target: domain,
    date,
    mode: "domain",
  });
  const ratingParams = new URLSearchParams({
    target: domain,
    date,
  });

  const [metricsResponse, ratingResponse] = await Promise.all([
    fetch(`https://api.ahrefs.com/v3/site-explorer/metrics?${metricsParams.toString()}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }),
    fetch(`https://api.ahrefs.com/v3/site-explorer/domain-rating?${ratingParams.toString()}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }),
  ]);

  return {
    configured: true,
    metrics: {
      ok: metricsResponse.ok,
      status: metricsResponse.status,
      data: await readLimited(metricsResponse),
    },
    domainRating: {
      ok: ratingResponse.ok,
      status: ratingResponse.status,
      data: await readLimited(ratingResponse),
    },
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const siteUrl = getPublicSiteUrl();
  const domain = cleanDomain(url.searchParams.get("domain"), new URL(siteUrl).hostname);
  const database = (url.searchParams.get("database") || "pt").slice(0, 8);
  const semrushKey = process.env.SEMRUSH_API_KEY;
  const ahrefsKey = process.env.AHREFS_API_KEY;

  if (!semrushKey && !ahrefsKey) {
    return NextResponse.json(
      { error: "Configura SEMRUSH_API_KEY e/ou AHREFS_API_KEY no Render." },
      { status: 503 },
    );
  }

  const [semrush, ahrefs] = await Promise.all([
    semrushKey ? querySemrush(domain, database, semrushKey) : Promise.resolve({ configured: false }),
    ahrefsKey ? queryAhrefs(domain, ahrefsKey) : Promise.resolve({ configured: false }),
  ]);

  return NextResponse.json({
    domain,
    database,
    semrush,
    ahrefs,
  });
}
