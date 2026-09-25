/* =========================================================
   manager-hub.js — v5
   - إضافة: syncMissingManagers() — يجيب المديرين من FPL
     الي مو معيّنين لأي فريق ويضيفهم لـ __NO_TEAM__
   - إضافة: زر "نقل" ⇄ في وضع التعديل — نقل أي مدير لأي فريق
========================================================= */

(function(){
'use strict';

const EDIT_PASSWORD = '024680';
const NO_TEAM_KEY = '__NO_TEAM__';

let hubData = {};              // { teamName: [names...] }
let hubLoading = false;
let hubLoaded = false;
let hubEditMode = false;
let hubInitialized = false;
let hubSearchQuery = '';

/* ========== Supabase ========== */
function getSb(){
    return window.sbClient || null;
}

/* ========== Helpers ========== */
function logoURL(teamName){
    if(!teamName || teamName === NO_TEAM_KEY) return '';
    if(typeof TEAMS_LOGOS === 'undefined') return '';
    const file = TEAMS_LOGOS[teamName];
    return file ? './' + file : '';
}

function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

function getAllTeams(){
    if(typeof TEAMS_LOGOS === 'undefined') return [];
    return Object.keys(TEAMS_LOGOS).sort();
}

function teamLabel(team){
    return team === NO_TEAM_KEY ? '— بدون فريق —' : team;
}

/* ========== Flatten ========== */
function flattenManagers(){
    const list = [];
    Object.keys(hubData).forEach(function(team){
        (hubData[team] || []).forEach(function(name){
            list.push({ name: name, team: team });
        });
    });
    return list;
}

function getTotalCount(){
    let total = 0;
    Object.keys(hubData).forEach(function(t){
        total += (hubData[t] || []).length;
    });
    return total;
}

/* ========== Supabase Load/Save ========== */
async function loadHubData(){
    const sb = getSb();
    if(!sb) return null;
    try {
        const { data, error } = await sb
            .from('managers_by_team')
            .select('team, managers');
        if(error){
            console.warn('[MH] Load error:', error.message);
            return null;
        }
        const map = {};
        (data || []).forEach(function(row){
            map[row.team] = Array.isArray(row.managers) ? row.managers : [];
        });
        return map;
    } catch(e){
        console.warn('[MH] Load exception:', e.message);
        return null;
    }
}

async function seedFromPlayersTeams(){
    const sb = getSb();
    if(!sb) return false;
    if(typeof PLAYERS_TEAMS === 'undefined') return false;

    const teams = Object.keys(PLAYERS_TEAMS);
    const rows = teams.map(function(t){
        return {
            team: t,
            managers: PLAYERS_TEAMS[t] || [],
            updated_at: new Date().toISOString()
        };
    });

    try {
        const { error } = await sb
            .from('managers_by_team')
            .upsert(rows, { onConflict: 'team' });
        if(error){
            console.warn('[MH] Seed error:', error.message);
            return false;
        }
        console.log('[MH] Seeded', rows.length, 'teams');
        return true;
    } catch(e){
        console.warn('[MH] Seed exception:', e.message);
        return false;
    }
}

async function saveTeam(teamName, managers){
    const sb = getSb();
    if(!sb) return false;
    try {
        const { error } = await sb
            .from('managers_by_team')
            .upsert({
                team: teamName,
                managers: managers,
                updated_at: new Date().toISOString()
            }, { onConflict: 'team' });
        if(error){
            console.error('[MH] Save error:', error.message);
            return false;
        }
        return true;
    } catch(e){
        console.error('[MH] Save exception:', e.message);
        return false;
    }
}

/* ========== Sync Missing Managers from FPL ========== */
async function syncMissingManagers(){
    if(typeof getAllManagersCached !== 'function'){
        console.warn('[MH] getAllManagersCached not available');
        return;
    }

    let allFPL = [];
    try {
        allFPL = await getAllManagersCached();
    } catch(e){
        console.warn('[MH] Sync fetch failed:', e.message);
        return;
    }

    if(!allFPL || allFPL.length === 0) return;

    // ابني set من كل الأسماء الموجودة (كل الفرق + بدون فريق)
    const existing = {};
    Object.keys(hubData).forEach(function(team){
        (hubData[team] || []).forEach(function(name){
            const key = String(name || '').trim().toLowerCase();
            if(key) existing[key] = true;
        });
    });

    // لقي المديرين الناقصين
    const missing = [];
    allFPL.forEach(function(m){
        const name = String(m.player_name || m.entry_name || '').trim();
        if(!name) return;
        const key = name.toLowerCase();
        if(!existing[key]){
            missing.push(name);
            existing[key] = true; // منع التكرار داخل نفس القائمة
        }
    });

    if(missing.length === 0){
        console.log('[MH] No missing managers');
        return;
    }

    // أضفهم تحت "بدون فريق"
    if(!hubData[NO_TEAM_KEY]) hubData[NO_TEAM_KEY] = [];
    missing.forEach(function(name){
        if(hubData[NO_TEAM_KEY].indexOf(name) === -1){
            hubData[NO_TEAM_KEY].push(name);
        }
    });

    // احفظ في Supabase
    await saveTeam(NO_TEAM_KEY, hubData[NO_TEAM_KEY]);

    console.log('[MH] Synced ' + missing.length + ' missing managers → ' + NO_TEAM_KEY);
}

/* ========== Render Main ========== */
function render(){
    const wrap = document.getElementById('mhContent');
    if(!wrap) return;

    if(hubLoading){
        wrap.innerHTML = '<div class="mh-loading"><div class="spinner"></div><div>Loading managers...</div></div>';
        return;
    }

    if(!hubLoaded){
        wrap.innerHTML = '<div class="mh-empty">Waiting for data...</div>';
        return;
    }

    wrap.innerHTML = '';

    /* --- Controls --- */
    const controls = document.createElement('div');
    controls.className = 'mh-controls';

    const stats = document.createElement('div');
    stats.className = 'mh-stats';
    stats.innerHTML = '<span>' + getTotalCount() + '</span> MANAGERS';
    controls.appendChild(stats);

    const editBtn = document.createElement('button');
    editBtn.className = 'mh-edit-btn' + (hubEditMode ? ' active' : '');
    editBtn.textContent = hubEditMode ? 'DONE' : 'EDIT';
    editBtn.addEventListener('click', toggleEditMode);
    controls.appendChild(editBtn);

    wrap.appendChild(controls);

    /* --- Add form (edit mode only) --- */
    if(hubEditMode){
        wrap.appendChild(buildAddForm());
    }

    /* --- Search --- */
    const searchBox = document.createElement('div');
    searchBox.className = 'mh-search-box';

    const searchInput = document.createElement('input');
    searchInput.className = 'mh-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'ابحث عن مدير...';
    searchInput.value = hubSearchQuery;
    searchInput.addEventListener('input', function(){
        hubSearchQuery = this.value;
        renderList();
    });

    searchBox.appendChild(searchInput);
    wrap.appendChild(searchBox);

    /* --- List container --- */
    const listContainer = document.createElement('div');
    listContainer.className = 'mh-list-container' + (hubEditMode ? ' edit-mode' : '');
    listContainer.id = 'mhListContainer';
    wrap.appendChild(listContainer);

    renderList();
}

/* ========== Add Form ========== */
function buildAddForm(){
    const addRow = document.createElement('div');
    addRow.className = 'mh-add-row';

    const nameInput = document.createElement('input');
    nameInput.className = 'mh-add-input';
    nameInput.type = 'text';
    nameInput.placeholder = 'اسم المدير الجديد...';

    const teamSelect = document.createElement('select');
    teamSelect.className = 'mh-add-select';

    const optNone = document.createElement('option');
    optNone.value = NO_TEAM_KEY;
    optNone.textContent = '— بدون فريق —';
    teamSelect.appendChild(optNone);

    getAllTeams().forEach(function(t){
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        teamSelect.appendChild(opt);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'mh-add-btn';
    addBtn.textContent = 'ADD';

    function doAdd(){
        const name = nameInput.value.trim();
        const team = teamSelect.value;
        if(!name){
            if(typeof showToast === 'function') showToast('اكتب اسم المدير', false);
            else alert('اكتب اسم المدير');
            return;
        }
        addManager(team, name);
        nameInput.value = '';
    }

    addBtn.addEventListener('click', doAdd);
    nameInput.addEventListener('keypress', function(e){
        if(e.key === 'Enter') doAdd();
    });

    addRow.appendChild(nameInput);
    addRow.appendChild(teamSelect);
    addRow.appendChild(addBtn);

    return addRow;
}

/* ========== Render List ========== */
function renderList(){
    const container = document.getElementById('mhListContainer');
    if(!container) return;

    let list = flattenManagers();

    if(hubSearchQuery){
        const q = hubSearchQuery.toLowerCase().trim();
        list = list.filter(function(m){
            return m.name.toLowerCase().indexOf(q) !== -1 ||
                   m.team.toLowerCase().indexOf(q) !== -1;
        });
    }

    list.sort(function(a, b){
        return a.name.localeCompare(b.name);
    });

    if(list.length === 0){
        container.innerHTML = '<div class="mh-empty" style="padding:30px;text-align:center;font-size:13px;">لا يوجد نتائج</div>';
        return;
    }

    let html = '<div class="mh-list-header">';
    html += '<div class="mh-lh-num">#</div>';
    html += '<div class="mh-lh-logo"></div>';
    html += '<div class="mh-lh-name">MANAGER</div>';
    html += '<div class="mh-lh-team">TEAM</div>';
    if(hubEditMode){
        html += '<div class="mh-lh-action"></div>';
    }
    html += '</div>';

    list.forEach(function(item, idx){
        const logo = logoURL(item.team);
        const isNoTeam = item.team === NO_TEAM_KEY;

        html += '<div class="mh-list-row" data-name="' + escapeHTML(item.name) + '" data-team="' + escapeHTML(item.team) + '">';
        html += '<div class="mh-lr-num">' + (idx + 1) + '</div>';

        if(logo){
            html += '<div class="mh-lr-logo"><img src="' + logo + '" loading="lazy" onerror="this.style.display=\'none\'"></div>';
        } else {
            html += '<div class="mh-lr-logo mh-lr-logo-empty"></div>';
        }

        html += '<div class="mh-lr-name" title="' + escapeHTML(item.name) + '">' + escapeHTML(item.name) + '</div>';
        html += '<div class="mh-lr-team' + (isNoTeam ? ' mh-lr-team-none' : '') + '">' + escapeHTML(teamLabel(item.team)) + '</div>';

        if(hubEditMode){
            html += '<button class="mh-lr-move" title="نقل إلى فريق آخر" style="background:linear-gradient(135deg,#448aff,#1f5dbf);color:#fff;border:none;border-radius:6px;width:26px;height:26px;font-size:13px;font-weight:900;cursor:pointer;margin-right:4px;padding:0;line-height:1;">⇄</button>';
            html += '<button class="mh-lr-delete" title="Delete">×</button>';
        }

        html += '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.mh-list-row').forEach(function(row){
        const name = row.dataset.name;
        const team = row.dataset.team;

        const nameEl = row.querySelector('.mh-lr-name');
        if(nameEl){
            nameEl.addEventListener('click', function(){
                openManagerSquadFor(name);
            });
        }

        const moveBtn = row.querySelector('.mh-lr-move');
        if(moveBtn){
            moveBtn.addEventListener('click', function(e){
                e.stopPropagation();
                openMoveModal(team, name);
            });
        }

        const delBtn = row.querySelector('.mh-lr-delete');
        if(delBtn){
            delBtn.addEventListener('click', function(){
                deleteManager(team, name);
            });
        }
    });
}

/* ========== Move Modal ========== */
function openMoveModal(fromTeam, name){
    const modal = document.getElementById('mhModal');
    if(!modal) return;

    // ابني قائمة الفرق
    let optionsHtml = '';

    // "بدون فريق" أول شي (لو المدير حالياً في فريق)
    if(fromTeam !== NO_TEAM_KEY){
        optionsHtml +=
            '<button class="mh-move-option" data-team="' + NO_TEAM_KEY + '" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;text-align:left;width:100%;margin-bottom:6px;letter-spacing:0.3px;">' +
                '<span style="font-size:14px;">—</span>' +
                '<span>بدون فريق</span>' +
            '</button>';
    }

    getAllTeams().forEach(function(t){
        if(t === fromTeam) return;

        const logo = logoURL(t);
        optionsHtml +=
            '<button class="mh-move-option" data-team="' + escapeHTML(t) + '" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;text-align:left;width:100%;margin-bottom:6px;letter-spacing:0.3px;">' +
                (logo ? '<img src="' + logo + '" style="width:22px;height:22px;object-fit:contain;" onerror="this.style.display=\'none\'">' : '') +
                '<span>' + escapeHTML(t) + '</span>' +
            '</button>';
    });

    modal.innerHTML =
        '<div class="mh-modal-box" style="max-height:80vh;display:flex;flex-direction:column;">' +
            '<div class="mh-modal-title">نقل "' + escapeHTML(name) + '"</div>' +
            '<div style="color:#b8b8b8;font-size:12px;text-align:center;margin-bottom:12px;">' +
                'من: <strong style="color:#00e676;">' + escapeHTML(teamLabel(fromTeam)) + '</strong>' +
            '</div>' +
            '<div style="color:#fff;font-size:12px;text-align:center;margin-bottom:10px;font-weight:700;">اختر الفريق الجديد:</div>' +
            '<div class="mh-move-list" style="max-height:50vh;overflow-y:auto;padding:4px;">' + optionsHtml + '</div>' +
            '<button class="mh-modal-btn mh-modal-cancel" id="mhMoveCancel" style="margin-top:10px;">إلغاء</button>' +
        '</div>';

    modal.classList.add('show');

    // ربط أحداث خيارات النقل
    modal.querySelectorAll('.mh-move-option').forEach(function(optBtn){
        optBtn.addEventListener('click', function(){
            const toTeam = this.dataset.team;
            closeMoveModal();
            executeMove(fromTeam, toTeam, name);
        });
    });

    // زر الإلغاء
    const cancelBtn = modal.querySelector('#mhMoveCancel');
    if(cancelBtn){
        cancelBtn.addEventListener('click', closeMoveModal);
    }

    // إغلاق بالضغط على الخلفية
    modal.onclick = function(e){
        if(e.target === modal) closeMoveModal();
    };
}

function closeMoveModal(){
    const modal = document.getElementById('mhModal');
    if(modal){
        modal.classList.remove('show');
        modal.innerHTML = '';
    }
}

async function executeMove(fromTeam, toTeam, name){
    const fromList = hubData[fromTeam] || [];
    const idx = fromList.indexOf(name);
    if(idx === -1){
        if(typeof showToast === 'function') showToast('المدير غير موجود', false);
        return;
    }

    // شيله من الفريق القديم
    fromList.splice(idx, 1);

    // أضفه للفريق الجديد
    if(!hubData[toTeam]) hubData[toTeam] = [];
    if(hubData[toTeam].indexOf(name) !== -1){
        // رجّعه لو كان مكرر
        fromList.splice(idx, 0, name);
        if(typeof showToast === 'function') showToast('موجود مسبقاً في ' + teamLabel(toTeam), false);
        return;
    }
    hubData[toTeam].push(name);

    // احفظ الفريقين
    const okFrom = await saveTeam(fromTeam, fromList);
    const okTo = await saveTeam(toTeam, hubData[toTeam]);

    if(!okFrom || !okTo){
        // رجّع الوضع القديم
        hubData[toTeam].pop();
        fromList.splice(idx, 0, name);
        if(typeof showToast === 'function') showToast('فشل النقل', false);
        else alert('فشل النقل');
        return;
    }

    if(typeof showToast === 'function'){
        showToast('نُقل إلى ' + teamLabel(toTeam), true);
    }
    render();
}

/* ========== Actions ========== */
function toggleEditMode(){
    if(hubEditMode){
        hubEditMode = false;
        render();
        return;
    }
    askPassword(function(ok){
        if(ok){
            hubEditMode = true;
            render();
        }
    });
}

async function addManager(team, name){
    if(!hubData[team]) hubData[team] = [];
    if(hubData[team].indexOf(name) !== -1){
        const label = team === NO_TEAM_KEY ? 'بدون فريق' : team;
        if(typeof showToast === 'function') showToast('موجود مسبقاً في ' + label, false);
        else alert('موجود مسبقاً');
        return;
    }
    hubData[team].push(name);
    const ok = await saveTeam(team, hubData[team]);
    if(!ok){
        hubData[team].pop();
        if(typeof showToast === 'function') showToast('فشل الحفظ', false);
        else alert('فشل الحفظ');
        return;
    }
    if(typeof showToast === 'function') showToast('تمت الإضافة', true);
    render();
}

async function deleteManager(team, name){
    const managers = hubData[team] || [];
    const idx = managers.indexOf(name);
    if(idx === -1) return;

    if(!confirm('حذف "' + name + '"؟')) return;

    managers.splice(idx, 1);
    const ok = await saveTeam(team, managers);
    if(!ok){
        managers.splice(idx, 0, name);
        if(typeof showToast === 'function') showToast('فشل الحذف', false);
        else alert('فشل الحذف');
        return;
    }
    if(typeof showToast === 'function') showToast('تم الحذف', true);
    render();
}

/* ========== Password Modal ========== */
function askPassword(callback){
    const modal = document.getElementById('mhModal');
    if(!modal){
        const val = prompt('كلمة السر:');
        callback(val === EDIT_PASSWORD);
        return;
    }

    modal.innerHTML =
        '<div class="mh-modal-box">' +
            '<div class="mh-modal-title">كلمة سر التعديل</div>' +
            '<input type="password" id="mhPassInput" class="mh-pass-input" placeholder="••••••" maxlength="10" inputmode="numeric">' +
            '<div class="mh-modal-buttons">' +
                '<button class="mh-modal-btn mh-modal-cancel" id="mhCancel">إلغاء</button>' +
                '<button class="mh-modal-btn mh-modal-confirm" id="mhConfirm">دخول</button>' +
            '</div>' +
            '<div class="mh-modal-error" id="mhError"></div>' +
        '</div>';

    modal.classList.add('show');

    const input = document.getElementById('mhPassInput');
    const errEl = document.getElementById('mhError');

    setTimeout(function(){ if(input) input.focus(); }, 100);

    function close(){
        modal.classList.remove('show');
        modal.innerHTML = '';
    }

    function confirm(){
        const val = (input.value || '').trim();
        if(val === EDIT_PASSWORD){
            close();
            callback(true);
        } else {
            errEl.textContent = 'كلمة السر غلط';
            input.value = '';
            input.focus();
        }
    }

    document.getElementById('mhCancel').addEventListener('click', function(){
        close();
        callback(false);
    });
    document.getElementById('mhConfirm').addEventListener('click', confirm);
    input.addEventListener('keypress', function(e){
        if(e.key === 'Enter') confirm();
    });

    modal.onclick = function(e){
        if(e.target === modal){ close(); callback(false); }
    };
}

/* ========== Open FPL Squad ========== */
async function openManagerSquadFor(name){
    try {
        if(typeof window.findManagerEntryId !== 'function'){
            await new Promise(function(r){ setTimeout(r, 800); });
        }
        if(typeof window.findManagerEntryId !== 'function'){
            alert('Squad viewer not ready. Try again.');
            return;
        }
        const entryId = await window.findManagerEntryId(name, '');
        if(!entryId){
            alert('Could not find "' + name + '" in FPL league.');
            return;
        }
        if(typeof window.openManagerSquad === 'function'){
            await window.openManagerSquad(entryId, name);
        }
    } catch(e){
        console.error('[MH] Squad error:', e);
        alert('Error: ' + e.message);
    }
}

/* ========== Init ========== */
async function initHub(){
    if(hubLoaded || hubLoading) return;
    hubLoading = true;
    render();

    try {
        let data = await loadHubData();

        if(!data || Object.keys(data).length === 0){
            console.log('[MH] Empty, seeding from PLAYERS_TEAMS...');
            await seedFromPlayersTeams();
            data = await loadHubData();
        }

        hubData = data || {};

        // تأكد كل الفرق موجودة
        getAllTeams().forEach(function(t){
            if(!hubData[t]) hubData[t] = [];
        });
        if(!hubData[NO_TEAM_KEY]) hubData[NO_TEAM_KEY] = [];

        hubLoading = false;
        hubLoaded = true;
        render();

        console.log('[MH] Ready. Managers:', getTotalCount());

        // ⭐ مزامنة المديرين الناقصين من FPL
        syncMissingManagers().then(function(){
            render();
        }).catch(function(e){
            console.warn('[MH] Sync failed:', e);
        });

    } catch(e){
        hubLoading = false;
        console.error('[MH] Init failed:', e);
        render();
    }
}

/* ========== Hook Managers Tab ========== */
function hookManagersTab(){
    const btn = document.querySelector('[data-tab="managers"]');
    if(!btn){
        setTimeout(hookManagersTab, 400);
        return;
    }
    if(hubInitialized) return;
    hubInitialized = true;

    btn.addEventListener('click', function(){
        setTimeout(initHub, 100);
    });

    const view = document.getElementById('statsView-managers');
    if(view && view.classList.contains('active')){
        setTimeout(initHub, 300);
    }

    console.log('[MH] Hooked Managers tab');
}

document.addEventListener('DOMContentLoaded', function(){
    setTimeout(hookManagersTab, 800);
});

window.mhInit = initHub;
window.mhReload = function(){
    hubLoaded = false;
    hubLoading = false;
    initHub();
};

})();
