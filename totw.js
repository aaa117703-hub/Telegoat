/* =========================================================
   totw.js — v3
   أفضل 20 مدير + اختيار 11 يدوياً
   الترتيب في Squad: FWD(3) → MID(3) → DEF(4) → GK(1)
========================================================= */

const TOTW_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const TOTW_TOTAL_PAGES = 7;
const TOTW_TOP_COUNT = 20;
const TOTW_SQUAD_SIZE = 11;

let currentTOTWView = 'squad';
let currentTOTWData = [];
let currentTOTWSelected = [];
let currentTOTWRound = 0;

/* =========================================================
   SHORTEN PLAYER NAME
========================================================= */

function shortenPlayerName(name) {
    if (!name) return name;
    const result = name.trim();
    if (result.length <= 12) return result;
    return result.substring(0, 12);
}

function getLatestRound() {
    const saved = parseInt(localStorage.getItem('fpl_last_round') || '0', 10);
    return isNaN(saved) ? 0 : saved;
}

/* =========================================================
   SAVE / LOAD SNAPSHOT
========================================================= */

async function saveTOTWSnapshot(round, players, selected) {
    if (!window.sbClient) return false;
    if (!round || !players || players.length === 0) return false;

    try {
        const { error } = await window.sbClient
            .from('saved_totw')
            .upsert({
                round: round,
                data: { players: players, selected: selected || [] },
                created_at: new Date().toISOString()
            }, { onConflict: 'round' });

        if (error) {
            console.error('Save TOTW error:', error);
            return false;
        }
        console.log('TOTW saved for round', round, '(', players.length, 'players,', (selected||[]).length, 'selected )');
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

        if (data.data.players && Array.isArray(data.data.players)) {
            return {
                players: data.data.players,
                selected: Array.isArray(data.data.selected) ? data.data.selected : []
            };
        }

        if (Array.isArray(data.data)) {
            return {
                players: data.data,
                selected: data.data.map(function(p){ return p.entry; })
            };
        }

        return null;
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
                if (data.standings.has_next !== true) break;
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
   GET TOP 20 — فقط من عنده فريق
========================================================= */

function getTOTWTop20(allResults) {
    const sorted = [...allResults].sort(function(a, b) {
        return (b.event_total || 0) - (a.event_total || 0);
    });

    const filtered = sorted.filter(function(m) {
        if (typeof findPlayerTeam !== 'function') return true;
        const rawName = m.player_name || m.entry_name || '';
        const teamName = findPlayerTeam(rawName) || '';
        return teamName !== '';
    });

    console.log('TOTW Filter: ' + filtered.length + ' / ' + sorted.length + ' have known team');

    return filtered.slice(0, TOTW_TOP_COUNT);
}

/* =========================================================
   SWITCH VIEW
========================================================= */

function switchTOTWView(view) {
    currentTOTWView = view;

    const squadBtn = document.getElementById('totwSquadBtn');
    const listBtn = document.getElementById('totwListBtn');

    if (squadBtn) squadBtn.classList.toggle('active', view === 'squad');
    if (listBtn) listBtn.classList.toggle('active', view === 'list');

    const pitchWrapper = document.getElementById('totwPitchWrapper');
    const listWrapper = document.getElementById('totwListWrapper');

    if (view === 'list') {
        if (pitchWrapper) pitchWrapper.style.display = 'none';
        if (listWrapper) listWrapper.style.display = 'block';
    } else {
        if (pitchWrapper) pitchWrapper.style.display = 'flex';
        if (listWrapper) listWrapper.style.display = 'none';
        renderTOTWCards(currentTOTWSelected);
    }
}

/* =========================================================
   RENDER SQUAD
   الترتيب: FWD(3) → MID(3) → DEF(4) → GK(1)
========================================================= */

function renderTOTWCards(selectedPlayers) {
    const pitch = document.getElementById('totwPlayers');
    if (!pitch) return;

    // ترتيب المختارين حسب نقاط الجولة (تنازلي)
    const sorted = [...(selectedPlayers || [])].sort(function(a, b) {
        return (b.event_total || 0) - (a.event_total || 0);
    });

    // التوزيع:
    // أعلى 3 → هجوم (FWD)
    // تالي 3 → وسط (MID)
    // تالي 4 → دفاع (DEF)
    // الأقل (1) → حارس (GK)
    const fwd = sorted.slice(0, 3);
    const mid = sorted.slice(3, 6);
    const def = sorted.slice(6, 10);
    const gk  = sorted.slice(10, 11);

    let html = '';

    html += '<div class="totw-row totw-row-gk">';
    html += gk.map(createTOTWCard).join('');
    html += '</div>';

    html += '<div class="totw-row totw-row-def">';
    html += def.map(createTOTWCard).join('');
    html += '</div>';

    html += '<div class="totw-row totw-row-mid">';
    html += mid.map(createTOTWCard).join('');
    html += '</div>';

    html += '<div class="totw-row totw-row-fwd">';
    html += fwd.map(createTOTWCard).join('');
    html += '</div>';

    pitch.innerHTML = html;
}

/* =========================================================
   CREATE CARD
========================================================= */

function createTOTWCard(player) {
    if (!player) return '';

    const rawName = player.player_name || player.entry_name || 'Unknown';
    const name = shortenPlayerName(rawName);
    const points = player.event_total || 0;

    let teamName = '';
    if (typeof findPlayerTeam === 'function') {
        teamName = findPlayerTeam(rawName) || '';
    }

    let shirtHtml = '';

    if (teamName && typeof TEAMS_SHIRTS !== 'undefined' && TEAMS_SHIRTS[teamName]) {
        shirtHtml =
            '<div class="tc-shirt">' +
                '<img src="./' + TEAMS_SHIRTS[teamName].file + '" alt="" onerror="this.style.display=\'none\'">' +
            '</div>';
    } else if (teamName && typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) {
        shirtHtml =
            '<div class="tc-shirt tc-shirt-fallback">' +
                '<img src="./' + TEAMS_LOGOS[teamName] + '" alt="" onerror="this.style.display=\'none\'">' +
            '</div>';
    } else {
        shirtHtml = '<div class="tc-shirt tc-shirt-empty"></div>';
    }

    return '<div class="totw-card">' +
        shirtHtml +
        '<div class="tc-name">' + name + '</div>' +
        '<div class="tc-points">' + points + '</div>' +
    '</div>';
}

/* =========================================================
   RENDER LIST — 20 صف مع Checkbox
========================================================= */

function renderTOTWList(players) {
    const listWrapper = document.getElementById('totwListWrapper');
    if (!listWrapper) return;

    let html = '';

    // Count bar
    html += '<div class="totw-count-bar">';
    html += '<div>Selected: <span class="count-num' + (currentTOTWSelected.length === TOTW_SQUAD_SIZE ? ' full' : '') + '">' + currentTOTWSelected.length + '</span> / ' + TOTW_SQUAD_SIZE + '</div>';
    html += '<button class="reset-btn" onclick="resetTOTWSelection()">Reset</button>';
    html += '</div>';

    // Header
    html += '<div class="totw-list-header">';
    html += '<div class="totw-list-h-check">✓</div>';
    html += '<div class="totw-list-h-rank">#</div>';
    html += '<div class="totw-list-h-logo"></div>';
    html += '<div class="totw-list-h-team">Team & Manager</div>';
    html += '<div class="totw-list-h-gw">GW</div>';
    html += '<div class="totw-list-h-total">Total</div>';
    html += '</div>';

    players.forEach(function(player, index) {

        const entryId = player.entry;
        const rawName = player.player_name || player.entry_name || 'Unknown';
        const entryName = player.entry_name || '';
        const points = player.event_total || 0;
        const total = player.total || 0;
        const isSelected = currentTOTWSelected.indexOf(entryId) !== -1;

        let teamName = '';
        if (typeof findPlayerTeam === 'function') {
            teamName = findPlayerTeam(rawName) || '';
        }

        let logoHtml = '';
        if (teamName && typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) {
            logoHtml = '<div class="totw-list-logo">' +
                '<img src="./' + TEAMS_LOGOS[teamName] + '" onerror="this.style.display=\'none\'">' +
            '</div>';
        } else {
            logoHtml = '<div class="totw-list-logo totw-list-logo-empty">★</div>';
        }

        html += '<div class="totw-list-item' + (isSelected ? ' selected' : '') + '" data-entry="' + entryId + '" onclick="toggleTOTWSelection(' + entryId + ')">';
        html += '<div class="totw-list-check' + (isSelected ? ' checked' : '') + '">' + (isSelected ? '✓' : '') + '</div>';
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
   TOGGLE SELECTION
========================================================= */

function toggleTOTWSelection(entryId) {
    const idx = currentTOTWSelected.indexOf(entryId);

    if (idx !== -1) {
        currentTOTWSelected.splice(idx, 1);
    } else {
        if (currentTOTWSelected.length >= TOTW_SQUAD_SIZE) {
            if (typeof showToast === 'function') {
                showToast('Squad full (11)', false);
            } else {
                alert('التشكيلة كاملة — شيل واحد أول');
            }
            return;
        }
        currentTOTWSelected.push(entryId);
    }

    const selectedPlayers = currentTOTWData.filter(function(p) {
        return currentTOTWSelected.indexOf(p.entry) !== -1;
    });

    renderTOTWList(currentTOTWData);
    renderTOTWCards(selectedPlayers);

    const viewingRound = currentRound;
    const latestRound = getLatestRound();
    if (viewingRound === latestRound && latestRound > 0) {
        saveTOTWSnapshot(viewingRound, currentTOTWData, currentTOTWSelected);
    }
}

function resetTOTWSelection() {
    currentTOTWSelected = currentTOTWData.slice(0, TOTW_SQUAD_SIZE).map(function(p) {
        return p.entry;
    });

    const selectedPlayers = currentTOTWData.filter(function(p) {
        return currentTOTWSelected.indexOf(p.entry) !== -1;
    });

    renderTOTWList(currentTOTWData);
    renderTOTWCards(selectedPlayers);

    const viewingRound = currentRound;
    const latestRound = getLatestRound();
    if (viewingRound === latestRound && latestRound > 0) {
        saveTOTWSnapshot(viewingRound, currentTOTWData, currentTOTWSelected);
    }
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
        const viewingRound = currentRound;
        const latestRound = getLatestRound();
        currentTOTWRound = viewingRound;

        let players = null;
        let selected = null;

        if (latestRound > 0 && viewingRound < latestRound) {
            console.log('Loading snapshot for old round', viewingRound);
            const snapshot = await loadTOTWSnapshot(viewingRound);

            if (snapshot && snapshot.players && snapshot.players.length > 0) {
                players = snapshot.players;
                selected = snapshot.selected && snapshot.selected.length > 0
                    ? snapshot.selected
                    : players.slice(0, TOTW_SQUAD_SIZE).map(function(p){ return p.entry; });
                console.log('Snapshot loaded:', players.length, 'players');
            } else {
                loadingBox.style.display = 'none';
                if (errorBox) {
                    errorBox.style.display = 'block';
                    errorBox.innerHTML =
                        '⚠️ <strong>TOTW الجولة ' + viewingRound + ' غير متوفر</strong><br>' +
                        '<span style="font-size:12px;color:#999;">لم يتم حفظ بيانات هذه الجولة</span>';
                }
                return;
            }
        } else {
            console.log('Fetching fresh for round', viewingRound);
            const allResults = await fetchTOTWPages();

            if (!allResults || allResults.length === 0) {
                throw new Error('No data received');
            }

            players = getTOTWTop20(allResults);
            selected = players.slice(0, TOTW_SQUAD_SIZE).map(function(p){ return p.entry; });

            if (viewingRound === latestRound && latestRound > 0) {
                await saveTOTWSnapshot(viewingRound, players, selected);
            }
        }

        currentTOTWData = players;
        currentTOTWSelected = selected;

        const selectedPlayers = players.filter(function(p) {
            return selected.indexOf(p.entry) !== -1;
        });

        renderTOTWCards(selectedPlayers);
        renderTOTWList(players);

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
   SAVE MANUAL TOTW
========================================================= */

async function saveManualTOTW(round) {
    if (!round) return false;

    try {
        console.log('Saving manual TOTW for round', round);
        const allResults = await fetchTOTWPages();

        if (!allResults || allResults.length === 0) {
            console.warn('No results to save');
            return false;
        }

        const players = getTOTWTop20(allResults);
        const selected = currentTOTWSelected.length > 0
            ? currentTOTWSelected
            : players.slice(0, TOTW_SQUAD_SIZE).map(function(p){ return p.entry; });

        const ok = await saveTOTWSnapshot(round, players, selected);

        if (ok) console.log('Manual TOTW saved for round', round);
        return ok;

    } catch (e) {
        console.error('saveManualTOTW error:', e);
        return false;
    }
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener('DOMContentLoaded', function() {
    loadTOTW();
});

window.toggleTOTWSelection = toggleTOTWSelection;
window.resetTOTWSelection = resetTOTWSelection;
