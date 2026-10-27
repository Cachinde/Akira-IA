import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Card/Os cartões dos cards aceitam Markdown simples (bold, listas, links) —
// estilo ChatGPT: conteúdo do card NUNCA mostra sintaxe crua (ex: **texto**).
function MiniMarkdown({ text }: { text: unknown }) {
  const value = typeof text === "string" ? text : "";
  if (!value.trim()) return null;
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}

// Inline: markdown SEM bloco de parágrafo (para títulos, labels, descrições
// curtas). Resolve ***bold+itálico***, **bold** e `código` sem mostrar os asteriscos.
function MiniInline({ text }: { text: unknown }) {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ p: (props: any) => <>{props.children}</> }}
    >
      {value}
    </ReactMarkdown>
  );
}

// Campos que devem ficar 100% limpos (labels de métrica, colunas de tabela):
// remove marcadores de markdown em vez de os renderizar.
function stripInlineMarkup(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "");
}

type MetricProps = { label: string; value: string; trend?: string };
type Step = { title: string; detail?: string };
type Result = { title: string; subtitle?: string; description?: string; url?: string };
type TableProps = { columns: string[]; rows: string[][] };
type KeyValueItem = { label: string; value: string };

type RenderSpec =
  | { component: "Card"; props: Record<string, unknown> }
  | { component: "Metric"; props: MetricProps }
  | { component: "Steps"; props: { items: Step[] } }
  | { component: "ResultCard"; props: Result }
  | { component: "Table"; props: TableProps }
  | { component: "KeyValue"; props: { items: KeyValueItem[] } };

const REGISTRY: Record<RenderSpec["component"], React.ComponentType<any>> = {
  Card: ({ props }: any) => (
    <div className="ui-card">
      <div className="ui-card-content">
        <MiniMarkdown text={props?.content} />
        {props?.title && <p className="ui-card-title"><MiniInline text={String(props.title)} /></p>}
      </div>
    </div>
  ),
  Metric: ({ label, value, trend }: MetricProps) => (
    <div className="ui-metric-card">
      <span className="ui-metric-label">{stripInlineMarkup(String(label ?? ""))}</span>
      <span className="ui-metric-value">{stripInlineMarkup(String(value ?? ""))}</span>
      {trend && <span className={`ui-metric-trend ${trend.startsWith("+") ? "is-up" : "is-down"}`}>{stripInlineMarkup(trend)}</span>}
    </div>
  ),
  Steps: ({ items = [] }: { items: Step[] }) => (
    <ol className="ui-steps">
      {items.map((step, index) => (
        <li key={index} className="ui-step">
          <span className="ui-step-num">{index + 1}</span>
          <div className="ui-step-body">
            <p className="ui-step-title"><MiniInline text={step.title} /></p>
            {step.detail && <div className="ui-step-detail"><MiniMarkdown text={step.detail} /></div>}
          </div>
        </li>
      ))}
    </ol>
  ),
  ResultCard: ({ title, subtitle, description, url }: Result) => (
    <div className="ui-result-card">
      <h3 className="ui-result-card-title"><MiniInline text={title} /></h3>
      {subtitle && <p className="ui-result-card-subtitle"><MiniInline text={subtitle} /></p>}
      {description && <p className="ui-result-card-desc"><MiniInline text={description} /></p>}
      {url && <a href={String(url)} target="_blank" rel="noopener noreferrer" className="ui-result-card-link">Ver detalhes</a>}
    </div>
  ),
  Table: ({ columns, rows }: TableProps) => (
    <div className="ui-table-wrap" role="region" aria-label="Tabela de resposta" tabIndex={0}>
      <table className="ui-table">
        <thead>
          <tr>{columns.map((column, index) => <th key={index} scope="col">{stripInlineMarkup(String(column ?? ""))}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((_, columnIndex) => (
                <td key={columnIndex}><MiniInline text={String(row[columnIndex] ?? "")} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
  KeyValue: ({ items = [] }: { items: KeyValueItem[] }) => (
    <dl className="ui-key-value">
      {items.map((item, index) => (
        <div key={index} className="ui-key-value-row">
          <dt><MiniInline text={item.label} /></dt>
          <dd><MiniInline text={item.value} /></dd>
        </div>
      ))}
    </dl>
  ),
};


export type { RenderSpec };
export const uiRegistry = REGISTRY;
export default REGISTRY;
