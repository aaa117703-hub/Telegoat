/* =========================================================
   champions-cup.js — v14 (Entrance Animation + Top White Area)
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

var FPL_TO_LOCAL_TEAM = {
    'Arsenal': 'Arsenal', 'Aston Villa': 'Aston Villa', 'Bournemouth': 'Bournemouth',
    'Brentford': 'Brentford', 'Brighton': 'Brighton', 'Chelsea': 'Chelsea',
    'Coventry': 'Coventry City', 'Crystal Palace': 'Crystal Palace', 'Everton': 'Everton',
    'Fulham': 'Fulham', 'Hull': 'Hull City', 'Ipswich': 'Ipswich Town',
    'Leeds': 'Leeds United', 'Liverpool': 'Liverpool', 'Man City': 'Man City',
    'Man Utd': 'Man Utd', 'Newcastle': 'Newcastle', "Nott'm Forest": 'Nottingham Forest',
    'Sunderland': 'Sunderland', 'Spurs': 'Spurs'
};

var CC_TEAMS_LIST = Object.keys(CC_LEAGUES);
var CC_WORKER = 'https://telegoat-api.aa1623165.workers.dev';
var CC_SYNC_INTERVAL = 10 * 60 * 1000;

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
    _recentGWsPoints: {} 
};

/* ========== HELPERS ========== */
function ccLog() { var args = Array.prototype.slice.call(arguments); args.unshift('[CC]'); console.log.apply(console, args); }
function ccGetSb() { return window.sbClient || null; }
function ccEscapeHTML(s) { return String(s || '').replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ccFetch(url, timeout) { timeout = timeout || 15000; if (typeof fetchWithTimeout === 'function') return fetchWithTimeout(url, {}, timeout); return fetch(url); }

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

async function ccFetchLast5GWs(currentGW) {
    if (ccState._recentGWsPoints && Object.keys(ccState._recentGWsPoints).length > 0) {
        return ccState._recentGWsPoints;
    }

    var pointsMap = {};
    var startGW = Math.max(1, currentGW - 5);

    var promises = [];
    for (var gw = startGW; gw < currentGW; gw++) {
        promises.push(
            ccFetch(CC_WORKER + '/?type=live&gw=' + gw)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) { return { gw: gw, data: data }; })
        );
    }

    var results = await Promise.all(promises);
    
    results.forEach(function(res) {
        if (!res.data || !res.data.elements) return;
        res.data.elements.forEach(function(el) {
            if (!pointsMap[el.id]) pointsMap[el.id] = {};
            pointsMap[el.id][res.gw] = el.stats.total_points || 0;
        });
    });

    ccState._recentGWsPoints = pointsMap;
    return pointsMap;
}

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
        if (!sq.starters || sq.starters.length === 0) { scores[sq.team] = 0; return; }
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
        if (scores[sq.team] === 0) return;
        var teamScore = 0;

        sq.starters.forEach(function(entryId) {
            var picks = picksMap[entryId];
            if (!picks) return;
            var starters = picks.filter(function(p) { return p.position <= 11; });
            var cap = starters.find(function(p) { return p.is_captain; });
            var vc = starters.find(function(p) { return p.is_vice_captain; });
            var targetCapId = cap ? cap.element : (vc ? vc.element : null);
            if (cap && liveData.elements.find(function(e) { return e.id === cap.element; })?.stats.minutes === 0 && vc) { targetCapId = vc.element; }
            starters.forEach(function(p) {
                var pts = liveMap[p.element] || 0;
                teamScore += pts;
                if (p.element === targetCapId) teamScore += pts;
            });
        });

        if (sq.bonus && sq.bonus.length > 0) {
            sq.bonus.forEach(function(bonusId) { teamScore += (liveMap[bonusId] || 0); });
        }
        scores[sq.team] = teamScore;
    });

    return scores;
}

async function ccUpdateMainFixtures() {
    var scores = await ccCalculateAllScores();
    if (!scores || Object.keys(scores).length === 0) return;

    var round = ccState.currentRound;
    var matches = (typeof matchweeks !== 'undefined' && matchweeks[round]) ? matchweeks[round] : [];
    var updated = false;
    
    matches.forEach(function(m, idx) {
        var home = m[0], away = m[1];
        if (scores[home] !== undefined && scores[away] !== undefined) {
            scoresStorage['r' + round + '_m' + idx + '_home'] = scores[home];
            scoresStorage['r' + round + '_m' + idx + '_away'] = scores[away];
            updated = true;
        }
    });
    
    if (updated) {
        localStorage.setItem('fpl_scores', JSON.stringify(scoresStorage));
        if (typeof renderFixtures === 'function') renderFixtures();
        if (typeof renderStandings === 'function') renderStandings();
    }
}

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

    function getShirt(teamFullName) {
        if (typeof TEAMS_SHIRTS !== 'undefined' && TEAMS_SHIRTS[teamFullName]) {
            return './' + TEAMS_SHIRTS[teamFullName].file;
        }
        return ''; 
    }

    function createCard(id, isBonus) {
        var m = membersMap[id];
        if (!m) return '';
        var shirtUrl = getShirt(teamName);
        var pts = m.total || 0;
        var shirtHtml = shirtUrl ? '<img src="' + shirtUrl + '" onerror="this.style.display=\'none\'">' : '';
        
        return '<div class="cc-card">' +
            '<div class="cc-card-shirt">' + shirtHtml + '</div>' +
            '<div class="cc-card-name">' + ccEscapeHTML(m.entry_name || m.player_name).substring(0,10) + '</div>' +
            '<div class="cc-card-points">' + pts + '</div>' +
        '</div>';
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
        html += '<div class="cc-pitch-wrapper">';
        html += '<div class="cc-pitch">';
        
        // إضافة الغطاء الأبيض ذو الحواف الهلالية
        html += '<div class="cc-pitch-top-white"></div>';
        
        // الشعار مع الأنميشن
        if (teamLogo) {
            html += '<div class="cc-team-logo-top"><img src="./' + teamLogo + '"></div>';
        }

        html += '<div class="cc-players-container">';
        html += '<div class="cc-row cc-row-fwd">' + starters.slice(8, 11).map(function(id) { return createCard(id, bonus.includes(id)); }).join('') + '</div>';
        html += '<div class="cc-row cc-row-mid">' + starters.slice(5, 8).map(function(id) { return createCard(id, bonus.includes(id)); }).join('') + '</div>';
        html += '<div class="cc-row cc-row-def">' + starters.slice(1, 5).map(function(id) { return createCard(id, bonus.includes(id)); }).join('') + '</div>';
        html += '<div class="cc-row cc-row-gk">' + starters.slice(0, 1).map(function(id) { return createCard(id, bonus.includes(id)); }).join('') + '</div>';
        html += '</div></div></div>';

        if (bench.length > 0) {
            html += '<div class="cc-bench-wrapper"><div class="cc-bench-title">BENCH</div><div class="cc-bench-row">' +
                bench.map(function(id) { return createCard(id, false); }).join('') + '</div></div>';
        }

        if (bonus.length > 0) {
            var fplData = ccState.fplData;
            html += '<div class="cc-section-title" style="margin-top:20px;color:var(--purple-300);">BONUS PLAYERS</div><div class="cc-bench-row" style="gap:10px;flex-wrap:wrap;justify-content:flex-start;">';
            bonus.forEach(function(bonusId) {
                var el = fplData ? fplData.elements.find(function(e) { return e.id === bonusId; }) : null;
                if (el) {
                    var teamObj = fplData.teams.find(function(t) { return t.id === el.team; });
                    var mappedName = FPL_TO_LOCAL_TEAM[teamObj.name] || teamObj.name;
                    var shirtUrl = getShirt(mappedName);
                    var shirtHtml = shirtUrl ? '<img src="' + shirtUrl + '">' : '<img src="https://resources.premierleague.com/premierleague/badges/70/t' + teamObj.code + '.png">';
                    
                    html += '<div class="cc-card" style="border:1px solid #7C3AED;">' +
                        '<div class="cc-card-shirt">' + shirtHtml + '</div>' +
                        '<div class="cc-card-name">' + el.web_name + '</div>' +
                        '<div class="cc-card-points">' + (el.total_points || 0) + '</div></div>';
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

async function ccOpenBonusModal(teamCode) {
    var fplData = await ccFetchFplBootstrap();
    if (!fplData) return alert('FPL Data not loaded');

    var modal = document.getElementById('ccModal');
    modal.innerHTML = '<div class="cc-modal-box"><div class="cc-loading">Loading Bonus Players...</div></div>';

    var step = ccState._bonusStep;
    var title = step === 0 ? 'Bonus 1 (Not Top 6 & Promoted)' : 'Bonus 2 (Promoted Only)';
    
    var recentGWs = await ccFetchLast5GWs(ccState.currentRound);
    
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

    var listHtml = '';
    validElements.forEach(function(item) {
        var mappedName = FPL_TO_LOCAL_TEAM[item.teamObj.name] || item.teamObj.name;
        var shirtUrl = (typeof TEAMS_SHIRTS !== 'undefined' && TEAMS_SHIRTS[mappedName]) ? './' + TEAMS_SHIRTS[mappedName].file : 'https://resources.premierleague.com/premierleague/badges/70/t' + item.teamObj.code + '.png';
        
        var gwBoxes = '';
        for (var gw = Math.max(1, ccState.currentRound - 5); gw < ccState.currentRound; gw++) {
            var pts = (recentGWs[item.el.id] && recentGWs[item.el.id][gw] !== undefined) ? recentGWs[item.el.id][gw] : '-';
            var cls = '';
            if (pts >= 6) cls = 'high';
            else if (pts >= 3) cls = 'med';
            else if (pts === 0) cls = 'low';
            
            gwBoxes += '<div class="cc-gw-box ' + cls + '">' + pts + '</div>';
        }

        listHtml += '<div class="cc-bonus-row" onclick="ccSelectBonusPlayer(' + item.el.id + ', \'' + teamCode + '\')">' +
            '<div class="cc-bonus-shirt"><img src="' + shirtUrl + '"></div>' +
            '<div class="cc-bonus-info">' +
                '<div class="cc-bonus-name">' + item.el.web_name + '</div>' +
                '<div class="cc-bonus-team">' + item.teamObj.name + '</div>' +
            '</div>' +
            '<div class="cc-bonus-gws">' + gwBoxes + '</div>' +
            '<div class="cc-bonus-total">' +
                '<div class="cc-bonus-total-num">' + item.el.total_points + '</div>' +
                '<div class="cc-bonus-total-label">Total</div>' +
            '</div>' +
        '</div>';
    });

    var html = '<div class="cc-modal-box">' +
        '<div class="cc-modal-header"><div class="cc-modal-title">' + title + '</div>' +
        '<button class="cc-modal-close" onclick="ccRenderPitchUI(\''+teamCode+'\', null, null, true)"><span class="tg-icon tg-icon-sm tg-icon-close"></span></button></div>' +
        '<div class="cc-modal-body" style="padding:0;">' +
            '<div class="cc-bonus-container">' +
                '<div class="cc-bonus-search">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-search" style="color:#A1A1B5;"></span>' +
                    '<input type="text" id="ccBonusSearch" placeholder="Search player..." oninput="ccFilterBonusList(this.value)">' +
                '</div>' +
                '<div class="cc-bonus-list-wrapper" id="ccBonusListWrapper">' +
                    listHtml +
                '</div>' +
            '</div>' +
        '</div></div>';
        
    modal.innerHTML = html;
}

window.ccFilterBonusList = function(query) {
    var q = query.toLowerCase().trim();
    var rows = document.querySelectorAll('#ccBonusListWrapper .cc-bonus-row');
    rows.forEach(function(row) {
        var name = row.querySelector('.cc-bonus-name').innerText.toLowerCase();
        var team = row.querySelector('.cc-bonus-team').innerText.toLowerCase();
        if (name.includes(q) || team.includes(q)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
};

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
        ccUpdateMainFixtures();
    }
}

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
                if (m.entry === CC_ADMIN_ID) return; 
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

async function ccInit() {
    ccState.currentRound = (typeof currentRound !== 'undefined') ? currentRound : 1;
    
    var refreshBtn = document.getElementById('ccRefreshBtn');
    if (refreshBtn) {
        if (typeof isAdmin === 'function' && isAdmin()) refreshBtn.style.display = 'flex';
        else refreshBtn.style.display = 'none';
    }

    await ccRenderTeamsGrid();
    ccSyncMembers().then(function() { ccRenderTeamsGrid(); ccUpdateMainFixtures(); });
    
    if (ccState.syncTimer) clearInterval(ccState.syncTimer);
    ccState.syncTimer = setInterval(function() {
        ccSyncMembers().then(function() { ccRenderTeamsGrid(); ccUpdateMainFixtures(); });
    }, CC_SYNC_INTERVAL);
}

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

ccLog('v14 Loaded');
})();
