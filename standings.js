/* =========================================================
   standings.js
   حساب الترتيب + عرض الجدول مع الأسهم
========================================================= */


/* =========================================================
   CALCULATE STANDINGS UP TO ROUND
   حساب الترتيب من الجولة 1 حتى جولة معينة
========================================================= */

function calculateStandingsUpToRound(targetRound) {

    const calculated = {};

    /* تهيئة كل الفرق بـ 0 */
    for (
        const teamKey in initialBasePoints
    ) {

        calculated[teamKey] = {
            key: teamKey,
            gf: 0,
            pts: 0
        };
    }

    /* المرور على كل الجولات من 1 حتى الهدف */
    for (
        let r = 1;
        r <= targetRound;
        r++
    ) {

        const roundMatches = matchweeks[r];

        if (!roundMatches) {
            continue;
        }

        roundMatches.forEach(
            (match, idx) => {

                const hKey = match[0];
                const aKey = match[1];

                const hVal =
                    scoresStorage[
                        `r${r}_m${idx}_home`
                    ];

                const aVal =
                    scoresStorage[
                        `r${r}_m${idx}_away`
                    ];

                /* فقط إذا كانت النتيجتان موجودتان */
                if (
                    hVal !== undefined &&
                    aVal !== undefined &&
                    hVal !== '' &&
                    aVal !== ''
                ) {

                    const hScore =
                        parseFloat(hVal);

                    const aScore =
                        parseFloat(aVal);

                    if (
                        Number.isNaN(hScore) ||
                        Number.isNaN(aScore)
                    ) {
                        return;
                    }

                    /* إضافة الأهداف */
                    calculated[hKey].gf += hScore;
                    calculated[aKey].gf += aScore;

                    /* حساب النقاط */
                    if (hScore > aScore) {

                        calculated[hKey].pts += 3;

                    } else if (aScore > hScore) {

                        calculated[aKey].pts += 3;

                    } else {

                        calculated[hKey].pts += 1;
                        calculated[aKey].pts += 1;
                    }
                }
            }
        );
    }

    /* ترتيب: أولاً بالنقاط، ثم بالأهداف */
    return Object
        .values(calculated)
        .sort(
            (a, b) =>
                b.pts - a.pts ||
                b.gf - a.gf
        );
}


/* =========================================================
   CALCULATE STANDINGS - الترتيب الحالي
========================================================= */

function calculateStandings() {

    return calculateStandingsUpToRound(
        currentRound
    );
}


/* =========================================================
   RENDER STANDINGS - عرض جدول الترتيب
========================================================= */

function renderStandings() {

    const tbody =
        document.getElementById(
            'standingsBody'
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML = '';

    const sortedTeams = calculateStandings();

    /* حساب ترتيب الجولة السابقة للأسهم */
    const prevRanks = {};

    if (currentRound >= 2) {

        const prevSortedTeams =
            calculateStandingsUpToRound(
                currentRound - 1
            );

        prevSortedTeams.forEach(
            (team, idx) => {

                prevRanks[team.key] = idx + 1;
            }
        );
    }

    sortedTeams.forEach(
        (team, index) => {

            const teamInfo =
                teamsMap[team.key] || {
                    name: team.key,
                    logo: ''
                };

            const position = index + 1;

            /* لون الخط (أخضر للأول / أحمر للـ 17) */
            let rowClass = '';

            if (position === 1) {
                rowClass = 'green-line';

            } else if (position === 17) {
                rowClass = 'red-line';
            }

            /* سهم الصعود/الهبوط/الثبات */
            let indicatorHtml = '';

            if (
                currentRound >= 2 &&
                prevRanks[team.key] !== undefined
            ) {

                const oldPos = prevRanks[team.key];

                let imgSrc = '';

                if (position < oldPos) {

                    imgSrc = './arrow_up_green.png';

                } else if (position > oldPos) {

                    imgSrc = './arrow_down_red.png';

                } else {

                    imgSrc = './equal_gray.png';
                }

                indicatorHtml = `
                    <img
                        src="${imgSrc}"
                        class="pos-indicator-img"
                        alt="trend"
                        onerror="
                            this.style.display='none'
                        "
                    >
                `;
            }

            /* إضافة الصف */
            tbody.innerHTML += `
                <tr class="${rowClass}">

                    <td>
                        <div class="pos-container">
                            ${indicatorHtml}
                            <span class="pos-number">
                                ${position}
                            </span>
                        </div>
                    </td>

                    <td>
                        <div class="team-cell">

                            <span class="logo-20">
                                <img
                                    src="./${teamInfo.logo}"
                                    alt="${teamInfo.name}"
                                    onerror="
                                        this.style.display='none'
                                    "
                                >
                            </span>

                            ${teamInfo.name}

                        </div>
                    </td>

                    <td>
                        <span class="stat-number">
                            ${team.gf}
                        </span>
                    </td>

                    <td>
                        <span
                            class="stat-number"
                            style="color:#7138f5;"
                        >
                            ${team.pts}
                        </span>
                    </td>

                </tr>
            `;
        }
    );
}
