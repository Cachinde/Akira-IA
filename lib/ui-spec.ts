import type { RenderSpec } from "@/components/ui-registry";

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "spec"; spec: RenderSpec };

export type UiSpecSegmentPayload =
  | { text: string }
  | { spec: RenderSpec };

// Aceita :::ui {json} ::: (inline ou multiline) e ```ui|ui-spec ... ```
export const UI_SPEC_PATTERN = /:::ui\s*([\s\S]*?)\s*:::|```(?:ui|ui-spec)\s*\n?([\s\S]*?)```/g;

const COMPONENT_KEYS = new Set([
  "Card",
  "Metric",
  "Steps",
  "ResultCard",
  "Table",
  "KeyValue",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringMatrix(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((row) => isStringArray(row));
}

function isMetricProps(props: unknown): boolean {
  return (
    isRecord(props) &&
    typeof props.label === "string" &&
    typeof props.value === "string" &&
    (props.trend === undefined || typeof props.trend === "string")
  );
}

function validateSpecComponent(component: string, props: unknown): boolean {
  if (!isRecord(props)) return false;
  switch (component) {
    case "Card":
      return true;
    case "Metric":
      return isMetricProps(props);
    case "Steps":
      return (
        Array.isArray(props.items) &&
        props.items.every((item) =>
          isRecord(item) &&
          typeof item.title === "string" &&
          (item.detail === undefined || typeof item.detail === "string"),
        )
      );
    case "ResultCard":
      return (
        typeof props.title === "string" &&
        (props.subtitle === undefined || typeof props.subtitle === "string") &&
        (props.description === undefined || typeof props.description === "string") &&
        (props.url === undefined || typeof props.url === "string")
      );
    case "Table":
      return isStringArray(props.columns) && isStringMatrix(props.rows);
    case "KeyValue":
      return (
        Array.isArray(props.items) &&
        props.items.every((item) =>
          isRecord(item) && typeof item.label === "string" && typeof item.value === "string",
        )
      );
    default:
      return false;
  }
}

export function isValidSpec(value: unknown): value is RenderSpec {
  if (!isRecord(value)) return false;
  const component = value.component;
  if (typeof component !== "string" || !COMPONENT_KEYS.has(component)) return false;
  return validateSpecComponent(component, value.props);
}

export function parseSpecFromBlock(raw: string): RenderSpec | null {
  const value = parseSpecJson(raw.trim());
  return isValidSpec(value) ? value : null;
}

// Converte um payload {ui_spec_segments: [{text|spec}...]} do backend em segmentos.
// Qualquer item inválido é descartado (fail-safe); sem itens válidos → null.
export function parseUiSpecSegmentsPayload(value: unknown): UiSpecSegmentPayload[] | null {
  if (!Array.isArray(value)) return null;
  const items: UiSpecSegmentPayload[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.text === "string" && item.text.trim()) {
      items.push({ text: item.text });
      continue;
    }
    if (isRecord(item.spec) && isValidSpecFromLoose(item.spec)) {
      items.push({ spec: item.spec as unknown as RenderSpec });
    }
  }
  return items.length > 0 ? items : null;
}

function isValidSpecFromLoose(spec: Record<string, unknown>): boolean {
  const component = spec.component;
  if (typeof component !== "string" || !COMPONENT_KEYS.has(component)) return false;
  return validateSpecComponent(component, spec.props);
}

// Repara JSON quebrado do modelo (aspas internas sem escape, ex:
// "title": "não "aprender" com as conversas"). Máquina de estados: uma aspa
// só fecha a string se a seguir vier , : } ] — caso contrário é aspa interna.
export function repairSpecJson(raw: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\" && inString && i + 1 < raw.length) {
      out += ch + raw[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        out += ch;
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j += 1;
      const next = raw[j] ?? "";
      if (next === "," || next === ":" || next === "}" || next === "]") {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function parseSpecJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(repairSpecJson(raw));
    } catch {
      return null;
    }
  }
}

// Especificação única para a tabela do payload legado ({ui_spec: {...}}).
export function parseLegacyUiSpec(value: unknown): RenderSpec | null {
  if (!isRecord(value)) return null;
  const candidate = value.uiSpec ?? value.ui_spec ?? value;
  if (!isRecord(candidate)) return null;
  if (candidate.component !== "Table") return null;
  const props = candidate.props;
  if (!isRecord(props) || !isStringArray(props.columns) || !isStringMatrix(props.rows)) return null;
  return {
    component: "Table",
    props: { columns: props.columns, rows: props.rows },
  };
}

function markdownTableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return body
    .split("|")
    .map((cell) => cell.replace(/\*\*/g, "").replace(/`/g, "").trim().replace(/\s+/g, " "));
}

export function replaceMarkdownTableWithUiSpec(content: string, spec: RenderSpec): string {
  if (spec.component !== "Table") return content;
  const props = spec.props as { columns: string[]; rows: string[][] };
  const lines = content.split(/\r?\n/);
  const matches = (line: string, cells: string[]) => {
    const parsed = markdownTableCells(line);
    return parsed?.length === cells.length && parsed.every((cell, index) => cell === cells[index]);
  };
  for (let start = 0; start + props.rows.length + 1 < lines.length; start += 1) {
    if (!matches(lines[start], props.columns)) continue;
    const separator = markdownTableCells(lines[start + 1]);
    if (
      !separator ||
      separator.length !== props.columns.length ||
      !separator.every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      continue;
    }
    const rowsMatch = props.rows.every((row, index) =>
      matches(lines[start + index + 2], row),
    );
    if (!rowsMatch) continue;
    const marker = `:::ui\n${JSON.stringify(spec)}\n:::`;
    lines.splice(start, props.rows.length + 2, marker);
    return lines.join("\n");
  }
  return content;
}

export function parseUiSpecBlocks(content: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let hadSpec = false;
  UI_SPEC_PATTERN.lastIndex = 0;
  let match = UI_SPEC_PATTERN.exec(content);
  while (match) {
    const before = content.slice(cursor, match.index).trim();
    if (before) segments.push({ kind: "text", text: before });
    const raw = (match[1] ?? match[2] ?? "").trim();
    const spec = parseSpecFromBlock(raw);
    if (spec) {
      segments.push({ kind: "spec", spec });
      hadSpec = true;
    } else if (match[0]) {
      segments.push({ kind: "text", text: match[0] });
    }
    cursor = UI_SPEC_PATTERN.lastIndex;
    match = UI_SPEC_PATTERN.exec(content);
  }
  if (!hadSpec) return [{ kind: "text", text: content }];
  const tail = content.slice(cursor).trim();
  if (tail) segments.push({ kind: "text", text: tail });
  return segments;
}
