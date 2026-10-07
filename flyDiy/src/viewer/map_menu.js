// map_menu.js - THE MAP SCREEN (G2324-G2329, MAP-SIMPLE; was G2252-G2256 MAP-MENU). The approved mock is the spec:
// futureDesigns/game/map-mock/contracts_mock.html, with GAME-2026-10-06.md §R.2 (the user's steer of 7 Oct, which
// supersedes §8.2-§8.3). One screen over the game, reduced to the minimum:
//
//   THE LIST IS THE WHOLE INTERFACE (no right panel). One row per contract: a dot in the contract TYPE's colour (cargo,
//     passengers, survey, build), the title, the pay, and a mark - ✓ / ✗ ONLY for the hard no-no's, surface against
//     gear (water vs wheels, land vs floats only), judged against the player's fleet; a build contract carries none.
//     A tap opens ONE short paragraph (who + what + pay; the runways condensed, "Jumbo Mine Street 250 × 18 m gravel →
//     Annette Dock 1 500 m water lane · 14 km"; the ✗'s reason) and ONE button, Track (accept and track are one gesture;
//     a second tap untracks). The customers are a FILTER (a select), not colours; a place tapped on the map filters the
//     list to the contracts involving it ("At <place> ✕"). Fleet / Pilots / Market are not on this screen.
//   THE MAP is the user's own AI painting of the island (map_bake.js ships it as media/map/jolene_art.<h8>.jpg, in the
//     projection's frame exactly), on its edge's sea colour, no border. Pan by a left-button drag anywhere (no image
//     drag, no text selection; a click counts only if the pointer barely moved), zoom by the wheel at the cursor, a
//     pinch, + / − / fit; kept in bounds; NO AUTO-ZOOM when a contract opens.
//   THE GAME DRAWS EVERY SITE (the painting's own runways drift ~0.5-0.8 km): a badge per place (airfield, strip,
//     seaplane base, mine, clearing, altiport) sized to the zoom and ringed in the open / tracked contract's type colour;
//     mid zoom the names and the places of interest; closer the runway facts; close up every runway at true scale (the
//     cleared surround and the surface; centreline and threshold bars on concrete, edge markers on gravel / grass, a
//     buoyed lane on water; the designators at both ends) - all read from the projection's aerodromes and the island
//     record, never typed here. The wildlife hotspots (the record's animal objects, as the in-game minimap marks them)
//     are green badges (blue at sea) from the second zoom step, their zone ring and count closer in. A place (badge,
//     name or runway) is a tap that filters the list.
//   THE INFRASTRUCTURE (G2435, MAP-INFRA; the user, 7 Oct: "represent the game infrastructure in there, like the roads,
//     village, and so on"): the projection's `infra` (map_bake.js: the island record through compose) drawn in ink over
//     the painting and under the sites - the settlements as warm tinted areas (harbour, industry, parks their own tint),
//     the roads as cased lines (a light core over a darker edge; the main ones bold ochre, tracks dashed), the tramway as
//     a cable with its ticks and two stations, closer in every house and site footprint; the village, the town, the mill,
//     the cannery and the tram named from the middle zoom, kept clear of the badges. Partly transparent so the painting
//     keeps its life; nothing of it takes a pointer (infraOf, pure; the levels in LOD.infra*).
//
// THE SANDBOX STAYS TODAY'S GAME. This file is LAZY (build.js MANIFEST.lazy 'map_menu'): the page shows a MAP entry only
// with ?map=1 or in the career mode (?career=1), and fetches this file, map_pack.js, the painting and the contracts only
// when it is pressed.
//
// THE PHONE (GQ19, MOBILE-GARAGE R1-R24): the same list as a bottom sheet over the map (peek / open), every target
// >= 48 px, nothing hover-only, the map (touch-action none: one finger pans, two pinch) and the sheet (pan-y) never
// sharing a gesture (R20).
//
// THE CONTRACTS ARE READ THROUGH ONE FUNCTION (mapAdapt), from ONE SOURCE LINE (MAP_SOURCE): G2320 (CAREER-WIRE)'s real
// record, 75_career_wire.js careerMapRecord over the career document (?career=1: window.FLYDIY_CAREER; Track writes it
// through careerAct), else a NEW career's offers in memory; ?mapsrc=fixture keeps tools/fixtures/contracts_sample.json.
//
// Pure half (node: require('src/viewer/map_menu.js') -> the core; GATE UISMOKE runs it) and a DOM half (the page).
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;

  // ---- THE NUMBERS ------------------------------------------------------------------------------------------------
  // the contract TYPES and their colours (the mock's --cargo / --pax / --survey / --build)
  const TYPES = [['cargo', 'Cargo', '#d99a3c'], ['pax', 'Passengers', '#4f9fd6'], ['survey', 'Survey', '#6cbf8a'], ['build', 'Build', '#b58fd8']];
  const TYPE_COLOUR = {}; for (const t of TYPES) TYPE_COLOUR[t[0]] = t[2];
  // THE LEVELS OF DETAIL, keyed on zr = scale / the fit's scale (1 = the whole island): the place names and the runway
  // facts, the places of interest, the hotspots (from the second zoom step: one + press is 1.5) and their rings and
  // counts; a runway is drawn at true scale once it is longer than a badge, its designators once there is room
  const LOD = { names: 1.5, facts: 3, pois: 2.2, hot: 1.25, hotRing: 2.6, rwyPx: 34, desigPx: 120,
    // (G2435) the infrastructure: the main roads, the settlements and the tram from the fit; every road and the labels
    // from the middle zoom; the houses and the site footprints closer in; the roads' simplification band by zoom
    infra: 1, infraAll: 1.8, infraLbl: 1.8, infraBldg: 2.6, infraBand: [1.8, 4] };
  const ZOOM_MAX = 8, ZOOM_ABS = 3;     // the deepest zoom: 8x the fit, and at least 3 screen px per picture px (4 m a px)
  const ACC = '#e6a15a';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const kmOf = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.z - b.z) / 1000 : 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- THE PLACES: the projection's aerodromes grouped by name (a field's runways are one place: "Jolene AFB 13/31"
  // and "Jolene AFB 02/20" are Jolene AFB); its kind read off the record (the surface, the altiport flag, the name) -----
  const baseName = n => String(n || '').replace(/\s+\d{2}[LRC]?\/\d{2}[LRC]?$/, '');
  function placeKind(as, name) {
    if (as.some(a => a.surface.cls === 'water')) return 'seaplane';
    if (as.some(a => a.altiport)) return 'altiport';
    if (as.some(a => a.surface.key === 'concrete' || a.surface.key === 'asphalt')) return 'airfield';
    if (/\bmine\b/i.test(name)) return 'mine';
    if (/clearing/i.test(name)) return 'clearing';
    return 'strip';
  }
  const KIND_WORD = { airfield: 'airfield', strip: 'strip', seaplane: 'seaplane base', mine: 'mine strip', clearing: 'clearing', altiport: 'altiport' };
  function placesOf(pack) {
    const by = {}, order = [];
    for (const a of ((pack && pack.aerodromes) || [])) { const n = baseName(a.name); if (!by[n]) { by[n] = []; order.push(n); } by[n].push(a); }
    return order.map(n => {
      const as = by[n].slice().sort((p, q) => q.len - p.len), main = as[0];
      return { id: main.id, name: n, kind: placeKind(as, n), aeros: as.map(a => a.id), x: main.x, z: main.z };
    });
  }
  // a runway's two designators, from its heading (x east, -z north): [the -u end's, the +u end's] - the number painted
  // at an end is the bearing you land on from it
  function designators(a) {
    const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
    const num = s => { const b = (Math.atan2(-s * ux, s * uz) * 180 / Math.PI + 360) % 360; return String(Math.round(b / 10) || 36).padStart(2, '0'); };
    return [num(-1), num(1)];
  }
  // "250 × 18 m gravel", "1 500 m water lane", "380 × 18 m grass, 696 m up"
  const stripWord = a => !a ? '' : (a.surface.cls === 'water' ? fmt(a.len) + ' m water lane' : fmt(a.len) + ' × ' + fmt(a.wid) + ' m ' + a.surface.word) + (a.elev > 150 ? ', ' + fmt(a.elev) + ' m up' : '');

  // ---- THE ADAPTER: the only reader of the record's shape ----------------------------------------------------------
  // raw: { providers, contracts, career?, fleet?, board?, text? } (§7.3; careerMapRecord's); pack: MAP_PACK; live: the
  // player's document or null; designs: CONTRACT_DESIGNS (the voucher's aeroplane, when the fleet is still empty)
  function mapAdapt(raw, pack, live, designs) {
    raw = raw || {};
    const aeros = {};
    for (const a of ((pack && pack.aerodromes) || [])) aeros[a.id] = a;
    const places = placesOf(pack), placeOf = {};
    for (const p of places) for (const id of p.aeros) placeOf[id] = p.id;
    const text = raw.text || {};
    const say = k => (k && text[k]) || k || '';
    const providers = (raw.providers || []).map(p => ({ id: p.id, name: p.name, short: p.short || p.name, home: p.home || null }));
    const prov = {}; for (const p of providers) prov[p.id] = p;
    const car = raw.career || {};
    const career = { accepted: (car.accepted || []).slice(), tracked: car.tracked || null, stage: Object.assign({}, car.stage || {}), wallet: car.wallet, clock: car.clock,
                     voucher: car.voucher || null };
    // (G2320) a survey names the site it flies over as `at` (drawn as its `to`, flagged as overflown)
    const subOf = u => { const o = Object.assign({}, u); if (o.do === 'survey' && o.at && !o.to) o.to = o.at; return o; };
    const contracts = (raw.contracts || []).map(c => ({ id: c.id, provider: c.provider, kind: c.kind || 'job', title: say(c.title), brief: say(c.brief),
      stages: (c.stages || []).map(s => ({ subs: (s.subs || []).map(subOf) })), pay: c.pay || {} })).filter(c => prov[c.provider]);
    let fleet = (raw.fleet || []).map(f => ({ slot: f.slot, name: f.name || f.slot, where: Object.assign({ kind: 'none', aero: null, hangar: null }, f.where || {}), cert: f.cert ? Object.assign({}, f.cert) : null }));
    if (live && live.fleet && Object.keys(live.fleet).length) {
      const certOf = {}; for (const f of fleet) certOf[f.slot] = f.cert;
      fleet = Object.keys(live.fleet).sort().map(n => ({ slot: n, name: n, where: whereOf(live, n), cert: certOf[n] || null }));
    }
    const DES = designs || (typeof CONTRACT_DESIGNS !== 'undefined' ? CONTRACT_DESIGNS : null);   // eslint-disable-line no-undef
    const v = career.voucher, vd = v && !v.used && DES && DES[v.model];
    const voucher = vd ? { name: 'the ' + (vd.label || v.model) + ' your voucher buys', gear: vd.gear || (vd.cert && vd.cert.gear) || 'wheels' } : null;
    return { providers, prov, contracts, career, fleet, voucher, aeros, places, placeOf, hotspots: (pack && pack.hotspots) || [], pois: (pack && pack.pois) || [], source: raw.source || 'fixture' };
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
  const subsAll = c => c.stages.reduce((a, s) => a.concat(s.subs), []);
  const aeroName = (M, id) => (M.aeros[id] && M.aeros[id].name) || id || '';
  // the contract's TYPE: build; survey (it flies over something); passengers (someone aboard); cargo (everything else)
  function typeOf(c) {
    if (c.kind === 'build') return 'build';
    const S = subsAll(c);
    if (c.kind === 'survey' || S.some(u => u.do === 'survey')) return 'survey';
    if (S.some(u => u.load && u.load.pax)) return 'pax';
    return 'cargo';
  }
  // THE PAY: the record's own (CONTRACT-MODEL's contractPay, `total`); the fixture's base + perKm x the stage's km
  function payOf(M, c) {
    const P = c.pay || {};
    if (typeof P.total === 'number') return { total: P.total, model: true };
    const km = subsNow(M, c).reduce((s, u) => s + kmOf(M.aeros[u.from], M.aeros[u.to]), 0);
    return { total: (P.base || 0) + (P.perKm || 0) * km, model: false };
  }
  // the places a contract names, in order (every stage): [{ id, over }] - a survey's site is flown over, not landed at
  function chainOf(c) {
    const out = [];
    const push = (id, over) => { if (!id) return; const L = out[out.length - 1]; if (L && L.id === id && L.over === over) return; out.push({ id, over }); };
    for (const u of subsAll(c)) { push(u.from, false); push(u.to, u.do === 'survey'); }
    return out;
  }
  const chainKm = (M, ch) => { let k = 0; for (let i = 1; i < ch.length; i++) k += kmOf(M.aeros[ch[i - 1].id], M.aeros[ch[i].id]); return k; };
  // THE RUNWAYS CONDENSED: "Jumbo Mine Street 250 × 18 m gravel → Annette Dock 1 500 m water lane · 14 km"
  function routeWord(M, c) {
    const ch = chainOf(c), km = chainKm(M, ch);
    return ch.map(p => p.over ? 'over ' + aeroName(M, p.id) : aeroName(M, p.id) + ' ' + stripWord(M.aeros[p.id])).join(' → ') +
      (km ? ' · ' + (km < 10 ? km.toFixed(1).replace(/\.0$/, '') : fmt(km)) + ' km' : '');
  }
  // does a contract involve a place (any stage: from, to, or the site flown over)
  const involves = (M, c, pid) => { const p = M.places.find(x => x.id === pid); return !!p && subsAll(c).some(u => p.aeros.includes(u.from) || p.aeros.includes(u.to)); };

  // the gear rule, on the surface the bake recorded (25_airfield.js stripAllows' rule; GATE UISMOKE holds the two equal)
  function allows(gear, a) {
    const cls = a && a.surface ? a.surface.cls : 'grass';
    if (gear === 'amphibian') return { ok: true, why: '' };
    if (gear === 'floats') return cls === 'water' ? { ok: true, why: '' } : { ok: false, why: 'floats land on water only' };
    if (gear === 'skis') return (cls === 'snow' || cls === 'grass') ? { ok: true, why: '' } : { ok: false, why: 'skis need snow or grass' };
    return cls === 'water' ? { ok: false, why: 'a water lane: wheels cannot land on it' } : { ok: true, why: '' };
  }
  // the fleet's gears: each airframe whose certificate says; else, a new career's voucher aeroplane; else nothing
  function fleetGears(M) {
    const g = M.fleet.filter(f => f.cert && f.cert.gear).map(f => ({ name: f.name, gear: f.cert.gear }));
    return g.length ? g : M.voucher ? [{ name: M.voucher.name, gear: M.voucher.gear }] : [];
  }
  // THE ONE CHECK MADE FOR THE PLAYER (§R.2): a hard no-no, surface against gear - is there one aeroplane of theirs that
  // can use every strip the contract lands at or leaves from? -> { mark: '✓' | '✗' | '', why } ('' for a build
  // contract, or a fleet with nothing to judge by). Nothing else is judged: the paragraph gives the runways, the player
  // decides.
  function markOf(M, c) {
    if (c.kind === 'build') return { mark: '', why: '' };
    const G = fleetGears(M); if (!G.length) return { mark: '', why: '' };
    const ends = [];
    for (const u of subsAll(c)) for (const id of (u.do === 'survey' ? [u.from] : [u.from, u.to])) if (id && M.aeros[id] && !ends.includes(id)) ends.push(id);
    if (G.some(g => ends.every(id => allows(g.gear, M.aeros[id]).ok))) return { mark: '✓', why: '' };
    const names = ids => ids.map(id => aeroName(M, id)).join(', ');
    const wet = ends.filter(id => M.aeros[id].surface.cls === 'water'), dry = ends.filter(id => !wet.includes(id));
    const can = ids => G.some(g => ids.every(id => allows(g.gear, M.aeros[id]).ok));
    const yours = G.length === 1 && M.voucher && !M.fleet.length ? G[0].name : 'your planes';
    let why;
    if (wet.length && !can(wet)) why = (G.length === 1 && yours !== 'your planes' ? 'The ' + yours.replace(/^the /, '') + ' cannot' : 'None of your planes can') + ' land on water (' + names(wet) + ').';
    else if (dry.length && !can(dry)) {
      const bad = dry.filter(id => !G.some(g => allows(g.gear, M.aeros[id]).ok));
      const r = allows(G[0].gear, M.aeros[bad[0] || dry[0]]).why;
      why = (r === 'floats land on water only' ? 'Your planes are on floats: none can land at ' : 'None of your planes can use ') + names(bad.length ? bad : dry) + (r && r !== 'floats land on water only' ? ' (' + r + ')' : '') + '.';
    } else why = 'No one plane of yours lands on both water and land (' + names(ends) + ').';
    return { mark: '✗', why };
  }

  // ---- THE LIST --------------------------------------------------------------------------------------------------
  // f: { cust: 'all' | provider id, at: place id | null }
  function rowsOf(M, f) {
    f = f || {};
    const order = {}; M.providers.forEach((p, i) => { order[p.id] = i; });
    const kindO = { contract: 0, build: 1, job: 2, survey: 3, challenge: 4 };
    const L = M.contracts.filter(c => (!f.cust || f.cust === 'all' || c.provider === f.cust) && (!f.at || involves(M, c, f.at)));
    const rank = c => (c.id === M.career.tracked ? 0 : M.career.accepted.includes(c.id) ? 1 : 2);
    return L.slice().sort((a, b) => rank(a) - rank(b) || order[a.provider] - order[b.provider] || (kindO[a.kind] || 9) - (kindO[b.kind] || 9) || (a.id < b.id ? -1 : 1));
  }
  const placeName = (M, pid) => ((M.places.find(p => p.id === pid) || {}).name) || pid || '';
  // the paragraph: who + what + pay; the runways condensed; the ✗'s reason - then the one button
  function paraHTML(M, c) {
    const p = M.prov[c.provider], P = payOf(M, c), K = markOf(M, c), tr = M.career.tracked === c.id;
    return '<div class="mmBody"><p>' + esc(p.name) + ': ' + esc(c.brief) + ' Pays ' + fmt(P.total) + '.' +
      '<span class="mmRw">' + esc(routeWord(M, c)) + '</span>' + (K.mark === '✗' ? '<span class="mmWhy">' + esc(K.why) + '</span>' : '') + '</p>' +
      '<button type="button" class="mmTrack' + (tr ? ' on' : '') + '" data-act="track" data-id="' + esc(c.id) + '" aria-pressed="' + tr + '">' + (tr ? 'Tracking ★' : 'Track') + '</button></div>';
  }
  function listHTML(M, st) {
    const rows = rowsOf(M, st);
    if (!rows.length) return '<p class="mmEmpty">' + (st.at ? 'No contract involves ' + esc(placeName(M, st.at)) + ' yet.' : M.contracts.length ? 'No contract from this customer yet.' : 'No work on offer yet.') + '</p>';
    return rows.map(c => {
      const ty = typeOf(c), K = markOf(M, c), on = st.open === c.id, tr = M.career.tracked === c.id;
      return '<div class="mmItem' + (on ? ' open' : '') + (tr ? ' trk' : '') + '" data-id="' + esc(c.id) + '">' +
        '<button type="button" class="mmRow" data-act="row" data-id="' + esc(c.id) + '" aria-expanded="' + on + '">' +
          '<i class="mmDot" style="background:' + TYPE_COLOUR[ty] + '" aria-label="' + esc(TYPES.find(t => t[0] === ty)[1]) + '"></i>' +
          '<span class="mmT">' + esc(c.title) + (tr ? ' <em>★</em>' : '') + '</span><span class="mmPay">' + fmt(payOf(M, c).total) + '</span>' +
          '<span class="mmMark ' + (K.mark === '✓' ? 'ok' : K.mark === '✗' ? 'no' : '') + '" aria-label="' + (K.mark === '✓' ? 'nothing rules your fleet out' : K.mark === '✗' ? 'a hard no-no for your fleet' : '') + '">' + K.mark + '</span>' +
        '</button>' + (on ? paraHTML(M, c) : '') + '</div>';
    }).join('');
  }
  // the head: the types' legend, the customer filter, and the place filter's row
  function headHTML(M, st) {
    return '<div class="mmTypes" aria-label="contract types">' + TYPES.map(t => '<span><i class="mmDot" style="background:' + t[2] + '"></i>' + t[1] + '</span>').join('') + '</div>' +
      '<label class="mmFilter">Customer <select class="mmCust" aria-label="customer"><option value="all"' + (st.cust === 'all' ? ' selected' : '') + '>All</option>' +
      M.providers.map(p => '<option value="' + esc(p.id) + '"' + (st.cust === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select></label>';
  }
  const atHTML = (M, st) => st.at ? '<div class="mmAt"><span>At ' + esc(placeName(M, st.at)) + '</span><button type="button" class="mmAtX" data-act="atx" aria-label="show every place">✕</button></div>' : '';
  function statusHTML(M) {
    const tr = M.contracts.find(x => x.id === M.career.tracked), ch = tr ? chainOf({ stages: [{ subs: subsNow(M, tr) }] }) : [];   // the stage now
    return '<span>Wallet <b>' + (M.career.wallet != null ? fmt(M.career.wallet) : '—') + '</b></span><span>Tracking <b>' +
      (tr ? esc(tr.title) + (ch.length ? ': ' + esc(ch.map(p => (p.over ? 'over ' : '') + placeName(M, M.placeOf[p.id] || p.id)).join(' → ')) : '') : 'nothing yet') + '</b></span>';
  }
  // Track: accept and track are one gesture; tapping the tracked one again untracks it (it stays accepted)
  function act(M, id) {
    const C = M.career;
    if (C.tracked === id) C.tracked = null; else { C.tracked = id; if (!C.accepted.includes(id)) C.accepted.push(id); }
    return C;
  }

  // ---- THE MAP'S OVERLAY (pure: strings over a view; the DOM half sets them) ----------------------------------------
  const ICON = {
    airfield: '<path d="M12 3.5c.9 0 1.4.7 1.4 1.6v4.6l6.6 3.6v2l-6.6-1.9v3.9l2 1.5v1.6l-3.4-.9-3.4.9v-1.6l2-1.5v-3.9L4 15.3v-2l6.6-3.6V5.1c0-.9.5-1.6 1.4-1.6z"/>',
    strip: '<path d="M10.2 3h3.6l1.2 18H9z"/><path d="M12 5v2M12 9v2M12 13v2M12 17v2" stroke="#e9dcc0" stroke-width="1.2"/>',
    seaplane: '<path d="M12 4c.8 0 1.2.6 1.2 1.4v3.8l6 3v1.8l-6-1.6v3.2l1.7 1.2v1.3l-2.9-.8-2.9.8v-1.3l1.7-1.2v-3.2l-6 1.6v-1.8l6-3V5.4C10.8 4.6 11.2 4 12 4z"/><path d="M5 20.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    mine: '<path d="M4.5 9.5c3.5-4 11.5-4 15 0-3.4-1.6-11.6-1.6-15 0z"/><path d="M11.2 8.2h1.6v12.3h-1.6z"/>',
    clearing: '<path d="M12 3l5 7h-3l4 6h-5v4h-2v-4H6l4-6H7z"/>',
    altiport: '<path d="M2.5 19.5l6.5-11 3.5 5.5 3-4 6 9.5z"/><path d="M8.6 9.3l1.4 2.3 1.2-1.5z" fill="#e9dcc0"/>',
  };
  const HOTICON = {
    elk: '<path d="M7 4l1 3-2 1 1 1 2-1 1 3h4l1-3 2 1 1-1-2-1 1-3-2 2-1-1-1 2h-2l-1-2-1 1zM9 12h6l1 5-1 4h-1.5l-.5-3h-2l-.5 3H9l-1-4z"/>',
    doe: '<path d="M9 5l2 3h2l2-3-1 4 1 2-1 1h-4l-1-1 1-2zM9 12h6l1 5-1 4h-1.5l-.5-3h-2l-.5 3H9l-1-4z"/>',
    bear: '<circle cx="7.5" cy="7" r="2"/><circle cx="16.5" cy="7" r="2"/><path d="M12 6c4 0 6.5 3 6.5 6.5S16 19 12 19s-6.5-3-6.5-6.5S8 6 12 6z"/>',
    orca: '<path d="M3 13c3-4 9-5 14-3l2-4 .5 5c1.5 1 2.5 2 2.5 3-4 2-12 3-19-1z"/>',
    whale: '<path d="M3 12c2-3 8-4 13-2 2 .8 3 2 3 3.5 1-1 2-2.5 3-3-.3 2-1 3.5-2.5 4.5C17 18 8 18 3 12z"/>',
    bird: '<path d="M2 10c4-1 7 0 10 3 3-3 6-4 10-3-4 1-7 3-10 7-3-4-6-6-10-7z"/>',
  };
  const SURF = { concrete: '#56524d', asphalt: '#4a4744', gravel: '#9a7650', grass: '#6f9a4a', snow: '#e8eef2', dirt: '#8a6a48' };
  const n1 = v => v.toFixed(1);
  // view: { s, tx, ty, fit, w, h } (screen px per picture px, the offset, the fit's scale, the viewport) -> { html, svg, n }
  function overlayOf(M, st, pack, view) {
    const s = view.s, zr = s / view.fit, mpp = pack.mpp, near = s / mpp;   // screen px per metre
    const X = x => view.tx + ((x - pack.x0) / mpp) * s, Y = z => view.ty + ((z - pack.z0) / mpp) * s;
    const bs = Math.round(clamp(10 + 9 * zr, 16, 34)), hs = Math.round(clamp(6 + 7 * zr, 14, 26));
    const n = { badges: 0, names: 0, facts: 0, pois: 0, hot: 0, rings: 0, counts: 0, runways: 0, desig: 0, routes: 0, planes: 0, labels: 0, held: 0 };
    let html = '', svg = '';
    // the open and the tracked contracts' places -> their type colour (the badge takes a ring)
    const lit = [st.open, M.career.tracked].filter(Boolean).map(id => M.contracts.find(c => c.id === id)).filter(Boolean);
    const ring = {};
    for (const c of lit) for (const p of chainOf(c)) { const pid = M.placeOf[p.id]; if (pid && !ring[pid]) ring[pid] = TYPE_COLOUR[typeOf(c)]; }
    // 1. the hotspots (from the second zoom step; the zone ring and the count closer in)
    const boxes = [];   // the labels already placed (screen boxes), so the next keeps clear
    if (zr >= LOD.hot) for (const h of M.hotspots) {
      const x = X(h.x), y = Y(h.z), rr = h.r / mpp * s, sea = h.kind === 'sea';
      if (zr >= LOD.hotRing && rr > 18) { html += '<span class="mmZone" style="left:' + n1(x) + 'px;top:' + n1(y) + 'px;width:' + n1(2 * rr) + 'px;height:' + n1(2 * rr) + 'px"></span>'; n.rings++; }
      html += '<span class="mmHot' + (sea ? ' sea' : '') + '" style="left:' + n1(x) + 'px;top:' + n1(y) + 'px;--hs:' + hs + 'px" role="img" aria-label="' + esc(h.n + ' ' + h.label) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (HOTICON[h.key] || HOTICON.doe) + '</svg></span>';
      n.hot++;
      if (zr >= LOD.hotRing) {   // the count beside the badge: right, else left, else below - whichever keeps clear of the others
        const t = (h.n > 1 ? h.n + ' × ' : '') + h.label, w = t.length * 6.6, hh = 16;
        const sides = [[x + hs / 2 + 4, y - hh / 2, ''], [x - hs / 2 - 4 - w, y - hh / 2, ' l'], [x - w / 2, y + hs / 2 + 2, ' b']];
        const k = sides.find(([l, tp]) => !boxes.some(o => l < o[2] && l + w > o[0] && tp < o[3] && tp + hh > o[1])) || sides[0];
        boxes.push([k[0], k[1], k[0] + w, k[1] + hh]);
        html += '<span class="mmHotN' + k[2] + '" style="left:' + n1(x) + 'px;top:' + n1(y) + 'px;--hs:' + hs + 'px">' + esc(t) + '</span>'; n.counts++;
      }
    }
    // 2. the runways at true scale, once longer than a badge (the place's tap target too)
    for (const a of Object.values(M.aeros)) {
      const lpx = a.len * near, wpx = Math.max(a.wid * near, 2);
      if (lpx < LOD.rwyPx) continue;
      const cx = X(a.x), cy = Y(a.z), ux = Math.cos(a.hdg), uy = Math.sin(a.hdg);
      const P = (p, q, L, Wd) => [cx + ux * p * L / 2 - uy * q * Wd / 2, cy + uy * p * L / 2 + ux * q * Wd / 2];
      const poly = (L, Wd, at) => '<polygon points="' + [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([p, q]) => P(p, q, L, Wd).map(n1).join(',')).join(' ') + '" ' + at + '/>';
      const line = (p1, q1, p2, q2, at, L, Wd) => { const A = P(p1, q1, L || lpx, Wd || wpx), B = P(p2, q2, L || lpx, Wd || wpx); return '<line x1="' + n1(A[0]) + '" y1="' + n1(A[1]) + '" x2="' + n1(B[0]) + '" y2="' + n1(B[1]) + '" ' + at + '/>'; };
      let g = '';
      if (a.surface.cls === 'water') {
        g += poly(lpx, wpx, 'fill="rgba(233,220,192,.10)" stroke="none"');
        g += line(-1, 0, 1, 0, 'stroke="#e9dcc0" stroke-width="2" stroke-dasharray="8 6" opacity=".9"');
        // the buoys: down both edges of the lane (every ~250 m) once they stand apart, the ends' larger; far out, the
        // two ends only, sized to the lane
        const k = Math.max(1, Math.round(a.len / 250)), edge = lpx / k >= 18, rb = clamp(lpx / 40, 1.5, 4.5);
        for (let i = 0; i <= k; i++) for (const q of (edge ? [-1, 1] : [0])) { const end = i === 0 || i === k; if (!edge && !end) continue;
          const B = P(-1 + 2 * i / k, q, lpx, wpx);
          g += '<circle cx="' + n1(B[0]) + '" cy="' + n1(B[1]) + '" r="' + n1(end ? rb : rb * 0.7) + '" fill="#d9653b" stroke="#fff" stroke-width="' + (end ? 1.5 : 1) + '"/>'; }
      } else {
        const key = a.surface.key;
        g += poly(lpx + 14, wpx + 14, 'fill="' + (key === 'concrete' || key === 'asphalt' ? 'rgba(201,190,160,.75)' : 'rgba(150,170,100,.7)') + '" stroke="none"');
        g += poly(lpx, Math.max(wpx, 4), 'fill="' + (SURF[key] || SURF.gravel) + '" stroke="#2a2622" stroke-width="1"');
        if (key === 'concrete' || key === 'asphalt') {
          g += line(-0.86, 0, 0.86, 0, 'stroke="#f4efe6" stroke-width="' + n1(Math.max(1, wpx * 0.06)) + '" stroke-dasharray="7 6"');
          for (const p of [-1, 1]) for (const q of [-0.6, -0.3, 0.3, 0.6]) g += line(p * 0.985, q, p * 0.94, q, 'stroke="#f4efe6" stroke-width="' + n1(Math.max(1, wpx * 0.08)) + '"');
        } else for (const q of [-1, 1]) g += line(-1, q * 1.05, 1, q * 1.05, 'stroke="#f4efe6" stroke-width="1.4" stroke-dasharray="2 7"');
        if (lpx > LOD.desigPx) {
          const D = designators(a);
          [-1, 1].forEach((p, i) => { const Q = P(p, 0, lpx + 34, wpx);
            g += '<text x="' + n1(Q[0]) + '" y="' + n1(Q[1] + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#1c1a17" stroke="#f4efe6" stroke-width="3" paint-order="stroke" font-family="IBM Plex Sans,sans-serif">' + D[i] + '</text>'; });
          n.desig += 2;
        }
      }
      svg += '<g class="mmRwy" data-place="' + esc(M.placeOf[a.id]) + '" data-rwy="' + esc(a.id) + '" role="button" aria-label="' + esc(baseName(a.name) + ': show its contracts') + '">' + g + '</g>';
      n.runways++;
    }
    // 3. the routes: the open contract's (dashed), the tracked one's (dotted)
    for (const c of lit) {
      const ch = chainOf(c).filter(p => M.aeros[p.id]);
      for (let i = 1; i < ch.length; i++) {
        const a = M.aeros[ch[i - 1].id], b = M.aeros[ch[i].id]; if (a === b) continue;
        svg += '<line class="mmRoute" x1="' + n1(X(a.x)) + '" y1="' + n1(Y(a.z)) + '" x2="' + n1(X(b.x)) + '" y2="' + n1(Y(b.z)) + '" stroke="#3b2a1a" stroke-width="' + (c.id === st.open ? 2.5 : 2) + '" stroke-dasharray="' + (c.id === st.open ? '7 5' : '3 5') + '"/>';
        n.routes++;
      }
    }
    // 4. the places of interest (mid zoom)
    // (a place of interest beside a site's badge - the lodge at the altiport, the town at its float - stands below it)
    // (G2435: a place of interest the infrastructure names - the town, the cannery - is named once, by its label below)
    const lbls = (pack.infra && pack.infra.labels) || [], claimed = lbls.map(l => l.poi).filter(Boolean);
    if (zr >= LOD.pois) for (const q of M.pois) {
      if (zr >= LOD.infraLbl && claimed.includes(q.id)) continue;
      let x = X(q.x), y = Y(q.z);
      const near0 = M.places.find(p => Math.hypot(X(p.x) - x, Y(p.z) - y) < bs + 24);
      if (near0) y = Math.max(y, Y(near0.z) + bs / 2 + 26);
      const t = q.label + (q.elev ? ' ' + fmt(q.elev) + ' m' : ''), w = t.length * 6.8;
      boxes.push([x - w / 2, y - 9, x + w / 2, y + 9]);
      html += '<span class="mmPoi" style="left:' + n1(x) + 'px;top:' + n1(y) + 'px">' + esc(t) + '</span>'; n.pois++;
    }
    // 5. every place: a badge always (a tap filters the list); its name from mid zoom (or when lit / filtered), its runway
    //    facts closer; once its runway is drawn the badge steps aside, off the runway's side
    const at = {};   // each place's badge, where it stands on the screen (your planes stand under it)
    for (const p of M.places) {
      const main = M.aeros[p.id], drawn = main.len * near >= LOD.rwyPx;
      let x = X(p.x), y = Y(p.z);
      if (drawn) {   // off the runway's side - the side away from the place's other runways
        const ux = Math.cos(main.hdg), uy = Math.sin(main.hdg), off = main.wid * near / 2 + 7 + bs / 2 + 4;
        const side = p.aeros.slice(1).reduce((t, id) => t + (-uy * (M.aeros[id].x - main.x) + ux * (M.aeros[id].z - main.z)), 0) > 0 ? -1 : 1;
        x += -uy * off * side; y += ux * off * side;
      }
      at[p.id] = [x, y];
      const col = ring[p.id], on = st.at === p.id;
      html += '<button type="button" class="mmPl' + (main.surface.cls === 'water' ? ' water' : '') + (on ? ' on' : '') + '" data-place="' + esc(p.id) + '" style="left:' + n1(x) + 'px;top:' + n1(y) + 'px;--bs:' + bs + 'px" aria-label="' + esc(p.name + ', ' + KIND_WORD[p.kind] + ': show its contracts') + '" aria-pressed="' + on + '">' +
        '<i' + (col ? ' style="box-shadow:0 0 0 3px ' + col + ',0 0 0 5px #1c1a17,0 1px 4px rgba(0,0,0,.5)"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[p.kind] + '</svg></i></button>';
      n.badges++;
      if (zr < LOD.names && !col && !on) continue;
      const facts = zr >= LOD.facts ? p.aeros.map(id => { const a = M.aeros[id], d = p.aeros.length > 1 ? designators(a) : null; return (d ? d.join('/') + ' ' : '') + stripWord(a); }).join(' · ') : '';
      html += '<button type="button" class="mmNm" data-place="' + esc(p.id) + '" style="left:' + n1(x + bs / 2 + 4) + 'px;top:' + n1(y) + 'px" aria-label="' + esc(p.name + ': show its contracts') + '"><span>' + esc(p.name) + (facts ? ' <small>' + esc(facts) + '</small>' : '') + '</span></button>';
      n.names++; if (facts) n.facts++;
    }
    // 6. your planes, where they stand
    const fan = {};
    for (const f of M.fleet) { const a = M.aeros[f.where && f.where.aero], pid = a && M.placeOf[a.id]; if (!pid || !at[pid]) continue; const k = fan[pid] = (fan[pid] || 0) + 1;
      const px = at[pid][0] + (k - 1) * 24 - 12, py = at[pid][1] + bs / 2 + 14; boxes.push([px - 13, py - 11, px + 13, py + 11]);
      html += '<span class="mmPlane" style="left:' + n1(px) + 'px;top:' + n1(py) + 'px" role="img" aria-label="' + esc('your ' + f.name + ', at ' + a.name) + '">✈</span>'; n.planes++; }
    // 7. (G2435) the infrastructure's names - the village, the town, the mill, the cannery, the tram - from the middle zoom,
    //    each kept clear of the badges, the names, your planes and the labels already placed: on its spot, else below, above, right or
    //    left of it; with no clear spot it waits for a closer zoom (n.held)
    if (zr >= LOD.infraLbl) {
      for (const p of M.places) { const q = at[p.id]; if (!q) continue; boxes.push([q[0] - bs / 2 - 2, q[1] - bs / 2 - 2, q[0] + bs / 2 + 2, q[1] + bs / 2 + 2]);
        if (zr >= LOD.names || ring[p.id] || st.at === p.id) { const w = p.name.length * 7.4 + 10; boxes.push([q[0] + bs / 2 + 4, q[1] - 11, q[0] + bs / 2 + 4 + w, q[1] + 11]); } }
      const SZ = { town: [11.5, 22], village: [7.6, 18], work: [7, 16], tram: [7, 16] };
      for (const l of lbls) {
        const x0 = view.tx + l.x * s, y0 = view.ty + l.y * s, sz = SZ[l.style] || SZ.work, w = l.label.length * sz[0] + 8, hh = sz[1];
        const spots = l.style === 'tram' ? [[0, -hh / 2 - 6], [0, hh / 2 + 6], [w / 2 + 14, 0], [-w / 2 - 14, 0]]   // the cable stays readable
          : [[0, 0], [0, hh + 4], [0, -hh - 4], [w / 2 + 10, 0], [-w / 2 - 10, 0], [0, 2 * hh + 8], [0, -2 * hh - 8], [w / 2 + 10, hh + 4], [-w / 2 - 10, hh + 4], [w / 2 + 10, -hh - 4], [-w / 2 - 10, -hh - 4]];
        const k = spots.find(([dx, dy]) => { const L = x0 + dx - w / 2, T = y0 + dy - hh / 2; return !boxes.some(o => L < o[2] && L + w > o[0] && T < o[3] && T + hh > o[1]); });
        if (!k) { n.held++; continue; }
        const x = x0 + k[0], y = y0 + k[1];
        boxes.push([x - w / 2, y - hh / 2, x + w / 2, y + hh / 2]);
        html += '<span class="mmLbl ' + esc(l.style) + '" style="left:' + n1(x) + 'px;top:' + n1(y) + 'px">' + esc(l.label) + '</span>'; n.labels++;
      }
    }
    return { html, svg, n, zr, bs, hs };
  }


  // ---- (G2435) THE INFRASTRUCTURE (pure: the inner SVG of a group the DOM half places at translate(tx, ty) scale(s), so
  // it is in PICTURE px; a pan only moves the group, a zoom step rebuilds it). Widths are screen px divided by s. -------
  const INK = { zone: { residential: ['#ffc46b', '#b23a16', 0.42], commercial: ['#ff9a5c', '#9c2410', 0.46], harbour: ['#5cc3f0', '#0f4f70', 0.36],
                        industrial: ['#c7a2e8', '#4a2c6a', 0.4], park: ['#9be06a', '#2c6a1c', 0.4] },
                road: { main: ['#ffcf5a', '#4a280e'], paved: ['#fff4d8', '#5a3418'], gravel: ['#f3d29a', '#73502a'], track: ['#4a280e'] },
                house: ['#b8432a', '#922c1e', '#6a3a1e', '#5d4a72', '#3f7a2a'], bldg: '#7a2616', deck: '#e2bf7e', rock: '#8e877c', field: '#79c055',
                cable: '#24170c', paper: '#fff3da' };
  const HOUSE_M = [[11, 8], [15, 11], [13, 9], [18, 12], [12, 9]];   // a house's block (m) by its plot's kind: residential, commercial, harbour, industrial, park
  const pts = str => str.split(' ').map(q => q.split(',').map(Number));
  const n2 = v => String(Math.round(v * 100) / 100);
  // a rotated rectangle (centre, sides, degrees) as a path's subpath
  function rectPath(cx, cy, L, Wd, deg) {
    const a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), hl = L / 2, hw = Wd / 2;
    const P = [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([p, q]) => n2(cx + ux * p - uy * q) + ' ' + n2(cy + uy * p + ux * q));
    return 'M' + P.join('L') + 'Z';
  }
  function infraOf(pack, view) {
    const I = pack && pack.infra, n = { zones: 0, roads: 0, main: 0, tracks: 0, houses: 0, sites: 0, links: 0, stations: 0, band: -1 };
    if (!I) return { svg: '', n };
    const s = view.s, zr = s / view.fit, u = 1 / s, mpp = pack.mpp;
    if (zr < LOD.infra) return { svg: '', n };
    let svg = '';
    // 1. the settlements and their kin: a tint, an inked edge (the village, the town warm; harbour, industry, parks their own)
    //    - a light wash of the kind's colour under a hand-drawn hatch of its ink (the old maps' built-up areas)
    let defs = '';
    for (const kind of Object.keys(INK.zone)) {
      const k = INK.zone[kind], g = 6 * u;
      defs += '<pattern id="mmHz-' + kind + '" patternUnits="userSpaceOnUse" width="' + n2(g) + '" height="' + n2(g) + '" patternTransform="rotate(' + (kind === 'harbour' ? -45 : 45) + ')">' +
        '<rect width="' + n2(g) + '" height="' + n2(g) + '" fill="' + k[0] + '" fill-opacity="' + k[2] + '"/><line x1="0" y1="0" x2="0" y2="' + n2(g) + '" stroke="' + k[1] + '" stroke-opacity=".5" stroke-width="' + n2(1.1 * u) + '"/></pattern>';
    }
    svg += '<defs>' + defs + '</defs>';
    for (const z of I.zones) {
      const k = INK.zone[z.kind]; if (!k) continue;
      svg += '<polygon class="mmInfZ ' + z.kind + '" points="' + z.p + '" fill="url(#mmHz-' + z.kind + ')" stroke="' + k[1] + '" stroke-opacity=".8" stroke-width="' + n2(1.4 * u) + '" stroke-dasharray="' + n2(6 * u) + ' ' + n2(3 * u) + '" stroke-linejoin="round"/>';
      n.zones++;
    }
    // 2. the roads: a cased line - the darker edge, then the light core over it - wide by class and zoom (and never
    //    thinner than the road itself once close); tracks a dashed ink line. The tracks first, the main roads on top.
    const band = zr < LOD.infraBand[0] ? 0 : zr < LOD.infraBand[1] ? 1 : 2; n.band = band;
    const rank = r => r.cls === 'track' ? 0 : r.cls === 'gravel' ? 1 : r.main ? 3 : 2;
    const roads = I.roads.filter(r => zr >= LOD.infraAll || r.main).sort((a, b) => rank(a) - rank(b));
    // the core's screen width: the main roads bold (ochre), the minor ones a thread that never fills a town's blocks
    const coreOf = r => r.main ? clamp(1.5 + 0.35 * zr, 2, 4.4) : clamp(0.7 + 0.2 * zr, 1, 2.2), edgeOf = r => clamp(0.4 + 0.1 * zr, 0.6, 1.1) * (r.main ? 1.2 : 1);
    let edges = '', cores = '';
    for (const r of roads) {
      const P = r.p[band], tru = r.w / mpp * s;
      if (r.cls === 'track') {
        const w = Math.max(clamp(1 + 0.15 * zr, 1.2, 2), tru);
        edges += '<polyline points="' + P + '" stroke="' + INK.road.track[0] + '" stroke-width="' + n2(w * u) + '" stroke-dasharray="' + n2(5 * u) + ' ' + n2(3.5 * u) + '"/>';
        n.tracks++; n.roads++; continue;
      }
      const k = r.main && r.cls === 'paved' ? INK.road.main : INK.road[r.cls] || INK.road.paved;
      const core = Math.max(coreOf(r), tru), edge = core + 2 * edgeOf(r);
      edges += '<polyline points="' + P + '" stroke="' + k[1] + '" stroke-width="' + n2(edge * u) + '"/>';
      cores += '<polyline points="' + P + '" stroke="' + k[0] + '" stroke-width="' + n2(core * u) + '"/>';
      n.roads++; if (r.main) n.main++;
    }
    svg += '<g class="mmInfR" fill="none" stroke-linecap="round" stroke-linejoin="round">' + edges + cores + '</g>';
    // 3. closer in: every house (a block on its plot, along its frontage; never under ~2.5 screen px) and every site's
    //    footprint (buildings in ink, decks and floats in plank, breakwaters in stone, the ball park in grass)
    if (zr >= LOD.infraBldg) {
      const hp = ['', '', '', '', ''], minPx = 4.2 * u;
      for (const h of I.houses ? I.houses.split(' ') : []) {
        const [x, y, a, k] = h.split(',').map(Number), m = HOUSE_M[k] || HOUSE_M[0];
        const L = Math.max(m[0] / mpp, minPx), Wd = Math.max(m[1] / mpp, minPx * 0.75);
        hp[k] += rectPath(x, y, L, Wd, a); n.houses++;
      }
      hp.forEach((d, k) => { if (d) svg += '<path class="mmInfH" d="' + d + '" fill="' + INK.house[k] + '" stroke="#3a1206" stroke-width="' + n2(0.7 * u) + '" stroke-linejoin="round"/>'; });
      const sp = { bldg: '', deck: '', rock: '', field: '' };
      for (const it of I.sites) {
        const [x, y, L, Wd, a] = it.r.split(',').map(Number);
        const cls = /^marine\/breakwater/.test(it.key) ? 'rock' : /^marine\//.test(it.key) ? 'deck' : /^sport\//.test(it.key) ? 'field' : 'bldg';
        sp[cls] += rectPath(x, y, Math.max(L / mpp, 3 * u), Math.max(Wd / mpp, 2 * u), a); n.sites++;
      }
      for (const c of ['field', 'deck', 'rock', 'bldg']) if (sp[c]) svg += '<path class="mmInfS ' + c + '" d="' + sp[c] + '" fill="' + INK[c] + '" stroke="' + (c === 'bldg' ? INK.paper : '#4a280e') + '" stroke-width="' + n2((c === 'bldg' ? 0.8 : 0.6) * u) + '" stroke-linejoin="round"/>';
    }
    // 4. the tramway: the cable in ink with its ticks across it (the old maps' aerial ropeway), its two stations
    for (const L of I.links || []) {
      const [A, B] = pts(L.p), S = pts(L.st), dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      let d = 'M' + A[0] + ' ' + A[1] + 'L' + B[0] + ' ' + B[1];
      const step = 14 * u, k = Math.max(1, Math.floor(len / step)), t = 4 * u;
      for (let i = 1; i < k; i++) { const cx = A[0] + dx * i / k, cy = A[1] + dy * i / k; d += 'M' + n2(cx - uy * t) + ' ' + n2(cy + ux * t) + 'L' + n2(cx + uy * t) + ' ' + n2(cy - ux * t); }
      svg += '<path class="mmInfL" d="' + d + '" fill="none" stroke="' + INK.paper + '" stroke-width="' + n2(3.6 * u) + '" stroke-linecap="round" opacity=".7"/>' +
             '<path class="mmInfL" d="' + d + '" fill="none" stroke="' + INK.cable + '" stroke-width="' + n2(1.6 * u) + '" stroke-linecap="round"/>';
      const q = clamp(3 + 1.5 * zr, 6, 12) * u;
      for (const p of S) { svg += '<rect class="mmInfSt" x="' + n2(p[0] - q / 2) + '" y="' + n2(p[1] - q / 2) + '" width="' + n2(q) + '" height="' + n2(q) + '" fill="' + INK.cable + '" stroke="' + INK.paper + '" stroke-width="' + n2(1.2 * u) + '"/>'; n.stations++; }
      n.links++;
    }
    return { svg, n };
  }

  const CORE = { TYPES, LOD, infraOf, mapAdapt, whereOf, placesOf, designators, stripWord, typeOf, payOf, chainOf, routeWord, involves, allows, fleetGears, markOf,
                 rowsOf, listHTML, paraHTML, headHTML, atHTML, statusHTML, act, overlayOf, subsNow, subsAll, ZOOM_MAX, ZOOM_ABS };
  if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
  if (!W || !W.document) return;

  // =================================================================================================================
  // THE DOM HALF
  // =================================================================================================================
  const D = W.document;
  // THE ONE SOURCE LINE (G2320): the real record - the page's dev career (?career=1: FLYDIY_CAREER.record(), the
  // career document through careerMapRecord), else a NEW career's offers in memory (careerNew; nothing is saved);
  // ?mapsrc=fixture (or a page without the career core) reads the fixture
  const fixture = () => fetch((W.FLYDIY_MAP_SRC && W.FLYDIY_MAP_SRC.fixture) || 'tools/fixtures/contracts_sample.json').then(r => r.json());
  const MAP_SOURCE = () => /[?&]mapsrc=fixture(&|$)/.test((W.location && W.location.search) || '') ? fixture()
    : W.FLYDIY_CAREER && W.FLYDIY_CAREER.record ? Promise.resolve().then(() => W.FLYDIY_CAREER.record())
    : (typeof careerMapRecord === 'function' && typeof careerNew === 'function') ? Promise.resolve().then(() => careerMapRecord(careerNew({ id: 'preview', seed: 'dev' }), null, {}))
    : fixture();

  const CSS = `
#mapScreen{--mm-bg:#1c1a17;--mm-panel:#24211d;--mm-ink:#ece6dc;--mm-mid:#a59d8f;--mm-line:#3a352f;--mm-acc:${ACC};--mm-ok:#8cc79a;--mm-no:#e08a7a;--mm-paper:#e9dcc0;--mm-sepia:#3b2a1a;
  --mm-old:'IM Fell English',Georgia,'Times New Roman',serif;
  position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-columns:370px 1fr;grid-template-rows:1fr auto;background:var(--mm-bg);color:var(--mm-ink);font:400 14px/1.5 'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif}
#mapScreen *{box-sizing:border-box}
#mapScreen button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;border-radius:0;box-shadow:none;min-width:0;text-transform:none;letter-spacing:normal;backdrop-filter:none;-webkit-backdrop-filter:none;transition:none;transform:none;cursor:pointer;text-align:left}
#mapScreen button:focus-visible,#mapScreen select:focus-visible{outline:2px solid var(--mm-acc);outline-offset:-2px}
#mapScreen .mmSide{border-right:1px solid var(--mm-line);background:var(--mm-panel);display:flex;flex-direction:column;min-height:0}
#mapScreen .mmHead{padding:6px 8px 10px 16px;display:grid;gap:8px;border-bottom:1px solid var(--mm-line)}
#mapScreen .mmTitle{display:flex;align-items:center;justify-content:space-between}
#mapScreen .mmTitle h1{margin:0;font:600 12px/1 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:var(--mm-mid)}
#mapScreen .mmClose{min-width:48px;height:48px;border-radius:8px;text-align:center;font-size:20px;color:var(--mm-mid)}
#mapScreen .mmTypes{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--mm-mid)}
#mapScreen .mmTypes span{display:inline-flex;align-items:center;gap:6px}
#mapScreen .mmFilter{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mm-mid)}
#mapScreen .mmCust{flex:1;max-width:240px;font:13px 'IBM Plex Sans',sans-serif;text-transform:none;letter-spacing:normal;color:var(--mm-ink);background:var(--mm-bg);border:1px solid var(--mm-line);border-radius:6px;padding:0 8px;min-height:48px}
#mapScreen .mmDot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
#mapScreen .mmAt{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px 0 16px;background:#2b2722;border-bottom:1px solid var(--mm-line);font-size:13px}
#mapScreen .mmAtX{font-weight:600;font-size:15px;border:1px solid var(--mm-line);border-radius:6px;min-width:48px;min-height:48px;text-align:center}
#mapScreen .mmList{overflow-y:auto;flex:1;touch-action:pan-y;overscroll-behavior:contain}
#mapScreen .mmEmpty{margin:0;padding:16px;color:var(--mm-mid)}
#mapScreen .mmItem{border-bottom:1px solid var(--mm-line)}
#mapScreen .mmRow{width:100%;display:grid;grid-template-columns:10px 1fr auto 18px;gap:10px;align-items:center;padding:10px 16px;min-height:48px}
#mapScreen .mmItem.open .mmRow{background:#2b2722}
#mapScreen .mmT{font-weight:500;min-width:0}
#mapScreen .mmT em{font-style:normal;color:var(--mm-acc)}
#mapScreen .mmPay{font-variant-numeric:tabular-nums}
#mapScreen .mmMark{text-align:center;font-weight:600}
#mapScreen .ok{color:var(--mm-ok)} #mapScreen .no{color:var(--mm-no)}
#mapScreen .mmBody{display:grid;gap:10px;padding:0 16px 14px 36px;background:#2b2722}
#mapScreen .mmBody p{margin:0;max-width:42ch}
#mapScreen .mmRw{display:block;margin-top:6px;font-size:13px;color:var(--mm-mid);font-variant-numeric:tabular-nums}
#mapScreen .mmWhy{display:block;margin-top:6px;color:var(--mm-no)}
#mapScreen .mmTrack{justify-self:start;font-weight:600;font-size:13px;color:#1c1a17;background:var(--mm-acc);border-radius:6px;padding:0 16px;min-height:48px;text-align:center}
#mapScreen .mmTrack.on{background:transparent;color:var(--mm-acc);border:1px solid var(--mm-acc)}
#mapScreen .mmMap{position:relative;overflow:hidden;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#mapScreen .mmMap.drag{cursor:grabbing}
#mapScreen .mmMap img,#mapScreen .mmMap svg{-webkit-user-drag:none;user-select:none}
#mapScreen .mmStage{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
#mapScreen .mmStage img{display:block;pointer-events:none;filter:saturate(1.08) contrast(1.02)}
#mapScreen .mmOv{position:absolute;inset:0;pointer-events:none}
#mapScreen .mmOv>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#mapScreen .mmRwy{pointer-events:auto;cursor:pointer}
#mapScreen .mmPl{position:absolute;width:48px;height:48px;margin:-24px 0 0 -24px;pointer-events:auto;display:grid;place-items:center}
#mapScreen .mmPl i{width:var(--bs,30px);height:var(--bs,30px);border-radius:50%;display:grid;place-items:center;background:var(--mm-paper);color:var(--mm-sepia);border:1.5px solid var(--mm-sepia);box-shadow:0 1px 3px rgba(0,0,0,.45)}
#mapScreen .mmPl.water i{color:#1d5f86}
#mapScreen .mmPl.on i{box-shadow:0 0 0 3px var(--mm-acc),0 1px 3px rgba(0,0,0,.45) !important}
#mapScreen .mmPl svg{width:66%;height:66%;fill:currentColor;display:block}
#mapScreen .mmNm{position:absolute;min-height:48px;margin-top:-24px;display:flex;align-items:center;pointer-events:auto;white-space:nowrap}
#mapScreen .mmNm span{font:13.5px/1.15 var(--mm-old);color:var(--mm-sepia);background:rgba(233,220,192,.88);padding:1px 5px;border-radius:3px}
#mapScreen .mmNm small{font:italic 12px var(--mm-old);color:#5a4630}
#mapScreen .mmPoi{position:absolute;transform:translate(-50%,-50%);font:italic 13px var(--mm-old);color:#2a2018;text-shadow:0 0 3px #f4efe6,0 0 3px #f4efe6;white-space:nowrap;pointer-events:none}
#mapScreen .mmInfra{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
#mapScreen .mmInfra *{pointer-events:none}
#mapScreen .mmLbl{position:absolute;transform:translate(-50%,-50%);font:italic 13.5px var(--mm-old);color:#2a1a0c;text-shadow:0 0 3px #fff3da,0 0 3px #fff3da,0 0 1px #fff3da;white-space:nowrap;pointer-events:none}
#mapScreen .mmLbl.town{font:600 18px var(--mm-old);font-style:normal;font-variant:small-caps;letter-spacing:.14em;color:#4a1c0c}
#mapScreen .mmLbl.village{font:italic 600 15px var(--mm-old);color:#5a2410}
#mapScreen .mmLbl.tram{color:#24170c}
#mapScreen .mmHot{position:absolute;transform:translate(-50%,-50%);width:var(--hs,22px);height:var(--hs,22px);border-radius:50%;display:grid;place-items:center;background:#e8f3df;color:#2d5a25;border:1.5px solid #2d5a25;box-shadow:0 1px 3px rgba(0,0,0,.45);pointer-events:none}
#mapScreen .mmHot svg{width:70%;height:70%;fill:currentColor;display:block}
#mapScreen .mmHot.sea{background:#dff0f7;color:#1d5f86;border-color:#1d5f86}
#mapScreen .mmHotN{position:absolute;transform:translate(calc(var(--hs,22px) / 2 + 4px),-50%);font:italic 12.5px var(--mm-old);color:#e8f3df;text-shadow:0 0 3px #12301a,0 0 2px #12301a;white-space:nowrap;pointer-events:none}
#mapScreen .mmHotN.l{transform:translate(calc(-100% - var(--hs,22px) / 2 - 4px),-50%)}
#mapScreen .mmHotN.b{transform:translate(-50%,calc(var(--hs,22px) / 2 + 2px))}
#mapScreen .mmZone{position:absolute;transform:translate(-50%,-50%);border-radius:50%;border:1.5px dashed rgba(232,243,223,.7);pointer-events:none}
#mapScreen .mmPlane{position:absolute;transform:translate(-50%,-50%);font-size:14px;line-height:20px;padding:0 4px;border-radius:4px;background:var(--mm-paper);color:var(--mm-sepia);border:1px solid var(--mm-sepia);pointer-events:none}
#mapScreen .mmCtl{position:absolute;right:14px;bottom:14px;display:grid;gap:8px}
#mapScreen .mmCtl button{font-weight:600;font-size:15px;color:var(--mm-ink);background:rgba(28,26,23,.9);border:1px solid var(--mm-line);border-radius:8px;min-width:48px;min-height:48px;text-align:center}
#mapScreen .mmRose{position:absolute;right:18px;top:16px;width:64px;height:64px;pointer-events:none}
#mapScreen .mmScale{position:absolute;left:16px;bottom:16px;font:14px var(--mm-old);color:var(--mm-sepia);background:rgba(233,220,192,.85);padding:2px 6px;border-radius:3px;pointer-events:none}
#mapScreen .mmScale i{display:inline-block;height:6px;border:1.5px solid currentColor;border-top:0;vertical-align:middle;margin-right:6px}
#mapScreen .mmFoot{grid-column:1/-1;border-top:1px solid var(--mm-line);background:var(--mm-panel);padding:9px 16px;display:flex;gap:22px;flex-wrap:wrap;font-size:13px;color:var(--mm-mid)}
#mapScreen .mmFoot b{color:var(--mm-ink);font-weight:500}
#mapScreen .mmHandle{display:none}
/* THE PHONE (GQ19): the map full, the list a bottom sheet over it; the map and the sheet never share a gesture (R20) */
#mapScreen.mmPhone{display:block}
#mapScreen.mmPhone .mmMap{position:absolute;inset:0}
#mapScreen.mmPhone .mmFoot{display:none}
#mapScreen.mmPhone .mmRose{display:none}
#mapScreen.mmPhone .mmScale{left:8px;top:8px;bottom:auto}
#mapScreen.mmPhone .mmCtl{top:64px;bottom:auto;right:8px}
#mapScreen.mmPhone .mmSide{position:absolute;left:0;right:0;bottom:0;height:38%;border:0;border-radius:16px 16px 0 0;box-shadow:0 -6px 20px rgba(0,0,0,.35);z-index:3}
#mapScreen.mmPhone .mmSide.open{height:78%}
#mapScreen.mmPhone .mmHandle{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:48px;width:100%;touch-action:none;text-align:center}
#mapScreen .mmHandle i{width:44px;height:5px;border-radius:3px;background:var(--mm-mid)}
#mapScreen .mmHandle span{font-size:11.5px;color:var(--mm-mid)}
#mapScreen.mmPhone .mmHead{padding-top:0}
#mapScreen.mmPhone .mmTitle{position:fixed;top:8px;right:8px;z-index:4}
#mapScreen.mmPhone .mmTitle h1{display:none}
#mapScreen.mmPhone .mmClose{background:rgba(28,26,23,.9);border:1px solid var(--mm-line)}
#mapScreen.mmPhone .mmCust{max-width:none}
`;

  let root = null, M = null, pack = null, st = null, $ = {}, infKey = '';
  const V = { s: 1, tx: 0, ty: 0, fit: 1 };
  const isPhone = () => !!((D.documentElement.classList && D.documentElement.classList.contains('phone')) || (W.matchMedia && W.matchMedia('(max-width: 760px)').matches));

  function build() {
    if (!D.getElementById('mapScreenCss')) { const s = D.createElement('style'); s.id = 'mapScreenCss'; s.textContent = CSS; D.head.appendChild(s); }
    root = D.createElement('div'); root.id = 'mapScreen'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'the island map and the contracts');
    root.innerHTML =
      '<aside class="mmSide" aria-label="contracts"><button type="button" class="mmHandle" data-act="sheet" aria-label="the list: open or fold"><i></i><span></span></button>' +
        '<div class="mmHead"><div class="mmTitle"><h1>Contracts</h1><button type="button" class="mmClose" data-act="close" aria-label="close the map">✕</button></div><div class="mmHeadIn"></div></div>' +
        '<div class="mmAtHost"></div><div class="mmList"></div></aside>' +
      '<main class="mmMap" aria-label="the island map: drag to pan, wheel or pinch to zoom"><div class="mmStage"><img alt="the island" draggable="false"></div>' +
        '<svg class="mmInfra" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g></g></svg>' +
        '<div class="mmOv"><svg xmlns="http://www.w3.org/2000/svg" aria-hidden="false"></svg><div class="mmOvH"></div></div>' +
        '<svg class="mmRose" viewBox="-32 -32 64 64" aria-hidden="true"><circle r="27" fill="none" stroke="#3b2a1a" stroke-width="1"/><circle r="22" fill="none" stroke="#3b2a1a" stroke-width=".6"/>' +
          '<path d="M0-30 L5-5 L0 0 L-5-5Z" fill="#3b2a1a"/><path d="M0 30 L5 5 L0 0 L-5 5Z" fill="#e9dcc0" stroke="#3b2a1a" stroke-width=".8"/>' +
          '<path d="M30 0 L5 5 L0 0 L5-5Z" fill="#e9dcc0" stroke="#3b2a1a" stroke-width=".8"/><path d="M-30 0 L-5 5 L0 0 L-5-5Z" fill="#3b2a1a"/>' +
          '<text y="-17" text-anchor="middle" font-family="IM Fell English SC, Georgia, serif" font-size="9" fill="#3b2a1a">N</text></svg>' +
        '<div class="mmCtl"><button type="button" data-act="zin" aria-label="zoom in">+</button><button type="button" data-act="zout" aria-label="zoom out">−</button><button type="button" data-act="fit" aria-label="fit the island">⤢</button></div>' +
        '<div class="mmScale"></div></main>' +
      '<footer class="mmFoot"></footer>';
    D.body.appendChild(root);
    for (const k of ['mmSide', 'mmHeadIn', 'mmAtHost', 'mmList', 'mmMap', 'mmStage', 'mmOvH', 'mmScale', 'mmFoot', 'mmHandle'])
      $[k] = root.querySelector('.' + k);
    $.img = root.querySelector('.mmStage img'); $.svg = root.querySelector('.mmOv svg'); $.inf = root.querySelector('.mmInfra g');
    root.addEventListener('click', onClick);
    root.addEventListener('change', e => { if (e.target && e.target.classList.contains('mmCust')) { st.cust = e.target.value; renderList(); } });
    wireMap();
    wireSheet();
  }

  // ---- RENDER ----
  function render() {
    root.classList.toggle('mmPhone', st.phone);
    $.mmHeadIn.innerHTML = headHTML(M, st);
    renderList();
    $.mmFoot.innerHTML = statusHTML(M);
  }
  function renderList() {
    $.mmSide.classList.toggle('open', st.sheet === 'open');
    $.mmAtHost.innerHTML = atHTML(M, st);
    $.mmList.innerHTML = listHTML(M, st);
    const n = rowsOf(M, st).length, tr = M.contracts.find(x => x.id === M.career.tracked);
    $.mmHandle.querySelector('span').textContent = n + ' contract' + (n === 1 ? '' : 's') + (tr ? ' · ★ ' + tr.title : '') + ' · ' + (st.sheet === 'open' ? 'fold' : 'open');
    place();
  }
  function place() {
    if (!pack || !M) return;
    clampView();
    $.mmStage.style.transform = 'translate(' + V.tx + 'px,' + V.ty + 'px) scale(' + V.s + ')';
    const r = view(), O = overlayOf(M, st, pack, { s: V.s, tx: V.tx, ty: V.ty, fit: V.fit, w: r.width, h: r.height });
    $.mmOvH.innerHTML = O.html; $.svg.innerHTML = O.svg;
    st.lastOverlay = O.n;
    // (G2435) the infrastructure: a pan moves its group; a zoom step (~5 %) redraws it at that zoom's widths and detail
    $.inf.setAttribute('transform', 'translate(' + V.tx + ' ' + V.ty + ') scale(' + V.s + ')');
    const key = Math.round(Math.log(V.s / V.fit) * 20) + '|' + V.fit.toFixed(4);
    if (key !== infKey) { infKey = key; const F = infraOf(pack, { s: V.s, fit: V.fit }); $.inf.innerHTML = F.svg; st.lastInfra = F.n; }
    // a round scale bar
    const m = 1000 * V.s / pack.mpp, km = [0.5, 1, 2, 5, 10].find(k => k * m >= 60) || 10;
    $.mmScale.innerHTML = '<i style="width:' + Math.round(km * m) + 'px"></i>' + (km < 1 ? '500 m' : km + ' km');
  }

  // ---- THE VIEW: fit, bounds, zoom at a point (no auto-zoom anywhere: only the player's gestures and buttons move it) ---
  // the phone's map is the part above the folded sheet: the fit and the bounds keep the island out from under it
  const view = () => { const r = $.mmMap.getBoundingClientRect(), b = st && st.phone ? Math.round(r.height * 0.38) : 0; return { left: r.left, top: r.top, width: r.width, height: r.height - b }; };
  const sMax = () => Math.max(V.fit * ZOOM_MAX, ZOOM_ABS);
  function clampView() {
    const v = view(); V.s = clamp(V.s, V.fit, sMax());
    const w = pack.w * V.s, h = pack.h * V.s;
    V.tx = w <= v.width ? (v.width - w) / 2 : Math.min(0, Math.max(v.width - w, V.tx));
    V.ty = h <= v.height ? (v.height - h) / 2 : Math.min(0, Math.max(v.height - h, V.ty));
  }
  function fit() { const v = view(); V.fit = Math.min(v.width / pack.w, v.height / pack.h) || 1; V.s = V.fit; V.tx = (v.width - pack.w * V.s) / 2; V.ty = (v.height - pack.h * V.s) / 2; place(); }
  function zoomAt(k, cx, cy) { const s2 = clamp(V.s * k, V.fit, sMax()); V.tx = cx - (cx - V.tx) * s2 / V.s; V.ty = cy - (cy - V.ty) * s2 / V.s; V.s = s2; place(); }
  // PAN BY A LEFT-BUTTON DRAG ANYWHERE (a badge included): no native image drag, no text selection; the capture is
  // taken once it IS a drag (4 px), and the click that ends a drag is swallowed, so a click counts only if the pointer
  // barely moved. Two fingers pinch; the wheel zooms at the cursor.
  function wireMap() {
    const el = $.mmMap, pts = new Map(); let last = null, pinch = null, down = null, moved = false;
    el.addEventListener('dragstart', e => e.preventDefault());
    el.addEventListener('selectstart', e => e.preventDefault());
    el.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.mmCtl')) return;
      e.preventDefault();
      if (!pts.size) { down = { x: e.clientX, y: e.clientY }; moved = false; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = { x: e.clientX, y: e.clientY };
      if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = { d: Math.hypot(p.x - q.x, p.y - q.y) || 1, s: V.s }; }
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = view();
      if (pts.size >= 2 && pinch) {
        const [p, q] = [...pts.values()], d = Math.hypot(p.x - q.x, p.y - q.y) || 1; moved = true;
        zoomAt((pinch.s * d / pinch.d) / V.s, (p.x + q.x) / 2 - r.left, (p.y + q.y) / 2 - r.top); return;
      }
      if (down && !moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) { moved = true; el.classList.add('drag'); try { el.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ } }
      if (moved && last) { V.tx += e.clientX - last.x; V.ty += e.clientY - last.y; place(); }
      last = { x: e.clientX, y: e.clientY };
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { el.classList.remove('drag'); last = null; down = null; } else { const p = [...pts.values()][0]; last = { x: p.x, y: p.y }; } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); const r = view(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }
  // the sheet's handle (phone): a tap folds or opens it; a swipe on the handle does the same by its direction
  function wireSheet() {
    const h = $.mmHandle; let y0 = null;
    h.addEventListener('pointerdown', e => { y0 = e.clientY; try { h.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ } });
    h.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (Math.abs(dy) > 24) { st.sheet = dy < 0 ? 'open' : 'peek'; h.dataset.swiped = '1'; renderList(); } });
  }

  function track(id) {
    // (G2320) the dev career: Track writes the career document (careerAct: accept + track, or untrack) and the screen
    // reads the record back; elsewhere it lives in the session's adapted record
    if (M.source === 'career' && W.FLYDIY_CAREER && W.FLYDIY_CAREER.act) {
      const raw = W.FLYDIY_CAREER.act(id, 'track');
      if (raw) { let live = null; try { live = W.FLYDIY_PLAYER && W.FLYDIY_PLAYER.doc ? W.FLYDIY_PLAYER.doc() : null; } catch (err) { /* no player */ } M = mapAdapt(raw, pack, live); }
    } else act(M, id);
    render();
  }
  function filterAt(pid) { st.at = st.at === pid ? null : pid; if (st.phone && st.at) st.sheet = 'open'; renderList(); }
  function onClick(e) {
    const t = e.target.closest ? e.target.closest('[data-act],[data-place]') : null; if (!t || !root.contains(t) || t.disabled) return;
    const a = t.dataset.act;
    if (a === 'close') return close();
    if (a === 'zin' || a === 'zout') { const v = view(); return zoomAt(a === 'zin' ? 1.5 : 1 / 1.5, v.width / 2, v.height / 2); }
    if (a === 'fit') return fit();
    if (a === 'sheet') { if (t.dataset.swiped) { delete t.dataset.swiped; return; } st.sheet = st.sheet === 'open' ? 'peek' : 'open'; return renderList(); }
    if (a === 'atx') { st.at = null; return renderList(); }
    if (a === 'row') { st.open = st.open === t.dataset.id ? null : t.dataset.id; return renderList(); }   // NO AUTO-ZOOM: the view is untouched
    if (a === 'track') return track(t.dataset.id);
    if (t.dataset.place) return filterAt(t.dataset.place);
  }
  const onKey = e => { if (e.key === 'Escape' && root && root.parentNode) { e.stopPropagation(); close(); } };
  const onResize = () => { if (!root || !root.parentNode) return; const ph = isPhone(); if (ph !== st.phone) { st.phone = ph; render(); } fit(); };

  function open(opts) {
    opts = opts || {};
    pack = W.MAP_PACK;
    if (!pack) { console.warn('flyDiy: the map pack is not loaded'); return Promise.resolve(false); }
    if (!root) build();
    if (!root.parentNode) D.body.appendChild(root);
    st = st || { cust: 'all', at: null, open: null, sheet: 'peek' };
    st.phone = isPhone();
    const art = pack.art || { img: pack.img, edge: '#9db6c2' };
    $.mmMap.style.background = art.edge;
    $.img.width = pack.w; $.img.height = pack.h; $.img.style.width = pack.w + 'px'; $.img.style.height = pack.h + 'px';
    if ($.img.getAttribute('src') !== art.img) $.img.src = art.img;
    W.addEventListener('keydown', onKey, true); W.addEventListener('resize', onResize);
    let live = null; try { live = W.FLYDIY_PLAYER && W.FLYDIY_PLAYER.doc ? W.FLYDIY_PLAYER.doc() : null; } catch (e) { /* no player */ }
    const src = opts.source === 'empty' ? Promise.resolve({ providers: [], contracts: [], fleet: [] }) : MAP_SOURCE();
    return src.then(raw => {
      M = mapAdapt(raw, pack, opts.source === 'empty' ? null : live);
      render(); fit();   // the layout first (the phone's has no columns), then the fit
      return new Promise(res => { if ($.img.complete && $.img.naturalWidth) res(true); else { $.img.onload = () => res(true); $.img.onerror = () => res(false); } });
    }, err => { console.warn('flyDiy: the contracts did not load -', err && err.message); M = mapAdapt({}, pack, null); render(); fit(); return false; });
  }
  function close() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    W.removeEventListener('keydown', onKey, true); W.removeEventListener('resize', onResize);
    const b = D.getElementById('mapEntry'); if (b && b.focus) b.focus();
  }
  W.MAP_MENU = Object.assign({ open, close, isOpen: () => !!(root && root.parentNode), state: () => st, model: () => M,
                               view: () => Object.assign({}, V), set: o => { Object.assign(st, o || {}); render(); },
                               zoomTo: (x, z, k) => { const v = view(); V.s = clamp(V.fit * k, V.fit, sMax()); V.tx = v.width / 2 - ((x - pack.x0) / pack.mpp) * V.s; V.ty = v.height / 2 - ((z - pack.z0) / pack.mpp) * V.s; place(); },
                               fit: () => fit() }, CORE);
})();
