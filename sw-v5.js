// ============================================================
// Telegram Goat - Service Worker v5
// ============================================================

const SW_VERSION    = 'telegoat-v5';
const RUNTIME_CACHE = SW_VERSION + '-runtime';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(SW_VERSION))
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
    const clientList = await self.clients.matchAll({ type: 'window' });
    clientList.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: SW_VERSION }));
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('workers.dev') ||
      url.hostname.includes('fantasy.premierleague.com')) return;

  const isStatic = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
          }
          return res;
        });
      })
    );
  } else {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
