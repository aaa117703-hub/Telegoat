/* =========================================================
   download.js — v21
   إصلاح: allowTaint + canvas tainted check + fallbacks
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


/* =========================================================
   DEBUG helper
========================================================= */

function dlDebug(text, isError) {
    let el = document.getElementById('backfillDebug');
    if (!el) {
        el = document.createElement('div');
        el.id = 'backfillDebug';
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#000;color:#0f0;padding:10px;font-family:monospace;font-size:11px;z-index:999999;text-align:center;font-weight:bold;';
        document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.textContent = 'DL: ' + text;
    el.style.background = isError ? '#800' : '#000';
}

function dlDebugHide(delay) {
    delay = delay || 4000;
    setTimeout(function() {
        const el = document.getElementById('backfillDebug');
        if (el) el.style.display = 'none';
    }, delay);
}


/* =========================================================
   TOGGLE DOWNLOAD MENU
========================================================= */

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


/* =========================================================
   Detect Active Tab
========================================================= */

function getActiveTabName() {
    const fixturesTab = document.getElementById('fixturesTab');
    const standingsTab = document.getElementById('standingsTab');
    const totwTab = document.getElementById('totwTab');
    const statsTab = document.getElementById('statsTab');

    if (totwTab && totwTab.classList.contains('active')) return 'totw';
    if (standingsTab && standingsTab.classList.contains('active')) return 'standings';
    if (statsTab && statsTab.classList.contains('active')) return 'stats';
    if (fixturesTab && fixturesTab.classList.contains('active')) return 'fixtures';

    if (typeof window.activeTab !== 'undefined') return window.activeTab;

    return 'fixtures';
}


/* =========================================================
   CHECK CANVAS TAINTED
========================================================= */

function isCanvasTainted(canvas) {
    try {
        canvas.getContext('2d').getImageData(0, 0, 1, 1);
        return false;
    } catch (e) {
        return true;
    }
}


/* =========================================================
   DOWNLOAD AS IMAGE — v21
========================================================= */

function downloadAsImage(scaleFactor) {

    if (typeof scaleFactor !== 'number') scaleFactor = 3;

    closeDownloadMenu();

    const activeTabName = getActiveTabName();
    dlDebug('tab=' + activeTabName);

    let element = null;
    let filenamePrefix = 'Image';
    let isTOTW = false;

    if (activeTabName === 'totw') {
        isTOTW = true;

        const pitchWrapper = document.getElementById('totwPitchWrapper');
        const listWrapper  = document.getElementById('totwListWrapper');

        if (listWrapper && listWrapper.style.display !== 'none' && listWrapper.innerHTML.trim() !== '') {
            element = listWrapper;
            filenamePrefix = 'TOTW_List';
        } else {
            if (pitchWrapper) pitchWrapper.style.display = 'flex';
            element = document.getElementById('totwPitchToSave');
            filenamePrefix = 'TOTW';
        }
    }
    else if (activeTabName === 'standings') {
        if (typeof renderStandings === 'function') renderStandings();
        element = document.getElementById('captureStandings');
        filenamePrefix = 'Standings';
    }
    else if (activeTabName === 'stats') {
        const activeView = document.querySelector('.stats-view.active');
        element = activeView || document.getElementById('statsContent');
        filenamePrefix = 'Stats';
    }
    else {
        if (typeof renderFixtures === 'function') renderFixtures();
        element = document.getElementById('captureFixtures');
        filenamePrefix = 'Matchweek';
    }

    if (!element) {
        dlDebug('element not found', true);
        if (typeof showToast === 'function') showToast('العنصر غير موجود', false, 4000);
        dlDebugHide(8000);
        return;
    }

    dlDebug('size=' + element.offsetWidth + 'x' + element.offsetHeight);

    if (element.offsetWidth === 0 || element.offsetHeight === 0) {
        dlDebug('element has 0 size!', true);
        if (typeof showToast === 'function') showToast('العنصر فارغ', false, 4000);
        dlDebugHide(8000);
        return;
    }

    const cornerRadius = (isTOTW ? 0 : 20 * scaleFactor);

    dlDebug('loading images...');

    waitForImagesToLoad(element)
        .then(function() {
            dlDebug('rendering...');

            return html2canvas(element, {
                backgroundColor: (isTOTW ? '#ffffff' : null),
                scale: scaleFactor,
                useCORS: true,
                allowTaint: false,
                logging: false,
                width: element.offsetWidth,
                height: element.offsetHeight,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                imageTimeout: 0,
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
                }
            });
        })
        .then(function(canvas) {
            dlDebug('canvas=' + canvas.width + 'x' + canvas.height);

            if (isCanvasTainted(canvas)) {
                dlDebug('canvas tainted by CORS', true);
                if (typeof showToast === 'function') {
                    showToast('فشل: صور محمية (CORS)', false, 5000);
                }
                dlDebugHide(10000);
                return;
            }

            let finalCanvas = canvas;
            if (!isTOTW && cornerRadius > 0) {
                finalCanvas = applyRoundedCorners(canvas, cornerRadius);
            }

            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            finalCanvas.toBlob(function(blob) {
                if (!blob) {
                    dlDebug('blob is null', true);
                    if (typeof showToast === 'function') {
                        showToast('فشل إنشاء الصورة', false, 5000);
                    }
                    dlDebugHide(10000);
                    return;
                }

                dlDebug('blob size=' + Math.round(blob.size / 1024) + 'KB');

                const filename = filenamePrefix + '_' + scaleFactor + 'x.png';

                if (isIOS) {
                    dlDebug('iOS: opening in new tab');
                    const url = URL.createObjectURL(blob);
                    const win = window.open(url, '_blank');
                    if (!win) {
                        dlDebug('popup blocked!', true);
                        if (typeof showToast === 'function') {
                            showToast('افتح النوافذ المنبثقة للحفظ', false, 6000);
                        }
                        dlDebugHide(10000);
                        return;
                    }
                    setTimeout(function() {
                        URL.revokeObjectURL(url);
                    }, 60000);
                    dlDebug('opened in new tab');
                    dlDebugHide(3000);
                    return;
                }

                const link = document.createElement('a');
                link.download = filename;
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                setTimeout(function() {
                    URL.revokeObjectURL(link.href);
                }, 1000);

                dlDebug('downloaded!');
                if (typeof showToast === 'function') {
                    showToast('تم التحميل', true, 2500);
                }
                dlDebugHide(3000);

            }, 'image/png', 1.0);
        })
        .catch(function(err) {
            console.error('[DL]', err);
            dlDebug('error: ' + err.message, true);
            if (typeof showToast === 'function') {
                showToast('فشل التحميل: ' + err.message, false, 6000);
            }
            dlDebugHide(10000);
        });
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
        if (typeof showToast === 'function') {
            showToast('تم التحميل', true);
        }
    }, 100);
}
