/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  agentRules: false,
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};
export default nextConfig;
