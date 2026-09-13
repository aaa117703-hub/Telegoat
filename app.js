/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    'https://qzsteswrannqsrnlytzl.supabase.co';

const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6c3Rlc3dyYW5ucXNybmx5dHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTExNjgsImV4cCI6MjEwNDI4NzE2OH0.AFYiXODdfDbDiYn1fUoB9e2ZC8i7mFGgLvVxZzSPjxw';

window.sbClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


/* =========================================================
   SUPABASE - LOAD
========================================================= */

async function loadScoresFromSupabase(matchweeks) {
    try {
        const { data, error } = await window.sbClient
            .from('match_results')
            .select(
                'round, home_team, away_team, home_score, away_score'
            );

        if (error) {
            console.error(
                'Supabase load error:',
                error
            );
            return null;
        }

        if (!data || data.length === 0) {
            console.log(
                'لا توجد بيانات في Supabase بعد'
            );
            return null;
        }

        const result = {};

        data.forEach(row => {
            const round = parseInt(
                row.round,
                10
            );

            if (
                !matchweeks ||
                !matchweeks[round]
            ) {
                return;
            }

            const matches =
                matchweeks[round];

            const idx =
                matches.findIndex(m =>
                    m[0] === row.home_team &&
                    m[1] === row.away_team
                );

            if (idx === -1) {
                return;
            }

            if (
                row.home_score !== null &&
                row.home_score !== undefined
            ) {
                result[
                    `r${round}_m${idx}_home`
                ] = String(row.home_score);
            }

            if (
                row.away_score !== null &&
                row.away_score !== undefined
            ) {
                result[
                    `r${round}_m${idx}_away`
                ] = String(row.away_score);
            }
        });

        return result;

    } catch (e) {
        console.error(
            'خطأ غير متوقع في Supabase:',
            e
        );

        return null;
    }
}


/* =========================================================
   SUPABASE - SAVE ROUND
========================================================= */

async function saveRoundToSupabase(
    round,
    matchweeks,
    scoresStorage
) {
    try {
        const matches =
            matchweeks[round] || [];

        const rows = [];

        matches.forEach((match, idx) => {

            const hVal =
                scoresStorage[
                    `r${round}_m${idx}_home`
                ];

            const aVal =
                scoresStorage[
                    `r${round}_m${idx}_away`
                ];

            const hasHome =
                hVal !== undefined &&
                hVal !== '';

            const hasAway =
                aVal !== undefined &&
                aVal !== '';

            if (hasHome || hasAway) {
                rows.push({
                    round: String(round),
                    home_team: match[0],
                    away_team: match[1],
                    home_score:
                        hasHome
                            ? parseInt(hVal, 10)
                            : null,
                    away_score:
                        hasAway
                            ? parseInt(aVal, 10)
                            : null,
                    created_at: Date.now()
                });
            }
        });

        const { error: delError } =
            await window.sbClient
                .from('match_results')
                .delete()
                .eq('round', String(round));

        if (delError) {
            console.error(
                'خطأ في حذف الجولة من Supabase:',
                delError
            );

            return {
                ok: false,
                error: delError
            };
        }

        if (rows.length > 0) {

            const { error: insError } =
                await window.sbClient
                    .from('match_results')
                    .insert(rows);

            if (insError) {
                console.error(
                    'خطأ في إدخال البيانات إلى Supabase:',
                    insError
                );

                return {
                    ok: false,
                    error: insError
                };
            }
        }

        console.log(
            `✅ تم رفع ${rows.length} صف للجولة ${round} إلى Supabase`
        );

        return {
            ok: true,
            count: rows.length
        };

    } catch (e) {
        console.error(
            'خطأ غير متوقع في saveRoundToSupabase:',
            e
        );

        return {
            ok: false,
            error: e
        };
    }
}


/* =========================================================
   SUPABASE - CLEAR ROUND
========================================================= */

async function clearRoundFromSupabase(round) {
    try {

        const { error } =
            await window.sbClient
                .from('match_results')
                .delete()
                .eq('round', String(round));

        if (error) {
            console.error(
                'خطأ في حذف الجولة:',
                error
            );

            return {
                ok: false,
                error: error
            };
        }

        console.log(
            `✅ تم حذف صفوف الجولة ${round} من Supabase`
        );

        return {
            ok: true
        };

    } catch (e) {

        console.error(
            'خطأ غير متوقع في clearRoundFromSupabase:',
            e
        );

        return {
            ok: false,
            error: e
        };
    }
}


/* =========================================================
   GLOBAL STATE
========================================================= */

let editMode = false;

let scoresStorage =
    JSON.parse(
        localStorage.getItem('fpl_scores')
    ) || {};

let currentRound = 1;

let activeTab = 'fixtures';

let isSaving = false;

let toastTimeout = null;


/* =========================================================
   TOAST
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
   TEAMS
========================================================= */

const teamsMap = {

    "ARS": {
        name: "Arsenal",
        logo: "arsenal.png.WEBP"
    },

    "AVL": {
        name: "Aston Villa",
        logo: "aston_villa.png.WEBP"
    },

    "BOU": {
        name: "Bournemouth",
        logo: "bournemouth.png.WEBP"
    },

    "BRE": {
        name: "Brentford",
        logo: "brentford.png.PNG"
    },

    "BHA": {
        name: "Brighton",
        logo: "brighton.png.WEBP"
    },

    "CHE": {
        name: "Chelsea",
        logo: "chelsea.png.WEBP"
    },

    "COV": {
        name: "Coventry",
        logo: "coventry.png.WEBP"
    },

    "CRY": {
        name: "Crystal Palace",
        logo: "crystal_palace.png.WEBP"
    },

    "EVE": {
        name: "Everton",
        logo: "everton.png.WEBP"
    },

    "FUL": {
        name: "Fulham",
        logo: "fulham.png.WEBP"
    },

    "HUL": {
        name: "Hull",
        logo: "hull.png.WEBP"
    },

    "IPS": {
        name: "Ipswich",
        logo: "ipswich.png.WEBP"
    },

    "LEE": {
        name: "Leeds",
        logo: "leeds.png.WEBP"
    },

    "LIV": {
        name: "Liverpool",
        logo: "liverpool.png.WEBP"
    },

    "MCI": {
        name: "Man City",
        logo: "man_city.png.WEBP"
    },

    "MUN": {
        name: "Man Utd",
        logo: "man_utd.png.WEBP"
    },

    "NEW": {
        name: "Newcastle",
        logo: "newcastle.png.WEBP"
    },

    "NOT": {
        name: "Nott'm Forest",
        logo: "forest.png.PNG"
    },

    "SUN": {
        name: "Sunderland",
        logo: "sunderland.png.WEBP"
    },

    "TOT": {
        name: "Spurs",
        logo: "tottenham.png.WEBP"
    }

};


const initialBasePoints = {};

Object.keys(teamsMap).forEach(key => {
    initialBasePoints[key] = {
        gf: 0,
        pts: 0
    };
});


/* =========================================================
   MATCHWEEKS
========================================================= */

const matchweeks = {

    1: [
        ["ARS","COV"],
        ["HUL","MUN"],
        ["EVE","CRY"],
        ["IPS","SUN"],
        ["NOT","LEE"],
        ["BRE","TOT"],
        ["BHA","AVL"],
        ["MCI","BOU"],
        ["NEW","LIV"],
        ["FUL","CHE"]
    ],

    2: [
        ["BOU","EVE"],
        ["AVL","ARS"],
        ["CHE","BHA"],
        ["COV","HUL"],
        ["CRY","MCI"],
        ["LEE","BRE"],
        ["LIV","NOT"],
        ["MUN","IPS"],
        ["SUN","FUL"],
        ["TOT","NEW"]
    ],

    3: [
        ["ARS","CHE"],
        ["BRE","SUN"],
        ["BHA","LEE"],
        ["EVE","MUN"],
        ["FUL","CRY"],
        ["HUL","AVL"],
        ["IPS","LIV"],
        ["MCI","COV"],
        ["NEW","BOU"],
        ["NOT","TOT"]
    ],

    4: [
        ["BOU","BRE"],
        ["AVL","NOT"],
        ["CHE","HUL"],
        ["COV","BHA"],
        ["CRY","IPS"],
        ["LEE","NEW"],
        ["LIV","FUL"],
        ["MUN","MCI"],
        ["SUN","ARS"],
        ["TOT","EVE"]
    ],

    5: [
        ["BOU","LIV"],
        ["BRE","CHE"],
        ["BHA","ARS"],
        ["EVE","IPS"],
        ["FUL","MUN"],
        ["LEE","CRY"],
        ["MCI","SUN"],
        ["NEW","HUL"],
        ["NOT","COV"],
        ["TOT","AVL"]
    ],

    6: [
        ["ARS","LEE"],
        ["AVL","BRE"],
        ["CHE","BOU"],
        ["COV","NEW"],
        ["CRY","NOT"],
        ["HUL","EVE"],
        ["IPS","FUL"],
        ["LIV","MCI"],
        ["MUN","TOT"],
        ["SUN","BHA"]
    ],

    7: [
        ["BOU","SUN"],
        ["BRE","LIV"],
        ["BHA","CRY"],
        ["EVE","CHE"],
        ["FUL","HUL"],
        ["LEE","MUN"],
        ["MCI","IPS"],
        ["NEW","AVL"],
        ["NOT","ARS"],
        ["TOT","COV"]
    ],

    8: [
        ["ARS","EVE"],
        ["AVL","MCI"],
        ["CHE","TOT"],
        ["COV","FUL"],
        ["CRY","NEW"],
        ["HUL","BRE"],
        ["IPS","NOT"],
        ["LIV","BHA"],
        ["MUN","BOU"],
        ["SUN","LEE"]
    ],

    9: [
        ["BOU","LEE"],
        ["BRE","NOT"],
        ["CHE","MUN"],
        ["COV","SUN"],
        ["HUL","IPS"],
        ["LIV","ARS"],
        ["MCI","BHA"],
        ["NEW","EVE"],
        ["TOT","CRY"],
        ["AVL","FUL"]
    ],

    10: [
        ["ARS","HUL"],
        ["BHA","BRE"],
        ["CRY","LIV"],
        ["EVE","COV"],
        ["FUL","NEW"],
        ["IPS","BOU"],
        ["LEE","TOT"],
        ["MUN","AVL"],
        ["NOT","MCI"],
        ["SUN","CHE"]
    ],

    11: [
        ["BRE","EVE"],
        ["CHE","LEE"],
        ["COV","CRY"],
        ["HUL","BHA"],
        ["LIV","MUN"],
        ["MCI","FUL"],
        ["NEW","ARS"],
        ["TOT","IPS"],
        ["NOT","SUN"],
        ["AVL","BOU"]
    ],

    12: [
        ["ARS","MCI"],
        ["BHA","NEW"],
        ["CRY","HUL"],
        ["EVE","LIV"],
        ["FUL","BOU"],
        ["IPS","AVL"],
        ["LEE","COV"],
        ["MUN","BRE"],
        ["NOT","CHE"],
        ["SUN","TOT"]
    ],

    13: [
        ["BOU","BHA"],
        ["AVL","EVE"],
        ["BRE","ARS"],
        ["CHE","CRY"],
        ["COV","IPS"],
        ["HUL","NOT"],
        ["LIV","SUN"],
        ["MCI","LEE"],
        ["NEW","MUN"],
        ["TOT","FUL"]
    ],

    14: [
        ["BOU","HUL"],
        ["AVL","CRY"],
        ["BRE","MCI"],
        ["CHE","LIV"],
        ["EVE","FUL"],
        ["LEE","IPS"],
        ["MUN","COV"],
        ["NEW","SUN"],
        ["NOT","BHA"],
        ["TOT","ARS"]
    ],

    15: [
        ["ARS","BOU"],
        ["BHA","EVE"],
        ["COV","AVL"],
        ["CRY","MUN"],
        ["FUL","BRE"],
        ["HUL","TOT"],
        ["IPS","NEW"],
        ["LIV","LEE"],
        ["MCI","CHE"],
        ["SUN","NOT"]
    ],

    16: [
        ["BOU","COV"],
        ["ARS","MUN"],
        ["BRE","NEW"],
        ["BHA","IPS"],
        ["CHE","AVL"],
        ["LEE","FUL"],
        ["LIV","TOT"],
        ["MCI","HUL"],
        ["NOT","EVE"],
        ["SUN","CRY"]
    ],

    17: [
        ["AVL","LEE"],
        ["COV","CHE"],
        ["CRY","ARS"],
        ["EVE","SUN"],
        ["FUL","BHA"],
        ["HUL","LIV"],
        ["IPS","BRE"],
        ["MUN","NOT"],
        ["NEW","MCI"],
        ["TOT","BOU"]
    ],

    18: [
        ["AVL","LIV"],
        ["COV","BRE"],
        ["CRY","BOU"],
        ["EVE","MCI"],
        ["FUL","ARS"],
        ["HUL","LEE"],
        ["IPS","CHE"],
        ["MUN","SUN"],
        ["NEW","NOT"],
        ["TOT","BHA"]
    ],

    19: [
        ["BOU","AVL"],
        ["ARS","IPS"],
        ["BRE","CRY"],
        ["BHA","MUN"],
        ["CHE","NEW"],
        ["LEE","EVE"],
        ["LIV","COV"],
        ["MCI","TOT"],
        ["NOT","FUL"],
        ["SUN","HUL"]
    ],

    20: [
        ["ARS","BRE"],
        ["BHA","BOU"],
        ["CRY","CHE"],
        ["EVE","AVL"],
        ["FUL","TOT"],
        ["IPS","COV"],
        ["LEE","MCI"],
        ["MUN","NEW"],
        ["NOT","HUL"],
        ["SUN","LIV"]
    ],

    21: [
        ["AVL","EVE"],
        ["BRE","BHA"],
        ["CHE","SUN"],
        ["COV","LIV"],
        ["CRY","BOU"],
        ["FUL","MUN"],
        ["HUL","NEW"],
        ["LEE","ARS"],
        ["MCI","IPS"],
        ["TOT","NOT"]
    ],

    22: [
        ["BOU","CRY"],
        ["ARS","LEE"],
        ["BHA","MCI"],
        ["EVE","HUL"],
        ["IPS","AVL"],
        ["LIV","NEW"],
        ["MUN","FUL"],
        ["NOT","CHE"],
        ["SUN","COV"],
        ["TOT","BRE"]
    ],

    23: [
        ["AVL","LIV"],
        ["BRE","EVE"],
        ["CHE","NEW"],
        ["COV","MUN"],
        ["CRY","SUN"],
        ["HUL","ARS"],
        ["IPS","LEE"],
        ["MCI","BHA"],
        ["NOT","FUL"],
        ["TOT","BOU"]
    ],

    24: [
        ["BOU","COV"],
        ["ARS","AVL"],
        ["BHA","LIV"],
        ["EVE","NOT"],
        ["FUL","IPS"],
        ["LEE","HUL"],
        ["MUN","CRY"],
        ["NEW","TOT"],
        ["SUN","BRE"],
        ["MCI","CHE"]
    ],

    25: [
        ["AVL","BOU"],
        ["BRE","CRY"],
        ["COV","ARS"],
        ["HUL","MCI"],
        ["IPS","EVE"],
        ["LEE","SUN"],
        ["LIV","FUL"],
        ["MUN","NEW"],
        ["NOT","BHA"],
        ["TOT","CHE"]
    ],

    26: [
        ["BOU","LEE"],
        ["BHA","AVL"],
        ["CHE","HUL"],
        ["CRY","COV"],
        ["EVE","LIV"],
        ["FUL","NOT"],
        ["MCI","BRE"],
        ["NEW","MUN"],
        ["SUN","IPS"],
        ["TOT","ARS"]
    ],

    27: [
        ["AVL","CHE"],
        ["BRE","FUL"],
        ["COV","CRY"],
        ["HUL","BOU"],
        ["IPS","BHA"],
        ["LEE","EVE"],
        ["LIV","MUN"],
        ["ARS","MCI"],
        ["NOT","SUN"],
        ["TOT","NEW"]
    ],

    28: [
        ["ARS","NOT"],
        ["BOU","BRE"],
        ["BHA","HUL"],
        ["CRY","AVL"],
        ["EVE","LEE"],
        ["FUL","LIV"],
        ["MCI","TOT"],
        ["NEW","IPS"],
        ["SUN","MUN"],
        ["CHE","COV"]
    ],

    29: [
        ["ARS","FUL"],
        ["AVL","CHE"],
        ["BRE","NEW"],
        ["COV","LEE"],
        ["HUL","CRY"],
        ["IPS","MCI"],
        ["LIV","BHA"],
        ["MUN","EVE"],
        ["NOT","BOU"],
        ["TOT","SUN"]
    ],

    30: [
        ["BOU","IPS"],
        ["BHA","COV"],
        ["CHE","ARS"],
        ["CRY","MCI"],
        ["EVE","BRE"],
        ["FUL","HUL"],
        ["LEE","AVL"],
        ["LIV","NOT"],
        ["NEW","MUN"],
        ["SUN","TOT"]
    ],

    31: [
        ["ARS","CRY"],
        ["AVL","LEE"],
        ["BRE","FUL"],
        ["COV","EVE"],
        ["HUL","LIV"],
        ["IPS","CHE"],
        ["MCI","BHA"],
        ["NOT","MUN"],
        ["TOT","BOU"],
        ["NEW","SUN"]
    ],

    32: [
        ["BOU","ARS"],
        ["BHA","NOT"],
        ["CHE","FUL"],
        ["CRY","AVL"],
        ["EVE","IPS"],
        ["SUN","COV"],
        ["LEE","TOT"],
        ["LIV","BRE"],
        ["MUN","HUL"],
        ["NEW","MCI"]
    ],

    33: [
        ["ARS","NEW"],
        ["AVL","CRY"],
        ["BRE","LEE"],
        ["COV","BHA"],
        ["HUL","CHE"],
        ["IPS","BOU"],
        ["MCI","LIV"],
        ["NOT","EVE"],
        ["TOT","MUN"],
        ["FUL","SUN"]
    ],

    34: [
        ["BOU","AVL"],
        ["BHA","IPS"],
        ["CHE","BRE"],
        ["CRY","FUL"],
        ["EVE","ARS"],
        ["SUN","LEE"],
        ["LIV","TOT"],
        ["MUN","COV"],
        ["NEW","HUL"],
        ["NOT","MCI"]
    ],

    35: [
        ["ARS","BHA"],
        ["AVL","NOT"],
        ["BRE","BOU"],
        ["COV","CHE"],
        ["HUL","CRY"],
        ["IPS","MUN"],
        ["LEE","LIV"],
        ["MCI","EVE"],
        ["TOT","FUL"],
        ["NEW","SUN"]
    ],

    36: [
        ["BOU","MUN"],
        ["BHA","FUL"],
        ["CHE","IPS"],
        ["CRY","BRE"],
        ["EVE","AVL"],
        ["HUL","MCI"],
        ["LIV","COV"],
        ["NEW","LEE"],
        ["NOT","TOT"],
        ["SUN","ARS"]
    ],

    37: [
        ["ARS","LIV"],
        ["AVL","SUN"],
        ["BRE","HUL"],
        ["COV","BOU"],
        ["IPS","CRY"],
        ["LEE","CHE"],
        ["MCI","NEW"],
        ["MUN","NOT"],
        ["TOT","EVE"],
        ["FUL","BHA"]
    ],

    38: [
        ["BOU","NOT"],
        ["BHA","MUN"],
        ["CHE","AVL"],
        ["CRY","ARS"],
        ["EVE","FUL"],
        ["HUL","COV"],
        ["LEE","BRE"],
        ["LIV","IPS"],
        ["MCI","SUN"],
        ["TOT","NEW"]
    ]

};


/* =========================================================
   CAROUSEL
========================================================= */

const carouselSlides = [

    {
        image: './banner_matches.png',
        tab: 'fixtures',
        alt: 'Matches'
    },

    {
        image: './banner_standings.png',
        tab: 'standings',
        alt: 'Standings'
    }

];

let carouselIndex = 0;
let carouselTimer = null;
let touchStartX = 0;
let touchEndX = 0;


/* =========================================================
   BUILD CAROUSEL
========================================================= */

function buildCarousel() {

    const track =
        document.getElementById(
            'carouselTrack'
        );

    const dots =
        document.getElementById(
            'carouselDots'
        );

    if (!track || !dots) {
        return;
    }

    track.innerHTML = '';
    dots.innerHTML = '';

    carouselSlides.forEach(
        (slide, index) => {

            const item =
                document.createElement(
                    'div'
                );

            item.className =
                'carousel-slide';

            if (index === 0) {
                item.classList.add(
                    'active'
                );
            }

            const img =
                document.createElement(
                    'img'
                );

            img.src = slide.image;
            img.alt = slide.alt;

            img.onerror = function () {
                console.error(
                    'Carousel image not found:',
                    slide.image
                );
            };

            item.appendChild(img);

            item.addEventListener(
                'click',
                () => {
                    switchTab(
                        slide.tab
                    );
                }
            );

            track.appendChild(item);

            const dot =
                document.createElement(
                    'button'
                );

            dot.type = 'button';

            dot.className =
                'carousel-dot';

            if (index === 0) {
                dot.classList.add(
                    'active'
                );
            }

            dot.addEventListener(
                'click',
                event => {

                    event.stopPropagation();

                    goToCarousel(index);

                }
            );

            dots.appendChild(dot);

        }
    );
}


/* =========================================================
   GO TO CAROUSEL SLIDE
========================================================= */

function goToCarousel(index) {

    carouselIndex =
        (
            index +
            carouselSlides.length
        ) %
        carouselSlides.length;

    const slides =
        document.querySelectorAll(
            '.carousel-slide'
        );

    const dots =
        document.querySelectorAll(
            '.carousel-dot'
        );

    slides.forEach(
        (slide, i) => {

            slide.classList.toggle(
                'active',
                i === carouselIndex
            );

        }
    );

    dots.forEach(
        (dot, i) => {

            dot.classList.toggle(
                'active',
                i === carouselIndex
            );

        }
    );
}


/* =========================================================
   NEXT CAROUSEL
========================================================= */

function nextCarousel() {

    goToCarousel(
        carouselIndex + 1
    );

}


/* =========================================================
   START CAROUSEL
========================================================= */

function startCarousel() {

    stopCarousel();

    carouselTimer =
        setInterval(
            nextCarousel,
            5000
        );
}


/* =========================================================
   STOP CAROUSEL
========================================================= */

function stopCarousel() {

    if (carouselTimer) {

        clearInterval(
            carouselTimer
        );

        carouselTimer = null;
    }
}


/* =========================================================
   CAROUSEL TOUCH / SWIPE
========================================================= */

function setupCarouselTouch() {

    const carousel =
        document.getElementById(
            'carousel'
        );

    if (!carousel) {
        return;
    }

    carousel.addEventListener(
        'touchstart',
        event => {

            if (
                event.changedTouches &&
                event.changedTouches.length
            ) {

                touchStartX =
                    event.changedTouches[0]
                        .screenX;
            }

            stopCarousel();

        },
        {
            passive: true
        }
    );

    carousel.addEventListener(
        'touchend',
        event => {

            if (
                event.changedTouches &&
                event.changedTouches.length
            ) {

                touchEndX =
                    event.changedTouches[0]
                        .screenX;
            }

            const difference =
                touchEndX -
                touchStartX;

            if (
                Math.abs(difference) > 50
            ) {

                if (difference < 0) {

                    nextCarousel();

                } else {

                    goToCarousel(
                        carouselIndex - 1
                    );

                }
            }

            startCarousel();

        },
        {
            passive: true
        }
    );
}


/* =========================================================
   ROUND DROPDOWN
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

        select.appendChild(
            opt
        );
    }
}


/* =========================================================
   SELECT ROUND
========================================================= */

function selectRound(value) {

    currentRound =
        parseInt(
            value,
            10
        );

    renderFixtures();

    if (
        activeTab === 'standings'
    ) {
        renderStandings();
    }
}


/* =========================================================
   SWITCH TAB
========================================================= */

function switchTab(tabName) {

    activeTab = tabName;

    document
        .querySelectorAll(
            '.tab-content'
        )
        .forEach(el => {
            el.classList.remove(
                'active'
            );
        });

    if (
        tabName === 'standings'
    ) {

        document
            .getElementById(
                'standingsTab'
            )
            .classList.add(
                'active'
            );

        renderStandings();

    } else {

        document
            .getElementById(
                'fixturesTab'
            )
            .classList.add(
                'active'
            );
    }
}


/* =========================================================
   EDIT MODE
========================================================= */

function unlockEditWithPassword() {

    const pass =
        prompt(
            'Enter password to edit:'
        );

    if (pass === '1999') {

        editMode = true;

        document
            .getElementById(
                'editPanel'
            )
            .style.display = 'flex';

        renderFixtures();

        showToast(
            'Edit mode enabled ✓',
            true
        );

    } else if (
        pass !== null
    ) {

        alert(
            'Incorrect password!'
        );
    }
}


function exitEditMode() {

    editMode = false;

    document
        .getElementById(
            'editPanel'
        )
        .style.display = 'none';

    renderFixtures();

    renderStandings();
}


/* =========================================================
   SAVE CURRENT ROUND
========================================================= */

async function saveCurrentRound() {

    if (isSaving) {
        return;
    }

    isSaving = true;

    showToast(
        'Saving...',
        false
    );

    document
        .getElementById(
            'saveRoundBtn'
        )
        .disabled = true;

    document
        .getElementById(
            'clearRoundBtn'
        )
        .disabled = true;

    const matches =
        matchweeks[currentRound] ||
        [];

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

            if (
                homeInput &&
                awayInput
            ) {

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
        JSON.stringify(
            scoresStorage
        )
    );

    let result = {
        ok: true
    };

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
        .getElementById(
            'saveRoundBtn'
        )
        .disabled = false;

    document
        .getElementById(
            'clearRoundBtn'
        )
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
            'Save failed: ' +
            errMsg,
            false,
            20000
        );
    }
}


/* =========================================================
   CLEAR CURRENT ROUND
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

    showToast(
        'Clearing...',
        false
    );

    document
        .getElementById(
            'saveRoundBtn'
        )
        .disabled = true;

    document
        .getElementById(
            'clearRoundBtn'
        )
        .disabled = true;

    const matches =
        matchweeks[currentRound] ||
        [];

    matches.forEach(
        (match, idx) => {

            delete scoresStorage[
                `r${currentRound}_m${idx}_home`
            ];

            delete scoresStorage[
                `r${currentRound}_m${idx}_away`
            ];

        }
    );

    localStorage.setItem(
        'fpl_scores',
        JSON.stringify(
            scoresStorage
        )
    );

    let result = {
        ok: true
    };

    try {

        result =
            await clearRoundFromSupabase(
                currentRound
            );

    } catch (e) {

        result = {
            ok: false,
            error: e
        };
    }

    isSaving = false;

    document
        .getElementById(
            'saveRoundBtn'
        )
        .disabled = false;

    document
        .getElementById(
            'clearRoundBtn'
        )
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
            'Clear failed: ' +
            errMsg,
            false,
            20000
        );
    }
}


/* =========================================================
   UPDATE SCORE
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
   CALCULATE STANDINGS
========================================================= */

function calculateStandingsUpToRound(
    targetRound
) {

    const calculated = {};

    for (
        const teamKey in initialBasePoints
    ) {

        calculated[teamKey] = {
            key: teamKey,
            gf: 0,
            pts: 0
        };
    }

    for (
        let r = 1;
        r <= targetRound;
        r++
    ) {

        const roundMatches =
            matchweeks[r];

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

                    calculated[hKey].gf +=
                        hScore;

                    calculated[aKey].gf +=
                        aScore;

                    if (
                        hScore > aScore
                    ) {

                        calculated[hKey].pts +=
                            3;

                    } else if (
                        aScore > hScore
                    ) {

                        calculated[aKey].pts +=
                            3;

                    } else {

                        calculated[hKey].pts +=
                            1;

                        calculated[aKey].pts +=
                            1;
                    }
                }
            }
        );
    }

    return Object
        .values(calculated)
        .sort(
            (a, b) =>
                b.pts - a.pts ||
                b.gf - a.gf
        );
}


function calculateStandings() {

    return calculateStandingsUpToRound(
        currentRound
    );
}


/* =========================================================
   RENDER STANDINGS
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

    const sortedTeams =
        calculateStandings();

    const prevRanks = {};

    if (currentRound >= 2) {

        const prevSortedTeams =
            calculateStandingsUpToRound(
                currentRound - 1
            );

        prevSortedTeams.forEach(
            (team, idx) => {

                prevRanks[team.key] =
                    idx + 1;

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

            const position =
                index + 1;

            let rowClass = '';

            if (position === 1) {
                rowClass =
                    'green-line';
            } else if (
                position === 17
            ) {
                rowClass =
                    'red-line';
            }

            let indicatorHtml = '';

            if (
                currentRound >= 2 &&
                prevRanks[team.key] !==
                    undefined
            ) {

                const oldPos =
                    prevRanks[team.key];

                let imgSrc = '';

                if (
                    position < oldPos
                ) {

                    imgSrc =
                        './arrow_up_green.png';

                } else if (
                    position > oldPos
                ) {

                    imgSrc =
                        './arrow_down_red.png';

                } else {

                    imgSrc =
                        './equal_gray.png';
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


/* =========================================================
   RENDER FIXTURES
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
            matchweeks[currentRound] ||
            [];

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
                'renderFixtures: ' +
                e.message,
                '',
                0,
                0,
                e
            );
        }
    }
}


/* =========================================================
   CHANGE ROUND
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

    if (
        activeTab === 'standings'
    ) {
        renderStandings();
    }
}


/* =========================================================
   WAIT FOR IMAGES
========================================================= */

function waitForImagesToLoad(element) {

    const images =
        Array.from(
            element.querySelectorAll('img')
        );

    return Promise.all(
        images.map(img => {

            if (
                img.complete &&
                img.naturalWidth > 0
            ) {

                if (img.decode) {
                    return img
                        .decode()
                        .catch(() => {});
                }

                return Promise.resolve();
            }

            return new Promise(
                resolve => {

                    let finished = false;

                    const finish =
                        () => {

                            if (finished) {
                                return;
                            }

                            finished = true;

                            img.removeEventListener(
                                'load',
                                finish
                            );

                            img.removeEventListener(
                                'error',
                                finish
                            );

                            resolve();
                        };

                    img.addEventListener(
                        'load',
                        finish,
                        { once: true }
                    );

                    img.addEventListener(
                        'error',
                        finish,
                        { once: true }
                    );

                    setTimeout(
                        finish,
                        5000
                    );
                }
            );
        })
    );
}


/* =========================================================
   ROUNDED CORNERS
========================================================= */

function applyRoundedCorners(
    sourceCanvas,
    radius
) {

    const w =
        sourceCanvas.width;

    const h =
        sourceCanvas.height;

    const outputCanvas =
        document.createElement(
            'canvas'
        );

    outputCanvas.width = w;
    outputCanvas.height = h;

    const ctx =
        outputCanvas.getContext(
            '2d'
        );

    ctx.beginPath();

    ctx.moveTo(
        radius,
        0
    );

    ctx.lineTo(
        w - radius,
        0
    );

    ctx.quadraticCurveTo(
        w,
        0,
        w,
        radius
    );

    ctx.lineTo(
        w,
        h - radius
    );

    ctx.quadraticCurveTo(
        w,
        h,
        w - radius,
        h
    );

    ctx.lineTo(
        radius,
        h
    );

    ctx.quadraticCurveTo(
        0,
        h,
        0,
        h - radius
    );

    ctx.lineTo(
        0,
        radius
    );

    ctx.quadraticCurveTo(
        0,
        0,
        radius,
        0
    );

    ctx.closePath();

    ctx.clip();

    ctx.drawImage(
        sourceCanvas,
        0,
        0
    );

    return outputCanvas;
}


/* =========================================================
   DOWNLOAD AS IMAGE
========================================================= */

function downloadAsImage() {

    if (
        activeTab === 'fixtures'
    ) {
        renderFixtures();
    } else {
        renderStandings();
    }

    const targetId =
        activeTab === 'fixtures'
            ? 'captureFixtures'
            : 'captureStandings';

    const element =
        document.getElementById(
            targetId
        );

    if (!element) {
        return;
    }

    showToast(
        'Preparing image...',
        false
    );

    const scaleFactor = 4;

    const cornerRadius =
        20 * scaleFactor;

    waitForImagesToLoad(element)

        .then(() => {

            return html2canvas(
                element,
                {
                    backgroundColor: null,

                    scale:
                        scaleFactor,

                    useCORS: true,

                    allowTaint: true,

                    logging: false,

                    width:
                        element.offsetWidth,

                    height:
                        element.offsetHeight,

                    windowWidth:
                        element.scrollWidth,

                    windowHeight:
                        element.scrollHeight,

                    imageTimeout: 0,

                    onclone:
                        function(
                            clonedDoc,
                            clonedElement
                        ) {

                            const wrappers =
                                clonedElement
                                    .querySelectorAll(
                                        '.logo-20, .logo-24'
                                    );

                            wrappers.forEach(
                                wrapper => {

                                    const isSmall =
                                        wrapper.classList
                                            .contains(
                                                'logo-20'
                                            );

                                    const size =
                                        isSmall
                                            ? '20px'
                                            : '22px';

                                    wrapper.style.width =
                                        size;

                                    wrapper.style.height =
                                        size;

                                    wrapper.style.minWidth =
                                        size;

                                    wrapper.style.minHeight =
                                        size;

                                    wrapper.style.maxWidth =
                                        size;

                                    wrapper.style.maxHeight =
                                        size;

                                    wrapper.style.overflow =
                                        'hidden';

                                    wrapper.style.position =
                                        'relative';

                                    wrapper.style.display =
                                        'inline-block';
                                }
                            );

                            const logos =
                                clonedElement
                                    .querySelectorAll(
                                        '.logo-20 img, .logo-24 img'
                                    );

                            logos.forEach(
                                img => {

                                    img.style.position =
                                        'absolute';

                                    img.style.top =
                                        '50%';

                                    img.style.left =
                                        '50%';

                                    img.style.transform =
                                        'translate(-50%, -50%)';

                                    img.style.width =
                                        'auto';

                                    img.style.height =
                                        'auto';

                                    img.style.maxWidth =
                                        '100%';

                                    img.style.maxHeight =
                                        '100%';

                                    img.style.objectFit =
                                        'contain';

                                    img.style.display =
                                        'block';
                                }
                            );

                            const indicators =
                                clonedElement
                                    .querySelectorAll(
                                        '.pos-indicator-img'
                                    );

                            indicators.forEach(
                                img => {

                                    const size =
                                        '25px';

                                    img.style.width =
                                        size;

                                    img.style.height =
                                        size;

                                    img.style.minWidth =
                                        size;

                                    img.style.minHeight =
                                        size;

                                    img.style.maxWidth =
                                        size;

                                    img.style.maxHeight =
                                        size;

                                    img.style.objectFit =
                                        'contain';
                                }
                            );
                        }
                }
            );
        })

        .then(canvas => {

            const roundedCanvas =
                applyRoundedCorners(
                    canvas,
                    cornerRadius
                );

            roundedCanvas.toBlob(
                function(blob) {

                    if (!blob) {

                        showToast(
                            'Failed to create image!',
                            false
                        );

                        return;
                    }

                    const filename =
                        activeTab === 'fixtures'

                            ? `Matchweek_${currentRound}.png`

                            : `League_Standings_GW${currentRound}.png`;

                    if (
                        navigator.share &&
                        navigator.canShare
                    ) {

                        const file =
                            new File(
                                [blob],
                                filename,
                                {
                                    type:
                                        'image/png'
                                }
                            );

                        const shareData = {
                            files: [file],

                            title:
                                activeTab ===
                                'fixtures'

                                    ? `Matchweek ${currentRound}`

                                    : `League Standings GW ${currentRound}`
                        };

                        if (
                            navigator.canShare(
                                shareData
                            )
                        ) {

                            navigator
                                .share(
                                    shareData
                                )

                                .then(() => {

                                    showToast(
                                        'Image saved successfully ✓',
                                        true
                                    );

                                })

                                .catch(err => {

                                    if (
                                        err.name !==
                                        'AbortError'
                                    ) {

                                        fallbackDownload(
                                            blob
                                        );

                                    } else {

                                        showToast(
                                            'Cancelled',
                                            false
                                        );
                                    }
                                });

                        } else {

                            fallbackDownload(
                                blob
                            );
                        }

                    } else {

                        fallbackDownload(
                            blob
                        );
                    }

                },
                'image/png',
                1.0
            );

        })

        .catch(err => {

            console.error(
                'html2canvas error:',
                err
            );

            showToast(
                'Error generating image!',
                false
            );
        });
}


/* =========================================================
   FALLBACK DOWNLOAD
========================================================= */

function fallbackDownload(blob) {

    const link =
        document.createElement(
            'a'
        );

    link.download =
        activeTab === 'fixtures'

            ? `Matchweek_${currentRound}.png`

            : `League_Standings_GW${currentRound}.png`;

    link.href =
        URL.createObjectURL(
            blob
        );

    document.body.appendChild(
        link
    );

    link.click();

    document.body.removeChild(
        link
    );

    setTimeout(() => {

        URL.revokeObjectURL(
            link.href
        );

        showToast(
            'Image downloaded ✓',
            true
        );

    }, 100);
}


/* =========================================================
   LOCAL STORAGE BACKUP
========================================================= */

setInterval(() => {

    if (
        Object.keys(
            scoresStorage
        ).length > 0
    ) {

        localStorage.setItem(
            'fpl_scores',
            JSON.stringify(
                scoresStorage
            )
        );
    }

}, 5000);


/* =========================================================
   ERUDA DEBUG CONSOLE
   5 CLICKS ON MATCHWEEK
========================================================= */

function setupEruda() {

    let clickCount = 0;
    let clickTimer = null;

    const titleEl =
        document.getElementById(
            'currentRoundTitle'
        );

    if (!titleEl) {
        return;
    }

    titleEl.addEventListener(
        'click',
        function() {

            clickCount++;

            clearTimeout(
                clickTimer
            );

            if (clickCount >= 5) {

                clickCount = 0;

                if (
                    typeof eruda !==
                        'undefined' &&
                    eruda.init
                ) {

                    try {

                        eruda.init();
                        eruda.show();

                    } catch (e) {}
                }
            }

            clickTimer =
                setTimeout(
                    () => {
                        clickCount = 0;
                    },
                    2000
                );
        }
    );
}


/* =========================================================
   INITIALIZE
========================================================= */

async function init() {

    /* Carousel */

    buildCarousel();

    setupCarouselTouch();

    startCarousel();


    /* Round selector */

    initRoundDropdown();


    /* Initial UI */

    renderFixtures();

    renderStandings();

    setupEruda();


    /* =====================================================
       SUPABASE CONNECTION TEST
    ===================================================== */

    if (
        !window.sbClient ||
        typeof loadScoresFromSupabase !==
            'function'
    ) {

        console.warn(
            'Supabase client is not available.'
        );

        return;
    }

    try {

        const {
            error: testError
        } =
            await window.sbClient
                .from('match_results')
                .select('id')
                .limit(1);

        if (testError) {

            console.warn(
                'DB Connection Error:',
                testError.message
            );

            return;
        }

    } catch (connErr) {

        console.warn(
            'Network Error:',
            connErr.message
        );

        return;
    }


    /* =====================================================
       LOAD RESULTS FROM SUPABASE
    ===================================================== */

    try {

        const remoteScores =
            await loadScoresFromSupabase(
                matchweeks
            );

        if (
            remoteScores &&
            Object.keys(
                remoteScores
            ).length > 0
        ) {

            scoresStorage =
                remoteScores;

            localStorage.setItem(
                'fpl_scores',
                JSON.stringify(
                    scoresStorage
                )
            );

            renderFixtures();

            renderStandings();
        }

    } catch (e) {

        console.warn(
            'Load from Supabase failed:',
            e.message
        );
    }
}


/* =========================================================
   START APPLICATION
========================================================= */

init();
