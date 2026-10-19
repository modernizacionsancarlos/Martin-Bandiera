import { FieldReport } from '../types';

/**
 * Bandeja de salida de partes de campo (copia de seguridad en el teléfono).
 *
 * La base (caché persistente de Firestore) ya guarda sin señal y envía sola al volver la conexión. Pero si el
 * servidor RECHAZA un parte (sesión vencida, cuenta dada de baja, regla de seguridad), Firestore descarta la
 * escritura y el parte desaparecería. Esta bandeja guarda una copia de cada parte hasta que el servidor
 * confirma que lo recibió, así el capataz nunca pierde lo que cargó en la finca.
 *
 * Reglas:
 * - Cada parte entra a la bandeja al enviarlo y sale cuando el servidor lo confirma.
 * - Si el servidor lo rechaza, queda como "falló" con el motivo y se puede reintentar.
 * - Al abrir la app se reconcilia con lo que confirmó el servidor: confirmado se borra; si no está ni
 *   figura pendiente, la escritura se perdió y se vuelve a enviar (el identificador es el mismo: no se duplica).
 *
 * Almacenamiento: IndexedDB. Una prueba en el emulador de Android mostró que Chrome NO escribe `localStorage` a
 * disco de inmediato: un cierre forzado de la app perdió todo lo guardado ahí (incluso 33 segundos antes),
 * mientras que IndexedDB conservó hasta lo escrito 1,5 segundos antes del cierre.
 */
export interface OutboxEntry {
  report: FieldReport;
  queuedAt: string;
  attempts: number;
  /** Motivo del rechazo del servidor. Sin valor = en espera de confirmación. */
  failed?: string;
}

/** Almacén clave-valor asíncrono (IndexedDB en la app; en memoria en las pruebas). */
export interface OutboxStorage {
  load(key: string): Promise<string | null>;
  /** Se resuelve cuando el dato quedó guardado de forma duradera. */
  save(key: string, value: string): Promise<void>;
}

export interface ReconcileResult {
  confirmed: string[];
  resubmit: FieldReport[];
}

/** Almacén duradero en IndexedDB; si no está disponible, cae a localStorage (menos fiable, mejor que nada). */
export function createIdbStorage(dbName = 'job_campo', storeName = 'kv'): OutboxStorage {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= open());
  const usable = typeof indexedDB !== 'undefined';

  return {
    async load(key) {
      if (!usable) return window.localStorage.getItem(key);
      try {
        const database = await db();
        return await new Promise<string | null>((resolve, reject) => {
          const request = database.transaction(storeName).objectStore(storeName).get(key);
          request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
          request.onerror = () => reject(request.error);
        });
      } catch {
        return window.localStorage.getItem(key);
      }
    },
    async save(key, value) {
      if (!usable) {
        window.localStorage.setItem(key, value);
        return;
      }
      try {
        const database = await db();
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put(value, key);
          tx.oncomplete = () => resolve(); // la transacción terminó: el dato está en disco
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } catch {
        window.localStorage.setItem(key, value);
      }
    }
  };
}

export function createFieldOutbox(storage: OutboxStorage, ownerAuthUid: string) {
  const key = `job_campo_outbox_v1:${ownerAuthUid}`;
  const listeners = new Set<() => void>();
  /** Partes con un envío en curso en esta sesión (no se reenvían por reconciliación). */
  const inFlight = new Set<string>();
  let entries: OutboxEntry[] = [];

  const notify = () => listeners.forEach(l => l());

  // Lecturas y cambios se ordenan en una sola cola: nunca se pisan dos escrituras.
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  const ready = enqueue(async () => {
    try {
      const raw = await storage.load(key);
      const parsed = raw ? JSON.parse(raw) : [];
      entries = Array.isArray(parsed) ? parsed : [];
    } catch {
      entries = [];
    }
    notify();
  });

  /** Aplica el cambio en memoria al instante (la pantalla lo ve enseguida) y lo guarda de forma duradera. */
  const commit = (next: OutboxEntry[]): Promise<void> => {
    entries = next;
    notify();
    return enqueue(async () => {
      try {
        await storage.save(key, JSON.stringify(entries));
      } catch {
        // Sin espacio en el teléfono: la base sigue siendo la copia principal.
      }
    });
  };

  return {
    /** Se resuelve cuando se leyó la bandeja guardada. */
    ready,
    list: (): OutboxEntry[] => entries,

    /** Se resuelve cuando el parte quedó guardado en el disco del teléfono. */
    add(report: FieldReport): Promise<void> {
      return commit([...entries.filter(e => e.report.id !== report.id), { report, queuedAt: new Date().toISOString(), attempts: 1 }]);
    },

    remove(id: string): Promise<void> {
      return commit(entries.filter(e => e.report.id !== id));
    },

    markFailed(id: string, reason: string): Promise<void> {
      return commit(entries.map(e => (e.report.id === id ? { ...e, failed: reason } : e)));
    },

    /** Prepara un reintento manual: vuelve a "en espera" y cuenta el intento. */
    retry(id: string): FieldReport | null {
      const entry = entries.find(e => e.report.id === id);
      if (!entry) return null;
      void commit(entries.map(e => (e.report.id === id ? { ...e, failed: undefined, attempts: e.attempts + 1 } : e)));
      return entry.report;
    },

    setInFlight(id: string, value: boolean) {
      if (value) inFlight.add(id);
      else inFlight.delete(id);
    },

    isInFlight: (id: string) => inFlight.has(id),

    /**
     * Compara la bandeja con una lectura CONFIRMADA por el servidor.
     * @param serverIds partes que el servidor tiene
     * @param unsyncedIds partes que este teléfono todavía tiene pendientes de enviar
     */
    reconcile(serverIds: Set<string>, unsyncedIds: Set<string>): ReconcileResult {
      const confirmed: string[] = [];
      const resubmit: FieldReport[] = [];
      for (const entry of entries) {
        const id = entry.report.id;
        if (serverIds.has(id) && !unsyncedIds.has(id)) confirmed.push(id);
        else if (!entry.failed && !unsyncedIds.has(id) && !inFlight.has(id)) resubmit.push(entry.report);
      }
      if (confirmed.length) void commit(entries.filter(e => !confirmed.includes(e.report.id)));
      return { confirmed, resubmit };
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export type FieldOutbox = ReturnType<typeof createFieldOutbox>;

/** Identificador único del parte, también entre teléfonos distintos y sin conexión. */
export function newFieldReportId(): string {
  const random =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('')
      : Math.random().toString(16).slice(2, 10);
  return `PC-${Date.now().toString(36).toUpperCase()}-${random.toUpperCase()}`;
}
