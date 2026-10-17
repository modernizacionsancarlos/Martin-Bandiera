// Pruebas de server/assetLinks.ts. Ejecutar: npx tsx scripts/assetlinks.test.ts
import { buildAssetLinks } from '../server/assetLinks';

let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(ok ? '  ok   ' : '  FALLA', name, ok ? '' : detail);
};
const fp = (byte: string) => Array(32).fill(byte).join(':');

const good = buildAssetLinks({ ANDROID_PACKAGE_NAME: 'com.ucodigitallab.jobcampo', ANDROID_SHA256_CERT_FINGERPRINTS: fp('ab') });
expect('con paquete y huella válidos arma el vínculo', good.ok === true);
const entry = (good.body as any)?.[0];
expect('tiene el formato que exige Android', entry?.relation?.[0] === 'delegate_permission/common.handle_all_urls' && entry.target.namespace === 'android_app');
expect('normaliza la huella a mayúsculas', entry?.target.sha256_cert_fingerprints[0] === fp('AB'));
const two = buildAssetLinks({ ANDROID_PACKAGE_NAME: 'com.ucodigitallab.jobcampo', ANDROID_SHA256_CERT_FINGERPRINTS: `${fp('11')} , ${fp('22')}` });
expect('admite varias huellas (clave de carga y clave de Google Play)', (two.body as any)?.[0].target.sha256_cert_fingerprints.length === 2);
expect('sin configuración no inventa nada', buildAssetLinks({}).ok === false && buildAssetLinks({}).problems.length === 2);
expect('rechaza un paquete mal escrito', buildAssetLinks({ ANDROID_PACKAGE_NAME: 'jobcampo', ANDROID_SHA256_CERT_FINGERPRINTS: fp('ab') }).ok === false);
expect('rechaza una huella con formato incorrecto', buildAssetLinks({ ANDROID_PACKAGE_NAME: 'com.a.b', ANDROID_SHA256_CERT_FINGERPRINTS: 'AA:BB' }).ok === false);
expect('rechaza una huella SHA-1 (20 pares) en lugar de SHA-256', buildAssetLinks({ ANDROID_PACKAGE_NAME: 'com.a.b', ANDROID_SHA256_CERT_FINGERPRINTS: Array(20).fill('AA').join(':') }).ok === false);

console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);
