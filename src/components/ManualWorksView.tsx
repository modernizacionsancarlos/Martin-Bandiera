import React, { useState } from 'react';
import { Wrench, Plus, CheckCircle, Clock, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { todayLocalISO } from '../utils/dateUtils';

export const ManualWorksView: React.FC = () => {
  const { addTechnicalAuditRecord } = useData();

  const [date, setDate] = useState(todayLocalISO());
  const [clientName, setClientName] = useState('');
  const [workPoint, setWorkPoint] = useState('');
  const [hoursWorked, setHoursWorked] = useState(4.0);
  const [description, setDescription] = useState('');
  const [leadTech, setLeadTech] = useState('Martin Bandiera');
  const [status, setStatus] = useState<'Cargado' | 'Facturado' | 'Cobrado'>('Cargado');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !workPoint) return;

    addTechnicalAuditRecord({
      date,
      clientName,
      siteLocation: 'PLANTA / TALLER',
      workPoint,
      isGuardia: false,
      hoursWorked,
      travelHours: 0,
      distanceKm: 0,
      horaEntrada: '08:00',
      horaSalida: '12:00',
      materialsCost: 0,
      description,
      billedPrice: hoursWorked * 15000,
      collectedPrice: status === 'Cobrado' ? hoursWorked * 15000 : 0,
      helperPay: 0,
      techPay: hoursWorked * 9400,
      leadTech,
      helpers: [],
      status
    });

    setIsSuccess(true);
    setClientName('');
    setWorkPoint('');
    setDescription('');
    setTimeout(() => setIsSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-500" />
          Ingreso Rápido de Trabajos Manuales & Taller
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Para registrar tareas de taller, consultoría técnica, ensayos de laboratorio o servicios directos sin remito físico.
        </p>
      </div>

      {isSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>¡Trabajo manual registrado exitosamente en la auditoría técnica!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-2xl text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Fecha de Ejecución
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Responsable
            </label>
            <input
              type="text"
              value={leadTech}
              onChange={e => setLeadTech(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
            Cliente / Destinatario
          </label>
          <input
            type="text"
            placeholder="Ej: Agroday S.A., Agustín Castillo..."
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
            Concepto / Tarea Realizada
          </label>
          <input
            type="text"
            placeholder="Ej: Calibración de relés térmicos en banco de pruebas..."
            value={workPoint}
            onChange={e => setWorkPoint(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Horas Insumidas (HS)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={hoursWorked}
              onChange={e => setHoursWorked(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Estado Contable
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value="Cargado">CARGADO</option>
              <option value="Facturado">FACTURADO</option>
              <option value="Cobrado">COBRADO</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
            Observaciones Adicionales
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detalles sobre materiales propios usados, mediciones o entregas..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>REGISTRAR TRABAJO MANUAL</span>
          </button>
        </div>
      </form>
    </div>
  );
};
