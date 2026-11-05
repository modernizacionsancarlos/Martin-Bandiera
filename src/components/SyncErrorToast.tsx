import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { SYNC_ERROR_EVENT } from '../services/firestoreSync';

const describe = (message: string): string => {
  if (/row-level security|permission denied|42501/i.test(message)) {
    return 'No tiene permiso para guardar este cambio.';
  }
  if (/fetch|network|Failed to/i.test(message)) {
    return 'Sin conexión con la base de datos.';
  }
  return 'No se pudo guardar el cambio en la base de datos.';
};

// Shows failed database writes so a change that did not persist is never shown as saved.
export const SyncErrorToast: React.FC = () => {
  const [error, setError] = useState<{ text: string; path: string } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onError = (e: Event) => {
      const { message, path } = (e as CustomEvent).detail || {};
      setError({ text: describe(String(message || '')), path: String(path || '') });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setError(null), 8000);
    };
    window.addEventListener(SYNC_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(SYNC_ERROR_EVENT, onError);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[9999] p-3.5 rounded-2xl bg-rose-600 text-white text-xs shadow-2xl flex items-start gap-2.5"
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-bold">{error.text}</p>
        <p className="opacity-80 mt-0.5">El cambio fue rechazado por el servidor. ({error.path})</p>
      </div>
      <button type="button" onClick={() => setError(null)} className="cursor-pointer opacity-80 hover:opacity-100" title="Cerrar">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
