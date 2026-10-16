/* =========================================================
   team-view.js — v1
   - ملف جديد: عرض إحصائيات تفصيلية لكل فريق
   - Dark Luxury Theme
   - يستخدم: getAllManagersCached + findPlayerTeam + TEAMS_LOGOS
   - يُستدعى من clubs.js عبر openTeamView(teamName)
========================================================= */

(function(){
'use strict';

/* =========================================================
   HELPERS
========================================================= */

function tvEscapeHTML(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

function tvNormalize(s){
    if (typeof normalizePlayerName === 'function') {
        return normalizePlayerName(s);
    }
    return String(s || '').trim().toLowerCase();
}

function tvShortenName(name, max){
    max = max || 22;
    if (!name) return '';
    if (name.length <= max) return name;
    return name.substring(0, max - 1) + '…';
}

function tvFindTeamKey(teamName){
    /* مطابقة اسم الفريق مع مفاتيح TEAMS_LOGOS */
    if (typeof TEAMS_LOGOS === 'undefined') return teamName;
    if (TEAMS_LOGOS[teamName]) return teamName;

    /* محاولة مطابقة جزئية */
    const clean = String(teamName || '').toLowerCase();
    for (const key in TEAMS_LOGOS) {
        if (key.toLowerCase() === clean) return key;
    }
    for (const key in TEAMS_LOGOS) {
        const k = key.toLowerCase();
        if (k.indexOf(clean) !== -1 || clean.indexOf(k) !== -1) return key;
    }
    return teamName;
}

function tvGetLogoURL(teamName){
    const key = tvFindTeamKey(teamName);
    if (typeof TEAMS_LOGOS !== 'undefined' && TEAMS_LOGOS[key]) {
        return './' + TEAMS_LOGOS[key];
    }
    return '';
}

/* =========================================================
   COLLECT TEAM DATA
========================================================= */

async function tvCollectTeamData(teamName){
    const result = {
        teamName: teamName,
        managers: [],
        totalPoints: 0,
        avgPoints: 0,
        avgGW: 0,
        topPoints: 0,
        lowPoints: 0,
        topManager: null,
        lowManager: null,
        totalManagers: 0
    };

    try {
        const all = await getAllManagersCached();
        if (!all || all.length === 0) return result;

        /* فلترة المديرين اللي يخصون هذا الفريق */
        const teamMembers = [];

        all.forEach(function(m){
            const rawName = m.player_name || m.entry_name || '';
            let detectedTeam = '';

            if (typeof findPlayerTeam === 'function') {
                detectedTeam = findPlayerTeam(rawName) || '';
            }

            /* مطابقة قوية */
            const key = tvFindTeamKey(teamName);
            const detectedKey = tvFindTeamKey(detectedTeam);

            if (detectedKey === key) {
                teamMembers.push({
                    entry: m.entry,
                    player_name: m.player_name || '',
                    entry_name: m.entry_name || '',
                    total: m.total || 0,
                    event_total: m.event_total || 0
                });
            }
        });

        /* ترتيب حسب النقاط */
        teamMembers.sort(function(a, b){
            return (b.total || 0) - (a.total || 0);
        });

        result.managers = teamMembers;
        result.totalManagers = teamMembers.length;

        if (teamMembers.length > 0) {
            let sum = 0;
            let sumGW = 0;

            teamMembers.forEach(function(m){
                sum += m.total || 0;
                sumGW += m.event_total || 0;
            });

            result.totalPoints = sum;
            result.avgPoints = Math.round(sum / teamMembers.length);
            result.avgGW = Math.round(sumGW / teamMembers.length);
            result.topPoints = teamMembers[0].total || 0;
            result.lowPoints = teamMembers[teamMembers.length - 1].total || 0;
            result.topManager = teamMembers[0];
            result.lowManager = teamMembers[teamMembers.length - 1];
        }

    } catch(e){
        console.error('[TeamView] collect error:', e);
    }

    return result;
}

/* =========================================================
   RENDER MODAL CONTENT
========================================================= */

function tvRenderModal(data){
    const logoURL = tvGetLogoURL(data.teamName);

    let logoHtml = '';
    if (logoURL) {
        logoHtml = '<img src="' + logoURL + '" alt="" onerror="this.style.display=\'none\'">';
    }

    /* Header */
    let html = '';

    html += '<button class="team-modal-close" onclick="closeTeamView()">' +
                '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
            '</button>';

    html += '<div class="team-modal-header">' +
                logoHtml +
                '<div class="team-modal-title">' + tvEscapeHTML(data.teamName) + '</div>' +
            '</div>';

    /* KPIs */
    html += '<div class="team-modal-kpis">' +
                '<div class="team-modal-kpi">' +
                    '<div class="team-modal-kpi-label">Managers</div>' +
                    '<div class="team-modal-kpi-value">' + data.totalManagers + '</div>' +
                '</div>' +
                '<div class="team-modal-kpi">' +
                    '<div class="team-modal-kpi-label">Avg Points</div>' +
                    '<div class="team-modal-kpi-value">' + data.avgPoints + '</div>' +
                '</div>' +
                '<div class="team-modal-kpi">' +
                    '<div class="team-modal-kpi-label">Top Points</div>' +
                    '<div class="team-modal-kpi-value">' + data.topPoints + '</div>' +
                '</div>' +
            '</div>';

    /* Managers list */
    if (data.managers.length === 0) {
        html += '<div class="team-modal-loading">' +
                    'لا يوجد مديرون مسجلون لهذا الفريق' +
                '</div>';
    } else {
        html += '<div class="team-modal-list">';

        data.managers.forEach(function(m, idx){
            const rank = idx + 1;
            const entryName = m.entry_name || m.player_name || 'Unknown';
            const playerName = m.player_name || '';

            /* تمييز أول 3 وآخر 3 */
            let rowClass = '';
            if (rank === 1)      rowClass = ' top';
            else if (rank === data.managers.length && data.managers.length > 3) rowClass = ' bottom';

            /* Trend indicator (بسيط) */
            let trendIcon = '';
            if (rank === 1) trendIcon = '<span class="tg-icon tg-icon-sm tg-icon-crown" style="color:#F59E0B;"></span>';
            else if (rowClass === ' bottom') trendIcon = '<span class="tg-icon tg-icon-sm tg-icon-warning" style="color:#EF4444;"></span>';

            html += '<div class="team-player-row' + rowClass + '">' +
                        '<div class="team-player-rank">' + rank + '</div>' +
                        '<div class="team-player-name" title="' + tvEscapeHTML(entryName) + '">' +
                            tvEscapeHTML(entryName) +
                        '</div>' +
                        '<div class="team-player-points">' + (m.total || 0) + '</div>' +
                        '<div class="team-player-trend">' + trendIcon + '</div>' +
                    '</div>';

            /* سطر ثانوي لاسم اللاعب إذا مختلف */
            if (playerName && playerName !== entryName) {
                /* صف فارغ يحتوي الاسم الحقيقي بمحاذاة */
                /* ندمجه في نفس الصف بدل صف جديد */
            }
        });

        html += '</div>';
    }

    /* Footer */
    html += '<div style="margin-top:14px;padding-top:12px;border-top:1.5px solid rgba(124,58,237,0.25);text-align:center;font-size:9px;font-weight:900;letter-spacing:3px;color:#A78BFA;">TELEGRAM GOAT</div>';

    return html;
}

/* =========================================================
   OPEN / CLOSE
========================================================= */

async function openTeamView(teamName){
    if (!teamName) {
        if (typeof showToast === 'function') showToast('اسم الفريق غير معروف', false);
        return;
    }

    const modal = document.getElementById('teamModal');
    if (!modal) {
        console.warn('[TeamView] #teamModal not found');
        if (typeof showToast === 'function') showToast('Modal غير موجود', false);
        return;
    }

    /* Loading state */
    modal.innerHTML =
        '<div class="team-modal-box">' +
            '<button class="team-modal-close" onclick="closeTeamView()">' +
                '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
            '</button>' +
            '<div class="team-modal-loading">' +
                '<div class="spinner" style="margin:0 auto 12px;"></div>' +
                'جاري تحميل بيانات الفريق...' +
            '</div>' +
        '</div>';

    modal.classList.add('show');

    modal.onclick = function(e){
        if (e.target === modal) closeTeamView();
    };

    /* Collect + render */
    try {
        const data = await tvCollectTeamData(teamName);

        modal.innerHTML =
            '<div class="team-modal-box">' + tvRenderModal(data) + '</div>';

        modal.onclick = function(e){
            if (e.target === modal) closeTeamView();
        };

    } catch(e){
        console.error('[TeamView] Failed:', e);
        modal.innerHTML =
            '<div class="team-modal-box">' +
                '<button class="team-modal-close" onclick="closeTeamView()">' +
                    '<span class="tg-icon tg-icon-sm tg-icon-close"></span>' +
                '</button>' +
                '<div class="team-modal-loading" style="color:#EF4444;">' +
                    'فشل تحميل البيانات: ' + tvEscapeHTML(e.message) +
                '</div>' +
            '</div>';
    }
}

function closeTeamView(){
    const modal = document.getElementById('teamModal');
    if (modal) {
        modal.classList.remove('show');
        modal.innerHTML = '';
    }
}

/* =========================================================
   KEYBOARD — ESC to close
========================================================= */

document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeTeamView();
});

/* =========================================================
   EXPORTS
========================================================= */

window.openTeamView = openTeamView;
window.closeTeamView = closeTeamView;

console.log('[TeamView] Ready.');

})();
