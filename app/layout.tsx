import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans, Manrope } from "next/font/google";
import "katex/dist/katex.min.css";
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
const shareImageUrl = new URL("/akira-og.png", siteUrl).toString();

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
      default: "AKIRA — Assistente de IA em português",
      template: "%s | AKIRA",
    },
    applicationName: "AKIRA",
    description: "A IA angolana que conversa em português: explora ideias, analisa documentos e imagens e cria imagens com inteligência artificial. Da SoftEdge Corporation, Angola, liderada pelo co-fundador e CEO Isaac Quarenta.",
    keywords: [
      "AKIRA",
      "akira IA",
      "akira login",
      "login akira",
      "entrar na AKIRA",
      "IA",
      "IA angolana",
      "IA angolana gratuita",
      "inteligência artificial em Angola",
      "inteligência artificial em português",
      "IA em português",
      "IA gratuita",
      "IA grátis em português",
      "chatbot",
      "chatbot em português",
      "chatbot Angola",
      "chatgpt angolano",
      "assistant",
      "assistente virtual de IA",
      "assistente virtual Angola",
      "assistente de inteligência artificial",
      "melhor IA em português",
      "IA que fala português",
      "IA para angolanos",
      "tecnologia angolana",
      "inovação Angola",
      "startup angolana",
      "IA Luanda",
      "criar imagens com IA",
      "criar imagens com IA grátis",
      "gerar imagens com IA em português",
      "analisar documentos com IA",
      "analisar PDF com IA",
      "analisar imagens com IA",
      "AKIRA SoftEdge",
      "SoftEdge Corporation",
      "AKIRA Angola",
      "softedge akira",
      "Isaac Quarenta",
      "Isaac Nascimento Quarenta",
      "Isaac Quarenta CEO",
      "Isaac Quarenta Angolano",
      "CEO da SoftEdge",
      "fundador da SoftEdge",
      "criador da AKIRA",
      "Luanda",
      "Angola",
    ],
    authors: [
      { name: "SoftEdge Corporation", url: "https://softedge-corporation.up.railway.app/" },
      { name: "Isaac Quarenta", url: "https://x.com/IQuarenta98960" },
    ],
    creator: "SoftEdge Corporation - Angola",
    publisher: "SoftEdge Corporation - Angola",
    category: "Tecnologia e Inteligência Artificial",
    other: {
      "geo.region": "AO",
      "geo.placename": "Luanda, Angola",
      "geo.position": "-8.839988;13.289437",
      ICBM: "-8.839988, 13.289437",
      "content-language": "pt-PT",
    },
    alternates: { canonical: "/" },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || "qTOzIc73G2LzIVLTZV4IX1tMx2-rICf5tBJtEogkwDg",
      other: {
        ...(process.env.BING_SITE_VERIFICATION
          ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
          : {}),
        ...(process.env.YANDEX_SITE_VERIFICATION
          ? { "yandex-verification": process.env.YANDEX_SITE_VERIFICATION }
          : {}),
      },
    },
    icons: {
      icon: [
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
          type: "image/png",
          width: 1200,
          height: 630,
          alt: "AKIRA — a IA angolana para as tuas ideias",
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
          logo: new URL("/akira-logo.png", siteUrl).toString(),
          slogan: "A IA angolana para as tuas ideias",
          description: "A SoftEdge Corporation é uma empresa de tecnologia angolana criadora da AKIRA, a assistente de inteligência artificial em português.",
          areaServed: { "@type": "Country", name: "Angola" },
          founder: { "@id": `${siteUrl}/#isaac-quarenta` },
          sameAs: [
            "https://softedge-corporation.up.railway.app/",
            "https://x.com/IQuarenta98960",
            "https://akira-wake.onrender.com/",
            "https://github.com/Cachinde/Akira-IA",
          ],
        },
        {
          "@type": "Person",
          "@id": `${siteUrl}/#isaac-quarenta`,
          name: "Isaac Quarenta",
          alternateName: ["Isaac Nascimento Quarenta"],
          jobTitle: "Co-fundador e CEO",
          description: "Isaac Quarenta é o co-fundador e CEO da SoftEdge Corporation e o principal visionário da AKIRA, a assistente de inteligência artificial angolana em português.",
          worksFor: { "@id": `${siteUrl}/#organization` },
          nationality: { "@type": "Country", name: "Angola" },
          url: "https://x.com/IQuarenta98960",
          sameAs: [
            "https://x.com/IQuarenta98960",
          ],
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
        sameAs: [
          "https://github.com/Cachinde/Akira-IA",
          "https://akira-wake.onrender.com/",
        ],
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
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          strategy="afterInteractive"
          data-key="z1rr24SvsAN2JPAw8fsrOw"
        />
      </body>
    </html>
  );
}
