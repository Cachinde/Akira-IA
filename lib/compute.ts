export type ComputeResult =
  | { ok: true; expression: string; value: number }
  | { ok: false; error: string };

const MAX_EXPRESSION_LENGTH = 220;

type Token =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "op"; value: string }
  | { kind: "open" }
  | { kind: "close" }
  | { kind: "comma" };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  floor: Math.floor,
  ceil: Math.ceil,
  pow: (base, exponent) => Math.pow(base, exponent),
  min: (...xs) => Math.min(...xs),
  max: (...xs) => Math.max(...xs),
  sum: (...xs) => xs.reduce((total, x) => total + x, 0),
  count: (...xs) => xs.length,
  round: (x, digits = 0) => {
    const places = Math.min(Math.max(Math.trunc(digits), 0), 10);
    const factor = Math.pow(10, places);
    return Math.round(x * factor) / factor;
  },
  mean: (...xs) => {
    if (!xs.length) throw new Error("A média precisa de pelo menos um número.");
    return xs.reduce((total, x) => total + x, 0) / xs.length;
  },
  median: (...xs) => {
    if (!xs.length) throw new Error("A mediana precisa de pelo menos um número.");
    const ordered = [...xs].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 === 1
      ? ordered[middle]
      : (ordered[middle - 1] + ordered[middle]) / 2;
  },
  stdev: (...xs) => {
    if (xs.length < 2) throw new Error("O desvio padrão precisa de pelo menos dois números.");
    const average = xs.reduce((total, x) => total + x, 0) / xs.length;
    const variance = xs.reduce((total, x) => total + (x - average) ** 2, 0) / (xs.length - 1);
    return Math.sqrt(variance);
  },
};

const SINGLE_NUMBER_FUNCTIONS = new Set(["abs", "sqrt", "cbrt", "floor", "ceil"]);

const LEADING_COMMANDS = [
  /^\s*por\s+favou?r(?=[\s,;:!?]|$)[\s,:]+\s*/i,
  /^\s*quanto\s+d[áa](?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*quanto\s+(?:é|eh|vale|fica)(?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*qual\s+(?:é|eh)(?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*qual\s+(?:o\s+valor|a\s+resposta)(?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*diz-me\s+(?:quanto\s+)?(?:é|eh|vale)(?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*calcul\w*(?=[\s,;:!?]|$)[\s,:]+\s*/i,
  /^\s*comput\w*(?=[\s,;:!?]|$)[\s,:]+\s*/i,
  /^\s*resolv\w*(?=[\s,;:!?]|$)[\s,:]+\s*/i,
  /^\s*quero\s+saber\s+quanto\s+(?:é|eh|vale)(?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*explica-?me[\s,:]+\s*/i,
  /^\s*o\s+(?:valor|resultado)\s+(?:é|eh)(?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*o\s+(?:valor|resultado)\s+de\b[\s,:]*\s*/i,
  /^\s*a\s+(?:resposta|conta)\s+(?:\u00e9|eh)(?=[\s,;:!?]|$)[\s,:]*\s*/i,
  /^\s*de\s+/i,
];

function stripLeadingCommands(text: string): string {
  let current = text;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    let changed = false;
    for (const pattern of LEADING_COMMANDS) {
      const next = current.replace(pattern, "");
      if (next !== current) {
        current = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return current.trim();
}

function prepareExpression(raw: string): string | null {
  if (!raw || raw.length > MAX_EXPRESSION_LENGTH) return null;

  let text = raw
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[×✕]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/−/g, "-")
    .replace(/[\s!?.;]+$/g, "")
    .trim();
  if (!text) return null;

  text = stripLeadingCommands(text);
  if (!text) return null;

  text = text
    .replace(/raiz\s*c[úu]bica\b\s*(?:de\b)?\s*/gi, "cbrt ")
    .replace(/raiz\s*(?:quadrada\b)?\s*(?:de\b)?\s*/gi, "sqrt ")
    .replace(/\bm[ée]dia\b/gi, "mean")
    .replace(/\bmediana\b/gi, "median")
    .replace(/\bdesvio[\s-]*(?:padr[ãa]o\b)?/gi, "stdev")
    .replace(/\bsoma\b/gi, "sum")
    .replace(/\bm[íi]nimo\b/gi, "min")
    .replace(/\bm[áa]ximo\b/gi, "max")
    .replace(/\bsqrt\b/gi, "sqrt")
    .replace(/\s+x\s+/gi, " * ")
    .replace(/(\d+(?:[.,]\d+)?)\s*%\s*de\s*/g, "($1/100)*");

  const hasFunctionCall = /\b(sqrt|cbrt|mean|median|stdev|sum|count|min|max|abs|floor|ceil|pow|round)\b/.test(text);
  if (hasFunctionCall) {
    text = text
      .replace(/\b(?:a|o|um)(?:a)?\s+(?=(?:sqrt|cbrt|mean|median|stdev|sum|count|min|max)\b)/gi, "")
      .replace(/\b(sqrt|cbrt|mean|median|stdev|sum|count|min|max)\s*(?:de\s*)?((?:[0-9][0-9.,\s]*)(?:\s+e\s+[0-9][0-9.,\s]*)*)$/i,
        (_match, name: string, numbers: string) => {
          const args = numbers
            .split(/\s+e\s+|[\s,]+/)
            .filter(Boolean)
            .join(",");
          return `${name.toLowerCase()}(${args})`;
        });
  } else {
    text = text.replace(/(\d),(\d)/g, "$1.$2");
  }

  text = text.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");
  text = text.trim();
  return text || null;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/[0-9]/.test(character)) {
      const match = /^\d+(?:\.\d+)?/.exec(text.slice(index));
      if (!match) return [];
      tokens.push({ kind: "number", value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    if (/[a-z]/i.test(character)) {
      const match = /^[a-z]+/i.exec(text.slice(index));
      if (!match) return [];
      tokens.push({ kind: "name", value: match[0].toLowerCase() });
      index += match[0].length;
      continue;
    }
    if ("+-*/%^".includes(character)) {
      tokens.push({ kind: "op", value: character });
      index += 1;
      continue;
    }
    if (character === "(") {
      tokens.push({ kind: "open" });
      index += 1;
      continue;
    }
    if (character === ")") {
      tokens.push({ kind: "close" });
      index += 1;
      continue;
    }
    if (character === ",") {
      tokens.push({ kind: "comma" });
      index += 1;
      continue;
    }
    return [];
  }
  return tokens;
}

class Parser {
  readonly tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): number {
    const value = this.parseExpression();
    if (this.position !== this.tokens.length) {
      throw new Error("A expressão de cálculo está mal formada.");
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private consume(): Token {
    const token = this.tokens[this.position];
    if (!token) throw new Error("A expressão de cálculo está incompleta.");
    this.position += 1;
    return token;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "op" || (token.value !== "+" && token.value !== "-")) break;
      const op = this.consume() as { kind: "op"; value: string };
      const right = this.parseTerm();
      value = op.value === "+" ? value + right : value - right;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "op" || !["*", "/", "%"].includes(token.value)) break;
      const op = this.consume() as { kind: "op"; value: string };
      const right = this.parseUnary();
      if (op.value === "/") {
        if (right === 0) throw new Error("Não é possível dividir por zero.");
        value /= right;
      } else if (op.value === "%") {
        if (right === 0) throw new Error("Não é possível dividir por zero.");
        value %= right;
      } else {
        value *= right;
      }
    }
    return value;
  }

  private parseUnary(): number {
    const token = this.peek();
    if (token && token.kind === "op" && (token.value === "+" || token.value === "-")) {
      this.consume();
      return token.value === "+" ? this.parseUnary() : -this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): number {
    const base = this.parsePrimary();
    const token = this.peek();
    if (token && token.kind === "op" && token.value === "^") {
      this.consume();
      return Math.pow(base, this.parseUnary());
    }
    return base;
  }

  private parsePrimary(): number {
    const token = this.consume();
    if (token.kind === "number") return token.value;
    if (token.kind === "open") {
      const value = this.parseExpression();
      const closing = this.consume();
      if (closing.kind !== "close") throw new Error("A expressão de cálculo tem parênteses mal fechados.");
      return value;
    }
    if (token.kind === "name") {
      const next = this.peek();
      if (!next || next.kind !== "open") {
        throw new Error("As funções precisam de argumentos entre parênteses.");
      }
      this.consume();
      const args: number[] = [];
      if (this.peek() && this.peek()!.kind === "close") {
        this.consume();
        args.push(0);
        return this.applyFunction(token.value, args);
      }
      args.push(this.parseExpression());
      while (this.peek() && this.peek()!.kind === "comma") {
        this.consume();
        args.push(this.parseExpression());
      }
      const closing = this.consume();
      if (closing.kind !== "close") throw new Error("A expressão de cálculo tem parênteses mal fechados.");
      return this.applyFunction(token.value, args);
    }
    throw new Error("A expressão de cálculo não é suportada.");
  }

  private applyFunction(name: string, args: number[]): number {
    const fn = FUNCTIONS[name];
    if (!fn) throw new Error("A função de cálculo não é suportada.");
    if (SINGLE_NUMBER_FUNCTIONS.has(name) && args.length !== 1) {
      throw new Error("A função de cálculo precisa de exatamente um número.");
    }
    if (args.some((arg) => !Number.isFinite(arg))) {
      throw new Error("A expressão de cálculo não é suportada.");
    }
    return fn(...args);
  }
}

export function evaluateExpression(raw: string): ComputeResult {
  const prepared = prepareExpression(raw);
  if (!prepared) {
    return { ok: false, error: "Envia uma expressão de cálculo válida de até 220 caracteres." };
  }
  const tokens = tokenize(prepared);
  if (!tokens.length) {
    return { ok: false, error: "A expressão de cálculo não é suportada." };
  }
  try {
    const value = new Parser(tokens).parse();
    if (!Number.isFinite(value)) {
      return { ok: false, error: "O resultado do cálculo não é um número finito." };
    }
    return { ok: true, expression: prepared, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "A expressão de cálculo não é suportada." };
  }
}

export function formatComputeValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
}
