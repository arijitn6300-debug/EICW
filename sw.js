// EICW Sales Desk - Service Worker
// Caches the app shell so the PWA opens and works with no network signal.
// Bump CACHE_VERSION whenever index.html/manifest.json change to force an update.

const CACHE_VERSION = 'eicw-v60';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// External icons referenced in manifest.json - cached best-effort as opaque
// responses since they're cross-origin (no CORS headers to read, but the
// browser can still store and replay them offline).
const EXTERNAL_ASSETS = [
  'https://cdn-icons-png.flaticon.com/512/3063/3063822.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      const corePromise = cache.addAll(CORE_ASSETS);
      const externalPromise = Promise.all(
        EXTERNAL_ASSETS.map((url) =>
          fetch(url, { mode: 'no-cors' })
            .then((res) => cache.put(url, res))
            .catch(() => {
              // Offline during install, or the CDN is unreachable - not
              // fatal, the icon just won't be cached this time.
            })
        )
      );
      return Promise.all([corePromise, externalPromise]);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first for everything: try the cache, fall back to network, and
// if a fresh network response comes back, quietly update the cache for
// next time. This keeps the app usable offline while still picking up
// changes whenever there IS a connection.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      // Serve from cache immediately if we have it; otherwise wait on network.
      return cached || networkFetch;
    })
  );
});
