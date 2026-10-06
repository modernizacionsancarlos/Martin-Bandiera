import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sun,
  Moon,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const { loginWithCredentials } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    setTimeout(() => {
      const res = loginWithCredentials(identifier, password);
      if (!res.success) {
        setErrorMessage(res.message || 'Credenciales inválidas. Verifique su usuario y contraseña asignadas.');
        setIsLoading(false);
      }
    }, 200);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 relative overflow-hidden font-sans select-none">
      {/* Background Ambience Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-cyan-500/20 text-base">
            JB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">JOB Martin Bandiera</span>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400">
                SaaS v2.6
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Ingeniería, Mantenimiento de Pozos, Obras & Auditoría
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleDarkMode}
          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer text-xs flex items-center gap-2"
          title="Cambiar tema visual"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
          <span className="text-[11px] font-medium hidden sm:inline">{darkMode ? 'Tema Claro' : 'Tema Oscuro'}</span>
        </button>
      </header>

      {/* Centered Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 sm:p-9 shadow-2xl shadow-cyan-950/40">
          
          {/* Badge & Heading */}
          <div className="mb-5 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[#00c2ff] text-[11px] font-bold uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5" />
              <span>Acceso al Sistema</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Iniciar Sesión
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Ingrese su usuario o correo electrónico y su clave de acceso.
            </p>
          </div>

          {/* Error Feedback */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="font-medium leading-tight">{errorMessage}</span>
            </div>
          )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Identifier Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 block">
                    Usuario o Correo Electrónico
                  </label>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Admite @gmail.com
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="gastonvillalobos2019@gmail.com o admin@admin.com"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00c2ff] focus:border-transparent transition-all font-mono"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">Atajos rápidos:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('gastonvillalobos2019@gmail.com');
                      setPassword('123456');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 font-mono font-bold cursor-pointer border border-cyan-800"
                  >
                    Gastón (123456)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('rominabromeo@yahoo.com.ar');
                      setPassword('123456');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950/80 hover:bg-purple-900 text-purple-300 font-mono font-bold cursor-pointer border border-purple-800"
                  >
                    Romina (123456)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('martin@iipsa.com.ar');
                      setPassword('123456');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono font-bold cursor-pointer border border-emerald-800"
                  >
                    Martin (123456)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('admin@admin.com');
                      setPassword('admin');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono font-bold cursor-pointer border border-amber-500/40"
                  >
                    Juan Pablo (admin)
                  </button>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Clave de Acceso
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-10 pr-11 py-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00c2ff] focus:border-transparent transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-[#00c2ff] focus:ring-0 cursor-pointer"
                  />
                  <span>Recordar sesión en este equipo</span>
                </label>
              </div>

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 rounded-2xl bg-[#00c2ff] hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar al Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

          {/* Security note */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center text-xs text-slate-400 gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Conexión cifrada y base de datos persistente</span>
          </div>

        </div>
      </main>

      {/* Footer info */}
      <footer className="relative z-10 py-4 px-4 text-center text-xs text-slate-500 border-t border-slate-900">
        JOB Martin Bandiera S.A. · Mendoza, Argentina · Sistema de Gestión y Control Integral
      </footer>
    </div>
  );
};
