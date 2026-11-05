/**
 * Durable queue of writes made while offline (or while the network was failing).
 * Stored in IndexedDB so remitos survive the app being closed in the field, with an
 * in-memory mirror so reads can overlay pending changes synchronously.
 */

export type QueuedOp =
  | { qid: string; kind: 'merge' | 'replace'; collection: string; id: string; data: Record<string, any>; queuedAt: number }
  | { qid: string; kind: 'delete'; collection: string; id: string; queuedAt: number }
  // Server function call (e.g. field remito submission); `id` is the record it creates.
  | { qid: string; kind: 'rpc'; fn: string; args: Record<string, any>; collection: string; id: string; queuedAt: number };

const DB_NAME = 'bandiera_offline';
const STORE = 'outbox';
const FALLBACK_KEY = 'bandiera_outbox_fallback';

let memory: QueuedOp[] = [];
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'qid' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    db =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!db) return reject(new Error('IndexedDB unavailable'));
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function saveFallback(): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}

export const outboxReady: Promise<void> = (async () => {
  try {
    const rows = (await tx<QueuedOp[]>('readonly', s => s.getAll())) || [];
    memory = rows.sort((a, b) => a.queuedAt - b.queuedAt || a.qid.localeCompare(b.qid));
  } catch {
    try {
      memory = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
    } catch {
      memory = [];
    }
  }
})();

let seq = 0;
export function newQid(): string {
  return `${Date.now().toString(36)}_${(++seq).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function pendingOps(): readonly QueuedOp[] {
  return memory;
}

export async function enqueue(ops: QueuedOp[]): Promise<void> {
  await outboxReady;
  memory = [...memory, ...ops];
  try {
    await tx('readwrite', s => {
      ops.forEach(op => s.put(op));
    });
  } catch {
    saveFallback();
  }
}

export async function remove(qid: string): Promise<void> {
  memory = memory.filter(op => op.qid !== qid);
  try {
    await tx('readwrite', s => s.delete(qid));
  } catch {
    saveFallback();
  }
}
