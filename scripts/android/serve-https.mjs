// Sirve una carpeta compilada (por ejemplo dist-demo) por HTTPS local con un certificado propio de PRUEBA.
// La app de Android (Trusted Web Activity) abre siempre https://<host>, así que para probarla en el emulador
// hace falta HTTPS. El certificado se genera con el keytool del JDK y no se guarda en el proyecto.
//
// Uso:  node scripts/android/serve-https.mjs [carpeta=dist-demo] [puerto=3443]
//       adb reverse tcp:3101 tcp:3443        (el emulador ve la web como https://localhost:3101)
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = path.resolve(process.argv[2] ?? 'dist-demo');
const port = Number(process.argv[3] ?? 3443);
if (!fs.existsSync(path.join(dir, 'index.html'))) {
  console.error(`No hay index.html en ${dir}. Compilar primero (npx vite build --mode demo --outDir dist-demo).`);
  process.exit(1);
}

const jdk = process.env.JAVA_HOME;
const keytool = jdk ? path.join(jdk, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
const pfx = path.join(os.tmpdir(), 'job-campo-prueba.pfx');
const pass = 'prueba-local';
if (!fs.existsSync(pfx)) {
  execFileSync(keytool, ['-genkeypair', '-alias', 'localhost', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '30', '-storetype', 'PKCS12',
    '-keystore', pfx, '-storepass', pass, '-keypass', pass, '-dname', 'CN=localhost', '-ext', 'SAN=dns:localhost,ip:127.0.0.1'], { stdio: 'ignore' });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };

https.createServer({ pfx: fs.readFileSync(pfx), passphrase: pass }, (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(dir, url === '/' ? 'index.html' : url);
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html'); // la app es de una sola página
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': file.endsWith('sw.js') ? 'no-cache' : 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`HTTPS de prueba en https://localhost:${port} sirviendo ${dir}`));
