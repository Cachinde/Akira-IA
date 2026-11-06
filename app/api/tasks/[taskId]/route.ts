import { NextRequest, NextResponse } from "next/server";
import { billingPool } from "@/lib/billing";
import {
  attachPersistentUserCookie,
  getPersistentUser,
  persistentScopeMatches,
} from "@/lib/persistent-user";

export const runtime = "nodejs";

const TASK_ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ taskId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  if (!TASK_ID_PATTERN.test(taskId)) {
    return NextResponse.json({ error: "O identificador da tarefa é inválido." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).done !== "boolean") {
    return NextResponse.json({ error: "O estado da tarefa é inválido." }, { status: 400 });
  }

  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega as tarefas antes de continuar." }, { status: 403 });
    }
    const result = await billingPool().query<{
      task_id: string;
      title: string;
      done: boolean;
      created_at: Date;
    }>(
      `UPDATE akira_tasks SET done = $3
       WHERE user_id = $1 AND task_id = $2
       RETURNING task_id, title, done, created_at`,
      [identity.userId, taskId, (body as { done: boolean }).done],
    );
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: "A tarefa já não existe na tua conta." }, { status: 404 });
    }
    const response = NextResponse.json({
      task: {
        id: row.task_id,
        title: row.title,
        done: row.done,
        createdAt: new Date(row.created_at).toISOString(),
      },
    });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao atualizar tarefa na base de dados.", error);
    return NextResponse.json({ error: "Não foi possível atualizar a tarefa na base de dados." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  if (!TASK_ID_PATTERN.test(taskId)) {
    return NextResponse.json({ error: "O identificador da tarefa é inválido." }, { status: 400 });
  }
  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega as tarefas antes de continuar." }, { status: 403 });
    }
    const result = await billingPool().query(
      "DELETE FROM akira_tasks WHERE user_id = $1 AND task_id = $2",
      [identity.userId, taskId],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "A tarefa já não existe na tua conta." }, { status: 404 });
    }
    const response = NextResponse.json({ deleted: result.rowCount });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao apagar tarefa da base de dados.", error);
    return NextResponse.json({ error: "Não foi possível apagar a tarefa da base de dados." }, { status: 503 });
  }
}
