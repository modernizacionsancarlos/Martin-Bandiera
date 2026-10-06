import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileCheck2,
  Calendar,
  Receipt,
  Building,
  CheckCircle2,
  AlertCircle,
  Percent,
  TrendingUp,
  DollarSign,
  Edit3
} from 'lucide-react';
import { TechnicalAuditRecord } from '../types';
import { formatCurrency, roundCurrency } from '../utils/calculationUtils';

export interface BillingDetailsPayload {
  montoBaseRemitos: number;
  recargo7Pct: number;
  subtotalNeto: number;
  ivaPct: 21 | 10.5;
  ivaAmount: number;
  totalFacturado: number;
}

interface PasarAFacturadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: TechnicalAuditRecord | null;
  records?: TechnicalAuditRecord[];
  availableRecords?: TechnicalAuditRecord[];
  onConfirm: (
    recordIds: string[],
    numeroFactura: string,
    fechaFactura: string,
    billingDetails?: BillingDetailsPayload
  ) => void;
}

export const PasarAFacturadoModal: React.FC<PasarAFacturadoModalProps> = ({
  isOpen,
  onClose,
  record,
  records,
  availableRecords,
  onConfirm
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [numeroFactura, setNumeroFactura] = useState<string>('');
  const [fechaFactura, setFechaFactura] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Facturación: base editable, 7% recargo, IVA 21 o 10.5, total editable
  const [editableBaseAmount, setEditableBaseAmount] = useState<number>(0);
  const [ivaRate, setIvaRate] = useState<21 | 10.5>(21);
  const [customTotalAmount, setCustomTotalAmount] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  const invoiceInputRef = React.useRef<HTMLInputElement>(null);

  // Safe fallback for availableRecords to avoid recreating array references on every render
  const safeAvailableRecords = useMemo(() => availableRecords || [], [availableRecords]);

  // Active records to process
  const effectiveRecords = useMemo(() => {
    if (records && records.length > 0) return records;
    if (record) return [record];
    if (selectedRecordId) {
      const found = safeAvailableRecords.find(r => r.id === selectedRecordId);
      return found ? [found] : [];
    }
    if (safeAvailableRecords.length > 0) return [safeAvailableRecords[0]];
    return [];
  }, [record, records, safeAvailableRecords, selectedRecordId]);

  const isMulti = effectiveRecords.length > 1;

  // Calculate default original sum from records
  const originalSum = useMemo(() => {
    return effectiveRecords.reduce((acc, r) => acc + (r.billedPrice || r.suggestedPrice || 0), 0);
  }, [effectiveRecords]);

  // Stable identifier of which records are selected to avoid re-running effect on every render
  const recordsKey = useMemo(() => {
    if (records && records.length > 0) return records.map(r => r.id).sort().join(',');
    if (record) return record.id;
    return selectedRecordId || (safeAvailableRecords[0]?.id || 'none');
  }, [record, records, selectedRecordId, safeAvailableRecords]);

  // Initialize ONLY when modal opens or when target record(s) change
  useEffect(() => {
    if (!isOpen) return;

    if (records && records.length > 0) {
      const existingInvoice = records.find(r => r.numeroFactura)?.numeroFactura || '';
      const existingDate = records.find(r => r.fechaFactura)?.fechaFactura || new Date().toISOString().split('T')[0];
      setNumeroFactura(existingInvoice);
      setFechaFactura(existingDate);
    } else if (record) {
      setSelectedRecordId(record.id);
      setNumeroFactura(record.numeroFactura || '');
      setFechaFactura(record.fechaFactura || new Date().toISOString().split('T')[0]);
    } else if (safeAvailableRecords.length > 0) {
      const active = safeAvailableRecords.find(r => r.id === selectedRecordId) || safeAvailableRecords[0];
      setSelectedRecordId(active.id);
      setNumeroFactura(active.numeroFactura || '');
      setFechaFactura(active.fechaFactura || new Date().toISOString().split('T')[0]);
    } else {
      setSelectedRecordId('');
      setNumeroFactura('');
      setFechaFactura(new Date().toISOString().split('T')[0]);
    }

    // Set base amount from records
    const sum = effectiveRecords.reduce((acc, r) => acc + (r.billedPrice || r.suggestedPrice || 0), 0);
    setEditableBaseAmount(sum);
    setCustomTotalAmount(null);
    setIvaRate(21);
    setError(null);
  }, [isOpen, recordsKey]);

  // Calculations for 7% and IVA
  const baseMonto = Math.max(0, editableBaseAmount || 0);
  const recargo7Amount = roundCurrency(baseMonto * 0.07);
  const subtotalNeto = roundCurrency(baseMonto + recargo7Amount);
  const ivaAmount = roundCurrency(subtotalNeto * (ivaRate / 100));
  const calculatedGrandTotal = roundCurrency(subtotalNeto + ivaAmount);

  const effectiveFinalTotal = customTotalAmount !== null ? customTotalAmount : calculatedGrandTotal;

  // Auto-focus and place cursor in invoice input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (invoiceInputRef.current) {
          invoiceInputRef.current.focus();
          const len = invoiceInputRef.current.value.length;
          invoiceInputRef.current.setSelectionRange(len, len);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Single active record for single mode preview
  const activeRecord = effectiveRecords.length === 1 ? effectiveRecords[0] : null;

  const distinctClients = useMemo(() => {
    return Array.from(new Set(effectiveRecords.map(r => r.clientName).filter(Boolean)));
  }, [effectiveRecords]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInvoiceNum = numeroFactura.trim();
    if (!cleanInvoiceNum) {
      setError('Por favor ingrese el número de factura.');
      return;
    }

    if (!fechaFactura) {
      setError('Por favor ingrese la fecha de facturación.');
      return;
    }

    const targetIds = effectiveRecords.map(r => r.id);
    if (targetIds.length === 0) {
      setError('Debe seleccionar al menos un remito para pasar al estado facturado.');
      return;
    }

    const billingPayload: BillingDetailsPayload = {
      montoBaseRemitos: baseMonto,
      recargo7Pct: recargo7Amount,
      subtotalNeto,
      ivaPct: ivaRate,
      ivaAmount,
      totalFacturado: effectiveFinalTotal
    };

    onConfirm(targetIds, cleanInvoiceNum, fechaFactura, billingPayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className={`bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-2xl sm:rounded-3xl w-full ${isMulti ? 'max-w-2xl' : 'max-w-xl'} shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95`}>
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-6 py-4 flex items-center justify-between text-white shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
              <FileCheck2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide">
                {isMulti
                  ? `PASAR ${effectiveRecords.length} REMITOS A FACTURADO`
                  : 'PASAR A ESTADO FACTURADO'}
              </h2>
              <p className="text-white/80 text-[11px] font-medium">
                Recargo del 7%, discriminación de IVA (21% / 10.5%) y montos a facturar editables
              </p>
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector de Remito si viene sin registros */}
          {!record && (!records || records.length === 0) && (
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Seleccionar Remito Operativo
              </label>
              {availableRecords?.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs">
                  No hay remitos pendientes para facturar.
                </div>
              ) : (
                <select
                  value={selectedRecordId}
                  onChange={e => setSelectedRecordId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {safeAvailableRecords.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.remitoId} {r.remitoPapel ? `(Papel: ${r.remitoPapel})` : ''} - {r.clientName} (${formatCurrency(r.billedPrice || r.suggestedPrice || 0)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Multi-records List Preview */}
          {isMulti && (
            <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="bg-blue-600 text-white font-black text-xs px-2.5 py-0.5 rounded-lg">
                  {effectiveRecords.length} REMITOS SELECCIONADOS
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-semibold text-xs">
                  {distinctClients.length === 1 ? (
                    <span>Cliente: <strong className="text-slate-900 dark:text-white">{distinctClients[0]}</strong></span>
                  ) : (
                    <span>{distinctClients.length} clientes incluidos</span>
                  )}
                </span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {effectiveRecords.map(r => (
                  <div
                    key={r.id}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-mono font-black text-blue-600 dark:text-blue-400 mr-2">
                        {r.remitoId}
                      </span>
                      {r.remitoPapel && (
                        <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-mono font-bold text-[10px] px-1.5 py-0.2 rounded mr-2">
                          Papel: {r.remitoPapel}
                        </span>
                      )}
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{r.clientName}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-2">
                      ${formatCurrency(r.billedPrice || r.suggestedPrice || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single Record Preview Card */}
          {!isMulti && activeRecord && (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-sm text-blue-900 dark:text-blue-300">
                  {activeRecord.remitoId}
                </span>
                {activeRecord.remitoPapel && (
                  <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-mono font-bold text-[10px] px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700">
                    Papel: #{activeRecord.remitoPapel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{activeRecord.clientName}</span>
                {activeRecord.siteLocation && (
                  <span className="text-slate-400 font-normal">· {activeRecord.siteLocation}</span>
                )}
              </div>
            </div>
          )}

          {/* CÁLCULO DE FACTURACIÓN: MONTO BASE EDITABLE + 7% + IVA (21% / 10.5%) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30 border-2 border-blue-200 dark:border-blue-800/80 space-y-3.5 shadow-sm">
            
            <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-2">
              <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200 font-black text-xs uppercase tracking-wide">
                <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Liquidación Fiscal de Facturación</span>
              </div>
              <span className="text-[10.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                +7% Recargo Base + IVA
              </span>
            </div>

            {/* 1. Monto Suma de Remitos (Editable para recargos manuales por plazo de pago) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="base-amount-input" className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Suma de Remitos (Monto Base) *</span>
                </label>
                {editableBaseAmount !== originalSum && (
                  <button
                    type="button"
                    onClick={() => setEditableBaseAmount(originalSum)}
                    className="text-[10.5px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                    title="Restablecer suma original de remitos"
                  >
                    ↺ Restablecer original (${formatCurrency(originalSum)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400 text-sm">$</span>
                <input
                  id="base-amount-input"
                  type="number"
                  step="any"
                  min="0"
                  value={editableBaseAmount}
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                    setEditableBaseAmount(val);
                    setCustomTotalAmount(null); // Recalculate automatic total
                  }}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                💡 <em>Si se estira el plazo de pago, ingresa el recargo manual directamente en este monto. Se sumará al total pero <strong>no figurará discriminado</strong> en la factura.</em>
              </p>
            </div>

            {/* 2. Recargo del 7% y Subtotal Neto */}
            <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                  + Recargo 7%
                </span>
                <span className="font-mono font-black text-blue-700 dark:text-blue-300 text-sm">
                  ${formatCurrency(recargo7Amount)}
                </span>
                <span className="text-[9.5px] text-slate-400 block mt-0.5">
                  ({baseMonto > 0 ? '$' + formatCurrency(baseMonto) : '$0'} × 7%)
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                  Subtotal Neto Facturable
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                  ${formatCurrency(subtotalNeto)}
                </span>
                <span className="text-[9.5px] text-slate-400 block mt-0.5">
                  Base + 7%
                </span>
              </div>
            </div>

            {/* 3. Selector de IVA: 21% vs 10.5% */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  Alícuota de IVA a discriminar *
                </span>
                <span className="text-[10.5px] font-mono font-black text-blue-700 dark:text-blue-300">
                  IVA discriminado: ${formatCurrency(ivaAmount)}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIvaRate(21);
                    setCustomTotalAmount(null);
                  }}
                  className={`p-2.5 rounded-xl border-2 text-left font-bold transition-all cursor-pointer flex items-center justify-between ${
                    ivaRate === 21
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${ivaRate === 21 ? 'border-blue-600' : 'border-slate-400'}`}>
                        {ivaRate === 21 && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                      </span>
                      <span>IVA 21%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block pl-5 font-normal">
                      Tasa general estándar
                    </span>
                  </div>
                  <span className="font-mono text-xs font-black">
                    ${formatCurrency(roundCurrency(subtotalNeto * 0.21))}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIvaRate(10.5);
                    setCustomTotalAmount(null);
                  }}
                  className={`p-2.5 rounded-xl border-2 text-left font-bold transition-all cursor-pointer flex items-center justify-between ${
                    ivaRate === 10.5
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${ivaRate === 10.5 ? 'border-blue-600' : 'border-slate-400'}`}>
                        {ivaRate === 10.5 && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                      </span>
                      <span>IVA 10.5%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block pl-5 font-normal">
                      Tasa reducida / bienes de capital
                    </span>
                  </div>
                  <span className="font-mono text-xs font-black">
                    ${formatCurrency(roundCurrency(subtotalNeto * 0.105))}
                  </span>
                </button>
              </div>
            </div>

            {/* 4. TOTAL A FACTURAR (Editable) */}
            <div className="pt-2 border-t border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-blue-600/10 dark:bg-blue-900/30 p-3 rounded-xl">
              <div>
                <span className="text-[10.5px] uppercase font-black text-blue-900 dark:text-blue-200 block">
                  TOTAL FINAL A FACTURAR (CON IVA)
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Subtotal Neto (${formatCurrency(subtotalNeto)}) + IVA {ivaRate}% (${formatCurrency(ivaAmount)})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-lg text-blue-700 dark:text-blue-300">$</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={effectiveFinalTotal}
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                    setCustomTotalAmount(val);
                  }}
                  className="w-36 px-2.5 py-1.5 rounded-lg border-2 border-blue-500 bg-white dark:bg-slate-900 font-mono font-black text-base text-blue-700 dark:text-blue-300 text-right focus:outline-none focus:ring-2 focus:ring-blue-600"
                  title="Puedes ajustar o redondear el total final de la factura directamente aquí"
                />
              </div>
            </div>

          </div>

          {/* Campo Número de Factura */}
          <div>
            <label htmlFor="invoice-number-input" className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Número de Factura *
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ej: A0001-00004523</span>
            </label>
            <div className="relative">
              <input
                ref={invoiceInputRef}
                id="invoice-number-input"
                name="numeroFactura"
                type="text"
                placeholder="Ej: A0001-00004523 ó 4523"
                value={numeroFactura}
                onChange={e => setNumeroFactura(e.target.value.toUpperCase())}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                required
                className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-sm shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400/80 dark:placeholder:text-slate-500"
              />
              {numeroFactura && (
                <button
                  type="button"
                  onClick={() => {
                    setNumeroFactura('');
                    invoiceInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Borrar texto del número de factura"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Accesos rápidos de prefijos */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10.5px] text-slate-400 font-medium">Prefijos rápidos:</span>
              {['A0001-', 'B0001-', 'FAC-A-'].map(prefix => (
                <button
                  key={prefix}
                  type="button"
                  onClick={() => {
                    setNumeroFactura(prev => prev.startsWith(prefix) ? prev : `${prefix}${prev}`);
                    invoiceInputRef.current?.focus();
                  }}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                  title={`Insertar prefijo ${prefix}`}
                >
                  +{prefix}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Fecha de Facturación */}
          <div>
            <label htmlFor="invoice-date-input" className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Fecha de Factura *
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                Inicio cómputo días
              </span>
            </label>
            <div className="relative">
              <input
                id="invoice-date-input"
                name="fechaFactura"
                type="date"
                value={fechaFactura}
                onChange={e => setFechaFactura(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-105 active:scale-95 text-white font-black uppercase tracking-wider text-xs shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isMulti ? `CONFIRMAR FACTURACIÓN (${effectiveRecords.length})` : 'CONFIRMAR FACTURACIÓN'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
