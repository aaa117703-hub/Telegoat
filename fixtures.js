/* =========================================================
   fixtures.js
   عرض المباريات + التعديل + الحفظ + التنبيهات + Eruda
========================================================= */


/* =========================================================
   TOAST - التنبيهات
========================================================= */

function showToast(
    msg,
    isSuccess = false,
    duration = 3000
) {

    const toast =
        document.getElementById('toast');

    const content =
        document.getElementById('toastContent');

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    if (isSuccess) {

        content.innerHTML =
            `✅ ${msg}`;

    } else {

        content.innerHTML =
            `<span class="toast-spinner"></span> ${msg}`;
    }

    toast.classList.add('show');

    toastTimeout = setTimeout(() => {

        toast.classList.remove('show');

    }, duration);
}


/* =========================================================
   ROUND DROPDOWN - قائمة الجولات
========================================================= */

function initRoundDropdown() {

    const select =
        document.getElementById(
            'roundSelect'
        );

    if (!select) {
        return;
    }

    select.innerHTML = '';

    for (
        let i = 1;
        i <= 38;
        i++
    ) {

        const opt =
            document.createElement(
                'option'
            );

        opt.value = i;

        opt.innerText =
            `Round ${i}`;

        if (i === currentRound) {
            opt.selected = true;
        }

        select.appendChild(opt);
    }
}


/* =========================================================
   SELECT ROUND - اختيار جولة
========================================================= */

function selectRound(value) {

    currentRound =
        parseInt(value, 10);

    renderFixtures();

    if (activeTab === 'standings') {
        renderStandings();
    }
}


/* =========================================================
   CHANGE ROUND - التالي/السابق
========================================================= */

function changeRound(step) {

    currentRound += step;

    if (currentRound < 1) {
        currentRound = 1;
    }

    if (currentRound > 38) {
        currentRound = 38;
    }

    renderFixtures();

    if (activeTab === 'standings') {
        renderStandings();
    }
}


/* =========================================================
   SWITCH TAB - التبديل بين المباريات والترتيب
========================================================= */

function switchTab(tabName) {

    if (tabName === 'fpl') {

        showToast(
            'FPL — قريباً! ⚠️',
            false,
            3000
        );

        return;
    }

    activeTab = tabName;

    document
        .querySelectorAll('.tab-content')
        .forEach(el => {

            el.classList.remove(
                'active'
            );
        });

    if (tabName === 'standings') {

        document
            .getElementById('standingsTab')
            .classList.add('active');

        renderStandings();

    } else {

        document
            .getElementById('fixturesTab')
            .classList.add('active');
    }
}


/* =========================================================
   EDIT MODE - وضع التعديل
========================================================= */

function unlockEditWithPassword() {

    const pass =
        prompt(
            'Enter password to edit:'
        );

    if (pass === '1999') {

        editMode = true;

        document
            .getElementById('editPanel')
            .style.display = 'flex';

        renderFixtures();

        showToast(
            'Edit mode enabled ✓',
            true
        );

    } else if (pass !== null) {

        alert('Incorrect password!');
    }
}


function exitEditMode() {

    editMode = false;

    document
        .getElementById('editPanel')
        .style.display = 'none';

    renderFixtures();

    renderStandings();
}


/* =========================================================
   UPDATE SCORE - تحديث النتيجة في الذاكرة
========================================================= */

function updateScore(
    round,
    idx,
    type,
    val
) {

    scoresStorage[
        `r${round}_m${idx}_${type}`
    ] = val;
}


/* =========================================================
   RENDER FIXTURES - عرض المباريات
========================================================= */

function renderFixtures() {

    try {

        const list =
            document.getElementById(
                'fixturesList'
            );

        const title =
            document.getElementById(
                'currentRoundTitle'
            );

        const selectEl =
            document.getElementById(
                'roundSelect'
            );

        const fixturesTitle =
            document.getElementById(
                'fixturesBannerTitle'
            );

        if (!list) {
            return;
        }

        if (title) {

            title.innerText =
                `MATCHWEEK ${currentRound}`;
        }

        if (selectEl) {

            selectEl.value =
                currentRound;
        }

        if (fixturesTitle) {

            fixturesTitle.innerText =
                `MATCHWEEK ${currentRound} RESULTS`;
        }

        list.innerHTML = '';

        const matches =
            matchweeks[currentRound] || [];

        matches.forEach(
            (match, idx) => {

                const home =
                    teamsMap[match[0]] || {
                        name: match[0],
                        logo: ''
                    };

                const away =
                    teamsMap[match[1]] || {
                        name: match[1],
                        logo: ''
                    };

                const homeScore =
                    scoresStorage[
                        `r${currentRound}_m${idx}_home`
                    ] ?? '';

                const awayScore =
                    scoresStorage[
                        `r${currentRound}_m${idx}_away`
                    ] ?? '';

                const scoreContent =
                    editMode

                        ? `
                            <input
                                type="number"
                                class="score-input"
                                id="home_r${currentRound}_m${idx}"
                                value="${homeScore}"
                                placeholder="0"
                                oninput="
                                    updateScore(
                                        ${currentRound},
                                        ${idx},
                                        'home',
                                        this.value
                                    )
                                "
                            >

                            <span
                                style="
                                    font-weight:900;
                                    color:#fff;
                                    font-size:12px;
                                "
                            >:</span>

                            <input
                                type="number"
                                class="score-input"
                                id="away_r${currentRound}_m${idx}"
                                value="${awayScore}"
                                placeholder="0"
                                oninput="
                                    updateScore(
                                        ${currentRound},
                                        ${idx},
                                        'away',
                                        this.value
                                    )
                                "
                            >
                        `

                        : `
                            <span class="score-display">
                                ${
                                    homeScore !== ''
                                        ? homeScore
                                        : '-'
                                }
                            </span>

                            <span class="vs-text">
                                VS
                            </span>

                            <span class="score-display">
                                ${
                                    awayScore !== ''
                                        ? awayScore
                                        : '-'
                                }
                            </span>
                        `;

                list.innerHTML += `
                    <div class="fixture-row">

                        <div class="team-box home">

                            <span>
                                ${home.name}
                            </span>

                            <span class="logo-24">

                                <img
                                    src="./${home.logo}"
                                    alt="${home.name}"
                                    onerror="
                                        this.style.display='none'
                                    "
                                >

                            </span>

                        </div>

                        <div class="match-score-center">
                            ${scoreContent}
                        </div>

                        <div class="team-box away">

                            <span class="logo-24">

                                <img
                                    src="./${away.logo}"
                                    alt="${away.name}"
                                    onerror="
                                        this.style.display='none'
                                    "
                                >

                            </span>

                            <span>
                                ${away.name}
                            </span>

                        </div>

                    </div>
                `;
            }
        );

    } catch (e) {

        console.error(
            'renderFixtures error:',
            e
        );

        if (window.onerror) {

            window.onerror(
                'renderFixtures: ' + e.message,
                '',
                0,
                0,
                e
            );
        }
    }
}


/* =========================================================
   SAVE CURRENT ROUND - حفظ الجولة
========================================================= */

async function saveCurrentRound() {

    if (isSaving) {
        return;
    }

    isSaving = true;

    showToast('Saving...', false);

    document
        .getElementById('saveRoundBtn')
        .disabled = true;

    document
        .getElementById('clearRoundBtn')
        .disabled = true;

    const matches =
        matchweeks[currentRound] || [];

    matches.forEach(
        (match, idx) => {

            const homeInput =
                document.getElementById(
                    `home_r${currentRound}_m${idx}`
                );

            const awayInput =
                document.getElementById(
                    `away_r${currentRound}_m${idx}`
                );

            if (homeInput && awayInput) {

                scoresStorage[
                    `r${currentRound}_m${idx}_home`
                ] = homeInput.value;

                scoresStorage[
                    `r${currentRound}_m${idx}_away`
                ] = awayInput.value;
            }
        }
    );

    localStorage.setItem(
        'fpl_scores',
        JSON.stringify(scoresStorage)
    );

    let result = { ok: true };

    try {

        result =
            await saveRoundToSupabase(
                currentRound,
                matchweeks,
                scoresStorage
            );

    } catch (e) {

        result = {
            ok: false,
            error: e
        };
    }

    isSaving = false;

    document
        .getElementById('saveRoundBtn')
        .disabled = false;

    document
        .getElementById('clearRoundBtn')
        .disabled = false;

    if (result.ok) {

        showToast(
            'Saved successfully ✓',
            true
        );

        exitEditMode();

    } else {

        const errMsg =
            result.error &&
            result.error.message
                ? result.error.message
                : (
                    result.error
                        ? String(result.error)
                        : 'Unknown error'
                );

        showToast(
            'Save failed: ' + errMsg,
            false,
            20000
        );
    }
}


/* =========================================================
   CLEAR CURRENT ROUND - حذف الجولة
========================================================= */

async function clearCurrentRound() {

    if (isSaving) {
        return;
    }

    const confirmed =
        confirm(
            `Are you sure you want to clear round ${currentRound}?`
        );

    if (!confirmed) {
        return;
    }

    isSaving = true;

    showToast('Clearing...', false);

    document
        .getElementById('saveRoundBtn')
        .disabled = true;

    document
        .getElementById('clearRoundBtn')
        .disabled = true;

    const matches =
        matchweeks[currentRound] || [];

    matches.forEach(
        (match, idx) => {

            delete        scoresStorage[
                `r${currentRound}_m${idx}_home`
            ];

            delete scoresStorage[
                `r${currentRound}_m${idx}_away`
            ];
        }
    );

    localStorage.setItem(
        'fpl_scores',
        JSON.stringify(scores );

Storage)
    );

    let result = { ok: true };

    try {

        result =
            await clearRoundFromSupabase(
                currentRound
            );

       } catch (e) {

        result if (! = {
            ok: false,
title            error: e
        };
    }

    isSaving = false;

    document
        .getElementById('saveRoundBtn')
        .disabled = false;

    document
        .getElementById('clearRoundBtn')
        .disabled = false;

    if (result.ok) {

        showToast(
            'Round cleared ✓',
            true
        );

        exitEditMode();

    } else {

        const errMsg =
            result.error &&
            result.error.message
                ? result.error.message
                : (
                    result.error
                        ? String(result.error)
                        : 'Unknown error'
                );

        showToast(
            'Clear failed: ' + errMsg,
            false,
            20000
        );
    }
}


/* =========================================================
   LOCAL STORAGE BACKUP - حفظ تلقائي كل 5 ثواني
========================================================= */

setInterval(() => {

    if (
        Object.keys(scoresStorage).length > 0
    ) {

        localStorage.setItem(
            'fpl_scores',
            JSON.stringify(scoresStorage)
        );
    }

}, 5000);


/* =========================================================
   ERUDA DEBUG CONSOLE
   5 ضغطات على عنوان الجولة
========================================================= */

function setupEruda() {

    let clickCount = 0;
    let clickTimer = null;

    const titleEl =
        document.getElementById(
            'currentRoundTitle'
El) {
        return;
    }

    titleEl.addEventListener(
        'click',
        function () {

            clickCount++;

            clearTimeout(clickTimer);

            if (clickCount >= 5) {

                clickCount = 0;

                if (
                    typeof eruda !== 'undefined' &&
                    eruda.init
                ) {

                    try {

                        eruda.init();
                        eruda.show();

                    } catch (e) {}
                }
            }

            clickTimer =
                setTimeout(() => {

                    clickCount = 0;

                }, 2000);
        }
    );
}
