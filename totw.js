/* =========================================================
   totw.js
========================================================= */

const TOTW_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const TOTW_TOTAL_PAGES = 7;

let currentTOTWView = 'squad';
let currentTOTWData = [];


/* =========================================================
   SHORTEN PLAYER NAME — قص إلى 12 حرف
========================================================= */

function shortenPlayerName(name) {

    if (!name) return name;

    const result = name.trim();

    if (result.length <= 12) return result;

    return result.substring(0, 12);
}


/* =========================================================
   GET LATEST ROUND
========================================================= */

function getLatestRound() {
    const saved = parseInt(localStorage.getItem('fpl_last_round') || '0', 10);
    return isNaN(saved) ? 0 : saved;
}


/* =========================================================
   SAVE / LOAD TOTW SNAPSHOT
========================================================= */

async function saveTOTWSnapshot(round, top11) {

    if (!window.sbClient) return false;

    try {

        const { error } = await window.sbClient
            .from('saved_totw')
            .upsert(
                {
                    round: round,
                    data: top11,
                    created_at: new Date().toISOString()
                },
                { onConflict: 'round' }
            );

        if (error) {
            console.error('Save TOTW error:', error);
            return false;
        }

        console.log('TOTW saved for round', round);
        return true;

    } catch (e) {
        console.error('Save TOTW exception:', e);
        return false;
    }
}


async function loadTOTWSnapshot(round) {

    if (!window.sbClient) return null;

    try {

        const { data, error } = await window.sbClient
            .from('saved_totw')
            .select('data')
            .eq('round', round)
            .maybeSingle();

        if (error) {
            console.error('Load TOTW error:', error);
            return null;
        }

        if (!data || !data.data) return null;

        return data.data;

    } catch (e) {
        console.error('Load TOTW exception:', e);
        return null;
    }
}


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
   SWITCH VIEW
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
   UPDATE GW LABEL
========================================================= */

function updateGWLabel(round) {
    const label = document.getElementById('totwGwLabel');
    if (label) {
        label.textContent = 'GW' + round;
    }
}


/* =========================================================
   RENDER SQUAD
========================================================= */

function renderTOTWCards(top11) {

    const pitch = document.getElementById('totwPlayers');

    if (!pitch) return;

    const forward1 = top11[0];
    const forward2 = top11[1];
    const forward3 = top11[2];

    const mid1 = top11[3];
    const mid2 = top11';

[4];
    const mid3 = top11[5];

    const def1 = top11   [6];
    const def2 = html top11[7];
    const def3 = top11[ +=8];
    const def4 = top11[9 '<];

    const goalkeeper = top11[10];

    let html = '';

    html += '<div class="totw-row totw-row-gk">';
    html += createTdivOTWCard(goalkeeper);
    html += '</div> class="totw-row totw-row-def">';
    html += createTOTWCard(def1);
    html += createTOTWCard(def2);
    html += createTOTWCard(def3);
    html += createTOTWCard(def4);
    html += '</div>';

    html += '<div class="totw-row totw-row-mid">';
    html += createTOTWCard(mid1);
    html += createTOTWCard(mid2);
    html += createTOTWCard(mid3);
    html += '</div>';

    html += '<div class="totw-row totw-row-fwd">';
    html += createTOTWCard(forward1);
    html += createTOTWCard(forward2);
    html += createTOTWCard(forward3);
    html += '</div>';

    pitch.innerHTML = html;
}


/* =========================================================
   CREATE CARD — مع 3 حالات fallback
========================================================= */

function createTOTWCard(player) {

    if (!player) return '';

    const rawName = player.player_name || player.entry_name || 'Unknown';
    const name = shortenPlayerName(rawName);
    const points = player.event_total || 0;

    let teamName = '';
    if (typeof findPlayerTeam === 'function') {
        teamName = findPlayerTeam(rawName) || findPlayerTeam(player.entry_name) || '';
    }

    let shirtHtml = '';

    /* الحالة 1: عندنا قميص الفريق */
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

    }

    /* الحالة 2: عندنا شعار الفريق (بدون قميص) */
    else if (
        teamName &&
        typeof TEAMS_LOGOS !== 'undefined' &&
        TEAMS_LOGOS[teamName]
    ) {

        shirtHtml =
            '<div class="tc-shirt tc-shirt-fallback">' +
                '<img src="./' + TEAMS_LOGOS[teamName] + '" alt="' + teamName + '" onerror="this.style.display=\'none\'">' +
            '</div>';

    }

    /* الحالة 3: ما لقينا شي — دائرة بالحرف الأول */
    else {

        const firstLetter = (rawName.charAt(0) || '?').toUpperCase();

        shirtHtml =
            '<div class="tc-shirt tc-shirt-initial">' +
                '<span>' + firstLetter + '</span>' +
            '</div>';
    }

    return '<div class="totw-card">' +
        shirtHtml +
        '<div class="tc-name">' + name + '</div>' +
        '<div class="tc-points">' + points + '</div>' +
    '</div>';
}


/* =========================================================
   RENDER LIST
========================================================= */

function renderTOTWList(top11) {

    const listWrapper = document.getElementById('totwListWrapper');

    if (!listWrapper) return;

    let html = '';

    html += '<div class="totw-list-header">';
    html += '<div class="totw-list-h-rank">#</div>';
    html += '<div class="totw-list-h-team">Team & Manager</div>';
    html += '<div class="totw-list-h-gw">GW</div>';
    html += '<div class="totw-list-h-total">Total</div>';
    html += '</div>';

    top11.forEach(function(player, index) {

        const rawName = player.player_name || player.entry_name || 'Unknown';
        const entryName = player.entry_name || '';
        const points = player.event_total || 0;
        const total = player.total || 0;

        let teamName = '';
        if (typeof findPlayerTeam === 'function') {
            teamName = findPlayerTeam(rawName) || findPlayerTeam(player.entry_name) || '';
        }

        let logoHtml = '';

        if (
            teamName &&
            typeof TEAMS_LOGOS !== 'undefined' &&
            TEAMS_LOGOS[teamName]
        ) {
            logoHtml =
                '<div class="totw-list-logo">' +
                    '<img src="./' + TEAMS_LOGOS[teamName] + '" alt="' + teamName + '" onerror="this.style.display=\'none\'">' +
                '</div>';
        } else {
            logoHtml =
                '<div class="totw-list-logo totw-list-logo-empty">' +
                    '<span>⚽</span>' +
                '</div>';
        }

        html += '<div class="totw-list-item">';
        html += '<div class="totw-list-rank">' + (index + 1) + '</div>';
        html += logoHtml;
        html += '<div class="totw-list-names">';
        html += '<div class="totw-list-entry">' + (entryName || rawName) + '</div>';
        html += '<div class="totw-list-player">' + rawName + '</div>';
        html += '</div>';
        html += '<div class="totw-list-gw">' + points + '</div>';
        html += '<div class="totw-list-total">' + total + '</div>';
        html += '</div>';
    });

    listWrapper.innerHTML = html;
}


/* =========================================================
   LOAD TOTW — مع الحفظ والتحميل من Supabase
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

        const viewingRound = currentRound;
        const latestRound = getLatestRound();

        let top11 = null;
        let fromSnapshot = false;

        /* لو الجولة قديمة → نجيب من snapshot */
        if (latestRound > 0 && viewingRound < latestRound) {

            console.log('Loading snapshot for round', viewingRound);

            const snapshot = await loadTOTWSnapshot(viewingRound);

            if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
                top11 = snapshot;
                fromSnapshot = true;
                console.log('Snapshot loaded:', top11.length, 'players');
            }
        }

        /* لو ما لقينا snapshot أو الجولة هي الأحدث → نجيب من FPL */
        if (!top11) {

            console.log('Fetching fresh from FPL');

            const allResults = await fetchTOTWPages();

            if (!allResults || allResults.length === 0) {
                throw new Error('No data received');
            }

            top11 = getTOTWTop11(allResults);

            /* نحفظ snapshot لو الجولة هي الأحدث */
            if (viewingRound === latestRound && latestRound > 0) {
                await saveTOTWSnapshot(viewingRound, top11);
            }
        }

        currentTOTWData = top11;

        updateGWLabel(viewingRound);
        renderTOTWCards(top11);
        renderTOTWList(top11);

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


/* =========================================================
   SAVE TOTW MANUALLY
========================================================= */

async function saveManualTOTW(round) {

    if (!round) return;

    try {

        const allResults = await fetchTOTWPages();

        if (!allResults || allResults.length === 0) return;

        const top11 = getTOTWTop11(allResults);

        await saveTOTWSnapshot(round, top11);

        console.log('Manual TOTW saved for round', round);

    } catch (e) {
        console.error('saveManualTOTW error:', e);
    }
}


/* =========================================================
   INIT
========================================================= */

document.addEventListener('DOMContentLoaded', function() {
    loadTOTW();
});
