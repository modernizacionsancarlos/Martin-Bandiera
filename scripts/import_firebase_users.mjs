// Copies the accounts of the old system (Firestore users) into Supabase.
// Without --apply it only lists what would happen. Passwords are never printed or saved to disk,
// and each imported account must change its password on first login.
// Usage: node scripts/import_firebase_users.mjs [--apply]
//
// Rules:
// - Account that already exists in Supabase: not touched.
// - Role and permissions come from Firestore.
// - Capataz and Empleado keep createRemito on: the app needs it to load remitos.
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import readline from 'readline';

const APPLY = process.argv.includes('--apply');
const ROLES = new Set(['SuperAdmin', 'Owner', 'Gerente', 'Admin', 'Capataz', 'Empleado']);
// Accounts that must not be created in the new system.
const EXCLUDED = new Set(['valenkoreinmolina@gmail.com']);

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

async function main() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const fsDb = getFirestore(initializeApp(config), config.firestoreDatabaseId);
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

  const email = await ask('Correo SuperAdmin: ');
  const password = await ask('Clave: ', true);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`No se pudo entrar: ${authError.message}`);

  const { data: existing, error: rolesError } = await supabase.from('app_roles').select('email');
  if (rolesError) throw new Error(rolesError.message);
  const known = new Set(existing.map(r => r.email.toLowerCase()));

  const snap = await getDocs(collection(fsDb, 'users'));
  const rows = [];
  let created = 0;
  let failed = 0;

  for (const d of snap.docs) {
    const u = d.data();
    const userEmail = (u.email || '').trim().toLowerCase();
    const row = { perfil: d.id, correo: userEmail, rol: u.role, accion: '' };
    rows.push(row);

    if (EXCLUDED.has(userEmail)) {
      row.accion = 'EXCLUIDO, no se crea';
      continue;
    }
    if (known.has(userEmail)) {
      row.accion = 'ya existe, no se toca';
      continue;
    }
    if (!userEmail.includes('@') || !ROLES.has(u.role) || !u.password) {
      row.accion = 'OMITIDO: falta correo, rol o clave';
      continue;
    }
    row.accion = APPLY ? 'creado' : 'se crearia';
    if (!APPLY) continue;

    const { error } = await supabase.rpc('admin_import_account', {
      p_email: userEmail,
      p_password: u.password,
      p_role: u.role,
      p_profile_uid: d.id
    });
    if (error) {
      row.accion = `ERROR: ${error.message}`;
      failed++;
      continue;
    }
    const fieldRole = u.role === 'Capataz' || u.role === 'Empleado';
    const customPermissions = u.customPermissions || fieldRole
      ? { ...(u.customPermissions || {}), ...(fieldRole ? { createRemito: true } : {}) }
      : undefined;
    const patch = { role: u.role, active: u.active !== false, ...(customPermissions ? { customPermissions } : {}) };
    const { error: profileError } = await supabase.rpc('merge_documents', {
      p_rows: [{ collection: 'users', id: d.id, data: patch }]
    });
    if (profileError) row.accion = `creado, permisos con ERROR: ${profileError.message}`;
    created++;
  }

  console.table(rows);
  console.log(APPLY ? `APLICADO: ${created} cuentas creadas, ${failed} con error.` : 'SOLO COMPARACION: no se creo ninguna cuenta.');
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
