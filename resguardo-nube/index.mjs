// Copia diaria de Firestore a un depósito PRIVADO de Cloud Storage.
// Corre como trabajo de Cloud Run (Cloud Scheduler lo dispara a las 23:59). No escribe nada en Firestore.
//
//   node index.mjs                     Hace la copia (comando por defecto: exportar).
//   node index.mjs listar              Lista las copias guardadas en el depósito.
//   node index.mjs descargar <copia>   Baja una copia a backups/<copia> para usar scripts/resguardo.mjs (verificar, comparar, restaurar).
//
// Variables de entorno:
//   BACKUP_BUCKET          (obligatoria) depósito privado de destino, sin "gs://".
//   FIRESTORE_DATABASE_ID  (obligatoria) base a copiar.
//   PROJECT_ID             proyecto (por defecto GOOGLE_CLOUD_PROJECT).
//   BACKUP_PREFIX          carpeta dentro del depósito (por defecto "resguardos").
//   ALERT_DROP_PERCENT     si la copia tiene más de este % menos documentos que la anterior, el trabajo termina en error (por defecto 10).
//
// El formato de los archivos es el mismo que produce scripts/resguardo.mjs, así que la misma herramienta verifica y restaura.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Debe coincidir con la lista de scripts/resguardo.mjs.
const COLLECTIONS = [
  'users', 'userRoles', 'workers', 'auditRecords', 'clients', 'materials', 'systemSettings',
  'financials', 'technicalParameters', 'archivedReceipts', 'projects',
  'maintenanceServices', 'vehicles', 'vehicleEvents', 'fieldReports', 'catalogoCampo'
];

const env = name => process.env[name]?.trim();
const die = (message, code = 1) => {
  console.error(`ERROR: ${message}`);
  process.exit(code);
};
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');

const bucketName = env('BACKUP_BUCKET');
if (!bucketName) die('Falta BACKUP_BUCKET (depósito privado de Cloud Storage).');
const databaseId = env('FIRESTORE_DATABASE_ID');
if (!databaseId) die('Falta FIRESTORE_DATABASE_ID.');
const projectId = env('PROJECT_ID') || env('GOOGLE_CLOUD_PROJECT') || env('GCLOUD_PROJECT');
const prefix = (env('BACKUP_PREFIX') || 'resguardos').replace(/^\/+|\/+$/g, '');
const dropLimit = Number(env('ALERT_DROP_PERCENT') || 10);

const app = initializeApp({ projectId, storageBucket: bucketName });
const db = getFirestore(app, databaseId);
const bucket = getStorage(app).bucket(bucketName);

// Los Timestamp se guardan marcados para volver igual al restaurar. Un tipo que no se sabe guardar corta la copia
// en lugar de perder el dato sin avisar.
function toJson(value, where) {
  if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(v => toJson(v, where));
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error(`${where}: tipo de dato no soportado (${value.constructor?.name})`);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v, `${where}.${k}`)]));
  }
  return value;
}

async function exportar() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = `${prefix}/${stamp}`;
  const texts = {};
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    const docs = snap.docs.map(d => ({ id: d.id, data: toJson(d.data(), `${name}/${d.id}`) }));
    texts[`${name}.json`] = JSON.stringify(docs, null, 2);
    console.log(`  ${name}: ${docs.length} documentos`);
  }

  const files = Object.fromEntries(
    Object.entries(texts).map(([file, text]) => [file, { documentos: JSON.parse(text).length, sha256: sha256(text), bytes: Buffer.byteLength(text) }])
  );
  const manifest = {
    creado: new Date().toISOString(),
    proyecto: projectId,
    base: databaseId,
    origen: 'copia automática en la nube',
    versionDelCodigo: env('K_REVISION') || env('JOB_VERSION') || 'desconocido',
    totalDocumentos: Object.values(files).reduce((n, f) => n + f.documentos, 0),
    archivos: files
  };

  // 1. Datos. 2. Verificación leyendo lo subido. 3. Manifiesto al final: una carpeta sin manifiesto es una copia incompleta.
  for (const [file, text] of Object.entries(texts)) {
    await bucket.file(`${folder}/${file}`).save(text, { contentType: 'application/json', resumable: false });
  }
  for (const [file, info] of Object.entries(files)) {
    const [back] = await bucket.file(`${folder}/${file}`).download();
    if (sha256(back.toString('utf8')) !== info.sha256) die(`${file}: lo guardado en el depósito no coincide con lo leído. La copia ${folder} es incompleta.`);
  }
  await bucket.file(`${folder}/MANIFIESTO.json`).save(JSON.stringify(manifest, null, 2), { contentType: 'application/json', resumable: false });
  console.log(`\nCopia completa y verificada: gs://${bucketName}/${folder} (${manifest.totalDocumentos} documentos)`);

  const previous = (await completeCopies()).filter(c => c.stamp !== stamp).pop();
  if (previous) {
    const drop = previous.total > 0 ? ((previous.total - manifest.totalDocumentos) / previous.total) * 100 : 0;
    if (drop > dropLimit) {
      die(`ALERTA: la base tiene ${drop.toFixed(1)}% menos documentos que en la copia anterior (${previous.total} -> ${manifest.totalDocumentos}). La copia se guardó, pero revise si se borraron datos.`, 3);
    }
    console.log(`Comparada con la anterior (${previous.stamp}): ${previous.total} -> ${manifest.totalDocumentos} documentos.`);
  }
}

// Copias completas (con manifiesto), de la más vieja a la más nueva.
async function completeCopies() {
  const [files] = await bucket.getFiles({ prefix: `${prefix}/` });
  const manifests = files.filter(f => f.name.endsWith('/MANIFIESTO.json'));
  const copies = [];
  for (const file of manifests) {
    const [content] = await file.download();
    const manifest = JSON.parse(content.toString('utf8'));
    copies.push({ stamp: file.name.split('/').slice(-2, -1)[0], total: manifest.totalDocumentos, creado: manifest.creado });
  }
  return copies.sort((a, b) => a.stamp.localeCompare(b.stamp));
}

async function listar() {
  const copies = await completeCopies();
  if (!copies.length) console.log('No hay copias completas en el depósito.');
  for (const c of copies) console.log(`${c.stamp}  ${c.total} documentos`);
}

async function descargar() {
  const stamp = process.argv[3];
  if (!stamp) die('Indique la copia a descargar (use "listar" para ver los nombres).');
  const [files] = await bucket.getFiles({ prefix: `${prefix}/${stamp}/` });
  if (!files.some(f => f.name.endsWith('/MANIFIESTO.json'))) die(`La copia ${stamp} no existe o está incompleta (sin manifiesto).`);
  const out = path.join('backups', stamp);
  fs.mkdirSync(out, { recursive: true });
  for (const file of files) {
    const [content] = await file.download();
    fs.writeFileSync(path.join(out, path.basename(file.name)), content);
  }
  console.log(`Copia descargada en ${out}. Compruébela con: node scripts/resguardo.mjs verificar ${out}`);
}

const command = process.argv[2] || 'exportar';
const commands = { exportar, listar, descargar };
if (!commands[command]) die('Comando desconocido. Use: exportar, listar o descargar.');
await commands[command]();
process.exit(0);
