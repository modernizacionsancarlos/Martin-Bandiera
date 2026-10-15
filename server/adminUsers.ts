import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { randomInt } from 'node:crypto';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Administración de cuentas de acceso desde el servidor (firebase-admin).
 *
 * Lo que el navegador no puede hacer con seguridad: fijar la clave de otro usuario, deshabilitar o
 * borrar una cuenta de Firebase Auth. Todas las operaciones exigen un ID token de una cuenta con rol
 * administrativo activo y sin cambio de contraseña pendiente.
 *
 * Las claves temporales se generan en el servidor, se devuelven una sola vez y nunca se guardan.
 * La cuenta queda marcada con `mustChangePassword` en /userRoles/{uid}; mientras la marca exista, las reglas
 * de Firestore no le dan acceso a ningún dato y la aplicación le exige elegir una clave propia.
 */

const ADMIN_ROLES = ['SuperAdmin', 'Owner', 'Gerente', 'Admin'];
const ALL_ROLES = [...ADMIN_ROLES, 'Capataz', 'Empleado'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AdminUsersConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

interface RoleDoc {
  role?: string;
  email?: string;
  active?: boolean;
  mustChangePassword?: boolean;
}

interface Caller {
  uid: string;
  role: string;
}

type AuthedRequest = Request & { caller?: Caller };

export function generateTemporaryPassword(length = 12): string {
  // Sin caracteres que se confunden al leerlos (0/O, 1/l/I).
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  // Garantiza letras y números para cumplir la política de contraseñas.
  return /[A-Za-z]/.test(out) && /\d/.test(out) ? out : generateTemporaryPassword(length);
}

export function isAcceptablePassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function createAdminUsersRouter(config: AdminUsersConfig): Router {
  const router = Router();
  router.use(json({ limit: '32kb' }));

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ projectId: config.projectId, credential: applicationDefault() });
  const auth = getAuth(app);
  const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);
  const roles = db.collection('userRoles');

  const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });

  // Identifica al que llama a partir de su ID token (verificado con la clave pública de Google).
  async function identify(req: Request): Promise<{ uid: string; roleDoc: RoleDoc | null } | null> {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    try {
      const decoded = await auth.verifyIdToken(token);
      const snap = await roles.doc(decoded.uid).get();
      return { uid: decoded.uid, roleDoc: snap.exists ? (snap.data() as RoleDoc) : null };
    } catch {
      return null;
    }
  }

  async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
    const who = await identify(req);
    if (!who) return fail(res, 401, 'Se requiere iniciar sesión.');
    const d = who.roleDoc;
    if (!d || d.active !== true || d.mustChangePassword === true || !ADMIN_ROLES.includes(String(d.role))) {
      return fail(res, 403, 'No tiene permiso para administrar usuarios.');
    }
    req.caller = { uid: who.uid, role: String(d.role) };
    next();
  }

  // Un administrador no toca cuentas SuperAdmin ni a sí mismo en operaciones destructivas (igual que las reglas).
  async function loadTarget(req: AuthedRequest, res: Response, allowSelf = false): Promise<{ uid: string; doc: RoleDoc } | null> {
    const uid = String(req.params.authUid || '');
    if (!uid) {
      fail(res, 400, 'Falta la cuenta.');
      return null;
    }
    if (!allowSelf && uid === req.caller!.uid) {
      fail(res, 400, 'No puede realizar esta operación sobre su propia cuenta.');
      return null;
    }
    const snap = await roles.doc(uid).get();
    if (!snap.exists) {
      fail(res, 404, 'La cuenta no existe.');
      return null;
    }
    const doc = snap.data() as RoleDoc;
    if (doc.role === 'SuperAdmin' && req.caller!.role !== 'SuperAdmin') {
      fail(res, 403, 'Solo un SuperAdmin puede administrar a otro SuperAdmin.');
      return null;
    }
    return { uid, doc };
  }

  const guarded =
    (handler: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
    async (req: AuthedRequest, res: Response) => {
      try {
        await handler(req, res);
      } catch (err: any) {
        console.error('[AdminUsers] Error:', err?.code || err?.message || err);
        fail(res, 500, 'No se pudo completar la operación. Intente nuevamente.');
      }
    };

  // Alta de cuenta con clave temporal.
  router.post(
    '/users',
    requireAdmin,
    guarded(async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const displayName = String(req.body?.displayName || '').trim();
      const role = String(req.body?.role || 'Empleado');
      const active = req.body?.active !== false;
      if (!EMAIL_PATTERN.test(email)) return fail(res, 400, 'Ingrese un correo electrónico válido.');
      if (!ALL_ROLES.includes(role)) return fail(res, 400, 'Rol inválido.');
      if (role === 'SuperAdmin' && req.caller!.role !== 'SuperAdmin') {
        return fail(res, 403, 'Solo un SuperAdmin puede crear otro SuperAdmin.');
      }
      const temporaryPassword = generateTemporaryPassword();
      let created;
      try {
        created = await auth.createUser({ email, password: temporaryPassword, displayName: displayName || undefined, disabled: !active });
      } catch (err: any) {
        if (err?.code === 'auth/email-already-exists') return fail(res, 409, 'Ya existe una cuenta de acceso con este correo.');
        throw err;
      }
      await roles.doc(created.uid).set({
        role,
        email,
        active,
        mustChangePassword: true,
        createdBy: req.caller!.uid,
        createdAt: new Date().toISOString()
      });
      res.json({ success: true, authUid: created.uid, temporaryPassword });
    })
  );

  // Restablecer clave: genera una temporal nueva, cierra las sesiones abiertas y exige cambiarla.
  router.post(
    '/users/:authUid/reset-password',
    requireAdmin,
    guarded(async (req, res) => {
      const target = await loadTarget(req, res);
      if (!target) return;
      const temporaryPassword = generateTemporaryPassword();
      await auth.updateUser(target.uid, { password: temporaryPassword });
      await auth.revokeRefreshTokens(target.uid);
      await roles.doc(target.uid).update({ mustChangePassword: true });
      res.json({ success: true, temporaryPassword });
    })
  );

  // Habilitar o deshabilitar el acceso (la cuenta y sus datos se conservan).
  router.post(
    '/users/:authUid/disabled',
    requireAdmin,
    guarded(async (req, res) => {
      const target = await loadTarget(req, res);
      if (!target) return;
      const disabled = req.body?.disabled === true;
      await auth.updateUser(target.uid, { disabled });
      if (disabled) await auth.revokeRefreshTokens(target.uid);
      await roles.doc(target.uid).update({ active: !disabled });
      res.json({ success: true });
    })
  );

  // Baja definitiva de la cuenta de acceso.
  router.delete(
    '/users/:authUid',
    requireAdmin,
    guarded(async (req, res) => {
      const target = await loadTarget(req, res);
      if (!target) return;
      try {
        await auth.deleteUser(target.uid);
      } catch (err: any) {
        if (err?.code !== 'auth/user-not-found') throw err;
      }
      await roles.doc(target.uid).delete();
      res.json({ success: true });
    })
  );

  // El propio usuario elige su clave definitiva. Lo hace el servidor (no el navegador) para que la marca
  // de cambio pendiente solo se quite si la clave realmente cambió.
  router.post(
    '/me/change-password',
    guarded(async (req, res) => {
      const who = await identify(req);
      if (!who) return fail(res, 401, 'Se requiere iniciar sesión.');
      if (!who.roleDoc || who.roleDoc.active !== true) return fail(res, 403, 'La cuenta no está habilitada.');
      const newPassword = req.body?.newPassword;
      if (!isAcceptablePassword(newPassword)) {
        return fail(res, 400, 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
      }
      await auth.updateUser(who.uid, { password: newPassword });
      await auth.revokeRefreshTokens(who.uid);
      await roles.doc(who.uid).update({ mustChangePassword: FieldValue.delete(), passwordChangedAt: new Date().toISOString() });
      res.json({ success: true });
    })
  );

  return router;
}
