/* =========================================================
   manager-squad.js — عرض تشكيلة أي مدير من FPL
========================================================= */

(function(){
'use strict';

const WORKER_URL = 'https://fpl-api.aaa117703.workers.dev';
const STANDINGS_CACHE_KEY = 'fpl_standings_v1';
const STANDINGS_TTL = 6 * 60 * 60 * 1000;

let standingsCache = null;
let standingsLoading = null;

/* ========== Helpers ========== */
function badgeURL(code, size){
    size = size || 70;
    return 'https://resources.premierleague.com/premierleague/badges/' + size + '/t' + code + '.png';
}

function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

/* ========== Load All Managers ========== */
async function loadAllManagers(){
    if(standingsCache) return standingsCache;
    if(standingsLoading) return standingsLoading;

    try {
        const cached = localStorage.getItem(STANDINGS_CACHE_KEY);
        if(cached){
            const parsed = JSON.parse(cached);
            if(Date.now() - parsed.ts < STANDINGS_TTL){
                standingsCache = parsed.data;
                console.log('[SQUAD] Standings from cache:', standingsCache.length);
                return standingsCache;
            }
        }
    } catch(e){}

    standingsLoading = (async function(){
        const all = [];
        for(let p = 1; p <= 7; p++){
            try {
                const res = await fetch(WORKER_URL + '?page=' + p);
                const data = await res.json();
                const results = (data && data.standings && data.standings.results) ? data.standings.results : [];
                all.push.apply(all, results);
            } catch(e){
                console.warn('[SQUAD] Failed page ' + p, e.message);
            }
        }
        standingsCache = all;
        try {
            localStorage.setItem(STANDINGS_CACHE_KEY, JSON.stringify({ts: Date.now(), data: all}));
        } catch(e){}
        console.log('[SQUAD] Standings loaded:', all.length);
        return all;
    })();

    return standingsLoading;
}

/* ========== Find entry_id by name ========== */
async function findEntryId(managerName, teamName){
    const all = await loadAllManagers();
    if(!all || all.length === 0) return null;

    const clean = function(s){
        return String(s||'').toLowerCase().trim().replace(/\s+/g,' ');
    };

    const mClean = clean(managerName);
    const tClean = clean(teamName);

    let found = all.find(function(m){ return clean(m.player_name) === mClean; });
    if(found) return found.entry;

    found = all.find(function(m){ return clean(m.entry_name) === tClean; });
    if(found) return found.entry;

    found = all.find(function(m){
        const pName = clean(m.player_name);
        const eName = clean(m.entry_name);
        if(!mClean) return false;
        return pName.indexOf(mClean) !== -1 ||
               mClean.indexOf(pName) !== -1 ||
               (tClean && (eName.indexOf(tClean) !== -1 || tClean.indexOf(eName) !== -1));
    });
    if(found) return found.entry;

    return null;
}

/* ========== Fetch Squad ========== */
async function fetchSquad(entryId, gw){
    const res = await fetch(WORKER_URL + '?type=picks&entry=' + entryId + '&gw=' + gw);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
}

async function fetchLive(gw){
    const res = await fetch(WORKER_URL + '?type=live&gw=' + gw);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
}

/* ========== Get Current GW ========== */
function getCurrentGw(){
    const bootstrap = window.fplDbGetData && window.fplDbGetData();
    if(!bootstrap || !bootstrap.events) return 1;
    const ev = bootstrap.events.find(function(e){ return e.is_current; })
            || bootstrap.events.find(function(e){ return e.is_previous; })
            || bootstrap.events.find(function(e){ return e.is_next; });
    return ev ? ev.id : 1;
}

/* ========== Render Squad ========== */
function renderSquad(managerName, gw, picksData, liveData){
    const bootstrap = window.fplDbGetData && window.fplDbGetData();
    if(!bootstrap){
        return '<div class="squad-error">FPL data not loaded yet. Wait a moment and try again.</div>';
    }

    const teamsById = window.fplDbGetTeamsById ? window.fplDbGetTeamsById() : {};
    const elementsById = {};
    bootstrap.elements.forEach(function(p){ elementsById[p.id] = p; });

    const liveById = {};
    if(liveData && liveData.elements){
        liveData.elements.forEach(function(el){ liveById[el.id] = el; });
    }

    const picks = (picksData && picksData.picks) ? picksData.picks : [];
    if(picks.length === 0){
        return '<div class="squad-error">No squad available for GW ' + gw + '</div>';
    }

    const starters = picks.filter(function(p){ return p.position <= 11; });
    const bench = picks.filter(function(p){ return p.position > 11; });

    const POS_MAP = {1:'GK', 2:'DEF', 3:'MID', 4:'FWD'};

    const groups = {
        'GK':  {name:'Goalkeeper',  players:[]},
        'DEF': {name:'Defenders',   players:[]},
        'MID': {name:'Midfielders', players:[]},
        'FWD': {name:'Forwards',    players:[]}
    };
    const benchArr = [];

    function buildPlayerHTML(slot){
        const el = elementsById[slot.element];
        if(!el) return '';

        const team = teamsById[el.team];
        const posKey = POS_MAP[el.element_type] || 'MID';
        const live = liveById[el.id];
        const rawPts = live ? (live.stats.total_points || 0) : 0;
        const multiplier = slot.multiplier || 1;
        const displayPts = rawPts * multiplier;

        const badges = [];
        if(slot.is_captain) badges.push('<span class="squad-cap-badge squad-cap-C">C</span>');
        if(slot.is_vice_captain) badges.push('<span class="squad-cap-badge squad-cap-V">V</span>');
        if(multiplier === 3) badges.push('<span class="squad-cap-badge squad-cap-3x">3x</span>');

        return '<div class="squad-player">' +
                '<div class="squad-player-badge">' +
                    (team ? '<img src="' + badgeURL(team.code, 40) + '" alt="" loading="lazy">' : '') +
                '</div>' +
                '<div class="squad-player-names">' +
                    '<div class="squad-player-name">' +
                        escapeHTML(el.web_name) +
                        (badges.length ? ' ' + badges.join(' ') : '') +
                    '</div>' +
                    '<div class="squad-player-team">' +
                        escapeHTML(team ? team.name : '') + ' · ' + posKey +
                    '</div>' +
                '</div>' +
                '<div class="squad-player-points' + (slot.is_captain ? ' captain' : '') + '">' +
                    displayPts +
                '</div>' +
            '</div>';
    }

    starters.forEach(function(slot){
        const el = elementsById[slot.element];
        if(!el) return;
        const posKey = POS_MAP[el.element_type] || 'MID';
        groups[posKey].players.push(buildPlayerHTML(slot));
    });

    bench.forEach(function(slot){
        benchArr.push(buildPlayerHTML(slot));
    });

    let html = '';

    // Stats
    const history = picksData.entry_history || {};
    const totalPts = history.points || 0;
    const overallPts = history.total_points || 0;
    const overallRank = history.overall_rank || '—';

    html += '<div class="squad-modal-stats">';
    html += '<div class="squad-stat-box"><div class="squad-stat-label">GW ' + gw + '</div><div class="squad-stat-value">' + totalPts + '</div></div>';
    html += '<div class="squad-stat-box"><div class="squad-stat-label">Total</div><div class="squad-stat-value green">' + overallPts + '</div></div>';
    html += '<div class="squad-stat-box"><div class="squad-stat-label">Overall Rank</div><div class="squad-stat-value gold">' + (typeof overallRank === 'number' ? overallRank.toLocaleString() : overallRank) + '</div></div>';
    html += '</div>';

    // Sections
    const order = ['GK', 'DEF', 'MID', 'FWD'];
    order.forEach(function(key){
        const g = groups[key];
        if(g.players.length === 0) return;
        html += '<div class="squad-section">';
        html += '<div class="squad-section-title">' + g.name + '</div>';
        html += g.players.join('');
        html += '</div>';
    });

    // Bench
    if(benchArr.length > 0){
        html += '<div class="squad-section">';
        html += '<div class="squad-section-title">Bench</div>';
        html += benchArr.join('');
        html += '</div>';
    }

    return html;
}

/* ========== Open Modal ========== */
async function openSquadModal(entryId, managerName){
    const modal = document.getElementById('squadModal');
    if(!modal) return;

    modal.innerHTML =
        '<div class="squad-modal-box">' +
            '<button class="squad-modal-close" onclick="document.getElementById(\'squadModal\').classList.remove(\'show\')">×</button>' +
            '<div class="squad-modal-title">' +
                '<div class="squad-modal-manager">' + escapeHTML(managerName || 'Squad') + '</div>' +
                '<div class="squad-modal-subtitle">Loading...</div>' +
            '</div>' +
            '<div class="squad-loading"><div class="spinner"></div><div>Loading squad...</div></div>' +
        '</div>';

    modal.classList.add('show');

    modal.onclick = function(e){
        if(e.target === modal) modal.classList.remove('show');
    };

    try {
        const currentGw = getCurrentGw();

        let picksData = null;
        let usedGw = currentGw;

        try {
            picksData = await fetchSquad(entryId, currentGw);
            if(!picksData.picks || picksData.picks.length === 0){
                throw new Error('empty');
            }
        } catch(e){
            console.warn('[SQUAD] GW ' + currentGw + ' failed, trying previous');
            usedGw = Math.max(1, currentGw - 1);
            picksData = await fetchSquad(entryId, usedGw);
        }

        let liveData = null;
        try {
            liveData = await fetchLive(usedGw);
        } catch(e){
            console.warn('[SQUAD] Live data unavailable:', e.message);
        }

        const content = renderSquad(managerName, usedGw, picksData, liveData);

        modal.innerHTML =
            '<div class="squad-modal-box">' +
                '<button class="squad-modal-close" onclick="document.getElementById(\'squadModal\').classList.remove(\'show\')">×</button>' +
                '<div class="squad-modal-title">' +
                    '<div class="squad-modal-manager">' + escapeHTML(managerName || 'Squad') + '</div>' +
                    '<div class="squad-modal-subtitle">GW ' + usedGw + ' Squad</div>' +
                '</div>' +
                content +
            '</div>';

        // Re-bind click to close
        modal.onclick = function(e){
            if(e.target === modal) modal.classList.remove('show');
        };

    } catch(e){
        console.error('[SQUAD] Failed:', e);
        modal.innerHTML =
            '<div class="squad-modal-box">' +
                '<button class="squad-modal-close" onclick="document.getElementById(\'squadModal\').classList.remove(\'show\')">×</button>' +
                '<div class="squad-modal-title">' +
                    '<div class="squad-modal-manager">' + escapeHTML(managerName || 'Squad') + '</div>' +
                '</div>' +
                '<div class="squad-error">Failed to load squad.<br><small>' + escapeHTML(e.message) + '</small></div>' +
            '</div>';
    }
}

/* ========== Attach Button ========== */
function attachSquadButton(){
    const profile = document.getElementById('statsProfile');
    if(!profile) return;
    if(profile.style.display === 'none') return;
    if(!profile.querySelector('.stats-profile-card')) return;

    // Already bound?
    if(profile.querySelector('.btn-view-squad')) return;

    const playerEl = profile.querySelector('.stats-profile-player');
    const entryEl = profile.querySelector('.stats-profile-entry');

    const playerName = playerEl ? playerEl.textContent.trim() : '';
    const teamName = entryEl ? entryEl.textContent.trim() : '';

    if(!playerName && !teamName) return;

    const btn = document.createElement('button');
    btn.className = 'btn-view-squad';
    btn.innerHTML = 'View FPL Squad';
    btn.type = 'button';

    btn.addEventListener('click', async function(){
        const origText = btn.textContent;
        btn.textContent = 'Loading...';
        btn.disabled = true;

        try {
            const entryId = await findEntryId(playerName, teamName);
            btn.textContent = origText;
            btn.disabled = false;

            if(!entryId){
                alert('Could not find this manager in FPL league.');
                return;
            }

            await openSquadModal(entryId, teamName || playerName);
        } catch(e){
            console.error('[SQUAD] Error:', e);
            btn.textContent = origText;
            btn.disabled = false;
            alert('Error: ' + e.message);
        }
    });

    const card = profile.querySelector('.stats-profile-card');
    if(card){
        card.appendChild(btn);
    } else {
        profile.appendChild(btn);
    }

    console.log('[SQUAD] Button added for:', playerName, '|', teamName);
}

/* ========== Watch Profile ========== */
function setupProfileWatcher(){
    const profile = document.getElementById('statsProfile');
    if(!profile){
        setTimeout(setupProfileWatcher, 500);
        return;
    }

    const observer = new MutationObserver(function(){
        // When profile hidden → cleanup button
        if(profile.style.display === 'none'){
            const btn = profile.querySelector('.btn-view-squad');
            if(btn) btn.remove();
        }
        attachSquadButton();
    });

    observer.observe(profile, {
        attributes: true,
        attributeFilter: ['style'],
        childList: true,
        subtree: true
    });

    attachSquadButton();
}

/* ========== Public API ========== */
window.openManagerSquad = async function(entryId, managerName){
    await openSquadModal(entryId, managerName || 'Manager');
};
window.findManagerEntryId = findEntryId;

/* ========== Init ========== */
document.addEventListener('DOMContentLoaded', function(){
    setTimeout(setupProfileWatcher, 1500);
    setTimeout(loadAllManagers, 2500); // Prefetch standings
});

})();
