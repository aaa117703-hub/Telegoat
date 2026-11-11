/* =========================================================
   download.js — v25
   - Dark Luxury Theme
   - ألوان متناسقة مع الثيم الداكن
   - console logging للتشخيص
   - إصلاح محتمل لمشكلة html2canvas
========================================================= */

function waitForImagesToLoad(element) {
    const images = Array.from(element.querySelectorAll('img'));

    return Promise.all(images.map(function(img) {
        if (img.complete && img.naturalWidth > 0) {
            if (img.decode) {
                return img.decode().catch(function() {});
            }
            return Promise.resolve();
        }

        return new Promise(function(resolve) {
            let finished = false;

            const finish = function() {
                if (finished) return;
                finished = true;
                img.removeEventListener('load', finish);
                img.removeEventListener('error', finish);
                resolve();
            };

            img.addEventListener('load', finish, { once: true });
            img.addEventListener('error', finish, { once: true });

            setTimeout(finish, 5000);
        });
    }));
}


function applyRoundedCorners(sourceCanvas, radius) {
    try {
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = w;
        outputCanvas.height = h;

        const ctx = outputCanvas.getContext('2d');

        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(w - radius, 0);
        ctx.quadraticCurveTo(w, 0, w, radius);
        ctx.lineTo(w, h - radius);
        ctx.quadraticCurveTo(w, h, w - radius, h);
        ctx.lineTo(radius, h);
        ctx.quadraticCurveTo(0, h, 0, h - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(sourceCanvas, 0, 0);

        return outputCanvas;

    } catch (e) {
        console.warn('[DL] applyRoundedCorners failed:', e);
        return sourceCanvas;
    }
}


function dlDebug(text, isError) {
    if (isError) {
        console.error('[DL]', text);
    } else {
        console.log('[DL]', text);
    }
}


function toggleDownloadMenu(event) {
    if (event) event.stopPropagation();

    const menu = document.getElementById('downloadMenu');
    const wrapper = document.getElementById('downloadWrapper');

    if (!menu) return;

    const isOpen = menu.classList.toggle('show');

    if (wrapper) {
        wrapper.classList.toggle('open', isOpen);
    }
}


function closeDownloadMenu() {
    const menu = document.getElementById('downloadMenu');
    const wrapper = document.getElementById('downloadWrapper');

    if (menu) menu.classList.remove('show');
    if (wrapper) wrapper.classList.remove('open');
}


document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.download-wrapper');
    if (!wrapper) return;
    if (!wrapper.contains(e.target)) {
        closeDownloadMenu();
    }
});


function getActiveTabName() {
    const fixturesTab = document.getElementById('fixturesTab');
    const standingsTab = document.getElementById('standingsTab');
    const totwTab = document.getElementById('totwTab');
    const statsTab = document.getElementById('statsTab');

    const cupTab = document.getElementById('cupTab');
    const champTab = document.getElementById('championsTab');
    if (cupTab && cupTab.classList.contains('active')) return 'cup';
    if (champTab && champTab.classList.contains('active')) return 'champions';
    if (totwTab && totwTab.classList.contains('active')) return 'totw';
    if (standingsTab && standingsTab.classList.contains('active')) return 'standings';
    if (statsTab && statsTab.classList.contains('active')) return 'stats';
    if (fixturesTab && fixturesTab.classList.contains('active')) return 'fixtures';

    if (typeof window.activeTab !== 'undefined') return window.activeTab;

    return 'fixtures';
}


function isCanvasTainted(canvas) {
    try {
        canvas.getContext('2d').getImageData(0, 0, 1, 1);
        return false;
    } catch (e) {
        return true;
    }
}


/* =========================================================
   IMAGE MODAL — Dark Theme
========================================================= */

function showImageModal(blob, filename) {
    const old = document.getElementById('dlImageModal');
    if (old) {
        const oldUrl = old.dataset.blobUrl;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        old.remove();
    }

    const url = URL.createObjectURL(blob);

    const modal = document.createElement('div');
    modal.id = 'dlImageModal';
    modal.dataset.blobUrl = url;
    modal.style.cssText = [
        'position:fixed',
        'inset:0',
        'background:rgba(0,0,0,0.95)',
        'z-index:9999999',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'padding:16px',
        'overflow-y:auto',
        'direction:rtl',
        'font-family:inherit'
    ].join(';');

    modal.innerHTML =
        '<div style="text-align:center;color:#A78BFA;margin-bottom:10px;font-weight:900;font-size:15px;letter-spacing:0.5px;padding:8px 12px;background:rgba(124,58,237,0.15);border-radius:12px;border:1px solid #7C3AED;max-width:500px;">' +
            '👆 اضغط مطولاً على الصورة → احفظ في الألبوم' +
        '</div>' +
        '<img id="dlImagePreview" src="' + url + '" style="max-width:100%;max-height:65vh;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,0.8);border:2px solid #7C3AED;margin:8px 0;background:transparent;" />' +
        '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding-bottom:20px;">' +
            '<button id="dlDirectBtn" style="padding:12px 22px;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;border:none;border-radius:24px;font-weight:900;font-size:14px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(124,58,237,0.5);cursor:pointer;font-family:inherit;">📥 تحميل مباشر</button>' +
            '<button id="dlCloseBtn" style="padding:12px 22px;background:linear-gradient(135deg,#EF4444,#DC2626);color:#fff;border:none;border-radius:24px;font-weight:900;font-size:14px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(239,68,68,0.5);cursor:pointer;font-family:inherit;">✕ إغلاق</button>' +
        '</div>' +
        '<div style="color:#6B6B80;font-size:11px;margin-top:8px;text-align:center;padding-bottom:20px;">' +
            'إذا ما اشتغل التحميل المباشر — اضغط مطولاً على الصورة' +
        '</div>';

    document.body.appendChild(modal);

    modal.querySelector('#dlDirectBtn').addEventListener('click', function() {
        try {
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (typeof showToast === 'function') {
                showToast('تم التحميل', true, 2500);
            }
        } catch (e) {
            console.error('[DL] direct download failed:', e);
            if (typeof showToast === 'function') {
                showToast('اضغط مطولاً على الصورة', false, 4000);
            }
        }
    });

    modal.querySelector('#dlCloseBtn').addEventListener('click', function() {
        URL.revokeObjectURL(url);
        modal.remove();
    });

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            URL.revokeObjectURL(url);
            modal.remove();
        }
    });
}


/* =========================================================
   DOWNLOAD AS IMAGE — v26 (مقوّى)
   - تحميل html2canvas احتياطياً من عدة مصادر
   - تقليل الدقة تلقائياً حسب حد الـ canvas في الآيباد/الآيفون
   - إعادة المحاولة بدقة أقل عند الفشل
   - مهلة قصوى حتى لا يعلق
   - يدعم تبويب GOAT LEAGUE
========================================================= */

var DL_MAX_PIXELS = 12000000;   /* حد آمن لـ iOS Safari */
var DL_MAX_SIDE = 8000;
var DL_BUSY = false;

function dlWithTimeout(promise, ms, msg) {
    return new Promise(function (resolve, reject) {
        var t = setTimeout(function () { reject(new Error(msg || 'انتهت المهلة')); }, ms);
        promise.then(function (v) { clearTimeout(t); resolve(v); },
                     function (e) { clearTimeout(t); reject(e); });
    });
}

function dlLoadScript(src) {
    return new Promise(function (resolve, reject) {
        var sc = document.createElement('script');
        sc.src = src; sc.async = true;
        sc.onload = function () { resolve(); };
        sc.onerror = function () { sc.remove(); reject(new Error('load failed ' + src)); };
        document.head.appendChild(sc);
    });
}

async function dlEnsureHtml2Canvas() {
    if (typeof html2canvas !== 'undefined') return true;
    var srcs = [
        'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    ];
    for (var i = 0; i < srcs.length; i++) {
        try { await dlLoadScript(srcs[i]); if (typeof html2canvas !== 'undefined') return true; } catch (e) {}
    }
    return false;
}

/* أكبر دقة آمنة لعنصر بحجم معين */
function dlSafeScale(el, wanted) {
    var w = Math.max(1, el.offsetWidth), h = Math.max(1, el.offsetHeight);
    var byPx = Math.sqrt(DL_MAX_PIXELS / (w * h));
    var bySide = DL_MAX_SIDE / Math.max(w, h);
    var sc = Math.min(wanted, byPx, bySide);
    return Math.max(0.5, Math.floor(sc * 10) / 10);
}

function dlRender(element, scale, isTOTW) {
    return html2canvas(element, {
        backgroundColor: null,
        scale: scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        windowWidth: Math.max(element.scrollWidth, element.offsetWidth),
        windowHeight: Math.max(element.scrollHeight, element.offsetHeight),
        imageTimeout: 15000,
        onclone: function(clonedDoc, clonedElement) {

            const wrappers = clonedElement.querySelectorAll('.logo-20, .logo-24');

            wrappers.forEach(function(wrapper) {
                const isSmall = wrapper.classList.contains('logo-20');
                const size = isSmall ? '20px' : '22px';

                wrapper.style.width = size;
                wrapper.style.height = size;
                wrapper.style.minWidth = size;
                wrapper.style.minHeight = size;
                wrapper.style.maxWidth = size;
                wrapper.style.maxHeight = size;
                wrapper.style.overflow = 'hidden';
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
            });

            const logos = clonedElement.querySelectorAll('.logo-20 img, .logo-24 img');

            logos.forEach(function(img) {
                img.style.position = 'absolute';
                img.style.top = '50%';
                img.style.left = '50%';
                img.style.transform = 'translate(-50%, -50%)';
                img.style.width = 'auto';
                img.style.height = 'auto';
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.objectFit = 'contain';
                img.style.display = 'block';
            });

            const indicators = clonedElement.querySelectorAll('.pos-indicator-img');

            indicators.forEach(function(img) {
                const size = '25px';
                img.style.width = size;
                img.style.height = size;
                img.style.minWidth = size;
                img.style.minHeight = size;
                img.style.maxWidth = size;
                img.style.maxHeight = size;
                img.style.objectFit = 'contain';
            });

            const lockPanel = clonedElement.querySelector('#adminLockPanel');
            if (lockPanel) lockPanel.style.display = 'none';

            if (isTOTW) {
                const parent = clonedElement.parentElement;
                if (parent && parent.classList && parent.classList.contains('totw-pitch-wrapper')) {
                    parent.style.padding = '0';
                    parent.style.margin = '0';
                    parent.style.background = 'transparent';
                }
            }
        }
    });
}

function dlCanvasToBlob(canvas) {
    return new Promise(function (resolve) {
        try { canvas.toBlob(function (b) { resolve(b); }, 'image/png'); }
        catch (e) { resolve(null); }
    });
}

function dlPickElement(activeTabName) {
    var el = null, prefix = 'Image', isTOTW = false;

    if (activeTabName === 'totw') {
        isTOTW = true;
        var pitchWrapper = document.getElementById('totwPitchWrapper');
        var listWrapper = document.getElementById('totwListWrapper');
        if (listWrapper && listWrapper.style.display !== 'none' && listWrapper.innerHTML.trim() !== '') {
            el = listWrapper; prefix = 'TOTW_List';
        } else {
            if (pitchWrapper) pitchWrapper.style.display = 'flex';
            el = document.getElementById('totwPitchToSave'); prefix = 'TOTW';
        }
    } else if (activeTabName === 'standings') {
        if (typeof renderStandings === 'function') renderStandings();
        el = document.getElementById('captureStandings'); prefix = 'Standings';
    } else if (activeTabName === 'stats') {
        el = document.querySelector('.stats-view.active') || document.getElementById('statsContent'); prefix = 'Stats';
    } else if (activeTabName === 'cup') {
        el = document.getElementById('tgCupContent'); prefix = 'GOAT_LEAGUE';
    } else if (activeTabName === 'champions') {
        el = document.getElementById('championsTab'); prefix = 'Champions_Cup';
    } else {
        if (typeof renderFixtures === 'function') renderFixtures();
        el = document.getElementById('captureFixtures'); prefix = 'Matchweek';
    }
    return { el: el, prefix: prefix, isTOTW: isTOTW };
}

async function downloadAsImage(scaleFactor) {
    if (typeof scaleFactor !== 'number') scaleFactor = 3;
    closeDownloadMenu();

    if (DL_BUSY) { if (typeof showToast === 'function') showToast('جاري التجهيز... انتظر', false, 2000); return; }
    DL_BUSY = true;

    var toast = function (m, ok, d) { if (typeof showToast === 'function') showToast(m, ok, d || 4000); };

    try {
        if (!(await dlEnsureHtml2Canvas())) {
            dlDebug('html2canvas NOT loaded', true);
            toast('تعذّر تحميل مكتبة الصورة — تأكد من الإنترنت وحدّث الصفحة', false, 5000);
            return;
        }

        var tabName = getActiveTabName();
        var pick = dlPickElement(tabName);
        var element = pick.el;
        dlDebug('tab=' + tabName);

        if (!element) { toast('العنصر غير موجود', false); return; }
        if (element.offsetWidth === 0 || element.offsetHeight === 0) { toast('العنصر فارغ — افتح الصفحة المطلوبة أولاً', false); return; }

        toast('جاري تجهيز الصورة...', false, 2500);

        /* انتظر الخطوط والصور */
        try { if (document.fonts && document.fonts.ready) await dlWithTimeout(document.fonts.ready, 4000); } catch (e) {}
        await waitForImagesToLoad(element);

        /* سلسلة محاولات: الدقة المطلوبة (بحد آمن) ثم أقل */
        var first = dlSafeScale(element, scaleFactor);
        var chain = [first];
        [2, 1.5, 1].forEach(function (s) { var v = Math.min(s, first); if (chain.indexOf(v) === -1 && v < chain[chain.length - 1]) chain.push(v); });

        var blob = null, usedScale = first, lastErr = null;
        for (var i = 0; i < chain.length && !blob; i++) {
            usedScale = chain[i];
            try {
                dlDebug('try scale=' + usedScale);
                var canvas = await dlWithTimeout(dlRender(element, usedScale, pick.isTOTW), 60000, 'استغرق وقتاً طويلاً');
                if (isCanvasTainted(canvas)) { lastErr = new Error('صور محمية'); continue; }
                var finalCanvas = applyRoundedCorners(canvas, 20 * usedScale);
                blob = await dlCanvasToBlob(finalCanvas);
                if (!blob) lastErr = new Error('فشل إنشاء الملف (الصورة كبيرة)');
                finalCanvas.width = finalCanvas.height = 0; canvas.width = canvas.height = 0;
            } catch (e) { lastErr = e; console.error('[DL] attempt failed', usedScale, e); }
        }

        if (!blob) { toast('فشل: ' + ((lastErr && lastErr.message) || 'خطأ غير معروف'), false, 6000); return; }

        dlDebug('blob=' + Math.round(blob.size / 1024) + 'KB scale=' + usedScale);
        showImageModal(blob, pick.prefix + '_' + usedScale + 'x.png');
        toast(usedScale < scaleFactor ? 'تم (بدقة أقل لتناسب الجهاز) — اضغط مطولاً على الصورة' : 'اضغط مطولاً على الصورة', true, 3500);
    } catch (err) {
        console.error('[DL] error:', err);
        dlDebug('error: ' + err.message, true);
        toast('فشل: ' + err.message, false, 5000);
    } finally {
        DL_BUSY = false;
    }
}


function fallbackDownload(blob, filename) {
    const link = document.createElement('a');
    link.download = filename || 'image.png';
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() {
        URL.revokeObjectURL(link.href);
    }, 1000);
}
