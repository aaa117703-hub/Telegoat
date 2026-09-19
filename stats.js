/* =========================================================
   stats.js — إحصائيات احترافية (بالعربي)
========================================================= */

const STATS_WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const STATS_TOTAL_PAGES = 7;

let statsAllManagers = [];
let statsLoaded = false;
let statsComputed = null;


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
   COMPUTE STATS
========================================================= */

function computeLeagueStats(managers) {

    if (!managers || managers.length === 0) return null;

    const totalManagers = managers.length;

    let sumEvent = 0;
    let sumTotal = 0;
    let highestEvent = 0;
    let highestTotal = 0;
    let lowestEvent = Infinity;

    managers.forEach(function(m) {
        const ev = m.event_total || 0;
        const to = m.total || 0;
        sumEvent += ev;
        sumTotal += to;
        if (ev > highestEvent) highestEvent = ev;
        if (ev < lowestEvent) lowestEvent = ev;
        if (to > highestTotal) highestTotal = to;
    });

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
        highestEvent: highestEvent,
        lowestEvent: lowestEvent === Infinity ? 0 : lowestEvent,
        highestTotal: highestTotal,
        topEvent: sortedByEvent.slice(0, 10),
        topTotal: sortedByTotal.slice(0, 10),
        allManagers: managers
    };
}


/* =========================================================
   CREATE ROW
========================================================= */

function createStatsRow(rank, manager, value, valueLabel) {

    const rawName = manager.player_name || manager.entry_name || 'غير معروف';
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
    let medal = '';
    if (rank === 1) { rankClass = 'stats-rank-gold'; medal = '🥇'; }
    else if (rank === 2) { rankClass = 'stats-rank-silver'; medal = '🥈'; }
    else if (rank === 3) { rankClass = 'stats-rank-bronze'; medal = '🥉'; }

    return '<div class="stats-row">' +
        '<div class="stats-rank ' + rankClass + '">' + (medal || rank) + '</div>' +
        logoHtml +
        '<div class="stats-row-names">' +
            '<div class="stats-row-entry">' + (entryName || rawName) + '</div>' +
            '<div class="stats-row-player">' + rawName + '</div>' +
        '</div>' +
        '<div class="stats-row-value">' +
            '<div class="stats-row-value-num">' + value + '</div>' +
            (valueLabel ? '<div class="stats-row-value-label">' + valueLabel + '</div>' : '') +
        '</div>' +
    '</div>';
}


/* =========================================================
   RENDER OVERVIEW
========================================================= */

function renderStatsOverview(stats) {

    if (!stats) return;

    const setVal = function(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setVal('kpiManagers', stats.totalManagers);
    setVal('kpiAvg', stats.avgEvent);
    setVal('kpiHigh', stats.highestEvent);
    setVal('kpiHighestTotal', stats.highestTotal);

    const topEventList = document.getElementById('statsTopEvent');
    if (topEventList) {
        topEventList.innerHTML = '';
        stats.topEvent.forEach(function(m, i) {
            topEventList.innerHTML += createStatsRow(i + 1, m, m.event_total || 0, 'الجولة');
        });
    }

    const topTotalList = document.getElementById('statsTopTotal');
    if (topTotalList) {
        topTotalList.innerHTML = '';
        stats.topTotal.forEach(function(m, i) {
            topTotalList.innerHTML += createStatsRow(i + 1, m, m.total || 0, 'المجموع');
        });
    }
}


/* =========================================================
   RENDER RECORDS
========================================================= */

function renderStatsRecords(stats) {

    if (!stats) return;

    const container = document.getElementById('statsRecordsContent');
    if (!container) return;

    const cards = [];

    if (stats.topEvent[0]) {
        const m = stats.topEvent[0];
        cards.push({
            icon: '⚡',
            label: 'أعلى نقاط جولة',
            value: stats.highestEvent,
            name: m.player_name || m.entry_name,
            color: 'gold'
        });
    }

    if (stats.topTotal[0]) {
        const m = stats.topTotal[0];
        cards.push({
            icon: '🏆',
            label: 'أعلى مجموع',
            value: stats.highestTotal,
            name: m.player_name || m.entry_name,
            color: 'gold'
        });
    }

    if (stats.lowestEvent) {
        cards.push({
            icon: '💀',
            label: 'أسوأ جولة',
            value: stats.lowestEvent,
            name: '—',
            color: 'red'
        });
    }

    cards.push({
        icon: '📊',
        label: 'متوسط الجولة',
        value: stats.avgEvent,
        name: 'لكل مدير',
        color: 'green'
    });

    cards.push({
        icon: '📈',
        label: 'متوسط المجموع',
        value: stats.avgTotal,
        name: 'لكل مدير',
        color: 'green'
    });

    cards.push({
        icon: '👥',
        label: 'عدد المديرين',
        value: stats.totalManagers,
        name: 'الدوري',
        color: 'purple'
    });

    container.innerHTML = cards.map(function(c) {
        return '<div class="stats-record-card stats-record-' + c.color + '">' +
            '<div class="stats-record-icon">' + c.icon + '</div>' +
            '<div class="stats-record-label">' + c.label + '</div>' +
            '<div class="stats-record-value">' + c.value + '</div>' +
            '<div class="stats-record-name">' + c.name + '</div>' +
        '</div>';
    }).join('');
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
    }).slice(0, 8);
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

        const sortedByTotal = [...statsAllManagers].sort(function(a, b) {
            return (b.total || 0) - (a.total || 0);
        });

        const rank = sortedByTotal.findIndex(function(x) {
            return x.entry === m.entry;
        }) + 1;

        let teamName = '';
        if (typeof findPlayerTeam === 'function') {
            teamName = findPlayerTeam(rawName) || findPlayerTeam(entryName) || '';
        }

        let logoHtml = '';
        if (teamName && typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) {
            logoHtml = '<div class="stats-search-logo">' +
                '<img src="./' + TEAMS_LOGOS[teamName] + '" onerror="this.style.display=\'none\'">' +
            '</div>';
        } else {
            logoHtml = '<div class="stats-search-logo stats-search-logo-empty">⚽</div>';
        }

        const div = document.createElement('div');
        div.className = 'stats-search-item';
        div.innerHTML =
            '<div class="stats-search-rank">#' + rank + '</div>' +
            logoHtml +
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

    const sortedByTotal = [...statsAllManagers].sort(function(a, b) {
        return (b.total || 0) - (a.total || 0);
    });

    const rank = sortedByTotal.findIndex(function(m) {
        return m.entry === manager.entry;
    }) + 1;

    const totalManagers = statsAllManagers.length;

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

    const percentile = Math.round(((totalManagers - rank + 1) / totalManagers) * 100);

    const topManager = sortedByTotal[0];
    const diff = topManager ? (topManager.total || 0) - (manager.total || 0) : 0;

    const nextManager = sortedByTotal[rank - 2];
    const prevManager = sortedByTotal[rank];
    const toNext = nextManager ? (nextManager.total || 0) - (manager.total || 0) : 0;
    const toPrev = prevManager ? (manager.total || 0) - (prevManager.total || 0) : 0;

    container.innerHTML =
        '<div class="stats-profile-card">' +

            '<button class="stats-profile-close" onclick="document.getElementById(\'statsProfile\').style.display=\'none\'">✕</button>' +

            '<div class="stats-profile-rank-badge">#' + rank + '</div>' +

            '<div class="stats-profile-shirt">' + shirtHtml + '</div>' +

            '<div class="stats-profile-entry">' + (entryName || rawName) + '</div>' +
            '<div class="stats-profile-player">' + rawName + '</div>' +

            (teamName ? '<div class="stats-profile-team">' + teamName + '</div>' : '') +

            '<div class="stats-profile-stats">' +

                '<div class="stats-profile-stat stats-stat-total">' +
                    '<div class="stats-stat-label">المجموع</div>' +
                    '<div class="stats-stat-value">' + (manager.total || 0) + '</div>' +
                '</div>' +

                '<div class="stats-profile-stat stats-stat-gw">' +
                    '<div class="stats-stat-label">الجولة</div>' +
                    '<div class="stats-stat-value">' + (manager.event_total || 0) + '</div>' +
                '</div>' +

                '<div class="stats-profile-stat stats-stat-rank">' +
                    '<div class="stats-stat-label">الترتيب</div>' +
                    '<div class="stats-stat-value">' + rank + '</div>' +
                '</div>' +

            '</div>' +

            '<div class="stats-profile-details">' +

                '<div class="stats-detail-row">' +
                    '<span class="stats-detail-label">المئوية</span>' +
                    '<span class="stats-detail-value">' + percentile + '%</span>' +
                '</div>' +

                '<div class="stats-detail-row">' +
                    '<span class="stats-detail-label">عن المتصدر</span>' +
                    '<span class="stats-detail-value' + (diff === 0 ? ' stats-green' : '') + '">' +
                        (diff === 0 ? '👑 أنت المتصدر' : '-' + diff) +
                    '</span>' +
                '</div>' +

                (toNext > 0 ?
                '<div class="stats-detail-row">' +
                    '<span class="stats-detail-label">عن اللي فوقك</span>' +
                    '<span class="stats-detail-value stats-yellow">-' + toNext + '</span>' +
                '</div>' : '') +

                (toPrev > 0 ?
                '<div class="stats-detail-row">' +
                    '<span class="stats-detail-label">عن اللي تحتك</span>' +
                    '<span class="stats-detail-value stats-green">+' + toPrev + '</span>' +
                '</div>' : '') +

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
            throw new Error('لم يتم استلام بيانات');
        }

        statsAllManagers = managers;
        statsLoaded = true;
        statsComputed = computeLeagueStats(managers);

        renderStatsOverview(statsComputed);
        renderStatsRecords(statsComputed);

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

    } catch (e) {

        console.error('Stats load error:', e);

        if (loadingEl) {
            loadingEl.innerHTML = '⚠️ خطأ في التحميل: ' + e.message;
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
