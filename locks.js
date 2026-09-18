/* =========================================================
   locks.js — نظام قفل الأقسام
========================================================= */

/* حالة الأقفال — محلية */
window.sectionLocks = {
    fixtures: false,
    standings: false,
    totw: false
};

/* هل المستخدم admin؟ */
function checkAdmin() {
    return localStorage.getItem('tg_admin') === 'true';
}

/* يجيب الأقفال من Supabase */
async function loadLocks() {

    if (!window.sbClient) {
        console.warn('Supabase not available');
        return;
    }

    try {

        const { data, error } = await window.sbClient
            .from('site_locks')
            .select('section, is_locked');

        if (error) {
            console.error('Load locks error:', error);
            return;
        }

        if (!data) return;

        data.forEach(function(row) {
            window.sectionLocks[row.section] = row.is_locked;
        });

        console.log('Locks loaded:', window.sectionLocks);

    } catch (e) {
        console.error('Load locks exception:', e);
    }
}

/* يحفظ قفل قسم في Supabase */
async function setLock(section, isLocked) {

    if (!window.sbClient) {
        console.warn('Supabase not available');
        return false;
    }

    try {

        const { error } = await window.sbClient
            .from('site_locks')
            .update({
                is_locked: isLocked,
                updated_at: new Date().toISOString()
            })
            .eq('section', section);

        if (error) {
            console.error('Set lock error:', error);
            return false;
        }

        window.sectionLocks[section] = isLocked;
        return true;

    } catch (e) {
        console.error('Set lock exception:', e);
        return false;
    }
}

/* هل القسم مقفول؟ */
function isLocked(section) {
    return window.sectionLocks[section] === true;
}

/* يبني شاشة الصيانة */
function showSectionMaintenance(sectionName) {

    let overlay = document.getElementById('sectionMaintenance');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sectionMaintenance';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML =
        '<div class="maint-box">' +
            '<div class="maint-icon">🔧</div>' +
            '<h2>الموقع في حالة صيانة</h2>' +
            '<p>قسم ' + sectionName + ' قيد الصيانة حالياً</p>' +
            '<p style="font-size:12px;color:#888;margin-top:12px;">نرجع لكم قريباً</p>' +
            '<div class="maint-team">TELEGRAM GOAT 🐐</div>' +
        '</div>';

    overlay.classList.add('show');
}

function hideSectionMaintenance() {
    const overlay = document.getElementById('sectionMaintenance');
    if (overlay) overlay.classList.remove('show');
}


/* =========================================================
   ADMIN LOCK PANEL — 3 أزرار
========================================================= */

function buildAdminLockPanel() {

    /* نشيل اللوحة القديمة إذا موجودة */
    const oldPanel = document.getElementById('adminLockPanel');
    if (oldPanel) oldPanel.remove();

    /* ننشئ لوحة جديدة */
    const panel = document.createElement('div');
    panel.id = 'adminLockPanel';
    panel.className = 'admin-lock-panel';

    const sections = [
        { key: 'fixtures',  label: 'Fixtures'  },
        { key: 'standings', label: 'Standings' },
        { key: 'totw',      label: 'TOTW'      }
    ];

    sections.forEach(function(s) {

        const locked = isLocked(s.key);

        const btn = document.createElement('button');
        btn.className = 'lock-btn' + (locked ? ' locked' : '');
        btn.setAttribute('data-section', s.key);
        btn.type = 'button';

        btn.innerHTML =
            '<span class="lock-icon">' + (locked ? '🔒' : '🔓') + '</span>' +
            '<span class="lock-label">' + s.label + '</span>';

        btn.addEventListener('click', async function() {

            const current = isLocked(s.key);
            const next = !current;

            btn.disabled = true;

            const success = await setLock(s.key, next);

            btn.disabled = false;

            if (success) {
                btn.classList.toggle('locked', next);
                btn.querySelector('.lock-icon').textContent = next ? '🔒' : '🔓';

                /* لو صار قفل — نأكد للزائر */
                if (typeof showToast === 'function') {
                    showToast(next ? s.label + ' locked' : s.label + ' unlocked', true);
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast('Failed to update lock', false);
                }
            }
        });

        panel.appendChild(btn);
    });

    document.body.appendChild(panel);
}

function removeAdminLockPanel() {
    const panel = document.getElementById('adminLockPanel');
    if (panel) panel.remove();
}

function refreshAdminLockPanel() {
    if (checkAdmin()) {
        buildAdminLockPanel();
    } else {
        removeAdminLockPanel();
    }
}
