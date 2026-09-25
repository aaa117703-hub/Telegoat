/* =========================================================
   config.js — v2
   - إضافة: showToast (موحّدة)
   - إضافة: fetchWithTimeout
   - إضافة: getAllManagersCached (cache موحّد 6h)
========================================================= */

const SUPABASE_URL =
    'https://qzsteswrannqsrnlytzl.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6c3Rlc3dyYW5ucXNybmx5dHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTExNjgsImV4cCI6MjEwNDI4NzE2OH0.AFYiXODdfDbDiYn1fUoB9e2ZC8i7mFGgLvVxZzSPjxw';

window.sbClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

let editMode = false;

let scoresStorage =
    JSON.parse(
        localStorage.getItem('fpl_scores')
    ) || {};

let currentRound = parseInt(
    localStorage.getItem('fpl_last_round') || '1',
    10
);

if (isNaN(currentRound) || currentRound < 1 || currentRound > 38) {
    currentRound = 1;
}

let activeTab = 'fixtures';

let isSaving = false;

let toastTimeout = null;


/* =========================================================
   SHOW TOAST — موحّدة لجميع الملفات
========================================================= */

function showToast(msg, isSuccess, duration) {
    isSuccess = isSuccess || false;
    duration = duration || 3000;

    const toast = document.getElementById('toast');
    const content = document.getElementById('toastContent');

    if (!toast || !content) return;

    if (toastTimeout) clearTimeout(toastTimeout);

    if (isSuccess) {
        content.innerHTML = 'OK ' + msg;
        toast.classList.remove('error');
    } else {
        content.innerHTML = '<span class="toast-spinner"></span> ' + msg;
        toast.classList.add('error');
    }

    toast.classList.add('show');

    toastTimeout = setTimeout(function() {
        toast.classList.remove('show');
    }, duration);
}


/* =========================================================
   FETCH WITH TIMEOUT — يمنع التعليق اللانهائي
========================================================= */

function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    options = options || {};

    let timeoutId = null;

    const timeoutPromise = new Promise(function(_, reject) {
        timeoutId = setTimeout(function() {
            reject(new Error('Request timeout'));
        }, timeoutMs);
    });

    const fetchPromise = fetch(url, options);

    return Promise.race([fetchPromise, timeoutPromise])
        .then(function(result) {
            if (timeoutId) clearTimeout(timeoutId);
            return result;
        })
        .catch(function(err) {
            if (timeoutId) clearTimeout(timeoutId);
            throw err;
        });
}


/* =========================================================
   UNIFIED MANAGERS CACHE — مصدر واحد لكل المديرين
   تستخدمه: totw / trends / stats / team-view / manager-squad / backfill
========================================================= */

const MANAGERS_CACHE_KEY = 'fpl_managers_cache_v1';
const MANAGERS_CACHE_TTL = 6 * 60 * 60 * 1000;
const MANAGERS_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const MANAGERS_TOTAL_PAGES = 7;

let _managersCache = null;
let _managersLoading = null;

async function getAllManagersCached(forceRefresh) {

    if (!forceRefresh && _managersCache && _managersCache.length > 0) {
        return _managersCache;
    }

    if (_managersLoading) return _managersLoading;

    if (!forceRefresh) {
        try {
            const cached = localStorage.getItem(MANAGERS_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.data && Array.isArray(parsed.data) &&
                    (Date.now() - parsed.ts < MANAGERS_CACHE_TTL)) {
                    _managersCache = parsed.data;
                    return _managersCache;
                }
            }
        } catch (e) {
            console.warn('[Managers] cache read failed:', e.message);
        }
    }

    _managersLoading = (async function() {
        const all = [];

        for (let page = 1; page <= MANAGERS_TOTAL_PAGES; page++) {
            try {
                const res = await fetchWithTimeout(
                    MANAGERS_WORKER_URL + '/?page=' + page
                );

                if (!res.ok) {
                    console.warn('[Managers] page ' + page + ' HTTP ' + res.status);
                    break;
                }

                const data = await res.json();

                if (data && data.standings && data.standings.results) {
                    all.push.apply(all, data.standings.results);
                    if (data.standings.has_next !== true) break;
                } else {
                    break;
                }
            } catch (e) {
                console.warn('[Managers] page ' + page + ' failed:', e.message);
                break;
            }
        }

        _managersCache = all;

        try {
            localStorage.setItem(MANAGERS_CACHE_KEY, JSON.stringify({
                ts: Date.now(),
                data: all
            }));
        } catch (e) {
            console.warn('[Managers] cache write failed:', e.message);
        }

        _managersLoading = null;
        return all;
    })();

    return _managersLoading;
}

window.getAllManagersCached = getAllManagersCached;
