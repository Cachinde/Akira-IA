import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AKIRA — Assistente inteligente",
  description: "Conversa com a AKIRA, explora ideias e cria imagens.",
  icons: { icon: "/akira-logo.png" },
};

export const viewport = {
  themeColor: "#111113",
  colorScheme: "dark" as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
