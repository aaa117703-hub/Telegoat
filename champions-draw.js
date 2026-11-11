/* =========================================================
   champions-draw.js — TELEGOAT (ported from Finalissima) (v=11)
   🎬 CINEMATIC DRAW — Geometric Modern
   ⭐ v11: عنوان جديد + تخطي/التالي داخل الحاوية + Canvas
========================================================= */

/* =========================================================
   State
========================================================= */

let champDrawState = {
    playing: false,
    currentPot: 0,
    currentTeam: null,
    skipRequested: false,
    sessionStartTime: 0,
    bgAnimFrame: null
};

/* =========================================================
   Audio Engine
========================================================= */

let champAudioCtx = null;

function champInitAudio() {
    try {
        if (!champAudioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                champAudioCtx = new AudioCtx();
            }
        }
        if (champAudioCtx && champAudioCtx.state === 'suspended') {
            champAudioCtx.resume();
        }
    } catch (e) {
        console.warn('[Champ Audio] Init failed:', e);
    }
}

function champPlayWhoosh(duration) { return; }
function champPlayChime() { return; }
function champPlayImpact() { return; }
function champPlayCheer() { return; }
function champPlaySuccess() { return; }

function champPlayTick() {
    if (!champAudioCtx) return;

    try {
        const now = champAudioCtx.currentTime;
        const osc = champAudioCtx.createOscillator();
        const gain = champAudioCtx.createGain();

        osc.type = 'square';
        osc.frequency.value = 2200;

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

        osc.connect(gain);
        gain.connect(champAudioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    } catch (e) {}
}

/* =========================================================
   Haptic
========================================================= */

function champVibrate(pattern) {
    try {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    } catch (e) {}
}

/* =========================================================
   Helpers
========================================================= */

function champWait(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
}

function champShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

function champGetTeamName(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].name || code;
    }
    return code || 'Unknown';
}

function champGetTeamLogo(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].logo || '';
    }
    return '';
}

function champXIcon(name, variant) {
    variant = variant || 'regular';
    const vc = variant === 'fill' ? 'ph-fill' :
               variant === 'bold' ? 'ph-bold' :
               variant === 'duotone' ? 'ph-duotone' : 'ph';
    return '<i class="' + vc + ' ph-' + name + '"></i>';
}

function champIsAdmin() {
    try { return typeof isAdmin === 'function' && isAdmin(); } catch (e) { return false; }
}

/* =========================================================
   ⭐ BACKGROUND CANVAS — Geometric Animation
========================================================= */

function champStartBgCanvas() {
    const canvas = document.getElementById('champBgCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ⭐ Resize */
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    /* ⭐ Shapes — مربعات، مثلثات، سداسيات */
    const shapes = [];
    const SHAPE_COUNT = 22;

    for (let i = 0; i < SHAPE_COUNT; i++) {
        const type = Math.random() < 0.4 ? 'hex' :
                     Math.random() < 0.7 ? 'tri' : 'square';

        shapes.push({
            type: type,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: 15 + Math.random() * 45,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.008,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            opacity: 0.03 + Math.random() * 0.06,
            color: Math.random() < 0.6
                ? 'rgba(167,139,250, OPACITY)'
                : 'rgba(91,33,182, OPACITY)'
        });
    }

    /* ⭐ Particles — نقاط ذهبية */
    const particles = [];
    for (let i = 0; i < 40; i++) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: 0.5 + Math.random() * 1.5,
            vy: -0.15 - Math.random() * 0.3,
            vx: (Math.random() - 0.5) * 0.2,
            opacity: 0.2 + Math.random() * 0.4
        });
    }

    /* ⭐ Draw */
    function drawShape(s) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rotation);
        ctx.lineWidth = 1.2;

        ctx.strokeStyle = s.color.replace('OPACITY', s.opacity);
        ctx.beginPath();

        if (s.type === 'hex') {
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                const px = Math.cos(angle) * s.size;
                const py = Math.sin(angle) * s.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        } else if (s.type === 'tri') {
            const angle = -Math.PI / 2;
            for (let i = 0; i < 3; i++) {
                const a = angle + (Math.PI * 2 / 3) * i;
                const px = Math.cos(a) * s.size;
                const py = Math.sin(a) * s.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        } else {
            const hs = s.size;
            ctx.rect(-hs, -hs, hs * 2, hs * 2);
        }

        ctx.stroke();
        ctx.restore();
    }

    function drawParticle(p) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(167,139,250, ' + p.opacity + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    }

    /* ⭐ Animate */
    function animate() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        shapes.forEach(function(s) {
            s.x += s.vx;
            s.y += s.vy;
            s.rotation += s.rotationSpeed;

            if (s.x < -100) s.x = window.innerWidth + 100;
            if (s.x > window.innerWidth + 100) s.x = -100;
            if (s.y < -100) s.y = window.innerHeight + 100;
            if (s.y > window.innerHeight + 100) s.y = -100;

            drawShape(s);
        });

        particles.forEach(function(p) {
            p.y += p.vy;
            p.x += p.vx;

            if (p.y < -10) {
                p.y = window.innerHeight + 10;
                p.x = Math.random() * window.innerWidth;
            }

            drawParticle(p);
        });

        champDrawState.bgAnimFrame = requestAnimationFrame(animate);
    }

    animate();
}

function champStopBgCanvas() {
    if (champDrawState.bgAnimFrame) {
        cancelAnimationFrame(champDrawState.bgAnimFrame);
        champDrawState.bgAnimFrame = null;
    }
}

/* =========================================================
   ⭐ Progress Bar
========================================================= */

function champShowProgressBar() {
    const old = document.getElementById('champProgressBar');
    if (old) old.remove();

    const bar = document.createElement('div');
    bar.id = 'champProgressBar';
    bar.className = 'champ-progress-bar';

    for (let i = 1; i <= 5; i++) {
        const dot = document.createElement('div');
        dot.className = 'champ-progress-dot';
        dot.dataset.pot = i;
        bar.appendChild(dot);
    }

    document.body.appendChild(bar);

    setTimeout(function() {
        bar.style.opacity = '1';
    }, 100);
}

function champUpdateProgress(potNum) {
    const dots = document.querySelectorAll('.champ-progress-dot');
    dots.forEach(function(dot) {
        const num = parseInt(dot.dataset.pot, 10);
        if (num < potNum) {
            dot.classList.add('done');
            dot.classList.remove('active');
        } else if (num === potNum) {
            dot.classList.add('active');
            dot.classList.remove('done');
        } else {
            dot.classList.remove('active', 'done');
        }
    });
}

function champHideProgressBar() {
    const bar = document.getElementById('champProgressBar');
    if (bar) {
        bar.style.opacity = '0';
        setTimeout(function() { bar.remove(); }, 400);
    }
}

/* =========================================================
   ⭐ Continue Button — INSIDE STICKY FOOTER
========================================================= */

function champGetOrCreateStickyFooter() {
    let footer = document.getElementById('champStickyFooter');
    if (footer) return footer;

    footer = document.createElement('div');
    footer.id = 'champStickyFooter';
    footer.className = 'champ-sticky-footer';

    const screen = document.getElementById('champDrawScreen');
    if (screen) {
        screen.appendChild(footer);
    } else {
        document.body.appendChild(footer);
    }

    return footer;
}

function champShowContinueButton(nextPotNum, onContinue) {
    const footer = champGetOrCreateStickyFooter();

    /* احذف القديم */
    const old = footer.querySelector('#champContinueBtn');
    if (old) old.remove();

    footer.innerHTML = '';
    footer.classList.add('has-btn');

    const btn = document.createElement('button');
    btn.id = 'champContinueBtn';
    btn.className = 'champ-continue-btn';
    btn.type = 'button';

    btn.innerHTML =
        '<span class="champ-continue-icon">' + champXIcon('play-circle', 'fill') + '</span>' +
        '<span class="champ-continue-text">Pot ' + nextPotNum + '</span>';

    let hasClicked = false;

    btn.onclick = function(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (hasClicked) return;
        hasClicked = true;

        champPlayTick();
        champVibrate([20, 10, 20]);

        btn.classList.add('clicked');

        setTimeout(function() {
            btn.style.opacity = '0';
            btn.style.transform = 'translateY(40px) scale(0.85)';

            setTimeout(function() {
                footer.classList.remove('has-btn');
                footer.innerHTML = '';
                onContinue();
            }, 350);
        }, 120);
    };

    footer.appendChild(btn);

    /* ⭐ إظهار موثوق — inline styles */
    btn.style.opacity = '0';
    btn.style.transform = 'translateY(40px) scale(0.85)';

    setTimeout(function() {
        btn.classList.add('show');
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0) scale(1)';
    }, 80);
}

function champWaitForContinueButton(nextPotNum) {
    return new Promise(function(resolve) {
        champShowContinueButton(nextPotNum, function() {
            resolve();
        });
    });
}

function champHideContinueButton() {
    const footer = document.getElementById('champStickyFooter');
    if (footer) {
        footer.classList.remove('has-btn');
        footer.innerHTML = '';
    }
}

/* =========================================================
   ⭐ Skip Button — INSIDE HEADER
========================================================= */

function champShowSkipButton() {
    /* نشيل القديم لو موجود */
    const old = document.getElementById('champSkipBtn');
    if (old) old.remove();

    const header = document.getElementById('champDrawHeader');
    if (!header) return;

    /* زر تخطي داخل الهيدر (يسار) */
    let skipInline = document.getElementById('champSkipBtnInline');
    if (!skipInline) {
        skipInline = document.createElement('button');
        skipInline.id = 'champSkipBtnInline';
        skipInline.className = 'champ-skip-btn-inline';
        skipInline.innerHTML = champXIcon('fast-forward', 'bold') + ' <span>تخطي</span>';
        skipInline.onclick = function() {
            champDrawState.skipRequested = true;
            skipInline.style.opacity = '0';
            skipInline.style.transform = 'scale(0.9)';
            setTimeout(function() {
                if (skipInline) skipInline.style.display = 'none';
            }, 300);
        };

        /* ضعه في البداية */
        header.insertBefore(skipInline, header.firstChild);
    } else {
        skipInline.style.display = '';
        skipInline.style.opacity = '';
        skipInline.style.transform = '';
    }
}

function champHideSkipButton() {
    const btn = document.getElementById('champSkipBtnInline');
    if (btn) {
        btn.style.display = 'none';
    }
}

/* =========================================================
   Main Entry
========================================================= */

function champPerformDraw() {
    if (typeof gsap === 'undefined') {
        if (typeof showToast === 'function') showToast('GSAP not loaded', false);
        return;
    }

    if (!champIsAdmin()) {
        if (typeof showToast === 'function') showToast('غير مصرح', false);
        return;
    }

    if (champDrawState.playing) {
        console.warn('[Champ] Already playing');
        return;
    }

    champInitAudio();
    champPerformDrawAsync();
}

async function champPerformDrawAsync() {
    champDrawState.playing = true;
    champDrawState.skipRequested = false;
    champDrawState.sessionStartTime = Date.now();

    try {
        const pots = await buildPots();
        if (!pots) {
            champDrawState.playing = false;
            if (typeof showToast === 'function') showToast('فشل بناء الـ Pots', false);
            return;
        }

        const drawRows = champGenerateRandomDraw(pots);
        champData.pendingDraw = drawRows;

        try {
            sessionStorage.setItem('champ_pending_draw', JSON.stringify(drawRows));
            console.log('[Champ] pendingDraw backed up:', drawRows.length);
        } catch (e) {
            console.error('[Champ] Backup failed:', e);
        }

        champBuildDrawScreen(pots);

        await champRunCinematicDraw(drawRows, pots);

    } catch (err) {
        console.error('[Champions] Draw error:', err);
        if (typeof showToast === 'function') showToast('فشل: ' + err.message, false, 4000);
    } finally {
        champDrawState.playing = false;
    }
}

/* =========================================================
   Build Draw Screen
========================================================= */

function champBuildDrawScreen(pots) {
    const old = document.getElementById('champDrawScreen');
    if (old) old.remove();

    /* شيل أي footer قديم */
    const oldFooter = document.getElementById('champStickyFooter');
    if (oldFooter) oldFooter.remove();

    const screen = document.createElement('div');
    screen.className = 'champions-draw-screen';
    screen.id = 'champDrawScreen';

    let html = '';

    /* ⭐ Background Canvas */
    html += '<canvas id="champBgCanvas" class="champ-bg-canvas"></canvas>';

    /* ⭐ Preloader */
    html += '<div class="champ-preloader" id="champPreloader">';
    html += '<div class="champ-preloader-logo">';
    html += '<div class="champ-preloader-ring"></div>';
    html += '<div class="champ-preloader-text">FINALISSIMA</div>';
    html += '</div>';
    html += '<div class="champ-preloader-bar"><div class="champ-preloader-fill" id="champPreloaderFill"></div></div>';
    html += '<div class="champ-preloader-status" id="champPreloaderStatus">جاري التحضير...</div>';
    html += '</div>';

    /* ⭐ Intro Overlay */
    html += '<div class="champ-intro-overlay" id="champIntroOverlay" style="display:none;">';
    html += '<div class="champ-intro-text" id="champIntroText"></div>';
    html += '</div>';

    /* ⭐ Main Content */
    html += '<div class="champ-main-content" id="champMainContent" style="opacity:0;">';

    /* Header — العنوان الجديد */
    html += '<div class="champ-draw-header" id="champDrawHeader">';
    /* زر التخطي يُحقن هنا ديناميكياً */
    html += '<div class="champ-draw-spacer"></div>';
    html += '<div class="champ-draw-title-wrap">';
    html += '<div class="champ-draw-title" id="champDrawTitle">';
    html += '<span class="champ-title-deco"></span>';
    html += '<span>قرعة الأبطال</span>';
    html += '<span class="champ-title-deco"></span>';
    html += '</div>';
    html += '<div class="champ-draw-subtitle">FINALISSIMA · CHAMPIONS 2026</div>';
    html += '</div>';
    html += '<div class="champ-draw-spacer"></div>';
    html += '</div>';

    /* Trophy Stage */
    html += '<div class="champ-trophy-stage" id="champTrophyStage">';
    html += '<div class="champ-trophy-glow"></div>';
    html += '<div class="champ-trophy" id="champTrophy">';
    html += '<div class="champ-trophy-arcs">';
    html += '<span class="champ-arc champ-arc-1"></span>';
    html += '<span class="champ-arc champ-arc-2"></span>';
    html += '<span class="champ-arc champ-arc-3"></span>';
    html += '</div>';
    html += '<div class="champ-trophy-logo-wrap">';
    html += '<img src="./icon-512.png" class="champ-trophy-logo" alt="Telegoat" onerror="this.style.display=\'none\'">';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    /* Pots Stage */
    html += '<div class="champ-pots-stage" id="champPotsStage">';
    pots.forEach(function(potTeams, potIdx) {
        const potNum = potIdx + 1;

        html += '<div class="champ-pot-row" data-pot="' + potNum + '" id="champPotRow' + potNum + '">';
        html += '<div class="champ-pot-label">POT ' + potNum + '</div>';
        html += '<div class="champ-pot-teams">';

        potTeams.forEach(function(teamCode) {
            const teamName = champGetTeamName(teamCode);
            const teamLogo = champGetTeamLogo(teamCode);

            html += '<div class="champ-team-card" data-team="' + teamCode + '" data-pot="' + potNum + '" id="champCard-' + teamCode + '">';
            html += '<span class="champ-team-card-check">';
            html += '<i class="ph-fill ph-check-circle"></i>';
            html += '</span>';
            if (teamLogo) {
                html += '<img src="./' + teamLogo + '" onerror="this.style.display=\'none\'">';
            }
            html += '<span class="champ-team-card-name">' + teamName + '</span>';
            html += '</div>';
        });

        html += '</div></div>';
    });
    html += '</div>';

    /* Groups Stage */
    html += '<div class="champ-groups-stage" id="champGroupsStage">';
    CHAMP_GROUPS.forEach(function(g) {
        html += '<div class="champ-group-target" id="champGroupTarget' + g + '" data-group="' + g + '">';
        html += '<div class="champ-group-target-label">' + g + '</div>';
        html += '<div class="champ-group-target-teams" id="champGroupTeams' + g + '"></div>';
        html += '</div>';
    });
    html += '</div>';

    html += '</div>'; /* end main-content */

    /* ⭐ Sticky Footer — يوضع هنا قبل نهاية screen */
    html += '<div class="champ-sticky-footer" id="champStickyFooter"></div>';

    screen.innerHTML = html;
    document.body.appendChild(screen);
}

/* =========================================================
   Cinematic Sequence
========================================================= */

async function champRunCinematicDraw(drawRows, pots) {
    /* شغل الـ Canvas */
    champStartBgCanvas();

    await champStagePreloader();
    if (champDrawState.skipRequested) return;

    await champStageIntro();
    if (champDrawState.skipRequested) return;

    await champStageTrophy();
    if (champDrawState.skipRequested) return;

    await champStagePotsEntry();
    if (champDrawState.skipRequested) return;

    champShowProgressBar();
    champShowSkipButton();

    const potGroups = {};
    drawRows.forEach(function(row) {
        if (!potGroups[row.pot_number]) potGroups[row.pot_number] = [];
        potGroups[row.pot_number].push(row);
    });

    for (let potNum = 1; potNum <= 5; potNum++) {
        if (champDrawState.skipRequested) break;

        const potRows = potGroups[potNum] || [];
        if (potRows.length === 0) continue;

        champDrawState.currentPot = potNum;
        champUpdateProgress(potNum);

        await champStagePotHighlight(potNum);

        for (let i = 0; i < potRows.length; i++) {
            if (champDrawState.skipRequested) break;
            await champStagePickTeam(potRows[i], potNum);
        }

        await champWait(300);

        /* ⭐ إذا مو آخر Pot — انتظر ضغطة الزر */
        if (potNum < 5 && !champDrawState.skipRequested) {
            await champWaitForContinueButton(potNum + 1);
            await champWait(400);
        }
    }

    champHideSkipButton();
    champHideContinueButton();

    await champStageFinale();
    champHideProgressBar();

    /* أوقف الـ Canvas */
    champStopBgCanvas();
}

/* =========================================================
   STAGE 0: Preloader
========================================================= */

async function champStagePreloader() {
    const preloader = document.getElementById('champPreloader');
    const fill = document.getElementById('champPreloaderFill');
    const status = document.getElementById('champPreloaderStatus');

    if (!preloader) return;

    const steps = [
        { pct: 25, text: 'جاري التحميل...' },
        { pct: 50, text: 'تحضير الفرق...' },
        { pct: 75, text: 'تجهيز القرعة...' },
        { pct: 100, text: 'جاهز!' }
    ];

    for (let i = 0; i < steps.length; i++) {
        if (champDrawState.skipRequested) break;

        await new Promise(function(resolve) {
            gsap.to(fill, {
                width: steps[i].pct + '%',
                duration: 0.5,
                ease: 'power2.out',
                onComplete: resolve
            });
            status.textContent = steps[i].text;
        });

        await champWait(200);
    }

    await champWait(400);

    await new Promise(function(resolve) {
        gsap.to(preloader, {
            opacity: 0,
            duration: 0.5,
            onComplete: function() {
                preloader.style.display = 'none';
                resolve();
            }
        });
    });

    const main = document.getElementById('champMainContent');
    if (main) {
        gsap.to(main, { opacity: 1, duration: 0.4 });
    }
}

/* =========================================================
   STAGE 1: Intro
========================================================= */

async function champStageIntro() {
    const overlay = document.getElementById('champIntroOverlay');
    const textEl = document.getElementById('champIntroText');

    if (!overlay || !textEl) return;

    overlay.style.display = 'flex';

    textEl.innerHTML = '<div class="champ-intro-line">CHAMPIONS</div>';
    const line1 = textEl.querySelector('.champ-intro-line');
    gsap.set(line1, { opacity: 0, y: 120, scale: 0.5, filter: 'blur(30px)' });

    await new Promise(function(resolve) {
        gsap.to(line1, {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
            duration: 1.2,
            ease: 'power4.out',
            onComplete: resolve
        });
    });

    await champWait(700);

    await new Promise(function(resolve) {
        gsap.to(line1, {
            scale: 1.5,
            opacity: 0,
            filter: 'blur(40px)',
            duration: 0.35,
            ease: 'power2.in',
            onComplete: resolve
        });
    });

    textEl.innerHTML = '<div class="champ-intro-line champ-intro-cup">CUP</div>';
    const line2 = textEl.querySelector('.champ-intro-line');
    gsap.set(line2, { opacity: 0, scale: 2.5, filter: 'blur(60px)' });

    await new Promise(function(resolve) {
        gsap.to(line2, {
            opacity: 1,
            scale: 1,
            filter: 'blur(0px)',
            duration: 0.9,
            ease: 'power3.out',
            onComplete: resolve
        });
    });

    await champWait(900);

    textEl.innerHTML =
        '<div class="champ-intro-subline">FINALISSIMA</div>' +
        '<div class="champ-intro-year">2026</div>';
    const subline = textEl.querySelector('.champ-intro-subline');
    const year = textEl.querySelector('.champ-intro-year');

    gsap.set([subline, year], { opacity: 0, y: 20 });
    gsap.to(subline, { opacity: 1, y: 0, duration: 0.6, delay: 0.1 });
    gsap.to(year, { opacity: 1, y: 0, duration: 0.6, delay: 0.3 });

    await champWait(1400);

    await new Promise(function(resolve) {
        gsap.to(overlay, {
            opacity: 0,
            duration: 0.7,
            onComplete: function() {
                overlay.style.display = 'none';
                resolve();
            }
        });
    });
}

/* =========================================================
   STAGE 2: Trophy
========================================================= */

async function champStageTrophy() {
    const trophy = document.getElementById('champTrophy');
    const stage = document.getElementById('champTrophyStage');

    if (!trophy || !stage) return;

    gsap.set(stage, { opacity: 0, scale: 0.5 });
    gsap.set(trophy, { scale: 0.4, y: -80 });

    await new Promise(function(resolve) {
        gsap.to(stage, {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            onComplete: resolve
        });
    });

    await new Promise(function(resolve) {
        gsap.to(trophy, {
            y: 0,
            scale: 1,
            duration: 1,
            ease: 'bounce.out',
            onComplete: resolve
        });
    });

    champVibrate([30, 20, 30]);

    await champWait(600);

    gsap.to(stage, {
        scale: 1.05,
        duration: 0.6,
        yoyo: true,
        repeat: 2,
        ease: 'power2.inOut'
    });

    await champWait(1000);

    await new Promise(function(resolve) {
        gsap.to(stage, {
            opacity: 0,
            scale: 0.8,
            duration: 0.6,
            onComplete: function() {
                stage.style.display = 'none';
                resolve();
            }
        });
    });
}

/* =========================================================
   STAGE 3: Pots Entry
========================================================= */

async function champStagePotsEntry() {
    const potRows = document.querySelectorAll('.champ-pot-row');
    const header = document.getElementById('champDrawHeader');
    const potsStage = document.getElementById('champPotsStage');
    const groupsStage = document.getElementById('champGroupsStage');

    gsap.set(header, { opacity: 0, y: -30 });
    await new Promise(function(resolve) {
        gsap.to(header, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            onComplete: resolve
        });
    });

    await champWait(200);

    gsap.set(potsStage, { opacity: 0 });
    gsap.to(potsStage, { opacity: 1, duration: 0.4 });

    gsap.set(potRows, { opacity: 0, x: -80 });

    for (let i = 0; i < potRows.length; i++) {
        await new Promise(function(resolve) {
            gsap.to(potRows[i], {
                opacity: 1,
                x: 0,
                duration: 0.7,
                ease: 'power3.out',
                onComplete: resolve
            });
        });

        await champWait(120);
    }

    await champWait(400);

    const cards = document.querySelectorAll('.champ-team-card');
    gsap.set(cards, { opacity: 0, scale: 0.85 });

    await new Promise(function(resolve) {
        gsap.to(cards, {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.04,
            ease: 'back.out(1.4)',
            onComplete: resolve
        });
    });

    await champWait(300);

    gsap.set(groupsStage, { opacity: 0, y: 30 });
    await new Promise(function(resolve) {
        gsap.to(groupsStage, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            onComplete: resolve
        });
    });

    await champWait(600);
}

/* =========================================================
   STAGE 4: Pot Highlight
========================================================= */

async function champStagePotHighlight(potNum) {
    const potRow = document.getElementById('champPotRow' + potNum);
    if (!potRow) return;

    const label = potRow.querySelector('.champ-pot-label');

    await new Promise(function(resolve) {
        gsap.timeline({ onComplete: resolve })
            .to(potRow, {
                boxShadow: '0 0 40px rgba(167,139,250,.6), inset 0 0 30px rgba(167,139,250,.15)',
                duration: 0.4,
                ease: 'power2.out'
            })
            .to(label, {
                scale: 1.15,
                color: '#F5F3FF',
                textShadow: '0 0 20px rgba(167,139,250,1)',
                duration: 0.3
            }, '-=0.3');
    });

    await champWait(400);
}

/* =========================================================
   STAGE 5: Pick Team
========================================================= */

async function champStagePickTeam(row, potNum) {
    const allPotCards = document.querySelectorAll(
        '.champ-team-card[data-pot="' + potNum + '"]:not(.selected)'
    );
    if (allPotCards.length === 0) return;

    const spotCount = allPotCards.length;
    const totalCycles = 3;

    for (let cycle = 0; cycle < totalCycles; cycle++) {
        for (let i = 0; i < spotCount; i++) {
            if (champDrawState.skipRequested) return;

            gsap.to(allPotCards, {
                borderColor: 'rgba(167,139,250,.5)',
                boxShadow: '0 0 0 rgba(167,139,250,0)',
                scale: 1,
                duration: 0.08
            });

            gsap.to(allPotCards[i], {
                borderColor: '#F5F3FF',
                boxShadow: '0 0 30px rgba(167,139,250,1), 0 0 60px rgba(167,139,250,.6), inset 0 0 20px rgba(167,139,250,.2)',
                scale: 1.04,
                duration: 0.12
            });

            champPlayTick();

            let waitTime = 120;
            if (cycle === 0) {
                waitTime = 220 - (i * 15);
                if (waitTime < 80) waitTime = 80;
            } else if (cycle === totalCycles - 1) {
                waitTime = 80 + (i * 15);
                if (waitTime > 220) waitTime = 220;
            }

            await champWait(waitTime);
        }
    }

    for (let i = 0; i < spotCount; i++) {
        if (champDrawState.skipRequested) return;

        gsap.to(allPotCards, {
            borderColor: 'rgba(167,139,250,.5)',
            boxShadow: '0 0 0 rgba(167,139,250,0)',
            scale: 1,
            duration: 0.1
        });

        gsap.to(allPotCards[i], {
            borderColor: '#F5F3FF',
            boxShadow: '0 0 35px rgba(167,139,250,1), 0 0 70px rgba(167,139,250,.7), inset 0 0 25px rgba(167,139,250,.25)',
            scale: 1.05,
            duration: 0.15
        });

        champPlayTick();
        await champWait(250);
    }

    const targetCard = document.querySelector(
        '.champ-team-card[data-team="' + row.team + '"]'
    );
    if (!targetCard) return;

    gsap.to(allPotCards, {
        borderColor: 'rgba(167,139,250,.3)',
        boxShadow: '0 0 0 rgba(167,139,250,0)',
        scale: 1,
        duration: 0.2
    });

    await champWait(200);

    gsap.to(targetCard, {
        borderColor: '#F5F3FF',
        boxShadow: '0 0 50px rgba(167,139,250,1), 0 0 100px rgba(167,139,250,.8), inset 0 0 30px rgba(167,139,250,.3)',
        scale: 1.1,
        duration: 0.4,
        ease: 'power2.out'
    });

    champVibrate([20, 10, 20]);

    await champWait(600);

    champFlashScreen();

    await champWait(300);

    const teamName = champGetTeamName(row.team);
    const teamLogo = champGetTeamLogo(row.team);

    const cardRect = targetCard.getBoundingClientRect();
    const groupTarget = document.getElementById('champGroupTarget' + row.group_name);
    const groupTeamsEl = document.getElementById('champGroupTeams' + row.group_name);

    if (!groupTarget || !groupTeamsEl) return;

    const groupRect = groupTarget.getBoundingClientRect();

    const startX = cardRect.left + cardRect.width / 2;
    const startY = cardRect.top + cardRect.height / 2;
    const endX = groupRect.left + groupRect.width / 2;
    const endY = groupRect.top + groupRect.height / 2;

    const flyer = document.createElement('div');
    flyer.className = 'champ-flyer';
    flyer.id = 'champFlyer';
    flyer.innerHTML =
        (teamLogo ? '<img src="./' + teamLogo + '" onerror="this.style.display=\'none\'">' : '') +
        '<span>' + teamName + '</span>';

    flyer.style.position = 'fixed';
    flyer.style.left = '0';
    flyer.style.top = '0';
    flyer.style.zIndex = '2147483200';
    flyer.style.pointerEvents = 'none';
    flyer.style.transform = 'translate(' + (startX - 80) + 'px, ' + (startY - 35) + 'px) scale(0.2)';
    flyer.style.opacity = '0';

    document.body.appendChild(flyer);

    const cardImg = targetCard.querySelector('img');
    const cardName = targetCard.querySelector('.champ-team-card-name');

    if (cardImg) gsap.to(cardImg, { opacity: 0.3, scale: 0.8, duration: 0.4 });
    if (cardName) gsap.to(cardName, { opacity: 0.3, duration: 0.4 });

    await new Promise(function(resolve) {
        gsap.to(flyer, {
            opacity: 1,
            scale: 1,
            duration: 0.6,
            ease: 'back.out(1.7)',
            onComplete: resolve
        });
    });

    await champWait(200);

    await champAnimateFlight(flyer, startX, startY, endX, endY);

    flyer.remove();
    champVibrate([40, 20, 40]);

    champScreenShake();

    champSpawnShockwave(endX, endY, 0);
    champSpawnShockwave(endX, endY, 100);
    champSpawnShockwave(endX, endY, 200);

    champSpawnBurst(endX, endY, 40);

    gsap.timeline()
        .to(groupTarget, {
            scale: 1.18,
            boxShadow: '0 0 80px rgba(167,139,250,1), inset 0 0 40px rgba(167,139,250,.5)',
            borderColor: '#A78BFA',
            duration: 0.3,
            ease: 'power2.out'
        })
        .to(groupTarget, {
            scale: 1,
            duration: 0.7,
            ease: 'elastic.out(1, 0.4)'
        })
        .to(groupTarget, {
            boxShadow: '0 0 0 rgba(167,139,250,0)',
            borderColor: 'rgba(167,139,250,0.4)',
            duration: 0.5
        }, '-=0.4');

    const teamHtml =
        '<div class="champ-group-team-item">' +
            (teamLogo ? '<img src="./' + teamLogo + '" onerror="this.style.display=\'none\'">' : '') +
            '<span>' + teamName + '</span>' +
        '</div>';
    groupTeamsEl.insertAdjacentHTML('beforeend', teamHtml);

    const newTeam = groupTeamsEl.lastElementChild;
    gsap.fromTo(newTeam,
        { opacity: 0, scale: 0.4, y: -30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(2)' }
    );

    await new Promise(function(resolve) {
        gsap.to(targetCard, {
            background: 'rgba(15,15,18,.55)',
            borderColor: 'rgba(167,139,250,.15)',
            boxShadow: '0 0 0 rgba(167,139,250,0)',
            opacity: 0.45,
            scale: 1,
            duration: 0.5,
            onComplete: function() {
                targetCard.classList.add('selected');
                resolve();
            }
        });
    });

    if (cardImg) gsap.to(cardImg, { filter: 'grayscale(0.7) brightness(0.6)', duration: 0.5 });
    if (cardName) gsap.to(cardName, { color: 'rgba(250,246,240,.3)', duration: 0.5 });

    const checkEl = targetCard.querySelector('.champ-team-card-check');
    if (checkEl) {
        gsap.to(checkEl, {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: 'back.out(2)'
        });
    }

    await champWait(500);
}

/* =========================================================
   Flight Animation
========================================================= */

async function champAnimateFlight(flyer, startX, startY, endX, endY) {
    return new Promise(function(resolve) {
        const duration = 1.6;
        const startTime = performance.now();
        const midX = (startX + endX) / 2;
        const midY = Math.min(startY, endY) - 220;

        let lastTrailTime = 0;
        let rotation = 0;

        function animate(now) {
            if (champDrawState.skipRequested) {
                flyer.style.transform = 'translate(' + (endX - 80) + 'px, ' + (endY - 35) + 'px) scale(1)';
                resolve();
                return;
            }

            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;

            const mt = 1 - eased;
            let x = mt*mt*mt*startX
                  + 3*mt*mt*eased*midX
                  + 3*mt*eased*eased*midX
                  + eased*eased*eased*endX;

            let y = mt*mt*mt*startY
                  + 3*mt*mt*eased*midY
                  + 3*mt*eased*eased*midY
                  + eased*eased*eased*endY;

            const spiralStrength = Math.sin(eased * Math.PI) * 30;
            const spiralPhase = eased * Math.PI * 6;
            x += Math.cos(spiralPhase) * spiralStrength * 0.4;
            y += Math.sin(spiralPhase) * spiralStrength * 0.3;

            const scale = 1 + Math.sin(eased * Math.PI) * 0.5;
            rotation += 25;
            const brightness = 1.3 + Math.sin(eased * Math.PI * 3) * 0.4;

            flyer.style.transform =
                'translate(' + (x - 80) + 'px, ' + (y - 35) + 'px) ' +
                'rotate(' + rotation + 'deg) ' +
                'scale(' + scale + ')';

            flyer.style.filter = 'brightness(' + brightness + ') drop-shadow(0 0 20px rgba(167,139,250,.8))';

            if (now - lastTrailTime > 18) {
                lastTrailTime = now;
                champSpawnTrail(x, y);
            }

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}

/* =========================================================
   Screen Shake + Flash
========================================================= */

function champScreenShake() {
    const screen = document.getElementById('champDrawScreen');
    if (!screen) return;

    const tl = gsap.timeline();

    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 12;
        const y = (Math.random() - 0.5) * 12;
        const rot = (Math.random() - 0.5) * 0.6;

        tl.to(screen, { x: x, y: y, rotation: rot, duration: 0.04 });
    }

    tl.to(screen, { x: 0, y: 0, rotation: 0, duration: 0.15, ease: 'power2.out' });
}

function champFlashScreen() {
    const flash = document.createElement('div');
    flash.className = 'champ-screen-flash';
    document.body.appendChild(flash);

    gsap.fromTo(flash,
        { opacity: 0.85 },
        {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: function() {
                flash.remove();
            }
        }
    );
}

/* =========================================================
   Spawn Effects
========================================================= */

function champSpawnTrail(x, y) {
    const p = document.createElement('div');
    p.className = 'champ-trail-particle';
    p.style.left = x + 'px';
    p.style.top = y + 'px';

    const hue = Math.random() * 20 + 30;
    p.style.filter = 'hue-rotate(' + hue + 'deg)';

    document.body.appendChild(p);

    gsap.fromTo(p,
        { opacity: 1, scale: 1.3 },
        {
            opacity: 0,
            scale: 0.1,
            duration: 0.7,
            ease: 'power2.out',
            onComplete: function() { p.remove(); }
        }
    );
}

function champSpawnShockwave(x, y, delay) {
    setTimeout(function() {
        const w = document.createElement('div');
        w.className = 'champ-shockwave';
        w.style.left = x + 'px';
        w.style.top = y + 'px';
        document.body.appendChild(w);

        gsap.fromTo(w,
            { opacity: 0.9, scale: 0 },
            {
                opacity: 0,
                scale: 5,
                duration: 1.1,
                ease: 'power2.out',
                onComplete: function() { w.remove(); }
            }
        );
    }, delay);
}

function champSpawnBurst(x, y, count) {
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'champ-burst-particle';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        document.body.appendChild(p);

        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const distance = 80 + Math.random() * 180;
        const duration = 0.9 + Math.random() * 0.6;

        gsap.fromTo(p,
            { opacity: 1, scale: 1, x: 0, y: 0 },
            {
                opacity: 0,
                scale: 0.2,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                duration: duration,
                ease: 'power2.out',
                onComplete: function() { p.remove(); }
            }
        );
    }
}

/* =========================================================
   STAGE 10: Finale
========================================================= */

async function champStageFinale() {
    champSpawnConfetti(120);
    champVibrate([100, 50, 100]);

    const titleEl = document.getElementById('champDrawTitle');
    if (titleEl) {
        await new Promise(function(resolve) {
            gsap.to(titleEl, { opacity: 0, y: -20, duration: 0.4, onComplete: resolve });
        });

        titleEl.innerHTML =
            '<span class="champ-title-deco"></span>' +
            '<span>اكتملت القرعة</span>' +
            '<span class="champ-title-deco"></span>';

        await new Promise(function(resolve) {
            gsap.fromTo(titleEl,
                { opacity: 0, y: 20, scale: 0.8 },
                { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.7)', onComplete: resolve }
            );
        });
    }

    await champWait(800);
    champSpawnConfetti(80);
    await champWait(600);
    champSpawnConfetti(60);
    await champWait(1000);

    champShowDrawButtons();
}

/* =========================================================
   Draw Buttons
========================================================= */

function champShowDrawButtons() {
    if (!champIsAdmin()) return;

    const old = document.getElementById('champDrawActions');
    if (old) return;

    const groupsStage = document.getElementById('champGroupsStage');
    if (!groupsStage) return;

    const actions = document.createElement('div');
    actions.className = 'champ-draw-actions';
    actions.id = 'champDrawActions';

    actions.innerHTML =
        '<button class="champ-btn-save" id="champBtnSave" onclick="champSaveAndClose()">' +
            champXIcon('floppy-disk', 'fill') + ' <span>حفظ القرعة</span>' +
        '</button>' +
        '<button class="champ-btn-reset" id="champBtnReset" onclick="champResetFromDraw()">' +
            champXIcon('arrows-clockwise', 'bold') + ' <span>إعادة القرعة</span>' +
        '</button>';

    groupsStage.parentElement.appendChild(actions);

    gsap.fromTo(actions,
        { opacity: 0, y: 40, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.5)', delay: 0.2 }
    );
}

/* =========================================================
   Save & Close
========================================================= */

async function champSaveAndClose() {
    if (!champIsAdmin()) return;

    const saveBtn = document.getElementById('champBtnSave');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = champXIcon('hourglass', 'bold') + ' <span>جاري الحفظ...</span>';
    }

    let drawRows = champData.pendingDraw;

    if (!drawRows || drawRows.length === 0) {
        try {
            const backup = sessionStorage.getItem('champ_pending_draw');
            if (backup) {
                drawRows = JSON.parse(backup);
                champData.pendingDraw = drawRows;
            }
        } catch (e) {}
    }

    if (!drawRows) drawRows = [];

    if (drawRows.length === 0) {
        if (typeof showToast === 'function') showToast('لا توجد قرعة للحفظ', false);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = champXIcon('floppy-disk', 'fill') + ' <span>حفظ القرعة</span>';
        }
        return;
    }

    try {
        await champSaveDraw(drawRows);
        champData.pendingDraw = null;

        try { sessionStorage.removeItem('champ_pending_draw'); } catch (e) {}

        const startGw = (typeof currentRound !== 'undefined' ? currentRound : 1) + 1;

        await saveChampionsMeta({
            started: true,
            start_gw: startGw,
            current_stage: 'groups',
            current_round: 1
        });

        if (typeof showToast === 'function') {
            showToast('تم حفظ القرعة — بدأ دور المجموعات', true, 3000);
        }

        const screen = document.getElementById('champDrawScreen');
        if (screen) {
            gsap.to(screen, {
                opacity: 0,
                duration: 0.5,
                onComplete: function() {
                    champStopBgCanvas();
                    screen.remove();
                    champLoaded = false;
                    loadChampions();
                }
            });
        }

    } catch (err) {
        console.error('[Champ Save] Error:', err);
        if (typeof showToast === 'function') showToast('فشل الحفظ', false);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = champXIcon('floppy-disk', 'fill') + ' <span>حفظ القرعة</span>';
        }
    }
}

function champResetFromDraw() {
    if (!champIsAdmin()) return;

    if (!confirm('هل أنت متأكد؟ سيتم حذف القرعة الحالية والبدء من جديد.')) return;

    const screen = document.getElementById('champDrawScreen');
    if (screen) {
        gsap.to(screen, {
            opacity: 0,
            duration: 0.4,
            onComplete: function() {
                champStopBgCanvas();
                screen.remove();
                champData.pendingDraw = null;
                try { sessionStorage.removeItem('champ_pending_draw'); } catch (e) {}
                champHideSkipButton();
                champHideProgressBar();
                champHideContinueButton();

                setTimeout(function() {
                    champPerformDraw();
                }, 300);
            }
        });
    }
}

window.champSaveAndClose = champSaveAndClose;
window.champResetFromDraw = champResetFromDraw;

/* =========================================================
   Confetti
========================================================= */

function champSpawnConfetti(count) {
    const colors = ['#A78BFA', '#F5F3FF', '#5B21B6', '#2D1B4E', '#F5F3FF', '#E5D4A5'];

    for (let i = 0; i < count; i++) {
        const c = document.createElement('div');
        c.className = 'champ-confetti';

        c.style.left = Math.random() * 100 + '%';
        c.style.top = '-20px';
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        const size = 6 + Math.random() * 10;
        c.style.width = size + 'px';
        c.style.height = size + 'px';

        if (Math.random() > 0.6) {
            c.style.borderRadius = '50%';
        } else if (Math.random() > 0.5) {
            c.style.borderRadius = '2px';
            c.style.width = (size * 0.5) + 'px';
            c.style.height = (size * 1.5) + 'px';
        } else {
            c.style.borderRadius = '50% 0 50% 0';
        }

        c.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
        document.body.appendChild(c);

        const duration = 3 + Math.random() * 2.5;
        const xDrift = (Math.random() - 0.5) * 300;
        const rotationEnd = Math.random() * 1440 - 720;

        gsap.to(c, {
            y: window.innerHeight + 60,
            x: xDrift,
            rotation: rotationEnd,
            opacity: 0.3,
            duration: duration,
            delay: Math.random() * 1.5,
            ease: 'power1.in',
            onComplete: function() { c.remove(); }
        });
    }
}

/* =========================================================
   Cleanup
========================================================= */

function champCleanup() {
    const idsToRemove = [
        'champSkipBtn',
        'champSkipBtnInline',
        'champProgressBar',
        'champFlyer',
        'champContinueBtn',
        'champStickyFooter'
    ];

    idsToRemove.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    document.querySelectorAll(
        '.champ-trail-particle, .champ-shockwave, .champ-burst-particle, .champ-confetti, .champ-screen-flash'
    ).forEach(function(el) {
        el.remove();
    });

    champStopBgCanvas();

    champDrawState.playing = false;
    champDrawState.skipRequested = false;
    champDrawState.currentPot = 0;
}

window.champCleanup = champCleanup;

/* =========================================================
   Safety Timeout
========================================================= */

function champStartSafetyTimeout() {
    setTimeout(function() {
        if (champDrawState.playing) {
            console.warn('[Champ] Safety timeout');
            champCleanup();
            if (typeof showToast === 'function') {
                showToast('انتهى الوقت المسموح', false, 3000);
            }
        }
    }, 15 * 60 * 1000);
}

/* =========================================================
   Main Entry Override
========================================================= */

const champPerformDrawOld = champPerformDraw;

window.champPerformDraw = function() {
    champStartSafetyTimeout();
    champPerformDrawOld();
};

/* =========================================================
   Window Exports
========================================================= */

window.champIsAdmin = champIsAdmin;
window.champInitAudio = champInitAudio;
window.champPlayWhoosh = champPlayWhoosh;
window.champPlayChime = champPlayChime;
window.champPlayImpact = champPlayImpact;
window.champPlayCheer = champPlayCheer;
window.champPlaySuccess = champPlaySuccess;
window.champSpawnConfetti = champSpawnConfetti;
window.champShowContinueButton = champShowContinueButton;
window.champShowSkipButton = champShowSkipButton;
window.champHideSkipButton = champHideSkipButton;

console.log('[Champions Draw] v=11 loaded — new title + sticky footer + canvas');
