import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Send, Eraser, Users, Clock, Package, MapPin, FileText } from 'lucide-react';
import { FieldDirectory, FieldReportPayload } from '../services/fieldReports';
import { todayLocalISO } from '../utils/dateUtils';

interface Props {
  directory: FieldDirectory;
  defaultLeadTech: string;
  // Editing an existing remito: the form starts from its data.
  initial?: FieldReportPayload;
  onSubmit: (payload: FieldReportPayload) => Promise<void>;
  onCancel: () => void;
}

interface Jornada {
  key: string;
  entrada: string;
  salida: string;
  viajes: number;
}

const SIN_CAPATAZ = 'Sin capataz';

const hoursBetween = (entrada: string, salida: string): number => {
  const [hIn, mIn] = entrada.split(':').map(Number);
  const [hOut, mOut] = salida.split(':').map(Number);
  if ([hIn, mIn, hOut, mOut].some(n => isNaN(n))) return 0;
  const start = hIn * 60 + mIn;
  const end = hOut * 60 + mOut;
  const diff = end >= start ? end - start : 24 * 60 - start + end;
  return Math.round((diff / 60) * 10) / 10;
};

const inputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5';

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
      <span className="text-cyan-600 dark:text-cyan-400">{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

// Remito form for field staff. Collects only operational data: no rates, prices or totals.
export const FieldRemitoForm: React.FC<Props> = ({ directory, defaultLeadTech, initial, onSubmit, onCancel }) => {
  const isEdit = !!initial;
  const [date, setDate] = useState(initial?.date || todayLocalISO());
  const [remitoPapel, setRemitoPapel] = useState(initial?.remitoPapel || '');
  const [clientQuery, setClientQuery] = useState(initial?.clientName || '');
  const [clientName, setClientName] = useState(initial?.clientName || '');
  const [siteLocation, setSiteLocation] = useState(initial?.siteLocation || '');
  const [distanceKm, setDistanceKm] = useState<number>(Number(initial?.distanceKm) || 0);
  const [workPoint, setWorkPoint] = useState(initial?.workPoint || '');
  const [isGuardia, setIsGuardia] = useState(!!initial?.isGuardia);
  const [leadTech, setLeadTech] = useState(initial ? initial.leadTech || SIN_CAPATAZ : defaultLeadTech || SIN_CAPATAZ);
  const [team, setTeam] = useState<{ name: string; role: 'Oficial' | 'Ayudante' }[]>(initial?.teamMembers || []);
  const [teamPick, setTeamPick] = useState('');
  const [jornadas, setJornadas] = useState<Jornada[]>(() =>
    initial?.jornadas?.length
      ? initial.jornadas.map((j, i) => ({ key: String(i + 1), entrada: j.entrada, salida: j.salida, viajes: Number(j.viajes) || 0 }))
      : initial
        ? [{ key: '1', entrada: initial.horaEntrada || '08:00', salida: initial.horaSalida || '13:30', viajes: Number(initial.viajes) || 0 }]
        : [{ key: '1', entrada: '08:00', salida: '13:30', viajes: 1 }]
  );
  const [materials, setMaterials] = useState<{ name: string; qty: number }[]>(initial?.fieldMaterials || []);
  const [materialPick, setMaterialPick] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [description, setDescription] = useState(initial?.description || '');
  const [hasSignature, setHasSignature] = useState(false);
  // Signature already on the remito being edited: kept unless it is cleared or redrawn.
  const [keptSignature, setKeptSignature] = useState(!!initial?.signatureUrl);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const url = initial?.signatureUrl;
    const canvas = canvasRef.current;
    if (!url || !canvas) return;
    const img = new Image();
    img.onload = () => canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = url;
  }, [initial?.signatureUrl]);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q || q === clientName.toLowerCase()) return [];
    return directory.clients
      .filter(c => `${c.razonSocial} ${c.fincaLocacion || ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientQuery, clientName, directory.clients]);

  const leadOptions = useMemo(() => {
    const names = new Set<string>();
    directory.capataces.forEach(c => c.name && names.add(c.name));
    directory.workers.filter(w => /capataz/i.test(`${w.role} ${w.cargo}`)).forEach(w => names.add(w.name));
    if (defaultLeadTech) names.add(defaultLeadTech);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [directory, defaultLeadTech]);

  const availableWorkers = directory.workers.filter(w => w.name !== leadTech && !team.some(t => t.name === w.name));
  const totalHours = jornadas.reduce((acc, j) => acc + hoursBetween(j.entrada, j.salida), 0);
  const totalViajes = jornadas.reduce((acc, j) => acc + (Number(j.viajes) || 0), 0);

  const pickClient = (c: FieldDirectory['clients'][number]) => {
    setClientName(c.razonSocial);
    setClientQuery(c.razonSocial);
    setSiteLocation(c.fincaLocacion || c.direccionFiscal || '');
    setDistanceKm(Number(c.distanciaKm) || 0);
  };

  const addTeamMember = () => {
    const w = directory.workers.find(x => x.name === teamPick);
    if (!w) return;
    const role = /oficial/i.test(`${w.category} ${w.cargo}`) ? 'Oficial' : 'Ayudante';
    setTeam(prev => [...prev, { name: w.name, role }]);
    setTeamPick('');
  };

  const addMaterial = () => {
    if (!materialPick || materialQty <= 0) return;
    setMaterials(prev => {
      const existing = prev.find(m => m.name === materialPick);
      return existing
        ? prev.map(m => (m.name === materialPick ? { ...m, qty: m.qty + materialQty } : m))
        : [...prev, { name: materialPick, qty: materialQty }];
    });
    setMaterialPick('');
    setMaterialQty(1);
  };

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * canvas.width) / rect.width, y: ((e.clientY - rect.top) * canvas.height) / rect.height };
  };
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasSignature(true);
  };
  const endDraw = () => {
    drawing.current = false;
  };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setKeptSignature(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return setError('Elija el cliente o finca.');
    if (leadTech === SIN_CAPATAZ && team.length === 0) {
      return setError('Sin capataz, agregue al menos una persona al equipo.');
    }
    if (totalHours <= 0) return setError('Revise los horarios de entrada y salida.');
    setError(null);
    setSending(true);
    const first = jornadas[0];
    const payload: FieldReportPayload = {
      remitoPapel: remitoPapel.trim() || undefined,
      date,
      clientName: clientName.trim(),
      siteLocation: siteLocation.trim() || 'MENDOZA',
      workPoint: workPoint.trim() || 'SERVICIO GENERAL EN PLANTA',
      isGuardia,
      guardiaType: isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
      hoursWorked: totalHours,
      travelHours: totalViajes * 1.5,
      viajes: totalViajes,
      distanceKm,
      horaEntrada: first.entrada,
      horaSalida: first.salida,
      jornadas: jornadas.map(({ entrada, salida, viajes }) => ({ entrada, salida, viajes: Number(viajes) || 0 })),
      fieldMaterials: materials,
      materialsDetails: materials.map(m => `${m.qty}x ${m.name}`).join(', ') || undefined,
      description: description.trim() || 'Mantenimiento técnico e inspección electromecánica.',
      leadTech: leadTech === SIN_CAPATAZ ? '' : leadTech,
      helpers: team.map(t => t.name),
      teamMembers: team,
      signatureUrl: hasSignature && canvasRef.current
        ? canvasRef.current.toDataURL('image/png')
        : keptSignature
          ? initial?.signatureUrl
          : isEdit && initial?.signatureUrl
            ? ''
            : undefined
    };
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error && /permission|42501/i.test(err.message)
        ? 'Su usuario no tiene permiso para cargar remitos.'
        : isEdit ? 'No se pudieron guardar los cambios. Intente de nuevo.' : 'No se pudo enviar el remito. Intente de nuevo.');
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pb-28">
      <Section icon={<FileText className="w-4 h-4" />} title="Remito">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="fr-date">Fecha</label>
            <input id="fr-date" type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="fr-papel">Nº de remito en papel (opcional)</label>
            <input id="fr-papel" className={inputClass} value={remitoPapel} onChange={e => setRemitoPapel(e.target.value)} placeholder="Ej: 0001-00004523" inputMode="numeric" />
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">¿Trabajo de guardia?</span>
          <input type="checkbox" className="w-6 h-6 accent-cyan-600" checked={isGuardia} onChange={e => setIsGuardia(e.target.checked)} />
        </label>
      </Section>

      <Section icon={<MapPin className="w-4 h-4" />} title="Cliente y lugar">
        <div className="relative">
          <label className={labelClass} htmlFor="fr-client">Cliente o finca</label>
          <input
            id="fr-client"
            className={inputClass}
            value={clientQuery}
            onChange={e => {
              setClientQuery(e.target.value);
              setClientName('');
            }}
            placeholder="Escriba para buscar…"
            autoComplete="off"
          />
          {clientMatches.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
              {clientMatches.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => pickClient(c)} className="w-full text-left px-3.5 py-3 hover:bg-cyan-50 dark:hover:bg-slate-700 cursor-pointer">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{c.razonSocial}</span>
                    {(c.fincaLocacion || c.direccionFiscal) && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{c.fincaLocacion || c.direccionFiscal}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {clientQuery && !clientName && clientMatches.length === 0 && (
            <button type="button" onClick={() => setClientName(clientQuery.trim())} className="mt-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-400 cursor-pointer">
              Usar "{clientQuery.trim()}" como cliente nuevo
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="fr-site">Localidad / finca</label>
            <input id="fr-site" className={inputClass} value={siteLocation} onChange={e => setSiteLocation(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="fr-point">Punto de trabajo</label>
            <input id="fr-point" className={inputClass} value={workPoint} onChange={e => setWorkPoint(e.target.value)} placeholder="Ej: Pozo sector norte" />
          </div>
        </div>
      </Section>

      <Section icon={<Users className="w-4 h-4" />} title="Equipo">
        <div>
          <label className={labelClass} htmlFor="fr-lead">Responsable / capataz</label>
          <select id="fr-lead" className={inputClass} value={leadTech} onChange={e => setLeadTech(e.target.value)}>
            <option value={SIN_CAPATAZ}>{SIN_CAPATAZ}</option>
            {leadOptions.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <select aria-label="Agregar persona" className={inputClass} value={teamPick} onChange={e => setTeamPick(e.target.value)}>
            <option value="">Agregar persona…</option>
            {availableWorkers.map(w => (
              <option key={w.id} value={w.name}>{w.name}</option>
            ))}
          </select>
          <button type="button" onClick={addTeamMember} disabled={!teamPick} className="shrink-0 px-4 rounded-xl bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" title="Agregar">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {team.length > 0 && (
          <ul className="space-y-2">
            {team.map((t, i) => (
              <li key={t.name} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{t.name}</span>
                <select
                  aria-label={`Rol de ${t.name}`}
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  value={t.role}
                  onChange={e => setTeam(prev => prev.map((x, j) => (j === i ? { ...x, role: e.target.value as 'Oficial' | 'Ayudante' } : x)))}
                >
                  <option value="Oficial">Oficial</option>
                  <option value="Ayudante">Ayudante</option>
                </select>
                <button type="button" onClick={() => setTeam(prev => prev.filter((_, j) => j !== i))} className="p-2 text-rose-600 cursor-pointer" title="Quitar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Clock className="w-4 h-4" />} title={`Horarios · ${totalHours} h · ${totalViajes} ${totalViajes === 1 ? 'viaje' : 'viajes'}`}>
        {jornadas.map((j, i) => (
          <div key={j.key} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_1fr_6rem_auto] gap-2 items-end">
            <div>
              <label className={labelClass} htmlFor={`fr-in-${j.key}`}>Entrada</label>
              <input id={`fr-in-${j.key}`} type="time" className={inputClass} value={j.entrada} onChange={e => setJornadas(prev => prev.map(x => (x.key === j.key ? { ...x, entrada: e.target.value } : x)))} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`fr-out-${j.key}`}>Salida</label>
              <input id={`fr-out-${j.key}`} type="time" className={inputClass} value={j.salida} onChange={e => setJornadas(prev => prev.map(x => (x.key === j.key ? { ...x, salida: e.target.value } : x)))} />
            </div>
            <div className="col-span-1 sm:col-span-1 order-last sm:order-none col-start-1 sm:col-start-auto">
              <label className={labelClass} htmlFor={`fr-trips-${j.key}`}>Viajes</label>
              <input id={`fr-trips-${j.key}`} type="number" min={0} inputMode="numeric" className={inputClass} value={j.viajes} onChange={e => setJornadas(prev => prev.map(x => (x.key === j.key ? { ...x, viajes: Math.max(0, Number(e.target.value) || 0) } : x)))} />
            </div>
            <button
              type="button"
              onClick={() => setJornadas(prev => prev.filter(x => x.key !== j.key))}
              disabled={jornadas.length === 1}
              className="p-3 text-rose-600 disabled:opacity-30 cursor-pointer"
              title={`Quitar jornada ${i + 1}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setJornadas(prev => [...prev, { key: String(Date.now()), entrada: '14:30', salida: '18:00', viajes: 0 }])}
          className="flex items-center gap-1.5 text-sm font-bold text-cyan-700 dark:text-cyan-400 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Agregar otra jornada
        </button>
      </Section>

      <Section icon={<Package className="w-4 h-4" />} title="Materiales usados">
        <div className="grid grid-cols-[1fr_5rem_auto] gap-2">
          <select aria-label="Material" className={inputClass} value={materialPick} onChange={e => setMaterialPick(e.target.value)}>
            <option value="">Elegir material…</option>
            {directory.materials.map(m => (
              <option key={m.id} value={m.name}>{m.name}{m.unit ? ` (${m.unit})` : ''}</option>
            ))}
          </select>
          <input aria-label="Cantidad" type="number" min={1} inputMode="numeric" className={inputClass} value={materialQty} onChange={e => setMaterialQty(Math.max(1, Number(e.target.value) || 1))} />
          <button type="button" onClick={addMaterial} disabled={!materialPick} className="px-4 rounded-xl bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" title="Agregar material">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {materials.length > 0 && (
          <ul className="space-y-2">
            {materials.map(m => (
              <li key={m.name} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="flex-1 min-w-0 truncate text-sm text-slate-800 dark:text-slate-100">
                  <strong>{m.qty}×</strong> {m.name}
                </span>
                <button type="button" onClick={() => setMaterials(prev => prev.filter(x => x.name !== m.name))} className="p-2 text-rose-600 cursor-pointer" title="Quitar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<FileText className="w-4 h-4" />} title="Trabajo realizado">
        <textarea aria-label="Descripción del trabajo" rows={4} className={inputClass} value={description} onChange={e => setDescription(e.target.value)} placeholder="Qué se hizo, novedades, pendientes…" />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className={labelClass + ' mb-0'}>Firma de conformidad del cliente</span>
            <button type="button" onClick={clearSignature} className="flex items-center gap-1 text-xs font-bold text-slate-500 cursor-pointer">
              <Eraser className="w-3.5 h-3.5" /> Borrar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={650}
            height={220}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
            className="w-full h-40 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white touch-none"
          />
        </div>
      </Section>

      {error && (
        <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm font-bold">
          {error}
        </p>
      )}

      <div
        className="fixed left-0 right-0 bottom-0 z-30 p-3 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur flex gap-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <button type="button" onClick={onCancel} className="px-5 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={sending} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer">
          <Send className="w-4 h-4" />
          {sending ? (isEdit ? 'Guardando…' : 'Enviando…') : isEdit ? 'Guardar cambios' : 'Enviar remito'}
        </button>
      </div>
    </form>
  );
};
