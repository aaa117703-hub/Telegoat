/* =========================================================
   players-teams.js — بيانات اللاعبين والقمصان ومطابقة الأسماء
========================================================= */

// تنظيف وتجريف الاسم من الإيموجيات والأعلام لضمان المطابقة
function normalizePlayerName(name) {
    if (!name) return '';
    return name
        // إزالة الإيموجيات والأعلام
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
        .trim()
        .toLowerCase();
}

// قائمة القمصان الافتراضية للفرق
const TEAMS_SHIRTS = {
    "arsenal": "arsenal-shirt.png",
    "aston villa": "aston-villa-shirt.png",
    "bournemouth": "bournemouth-shirt.png",
    "brentford": "brentford-shirt.png",
    "brighton": "brighton-shirt.png",
    "chelsea": "chelsea-shirt.png",
    "crystal palace": "crystal-palace-shirt.png",
    "everton": "everton-shirt.png",
    "fulham": "fulham-shirt.png",
    "ipswich": "ipswich-shirt.png",
    "leicester": "leicester-shirt.png",
    "liverpool": "liverpool-shirt.png",
    "man city": "man-city-shirt.png",
    "man utd": "man-utd-shirt.png",
    "newcastle": "newcastle-shirt.png",
    "nott'm forest": "nottm-forest-shirt.png",
    "southampton": "southampton-shirt.png",
    "spurs": "tottenham-shirt.png",
    "tottenham": "tottenham-shirt.png",
    "west ham": "west-ham-shirt.png",
    "wolves": "wolves-shirt.png"
};

// جلب صورة القميص بناءً على اسم الفريق أو اسم اللاعب
function getShirtUrl(teamName) {
    if (!teamName) return './default-shirt.png';
    const cleanTeam = teamName.toLowerCase().trim();
    return TEAMS_SHIRTS[cleanTeam] ? `./${TEAMS_SHIRTS[cleanTeam]}` : './default-shirt.png';
}
