/* =========================================================
   sw.js — Service Worker v1
   - Cache للأصول الأساسية
   - Network-first للمحتوى الحيوي
========================================================= */

const CACHE_NAME  = 'telegoat-v1';
const CACHE_FILES = [
    './',
    './index.html',
    './theme.css',
    './mobile.css',
    './splash.css',
    './compare.css',
    './stats.css',
    './totw.css',
    './clubs.css',
    './charts.css',
    './trends.css',
    './fpl-database.css',
    './manager-hub.css',
    './manager-squad.css',
    './premier-league-logo.png',
    './icon-192.png',
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

    /* تجاهل Supabase و Workers و Google Fonts */
    if (url.indexOf('supabase.co') !== -1 ||
        url.indexOf('workers.dev') !== -1 ||
        url.indexOf('fonts.googleapis') !== -1 ||
        url.indexOf('fonts.gstatic') !== -1 ||
        url.indexOf('cdn.jsdelivr') !== -1 ||
        url.indexOf('cdnjs.cloudflare') !== -1 ||
        event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function (cached) {
            /* Network-first للأصول المحلية */
            const fetchPromise = fetch(event.request).then(function (response) {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(function () {
                return cached;
            });

            return cached || fetchPromise;
        })
    );
});
