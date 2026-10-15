// Prueba de integración de los canales de entrada (WhatsApp y Drive) contra los emuladores de Auth y Firestore.
// La lectura con IA, Meta, Drive y Cloud Storage se reemplazan por simulaciones.
// Ejecutar desde scripts/rules-test:  npm run test:channels   (requiere Java).
import express from 'express';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createIntakeService, createFieldImageRouter, type ImageInput, type ImageStore, type Extractor } from '../server/intake';
import { createWhatsAppRouter, type WhatsAppGraph } from '../server/whatsapp';
import { runDriveIntake, createDriveIntakeRouter, type DriveClient } from '../server/driveIntake';

const PROJECT = 'demo-bandiera';
const admin = getApps()[0] ?? initializeApp({ projectId: PROJECT });
const db = getFirestore(admin);
const auth = getAuth(admin);

let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(ok ? '  ok   ' : '  FALLA', name, ok ? '' : detail);
};

// ---------------------------------------------------------------- simulaciones
const store = new Map<string, ImageInput>();
const imageStore: ImageStore = {
  async save(path, image) {
    store.set(path, image);
  },
  async read(path) {
    return store.get(path) ?? null;
  }
};

const GOOD = {
  remitoPapel: '0001-0004523',
  fecha: '2026-10-13',
  cliente: 'Bodega Los Alamos',
  puntoTrabajo: 'Pozo 2',
  descripcion: 'Cambio de contactor en tablero.',
  horaEntrada: '08:00',
  horaSalida: '12:30',
  cuadrilla: [{ nombre: 'bruno caceres', rol: 'oficial' }],
  materiales: [{ descripcion: 'contactor 25 A', cantidad: 1 }],
  confianzaLectura: 90
};
const extractor: Extractor = async ({ base64 }) => {
  const marker = Buffer.from(base64, 'base64').toString('utf8');
  if (marker.startsWith('BOOM')) throw new Error('IA caída');
  if (marker.startsWith('VACIA')) return {};
  if (marker.startsWith('DUDOSA')) return { ...GOOD, cliente: 'Finca Fantasma', confianzaLectura: 40, cuadrilla: [{ nombre: 'Facundo' }] };
  return GOOD;
};
const img = (marker: string): ImageInput => ({ data: Buffer.from(marker), mime: 'image/jpeg' });

const sent: Array<{ to: string; body: string }> = [];
const media = new Map<string, ImageInput>();
const graph: WhatsAppGraph = {
  async downloadMedia(id) {
    const m = media.get(id);
    if (!m) throw new Error('medio inexistente');
    return m;
  },
  async sendText(to, body) {
    sent.push({ to, body });
  }
};

// ---------------------------------------------------------------- datos de prueba
await db.collection('catalogoCampo').doc('actual').set({
  clients: [{ id: 'c1', razonSocial: 'Bodega Los Álamos S.A.', fincaLocacion: 'Finca Los Álamos' }],
  workers: [{ id: 'w1', name: 'BRUNO CACERES' }],
  materials: [{ id: 'm1', name: 'Contactor 25A' }]
});
await db.collection('users').doc('u-cap1').set({ uid: 'u-cap1', authUid: 'cap1', role: 'Capataz', displayName: 'Nicolás Herrera', phone: '+54 9 261 555-0100', active: true });
await db.collection('userRoles').doc('cap1').set({ role: 'Capataz', active: true });
await db.collection('users').doc('u-cap2').set({ uid: 'u-cap2', authUid: 'cap2', role: 'Capataz', displayName: 'Baja Reciente', phone: '+54 9 261 555-0200', active: true });
await db.collection('userRoles').doc('cap2').set({ role: 'Capataz', active: false });
await db.collection('users').doc('u-emp').set({ uid: 'u-emp', authUid: 'emp1', role: 'Empleado', displayName: 'Empleado Uno', phone: '+54 9 261 555-0300', active: true });
await db.collection('userRoles').doc('emp1').set({ role: 'Empleado', active: true });

const intake = createIntakeService({ db, extractor, imageStore, now: () => new Date('2026-10-14T15:00:00Z') });
const SECRET = 'secreto-de-prueba';
const wa = createWhatsAppRouter({ appSecret: SECRET, verifyToken: 'verificar123', intake, graph });
const SCHED_SECRET = 'cron-secret';
let driveRun: () => Promise<any> = async () => ({});

const app = express();
app.use('/api/whatsapp', wa.router);
app.use('/api/admin', createFieldImageRouter({ db, imageStore, projectId: PROJECT }));
app.use('/api/intake', createDriveIntakeRouter({ secret: SCHED_SECRET, run: () => driveRun() }));
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

const sign = (body: string) => 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
const waPayload = (messages: any[]) => JSON.stringify({ entry: [{ changes: [{ value: { messages } }] }] });
async function postWa(body: string, signature?: string) {
  const res = await fetch(`${base}/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(signature ? { 'X-Hub-Signature-256': signature } : {}) },
    body
  });
  await wa.idle();
  return res.status;
}
const lastReply = () => sent[sent.length - 1];
const reportCount = async () => (await db.collection('fieldReports').get()).size;

// ================================================================ WhatsApp
console.log('WhatsApp: verificación y firma');
expect('verificación correcta devuelve el desafío', await fetch(`${base}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verificar123&hub.challenge=abc`).then(async r => r.status === 200 && (await r.text()) === 'abc'));
expect('verificación con token incorrecto: 403', (await fetch(`${base}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=abc`)).status === 403);
const body1 = waPayload([{ id: 'wamid.1', from: '5492615550100', type: 'image', image: { id: 'media1' } }]);
media.set('media1', img('FOTO remito bueno'));
expect('sin firma: 401', (await postWa(body1)) === 401);
expect('firma incorrecta: 401', (await postWa(body1, 'sha256=' + '0'.repeat(64))) === 401);
expect('firma de otro cuerpo: 401', (await postWa(body1, sign(body1 + ' '))) === 401);
expect('rechazados no crean partes ni respuestas', (await reportCount()) === 0 && sent.length === 0);

console.log('WhatsApp: foto de un capataz registrado');
expect('firma válida: 200', (await postWa(body1, sign(body1))) === 200);
const created = (await db.collection('fieldReports').doc('WA-wamid1').get()).data() as any;
expect('crea un parte Pendiente por WhatsApp', created?.status === 'Pendiente' && created.origen === 'whatsapp');
expect('el parte es del capataz del teléfono', created?.submittedByAuthUid === 'cap1' && created.submittedByName === 'Nicolás Herrera');
expect('cliente y material salen del catálogo', created?.clientName === 'Bodega Los Álamos S.A.' && created.materials[0].name === 'Contactor 25A');
expect('personal reconocido', created?.crew?.[0]?.name === 'BRUNO CACERES');
expect('guarda la foto original', store.get('fieldReports/WA-wamid1')?.data.toString() === 'FOTO remito bueno' && created.imagePath === 'fieldReports/WA-wamid1');
expect('sin precios en el parte', created && !('billedPrice' in created) && !('suggestedPrice' in created));
expect('responde con el resumen', lastReply()?.to === '5492615550100' && /Bodega Los Álamos/.test(lastReply().body) && /Queda en revisión/.test(lastReply().body));

console.log('WhatsApp: reintentos y casos límite');
expect('Meta reintenta el mismo mensaje: no se duplica', (await postWa(body1, sign(body1))) === 200 && (await reportCount()) === 1 && /ya la había recibido/.test(lastReply().body));
const unknownBody = waPayload([{ id: 'wamid.2', from: '5491100000000', type: 'image', image: { id: 'media1' } }]);
expect('teléfono desconocido: no crea parte y avisa', (await postWa(unknownBody, sign(unknownBody))) === 200 && (await reportCount()) === 1 && /no está registrado/.test(lastReply().body));
const empBody = waPayload([{ id: 'wamid.3', from: '5492615550300', type: 'image', image: { id: 'media1' } }]);
await postWa(empBody, sign(empBody));
expect('un Empleado no puede cargar por WhatsApp', (await reportCount()) === 1 && /no está registrado/.test(lastReply().body));
const bajaBody = waPayload([{ id: 'wamid.4', from: '5492615550200', type: 'image', image: { id: 'media1' } }]);
await postWa(bajaBody, sign(bajaBody));
expect('capataz dado de baja queda sin acceso', (await reportCount()) === 1 && /no está registrado/.test(lastReply().body));
const textBody = waPayload([{ id: 'wamid.5', from: '5492615550100', type: 'text', text: { body: 'hola' } }]);
await postWa(textBody, sign(textBody));
expect('mensaje de texto: responde con ayuda', (await reportCount()) === 1 && /Mandame la foto/.test(lastReply().body));
media.set('mediaBoom', img('BOOM'));
const boomBody = waPayload([{ id: 'wamid.6', from: '5492615550100', type: 'image', image: { id: 'mediaBoom' } }]);
await postWa(boomBody, sign(boomBody));
expect('IA caída: avisa y no crea parte', (await reportCount()) === 1 && /No se pudo leer/.test(lastReply().body));
media.set('mediaVacia', img('VACIA'));
const vaciaBody = waPayload([{ id: 'wamid.7', from: '5492615550100', type: 'image', image: { id: 'mediaVacia' } }]);
await postWa(vaciaBody, sign(vaciaBody));
expect('foto sin datos legibles: avisa y no crea parte', (await reportCount()) === 1 && /No pude leer/.test(lastReply().body));
media.set('mediaPdf', { data: Buffer.from('%PDF'), mime: 'application/pdf' });
const pdfBody = waPayload([{ id: 'wamid.8', from: '5492615550100', type: 'image', image: { id: 'mediaPdf' } }]);
await postWa(pdfBody, sign(pdfBody));
expect('formato no admitido: avisa', (await reportCount()) === 1 && /Formato no admitido/.test(lastReply().body));
media.set('mediaGrande', { data: Buffer.alloc(9 * 1024 * 1024, 1), mime: 'image/jpeg' });
const bigBody = waPayload([{ id: 'wamid.9', from: '5492615550100', type: 'image', image: { id: 'mediaGrande' } }]);
await postWa(bigBody, sign(bigBody));
expect('imagen demasiado grande: avisa', (await reportCount()) === 1 && /pesa demasiado/.test(lastReply().body));
expect('JSON roto con firma válida: 400', (await postWa('{no es json', sign('{no es json'))) === 400);
media.set('mediaDudosa', img('DUDOSA'));
const dudBody = waPayload([{ id: 'wamid.10', from: '+54 9 261 555-0100', type: 'image', image: { id: 'mediaDudosa' } }]);
await postWa(dudBody, sign(dudBody));
const dudosa = (await db.collection('fieldReports').doc('WA-wamid10').get()).data() as any;
expect('teléfono con otro formato se reconoce', Boolean(dudosa));
expect('lectura dudosa queda marcada para revisar', dudosa?.confianza === 40 && dudosa.revisar?.length >= 3 && /revisar algunos datos/.test(lastReply().body));

// ================================================================ imagen para administración
console.log('Foto original para administración');
await auth.createUser({ uid: 'adm1', email: 'adm@x.test', password: 'Seed1234pass' });
await db.collection('userRoles').doc('adm1').set({ role: 'Admin', active: true });
await auth.createUser({ uid: 'cap1', email: 'cap@x.test', password: 'Seed1234pass' });
const tokenOf = async (email: string) => {
  const res = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Seed1234pass', returnSecureToken: true })
  });
  return ((await res.json()) as any).idToken as string;
};
const getImage = (id: string, token?: string) => fetch(`${base}/admin/field-reports/${id}/image`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const admToken = await tokenOf('adm@x.test');
const capToken = await tokenOf('cap@x.test');
const ok = await getImage('WA-wamid1', admToken);
expect('administración ve la foto', ok.status === 200 && ok.headers.get('content-type') === 'image/jpeg' && Buffer.from(await ok.arrayBuffer()).toString() === 'FOTO remito bueno');
expect('el capataz no ve fotos: 403', (await getImage('WA-wamid1', capToken)).status === 403);
expect('sin sesión: 401', (await getImage('WA-wamid1')).status === 401);
expect('parte inexistente: 404', (await getImage('no-existe', admToken)).status === 404);

// ================================================================ Drive
console.log('Drive');
const files: Record<string, { name: string; mimeType: string; data: Buffer; folder: string }> = {
  f1: { name: 'remito1.jpg', mimeType: 'image/jpeg', data: Buffer.from('FOTO buena'), folder: 'PEND' },
  f2: { name: 'remito2.jpg', mimeType: 'image/jpeg', data: Buffer.from('DUDOSA'), folder: 'PEND' },
  f3: { name: 'borroso.jpg', mimeType: 'image/jpeg', data: Buffer.from('VACIA'), folder: 'PEND' },
  f4: { name: 'ia-caida.jpg', mimeType: 'image/jpeg', data: Buffer.from('BOOM'), folder: 'PEND' }
};
const failDownload = new Set<string>(['f5']);
files.f5 = { name: 'no-descarga.jpg', mimeType: 'image/jpeg', data: Buffer.from('x'), folder: 'PEND' };
const drive: DriveClient = {
  async listImages(folderId) {
    return Object.entries(files).filter(([, f]) => f.folder === folderId).map(([id, f]) => ({ id, name: f.name, mimeType: f.mimeType }));
  },
  async download(id) {
    if (failDownload.has(id)) throw new Error('Drive 500');
    return files[id].data;
  },
  async move(id, from, to) {
    if (files[id].folder !== from) throw new Error('el archivo no está en la carpeta de origen');
    files[id].folder = to;
  }
};
const folders = [{ authUid: 'cap1', pendingFolderId: 'PEND', doneFolderId: 'DONE', errorFolderId: 'ERR' }];
const before = await reportCount();
const summary = await runDriveIntake({ intake, drive, folders });
expect('crea partes por Drive para las fotos legibles', summary.created === 2 && (await reportCount()) === before + 2, JSON.stringify(summary));
expect('las fotos procesadas van a Procesados', files.f1.folder === 'DONE' && files.f2.folder === 'DONE');
expect('las ilegibles van a Con error', files.f3.folder === 'ERR' && files.f4.folder === 'ERR' && summary.failed >= 2);
expect('un archivo que no se descarga se queda en Pendientes para reintentar', files.f5.folder === 'PEND');
const driveReport = (await db.collection('fieldReports').doc('DR-f1').get()).data() as any;
expect('el parte de Drive es del dueño de la carpeta', driveReport?.origen === 'drive' && driveReport.submittedByAuthUid === 'cap1' && driveReport.status === 'Pendiente');
files.f1.folder = 'PEND';
const again = await runDriveIntake({ intake, drive, folders });
expect('la misma foto vuelta a subir no se duplica', again.duplicates === 1 && (await reportCount()) === before + 2 && files.f1.folder === 'DONE');
const orphan = await runDriveIntake({ intake, drive, folders: [{ ...folders[0], authUid: 'cap2' }] });
expect('carpeta de un capataz dado de baja se ignora', orphan.skipped === 1 && orphan.created === 0);
for (let i = 0; i < 5; i++) files[`g${i}`] = { name: `g${i}.jpg`, mimeType: 'image/jpeg', data: Buffer.from('FOTO ' + i), folder: 'PEND' };
const limited = await runDriveIntake({ intake, drive, folders, maxFilesPerRun: 3 });
expect('respeta el máximo de fotos por ejecución', limited.created + limited.duplicates + limited.failed <= 3);

driveRun = () => runDriveIntake({ intake, drive, folders });
const trigger = (secret?: string) => fetch(`${base}/intake/drive/run`, { method: 'POST', headers: secret ? { 'x-intake-secret': secret } : {} }).then(r => r.status);
expect('el disparador sin secreto: 401', (await trigger()) === 401);
expect('el disparador con secreto incorrecto: 401', (await trigger('otro')) === 401);
expect('el disparador con el secreto correcto: 200', (await trigger(SCHED_SECRET)) === 200);

server.close();
console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);
