// Mide la calidad de lectura de remitos con Gemini contra respuestas correctas anotadas a mano.
//
// Uso:
//   1. Poner la clave en .env.local:  GEMINI_API_KEY=...   (el archivo está en .gitignore)
//   2. Dejar las fotos en backups/remitos-prueba/ (carpeta ignorada por git) con su respuesta correcta al lado:
//        remito01.jpg  +  remito01.json   (ver scripts/measure_ocr.ejemplo.json)
//   3. npx tsx scripts/measure_ocr.ts [carpeta] [--limit=N]
//
// Cada foto se envía a Gemini (costo por imagen). El informe queda en la misma carpeta (informe.json y informe.csv).
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { scanRemitoImage } from '../server/ocr';
import { sanitizeExtraction, normalizeName, isSamePerson, type ExtractedRemito } from '../src/utils/remitoIntake';

dotenv.config({ path: ['.env.local', '.env'] });

const args = process.argv.slice(2);
const folder = args.find(a => !a.startsWith('--')) ?? 'backups/remitos-prueba';
const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);

if (!process.env.GEMINI_API_KEY) {
  console.error('Falta GEMINI_API_KEY. Agregala en .env.local (no la pegues en el chat ni la subas al repositorio).');
  process.exit(1);
}
if (!fs.existsSync(folder)) {
  console.error(`No existe la carpeta ${folder}. Creala y poné las fotos con su archivo .json de respuesta correcta.`);
  process.exit(1);
}

// Catálogo opcional (como en producción, donde el servidor le pasa a la IA los nombres conocidos).
// backups/remitos-prueba/catalogo.json: { "clients": ["El Magistral"], "workers": ["Facundo Pérez"] }
const catalogPath = path.join(folder, 'catalogo.json');
const catalog: { clients?: string[]; workers?: string[] } = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : {};
console.log(`Catálogo: ${catalog.clients?.length ?? 0} cliente(s), ${catalog.workers?.length ?? 0} persona(s)${fs.existsSync(catalogPath) ? '' : ' (sin catalogo.json: la IA lee sin pistas)'}`);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// ---------------------------------------------------------------- comparación por campo
const tokens = (s: string) => new Set(normalizeName(s).split(' ').filter(t => t.length > 2));
const overlap = (a: string, b: string) => {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  const common = [...ta].filter(t => tb.has(t)).length;
  return common / Math.max(ta.size, tb.size);
};
const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '').replace(/^0+/, '');

type Check = { field: string; ok: boolean | null; expected: unknown; got: unknown };

function compare(truth: ExtractedRemito, got: ExtractedRemito): Check[] {
  const checks: Check[] = [];
  const add = (field: string, expected: unknown, gotV: unknown, ok: boolean | null) => checks.push({ field, ok, expected, got: gotV });
  const has = (v: unknown) => v !== undefined && v !== null && v !== '';

  if (has(truth.cliente)) add('cliente', truth.cliente, got.cliente, overlap(truth.cliente!, got.cliente ?? '') >= 0.6);
  if (has(truth.fecha)) add('fecha', truth.fecha, got.fecha, truth.fecha === got.fecha);
  if (has(truth.remitoPapel)) add('remitoPapel', truth.remitoPapel, got.remitoPapel, onlyDigits(truth.remitoPapel) === onlyDigits(got.remitoPapel));
  if (has(truth.horaEntrada)) add('horaEntrada', truth.horaEntrada, got.horaEntrada, truth.horaEntrada === got.horaEntrada);
  if (has(truth.horaSalida)) add('horaSalida', truth.horaSalida, got.horaSalida, truth.horaSalida === got.horaSalida);
  if (has(truth.cantidadPersonal)) add('cantidadPersonal', truth.cantidadPersonal, got.cantidadPersonal, truth.cantidadPersonal === got.cantidadPersonal);
  if (has(truth.descripcion)) add('descripcion', truth.descripcion?.slice(0, 60), got.descripcion?.slice(0, 60), overlap(truth.descripcion!, got.descripcion ?? '') >= 0.6);
  if (truth.cuadrilla?.length) {
    const wanted = truth.cuadrilla.map(c => c.nombre);
    // El responsable que firma cuenta como parte del personal.
    const found = [got.tecnicoLider, ...(got.cuadrilla?.map(c => c.nombre) ?? [])].filter((n): n is string => Boolean(n));
    const okAll = wanted.every(w => found.some(f => isSamePerson(w, f) || overlap(w, f) >= 0.5));
    add('personal', wanted.join(', '), found.join(', '), okAll);
  }
  if (truth.materiales) {
    const wanted = truth.materiales.map(m => m.descripcion);
    const found = got.materiales?.map(m => m.descripcion) ?? [];
    const okAll = wanted.every(w => found.some(f => overlap(w, f) >= 0.5)) && found.length <= wanted.length + 1;
    add('materiales', wanted.join(', ') || '(ninguno)', found.join(', ') || '(ninguno)', okAll);
  }
  return checks;
}

// ---------------------------------------------------------------- ejecución
const images = fs
  .readdirSync(folder)
  .filter(f => MIME[path.extname(f).toLowerCase()])
  .sort()
  .slice(0, limit);

if (!images.length) {
  console.error(`No hay fotos (.jpg, .png, .webp) en ${folder}.`);
  process.exit(1);
}

const perField = new Map<string, { ok: number; total: number }>();
const report: any[] = [];
let withoutTruth = 0;

for (const file of images) {
  const truthPath = path.join(folder, file.replace(/\.[^.]+$/, '.json'));
  if (!fs.existsSync(truthPath)) {
    withoutTruth++;
    console.log(`- ${file}: sin archivo .json de respuesta correcta, se omite.`);
    continue;
  }
  const truth = sanitizeExtraction(JSON.parse(fs.readFileSync(truthPath, 'utf8')));
  const data = fs.readFileSync(path.join(folder, file));
  const started = Date.now();
  try {
    const raw = await scanRemitoImage(ai, {
      base64: data.toString('base64'),
      mimeType: MIME[path.extname(file).toLowerCase()],
      knownClients: catalog.clients ?? [],
      knownWorkers: catalog.workers ?? []
    });
    const got = sanitizeExtraction(raw);
    const checks = compare(truth, got);
    for (const c of checks) {
      const s = perField.get(c.field) ?? { ok: 0, total: 0 };
      s.total++;
      if (c.ok) s.ok++;
      perField.set(c.field, s);
    }
    const bad = checks.filter(c => !c.ok);
    console.log(`${bad.length ? '✗' : '✓'} ${file} (${((Date.now() - started) / 1000).toFixed(1)} s, confianza ${got.confianzaLectura ?? '?'}%)${bad.length ? ': ' + bad.map(b => b.field).join(', ') : ''}`);
    report.push({ file, confianza: got.confianzaLectura, checks, got });
  } catch (err: any) {
    console.log(`✗ ${file}: error de lectura (${err?.message ?? err})`);
    report.push({ file, error: String(err?.message ?? err) });
  }
}

console.log('\nAciertos por campo');
for (const [field, s] of perField) console.log(`  ${field.padEnd(18)} ${s.ok}/${s.total}  ${((s.ok / s.total) * 100).toFixed(0)}%`);
const total = [...perField.values()].reduce((a, s) => ({ ok: a.ok + s.ok, total: a.total + s.total }), { ok: 0, total: 0 });
if (total.total) console.log(`  ${'TOTAL'.padEnd(18)} ${total.ok}/${total.total}  ${((total.ok / total.total) * 100).toFixed(0)}%`);
if (withoutTruth) console.log(`\n${withoutTruth} foto(s) sin respuesta correcta no se midieron.`);

fs.writeFileSync(path.join(folder, 'informe.json'), JSON.stringify(report, null, 2));
const rows = ['archivo,campo,correcto,esperado,leido'];
for (const r of report) for (const c of r.checks ?? []) rows.push([r.file, c.field, c.ok ? 'si' : 'no', c.expected, c.got].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
fs.writeFileSync(path.join(folder, 'informe.csv'), rows.join('\n'));
console.log(`\nInforme guardado en ${folder}/informe.json y informe.csv`);
