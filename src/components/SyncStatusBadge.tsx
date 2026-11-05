import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { OUTBOX_EVENT, flushOutbox, pendingWriteCount } from '../services/docstore';

// Tells field users they are offline and how many changes wait to be uploaded.
export const SyncStatusBadge: React.FC = () => {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [pending, setPending] = useState(() => pendingWriteCount());

  useEffect(() => {
    const onOutbox = (e: Event) => setPending(Number((e as CustomEvent).detail?.pending ?? pendingWriteCount()));
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener(OUTBOX_EVENT, onOutbox);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener(OUTBOX_EVENT, onOutbox);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online && pending === 0) return null;

  const label = !online
    ? pending > 0
      ? `Sin conexión · ${pending} ${pending === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
      : 'Sin conexión · se guarda en el teléfono'
    : `Subiendo ${pending} ${pending === 1 ? 'cambio' : 'cambios'}…`;

  return (
    <button
      type="button"
      role="status"
      onClick={() => void flushOutbox()}
      title={online ? 'Reintentar ahora' : 'Los cambios se subirán al volver la conexión'}
      className={`fixed left-1/2 -translate-x-1/2 z-[9998] px-3.5 py-2 rounded-full text-[11px] font-bold shadow-xl flex items-center gap-2 cursor-pointer ${
        online ? 'bg-cyan-600 text-white' : 'bg-amber-500 text-slate-950'
      }`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      {online ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudOff className="w-3.5 h-3.5" />}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
};
