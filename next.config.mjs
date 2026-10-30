/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  agentRules: false,
  images: {
    // SEO (GSC "Outro erro" nas imagens): TTL mínimo do otimizador /_next/image
    // elevado para 31 dias — respostas cacheáveis, menos re-fetch do Googlebot.
    minimumCacheTTL: 2_678_400,
  },
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: '</llms.txt>; rel="describedby"',
          },
        ],
      },
    ];
  },
};
export default nextConfig;
