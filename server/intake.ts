import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import {
  sanitizeExtraction,
  buildFieldReportFromExtraction,
  reportIdForSource,
  type IntakeChannel
} from '../src/utils/remitoIntake';
import type { FieldCatalog, FieldReport } from '../src/types';

/**
 * Ingreso de fotos de remitos de papel a la bandeja de Partes de Campo, sin pasar por la app del capataz.
 * Lo usan los canales de WhatsApp y de Drive. Siempre crea partes Pendientes: nunca remitos ni precios.
 */

export interface ImageInput {
  data: Buffer;
  mime: string;
}

/** Lee la foto con IA. En producción es Gemini; en las pruebas, un reemplazo. */
export type Extractor = (image: { base64: string; mimeType: string }, catalog: FieldCatalog) => Promise<unknown>;

/** Guarda las fotos (en producción, Cloud Storage). */
export interface ImageStore {
  save(path: string, image: ImageInput): Promise<void>;
  read(path: string): Promise<ImageInput | null>;
}

export interface Capataz {
  uid: string;
  authUid: string;
  name: string;
}

export interface IntakeDeps {
  db: Firestore;
  extractor: Extractor;
  imageStore: ImageStore;
  now?: () => Date;
}

export type IngestResult =
  | { status: 'created'; reportId: string; report: Omit<FieldReport, 'id'> }
  | { status: 'duplicate'; reportId: string }
  | { status: 'unreadable'; reportId: string; reason: string };

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const digits = (value: string) => value.replace(/\D/g, '');

export function createIntakeService(deps: IntakeDeps) {
  const { db, extractor, imageStore } = deps;
  const now = deps.now ?? (() => new Date());

  async function loadCatalog(): Promise<FieldCatalog> {
    const snap = await db.collection('catalogoCampo').doc('actual').get();
    return snap.exists ? (snap.data() as FieldCatalog) : { clients: [], workers: [], materials: [] };
  }

  async function capatazFromProfile(data: any): Promise<Capataz | null> {
    if (!data || data.role !== 'Capataz' || data.active === false || !data.authUid) return null;
    // La cuenta de acceso debe seguir activa (una baja en Auth o en userRoles corta el canal).
    const role = await db.collection('userRoles').doc(data.authUid).get();
    if (!role.exists || (role.data() as any).active !== true) return null;
    return { uid: data.uid, authUid: data.authUid, name: data.displayName };
  }

  /** Busca al capataz por su teléfono. Compara los últimos 10 dígitos (el prefijo +54 9 varía según el origen). */
  async function findCapatazByPhone(phone: string): Promise<Capataz | null> {
    const wanted = digits(phone).slice(-10);
    if (wanted.length < 10) return null;
    const snap = await db.collection('users').where('role', '==', 'Capataz').get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.phone && digits(String(data.phone)).slice(-10) === wanted) {
        const capataz = await capatazFromProfile(data);
        if (capataz) return capataz;
      }
    }
    return null;
  }

  async function findCapatazByAuthUid(authUid: string): Promise<Capataz | null> {
    const snap = await db.collection('users').where('authUid', '==', authUid).get();
    return snap.empty ? null : capatazFromProfile(snap.docs[0].data());
  }

  async function ingest(input: {
    channel: IntakeChannel;
    sourceRef: string;
    image: ImageInput;
    capataz: Capataz;
  }): Promise<IngestResult> {
    const reportId = reportIdForSource(input.channel, input.sourceRef);
    const ref = db.collection('fieldReports').doc(reportId);
    if ((await ref.get()).exists) return { status: 'duplicate', reportId };

    if (!ALLOWED_IMAGE_MIME.includes(input.image.mime)) {
      return { status: 'unreadable', reportId, reason: 'Formato no admitido. Mandá una foto JPG, PNG o WEBP.' };
    }
    if (input.image.data.length === 0 || input.image.data.length > MAX_IMAGE_BYTES) {
      return { status: 'unreadable', reportId, reason: 'La imagen está vacía o pesa demasiado (máximo 8 MB).' };
    }

    const catalog = await loadCatalog();
    let raw: unknown;
    try {
      raw = await extractor({ base64: input.image.data.toString('base64'), mimeType: input.image.mime }, catalog);
    } catch (err: any) {
      return { status: 'unreadable', reportId, reason: 'No se pudo leer la foto. Probá de nuevo con más luz y de frente.' };
    }

    const extracted = sanitizeExtraction(raw);
    const hasSomething = Boolean(extracted.cliente || extracted.descripcion || extracted.remitoPapel);
    if (!hasSomething) {
      return { status: 'unreadable', reportId, reason: 'No pude leer datos en la foto. Probá de nuevo con más luz y de frente.' };
    }

    const current = now();
    const report = buildFieldReportFromExtraction(extracted, {
      channel: input.channel,
      catalog,
      submittedBy: input.capataz,
      sourceRef: input.sourceRef,
      today: current.toISOString().slice(0, 10),
      receivedDate: current.toISOString().slice(0, 10),
      now: current
    });
    const imagePath = `fieldReports/${reportId}`;
    await imageStore.save(imagePath, input.image);

    try {
      // create() falla si el parte ya existe: dos entregas simultáneas del mismo mensaje no duplican.
      // Firestore no admite campos undefined: se descartan antes de guardar.
      await ref.create(JSON.parse(JSON.stringify({ ...report, id: reportId, imagePath })));
    } catch (err: any) {
      if (err?.code === 6 || /already exists/i.test(String(err?.message))) return { status: 'duplicate', reportId };
      throw err;
    }
    return { status: 'created', reportId, report: { ...report, imagePath } };
  }

  return { loadCatalog, findCapatazByPhone, findCapatazByAuthUid, ingest };
}

export type IntakeService = ReturnType<typeof createIntakeService>;

/** Almacén de fotos en Cloud Storage (el bucket del proyecto). */
export async function createCloudImageStore(bucketName: string): Promise<ImageStore> {
  const { getStorage } = await import('firebase-admin/storage');
  const bucket = getStorage().bucket(bucketName);
  return {
    async save(path, image) {
      await bucket.file(path).save(image.data, { contentType: image.mime, resumable: false });
    },
    async read(path) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [data] = await file.download();
      const [meta] = await file.getMetadata();
      return { data, mime: String(meta.contentType || 'image/jpeg') };
    }
  };
}

export function getAdminFirestore(projectId: string, databaseId?: string): Firestore {
  const app = getApps().length ? getApps()[0] : initializeApp({ projectId, credential: applicationDefault() });
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

/** Entrega la foto original de un parte a quien administra (Administración, Gerencia, etc.; nunca al capataz). */
export function createFieldImageRouter(opts: { db: Firestore; imageStore: ImageStore; projectId: string }): Router {
  const router = Router();
  const auth = getAuth(getApps().length ? getApps()[0] : initializeApp({ projectId: opts.projectId, credential: applicationDefault() }));

  async function requireOffice(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, error: 'Se requiere iniciar sesión.' });
    try {
      const decoded = await auth.verifyIdToken(token);
      const role = (await opts.db.collection('userRoles').doc(decoded.uid).get()).data() as any;
      const ok = role && role.active === true && role.mustChangePassword !== true && role.role !== 'Capataz';
      if (!ok) return res.status(403).json({ success: false, error: 'No tiene permiso para ver esta imagen.' });
      next();
    } catch {
      res.status(401).json({ success: false, error: 'Sesión inválida.' });
    }
  }

  router.get('/field-reports/:id/image', requireOffice, async (req, res) => {
    try {
      const doc = await opts.db.collection('fieldReports').doc(String(req.params.id)).get();
      const imagePath = doc.exists ? (doc.data() as any).imagePath : undefined;
      const image = imagePath ? await opts.imageStore.read(imagePath) : null;
      if (!image) return res.status(404).json({ success: false, error: 'El parte no tiene imagen.' });
      res.setHeader('Content-Type', image.mime);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(image.data);
    } catch (err) {
      console.error('[Intake] Error leyendo imagen:', err);
      res.status(500).json({ success: false, error: 'No se pudo leer la imagen.' });
    }
  });

  return router;
}
