/* =========================================================
   manager-hub.js — v3
   قائمة مسطحة لجميع المديرين + إضافة/حذف
========================================================= */

(function(){
'use strict';

const SUPABASE_URL = 'https://qzsteswrannqsrnlytzl.supabase.co';
const EDIT_PASSWORD = '024680';
const NO_TEAM_KEY = '__NO_TEAM__';

let hubData = {};              // { teamName: [names...] }
let hubLoading = false;
let hubLoaded = false;
let hubEditMode = false;
let hubSb = null;
let hubInitialized = false;
let hubSearchQuery = '';

/* ========== Supabase ========== */
function getSb(){
    if(hubSb) return hubSb;
    if(window.sbClient) return hubSb = window.sbClient;
    if(window.supabaseClient) return hubSb = window.supabaseClient;
    if(window.sb) return hubSb = window.sb;
    if(window.db) return hubSb = window.db;
    if(window._supabase) return hubSb = window._supabase;

    const key = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || window.ANON_KEY;
    if(window.supabase && window.supabase.createClient && key){
        hubSb = window.supabase.createClient(SUPABASE_URL, key);
        return hubSb;
    }
    return null;
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
    return team === NO_TEAM_KEY ? '—' : team;
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

    // Filter by search
    if(hubSearchQuery){
        const q = hubSearchQuery.toLowerCase().trim();
        list = list.filter(function(m){
            return m.name.toLowerCase().indexOf(q) !== -1 ||
                   m.team.toLowerCase().indexOf(q) !== -1;
        });
    }

    // Sort alphabetically
    list.sort(function(a, b){
        return a.name.localeCompare(b.name);
    });

    if(list.length === 0){
        container.innerHTML = '<div class="mh-empty" style="padding:30px;text-align:center;font-size:13px;">لا يوجد نتائج</div>';
        return;
    }

    /* --- Header --- */
    let html = '<div class="mh-list-header">';
    html += '<div class="mh-lh-num">#</div>';
    html += '<div class="mh-lh-logo"></div>';
    html += '<div class="mh-lh-name">MANAGER</div>';
    html += '<div class="mh-lh-team">TEAM</div>';
    if(hubEditMode){
        html += '<div class="mh-lh-action"></div>';
    }
    html += '</div>';

    /* --- Rows --- */
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
            html += '<button class="mh-lr-delete" title="Delete">×</button>';
        }

        html += '</div>';
    });

    container.innerHTML = html;

    /* --- Attach handlers --- */
    container.querySelectorAll('.mh-list-row').forEach(function(row){
        const name = row.dataset.name;
        const team = row.dataset.team;

        // Click on name → open FPL squad
        const nameEl = row.querySelector('.mh-lr-name');
        if(nameEl){
            nameEl.addEventListener('click', function(){
                openManagerSquadFor(name);
            });
        }

        // Delete button
        const delBtn = row.querySelector('.mh-lr-delete');
        if(delBtn){
            delBtn.addEventListener('click', function(){
                deleteManager(team, name);
            });
        }
    });
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
            console.log('[MH] Empty, seeding...');
            await seedFromPlayersTeams();
            data = await loadHubData();
        }

        hubData = data || {};

        // ensure all teams exist
        getAllTeams().forEach(function(t){
            if(!hubData[t]) hubData[t] = [];
        });
        if(!hubData[NO_TEAM_KEY]) hubData[NO_TEAM_KEY] = [];

        hubLoading = false;
        hubLoaded = true;
        render();
        console.log('[MH] Ready. Managers:', getTotalCount());
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
