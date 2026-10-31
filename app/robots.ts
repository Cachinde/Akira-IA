import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

const ALLOWED_PATHS = [
  "/",
  "/sobre",
  "/ia-angolana",
  "/gerar-imagens-ia",
  "/login",
  "/plans",
  "/tasks",
  "/share/",
  "/_next/",
  "/llms.txt",
  "/sitemap.xml",
];

// Cibersegurança: robots.txt é apenas orientativo — o bloqueio real das rotas
// sensíveis é feito no servidor (autenticação nas rotas /api/ e /account/).
const DISALLOWED_PATHS = ["/api/", "/account/"];

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "CCBot",
  "cohere-ai",
  "meta-externalagent",
  "Bytespider",
  "Amazonbot",
  "YouBot",
  "DuckAssistBot",
  "MistralAI-User",
  "Bravebot",
  "GrokBot",
  "xAI-Crawler",
];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ALLOWED_PATHS,
        disallow: DISALLOWED_PATHS,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ALLOWED_PATHS,
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
