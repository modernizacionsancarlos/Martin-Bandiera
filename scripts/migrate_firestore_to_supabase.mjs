// One-shot migration: copies every Firestore collection into Supabase `documents`.
// Usage: SUPABASE_URL=... SUPABASE_KEY=... MIGRATION_EMAIL=... MIGRATION_PASSWORD=... node scripts/migrate_firestore_to_supabase.mjs
// Read-only on Firestore. Upserts on Supabase, so it can be re-run safely.
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const COLLECTIONS = [
  'users', 'workers', 'auditRecords', 'clients', 'materials', 'systemSettings',
  'financials', 'technicalParameters', 'archivedReceipts', 'projects',
  'maintenanceServices', 'vehicles', 'vehicleEvents'
];

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const fsDb = getFirestore(initializeApp(config), config.firestoreDatabaseId);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: { persistSession: false }
});

function stripPasswords(value) {
  if (Array.isArray(value)) return value.map(stripPasswords);
  if (value && typeof value === 'object') {
    // Firestore Timestamp -> ISO string
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'password') continue;
      out[k] = stripPasswords(v);
    }
    return out;
  }
  return value;
}

async function main() {
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.MIGRATION_EMAIL,
    password: process.env.MIGRATION_PASSWORD
  });
  if (authError) throw authError;

  const summary = {};
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(fsDb, name));
    const rows = snap.docs.map(d => ({ collection: name, id: d.id, data: stripPasswords(d.data()) }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('documents').upsert(rows.slice(i, i + 200), { onConflict: 'collection,id' });
      if (error) throw new Error(`${name}: ${error.message}`);
    }
    summary[name] = rows.length;
    console.log(`${name}: ${rows.length}`);
  }
  fs.writeFileSync('./scripts/migration_summary.json', JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
