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
