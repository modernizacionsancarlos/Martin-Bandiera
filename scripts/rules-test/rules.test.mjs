// Prueba de las reglas de Firestore (firestore.rules.next) contra el emulador.
// Ejecutar: npm install && npm test   (requiere Java).
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-bandiera',
  firestore: { rules: readFileSync('firestore.rules.test', 'utf8'), host: '127.0.0.1', port: 8089 }
});

const roles = { cap1: 'Capataz', cap2: 'Capataz', ger1: 'Gerente', adm1: 'Admin', emp1: 'Empleado', sup1: 'SuperAdmin' };

await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  for (const [uid, role] of Object.entries(roles)) await setDoc(doc(db, 'userRoles', uid), { role, email: `${uid}@x.test`, active: true });
  await setDoc(doc(db, 'userRoles', 'chg1'), { role: 'Admin', email: 'chg@x.test', active: true, mustChangePassword: true });
  await setDoc(doc(db, 'userRoles', 'off1'), { role: 'Capataz', email: 'off@x.test', active: false });
  await setDoc(doc(db, 'users', 'u-cap1'), { uid: 'u-cap1', authUid: 'cap1', email: 'cap1@x.test', hourlyRate: 9000 });
  await setDoc(doc(db, 'users', 'u-cap2'), { uid: 'u-cap2', authUid: 'cap2', email: 'cap2@x.test', hourlyRate: 9000 });
  await setDoc(doc(db, 'workers', 'w1'), { name: 'X', hourlyRate: 9000 });
  await setDoc(doc(db, 'auditRecords', 'a1'), { billedPrice: 1000 });
  await setDoc(doc(db, 'clients', 'c1'), { razonSocial: 'X', cuit: '30-1' });
  await setDoc(doc(db, 'materials', 'm1'), { name: 'X', unitPrice: 5 });
  await setDoc(doc(db, 'technicalParameters', 'global'), { horaBase: 1 });
  await setDoc(doc(db, 'financials', 'f1'), { cobrado: 1 });
  await setDoc(doc(db, 'archivedReceipts', 'r1'), { x: 1 });
  await setDoc(doc(db, 'systemSettings', 'status'), { isZeroState: false });
  await setDoc(doc(db, 'systemSettings', 'deleted_users'), { emails: ['a@b.c'] });
  await setDoc(doc(db, 'catalogoCampo', 'actual'), { clients: [], workers: [], materials: [] });
  await setDoc(doc(db, 'fieldReports', 'p-cap1'), { submittedByAuthUid: 'cap1', status: 'Pendiente' });
  await setDoc(doc(db, 'fieldReports', 'p-cap2'), { submittedByAuthUid: 'cap2', status: 'Pendiente' });
});

let failed = 0;
const check = async (name, promise) => {
  try {
    await promise;
    console.log('  ok  ', name);
  } catch (e) {
    failed++;
    console.log('  FALLA', name, '-', String(e.message).split('\n')[0]);
  }
};
const as = uid => env.authenticatedContext(uid).firestore();
const newPart = uid => ({ submittedByAuthUid: uid, status: 'Pendiente', description: 'x', clientName: 'c' });

console.log('Capataz (cap1)');
const cap = as('cap1');
await check('lee su rol', assertSucceeds(getDoc(doc(cap, 'userRoles', 'cap1'))));
await check('no lee el rol de otro', assertFails(getDoc(doc(cap, 'userRoles', 'cap2'))));
await check('lee su perfil con consulta propia', assertSucceeds(getDocs(query(collection(cap, 'users'), where('authUid', '==', 'cap1')))));
await check('no lista todos los usuarios', assertFails(getDocs(collection(cap, 'users'))));
await check('no lee perfil de otro', assertFails(getDoc(doc(cap, 'users', 'u-cap2'))));
for (const c of ['workers', 'auditRecords', 'clients', 'materials', 'technicalParameters', 'financials', 'archivedReceipts']) {
  await check(`no lee ${c}`, assertFails(getDocs(collection(cap, c))));
}
await check('lee el catálogo de campo', assertSucceeds(getDoc(doc(cap, 'catalogoCampo', 'actual'))));
await check('no escribe el catálogo', assertFails(setDoc(doc(cap, 'catalogoCampo', 'actual'), { clients: [] })));
await check('lee systemSettings/status', assertSucceeds(getDoc(doc(cap, 'systemSettings', 'status'))));
await check('no lee deleted_users', assertFails(getDoc(doc(cap, 'systemSettings', 'deleted_users'))));
await check('lee solo sus partes (consulta filtrada)', assertSucceeds(getDocs(query(collection(cap, 'fieldReports'), where('submittedByAuthUid', '==', 'cap1')))));
await check('no lista todos los partes', assertFails(getDocs(collection(cap, 'fieldReports'))));
await check('no lee el parte de otro', assertFails(getDoc(doc(cap, 'fieldReports', 'p-cap2'))));
await check('crea un parte a su nombre', assertSucceeds(setDoc(doc(cap, 'fieldReports', 'nuevo1'), newPart('cap1'))));
await check('no crea un parte a nombre de otro', assertFails(setDoc(doc(cap, 'fieldReports', 'nuevo2'), newPart('cap2'))));
await check('no crea un parte ya Convertido', assertFails(setDoc(doc(cap, 'fieldReports', 'nuevo3'), { ...newPart('cap1'), status: 'Convertido' })));
await check('no crea un parte con precio', assertFails(setDoc(doc(cap, 'fieldReports', 'nuevo4'), { ...newPart('cap1'), billedPrice: 5 })));
await check('no modifica su parte', assertFails(updateDoc(doc(cap, 'fieldReports', 'p-cap1'), { status: 'Convertido' })));
await check('no borra su parte', assertFails(deleteDoc(doc(cap, 'fieldReports', 'p-cap1'))));
await check('no crea remitos', assertFails(setDoc(doc(cap, 'auditRecords', 'zz'), { billedPrice: 1 })));
await check('no escribe materiales', assertFails(setDoc(doc(cap, 'materials', 'zz'), { name: 'x' })));
await check('no se da un rol', assertFails(setDoc(doc(cap, 'userRoles', 'cap1'), { role: 'SuperAdmin', email: 'x', active: true })));

console.log('Cuenta desactivada');
await check('no lee nada', assertFails(getDoc(doc(as('off1'), 'catalogoCampo', 'actual'))));
console.log('Clave temporal pendiente (chg1, rol Admin)');
await check('puede leer su propio rol', assertSucceeds(getDoc(doc(as('chg1'), 'userRoles', 'chg1'))));
await check('no lee datos', assertFails(getDocs(collection(as('chg1'), 'auditRecords'))));
await check('no escribe datos', assertFails(setDoc(doc(as('chg1'), 'auditRecords', 'zz'), { billedPrice: 1 })));
await check('no se quita la marca', assertFails(updateDoc(doc(as('chg1'), 'userRoles', 'chg1'), { mustChangePassword: false })));
console.log('Sin sesión');
await check('no lee nada', assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'catalogoCampo', 'actual'))));

console.log('Gerente (ger1)');
const ger = as('ger1');
for (const c of ['workers', 'auditRecords', 'clients', 'materials', 'technicalParameters', 'financials', 'archivedReceipts', 'users', 'fieldReports']) {
  await check(`lee ${c}`, assertSucceeds(getDocs(collection(ger, c))));
}
await check('convierte un parte', assertSucceeds(updateDoc(doc(ger, 'fieldReports', 'p-cap1'), { status: 'Convertido', remitoId: '#1' })));
await check('crea un remito', assertSucceeds(setDoc(doc(ger, 'auditRecords', 'n1'), { billedPrice: 1 })));
await check('escribe el catálogo', assertSucceeds(setDoc(doc(ger, 'catalogoCampo', 'actual'), { clients: [], workers: [], materials: [] })));
await check('no crea usuario con contraseña', assertFails(setDoc(doc(ger, 'users', 'u-x'), { uid: 'u-x', password: '123' })));

console.log('Empleado (emp1)');
const emp = as('emp1');
await check('lee remitos', assertSucceeds(getDocs(collection(emp, 'auditRecords'))));
await check('no lee finanzas', assertFails(getDocs(collection(emp, 'financials'))));
await check('no convierte partes', assertFails(updateDoc(doc(emp, 'fieldReports', 'p-cap2'), { status: 'Convertido' })));

await env.cleanup();
console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);
