/* =========================================================
   fixtures.js
========================================================= */

function showToast(msg, isSuccess, duration) {
    isSuccess = isSuccess || false;
    duration = duration || 3000;

    const toast = document.getElementById('toast');
    const content = document.getElementById('toastContent');

    if (!toast || !content) return;

    if (toastTimeout) clearTimeout(toastTimeout);

    if (isSuccess) {
        content.innerHTML = 'OK ' + msg;
        toast.classList.remove('error');
    } else {
        content.innerHTML = '<span class="toast-spinner"></span> ' + msg;
        toast.classList.add('error');
    }

    toast.classList.add('show');

    toastTimeout = setTimeout(function() {
        toast.classList.remove('show');
    }, duration);
}


function initRoundDropdown() {
    const select = document.getElementById('roundSelect');
    if (!select) return;

    select.innerHTML = '';

    for (let i = 1; i <= 38; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = 'Round ' + i;
        if (i === currentRound) opt.selected = true;
        select.appendChild(opt);
    }
}


function selectRound(value) {
    currentRound = parseInt(value, 10);
    renderFixtures();
    if (activeTab === 'standings') renderStandings();
}


function changeRound(step) {
    currentRound += step;
    if (currentRound < 1) currentRound = 1;
    if (currentRound > 38) currentRound = 38;
    renderFixtures();
    if (activeTab === 'standings') renderStandings();
}


function switchTab(tabName) {

    activeTab = tabName;

    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(function(el) { el.classList.remove('active'); });

    if (tabName === 'standings') {
        const el = document.getElementById('standingsTab');
        if (el) el.classList.add('active');
        renderStandings();
    } else if (tabName === 'totw') {
        const el = document.getElementById('totwTab');
        if (el) el.classList.add('active');
        if (typeof loadTOTW === 'function') loadTOTW();
    } else {
        const el = document.getElementById('fixturesTab');
        if (el) el.classList.add('active');
    }
}


function unlockEditWithPassword() {
    const pass = prompt('Enter password to edit:');
    if (pass === '1999') {
        editMode = true;
        const panel = document.getElementById('editPanel');
        if (panel) panel.style.display = 'flex';
        renderFixtures();
        showToast('Edit mode enabled', true);
    } else if (pass !== null) {
        alert('Incorrect password!');
    }
}


function exitEditMode() {
    editMode = false;
    const panel = document.getElementById('editPanel');
    if (panel) panel.style.display = 'none';
    renderFixtures();
    renderStandings();
}


function updateScore(round, idx, type, val) {
    scoresStorage['r' + round + '_m' + idx + '_' + type] = val;
}


/* =========================================================
   HELPERS — إحصائيات لكل فريق
========================================================= */

function getTeamStatsUpToRound(round) {
    const stats = {};
    if (round < 1) round = 0;

    const sorted = calculateStandingsUpToRound(round);

    sorted.forEach(function(team, idx) {
        stats[team.key] = {
            rank: idx + 1,
            form: team.form.slice(-5)
        };
    });

    return stats;
}


function getRankClass(rank) {
    if (rank >= 1 && rank <= 3) return 'rank-gold';
    if (rank >= 4 && rank <= 10) return 'rank-green';
    if (rank >= 11 && rank <= 16) return 'rank-gray';
    return 'rank-red';
}


function renderFormLetters(formArray) {
    if (!formArray || formArray.length === 0) return '';
    return formArray.map(function(letter) {
        return '<span class="fx-form-letter form-' + letter + '">' + letter + '</span>';
    }).join('');
}


/* =========================================================
   RENDER FIXTURES — تصميم أسطوري متناسق مع الترتيب
========================================================= */

function renderFixtures() {
    try {
        const list = document.getElementById('fixturesList');
        const title = document.getElementById('currentRoundTitle');
        const selectEl = document.getElementById('roundSelect');
        const fixturesTitle = document.getElementById('fixturesBannerTitle');

        if (!list) return;

        if (title) title.innerText = 'MATCHWEEK ' + currentRound;
        if (selectEl) selectEl.value = currentRound;
        if (fixturesTitle) fixturesTitle.innerText = 'MATCHWEEK ' + currentRound;

        list.innerHTML = '';

        const matches = matchweeks[currentRound] || [];
        const stats = getTeamStatsUpToRound(currentRound - 1);

        matches.forEach(function(match, idx) {

            const homeKey = match[0];
            const awayKey = match[1];
            const home = teamsMap[homeKey] || { name: homeKey, logo: '' };
            const away = teamsMap[awayKey] || { name: awayKey, logo: '' };

            const homeScore = scoresStorage['r' + currentRound + '_m' + idx + '_home'];
            const awayScore = scoresStorage['r' + currentRound + '_m' + idx + '_away'];

            const homeStats = stats[homeKey] || { rank: 0, form: [] };
            const awayStats = stats[awayKey] || { rank: 0, form: [] };

            const hScoreStr = (homeScore === undefined || homeScore === null) ? '' : homeScore;
            const aScoreStr = (awayScore === undefined || awayScore === null) ? '' : awayScore;

            /* تحديد الفائز */
            let scoreBoxClass = 'fx-score-draw';

            if (hScoreStr !== '' && aScoreStr !== '') {
                const h = parseInt(hScoreStr, 10);
                const a = parseInt(aScoreStr, 10);
                if (!isNaN(h) && !isNaN(a)) {
                    if (h > a) scoreBoxClass = 'fx-score-win';
                    else if (a > h) scoreBoxClass = 'fx-score-win';
                    else scoreBoxClass = 'fx-score-draw';
                }
            }

            const homeRankClass = homeStats.rank ? getRankClass(homeStats.rank) : 'rank-gray';
            const awayRankClass = awayStats.rank ? getRankClass(awayStats.rank) : 'rank-gray';

            const homeRankDisplay = homeStats.rank ? homeStats.rank : '-';
            const awayRankDisplay = awayStats.rank ? awayStats.rank : '-';

            /* محتوى صندوق النتيجة */
            let scoreContent = '';

            if (editMode) {
                scoreContent =
                    '<input type="number" class="score-input" id="home_r' + currentRound + '_m' + idx + '" value="' + hScoreStr + '" placeholder="0" oninput="updateScore(' + currentRound + ',' + idx + ',\'home\',this.value)">' +
                    '<span class="fx-dash">-</span>' +
                    '<input type="number" class="score-input" id="away_r' + currentRound + '_m' + idx + '" value="' + aScoreStr + '" placeholder="0" oninput="updateScore(' + currentRound + ',' + idx + ',\'away\',this.value)">';
            } else {
                const hDisp = hScoreStr !== '' ? hScoreStr : '-';
                const aDisp = aScoreStr !== '' ? aScoreStr : '-';
                scoreContent =
                    '<span class="fx-score-value">' + hDisp + '</span>' +
                    '<span class="fx-dash">-</span>' +
                    '<span class="fx-score-value">' + aDisp + '</span>';
            }

            const imgOnError = 'this.style.display=\'none\'';

            list.innerHTML +=
                '<div class="fixture-row">' +
                    '<div class="fx-side fx-home">' +
                        '<span class="fx-rank ' + homeRankClass + '">' + homeRankDisplay + '</span>' +
                        '<span class="logo-24">' +
                            '<img src="./' + home.logo + '" alt="' + home.name + '" onerror="' + imgOnError + '">' +
                        '</span>' +
                        '<div class="fx-info">' +
                            '<div class="fx-name">' + home.name + '</div>' +
                            '<div class="fx-form">' + renderFormLetters(homeStats.form) + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="fx-score ' + scoreBoxClass + '">' + scoreContent + '</div>' +
                    '<div class="fx-side fx-away">' +
                        '<div class="fx-info">' +
                            '<div class="fx-name">' + away.name + '</div>' +
                            '<div class="fx-form">' + renderFormLetters(awayStats.form) + '</div>' +
                        '</div>' +
                        '<span class="logo-24">' +
                            '<img src="./' + away.logo + '" alt="' + away.name + '" onerror="' + imgOnError + '">' +
                        '</span>' +
                        '<span class="fx-rank ' + awayRankClass + '">' + awayRankDisplay + '</span>' +
                    '</div>' +
                '</div>';
        });
    } catch (e) {
        console.error('renderFixtures error:', e);
    }
}


/* =========================================================
   SAVE + CLEAR
========================================================= */

async function saveCurrentRound() {
    if (isSaving) return;
    isSaving = true;
    showToast('Saving...', false);

    const saveBtn = document.getElementById('saveRoundBtn');
    const clearBtn = document.getElementById('clearRoundBtn');
    if (saveBtn) saveBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;

    const matches = matchweeks[currentRound] || [];

    matches.forEach(function(match, idx) {
        const homeInput = document.getElementById('home_r' + currentRound + '_m' + idx);
        const awayInput = document.getElementById('away_r' + currentRound + '_m' + idx);
        if (homeInput && awayInput) {
            scoresStorage['r' + currentRound + '_m' + idx + '_home'] = homeInput.value;
            scoresStorage['r' + currentRound + '_m' + idx + '_away'] = awayInput.value;
        }
    });

    localStorage.setItem('fpl_scores', JSON.stringify(scoresStorage));

    let result = { ok: true };
    try {
        result = await saveRoundToSupabase(currentRound, matchweeks, scoresStorage);
    } catch (e) {
        result = { ok: false, error: e };
    }

    isSaving = false;
    if (saveBtn) saveBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;

    if (result.ok) {
        showToast('Saved successfully', true);
        exitEditMode();
    } else {
        let errMsg = 'Unknown error';
        if (result.error && result.error.message) errMsg = result.error.message;
        else if (result.error) errMsg = String(result.error);
        showToast('Save failed: ' + errMsg, false, 20000);
    }
}


async function clearCurrentRound() {
    if (isSaving) return;

    const confirmed = confirm('Clear round ' + currentRound + '?');
    if (!confirmed) return;

    isSaving = true;
    showToast('Clearing...', false);

    const saveBtn = document.getElementById('saveRoundBtn');
    const clearBtn = document.getElementById('clearRoundBtn');
    if (saveBtn) saveBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;

    const matches = matchweeks[currentRound] || [];

    matches.forEach(function(match, idx) {
        delete scoresStorage['r' + currentRound + '_m' + idx + '_home'];
        delete scoresStorage['r' + currentRound + '_m' + idx + '_away'];
    });

    localStorage.setItem('fpl_scores', JSON.stringify(scoresStorage));

    let result = { ok: true };
    try {
        result = await clearRoundFromSupabase(currentRound);
    } catch (e) {
        result = { ok: false, error: e };
    }

    isSaving = false;
    if (saveBtn) saveBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;

    if (result.ok) {
        showToast('Round cleared', true);
        exitEditMode();
    } else {
        let errMsg = 'Unknown error';
        if (result.error && result.error.message) errMsg = result.error.message;
        else if (result.error) errMsg = String(result.error);
        showToast('Clear failed: ' + errMsg, false, 20000);
    }
}


setInterval(function() {
    if (Object.keys(scoresStorage).length > 0) {
        localStorage.setItem('fpl_scores', JSON.stringify(scoresStorage));
    }
}, 5000);


function setupEruda() {
    let clickCount = 0;
    let clickTimer = null;
    const titleEl = document.getElementById('currentRoundTitle');
    if (!titleEl) return;

    titleEl.addEventListener('click', function() {
        clickCount++;
        clearTimeout(clickTimer);

        if (clickCount >= 5) {
            clickCount = 0;
            if (typeof eruda !== 'undefined' && eruda.init) {
                try { eruda.init(); eruda.show(); } catch (e) {}
            }
        }

        clickTimer = setTimeout(function() { clickCount = 0; }, 2000);
    });
}
