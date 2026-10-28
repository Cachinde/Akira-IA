"use client";

import { Check, Copy } from "lucide-react";
import React, { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

/* ──────────────────────────────────────────────────────────────────────────
   Copia à la ChatGPT (2026-10-28): qualquer parte da resposta da AKIRA é
   copiável — bloco de código (com cabeçalho + botão), código inline,
   tabelas Markdown e blocos de texto (parágrafos, listas, exercícios).
   As funções aceitam o nó hast do react-markdown e reconstroem o Markdown
   original (o LaTeX dentro de células é recuperado da <annotation> do KaTeX).
   ────────────────────────────────────────────────────────────────────────── */

type ElementNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: unknown[];
};

export async function copyPlainText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // http inseguro (LAN/file) → caminho de recurso abaixo
  }
  try {
    const pane = document.createElement("textarea");
    pane.value = text;
    pane.setAttribute("readonly", "");
    pane.style.position = "fixed";
    pane.style.left = "-9999px";
    document.body.appendChild(pane);
    pane.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(pane);
    return ok;
  } catch {
    return false;
  }
}

// Texto cru de um nó hast: preserva ```código```, inlineCode, inlineMath e a
// <annotation> do KaTeX (que guarda o LaTeX a meio da renderização).
export function nodeRaw(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const element = node as ElementNode;
  if (typeof element.value === "string") return element.value;
  if (!Array.isArray(element.children)) return "";
  return element.children.map(nodeRaw).join("");
}

function elemText(node: unknown): string {
  return nodeRaw(node).replace(/\s+/g, " ").trim();
}

// Texto legível de um bloco (parágrafo/lista/bloco de citação).
export function nodePlainText(node: unknown): string {
  const element = node as ElementNode;
  if (!element || !Array.isArray(element.children)) return nodeRaw(node);
  const tag = element.tagName || "";
  if (tag === "li") {
    const nested = element.children.filter(
      (child) => (child as ElementNode)?.tagName === "ul" || (child as ElementNode)?.tagName === "ol",
    );
    const inlineOnly = element.children
      .filter((child) => (child as ElementNode)?.tagName !== "ul" && (child as ElementNode)?.tagName !== "ol")
      .map(nodeRaw)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    let text = inlineOnly ? `- ${inlineOnly}` : "";
    for (const child of nested) {
      const lines = nodePlainText(child)
        .split("\n")
        .filter(Boolean)
        .map((line, index) => (index === 0 ? `${text ? "" : "- "}${line}` : `  ${line}`));
      text += (text ? "\n" : "") + lines.join("\n");
    }
    return text;
  }
  if (tag === "ol") {
    return element.children
      .filter((child) => (child as ElementNode)?.tagName === "li")
      .map((child, index) => `${index + 1}. ${nodePlainText(child).replace(/^- /, "")}`)
      .join("\n");
  }
  if (tag === "blockquote") {
    return element.children
      .map((child) => nodePlainText(child).trim())
      .filter(Boolean)
      .map((line) => line.split("\n").map((part) => `> ${part}`).join("\n"))
      .join("\n\n");
  }
  const values = element.children.map(nodeRaw).join("").replace(/\s+/g, " ").trim();
  return values;
}

function cleanCell(value: string): string {
  return value.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
}

// Reconstrói a tabela original em Markdown (fácil de colar noutra IA).
export function tableMarkdown(node: unknown): string {
  const element = node as ElementNode;
  if (!element || !Array.isArray(element.children)) return "";
  const rowsOf = (parent: ElementNode | undefined): ElementNode[] =>
    (parent?.children || [])
      .filter((child) => (child as ElementNode)?.tagName === "tr")
      .map((child) => child as ElementNode);
  const cellsOf = (row: ElementNode): string[] =>
    (row.children || [])
      .filter((child) => (child as ElementNode)?.tagName === "th" || (child as ElementNode)?.tagName === "td")
      .map(elemText);
  const children = element.children as ElementNode[];
  const thead = children.find((child) => child?.tagName === "thead");
  const tbody = children.find((child) => child?.tagName === "tbody");
  const rows = [...rowsOf(thead), ...rowsOf(tbody), ...(thead || tbody ? [] : rowsOf(element))].map(cellsOf).filter((row) => row.length > 0);
  if (rows.length === 0) return "";
  const width = Math.max(1, ...rows.map((row) => row.length));
  const grid = rows.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded.map(cleanCell);
  });
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const separator = `| ${Array(width).fill("---").join(" | ")} |`;
  return [line(grid[0]), separator, ...grid.slice(1).map(line)].join("\n");
}

/* ── Botões ── */
type CopyChipProps = {
  getText: () => string;
  label?: string;
  className?: string;
  size?: number;
};

function ChipBase({ getText, label = "Copiar", className = "", size = 12 }: CopyChipProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);
  function onClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void (async () => {
      const ok = await copyPlainText(getText());
      if (ok) {
        setCopied(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1600);
      }
    })();
  }
  return (
    <button
      type="button"
      className={`md-copybtn ${copied ? "done" : ""} ${className}`.trim()}
      onClick={onClick}
      title={copied ? "Copiado" : label}
      aria-label={copied ? "Copiado" : label}
    >
      {copied ? <Check size={size} strokeWidth={2.4} /> : <Copy size={size} />}
    </button>
  );
}

export function CopyChip(props: CopyChipProps) {
  return <ChipBase {...props} />;
}
export const MarkdownCopy = CopyChip;

/* ── Blocos de código: cabeçalho + copiar ── */
function CodePre({ node, children }: { node?: ElementNode; children?: ReactNode }) {
  const codeElement = (node?.children || []).find(
    (child) => (child as ElementNode)?.tagName === "code",
  ) as ElementNode | undefined;
  if (!codeElement) return <pre>{children}</pre>;
  const classes = Array.isArray(codeElement.properties?.className)
    ? (codeElement.properties!.className as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  if (classes.includes("math-display")) return <pre>{children}</pre>;
  const language = classes.find((c) => c.startsWith("language-"))?.replace("language-", "") || "";
  const code = nodeRaw(codeElement).replace(/\n+$/, "");
  return (
    <div className="md-codeblock">
      <div className="md-codebar">
        <span className="md-codelang">{language || "código"}</span>
        <CopyChip getText={() => code} label="Copiar código" />
      </div>
      <pre>
        <code className={language ? `language-${language}` : ""}>{code}</code>
      </pre>
    </div>
  );
}

/* ── Código inline: ponto de cópia ao passar o rato ── */
function InlineCodeCopy({ node, children }: { node?: ElementNode; children?: ReactNode }) {
  const classes = Array.isArray(node?.properties?.className)
    ? (node!.properties!.className as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const isMath = classes.some((c) => c.includes("math-") || c === "language-math");
  if (isMath) return <code>{children}</code>;
  return (
    <span className="md-inlinecode">
      <code>{children}</code>
      <CopyChip getText={() => nodeRaw(node)} label="Copiar código inline" />
    </span>
  );
}

/* ── Tabela Markdown: copiar como Markdown ── */
function MarkdownTableCopy({ node, children }: { node?: ElementNode; children?: ReactNode }) {
  return (
    <div className="md-tablewrap">
      <table>{children}</table>
      <CopyChip className="md-copybtn-table" getText={() => tableMarkdown(node)} label="Copiar tabela" />
    </div>
  );
}

/* ── Parágrafos / listas / citações (exercícios): copiar ao passar o rato ── */
function CopyableBlock({
  node,
  children,
  tag,
}: {
  node?: ElementNode;
  children?: ReactNode;
  tag: string;
}) {
  const Tag = tag as "p";
  return (
    <div className="md-textblock">
      <Tag>{children}</Tag>
      <CopyChip getText={() => nodePlainText(node)} label="Copiar bloco" />
    </div>
  );
}

// Componentes partilhados por TODOS os ReactMarkdown de mensagens/carte de resposta.
export const mdCopyComponents: Record<string, React.ComponentType<any>> = {
  pre: CodePre,
  code: InlineCodeCopy,
  table: MarkdownTableCopy,
  p: (props: any) => <CopyableBlock {...props} tag="p" />,
  ul: (props: any) => <CopyableBlock {...props} tag="ul" />,
  ol: (props: any) => <CopyableBlock {...props} tag="ol" />,
  blockquote: (props: any) => <CopyableBlock {...props} tag="blockquote" />,
};
