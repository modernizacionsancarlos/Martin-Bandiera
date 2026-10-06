import React, { useState } from 'react';
import {
  HardHat,
  Plus,
  Search,
  Calendar,
  MapPin,
  User,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ProjectItem } from '../types';
import { formatCurrency } from '../utils/exportUtils';

export const ProjectsView: React.FC = () => {
  const { projects, addProject, updateProject, deleteProject } = useData();
  const { canManageProjects } = useAuth();
  const { themeClasses } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState(50000000);
  const [leadEngineer, setLeadEngineer] = useState('Ing. Matías Calderón');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2027-03-31');

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !client) return;

    addProject({
      code: `OBRA-2026-${(projects.length + 1).toString().padStart(2, '0')}`,
      title,
      client,
      description,
      location,
      status: 'En Ejecución',
      budget: Number(budget) || 0,
      spent: 0,
      progress: 5,
      startDate,
      endDate,
      leadEngineer,
      tenantId: 'tenant_bandiera_hq'
    });

    setTitle('');
    setClient('');
    setDescription('');
    setLocation('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Módulo de Obras & Ingeniería
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Gestión de Proyectos e Infraestructura
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supervisión técnica de obras civiles, tendido de media tensión, pozos profundos y automatización industrial.
          </p>
        </div>

        {canManageProjects && (
          <button
            onClick={() => setShowAddModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${themeClasses.buttonClass} transition-all shadow-md cursor-pointer`}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Obra</span>
          </button>
        )}
      </div>

      {/* Filter strip */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por obra, cliente o localidad (ej: Valle de Uco, Luján)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
        >
          <option value="todos">Todos los Estados</option>
          <option value="En Ejecución">En Ejecución</option>
          <option value="Planificación">Planificación</option>
          <option value="Completado">Completado</option>
        </select>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredProjects.map(proj => {
          return (
            <div
              key={proj.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header tag */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    {proj.code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      proj.status === 'En Ejecución'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : proj.status === 'Completado'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    }`}
                  >
                    {proj.status}
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                  {proj.title}
                </h3>
                <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mt-0.5">
                  {proj.client}
                </p>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 line-clamp-2">
                  {proj.description}
                </p>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{proj.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{proj.leadEngineer}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{proj.startDate} al {proj.endDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Presupuesto: {formatCurrency(proj.budget)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-5">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-500">Avance Físico Certificado</span>
                    <span className="text-slate-900 dark:text-white font-bold">{proj.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  Gasto acumulado: <strong className="text-slate-700 dark:text-slate-300">{formatCurrency(proj.spent)}</strong>
                </div>

                {canManageProjects && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const newProgress = Math.min(100, proj.progress + 10);
                        updateProject(proj.id, {
                          progress: newProgress,
                          status: newProgress === 100 ? 'Completado' : proj.status
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 transition-colors"
                      title="Certificar +10% de avance"
                    >
                      +10% Avance
                    </button>
                    <button
                      onClick={() => deleteProject(proj.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Eliminar obra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nueva Obra */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              Registrar Nueva Obra de Ingeniería
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Ingresa los datos para control técnico, presupuestario y seguimiento de cuadrilla.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título de la Obra *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Tendido Eléctrico Media Tensión Loteo San Carlos"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
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
                    placeholder="Ej: Bodega Don Carlos"
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Localidad / Ubicación
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Valle de Uco, Mendoza"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción Técnica y Alcance
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles de tendido, potencias de bombas, válvulas requeridas..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Presupuesto Total (ARS)
                  </label>
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ingeniero Responsable
                  </label>
                  <input
                    type="text"
                    value={leadEngineer}
                    onChange={e => setLeadEngineer(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
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
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
