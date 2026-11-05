import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { scanRemito } from './server/scanRemito.js';
import { requireUser } from './server/requireUser.js';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Photos are downscaled in the browser; keep in line with Vercel's 4.5MB body limit
  app.use(express.json({ limit: '5mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // AI OCR Scan Remito endpoint (signed-in users only)
  app.post('/api/ai/scan-remito', async (req, res) => {
    try {
      const userId = await requireUser(req.headers.authorization);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Debe iniciar sesión.' });
      }
      const result = await scanRemito(req.body);
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[API Scan Remito Error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Error al procesar el remito con IA.' });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
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
