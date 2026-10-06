import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  DollarSign,
  Printer,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Package,
  Calendar,
  Building,
  Wrench,
  Receipt,
  Layers,
  Filter,
  Download,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { TechnicalAuditRecord } from '../types';
import { useData } from '../context/DataContext';
import { RemitoPasadoModal } from './RemitoPasadoModal';
import { RemitoPasadoConsolidadoModal } from './RemitoPasadoConsolidadoModal';
import { PaymentModal } from './PaymentModal';
import { generateRemitoPasadoConsolidadoPDF } from '../utils/pdfGenerator';
import { exportPasadosToExcel, exportRemitoPasadoSingleToExcel } from '../utils/excelParser';

export const PasadoView: React.FC = () => {
  const { technicalAuditRecords, updateTechnicalAuditRecord } = useData();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('ALL');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  // Modals State
  const [selectedRecordForSingleModal, setSelectedRecordForSingleModal] = useState<TechnicalAuditRecord | null>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);

  // Consolidated Multi-Remito Modal
  const [isConsolidadoModalOpen, setIsConsolidadoModalOpen] = useState(false);

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [recordsToPay, setRecordsToPay] = useState<TechnicalAuditRecord[]>([]);

  // Filter records with status === 'Pasado'
  const pasados = useMemo(() => {
    return technicalAuditRecords.filter(r => r.status === 'Pasado');
  }, [technicalAuditRecords]);

  // Unique clients in Pasado
  const uniqueClients = useMemo(() => {
    const clients = Array.from(new Set(pasados.map(r => r.clientName).filter(Boolean)));
    return clients.sort();
  }, [pasados]);

  // Apply filters (Client + Search)
  const filteredRecords = useMemo(() => {
    return pasados.filter(r => {
      // Client Filter
      if (selectedClientFilter !== 'ALL' && r.clientName !== selectedClientFilter) {
        return false;
      }

      // Text Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          r.remitoId.toLowerCase().includes(term) ||
          (r.remitoPapel && r.remitoPapel.toLowerCase().includes(term)) ||
          r.clientName.toLowerCase().includes(term) ||
          (r.description && r.description.toLowerCase().includes(term)) ||
          (r.workPoint && r.workPoint.toLowerCase().includes(term)) ||
          (r.siteLocation && r.siteLocation.toLowerCase().includes(term));
        if (!matchSearch) return false;
      }

      return true;
    });
  }, [pasados, selectedClientFilter, searchTerm]);

  // Selected records data
  const selectedRecordsData = useMemo(() => {
    return pasados.filter(r => selectedRecords.includes(r.id));
  }, [pasados, selectedRecords]);

  // KPI calculations:
  // El precio del remito (billedPrice o suggestedPrice) ya contiene el costo total con margen.
  // totalFinalPasadoSum = suma total de los remitos pasados.
  // totalMateriales = total de materiales diferenciados.
  // totalServicios = totalFinalPasadoSum - totalMateriales (mano de obra y logística restante).
  const totalFinalPasadoSum = useMemo(() => {
    return pasados.reduce((acc, r) => acc + ((r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || 0)) || 0), 0);
  }, [pasados]);

  const totalMateriales = useMemo(() => {
    return pasados.reduce((acc, r) => acc + (r.materialsCost || 0), 0);
  }, [pasados]);

  const totalServicios = Math.max(0, totalFinalPasadoSum - totalMateriales);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedRecords(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedRecords.length === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredRecords.map(r => r.id));
    }
  };

  const handleSelectAllOfCurrentClient = () => {
    if (selectedClientFilter === 'ALL') {
      setSelectedRecords(filteredRecords.map(r => r.id));
    } else {
      const clientRecords = pasados.filter(r => r.clientName === selectedClientFilter).map(r => r.id);
      setSelectedRecords(clientRecords);
    }
  };

  // Actions
  const handleOpenRemitoPasadoSingle = (record: TechnicalAuditRecord) => {
    setSelectedRecordForSingleModal(record);
    setIsSingleModalOpen(true);
  };

  const handleOpenConsolidadoSelected = () => {
    if (selectedRecordsData.length === 0) return;
    setIsConsolidadoModalOpen(true);
  };

  const handleOpenCobrado = (record: TechnicalAuditRecord) => {
    setRecordsToPay([record]);
    setIsPaymentModalOpen(true);
  };

  const handleOpenCobradoSelected = () => {
    if (selectedRecordsData.length === 0) return;
    setRecordsToPay(selectedRecordsData);
    setIsPaymentModalOpen(true);
  };

  const handleMoveToFacturado = (id: string) => {
    updateTechnicalAuditRecord(id, { status: 'Facturado', semaforo: 'naranja' });
  };

  const handleMoveToCargado = (id: string) => {
    updateTechnicalAuditRecord(id, { status: 'Cargado', semaforo: 'rojo' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-black uppercase tracking-wider mb-3">
              <FileText className="w-3.5 h-3.5" />
              SOLAPA PASADO · REMITOS INDIVIDUALES Y CONSOLIDADOS
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Remitos en Estado Pasado
            </h1>
            <p className="text-amber-100/90 text-xs sm:text-sm mt-1 max-w-2xl font-medium">
              Filtre por cliente para agrupar múltiples remitos en un <strong>solo remito consolidado</strong> con
              todas las filas detalladas una debajo de la otra, discriminando mano de obra y materiales para su descarga e impresión.
            </p>
          </div>

          {/* Quick Consolidated Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {selectedRecords.length > 0 && (
              <>
                <button
                  onClick={handleOpenConsolidadoSelected}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-white text-slate-900 hover:bg-amber-50 shadow-xl transition-all cursor-pointer"
                  title="Generar un solo remito pasado con todos los remitos seleccionados en filas consecutivas"
                >
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>GENERAR REMITO CONSOLIDADO ({selectedRecords.length})</span>
                </button>

                <button
                  onClick={handleOpenCobradoSelected}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl transition-all cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>COBRAR ({selectedRecords.length})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>TOTAL REMITOS PASADOS</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {pasados.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {uniqueClients.length} clientes distintos
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>TOTAL SERVICIOS (M.O.)</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            ${(totalServicios || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Base operativa de mano de obra
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>MATERIALES EN PASADO</span>
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-orange-600 dark:text-orange-400 mt-2">
            ${(totalMateriales || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Columna de materiales sumada al Pasado
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>TOTAL GENERAL PASADO (+IVA)</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              ${(totalFinalPasadoSum || 0).toLocaleString('es-AR')}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
              + IVA
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Servicios Pasados (${(totalServicios || 0).toLocaleString('es-AR')}) + Materiales (${(totalMateriales || 0).toLocaleString('es-AR')})
          </p>
        </div>

      </div>

      {/* Filter and Client Selection Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Client Filter Dropdown */}
          <div className="flex-1 min-w-[240px] max-w-md relative">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex-1">
                <select
                  value={selectedClientFilter}
                  onChange={e => {
                    setSelectedClientFilter(e.target.value);
                    setSelectedRecords([]);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">Todos los Clientes ({uniqueClients.length})</option>
                  {uniqueClients.map(client => (
                    <option key={client} value={client}>
                      {client} ({pasados.filter(r => r.clientName === client).length} remitos)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Nº Remito, Papel, Pozo o Descripción..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* Quick Selection Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportPasadosToExcel(filteredRecords)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs whitespace-nowrap"
              title="Descargar remitos pasados en archivo Excel .xlsx"
            >
              <Download className="w-4 h-4" />
              <span>EXPORTAR EXCEL</span>
            </button>

            <button
              onClick={handleSelectAll}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
            >
              {selectedRecords.length === filteredRecords.length && filteredRecords.length > 0
                ? 'Deseleccionar'
                : 'Seleccionar Todos'}
            </button>

            {selectedClientFilter !== 'ALL' && (
              <button
                onClick={handleSelectAllOfCurrentClient}
                className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-black hover:bg-amber-100 cursor-pointer whitespace-nowrap"
              >
                Seleccionar {filteredRecords.length} de este Cliente
              </button>
            )}
          </div>

        </div>

        {/* Status Bar / Active Filters Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Mostrando <strong className="text-slate-900 dark:text-white">{filteredRecords.length}</strong> de {pasados.length} remitos pasados
            </span>
            {selectedRecords.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono">
                {selectedRecords.length} seleccionados
              </span>
            )}
          </div>

          {selectedRecords.length > 0 && (
            <button
              onClick={handleOpenConsolidadoSelected}
              className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Abrir Remito Consolidado con {selectedRecords.length} filas &rarr;</span>
            </button>
          )}
        </div>
      </div>

      {/* Table of Pasados with explicit requested columns: */}
      {/* "cliente" "remito" "fecha" "descripción del remito" "total servicio" "materiales (col. separada)" "total remito pasado" */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRecords.length > 0 && selectedRecords.length === filteredRecords.length}
                    onChange={handleSelectAll}
                    className="rounded-sm border-slate-300 dark:border-slate-700 text-amber-600 cursor-pointer"
                  />
                </th>
                <th className="p-3.5">CLIENTE</th>
                <th className="p-3.5">REMITO</th>
                <th className="p-3.5">FECHA</th>
                <th className="p-3.5">DESCRIPCIÓN DEL REMITO</th>
                <th className="p-3.5 text-right">TOTAL SERVICIO ($)</th>
                <th className="p-3.5 text-right bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
                  MATERIALES (COL. SEPARADA)
                </th>
                <th className="p-3.5 text-right font-black">TOTAL FINAL PASADO (+IVA)</th>
                <th className="p-3.5 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        No hay remitos en estado Pasado con los filtros seleccionados
                      </p>
                      <p className="text-xs">
                        Para pasar un remito a esta solapa, cámbielo a estado "Pasado" desde Auditoría Técnica o Facturado.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => {
                  const totalRemito = (record.billedPrice > 0 ? record.billedPrice : (record.suggestedPrice || 0)) || 0;
                  const materialesMonto = record.materialsCost || 0;
                  const servicioMonto = Math.max(0, totalRemito - materialesMonto);
                  const totalPasado = totalRemito;
                  const isSelected = selectedRecords.includes(record.id);

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(record.id)}
                          className="rounded-sm border-slate-300 dark:border-slate-700 text-amber-600 cursor-pointer"
                        />
                      </td>

                      {/* Cliente */}
                      <td className="p-3.5 max-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={record.clientName}>
                          {record.clientName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {record.siteLocation}
                        </div>
                      </td>

                      {/* Remito */}
                      <td className="p-3.5 font-mono whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white">{record.remitoId}</span>
                        {record.remitoPapel && (
                          <span className="block text-[10px] text-slate-400">Papel: {record.remitoPapel}</span>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {record.date}
                      </td>

                      {/* Descripción del Remito */}
                      <td className="p-3.5 max-w-[240px]">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {record.description || record.workPoint || 'Mantenimiento electromecánico'}
                        </div>
                        {record.materialsDetails && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                            Mat: {record.materialsDetails}
                          </div>
                        )}
                      </td>

                      {/* Total Servicio */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        ${(servicioMonto || 0).toLocaleString('es-AR')}
                      </td>

                      {/* Materiales (Columna separada) */}
                      <td className="p-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/10 whitespace-nowrap">
                        ${(materialesMonto || 0).toLocaleString('es-AR')}
                      </td>

                      {/* Total Remito Pasado (+IVA) */}
                      <td className="p-3.5 text-right font-mono whitespace-nowrap">
                        <div className="font-black text-slate-900 dark:text-white text-sm">
                          ${(totalPasado || 0).toLocaleString('es-AR')}
                        </div>
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider">
                          + IVA
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Generar Recibo / Remito Pasado Individual */}
                          <button
                            onClick={() => handleOpenRemitoPasadoSingle(record)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-xs"
                            title="Generar Recibo / Remito Pasado Individual"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>RECIBO / REMITO</span>
                          </button>

                          {/* Exportar Excel Individual */}
                          <button
                            onClick={() => exportRemitoPasadoSingleToExcel(record)}
                            className="p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                            title="Exportar a Excel (+IVA)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>

                          {/* Pasar a Cobrado */}
                          <button
                            onClick={() => handleOpenCobrado(record)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs"
                            title="Pasar a Cobrado y Registrar Formas de Pago"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>COBRAR</span>
                          </button>

                          {/* Mover a Facturado */}
                          <button
                            onClick={() => handleMoveToFacturado(record.id)}
                            className="p-1.5 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                            title="Mover a Facturado"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Volver a Cargado */}
                          <button
                            onClick={() => handleMoveToCargado(record.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Volver a estado Cargado"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remito Pasado Single Modal */}
      {isSingleModalOpen && selectedRecordForSingleModal && (
        <RemitoPasadoModal
          isOpen={isSingleModalOpen}
          onClose={() => {
            setIsSingleModalOpen(false);
            setSelectedRecordForSingleModal(null);
          }}
          record={selectedRecordForSingleModal}
        />
      )}

      {/* Remito Pasado Consolidado Modal (Multiple Remitos in consecutive rows) */}
      {isConsolidadoModalOpen && selectedRecordsData.length > 0 && (
        <RemitoPasadoConsolidadoModal
          isOpen={isConsolidadoModalOpen}
          onClose={() => {
            setIsConsolidadoModalOpen(false);
          }}
          records={selectedRecordsData}
          onArchiveSuccess={() => {
            // Optional callback
          }}
        />
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && recordsToPay.length > 0 && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setRecordsToPay([]);
          }}
          records={recordsToPay}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            setRecordsToPay([]);
            setSelectedRecords([]);
          }}
        />
      )}

    </div>
  );
};
