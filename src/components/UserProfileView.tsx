import React from 'react';
import { User, Building, Mail, Shield, Smartphone, Globe, Award, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const UserProfileView: React.FC = () => {
  const { currentUser, isSuperAdmin } = useAuth();
  const { colorTheme: theme, darkMode: isDarkMode } = useTheme();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-cyan-500/20">
              MB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {currentUser.displayName || 'Martin Bandiera'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentUser.email} • {currentUser.companyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Sesión Activa & Segura
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-cyan-500" />
              Información de Empresa
            </h4>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Razón Social:</span>
                <span className="font-bold">JOB Martin Bandiera S.A.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CUIT:</span>
                <span className="font-mono font-bold">30-71720268-2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Teléfono:</span>
                <span className="font-mono font-bold">+54 9 2622 50-5195</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ubicación Central:</span>
                <span className="font-bold">Valle de Uco, Mendoza</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Especialidad:</span>
                <span>Electrificaciones Rurales e Hidráulica</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-500" />
              Compatibilidad de Aplicación
            </h4>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Entorno:</span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400">Web & Android Ready (100% Responsive)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PWA & Offline:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Soportado</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tema Activo:</span>
                <span className="font-bold capitalize">{theme} ({isDarkMode ? 'Modo Oscuro' : 'Modo Claro'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Versión:</span>
                <span className="font-mono font-bold">Ecosistema SaaS V5.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
