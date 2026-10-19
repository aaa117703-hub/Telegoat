/* =========================================================
   champions-cup.js — v9 (The Ultimate Masterpiece)
========================================================= */

(function(){
'use strict';

var CC_LEAGUES = {
    'ARS': 369450, 'AVL': 369537, 'BOU': 369291, 'BRE': 369578,
    'BHA': 369606, 'CHE': 369638, 'COV': 369673, 'CRY': 369721,
    'EVE': 369745, 'FUL': 369770, 'HUL': 369795, 'IPS': 369827,
    'LEE': 369850, 'LIV': 370310, 'MCI': 369942, 'MUN': 369961,
    'NEW': 369987, 'NOT': 370008, 'SUN': 370048, 'TOT': 370074
};

var CC_TEAM_NAMES = {
    'ARS': 'Arsenal', 'AVL': 'Aston Villa', 'BOU': 'Bournemouth',
    'BRE': 'Brentford', 'BHA': 'Brighton', 'CHE': 'Chelsea',
    'COV': 'Coventry City', 'CRY': 'Crystal Palace', 'EVE': 'Everton',
    'FUL': 'Fulham', 'HUL': 'Hull City', 'IPS': 'Ipswich Town',
    'LEE': 'Leeds United', 'LIV': 'Liverpool', 'MCI': 'Man City',
    'MUN': 'Man Utd', 'NEW': 'Newcastle', 'NOT': 'Nottingham Forest',
    'SUN': 'Sunderland', 'TOT': 'Spurs'
};

var CC_TEAMS_LIST = Object.keys(CC_LEAGUES);
var CC_WORKER = 'https://telegoat-api.aa1623165.workers.dev';
var CC_SYNC_INTERVAL = 10 * 60 * 1000; // 10 Minutes

// Rules
var CC_TOP_6 = ['ARS', 'MCI', 'MUN', 'LIV', 'CHE', 'TOT'];
var CC_PROMOTED = ['COV', 'HUL', 'LEE'];
var CC_ADMIN_ID = 2984723;

var ccState = {
    members: {},
    currentRound: 1,
    loading: false,
    syncTimer: null,
    fplData: null,
    _currentEdit: null,
    _bonusStep: 0,
    _scoresCache: {}
};

/* ========== HELPERS ========== */
function ccLog() { var args = Array.prototype.slice.call(arguments); args.unshift('[CC]'); console.log.apply(console, args); }
function ccGetSb() { return window.sbClient || null; }
function ccEscapeHTML(s) { return String(s || '').replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ccFetch(url, timeout) { timeout = timeout || 15000; if (typeof fetchWithTimeout === 'function') return fetchWithTimeout(url, {}, timeout); return fetch(url); }

/* ========== DATA FETCHING ========== */
async function ccFetchFplBootstrap() {
    if (ccState.fplData) return ccState.fplData;
    try {
        var res = await ccFetch(CC_WORKER + '/?type=bootstrap');
        if (res.ok) {
            ccState.fplData = await res.json();
            return ccState.fplData;
        }
    } catch(e) { ccLog('Bootstrap fail', e); }
    return null;
}

/* ========== CALCULATE SCORES (IGNORING CHIPS) ========== */
async function ccCalculateAllScores() {
    var round = ccState.currentRound;
    var fplData = await ccFetchFplBootstrap();
    if (!fplData) return {};

    var liveRes = await ccFetch(CC_WORKER + '/?type=live&gw=' + round);
    var liveData = liveRes.ok ? await liveRes.json() : null;
    if (!liveData) return {};

    var liveMap = {};
    liveData.elements.forEach(function(el) { liveMap[el.id] = el.stats.total_points || 0; });

    var sb = ccGetSb();
    var { data: squads } = await sb.from('champions_cup_squads').select('*').eq('round', round);
    if (!squads || squads.length === 0) return {};

    var scores = {};
    var fetchPromises = [];

    squads.forEach(function(sq) {
        sq.starters.forEach(function(entryId) {
            fetchPromises.push(
                ccFetch(CC_WORKER + '/?type=picks&entry=' + entryId + '&gw=' + round)
                .then(function(r) { return r.ok ? r.json() : null; })
                .then(function(data) { return { entryId: entryId, picks: data ? data.picks : null }; })
            );
        });
    });

    var picksResults = await Promise.all(fetchPromises);
    var picksMap = {};
    picksResults.forEach(function(res) { if(res && res.picks) picksMap[res.entryId] = res.picks; });

    squads.forEach(function(sq) {
        var teamScore = 0;

        sq.starters.forEach(function(entryId) {
            var picks = picksMap[entryId];
            if (!picks) return;

            var starters = picks.filter(function(p) { return p.position <= 11; });
            var cap = starters.find(function(p) { return p.is_captain; });
            var vc = starters.find(function(p) { return p.is_vice_captain; });
            
            var targetCapId = cap ? cap.element : (vc ? vc.element : null);
            // Check if Captain played (Minutes > 0). If not, use Vice.
            if (cap) {
                var capLive = liveData.elements.find(function(e) { return e.id === cap.element; });
                if (capLive && capLive.stats.minutes === 0 && vc) {
                    targetCapId = vc.element;
                }
            }

            starters.forEach(function(p) {
                var pts = liveMap[p.element] || 0;
                teamScore += pts;
                // Captain gets 2x ONLY (Ignore Triple Captain)
                if (p.element === targetCapId) {
                    teamScore += pts; 
                }
            });
        });

        // Add Bonus Players Points
        if (sq.bonus && sq.bonus.length > 0) {
            sq.bonus.forEach(function(bonusId) {
                teamScore += (liveMap[bonusId] || 0);
            });
        }

        scores[sq.team] = teamScore;
    });

    ccState._scoresCache = scores;
    return scores;
}

/* ========== RENDER MATCHES (H2H) ========== */
async function ccRenderMatches() {
    var container = document.getElementById('ccMatchesContainer');
    if (!container) return;
    container.innerHTML = '<div class="cc-loading">Calculating scores...</div>';

    var scores = await ccCalculateAllScores();
    var round = ccState.currentRound;
    var matches = (typeof matchweeks !== 'undefined' && matchweeks[round]) ? matchweeks[round] : [];

    if (matches.length === 0) {
        container.innerHTML = '<div class="cc-empty">No matches for this round.</div>';
        return;
    }

    var html = '<div class="cc-matches-container">';
    html += '<div class="cc-matches-header">MATCHWEEK ' + round + '</div>';

    matches.forEach(function(m) {
        var home = m[0], away = m[1];
        var homeScore = scores[home] !== undefined ? scores[home] : 0;
        var awayScore = scores[away] !== undefined ? scores[away] : 0;
        
        var homeName = CC_TEAM_NAMES[home], awayName = CC_TEAM_NAMES[away];
        var homeLogo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[homeName]) ? TEAMS_LOGOS[homeName] : '';
        var awayLogo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[awayName]) ? TEAMS_LOGOS[awayName] : '';

        html += '<div class="cc-match-row">';
        // Home Team
        html += '<div class="cc-match-team home" onclick="ccOpenTeam(\'' + home + '\')">';
        html += '<span>' + homeName + '</span>';
        if (homeLogo) html += '<img src="./' + homeLogo + '">';
        html += '</div>';

        // Score Box
        html += '<div class="cc-match-score">' + homeScore + ' <span class="vs">-</span> ' + awayScore + '</div>';

        // Away Team
        html += '<div class="cc-match-team away" onclick="ccOpenTeam(\'' + away + '\')">';
        if (awayLogo) html += '<img src="./' + awayLogo + '">';
        html += '<span>' + awayName + '</span>';
        html += '</div>';

        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
}

/* ========== RENDER TEAMS GRID ========== */
async function ccRenderTeamsGrid() {
    var container = document.getElementById('ccTeamsGrid');
    if (!container) return;
    container.innerHTML = '<div class="cc-loading">Loading Teams...</div>';

    var sb = ccGetSb();
    var { data: members } = await sb.from('champions_cup_members').select('*');
    
    var byTeam = {};
    CC_TEAMS_LIST.forEach(function(t) { byTeam[t] = []; });
    (members || []).forEach(function(m) {
        (m.teams || []).forEach(function(t) { if (byTeam[t]) byTeam[t].push(m); });
    });

    var html = '';
    CC_TEAMS_LIST.forEach(function(tc) {
        var name = CC_TEAM_NAMES[tc];
        var logo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[name]) ? TEAMS_LOGOS[name] : '';
        var count = byTeam[tc].length;

        html += '<div class="cc-team-card" data-team="' + tc + '">' +
            '<div class="cc-team-logo">' + (logo ? '<img src="./' + logo + '">' : '') + '</div>' +
            '<div class="cc-team-info"><div class="cc-team-name">' + name + '</div>' +
            '<div class="cc-team-count">' + count + ' Managers</div></div></div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('.cc-team-card').forEach(function(c) {
        c.addEventListener('click', function() { ccOpenTeam(this.getAttribute('data-team')); });
    });
}

/* ========== PITCH VIEW ========== */
async function ccOpenTeam(teamCode) {
    var modal = document.getElementById('ccModal');
    var sb = ccGetSb();
    if (!modal || !sb) return;

    modal.innerHTML = '<div class="cc-modal-box"><div class="cc-loading">Loading Squad...</div></div>';
    modal.classList.add('show');

    var { data: squad } = await sb.from('champions_cup_squads').select('*').eq('team', teamCode).eq('round', ccState.currentRound).maybeSingle();
    var { data: members } = await sb.from('champions_cup_members').select('*');
    
    ccRenderPitchUI(teamCode, members, squad, false);
}

async function ccOpenSquadEditor(teamCode) {
    var sb = ccGetSb();
    var { data: squad } = await sb.from('champions_cup_squads').select('*').eq('team', teamCode).eq('round', ccState.currentRound).maybeSingle();
    var { data: members } = await sb.from('champions_cup_members').select('*');

    ccState._currentEdit = {
        team: teamCode,
        starters: squad ? squad.starters.slice() : [],
        bench: squad ? squad.bench.slice() : [],
        bonus: squad ? (squad.bonus || []).slice() : []
    };

    ccRenderPitchUI(teamCode, members, squad, true);
}

function ccRenderPitchUI(teamCode, allMembers, squad, isEdit) {
    var modal = document.getElementById('ccModal');
    var teamName = CC_TEAM_NAMES[teamCode];
    var teamLogo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) ? TEAMS_LOGOS[teamName] : '';

    var starters = isEdit ? ccState._currentEdit.starters : (squad ? squad.starters : []);
    var bench = isEdit ? ccState._currentEdit.bench : (squad ? squad.bench : []);
    var bonus = isEdit ? ccState._currentEdit.bonus : (squad ? squad.bonus : []);

    var teamMembers = (allMembers || []).filter(function(m) { return m.teams.includes(teamCode); });
    var membersMap = {};
    teamMembers.forEach(function(m) { membersMap[m.entry_id] = m; });

    // Helper to get shirt
    function getShirt(teamFullName) {
        if (typeof TEAMS_SHIRTS !== 'undefined' && TEAMS_SHIRTS[teamFullName]) {
            return './' + TEAMS_SHIRTS[teamFullName].file;
        }
        return ''; // fallback
    }

    function createCard(id, isBonus, isBenchCard) {
        var m = membersMap[id];
        if (!m) return '';
        
        var shirtUrl = getShirt(teamName); // Since all managers in this view belong to the same team
        var pts = m.total || 0;
        
        var html = '<div class="cc-player-card ' + (isBonus ? 'is-bonus' : '') + '">';
        if (shirtUrl) {
            html += '<img src="' + shirtUrl + '" class="cc-player-shirt" onerror="this.style.display=\'none\'">';
        }
        html += '<div class="cc-player-name-box">' + ccEscapeHTML(m.entry_name || m.player_name).substring(0,10) + '</div>';
        html += '<div class="cc-player-points">' + pts + '</div>';
        html += '</div>';
        return html;
    }

    var html = '<div class="cc-modal-box">' +
        '<div class="cc-modal-header"><div class="cc-modal-title">' + teamName + (isEdit ? ' — Edit' : '') + '</div>' +
        '<button class="cc-modal-close" onclick="document.getElementById(\'ccModal\').classList.remove(\'show\')"><span class="tg-icon tg-icon-sm tg-icon-close"></span></button></div>' +
        '<div class="cc-modal-body">';

    if (starters.length === 0 && !isEdit) {
        html += '<div class="cc-empty">No squad selected for this round.</div>';
        if (typeof isAdmin === 'function' && isAdmin()) {
            html += '<button class="cc-action-btn" onclick="ccOpenSquadEditor(\'' + teamCode + '\')">Edit Squad</button>';
        }
    } else {
        // PITCH UI
        html += '<div class="cc-pitch-wrapper">';
        
        // Team Header on Pitch
        html += '<div class="cc-pitch-team-header">';
        if (teamLogo) html += '<img src="./' + teamLogo + '">';
        html += '<span>' + teamName + '</span></div>';

        // Rows (FWD, MID, DEF, GK)
        html += '<div class="cc-pitch-row">' + starters.slice(8, 11).map(function(id) { return createCard(id, bonus.includes(id), false); }).join('') + '</div>';
        html += '<div class="cc-pitch-row">' + starters.slice(5, 8).map(function(id) { return createCard(id, bonus.includes(id), false); }).join('') + '</div>';
        html += '<div class="cc-pitch-row">' + starters.slice(1, 5).map(function(id) { return createCard(id, bonus.includes(id), false); }).join('') + '</div>';
        html += '<div class="cc-pitch-row">' + starters.slice(0, 1).map(function(id) { return createCard(id, bonus.includes(id), false); }).join('') + '</div>';
        html += '</div>'; // End Pitch

        // BENCH
        if (bench.length > 0) {
            html += '<div class="cc-bench-wrapper"><div class="cc-bench-title">BENCH</div><div class="cc-bench-row">' +
                bench.map(function(id) { return createCard(id, false, true); }).join('') + '</div></div>';
        }

        // BONUS DISPLAY
        if (bonus.length > 0) {
            var fplData = ccState.fplData;
            html += '<div class="cc-section-title" style="margin-top:20px;color:var(--cc-purple-300);">BONUS PLAYERS</div><div class="cc-bench-row" style="gap:10px;flex-wrap:wrap;justify-content:flex-start;">';
            bonus.forEach(function(bonusId) {
                var el = fplData ? fplData.elements.find(function(e) { return e.id === bonusId; }) : null;
                if (el) {
                    var teamObj = fplData.teams.find(function(t) { return t.id === el.team; });
                    var badge = 'https://resources.premierleague.com/premierleague/badges/70/t' + teamObj.code + '.png';
                    html += '<div class="cc-player-card is-bonus">' +
                        '<img src="' + badge + '" class="cc-player-shirt">' +
                        '<div class="cc-player-name-box">' + el.web_name + '</div>' +
                        '<div class="cc-player-points">' + (el.total_points || 0) + '</div></div>';
                }
            });
            html += '</div>';
        }

        if (isEdit) {
            html += '<div class="cc-actions-area">';
            html += '<button class="cc-action-btn" onclick="ccOpenSelectionList(\''+teamCode+'\')"><span class="tg-icon tg-icon-sm tg-icon-users"></span> Select 11 + 2 Bench</button>';
            html += '<button class="cc-action-btn bonus" onclick="ccOpenBonusModal(\''+teamCode+'\')"><span class="tg-icon tg-icon-sm tg-icon-star"></span> Select Bonus Players</button>';
            html += '<button class="cc-action-btn save" onclick="ccSaveSquad(\'' + teamCode + '\')"><span class="tg-icon tg-icon-sm tg-icon-check"></span> Save Squad</button>';
            html += '</div>';
        } else {
            if (typeof isAdmin === 'function' && isAdmin()) {
                html += '<button class="cc-action-btn" style="margin-top:15px;" onclick="ccOpenSquadEditor(\'' + teamCode + '\')">Edit Squad</button>';
            }
        }
    }

    html += '</div></div>';
    modal.innerHTML = html;
}

/* ========== SELECTION LIST ========== */
async function ccOpenSelectionList(teamCode) {
    var sb = ccGetSb();
    var { data: members } = await sb.from('champions_cup_members').select('*');
    var teamMembers = (members || []).filter(function(m) { return m.teams.includes(teamCode); });
    var state = ccState._currentEdit;

    var html = '<div class="cc-modal-box">' +
        '<div class="cc-modal-header"><div class="cc-modal-title">' + CC_TEAM_NAMES[teamCode] + ' — Select Squad</div>' +
        '<button class="cc-modal-close" onclick="ccRenderPitchUI(\''+teamCode+'\', null, null, true)"><span class="tg-icon tg-icon-sm tg-icon-close"></span></button></div>' +
        '<div class="cc-modal-body"><div class="cc-list-container">';

    teamMembers.forEach(function(m) {
        var isStarter = state.starters.includes(m.entry_id);
        var isBench = state.bench.includes(m.entry_id);
        var cls = isStarter ? 'is-starter' : (isBench ? 'is-bench' : '');
        
        html += '<div class="cc-list-item ' + cls + '" onclick="ccToggleMember('+m.entry_id+', \''+teamCode+'\')">' +
            '<div class="cc-list-name">' + ccEscapeHTML(m.entry_name || m.player_name) + '</div>' +
            '<div class="cc-list-pts">' + (m.total||0) + ' pts</div></div>';
    });

    html += '</div><button class="cc-action-btn" style="margin-top:15px;" onclick="ccRenderPitchUI(\''+teamCode+'\', null, null, true)">Done</button></div></div>';
    document.getElementById('ccModal').innerHTML = html;
}

function ccToggleMember(entryId, teamCode) {
    var state = ccState._currentEdit;
    var sIdx = state.starters.indexOf(entryId);
    var bIdx = state.bench.indexOf(entryId);

    if (sIdx !== -1) {
        state.starters.splice(sIdx, 1);
    } else if (bIdx !== -1) {
        state.bench.splice(bIdx, 1);
    } else {
        if (state.starters.length < 11) {
            state.starters.push(entryId);
        } else if (state.bench.length < 2) {
            state.bench.push(entryId);
        } else {
            if (typeof showToast === 'function') showToast('Squad full! (11 Starters, 2 Bench)', false);
        }
    }
    ccOpenSelectionList(teamCode);
}

/* ========== BONUS LOGIC ========== */
async function ccOpenBonusModal(teamCode) {
    var fplData = await ccFetchFplBootstrap();
    if (!fplData) return alert('FPL Data not loaded');

    var step = ccState._bonusStep;
    var title = step === 0 ? 'Bonus 1 (Not Top 6 & Promoted)' : 'Bonus 2 (Promoted Only)';
    var validElements = [];

    fplData.elements.forEach(function(el) {
        var teamObj = fplData.teams.find(function(t) { return t.id === el.team; });
        if (!teamObj) return;
        var tShort = teamObj.short_name;

        if (step === 0) {
            if (!CC_TOP_6.includes(tShort) && !CC_PROMOTED.includes(tShort)) {
                validElements.push({ el: el, teamObj: teamObj });
            }
        } else {
            if (CC_PROMOTED.includes(tShort)) {
                validElements.push({ el: el, teamObj: teamObj });
            }
        }
    });

    validElements.sort(function(a, b) { return b.el.total_points - a.el.total_points; });

    var html = '<div class="cc-modal-box">' +
        '<div class="cc-modal-header"><div class="cc-modal-title">' + title + '</div>' +
        '<button class="cc-modal-close" onclick="ccRenderPitchUI(\''+teamCode+'\', null, null, true)"><span class="tg-icon tg-icon-sm tg-icon-close"></span></button></div>' +
        '<div class="cc-modal-body"><div class="cc-list-container">';
    
    validElements.forEach(function(item) {
        var badge = 'https://resources.premierleague.com/premierleague/badges/70/t' + item.teamObj.code + '.png';
        html += '<div class="cc-bonus-item" onclick="ccSelectBonusPlayer(' + item.el.id + ', \''+teamCode+'\')">' +
            '<img src="' + badge + '" class="cc-bonus-img">' +
            '<div><div class="cc-bonus-name">' + item.el.web_name + '</div>' +
            '<div class="cc-bonus-team">' + item.teamObj.name + ' | ' + item.el.total_points + ' pts</div></div>' +
            '</div>';
    });

    html += '</div></div></div>';
    document.getElementById('ccModal').innerHTML = html;
}

function ccSelectBonusPlayer(playerId, teamCode) {
    var fplData = ccState.fplData;
    var el = fplData.elements.find(function(e) { return e.id === playerId; });
    
    if (ccState._bonusStep === 0) {
        ccState._currentEdit.bonus[0] = playerId;
        ccState._bonusStep = 1;
        if (typeof showToast === 'function') showToast('Bonus 1 selected: ' + el.web_name, true);
        ccOpenBonusModal(teamCode);
    } else {
        ccState._currentEdit.bonus[1] = playerId;
        ccState._bonusStep = 0;
        if (typeof showToast === 'function') showToast('Bonus 2 selected: ' + el.web_name, true);
        ccRenderPitchUI(teamCode, null, null, true);
    }
}

/* ========== SAVE SQUAD ========== */
async function ccSaveSquad(teamCode) {
    var state = ccState._currentEdit;
    if (state.starters.length !== 11 || state.bench.length !== 2) {
        return showToast('Must select exactly 11 starters and 2 bench', false);
    }
    if (state.bonus.length !== 2) {
        return showToast('Must select 2 bonus players', false);
    }
    var sb = ccGetSb();
    var res = await sb.from('champions_cup_squads').upsert({
        team: teamCode, round: ccState.currentRound,
        starters: state.starters, bench: state.bench, bonus: state.bonus,
        updated_at: new Date().toISOString()
    }, { onConflict: 'team,round' });

    if (res.error) {
        showToast('Save failed: ' + res.error.message, false);
    } else {
        showToast('Squad saved successfully!', true);
        document.getElementById('ccModal').classList.remove('show');
    }
}

/* ========== SYNC MEMBERS ========== */
async function ccSyncMembers() {
    if (ccState.loading) return { ok: false };
    ccState.loading = true;
    var allMembers = {};

    for (var i = 0; i < CC_TEAMS_LIST.length; i++) {
        var teamCode = CC_TEAMS_LIST[i];
        var leagueId = CC_LEAGUES[teamCode];
        try {
            var res = await ccFetch(CC_WORKER + '/?type=league&id=' + leagueId);
            if (!res.ok) continue;
            var data = await res.json();
            var results = (data.standings && data.standings.results) || [];
            
            results.forEach(function(m) {
                if (m.entry === CC_ADMIN_ID) return; // Exclude Admin
                if (!allMembers[m.entry]) {
                    allMembers[m.entry] = { entry_id: m.entry, player_name: m.player_name, entry_name: m.entry_name, total: m.total, event_total: m.event_total, teams: [] };
                }
                if (allMembers[m.entry].teams.indexOf(teamCode) === -1) {
                    allMembers[m.entry].teams.push(teamCode);
                }
            });
        } catch(e) { ccLog('Sync fail ' + teamCode, e); }
    }

    var membersArr = Object.values(allMembers);
    var sb = ccGetSb();
    if (sb && membersArr.length > 0) {
        try {
            var rows = membersArr.map(function(m) { return { ...m, updated_at: new Date().toISOString() }; });
            for (var k = 0; k < rows.length; k += 50) {
                await sb.from('champions_cup_members').upsert(rows.slice(k, k+50), { onConflict: 'entry_id' });
            }
        } catch(e) { ccLog('Supabase sync error', e); }
    }

    ccState.members = allMembers;
    ccState.loading = false;
    return { ok: true, count: membersArr.length };
}

/* ========== INIT ========== */
async function ccInit() {
    ccState.currentRound = (typeof currentRound !== 'undefined') ? currentRound : 1;
    
    var container = document.querySelector('.cc-container');
    if (container && !document.querySelector('.cc-main-tabs')) {
        // Build Tabs and Views
        container.innerHTML = `<div class="cc-main-tabs">
            <button class="cc-tab-btn active" onclick="ccSwitchTab('matches')">Matches (H2H)</button>
            <button class="cc-tab-btn" onclick="ccSwitchTab('teams')">Teams</button>
        </div>
        <div id="ccMatchesContainer"></div>
        <div id="ccTeamsGrid" class="cc-teams-grid" style="display:none;"></div>`;
    }

    // Hide refresh button for non-admins
    var refreshBtn = document.getElementById('ccRefreshBtn');
    if (refreshBtn) {
        if (typeof isAdmin === 'function' && isAdmin()) refreshBtn.style.display = 'flex';
        else refreshBtn.style.display = 'none';
    }

    // Initial Render
    await ccRenderMatches(); // Default to Matches tab
    
    ccSyncMembers().then(function() { 
        if (document.getElementById('ccMatchesContainer').style.display !== 'none') ccRenderMatches();
        if (document.getElementById('ccTeamsGrid').style.display !== 'none') ccRenderTeamsGrid();
    });
    
    // Start 10 min timer
    if (ccState.syncTimer) clearInterval(ccState.syncTimer);
    ccState.syncTimer = setInterval(function() {
        ccSyncMembers().then(function() { 
            if (document.getElementById('ccMatchesContainer').style.display !== 'none') ccRenderMatches();
            if (document.getElementById('ccTeamsGrid').style.display !== 'none') ccRenderTeamsGrid();
        });
    }, CC_SYNC_INTERVAL);
}

/* ========== EXPORTS ========== */
window.ccInit = ccInit;
window.ccSyncMembers = ccSyncMembers;
window.ccOpenTeam = ccOpenTeam;
window.ccOpenSquadEditor = ccOpenSquadEditor;
window.ccSaveSquad = ccSaveSquad;
window.ccOpenBonusModal = ccOpenBonusModal;
window.ccSelectBonusPlayer = ccSelectBonusPlayer;
window.ccOpenSelectionList = ccOpenSelectionList;
window.ccToggleMember = ccToggleMember;
window.ccRenderPitchUI = ccRenderPitchUI;
window.ccSwitchTab = function(tab) {
    document.querySelectorAll('.cc-tab-btn').forEach(function(b) { b.classList.remove('active'); });
    var btn = Array.from(document.querySelectorAll('.cc-tab-btn')).find(function(b) { return b.innerText.toLowerCase().includes(tab); });
    if(btn) btn.classList.add('active');
    
    document.getElementById('ccTeamsGrid').style.display = tab === 'teams' ? 'grid' : 'none';
    document.getElementById('ccMatchesContainer').style.display = tab === 'matches' ? 'block' : 'none';
    
    if (tab === 'matches') ccRenderMatches();
    if (tab === 'teams') ccRenderTeamsGrid();
};

ccLog('v9 Loaded');
})();
