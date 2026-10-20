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
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: String(props?.content ?? "") }} />
    </div>
  ) as any,
  Metric: ({ label, value, trend }: MetricProps) => (
    <div className="inline-flex flex-col items-start gap-1 rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {trend && <span className={`text-xs ${trend.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{trend}</span>}
    </div>
  ) as any,
  Steps: ({ items = [] }: { items: Step[] }) => (
    <ol className="flex flex-col gap-4">
      {items.map((step, index) => (
        <li key={index} className="relative pl-6">
          <span className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {index + 1}
          </span>
          <div>
            <p className="font-medium">{step.title}</p>
            {step.detail && <p className="text-sm text-muted-foreground">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  ) as any,
  ResultCard: ({ title, subtitle, description, url }: Result) => (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      {description && <p className="text-sm">{description}</p>}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline decoration-muted"
        >
          Ver detalhes
        </a>
      )}
    </div>
  ) as any,
};

export type { RenderSpec };
export const uiRegistry = REGISTRY;
export default REGISTRY;
