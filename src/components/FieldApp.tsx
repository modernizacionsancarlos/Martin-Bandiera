import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Plus, LogOut, X, Clock, Trash2, Eraser, FileCheck2, Ban, CloudOff, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSyncStatus } from '../services/syncStatus';
import { exportSignature } from '../utils/signatureImage';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { FieldReport, FieldReportCrewMember, FieldReportMaterial } from '../types';

/**
 * Aplicación de campo del capataz. Carga partes de trabajo SIN valores: no muestra tarifas,
 * costos ni precios, y su sesión no se suscribe a remitos, finanzas ni tarifas (ver DataContext).
 */

const today = () => new Date().toISOString().split('T')[0];

const STATUS_STYLE: Record<FieldReport['status'], { label: string; cls: string; icon: React.ReactElement }> = {
  Pendiente: { label: 'Enviado · en revisión', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', icon: <Clock className="w-3.5 h-3.5" /> },
  Convertido: { label: 'Procesado por administración', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
  Descartado: { label: 'Descartado', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', icon: <Ban className="w-3.5 h-3.5" /> }
};

const inputCls =
  'w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const labelCls = 'block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

const PartForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { fieldCatalog, addFieldReport } = useData();
  const clients = fieldCatalog?.clients ?? [];
  const workers = fieldCatalog?.workers ?? [];
  const materials = fieldCatalog?.materials ?? [];
  const { currentUser } = useAuth();

  const [date, setDate] = useState(today());
  const [clientName, setClientName] = useState(clients[0]?.razonSocial || '');
  const [siteLocation, setSiteLocation] = useState(clients[0]?.fincaLocacion || '');
  const [workPoint, setWorkPoint] = useState('');
  const [isGuardia, setIsGuardia] = useState(false);
  const [horaEntrada, setHoraEntrada] = useState('08:00');
  const [horaSalida, setHoraSalida] = useState('13:30');
  const [viajes, setViajes] = useState(1);
  const [crew, setCrew] = useState<FieldReportCrewMember[]>([]);
  const [crewPick, setCrewPick] = useState('');
  const [items, setItems] = useState<FieldReportMaterial[]>([]);
  const [materialPick, setMaterialPick] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const fieldStaff = useMemo(
    () =>
      workers
        .filter(w => w.name !== currentUser?.displayName)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [workers, currentUser]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';
    }
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };
  const endDraw = () => {
    drawing.current = false;
  };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const pickClient = (name: string) => {
    setClientName(name);
    const client = clients.find(c => c.razonSocial === name);
    setSiteLocation(client?.fincaLocacion || '');
  };

  const addCrew = (role: FieldReportCrewMember['role']) => {
    if (!crewPick || crew.some(c => c.name === crewPick)) return;
    setCrew(prev => [...prev, { name: crewPick, role }]);
    setCrewPick('');
  };

  const addMaterial = () => {
    if (!materialPick || materialQty <= 0) return;
    setItems(prev => {
      const existing = prev.find(m => m.name === materialPick);
      return existing
        ? prev.map(m => (m.name === materialPick ? { ...m, qty: m.qty + materialQty } : m))
        : [...prev, { name: materialPick, qty: materialQty }];
    });
    setMaterialPick('');
    setMaterialQty(1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return setError('Elegí el cliente.');
    if (!description.trim()) return setError('Contá brevemente qué se hizo.');
    if (!horaEntrada || !horaSalida) return setError('Completá hora de entrada y salida.');
    addFieldReport({
      date,
      clientName,
      siteLocation,
      workPoint: workPoint.trim(),
      isGuardia,
      horaEntrada,
      horaSalida,
      viajes,
      crew,
      materials: items,
      description: description.trim(),
      signatureUrl: hasSignature && canvasRef.current ? exportSignature(canvasRef.current) : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/70 flex items-end sm:items-center justify-center">
      <form
        onSubmit={submit}
        className="bg-slate-50 dark:bg-slate-900 w-full sm:max-w-xl max-h-[96vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Nuevo parte de trabajo</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
          </div>
          <label className="flex items-end gap-2 pb-3 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" checked={isGuardia} onChange={e => setIsGuardia(e.target.checked)} className="w-5 h-5" />
            Trabajo de guardia
          </label>
        </div>

        <div>
          <label className={labelCls}>Cliente</label>
          <select value={clientName} onChange={e => pickClient(e.target.value)} className={inputCls}>
            {clients.map(c => (
              <option key={c.id} value={c.razonSocial}>{c.razonSocial}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Finca / lugar</label>
            <input value={siteLocation} onChange={e => setSiteLocation(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Punto de trabajo</label>
            <input value={workPoint} onChange={e => setWorkPoint(e.target.value)} placeholder="Ej: Pozo N° 2" className={inputCls} required />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Entrada</label>
            <input type="time" value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Salida</label>
            <input type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Viajes</label>
            <input type="number" min={0} max={10} value={viajes} onChange={e => setViajes(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Personal que trabajó con vos</label>
          <div className="flex gap-2">
            <select value={crewPick} onChange={e => setCrewPick(e.target.value)} className={inputCls}>
              <option value="">Elegir persona…</option>
              {fieldStaff.map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => addCrew('Oficial')} disabled={!crewPick} className="flex-1 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-black disabled:opacity-40 cursor-pointer">
              + Como oficial
            </button>
            <button type="button" onClick={() => addCrew('Ayudante')} disabled={!crewPick} className="flex-1 py-2.5 rounded-xl bg-slate-700 text-white text-sm font-black disabled:opacity-40 cursor-pointer">
              + Como ayudante
            </button>
          </div>
          {crew.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {crew.map(c => (
                <li key={c.name} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
                  <span className="font-semibold">{c.name} <span className="text-xs text-slate-500">· {c.role}</span></span>
                  <button type="button" onClick={() => setCrew(prev => prev.filter(x => x.name !== c.name))} className="p-1.5 text-rose-500 cursor-pointer" aria-label={`Quitar ${c.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className={labelCls}>Materiales usados</label>
          <div className="flex gap-2">
            <select value={materialPick} onChange={e => setMaterialPick(e.target.value)} className={inputCls}>
              <option value="">Elegir material…</option>
              {materials.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <input type="number" min={1} value={materialQty} onChange={e => setMaterialQty(Math.max(1, Number(e.target.value) || 1))} className={inputCls + ' !w-24'} aria-label="Cantidad" />
          </div>
          <button type="button" onClick={addMaterial} disabled={!materialPick} className="mt-2 w-full py-2.5 rounded-xl bg-slate-700 text-white text-sm font-black disabled:opacity-40 cursor-pointer">
            + Agregar material
          </button>
          {items.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {items.map(m => (
                <li key={m.name} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
                  <span className="font-semibold">{m.qty} × {m.name}</span>
                  <button type="button" onClick={() => setItems(prev => prev.filter(x => x.name !== m.name))} className="p-1.5 text-rose-500 cursor-pointer" aria-label={`Quitar ${m.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className={labelCls}>Qué se hizo</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className={inputCls} placeholder="Describí el trabajo realizado" required />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Firma de conformidad</label>
            <button type="button" onClick={clearSignature} className="text-xs font-bold text-slate-500 flex items-center gap-1 cursor-pointer">
              <Eraser className="w-3.5 h-3.5" /> Borrar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full h-36 rounded-xl bg-white border-2 border-dashed border-slate-300 touch-none"
          />
        </div>

        {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}

        <button type="submit" className="w-full py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-base font-black uppercase tracking-wider cursor-pointer">
          Enviar parte a administración
        </button>
      </form>
    </div>
  );
};

/** Evento del navegador que permite ofrecer "Instalar la app" (Chrome y Edge en Android y escritorio). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const install = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  };
  return { canInstall: event !== null, install };
}

/** Avisa cuando se instaló una versión nueva de la app (el teléfono sigue con la vieja hasta recargar). */
function useAppUpdate() {
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    const onChange = () => setUpdated(true);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange);
  }, []);
  return updated;
}

export const FieldApp: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { fieldReports, unsyncedFieldReportIds, outboxEntries, retryFieldReport } = useData();
  // Todo parte que sigue en la bandeja de salida todavía no fue confirmado por el servidor.
  const inOutbox = useMemo(() => new Set(outboxEntries.map(e => e.report.id)), [outboxEntries]);
  const appUpdated = useAppUpdate();
  const { online, pending } = useSyncStatus();
  const { canInstall, install } = useInstallPrompt();
  const [showForm, setShowForm] = useState(false);

  // Partes del servidor (o del caché del teléfono) más los que solo existen en la bandeja de salida
  // (por ejemplo, uno que el servidor rechazó y Firestore descartó): el capataz nunca los pierde de vista.
  const rows = useMemo(() => {
    const failedBy = new Map(outboxEntries.map(e => [e.report.id, e.failed]));
    const own = fieldReports
      .filter(r => r.submittedByAuthUid === currentUser?.authUid)
      .map(report => ({ report, failed: failedBy.get(report.id) }));
    const known = new Set(own.map(r => r.report.id));
    const orphans = outboxEntries.filter(e => !known.has(e.report.id)).map(e => ({ report: e.report, failed: e.failed }));
    return [...own, ...orphans].sort((a, b) => (b.report.submittedAt || '').localeCompare(a.report.submittedAt || ''));
  }, [fieldReports, outboxEntries, currentUser]);

  const handleLogout = () => {
    const unsent = outboxEntries.length;
    if ((unsent > 0 || pending > 0) && !window.confirm(`Tenés ${unsent || pending} parte(s) sin enviar. Si cerrás sesión sin señal podrías perderlos. ¿Cerrar sesión igual?`)) return;
    logout();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <header className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-cyan-400 font-black">Partes de campo</p>
          <p className="text-base font-black leading-tight">{currentUser?.displayName}</p>
        </div>
        <div className="flex items-center gap-2">
          {canInstall && (
            <button onClick={install} className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer">
              <Download className="w-4 h-4" /> Instalar app
            </button>
          )}
          <button onClick={handleLogout} className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/30 cursor-pointer" aria-label="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {appUpdated && (
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-cyan-600 text-white px-4 py-2 text-xs font-black flex items-center gap-2 justify-center cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 shrink-0" /> Hay una versión nueva de la app. Tocá acá para actualizar.
        </button>
      )}

      {(!online || pending > 0) && (
        <div role="status" className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center gap-2 justify-center">
          <CloudOff className="w-4 h-4 shrink-0" />
          {!online
            ? `Sin señal: seguí cargando, los partes se envían solos cuando vuelva la conexión${pending ? ` (${pending} por enviar)` : ''}.`
            : `Enviando ${pending} cambio${pending === 1 ? '' : 's'}…`}
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 py-5 pb-28 space-y-4">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-500">
          <ClipboardList className="w-4 h-4" /> Mis partes ({rows.length})
        </div>

        {rows.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">
            Todavía no cargaste partes. Tocá "Nuevo parte" para empezar.
          </p>
        )}

        {rows.map(({ report: r, failed }) => {
          const st = STATUS_STYLE[r.status];
          return (
            <article key={r.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-base">{r.clientName}</p>
                  <p className="text-xs text-slate-500">{[r.siteLocation, r.workPoint].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-xs font-mono text-slate-500 shrink-0">{r.date.split('-').reverse().join('/')}</span>
              </div>
              <p className="text-sm mt-2 text-slate-600 dark:text-slate-300 line-clamp-2">{r.description}</p>
              {failed ? (
                <div className="mt-3 space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> No se pudo enviar
                  </div>
                  <p className="text-xs text-rose-600 dark:text-rose-300">{failed}</p>
                  <p className="text-xs text-slate-500">El parte está guardado en este teléfono: no se perdió. Si el problema es la sesión, cerrá sesión, volvé a ingresar y reintentá.</p>
                  <button onClick={() => retryFieldReport(r.id)} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /> Reintentar envío
                  </button>
                </div>
              ) : unsyncedFieldReportIds.has(r.id) || inOutbox.has(r.id) ? (
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30">
                  <CloudOff className="w-3.5 h-3.5" /> Sin enviar · se envía cuando haya señal
                </div>
              ) : (
                <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black ${st.cls}`}>
                  {st.icon} {st.label}
                </div>
              )}
              {r.status === 'Descartado' && r.discardReason && (
                <p className="text-xs text-rose-600 mt-2">Motivo: {r.discardReason}</p>
              )}
            </article>
          );
        })}
      </main>

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 px-7 py-4 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wider shadow-2xl inline-flex items-center gap-2 cursor-pointer"
      >
        <Plus className="w-5 h-5" /> Nuevo parte
      </button>

      {showForm && <PartForm onClose={() => setShowForm(false)} />}
    </div>
  );
};
