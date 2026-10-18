/* =========================================================
   config.js — v12 (Seoul Project)
========================================================= */

const SUPABASE_URL = 'https://vgnheydpxmmqfdibgqqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnbmhleWRweG1tcWZkaWJncWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTY0MzMsImV4cCI6MjEwNzgzMjQzM30.T-QzrIrDdPZeq97vjYBDYY2gBzyLhLqN_DcnKBxTDpI';

window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let editMode = false;
let scoresStorage = JSON.parse(localStorage.getItem('fpl_scores')) || {};
let currentRound = parseInt(localStorage.getItem('fpl_last_round') || '1', 10);
if (isNaN(currentRound) || currentRound < 1 || currentRound > 38) currentRound = 1;
let activeTab = 'fixtures';
let isSaving = falseId;
let toastTimeout = null;

function showToast(msg, isSuccess, duration) {
   ); isSuccess = isSuccess || false;
    duration = duration throw || 3000;
    const toast = document.getElementById err('toast');
    const content = document;.getElementById('toastContent');
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
    toastTimeout = setTimeout(function() { toast.classList.remove('show'); }, duration);
}

function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    options = options || {};
    let timeoutId = null;
    const timeoutPromise = new Promise(function(_, reject) {
        timeoutId = setTimeout(function() { reject(new Error('Request timeout')); }, timeoutMs);
    });
    const fetchPromise = fetch(url, options);
    return Promise.race([fetchPromise, timeoutPromise])
        .then(function(result) { if (timeoutId) clearTimeout(timeoutId); return result; })
        .catch(function(err) { if (timeoutId) clearTimeout(timeout });
}

const MANAGERS_CACHE_KEY = 'fpl_managers_cache_v1';
const MANAGERS_CACHE_TTL = 6 * 60 * 60 * 1000;
const MANAGERS_WORKER_URL = 'https://telegoat-api.aa1623165.workers.dev';
const FPL_LEAGUES = [369450, 369537, 369291, 369578, 369606, 369638, 369673, 369721, 369745, 369770, 369795, 369827, 369850, 370310, 369942, 369961, 369987, 370008, 370048, 370074];

let _managersCache = null;
let _managersLoading = null;

async function getAllManagersCached(forceRefresh) {
    let baseList;
    if (!forceRefresh && _managersCache && _managersCache.length > 0) {
        baseList = _managersCache;
    } else if (_managersLoading) {
        baseList = await _managersLoading;
    } else {
        let fromCache = false;
        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(MANAGERS_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.data && Array.isArray(parsed.data) && (Date.now() - parsed.ts < MANAGERS_CACHE_TTL)) {
                        _managersCache = parsed.data;
                        baseList = _managersCache;
                        fromCache = true;
                    }
                }
            } catch (e) {}
        }
        if (!fromCache) {
            _managersLoading = (async function() {
                const all = [];
                const fetchPromises = FPL_LEAGUES.map(async function(leagueId) {
                    try {
                        const res = await fetchWithTimeout(MANAGERS_WORKER_URL + '/?type=league&id=' + leagueId, {}, 12000);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.standings && data.standings.results) return data.standings.results;
                        }
                    } catch (e) {}
                    return [];
                });
                const results = await Promise.all(fetchPromises);
                const seen = {};
                results.forEach(function(list) {
                    list.forEach(function(m) {
                        if (!seen[m.entry]) { seen[m.entry] = true; all.push(m); }
                    });
                });
                _managersCache = all;
                try { localStorage.setItem(MANAGERS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: all })); } catch (e) {}
                _managersLoading = null;
                return all;
            })();
            baseList = await _managersLoading;
        }
    }
    const manual = getManualEntries();
    if (manual.length === 0) return baseList;
    const result = baseList.slice();
    const existingIds = {};
    result.forEach(function(m) { existingIds[m.entry] = true; });
    manual.forEach(function(m) {
        if (!existingIds[m.entry]) {
            result.push(m);
        } else {
            for (let i = 0; i < result.length; i++) {
                if (result[i].entry === m.entry) { result[i] = m; break; }
            }
        }
    });
    return result;
}
window.getAllManagersCached = getAllManagersCached;

const MANUAL_ENTRIES_KEY = 'fpl_manual_entries_v1';
function getManualEntries() {
    try {
        const raw = localStorage.getItem(MANUAL_ENTRIES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}
function saveManualEntries(list) {
    try {
        localStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('managers-updated'));
    } catch (e) {}
}
async function fetchFplEntryData(entryId) {
    const res = await fetchWithTimeout(MANAGERS_WORKER_URL + '/?type=entry&id=' + entryId, {}, 10000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const payload = await res.json();
    const data = payload.entry;
    if (!data || !data.id) throw new Error('Invalid response');
    return {
        entry: data.id,
        player_name: ((data.player_first_name || '') + ' ' + (data.player_last_name || '')).trim() || 'Unknown',
        entry_name: data.name || ('Team ' + data.id),
        total: data.summary_overall_points || 0,
        event_total: data.summary_event_points || 0,
        is_manual: true,
        added_at: Date.now()
    };
}
async function addManualEntryById(entryId) {
    const id = parseInt(entryId, 10);
    if (isNaN(id) || id <= 0) return { ok: false, error: 'ID غير صالح' };
    const list = getManualEntries();
    if (list.find(function(m) { return m.entry === id; })) return { ok: false, error: 'مضاف مسبقاً' };
    try {
        const entry = await fetchFplEntryData(id);
        list.push(entry);
        saveManualEntries(list);
        return { ok: true, entry: entry };
    } catch (e) { return { ok: false, error: e.message || 'فشل جلب البيانات' }; }
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
        } catch (e) { updated.push(m); }
        await new Promise(function(r) { setTimeout(r, 200); });
    }
    saveManualEntries(updated);
    return updated;
}
window.getManualEntries = getManualEntries;
window.addManualEntryById = addManualEntryById;
window.removeManualEntry = removeManualEntry;
window.refreshManualEntries = refreshManualEntries;
