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

function dlDebugHide() {
    setTimeout(function() {
        const el = document.getElementById('backfillDebug');
        if (el) el.style.display = 'none';
    }, 4000);
}


/* =========================================================
   DOWNLOAD AS IMAGE — نسخة محسّنة
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

        // ✨ إجبار عرض الملعب
        const pitchWrapper = document.getElementById('totwPitchWrapper');
        const listWrapper  = document.getElementById('totwListWrapper');

        if (listWrapper && listWrapper.style.display !== 'none' && listWrapper.innerHTML.trim() !== '') {
            // نحن في List view — نحملها
            element = listWrapper;
            filenamePrefix = 'TOTW_List';
        } else {
            // Squad view
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
        dlDebugHide();
        return;
    }

    dlDebug('size=' + element.offsetWidth + 'x' + element.offsetHeight);

    if (element.offsetWidth === 0 || element.offsetHeight === 0) {
        dlDebug('element has 0 size!', true);
        dlDebugHide();
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
                allowTaint: true,
                logging: false,
                width: element.offsetWidth,
                height: element.offsetHeight,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                imageTimeout: 0
            });
        })
        .then(function(canvas) {
            dlDebug('canvas=' + canvas.width + 'x' + canvas.height);

            let finalCanvas = canvas;
            if (!isTOTW && cornerRadius > 0) {
                finalCanvas = applyRoundedCorners(canvas, cornerRadius);
            }

            // ✨ على iOS: اعرض الصورة في تبويب جديد
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            finalCanvas.toBlob(function(blob) {
                if (!blob) {
                    dlDebug('blob is null', true);
                    dlDebugHide();
                    return;
                }

                dlDebug('blob ready, size=' + Math.round(blob.size / 1024) + 'KB');

                const filename = filenamePrefix + '_' + scaleFactor + 'x.png';

                if (isIOS) {
                    // iOS: افتح الصورة في tab جديد — المستخدم يحفظها يدويًا (ضغط مطول)
                    dlDebug('iOS: opening in new tab');
                    const url = URL.createObjectURL(blob);
                    const win = window.open(url, '_blank');
                    if (!win) {
                        dlDebug('popup blocked!', true);
                    }
                    setTimeout(function() {
                        URL.revokeObjectURL(url);
                    }, 60000);
                    dlDebugHide();
                    return;
                }

                // غير iOS: تحميل عادي
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
                dlDebugHide();

            }, 'image/png', 1.0);
        })
        .catch(function(err) {
            console.error('[DL]', err);
            dlDebug('error: ' + err.message, true);
            dlDebugHide();
        });
}
