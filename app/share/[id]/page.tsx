import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Logo from "@/components/Logo";
import { loadSharedMessage, type SharedMessage } from "@/lib/billing";
import { parseUiSpecBlocks, UiSpecSegment, type MessageSegment } from "@/app/page";
import { getPublicSiteUrl } from "@/lib/site-url";
import { uiRegistry } from "@/components/ui-registry";
import { parseUiSpecBlocks, type MessageSegment } from "@/app/page";

type Props = { params: Promise<{ id: string }> };

async function sharedContent(params: Props["params"]): Promise<SharedMessage | null> {
  const { id } = await params;
  return loadSharedMessage(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const content = await sharedContent(params);
  if (!content) return { title: "Partilha indisponível", robots: { index: false, follow: false } };
  const { id } = await params;
  const siteUrl = getPublicSiteUrl();
  const pageUrl = new URL(`/share/${encodeURIComponent(id)}`, siteUrl).toString();
  const description = [content.question, content.answer].filter(Boolean).join(" — ").replace(/\s+/g, " ").slice(0, 180);
  const image = content.image
    ? new URL(`/api/share/${encodeURIComponent(id)}/image`, siteUrl).toString()
    : new URL("/akira-share-v2.png", siteUrl).toString();
  return {
    title: "Resposta partilhada",
    description,
    alternates: { canonical: pageUrl },
    robots: { index: false, follow: false },
    openGraph: {
      type: "article",
      url: pageUrl,
      siteName: "AKIRA",
      title: "Uma resposta da AKIRA",
      description,
      images: [
        {
          url: image,
          secureUrl: image,
          width: content.image ? 1024 : 1200,
          height: content.image ? 1024 : 630,
          alt: content.image ? "Imagem partilhada da AKIRA" : "AKIRA — Assistente inteligente",
        },
      ],
    },
    twitter: { card: "summary_large_image", title: "Uma resposta da AKIRA", description, images: [image] },
  };
}

export default async function SharedMessagePage({ params }: Props) {
  const { id } = await params;
  const content = await loadSharedMessage(id);

  // Parse UI specs from answer
  const answerSegments = parseUiSpecBlocks(content.answer ?? "");

  return (
    <main className="share-page">
      <header className="share-header">
        <Link href="/" className="share-brand"><Logo size={34} /> AKIRA</Link>
        <Link className="share-open" href="/">Conversar com a AKIRA</Link>
      </header>
      <article className="share-card">
        {content ? (
          <>
            <div className="share-byline"><Logo size={27} /><span>Conversa partilhada da AKIRA</span></div>
            {content.question && (
              <section className="share-question">
                <div className="share-section-label">MENSAGEM ORIGINAL</div>
                <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content.question}</ReactMarkdown></div>
              </section>
            )}
            <section className="share-answer">
              <div className="share-section-label"><Logo size={20} /> RESPOSTA DA AKIRA</div>
              {content.image && (
                <img
                  className="share-image"
                  src={`/api/share/${encodeURIComponent(id)}/image`}
                  alt="Imagem partilhada da AKIRA"
                  loading="eager"
                  decoding="async"
                />
              }
              {answerSegments.map((segment, idx) => {
                if (segment.kind === "text") {
                  return <div className="markdown-content" key={idx}><ReactMarkdown remarkPlugins={[remarkGfm]}>{segment.text}</ReactMarkdown></div>;
                }
                if (segment.kind === "spec" && segment.spec) {
                  const Component = uiRegistry[segment.spec.component as keyof typeof uiRegistry];
                  if (Component) {
                    return <Component key={idx} {...(segment.spec.props as Record<string, unknown>)} />;
                  }
                }
                return null;
              })}
            </section>
          </>
        ) : (
          <div className="share-missing">
            <Logo size={54} />
            <h1>Esta partilha já não está disponível</h1>
            <p>O link pode ter expirado ou estar incorreto.</p>
            <Link className="share-open" href="/">Começar uma conversa</Link>
          </div>
        )}
      </article>
      <footer className="share-footer">Qualquer pessoa com este link pode ver a mensagem e a resposta partilhadas. A partilha expira ao fim de 90 dias.</footer>
    </main>
  );
}