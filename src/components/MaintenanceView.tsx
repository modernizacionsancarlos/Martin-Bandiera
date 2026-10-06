import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  DollarSign,
  Activity,
  Trash2,
  ArrowRight,
  ShieldAlert,
  FileCheck2
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MaintenanceServiceItem } from '../types';
import { formatCurrency } from '../utils/exportUtils';
import { FieldReportModal } from './FieldReportModal';

export const MaintenanceView: React.FC = () => {
  const { maintenanceServices, addMaintenanceService, updateMaintenanceService, deleteMaintenanceService } = useData();
  const { canManageProjects, isCapataz, currentUser } = useAuth();
  const { themeClasses } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [assetFilter, setAssetFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFieldReportModal, setShowFieldReportModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [assetType, setAssetType] = useState<MaintenanceServiceItem['assetType']>('Pozo de Agua');
  const [priority, setPriority] = useState<MaintenanceServiceItem['priority']>('Alta');
  const [assignedTech, setAssignedTech] = useState('Juan Pérez');
  const [estimatedCost, setEstimatedCost] = useState(2500000);
  const [billedAmount, setBilledAmount] = useState(3500000);
  const [notes, setNotes] = useState('');

  const filteredServices = maintenanceServices.filter(s => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.assignedTech.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAsset = assetFilter === 'todos' || s.assetType === assetFilter;
    const matchesStatus = statusFilter === 'todos' || s.status === statusFilter;
    return matchesSearch && matchesAsset && matchesStatus;
  });

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !client) return;

    addMaintenanceService({
      code: `SRV-${(8820 + maintenanceServices.length + 1).toString()}`,
      title,
      client,
      assetType,
      priority,
      status: 'Pendiente',
      assignedTech,
      scheduledDate: new Date().toISOString().split('T')[0],
      estimatedCost: Number(estimatedCost) || 0,
      actualCost: 0,
      billedAmount: Number(billedAmount) || 0,
      collectedAmount: 0,
      tenantId: 'tenant_bandiera_hq',
      notes
    });

    setTitle('');
    setClient('');
    setNotes('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              Servicios de Campo & Asistencia Técnica
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Mantenimiento de Pozos, Bombas y Subestaciones
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Atención prioritaria para viñedos, industrias y cooperativas de riego en toda la región de Cuyo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowFieldReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-[#00c2ff] hover:bg-[#00b4f0] text-white transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>NUEVO REPORTE DE CAMPO</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${themeClasses.buttonClass} transition-all shadow-md cursor-pointer`}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Orden de Servicio</span>
          </button>
        </div>
      </div>

      {/* Filter strip */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, pozo, técnico o código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <select
          value={assetFilter}
          onChange={e => setAssetFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-cyan-500 cursor-pointer"
        >
          <option value="todos">Todos los Activos</option>
          <option value="Pozo de Agua">Pozo de Agua</option>
          <option value="Bomba Centrífuga">Bomba Centrífuga</option>
          <option value="Subestación Eléctrica">Subestación Eléctrica</option>
          <option value="Tablero Industrial">Tablero Industrial</option>
          <option value="Red Hidráulica">Red Hidráulica</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-cyan-500 cursor-pointer"
        >
          <option value="todos">Todos los Estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En Diagnóstico">En Diagnóstico</option>
          <option value="En Curso">En Curso</option>
          <option value="Finalizado">Finalizado</option>
        </select>
      </div>

      {/* Services List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredServices.map(srv => {
          return (
            <div
              key={srv.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                      {srv.code}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {srv.assetType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        srv.priority === 'Urgente'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300'
                          : srv.priority === 'Alta'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {srv.priority}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        srv.status === 'Finalizado'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                          : srv.status === 'En Curso'
                          ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                      }`}
                    >
                      {srv.status}
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  {srv.title}
                </h3>
                <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 mt-0.5">
                  {srv.client}
                </p>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5">
                  {srv.notes}
                </p>

                {/* Details row */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Técnico: <strong className="text-slate-800 dark:text-slate-200">{srv.assignedTech}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Programado: {srv.scheduledDate}</span>
                  </div>
                  <div>
                    <span>Costo Est.: {formatCurrency(srv.estimatedCost)}</span>
                  </div>
                  <div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Facturación: {formatCurrency(srv.billedAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Update Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {srv.status === 'Finalizado' ? '✓ Servicio completado' : 'En proceso técnico'}
                </span>

                <div className="flex items-center gap-1.5">
                  {srv.status !== 'Finalizado' && (
                    <button
                      onClick={() => {
                        updateMaintenanceService(srv.id, {
                          status: 'Finalizado',
                          actualCost: srv.estimatedCost,
                          collectedAmount: srv.billedAmount
                        });
                      }}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                    >
                      Completar Servicio
                    </button>
                  )}
                  {canManageProjects && (
                    <button
                      onClick={() => deleteMaintenanceService(srv.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                      title="Eliminar orden de servicio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nueva Orden */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              Nueva Orden de Asistencia y Mantenimiento
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Emisión de parte para reparación o preventivo de pozo/maquinaria.
            </p>

            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción del Trabajo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cambio de contactores y bobinado bomba Pozo 8"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Bodega Santa Rosa"
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Activo
                  </label>
                  <select
                    value={assetType}
                    onChange={e => setAssetType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Pozo de Agua">Pozo de Agua</option>
                    <option value="Bomba Centrífuga">Bomba Centrífuga</option>
                    <option value="Subestación Eléctrica">Subestación Eléctrica</option>
                    <option value="Tablero Industrial">Tablero Industrial</option>
                    <option value="Red Hidráulica">Red Hidráulica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Técnico Asignado
                  </label>
                  <input
                    type="text"
                    value={assignedTech}
                    onChange={e => setAssignedTech(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Costo Estimado (ARS)
                  </label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={e => setEstimatedCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monto a Facturar (ARS)
                  </label>
                  <input
                    type="number"
                    value={billedAmount}
                    onChange={e => setBilledAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notas Técnicas y Diagnóstico Preliminar
                </label>
                <textarea
                  rows={2}
                  placeholder="Síntomas de falla, amperaje anormal, repuestos necesarios..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-bold rounded-xl ${themeClasses.buttonClass}`}
                >
                  Generar Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field Report Modal */}
      <FieldReportModal
        isOpen={showFieldReportModal}
        onClose={() => setShowFieldReportModal(false)}
      />
    </div>
  );
};
