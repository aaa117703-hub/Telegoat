/* =========================================================
   splash.js — v1
   - مدة: 5 ثواني
   - يدعم التخطي باللمس/الضغط
========================================================= */

(function () {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;

    document.body.classList.add('splash-active');

    let finished = false;
    const timers = [];

    function schedule(fn, ms) {
        const t = setTimeout(fn, ms);
        timers.push(t);
        return t;
    }

    /* ---------- Particle Burst at 3.9s ---------- */
    schedule(function () {
        const container = document.getElementById('splashParticles');
        if (!container) return;

        const COLORS = ['#A78BFA', '#C4B5FD', '#EDE9FE', '#7C3AED', '#FFFFFF'];
        const N = 32;

        for (let i = 0; i < N; i++) {
            const p = document.createElement('span');
            const ang = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
            const dist = 170 + Math.random() * 150;
            const x = Math.cos(ang) * dist;
            const y = Math.sin(ang) * dist;
            const size = 3 + Math.random() * 4;
            const col = COLORS[(Math.random() * COLORS.length) | 0];

            p.style.width  = size + 'px';
            p.style.height = size + 'px';
            p.style.background = col;
            p.style.boxShadow  = '0 0 10px ' + col + ', 0 0 22px ' + col;
            p.style.transition =
                'transform 1s cubic-bezier(0.16,1,0.3,1), opacity 1s ease';

            container.appendChild(p);

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    p.style.opacity = '1';
                    p.style.transform =
                        'translate(-50%,-50%) translate(' + x + 'px,' + y + 'px) scale(0.25)';
                });
                setTimeout(function () { p.style.opacity = '0'; }, 400);
            });
        }
    }, 3900);

    /* ---------- Reveal site at 4.4s ---------- */
    schedule(function () {
        document.body.classList.add('splash-revealing');
    }, 4400);

    /* ---------- Hide splash at 4.5s ---------- */
    schedule(function () {
        if (finished) return;
        finished = true;
        splash.classList.add('hide');
    }, 4500);

    /* ---------- Remove from DOM at 5.1s ---------- */
    schedule(function () {
        splash.classList.add('done');
        document.body.classList.remove('splash-active');
        document.body.classList.remove('splash-revealing');
    }, 5100);

    /* ---------- Skip on tap/click ---------- */
    function skip() {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);

        document.body.classList.add('splash-revealing');
        splash.classList.add('hide');

        setTimeout(function () {
            splash.classList.add('done');
            document.body.classList.remove('splash-active');
            document.body.classList.remove('splash-revealing');
        }, 550);
    }

    splash.addEventListener('click', skip);
    splash.addEventListener('touchstart', skip, { passive: true });
})();
