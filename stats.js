/* =========================================================
   stats.js — إحصائيات الدوري
========================================================= */

const STATS_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const STATS_TOTAL_PAGES = 7;

let statsAllManagers = [];
let statsLoaded = false;


/* =========================================================
   FETCH ALL MANAGERS
========================================================= */

async function fetchAllManagersForStats() {

    const allResults = [];

    for (let page = 1; page <= STATS_TOTAL_PAGES; page++) {

        try {

            const response = await fetch(STATS_WORKER_URL + '/?page=' + page);
            const data = await response.json();

            if (data && data.standings && data.standings.results) {

                allResults.push(...data.standings.results);

                if (data.standings.has_next !== true) break;

            } else {
                break;
            }

        } catch (e) {
            console.error('Stats page ' + page + ' failed:', e);
            break;
        }
    }

    return allResults;
}


/* =========================================================
   COMPUTE LEAGUE STATS
========================================================= */

function computeLeagueStats(managers) {

    if (!managers || managers.length === 0) return null;

    const totalManagers = managers.length;

    const sumEvent = managers.reduce(function(s, m) {
        return s + (m.event_total || 0);
    }, 0);

    const sumTotal = managers.reduce(function(s, m) {
        return s + (m.total || 0);
    }, 0);

    const avgEvent = Math.round(sumEvent / totalManagers);
    const avgTotal = Math.round(sumTotal / totalManagers);

    const sortedByEvent = [...managers].sort(function(a, b) {
        return (b.event_total || 0) - (a.event_total || 0);
    });

    const sortedByTotal = [...managers].sort(function(a, b) {
        return (b.total || 0) - (a.total || 0);
    });

    return {
        totalManagers: totalManagers,
        avgEvent: avgEvent,
        avgTotal: avgTotal,
        highestEvent: sortedByEvent[0] ? sortedByEvent[0].event_total : 0,
        highestTotal: sortedByTotal[0] ? sortedByTotal[0].total : 0,
        topEvent: sortedByEvent.slice(0, 10),
        topTotal: sortedByTotal.slice(0, 10),
        allManagers: managers
    };
}


/* =========================================================
   CREATE STATS ROW
========================================================= */

function createStatsRow(rank, manager, value) {

    const rawName = manager.player_name || manager.entry_name || 'Unknown';
    const entryName = manager.entry_name || '';

    let teamName = '';
    if (typeof findPlayerTeam === 'function') {
        teamName = findPlayerTeam(rawName) || findPlayerTeam(entryName) || '';
    }

    let logoHtml = '';

    if (
        teamName &&
        typeof TEAMS_LOGOS !== 'undefined' &&
        TEAMS_LOGOS[teamName]
    ) {
        logoHtml = '<div class="stats-row-logo">' +
            '<img src="./' + TEAMS_LOGOS[teamName] + '" onerror="this.style.display=\'none\'">' +
        '</div>';
    } else {
        logoHtml = '<div class="stats-row-logo stats-row-logo-empty">⚽</div>';
    }

    let rankClass = 'stats-rank-normal';
    if (rank === 1) rankClass = 'stats-rank-gold';
    else if (rank === 2) rankClass = 'stats-rank-silver';
    else if (rank === 3) rankClass = 'stats-rank-bronze';

    return '<div class="stats-row">' +
        '<div class="stats-rank ' + rankClass + '">' + rank + '</div>' +
        logoHtml +
        '<div class="stats-row-names">' +
            '<div class="stats-row-entry">' + (entryName || rawName) + '</div>' +
            '<div class="stats-row-player">' + rawName + '</div>' +
        '</div>' +
        '<div class="stats-row-value">' + value + '</div>' +
    '</div>';
}


/* =========================================================
   RENDER OVERVIEW
========================================================= */

function renderStatsOverview(stats) {

    if (!stats) return;

    const kpiManagers = document.getElementById('kpiManagers');
    const kpiAvg = document.getElementById('kpiAvg');
    const kpiHigh = document.getElementById('kpiHigh');
    const kpiHighestTotal = document.getElementById('kpiHighestTotal');

    if (kpiManagers) kpiManagers.textContent = stats.totalManagers;
    if (kpiAvg) kpiAvg.textContent = stats.avgEvent;
    if (kpiHigh) kpiHigh.textContent = stats.highestEvent;
    if (kpiHighestTotal) kpiHighestTotal.textContent = stats.highestTotal;

    const topEventList = document.getElementById('statsTopEvent');
    if (topEventList) {
        topEventList.innerHTML = '';
        stats.topEvent.forEach(function(m, i) {
            topEventList.innerHTML += createStatsRow(i + 1, m, m.event_total || 0);
        });
    }

    const topTotalList = document.getElementById('statsTopTotal');
    if (topTotalList) {
        topTotalList.innerHTML = '';
        stats.topTotal.forEach(function(m, i) {
            topTotalList.innerHTML += createStatsRow(i + 1, m, m.total || 0);
        });
    }
}


/* =========================================================
   SEARCH
========================================================= */

function searchManager(query) {

    if (!query || !statsAllManagers.length) return [];

    const q = query.toLowerCase().trim();

    return statsAllManagers.filter(function(m) {
        const pn = (m.player_name || '').toLowerCase();
        const en = (m.entry_name || '').toLowerCase();
        return pn.indexOf(q) !== -1 || en.indexOf(q) !== -1;
    }).slice(0, 5);
}


function renderSearchResults(results) {

    const container = document.getElementById('statsSearchResults');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<div class="stats-empty">لا توجد نتائج</div>';
        return;
    }

    container.innerHTML = '';

    results.forEach(function(m) {

        const rawName = m.player_name || m.entry_name || '';
        const entryName = m.entry_name || '';
        const idx = statsAllManagers.indexOf(m) + 1;

        const div = document.createElement('div');
        div.className = 'stats-search-item';
        div.innerHTML =
            '<div class="stats-search-rank">#' + idx + '</div>' +
            '<div class="stats-search-names">' +
                '<div class="stats-search-entry">' + (entryName || rawName) + '</div>' +
                '<div class="stats-search-player">' + rawName + '</div>' +
            '</div>' +
            '<div class="stats-search-total">' + (m.total || 0) + '</div>';

        div.addEventListener('click', function() {
            renderManagerProfile(m);
        });

        container.appendChild(div);
    });
}


/* =========================================================
   MANAGER PROFILE
========================================================= */

function renderManagerProfile(manager) {

    const container = document.getElementById('statsProfile');
    if (!container) return;

    const rawName = manager.player_name || manager.entry_name || '';
    const entryName = manager.entry_name || '';
    const rank = statsAllManagers.findIndex(function(m) {
        return m.entry === manager.entry;
    }) + 1;

    let teamName = '';
    if (typeof findPlayerTeam === 'function') {
        teamName = findPlayerTeam(rawName) || findPlayerTeam(entryName) || '';
    }

    let shirtHtml = '';

    if (
        teamName &&
        typeof TEAMS_SHIRTS !== 'undefined' &&
        TEAMS_SHIRTS[teamName]
    ) {
        shirtHtml = '<img src="./' + TEAMS_SHIRTS[teamName].file + '" onerror="this.style.display=\'none\'">';
    } else {
        shirtHtml = '<img src="./unknown-shirt.png" onerror="this.style.display=\'none\'">';
    }

    container.innerHTML =
        '<div class="stats-profile-card">' +
            '<div class="stats-profile-shirt">' + shirtHtml + '</div>' +
            '<div class="stats-profile-entry">' + (entryName || rawName) + '</div>' +
            '<div class="stats-profile-player">' + rawName + '</div>' +
            '<div class="stats-profile-team">' + (teamName || 'Unknown Team') + '</div>' +
            '<div class="stats-profile-stats">' +
                '<div class="stats-profile-stat">' +
                    '<div class="stats-stat-label">Rank</div>' +
                    '<div class="stats-stat-value">#' + rank + '</div>' +
                '</div>' +
                '<div class="stats-profile-stat">' +
                    '<div class="stats-stat-label">Total</div>' +
                    '<div class="stats-stat-value">' + (manager.total || 0) + '</div>' +
                '</div>' +
                '<div class="stats-profile-stat">' +
                    '<div class="stats-stat-label">This GW</div>' +
                    '<div class="stats-stat-value">' + (manager.event_total || 0) + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


/* =========================================================
   LOAD STATS
========================================================= */

async function loadStats() {

    const loadingEl = document.getElementById('statsLoading');
    const contentEl = document.getElementById('statsContent');

    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    if (statsLoaded && statsAllManagers.length > 0) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        return;
    }

    try {

        const managers = await fetchAllManagersForStats();

        if (!managers || managers.length === 0) {
            throw new Error('No data received');
        }

        statsAllManagers = managers;
        statsLoaded = true;

        const stats = computeLeagueStats(managers);
        renderStatsOverview(stats);

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

    } catch (e) {

        console.error('Stats load error:', e);

        if (loadingEl) {
            loadingEl.innerHTML = '⚠️ خطأ في التحميل';
            loadingEl.style.display = 'block';
        }
    }
}


/* =========================================================
   TAB SWITCHER
========================================================= */

function switchStatsTab(tabName) {

    document.querySelectorAll('.stats-tab-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.stats-view').forEach(function(view) {
        view.classList.toggle('active', view.id === 'statsView-' + tabName);
    });
}


/* =========================================================
   INIT
========================================================= */

document.addEventListener('DOMContentLoaded', function() {

    const searchInput = document.getElementById('statsSearchInput');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const q = this.value.trim();
            if (q.length < 2) {
                document.getElementById('statsSearchResults').innerHTML = '';
                return;
            }
            const results = searchManager(q);
            renderSearchResults(results);
        });
    }
});
