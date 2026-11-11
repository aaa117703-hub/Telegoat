/* =========================================================
   champions.js — TELEGOAT (ported from Finalissima) (v=59)
   🏆 كأس الأبطال
   ⭐ v50: إصلاح جذري لعرض المباراة للزوار (الشاشة الكاملة)
   ⭐ v59: قسم الفروقات (مقارنة لاعبي الـ11 الأساسيين بين الناديين، من الديدلاين حتى إنهاء الجولة)
   ⭐ v58: زر إنهاء الجولة (قفل) + شريط الجولات + تبويبا الناديين + ترتيب بشعارات + قرعة الإقصائيات المتحركة
   ⭐ v53: شاشة التشكيلة الكاملة (تشكيلة حقيقية + الخواص + زر رجوع) وصف مواجهات بسطر واحد
   ⭐ v52: إصلاح window.champData (كان undefined فيتعطل الحساب التلقائي)
   ⭐ v51: نقاط حية في المواجهات (أخضر = جارية، ذهبي = منتهية)
          + is_played يتبع انتهاء الجولة في FPL
========================================================= */

// ⭐ رابط الـ Worker (picks)
var CHAMP_PICKS_URL = 'https://fpl-api.aaa117703.workers.dev';
const CHAMP_GROUPS = ['A', 'B', 'C', 'D'];
const CHAMP_POT_SIZE = 4;
const CHAMP_TOTAL_GROUP_GWS = 5;
const CHAMP_AUTO_SCORE_INTERVAL = 5 * 60 * 1000;

const CHAMP_QF_PAIRS = [
    { homeGroup: 'A', homePos: 1, awayGroup: 'D', awayPos: 2 },
    { homeGroup: 'B', homePos: 1, awayGroup: 'C', awayPos: 2 },
    { homeGroup: 'C', homePos: 1, awayGroup: 'B', awayPos: 2 },
    { homeGroup: 'D', homePos: 1, awayGroup: 'A', awayPos: 2 }
];
function champQfLabel(i, side) {
    const p = CHAMP_QF_PAIRS[i];
    return side === 'h' ? (p.homeGroup + p.homePos) : (p.awayGroup + p.awayPos);
}

const CHAMP_SPECIAL_MOVES = {
    'revival':       { name: 'Revival',      nameAr: 'العودة من الموت', icon: 'heartbeat',    color: '#10B981' },
    'assassination': { name: 'Assassination',nameAr: 'الاغتيال',         icon: 'knife',        color: '#B8253F' },
    'h2h':           { name: 'Head-to-Head', nameAr: 'الهيد تو هيد',     icon: 'sword',        color: '#A78BFA' },
    'sniper':        { name: 'Mobilization', nameAr: 'الاستنفار العام',  icon: 'target',       color: '#A855F7' },
    'clean_sheet':   { name: 'Clean Sheet',  nameAr: 'رهان الصفر',       icon: 'shield-check', color: '#5CBFEB' }
};

var champData = { meta: null, draw: [], matches: [], pendingDraw: null, visibleRound: 1, deadlines: {} };
let champLoaded = false;
let champCurrentView = 'lineup';
let champSelectedRoundNum = null; // ⭐ v58: الجولة المختارة في شريط الجولات

let champAutoScoreTimer = null;
let champCountdownTimer = null;
let champBootstrapCache = null;
let champLastScoreUpdate = 0;

let champTeamViewState = {
    isOpen: false,
    teamCode: null,
    homeTeam: null,
    awayTeam: null,
    isDeadlinePassed: false,
    selection: null,
    config: null,
    activeMove: null,
    managers: [],
    gw: null,
    data: null
};

/* =========================================================
   1) Admin
========================================================= */

function isChampAdmin() {
    try { return typeof isAdmin === 'function' && isAdmin(); } catch (e) { return false; }
}

function setChampAdmin() {}

function clearChampAdmin() {}

window.isChampAdmin = isChampAdmin;
window.clearChampAdmin = clearChampAdmin;

function champSettingsToggleAdmin() {
    if (isChampAdmin()) {
        clearChampAdmin();
        if (typeof showToast === 'function') showToast('تم الخروج من وضع الأدمن', true, 2500);
    } else {
        setChampAdmin();
        if (typeof showToast === 'function') showToast('مرحباً بك كأدمن', true, 2500);
    }
    if (typeof openSettingsMain === 'function') openSettingsMain();
    champLoaded = false;
    loadChampions();
}
window.champSettingsToggleAdmin = champSettingsToggleAdmin;

/* =========================================================
   2) Helpers
========================================================= */

function xIcon(name, variant) {
    variant = variant || 'regular';
    const vc = variant === 'fill' ? 'ph-fill' :
               variant === 'bold' ? 'ph-bold' :
               variant === 'duotone' ? 'ph-duotone' : 'ph';
    return '<i class="' + vc + ' ph-' + name + '"></i>';
}
window.xIcon = xIcon;

function champGoToTab() {
    if (typeof switchTab === 'function') switchTab('cup');
}
window.champGoToTab = champGoToTab;

function champGetTeamName(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].name || code;
    }
    if (typeof teamsMap !== 'undefined') {
        const keys = Object.keys(teamsMap);
        const found = keys.find(function(k) { return k.toUpperCase() === String(code).toUpperCase(); });
        if (found && teamsMap[found]) return teamsMap[found].name;
    }
    return code || 'Unknown';
}
window.champGetTeamName = champGetTeamName;

function champGetTeamLogo(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].logo || '';
    }
    return '';
}
window.champGetTeamLogo = champGetTeamLogo;

function champGetTeamShirt(code) {
    const teamName = champGetTeamName(code);
    if (!teamName) return '';
    if (typeof window.TG_SHIRTS !== 'undefined' && window.TG_SHIRTS) {
        if (window.TG_SHIRTS[teamName]) return window.TG_SHIRTS[teamName];
        if (window.TG_SHIRTS[code]) return window.TG_SHIRTS[code];
    }
    return teamName.toLowerCase().replace(/\s+/g, '-') + '-shirt.png';
}
window.champGetTeamShirt = champGetTeamShirt;

function champShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}
window.champShuffle = champShuffle;

function champEscapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function champPad(n) {
    return (n < 10 ? '0' : '') + n;
}

// ⭐ v51: هل انتهت المباراة؟ (يدعم true/false و 1/0)
function champIsPlayedFlag(m) {
    if (!m) return false;
    return m.is_played === true || m.is_played === 1 ||
           m.is_played === 'true' || m.is_played === '1';
}

/* ⭐ v58: المباراة "مقفلة" = الأدمن أنهى الجولة (تُحتسب في الترتيب).
   إذا عمود is_locked غير موجود في الجدول نرجع لـ is_played كما كان. */
function champIsLocked(m) {
    if (!m) return false;
    if (m.is_locked === undefined) return champIsPlayedFlag(m);
    return m.is_locked === true || m.is_locked === 1 || m.is_locked === 'true';
}
window.champIsLocked = champIsLocked;

function champIsMatchFinished(m) {
    if (!m) return false;
    return champIsPlayedFlag(m) || (m.is_locked === true);
}
window.champIsMatchFinished = champIsMatchFinished;

/* =========================================================
   3) RESTORED: buildPots + champGenerateRandomDraw
========================================================= */

async function buildPots() {
    let sortedTeams = [];

    if (typeof calculateStandingsUpToRound === 'function') {
        try {
            const standings = await calculateStandingsUpToRound(38);
            if (standings && standings.length > 0) {
                sortedTeams = standings.map(function(s) {
                    return s.key || s.team;
                }).filter(function(t) { return t && t.length > 0; });
            }
        } catch (e) {}
    }

    if (sortedTeams.length === 0 && typeof teamsMap !== 'undefined') {
        sortedTeams = Object.keys(teamsMap);
    }

    if (sortedTeams.length === 0) return null;

    if (sortedTeams.length < 20 && typeof teamsMap !== 'undefined') {
        Object.keys(teamsMap).forEach(function(t) {
            if (sortedTeams.indexOf(t) === -1) sortedTeams.push(t);
        });
    }

    const pots = [[], [], [], [], []];
    sortedTeams.slice(0, 20).forEach(function(team, idx) {
        const potIdx = Math.floor(idx / CHAMP_POT_SIZE);
        if (potIdx < 5) pots[potIdx].push(team);
    });

    return pots;
}
window.buildPots = buildPots;

function champGenerateRandomDraw(pots) {
    const groups = { A: [], B: [], C: [], D: [] };
    const drawRows = [];

    pots.forEach(function(potTeams, potIdx) {
        const shuffledTeams = champShuffle(potTeams);
        const shuffledGroups = champShuffle(CHAMP_GROUPS.slice());

        for (let i = 0; i < shuffledTeams.length; i++) {
            const team = shuffledTeams[i];
            const groupLetter = shuffledGroups[i];
            groups[groupLetter].push(team);

            drawRows.push({
                pot_number: potIdx + 1,
                group_name: groupLetter,
                team: team,
                position: groups[groupLetter].length,
                slot_index: i
            });
        }
    });

    return drawRows;
}
window.champGenerateRandomDraw = champGenerateRandomDraw;

/* =========================================================
   4) Supabase — Load
========================================================= */

async function loadChampionsMeta() {
    if (!window.sbResults) return null;
    try {
        const { data, error } = await window.sbResults
            .from('tgc_meta').select('*').eq('id', 1).single();
        if (error) throw error;
        return data;
    } catch (e) { return null; }
}

async function loadChampionsDraw() {
    if (!window.sbResults) return [];
    try {
        const { data, error } = await window.sbResults
            .from('tgc_draw').select('*')
            .order('pot_number', { ascending: true })
            .order('group_name', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (e) { return []; }
}

async function loadChampionsMatches() {
    if (!window.sbResults) return [];
    try {
        const { data, error } = await window.sbResults
            .from('tgc_matches').select('*')
            .order('stage', { ascending: true })
            .order('round_num', { ascending: true })
            .order('id', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (e) { return []; }
}

async function loadAllGroupDeadlines(startGw) {
    const deadlines = {};
    if (typeof getDeadlineForRound !== 'function') return deadlines;

    for (let r = 1; r <= CHAMP_TOTAL_GROUP_GWS; r++) {
        const gw = startGw + r - 1;
        try {
            const di = await getDeadlineForRound(gw);
            if (di && di.deadlineMs > 0) {
                deadlines[r] = di.deadlineMs;
            }
        } catch (e) {}
    }
    return deadlines;
}

async function champGetVisibleRound() {
    const meta = champData.meta || {};
    const startGw = meta.start_gw || 8;

    let visible = meta.visible_gw || 1;
    if (visible < 1) visible = 1;
    if (visible > CHAMP_TOTAL_GROUP_GWS) visible = CHAMP_TOTAL_GROUP_GWS;

    if (visible < CHAMP_TOTAL_GROUP_GWS) {
        const nextGw = startGw + visible;
        try {
            if (typeof getDeadlineForRound === 'function') {
                const di = await getDeadlineForRound(nextGw);
                if (di && di.deadlineMs > 0) {
                    const hours = (di.deadlineMs - Date.now()) / (1000 * 60 * 60);
                    if (hours <= 48 && hours > -24) {
                        visible = visible + 1;
                        try {
                            await saveChampionsMeta({ visible_gw: visible });
                            if (champData.meta) champData.meta.visible_gw = visible;
                            console.log('[Champ] Auto-unlocked to GW' + nextGw);
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {
            console.warn('[Champ] auto-unlock check failed:', e);
        }
    }

    return visible;
}

/* =========================================================
   5) Supabase — Save
========================================================= */

async function saveChampionsMeta(updates) {
    if (!window.sbResults) return false;
    try {
        const payload = Object.assign({ id: 1, updated_at: new Date().toISOString() }, updates);
        const { error } = await window.sbResults
            .from('tgc_meta').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}
window.saveChampionsMeta = saveChampionsMeta;

async function saveChampionsDraw(rows) {
    if (!window.sbResults) return false;
    try {
        await window.sbResults.from('tgc_draw').delete().neq('id', 0);
        const cleanRows = rows.map(function(r) {
            return {
                pot_number: r.pot_number, group_name: r.group_name,
                team: r.team, position: r.position
            };
        });
        const { error } = await window.sbResults.from('tgc_draw').insert(cleanRows);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}
window.saveChampionsDraw = saveChampionsDraw;

async function saveChampionsMatches(rows) {
    if (!window.sbResults) return false;
    try {
        await window.sbResults.from('tgc_matches').delete().neq('id', 0);
        const cleanRows = rows.map(function(r) {
            return {
                stage: r.stage, group_name: r.group_name, round_num: r.round_num,
                gw: r.gw, home_team: r.home_team, away_team: r.away_team,
                home_score: r.home_score, away_score: r.away_score,
                winner: r.winner, is_played: r.is_played
            };
        });
        const { error } = await window.sbResults.from('tgc_matches').insert(cleanRows);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}
window.saveChampionsMatches = saveChampionsMatches;

async function updateChampionsMatch(id, updates) {
    if (!window.sbResults) return false;
    try {
        const payload = Object.assign({ updated_at: new Date().toISOString() }, updates);
        const { error } = await window.sbResults
            .from('tgc_matches').update(payload).eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { return false; }
}
window.updateChampionsMatch = updateChampionsMatch;

/* =========================================================
   6) Fetch Bootstrap
========================================================= */

async function champFetchBootstrap() {
    if (champBootstrapCache && (Date.now() - champLastScoreUpdate) < 60000) {
        return champBootstrapCache;
    }
    try {
        const url = 'https://fpl-api.aaa117703.workers.dev' + '/?type=bootstrap';
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        const bsd = (json && json.data && !Array.isArray(json.data)) ? json.data : json;
        if (bsd && bsd.events) {
            champBootstrapCache = bsd;
            return bsd;
        }
        return null;
    } catch (e) {
        console.warn('[Champ Auto] bootstrap fetch failed:', e);
        return null;
    }
}

async function champGetFplCurrentEvent() {
    const bootstrap = await champFetchBootstrap();
    if (!bootstrap || !bootstrap.events) return null;

    let current = bootstrap.events.find(function(e) { return e.is_current === true; });
    if (current) return current;

    let next = bootstrap.events.find(function(e) { return e.is_next === true; });
    if (next) return next;

    let past = bootstrap.events.slice().reverse().find(function(e) {
        return e.finished === true || e.is_previous === true;
    });
    return past || null;
}

/* =========================================================
   7) Load helpers
========================================================= */

async function loadAllConfigs() {
    if (!window.sbResults) return {};
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_config').select('*');
        if (error) throw error;
        const map = {};
        (data || []).forEach(function(row) { map[row.team] = row; });
        return map;
    } catch (e) { return {}; }
}

async function loadAllSelectionsForRound(round) {
    if (!window.sbResults) return {};
    try {
        const { data, error } = await window.sbResults
            .from('tgc_selections')
            .select('team, starters, bench, locked')
            .eq('round', round);
        if (error) throw error;
        const map = {};
        (data || []).forEach(function(row) { map[row.team] = row; });
        return map;
    } catch (e) { return {}; }
}

async function loadAllMovesForRound(round) {
    if (!window.sbResults) return [];
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_moves')
            .select('*')
            .eq('round', round);
        if (error) throw error;
        return data || [];
    } catch (e) { return []; }
}

/* =========================================================
   8) Calculate Team Score
========================================================= */

/* ⭐ v64: رهان الصفر أونلاين — نقاط حارس النادي × عدد مدافعيه عند كل مدير أساسي (من الفانتازي) */
var champLiveCache = {};
async function champGetLiveElements(gw) {
    const c = champLiveCache[gw];
    if (c && Date.now() - c.at < 60000) return c.v;
    const W = CHAMP_PICKS_URL;
    const r = await fetch(W + '/?type=live&gw=' + gw);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const live = (j && j.data && !Array.isArray(j.data)) ? j.data : j;
    const v = (live && live.elements) || [];
    champLiveCache[gw] = { at: Date.now(), v: v };
    return v;
}

async function champAutoCleanSheet(bet, starters, gw) {
    const bs = await champFetchBootstrap();
    const bsd = (bs && bs.data && !Array.isArray(bs.data)) ? bs.data : bs;
    const fplTeam = ((bsd && bsd.teams) || []).find(function(t) { return t.short_name === bet; });
    if (!fplTeam) return null;
    const defIds = {}; const gks = [];
    ((bsd && bsd.elements) || []).forEach(function(e) {
        if (e.team !== fplTeam.id) return;
        if (e.element_type === 2) defIds[e.id] = true;
        if (e.element_type === 1) gks.push(e);
    });
    let live = [];
    let liveErr = '';
    try { live = await champGetLiveElements(gw); } catch (e) { liveErr = (e && e.message) || String(e); }
    // الحارس: من لعب بالفعل (الأكثر دقائق)، وإلا حارس النادي الأساسي (الأكثر دقائق بالموسم) ونقاطه 0 حتى يلعب
    let gk = null, bestMin = 0;
    gks.forEach(function(g) {
        const el = live.find(function(x) { return x.id === g.id; });
        const mins = (el && el.stats && el.stats.minutes) || 0;
        if (mins > 0 && mins >= bestMin) { bestMin = mins; gk = { name: g.web_name, pts: el.stats.total_points || 0, played: true }; }
    });
    if (!gk && gks.length) {
        const first = gks.slice().sort(function(a, b) { return (b.minutes || 0) - (a.minutes || 0); })[0];
        gk = { name: first.web_name, pts: 0, played: false };
    }
    const rows = []; let failed = 0;
    const tasks = starters.filter(Boolean).map(function(entry) { return async function() {
        try {
            const picks = await champGetPicks(entry, gw);
            let n = 0;
            picks.forEach(function(p) { if (p.position <= 11 && defIds[p.element]) n++; });
            if (n > 0) rows.push({ entry: entry, count: n });
        } catch (e) { failed++; }
    }; });
    await champRunPool(tasks, 5);
    return { gk: gk, rows: rows, failed: failed, liveErr: liveErr };
}

async function champCalcTeamScore(team, opponent, gw, selections, moves, mgrMap) {
    const result = {
        base: 0, h2h: 0, cleanSheet: 0, total: 0,
        blockedEntries: [], h2hDetails: null, csDetails: null,
        effectiveStarters: [], promoted: []
    };

    const sel = selections[team];
    if (!sel || !Array.isArray(sel.starters)) return result;

    let starters = sel.starters.slice();
    const bench = (sel.bench || []).slice();
    result.effectiveStarters = starters.slice();

    const oppAssassin = moves.find(function(m) {
        return m.team === opponent && m.move_type === 'assassination';
    });

    if (oppAssassin && oppAssassin.move_data && oppAssassin.move_data.blocked_entries) {
        const blocked = oppAssassin.move_data.blocked_entries;

        for (const entry of blocked) {
            const idx = starters.indexOf(entry);
            if (idx === -1) continue;

            result.blockedEntries.push(entry);

            let replaced = false;
            for (let b = 0; b < bench.length; b++) {
                if (bench[b] !== null && bench[b] !== undefined && starters.indexOf(bench[b]) === -1) {
                    starters[idx] = bench[b];
                    result.promoted.push({ slot: idx, entry: bench[b] });
                    bench[b] = null;
                    replaced = true;
                    break;
                }
            }
            if (!replaced) starters[idx] = null;
        }
    }

    result.effectiveStarters = starters.slice();

    let baseScore = 0;
    starters.forEach(function(entry) {
        if (!entry) return;
        const mgr = mgrMap[entry];
        if (mgr) baseScore += (mgr.event_total || 0);
    });
    result.base = baseScore;

    const h2h = moves.find(function(m) { return m.team === team && m.move_type === 'h2h'; });
    if (h2h && h2h.move_data) {
        const myEntry = h2h.move_data.my_entry;
        const oppEntry = h2h.move_data.opponent_entry;
        const myMgr = mgrMap[myEntry];
        const oppMgr = mgrMap[oppEntry];

        if (myMgr && oppMgr) {
            const myPts = myMgr.event_total || 0;
            const oppPts = oppMgr.event_total || 0;
            result.h2hDetails = { myPts: myPts, oppPts: oppPts };

            if (myPts > oppPts) result.h2h = 30;
            else if (myPts < oppPts) result.h2h = -30;
            else result.h2h = 0;
        }
    }

    const cs = moves.find(function(m) { return m.team === team && m.move_type === 'clean_sheet'; });
    if (cs && cs.move_data) {
        const md = cs.move_data;
        const gk = parseInt(md.gk_pts, 10);
        const defs = md.manager_defs;
        if (defs && !isNaN(gk) && gk > 0) {
            // يدوي (أدمن): نقاط الحارس × عدد مدافعي الفريق عند كل مدير أساسي (بعد الاغتيال)
            const rows = [];
            let sum = 0;
            starters.forEach(function(entry) {
                if (!entry) return;
                const n = parseInt(defs[entry], 10) || 0;
                if (n > 0) { rows.push({ entry: entry, count: n, pts: n * gk }); sum += n * gk; }
            });
            result.cleanSheet = sum;
            result.csDetails = { bet_team: cs.target_team, gk_pts: gk, rows: rows, pts: sum };
        } else {
            const pts = parseInt(md.defenders_pts, 10);
            if (!isNaN(pts) && pts > 0) {
                result.cleanSheet = pts;
                result.csDetails = { bet_team: cs.target_team, pts: pts, rows: [] };
            }
        }
    }
    // تلقائي (أونلاين) عندما لا توجد قيم يدوية من الأدمن
    if (cs && !(result.cleanSheet > 0)) {
        const bet = cs.target_team || (cs.move_data && cs.move_data.bet_team);
        try {
            const auto = bet ? await champAutoCleanSheet(bet, starters, gw) : null;
            if (auto) {
                const gkp = auto.gk ? Math.max(0, auto.gk.pts) : 0;
                const rows = (gkp > 0) ? auto.rows.map(function(r) { return { entry: r.entry, count: r.count, pts: r.count * gkp }; }) : [];
                const sum = rows.reduce(function(a, r) { return a + r.pts; }, 0);
                result.cleanSheet = sum;
                result.csDetails = { bet_team: bet, gk_pts: gkp, gk_name: auto.gk ? auto.gk.name : '', auto: true,
                                     rows: rows, pts: sum, noGk: !auto.gk || !auto.gk.played, failed: auto.failed || 0,
                                     liveErr: auto.liveErr || '' };
            } else if (bet) {
                result.csDetails = { bet_team: bet, auto: true, rows: [], pts: 0, error: 'النادي غير موجود بقائمة الفانتازي' };
            }
        } catch (e) {
            console.warn('[Champ] auto clean sheet failed', e);
            result.csDetails = { bet_team: bet, auto: true, rows: [], pts: 0, error: (e && e.message) || String(e) };
        }
    }

    result.total = result.base + result.h2h + result.cleanSheet;
    return result;
}

/* =========================================================
   9) Auto Calculate
========================================================= */

async function champAutoCalculateScores() {
    if (!window.sbResults) return false;
    
    if (!window.champData || !window.champData.meta) {
        try {
            const [meta, draw, matches] = await Promise.all([
                loadChampionsMeta(),
                loadChampionsDraw(),
                loadChampionsMatches()
            ]);
            champData.meta = meta || { started: false };
            champData.draw = draw;
            champData.matches = matches;
        } catch (e) { return false; }
    }

    const meta = window.champData.meta;
    if (!meta || !meta.started) {
        console.warn('[Champ Auto] متوقف: champions_meta غير محمّل أو started != true', meta);
        return false;
    }

    const startGw = meta.start_gw || 8;

    const currentEvent = await champGetFplCurrentEvent();
    if (!currentEvent) return false;

    const fplGw = currentEvent.id;
    const isFinished = currentEvent.finished === true;

    if (fplGw < startGw) return false;

    const stage = meta.current_stage || 'groups';
    let champRoundNum = null;
    let champStage = null;

    if (stage === 'groups') {
        champRoundNum = fplGw - startGw + 1;
        if (champRoundNum < 1 || champRoundNum > CHAMP_TOTAL_GROUP_GWS) return false;
        champStage = 'groups';
    } else if (stage === 'qf' || stage === 'sf' || stage === 'final') {
        champStage = stage;
    } else return false;

    let managers = [];
    try {
        if (typeof tgcGetAllManagers === 'function') {
            managers = await tgcGetAllManagers(true);
        }
    } catch (e) { return false; }
    if (!managers || managers.length === 0) return false;

    const mgrMap = {};
    managers.forEach(function(m) { if (m.entry) mgrMap[m.entry] = m; });

    const selections = await loadAllSelectionsForRound(fplGw);
    const moves = await loadAllMovesForRound(fplGw);

    const matches = window.champData.matches.filter(function(m) {
        if (champStage === 'groups') {
            return m.stage === 'groups' && m.round_num === champRoundNum;
        }
        return m.stage === champStage;
    });

    if (matches.length === 0) return false;

    let updated = 0;
    for (const m of matches) {
        if (m.is_locked === true) continue; // ⭐ v58: الجولة المقفلة لا تتغير
        const homeResult = await champCalcTeamScore(m.home_team, m.away_team, fplGw, selections, moves, mgrMap);
        const awayResult = await champCalcTeamScore(m.away_team, m.home_team, fplGw, selections, moves, mgrMap);

        const homeScore = homeResult.total;
        const awayScore = awayResult.total;

        let winner = null;
        // ⭐ v51: false = الجولة جارية (نقاط حية) | true = الجولة انتهت رسمياً في FPL
        const isPlayed = isFinished === true;

        if (homeScore > awayScore) winner = m.home_team;
        else if (awayScore > homeScore) winner = m.away_team;
        else winner = 'draw';

        const homeEffects = {
            h2h: homeResult.h2h, clean_sheet: homeResult.cleanSheet,
            blocked: homeResult.blockedEntries,
            h2h_details: homeResult.h2hDetails, cs_details: homeResult.csDetails
        };

        const awayEffects = {
            h2h: awayResult.h2h, clean_sheet: awayResult.cleanSheet,
            blocked: awayResult.blockedEntries,
            h2h_details: awayResult.h2hDetails, cs_details: awayResult.csDetails
        };

        const needsUpdate =
            m.home_score !== homeScore || m.away_score !== awayScore ||
            m.winner !== winner || champIsMatchFinished(m) !== isPlayed || m.gw !== fplGw;

        if (!needsUpdate) continue;

        await updateChampionsMatch(m.id, {
            gw: fplGw, home_score: homeScore, away_score: awayScore,
            winner: winner, is_played: isPlayed,
            home_effects: homeEffects, away_effects: awayEffects
        });

        m.gw = fplGw;
        m.home_score = homeScore;
        m.away_score = awayScore;
        m.winner = winner;
        m.is_played = isPlayed;
        m.home_effects = homeEffects;
        m.away_effects = awayEffects;
        updated++;
    }

    return updated > 0;
}
window.champAutoCalculateScores = champAutoCalculateScores;

async function champRunAutoScore() {
    try {
        const updated = await champAutoCalculateScores();
        if (updated) {
            await champLoadSnipers();
            champLastScoreUpdate = Date.now();
            console.log('[Champ Auto] Scores updated:', new Date().toLocaleTimeString('ar-EG'));
            if (champCurrentView === 'matches' ||
                champCurrentView === 'standings' ||
                champCurrentView === 'lineup') {
                renderChampionsMain();
            }
        }
    } catch (e) {
        console.warn('[Champ Auto] run error:', e);
    }
}

function champStartAutoScore() {
    if (champAutoScoreTimer) return;
    console.log('[Champ Auto] Starting (every 5 min)');

    setTimeout(function() {
        if (!document.hidden) champRunAutoScore();
    }, 3000);

    champAutoScoreTimer = setInterval(function() {
        if (document.hidden) return;
        champRunAutoScore();
    }, CHAMP_AUTO_SCORE_INTERVAL);
}

function champStopAutoScore() {
    if (champAutoScoreTimer) {
        clearInterval(champAutoScoreTimer);
        champAutoScoreTimer = null;
    }
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden && champAutoScoreTimer) {
        const elapsed = Date.now() - champLastScoreUpdate;
        if (elapsed >= CHAMP_AUTO_SCORE_INTERVAL) champRunAutoScore();
    }
});

/* =========================================================
   10) Standings
========================================================= */

/* ⭐ v60: الاستنفار العام — فوز بالمباراة المُضاعفة = 6 نقاط، خسارة = −3 */
window.champSnipers = window.champSnipers || [];
async function champLoadSnipers() {
    if (!window.sbResults) return;
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_moves').select('round, team, target_team, move_type')
            .eq('move_type', 'sniper');
        if (!error && data) window.champSnipers = data;
    } catch (e) { console.warn('[Champ] snipers load failed', e); }
}
window.champLoadSnipers = champLoadSnipers;

function champHasSniper(team, opp, gw) {
    return (window.champSnipers || []).some(function(r) {
        return r.team === team && Number(r.round) === Number(gw) &&
               (!r.target_team || r.target_team === opp);
    });
}

function computeGroupStandings(draw, matches, groupName) {
    const teams = draw.filter(function(r) { return r.group_name === groupName; });
    const table = {};
    teams.forEach(function(t) {
        table[t.team] = {
            team: t.team, played: 0, won: 0, drawn: 0, lost: 0,
            gf: 0, ga: 0, gd: 0, points: 0
        };
    });

    const gMatches = matches.filter(function(m) {
        return m.stage === 'groups' && m.group_name === groupName && champIsLocked(m) &&
               m.home_score !== null && m.away_score !== null;
    });

    gMatches.forEach(function(m) {
        const h = table[m.home_team];
        const a = table[m.away_team];
        if (!h || !a) return;

        h.played++; a.played++;
        h.gf += m.home_score; h.ga += m.away_score;
        a.gf += m.away_score; a.ga += m.home_score;

        const hSn = champHasSniper(m.home_team, m.away_team, m.gw);
        const aSn = champHasSniper(m.away_team, m.home_team, m.gw);

        if (m.home_score > m.away_score) {
            h.won++; a.lost++;
            h.points += hSn ? 6 : 3;
            if (aSn) a.points -= 3;
        } else if (m.away_score > m.home_score) {
            a.won++; h.lost++;
            a.points += aSn ? 6 : 3;
            if (hSn) h.points -= 3;
        } else {
            h.drawn++; a.drawn++;
            h.points += 1; a.points += 1;
        }
    });

    Object.values(table).forEach(function(t) { t.gd = t.gf - t.ga; });

    return Object.values(table).sort(function(x, y) {
        if (y.points !== x.points) return y.points - x.points;
        if (y.gd !== x.gd) return y.gd - x.gd;
        if (y.gf !== x.gf) return y.gf - x.gf;
        return x.team.localeCompare(y.team);
    });
}
window.computeGroupStandings = computeGroupStandings;

/* =========================================================
   11) Build Knockout
========================================================= */

async function buildKnockoutStage(startGw, pairs) {
    const qfMatches = [];

    if (Array.isArray(pairs) && pairs.length === 4) {
        // ⭐ v58: قرعة عشوائية (أول المجموعة ضد ثاني مجموعة أخرى)
        pairs.forEach(function(p, idx) {
            qfMatches.push({
                stage: 'qf', group_name: null, round_num: idx + 1,
                gw: startGw, home_team: p.home, away_team: p.away,
                home_score: null, away_score: null, winner: null, is_played: false
            });
        });
    } else {
        const plan = champKnockoutPlan();
        if (!plan) return false;
        CHAMP_QF_PAIRS.forEach(function(pair, idx) {
            const homeTeam = pair.homePos === 1 ? plan.firsts[pair.homeGroup] : plan.seconds[pair.homeGroup];
            const awayTeam = pair.awayPos === 1 ? plan.firsts[pair.awayGroup] : plan.seconds[pair.awayGroup];
            if (!homeTeam || !awayTeam) return;
            qfMatches.push({
                stage: 'qf', group_name: null, round_num: idx + 1,
                gw: startGw, home_team: homeTeam, away_team: awayTeam,
                home_score: null, away_score: null, winner: null, is_played: false
            });
        });
    }

    if (qfMatches.length < 4) return false;

    try {
        const { error } = await window.sbResults.from('tgc_matches').insert(qfMatches);
        if (error) throw error;
        await saveChampionsMeta({ current_stage: 'qf', current_round: 1 });
        return true;
    } catch (e) { console.warn('[Champ] knockout insert failed:', e); return false; }
}
window.buildKnockoutStage = buildKnockoutStage;

async function checkAndBuildNextRound() {
    const matches = champData.matches;
    const stages = ['qf', 'sf', 'final'];

    for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const stageMatches = matches.filter(function(m) { return m.stage === stage; });
        if (stageMatches.length === 0) continue;

        const allPlayed = stageMatches.every(function(m) { return champIsLocked(m); });
        if (!allPlayed) continue;

        const nextStage = stages[i + 1];
        if (!nextStage) {
            const finalMatch = stageMatches[0];
            if (finalMatch && finalMatch.winner) {
                await saveChampionsMeta({ current_stage: 'done', champion: finalMatch.winner });
            }
            continue;
        }

        const nextMatches = matches.filter(function(m) { return m.stage === nextStage; });
        if (nextMatches.length > 0) continue;

        const winners = stageMatches.map(function(m) { return m.winner; });
        const gw = (stageMatches[0].gw || 0) + 1;
        const newMatches = [];

        if (nextStage === 'sf' && winners.length >= 4) {
            newMatches.push({
                stage: 'sf', group_name: null, round_num: 1, gw: gw,
                home_team: winners[0], away_team: winners[1],
                home_score: null, away_score: null, winner: null, is_played: false
            });
            newMatches.push({
                stage: 'sf', group_name: null, round_num: 2, gw: gw,
                home_team: winners[2], away_team: winners[3],
                home_score: null, away_score: null, winner: null, is_played: false
            });
        } else if (nextStage === 'final' && winners.length >= 2) {
            newMatches.push({
                stage: 'final', group_name: null, round_num: 1, gw: gw,
                home_team: winners[0], away_team: winners[1],
                home_score: null, away_score: null, winner: null, is_played: false
            });
        }

        if (newMatches.length > 0) {
            await window.sbResults.from('tgc_matches').insert(newMatches);
            await saveChampionsMeta({ current_stage: nextStage, current_round: 1 });
        }
    }
}

/* =========================================================
   12) Team View (⭐ v53: شاشة كاملة + التشكيلة الحقيقية + الخواص)
========================================================= */

const CTV_SLOT_TYPES  = ['gk', 'def', 'def', 'def', 'mid', 'mid', 'fwd'];
const CTV_SLOT_LABELS = ['GKP', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'FWD'];
const CTV_ROWS = [
    { type: 'gk',  slots: [0] },
    { type: 'def', slots: [1, 2, 3] },
    { type: 'mid', slots: [4, 5] },
    { type: 'fwd', slots: [6] }
];

const CTV_EPL_NAMES = {
    ARS: 'Arsenal', AVL: 'Aston Villa', BOU: 'Bournemouth', BRE: 'Brentford', BHA: 'Brighton', CHE: 'Chelsea', COV: 'Coventry', CRY: 'Crystal Palace', EVE: 'Everton', FUL: 'Fulham', HUL: 'Hull', IPS: 'Ipswich', LEE: 'Leeds', LIV: 'Liverpool', MCI: 'Man City', MUN: 'Man United', NEW: 'Newcastle', NFO: 'Nott\'m Forest', SUN: 'Sunderland', TOT: 'Spurs'
};

/* أيقونات SVG مخصصة (بدل الإيموجي) */
const CTV_SVG = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></svg>',
    kill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><path d="M9 9l6 6M15 9l-6 6" stroke-width="2.4"/></svg>',
    up:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11l6-6 6 6"/><path d="M6 19l6-6 6 6"/></svg>'
};

let champTvToken = 0;

function champEscapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* رقم الجولة (GW) لمباراة معيّنة */
function champMatchGw(m) {
    if (!m) return null;
    if (m.gw) return Number(m.gw);
    const startGw = (champData.meta && champData.meta.start_gw) || 8;
    if (m.stage === 'groups' && m.round_num) return startGw + m.round_num - 1;
    return null;
}
window.champMatchGw = champMatchGw;

function champFindMatch(home, away, gw) {
    const list = (champData && champData.matches) || [];
    let found = null;
    if (gw) {
        found = list.find(function(m) {
            return m.home_team === home && m.away_team === away && champMatchGw(m) === Number(gw);
        });
    }
    return found || list.find(function(m) {
        return m.home_team === home && m.away_team === away;
    }) || null;
}

/* اسم الفريق + اسم المدير (مثل الفانتازي) */
function champMgrTwo(entry, mgrMap) {
    const m = mgrMap && mgrMap[entry];
    if (m && m.entry_name && m.player_name && m.entry_name !== m.player_name) {
        return '<b>' + champEscapeHtml(m.entry_name) + '</b><i>' + champEscapeHtml(m.player_name) + '</i>';
    }
    return champEscapeHtml(champMgrName(entry, mgrMap));
}

function champMgrName(entry, mgrMap, fallback) {
    const m = mgrMap && mgrMap[entry];
    return (m && (m.player_name || m.entry_name)) || fallback || ('Player #' + entry);
}

function champTvShell(innerHtml, round) {
    return '<div class="ctv-topbar">' +
        '<button type="button" class="ctv-back" onclick="champCloseTeamView()">' +
            CTV_SVG.back + '<span>رجوع</span></button>' +
        '<div class="ctv-topbar-title">' + (round ? 'GW' + round : '') + '</div>' +
        '<div class="ctv-topbar-gap"></div>' +
        '</div>' +
        '<div class="ctv-scroll"><div class="ctv-inner">' + innerHtml + '</div></div>';
}

function champEnsureTeamViewModal() {
    let modal = document.getElementById('champTeamViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'champTeamViewModal';
        document.body.appendChild(modal);
    }
    modal.className = 'ctv';
    return modal;
}

async function champOpenTeamView(teamCode, homeTeam, awayTeam, gw) {
    if (!teamCode) return;
    const home = homeTeam || teamCode;
    const away = awayTeam || null;

    let round = parseInt(gw, 10);
    if (!round) {
        const mm = champFindMatch(home, away);
        round = (mm && champMatchGw(mm)) ||
            ((typeof currentRound !== 'undefined' && currentRound) ? currentRound :
                ((champData.meta && champData.meta.start_gw) || 8));
    }

    const token = ++champTvToken;
    champTeamViewState.isOpen = true;
    champTvSec = 'lineup';
    champTeamViewState.teamCode = teamCode;
    champTeamViewState.homeTeam = home;
    champTeamViewState.awayTeam = away;
    champTeamViewState.gw = round;
    champTeamViewState.data = null;

    const modal = champEnsureTeamViewModal();
    modal.innerHTML = champTvShell(
        '<div class="ctv-loading"><div class="ctv-spinner"></div><div>جاري التحميل...</div></div>', round);
    modal.classList.add('show');
    document.body.classList.add('champ-tv-open');

    try {
        let deadlineMs = 0;
        if (typeof getDeadlineForRound === 'function') {
            try {
                const di = await getDeadlineForRound(round);
                if (di) deadlineMs = di.deadlineMs;
            } catch (e) {}
        }
        const pastRound = (typeof currentRound !== 'undefined' && currentRound && round < currentRound);
        const passed = pastRound || (deadlineMs > 0 && Date.now() >= deadlineMs);
        champTeamViewState.isDeadlinePassed = passed;

        if (!passed && !isChampAdmin()) {
            if (token !== champTvToken) return;
            modal.innerHTML = champTvShell(
                '<div class="ctv-locked">' +
                '<div class="ctv-locked-ico">' + xIcon('lock', 'fill') + '</div>' +
                '<div class="ctv-locked-title">التشكيلة مخفية</div>' +
                '<div class="ctv-locked-sub">تظهر التشكيلات بعد الديدلاين</div></div>', round);
            return;
        }

        const results = await Promise.all([
            loadAllSelectionsForRound(round),
            loadAllMovesForRound(round),
            Promise.resolve().then(function() {
                return (typeof tgcGetAllManagers === 'function') ? tgcGetAllManagers() : [];
            }).catch(function() { return []; })
        ]);
        if (token !== champTvToken) return;

        const sels = results[0] || {};
        const moves = results[1] || [];
        const managers = results[2] || [];

        const mgrMap = {};
        managers.forEach(function(m) { if (m && m.entry) mgrMap[m.entry] = m; });

        const res = {};
        res[home] = await champCalcTeamScore(home, away, round, sels, moves, mgrMap);
        if (away) res[away] = await champCalcTeamScore(away, home, round, sels, moves, mgrMap);

        const match = champFindMatch(home, away, round);

        champTeamViewState.data = {
            round: round, sels: sels, moves: moves, mgrMap: mgrMap,
            res: res, match: match,
            finished: champIsMatchFinished(match)
        };
        champRenderTeamView();
    } catch (e) {
        console.warn('[Champ TV] load failed:', e);
        if (token !== champTvToken) return;
        modal.innerHTML = champTvShell(
            '<div class="ctv-empty">' + xIcon('warning-circle', 'duotone') +
            '<div>فشل التحميل</div></div>', round);
    }
}
window.champOpenTeamView = champOpenTeamView;

function champCloseTeamView() {
    champTvToken++;
    const modal = document.getElementById('champTeamViewModal');
    if (modal) modal.classList.remove('show');
    document.body.classList.remove('champ-tv-open');
    document.body.classList.remove('cc-matchup-active');
    champTeamViewState.isOpen = false;
}
window.champCloseTeamView = champCloseTeamView;

function champTvSwitch(team) {
    if (!team || !champTeamViewState.data) return;
    champTeamViewState.teamCode = team;
    champRenderTeamView();
}
window.champTvSwitch = champTvSwitch;

/* ---------- الشريط العلوي: اسم - نقاط - نقاط - اسم بسطر واحد ---------- */

function champTvTeamBlock(code, side, activeCode) {
    if (!code) return '<div class="ctv-sb-team ' + side + '"><span>—</span></div>';
    const logo = champGetTeamLogo(code);
    return '<div class="ctv-sb-team ' + side + (code === activeCode ? ' active' : '') +
        '">' +
        (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'" alt="">' : '') +
        '<span>' + champEscapeHtml(champGetTeamName(code)) + '</span></div>';
}

function champTvScoreboard(d, home, away, activeCode) {
    let hs = d.res[home] ? d.res[home].total : 0;
    let as = (away && d.res[away]) ? d.res[away].total : 0;
    const mt = d.match;
    if (mt && mt.home_score != null && mt.away_score != null) { hs = mt.home_score; as = mt.away_score; }
    const kind = d.finished ? 'gold' : 'live';

    let html = '<div class="ctv-sb ctv-sb-' + kind + '">';
    html += '<div class="ctv-sb-row">';
    html += champTvTeamBlock(home, 'home', activeCode);
    html += '<div class="ctv-sb-num"><b>' + hs + '</b><i>-</i><b>' + as + '</b></div>';
    html += champTvTeamBlock(away, 'away', activeCode);
    html += '</div>';
    html += '<div class="ctv-sb-foot">';
    html += '<span class="ctv-status ' + kind + '">' + (d.finished ? 'انتهت الجولة' : 'مباشر') + '</span>';
    html += '<span class="ctv-sb-hint">GW' + d.round + '</span>';
    html += '</div></div>';
    return html;
}

/* ---------- ⭐ v58: تبويبا الناديين + ملخص النقاط ---------- */

function champTvTab(code, role, d, activeCode) {
    if (!code) return '';
    const logo = champGetTeamLogo(code);
    const r = d.res[code];
    let pts = r ? r.total : 0;
    const mt = d.match;
    if (mt && mt.home_score != null && mt.away_score != null) {
        pts = (code === mt.home_team) ? mt.home_score : mt.away_score;
    }
    return '<button type="button" class="ctv-tab' + (code === activeCode ? ' active' : '') +
        '" onclick="champTvSwitch(\'' + code + '\')">' +
        '<span class="ctv-tab-role">' + role + '</span>' +
        '<span class="ctv-tab-main">' +
        (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'" alt="">' : '') +
        '<span class="ctv-tab-name">' + champEscapeHtml(champGetTeamName(code)) + '</span></span>' +
        '<span class="ctv-tab-pts">' + pts + '</span></button>';
}

function champTvTabs(d, home, away, active) {
    return '<div class="ctv-tabs">' + champTvTab(home, 'المضيف', d, active) +
        (away ? champTvTab(away, 'المستضيف', d, active) : '') + '</div>';
}

function champTvSummary(res) {
    const special = (res.h2h || 0) + (res.cleanSheet || 0);
    const sign = special > 0 ? '+' : '';
    return '<div class="ctv-sum">' +
        '<div class="ctv-sum-tile main"><span>النقاط الحالية</span><b>' + res.total + '</b></div>' +
        '<div class="ctv-sum-tile"><span>بدون الخاصية</span><b>' + res.base + '</b></div>' +
        '<div class="ctv-sum-tile ' + (special > 0 ? 'pos' : special < 0 ? 'neg' : '') + '"><span>نقاط الخاصية</span><b>' +
        sign + special + '</b></div></div>';
}

/* ---------- الملعب ---------- */

function champTvSlot(slotIdx, entry, d, shirt, promotedEntry, isDead) {
    const type = CTV_SLOT_TYPES[slotIdx];
    const mgr = entry ? d.mgrMap[entry] : null;
    const promoted = promotedEntry != null;

    let html = '<div class="ctv-slot ctv-' + type + (entry ? '' : ' ctv-slot-empty') +
        (promoted ? ' ctv-slot-promoted' : '') + (isDead ? ' ctv-slot-dead' : '') + '">';
    html += '<div class="ctv-slot-label">' + CTV_SLOT_LABELS[slotIdx] + '</div>';
    html += '<div class="ctv-shirt">';
    if (entry && shirt) html += '<img src="./' + shirt + '" onerror="this.style.display=\'none\'" alt="">';
    if (promoted) html += '<span class="ctv-badge ctv-badge-up" title="صعد من الدكة">' + CTV_SVG.up + '</span>';
    if (isDead) html += '<span class="ctv-badge ctv-badge-kill" title="مغتال — نقاطه لا تُحتسب">' + CTV_SVG.kill + '</span>';
    html += '</div>';
    if (entry) {
        html += '<div class="ctv-slot-name ctv-two">' + champMgrTwo(entry, d.mgrMap) + '</div>';
        html += '<div class="ctv-slot-pts">' + (mgr ? (mgr.event_total || 0) : 0) + '</div>';
    } else {
        html += '<div class="ctv-slot-name ctv-dim">—</div>';
    }
    html += '</div>';
    return html;
}

function champTvPitch(res, d, team) {
    const shirt = champGetTeamShirt(team);
    const eff = (res.effectiveStarters && res.effectiveStarters.length) ? res.effectiveStarters : [];
    const promotedBySlot = {};
    (res.promoted || []).forEach(function(p) { promotedBySlot[p.slot] = p.entry; });
    // ⭐ v61: المغتالون يبقون في مكانهم بنقاطهم (غير محتسبة) ويصعد البديل في الدكة
    const origSel = d.sels && d.sels[team];
    const orig = (origSel && Array.isArray(origSel.starters)) ? origSel.starters : [];
    const killedSet = {};
    (res.blockedEntries || []).forEach(function(e) { killedSet[e] = true; });

    let html = '<div class="ctv-pitch"><div class="ctv-pitch-rows">';
    CTV_ROWS.forEach(function(row) {
        html += '<div class="ctv-row ctv-row-' + row.type + '">';
        row.slots.forEach(function(idx) {
            html += champTvSlot(idx, eff[idx], d, shirt, promotedBySlot[idx]);
        });
        html += '</div>';
    });
    html += '</div></div>';
    return html;
}

/* ---------- تفصيل النقاط ---------- */

function champTvBreakdown(res, hasH2h, hasCs) {
    let html = '<div class="ctv-bd">';
    html += '<div class="ctv-bd-row"><span>مجموع الأساسيين</span><b>' + res.base + '</b></div>';
    if (hasH2h) {
        const v = res.h2h;
        html += '<div class="ctv-bd-row"><span>الهيد تو هيد</span><b class="' +
            (v > 0 ? 'pos' : v < 0 ? 'neg' : '') + '">' + (v > 0 ? '+' : '') + v + '</b></div>';
    }
    if (hasCs) {
        html += '<div class="ctv-bd-row"><span>رهان الصفر</span><b class="' +
            (res.cleanSheet > 0 ? 'pos' : '') + '">' + (res.cleanSheet > 0 ? '+' : '') + res.cleanSheet + '</b></div>';
    }
    html += '<div class="ctv-bd-row ctv-bd-total"><span>الإجمالي</span><b>' + res.total + '</b></div>';
    html += '</div>';
    return html;
}

/* ---------- الدكة (المغتالون + الاحتياط) ---------- */

function champTvBenchCard(entry, d, shirt, kind) {
    const mgr = d.mgrMap[entry];
    const pts = mgr ? (mgr.event_total || 0) : 0;
    const tag = kind === 'dead' ? 'مغتال — لا يُحتسب' : kind === 'promoted' ? 'بديل المغتال' : 'احتياط';

    let html = '<div class="ctv-bcard ctv-bcard-' + kind + '">';
    html += '<div class="ctv-shirt">';
    if (shirt) html += '<img src="./' + shirt + '" onerror="this.style.display=\'none\'" alt="">';
    if (kind === 'dead') html += '<span class="ctv-badge ctv-badge-kill" title="مغتال">' + CTV_SVG.kill + '</span>';
    if (kind === 'promoted') html += '<span class="ctv-badge ctv-badge-up">' + CTV_SVG.up + '</span>';
    html += '</div>';
    html += '<div class="ctv-bcard-name ctv-two">' + champMgrTwo(entry, d.mgrMap) + '</div>';
    html += '<div class="ctv-bcard-tag">' + tag + '</div>';
    html += '<div class="ctv-bcard-pts">' + pts + '</div>';
    html += '</div>';
    return html;
}

function champTvBench(res, sel, d, team) {
    const shirt = champGetTeamShirt(team);
    const killed = res.blockedEntries || [];
    const promotedEntries = (res.promoted || []).map(function(p) { return p.entry; });
    const bench = ((sel && sel.bench) || []).filter(function(e) { return e !== null && e !== undefined; });

    let cards = '';
    killed.forEach(function(e) { cards += champTvBenchCard(e, d, shirt, 'dead'); });
    bench.forEach(function(e) {
        cards += champTvBenchCard(e, d, shirt, promotedEntries.indexOf(e) !== -1 ? 'promoted' : 'bench');
    });

    if (!cards) return '';
    return '<div class="ctv-section-title">الدكة</div><div class="ctv-bench">' + cards + '</div>';
}

/* ---------- الخواص ---------- */

function champTvChip(text, kind) {
    return '<span class="ctv-chip ' + kind + '">' + text + '</span>';
}

function champTvCard(color, iconHtml, title, chipHtml, bodyHtml) {
    return '<div class="ctv-sp" style="--c:' + color + '">' +
        '<div class="ctv-sp-head"><span class="ctv-sp-ico">' + iconHtml + '</span>' +
        '<span class="ctv-sp-title">' + title + '</span>' + (chipHtml || '') + '</div>' +
        '<div class="ctv-sp-body">' + bodyHtml + '</div></div>';
}

/* =========================================================
   ⭐ v59: الفروقات — مقارنة لاعبي الـ11 الأساسيين لمدراء الناديين
   تظهر بعد الديدلاين وتختفي عند إنهاء الجولة (is_locked)
========================================================= */

var CHAMP_DIFF_HIDE_AFTER_LOCK = true;
var champPicksCache = {};

/* تشغيل مهام بعدد متوازي محدود (FPL يرفض الطلبات الكثيرة دفعة واحدة) */
async function champRunPool(tasks, n) {
    let i = 0;
    const workers = [];
    for (let k = 0; k < (n || 5); k++) {
        workers.push((async function() {
            while (i < tasks.length) { const t = tasks[i++]; await t(); }
        })());
    }
    await Promise.all(workers);
}

async function champGetPicks(entry, gw) {
    const key = entry + '_' + gw;
    if (champPicksCache[key]) return champPicksCache[key];
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const r = await fetch(CHAMP_PICKS_URL + '/?type=picks&entry=' + entry + '&gw=' + gw);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json();
            const pk = (j && j.data && !Array.isArray(j.data)) ? j.data : j;
            if (!pk || !Array.isArray(pk.picks)) throw new Error('no picks');
            champPicksCache[key] = pk.picks;
            return pk.picks;
        } catch (e) {
            lastErr = e;
            await new Promise(function(res) { setTimeout(res, 500 * (attempt + 1)); });
        }
    }
    throw lastErr;
}

function champTvDiffVisible(d, home, away) {
    const st = champTeamViewState;
    if (!d || !away || !st.isDeadlinePassed) return false;
    if (CHAMP_DIFF_HIDE_AFTER_LOCK && d.match && d.match.is_locked === true) return false;
    const a = d.sels[home], b = d.sels[away];
    return !!(a && Array.isArray(a.starters) && a.starters.some(Boolean) &&
              b && Array.isArray(b.starters) && b.starters.some(Boolean));
}

async function champTvComputeDiff(d, home, away, gw) {
    const bs = await champFetchBootstrap();
    const bsd = (bs && bs.data && !Array.isArray(bs.data)) ? bs.data : bs;
    const clubs = {}, players = {};
    const clubCodes = {};
    ((bsd && bsd.teams) || []).forEach(function(t) { clubs[t.id] = t.short_name; clubCodes[t.id] = t.code; });
    ((bsd && bsd.elements) || []).forEach(function(e) {
        players[e.id] = { name: e.web_name, type: e.element_type, club: clubs[e.team] || '', code: clubCodes[e.team] || '' };
    });

    const counts = {}; counts[home] = {}; counts[away] = {};
    let total = 0, failed = 0, lastErr = '';
    const jobs = [];
    [home, away].forEach(function(t) {
        (d.sels[t].starters || []).forEach(function(entry) {
            if (!entry) return;
            total++;
            jobs.push(function() { return champGetPicks(entry, gw).then(function(picks) {
                picks.forEach(function(p) {
                    if (p.position <= 11) counts[t][p.element] = (counts[t][p.element] || 0) + 1;
                });
            }).catch(function(e) { failed++; lastErr = (e && e.message) || String(e); }); });
        });
    });
    await champRunPool(jobs, 5);
    if (total === 0 || failed === total) {
        throw new Error('تعذر جلب تشكيلات المدراء من الفانتازي' + (lastErr ? ' (' + lastErr + ')' : '') +
            (/no picks|Failed to fetch|HTTP 4|HTTP 5/.test(lastErr || '') ? ' — تأكد أن الـ Worker محدّث (النسخة 3.1)' : ''));
    }

    const ids = {};
    Object.keys(counts[home]).forEach(function(k) { ids[k] = true; });
    Object.keys(counts[away]).forEach(function(k) { ids[k] = true; });
    const rows = Object.keys(ids).map(function(id) {
        const a = counts[home][id] || 0, b = counts[away][id] || 0;
        const p = players[id] || { name: 'Player ' + id, type: 9, club: '', code: '' };
        return { id: id, name: p.name, club: p.club, code: p.code, type: p.type, a: a, b: b, diff: a - b };
    });
    const sorter = function(x, y) {
        return (Math.abs(y.diff) - Math.abs(x.diff)) || (x.type - y.type) || x.name.localeCompare(y.name);
    };
    return {
        homeRows: rows.filter(function(r) { return r.diff > 0; }).sort(sorter),
        awayRows: rows.filter(function(r) { return r.diff < 0; }).sort(sorter),
        tieRows: rows.filter(function(r) { return r.diff === 0; }).sort(function(x, y) {
            return (y.a - x.a) || (x.type - y.type) || x.name.localeCompare(y.name);
        }),
        failed: failed
    };
}

function champTvDiffSection(d, home, away) {
    if (!champTvDiffVisible(d, home, away)) {
        const st = champTeamViewState;
        let why = 'الفروقات تظهر بعد الديدلاين وقبل إنهاء الجولة';
        if (st.isDeadlinePassed && d.match && d.match.is_locked === true) why = 'الجولة منتهية، الفروقات تظهر فقط خلال الجولة';
        else if (st.isDeadlinePassed) why = 'لازم الطرفين يكون عندهم تشكيلة محفوظة حتى تظهر الفروقات';
        return '<div class="ctv-empty">' + xIcon('clock', 'duotone') + '<div>' + why + '</div></div>';
    }
    return '<div id="ctvDiffBox">' + champTvDiffInner(d, home, away) + '</div>';
}

function champTvDiffChip(r, sign) {
    const n = Math.abs(r.diff);
    const val = sign === 0 ? '0' : '+' + n;
    const cnt = sign === -1 ? r.b + '–' + r.a : r.a + '–' + r.b;
    const badge = r.code ? '<img class="ctv-dlogo" loading="lazy" src="https://resources.premierleague.com/premierleague/badges/50/t' + r.code + '.png" onerror="this.style.display=\'none\'" alt="">' : '';
    return '<span class="ctv-dchip ' + (sign === 0 ? 'tie' : 'win') + '">' + badge +
        '<b>' + champEscapeHtml(r.name) + '</b>' +
        '<i>' + cnt + '</i><em>' + val + '</em></span>';
}

function champTvDiffCol(code, rows, sign) {
    const logo = champGetTeamLogo(code);
    let h = '<div class="ctv-dcol"><div class="ctv-dcol-head">' +
        (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'" alt="">' : '') +
        '<span>' + champEscapeHtml(champGetTeamName(code)) + '</span><u>' + rows.length + '</u></div>';
    if (rows.length === 0) h += '<div class="ctv-dempty">لا فروقات</div>';
    else h += '<div class="ctv-dlist">' + rows.map(function(r) { return champTvDiffChip(r, sign); }).join('') + '</div>';
    return h + '</div>';
}

function champTvDiffInner(d, home, away) {
    const ico = xIcon('arrows-left-right', 'bold');
    const st = d.diffState;
    if (!st || st.loading) {
        return champTvCard('#5CBFEB', ico, 'الفروقات', '',
            '<div class="ctv-dnote">جاري حساب الفروقات من الفانتازي...</div>');
    }
    if (st.error) {
        return champTvCard('#F0506E', ico, 'الفروقات', '',
            '<div class="ctv-dnote bad">' + champEscapeHtml(st.error) +
            '</div><button type="button" class="ctv-dretry" onclick="champTvRetryDiff()">إعادة المحاولة</button>');
    }
    const n = st.homeRows.length + st.awayRows.length;
    let body = '<div class="ctv-dhint">اللاعب يظهر تحت النادي الذي يملكه عدد أكبر من مدرائه (الـ11 الأساسيين)، والرقم الصغير = عدد المدراء عند كل نادي</div>';
    body += '<div class="ctv-dcols">' + champTvDiffCol(home, st.homeRows, 1) + champTvDiffCol(away, st.awayRows, -1) + '</div>';
    if (st.tieRows.length) {
        body += '<div class="ctv-dties"><div class="ctv-dties-title">متعادلون <u>' + st.tieRows.length + '</u></div>' +
            '<div class="ctv-dlist">' + st.tieRows.map(function(r) { return champTvDiffChip(r, 0); }).join('') + '</div></div>';
    }
    if (st.failed) body += '<div class="ctv-dnote bad">تعذر جلب ' + st.failed + ' مدير، النتيجة ناقصة</div>';
    return champTvCard('#5CBFEB', ico, 'الفروقات', champTvChip(n + ' لاعب فارق', 'gold'), body);
}

function champTvEnsureDiff() {
    const st = champTeamViewState, d = st.data;
    if (!d || !st.isOpen) return;
    const home = st.homeTeam, away = st.awayTeam;
    if (!champTvDiffVisible(d, home, away) || d.diffState) return;
    d.diffState = { loading: true };
    const token = champTvToken;
    champTvComputeDiff(d, home, away, d.round)
        .then(function(r) { d.diffState = r; })
        .catch(function(e) { d.diffState = { error: String((e && e.message) || e) }; })
        .then(function() {
            if (token !== champTvToken || !st.isOpen) return;
            const box = document.getElementById('ctvDiffBox');
            if (box) box.innerHTML = champTvDiffInner(d, home, away);
        });
}

function champTvRetryDiff() {
    const d = champTeamViewState.data;
    if (!d) return;
    d.diffState = null;
    const box = document.getElementById('ctvDiffBox');
    if (box) box.innerHTML = champTvDiffInner(d, champTeamViewState.homeTeam, champTeamViewState.awayTeam);
    champTvEnsureDiff();
}
window.champTvRetryDiff = champTvRetryDiff;

function champTvAssassinWhatIf(victim, attacker, d) {
    const vr = d.res[victim], ar = d.res[attacker];
    if (!vr || !ar) return null;
    const pt = function(e) { const m = d.mgrMap[e]; return m ? (m.event_total || 0) : 0; };
    const killed = (vr.blockedEntries || []).map(function(e) { return { entry: e, pts: pt(e) }; });
    const promoted = (vr.promoted || []).map(function(p) { return { entry: p.entry, pts: pt(p.entry) }; });
    const kSum = killed.reduce(function(a, x) { return a + x.pts; }, 0);
    const pSum = promoted.reduce(function(a, x) { return a + x.pts; }, 0);
    const without = vr.total + kSum - pSum;
    const cmp = function(a, b) { return a > b ? 1 : a < b ? -1 : 0; };
    const actual = cmp(ar.total, vr.total), alt = cmp(ar.total, without);
    let verdict;
    if (!killed.length) verdict = 'miss';
    else if (actual > alt) verdict = 'success';
    else if (without > vr.total) verdict = 'weak';
    else verdict = 'fail';
    return { killed: killed, promoted: promoted, kSum: kSum, pSum: pSum, without: without,
             victimTotal: vr.total, attackerTotal: ar.total, verdict: verdict };
}

function champTvWhatIfHtml(w, attackerName, victimName) {
    if (!w || !w.killed.length) return '';
    const names = { success: 'نجح الاغتيال وغيّر النتيجة', weak: 'أضعف الخصم لكن النتيجة ما تغيّرت', fail: 'فشل الاغتيال' };
    let h = '<div class="ctv-wi"><div class="ctv-wi-title">لو بقي المغتالون</div>';
    h += '<div class="ctv-wi-row"><span>نقاط المغتالين</span><b>' + w.kSum + '</b></div>';
    h += '<div class="ctv-wi-row"><span>نقاط البدلاء</span><b>' + w.pSum + '</b></div>';
    h += '<div class="ctv-wi-row"><span>' + champEscapeHtml(victimName) + ' بدون اغتيال</span><b>' + w.without + '</b></div>';
    h += '<div class="ctv-wi-row"><span>' + champEscapeHtml(victimName) + ' الحالية</span><b>' + w.victimTotal + '</b></div>';
    h += '<div class="ctv-wi-verdict ' + w.verdict + '">' + names[w.verdict] + '</div></div>';
    return h;
}

function champTvSpecials(team, opp, res, d) {
    const myMoves = d.moves.filter(function(m) { return m.team === team; });
    const oppMoves = opp ? d.moves.filter(function(m) { return m.team === opp; }) : [];
    const find = function(list, type) {
        return list.find(function(m) { return m.move_type === type; }) || null;
    };
    const oppName = opp ? champEscapeHtml(champGetTeamName(opp)) : '';

    let html = '';

    /* رهان الصفر */
    const cs = find(myMoves, 'clean_sheet');
    if (cs) {
        const bet = cs.target_team || (cs.move_data && cs.move_data.bet_team) || '?';
        const betName = champEscapeHtml(CTV_EPL_NAMES[bet] || bet);
        const pts = res.cleanSheet || 0;
        const det = res.csDetails;
        let body = '<div class="ctv-line">الرهان على <b>' + betName + '</b>' +
            (det && det.gk_name ? ' · الحارس <b>' + champEscapeHtml(det.gk_name) + '</b>' : '') +
            (det && det.gk_name ? ' · نقاطه <b>' + (det.gk_pts || 0) + '</b>' : (det && det.gk_pts ? ' · نقاطه <b>' + det.gk_pts + '</b>' : '')) + (det && det.auto ? ' <span class="ctv-live-dot">لايف</span>' : '') + '</div>';
        if (det && det.rows && det.rows.length) {
            det.rows.forEach(function(r) {
                body += '<div class="ctv-target hit ctv-cs-row"><span class="ctv-target-name">' +
                    champEscapeHtml(champMgrName(r.entry, d.mgrMap)) + '</span>' +
                    '<span class="ctv-cs-n">' + r.count + ' مدافع × ' + det.gk_pts + '</span>' +
                    '<span class="ctv-cs-p">+' + r.pts + '</span></div>';
            });
        } else {
            body += '<div class="ctv-line ctv-dim">' + (pts > 0
                ? 'نقاط الرهان أُضيفت للنادي'
                : (det && det.error ? 'تعذر حساب الرهان لايف: ' + champEscapeHtml(det.error)
                   : (det && det.liveErr ? 'تعذر جلب نقاط الحارس لايف: ' + champEscapeHtml(det.liveErr)
                   : (det && det.auto && det.gk_pts > 0 ? 'لا يوجد مدافعون من هذا النادي عند المديرين الأساسيين'
                   : (det && det.noGk ? 'الحارس لم يلعب بعد — تتحدث النقاط لايف مع المباراة' : (det && det.auto ? 'نقاط الحارس صفر أو سلبية — لا نقاط من الرهان' : 'لم تُحتسب نقاط من الرهان بعد')))))) + '</div>';
        }
        if (isChampAdmin()) {
            body += '<button type="button" class="ctv-admin-btn" onclick="champTvCsEdit(\'' + team + '\')">' +
                'تعديل نقاط رهان الصفر (أدمن)</button>';
        }
        html += champTvCard(CHAMP_SPECIAL_MOVES.clean_sheet.color,
            xIcon('shield-check', 'fill'), 'رهان الصفر',
            champTvChip(pts > 0 ? '+' + pts : '0', pts > 0 ? 'green' : 'gray'), body);
    }

    /* الهيد تو هيد */
    const h2h = find(myMoves, 'h2h');
    if (h2h) {
        const md = h2h.move_data || {};
        const my = d.mgrMap[md.my_entry];
        const op = d.mgrMap[md.opponent_entry];
        const myPts = my ? (my.event_total || 0) : 0;
        const opPts = op ? (op.event_total || 0) : 0;
        const chip = myPts > opPts ? champTvChip('فوز +30', 'green')
                   : myPts < opPts ? champTvChip('خسارة −30', 'red')
                   : champTvChip('تعادل', 'gray');
        html += champTvCard(CHAMP_SPECIAL_MOVES.h2h.color,
            xIcon('sword', 'fill'), 'الهيد تو هيد', chip,
            '<div class="ctv-vs">' +
                '<div class="ctv-vs-side' + (myPts > opPts ? ' win' : '') + '">' +
                    '<div class="ctv-vs-name">' + champEscapeHtml(md.my_name || champMgrName(md.my_entry, d.mgrMap)) + '</div>' +
                    '<div class="ctv-vs-pts">' + myPts + '</div></div>' +
                '<div class="ctv-vs-mid">VS</div>' +
                '<div class="ctv-vs-side' + (opPts > myPts ? ' win' : '') + '">' +
                    '<div class="ctv-vs-name">' + champEscapeHtml(md.opponent_name || champMgrName(md.opponent_entry, d.mgrMap)) + '</div>' +
                    '<div class="ctv-vs-pts">' + opPts + '</div></div>' +
            '</div>');
    }

    /* الاغتيال (من هذا الفريق) */
    const asn = find(myMoves, 'assassination');
    if (asn) {
        const targets = (asn.move_data && asn.move_data.blocked_entries) || [];
        const oppSel = opp ? d.sels[opp] : null;
        const oppStarters = (oppSel && oppSel.starters) || [];
        let hits = 0;
        let rows = '';
        targets.forEach(function(e) {
            const hit = oppStarters.indexOf(e) !== -1;
            if (hit) hits++;
            rows += '<div class="ctv-target ' + (hit ? 'hit' : 'miss') + '">' +
                '<span class="ctv-target-ico">' + CTV_SVG.kill + '</span>' +
                '<span class="ctv-target-name">' + champEscapeHtml(champMgrName(e, d.mgrMap)) + '</span>' +
                '<span class="ctv-target-tag">' + (hit ? 'اغتيل' : 'لم يكن أساسياً') + '</span></div>';
        });
        const wi = champTvAssassinWhatIf(opp, team, d);
        const chipTxt = !wi ? (hits > 0 ? 'نجح ' + hits + '/' + targets.length : 'فشل')
            : wi.verdict === 'success' ? 'نجح' : wi.verdict === 'weak' ? 'أثّر' : 'فشل';
        const chipKind = (wi && (wi.verdict === 'success' || wi.verdict === 'weak')) || (!wi && hits > 0) ? 'red' : 'gray';
        html += champTvCard(CHAMP_SPECIAL_MOVES.assassination.color,
            CTV_SVG.kill, 'الاغتيال',
            champTvChip(chipTxt, chipKind),
            '<div class="ctv-line ctv-dim">استهدف مديري ' + oppName + '</div>' + rows +
            champTvWhatIfHtml(wi, '', champGetTeamName(opp)));
    }

    /* الاستنفار + العودة من الموت */
    const sniper = find(myMoves, 'sniper');
    if (sniper) {
        html += champTvCard(CHAMP_SPECIAL_MOVES.sniper.color,
            xIcon('target', 'fill'), 'الاستنفار العام',
            champTvChip('مفعّلة', 'purple'),
            '<div class="ctv-line ctv-dim">فوز +6 / خسارة −3 ضد ' + oppName + '</div>');
    }
    const rev = find(myMoves, 'revival');
    if (rev) {
        html += champTvCard(CHAMP_SPECIAL_MOVES.revival.color,
            xIcon('heartbeat', 'fill'), 'العودة من الموت',
            champTvChip('مفعّلة', 'green'),
            '<div class="ctv-line ctv-dim">تُعاد المباراة كدبل في الجولة القادمة إذا كانت الخسارة بفارق 10 أو أقل</div>');
    }

    /* اغتيال من الخصم ضد هذا الفريق */
    const oa = find(oppMoves, 'assassination');
    if (oa) {
        const killed = res.blockedEntries || [];
        let rows = '';
        killed.forEach(function(e) {
            rows += '<div class="ctv-target hit">' +
                '<span class="ctv-target-ico">' + CTV_SVG.kill + '</span>' +
                '<span class="ctv-target-name">' + champEscapeHtml(champMgrName(e, d.mgrMap)) + '</span>' +
                '<span class="ctv-target-tag">اغتيل</span></div>';
        });
        html += champTvCard('#B8253F', CTV_SVG.kill, 'اغتيال من ' + oppName,
            champTvChip(killed.length > 0 ? 'أصاب ' + killed.length : 'بلا أثر', killed.length > 0 ? 'red' : 'gray'),
            killed.length > 0 ? (rows + champTvWhatIfHtml(champTvAssassinWhatIf(team, opp, d), '', champGetTeamName(team))) : '<div class="ctv-line ctv-dim">لم يكن المستهدفون ضمن الأساسيين</div>');
    }

    if (!html) {
        html = '<div class="ctv-nomove">لم يفعّل خاصية في هذه الجولة</div>';
    }
    return '<div class="ctv-section-title">الخواص</div>' + html;
}

/* ---------- ⭐ أدمن: إدخال نقاط رهان الصفر يدوياً ---------- */

function champTvCsEdit(team) {
    const st = champTeamViewState, d = st.data;
    if (!d || !isChampAdmin()) return;
    const cs = d.moves.find(function(m) { return m.team === team && m.move_type === 'clean_sheet'; });
    const sel = d.sels[team];
    if (!cs || !sel) return;
    const md = cs.move_data || {};
    const defs = md.manager_defs || {};
    const bet = cs.target_team || md.bet_team || '?';
    const entries = [].concat(sel.starters || [], sel.bench || []).filter(function(e) { return e; });

    let h = '<div class="ctv-ed"><div class="ctv-ed-title">رهان الصفر · ' +
        champEscapeHtml(champGetTeamName(team)) + ' ← ' + champEscapeHtml(CTV_EPL_NAMES[bet] || bet) + '</div>';
    h += '<label class="ctv-ed-lbl">نقاط الحارس (كلين شيت)</label>' +
         '<input id="ctvGkPts" class="ctv-ed-in" type="number" inputmode="numeric" min="0" value="' + (parseInt(md.gk_pts, 10) || 0) + '">';
    h += '<button type="button" class="ctv-auto-btn" id="ctvAutoBtn" onclick="champTvCsAuto(\'' + team + '\')">حساب تلقائي من الفانتازي (الحارس + المدافعين)</button>' +
         '<div class="ctv-auto-msg" id="ctvAutoMsg"></div>';
    h += '<label class="ctv-ed-lbl">عدد مدافعي ' + champEscapeHtml(CTV_EPL_NAMES[bet] || bet) + ' عند كل مدير</label>';
    entries.forEach(function(e) {
        const isStarter = (sel.starters || []).indexOf(e) !== -1;
        h += '<div class="ctv-ed-row"><span class="ctv-ed-name">' + champEscapeHtml(champMgrName(e, d.mgrMap)) +
            (isStarter ? '' : ' <i>(دكة)</i>') + '</span>' +
            '<input class="ctv-ed-n" data-entry="' + e + '" type="number" inputmode="numeric" min="0" max="5" value="' + (parseInt(defs[e], 10) || 0) + '"></div>';
    });
    h += '<div class="ctv-ed-btns"><button type="button" class="ctv-ed-save" id="ctvCsSave" onclick="champTvCsSave(\'' + team + '\')">حفظ</button>' +
         '<button type="button" class="ctv-ed-cancel" onclick="champRenderTeamView()">إلغاء</button></div></div>';

    const modal = document.getElementById('champTeamViewModal');
    if (modal) modal.innerHTML = champTvShell(h, d.round);
}
window.champTvCsEdit = champTvCsEdit;


async function champTvCsAuto(team) {
    const st = champTeamViewState, d = st.data;
    if (!d || !isChampAdmin()) return;
    const cs = d.moves.find(function(m) { return m.team === team && m.move_type === 'clean_sheet'; });
    const sel = d.sels[team];
    if (!cs || !sel) return;
    const bet = cs.target_team || (cs.move_data && cs.move_data.bet_team);
    const msg = document.getElementById('ctvAutoMsg');
    const btn = document.getElementById('ctvAutoBtn');
    const say = function(t, bad) { if (msg) { msg.textContent = t; msg.className = 'ctv-auto-msg' + (bad ? ' bad' : ''); } };
    if (btn) btn.disabled = true;
    say('جاري الجلب من الفانتازي...');
    const W = 'https://fpl-api.aaa117703.workers.dev';
    const unwrap = function(j) { return (j && j.data && !Array.isArray(j.data)) ? j.data : j; };
    try {
        const bs = await champFetchBootstrap();
        const bsd = unwrap(bs);
        const fplTeam = (bsd.teams || []).find(function(t) { return t.short_name === bet; });
        if (!fplTeam) throw new Error('لم أجد فريق ' + bet);
        const defIds = {}; let gkId = null;
        (bsd.elements || []).forEach(function(e) {
            if (e.team !== fplTeam.id) return;
            if (e.element_type === 2) defIds[e.id] = true;
            if (e.element_type === 1 && (gkId === null || (e.minutes || 0) > 0)) gkId = e.id;
        });

        // نقاط الحارس
        let gkPts = null;
        try {
            const lr = await fetch(W + '/?type=live&gw=' + d.round);
            if (lr.ok) {
                const live = unwrap(await lr.json());
                const els = live.elements || [];
                let best = null;
                els.forEach(function(el) {
                    const isGk = (bsd.elements || []).some(function(b) { return b.id === el.id && b.team === fplTeam.id && b.element_type === 1; });
                    if (isGk && el.stats && (el.stats.minutes || 0) > 0) best = el.stats.total_points;
                });
                if (best !== null) gkPts = best;
            }
        } catch (e) {}

        // مدافعو كل مدير (الـ 11 الأساسيين في الفانتازي)
        const inputs = Array.prototype.slice.call(document.querySelectorAll('.ctv-ed-n'));
        let failed = 0;
        await Promise.all(inputs.map(async function(inp) {
            const entry = inp.getAttribute('data-entry');
            try {
                const r = await fetch(CHAMP_PICKS_URL + '/?type=picks&entry=' + entry + '&gw=' + d.round);
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const pk = unwrap(await r.json());
                if (!pk || !Array.isArray(pk.picks)) throw new Error('no picks');
                let n = 0;
                pk.picks.forEach(function(p) { if (p.position <= 11 && defIds[p.element]) n++; });
                inp.value = n;
            } catch (e) { failed++; }
        }));

        if (gkPts !== null) document.getElementById('ctvGkPts').value = gkPts;
        if (failed === inputs.length) {
            say('تعذر جلب التشكيلات: تأكد من نشر Worker التشكيلات (picks).', true);
        } else {
            say('تم' + (gkPts !== null ? ' · نقاط الحارس ' + gkPts : ' · اكتب نقاط الحارس يدوياً') +
                (failed ? ' · فشل ' + failed + ' مدير' : '') + ' — راجع الأرقام ثم احفظ.');
        }
    } catch (e) {
        say('فشل: ' + (e.message || e), true);
    }
    if (btn) btn.disabled = false;
}
window.champTvCsAuto = champTvCsAuto;

async function champTvCsSave(team) {
    const st = champTeamViewState, d = st.data;
    if (!d || !isChampAdmin()) return;
    const cs = d.moves.find(function(m) { return m.team === team && m.move_type === 'clean_sheet'; });
    if (!cs) return;
    const gk = Math.max(0, parseInt(document.getElementById('ctvGkPts').value, 10) || 0);
    const defs = {};
    document.querySelectorAll('.ctv-ed-n').forEach(function(inp) {
        const n = Math.max(0, Math.min(5, parseInt(inp.value, 10) || 0));
        if (n > 0) defs[inp.getAttribute('data-entry')] = n;
    });
    const btn = document.getElementById('ctvCsSave');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    const newData = Object.assign({}, cs.move_data || {}, {
        gk_pts: gk, manager_defs: defs, bet_team: cs.target_team || (cs.move_data && cs.move_data.bet_team)
    });
    try {
        const r = await window.sbResults.from('tgc_special_moves')
            .update({ move_data: newData, updated_at: new Date().toISOString() }).eq('id', cs.id).select();
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error('لم يُحفظ (صلاحيات الجدول؟)');
        cs.move_data = newData;

        const mgrMap = d.mgrMap;
        d.res[st.homeTeam] = await champCalcTeamScore(st.homeTeam, st.awayTeam, d.round, d.sels, d.moves, mgrMap);
        if (st.awayTeam) d.res[st.awayTeam] = await champCalcTeamScore(st.awayTeam, st.homeTeam, d.round, d.sels, d.moves, mgrMap);
        champRenderTeamView();
        if (typeof champRunAutoScore === 'function') champRunAutoScore();
    } catch (e) {
        console.warn('[Champ TV] cs save failed:', e);
        alert('فشل الحفظ: ' + (e.message || e));
        if (btn) { btn.disabled = false; btn.textContent = 'حفظ'; }
    }
}
window.champTvCsSave = champTvCsSave;

/* ---------- الرسم الكامل ---------- */

var champTvSec = 'lineup';
function champTvSetSec(sec) { champTvSec = sec; champRenderTeamView(); }
window.champTvSetSec = champTvSetSec;

function champTvSecNav(hasSpecial, hasDiff) {
    const btn = function(id, label, ico, on, dot) {
        return '<button type="button" class="ctv-sec-btn' + (champTvSec === id ? ' active' : '') + (on ? '' : ' off') + '"' +
            (on ? ' onclick="champTvSetSec(\'' + id + '\')"' : ' disabled') + '>' + ico + '<span>' + label + '</span>' +
            (dot ? '<i class="ctv-sec-dot"></i>' : '') + '</button>';
    };
    return '<div class="ctv-sec-nav">' +
        btn('lineup', 'التشكيلة', xIcon('strategy', 'fill'), true, false) +
        btn('special', 'الخاصية', xIcon('lightning', 'fill'), true, hasSpecial) +
        btn('diff', 'الفروقات', xIcon('arrows-left-right', 'bold'), hasDiff, false) + '</div>';
}

function champRenderTeamView() {
    const st = champTeamViewState;
    const d = st.data;
    const modal = document.getElementById('champTeamViewModal');
    if (!modal || !d || !st.isOpen) return;

    const home = st.homeTeam;
    const away = st.awayTeam;
    const team = st.teamCode;
    const opp = (team === home) ? away : home;
    const res = d.res[team];
    const sel = d.sels[team] || null;
    const logo = champGetTeamLogo(team);

    let html = champTvScoreboard(d, home, away, team);
    html += champTvTabs(d, home, away, team);
    html += '<div class="ctv-team-sub ctv-team-sub-solo">التشكيلة الفعلية لـ ' +
        champEscapeHtml(champGetTeamName(team)) + ' · GW' + d.round + '</div>';

    const myMoves0 = d.moves.filter(function(m) { return m.team === team; });
    const oppMoves0 = opp ? d.moves.filter(function(m) { return m.team === opp; }) : [];
    const specialHtml = champTvSpecials(team, opp, res, d);
    const diffOn = champTvDiffVisible(d, home, away);
    html += champTvSecNav(myMoves0.length + oppMoves0.length > 0, true);

    if (champTvSec === 'lineup') {
        if (!sel || !Array.isArray(sel.starters)) {
            html += '<div class="ctv-empty">' + xIcon('clock', 'duotone') +
                '<div>لم يحفظ هذا النادي تشكيلة لهذه الجولة</div></div>';
        } else {
            const hasH2h = myMoves0.some(function(m) { return m.move_type === 'h2h'; });
            const hasCs = myMoves0.some(function(m) { return m.move_type === 'clean_sheet'; });
            html += champTvSummary(res);
            html += champTvPitch(res, d, team);
            html += champTvBreakdown(res, hasH2h, hasCs);
            html += champTvBench(res, sel, d, team);
        }
    } else if (champTvSec === 'special') {
        html += specialHtml || '<div class="ctv-empty">' + xIcon('lightning', 'duotone') +
            '<div>لم يستخدم أي نادي خاصية بهذه الجولة</div></div>';
    } else {
        html += champTvDiffSection(d, home, away);
    }

    modal.innerHTML = champTvShell(html, d.round);
    champTvEnsureDiff();
}
window.champRenderTeamView = champRenderTeamView;

/* =========================================================
   13) Tabs
========================================================= */

function champSwitchView(view) {
    champCurrentView = view;

    document.querySelectorAll('.champ-view-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.champ-view-panel').forEach(function(panel) {
        panel.style.display = (panel.dataset.panel === view) ? 'block' : 'none';
    });

    if (view === 'lineup' && typeof champCaptainsRenderLineup === 'function') {
        setTimeout(function() { champCaptainsRenderLineup(); }, 50);
    }
    if (view === 'matches' || view === 'standings') {
        setTimeout(function() { champRunAutoScore(); }, 100);
    }
}
window.champSwitchView = champSwitchView;

/* =========================================================
   14) Render Main
========================================================= */

function renderChampionsMain() {
    const container = document.getElementById('tgCupContent');
    if (!container) return;

    const meta = champData.meta || {};
    const draw = champData.draw || [];
    const matches = champData.matches || [];
    const isAdmin = isChampAdmin();
    const visibleRound = champData.visibleRound || meta.visible_gw || 1;

    let html = '';

    if (isAdmin) {
        if (meta.started) {
            const startGw = meta.start_gw || 8;
            let stageText = '';
            if (meta.current_stage === 'groups') stageText = 'Group Stage';
            else if (meta.current_stage === 'qf') stageText = 'Quarter Finals';
            else if (meta.current_stage === 'sf') stageText = 'Semi Finals';
            else if (meta.current_stage === 'final') stageText = 'Final';
            else if (meta.current_stage === 'done') stageText = 'Finished';

            html += '<div class="champions-status-text">' +
                xIcon('trophy', 'fill') + ' ' + stageText +
                ' — GW<strong>' + startGw + '</strong></div>';
        }

        if (!meta.started || draw.length === 0) {
            html += '<div class="champ-admin-actions">';
            if (draw.length === 0) {
                html += '<button class="champ-admin-btn champ-admin-start" onclick="champPerformDraw()">' +
                    xIcon('shuffle', 'bold') + ' <span>ابدأ القرعة</span></button>';
            }
            html += '</div>';
        }

        if (visibleRound < CHAMP_TOTAL_GROUP_GWS && meta.current_stage !== 'qf' && meta.current_stage !== 'sf' && meta.current_stage !== 'final' && meta.current_stage !== 'done') {
            const nextGw = (meta.start_gw || 8) + visibleRound;
            html += '<div style="margin:12px 0;padding:12px;background:rgba(167,139,250,0.08);border:1px dashed rgba(167,139,250,0.3);border-radius:10px;text-align:center;">';
            html += '<div style="font-size:11px;color:#A78BFA;margin-bottom:8px;">أدمن: فتح الجولة ' + (visibleRound + 1) + ' يدوياً</div>';
            html += '<button onclick="champUnlockNextRound()" style="padding:8px 16px;background:#A78BFA;color:#1A1A22;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;">🔓 افتح GW' + nextGw + '</button>';
            html += '</div>';
        }
    }

    if (draw.length === 0) {
        if (isAdmin) {
            html += '<div class="champions-empty">' + xIcon('trophy', 'duotone') +
                '<div>لا توجد قرعة</div></div>';
        } else {
            html += '<div class="champions-empty">' + xIcon('hourglass', 'duotone') +
                '<div>القرعة لم تُسحب بعد</div></div>';
        }
        container.innerHTML = html;
        return;
    }

    html += '<div class="champ-view-tabs">';

    html += '<button class="champ-view-btn ' + (champCurrentView === 'lineup' ? 'active' : '') +
        '" data-view="lineup" onclick="champSwitchView(\'lineup\')">' +
        xIcon('strategy', 'fill') + ' <span>التشكيلة</span></button>';

    html += '<button class="champ-view-btn ' + (champCurrentView === 'matches' ? 'active' : '') +
        '" data-view="matches" onclick="champSwitchView(\'matches\')">' +
        xIcon('soccer-ball', 'bold') + ' <span>المواجهات</span></button>';

    html += '<button class="champ-view-btn ' + (champCurrentView === 'standings' ? 'active' : '') +
        '" data-view="standings" onclick="champSwitchView(\'standings\')">' +
        xIcon('chart-bar', 'bold') + ' <span>الترتيب</span></button>';

    html += '</div>';

    if (champLastScoreUpdate > 0) {
        const ago = Math.floor((Date.now() - champLastScoreUpdate) / 1000);
        let agoText = '';
        if (ago < 60) agoText = 'منذ ' + ago + ' ثانية';
        else if (ago < 3600) agoText = 'منذ ' + Math.floor(ago / 60) + ' دقيقة';
        else agoText = 'منذ ' + Math.floor(ago / 3600) + ' ساعة';

        html += '<div class="champ-auto-update-bar">' +
            xIcon('lightning', 'fill') + ' آخر تحديث: ' + agoText + '</div>';
    }

    html += '<div class="champ-view-panel" data-panel="lineup" style="display:' +
        (champCurrentView === 'lineup' ? 'block' : 'none') + ';">' +
        '<div id="champCaptainsLineupContent"></div></div>';

    html += '<div class="champ-view-panel" data-panel="matches" style="display:' +
        (champCurrentView === 'matches' ? 'block' : 'none') + ';">';
    if (matches.some(function(m) { return m.stage === 'groups'; })) {
        html += renderGroupsMatches(matches, meta);
    } else {
        html += renderKnockoutBracket(matches, meta);
    }
    html += '</div>';

    html += '<div class="champ-view-panel" data-panel="standings" style="display:' +
        (champCurrentView === 'standings' ? 'block' : 'none') + ';">';
    html += renderGroupsSection(draw, matches, meta);
    html += '</div>';

    if (isAdmin && meta.started) {
        const gm = matches.filter(function(m) { return m.stage === 'groups'; });
        const total = gm.length;
        const played = gm.filter(champIsLocked).length;
        const allPlayed = total > 0 && played === total;

        html += '<div class="champ-admin-footer">';
        if (meta.current_stage === 'groups' && allPlayed) {
            html += '<button class="champ-start-knockout-btn" onclick="champStartKnockout()">' +
                xIcon('trophy', 'fill') + ' <span>انتهى دور المجموعات — ابدأ الإقصائيات</span></button>';
        }
        html += '<button class="champ-admin-btn-small" onclick="champSyncNow()">' +
            xIcon('arrows-clockwise', 'bold') + ' <span>تحديث النتائج الآن</span></button>';
        html += '</div>';
    }

    container.innerHTML = html;

    champStartCountdowns();

    if (champCurrentView === 'lineup' && typeof champCaptainsRenderLineup === 'function') {
        setTimeout(function() { champCaptainsRenderLineup(); }, 100);
    }
}

function renderGroupsSection(draw, matches, meta) {
    let html = '<div class="champions-groups-section">';
    html += '<div class="champions-section-title">' +
        xIcon('squares-four', 'bold') + ' <span>Groups</span></div>';

    html += champRenderGroupsFinishBar(matches, meta);

    html += '<div class="champ-groups-stack">';

    CHAMP_GROUPS.forEach(function(gName) {
        const standings = computeGroupStandings(draw, matches, gName);

        html += '<div class="champ-gcard">';
        html += '<div class="champ-gcard-head"><span class="champ-gcard-letter">' + gName + '</span>' +
            '<span class="champ-gcard-title">GROUP ' + gName + '</span>' +
            '<span class="champ-gcard-note">يتأهل الأول والثاني</span></div>';
        html += '<div class="champ-grow champ-grow-head"><span class="c-pos">#</span><span class="c-team">النادي</span>' +
            '<span class="c-n">P</span><span class="c-n">W</span><span class="c-n">D</span><span class="c-n">L</span>' +
            '<span class="c-n">GD</span><span class="c-pts">Pts</span></div>';

        standings.forEach(function(t, idx) {
            const logoFile = champGetTeamLogo(t.team);
            const teamName = champGetTeamName(t.team);
            const q = idx < 2;
            html += '<div class="champ-grow' + (q ? ' qual' : '') + '">';
            html += '<span class="c-pos">' + (idx + 1) + '</span>';
            html += '<span class="c-team">' +
                (logoFile ? '<img src="./' + logoFile + '" onerror="this.style.display=\'none\'" alt="">' : '<i class="c-noimg"></i>') +
                '<b>' + champEscapeHtml(teamName) + '</b></span>';
            html += '<span class="c-n">' + t.played + '</span><span class="c-n">' + t.won + '</span><span class="c-n">' +
                t.drawn + '</span><span class="c-n">' + t.lost + '</span>';
            html += '<span class="c-n">' + (t.gd > 0 ? '+' + t.gd : t.gd) + '</span>';
            html += '<span class="c-pts">' + t.points + '</span></div>';
        });

        html += '</div>';
    });

    html += '</div></div>';
    return html;
}

/* ⭐ v58: شريط الأدمن "انتهى دور المجموعات" */
function champRenderGroupsFinishBar(matches, meta) {
    if (!isChampAdmin() || !meta || !meta.started || meta.current_stage !== 'groups') return '';
    const gm = matches.filter(function(m) { return m.stage === 'groups'; });
    if (gm.length === 0) return '';
    const lockedRounds = [];
    for (let r = 1; r <= CHAMP_TOTAL_GROUP_GWS; r++) {
        const rm = gm.filter(function(m) { return m.round_num === r; });
        if (rm.length > 0 && rm.every(champIsLocked)) lockedRounds.push(r);
    }
    const done = lockedRounds.length === CHAMP_TOTAL_GROUP_GWS;
    let html = '<div class="champ-finish-bar' + (done ? ' ready' : '') + '">';
    html += '<div class="cfb-text"><b>' + lockedRounds.length + '/' + CHAMP_TOTAL_GROUP_GWS + '</b> جولات مقفلة</div>';
    html += '<button type="button" class="cfb-btn" ' + (done ? '' : 'disabled') + ' onclick="champStartKnockout()">' +
        xIcon('trophy', 'fill') + ' <span>انتهى دور المجموعات</span></button>';
    html += '</div>';
    return html;
}

function champStartCountdowns() {
    if (champCountdownTimer) clearInterval(champCountdownTimer);
    
    champCountdownTimer = setInterval(function() {
        var els = document.querySelectorAll('.champ-countdown-timer');
        if (els.length === 0) return;
        
        var now = Date.now();
        els.forEach(function(el) {
            var unlockMs = parseInt(el.getAttribute('data-unlock'), 10);
            var diff = unlockMs - now;
            
            if (diff <= 0) {
                el.innerHTML = 'جاري الفتح...';
                el.style.color = '#10B981';
                return;
            }
            
            var days = Math.floor(diff / (1000 * 60 * 60 * 24));
            var hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            var secs = Math.floor((diff % (1000 * 60)) / 1000);
            
            var parts = [];
            if (days > 0) parts.push(days + ' يوم');
            parts.push(champPad(hrs) + 'س');
            parts.push(champPad(mins) + 'د');
            parts.push(champPad(secs) + 'ث');
            
            el.innerHTML = '<i class="ph-bold ph-hourglass-high" style="margin-left:4px;"></i> ' + parts.join(' : ');
        });
    }, 1000);
}

function renderGroupsMatches(matches, meta) {
    const groupMatches = matches.filter(function(m) { return m.stage === 'groups'; });
    if (groupMatches.length === 0) return '';

    const startGw = meta.start_gw || 8;
    const visibleRound = champData.visibleRound || meta.visible_gw || 1;

    let activeGw = (typeof currentRound !== 'undefined' && currentRound > 0) ? currentRound : startGw;
    if (activeGw < startGw) activeGw = startGw;

    const defaultRoundNum = Math.min(Math.max(activeGw - startGw + 1, 1), CHAMP_TOTAL_GROUP_GWS + 3);
    let activeRoundNum = champSelectedRoundNum || defaultRoundNum;
    if (activeRoundNum > CHAMP_TOTAL_GROUP_GWS + 3) activeRoundNum = CHAMP_TOTAL_GROUP_GWS + 3;

    let html = '<div class="champions-round-section">';
    html += '<div class="champions-section-title">' + xIcon('soccer-ball', 'bold') + ' <span>Group Matches</span></div>';
    html += champRenderRoundStrip(groupMatches, startGw, activeRoundNum, defaultRoundNum, visibleRound);

    if (!meta.started) {
        html += '<div class="champions-status-text" style="margin-bottom:10px; color:#A78BFA; font-size:11px;">' +
            xIcon('eye', 'bold') + ' معاينة (البطولة تبدأ رسمياً GW' + startGw + ')</div>';
    }

    if (activeRoundNum > CHAMP_TOTAL_GROUP_GWS) {
        // ⭐ الإقصائيات: شجرة واحدة بكل الأدوار (خانات فارغة حتى تُحسم)
        html += renderKnockoutBracket(matches, meta);
    } else if (activeRoundNum > visibleRound) {
        const deadlineMs = champData.deadlines ? champData.deadlines[activeRoundNum] : 0;
        const unlockMs = deadlineMs ? (deadlineMs - (48 * 60 * 60 * 1000)) : 0;

        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;margin:10px 0;background:linear-gradient(145deg, #1A1A22, #141415);border:1px solid rgba(167,139,250,0.15);border-radius:12px;position:relative;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.2);">';
        html += '<div style="position:absolute;right:0;top:0;bottom:0;width:4px;background:#A78BFA;box-shadow:0 0 10px #A78BFA;"></div>';
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<div style="font-size:20px;color:#A78BFA;animation:pulse 2s infinite;">' + xIcon('lock-key', 'fill') + '</div>';
        html += '<div>';
        html += '<div style="font-family:Inter,sans-serif;font-weight:800;color:#FFF;font-size:14px;">GW' + activeGw + '</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:2px;">تُفتح قبل الديدلاين بـ 48 ساعة</div>';
        html += '</div></div>';

        if (unlockMs > 0) {
            html += '<div class="champ-countdown-timer" data-unlock="' + unlockMs + '" style="font-family:monospace;font-size:14px;font-weight:bold;color:#A78BFA;background:rgba(167,139,250,0.1);padding:6px 12px;border-radius:8px;display:flex;align-items:center;gap:4px;">-- : -- : --</div>';
        } else {
            html += '<div style="font-size:12px;color:#888;">بانتظار الجدول</div>';
        }

        html += '</div></div>';
    } else {
        const roundMatches = groupMatches.filter(function(m) { return m.round_num === activeRoundNum; });

        html += '<div style="margin-top:16px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
        html += '<span class="champ-gw-badge">GW' + activeGw + '</span>';
        html += '<span style="font-size:11px;color:#999;font-weight:600;">Round ' + activeRoundNum + '</span>';
        html += '</div>';
        html += champRenderLockBar('groups', activeRoundNum, roundMatches);

        if (roundMatches.length === 0) {
            html += '<div class="champions-empty" style="padding:20px;">' + xIcon('soccer-ball', 'duotone') + ' <span style="margin-right:8px;">لا توجد مباريات</span></div>';
        } else {
            CHAMP_GROUPS.forEach(function(gName) {
                const gMatches = roundMatches.filter(function(m) { return m.group_name === gName; });
                if (gMatches.length === 0) return;
                html += '<div class="champ-group-label">GROUP ' + gName + '</div>';
                gMatches.forEach(function(m) { html += renderMatchRow(m); });
            });
        }
        html += '</div>';
    }

    html += '</div>';
    return html;
}

/* =========================================================
   ⭐ v58: شريط الجولات + زر إنهاء الجولة
========================================================= */

function champRenderRoundStrip(groupMatches, startGw, activeNum, defaultNum, visibleRound) {
    let html = '<div class="champ-rounds-strip">';
    for (let r = 1; r <= CHAMP_TOTAL_GROUP_GWS; r++) {
        const rm = groupMatches.filter(function(m) { return m.round_num === r; });
        const locked = rm.length > 0 && rm.every(champIsLocked);
        const hidden = r > visibleRound;
        const cls = 'champ-round-chip' + (r === activeNum ? ' active' : '') +
            (locked ? ' locked' : '') + (hidden ? ' hidden-round' : '') +
            (r === defaultNum ? ' current' : '');
        html += '<button type="button" class="' + cls + '" onclick="champSelectRound(' + r + ')">' +
            '<span class="rc-gw">GW' + (startGw + r - 1) + '</span>' +
            '<span class="rc-ico">' + (locked ? xIcon('check-circle', 'fill') :
                hidden ? xIcon('lock-key', 'fill') : (r === defaultNum ? '<i class="rc-dot"></i>' : '')) + '</span>' +
            '</button>';
    }
    const koDefs = [['qf', 'ربع'], ['sf', 'نصف'], ['final', 'نهائي']];
    koDefs.forEach(function(k, i) {
        const r = CHAMP_TOTAL_GROUP_GWS + 1 + i;
        const km = (champData.matches || []).filter(function(m) { return m.stage === k[0]; });
        const locked = km.length > 0 && km.every(champIsLocked);
        const cls = 'champ-round-chip ko' + (r === activeNum ? ' active' : '') + (locked ? ' locked' : '') + (r === defaultNum ? ' current' : '');
        html += '<button type="button" class="' + cls + '" onclick="champSelectRound(' + r + ')">' +
            '<span class="rc-gw">GW' + (startGw + r - 1) + '</span>' +
            '<span class="rc-ko">' + k[1] + '</span>' +
            '<span class="rc-ico">' + (locked ? xIcon('check-circle', 'fill') : (r === defaultNum ? '<i class="rc-dot"></i>' : '')) + '</span></button>';
    });
    html += '</div>';
    return html;
}

function champSelectRound(r) {
    champSelectedRoundNum = r;
    renderChampionsMain();
}
window.champSelectRound = champSelectRound;

function champRenderLockBar(stage, roundNum, roundMatches) {
    if (!isChampAdmin() || !roundMatches || roundMatches.length === 0) return '';
    const allLocked = roundMatches.every(champIsLocked);
    const anyLocked = roundMatches.some(champIsLocked);
    const label = stage === 'groups' ? 'الجولة ' + roundNum : champStageLabel(stage);
    let html = '<div class="champ-lock-bar' + (allLocked ? ' is-locked' : '') + '">';
    if (allLocked) {
        html += '<div class="clb-text">' + xIcon('lock-key', 'fill') + ' <span>' + label + ' مقفلة — النقاط محتسبة في الترتيب</span></div>';
        html += '<button type="button" class="clb-btn reopen" onclick="champUnlockRound(\'' + stage + '\',' + roundNum + ')">إعادة فتح</button>';
    } else {
        html += '<div class="clb-text">' + xIcon('flag-checkered', 'fill') + ' <span>' + label +
            (anyLocked ? ' (مقفلة جزئياً)' : ' — بعد اكتمال المواجهات') + '</span></div>';
        html += '<button type="button" class="clb-btn" onclick="champLockRound(\'' + stage + '\',' + roundNum + ')">إنهاء ' + label + '</button>';
    }
    html += '</div>';
    return html;
}

function champStageLabel(stage) {
    return stage === 'qf' ? 'ربع النهائي' : stage === 'sf' ? 'نصف النهائي' :
           stage === 'final' ? 'النهائي' : stage;
}

function champRoundMatchesOf(stage, roundNum) {
    return (champData.matches || []).filter(function(m) {
        return stage === 'groups' ? (m.stage === 'groups' && m.round_num === roundNum) : m.stage === stage;
    });
}

function champShowLockError(e) {
    const msg = (e && e.message) || String(e);
    if (/is_locked/i.test(msg)) {
        alert('عمود is_locked غير موجود في Supabase.\nشغّل هذا في SQL Editor ثم أعد المحاولة:\n\nalter table public.champions_matches add column if not exists is_locked boolean not null default false;');
    } else {
        alert('فشل الحفظ: ' + msg);
    }
}

async function champLockRound(stage, roundNum) {
    if (!isChampAdmin()) return;
    const ms = champRoundMatchesOf(stage, roundNum);
    if (ms.length === 0) return;

    // آخر حساب قبل القفل (يحدّث نقاط الجولة الجارية إن وُجدت)
    try { await champAutoCalculateScores(); } catch (e) {}

    const noScore = ms.filter(function(m) { return m.home_score == null || m.away_score == null; });
    let q = 'إنهاء ' + (stage === 'groups' ? 'الجولة ' + roundNum : champStageLabel(stage)) +
        '؟\nستُقفل النتائج وتُرحَّل النقاط للترتيب.\nيمكنك إعادة فتحها لاحقاً.';
    if (noScore.length) q = 'تنبيه: ' + noScore.length + ' مباراة بدون نقاط بعد!\n\n' + q;
    if (!confirm(q)) return;

    try {
        const ids = ms.map(function(m) { return m.id; });
        const { error } = await window.sbResults.from('tgc_matches')
            .update({ is_locked: true, is_played: true, updated_at: new Date().toISOString() })
            .in('id', ids);
        if (error) throw error;
        ms.forEach(function(m) { m.is_locked = true; m.is_played = true; });
        if (stage !== 'groups') await checkAndBuildNextRound();
        else { try { await champStartKnockout(true); } catch (e2) { console.warn('[Champ] auto knockout failed', e2); } }
        if (typeof showToast === 'function') showToast('✓ تم إنهاء الجولة', true, 2500);
        champLoaded = false;
        loadChampions();
    } catch (e) {
        champShowLockError(e);
    }
}
window.champLockRound = champLockRound;

async function champUnlockRound(stage, roundNum) {
    if (!isChampAdmin()) return;
    const ms = champRoundMatchesOf(stage, roundNum);
    if (ms.length === 0) return;
    if (!confirm('إعادة فتح الجولة؟ ستُسحب نقاطها من الترتيب حتى تُقفل مرة أخرى.')) return;
    try {
        const ids = ms.map(function(m) { return m.id; });
        const { error } = await window.sbResults.from('tgc_matches')
            .update({ is_locked: false, is_played: false, updated_at: new Date().toISOString() })
            .in('id', ids);
        if (error) throw error;
        ms.forEach(function(m) { m.is_locked = false; m.is_played = false; });
        champLoaded = false;
        loadChampions();
    } catch (e) {
        champShowLockError(e);
    }
}
window.champUnlockRound = champUnlockRound;

function renderKnockoutBracket(matches, meta) {
    const qf = matches.filter(function(m) { return m.stage === 'qf'; })
        .sort(function(a, b) { return (a.round_num || 0) - (b.round_num || 0); });
    const sf = matches.filter(function(m) { return m.stage === 'sf'; })
        .sort(function(a, b) { return (a.round_num || 0) - (b.round_num || 0); });
    const fin = matches.filter(function(m) { return m.stage === 'final'; });

    let html = '<div class="champions-round-section">';
    html += '<div class="champions-section-title">' + xIcon('trophy', 'fill') +
        ' <span>Knockout Stage</span></div>';
    ['qf', 'sf', 'final'].forEach(function(st) {
        const list = matches.filter(function(m) { return m.stage === st; });
        html += champRenderLockBar(st, 1, list);
    });
    const sg = meta.start_gw || 8;
    const card = function(m, t1, t2, cls) {
        return '<div class="kb-card' + (m ? '' : ' empty') + (cls ? ' ' + cls : '') + '">' +
            (m ? renderMatchTeams(m) : renderEmptySlotCard(t1, t2)) + '</div>';
    };
    const qfCell = function(i) { return '<div class="kb-cell">' + card(qf[i], champQfLabel(i, 'h'), champQfLabel(i, 'a')) + '</div>'; };
    html += '<div class="kb-scroll"><div class="kb-heads"><span>ربع النهائي · GW' + (sg + 5) + '</span><i></i><span>نصف النهائي · GW' + (sg + 6) +
        '</span><i></i><span>النهائي · GW' + (sg + 7) + '</span></div><div class="kb">';
    html += '<div class="kb-col"><div class="kb-pair">' + qfCell(0) + qfCell(1) + '</div><div class="kb-pair">' + qfCell(2) + qfCell(3) + '</div></div>';
    html += '<div class="kb-con"><div class="kb-br"></div><div class="kb-br"></div></div>';
    html += '<div class="kb-col"><div class="kb-cell">' + card(sf[0], 'Winner QF1', 'Winner QF2') + '</div>' +
        '<div class="kb-cell">' + card(sf[1], 'Winner QF3', 'Winner QF4') + '</div></div>';
    html += '<div class="kb-con"><div class="kb-br big"></div></div>';
    html += '<div class="kb-col kb-fin"><div class="kb-cell"><div class="kb-trophy">' + xIcon('trophy', 'fill') + '</div>' +
        card(fin[0], 'Winner SF1', 'Winner SF2', 'final') + '</div></div>';
    html += '</div></div>';

    html += '<div class="kb-champ-wrap">';
    if (meta.champion) {
        const logoFile = champGetTeamLogo(meta.champion);
        const champName = champGetTeamName(meta.champion);
        html += '<div class="champ-champion-badge">';
        html += '<div class="champ-champion-badge-label">' + xIcon('crown', 'fill') + ' CHAMPION</div>';
        if (logoFile) html += '<img src="./' + logoFile + '" class="champ-champion-badge-logo" onerror="this.style.display=\'none\'">';
        html += '<div class="champ-champion-badge-name">' + champName + '</div></div>';
    }
    html += '</div></div>';
    return html;
}

function renderEmptySlotCard(t1, t2) {
    const row = function(t) { return '<div class="kb-erow"><span class="kb-ecirc"></span><span class="kb-ename">' + t + '</span></div>'; };
    return row(t1) + row(t2);
}

function renderBracketMatchCard(m, extra) {
    const cls = 'champ-qf-slot' + (extra ? ' ' + extra : '');
    return '<div class="' + cls + '">' + renderMatchTeams(m) + '</div>';
}

function renderMatchTeams(m) {
    const hl = champGetTeamLogo(m.home_team);
    const al = champGetTeamLogo(m.away_team);
    const hn = champGetTeamName(m.home_team);
    const an = champGetTeamName(m.away_team);
    const hw = m.winner === m.home_team;
    const aw = m.winner === m.away_team;

    const hc = 'onclick="event.stopPropagation(); champOpenTeamView(\'' + m.home_team + '\', \'' + m.home_team + '\', \'' + m.away_team + '\', ' + (champMatchGw(m) || 0) + ')"';
    const ac = 'onclick="event.stopPropagation(); champOpenTeamView(\'' + m.away_team + '\', \'' + m.home_team + '\', \'' + m.away_team + '\', ' + (champMatchGw(m) || 0) + ')"';

    return '<div class="champ-bracket-team clickable' + (hw ? ' winner' : '') + '" ' + hc + '>' +
        (hl ? '<img src="./' + hl + '" onerror="this.style.display=\'none\'">' : '') +
        '<span class="champ-bracket-team-name">' + hn + '</span>' +
        '<span class="champ-bracket-score">' + (m.home_score !== null && m.home_score !== undefined ? m.home_score : '-') + '</span></div>' +
        '<div class="champ-bracket-team clickable' + (aw ? ' winner' : '') + '" ' + ac + '>' +
        (al ? '<img src="./' + al + '" onerror="this.style.display=\'none\'">' : '') +
        '<span class="champ-bracket-team-name">' + an + '</span>' +
        '<span class="champ-bracket-score">' + (m.away_score !== null && m.away_score !== undefined ? m.away_score : '-') + '</span></div>';
}

function renderMatchRow(m) {
    const hl = champGetTeamLogo(m.home_team);
    const al = champGetTeamLogo(m.away_team);
    const hn = champEscapeHtml(champGetTeamName(m.home_team));
    const an = champEscapeHtml(champGetTeamName(m.away_team));

    const finished = champIsMatchFinished(m);
    const hasScore = m.home_score !== null && m.home_score !== undefined &&
                     m.away_score !== null && m.away_score !== undefined;
    // أخضر = جولة جارية (حي) | ذهبي = جولة منتهية
    const cls = finished ? 'score-gold' : 'score-live';
    const gw = champMatchGw(m) || 0;

    const hc = 'onclick="event.stopPropagation(); champOpenTeamView(\'' + m.home_team + '\', \'' + m.home_team + '\', \'' + m.away_team + '\', ' + gw + ')"';
    const ac = 'onclick="event.stopPropagation(); champOpenTeamView(\'' + m.away_team + '\', \'' + m.home_team + '\', \'' + m.away_team + '\', ' + gw + ')"';

    const hp = hasScore ? '<b class="cmr-pts ' + cls + '">' + m.home_score + '</b>' : '';
    const ap = hasScore ? '<b class="cmr-pts ' + cls + '">' + m.away_score + '</b>' : '';
    const mid = hasScore ? '<i class="cmr-dash">-</i>' : '<span class="cmr-vs">VS</span>';

    return '<div class="champions-match-row cmr' + (finished ? ' played' : '') + '">' +
        '<div class="champions-match-team home clickable" ' + hc + '>' +
        (hl ? '<img src="./' + hl + '" onerror="this.style.display=\'none\'" alt="">' : '') +
        '<span class="cmr-name">' + hn + '</span>' + hp + '</div>' +
        '<div class="champions-match-score cmr-mid' + (!hasScore ? ' pending' : '') + '">' + mid + '</div>' +
        '<div class="champions-match-team away clickable" ' + ac + '>' +
        ap + '<span class="cmr-name">' + an + '</span>' +
        (al ? '<img src="./' + al + '" onerror="this.style.display=\'none\'" alt="">' : '') + '</div></div>\n';
}

/* =========================================================
   15) Sync / Start / Reset / Draw
========================================================= */

async function champSyncNow() {
    if (!isChampAdmin()) return;
    if (typeof showToast === 'function') showToast('جاري التحديث...', false);
    const updated = await champAutoCalculateScores();
    if (updated) {
        if (typeof showToast === 'function') showToast('✓ تم التحديث', true, 2500);
    } else {
        if (typeof showToast === 'function') showToast('لا تحديثات جديدة', false, 2500);
    }
    champLoaded = false;
    loadChampions();
}
window.champSyncNow = champSyncNow;

function champKnockoutPlan() {
    const firsts = {}, seconds = {};
    CHAMP_GROUPS.forEach(function(g) {
        const st = computeGroupStandings(champData.draw, champData.matches, g);
        if (st.length >= 2) { firsts[g] = st[0].team; seconds[g] = st[1].team; }
    });
    if (Object.keys(firsts).length < 4 || Object.keys(seconds).length < 4) return null;
    return { firsts: firsts, seconds: seconds };
}

/* قرعة عشوائية: أول مجموعة ضد ثاني مجموعة مختلفة (4 مباريات) */
function champRandomKnockoutPairs(plan) {
    for (let tries = 0; tries < 500; tries++) {
        const fg = champShuffle(CHAMP_GROUPS.slice());
        const sg = champShuffle(CHAMP_GROUPS.slice());
        let ok = true;
        for (let i = 0; i < 4; i++) { if (fg[i] === sg[i]) { ok = false; break; } }
        if (!ok) continue;
        return fg.map(function(g, i) {
            return {
                homeGroup: g, home: plan.firsts[g],
                awayGroup: sg[i], away: plan.seconds[sg[i]]
            };
        });
    }
    return null;
}

let champKoDraw = { plan: null, pairs: null, running: false, done: false, cancel: false };

async function champStartKnockout(auto) {
    if (!isChampAdmin()) return;
    const meta = champData.meta || {};
    if (!meta.started) { if (!auto) alert('البطولة لم تبدأ'); return; }
    if (meta.current_stage !== 'groups') { if (!auto) alert('بدأت الإقصائيات'); return; }
    if (champData.matches.some(function(m) { return m.stage === 'qf'; })) return;

    const gm = champData.matches.filter(function(m) { return m.stage === 'groups'; });
    const allLocked = gm.length > 0 && gm.every(champIsLocked);
    if (!allLocked) { if (!auto) alert('أنهِ (اقفل) كل جولات المجموعات أولاً'); return; }

    const plan = champKnockoutPlan();
    if (!plan) { if (!auto) alert('تعذر تحديد أول وثاني كل مجموعة'); return; }
    if (!auto && !confirm('بدء ربع النهائي؟\nA1-D2 · B1-C2 · C1-B2 · D1-A2')) return;

    const startGw = (meta.start_gw || 8) + CHAMP_TOTAL_GROUP_GWS;
    const ok = await buildKnockoutStage(startGw, null);
    if (ok) {
        if (typeof showToast === 'function') showToast('✓ بدأ دور الإقصائيات', true, 3500);
        champLoaded = false;
        loadChampions();
    } else if (!auto) {
        alert('فشل بدء الإقصائيات');
    }
}

function champKoTile(team, group, kind) {
    const logo = champGetTeamLogo(team);
    return '<div class="kod-tile ' + kind + '" data-team="' + team + '" data-group="' + group + '">' +
        '<div class="kod-hex"><div class="kod-hex-in">' +
        (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'" alt="">' : '<i></i>') +
        '</div></div>' +
        '<div class="kod-tile-name">' + champEscapeHtml(champGetTeamName(team)) + '</div>' +
        '<div class="kod-tile-tag">' + (kind === 'first' ? '1' : '2') + group + '</div>' +
        '<div class="kod-badge"></div></div>';
}

function champOpenKnockoutDrawModal() {
    if (!isChampAdmin()) { if (typeof showToast === 'function') showToast('القرعة للأدمن فقط', false); return; }
    let el = document.getElementById('champKoDrawModal');
    if (!el) { el = document.createElement('div'); el.id = 'champKoDrawModal'; document.body.appendChild(el); }
    el.className = 'kod show';
    document.body.classList.add('champ-tv-open');
    const p = champKoDraw.plan;

    let html = '<div class="kod-topbar"><button type="button" class="kod-close" onclick="champCloseKnockoutDraw()">' +
        CTV_SVG.back + '<span>رجوع</span></button><div class="kod-title">قرعة الأدوار الإقصائية</div><div class="kod-gap"></div></div>';
    html += '<div class="kod-scroll"><div class="kod-inner">';
    html += '<div class="kod-pitch" aria-hidden="true"><i class="kod-circle"></i><i class="kod-line"></i></div>';
    html += '<div class="kod-rule">أول كل مجموعة ضد ثاني مجموعة أخرى — لا مواجهة من نفس المجموعة</div>';

    html += '<div class="kod-label">الأوائل</div><div class="kod-row" id="kodFirsts">';
    CHAMP_GROUPS.forEach(function(g) { html += champKoTile(p.firsts[g], g, 'first'); });
    html += '</div>';
    html += '<div class="kod-label">الثواني</div><div class="kod-row" id="kodSeconds">';
    CHAMP_GROUPS.forEach(function(g) { html += champKoTile(p.seconds[g], g, 'second'); });
    html += '</div>';

    html += '<div class="kod-status" id="kodStatus">جاهز للقرعة</div>';
    html += '<div class="kod-matches" id="kodMatches"></div>';
    html += '<div class="kod-actions" id="kodActions"><button type="button" class="kod-go" id="kodGo" onclick="champRunKnockoutDraw()">' +
        '<span>ابدأ القرعة</span></button></div>';
    html += '</div></div>';
    el.innerHTML = html;
}

function champCloseKnockoutDraw() {
    champKoDraw.cancel = true;
    const el = document.getElementById('champKoDrawModal');
    if (el) el.classList.remove('show');
    document.body.classList.remove('champ-tv-open');
}
window.champCloseKnockoutDraw = champCloseKnockoutDraw;

function champSleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

/* تدوير الإضاءة بين مرشحين ثم التوقف عند المختار */
async function champKoSpin(tiles, winnerTile, cls, ticks) {
    const seq = [];
    let last = null;
    for (let i = 0; i < (ticks || 10); i++) {
        let t = tiles[Math.floor(Math.random() * tiles.length)];
        if (tiles.length > 1 && t === last) t = tiles[(tiles.indexOf(t) + 1) % tiles.length];
        seq.push(t); last = t;
    }
    seq.push(winnerTile);
    for (let i = 0; i < seq.length; i++) {
        if (champKoDraw.cancel) return;
        tiles.forEach(function(t) { t.classList.remove(cls); });
        seq[i].classList.add(cls);
        await champSleep(60 + i * i * 2.4);
    }
}

async function champRunKnockoutDraw() {
    if (!isChampAdmin()) { if (typeof showToast === 'function') showToast('القرعة للأدمن فقط', false); return; }
    const d = champKoDraw;
    if (d.running) return;
    d.running = true; d.cancel = false; d.done = false;

    d.pairs = champRandomKnockoutPairs(d.plan);
    if (!d.pairs) { alert('تعذرت القرعة'); d.running = false; return; }

    // إعادة ضبط الواجهة
    document.querySelectorAll('#champKoDrawModal .kod-tile').forEach(function(t) {
        t.classList.remove('spin', 'picked', 'dim', 'lock');
        t.querySelector('.kod-badge').textContent = '';
    });
    const mBox = document.getElementById('kodMatches');
    const status = document.getElementById('kodStatus');
    const actions = document.getElementById('kodActions');
    mBox.innerHTML = '';
    actions.innerHTML = '';

    const tileOf = function(team) { return document.querySelector('#champKoDrawModal .kod-tile[data-team="' + team + '"]'); };
    const firstTiles = Array.prototype.slice.call(document.querySelectorAll('#kodFirsts .kod-tile'));
    const secondTiles = Array.prototype.slice.call(document.querySelectorAll('#kodSeconds .kod-tile'));

    for (let i = 0; i < d.pairs.length; i++) {
        if (d.cancel) return;
        const p = d.pairs[i];
        const ft = tileOf(p.home), st = tileOf(p.away);

        status.textContent = 'سحب المباراة ' + (i + 1) + ' — النادي الأول';
        const freeFirst = firstTiles.filter(function(t) { return !t.classList.contains('picked'); });
        await champKoSpin(freeFirst, ft, 'spin', 8);
        freeFirst.forEach(function(t) { t.classList.remove('spin'); });
        ft.classList.add('picked');
        ft.querySelector('.kod-badge').textContent = 'QF' + (i + 1);
        await champSleep(350);

        status.textContent = 'سحب خصم ' + champGetTeamName(p.home);
        // الأندية من نفس المجموعة تُعتّم (غير مؤهلة)
        const freeSecond = secondTiles.filter(function(t) { return !t.classList.contains('picked'); });
        const eligible = freeSecond.filter(function(t) { return t.getAttribute('data-group') !== p.homeGroup; });
        freeSecond.forEach(function(t) {
            if (t.getAttribute('data-group') === p.homeGroup) t.classList.add('dim');
        });
        await champKoSpin(eligible, st, 'spin', 10);
        secondTiles.forEach(function(t) { t.classList.remove('spin', 'dim'); });
        st.classList.add('picked');
        st.querySelector('.kod-badge').textContent = 'QF' + (i + 1);

        const card = document.createElement('div');
        card.className = 'kod-match';
        card.innerHTML = '<span class="kod-m-no">QF' + (i + 1) + '</span>' +
            '<span class="kod-m-team home">' + (champGetTeamLogo(p.home) ? '<img src="./' + champGetTeamLogo(p.home) + '" onerror="this.style.display=\'none\'" alt="">' : '') +
            '<b>' + champEscapeHtml(champGetTeamName(p.home)) + '</b></span>' +
            '<span class="kod-m-vs">VS</span>' +
            '<span class="kod-m-team away"><b>' + champEscapeHtml(champGetTeamName(p.away)) + '</b>' +
            (champGetTeamLogo(p.away) ? '<img src="./' + champGetTeamLogo(p.away) + '" onerror="this.style.display=\'none\'" alt="">' : '') + '</span>';
        mBox.appendChild(card);
        await champSleep(550);
    }

    d.running = false; d.done = true;
    status.textContent = 'اكتملت القرعة';
    actions.innerHTML =
        '<button type="button" class="kod-go confirm" onclick="champConfirmKnockoutDraw()"><span>اعتماد القرعة</span></button>' +
        '<button type="button" class="kod-go ghost" onclick="champRunKnockoutDraw()"><span>إعادة القرعة</span></button>';
}
window.champRunKnockoutDraw = champRunKnockoutDraw;

async function champConfirmKnockoutDraw() {
    const d = champKoDraw;
    if (!d.done || !d.pairs) return;
    if (!confirm('اعتماد القرعة وبدء ربع النهائي؟ لا يمكن إعادتها بعد الاعتماد.')) return;
    const meta = champData.meta || {};
    const startGw = (meta.start_gw || 8) + CHAMP_TOTAL_GROUP_GWS;
    const ok = await buildKnockoutStage(startGw, d.pairs);
    if (ok) {
        champCloseKnockoutDraw();
        if (typeof showToast === 'function') showToast('✓ بدأ دور الإقصائيات', true, 3500);
        champLoaded = false;
        loadChampions();
    } else {
        alert('فشل حفظ القرعة');
    }
}
window.champConfirmKnockoutDraw = champConfirmKnockoutDraw;
window.champStartKnockout = champStartKnockout;

async function champUnlockNextRound() {
    if (!isChampAdmin()) return;
    const meta = champData.meta || {};
    const startGw = meta.start_gw || 8;
    const currentVisible = champData.visibleRound || meta.visible_gw || 1;
    if (currentVisible >= CHAMP_TOTAL_GROUP_GWS) return;

    const newVisible = currentVisible + 1;
    const nextGw = startGw + currentVisible;

    if (!confirm('فتح GW' + nextGw + ' للجميع؟')) return;

    const ok = await saveChampionsMeta({ visible_gw: newVisible });
    if (ok) {
        if (champData.meta) champData.meta.visible_gw = newVisible;
        champData.visibleRound = newVisible;
        if (typeof showToast === 'function') showToast('✓ تم فتح GW' + nextGw, true, 2500);
        renderChampionsMain();
    } else {
        if (typeof showToast === 'function') showToast('فشل الفتح', false, 2500);
    }
}
window.champUnlockNextRound = champUnlockNextRound;

async function resetChampions() {
    if (!window.sbResults) return false;
    try {
        await window.sbResults.from('tgc_draw').delete().neq('id', 0);
        await window.sbResults.from('tgc_matches').delete().neq('id', 0);
        await window.sbResults.from('tgc_meta').upsert({
            id: 1, started: false, start_gw: null,
            current_stage: 'groups', current_round: 0, champion: null,
            visible_gw: 1,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        return true;
    } catch (e) { return false; }
}

function champRequestReset() {
    if (!isChampAdmin()) return;
    if (!confirm('حذف القرعة والمباريات؟')) return;
    resetChampions().then(function(ok) {
        if (ok) {
            if (typeof showToast === 'function') showToast('تم الحذف', true, 2500);
            champData = { meta: null, draw: [], matches: [], pendingDraw: null, visibleRound: 1, deadlines: {} };
            champLoaded = false;
            loadChampions();
        }
    });
}
window.champRequestReset = champRequestReset;

async function champSaveDraw(drawRows) {
    await saveChampionsDraw(drawRows);
    champData.draw = drawRows;

    const groups = { A: [], B: [], C: [], D: [] };
    drawRows.forEach(function(r) {
        if (groups[r.group_name]) groups[r.group_name].push(r);
    });

    const matches = buildRoundRobin(groups);
    await saveChampionsMatches(matches);
    champData.matches = matches;
}
window.champSaveDraw = champSaveDraw;

function buildRoundRobin(groups) {
    const matches = [];

    CHAMP_GROUPS.forEach(function(gName) {
        const teams = (groups[gName] || []).map(function(r) { return r.team; });
        if (teams.length < 5) return;

        const list = teams.slice();
        if (list.length % 2 !== 0) list.push('__BYE__');

        const total = list.length;
        const roundsCount = total - 1;
        const halfSize = total / 2;
        const rotating = list.slice(1);
        const fixed = list[0];

        for (let r = 0; r < roundsCount; r++) {
            const roundMatches = [];
            const opp = rotating[rotating.length - 1];

            if (fixed !== '__BYE__' && opp !== '__BYE__') {
                roundMatches.push(r % 2 === 0
                    ? { home: fixed, away: opp }
                    : { home: opp, away: fixed });
            }

            for (let i = 0; i < halfSize - 1; i++) {
                const t1 = rotating[i];
                const t2 = rotating[rotating.length - 2 - i];
                if (t1 === '__BYE__' || t2 === '__BYE__') continue;
                roundMatches.push(r % 2 === 0
                    ? { home: t1, away: t2 }
                    : { home: t2, away: t1 });
            }

            rotating.unshift(rotating.pop());

            roundMatches.forEach(function(m) {
                matches.push({
                    stage: 'groups', group_name: gName, round_num: r + 1,
                    gw: null, home_team: m.home, away_team: m.away,
                    home_score: null, away_score: null, winner: null, is_played: false
                });
            });
        }
    });

    return matches;
}
window.buildRoundRobin = buildRoundRobin;

/* =========================================================
   16) Load Champions
========================================================= */

async function loadChampions() {
    const container = document.getElementById('tgCupContent');
    if (!container) return;

    if (!window.sbResults) {
        container.innerHTML = '<div class="champions-empty">' +
            xIcon('warning-circle', 'duotone') + '<div>Supabase not available</div></div>';
        return;
    }

    if (champLoaded) {
        await champLoadSnipers();
        renderChampionsMain();
        champStartAutoScore();
        return;
    }

    container.innerHTML = '<div class="champions-empty">' +
        xIcon('hourglass', 'duotone') + '<div>Loading...</div></div>';

    try {
        const [meta, draw, matches] = await Promise.all([
            loadChampionsMeta(),
            loadChampionsDraw(),
            loadChampionsMatches()
        ]);

        champData.meta = meta || { started: false };
        champData.draw = draw;
        champData.matches = matches;

        if (champData.meta && champData.meta.start_gw) {
            champData.deadlines = await loadAllGroupDeadlines(champData.meta.start_gw);
        }

        champData.visibleRound = await champGetVisibleRound();
        await champLoadSnipers();

        champLoaded = true;

        renderChampionsMain();

        if (champData.meta && champData.meta.started) {
            champStartAutoScore();
        }
    } catch (e) {
        console.error('[Champions] load error:', e);
        container.innerHTML = '<div class="champions-empty">' +
            xIcon('warning-circle', 'duotone') + '<div>Load failed</div></div>';
    }
}
window.loadChampions = loadChampions;

window.championsReload = function() {
    champLoaded = false;
    loadChampions();
};

/* =========================================================
   17) ESC + Exports
========================================================= */

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && champTeamViewState.isOpen) champCloseTeamView();
});

window.champGoToTab = champGoToTab;
window.champSwitchView = champSwitchView;
window.champStartKnockout = champStartKnockout;
window.champRequestReset = champRequestReset;
window.champSyncNow = champSyncNow;
window.champUnlockNextRound = champUnlockNextRound;
window.champSettingsToggleAdmin = champSettingsToggleAdmin;
window.buildKnockoutStage = buildKnockoutStage;
window.renderChampionsMain = renderChampionsMain;
window.renderEmptyBracketPreview = function() { return ''; };
window.champOpenTeamView = champOpenTeamView;
window.champCloseTeamView = champCloseTeamView;
window.champTeamViewState = champTeamViewState;
window.champAutoCalculateScores = champAutoCalculateScores;
window.champRunAutoScore = champRunAutoScore;
window.champStartAutoScore = champStartAutoScore;
window.champStopAutoScore = champStopAutoScore;
window.champFetchBootstrap = champFetchBootstrap;
window.champGetFplCurrentEvent = champGetFplCurrentEvent;
window.champGetVisibleRound = champGetVisibleRound;

(function injectChampStyles() {
    if (document.getElementById('champCountdownStyles')) return;
    var style = document.createElement('style');
    style.id = 'champCountdownStyles';
    style.innerHTML = '@keyframes pulse { 0% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.8; } }';
    document.head.appendChild(style);
})();

console.log('[Champions] v=52 loaded — Live Scores');
