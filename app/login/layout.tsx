import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sessão",
  description: "Inicia sessão na AKIRA com Google, uma conta SoftEdge ou um link seguro enviado ao teu e-mail.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
