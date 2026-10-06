import React, { useState } from 'react';
import {
  Shield,
  Moon,
  Sun,
  Palette,
  UserCheck,
  ChevronDown,
  Building2,
  FileSpreadsheet,
  Layers,
  Wrench,
  Boxes,
  Lock,
  Database,
  CheckCircle2,
  AlertTriangle,
  Menu,
  FileCheck2,
  FileText,
  FolderArchive,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ColorTheme, UserRole } from '../types';

interface HeaderProps {
  currentTab?: string;
  activeTab?: string;
  setCurrentTab?: (tab: string) => void;
  setActiveTab?: (tab: string) => void;
  onOpenFirebaseModal: () => void;
  onOpenNewReportModal?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab: propCurrentTab,
  activeTab: propActiveTab,
  setCurrentTab: propSetCurrentTab,
  setActiveTab: propSetActiveTab,
  onOpenFirebaseModal,
  onOpenNewReportModal = () => {},
  onToggleSidebar
}) => {
  const currentTab = propCurrentTab ?? propActiveTab ?? 'dashboard';
  const setCurrentTab = (tab: string) => {
    if (propSetCurrentTab) {
      propSetCurrentTab(tab);
    } else if (propSetActiveTab) {
      propSetActiveTab(tab);
    }
  };
  const { currentUser, canViewFinancials, firebaseConfig, logout } = useAuth();
  const { darkMode, toggleDarkMode, colorTheme, setColorTheme, themeClasses } = useTheme();

  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const themeOptions: { id: ColorTheme; label: string; bg: string }[] = [
    { id: 'cyan', label: 'Bandiera Cyan', bg: 'bg-cyan-500' },
    { id: 'blue', label: 'Azul Corporativo', bg: 'bg-blue-600' },
    { id: 'emerald', label: 'Verde Energía', bg: 'bg-emerald-500' },
    { id: 'amber', label: 'Ámbar Industrial', bg: 'bg-amber-500' },
    { id: 'slate', label: 'Grafito Minimal', bg: 'bg-slate-700' }
  ];

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-700';
      case 'Owner':
      case 'Admin':
      case 'Gerente':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700';
      case 'Capataz':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700';
      case 'Empleado':
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors duration-200">
      {/* Top Banner Notice */}
      <div className="bg-slate-950 text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-medium text-[11px] border border-cyan-500/30">
            <Shield className="w-3 h-3" /> ECOSISTEMA SAAS V5.0
          </span>
          <span className="text-slate-300 font-medium">JOB Martin Bandiera</span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">Desarrollado por Uco Digital Lab</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Firebase connection button */}
          <button
            onClick={onOpenFirebaseModal}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Ver configuración y reglas de seguridad de Firestore"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline font-mono text-[11px]">Firebase & Firestore</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
              Seguro
            </span>
          </button>

          {/* User info & quick logout (no dropdown list of all users) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 text-xs border border-slate-700">
              <UserCheck className="w-3 h-3 text-cyan-400" />
              <span className="font-semibold text-slate-100">{currentUser?.displayName || 'Usuario'}</span>
              <span className="text-slate-500">•</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${currentUser ? getRoleBadgeStyle(currentUser.role) : ''}`}>
                {currentUser?.role || 'Invitado'}
              </span>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 text-xs transition-colors border border-rose-500/30 cursor-pointer font-medium"
              title="Cerrar Sesión del Sistema"
            >
              <LogOut className="w-3 h-3 text-rose-400" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo brand & Sidebar toggle */}
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Abrir/Cerrar Barra Lateral"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className={`w-9 h-9 rounded-xl ${themeClasses.primaryBg} flex items-center justify-center text-white font-black text-lg shadow-lg transition-transform group-hover:scale-105`}>
                JB
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                    JOB <span className={themeClasses.primaryText}>Bandiera</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide leading-none">
                  Auditoría • Facturación • Cobranzas
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Inicio
            </button>

            <button
              onClick={() => setCurrentTab('auditoria')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'auditoria'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Auditoría (Cargados)
            </button>

            {/* Solapa Facturado */}
            <button
              onClick={() => setCurrentTab('facturado')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentTab === 'facturado'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Facturado
            </button>

            {/* Solapa Pasado */}
            <button
              onClick={() => setCurrentTab('pasado')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentTab === 'pasado'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Pasado
            </button>

            {/* Solapa Cobrado */}
            <button
              onClick={() => setCurrentTab('cobrado')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentTab === 'cobrado'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Cobrado
            </button>

            {/* Solapa Archivo */}
            <button
              onClick={() => setCurrentTab('archivo')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentTab === 'archivo'
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              Archivo
            </button>

            <button
              onClick={() => setCurrentTab('proyectos')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'proyectos'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Proyectos
            </button>

            {/* Financials / Reports tab */}
            <button
              onClick={() => setCurrentTab('finanzas')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'finanzas'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Finanzas
              {!canViewFinancials && (
                <Lock className="w-3 h-3 text-amber-500 ml-0.5" title="Restringido a Gerencia" />
              )}
            </button>

            <button
              onClick={() => setCurrentTab('administracion')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'administracion'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          </nav>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-2">
            {/* New report button (if admin) */}
            {canViewFinancials && (
              <button
                onClick={onOpenNewReportModal}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${themeClasses.buttonClass} transition-all cursor-pointer`}
              >
                + Nuevo Reporte
              </button>
            )}

            {/* Theme switcher */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Esquemas de colores configurables"
              >
                <Palette className="w-4 h-4" />
              </button>

              {showThemeMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in duration-100"
                  onMouseLeave={() => setShowThemeMenu(false)}
                >
                  <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Color del Sistema
                  </p>
                  <div className="space-y-1">
                    {themeOptions.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setColorTheme(t.id);
                          setShowThemeMenu(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          colorTheme === t.id
                            ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${t.bg}`} />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User profile avatar / pill with logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                {currentUser?.displayName?.charAt(0) || 'U'}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {currentUser?.displayName || 'Usuario'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {currentUser?.role || ''}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2 gap-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'dashboard'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Inicio
          </button>
          <button
            onClick={() => setCurrentTab('auditoria')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-bold ${
              currentTab === 'auditoria'
                ? 'bg-rose-500 text-white'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            Auditoría
          </button>
          <button
            onClick={() => setCurrentTab('facturado')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-bold ${
              currentTab === 'facturado'
                ? 'bg-blue-600 text-white'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          >
            Facturado
          </button>
          <button
            onClick={() => setCurrentTab('pasado')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-bold ${
              currentTab === 'pasado'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            Pasado
          </button>
          <button
            onClick={() => setCurrentTab('cobrado')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-bold ${
              currentTab === 'cobrado'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            Cobrado
          </button>
          <button
            onClick={() => setCurrentTab('archivo')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'archivo'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Archivo
          </button>
          <button
            onClick={() => setCurrentTab('liquidacion')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'liquidacion'
                ? 'bg-purple-600 text-white font-bold'
                : 'text-purple-600 dark:text-purple-400'
            }`}
          >
            Liquidación
          </button>
          <button
            onClick={() => setCurrentTab('proyectos')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'proyectos'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Proyectos
          </button>
          <button
            onClick={() => setCurrentTab('administracion')}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'administracion'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Admin
          </button>
        </div>
      </div>
    </header>
  );
};
