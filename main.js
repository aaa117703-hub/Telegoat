/* =========================================================
   main.js — v2 (محسّن)
========================================================= */

async function init() {

    /* ====== 1. Carousel ====== */
    buildCarousel();
    setupCarouselTouch();
    if (window.__carouselAutoStart !== false) {
        startCarousel();
    }

    /* ====== 2. Round dropdown + Render ====== */
    if (typeof initRoundDropdown === 'function') initRoundDropdown();
    if (typeof renderFixtures === 'function')   renderFixtures();
    if (typeof renderStandings === 'function')  renderStandings();

    /* ====== 3. Eruda (اختياري) ====== */
    if (typeof setupEruda === 'function') {
        try { setupEruda(); } catch (e) { console.warn('[Eruda]', e); }
    }

    /* ====== 4. Lock system (لا نحجب باقي التهيئة) ====== */
    if (typeof initLockSystem === 'function') {
        initLockSystem().catch(function(e) {
            console.warn('[LockSystem]', e);
        });
    }

    /* ====== 5. Supabase ====== */
    if (!window.sbClient || typeof loadScoresFromSupabase !== 'function') {
        console.warn('[Main] Supabase not available — working offline');
        return;
    }

    if (typeof matchweeks === 'undefined') {
        console.warn('[Main] matchweeks not loaded');
        return;
    }

    try {
        const { error: testError } = await window.sbClient
            .from('match_results')
            .select('id')
            .limit(1);

        if (testError) {
            console.warn('[Main] DB Connection:', testError.message);
            return;
        }
    } catch (connErr) {
        console.warn('[Main] Network:', connErr.message);
        return;
    }

    try {
        const remoteScores = await loadScoresFromSupabase(matchweeks);

        if (remoteScores && Object.keys(remoteScores).length > 0) {
            scoresStorage = remoteScores;

            try {
                localStorage.setItem('fpl_scores', JSON.stringify(scoresStorage));
            } catch (lsErr) {
                console.warn('[Main] localStorage full:', lsErr.message);
            }

            if (typeof renderFixtures === 'function')  renderFixtures();
            if (typeof renderStandings === 'function') renderStandings();
        }
    } catch (e) {
        console.warn('[Main] Load failed:', e.message);
    }
}

/* تشغيل آمن */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
