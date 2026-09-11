const SUPABASE_URL = 'https://qzsteswrannqsrnlytzl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6c3Rlc3dyYW5ucXNybmx5dHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTExNjgsImV4cCI6MjEwNDI4NzE2OH0.AFYiXODdfDbDiYn1fUoB9e2ZC8i7mFGgLvVxZzSPjxw';

// مهم: نخزّن العميل باسم مختلف عن كلمة supabase المحجوزة
window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * جلب جميع نتائج المباريات من Supabase وتحويلها إلى شكل scoresStorage
 */
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

        data.forEach(row => {
            const round = parseInt(row.round, 10);
            if (!matchweeks || !matchweeks[round]) return;

            const matches = matchweeks[round];
            const idx = matches.findIndex(m =>
                m[0] === row.home_team && m[1] === row.away_team
            );

            if (idx !== -1) {
                if (row.home_score !== null && row.home_score !== undefined) {
                    result[`r${round}_m${idx}_home`] = String(row.home_score);
                }
                if (row.away_score !== null && row.away_score !== undefined) {
                    result[`r${round}_m${idx}_away`] = String(row.away_score);
                }
            }
        });

        return result;
    } catch (e) {
        console.error('خطأ غير متوقع في Supabase:', e);
        return null;
    }
}

/**
 * حفظ نتائج جولة كاملة في Supabase
 */
async function saveRoundToSupabase(round, matchweeks, scoresStorage) {
    try {
        const matches = matchweeks[round] || [];
        const rows = [];

        matches.forEach((match, idx) => {
            const hVal = scoresStorage[`r${round}_m${idx}_home`];
            const aVal = scoresStorage[`r${round}_m${idx}_away`];

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

        const { error: delError } = await window.sbClient
            .from('match_results')
            .delete()
            .eq('round', String(round));

        if (delError) {
            console.error('خطأ في حذف الجولة من Supabase:', delError);
            return { ok: false, error: delError };
        }

        if (rows.length > 0) {
            const { error: insError } = await window.sbClient
                .from('match_results')
                .insert(rows);

            if (insError) {
                console.error('خطأ في إدخال البيانات إلى Supabase:', insError);
                return { ok: false, error: insError };
            }
        }

        console.log(`✅ تم رفع ${rows.length} صف للجولة ${round} إلى Supabase`);
        return { ok: true, count: rows.length };
    } catch (e) {
        console.error('خطأ غير متوقع في saveRoundToSupabase:', e);
        return { ok: false, error: e };
    }
}

/**
 * حذف جميع نتائج جولة معينة من Supabase (تصفير الجولة)
 */
async function clearRoundFromSupabase(round) {
    try {
        const { error } = await window.sbClient
            .from('match_results')
            .delete()
            .eq('round', String(round));

        if (error) {
            console.error('خطأ في حذف الجولة:', error);
            return { ok: false, error: error };
        }

        console.log(`✅ تم حذف صفوف الجولة ${round} من Supabase`);
        return { ok: true };
    } catch (e) {
        console.error('خطأ غير متوقع في clearRoundFromSupabase:', e);
        return { ok: false, error: e };
    }
}
