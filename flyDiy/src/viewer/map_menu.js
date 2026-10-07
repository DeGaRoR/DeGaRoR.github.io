// map_menu.js - THE MAP SCREEN (G2252-G2256, MAP-MENU; futureDesigns/GAME-2026-10-06.md §8.2 the layout, §8.3 the
// detail card, §8.1 SnowRunner's lessons; §R binding: five providers, the mine and the dock merged; G-COST; GQ19 the
// phone plans). One screen over the game: the contracts list tabbed by provider (All + 5) with three asset tabs (Fleet,
// Pilots, Market), the 2-D island (tools/map_bake.js's picture, src/viewer/map_pack.js's projection) with pan, pinch
// and zoom and four layers, and the detail card of the selection.
//
// WHAT IT FIXES (§8.1's complaints):
//   - everything needed, remotely: where the load is, where it goes, both strips' length and surface, the payload, the
//     pay - on the card, never only in the world;
//   - "your fleet against this job": each airframe's certificate against the job's numbers (payload spare, the
//     certified take-off / landing run vs the strip, floats for water, seats) - STATED AS FACTS, NEVER FORBIDDING:
//     no button is ever disabled by a mismatch (free choice and the spine);
//   - track one, accept many: tapping a row highlights its markers and draws its route; tapping a marker selects its
//     row (the cross-highlight is a tap, R17 - nothing is hover-only);
//   - markers are provider-coloured badges with a kind glyph and a 48 px hit area, the busy screen kept to one job per
//     surface (UI-MODEL: three greys, one accent, IBM Plex Sans).
//
// THE SANDBOX STAYS TODAY'S GAME. This file is LAZY (build.js MANIFEST.lazy 'map_menu', like diag.js): the page's
// loader shows a MAP entry only with ?map=1 (a dev flag) or when FLYDIY_MODE === 'career' (not built yet), and fetches
// this file, map_pack.js, the picture and the contracts only when the entry is pressed. Nothing of it exists before.
//
// THE PHONE (GQ19, MOBILE-GARAGE R1-R24): the same screen as a bottom sheet over the map (peek / open), tabs as chips,
// every target >= 48 px, the map (touch-action none: one finger pans, two pinch) and the sheet (pan-y: it scrolls)
// never share a gesture (R20). Plan only: accept, track, look. No flight from here.
//
// THE CONTRACTS ARE READ THROUGH ONE FUNCTION (mapAdapt), from ONE SOURCE LINE (MAP_SOURCE). G2320 (CAREER-WIRE): the
// source is THE REAL RECORD - 75_career_wire.js careerMapRecord over the career document (?career=1: the page's dev
// career, window.FLYDIY_CAREER; Accept / Track write it through careerAccept / careerTrack), else a NEW career's
// offers in memory (nothing saved; Accept / Track live in the session's adapted record, as before). ?mapsrc=fixture
// keeps tools/fixtures/contracts_sample.json (the stills).
//
// Pure half (node: require('src/viewer/map_menu.js') -> the core; GATE UISMOKE runs it) and a DOM half (the page).
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;

  // ---- THE NUMBERS ------------------------------------------------------------------------------------------------
  const PAX_KG = 80;                     // a passenger and a bag, the yardstick a payload fact uses (the cabin's station mass)
  const KIND_WORD = { contract: 'contract', job: 'job', build: 'build', challenge: 'challenge', survey: 'survey' };
  const KIND_GLYPH = { contract: '▸', job: '●', build: '◆', challenge: '◷', survey: '⌖' };
  const DO_WORD = { carry: 'carry', fly: 'fly', land: 'land', deliver: 'deliver', survey: 'survey', accept: 'deliver for acceptance' };
  const CRIT_WORD = { seats: 'seats', emptyKg: 'empty mass', power: 'powertrain', tankL: 'tank', spanM: 'span', cost: 'cost', tas: 'cruise', endurance: 'endurance', land: 'lands at',
                      // (G2320) CONTRACT-MODEL's kinds (73_contracts.js CONTRACT_CRIT_KINDS)
                      powertrain: 'powertrain', costMax: 'cost', batteryKWh: 'battery', ultimateG: 'ultimate load', xwindKt: 'crosswind', hydro: 'on water',
                      tasKmh: 'cruise', enduranceMin: 'endurance', rangeKm: 'range', takeoffAt: 'takes off at', landAt: 'lands at' };
  // what verifies each criterion (§6.2): the spec / the ledger / the certificate can tell now; the bench's test or the flight must be run
  const CRIT_BY = { seats: 'spec', emptyKg: 'ledger', power: 'spec', tankL: 'spec', spanM: 'spec', cost: 'ledger', tas: 'flight', endurance: 'flight', land: 'flight',
                    powertrain: 'spec', costMax: 'ledger', batteryKWh: 'spec', ultimateG: 'cert', xwindKt: 'bench', hydro: 'bench',
                    tasKmh: 'flight', enduranceMin: 'flight', rangeKm: 'flight', takeoffAt: 'flight', landAt: 'flight' };
  const CRIT_STRIP = { land: 1, landAt: 1, takeoffAt: 1 };
  const TABS_ASSET = [['fleet', 'Fleet'], ['pilots', 'Pilots'], ['market', 'Market']];
  const LAYERS = [['contracts', 'Contracts'], ['fleet', 'Fleet'], ['fields', 'Fields'], ['plots', 'Plots']];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const kmOf = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.z - b.z) / 1000 : 0;

  // ---- THE ADAPTER: the only reader of the record's shape ----------------------------------------------------------
  // raw: { providers, contracts, career?, fleet?, board?, text? } (§7.3); pack: MAP_PACK (the aerodromes); live: the
  // player's document (FLYDIY_PLAYER.doc(), 70_player.js v2) or null. -> the model every view below reads.
  function mapAdapt(raw, pack, live) {
    raw = raw || {};
    const aeros = {};
    for (const a of ((pack && pack.aerodromes) || [])) aeros[a.id] = a;
    const text = raw.text || {};
    const say = k => (k && text[k]) || k || '';
    const providers = (raw.providers || []).map(p => ({ id: p.id, name: p.name, short: p.short || p.name, colour: p.colour || '#888', home: p.home || null, line: p.line || '' }));
    const prov = {}; for (const p of providers) prov[p.id] = p;
    const car = raw.career || {};
    const career = { accepted: (car.accepted || []).slice(), tracked: car.tracked || null, stage: Object.assign({}, car.stage || {}), wallet: car.wallet, clock: car.clock,
                     live: JSON.parse(JSON.stringify(car.live || {})) };   // (G2320) the real record's progress inside a stage
    // (G2320) where the real record differs from the fixture: a survey names the site it flies over as `at` (drawn as its `to`)
    const subOf = u => { const o = Object.assign({}, u); if (o.do === 'survey' && o.at && !o.to) o.to = o.at; return o; };
    const contracts = (raw.contracts || []).map(c => {
      const stages = (c.stages || []).map(s => ({ subs: (s.subs || []).map(subOf) }));
      return { id: c.id, provider: c.provider, kind: c.kind || 'job', title: say(c.title), brief: say(c.brief), stages, pay: c.pay || {}, rep: c.rep || null, repeat: c.repeat || false,
               followLine: c.followLine || '' };
    }).filter(c => prov[c.provider]);
    // the fleet: the player's own airframes where they stand (the live document) when it has any, else the record's
    let fleet = (raw.fleet || []).map(f => ({ slot: f.slot, name: f.name || f.slot, where: Object.assign({ kind: 'none', aero: null, hangar: null }, f.where || {}), cert: f.cert || null, live: false }));
    if (live && live.fleet && Object.keys(live.fleet).length) {
      const certOf = {}; for (const f of fleet) certOf[f.slot] = f.cert;
      fleet = Object.keys(live.fleet).sort().map(n => ({ slot: n, name: n, where: whereOf(live, n), cert: certOf[n] || null, live: true }));
    }
    const board = (raw.board || []).map(d => ({ name: d.name, cert: d.cert || null }));
    return { providers, prov, contracts, career, fleet, board, aeros, plots: (pack && pack.plots) || [], source: raw.source || 'fixture' };
  }
  // 71_player_bases.js playerWhere's three kinds, read off the v2 document (the same rule; that file is the core's)
  function whereOf(doc, n) {
    const e = doc.fleet[n];
    if (!e) return { kind: 'none', aero: null, hangar: null };
    if (e.hangar && doc.sheds && doc.sheds[e.hangar]) return { kind: 'in', hangar: e.hangar, aero: doc.sheds[e.hangar].base };
    const aero = e.aero || null, held = aero && doc.sheds && Object.keys(doc.sheds).some(k => doc.sheds[k] && doc.sheds[k].base === aero);
    return { kind: held ? 'out' : 'away', hangar: null, aero };
  }

  // ---- READING A CONTRACT -----------------------------------------------------------------------------------------
  const stageOf = (M, c) => Math.max(0, Math.min((c.stages.length || 1) - 1, M.career.stage[c.id] | 0));
  const subsNow = (M, c) => ((c.stages[stageOf(M, c)] || {}).subs) || [];
  const loadKg = u => u.load ? (u.load.kg || 0) + (u.load.pax || 0) * PAX_KG : 0;
  const loadWord = u => {
    if (!u.load) return '';
    const L = u.load, b = [];
    if (L.kg) b.push(fmt(L.kg) + ' kg' + (L.bulk ? ' (bulk)' : ''));
    if (L.pax) b.push(L.pax + (L.pax > 1 ? ' passengers' : ' passenger'));
    return b.join(' · ');
  };
  const legKm = (M, u) => kmOf(M.aeros[u.from], M.aeros[u.to]);
  const aeroName = (M, id) => (M.aeros[id] && M.aeros[id].name) || id || '';
  const stripWord = a => a ? (a.surface.cls === 'water' ? fmt(a.len) + ' m water lane' : fmt(a.len) + ' m ' + a.surface.word) + (a.elev > 50 ? ' · ' + fmt(a.elev) + ' m up' : '') : '';
  // where the work is drawn: the load's place (the first sub's from), else where it goes
  const pinOf = (M, c) => { const u = subsNow(M, c)[0] || {}; return M.aeros[u.from] ? u.from : (M.aeros[u.to] ? u.to : null); };
  // THE PAY: the record's own (G2320: CONTRACT-MODEL's contractPay - the job's base, 60 a km x km x the load's factor,
  // the surfaces, a condition - carried as `total`); the fixture's base + perKm x the stage's km otherwise
  function payOf(M, c) {
    const P = c.pay || {};
    if (typeof P.total === 'number') return { base: P.base || 0, perKm: P.perKm || 0, km: P.km || 0, total: P.total, bonus: P.bonus || [], factor: P.factor || 0, surface: P.surface || 0, cond: P.cond || 0, model: true };
    const km = subsNow(M, c).reduce((s, u) => s + legKm(M, u), 0);
    const total = (P.base || 0) + (P.perKm || 0) * km;
    return { base: P.base || 0, perKm: P.perKm || 0, km, total, bonus: P.bonus || [] };
  }
  const payWord = P => !P.perKm ? '' : P.model
    ? fmt(P.base) + ' + ' + P.perKm + ' a km × ' + P.km.toFixed(1) + ' km' + (P.factor ? ' × ' + (1 + P.factor).toFixed(2) + ' for the load' : '') + (P.surface ? ' + ' + fmt(P.surface) + ' for the strips' : '') + (P.cond ? ' + ' + fmt(P.cond) + ' for the condition' : '')
    : fmt(P.base) + ' + ' + P.perKm + ' a km × ' + P.km.toFixed(1) + ' km';
  const bonusWord = b => b.crit === 'medal' ? '+' + b.pct + ' % for a ' + b.by + ' medal'
    : '+' + b.pct + ' % for ' + (CRIT_WORD[b.crit] || b.crit) + ' beaten by ' + (b.by < 1 ? Math.round(b.by * 100) : b.by) + ' %';
  // the gear rule, on the surface the bake recorded (25_airfield.js stripAllows' rule; GATE UISMOKE holds the two equal)
  function allows(gear, a) {
    const cls = a && a.surface ? a.surface.cls : 'grass';
    if (gear === 'amphibian') return { ok: true, why: '' };
    if (gear === 'floats') return cls === 'water' ? { ok: true, why: '' } : { ok: false, why: 'floats land on water only' };
    if (gear === 'skis') return (cls === 'snow' || cls === 'grass') ? { ok: true, why: '' } : { ok: false, why: 'skis need snow or grass' };
    return cls === 'water' ? { ok: false, why: 'a water lane: wheels cannot land on it' } : { ok: true, why: '' };
  }

  // ---- YOUR FLEET AGAINST THIS JOB (§8.3 point 2): facts, never a verdict on the pilot, never a refusal --------------
  // -> [{ ok: true | false | null, text }] for one airframe against the contract's current stage
  function factsFor(M, c, af) {
    const out = [], C = af.cert;
    if (!C) { out.push({ ok: null, text: 'certificate not read yet: open it in the garage' }); return out; }
    for (const u of subsNow(M, c)) {
      const kg = loadKg(u);
      if (u.load && kg) {
        const spare = (C.payloadKg || 0) - kg;
        out.push({ ok: spare >= 0, text: 'payload ' + fmt(kg) + ' kg: ' + (spare >= 0 ? fmt(spare) + ' kg spare' : fmt(-spare) + ' kg over its ' + fmt(C.payloadKg) + ' kg') });
      }
      if (u.load && u.load.pax) {
        const need = u.load.pax + 1;
        out.push({ ok: (C.seats || 0) >= need, text: u.load.pax + ' aboard + the pilot: ' + need + ' of its ' + (C.seats || 0) + ' seats' });
      }
      const ends = [['from', u.from, 'toRunM', 'take-off'], ['to', u.to, 'ldgRunM', 'landing']];
      for (const [, id, run, word] of ends) {
        const a = M.aeros[id]; if (!a) continue;
        const A = allows(C.gear || 'wheels', a);
        if (!A.ok) { out.push({ ok: false, text: a.name + ': ' + A.why + ' (' + (C.gear || 'wheels') + ')' }); continue; }
        if (a.surface.cls === 'water') { out.push({ ok: true, text: a.name + ': water, on ' + C.gear }); continue; }
        if (C[run]) out.push({ ok: C[run] <= a.len, text: a.name + ' is ' + fmt(a.len) + ' m ' + a.surface.word + '; certified ' + word + ' run ' + fmt(C[run]) + ' m' });
      }
    }
    const seen = new Set(); return out.filter(f => (seen.has(f.text) ? false : (seen.add(f.text), true)));
  }
  // the build contract (§8.3 point 3): each criterion against a design - true / false / null ("needs a flight")
  function critFor(M, cr, d) {
    const C = d.cert || {}, by = CRIT_BY[cr.k] || 'flight';
    const cmp = (x, op, v) => op === '>=' ? x >= v : op === '<=' ? x <= v : (op === '=' || op === '==') ? x === v : false;
    const k = cr.k;
    if (by === 'bench') return { ok: null, by, text: 'needs a bench test' };
    if (CRIT_STRIP[k]) {
      const a = M.aeros[cr.v]; const A = a ? allows(C.gear || 'wheels', a) : { ok: true };
      if (!A.ok) return { ok: false, by, text: A.why };
      return { ok: null, by, text: a && a.surface.cls !== 'water' && C.toRunM ? 'take-off run ' + fmt(C.toRunM) + ' m vs ' + fmt(a.len) + ' m: needs a flight' : 'needs a flight' };
    }
    if (by === 'flight') {
      const est = k === 'tas' ? C.tasKmh && (fmt(C.tasKmh) + ' km/h on the plaque') : k === 'endurance' ? C.enduranceMin && (fmt(C.enduranceMin) + ' min on the plaque') : '';
      return { ok: null, by, text: (est ? est + ': ' : '') + 'needs a flight' };
    }
    const map = { seats: C.seats, emptyKg: C.emptyKg, power: C.power, tankL: C.tankL, spanM: C.spanM, cost: C.cost,
                  powertrain: C.power, costMax: C.cost, batteryKWh: C.batteryKWh, ultimateG: C.ult };
    const x = map[k];
    if (x == null) return { ok: null, by, text: 'not on its certificate' };
    const unit = { emptyKg: ' kg', tankL: ' L', spanM: ' m', cost: '', costMax: '', batteryKWh: ' kWh', ultimateG: ' g' }[k] || '';
    return { ok: cmp(x, cr.op, cr.v), by, text: (typeof x === 'number' ? fmt(x) : x) + unit };
  }
  const critWord = (M, cr) => {
    if (cr.words) return cr.words;   // (G2320) the real record's own words (contractCritWords)
    const unit = { emptyKg: ' kg', tankL: ' L', spanM: ' m', tas: ' km/h', endurance: ' min', cost: '' }[cr.k] || '';
    if (cr.k === 'land') return 'lands at ' + aeroName(M, cr.v) + ' (' + stripWord(M.aeros[cr.v]) + ')';
    if (cr.k === 'power') return 'powertrain: ' + cr.v;
    const op = cr.op === '>=' ? '≥ ' : cr.op === '<=' ? '≤ ' : '';
    return (CRIT_WORD[cr.k] || cr.k) + ' ' + op + (typeof cr.v === 'number' ? fmt(cr.v) : cr.v) + unit + (cr.at ? ' (' + cr.at + ')' : '');
  };
  const critsOf = (M, c) => subsNow(M, c).reduce((a, u) => a.concat(u.crit || []), []);
  const designsOf = M => M.fleet.map(f => ({ name: f.name, cert: f.cert, where: f.where })).concat(M.board.map(d => ({ name: d.name, cert: d.cert, where: null })));
  // the row's fit mark: airframes with no ✗ / designs meeting every criterion that can be told now
  function fitOf(M, c) {
    if (c.kind === 'build') {
      const crit = critsOf(M, c), D = designsOf(M);
      const n = D.filter(d => crit.every(cr => critFor(M, cr, d).ok !== false)).length;
      return { n, of: D.length, word: 'designs ' + n + '/' + D.length };
    }
    const n = M.fleet.filter(f => f.cert && factsFor(M, c, f).every(x => x.ok !== false)).length;
    return { n, of: M.fleet.length, word: 'fleet ' + n + '/' + M.fleet.length };
  }

  // ---- THE LIST --------------------------------------------------------------------------------------------------
  function rowsOf(M, tab) {
    const order = {}; M.providers.forEach((p, i) => { order[p.id] = i; });
    const kindO = { contract: 0, build: 1, job: 2, survey: 3, challenge: 4 };
    const L = M.contracts.filter(c => tab === 'all' || c.provider === tab);
    const rank = c => (c.id === M.career.tracked ? 0 : M.career.accepted.includes(c.id) ? 1 : 2);
    return L.slice().sort((a, b) => rank(a) - rank(b) || order[a.provider] - order[b.provider] || (kindO[a.kind] || 9) - (kindO[b.kind] || 9) || (a.id < b.id ? -1 : 1));
  }
  function rowWord(M, c) {
    const b = [KIND_WORD[c.kind] || c.kind];
    if (c.stages.length > 1) b.push('stage ' + (stageOf(M, c) + 1) + '/' + c.stages.length);
    const u = subsNow(M, c);
    const kg = u.reduce((s, x) => s + (x.load ? x.load.kg || 0 : 0), 0), pax = u.reduce((s, x) => s + (x.load ? x.load.pax || 0 : 0), 0);
    if (kg) b.push(fmt(kg) + ' kg'); if (pax) b.push(pax + ' pax');
    const km = u.reduce((s, x) => s + legKm(M, x), 0); if (km) b.push(km.toFixed(km < 10 ? 1 : 0) + ' km');
    b.push(fitOf(M, c).word);
    return b.join(' · ');
  }
  function whereWord(M, w) {
    if (!w || w.kind === 'none') return 'nowhere yet';
    if (w.kind === 'in') return 'in the ' + w.hangar + ' hangar' + (w.aero && w.aero !== w.hangar ? ' at ' + aeroName(M, w.aero) : '');
    return (w.kind === 'out' ? 'tied down at ' : 'away at ') + aeroName(M, w.aero);
  }

  // ---- THE HTML (strings, so node can read every surface; the DOM half sets them and delegates the taps) -----------
  function tabsHTML(M, st) {
    const n = id => (id === 'all' ? M.contracts.length : M.contracts.filter(c => c.provider === id).length);
    const t = [['all', 'All', null]].concat(M.providers.map(p => [p.id, p.short, p.colour]));
    return '<div class="mmTabs" role="tablist" aria-label="contracts by provider">' +
      t.map(([id, w, col]) => '<button type="button" role="tab" class="mmTab' + (st.tab === id ? ' on' : '') + '" data-tab="' + esc(id) + '" aria-selected="' + (st.tab === id) + '">' +
        (col ? '<i class="mmDot" style="background:' + esc(col) + '"></i>' : '') + esc(w) + '<span class="mmN">' + n(id) + '</span></button>').join('') +
      '</div><div class="mmTabs mmAssets" role="tablist" aria-label="your assets">' +
      TABS_ASSET.map(([id, w]) => '<button type="button" role="tab" class="mmTab' + (st.tab === id ? ' on' : '') + '" data-tab="' + id + '" aria-selected="' + (st.tab === id) + '">' + w + '</button>').join('') + '</div>';
  }
  function listHTML(M, st) {
    if (st.tab === 'pilots')
      return '<div class="mmEmpty"><b>Pilots: coming</b><span>The four recruits (GQ13) and your hired pilots will be listed here.</span></div>';
    if (st.tab === 'market') return marketListHTML(M, st);     // G2280 (PROCURE)
    if (st.tab === 'fleet') {
      if (!M.fleet.length) return '<div class="mmEmpty"><b>No aeroplanes yet</b><span>Save a build in the garage and it stands at its hangar.</span></div>';
      return M.fleet.map(f => '<button type="button" class="mmRow' + (st.sel === 'f:' + f.slot ? ' on' : '') + '" data-sel="f:' + esc(f.slot) + '">' +
        '<span class="mmRowT"><i class="mmGlyph">✈</i><b>' + esc(f.name) + '</b></span><span class="mmRowS">' + esc(whereWord(M, f.where)) +
        (f.cert ? ' · ' + f.cert.seats + ' seats · ' + fmt(f.cert.payloadKg) + ' kg payload · ' + f.cert.gear : ' · certificate not read') + '</span></button>').join('');
    }
    const rows = rowsOf(M, st.tab);
    if (!rows.length) return '<div class="mmEmpty"><b>No work on offer here yet</b><span>' + (M.contracts.length ? 'Another provider may have some: try All.' : 'The providers have not posted any contracts.') + '</span></div>';
    return rows.map(c => {
      const p = M.prov[c.provider], tr = M.career.tracked === c.id, ac = M.career.accepted.includes(c.id);
      return '<button type="button" class="mmRow' + (st.sel === 'c:' + c.id ? ' on' : '') + (tr ? ' trk' : '') + '" data-sel="c:' + esc(c.id) + '">' +
        '<span class="mmRowT"><i class="mmChip" style="background:' + esc(p.colour) + '">' + (KIND_GLYPH[c.kind] || '') + '</i><b>' + esc(c.title) + '</b>' +
        (tr ? '<em class="mmTrk">★ tracked</em>' : ac ? '<em>✓ accepted</em>' : '') + '</span>' +
        '<span class="mmRowS">' + esc(p.short) + ' · ' + esc(rowWord(M, c)) + '</span></button>';
    }).join('');
  }
  const endHTML = (M, word, id) => {
    const a = M.aeros[id];
    return '<div class="mmEnd"><span class="mmK">' + word + '</span><b>' + esc(aeroName(M, id) || '—') + '</b><span>' + esc(stripWord(a)) + '</span></div>';
  };
  function cardHTML(M, st) {
    const sel = st.sel || '';
    if (sel.startsWith('f:')) return fleetCardHTML(M, st, M.fleet.find(f => 'f:' + f.slot === sel));
    if (sel.startsWith('m:') && MK(M)) return modelCardHTML(M, st, sel.slice(2));     // G2280 (PROCURE)
    if (sel.startsWith('u:') && MK(M)) return usedCardHTML(M, st, sel.slice(2));
    const c = M.contracts.find(x => 'c:' + x.id === sel);
    if (!c) {
      const tr = M.contracts.find(x => x.id === M.career.tracked);
      return '<div class="mmCard mmIdle"><h2>Pick a contract</h2><p>Tap a row or a marker on the map: its card says where the load is, where it goes, both strips, the payload, the pay, and your fleet against it.</p>' +
        (tr ? '<p class="mmK">Tracking</p><button type="button" class="mmRow" data-sel="c:' + esc(tr.id) + '"><span class="mmRowT"><b>' + esc(tr.title) + '</b></span><span class="mmRowS">' + esc(nextWord(M, tr)) + '</span></button>' : '<p class="mmK">Nothing tracked</p>') +
        '<p class="mmFine">' + M.career.accepted.length + ' accepted · ' + M.contracts.length + ' on offer · ' + M.fleet.length + ' aeroplanes</p></div>';
    }
    const p = M.prov[c.provider], si = stageOf(M, c), tr = M.career.tracked === c.id, ac = M.career.accepted.includes(c.id);
    let h = '<div class="mmCard">' + (st.phone ? '<button type="button" class="mmBack" data-act="back">‹ the list</button>' : '') +
      '<div class="mmProv"><i class="mmChip" style="background:' + esc(p.colour) + '">' + (KIND_GLYPH[c.kind] || '') + '</i>' + esc(p.name) + ' · ' + esc(KIND_WORD[c.kind] || c.kind) + '</div>' +
      '<h2>' + esc(c.title) + '</h2><p class="mmBrief">' + esc(c.brief) + '</p>' +
      '<p class="mmFine">' + esc(p.line) + '</p>';
    if (c.stages.length > 1)
      h += '<ol class="mmStages">' + c.stages.map((s, i) => '<li class="' + (i < si ? 'done' : i === si ? 'now' : '') + '">' + esc(s.subs.map(u => subWord(M, u)).join(' · ')) + '</li>').join('') + '</ol>';
    // 1. everything needed, remotely
    h += '<h3>' + (c.stages.length > 1 ? 'Stage ' + (si + 1) + ' of ' + c.stages.length : 'The job') + '</h3>';
    const LV = M.career.live[c.id] || null;
    subsNow(M, c).forEach((u, j) => {
      const sv = u.do === 'survey';
      // (G2320) the real record's progress inside the stage: a sub done, a load taken on
      const prog = LV && LV.stage === si ? (LV.subs[j] ? ' · ✓ done' : LV.picked[j] ? ' · loaded' : '') : '';
      h += '<div class="mmLeg"><div class="mmDo">' + esc(DO_WORD[u.do] || u.do) + (loadWord(u) ? ' · ' + esc(loadWord(u)) : '') + (u.from && u.to ? ' · ' + legKm(M, u).toFixed(1) + ' km' : '') +
        (u.when ? ' · ' + esc(u.when.before ? 'before ' + u.when.before : u.when.under ? 'under ' + Math.round(u.when.under / 60) + ' min' : '') : '') + esc(prog) + '</div>' +
        (u.from ? endHTML(M, sv ? 'from' : 'the load is at', u.from) : '') + (u.to ? endHTML(M, sv ? 'over' : u.from ? 'it goes to' : 'at', u.to) : '') + '</div>';
    });
    const P = payOf(M, c);
    h += '<h3>Pay</h3><p class="mmPay"><b>' + fmt(P.total) + '</b> net' + (P.perKm ? ' <span>(' + esc(payWord(P)) + ')</span>' : '') + '</p>' +
      (P.bonus.length ? '<p class="mmFine">' + esc(P.bonus.map(bonusWord).join(' · ')) + '</p>' : '') +
      (c.followLine ? '<p class="mmFine">' + esc(c.followLine) + '</p>' : '') +
      (c.rep ? '<p class="mmFine">reputation +' + c.rep.gain + ' with ' + esc((M.prov[c.rep.provider] || p).name) + '</p>' : '');
    // 2 / 3. the fleet, or the designs, against it
    if (c.kind === 'build') {
      const crit = critsOf(M, c), D = designsOf(M);
      h += '<h3>The criteria, against your designs</h3><ul class="mmCrit">' + crit.map(cr => '<li>' + esc(critWord(M, cr)) + ' <span class="mmBy">' + (CRIT_BY[cr.k] === 'flight' ? 'flown' : CRIT_BY[cr.k] || 'flown') + '</span></li>').join('') + '</ul>';
      h += D.map(d => '<div class="mmFit"><b>' + esc(d.name) + '</b><span>' + (d.where ? esc(whereWord(M, d.where)) : 'on the drawing board') + '</span><ul>' +
        crit.map(cr => { const r = critFor(M, cr, d); return '<li class="' + (r.ok === true ? 'ok' : r.ok === false ? 'no' : 'fly') + '">' + (r.ok === true ? '✓ ' : r.ok === false ? '✗ ' : '◌ ') + esc((CRIT_WORD[cr.k] || cr.k) + ': ' + r.text) + '</li>'; }).join('') + '</ul></div>').join('');
      h += '<div class="mmActs mmSub"><button type="button" class="mmBtn" disabled>New design in the garage · coming</button></div>';
    } else {
      h += '<h3>Your fleet against this job</h3>';
      h += M.fleet.length ? M.fleet.map(f => { const F = factsFor(M, c, f); return '<div class="mmFit"><b>' + esc(f.name) + '</b><span>' + esc(whereWord(M, f.where)) + '</span><ul>' +
        F.map(x => '<li class="' + (x.ok === true ? 'ok' : x.ok === false ? 'no' : 'fly') + '">' + (x.ok === true ? '✓ ' : x.ok === false ? '✗ ' : '◌ ') + esc(x.text) + '</li>').join('') + '</ul></div>'; }).join('')
        : '<p class="mmFine">No aeroplanes yet.</p>';
    }
    h += '<p class="mmFine">Facts from each certificate against the job\'s numbers. Nothing here stops you flying it.</p>';
    h += '<div class="mmActs"><button type="button" class="mmBtn' + (ac ? ' on' : '') + '" data-act="accept" aria-pressed="' + ac + '">' + (ac ? '✓ Accepted' : 'Accept') + '</button>' +
      '<button type="button" class="mmBtn pri' + (tr ? ' on' : '') + '" data-act="track" aria-pressed="' + tr + '">' + (tr ? '★ Tracked' : 'Track') + '</button>' +
      (st.phone ? '' : '<button type="button" class="mmBtn" disabled>Fly it · with the career</button>') + '</div></div>';
    return h;
  }
  function fleetCardHTML(M, st, f) {
    if (!f) return cardHTML(M, Object.assign({}, st, { sel: null }));
    const C = f.cert;
    let h = '<div class="mmCard">' + (st.phone ? '<button type="button" class="mmBack" data-act="back">‹ the list</button>' : '') +
      '<div class="mmProv"><i class="mmGlyph">✈</i>your aeroplane</div><h2>' + esc(f.name) + '</h2><p class="mmBrief">' + esc(whereWord(M, f.where)) + '</p>';
    if (C) h += '<h3>Its certificate</h3><ul class="mmCert">' + [
      ['seats', C.seats], ['payload', fmt(C.payloadKg) + ' kg'], ['empty', fmt(C.emptyKg) + ' kg'], ['take-off run', fmt(C.toRunM) + ' m'], ['landing run', fmt(C.ldgRunM) + ' m'],
      ['gear', C.gear], ['powertrain', C.power], ['cruise', fmt(C.tasKmh) + ' km/h'], ['endurance', fmt(C.enduranceMin) + ' min'], ['span', C.spanM + ' m']]
      .filter(r => r[1] != null && !/undefined|NaN/.test(String(r[1]))).map(r => '<li><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></li>').join('') + '</ul>';
    else h += '<p class="mmFine">Certificate not read yet: open it in the garage.</p>';
    const jobs = M.contracts.filter(c => c.kind !== 'build');
    const ok = jobs.filter(c => C && factsFor(M, c, f).every(x => x.ok !== false));
    h += '<h3>The work its certificate meets</h3><p class="mmFine">' + ok.length + ' of ' + jobs.length + ' jobs and contract stages, on the facts alone.</p><ul class="mmJobs">' +
      jobs.map(c => '<li class="' + (ok.includes(c) ? 'ok' : 'no') + '"><button type="button" class="mmLink" data-sel="c:' + esc(c.id) + '">' + (ok.includes(c) ? '✓ ' : '✗ ') + esc(c.title) + '</button></li>').join('') + '</ul></div>';
    return h;
  }
  function subWord(M, u) {
    const L = loadWord(u);
    return (DO_WORD[u.do] || u.do) + (L ? ' ' + L : '') + (u.from ? ' ' + aeroName(M, u.from) + ' →' : '') + (u.to ? ' ' + aeroName(M, u.to) : '');
  }
  const nextWord = (M, c) => 'next: ' + subsNow(M, c).map(u => subWord(M, u)).join(' · ');
  function statusHTML(M) {
    const tr = M.contracts.find(x => x.id === M.career.tracked);
    return '<span class="mmK">wallet</span><b>' + (M.career.wallet != null ? fmt(M.career.wallet) : '—') + '</b>' +
      '<span class="mmK">career clock</span><b>' + (M.career.clock != null ? (M.career.clock / 3600).toFixed(1) + ' h flown' : '—') + '</b>' +
      '<span class="mmK">tracked</span><b class="mmTrkLine">' + (tr ? '★ ' + esc(tr.title) + ' · ' + esc(nextWord(M, tr)) : 'nothing') + '</b>';
  }
  function layersHTML(st) {
    return '<div class="mmLayers" role="group" aria-label="map layers">' + LAYERS.map(([k, w]) => '<button type="button" class="mmLay' + (st.layers[k] ? ' on' : '') + '" data-layer="' + k + '" aria-pressed="' + !!st.layers[k] + '">' + w + '</button>').join('') + '</div>';
  }

  // ---- THE MARKERS (pure: what stands where; the DOM half turns them into 48 px buttons on the map) ----------------
  // -> [{ key, sel, kind, aero, x, z, label, sub, colour, glyph, on, dim, slot, of }]
  function markersOf(M, st) {
    const out = [], selC = (st.sel || '').startsWith('c:') ? M.contracts.find(c => 'c:' + c.id === st.sel) : null;
    const selF = (st.sel || '').startsWith('f:') ? st.sel.slice(2) : null;
    if (st.layers.contracts) for (const c of M.contracts) {
      const at = pinOf(M, c); if (!at) continue; const a = M.aeros[at];
      out.push({ key: 'c:' + c.id, sel: 'c:' + c.id, kind: 'contract', aero: at, x: a.x, z: a.z, label: c.title, colour: M.prov[c.provider].colour, glyph: KIND_GLYPH[c.kind] || '●',
                 on: !!selC && selC.id === c.id, trk: M.career.tracked === c.id, dim: !!selC && selC.id !== c.id });
    }
    if (selC && st.layers.contracts) for (const u of subsNow(M, selC)) if (u.to && M.aeros[u.to] && u.to !== pinOf(M, selC)) {
      const a = M.aeros[u.to];
      if (!out.some(m => m.key === 'to:' + u.to)) out.push({ key: 'to:' + u.to, sel: 'c:' + selC.id, kind: 'dest', aero: u.to, x: a.x, z: a.z, label: 'to ' + a.name, colour: M.prov[selC.provider].colour, glyph: '◎', on: true });
    }
    if (st.layers.fleet) for (const f of M.fleet) {
      const a = M.aeros[f.where && f.where.aero]; if (!a) continue;
      out.push({ key: 'f:' + f.slot, sel: 'f:' + f.slot, kind: 'fleet', aero: a.id, x: a.x, z: a.z, label: f.name, glyph: '✈', on: selF === f.slot, dim: !!selF && selF !== f.slot });
    }
    if (st.layers.fields) for (const id of Object.keys(M.aeros)) { const a = M.aeros[id]; out.push({ key: 'a:' + id, sel: null, kind: 'field', aero: id, x: a.x, z: a.z, label: a.name, sub: stripWord(a), cls: a.surface.cls }); }
    if (st.layers.plots) for (const p of M.plots) out.push({ key: 'p:' + p.id, sel: null, kind: 'plot', aero: p.aero, x: p.x, z: p.z, label: 'plot ' + p.id, sub: p.shells.join(' / ') + (p.derelict ? ' · derelict' : '') + (p.water ? ' · slipway' : '') });
    for (const m of marketMarkers(M, st)) out.push(m);     // G2280 (PROCURE): the used listings where they stand
    // the fan: badges of one kind at one field stand side by side (contracts above the field, the fleet below, a listing beside)
    const groups = {};
    for (const m of out) if (m.kind === 'contract' || m.kind === 'fleet' || m.kind === 'used') (groups[m.kind + '@' + m.aero] = groups[m.kind + '@' + m.aero] || []).push(m);
    for (const g of Object.values(groups)) g.forEach((m, i) => { m.slot = i; m.of = g.length; });
    return out;
  }
  // the routes: the selected contract's legs (bold), the tracked one's (thin) -> [{ from, to, sel, tracked }] in world x/z
  function routesOf(M, st) {
    const out = [], add = (c, bold) => { for (const u of subsNow(M, c)) { const a = M.aeros[u.from], b = M.aeros[u.to]; if (a && b && a !== b) out.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, bold, colour: M.prov[c.provider].colour, id: c.id }); } };
    const selC = (st.sel || '').startsWith('c:') ? M.contracts.find(c => 'c:' + c.id === st.sel) : null;
    const tr = M.contracts.find(c => c.id === M.career.tracked);
    if (tr && (!selC || selC.id !== tr.id)) add(tr, false);
    if (selC) add(selC, true);
    return out;
  }
  // track one, accept many
  function act(M, id, what) {
    const C = M.career, i = C.accepted.indexOf(id);
    if (what === 'accept') { if (i >= 0) { C.accepted.splice(i, 1); if (C.tracked === id) C.tracked = null; } else C.accepted.push(id); }
    if (what === 'track') { if (C.tracked === id) C.tracked = null; else { C.tracked = id; if (i < 0) C.accepted.push(id); } }
    return C;
  }

  // ---- THE MARKET (G2280 PROCURE; GAME-2026-10-06.md §5.1-§5.3, §R GQ2) ----------------------------------------
  // The makers' catalogues (76_procure.js: validated builds only, an options sheet each, factory-certified), then the
  // used listings (seeded, at most four, each standing at an aerodrome it can fly from). `P` is the core's procurement
  // namespace (the page: the window, whose globals the core bundle declares; node: flight_core.js), `doc` the player's
  // document (the career's under ?career=1: Buy; the sandbox's under ?map=1: Take, free). Pure: strings, no DOM.
  const USED_GLYPH = '⚑';
  function marketAdapt(P, doc, board) {
    if (!P || typeof P.procureCatalogue !== 'function') return null;
    const career = !!(doc && doc.career);
    const makers = P.procureCatalogue().map(m => { const K = P.PROCURE_MAKERS[m.maker];
      return { id: m.maker, name: P.procureText(K.name), line: P.procureText(K.line), colour: K.colour, models: m.models.slice() }; });
    const used = (doc ? P.procureMarketOf(doc) : []).map(L => Object.assign({}, L, { words: P.procureUsedWords(L), cert: P.procureUsedCert(L),
      name: P.procureText(P.PROCURE_MODELS[L.model].name), colour: P.PROCURE_MAKERS[P.PROCURE_MODELS[L.model].maker].colour }));
    const sheds = (doc && doc.sheds) || {};
    const hangars = Object.keys(sheds).filter(id => sheds[id] && typeof sheds[id] === 'object').sort((a, b) => (a === 'HOME' ? -1 : b === 'HOME' ? 1 : a < b ? -1 : 1))
      .map(id => ({ id, base: sheds[id].base, main: id === 'HOME' }));
    return { P, mode: career ? 'career' : 'sandbox', makers, used, wallet: doc ? doc.wallet : null,
             voucher: career ? Object.assign({}, doc.career.voucher) : null, hangars, econ: P.procureEconSource(),
             board: board || null };
  }
  const MK = M => M.market;
  const optsOf = (st, id) => (st.mopts && st.mopts[id]) || {};
  const sheetOf = (M, st, id) => MK(M).P.procureSheet(id, optsOf(st, id));
  const money = n => (n < 0 ? '−' : '') + fmt(Math.abs(n));
  // a certificate (a CONTRACT_DESIGNS-shaped row) as the card's facts
  function certRows(c) {
    if (!c) return [];
    const pay = Math.max(0, (c.seats || 1) - 1) * PAX_KG + (c.bagKg || 0);
    return [['seats', c.seats], ['payload', fmt(pay) + ' kg'], ['empty', fmt(c.emptyKg) + ' kg'], ['take-off run', fmt(c.toM) + ' m'], ['gear', c.gear],
            ['cruise', fmt(c.cruiseKmh) + ' km/h'], ['range', fmt(c.rangeKm) + ' km'], ['tank', (+c.tankL).toFixed(1) + ' L'], ['span', c.spanM + ' m'], ['ledger', fmt(c.cost)]];
  }
  const certHTML = c => '<ul class="mmCert">' + certRows(c).map(r => '<li><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></li>').join('') + '</ul>';
  // the list: the makers' models (from the stock price), then the used listings where they stand
  function marketListHTML(M, st) {
    const K = MK(M);
    if (!K) return '<div class="mmEmpty"><b>Market: not on this page</b><span>The makers and the used aeroplanes need the game\'s core.</span></div>';
    let h = '<div class="mmSect">The makers · validated designs only</div>';
    for (const mk of K.makers) for (const id of mk.models) {
      const S = K.P.procureSheet(id, {});
      h += '<button type="button" class="mmRow' + (st.sel === 'm:' + id ? ' on' : '') + '" data-sel="m:' + esc(id) + '"><span class="mmRowT"><i class="mmChip" style="background:' + esc(mk.colour) + '">◆</i><b>' + esc(S.name) + '</b>' +
        '<em>from ' + fmt(S.price.total) + '</em></span><span class="mmRowS">' + esc(mk.name) + ' · ' + S.cert.seats + ' seats · ' + esc(S.cert.gear) + ' · ' + fmt(S.cert.cruiseKmh) + ' km/h' + '</span></button>';
    }
    h += '<div class="mmSect">Used, where they stand</div>';
    if (!K.used.length) h += '<div class="mmEmpty"><span>Nothing for sale right now: new listings come after three more contracts.</span></div>';
    for (const L of K.used)
      h += '<button type="button" class="mmRow' + (st.sel === 'u:' + L.id ? ' on' : '') + '" data-sel="u:' + esc(L.id) + '"><span class="mmRowT"><i class="mmChip" style="background:' + esc(L.colour) + '">' + USED_GLYPH + '</i><b>' + esc(L.words.title) + '</b>' +
        '<em>' + fmt(L.price) + '</em></span><span class="mmRowS">' + esc(aeroName(M, L.aero)) + ' · ' + Math.round(L.condition * 100) + ' % of the catalogue · ' + esc(L.cert.gear) + '</span></button>';
    return h + boardHTML(K, st);
  }
  // THE DRAWING BOARD (§5.4, G-DESIGN): the saved builds as a library of designs (free, shared with the sandbox) and the
  // career's airframes. A design: "Build this design" (the ledger's price); an airframe: "Save as design" (free)
  function boardHTML(K, st) {
    const B = K.board;
    if (!B) return '';
    let h = '<div class="mmSect">Your drawing board</div>';
    if (B.mode === 'sandbox') return h + '<div class="mmEmpty"><span>In the sandbox every saved design is also an aeroplane (' + B.designs.length + ' on the shelf): nothing to build or pay.</span></div>';
    if (!B.designs.length) return h + '<div class="mmEmpty"><span>No designs yet: save one in the garage, and it waits here until you build it.</span></div>';
    for (const d of B.designs) {
      const af = B.airframes.find(a => a.slot === d.name);
      h += '<div class="mmBoard"><span class="mmRowT"><i class="mmGlyph">' + (d.airframe ? '✈' : '✎') + '</i><b>' + esc(d.name) + '</b><em>' +
        (d.airframe ? (af && af.modified ? 'airframe · modified' : af && af.factory ? 'airframe · factory-certified' : 'airframe') : 'design') + '</em></span>' +
        (d.airframe ? '<button type="button" class="mmOpt" data-board="save" data-slot="' + esc(d.name) + '">Save as design</button>'
                    : '<button type="button" class="mmOpt" data-board="build" data-slot="' + esc(d.name) + '">Build this design</button>') + '</div>';
    }
    if (st && st.boardMsg) h += '<p class="mmMsg' + (st.boardOk ? ' ok' : '') + '">' + esc(st.boardMsg) + '</p>';
    return h;
  }
  const buyWord = (K, price) => K.mode === 'career' ? 'Buy · ' + fmt(price) : 'Take it · free in the sandbox';
  function modelCardHTML(M, st, id) {
    const K = MK(M), S = sheetOf(M, st, id), mk = K.makers.find(m => m.id === S.maker);
    let h = '<div class="mmCard">' + (st.phone ? '<button type="button" class="mmBack" data-act="back">‹ the list</button>' : '') +
      '<div class="mmProv"><i class="mmChip" style="background:' + esc(mk.colour) + '">◆</i>' + esc(S.makerName) + ' · a maker\'s model</div>' +
      '<h2>' + esc(S.name) + '</h2><p class="mmBrief">' + esc(S.line) + '</p><p class="mmFine">' + esc(mk.line) + '</p>';
    h += '<h3>Its certificate</h3><p class="mmFine">Factory-certified: the validated build\'s bench numbers' + (S.cert.exact ? '' : ', with each option\'s measured effect added') + '. Opening it in the full editor makes it "modified": the certificate is withdrawn and the change billed.</p>' + certHTML(S.cert);
    h += '<h3>Options</h3>';
    for (const r of S.rows) {
      h += '<div class="mmOptRow"><span class="mmK">' + esc(r.word) + '</span><div class="mmOpts">' + r.vals.map(v => '<button type="button" class="mmOpt' + (v.on ? ' on' : '') + '" data-opt="' + esc(id + ':' + r.row + ':' + v.val) + '" aria-pressed="' + v.on + '">' +
        esc(v.word) + (v.price ? ' <i>' + (v.price > 0 ? '+' : '') + money(v.price) + '</i>' : '') + '</button>').join('') + '</div></div>';
    }
    const regV = optsOf(st, id).reg || '';
    h += '<div class="mmOptRow"><span class="mmK">registration</span><input class="mmIn" data-in="reg" value="' + esc(regV) + '" placeholder="e.g. N123AB" autocomplete="off" spellcheck="false"></div>';
    h += '<div class="mmOptRow"><span class="mmK">its name in your hangar</span><input class="mmIn" data-in="slot" value="' + esc(st.mname || '') + '" placeholder="' + esc(S.name) + '" autocomplete="off"></div>';
    if (K.hangars.length > 1) h += '<div class="mmOptRow"><span class="mmK">delivered to</span><div class="mmOpts">' + K.hangars.map(g => '<button type="button" class="mmOpt' + ((st.mhangar || 'HOME') === g.id ? ' on' : '') + '" data-hangar="' + esc(g.id) + '">' +
      esc(g.main ? 'the main hangar' : g.id + ' at ' + aeroName(M, g.base)) + (g.main ? '' : ' <i>+ delivery</i>') + '</button>').join('') + '</div></div>';
    else h += '<p class="mmFine">Delivered to the main hangar at ' + esc(aeroName(M, 'HOME')) + '.</p>';
    const stock = S.rows.every(r => r.cosmetic || r.vals.find(v => v.on).price === 0);
    const vch = K.voucher && !K.voucher.used && K.voucher.model === S.design && stock;
    h += '<h3>Price</h3><p class="mmPay"><b>' + fmt(vch ? 0 : S.price.total) + '</b>' + (vch ? ' <span>the voucher pays this one (a stock ' + esc(S.name) + ')</span>' : '') + '</p>' +
      '<p class="mmFine">' + esc(S.price.lines.map(l => (l.row === 'model' ? 'the stock model ' : l.row + ' ') + money(l.price)).join(' · ')) + (K.econ === 'stub' ? ' · the price book is a stand-in until the economy lands' : '') + '</p>';
    if (st.msg && st.msgFor === 'm:' + id) h += '<p class="mmMsg' + (st.msgOk ? ' ok' : '') + '">' + esc(st.msg) + '</p>';
    h += '<div class="mmActs"><button type="button" class="mmBtn pri" data-act="buy">' + esc(buyWord(K, vch ? 0 : S.price.total)) + '</button></div></div>';
    return h;
  }
  function usedCardHTML(M, st, id) {
    const K = MK(M), L = K.used.find(x => x.id === id);
    if (!L) return '<div class="mmCard"><h2>Sold</h2><p class="mmFine">This aeroplane is no longer for sale.</p></div>';
    let h = '<div class="mmCard">' + (st.phone ? '<button type="button" class="mmBack" data-act="back">‹ the list</button>' : '') +
      '<div class="mmProv"><i class="mmChip" style="background:' + esc(L.colour) + '">' + USED_GLYPH + '</i>used · ' + esc(L.name) + '</div>' +
      '<h2>' + esc(L.words.title) + '</h2><p class="mmBrief">' + esc(L.words.seller) + '</p>';
    h += '<div class="mmLeg">' + endHTML(M, 'it stands at', L.aero) + '</div>';
    h += '<h3>Its history</h3><ul class="mmCrit">' + L.words.facts.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>';
    h += '<h3>Its certificate</h3><p class="mmFine">The maker\'s, as the first owner chose it' + (L.kg ? ', the extra kilos counted' : '') + '.</p>' + certHTML(L.cert);
    h += '<h3>Price</h3><p class="mmPay"><b>' + fmt(L.price) + '</b> <span>(' + fmt(L.catalogue) + ' new × ' + Math.round(L.condition * 100) + ' % for its condition)</span></p>';
    h += '<p class="mmFine">Bought where it stands: it becomes yours at ' + esc(aeroName(M, L.aero)) + '. Fly it home, or bring it home (free).</p>';
    h += '<div class="mmOptRow"><span class="mmK">its name in your hangar</span><input class="mmIn" data-in="slot" value="' + esc(st.mname || '') + '" placeholder="' + esc(L.name + ' ' + L.opts.reg) + '" autocomplete="off"></div>';
    if (st.msg && st.msgFor === 'u:' + id) h += '<p class="mmMsg' + (st.msgOk ? ' ok' : '') + '">' + esc(st.msg) + '</p>';
    h += '<div class="mmActs"><button type="button" class="mmBtn pri" data-act="buy">' + esc(K.mode === 'career' ? 'Buy where it stands · ' + fmt(L.price) : 'Take it where it stands · free in the sandbox') + '</button></div></div>';
    return h;
  }
  // the listings on the map, at their aerodrome (shown with the Market tab or a listing selected)
  function marketMarkers(M, st) {
    const K = MK(M), out = [];
    if (!K || !(st.tab === 'market' || /^[mu]:/.test(st.sel || ''))) return out;
    const selU = (st.sel || '').startsWith('u:') ? st.sel.slice(2) : null;
    for (const L of K.used) { const a = M.aeros[L.aero]; if (!a) continue;
      out.push({ key: 'u:' + L.id, sel: 'u:' + L.id, kind: 'used', aero: L.aero, x: a.x, z: a.z, label: L.words.title, colour: L.colour, glyph: USED_GLYPH, on: selU === L.id, dim: !!selU && selU !== L.id }); }
    return out;
  }

  const CORE = { PAX_KG, mapAdapt, whereOf, rowsOf, rowWord, factsFor, critFor, critsOf, designsOf, fitOf, allows, payOf, payWord, pinOf, subsNow, stageOf, CRIT_BY,
                 markersOf, routesOf, act, tabsHTML, listHTML, cardHTML, statusHTML, layersHTML, whereWord, LAYERS, TABS_ASSET,
                 marketAdapt, marketListHTML, modelCardHTML, usedCardHTML, marketMarkers, certRows };
  if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
  if (!W || !W.document) return;

  // =================================================================================================================
  // THE DOM HALF
  // =================================================================================================================
  const D = W.document;
  // THE ONE SOURCE LINE (G2320): the real record - the page's dev career (?career=1: FLYDIY_CAREER.record(), the
  // career document through careerMapRecord), else a NEW career's offers in memory (careerNew; nothing is saved);
  // ?mapsrc=fixture (or a page without the career core) reads the fixture, as MAP-MENU's stills do
  const fixture = () => fetch((W.FLYDIY_MAP_SRC && W.FLYDIY_MAP_SRC.fixture) || 'tools/fixtures/contracts_sample.json').then(r => r.json());
  const MAP_SOURCE = () => /[?&]mapsrc=fixture(&|$)/.test((W.location && W.location.search) || '') ? fixture()
    : W.FLYDIY_CAREER && W.FLYDIY_CAREER.record ? Promise.resolve().then(() => W.FLYDIY_CAREER.record())
    : (typeof careerMapRecord === 'function' && typeof careerNew === 'function') ? Promise.resolve().then(() => careerMapRecord(careerNew({ id: 'preview', seed: 'dev' }), null, {}))
    : fixture();

  const CSS = `
#mapScreen{--mm-bg:#1c1814;--mm-bg2:#26211c;--mm-line:rgba(255,238,214,.13);--mm-ink:#f3ece2;--mm-mid:#b9ac9c;--mm-dim:#857a6e;--mm-acc:#ffb257;--mm-ok:#63d3cc;--mm-no:#ff8a6e;
  position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:var(--mm-bg);color:var(--mm-ink);font:400 14px/1.35 'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;user-select:none;-webkit-user-select:none}
#mapScreen *{box-sizing:border-box}
#mapScreen button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;border-radius:0;box-shadow:none;min-width:0;text-transform:none;letter-spacing:normal;backdrop-filter:none;-webkit-backdrop-filter:none;transition:none;transform:none;cursor:pointer;text-align:left}
#mapScreen button:focus-visible{outline:2px solid var(--mm-acc);outline-offset:-2px}
#mapScreen .mmTop{display:flex;align-items:center;gap:12px;height:56px;padding:0 8px 0 16px;border-bottom:1px solid var(--mm-line);flex:none}
#mapScreen .mmTop h1{margin:0;font:600 13px/1 'IBM Plex Sans';letter-spacing:.16em;text-transform:uppercase;color:var(--mm-mid);flex:1}
#mapScreen .mmTop h1 b{color:var(--mm-ink);font-weight:600}
#mapScreen .mmClose{min-width:48px;height:48px;border-radius:8px;text-align:center;font-size:22px;color:var(--mm-mid)}
#mapScreen .mmBody{flex:1;display:flex;min-height:0}
#mapScreen .mmLeft{width:380px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--mm-line);min-height:0}
#mapScreen .mmRight{width:360px;flex:none;border-left:1px solid var(--mm-line);overflow-y:auto;touch-action:pan-y}
#mapScreen .mmTabs{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px 0}
#mapScreen .mmAssets{padding-bottom:10px;border-bottom:1px solid var(--mm-line)}
#mapScreen .mmTab{flex:none;min-height:48px;min-width:48px;padding:0 12px;border-radius:24px;border:1px solid var(--mm-line);display:inline-flex;align-items:center;gap:6px;color:var(--mm-mid);font-weight:500;white-space:nowrap}
#mapScreen .mmTab.on{border-color:var(--mm-acc);color:var(--mm-acc)}
#mapScreen .mmN{font-size:12px;color:var(--mm-dim)}
#mapScreen .mmDot{width:9px;height:9px;border-radius:50%;display:inline-block}
#mapScreen .mmList{flex:1;overflow-y:auto;padding:6px 0;touch-action:pan-y}
#mapScreen .mmRow{display:flex;flex-direction:column;justify-content:center;gap:3px;width:100%;min-height:60px;padding:8px 14px;border-left:3px solid transparent}
#mapScreen .mmRow.on{background:var(--mm-bg2);border-left-color:var(--mm-acc)}
#mapScreen .mmRowT{display:flex;align-items:center;gap:8px}
#mapScreen .mmRowT b{font-weight:500;flex:1}
#mapScreen .mmRowT em{font-style:normal;font-size:12px;color:var(--mm-mid)}
#mapScreen .mmRowT em.mmTrk{color:var(--mm-acc)}
#mapScreen .mmRowS{font-size:12.5px;color:var(--mm-mid);padding-left:30px}
#mapScreen .mmChip{width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:12px;color:#1c1814;flex:none}
#mapScreen .mmGlyph{width:22px;text-align:center;font-style:normal;color:var(--mm-mid);flex:none}
#mapScreen .mmEmpty{padding:28px 18px;display:flex;flex-direction:column;gap:6px;color:var(--mm-mid)}
#mapScreen .mmEmpty b{color:var(--mm-ink);font-weight:500}
#mapScreen .mmMap{flex:1;position:relative;overflow:hidden;background:#9db6c2;touch-action:none;cursor:grab}
#mapScreen .mmPlane{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
#mapScreen .mmPlane img{display:block;image-rendering:auto;pointer-events:none}
#mapScreen .mmSvg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#mapScreen .mmMarks{position:absolute;inset:0;pointer-events:none}
#mapScreen .mmMk{position:absolute;width:48px;height:48px;margin:-24px 0 0 -24px;pointer-events:auto;display:flex;align-items:center;justify-content:center;text-align:center}
#mapScreen .mmMk i{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;color:#1c1814;border:2px solid #1c1814;box-shadow:0 1px 3px rgba(0,0,0,.35)}
#mapScreen .mmMk.fleet i{border-radius:7px;background:#f3ece2;color:#1c1814}
#mapScreen .mmMk.dest i{background:#f3ece2 !important;color:#1c1814}
#mapScreen .mmMk.on i{width:36px;height:36px;font-size:16px;border:3px solid var(--mm-acc)}
#mapScreen .mmMk.trk i{border-color:var(--mm-acc)}
#mapScreen .mmMk.dim{opacity:.45}
#mapScreen .mmMk span{position:absolute;top:44px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11.5px;font-weight:500;color:#1c1814;background:rgba(250,247,240,.88);padding:1px 6px;border-radius:4px}
#mapScreen .mmLbl{position:absolute;pointer-events:none;white-space:nowrap;font-size:11.5px;line-height:1.3;color:#1c1814;background:rgba(250,247,240,.84);padding:2px 6px;border-radius:4px}
#mapScreen .mmLbl.end{background:#faf7f0;box-shadow:0 0 0 2px var(--mm-acc)}
#mapScreen .mmLbl b{font-weight:600;display:block}
#mapScreen .mmLbl.plot{background:rgba(176,96,52,.92);color:#fff}
#mapScreen .mmLbl.water b::after{content:' ≈'}
#mapScreen .mmCtl{position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column;gap:8px}
#mapScreen .mmCtl button,#mapScreen .mmLay{min-width:48px;height:48px;border-radius:8px;background:rgba(28,24,20,.86);color:var(--mm-ink);text-align:center;font-weight:500;padding:0 12px}
#mapScreen .mmLayers{position:absolute;left:12px;top:12px;display:flex;gap:8px;flex-wrap:wrap;max-width:calc(100% - 24px)}
#mapScreen .mmLay{color:var(--mm-mid);border:1px solid transparent}
#mapScreen .mmLay.on{color:var(--mm-acc);border-color:var(--mm-acc)}
#mapScreen .mmStatus{flex:none;display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;min-height:44px;padding:6px 16px;border-top:1px solid var(--mm-line);font-size:13px}
#mapScreen .mmStatus b{font-weight:500;margin-right:14px}
#mapScreen .mmK{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mm-dim)}
#mapScreen .mmTrkLine{color:var(--mm-acc)}
#mapScreen .mmCard{padding:14px 16px 24px}
#mapScreen .mmCard h2{margin:6px 0 6px;font:600 19px/1.25 'IBM Plex Sans'}
#mapScreen .mmCard h3{margin:18px 0 8px;font:600 11px/1 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:var(--mm-mid)}
#mapScreen .mmProv{display:flex;align-items:center;gap:8px;color:var(--mm-mid);font-size:13px}
#mapScreen .mmBrief{margin:0 0 4px;color:var(--mm-ink)}
#mapScreen .mmFine{margin:6px 0;color:var(--mm-mid);font-size:12.5px}
#mapScreen .mmStages{margin:10px 0 0;padding-left:20px;color:var(--mm-dim);font-size:12.5px}
#mapScreen .mmStages li.now{color:var(--mm-acc)}
#mapScreen .mmStages li.done{text-decoration:line-through}
#mapScreen .mmLeg{border:1px solid var(--mm-line);border-radius:8px;padding:10px 12px;margin:0 0 8px;display:flex;flex-direction:column;gap:8px}
#mapScreen .mmDo{font-weight:500}
#mapScreen .mmEnd{display:flex;flex-direction:column}
#mapScreen .mmEnd b{font-weight:500}
#mapScreen .mmEnd span:last-child{color:var(--mm-mid);font-size:12.5px}
#mapScreen .mmPay{margin:0;font-size:15px}
#mapScreen .mmPay b{font-size:20px;font-weight:600}
#mapScreen .mmPay span{color:var(--mm-mid);font-size:12.5px}
#mapScreen .mmFit{padding:8px 0;border-top:1px solid var(--mm-line)}
#mapScreen .mmFit>b{font-weight:600;margin-right:8px}
#mapScreen .mmFit>span{color:var(--mm-mid);font-size:12.5px}
#mapScreen .mmFit ul,#mapScreen .mmCrit,#mapScreen .mmCert,#mapScreen .mmJobs{list-style:none;margin:4px 0 0;padding:0;font-size:13px}
#mapScreen .mmFit li{padding:2px 0}
#mapScreen li.ok{color:var(--mm-ok)} #mapScreen li.no{color:var(--mm-no)} #mapScreen li.fly{color:var(--mm-mid)}
#mapScreen .mmCrit li{padding:3px 0}
#mapScreen .mmBy{font-size:11px;color:var(--mm-dim);text-transform:uppercase;letter-spacing:.1em;margin-left:6px}
#mapScreen .mmCert li{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--mm-line)}
#mapScreen .mmCert span{color:var(--mm-mid)}
#mapScreen .mmLink{min-height:48px;width:100%;color:inherit}
#mapScreen .mmActs{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
#mapScreen .mmBtn{min-height:48px;padding:0 16px;border-radius:9px;border:1px solid var(--mm-line);background:var(--mm-bg2);font-weight:500;text-align:center}
#mapScreen .mmBtn.pri{background:var(--mm-acc);color:#2c1a06;border-color:transparent}
#mapScreen .mmBtn.on{border-color:var(--mm-acc);color:var(--mm-acc)}
#mapScreen .mmBtn.pri.on{background:var(--mm-bg2)}
#mapScreen .mmBtn:disabled{opacity:.5;cursor:default}
#mapScreen .mmBack{min-height:48px;padding:0 12px 0 0;color:var(--mm-acc);font-weight:500}
#mapScreen .mmIdle p{color:var(--mm-mid)}
/* THE MARKET (G2280 PROCURE): the options are 48 px chips, the inputs 48 px; the listings' badges beside a field */
#mapScreen .mmSect{padding:14px 14px 4px;font:600 11px/1 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:var(--mm-dim)}
#mapScreen .mmOptRow{display:flex;flex-direction:column;gap:6px;margin:10px 0}
#mapScreen .mmOpts{display:flex;flex-wrap:wrap;gap:8px}
#mapScreen .mmOpt{min-height:48px;padding:0 12px;border-radius:9px;border:1px solid var(--mm-line);background:var(--mm-bg2);font-size:13px;text-align:center}
#mapScreen .mmOpt.on{border-color:var(--mm-acc);color:var(--mm-acc)}
#mapScreen .mmOpt i{font-style:normal;color:var(--mm-mid);font-size:12px}
#mapScreen .mmIn{min-height:48px;padding:0 12px;border-radius:9px;border:1px solid var(--mm-line);background:var(--mm-bg2);color:var(--mm-ink);font:inherit;width:100%;user-select:text;-webkit-user-select:text}
#mapScreen .mmMsg{margin:12px 0 0;padding:10px 12px;border-radius:8px;background:var(--mm-bg2);color:var(--mm-no)}
#mapScreen .mmMsg.ok{color:var(--mm-ok)}
#mapScreen .mmMk.used i{border-radius:6px}
#mapScreen .mmBoard{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 14px;min-height:60px}
#mapScreen .mmBoard .mmRowT{flex:1;min-width:0}
#mapScreen .mmBoard em{font-style:normal;font-size:12px;color:var(--mm-mid)}
#mapScreen .mmList>.mmMsg,#mapScreen .mmSheetBody>.mmMsg{margin:8px 14px}
/* THE PHONE (GQ19): the map full, the list a bottom sheet over it; the map and the sheet never share a gesture (R20) */
#mapScreen.mmPhone .mmTop{position:absolute;top:0;right:0;left:auto;height:auto;border:0;padding:8px;z-index:3}
#mapScreen.mmPhone .mmTop h1{display:none}
#mapScreen.mmPhone .mmClose{background:rgba(28,24,20,.86)}
#mapScreen.mmPhone .mmBody{position:relative}
#mapScreen.mmPhone .mmLeft{display:none}
#mapScreen.mmPhone .mmRight{display:none}
#mapScreen.mmPhone .mmStatus{display:none}
#mapScreen.mmPhone .mmLayers{top:8px;left:8px;right:72px;flex-wrap:nowrap;overflow-x:auto;touch-action:pan-x;max-width:none;scrollbar-width:none}
#mapScreen.mmPhone .mmCtl{bottom:auto;top:72px;right:8px}
#mapScreen .mmSheet{display:none}
#mapScreen.mmPhone .mmSheet{display:flex;flex-direction:column;position:absolute;left:0;right:0;bottom:0;height:184px;background:var(--mm-bg);border-radius:16px 16px 0 0;box-shadow:0 -6px 20px rgba(0,0,0,.35);z-index:4;transition:height .18s ease-out}
#mapScreen.mmPhone .mmSheet.open{height:64%}
#mapScreen .mmHandle{flex:none;height:48px;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;touch-action:none;text-align:center}
#mapScreen .mmHandle i{width:44px;height:5px;border-radius:3px;background:var(--mm-dim)}
#mapScreen .mmHandle span{font-size:11.5px;color:var(--mm-mid)}
#mapScreen .mmSheetTabs{flex:none;display:flex;gap:8px;overflow-x:auto;padding:0 12px 8px;touch-action:pan-x;scrollbar-width:none}
#mapScreen .mmSheetTabs .mmTabs{display:contents}
#mapScreen .mmSheetBody{flex:1;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;border-top:1px solid var(--mm-line)}
#mapScreen .mmSheetBody .mmCard{padding-top:4px}
`;

  // G2280 (PROCURE): the core's procurement functions are the page's globals (the core bundle); the page's doors to
  // the player's document and the slots are window.FLYDIY_PROCURE (app.js, only under ?map=1 / ?career=1)
  // (an explicit namespace: the core's top-level `const`s are global LEXICAL bindings - visible to this script, never
  // properties of the window)
  const marketCore = () => (typeof procureCatalogue === 'function' && typeof PROCURE_MODELS !== 'undefined' ? {
    procureCatalogue, procureText, procureSheet, procureMarketOf, procureUsedWords, procureUsedCert, procureEconSource,
    PROCURE_MAKERS, PROCURE_MODELS } : null);
  let lastRaw = null;
  const boardNow = () => { try { return W.FLYDIY_PROCURE && W.FLYDIY_PROCURE.board ? W.FLYDIY_PROCURE.board() : null; } catch (e) { return null; } };
  let root = null, M = null, pack = null, st = null, V = { s: 1, tx: 0, ty: 0, fit: 1 }, $ = {}, dragMoved = 0;
  const isPhone = () => !!((D.documentElement.classList && D.documentElement.classList.contains('phone')) || (W.matchMedia && W.matchMedia('(max-width: 760px)').matches));

  function build() {
    if (!D.getElementById('mapScreenCss')) { const s = D.createElement('style'); s.id = 'mapScreenCss'; s.textContent = CSS; D.head.appendChild(s); }
    root = D.createElement('div'); root.id = 'mapScreen'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'the island map and the contracts');
    root.innerHTML =
      '<div class="mmTop"><h1><b>The island</b> · contracts and your fleet</h1><button type="button" class="mmClose" data-act="close" aria-label="close the map">✕</button></div>' +
      '<div class="mmBody">' +
        '<div class="mmLeft"><div class="mmTabsHost"></div><div class="mmList"></div></div>' +
        '<div class="mmMap"><div class="mmPlane"><img alt="the island" draggable="false"></div><svg class="mmSvg" xmlns="http://www.w3.org/2000/svg"></svg><div class="mmMarks"></div>' +
          '<div class="mmLayersHost"></div><div class="mmCtl"><button type="button" data-act="zin" aria-label="zoom in">+</button><button type="button" data-act="zout" aria-label="zoom out">−</button><button type="button" data-act="fit" aria-label="the whole island">⤢</button></div></div>' +
        '<div class="mmRight"></div>' +
        '<div class="mmSheet"><button type="button" class="mmHandle" data-act="sheet" aria-label="the list: open or fold"><i></i><span></span></button><div class="mmSheetTabs"></div><div class="mmSheetBody"></div></div>' +
      '</div><div class="mmStatus"></div>';
    D.body.appendChild(root);
    for (const k of ['mmList', 'mmMap', 'mmPlane', 'mmSvg', 'mmMarks', 'mmRight', 'mmStatus', 'mmTabsHost', 'mmLayersHost', 'mmSheet', 'mmSheetTabs', 'mmSheetBody'])
      $[k] = root.querySelector('.' + k);
    $.img = root.querySelector('.mmPlane img');
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    wireMap();
    wireSheet();
  }

  // ---- RENDER ----
  function render() {
    root.classList.toggle('mmPhone', st.phone);
    if (st.phone) {
      $.mmSheet.classList.toggle('open', st.sheet === 'open');
      $.mmSheetTabs.innerHTML = tabsHTML(M, st);
      $.mmSheetBody.innerHTML = st.detail && st.sel ? cardHTML(M, st) : listHTML(M, st);
      root.querySelector('.mmHandle span').textContent = st.sheet === 'open' ? 'fold the list' : (st.detail && st.sel ? 'the card' : 'the list') + ' · open';
    } else {
      $.mmTabsHost.innerHTML = tabsHTML(M, st);
      $.mmList.innerHTML = listHTML(M, st);
      $.mmRight.innerHTML = cardHTML(M, st);
      $.mmStatus.innerHTML = statusHTML(M);
    }
    $.mmLayersHost.innerHTML = layersHTML(st);
    place();
  }
  const toScr = (x, z) => [V.tx + ((x - pack.x0) / pack.mpp) * V.s, V.ty + ((z - pack.z0) / pack.mpp) * V.s];
  function place() {
    if (!pack) return;
    $.mmPlane.style.transform = 'translate(' + V.tx + 'px,' + V.ty + 'px) scale(' + V.s + ')';
    const mk = markersOf(M, st), near = V.s >= V.fit * 1.6;
    // THE LABELS KEEP OUT OF EACH OTHER'S WAY: the badges stand first (obstacles), then the labels by priority - the
    // selection's two ends, then the fields, then the plots - each at the first free side (right, left, below, above),
    // else not drawn at this zoom (a zoom brings it back); a field's strip line shows near, or for the selection's ends
    const MW = $.mmMap.clientWidth || 1e4, MH = $.mmMap.clientHeight || 1e4;   // a label that would leave the map counts as a collision
    const boxes = [], hit = b => b[0] < 2 || b[2] > MW - 2 || b[1] < 2 || b[3] > MH - 2 || boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const ends = new Set(); { const c = (st.sel || '').startsWith('c:') ? M.contracts.find(x => 'c:' + x.id === st.sel) : null; if (c) for (const u of subsNow(M, c)) { if (u.from) ends.add(u.from); if (u.to) ends.add(u.to); } }
    let h = '';
    const badges = mk.filter(m => m.kind !== 'field' && m.kind !== 'plot'), labels = mk.filter(m => m.kind === 'field' || m.kind === 'plot');
    for (const m of badges) {
      let [x, y] = toScr(m.x, m.z);
      if (m.kind === 'contract') { x += (m.slot - (m.of - 1) / 2) * 34; y -= 30; }
      if (m.kind === 'fleet') { x += (m.slot - (m.of - 1) / 2) * 34; y += 30; }
      if (m.kind === 'used') { x += 40 + m.slot * 34; }
      boxes.push([x - 16, y - 16, x + 16, y + 16]);
      const named = m.on || (m.kind === 'fleet' && near);
      if (named) boxes.push([x - m.label.length * 3.6 - 8, y + 20, x + m.label.length * 3.6 + 8, y + 40]);
      h += '<button type="button" class="mmMk ' + m.kind + (m.on ? ' on' : '') + (m.trk ? ' trk' : '') + (m.dim ? ' dim' : '') + '" data-sel="' + esc(m.sel || '') + '" data-mk="' + esc(m.key) + '" aria-label="' + esc(m.label) +
        '" style="left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px"><i' + (m.colour ? ' style="background:' + esc(m.colour) + '"' : '') + '>' + esc(m.glyph) + '</i>' +
        (named ? '<span>' + esc(m.label) + '</span>' : '') + '</button>';
    }
    const pri = m => (ends.has(m.aero) && m.kind === 'field' ? 0 : m.kind === 'field' ? 1 : 2);
    for (const m of labels.sort((a, b) => pri(a) - pri(b))) {
      const [x, y] = toScr(m.x, m.z), sub = m.kind === 'plot' ? near : (near || ends.has(m.aero));
      const w = Math.max(m.label.length, sub ? (m.sub || '').length : 0) * 6.4 + 14, hh = sub ? 34 : 19;
      const at = [[x + 10, y - hh / 2], [x - 10 - w, y - hh / 2], [x - w / 2, y + 14], [x - w / 2, y - 14 - hh]];
      let k = at.find(([l, t]) => !hit([l, t, l + w, t + hh]));
      if (!k) { if (pri(m) > 0) continue; k = at[0]; }
      boxes.push([k[0], k[1], k[0] + w, k[1] + hh]);
      h += '<div class="mmLbl ' + (m.kind === 'plot' ? 'plot' : m.cls === 'water' ? 'water' : '') + (ends.has(m.aero) && m.kind === 'field' ? ' end' : '') + '" style="left:' + k[0].toFixed(1) + 'px;top:' + k[1].toFixed(1) + 'px"><b>' + esc(m.label) + '</b>' + (sub ? esc(m.sub || '') : '') + '</div>';
    }
    $.mmMarks.innerHTML = h;
    // the routes: from the load (dot) to where it goes (arrow), the selection bold, the tracked thin and dashed
    let s = '<defs><marker id="mmArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1c1814"/></marker></defs>';
    for (const r of routesOf(M, st)) {
      const [ax, ay] = toScr(r.ax, r.az), [bx, by] = toScr(r.bx, r.bz);
      s += '<line x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + bx.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="#1c1814" stroke-width="' + (r.bold ? 6 : 3) + '" stroke-linecap="round" opacity=".55"/>' +
        '<line x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + bx.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="' + esc(r.colour) + '" stroke-width="' + (r.bold ? 3.5 : 2) + '" stroke-linecap="round"' + (r.bold ? '' : ' stroke-dasharray="7 6"') + ' marker-end="url(#mmArr)"/>';
    }
    $.mmSvg.innerHTML = s;
  }

  // ---- THE VIEW: fit, pan, zoom (one finger / the mouse pans, two fingers pinch, the wheel zooms at the cursor) ----
  const clampS = s => Math.max(V.fit * 0.8, Math.min(4, s));
  function fit() {
    const r = $.mmMap.getBoundingClientRect(), sheet = st.phone ? 184 : 0, h = Math.max(100, r.height - sheet);
    V.fit = Math.min(r.width / pack.w, h / pack.h);
    V.s = V.fit; V.tx = (r.width - pack.w * V.s) / 2; V.ty = (h - pack.h * V.s) / 2;
    place();
  }
  function zoomAt(cx, cy, k) { const s2 = clampS(V.s * k); V.tx = cx - (cx - V.tx) * s2 / V.s; V.ty = cy - (cy - V.ty) * s2 / V.s; V.s = s2; place(); }
  function focus(x, z) {
    const r = $.mmMap.getBoundingClientRect(), [sx, sy] = toScr(x, z), cy = st.phone ? (r.height - (st.sheet === 'open' ? r.height * 0.64 : 184)) / 2 : r.height / 2;
    if (sx < 60 || sx > r.width - 60 || sy < 60 || sy > cy * 2 - 40) { V.tx += r.width / 2 - sx; V.ty += cy - sy; place(); }
  }
  function wireMap() {
    const el = $.mmMap, P = new Map(); let drag = null, pinch = null;
    const rel = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('.mmLayers,.mmCtl')) return;
      P.set(e.pointerId, rel(e));
      if (P.size === 1) { drag = { p: rel(e), tx: V.tx, ty: V.ty, moved: false, id: e.pointerId }; }
      if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: V.s, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, tx: V.tx, ty: V.ty }; drag = null; }
    });
    el.addEventListener('pointermove', e => {
      if (!P.has(e.pointerId)) return;
      P.set(e.pointerId, rel(e));
      if (pinch && P.size >= 2) {
        const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const s2 = clampS(pinch.s * d / pinch.d);
        V.tx = mx - (pinch.mx - pinch.tx) * s2 / pinch.s; V.ty = my - (pinch.my - pinch.ty) * s2 / pinch.s; V.s = s2; dragMoved = Date.now(); place(); return;
      }
      if (drag) {
        const [x, y] = rel(e), dx = x - drag.p[0], dy = y - drag.p[1];
        // the capture is taken once it IS a drag (4 px), never on the press: a tap on a marker stays the marker's click
        if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; try { el.setPointerCapture(e.pointerId); } catch (err) {} }
        if (drag.moved) { V.tx = drag.tx + dx; V.ty = drag.ty + dy; dragMoved = Date.now(); place(); }
      }
    });
    const up = e => { P.delete(e.pointerId); if (P.size < 2) pinch = null; if (P.size === 1) { const [id, p] = [...P.entries()][0]; drag = { p, tx: V.tx, ty: V.ty, moved: true, id }; } if (!P.size) drag = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = rel(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }
  // the sheet's handle: a tap folds or opens it; a swipe on the handle does the same by its direction (never the map's)
  function wireSheet() {
    const h = root.querySelector('.mmHandle'); let y0 = null;
    h.addEventListener('pointerdown', e => { y0 = e.clientY; try { h.setPointerCapture(e.pointerId); } catch (err) {} });
    h.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (Math.abs(dy) > 24) { st.sheet = dy < 0 ? 'open' : 'peek'; h.dataset.swiped = '1'; render(); } });
  }

  function select(sel, from) {
    st.sel = sel;
    if (sel && sel.startsWith('f:') && st.tab !== 'fleet' && from !== 'marker') st.tab = 'fleet';
    if (sel && sel.startsWith('c:')) {
      const c = M.contracts.find(x => 'c:' + x.id === sel);
      if (c && st.tab !== 'all' && st.tab !== c.provider) st.tab = st.tab === 'fleet' && from === 'card' ? c.provider : 'all';
      if (st.tab === 'pilots' || st.tab === 'market') st.tab = 'all';
      const at = c && M.aeros[pinOf(M, c)]; if (at && from === 'row') focus(at.x, at.z);
    }
    if (sel && /^[mu]:/.test(sel)) {     // G2280 (PROCURE): a model or a listing lives on the Market tab
      st.tab = 'market'; st.msg = ''; st.mname = '';
      const L = sel.startsWith('u:') && M.market ? M.market.used.find(x => 'u:' + x.id === sel) : null, a = L && M.aeros[L.aero];
      if (a && from === 'row') focus(a.x, a.z);
    }
    if (sel && sel.startsWith('f:') && from === 'row') { const f = M.fleet.find(x => 'f:' + x.slot === sel), a = f && M.aeros[f.where.aero]; if (a) focus(a.x, a.z); }
    if (st.phone) { st.detail = !!sel; if (sel && from === 'marker') st.sheet = 'open'; }
    render();
    // the row the marker named, brought into view (desktop: the list; the phone shows its card)
    if (!st.phone && sel) { const r = $.mmList.querySelector('[data-sel="' + (W.CSS && W.CSS.escape ? W.CSS.escape(sel) : sel) + '"]'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); }
  }
  function onClick(e) {
    const t = e.target.closest ? e.target.closest('button') : null; if (!t || !root.contains(t) || t.disabled) return;
    if (t.classList.contains('mmMk') && Date.now() - dragMoved < 250) return;   // the end of a pan is not a tap
    const a = t.dataset.act;
    if (a === 'close') return close();
    if (a === 'zin' || a === 'zout') { const r = $.mmMap.getBoundingClientRect(); return zoomAt(r.width / 2, r.height / 2, a === 'zin' ? 1.5 : 1 / 1.5); }
    if (a === 'fit') return fit();
    if (a === 'sheet') { if (t.dataset.swiped) { delete t.dataset.swiped; return; } st.sheet = st.sheet === 'open' ? 'peek' : 'open'; return render(); }
    if (a === 'back') { st.detail = false; return render(); }
    if ((a === 'accept' || a === 'track') && (st.sel || '').startsWith('c:')) {
      // (G2320) the dev career: Accept / Track write the career document (careerAccept / careerTrack), and the screen
      // reads the record back; elsewhere they live in the session's adapted record, as before
      if (M.source === 'career' && W.FLYDIY_CAREER && W.FLYDIY_CAREER.act) {
        const raw = W.FLYDIY_CAREER.act(st.sel.slice(2), a);
        if (raw) { let live = null; try { live = W.FLYDIY_PLAYER && W.FLYDIY_PLAYER.doc ? W.FLYDIY_PLAYER.doc() : null; } catch (err) {} lastRaw = raw; M = mapAdapt(raw, pack, live); M.market = marketAdapt(marketCore(), live, boardNow()); }
        return render();
      }
      act(M, st.sel.slice(2), a); return render();
    }
    if (t.dataset.tab) { st.tab = t.dataset.tab; if (st.phone) st.detail = false; return render(); }
    // G2280 (PROCURE): an option chosen, a hangar to deliver to, Buy / Take
    if (t.dataset.opt) { const [id, row, val] = t.dataset.opt.split(':'); st.mopts = st.mopts || {}; st.mopts[id] = Object.assign({}, st.mopts[id] || {}, { [row]: val }); st.msg = ''; return render(); }
    if (t.dataset.hangar) { st.mhangar = t.dataset.hangar; return render(); }
    if (a === 'buy') return marketBuy();
    if (t.dataset.board) return boardAct(t.dataset.board, t.dataset.slot);
    if (t.dataset.layer) { st.layers[t.dataset.layer] = !st.layers[t.dataset.layer]; return render(); }
    if (t.dataset.sel !== undefined) {
      const s = t.dataset.sel || null; if (!s) return;
      const from = t.classList.contains('mmMk') ? 'marker' : t.classList.contains('mmLink') ? 'card' : 'row';
      return select(st.sel === s && from === 'row' && !st.phone ? null : s, from);
    }
  }
  // BUY (the career) / TAKE (the sandbox, free): the page's door writes the slot and the document; the screen reads both back
  function marketBuy() {
    const sel = st.sel || '', Pg = W.FLYDIY_PROCURE, K = M && M.market;
    const say = (ok, msg) => { st.msg = msg; st.msgOk = ok; st.msgFor = sel; render(); };
    if (!K) return;
    if (!Pg) return say(false, 'Buying needs the game page: ?map=1 (the sandbox, free) or ?career=1 (the career).');
    const id = sel.slice(2), isM = sel.startsWith('m:');
    const L = isM ? null : K.used.find(x => x.id === id);
    const base = (st.mname || '').trim() || (isM ? K.P.procureText(K.P.PROCURE_MODELS[id].name) : (L ? L.name + ' ' + L.opts.reg : 'used'));
    const slot = (st.mname || '').trim() ? base : Pg.freeName(base);
    const p = isM ? Pg.buyModel(id, optsOf(st, id), { slot, hangar: st.mhangar || 'HOME' }) : Pg.buyUsed(id, { slot });
    return Promise.resolve(p).then(r => {
      if (!r || !r.ok) return say(false, (r && r.why) || 'not bought');
      let live = null; try { live = W.FLYDIY_PLAYER.doc(); } catch (e) {}
      const raw = (M.source === 'career' && W.FLYDIY_CAREER && W.FLYDIY_CAREER.record) ? W.FLYDIY_CAREER.record() : lastRaw;
      lastRaw = raw; M = mapAdapt(raw, pack, live); M.market = marketAdapt(marketCore(), live, boardNow());
      st.mname = '';
      say(true, '"' + r.slot + '" is yours: ' + (r.where || 'in your hangar') + (r.price ? ' · ' + (r.free ? 'taken free (the sandbox)' : 'paid ' + fmt(r.price)) : '') + '. It is on the Fleet tab.');
    }, e => say(false, (e && e.message) || 'not bought'));
  }
  function boardAct(what, slot) {
    const Pg = W.FLYDIY_PROCURE; if (!Pg || !slot) return;
    let r;
    if (what === 'build') r = Pg.buildDesign(slot);
    else { let n = slot + ' (design)', i = 2; const names = new Set(((M.market.board || {}).designs || []).map(d => d.name)); while (names.has(n)) n = slot + ' (design ' + i++ + ')'; r = Pg.saveDesign(slot, n); }
    let live = null; try { live = W.FLYDIY_PLAYER.doc(); } catch (e) {}
    const raw = (M.source === 'career' && W.FLYDIY_CAREER && W.FLYDIY_CAREER.record) ? W.FLYDIY_CAREER.record() : lastRaw;
    lastRaw = raw; M = mapAdapt(raw, pack, live); M.market = marketAdapt(marketCore(), live, boardNow());
    st.boardMsg = r.ok ? (what === 'build' ? '"' + slot + '" built: an airframe in the main hangar' + (r.price ? ' (' + fmt(r.price) + ')' : '') : 'filed as the design "' + r.name + '"') : r.why;
    st.boardOk = !!r.ok;
    render();
  }
  const onInput = e => {
    const t = e.target; if (!t || !t.dataset || !t.dataset.in) return;
    if (t.dataset.in === 'slot') st.mname = t.value;
    if (t.dataset.in === 'reg' && (st.sel || '').startsWith('m:')) { const id = st.sel.slice(2); st.mopts = st.mopts || {}; st.mopts[id] = Object.assign({}, st.mopts[id] || {}, { reg: t.value.toUpperCase() }); }
  };
  const onKey = e => { if (e.key === 'Escape' && root && root.parentNode) { e.stopPropagation(); close(); } };
  const onResize = () => { if (!root || !root.parentNode) return; const ph = isPhone(); if (ph !== st.phone) { st.phone = ph; render(); } fit(); };

  function open(opts) {
    opts = opts || {};
    pack = W.MAP_PACK;
    if (!pack) { console.warn('flyDiy: the map pack is not loaded'); return Promise.resolve(false); }
    if (!root) build();
    if (!root.parentNode) D.body.appendChild(root);
    st = st || { tab: 'all', sel: null, layers: { contracts: true, fleet: true, fields: true, plots: false }, sheet: 'peek', detail: false };
    st.phone = isPhone();
    $.img.width = pack.w; $.img.height = pack.h;
    if ($.img.getAttribute('src') !== pack.img) $.img.src = pack.img;
    W.addEventListener('keydown', onKey, true); W.addEventListener('resize', onResize);
    let live = null; try { live = W.FLYDIY_PLAYER && W.FLYDIY_PLAYER.doc ? W.FLYDIY_PLAYER.doc() : null; } catch (e) {}
    const src = opts.source === 'empty' ? Promise.resolve({ providers: [], contracts: [], fleet: [] }) : MAP_SOURCE();
    return src.then(raw => {
      lastRaw = raw;
      M = mapAdapt(raw, pack, opts.source === 'empty' ? null : live);
      try { M.market = marketAdapt(marketCore(), opts.source === 'empty' ? null : live, boardNow()); }      // G2280 (PROCURE)
      catch (e) { console.warn('flyDiy: the market did not build -', e && e.message); M.market = null; }
      render(); fit();   // the layout first (the phone's has no columns), then the fit
      return new Promise(res => { if ($.img.complete && $.img.naturalWidth) res(true); else { $.img.onload = () => res(true); $.img.onerror = () => res(false); } });
    }, err => { console.warn('flyDiy: the contracts did not load -', err && err.message); M = mapAdapt({}, pack, null); render(); fit(); return false; });
  }
  function close() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    W.removeEventListener('keydown', onKey, true); W.removeEventListener('resize', onResize);
    const b = D.getElementById('mapEntry'); if (b && b.focus) b.focus();
  }
  W.MAP_MENU = Object.assign({ open, close, isOpen: () => !!(root && root.parentNode), state: () => st, model: () => M, select: s => select(s, 'row'),
                               view: () => Object.assign({}, V), set: o => { Object.assign(st, o || {}); render(); } }, CORE);
})();
