import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  CheckCircle,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  Info
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, exportFinancialReportToPDF, exportFinancialReportToExcel } from '../utils/exportUtils';

export const FinancialMetricsChart: React.FC = () => {
  const {
    monthlyPerformance,
    financialReports,
    totalCargado,
    totalFacturado,
    totalCobrado,
    totalPendiente,
    collectionRate
  } = useData();

  const { canViewFinancials, currentUser } = useAuth();
  const { themeClasses } = useTheme();

  const [activeTab, setActiveTab] = useState<'barras' | 'tendencia' | 'distribucion'>('barras');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // If role is restricted (Capataz or Empleado)
  if (!canViewFinancials) {
    return (
      <div className="w-full bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-6 my-6 text-center transition-all">
        <div className="max-w-xl mx-auto flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Métricas Financieras y Estado de Cuenta Restringido
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            Tu rol actual ({currentUser.role}) no tiene permisos para consultar los montos financieros de{' '}
            <strong className="text-slate-800 dark:text-slate-200">Cargado, Facturado y Cobrado</strong>. Esta sección está reservada exclusivamente para Gerencia, Socios y Administradores de Martin Bandiera.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Para solicitar acceso a estos indicadores, comuníquese con la Dirección General o Administración.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Find max value for bar height calculations
  const maxMonthlyVal = Math.max(
    ...monthlyPerformance.map(m => Math.max(m.cargado, m.facturado, m.cobrado, 1)),
    1000000
  );

  // Highlighted month data for details
  const activeMonthData = selectedMonth
    ? monthlyPerformance.find(m => m.monthKey === selectedMonth)
    : monthlyPerformance[monthlyPerformance.length - 1];

  return (
    <section className="w-full my-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden transition-all">
      {/* Header bar of the dashboard section */}
      <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Estado de Cuenta Ejecutivo
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Consolidado 2026
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Métricas de Rendimiento Mensual: Cargado, Facturado y Cobrado
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Monitoreo en tiempo real del flujo financiero de obras de ingeniería y servicios de mantenimiento de JOB Martin Bandiera.
          </p>
        </div>

        {/* Quick export buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() =>
              exportFinancialReportToPDF(financialReports, {
                userName: currentUser.displayName,
                userRole: currentUser.role
              })
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
            title="Exportar informe detallado en formato PDF"
          >
            <FileText className="w-3.5 h-3.5 text-red-400" />
            <span>Exportar PDF</span>
          </button>

          <button
            onClick={() =>
              exportFinancialReportToExcel(financialReports, {
                userName: currentUser.displayName
              })
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer"
            title="Exportar planilla completa en Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* KPI 1: Cargado */}
        <div className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Cargado
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(totalCargado)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Costo & Obras</span> cargadas
          </p>
        </div>

        {/* KPI 2: Facturado */}
        <div className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Facturado
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
            {formatCurrency(totalFacturado)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">Emisión formal</span> con AFIP
          </p>
        </div>

        {/* KPI 3: Cobrado */}
        <div className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Cobrado
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatCurrency(totalCobrado)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Recaudación neta</span> en cuenta
          </p>
        </div>

        {/* KPI 4: Saldo Pendiente */}
        <div className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pendiente de Cobro
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
            {formatCurrency(totalPendiente)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Saldo exigible de clientes
          </p>
        </div>

        {/* KPI 5: Ratio Efectividad */}
        <div className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Efectividad Cobro
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">
            {collectionRate.toFixed(1)}%
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-purple-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, collectionRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Chart Container */}
      <div className="p-6 md:p-8">
        {/* Controls & Legend */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Chart representation mode buttons */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('barras')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'barras'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Barras Comparativas
            </button>
            <button
              onClick={() => setActiveTab('tendencia')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tendencia'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Curvas de Tendencia
            </button>
            <button
              onClick={() => setActiveTab('distribucion')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'distribucion'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Balance de Cobro
            </button>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-cyan-400 dark:bg-cyan-500" />
              <span>Cargado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-600" />
              <span>Facturado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>Cobrado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500" />
              <span>Pendiente</span>
            </div>
          </div>
        </div>

        {/* View 1: Comparative Bars */}
        {activeTab === 'barras' && (
          <div className="space-y-4">
            <div className="h-64 sm:h-72 w-full flex items-end justify-between gap-2 sm:gap-4 pt-8 pb-2 px-2 sm:px-4 border-b border-slate-200 dark:border-slate-800">
              {monthlyPerformance.map(m => {
                const isSelected = selectedMonth === m.monthKey;
                const hCargado = Math.max(6, Math.round((m.cargado / maxMonthlyVal) * 100));
                const hFacturado = Math.max(6, Math.round((m.facturado / maxMonthlyVal) * 100));
                const hCobrado = Math.max(6, Math.round((m.cobrado / maxMonthlyVal) * 100));

                return (
                  <div
                    key={m.monthKey}
                    onClick={() => setSelectedMonth(isSelected ? null : m.monthKey)}
                    className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer p-1 rounded-xl transition-all ${
                      isSelected ? 'bg-cyan-50/80 dark:bg-cyan-950/40 ring-2 ring-cyan-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Tooltip on hover */}
                    <div className="hidden group-hover:flex absolute -translate-y-44 bg-slate-900 text-white text-[11px] p-2.5 rounded-xl shadow-xl z-20 flex-col gap-1 min-w-[170px] pointer-events-none">
                      <p className="font-bold text-cyan-300 border-b border-slate-700 pb-1 mb-1">
                        {m.monthFullName}
                      </p>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cargado:</span>
                        <span className="font-semibold text-cyan-300">{formatCurrency(m.cargado)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Facturado:</span>
                        <span className="font-semibold text-blue-300">{formatCurrency(m.facturado)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cobrado:</span>
                        <span className="font-semibold text-emerald-300">{formatCurrency(m.cobrado)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-1 text-[10px]">
                        <span className="text-amber-400">Saldo:</span>
                        <span className="font-bold text-amber-400">{formatCurrency(m.pendiente)}</span>
                      </div>
                    </div>

                    {/* Bars Trio */}
                    <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                      {/* Cargado */}
                      <div
                        className="w-1.5 sm:w-2.5 md:w-3.5 bg-cyan-400 dark:bg-cyan-500 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                        style={{ height: `${hCargado}%` }}
                        title={`Cargado: ${formatCurrency(m.cargado)}`}
                      />
                      {/* Facturado */}
                      <div
                        className="w-1.5 sm:w-2.5 md:w-3.5 bg-blue-600 rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs"
                        style={{ height: `${hFacturado}%` }}
                        title={`Facturado: ${formatCurrency(m.facturado)}`}
                      />
                      {/* Cobrado */}
                      <div
                        className="w-1.5 sm:w-2.5 md:w-3.5 bg-emerald-500 rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs"
                        style={{ height: `${hCobrado}%` }}
                        title={`Cobrado: ${formatCurrency(m.cobrado)}`}
                      />
                    </div>

                    {/* Label below bar */}
                    <span className={`text-[10px] sm:text-xs mt-2 font-bold ${
                      isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {m.monthName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View 2: SVG Trend Curves */}
        {activeTab === 'tendencia' && (
          <div className="w-full pt-4 pb-2">
            <div className="relative h-64 sm:h-72 w-full">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 900 240" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gradCargado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="gradFacturado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="gradCobrado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 60, 120, 180, 240].map(y => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="900"
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Generate polyline points */}
                {(() => {
                  const stepX = 900 / (monthlyPerformance.length - 1 || 1);
                  const getPoints = (key: 'cargado' | 'facturado' | 'cobrado') => {
                    return monthlyPerformance
                      .map((m, i) => {
                        const x = i * stepX;
                        const y = 220 - (m[key] / maxMonthlyVal) * 190;
                        return `${x},${y}`;
                      })
                      .join(' ');
                  };

                  const pointsCargado = getPoints('cargado');
                  const pointsFacturado = getPoints('facturado');
                  const pointsCobrado = getPoints('cobrado');

                  return (
                    <>
                      {/* Line: Facturado */}
                      <polyline
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        points={pointsFacturado}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Line: Cobrado */}
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.5"
                        points={pointsCobrado}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Line: Cargado */}
                      <polyline
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2.5"
                        strokeDasharray="5 5"
                        points={pointsCargado}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Dots on Cobrado */}
                      {monthlyPerformance.map((m, i) => {
                        const x = i * stepX;
                        const y = 220 - (m.cobrado / maxMonthlyVal) * 190;
                        return (
                          <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="5"
                            className="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2"
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Bottom labels for trend */}
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-2 mt-3">
              {monthlyPerformance.map(m => (
                <span key={m.monthKey}>{m.monthName}</span>
              ))}
            </div>
          </div>
        )}

        {/* View 3: Distribution & Breakdown */}
        {activeTab === 'distribucion' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Relación Facturación vs. Cobranza Acumulada
              </h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Total Percibido (Cobrado)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {collectionRate.toFixed(1)}% ({formatCurrency(totalCobrado)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${collectionRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Saldo Exigible (Pendiente)</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {(100 - collectionRate).toFixed(1)}% ({formatCurrency(totalPendiente)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${100 - collectionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  El índice de cobranza del <strong>{collectionRate.toFixed(1)}%</strong> se sitúa en niveles óptimos de liquidez operativa para el sostenimiento de compra de materiales y cuadrillas de obra.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Estado del Mes Seleccionado ({activeMonthData ? activeMonthData.monthFullName : 'Actual'})
              </h4>

              {activeMonthData ? (
                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs py-1.5 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Cargado en partes y presupuestos:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(activeMonthData.cargado)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1.5 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Facturado en el mes:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(activeMonthData.facturado)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1.5 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Cobrado en cuenta:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(activeMonthData.cobrado)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1.5 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Saldo pendiente de ese período:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(activeMonthData.pendiente)}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Efectividad de Cobro:</span>
                    <span className="font-extrabold text-purple-600 dark:text-purple-400">
                      {activeMonthData.efectividadCobro.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Selected Month Details card (if selected on bar chart) */}
        {selectedMonth && activeMonthData && (
          <div className="mt-4 p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Detalle específico de {activeMonthData.monthFullName}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Cargado: {formatCurrency(activeMonthData.cargado)} • Facturado: {formatCurrency(activeMonthData.facturado)} • Cobrado: {formatCurrency(activeMonthData.cobrado)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700">
                Saldo pendiente: {formatCurrency(activeMonthData.pendiente)}
              </span>
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
