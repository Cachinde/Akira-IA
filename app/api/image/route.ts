import { NextRequest, NextResponse } from "next/server";
import { apiImage, apiDescribe } from "@/lib/space";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "O pedido tem de ser um objeto JSON." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  try {
    if (typeof input.imageB64 === "string") {
      if (!input.imageB64.startsWith("data:image/") || input.imageB64.length > 11_000_000) {
        return NextResponse.json({ error: "Anexa uma imagem válida com menos de 8 MB." }, { status: 413 });
      }

      return NextResponse.json({
        description: await apiDescribe(
          input.imageB64,
          typeof input.prompt === "string" ? input.prompt : undefined,
        ),
      });
    }

    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "Escreve uma descrição para a imagem." }, { status: 400 });
    if (prompt.length > 1_000) {
      return NextResponse.json({ error: "A descrição excede o limite de 1.000 caracteres." }, { status: 413 });
    }

    return NextResponse.json(await apiImage(prompt));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "O pedido de imagem à AKIRA falhou.";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
