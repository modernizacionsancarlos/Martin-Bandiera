import React, { useState } from 'react';
import { resetDemoDatabase, setDemoOffline, isDemoOffline } from './firestoreShim';

/**
 * Franja fija que identifica la demo. Solo se monta cuando __DEMO__ es true.
 */
export const DemoBanner: React.FC = () => {
  const [offline, setOffline] = useState(isDemoOffline());
  const toggleOffline = () => {
    setDemoOffline(!offline);
    setOffline(!offline);
  };
  const handleReset = () => {
    if (!window.confirm('¿Restablecer todos los datos de la demo a su estado inicial?')) return;
    resetDemoDatabase();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <div
      role="status"
      className="fixed bottom-[5.25rem] left-1/2 -translate-x-1/2 z-[9999] flex w-max max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-amber-400/60 bg-amber-500 px-3 py-1.5 text-center text-[10px] sm:text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg"
    >
      <span>Modo demo · datos ficticios · sin conexión a la base real</span>
      <button
        type="button"
        onClick={toggleOffline}
        aria-pressed={offline}
        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer ${offline ? 'bg-rose-600 text-white' : 'bg-slate-950 text-amber-300 hover:bg-slate-800'}`}
        title="Simula que el celular perdió la señal: los cambios quedan pendientes hasta que vuelve"
      >
        {offline ? 'Volver la señal' : 'Simular sin señal'}
      </button>
      <button
        type="button"
        onClick={handleReset}
        className="rounded-full bg-slate-950 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-slate-800 cursor-pointer"
      >
        Restablecer demo
      </button>
    </div>
  );
};
