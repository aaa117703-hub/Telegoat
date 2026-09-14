/* =========================================================
   config.js
   الإعدادات العامة + Supabase Client + المتغيرات العامة
========================================================= */


/* =========================================================
   SUPABASE CONFIG
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
   GLOBAL STATE
   المتغيرات العامة للتطبيق
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
