import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  DollarSign,
  Search,
  CheckCircle2,
  Receipt,
  ArrowRight,
  Filter,
  FileSpreadsheet,
  Building,
  RotateCcw,
  Edit2,
  Save,
  Percent,
  TrendingDown,
  Clock,
  Printer,
  Download,
  Calendar,
  AlertTriangle,
  Plus,
  Layers,
  X,
  FileText,
  Sparkles
} from 'lucide-react';
import { TechnicalAuditRecord } from '../types';
import { useData } from '../context/DataContext';
import { PaymentModal } from './PaymentModal';
import { ExcelImportModal } from './ExcelImportModal';
import { PasarAFacturadoModal } from './PasarAFacturadoModal';
import { ActualizarDescripcionesModal } from './ActualizarDescripcionesModal';
import { generateFacturaAgrupadaPDF, generateRemitoPasadoPDF } from '../utils/pdfGenerator';
import { exportFacturadosToExcel } from '../utils/excelParser';

export const FacturadoView: React.FC = () => {
  const { technicalAuditRecords, updateTechnicalAuditRecord, bulkPassToFacturado } = useData();

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [statusInvoiceFilter, setStatusInvoiceFilter] = useState<'ALL' | 'CON_FACTURA' | 'SIN_FACTURA' | 'EN_MORA'>('ALL');

  // Selection
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [tempInvoiceVal, setTempInvoiceVal] = useState<string>('');
  const [editingBilledId, setEditingBilledId] = useState<string | null>(null);
  const [tempBilledVal, setTempBilledVal] = useState<number>(0);

  const handleSaveBilledAmount = (id: string) => {
    updateTechnicalAuditRecord(id, { billedPrice: tempBilledVal, totalFacturado: tempBilledVal });
    setEditingBilledId(null);
  };

  // Pasar a Facturado Modal state
  const [pasarFacturadoOpen, setPasarFacturadoOpen] = useState(false);

  // Bulk / Group Invoice Modal
  const [showGroupInvoiceModal, setShowGroupInvoiceModal] = useState(false);
  const [groupInvoiceMode, setGroupInvoiceMode] = useState<'new' | 'existing'>('new');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newInvoiceDate, setNewInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedExistingInvoice, setSelectedExistingInvoice] = useState('');

  // Payment Modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [recordsToPay, setRecordsToPay] = useState<TechnicalAuditRecord[]>([]);

  // Excel Import Modal state
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [actualizarDescOpen, setActualizarDescOpen] = useState(false);

  // Filter records in 'Facturado'
  const facturados = useMemo(() => {
    return technicalAuditRecords.filter(r => r.status === 'Facturado');
  }, [technicalAuditRecords]);

  // Records available to be moved to Facturado
  const availableToInvoice = useMemo(() => {
    return technicalAuditRecords.filter(r => r.status !== 'Facturado' && r.status !== 'Cobrado');
  }, [technicalAuditRecords]);

  // Unique clients in Facturado
  const uniqueClients = useMemo(() => {
    const clients = Array.from(new Set(facturados.map(r => r.clientName).filter(Boolean)));
    return clients.sort();
  }, [facturados]);

  // Existing invoices grouped
  const existingInvoices = useMemo(() => {
    const map = new Map<string, { invoiceNumber: string; clientName: string; invoiceDate: string; count: number }>();
    facturados.forEach(r => {
      if (r.numeroFactura) {
        const key = `${r.clientName}___${r.numeroFactura}`;
        if (!map.has(key)) {
          map.set(key, {
            invoiceNumber: r.numeroFactura,
            clientName: r.clientName,
            invoiceDate: r.fechaFactura || r.date,
            count: 1
          });
        } else {
          const item = map.get(key)!;
          item.count += 1;
        }
      }
    });
    return Array.from(map.values());
  }, [facturados]);

  // Calculate elapsed days since billing
  const getDaysElapsed = (invoiceDateStr?: string, fallbackDate?: string): number => {
    const dateStr = invoiceDateStr || fallbackDate;
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const now = new Date();
    // Normalize to midnight
    const diff = Math.floor((now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return facturados.filter(r => {
      // Search term
      const matchSearch =
        r.remitoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.remitoPapel && r.remitoPapel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.numeroFactura && r.numeroFactura.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.workPoint && r.workPoint.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      // Client filter
      if (selectedClientFilter !== 'ALL' && r.clientName !== selectedClientFilter) {
        return false;
      }

      // Date range filter
      const recordDate = r.fechaFactura || r.date;
      if (dateFrom && recordDate < dateFrom) return false;
      if (dateTo && recordDate > dateTo) return false;

      // Invoice status filter
      if (statusInvoiceFilter === 'CON_FACTURA' && !r.numeroFactura) return false;
      if (statusInvoiceFilter === 'SIN_FACTURA' && r.numeroFactura) return false;
      if (statusInvoiceFilter === 'EN_MORA') {
        const days = getDaysElapsed(r.fechaFactura, r.date);
        if (days <= 30) return false;
      }

      return true;
    });
  }, [facturados, searchTerm, selectedClientFilter, dateFrom, dateTo, statusInvoiceFilter]);

  // Financial KPIs
  const totalFacturado = useMemo(() => {
    return facturados.reduce((acc, r) => acc + (r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || 0)), 0);
  }, [facturados]);

  const totalRetIVA = useMemo(() => {
    return facturados.reduce((acc, r) => acc + (r.retencionIVA || 0), 0);
  }, [facturados]);

  const totalRetIIBB = useMemo(() => {
    return facturados.reduce((acc, r) => acc + (r.retencionIIBB || 0), 0);
  }, [facturados]);

  const totalRetGanancias = useMemo(() => {
    return facturados.reduce((acc, r) => acc + (r.retencionGanancias || 0), 0);
  }, [facturados]);

  const totalRetenciones = totalRetIVA + totalRetIIBB + totalRetGanancias;
  const totalNetoPendiente = Math.max(0, (totalFacturado || 0) - (totalRetenciones || 0));

  // Remitos with over 30 days elapsed
  const remitosEnMoraCount = useMemo(() => {
    return facturados.filter(r => getDaysElapsed(r.fechaFactura, r.date) > 30).length;
  }, [facturados]);

  // Average days elapsed
  const avgDaysElapsed = useMemo(() => {
    if (facturados.length === 0) return 0;
    const totalDays = facturados.reduce((acc, r) => acc + getDaysElapsed(r.fechaFactura, r.date), 0);
    return Math.round(totalDays / facturados.length);
  }, [facturados]);

  // Handle inline invoice number save
  const handleSaveInvoiceNumber = (id: string) => {
    updateTechnicalAuditRecord(id, { numeroFactura: tempInvoiceVal.trim() });
    setEditingInvoiceId(null);
  };

  // Grouped Invoicing apply
  const handleApplyGroupInvoice = () => {
    const invoiceNumToApply = groupInvoiceMode === 'new' ? newInvoiceNumber.trim() : selectedExistingInvoice.trim();
    if (!invoiceNumToApply) return;

    selectedRecords.forEach(id => {
      updateTechnicalAuditRecord(id, {
        numeroFactura: invoiceNumToApply,
        fechaFactura: newInvoiceDate
      });
    });

    setSelectedRecords([]);
    setShowGroupInvoiceModal(false);
    setNewInvoiceNumber('');
    setSelectedExistingInvoice('');
  };

  // Check if selected records belong to the same client
  const selectedRecordsData = useMemo(() => {
    return facturados.filter(r => selectedRecords.includes(r.id));
  }, [facturados, selectedRecords]);

  const selectedClients = useMemo(() => {
    return Array.from(new Set(selectedRecordsData.map(r => r.clientName)));
  }, [selectedRecordsData]);

  const isMultiClientSelected = selectedClients.length > 1;

  // Print & Download PDF handlers
  const handleDownloadSinglePDF = (record: TechnicalAuditRecord) => {
    generateRemitoPasadoPDF(record);
  };

  const handlePrintSingle = (record: TechnicalAuditRecord) => {
    window.print();
  };

  // Download Grouped Invoice PDF
  const handleDownloadInvoicePDF = (invoiceNumber: string) => {
    const matchingRecords = facturados.filter(r => r.numeroFactura === invoiceNumber);
    if (matchingRecords.length === 0) return;

    generateFacturaAgrupadaPDF({
      invoiceNumber,
      invoiceDate: matchingRecords[0]?.fechaFactura || matchingRecords[0]?.date || new Date().toISOString().split('T')[0],
      clientName: matchingRecords[0]?.clientName || 'Cliente',
      records: matchingRecords
    });
  };

  // Trigger Cobro for single record
  const handleOpenCobroSingle = (record: TechnicalAuditRecord) => {
    setRecordsToPay([record]);
    setPaymentModalOpen(true);
  };

  // Trigger Cobro for selected records
  const handleOpenCobroSelected = () => {
    if (selectedRecordsData.length === 0) return;
    setRecordsToPay(selectedRecordsData);
    setPaymentModalOpen(true);
  };

  // State transitions
  const handleMoveToCargado = (id: string) => {
    updateTechnicalAuditRecord(id, { status: 'Cargado', semaforo: 'rojo' });
  };

  const handleMoveToPasado = (id: string) => {
    const record = facturados.find(r => r.id === id);
    if (record) {
      const basePrice = record.billedPrice > 0 ? record.billedPrice : record.suggestedPrice;
      const updatedPrice = Math.round(basePrice * 1.07);
      updateTechnicalAuditRecord(id, { status: 'Pasado', semaforo: 'naranja', billedPrice: updatedPrice });
    } else {
      updateTechnicalAuditRecord(id, { status: 'Pasado', semaforo: 'naranja' });
    }
  };

  // Selection toggle
  const handleToggleSelect = (id: string) => {
    setSelectedRecords(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedRecords.length === filteredRecords.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredRecords.map(r => r.id));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-500/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-black uppercase tracking-wider mb-3">
              <FileCheck2 className="w-3.5 h-3.5" />
              SOLAPA FACTURADO · CONTROL DE FACTURAS, RETENCIONES & ANTIGÜEDAD
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Facturación & Remitos Agrupados
            </h1>
            <p className="text-blue-200/90 text-xs sm:text-sm mt-1 max-w-2xl font-medium">
              Agrupe múltiples remitos del mismo cliente en una sola factura, controle el contador automático
              de días transcurridos desde la facturación, gestione retenciones impositivas y descargue los comprobantes oficiales en PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Excel Import Button */}
            <button
              onClick={() => setExcelImportOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-white text-slate-900 hover:bg-blue-50 transition-all cursor-pointer shadow-md"
              title="Importar base de clientes o remitos desde archivo Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>IMPORTAR EXCEL</span>
            </button>

            {/* Recuperar Tareas Excel Button */}
            <button
              onClick={() => setActualizarDescOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md"
              title="Recuperar o actualizar la descripción real de tareas desde tu planilla Excel"
            >
              <Sparkles className="w-4 h-4" />
              <span>RECUPERAR TAREAS EXCEL</span>
            </button>

            {/* Excel Export Button */}
            <button
              onClick={() => exportFacturadosToExcel(filteredRecords)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md"
              title="Descargar remitos facturados en archivo Excel .xlsx"
            >
              <Download className="w-4 h-4" />
              <span>EXPORTAR EXCEL</span>
            </button>

            {/* Pasar a Facturado Button */}
            <button
              onClick={() => setPasarFacturadoOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-blue-500 hover:bg-blue-400 text-white transition-all cursor-pointer shadow-md"
              title="Pasar un remito a estado Facturado (solicita Nº Factura y Fecha)"
            >
              <Plus className="w-4 h-4" />
              <span>PASAR A FACTURADO</span>
            </button>

            {/* Selection actions */}
            {selectedRecords.length > 0 && (
              <>
                <button
                  onClick={() => setShowGroupInvoiceModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-blue-500 hover:bg-blue-400 text-white shadow-lg transition-all cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>FACTURAR / SUMAR ({selectedRecords.length})</span>
                </button>
                <button
                  onClick={handleOpenCobroSelected}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>COBRAR ({selectedRecords.length})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards including Aging Counter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Facturado */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>TOTAL FACTURADO</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            ${(totalFacturado || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {facturados.length} remito(s) activos
          </p>
        </div>

        {/* Retenciones */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>RETENCIONES FISCALES</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
            -${(totalRetenciones || 0).toLocaleString('es-AR')}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono truncate">
            <span>IVA: ${(totalRetIVA || 0).toLocaleString('es-AR')}</span>·
            <span>IIBB: ${(totalRetIIBB || 0).toLocaleString('es-AR')}</span>
          </div>
        </div>

        {/* Neto Pendiente */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>NETO A COBRAR</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            ${(totalNetoPendiente || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Cobro líquido a percibir
          </p>
        </div>

        {/* Contador Antigüedad / Mora */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>ANTIGÜEDAD PROMEDIO</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-2">
            {avgDaysElapsed} <span className="text-sm font-bold">días</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] mt-1">
            {remitosEnMoraCount > 0 ? (
              <span className="text-rose-500 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {remitosEnMoraCount} remitos en mora (+30d)
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                Todos dentro de plazo
              </span>
            )}
          </div>
        </div>

        {/* Facturas Asignadas */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>FACTURAS AGRUPADAS</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {new Set(facturados.map(r => r.numeroFactura).filter(Boolean)).size}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Lotes de facturación emitidos
          </p>
        </div>

      </div>

      {/* Filters Bar: Client, Date Range, Status & Search */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Remito, Factura, Pozo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Client Filter */}
          <div className="relative">
            <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={selectedClientFilter}
              onChange={e => setSelectedClientFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos los Clientes ({uniqueClients.length})</option>
              {uniqueClients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date Range From/To */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                title="Fecha Desde"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>
            <span className="text-slate-400 text-xs">a</span>
            <div className="relative flex-1">
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                title="Fecha Hasta"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Status / Aging Filter */}
          <div>
            <select
              value={statusInvoiceFilter}
              onChange={e => setStatusInvoiceFilter(e.target.value as any)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold cursor-pointer focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Facturas y Estados</option>
              <option value="CON_FACTURA">Con Nº de Factura Asignado</option>
              <option value="SIN_FACTURA">Pendientes de Factura (Sin Nº)</option>
              <option value="EN_MORA">En Mora (+30 días desde facturación)</option>
            </select>
          </div>

        </div>

        {/* Quick info bar for filters & bulk selection */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">
              Mostrando <strong className="text-slate-900 dark:text-white">{filteredRecords.length}</strong> de {facturados.length} remitos
            </span>
            {(selectedClientFilter !== 'ALL' || dateFrom || dateTo || statusInvoiceFilter !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedClientFilter('ALL');
                  setDateFrom('');
                  setDateTo('');
                  setStatusInvoiceFilter('ALL');
                  setSearchTerm('');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {selectedRecords.length === filteredRecords.length && filteredRecords.length > 0
                ? 'Deseleccionar Todos'
                : 'Seleccionar Todos'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Facturado Table */}
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
                    className="rounded-sm border-slate-300 dark:border-slate-700 text-blue-600 cursor-pointer"
                  />
                </th>
                <th className="p-3.5">REMITO</th>
                <th className="p-3.5">FECHA</th>
                <th className="p-3.5">CLIENTE / POZO</th>
                <th className="p-3.5">DESCRIPCIÓN DE TAREAS</th>
                <th className="p-3.5">Nº FACTURA (AGRUPABLE)</th>
                <th className="p-3.5">FECHA FACTURA</th>
                <th className="p-3.5 text-center bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300">
                  DÍAS FACTURADO
                </th>
                <th className="p-3.5 text-right">TOTAL FACTURADO ($)</th>
                <th className="p-3.5 text-right bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400">
                  RET. IVA ($)
                </th>
                <th className="p-3.5 text-right bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400">
                  RET. IIBB ($)
                </th>
                <th className="p-3.5 text-right bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400">
                  RET. GANANCIAS ($)
                </th>
                <th className="p-3.5 text-right font-black">NETO A COBRAR ($)</th>
                <th className="p-3.5 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <FileCheck2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-black text-sm text-slate-700 dark:text-slate-300">
                        No se encontraron remitos facturados con los filtros actuales
                      </p>
                      <p className="text-xs text-slate-400">
                        Puede pasar remitos de "Cargado" a "Facturado" desde Auditoría Técnica, o importar un archivo Excel desde el botón superior.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => {
                  const billed = (record.billedPrice > 0 ? record.billedPrice : (record.suggestedPrice || 0)) || 0;
                  const retIVA = record.retencionIVA || 0;
                  const retIIBB = record.retencionIIBB || 0;
                  const retGan = record.retencionGanancias || 0;
                  const neto = Math.max(0, billed - (retIVA + retIIBB + retGan));
                  const isSelected = selectedRecords.includes(record.id);

                  // Days counter
                  const daysElapsed = getDaysElapsed(record.fechaFactura, record.date);

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(record.id)}
                          className="rounded-sm border-slate-300 dark:border-slate-700 text-blue-600 cursor-pointer"
                        />
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

                      {/* Cliente */}
                      <td className="p-3.5 max-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={record.clientName}>
                          {record.clientName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate" title={record.workPoint}>
                          {record.workPoint || record.siteLocation}
                        </div>
                      </td>

                      {/* Descripción de Tareas */}
                      <td className="p-3.5 max-w-[220px]">
                        <div className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2" title={record.description || ''}>
                          {record.description || <span className="italic text-slate-400">Sin descripción</span>}
                        </div>
                      </td>

                      {/* Nº Factura */}
                      <td className="p-3.5 whitespace-nowrap">
                        {editingInvoiceId === record.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={tempInvoiceVal}
                              onChange={e => setTempInvoiceVal(e.target.value)}
                              placeholder="FAC-A-..."
                              className="px-2 py-1 rounded-md border border-blue-400 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white w-36"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveInvoiceNumber(record.id)}
                              className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
                              title="Guardar Factura"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            {record.numeroFactura ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-500/20">
                                  {record.numeroFactura}
                                </span>
                                <button
                                  onClick={() => handleDownloadInvoicePDF(record.numeroFactura!)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                  title={`Descargar Detalle Factura ${record.numeroFactura} en PDF`}
                                >
                                  <Download className="w-3 h-3 text-indigo-500" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Sin Asignar</span>
                            )}
                            <button
                              onClick={() => {
                                setEditingInvoiceId(record.id);
                                setTempInvoiceVal(record.numeroFactura || '');
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-opacity cursor-pointer"
                              title="Editar Factura"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Fecha Factura */}
                      <td className="p-3.5 whitespace-nowrap">
                        <input
                          type="date"
                          value={record.fechaFactura || ''}
                          onChange={e => updateTechnicalAuditRecord(record.id, { fechaFactura: e.target.value })}
                          className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                          title="Fecha de factura para cálculo de días facturado"
                        />
                      </td>

                      {/* Contador Automático Días Facturado */}
                      <td className="p-3.5 text-center whitespace-nowrap bg-blue-50/20 dark:bg-blue-950/10">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black font-mono ${
                            daysElapsed > 30
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 animate-pulse'
                              : daysElapsed > 15
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                          title={`Días transcurridos desde fecha factura: ${record.fechaFactura || record.date}`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{daysElapsed} d</span>
                          {daysElapsed > 30 && <span className="text-[10px] uppercase font-sans">Mora</span>}
                        </span>
                      </td>

                      {/* Total Facturado (Editable) */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {editingBilledId === record.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-slate-400">$</span>
                            <input
                              type="number"
                              step="any"
                              value={tempBilledVal}
                              onChange={e => setTempBilledVal(parseFloat(e.target.value) || 0)}
                              className="w-24 px-1.5 py-0.5 border border-blue-400 rounded text-right font-mono font-black text-xs bg-white dark:bg-slate-800"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveBilledAmount(record.id)}
                              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
                              title="Guardar nuevo monto facturado"
                            >
                              <Save className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBilledId(null)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex flex-col items-end group/billed cursor-pointer"
                            onClick={() => {
                              setEditingBilledId(record.id);
                              setTempBilledVal(billed);
                            }}
                            title="Haz clic para editar el monto facturado"
                          >
                            <div className="flex items-center gap-1">
                              <span className="font-black text-slate-900 dark:text-white">
                                ${(billed || 0).toLocaleString('es-AR')}
                              </span>
                              <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/billed:opacity-100 text-slate-400 hover:text-blue-500 transition-opacity" />
                            </div>
                            {record.montoBaseRemito !== undefined && record.recargo7Pct !== undefined && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-sans font-normal" title={`Base: $${(record.montoBaseRemito || 0).toLocaleString('es-AR')} + 7% ($${(record.recargo7Pct || 0).toLocaleString('es-AR')}) + IVA ${record.ivaPct || 21}%`}>
                                Base: ${(record.montoBaseRemito || 0).toLocaleString('es-AR')} (+7% + IVA {record.ivaPct || 21}%)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Retención IVA */}
                      <td className="p-3.5 text-right bg-amber-50/20 dark:bg-amber-950/10">
                        <input
                          type="number"
                          min="0"
                          value={record.retencionIVA ?? ''}
                          onChange={e =>
                            updateTechnicalAuditRecord(record.id, {
                              retencionIVA: Number(e.target.value) || 0
                            })
                          }
                          placeholder="0"
                          className="w-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right font-mono font-bold text-amber-700 dark:text-amber-400 text-xs focus:ring-1 focus:ring-amber-500"
                        />
                      </td>

                      {/* Retención IIBB */}
                      <td className="p-3.5 text-right bg-amber-50/20 dark:bg-amber-950/10">
                        <input
                          type="number"
                          min="0"
                          value={record.retencionIIBB ?? ''}
                          onChange={e =>
                            updateTechnicalAuditRecord(record.id, {
                              retencionIIBB: Number(e.target.value) || 0
                            })
                          }
                          placeholder="0"
                          className="w-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right font-mono font-bold text-amber-700 dark:text-amber-400 text-xs focus:ring-1 focus:ring-amber-500"
                        />
                      </td>

                      {/* Retención Ganancias */}
                      <td className="p-3.5 text-right bg-amber-50/20 dark:bg-amber-950/10">
                        <input
                          type="number"
                          min="0"
                          value={record.retencionGanancias ?? ''}
                          onChange={e =>
                            updateTechnicalAuditRecord(record.id, {
                              retencionGanancias: Number(e.target.value) || 0
                            })
                          }
                          placeholder="0"
                          className="w-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right font-mono font-bold text-amber-700 dark:text-amber-400 text-xs focus:ring-1 focus:ring-amber-500"
                        />
                      </td>

                      {/* Neto a Cobrar */}
                      <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-sm">
                        ${(neto || 0).toLocaleString('es-AR')}
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Descargar PDF */}
                          <button
                            onClick={() => handleDownloadSinglePDF(record)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Descargar Remito en PDF"
                          >
                            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </button>

                          {/* Imprimir */}
                          <button
                            onClick={() => handlePrintSingle(record)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Imprimir"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Pasar a Cobrado */}
                          <button
                            onClick={() => handleOpenCobroSingle(record)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer"
                            title="Registrar Cobro y Formas de Pago"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>COBRAR</span>
                          </button>

                          {/* Pasar a Pasado */}
                          <button
                            onClick={() => handleMoveToPasado(record.id)}
                            className="p-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                            title="Mover a Pasado"
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

      {/* Group Invoice Modal (Sumar o Crear Factura Común) */}
      {showGroupInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Facturación Agrupada de Remitos
                  </h3>
                  <p className="text-xs text-slate-400">
                    Asignar o sumar a una misma factura ({selectedRecords.length} remitos seleccionados)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGroupInvoiceModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning if multiple clients are selected */}
            {isMultiClientSelected && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Atención: Remitos de múltiples clientes
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Ha seleccionado remitos de: <strong>{selectedClients.join(', ')}</strong>. Una factura habitualmente se emite a un único cliente.
                  </p>
                </div>
              </div>
            )}

            {/* Selection Type: New vs Existing */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setGroupInvoiceMode('new')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  groupInvoiceMode === 'new'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Crear Nueva Factura
              </button>
              <button
                type="button"
                onClick={() => setGroupInvoiceMode('existing')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  groupInvoiceMode === 'existing'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sumar a Factura Existente
              </button>
            </div>

            {groupInvoiceMode === 'new' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    NÚMERO DE FACTURA (OFICIAL AFIP)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. FAC-A-0001-00004523"
                    value={newInvoiceNumber}
                    onChange={e => setNewInvoiceNumber(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    FECHA DE FACTURACIÓN
                  </label>
                  <input
                    type="date"
                    value={newInvoiceDate}
                    onChange={e => setNewInvoiceDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    El contador de antigüedad iniciará el conteo de días a partir de esta fecha.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    SELECCIONAR FACTURA EXISTENTE
                  </label>
                  {existingInvoices.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                      No hay facturas previas registradas. Por favor elija "Crear Nueva Factura".
                    </p>
                  ) : (
                    <select
                      value={selectedExistingInvoice}
                      onChange={e => setSelectedExistingInvoice(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">-- Seleccione una Factura --</option>
                      {existingInvoices.map(inv => (
                        <option key={`${inv.clientName}-${inv.invoiceNumber}`} value={inv.invoiceNumber}>
                          {inv.invoiceNumber} · {inv.clientName} ({inv.count} remitos)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Selected Remitos Summary Box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Remitos Seleccionados:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedRecords.length} remito(s)</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Monto Total a Facturar:</span>
                <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                  ${(selectedRecordsData.reduce((acc, r) => acc + ((r.billedPrice && r.billedPrice > 0) ? r.billedPrice : (r.suggestedPrice || 0)), 0) || 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGroupInvoiceModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyGroupInvoice}
                disabled={groupInvoiceMode === 'new' ? !newInvoiceNumber.trim() : !selectedExistingInvoice}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all cursor-pointer shadow-md shadow-blue-500/20"
              >
                Confirmar Facturación Agrupada
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setRecordsToPay([]);
            setSelectedRecords([]);
          }}
          records={recordsToPay}
          onSuccess={() => {
            setPaymentModalOpen(false);
            setRecordsToPay([]);
            setSelectedRecords([]);
          }}
        />
      )}

      {/* Excel Import Modal */}
      {excelImportOpen && (
        <ExcelImportModal
          isOpen={excelImportOpen}
          onClose={() => setExcelImportOpen(false)}
          onSuccess={(count) => {
            setExcelImportOpen(false);
          }}
        />
      )}

      {/* Pasar a Facturado Modal */}
      <PasarAFacturadoModal
        isOpen={pasarFacturadoOpen}
        onClose={() => setPasarFacturadoOpen(false)}
        availableRecords={availableToInvoice}
        onConfirm={async (recordIds, num, date, billing) => {
          await bulkPassToFacturado(recordIds, num, date, billing);
          setPasarFacturadoOpen(false);
        }}
      />

      {/* Actualizar Descripciones desde Excel Modal */}
      <ActualizarDescripcionesModal
        isOpen={actualizarDescOpen}
        onClose={() => setActualizarDescOpen(false)}
      />

    </div>
  );
};
