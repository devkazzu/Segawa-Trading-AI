/* Segawa TradeAI service worker — offline app shell.
   Navigation is network-first with a cached shell fallback; static assets are
   cache-first. Trade data lives in localStorage / Supabase, never in the SW. */
const VERSION = 'segawa-v1.0.0';
const SCOPE = self.registration.scope;
const SHELL = [SCOPE, `${SCOPE}index.html`, `${SCOPE}manifest.webmanifest`, `${SCOPE}brand/hiro-segawa.webp`, `${SCOPE}brand/hiro-segawa-og.jpg`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache Supabase / AI traffic
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/functions/v1/') || url.pathname.includes('/auth/v1/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(`${SCOPE}index.html`, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(`${SCOPE}index.html`).then((r) => r || caches.match(SCOPE))),
    );
    return;
  }

  const isAsset = /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico|webmanifest)$/.test(url.pathname);
  if (!isAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => undefined);
        }
        return res;
      });
    }),
  );
});
