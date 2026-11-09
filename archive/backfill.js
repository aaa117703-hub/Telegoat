// ============================================================
// backfill.js — Backfill weekly_ranks for Trends
// شغّله مرة واحدة فقط لملء الجولات السابقة (1 → 5)
// ============================================================

(function () {

  const WORKER = 'https://fpl-api.aaa117703.workers.dev';
  const SUPABASE_URL = 'https://qzsteswrannqsrnlytzl.supabase.co';

  function getSupabase() {
    return window.supabaseClient
        || window.sb
        || window.db
        || window._supabase
        || null;
  }

  function getKey() {
    return window.SUPABASE_ANON_KEY
        || window.SUPABASE_KEY
        || window.ANON_KEY
        || window.SUPABASE_ANON
        || null;
  }

  async function backfill(onLog) {
    const log = (msg) => {
      console.log('[BACKFILL]', msg);
      if (typeof onLog === 'function') onLog(msg);
    };

    log('بدء Backfill...');

    let sb = getSupabase();
    if (!sb) {
      const key = getKey();
      if (window.supabase && window.supabase.createClient && key) {
        sb = window.supabase.createClient(SUPABASE_URL, key);
        log('تم إنشاء Supabase client');
      } else {
        log('خطأ: لا يوجد Supabase client ولا key');
        return { ok: false, error: 'no_supabase' };
      }
    }

    // 1) جمع المديرين من 7 صفحات
    log('جلب المديرين...');
    const managers = [];
    for (let p = 1; p <= 7; p++) {
      try {
        const r = await fetch(WORKER + '?type=league&page=' + p);
        const j = await r.json();
        const res = (j && j.standings && j.standings.results) || [];
        managers.push(...res);
        log('صفحة ' + p + ': ' + res.length);
      } catch (e) {
        log('خطأ صفحة ' + p + ': ' + e.message);
      }
    }
    log('إجمالي: ' + managers.length + ' مدير');
    if (managers.length === 0) return { ok: false, error: 'no_managers' };

    // 2) جلب تاريخ كل مدير (دفعات 10)
    log('جلب التاريخ...');
    const hist = {};
    const BATCH = 10;
    for (let i = 0; i < managers.length; i += BATCH) {
      const batch = managers.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (m) => {
          const r = await fetch(WORKER + '?type=entry&entry=' + m.entry);
          const j = await r.json();
          return {
            entry_id: Number(m.entry),
            player_name: m.player_name || '',
            entry_name: m.entry_name || '',
            current: (j && j.current) ? j.current : []
          };
        })
      );
      settled.forEach((s) => {
        if (s.status === 'fulfilled' && s.value.current.length > 0) {
          hist[s.value.entry_id] = s.value;
        }
      });
      log('تم ' + Math.min(i + BATCH, managers.length) + ' / ' + managers.length);
    }

    const ids = Object.keys(hist);
    log('عندهم تاريخ: ' + ids.length);
    if (ids.length === 0) return { ok: false, error: 'no_history' };

    // 3) بناء الصفوف لكل جولة
    const byRound = {};
    ids.forEach((id) => {
      const info = hist[id];
      info.current.forEach((gw) => {
        const round = gw.event;
        if (!round) return;
        if (!byRound[round]) byRound[round] = [];
        byRound[round].push({
          round: round,
          entry_id: Number(id),
          player_name: info.player_name,
          entry_name: info.entry_name,
          total: gw.total_points || 0,
          event_total: gw.points || 0
        });
      });
    });

    const roundsCount = Object.keys(byRound).length;
    log('عدد الجولات: ' + roundsCount);

    // 4) ترتيب داخل كل جولة
    const rows = [];
    Object.keys(byRound).forEach((r) => {
      const arr = byRound[r];
      arr.sort((a, b) => b.total - a.total);
      arr.forEach((row, i) => {
        row.rank = i + 1;
        rows.push(row);
      });
    });
    log('إجمالي الصفوف: ' + rows.length);

    // 5) Upsert في دفعات 50
    log('حفظ في Supabase...');
    let saved = 0, failed = 0;
    const UP = 50;
    for (let i = 0; i < rows.length; i += UP) {
      const chunk = rows.slice(i, i + UP);
      const { error } = await sb
        .from('weekly_ranks')
        .upsert(chunk, { onConflict: 'round,entry_id' });
      if (error) {
        log('خطأ: ' + error.message);
        failed += chunk.length;
      } else {
        saved += chunk.length;
      }
    }
    log('انتهى: ' + saved + ' حفظ، ' + failed + ' فشل');
    return { ok: true, saved, failed, rounds: roundsCount, managers: ids.length };
  }

  window.backfill = backfill;
  window.runBackfill = async function () {
    console.log('%c=== BACKFILL ===', 'color:#00c853;font-weight:bold;font-size:16px');
    const t0 = Date.now();
    const r = await backfill();
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('%cانتهى في ' + sec + ' ثانية', 'color:#00e676;font-weight:bold');
    console.log('النتيجة:', r);
    return r;
  };

  console.log('%c[backfill.js] جاهز. اكتب runBackfill()', 'color:#00c853');

})();
