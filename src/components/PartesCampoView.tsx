import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, FileCheck2, Ban, Clock, ArrowRight, Users, Package, PenLine, MessageCircle, HardDrive, Smartphone, AlertTriangle, X } from 'lucide-react';
import { getCurrentIdToken } from '../services/authService';
import { useData } from '../context/DataContext';
import { FieldReport, FieldReportStatus, TechnicalAuditRecord, TeamMemberAssigned } from '../types';
import { FieldReportModal } from './FieldReportModal';

type Filter = FieldReportStatus | 'Todos';

const FILTERS: Filter[] = ['Pendiente', 'Convertido', 'Descartado', 'Todos'];

const STATUS_CLS: Record<FieldReportStatus, string> = {
  Pendiente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  Convertido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Descartado: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
};

const fmtDate = (d: string) => d.split('-').reverse().join('/');

const ORIGIN: Record<NonNullable<FieldReport['origen']>, { label: string; icon: React.ReactElement }> = {
  app: { label: 'App del capataz', icon: <Smartphone className="w-3 h-3" /> },
  whatsapp: { label: 'WhatsApp', icon: <MessageCircle className="w-3 h-3" /> },
  drive: { label: 'Google Drive', icon: <HardDrive className="w-3 h-3" /> }
};

/** Foto original del remito de papel. En la demo viene embebida; en producción se pide al servidor (solo administración). */
const ReportPhoto: React.FC<{ report: FieldReport }> = ({ report }) => {
  const [src, setSrc] = useState<string | null>(report.imageUrl ?? null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (report.imageUrl || !report.imagePath) return;
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const token = await getCurrentIdToken();
      if (!token) return;
      const res = await fetch(`/api/admin/field-reports/${encodeURIComponent(report.id)}/image`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      url = URL.createObjectURL(await res.blob());
      setSrc(url);
    })().catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [report.id, report.imageUrl, report.imagePath]);

  if (!src) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 cursor-pointer" aria-label="Ver la foto del remito de papel">
        <img src={src} alt="Foto del remito de papel" className="w-20 h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Foto del remito">
          <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
          <img src={src} alt="Foto del remito de papel, ampliada" className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      )}
    </>
  );
};

/**
 * Bandeja de partes de campo cargados por los capataces (sin valores).
 * Administración y Gerencia revisan cada parte y lo convierten en un remito:
 * ahí se calculan costos y precios con las tarifas vigentes.
 */
export const PartesCampoView: React.FC = () => {
  const { fieldReports, technicalParameters, markFieldReportConverted, discardFieldReport } = useData();
  const [filter, setFilter] = useState<Filter>('Pendiente');
  const [converting, setConverting] = useState<FieldReport | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const counts = useMemo(
    () => ({
      Pendiente: fieldReports.filter(r => r.status === 'Pendiente').length,
      Convertido: fieldReports.filter(r => r.status === 'Convertido').length,
      Descartado: fieldReports.filter(r => r.status === 'Descartado').length,
      Todos: fieldReports.length
    }),
    [fieldReports]
  );

  const visible = fieldReports.filter(r => filter === 'Todos' || r.status === filter);

  // Datos del parte convertidos al formato del remito. Las tarifas se completan acá, del lado de administración.
  const prefill = useMemo<Partial<TechnicalAuditRecord> | null>(() => {
    if (!converting) return null;
    const teamMembers: TeamMemberAssigned[] = converting.crew.map(c => ({
      name: c.name,
      role: c.role,
      rate: c.role === 'Oficial' ? technicalParameters.horaOficial || 9400 : technicalParameters.pagoAyudanteHora || 5500
    }));
    return {
      date: converting.date,
      clientName: converting.clientName,
      siteLocation: converting.siteLocation,
      workPoint: converting.workPoint,
      isGuardia: converting.isGuardia,
      horaEntrada: converting.horaEntrada,
      horaSalida: converting.horaSalida,
      viajes: converting.viajes,
      leadTech: converting.submittedByName,
      helpers: converting.crew.map(c => c.name),
      teamMembers,
      materialsDetails: converting.materials.map(m => `${m.qty}x ${m.name}`).join(', ') || undefined,
      materialsCost: 0,
      remitoPapel: converting.remitoPapel,
      description: converting.description,
      signatureUrl: converting.signatureUrl
    };
  }, [converting, technicalParameters]);

  const confirmDiscard = (id: string) => {
    discardFieldReport(id, reason.trim());
    setDiscarding(null);
    setReason('');
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Inbox className="w-6 h-6 text-cyan-600" /> Partes de Campo
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Lo que cargan los capataces en la finca, sin valores. Revisá cada parte y convertilo en remito para continuar el proceso.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTERS.map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border cursor-pointer transition-colors ${
              filter === f
                ? 'bg-cyan-600 text-white border-cyan-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-500'
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
          {filter === 'Pendiente' ? 'No hay partes pendientes de revisión.' : 'No hay partes en esta lista.'}
        </div>
      )}

      <div className="space-y-3">
        {visible.map(r => (
          <article key={r.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-black text-base text-slate-900 dark:text-white">{r.clientName}</p>
                <p className="text-xs text-slate-500">
                  {[r.siteLocation, r.workPoint].filter(Boolean).join(' · ')} · {fmtDate(r.date)} · {r.horaEntrada}–{r.horaSalida}
                  {r.isGuardia ? ' · GUARDIA' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>Cargó <strong className="text-slate-700 dark:text-slate-200">{r.submittedByName}</strong> · {r.id}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    {ORIGIN[r.origen ?? 'app'].icon} {ORIGIN[r.origen ?? 'app'].label}
                  </span>
                  {r.confianza !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full font-bold ${r.confianza < 80 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>
                      Lectura {r.confianza}%
                    </span>
                  )}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black ${STATUS_CLS[r.status]}`}>
                {r.status === 'Pendiente' ? <Clock className="w-3.5 h-3.5" /> : r.status === 'Convertido' ? <FileCheck2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                {r.status}
                {r.status === 'Convertido' && r.remitoId ? ` · ${r.remitoId}` : ''}
              </span>
            </div>

            <div className="mt-3 flex gap-3">
              <ReportPhoto report={r} />
              <p className="text-sm text-slate-700 dark:text-slate-200 min-w-0">{r.description}</p>
            </div>

            {r.revisar && r.revisar.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Revisar antes de convertir
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                  {r.revisar.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-600" />
                {r.crew.length ? r.crew.map(c => `${c.name} (${c.role})`).join(', ') : 'Sin personal adicional'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-cyan-600" />
                {r.materials.length ? r.materials.map(m => `${m.qty}× ${m.name}`).join(', ') : 'Sin materiales'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5 text-cyan-600" />
                {r.signatureUrl ? 'Con firma de conformidad' : 'Sin firma'}
              </span>
            </div>

            {r.status === 'Descartado' && r.discardReason && (
              <p className="text-xs text-rose-600 mt-2">Motivo: {r.discardReason}</p>
            )}

            {r.status === 'Pendiente' && (
              <div className="mt-4">
                {discardingBlock(r.id)}
              </div>
            )}
          </article>
        ))}
      </div>

      <FieldReportModal
        isOpen={Boolean(converting)}
        onClose={() => setConverting(null)}
        prefill={prefill}
        onSaved={remitoId => {
          if (converting) markFieldReportConverted(converting.id, remitoId);
        }}
      />
    </div>
  );

  function discardingBlock(id: string): React.ReactElement {
    if (discarding === id) {
      return (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
          <button onClick={() => confirmDiscard(id)} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black uppercase cursor-pointer">
            Confirmar descarte
          </button>
          <button onClick={() => setDiscarding(null)} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black uppercase cursor-pointer">
            Cancelar
          </button>
        </div>
      );
    }
    const report = fieldReports.find(x => x.id === id)!;
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setConverting(report)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
        >
          Convertir en remito <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setDiscarding(id)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-wider cursor-pointer hover:border-rose-500"
        >
          Descartar
        </button>
      </div>
    );
  }
};
