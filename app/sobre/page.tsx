import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: "Sobre a AKIRA, a SoftEdge e Isaac Quarenta",
  description:
    "Conhece a AKIRA, a assistente de inteligência artificial angolana da SoftEdge Corporation, o CEO Isaac Quarenta e a missão de levar a IA em português a Angola e ao mundo.",
  keywords: [
    "Isaac Quarenta",
    "Isaac Nascimento Quarenta",
    "CEO da SoftEdge",
    "co-fundador da SoftEdge",
    "SoftEdge Corporation",
    "AKIRA IA",
    "criador da AKIRA",
    "IA angolana",
  ],
  alternates: { canonical: "/sobre" },
  openGraph: {
    type: "article",
    locale: "pt_PT",
    url: `${siteUrl}/sobre`,
    siteName: "AKIRA",
    title: "Sobre a AKIRA, a SoftEdge e Isaac Quarenta",
    description:
      "A história da AKIRA, da SoftEdge Corporation e do CEO angolano Isaac Quarenta, principal visionário da IA em português.",
    images: [
      {
        url: new URL("/akira-og.png", siteUrl).toString(),
        width: 1200,
        height: 630,
        alt: "AKIRA — a IA angolana para as tuas ideias",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sobre a AKIRA, a SoftEdge e Isaac Quarenta",
    description:
      "A história da AKIRA, da SoftEdge Corporation e do CEO angolano Isaac Quarenta, principal visionário da IA em português.",
    images: [new URL("/akira-og.png", siteUrl).toString()],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${siteUrl}/sobre#about`,
      url: `${siteUrl}/sobre`,
      name: "Sobre a AKIRA, a SoftEdge Corporation e Isaac Quarenta",
      description:
        "Página oficial sobre a AKIRA, a SoftEdge Corporation e Isaac Quarenta, co-fundador e CEO da SoftEdge e principal visionário da AKIRA.",
      inLanguage: "pt-PT",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: [
        { "@id": `${siteUrl}/#organization` },
        { "@id": `${siteUrl}/#isaac-quarenta` },
        { "@id": `${siteUrl}/#application` },
      ],
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "SoftEdge Corporation",
      url: "https://softedge-corporation.up.railway.app/",
      logo: new URL("/akira-logo.png", siteUrl).toString(),
      description:
        "A SoftEdge Corporation é uma empresa de tecnologia angolana criadora da AKIRA, a assistente de inteligência artificial em português.",
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
      description:
        "Isaac Quarenta é co-fundador e CEO da SoftEdge Corporation e o principal visionário da AKIRA, a assistente de inteligência artificial angolana em português.",
      worksFor: { "@id": `${siteUrl}/#organization` },
      nationality: { "@type": "Country", name: "Angola" },
      url: "https://x.com/IQuarenta98960",
      sameAs: [
        "https://x.com/IQuarenta98960",
      ],
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
      publisher: { "@id": `${siteUrl}/#organization` },
      sameAs: [
        "https://github.com/Cachinde/Akira-IA",
        "https://akira-wake.onrender.com/",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/sobre#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Quem é Isaac Quarenta?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Isaac Quarenta é co-fundador e CEO da SoftEdge Corporation e o principal visionário da AKIRA. É um empreendedor angolano focado em tecnologia e inteligência artificial em português.",
          },
        },
        {
          "@type": "Question",
          name: "Quem criou a AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A AKIRA foi criada pela SoftEdge Corporation, empresa angolana. Isaac Quarenta é co-fundador e CEO da SoftEdge e o principal visionário por trás da AKIRA.",
          },
        },
        {
          "@type": "Question",
          name: "A AKIRA é gratuita?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. A AKIRA tem um plano gratuito com mensagens diárias. Quem precisar de mais utilização pode consultar os planos e preços.",
          },
        },
        {
          "@type": "Question",
          name: "Onde posso usar a AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Podes usar a AKIRA diretamente no site oficial. Basta entrar ou criar conta para começares a conversar.",
          },
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${siteUrl}/sobre#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Início",
          item: `${siteUrl}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Sobre",
          item: `${siteUrl}/sobre`,
        },
      ],
    },
  ],
};

const sectionStyle = {
  marginTop: 42,
} as const;

const headingStyle = {
  margin: "0 0 12px",
  color: "#f5f5f7",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "clamp(20px, 3vw, 26px)",
  fontWeight: 700,
  letterSpacing: "-0.03em",
} as const;

const paragraphStyle = {
  margin: "0 0 16px",
  color: "#b7b4bf",
  fontSize: 16,
  lineHeight: 1.75,
} as const;

const linkStyle = {
  color: "#c7b7ff",
  textDecoration: "underline",
  textDecorationColor: "rgba(199, 183, 255, .45)",
  textUnderlineOffset: 3,
} as const;

export default function SobrePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        overflowY: "auto",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(140, 112, 197, .16), transparent 46%), radial-gradient(ellipse at 10% 90%, rgba(77, 143, 126, .08), transparent 38%), #0b0b0b",
        color: "#f2f2f2",
        padding: "clamp(24px, 5vw, 64px) clamp(18px, 5vw, 48px)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <article style={{ maxWidth: 840, margin: "0 auto" }}>
        <Link href="/" style={{ ...linkStyle, display: "inline-block", marginBottom: 34, fontSize: 14 }}>
          Voltar à AKIRA
        </Link>

        <p
          style={{
            margin: "0 0 12px",
            color: "#c7b7ff",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".14em",
            textTransform: "uppercase",
          }}
        >
          Sobre
        </p>
        <h1
          style={{
            margin: "0 0 18px",
            color: "#ffffff",
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "clamp(30px, 6vw, 48px)",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.045em",
          }}
        >
          AKIRA, SoftEdge e Isaac Quarenta
        </h1>
        <p style={{ ...paragraphStyle, color: "#d0ccd8", fontSize: 18 }}>
          A AKIRA é uma assistente de inteligência artificial em português, criada pela SoftEdge
          Corporation, uma empresa de tecnologia angolana. Isaac Quarenta é co-fundador e CEO da
          SoftEdge e o principal visionário da AKIRA.
        </p>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Quem é Isaac Quarenta?</h2>
          <p style={paragraphStyle}>
            Isaac Quarenta, também conhecido como Isaac Nascimento Quarenta, é um empreendedor
            angolano, co-fundador e CEO da SoftEdge Corporation. É o principal visionário da AKIRA e
            lidera a missão de tornar a inteligência artificial acessível em português, com especial
            atenção a Angola e ao continente africano.
          </p>
          <p style={paragraphStyle}>
            Podes acompanhar o trabalho de Isaac Quarenta no{" "}
            <a href="https://x.com/IQuarenta98960" target="_blank" rel="noopener noreferrer author" style={linkStyle}>
              X (Twitter)
            </a>.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>O que é a SoftEdge Corporation?</h2>
          <p style={paragraphStyle}>
            A SoftEdge Corporation é uma empresa de tecnologia angolana. A sua equipa cria produtos
            digitais pensados para resolver problemas reais, com foco em software, inteligência
            artificial e experiência em português. A AKIRA é o seu produto de IA mais conhecido.
          </p>
          <p style={paragraphStyle}>
            Conhece mais no{" "}
            <a
              href="https://softedge-corporation.up.railway.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              site da SoftEdge Corporation
            </a>.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>O que é a AKIRA?</h2>
          <p style={paragraphStyle}>
            A AKIRA é uma assistente de IA que conversa em português. Ajuda a explorar ideias,
            analisar documentos e imagens, pesquisar na web e criar imagens com inteligência
            artificial. Está disponível em{" "}
            <Link href="/" style={linkStyle}>
              akira-ia.onrender.com
            </Link>
            , com um plano gratuito e planos pagos para quem precisa de mais utilização.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Referências</h2>
          <ul style={{ ...paragraphStyle, paddingLeft: 22, display: "grid", gap: 10 }}>
            <li>
              <a
                href="https://softedge-corporation.up.railway.app/"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Site oficial da SoftEdge Corporation
              </a>
            </li>
            <li>
              <a
                href="https://x.com/IQuarenta98960"
                target="_blank"
                rel="noopener noreferrer author"
                style={linkStyle}
              >
                Perfil oficial de Isaac Quarenta no X (Twitter)
              </a>
            </li>
            <li>
              <a
                href="https://github.com/Cachinde/Akira-IA"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Repositório da AKIRA no GitHub
              </a>
            </li>
            <li>
              <a
                href="https://akira-wake.onrender.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Tela de entrada da AKIRA
              </a>
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Perguntas frequentes</h2>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Quem é Isaac Quarenta?</h3>
          <p style={paragraphStyle}>
            Isaac Quarenta é co-fundador e CEO da SoftEdge Corporation e o principal visionário da
            AKIRA. É um empreendedor angolano focado em tecnologia e inteligência artificial em
            português.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Quem criou a AKIRA?</h3>
          <p style={paragraphStyle}>
            A AKIRA foi criada pela SoftEdge Corporation, empresa angolana. Isaac Quarenta é
            co-fundador e CEO da SoftEdge e o principal visionário por trás da AKIRA.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>A AKIRA é gratuita?</h3>
          <p style={paragraphStyle}>
            Sim. A AKIRA tem um plano gratuito com mensagens diárias. Quem precisar de mais
            utilização pode consultar os{" "}
            <Link href="/plans" style={linkStyle}>
              planos e preços
            </Link>
            .
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Onde posso usar a AKIRA?</h3>
          <p style={paragraphStyle}>
            Podes usar a AKIRA diretamente no site oficial. Basta{" "}
            <Link href="/login" style={linkStyle}>
              entrar ou criar conta
            </Link>{" "}
            para começares a conversar.
          </p>
        </section>

        <footer style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.09)", color: "#77747e", fontSize: 13 }}>
          Um produto da SoftEdge Corporation. Co-fundador e CEO: Isaac Quarenta.
        </footer>
      </article>
    </main>
  );
}
