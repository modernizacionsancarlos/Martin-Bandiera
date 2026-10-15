import { deleteApp, getApp, initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export type { FirebaseUser };

// Correos alternativos conocidos: el usuario puede escribir su alias y se resuelve al correo real.
// Las cuentas de Firebase Auth se identifican solo por correo.
const LOGIN_ALIASES: Record<string, string> = {
  'gaston@bandiera.com': 'gastonvillalobos2019@gmail.com',
  'gaston': 'gastonvillalobos2019@gmail.com',
  'romina@bandiera.com': 'rominabromeo@yahoo.com.ar',
  'romina': 'rominabromeo@yahoo.com.ar',
  'admin@bandiera.com': 'martin@iipsa.com.ar',
  'martin': 'martin@iipsa.com.ar'
};

export function resolveLoginEmail(identifier: string): string | null {
  const clean = (identifier || '').trim().toLowerCase();
  if (!clean) return null;
  if (LOGIN_ALIASES[clean]) return LOGIN_ALIASES[clean];
  return clean.includes('@') ? clean : null;
}

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Usuario o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espere unos minutos o restablezca su contraseña.';
    case 'auth/user-disabled':
      return 'Este usuario está deshabilitado. Solicite su activación a un Administrador.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Verifique su acceso a internet.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta de acceso con este correo.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    default:
      return 'No se pudo completar la operación de acceso. Intente nuevamente.';
  }
}

export async function signInWithEmail(
  identifier: string,
  password: string
): Promise<{ success: boolean; message?: string }> {
  const email = resolveLoginEmail(identifier);
  if (!email) {
    return { success: false, message: 'Ingrese su correo electrónico completo.' };
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: mapAuthError(err?.code || '') };
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return { success: true };
  } catch (err: any) {
    return { success: false, message: mapAuthError(err?.code || '') };
  }
}

/**
 * Crea una cuenta de acceso sin cerrar la sesión del administrador actual.
 * Usa una instancia secundaria de Firebase para que createUserWithEmailAndPassword
 * no reemplace al usuario autenticado en la instancia principal.
 */
export async function createAuthAccount(
  email: string,
  password: string
): Promise<{ success: true; authUid: string } | { success: false; message: string }> {
  const secondaryName = 'secondary-account-creator';
  let secondaryApp;
  try {
    try {
      secondaryApp = getApp(secondaryName);
    } catch {
      secondaryApp = initializeApp(firebaseConfig, secondaryName);
    }
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), password);
    await signOut(secondaryAuth);
    return { success: true, authUid: cred.user.uid };
  } catch (err: any) {
    return { success: false, message: mapAuthError(err?.code || '') };
  } finally {
    if (secondaryApp) {
      deleteApp(secondaryApp).catch(() => {});
    }
  }
}

export async function getCurrentIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

/** Genera una contraseña temporal aleatoria legible para entregar al usuario nuevo. */
export function generateTemporaryPassword(length = 12): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}
