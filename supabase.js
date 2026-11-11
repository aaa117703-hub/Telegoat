/* =========================================================
   supabase.js — v9 (Fixed created_at timestamp)
========================================================= */

async function loadScoresFromSupabase(matchweeks) {
    try {
        const res = await _sbRetry(function () {
            return window.sbResults
                .from('match_results')
                .select('round, home_team, away_team, home_score, away_score')
                .limit(5000);
        });

        if (res.error) {
            console.error('Supabase load error:', res.error);
            return null;
        }

        if (!res.data || res.data.length === 0) {
            return null;
        }

        const result = {};

        res.data.forEach(function(row) {
            const round = parseInt(row.round, 10);

            if (!matchweeks || !matchweeks[round]) {
                return;
            }

            const matches = matchweeks[round];

            const idx = matches.findIndex(function(m) {
                return m[0] === row.home_team && m[1] === row.away_team;
            });

            if (idx === -1) {
                return;
            }

            if (row.home_score !== null && row.home_score !== undefined) {
                result['r' + round + '_m' + idx + '_home'] = String(row.home_score);
            }

            if (row.away_score !== null && row.away_score !== undefined) {
                result['r' + round + '_m' + idx + '_away'] = String(row.away_score);
            }
        });

        return result;
    } catch (e) {
        console.error('Supabase load exception:', e);
        return null;
    }
}


/* ---------- أدوات الصلابة: إعادة محاولة + نسخ احتياطي + طابور معلّق ---------- */
function _sbSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function _sbRetry(fn, tries) {
    tries = tries || 3;
    var last;
    for (var i = 0; i < tries; i++) {
        try {
            var r = await fn();
            if (!r || !r.error) return r;
            last = r;
            /* أخطاء منطقية (صلاحيات/صياغة) لا تنفع معها إعادة المحاولة */
            var code = String(r.error.code || '');
            if (code && !/^(5|08|57|53)/.test(code) && !/fetch|network|timeout/i.test(r.error.message || '')) return r;
        } catch (e) { last = { error: e }; }
        await _sbSleep(500 * Math.pow(2, i));
    }
    return last || { error: new Error('failed') };
}

function _sbLsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
function _sbLsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* نسخة احتياطية محلية لكل جولة (آخر 3 نسخ) */
function _sbBackupRound(round, rows) {
    if (!rows || !rows.length) return;
    var all = _sbLsGet('tg_round_backups', {});
    var list = all[round] || [];
    list.unshift({ ts: Date.now(), rows: rows });
    all[round] = list.slice(0, 3);
    _sbLsSet('tg_round_backups', all);
}

/* طابور الحفظ المعلّق: إذا فشل الحفظ يُعاد تلقائياً */
function _sbQueuePending(round, rows) {
    var q = _sbLsGet('tg_pending_saves', {});
    q[round] = { ts: Date.now(), rows: rows };
    _sbLsSet('tg_pending_saves', q);
}
function _sbDropPending(round) {
    var q = _sbLsGet('tg_pending_saves', {});
    delete q[round];
    _sbLsSet('tg_pending_saves', q);
}

async function _sbWriteRound(round, rows) {
    var codes = Object.keys(teamsMap);
    /* نسخة من الصفوف الحالية في السيرفر لنستعيدها لو فشل الإدخال */
    var cur = await _sbRetry(function () {
        return window.sbResults.from('match_results')
            .select('round, home_team, away_team, home_score, away_score, created_at')
            .eq('round', String(round)).in('home_team', codes);
    });
    if (cur.error) return { ok: false, error: cur.error };
    var oldRows = cur.data || [];
    _sbBackupRound(round, oldRows);

    var del = await _sbRetry(function () {
        return window.sbResults.from('match_results').delete()
            .eq('round', String(round)).in('home_team', codes);
    });
    if (del.error) return { ok: false, error: del.error };

    var ins = await _sbRetry(function () {
        return window.sbResults.from('match_results').insert(rows);
    }, 4);

    if (ins.error) {
        /* فشل الإدخال بعد الحذف → أعد الصفوف القديمة فوراً حتى لا تضيع الجولة */
        if (oldRows.length) {
            await _sbRetry(function () { return window.sbResults.from('match_results').insert(oldRows); }, 4);
        }
        return { ok: false, error: ins.error };
    }

    /* تحقق من أن ما كُتب هو ما أُرسل */
    var chk = await _sbRetry(function () {
        return window.sbResults.from('match_results').select('home_team')
            .eq('round', String(round)).in('home_team', codes);
    });
    if (!chk.error && chk.data && chk.data.length !== rows.length) {
        return { ok: false, error: new Error('verify mismatch: ' + chk.data.length + '/' + rows.length) };
    }
    return { ok: true, count: rows.length };
}

async function saveRoundToSupabase(round, matchweeks, scoresStorage) {
    try {
        const matches = matchweeks[round] || [];
        const rows = [];

        matches.forEach(function (match, idx) {
            const hVal = scoresStorage['r' + round + '_m' + idx + '_home'];
            const aVal = scoresStorage['r' + round + '_m' + idx + '_away'];
            const hasHome = hVal !== undefined && hVal !== '';
            const hasAway = aVal !== undefined && aVal !== '';
            if (hasHome || hasAway) {
                rows.push({
                    round: String(round),
                    home_team: match[0],
                    away_team: match[1],
                    home_score: hasHome ? parseInt(hVal, 10) : null,
                    away_score: hasAway ? parseInt(aVal, 10) : null,
                    created_at: Date.now() /* عمود رقمي في مشروع النتائج */
                });
            }
        });

        /* لا نمسح جولة في السيرفر بحفظ فارغ — الحذف له زر Clear */
        if (rows.length === 0) return { ok: true, count: 0 };

        _sbQueuePending(round, rows);
        const res = await _sbWriteRound(round, rows);
        if (res.ok) _sbDropPending(round);
        else console.error('Save failed (queued for retry):', res.error);
        return res;
    } catch (e) {
        console.error('Save exception:', e);
        return { ok: false, error: e };
    }
}

/* إعادة محاولة الحفظ المعلّق (عند فتح الموقع وعند عودة الإنترنت) */
async function flushPendingSaves() {
    var q = _sbLsGet('tg_pending_saves', {});
    var rounds = Object.keys(q);
    if (!rounds.length || !window.sbResults || typeof teamsMap === 'undefined') return;
    for (var i = 0; i < rounds.length; i++) {
        var r = rounds[i];
        var res = await _sbWriteRound(parseInt(r, 10), q[r].rows);
        if (res.ok) _sbDropPending(r);
    }
    if (typeof showToast === 'function' && !Object.keys(_sbLsGet('tg_pending_saves', {})).length && rounds.length)
        showToast('تم حفظ النتائج المعلّقة ✓', true);
}
window.flushPendingSaves = flushPendingSaves;
window.addEventListener('online', function () { setTimeout(flushPendingSaves, 1000); });
setTimeout(flushPendingSaves, 4000);


async function clearRoundFromSupabase(round) {
    try {
        const res = await _sbRetry(function () {
            return window.sbResults
                .from('match_results')
                .delete()
                .eq('round', String(round))
                .in('home_team', Object.keys(teamsMap));
        });

        if (res.error) {
            console.error('Clear error:', res.error);
            return { ok: false, error: res.error };
        }

        return { ok: true };
    } catch (e) {
        console.error('Clear exception:', e);
        return { ok: false, error: e };
    }
}
