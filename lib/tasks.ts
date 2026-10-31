export type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

type StoredTask = Task & { taskId?: string; historyScope?: string };

const DATABASE = "akira-bot-ui";
const STORE = "tasks";
const MAX_TITLE_LENGTH = 120;
let databasePromise: Promise<IDBDatabase> | undefined;

// Alguns navegadores/bloqueadores negam o IndexedDB ("user denied permission to
// access the database"). A página de tarefas deve degradar com uma mensagem clara.
function describeStorageFailure(reason: unknown): Error {
  const name = reason instanceof Error ? reason.name : "";
  if (name === "SecurityError" || name === "NotAllowedError") {
    return new Error(
      "O navegador bloqueou o guardar local. As tarefas não ficam guardadas neste dispositivo até o acesso ser permitido.",
    );
  }
  return reason instanceof Error ? reason : new Error("Não foi possível abrir as tarefas.");
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Este navegador não suporta o armazenamento local."));
  }

  if (!databasePromise) {
    const attempt = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("conversations")) {
          request.result.createObjectStore("conversations", { keyPath: "id" });
        }
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(describeStorageFailure(request.error));
      request.onblocked = () =>
        reject(new Error("As tarefas estão bloqueadas por outra aba. Fecha essa aba e tenta de novo."));
    });
    attempt.catch(() => {
      // Não manter em cache uma falha: as próximas chamadas voltam a tentar.
      if (databasePromise === attempt) databasePromise = undefined;
    });
    databasePromise = attempt;
  }

  return databasePromise;
}

function normalizeTask(task: Task): Task {
  return {
    id: task.id,
    title: String(task.title).slice(0, MAX_TITLE_LENGTH),
    done: task.done === true,
    createdAt:
      typeof task.createdAt === "string" && !Number.isNaN(Date.parse(task.createdAt))
        ? task.createdAt
        : new Date(0).toISOString(),
  };
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível ler as tarefas."));
  });
}

export function cleanTaskTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

export async function loadTasks(historyScope: string): Promise<Task[]> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta das tarefas.");
  const database = await openDatabase();
  const saved = await readRequest<unknown[]>(
    database.transaction(STORE, "readonly").objectStore(STORE).getAll(),
  );
  const tasks = saved
    .filter(
      (entry): entry is StoredTask =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as StoredTask).historyScope === "string" &&
        typeof (entry as StoredTask).taskId === "string",
    )
    .map((entry) => normalizeTask({ ...entry, id: entry.taskId as string }));
  return tasks.sort((a, b) =>
    a.done === b.done ? b.createdAt.localeCompare(a.createdAt) : a.done ? 1 : -1,
  );
}

async function putTask(historyScope: string, task: Task): Promise<void> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta das tarefas.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction
      .objectStore(STORE)
      .put({ ...task, id: `${historyScope}:${task.id}`, taskId: task.id, historyScope });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar a tarefa."));
    transaction.onabort = () => reject(transaction.error || new Error("A gravação da tarefa foi cancelada."));
  });
}

export async function addTask(historyScope: string, title: string): Promise<Task> {
  const cleaned = cleanTaskTitle(title);
  if (!cleaned) throw new Error("Escreve o que tens a fazer antes de adicionar.");
  const task: Task = {
    id: crypto.randomUUID(),
    title: cleaned,
    done: false,
    createdAt: new Date().toISOString(),
  };
  await putTask(historyScope, task);
  return task;
}

export async function setTaskDone(historyScope: string, taskId: string, done: boolean): Promise<Task> {
  const database = await openDatabase();
  const saved = await readRequest<unknown>(
    database.transaction(STORE, "readonly").objectStore(STORE).get(`${historyScope}:${taskId}`),
  );
  if (!saved || typeof saved !== "object" || (saved as StoredTask).taskId !== taskId) {
    throw new Error("A tarefa já não existe neste navegador.");
  }
  const task: Task = normalizeTask({ ...(saved as Task), id: taskId, done });
  await putTask(historyScope, task);
  return task;
}

export async function removeTask(historyScope: string, taskId: string): Promise<void> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta das tarefas.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(`${historyScope}:${taskId}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível apagar a tarefa."));
    transaction.onabort = () => reject(transaction.error || new Error("A remoção da tarefa foi cancelada."));
  });
}

export async function clearDoneTasks(historyScope: string): Promise<number> {
  if (!historyScope) throw new Error("Não foi possível determinar a conta das tarefas.");
  const database = await openDatabase();
  const removed = await new Promise<number>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const getAll = store.getAll();
    let count = 0;
    getAll.onsuccess = () => {
      for (const entry of getAll.result as StoredTask[]) {
        if (entry.historyScope === historyScope && entry.done === true) {
          store.delete(`${historyScope}:${entry.taskId}`);
          count += 1;
        }
      }
    };
    getAll.onerror = () => transaction.abort();
    transaction.oncomplete = () => resolve(count);
    transaction.onerror = () => reject(transaction.error || new Error("Não foi possível limpar as concluídas."));
    transaction.onabort = () => reject(transaction.error || new Error("A limpeza foi cancelada."));
  });
  return removed;
}
