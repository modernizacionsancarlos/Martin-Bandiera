import { Router, json } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { ImageInput, IntakeService } from './intake';

/**
 * Canal de Google Drive. Cada capataz sube las fotos de sus remitos a su carpeta de Drive
 * (la carpeta se comparte con la cuenta de servicio del sistema). Un proceso programado revisa las
 * carpetas, crea un parte Pendiente por cada foto y mueve el archivo a "Procesados" (o a "Con error").
 *
 * La identidad del capataz sale de la carpeta (no de quien sube), por eso cada capataz tiene la suya.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveClient {
  listImages(folderId: string): Promise<DriveFile[]>;
  download(fileId: string): Promise<Buffer>;
  move(fileId: string, fromFolderId: string, toFolderId: string): Promise<void>;
}

export interface CapatazFolder {
  authUid: string;
  pendingFolderId: string;
  doneFolderId: string;
  errorFolderId: string;
}

export interface DriveRunSummary {
  created: number;
  duplicates: number;
  failed: number;
  skipped: number;
}

export async function loadFolderConfig(db: Firestore): Promise<CapatazFolder[]> {
  const snap = await db.collection('systemSettings').doc('driveIntake').get();
  const folders = snap.exists ? (snap.data() as any).folders : [];
  return Array.isArray(folders)
    ? folders.filter((f: any) => f?.authUid && f?.pendingFolderId && f?.doneFolderId && f?.errorFolderId)
    : [];
}

/** Procesa las carpetas pendientes. Una foto con problemas no frena a las demás. */
export async function runDriveIntake(opts: {
  intake: IntakeService;
  drive: DriveClient;
  folders: CapatazFolder[];
  maxFilesPerRun?: number;
}): Promise<DriveRunSummary> {
  const summary: DriveRunSummary = { created: 0, duplicates: 0, failed: 0, skipped: 0 };
  let budget = opts.maxFilesPerRun ?? 40; // acota el costo de lectura con IA por ejecución

  for (const folder of opts.folders) {
    const capataz = await opts.intake.findCapatazByAuthUid(folder.authUid);
    if (!capataz) {
      summary.skipped++;
      continue;
    }
    const files = await opts.drive.listImages(folder.pendingFolderId);
    for (const file of files) {
      if (budget <= 0) return summary;
      budget--;
      try {
        const image: ImageInput = { data: await opts.drive.download(file.id), mime: file.mimeType };
        const result = await opts.intake.ingest({ channel: 'drive', sourceRef: file.id, image, capataz });
        if (result.status === 'created') summary.created++;
        else if (result.status === 'duplicate') summary.duplicates++;
        const target = result.status === 'unreadable' ? folder.errorFolderId : folder.doneFolderId;
        if (result.status === 'unreadable') summary.failed++;
        await opts.drive.move(file.id, folder.pendingFolderId, target);
      } catch (err) {
        // El archivo queda en Pendientes y se reintenta en la próxima ejecución.
        console.error('[Drive] Error procesando archivo', file.id, err);
        summary.failed++;
      }
    }
  }
  return summary;
}

/** Disparador para Cloud Scheduler: protegido con un secreto compartido. */
export function createDriveIntakeRouter(opts: {
  secret: string;
  run: () => Promise<DriveRunSummary>;
}): Router {
  const router = Router();
  let running = false;
  router.post('/drive/run', json({ limit: '1kb' }), async (req, res) => {
    const given = Buffer.from(String(req.headers['x-intake-secret'] || ''));
    const expected = Buffer.from(opts.secret);
    if (!opts.secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return res.sendStatus(401);
    }
    if (running) return res.status(409).json({ success: false, error: 'Ya hay una ejecución en curso.' });
    running = true;
    try {
      res.json({ success: true, ...(await opts.run()) });
    } catch (err) {
      console.error('[Drive] Error en la ejecución:', err);
      res.status(500).json({ success: false, error: 'No se pudo completar la ejecución.' });
    } finally {
      running = false;
    }
  });
  return router;
}

/** Cliente real de la API de Drive (REST, con la cuenta de servicio del servidor). */
export async function createGoogleDriveClient(): Promise<DriveClient> {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive'] });
  const call = async (url: string, init: RequestInit = {}) => {
    const token = await auth.getAccessToken();
    const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Drive ${res.status}`);
    return res;
  };
  const api = 'https://www.googleapis.com/drive/v3/files';
  return {
    async listImages(folderId) {
      const q = encodeURIComponent(`'${folderId.replace(/'/g, '')}' in parents and trashed = false and mimeType contains 'image/'`);
      const res = await call(`${api}?q=${q}&fields=files(id,name,mimeType)&pageSize=100&orderBy=createdTime`);
      return ((await res.json()) as any).files ?? [];
    },
    async download(fileId) {
      const res = await call(`${api}/${encodeURIComponent(fileId)}?alt=media`);
      return Buffer.from(await res.arrayBuffer());
    },
    async move(fileId, fromFolderId, toFolderId) {
      await call(
        `${api}/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(toFolderId)}&removeParents=${encodeURIComponent(fromFolderId)}`,
        { method: 'PATCH' }
      );
    }
  };
}
