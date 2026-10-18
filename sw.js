// ============================================================
// Telegram Goat - Service Worker v4
// Fix: "Load failed" on iOS Safari
// Strategy:
//   - HTML / JS / CSS  -> Network-first (always fresh)
//   - Images / Fonts   -> Cache-first
//   - Cross-origin     -> BYPASS (Supabase, Worker, FPL)
// ============================================================

const SW_VERSION    = 'telegoat-v4';
const RUNTIME_CACHE = SW_VERSION + '-runtime';

// ---------- INSTALL: activate immediately ----------
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

// ---------- ACTIVATE: wipe ALL old caches + claim tabs ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1) Delete every cache that doesn't belong to v4
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(SW_VERSION))
          .map(k => caches.delete(k))
    );

    // 2) Take control of all open tabs instantly
    await self.clients.claim();

    // 3) Tell clients to reload once (handled in index.html)
    const clientList = await self.clients.matchAll({ type: 'window' });
    clientList.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: SW_VERSION }));
  })());
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass ALL cross-origin requests entirely (Supabase, Worker, FPL, etc.)
  if (url.origin !== self.location.origin) return;

  // Extra safety net for same-origin edge cases
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('workers.dev') ||
      url.hostname.includes('fantasy.premierleague.com')) return;

  const isStatic = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);

  if (isStatic) {
    // Cache-first for images & fonts
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
    // Network-first for HTML / JS / CSS
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req)) // offline fallback
    );
  }
});

// ---------- MESSAGE: manual update trigger ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
