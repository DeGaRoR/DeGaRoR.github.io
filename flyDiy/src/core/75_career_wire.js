// ===========================================================================
// THE CAREER, WIRED TO THE PAGE (G2320 CAREER-WIRE) — the pure half of the
// wiring: the MAP's record built off the career document (careerMapRecord), a
// certificate's facts off a validated design or a saved build's shakedown, the
// stop record a flight's end hands to careerOnStop (careerStopRecord), the
// sites a flight passed over (careerOverflewAdd), ACCEPT's verdict as
// CONTRACT-MODEL's hook (careerAcceptHook), and the events as words for the
// arrival card (careerEventLines). futureDesigns/GAME-2026-10-06.md §R, §7.3,
// §8.3, §13.2; HANDOVER G2240 / G2250 / G2270 "OPEN / FOR THE COORDINATOR".
// ===========================================================================
// THE RECORD THE MAP READS (map_menu.js mapAdapt; the shape of tools/fixtures/contracts_sample.json, §7.3):
//   { what: 'flydiy-career-map', v, source: 'career',
//     providers: [ { id, name, short, colour, home, line, rep, track } ],
//     contracts: [ the accepted (in order) then the offers: { id, provider, kind, title, brief (RESOLVED words),
//                  stages: [ { subs: [ {do, from?, to?, at?, load?, when?, crit?: [ {k, op, v, at?, words} ]} ] } ],
//                  pay: contractPay(rec) + { bonus }, rep, unlock?, followLine?, classes,
//                  mark: { ok, gear: {ok, why}, door: {ok, why, items} } | null (G2340: the ✓ / ✗, freightMark) } ],
//     career: { accepted, tracked, stage: {id: n}, live: {id: {stage, subs, picked}}, wallet, clock, done, voucher },
//     fleet: [ { slot, name, where: playerWhere, cert | null } ],    the player document's own airframes
//     board: [ { name, cert } ] }                                     (opts.board: designs not materialised)
// A certificate (`cert`, the map's facts): { seats, payloadKg, emptyKg, toRunM, gear, power, tasKmh, enduranceMin,
// spanM, cost, tankL, ult, from } — from the career's own airframe row (`career.airframes[slot].design`, a
// CONTRACT_DESIGNS id: the voucher's maker Cub, PROCURE's purchases), else the page's reading of the saved build's
// shakedown (opts.certs[slot], careerDesignOfShake's row), else null: "certificate not read yet".
//
// Pure: no DOM, no storage, no clock (the gate scans this file as it scans 72-74).
// ===========================================================================

// THE LOOK of the providers on the map (a UI colour per tab; the names are text keys)
const CAREER_MAP_LOOK = { field: '#d9a441', minedock: '#c2603e', resort: '#5f9fd0', survey: '#79a86a', clients: '#a98bc4' };
const CAREER_MAP_V = 1;
const cwClone = o => JSON.parse(JSON.stringify(o));

// ---- A CERTIFICATE'S FACTS --------------------------------------------------------------------------------
// a CONTRACT_DESIGNS-shaped row -> the facts the map's card states (the cabin's payload is CONTRACT-MODEL's own
// rule: the seats beside the pilot x the station mass + the baggage)
function careerDesignCert(D, from) {
  if (!D || typeof D !== 'object') return null;
  const seats = D.seats | 0;
  return {
    seats, payloadKg: Math.max(0, seats - 1) * CONTRACT_FIT.occKg + (D.bagKg || 0),
    emptyKg: D.emptyKg, toRunM: D.toM, gear: D.gear || 'wheels', power: D.power || 'fuel',
    tasKmh: D.cruiseKmh, enduranceMin: D.cruiseKmh > 0 ? Math.round(D.rangeKm / D.cruiseKmh * 60) : null,
    spanM: D.spanM, cost: D.cost, tankL: D.tankL, ult: contractCertUlt(), massKg: D.massKg, rangeKm: D.rangeKm,
    from: from || D.id || null,
  };
}
// a saved build's shakedown (genShakedown's object, as the page's memo keeps it) -> a CONTRACT_DESIGNS row,
// measured the way GATE CONTRACTS measures the five validated designs
function careerDesignOfShake(s, spec, label) {
  if (!s || !s.envelope) return null;
  const floats = s.gearType === 'floats' || (spec && typeof stripGear === 'function' && stripGear(spec) === 'floats');
  return { id: null, label: label || '', gear: floats ? 'floats' : 'wheels', seats: s.envelope.seats,
           bagKg: (spec && spec.cabin && spec.cabin.baggage) || 0, massKg: s.mass, emptyKg: s.empty, toM: s.TORun,
           cruiseKmh: s.VCruise * 3.6, rangeKm: s.rangeKm, spanM: s.span, cost: s.cost, tankL: s.energyL, power: s.energyKind };
}

// ---- THE MAP'S RECORD -----------------------------------------------------------------------------------------
function cwSub(u, F) {
  const s = cwClone(u);
  if (s.crit) s.crit = s.crit.map(c => Object.assign({}, c, { words: contractCritWords(c, F) }));
  return s;
}
function careerMapContract(doc, id, F) {
  const rec = careerContract(doc, id);
  if (!rec) return null;
  const vars = contractVars(rec, F);
  const pay = Object.assign(contractPay(rec, F), { bonus: cwClone((rec.pay && rec.pay.bonus) || []) });
  const out = {
    id: rec.id, provider: rec.provider, kind: rec.kind,
    title: contractText(rec.title, vars), brief: contractText(rec.brief, vars),
    stages: rec.stages.map(st => ({ subs: st.subs.map(u => cwSub(u, F)) })),
    pay, rep: cwClone(rec.rep || null), classes: contractClasses(rec, F),
  };
  if (rec.unlock) out.unlock = cwClone(rec.unlock);
  if (rec.kind === 'build') out.followLine = contractFollowLine(rec);
  return out;
}
// (G2340 FREIGHT) THE MARK (§R.2: ✓ / ✗ only for the hard no-no's - surface vs gear, and NO DOOR FITS: an item that
// passes no door of any of the player's planes; a build contract carries none). The fleet's designs: the career's
// airframe rows (CONTRACT_DESIGNS + their FREIGHT_CARDS), opts.certs' shakedown rows (no card: their doors are not
// known, so they never make a ✗), opts.cards[slot] (a card the page measured) -> freightMark's { ok, gear, door }
function careerMapMark(doc, id, fleet, F) {
  const rec = careerContract(doc, id);
  return rec && typeof freightMark === 'function' ? freightMark(rec, fleet, F) : null;
}
// careerMapRecord(careerDoc, world, opts) -> the record above. `world` names the fleet's places (playerPlace);
// opts: { certs: {slot: design row}, board: [{name, design}], fields, cards: {slot: freight card} }.
function careerMapRecord(doc, world, opts) {
  opts = opts || {};
  const F = opts.fields || CONTRACT_FIELDS;
  const c = doc && doc.career;
  if (!c) return { what: 'flydiy-career-map', v: CAREER_MAP_V, source: 'career', providers: [], contracts: [], fleet: [], board: [], career: {} };
  const C = c.contracts;
  const providers = Object.keys(CONTRACT_PROVIDERS).map(id => {
    const P = CONTRACT_PROVIDERS[id];
    return { id, name: contractText(P.name), short: contractText('prov.' + id + '.short'), colour: CAREER_MAP_LOOK[id] || '#888',
             home: (P.fields && P.fields[0]) || null, line: contractText(P.desc),
             rep: (c.providers[id] || {}).rep || 0, track: (c.tracks || {})[P.track] || 0 };
  });
  const offered = careerOfferIds(doc).filter(id => !C.accepted.includes(id));
  const contracts = C.accepted.concat(offered).map(id => careerMapContract(doc, id, F)).filter(Boolean);
  const stage = {}, live = {};
  for (const id of C.accepted) {
    const L = C.live[id] || { stage: 0, subs: [], picked: [] };
    stage[id] = L.stage | 0;
    live[id] = { stage: L.stage | 0, subs: (L.subs || []).slice(), picked: (L.picked || []).slice() };
  }
  const af = c.airframes || {}, certs = opts.certs || {};
  const certOf = n => {
    const A = af[n];
    // (G2280 PROCURE) a maker's or a used airframe carries its own certificate (the options' measured effects); a
    // MODIFIED one has none (withdrawn): its facts are the saved build's shakedown, if this browser read it
    if (A && A.modified) return certs[n] ? careerDesignCert(certs[n], 'the saved build\'s shakedown') : null;
    if (A && A.cert && typeof A.cert === 'object') return careerDesignCert(A.cert, A.design || null);
    if (A && A.design && CONTRACT_DESIGNS[A.design]) return careerDesignCert(CONTRACT_DESIGNS[A.design], A.design);
    if (certs[n]) return careerDesignCert(certs[n], 'the saved build\'s shakedown');
    return null;
  };
  const fleet = Object.keys(doc.fleet || {}).sort().map(n => {
    const W = typeof playerWhere === 'function' ? playerWhere(doc, n) : { kind: 'none', aero: null, hangar: null };
    return { slot: n, name: n, where: { kind: W.kind, aero: W.aero, hangar: W.hangar }, cert: certOf(n) };
  });
  // the designs the mark reads, per airframe: the career's design row (its card), else the shakedown's row
  const cards = opts.cards || {};
  const markFleet = Object.keys(doc.fleet || {}).sort().map(n => {
    const A = af[n];
    const design = (A && A.design && CONTRACT_DESIGNS[A.design]) || certs[n] || null;
    return { slot: n, design, card: cards[n] || (A && A.design && typeof freightCardOf === 'function' ? freightCardOf(CONTRACT_DESIGNS[A.design]) : null) };
  });
  for (const c of contracts) c.mark = careerMapMark(doc, c.id, markFleet, F);
  const board = (opts.board || []).map(b => ({ name: b.name, cert: careerDesignCert(b.design, b.name) }));
  return {
    what: 'flydiy-career-map', v: CAREER_MAP_V, source: 'career',
    providers, contracts,
    career: { accepted: C.accepted.slice(), tracked: C.tracked || null, stage, live, wallet: doc.wallet, clock: doc.clock || 0,
              done: C.done.length, voucher: cwClone(c.voucher || null) },
    fleet, board,
  };
}

// ---- THE FLIGHT'S EVIDENCE: the sites it passed over, and the stop record ----------------------------------------
// the aerodromes within their field radius (38b_dest.js FLIGHT_FIELD_R, from the strip's rectangle) of (x, z),
// added to `set` (an array of ids, kept in the order first passed) -> set
function careerOverflewAdd(world, x, z, set) {
  const out = set || [];
  for (const a of ((world && world.aerodromes) || [])) {
    if (!a || !a.id || a.kind === 'meadow' || out.includes(a.id)) continue;
    if (flightStripGeom(a, x, z).d <= FLIGHT_FIELD_R) out.push(a.id);
  }
  return out;
}
// THE STOP RECORD (74_career.js contractOnStop's): o = { how, aero (flightWhere's id when flightCanDepart, else null),
// wrecked, slot, gear, occupants (everyone aboard, the pilot counted), cargoKg, items, row: {from, to, t}, overflew,
// hour } -> { how, aero, wrecked, slot, gear, load: {kg, pax, items?}, row, overflew, hour }. Only a STOP delivers:
// an ending that is not 'stopped' carries no aerodrome. (G2340 FREIGHT) THE LOAD IS THE LOADED ITEMS: with items
// aboard (FREIGHT-LOAD's accepted packing), `load.items` is them and `load.kg` their sum; with none, the typed
// cargo kg stands (the fallback).
function careerStopRecord(o) {
  o = o || {};
  const occ = Math.max(0, Math.round(+o.occupants || 0));
  const items = Array.isArray(o.items) && o.items.length && typeof freightItem === 'function' ? freightSplit(o.items) : null;
  const load = items ? { kg: freightKg(items), pax: Math.max(0, occ - 1), items }
                     : { kg: Math.max(0, Math.round(+o.cargoKg || 0)), pax: Math.max(0, occ - 1) };
  return {
    how: o.how || 'stopped',
    aero: (o.how === 'stopped' || o.how == null) && o.aero ? o.aero : null,
    wrecked: !!o.wrecked, slot: o.slot || null, gear: o.gear || null,
    load,
    row: { from: (o.row && o.row.from) || null, to: (o.row && o.row.to) || null, t: Math.max(0, Math.round(+(o.row && o.row.t) || 0)) },
    overflew: Array.isArray(o.overflew) ? o.overflew.slice() : [],
    hour: (typeof o.hour === 'number' && isFinite(o.hour)) ? Math.round(o.hour * 100) / 100 : null,
  };
}
// the load the tracked contract asks for now (the plate's default cargo): the first open sub's load
function careerTrackedLoad(doc) {
  const C = doc && doc.career && doc.career.contracts;
  if (!C || !C.tracked) return null;
  const rec = careerContract(doc, C.tracked), L = C.live[C.tracked] || { stage: 0, subs: [] };
  const st = rec && rec.stages[L.stage];
  if (!st) return null;
  const j = st.subs.findIndex((s, i) => !L.subs[i] && s.load);
  if (j < 0) return null;
  const out = { kg: st.subs[j].load.kg || 0, pax: st.subs[j].load.pax || 0, sub: j };
  // (G2340 FREIGHT) the items the job's load is (what FREIGHT-LOAD packs and the stop record carries)
  if (typeof freightSubItems === 'function') { const it = freightSubItems(st.subs[j], rec); if (it.length) out.items = it; }
  return out;
}
// the tracked build contract's criteria that need the acceptance LEG (a cruise flown: tasKmh, enduranceMin,
// rangeKm) -> [crit] (empty when nothing tracked, not a build, or none flown)
function careerLegCrit(doc) {
  const C = doc && doc.career && doc.career.contracts;
  if (!C || !C.tracked) return [];
  const rec = careerContract(doc, C.tracked);
  if (!rec || rec.kind !== 'build') return [];
  return contractCrit(rec).filter(c => c.k === 'tasKmh' || c.k === 'enduranceMin' || c.k === 'rangeKm');
}

// ---- ACCEPT AS THE HOOK (G2270's acceptVerdict -> G2246's hooks.acceptVerdict) -------------------------------------
// verdictOf(crit[]) -> acceptVerdict's { rows, ok, needsFlight, needsTest } over the build that flew (the page:
// ACCEPT_REC.verdict). Every criterion met -> { ok: true, got: {k: measured} } (the margins feed the bonus);
// any criterion failed -> { ok: false, why }; otherwise pending (a flight or a test still to do) -> { ok: null, why }.
function careerAcceptHook(verdictOf) {
  return function (rec, sub, stop) {
    if (typeof verdictOf !== 'function') return { ok: null, why: 'no acceptance evidence on this page' };
    const crit = (sub && sub.crit) || [];
    if (!crit.length) return { ok: true, got: {} };
    let v;
    try { v = verdictOf(crit, stop); } catch (e) { return { ok: null, why: 'the verdict failed: ' + (e && e.message) }; }
    if (!v || !Array.isArray(v.rows)) return { ok: null, why: 'no verdict' };
    const got = {};
    for (const r of v.rows) if (r.ok && typeof r.value === 'number') got[r.k] = r.value;
    if (v.ok) return { ok: true, got };
    const bad = v.rows.filter(r => r.status === 'fail');
    if (bad.length) return { ok: false, why: bad.map(r => r.k + ' ' + (r.value != null ? r.value : '?') + ' (needs ' + (r.need || (r.op + ' ' + r.v)) + ')').join('; ') };
    const todo = v.rows.filter(r => r.status === 'needs-flight' || r.status === 'needs-test');
    return { ok: null, why: todo.map(r => r.k + ': ' + (r.status === 'needs-flight' ? 'needs a flight' : 'needs a test') + (r.source ? ' (' + r.source + ')' : '')).join('; ') };
  };
}

// ---- THE EVENTS AS WORDS (the arrival card) ----------------------------------------------------------------------
// events (careerOnStop's) -> [{ k, ok, text }]: a load taken on, a sub done, a stage done, the contract done and
// paid (a medal, a building unlocked, the follow-up offered), pending; then the wallet line.
function careerEventLines(res, before, after) {
  const out = [], T = contractText;
  const title = id => { const r = careerContract(after || before, id) || careerContract(before, id); return r ? T(r.title, contractVars(r)) : id; };
  const nm = id => (CONTRACT_FIELDS[id] ? CONTRACT_FIELDS[id].name : id);
  const ev = (res && res.events) || [];
  // one line for what moved: a sub inside its finished stage says nothing more, a finished stage inside its finished
  // contract neither
  const has = (k, id, stage) => ev.some(x => x.k === k && x.id === id && (stage == null || x.stage === stage));
  for (const e of ev) {
    if ((e.k === 'sub' && has('stage', e.id, e.stage)) || (e.k === 'stage' && has('done', e.id))) continue;
    if (e.k === 'picked') out.push({ k: e.k, ok: true, text: T('ev.picked', { t: title(e.id), at: nm(e.at) }) });
    else if (e.k === 'sub') out.push({ k: e.k, ok: true, text: T('ev.sub', { t: title(e.id), n: e.stage + 1 }) });
    else if (e.k === 'stage') out.push({ k: e.k, ok: true, text: T('ev.stage', { t: title(e.id), n: e.stage + 1 }) });
    else if (e.k === 'done') {
      out.push({ k: e.k, ok: true, text: T('ev.done', { t: title(e.id), n: cwMoney(e.pay) }) + (e.medal ? ' · ' + T('medal.' + e.medal) : '') });
      if (e.unlock) {
        const m = /^(\w+):(\d+)$/.exec(e.unlock), tr = m && CONTRACT_TRACKS[m[1]];
        out.push({ k: 'unlock', ok: true, text: T('ev.unlock', { n: tr ? T(tr.stages[+m[2] - 1]) : e.unlock }) });
      }
      if (e.followUp) out.push({ k: 'follow', ok: true, text: T('ev.follow', { t: title(e.followUp) }) });
    } else if (e.k === 'pending') out.push({ k: e.k, ok: null, text: T('ev.pending', { t: title(e.id), n: e.why || '' }) });
  }
  if (!out.length && res && res.untouched) {
    const C = before && before.career && before.career.contracts;
    const id = (C && C.tracked) || Object.keys(res.untouched)[0];
    if (id && res.untouched[id]) out.push({ k: 'none', ok: false, text: T('ev.none', { t: title(id), n: res.untouched[id] }) });
  }
  if (after && before && typeof after.wallet === 'number') {
    const d = after.wallet - (before.wallet || 0);
    out.push({ k: 'wallet', ok: d > 0 ? true : null, text: T('ev.wallet', { n: cwMoney(after.wallet) }) + (d ? ' (' + (d > 0 ? '+' : '−') + cwMoney(Math.abs(d)) + ')' : '') });
  }
  return out;
}
const cwMoney = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
