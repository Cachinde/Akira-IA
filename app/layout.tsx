import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://akira-ui.onrender.com"),
  title: "AKIRA — Assistente inteligente",
  description: "Conversa com a AKIRA, explora ideias e cria imagens.",
  icons: { icon: "/akira-logo.png" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: "/",
    siteName: "AKIRA",
    title: "AKIRA — Assistente inteligente",
    description: "Conversa com a AKIRA, explora ideias e cria imagens.",
    images: [
      {
        url: "/akira-logo.png",
        width: 768,
        height: 768,
        alt: "Logótipo da AKIRA",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "AKIRA — Assistente inteligente",
    description: "Conversa com a AKIRA, explora ideias e cria imagens.",
    images: ["/akira-logo.png"],
  },
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
