// Resguardo de la base de producción: copia verificable, comparación y restauración segura.
//
//   node scripts/resguardo.mjs exportar                     Lee la base real (SOLO LECTURA) y guarda una copia con manifiesto.
//   node scripts/resguardo.mjs verificar <carpeta>          Comprueba, sin conexión, que la copia no cambió ni se dañó.
//   node scripts/resguardo.mjs sellar <carpeta>             Crea el manifiesto de una copia anterior que no lo tiene.
//   node scripts/resguardo.mjs comparar <carpeta>           Lee la base real (SOLO LECTURA) y dice qué de la copia falta o cambió.
//   node scripts/resguardo.mjs restaurar <carpeta> --base <id> [--aplicar] [--sobrescribir]
//                                                           Por defecto solo simula. Nunca borra. Solo crea lo que falta.
//
// Opción común: --emulador host:puerto  (usa el emulador de Firestore en lugar de la base real; sirve para ensayar).
// Las copias quedan en backups/ (carpeta fuera de git porque contiene datos sensibles).
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, getDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Todas las colecciones del sistema, incluidas las del módulo de campo (si aún no existen en producción, vienen vacías).
const COLLECTIONS = [
  'users', 'userRoles', 'workers', 'auditRecords', 'clients', 'materials', 'systemSettings',
  'financials', 'technicalParameters', 'archivedReceipts', 'projects',
  'maintenanceServices', 'vehicles', 'vehicleEvents', 'fieldReports', 'catalogoCampo'
];

const args = process.argv.slice(2);
const command = args[0];
const flag = name => args.includes(`--${name}`);
const option = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--') && ['base', 'emulador'].includes(all[i - 1].slice(2))));

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const die = message => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

// Los Timestamp de Firestore no sobreviven a JSON: se guardan marcados para devolverlos igual al restaurar.
const toJson = value => {
  if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v)]));
  return value;
};
const fromJson = value => {
  if (Array.isArray(value)) return value.map(fromJson);
  if (value && typeof value === 'object') {
    if (typeof value.__timestamp === 'string' && Object.keys(value).length === 1) return Timestamp.fromDate(new Date(value.__timestamp));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromJson(v)]));
  }
  return value;
};
// Compara dos documentos sin importar el orden de las claves.
const canon = value => {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canon(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};

function openDb(databaseId) {
  const app = initializeApp(config, `resguardo-${Date.now()}`);
  const db = getFirestore(app, databaseId);
  const emulator = option('emulador');
  if (emulator) {
    const [host, port] = emulator.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }
  return db;
}

function folderArg() {
  const folder = positional[0];
  if (!folder) die('Falta la carpeta de la copia (por ejemplo backups/2026-10-14T03-41-05-474Z).');
  if (!fs.existsSync(folder)) die(`No existe la carpeta ${folder}.`);
  return folder;
}

const gitCommit = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'desconocido';
  }
};

function writeManifest(folder, source) {
  const files = {};
  for (const name of COLLECTIONS) {
    const file = path.join(folder, `${name}.json`);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    files[`${name}.json`] = { documentos: JSON.parse(text).length, sha256: sha256(text), bytes: Buffer.byteLength(text) };
  }
  const manifest = {
    creado: new Date().toISOString(),
    proyecto: config.projectId,
    base: config.firestoreDatabaseId,
    origen: source,
    versionDelCodigo: gitCommit(),
    totalDocumentos: Object.values(files).reduce((n, f) => n + f.documentos, 0),
    archivos: files
  };
  fs.writeFileSync(path.join(folder, 'MANIFIESTO.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function verifyFolder(folder) {
  const manifestFile = path.join(folder, 'MANIFIESTO.json');
  if (!fs.existsSync(manifestFile)) return { ok: false, problems: ['No tiene MANIFIESTO.json (use "sellar" para crearlo).'], manifest: null };
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const problems = [];
  for (const [name, info] of Object.entries(manifest.archivos)) {
    const file = path.join(folder, name);
    if (!fs.existsSync(file)) {
      problems.push(`${name}: el archivo no está.`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    if (sha256(text) !== info.sha256) problems.push(`${name}: el contenido cambió o está dañado.`);
    else if (JSON.parse(text).length !== info.documentos) problems.push(`${name}: la cantidad de documentos no coincide.`);
  }
  return { ok: problems.length === 0, problems, manifest };
}

const loadCollection = (folder, name) => {
  const file = path.join(folder, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
};

async function exportar() {
  const db = openDb(config.firestoreDatabaseId);
  const folder = path.join('backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(folder, { recursive: true });
  let failed = false;
  for (const name of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, name));
      const docs = snap.docs.map(d => ({ id: d.id, data: toJson(d.data()) }));
      fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify(docs, null, 2));
      console.log(`  ${name}: ${docs.length} documentos`);
    } catch (err) {
      failed = true;
      console.error(`  ${name}: ERROR ${err.message}`);
    }
  }
  if (failed) die(`La copia quedó incompleta en ${folder}. No la use como respaldo.`);
  const manifest = writeManifest(folder, option('emulador') ? 'emulador' : 'base real (solo lectura)');
  const check = verifyFolder(folder);
  if (!check.ok) die(`La copia no pasó la verificación: ${check.problems.join(' ')}`);
  console.log(`\nCopia completa y verificada: ${folder}`);
  console.log(`Total: ${manifest.totalDocumentos} documentos. Guarde además una copia de esa carpeta fuera de esta computadora.`);
}

function verificar() {
  const folder = folderArg();
  const { ok, problems, manifest } = verifyFolder(folder);
  if (!ok) {
    console.error(`La copia ${folder} NO es confiable:`);
    problems.forEach(p => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log(`Copia ${folder} correcta. ${manifest.totalDocumentos} documentos, creada el ${manifest.creado}.`);
  for (const [name, info] of Object.entries(manifest.archivos)) console.log(`  ${name.replace('.json', '')}: ${info.documentos}`);
}

function sellar() {
  const folder = folderArg();
  if (fs.existsSync(path.join(folder, 'MANIFIESTO.json'))) die('Esa copia ya tiene manifiesto; no se reemplaza para no ocultar cambios.');
  const manifest = writeManifest(folder, 'copia anterior sellada después');
  console.log(`Manifiesto creado en ${folder}: ${manifest.totalDocumentos} documentos.`);
}

// Devuelve, para cada colección, qué documentos de la copia faltan en la base o están distintos.
async function diff(folder, db) {
  const report = {};
  for (const name of COLLECTIONS) {
    const backup = loadCollection(folder, name);
    if (!backup.length) continue;
    const live = new Map((await getDocs(collection(db, name))).docs.map(d => [d.id, canon(toJson(d.data()))]));
    const missing = [];
    const changed = [];
    for (const { id, data } of backup) {
      if (!live.has(id)) missing.push(id);
      else if (live.get(id) !== canon(data)) changed.push(id);
    }
    report[name] = { enCopia: backup.length, enBase: live.size, faltan: missing, distintos: changed };
  }
  return report;
}

async function comparar() {
  const folder = folderArg();
  const check = verifyFolder(folder);
  if (!check.ok) die(`La copia no es confiable: ${check.problems.join(' ')}`);
  const report = await diff(folder, openDb(config.firestoreDatabaseId));
  let lost = 0;
  for (const [name, r] of Object.entries(report)) {
    lost += r.faltan.length;
    const note = r.faltan.length ? `FALTAN ${r.faltan.length}` : 'completo';
    const modified = r.distintos.length ? `, ${r.distintos.length} modificados desde la copia (normal si se siguió trabajando)` : '';
    console.log(`  ${name}: copia ${r.enCopia}, base ${r.enBase} -> ${note}${modified}`);
    if (r.faltan.length) console.log(`     ids que faltan: ${r.faltan.slice(0, 10).join(', ')}${r.faltan.length > 10 ? '…' : ''}`);
  }
  console.log(lost === 0 ? '\nNada de lo que había en la copia falta en la base.' : `\nATENCIÓN: ${lost} documentos de la copia no están en la base.`);
  process.exit(lost === 0 ? 0 : 2);
}

async function restaurar() {
  const folder = folderArg();
  const check = verifyFolder(folder);
  if (!check.ok) die(`La copia no es confiable, no se restaura: ${check.problems.join(' ')}`);
  const target = option('base');
  if (!target) die('Indique la base de destino con --base <id>. Para ensayar use una base vacía o --emulador.');
  const isProduction = target === config.firestoreDatabaseId;
  if (isProduction && !flag('confirmo-produccion') && !option('emulador')) {
    die('El destino es la base de PRODUCCIÓN. Para escribir ahí agregue --confirmo-produccion (solo si la base real perdió datos).');
  }
  const apply = flag('aplicar');
  const overwrite = flag('sobrescribir');
  const db = openDb(target);
  console.log(`${apply ? 'RESTAURANDO' : 'SIMULACIÓN (no se escribe nada)'} en la base ${target}${option('emulador') ? ' (emulador)' : ''}`);
  console.log(overwrite ? 'Modo: reemplaza los documentos que difieran de la copia.' : 'Modo seguro: solo crea los documentos que faltan; no pisa nada existente.');
  let created = 0;
  let replaced = 0;
  let kept = 0;
  for (const name of COLLECTIONS) {
    for (const { id, data } of loadCollection(folder, name)) {
      const ref = doc(db, name, id);
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        if (apply) await setDoc(ref, fromJson(data));
        created++;
      } else if (overwrite && canon(toJson(existing.data())) !== canon(data)) {
        if (apply) await setDoc(ref, fromJson(data));
        replaced++;
      } else {
        kept++;
      }
    }
  }
  console.log(`Documentos a crear: ${created}. A reemplazar: ${replaced}. Ya estaban y se conservan: ${kept}.`);
  if (!apply) console.log('Para aplicar de verdad agregue --aplicar.');
}

const commands = { exportar, verificar, sellar, comparar, restaurar };
if (!commands[command]) {
  console.error('Uso: node scripts/resguardo.mjs <exportar|verificar|sellar|comparar|restaurar> [carpeta] [opciones]');
  process.exit(1);
}
await commands[command]();
process.exit(0);
