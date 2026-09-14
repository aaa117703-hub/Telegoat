/* =========================================================
   download.js
   تحميل الجداول كصور (html2canvas + Share + Fallback)
========================================================= */


/* =========================================================
   WAIT FOR IMAGES - انتظار تحميل الصور
========================================================= */

function waitForImagesToLoad(element) {

    const images =
        Array.from(
            element.querySelectorAll('img')
        );

    return Promise.all(
        images.map(img => {

            if (
                img.complete &&
                img.naturalWidth > 0
            ) {

                if (img.decode) {

                    return img
                        .decode()
                        .catch(() => {});
                }

                return Promise.resolve();
            }

            return new Promise(resolve => {

                let finished = false;

                const finish = () => {

                    if (finished) {
                        return;
                    }

                    finished = true;

                    img.removeEventListener(
                        'load',
                        finish
                    );

                    img.removeEventListener(
                        'error',
                        finish
                    );

                    resolve();
                };

                img.addEventListener(
                    'load',
                    finish,
                    { once: true }
                );

                img.addEventListener(
                    'error',
                    finish,
                    { once: true }
                );

                /* Timeout احتياطي */
                setTimeout(finish, 5000);
            });
        })
    );
}


/* =========================================================
   ROUNDED CORNERS - زوايا دائرية للصورة النهائية
========================================================= */

function applyRoundedCorners(sourceCanvas, radius) {

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const outputCanvas =
        document.createElement('canvas');

    outputCanvas.width = w;
    outputCanvas.height = h;

    const ctx =
        outputCanvas.getContext('2d');

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
   DOWNLOAD AS IMAGE - تحميل كصورة
========================================================= */

function downloadAsImage() {

    /* إعادة رسم المحتوى الحالي */
    if (activeTab === 'fixtures') {

        renderFixtures();

    } else {

        renderStandings();
    }

    const targetId =
        activeTab === 'fixtures'
            ? 'captureFixtures'
            : 'captureStandings';

    const element =
        document.getElementById(targetId);

    if (!element) {
        return;
    }

    showToast('Preparing image...', false);

    const scaleFactor = 4;
    const cornerRadius = 20 * scaleFactor;

    waitForImagesToLoad(element)

        .then(() => {

            return html2canvas(
                element,
                {
                    backgroundColor: null,
                    scale: scaleFactor,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    width: element.offsetWidth,
                    height: element.offsetHeight,
                    windowWidth: element.scrollWidth,
                    windowHeight: element.scrollHeight,
                    imageTimeout: 0,

                    onclone: function (
                        clonedDoc,
                        clonedElement
                    ) {

                        /* ضبط اللوغوات الصغيرة */
                        const wrappers =
                            clonedElement
                                .querySelectorAll(
                                    '.logo-20, .logo-24'
                                );

                        wrappers.forEach(wrapper => {

                            const isSmall =
                                wrapper.classList
                                    .contains('logo-20');

                            const size =
                                isSmall ? '20px' : '22px';

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

                        const logos =
                            clonedElement
                                .querySelectorAll(
                                    '.logo-20 img, .logo-24 img'
                                );

                        logos.forEach(img => {

                            img.style.position = 'absolute';
                            img.style.top = '50%';
                            img.style.left = '50%';
                            img.style.transform =
                                'translate(-50%, -50%)';
                            img.style.width = 'auto';
                            img.style.height = 'auto';
                            img.style.maxWidth = '100%';
                            img.style.maxHeight = '100%';
                            img.style.objectFit = 'contain       ';
                            img.style.display = 'block';
                        });

                        /* ضبط أسهم الترتيب */
 .                        const indicators =
                            clonedElement
then                                .querySelectorAll(
                                    '.pos-indicator(c-img'
                                );

                        indicators.forEachan(img => {

                            const size = '25px';

                            img.style.width = size;
                            img.style.height = size;
vas                            img.style.minWidth = size;
                            img.style.minHeight = size;
                            img.style.maxWidth = size;
                            img.style.maxHeight = size;
                            img.style.objectFit = 'contain';
                        });
                    }
                }
            );
        })

 => {

            const roundedCanvas =
                applyRoundedCorners(
                    canvas,
                    cornerRadius
                );

            roundedCanvas.toBlob(
                function (blob) {

                    if (!blob) {

                        showToast(
                            'Failed to create image!',
                            false
                        );

                        return;
                    }

                    const filename =
                        activeTab === 'fixtures'

                            ? `Matchweek_${currentRound}.png`

                            : `League_Standings_GW${currentRound}.png`;

                    /* محاولة استخدام Share API */
                    if (
                        navigator.share &&
                        navigator.canShare
                    ) {

                        const file =
                            new File(
                                [blob],
                                filename,
                                { type: 'image/png' }
                            );

                        const shareData = {
                            files: [file],

                            title:
                                activeTab === 'fixtures'

                                    ? `Matchweek ${currentRound}`

                                    : `League Standings GW ${currentRound}`
                        };

                        if (
                            navigator.canShare(shareData)
                        ) {

                            navigator
                                .share(shareData)

                                .then(() => {

                                    showToast(
                                        'Image saved successfully ✓',
                                        true
                                    );
                                })

                                .catch(err => {

                                    if (
                                        err.name !== 'AbortError'
                                    ) {

                                        fallbackDownload(blob);

                                    } else {

                                        showToast(
                                            'Cancelled',
                                            false
                                        );
                                    }
                                });

                        } else {

                            fallbackDownload(blob);
                        }

                    } else {

                        fallbackDownload(blob);
                    }
                },
                'image/png',
                1.0
            );
        })

        .catch(err => {

            console.error(
                'html2canvas error:',
                err
            );

            showToast(
                'Error generating image!',
                false
            );
        });
}


/* =========================================================
   FALLBACK DOWNLOAD - تنزيل عادي
========================================================= */

function fallbackDownload(blob) {

    const link =
        document.createElement('a');

    link.download =
        activeTab === 'fixtures'

            ? `Matchweek_${currentRound}.png`

            : `League_Standings_GW${currentRound}.png`;

    link.href =
        URL.createObjectURL(blob);

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    setTimeout(() => {

        URL.revokeObjectURL(link.href);

        showToast(
            'Image downloaded ✓',
            true
        );

    }, 100);
}
