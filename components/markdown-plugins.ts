import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Plugins partilhados por TODOS os ReactMarkdown (mensagens, cards, steps,
// tabelas): GFM (tabelas/checklists) + matemática ($inline$ e $$bloco$$)
// renderizada com KaTeX. throwOnError=false → LaTeX a meio do streaming
// incompleto renderiza a vermelho em vez de rebentar o post.
export const remarkPlugins: any = [remarkGfm, remarkMath];

export const rehypePlugins: any = [
  [
    rehypeKatex,
    {
      throwOnError: false,
      errorColor: "#dc2626",
      strict: false,
      output: "html",
    },
  ],
];

/* ──────────────────────────────────────────────────────────────────────────
   FIX renderização de LaTeX (2026-10-28): a AKIRA devolve fórmulas em
   delimitadores estilo ChatGPT — \[ ... \] (display) e \( ... \) (inline).
   O remark-math só entende $...$ e $$...$$, por isso o LaTeX ficava cru
   (come com os escapes / "mostra \begin{pmatrix}"). Este normalizador:
     1. protege blocos de código (``` e `...`) — código nunca é matemática;
     2. \[ ... \]  →  $$ ... $$  (bloco próprio, porta do display);
     3. \( ... \)  →  $ ... $    (inline);
     4. repara \end{env} em falta (a AKIRA às vezes corta "\end{pmatrix}");
     5. devolve o código intacto. Idempotente: $...$ já-level não muda.
   ────────────────────────────────────────────────────────────────────────── */

// nó + parent info ----------------------------------------------------------
const CODE_TOKEN = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g;
const PLACEHOLDER = "\u0000MATHPLUGIN";
const MATH_SPLIT = /(\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g;
// \begin{env} tem de aparecer logo nos primeiros caracteres do [ ... ]
const BRACKET_MATH_ANCHOR = /^\\begin\{|^.{0,40}\\begin\{/;

function repairMissingEnvEnds(math: string): string {
  if (!math.includes("\\begin{")) return math;
  const envRe = /\\(begin|end)\{([A-Za-z*]+)\}/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = envRe.exec(math))) {
    if (match[1] === "begin") {
      stack.push(match[2]);
      continue;
    }
    // \end{env}: fecha a env correspondente mais próxima com esse nome; se
    // não houver, é um end "solto" — ignora (KaTeX trataria melhor assim).
    const nameIndex = stack.lastIndexOf(match[2]);
    if (nameIndex === stack.length - 1) stack.pop();
    else if (nameIndex !== -1) stack.length = nameIndex;
  }
  if (stack.length === 0) return math;
  let closing = "";
  for (let i = stack.length - 1; i >= 0; i -= 1) closing += `\\end{${stack[i]}}`;
  return math + closing;
}

function normalizeHardBreaks(math: string): string {
  return math.replace(/\r\n?/g, "\n");
}

// A AKIRA às vezes perde os delimitadores LaTeX no caminho (fica só
// "[ A = \begin{pmatrix} ... ]"). Resgata equações entre parêntesis retos
// quando há um \begin{env} LaTeX perto do início e evita links [texto](url).
function rescueBareBracketEquations(text: string): string {
  return text.split(MATH_SPLIT).map((chunk) => {
    if (chunk.startsWith("$$") || chunk.startsWith("$")) return chunk;
    if (!chunk.includes("\\begin{")) return chunk;
    return chunk.replace(
      /\[((?:\\.|[^\[\]])*?)\](?!\()/g,
      (match, content: string) => {
        // o LaTeX tem de começar nos primeiros caracteres depois do [ ]
        if (!BRACKET_MATH_ANCHOR.test(content) || content.length > 420) {
          return match;
        }
        return `\n\n$$\n${repairMissingEnvEnds(normalizeHardBreaks(content.trim()))}\n$$\n\n`;
      },
    );
  }).join("");
}

export function normalizeMath(raw: string): string {
  if (!raw) return raw;
  if (!raw.includes("\\[") && !raw.includes("\\(") && !raw.includes("\\begin{")) return raw;

  // 1. protege código grave/fenced (a matemática nunca vive dentro de código)
  const codeChunks: string[] = [];
  const skipped = raw.replace(CODE_TOKEN, (chunk) => {
    codeChunks.push(chunk);
    return `${PLACEHOLDER}${codeChunks.length - 1}${PLACEHOLDER}`;
  });

  // 2. display \[ ... \]  →  $$ ... $$ (linha própria: remark-math só cria
  //    math-display se o fence $$ estiver em posição de fluxo)
  let processed = skipped.replace(
    /\\\[((?:\\.|[^\\])*?)\\?\]/g,
    (_match, inner: string) =>
      `\n\n$$\n${repairMissingEnvEnds(normalizeHardBreaks(inner.trim()))}\n$$\n\n`,
  );

  // 3. inline \( ... \) → $ ... $
  processed = processed.replace(
    /\\\(((?:\\.|[^\\])*?)\\?\)/g,
    (_match, inner: string) => `$${repairMissingEnvEnds(normalizeHardBreaks(inner.trim()))}$`,
  );

  // 4. equação só entre [ ] sem \$ delimitadores (caso do upstream a cortar)
  processed = rescueBareBracketEquations(processed);

  // 5. restaura código
  return processed.replace(
    new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, "g"),
    (_match, index: string) => codeChunks[Number(index)] ?? "",
  );
}

// Texto pronto para o render: LaTeX normalizado + bold/itálico quebrado
// reparado (ordem: LaTeX antes, porque o repair não altera backslashes).
export function normalizeMessageMarkdown(raw: string): string {
  return normalizeMath(raw);
}
