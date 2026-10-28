import type { Metadata } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: "Tarefas da AKIRA",
  description:
    "Organiza as tuas tarefas com a AKIRA, a IA angolana em português: lembretes, planeamento e acompanhamento no teu assistente de IA.",
  alternates: { canonical: "/tasks" },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
