/* =========================================================
   teams.js
========================================================= */

const teamsMap = {

    "ARS": { name: "Arsenal", logo: "arsenal.png.WEBP" },
    "AVL": { name: "Aston Villa", logo: "aston_villa.png.WEBP" },
    "BOU": { name: "Bournemouth", logo: "bournemouth.png.WEBP" },
    "BRE": { name: "Brentford", logo: "brentford.png.PNG" },
    "BHA": { name: "Brighton", logo: "brighton.png.WEBP" },
    "CHE": { name: "Chelsea", logo: "chelsea.png.WEBP" },
    "COV": { name: "Coventry", logo: "coventry.png.WEBP" },
    "CRY": { name: "Crystal Palace", logo: "crystal_palace.png.WEBP" },
    "EVE": { name: "Everton", logo: "everton.png.WEBP" },
    "FUL": { name: "Fulham", logo: "fulham.png.WEBP" },
    "HUL": { name: "Hull", logo: "hull.png.WEBP" },
    "IPS": { name: "Ipswich", logo: "ipswich.png.WEBP" },
    "LEE": { name: "Leeds", logo: "leeds.png.WEBP" },
    "LIV": { name: "Liverpool", logo: "liverpool.png.WEBP" },
    "MCI": { name: "Man City", logo: "man_city.png.WEBP" },
    "MUN": { name: "Man Utd", logo: "man_utd.png.WEBP" },
    "NEW": { name: "Newcastle", logo: "newcastle.png.WEBP" },
    "NOT": { name: "Nott'm Forest", logo: "forest.png.PNG" },
    "SUN": { name: "Sunderland", logo: "sunderland.png.WEBP" },
    "TOT": { name: "Spurs", logo: "tottenham.png.WEBP" }

};


/* =========================================================
   INITIAL BASE POINTS
========================================================= */

const initialBasePoints = {};

Object.keys(teamsMap).forEach(function(key) {
    initialBasePoints[key] = {
        gf: 0,
        pts: 0
    };
});
