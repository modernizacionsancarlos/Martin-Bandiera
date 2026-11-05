import type { IncomingMessage, ServerResponse } from 'http';
import { scanRemito } from '../../server/scanRemito.js';
import { requireUser } from '../../server/requireUser.js';

export const config = { maxDuration: 60 };

type VercelRequest = IncomingMessage & { body?: any; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

// The Android app (Capacitor) runs on https://localhost and calls this endpoint cross-origin.
const NATIVE_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  if (NATIVE_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }
  const userId = await requireUser(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Debe iniciar sesión.' });
  }
  const result = await scanRemito(req.body);
  return res.status(result.status).json(result.body);
}
