import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  DollarSign,
  Search,
  Printer,
  FileCheck,
  Receipt,
  CreditCard,
  Building,
  RotateCcw,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Percent,
  Download
} from 'lucide-react';
import { TechnicalAuditRecord } from '../types';
import { useData } from '../context/DataContext';
import { PaymentModal } from './PaymentModal';
import { exportCobradosToExcel } from '../utils/excelParser';

interface CobradoViewProps {
  onNavigateToArchive?: () => void;
}

export const CobradoView: React.FC<CobradoViewProps> = ({ onNavigateToArchive }) => {
  const { technicalAuditRecords, updateTechnicalAuditRecord, archivedReceipts } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecord, setEditingRecord] = useState<TechnicalAuditRecord | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Filter records in 'Cobrado'
  const cobrados = useMemo(() => {
    // Los remitos archivados salen de esta lista de trabajo; siguen en Auditoría Técnica (búsqueda y filtro Archivado)
    return technicalAuditRecords.filter(r => r.status === 'Cobrado' && !r.archivado);
  }, [technicalAuditRecords]);

  // Apply search
  const filteredRecords = useMemo(() => {
    return cobrados.filter(r => {
      const matchSearch =
        r.remitoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.remitoPapel && r.remitoPapel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.numeroFactura && r.numeroFactura.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.fechaCobro && r.fechaCobro.includes(searchTerm)) ||
        (r.paymentMethods && r.paymentMethods.some(p => p.method.toLowerCase().includes(searchTerm.toLowerCase()) || (p.bank && p.bank.toLowerCase().includes(searchTerm.toLowerCase()))));
      return matchSearch;
    });
  }, [cobrados, searchTerm]);

  // KPIs
  const totalCobrado = useMemo(() => {
    return cobrados.reduce((acc, r) => acc + (r.collectedPrice || r.billedPrice || r.suggestedPrice || 0), 0);
  }, [cobrados]);

  const totalRetencionesCobrados = useMemo(() => {
    return cobrados.reduce((acc, r) => acc + (r.retencionIVA || 0) + (r.retencionIIBB || 0) + (r.retencionGanancias || 0), 0);
  }, [cobrados]);

  // Re-open to Facturado
  const handleReopenToFacturado = (id: string) => {
    updateTechnicalAuditRecord(id, { status: 'Facturado', semaforo: 'naranja', collectedPrice: 0 });
  };

  // Re-open to Pasado
  const handleReopenToPasado = (id: string) => {
    updateTechnicalAuditRecord(id, { status: 'Pasado', semaforo: 'naranja', collectedPrice: 0 });
  };

  const handleEditPayment = (record: TechnicalAuditRecord) => {
    setEditingRecord(record);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-black uppercase tracking-wider mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              SOLAPA COBRADO · FONDOS PERCIBIDOS Y COMPROBANTES DE ARCHIVO
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Remitos en Estado Cobrado
            </h1>
            <p className="text-emerald-100/90 text-xs sm:text-sm mt-1 max-w-2xl font-medium">
              Historial de remitos totalmente liquidados y cobrados provenientes de Facturado o Pasado,
              con detalle de medios de pago múltiples, retenciones fiscales aplicadas y comprobantes
              archivados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => exportCobradosToExcel(filteredRecords)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-white text-slate-900 hover:bg-emerald-50 shadow-lg transition-all cursor-pointer whitespace-nowrap"
              title="Descargar remitos cobrados en archivo Excel .xlsx"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>EXPORTAR EXCEL</span>
            </button>

            {onNavigateToArchive && (
              <button
                onClick={onNavigateToArchive}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <FileCheck className="w-4 h-4" />
                <span>VER ARCHIVO DE COMPROBANTES ({archivedReceipts.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>TOTAL COBRADO</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            ${(totalCobrado || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Fondos efectivamente acreditados
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>REMITOS COBRADOS</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {cobrados.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total de órdenes liquidadas
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>RETENCIONES APLICADAS</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
            ${(totalRetencionesCobrados || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Crédito fiscal acumulado (IVA, IIBB, Ganancias)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>COMPROBANTES EN ARCHIVO</span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {archivedReceipts.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            PDFs listos para consultar e imprimir
          </p>
        </div>

      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Remito, Cliente, Factura, Fecha o Método..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>
      </div>

      {/* Main Cobrado Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                <th className="p-3.5">REMITO</th>
                <th className="p-3.5">FECHA COBRO</th>
                <th className="p-3.5">CLIENTE / OBRA</th>
                <th className="p-3.5">Nº FACTURA</th>
                <th className="p-3.5 text-right">TOTAL COBRADO ($)</th>
                <th className="p-3.5">FORMAS DE PAGO (MÚLTIPLES)</th>
                <th className="p-3.5 text-right">RETENCIONES</th>
                <th className="p-3.5 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        No hay remitos en estado Cobrado
                      </p>
                      <p className="text-xs">
                        Para pasar un remito a esta solapa, haga clic en "Cobrar" en la solapa Facturado o Pasado.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => {
                  const montoCobrado = record.collectedPrice || record.billedPrice || record.suggestedPrice || 0;
                  const retTotal = (record.retencionIVA || 0) + (record.retencionIIBB || 0) + (record.retencionGanancias || 0);

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Remito */}
                      <td className="p-3.5 font-mono whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white">{record.remitoId}</span>
                        {record.remitoPapel && (
                          <span className="block text-[10px] text-slate-400">Papel: {record.remitoPapel}</span>
                        )}
                      </td>

                      {/* Fecha Cobro */}
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {record.fechaCobro || record.date}
                      </td>

                      {/* Cliente */}
                      <td className="p-3.5 max-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={record.clientName}>
                          {record.clientName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {record.workPoint || record.siteLocation}
                        </div>
                      </td>

                      {/* Nº Factura */}
                      <td className="p-3.5 font-mono whitespace-nowrap">
                        {record.numeroFactura ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-500/20">
                            {record.numeroFactura}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">S/F</span>
                        )}
                      </td>

                      {/* Monto Cobrado */}
                      <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-sm">
                        ${(montoCobrado || 0).toLocaleString('es-AR')}
                      </td>

                      {/* Formas de Pago Aplicadas */}
                      <td className="p-3.5">
                        {record.paymentMethods && record.paymentMethods.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {record.paymentMethods.map((pm, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold"
                              >
                                <span>{pm.method}:</span>
                                <span className="font-mono">${(pm.amount || 0).toLocaleString('es-AR')}</span>
                                {pm.bank && <span className="text-[9px] text-slate-400">({pm.bank})</span>}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                            Cobrado Total Efectivo / Banco
                          </span>
                        )}
                      </td>

                      {/* Retenciones */}
                      <td className="p-3.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {retTotal > 0 ? (
                          <div>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              -${(retTotal || 0).toLocaleString('es-AR')}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              IVA: ${record.retencionIVA || 0} · IIBB: ${record.retencionIIBB || 0}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">$0</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Editar Pagos */}
                          <button
                            onClick={() => handleEditPayment(record)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            title="Modificar Formas de Pago o Generar Recibo"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>PAGOS</span>
                          </button>

                          {/* Reabrir a Facturado */}
                          <button
                            onClick={() => handleReopenToFacturado(record.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                            title="Reabrir y mover a Facturado"
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

      {/* Payment Modal for editing */}
      {isPaymentModalOpen && editingRecord && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setEditingRecord(null);
          }}
          records={[editingRecord]}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            setEditingRecord(null);
          }}
        />
      )}

    </div>
  );
};
