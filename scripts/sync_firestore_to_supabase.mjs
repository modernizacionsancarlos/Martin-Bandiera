// Brings what was loaded in Firestore (old AI Studio site) into Supabase.
// Without --apply it only compares and writes nothing. Firestore is never written.
// Usage: node scripts/sync_firestore_to_supabase.mjs [--apply]
//
// Rules:
// - Document only in Firestore: added.
// - Document in both: Firestore fields win, fields only Supabase has are kept (merge).
// - Remitos loaded from the phone (origenCampo): never touched.
// - users and workers: only new ones are added, so logins and permissions stay.
// - Pasado remitos: the old 7% is removed, the new rule adds it only when invoicing.
// - Document only in Supabase: kept.
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import readline from 'readline';

const APPLY = process.argv.includes('--apply');
const COLLECTIONS = [
  'users', 'workers', 'auditRecords', 'clients', 'materials', 'systemSettings',
  'financials', 'technicalParameters', 'archivedReceipts', 'projects',
  'maintenanceServices', 'vehicles', 'vehicleEvents'
];
const ADD_ONLY = new Set(['users', 'workers']);
const OUT_DIR = './.sync-backup';

const env = Object.fromEntries(
  fs.readFileSync('./.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
  })
);

function ask(question, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise(resolve => {
    if (hidden) rl._writeToOutput = text => { if (text.includes(question)) process.stdout.write(text); };
    rl.question(question, answer => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'password').map(([k, v]) => [k, clean(v)]));
  }
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

async function readSupabase(supabase, name) {
  const rows = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('documents').select('id, data').eq('collection', name).order('id').range(from, from + 999);
    if (error) throw new Error(`${name}: ${error.message}`);
    data.forEach(r => rows.set(r.id, r.data));
    if (data.length < 1000) return rows;
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const fsDb = getFirestore(initializeApp(config), config.firestoreDatabaseId);
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

  const email = await ask('Correo SuperAdmin: ');
  const password = await ask('Clave: ', true);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`No se pudo entrar: ${authError.message}`);

  const report = { apply: APPLY, collections: {}, statusChanges: [], fieldSkipped: [], supabaseOnly: {}, duplicateRemitos: [] };
  const toWrite = [];
  const backup = [];
  const finalRemitos = new Map();

  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(fsDb, name));
    const current = await readSupabase(supabase, name);
    const summary = { firestore: snap.size, supabase: current.size, nuevos: 0, cambiados: 0, iguales: 0, sinTocar: 0 };
    const seen = new Set();

    for (const d of snap.docs) {
      seen.add(d.id);
      const incoming = clean(d.data());
      const existing = current.get(d.id);
      if (name === 'auditRecords' && incoming.status === 'Pasado' && Number(incoming.billedPrice) > 0) {
        incoming.billedPrice = Math.round(incoming.billedPrice / 1.07);
      }
      if (!existing) {
        summary.nuevos++;
        // Firestore remitos keep their number; the database would renumber a repeated one otherwise.
        toWrite.push({ collection: name, id: d.id, data: name === 'auditRecords' ? { ...incoming, keepRemitoNumber: true } : incoming });
        continue;
      }
      if (ADD_ONLY.has(name) || existing.origenCampo) {
        summary.sinTocar++;
        if (existing.origenCampo) report.fieldSkipped.push(existing.remitoId);
        continue;
      }
      const differs = Object.keys(incoming).some(k => stable(incoming[k]) !== stable(existing[k]));
      if (!differs) {
        summary.iguales++;
        continue;
      }
      summary.cambiados++;
      toWrite.push({ collection: name, id: d.id, data: incoming });
      backup.push({ collection: name, id: d.id, data: existing });
      if (name === 'auditRecords' && incoming.status !== existing.status) {
        report.statusChanges.push(`${incoming.remitoId} ${incoming.clientName}: ${existing.status} -> ${incoming.status} ${incoming.numeroFactura || ''}`.trim());
      }
    }

    const only = [...current.keys()].filter(id => !seen.has(id));
    if (only.length) report.supabaseOnly[name] = only.length;
    report.collections[name] = summary;

    if (name === 'auditRecords') {
      const all = new Map(current);
      toWrite.filter(r => r.collection === name).forEach(r => all.set(r.id, { ...all.get(r.id), ...r.data }));
      for (const [id, data] of all) {
        const key = data.remitoId;
        if (key && finalRemitos.has(key)) report.duplicateRemitos.push(`${key} (${finalRemitos.get(key)} / ${id})`);
        else if (key) finalRemitos.set(key, id);
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(`${OUT_DIR}/reporte-${stamp}.json`, JSON.stringify(report, null, 2));

  console.table(report.collections);
  console.log(`Cambios de estado en remitos: ${report.statusChanges.length}`);
  report.statusChanges.slice(0, 10).forEach(l => console.log(`  ${l}`));
  console.log(`Remitos del celular sin tocar: ${report.fieldSkipped.length}`);
  console.log('Solo en Supabase (se conservan):', report.supabaseOnly);
  console.log(`Numeros de remito repetidos: ${report.duplicateRemitos.length}`);
  report.duplicateRemitos.slice(0, 10).forEach(l => console.log(`  ${l}`));
  console.log(`Detalle: ${OUT_DIR}/reporte-${stamp}.json`);

  if (!APPLY) {
    console.log(`\nSOLO COMPARACION: no se escribio nada. Se aplicarian ${toWrite.length} documentos.`);
    process.exit(0);
  }

  fs.writeFileSync(`${OUT_DIR}/respaldo-${stamp}.json`, JSON.stringify(backup));
  for (let i = 0; i < toWrite.length; i += 100) {
    const { error } = await supabase.rpc('merge_documents', { p_rows: toWrite.slice(i, i + 100) });
    if (error) throw new Error(`Fallo al escribir, ya aplicados ${i}: ${error.message}`);
  }
  console.log(`\nAPLICADO: ${toWrite.length} documentos. Respaldo: ${OUT_DIR}/respaldo-${stamp}.json`);
  process.exit(0);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
