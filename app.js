const SUPABASE_URL = 'https://qzsteswrannqsrnlytzl.supabase.co';
const SUPABASE_ANON_KEY = 'Sb_publishable_Qa5O7t1wbhPhnTLBtHEfQg_hYYNdxYJ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * جلب جميع نتائج المباريات من Supabase وتحويلها إلى شكل scoresStorage
 * الشكل: { "r1_m0_home": "2", "r1_m0_away": "1", ... }
 */
async function loadScoresFromSupabase(matchweeks) {
    try {
        const { data, error } = await supabase
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
