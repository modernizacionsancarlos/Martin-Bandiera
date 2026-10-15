import React, { useEffect, useState } from 'react';
import { syncStatus, useSyncStatus } from '../services/syncStatus';

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

/**
 * Indicador fijo del estado de guardado. Muestra errores de escritura en forma visible y
 * avisa antes de cerrar la pestaña si quedan cambios sin sincronizar.
 */
export const SyncIndicator: React.FC = () => {
  const { pending, lastSyncedAt, lastError, online } = useSyncStatus();
  const [, forceTick] = useState(0);

  // Avisar antes de cerrar o recargar con cambios sin confirmar por el servidor.
  useEffect(() => {
    if (pending === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pending]);

  // Refrescar la hora mostrada cada minuto.
  useEffect(() => {
    const id = window.setInterval(() => forceTick(t => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  let tone = 'border-emerald-500/40 bg-emerald-950/90 text-emerald-300';
  let label = lastSyncedAt ? `Guardado ✓ ${formatTime(lastSyncedAt)}` : 'Conectado';

  if (pending > 0 && !online) {
    tone = 'border-amber-500/50 bg-amber-950/90 text-amber-200';
    label = `Sin conexión: ${pending} cambio${pending === 1 ? '' : 's'} sin sincronizar`;
  } else if (pending > 0) {
    tone = 'border-sky-500/40 bg-sky-950/90 text-sky-200';
    label = `Guardando… (${pending})`;
  } else if (!online) {
    tone = 'border-amber-500/50 bg-amber-950/90 text-amber-200';
    label = 'Sin conexión';
  }

  return (
    <>
      {lastError && (
        <div
          role="alert"
          className="fixed bottom-14 right-3 z-[9998] max-w-sm rounded-xl border border-rose-500/60 bg-rose-950/95 p-3 text-xs text-rose-100 shadow-xl"
        >
          <p className="font-black uppercase tracking-wide text-rose-300">Error al guardar</p>
          <p className="mt-1 leading-snug">{lastError.message}</p>
          <p className="mt-1 text-[10px] text-rose-300/80">Hora: {formatTime(lastError.at)} · verifique el dato e inténtelo de nuevo</p>
          <button
            type="button"
            onClick={() => syncStatus.dismissError()}
            className="mt-2 rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-400 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-3 right-3 z-[9998] rounded-full border px-3 py-1 text-[11px] font-bold shadow-lg ${tone}`}
      >
        {label}
      </div>
    </>
  );
};
