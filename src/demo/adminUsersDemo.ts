/**
 * Administración de cuentas en la DEMO: hace en el navegador lo que en producción hace el servidor
 * (server/adminUsers.ts con firebase-admin). Mismas respuestas y mismas reglas de negocio.
 */
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getFirestore } from './firestoreShim';
import { demoAccounts } from './authShim';

const ADMIN_ROLES = ['SuperAdmin', 'Owner', 'Gerente', 'Admin'];
const ALL_ROLES = [...ADMIN_ROLES, 'Capataz', 'Empleado'];

type Ok<T> = { success: true } & T;
type Fail = { success: false; message: string };

const roleRef = (uid: string) => doc(getFirestore(), 'userRoles', uid);

function temporaryPassword(length = 12): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const out = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  return /[A-Za-z]/.test(out) && /\d/.test(out) ? out : temporaryPassword(length);
}

async function caller(): Promise<{ uid: string; role: string } | null> {
  const uid = demoAccounts.currentUid();
  if (!uid) return null;
  const snap = await getDoc(roleRef(uid));
  const data: any = snap.data();
  if (!data || data.active !== true || data.mustChangePassword === true || !ADMIN_ROLES.includes(data.role)) return null;
  return { uid, role: data.role };
}

async function target(authUid: string, me: { uid: string; role: string }): Promise<{ data: any } | Fail> {
  if (authUid === me.uid) return { success: false, message: 'No puede realizar esta operación sobre su propia cuenta.' };
  const data: any = (await getDoc(roleRef(authUid))).data();
  if (!data) return { success: false, message: 'La cuenta no existe.' };
  if (data.role === 'SuperAdmin' && me.role !== 'SuperAdmin') {
    return { success: false, message: 'Solo un SuperAdmin puede administrar a otro SuperAdmin.' };
  }
  return { data };
}

const denied: Fail = { success: false, message: 'No tiene permiso para administrar usuarios.' };

export async function createAccount(input: {
  email: string;
  displayName?: string;
  role?: string;
  active?: boolean;
}): Promise<Ok<{ authUid: string; temporaryPassword: string }> | Fail> {
  const me = await caller();
  if (!me) return denied;
  const email = (input.email || '').trim().toLowerCase();
  const role = input.role || 'Empleado';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, message: 'Ingrese un correo electrónico válido.' };
  if (!ALL_ROLES.includes(role)) return { success: false, message: 'Rol inválido.' };
  if (role === 'SuperAdmin' && me.role !== 'SuperAdmin') {
    return { success: false, message: 'Solo un SuperAdmin puede crear otro SuperAdmin.' };
  }
  const password = temporaryPassword();
  const created = demoAccounts.create(email, password);
  if ('error' in created) return { success: false, message: 'Ya existe una cuenta de acceso con este correo.' };
  const active = input.active !== false;
  if (!active) demoAccounts.setDisabled(created.uid, true);
  await setDoc(roleRef(created.uid), {
    role,
    email,
    active,
    mustChangePassword: true,
    createdBy: me.uid,
    createdAt: new Date().toISOString()
  });
  return { success: true, authUid: created.uid, temporaryPassword: password };
}

export async function resetPassword(authUid: string): Promise<Ok<{ temporaryPassword: string }> | Fail> {
  const me = await caller();
  if (!me) return denied;
  const t = await target(authUid, me);
  if ('success' in t) return t;
  const password = temporaryPassword();
  demoAccounts.setPassword(authUid, password);
  await updateDoc(roleRef(authUid), { mustChangePassword: true });
  return { success: true, temporaryPassword: password };
}

export async function setDisabled(authUid: string, disabled: boolean): Promise<Ok<{}> | Fail> {
  const me = await caller();
  if (!me) return denied;
  const t = await target(authUid, me);
  if ('success' in t) return t;
  demoAccounts.setDisabled(authUid, disabled);
  await updateDoc(roleRef(authUid), { active: !disabled });
  return { success: true };
}

export async function removeAccount(authUid: string): Promise<Ok<{}> | Fail> {
  const me = await caller();
  if (!me) return denied;
  const t = await target(authUid, me);
  if ('success' in t) return t;
  demoAccounts.remove(authUid);
  await deleteDoc(roleRef(authUid));
  return { success: true };
}

export async function changeOwnPassword(newPassword: string): Promise<Ok<{}> | Fail> {
  const uid = demoAccounts.currentUid();
  if (!uid) return { success: false, message: 'Se requiere iniciar sesión.' };
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { success: false, message: 'La contraseña debe tener al menos 8 caracteres, con letras y números.' };
  }
  demoAccounts.setPassword(uid, newPassword);
  await setDoc(roleRef(uid), { mustChangePassword: null, passwordChangedAt: new Date().toISOString() }, { merge: true });
  return { success: true };
}
