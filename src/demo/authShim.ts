/**
 * Sustituto local de 'firebase/auth' para el MODO DEMO.
 * Las cuentas viven solo en el navegador de la demo y no existe ninguna conexión con Firebase.
 */
import { DEMO_ACCOUNTS } from './demoSeed';

const ACCOUNTS_KEY = 'bandiera_demo_accounts_v1';
const SESSION_KEY = 'bandiera_demo_session_v1';

export interface User {
  uid: string;
  email: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

type Account = { uid: string; email: string; password: string; disabled?: boolean };

function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEMO_ACCOUNTS.map(a => ({ uid: a.authUid, email: a.email, password: a.password }));
}

let accounts: Account[] = loadAccounts();

function saveAccounts() {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

function toUser(account: Account): User {
  return {
    uid: account.uid,
    email: account.email,
    getIdToken: async () => `demo-token-${account.uid}`
  };
}

function authError(code: string) {
  const err: any = new Error(code);
  err.code = code;
  return err;
}

// ---------------------------------------------------------------- estado de sesión
interface DemoAuth {
  currentUser: User | null;
}
const authState: DemoAuth = { currentUser: null };
const observers = new Set<(user: User | null) => void>();

function restoreSession() {
  try {
    const uid = sessionStorage.getItem(SESSION_KEY);
    const found = uid ? accounts.find(a => a.uid === uid) : undefined;
    authState.currentUser = found ? toUser(found) : null;
  } catch {
    authState.currentUser = null;
  }
}
restoreSession();

function setSession(account: Account | null) {
  authState.currentUser = account ? toUser(account) : null;
  try {
    if (account) sessionStorage.setItem(SESSION_KEY, account.uid);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  observers.forEach(cb => cb(authState.currentUser));
}

// ---------------------------------------------------------------- API compatible
// Las apps secundarias (usadas para crear cuentas sin cerrar la sesión del administrador)
// reciben un objeto de autenticación propio: iniciar o cerrar sesión allí no afecta a la principal.
const secondaryAuths = new Map<string, any>();

export function getAuth(app?: any) {
  const name = app?.name;
  if (!name || name === '[DEFAULT]') return authState as any;
  if (!secondaryAuths.has(name)) secondaryAuths.set(name, { currentUser: null, __secondary: true });
  return secondaryAuths.get(name);
}

export function onAuthStateChanged(_auth: any, callback: (user: User | null) => void) {
  observers.add(callback);
  Promise.resolve().then(() => {
    if (observers.has(callback)) callback(authState.currentUser);
  });
  return () => {
    observers.delete(callback);
  };
}

export async function signInWithEmailAndPassword(_auth: any, email: string, password: string) {
  const clean = (email || '').trim().toLowerCase();
  const found = accounts.find(a => a.email === clean);
  if (!found || found.password !== password) throw authError('auth/invalid-credential');
  if (found.disabled) throw authError('auth/user-disabled');
  setSession(found);
  return { user: toUser(found) };
}

export async function createUserWithEmailAndPassword(_auth: any, email: string, password: string) {
  const clean = (email || '').trim().toLowerCase();
  if (accounts.some(a => a.email === clean)) throw authError('auth/email-already-in-use');
  if ((password || '').length < 6) throw authError('auth/weak-password');
  const account: Account = {
    uid: `demo_auth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: clean,
    password
  };
  accounts = [...accounts, account];
  saveAccounts();
  // Igual que Firebase, la cuenta recién creada inicia sesión en la instancia usada.
  // El sistema usa una instancia secundaria para no desplazar al administrador: aquí se mantiene la sesión actual.
  return { user: toUser(account) };
}

export async function sendPasswordResetEmail(_auth: any, _email: string) {
  // En la demo no se envía ningún correo.
}

export async function signOut(auth?: any) {
  if (auth && auth.__secondary) return;
  setSession(null);
}

// ---------------------------------------------------------------- administración de cuentas (solo demo)
// Hace en el navegador lo que en producción hace el servidor con firebase-admin.
export const demoAccounts = {
  create(email: string, password: string): { uid: string } | { error: 'exists' } {
    const clean = email.trim().toLowerCase();
    if (accounts.some(a => a.email === clean)) return { error: 'exists' };
    const account: Account = { uid: `demo_auth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, email: clean, password };
    accounts = [...accounts, account];
    saveAccounts();
    return { uid: account.uid };
  },
  setPassword(uid: string, password: string) {
    accounts = accounts.map(a => (a.uid === uid ? { ...a, password } : a));
    saveAccounts();
  },
  setDisabled(uid: string, disabled: boolean) {
    accounts = accounts.map(a => (a.uid === uid ? { ...a, disabled } : a));
    saveAccounts();
  },
  remove(uid: string) {
    accounts = accounts.filter(a => a.uid !== uid);
    saveAccounts();
  },
  emailOf(uid: string): string | undefined {
    return accounts.find(a => a.uid === uid)?.email;
  },
  currentUid(): string | undefined {
    return authState.currentUser?.uid;
  }
};
