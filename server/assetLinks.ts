/**
 * Digital Asset Links para la app de Android (Trusted Web Activity).
 *
 * Android solo abre la web a pantalla completa, sin barra del navegador, si el dominio publica en
 * /.well-known/assetlinks.json el nombre del paquete y la huella SHA-256 de la clave de firma.
 * Se arma desde variables del servidor para no tener que recompilar la web cuando se conoce la huella
 * (con "Firma de apps de Play" la huella la define Google al subir la app).
 *
 *   ANDROID_PACKAGE_NAME=com.ucodigitallab.jobcampo
 *   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:...:FF,11:22:...:99   (una o varias, separadas por coma)
 */
const PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
const FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export interface AssetLinksResult {
  ok: boolean;
  body?: unknown;
  problems: string[];
}

export function buildAssetLinks(env: Record<string, string | undefined>): AssetLinksResult {
  const pkg = (env.ANDROID_PACKAGE_NAME || '').trim();
  const fingerprints = (env.ANDROID_SHA256_CERT_FINGERPRINTS || '')
    .split(',')
    .map(f => f.trim().toUpperCase())
    .filter(Boolean);
  const problems: string[] = [];
  if (!pkg) problems.push('Falta ANDROID_PACKAGE_NAME.');
  else if (!PACKAGE_PATTERN.test(pkg)) problems.push(`El nombre de paquete "${pkg}" no es válido.`);
  if (fingerprints.length === 0) problems.push('Falta ANDROID_SHA256_CERT_FINGERPRINTS.');
  for (const f of fingerprints) {
    if (!FINGERPRINT_PATTERN.test(f)) problems.push(`La huella "${f}" no tiene el formato SHA-256 (32 pares hexadecimales separados por ":").`);
  }
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    problems,
    body: [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fingerprints }
      }
    ]
  };
}
