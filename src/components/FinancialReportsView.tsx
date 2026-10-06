import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Lock,
  Download,
  DollarSign,
  Receipt,
  CheckCircle2,
  Clock,
  Trash2,
  Calendar,
  Building,
  AlertCircle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, exportFinancialReportToPDF, exportFinancialReportToExcel } from '../utils/exportUtils';
import { FinancialMetricRecord } from '../types';

interface FinancialReportsViewProps {
  onOpenNewReport: () => void;
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({ onOpenNewReport }) => {
  const { financialReports, deleteFinancialReport } = useData();
  const { canViewFinancials, currentUser } = useAuth();
  const { themeClasses } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');

  // If role is restricted
  if (!canViewFinancials) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-lg">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Acceso Restringido a Finanzas y Facturación
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-lg mx-auto">
          El estado de cuenta, facturación y reportes de cobranza son confidenciales y solo pueden ser consultados por socios y personal gerencial de Martin Bandiera.
        </p>
        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 max-w-md mx-auto text-left flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <span>
            Para acceder a esta información o generar reportes PDF/Excel, cambie al perfil de <strong>SuperAdmin</strong> o <strong>Gerente</strong> desde el selector superior.
          </span>
        </div>
      </div>
    );
  }

  // Filter items
  const filteredReports = financialReports.filter(report => {
    const matchesSearch =
      report.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPeriod = selectedPeriod === 'todos' || report.period === selectedPeriod;
    const matchesCategory = selectedCategory === 'todas' || report.category === selectedCategory;
    const matchesStatus = selectedStatus === 'todos' || report.status === selectedStatus;

    return matchesSearch && matchesPeriod && matchesCategory && matchesStatus;
  });

  // Calculate totals for filtered
  const filteredCargado = filteredReports.reduce((s, r) => s + (r.cargado || 0), 0);
  const filteredFacturado = filteredReports.reduce((s, r) => s + (r.facturado || 0), 0);
  const filteredCobrado = filteredReports.reduce((s, r) => s + (r.cobrado || 0), 0);
  const filteredPendiente = Math.max(0, filteredFacturado - filteredCobrado);

  const periodsList = Array.from(new Set(financialReports.map(r => r.period))).sort().reverse();

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              Módulo Contable & Operativo
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Reportes Detallados y Estado de Cuenta
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consulta cruzada de montos cargados, facturados emitidos y cobranzas efectivas por cliente y obra.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() =>
              exportFinancialReportToPDF(filteredReports, {
                userName: currentUser.displayName,
                userRole: currentUser.role
              })
            }
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4 text-red-400" />
            <span>Descargar PDF</span>
          </button>

          <button
            onClick={() =>
              exportFinancialReportToExcel(filteredReports, {
                userName: currentUser.displayName
              })
            }
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel</span>
          </button>

          <button
            onClick={onOpenNewReport}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold ${themeClasses.buttonClass} transition-all shadow-md cursor-pointer`}
          >
            <Plus className="w-4 h-4" />
            <span>Cargar Reporte</span>
          </button>
        </div>
      </div>

      {/* Filtered Subtotal strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400">Cargado Filtrado</span>
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(filteredCargado)}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-blue-500">Facturado Filtrado</span>
          <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(filteredFacturado)}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-emerald-500">Cobrado Filtrado</span>
          <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(filteredCobrado)}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-amber-500">Saldo Pendiente</span>
          <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(filteredPendiente)}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, proyecto o código (ej: Alto Valle, FAC-2026)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Period Filter */}
        <select
          value={selectedPeriod}
          onChange={e => setSelectedPeriod(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
        >
          <option value="todos">Todos los Períodos (2026)</option>
          {periodsList.map(p => (
            <option key={p} value={p}>
              Período {p}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
        >
          <option value="todas">Todas las Categorías</option>
          <option value="Obras">Obras</option>
          <option value="Mantenimiento">Mantenimiento</option>
          <option value="Logística">Logística</option>
          <option value="Asistencia Técnica">Asistencia Técnica</option>
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
        >
          <option value="todos">Todos los Estados</option>
          <option value="Cobrado">Cobrado Total</option>
          <option value="Facturado Parcial">Facturado Parcial</option>
          <option value="En Gestión">En Gestión</option>
        </select>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3.5 px-4">Código / Período</th>
                <th className="py-3.5 px-4">Cliente & Proyecto</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-right">Cargado</th>
                <th className="py-3.5 px-4 text-right">Facturado</th>
                <th className="py-3.5 px-4 text-right">Cobrado</th>
                <th className="py-3.5 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No se encontraron reportes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredReports.map(report => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-mono font-bold text-slate-900 dark:text-white">
                        {report.code}
                      </p>
                      <p className="text-[10px] text-slate-400">{report.periodLabel}</p>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {report.clientName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {report.projectName}
                      </p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {report.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCurrency(report.cargado)}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {formatCurrency(report.facturado)}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(report.cobrado)}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {formatCurrency(report.pendingBalance)}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          report.status === 'Cobrado'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : report.status === 'Facturado Parcial'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => deleteFinancialReport(report.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Eliminar reporte"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
