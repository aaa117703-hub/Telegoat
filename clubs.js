/* =========================================================
   clubs.js — v7
   - قائمة الأندية
   - Modal: لاعبين مرتبين بالنقاط (من FPL) — يظهر عند ضغط النادي
   - إدارة اللاعبين (من Manager-Hub)
========================================================= */

const CLUBS_PIN = '024680';
const NO_TEAM_KEY = '__NO_TEAM__';

let clubsData = {};
let clubsLoaded = false;
let clubsEditMode = false;
let currentOpenClub = null;
let cpModalEl = null;


/* =========================================================
   LOAD CLUBS DATA (من managers_by_team)
========================================================= */

async function loadClubsData() {

    if (!window.sbClient) {
        console.warn('Supabase not available');
        seedFromLocal();
        return;
    }

    try {
        const { data, error } = await window.sbClient
            .from('managers_by_team')
            .select('team, managers');

        if (error) {
            console.error('Load clubs error:', error);
            seedFromLocal();
            return;
        }

        clubsData = {};

        if (data && data.length > 0) {
            data.forEach(function(row) {
                if (row.team === NO_TEAM_KEY) return;
                clubsData[row.team] = row.managers || [];
            });
        } else {
            seedFromLocal();
            await seedClubsToSupabase();
        }

        clubsLoaded = true;

    } catch (e) {
        console.error('loadClubsData exception:', e);
        seedFromLocal();
    }
}


function seedFromLocal() {
    clubsData = {};
    if (typeof PLAYERS_TEAMS === 'undefined') return;

    for (const team in PLAYERS_TEAMS) {
        clubsData[team] = PLAYERS_TEAMS[team].slice();
    }
}


async function seedClubsToSupabase() {

    if (!window.sbClient) return;
    if (typeof PLAYERS_TEAMS === 'undefined') return;

    const rows = [];

    for (const team in PLAYERS_TEAMS) {
        rows.push({
            team: team,
            managers: PLAYERS_TEAMS[team],
            updated_at: new Date().toISOString()
        });
    }

    try {
        const { error } = await window.sbClient
            .from('managers_by_team')
            .upsert(rows, { onConflict: 'team' });

        if (error) {
            console.error('Seed clubs error:', error);
            return;
        }

        console.log('Seeded ' + rows.length + ' teams');
    } catch (e) {
        console.error('seedClubsToSupabase exception:', e);
    }
}


async function saveClubPlayers(team, players) {

    if (!window.sbClient) return false;

    try {
        const { error } = await window.sbClient
            .from('managers_by_team')
            .upsert(
                {
                    team: team,
                    managers: players,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'team' }
            );

        if (error) {
            console.error('Save club error:', error);
            return false;
        }

        clubsData[team] = players;
        return true;
    } catch (e) {
        console.error('saveClubPlayers exception:', e);
        return false;
    }
}


/* =========================================================
   RENDER CLUBS LIST
========================================================= */

function renderClubsList() {

    const container = document.getElementById('clubsList');
    if (!container) {
        console.warn('clubsList not found');
        return;
    }

    const teamKeys = Object.keys(clubsData);

    if (teamKeys.length === 0) {
        container.innerHTML = '<div class="clubs-empty">لا توجد بيانات</div>';
        return;
    }

    teamKeys.sort();

    let html = '';

    teamKeys.forEach(function(team) {
        const players = clubsData[team] || [];
        const logoFile = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[team]) || '';

        let logoHtml = '';
        if (logoFile) {
            logoHtml =
                '<div class="club-item-logo">' +
                    '<img src="./' + logoFile + '" onerror="this.style.display=\'none\'">' +
                '</div>';
        } else {
            logoHtml = '<div class="club-item-logo club-item-logo-empty"></div>';
        }

        html +=
            '<div class="club-item" onclick="openClubPlayers(\'' +
                team.replace(/'/g, "\\'") + '\')">' +
                logoHtml +
                '<div class="club-item-info">' +
                    '<div class="club-item-name">' + team + '</div>' +
                    '<div class="club-item-count">' + players.length + ' لاعب</div>' +
                '</div>' +
                '<div class="club-item-arrow">›</div>' +
            '</div>';
    });

    container.innerHTML = html;
}


/* =========================================================
   OPEN CLUB PLAYERS MODAL — لاعبين مرتبين بالنقاط
========================================================= */

async function openClubPlayers(team) {

    if (!team) return;

    /* إنشاء أو إعادة استخدام الـ modal */
    if (!cpModalEl) {
        cpModalEl = document.createElement('div');
        cpModalEl.className = 'cp-modal';
        cpModalEl.id = 'clubPlayersModal';
        document.body.appendChild(cpModalEl);
    }

    /* إغلاق عند الضغط على الخلفية */
    cpModalEl.onclick = function(e) {
        if (e.target === cpModalEl) closeClubPlayers();
    };

    const logoFile = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[team]) || '';

    let logoHtml = '';
    if (logoFile) {
        logoHtml =
            '<div class="cp-header-logo">' +
                '<img src="./' + logoFile + '" onerror="this.style.display=\'none\'">' +
            '</div>';
    }

    /* عرض Loading */
    cpModalEl.innerHTML =
        '<div class="cp-modal-box">' +
            '<div class="cp-header">' +
                logoHtml +
                '<div class="cp-header-info">' +
                    '<div class="cp-header-title">' + team + '</div>' +
                    '<div class="cp-header-sub">Loading...</div>' +
                '</div>' +
                '<button class="cp-close" onclick="closeClubPlayers()">✕</button>' +
            '</div>' +
            '<div class="cp-loading">' +
                '<div class="spinner"></div>' +
                '<div>جاري جلب نقاط اللاعبين...</div>' +
            '</div>' +
        '</div>';

    cpModalEl.classList.add('show');

    /* جلب البيانات */
    let playersWithPoints = [];

    try {
        /* 1) جلب كل المديرين من FPL */
        let allManagers = [];
        if (typeof getAllManagersCached === 'function') {
            allManagers = await getAllManagersCached();
        }

        /* 2) قائمة اللاعبين في هذا الفريق */
        const teamPlayers = clubsData[team] || [];

        /* 3) بناء map للنقاط */
        const pointsMap = {};
        allManagers.forEach(function(m) {
            const pn = String(m.player_name || '').trim().toLowerCase();
            const en = String(m.entry_name || '').trim().toLowerCase();

            if (pn) {
                pointsMap[pn] = m;
            }
            if (en) {
                /* إذا موجود، نفضّل الأحدث (آخر واحد) */
                if (!pointsMap[en]) {
                    pointsMap[en] = m;
                }
            }
        });

        /* 4) ربط كل لاعب بنقاطه */
        teamPlayers.forEach(function(name) {
            const key = String(name || '').trim().toLowerCase();
            const m = pointsMap[key];

            if (m) {
                playersWithPoints.push({
                    name: name,
                    player_name: m.player_name || '',
                    entry_name: m.entry_name || '',
                    total: m.total || 0,
                    event_total: m.event_total || 0,
                    entry: m.entry,
                    found: true
                });
            } else {
                playersWithPoints.push({
                    name: name,
                    player_name: '',
                    entry_name: '',
                    total: 0,
                    event_total: 0,
                    entry: null,
                    found: false
                });
            }
        });

        /* 5) ترتيب من الأعلى للنقاط */
        playersWithPoints.sort(function(a, b) {
            return (b.total || 0) - (a.total || 0);
        });

    } catch (e) {
        console.error('[Clubs] Failed to load players:', e);
    }

    /* عرض القائمة */
    renderClubPlayersModal(team, logoHtml, playersWithPoints);
}


/* =========================================================
   RENDER MODAL CONTENT
========================================================= */

function renderClubPlayersModal(team, logoHtml, players) {

    if (!cpModalEl) return;

    let playersHtml = '';

    if (players.length === 0) {
        playersHtml =
            '<div class="cp-empty">' +
                '<span class="cp-empty-icon">👥</span>' +
                'لا يوجد لاعبون في هذا الفريق' +
            '</div>';
    } else {
        players.forEach(function(p, idx) {

            const rank = idx + 1;
            let rowClass = '';

            if (rank === 1) rowClass = ' cp-top-1';
            else if (rank === 2) rowClass = ' cp-top-2';
            else if (rank === 3) rowClass = ' cp-top-3';

            /* اسم المدير المميز */
            const displayEntry = p.entry_name || p.player_name || p.name || 'Unknown';
            const displayPlayer = p.player_name && p.player_name !== displayEntry ? p.player_name : '';

            playersHtml +=
                '<div class="cp-player-row' + rowClass + '">' +
                    '<div class="cp-rank">' + rank + '</div>' +
                    '<div class="cp-logo cp-logo-empty"></div>' +
                    '<div class="cp-names">' +
                        '<div class="cp-name">' + escapeHtml(displayEntry) + '</div>' +
                        (displayPlayer ? '<div class="cp-player">' + escapeHtml(displayPlayer) + '</div>' : '') +
                    '</div>' +
                    '<div class="cp-points">' +
                        (p.total || 0) +
                        '<span class="cp-points-label">PTS</span>' +
                    '</div>' +
                '</div>';
        });
    }

    cpModalEl.innerHTML =
        '<div class="cp-modal-box">' +
            '<div class="cp-header">' +
                logoHtml +
                '<div class="cp-header-info">' +
                    '<div class="cp-header-title">' + escapeHtml(team) + '</div>' +
                    '<div class="cp-header-sub">' + players.length + ' لاعب — مرتبين بالنقاط</div>' +
                '</div>' +
                '<button class="cp-close" onclick="closeClubPlayers()">✕</button>' +
            '</div>' +
            (players.length > 0 ?
                '<div class="cp-list-header">' +
                    '<div class="cp-lh-rank">#</div>' +
                    '<div class="cp-lh-logo"></div>' +
                    '<div class="cp-lh-name">MANAGER</div>' +
                    '<div class="cp-lh-points">POINTS</div>' +
                '</div>' : '') +
            '<div class="cp-players-list">' + playersHtml + '</div>' +
        '</div>';
}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeClubPlayers() {
    if (cpModalEl) {
        cpModalEl.classList.remove('show');
        cpModalEl.innerHTML = '';
    }
}


/* =========================================================
   ESCAPE HTML HELPER
========================================================= */

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c];
    });
}


/* =========================================================
   OLD CLUB DETAIL — يبقى متوفر (للإدارة)
========================================================= */

function openClubDetail(team) {

    currentOpenClub = team;
    const players = clubsData[team] || [];

    const modal = document.getElementById('clubModal');
    if (!modal) return;

    const logoFile = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[team]) || '';

    let logoHtml = '';
    if (logoFile) {
        logoHtml = '<img src="./' + logoFile + '" onerror="this.style.display=\'none\'">';
    }

    let playersHtml = '';

    if (players.length === 0) {
        playersHtml = '<div class="clubs-empty">لا يوجد لاعبون</div>';
    } else {
        players.forEach(function(player, index) {
            playersHtml +=
                '<div class="club-player-row">' +
                    '<div class="club-player-num">' + (index + 1) + '</div>' +
                    '<div class="club-player-name">' + player + '</div>' +
                    (clubsEditMode ?
                        '<button class="club-player-del" onclick="deletePlayer(\'' +
                            team.replace(/'/g, "\\'") + '\',' + index + ')">X</button>'
                        : '') +
                '</div>';
        });
    }

    const editBtn = clubsEditMode
        ? '<button class="club-add-btn" onclick="addPlayerPrompt()">إضافة لاعب</button>'
        : '';

    const statsBtn =
        '<button class="club-stats-btn" onclick="openTeamStats(\'' +
            team.replace(/'/g, "\\'") + '\')">📊 إحصائيات الفريق</button>';

    modal.innerHTML =
        '<div class="club-modal-box">' +
            '<div class="club-modal-header">' +
                '<div class="club-modal-logo">' + logoHtml + '</div>' +
                '<div class="club-modal-title">' + team + '</div>' +
                '<button class="club-modal-close" onclick="closeClubDetail()">X</button>' +
            '</div>' +
            '<div class="club-modal-sub">' +
                players.length + ' لاعب' +
                (clubsEditMode ? ' - وضع التعديل' : '') +
            '</div>' +
            statsBtn +
            editBtn +
            '<div class="club-players-list">' + playersHtml + '</div>' +
        '</div>';

    modal.classList.add('show');
}


function closeClubDetail() {
    const modal = document.getElementById('clubModal');
    if (modal) modal.classList.remove('show');
    currentOpenClub = null;
}


function openTeamStats(team) {
    closeClubDetail();

    if (typeof openTeamView === 'function') {
        openTeamView(team);
    } else {
        alert('team-view.js غير محمّل');
    }
}

window.openTeamStats = openTeamStats;


/* =========================================================
   EDIT MODE
========================================================= */

function toggleClubsEditMode() {
    const pass = prompt('أدخل رمز التعديل:');

    if (pass !== CLUBS_PIN) {
        if (pass !== null) alert('الرمز غلط!');
        return;
    }

    clubsEditMode = !clubsEditMode;

    const btn = document.getElementById('clubsEditBtn');
    if (btn) {
        btn.classList.toggle('active', clubsEditMode);
        btn.textContent = clubsEditMode ? 'وضع التعديل' : 'تعديل';
    }

    if (currentOpenClub) {
        openClubDetail(currentOpenClub);
    }

    if (typeof showToast === 'function') {
        showToast(clubsEditMode ? 'Edit mode ON' : 'Edit mode OFF', true);
    }
}


async function addPlayerPrompt() {

    if (!currentOpenClub) return;

    const name = prompt('اسم اللاعب الجديد:');
    if (!name || name.trim() === '') return;

    const players = clubsData[currentOpenClub] || [];

    if (players.indexOf(name.trim()) !== -1) {
        alert('اللاعب موجود بالفعل');
        return;
    }

    players.push(name.trim());

    const ok = await saveClubPlayers(currentOpenClub, players);

    if (ok) {
        openClubDetail(currentOpenClub);
        if (typeof showToast === 'function') showToast('تمت الإضافة', true);
    } else {
        alert('فشل الحفظ');
    }
}


async function deletePlayer(team, index) {

    if (!clubsEditMode) return;

    const players = clubsData[team] || [];
    const playerName = players[index];

    if (!confirm('حذف اللاعب: ' + playerName + '؟')) return;

    players.splice(index, 1);

    const ok = await saveClubPlayers(team, players);

    if (ok) {
        openClubDetail(team);
        if (typeof showToast === 'function') showToast('تم الحذف', true);
    } else {
        alert('فشل الحذف');
    }
}


/* =========================================================
   LOAD
========================================================= */

async function loadClubs() {

    const loadingEl = document.getElementById('clubsLoading');

    const timeout = setTimeout(function() {
        if (loadingEl) loadingEl.style.display = 'none';
    }, 5000);

    if (!clubsLoaded) {
        await loadClubsData();
    }

    renderClubsList();

    clearTimeout(timeout);

    if (loadingEl) loadingEl.style.display = 'none';
}


window.clubsReload = function() {
    clubsLoaded = false;
    loadClubs();
};

window.openClubPlayers = openClubPlayers;
window.closeClubPlayers = closeClubPlayers;
window.openClubDetail = openClubDetail;
window.closeClubDetail = closeClubDetail;


document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (!clubsLoaded) {
            loadClubsData();
        }
    }, 2000);
});
