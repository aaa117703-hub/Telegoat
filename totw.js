/* =========================================================
   totw.js
========================================================= */

const TOTW_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const TOTW_TOTAL_PAGES = 7;


/* =========================================================
   FETCH ALL PAGES
========================================================= */

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


/* =========================================================
   GET TOP 11
========================================================= */

function getTOTWTop11(allResults) {

    const sorted = [...allResults].sort(function(a, b) {
        return b.event_total - a.event_total;
    });

    return sorted.slice(0, 11);
}


/* =========================================================
   RENDER CARDS — 1 حارس → 4 دفاع → 3 وسط → 3 هجوم
========================================================= */

function renderTOTWCards(top11) {

    const pitch = document.getElementById('totwPlayers');

    if (!pitch) return;

    /* الأعلى نقاط = هجوم */
    const forward1 = top11[0];
    const forward2 = top11[1];
    const forward3 = top11[2];

    const mid1 = top11[3];
    const mid2 = top11[4];
    const mid3 = top11[5];

    const def1 = top11[6];
    const def2 = top11[7];
    const def3 = top11[8];
    const def4 = top11[9];

    const goalkeeper = top11[10];

    let html = '';

    /* صف 1: حارس */
    html += '<div class="totw-row totw-row-gk">';
    html += createTOTWCard(goalkeeper);
    html += '</div>';

    /* صف 2: دفاع (4) */
    html += '<div class="totw-row totw-row-def">';
    html += createTOTWCard(def1);
    html += createTOTWCard(def2);
    html += createTOTWCard(def3);
    html += createTOTWCard(def4);
    html += '</div>';

    /* صف 3: وسط (3) */
    html += '<div class="totw-row totw-row-mid">';
    html += createTOTWCard(mid1);
    html += createTOTWCard(mid2);
    html += createTOTWCard(mid3);
    html += '</div>';

    /* صف 4: هجوم (3) */
    html += '<div class="totw-row totw-row-fwd">';
    html += createTOTWCard(forward1);
    html += createTOTWCard(forward2);
    html += createTOTWCard(forward3);
    html += '</div>';

    pitch.innerHTML = html;
}


/* =========================================================
   CREATE CARD
========================================================= */

function createTOTWCard(player) {

    if (!player) return '';

    const name = player.player_name || player.entry_name || 'Unknown';
    const points = player.event_total || 0;

    let teamName = '';
    if (typeof findPlayerTeam === 'function') {
        teamName = findPlayerTeam(name) || findPlayerTeam(player.entry_name) || '';
    }

    console.log('TOTW Player:', name, '→ Team:', teamName);

    let shirtHtml = '';

    if (
        teamName &&
        typeof TEAMS_SHIRTS !== 'undefined' &&
        TEAMS_SHIRTS[teamName]
    ) {

        const shirtData = TEAMS_SHIRTS[teamName];
        const scale = shirtData.scale || 1;

        shirtHtml =
            '<div class="tc-shirt" style="transform:scale(' + scale + ');">' +
                '<img src="./' + shirtData.file + '" alt="' + teamName + '" onerror="this.style.display=\'none\'">' +
            '</div>';

    } else if (
        teamName &&
        typeof TEAMS_LOGOS !== 'undefined' &&
        TEAMS_LOGOS[teamName]
    ) {

        shirtHtml =
            '<div class="tc-shirt tc-shirt-fallback">' +
                '<img src="./' + TEAMS_LOGOS[teamName] + '" alt="' + teamName + '" onerror="this.style.display=\'none\'">' +
            '</div>';
    }

    return '<div class="totw-card">' +
        '<div class="tc-name">' + name + '</div>' +
        shirtHtml +
        '<div class="tc-points">' + points + '</div>' +
    '</div>';
}


/* =========================================================
   LOAD TOTW
========================================================= */

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


/* =========================================================
   SAVE TOTW IMAGE
========================================================= */

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
            backgroundColor: null,
            scale: 3,
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
