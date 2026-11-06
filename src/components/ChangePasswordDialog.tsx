import React, { useState } from 'react';
import { CheckCircle2, KeyRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5';

// Any user changing their own password, whenever they want.
export const ChangePasswordDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { changeOwnPassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return setError('Escriba su clave actual.');
    if (password.length < 8) return setError('La clave nueva debe tener al menos 8 caracteres.');
    if (password !== confirm) return setError('Las dos claves nuevas no coinciden.');
    if (navigator.onLine === false) return setError('Necesita conexión a internet para cambiar la clave.');
    setError(null);
    setSaving(true);
    const message = await changeOwnPassword(password, current);
    setSaving(false);
    if (message) setError(message);
    else setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-md max-h-[100dvh] overflow-y-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <h2 id="change-password-title" className="flex-1 text-base font-black">Cambiar mi clave</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 cursor-pointer" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <>
            <p role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Clave cambiada. Úsela la próxima vez que entre.
            </p>
            <button type="button" onClick={onClose} className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-black cursor-pointer">
              Listo
            </button>
          </>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor="current-password">Clave actual</label>
              <input id="current-password" type="password" autoComplete="current-password" className={inputClass} value={current} onChange={e => setCurrent(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="next-password">Clave nueva (mínimo 8 caracteres)</label>
              <input id="next-password" type="password" autoComplete="new-password" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="next-password-confirm">Repita la clave nueva</label>
              <input id="next-password-confirm" type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm font-bold">
                {error}
              </p>
            )}
            <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer">
              {saving ? 'Guardando…' : 'Guardar clave nueva'}
            </button>
          </>
        )}
      </form>
    </div>
  );
};
