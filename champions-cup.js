/* =========================================================
   champions-cup.js — v3
   - إصلاح: ccRenderTeams (لا throw على error object)
   - إصلاح: عرض الحالة الفارغة
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
var CC_WORKER = 'https://fpl-api.aaa117703.workers.dev';
var CC_SYNC_INTERVAL = 5 * 60 * 1000;

var ccState = {
    members: {},
    currentRound: 1,
    loading: false,
    lastSync: 0,
    syncTimer: null,
    _currentEdit: null
};

/* ========== HELPERS ========== */

function ccLog() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[CC]');
    console.log.apply(console, args);
}

function ccEscapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function ccGetSb() {
    return window.sbClient || null;
}

function ccFetch(url, timeout) {
    timeout = timeout || 10000;
    if (typeof fetchWithTimeout === 'function') {
        return fetchWithTimeout(url, {}, timeout);
    }
    return fetch(url);
}

/* ========== SYNC ========== */

async function ccSyncMembers() {
    if (ccState.loading) return { ok: false, error: 'already_loading' };
    ccState.loading = true;

    ccLog('بدء Sync الأعضاء...');
    var allMembers = {};

    for (var i = 0; i < CC_TEAMS_LIST.length; i++) {
        var teamCode = CC_TEAMS_LIST[i];
        var leagueId = CC_LEAGUES[teamCode];

        try {
            var res = await ccFetch(CC_WORKER + '/?type=league&id=' + leagueId, 10000);
            if (!res.ok) {
                ccLog('فشل ' + teamCode + ': HTTP ' + res.status);
                continue;
            }

            var data = await res.json();
            var results = (data.standings && data.standings.results) || [];
            ccLog(teamCode + ': ' + results.length + ' عضو');

            for (var j = 0; j < results.length; j++) {
                var m = results[j];
                var id = m.entry;
                if (!allMembers[id]) {
                    allMembers[id] = {
                        entry_id: id,
                        player_name: m.player_name || '',
                        entry_name: m.entry_name || '',
                        total: m.total || 0,
                        event_total: m.event_total || 0,
                        rank: m.rank || 0,
                        teams: [],
                        status: 'active',
                        source: 'auto'
                    };
                }
                if (allMembers[id].teams.indexOf(teamCode) === -1) {
                    allMembers[id].teams.push(teamCode);
                }
            }
        } catch(e) {
            ccLog('خطأ ' + teamCode + ': ' + e.message);
        }
    }

    var membersArr = [];
    for (var key in allMembers) {
        if (allMembers.hasOwnProperty(key)) membersArr.push(allMembers[key]);
    }
    ccLog('مجموع الأعضاء: ' + membersArr.length);

    var sb = ccGetSb();
    if (sb && membersArr.length > 0) {
        try {
            var rows = membersArr.map(function(m) {
                return {
                    entry_id: m.entry_id,
                    player_name: m.player_name,
                    entry_name: m.entry_name,
                    total: m.total,
                    event_total: m.event_total,
                    rank: m.rank,
                    teams: m.teams,
                    status: 'active',
                    source: 'auto',
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            });

            for (var k = 0; k < rows.length; k += 50) {
                var chunk = rows.slice(k, k + 50);
                var upRes = await sb
                    .from('champions_cup_members')
                    .upsert(chunk, { onConflict: 'entry_id' });
                if (upRes.error) ccLog('خطأ حفظ: ' + upRes.error.message);
            }

            ccLog('تم حفظ ' + rows.length + ' عضو في Supabase');
        } catch(e) {
            ccLog('خطأ Supabase: ' + e.message);
        }
    }

    ccState.members = allMembers;
    ccState.loading = false;
    ccState.lastSync = Date.now();
    return { ok: true, count: membersArr.length };
}

/* ========== GET ========== */

async function ccGetTeamMembers(teamCode) {
    var sb = ccGetSb();
    if (!sb) return [];

    try {
        var result = await sb.from('champions_cup_members').select('*');
        if (result.error) {
            ccLog('خطأ جلب: ' + result.error.message);
            return [];
        }
        if (!result.data) return [];

        var filtered = result.data.filter(function(m) {
            var teams = Array.isArray(m.teams) ? m.teams : [];
            return teams.indexOf(teamCode) !== -1;
        });
        filtered.sort(function(a, b) { return (b.total || 0) - (a.total || 0); });
        return filtered;
    } catch(e) {
        ccLog('خطأ: ' + e       .message);
        return [];
    if }
}

async function ccGetTeamPin(team (Code) {
    var sb = ccresultGetSb();
    if (!sb).error) return null;
    try {
        {
 var result = await sb.from('champions           _cup_pins').select(' ccpin').eq('team', teamLogCode).maybeSingle();
        if(' (result.error || !result.dataخط) return null;
        return resultأ.data.pin;
    } Supabase catch(e) { return null; }
}

async function ccGetSquad(teamCode, round) {
    var sb = ccGetSb();
    if (!sb) return null;
    try {
        var result = await sb.from('champions_cup_squads').select('*')
            .eq('team', teamCode).eq('round', round).maybeSingle();
        if (result.error || !result.data) return null;
        return result.data;
    } catch(e) { return null; }
}

async function ccSaveSquad(teamCode, round, squadData) {
    var sb = ccGetSb();
    if (!sb) return { ok: false, error: 'no_sb' };
    try {
        var result = await sb.from('champions_cup_squads').upsert({
            team: teamCode,
            round: round,
            starters: squadData.starters || [],
            bench: squadData.bench || [],
            bonus: squadData.bonus || [],
            updated_at: new Date().toISOString()
        }, { onConflict: 'team,round' });
        if (result.error) return { ok: false, error: result.error.message };
        return { ok: true };
    } catch(e) {
        return { ok: false, error: e.message };
    }
}

/* ========== RENDER TEAMS ========== */

async function ccRenderTeams() {
    var container = document.getElementById('ccTeamsGrid');
    if (!container) return;

    container.innerHTML = '<div class="cc-loading">جاري التحميل...</div>';

    var sb = ccGetSb();
    if (!sb) {
        container.innerHTML = '<div class="cc-error">Supabase غير متوفر</div>';
        return;
    }

    try {
        var result = await sb.from('champions_cup_members').select('*');

: ' + result.error.message);
            container.innerHTML = '<div class="cc-error">فشل الاتصال بـ Supabase</div>';
            return;
        }

        var data = result.data        || [];
        ccLog('عدد الأعضاء في '</ Supabase: ' + data.length);

       div /* تجميع حسب الفريق */
        var> by';

Team = {};
        for (var k    = 0; k < CC_TEAMS_LIST.length; k++) {
            byTeam[CC_TEAMS_LIST[k]] = [];
        }

        for (var i = 0; i < data.length; i++) {
            var m = data[i];
            var teams = Array.isArray(m.teams) ? m.teams : [];
            for (var j = 0; j < teams.length; j++) {
                if (byTeam[teams[j]]) byTeam[teams[j]].push(m);
            }
        }

        /* ترتيب */
        for (var code in byTeam) {
            if (byTeam.hasOwnProperty(code)) {
                byTeam[code].sort(function(a, b) {
                    return (b.total || 0) - (a.total || 0);
                });
            }
        }

        /* بناء HTML */
        var html = '';
        var totalCount = 0;

        for (var ci = 0; ci < CC_TEAMS_LIST.length; ci++) {
            var tc = CC_TEAMS_LIST[ci];
            var name = CC_TEAM_NAMES[tc];
            var members = byTeam[tc] || [];
            totalCount += members.length;

            var logo = '';
            if (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[name]) {
                logo = TEAMS_LOGOS[name];
            }

            html += '<div class="cc-team-card" data-team="' + tc + '">' +
                '<div class="cc-team-logo">' +
                    (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'">' : '') +
                '</div>' +
                '<div class="cc-team-info">' +
                    '<div class="cc-team-name">' + ccEscapeHTML(name) + '</div>' +
                    '<div class="cc-team-count">' + members.length + ' مدير</div>' +
                '</div>' +
            '</div>';
        }

        container.innerHTML = html;

        /* bind click */
        var cards = container.querySelectorAll('.cc-team-card');
        for (var c = 0; c < cards.length; c++) {
            cards[c].addEventListener('click', function() {
                ccOpenTeam(this.getAttribute('data-team'));
            });
        }

        var countEl = document.getElementById('ccMembersCount');
        if (countEl) countEl.textContent = totalCount;

        ccLog('تم عرض ' + CC_TEAMS_LIST.length + ' فريق، ' + totalCount + ' مدير');

    } catch(e) {
        ccLog('خطأ عرض: ' + e.message);
        container.innerHTML = '<div class="cc-error">فشل التحميل</div>';
    }
}

/* ========== OPEN TEAM ========== */

async function ccOpenTeam(teamCode) {
    var modal = document.getElementById('ccModal');
    if (!modal) return;

    var teamName = CC_TEAM_NAMES[teamCode] || teamCode;
    var logo = '';
    if (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) {
        logo = TEAMS_LOGOS[teamName];
    }

    modal.innerHTML =
        '<div class="cc-modal-box">' +
            '<div class="cc-modal-header">' +
                '<div class="cc-modal-logo">' +
                    (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'">' : '') +
                '</div>' +
                '<div class="cc-modal-title">' + ccEscapeHTML(teamName) + '</div>' +
                '<button class="cc-modal-close" data-close="1">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
                '</button>' +
            '</div>' +
            '<div class="cc-loading">جاري التحميل...</div>' +
 modal.classList.add('show');

    var closeBtn = modal.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', ccCloseModal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) ccCloseModal();
    });

    var members = await ccGetTeamMembers(teamCode);
    var squad = await ccGetSquad(teamCode, ccState.currentRound);
    ccRenderTeamModal(teamCode, members, squad);
}

function ccRenderTeamModal(teamCode, members, squad) {
    var modal = document.getElementById('ccModal');
    if (!modal) return;

    var teamName = CC_TEAM_NAMES[teamCode] || teamCode;
    var logo = '';
    if (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) {
        logo = TEAMS_LOGOS[teamName];
    }

    var membersHtml = '';
    if (members.length === 0) {
        membersHtml = '<div class="cc-empty">لا يوجد أعضاء لهذا الفريق حالياً<br><small>اضغط زر التحديث لجلب الأعضاء</small></div>';
    } else {
        for (var i = 0; i < members.length; i++) {
            var m = members[i];
            membersHtml +=
                '<div class="cc-member-row">' +
                    '<div class="cc-member-rank">' + (i + 1) + '</div>' +
                    '<div class="cc-member-info">' +
                        '<div class="cc-member-name">' + ccEscapeHTML(m.entry_name || m.player_name) + '</div>' +
                        '<div class="cc-member-sub">' + ccEscapeHTML(m.player_name) + '</div>' +
                    '</div>' +
                    '<div class="cc-member-points">' + (m.total || 0) + '</div>' +
                '</div>';
        }
    }

    modal.innerHTML =
        '<div class="cc-modal-box">' +
            '<div class="cc-modal-header">' +
                '<div class="cc-modal-logo">' +
                    (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'">' : '') +
                '</div>' +
                '<div class="cc-modal-title">' + ccEscapeHTML(teamName) + '</div>' +
                '<button class="cc-modal-close" data-close="1">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
                '</button>' +
            '</div>' +
            '<div class="cc-modal-body">' +
                '<div class="cc-section-title">الأعضاء (' + members.length + ')</div>' +
                '<div class="cc-members-list">' + membersHtml + '</div>' +
                '<button class="cc-edit-btn" data-edit="1">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-edit"></span>' +
                    '<span>تعديل التشكيلة</span>' +
                '</button>' +
            '</div>' +
        '</div>';

    var closeBtn = modal.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', ccCloseModal);

    var editBtn = modal.querySelector('[data-edit]');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            ccPromptPin(teamCode);
        });
    }

    modal.addEventListener('click', function(e) {
        if (e.target === modal) ccCloseModal();
    });
}

function ccCloseModal() {
    var modal = document.getElementById('ccModal');
    if (modal) {
        modal.classList.remove('show');
        modal.innerHTML = '';
    }
}

/* ========== PIN ========== */

async function ccPromptPin(teamCode) {
    var teamName = CC_TEAM_NAMES[teamCode] || teamCode;
    var pin = prompt('أدخل رمز ' + teamName + ':');
    if (pin === null) return;

    var realPin = await ccGetTeamPin(teamCode);
    if (!realPin) {
        if (typeof showToast === 'function') showToast('رمز الفريق غير موجود', false);
        return;
    }

    if (String(pin) !== String(realPin)) {
        if (typeof showToast === 'function') showToast('الرمز غلط', false);
        return;
    }

    ccOpenSquadEditor(teamCode);
}

/* ========== EDITOR ========== */

async function ccOpenSquadEditor(teamCode) {
    var modal = document.getElementById('ccModal');
    if (!modal) return;

    var teamName = CC_TEAM_NAMES[teamCode] || teamCode;
    var members = await ccGetTeamMembers(teamCode);
    var squad = await ccGetSquad(teamCode, ccState.currentRound);

    var currentStarters = (squad && squad.starters) || [];
    var currentBench = (squad && squad.bench) || [];
    var currentBonus = (squad && squad.bonus) || [];

    var membersHtml = '';
    for (var i = 0; i < members.length; i++) {
        var m = members[i];
        var isStarter = currentStarters.indexOf(m.entry_id) !== -1;
        var isBench = currentBench.indexOf(m.entry_id) !== -1;
        var cls = isStarter ? ' selected-starter' : (isBench ? ' selected-bench' : '');

        membersHtml +=
            '<div class="cc-select-row' + cls + '" data-entry="' + m.entry_id + '">' +
                '<div class="cc-select-check"></div>' +
                '<div class="cc-select-name">' + ccEscapeHTML(m.entry_name || m.player_name) + '</div>' +
                '<div class="cc-select-points">' + (m.total || 0) + '</div>' +
            '</div>';
    }

    modal.innerHTML =
        '<div class="cc-modal-box cc-editor">' +
            '<div class="cc-modal-header">' +
                '<div class="cc-modal-title">' + ccEscapeHTML(teamName) + ' — تعديل</div>' +
                '<button class="cc-modal-close" data-close="1">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
                '</button>' +
            '</div>' +
            '<div class="cc-modal-body">' +
                '<div class="cc-section-title">اختر 11 أساسي + 2 دكة</div>' +
                '<div class="cc-counter">أساسي: <span id="ccStarterCount">' + currentStarters.length + '</span>/11 | دكة: <span id="ccBenchCount">' + currentBench.length + '</span>/2</div>' +
                '<div class="cc-members-list">' + membersHtml + '</div>' +
                '<div class="cc-actions">' +
                    '<button class="cc-btn cc-btn-save" data-save="1">' +
                        '<span class="tg-icon tg-icon-sm tg-icon-check"></span>' +
                        '<span>حفظ</span>' +
                    '</button>' +
                    '<button class="cc-btn cc-btn-cancel" data-cancel="1">إلغاء</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    ccState._currentEdit = {
        team: teamCode,
        starters: currentStarters.slice(),
        bench: currentBench.slice(),
        bonus: currentBonus.slice()
    };

    var closeBtn = modal.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', ccCloseModal);

    var cancelBtn = modal.querySelector('[data-cancel]');
    if (cancelBtn) cancelBtn.addEventListener('click', ccCloseModal);

    var saveBtn = modal.querySelector('[data-save]');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            ccSaveCurrent(teamCode);
        });
    }

    var rows = modal.querySelectorAll('.cc-select-row');
    for (var r = 0; r < rows.length; r++) {
        rows[r].addEventListener('click', function() {
            var entryId = parseInt(this.getAttribute('data-entry'), 10);
            ccToggleMember(entryId);
        });
    }

    ccUpdateSelectionUI();
}

function ccToggleMember(entryId) {
    var state = ccState._currentEdit;
    if (!state) return;

    var isStarter = state.starters.indexOf(entryId);
    var isBench = state.bench.indexOf(entryId);

    if (isStarter !== -1) {
        state.starters.splice(isStarter, 1);
    } else if (isBench !== -1) {
        state.bench.splice(isBench, 1);
    } else {
        if (state.starters.length < 11) {
            state.starters.push(entryId);
        } else if (state.bench.length < 2) {
            state.bench.push(entryId);
        } else {
            if (typeof showToast === 'function') showToast('التشكيلة كاملة', false);
        }
    }

    ccUpdateSelectionUI();
}

function ccUpdateSelectionUI() {
    var state = ccState._currentEdit;
    if (!state) return;

    var rows = document.querySelectorAll('.cc-select-row');
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var entryId = parseInt(row.getAttribute('data-entry'), 10);
        row.classList.remove('selected-starter', 'selected-bench');
        if (state.starters.indexOf(entryId) !== -1) {
            row.classList.add('selected-starter');
        } else if (state.bench.indexOf(entryId) !== -1) {
            row.classList.add('selected-bench');
        }
    }

    var sEl = document.getElementById('ccStarterCount');
    var bEl = document.getElementById('ccBenchCount');
    if (sEl) sEl.textContent = state.starters.length;
    if (bEl) bEl.textContent = state.bench.length;
}

async function ccSaveCurrent(teamCode) {
    var state = ccState._currentEdit;
    if (!state) return;

    if (state.starters.length === 0) {
        if (typeof showToast === 'function') showToast('اختر 11 أساسي على الأقل', false);
        return;
    }

    var result = await ccSaveSquad(teamCode, ccState.currentRound, {
        starters: state.starters,
        bench: state.bench,
        bonus: state.bonus
    });

    if (result.ok) {
        if (typeof showToast === 'function') showToast('تم الحفظ', true);
        ccCloseModal();
        ccRenderTeams();
    } else {
        if (typeof showToast === 'function') showToast('فشل الحفظ: ' + result.error, false);
    }
}

/* ========== AUTO UPDATE ========== */

function ccStartAutoUpdate() {
    if (ccState.syncTimer) clearInterval(ccState.syncTimer);
    ccState.syncTimer = setInterval(function() {
        ccSyncMembers().then(function() { ccRenderTeams(); });
    }, CC_SYNC_INTERVAL);
}

/* ========== INIT ========== */

async function ccInit() {
    ccLog('Init...');
    ccState.currentRound = (typeof currentRound !== 'undefined') ? currentRound : 1;

    /* عرض أولاً (بيانات محفوظة إن وجدت) */
    await ccRenderTeams();

    /* ثم مزامنة تلقائية */
    ccSyncMembers().then(function() {
        ccRenderTeams();
    });

    ccStartAutoUpdate();
}

/* ========== EXPORTS ========== */

window.ccInit = ccInit;
window.ccSyncMembers = ccSyncMembers;
window.ccRenderTeams = ccRenderTeams;
window.ccOpenTeam = ccOpenTeam;
window.ccCloseModal = ccCloseModal;
window.ccPromptPin = ccPromptPin;
window.ccOpenSquadEditor = ccOpenSquadEditor;
window.ccToggleMember = ccToggleMember;
window.ccSaveCurrent = ccSaveCurrent;
window.CC_LEAGUES = CC_LEAGUES;
window.CC_TEAM_NAMES = CC_TEAM_NAMES;

ccLog('Loaded');

})();
