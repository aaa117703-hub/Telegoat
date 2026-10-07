/* =========================================================
   compare.js — v1
   Head-to-Head Compare: Manager A vs Manager B
========================================================= */

let cmpManagerA = null;
let cmpManagerB = null;
let cmpChart = null;
let cmpTotwCache = null;

/* =========================================================
   INIT (يُستدعى من switchStatsTab)
========================================================= */

function cmpInit() {
    const container = document.getElementById('cmpContainer');
    if (!container) return;

    if (!container.dataset.built) {
        container.dataset.built = '1';
        cmpBuildUI();
        cmpBindSearch('A');
        cmpBindSearch('B');
    }
}

/* =========================================================
   BUILD UI
========================================================= */

function cmpBuildUI() {
    const container = document.getElementById('cmpContainer');
    if (!container) return;

    container.innerHTML =
        '<div class="cmp-selectors">' +

            '<div class="cmp-selector cmp-selector-a">' +
                '<div class="cmp-selector-label">Manager A</div>' +
                '<div class="cmp-selector-display empty" id="cmpDisplayA">Select manager...</div>' +
                '<input type="text" class="cmp-search" id="cmpSearchA" placeholder="Search..." autocomplete="off">' +
                '<div class="cmp-results" id="cmpResultsA"></div>' +
            '</div>' +

            '<div class="cmp-vs">VS</div>' +

            '<div class="cmp-selector cmp-selector-b">' +
                '<div class="cmp-selector-label">Manager B</div>' +
                '<div class="cmp-selector-display empty" id="cmpDisplayB">Select manager...</div>' +
                '<input type="text" class="cmp-search" id="cmpSearchB" placeholder="Search..." autocomplete="off">' +
                '<div class="cmp-results" id="cmpResultsB"></div>' +
            '</div>' +

        '</div>' +

        '<div class="cmp-capture" id="cmpCapture">' +
            '<div class="cmp-empty" id="cmpEmptyState">' +
                '<span class="cmp-empty-icon">⚔️</span>' +
                'اختر مديرين للمقارنة' +
            '</div>' +
            '<div id="cmpBody" style="display:none;">' +
                '<div class="cmp-header">' +
                    '<div class="cmp-header-name a" id="cmpHeaderA">—</div>' +
                    '<div class="cmp-header-vs">VS</div>' +
                    '<div class="cmp-header-name b" id="cmpHeaderB">—</div>' +
                '</div>' +
                '<div class="cmp-metrics" id="cmpMetrics"></div>' +
                '<div class="cmp-chart-wrap">' +
                    '<canvas id="cmpChart"></canvas>' +
                '</div>' +
                '<div class="cmp-footer">TELEGRAM GOAT 🐐</div>' +
            '</div>' +
        '</div>' +

        '<div class="cmp-actions">' +
            '<button class="cmp-btn dl" onclick="cmpDownload(3)">📥 3x</button>' +
            '<button class="cmp-btn dl" onclick="cmpDownload(4)">📥 4x</button>' +
            '<button class="cmp-btn reset" onclick="cmpReset()">Reset</button>' +
        '</div>';

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.cmp-selector')) {
            document.getElementById('cmpResultsA')?.classList.remove('show');
            document.getElementById('cmpResultsB')?.classList.remove('show');
        }
    });
}

/* =========================================================
   SEARCH BIND
========================================================= */

function cmpBindSearch(side) {
    const input   = document.getElementById('cmpSearch' + side);
    const results = document.getElementById('cmpResults' + side);
    if (!input || !results) return;

    let timer = null;

    input.addEventListener('input', function () {
        clearTimeout(timer);
        const val = this.value;

        timer = setTimeout(function () {
            const q = val.trim();
            if (q.length < 1) {
                results.classList.remove('show');
                results.innerHTML = '';
                return;
            }
            cmpRenderResults(side, q);
        }, 120);
    });

    input.addEventListener('focus', function () {
        if (results.innerHTML.trim() !== '') results.classList.add('show');
    });
}

function cmpRenderResults(side, query) {
    const results = document.getElementById('cmpResults' + side);
    if (!results) return;

    if (typeof statsAllManagers === 'undefined' || !statsAllManagers.length) {
        results.innerHTML = '<div class="cmp-result-item">Loading...</div>';
        results.classList.add('show');

        if (typeof loadStats === 'function') loadStats();
        return;
    }

    const q = query.toLowerCase();
    const list = statsAllManagers.filter(function (m) {
        const pn = (m.player_name || '').toLowerCase();
        const en = (m.entry_name || '').toLowerCase();
        return pn.indexOf(q) !== -1 || en.indexOf(q) !== -1;
    }).slice(0, 10);

    if (list.length === 0) {
        results.innerHTML = '<div class="cmp-result-item">No results</div>';
        results.classList.add('show');
        return;
    }

    results.innerHTML = list.map(function (m) {
        const raw = m.player_name || m.entry_name || '';
        const en  = m.entry_name || '';
        return '<div class="cmp-result-item" data-entry="' + m.entry + '" onclick="cmpPick(\'' + side + '\',' + m.entry + ')">' +
            (en || raw) +
            (en && raw && en !== raw ? '<div class="cr-sub">' + raw + '</div>' : '') +
        '</div>';
    }).join('');

    results.classList.add('show');
}

/* =========================================================
   PICK
========================================================= */

function cmpPick(side, entryId) {
    const manager = statsAllManagers.find(function (m) { return m.entry === entryId; });
    if (!manager) return;

    if (side === 'A') cmpManagerA = manager;
    else               cmpManagerB = manager;

    const display = document.getElementById('cmpDisplay' + side);
    const input   = document.getElementById('cmpSearch' + side);
    const results = document.getElementById('cmpResults' + side);

    const name = manager.entry_name || manager.player_name || 'Unknown';
    display.textContent = name;
    display.classList.remove('empty');
    input.value = '';
    results.classList.remove('show');
    results.innerHTML = '';

    cmpRender();
}

/* =========================================================
   RENDER COMPARISON
========================================================= */

async function cmpRender() {
    const empty = document.getElementById('cmpEmptyState');
    const body  = document.getElementById('cmpBody');

    if (!cmpManagerA || !cmpManagerB) {
        empty.style.display = 'block';
        body.style.display  = 'none';
        return;
    }

    empty.style.display = 'none';
    body.style.display  = 'block';

    const nameA = cmpManagerA.entry_name || cmpManagerA.player_name || 'Manager A';
    const nameB = cmpManagerB.entry_name || cmpManagerB.player_name || 'Manager B';

    document.getElementById('cmpHeaderA').textContent = nameA;
    document.getElementById('cmpHeaderB').textContent = nameB;

    /* ---------- Load TOTW counts ---------- */
    const totwData = await cmpLoadTotwCounts();

    /* ---------- Compute metrics ---------- */
    const ranks = cmpComputeRanks();

    const metrics = [
        {
            label: 'Total',
            a: cmpManagerA.total || 0,
            b: cmpManagerB.total || 0,
            higher: true
        },
        {
            label: 'Avg GW',
            a: cmpAvgGW(cmpManagerA),
            b: cmpAvgGW(cmpManagerB),
            higher: true,
            decimals: 1
        },
        {
            label: 'This GW',
            a: cmpManagerA.event_total || 0,
            b: cmpManagerB.event_total || 0,
            higher: true
        },
        {
            label: 'League Rank',
            a: ranks[cmpManagerA.entry] || 0,
            b: ranks[cmpManagerB.entry] || 0,
            higher: false
        },
        {
            label: 'Overall Rank',
            a: cmpManagerA.rank || 0,
            b: cmpManagerB.rank || 0,
            higher: false,
            compact: true
        },
        {
            label: 'TOTW Week',
            a: totwData[cmpManagerA.entry] || 0,
            b: totwData[cmpManagerB.entry] || 0,
            higher: true
        },
        {
            label: 'TOTW Month',
            a: 0,
            b: 0,
            higher: true,
            empty: true
        },
        {
            label: 'Best GW',
            a: null,
            b: null,
            higher: true,
            empty: true
        }
    ];

    /* ---------- Render metric rows ---------- */
    const metricsEl = document.getElementById('cmpMetrics');
    metricsEl.innerHTML = metrics.map(function (m) {
        let aVal, bVal, aCls = '', bCls = '';

        if (m.empty || (m.a === null && m.b === null)) {
            aVal = '—'; bVal = '—';
            aCls = bCls = 'empty';
        } else {
            aVal = cmpFmt(m.a, m.decimals, m.compact);
            bVal = cmpFmt(m.b, m.decimals, m.compact);

            if (m.a === m.b) {
                aCls = bCls = 'tie';
            } else {
                const aWins = m.higher ? (m.a > m.b) : (m.a < m.b);
                aCls = aWins ? 'win' : 'lose';
                bCls = aWins ? 'lose' : 'win';
            }
        }

        return '<div class="cmp-metric">' +
            '<div class="cmp-metric-val ' + aCls + '">' + aVal + '</div>' +
            '<div class="cmp-metric-label">' + m.label + '</div>' +
            '<div class="cmp-metric-val ' + bCls + '">' + bVal + '</div>' +
        '</div>';
    }).join('');

    /* ---------- Render chart ---------- */
    cmpDrawChart(metrics, nameA, nameB);
}

/* =========================================================
   HELPERS
========================================================= */

function cmpAvgGW(manager) {
    const total = manager.total || 0;
    const rounds = Math.max(1, (typeof getLatestRound === 'function' ? getLatestRound() : 1) || 1);
    return total / rounds;
}

function cmpFmt(v, decimals, compact) {
    if (v === null || v === undefined) return '—';
    let n = Number(v);
    if (compact && n >= 1000) {
        return (n / 1000).toFixed(1) + 'k';
    }
    if (decimals) return n.toFixed(decimals);
    return Math.round(n).toString();
}

function cmpComputeRanks() {
    const map = {};
    if (typeof statsSortedByTotal === 'undefined' || !statsSortedByTotal.length) return map;
    statsSortedByTotal.forEach(function (m, i) {
        map[m.entry] = i + 1;
    });
    return map;
}

async function cmpLoadTotwCounts() {
    if (cmpTotwCache) return cmpTotwCache;

    const counts = {};

    if (!window.sbClient) {
        cmpTotwCache = counts;
        return counts;
    }

    try {
        const { data, error } = await window.sbClient
            .from('saved_totw')
            .select('data');

        if (error || !data) {
            cmpTotwCache = counts;
            return counts;
        }

        data.forEach(function (row) {
            const selected = row.data && row.data.selected;
            if (!Array.isArray(selected)) return;
            selected.forEach(function (entryId) {
                counts[entryId] = (counts[entryId] || 0) + 1;
            });
        });

        cmpTotwCache = counts;
        return counts;
    } catch (e) {
        console.warn('[Compare] TOTW load failed:', e);
        cmpTotwCache = counts;
        return counts;
    }
}

/* =========================================================
   CHART
========================================================= */

function cmpDrawChart(metrics, nameA, nameB) {
    const canvas = document.getElementById('cmpChart');
    if (!canvas) return;

    if (cmpChart) {
        cmpChart.destroy();
        cmpChart = null;
    }

    const valid = metrics.filter(function (m) {
        return !m.empty && m.a !== null && m.b !== null;
    });

    const labels = valid.map(function (m) { return m.label; });
    const dataA  = valid.map(function (m) { return Number(m.a) || 0; });
    const dataB  = valid.map(function (m) { return Number(m.b) || 0; });

    cmpChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: nameA,
                    data: dataA,
                    backgroundColor: 'rgba(124,58,237,0.75)',
                    borderColor: '#7C3AED',
                    borderWidth: 1.5,
                    borderRadius: 6
                },
                {
                    label: nameB,
                    data: dataB,
                    backgroundColor: 'rgba(220,38,38,0.75)',
                    borderColor: '#DC2626',
                    borderWidth: 1.5,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: 'EnglishCustom, Cairo, sans-serif', size: 11, weight: '900' },
                        color: '#111827',
                        padding: 10,
                        boxWidth: 12,
                        boxHeight: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: '#111827',
                    titleFont: { family: 'Cairo', size: 11 },
                    bodyFont: { family: 'Cairo', size: 11 },
                    padding: 8,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(124,58,237,0.08)' },
                    ticks: {
                        color: '#6B7280',
                        font: { family: 'EnglishCustom, Cairo', size: 10 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#374151',
                        font: { family: 'EnglishCustom, Cairo', size: 9, weight: '900' }
                    }
                }
            }
        }
    });
}

/* =========================================================
   RESET
========================================================= */

function cmpReset() {
    cmpManagerA = null;
    cmpManagerB = null;

    const dA = document.getElementById('cmpDisplayA');
    const dB = document.getElementById('cmpDisplayB');
    if (dA) { dA.textContent = 'Select manager...'; dA.classList.add('empty'); }
    if (dB) { dB.textContent = 'Select manager...'; dB.classList.add('empty'); }

    const iA = document.getElementById('cmpSearchA');
    const iB = document.getElementById('cmpSearchB');
    if (iA) iA.value = '';
    if (iB) iB.value = '';

    if (cmpChart) { cmpChart.destroy(); cmpChart = null; }

    document.getElementById('cmpEmptyState').style.display = 'block';
    document.getElementById('cmpBody').style.display = 'none';
}

/* =========================================================
   DOWNLOAD
========================================================= */

async function cmpDownload(scale) {
    if (!cmpManagerA || !cmpManagerB) {
        if (typeof showToast === 'function') showToast('اختر مديرين أولاً', false);
        return;
    }

    const target = document.getElementById('cmpCapture');
    if (!target) return;

    if (typeof showToast === 'function') showToast('جاري التحضير...', false, 8000);

    try {
        await new Promise(function (r) { setTimeout(r, 200); });

        const canvas = await html2canvas(target, {
            backgroundColor: '#FFFFFF',
            scale: scale || 3,
            useCORS: true,
            logging: false
        });

        canvas.toBlob(function (blob) {
            if (!blob) return;

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'H2H_' + Date.now() + '.png';
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(function () { URL.revokeObjectURL(url); }, 3000);

            if (typeof showToast === 'function') showToast('تم التحميل!', true);
        }, 'image/png');

    } catch (e) {
        console.error('[Compare] Download failed:', e);
        if (typeof showToast === 'function') showToast('فشل التحميل', false);
    }
}

/* =========================================================
   EXPORTS
========================================================= */

window.cmpInit        = cmpInit;
window.cmpPick        = cmpPick;
window.cmpReset       = cmpReset;
window.cmpDownload    = cmpDownload;
