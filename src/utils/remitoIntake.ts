import { FieldCatalog, FieldReport } from '../types';

/**
 * Convierte la lectura automática de la foto de un remito de papel en un parte de campo.
 * Lo usan el servidor (canales de WhatsApp y Drive) y la demo; son funciones puras y no tocan ninguna base.
 *
 * Regla de oro: la lectura puede equivocarse con letra manuscrita. Todo lo que no se pudo confirmar
 * contra el catálogo queda marcado en `revisar`, y el parte siempre entra como Pendiente para que
 * administración lo revise antes de convertirlo en remito.
 */

export interface ExtractedRemito {
  remitoPapel?: string;
  fecha?: string;
  cliente?: string;
  ubicacion?: string;
  puntoTrabajo?: string;
  descripcion?: string;
  horaEntrada?: string;
  horaSalida?: string;
  horasTrabajadas?: number;
  kilometros?: number;
  viajes?: number;
  esGuardia?: boolean;
  tecnicoLider?: string;
  cuadrilla?: Array<{ nombre: string; rol?: string }>;
  materiales?: Array<{ descripcion: string; cantidad?: number }>;
  observaciones?: string;
  confianzaLectura?: number;
  /** Número del casillero "PERS" del talonario. */
  cantidadPersonal?: number;
}

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown, max = 500): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return clean || undefined;
};

const finiteNumber = (value: unknown, min: number, max: number): number | undefined => {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

const validDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return undefined;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? value : undefined;
};

const validTime = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const m = TIME_PATTERN.exec(value.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
};

/** La respuesta de la IA no es de fiar: se valida cada campo y lo inválido se descarta. */
export function sanitizeExtraction(raw: unknown): ExtractedRemito {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const crew = Array.isArray(r.cuadrilla) ? r.cuadrilla : [];
  const materials = Array.isArray(r.materiales) ? r.materiales : [];
  return {
    remitoPapel: text(r.remitoPapel, 40),
    fecha: validDate(r.fecha),
    cliente: text(r.cliente, 120),
    ubicacion: text(r.ubicacion, 120),
    puntoTrabajo: text(r.puntoTrabajo, 120),
    descripcion: text(r.descripcion, 2000),
    horaEntrada: validTime(r.horaEntrada),
    horaSalida: validTime(r.horaSalida),
    horasTrabajadas: finiteNumber(r.horasTrabajadas, 0, 24),
    kilometros: finiteNumber(r.kilometros, 0, 2000),
    viajes: finiteNumber(r.viajes, 0, 20),
    esGuardia: typeof r.esGuardia === 'boolean' ? r.esGuardia : undefined,
    tecnicoLider: text(r.tecnicoLider, 80),
    cuadrilla: crew
      .map((c: any) => ({ nombre: text(c?.nombre, 80), rol: text(c?.rol, 30) }))
      .filter((c): c is { nombre: string; rol: string | undefined } => Boolean(c.nombre))
      .slice(0, 12),
    materiales: materials
      .map((m: any) => ({ descripcion: text(m?.descripcion, 120), cantidad: finiteNumber(m?.cantidad, 0, 100000) }))
      .filter((m): m is { descripcion: string; cantidad: number | undefined } => Boolean(m.descripcion))
      .slice(0, 30),
    observaciones: text(r.observaciones, 500),
    confianzaLectura: finiteNumber(r.confianzaLectura, 0, 100),
    cantidadPersonal: finiteNumber(r.cantidadPersonal, 1, 50)
  };
}

// ---------------------------------------------------------------- coincidencia con el catálogo
export const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?s\.?)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
};

/** Mejor coincidencia por texto parecido; devuelve null si no hay una suficientemente clara. */
export function bestMatch<T>(input: string, items: T[], nameOf: (item: T) => string, threshold = 0.8): T | null {
  const target = normalizeName(input);
  if (!target) return null;
  let best: { item: T; score: number } | null = null;
  let second = 0;
  for (const item of items) {
    const score = similarity(target, normalizeName(nameOf(item)));
    if (!best || score > best.score) {
      if (best) second = best.score;
      best = { item, score };
    } else if (score > second) {
      second = score;
    }
  }
  // Se exige que gane con claridad: si dos candidatos empatan, es ambiguo y lo decide una persona.
  return best && best.score >= threshold && best.score - second >= 0.05 ? best.item : null;
}

/**
 * En el papel suelen anotar solo el nombre de pila ("Facundo") y en el sistema figura completo ("Facundo Pérez").
 * Dos nombres son la misma persona si uno es el comienzo del otro, palabra por palabra.
 */
export function isSamePerson(a: string, b: string): boolean {
  const ta = normalizeName(a).split(' ').filter(Boolean);
  const tb = normalizeName(b).split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.every((t, i) => long[i] === t);
}

const DAY_MS = 86_400_000;
const MAX_AGE_DAYS = 7;

// ---------------------------------------------------------------- armado del parte
export type IntakeChannel = 'whatsapp' | 'drive';

export interface IntakeContext {
  channel: IntakeChannel;
  catalog: FieldCatalog;
  /** Capataz que mandó la foto (identificado por su teléfono o su carpeta). */
  submittedBy: { uid: string; authUid: string; name: string };
  sourceRef: string;
  /** Fecha de hoy (AAAA-MM-DD), para completar la fecha si la lectura no la encontró. */
  today: string;
  /** Día en que llegó la foto (AAAA-MM-DD). Se usa para detectar fechas dudosas; por defecto, `today`. */
  receivedDate?: string;
  now?: Date;
}

export type IntakeReportInput = Omit<FieldReport, 'id'>;

export function buildFieldReportFromExtraction(extracted: ExtractedRemito, ctx: IntakeContext): IntakeReportInput {
  const revisar: string[] = [];
  const catalog = ctx.catalog;

  // Cliente
  let clientName = extracted.cliente || '';
  let siteLocation = extracted.ubicacion || '';
  if (clientName) {
    const client = bestMatch(clientName, catalog.clients, c => c.razonSocial);
    if (client) {
      clientName = client.razonSocial;
      siteLocation = siteLocation || client.fincaLocacion;
    } else {
      revisar.push(`Cliente "${clientName}" no coincide con la base de clientes.`);
    }
  } else {
    revisar.push('No se pudo leer el cliente.');
  }

  // Personal (el responsable es el capataz que mandó la foto, no se repite en la cuadrilla)
  const crew: FieldReport['crew'] = [];
  for (const member of extracted.cuadrilla || []) {
    const worker = bestMatch(member.nombre, catalog.workers, w => w.name, 0.75);
    const name = worker ? worker.name : member.nombre.toUpperCase();
    if (!worker) revisar.push(`Personal "${member.nombre}" no coincide con la nómina.`);
    if (isSamePerson(name, ctx.submittedBy.name)) continue;
    if (crew.some(c => normalizeName(c.name) === normalizeName(name))) continue;
    crew.push({ name, role: (member.rol || '').toLowerCase().includes('oficial') ? 'Oficial' : 'Ayudante' });
  }

  // Materiales
  const materials: FieldReport['materials'] = [];
  for (const m of extracted.materiales || []) {
    const material = bestMatch(m.descripcion, catalog.materials, x => x.name, 0.82);
    materials.push({ name: material ? material.name : m.descripcion, qty: m.cantidad && m.cantidad > 0 ? m.cantidad : 1 });
    if (!material) revisar.push(`Material "${m.descripcion}" no figura en el listado de materiales.`);
  }

  // Fecha y horario
  const date = extracted.fecha || ctx.today;
  if (!extracted.fecha) {
    revisar.push('No se pudo leer la fecha: se usó la de hoy.');
  } else {
    // Un 8 y un 9 manuscritos se confunden fácil: una fecha lejos del día en que llegó la foto se confirma.
    const received = ctx.receivedDate ?? ctx.today;
    const days = Math.round((Date.parse(received + 'T00:00:00Z') - Date.parse(extracted.fecha + 'T00:00:00Z')) / DAY_MS);
    const shown = extracted.fecha.split('-').reverse().join('/');
    if (days < 0) revisar.push(`La fecha del remito (${shown}) es posterior al día en que llegó la foto: confirmar.`);
    else if (days > MAX_AGE_DAYS) revisar.push(`La fecha del remito (${shown}) es de hace ${days} días: confirmar que esté bien leída.`);
  }
  let horaEntrada = extracted.horaEntrada;
  let horaSalida = extracted.horaSalida;
  if (!horaEntrada || !horaSalida) {
    revisar.push('Horario incompleto: confirmar entrada y salida.');
    horaEntrada = horaEntrada || '08:00';
    if (!horaSalida) {
      const total = Math.round((extracted.horasTrabajadas ?? 4) * 60);
      const [h, m] = horaEntrada.split(':').map(Number);
      const end = Math.min(h * 60 + m + total, 23 * 60 + 59);
      horaSalida = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    }
  }

  // Personal: el casillero "PERS" del papel debe coincidir con los nombres leídos (el capataz cuenta como uno).
  if (extracted.cantidadPersonal !== undefined && extracted.cantidadPersonal !== crew.length + 1) {
    revisar.push(`El papel indica ${extracted.cantidadPersonal} persona(s) y se leyeron ${crew.length + 1}: confirmar el personal.`);
  }
  // Materiales: si el trabajo describe cambios o instalaciones pero el papel no lista materiales, queda para completar.
  if (materials.length === 0 && /\b(cambi|colo|instal|reempl|arm)/i.test(extracted.descripcion || '')) {
    revisar.push('El trabajo parece incluir materiales pero el papel no los detalla: completar cantidades.');
  }

  const confianza = extracted.confianzaLectura;
  if (confianza !== undefined && confianza < 80) revisar.push(`Lectura poco clara (${confianza}%): revisar contra la foto.`);
  if (!extracted.descripcion) revisar.push('No se pudo leer la descripción del trabajo.');
  if (extracted.observaciones) revisar.push(`Nota de la lectura: ${extracted.observaciones}`);

  return {
    date,
    clientName: clientName || 'CLIENTE SIN IDENTIFICAR',
    siteLocation,
    workPoint: extracted.puntoTrabajo || '',
    isGuardia: extracted.esGuardia === true,
    horaEntrada,
    horaSalida,
    viajes: extracted.viajes !== undefined ? Math.round(extracted.viajes) : 1,
    crew,
    materials,
    description: extracted.descripcion || 'Sin descripción legible: ver la foto.',
    submittedByUid: ctx.submittedBy.uid,
    submittedByAuthUid: ctx.submittedBy.authUid,
    submittedByName: ctx.submittedBy.name,
    submittedAt: (ctx.now ?? new Date()).toISOString(),
    status: 'Pendiente',
    origen: ctx.channel,
    remitoPapel: extracted.remitoPapel,
    confianza,
    revisar: revisar.length ? revisar : undefined,
    sourceRef: ctx.sourceRef
  };
}

/** Identificador estable del parte según el origen: la misma foto no se carga dos veces. */
export function reportIdForSource(channel: IntakeChannel, sourceRef: string): string {
  const safe = sourceRef.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  return `${channel === 'whatsapp' ? 'WA' : 'DR'}-${safe}`;
}

/** Texto de respuesta para el capataz (WhatsApp) con lo que se entendió. */
export function summarizeForSender(report: IntakeReportInput): string {
  const d = report.date.split('-').reverse().join('/');
  const lines = [
    `Recibí tu remito${report.remitoPapel ? ` Nº ${report.remitoPapel}` : ''}.`,
    `Cliente: ${report.clientName}`,
    `Fecha: ${d} · ${report.horaEntrada} a ${report.horaSalida}`,
    report.crew.length ? `Personal: ${report.crew.map(c => c.name).join(', ')}` : 'Personal: solo vos',
    report.materials.length ? `Materiales: ${report.materials.map(m => `${m.qty} ${m.name}`).join(', ')}` : 'Sin materiales'
  ];
  lines.push(
    report.revisar?.length
      ? 'Administración va a revisar algunos datos antes de procesarlo.'
      : 'Queda en revisión de administración.'
  );
  return lines.join('\n');
}
