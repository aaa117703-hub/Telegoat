/* =========================================================
   champions-cup.js — v24 (Fixed Closure Bug + Live Points)
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

var CC_PINS = {
    'ARS': '1055', 'AVL': '2066', 'BOU': '3077', 'BRE': '4088', 'BHA': '5099',
    'CHE': '6011', 'COV': '7022', 'CRY': '8033', 'EVE': '9044', 'FUL': '1000',
    'HUL': '2011', 'IPS': '3022', 'LEE': '4033', 'LIV': '5044', 'MCI': '6055',
    'MUN': '7066', 'NEW': '8077', 'NOT': '9088', 'SUN': '1099', 'TOT': '2000'
};

var ccState = {
    members: {},
    currentRound: 1,
    loading: false,
    syncTimer: null,
    fplData: null,
    _currentEdit: null,
    _bonusStep: 0,
    _recentGWsPoints: {},
    _recentGWsRound: 0, 
    _cachedMembers: null,
    _currentGWPoints: 0
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
        if (res.ok) { ccState.fplData = await res.json(); return ccState.fplData; }
    } catch(e) { ccLog('Bootstrap fail', e); }
    return null;
}

/* ========== DEADLINE LOGIC ========== */
function ccIsDeadlinePassed(round) {
    if (!ccState.fplData || !ccState.fplData.events) return false;
    var event = ccState.fplData.events.find(function(e) { return e.id === round; });
    if (!event || !event.deadline_time) return false;
    var deadline = new Date(event.deadline_time);
    return new Date() > deadline;
}

function ccRenderDeadlineBar(round) {
    if (!ccState.fplData || !ccState.fplData.events) return '';
    var event = ccState.fplData.events.find(function(e) { return e.id === round; });
    if (!event || !event.deadline_time) return '';
    
    var deadline = new Date(event.deadline_time);
    var now = new Date();
    
    if (now > deadline) {
        return '<div style="background:rgba(239,68,68,0.2);color:#EF4444;text-align:center;padding:8px;border-radius:8px;margin-bottom:10px;font-weight:900;font-size:13px;border:1px solid #EF4444;">🔒 انتهى وقت التعديل لهذه الجولة</div>';
    }
    
    var diff = deadline - now;
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    var mins = Math.floor((diff / 1000 / 60) % 60);
    
    var timeStr = '';
    if (days > 0) timeStr += days + ' يوم و ';
    if (hours > 0 || days > 0) timeStr += hours + ' ساعة و ';
    timeStr += mins + ' دقيقة';
    
    var formattedDate = deadline.toLocaleString('ar-EG', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
    
    return '<div style="background:rgba(16,185,129,0.15);color:#10B981;text-align:center;padding:8px;border-radius:8px;margin-bottom:10px;font-weight:900;font-size:12px;border:1px solid #10B981;">⏳ متبقي ' + timeStr + ' (الديدلاين: ' + formattedDate + ')</div>';
}

/* ========== FETCH LAST 5 GWs (Fixed Let Bug) ========== */
async function ccFetchLast5GWs(currentGW) {
    if (ccState._recentGWsRound === currentGW && ccState._recentGWsPoints && Object.keys(ccState._recentGWsPoints).length > 0) {
        return ccState._recentGWsPoints;
    }
    
    ccState._recentGWsPoints = {}; 
    ccState._recentGWsRound = currentGW;

    var pointsMap = {}; 
    var startGW = Math.max(1, currentGW - 5); 
    var promises = [];
    
    // إصلاح الخطأ باستخدام let بدلاً من var
    for (let gw = startGW; gw < currentGW; gw++) {
        promises.push(
            ccFetch(CC_WORKER + '/?type=live&gw=' + gw)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) { return { gw: gw, data: data }; })
            .catch(function() { return { gw: gw, data: null }; })
        );
    }
    
    var results = await Promise.all(promises);
    
    results.forEach(function(res) {
        if (!res.data || !res.data.elements) return;
        res.data.elements.forEach(function(el) {
            if (!pointsMap[el.id]) pointsMap[el.id] = {};
            pointsMap[el.id][res.gw] = el.stats ? (el.stats.total_points || 0) : 0;
        });
    });
    
    ccState._recentGWsPoints = pointsMap; 
    return pointsMap;
}

/* ========== CALCULATE CURRENT TEAM POINTS ========== */
async function ccCalculateTeamCurrentPoints(teamCode, squad) {
    var round = ccState.currentRound;
    var fplData = await ccFetchFplBootstrap();
    if (!fplData) return 0;
    var liveRes = await ccFetch(CC_WORKER + '/?type=live&gw=' + round);
    var liveData = liveRes.ok ? await liveRes.json() : null;
    if (!liveData) return 0;

    var liveMap = {};
    liveData.elements.forEach(function(el) { liveMap[el.id] = el.stats.total_points || 0; });

    if (!squad || !squad.starters) return 0;

    var teamScore = 0;
    var fetchPromises = [];

    for (var i = 0; i < squad.starters.length; i++) {
        var entryId = squad.starters[i];
        if (!entryId) continue;
        fetchPromises.push(ccFetch(CC_WORKER + '/?type=picks&entry=' + entryId + '&gw=' + round).then(function(r) { return r.ok ? r.json() : null; }).then(function(data) { return { entryId: entryId, picks: data ? data.picks : null }; }));
    }

    var picksResults = await Promise.all(fetchPromises);
    var picksMap = {};
    picksResults.forEach(function(res) { if(res && res.picks) picksMap[res.entryId] = res.picks; });

    for (var i = 0; i < squad.starters.length; i++) {
        var entryId = squad.starters[i];
        if (!entryId) continue;
        var picks = picksMap[entryId];
        if (!picks) continue;
        var starters = picks.filter(function(p) { return p.position <= 11; });
        var cap = starters.find(function(p) { return p.is_captain; });
        var vc = starters.find(function(p) { return p.is_vice_captain; });
        var targetCapId = cap ? cap.element : (vc ? vc.element : null);
        if (cap && liveData.elements.find(function(e) { return e.id === cap.element; })?.stats.minutes === 0 && vc) { targetCapId = vc.element; }
        starters.forEach(function(p) {
            var pts = liveMap[p.element] || 0; teamScore += pts;
            if (p.element === targetCapId) teamScore += pts;
        });
    }

    if (squad.bonus) {
        squad.bonus.forEach(function(bonusId) { teamScore += (liveMap[bonusId] || 0); });
    }
    return teamScore;
}

/* ========== AUTO UPDATE MAIN FIXTURES ========== */
async function ccUpdateMainFixtures(isForced) {
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

    var scores = {}; var fetchPromises = [];
    squads.forEach(function(sq) {
        if (!sq.starters || sq.starters.length === 0) { scores[sq.team] = 0; return; }
        sq.starters.forEach(function(entryId) {
            if (!entryId) return; 
            fetchPromises.push(ccFetch(CC_WORKER + '/?type=picks&entry=' + entryId + '&gw=' + round).then(function(r) { return r.ok ? r.json() : null; }).then(function(data) { return { entryId: entryId, picks: data ? data.picks : null }; }));
        });
    });
    var picksResults = await Promise.all(fetchPromises);
    var picksMap = {};
    picksResults.forEach(function(res) { if(res && res.picks) picksMap[res.entryId] = res.picks; });

    squads.forEach(function(sq) {
        if (scores[sq.team] === 0) return;
        var teamScore = 0;
        sq.starters.forEach(function(entryId) {
            if (!entryId) return;
            var picks = picksMap[entryId]; if (!picks) return;
            var starters = picks.filter(function(p) { return p.position <= 11; });
            var cap = starters.find(function(p) { return p.is_captain; });
            var vc = starters.find(function(p) { return p.is_vice_captain; });
            var targetCapId = cap ? cap.element : (vc ? vc.element : null);
            if (cap && liveData.elements.find(function(e) { return e.id === cap.element; })?.stats.minutes === 0 && vc) { targetCapId = vc.element; }
            starters.forEach(function(p) {
                var pts = liveMap[p.element] || 0; teamScore += pts;
                if (p.element === targetCapId) teamScore += pts;
            });
        });
        if (sq.bonus && sq.bonus.length > 0) { sq.bonus.forEach(function(bonusId) { teamScore += (liveMap[bonusId] || 0); }); }
        scores[sq.team] = teamScore;
    });

    var matches = (typeof matchweeks !== 'undefined' && matchweeks[round]) ? matchweeks[round] : [];
    var updated = false; var rows = [];

    matches.forEach(function(m, idx) {
        var home = m[0], away = m[1];
        if (scores[home] !== undefined && scores[away] !== undefined) {
            scoresStorage['r' + round + '_m' + idx + '_home'] = scores[home];
            scoresStorage['r' + round + '_m' + idx + '_away'] = scores[away];
            updated = true;
            rows.push({ round: String(round), home_team: home, away_team: away, home_score: scores[home], away_score: scores[away], created_at: Date.now() });
        }
    });

    if (updated) {
        localStorage.setItem('fpl_scores', JSON.stringify(scoresStorage));
        if (typeof renderFixtures === 'function') renderFixtures();
        if (typeof renderStandings === 'function') renderStandings();
        if (window.sbClient) {
            try {
                await window.sbClient.from('match_results').delete().eq('round', String(round));
                if (rows.length > 0) await window.sbClient.from('match_results').insert(rows);
                if (isForced && typeof showToast === 'function') showToast('تم تحديث الجدول بنجاح!', true);
            } catch (e) { if (isForced && typeof showToast === 'function') showToast('فشل تحديث الجدول: ' + e.message, false); }
        }
    }
    return scores;
}
window.ccForceSync = function() { if (typeof showToast === 'function') showToast('جاري تحديث الجدول...', false); ccUpdateMainFixtures(true); };

/* ========== TEAM STATS CALCULATOR ========== */
function ccGetTeamStats(teamCode) {
    var stats = { pts: 0, w: 0, d: 0, l: 0, played: 0 };
    if (typeof matchweeks === 'undefined' || typeof scoresStorage === 'undefined') return stats;
    for (var r = 1; r <= ccState.currentRound; r++) {
        var matches = matchweeks[r] || [];
        for (var i = 0; i < matches.length; i++) {
            var m = matches[i];
            if (m[0] === teamCode || m[1] === teamCode) {
                var hScore = scoresStorage['r' + r + '_m' + i + '_home'];
                var aScore = scoresStorage['r' + r + '_m' + i + '_away'];
                if (hScore !== undefined && aScore !== undefined && hScore !== '' && aScore !== '') {
                    hScore = Number(hScore); aScore = Number(aScore); stats.played++;
                    if (m[0] === teamCode) {
                        if (hScore > aScore) { stats.w++; stats.pts += 3; }
                        else if (hScore < aScore) { stats.l++; }
                        else { stats.d++; stats.pts += 1; }
                    } else {
                        if (aScore > hScore) { stats.w++; stats.pts += 3; }
                        else if (aScore < hScore) { stats.l++; }
                        else { stats.d++; stats.pts += 1; }
                    }
                }
            }
        }
    }
    return stats;
}

/* ========== PIN & EDITOR LOGIC ========== */
async function ccPromptPin(teamCode) {
    if (ccIsDeadlinePassed(ccState.currentRound)) {
        if (typeof showToast === 'function') showToast('انتهى وقت التعديل لهذه الجولة!', false);
        return;
    }
    if (typeof isAdmin === 'function' && isAdmin()) {
        ccOpenSquadEditor(teamCode);
        return;
    }
    var teamName = CC_TEAM_NAMES[teamCode] || teamCode;
    var pin = prompt('أدخل رمز ' + teamName + ':');
    if (pin === null) return;

    var realPin = null;
    var sb = ccGetSb();
    if (sb) {
        try {
            var { data } = await sb.from('champions_cup_pins').select('pin').eq('team', teamCode).maybeSingle();
            if (data) realPin = data.pin;
        } catch(e) {}
    }
    if (!realPin) realPin = CC_PINS[teamCode];

    if (String(pin) !== String(realPin)) {
        if (typeof showToast === 'function') showToast('الرمز غلط', false);
        return;
    }
    ccOpenSquadEditor(teamCode);
}

/* ========== RENDER FUNCTIONS ========== */
async function ccRenderTeamsGrid() {
    var container = document.getElementById('ccTeamsGrid');
    if (!container) return;
    container.innerHTML = '<div class="cc-loading">Loading Teams...</div>';
    var sb = ccGetSb();
    var { data: members } = await sb.from('champions_cup_members').select('*');
    
    ccState._cachedMembers = members || []; 
    
    var byTeam = {};
    CC_TEAMS_LIST.forEach(function(t) { byTeam[t] = []; });
    (members || []).forEach(function(m) { (m.teams || []).forEach(function(t) { if (byTeam[t]) byTeam[t].push(m); }); });
    var html = '';
    CC_TEAMS_LIST.forEach(function(tc) {
        var name = CC_TEAM_NAMES[tc];
        var logo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[name]) ? TEAMS_LOGOS[name] : '';
        var count = byTeam[tc].length;
        html += '<div class="cc-team-card" data-team="' + tc + '"><div class="cc-team-logo">' + (logo ? '<img src="./' + logo + '">' : '') + '</div><div class="cc-team-info"><div class="cc-team-name">' + name + '</div><div class="cc-team-count">' + count + ' Managers</div></div></div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('.cc-team-card').forEach(function(c) { c.addEventListener('click', function() { ccOpenTeam(this.getAttribute('data-team')); }); });
}

async function ccOpenTeam(teamCode) {
    var modal = document.getElementById('ccModal');
    var sb = ccGetSb();
    if (!modal || !sb) return;
    modal.innerHTML = '<div class="cc-modal-box"><div class="cc-loading">Loading Squad...</div></div>';
    modal.classList.add('show');
    
    await ccFetchFplBootstrap();
    
    var { data: squad } = await sb.from('champions_cup_squads').select('*').eq('team', teamCode).eq('round', ccState.currentRound).maybeSingle();
    if (!squad) {
        var { data: prevSquads } = await sb.from('champions_cup_squads').select('*').eq('team', teamCode).lt('round', ccState.currentRound).order('round', { ascending: false }).limit(1);
        if (prevSquads && prevSquads.length > 0) squad = prevSquads[0];
    }

    var allMembers = ccState._cachedMembers || [];
    if (allMembers.length === 0) {
        var res = await sb.from('champions_cup_members').select('*');
        allMembers = res.data || [];
        ccState._cachedMembers = allMembers;
    }
    
    var gwPoints = await ccCalculateTeamCurrentPoints(teamCode, squad);
    ccState._currentGWPoints = gwPoints;
    ccRenderPitchUI(teamCode, allMembers, squad, false, gwPoints);
}

async function ccOpenSquadEditor(teamCode) {
    if (ccIsDeadlinePassed(ccState.currentRound)) {
        if (typeof showToast === 'function') showToast('انتهى وقت التعديل لهذه الجولة!', false);
        return;
    }
    var sb = ccGetSb();
    var { data: squad } = await sb.from('champions_cup_squads').select('*').eq('team', teamCode).eq('round', ccState.currentRound).maybeSingle();
    
    if (!squad) {
        var { data: prevSquads } = await sb.from('champions_cup_squads').select('*').eq('team', teamCode).lt('round', ccState.currentRound).order('round', { ascending: false }).limit(1);
        if (prevSquads && prevSquads.length > 0) squad = prevSquads[0];
    }

    var allMembers = ccState._cachedMembers || [];
    if (allMembers.length === 0) {
        var res = await sb.from('champions_cup_members').select('*');
        allMembers = res.data || [];
        ccState._cachedMembers = allMembers;
    }
    
    var starters = squad ? squad.starters.slice() : [];
    while(starters.length < 11) starters.push(null);
    if(starters.length > 11) starters = starters.slice(0, 11);

    var bench = squad ? squad.bench.slice() : [];
    while(bench.length < 2) bench.push(null);
    if(bench.length > 2) bench = bench.slice(0, 2);

    var bonus = squad ? (squad.bonus || []).slice() : [];

    ccState._currentEdit = {
        team: teamCode,
        starters: starters,
        bench: bench,
        bonus: bonus
    };
    
    var gwPoints = await ccCalculateTeamCurrentPoints(teamCode, squad);
    ccState._currentGWPoints = gwPoints;
    ccRenderPitchUI(teamCode, allMembers, null, true, gwPoints);
}

function ccRenderPitchUI(teamCode, allMembers, squad, isEdit, gwPoints) {
    var modal = document.getElementById('ccModal');
    var teamName = CC_TEAM_NAMES[teamCode];
    var teamLogo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) ? TEAMS_LOGOS[teamName] : '';
    
    var deadlinePassed = ccIsDeadlinePassed(ccState.currentRound);
    if (gwPoints === undefined) gwPoints = 0;
    
    var starters, bench, bonus;
    
    if (isEdit) {
        starters = ccState._currentEdit.starters;
        bench = ccState._currentEdit.bench;
        bonus = ccState._currentEdit.bonus;
        while(starters.length < 11) starters.push(null);
        while(bench.length < 2) bench.push(null);
    } else if (squad) {
        starters = squad.starters.slice();
        bench = squad.bench.slice();
        bonus = squad.bonus || [];
        while(starters.length < 11) starters.push(null);
        while(bench.length < 2) bench.push(null);
    } else {
        starters = new Array(11).fill(null);
        bench = new Array(2).fill(null);
        bonus = [];
    }

    var teamMembers = (allMembers || []).filter(function(m) { return m.teams.includes(teamCode); });
    var membersMap = {};
    teamMembers.forEach(function(m) { membersMap[m.entry_id] = m; });

    function getShirt(teamFullName) {
        if (typeof TEAMS_SHIRTS !== 'undefined' && TEAMS_SHIRTS[teamFullName]) { return './' + TEAMS_SHIRTS[teamFullName].file; }
        return ''; 
    }

    function createCard(id, isBonus, isGK) {
        var shirtUrl = isGK ? './gk-shirt.png' : getShirt(teamName);
        
        if (!id) {
            var onClickAction = (isEdit && !deadlinePassed) ? 'onclick="ccOpenSelectionList(\'' + teamCode + '\')"' : '';
            var pointerStyle = (isEdit && !deadlinePassed) ? 'cursor:pointer;' : 'cursor:default; opacity:0.6;';
            var emptyShirtHtml = shirtUrl ? '<img src="' + shirtUrl + '" style="opacity:0.3;" onerror="this.style.display=\'none\'">' : '<div class="cc-plus-icon">' + ((isEdit && !deadlinePassed) ? '+' : '-') + '</div>';
            
            return '<div class="cc-card cc-card-empty" style="' + pointerStyle + '" ' + onClickAction + '>' +
                '<div class="cc-card-shirt">' + emptyShirtHtml + '</div>' +
                '<div class="cc-card-name">' + ((isEdit && !deadlinePassed) ? 'Select' : 'Empty') + '</div>' +
                '<div class="cc-card-points">-</div>' +
            '</div>';
        }
        
        var m = membersMap[id];
        if (!m) return '';
        var pts = m.total || 0;
        var shirtHtml = shirtUrl ? '<img src="' + shirtUrl + '" onerror="this.style.display=\'none\'">' : '';
        
        return '<div class="cc-card"><div class="cc-card-shirt">' + shirtHtml + '</div><div class="cc-card-name">' + ccEscapeHTML(m.entry_name || m.player_name).substring(0,10) + '</div><div class="cc-card-points">' + pts + '</div></div>';
    }

    var html = '<div class="cc-modal-box"><div class="cc-modal-header"><div class="cc-modal-title">' + teamName + (isEdit ? ' — Edit' : '') + '</div><button class="cc-modal-close" onclick="document.getElementById(\'ccModal\').classList.remove(\'show\')"><span class="tg-icon tg-icon-sm tg-icon-close"></span></button></div><div class="cc-modal-body">';

    html += ccRenderDeadlineBar(ccState.currentRound);

    var stats = ccGetTeamStats(teamCode);
    html += '<div class="cc-team-stats-bar">' +
        '<div class="cc-stat-item gw-pts">نقاط الجولة <span>' + gwPoints + '</span></div>' +
        '<div class="cc-stat-item pts">نقاط الدوري <span>' + stats.pts + '</span></div>' +
        '<div class="cc-stat-item w">فاز <span>' + stats.w + '</span></div>' +
        '<div class="cc-stat-item d">تعادل <span>' + stats.d + '</span></div>' +
        '<div class="cc-stat-item l">خسر <span>' + stats.l + '</span></div>' +
        '</div>';

    if (starters.length === 0 && !isEdit) {
        html += '<div class="cc-empty">No squad selected for this round.</div>';
        if (typeof isAdmin === 'function' && isAdmin() && !deadlinePassed) { html += '<button class="cc-action-btn" onclick="ccOpenSquadEditor(\'' + teamCode + '\')">Edit Squad</button>'; }
    } else {
        html += '<div class="cc-pitch-wrapper"><div class="cc-pitch"><div class="cc-pitch-top-white"></div>';
        if (teamLogo) { html += '<div class="cc-team-logo-top"><img src="./' + teamLogo + '"></div>'; }
        html += '<div class="cc-players-container">';
        
        html += '<div class="cc-row cc-row-fwd">' + starters.slice(8, 11).map(function(id) { return createCard(id, bonus.includes(id), false); }).join('') + '</div>';
        html += '<div class="cc-row cc-row-mid">' + starters.slice(5, 8).map(function(id) { return createCard(id, bonus.includes(id), false); }).join('') + '</div>';
        html += '<div class="cc-row cc-row-def">' + starters.slice(1, 5).map(function(id) { return createCard(id, bonus.includes(id), false); }).join('') + '</div>';
        html += '<div class="cc-row cc-row-gk">' + starters.slice(0, 1).map(function(id) { return createCard(id, bonus.includes(id), true); }).join('') + '</div>';
        html += '</div></div></div>';

        if (bench.length > 0) {
            html += '<div class="cc-bench-wrapper"><div class="cc-bench-title">BENCH</div><div class="cc-bench-row">' + bench.map(function(id) { return createCard(id, false, false); }).join('') + '</div></div>';
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
                    html += '<div class="cc-card" style="border:1px solid #7C3AED;"><div class="cc-card-shirt">' + shirtHtml + '</div><div class="cc-card-name">' + el.web_name + '</div><div class="cc-card-points">' + (el.total_points || 0) + '</div></div>';
                }
            });
            html += '</div>';
        }
        
        if (isEdit) {
            if (deadlinePassed) {
                html += '<div style="text-align:center; color:#EF4444; font-weight:900; margin-top:20px; font-size:14px;">🔒 لا يمكنك الحفظ، انتهى وقت التعديل.</div>';
            } else {
                html += '<div class="cc-actions-area">';
                html += '<button class="cc-action-btn" onclick="ccOpenSelectionList(\''+teamCode+'\')"><span class="tg-icon tg-icon-sm tg-icon-users"></span> Open Player List</button>';
                html += '<button class="cc-action-btn bonus" onclick="ccOpenBonusModal(\''+teamCode+'\')"><span class="tg-icon tg-icon-sm tg-icon-star"></span> Select Bonus Players</button>';
                html += '<button class="cc-action-btn save" onclick="ccSaveSquad(\'' + teamCode + '\')"><span class="tg-icon tg-icon-sm tg-icon-check"></span> Save Squad</button></div>';
            }
        } else {
            if (typeof isAdmin === 'function' && isAdmin()) { 
                if(!deadlinePassed) html += '<button class="cc-action-btn" style="margin-top:15px;" onclick="ccOpenSquadEditor(\'' + teamCode + '\')">Edit Squad</button>'; 
            } else {
                if(!deadlinePassed) html += '<button class="cc-action-btn" style="margin-top:15px;" onclick="ccPromptPin(\'' + teamCode + '\')">Edit Squad</button>'; 
            }
        }
    }
    html += '</div></div>';
    modal.innerHTML = html;
}

async function ccOpenSelectionList(teamCode) {
    if (ccIsDeadlinePassed(ccState.currentRound)) return;
    
    var allMembers = ccState._cachedMembers || [];
    if (allMembers.length === 0) {
        var sb = ccGetSb();
        var { data } = await sb.from('champions_cup_members').select('*');
        allMembers = data || [];
        ccState._cachedMembers = allMembers;
    }
    
    var teamMembers = allMembers.filter(function(m) { return m.teams.includes(teamCode); });
    var state = ccState._currentEdit;
    
    var html = '<div class="cc-modal-box"><div class="cc-modal-header"><div class="cc-modal-title">' + CC_TEAM_NAMES[teamCode] + ' — Select Squad</div><button class="cc-modal-close" onclick="ccRenderPitchUI(\''+teamCode+'\', null, null, true, ccState._currentGWPoints)"><span class="tg-icon tg-icon-sm tg-icon-close"></span></button></div><div class="cc-modal-body"><div class="cc-list-container">';
    
    teamMembers.forEach(function(m) {
        var isStarter = state.starters.includes(m.entry_id);
        var isBench = state.bench.includes(m.entry_id);
        var cls = isStarter ? 'is-starter' : (isBench ? 'is-bench' : '');
        html += '<div class="cc-list-item ' + cls + '" onclick="ccToggleMember('+m.entry_id+', \''+teamCode+'\')"><div class="cc-list-name">' + ccEscapeHTML(m.entry_name || m.player_name) + '</div><div class="cc-list-pts">' + (m.total||0) + ' pts</div></div>';
    });
    
    html += '</div><button class="cc-action-btn" style="margin-top:15px;" onclick="ccRenderPitchUI(\''+teamCode+'\', null, null, true, ccState._currentGWPoints)">Done</button></div></div>';
    document.getElementById('ccModal').innerHTML = html;
}

function ccToggleMember(entryId, teamCode) {
    var state = ccState._currentEdit;
    var sIdx = state.starters.indexOf(entryId);
    var bIdx = state.bench.indexOf(entryId);

    if (sIdx !== -1) {
        state.starters[sIdx] = null; 
    } else if (bIdx !== -1) {
        state.bench[bIdx] = null; 
    } else {
        var emptySIdx = state.starters.indexOf(null);
        var emptyBIdx = state.bench.indexOf(null);

        if (emptySIdx !== -1) {
            state.starters[emptySIdx] = entryId;
        } else if (emptyBIdx !== -1) {
            state.bench[emptyBIdx] = entryId;
        } else {
            if (typeof showToast === 'function') showToast('Squad full! (11 Starters, 2 Bench)', false);
        }
    }
    ccOpenSelectionList(teamCode);
}

async function ccOpenBonusModal(teamCode) {
    if (ccIsDeadlinePassed(ccState.currentRound)) return;
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
        if (step === 0) { if (!CC_TOP_6.includes(tShort) && !CC_PROMOTED.includes(tShort)) { validElements.push({ el: el, teamObj: teamObj }); } }
        else { if (CC_PROMOTED.includes(tShort)) { validElements.push({ el: el, teamObj: teamObj }); } }
    });

    validElements.sort(function(a, b) { return b.el.total_points - a.el.total_points; });
    var listHtml = '';
    validElements.forEach(function(item) {
        var mappedName = FPL_TO_LOCAL_TEAM[item.teamObj.name] || item.teamObj.name;
        var shirtUrl = (typeof TEAMS_SHIRTS !== 'undefined' && TEAMS_SHIRTS[mappedName]) ? './' + TEAMS_SHIRTS[mappedName].file : 'https://resources.premierleague.com/premierleague/badges/70/t' + item.teamObj.code + '.png';
        var gwBoxes = '';
        
        for (let gw = Math.max(1, ccState.currentRound - 5); gw < ccState.currentRound; gw++) {
            var pts = 0;
            if (recentGWs && recentGWs[item.el.id] && recentGWs[item.el.id][gw] !== undefined) {
                pts = recentGWs[item.el.id][gw];
            }
            var cls = pts >= 6 ? 'high' : (pts >= 3 ? 'med' : (pts === 0 ? 'low' : ''));
            gwBoxes += '<div class="cc-gw-box ' + cls + '">' + pts + '</div>';
        }
        
        listHtml += '<div class="cc-bonus-row" onclick="ccSelectBonusPlayer(' + item.el.id + ', \'' + teamCode + '\')"><div class="cc-bonus-shirt"><img src="' + shirtUrl + '"></div><div class="cc-bonus-info"><div class="cc-bonus-name">' + item.el.web_name + '</div><div class="cc-bonus-team">' + item.teamObj.name + '</div></div><div class="cc-bonus-gws">' + gwBoxes + '</div><div class="cc-bonus-total"><div class="cc-bonus-total-num">' + item.el.total_points + '</div><div class="cc-bonus-total-label">Total</div></div></div>';
    });

    var html = '<div class="cc-modal-box"><div class="cc-modal-header"><div class="cc-modal-title">' + title + '</div><button class="cc-modal-close" onclick="ccRenderPitchUI(\''+teamCode+'\', null, null, true, ccState._currentGWPoints)"><span class="tg-icon tg-icon-sm tg-icon-close"></span></button></div><div class="cc-modal-body" style="padding:0;"><div class="cc-bonus-container"><div class="cc-bonus-search"><span class="tg-icon tg-icon-sm tg-icon-search" style="color:#A1A1B5;"></span><input type="text" id="ccBonusSearch" placeholder="Search player..." oninput="ccFilterBonusList(this.value)"></div><div class="cc-bonus-list-wrapper" id="ccBonusListWrapper">' + listHtml + '</div></div></div></div>';
    modal.innerHTML = html;
}

window.ccFilterBonusList = function(query) {
    var q = query.toLowerCase().trim();
    var rows = document.querySelectorAll('#ccBonusListWrapper .cc-bonus-row');
    rows.forEach(function(row) {
        var name = row.querySelector('.cc-bonus-name').innerText.toLowerCase();
        var team = row.querySelector('.cc-bonus-team').innerText.toLowerCase();
        row.style.display = (name.includes(q) || team.includes(q)) ? 'flex' : 'none';
    });
};

function ccSelectBonusPlayer(playerId, teamCode) {
    if (ccIsDeadlinePassed(ccState.currentRound)) return;
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
        ccRenderPitchUI(teamCode, null, null, true, ccState._currentGWPoints);
    }
}

async function ccSaveSquad(teamCode) {
    if (ccIsDeadlinePassed(ccState.currentRound)) {
        return showToast('لا يمكنك الحفظ، انتهى وقت التعديل!', false);
    }
    var state = ccState._currentEdit;
    var validStarters = state.starters.filter(function(id) { return id !== null; });
    if (validStarters.length !== 11) { return showToast('Must select exactly 11 starters', false); }
    if (state.bonus.length !== 2) { return showToast('Must select 2 bonus players', false); }
    
    var sb = ccGetSb();
    var res = await sb.from('champions_cup_squads').upsert({
        team: teamCode, round: ccState.currentRound,
        starters: validStarters, bench: state.bench.filter(function(id) { return id !== null; }), bonus: state.bonus,
        updated_at: new Date().toISOString()
    }, { onConflict: 'team,round' });

    if (res.error) { showToast('Save failed: ' + res.error.message, false); }
    else {
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
                if (!allMembers[m.entry]) { allMembers[m.entry] = { entry_id: m.entry, player_name: m.player_name, entry_name: m.entry_name, total: m.total, event_total: m.event_total, teams: [] }; }
                if (allMembers[m.entry].teams.indexOf(teamCode) === -1) { allMembers[m.entry].teams.push(teamCode); }
            });
        } catch(e) { ccLog('Sync fail ' + teamCode, e); }
    }
    var membersArr = Object.values(allMembers);
    var sb = ccGetSb();
    if (sb && membersArr.length > 0) {
        try {
            var rows = membersArr.map(function(m) { return { ...m, updated_at: new Date().toISOString() }; });
            for (var k = 0; k < rows.length; k += 50) { await sb.from('champions_cup_members').upsert(rows.slice(k, k+50), { onConflict: 'entry_id' }); }
        } catch(e) { ccLog('Supabase sync error', e); }
    }
    ccState.members = allMembers;
    ccState._cachedMembers = membersArr; 
    ccState.loading = false;
    return { ok: true, count: membersArr.length };
}

async function ccInit() {
    ccState.currentRound = (typeof currentRound !== 'undefined') ? currentRound : 1;
    await ccFetchFplBootstrap(); 
    
    var refreshBtn = document.getElementById('ccRefreshBtn');
    if (refreshBtn) { if (typeof isAdmin === 'function' && isAdmin()) refreshBtn.style.display = 'flex'; else refreshBtn.style.display = 'none'; }
    await ccRenderTeamsGrid();
    ccSyncMembers().then(function() { ccRenderTeamsGrid(); ccUpdateMainFixtures(); });
    if (ccState.syncTimer) clearInterval(ccState.syncTimer);
    ccState.syncTimer = setInterval(function() { ccSyncMembers().then(function() { ccRenderTeamsGrid(); ccUpdateMainFixtures(); }); }, CC_SYNC_INTERVAL);
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
window.ccPromptPin = ccPromptPin;

// ⚡ FIX: إضافة اسم الدالة القديم عشان ما يطلع خطأ (ReferenceError)
window.ccRenderTeams = ccRenderTeamsGrid; 

ccLog('v24 Loaded');
})();
