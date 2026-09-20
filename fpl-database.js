/* =========================================================
   fpl-database.js — FPL Players & Teams Database
========================================================= */

(function(){
'use strict';

const WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const CACHE_KEY = 'fpl_bootstrap_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000;

const POS_MAP = {
    1: {short:'GK',  name:'Goalkeeper'},
    2: {short:'DEF', name:'Defender'},
    3: {short:'MID', name:'Midfielder'},
    4: {short:'FWD', name:'Forward'}
};

const SORT_OPTIONS = [
    {key:'total_points',        label:'Total Points'},
    {key:'event_points',        label:'GW Points'},
    {key:'now_cost',            label:'Price'},
    {key:'form',                label:'Form'},
    {key:'selected_by_percent', label:'Selected %'},
    {key:'goals_scored',        label:'Goals'},
    {key:'assists',             label:'Assists'},
    {key:'bonus',               label:'Bonus'}
];

const state = {
    data: null,
    teamsById: {},
    filtered: [],
    search: '',
    position: 'ALL',
    teamId: 'ALL',
    sortBy: 'total_points',
    sortDir: 'desc',
    view: 'players',
    loading: false,
    loaded: false
};

/* ====== Helpers ====== */
function photoURL(p){
    if(!p.photo) return '';
    const code = p.photo.replace('.jpg','');
    return 'https://resources.premierleague.com/premierleague/photos/players/110x140/p' + code + '.png';
}

function badgeURL(code, size){
    size = size || 70;
    return 'https://resources.premierleague.com/premierleague/badges/' + size + '/t' + code + '.png';
}

function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

/* ====== Loading ====== */
async function loadBootstrap(){
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if(cached){
            const parsed = JSON.parse(cached);
            if(Date.now() - parsed.ts < CACHE_TTL){
                console.log('[FPL] Loaded from cache');
                return parsed.data;
            }
        }
    } catch(e){}

    console.log('[FPL] Fetching bootstrap...');
    const res = await fetch(WORKER_URL + '?type=current');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), data: data}));
    } catch(e){
        console.warn('[FPL] Cache write failed:', e.message);
    }

    return data;
}

/* ====== Filter/Sort ====== */
function applyFilters(){
    if(!state.data) return;
    const term = state.search.toLowerCase().trim();
    const players = state.data.elements;

    let arr = players.filter(function(p){
        if(term){
            const full = (p.web_name + ' ' + p.first_name + ' ' + p.second_name).toLowerCase();
            if(full.indexOf(term) === -1) return false;
        }
        if(state.position !== 'ALL' && p.element_type !== state.position) return false;
        if(state.teamId !== 'ALL' && p.team !== state.teamId) return false;
        return true;
    });

    const key = state.sortBy;
    const dir = state.sortDir === 'desc' ? -1 : 1;
    arr.sort(function(a, b){
        let va = a[key], vb = b[key];
        if(typeof va === 'string') va = parseFloat(va) || 0;
        if(typeof vb === 'string') vb = parseFloat(vb) || 0;
        return (va - vb) * dir;
    });

    state.filtered = arr;
}

/* ====== Render: Players ====== */
function renderPlayerRow(p){
    const team = state.teamsById[p.team];
    const pos = POS_MAP[p.element_type] || {short:'?'};
    const photo = photoURL(p);
    const badge = team ? badgeURL(team.code, 70) : '';
    const price = (p.now_cost / 10).toFixed(1);

    const row = document.createElement('div');
    row.className = 'fpl-player-row';
    row.dataset.id = p.id;

    const initial = (p.web_name || '?').charAt(0).toUpperCase();
    const photoHTML = photo
        ? '<img src="' + photo + '" alt="" loading="lazy" onerror="this.parentNode.innerHTML=\'<div class=\\\'fpl-player-photo-empty\\\'>' + initial + '</div>\'">'
        : '<div class="fpl-player-photo-empty">' + initial + '</div>';

    row.innerHTML =
        '<div class="fpl-player-photo">' + photoHTML + '</div>' +
        '<div class="fpl-player-team-badge">' + (badge ? '<img src="' + badge + '" alt="" loading="lazy">' : '') + '</div>' +
        '<div class="fpl-player-names">' +
            '<div class="fpl-player-name">' + escapeHTML(p.web_name) +
                '<span class="fpl-pos-badge fpl-pos-' + pos.short + '">' + pos.short + '</span>' +
            '</div>' +
            '<div class="fpl-player-sub">' + escapeHTML(team ? team.name : '') + ' · ' + escapeHTML(p.first_name + ' ' + p.second_name) + '</div>' +
        '</div>' +
        '<div class="fpl-player-price">£' + price + 'm</div>' +
        '<div class="fpl-player-points">' + p.total_points + '<small>PTS</small></div>';

    row.addEventListener('click', function(){
        openModal(p.id);
    });

    return row;
}

function renderPlayersList(){
    const wrap = document.createElement('div');
    wrap.className = 'fpl-content';

    if(state.filtered.length === 0){
        wrap.innerHTML = '<div class="fpl-empty">No players match your filters</div>';
        return wrap;
    }

    const limit = Math.min(state.filtered.length, 200);
    const frag = document.createDocumentFragment();
    for(let i = 0; i < limit; i++){
        frag.appendChild(renderPlayerRow(state.filtered[i]));
    }
    wrap.appendChild(frag);

    if(state.filtered.length > limit){
        const more = document.createElement('div');
        more.className = 'fpl-empty';
        more.textContent = 'Showing first ' + limit + ' of ' + state.filtered.length + ' — refine search to see more';
        wrap.appendChild(more);
    }

    return wrap;
}

/* ====== Render: Teams ====== */
function renderTeamsGrid(){
    const wrap = document.createElement('div');
    wrap.className = 'fpl-teams-grid';

    const teams = state.data.teams.slice().sort(function(a,b){
        return a.name.localeCompare(b.name);
    });

    teams.forEach(function(t){
        const count = state.data.elements.filter(function(p){ return p.team === t.id; }).length;
        const card = document.createElement('div');
        card.className = 'fpl-team-card';
        card.innerHTML =
            '<div class="fpl-team-card-badge"><img src="' + badgeURL(t.code, 110) + '" alt="" loading="lazy"></div>' +
            '<div class="fpl-team-card-name">' + escapeHTML(t.name) + '</div>' +
            '<div class="fpl-team-card-count">' + count + ' PLAYERS</div>';
        card.addEventListener('click', function(){
            state.view = 'players';
            state.teamId = t.id;
            state.position = 'ALL';
            state.search = '';
            const searchInput = document.getElementById('fplSearch');
            if(searchInput) searchInput.value = '';
            const teamSelect = document.getElementById('fplTeam');
            if(teamSelect) teamSelect.value = t.id;
            document.querySelectorAll('.fpl-pos-btn').forEach(function(b){ b.classList.remove('active'); });
            const allBtn = document.querySelector('.fpl-pos-btn[data-pos="ALL"]');
            if(allBtn) allBtn.classList.add('active');
            document.querySelectorAll('.fpl-view-btn').forEach(function(b){
                b.classList.toggle('active', b.dataset.view === 'players');
            });
            const filterRow = document.querySelector('.fpl-filter-row');
            const searchRow = document.querySelector('.fpl-search-row');
            if(filterRow) filterRow.style.display = 'flex';
            if(searchRow) searchRow.style.display = 'flex';
            refresh();
        });
        wrap.appendChild(card);
    });

    return wrap;
}

/* ====== Render: Main ====== */
function render(){
    const content = document.getElementById('fplDbContent');
    const summary = document.getElementById('fplSummary');
    if(!content) return;

    if(state.loading){
        content.innerHTML = '<div class="fpl-loading"><div class="spinner"></div><div>Loading FPL data...</div></div>';
        if(summary) summary.style.display = 'none';
        return;
    }

    if(!state.data){
        content.innerHTML = '<div class="fpl-error">Failed to load FPL data. Check console for details.</div>';
        if(summary) summary.style.display = 'none';
        return;
    }

    content.innerHTML = '';

    if(state.view === 'teams'){
        content.appendChild(renderTeamsGrid());
        if(summary){
            summary.style.display = 'block';
            summary.innerHTML = '<span>' + state.data.teams.length + '</span> PREMIER LEAGUE TEAMS · <span>' + state.data.elements.length + '</span> PLAYERS';
        }
    } else {
        content.appendChild(renderPlayersList());
        if(summary){
            summary.style.display = 'block';
            summary.innerHTML = 'Showing <span>' + state.filtered.length + '</span> players · Top sorted by <span>' + getSortLabel() + '</span>';
        }
    }
}

function getSortLabel(){
    const found = SORT_OPTIONS.find(function(o){ return o.key === state.sortBy; });
    return found ? found.label : state.sortBy;
}

/* ====== Modal ====== */
function openModal(playerId){
    const p = state.data.elements.find(function(x){ return x.id === playerId; });
    if(!p) return;

    const team = state.teamsById[p.team];
    const pos = POS_MAP[p.element_type] || {short:'?', name:'?'};
    const photo = photoURL(p);
    const badge = team ? badgeURL(team.code, 70) : '';

    const modal = document.getElementById('fplModal');
    if(!modal) return;

    const initial = (p.web_name || '?').charAt(0).toUpperCase();
    const photoHTML = photo
        ? '<img src="' + photo + '" alt="" onerror="this.parentNode.innerHTML=\'<div class=\\\'fpl-player-photo-empty\\\' style=\\\'font-size:24px\\\'>' + initial + '</div>\'">'
        : '<div class="fpl-player-photo-empty" style="font-size:24px">' + initial + '</div>';

    const formNum = parseFloat(p.form) || 0;
    const formClass = formNum >= 5 ? 'green' : (formNum < 2 ? 'red' : '');

    modal.innerHTML =
        '<div class="fpl-modal-box">' +
            '<button class="fpl-modal-close" onclick="document.getElementById(\'fplModal\').classList.remove(\'show\')">×</button>' +
            '<div class="fpl-modal-header">' +
                '<div class="fpl-modal-photo">' + photoHTML + '</div>' +
                '<div class="fpl-modal-info">' +
                    '<div class="fpl-modal-name">' + escapeHTML(p.web_name) + '</div>' +
                    '<div class="fpl-modal-realname">' + escapeHTML(p.first_name + ' ' + p.second_name) + '</div>' +
                    '<div class="fpl-modal-tags">' +
                        '<span class="fpl-pos-badge fpl-pos-' + pos.short + '">' + pos.name + '</span>' +
                        (team
                            ? '<span class="fpl-modal-team-tag"><img src="' + badge + '" alt="">' + escapeHTML(team.name) + '</span>'
                            : '') +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="fpl-modal-stats">' +
                '<div class="fpl-stat-box"><div class="fpl-stat-label">Price</div><div class="fpl-stat-value gold">£' + (p.now_cost/10).toFixed(1) + 'm</div></div>' +
                '<div class="fpl-stat-box"><div class="fpl-stat-label">Total Pts</div><div class="fpl-stat-value">' + p.total_points + '</div></div>' +
                '<div class="fpl-stat-box"><div class="fpl-stat-label">Form</div><div class="fpl-stat-value ' + formClass + '">' + p.form + '</div></div>' +
                '<div class="fpl-stat-box"><div class="fpl-stat-label">GW Pts</div><div class="fpl-stat-value">' + p.event_points + '</div></div>' +
                '<div class="fpl-stat-box"><div class="fpl-stat-label">Goals</div><div class="fpl-stat-value green">' + p.goals_scored + '</div></div>' +
                '<div class="fpl-stat-box"><div class="fpl-stat-label">Assists</div><div class="fpl-stat-value green">' + p.assists + '</div></div>' +
            '</div>' +

            '<div class="fpl-modal-details">' +
                row('Minutes', p.minutes) +
                row('Clean Sheets', p.clean_sheets) +
                row('Bonus', p.bonus) +
                row('Selected By', p.selected_by_percent + '%') +
                row('Points / Game', p.points_per_game) +
                row('Expected Goals', p.expected_goals) +
                row('Expected Assists', p.expected_assists) +
                row('Status', statusLabel(p.status)) +
            '</div>' +
        '</div>';

    modal.classList.add('show');

    modal.onclick = function(e){
        if(e.target === modal) modal.classList.remove('show');
    };
}

function row(label, value){
    return '<div class="fpl-detail-row">' +
        '<span class="fpl-detail-label">' + label + '</span>' +
        '<span class="fpl-detail-value">' + escapeHTML(value) + '</span>' +
    '</div>';
}

function statusLabel(s){
    if(s === 'a') return 'Available';
    if(s === 'i') return 'Injured';
    if(s === 's') return 'Suspended';
    if(s === 'u') return 'Unavailable';
    if(s === 'd') return 'Doubtful';
    return s || '—';
}

/* ====== Refresh ====== */
function refresh(){
    applyFilters();
    render();
}

/* ====== Build Controls ====== */
function buildControls(){
    const sortSel = document.getElementById('fplSort');
    if(sortSel && sortSel.options.length === 0){
        SORT_OPTIONS.forEach(function(o){
            const opt = document.createElement('option');
            opt.value = o.key;
            opt.textContent = o.label;
            if(o.key === state.sortBy) opt.selected = true;
            sortSel.appendChild(opt);
        });
        sortSel.addEventListener('change', function(){
            state.sortBy = this.value;
            refresh();
        });
    }

    const teamSel = document.getElementById('fplTeam');
    if(teamSel && state.data && teamSel.options.length === 1){
        state.data.teams.slice().sort(function(a,b){
            return a.name.localeCompare(b.name);
        }).forEach(function(t){
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            teamSel.appendChild(opt);
        });
        teamSel.addEventListener('change', function(){
            const v = this.value;
            state.teamId = (v === 'ALL') ? 'ALL' : parseInt(v, 10);
            refresh();
        });
    }

    const searchInput = document.getElementById('fplSearch');
    if(searchInput && !searchInput.dataset.bound){
        searchInput.dataset.bound = '1';
        let timer = null;
        searchInput.addEventListener('input', function(){
            const val = this.value;
            clearTimeout(timer);
            timer = setTimeout(function(){
                state.search = val;
                refresh();
            }, 150);
        });
    }

    document.querySelectorAll('.fpl-view-btn').forEach(function(btn){
        if(btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(){
            const v = this.dataset.view;
            state.view = v;
            document.querySelectorAll('.fpl-view-btn').forEach(function(b){
                b.classList.toggle('active', b.dataset.view === v);
            });
            const filterRow = document.querySelector('.fpl-filter-row');
            const searchRow = document.querySelector('.fpl-search-row');
            if(filterRow) filterRow.style.display = (v === 'players') ? 'flex' : 'none';
            if(searchRow) searchRow.style.display = (v === 'players') ? 'flex' : 'none';
            refresh();
        });
    });

    document.querySelectorAll('.fpl-pos-btn').forEach(function(btn){
        if(btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(){
            const pos = this.dataset.pos;
            state.position = (pos === 'ALL') ? 'ALL' : parseInt(pos, 10);
            document.querySelectorAll('.fpl-pos-btn').forEach(function(b){
                b.classList.toggle('active', b.dataset.pos === pos);
            });
            refresh();
        });
    });
}

/* ====== Init ====== */
async function init(){
    if(state.loaded || state.loading) return;
    state.loading = true;
    render();

    try {
        const data = await loadBootstrap();
        state.data = data;

        state.teamsById = {};
        data.teams.forEach(function(t){ state.teamsById[t.id] = t; });

        state.loaded = true;
        state.loading = false;

        buildControls();
        refresh();

        console.log('[FPL] Ready. Teams:', data.teams.length, '· Players:', data.elements.length);
    } catch(e){
        state.loading = false;
        console.error('[FPL] Load failed:', e);
        render();
    }
}

document.addEventListener('DOMContentLoaded', function(){
    const fplBtn = document.querySelector('[data-tab="fpl"]');
    if(fplBtn){
        fplBtn.addEventListener('click', function(){
            init();
        });
    }

    if(document.getElementById('statsView-fpl') && document.getElementById('statsView-fpl').classList.contains('active')){
        setTimeout(init, 500);
    }
});

window.fplDbInit = init;

})();
