/* =========================================================
   sw.js — v3 (Cache Busting)
   - كاش جديد: telegoat-v3 (يمسح القديم تلقائياً)
   - skipWaiting + clients.claim للتفعيل الفوري
   - تجاهل الطلبات الخارجية (CDN)
========================================================= */

const CACHE_NAME  = 'telegoat-v3';
const CACHE_FILES = [
    './',
    './index.html',
    './theme.css',
    './mobile.css',
    './stats.css',
    './totw.css',
    './trends.css',
    './clubs.css',
    './charts.css',
    './compare.css',
    './splash.css',
    './fpl-database.css',
    './manager-hub.css',
    './manager-squad.css',
    './premier-league-logo.png',
    './icon-512.png'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(CACHE_FILES).catch(function (err) {
                console.warn('[SW] Some files failed to cache:', err);
            });
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.map(function (key) {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', function (event) {
    const url = event.request.url;

    /* تجاهل كل الطلبات الخارجية + non-GET */
    if (event.request.method !== 'GET' ||
        url.indexOf('supabase.co') !== -1 ||
        url.indexOf('workers.dev') !== -1 ||
        url.indexOf('fantasy.premierleague.com') !== -1 ||
        url.indexOf('fonts.googleapis') !== -1 ||
        url.indexOf('fonts.gstatic') !== -1 ||
        url.indexOf('cdn.jsdelivr') !== -1 ||
        url.indexOf('cdnjs.cloudflare') !== -1 ||
        url.indexOf('unpkg.com') !== -1) {
        return; /* لا نستدعي respondWith */
    }

    /* تعامل مع الطلبات المحلية فقط — Network First */
    event.respondWith(
        fetch(event.request).then(function (response) {

            /* تخزين فقط الاستجابات الناجحة */
            if (response && response.status === 200 && response.type === 'basic') {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, clone);
                }).catch(function () {});
            }

            return response;

        }).catch(function () {
            /* fallback: الكاش */
            return caches.match(event.request).then(function (cached) {
                if (cached) return cached;

                /* fallback: صفحة رئيسية للطلبات navigation */
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }

                return new Response('', {
                    status: 408,
                    statusText: 'Offline'
                });
            });
        })
    );
});

/* ---------- FORCE UPDATE ---------- */
self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
