/* =========================================================
   clubs.js — عرض وإدارة لاعبي الأندية
========================================================= */

const CLUBS_PIN = '024680';

let clubsData = {};
let clubsLoaded = false;
let clubsEditMode = false;
let currentOpenClub = null;


/* =========================================================
   LOAD FROM SUPABASE
========================================================= */

async function loadClubsData() {

    if (!window.sbClient) {
        console.warn('Supabase not available');
        return;
    }

    try {
        const { data, error } = await window.sbClient
            .from('club_players')
            .select('team, players');

        if (error) {
            console.error('Load clubs error:', error);
            return;
        }

        clubsData = {};

        if (data && data.length > 0) {
            data.forEach(function(row) {
                clubsData[row.team] = row.players || [];
            });
        } else {
            /* ما فيه بيانات → نملأ من PLAYERS_TEAMS */
            await seedClubsFromPlayersTeams();
        }

        clubsLoaded = true;

    } catch (e) {
        console.error('loadClubsData exception:', e);
    }
}


async function seedClubsFromPlayersTeams() {

    if (typeof PLAYERS_TEAMS === 'undefined') return;

    const rows = [];

    for (const team in PLAYERS_TEAMS) {
        rows.push({
            team: team,
            players: PLAYERS_TEAMS[team],
            updated_at: new Date().toISOString()
        });
    }

    try {
        const { error } = await window.sbClient
            .from('club_players')
            .upsert(rows, { onConflict: 'team' });

        if (error) {
            console.error('Seed clubs error:', error);
            return;
        }

        rows.forEach(function(r) {
            clubsData[r.team] = r.players;
        });

        console.log('Seeded ' + rows.length + ' clubs');
    } catch (e) {
        console.error('seedClubsFromPlayersTeams exception:', e);
    }
}


/* =========================================================
   SAVE CLUB
========================================================= */

async function saveClubPlayers(team, players) {

    if (!window.sbClient) return false;

    try {
        const { error } = await window.sbClient
            .from('club_players')
            .upsert(
                {
                    team: team,
                    players: players,
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
   RENDER CLUB LIST
========================================================= */

function renderClubsList() {

    const container = document.getElementById('clubsList');
    if (!container) return;

    const teamKeys = Object.keys(clubsData);

    if (teamKeys.length === 0) {
        container.innerHTML = '<div class="clubs-empty">لا توجد بيانات</div>';
        return;
    }

    container.innerHTML = '';

    teamKeys.forEach(function(team) {
        const players = clubsData[team] || [];
        const logoFile = (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[team]) || '';

        let logoHtml = '';
        if (logoFile) {
            logoHtml = '<div class="club-item-logo">' +
                '<img src="./' + logoFile + '" onerror="this.style.display=\'none\'">' +
            '</div>';
        } else {
            logoHtml = '<div class="club-item-logo club-item-logo-empty">⚽</div>';
        }

        const div = document.createElement('div');
        div.className = 'club-item';
        div.innerHTML =
            logoHtml +
            '<div class="club-item-info">' +
                '<div class="club-item-name">' + team + '</div>' +
                '<div class="club-item-count">' + players.length + ' لاعب</div>' +
            '</div>' +
            '<div class="club-item-arrow">›</div>';

        div.addEventListener('click', function() {
            openClubDetail(team);
        });

        container.appendChild(div);
    });
}


/* =========================================================
   OPEN CLUB DETAIL
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
    } else {
        logoHtml = '⚽';
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
                            team.replace(/'/g, "\\'") + '\',' + index + ')">✕</button>'
                        : '') +
                '</div>';
        });
    }

    const editBtn = clubsEditMode
        ? '<button class="club-add-btn" onclick="addPlayerPrompt()">➕ إضافة لاعب</button>'
        : '';

    modal.innerHTML =
        '<div class="club-modal-box">' +
            '<div class="club-modal-header">' +
                '<div class="club-modal-logo">' + logoHtml + '</div>' +
                '<div class="club-modal-title">' + team + '</div>' +
                '<button class="club-modal-close" onclick="closeClubDetail()">✕</button>' +
            '</div>' +
            '<div class="club-modal-sub">' +
                players.length + ' لاعب' +
                (clubsEditMode ? ' • <span style="color:#00ff87">وضع التعديل ✓</span>' : '') +
            '</div>' +
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
        btn.textContent = clubsEditMode ? '🔓 وضع التعديل' : '🔒 تعديل';
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
   LOAD TAB
========================================================= */

async function loadClubs() {

    const loadingEl = document.getElementById('clubsLoading');
    const contentEl = document.getElementById('clubsContent');

    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    if (!clubsLoaded) {
        await loadClubsData();
    }

    renderClubsList();

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
}


/* =========================================================
   INIT
========================================================= */

document.addEventListener('DOMContentLoaded', function() {
    /* لا نحمّل تلقائياً — ننتظر المستخدم يفتح التاب */
});
