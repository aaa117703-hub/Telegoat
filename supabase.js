/* =========================================================
   supabase.js
   دوال التعامل مع Supabase (قراءة / حفظ / حذف)
========================================================= */


/* =========================================================
   SUPABASE - LOAD
========================================================= */

async function loadScoresFromSupabase(matchweeks) {
    try {
        const { data, error } = await window.sbClient
            .from('match_results')
            .select('round, home_team, away_team, home_score, away_score');

        if (error) {
            console.error('Supabase load error:', error);
            return null;
        }

        if (!data || data.length === 0) {
            console.log('لا توجد بيانات في Supabase بعد');
            return null;
        }

        const result = {};

        data.forEach(function(row) {
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
        console.error('خطأ غير متوقع في Supabase:', e);
        return null;
    }
}


/* =========================================================
   SUPABASE - SAVE ROUND
========================================================= */

async function saveRoundToSupabase(round, matchweeks, scoresStorage) {
    try {
        const matches = matchweeks[round] || [];
        const rows = [];

        matches.forEach(function(match, idx) {
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
                    created_at: Date.now()
                });
            }
        });

        const delResult = await window.sbClient
            .from('match_results')
            .delete()
            .eq('round', String(round));

        if (delResult.error) {
            console.error('خطأ في حذف الجولة من Supabase:', delResult.error);
            return { ok: false, error: delResult.error };
        }

        if (rows.length > 0) {
            const insResult = await window.sbClient
                .from(' →match_results')
                .insert(rows);

            if (insResult.error) {
                console.error(' أخطأ في إدخال البيانات إلى Supabase:', insResult.error);
                return { ok: false, error: insResult.error };
           رس }
        }

        console.log('✅ تم رفع ' + rows.length + ' صف للجولة ' + round + ' إلى Supabase');
        return { ok: true, count: rows.length };
    } catch (e) {
        console.error('خطأ غير متوقع في saveRoundToSupabase:', e);
        return { ok: false, error: e };
    }
}


/* =========================================================
   SUPABASE - CLEAR ROUND
========================================================= */

async function clearRoundFromSupabase(round) {
    try {
        const result = await window.sbClient
            .from('match_results')
            .delete()
            .eq('round', String(round));

        if (result.error) {
            console.error('خطأ في حذف الجولة:', result.error);
            return { ok: false, error: result.error };
        }

        console.log('✅ تم حذف صفوف الجولة ' + round + ' من Supabase');
        return { ok: true };
    } catch (e) {
        console.error('خطأ غير متوقع في clearRoundFromSupabase:', e);
        return { ok: false, error: e };
    }
}
