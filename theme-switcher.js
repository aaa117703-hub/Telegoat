/* =========================================================
   theme-switcher.js
   تبديل التصميم من داخل لوحة التعديل
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
   TOGGLE THEME - تبديل التصميم
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
   INIT THEME - تطبيق التصميم المحفوظ
========================================================= */

function initTheme() {

    if (currentTheme === 'theme2') {
        applyTheme('theme2');
    } else {
        applyTheme('default');
    }
}
