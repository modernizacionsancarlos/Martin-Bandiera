/* Service worker de JOB Martin Bandiera.
 *
 * Objetivo: que la app abra aunque no haya señal (en la finca) y cargue rápido.
 * - Pantallas (navegación): primero la red; si falla o tarda, la última copia guardada.
 * - Archivos de la app con nombre único (/assets/*): primero el caché (nunca cambian).
 * - Íconos, manifiesto y tipografías: se sirven del caché y se actualizan de fondo.
 * - NUNCA se guardan: /api/*, Firestore, Firebase Auth ni ninguna otra llamada a servicios.
 *   Los datos offline los maneja la base (caché persistente de Firestore), no este archivo.
 */
const VERSION = 'v3';
const SHELL_CACHE = `bandiera-shell-${VERSION}`;
const ASSET_CACHE = `bandiera-assets-${VERSION}`;
const MAX_ASSET_ENTRIES = 120;
const NAVIGATION_TIMEOUT_MS = 4000;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// Los servidores suelen responder "Vary: Origin"; sin esto, un módulo pedido con otro encabezado no encuentra su copia guardada.
const MATCH_OPTIONS = { ignoreVary: true };

// Archivos de la aplicación (con nombre único) que la pantalla principal necesita para abrir sin señal.
// Se leen de la propia pantalla principal y de los módulos que esta carga, porque la primera visita
// termina de cargar antes de que el service worker controle la página y esos archivos no pasarían por él.
async function precacheAppAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const html = await (await fetch('/')).text();
  const found = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)) found.add(m[1]);
  for (const url of [...found]) {
    if (!url.endsWith('.js')) continue;
    try {
      const code = await (await fetch(url)).text();
      // Módulos cargados bajo demanda (import("./Nombre-hash.js")): también se guardan.
      for (const m of code.matchAll(/["']\.\/([A-Za-z0-9_.-]+\.(?:js|css))["']/g)) found.add('/assets/' + m[1]);
    } catch {
      // se reintenta cuando la pantalla lo pida
    }
  }
  await Promise.all(
    [...found].slice(0, MAX_ASSET_ENTRIES).map(async url => {
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // ignorado: se guardará la primera vez que se use
      }
    })
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => precacheAppAssets().catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL_CACHE, ASSET_CACHE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSET_ENTRIES; i++) await cache.delete(keys[i]);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS);
    if (response.ok) cache.put('/', response.clone());
    return response;
  } catch {
    // Sin señal (o muy lenta): se abre la última copia de la aplicación.
    return (await cache.match('/', MATCH_OPTIONS)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request, MATCH_OPTIONS);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
    trimCache(ASSET_CACHE);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request, MATCH_OPTIONS);
  const refresh = fetch(request)
    .then(response => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // Llamadas al servidor propio (IA, administración de usuarios, fotos): siempre a la red.
    if (url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') {
      event.respondWith(networkFirstNavigation(request));
      return;
    }
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request));
      return;
    }
    if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  if (FONT_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(request));
  // Todo lo demás (Firebase, Google APIs, Meta, etc.) pasa directo a la red.
});
