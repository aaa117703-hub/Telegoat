/* =========================================================
   locks.js — نظام قفل 3 أقسام
========================================================= */

window.sectionLocks = {
    fixtures: false,
    standings: false,
    totw: false
};

window.pendingLocks = {
    fixtures: false,
    standings: false,
    totw: false
};

const LOCK_PIN = '024680';
const EDIT_PIN = '1999';

const SECTIONS = [
    { key: 'fixtures',  label: 'Fixtures'  },
    { key: 'standings', label: 'Standings' },
    { key: 'totw',      label: 'TOTW'      }
];


/* =========================================================
   HELPERS
========================================================= */

function isAdmin() {
    return localStorage.getItem('tg_admin') === 'true';
}

function isLocker() {
    return localStorage.getItem('tg_locker') === 'true';
}


/* =========================================================
   LOAD / SAVE
========================================================= */

async function loadLocks() {

    if (!window.sbClient) return;

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
            if (window.sectionLocks.hasOwnProperty(row.section)) {
                window.sectionLocks[row.section] = row.is_locked === true;
            }
        });

    } catch (e) {
        console.error('Load locks exception:', e);
    }
}


async function saveLock(section, isLocked) {

    if (!window.sbClient) return false;

    try {

        const { error } = await window.sbClient
            .from('site_locks')
            .upsert(
                {
                    section: section,
                    is_locked: isLocked,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'section' }
            );

        if (error) {
            console.error('Save lock error:', error);
            return false;
        }

        window.sectionLocks[section] = isLocked;
        return true;

    } catch (e) {
        console.error('Save lock exception:', e);
        return false;
    }
}


function isLocked(section) {
    return window.sectionLocks[section] === true;
}


/* =========================================================
   MAINTENANCE SCREEN
========================================================= */

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
            '<p style="font-size:12px;color:#888;margin-top:8px;">نرجع لكم قريباً</p>' +
            '<div class="maint-team">TELEGRAM GOAT 🐐</div>' +
        '</div>';

    overlay.classList.add('show');
}


function hideSectionMaintenance() {
    const overlay = document.getElementById('sectionMaintenance');
    if (overlay) overlay.classList.remove('show');
}


/* =========================================================
   ADMIN LOCK PANEL
========================================================= */

function buildAdminLockPanel() {

    const old = document.getElementById('adminLockPanel');
    if (old) old.remove();

    if (!isLocker()) return;

    const panel = document.createElement('div');
    panel.id = 'adminLockPanel';
    panel.className = 'admin-lock-panel';

    SECTIONS.forEach(function(s) {

        const locked = isLocked(s.key);

        const btn = document.createElement('button');
        btn.className = 'lock-btn' + (locked ? ' locked' : '');
        btn.type = 'button';

        btn.innerHTML =
            '<span class="lock-icon">' + (locked ? '🔒' : '🔓') + '</span>' +
            '<span class="lock-label">' + s.label + '</span>';

        btn.addEventListener('click', function() {
            openLockPanel(s.key, s.label);
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
    if (isLocker()) {
        buildAdminLockPanel();
    } else {
        removeAdminLockPanel();
    }
}


/* =========================================================
   ACTIVATE LOCK CONTROL — يُستدعى من الزر الموحد
========================================================= */

function activateLockControl() {

    localStorage.setItem('tg_locker', 'true');

    if (typeof showToast === 'function') {
        showToast('Lock Control enabled', true);
    }

    buildAdminLockPanel();
}


/* =========================================================
   LOCK PANEL PER SECTION
========================================================= */

function openLockPanel(sectionKey, sectionLabel) {

    closeLockPanel();

    window.pendingLocks[sectionKey] = window.sectionLocks[sectionKey];

    const isLockedNow = window.pendingLocks[sectionKey];

    const panel = document.createElement('div');
    panel.id = 'lockPanel';
    panel.className = 'lock-panel';

    panel.innerHTML =
        '<div class="lock-panel-header">' +
            '<span>🔐 ' + sectionLabel + '</span>' +
            '<button class="lock-panel-close" onclick="closeLockPanel()">✕</button>' +
        '</div>' +
        '<div class="lock-panel-body">' +
            '<div class="lock-status" id="lockStatusDisplay">' +
                'الحالة الحالية: ' + (isLockedNow ? '🔒 مقفول' : '🔓 مفتوح') +
            '</div>' +
            '<button class="lock-toggle-btn" id="lockToggleBtn" onclick="togglePendingLock(\'' + sectionKey + '\')">' +
                (isLockedNow ? '🔓 افتح القسم' : '🔒 اقفل القسم') +
            '</button>' +
            '<button class="lock-save-btn" id="lockSaveBtn" onclick="confirmSaveLock(\'' + sectionKey + '\',\'' + sectionLabel + '\')">' +
                '💾 حفظ' +
            '</button>' +
        '</div>';

    document.body.appendChild(panel);

    setTimeout(function() {
        panel.classList.add('show');
    }, 10);
}


function closeLockPanel() {

    const panel = document.getElementById('lockPanel');
    if (!panel) return;

    panel.classList.remove('show');

    setTimeout(function() {
        if (panel.parentNode) panel.remove();
    }, 250);
}


function togglePendingLock(sectionKey) {

    window.pendingLocks[sectionKey] = !window.pendingLocks[sectionKey];

    const pending = window.pendingLocks[sectionKey];

    const statusEl = document.getElementById('lockStatusDisplay');
    const toggleBtn = document.getElementById('lockToggleBtn');

    if (statusEl) {
        statusEl.textContent = 'الحالة ستكون: ' + (pending ? '🔒 مقفول' : '🔓 مفتوح');
    }

    if (toggleBtn) {
        toggleBtn.textContent = pending ? '🔓 افتح القسم' : '🔒 اقفل القسم';
    }
}


async function confirmSaveLock(sectionKey, sectionLabel) {

    if (window.pendingLocks[sectionKey] === window.sectionLocks[sectionKey]) {
        alert('ما فيه تغيير للحفظ');
        return;
    }

    const pass = prompt('أدخل رمز التأكيد للحفظ:');

    if (pass !== LOCK_PIN) {
        if (pass !== null) alert('الرمز غلط!');
        return;
    }

    const saveBtn = document.getElementById('lockSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ يحفظ...';
    }

    const ok = await saveLock(sectionKey, window.pendingLocks[sectionKey]);

    if (ok) {

        closeLockPanel();

        /* نشيل صلاحية القفل */
        localStorage.removeItem('tg_locker');

        removeAdminLockPanel();

        if (typeof showToast === 'function') {
            showToast(
                sectionLabel + ' ' + (window.sectionLocks[sectionKey] ? 'locked' : 'unlocked'),
                true
            );
        }

    } else {

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 حفظ';
        }

        alert('فشل الحفظ!');
    }
}


/* =========================================================
   INIT
========================================================= */

async function initLockSystem() {

    await loadLocks();
    refreshAdminLockPanel();
}
