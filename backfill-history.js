/* =========================================================
   backfill-history.js — v3
   مع شريط تشخيص مرئي
========================================================= */

const BACKFILL_WORKER = 'https://fpl-api.aaa117703.workers.dev';
const BACKFILL_PAGES = 7;

let backfillRunning = false;
let backfillDone = false;

/* =========================================================
   شريط تشخيص
========================================================= */

function showBackfillDebug(text, isError) {
    let el = document.getElementById('backfillDebug');
    if (!el) {
        el = document.createElement('div');
        el.id = 'backfillDebug';
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#000;color:#0f0;padding:10px;font-family:monospace;font-size:11px;z-index:999999;text-align:center;font-weight:bold;';
        document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.textContent = text;
    el.style.background = isError ? '#800' : '#000';
}

/* =========================================================
   جلب كل المديرين
========================================================= */

async function fetchAllManagers() {
    const all = [];

    for (let page = 1; page <= BACKFILL_PAGES; page++) {
        try {
            const res = await fetch(BACKFILL_WORKER + '/?page=' + page);
            const data = await res.json();

            if (data && data.standings && data.standings.results) {
                all.push(...data.standings.results);
                if (data.standings.has_next !== true) break;
            } else {
                break;
            }
        } catch (e) {
            console.error('[Backfill] Page ' + page + ' failed:', e);
            break;
        }
    }

    return all;
}

/* =========================================================
   جلب تاريخ مدير واحد
========================================================= */

async function fetchManagerHistory(entryId) {
    try {
        const res = await fetch(
            'https://fantasy.premierleague.com/api/entry/' + entryId + '/history/'
        );

        if (!res.ok) {
            return [];
        }

        const data = await res.json();
        if (!data || !data.current) return [];

        return data.current.map(function(gw) {
            return {
                entry: entryId,
                event: gw.event,
                points: gw.points || 0,
                total_points: gw.total_points || 0,
                overall_rank: gw.overall_rank || 0
            };
        });

    } catch (e) {
        return [];
    }
}

/* =========================================================
   حفظ دفعة
========================================================= */

async function saveHistoryBatch(rows) {
    if (!window.sbClient) return false;
    if (!rows || rows.length === 0) return false;

    try {
        const { error } = await window.sbClient
            .from('manager_history')
            .upsert(rows, { onConflict: 'entry,event' });

        if (error) {
            console.error('[Backfill] Save error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('[Backfill] Save exception:', e);
        return false;
    }
}

/* =========================================================
   التشغيل الرئيسي
========================================================= */

async function runBackfillWithDebug() {
    if (backfillRunning || backfillDone) return;
    if (!window.sbClient) {
        showBackfillDebug('Backfill: no Supabase client', true);
        return;
    }

    backfillRunning = true;
    showBackfillDebug('Backfill: fetching managers...');

    const managers = await fetchAllManagers();
    showBackfillDebug('Backfill: got ' + managers.length + ' managers');

    let done = 0;
    let saved = 0;
    let buffer = [];

    for (let i = 0; i < managers.length; i++) {
        const m = managers[i];
        const rows = await fetchManagerHistory(m.entry);
        buffer.push(...rows);
        done++;

        if (buffer.length >= 100 || i === managers.length - 1) {
            const ok = await saveHistoryBatch(buffer);
            if (ok) saved += buffer.length;
            buffer = [];
        }

        await new Promise(function(r) { setTimeout(r, 150); });

        if (done % 10 === 0) {
            showBackfillDebug('Backfill: ' + done + '/' + managers.length + ' · saved=' + saved);
        }
    }

    showBackfillDebug('Backfill: DONE! saved=' + saved + ' rows');

    backfillRunning = false;
    backfillDone = true;

    setTimeout(function() {
        const el = document.getElementById('backfillDebug');
        if (el) el.style.display = 'none';
    }, 10000);
}

window.runBackfill = runBackfillWithDebug;

/* =========================================================
   تشغيل تلقائي
========================================================= */

function tryAutoBackfill() {
    if (backfillRunning || backfillDone) return;

    showBackfillDebug('Backfill: checking...');

    if (!window.sbClient) {
        showBackfillDebug('Backfill: waiting for sbClient...');
        setTimeout(tryAutoBackfill, 3000);
        return;
    }

    window.sbClient
        .from('manager_history')
        .select('*', { count: 'exact', head: true })
        .then(function(res) {
            const count = (res && res.count) || 0;
            showBackfillDebug('Backfill: current rows=' + count);

            if (count < 100) {
                showBackfillDebug('Backfill: table empty, starting...');
                runBackfillWithDebug();
            } else {
                showBackfillDebug('Backfill: already populated (' + count + ' rows)');
                backfillDone = true;
                setTimeout(function() {
                    const el = document.getElementById('backfillDebug');
                    if (el) el.style.display = 'none';
                }, 3000);
            }
        })
        .catch(function(e) {
            showBackfillDebug('Backfill check failed: ' + e.message, true);
        });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(tryAutoBackfill, 5000);
    });
} else {
    setTimeout(tryAutoBackfill, 5000);
}
