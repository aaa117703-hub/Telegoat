/* =========================================================
   totw.js — منطق وعرض تشكيلة الأسبوع (TOTW)
========================================================= */

// 1. إنشاء كرت اللاعب (الاسم -> القميص -> النقاط)
function createTOTWCard(player) {
    const card = document.createElement('div');
    card.className = 'totw-card';

    // الاسم (فوق)
    const nameEl = document.createElement('div');
    nameEl.className = 'tc-name';
    const rawName = player.web_name || player.name || 'Player';
    nameEl.innerText = rawName;
    nameEl.title = rawName;

    // القميص (في الوسط)
    const shirtEl = document.createElement('div');
    shirtEl.className = 'tc-shirt';
    
    const shirtImg = document.createElement('img');
    const playerTeam = player.team_name || player.team || '';
    shirtImg.src = player.shirt_url || (typeof getShirtUrl === 'function' ? getShirtUrl(playerTeam) : './default-shirt.png');
    shirtImg.alt = playerTeam || 'Shirt';
    shirtImg.onerror = function() {
        this.onerror = null;
        this.parentElement.innerHTML = `<span class="tc-shirt-fallback">👕</span>`;
    };
    shirtEl.appendChild(shirtImg);

    // النقاط (تحت)
    const pointsEl = document.createElement('div');
    pointsEl.className = 'tc-points';
    pointsEl.innerText = `${player.points ?? 0} pts`;

    // تركيب العناصر بالترتيب المطلوب
    card.appendChild(nameEl);
    card.appendChild(shirtEl);
    card.appendChild(pointsEl);

    return card;
}

// 2. توزيع اللاعبين على خطوط الملعب
function renderTOTW(playersList) {
    const gkContainer = document.querySelector('.totw-row-gk');
    const defContainer = document.querySelector('.totw-row-def');
    const midContainer = document.querySelector('.totw-row-mid');
    const fwdContainer = document.querySelector('.totw-row-fwd');

    if (!gkContainer || !defContainer || !midContainer || !fwdContainer) return;

    // تفريغ الصفوف
    gkContainer.innerHTML = '';
    defContainer.innerHTML = '';
    midContainer.innerHTML = '';
    fwdContainer.innerHTML = '';

    if (!Array.isArray(playersList) || playersList.length === 0) return;

    playersList.forEach(player => {
        const card = createTOTWCard(player);
        const pos = (player.position || player.element_type_name || '').toString().toLowerCase();

        if (pos.includes('gk') || pos.includes('goalkeeper') || player.element_type === 1) {
            gkContainer.appendChild(card);
        } else if (pos.includes('def') || player.element_type === 2) {
            defContainer.appendChild(card);
        } else if (pos.includes('mid') || player.element_type === 3) {
            midContainer.appendChild(card);
        } else if (pos.includes('fwd') || pos.includes('forward') || player.element_type === 4) {
            fwdContainer.appendChild(card);
        }
    });
}

// 3. جلب بيانات التشكيلة من السيرفر/API
async function fetchTOTWData(gw) {
    const pitchArea = document.querySelector('.totw-players');
    if (!pitchArea) return;

    try {
        // إذا كان هناك رابط API معرف في المشروع
        const apiUrl = typeof WORKER_URL !== 'undefined' ? `${WORKER_URL}/totw?gw=${gw}` : `/api/totw?gw=${gw}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        const players = data.players || data;
        renderTOTW(players);
    } catch (err) {
        console.error('Error loading TOTW:', err);
    }
}

// 4. تهيئة الأحداث والزر الخاص بالجولات
document.addEventListener('DOMContentLoaded', () => {
    const gwSelect = document.querySelector('.totw-gw-select');
    const refreshBtn = document.querySelector('.totw-refresh-btn');

    if (gwSelect) {
        gwSelect.addEventListener('change', (e) => {
            const selectedGW = e.target.value;
            fetchTOTWData(selectedGW);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const currentGW = gwSelect ? gwSelect.value : 1;
            fetchTOTWData(currentGW);
        });
    }
});
