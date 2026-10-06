import React, { useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  Edit2,
  MapPin,
  Phone,
  Mail,
  Navigation,
  CheckCircle2,
  AlertCircle,
  X,
  FileDown
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { ClientItem } from '../types';
import { downloadClientesExcelTemplate, exportClientesToExcel } from '../utils/excelParser';

interface ClientesViewProps {
  onOpenImportExcel?: () => void;
}

export const ClientesView: React.FC<ClientesViewProps> = ({ onOpenImportExcel }) => {
  const { clients, addClient, updateClient, deleteClient } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientToEdit, setSelectedClientToEdit] = useState<ClientItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<ClientItem, 'id'>>({
    razonSocial: '',
    cuit: '',
    fincaLocacion: '',
    email: '',
    telefono: '',
    direccionFiscal: '',
    latitud: undefined,
    longitud: undefined,
    distanciaKm: 0,
    notes: ''
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.razonSocial.toLowerCase().includes(term) ||
      c.cuit.toLowerCase().includes(term) ||
      c.fincaLocacion.toLowerCase().includes(term) ||
      c.direccionFiscal.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.telefono.toLowerCase().includes(term)
    );
  });

  const handleOpenAddModal = () => {
    setSelectedClientToEdit(null);
    setFormData({
      razonSocial: '',
      cuit: '',
      fincaLocacion: '',
      email: '',
      telefono: '',
      direccionFiscal: '',
      latitud: undefined,
      longitud: undefined,
      distanciaKm: 0,
      notes: ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: ClientItem) => {
    setSelectedClientToEdit(client);
    setFormData({
      razonSocial: client.razonSocial,
      cuit: client.cuit,
      fincaLocacion: client.fincaLocacion,
      email: client.email,
      telefono: client.telefono,
      direccionFiscal: client.direccionFiscal,
      latitud: client.latitud,
      longitud: client.longitud,
      distanciaKm: client.distanciaKm,
      notes: client.notes || ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!formData.razonSocial.trim()) {
      errors.razonSocial = 'La Razón Social es obligatoria';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (selectedClientToEdit) {
      updateClient(selectedClientToEdit.id, formData);
    } else {
      addClient(formData);
    }

    setIsModalOpen(false);
  };

  const handleDeleteConfirmed = () => {
    if (clientToDelete) {
      deleteClient(clientToDelete.id);
      setClientToDelete(null);
    }
  };

  const avgDistance = clients.length > 0
    ? (clients.reduce((acc, c) => acc + (c.distanciaKm || 0), 0) / clients.length).toFixed(1)
    : '0';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              PADRÓN MAESTRO DE CLIENTES & FINCAS
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Base de Datos de Clientes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vinculación directa para reportes y remitos de campo, con cálculo de kilómetros de logística y georreferenciación.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenImportExcel && (
            <button
              onClick={onOpenImportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-300 dark:border-slate-700 shadow-sm"
              title="Importar lista de clientes desde Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Importar Excel</span>
            </button>
          )}

          <button
            onClick={() => exportClientesToExcel(clients)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-300 dark:border-slate-700 shadow-sm"
            title="Descargar base de clientes en formato Excel"
          >
            <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Exportar</span>
          </button>

          <button
            onClick={downloadClientesExcelTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700 shadow-sm"
            title="Descargar plantilla de Excel de muestra"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>Plantilla</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Metrics and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por Razón Social, CUIT, Finca / Locación, Teléfono o Dirección..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Clientes</span>
            <span className="text-base font-black text-slate-800 dark:text-white">{clients.length}</span>
          </div>
          <Building2 className="w-6 h-6 text-cyan-500 opacity-70" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Distancia Promedio</span>
            <span className="text-base font-black text-slate-800 dark:text-white">{avgDistance} km</span>
          </div>
          <Navigation className="w-6 h-6 text-emerald-500 opacity-70" />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {clients.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200 dark:border-cyan-800">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Base de Datos de Clientes en 0
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              El sistema se encuentra en blanco listo para cargar los clientes reales de su empresa mediante archivo Excel o de forma manual.
            </p>
            <div className="flex items-center justify-center gap-3">
              {onOpenImportExcel && (
                <button
                  onClick={onOpenImportExcel}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Importar Clientes desde Excel
                </button>
              )}
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 transition"
              >
                <Plus className="w-4 h-4" />
                Cargar Primer Cliente
              </button>
            </div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="py-12 text-center">
            <Search className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No se encontraron clientes que coincidan con "{searchTerm}".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black tracking-wider text-slate-600 dark:text-slate-300 uppercase">
                  <th className="py-3 px-4">Razón Social</th>
                  <th className="py-3 px-3">CUIT</th>
                  <th className="py-3 px-3">Finca / Locación</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Teléfono</th>
                  <th className="py-3 px-3">Dirección Fiscal</th>
                  <th className="py-3 px-3 text-center">Coordenadas</th>
                  <th className="py-3 px-3 text-right">Distancia KM</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredClients.map(client => (
                  <tr
                    key={client.id}
                    className="hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {client.razonSocial.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {client.razonSocial}
                          </span>
                          {client.notes && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                              {client.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                        {client.cuit || '—'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="font-medium">{client.fincaLocacion || '—'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {client.email ? (
                        <a
                          href={`mailto:${client.email}`}
                          className="hover:underline flex items-center gap-1 truncate max-w-[170px]"
                        >
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {client.telefono ? (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{client.telefono}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-[220px] truncate" title={client.direccionFiscal}>
                      {client.direccionFiscal || '—'}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {client.latitud !== undefined && client.longitud !== undefined ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {client.latitud.toFixed(3)}, {client.longitud.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">No geolocalizado</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-lg border border-cyan-200 dark:border-cyan-800/60 font-mono">
                        <Navigation className="w-3 h-3 text-cyan-500" />
                        {client.distanciaKm} km
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(client)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Editar cliente"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setClientToDelete(client)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedClientToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Completar datos de ficha técnica para vinculación automática con remitos.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              
              {/* Row 1: Razón Social */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Razón Social *
                </label>
                <input
                  type="text"
                  value={formData.razonSocial}
                  onChange={e => setFormData({ ...formData, razonSocial: e.target.value })}
                  placeholder="e.g. TechCorp S.A. o 1 AGRODAY SA"
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    formErrors.razonSocial ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {formErrors.razonSocial && (
                  <span className="text-[11px] text-rose-500 mt-0.5 block">{formErrors.razonSocial}</span>
                )}
              </div>

              {/* Row 2: CUIT & Finca / Locación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CUIT
                  </label>
                  <input
                    type="text"
                    value={formData.cuit}
                    onChange={e => setFormData({ ...formData, cuit: e.target.value })}
                    placeholder="e.g. 30-12345678-9"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Finca / Locación
                  </label>
                  <input
                    type="text"
                    value={formData.fincaLocacion}
                    onChange={e => setFormData({ ...formData, fincaLocacion: e.target.value })}
                    placeholder="e.g. Sede Central / Paso de las Carretas"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Row 3: Email & Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. adm@cliente.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="e.g. 2614556677"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Row 4: Dirección Fiscal */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección Fiscal
                </label>
                <input
                  type="text"
                  value={formData.direccionFiscal}
                  onChange={e => setFormData({ ...formData, direccionFiscal: e.target.value })}
                  placeholder="e.g. Calle Principal 100, Mendoza"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Row 5: Geolocalización & Distancia KM */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" /> Parámetros Logísticos & Mapa
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Cálculo automático de costo por viaje
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Distancia KM *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.distanciaKm}
                      onChange={e => setFormData({ ...formData, distanciaKm: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 15.5"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Latitud
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitud !== undefined ? formData.latitud : ''}
                      onChange={e => setFormData({ ...formData, latitud: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="e.g. -32.8895"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      Longitud
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitud !== undefined ? formData.longitud : ''}
                      onChange={e => setFormData({ ...formData, longitud: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="e.g. -68.8451"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Row 6: Notas */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Información técnica sobre tableros, pozos, horarios de guardia..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 transition shadow-sm"
                >
                  {selectedClientToEdit ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white text-center mb-1">
              ¿Eliminar Cliente?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              Se eliminará <strong className="text-slate-800 dark:text-slate-200">{clientToDelete.razonSocial}</strong> del padrón maestro de clientes.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
