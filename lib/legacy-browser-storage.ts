const DATABASE = "akira-bot-ui";

function openLegacyDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível ler os dados antigos."));
    request.onblocked = () => reject(new Error("Fecha as outras abas da AKIRA para migrar os dados antigos."));
  });
}

export async function readLegacyEntries(storeName: "conversations" | "tasks"): Promise<unknown[]> {
  if (typeof indexedDB === "undefined") return [];
  const database = await openLegacyDatabase();
  if (!database.objectStoreNames.contains(storeName)) {
    const isEmpty = database.objectStoreNames.length === 0;
    database.close();
    if (isEmpty) indexedDB.deleteDatabase(DATABASE);
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    let entries: unknown[] = [];
    request.onsuccess = () => {
      entries = request.result as unknown[];
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      resolve(entries);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Não foi possível ler os dados antigos."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("A leitura dos dados antigos foi cancelada."));
    };
  });
}

export async function deleteLegacyEntries(
  storeName: "conversations" | "tasks",
  ids: string[],
): Promise<void> {
  if (typeof indexedDB === "undefined" || ids.length === 0) return;
  const database = await openLegacyDatabase();
  if (!database.objectStoreNames.contains(storeName)) {
    database.close();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const id of ids) store.delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Não foi possível remover os dados antigos do navegador."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("A remoção dos dados antigos foi cancelada."));
    };
  });

  if (database.objectStoreNames.length === 0) indexedDB.deleteDatabase(DATABASE);
}
