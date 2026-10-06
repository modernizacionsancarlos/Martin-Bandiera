import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  CheckCircle2,
  Printer,
  Download,
  FileCheck,
  Building,
  CreditCard,
  Calendar,
  AlertCircle,
  Receipt
} from 'lucide-react';
import { TechnicalAuditRecord, PaymentEntry, ArchivedReceipt } from '../types';
import { useData } from '../context/DataContext';
import { generateReciboCobroPDF } from '../utils/pdfGenerator';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: TechnicalAuditRecord[];
  invoiceNumber?: string;
  onSuccess?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  records,
  invoiceNumber,
  onSuccess
}) => {
  const { updateTechnicalAuditRecord, addArchivedReceipt } = useData();

  if (!isOpen || records.length === 0) return null;

  const first = records[0];
  const commonClient = first.clientName;
  const commonInvoice = invoiceNumber || first.numeroFactura || '';

  // Sum total facturado of all selected remitos
  const totalFacturadoSum = useMemo(() => {
    return records.reduce((acc, r) => acc + (r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || 0)), 0);
  }, [records]);

  // Initial retenciones (loaded from records or defaults)
  const initialIVA = useMemo(() => records.reduce((acc, r) => acc + (r.retencionIVA || 0), 0), [records]);
  const initialIIBB = useMemo(() => records.reduce((acc, r) => acc + (r.retencionIIBB || 0), 0), [records]);
  const initialGanancias = useMemo(() => records.reduce((acc, r) => acc + (r.retencionGanancias || 0), 0), [records]);

  const [retencionIVA, setRetencionIVA] = useState<number>(initialIVA);
  const [retencionIIBB, setRetencionIIBB] = useState<number>(initialIIBB);
  const [retencionGanancias, setRetencionGanancias] = useState<number>(initialGanancias);

  // Total retenciones and Net to collect
  const totalRetenciones = (retencionIVA || 0) + (retencionIIBB || 0) + (retencionGanancias || 0);
  const totalNetoACobrar = Math.max(0, totalFacturadoSum - totalRetenciones);

  // Multiple payment entries state
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>(() => {
    // If existing in first record, prefill
    if (first.paymentMethods && first.paymentMethods.length > 0) {
      return first.paymentMethods;
    }
    // Default 1 entry matching totalNetoACobrar
    return [
      {
        id: `PAY-${Date.now()}-1`,
        method: 'Transferencia',
        amount: totalNetoACobrar,
        bank: 'Banco Galicia',
        reference: 'TR-',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: ''
      }
    ];
  });

  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoiceNumberState, setInvoiceNumberState] = useState<string>(commonInvoice);
  const [isSuccessView, setIsSuccessView] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState<ArchivedReceipt | null>(null);

  // Calculate total currently assigned in payment entries
  const totalPagadoEntries = paymentEntries.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const remainingDifference = totalNetoACobrar - totalPagadoEntries;

  const handleAddPaymentEntry = () => {
    const nextAmount = Math.max(0, remainingDifference);
    setPaymentEntries(prev => [
      ...prev,
      {
        id: `PAY-${Date.now()}-${prev.length + 1}`,
        method: 'Cheque',
        amount: nextAmount,
        bank: '',
        reference: '',
        paymentDate,
        notes: ''
      }
    ]);
  };

  const handleUpdatePaymentEntry = (id: string, field: keyof PaymentEntry, value: any) => {
    setPaymentEntries(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemovePaymentEntry = (id: string) => {
    if (paymentEntries.length === 1) return;
    setPaymentEntries(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmCobro = () => {
    // Distribute retenciones proportionally across records if multiple
    const count = Math.max(1, records.length);
    const ivaPerRecord = Math.round((retencionIVA || 0) / count);
    const iibbPerRecord = Math.round((retencionIIBB || 0) / count);
    const gananciasPerRecord = Math.round((retencionGanancias || 0) / count);

    // 1. Update all records to Cobrado
    records.forEach(r => {
      updateTechnicalAuditRecord(r.id, {
        status: 'Cobrado',
        semaforo: 'verde',
        numeroFactura: invoiceNumberState || r.numeroFactura,
        fechaCobro: paymentDate,
        retencionIVA: ivaPerRecord,
        retencionIIBB: iibbPerRecord,
        retencionGanancias: gananciasPerRecord,
        paymentMethods: paymentEntries,
        collectedPrice: r.billedPrice || r.suggestedPrice
      });
    });

    // 2. Generate Receipt / PDF and Save to Archivo
    const receiptNum = `REC-${records[0].remitoId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const savedReceipt = addArchivedReceipt({
      receiptNumber: receiptNum,
      remitoIds: records.map(r => r.remitoId),
      clientName: commonClient,
      date: paymentDate,
      totalAmount: totalFacturadoSum,
      invoiceNumber: invoiceNumberState,
      retencionIVA,
      retencionIIBB,
      retencionGanancias,
      paymentMethods: paymentEntries,
      type: 'RECIBO_COBRADO',
      notes: `Cobro de ${records.length} remito(s). Factura: ${invoiceNumberState || 'S/F'}. Retenciones: $${totalRetenciones.toLocaleString('es-AR')}. Neto Pagado: $${totalPagadoEntries.toLocaleString('es-AR')}.`
    });

    setGeneratedReceipt(savedReceipt);
    setIsSuccessView(true);

    if (onSuccess) {
      onSuccess();
    }
  };

  const handleDownloadPDF = () => {
    generateReciboCobroPDF({
      receiptNumber: generatedReceipt?.receiptNumber || `REC-${records[0]?.remitoId || '001'}`,
      clientName: commonClient,
      date: paymentDate,
      invoiceNumber: invoiceNumberState,
      remitoIds: records.map(r => r.remitoId),
      totalAmount: totalFacturadoSum,
      retencionIVA,
      retencionIIBB,
      retencionGanancias,
      paymentMethods: paymentEntries,
      notes: `Cobro de ${records.length} remito(s). Factura: ${invoiceNumberState || 'S/F'}. Retenciones: $${totalRetenciones.toLocaleString('es-AR')}. Neto Pagado: $${totalPagadoEntries.toLocaleString('es-AR')}.`
    });
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[96vh] sm:max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 shrink-0">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100">
                MÓDULO DE TESORERÍA & COBRANZAS
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                {isSuccessView ? 'COMPROBANTE DE COBRO GENERADO & ARCHIVADO' : 'REGISTRAR COBRO Y FORMAS DE PAGO'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isSuccessView ? (
          /* Form Content */
          <div className="p-4 sm:p-6 space-y-6 text-xs text-slate-800 dark:text-slate-100 overflow-y-auto flex-1">
            
            {/* Top Summary of Remitos & Client */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">CLIENTE</span>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                  {commonClient}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {records.map(r => (
                    <span key={r.id} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px] border border-emerald-500/20">
                      {r.remitoId}
                    </span>
                  ))}
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] font-black uppercase text-slate-400">TOTAL FACTURADO BRUTO</span>
                <p className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  ${(totalFacturadoSum || 0).toLocaleString('es-AR')}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {records.length} Remito(s) seleccionado(s)
                </p>
              </div>
            </div>

            {/* Factura & Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Nº de Factura (Opcional o agrupada)
                </label>
                <input
                  type="text"
                  placeholder="ej. FAC-A-0004-00012894"
                  value={invoiceNumberState}
                  onChange={e => setInvoiceNumberState(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Una misma factura puede asociar múltiples remitos.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Fecha Efectiva de Cobro
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Manual Retenciones Section */}
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Retenciones Impositivas (Carga Manual)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Deducciones efectuadas en la orden de pago del cliente.
                  </p>
                </div>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                  Total Retenciones: -${totalRetenciones.toLocaleString('es-AR')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Retención IVA ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={retencionIVA || ''}
                    onChange={e => setRetencionIVA(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Retención IIBB ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={retencionIIBB || ''}
                    onChange={e => setRetencionIIBB(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Retención Ganancias ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={retencionGanancias || ''}
                    onChange={e => setRetencionGanancias(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Total Neto a Percibir / Justificar:
                </span>
                <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  ${totalNetoACobrar.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Multiple Payment Methods */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Formas de Pago Aplicadas (Puede registrar más de una)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Combine transferencias, cheques, e-cheqs o efectivo hasta cubrir el total neto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPaymentEntry}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>AÑADIR FORMA DE PAGO</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {paymentEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                        Método #{index + 1}
                      </label>
                      <select
                        value={entry.method}
                        onChange={e => handleUpdatePaymentEntry(entry.id, 'method', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white"
                      >
                        <option value="Transferencia">Transferencia Bancaria</option>
                        <option value="Cheque">Cheque Físico</option>
                        <option value="E-Cheq">E-Cheq Electrónico</option>
                        <option value="Efectivo">Efectivo / Caja</option>
                        <option value="Depósito">Depósito Bancario</option>
                        <option value="Otro">Otro Comprobante</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                        Monto ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={entry.amount || ''}
                        onChange={e => handleUpdatePaymentEntry(entry.id, 'amount', Number(e.target.value) || 0)}
                        placeholder="Monto"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono font-bold text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                        Banco / Origen
                      </label>
                      <input
                        type="text"
                        value={entry.bank || ''}
                        onChange={e => handleUpdatePaymentEntry(entry.id, 'bank', e.target.value)}
                        placeholder="ej. Galicia / Macro"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                        Nº Ref / Cheque
                      </label>
                      <input
                        type="text"
                        value={entry.reference || ''}
                        onChange={e => handleUpdatePaymentEntry(entry.id, 'reference', e.target.value)}
                        placeholder="Ref. / Nº"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                      <button
                        type="button"
                        disabled={paymentEntries.length === 1}
                        onClick={() => handleRemovePaymentEntry(entry.id)}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ${
                          paymentEntries.length === 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        title="Eliminar forma de pago"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Balance & Comparison Bar */}
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Total Formas de Pago: </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ${totalPagadoEntries.toLocaleString('es-AR')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {remainingDifference === 0 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> Cuadre exacto con el total neto
                    </span>
                  ) : remainingDifference > 0 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" /> Falta asignar ${remainingDifference.toLocaleString('es-AR')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4" /> Excede por ${Math.abs(remainingDifference).toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Success Document Generated View */
          <div className="p-4 sm:p-6 md:p-8 space-y-6 text-slate-800 dark:text-slate-100 print:p-0 print:text-black overflow-y-auto flex-1">
            
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <div>
                  <h4 className="font-black text-emerald-800 dark:text-emerald-300 text-sm">
                    Cobro registrado con éxito y enviado al Archivo
                  </h4>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Comprobante guardado en la solapa "Archivo de Comprobantes".
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-white text-emerald-900 hover:bg-emerald-100 transition-all cursor-pointer shadow-xs"
                  title="Descargar archivo PDF"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>DESCARGAR PDF</span>
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs"
                  title="Imprimir Comprobante"
                >
                  <Printer className="w-4 h-4" />
                  <span>IMPRIMIR</span>
                </button>
              </div>
            </div>

            {/* Printable Receipt Paper */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-5">
              
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-4">
                <div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    JOB <span className="text-emerald-500">Martin Bandiera</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comprobante Oficial de Cobranza & Recibo
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-400">Nº RECIBO</span>
                  <div className="font-mono font-black text-slate-900 dark:text-white text-base">
                    {generatedReceipt?.receiptNumber}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Fecha: {paymentDate}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">CLIENTE</span>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">{commonClient}</p>
                  {invoiceNumberState && (
                    <p className="text-slate-500 mt-1 font-mono">Factura Asociada: {invoiceNumberState}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-400">REMITOS CANCELADOS</span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {records.map(r => r.remitoId).join(', ')}
                  </p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-black text-[11px] text-slate-500 uppercase">
                    <tr>
                      <th className="p-3">Concepto</th>
                      <th className="p-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    <tr>
                      <td className="p-3">Total Bruto Facturado ({records.length} remitos)</td>
                      <td className="p-3 text-right font-bold">${(totalFacturadoSum || 0).toLocaleString('es-AR')}</td>
                    </tr>
                    {retencionIVA > 0 && (
                      <tr className="text-amber-600 dark:text-amber-400">
                        <td className="p-3 pl-6">- Retención IVA Deducida</td>
                        <td className="p-3 text-right">-${(retencionIVA || 0).toLocaleString('es-AR')}</td>
                      </tr>
                    )}
                    {retencionIIBB > 0 && (
                      <tr className="text-amber-600 dark:text-amber-400">
                        <td className="p-3 pl-6">- Retención Ingresos Brutos (IIBB) Deducida</td>
                        <td className="p-3 text-right">-${(retencionIIBB || 0).toLocaleString('es-AR')}</td>
                      </tr>
                    )}
                    {retencionGanancias > 0 && (
                      <tr className="text-amber-600 dark:text-amber-400">
                        <td className="p-3 pl-6">- Retención Ganancias Deducida</td>
                        <td className="p-3 text-right">-${(retencionGanancias || 0).toLocaleString('es-AR')}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30 font-bold">
                      <td className="p-3 font-sans">Total Neto Percibido</td>
                      <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                        ${(totalPagadoEntries || 0).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="space-y-1 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400">FORMAS DE PAGO REGISTRADAS:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {paymentEntries.map((p, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex justify-between items-center font-bold">
                        <span>{p.method}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">${(p.amount || 0).toLocaleString('es-AR')}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {p.bank && <span>{p.bank} · </span>}
                        {p.reference && <span>Ref: {p.reference}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {isSuccessView ? 'Finalizar y Volver' : 'Cancelar'}
          </button>

          {!isSuccessView ? (
            <button
              onClick={handleConfirmCobro}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>CONFIRMAR COBRO, GENERAR PDF Y ARCHIVAR</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition-all cursor-pointer"
            >
              Cerrar y Ver Solapa Cobrado
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
