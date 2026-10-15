// Migra los usuarios existentes de Firestore a cuentas de Firebase Auth.
//
// Por cada documento de /users con correo:
//   1. Crea (o reutiliza) la cuenta de Firebase Auth con una contraseña temporal aleatoria.
//   2. Crea /userRoles/{authUid} con el rol y el estado activo.
//   3. Agrega el campo authUid al perfil. No borra ni modifica ningún otro dato.
//
// El campo `password` de los perfiles solo se elimina si se pasa --strip-passwords. Hágalo
// recién cuando la versión nueva de la app esté en producción: la versión anterior todavía
// lo necesita para iniciar sesión.
//
// Opciones:
//   --key=<ruta>        JSON de la cuenta de servicio (o variable GOOGLE_APPLICATION_CREDENTIALS)
//   --only=<correo>     Procesa solo ese usuario (útil para crear primero un administrador)
//   --apply             Escribe los cambios. Sin esta opción es una simulación.
//   --strip-passwords   Con --apply, elimina `password` de los perfiles procesados
//
// Ejemplos:
//   node scripts/migrate_to_firebase_auth.mjs --key=C:/claves/servicio.json --only=admin@admin.com
//   node scripts/migrate_to_firebase_auth.mjs --key=C:/claves/servicio.json --only=admin@admin.com --apply
//   node scripts/migrate_to_firebase_auth.mjs --key=C:/claves/servicio.json --apply
//
// Las contraseñas temporales solo se escriben en backups/credenciales_<fecha>.csv (ignorado por git).
// No se imprimen en consola.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const argValue = name => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const apply = args.includes('--apply');
const stripPasswords = args.includes('--strip-passwords');
const onlyEmail = (argValue('only') || '').trim().toLowerCase();
if (argValue('key')) process.env.GOOGLE_APPLICATION_CREDENTIALS = argValue('key');
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Falta la clave de servicio: use --key=<ruta> o la variable GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const auth = getAuth();
const db = getFirestore(config.firestoreDatabaseId);

function temporaryPassword(length = 12) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(length), b => alphabet[b % alphabet.length]).join('');
}

// Los usuarios "eliminados" desde la app solo quedan marcados en systemSettings/deleted_users y su
// documento sigue en /users. No se les crea cuenta de acceso.
const normalizeName = name =>
  (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const tombstoneDoc = await db.collection('systemSettings').doc('deleted_users').get();
const tombstone = tombstoneDoc.exists ? tombstoneDoc.data() : {};
const deletedUids = new Set(tombstone.uids || []);
const deletedEmails = new Set((tombstone.emails || []).map(e => String(e).toLowerCase().trim()));
const deletedNames = new Set((tombstone.names || []).map(normalizeName));

const snap = await db.collection('users').get();
console.log(
  `${snap.size} perfiles en /users. Modo: ${apply ? 'APLICAR' : 'SIMULACIÓN'}` +
    `${onlyEmail ? `, solo ${onlyEmail}` : ''}${stripPasswords ? ', quitando contraseñas' : ''}`
);

const created = [];
let reused = 0;
let skipped = 0;

for (const docSnap of snap.docs) {
  const profile = docSnap.data();
  const email = (profile.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.log(`- ${docSnap.id}: sin correo válido, se omite`);
    skipped++;
    continue;
  }
  if (onlyEmail && email !== onlyEmail) continue;
  const active = profile.active !== false;
  const role = profile.role || 'Empleado';
  if (
    deletedUids.has(docSnap.id) ||
    deletedEmails.has(email) ||
    deletedNames.has(normalizeName(profile.displayName))
  ) {
    console.log(`- ${email}: marcado como eliminado en la app (${role}), se omite`);
    skipped++;
    continue;
  }

  let authUid;
  try {
    const existing = await auth.getUserByEmail(email);
    authUid = existing.uid;
    reused++;
    console.log(`- ${email}: cuenta existente (${role}${active ? '' : ', inactivo'})`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const password = temporaryPassword();
    console.log(`- ${email}: se crea cuenta (${role}${active ? '' : ', inactivo'})`);
    if (apply) {
      const record = await auth.createUser({
        email,
        password,
        displayName: profile.displayName || email,
        disabled: !active
      });
      authUid = record.uid;
    }
    created.push({ email, password, role });
  }

  if (apply && authUid) {
    await db.collection('userRoles').doc(authUid).set({ role, email, active }, { merge: true });
    await docSnap.ref.set(
      stripPasswords ? { authUid, password: FieldValue.delete() } : { authUid },
      { merge: true }
    );
  }
}

console.log(`Resumen: ${created.length} cuentas nuevas, ${reused} existentes, ${skipped} omitidas.`);

if (apply && created.length > 0) {
  fs.mkdirSync('backups', { recursive: true });
  const file = path.join('backups', `credenciales_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
  const lines = ['correo,rol,contrasena_temporal', ...created.map(c => `${c.email},${c.role},${c.password}`)];
  fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 });
  console.log(`Contraseñas temporales guardadas en ${file}. Entréguelas y bórrelo.`);
}
if (onlyEmail && created.length + reused === 0) {
  console.log(`No se encontró ningún perfil con el correo ${onlyEmail} en /users.`);
}
if (!apply) console.log('Simulación terminada. Ejecute con --apply para escribir.');
