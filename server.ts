import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import type { NextFunction, Request, Response } from 'express';
import { createAdminUsersRouter } from './server/adminUsers';
import { scanRemitoImage, OcrError } from './server/ocr';
import { buildAssetLinks } from './server/assetLinks';
import { createIntakeService, createFieldImageRouter, createCloudImageStore, getAdminFirestore, type Extractor } from './server/intake';
import { createWhatsAppRouter, createGraphClient } from './server/whatsapp';
import { createDriveIntakeRouter, createGoogleDriveClient, loadFolderConfig, runDriveIntake } from './server/driveIntake';
import { sanitizeExtraction } from './src/utils/remitoIntake';

dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// --- Autenticación de la API -------------------------------------------------
// Verifica el ID token de Firebase Auth y que la cuenta tenga un rol activo en
// /userRoles/{uid}. La lectura de Firestore usa el token del propio usuario, por lo que
// las reglas de seguridad deciden el resultado (no hace falta credencial de servidor).
const AUTH_CACHE_TTL_MS = 60_000;
const authCache = new Map<string, { uid: string; expires: number }>();

async function verifyActiveStaff(idToken: string): Promise<string | null> {
  const cached = authCache.get(idToken);
  if (cached && cached.expires > Date.now()) return cached.uid;

  const lookup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  if (!lookup.ok) return null;
  const lookupData: any = await lookup.json();
  const uid: string | undefined = lookupData?.users?.[0]?.localId;
  if (!uid) return null;

  const roleUrl =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)')}/documents/userRoles/${uid}`;
  const roleRes = await fetch(roleUrl, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!roleRes.ok) return null;
  const roleDoc: any = await roleRes.json();
  if (roleDoc?.fields?.active?.booleanValue !== true) return null;

  authCache.set(idToken, { uid, expires: Date.now() + AUTH_CACHE_TTL_MS });
  return uid;
}

// Límite simple por usuario para proteger la cuota de Gemini.
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_REQUESTS = 40;
const rateBuckets = new Map<string, number[]>();

function withinRateLimit(uid: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(uid) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(uid, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(uid, recent);
  return true;
}

// En la demo no hay sesión real ni se consume la cuota de IA.
function demoGuard(_req: Request, res: Response, next: NextFunction) {
  if (process.env.DEMO_MODE === '1') {
    return res.status(503).json({ success: false, error: 'El escaneo con IA no está disponible en la demo.' });
  }
  next();
}

async function requireStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      return res.status(401).json({ success: false, error: 'Se requiere iniciar sesión.' });
    }
    const uid = await verifyActiveStaff(token);
    if (!uid) {
      return res.status(403).json({ success: false, error: 'Sesión inválida o usuario sin acceso.' });
    }
    if (!withinRateLimit(uid)) {
      return res.status(429).json({ success: false, error: 'Demasiadas lecturas de remitos. Intente en unos minutos.' });
    }
    next();
  } catch (err) {
    console.error('[Auth] Error verificando sesión:', err);
    res.status(500).json({ success: false, error: 'No se pudo verificar la sesión.' });
  }
}

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Canales de entrada de remitos (WhatsApp y Drive). Se montan antes del lector de JSON global:
  // la firma de WhatsApp se verifica sobre el cuerpo exacto. Cada canal se activa solo si está configurado.
  if (process.env.DEMO_MODE !== '1') {
    try {
      const db = getAdminFirestore(firebaseConfig.projectId, firebaseConfig.firestoreDatabaseId);
      const imageStore = await createCloudImageStore(firebaseConfig.storageBucket);
      const extractor: Extractor = async (image, catalog) => {
        if (!ai) throw new Error('GEMINI_API_KEY no configurada');
        return scanRemitoImage(ai, {
          base64: image.base64,
          mimeType: image.mimeType,
          knownClients: catalog.clients.map(c => c.razonSocial).slice(0, 60),
          knownWorkers: catalog.workers.map(w => w.name).slice(0, 60)
        });
      };
      const intake = createIntakeService({ db, extractor, imageStore });
      app.use('/api/admin', createFieldImageRouter({ db, imageStore, projectId: firebaseConfig.projectId }));

      const { WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
      if (WHATSAPP_APP_SECRET && WHATSAPP_VERIFY_TOKEN && WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
        const wa = createWhatsAppRouter({
          appSecret: WHATSAPP_APP_SECRET,
          verifyToken: WHATSAPP_VERIFY_TOKEN,
          intake,
          graph: createGraphClient({ token: WHATSAPP_TOKEN, phoneNumberId: WHATSAPP_PHONE_NUMBER_ID })
        });
        app.use('/api/whatsapp', wa.router);
        console.log('[WhatsApp] Canal de entrada de remitos activo.');
      }

      if (process.env.INTAKE_CRON_SECRET) {
        const drive = await createGoogleDriveClient();
        app.use(
          '/api/intake',
          createDriveIntakeRouter({
            secret: process.env.INTAKE_CRON_SECRET,
            run: async () => runDriveIntake({ intake, drive, folders: await loadFolderConfig(db) })
          })
        );
        console.log('[Drive] Canal de entrada de remitos activo.');
      }
    } catch (err) {
      console.warn('[Intake] Canales de entrada de remitos deshabilitados:', err);
    }
  }

  // Fotos de remitos en base64: 15MB alcanzan para una imagen de alta resolución
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Sin GEMINI_API_KEY el servidor igual arranca; solo falla el escaneo de remitos con IA.
  const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;
  if (!ai) {
    console.warn('[Gemini] GEMINI_API_KEY no está configurada: el escaneo de remitos con IA estará deshabilitado.');
  }

  // Administración de cuentas de acceso (alta, clave temporal, baja). En la demo se resuelve en el navegador.
  if (process.env.DEMO_MODE !== '1') {
    try {
      app.use(
        '/api/admin',
        createAdminUsersRouter({ projectId: firebaseConfig.projectId, firestoreDatabaseId: firebaseConfig.firestoreDatabaseId })
      );
    } catch (err) {
      console.warn('[AdminUsers] Administración de usuarios por servidor deshabilitada:', err);
    }
  }

  // Vínculo con la app de Android (Google Play): Android lo consulta para abrir la web sin barra del navegador.
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const links = buildAssetLinks(process.env);
    if (!links.ok) return res.status(404).json({ error: 'assetlinks no configurado', problems: links.problems });
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(links.body);
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // AI OCR Scan Remito endpoint
  app.post('/api/ai/scan-remito', demoGuard, requireStaff, async (req, res) => {
    if (!ai) {
      return res.status(503).json({ success: false, error: 'El escaneo con IA no está configurado en el servidor (falta GEMINI_API_KEY).' });
    }
    try {
      const { image, mimeType = 'image/jpeg', knownClients = [], knownWorkers = [] } = req.body;
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ success: false, error: 'Se requiere una imagen en base64 para procesar el remito.' });
      }
      // Remove data URL prefix if sent
      const base64 = image.replace(/^data:[a-zA-Z0-9.-]+\/[a-zA-Z0-9.+]+;base64,/, '');
      const raw = await scanRemitoImage(ai, {
        base64,
        mimeType,
        knownClients: Array.isArray(knownClients) ? knownClients.slice(0, 60).map(String) : [],
        knownWorkers: Array.isArray(knownWorkers) ? knownWorkers.slice(0, 60).map(String) : []
      });
      // La respuesta de la IA no es de fiar: se validan los campos antes de devolverlos.
      return res.json({ success: true, data: sanitizeExtraction(raw) });
    } catch (err: any) {
      if (err instanceof OcrError) {
        return res.status(err.status).json({ success: false, error: err.message });
      }
      console.error('[API Scan Remito Error]:', err);
      return res.status(500).json({ success: false, error: 'Error al procesar el remito con IA.' });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      mode: process.env.DEMO_MODE === '1' ? 'demo' : undefined,
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
