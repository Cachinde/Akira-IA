import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { billingPool } from "@/lib/billing";
import {
  attachPersistentUserCookie,
  getPersistentUser,
  persistentScopeMatches,
} from "@/lib/persistent-user";

export const runtime = "nodejs";

const TASK_ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 120;
const MAX_MIGRATED_TASKS = 2_000;

type TaskInput = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

function parseTask(value: unknown): TaskInput | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !TASK_ID_PATTERN.test(value.id) ||
    typeof value.title !== "string" ||
    typeof value.done !== "boolean"
  ) {
    return null;
  }
  const title = cleanTitle(value.title);
  if (!title) return null;
  const createdAt =
    typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt))
      ? value.createdAt
      : new Date(0).toISOString();
  return { id: value.id, title, done: value.done, createdAt };
}

export async function GET(request: NextRequest) {
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
      `SELECT task_id, title, done, created_at
       FROM akira_tasks
       WHERE user_id = $1
       ORDER BY done ASC, created_at DESC`,
      [identity.userId],
    );
    const tasks = result.rows.map((row) => ({
      id: row.task_id,
      title: row.title,
      done: row.done,
      createdAt: new Date(row.created_at).toISOString(),
    }));
    const response = NextResponse.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao carregar as tarefas da base de dados.", error);
    return NextResponse.json({ error: "Não foi possível carregar as tarefas da tua conta." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }
  const title =
    isRecord(body) && typeof body.title === "string"
      ? cleanTitle(body.title)
      : "";
  if (!title) return NextResponse.json({ error: "Escreve o que tens a fazer antes de adicionar." }, { status: 400 });

  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega as tarefas antes de continuar." }, { status: 403 });
    }
    const task = {
      id: randomUUID(),
      title,
      done: false,
      createdAt: new Date().toISOString(),
    };
    await billingPool().query(
      `INSERT INTO akira_tasks (user_id, task_id, title, done, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [identity.userId, task.id, task.title, task.done, task.createdAt],
    );
    const response = NextResponse.json({ task }, { status: 201 });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao guardar tarefa na base de dados.", error);
    return NextResponse.json({ error: "Não foi possível guardar a tarefa na base de dados." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O pedido não contém JSON válido." }, { status: 400 });
  }
  if (!isRecord(body) || !Array.isArray(body.tasks)) {
    return NextResponse.json({ error: "O pedido tem de conter uma lista de tarefas." }, { status: 400 });
  }
  if (body.tasks.length > MAX_MIGRATED_TASKS) {
    return NextResponse.json({ error: "Há demasiadas tarefas para migrar de uma só vez." }, { status: 413 });
  }
  const tasks = body.tasks.map(parseTask);
  if (tasks.some((task) => !task)) {
    return NextResponse.json({ error: "Uma ou mais tarefas têm dados inválidos." }, { status: 400 });
  }

  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega as tarefas antes de continuar." }, { status: 403 });
    }
    const client = await billingPool().connect();
    try {
      await client.query("BEGIN");
      for (const task of tasks as TaskInput[]) {
        await client.query(
          `INSERT INTO akira_tasks (user_id, task_id, title, done, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, task_id) DO UPDATE SET
             title = EXCLUDED.title,
             done = EXCLUDED.done,
             created_at = EXCLUDED.created_at`,
          [identity.userId, task.id, task.title, task.done, task.createdAt],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const response = NextResponse.json({ saved: tasks.length });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao migrar tarefas para a base de dados.", error);
    return NextResponse.json({ error: "Não foi possível migrar as tarefas para a base de dados." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (new URL(request.url).searchParams.get("done") !== "true") {
    return NextResponse.json({ error: "Indica done=true para limpar tarefas concluídas." }, { status: 400 });
  }
  try {
    const identity = await getPersistentUser(request);
    if (!persistentScopeMatches(request, identity)) {
      return NextResponse.json({ error: "A conta mudou. Recarrega as tarefas antes de continuar." }, { status: 403 });
    }
    const result = await billingPool().query(
      "DELETE FROM akira_tasks WHERE user_id = $1 AND done = TRUE",
      [identity.userId],
    );
    const response = NextResponse.json({ removed: result.rowCount || 0 });
    return attachPersistentUserCookie(response, identity);
  } catch (error) {
    console.error("Falha ao limpar tarefas concluídas da base de dados.", error);
    return NextResponse.json({ error: "Não foi possível limpar as tarefas concluídas." }, { status: 503 });
  }
}
