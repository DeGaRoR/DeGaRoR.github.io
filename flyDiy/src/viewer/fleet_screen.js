// FLEET_SCREEN — the full-screen fleet (FLEET, the user 12-13 Nov 2026).
//
// "Load aircraft" should be FULL SCREEN, not pop-up menus on top of the main UI. Every aircraft is a TILE with a little
// picture, a LOAD button and a FICHE button. The list can be ORDERED and FILTERED ... even the phone should show tiles
// and have a full-screen picker where you can check the fiche. (The design page, 13 Nov: the user took every default.)
//
// TWO TABS: YOUR HANGAR (the saved builds - a career's own airframes - garage.js GARAGE_SPEC.fleet()) and ALL PLANES
// (the plane list's player classes, builds/lists/plane_lists.json through GARAGE_SPEC.planeLists, and the candidate
// pool). It replaces the LOAD popup (#gFleet) and the New-aeroplane screen's "all planes" page.
// THE CONTRACT:
//   1 CHOOSING COSTS NOTHING. The screen is opaque and holds the garage's render loop (FLYDIY_UI_HOLD, as NEW_PLANE
//     does) for as long as it is up; a click selects, sorts or filters this screen's own DOM. Nothing is built or loaded
//     before Load.
//   2 ONE SOURCE EACH. Names, classes and registrations are the list's; pictures PLANE_THUMB's; the fiche FICHE_BOARD's
//     (AIRCRAFT-LOOKS': the board opens over this screen, never a second copy here); the hangar's rows and their verbs
//     garage.js's. This file declares no plane and no number.
//   3 NO BROWSER POP-UPS. "Fly from there?", Sell, Delete and Buy in ask on the tile itself, one line, Cancel or Yes.
//   4 A LOAD IS ONE PRESS, BEHIND A SPINNER (the user's rule: spinner + yield, never a freeze), then the screen closes.
// The desktop peek (the right column) shows the selected plane's hero on the fiche's cream sheet and its numbers from
// its baked fiche; the phone has no peek - its tile's Fiche opens the board. Filters and sort are remembered per tab on
// this device (flydiy.fleet.ui). GATE FLEET checks the screen and its doors (tools/_fleet_check.js).
'use strict';
(function () {
  const W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  const GS = () => W.GARAGE_SPEC || null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const PREF = 'flydiy.fleet.ui';
  // the list's classes, in the list's order; the last three reach the developer only (GARAGE_SPEC.planeLists filters)
  const CLASSES = [['reproduction', 'Reproductions'], ['story', 'Story'], ['original', 'Originals'], ['wip', 'Work in progress'],
    ['cand', 'Candidates'], ['next', 'Next versions'], ['legacy', 'Test planes'], ['archive', 'Archive']];
  const CLASS_WORD = { reproduction: 'Reproduction', story: 'Story', original: 'Original', wip: 'Work in progress', cand: 'Candidate',
    next: 'Next version', legacy: 'Test plane', archive: 'Archived' };
  const CERT = [['certified', 'Certified', 'ok'], ['changed', 'Changed since cert', 'warn'], ['tested', 'Tested', ''],
    ['none', 'No certificate', ''], ['grounded', 'Broken, grounded', 'bad']];
  const CERT_OF = {}; for (const c of CERT) CERT_OF[c[0]] = c;
  const SORTS = {
    mine: [['flown', 'Last flown'], ['name', 'Name'], ['place', 'Where it stands'], ['state', 'Certificate'], ['price', 'Price']],
    all: [['class', 'By class'], ['name', 'Name'], ['number', 'List number']],
  };
  const LOG = { opened: 0, renders: 0, loads: 0, asked: 0 };

  let el = null, tab = 'mine', sel = { mine: null, all: null }, busy = false, sheet = false;
  let ask = null;            // { k, text, yes, go } - the one tile asking a question
  let menu = null;           // the key of the tile whose ⋯ is open
  let model = null;          // GARAGE_SPEC.fleet(), read on open and on refresh
  let lists = null, cands = null, listsAsked = false;
  let fiches = null, ficheAsked = false, mineFiches = null;

  // ---- what is remembered (per device; a missing or blocked store is today's defaults) ----------------------------
  const ui = (() => {
    const d = { tab: 'mine', view: 'tiles', mine: { sort: 'flown', q: '', off: [] }, all: { sort: 'class', q: '', off: [], fiche: false } };
    try { const j = JSON.parse(W.localStorage.getItem(PREF) || 'null'); if (j && typeof j === 'object') {
      if (j.view === 'list' || j.view === 'tiles') d.view = j.view;
      if (j.tab === 'all' || j.tab === 'mine') d.tab = j.tab;
      for (const t of ['mine', 'all']) if (j[t]) {
        if (SORTS[t].some(s => s[0] === j[t].sort)) d[t].sort = j[t].sort;
        if (Array.isArray(j[t].off)) d[t].off = j[t].off.filter(x => typeof x === 'string');
        if (t === 'all') d.all.fiche = !!j.all.fiche;
      }
    } } catch (e) {}
    return d;
  })();
  const keep = () => { try { W.localStorage.setItem(PREF, JSON.stringify({ tab: ui.tab, view: ui.view,
    mine: { sort: ui.mine.sort, off: ui.mine.off }, all: { sort: ui.all.sort, off: ui.all.off, fiche: ui.all.fiche } })); } catch (e) {} };
  const phone = () => { try { return document.documentElement.classList.contains('phone') || (W.matchMedia && W.matchMedia('(max-width: 700px)').matches); } catch (e) { return false; } };

  // ---- the data, as tiles ----------------------------------------------------------------------------------------
  function readModel() {
    try { model = GS() && GS().fleet ? GS().fleet() : null; } catch (e) { model = null; }
    if (!model) model = { rows: [], bring: [], stand: '', storage: false };
    return model;
  }
  function askLists() {
    if (listsAsked) return; listsAsked = true;
    const g = GS(); if (!g) return;
    const redraw = () => { if (isOpen()) render(); };
    if (g.planeLists) g.planeLists().then(l => { lists = l || []; redraw(); }, () => { lists = []; redraw(); });
    else lists = [];
    if (g.candidates) g.candidates().then(l => { cands = l || []; redraw(); }, () => { cands = []; redraw(); });
    else cands = [];
  }
  // the fiches: the official planes' baked index (media/fiches/index.json, keyed by the list's picture key or list:N;
  // a newer bake also names its row: listRow) and the player's own (PLANE_FICHE.names)
  function askFiches() {
    if (ficheAsked) return; ficheAsked = true;
    if (typeof fetch === 'function') fetch('media/fiches/index.json').then(r => (r.ok ? r.json() : null)).then(j => { fiches = (j && j.fiches) || {}; if (isOpen()) render(); }, () => { fiches = {}; });
    try { if (W.PLANE_FICHE && W.PLANE_FICHE.names) W.PLANE_FICHE.names().then(a => { mineFiches = new Set(a || []); if (isOpen()) render(); }, () => {}); } catch (e) {}
  }
  const listKey = p => p.thumb || 'list:' + p.n;
  function bakedOf(key, n) {
    if (!fiches) return null;
    if (fiches[key]) return { key, rec: fiches[key] };
    if (n != null) for (const k in fiches) if (fiches[k] && fiches[k].listRow === n) return { key: k, rec: fiches[k] };
    return null;
  }
  function tilesMine() {
    const m = model || readModel(), out = [];
    for (const r of m.rows) out.push({ k: 'mine:' + r.slot, kind: 'mine', r, name: r.name, reg: r.reg, thumb: r.thumb,
      state: r.cert, fiche: mineFiches && mineFiches.has(r.slot) ? r.slot : null });
    for (const b of m.bring) out.push({ k: 'bring:' + b.slot, kind: 'bring', r: b, name: b.name, reg: '', thumb: b.thumb, state: null, fiche: null });
    return out;
  }
  function tilesAll() {
    const out = [];
    for (const p of lists || []) {
      const fk = bakedOf(listKey(p), p.n);
      // CHOOSER-ALIKES (FLAGSHIP): a SHAPE row (a design card, no file) the build cannot make here says why, greyed (NEW_PLANE.shapeWhy:
      // null = it builds; its Load goes through openListed -> NEW_PLANE.openShape like any row)
      let why = null; try { why = p.shape && W.NEW_PLANE && W.NEW_PLANE.shapeWhy ? W.NEW_PLANE.shapeWhy(p.shape) : null; } catch (e) { why = null; }
      out.push({ k: 'list:' + p.n, kind: 'list', p, n: p.n, name: p.name, reg: p.reg || '', thumb: p.thumb || null, cls: p.list,
        fiche: fk ? fk.key : null, baked: fk ? fk.rec : null, why: why || null });
    }
    for (const c of cands || []) {
      const key = 'cand:' + c.file, fk = bakedOf(key, null);
      out.push({ k: key, kind: 'cand', c, name: c.name || c.file, reg: '', thumb: key, cls: 'cand', note: c.note || '',
        fiche: fk ? fk.key : null, baked: fk ? fk.rec : null });
    }
    return out;
  }
  const matchQ = (t, q) => !q || (t.name + ' ' + (t.reg || '') + ' ' + (t.r && t.r.slot || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0;
  const facetOf = t => (tab === 'mine' ? (t.kind === 'bring' ? 'bring' : t.state) : t.cls);
  function shown() {
    const all = tab === 'mine' ? tilesMine() : tilesAll(), U = ui[tab];
    return all.filter(t => matchQ(t, U.q) && U.off.indexOf(facetOf(t)) < 0 && (tab !== 'all' || !U.fiche || t.fiche));
  }
  const clsIdx = c => { const i = CLASSES.findIndex(x => x[0] === c); return i < 0 ? 99 : i; };
  const certIdx = c => { const i = CERT.findIndex(x => x[0] === c); return i < 0 ? 99 : i; };
  const byName = (a, b) => a.name.localeCompare(b.name);
  function sorted(ts) {
    const s = ui[tab].sort, a = ts.slice();
    if (tab === 'mine') {
      // the bought-in shelf stays last whatever the sort
      const k = t => (t.kind === 'bring' ? 1 : 0);
      if (s === 'flown') a.sort((x, y) => k(x) - k(y) || String(y.r.flown || '').localeCompare(String(x.r.flown || '')) || byName(x, y));
      else if (s === 'place') a.sort((x, y) => k(x) - k(y) || (x.r.away === y.r.away ? 0 : x.r.away ? 1 : -1) ||
        String(x.r.place ? x.r.place.text : '').localeCompare(String(y.r.place ? y.r.place.text : '')) || byName(x, y));
      else if (s === 'state') a.sort((x, y) => k(x) - k(y) || certIdx(x.state) - certIdx(y.state) || byName(x, y));
      else if (s === 'price') a.sort((x, y) => k(x) - k(y) || ((y.r.sale ? y.r.sale.value : -1) - (x.r.sale ? x.r.sale.value : -1)) || byName(x, y));
      else a.sort((x, y) => k(x) - k(y) || byName(x, y));
    } else {
      if (s === 'name') a.sort(byName);
      else if (s === 'number') a.sort((x, y) => (x.n == null ? 1e9 : x.n) - (y.n == null ? 1e9 : y.n) || byName(x, y));
      else a.sort((x, y) => clsIdx(x.cls) - clsIdx(y.cls) || (x.n == null ? 1e9 : x.n) - (y.n == null ? 1e9 : y.n) || byName(x, y));
    }
    return a;
  }
  // the headings the sort draws: All planes by class -> one per class; Your hangar -> the bought-in shelf apart
  function headOf(t) {
    if (tab === 'mine') return t.kind === 'bring' ? 'From the sandbox: buy into this career' : 'Your aeroplanes';
    if (ui.all.sort !== 'class') return '';
    const c = CLASSES.find(x => x[0] === t.cls);
    return c ? (t.cls === 'cand' ? 'Candidates: built here, not yet certified' : c[1]) : '';
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------
  function build() {
    el = document.createElement('div');
    el.id = 'flWrap';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Fleet');
    el.innerHTML =
      '<div class="flBar">' +
        '<span class="flTitle">FLEET</span>' +
        '<div class="flSeg" role="tablist"><button type="button" role="tab" data-tab="mine">Your hangar<b></b></button>' +
          '<button type="button" role="tab" data-tab="all">All planes<b></b></button></div>' +
        '<input class="flSearch" type="search" placeholder="Search name or registration" aria-label="Search the fleet">' +
        '<span class="flSp"></span>' +
        '<label class="flSortL"><span>Sort</span><select class="flSort" aria-label="Sort"></select></label>' +
        '<button type="button" class="flBtn flView" title="Tiles or list"></button>' +
        '<button type="button" class="flBtn flFilt">Filters</button>' +
        '<button type="button" class="flBtn flClose">Close</button>' +
      '</div>' +
      '<div class="flSub"></div>' +
      '<div class="flMain"><div class="flRail"></div><div class="flGridW"><div class="flGrid"></div></div><div class="flPeek"></div></div>' +
      '<div class="flSheet" hidden><div class="flSheetBox"><div class="flSheetBody"></div>' +
        '<div class="flSheetFoot"><button type="button" class="flBtn flClear">Clear</button><button type="button" class="flBtn flPri flShow">Show</button></div></div></div>' +
      '<div class="flSpin" hidden><div class="flSpinBox"><i></i><span>loading the aeroplane…</span></div></div>';
    el.querySelector('.flClose').addEventListener('click', close);
    for (const b of el.querySelectorAll('.flSeg button')) b.addEventListener('click', () => setTab(b.dataset.tab));
    const q = el.querySelector('.flSearch');
    q.addEventListener('input', () => { ui[tab].q = q.value; render(); });
    el.querySelector('.flSort').addEventListener('change', e => { ui[tab].sort = e.target.value; keep(); render(); });
    el.querySelector('.flView').addEventListener('click', () => { ui.view = ui.view === 'list' ? 'tiles' : 'list'; keep(); render(); });
    el.querySelector('.flFilt').addEventListener('click', () => { sheet = true; render(); });
    el.querySelector('.flShow').addEventListener('click', () => { sheet = false; render(); });
    el.querySelector('.flClear').addEventListener('click', () => { ui[tab].off = []; if (tab === 'all') ui.all.fiche = false; keep(); render(); });
    el.querySelector('.flSheet').addEventListener('click', e => { if (e.target.classList && e.target.classList.contains('flSheet')) { sheet = false; render(); } });
    // the grid's clicks, delegated: one listener, whatever the redraws
    el.querySelector('.flGrid').addEventListener('click', onGrid);
    el.querySelector('.flGrid').addEventListener('dblclick', e => { const t = tileOf(e.target); if (t && !e.target.closest('button')) primary(t); });
    el.querySelector('.flPeek').addEventListener('click', onGrid);
    el.querySelector('.flRail').addEventListener('click', onFacet);
    el.querySelector('.flSheetBody').addEventListener('click', onFacet);
    // Escape closes (a question first, then the sheet, then the screen); nothing behind it takes keys while it is up
    W.addEventListener('keydown', e => {
      if (!isOpen() || busy) return;
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (ask || menu) { ask = null; menu = null; render(); } else if (sheet) { sheet = false; render(); } else close(); }
    }, true);
    W.addEventListener('plane-thumb', () => { if (isOpen()) soon(); });
    W.addEventListener('plane-fiche', () => { ficheAsked = false; if (isOpen()) { askFiches(); soon(); } });
    document.body.appendChild(el);
  }
  let soonT = 0;
  const soon = () => { if (soonT) return; soonT = setTimeout(() => { soonT = 0; if (isOpen()) render(); }, 120); };

  const tileOf = n => { const e = n && n.closest ? n.closest('[data-k]') : null; return e ? find(e.dataset.k) : null; };
  let last = [];
  const find = k => last.find(t => t.k === k) || null;

  function picUrl(t, hero) {
    let u = null;
    try { if (W.PLANE_THUMB && t.thumb) u = (hero && t.kind !== 'mine' && W.PLANE_THUMB.hero ? W.PLANE_THUMB.hero(t.thumb) : null) || W.PLANE_THUMB.get(t.thumb); } catch (e) { u = null; }
    return u;
  }
  function stateHtml(t) {
    if (t.kind === 'bring') return '<span class="flState">buy in · ' + esc(t.r.text) + '</span>';
    if (t.kind === 'mine') { const c = CERT_OF[t.state] || CERT_OF.none; return '<span class="flState ' + (c[2] ? 'st-' + c[2] : '') + '">' + esc(c[1]) + '</span>'; }
    return '<span class="flCls">' + esc(CLASS_WORD[t.cls] || t.cls || '') + '</span>';
  }
  function tileHtml(t) {
    const r = t.r || {}, u = picUrl(t, false), selK = sel[tab];
    const cls = ['flTile', t.kind === 'cand' ? 'flCand' : '', r.cur ? 'cur' : '', r.away ? 'flAway' : '', r.broken ? 'flBroken' : '', t.why ? 'flBlocked' : '', selK === t.k ? 'sel' : ''].filter(Boolean).join(' ');
    let h = '<div class="' + cls + '" data-k="' + esc(t.k) + '">';
    h += '<div class="flPic">' + (u ? '<img alt="" src="' + esc(u) + '">' : '<span class="flGlyph">' + esc((t.name || '?').slice(0, 1)) + '</span>') +
      (t.n != null ? '<span class="flNo">#' + esc(t.n) + '</span>' : '') +
      (r.place ? '<span class="flPlace flPlace-' + esc(r.place.kind) + '"' + (r.place.wear >= 0.05 ? ' title="weathered outside: ' + Math.round(r.place.wear * 100) + ' %"' : '') + '>' + esc(r.place.text) + '</span>' : '') + '</div>';
    h += '<div class="flMeta"><b class="flName" title="' + esc(t.name) + '">' + esc(t.name) + '</b>' +
      '<div class="flRow2"><span class="flReg">' + esc(t.reg || '') + '</span>' + stateHtml(t) + '</div>' +
      (t.kind === 'mine' && (r.meta || r.liveries > 1) ? '<span class="flNote">' + esc([r.meta, r.liveries > 1 ? r.liveries + ' liveries' : ''].filter(Boolean).join(' · ')) + '</span>' : '') +
      (t.kind === 'cand' && t.note ? '<span class="flNote">' + esc(t.note) + '</span>' : '') +
      (t.why ? '<span class="flNote flWhy">' + esc(t.why) + '</span>' : '') + '</div>';
    if (ask && ask.k === t.k) {
      h += '<div class="flAsk"><span>' + esc(ask.text) + '</span><div class="flActs">' +
        (ask.go ? '<button type="button" class="flBtn" data-a="no">Cancel</button><button type="button" class="flBtn flPri" data-a="yes">' + esc(ask.yes) + '</button>'
                : '<button type="button" class="flBtn flPri" data-a="no">OK</button>') + '</div></div>';
    } else if (menu === t.k) {
      h += '<div class="flMenu">' + moreRows(t).map(m => '<button type="button" class="flBtn" data-a="' + m.a + '"' + (m.off ? ' disabled title="' + esc(m.off) + '"' : '') + '>' + esc(m.label) + '</button>').join('') +
        '<button type="button" class="flBtn" data-a="shut">Back</button></div>';
    } else {
      const load = t.kind === 'bring' ? '<button type="button" class="flBtn flPri" data-a="buy"' + (r.price == null ? ' disabled' : '') + '>Buy in</button>'
        : r.cur ? '<button type="button" class="flBtn flPri" data-a="load" disabled>On the stand</button>'
        : t.why ? '<button type="button" class="flBtn flPri" data-a="load" disabled title="' + esc(t.why) + '">Load</button>'
        : '<button type="button" class="flBtn flPri" data-a="load"' + (r.away ? ' title="at ' + esc(r.place && r.place.aero) + ': fly from there?"' : '') + '>Load</button>';
      h += '<div class="flActs">' + load +
        (t.kind === 'bring' ? '' : '<button type="button" class="flBtn" data-a="fiche"' + (t.fiche ? '' : ' disabled title="No fiche yet: it is drawn at its airworthiness certificate"') + '>Fiche</button>') +
        (moreRows(t).length ? '<button type="button" class="flBtn flMore" data-a="more" aria-label="More">⋯</button>' : '') + '</div>';
    }
    return h + '</div>';
  }
  function moreRows(t) {
    if (t.kind !== 'mine') return [];
    const r = t.r, out = [];
    if (r.home) out.push({ a: 'home', label: 'Bring home' });
    if (r.sale) out.push({ a: 'sell', label: 'Sell · ' + r.sale.text, off: r.sale.ok ? '' : 'Not for sale now: ' + (r.sale.why || 'no price') });
    out.push({ a: 'del', label: 'Delete' });
    return out;
  }
  function facetsHtml() {
    const U = ui[tab], all = tab === 'mine' ? tilesMine() : tilesAll(), cnt = {};
    for (const t of all) if (matchQ(t, U.q)) { const f = facetOf(t); cnt[f] = (cnt[f] || 0) + 1; }
    const ck = (key, label, n, on) => '<button type="button" class="flCk' + (on ? ' on' : '') + (n ? '' : ' none') + '" data-f="' + esc(key) + '"><i></i><span>' + esc(label) + '</span><em>' + (n || 0) + '</em></button>';
    let h = '';
    if (tab === 'mine') {
      h += '<div class="flGrp"><span class="flGh">Certificate</span>';
      for (const c of CERT) if (cnt[c[0]] || U.off.indexOf(c[0]) >= 0) h += ck(c[0], c[1], cnt[c[0]], U.off.indexOf(c[0]) < 0);
      h += '</div>';
      if (cnt.bring || U.off.indexOf('bring') >= 0) h += '<div class="flGrp"><span class="flGh">Owned</span>' + ck('bring', 'Sandbox builds to buy in', cnt.bring, U.off.indexOf('bring') < 0) + '</div>';
    } else {
      h += '<div class="flGrp"><span class="flGh">Class</span>';
      for (const c of CLASSES) if (cnt[c[0]] || U.off.indexOf(c[0]) >= 0) h += ck(c[0], c[1], cnt[c[0]], U.off.indexOf(c[0]) < 0);
      h += '</div><div class="flGrp"><span class="flGh">Fiche</span>' + ck('#fiche', 'Has a fiche', all.filter(t => t.fiche && matchQ(t, U.q)).length, U.fiche) + '</div>';
    }
    if (tab === 'all' && phone()) h += '<div class="flGrp"><span class="flGh">Sort</span>' + SORTS.all.map(s => '<button type="button" class="flCk flSortCk' + (ui.all.sort === s[0] ? ' on' : '') + '" data-sort="' + s[0] + '"><i></i><span>' + esc(s[1]) + '</span></button>').join('') + '</div>';
    return h;
  }
  function onFacet(e) {
    const b = e.target.closest && e.target.closest('button'); if (!b) return;
    if (b.dataset.sort) { ui[tab].sort = b.dataset.sort; keep(); render(); return; }
    const f = b.dataset.f; if (!f) return;
    const U = ui[tab];
    if (f === '#fiche') U.fiche = !U.fiche;
    else { const i = U.off.indexOf(f); if (i >= 0) U.off.splice(i, 1); else U.off.push(f); }
    keep(); render();
  }
  function peekHtml() {
    const t = find(sel[tab]);
    if (!t || phone()) return '<div class="flPeekNone">Select a plane to see its fiche here.</div>';
    const u = picUrl(t, true), r = t.r || {}, d = (t.baked && t.baked.data) || null;
    let h = '<div class="flSheetPk' + (u ? '' : ' empty') + '"><div class="flSheetH"><span>' + esc(String(t.name).toUpperCase()) + '</span><span>' + esc(t.reg || '') + '</span></div>' +
      (u ? '<img alt="" src="' + esc(u) + '">' : '<span class="flGlyph">' + esc((t.name || '?').slice(0, 1)) + '</span>') + '</div>';
    const rows = [];
    if (t.kind === 'mine') {
      const c = CERT_OF[t.state] || CERT_OF.none;
      rows.push(['Certificate', c[1]]);
      if (r.place) rows.push(['Stands', r.place.text]);
      if (r.flights) rows.push(['Flown', r.flights + (r.flights === 1 ? ' flight' : ' flights') + (r.hours >= 0.005 ? ' · ' + r.hours.toFixed(1) + ' h' : '')]);
      if (r.flown) rows.push(['Last flight', r.flown]);
      if (r.sale) rows.push(['Used price', r.sale.text]);
    } else {
      rows.push(['Class', (CLASS_WORD[t.cls] || t.cls) + (t.n != null ? ' · #' + t.n : '')]);
      if (d) {
        const s = d.specs || {}, D = d.dims || {};
        if (s.engine || d.engine) rows.push(['Engine', s.engine || d.engine]);
        if (d.seats != null) rows.push(['Seats', d.seats + (d.gear ? ' · ' + d.gear : '')]);
        if (D.span) rows.push(['Span', (+D.span).toFixed(2) + ' m']);
        if (s.empty) rows.push(['Empty', Math.round(s.empty) + ' kg']);
        if (s.TORun != null) rows.push(['Take-off run', Math.round(s.TORun) + ' m' + (d.sea ? ' on water' : '')]);
      } else if (t.kind === 'cand' && t.note) rows.push(['Note', t.note]);
    }
    h += '<dl class="flFacts">' + rows.map(x => '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>').join('') + '</dl>';
    h += '<div class="flPeekActs" data-k="' + esc(t.k) + '"><button type="button" class="flBtn" data-a="fiche"' + (t.fiche ? '' : ' disabled title="No fiche yet"') + '>Open fiche</button>' +
      (t.kind === 'bring' ? '<button type="button" class="flBtn flPri" data-a="buy">Buy in</button>'
        : '<button type="button" class="flBtn flPri" data-a="load"' + (r.cur ? ' disabled' : '') + '>' + (r.cur ? 'On the stand' : 'Load') + '</button>') + '</div>';
    return h;
  }
  function render() {
    if (!el) return;
    LOG.renders++;
    readModelOnce();
    const ts = sorted(shown()); last = (tab === 'mine' ? tilesMine() : tilesAll());
    if (sel[tab] && !last.some(t => t.k === sel[tab])) sel[tab] = null;
    if (!sel[tab] && ts.length && !phone()) sel[tab] = ts[0].k;
    // the bar
    for (const b of el.querySelectorAll('.flSeg button')) {
      const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      const n = b.dataset.tab === 'mine' ? (model ? model.rows.length : 0) : (lists ? lists.length + (cands ? cands.length : 0) : 0);
      b.querySelector('b').textContent = n ? String(n) : '';
    }
    const q = el.querySelector('.flSearch'); if (q.value !== ui[tab].q) q.value = ui[tab].q;
    const so = el.querySelector('.flSort');
    so.innerHTML = SORTS[tab].filter(s => tab !== 'mine' || s[0] !== 'price' || (model && model.rows.some(r => r.sale)))
      .map(s => '<option value="' + s[0] + '"' + (ui[tab].sort === s[0] ? ' selected' : '') + '>' + esc(s[1]) + '</option>').join('');
    el.querySelector('.flView').textContent = ui.view === 'list' ? '▤ List' : '▦ Tiles';
    const nOff = ui[tab].off.length + (tab === 'all' && ui.all.fiche ? 1 : 0);
    el.querySelector('.flFilt').textContent = 'Filters' + (nOff ? ' · ' + nOff : '');
    // the honesty line (the birth flow's): loading over an UNSAVED build is the destructive path, and it says so first
    const sub = el.querySelector('.flSub'), un = !(model && model.stand);
    sub.textContent = un ? 'Loading replaces the unsaved build on the stand' : 'Pick an aeroplane for the stand: “' + model.stand + '” keeps its slot';
    sub.classList.toggle('warn', un);
    // the rail, the grid, the peek
    el.querySelector('.flRail').innerHTML = facetsHtml();
    const grid = el.querySelector('.flGrid');
    grid.classList.toggle('flList', ui.view === 'list');
    let h = '', head = null;
    for (const t of ts) {
      const hd = headOf(t);
      if (hd && hd !== head) { h += '<div class="flGh flGroupH">' + esc(hd) + '</div>'; head = hd; }
      h += tileHtml(t);
    }
    if (!ts.length) h = '<div class="flEmpty">' + esc(emptyLine()) + '</div>';
    grid.innerHTML = h;
    el.querySelector('.flPeek').innerHTML = peekHtml();
    const sh = el.querySelector('.flSheet'); sh.hidden = !sheet;
    if (sheet) { el.querySelector('.flSheetBody').innerHTML = facetsHtml(); el.querySelector('.flShow').textContent = 'Show ' + ts.length + (ts.length === 1 ? ' plane' : ' planes'); }
  }
  let modelFresh = false;
  const readModelOnce = () => { if (!modelFresh) { readModel(); modelFresh = true; } };
  function emptyLine() {
    if (tab === 'all' && !lists) return 'Reading the plane list…';
    if (ui[tab].q || ui[tab].off.length || (tab === 'all' && ui.all.fiche)) return 'Nothing matches: clear the search or the filters.';
    if (tab === 'mine') return model && model.storage === false
      ? 'Browser storage is unavailable, so nothing can be saved. All planes still load.'
      : 'No saved aeroplanes yet. Save the build on the stand and it appears here.';
    return 'No planes listed.';
  }

  // ---- the verbs -------------------------------------------------------------------------------------------------
  function onGrid(e) {
    const b = e.target.closest && e.target.closest('button');
    const holder = e.target.closest && e.target.closest('[data-k]');
    const t = holder ? find(holder.dataset.k) : null;
    if (!t) return;
    if (!b) {   // a click on the tile selects it (the peek follows); on the phone the picture opens the fiche
      if (phone()) { if (e.target.closest('.flPic') && t.fiche) fiche(t); return; }
      if (sel[tab] !== t.k) { sel[tab] = t.k; render(); }
      return;
    }
    if (b.disabled) return;
    const a = b.dataset.a;
    if (a === 'load') primary(t);
    else if (a === 'buy') buyIn(t);
    else if (a === 'fiche') fiche(t);
    else if (a === 'more') { menu = t.k; ask = null; render(); }
    else if (a === 'shut') { menu = null; render(); }
    else if (a === 'home') { menu = null; GS().fleetDo.home(t.r.slot); refresh(); }
    else if (a === 'sell') askOn(t, 'Sell “' + t.name + '” on the used market for ' + t.r.sale.text + '? It leaves your fleet for good.', 'Sell', () => result(t, GS().fleetDo.sell(t.r.slot)));
    else if (a === 'del') askOn(t, 'Delete the saved build “' + t.r.slot + '”? It cannot be undone.', 'Delete', () => result(t, GS().fleetDo.del(t.r.slot)));
    else if (a === 'no') { ask = null; render(); }
    else if (a === 'yes') { const go = ask && ask.go; ask = null; if (go) go(); else render(); }
  }
  const buyIn = t => askOn(t, 'Buy “' + t.name + '” into this career for ' + t.r.text + '?', 'Buy', () => result(t, GS().fleetDo.buyIn(t.r.slot)));
  function askOn(t, text, yes, go) { LOG.asked++; menu = null; ask = { k: t.k, text, yes, go }; if (sel[tab] !== t.k && !phone()) sel[tab] = t.k; render(); }
  function result(t, r) {
    if (r && r.ok === false) { ask = { k: t.k, text: r.why || 'Refused.', go: null }; render(); return; }
    refresh();
  }
  function primary(t) {
    const g = GS(); if (!g || busy) return;
    if (t.kind === 'bring') { if (t.r.price != null) buyIn(t); return; }
    if (t.kind === 'mine') {
      if (t.r.cur) return;
      if (t.r.away) return askOn(t, '“' + t.name + '” is ' + t.r.place.text + '. Fly from there?', 'Fly from there', () => loadNow(() => g.fleetDo.load(t.r.slot)));
      return loadNow(() => g.fleetDo.load(t.r.slot));
    }
    if (t.kind === 'cand') return loadNow(() => (g.openCandidate ? g.openCandidate(t.c) : g.fleetDo.candidate(t.c)));
    if (t.kind === 'list') { if (t.why) return; return loadNow(() => g.openListed(t.p)); }
  }
  // ONE PRESS, BEHIND A SPINNER: painted first (two frames), then the load, then the screen closes; the load's own
  // failures say so through their own doors (garage.js), and the screen closes either way
  function loadNow(fn) {
    if (busy) return;
    busy = true; LOG.loads++;
    const sp = el.querySelector('.flSpin'); sp.hidden = false;
    const go = () => setTimeout(() => {
      try { fn(); } catch (e) { console.warn('flyDiy (fleet): the load failed -', e && e.message); }
      busy = false; sp.hidden = true; close();
    }, 0);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go)); else go();
  }
  function fiche(t) {
    if (!t.fiche || !W.FICHE_BOARD || !W.FICHE_BOARD.show) return;
    try { W.FICHE_BOARD.show(t.fiche); } catch (e) { console.warn('flyDiy (fleet): the fiche -', e && e.message); }
  }
  function setTab(t) {
    if (t !== 'mine' && t !== 'all') return;
    tab = ui.tab = t; ask = null; menu = null; keep();
    if (t === 'all') askLists();
    render();
    try { el.querySelector('.flGridW').scrollTop = 0; } catch (e) {}
  }

  // ---- the doors -------------------------------------------------------------------------------------------------
  function hold(on) { try { if (W.FLYDIY_UI_HOLD) W.FLYDIY_UI_HOLD(!!on); } catch (e) {} }
  function open(opts) {
    if (!GS()) return false;
    if (!el) build();
    const t = opts && (opts.tab === 'all' || opts.tab === 'mine') ? opts.tab : ui.tab;
    tab = ui.tab = t; ask = null; menu = null; sheet = false; busy = false; modelFresh = false;
    el.hidden = false;
    document.documentElement.classList.add('flOpen');
    LOG.opened++;
    hold(true);
    askLists(); askFiches();
    render();
    return true;
  }
  function close() {
    if (!el || el.hidden) return;
    el.hidden = true; ask = null; menu = null; sheet = false;
    document.documentElement.classList.remove('flOpen');
    hold(false);
  }
  const isOpen = () => !!(el && !el.hidden);
  // garage.js: a save, a delete, an import, a sale - the hangar is read again
  function refresh() { modelFresh = false; if (isOpen()) render(); }

  W.FLEET_SCREEN = { open, close, isOpen, refresh, LOG,
    _state: () => ({ tab, sel: Object.assign({}, sel), ask: ask && { k: ask.k, text: ask.text }, menu, ui: JSON.parse(JSON.stringify(ui)), busy }),
    _tiles: () => sorted(shown()).map(t => ({ k: t.k, kind: t.kind, name: t.name, reg: t.reg, state: t.state || null, cls: t.cls || null, fiche: t.fiche || null })),
    // GATE FLEET's hands (tools/_fleet_check.js): a press on a tile's button (or on the tile: a = null), a filter, the tab, the search,
    // the sort - through the same handlers the clicks reach
    _act: (k, a, pic) => onGrid({ target: { closest: s => (s === 'button' ? (a ? { dataset: { a }, disabled: false } : null) : s === '[data-k]' ? { dataset: { k } } : s === '.flPic' ? (pic ? {} : null) : null) } }),
    _facet: f => onFacet({ target: { closest: () => ({ dataset: { f } }) } }),
    _tab: t => setTab(t), _query: q => { ui[tab].q = q; render(); }, _sort: s => { ui[tab].sort = s; keep(); render(); },
    _html: () => (el ? el.querySelector('.flGrid').innerHTML : ''), _peek: () => (el ? el.querySelector('.flPeek').innerHTML : '') };
})();
