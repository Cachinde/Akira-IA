import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://akira-ia.onrender.com";
const shareImageUrl = new URL("/akira-share-v2.png", siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
        url: shareImageUrl,
        secureUrl: shareImageUrl,
        type: "image/png",
        width: 1200,
        height: 630,
        alt: "Logótipo da AKIRA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AKIRA — Assistente inteligente",
    description: "Conversa com a AKIRA, explora ideias e cria imagens.",
    images: [shareImageUrl],
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
