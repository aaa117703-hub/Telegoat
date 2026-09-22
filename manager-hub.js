/* =========================================================
   manager-hub.js — v2
   إدارة المديرين حسب الفرق (بدون تعارض مع Clubs)
========================================================= */

(function(){
'use strict';

const SUPABASE_URL = 'https://qzsteswrannqsrnlytzl.supabase.co';
const EDIT_PASSWORD = '024680';

let hubData = {};
let hubLoading = false;
let hubLoaded = false;
let hubEditMode = false;
let hubActiveTeam = null;
let hubSb = null;
let hubInitialized = false;

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

/* ========== Teams ========== */
function getTeamsList(){
    if(typeof TEAMS_LOGOS === 'undefined') return [];
    return Object.keys(TEAMS_LOGOS).sort();
}

function logoURL(teamName){
    if(typeof TEAMS_LOGOS === 'undefined') return '';
    const file = TEAMS_LOGOS[teamName];
    return file ? './' + file : '';
}

function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

function getTeamCount(teamName){
    return (hubData[teamName] || []).length;
}

function getTotalCount(){
    let total = 0;
    Object.keys(hubData).forEach(function(t){
        total += (hubData[t] || []).length;
    });
    return total;
}

/* ========== Supabase Load ========== */
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

/* ========== Render ========== */
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

    // Controls
    const controls = document.createElement('div');
    controls.className = 'mh-controls';

    const stats = document.createElement('div');
    stats.className = 'mh-stats';
    stats.innerHTML = '<span>' + getTotalCount() + '</span> MANAGERS · <span>' + getTeamsList().length + '</span> TEAMS';
    controls.appendChild(stats);

    const editBtn = document.createElement('button');
    editBtn.className = 'mh-edit-btn' + (hubEditMode ? ' active' : '');
    editBtn.textContent = hubEditMode ? 'DONE' : 'EDIT';
    editBtn.addEventListener('click', toggleEditMode);
    controls.appendChild(editBtn);

    wrap.appendChild(controls);

    // Teams Grid
    const grid = document.createElement('div');
    grid.className = 'mh-teams-grid';

    getTeamsList().forEach(function(team){
        const card = document.createElement('div');
        card.className = 'mh-team-card' + (hubActiveTeam === team ? ' active' : '');
        card.innerHTML =
            '<div class="mh-team-card-badge">' +
                '<img src="' + logoURL(team) + '" alt="" loading="lazy">' +
            '</div>' +
            '<div class="mh-team-card-name">' + escapeHTML(team) + '</div>' +
            '<div class="mh-team-card-count">' + getTeamCount(team) + ' MANAGERS</div>';

        card.addEventListener('click', function(){
            hubActiveTeam = (hubActiveTeam === team) ? null : team;
            render();
        });

        grid.appendChild(card);
    });

    wrap.appendChild(grid);

    // Active Team Panel
    if(hubActiveTeam){
        wrap.appendChild(renderPanel(hubActiveTeam));
    }
}

/* ========== Panel ========== */
function renderPanel(team){
    const panel = document.createElement('div');
    panel.className = 'mh-panel';

    const managers = hubData[team] || [];

    const header = document.createElement('div');
    header.className = 'mh-panel-header';

    const title = document.createElement('div');
    title.className = 'mh-panel-title';
    title.innerHTML = '<img src="' + logoURL(team) + '" alt="">' + escapeHTML(team);
    header.appendChild(title);

    const count = document.createElement('div');
    count.className = 'mh-panel-count';
    count.textContent = managers.length + ' MANAGERS';
    header.appendChild(count);

    panel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'mh-managers-list';

    if(managers.length === 0){
        list.innerHTML = '<div class="mh-empty" style="padding:20px;font-size:12px;">No managers yet</div>';
    } else {
        managers.forEach(function(name, idx){
            const row = document.createElement('div');
            row.className = 'mh-manager-row';

            const num = document.createElement('div');
            num.className = 'mh-manager-num';
            num.textContent = idx + 1;

            const nameEl = document.createElement('div');
            nameEl.className = 'mh-manager-name';
            nameEl.textContent = name;
            nameEl.title = 'Click to view FPL squad';
            nameEl.addEventListener('click', function(){
                openManagerSquadFor(name);
            });

            const del = document.createElement('button');
            del.className = 'mh-manager-delete';
            del.textContent = '×';
            del.disabled = !hubEditMode;
            del.title = hubEditMode ? 'Delete' : 'Enable Edit first';
            del.addEventListener('click', function(){
                if(!hubEditMode) return;
                deleteManager(team, idx);
            });

            row.appendChild(num);
            row.appendChild(nameEl);
            row.appendChild(del);
            list.appendChild(row);
        });
    }

    panel.appendChild(list);

    if(hubEditMode){
        const addRow = document.createElement('div');
        addRow.className = 'mh-add-row';

        const input = document.createElement('input');
        input.className = 'mh-add-input';
        input.type = 'text';
        input.placeholder = 'اسم المدير الجديد...';

        const btn = document.createElement('button');
        btn.className = 'mh-add-btn';
        btn.textContent = 'ADD';
        btn.addEventListener('click', function(){
            const val = input.value.trim();
            if(!val){
                alert('اكتب اسم المدير');
                return;
            }
            addManager(team, val);
            input.value = '';
        });

        input.addEventListener('keypress', function(e){
            if(e.key === 'Enter') btn.click();
        });

        addRow.appendChild(input);
        addRow.appendChild(btn);
        panel.appendChild(addRow);
    }

    return panel;
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
        alert('هذا المدير موجود مسبقاً في ' + team);
        return;
    }
    hubData[team].push(name);
    const ok = await saveTeam(team, hubData[team]);
    if(!ok){
        hubData[team].pop();
        alert('فشل الحفظ');
        return;
    }
    render();
}

async function deleteManager(team, idx){
    const managers = hubData[team] || [];
    const name = managers[idx];
    if(!name) return;
    if(!confirm('حذف "' + name + '" من ' + team + '؟')) return;

    managers.splice(idx, 1);
    const ok = await saveTeam(team, managers);
    if(!ok){
        managers.splice(idx, 0, name);
        alert('فشل الحذف');
        return;
    }
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

        // ensure all 20 teams exist
        getTeamsList().forEach(function(t){
            if(!hubData[t]) hubData[t] = [];
        });

        hubLoading = false;
        hubLoaded = true;
        render();
        console.log('[MH] Ready. Teams:', Object.keys(hubData).length, '· Managers:', getTotalCount());
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

    // If tab is already active (shouldn't be by default), init
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
