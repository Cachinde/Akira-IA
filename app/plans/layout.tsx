import type { Metadata } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: "Planos e Preços",
  description:
    "Planos da AKIRA — a IA angolana em português: mensagens grátis todos os dias, geração de imagens e limites generosos no plano pago da SoftEdge Corporation.",
  alternates: { canonical: "/plans" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${siteUrl}/plans`,
    siteName: "AKIRA",
    title: "Planos e Preços — AKIRA, a IA angolana em português",
    description:
      "Conhece os planos da AKIRA: mensagens grátis todos os dias, criação de imagens e limites generosos.",
  },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
