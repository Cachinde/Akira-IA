import React from "react";

type MetricProps = { label: string; value: string; trend?: string };
type Step = { title: string; detail?: string };
type Result = { title: string; subtitle?: string; description?: string; url?: string };

interface RenderSpec {
  component: "Card" | "Metric" | "Steps" | "ResultCard";
  props: Record<string, unknown>;
}

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
};

export type { RenderSpec };
export const uiRegistry = REGISTRY;
export default REGISTRY;
