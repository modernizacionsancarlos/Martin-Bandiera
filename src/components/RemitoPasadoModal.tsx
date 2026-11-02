import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  CheckCircle2,
  Package,
  FileSpreadsheet,
  Edit3,
  Check,
  Building2,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { TechnicalAuditRecord } from '../types';
import { useData } from '../context/DataContext';
import { generateRemitoPasadoPDF, generateRemitoPasadoConsolidadoPDF } from '../utils/pdfGenerator';
import { exportRemitoPasadoSingleToExcel, exportRemitoPasadoConsolidadoToExcel } from '../utils/excelParser';
import { formatCurrency, roundCurrency } from '../utils/calculationUtils';

interface RemitoPasadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: TechnicalAuditRecord | null;
  records?: TechnicalAuditRecord[];
  onConfirmPasado?: () => void;
}

export const RemitoPasadoModal: React.FC<RemitoPasadoModalProps> = ({
  isOpen,
  onClose,
  record,
  records,
  onConfirmPasado
}) => {
  const { addArchivedReceipt, updateTechnicalAuditRecord } = useData();
  const printRef = useRef<HTMLDivElement | null>(null);

  // Editing description state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Unify records
  const effectiveRecords = useMemo(() => {
    if (records && records.length > 0) return records;
    if (record) return [record];
    return [];
  }, [records, record]);

  if (!isOpen || effectiveRecords.length === 0) return null;

  const firstRecord = effectiveRecords[0];
  const uniqueClients = Array.from(new Set(effectiveRecords.map(r => r.clientName).filter(Boolean)));
  const hasMultipleClients = uniqueClients.length > 1;
  const clientName = hasMultipleClients ? uniqueClients.join(', ') : (firstRecord.clientName || 'Cliente');
  const siteLocation = firstRecord.siteLocation || 'Mendoza / Valle de Uco';
  const leadTech = firstRecord.leadTech || 'Ing. Matías Calderón';
  const dateStr = effectiveRecords.length === 1 ? firstRecord.date : `${firstRecord.date} (${effectiveRecords.length} remitos)`;

  // Summary sums:
  // El precio del remito (billedPrice o suggestedPrice) ya contiene todos los costos operativos y margen.
  // Para evitar duplicar materiales o sumar dos veces:
  // - totalFinalPasado es el valor total del remito.
  // - totalMateriales es el costo de materiales diferenciado.
  // - totalServicio es el remanente de mano de obra y logística (totalFinalPasado - totalMateriales).
  // De este modo: totalServicio + totalMateriales = totalFinalPasado (Total del Remito).
  const totalFinalPasado = roundCurrency(
    effectiveRecords.reduce(
      (sum, r) => sum + ((r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || r.laborDirectCost || 0)) || 0),
      0
    )
  );

  const totalMateriales = roundCurrency(
    effectiveRecords.reduce(
      (sum, r) => sum + (r.materialsCost || 0),
      0
    )
  );

  const totalServicio = roundCurrency(Math.max(0, totalFinalPasado - totalMateriales));

  // Generate a receipt number
  const receiptNumber = effectiveRecords.length === 1
    ? `PAS-${firstRecord.remitoId.replace(/[^a-zA-Z0-9]/g, '')}`
    : `RPC-${Date.now().toString().slice(-6)}`;

  const handleStartEditDesc = (r: TechnicalAuditRecord) => {
    setEditingId(r.id);
    setEditingText(r.description || '');
  };

  const handleSaveDesc = (id: string) => {
    updateTechnicalAuditRecord(id, { description: editingText.trim() });
    setEditingId(null);
  };

  const handleCancelEditDesc = () => {
    setEditingId(null);
  };

  const handleDownloadPDF = () => {
    // Archive receipt automatically
    addArchivedReceipt({
      receiptNumber,
      remitoIds: effectiveRecords.map(r => r.remitoId),
      clientName,
      date: firstRecord.date,
      totalAmount: totalFinalPasado,
      type: 'REMITO_PASADO',
      paymentMethods: [],
      notes: `Remito Pasado (${effectiveRecords.length} remitos): Subtotal Servicio $${formatCurrency(totalServicio)} + Materiales $${formatCurrency(totalMateriales)} = Total $${formatCurrency(totalFinalPasado)} + IVA`
    });

    if (effectiveRecords.length === 1) {
      generateRemitoPasadoPDF(effectiveRecords[0]);
    } else {
      generateRemitoPasadoConsolidadoPDF({
        receiptNumber,
        date: firstRecord.date,
        clientName,
        siteLocation,
        records: effectiveRecords,
        notes: ''
      });
    }
  };

  const handleExportExcel = () => {
    if (effectiveRecords.length === 1) {
      exportRemitoPasadoSingleToExcel(effectiveRecords[0]);
    } else {
      exportRemitoPasadoConsolidadoToExcel({
        records: effectiveRecords,
        clientName,
        receiptNumber,
        date: firstRecord.date
      });
    }
  };

  const handlePrint = () => {
    addArchivedReceipt({
      receiptNumber,
      remitoIds: effectiveRecords.map(r => r.remitoId),
      clientName,
      date: firstRecord.date,
      totalAmount: totalFinalPasado,
      type: 'REMITO_PASADO',
      paymentMethods: [],
      notes: `Remito Pasado (${effectiveRecords.length} remitos): Subtotal Servicio $${formatCurrency(totalServicio)} + Materiales $${formatCurrency(totalMateriales)} = Total $${formatCurrency(totalFinalPasado)} + IVA`
    });

    window.print();
  };

  const handleSaveAndClose = () => {
    addArchivedReceipt({
      receiptNumber,
      remitoIds: effectiveRecords.map(r => r.remitoId),
      clientName,
      date: firstRecord.date,
      totalAmount: totalFinalPasado,
      type: 'REMITO_PASADO',
      paymentMethods: [],
      notes: `Remito Pasado (${effectiveRecords.length} remitos): Subtotal Servicio $${formatCurrency(totalServicio)} + Materiales $${formatCurrency(totalMateriales)} = Total $${formatCurrency(totalFinalPasado)} + IVA`
    });

    if (onConfirmPasado) {
      onConfirmPasado();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[96vh] sm:max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
        
        {/* Header Bar */}
        <div className="p-3.5 sm:p-4 md:p-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-white shrink-0" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-100">
                COMPROBANTE OFICIAL
              </span>
              <h2 className="text-base sm:text-lg md:text-xl font-black italic tracking-tight leading-tight">
                RECIBO / REMITO PASADO {effectiveRecords.length > 1 && `(${effectiveRecords.length} REMITOS CONSOLIDADOS)`}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-700 hover:bg-emerald-600 text-white transition-all cursor-pointer shadow-xs"
              title="Exportar a Excel (.xlsx) (+IVA)"
            >
              <FileSpreadsheet className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span>EXCEL</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black bg-white text-slate-900 hover:bg-amber-100 transition-all cursor-pointer shadow-xs"
              title="Descargar archivo PDF"
            >
              <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-600" />
              <span className="hidden sm:inline">DESCARGAR PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
              title="Imprimir Comprobante"
            >
              <Printer className="w-4 h-4" />
              <span>IMPRIMIR</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body - Scrollable */}
        <div ref={printRef} className="p-4 sm:p-6 md:p-8 space-y-6 text-slate-800 dark:text-slate-100 print:p-0 print:text-black overflow-y-auto flex-1">
          
          {/* Company & Document Header */}
          <div className="border-b border-slate-200 dark:border-slate-700 pb-5 flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                JOB <span className="text-amber-500">Martin Bandiera</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ingeniería, Obras Eléctricas y Mantenimiento de Pozos Profundos
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                Mendoza - Valle de Uco · Tel: +54 9 2622 50-5195 · CUIT: 30-71720268-2
              </p>
            </div>

            <div className="sm:text-right bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-800/50">
              <div className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-400">
                COMPROBANTE: REMITO PASADO {effectiveRecords.length > 1 && 'CONSOLIDADO'}
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {receiptNumber}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cantidad de Remitos: <span className="font-bold text-amber-700 dark:text-amber-300">{effectiveRecords.length}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fecha de Emisión: <span className="font-bold">{dateStr}</span>
              </div>
            </div>
          </div>

          {/* Client & Service Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                CLIENTE / RAZÓN SOCIAL
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                {clientName}
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-semibold">Ubicación / Sede:</span> {siteLocation}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                RESPONSABLE TÉCNICO & CONDICIÓN
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {leadTech}
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-semibold">Condición Impositiva:</span> Consolidado con condición <strong>+ IVA</strong>
              </p>
            </div>
          </div>

          {/* Core Table: Renders every remito with its task description loaded in the field report */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">REMITO</th>
                  <th className="p-3">FECHA</th>
                  <th className="p-3 min-w-[280px]">DESCRIPCIÓN DE TAREAS</th>
                  <th className="p-3 text-right">TOTAL SERVICIO</th>
                  <th className="p-3 text-right bg-amber-50/70 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
                    MATERIALES (DIF.)
                  </th>
                  <th className="p-3 text-right font-black text-slate-900 dark:text-white">
                    TOTAL FINAL PASADO (+IVA)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {effectiveRecords.map((r, idx) => {
                  const totalRemito = roundCurrency(
                    (r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || r.laborDirectCost || 0)) || 0
                  );
                  const mat = roundCurrency(r.materialsCost || 0);
                  const serv = roundCurrency(Math.max(0, totalRemito - mat));
                  const totalRow = totalRemito;
                  const isEditingThis = editingId === r.id;

                  return (
                    <tr key={r.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Remito ID */}
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap align-top">
                        <div className="text-xs font-black">{r.remitoId}</div>
                        {r.remitoPapel && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono block">
                            Papel: {r.remitoPapel}
                          </span>
                        )}
                        {r.workPoint && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]" title={r.workPoint}>
                            {r.workPoint}
                          </span>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap align-top text-xs">
                        {r.date}
                      </td>

                      {/* Descripción de Tareas - Loaded from Field Report with quick edit option */}
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 align-top">
                        {isEditingThis ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              rows={3}
                              className="w-full p-2 text-xs rounded-lg border border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                              placeholder="Escribe la descripción de las tareas..."
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveDesc(r.id)}
                                className="px-2.5 py-1 text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Guardar
                              </button>
                              <button
                                onClick={handleCancelEditDesc}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-300 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative">
                            <div className="font-medium text-xs leading-relaxed text-slate-900 dark:text-slate-100">
                              {r.description || 'Mantenimiento técnico e inspección electromecánica.'}
                            </div>
                            {r.materialsDetails && (
                              <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 italic bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                                <strong>Detalle Suministros:</strong> {r.materialsDetails}
                              </div>
                            )}
                            <button
                              onClick={() => handleStartEditDesc(r)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                              title="Editar descripción de tareas de este remito"
                            >
                              <Edit3 className="w-3 h-3" />
                              Editar descripción de tareas
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Total Servicio */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap align-top text-xs">
                        ${formatCurrency(serv)}
                      </td>

                      {/* Materiales (Diferencia) */}
                      <td className="p-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/10 whitespace-nowrap align-top text-xs">
                        ${formatCurrency(mat)}
                      </td>

                      {/* Total Final Pasado */}
                      <td className="p-3.5 text-right font-mono whitespace-nowrap align-top">
                        <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                          ${formatCurrency(totalRow)}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                          + IVA
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Technical Note regarding Materials Column Difference and +IVA (Matching Image 1) */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <Package className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div>
                  <span className="font-black uppercase tracking-wide">CRITERIO ADMINISTRATIVO Y FISCAL (+IVA):</span> La columna de materiales se computa como diferencia complementaria en este remito pasado, sin alterar la base operativa fija de mano de obra.
                </div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Total Servicio: <span className="font-mono font-bold">${formatCurrency(totalServicio)}</span> +
                  Materiales: <span className="font-mono font-bold">${formatCurrency(totalMateriales)}</span> = Total Final Pasado: <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs sm:text-sm">${formatCurrency(totalFinalPasado)} + IVA</span>.
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 italic bg-amber-100/50 dark:bg-amber-900/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800/40">
                  <strong>Condición Fiscal (+IVA):</strong> El total final incluye la condición <strong>+ IVA</strong>: si el cliente requiere factura formal, a este total se le adiciona el IVA (21%).
                </div>
              </div>
            </div>
          </div>

          {/* Totals Summary Card */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Subtotal Mano de Obra / Servicios:</span>
                <span className="font-mono font-bold">${formatCurrency(totalServicio)}</span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>Materiales Computados (Diferencia):</span>
                <span className="font-mono font-bold">${formatCurrency(totalMateriales)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline font-black text-slate-900 dark:text-white">
                <span className="text-xs uppercase">TOTAL FINAL REMITO PASADO:</span>
                <div className="text-right">
                  <div className="text-base font-mono text-amber-600 dark:text-amber-400">
                    ${formatCurrency(totalFinalPasado)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">+ IVA</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic text-right">
                * Si el cliente requiere factura formal, se adiciona el IVA.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              title="Exportar archivo Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handleSaveAndClose}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar en Archivo & Confirmar</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
