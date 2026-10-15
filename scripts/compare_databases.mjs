// Compara, en SOLO LECTURA, dos bases de Firestore (por ejemplo la actual y la de un proyecto anterior).
// Imprime únicamente cantidades: por colección, cuántos documentos hay en cada base, cuántos existen
// solo en una, y cuántos existen en ambas con contenido distinto. No imprime datos de clientes.
//
// Uso:
//   node scripts/compare_databases.mjs --other=ruta/config-anterior.json [--save-other=ruta/salida.json]
// "config-anterior.json" tiene el mismo formato que firebase-applet-config.json.
// Con --save-other guarda además una copia de los documentos de la base anterior (archivo local).
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as crypto from 'crypto';

const args = process.argv.slice(2);
const argValue = name => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const otherPath = argValue('other');
if (!otherPath) {
  console.error('Falta --other=<config de la base a comparar>.');
  process.exit(1);
}

const currentConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const otherConfig = JSON.parse(fs.readFileSync(otherPath, 'utf8'));

const open = (config, name) => {
  const app = initializeApp(config, name);
  return getFirestore(app, config.firestoreDatabaseId || '(default)');
};
const currentDb = open(currentConfig, 'current');
const otherDb = open(otherConfig, 'other');

const COLLECTIONS = [
  'users', 'workers', 'auditRecords', 'clients', 'materials', 'systemSettings', 'financials',
  'technicalParameters', 'archivedReceipts', 'projects', 'maintenanceServices', 'vehicles', 'vehicleEvents'
];

const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  }
  return value;
};
const hash = data => crypto.createHash('sha1').update(JSON.stringify(stable(data))).digest('hex');

async function load(db, name) {
  try {
    const snap = await getDocs(collection(db, name));
    return new Map(snap.docs.map(d => [d.id, d.data()]));
  } catch (err) {
    return { error: err.code || err.message };
  }
}

const saved = {};
console.log(
  `Actual: ${currentConfig.projectId} / ${currentConfig.firestoreDatabaseId}\n` +
    `Otra:   ${otherConfig.projectId} / ${otherConfig.firestoreDatabaseId}\n`
);
console.log('colección'.padEnd(22), 'actual'.padStart(7), 'otra'.padStart(7), 'solo-otra'.padStart(10), 'solo-actual'.padStart(12), 'distintos'.padStart(10));

for (const name of COLLECTIONS) {
  const [cur, oth] = await Promise.all([load(currentDb, name), load(otherDb, name)]);
  if (cur.error || oth.error) {
    console.log(name.padEnd(22), `error actual=${cur.error || 'ok'} otra=${oth.error || 'ok'}`);
    continue;
  }
  let onlyOther = 0;
  let onlyCurrent = 0;
  let different = 0;
  for (const [id, data] of oth) {
    if (!cur.has(id)) onlyOther++;
    else if (hash(cur.get(id)) !== hash(data)) different++;
  }
  for (const id of cur.keys()) if (!oth.has(id)) onlyCurrent++;
  console.log(
    name.padEnd(22),
    String(cur.size).padStart(7),
    String(oth.size).padStart(7),
    String(onlyOther).padStart(10),
    String(onlyCurrent).padStart(12),
    String(different).padStart(10)
  );
  saved[name] = Object.fromEntries(oth);
}

if (argValue('save-other')) {
  fs.writeFileSync(argValue('save-other'), JSON.stringify(saved, null, 2));
  console.log(`\nCopia de la base anterior guardada en ${argValue('save-other')}`);
}
process.exit(0);
