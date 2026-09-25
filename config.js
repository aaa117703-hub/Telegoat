/* =========================================================
   config.js — v3
   - إضافة: نظام Manual Entries (إضافة مديرين بالـ ID)
   - إضافة: زر تحديث يدوي
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
   SHOW TOAST
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
   FETCH WITH TIMEOUT
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
   UNIFIED MANAGERS CACHE
========================================================= */

const MANAGERS_CACHE_KEY = 'fpl_managers_cache_v1';
const MANAGERS_CACHE_TTL = 6 * 60 * 60 * 1000;
const MANAGERS_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const MANAGERS_TOTAL_PAGES = 7;

let _managersCache = null;
let _managersLoading = null;

async function getAllManagersCached(forceRefresh) {

    let baseList;

    if (!forceRefresh && _managersCache && _managersCache.length > 0) {
        baseList = _managersCache;
    } else if (_managersLoading) {
        baseList = await _managersLoading;
    } else {
        // Try localStorage first
        let fromCache = false;

        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(MANAGERS_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.data && Array.isArray(parsed.data) &&
                        (Date.now() - parsed.ts < MANAGERS_CACHE_TTL)) {
                        _managersCache = parsed.data;
                        baseList = _managersCache;
                        fromCache = true;
                    }
                }
            } catch (e) {
                console.warn('[Managers] cache read failed:', e.message);
            }
        }

        if (!fromCache) {
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

            baseList = await _managersLoading;
        }
    }

    // ⭐ دمج Manual Entries دائماً (طازجة من localStorage)
    const manual = getManualEntries();

    if (manual.length === 0) {
        return baseList;
    }

    const result = baseList.slice();
    const existingIds = {};
    result.forEach(function(m) { existingIds[m.entry] = true; });

    manual.forEach(function(m) {
        if (!existingIds[m.entry]) {
            result.push(m);
        } else {
            // لو موجود في FPL — استبدل بياناته بالبيانات الطازجة (manual)
            for (let i = 0; i < result.length; i++) {
                if (result[i].entry === m.entry) {
                    result[i] = m;
                    break;
                }
            }
        }
    });

    return result;
}

window.getAllManagersCached = getAllManagersCached;


/* =========================================================
   MANUAL ENTRIES — إضافة مديرين بالـ ID
========================================================= */

const MANUAL_ENTRIES_KEY = 'fpl_manual_entries_v1';


function getManualEntries() {
    try {
        const raw = localStorage.getItem(MANUAL_ENTRIES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveManualEntries(list) {
    try {
        localStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(list));
        // إشعار باقي الأقسام
        window.dispatchEvent(new CustomEvent('managers-updated'));
    } catch (e) {
        console.warn('[Manual] Save failed:', e.message);
    }
}


async function fetchFplEntryData(entryId) {
    const res = await fetchWithTimeout(
        'https://fantasy.premierleague.com/api/entry/' + entryId + '/',
        {},
        8000
    );

    if (!res.ok) {
        throw new Error('HTTP ' + res.status);
    }

    const data = await res.json();
    if (!data || !data.id) {
        throw new Error('Invalid response');
    }

    const playerName = (
        (data.player_first_name || '') + ' ' + (data.player_last_name || '')
    ).trim() || 'Unknown';

    return {
        entry: data.id,
        player_name: playerName,
        entry_name: data.name || ('Team ' + data.id),
        total: data.summary_overall_points || 0,
        event_total: data.summary_event_points || 0,
        is_manual: true,
        added_at: Date.now()
    };
}


async function addManualEntryById(entryId) {
    const id = parseInt(entryId, 10);

    if (isNaN(id) || id <= 0) {
        return { ok: false, error: 'ID غير صالح' };
    }

    const list = getManualEntries();

    if (list.find(function(m) { return m.entry === id; })) {
        return { ok: false, error: 'مضاف مسبقاً' };
    }

    try {
        const entry = await fetchFplEntryData(id);
        list.push(entry);
        saveManualEntries(list);
        return { ok: true, entry: entry };
    } catch (e) {
        return { ok: false, error: e.message || 'فشل جلب البيانات' };
    }
}


function removeManualEntry(entryId) {
    const id = parseInt(entryId, 10);
    const list = getManualEntries().filter(function(m) { return m.entry !== id; });
    saveManualEntries(list);
    return list;
}


async function refreshManualEntries() {
    const list = getManualEntries();
    if (list.length === 0) return [];

    const updated = [];

    for (let i = 0; i < list.length; i++) {
        const m = list[i];
        try {
            const fresh = await fetchFplEntryData(m.entry);
            fresh.added_at = m.added_at || Date.now();
            updated.push(fresh);
        } catch (e) {
            console.warn('[Manual] Refresh failed for', m.entry, e.message);
            updated.push(m);
        }
        // تأخير بسيط بين الطلبات
        await new Promise(function(r) { setTimeout(r, 200); });
    }

    saveManualEntries(updated);
    return updated;
}


window.getManualEntries = getManualEntries;
window.addManualEntryById = addManualEntryById;
window.removeManualEntry = removeManualEntry;
window.refreshManualEntries = refreshManualEntries;
