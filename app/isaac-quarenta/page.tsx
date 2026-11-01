import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: "Isaac Quarenta — co-fundador e CEO da SoftEdge Corporation",
  description:
    "Isaac Quarenta (Isaac Nascimento Quarenta) é co-fundador e CEO da SoftEdge Corporation, empresa angolana, e o principal visionário da AKIRA, a inteligência artificial em português.",
  keywords: [
    "Isaac Quarenta",
    "Isaac Nascimento Quarenta",
    "CEO da SoftEdge",
    "co-fundador da SoftEdge",
    "empreendedor angolano",
    "criador da AKIRA",
    "visionário da AKIRA",
    "SoftEdge Corporation",
    "IA angolana",
    "empresário angolano",
  ],
  alternates: { canonical: "/isaac-quarenta" },
  openGraph: {
    type: "profile",
    locale: "pt_PT",
    url: `${siteUrl}/isaac-quarenta`,
    siteName: "AKIRA",
    title: "Isaac Quarenta — co-fundador e CEO da SoftEdge Corporation",
    description:
      "Quem é Isaac Quarenta: empreendedor angolano, co-fundador e CEO da SoftEdge Corporation e principal visionário da AKIRA, a IA em português.",
    images: [
      {
        url: new URL("/akira-og.png", siteUrl).toString(),
        width: 1200,
        height: 630,
        alt: "AKIRA — a IA angolana criada pela SoftEdge Corporation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Isaac Quarenta — co-fundador e CEO da SoftEdge Corporation",
    description:
      "Quem é Isaac Quarenta: empreendedor angolano, co-fundador e CEO da SoftEdge Corporation e principal visionário da AKIRA, a IA em português.",
    images: [new URL("/akira-og.png", siteUrl).toString()],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/isaac-quarenta#webpage`,
      url: `${siteUrl}/isaac-quarenta`,
      name: "Isaac Quarenta — co-fundador e CEO da SoftEdge Corporation",
      description:
        "Página oficial sobre Isaac Quarenta, empreendedor angolano, co-fundador e CEO da SoftEdge Corporation e principal visionário da AKIRA.",
      inLanguage: "pt-PT",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: [
        { "@id": `${siteUrl}/#isaac-quarenta` },
        { "@id": `${siteUrl}/#organization` },
      ],
      mainEntity: { "@id": `${siteUrl}/#isaac-quarenta` },
    },
    {
      "@type": "Person",
      "@id": `${siteUrl}/#isaac-quarenta`,
      name: "Isaac Quarenta",
      alternateName: ["Isaac Nascimento Quarenta"],
      jobTitle: "Co-fundador e CEO",
      description:
        "Isaac Quarenta é co-fundador e CEO da SoftEdge Corporation, empresa de tecnologia angolana criadora da AKIRA, e o principal visionário da assistente de IA em português.",
      worksFor: { "@id": `${siteUrl}/#organization` },
      nationality: { "@type": "Country", name: "Angola" },
      knowsAbout: [
        "Inteligência artificial",
        "Empreendedorismo",
        "Tecnologia em Angola",
        "Software em português",
        "Inteligência artificial em África",
      ],
      url: "https://x.com/IQuarenta98960",
      sameAs: [
        "https://x.com/IQuarenta98960",
        `${siteUrl}/sobre`,
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${siteUrl}/isaac-quarenta#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Isaac Quarenta", item: `${siteUrl}/isaac-quarenta` },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/isaac-quarenta#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Quem é Isaac Quarenta?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Isaac Quarenta é co-fundador e CEO da SoftEdge Corporation, empresa de tecnologia angolana, e o principal visionário da AKIRA, a assistente de inteligência artificial em português.",
          },
        },
        {
          "@type": "Question",
          name: "Isaac Quarenta é o criador da AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A AKIRA é um produto da SoftEdge Corporation, liderada por Isaac Quarenta como co-fundador, CEO e principal visionário por trás da assistente.",
          },
        },
        {
          "@type": "Question",
          name: "Onde seguir Isaac Quarenta?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Isaac Quarenta compartilha actualizações no seu perfil oficial X: https://x.com/IQuarenta98960",
          },
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

export default function IsaacQuarentaPage() {
  return (
    <main className="doc-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <article>
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
          Liderança da SoftEdge
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
          Isaac Quarenta
        </h1>
        <p style={{ ...paragraphStyle, color: "#d0ccd8", fontSize: 18 }}>
          Isaac Quarenta é co-fundador e CEO da SoftEdge Corporation, empresa de tecnologia angolana,
          e o principal visionário da AKIRA, a assistente de inteligência artificial em português.
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
              perfil oficial no X (Twitter)
            </a>
            .
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Papel na SoftEdge Corporation</h2>
          <p style={paragraphStyle}>
            Como co-fundador e CEO, Isaac Quarenta lidera a SoftEdge Corporation, empresa de
            tecnologia angolana que cria produtos digitais para resolver problemas reais, com foco em
            software, inteligência artificial e experiência em português. A{" "}
            <a href="https://softedge-corporation.up.railway.app/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              SoftEdge Corporation
            </a>{" "}
            é conhecida pela AKIRA, o seu produto de IA mais conhecido.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>O papel de Isaac na AKIRA</h2>
          <p style={paragraphStyle}>
            A AKIRA, disponível em{" "}
            <Link href="/" style={linkStyle}>
              akira-ia.onrender.com
            </Link>
            , é a assistente de inteligência artificial em português criada pela SoftEdge
            Corporation. Isaac Quarenta é o principal visionário por trás da assistente e lidera a
            missão de levar a IA em português a Angola, a África e ao mundo. Para conhecer a empresa e
            a história completa, vê a{" "}
            <Link href="/sobre" style={linkStyle}>
              página sobre a AKIRA, a SoftEdge e Isaac Quarenta
            </Link>
            .
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Perguntas frequentes</h2>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Quem é Isaac Quarenta?</h3>
          <p style={paragraphStyle}>
            Isaac Quarenta é co-fundador e CEO da SoftEdge Corporation, empresa de tecnologia
            angolana, e o principal visionário da AKIRA, a assistente de inteligência artificial em
            português.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Isaac Quarenta é o criador da AKIRA?</h3>
          <p style={paragraphStyle}>
            A AKIRA é um produto da SoftEdge Corporation, liderada por Isaac Quarenta como
            co-fundador, CEO e principal visionário por trás da assistente.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Onde seguir Isaac Quarenta?</h3>
          <p style={paragraphStyle}>
            Isaac Quarenta compartilha actualizações no{" "}
            <a href="https://x.com/IQuarenta98960" target="_blank" rel="noopener noreferrer author" style={linkStyle}>
              perfil oficial no X
            </a>
            .
          </p>
        </section>

        <footer>
          Um produto da SoftEdge Corporation, Angola. Co-fundador e CEO: Isaac Quarenta.
        </footer>
      </article>
    </main>
  );
}
