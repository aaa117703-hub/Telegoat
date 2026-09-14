/* =========================================================
   main.js
   نقطة التشغيل الرئيسية للتطبيق
========================================================= */


/* =========================================================
   INITIALIZE - تشغيل التطبيق
========================================================= */

async function init() {

    /* =====================================================
       1) CAROUSEL - البنرات
    ===================================================== */

    buildCarousel();

    setupCarouselTouch();

    startCarousel();


    /* =====================================================
       2) ROUND SELECTOR - قائمة الجولات
    ===================================================== */

    initRoundDropdown();


    /* =====================================================
       3) INITIAL UI - الواجهة الأولية
    ===================================================== */

    renderFixtures();

    renderStandings();

    setupEruda();


    /* =====================================================
       4) INIT THEME - تفعيل التصميم (الضغطة الطويلة)
    ===================================================== */

    initTheme();


    /* =====================================================
       5) SUPABASE CONNECTION TEST
    ===================================================== */

    if (
        !window.sbClient ||
        typeof loadScoresFromSupabase !== 'function'
    ) {

        console.warn(
            'Supabase client is not available.'
        );

        return;
    }

    try {

        const { error: testError } =
            await window.sbClient
                .from('match_results')
                .select('id')
                .limit(1);

        if (testError) {

            console.warn(
                'DB Connection Error:',
                testError.message
            );

            return;
        }

    } catch (connErr) {

        console.warn(
            'Network Error:',
            connErr.message
        );

        return;
    }


    /* =====================================================
       6) LOAD RESULTS FROM SUPABASE
    ===================================================== */

    try {

        const remoteScores =
            await loadScoresFromSupabase(
                matchweeks
            );

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

        console.warn(
            'Load from Supabase failed:',
            e.message
        );
    }
}


/* =========================================================
   START APPLICATION
========================================================= */

init();
