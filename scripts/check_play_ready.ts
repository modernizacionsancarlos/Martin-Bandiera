// Verifica que una dirección web cumpla lo que Google Play (Trusted Web Activity) exige antes de publicar.
//
// Uso:  npx tsx scripts/check_play_ready.ts https://app.dominio.com [--paquete=com.ucodigitallab.jobcampo]
// Cada punto sale como OK, AVISO o ERROR. Termina con código 1 si hay algún ERROR.
const args = process.argv.slice(2);
const base = (args.find(a => a.startsWith('http')) ?? '').replace(/\/$/, '');
const expectedPackage = args.find(a => a.startsWith('--paquete='))?.split('=')[1];

if (!base) {
  console.error('Indicá la dirección: npx tsx scripts/check_play_ready.ts https://app.dominio.com');
  process.exit(1);
}

let errors = 0;
let warnings = 0;
const ok = (msg: string) => console.log('  OK     ' + msg);
const warn = (msg: string) => {
  warnings++;
  console.log('  AVISO  ' + msg);
};
const bad = (msg: string) => {
  errors++;
  console.log('  ERROR  ' + msg);
};

const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);

async function get(path: string): Promise<Response | null> {
  try {
    return await fetch(base + path, { redirect: 'follow' });
  } catch {
    return null;
  }
}

function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

console.log(`Verificando ${base}\n`);

console.log('Dominio');
if (base.startsWith('https://')) ok('usa HTTPS');
else if (isLocal) warn('es una dirección local (localhost): sirve para probar, pero Google Play exige un dominio propio con HTTPS.');
else bad('no usa HTTPS: Google Play solo acepta HTTPS.');

console.log('\nManifiesto');
const manifestRes = await get('/manifest.webmanifest');
let manifest: any = null;
if (!manifestRes || !manifestRes.ok) bad('no se pudo leer /manifest.webmanifest.');
else {
  try {
    manifest = await manifestRes.json();
    ok('se lee /manifest.webmanifest');
  } catch {
    bad('/manifest.webmanifest no es un JSON válido.');
  }
}
if (manifest) {
  manifest.name && manifest.short_name ? ok(`nombre "${manifest.name}" / corto "${manifest.short_name}"`) : bad('faltan name o short_name.');
  manifest.display === 'standalone' || manifest.display === 'fullscreen' ? ok(`display: ${manifest.display}`) : bad('display debe ser standalone o fullscreen.');
  manifest.start_url ? ok(`start_url: ${manifest.start_url}`) : bad('falta start_url.');
  const icons: any[] = manifest.icons ?? [];
  const sizes = new Set(icons.map(i => `${i.sizes}/${i.purpose ?? 'any'}`));
  sizes.has('512x512/any') ? ok('hay un ícono de 512x512') : bad('falta un ícono de 512x512 (purpose any).');
  sizes.has('192x192/any') ? ok('hay un ícono de 192x192') : bad('falta un ícono de 192x192.');
  icons.some(i => (i.purpose ?? '').includes('maskable')) ? ok('hay un ícono adaptable (maskable)') : warn('falta un ícono maskable: en Android se verá con un marco blanco.');
  for (const icon of icons) {
    const res = await get(icon.src);
    if (!res || !res.ok) {
      bad(`no se puede descargar el ícono ${icon.src}`);
      continue;
    }
    const size = pngSize(Buffer.from(await res.arrayBuffer()));
    const [w, h] = String(icon.sizes).split('x').map(Number);
    size && size.w === w && size.h === h ? ok(`el ícono ${icon.src} mide ${icon.sizes}`) : bad(`el ícono ${icon.src} no mide ${icon.sizes} (${size ? `${size.w}x${size.h}` : 'no es PNG'}).`);
  }
}

console.log('\nService worker (abre sin señal)');
const sw = await get('/sw.js');
if (!sw || !sw.ok) bad('no se pudo leer /sw.js.');
else {
  const type = sw.headers.get('content-type') ?? '';
  /javascript/.test(type) ? ok('/sw.js se sirve como JavaScript') : bad(`/sw.js se sirve como "${type}": el navegador lo rechaza.`);
  const cacheControl = sw.headers.get('cache-control') ?? '';
  /max-age=(\d{6,})/.test(cacheControl) ? warn('/sw.js tiene un caché largo: las actualizaciones tardarían en llegar.') : ok('/sw.js no tiene un caché largo');
}

console.log('\nVínculo con la app de Android (assetlinks.json)');
const links = await get('/.well-known/assetlinks.json');
if (!links || !links.ok) warn('todavía no hay /.well-known/assetlinks.json (se activa con ANDROID_PACKAGE_NAME y ANDROID_SHA256_CERT_FINGERPRINTS). Sin él, la app mostrará una barra del navegador.');
else if (/html/.test(links.headers.get('content-type') ?? '')) warn('/.well-known/assetlinks.json devuelve la página principal (HTML) en vez del vínculo: todavía no está configurado (ANDROID_PACKAGE_NAME y ANDROID_SHA256_CERT_FINGERPRINTS en el servidor).');
else {
  try {
    const body: any[] = await links.json();
    const target = body?.[0]?.target;
    const pkg = target?.package_name;
    const fps: string[] = target?.sha256_cert_fingerprints ?? [];
    target?.namespace === 'android_app' && pkg && fps.length ? ok(`paquete ${pkg} con ${fps.length} huella(s)`) : bad('assetlinks.json no tiene el formato esperado.');
    if (expectedPackage) pkg === expectedPackage ? ok('el paquete coincide con el esperado') : bad(`el paquete (${pkg}) no coincide con ${expectedPackage}.`);
    if (!/json/.test(links.headers.get('content-type') ?? '')) warn('assetlinks.json no se sirve como application/json.');
  } catch {
    bad('assetlinks.json no es un JSON válido.');
  }
}

console.log('\nPolítica de privacidad');
const privacy = await get('/privacidad.html');
if (!privacy || !privacy.ok) bad('no se encuentra /privacidad.html (Google Play exige una dirección pública).');
else {
  ok('/privacidad.html responde');
  const html = await privacy.text();
  /BORRADOR/.test(html) ? warn('la política todavía dice BORRADOR: revisarla con un asesor legal y completar los datos entre corchetes antes de publicar.') : ok('la política no tiene la marca de borrador');
  /\[[^\]]+\]/.test(html.replace(/<[^>]+>/g, '')) && warn('la política tiene datos pendientes entre corchetes.');
}

console.log(`\n${errors} error(es), ${warnings} aviso(s).`);
process.exitCode = errors ? 1 : 0;
