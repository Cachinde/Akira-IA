import { deleteLegacyEntries, readLegacyEntries } from "./legacy-browser-storage";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

type RecordValue = Record<string, unknown>;
type LegacyTask = RecordValue & { id: string; historyScope: string; taskId: string };
const MAX_TITLE_LENGTH = 120;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is RecordValue {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseTask(value: unknown): Task | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID_PATTERN.test(value.id) ||
    typeof value.title !== "string" ||
    typeof value.done !== "boolean"
  ) {
    return null;
  }
  const createdAt =
    typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt))
      ? value.createdAt
      : new Date(0).toISOString();
  return {
    id: value.id,
    title: cleanTaskTitle(value.title),
    done: value.done,
    createdAt,
  };
}

async function requestJson<T>(url: string, historyScope: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("x-akira-account-scope", historyScope);
  const response = await fetch(url, { cache: "no-store", ...init, headers });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor não devolveu uma resposta válida para as tarefas.");
  }
  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "Não foi possível guardar as tarefas na base de dados.";
    throw new Error(message);
  }
  return data as T;
}

export function cleanTaskTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

function legacyTask(entry: unknown, historyScope: string): Task | null {
  if (!isRecord(entry) || entry.historyScope !== historyScope || typeof entry.taskId !== "string") {
    return null;
  }
  return parseTask({ ...entry, id: entry.taskId });
}

async function migrateLegacyTasks(historyScope: string): Promise<void> {
  const entries = await readLegacyEntries("tasks");
  const scopedEntries = entries.filter(
    (entry): entry is LegacyTask =>
      isRecord(entry) &&
      entry.historyScope === historyScope &&
      typeof entry.id === "string" &&
      typeof entry.taskId === "string",
  );
  if (!scopedEntries.length) return;

  const tasks = scopedEntries.map((entry) => legacyTask(entry, historyScope));
  if (tasks.some((task) => !task)) {
    throw new Error("Há tarefas antigas inválidas; os dados locais foram mantidos para recuperação.");
  }
  await requestJson("/api/tasks", historyScope, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks }),
  });
  await deleteLegacyEntries("tasks", scopedEntries.map((entry) => entry.id));
}

export async function loadTasks(historyScope: string): Promise<Task[]> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta das tarefas.");
  await migrateLegacyTasks(historyScope);
  const data = await requestJson<{ tasks?: unknown }>("/api/tasks", historyScope);
  if (!Array.isArray(data.tasks)) throw new Error("A resposta das tarefas tem um formato inválido.");
  const tasks = data.tasks.map(parseTask);
  if (tasks.some((task) => !task)) throw new Error("O servidor devolveu uma tarefa inválida.");
  return (tasks as Task[]).sort((a, b) =>
    a.done === b.done ? b.createdAt.localeCompare(a.createdAt) : a.done ? 1 : -1,
  );
}

export async function addTask(historyScope: string, title: string): Promise<Task> {
  const cleaned = cleanTaskTitle(title);
  if (!cleaned) throw new Error("Escreve o que tens a fazer antes de adicionar.");
  const data = await requestJson<{ task?: unknown }>("/api/tasks", historyScope, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: cleaned }),
  });
  const task = parseTask(data.task);
  if (!task) throw new Error("O servidor devolveu uma tarefa inválida.");
  return task;
}

export async function setTaskDone(
  historyScope: string,
  taskId: string,
  done: boolean,
): Promise<Task> {
  const data = await requestJson<{ task?: unknown }>(`/api/tasks/${encodeURIComponent(taskId)}`, historyScope, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done }),
  });
  const task = parseTask(data.task);
  if (!task) throw new Error("O servidor devolveu uma tarefa inválida.");
  return task;
}

export async function removeTask(historyScope: string, taskId: string): Promise<void> {
  await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, historyScope, { method: "DELETE" });
}

export async function clearDoneTasks(historyScope: string): Promise<number> {
  const data = await requestJson<{ removed?: unknown }>("/api/tasks?done=true", historyScope, { method: "DELETE" });
  if (typeof data.removed !== "number") throw new Error("O servidor devolveu um resultado inválido.");
  return data.removed;
}
