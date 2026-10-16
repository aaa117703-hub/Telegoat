/* =========================================================
   champions-cup.js — v1
   Champions Cup System
   - 20 فرق، دوري واحد
   - PIN 4 أرقام لكل فريق
   - 11 أساسي + 2 دكة + 2 بونص
   - Sync تلقائي كل 5 دقايق
   - Manual Entry ID
========================================================= */

(function(){
'use strict';

/* =========================================================
   الإعدادات الأساسية
========================================================= */

const CC_LEAGUES = {
    'ARS': 369450,
    'AVL': 369537,
    'BOU': 369291,
    'BRE': 369578,
    'BHA': 369606,
    'CHE': 369638,
    'COV': 369673,
    'CRY': 369721,
    'EVE': 369745,
    'FUL': 369770,
    'HUL': 369795,
    'IPS': 369827,
    'LEE': 369850,
    'LIV': 370310,
    'MCI': 369942,
    'MUN': 369961,
    'NEW': 369987,
    'NOT': 370008,
    'SUN': 370048,
    'TOT': 370074
};

const CC_TEAM_NAMES = {
    'ARS': 'Arsenal',
    'AVL': 'Aston Villa',
    'BOU': 'Bournemouth',
    'BRE': 'Brentford',
    'BHA': 'Brighton',
    'CHE': 'Chelsea',
    'COV': 'Coventry City',
    'CRY': 'Crystal Palace',
    'EVE': 'Everton',
    'FUL': 'Fulham',
    'HUL': 'Hull City',
    'IPS': 'Ipswich Town',
    'LEE': 'Leeds United',
    'LIV': 'Liverpool',
    'MCI': 'Man City',
    'MUN': 'Man Utd',
    'NEW': 'Newcastle',
    'NOT': 'Nottingham Forest',
    'SUN': 'Sunderland',
    'TOT': 'Spurs'
};

const CC_WORKER = 'https://fpl-api.aaa117703.workers.dev';
const CC_SYNC_INTERVAL = 5 * 60 * 1000; // 5 دقايق

/* اللاعبين الحقيقيين — الصاعدين للبريمييرليغ هذا الموسم */
const CC_PROMOTED_TEAMS = ['HUL', 'COV', 'LEE'];

/* التوب 6 */
const CC_TOP6_TEAMS = ['ARS', 'CHE', 'LIV', 'MCI', 'MUN', 'TOT'];

/* حالة النظام */
let ccState = {
    members: {},          // { teamCode: [members] }
    squads: {},           // { round: { teamCode: squad } }
    pins: {},             // { teamCode: pin }
    currentRound: 1,
    loading: false,
    lastSync: 0,
    syncTimer: null
};

/* =========================================================
   HELPERS
========================================================= */

function ccLog(...args) {
    console.log('[CC]', ...args);
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

/* =========================================================
   1) SYNC MEMBERS من 20 دوري
========================================================= */

async function ccSyncMembers() {
    if (ccState.loading) return;
    ccState.loading = true;

    ccLog('بدء Sync الأعضاء...');
    const startTime = Date.now();

    const teams = Object.keys(CC_LEAGUES);
    const allMembers = {};  // { entry_id: {...} }

    for (let i = 0; i < teams.length; i++) {
        const teamCode = teams[i];
        const leagueId = CC_LEAGUES[teamCode];

        try {
            const res = await ccFetch(CC_WORKER + '/?type=league&id=' + leagueId, 10000);
            if (!res.ok) {
                ccLog('فشل ' + teamCode + ': HTTP ' + res.status);
                continue;
            }

            const data = await res.json();
            const results = (data.standings && data.standings.results) || [];

            ccLog(teamCode + ': ' + results.length + ' عضو');

            results.forEach(function(m) {
                const id = m.entry;
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
            });

        } catch(e) {
            ccLog('خطأ ' + teamCode + ': ' + e.message);
        }
    }

    /* حفظ في Supabase */
    const sb = ccGetSb();
    const membersArr = Object.values(allMembers);

    ccLog('مجموع الأعضاء الفريدين: ' + membersArr.length);

    if (sb && membersArr.length > 0) {
        try {
            /* upsert لكل عضو */
            const rows = membersArr.map(function(m) {
                return {
                    entry_id: m.entry_id,
                    player_name: m.player_name,
                    entry_name: m.entry_name,
                    total: m.total,
                    event_total: m.event_total,
                    rank: m.rank,
                    teams: m.teams,
                    status: 'active',
                    source: 'auto تم',
                    last_seen: new Date حفظ().toISOString(),
                    updated_at: new الأع Date().toISOString()
                };
            });

            /* دفعات 50 */
            for (let i = 0; i < rows.length; i += 50) {
                const chunk = rows.slice(i, i + 50);
                const { error } = await sb
                    .from('champions_cup_members')
                    .upsert(chunk, { onConflict: 'entry_id' });
                if (error) {
                    ccLog('خطأ حفظ: ' + error.message);
                }
            }

            /* حدّث inactive للأعضاء الي ما ظهروا */
            const activeIds = membersArr.map(function(m) { return m.entry_id; });
            const { data: existing } = await sb
                .from('champions_cup_members')
                .select('entry_id')
                .eq('status', 'active')
                .eq('source', 'auto');

            if (existing) {
                const toDeactivate = existing
                    .filter(function(e) { return activeIds.indexOf(e.entry_id) === -1; })
                    .map(function(e) { return e.entry_id; });

                if (toDeactivate.length > 0) {
                    for (let i = 0; i < toDeactivate.length; i += 50) {
                        const chunk = toDeactivate.slice(i, i + 50);
                        await sb
                            .from('champions_cup_members')
                            .update({ status: 'inactive', updated_at: new Date().toISOString() })
                            .in('entry_id', chunk);
                    }
                    ccLog('تم تعليم ' + toDeactivate.length + ' عضو كـ inactive');
                }
            }

            ccLog('✅ضاء في Supabase');
        } catch(e) {
            ccLog('خطأ Supabase: ' + e.message);
        }
    }

    ccState.members = allMembers;
    ccState.loading = false;
    ccState.lastSync = Date.now();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    ccLog('انتهى Sync في ' + elapsed + ' ثانية');
}

/* =========================================================
   2) جلب أعضاء فريق محدد
========================================================= */

async function ccGetTeamMembers(teamCode) {
    const sb = ccGetSb();
    if (!sb) return [];

    try {
        const { data, error } = await sb
            .from('champions_cup_members')
            .select('*');

        if (error || !data) return [];

        /* فلترة: العضو داخل هذا الفريق */
        const filtered = data.filter(function(m) {
            const teams = Array.isArray(m.teams) ? m.teams : [];
            return teams.indexOf(teamCode) !== -1;
        });

        /* ترتيب حسب total */
        filtered.sort(function(a, b) {
            return (b.total || 0) - (a.total || 0);
        });

        return filtered;
    } catch(e) {
        ccLog('خطأ جلب أعضاء: ' + e.message);
        return [];
    }
}

/* =========================================================
   3) جلب PIN الفريق
========================================================= */

async function ccGetTeamPin(teamCode) {
    const sb = ccGetSb();
    if (!sb) return null;

    try {
        const { data, error } = await sb
            .from('champions_cup_pins')
            .select('pin')
            .eq('team', teamCode)
            .maybeSingle();

        if (error || !data) return null;
        return data.pin;
    } catch(e) {
        return null;
    }
}

/* =========================================================
   4) جلب تشكيلة فريق في جولة
========================================================= */

async function ccGetSquad(teamCode, round) {
    const sb = ccGetSb();
    if (!sb) return null;

    try {
        const { data, error } = await sb
            .from('champions_cup_squads')
            .select('*')
            .eq('team', teamCode)
            .eq('round', round)
            .maybeSingle();

        if (error || !data) return null;
        return data;
    } catch(e) {
        return null;
    }
}

/* =========================================================
   5) حفظ تشكيلة
========================================================= */

async function ccSaveSquad(teamCode, round, squadData) {
    const sb = ccGetSb();
    if (!sb) return { ok: false, error: 'no_sb' };

    try {
        const { error } = await sb
            .from('champions_cup_squads')
            .upsert({
                team: teamCode,
                round: round,
                starters: squadData.starters || [],
                bench: squadData.bench || [],
                bonus: squadData.bonus || [],
                updated_at: new Date().toISOString()
            }, { onConflict: 'team,round' });

        if (error) return { ok: false, error: error.message };
        return { ok: true };
    } catch(e) {
        return { ok: false, error: e.message };
    }
}

/* =========================================================
   6) حساب نقاط الفريق (11 أساسي + 2 بونص)
========================================================= */

function ccCalculateTeamPoints(squad, membersMap) {
    if (!squad) return { total: 0, breakdown: [] };

    let total = 0;
    const breakdown = [];

    /* 11 أساسي */
    const starters = squad.starters || [];
    starters.forEach(function(entryId) {
        const member = membersMap[entryId];
        if (member) {
            const pts = member.event_total || 0;
            total += pts;
            breakdown.push({
                type: 'starter',
                entry_id: entryId,
                name: member.entry_name || member.player_name,
                points: pts
            });
        }
    });

    /* 2 بونص */
    const bonus = squad.bonus || [];
    bonus.forEach(function(b) {
        const pts = b.points || 0;
        total += pts;
        breakdown.push({
            type: 'bonus',
            player_id: b.player_id,
            name: b.player_name,
            points: pts
        });
    });

    return { total: total, breakdown: breakdown };
}

/* =========================================================
   7) عرض الفرق
========================================================= */

async function ccRenderTeams() {
    const container = document.getElementById('ccTeamsGrid');
    if (!container) return;

    container.innerHTML = '<div class="cc-loading">جاري التحميل...</div>';

    const sb = ccGetSb();
    if (!sb) {
        container.innerHTML = '<div class="cc-error">Supabase غير متوفر</div>';
        return;
    }

    try {
        const { data, error } = await sb
            .from('champions_cup_members')
            .select('*')
            .eq('status', 'active');

        if (error) throw error;

        /* تجميع الأعضاء حسب الفريق */
        const byTeam = {};
        Object.keys(CC_TEAMS_LIST).forEach(function(code) {
            byTeam[code] = [];
        });

        (data || []).forEach(function(m) {
            const teams = Array.isArray(m.teams) ? m.teams : [];
            teams.forEach(function(t) {
                if (byTeam[t]) byTeam[t].push(m);
            });
        });

        /* ترتيب كل فريق حسب total */
        Object.keys(byTeam).forEach(function(code) {
            byTeam[code].sort(function(a, b) {
                return (b.total || 0) - (a.total || 0);
            });
        });

        /* بناء HTML */
        let html = '';
        Object.keys(CC_TEAM_NAMES).forEach(function(code) {
            const name = CC_TEAM_NAMES[code];
            const members = byTeam[code] || [];
            const logo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[name]) || '';

            html +=
                '<div class="cc-team-card" onclick="ccOpenTeam(\'' + code + '\')">' +
                    '<div class="cc-team-logo">' +
                        (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'">' : '') +
                    '</div>' +
                    '<div class="cc-team-info">' +
                        '<div class="cc-team-name">' + ccEscapeHTML(name) + '</div>' +
                        '<div class="cc-team-count">' + members.length + ' مدير</div>' +
                    '</div>' +
                    '<div class="cc-team-arrow"><span class="tg-icon tg-icon-arrow-left" style="transform:rotate(180deg);"></span></div>' +
                '</div>';
        });

        container.innerHTML = html;

    } catch(e) {
        ccLog('خطأ عرض: ' + e.message);
        container.innerHTML = '<div class="cc-error">فشل التحميل</div>';
    }
}

/* =========================================================
   8) فتح فريق (مودال مع اختيار التشكيلة)
========================================================= */

async function ccOpenTeam(teamCode) {
    const modal = document.getElementById('ccModal');
    if (!modal) return;

    const teamName = CC_TEAM_NAMES[teamCode] || teamCode;
    const logo = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[teamName]) || '';

    /* عرض loading */
    modal.innerHTML =
        '<div class="cc-modal-box">' +
            '<div class="cc-modal-header">' +
                '<div class="cc-modal-logo">' +
                    (logo ? '<img src="./' + logo + '" onerror="this.style.display=\'none\'">' : '') +
                '</div>' +
                '<div class="cc-modal-title">' + ccEscapeHTML(teamName) + '</div>' +
                '<button class="cc-modal-close" onclick="ccCloseModal()">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
                '</button>' +
            '</div>' +
            '<div class="cc-loading">جاري التحميل...</div>' +
        '</div>';

    modal.classList.add('show');

    /* جلب الأعضاء + التشكيلة */
    const members = await ccGetTeamMembers(teamCode);
    const squad = await ccGetSquad(teamCode, ccState.currentRound);

    ccRenderTeamModal(teamCode, members, squad);
}

function ccRenderTeamModal(teamCode, members, squad) {
    const modal = document.getElementById('ccModal');
    if (!modal) return;

    const teamName = CC_TEAM_NAMES[teamCode] || teamCode;

    /* قائمة الأعضاء */
    let membersHtml = '';
    members.forEach(function(m, i) {
        membersHtml +=
            '<div class="cc-member-row">' +
                '<div class="cc-member-rank">' + (i + 1) + '</div>' +
                '<div class="cc-member-info">' +
                    '<div class="cc-member-name">' + ccEscapeHTML(m.entry_name || m.player_name) + '</div>' +
                    '<div class="cc-member-sub">' + ccEscapeHTML(m.player_name) + '</div>' +
                '</div>' +
                '<div class="cc-member-points">' + (m.total || 0) + '</div>' +
            '</div>';
    });

    modal.innerHTML =
        '<div class="cc-modal-box">' +
            '<div class="cc-modal-header">' +
                '<div class="cc-modal-title">' + ccEscapeHTML(teamName) + '</div>' +
                '<button class="cc-modal-close" onclick="ccCloseModal()">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
                '</button>' +
            '</div>' +
            '<div class="cc-modal-body">' +
                '<div class="cc-section-title">الأعضاء (' + members.length + ')</div>' +
                '<div class="cc-members-list">' + membersHtml + '</div>' +
                '<button class="cc-edit-btn" onclick="ccPromptPin(\'' + teamCode + '\')">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-edit"></span>' +
                    '<span>تعديل التشكيلة</span>' +
                '</button>' +
            '</div>' +
        '</div>';
}

function ccCloseModal() {
    const modal = document.getElementById('ccModal');
    if (modal) {
        modal.classList.remove('show');
        modal.innerHTML = '';
    }
}

/* =========================================================
   9) طلب PIN للتحقق
========================================================= */

async function ccPromptPin(teamCode) {
    const pin = prompt('أدخل رمز الفريق (' + CC_TEAM_NAMES[teamCode] + '):');
    if (pin === null) return;

    const realPin = await ccGetTeamPin(teamCode);
    if (!realPin) {
        if (typeof showToast === 'function') showToast('رمز الفريق غير موجود', false);
        return;
    }

    if (String(pin) !== String(realPin)) {
        if (typeof showToast === 'function') showToast('الرمز غلط', false);
        return;
    }

    /* فتح محرر التشكيلة */
    ccOpenSquadEditor(teamCode);
}

async function ccOpenSquadEditor(teamCode) {
    const modal = document.getElementById('ccModal');
    if (!modal) return;

    const teamName = CC_TEAM_NAMES[teamCode] || teamCode;
    const members = await ccGetTeamMembers(teamCode);
    const squad = await ccGetSquad(teamCode, ccState.currentRound);

    /* الحالة الحالية */
    const currentStarters = (squad && squad.starters) || [];
    const currentBench = (squad && squad.bench) || [];
    const currentBonus = (squad && squad.bonus) || [];

    /* أعرض القائمة */
    let membersHtml = '';
    members.forEach(function(m) {
        const isStarter = currentStarters.indexOf(m.entry_id) !== -1;
        const isBench = currentBench.indexOf(m.entry_id) !== -1;
        const cls = isStarter ? ' selected-starter' : (isBench ? ' selected-bench' : '');

        membersHtml +=
            '<div class="cc-select-row' + cls + '" data-entry="' + m.entry_id + '" onclick="ccToggleMember(' + m.entry_id + ')">' +
                '<div class="cc-select-check"></div>' +
                '<div class="cc-select-name">' + ccEscapeHTML(m.entry_name || m.player_name) + '</div>' +
                '<div class="cc-select-points">' + (m.total || 0) + '</div>' +
            '</div>';
    });

    modal.innerHTML =
        '<div class="cc-modal-box cc-editor">' +
            '<div class="cc-modal-header">' +
                '<div class="cc-modal-title">' + ccEscapeHTML(teamName) + ' — تعديل</div>' +
                '<button class="cc-modal-close" onclick="ccCloseModal()">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
                '</button>' +
            '</div>' +
            '<div class="cc-modal-body">' +
                '<div class="cc-section-title">اختر 11 أساسي + 2 دكة</div>' +
                '<div class="cc-counter">أساسي: <span id="ccStarterCount">' + currentStarters.length + '</span>/11 | دكة: <span id="ccBenchCount">' + currentBench.length + '</span>/2</div>' +
                '<div class="cc-members-list">' + membersHtml + '</div>' +
                '<div class="cc-actions">' +
                    '<button class="cc-btn cc-btn-save" onclick="ccSaveCurrent(\'' + teamCode + '\')">' +
                        '<span class="tg-icon tg-icon-sm tg-icon-check"></span>' +
                        '<span>حفظ</span>' +
                    '</button>' +
                    '<button class="cc-btn cc-btn-cancel" onclick="ccCloseModal()">إلغاء</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    /* حفظ الحالة الحالية */
    ccState._currentEdit = {
        team: teamCode,
        starters: currentStarters.slice(),
        bench: currentBench.slice(),
        bonus: currentBonus.slice()
    };

    /* تحديث العرض */
    ccUpdateSelectionUI();
}

function ccToggleMember(entryId) {
    const state = ccState._currentEdit;
    if (!state) return;

    const isStarter = state.starters.indexOf(entryId);
    const isBench = state.bench.indexOf(entryId);

    if (isStarter !== -1) {
        /* كان أساسي → احذفه */
        state.starters.splice(isStarter, 1);
    } else if (isBench !== -1) {
        /* كان دكة → احذفه */
        state.bench.splice(isBench, 1);
    } else {
        /* جديد */
        if (state.starters.length < 11) {
            state.starters.push(entryId);
        } else if (state.bench.length < 2) {
            state.bench.push(entryId);
        } else {
            if (typeof showToast === 'function') showToast('التشكيلة كاملة (11 + 2)', false);
        }
    }

    ccUpdateSelectionUI();
}

function ccUpdateSelectionUI() {
    const state = ccState._currentEdit;
    if (!state) return;

    /* تحديث الصفوف */
    document.querySelectorAll('.cc-select-row').forEach(function(row) {
        const entryId = parseInt(row.dataset.entry, 10);
        row.classList.remove('selected-starter', 'selected-bench');
        if (state.starters.indexOf(entryId) !== -1) {
            row.classList.add('selected-starter');
        } else if (state.bench.indexOf(entryId) !== -1) {
            row.classList.add('selected-bench');
        }
    });

    /* تحديث العدادات */
    const sEl = document.getElementById('ccStarterCount');
    const bEl = document.getElementById('ccBenchCount');
    if (sEl) sEl.textContent = state.starters.length;
    if (bEl) bEl.textContent = state.bench.length;
}

async function ccSaveCurrent(teamCode) {
    const state = ccState._currentEdit;
    if (!state) return;

    if (state.starters.length === 0) {
        if (typeof showToast === 'function') showToast('اختر 11 أساسي على الأقل', false);
        return;
    }

    const result = await ccSaveSquad(teamCode, ccState.currentRound, {
        starters: state.starters,
        bench: state.bench,
        bonus: state.bonus
    });

    if (result.ok) {
        if (typeof showToast === 'function') showToast('تم الحفظ ✓', true);
        ccCloseModal();
        /* تحديث العرض */
        ccRenderTeams();
    } else {
        if (typeof showToast === 'function') showToast('فشل الحفظ: ' + result.error, false);
    }
}

/* =========================================================
   10) Auto-Update
========================================================= */

function ccStartAutoUpdate() {
    if (ccState.syncTimer) clearInterval(ccState.syncTimer);

    ccState.syncTimer = setInterval(function() {
        ccLog('Auto-sync...');
        ccSyncMembers().then(function() {
            ccRenderTeams();
        });
    }, CC_SYNC_INTERVAL);

    ccLog('✅ Auto-update started (كل 5 دقايق)');
}

/* =========================================================
   11) Init
========================================================= */

async function ccInit() {
    ccLog('Init Champions Cup...');

    ccState.currentRound = (typeof currentRound !== 'undefined') ? currentRound : 1;

    /* تحميل الأعضاء من Supabase */
    await ccRenderTeams();

    /* إذا آخر Sync قديم، سوي واحد جديد */
    const lastSync = ccState.lastSync;
    if (!lastSync || (Date.now() - lastSync) > CC_SYNC_INTERVAL) {
        ccSyncMembers().then(function() {
            ccRenderTeams();
        });
    }

    /* بدء Auto-update */
    ccStartAutoUpdate();
}

/* قائمة الفرق (للترتيب) */
const CC_TEAMS_LIST = Object.keys(CC_LEAGUES);

/* =========================================================
   Exports
========================================================= */

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

ccLog('Loaded ✓');

})();
