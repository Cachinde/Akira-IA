import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { uiRegistry, type RenderSpec } from "@/components/ui-registry";
import {
  parseUiSpecBlocks,
  parseUiSpecSegmentsPayload,
  parseLegacyUiSpec,
  replaceMarkdownTableWithUiSpec,
  type Segment,
  type UiSpecSegmentPayload,
} from "@/lib/ui-spec";

function segmentsFromPayload(payload: unknown): Segment[] | null {
  const items = parseUiSpecSegmentsPayload(payload);
  if (!items) return null;
  return items.map((item): Segment =>
    "spec" in item ? { kind: "spec", spec: item.spec } : { kind: "text", text: item.text },
  );
}

function segmentsFromContent(content: string, uiSpec: unknown): Segment[] {
  const legacy = parseLegacyUiSpec(uiSpec);
  const displayContent = legacy ? replaceMarkdownTableWithUiSpec(content, legacy) : content;
  return parseUiSpecBlocks(displayContent);
}

function TextSegment({ text }: { text: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function SpecSegment({ spec }: { spec: RenderSpec }) {
  const Component = uiRegistry[spec.component as keyof typeof uiRegistry];
  if (!Component) {
    const fallback = spec.props && typeof (spec.props as Record<string, unknown>).content === "string"
      ? String((spec.props as Record<string, unknown>).content)
      : "";
    return <TextSegment text={fallback} />;
  }
  if (spec.component === "Card") {
    return <Component props={spec.props} />;
  }
  return <Component {...(spec.props as Record<string, unknown>)} />;
}

type Props = {
  content: string;
  uiSpec?: unknown;
  uiSpecSegments?: unknown;
  className?: string;
};

export function AkiraMessageRenderer({ content, uiSpec, uiSpecSegments, className }: Props) {
  const segs = segmentsFromPayload(uiSpecSegments) ?? segmentsFromContent(content, uiSpec);
  if (!Array.isArray(segs)) return null;
  const hasSpec = segs.some((segment) => segment.kind === "spec");
  if (!hasSpec) {
    const text = segs.map((segment) => ("spec" in segment ? "" : segment.text)).join("\n\n").trim();
    return (
      <div className={`akira-message-renderer${className ? ` ${className}` : ""}`}>
        <TextSegment text={text} />
      </div>
    );
  }
  return (
    <div className={`akira-message-renderer${className ? ` ${className}` : ""}`}>
      {segs.map((segment, segmentIndex) =>
        segment.kind === "text" ? (
          <TextSegment key={segmentIndex} text={segment.text} />
        ) : (
          <SpecSegment key={segmentIndex} spec={segment.spec} />
        ),
      )}
    </div>
  );
}

export default AkiraMessageRenderer;
export type { UiSpecSegmentPayload };
