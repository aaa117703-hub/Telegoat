/* =========================================================
   champions-special.js — FINALISSIMA LEAGUE (v=8)
   🎯 Special Moves
   ⭐ v8: إصلاح اختفاء المديرين في الهيد تو هيد (Fallback by Entry ID)
========================================================= */

const CS_MOVES_CONFIG = [
    {
        id: 'revival',
        name: 'REVIVAL',
        nameAr: 'العودة من الموت',
        icon: 'heartbeat',
        color: 'green',
        desc: 'If you lost by 10 points or less, replay the match next GW as a double GW.',
        descAr: 'إذا خسرت بفارق 10 نقاط أو أقل، تُعاد المباراة في الجولة القادمة كدبل.'
    },
    {
        id: 'assassination',
        name: 'ASSASSINATION',
        nameAr: 'الاغتيال',
        icon: 'knife',
        color: 'red',
        desc: 'Block 2 managers of the opponent from being starters this GW.',
        descAr: 'امنع 2 مديرين من الخصم من أن يكونوا أساسيين ضدك هذا الجولة.'
    },
    {
        id: 'h2h',
        name: 'HEAD-TO-HEAD',
        nameAr: 'الهيد تو هيد',
        icon: 'sword',
        color: 'gold',
        desc: 'Pick one manager from each team. Win: +30. Lose: -30.',
        descAr: 'اختر مديراً من كل فريق. فوز: +30. خسارة: -30.'
    },
    {
        id: 'sniper',
        name: 'GENERAL MOBILIZATION',
        nameAr: 'الاستنفار العام',
        icon: 'target',
        color: 'purple',
        desc: 'Double one match (Group Stage, once per season). Win: +6. Lose: -3.',
        descAr: 'ضاعف مباراة واحدة (دور المجموعات، مرة وحدة بالبطولة). فوز: +6. خسارة: -3.'
    },
    {
        id: 'clean_sheet',
        name: 'CLEAN SHEET BET',
        nameAr: 'رهان الصفر',
        icon: 'shield-check',
        color: 'blue',
        desc: 'Bet on a team to keep a clean sheet. Get all their starting defenders points.',
        descAr: 'راهن على فريق EPL يحافظ على شباكه نظيفة. تحصل على نقاط مدافعينه.'
    }
];

const CS_TOTAL_MOVES = 5;
const CS_TOTAL_CHOICES = 4;

const CS_GROUP_START_GW = 8;
const CS_CONFIG_DEADLINE_HOURS = 24;

const CS_EPL_TEAMS = [
    { code: 'ARS', name: 'Arsenal' },
    { code: 'AVL', name: 'Aston Villa' },
    { code: 'BOU', name: 'Bournemouth' },
    { code: 'BRE', name: 'Brentford' },
    { code: 'BHA', name: 'Brighton' },
    { code: 'CHE', name: 'Chelsea' },
    { code: 'COV', name: 'Coventry' },
    { code: 'CRY', name: 'Crystal Palace' },
    { code: 'EVE', name: 'Everton' },
    { code: 'FUL', name: 'Fulham' },
    { code: 'HUL', name: 'Hull' },
    { code: 'IPS', name: 'Ipswich' },
    { code: 'LEE', name: 'Leeds' },
    { code: 'LIV', name: 'Liverpool' },
    { code: 'MCI', name: 'Man City' },
    { code: 'MUN', name: 'Man United' },
    { code: 'NEW', name: 'Newcastle' },
    { code: 'NFO', name: 'Nott\'m Forest' },
    { code: 'SUN', name: 'Sunderland' },
    { code: 'TOT', name: 'Spurs' }
];

/* =========================================================
   1) STATE
========================================================= */

let csState = {
    team: null,
    captainName: null,
    round: 1,
    config: null,
    savedMoves: {},
    usedBefore: {},
    allManagers: null,
    opponentTeam: null,
    pickerState: {},
    configSelection: [],
    isSaving: false,
    isRendering: false
};

/* =========================================================
   2) HELPERS
========================================================= */

function csIcon(name, variant) {
    variant = variant || 'regular';
    const vc = variant === 'fill' ? 'ph-fill' :
               variant === 'bold' ? 'ph-bold' :
               variant === 'duotone' ? 'ph-duotone' :
               'ph';
    return '<i class="' + vc + ' ph-' + name + '"></i>';
}

function csGetTeamLogo(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].logo || '';
    }
    return '';
}

function csGetTeamName(code) {
    if (typeof teamsMap !== 'undefined' && teamsMap[code]) {
        return teamsMap[code].name || code;
    }
    return code || 'Unknown';
}

function csGetCaptainTeam() {
    try {
        return sessionStorage.getItem('champ_captain_team') || null;
    } catch (e) {
        return null;
    }
}

function csGetCaptainName() {
    try {
        return sessionStorage.getItem('champ_captain_name') || 'Captain';
    } catch (e) {
        return 'Captain';
    }
}

function csGetRound() {
    const meta = (window.champData && window.champData.meta) || {};
    const startGw = meta.start_gw || 8;
    const cr = (typeof currentRound !== 'undefined') ? currentRound : 1;
    if (!meta.started || cr < startGw) return startGw;
    return cr;
}

function csEscapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function csGetMoveConfig(moveId) {
    return CS_MOVES_CONFIG.find(function(m) { return m.id === moveId; }) || null;
}

/* =========================================================
   3) SUPABASE — CONFIG
========================================================= */

async function csLoadConfig(team) {
    if (!window.sbResults || !team) return null;
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_config')
            .select('*')
            .eq('team', team)
            .maybeSingle();
        if (error) throw error;
        return data;
    } catch (e) {
        console.warn('[Special] config load error:', e);
        return null;
    }
}

async function csSaveConfig(team, chosenMoves, droppedMove) {
    if (!window.sbResults || !team) return false;
    try {
        const payload = {
            team: team,
            chosen_moves: chosenMoves,
            dropped_move: droppedMove,
            locked: true,
            updated_at: new Date().toISOString()
        };
        const { error } = await window.sbResults
            .from('tgc_special_config')
            .upsert(payload, { onConflict: 'team' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.warn('[Special] config save error:', e);
        return false;
    }
}

/* =========================================================
   4) SUPABASE — MOVES
========================================================= */

async function csLoadMyMovesForRound(round, team) {
    if (!window.sbResults || !team) return {};
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_moves')
            .select('*')
            .eq('round', round)
            .eq('team', team);
        if (error) throw error;
        const map = {};
        (data || []).forEach(function(row) {
            map[row.move_type] = row;
        });
        return map;
    } catch (e) {
        console.warn('[Special] moves load error:', e);
        return {};
    }
}

/* ⭐ v9: الخواص التي استخدمها النادي في جولات سابقة (تُقفل بعدها) */
async function csLoadUsedBefore(team, round) {
    if (!window.sbResults || !team) return {};
    const r = parseInt(round, 10) || 1;
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_moves')
            .select('move_type, round')
            .eq('team', team)
            .lt('round', r);
        if (error) throw error;
        const map = {};
        (data || []).forEach(function(row) {
            if (!map[row.move_type] || row.round < map[row.move_type]) map[row.move_type] = row.round;
        });
        return map;
    } catch (e) {
        console.warn('[Special] used-before load error:', e);
        return {};
    }
}

async function csLoadAllMovesForRound(round) {
    if (!window.sbResults) return {};
    try {
        const { data, error } = await window.sbResults
            .from('tgc_special_moves')
            .select('*')
            .eq('round', round);
        if (error) throw error;
        const map = {};
        (data || []).forEach(function(row) {
            const key = row.team + '_' + row.move_type;
            map[key] = row;
        });
        return map;
    } catch (e) {
        console.warn('[Special] all moves load error:', e);
        return {};
    }
}

async function csSaveMove(round, team, moveType, targetTeam, moveData) {
    if (!window.sbResults) {
        return { ok: false, error: 'sbResults not initialized' };
    }
    if (!team) {
        return { ok: false, error: 'Team code missing' };
    }

    const roundNum = parseInt(round, 10);
    if (!roundNum || isNaN(roundNum)) {
        return { ok: false, error: 'Invalid round: ' + round };
    }

    // ⭐ v9: منع إعادة استخدام خاصية سبق استخدامها في جولة سابقة
    const prior = await csLoadUsedBefore(team, roundNum);
    if (prior[moveType]) {
        csState.usedBefore = prior;
        return { ok: false, error: 'هذه الخاصية استُخدمت في الجولة ' + prior[moveType] + ' ولا يمكن استخدامها مرة ثانية' };
    }

    const payload = {
        round: roundNum,
        team: team,
        move_type: moveType,
        target_team: targetTeam,
        move_data: moveData || {},
        status: 'pending',
        updated_at: new Date().toISOString()
    };

    try {
        const up = await window.sbResults
            .from('tgc_special_moves')
            .upsert(payload, { onConflict: 'round,team,move_type' });

        if (!up.error) {
            return { ok: true };
        }

        const del = await window.sbResults
            .from('tgc_special_moves')
            .delete()
            .eq('round', roundNum)
            .eq('team', team)
            .eq('move_type', moveType);

        if (del.error) {
            return {
                ok: false,
                error: 'Upsert: ' + (up.error.message || up.error.code || 'unknown')
            };
        }

        const ins = await window.sbResults
            .from('tgc_special_moves')
            .insert(payload);

        if (ins.error) {
            return {
                ok: false,
                error: 'Insert: ' + (ins.error.message || ins.error.code || 'unknown')
            };
        }

        return { ok: true };
    } catch (e) {
        console.error('[Special] save exception:', e);
        return { ok: false, error: 'Exception: ' + (e && e.message ? e.message : String(e)) };
    }
}

/* =========================================================
   5) OPPONENT
========================================================= */

async function csLoadOpponent(team, round) {
    if (!window.sbResults || !team) return null;
    try {
        const { data, error } = await window.sbResults
            .from('tgc_matches')
            .select('home_team, away_team, stage, group_name, round_num, gw, is_played')
            .or('home_team.eq.' + team + ',away_team.eq.' + team);
        if (error) throw error;
        if (!data || data.length === 0) return null;

        const meta = (window.champData && window.champData.meta) || {};
        const startGw = meta.start_gw || CS_GROUP_START_GW;
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
        console.warn('[Special] opponent load error:', e);
        return null;
    }
}

/* =========================================================
   6) MANAGERS LOAD
========================================================= */

async function csLoadAllManagers() {
    if (csState.allManagers) return csState.allManagers;
    try {
        if (typeof tgcGetAllManagers === 'function') {
            csState.allManagers = await tgcGetAllManagers();
        } else {
            csState.allManagers = [];
        }
    } catch (e) {
        console.warn('[Special] managers load failed:', e);
        csState.allManagers = [];
    }
    return csState.allManagers;
}

/* ⭐ v8: إصلاح اختفاء المديرين (Fallback) */
async function csGetTeamManagersAsync(teamCode) {
    let teamName = teamCode;
    if (typeof teamsMap !== 'undefined' && teamsMap[teamCode]) {
        teamName = teamsMap[teamCode].name || teamCode;
    }

    // 1. جلب أسماء المديرين من قاعدة البيانات
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
        console.warn('[Special] managers_by_team load failed:', e);
    }

    // Fallback إذا كانت قاعدة البيانات فارغة
    if (names.length === 0 && typeof PLAYERS_TEAMS !== 'undefined' && PLAYERS_TEAMS[teamName]) {
        names = PLAYERS_TEAMS[teamName].slice();
    }

    const managers = csState.allManagers || [];

    // 2. مطابقة الأسماء مع الـ API
    const byName = {};
    managers.forEach(function(m) {
        const name = m.player_name || m.entry_name;
        if (name) {
            const key = (typeof normalizePlayerName === 'function')
                ? normalizePlayerName(name)
                : name.toLowerCase().trim();
            byName[key] = m;
        }
    });

    const result = [];
    const matchedEntries = new Set();

    // المرحلة الأولى: البحث بالاسم
    names.forEach(function(name) {
        const key = (typeof normalizePlayerName === 'function')
            ? normalizePlayerName(name)
            : name.toLowerCase().trim();
        const m = byName[key];
        
        if (m && m.entry) {
            result.push({
                name: name,
                entry: Number(m.entry),
                displayName: (m.entry_name && m.entry_name !== name) ? (m.entry_name + ' · ' + name) : name,
                lastPoints: m.event_total || 0
            });
            matchedEntries.add(Number(m.entry));
        } else {
            // المرحلة الثانية: إذا لم يجد الاسم، نضع المدير في القائمة بدون Entry مؤقتاً
            result.push({
                name: name,
                entry: null,
                displayName: name,
                lastPoints: 0
            });
        }
    });

    // ⭐ v10: المرحلة الثانية-ب: مطابقة أوسع (الاسم يحتوي الآخر / كلمات مشتركة) للأسماء غير المطابقة
    const norm = function(n) {
        return ((typeof normalizePlayerName === 'function') ? normalizePlayerName(n) : String(n).toLowerCase().trim());
    };
    const nationOf = function(m) {
        const L = (m.leagues || []).concat(m.nation ? [m.nation] : []).map(function(x) { return String(x).toUpperCase(); });
        return L.indexOf(String(teamCode).toUpperCase()) !== -1;
    };
    const pool = managers.filter(function(m) { return m.entry && !matchedEntries.has(Number(m.entry)) && nationOf(m); });

    result.forEach(function(r) {
        if (r.entry) return;
        const k = norm(r.name);
        const kw = k.split(/\s+/).filter(function(w) { return w.length > 2; });
        let hit = null;
        for (let i = 0; i < pool.length; i++) {
            const pm = pool[i];
            const pk = norm(pm.player_name || pm.entry_name || '');
            if (!pk) continue;
            const common = kw.filter(function(w) { return pk.indexOf(w) !== -1; }).length;
            if (pk.indexOf(k) !== -1 || k.indexOf(pk) !== -1 || (kw.length && common >= Math.min(2, kw.length))) { hit = pm; break; }
        }
        if (hit) {
            r.entry = Number(hit.entry);
            r.lastPoints = hit.event_total || 0;
            matchedEntries.add(r.entry);
            pool.splice(pool.indexOf(hit), 1);
        }
    });

    // المرحلة الثالثة: أي مدير فعلي من نفس الدولة لم يُطابَق بالاسم يُضاف بالقوة (باسمه من الـ API)
    // وتُحذف الأسماء التي بقيت بلا Entry حتى لا تشغل مكان مدير حقيقي
    const final = result.filter(function(r) { return r.entry; });
    pool.forEach(function(m) {
        if (matchedEntries.has(Number(m.entry))) return;
        if (final.length >= 13) return;
        const nm = m.player_name || m.entry_name || ('Player #' + m.entry);
        final.push({ name: nm, entry: Number(m.entry),
            displayName: (m.entry_name && m.player_name && m.entry_name !== m.player_name) ? (m.entry_name + ' · ' + m.player_name) : nm,
            lastPoints: m.event_total || 0 });
        matchedEntries.add(Number(m.entry));
    });

    return final;
}

/* =========================================================
   7) CHECK CONFIG DEADLINE
========================================================= */

function csIsConfigWindowOpen() {
    const round = csGetRound();
    const startGw = (window.champData && window.champData.meta &&
        window.champData.meta.start_gw) || CS_GROUP_START_GW;
    if (round < startGw - 1) return true;
    return round < startGw;
}

/* =========================================================
   8) MAIN — RENDER LINEUP (المدخل)
========================================================= */

async function csCheckConfigGate(team) {
    csState.team = team;

    const config = await csLoadConfig(team);

    if (config && config.locked) {
        csState.config = config;
        csState.usedBefore = await csLoadUsedBefore(team, csGetRound());

        if (!csState.savedMoves || Object.keys(csState.savedMoves).length === 0) {
            const round = csGetRound();
            csState.round = round;
            try {
                csState.savedMoves = await csLoadMyMovesForRound(round, team) || {};
            } catch (e) {
                console.warn('[Special] moves load in gate failed:', e);
                csState.savedMoves = {};
            }
        }

        return null;
    }

    csState.config = null;
    return csRenderConfigGate();
}

/* =========================================================
   9) CONFIG GATE — اختيار 4 من 5
========================================================= */

function csRenderConfigGate() {
    const team = csState.team || csGetCaptainTeam();
    const captainName = csState.captainName || csGetCaptainName();

    const logo = csGetTeamLogo(team);
    const teamName = csGetTeamName(team);

    let html = '';

    html += '<div class="champ-special-intro">';
    html += '<h2>' + csIcon('target', 'fill') + ' Special Moves</h2>';
    html += '<p>اختر <strong>4 خواص</strong> من أصل 5.<br>';
    html += 'ستتنازل عن خاصية واحدة نهائياً طول البطولة.</p>';
    html += '</div>';

    html += '<div class="cs-captain-bar">';
    html += '<div class="cs-captain-bar-logo">';
    if (logo) {
        html += '<img src="./' + logo + '" ' +
            'onerror="this.style.display=\'none\'">';
    }
    html += '</div>';
    html += '<div class="cs-captain-bar-info">';
    html += '<div class="cs-captain-bar-team">' + teamName + '</div>';
    html += '<div class="cs-captain-bar-meta">' + captainName + '</div>';
    html += '</div>';
    html += '<div class="cs-captain-bar-badge">' +
        csIcon('crown', 'fill') + '</div>';
    html += '</div>';

    html += '<div class="cs-config-progress">';
    html += '<div class="cs-config-progress-text">Selected: ';
    html += '<span id="csConfigCount">' +
        csState.configSelection.length + '</span>';
    html += ' / ' + CS_TOTAL_CHOICES + '</div>';
    html += '<div class="cs-config-progress-bar">';
    const percent = Math.round((csState.configSelection.length /
        CS_TOTAL_CHOICES) * 100);
    html += '<div class="cs-config-progress-fill' +
        (csState.configSelection.length === CS_TOTAL_CHOICES ? ' full' : '') +
        '" style="width:' + percent + '%;"></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="cs-config-grid">';
    CS_MOVES_CONFIG.forEach(function(move) {
        html += csRenderConfigCard(move);
    });
    html += '</div>';

    html += '<div class="cs-config-actions">';
    if (csState.configSelection.length === CS_TOTAL_CHOICES) {
        html += '<button type="button" class="cs-config-save-btn" ' +
            'id="csConfigSaveBtn" onclick="csSaveConfigHandler()">';
        html += csIcon('check-circle', 'fill') + ' حفظ الخواص النهائية';
        html += '</button>';
    } else {
        html += '<button type="button" class="cs-config-save-btn" disabled>';
        html += csIcon('check-circle', 'fill') + ' اختر ' +
            (CS_TOTAL_CHOICES - csState.configSelection.length) +
            ' خواص إضافية';
        html += '</button>';
    }
    html += '</div>';

    html += '<div class="cs-config-warning">';
    html += csIcon('warning', 'fill') + ' <span>تحذير: بعد الحفظ، لن تتمكن من تغيير خواصك أبداً.</span>';
    html += '</div>';

    return html;
}

function csRenderConfigCard(move) {
    const isSelected = csState.configSelection.indexOf(move.id) !== -1;
    const cls = 'cs-config-card' + (isSelected ? ' cs-config-card-selected' : '');

    let html = '<div class="' + cls + '" data-move="' + move.id + '" ';
    html += 'onclick="csToggleMoveSelection(\'' + move.id + '\')">';

    html += '<div class="cs-config-card-icon" data-color="' +
        move.color + '">' + csIcon(move.icon, 'fill') + '</div>';

    html += '<div class="cs-config-card-title-wrap">';
    html += '<div class="cs-config-card-title">' + move.name + '</div>';
    html += '<div class="cs-config-card-subtitle">' + move.nameAr + '</div>';
    html += '</div>';

    html += '<div class="cs-config-card-desc">' + move.desc + '</div>';

    html += '<div class="cs-config-card-check">';
    html += csIcon('check-circle', 'fill');
    html += '</div>';

    html += '</div>';
    return html;
}

function csToggleMoveSelection(moveId) {
    const idx = csState.configSelection.indexOf(moveId);

    if (idx !== -1) {
        csState.configSelection.splice(idx, 1);
    } else {
        if (csState.configSelection.length >= CS_TOTAL_CHOICES) {
            if (typeof showToast === 'function') {
                showToast('لا يمكن اختيار أكثر من ' + CS_TOTAL_CHOICES + ' خواص', false, 2500);
            }
            return;
        }
        csState.configSelection.push(moveId);
    }

    csUpdateConfigGateUI();
}

function csUpdateConfigGateUI() {
    document.querySelectorAll('.cs-config-card').forEach(function(card) {
        const moveId = card.getAttribute('data-move');
        const isSelected = csState.configSelection.indexOf(moveId) !== -1;
        card.classList.toggle('cs-config-card-selected', isSelected);
    });

    const countEl = document.getElementById('csConfigCount');
    if (countEl) countEl.textContent = csState.configSelection.length;

    const fillEl = document.querySelector('.cs-config-progress-fill');
    if (fillEl) {
        const pct = Math.round((csState.configSelection.length /
            CS_TOTAL_CHOICES) * 100);
        fillEl.style.width = pct + '%';
        if (csState.configSelection.length === CS_TOTAL_CHOICES) {
            fillEl.classList.add('full');
        } else {
            fillEl.classList.remove('full');
        }
    }

    const actionsEl = document.querySelector('.cs-config-actions');
    if (actionsEl) {
        if (csState.configSelection.length === CS_TOTAL_CHOICES) {
            actionsEl.innerHTML =
                '<button type="button" class="cs-config-save-btn" ' +
                'id="csConfigSaveBtn" onclick="csSaveConfigHandler()">' +
                csIcon('check-circle', 'fill') + ' حفظ الخواص النهائية' +
                '</button>';
        } else {
            const remain = CS_TOTAL_CHOICES - csState.configSelection.length;
            actionsEl.innerHTML =
                '<button type="button" class="cs-config-save-btn" disabled>' +
                csIcon('check-circle', 'fill') + ' اختر ' + remain +
                ' خواص إضافية' +
                '</button>';
        }
    }
}

async function csSaveConfigHandler() {
    if (csState.isSaving) return;
    if (csState.configSelection.length !== CS_TOTAL_CHOICES) return;

    const team = csState.team || csGetCaptainTeam();
    if (!team) {
        if (typeof showToast === 'function') showToast('Missing team', false);
        return;
    }

    const chosen = csState.configSelection.slice();
    const allIds = CS_MOVES_CONFIG.map(function(m) { return m.id; });
    const dropped = allIds.find(function(id) {
        return chosen.indexOf(id) === -1;
    });

    const droppedConfig = csGetMoveConfig(dropped);
    const droppedName = droppedConfig ? droppedConfig.name : dropped;

    if (!confirm('سيتم حفظ خواصك النهائية.\n\n' +
        'الخواص المختارة: ' + chosen.length + '\n' +
        'ستتنازل عن: ' + droppedName + '\n\n' +
        'هذا الإجراء نهائي ولا يمكن التراجع عنه.\n\nهل أنت متأكد؟')) {
        return;
    }

    csState.isSaving = true;

    const btn = document.getElementById('csConfigSaveBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = csIcon('hourglass', 'bold') + ' Saving...';
    }

    const ok = await csSaveConfig(team, chosen, dropped);

    if (ok) {
        if (typeof showToast === 'function') {
            showToast('تم حفظ الخواص النهائية', true, 3000);
        }
        if (navigator.vibrate) navigator.vibrate([30, 20, 50]);

        csState.config = {
            team: team,
            chosen_moves: chosen,
            dropped_move: dropped,
            locked: true
        };

        if (typeof champCaptainsRenderLineup === 'function') {
            await champCaptainsRenderLineup();
        }
    } else {
        if (typeof showToast === 'function') showToast('فشل الحفظ', false);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = csIcon('check-circle', 'fill') +
                ' حفظ الخواص النهائية';
        }
    }

    csState.isSaving = false;
}

/* =========================================================
   10) INLINE — 4 خواص فوق الملعب
========================================================= */

function csRenderSpecialInline() {
    const team = csState.team || csGetCaptainTeam();
    if (!team) return '';

    if (!csState.config || !csState.config.locked) return '';

    const chosenMoves = csState.config.chosen_moves || [];
    const round = csGetRound();

    let usedCount = 0;
    chosenMoves.forEach(function(moveId) {
        if (csState.savedMoves && csState.savedMoves[moveId]) usedCount++;
    });

    let html = '';

    html += '<div class="cs-inline-header">';
    html += '<div class="cs-inline-title">' +
        csIcon('target', 'fill') + ' Special Moves' +
        '</div>';
    html += '<div class="cs-inline-count">' +
        usedCount + ' / 1 ' +
        '<span class="cs-inline-count-label">used</span>' +
        '</div>';
    html += '</div>';

    html += '<div class="cs-inline-scroll">';
    chosenMoves.forEach(function(moveId) {
        const move = csGetMoveConfig(moveId);
        if (!move) return;
        html += csRenderInlineCard(move);
    });
    html += '</div>';

    return html;
}

function csRenderInlineCard(move) {
    const saved = csState.savedMoves ? csState.savedMoves[move.id] : null;
    const isUsed = !!saved;
    const lockedRound = (!isUsed && csState.usedBefore) ? csState.usedBefore[move.id] : null;

    let cls = 'cs-inline-card';
    if (isUsed) cls += ' cs-inline-card-used';
    if (lockedRound) cls += ' cs-inline-card-locked';

    let statusBadge = '';
    if (isUsed) {
        const status = saved.status || 'pending';
        if (status === 'pending' || status === 'active' || status === 'resolved') {
            statusBadge = '<span class="cs-inline-badge cs-inline-badge-active">' +
                csIcon('check-circle', 'fill') + '</span>';
        } else {
            statusBadge = '<span class="cs-inline-badge cs-inline-badge-used">' +
                csIcon('lock', 'fill') + '</span>';
        }
    }

    if (lockedRound) {
        statusBadge = '<span class="cs-inline-badge cs-inline-badge-used">' +
            csIcon('lock', 'fill') + '</span>';
    }

    let html = '<button type="button" class="' + cls + '" data-move="' + move.id + '" ';
    html += 'onclick="csOpenMoveModal(\'' + move.id + '\')">';
    html += '<div class="cs-inline-icon">' + csIcon(move.icon, 'fill') + '</div>';
    html += '<div class="cs-inline-name">' + move.name + '</div>';
    html += '<div class="cs-inline-name-ar">' + move.nameAr + '</div>';
    if (lockedRound) html += '<div class="cs-inline-used-note">استُخدمت · ج' + lockedRound + '</div>';
    if (statusBadge) html += statusBadge;
    html += '</button>';

    return html;
}

/* =========================================================
   11) ACTIVATION — OPEN MOVE MODAL
========================================================= */

async function csOpenMoveModal(moveType) {
    const move = csGetMoveConfig(moveType);
    if (!move) return;

    csState.team = csState.team || csGetCaptainTeam();
    if (!csState.team) {
        if (typeof showToast === 'function') showToast('Captain access required', false);
        return;
    }

    const chosen = (csState.config && csState.config.chosen_moves) || [];
    if (chosen.indexOf(moveType) === -1) {
        if (typeof showToast === 'function') {
            showToast('هذه الخاصية غير متاحة لك', false, 2500);
        }
        return;
    }

    const currentRound = csGetRound();
    csState.usedBefore = await csLoadUsedBefore(csState.team, currentRound);
    if (csState.usedBefore[moveType] && !(csState.savedMoves && csState.savedMoves[moveType])) {
        if (typeof showToast === 'function') {
            showToast('هذه الخاصية استُخدمت في الجولة ' + csState.usedBefore[moveType] + ' وهي مقفلة', false, 3500);
        }
        csRefreshInline();
        return;
    }
    const savedThisRound = csState.savedMoves || {};
    const activeThisRound = Object.keys(savedThisRound).filter(function(k) {
        return savedThisRound[k];
    });

    if (activeThisRound.length > 0 && activeThisRound.indexOf(moveType) === -1) {
        if (typeof showToast === 'function') {
            showToast('يمكنك تفعيل خاصية واحدة فقط في الجولة', false, 3000);
        }
        return;
    }

    csState.round = currentRound;

    csAssassinSelection = [];
    csH2HState = { myManager: null, oppManager: null };
    csCleanSheetSelection = null;

    if (!csState.allManagers) {
        await csLoadAllManagers();
    }

    if (!csState.opponentTeam) {
        const opp = await csLoadOpponent(csState.team, currentRound);
        csState.opponentTeam = opp ? opp.opponent : null;
    }

    const existing = document.getElementById('csMoveModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'csMoveModal';
    modal.className = 'cs-modal show';
    modal.innerHTML = '<div class="cs-modal-box"><div class="cs-loading">' +
        '<div class="cs-spinner"></div>' +
        '<div>Loading...</div></div></div>';
    document.body.appendChild(modal);

    let content = '';
    if (moveType === 'revival') {
        content = csRenderRevivalModal(move);
    } else if (moveType === 'assassination') {
        content = await csRenderAssassinationModal(move);
    } else if (moveType === 'h2h') {
        content = await csRenderH2HModal(move);
    } else if (moveType === 'sniper') {
        content = csRenderSniperModal(move);
    } else if (moveType === 'clean_sheet') {
        content = csRenderCleanSheetModal(move);
    }

    modal.innerHTML = content;

    const saved = savedThisRound[moveType];
    if (saved) {
        csPopulateSavedData(moveType, saved);
    }
}

function csCloseMoveModal() {
    const modal = document.getElementById('csMoveModal');
    if (modal) modal.remove();
}

function csRenderModalActions(btnId, btnText, btnIcon, onClickFn) {
    let html = '';
    html += '<div class="cs-modal-actions">';
    html += '<button type="button" class="cs-modal-cancel-btn" ' +
        'onclick="csCloseMoveModal()">إلغاء</button>';
    html += '<button type="button" class="cs-modal-confirm-btn" id="' + btnId + '" ' +
        'onclick="' + onClickFn + '">' +
        csIcon(btnIcon || 'check-circle', 'bold') + ' ' + btnText +
        '</button>';
    html += '</div>';
    return html;
}

function csRenderNoOpponent() {
    return '' +
        '<div class="cs-modal-box">' +
            '<button type="button" class="cs-modal-close" ' +
                'onclick="csCloseMoveModal()">✕</button>' +
            '<div class="cs-no-opponent">' +
                '<div class="cs-no-opponent-icon">' +
                    csIcon('calendar-blank', 'duotone') + '</div>' +
                '<div class="cs-no-opponent-title">' +
                    'ناديك لم يلعب هذه الجولة' + '</div>' +
                '<div class="cs-no-opponent-sub">' +
                    'انتظر الجولة القادمة' + '</div>' +
            '</div>' +
        '</div>';
}

function csIsCaptainEntry(entry, teamCode) {
    if (typeof champCaptains !== 'undefined' && champCaptains.allCaptains) {
        const c = champCaptains.allCaptains[teamCode];
        if (c && c.captain_entry === entry) return true;
    }
    return false;
}

/* =========================================================
   12) REVIVAL MODAL
========================================================= */

function csRenderRevivalModal(move) {
    if (!csState.opponentTeam) {
        return csRenderNoOpponent();
    }

    const oppLogo = csGetTeamLogo(csState.opponentTeam);
    const oppName = csGetTeamName(csState.opponentTeam);

    let html = '<div class="cs-modal-box">';
    html += '<button type="button" class="cs-modal-close" ' +
        'onclick="csCloseMoveModal()">✕</button>';
    html += '<div class="cs-modal-title" style="color:#10B981;">' +
        csIcon('heartbeat', 'fill') + ' Revival</div>';
    html += '<div class="cs-modal-sub">' + move.descAr + '</div>';

    html += '<div class="cs-move-opponent-display">';
    html += '<div class="cs-move-opponent-label">الخصم:</div>';
    html += '<div class="cs-move-opponent-info">';
    if (oppLogo) {
        html += '<img src="./' + oppLogo + '" ' +
            'onerror="this.style.display=\'none\'">';
    }
    html += '<span>' + oppName + '</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="cs-move-info-box">';
    html += csIcon('info', 'fill') + ' <span>سيتم تسجيل نيتك لإعادة المباراة في حالة خسارتك بفارق 10 نقاط أو أقل.</span>';
    html += '</div>';

    html += csRenderModalActions(
        'csRevivalSaveBtn',
        'تأكيد التفعيل',
        'check-circle',
        'csSaveRevival()'
    );

    html += '</div>';
    return html;
}

async function csSaveRevival() {
    if (!csState.opponentTeam) return;

    const btn = document.getElementById('csRevivalSaveBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = csIcon('hourglass', 'bold') + ' Saving...'; }

    const result = await csSaveMove(
        csState.round,
        csState.team,
        'revival',
        csState.opponentTeam,
        { opponent: csState.opponentTeam }
    );

    if (result.ok) {
        if (typeof showToast === 'function') showToast('تم تفعيل Revival', true);
        if (!csState.savedMoves) csState.savedMoves = {};
        csState.savedMoves['revival'] = {
            status: 'pending',
            target_team: csState.opponentTeam,
            move_data: { opponent: csState.opponentTeam }
        };
        csCloseMoveModal();
        csRefreshInline();
    } else {
        console.error('[Special] Revival save failed:', result.error);
        if (typeof showToast === 'function') showToast('فشل: ' + result.error, false, 8000);
        if (btn) { btn.disabled = false; btn.innerHTML = csIcon('check-circle', 'bold') + ' تأكيد التفعيل'; }
    }
}

/* =========================================================
   13) ASSASSINATION MODAL
========================================================= */

async function csRenderAssassinationModal(move) {
    if (!csState.opponentTeam) {
        return csRenderNoOpponent();
    }

    const oppName = csGetTeamName(csState.opponentTeam);

    let html = '<div class="cs-modal-box">';
    html += '<button type="button" class="cs-modal-close" ' +
        'onclick="csCloseMoveModal()">✕</button>';
    html += '<div class="cs-modal-title" style="color:#B8253F;">' +
        csIcon('knife', 'fill') + ' Assassination</div>';
    html += '<div class="cs-modal-sub">' + move.descAr + '</div>';

    html += '<div class="cs-move-opponent-display">';
    html += '<div class="cs-move-opponent-label">الخصم:</div>';
    html += '<div class="cs-move-opponent-info">';
    html += '<span>' + oppName + '</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="cs-picker-count">';
    html += '<span>اختر مديرين:</span>';
    html += '<span id="csAssassinCount" class="cs-picker-count-value">0 / 2</span>';
    html += '</div>';

    html += '<div class="cs-manager-picker" id="csAssassinManagerPicker">';

    const managers = await csGetTeamManagersAsync(csState.opponentTeam);

    managers.forEach(function(m) {
        if (!m.entry) return;

        const isCap = csIsCaptainEntry(m.entry, csState.opponentTeam);
        const cls = 'cs-manager-option' + (isCap ? ' cs-manager-immune' : '');

        html += '<div class="' + cls + '" ';
        html += 'data-entry="' + m.entry + '" ';
        html += 'data-name="' + csEscapeAttr(m.displayName) + '" ';
        if (!isCap) {
            html += 'onclick="csToggleAssassinManager(this)"';
        }
        html += '>';

        const logo = csGetTeamLogo(csState.opponentTeam);
        if (logo) {
            html += '<img src="./' + logo + '" ' +
                'onerror="this.style.display=\'none\'">';
        }

        html += '<div class="cs-manager-option-info">';
        html += '<div class="cs-manager-option-name">' + m.displayName + '</div>';
        html += '<div class="cs-manager-option-points">#' + m.entry +
            (isCap ? ' · قائد (محصّن)' : '') + '</div>';
        html += '</div>';

        if (isCap) {
            html += '<div class="cs-manager-immune-badge">' +
                csIcon('shield-check', 'fill') + '</div>';
        }

        html += '</div>';
    });

    html += '</div>';

    html += csRenderModalActions(
        'csAssassinSaveBtn',
        'تأكيد الاغتيال',
        'knife',
        'csSaveAssassination()'
    );

    html += '</div>';
    return html;
}

let csAssassinSelection = [];

function csToggleAssassinManager(el) {
    const entry = parseInt(el.dataset.entry, 10);
    const idx = csAssassinSelection.indexOf(entry);

    if (idx !== -1) {
        csAssassinSelection.splice(idx, 1);
        el.classList.remove('selected');
    } else {
        if (csAssassinSelection.length >= 2) {
            if (typeof showToast === 'function') {
                showToast('الحد الأقصى مديرين', false, 2000);
            }
            return;
        }
        csAssassinSelection.push(entry);
        el.classList.add('selected');
    }

    const countEl = document.getElementById('csAssassinCount');
    if (countEl) {
        countEl.textContent = csAssassinSelection.length + ' / 2';
    }
}

async function csSaveAssassination() {
    if (!csState.opponentTeam) return;

    if (csAssassinSelection.length !== 2) {
        if (typeof showToast === 'function') {
            showToast('اختر مديرين بالضبط', false, 2500);
        }
        return;
    }

    const btn = document.getElementById('csAssassinSaveBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = csIcon('hourglass', 'bold') + ' Saving...'; }

    const result = await csSaveMove(
        csState.round,
        csState.team,
        'assassination',
        csState.opponentTeam,
        { blocked_entries: csAssassinSelection.slice() }
    );

    if (result.ok) {
        if (typeof showToast === 'function') showToast('تم تفعيل Assassination', true);
        if (!csState.savedMoves) csState.savedMoves = {};
        csState.savedMoves['assassination'] = {
            status: 'pending',
            target_team: csState.opponentTeam,
            move_data: { blocked_entries: csAssassinSelection.slice() }
        };
        csCloseMoveModal();
        csRefreshInline();
    } else {
        console.error('[Special] Assassination save failed:', result.error);
        if (typeof showToast === 'function') showToast('فشل: ' + result.error, false, 8000);
        if (btn) { btn.disabled = false; btn.innerHTML = csIcon('knife', 'bold') + ' تأكيد الاغتيال'; }
    }
}

/* =========================================================
   14) HEAD-TO-HEAD MODAL
========================================================= */

let csH2HState = {
    myManager: null,
    oppManager: null
};

async function csRenderH2HModal(move) {
    if (!csState.opponentTeam) {
        return csRenderNoOpponent();
    }

    const oppName = csGetTeamName(csState.opponentTeam);
    const myTeam = csState.team;

    let html = '<div class="cs-modal-box">';
    html += '<button type="button" class="cs-modal-close" ' +
        'onclick="csCloseMoveModal()">✕</button>';
    html += '<div class="cs-modal-title" style="color:#A78BFA;">' +
        csIcon('sword', 'fill') + ' Head-to-Head</div>';
    html += '<div class="cs-modal-sub">' + move.descAr + '</div>';

    html += '<div class="cs-move-opponent-display">';
    html += '<div class="cs-move-opponent-label">الخصم:</div>';
    html += '<div class="cs-move-opponent-info">';
    html += '<span>' + oppName + '</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="cs-picker-section">';
    html += '<div class="cs-picker-label">' +
        csIcon('user-focus', 'fill') + ' مدير من فريقك</div>';
    html += '<div class="cs-manager-picker" id="csH2HMyPicker">';

    const myManagers = await csGetTeamManagersAsync(myTeam);
    myManagers.forEach(function(m) {
        if (!m.entry) return;
        html += '<div class="cs-manager-option" ';
        html += 'data-entry="' + m.entry + '" ';
        html += 'data-name="' + csEscapeAttr(m.displayName) + '" ';
        html += 'onclick="csSelectH2HMyManager(this)">';

        const logo = csGetTeamLogo(myTeam);
        if (logo) {
            html += '<img src="./' + logo + '" ' +
                'onerror="this.style.display=\'none\'">';
        }
        html += '<div class="cs-manager-option-info">';
        html += '<div class="cs-manager-option-name">' +
            m.displayName + '</div>';
        html += '<div class="cs-manager-option-points">#' + m.entry + '</div>';
        html += '</div>';
        html += '</div>';
    });

    html += '</div></div>';

    html += '<div class="cs-picker-section">';
    html += '<div class="cs-picker-label">' +
        csIcon('user', 'fill') + ' مدير من الخصم</div>';
    html += '<div class="cs-manager-picker" id="csH2HOppPicker">';

    const oppManagers = await csGetTeamManagersAsync(csState.opponentTeam);
    oppManagers.forEach(function(m) {
        if (!m.entry) return;
        html += '<div class="cs-manager-option" ';
        html += 'data-entry="' + m.entry + '" ';
        html += 'data-name="' + csEscapeAttr(m.displayName) + '" ';
        html += 'onclick="csSelectH2HOppManager(this)">';

        const logo = csGetTeamLogo(csState.opponentTeam);
        if (logo) {
            html += '<img src="./' + logo + '" ' +
                'onerror="this.style.display=\'none\'">';
        }
        html += '<div class="cs-manager-option-info">';
        html += '<div class="cs-manager-option-name">' +
            m.displayName + '</div>';
        html += '<div class="cs-manager-option-points">#' + m.entry + '</div>';
        html += '</div>';
        html += '</div>';
    });

    html += '</div></div>';

    html += csRenderModalActions(
        'csH2HSaveBtn',
        'تأكيد Head-to-Head',
        'sword',
        'csSaveH2H()'
    );

    html += '</div>';
    return html;
}

function csSelectH2HMyManager(el) {
    const parent = el.parentElement;
    parent.querySelectorAll('.cs-manager-option').forEach(function(item) {
        item.classList.remove('selected');
    });
    el.classList.add('selected');
    csH2HState.myManager = {
        entry: parseInt(el.dataset.entry, 10),
        name: el.dataset.name
    };
}

function csSelectH2HOppManager(el) {
    const parent = el.parentElement;
    parent.querySelectorAll('.cs-manager-option').forEach(function(item) {
        item.classList.remove('selected');
    });
    el.classList.add('selected');
    csH2HState.oppManager = {
        entry: parseInt(el.dataset.entry, 10),
        name: el.dataset.name
    };
}

async function csSaveH2H() {
    if (!csState.opponentTeam) return;

    if (!csH2HState.myManager || !csH2HState.oppManager) {
        if (typeof showToast === 'function') {
            showToast('اختر مدير من كل فريق', false, 2500);
        }
        return;
    }

    const btn = document.getElementById('csH2HSaveBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = csIcon('hourglass', 'bold') + ' Saving...'; }

    const result = await csSaveMove(
        csState.round,
        csState.team,
        'h2h',
        csState.opponentTeam,
        {
            my_entry: csH2HState.myManager.entry,
            my_name: csH2HState.myManager.name,
            opponent_entry: csH2HState.oppManager.entry,
            opponent_name: csH2HState.oppManager.name
        }
    );

    if (result.ok) {
        if (typeof showToast === 'function') showToast('تم تفعيل Head-to-Head', true);
        if (!csState.savedMoves) csState.savedMoves = {};
        csState.savedMoves['h2h'] = {
            status: 'pending',
            target_team: csState.opponentTeam,
            move_data: {
                my_entry: csH2HState.myManager.entry,
                my_name: csH2HState.myManager.name,
                opponent_entry: csH2HState.oppManager.entry,
                opponent_name: csH2HState.oppManager.name
            }
        };
        csCloseMoveModal();
        csRefreshInline();
    } else {
        console.error('[Special] H2H save failed:', result.error);
        if (typeof showToast === 'function') showToast('فشل: ' + result.error, false, 8000);
        if (btn) { btn.disabled = false; btn.innerHTML = csIcon('sword', 'bold') + ' تأكيد Head-to-Head'; }
    }
}

/* =========================================================
   15) SNIPER (GENERAL MOBILIZATION) MODAL
========================================================= */

function csRenderSniperModal(move) {
    if (!csState.opponentTeam) {
        return csRenderNoOpponent();
    }

    const oppName = csGetTeamName(csState.opponentTeam);

    let html = '<div class="cs-modal-box">';
    html += '<button type="button" class="cs-modal-close" ' +
        'onclick="csCloseMoveModal()">✕</button>';
    html += '<div class="cs-modal-title" style="color:#A855F7;">' +
        csIcon('target', 'fill') + ' General Mobilization</div>';
    html += '<div class="cs-modal-sub">' + move.descAr + '</div>';

    html += '<div class="cs-move-opponent-display">';
    html += '<div class="cs-move-opponent-label">الخصم:</div>';
    html += '<div class="cs-move-opponent-info">';
    html += '<span>' + oppName + '</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="cs-move-info-box">';
    html += csIcon('warning', 'fill') + ' <span>استخدام هذه الخاصية مرة واحدة فقط في البطولة.</span>';
    html += '</div>';

    html += csRenderModalActions(
        'csSniperSaveBtn',
        'تأكيد الاستنفار',
        'target',
        'csSaveSniper()'
    );

    html += '</div>';
    return html;
}

async function csSaveSniper() {
    if (!csState.opponentTeam) return;

    const btn = document.getElementById('csSniperSaveBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = csIcon('hourglass', 'bold') + ' Saving...'; }

    const result = await csSaveMove(
        csState.round,
        csState.team,
        'sniper',
        csState.opponentTeam,
        { doubled_match: csState.opponentTeam }
    );

    if (result.ok) {
        if (typeof showToast === 'function') showToast('تم تفعيل الاستنفار العام', true);
        if (!csState.savedMoves) csState.savedMoves = {};
        csState.savedMoves['sniper'] = {
            status: 'pending',
            target_team: csState.opponentTeam,
            move_data: { doubled_match: csState.opponentTeam }
        };
        csCloseMoveModal();
        csRefreshInline();
    } else {
        console.error('[Special] Sniper save failed:', result.error);
        if (typeof showToast === 'function') showToast('فشل: ' + result.error, false, 8000);
        if (btn) { btn.disabled = false; btn.innerHTML = csIcon('target', 'bold') + ' تأكيد الاستنفار'; }
    }
}

/* =========================================================
   16) CLEAN SHEET BET MODAL
========================================================= */

let csCleanSheetSelection = null;

function csRenderCleanSheetModal(move) {
    let html = '<div class="cs-modal-box">';
    html += '<button type="button" class="cs-modal-close" ' +
        'onclick="csCloseMoveModal()">✕</button>';
    html += '<div class="cs-modal-title" style="color:#5CBFEB;">' +
        csIcon('shield-check', 'fill') + ' Clean Sheet Bet</div>';
    html += '<div class="cs-modal-sub">' + move.descAr + '</div>';

    html += '<div class="cs-picker-section">';
    html += '<div class="cs-picker-label">' +
        csIcon('shield-star', 'fill') + ' اختر فريق EPL</div>';
    html += '<div class="cs-team-picker" id="csCleanSheetPicker">';

    CS_EPL_TEAMS.forEach(function(t) {
        html += '<div class="cs-team-option" data-team="' + t.code + '" ';
        html += 'onclick="csSelectCleanSheetTeam(this)">';
        html += '<span class="cs-team-option-name">' + t.name + '</span>';
        html += '</div>';
    });

    html += '</div></div>';

    html += csRenderModalActions(
        'csCleanSheetSaveBtn',
        'تأكيد الرهان',
        'shield-check',
        'csSaveCleanSheet()'
    );

    html += '</div>';
    return html;
}

function csSelectCleanSheetTeam(el) {
    const parent = el.parentElement;
    parent.querySelectorAll('.cs-team-option').forEach(function(item) {
        item.classList.remove('selected');
    });
    el.classList.add('selected');
    csCleanSheetSelection = el.dataset.team;
}

async function csSaveCleanSheet() {
    if (!csCleanSheetSelection) {
        if (typeof showToast === 'function') {
            showToast('اختر فريق', false, 2500);
        }
        return;
    }

    const btn = document.getElementById('csCleanSheetSaveBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = csIcon('hourglass', 'bold') + ' Saving...'; }

    const result = await csSaveMove(
        csState.round,
        csState.team,
        'clean_sheet',
        csCleanSheetSelection,
        { bet_team: csCleanSheetSelection }
    );

    if (result.ok) {
        if (typeof showToast === 'function') showToast('تم تفعيل الرهان', true);
        if (!csState.savedMoves) csState.savedMoves = {};
        csState.savedMoves['clean_sheet'] = {
            status: 'pending',
            target_team: csCleanSheetSelection,
            move_data: { bet_team: csCleanSheetSelection }
        };
        csCloseMoveModal();
        csRefreshInline();
    } else {
        console.error('[Special] CleanSheet save failed:', result.error);
        if (typeof showToast === 'function') showToast('فشل: ' + result.error, false, 8000);
        if (btn) { btn.disabled = false; btn.innerHTML = csIcon('check-circle', 'bold') + ' تأكيد الرهان'; }
    }
}

/* =========================================================
   17) POPULATE SAVED DATA
========================================================= */

function csPopulateSavedData(moveType, saved) {
    const data = saved.move_data || {};

    if (moveType === 'assassination' && data.blocked_entries) {
        csAssassinSelection = data.blocked_entries.slice();
        setTimeout(function() {
            data.blocked_entries.forEach(function(entry) {
                const el = document.querySelector(
                    '#csAssassinManagerPicker [data-entry="' + entry + '"]'
                );
                if (el) el.classList.add('selected');
            });
            const countEl = document.getElementById('csAssassinCount');
            if (countEl) countEl.textContent = data.blocked_entries.length + ' / 2';
        }, 50);
    }

    if (moveType === 'h2h') {
        setTimeout(function() {
            if (data.my_entry) {
                const myEl = document.querySelector(
                    '#csH2HMyPicker [data-entry="' + data.my_entry + '"]'
                );
                if (myEl) csSelectH2HMyManager(myEl);
            }
            if (data.opponent_entry) {
                const oppEl = document.querySelector(
                    '#csH2HOppPicker [data-entry="' + data.opponent_entry + '"]'
                );
                if (oppEl) csSelectH2HOppManager(oppEl);
            }
        }, 50);
    }

    if (moveType === 'clean_sheet' && data.bet_team) {
        setTimeout(function() {
            const el = document.querySelector(
                '#csCleanSheetPicker [data-team="' + data.bet_team + '"]'
            );
            if (el) el.classList.add('selected');
            csCleanSheetSelection = data.bet_team;
        }, 50);
    }
}

/* =========================================================
   18) REFRESH INLINE
========================================================= */

function csRefreshInline() {
    const lineupSlot = document.getElementById('ccLineupSpecialSlot');
    if (lineupSlot) {
        try {
            lineupSlot.innerHTML = csRenderSpecialInline();
        } catch (e) {
            console.warn('[Special] inline render failed:', e);
        }
        return;
    }
    if (typeof ccInjectSpecialSection === 'function') {
        try {
            ccInjectSpecialSection();
        } catch (e) {
            console.warn('[Special] inject failed:', e);
        }
    }
}

/* =========================================================
   19) RESET STATE (عند Logout)
========================================================= */

function csResetState() {
    Object.assign(csState, {
        team: null,
        captainName: null,
        round: 1,
        config: null,
        savedMoves: {},
        usedBefore: {},
        allManagers: null,
        opponentTeam: null,
        pickerState: {},
        configSelection: [],
        isSaving: false,
        isRendering: false
    });
    csAssassinSelection = [];
    csH2HState = { myManager: null, oppManager: null };
    csCleanSheetSelection = null;
}

/* =========================================================
   20) WINDOW EXPORTS
========================================================= */

window.csRenderSpecialTab = csRenderConfigGate;
window.csRenderSpecialInline = csRenderSpecialInline;
window.csCheckConfigGate = csCheckConfigGate;
window.csLoadConfig = csLoadConfig;
window.csSaveConfig = csSaveConfig;

window.csToggleMoveSelection = csToggleMoveSelection;
window.csUpdateConfigGateUI = csUpdateConfigGateUI;
window.csSaveConfigHandler = csSaveConfigHandler;

window.csOpenMoveModal = csOpenMoveModal;
window.csCloseMoveModal = csCloseMoveModal;

window.csToggleAssassinManager = csToggleAssassinManager;
window.csSaveAssassination = csSaveAssassination;

window.csSelectH2HMyManager = csSelectH2HMyManager;
window.csSelectH2HOppManager = csSelectH2HOppManager;
window.csSaveH2H = csSaveH2H;

window.csSaveRevival = csSaveRevival;
window.csSaveSniper = csSaveSniper;

window.csSelectCleanSheetTeam = csSelectCleanSheetTeam;
window.csSaveCleanSheet = csSaveCleanSheet;

window.csResetState = csResetState;
window.csLoadOpponent = csLoadOpponent;

window.CS_MOVES_CONFIG = CS_MOVES_CONFIG;
window.CS_TOTAL_CHOICES = CS_TOTAL_CHOICES;

window.csState = csState;
window.csLoadMyMovesForRound = csLoadMyMovesForRound;
window.csSetSavedMoves = function(moves) {
    if (csState) csState.savedMoves = moves || {};
};

console.log('[Special] champions-special.js v=10 loaded — قفل الخاصية + إصلاح اختفاء مديرين في H2H');
