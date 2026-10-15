import { Router, raw } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { summarizeForSender } from '../src/utils/remitoIntake';
import type { ImageInput, IntakeService } from './intake';

/**
 * Canal de WhatsApp (API oficial de WhatsApp Business / Meta Cloud API).
 *
 * El capataz manda la foto del remito al número de la empresa. El servidor la lee, crea un parte Pendiente
 * y responde con lo que entendió. Solo atiende a teléfonos registrados como capataz activo.
 *
 * Seguridad: cada llamada de Meta trae una firma HMAC-SHA256 con el secreto de la app; sin firma válida se rechaza.
 */

export interface WhatsAppGraph {
  /** Descarga la imagen de un mensaje por su id de medio. */
  downloadMedia(mediaId: string): Promise<ImageInput>;
  sendText(to: string, body: string): Promise<void>;
}

export interface WhatsAppConfig {
  appSecret: string;
  verifyToken: string;
  intake: IntakeService;
  graph: WhatsAppGraph;
}

const HELP_TEXT = 'Mandame la foto del remito de papel (de frente y con buena luz) y la cargo para administración.';
const UNKNOWN_TEXT = 'Este número no está registrado para cargar remitos. Pedile a administración que lo dé de alta.';

export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

interface WaMessage {
  id: string;
  from: string;
  type: string;
  image?: { id: string; mime_type?: string };
}

export function createWhatsAppRouter(config: WhatsAppConfig) {
  const router = Router();
  const pending = new Set<Promise<void>>();

  async function handleMessage(msg: WaMessage) {
    const { intake, graph } = config;
    try {
      const capataz = await intake.findCapatazByPhone(msg.from);
      if (!capataz) return await graph.sendText(msg.from, UNKNOWN_TEXT);
      if (msg.type !== 'image' || !msg.image?.id) return await graph.sendText(msg.from, HELP_TEXT);

      const image = await graph.downloadMedia(msg.image.id);
      const result = await intake.ingest({ channel: 'whatsapp', sourceRef: msg.id, image, capataz });
      if (result.status === 'created') await graph.sendText(msg.from, summarizeForSender(result.report));
      else if (result.status === 'duplicate') await graph.sendText(msg.from, 'Esa foto ya la había recibido.');
      else await graph.sendText(msg.from, result.reason);
    } catch (err) {
      console.error('[WhatsApp] Error procesando mensaje', msg.id, err);
      try {
        await config.graph.sendText(msg.from, 'Hubo un problema al procesar tu foto. Probá de nuevo en unos minutos.');
      } catch {
        // sin respuesta posible
      }
    }
  }

  // Verificación inicial del webhook (Meta llama una vez al configurarlo).
  router.get('/webhook', (req, res) => {
    const ok = req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.verifyToken;
    if (ok) return res.status(200).send(String(req.query['hub.challenge'] ?? ''));
    res.sendStatus(403);
  });

  // La firma se calcula sobre el cuerpo exacto: por eso se lee sin interpretar.
  router.post('/webhook', raw({ type: '*/*', limit: '1mb' }), (req, res) => {
    const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!verifySignature(body, req.headers['x-hub-signature-256'] as string | undefined, config.appSecret)) {
      return res.sendStatus(401);
    }
    let payload: any;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }
    // Meta espera la respuesta en pocos segundos y reintenta si tarda: se responde ya y se procesa después.
    // La identificación estable del mensaje evita cargar dos veces el mismo remito si Meta reintenta.
    const messages: WaMessage[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        for (const m of change?.value?.messages ?? []) {
          if (m && typeof m.id === 'string' && typeof m.from === 'string') messages.push(m);
        }
      }
    }
    for (const msg of messages) {
      const job = handleMessage(msg).finally(() => pending.delete(job));
      pending.add(job);
    }
    res.sendStatus(200);
  });

  /** Espera a que terminen los mensajes en curso (para pruebas y apagado ordenado). */
  const idle = async () => {
    while (pending.size) await Promise.all([...pending]);
  };

  return { router, idle };
}

/** Cliente real de la API de Meta. */
export function createGraphClient(opts: { token: string; phoneNumberId: string; version?: string }): WhatsAppGraph {
  const base = `https://graph.facebook.com/${opts.version ?? 'v21.0'}`;
  const headers = { Authorization: `Bearer ${opts.token}` };
  return {
    async downloadMedia(mediaId) {
      const meta = await fetch(`${base}/${encodeURIComponent(mediaId)}`, { headers });
      if (!meta.ok) throw new Error(`Meta media ${meta.status}`);
      const info: any = await meta.json();
      const file = await fetch(String(info.url), { headers });
      if (!file.ok) throw new Error(`Meta download ${file.status}`);
      return { data: Buffer.from(await file.arrayBuffer()), mime: String(info.mime_type || 'image/jpeg') };
    },
    async sendText(to, body) {
      const res = await fetch(`${base}/${opts.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } })
      });
      if (!res.ok) throw new Error(`Meta send ${res.status}`);
    }
  };
}
