import type { Metadata } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: "Login AKIRA — Entrar na IA angolana",
  description:
    "Entra para continuar a conversar com a AKIRA, a IA angolana em português. Explora ideias, analisa documentos e imagens e cria imagens com IA.",
  alternates: { canonical: "/login" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${siteUrl}/login`,
    siteName: "AKIRA",
    title: "Entrar na AKIRA — a IA angolana em português",
    description:
      "Entra para continuar a conversar com a AKIRA, a IA angolana em português da SoftEdge Corporation.",
  },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
