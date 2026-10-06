import React from 'react';
import {
  HardHat,
  Sliders,
  Users,
  ChevronRight,
  Shield,
  Activity,
  ArrowRight,
  Briefcase,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Wrench,
  Boxes,
  Trash2
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FinancialMetricsChart } from './FinancialMetricsChart';

interface DashboardViewProps {
  onNavigate?: (tab: string) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenNewReport?: () => void;
  onOpenFirebaseModal?: () => void;
  onOpenResetModal?: () => void;
  onOpenImportExcel?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate: propOnNavigate,
  onNavigateTab: propOnNavigateTab,
  onOpenNewReport = () => {},
  onOpenFirebaseModal = () => {},
  onOpenResetModal = () => {},
  onOpenImportExcel = () => {}
}) => {
  const onNavigate = (tab: string) => {
    if (propOnNavigate) {
      propOnNavigate(tab);
    } else if (propOnNavigateTab) {
      propOnNavigateTab(tab);
    }
  };
  const { projects, maintenanceServices, materials, workers, canViewFinancials } = useData();
  const { currentUser, isCapataz, isEmpleado, canResetSystem } = useAuth();
  const { themeClasses } = useTheme();

  const activeProjectsCount = projects.filter(p => p.status === 'En Ejecución').length;
  const pendingMaintenanceCount = maintenanceServices.filter(s => s.status !== 'Finalizado').length;
  const lowStockCount = materials.filter(m => m.stock <= m.minStock).length;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* HERO SECTION MATCHING USER'S SCREENSHOT */}
      <div className="relative overflow-hidden rounded-3xl bg-radial from-cyan-50 via-sky-50 to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border border-cyan-100/80 dark:border-slate-800 p-8 sm:p-12 text-center transition-colors">
        {/* Background decorative subtle elements */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-200/40 dark:bg-cyan-900/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-200/40 dark:bg-blue-900/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          {/* Badge: Ecosistema SaaS v5.0 */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 dark:bg-slate-800/90 text-cyan-700 dark:text-cyan-300 text-xs font-bold tracking-wider uppercase border border-cyan-200 dark:border-cyan-800 shadow-xs mb-4">
            <Shield className="w-3.5 h-3.5 text-cyan-500" />
            <span>ECOSISTEMA SAAS V5.0</span>
          </div>

          {/* Heading: GESTIÓN EMPRESARIAL */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 dark:from-cyan-400 dark:via-sky-400 dark:to-blue-500 uppercase drop-shadow-xs">
            GESTIÓN EMPRESARIAL
          </h1>

          {/* Subheading: DESARROLLADO POR UCO DIGITAL LAB */}
          <p className="text-xs sm:text-sm font-extrabold tracking-[0.22em] text-slate-500 dark:text-slate-400 mt-2 uppercase">
            DESARROLLADO POR UCO DIGITAL LAB • JOB MARTIN BANDIERA
          </p>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 max-w-xl font-medium">
            Plataforma integral para dirección técnica de obras civiles, asistencia en pozos de agua, auditoría de campo y balance contable consolidado.
          </p>
        </div>

        {/* 3 HERO CARDS MATCHING EXACTLY THE USER SCREENSHOT */}
        <div className="relative z-10 max-w-6xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Card 1: PROYECTOS */}
          <div
            onClick={() => onNavigate('proyectos')}
            className="group relative bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-200/80 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            {/* Watermark helmet graphic background */}
            <div className="absolute right-3 top-4 text-slate-100 dark:text-slate-800/40 pointer-events-none transition-transform group-hover:scale-110">
              <HardHat className="w-28 h-28 opacity-60 dark:opacity-30 stroke-[1]" />
            </div>

            <div className="relative z-10">
              {/* Blue Icon Square */}
              <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/30 mb-5 transition-transform group-hover:scale-105">
                <HardHat className="w-6 h-6" />
              </div>

              <h3 className="text-xl sm:text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">
                PROYECTOS
              </h3>

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                OBRAS DE INGENIERÍA, GESTIÓN DE PERSONAL TÉCNICO Y PRESUPUESTOS INMOBILIARIOS.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  {projects.length} Registrados
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {activeProjectsCount} En Marcha
                </span>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="inline-flex items-center text-xs font-black tracking-wider text-sky-500 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors uppercase">
                ENTRAR <ChevronRight className="w-4 h-4 ml-0.5 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>

          {/* Card 2: MANTENIMIENTO */}
          <div
            onClick={() => onNavigate('mantenimiento')}
            className="group relative bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-200/80 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            {/* Watermark wrench/sliders graphic background */}
            <div className="absolute right-3 top-4 text-slate-100 dark:text-slate-800/40 pointer-events-none transition-transform group-hover:scale-110">
              <Sliders className="w-28 h-28 opacity-60 dark:opacity-30 stroke-[1]" />
            </div>

            <div className="relative z-10">
              {/* Cyan Icon Square */}
              <div className="w-12 h-12 rounded-2xl bg-cyan-400 text-white flex items-center justify-center shadow-md shadow-cyan-400/30 mb-5 transition-transform group-hover:scale-105">
                <Sliders className="w-6 h-6" />
              </div>

              <h3 className="text-xl sm:text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">
                MANTENIMIENTO
              </h3>

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                SERVICIOS DE CAMPO, POZOS, INSTALACIONES ELÉCTRICAS Y ASISTENCIA TÉCNICA A CLIENTES.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                  {maintenanceServices.length} Órdenes
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {pendingMaintenanceCount} Activas
                </span>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="inline-flex items-center text-xs font-black tracking-wider text-cyan-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors uppercase">
                ENTRAR <ChevronRight className="w-4 h-4 ml-0.5 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>

          {/* Card 3: ADMINISTRACIÓN */}
          <div
            onClick={() => onNavigate('administracion')}
            className="group relative bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            {/* Watermark users graphic background */}
            <div className="absolute right-3 top-4 text-slate-100 dark:text-slate-800/40 pointer-events-none transition-transform group-hover:scale-110">
              <Users className="w-28 h-28 opacity-60 dark:opacity-30 stroke-[1]" />
            </div>

            <div className="relative z-10">
              {/* Orange/Amber Icon Square */}
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 mb-5 transition-transform group-hover:scale-105">
                <Users className="w-6 h-6" />
              </div>

              <h3 className="text-xl sm:text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">
                ADMINISTRACIÓN
              </h3>

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                GESTIÓN DE PERSONAL, MATRIZ DE PERMISOS, BRANDING CORPORATIVO Y AUDITORÍA TÉCNICA.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {workers.length} Miembros
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  RBAC Activo
                </span>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="inline-flex items-center text-xs font-black tracking-wider text-amber-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors uppercase">
                CONFIGURAR <ChevronRight className="w-4 h-4 ml-0.5 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SYSTEM ACTIONS: RESET A 0 & IMPORTAR EXCEL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-black uppercase tracking-wider mb-2">
            <Trash2 className="w-3.5 h-3.5" />
            ADMINISTRACIÓN Y MIGRACIÓN DE BASES DE DATOS
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Poner el Sistema en 0 & Importar Bases de Datos Excel
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-medium">
            Deje todos los módulos en 0 (clientes, auditoría técnica, facturado, pasado, cobrado, comprobantes y liquidaciones) con un solo botón para importar sus archivos Excel (.xlsx) limpios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {canResetSystem && (
            <button
              onClick={onOpenResetModal}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 cursor-pointer active:scale-98"
              title="Poner en 0 todos los módulos del sistema en un solo clic"
            >
              <Trash2 className="w-4 h-4" />
              <span>PONER SISTEMA EN 0</span>
            </button>
          )}

          <button
            onClick={onOpenImportExcel}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-98"
            title="Importar base de clientes o remitos desde archivos Excel .xlsx"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>IMPORTAR DESDE EXCEL</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD GRÁFICO DE RENDIMIENTO MENSUAL (CARGADO, FACTURADO, COBRADO) */}
      <FinancialMetricsChart />

      {/* QUICK SUMMARY OVERVIEW STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Card 1: Próximas inspecciones */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Servicios de Pozo y Bombas
              </span>
              <Wrench className="w-4 h-4 text-cyan-500" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Inspecciones Técnicas Pendientes
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hay {pendingMaintenanceCount} órdenes en diagnóstico o ejecución para pozos y tableros.
            </p>
          </div>
          <button
            onClick={() => onNavigate('mantenimiento')}
            className="mt-4 flex items-center text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            Ver cuadrilla de campo <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {/* Quick Card 2: Stock Crítico */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Logística de Materiales
              </span>
              <Boxes className="w-4 h-4 text-amber-500" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Control de Stock en Depósito
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lowStockCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {lowStockCount} insumo(s) alcanzaron el umbral de reposición mínima.
                </span>
              ) : (
                'Todos los insumos de electricidad y cañerías están en niveles operativos seguros.'
              )}
            </p>
          </div>
          <button
            onClick={() => onNavigate('materiales')}
            className="mt-4 flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
          >
            Auditar inventario <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {/* Quick Card 3: Seguridad y Firebase */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Infraestructura Firebase
              </span>
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Reglas Firestore & Aislamiento
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Reglas de seguridad activas para multi-tenant con acceso restringido para empleados y capataces.
            </p>
          </div>
          <button
            onClick={onOpenFirebaseModal}
            className="mt-4 flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Examinar reglas firestore.rules <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
