import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Trash2,
  X,
  Database,
  Building2,
  FileCheck2,
  FolderArchive,
  DollarSign,
  Boxes,
  Sparkles
} from 'lucide-react';
import { useData } from '../context/DataContext';

interface ResetSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetSystemModal: React.FC<ResetSystemModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const {
    technicalAuditRecords,
    clients,
    materials,
    archivedReceipts,
    financialReports,
    clearSystemToZero,
    clearDemoDataOnly,
    resetAllData
  } = useData();

  const [clearAudits, setClearAudits] = useState(true);
  const [clearClients, setClearClients] = useState(true);
  const [clearMaterials, setClearMaterials] = useState(true);
  const [clearReceipts, setClearReceipts] = useState(true);
  const [clearFinancials, setClearFinancials] = useState(true);

  const [confirmInput, setConfirmInput] = useState('');
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [actionDone, setActionDone] = useState<'cleared' | 'restored' | 'demo_cleared' | null>(null);

  if (!isOpen) return null;

  const handleSelectAll = (val: boolean) => {
    setClearAudits(val);
    setClearClients(val);
    setClearMaterials(val);
    setClearReceipts(val);
    setClearFinancials(val);
  };

  const handleResetAllToZero = () => {
    clearSystemToZero({
      clearAudits: true,
      clearClients: true,
      clearMaterials: true,
      clearReceipts: true,
      clearFinancials: true
    });

    setActionDone('cleared');
    setIsSuccessMessage(true);
    if (onSuccess) onSuccess();

    setTimeout(() => {
      setIsSuccessMessage(false);
      onClose();
    }, 1800);
  };

  const handleExecuteClear = () => {
    clearSystemToZero({
      clearAudits,
      clearClients,
      clearMaterials,
      clearReceipts,
      clearFinancials
    });

    setActionDone('cleared');
    setIsSuccessMessage(true);
    if (onSuccess) onSuccess();

    setTimeout(() => {
      setIsSuccessMessage(false);
      onClose();
    }, 1800);
  };

  const handleClearDemoOnly = async () => {
    await clearDemoDataOnly();
    setActionDone('demo_cleared');
    setIsSuccessMessage(true);
    if (onSuccess) onSuccess();

    setTimeout(() => {
      setIsSuccessMessage(false);
      onClose();
    }, 1800);
  };

  const handleRestoreDemoData = () => {
    resetAllData();
    setActionDone('restored');
    setIsSuccessMessage(true);
    if (onSuccess) onSuccess();

    setTimeout(() => {
      setIsSuccessMessage(false);
      onClose();
    }, 1800);
  };

  const cargadosCount = technicalAuditRecords.filter(r => r.status === 'Cargado').length;
  const facturadosCount = technicalAuditRecords.filter(r => r.status === 'Facturado').length;
  const pasadosCount = technicalAuditRecords.filter(r => r.status === 'Pasado').length;
  const cobradosCount = technicalAuditRecords.filter(r => r.status === 'Cobrado').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccessMessage ? (
          <div className="py-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800 animate-in zoom-in">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {actionDone === 'cleared'
                ? '¡Sistema en 0 Exitosamente!'
                : actionDone === 'demo_cleared'
                ? '¡Datos Demo Eliminados Definitivamente!'
                : '¡Datos Demo Restaurados!'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {actionDone === 'cleared'
                ? 'Todos los módulos han quedado en 0. Ahora puede importar sus bases de datos limpias desde archivos Excel (.xlsx).'
                : actionDone === 'demo_cleared'
                ? 'Se han eliminado los registros de muestra predeterminados. Las publicaciones y reinicios mantendrán tus datos reales limpios.'
                : 'Se han recargado los datos de demostración predeterminados de Martin Bandiera.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  REINICIO TOTAL · BASE DE DATOS
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Poner Todo el Sistema en 0
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Vacíe todos los datos del sistema con un solo clic para comenzar la carga real de su empresa mediante importación de archivos Excel sin datos de prueba demo.
                </p>
              </div>
            </div>

            {/* ONE-CLICK PRIMARY ACTION CARD */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-2 border-rose-500/30 dark:border-rose-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 uppercase tracking-wide flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Un Solo Botón: Reinicio Completo a 0
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Pone en 0 todos los módulos simultáneamente en un solo clic:
                  </p>
                </div>
              </div>

              {/* Module badges summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">CLIENTES</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {clients.length} → 0
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">MATERIALES</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {materials.length} → 0
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">AUDIT. TÉCNICA</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {cargadosCount} → 0
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">FACTURADO</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {facturadosCount} → 0
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">PASADO</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {pasadosCount} → 0
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">COBRADO</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {cobradosCount} → 0
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">COMPROBANTES</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {archivedReceipts.length} → 0
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">FINANZAS</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {financialReports.length} → 0
                  </span>
                </div>
              </div>

              {/* The Big One-Click Button */}
              <button
                type="button"
                onClick={handleResetAllToZero}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl text-sm font-black text-white bg-rose-600 hover:bg-rose-500 active:scale-98 transition shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
                <span>PONER TODO EL SISTEMA EN 0 (1 SOLO CLIC)</span>
              </button>
            </div>

            {/* SELECTIVE OPTIONS ACCORDION */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  O vaciar módulos individualmente:
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(!clearAudits)}
                  className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  {clearAudits && clearClients && clearMaterials && clearReceipts && clearFinancials
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </button>
              </div>

              {/* Remitos & Auditoría */}
              <label className="flex items-center justify-between cursor-pointer py-1.5 hover:bg-slate-100/60 dark:hover:bg-slate-700/30 px-2 rounded-lg transition">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={clearAudits}
                    onChange={e => setClearAudits(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Remitos y Auditorías Técnicas (Cargado, Facturado, Pasado, Cobrado)
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-bold">
                  {technicalAuditRecords.length} remitos
                </span>
              </label>

              {/* Clientes */}
              <label className="flex items-center justify-between cursor-pointer py-1.5 hover:bg-slate-100/60 dark:hover:bg-slate-700/30 px-2 rounded-lg transition">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={clearClients}
                    onChange={e => setClearClients(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Base de Datos de Clientes & Fincas
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-bold">
                  {clients.length} clientes
                </span>
              </label>

              {/* Materiales */}
              <label className="flex items-center justify-between cursor-pointer py-1.5 hover:bg-slate-100/60 dark:hover:bg-slate-700/30 px-2 rounded-lg transition">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={clearMaterials}
                    onChange={e => setClearMaterials(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Catálogo de Materiales, Insumos & Equipamiento
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-bold">
                  {materials.length} materiales
                </span>
              </label>

              {/* Comprobantes */}
              <label className="flex items-center justify-between cursor-pointer py-1.5 hover:bg-slate-100/60 dark:hover:bg-slate-700/30 px-2 rounded-lg transition">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={clearReceipts}
                    onChange={e => setClearReceipts(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-2">
                    <FolderArchive className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Archivo Digital de Comprobantes & Recibos
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-bold">
                  {archivedReceipts.length} comprobantes
                </span>
              </label>

              {/* Métricas Financieras */}
              <label className="flex items-center justify-between cursor-pointer py-1.5 hover:bg-slate-100/60 dark:hover:bg-slate-700/30 px-2 rounded-lg transition">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={clearFinancials}
                    onChange={e => setClearFinancials(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Reportes y Métricas Financieras
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 font-bold">
                  {financialReports.length} reportes
                </span>
              </label>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteClear}
                  disabled={!clearAudits && !clearClients && !clearMaterials && !clearReceipts && !clearFinancials}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 disabled:opacity-50 transition cursor-pointer"
                >
                  Vaciar Solo Módulos Marcados
                </button>
              </div>
            </div>

            {/* Note & Demo purge/restore */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cerrar sin cambios
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClearDemoOnly}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 transition cursor-pointer"
                  title="Elimina solo los remitos y datos de ejemplo iniciales (AUD-376 a 363)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar solo datos Demo</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestoreDemoData}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition cursor-pointer"
                  title="Recarga los datos de ejemplo iniciales"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar datos Demo</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
