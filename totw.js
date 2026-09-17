/* =========================================================
   totw.js
========================================================= */

const TOTW_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const TOTW_TOTAL_PAGES = 7;

let currentTOTWView = 'squad';
let currentTOTWData = [];


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
   SWITCH VIEW — SQUAD / LIST
========================================================= */

function switchTOTWView(view) {

    currentTOTWView = view;

    const squadBtn = document.getElementById('totwSquadBtn');
    const listBtn = document.getElementById('totwListBtn');

    if (squadBtn) {
        squadBtn.classList.toggle('active', view === 'squad');
    }
    if (listBtn) {
        listBtn.classList.toggle('active', view === 'list');
    }

    const pitchWrapper = document.getElementById('totwPitchWrapper');
    const listWrapper = document.getElementById('totwListWrapper');

    if (view === 'list') {
        if (pitchWrapper) pitchWrapper.style.display = 'none';
        if (listWrapper) listWrapper.style.display = 'block';
    } else {
        if (pitchWrapper) pitchWrapper.style.display = 'flex';
        if (listWrapper) listWrapper.style.display = 'none';
    }
}


/* =========================================================
   RENDER SQUAD — 1-4-3-3
========================================================= */

function renderTOTWCards(top11) {

    const pitch = document.getElementById('totwPlayers');

    if (!pitch) return;

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

    /* حارس */
    html += '<div class="totw-row totw-row-gk">';
    html += createTOTWCard(goalkeeper);
    html += '</div>';

    /* دفاع (4) */
    html += '<div class="totw-row totw-row-def">';
    html += createTOTWCard(def1);
    html += createTOTWCard(def2);
    html += createTOTWCard(def3);
    html += createTOTWCard(def4);
    html += '</div>';

    /* وسط (3) */
    html += '<div class="totw-row totw-row-mid">';
    html += createTOTWCard(mid1);
    html += createTOTWCard(mid2);
    html += createTOTWCard(mid3);
    html += '</div>';

    /* هجوم (3) */
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

    let shirtHtml = '';

    if (
        teamName &&
        typeof TEAMS_SHIRTS !== 'undefined' &&
        TEAMS_SHIRTS[teamName]
    ) {

        const shirtData = TEAMS_SHIRTS[teamName];

        shirtHtml =
            '<div class="tc-shirt">' +
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
        shirtHtml +
        '<div class="tc-name">' + name + '</div>' +
        '<div class="tc-points">' + points + '</div>' +
    '</div>';
}


/* =========================================================
   RENDER LIST — جدول
========================================================= */

function renderTOTWList(top11) {

    const listWrapper = document.getElementById('totwListWrapper');

    if (!listWrapper) return;

    let html = '';

    html += '<div class="totw-list-header">';
    html += '<span>#</span>';
    html += '<span>Player</span>';
    html += '<span>Pts</span>';
    html += '</div>';

    top11.forEach(function(player, index) {

        const name = player.player_name || player.entry_name || 'Unknown';
        const points = player.event_total || 0;

        html += '<div class="totw-list-item">';
        html += '<div class="totw-list-rank">' + (index + 1) + '</div>';
        html += '<div class="totw-list-name">' + name + '</div>';
        html += '<div class="totw-list-points">' + points + '</div>';
        html += '</div>';
    });

    listWrapper.innerHTML = html;
}


/* =========================================================
   LOAD TOTW
========================================================= */

async function loadTOTW() {

    const loadingBox = document.getElementById('totwLoadingBox');
    const pitchWrapper = document.getElementById('totwPitchWrapper');
    const listWrapper = document.getElementById('totwListWrapper');
    const errorBox = document.getElementById('totwErrorBox');

    if (!loadingBox) return;

    loadingBox.style.display = 'block';
    if (pitchWrapper) pitchWrapper.style.display = 'none';
    if (listWrapper) listWrapper.style.display = 'none';
    if (errorBox) errorBox.style.display = 'none';

    try {

        const allResults = await fetchTOTWPages();

        if (!allResults || allResults.length === 0) {
            throw new Error('No data received');
        }

        currentTOTWData = getTOTWTop11(allResults);

        renderTOTWCards(currentTOTWData);
        renderTOTWList(currentTOTWData);

        loadingBox.style.display = 'none';

        if (currentTOTWView === 'list') {
            if (listWrapper) listWrapper.style.display = 'block';
        } else {
            if (pitchWrapper) pitchWrapper.style.display = 'flex';
        }

    } catch (e) {

        console.error('TOTW Error:', e);

        loadingBox.style.display = 'none';
        if (errorBox) {
            errorBox.style.display = 'block';
            errorBox.textContent = '⚠️ Error: ' + e.message;
        }
    }
}


document.addEventListener('DOMContentLoaded', function() {
    loadTOTW();
});
