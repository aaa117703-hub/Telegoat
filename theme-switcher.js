/* =========================================================
   theme-switcher.js
   تبديل التصميم بضغطة طويلة على MATCHWEEK
========================================================= */


/* =========================================================
   APPLY THEME
========================================================= */

function applyTheme(theme) {

    const body = document.body;

    if (theme === 'theme2') {
        body.classList.add('theme-2');
    } else {
        body.classList.remove('theme-2');
    }

    currentTheme = theme;
    localStorage.setItem('site_theme', theme);
}


/* =========================================================
   TOGGLE THEME
========================================================= */

function toggleTheme() {

    if (currentTheme === 'theme2') {

        applyTheme('default');

        if (typeof showToast === 'function') {
            showToast('Theme: Default', true, 2000);
        }

    } else {

        applyTheme('theme2');

        if (typeof showToast === 'function') {
            showToast('Theme: Modern', true, 2000);
        }
    }
}


/* =========================================================
   SETUP LONG PRESS ON MATCHWEEK
   ضغطة طويلة (800ms) = تبديل التصميم
========================================================= */

function setupLongPress() {

    const titleEl = document.getElementById('currentRoundTitle');

    if (!titleEl) {
        console.warn('currentRoundTitle not found');
        return;
    }

    let pressTimer = null;
    let longPressTriggered = false;


    /* ========== TOUCH (الموبايل) ========== */

    titleEl.addEventListener('touchstart', function(event) {

        longPressTriggered = false;

        pressTimer = setTimeout(function() {

            longPressTriggered = true;
            toggleTheme();

        }, 800);

    }, { passive: true });


    titleEl.addEventListener('touchend', function(event) {

        clearTimeout(pressTimer);

        if (longPressTriggered) {
            event.preventDefault();
        }

    });


    titleEl.addEventListener('touchcancel', function() {

        clearTimeout(pressTimer);
        longPressTriggered = false;
    });


    /* ========== MOUSE (الكمبيوتر) ========== */

    titleEl.addEventListener('mousedown', function(event) {

        longPressTriggered = false;

        pressTimer = setTimeout(function() {

            longPressTriggered = true;
            toggleTheme();

        }, 800);
    });


    titleEl.addEventListener('mouseup', function() {

        clearTimeout(pressTimer);
    });


    titleEl.addEventListener('mouseleave', function() {

        clearTimeout(pressTimer);
        longPressTriggered = false;
    });
}


/* =========================================================
   INIT THEME
========================================================= */

function initTheme() {

    /* تطبيق التصميم المحفوظ */
    if (currentTheme === 'theme2') {
        applyTheme('theme2');
    } else {
        applyTheme('default');
    }

    /* تفعيل الضغطة الطويلة */
    setupLongPress();
}
