/* =========================================================
   totw.js
========================================================= */

const TOTW_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const TOTW_TOTAL_PAGES = 7;

const TOTW_NUMBERS = {
    GK: 1,
    DEF: [2, 4, 5, 12],
    MID: [6, 8, 10],
    FWD: [7, 9, 11]
};


async function fetchTOTWPages() {

    const allResults = [];

    for (let page = 1; page <= TOTW_TOTAL_PAGES; page++) {

        try {

            const response = await fetch(TOTW_WORKER_URL + '/?page=' + page);
            const data = await response.json();

            if (data && data.standings && data.standings.results) {

                allResults.push(...data.standings.results);

                if (data.standings.has_next === true) {
                    continue;
                } else {
                    break;
                }

            } else {
                break;
            }

        } catch (e) {
            console.error('TOTW Page ' + page + ' failed:', e);
            break;
        }
    }

    return allResults;
}


function getTOTWTop11(allResults) {

    const sorted = [...allResults].sort(function(a, b) {
        return b.event_total - a.event_total;
    });

    return sorted.slice(0, 11);
}


function renderTOTWCards(top11) {

    const pitch = document.getElementById('totwPlayers');

    if (!pitch) return;

    const forwards = top11.slice(0, 3);
    const midfielders = top11.slice(3, 6);
    const defenders = top11.slice(6, 10);
    const goalkeeper = top11.slice(10, 11);

    let html = '';

    html += '<div class="totw-row totw-row-1">';
    html += createTOTWCard(forwards[1], TOTW_NUMBERS.FWD[0]);
    html += createTOTWCard(forwards[0], TOTW_NUMBERS.FWD[1]);
    html += createTOTWCard(forwards[2], TOTW_NUMBERS.FWD[2]);
    html += '</div>';

    html += '<div class="totw-row totw-row-2">';
    html += createTOTWCard(midfielders[0], TOTW_NUMBERS.MID[0]);
    html += createTOTWCard(midfielders[1], TOTW_NUMBERS.MID[1]);
    html += createTOTWCard(midfielders[2], TOTW_NUMBERS.MID[2]);
    html += '</div>';

    html += '<div class="totw-row totw-row-3">';
    html += createTOTWCard(defenders[1], TOTW_NUMBERS.DEF[3]);
    html += createTOTWCard(defenders[0], TOTW_NUMBERS.DEF[1]);
    html += createTOTWCard(defenders[2], TOTW_NUMBERS.DEF[2]);
    html += createTOTWCard(defenders[3], TOTW_NUMBERS.DEF[0]);
    html += '</div>';

    html += '<div class="totw-row totw-row-4">';
    html += createTOTWCard(goalkeeper[0], TOTW_NUMBERS.GK);
    html += '</div>';

    pitch.innerHTML = html;
}


function createTOTWCard(player, number) {

    if (!player) return '';

    const name = player.player_name || player.entry_name || 'Unknown';
    const points = player.event_total || 0;

    return '<div class="totw-card">' +
        '<div class="tc-number">' + number + '</div>' +
        '<div class="tc-name">' + name + '</div>' +
        '<div class="tc-points">' + points + ' pts</div>' +
    '</div>';
}


async function loadTOTW() {

    const loadingBox = document.getElementById('totwLoadingBox');
    const pitchWrapper = document.getElementById('totwPitchWrapper');
    const errorBox = document.getElementById('totwErrorBox');
    const refreshBtn = document.getElementById('totwRefreshBtn');

    if (!loadingBox) return;

    loadingBox.style.display = 'block';
    pitchWrapper.style.display = 'none';
    errorBox.style.display = 'none';

    if (refreshBtn) {
        refreshBtn.classList.add('loading');
    }

    try {

        const allResults = await fetchTOTWPages();

        if (!allResults || allResults.length === 0) {
            throw new Error('No data received');
        }

        const top11 = getTOTWTop11(allResults);

        renderTOTWCards(top11);

        loadingBox.style.display = 'none';
        pitchWrapper.style.display = 'flex';

    } catch (e) {

        console.error('TOTW Error:', e);

        loadingBox.style.display = 'none';
        errorBox.style.display = 'block';
        errorBox.textContent = '⚠️ Error: ' + e.message;
    }

    if (refreshBtn) {
        refreshBtn.classList.remove('loading');
    }
}


function changeTOTWGameweek() {
    loadTOTW();
}


document.addEventListener('DOMContentLoaded', function() {

    const gwSelect = document.getElementById('totwGwSelect');

    if (gwSelect) {
        gwSelect.addEventListener('change', changeTOTWGameweek);
    }
});


/* ============================================
   SAVE TOTW IMAGE
============================================ */

async function saveTOTWImage() {

    const pitch = document.getElementById('totwPitchToSave');
    const saveBtn = document.getElementById('totwSaveBtn');

    if (!pitch) {
        alert('Pitch not found');
        return;
    }

    if (typeof html2canvas === 'undefined') {
        alert('html2canvas not loaded');
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Saving...';
    }

    try {

        const images = pitch.querySelectorAll('img');

        await Promise.all(Array.from(images).map(function(img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function(resolve) {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        }));

        const canvas = await html2canvas(pitch, {
            backgroundColor: '#240024',
            scale: 4,
            useCORS: true,
            allowTaint: true,
            logging: false,
            imageTimeout: 0
        });

        canvas.toBlob(function(blob) {

            if (!blob) {
                alert('Failed to create image');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = '⬇️ Download';
                }
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const gw = document.getElementById('totwGwSelect');
            const gwValue = gw ? gw.value : '5';
            link.download = 'TOTW_GW' + gwValue + '.png';
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(function() {
                URL.revokeObjectURL(url);
            }, 100);

            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '⬇️ Download';
            }

        }, 'image/png', 1.0);

    } catch (e) {

        console.error('Save error:', e);
        alert('Error: ' + e.message);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '⬇️ Download';
        }
    }
}
