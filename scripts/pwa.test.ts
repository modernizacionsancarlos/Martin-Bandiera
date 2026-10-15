// Pruebas de la aplicación instalable: manifiesto, íconos y comportamiento del service worker (public/sw.js).
// Ejecutar: npx tsx scripts/pwa.test.ts
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const pub = path.resolve(import.meta.dirname, '../public');
let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(ok ? '  ok   ' : '  FALLA', name, ok ? '' : detail);
};

// ---------------------------------------------------------------- manifiesto e íconos
console.log('Manifiesto e íconos');
const manifest = JSON.parse(fs.readFileSync(path.join(pub, 'manifest.webmanifest'), 'utf8'));
expect('tiene nombre, nombre corto y descripción', Boolean(manifest.name && manifest.short_name && manifest.description));
expect('el nombre corto entra en el ícono del celular (hasta 12 letras)', manifest.short_name.length <= 12);
expect('se abre como aplicación (standalone) y en vertical', manifest.display === 'standalone' && manifest.orientation === 'portrait');
expect('la ruta de inicio está dentro del alcance', manifest.start_url.startsWith(manifest.scope));
expect('colores definidos', /^#[0-9a-f]{6}$/i.test(manifest.theme_color) && /^#[0-9a-f]{6}$/i.test(manifest.background_color));

function pngSize(file: string): { w: number; h: number } | null {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
for (const icon of manifest.icons) {
  const file = path.join(pub, icon.src.replace(/^\//, ''));
  const size = fs.existsSync(file) ? pngSize(file) : null;
  const [w, h] = String(icon.sizes).split('x').map(Number);
  expect(`ícono ${icon.src} (${icon.purpose}) existe y mide ${icon.sizes}`, size !== null && size.w === w && size.h === h, JSON.stringify(size));
}
expect('hay un ícono de 192, uno de 512 y uno maskable (requisitos de instalación)',
  manifest.icons.some((i: any) => i.sizes === '192x192') && manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'any') && manifest.icons.some((i: any) => i.purpose === 'maskable'));
const html = fs.readFileSync(path.resolve(import.meta.dirname, '../index.html'), 'utf8');
expect('index.html enlaza el manifiesto y el color del tema', html.includes('rel="manifest"') && html.includes('name="theme-color"'));
expect('index.html incluye el ícono de iPhone', html.includes('apple-touch-icon'));

// ---------------------------------------------------------------- service worker en un entorno simulado
console.log('Service worker');
type Handler = (event: any) => void;
const handlers: Record<string, Handler> = {};
const store = new Map<string, Map<string, any>>();
const net = { online: true, calls: [] as string[] };

const makeResponse = (body: string, extra: Record<string, unknown> = {}) => ({
  ok: true,
  type: 'basic',
  body,
  clone() {
    return { ...this };
  },
  ...extra
});
const keyOf = (r: any) => (typeof r === 'string' ? r : r.url);
const cachesApi = {
  async open(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    const c = store.get(name)!;
    return {
      async addAll(urls: string[]) {
        urls.forEach(u => c.set(u === '/' ? '/' : u, makeResponse('shell:' + u)));
      },
      async match(r: any) {
        const k = keyOf(r);
        const path = k.startsWith('http') ? new URL(k).pathname : k;
        return c.get(k) ?? c.get(path);
      },
      async put(r: any, res: any) {
        const k = keyOf(r);
        c.set(k.startsWith('http') && new URL(k).pathname === '/' ? '/' : k, res);
      },
      async keys() {
        return [...c.keys()].map(url => ({ url }));
      },
      async delete(r: any) {
        return c.delete(keyOf(r));
      }
    };
  },
  async keys() {
    return [...store.keys()];
  },
  async delete(name: string) {
    return store.delete(name);
  }
};

const selfObj: any = {
  location: { origin: 'https://app.test' },
  addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
  skipWaiting: async () => {},
  clients: { claim: async () => {} }
};
const context: any = {
  self: selfObj,
  caches: cachesApi,
  URL,
  Response: { error: () => ({ error: true }) },
  setTimeout,
  clearTimeout,
  Promise,
  fetch: async (req: any) => {
    const url = typeof req === 'string' ? req : req.url;
    net.calls.push(url);
    if (!net.online) throw new Error('sin red');
    // La pantalla principal referencia el módulo principal; este referencia un módulo cargado bajo demanda.
    if (url === '/' || url === 'https://app.test/') {
      return { ...makeResponse('html'), text: async () => '<script type="module" src="/assets/index-AAA111.js"></script><link rel="stylesheet" href="/assets/index-BBB222.css">' };
    }
    if (url === '/assets/index-AAA111.js') {
      return { ...makeResponse('js'), text: async () => 'const m=()=>import("./Lazy-CCC333.js");' };
    }
    return makeResponse('red:' + url);
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(pub, 'sw.js'), 'utf8'), context);

const run = async (type: string, event: any) => {
  let waited: Promise<any> | undefined;
  let responded: Promise<any> | undefined;
  const ev = {
    ...event,
    waitUntil: (p: Promise<any>) => (waited = p),
    respondWith: (p: Promise<any>) => (responded = Promise.resolve(p))
  };
  handlers[type](ev);
  if (waited) await waited;
  return { handled: Boolean(responded), response: responded ? await responded : undefined };
};
const req = (url: string, extra: Record<string, unknown> = {}) => ({ url: 'https://app.test' + url, method: 'GET', mode: 'cors', ...extra });

await run('install', {});
const assetCache = () => store.get('bandiera-assets-v3');
expect('la primera instalación guarda el módulo principal y los estilos de la app', assetCache()?.has('/assets/index-AAA111.js') === true && assetCache()?.has('/assets/index-BBB222.css') === true, JSON.stringify([...(assetCache()?.keys() ?? [])]));
expect('también guarda los módulos que se cargan bajo demanda', assetCache()?.has('/assets/Lazy-CCC333.js') === true);
net.online = false;
const firstOffline = await run('fetch', { request: req('/assets/index-AAA111.js') });
expect('sin señal, ya en la primera visita, la app abre desde el caché', firstOffline.response?.ok === true);
net.online = true;
expect('al instalar guarda la pantalla principal y los íconos', store.get('bandiera-shell-v3')?.has('/') === true && store.get('bandiera-shell-v3')?.has('/icons/icon-192.png') === true);

net.online = true;
const online = await run('fetch', { request: req('/', { mode: 'navigate' }) });
expect('con señal, la pantalla viene de la red', online.response?.body === 'html');
net.online = false;
const offline = await run('fetch', { request: req('/clientes', { mode: 'navigate' }) });
expect('sin señal, la aplicación abre con la última copia guardada', offline.response?.body === 'html', JSON.stringify(offline.response));

net.online = true;
const asset = await run('fetch', { request: req('/assets/index-abc123.js') });
net.online = false;
const assetAgain = await run('fetch', { request: req('/assets/index-abc123.js') });
expect('los archivos de la app se sirven del caché sin señal', asset.response?.body?.startsWith('red:') === true && assetAgain.response?.body === asset.response?.body);

net.calls.length = 0;
expect('las llamadas a /api no se interceptan', !(await run('fetch', { request: req('/api/admin/users') })).handled);
expect('las escrituras (POST) no se interceptan', !(await run('fetch', { request: req('/assets/x.js', { method: 'POST' }) })).handled);
for (const host of ['https://firestore.googleapis.com/google.firestore.v1.Firestore/Write', 'https://identitytoolkit.googleapis.com/v1/accounts:lookup', 'https://graph.facebook.com/v21.0/x']) {
  expect(`no se interceptan los servicios externos (${new URL(host).hostname})`, !(await run('fetch', { request: { url: host, method: 'GET', mode: 'cors' } })).handled);
}
net.online = true;
const font = await run('fetch', { request: { url: 'https://fonts.gstatic.com/s/jakarta.woff2', method: 'GET', mode: 'cors' } });
expect('las tipografías se guardan para usarlas sin señal', font.handled);

store.set('bandiera-shell-v0', new Map());
await run('activate', {});
expect('al activar se borran los cachés de versiones anteriores', !store.has('bandiera-shell-v0') && store.has('bandiera-shell-v3'));

console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);
