/* =========================================================
   cup-adapter.js — طبقة توافق لكأس Telegoat (منقول من Finalissima)
   يوفّر ما يحتاجه كود الكأس: المديرين لكل نادي، المواعيد، القمصان
========================================================= */
(function () {
    'use strict';

    var API = 'https://fpl-api.aaa117703.workers.dev';
    var ADMIN_ID = 2984723;
    var CACHE_KEY = 'tg_cup_managers_v1';
    var CACHE_TTL = 2 * 60 * 60 * 1000;

    /* ليغ كل نادي (نفس أرقام الكأس القديم) */
    var CLUB_LEAGUES = {
        'ARS': 369450, 'AVL': 369537, 'BOU': 369291, 'BRE': 369578,
        'BHA': 369606, 'CHE': 369638, 'COV': 369673, 'CRY': 369721,
        'EVE': 369745, 'FUL': 369770, 'HUL': 369795, 'IPS': 369827,
        'LEE': 369850, 'LIV': 370310, 'MCI': 369942, 'MUN': 369961,
        'NEW': 369987, 'NOT': 370008, 'SUN': 370048, 'TOT': 370074
    };
    window.TG_CLUB_LEAGUES = CLUB_LEAGUES;

    /* ---------- القمصان: اسم/كود → ملف ---------- */
    (function buildShirts() {
        var map = {};
        var src = (typeof TEAMS_SHIRTS !== 'undefined') ? TEAMS_SHIRTS : {};
        var alias = {
            "Nott'm Forest": 'Nottingham Forest', 'Coventry': 'Coventry City', 'Hull': 'Hull City',
            'Ipswich': 'Ipswich Town', 'Leeds': 'Leeds United', 'Tottenham': 'Spurs'
        };
        function fileOf(name) {
            var e = src[name] || src[alias[name]];
            return e ? (typeof e === 'string' ? e : e.file) : null;
        }
        Object.keys(src).forEach(function (n) { map[n] = fileOf(n); });
        if (typeof teamsMap !== 'undefined') {
            Object.keys(teamsMap).forEach(function (code) {
                var n = teamsMap[code].name, f = fileOf(n);
                if (f) { map[n] = f; map[code] = f; }
            });
        }
        window.TG_SHIRTS = map;
    })();

    /* ---------- المديرين ---------- */
    var _cache = null, _loading = null;

    async function fetchLeague(code, id) {
        for (var t = 0; t < 3; t++) {
            try {
                var res = await fetch(API + '/?type=league&id=' + id);
                if (res.ok) {
                    var j = await res.json();
                    var d = (j && j.data && !Array.isArray(j.data) && j.data.standings) ? j.data : j;
                    var results = (d && d.standings && d.standings.results) || [];
                    return results;
                }
            } catch (e) {}
            await new Promise(function (r) { setTimeout(r, 600 * (t + 1)); });
        }
        return null;
    }

    async function loadAll() {
        var codes = Object.keys(CLUB_LEAGUES), seen = {}, all = [], failed = [];
        var idx = 0;
        async function worker() {
            while (idx < codes.length) {
                var code = codes[idx++];
                var rows = await fetchLeague(code, CLUB_LEAGUES[code]);
                if (!rows) { failed.push(code); continue; }
                rows.forEach(function (m) {
                    if (m.entry === ADMIN_ID || seen[m.entry]) return;
                    seen[m.entry] = true;
                    var club = (typeof teamsMap !== 'undefined' && teamsMap[code]) ? teamsMap[code].name : code;
                    all.push({
                        entry: m.entry, player_name: m.player_name, entry_name: m.entry_name,
                        total: m.total, event_total: m.event_total, rank: m.rank,
                        nation: code, _nationCode: code, _team: club
                    });
                });
            }
        }
        await Promise.all([worker(), worker(), worker(), worker()]);
        if (failed.length) console.warn('[CupAdapter] leagues failed:', failed.join(','));
        return { list: all, failed: failed };
    }

    window.tgcGetAllManagers = async function (force) {
        if (!force && _cache && _cache.length) return _cache;
        if (!force) {
            try {
                var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
                if (c && Array.isArray(c.data) && c.data.length && (Date.now() - c.ts) < CACHE_TTL) { _cache = c.data; return _cache; }
            } catch (e) {}
        }
        if (_loading) return _loading;
        _loading = (async function () {
            var r = await loadAll();
            _loading = null;
            if (r.list.length) {
                _cache = r.list;
                if (!r.failed.length) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: r.list })); } catch (e) {} }
            }
            return _cache || r.list;
        })();
        return _loading;
    };
    window.tgcClearManagers = function () { _cache = null; try { localStorage.removeItem(CACHE_KEY); } catch (e) {} };
    window.tgcGetManagersForRound = function () { return window.tgcGetAllManagers(); };

    /* ---------- المواعيد (bootstrap) ---------- */
    var _bs = null, _bsAt = 0;
    async function bootstrap() {
        if (_bs && Date.now() - _bsAt < 5 * 60 * 1000) return _bs;
        try {
            if (typeof window.fplDbGetData === 'function') {
                var c = window.fplDbGetData();
                if (c && c.events) { _bs = c; _bsAt = Date.now(); return c; }
            }
        } catch (e) {}
        try {
            var res = await fetch(API + '/?type=bootstrap');
            if (res.ok) {
                var j = await res.json();
                var d = (j && j.data && !Array.isArray(j.data)) ? j.data : j;
                if (d && d.events) { _bs = d; _bsAt = Date.now(); return d; }
            }
        } catch (e) {}
        return _bs;
    }
    window.fetchBootstrapForCountdown = bootstrap;
    if (typeof window.getDeadlineForRound !== 'function') {
        window.getDeadlineForRound = async function (roundNum) {
            var b = await bootstrap();
            if (!b || !b.events) return null;
            var ev = b.events.find(function (e) { return e.id === roundNum; });
            if (!ev || !ev.deadline_time) return null;
            return {
                deadlineTime: ev.deadline_time, deadlineMs: new Date(ev.deadline_time).getTime(),
                roundNumber: roundNum, name: ev.name || ('GW' + roundNum), finished: ev.finished === true
            };
        };
    }
})();
