import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planos e preços",
  description: "Compara os planos Gratuito, Pro e Ultra da AKIRA e escolhe o nível de acesso às ferramentas de inteligência artificial.",
  alternates: { canonical: "/plans" },
  openGraph: {
    title: "Planos e preços da AKIRA",
    description: "Compara os planos Gratuito, Pro e Ultra da AKIRA.",
    url: "/plans",
  },
};

export default function PlansLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
