import React from "react";

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
      <div className="ui-card-content" dangerouslySetInnerHTML={{ __html: String(props?.content ?? "") }} />
    </div>
  ),
  Metric: ({ label, value, trend }: MetricProps) => (
    <div className="ui-metric-card">
      <span className="ui-metric-label">{label}</span>
      <span className="ui-metric-value">{value}</span>
      {trend && <span className={`ui-metric-trend ${trend.startsWith("+") ? "is-up" : "is-down"}`}>{trend}</span>}
    </div>
  ),
  Steps: ({ items = [] }: { items: Step[] }) => (
    <ol className="ui-steps">
      {items.map((step, index) => (
        <li key={index} className="ui-step">
          <span className="ui-step-num">{index + 1}</span>
          <div>
            <p className="ui-step-title">{step.title}</p>
            {step.detail && <p className="ui-step-detail">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  ),
  ResultCard: ({ title, subtitle, description, url }: Result) => (
    <div className="ui-result-card">
      <h3 className="ui-result-card-title">{title}</h3>
      {subtitle && <p className="ui-result-card-subtitle">{subtitle}</p>}
      {description && <p className="ui-result-card-desc">{description}</p>}
      {url && <a href={String(url)} target="_blank" rel="noopener noreferrer" className="ui-result-card-link">Ver detalhes</a>}
    </div>
  ),
  Table: ({ columns, rows }: TableProps) => (
    <div className="ui-table-wrap" role="region" aria-label="Tabela de resposta" tabIndex={0}>
      <table className="ui-table">
        <thead>
          <tr>{columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((_, columnIndex) => (
                <td key={columnIndex}>{row[columnIndex] ?? ""}</td>
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
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  ),
};


export type { RenderSpec };
export const uiRegistry = REGISTRY;
export default REGISTRY;
