/* =========================================================
   champions-captains.js — FINALISSIMA LEAGUE (v=34)
   ⭐ v34: لوحة إدارة فرق EPL (تحديد الحارس والمدافعين)
========================================================= */

const CC_REFRESH_INTERVAL = 5 * 60 * 1000;

const CHAMP_CAPTAIN_PINS = {
    'ARS': '1055', 'AVL': '2066', 'BOU': '3077', 'BRE': '4088', 'BHA': '5099',
    'CHE': '6011', 'COV': '7022', 'CRY': '8033', 'EVE': '9044', 'FUL': '1000',
    'HUL': '2011', 'IPS': '3022', 'LEE': '4033', 'LIV': '5044', 'MCI': '6055',
    'MUN': '7066', 'NEW': '8077', 'NOT': '9088', 'SUN': '1099', 'TOT': '2000'
};

const CC_TOTAL_SLOTS = 7;
const CC_BENCH_SLOTS = 2;

const CC_SLOT_TYPES  = ['gk', 'def', 'def', 'def', 'mid', 'mid', 'fwd'];
const CC_SLOT_LABELS = ['GKP', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'FWD'];

const CC_PITCH_ROWS = [
    { type: 'gk',  slots: [0] },
    { type: 'def', slots: [1, 2, 3] },
    { type: 'mid', slots: [4, 5] },
    { type: 'fwd', slots: [6] }
];

const CC_EPL_TEAMS_LIST = [
    { id: 1, name: 'Arsenal', code: 'ARS' },
    { id: 2, name: 'Aston Villa', code: 'AVL' },
    { id: 3, name: 'Bournemouth', code: 'BOU' },
    { id: 4, name: 'Brentford', code: 'BRE' },
    { id: 5, name: 'Brighton', code: 'BHA' },
    { id: 6, name: 'Chelsea', code: 'CHE' },
    { id: 7, name: 'Coventry', code: 'COV' },
    { id: 8, name: 'Crystal Palace', code: 'CRY' },
    { id: 9, name: 'Everton', code: 'EVE' },
    { id: 10, name: 'Fulham', code: 'FUL' },
    { id: 11, name: 'Hull', code: 'HUL' },
    { id: 12, name: 'Ipswich', code: 'IPS' },
    { id: 13, name: 'Leeds', code: 'LEE' },
    { id: 14, name: 'Liverpool', code: 'LIV' },
    { id: 15, name: 'Man City', code: 'MCI' },
    { id: 16, name: 'Man United', code: 'MUN' },
    { id: 17, name: 'Newcastle', code: 'NEW' },
    { id: 18, name: 'Nott\'m Forest', code: 'NFO' },
    { id: 19, name: 'Sunderland', code: 'SUN' },
    { id: 20, name: 'Spurs', code: 'TOT' }
];

let champCaptains = {
    loaded: false,
    allCaptains: {},
    currentTeam: null,
    currentCaptainEntry: null,
    currentCaptainName: null,
    refreshTimer: null,
    lastRefreshAt: 0,
    autoRefreshActive: false,
    pendingTeamCode: null
};

let ccLineupState = {
    round: 1,
    deadlineInfo: null,
    isDeadlinePassed: false,
    selection: null,
    slots: [null, null, null, null, null, null, null],
    benchSlots: [null, null],
    effectiveSlots: [null, null, null, null, null, null, null],
    effectiveBench: [null, null],
    activeSlot: null,
    activeBenchSlot: null,
    allManagers: [],
    opponentTeam: null,
    opponentSelection: null,
    opponentManagers: [],
    assassinatedEntries: [],
    assassinatedByNames: {},
    specialResults: { myMoves: {}, oppMoves: {} },
    isSaving: false,
    isRendering: false,
    isEditing: false,
    teamsSelections: {},
    scoresVisible: false
};

/* =========================================================
   EPL ROSTER STATE
========================================================= */
let ccEplState = {
    currentTeam: null,
    currentGoalkeeper: null,
    currentDefenders: [],
    currentGkGwPts: 0,
    players: [],
    isSaving: false
};

function ccIcon(name, variant) {
    variant = variant || 'regular';
    const vc = variant === 'fill' ? 'ph-fill' :
               variant === 'bold' ? 'ph-bold' :
               variant === 'duotone' ? 'ph-duotone' : 'ph';
    return '<i class="' + vc + ' ph-' + name + '"></i>';
}

function ccGetTeamLogo(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].logo || '';
    }
    return '';
}

function ccGetTeamName(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].name || code;
    }
    return code || 'Unknown';
}

function ccGetTeamShirt(code) {
    const teamName = ccGetTeamName(code);
    if (!teamName) return '';
    if (typeof window.TG_SHIRTS !== 'undefined' && window.TG_SHIRTS) {
        if (window.TG_SHIRTS[teamName]) return window.TG_SHIRTS[teamName];
        if (window.TG_SHIRTS[code]) return window.TG_SHIRTS[code];
    }
    return teamName.toLowerCase().replace(/\s+/g, '-') + '-shirt.png';
}

function ccIsAdmin() {
    try {
        return typeof isChampAdmin === 'function' ? isChampAdmin() : false;
    } catch (e) {
        return false;
    }
}

function ccGetRound() {
    const meta = (window.champData && window.champData.meta) || {};
    const startGw = meta.start_gw || 8;
    const cr = (typeof currentRound !== 'undefined') ? currentRound : 1;
    if (!meta.started || cr < startGw) return startGw;
    return cr;
}

function ccEscapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ccPad(n) {
    return (n < 10 ? '0' : '') + n;
}

function ccFormatTimeAgo(timestamp) {
    if (!timestamp) return 'غير محدّث';
    const diff = Date.now() - timestamp;
    const sec = Math.floor(diff / 1000);
    if (sec < 30) return 'الآن';
    if (sec < 60) return sec + ' ثانية';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + ' دقيقة';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' ساعة';
    return 'قبل ' + Math.floor(hr / 24) + ' يوم';
}

async function ccCheckScoresVisible() {
    try {
        const url = 'https://fpl-api.aaa117703.workers.dev' + '/?type=bootstrap';
        const res = await fetch(url);
        if (!res.ok) return false;
        const json = await res.json();
        const bsd = (json && json.data && !Array.isArray(json.data)) ? json.data : json;
        if (!bsd || !bsd.events) return false;
        const round = ccGetRound();
        const event = bsd.events.find(function(e) { return e.id === round; });
        if (!event) return false;
        return event.is_current === true ||
               event.finished === true ||
               event.is_previous === true;
    } catch (e) {
        return false;
    }
}

function ccStartAutoRefresh(callback) {
    if (champCaptains.autoRefreshActive && champCaptains.refreshTimer) {
        return;
    }
    ccStopAutoRefresh();
    champCaptains.autoRefreshActive = true;
    document.addEventListener('visibilitychange', ccHandleVisibilityChange);
    champCaptains.refreshTimer = setInterval(async function() {
        if (document.hidden) return;
        if (typeof callback === 'function') {
            try {
                await callback();
                champCaptains.lastRefreshAt = Date.now();
                ccUpdateRefreshIndicator();
            } catch (e) {
                console.warn('[Captains] refresh error:', e);
            }
        }
    }, CC_REFRESH_INTERVAL);
}

function ccStopAutoRefresh() {
    if (champCaptains.refreshTimer) {
        clearInterval(champCaptains.refreshTimer);
        champCaptains.refreshTimer = null;
    }
    champCaptains.autoRefreshActive = false;
    document.removeEventListener('visibilitychange', ccHandleVisibilityChange);
}

function ccHandleVisibilityChange() {
    if (!document.hidden && champCaptains.autoRefreshActive) {
        const elapsed = Date.now() - champCaptains.lastRefreshAt;
        if (elapsed >= CC_REFRESH_INTERVAL) {
            const lineupEl = document.getElementById('champCaptainsLineupContent');
            if (lineupEl) champCaptainsRenderLineup();
        }
    }
}

function ccUpdateRefreshIndicator() {
    const el = document.getElementById('ccRefreshIndicator');
    if (!el) return;
    el.innerHTML = ccIcon('arrow-clockwise', 'bold') + ' ' + ccFormatTimeAgo(champCaptains.lastRefreshAt);
}

async function ccLoadAllCaptains() {
    if (!window.sbResults) return {};
    try {
        const { data, error } = await window.sbResults
            .from('tgc_captains').select('*');
        if (error) throw error;
        const map = {};
        (data || []).forEach(function(row) {
            map[row.team] = {
                captain_entry: row.captain_entry,
                captain_name: row.captain_name,
                pin: row.pin,
                updated_at: row.updated_at
            };
        });
        champCaptains.allCaptains = map;
        return map;
    } catch (e) {
        console.warn('[Captains] load error:', e);
        return {};
    }
}

async function ccLoadAllSelections(round) {
    if (!window.sbResults) return {};
    try {
        const { data, error } = await window.sbResults
            .from('tgc_selections')
            .select('team, locked, starters, updated_at')
            .eq('round', round);
        if (error) throw error;
        const map = {};
        (data || []).forEach(function(row) {
            map[row.team] = {
                locked: row.locked,
                starters: row.starters || [],
                updated_at: row.updated_at
            };
        });
        return map;
    } catch (e) {
        console.warn('[Captains] selections load error:', e);
        return {};
    }
}

async function ccLoadSelection(round, team) {
    if (!window.sbResults) return null;
    try {
        const { data, error } = await window.sbResults
            .from('tgc_selections').select('*')
            .eq('round', round).eq('team', team).maybeSingle();
        if (error) throw error;
        return data;
    } catch (e) {
        console.warn('[Captains] selection load error:', e);
        return null;
    }
}

async function ccSaveSelection(round, team, starters, bench) {
    if (!window.sbResults) return { ok: false, error: 'sbResults not initialized' };
    try {
        const { error } = await window.sbResults
            .from('tgc_selections')
            .upsert({
                round: round,
                team: team,
                starters: starters,
                bench: bench,
                locked: true,
                is_auto_selected: false,
                updated_at: new Date().toISOString()
            }, { onConflict: 'round,team' });
        if (error) throw error;
        return { ok: true };
    } catch (e) {
        console.warn('[Captains] save error:', e);
        return { ok: false, error: e.message || String(e) };
    }
}

async function ccLoadOpponentForRound(team, round) {
    if (!window.sbResults) return null;
    try {
        const { data, error } = await window.sbResults
            .from('tgc_matches')
            .select('home_team, away_team, stage, group_name, round_num, gw, is_played')
            .or('home_team.eq.' + team + ',away_team.eq.' + team);
        if (error) throw error;
        if (!data || data.length === 0) return null;

        const meta = (window.champData && window.champData.meta) || {};
        const startGw = meta.start_gw || 8;
        const stage = meta.current_stage || 'groups';

        let target = null;
        if (stage === 'groups') {
            const roundNum = round - startGw + 1;
            target = data.find(function(m) {
                return m.stage === 'groups' && m.round_num === roundNum &&
                    (m.home_team === team || m.away_team === team);
            });
        } else {
            target = data.find(function(m) {
                return m.stage === stage && m.gw === round &&
                    (m.home_team === team || m.away_team === team);
            });
        }

        if (!target) return null;

        const opponent = (target.home_team === team)
            ? target.away_team : target.home_team;

        return {
            opponent: opponent,
            home_team: target.home_team,
            away_team: target.away_team,
            stage: target.stage,
            group_name: target.group_name,
            is_played: target.is_played
        };
    } catch (e) {
        console.warn('[Captains] opponent load error:', e);
        return null;
    }
}

async function ccLoadAssassinations(round, team) {
    if (!window.sbResults) return { entries: [], byNames: {} };
    var targets = [];
    var byNames = {};
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_moves')
            .select('*')
            .eq('round', round)
            .eq('move_type', 'assassination')
            .eq('target_team', team);
            
        if (!error && data && data.length > 0) {
            data.forEach(function(mv) {
                if (mv.move_data) {
                    var t = mv.move_data.blocked_entries || mv.move_data.targets || mv.move_data.entries || mv.move_data;
                    if (Array.isArray(t)) {
                        t.forEach(function(id) {
                            var parsed = typeof id === 'object' ? (id.entry || id.id) : id;
                            if (parsed && targets.indexOf(Number(parsed)) === -1) {
                                targets.push(Number(parsed));
                                byNames[Number(parsed)] = mv.team || '?';
                            }
                        });
                    }
                }
            });
        }
    } catch (e) {
        console.warn('[Captains] assassination load error:', e);
    }
    return { entries: targets, byNames: byNames };
}

async function ccLoadSpecialResults(round, myTeam, oppTeam) {
    const result = { myMoves: {}, oppMoves: {} };
    if (!window.sbResults || !myTeam) return result;

    try {
        const teams = [myTeam];
        if (oppTeam) teams.push(oppTeam);

        const { data, error } = await window.sbResults
            .from('tgc_special_moves')
            .select('*')
            .eq('round', round)
            .in('team', teams);

        if (error) throw error;

        (data || []).forEach(function(row) {
            if (row.team === myTeam) result.myMoves[row.move_type] = row;
            else if (row.team === oppTeam) result.oppMoves[row.move_type] = row;
        });
    } catch (e) {
        console.warn('[Captains] special results load error:', e);
    }
    return result;
}

async function ccLoadTeamManagers(teamCode, forceRefresh) {
    let teamName = teamCode;
    if (typeof teamsMap !== 'undefined' && teamsMap[teamCode]) {
        teamName = teamsMap[teamCode].name || teamCode;
    }

    let names = [];
    try {
        if (window.sbResults) {
            const { data: teamRow } = await window.sbResults
                .from('managers_by_team')
                .select('managers')
                .eq('team', teamName)
                .maybeSingle();
            if (teamRow && Array.isArray(teamRow.managers) && teamRow.managers.length > 0) {
                names = teamRow.managers.slice();
            }
        }
    } catch (e) {
        console.warn('[Captains] managers_by_team load failed:', e);
    }

    if (names.length === 0 && typeof PLAYERS_TEAMS !== 'undefined' && PLAYERS_TEAMS[teamName]) {
        names = PLAYERS_TEAMS[teamName].slice();
    }

    let managersData = [];
    let allManagers = null;

    try {
        if (typeof tgcGetAllManagers === 'function') {
            try {
                if (forceRefresh === true && typeof window.tgcClearManagers === 'function') {
                    window.tgcClearManagers();
                }
                allManagers = await tgcGetAllManagers(forceRefresh === true);
            } catch (e) {
                console.warn('[Captains] tgcGetAllManagers failed:', e.message);
            }
        }

        if (!allManagers || allManagers.length === 0) {
            if (typeof tgcGetManagersForRound === 'function') {
                const startRound = ccGetRound();
                for (let r = startRound; r >= Math.max(1, startRound - 5); r--) {
                    try {
                        const mgrs = await tgcGetManagersForRound(r);
                        if (mgrs && mgrs.length > 0) { allManagers = mgrs; break; }
                    } catch (e) {
                        console.warn('[Captains] fallback round failed:', e);
                    }
                }
            }
        }

        if (allManagers && allManagers.length > 0) {
            var nationManagers = allManagers.filter(function(m) {
                if (!m) return false;
                var tc = String(teamCode).toUpperCase();
                if (m.nation && String(m.nation).toUpperCase() === tc) return true;
                return (m.leagues || []).some(function(x) { return String(x).toUpperCase() === tc; });
            });

            if (nationManagers.length > 0) {
                managersData = nationManagers.map(function(m) {
                    var nm = m.player_name || m.entry_name || ('#' + m.entry);
                    return {
                        name: nm,
                        entry: Number(m.entry),
                        displayName: nm,
                        teamName: m.entry_name || '', mgrName: m.player_name || '',
                        liveTotal: m.total || m.total_points || 0,
                        liveEvent: m.event_total || 0
                    };
                });
            } else {
                var byName = {};
                allManagers.forEach(function(m) {
                    var n2 = m.player_name || m.entry_name;
                    if (n2) {
                        var k2 = (typeof normalizePlayerName === 'function')
                            ? normalizePlayerName(n2) : n2.toLowerCase().replace(/[^a-z0-9]/g, '');
                        byName[k2] = m;
                    }
                });

                managersData = [];
                names.forEach(function(nm) {
                    var k3 = (typeof normalizePlayerName === 'function')
                        ? normalizePlayerName(nm) : nm.toLowerCase().replace(/[^a-z0-9]/g, '');
                    var mm = byName[k3];
                    if (mm && mm.entry) {
                        managersData.push({
                            name: nm,
                            entry: Number(mm.entry),
                            displayName: nm,
                            teamName: mm.entry_name || '', mgrName: mm.player_name || '',
                            liveTotal: mm.total || mm.total_points || 0,
                            liveEvent: mm.event_total || 0
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.warn('[Captains] managers fetch error:', e);
    }

    try {
        if (ccLineupState.selection && Array.isArray(ccLineupState.selection.starters)) {
            const existing = new Set(managersData.map(function(m) { return m.entry; }));
            const missing = [];
            ccLineupState.selection.starters.forEach(function(entry) {
                if (entry && !existing.has(entry)) missing.push(entry);
            });
            if (Array.isArray(ccLineupState.selection.bench)) {
                ccLineupState.selection.bench.forEach(function(entry) {
                    if (entry && !existing.has(entry)) missing.push(entry);
                });
            }

            if (missing.length > 0) {
                missing.forEach(function(entry) {
                    var found = (allManagers || []).find(function(m) { return Number(m.entry) === Number(entry); });
                    if (found) {
                        managersData.push({
                            name: found.player_name || ('Player #' + entry),
                            entry: Number(entry),
                            displayName: found.player_name || ('Player #' + entry),
                            teamName: found.entry_name || '', mgrName: found.player_name || '',
                            liveTotal: found.total || 0,
                            liveEvent: found.event_total || 0
                        });
                    } else {
                        managersData.push({
                            name: 'Player #' + entry,
                            entry: Number(entry),
                            displayName: 'Player #' + entry,
                            liveTotal: 0,
                            liveEvent: 0
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.warn('[Captains] missing entries merge failed:', e);
    }

    const round = ccGetRound();
    const last5Rounds = [];
    for (let i = 0; i < 5; i++) {
        const r = round - i;
        if (r >= 1) last5Rounds.push(r);
    }

    const entries = managersData
        .filter(function(m) { return m.entry; })
        .map(function(m) { return m.entry; });
    const pointsMap = {};

    if (entries.length > 0 && window.sbResults) {
        try {
            const { data, error } = await window.sbResults
                .from('manager_history')
                .select('entry, event, points')
                .in('entry', entries).in('event', last5Rounds);
            if (!error && data) {
                data.forEach(function(row) {
                    if (!pointsMap[row.entry]) pointsMap[row.entry] = {};
                    pointsMap[row.entry][row.event] = row.points || 0;
                });
            }
        } catch (e) {
            console.warn('[Captains] points load failed:', e);
        }
    }

    managersData.forEach(function(m) {
        m.pointsByEvent = pointsMap[m.entry] || {};
        m.lastGwPoints = [];
        last5Rounds.forEach(function(r) {
            let val = 0;
            if (r === round && m.liveEvent > 0) val = m.liveEvent;
            else if (m.pointsByEvent[r] !== undefined) val = m.pointsByEvent[r];
            else if (r === round) val = m.liveEvent;
            m.lastGwPoints.push(val);
        });

        const sum = m.lastGwPoints.reduce(function(a, b) { return a + b; }, 0);
        m.avgPoints = m.lastGwPoints.length > 0
            ? Math.round(sum / m.lastGwPoints.length) : 0;
        m.lastPoints = m.lastGwPoints[0] || 0;
        m.total5 = sum;
    });

    managersData.sort(function(a, b) {
        if (a.entry && !b.entry) return -1;
        if (!a.entry && b.entry) return 1;
        return (b.total5 || 0) - (a.total5 || 0);
    });

    return managersData;
}

/* اسم الفريق (entry_name) + اسم المدير (player_name) مثل الفانتازي */
function ccTwoNames(m) {
    if (m && m.teamName && m.mgrName && m.teamName !== m.mgrName) {
        return '<div class="cc-slot-name cc-slot-name-two"><b>' + ccEscapeAttr(m.teamName) + '</b><i>' + ccEscapeAttr(m.mgrName) + '</i></div>';
    }
    return '<div class="cc-slot-name">' + ccEscapeAttr((m && m.displayName) || '') + '</div>';
}

function ccFindManagerByEntry(entry) {
    if (!entry) return null;
    const found = ccLineupState.allManagers.find(function(m) {
        return Number(m.entry) === Number(entry);
    });
    if (found) return found;
    return {
        entry: Number(entry),
        displayName: 'Player #' + entry,
        name: 'Player #' + entry,
        avgPoints: 0,
        lastPoints: 0,
        isFallback: true
    };
}

function ccApplyAssassination() {
    if (!ccLineupState.isDeadlinePassed) {
        ccLineupState.effectiveSlots = ccLineupState.slots.slice();
        ccLineupState.effectiveBench = ccLineupState.benchSlots.slice();
        return;
    }

    const assassinated = ccLineupState.assassinatedEntries || [];
    if (assassinated.length === 0) {
        ccLineupState.effectiveSlots = ccLineupState.slots.slice();
        ccLineupState.effectiveBench = ccLineupState.benchSlots.slice();
        return;
    }

    const starters = ccLineupState.slots.slice();
    const bench = ccLineupState.benchSlots.slice();

    const availableBench = [];
    bench.forEach(function(entry, idx) {
        if (entry &&
            assassinated.indexOf(Number(entry)) === -1 &&
            starters.indexOf(entry) === -1) {
            availableBench.push({ entry: entry, originalIdx: idx });
        }
    });

    let benchPtr = 0;
    const usedBench = new Set();

    for (let i = 0; i < starters.length; i++) {
        const entry = starters[i];
        if (!entry) continue;

        if (assassinated.indexOf(Number(entry)) !== -1) {
            if (benchPtr < availableBench.length) {
                const substitute = availableBench[benchPtr];
                starters[i] = substitute.entry;
                bench[substitute.originalIdx] = entry;
                usedBench.add(substitute.originalIdx);
                benchPtr++;
            }
        }
    }

    ccLineupState.effectiveSlots = starters;
    ccLineupState.effectiveBench = bench;
}

async function champCaptainsRenderLineup() {
    const container = document.getElementById('champCaptainsLineupContent');
    if (!container) return;

    if (ccLineupState.isRendering) return;
    ccLineupState.isRendering = true;

    container.innerHTML =
        '<div class="champ-captains-loading">' +
            '<div class="champ-captains-spinner"></div>' +
            '<div>Loading...</div>' +
        '</div>';

    try {
        await ccLoadAllCaptains();

        const team = champCaptains.currentTeam;
        const captainName = champCaptains.currentCaptainName;

        if (!team) {
            const round = ccGetRound();
            ccLineupState.round = round;
            ccLineupState.teamsSelections = await ccLoadAllSelections(round);
            container.innerHTML = tgcRenderTeamsGrid();
            ccStartAutoRefresh(function() { return champCaptainsRenderLineup(); });
            return;
        }

        if (typeof window.csState !== 'undefined') {
            window.csState.team = team;
            window.csState.captainName = captainName;
        }

        if (typeof window.csCheckConfigGate === 'function') {
            const gateHtml = await window.csCheckConfigGate(team);
            if (gateHtml) {
                container.innerHTML = gateHtml;
                ccStartAutoRefresh(function() { return champCaptainsRenderLineup(); });
                return;
            }
        }

        const round = ccGetRound();
        ccLineupState.round = round;

        if (typeof window.csState !== 'undefined') {
            window.csState.round = round;
        }

        ccLineupState.deadlineInfo = null;
        if (typeof getDeadlineForRound === 'function') {
            try {
                ccLineupState.deadlineInfo = await getDeadlineForRound(round);
            } catch (e) {
                console.warn('[Captains] deadline failed:', e);
            }
        }

        const deadlineMs = ccLineupState.deadlineInfo
            ? ccLineupState.deadlineInfo.deadlineMs : 0;
        ccLineupState.isDeadlinePassed = deadlineMs > 0 && Date.now() >= deadlineMs;

        ccLineupState.scoresVisible = await ccCheckScoresVisible();
        
        const assassinData = await ccLoadAssassinations(round, team);
        ccLineupState.assassinatedEntries = assassinData.entries;
        ccLineupState.assassinatedByNames = assassinData.byNames;

        ccLineupState.selection = await ccLoadSelection(round, team);

        const managers = await ccLoadTeamManagers(team, false);
        ccLineupState.allManagers = managers;

        if (!ccLineupState.isEditing && ccLineupState.selection) {
            const st = ccLineupState.selection.starters;
            if (Array.isArray(st)) {
                for (let i = 0; i < CC_TOTAL_SLOTS; i++) {
                    ccLineupState.slots[i] = (typeof st[i] === 'number') ? st[i] : null;
                }
            }

            const bench = ccLineupState.selection.bench;
            ccLineupState.benchSlots = [null, null];
            if (Array.isArray(bench)) {
                for (let i = 0; i < CC_BENCH_SLOTS && i < bench.length; i++) {
                    if (typeof bench[i] === 'number') {
                        ccLineupState.benchSlots[i] = bench[i];
                    }
                }
            }
        } else if (!ccLineupState.isEditing) {
            ccLineupState.slots = [null, null, null, null, null, null, null];
            ccLineupState.benchSlots = [null, null];
        }

        ccApplyAssassination();

        ccLineupState.opponentTeam = null;
        ccLineupState.opponentSelection = null;
        ccLineupState.opponentManagers = [];

        const matchup = await ccLoadOpponentForRound(team, round);
        if (matchup) {
            ccLineupState.opponentTeam = matchup.opponent;
            try {
                ccLineupState.opponentSelection = await ccLoadSelection(round, matchup.opponent);
                if (ccLineupState.opponentSelection) {
                    ccLineupState.opponentManagers =
                        await ccLoadTeamManagers(matchup.opponent, false);
                }
            } catch (e) {
                console.warn('[Captains] opp selection failed:', e);
            }
        }

        ccLineupState.specialResults = await ccLoadSpecialResults(
            round, team, ccLineupState.opponentTeam
        );

        if (typeof window.csLoadMyMovesForRound === 'function') {
            try {
                const moves = await window.csLoadMyMovesForRound(round, team);
                if (typeof window.csSetSavedMoves === 'function') {
                    window.csSetSavedMoves(moves || {});
                }
                if (typeof window.csState !== 'undefined') {
                    window.csState.opponentTeam = ccLineupState.opponentTeam;
                }
            } catch (e) {
                console.warn('[Captains] moves load failed:', e);
            }
        }

        champCaptains.lastRefreshAt = Date.now();

        const hasSaved = ccLineupState.selection && ccLineupState.selection.locked;

        if (hasSaved && !ccLineupState.isEditing) {
            if (ccLineupState.isDeadlinePassed && ccLineupState.opponentTeam) {
                document.body.classList.add('cc-matchup-active');
                container.innerHTML = ccRenderMatchupView(team, captainName);
            } else {
                document.body.classList.remove('cc-matchup-active');
                container.innerHTML = ccRenderLockedWithEdit(team, captainName);
            }
        } else if (ccLineupState.isDeadlinePassed && !ccLineupState.isEditing && !ccIsAdmin()) {
            document.body.classList.remove('cc-matchup-active');
            container.innerHTML = ccRenderDeadlinePassed(team, captainName);
        } else {
            document.body.classList.remove('cc-matchup-active');
            container.innerHTML = ccRenderLineupEditor(team, captainName);
        }

        ccInjectSpecialSection();
        ccStartAutoRefresh(function() { return champCaptainsRenderLineup(); });

    } catch (e) {
        console.error('[Captains] Lineup render error:', e);
        container.innerHTML =
            '<div class="champ-captains-empty">' +
                ccIcon('warning-circle', 'duotone') +
                '<div>فشل تحميل التشكيلة</div>' +
            '</div>';
    } finally {
        ccLineupState.isRendering = false;
    }
}

function tgcRenderTeamsGrid() {
    const teams = (typeof teamsMap !== 'undefined') ? Object.keys(teamsMap) : [];

    let html = '';
    html += '<div class="champ-captains-intro">';
    html += '<h2>' + ccIcon('strategy', 'fill') + ' Lineup</h2>';
    html += '<p>اختر ناديك —<br>ثم أدخل رمز القائد.</p>';
    html += '</div>';
    html += '<div class="cc-teams-select-grid">';

    teams.forEach(function(code) {
        const info = teamsMap[code];
        const logo = info.logo || '';
        const sel = ccLineupState.teamsSelections[code];
        const isReady = sel && sel.locked && sel.starters &&
            sel.starters.length === CC_TOTAL_SLOTS;

        const cardCls = 'cc-team-select-card' +
            (isReady ? ' cc-team-select-ready' : '');

        html += '<div class="' + cardCls + '" ' +
            'onclick="ccSelectTeamForPin(\'' + code + '\')">';
        if (logo) {
            html += '<img src="./' + logo + '" onerror="this.style.display=\'none\'">';
        }
        html += '<div class="cc-team-select-info">';
        html += '<div class="cc-team-select-name">' + (info.name || code) + '</div>';
        html += '<div class="cc-team-select-status">' +
            (isReady ? 'Ready' : 'Waiting') + '</div>';
        html += '</div>';
        html += '<div class="cc-team-select-icon">' +
            ccIcon('crown', 'fill') +
            '</div>';
        html += '</div>';
    });

    html += '</div>';
    return html;
}

async function ccAdminLoginToTeam(teamCode) {
    if (typeof showToast === 'function') {
        showToast('دخول الأدمن: ' + ccGetTeamName(teamCode), true, 1500);
    }

    await ccLoadAllCaptains();
    const captainInfo = champCaptains.allCaptains[teamCode];
    const displayName = captainInfo && captainInfo.captain_name
        ? captainInfo.captain_name
        : ('Admin (' + teamCode + ')');

    champCaptains.currentTeam = teamCode;
    champCaptains.currentCaptainEntry = captainInfo ? captainInfo.captain_entry : null;
    champCaptains.currentCaptainName = displayName;
    champCaptains.pendingTeamCode = null;

    try {
        sessionStorage.setItem('champ_captain_team', teamCode);
        sessionStorage.setItem('champ_captain_entry',
            captainInfo ? String(captainInfo.captain_entry) : '');
        sessionStorage.setItem('champ_captain_name', displayName);
    } catch (e) {
        console.warn('[Captains] sessionStorage failed:', e);
    }

    if (typeof window.csResetState === 'function') {
        window.csResetState();
    }
    if (typeof window.csState !== 'undefined') {
        window.csState.team = teamCode;
        window.csState.captainName = displayName;
        window.csState.config = null;
        window.csState.configSelection = [];
        window.csState.savedMoves = {};
    }

    champCaptainsCloseModal();

    ccLineupState.isEditing = false;
    ccLineupState.slots = [null, null, null, null, null, null, null];
    ccLineupState.benchSlots = [null, null];

    await champCaptainsRenderLineup();
}

function ccSelectTeamForPin(teamCode) {
    if (ccIsAdmin()) {
        ccAdminLoginToTeam(teamCode);
        return;
    }

    champCaptains.pendingTeamCode = teamCode;

    let modal = document.getElementById('champCaptainsPinModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'champCaptainsPinModal';
        modal.className = 'champ-captain-modal';
        document.body.appendChild(modal);
    }

    const logo = ccGetTeamLogo(teamCode);
    const teamName = ccGetTeamName(teamCode);

    modal.innerHTML =
        '<div class="champ-captain-modal-box">' +
            '<button type="button" class="champ-captain-modal-close" ' +
                'onclick="champCaptainsCloseModal()">✕</button>' +
            '<div class="champ-captain-modal-title">' +
                ccIcon('crown', 'fill') + ' ' + teamName +
            '</div>' +
            '<div class="champ-captain-modal-sub">أدخل رمز القائد</div>' +
            '<div class="cc-pin-team-logo">' +
                (logo ? '<img src="./' + logo + '" ' +
                    'onerror="this.style.display=\'none\'">' : '') +
            '</div>' +
            '<input type="tel" maxlength="4" class="champ-captain-pin-input" ' +
                'id="ccPinInput" placeholder="••••" inputmode="numeric" ' +
                'pattern="[0-9]*" autocomplete="off">' +
            '<div class="champ-captain-pin-error" id="ccPinError"></div>' +
            '<button type="button" class="champ-captain-modal-btn" id="ccPinBtn" ' +
                'onclick="champCaptainsVerifyPin()">دخول</button>' +
        '</div>';

    modal.classList.add('show');

    setTimeout(function() {
        const input = document.getElementById('ccPinInput');
        if (input) {
            input.value = '';
            input.focus();
            input.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '');
                if (this.value.length === 4) champCaptainsVerifyPin();
            });
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') champCaptainsVerifyPin();
            });
        }
    }, 100);
}

function ccRenderLineupEditor(team, captainName) {
    const logo = ccGetTeamLogo(team);
    const teamName = ccGetTeamName(team);
    const round = ccLineupState.round;
    const selectedCount = ccLineupState.slots.filter(function(s) { return s !== null; }).length;
    const benchCount = ccLineupState.benchSlots.filter(function(s) { return s !== null; }).length;
    const percent = Math.round((selectedCount / CC_TOTAL_SLOTS) * 100);
    const isFull = selectedCount === CC_TOTAL_SLOTS && benchCount === CC_BENCH_SLOTS;

    let html = '';
    html += '<div class="champ-captain-header">';
    html += '<button type="button" class="champ-captain-logout" ' +
        'onclick="champCaptainsLogout()">' +
        ccIcon('sign-out', 'bold') + ' EXIT</button>';
    html += '<div class="champ-captain-header-badge">' +
        ccIcon('trophy', 'fill') + ' GW' + round + '</div>';
    html += '<div class="champ-captain-header-info">';
    html += '<div class="champ-captain-header-text">';
    html += '<div class="champ-captain-header-team">' + teamName + '</div>';
    html += '<div class="champ-captain-header-name">Captain: ' +
        ccEscapeAttr(captainName) + '</div>';
    html += '</div>';
    if (logo) {
        html += '<img src="./' + logo + '" ' +
            'onerror="this.style.display=\'none\'">';
    }
    html += '</div>';
    html += '</div>';

    html += '<div id="ccLineupSpecialSlot" class="cc-lineup-special-slot"></div>';

    html += '<div class="champ-captain-progress">';
    html += '<div class="champ-captain-progress-text">Starters: ';
    html += '<span class="champ-captain-progress-count" id="ccLineupCount">' +
        selectedCount + '</span>';
    html += '<span style="color:#6B6B80;"> / ' + CC_TOTAL_SLOTS + '</span>';
    html += ' &nbsp;·&nbsp; Bench: ';
    html += '<span class="champ-captain-progress-count" id="ccBenchCount">' +
        benchCount + '</span>';
    html += '<span style="color:#6B6B80;"> / ' + CC_BENCH_SLOTS + '</span>';
    html += '</div>';
    html += '<div class="champ-captain-progress-bar">';
    html += '<div class="champ-captain-progress-fill' +
        (isFull ? ' full' : '') +
        '" id="ccLineupProgressFill" style="width:' + percent + '%;"></div>';
    html += '</div>';
    html += '</div>';

    html += ccRenderPitch(ccLineupState.slots, 'editor');
    html += ccRenderBenchSection('editor');

    html += '<div class="cc-lineup-actions">';
    if (isFull) {
        html += '<button type="button" class="champ-captain-save-btn" id="ccLineupSaveBtn" ' +
            'onclick="champCaptainsSaveLineup()">';
        html += ccIcon('check-circle', 'fill') + ' Save Final Lineup';
        html += '</button>';
    } else {
        html += '<button type="button" class="champ-captain-save-btn" disabled>';
        html += ccIcon('check-circle', 'fill') + ' Save Final Lineup';
        html += '</button>';
    }
    html += '<button type="button" class="cc-clear-btn" onclick="champCaptainsClearLineup()">';
    html += ccIcon('trash', 'bold') + ' Clear All';
    html += '</button>';
    html += '</div>';

    return html;
}

function ccRenderPitch(slots, mode, useEffective) {
    let html = '<div class="tgc-pitch tgc-pitch-' + mode + '">';
    html += '<div class="tgc-pitch-rows">';

    CC_PITCH_ROWS.forEach(function(row) {
        html += '<div class="tgc-pitch-row tgc-pitch-row-' + row.type + '">';
        row.slots.forEach(function(slotIdx) {
            const entry = useEffective ? ccLineupState.effectiveSlots[slotIdx] : slots[slotIdx];
            html += ccRenderSlot(slotIdx, entry, mode, slotIdx);
        });
        html += '</div>';
    });

    html += '</div></div>';
    return html;
}

function ccRenderSlot(slotIdx, entry, mode, slotOriginIdx) {
    const manager = entry ? ccFindManagerByEntry(entry) : null;
    const type = CC_SLOT_TYPES[slotIdx];
    const label = CC_SLOT_LABELS[slotIdx];
    const isActive = ccLineupState.activeSlot === slotIdx;
    const isFilled = !!manager;
    
    const isAssassinated = isFilled && ccLineupState.assassinatedEntries.indexOf(Number(entry)) !== -1;
    const wasPromoted = ccLineupState.isDeadlinePassed &&
        ccLineupState.benchSlots.indexOf(entry) !== -1 &&
        ccLineupState.effectiveSlots.indexOf(entry) !== -1 &&
        ccLineupState.slots[slotOriginIdx] !== entry;

    const cls = 'cc-slot cc-slot-' + type +
        (isFilled ? ' cc-slot-filled' : ' cc-slot-empty') +
        (isActive ? ' cc-slot-active' : '') +
        (isAssassinated ? ' cc-slot-assassinated' : '') +
        (wasPromoted ? ' cc-slot-promoted' : '') +
        (mode === 'editor' ? '' : ' cc-slot-readonly');

    const clickAttr = (mode === 'editor')
        ? 'onclick="champCaptainsOpenSlotPicker(' + slotIdx + ')"'
        : '';

    let html = '<div class="' + cls + '" data-slot="' + slotIdx + '" ' +
        clickAttr + '>';

    html += '<div class="cc-slot-shirt-box">';
    if (isFilled) {
        const shirt = ccGetTeamShirt(champCaptains.currentTeam);
        if (shirt) {
            html += '<img class="cc-slot-shirt-img" src="./' + shirt + '" ' +
                'onerror="this.style.display=\'none\'" alt="">';
        }
        if (isAssassinated) {
            html += '<div class="cc-assassination-overlay">💀</div>';
        }
        if (wasPromoted) {
            html += '<div class="cc-promoted-badge">⬆️</div>';
        }
    } else {
        html += '<div class="cc-slot-plus-shirt">' +
            ccIcon('plus', 'bold') + '</div>';
    }
    html += '</div>';

    html += '<div class="cc-slot-name-box">';
    if (isFilled) {
        html += ccTwoNames(manager);
    } else {
        html += '<div class="cc-slot-name cc-slot-name-empty">' +
            label + '</div>';
    }
    html += '</div>';

    if (isFilled && mode !== 'editor' && ccLineupState.scoresVisible) {
        html += '<div class="cc-slot-points-box">' +
            '<div class="cc-slot-points">' +
            (manager.lastPoints || 0) + ' pts</div></div>';
    }

    if (isFilled && mode === 'editor') {
        html += '<div class="cc-slot-remove" ' +
            'onclick="event.stopPropagation(); ccRemoveCard(' + slotIdx + ')" ' +
            'title="إزالة">✕</div>';
    }

    html += '</div>';
    return html;
}

function ccRenderBenchSection(mode) {
    const benchSlots = (mode === 'editor')
        ? ccLineupState.benchSlots
        : ccLineupState.effectiveBench;
    const filledCount = benchSlots.filter(function(s) { return s !== null; }).length;

    let html = '<div class="cc-bench-section">';

    html += '<div class="cc-bench-header">';
    html += '<div class="tgc-bench-title">' +
        ccIcon('armchair', 'fill') + ' البدلاء' +
        '</div>';
    html += '<div class="cc-bench-count">' +
        filledCount + ' / ' + CC_BENCH_SLOTS +
        '</div>';
    html += '</div>';

    html += '<div class="cc-bench-hint">' +
        ccIcon('info', 'fill') + ' ' +
        (ccLineupState.isDeadlinePassed
            ? 'البدلاء دخلوا تلقائياً إذا اغتال الخصم مديرين'
            : 'البدلاء يدخلون تلقائياً إذا اغتال الخصم مديرين') +
        '</div>';

    html += '<div class="tgc-bench-row">';
    for (let i = 0; i < CC_BENCH_SLOTS; i++) {
        html += ccRenderBenchSlot(i, benchSlots[i], mode);
    }
    html += '</div>';

    html += '</div>';
    return html;
}

function ccRenderBenchSlot(slotIdx, entry, mode) {
    const mgr = entry ? ccFindManagerByEntry(entry) : null;
    const isFilled = !!mgr;
    const isActive = ccLineupState.activeBenchSlot === slotIdx;

    const isAssassinated = isFilled && ccLineupState.assassinatedEntries.indexOf(Number(entry)) !== -1;

    const cls = 'cc-bench-slot' +
        (isFilled ? ' cc-bench-filled' : ' cc-bench-empty') +
        (isActive ? ' cc-bench-active' : '') +
        (isAssassinated ? ' cc-slot-assassinated' : '') +
        (mode === 'editor' ? '' : ' cc-bench-readonly');

    const clickAttr = (mode === 'editor')
        ? 'onclick="champCaptainsOpenBenchPicker(' + slotIdx + ')"'
        : '';

    let html = '<div class="' + cls + '" data-bench="' + slotIdx + '" ' +
        clickAttr + '>';

    html += '<div class="cc-bench-number">' + (slotIdx + 1) + '</div>';

    if (isFilled) {
        const shirt = ccGetTeamShirt(champCaptains.currentTeam);
        if (shirt) {
            html += '<img class="cc-slot-shirt-img" src="./' + shirt + '" ' +
                'onerror="this.style.display=\'none\'" alt="">';
        }
        if (isAssassinated) {
            html += '<div class="cc-assassination-overlay">💀</div>';
        }
        html += '<div class="cc-slot-name-box">';
        html += ccTwoNames(mgr);
        html += '</div>';

        if (mode !== 'editor' && ccLineupState.scoresVisible) {
            html += '<div class="cc-slot-points-box">' +
                '<div class="cc-slot-points">' +
                (mgr.lastPoints || 0) + ' pts</div></div>';
        }

        if (mode === 'editor') {
            html += '<div class="cc-slot-remove" ' +
                'onclick="event.stopPropagation(); ccRemoveBenchCard(' + slotIdx + ')" ' +
                'title="إزالة">✕</div>';
        }
    } else {
        html += '<div class="cc-slot-plus-shirt">' + ccIcon('plus', 'bold') + '</div>';
        html += '<div class="cc-slot-name-box">';
        html += '<div class="cc-slot-name cc-slot-name-empty">بديل ' + (slotIdx + 1) + '</div>';
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function ccRemoveCard(slotIdx) {
    if (slotIdx < 0 || slotIdx >= CC_TOTAL_SLOTS) return;
    ccLineupState.slots[slotIdx] = null;
    ccRefreshLineupUI();
}

function ccRemoveBenchCard(slotIdx) {
    if (slotIdx < 0 || slotIdx >= CC_BENCH_SLOTS) return;
    ccLineupState.benchSlots[slotIdx] = null;
    ccRefreshLineupUI();
}

function champCaptainsOpenSlotPicker(slotIdx) {
    if (slotIdx < 0 || slotIdx >= CC_TOTAL_SLOTS) return;

    ccLineupState.activeSlot = slotIdx;
    ccLineupState.activeBenchSlot = null;

    document.querySelectorAll('.cc-slot').forEach(function(el) {
        const idx = parseInt(el.getAttribute('data-slot'), 10);
        el.classList.toggle('cc-slot-active', idx === slotIdx);
    });
    document.querySelectorAll('.cc-bench-slot').forEach(function(el) {
        el.classList.remove('cc-bench-active');
    });

    champCaptainsRenderSlotPicker();
}

function champCaptainsOpenBenchPicker(slotIdx) {
    if (slotIdx < 0 || slotIdx >= CC_BENCH_SLOTS) return;

    ccLineupState.activeBenchSlot = slotIdx;
    ccLineupState.activeSlot = null;

    document.querySelectorAll('.cc-bench-slot').forEach(function(el) {
        const idx = parseInt(el.getAttribute('data-bench'), 10);
        el.classList.toggle('cc-bench-active', idx === slotIdx);
    });
    document.querySelectorAll('.cc-slot').forEach(function(el) {
        el.classList.remove('cc-slot-active');
    });

    champCaptainsRenderSlotPicker();
}

function champCaptainsRenderSlotPicker() {
    const isBenchMode = ccLineupState.activeBenchSlot !== null;
    const activeIdx = isBenchMode
        ? ccLineupState.activeBenchSlot
        : ccLineupState.activeSlot;

    if (activeIdx === null || activeIdx === undefined) return;

    const currentEntry = isBenchMode
        ? ccLineupState.benchSlots[activeIdx]
        : ccLineupState.slots[activeIdx];

    const title = isBenchMode
        ? ('بديل ' + (activeIdx + 1))
        : CC_SLOT_LABELS[activeIdx];

    let modal = document.getElementById('ccSlotPickerModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ccSlotPickerModal';
        modal.className = 'champ-captain-modal';
        document.body.appendChild(modal);
    }

    let html = '<div class="champ-captain-modal-box" style="max-width:520px;">';
    html += '<button type="button" class="champ-captain-modal-close" ' +
        'onclick="champCaptainsCloseSlotPicker()">✕</button>';
    html += '<div class="champ-captain-modal-title">' +
        ccIcon('user-plus', 'fill') + ' ' + title + '</div>';
    html += '<div class="champ-captain-modal-sub">' +
        (isBenchMode ? 'اختر بديلاً (يُستبدل تلقائياً عند الاغتيال)' : 'اختر مديراً لهذه الخانة') +
        '</div>';

    if (currentEntry) {
        const removeFn = isBenchMode
            ? ('ccRemoveBenchCard(' + activeIdx + ')')
            : ('ccRemoveCard(' + activeIdx + ')');
        html += '<button type="button" class="cc-picker-remove-btn" ' +
            'onclick="' + removeFn + '; champCaptainsCloseSlotPicker();">';
        html += ccIcon('trash', 'bold') + ' إزالة';
        html += '</button>';
    }

    html += '<div class="champ-captains-picker-list" id="ccPickerList">';

    let validManagersCount = 0;

    ccLineupState.allManagers.forEach(function(m) {
        if (!m.entry) return;
        validManagersCount++;

        const inStarter = ccLineupState.slots.indexOf(m.entry);
        const inBench = ccLineupState.benchSlots.indexOf(m.entry);

        let isCurrent = false;
        let isElsewhere = false;

        if (isBenchMode) {
            isCurrent = (inBench === activeIdx);
            isElsewhere = (inBench !== -1 && inBench !== activeIdx) ||
                          (inStarter !== -1);
        } else {
            isCurrent = (inStarter === activeIdx);
            isElsewhere = (inStarter !== -1 && inStarter !== activeIdx) ||
                          (inBench !== -1);
        }

        const isAssassinated = ccLineupState.assassinatedEntries.indexOf(Number(m.entry)) !== -1;
        if (isAssassinated) isElsewhere = true;

        const cls = 'champ-captains-picker-item' +
            (isCurrent ? ' selected' : '') +
            (isElsewhere ? ' cc-picker-disabled' : '');

        html += '<div class="' + cls + '" ';
        if (!isElsewhere) {
            html += 'onclick="champCaptainsPickManagerForSlot(' + m.entry + ')"';
        }
        html += '>';

        const shirt = ccGetTeamShirt(champCaptains.currentTeam);
        html += '<div class="cc-picker-shirt">';
        if (shirt) {
            html += '<img src="./' + shirt + '" ' +
                'onerror="this.style.display=\'none\'" alt="">';
        }
        html += '</div>';

        html += '<div class="champ-captains-picker-info">';
        html += '<div class="champ-captains-picker-name">' +
            ccEscapeAttr(m.teamName || m.displayName) + '</div>';
        html += '<div class="champ-captains-picker-sub">' + (m.teamName && m.mgrName ? ccEscapeAttr(m.mgrName) + ' · ' : '') + '#' + m.entry +
            ' · Avg ' + (m.avgPoints || 0);

        if (isAssassinated) {
            html += ' · <strong style="color:#EF4444;">مُغتال 💀</strong>';
        } else if (isElsewhere) {
            if (inStarter !== -1) {
                html += ' · <strong style="color:#EF4444;">أساسي (' +
                    CC_SLOT_LABELS[inStarter] + ')</strong>';
            } else if (inBench !== -1) {
                html += ' · <strong style="color:#EF4444;">بديل ' +
                    (inBench + 1) + '</strong>';
            }
        }
        html += '</div></div>';

        if (isCurrent) {
            html += '<div class="cc-picker-check">' +
                ccIcon('check-circle', 'fill') + '</div>';
        }
        if (isElsewhere) {
            html += '<div class="cc-picker-block">' +
                ccIcon('prohibit', 'bold') + '</div>';
        }

        html += '</div>';
    });

    if (validManagersCount === 0) {
        html += '<div style="padding:20px 10px; text-align:center; color:#A1A1B5; font-size:13px; line-height:1.6;">' +
            'لا يوجد مديرين متاحين حالياً.<br>قد تكون بيانات FPL لم تحمل بشكل صحيح، يرجى تحديث الصفحة.' +
            '</div>';
    }

    html += '</div></div>';

    modal.innerHTML = html;
    modal.classList.add('show');
}

function champCaptainsCloseSlotPicker() {
    const modal = document.getElementById('ccSlotPickerModal');
    if (modal) modal.classList.remove('show');

    ccLineupState.activeSlot = null;
    ccLineupState.activeBenchSlot = null;

    document.querySelectorAll('.cc-slot').forEach(function(el) {
        el.classList.remove('cc-slot-active');
    });
    document.querySelectorAll('.cc-bench-slot').forEach(function(el) {
        el.classList.remove('cc-bench-active');
    });
}

function champCaptainsPickManagerForSlot(entry) {
    entry = Number(entry);
    if (ccLineupState.assassinatedEntries.indexOf(entry) !== -1) return;

    const isBenchMode = ccLineupState.activeBenchSlot !== null;
    const starterIdx = ccLineupState.slots.indexOf(entry);
    const benchIdx = ccLineupState.benchSlots.indexOf(entry);

    if (isBenchMode) {
        const bIdx = ccLineupState.activeBenchSlot;

        if (starterIdx !== -1) {
            const prevBench = ccLineupState.benchSlots[bIdx];
            ccLineupState.benchSlots[bIdx] = entry;
            ccLineupState.slots[starterIdx] = prevBench;
        } else if (benchIdx !== -1 && benchIdx !== bIdx) {
            const prevBench = ccLineupState.benchSlots[bIdx];
            ccLineupState.benchSlots[bIdx] = entry;
            ccLineupState.benchSlots[benchIdx] = prevBench;
        } else if (benchIdx === bIdx) {
            ccLineupState.benchSlots[bIdx] = null;
        } else {
            ccLineupState.benchSlots[bIdx] = entry;
        }
    } else {
        const sIdx = ccLineupState.activeSlot;

        if (starterIdx !== -1 && starterIdx !== sIdx) {
            const prev = ccLineupState.slots[sIdx];
            ccLineupState.slots[sIdx] = entry;
            ccLineupState.slots[starterIdx] = prev;
        } else if (benchIdx !== -1) {
            const prev = ccLineupState.slots[sIdx];
            ccLineupState.slots[sIdx] = entry;
            ccLineupState.benchSlots[benchIdx] = prev;
        } else if (starterIdx === sIdx) {
            ccLineupState.slots[sIdx] = null;
        } else {
            ccLineupState.slots[sIdx] = entry;
        }
    }

    champCaptainsCloseSlotPicker();
    ccRefreshLineupUI();
}

function champCaptainsRemoveFromSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx >= CC_TOTAL_SLOTS) return;
    ccLineupState.slots[slotIdx] = null;
    champCaptainsCloseSlotPicker();
    ccRefreshLineupUI();
}

function ccRefreshLineupUI() {
    const team = champCaptains.currentTeam;
    const captainName = champCaptains.currentCaptainName;
    if (!team) return;

    const container = document.getElementById('champCaptainsLineupContent');
    if (!container) return;

    if (!ccLineupState.selection || !ccLineupState.selection.locked ||
        ccLineupState.isEditing) {
        container.innerHTML = ccRenderLineupEditor(team, captainName);
        ccInjectSpecialSection();
    }
}

function champCaptainsClearLineup() {
    if (!confirm('هل تريد حذف كل الاختيارات؟')) return;
    ccLineupState.slots = [null, null, null, null, null, null, null];
    ccLineupState.benchSlots = [null, null];
    ccRefreshLineupUI();
}

async function champCaptainsSaveLineup() {
    if (ccLineupState.isSaving) return;

    const team = champCaptains.currentTeam;
    const round = ccLineupState.round;

    if (!team || !round) {
        if (typeof showToast === 'function') showToast('Missing team or round', false);
        return;
    }

    const slots = ccLineupState.slots;
    const benchSlots = ccLineupState.benchSlots;

    const startersFilled = slots.filter(function(s) { return s !== null; });
    const benchFilled = benchSlots.filter(function(s) { return s !== null; });

    if (startersFilled.length !== CC_TOTAL_SLOTS) {
        if (typeof showToast === 'function') {
            showToast('اختر ' + CC_TOTAL_SLOTS + ' أساسيين بالضبط', false);
        }
        return;
    }

    if (benchFilled.length !== CC_BENCH_SLOTS) {
        if (typeof showToast === 'function') {
            showToast('اختر ' + CC_BENCH_SLOTS + ' بدلاء بالضبط', false);
        }
        return;
    }

    ccLineupState.isSaving = true;

    const btn = document.getElementById('ccLineupSaveBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = ccIcon('hourglass', 'bold') + ' Saving...';
    }

    const result = await ccSaveSelection(round, team, slots, benchSlots);

    if (result.ok) {
        if (typeof showToast === 'function') {
            showToast('تم حفظ التشكيلة! GW' + round, true, 3000);
        }
        if (navigator.vibrate) navigator.vibrate([30, 20, 50]);

        ccLineupState.selection = {
            round: round, team: team,
            starters: slots.slice(), bench: benchSlots.slice(), locked: true
        };
        ccLineupState.isEditing = false;

        ccStopAutoRefresh();
        champCaptainsRenderLineup();
    } else {
        if (typeof showToast === 'function') showToast('فشل الحفظ: ' + (result.error || 'Unknown'), false, 6000);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = ccIcon('check-circle', 'fill') + ' Save Final Lineup';
        }
    }

    ccLineupState.isSaving = false;
}

function ccEditLineup() {
    if (ccLineupState.isDeadlinePassed && !ccIsAdmin()) {
        if (typeof showToast === 'function') {
            showToast('الديدلاين قفل — ما يمكن التعديل', false);
        }
        return;
    }

    ccLineupState.isEditing = true;

    if (ccLineupState.selection) {
        const st = ccLineupState.selection.starters;
        if (Array.isArray(st)) {
            for (let i = 0; i < CC_TOTAL_SLOTS; i++) {
                ccLineupState.slots[i] = (typeof st[i] === 'number') ? st[i] : null;
            }
        }

        const bench = ccLineupState.selection.bench;
        ccLineupState.benchSlots = [null, null];
        if (Array.isArray(bench)) {
            for (let i = 0; i < CC_BENCH_SLOTS && i < bench.length; i++) {
                if (typeof bench[i] === 'number') {
                    ccLineupState.benchSlots[i] = bench[i];
                }
            }
        }
    }

    document.body.classList.remove('cc-matchup-active');
    ccRefreshLineupUI();
}

function ccRenderLockedWithEdit(team, captainName) {
    const logo = ccGetTeamLogo(team);
    const teamName = ccGetTeamName(team);
    const round = ccLineupState.round;
    const isAdmin = ccIsAdmin();

    let html = '';
    html += '<div class="champ-captain-header">';
    html += '<button type="button" class="champ-captain-logout" ' +
        'onclick="champCaptainsLogout()">' +
        ccIcon('sign-out', 'bold') + ' EXIT</button>';
    html += '<div class="champ-captain-header-badge">' +
        ccIcon('trophy', 'fill') + ' GW' + round + '</div>';
    html += '<div class="champ-captain-header-info">';
    html += '<div class="champ-captain-header-text">';
    html += '<div class="champ-captain-header-team">' + teamName + '</div>';
    html += '<div class="champ-captain-header-name">Captain: ' +
        ccEscapeAttr(captainName) + '</div>';
    html += '</div>';
    if (logo) {
        html += '<img src="./' + logo + '" ' +
            'onerror="this.style.display=\'none\'">';
    }
    html += '</div>';
    html += '</div>';

    html += '<div id="ccLineupSpecialSlot" class="cc-lineup-special-slot"></div>';

    html += '<div class="champ-captain-locked">';
    html += '<span class="champ-captain-locked-icon">' +
        ccIcon('lock', 'fill') + '</span>';
    html += '<div class="champ-captain-locked-title">Squad Locked</div>';
    html += '<div class="champ-captain-locked-sub">' +
        'تم حفظ التشكيلة — يمكنك التعديل قبل الديدلاين.</div>';
    html += '</div>';

    html += ccRenderPitch(ccLineupState.slots, 'view', false);
    html += ccRenderBenchSection('view');

    html += '<div class="cc-lineup-actions">';
    if (isAdmin || !ccLineupState.isDeadlinePassed) {
        html += '<button type="button" class="tgc-edit-btn" onclick="ccEditLineup()">';
        html += ccIcon('pencil', 'bold') + (isAdmin && ccLineupState.isDeadlinePassed ? ' Admin Force Edit' : ' Edit Lineup');
        html += '</button>';
    }
    html += '</div>';

    return html;
}

function ccRenderDeadlinePassed(team, captainName) {
    const logo = ccGetTeamLogo(team);
    const teamName = ccGetTeamName(team);

    let html = '';
    html += '<div class="champ-captain-header">';
    html += '<button type="button" class="champ-captain-logout" ' +
        'onclick="champCaptainsLogout()">' +
        ccIcon('sign-out', 'bold') + ' EXIT</button>';
    html += '<div class="champ-captain-header-info">';
    html += '<div class="champ-captain-header-text">';
    html += '<div class="champ-captain-header-team">' + teamName + '</div>';
    html += '<div class="champ-captain-header-name">Captain: ' +
        ccEscapeAttr(captainName) + '</div>';
    html += '</div>';
    if (logo) {
        html += '<img src="./' + logo + '" ' +
            'onerror="this.style.display=\'none\'">';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="champ-captain-locked" style="border-color:#EF4444;">';
    html += '<span class="champ-captain-locked-icon" style="color:#EF4444;">' +
        ccIcon('clock-countdown', 'fill') + '</span>';
    html += '<div class="champ-captain-locked-title" style="color:#EF4444;">' +
        'Deadline Passed</div>';
    html += '<div class="champ-captain-locked-sub">' +
        'لم يتم حفظ تشكيلة قبل الديدلاين.<br>' +
        'راجع الأدمن لاختيار تلقائي.</div>';
    html += '</div>';

    return html;
}

function ccRenderSpecialDetails(moves) {
    const myMoves = moves.myMoves || {};
    const oppMoves = moves.oppMoves || {};
    
    const hasAny = Object.keys(myMoves).length > 0 || Object.keys(oppMoves).length > 0;
    if (!hasAny) return '';

    let html = '<div class="cc-special-results">';
    html += '<div class="cc-special-results-title">⚔️ Special Moves</div>';

    if (oppMoves.assassination) {
        const d = oppMoves.assassination.move_data || {};
        const blocked = d.blocked_entries || [];
        const names = blocked.map(function(e) {
            const m = ccFindManagerByEntry(e);
            return m ? m.displayName : ('Player #' + e);
        }).filter(Boolean);
        
        html += '<div class="cc-special-card cc-special-card-red">';
        html += '<div class="cc-special-card-header">';
        html += '<span class="cc-special-card-icon">🗡️</span>';
        html += '<span class="cc-special-card-title">Assassination</span>';
        html += '<span class="cc-special-card-team">from ' + ccGetTeamName(ccLineupState.opponentTeam) + '</span>';
        html += '</div>';
        html += '<div class="cc-special-card-body">';
        html += '<div class="cc-special-card-line">المديرون المُغتالون:</div>';
        names.forEach(function(nm) {
            html += '<div class="cc-special-card-blocked">💀 ' + nm + '</div>';
        });
        html += '</div></div>';
    }

    if (myMoves.assassination) {
        const d = myMoves.assassination.move_data || {};
        const blocked = d.blocked_entries || [];
        const names = blocked.map(function(e) {
            const m = ccLineupState.opponentManagers.find(function(mm) { return Number(mm.entry) === Number(e); });
            return m ? m.displayName : ('Player #' + e);
        }).filter(Boolean);
        
        html += '<div class="cc-special-card cc-special-card-dark">';
        html += '<div class="cc-special-card-header">';
        html += '<span class="cc-special-card-icon">🗡️</span>';
        html += '<span class="cc-special-card-title">Assassination (You)</span>';
        html += '</div>';
        html += '<div class="cc-special-card-body">';
        html += '<div class="cc-special-card-line">اغتلت من ' + ccGetTeamName(ccLineupState.opponentTeam) + ':</div>';
        names.forEach(function(nm) {
            html += '<div class="cc-special-card-blocked">🎯 ' + nm + '</div>';
        });
        html += '</div></div>';
    }

    if (myMoves.h2h) {
        const d = myMoves.h2h.move_data || {};
        const my = ccLineupState.allManagers.find(function(m) { return Number(m.entry) === Number(d.my_entry); });
        const opp = ccLineupState.opponentManagers.find(function(m) { return Number(m.entry) === Number(d.opponent_entry); });
        const myPts = my ? (my.lastPoints || 0) : 0;
        const oppPts = opp ? (opp.lastPoints || 0) : 0;
        const result = myPts > oppPts ? { text: 'WON +30', cls: 'green' }
                     : myPts < oppPts ? { text: 'LOST -30', cls: 'red' }
                     : { text: 'DRAW', cls: 'gray' };
        
        html += '<div class="cc-special-card cc-special-card-gold">';
        html += '<div class="cc-special-card-header">';
        html += '<span class="cc-special-card-icon">⚔️</span>';
        html += '<span class="cc-special-card-title">Head-to-Head (You)</span>';
        html += '<span class="cc-special-card-result ' + result.cls + '">' + result.text + '</span>';
        html += '</div>';
        html += '<div class="cc-special-card-body">';
        html += '<div class="cc-h2h-versus">';
        html += '<div class="cc-h2h-side">';
        html += '<div class="cc-h2h-name">' + (d.my_name || '?') + '</div>';
        html += '<div class="cc-h2h-points ' + (myPts > oppPts ? 'winner' : '') + '">' + myPts + '</div>';
        html += '<div class="cc-h2h-label">أنت</div>';
        html += '</div>';
        html += '<div class="cc-h2h-vs">VS</div>';
        html += '<div class="cc-h2h-side">';
        html += '<div class="cc-h2h-name">' + (d.opponent_name || '?') + '</div>';
        html += '<div class="cc-h2h-points ' + (oppPts > myPts ? 'winner' : '') + '">' + oppPts + '</div>';
        html += '<div class="cc-h2h-label">الخصم</div>';
        html += '</div>';
        html += '</div>';
        html += '</div></div>';
    }

    if (oppMoves.h2h) {
        const d = oppMoves.h2h.move_data || {};
        const my = ccLineupState.allManagers.find(function(m) { return Number(m.entry) === Number(d.opponent_entry); });
        const opp = ccLineupState.opponentManagers.find(function(m) { return Number(m.entry) === Number(d.my_entry); });
        const myPts = my ? (my.lastPoints || 0) : 0;
        const oppPts = opp ? (opp.lastPoints || 0) : 0;
        const result = myPts > oppPts ? { text: 'WE WON +30', cls: 'green' }
                     : myPts < oppPts ? { text: 'WE LOST -30', cls: 'red' }
                     : { text: 'DRAW', cls: 'gray' };
        
        html += '<div class="cc-special-card cc-special-card-dark">';
        html += '<div class="cc-special-card-header">';
        html += '<span class="cc-special-card-icon">⚔️</span>';
        html += '<span class="cc-special-card-title">Head-to-Head (Enemy)</span>';
        html += '<span class="cc-special-card-result ' + result.cls + '">' + result.text + '</span>';
        html += '</div>';
        html += '<div class="cc-special-card-body">';
        html += '<div class="cc-h2h-versus">';
        html += '<div class="cc-h2h-side">';
        html += '<div class="cc-h2h-name">' + (d.opponent_name || '?') + '</div>';
        html += '<div class="cc-h2h-points ' + (myPts > oppPts ? 'winner' : '') + '">' + myPts + '</div>';
        html += '<div class="cc-h2h-label">أنت</div>';
        html += '</div>';
        html += '<div class="cc-h2h-vs">VS</div>';
        html += '<div class="cc-h2h-side">';
        html += '<div class="cc-h2h-name">' + (d.my_name || '?') + '</div>';
        html += '<div class="cc-h2h-points ' + (oppPts > myPts ? 'winner' : '') + '">' + oppPts + '</div>';
        html += '<div class="cc-h2h-label">الخصم</div>';
        html += '</div>';
        html += '</div>';
        html += '</div></div>';
    }

    if (myMoves.clean_sheet) {
        const d = myMoves.clean_sheet.move_data || {};
        const betTeam = d.bet_team || '?';
        const pts = d.defenders_pts || 0;
        
        html += '<div class="cc-special-card cc-special-card-blue">';
        html += '<div class="cc-special-card-header">';
        html += '<span class="cc-special-card-icon">🛡️</span>';
        html += '<span class="cc-special-card-title">Clean Sheet Bet</span>';
        html += '</div>';
        html += '<div class="cc-special-card-body">';
        html += '<div class="cc-special-card-line">راهنت على: <strong>' + betTeam + '</strong></div>';
        if (pts > 0) {
            html += '<div class="cc-special-card-line">نقاط مدافعين ' + betTeam + ': <strong style="color:#5CBFEB;">+' + pts + ' pts</strong></div>';
        } else {
            html += '<div class="cc-special-card-line" style="color:#A1A1B5;">لم يحافظ على شباكه نظيفة</div>';
        }
        html += '</div></div>';
    }

    if (myMoves.revival) {
        html += '<div class="cc-special-card cc-special-card-green">';
        html += '<div class="cc-special-card-header">';
        html += '<span class="cc-special-card-icon">💚</span>';
        html += '<span class="cc-special-card-title">Revival</span>';
        html += '</div>';
        html += '<div class="cc-special-card-body">';
        html += '<div class="cc-special-card-line">تم التفعيل — المباراة القادمة دبل</div>';
        html += '</div></div>';
    }

    if (myMoves.sniper) {
        html += '<div class="cc-special-card cc-special-card-purple">';
        html += '<div class="cc-special-card-header">';
        html += '<span class="cc-special-card-icon">🎯</span>';
        html += '<span class="cc-special-card-title">General Mobilization</span>';
        html += '</div>';
        html += '<div class="cc-special-card-body">';
        html += '<div class="cc-special-card-line">تم التفعيل ضد ' + ccGetTeamName(ccLineupState.opponentTeam) + '</div>';
        html += '</div></div>';
    }

    html += '</div>';
    return html;
}

function ccRenderAdminForceAction() {
    if (!ccIsAdmin() || !ccLineupState.isDeadlinePassed) return '';
    
    return '' +
        '<div class="cc-admin-force-panel">' +
            '<div class="cc-admin-force-title">👑 Admin Force Action</div>' +
            '<div class="cc-admin-force-desc">تفعيل خاصية بدل القائد (في حال صار خلل)</div>' +
            '<button type="button" class="cc-admin-force-btn" onclick="ccOpenAdminForceModal()">' +
                '⚡ فتح لوحة التفعيل' +
            '</button>' +
        '</div>';
}

function ccOpenAdminForceModal() {
    if (!ccIsAdmin()) return;
    
    if (typeof window.csOpenMoveModal !== 'function') {
        if (typeof showToast === 'function') showToast('نظام الخواص غير جاهز', false);
        return;
    }
    
    const chosen = (window.csState && window.csState.config && window.csState.config.chosen_moves) || [];
    if (chosen.length === 0) {
        if (typeof showToast === 'function') showToast('هذا القائد لم يختر خواصه بعد', false);
        return;
    }
    
    let modal = document.getElementById('ccAdminForceModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ccAdminForceModal';
        modal.className = 'champ-captain-modal';
        document.body.appendChild(modal);
    }
    
    let html = '<div class="champ-captain-modal-box">';
    html += '<button type="button" class="champ-captain-modal-close" onclick="ccCloseAdminForceModal()">✕</button>';
    html += '<div class="champ-captain-modal-title">👑 Admin Force</div>';
    html += '<div class="champ-captain-modal-sub">اختر خاصية لتفعيلها بدل القائد</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    
    chosen.forEach(function(moveId) {
        const move = (window.CS_MOVES_CONFIG || []).find(function(m) { return m.id === moveId; });
        if (!move) return;
        const alreadyUsed = ccLineupState.specialResults.myMoves[moveId];
        html += '<button type="button" class="cc-admin-force-option' + (alreadyUsed ? ' used' : '') + '" ';
        if (!alreadyUsed) {
            html += 'onclick="ccCloseAdminForceModal(); if(window.csOpenMoveModal) window.csOpenMoveModal(\'' + moveId + '\');"';
        } else {
            html += 'disabled';
        }
        html += '>';
        html += '<span style="font-size:18px;">' + (alreadyUsed ? '✓' : '▶') + '</span>';
        html += '<span>' + move.name + ' — ' + move.nameAr + '</span>';
        if (alreadyUsed) html += '<span style="font-size:11px;color:#10B981;">(مفعلة)</span>';
        html += '</button>';
    });
    
    html += '</div>';
    html += '</div>';
    
    modal.innerHTML = html;
    modal.classList.add('show');
}

function ccCloseAdminForceModal() {
    const modal = document.getElementById('ccAdminForceModal');
    if (modal) modal.classList.remove('show');
}

function ccRenderMatchupView(team, captainName) {
    const myLogo = ccGetTeamLogo(team);
    const myName = ccGetTeamName(team);
    const round = ccLineupState.round;

    const oppTeam = ccLineupState.opponentTeam;
    const oppLogo = ccGetTeamLogo(oppTeam);
    const oppName = ccGetTeamName(oppTeam);

    const myPoints = ccComputeLineupPoints(
        ccLineupState.effectiveSlots,
        ccLineupState.allManagers
    );
    const oppPoints = ccLineupState.opponentSelection
        ? ccComputeLineupPoints(
            ccLineupState.opponentSelection.starters,
            ccLineupState.opponentManagers
        )
        : 0;

    let html = '';
    html += '<div class="champ-captain-header">';
    html += '<button type="button" class="champ-captain-logout" ' +
        'onclick="champCaptainsLogout()">' +
        ccIcon('sign-out', 'bold') + ' EXIT</button>';
    html += '<div class="champ-captain-header-badge">' +
        ccIcon('sword', 'fill') + ' GW' + round + '</div>';
    html += '<div class="champ-captain-header-info">';
    html += '<div class="champ-captain-header-text">';
    html += '<div class="champ-captain-header-team">' +
        myName + ' vs ' + oppName + '</div>';
    html += '<div class="champ-captain-header-name">Captain: ' +
        ccEscapeAttr(captainName) + '</div>';
    html += '</div>';
    if (myLogo) {
        html += '<img src="./' + myLogo + '" ' +
            'onerror="this.style.display=\'none\'">';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="cc-matchup-score">';
    html += '<div class="cc-matchup-team">';
    if (myLogo) html += '<img src="./' + myLogo + '">';
    html += '<div class="cc-matchup-team-name">' + myName + '</div>';
    html += '<div class="cc-matchup-team-points">' + myPoints + '</div>';
    html += '</div>';
    html += '<div class="cc-matchup-vs">VS</div>';
    html += '<div class="cc-matchup-team">';
    if (oppLogo) html += '<img src="./' + oppLogo + '">';
    html += '<div class="cc-matchup-team-name">' + oppName + '</div>';
    html += '<div class="cc-matchup-team-points">' + oppPoints + '</div>';
    html += '</div>';
    html += '</div>';

    html += ccRenderSpecialDetails(ccLineupState.specialResults);
    html += ccRenderAdminForceAction();
    html += '<div id="ccLineupSpecialSlot" class="cc-lineup-special-slot"></div>';

    html += '<div class="champ-captains-admin-title" style="margin-top:12px;">';
    html += ccIcon('crown', 'fill') + ' تشكيلتك';
    html += '</div>';
    html += ccRenderPitch(ccLineupState.effectiveSlots, 'view', true);
    html += ccRenderBenchSection('view');

    if (ccLineupState.opponentSelection &&
        ccLineupState.opponentSelection.starters) {
        html += '<div class="champ-captains-admin-title" style="margin-top:20px;">';
        html += ccIcon('shield', 'fill') + ' تشكيلة ' + oppName;
        html += '</div>';
        html += ccRenderOpponentPitch(
            ccLineupState.opponentSelection.starters,
            ccLineupState.opponentManagers,
            oppTeam
        );
    }

    return html;
}

function ccRenderOpponentPitch(slots, managers, oppTeamCode) {
    let html = '<div class="tgc-pitch tgc-pitch-opponent">';
    html += '<div class="tgc-pitch-rows">';

    CC_PITCH_ROWS.forEach(function(row) {
        html += '<div class="tgc-pitch-row tgc-pitch-row-' + row.type + '">';
        row.slots.forEach(function(slotIdx) {
            html += ccRenderOppSlot(slotIdx, slots[slotIdx], managers, oppTeamCode);
        });
        html += '</div>';
    });

    html += '</div></div>';
    return html;
}

function ccRenderOppSlot(slotIdx, entry, managers, oppTeamCode) {
    const mgr = entry ? managers.find(function(m) { return Number(m.entry) === Number(entry); }) : null;
    const type = CC_SLOT_TYPES[slotIdx];

    let html = '<div class="cc-slot cc-slot-' + type +
        ' cc-slot-readonly cc-slot-opp' +
        (mgr ? ' cc-slot-filled' : ' cc-slot-empty') + '">';

    html += '<div class="cc-slot-shirt-box">';
    if (mgr) {
        const shirt = ccGetTeamShirt(oppTeamCode);
        if (shirt) {
            html += '<img class="cc-slot-shirt-img" src="./' + shirt + '" ' +
                'onerror="this.style.display=\'none\'" alt="">';
        }
    } else {
        html += '<div class="cc-slot-plus-shirt cc-slot-plus-hidden">' +
            ccIcon('lock', 'bold') + '</div>';
    }
    html += '</div>';

    html += '<div class="cc-slot-name-box">';
    if (mgr) {
        html += ccTwoNames(mgr);
    } else {
        html += '<div class="cc-slot-name cc-slot-name-empty">HIDDEN</div>';
    }
    html += '</div>';

    if (mgr && ccLineupState.scoresVisible) {
        html += '<div class="cc-slot-points-box">';
        html += '<div class="cc-slot-points">' +
            (mgr.lastPoints || 0) + ' pts</div>';
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function ccComputeLineupPoints(entries, managers) {
    if (!entries || entries.length === 0) return 0;
    if (!managers || !Array.isArray(managers)) return 0;
    let total = 0;
    entries.forEach(function(entry) {
        if (!entry) return;
        const m = managers.find(function(x) { return Number(x.entry) === Number(entry); });
        if (m) total += (m.lastPoints || 0);
    });
    return total;
}

function ccInjectSpecialSection() {
    const slot = document.getElementById('ccLineupSpecialSlot');
    if (!slot) return;

    if (typeof window.csRenderSpecialInline === 'function') {
        try {
            slot.innerHTML = window.csRenderSpecialInline();
        } catch (e) {
            console.warn('[Captains] Special inline failed:', e);
            slot.innerHTML = '';
        }
    } else {
        slot.innerHTML = '';
    }
}

function champCaptainsCloseModal() {
    const modal = document.getElementById('champCaptainsPinModal');
    if (modal) modal.classList.remove('show');
}

async function champCaptainsVerifyPin() {
    const input = document.getElementById('ccPinInput');
    const errEl = document.getElementById('ccPinError');
    const btn = document.getElementById('ccPinBtn');
    if (!input || !errEl) return;

    const pin = input.value.trim();
    if (pin.length !== 4) {
        errEl.textContent = 'الرمز لازم 4 أرقام';
        return;
    }

    errEl.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    const pendingTeam = champCaptains.pendingTeamCode;
    const expectedPin = CHAMP_CAPTAIN_PINS[pendingTeam];

    if (!expectedPin) {
        errEl.textContent = 'PIN غير متوفر لهذا النادي';
        if (btn) { btn.disabled = false; btn.textContent = 'دخول'; }
        return;
    }

    if (pin !== expectedPin) {
        errEl.textContent = 'الرمز غلط';
        if (btn) { btn.disabled = false; btn.textContent = 'دخول'; }
        if (input) input.value = '';
        return;
    }

    await ccLoadAllCaptains();
    const captainInfo = champCaptains.allCaptains[pendingTeam];
    const displayName = captainInfo && captainInfo.captain_name
        ? captainInfo.captain_name
        : 'Captain';

    champCaptains.currentTeam = pendingTeam;
    champCaptains.currentCaptainEntry = captainInfo ? captainInfo.captain_entry : null;
    champCaptains.currentCaptainName = displayName;
    champCaptains.pendingTeamCode = null;

    try {
        sessionStorage.setItem('champ_captain_team', pendingTeam);
        sessionStorage.setItem('champ_captain_entry',
            captainInfo ? String(captainInfo.captain_entry) : '');
        sessionStorage.setItem('champ_captain_name', displayName);
    } catch (e) {
        console.warn('[Captains] sessionStorage failed:', e);
    }

    if (typeof window.csResetState === 'function') {
        window.csResetState();
    }
    if (typeof window.csState !== 'undefined') {
        window.csState.team = pendingTeam;
        window.csState.captainName = displayName;
        window.csState.config = null;
        window.csState.configSelection = [];
        window.csState.savedMoves = {};
    }

    champCaptainsCloseModal();

    if (typeof showToast === 'function') {
        showToast('أهلاً ' + displayName, true, 2500);
    }

    ccLineupState.isEditing = false;
    ccLineupState.slots = [null, null, null, null, null, null, null];
    ccLineupState.benchSlots = [null, null];

    await champCaptainsRenderLineup();
}

function champCaptainsLogout() {
    ccStopAutoRefresh();

    champCaptains.currentTeam = null;
    champCaptains.currentCaptainEntry = null;
    champCaptains.currentCaptainName = null;
    champCaptains.pendingTeamCode = null;

    ccLineupState.slots = [null, null, null, null, null, null, null];
    ccLineupState.benchSlots = [null, null];
    ccLineupState.isEditing = false;
    ccLineupState.selection = null;

    document.body.classList.remove('cc-matchup-active');

    if (typeof window.csResetState === 'function') {
        window.csResetState();
    }

    try {
        sessionStorage.removeItem('champ_captain_team');
        sessionStorage.removeItem('champ_captain_entry');
        sessionStorage.removeItem('champ_captain_name');
    } catch (e) {
        console.warn('[Captains] sessionStorage clear failed:', e);
    }

    champCaptainsRenderLineup();
}

function champCaptainsRestoreSession() {
    try {
        const team = sessionStorage.getItem('champ_captain_team');
        const entry = sessionStorage.getItem('champ_captain_entry');
        const name = sessionStorage.getItem('champ_captain_name');

        if (team && entry) {
            champCaptains.currentTeam = team;
            champCaptains.currentCaptainEntry = parseInt(entry, 10);
            champCaptains.currentCaptainName = name;

            if (typeof window.csState !== 'undefined') {
                window.csState.team = team;
                window.csState.captainName = name;
            }
        }
    } catch (e) {
        console.warn('[Captains] restore failed:', e);
    }
}

function champCaptainsCleanup() {
    ccStopAutoRefresh();
    document.body.classList.remove('cc-matchup-active');
}

function champCaptainsRender() { return champCaptainsRenderLineup(); }
function champCaptainsShowPinDialog() { return ccSelectTeamForPin(); }

window.champCaptainsRender = champCaptainsRenderLineup;
window.champCaptainsRenderLineup = champCaptainsRenderLineup;
window.champCaptainsShowPinDialog = ccSelectTeamForPin;
window.champCaptainsVerifyPin = champCaptainsVerifyPin;
window.champCaptainsCloseModal = champCaptainsCloseModal;
window.champCaptainsLogout = champCaptainsLogout;
window.champCaptainsCleanup = champCaptainsCleanup;

window.champCaptainsOpenSlotPicker = champCaptainsOpenSlotPicker;
window.champCaptainsOpenBenchPicker = champCaptainsOpenBenchPicker;
window.champCaptainsCloseSlotPicker = champCaptainsCloseSlotPicker;
window.champCaptainsPickManagerForSlot = champCaptainsPickManagerForSlot;
window.champCaptainsRemoveFromSlot = champCaptainsRemoveFromSlot;
window.champCaptainsSaveLineup = champCaptainsSaveLineup;
window.champCaptainsClearLineup = champCaptainsClearLineup;
window.ccRemoveCard = ccRemoveCard;
window.ccRemoveBenchCard = ccRemoveBenchCard;
window.ccEditLineup = ccEditLineup;
window.ccSelectTeamForPin = ccSelectTeamForPin;
window.ccGetTeamShirt = ccGetTeamShirt;
window.ccAdminLoginToTeam = ccAdminLoginToTeam;
window.ccFindManagerByEntry = ccFindManagerByEntry;
window.ccCloseAdminForceModal = ccCloseAdminForceModal;
window.ccOpenAdminForceModal = ccOpenAdminForceModal;

window.CHAMP_CAPTAIN_PINS = CHAMP_CAPTAIN_PINS;
window.CC_TOTAL_SLOTS = CC_TOTAL_SLOTS;
window.CC_BENCH_SLOTS = CC_BENCH_SLOTS;

window.addEventListener('beforeunload', function() { ccStopAutoRefresh(); });

champCaptainsRestoreSession();

console.log('[Captains] champions-captains.js v=34 loaded — Detailed Clean Sheet Base');
