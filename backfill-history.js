/* =========================================================
   backfill-history.js — v2
   يجيب نقاط كل جولة لكل مدير من FPL API
   ويحفظها في Supabase (manager_history)
   + تشغيل تلقائي عند فتح الموقع
========================================================= */

const BACKFILL_WORKER = 'https://fpl-api.aaa117703.workers.dev';
const BACKFILL_PAGES = 7;

let backfillRunning = false;
let backfillDone = false;

/* =========================================================
   جلب كل المديرين من الـ API
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
   جلب كل جولات مدير واحد من FPL API
========================================================= */

async function fetchManagerHistory(entryId) {
    try {
        const res = await fetch(
            'https://fantasy.premierleague.com/api/entry/' + entryId + '/history/'
        );

        if (!res.ok) {
            console.warn('[Backfill] entry ' + entryId + ' HTTP ' + res.status);
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
        console.error('[Backfill] entry ' + entryId + ' failed:', e);
        return [];
    }
}

/* =========================================================
   الحفظ في Supabase
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

async function runBackfill() {
    if (backfillRunning || backfillDone) return;

    if (!window.sbClient) {
        console.warn('[Backfill] No Supabase client');
        return;
    }

    backfillRunning = true;
    console.log('[Backfill] Starting...');

    const managers = await fetchAllManagers();
    console.log('[Backfill] Fetched', managers.length, 'managers');

    let done = 0;
    let saved = 0;

    let buffer = [];

    for (let i = 0; i < managers.length; i++) {
        const m = managers[i];
        const entryId = m.entry;

        const rows = await fetchManagerHistory(entryId);
        buffer.push(...rows);
        done++;

        if (buffer.length >= 100 || i === managers.length - 1) {
            const ok = await saveHistoryBatch(buffer);
            if (ok) saved += buffer.length;
            buffer = [];
        }

        // تأخير بسيط لتجنب rate limit
        await new Promise(function(r) { setTimeout(r, 150); });

        if (done % 20 === 0) {
            console.log('[Backfill] Progress: ' + done + '/' + managers.length);
        }
    }

    console.log('[Backfill] Done! Saved', saved, 'rows');
    backfillRunning = false;
    backfillDone = true;
}

window.runBackfill = runBackfill;

/* =========================================================
   تشغيل تلقائي عند فتح الموقع
========================================================= */

window.addEventListener('load', function() {
    setTimeout(function() {
        if (!window.sbClient) {
            console.warn('[Backfill] sbClient not ready, skip');
            return;
        }

        window.sbClient
            .from('manager_history')
            .select('*', { count: 'exact', head: true })
            .then(function(res) {
                const count = (res && res.count) || 0;
                console.log('[Backfill] Current rows:', count);

                if (count < 100) {
                    console.log('[Backfill] Table empty, running...');
                    runBackfill();
                } else {
                    console.log('[Backfill] Already populated, skipping.');
                    backfillDone = true;
                }
            })
            .catch(function(e) {
                console.warn('[Backfill] Check failed:', e);
            });
    }, 5000); // انتظر 5 ثواني حتى يجهز كل شي
});
