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
 */
export interface OutboxEntry {
  report: FieldReport;
  queuedAt: string;
  attempts: number;
  /** Motivo del rechazo del servidor. Sin valor = en espera de confirmación. */
  failed?: string;
}

export interface OutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ReconcileResult {
  confirmed: string[];
  resubmit: FieldReport[];
}

export function createFieldOutbox(storage: OutboxStorage, ownerAuthUid: string) {
  const key = `job_campo_outbox_v1:${ownerAuthUid}`;
  const listeners = new Set<() => void>();
  /** Partes con un envío en curso en esta sesión (no se reenvían por reconciliación). */
  const inFlight = new Set<string>();

  const read = (): OutboxEntry[] => {
    try {
      const raw = storage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const write = (entries: OutboxEntry[]) => {
    try {
      storage.setItem(key, JSON.stringify(entries));
    } catch {
      // Sin espacio en el teléfono: la base sigue siendo la copia principal.
    }
    listeners.forEach(l => l());
  };

  return {
    list: read,

    add(report: FieldReport) {
      const entries = read().filter(e => e.report.id !== report.id);
      write([...entries, { report, queuedAt: new Date().toISOString(), attempts: 1 }]);
    },

    remove(id: string) {
      write(read().filter(e => e.report.id !== id));
    },

    markFailed(id: string, reason: string) {
      write(read().map(e => (e.report.id === id ? { ...e, failed: reason } : e)));
    },

    /** Prepara un reintento manual: vuelve a "en espera" y cuenta el intento. */
    retry(id: string): FieldReport | null {
      const entry = read().find(e => e.report.id === id);
      if (!entry) return null;
      write(read().map(e => (e.report.id === id ? { ...e, failed: undefined, attempts: e.attempts + 1 } : e)));
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
      for (const entry of read()) {
        const id = entry.report.id;
        if (serverIds.has(id) && !unsyncedIds.has(id)) confirmed.push(id);
        else if (!entry.failed && !unsyncedIds.has(id) && !inFlight.has(id)) resubmit.push(entry.report);
      }
      if (confirmed.length) write(read().filter(e => !confirmed.includes(e.report.id)));
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
