/* =========================================================
   download.js
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
                if (finished) {
                    return;
                }
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
   DOWNLOAD AS IMAGE — يدعم fixtures + standings + totw
========================================================= */

function downloadAsImage(scaleFactor) {

    if (typeof scaleFactor !== 'number') {
        scaleFactor = 3;
    }

    closeDownloadMenu();

    /* ============ 1. تحديد القسم ============ */

    const isTOTW = (typeof activeTab !== 'undefined' && activeTab === 'totw');

    let element = null;
    let filenamePrefix = 'Image';

    if (isTOTW) {
        element = document.getElementById('totwPitchToSave');
        filenamePrefix = 'TOTW_GW' + (typeof currentRound !== 'undefined' ? currentRound : '');
    } else if (activeTab === 'standings') {
        if (typeof renderStandings === 'function') renderStandings();
        element = document.getElementById('captureStandings');
        filenamePrefix = 'Standings_GW' + (typeof currentRound !== 'undefined' ? currentRound : '');
    } else {
        if (typeof renderFixtures === 'function') renderFixtures();
        element = document.getElementById('captureFixtures');
        filenamePrefix = 'Matchweek_' + (typeof currentRound !== 'undefined' ? currentRound : '');
    }

    if (!element) {
        if (typeof showToast === 'function') {
            showToast('العنصر غير موجود', false);
        }
        return;
    }

    if (typeof showToast === 'function') {
        showToast('Preparing image...', false);
    }

    const cornerRadius = (isTOTW ? 0 : 20 * scaleFactor);

    waitForImagesToLoad(element)
        .then(function() {
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

                    /* إخفاء أزرار القفل من الصورة */
                    const lockPanel = clonedElement.querySelector('#adminLockPanel');
                    if (lockPanel) lockPanel.style.display = 'none';
                }
            });
        })
        .then(function(canvas) {

            let finalCanvas = canvas;

            if (!isTOTW && cornerRadius > 0) {
                finalCanvas = applyRoundedCorners(canvas, cornerRadius);
            }

            finalCanvas.toBlob(function(blob) {

                if (!blob) {
                    if (typeof showToast === 'function') {
                        showToast('فشل إنشاء الصورة', false);
                    }
                    return;
                }

                const filename = filenamePrefix + '_' + scaleFactor + 'x.png';

                /* تجربة المشاركة */
                if (navigator.share && navigator.canShare) {

                    try {
                        const file = new File([blob], filename, { type: 'image/png' });
                        const shareData = { files: [file], title: filename };

                        if (navigator.canShare(shareData)) {
                            navigator.share(shareData)
                                .then(function() {
                                    if (typeof showToast === 'function') {
                                        showToast('Image saved', true);
                                    }
                                })
                                .catch(function(err) {
                                    if (err.name !== 'AbortError') {
                                        fallbackDownload(blob, filename);
                                    } else {
                                        if (typeof showToast === 'function') {
                                            showToast('Cancelled', false);
                                        }
                                    }
                                });
                            return;
                        }
                    } catch (e) {
                        /* نكمل للـ fallback */
                    }
                }

                fallbackDownload(blob, filename);

            }, 'image/png', 1.0);
        })
        .catch(function(err) {
            console.error('html2canvas error:', err);
            if (typeof showToast === 'function') {
                showToast('Error generating image', false);
            }
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
            showToast('Image downloaded', true);
        }
    }, 100);
}
