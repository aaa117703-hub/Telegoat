/* =========================================================
   totw.js — منطق وعرض تشكيلة الأسبوع (TOTW)
========================================================= */

// 1. تنظيف اسم اللاعب (حذف الإيموجيات)
function normalizePlayerName(name) {
    if (!name) return 'Player';
    return name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

// 2. إنشاء كرت اللاعب (الاسم -> القميص -> النقاط)
function createTOTWCard(player) {
    const card = document.createElement('div');
    card.className = 'totw-card';

    // الاسم (فوق)
    const nameEl = document.createElement('div');
    nameEl.className = 'tc-name';
    const cleanName = normalizePlayerName(player.web_name || player.name || player.user_name);
    nameEl.innerText = cleanName;
    nameEl.title = cleanName;

    // القميص (في الوسط)
    const shirtEl = document.createElement('div');
    shirtEl.className = 'tc-shirt';
    
    const shirtImg = document.createElement('img');
    const playerTeam = player.team_name || player.team || '';
    
    // استخدام دالة القمصان من players-teams.js
    let shirtData = { url: './default-shirt.png', scale: 1 };
    if (typeof getShirtForTeam === 'function') {
        shirtData = getShirtForTeam(playerTeam);
    } else if (typeof getShirtUrl === 'function') {
        shirtData.url = getShirtUrl(playerTeam);
    }

    shirtImg.src = player.shirt_url || shirtData.url;
    shirtImg.alt = playerTeam || 'Shirt';
    
    if (shirtData.scale && shirtData.scale !== 1) {
        shirtImg.style.transform = `scale(${shirtData.scale})`;
    }

    shirtImg.onerror = function() {
        this.onerror = null;
        this.parentElement.innerHTML = `<span class="tc-shirt-fallback">👕</span>`;
    };
    shirtEl.appendChild(shirtImg);

    // النقاط (تحت)
    const pointsEl = document.createElement('div');
    pointsEl.className = 'tc-points';
    pointsEl.innerText = `${player.event_total ?? player.points ?? 0} pts`;

    card.appendChild(nameEl);
    card.appendChild(shirtEl);
    card.appendChild(pointsEl);

    return card;
}

// 3. ترتيب وأخذ أعلى 11 لاعب فقط
function getTOTWTop11(playersList) {
    if (!Array.isArray(playersList)) return [];
    
    // ترتيب تنازلي حسب نقاط الجولة
    const sorted = [...playersList].sort((a, b) => {
        const ptsA = a.event_total ?? a.points ?? 0;
        const ptsB = b.event_total ?? b.points ?? 0;
        return ptsB - ptsA;
    });

    // اقتطاع أعلى 11 مشترك
    return sorted.slice(0, 11);
}

// 4. توزيع اللاعبين على التشكيلة (1-4-3-3)
function renderTOTW(playersList) {
    const gkContainer = document.querySelector('.totw-row-gk');
    const defContainer = document.querySelector('.totw-row-def');
    const midContainer = document.querySelector('.totw-row-mid');
    const fwdContainer = document.querySelector('.totw-row-fwd');

    if (!gkContainer || !defContainer || !midContainer || !fwdContainer) return;

    gkContainer.innerHTML = '';
    defContainer.innerHTML = '';
    midContainer.innerHTML = '';
    fwdContainer.innerHTML = '';

    const top11 = getTOTWTop11(playersList);
    if (top11.length === 0) return;

    // توزيع 1 حارس، 4 دفاع، 3 وسط، 3 هجوم حسب الترتيب أو المركز
    top11.forEach((player, idx) => {
        const card = createTOTWCard(player);
        const pos = (player.position || player.element_type_name || '').toString().toLowerCase();

        if (idx === 0 || pos.includes('gk') || player.element_type === 1) {
            gkContainer.appendChild(card);
        } else if (idx >= 1 && idx <= 4) {
            defContainer.appendChild(card);
        } else if (idx >= 5 && idx <= 7) {
            midContainer.appendChild(card);
        } else {
            fwdContainer.appendChild(card);
        }
    });
}

// 5. جلب البيانات من Supabase / Worker
async function fetchTOTWData(gw) {
    const pitchArea = document.querySelector('.totw-players');
    if (!pitchArea) return;

    try {
        let players = [];

        // إذا كان هناك اتصال مباشر مع Supabase عبر client
        if (window.sbClient) {
            const { data, error } = await window.sbClient
                .from('users')
                .select('*')
                .eq('gw', gw);
            
            if (!error && data) players = data;
        } 

        // fallback لجلب البيانات عبر Worker API
        if (players.length === 0) {
            const baseUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://telegoat-api.workers.dev';
            const res = await fetch(`${baseUrl}/totw?gw=${gw}`);
            if (res.ok) {
                const data = await res.json();
                players = data.players || data;
            }
        }

        renderTOTW(players);
    } catch (err) {
        console.error('Error loading TOTW:', err);
    }
}

// 6. الأحداث والتشغيل
document.addEventListener('DOMContentLoaded', () => {
    const gwSelect = document.querySelector('.totw-gw-select');
    const refreshBtn = document.querySelector('.totw-refresh-btn');

    if (gwSelect) {
        gwSelect.addEventListener('change', (e) => {
            fetchTOTWData(e.target.value);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const selectedGW = gwSelect ? gwSelect.value : 1;
            fetchTOTWData(selectedGW);
        });
    }
});
