import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: "Criar e editar imagens com IA em português | AKIRA",
  description:
    "Gera e edita imagens com IA em português na AKIRA, a IA angolana da SoftEdge Corporation. Descreve a tua ideia, escolhe o estilo e vê a imagem nascer. Começa com o plano gratuito.",
  keywords: [
    "criar imagens com IA",
    "criar imagens com IA grátis",
    "gerar imagens com IA em português",
    "gerador de imagens IA",
    "IA de imagens Angola",
    "editar imagens com IA",
    "fotos de IA português",
    "AKIRA IA",
    "IA angolana",
    "SoftEdge Corporation",
  ],
  alternates: { canonical: "/gerar-imagens-ia" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${siteUrl}/gerar-imagens-ia`,
    siteName: "AKIRA",
    title: "Criar e editar imagens com IA em português",
    description:
      "Gera e edita imagens com IA em português na AKIRA, a IA angolana da SoftEdge Corporation. Começa grátis.",
    images: [
      {
        url: new URL("/akira-og.png", siteUrl).toString(),
        width: 1200,
        height: 630,
        alt: "AKIRA — gerar imagens com IA em português",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Criar e editar imagens com IA em português",
    description:
      "Gera e edita imagens com IA em português na AKIRA, a IA angolana da SoftEdge Corporation. Começa grátis.",
    images: [new URL("/akira-og.png", siteUrl).toString()],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/gerar-imagens-ia#webpage`,
      url: `${siteUrl}/gerar-imagens-ia`,
      name: "Criar e editar imagens com IA em português",
      description:
        "Como criar e editar imagens com inteligência artificial na AKIRA, a IA angolana da SoftEdge Corporation, em português e com um plano gratuito para começar.",
      inLanguage: "pt-PT",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: [
        { "@id": `${siteUrl}/#organization` },
        { "@id": `${siteUrl}/#application` },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${siteUrl}/gerar-imagens-ia#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Gerar imagens com IA", item: `${siteUrl}/gerar-imagens-ia` },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/gerar-imagens-ia#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Como criar imagens com IA na AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Escreves a tua ideia em português no chat da AKIRA e a assistente cria a imagem. Também podes ativar o modo de imagem para descrever o que queres gerar.",
          },
        },
        {
          "@type": "Question",
          name: "Que estilos posso usar nas imagens da AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Podes pedir estilos como foto realista, anime, ilustração, 3D, cinematográfico e aquarela — basta mencionar o estilo na descrição.",
          },
        },
        {
          "@type": "Question",
          name: "Posso editar uma imagem que já gerei?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. Podes pedir à AKIRA para editar a imagem que gerou com novas instruções, ou enviar uma imagem como referência para criar uma nova a partir dela.",
          },
        },
        {
          "@type": "Question",
          name: "Criar imagens com IA é gratuito na AKIRA?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim, é possível começar com o plano gratuito, cujas mensagens diárias também cobrem a geração de imagens. Quem precisar de mais utilização pode consultar os planos e preços.",
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

const stepStyle = {
  ...paragraphStyle,
  margin: "0 0 10px",
} as const;

export default function GerarImagensIaPage() {
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
          Imagens com IA
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
          Criar e editar imagens com IA em português
        </h1>
        <p style={{ ...paragraphStyle, color: "#d0ccd8", fontSize: 18 }}>
          Descreve a tua ideia em português e a AKIRA cria a imagem. É o gerador de imagens com IA da
          SoftEdge Corporation: pensado para quem fala português e quer ver as suas ideias nascerem
          sem sair da própria língua.
        </p>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Como funciona a geração de imagens na AKIRA?</h2>
          <p style={stepStyle}>1. Abre uma conversa e ativa o modo de imagem, ou pede uma imagem numa frase normal.</p>
          <p style={stepStyle}>2. Descreve o que queres ver — cena, personagem, ambiente — e o estilo que preferes.</p>
          <p style={stepStyle}>3. A AKIRA cria a imagem e tu podes pedir ajustes ou uma nova versão a partir dela.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Estilos disponíveis</h2>
          <ul style={listStyle}>
            <li>Foto realista</li>
            <li>Anime</li>
            <li>Ilustração</li>
            <li>3D</li>
            <li>Cinematográfico</li>
            <li>Aquarela</li>
          </ul>
          <p style={paragraphStyle}>
            Para além dos estilos, podes orientar o resultado com detalhes: cores, luz, angolo,
            ambiente e o que mais quiseres na tua descrição.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Editar imagens e usar referências</h2>
          <p style={paragraphStyle}>
            A criação não para na primeira imagem: podes pedir à AKIRA para{" "}
            <strong style={{ color: "#d0ccd8" }}>editar a imagem que gerou</strong> com novas
            instruções ou enviar uma{" "}
            <strong style={{ color: "#d0ccd8" }}>imagem como referência</strong> para criar uma nova
            versão a partir dela. É útil para logos, conceitos de produto, cenários para projectos e
            exploração criativa.
          </p>
          <p style={paragraphStyle}>
            Se um resultado não sair como esperavas, basta reformular o pedido — a AKIRA diz-te
            claramente quando um pedido não foi gerado, em vez de mostrar algo diferente do que
            pediste.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Quanto custa criar imagens com IA?</h2>
          <p style={paragraphStyle}>
            Podes começar sem pagar: o{" "}
            <Link href="/login" style={linkStyle}>
              plano gratuito
            </Link>{" "}
            da AKIRA dá mensagens todos os dias e a criação e edição de imagens usa essa quota.
            Quem precisar de mais utilização tem os{" "}
            <Link href="/plans" style={linkStyle}>
              planos e preços
            </Link>{" "}
            da AKIRA, com limites maiores pensados para Angola e para o mundo.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Perguntas frequentes</h2>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Como criar imagens com IA na AKIRA?</h3>
          <p style={paragraphStyle}>
            Escreves a tua ideia em português no chat da AKIRA e a assistente cria a imagem. Também
            podes ativar o modo de imagem para descrever o que queres gerar.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Que estilos posso usar nas imagens da AKIRA?</h3>
          <p style={paragraphStyle}>
            Podes pedir estilos como foto realista, anime, ilustração, 3D, cinematográfico e aquarela
            — basta mencionar o estilo na descrição.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Posso editar uma imagem que já gerei?</h3>
          <p style={paragraphStyle}>
            Sim. Podes pedir à AKIRA para editar a imagem que gerou com novas instruções, ou enviar
            uma imagem como referência para criar uma nova a partir dela.
          </p>

          <h3 style={{ ...headingStyle, fontSize: 18, marginTop: 24 }}>Criar imagens com IA é gratuito na AKIRA?</h3>
          <p style={paragraphStyle}>
            Sim, é possível começar com o plano gratuito, cujas mensagens diárias também cobrem a
            geração de imagens. Quem precisar de mais utilização pode consultar os{" "}
            <Link href="/plans" style={linkStyle}>
              planos e preços
            </Link>
            .
          </p>
        </section>

        <footer style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.09)", color: "#77747e", fontSize: 13 }}>
          Um produto da SoftEdge Corporation, Angola. Co-fundador e CEO: Isaac Quarenta.
        </footer>
      </article>
    </main>
  );
}
