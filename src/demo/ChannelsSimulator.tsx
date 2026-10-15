import React, { useMemo, useRef, useState } from 'react';
import { MessageCircle, HardDrive, Send, Upload, RefreshCw, FolderOpen, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { saveFieldReportToFirestore } from '../services/firestoreSync';
import {
  sanitizeExtraction,
  buildFieldReportFromExtraction,
  reportIdForSource,
  summarizeForSender,
  type IntakeChannel
} from '../utils/remitoIntake';
import type { FieldReport } from '../types';

/**
 * SIMULADOR de los canales de entrada de remitos (WhatsApp y Drive), solo para la demo.
 * Usa el mismo armado de partes que el servidor real (src/utils/remitoIntake.ts), pero la lectura de la
 * foto con IA está SIMULADA con resultados de ejemplo y no hay conexión con Meta ni con Google.
 */

type Variant = 'clara' | 'dudosa' | 'borrosa' | 'sindatos';

const VARIANTS: Record<Variant, { label: string; help: string }> = {
  clara: { label: 'Foto clara', help: 'Cliente con un error de letra, personal y materiales conocidos.' },
  dudosa: { label: 'Foto dudosa', help: 'Cliente y personal que no existen, sin fecha, lectura poco clara.' },
  borrosa: { label: 'Foto borrosa', help: 'La IA no logra leerla (falla el servicio).' },
  sindatos: { label: 'Sin remito', help: 'Una foto cualquiera, sin datos de remito.' }
};

const today = () => new Date().toISOString().slice(0, 10);

/** Lectura simulada: devuelve lo que "leería" la IA de cada tipo de foto. */
function mockExtraction(variant: Variant): unknown {
  if (variant === 'borrosa') throw new Error('IA no disponible');
  if (variant === 'sindatos') return {};
  if (variant === 'dudosa') {
    return {
      remitoPapel: '0001-0004610',
      cliente: 'Finca La Consulta',
      puntoTrabajo: 'Pozo 7',
      descripcion: 'Revisión de bomba. Se escucha ruido.',
      cuadrilla: [{ nombre: 'Facundo', rol: 'oficial' }],
      materiales: [{ descripcion: 'fusible especial', cantidad: 3 }],
      confianzaLectura: 52,
      observaciones: 'Letra poco legible en el nombre del cliente.'
    };
  }
  return {
    remitoPapel: '0001-0004601',
    fecha: today(),
    cliente: 'Bodega Los Alamos',
    puntoTrabajo: 'Pozo 2 - tablero',
    descripcion: 'Cambio de cable y revisión de protecciones. Prueba de funcionamiento.',
    horaEntrada: '08:00',
    horaSalida: '12:30',
    viajes: 1,
    cuadrilla: [{ nombre: 'bruno caceres', rol: 'oficial' }, { nombre: 'Camila Suarez', rol: 'ayudante' }],
    materiales: [{ descripcion: 'Cable subterraneo 4x16 mm2', cantidad: 2 }],
    confianzaLectura: 93
  };
}

/** Dibuja una foto de ejemplo de un remito de papel. */
function sampleImage(variant: Variant): string {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 480;
  const g = c.getContext('2d')!;
  g.fillStyle = variant === 'sindatos' ? '#cbd5e1' : '#fdfbf7';
  g.fillRect(0, 0, c.width, c.height);
  if (variant !== 'sindatos') {
    g.strokeStyle = '#334155';
    g.strokeRect(12, 12, 336, 456);
    g.fillStyle = '#1e293b';
    g.font = 'bold 15px sans-serif';
    g.fillText('REMITO DE TRABAJO', 24, 40);
    g.font = '12px sans-serif';
    ['Cliente: ____________________', 'Fecha: ______   Pozo: ________', 'Trabajo realizado:', '____________________________', '____________________________', 'Personal: _________________', 'Materiales: _______________'].forEach((t, i) =>
      g.fillText(t, 24, 80 + i * 34)
    );
    g.fillStyle = '#1d4ed8';
    g.font = 'italic 14px cursive';
    ['(letra manuscrita de ejemplo)', variant === 'dudosa' ? 'Finca La C...' : 'Bodega Los Alamos', 'cambio de cable', 'Bruno / Camila'].forEach((t, i) => g.fillText(t, 30, 100 + i * 52));
  }
  if (variant === 'borrosa') {
    g.filter = 'blur(6px)';
    g.drawImage(c, 0, 0);
  }
  g.fillStyle = 'rgba(220,38,38,0.85)';
  g.font = 'bold 12px sans-serif';
  g.fillText('IMAGEN DE PRUEBA (DEMO)', 24, 462);
  return c.toDataURL('image/jpeg', 0.7);
}

interface ChatItem {
  from: 'user' | 'bot';
  text?: string;
  image?: string;
}

interface DriveItem {
  id: string;
  name: string;
  variant: Variant;
  image: string;
  folder: 'pending' | 'done' | 'error';
  result?: string;
}

const digits = (s: string) => s.replace(/\D/g, '');

export const ChannelsSimulator: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { fieldReports, fieldCatalog } = useData();
  const { users } = useAuth();
  const [channel, setChannel] = useState<IntakeChannel>('whatsapp');

  const capataces = useMemo(() => users.filter(u => u.role === 'Capataz' && u.active !== false && u.authUid), [users]);
  const unknownPhone = '2615559999';

  // ------------------------------------------------------------ núcleo (equivale a server/intake.ts)
  const counter = useRef(1);
  const ingest = async (opts: {
    channel: IntakeChannel;
    sourceRef: string;
    phone?: string;
    authUid?: string;
    variant: Variant;
    image: string;
  }): Promise<{ ok: boolean; reply: string }> => {
    const owner = opts.phone
      ? capataces.find(u => u.phone && digits(u.phone).slice(-10) === digits(opts.phone!).slice(-10))
      : capataces.find(u => u.authUid === opts.authUid);
    if (!owner) return { ok: false, reply: 'Este número no está registrado para cargar remitos. Pedile a administración que lo dé de alta.' };

    const id = reportIdForSource(opts.channel, opts.sourceRef);
    if (fieldReports.some(r => r.id === id)) return { ok: true, reply: 'Esa foto ya la había recibido.' };

    let raw: unknown;
    try {
      raw = mockExtraction(opts.variant);
    } catch {
      return { ok: false, reply: 'No se pudo leer la foto. Probá de nuevo con más luz y de frente.' };
    }
    const extracted = sanitizeExtraction(raw);
    if (!extracted.cliente && !extracted.descripcion && !extracted.remitoPapel) {
      return { ok: false, reply: 'No pude leer datos en la foto. Probá de nuevo con más luz y de frente.' };
    }
    const report = buildFieldReportFromExtraction(extracted, {
      channel: opts.channel,
      catalog: fieldCatalog ?? { clients: [], workers: [], materials: [] },
      submittedBy: { uid: owner.uid, authUid: owner.authUid!, name: owner.displayName },
      sourceRef: opts.sourceRef,
      today: today()
    });
    const full: FieldReport = JSON.parse(JSON.stringify({ ...report, id, imageUrl: opts.image }));
    await saveFieldReportToFirestore(full);
    return { ok: true, reply: summarizeForSender(report) };
  };

  // ------------------------------------------------------------ WhatsApp
  const [sender, setSender] = useState<string>('capataz');
  const [chat, setChat] = useState<ChatItem[]>([
    { from: 'bot', text: 'Mandame la foto del remito de papel (de frente y con buena luz) y la cargo para administración.' }
  ]);
  const [busy, setBusy] = useState(false);
  const senderPhone = sender === 'capataz' ? capataces[0]?.phone || '' : unknownPhone;

  const sendPhoto = async (variant: Variant) => {
    if (busy) return;
    setBusy(true);
    const image = sampleImage(variant);
    setChat(c => [...c, { from: 'user', image }]);
    const res = await ingest({ channel: 'whatsapp', sourceRef: `sim${Date.now()}${counter.current++}`, phone: senderPhone, variant, image });
    setChat(c => [...c, { from: 'bot', text: res.reply }]);
    setBusy(false);
  };

  const resendLast = async () => {
    // Meta reintenta una entrega: el mismo identificador de mensaje no debe duplicar el parte.
    const last = fieldReports.find(r => r.origen === 'whatsapp');
    if (!last?.sourceRef) return;
    setChat(c => [...c, { from: 'user', text: '(Meta reintenta el último mensaje)' }]);
    const res = await ingest({ channel: 'whatsapp', sourceRef: last.sourceRef, phone: senderPhone, variant: 'clara', image: last.imageUrl || '' });
    setChat(c => [...c, { from: 'bot', text: res.reply }]);
  };

  const sendText = () => {
    setChat(c => [
      ...c,
      { from: 'user', text: 'hola' },
      { from: 'bot', text: capataces.some(u => u.phone && digits(u.phone).slice(-10) === digits(senderPhone).slice(-10)) ? 'Mandame la foto del remito de papel (de frente y con buena luz) y la cargo para administración.' : 'Este número no está registrado para cargar remitos. Pedile a administración que lo dé de alta.' }
    ]);
  };

  // ------------------------------------------------------------ Drive
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [driveLog, setDriveLog] = useState<string>('');
  const owner = capataces[0];

  const uploadToDrive = (variant: Variant) => {
    const n = counter.current++;
    setFiles(f => [...f, { id: `drv${Date.now()}${n}`, name: `remito_${n}.jpg`, variant, image: sampleImage(variant), folder: 'pending' }]);
  };

  const runDrive = async () => {
    if (busy || !owner) return;
    setBusy(true);
    let created = 0;
    let failed = 0;
    const next: DriveItem[] = [];
    for (const f of files) {
      if (f.folder !== 'pending') {
        next.push(f);
        continue;
      }
      const res = await ingest({ channel: 'drive', sourceRef: f.id, authUid: owner.authUid, variant: f.variant, image: f.image });
      if (res.ok) created++;
      else failed++;
      next.push({ ...f, folder: res.ok ? 'done' : 'error', result: res.ok ? 'Parte creado' : res.reply });
    }
    setFiles(next);
    setDriveLog(`Revisión terminada: ${created} parte(s) creado(s), ${failed} foto(s) con error.`);
    setBusy(false);
  };

  const inFolder = (folder: DriveItem['folder']) => files.filter(f => f.folder === folder);

  const tabCls = (active: boolean) =>
    `px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer border ${
      active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    }`;
  const btnCls = 'px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer disabled:opacity-50';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Canales de Entrada (simulador)</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Probá cómo llegaría un remito de papel por WhatsApp o por Drive. Cada foto crea un <strong>parte pendiente</strong> en Partes de Campo, para revisarlo antes de convertirlo en remito.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-700 dark:text-slate-300">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p>
          <strong>Simulación.</strong> La lectura de la foto con IA está simulada con resultados de ejemplo, y no hay conexión con Meta ni con Google.
          El armado del parte (coincidencia con clientes, personal y materiales, y marcas de revisión) es el mismo que usa el servidor real.
        </p>
      </div>

      <div className="flex gap-2" role="tablist">
        <button role="tab" aria-selected={channel === 'whatsapp'} onClick={() => setChannel('whatsapp')} className={tabCls(channel === 'whatsapp')}>
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </button>
        <button role="tab" aria-selected={channel === 'drive'} onClick={() => setChannel('drive')} className={tabCls(channel === 'drive')}>
          <HardDrive className="w-4 h-4" /> Google Drive
        </button>
      </div>

      {channel === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-[#efeae2] dark:bg-slate-900 flex flex-col h-[520px]">
            <div className="bg-emerald-700 text-white px-4 py-3 text-sm font-black">Remitos · número de la empresa</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2" aria-live="polite">
              {chat.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-line shadow-sm ${m.from === 'user' ? 'ml-auto bg-emerald-100 text-slate-900' : 'bg-white text-slate-800'}`}>
                  {m.image && <img src={m.image} alt="Foto enviada" className="w-40 rounded-lg mb-1" />}
                  {m.text}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="wa-sender" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Quién escribe</label>
              <select id="wa-sender" value={sender} onChange={e => setSender(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                <option value="capataz">{capataces[0] ? `${capataces[0].displayName} (capataz registrado)` : 'Capataz registrado'}</option>
                <option value="desconocido">Número desconocido</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Solo los teléfonos de capataces activos cargan remitos.</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Enviar una foto</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(VARIANTS) as Variant[]).map(v => (
                  <button key={v} type="button" disabled={busy} onClick={() => sendPhoto(v)} className={btnCls} title={VARIANTS[v].help}>
                    <Send className="w-3 h-3 inline mr-1" /> {VARIANTS[v].label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" disabled={busy} onClick={resendLast} className={btnCls}>Meta reintenta el último</button>
                <button type="button" disabled={busy} onClick={sendText} className={btnCls}>Mensaje de texto</button>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate?.('partes')} className="text-xs font-black text-emerald-700 dark:text-emerald-400 underline cursor-pointer">
              Ver los partes creados ({fieldReports.filter(r => r.origen === 'whatsapp').length} por WhatsApp)
            </button>
          </div>
        </div>
      )}

      {channel === 'drive' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Carpeta de <strong>{owner?.displayName ?? 'capataz'}</strong>. Cuando sube fotos a "Pendientes", el sistema las revisa cada pocos minutos y las mueve a "Procesados" o "Con error".
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VARIANTS) as Variant[]).map(v => (
              <button key={v} type="button" onClick={() => uploadToDrive(v)} className={btnCls} title={VARIANTS[v].help}>
                <Upload className="w-3 h-3 inline mr-1" /> Subir: {VARIANTS[v].label}
              </button>
            ))}
            <button type="button" disabled={busy || inFolder('pending').length === 0} onClick={runDrive} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black cursor-pointer disabled:opacity-50">
              <RefreshCw className="w-3 h-3 inline mr-1" /> Ejecutar revisión ahora
            </button>
          </div>
          {driveLog && <p role="status" className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{driveLog}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([['pending', 'Pendientes'], ['done', 'Procesados'], ['error', 'Con error']] as const).map(([folder, label]) => (
              <section key={folder} aria-label={label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 min-h-[160px]">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                  <FolderOpen className="w-3.5 h-3.5" /> {label} ({inFolder(folder).length})
                </h2>
                <ul className="space-y-1.5">
                  {inFolder(folder).map(f => (
                    <li key={f.id} className="flex items-center gap-2 text-xs">
                      <img src={f.image} alt="" className="w-8 h-10 object-cover rounded" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold truncate">{f.name}</span>
                        {f.result && (
                          <span className={`flex items-center gap-1 ${folder === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {folder === 'error' ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
                            <span className="truncate">{f.result}</span>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <button type="button" onClick={() => onNavigate?.('partes')} className="text-xs font-black text-emerald-700 dark:text-emerald-400 underline cursor-pointer">
            Ver los partes creados ({fieldReports.filter(r => r.origen === 'drive').length} por Drive)
          </button>
        </div>
      )}
    </div>
  );
};
