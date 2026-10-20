import { NextRequest, NextResponse } from "next/server";
import { evaluateExpression, formatComputeValue } from "@/lib/compute";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido de cálculo não contém JSON válido." }, { status: 400 });
  }
  const expression = body && typeof body === "object" && "expression" in body ? (body as { expression: unknown }).expression : null;
  if (typeof expression !== "string" || !expression.trim() || expression.length > 240) {
    return NextResponse.json({ error: "Envia uma expressão de cálculo válida de até 240 caracteres." }, { status: 400 });
  }

  const result = evaluateExpression(expression);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({
    expression: result.expression,
    value: result.value,
    formatted: formatComputeValue(result.value),
  });
}
