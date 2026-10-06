import React, { useState, useMemo } from 'react';
import {
  FolderArchive,
  Search,
  Printer,
  Trash2,
  Receipt,
  FileText,
  Calendar,
  DollarSign,
  Download,
  Building,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Eye,
  X
} from 'lucide-react';
import { ArchivedReceipt } from '../types';
import { useData } from '../context/DataContext';
import { generateReciboCobroPDF, generateRemitoPasadoPDF } from '../utils/pdfGenerator';

export const ArchivoComprobantesView: React.FC = () => {
  const { archivedReceipts, deleteArchivedReceipt } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'RECIBO_COBRADO' | 'REMITO_PASADO'>('ALL');
  const [previewReceipt, setPreviewReceipt] = useState<ArchivedReceipt | null>(null);

  // Filter receipts
  const filtered = useMemo(() => {
    return archivedReceipts.filter(r => {
      const matchType = filterType === 'ALL' || r.type === filterType;
      const matchSearch =
        r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.remitoIds.some(id => id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        r.date.includes(searchTerm);
      return matchType && matchSearch;
    });
  }, [archivedReceipts, filterType, searchTerm]);

  // KPIs
  const totalMontoArchivado = useMemo(() => {
    return archivedReceipts.reduce((acc, r) => acc + (r.totalAmount || 0), 0);
  }, [archivedReceipts]);

  const countCobrados = archivedReceipts.filter(r => r.type === 'RECIBO_COBRADO').length;
  const countPasados = archivedReceipts.filter(r => r.type === 'REMITO_PASADO').length;

  const handleDownloadPDF = (receipt: ArchivedReceipt) => {
    if (receipt.type === 'RECIBO_COBRADO') {
      generateReciboCobroPDF({
        receiptNumber: receipt.receiptNumber,
        clientName: receipt.clientName,
        date: receipt.date,
        invoiceNumber: receipt.invoiceNumber,
        remitoIds: receipt.remitoIds,
        totalAmount: receipt.totalAmount,
        retencionIVA: receipt.retencionIVA,
        retencionIIBB: receipt.retencionIIBB,
        retencionGanancias: receipt.retencionGanancias,
        paymentMethods: receipt.paymentMethods,
        notes: receipt.notes
      });
    } else {
      generateRemitoPasadoPDF({
        id: receipt.id,
        remitoId: receipt.remitoIds[0] || receipt.receiptNumber,
        remitoPapel: '',
        date: receipt.date,
        clientName: receipt.clientName,
        siteLocation: 'Valle de Uco / Mendoza',
        workPoint: 'Trabajos ejecutados',
        isGuardia: false,
        hoursWorked: 0,
        travelHours: 0,
        distanceKm: 0,
        horaEntrada: '08:00',
        horaSalida: '12:00',
        logisticsCost: 0,
        laborDirectCost: receipt.totalAmount,
        operatingCost: receipt.totalAmount,
        materialsCost: 0,
        materialsDetails: '',
        description: receipt.notes || 'Comprobante archivado de Remito Pasado',
        suggestedPrice: receipt.totalAmount,
        billedPrice: receipt.totalAmount,
        collectedPrice: receipt.totalAmount,
        helperPay: 0,
        techPay: 0,
        leadTech: 'Ing. Matías Calderón',
        helpers: [],
        status: 'Pasado',
        semaforo: 'naranja'
      });
    }
  };

  const handlePrint = (receipt: ArchivedReceipt) => {
    setPreviewReceipt(receipt);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-slate-200 text-xs font-black uppercase tracking-wider mb-3">
              <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
              SOLAPA ARCHIVO · REPOSITORIO DE COMPROBANTES Y RECIBOS
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Archivo Digital de Comprobantes
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl font-medium">
              Historial permanente de todos los comprobantes emitidos: Recibos de Cobro con formas de pago
              y retenciones, así como los Remitos Pasados generados. Cada archivo se puede volver a consultar,
              imprimir o descargar en cualquier momento.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>TOTAL EN ARCHIVO</span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <FolderArchive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {archivedReceipts.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Comprobantes digitales registrados
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>MONTO TOTAL RESPALDADO</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            ${(totalMontoArchivado || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Suma total de comprobantes archivados
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>RECIBOS DE COBRO</span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400 mt-2">
            {countCobrados}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Con formas de pago detalladas
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>REMITOS PASADOS</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
            {countPasados}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Con columna discriminada de materiales
          </p>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Nº Comprobante, Remito o Cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        {/* Type selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Todos ({archivedReceipts.length})
          </button>
          <button
            onClick={() => setFilterType('RECIBO_COBRADO')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              filterType === 'RECIBO_COBRADO'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Cobranzas ({countCobrados})
          </button>
          <button
            onClick={() => setFilterType('REMITO_PASADO')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              filterType === 'REMITO_PASADO'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Pasados ({countPasados})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                <th className="p-3.5">Nº COMPROBANTE</th>
                <th className="p-3.5">TIPO</th>
                <th className="p-3.5">FECHA</th>
                <th className="p-3.5">CLIENTE</th>
                <th className="p-3.5">REMITOS ASOCIADOS</th>
                <th className="p-3.5 text-right">MONTO TOTAL ($)</th>
                <th className="p-3.5">DETALLES / FORMAS DE PAGO</th>
                <th className="p-3.5 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <FolderArchive className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        No se encontraron comprobantes en el Archivo
                      </p>
                      <p className="text-xs">
                        Los comprobantes se archivan automáticamente al generar un "Recibo/Remito Pasado" o al registrar el cobro en la solapa Facturado/Pasado.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(receipt => (
                  <tr
                    key={receipt.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Nº Comprobante */}
                    <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {receipt.receiptNumber}
                    </td>

                    {/* Tipo */}
                    <td className="p-3.5 whitespace-nowrap">
                      {receipt.type === 'RECIBO_COBRADO' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase">
                          RECIBO DE COBRO
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase">
                          REMITO PASADO
                        </span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {receipt.date}
                    </td>

                    {/* Cliente */}
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white max-w-[200px] truncate" title={receipt.clientName}>
                      {receipt.clientName}
                    </td>

                    {/* Remitos */}
                    <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {receipt.remitoIds.join(', ')}
                    </td>

                    {/* Monto */}
                    <td className="p-3.5 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap text-sm">
                      ${(receipt.totalAmount || 0).toLocaleString('es-AR')}
                    </td>

                    {/* Detalles */}
                    <td className="p-3.5 max-w-[240px]">
                      {receipt.paymentMethods && receipt.paymentMethods.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {receipt.paymentMethods.map((p, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {p.method} ${(p.amount || 0).toLocaleString('es-AR')}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 truncate block">
                          {receipt.notes || 'Comprobante digital'}
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setPreviewReceipt(receipt)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Visualizar Comprobante"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(receipt)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                          title="Descargar PDF oficial"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => handlePrint(receipt)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                          title="Imprimir comprobante"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteArchivedReceipt(receipt.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Eliminar de archivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">COMPROBANTE DIGITAL</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {previewReceipt.receiptNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  JOB Martin Bandiera · Archivo Permanente
                </p>
              </div>
              <button
                onClick={() => setPreviewReceipt(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">CLIENTE</span>
                <p className="font-black text-slate-900 dark:text-white text-sm mt-0.5">{previewReceipt.clientName}</p>
                {previewReceipt.invoiceNumber && (
                  <p className="text-slate-500 mt-1 font-mono">Factura: {previewReceipt.invoiceNumber}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-slate-400">FECHA & REMITOS</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{previewReceipt.date}</p>
                <p className="font-mono text-slate-500 text-[11px] mt-0.5">{previewReceipt.remitoIds.join(', ')}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">MONTO TOTAL REGISTRADO</span>
              <span className="font-mono font-black text-lg text-slate-900 dark:text-white">
                ${(previewReceipt.totalAmount || 0).toLocaleString('es-AR')}
              </span>
            </div>

            {previewReceipt.paymentMethods && previewReceipt.paymentMethods.length > 0 && (
              <div className="space-y-2 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400">MÉTODOS DE PAGO:</span>
                <div className="space-y-1.5">
                  {previewReceipt.paymentMethods.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <span>{p.method} {p.bank ? `(${p.bank})` : ''}</span>
                      <span className="font-mono font-bold">${(p.amount || 0).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewReceipt(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={() => handleDownloadPDF(previewReceipt)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF</span>
              </button>
              <button
                onClick={() => handlePrint(previewReceipt)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
