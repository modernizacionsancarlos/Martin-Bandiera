import React, { useState } from 'react';
import { X, DollarSign, Receipt, CheckCircle, Calendar, Building, FileText } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FinancialMetricRecord } from '../types';

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewReportModal: React.FC<NewReportModalProps> = ({ isOpen, onClose }) => {
  const { addFinancialReport, financialReports, clients } = useData();
  const { currentUser } = useAuth();
  const { themeClasses } = useTheme();

  const [period, setPeriod] = useState('2026-09');
  const [periodLabel, setPeriodLabel] = useState('Septiembre 2026');
  const [clientName, setClientName] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState<FinancialMetricRecord['category']>('Obras');
  const [cargado, setCargado] = useState(15000000);
  const [facturado, setFacturado] = useState(20000000);
  const [cobrado, setCobrado] = useState(12000000);
  const [status, setStatus] = useState<FinancialMetricRecord['status']>('Facturado Parcial');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !projectName) return;

    addFinancialReport({
      period,
      periodLabel,
      clientName,
      projectName,
      code: `FAC-2026-${(140 + financialReports.length + 1).toString()}`,
      cargado: Number(cargado) || 0,
      facturado: Number(facturado) || 0,
      cobrado: Number(cobrado) || 0,
      status,
      date: new Date().toISOString().split('T')[0],
      category,
      createdBy: currentUser.email,
      notes
    });

    onClose();
  };

  const handlePeriodChange = (val: string) => {
    setPeriod(val);
    const monthNames: Record<string, string> = {
      '2026-01': 'Enero 2026',
      '2026-02': 'Febrero 2026',
      '2026-03': 'Marzo 2026',
      '2026-04': 'Abril 2026',
      '2026-05': 'Mayo 2026',
      '2026-06': 'Junio 2026',
      '2026-07': 'Julio 2026',
      '2026-08': 'Agosto 2026',
      '2026-09': 'Septiembre 2026',
      '2026-10': 'Octubre 2026',
      '2026-11': 'Noviembre 2026',
      '2026-12': 'Diciembre 2026'
    };
    setPeriodLabel(monthNames[val] || val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto p-5 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Cargar Reporte Contable y de Obra
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Registra los montos de Cargado, Facturado y Cobrado para el estado de cuenta.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Período / Mes
              </label>
              <select
                value={period}
                onChange={e => handlePeriodChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
              >
                <option value="2026-01">Enero 2026</option>
                <option value="2026-02">Febrero 2026</option>
                <option value="2026-03">Marzo 2026</option>
                <option value="2026-04">Abril 2026</option>
                <option value="2026-05">Mayo 2026</option>
                <option value="2026-06">Junio 2026</option>
                <option value="2026-07">Julio 2026</option>
                <option value="2026-08">Agosto 2026</option>
                <option value="2026-09">Septiembre 2026</option>
                <option value="2026-10">Octubre 2026</option>
                <option value="2026-11">Noviembre 2026</option>
                <option value="2026-12">Diciembre 2026</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
              >
                <option value="Obras">Obras</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Logística">Logística</option>
                <option value="Asistencia Técnica">Asistencia Técnica</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nombre del Cliente *
            </label>
            <input
              type="text"
              required
              placeholder="Buscar o escribir cliente de la base de datos..."
              value={clientName}
              onFocus={() => setShowClientDropdown(true)}
              onChange={e => {
                setClientName(e.target.value);
                setShowClientDropdown(true);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 font-medium"
            />
            {showClientDropdown && clients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-44 overflow-y-auto z-30 p-1 divide-y divide-slate-100 dark:divide-slate-800">
                {clients
                  .filter(c => c.razonSocial.toLowerCase().includes(clientName.toLowerCase()))
                  .slice(0, 8)
                  .map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setClientName(c.razonSocial);
                        if (!projectName && c.fincaLocacion) {
                          setProjectName(`Mantenimiento Electromecánico - ${c.fincaLocacion}`);
                        }
                        setShowClientDropdown(false);
                      }}
                      className="px-3 py-2 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white block">{c.razonSocial}</span>
                        {c.fincaLocacion && (
                          <span className="text-[10px] text-slate-400 block">{c.fincaLocacion}</span>
                        )}
                      </div>
                      {c.cuit && (
                        <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{c.cuit}</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la Obra o Servicio *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Reparación Bomba Sumergible y Línea de M.T."
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Triad of financial inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
            <div>
              <label className="block text-[11px] font-bold text-cyan-600 dark:text-cyan-400 mb-1">
                Monto Cargado ($)
              </label>
              <input
                type="number"
                required
                value={cargado}
                onChange={e => setCargado(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Costos previstos</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1">
                Monto Facturado ($)
              </label>
              <input
                type="number"
                required
                value={facturado}
                onChange={e => setFacturado(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Total en factura</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                Monto Cobrado ($)
              </label>
              <input
                type="number"
                required
                value={cobrado}
                onChange={e => setCobrado(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">Percibido neto</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Estado de Cobro
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
              >
                <option value="Cobrado">Cobrado Total</option>
                <option value="Facturado Parcial">Facturado Parcial</option>
                <option value="En Gestión">En Gestión</option>
                <option value="Pendiente">Pendiente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Saldo Resultante
              </label>
              <div className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400">
                ${(Math.max(0, (facturado || 0) - (cobrado || 0)) || 0).toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones del Reporte
            </label>
            <input
              type="text"
              placeholder="Número de orden de compra, cheque, transferencia..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-xs font-bold rounded-xl ${themeClasses.buttonClass} cursor-pointer`}
            >
              Guardar Reporte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
