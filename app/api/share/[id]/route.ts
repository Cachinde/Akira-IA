import { NextRequest, NextResponse } from "next/server";
import { loadSharedMessage } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const shared = await loadSharedMessage(id);
    if (!shared) return NextResponse.json({ error: "Esta partilha não existe ou expirou." }, { status: 404 });
    return NextResponse.json(
      { content: shared.answer, question: shared.question },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    console.error("Falha ao carregar resposta partilhada.", error);
    return NextResponse.json({ error: "Não foi possível carregar esta partilha." }, { status: 503 });
  }
}
