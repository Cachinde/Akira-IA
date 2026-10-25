import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";
import { getPublicSiteUrl } from "@/lib/site-url";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-display",
});

const siteUrl = getPublicSiteUrl();
  const shareImageUrl = new URL("/akira-logo.svg", siteUrl).toString();

  export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
      default: "AKIRA — Assistente de IA em português",
      template: "%s | AKIRA",
    },
    applicationName: "AKIRA",
    description: "A IA angolana que conversa em português: explora ideias, analisa documentos e imagens e cria imagens com inteligência artificial. Da SoftEdge Corporation, Angola.",
    keywords: [
      "AKIRA",
      "akira IA",
      "IA",
      "chatbot",
      "assistant",
      "assistente virtual de IA",
      "assistente de inteligência artificial",
      "IA angolana",
      "inteligência artificial em Angola",
      "Luanda",
      "IA em português",
      "AKIRA SoftEdge",
      "criar imagens com IA",
      "analisar documentos com IA",
      "SoftEdge Corporation",
      "Angola",
    ],
    authors: [{ name: "SoftEdge Corporation", url: "https://softedge-corporation.up.railway.app/" }],
    creator: "SoftEdge Corporation - Angola",
    publisher: "SoftEdge Corporation - Angola",
    alternates: { canonical: "/" },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || "qTOzIc73G2LzIVLTZV4IX1tMx2-rICf5tBJtEogkwDg",
    },
    icons: {
      icon: [
        { url: "/favicon-light.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", type: "image/x-icon" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
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
    openGraph: {
      type: "website",
      locale: "pt_PT",
      url: siteUrl,
      siteName: "AKIRA",
      title: "AKIRA — Assistente de IA em português",
      description: "Conversa em português, analisa documentos e imagens e dá vida às tuas ideias com a AKIRA. IA angolana.",
      images: [
        {
          url: shareImageUrl,
          secureUrl: shareImageUrl,
          type: "image/svg+xml",
          width: 256,
          height: 256,
          alt: "Logótipo da AKIRA - IA angolana",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "AKIRA — Assistente de IA em português",
      description: "Conversa em português, analisa documentos e imagens e dá vida às tuas ideias com a AKIRA. IA angolana.",
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
          slogan: "A IA angolana para as tuas ideias",
          areaServed: { "@type": "Country", name: "Angola" },
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
          description: "A IA angolana em português para conversar, explorar ideias, analisar documentos e imagens e criar imagens.",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <html lang="pt" className={`${dmSans.variable} ${manrope.variable}`}>
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
