import React from 'react';
import { DEMO_ACCOUNTS } from './demoSeed';

/**
 * Cuentas de la demo para entrar con un clic. Solo se monta cuando __DEMO__ es true.
 */
export const DemoLoginHelp: React.FC<{ onPick: (email: string, password: string) => void }> = ({ onPick }) => (
  <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5">
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-300">
      Demo: elija un perfil para ver el sistema con ese rol
    </p>
    <div className="flex flex-wrap gap-1.5">
      {DEMO_ACCOUNTS.map(account => (
        <button
          key={account.authUid}
          type="button"
          onClick={() => onPick(account.email, account.password)}
          className="rounded-lg border border-amber-500/40 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-slate-800 cursor-pointer"
        >
          {account.label}
        </button>
      ))}
    </div>
    <p className="mt-2 text-[10px] text-amber-200/80">Todos los datos son ficticios y no existe conexión con la base real.</p>
  </div>
);
