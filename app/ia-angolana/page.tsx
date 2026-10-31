import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: "AKIRA — A Inteligência Artificial angolana em português",
  description:
    "A AKIRA é a IA angolana criada pela SoftEdge Corporation, em Angola. Conversa em português, analisa documentos e imagens e cria imagens com IA. Começa com o plano gratuito.",
  keywords: [
    "IA angolana",
    "inteligência artificial Angola",
    "IA em português",
    "IA Angola",
    "tecnologia angolana",
    "chatbot Angola",
    "IA Luanda",
    "IA África",
    "SoftEdge Corporation",
    "Isaac Quarenta",
    "AKIRA IA",
    "assistente de IA em português",
  ],
  alternates: { canonical: "/ia-angolana" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${siteUrl}/ia-angolana`,
    siteName: "AKIRA",
    title: "AKIRA — A Inteligência Artificial angolana em português",
    description:
      "A IA angolana da SoftEdge Corporation: conversa, analisa documentos e imagens e cria imagens com IA, tudo em português.",
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
    title: "AKIRA — A Inteligência Artificial angolana em português",
    description:
      "A IA angolana da SoftEdge Corporation: conversa, analisa documentos e imagens e cria imagens com IA, tudo em português.",
    images: [new URL("/akira-og.png", siteUrl).toString()],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/ia-angolana#webpage`,
      url: `${siteUrl}/ia-angolana`,
      name: "AKIRA — A Inteligência Artificial angolana em português",
      description:
        "Página oficial sobre a AKIRA, a inteligência artificial angolana da SoftEdge Corporation, que conversa em português e procura dar acesso à IA em Angola e África.",
      inLanguage: "pt-PT",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: [
        { "@id": `${siteUrl}/#organization` },
        { "@id": `${siteUrl}/#isaac-quarenta` },
        { "@id": `${siteUrl}/#application` },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${siteUrl}/ia-angolana#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "IA angolana", item: `${siteUrl}/ia-angolana` },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/ia-angolana#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "O que é a AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A AKIRA é uma assistente de inteligência artificial em português criada pela SoftEdge Corporation, empresa de tecnologia angolana. Ajuda a conversar, analisar documentos e imagens, pesquisar na web e criar imagens com IA.",
          },
        },
        {
          "@type": "Question",
          name: "A AKIRA é angolana?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. A AKIRA é desenvolvida pela SoftEdge Corporation, uma empresa de tecnologia angolana, com foco em Angola e no continente africano, falando a língua de quem a usa.",
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
          name: "Quem criou a AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A AKIRA foi criada pela SoftEdge Corporation, empresa angolana. Isaac Quarenta é co-fundador e CEO da SoftEdge e o principal visionário por trás da AKIRA.",
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

const listStyle = {
  ...paragraphStyle,
  paddingLeft: 22,
} as const;

export default function IaAngolanaPage() {
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
          IA angolana
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
          AKIRA — a IA angolana em português
        </h1>
        <p style={{ ...paragraphStyle, color: "#d0ccd8", fontSize: 18 }}>
          A AKIRA é uma inteligência artificial criada em Angola pela SoftEdge Corporation. Conversa
          contigo em português, entende o contexto local e ajuda-te a pensar, criar e resolver — uma
          tecnologia angolana feita para quem fala português.
        </p>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Porquê uma IA em português e de Angola?</h2>
          <p style={paragraphStyle}>
            A maior parte das inteligências artificiais responde melhor em inglês e pensa num contexto
            distante. A AKIRA nasceu para fazer o contrário: responde em português, com atenção ao
            contexto de Angola e de África, para que a tecnologia trabalhe na tua língua e no teu dia
            a dia.
          </p>
          <p style={paragraphStyle}>
            É uma IA para angolanos e para todos os falantes de português: estudantes, empresas,
            criadores e curiosos que querem um assistente que se entende consigo sem necessidade de
            traduzir.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Quem está por trás da AKIRA?</h2>
          <p style={paragraphStyle}>
            A AKIRA é produto da{" "}
            <a
              href="https://softedge-corporation.up.railway.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              SoftEdge Corporation
            </a>
            , empresa de tecnologia angolana. O{" "}
            <Link href="/sobre" style={linkStyle}>
              co-fundador e CEO Isaac Quarenta
            </Link>{" "}
            (com perfil oficial no{" "}
            <a
              href="https://x.com/IQuarenta98960"
              target="_blank"
              rel="noopener noreferrer author"
              style={linkStyle}
            >
              X
            </a>
            ) é o principal visionário da assistente e lidera a missão de tornar a IA acessível em
            português.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>O que podes fazer com a AKIRA?</h2>
          <ul style={listStyle}>
            <li>Conversar em português, de forma natural e clara.</li>
            <li>Analisar documentos PDF, DOCX, TXT, CSV e JSON que envias na conversa.</li>
            <li>Analisar imagens que envias e pedir explicações sobre elas.</li>
            <li>Criar imagens com IA a partir de uma descrição em português.</li>
            <li>Pesquisar na web e resumir o que importa.</li>
            <li>Organizar o teu trabalho no espaço de tarefas.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Começa a usar a IA angolana hoje</h2>
          <p style={paragraphStyle}>
            É simples:{" "}
            <Link href="/login" style={linkStyle}>
              entra ou cria conta
            </Link>{" "}
            e começa a conversar já. O plano gratuito dá-te mensagens todos os dias e os{" "}
            <Link href="/plans" style={linkStyle}>
              planos e preços
            </Link>{" "}
            da AKIRA são pensados para serem acessíveis.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Perguntas frequentes</h2>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>O que é a AKIRA?</h3>
          <p style={paragraphStyle}>
            A AKIRA é uma assistente de inteligência artificial em português criada pela SoftEdge
            Corporation, empresa de tecnologia angolana. Ajuda a conversar, analisar documentos e
            imagens, pesquisar na web e criar imagens com IA.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>A AKIRA é angolana?</h3>
          <p style={paragraphStyle}>
            Sim. A AKIRA é desenvolvida pela SoftEdge Corporation, uma empresa de tecnologia angolana,
            com foco em Angola e no continente africano, falando a língua de quem a usa.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>A AKIRA é gratuita?</h3>
          <p style={paragraphStyle}>
            Sim. A AKIRA tem um plano gratuito com mensagens diárias. Quem precisar de mais utilização
            pode consultar os{" "}
            <Link href="/plans" style={linkStyle}>
              planos e preços
            </Link>
            .
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Quem criou a AKIRA?</h3>
          <p style={paragraphStyle}>
            A AKIRA foi criada pela SoftEdge Corporation, empresa angolana. Isaac Quarenta é
            co-fundador e CEO da SoftEdge e o principal visionário por trás da AKIRA.
          </p>
        </section>

        <footer style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.09)", color: "#77747e", fontSize: 13 }}>
          Um produto da SoftEdge Corporation, Angola. Co-fundador e CEO: Isaac Quarenta.
        </footer>
      </article>
    </main>
  );
}
