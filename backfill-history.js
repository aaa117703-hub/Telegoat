/* =========================================================
   backfill-history.js — v4
   - يستخدم getAllManagersCached + fetchWithTimeout
   - localStorage flag بدل count query كل تحميل
========================================================= */

const BACKFILL_WORKER = 'https://fpl-api.aaa117703.workers.dev';
const BACKFILL_FLAG_KEY = 'fpl_backfill_done_v1';
const BACKFILL_FLAG_TTL = 24 * 60 * 60 * 1000; // 24 ساعة

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
   جلب تاريخ مدير واحد
========================================================= */

async function fetchManagerHistory(entryId) {
    try {
        const res = await fetchWithTimeout(
            'https://fantasy.premierleague.com/api/entry/' + entryId + '/history/',
            {},
            8000
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

    const managers = await getAllManagersCached();
    showBackfillDebug('Backfill: got ' + managers.length + ' managers');

    if (!managers || managers.length === 0) {
        showBackfillDebug('Backfill: no managers', true);
        backfillRunning = false;
        return;
    }

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

    // نخزن flag — ما نعيد التشغيل لمدة 24 ساعة
    try {
        localStorage.setItem(BACKFILL_FLAG_KEY, JSON.stringify({
            ts: Date.now(),
            saved: saved
        }));
    } catch (e) {}

    setTimeout(function() {
        const el = document.getElementById('backfillDebug');
        if (el) el.style.display = 'none';
    }, 10000);
}

window.runBackfill = runBackfillWithDebug;

/* =========================================================
   فحص الـ flag المحلي
========================================================= */

function shouldRunBackfill() {
    try {
        const raw = localStorage.getItem(BACKFILL_FLAG_KEY);
        if (!raw) return true;

        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.ts) return true;

        const age = Date.now() - parsed.ts;
        if (age < BACKFILL_FLAG_TTL) {
            return false; // ما نحتاج
        }
        return true;
    } catch (e) {
        return true;
    }
}

/* =========================================================
   تشغيل تلقائي
========================================================= */

function tryAutoBackfill() {
    if (backfillRunning || backfillDone) return;

    if (!shouldRunBackfill()) {
        console.log('[Backfill] Skipped (flag fresh)');
        backfillDone = true;
        return;
    }

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

                try {
                    localStorage.setItem(BACKFILL_FLAG_KEY, JSON.stringify({
                        ts: Date.now(),
                        saved: count
                    }));
                } catch (e) {}

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
