/* =========================================================
   main.js
========================================================= */

async function init() {

    buildCarousel();
    setupCarouselTouch();
    startCarousel();

    initRoundDropdown();

    renderFixtures();
    renderStandings();

    setupEruda();

    if (
        !window.sbClient ||
        typeof loadScoresFromSupabase !== 'function'
    ) {
        console.warn('Supabase client is not available.');
        return;
    }

    try {

        const { error: testError } =
            await window.sbClient
                .from('match_results')
                .select('id')
                .limit(1);

        if (testError) {
            console.warn('DB Connection Error:', testError.message);
            return;
        }

    } catch (connErr) {
        console.warn('Network Error:', connErr.message);
        return;
    }

    try {

        const remoteScores =
            await loadScoresFromSupabase(matchweeks);

        if (
            remoteScores &&
            Object.keys(remoteScores).length > 0
        ) {

            scoresStorage = remoteScores;

            localStorage.setItem(
                'fpl_scores',
                JSON.stringify(scoresStorage)
            );

            renderFixtures();
            renderStandings();
        }

    } catch (e) {
        console.warn('Load from Supabase failed:', e.message);
    }
}

init();
