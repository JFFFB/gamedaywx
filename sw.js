const CACHE_VERSION = 'gamedaywx-v8';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const API_MAX_ENTRIES = 80;
const API_MAX_AGE_MS = 36 * 3600 * 1000;

const SHELL_ASSETS = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-180.png', './icon-maskable-512.png'
];

const API_HOSTS = ['open-meteo.com', 'espn.com', 'api.weather.gov'];

// No skipWaiting() here: a new worker waits so the page can show the
// "update ready" banner and trigger SKIP_WAITING when the user taps Reload.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // allSettled so one missing asset can't abort the whole install
      Promise.allSettled(SHELL_ASSETS.map((a) => cache.add(a)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('gamedaywx-') && k !== SHELL_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function putApi(request, response) {
  const cache = await caches.open(API_CACHE);
  const headers = new Headers(response.headers);
  headers.set('x-sw-cached-at', String(Date.now()));
  const stamped = new Response(await response.blob(), {
    status: response.status, statusText: response.statusText, headers
  });
  await cache.put(request, stamped);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - API_MAX_ENTRIES; i++) await cache.delete(keys[i]);
}

async function apiFallback(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const at = Number(cached.headers.get('x-sw-cached-at') || 0);
    if (!at || Date.now() - at < API_MAX_AGE_MS) return cached;
    await cache.delete(request);
  }
  return new Response(JSON.stringify({ offline: true, error: 'Cached data unavailable' }), {
    status: 503, headers: { 'Content-Type': 'application/json' }
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (API_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) event.waitUntil(putApi(request, res.clone()));
          return res;
        })
        .catch(() => apiFallback(request))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('./index.html', clone));
          }
          return res;
        })
        .catch(async () => (await caches.match('./index.html')) || (await caches.match(request)))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const net = fetch(request)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
