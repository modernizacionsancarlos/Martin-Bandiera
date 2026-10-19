import React, { useState, useMemo } from 'react';
import {
  Users,
  Clock,
  DollarSign,
  FileSpreadsheet,
  Eye,
  X,
  Percent,
  Receipt,
  FileText,
  FileDown,
  CheckSquare,
  Square,
  Check,
  AlertCircle,
  HardHat
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth, getDeletedUsersTombstone } from '../context/AuthContext';
import { exportLiquidacionesToExcel } from '../utils/excelParser';
import { EmployeesManagementTab } from './EmployeesManagementTab';
import { WorkerLiquidationDetail } from '../types';
import { isAdministrativeProfile } from '../utils/calculationUtils';
import {
  generateSingleLiquidationReceiptPDF,
  generateBatchLiquidationReceiptsPDF
} from '../utils/liquidationPdfGenerator';

export const LiquidationEmployeesView: React.FC = () => {
  const { workers, technicalAuditRecords, technicalParameters } = useData();
  const { users } = useAuth();

  // Active Sub-tab
  const [activeTab, setActiveTab] = useState<'planilla' | 'personal'>('planilla');

  // View Filter: 'capataces' (default: strictly match Capataces nómina) vs 'all' (entire crew)
  const [viewFilter, setViewFilter] = useState<'capataces' | 'all'>('capataces');

  const [selectedWorkerName, setSelectedWorkerName] = useState<string | null>(null);

  // Multi-selection state for Grupal PDF generation
  const [selectedWorkerNames, setSelectedWorkerNames] = useState<Set<string>>(new Set());
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Active enabled Capataces strictly from nómina (workers + users, non-administrative, not deleted)
  const capatacesNomina = useMemo(() => {
    const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();
    const map = new Map<string, {
      name: string;
      email?: string;
      phone?: string;
      cuadrilla?: string;
      cargo?: string;
      capatazPercentage?: number;
      hourlyRate?: number;
    }>();

    workers.forEach(w => {
      const isCap = w.role === 'Capataz' || w.category === 'Capataz';
      if (!isCap || w.active === false || w.isAdministrative || isAdministrativeProfile(w)) return;
      const em = (w.email || '').toLowerCase().trim();
      const nm = (w.name || '').toLowerCase().trim();
      if (deletedUids.has(w.id) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return;
      if (!map.has(nm)) {
        map.set(nm, {
          name: w.name,
          email: w.email,
          phone: w.phone,
          cuadrilla: w.cuadrilla || 'Cuadrilla 1 - Valle de Uco',
          cargo: w.cargo || 'Capataz de Obra',
          capatazPercentage: w.capatazPercentage ?? 10,
          hourlyRate: w.hourlyRate
        });
      }
    });

    users.forEach(u => {
      const isCap = u.role === 'Capataz' || (u as any).category === 'Capataz';
      if (!isCap || u.active === false || u.isAdministrative || isAdministrativeProfile(u)) return;
      const em = (u.email || '').toLowerCase().trim();
      const nm = (u.displayName || '').toLowerCase().trim();
      if (deletedUids.has(u.uid) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return;
      if (!map.has(nm)) {
        map.set(nm, {
          name: u.displayName,
          email: u.email,
          phone: u.phone,
          cuadrilla: u.cuadrilla || 'Cuadrilla 1 - Valle de Uco',
          cargo: u.cargo || 'Capataz de Obra',
          capatazPercentage: u.capatazPercentage ?? 10,
          hourlyRate: u.hourlyRate
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [workers, users]);

  // Calculate liquidation metrics for each worker & helper
  const liquidationData: WorkerLiquidationDetail[] = useMemo(() => {
    const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();

    let targetNames: string[] = [];

    if (viewFilter === 'capataces') {
      // Strictly match the roster of employees that are Capataces
      targetNames = capatacesNomina.map(c => c.name);
    } else {
      // Full crew: combine registered active non-administrative workers and historical audit records
      targetNames = Array.from(
        new Set([
          ...workers
            .filter(w => {
              if (w.active === false || w.isAdministrative || isAdministrativeProfile(w)) return false;
              const em = (w.email || '').toLowerCase().trim();
              const nm = (w.name || '').toLowerCase().trim();
              if (deletedUids.has(w.id) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return false;
              return true;
            })
            .map(w => w.name),
          ...technicalAuditRecords.map(r => r.leadTech),
          ...technicalAuditRecords.flatMap(r => r.helpers || [])
        ])
      ).filter(name => {
        if (!name) return false;
        const cleanName = name.toLowerCase().trim();
        if (cleanName === 'sin capataz' || cleanName === 'ninguno' || cleanName === 'sin asignar') return false;
        return !deletedNames.has(cleanName);
      });
    }

    return targetNames.map(name => {
      // Find all records where this person is lead tech
      const leadRecords = technicalAuditRecords.filter(r => r.leadTech?.toLowerCase() === name.toLowerCase());
      // Find all records where this person is helper
      const helperRecords = technicalAuditRecords.filter(r =>
        (r.helpers || []).some(h => h.toLowerCase() === name.toLowerCase())
      );

      const totalServices = leadRecords.length + helperRecords.length;

      const hoursAsLead = leadRecords.reduce((acc, r) => acc + (r.hoursWorked || 0), 0);
      const hoursAsHelper = helperRecords.reduce((acc, r) => acc + (r.hoursWorked || 0), 0);
      const totalHours = Math.round((hoursAsLead + hoursAsHelper) * 10) / 10;

      const guardiasCount = [
        ...leadRecords.filter(r => r.isGuardia),
        ...helperRecords.filter(r => r.isGuardia)
      ].length;

      // Accumulated pay calculated
      const payAsLead = leadRecords.reduce((acc, r) => acc + (r.techPay || 0), 0);
      const payAsHelper = helperRecords.reduce((acc, r) => {
        // Individual helper share: helperPay / helpers.length
        const helpersCount = Math.max(1, (r.helpers || []).length);
        return acc + Math.round((r.helperPay || 0) / helpersCount);
      }, 0);

      // Worker or Capataz profile if registered
      const capProfile = capatacesNomina.find(c => c.name.toLowerCase() === name.toLowerCase());
      const profile = workers.find(w => w.name.toLowerCase() === name.toLowerCase());
      const isCapataz = Boolean(capProfile) || profile?.role === 'Capataz' || profile?.category === 'Capataz' || leadRecords.some(r => r.leadTech?.toLowerCase().includes('capataz'));
      const capatazPct = capProfile?.capatazPercentage ?? profile?.capatazPercentage ?? 10;

      // Capataz profit accumulated from services led
      const capatazProfitTotal = leadRecords.reduce((acc, r) => {
        if (r.capatazProfit !== undefined && r.capatazProfit > 0) return acc + r.capatazProfit;
        if (isCapataz) {
          const pct = r.capatazCommissionPct ?? capatazPct;
          return acc + Math.round((r.laborDirectCost || 0) * (pct / 100));
        }
        return acc;
      }, 0);

      const totalPay = payAsLead + payAsHelper + capatazProfitTotal;

      return {
        name,
        role: isCapataz ? 'Capataz' : profile?.role || (leadRecords.length > 0 ? 'Técnico' : 'Ayudante Especializado'),
        cargo: capProfile?.cargo || profile?.cargo || profile?.specialty || (isCapataz ? 'Capataz de Obra' : 'Ayudante de Cuadrilla'),
        isCapataz,
        capatazPercentage: capatazPct,
        cuadrilla: capProfile?.cuadrilla || profile?.cuadrilla || 'Cuadrilla 1 - Valle de Uco',
        phone: capProfile?.phone || profile?.phone,
        email: capProfile?.email || profile?.email,
        totalServices,
        totalHours,
        hoursAsLead,
        hoursAsHelper,
        guardiasCount,
        payAsLead,
        payAsHelper,
        capatazProfitTotal,
        totalPay,
        records: [...leadRecords, ...helperRecords]
      };
    }).sort((a, b) => b.totalPay - a.totalPay);
  }, [workers, technicalAuditRecords, viewFilter, capatacesNomina]);

  const selectedWorkerData = liquidationData.find(w => w.name === selectedWorkerName);

  // Selected workers list for batch PDF
  const selectedWorkersList = useMemo(() => {
    return liquidationData.filter(w => selectedWorkerNames.has(w.name));
  }, [liquidationData, selectedWorkerNames]);

  const selectedTotalPayroll = useMemo(() => {
    return selectedWorkersList.reduce((acc, w) => acc + w.totalPay, 0);
  }, [selectedWorkersList]);

  // Selection toggle handlers
  const toggleSelectWorker = (name: string) => {
    setSelectedWorkerNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedWorkerNames.size === liquidationData.length) {
      setSelectedWorkerNames(new Set());
    } else {
      setSelectedWorkerNames(new Set(liquidationData.map(w => w.name)));
    }
  };

  const isAllSelected = liquidationData.length > 0 && selectedWorkerNames.size === liquidationData.length;
  const isSomeSelected = selectedWorkerNames.size > 0 && selectedWorkerNames.size < liquidationData.length;

  // Individual PDF Receipt
  const handleDownloadSinglePDF = (worker: WorkerLiquidationDetail, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    generateSingleLiquidationReceiptPDF(worker);
    showFeedback(`Recibo PDF generado con éxito para ${worker.name}`);
  };

  // Batch / Grupal PDF for selected workers
  const handleDownloadBatchPDF = () => {
    if (selectedWorkersList.length === 0) return;
    generateBatchLiquidationReceiptsPDF(selectedWorkersList);
    showFeedback(`Recibos PDF generados para ${selectedWorkersList.length} operario(s) seleccionados`);
  };

  // Batch / Grupal PDF for ALL workers
  const handleDownloadAllPDF = () => {
    if (liquidationData.length === 0) return;
    generateBatchLiquidationReceiptsPDF(liquidationData);
    showFeedback(`Recibos PDF generados para toda la nómina (${liquidationData.length} operarios)`);
  };

  // Total payroll calculated
  const totalPayroll = liquidationData.reduce((acc, w) => acc + w.totalPay, 0);
  const totalCapatazProfitAll = liquidationData.reduce((acc, w) => acc + w.capatazProfitTotal, 0);
  const totalHoursWorkedAll = liquidationData.reduce((acc, w) => acc + w.totalHours, 0);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    exportLiquidacionesToExcel(liquidationData);
    showFeedback('Planilla Excel exportada con éxito');
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 text-white dark:bg-cyan-950 dark:text-cyan-100 border border-slate-700 dark:border-cyan-800 shadow-2xl backdrop-blur-xs text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Sub-Tab Navigation Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('planilla')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'planilla'
                ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Planilla de Liquidación</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'planilla'
                ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {liquidationData.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'personal'
                ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Nómina de Empleados y Cargos</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'personal'
                ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {workers.length}
            </span>
          </button>
        </div>

        {activeTab === 'planilla' && (
          <div className="flex flex-wrap items-center gap-2 ml-auto w-full sm:w-auto">
            {/* View Filter Pill Toggle: Capataces vs All */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setViewFilter('capataces');
                  setSelectedWorkerNames(new Set());
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewFilter === 'capataces'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Mostrar exclusivamente los empleados con perfil de Capataz habilitados"
              >
                <HardHat className="w-3.5 h-3.5" />
                <span>Solo Capataces ({capatacesNomina.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewFilter('all');
                  setSelectedWorkerNames(new Set());
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Mostrar todo el personal operativo de campo y ayudantes"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Toda la Cuadrilla</span>
              </button>
            </div>

            {/* Download ALL PDF */}
            <button
              onClick={handleDownloadAllPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
              title="Descargar todos los recibos en un único archivo PDF consolidado"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {viewFilter === 'capataces'
                  ? `PDF Nómina Capataces (${liquidationData.length})`
                  : `PDF Nómina Completa (${liquidationData.length})`}
              </span>
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx)</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: PLANILLA DE LIQUIDACIÓN */}
      {activeTab === 'planilla' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-black uppercase tracking-wider">
                  {viewFilter === 'capataces' ? 'Total Liquidación Capataces' : 'Total a Liquidar Cuadrillas'}
                </span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                ${(totalPayroll || 0).toLocaleString('es-AR')}
              </div>
              <span className="text-[11px] text-slate-400">Mano de obra + guardias + ganancias capataz</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-black uppercase tracking-wider">Comisiones Capataz</span>
                <Percent className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                ${(totalCapatazProfitAll || 0).toLocaleString('es-AR')}
              </div>
              <span className="text-[11px] text-slate-400">Ganancias configuradas sobre M.O. Directa</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-black uppercase tracking-wider">Horas Hombre Computadas</span>
                <Clock className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {(totalHoursWorkedAll || 0).toLocaleString()} HS
              </div>
              <span className="text-[11px] text-slate-400">Incluye horas campo y traslados logísticos</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-black uppercase tracking-wider">
                  {viewFilter === 'capataces' ? 'Capataces en Nómina' : 'Personal Operativo'}
                </span>
                {viewFilter === 'capataces' ? (
                  <HardHat className="w-4 h-4 text-amber-500" />
                ) : (
                  <Users className="w-4 h-4 text-purple-500" />
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {liquidationData.length} {viewFilter === 'capataces' ? 'Capataces' : 'Operarios'}
                </span>
                <button
                  onClick={() => setActiveTab('personal')}
                  className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Ver nómina →
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                {capatacesNomina.length} Capataces registrados activos
              </span>
            </div>
          </div>

          {/* Selection Banner when workers are checked */}
          {selectedWorkerNames.size > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-slate-900/5 to-emerald-500/10 dark:from-cyan-950/40 dark:via-slate-900/60 dark:to-emerald-950/40 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500 text-slate-950 font-black">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {selectedWorkerNames.size} de {liquidationData.length} operarios seleccionados
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Subtotal: ${(selectedTotalPayroll || 0).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Genera el comprobante grupal en PDF con resumen y recibo individual para cada uno de los seleccionados.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleDownloadBatchPDF}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Descargar Recibos PDF Seleccionados ({selectedWorkerNames.size})</span>
                </button>
                <button
                  onClick={() => setSelectedWorkerNames(new Set())}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Deseleccionar
                </button>
              </div>
            </div>
          )}

          {/* Liquidation Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>
                    {viewFilter === 'capataces'
                      ? 'Planilla de Liquidación — Capataces de Obra'
                      : 'Planilla de Liquidación y Desempeño Operativo General'}
                  </span>
                  {viewFilter === 'capataces' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Solo Capataces
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {viewFilter === 'capataces'
                    ? 'Esta vista coincide estrictamente con la nómina de empleados con cargo o rol de Capataz habilitados.'
                    : 'Personal operativo total registrado en el sistema y colaboraciones históricas en remitos.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Deseleccionar Todos</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Seleccionar Todos ({liquidationData.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-black text-slate-500 dark:text-slate-400 text-[11px] tracking-wider uppercase whitespace-nowrap">
                    <th className="p-4 text-center w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={input => {
                          if (input) input.indeterminate = isSomeSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        title="Seleccionar / deseleccionar todos"
                      />
                    </th>
                    <th className="p-4">
                      {viewFilter === 'capataces' ? 'CAPATAZ DE OBRA' : 'PERSONAL / TÉCNICO'}
                    </th>
                    <th className="p-4">ROL / CARGO</th>
                    <th className="p-4 text-center">SERVICIOS</th>
                    <th className="p-4 text-right">HORAS TOTALES</th>
                    <th className="p-4 text-center">GUARDIAS</th>
                    <th className="p-4 text-right">PAGO TÉCNICO</th>
                    <th className="p-4 text-right">PAGO AYUDANTE</th>
                    <th className="p-4 text-right">GANANCIA CAPATAZ</th>
                    <th className="p-4 text-right">TOTAL A LIQUIDAR</th>
                    <th className="p-4 text-center">ACCIONES RECIBO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {liquidationData.map(worker => {
                    const isSelected = selectedWorkerNames.has(worker.name);
                    return (
                      <tr
                        key={worker.name}
                        onClick={() => toggleSelectWorker(worker.name)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-50/70 dark:bg-cyan-950/25'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectWorker(worker.name)}
                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{worker.name}</span>
                            {worker.isCapataz && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                CAP ({worker.capatazPercentage}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {worker.cargo || worker.role}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {worker.totalServices}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {worker.totalHours} hs
                        </td>
                        <td className="p-4 text-center">
                          {worker.guardiasCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {worker.guardiasCount} Guardias
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">0</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">
                          ${(worker.payAsLead || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-400">
                          ${(worker.payAsHelper || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="p-4 text-right font-mono whitespace-nowrap">
                          {worker.capatazProfitTotal > 0 ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              ${(worker.capatazProfitTotal || 0).toLocaleString('es-AR')}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                          ${(worker.totalPay || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Individual PDF Receipt Download Button */}
                            <button
                              onClick={e => handleDownloadSinglePDF(worker, e)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-all"
                              title="Descargar Recibo Oficial Individual (PDF)"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Recibo PDF</span>
                            </button>

                            {/* View Detail Modal Button */}
                            <button
                              onClick={() => setSelectedWorkerName(worker.name)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-all"
                              title="Ver desglose y reportes detallados"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {liquidationData.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 mb-3 border border-amber-500/20">
                            <HardHat className="w-8 h-8" />
                          </div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {viewFilter === 'capataces'
                              ? 'No se encontraron Capataces registrados en la nómina activa.'
                              : 'No hay personal registrado en el sistema.'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 mb-4">
                            Puede dar de alta y asignar el rol de Capataz desde la pestaña "Nómina de Empleados y Cargos".
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('personal')}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-xs cursor-pointer"
                          >
                            Ir a Nómina de Empleados →
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: NÓMINA DE EMPLEADOS Y CARGOS */}
      {activeTab === 'personal' && (
        <EmployeesManagementTab onSelectWorkerForDetail={setSelectedWorkerName} />
      )}

      {/* Worker Detail Modal with PDF download */}
      {selectedWorkerData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-500">
                  Desglose de Liquidación Individual
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{selectedWorkerData.name}</span>
                  {selectedWorkerData.isCapataz && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Capataz ({selectedWorkerData.capatazPercentage}%)
                    </span>
                  )}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedWorkerData.cargo || selectedWorkerData.role} · {selectedWorkerData.cuadrilla}
                </span>
              </div>
              <button
                onClick={() => setSelectedWorkerName(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 text-[10px] block">Horas Acumuladas:</span>
                <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {selectedWorkerData.totalHours} HS
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 text-[10px] block">Servicios Totales:</span>
                <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {selectedWorkerData.totalServices}
                </span>
              </div>

              {selectedWorkerData.capatazProfitTotal > 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/20">
                  <span className="text-amber-600 dark:text-amber-400 text-[10px] block font-bold">Comisión Capataz:</span>
                  <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                    ${(selectedWorkerData.capatazProfitTotal || 0).toLocaleString('es-AR')}
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-slate-400 text-[10px] block">Guardias Realizadas:</span>
                  <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                    {selectedWorkerData.guardiasCount}
                  </span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20">
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block font-bold">Total a Liquidar:</span>
                <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
                  ${(selectedWorkerData.totalPay || 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Detailed list of services */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Reportes en los que participó ({selectedWorkerData.records.length})
                </h4>
                <span className="text-[11px] text-slate-400">
                  Detalle que se incluirá en el recibo PDF oficial
                </span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {selectedWorkerData.records.map(r => {
                  const isLead = r.leadTech?.toLowerCase() === selectedWorkerData.name.toLowerCase();
                  const helpersCount = Math.max(1, (r.helpers || []).length);
                  let workerShare = 0;
                  let rolBadge = '';

                  if (isLead) {
                    const capProfit = selectedWorkerData.isCapataz
                      ? (r.capatazProfit || Math.round((r.laborDirectCost || 0) * (selectedWorkerData.capatazPercentage / 100)))
                      : 0;
                    workerShare = (r.techPay || 0) + capProfit;
                    rolBadge = selectedWorkerData.isCapataz ? 'Capataz' : 'Técnico';
                  } else {
                    workerShare = Math.round((r.helperPay || 0) / helpersCount);
                    rolBadge = 'Ayudante';
                  }

                  return (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{r.remitoId}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {rolBadge}
                          </span>
                          <span className="text-slate-400 text-[11px]">{r.date}</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-xs sm:max-w-md mt-0.5">
                          {r.clientName} - {r.workPoint}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">
                          ${(workerShare || 0).toLocaleString('es-AR')}
                        </span>
                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
                          <span>{r.hoursWorked} hs</span>
                          {r.isGuardia && (
                            <span className="text-[9px] font-black text-amber-500 uppercase">GD</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                onClick={() => handleDownloadSinglePDF(selectedWorkerData)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Descargar Recibo Oficial (PDF)</span>
              </button>

              <button
                onClick={() => setSelectedWorkerName(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
