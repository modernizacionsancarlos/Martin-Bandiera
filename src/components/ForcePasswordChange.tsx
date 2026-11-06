import React, { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5';

// First login of an account copied from the old system: nothing else opens until the password changes.
export const ForcePasswordChange: React.FC = () => {
  const { currentUser, changeOwnPassword, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('La clave debe tener al menos 8 caracteres.');
    if (password !== confirm) return setError('Las dos claves no coinciden.');
    if (navigator.onLine === false) return setError('Necesita conexión a internet para cambiar la clave.');
    setError(null);
    setSaving(true);
    const message = await changeOwnPassword(password);
    if (message) {
      setError(message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black">Cree su clave nueva</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser?.email}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Es su primer ingreso al sistema nuevo. Por seguridad, cambie la clave antes de continuar.
        </p>
        <div>
          <label className={labelClass} htmlFor="new-password">Clave nueva (mínimo 8 caracteres)</label>
          <input id="new-password" type="password" autoComplete="new-password" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="confirm-password">Repita la clave nueva</label>
          <input id="confirm-password" type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>
        {error && (
          <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm font-bold">
            {error}
          </p>
        )}
        <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer">
          {saving ? 'Guardando…' : 'Guardar y entrar'}
        </button>
        <button type="button" onClick={logout} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer">
          <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
        </button>
      </form>
    </div>
  );
};
