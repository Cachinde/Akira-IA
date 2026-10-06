import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { consumeUsage, getOrCreateUser, setUserCookie } from "@/lib/billing";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 50_000;
const ALLOWED_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "pdf", "docx"]);

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Seleciona um ficheiro para analisar." }, { status: 400 });
    const extension = file.name.split(".").pop()?.toLocaleLowerCase("en");
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: "Formatos suportados: TXT, Markdown, CSV, JSON, PDF e DOCX." }, { status: 415 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "O ficheiro tem de ter entre 1 byte e 8 MB." }, { status: 413 });
    }

    const identity = getOrCreateUser(request);
    const usage = await consumeUsage(identity.userId, "files");
    if (!usage.allowed) {
      return NextResponse.json(
        { error: `Atingiste o limite de ${usage.limit} ficheiros do plano ${usage.plan}.` },
        { status: 429 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;
    if (extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        if (result.total > 30) {
          return NextResponse.json({ error: "O PDF pode ter no máximo 30 páginas." }, { status: 413 });
        }
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    }

    const normalized = text.replace(/\u0000/g, "").trim();
    if (!normalized) return NextResponse.json({ error: "Não foi encontrado texto legível neste ficheiro." }, { status: 422 });
    if (normalized.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "O texto extraído ultrapassa o limite de 50.000 caracteres." }, { status: 413 });
    }
    const response = NextResponse.json({ name: file.name, text: normalized });
    if (identity.created) setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Falha ao ler um ficheiro enviado para a AKIRA.", error);
    return NextResponse.json({ error: "Não foi possível processar este ficheiro. Confirma o formato e tenta novamente." }, { status: 422 });
  }
}
