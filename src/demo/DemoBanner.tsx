import React from 'react';
import { resetDemoDatabase } from './firestoreShim';

/**
 * Franja fija que identifica la demo. Solo se monta cuando __DEMO__ es true.
 */
export const DemoBanner: React.FC = () => {
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
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-full border border-amber-400/60 bg-amber-500 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg"
    >
      <span>Modo demo · datos ficticios · sin conexión a la base real</span>
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
