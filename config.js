/* =========================================================
   config.js
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

let editMode = false;

let scoresStorage =
    JSON.parse(
        localStorage.getItem('fpl_scores')
    ) || {};

/* آخر جولة — نجيبها من localStorage أو نبدأ بـ 1 */
let currentRound = parseInt(
    localStorage.getItem('fpl_last_round') || '1',
    10
);

if (isNaN(currentRound) || currentRound < 1 || currentRound > 38) {
    currentRound = 1;
}

let activeTab = 'fixtures';

let isSaving = false;

let toastTimeout = null;
