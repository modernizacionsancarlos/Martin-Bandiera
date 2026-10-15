import React, { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Pantalla obligatoria al ingresar con una clave temporal (cuenta nueva o clave restablecida por un administrador).
 * Hasta que el usuario elige su propia clave, el sistema no le muestra ni le entrega ningún dato.
 */
export const ChangePasswordPage: React.FC = () => {
  const { completePasswordChange, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError('La contraseña debe tener al menos 8 caracteres, con letras y números.');
    }
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    setError('');
    const res = await completePasswordChange(password);
    setBusy(false);
    if (!res.success) setError(res.message || 'No se pudo cambiar la contraseña.');
  };

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:outline-none focus:ring-2 focus:ring-cyan-500';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
          <KeyRound className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Elegí tu contraseña</h1>
          <p className="text-sm text-slate-400 mt-1">
            Ingresaste con una contraseña temporal. Por seguridad, creá una propia para continuar.
          </p>
        </div>
        <div>
          <label htmlFor="new-password" className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">Contraseña nueva</label>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} required />
          <p className="text-[11px] text-slate-500 mt-1">Mínimo 8 caracteres, con letras y números.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">Repetir contraseña</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} required />
        </div>
        {error && <p role="alert" className="text-sm font-bold text-rose-400">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-black uppercase tracking-wider cursor-pointer">
          {busy ? 'Guardando…' : 'Guardar y continuar'}
        </button>
        <button type="button" onClick={logout} className="w-full text-xs font-bold text-slate-500 hover:text-slate-300 inline-flex items-center justify-center gap-1.5 cursor-pointer">
          <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
        </button>
      </form>
    </div>
  );
};
