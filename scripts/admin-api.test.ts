// Prueba de integración de server/adminUsers.ts contra los emuladores de Auth y Firestore.
// Ejecutar desde scripts/rules-test:  npm run test:admin   (requiere Java).
import express from 'express';
import type { AddressInfo } from 'node:net';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createAdminUsersRouter } from '../server/adminUsers';

const PROJECT = 'demo-bandiera';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST!;

const app = express();
app.use('/api/admin', createAdminUsersRouter({ projectId: PROJECT }));
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin`;

const admin = getApps()[0] ?? initializeApp({ projectId: PROJECT });
const auth = getAuth(admin);
const db = getFirestore(admin);

async function signIn(email: string, password: string): Promise<{ token?: string; error?: string }> {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data: any = await res.json();
  return res.ok ? { token: data.idToken } : { error: data?.error?.message };
}

async function seed(email: string, role: string, extra: Record<string, unknown> = {}) {
  const u = await auth.createUser({ email, password: 'Seed1234pass' });
  await db.collection('userRoles').doc(u.uid).set({ role, email, active: true, ...extra });
  const { token } = await signIn(email, 'Seed1234pass');
  return { uid: u.uid, token: token! };
}

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: res.status, body: (await res.json()) as any };
}

let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(ok ? '  ok   ' : '  FALLA', name, ok ? '' : detail);
};

const adm = await seed('admin@x.test', 'Admin');
const sup = await seed('super@x.test', 'SuperAdmin');
const cap = await seed('capataz@x.test', 'Capataz');

console.log('Acceso');
expect('sin token: 401', (await call('POST', '/users', null, { email: 'a@b.co' })).status === 401);
expect('token inválido: 401', (await call('POST', '/users', 'basura', { email: 'a@b.co' })).status === 401);
expect('capataz no administra usuarios: 403', (await call('POST', '/users', cap.token, { email: 'a@b.co' })).status === 403);

console.log('Alta');
expect('correo inválido: 400', (await call('POST', '/users', adm.token, { email: 'sin-arroba', role: 'Capataz' })).status === 400);
expect('rol inválido: 400', (await call('POST', '/users', adm.token, { email: 'z@x.test', role: 'Dios' })).status === 400);
expect('Admin no crea SuperAdmin: 403', (await call('POST', '/users', adm.token, { email: 'z@x.test', role: 'SuperAdmin' })).status === 403);
const created = await call('POST', '/users', adm.token, { email: 'Nuevo@X.test', displayName: 'Nuevo Capataz', role: 'Capataz' });
expect('alta correcta devuelve clave temporal', created.status === 200 && created.body.temporaryPassword?.length >= 12, JSON.stringify(created.body));
const newUid: string = created.body.authUid;
const roleDoc = (await db.collection('userRoles').doc(newUid).get()).data()!;
expect('rol guardado con cambio de clave pendiente', roleDoc.role === 'Capataz' && roleDoc.mustChangePassword === true && roleDoc.active === true);
expect('correo guardado en minúsculas', roleDoc.email === 'nuevo@x.test');
expect('correo repetido: 409', (await call('POST', '/users', adm.token, { email: 'nuevo@x.test', role: 'Empleado' })).status === 409);
const first = await signIn('nuevo@x.test', created.body.temporaryPassword);
expect('puede ingresar con la clave temporal', Boolean(first.token), first.error);

console.log('Cambio de clave obligatorio');
expect('con cambio pendiente no administra usuarios: 403', (await call('POST', '/users', first.token!, { email: 'q@x.test', role: 'Empleado' })).status === 403);
expect('clave débil: 400', (await call('POST', '/me/change-password', first.token!, { newPassword: 'corta1' })).status === 400);
expect('clave sin números: 400', (await call('POST', '/me/change-password', first.token!, { newPassword: 'soloLetrasLargas' })).status === 400);
expect('sin token: 401', (await call('POST', '/me/change-password', null, { newPassword: 'Buena12345' })).status === 401);
expect('clave válida: 200', (await call('POST', '/me/change-password', first.token!, { newPassword: 'ClavePropia2026' })).status === 200);
expect('se quita la marca de cambio pendiente', (await db.collection('userRoles').doc(newUid).get()).data()!.mustChangePassword === undefined);
expect('la clave temporal ya no sirve', Boolean((await signIn('nuevo@x.test', created.body.temporaryPassword)).error));
expect('la clave nueva sirve', Boolean((await signIn('nuevo@x.test', 'ClavePropia2026')).token));

console.log('Restablecer clave');
expect('no sobre su propia cuenta: 400', (await call('POST', `/users/${adm.uid}/reset-password`, adm.token)).status === 400);
expect('Admin no toca a un SuperAdmin: 403', (await call('POST', `/users/${sup.uid}/reset-password`, adm.token)).status === 403);
expect('cuenta inexistente: 404', (await call('POST', '/users/noexiste/reset-password', adm.token)).status === 404);
const reset = await call('POST', `/users/${newUid}/reset-password`, adm.token);
expect('devuelve una clave temporal nueva', reset.status === 200 && reset.body.temporaryPassword?.length >= 12);
expect('la clave propia dejó de servir', Boolean((await signIn('nuevo@x.test', 'ClavePropia2026')).error));
expect('la temporal nueva sirve', Boolean((await signIn('nuevo@x.test', reset.body.temporaryPassword)).token));
expect('vuelve a quedar el cambio pendiente', (await db.collection('userRoles').doc(newUid).get()).data()!.mustChangePassword === true);
expect('SuperAdmin sí puede restablecer a un Admin', (await call('POST', `/users/${adm.uid}/reset-password`, sup.token)).status === 200);

console.log('Deshabilitar');
expect('deshabilita: 200', (await call('POST', `/users/${newUid}/disabled`, sup.token, { disabled: true })).status === 200);
expect('no puede ingresar', Boolean((await signIn('nuevo@x.test', reset.body.temporaryPassword)).error));
expect('rol inactivo', (await db.collection('userRoles').doc(newUid).get()).data()!.active === false);
expect('rehabilita: 200', (await call('POST', `/users/${newUid}/disabled`, sup.token, { disabled: false })).status === 200);
expect('rol activo otra vez', (await db.collection('userRoles').doc(newUid).get()).data()!.active === true);

console.log('Baja');
expect('no puede eliminarse a sí mismo: 400', (await call('DELETE', `/users/${sup.uid}`, sup.token)).status === 400);
const admAgain = (await signIn('admin@x.test', 'Seed1234pass')).token;
expect('Admin no elimina a un SuperAdmin: 403', admAgain === undefined || (await call('DELETE', `/users/${sup.uid}`, admAgain)).status === 403);
expect('elimina la cuenta: 200', (await call('DELETE', `/users/${newUid}`, sup.token)).status === 200);
expect('la cuenta de acceso ya no existe', await auth.getUser(newUid).then(() => false, () => true));
expect('el rol ya no existe', !(await db.collection('userRoles').doc(newUid).get()).exists);

server.close();
console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);
