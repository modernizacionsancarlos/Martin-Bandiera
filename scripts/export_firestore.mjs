// Exporta todas las colecciones de Firestore a backups/<fecha>/<coleccion>.json
// Uso: node scripts/export_firestore.mjs
// Las reglas deben permitir lectura (antes del cierre de reglas).
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const COLLECTIONS = [
  'users', 'workers', 'auditRecords', 'clients', 'materials', 'systemSettings',
  'financials', 'technicalParameters', 'archivedReceipts', 'projects',
  'maintenanceServices', 'vehicles', 'vehicleEvents'
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join('backups', stamp);
fs.mkdirSync(outDir, { recursive: true });

let failed = false;
for (const name of COLLECTIONS) {
  try {
    const snap = await getDocs(collection(db, name));
    const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
    console.log(`${name}: ${docs.length} documentos`);
  } catch (err) {
    failed = true;
    console.error(`${name}: ERROR ${err.message}`);
  }
}
console.log(failed ? 'Export con errores.' : `Export completo en ${outDir}`);
process.exit(failed ? 1 : 0);
