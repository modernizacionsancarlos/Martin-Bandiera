import { useSyncExternalStore } from 'react';

/**
 * Estado global de sincronización con la base de datos.
 *
 * Cada escritura a Firestore pasa por `trackedWrites.ts`, que informa aquí cuando empieza,
 * cuando el servidor la confirma y cuando falla. La interfaz usa este estado para mostrar
 * "Guardado", "Guardando…", "Cambios sin sincronizar" o un error visible.
 */
export interface SyncSnapshot {
  /** Escrituras enviadas que el servidor todavía no confirmó. */
  pending: number;
  /** Hora de la última escritura confirmada por el servidor. */
  lastSyncedAt: number | null;
  /** Último error de escritura todavía no descartado por el usuario. */
  lastError: { message: string; at: number } | null;
  /** Cantidad de escrituras rechazadas desde que se abrió la app. */
  failedCount: number;
  online: boolean;
}

let state: SyncSnapshot = {
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  failedCount: 0,
  online: typeof navigator === 'undefined' ? true : navigator.onLine
};

const listeners = new Set<() => void>();

function setState(patch: Partial<SyncSnapshot>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

export function describeWriteError(error: unknown): string {
  const code = (error as any)?.code as string | undefined;
  switch (code) {
    case 'permission-denied':
      return 'No tiene permiso para guardar este cambio. El dato NO se guardó en la base.';
    case 'unauthenticated':
      return 'La sesión venció. Vuelva a iniciar sesión: el cambio NO se guardó en la base.';
    case 'resource-exhausted':
      return 'Se alcanzó el límite de uso de la base de datos. El cambio NO se guardó.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'No hay conexión estable con la base de datos. El cambio queda pendiente de sincronizar.';
    default: {
      const detail = error instanceof Error ? error.message : String(error);
      return `No se pudo guardar un cambio en la base de datos (${detail}).`;
    }
  }
}

export const syncStatus = {
  begin() {
    setState({ pending: state.pending + 1 });
  },
  succeed() {
    setState({ pending: Math.max(0, state.pending - 1), lastSyncedAt: Date.now() });
  },
  fail(error: unknown) {
    setState({
      pending: Math.max(0, state.pending - 1),
      failedCount: state.failedCount + 1,
      lastError: { message: describeWriteError(error), at: Date.now() }
    });
  },
  dismissError() {
    setState({ lastError: null });
  },
  setOnline(online: boolean) {
    if (state.online !== online) setState({ online });
  },
  getSnapshot(): SyncSnapshot {
    return state;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncStatus.setOnline(true));
  window.addEventListener('offline', () => syncStatus.setOnline(false));
}

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(syncStatus.subscribe, syncStatus.getSnapshot, syncStatus.getSnapshot);
}
