// totw.js - جلب وعرض تشكيلة الأسبوع بالتصميم المطلوب

document.addEventListener('DOMContentLoaded', () => {
    const gwSelect = document.getElementById('totwGwSelect');
    const refreshBtn = document.getElementById('totwRefreshBtn');
    const saveBtn = document.getElementById('totwSaveBtn');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const gw = gwSelect ? gwSelect.value : '1';
            loadTeamOfTheWeek(gw);
        });
    }

    if (gwSelect) {
        gwSelect.addEventListener('change', (e) => {
            loadTeamOfTheWeek(e.target.value);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', downloadTotwImage);
    }

    // التحميل الأولي للجولة المختارة
    if (gwSelect) {
        loadTeamOfTheWeek(gwSelect.value);
    }
});

async function loadTeamOfTheWeek(gw) {
    const loadingBox = document.getElementById('totwLoadingBox');
    const errorBox = document.getElementById('totwErrorBox');
    const pitch = document.getElementById('totwPitchToSave');

    if (loadingBox) loadingBox.style.display = 'flex';
    if (errorBox) errorBox.style.display = 'none';

    try {
        // جلب بيانات التشكيلة من Supabase أو المصدر المعرف لديك
        let playersData = [];
        if (typeof getTotwPlayersByGw === 'function') {
            playersData = await getTotwPlayersByGw(gw);
        } else if (window.supabase) {
            const { data, error } = await window.supabase
                .from('totw')
                .select('*')
                .eq('gw', gw);
            if (error) throw error;
            playersData = data || [];
        }

        renderTotwPitch(playersData);
    } catch (err) {
        console.error('Error loading TOTW:', err);
        if (errorBox) {
            errorBox.textContent = '❌ تعذر تحميل تشكيلة الأسبوع للجولة ' + gw;
            errorBox.style.display = 'block';
        }
    } finally {
        if (loadingBox) loadingBox.style.display = 'none';
    }
}

function renderTotwPitch(players) {
    // تفريغ الصفوف الاربعة
    const rowGk = document.querySelector('.totw-row-gk');
    const rowDef = document.querySelector('.totw-row-def');
    const rowMid = document.querySelector('.totw-row-mid');
    const rowFwd = document.querySelector('.totw-row-fwd');

    if (rowGk) rowGk.innerHTML = '';
    if (rowDef) rowDef.innerHTML = '';
    if (rowMid) rowMid.innerHTML = '';
    if (rowFwd) rowFwd.innerHTML = '';

    // تجميع اللاعبين حسب المركز
    const gkList = players.filter(p => p.position === 'GK' || p.pos === 'GK');
    const defList = players.filter(p => p.position === 'DEF' || p.pos === 'DEF');
    const midList = players.filter(p => p.position === 'MID' || p.pos === 'MID');
    const fwdList = players.filter(p => p.position === 'FWD' || p.pos === 'FWD');

    // توزيع البطاقات على الصفوف
    if (rowGk) gkList.forEach(p => rowGk.appendChild(createPlayerCard(p)));
    if (rowDef) defList.forEach(p => rowDef.appendChild(createPlayerCard(p)));
    if (rowMid) midList.forEach(p => rowMid.appendChild(createPlayerCard(p)));
    if (rowFwd) fwdList.forEach(p => rowFwd.appendChild(createPlayerCard(p)));
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'totw-player-card';

    // تحديد رابط قميص النادي
    const shirtUrl = player.shirt_url || player.shirt || getTeamShirtUrl(player.team) || './shirts/default.png';
    const playerName = player.web_name || player.name || 'Player';
    const playerPts = (player.event_points !== undefined ? player.event_points : (player.points || 0)) + ' pts';

    card.innerHTML = `
        <img src="${shirtUrl}" class="totw-shirt-img" alt="${playerName}">
        <div class="totw-player-info">
            <div class="totw-player-name">${playerName}</div>
            <div class="totw-player-pts">${playerPts}</div>
        </div>
    `;

    return card;
}

// دالة مساعدة لجلب القميص بحسب اسم الفريق في حال عدم توفره بالبيانات
function getTeamShirtUrl(teamName) {
    if (typeof TEAMS !== 'undefined' && TEAMS[teamName] && TEAMS[teamName].shirt) {
        return TEAMS[teamName].shirt;
    }
    return './shirts/default.png';
}

// دالة حفظ التشكيلة كصورة
function downloadTotwImage() {
    const pitch = document.getElementById('totwPitchToSave');
    if (!pitch) return;

    if (typeof html2canvas === 'undefined') {
        alert('مكتبة html2canvas غير محملة!');
        return;
    }

    html2canvas(pitch, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `TOTW-GW${document.getElementById('totwGwSelect')?.value || '1'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error('Error rendering image:', err);
    });
}
