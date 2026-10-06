import React from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';

interface AdminOperativaHeaderProps {
  onOpenNewReport: () => void;
  onOpenImportExcel: () => void;
}

export const AdminOperativaHeader: React.FC<AdminOperativaHeaderProps> = ({
  onOpenNewReport,
  onOpenImportExcel
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            CONSOLA DE GESTIÓN & AUDITORÍA MAESTRA
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Administración Operativa – JOB Martin Bandiera
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cálculos automáticos de logística, mano de obra, guardias técnicas y liquidaciones de cuadrilla.
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={onOpenImportExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          title="Importar base de datos de remitos o clientes desde Excel"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>IMPORTAR EXCEL</span>
        </button>
        <button
          type="button"
          onClick={onOpenNewReport}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
          title="Cargar nuevo remito o reporte de campo"
        >
          <Plus className="w-4 h-4" />
          <span>NUEVO REPORTE DE CAMPO</span>
        </button>
      </div>
    </div>
  );
};
