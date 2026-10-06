import type { Metadata } from "next";
import "./globals.css";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();
const shareImageUrl = new URL("/akira-share-v2.png", siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AKIRA — Assistente de IA em português",
    template: "%s | AKIRA",
  },
  applicationName: "AKIRA",
  description: "Conversa com a AKIRA em português, explora ideias, analisa documentos e imagens e cria imagens com inteligência artificial.",
  keywords: [
    "AKIRA",
    "assistente de inteligência artificial",
    "chatbot de IA em português",
    "criar imagens com IA",
    "analisar documentos com IA",
    "SoftEdge Corporation",
  ],
  authors: [{ name: "SoftEdge Corporation", url: "https://softedge-corporation.up.railway.app/" }],
  creator: "SoftEdge Corporation",
  publisher: "SoftEdge Corporation",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: { icon: "/akira-logo.png" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: siteUrl,
    siteName: "AKIRA",
    title: "AKIRA — Assistente de IA em português",
    description: "Conversa em português, analisa documentos e imagens e dá vida às tuas ideias com a AKIRA.",
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
    title: "AKIRA — Assistente de IA em português",
    description: "Conversa em português, analisa documentos e imagens e dá vida às tuas ideias com a AKIRA.",
    images: [shareImageUrl],
  },
};

export const viewport = {
  themeColor: "#111113",
  colorScheme: "dark" as const,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "SoftEdge Corporation",
        url: "https://softedge-corporation.up.railway.app/",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "AKIRA",
        alternateName: "AKIRA — Assistente de IA em português",
        url: siteUrl,
        inLanguage: "pt-PT",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#application`,
        name: "AKIRA",
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        inLanguage: "pt-PT",
        url: siteUrl,
        description: "Assistente de IA em português para conversar, explorar ideias, analisar documentos e imagens e criar imagens.",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <html lang="pt">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
        {children}
      </body>
    </html>
  );
}
