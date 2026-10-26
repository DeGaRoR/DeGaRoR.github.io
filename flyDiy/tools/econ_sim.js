#!/usr/bin/env node
// ============================================================================
// ECON-SIM (G3250-G3259) - THE ECONOMY SIMULATION: careers played headless on
// the game's own core, four policies x N seeds, the live prices against a
// proposed table, the money sinks tested one at a time.
// ============================================================================
// futureDesigns/game/GAME-PLAN-2026-10-15.md §12 (this tool IS §12), §R, §3
// (the story's beats), §5.3 (routes); GAME-2026-10-06.md §12, §R G-COST (no
// running costs). A TOOL, NOT A GATE: nothing reads its verdict; run_gates does
// not run it. It changes no live price: every variant is set on this process's
// copy of the core's tables (tools/flight_core.js, after `node tools/build.js`).
//
// WHAT IS THE GAME'S OWN (called, never re-written):
//   the career document     careerNew, careerNormalise, careerDaySet (the sim clock)
//   the story T0-T7         storyNewCareer, storyStep, storyApply (the cabin, HOME's
//                           hangar, the client's Cub, the gift, T5's jobs, T6's ROUTE
//                           signed with its down payment, T7's three occasions)
//   the work                careerOfferIds / careerContract (the real generator:
//                           contractJobs, the arcs, the night work), careerAccept,
//                           contractOnStop (the real pay: contractPay, the chain
//                           bonus, the medals), careerStopRecord
//   the fit                 contractDoers / contractTakeoffM / contractGearOk over
//                           the designs below (a load the cabin cannot take, a strip
//                           too short, wheels on water: refused as the game refuses)
//   routes                  routeOffer, routeSign, routeSettle (ROUTES_PAY, the
//                           down payment, the round trips paid on the sim clock)
//   prices                  econAirframePrice, econCatalogPrice, plotPrice,
//                           storyOccasionListings, pilotsHire / pilotsOffers
//   the designs             every build file read through buildGen + genShakedown
//                           + careerDesignOfShake (the certificate's own numbers)
// WHAT IS THE SIM'S (stated, so the numbers mean something):
//   time      a leg = its km at the design's cruise + LEG_OVH_S (taxi, take-off,
//             climb, pattern, landing); flown at 1x, so real = sim. A window
//             (`when`) is waited for on the ground; with NIGHT_WAIT a day leg is
//             not flown between dusk and dawn (the player waits the night out).
//             The menus, the editor and the market cost real minutes (REAL_S).
//   segments  the three tech segments do not exist in code yet (TECH-MASK): a
//             segment here = its designs (by what they want of a hangar: tube /
//             wood = 1, metal = 2, composite = 3) + K[s] contracts flown in it +
//             its keystone (co-funded in the proposal). The demo = the tutorial
//             + segment 1.
//   policies  frugal / collector / router / competitor (POLICIES below).
//   sinks     landmark co-funding, machine-shop packs, buildings (side hangars),
//             competition entry fees, occasions as bargains (SINKS below); the
//             competitions are not in the game: their data here is the proposal.
//
//   node tools/econ_sim.js                  both configs (live, proposed), 20 seeds, the four policies
//   node tools/econ_sim.js --seeds=5        fewer seeds
//   node tools/econ_sim.js --config=live    one config (live | proposed | a sink ablation: no-landmark,
//                                           no-packs, no-buildings, no-comps, no-occasions, routes-live)
//   node tools/econ_sim.js --ablate         + every sink ablation of the proposal (5 seeds each)
//   node tools/econ_sim.js --sweep          + the route pay sweep (perKm x dayTrips, the router, 5 seeds)
//   node tools/econ_sim.js --jobs=4         worker processes (default: the cores, max 6)
//   node tools/econ_sim.js --out=DIR        where the page and the JSON go
//                                           (default futureDesigns/game/econ-sim/)
//   node tools/econ_sim.js --no-page        print only
// Exit 0 always (a tool); a career the engine could not play is reported, never hidden.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');

const ARG = k => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a == null ? null : (a.includes('=') ? a.split('=').slice(1).join('=') : true); };

// ---- THE DESIGNS (measured off their build files through the core's own readers) --------------------------------
// seg: the tech segment the design belongs to (what it wants of a hangar); work: a design a player buys to work with;
// `table`: the CONTRACT_DESIGNS row is used as is (a patched fixture GATE CONTRACTS re-derives itself)
const DESIGN_SRC = {
  rufus:   { build: 'builds/rufus_2026-10-18_certified.json', label: 'Rufus (the starter)', seg: 0 },
  cub:     { build: 'builds/cub_2026-09-20_corrected.json', label: 'Cub', seg: 1, work: true },
  jodel:   { build: 'builds/jodel_2026-09-20_corrected.json', label: 'Jodel', seg: 1, work: true },
  chinook: { build: 'builds/chinook_2026-09-21_corrected.json', label: 'Chinook (2-seat ultralight)', seg: 1, work: true },
  twinf:   { table: 'twinf', label: 'twin floatplane', seg: 1, work: true },
  c172:    { build: 'bugReports/cessnaMetal (1).json', label: 'metal Cessna (4 seats)', seg: 2, work: true },
  c172f:   { build: 'bugReports/cessnaFloatsWOrks.json', label: 'Cessna floats', seg: 2, work: true },
  cjodel:  { build: 'builds/composite_jodel_2026-10-07.json', label: 'composite Jodel', seg: 3, work: true },
};
const SEG_WANTS = { tube: 1, wood: 1, metal: 2, composite: 3 };
function measureDesigns() {
  const cacheF = path.join(os.tmpdir(), 'flydiy_econ_sim_designs.json');
  const coreHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(__dirname, 'flight_core.js'))).digest('hex').slice(0, 12);
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheF, 'utf8')); } catch (e) { cache = {}; }
  const out = {};
  for (const id of Object.keys(DESIGN_SRC)) {
    const S = DESIGN_SRC[id];
    if (S.table) {
      const T = C.CONTRACT_DESIGNS[S.table];
      out[id] = Object.assign({}, T, { id, label: S.label, seg: S.seg, work: !!S.work, wants: [ 'tube' ], src: 'CONTRACT_DESIGNS.' + S.table });
      continue;
    }
    const file = path.join(ROOT, S.build);
    const key = id + '|' + coreHash + '|' + crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
    let row = cache[key];
    if (!row) {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const spec = C.genMigrateSpec(j.spec || j);
      const s = C.genShakedown(C.buildGen(spec), spec);
      const D = C.careerDesignOfShake(s, spec, S.label);
      row = Object.assign({}, D, { wants: C.hangarWants(spec) });
      cache[key] = row;
      try { fs.writeFileSync(cacheF, JSON.stringify(cache)); } catch (e) { /* a cache only */ }
    }
    out[id] = Object.assign({}, row, { id, label: S.label, seg: S.seg, work: !!S.work, src: S.build });
  }
  // the segment follows what it wants of a hangar (the mask's rule: a design's stage = its highest option's)
  for (const id of Object.keys(out)) {
    const w = out[id].wants || [];
    const s = Math.max(1, ...w.map(k => SEG_WANTS[k] || 1));
    if (out[id].seg > 0 && s !== out[id].seg) out[id].segNote = 'wants ' + w.join('+') + ' -> segment ' + s;
  }
  return out;
}

// ---- THE CONFIGS --------------------------------------------------------------------------------------------------
// LIVE: the game as it stands on master (the grant, the prices, ROUTES_PAY), the segments' keystones free, no sink.
// PROPOSED: the table this session proposes (the deliverable); every number below is a proposal, not a live price.
const REF = () => C.econRefPrice();                   // the ledger's Cub, ~31 200: every proposal is in Cubs
const SEG_K = { 1: 14, 2: 20, 3: 26 };                 // contracts flown in a segment before its keystone stands
const LIVE = {
  name: 'live', grant: null,                           // careerNew's CAREER_GRANT (60 000) kept
  routes: null,                                        // ROUTES_PAY as it is
  dayTrips: 0,                                         // no timetable (a round trip as fast as it flies)
  airframeF: 1, occasionF: null,
  landmarks: null, packs: null, comps: null, occasions: null, hangarsWanted: true,
};
const PROPOSED = {
  name: 'proposed',
  grant: 0,                                            // the story career starts with the Rufus, not the 60 000 grant
  storyFee: 20000,                                     // T6's commitment fee (the story's own, beside the route's down payment):
                                                       // "the route pays up front" (§1.2) - T7's wallet can take any one occasion
  routes: { perKm: 30, downTrips: 6 },                 // ROUTES_PAY: a smaller trip, a smaller down payment ...
  dayTrips: 6,                                         // ... and a TIMETABLE: at most 6 round trips a sim day (waits stop paying a fortune)
  airframeF: 1,                                        // the airframe = the ledger x labour (unchanged)
  occasionF: 0.35,                                     // an occasion at 0.35 x the maker's catalogue (T7's today: 0.30-0.35)
  // SINK 3, BUILDINGS: the hangar shells re-priced (ECON_BOOK.shells, in Cubs; live field 1.8 / club 3.2 / works 5.4) so a
  // side hangar is ~10 contracts of pace, as §12 Q10 asks; the order field < club < works kept
  shells: { field: 3.6, club: 5.6, works: 8.6 },
  // SINK 1: landmark co-funding, in Cubs. keystone: required to open the next segment; the others optional
  landmarks: [
    { id: 'observatory', seg: 1, keystone: true,  cubs: 2.5, words: 'the Ardent Observatory (keystone 1)' },
    { id: 'mine-village', seg: 1, keystone: false, cubs: 1.5, words: 'the mining village' },
    { id: 'hydro',        seg: 2, keystone: true,  cubs: 6,   words: 'the hydro plant (keystone 2)' },
    { id: 'sky-tram',     seg: 2, keystone: false, cubs: 3,   words: 'the sky tram' },
    { id: 'community',    seg: 3, keystone: false, cubs: 5,   words: 'Driftwood Landing' },
    { id: 'long-runway',  seg: 3, keystone: true,  cubs: 12,  words: 'the long runway (keystone 3)' },
  ],
  // SINK 2: the machine-shop rung of a segment, bought once it opens (its designs cannot be built before)
  packs: { 2: { cubs: 0.25, words: 'Sheets and bolts (the metal rung)' }, 3: { cubs: 2.5, words: 'Composite and electronics' } },
  // SINK 4: competitions (NOT IN THE GAME: the proposal). cls: what the entry class asks of a design; fee in Cubs;
  // prizes x the fee for gold / silver / bronze; rounds: how many times it runs in its segment
  comps: [
    { id: 'stol-1',  seg: 1, cls: 'stol',   fee: 0.08, prizes: [3, 1.6, 0.8], rounds: 3, words: 'the bush STOL meet' },
    { id: 'race-1',  seg: 1, cls: 'speed',  fee: 0.08, prizes: [3, 1.6, 0.8], rounds: 2, words: 'the island air race' },
    { id: 'float-2', seg: 2, cls: 'floats', fee: 0.15, prizes: [3, 1.6, 0.8], rounds: 3, words: 'the float fly-in' },
    { id: 'race-2',  seg: 2, cls: 'speed',  fee: 0.15, prizes: [3, 1.6, 0.8], rounds: 3, words: 'the Sheets-and-bolts race' },
    { id: 'eco-3',   seg: 3, cls: 'range',  fee: 0.25, prizes: [3, 1.6, 0.8], rounds: 3, words: 'the economy run' },
    { id: 'race-3',  seg: 3, cls: 'speed',  fee: 0.25, prizes: [3, 1.6, 0.8], rounds: 3, words: 'the records week' },
  ],
  // SINK 5: occasions at each segment's opening (one-time listings of that segment's designs), at occasionF
  occasions: { perSeg: 2 },
  hangarsWanted: true,                                 // SINK 3: the side hangars (BASE_OFFERS, plotPrice) as they are
};
// the ablations: the proposal minus one sink (or with today's routes)
const ABLATIONS = {
  'no-landmark':  P => Object.assign({}, P, { name: 'no-landmark', landmarks: null }),
  'no-packs':     P => Object.assign({}, P, { name: 'no-packs', packs: null }),
  'no-buildings': P => Object.assign({}, P, { name: 'no-buildings', hangarsWanted: false, shells: null }),
  'no-comps':     P => Object.assign({}, P, { name: 'no-comps', comps: null }),
  'no-occasions': P => Object.assign({}, P, { name: 'no-occasions', occasions: null }),
  'routes-live':  P => Object.assign({}, P, { name: 'routes-live', routes: null, dayTrips: 0 }),
};
const configOf = name => name === 'live' ? LIVE : name === 'proposed' ? PROPOSED
  : ABLATIONS[name] ? ABLATIONS[name](PROPOSED)
  : /^sweep:/.test(name) ? (() => { const [, k, t] = name.split(':'); return Object.assign({}, PROPOSED, { name, routes: { perKm: +k, downTrips: PROPOSED.routes.downTrips }, dayTrips: +t }); })()
  : null;

// ---- THE TIME MODEL (estimates, in seconds) ------------------------------------------------------------------------
const LEG_OVH_S = 300;                 // a leg's taxi + take-off + climb + pattern + landing, beyond the cruise
const NIGHT_WAIT = true;               // a leg with no window is not flown between dusk and dawn
const WINDOW_DEFER_H = 3;              // a windowed job whose window opens later than this is left for later
const REAL_S = {
  contract: 90,                        // the map, the card, accept, the load: per contract
  wait: 20,                            // a wait on the ground (the clock's dialog)
  buy: 120,                            // a purchase in the market / the storage panel
  build: 12 * 60,                      // a new airframe through the editor (a type you have not built)
  buildContract: 20 * 60,              // a build contract's design work
  route: 90,                           // signing a route
  comp: 4 * 60,                        // a competition's briefing and the run beyond its flight
  T0: 10 * 60, T2: 25 * 60, T6: 5 * 60, T7: 4 * 60,
};
const COMP_FLY_S = 15 * 60;            // a competition's flying (sim = real)

// ---- SMALL HELPERS -------------------------------------------------------------------------------------------------
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
const r100 = v => Math.round(v / 100) * 100;
const rng = seed => C.contractRng(String(seed));
const AEROS = Object.values(C.CONTRACT_FIELDS).map(f => ({ id: f.id, name: f.name, kind: f.surf === 'water' ? 'water' : 'strip' }));
const dayMemo = new Map();
function skyAt(abs) {
  const day = C.dayFromAbs(abs), k = day.date + '|' + Math.floor(day.utc / 3600);
  let m = dayMemo.get(k);
  if (!m) {
    const D = C.DAY.makeDay({ date: day.date, utc: Math.floor(day.utc / 3600) * 3600 });
    const dd = C.dayDuskDawnH ? C.dayDuskDawnH(D) : { duskH: C.CONTRACT_DUSK_H, dawnH: C.CONTRACT_DAWN_H };
    m = { offsetH: D.offsetH, duskH: dd.duskH, dawnH: dd.dawnH };
    dayMemo.set(k, m);
  }
  const hour = (((abs % 86400) / 3600 + m.offsetH) % 24 + 24) % 24;
  return { hour, duskH: m.duskH, dawnH: m.dawnH };
}
const isNight = s => s.hour >= s.duskH || s.hour < s.dawnH;
// seconds from `abs` until the local hour `h` next comes round
function untilHour(abs, h) { const s = skyAt(abs); let dh = h - s.hour; if (dh < 0) dh += 24; return Math.round(dh * 3600); }

// ---- A BUILD CONTRACT'S CRITERIA, ON A DESIGN ROW (the delivered design judged by the numbers ACCEPT reads) ---------
function critOk(D, c) {
  const F = C.CONTRACT_FIELDS, cmp = (a, op, b) => op === '<=' ? a <= b + 1e-9 : op === '>=' ? a >= b - 1e-9 : op === '<' ? a < b : op === '>' ? a > b : a === b;
  const at = c.at || {}, loadKg = (at.kg || 0) + (at.pax || 0) * C.CONTRACT_FIT.occKg;
  switch (c.k) {
    case 'seats': return cmp(D.seats, c.op, c.v);
    case 'emptyKg': return cmp(D.emptyKg, c.op, c.v);
    case 'spanM': return cmp(D.spanM, c.op, c.v);
    case 'tankL': return cmp(D.tankL, c.op, c.v);
    case 'costMax': return cmp(D.cost, c.op, c.v);
    case 'hydro': return (D.gear === 'floats') === !!c.v;
    case 'tasKmh': return cmp(D.cruiseKmh, c.op, c.v);
    case 'rangeKm': return cmp(D.rangeKm, c.op, c.v);
    case 'enduranceMin': return cmp(D.rangeKm / D.cruiseKmh * 60, c.op, c.v);
    case 'powertrain': return D.power === c.v || (c.v === 'piston' && D.power === 'fuel');
    case 'ultimateG': return cmp(C.contractCertUlt(), c.op, c.v);
    case 'takeoffAt': case 'landAt': {
      const f = F[c.v];
      if (!f || !C.contractGearOk(D.gear, f)) return false;
      if ((at.pax || 0) > D.seats - 1) return false;
      return C.contractTakeoffM(D, loadKg, f) <= f.len;
    }
    default: return false;                            // xwindKt, batteryKWh: not read off the row: not attempted
  }
}
const buildOk = (D, rec) => C.contractCrit(rec).every(c => critOk(D, c));

// ---- THE COMPETITION CLASSES (the proposal's; a design qualifies, its dedicated build places) -------------------------
const COMP_CLS = {
  stol:   D => D.gear === 'wheels' && D.toM <= 160,
  speed:  D => D.cruiseKmh >= 125,
  floats: D => D.gear === 'floats',
  range:  D => D.rangeKm >= 400,
};

// ============================================================================
// ONE CAREER
// ============================================================================
function playCareer(policyName, seed, cfg, DESIGNS) {
  // THE CONFIG on this process's tables (restored at the end: a worker plays many careers)
  const RP0 = Object.assign({}, C.ROUTES_PAY), SH0 = Object.assign({}, C.ECON_BOOK.shells);
  if (cfg.routes) Object.assign(C.ROUTES_PAY, cfg.routes);
  if (cfg.shells) Object.assign(C.ECON_BOOK.shells, cfg.shells);      // plotPrice -> econShellPrice reads the book at call
  try { return playCareer1(policyName, seed, cfg, DESIGNS); }
  finally { Object.assign(C.ROUTES_PAY, RP0); Object.assign(C.ECON_BOOK.shells, SH0); }
}

function playCareer1(policyName, seed, cfg, DESIGNS) {
  const P = POLICIES[policyName], R = rng('econsim:' + policyName + ':' + seed), ref = REF();
  const S = {  // (S.income.story: T5's jobs + T6's commitment fee)
    doc: null, abs: 0, t0: 0, real: 0, seg: 0, stage: 'tutorial',
    fleet: {},                          // slot -> { design, at, route?: id, delivered?: true }
    work: null,                         // the slot the player flies
    owned: new Set(),                   // design types materialised (or bought)
    landmarks: new Set(), packs: new Set([1]), compRuns: {}, compBuilt: new Set(),
    occOffered: [], occBought: new Set(),
    stageOf: {}, events: [], samples: [], purchases: [], keystones: {},
    income: { contract: 0, route: 0, routeDown: 0, story: 0, prize: 0, grant: 0 },
    spend: { airframe: 0, occasion: 0, hangar: 0, pilot: 0, landmark: 0, pack: 0, entry: 0 },
    segN: { 0: 0, 1: 0, 2: 0, 3: 0 }, done: 0, cruiseS: 0, black: new Set(), stuck: null, waits: 0, waitS: 0, flights: 0,
    stageClock: {},
  };
  const stageKey = () => S.seg === 0 ? 'tutorial' : 'seg' + S.seg;
  const stamp = () => { const k = stageKey(); const o = S.stageClock[k] || (S.stageClock[k] = { real0: S.real, cruise0: S.cruiseS, sim0: S.abs, n0: S.done, income0: Object.assign({}, S.income) }); return o; };
  // ---- the document and the clock
  let d = C.careerNew({ id: 'sim', seed: 'econsim:' + seed });
  if (cfg.grant != null) { d.wallet = d.wallet - C.CAREER_GRANT + cfg.grant; }
  S.income.grant = cfg.grant != null ? cfg.grant : C.CAREER_GRANT;
  S.abs = S.t0 = C.dayAbs(C.careerDay(d));
  const settle = () => {
    const r = C.routeSettle(d, S.abs);
    if (r.ok && r.paid) { d = r.doc; S.income.route += r.paid; }
  };
  const advance = (dt, why) => {
    if (!(dt > 0)) return;
    S.abs += Math.round(dt);
    const r = C.careerDaySet(d, C.dayFromAbs(S.abs));
    if (r.ok) d = r.doc;
  };
  const wait = (dt, why) => { if (!(dt > 0)) return; if (process.env.ECON_SIM_DEBUG) console.log('wait', (dt / 3600).toFixed(2), 'h', why, 'local', skyAt(S.abs).hour.toFixed(2), C.dayFromAbs(S.abs).date); advance(dt); S.real += REAL_S.wait; S.waits++; S.waitS += dt; settle(); };
  // a leg flown by `slot` from its stand to `to` (km 0: a circuit). when: the arrival window, if any
  const legTime = (D, km) => km / D.cruiseKmh * 3600 + LEG_OVH_S;
  const flyLeg = (slot, to, o) => {
    o = o || {};
    const F = S.fleet[slot], D = DESIGNS[F.design], from = F.at;
    const km = o.km != null ? o.km : (from === to ? 0 : C.contractKm(from, to));
    // standing there already (a pickup where the plane is): no flight, the stop is the one it made
    if (from === to && o.km == null && !o.circuit) { const sky = skyAt(S.abs); return { t: 0, km: 0, hour: sky.hour, duskH: sky.duskH, dawnH: sky.dawnH, from }; }
    const t = legTime(D, km);
    if (o.when) {
      const sky = skyAt(S.abs + t);
      // (73_ contractWhenOk answers WHY NOT: '' is inside the window) - outside, the player waits on the ground for
      // the window's opening (a day window: the morning)
      if (C.contractWhenOk(o.when, { hour: sky.hour, duskH: sky.duskH, dawnH: sky.dawnH })) {
        const Sp = C.contractWhenSpan(o.when, sky.duskH, sky.dawnH);
        const h = o.when.before === 'dusk' ? sky.dawnH + 0.5 : Sp[0] + 0.25;
        wait(Math.max(60, untilHour(S.abs + t, h)), 'window ' + JSON.stringify(o.when));
      }
    } else if (NIGHT_WAIT && (isNight(skyAt(S.abs)) || isNight(skyAt(S.abs + t)))) {
      const sky = skyAt(S.abs);
      wait(untilHour(S.abs, sky.dawnH + 0.5) + (isNight(skyAt(S.abs + untilHour(S.abs, sky.dawnH + 0.5))) ? 3600 : 0), 'night');
    }
    advance(t);
    S.real += t; S.cruiseS += km / D.cruiseKmh * 3600; S.flights++;
    F.at = to;
    settle();
    const sky = skyAt(S.abs);
    return { t, km, hour: sky.hour, duskH: sky.duskH, dawnH: sky.dawnH, from };
  };
  // the stop record a flight's end hands the career (75_ careerStopRecord's shape); the load as the job's own (the page
  // reads it off the cabin: occupants, cargo, items - here the job's load is what is aboard)
  const stopRec = (aero, leg, extra) => {
    extra = extra || {};
    const st = C.careerStopRecord(Object.assign({ how: 'stopped', aero, row: { from: leg.from, to: aero, t: Math.round(leg.t) },
      hour: leg.hour, duskH: leg.duskH, dawnH: leg.dawnH }, extra));
    if (extra.load) st.load = JSON.parse(JSON.stringify(extra.load));
    return st;
  };
  const designsOfFleet = (only) => {
    const DS = {};
    for (const slot of Object.keys(S.fleet)) {
      const F = S.fleet[slot];
      if (F.route || F.delivered || F.stored) continue;
      if (only && !only.includes(slot)) continue;
      DS[slot] = Object.assign({}, DESIGNS[F.design], { label: slot });
    }
    return DS;
  };
  const story = (ev) => { const r = C.storyStep(d, ev, { aeros: AEROS }); if (r.ok) d = r.doc; return r; };
  const apply = (e, o) => { const r = C.storyApply(d, e, Object.assign({ aeros: AEROS }, o || {})); if (r.ok) d = r.doc; return r; };
  const sample = (why) => {
    const nx = nextPurchase(api(), P);
    S.samples.push({ n: S.done, stage: stageKey(), seg: S.seg, real: S.real, simH: (S.abs - S.t0) / 3600, wallet: Math.round(d.wallet),
                     next: nx ? nx.price : null, nextWhat: nx ? nx.what : null, rest: nx && nx.price > 0 ? d.wallet / nx.price : null,
                     fleet: Object.values(S.fleet).filter(F => !F.delivered).length, routes: C.routesActive(d).length, why });
  };
  const addPlane = (slot, design, at, how, price) => {
    S.fleet[slot] = { design, at, how };
    d.fleet[slot] = { hangar: null, aero: at, kind: 'away' };
    d.career.airframes[slot] = { from: how, design: C.CONTRACT_DESIGNS[design] ? design : undefined, paid: price || 0, at: Math.round(d.clock || 0) };
    S.owned.add(design);
  };
  const buy = (k, price, what, ref2) => {
    price = Math.max(0, Math.round(price));
    if (d.wallet < price) return false;
    if (price > 0) { const b = C.econBuy(d, price, k === 'pilot' ? 'signon' : k === 'hangar' ? 'acquire' : 'airframe', ref2 || what); if (!b.ok) return false; d = b.doc; }
    S.purchases.push({ k, what, price, n: S.done, seg: S.seg, real: S.real });
    S.real += REAL_S.buy;
    return true;
  };

  // ==== THE STORY (T0-T7), on the game's own rails =========================================================
  stamp();
  let r = C.storyNewCareer(d, { aeros: AEROS });
  if (!r.ok) throw new Error('storyNewCareer: ' + r.why);
  d = r.doc;
  const cabin = (r.cabin && r.cabin.aero) || 'HOME';
  addPlane('Rufus', 'rufus', cabin, 'story', 0);
  S.work = 'Rufus';
  // T0: the paint, then the letter
  S.real += REAL_S.T0; story({ k: 'ack' });
  // T1: the move to HOME
  let leg = flyLeg('Rufus', 'HOME');
  r = story({ k: 'stop', stop: stopRec('HOME', leg), slot: 'Rufus' });
  if (!r.ok) throw new Error('T1: ' + r.why);
  for (const e of r.effects) if (e.k === 'hangar') apply(e);
  // T2: the client's Cub, finished to the checklist (the client pays the work: no wallet line)
  const clientSlot = C.STORY_SLOTS.client;
  apply({ k: 'clientPlane', at: 'home' }, { slot: clientSlot });
  S.fleet[clientSlot] = { design: 'cub', at: 'HOME', how: 'story' };
  const cubSpec = JSON.parse(fs.readFileSync(path.join(ROOT, C.STORY_FILES.client[0]), 'utf8')).spec;
  const base = C.storyClientSpec(cubSpec);
  story({ k: 'bind', role: 'client', slot: clientSlot, spec: base });
  const done = JSON.parse(JSON.stringify(base));
  done.engines[0].type = Object.keys(C.POWERPLANTS).find(k => k !== base.engines[0].type);
  done.controls.flap = { type: 'plain', span: 0.4, chord: 0.25 };
  done.gear.wheelR = +base.gear.wheelR * 1.3; done.systems = { fit: 'basic' }; done.paint = Object.assign({}, base.paint, { job: 'full', base: 0x2244aa });
  S.real += REAL_S.T2;
  r = story({ k: 'certified', slot: clientSlot, spec: done, cost: 35114 });
  if (!r.ok) throw new Error('T2: ' + r.why);
  // T3: the delivery at the owner's strip
  const owner = C.storySite('client', AEROS);
  leg = flyLeg(clientSlot, owner);
  r = story({ k: 'stop', stop: stopRec(owner, leg), slot: clientSlot });
  if (!r.ok) throw new Error('T3: ' + r.why);
  for (const e of r.effects || []) if (e.k === 'giftPlane') apply(e);
  // T4: the gift
  story({ k: 'ack' });
  S.owned.add('cub'); S.work = clientSlot;
  // T5: the story's three jobs, flown through the contract machinery (the real pay)
  for (const id of C.STORY_JOBS) {
    const pay0 = d.wallet;
    if (!flyContract(id, { slot: clientSlot })) throw new Error('T5: ' + id + ' not flown');
    S.income.story += d.wallet - pay0; S.income.contract -= d.wallet - pay0;
    story({ k: 'jobDone', id });
  }
  // T6: floats on the Cub (free: an edit), the water job, the ROUTE signed
  S.real += REAL_S.T6;
  const water = C.storySite('water', AEROS);
  S.fleet[clientSlot].floats = true;
  leg = flyLeg(clientSlot, water);
  d.fleet[clientSlot] = { hangar: null, aero: water, kind: 'away' };
  r = story({ k: 'stop', stop: stopRec(water, leg, { gear: 'floats' }), slot: clientSlot, gear: 'floats' });
  if (!r.ok) throw new Error('T6: ' + r.why);
  const w0 = d.wallet;
  for (const e of r.effects) {
    if (e.k === 'routeOffer') {
      const o = { now: S.abs };
      // the timetable (proposal): the offer's round trip is at least a day / dayTrips
      if (cfg.dayTrips) {
        const ro = C.routeOffer(d, C.storySite(e.a, AEROS), C.storySite(e.b, AEROS), clientSlot, {});
        if (ro.ok) {
          const off = timetable(ro.offer, cfg);
          const sg = C.routeSign(d, off, clientSlot, C.storyRoutePilot(d), { now: S.abs });
          if (sg.ok) { d = sg.doc; const st = C.storyOf(d); st.offers = [{ k: 'route', plane: clientSlot, signed: true, route: sg.route.id, down: sg.route.down, pay: sg.route.pay, tripS: sg.route.tripS, pilot: sg.route.pilot }]; d.career.story = st; }
        }
      } else apply(e, o);
      const rt = C.routeOfPlane(d, clientSlot);
      if (rt) { S.fleet[clientSlot].route = rt.id; S.income.routeDown += d.wallet - w0; S.routeStory = { pay: rt.pay, down: rt.down, tripS: rt.tripS }; }
      // (proposal) T6's commitment fee, a story effect beside the route's own down payment
      if (cfg.storyFee) { C.playerCharge(d, -cfg.storyFee, 'story', 'T6:fee'); S.income.story += cfg.storyFee; }
    } else apply(e);
  }
  S.work = 'Rufus';
  // T7: the three occasions, then the island opens
  S.real += REAL_S.T7;
  S.occOffered = C.storyOccasionListings(d).map(L => ({ id: L.id, design: L.design === 'c172' ? 'c172' : L.design, price: cfg.occasionF ? r100(L.catalogue * cfg.occasionF) : L.price, seg: 0, story: true }));
  r = story({ k: 'ack' });
  for (const e of r.effects || []) apply(e);
  S.keystones.tutorial = { n: S.done, real: S.real, simH: (S.abs - S.t0) / 3600, wallet: Math.round(d.wallet), fleet: Object.keys(S.fleet).length };
  sample('T7');
  // the story's occasions are bought at T7 by the policy's taste (the rails end here)
  S.seg = 1; stamp();
  openSegment(1);
  P.shop(api());

  // ==== OPEN PLAY: the three segments ==============================================================================
  const MAX = SEG_K[1] + SEG_K[2] + SEG_K[3] + 80;
  while (S.seg <= 3 && S.done < MAX) {
    // the work: the best contract the free fleet can fly
    const pick = pickContract();
    if (!pick) {
      // nothing flyable: wait for the next epoch's offers? The offers move with the completed count only, so the
      // policy must buy a plane that can do the work, else the career is stuck (reported)
      if (!P.unstick(api())) { S.stuck = 'no contract the fleet can fly at ' + S.done + ' (' + stageKey() + ')'; break; }
      continue;
    }
    const before = S.done;
    if (!flyPick(pick)) { S.black.add(pick.id); continue; }
    if (S.done === before) continue;
    S.segN[S.seg]++;
    // the competitions (the competitor's) and the purchases between contracts
    P.compete(api());
    P.shop(api());
    P.routes(api());
    sample('contract');
    keystoneCheck();
  }
  // ---- the career's record
  const tot = Object.values(S.income).reduce((a, b) => a + b, 0);
  return {
    policy: policyName, seed, config: cfg.name, stuck: S.stuck, done: S.done, real: S.real, simH: (S.abs - S.t0) / 3600,
    wallet: Math.round(d.wallet), income: S.income, spend: S.spend, incomeTotal: tot,
    routeShare: (S.income.route + S.income.routeDown) / Math.max(1, S.income.contract + S.income.story + S.income.route + S.income.routeDown + S.income.prize),
    keystones: S.keystones, stages: stageSummary(), purchases: S.purchases, samples: S.samples,
    routeStory: S.routeStory || null, waits: S.waits, waitH: S.waitS / 3600, flights: S.flights,
    pays: S.events.filter(e => e.k === 'done').map(e => ({ n: e.n, seg: e.seg, pay: e.pay })),
    fleetEnd: Object.keys(S.fleet).filter(s => !S.fleet[s].delivered).map(s => S.fleet[s].design + (S.fleet[s].route ? '@route' : '')),
  };

  // ---- the pieces -------------------------------------------------------------------------------------------------
  function api() {
    return { S, get d() { return d; }, setDoc(x) { d = x; }, cfg, DESIGNS, R, ref, buy, addPlane, catalogue, signRoute, hire, freeSlots, workPick, compRun };
  }
  function stageSummary() {
    const out = {};
    const keys = Object.keys(S.stageClock);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i], o = S.stageClock[k], nx = S.stageClock[keys[i + 1]];
      const real1 = nx ? nx.real0 : S.real, cr1 = nx ? nx.cruise0 : S.cruiseS, sim1 = nx ? nx.sim0 : S.abs, n1 = nx ? nx.n0 : S.done, inc1 = nx ? nx.income0 : S.income;
      const inc = {}; for (const c of Object.keys(S.income)) inc[c] = (inc1[c] || 0) - (o.income0[c] || 0);
      const rest = S.samples.filter(x => x.stage === k && x.rest != null).map(x => x.rest);
      // realH at 1x; realH4: the same with the cruise flown at 4x (a time compression the game does not have yet)
      out[k] = { realH: (real1 - o.real0) / 3600, realH4: (real1 - o.real0 - 0.75 * (cr1 - o.cruise0)) / 3600, simH: (sim1 - o.sim0) / 3600, contracts: n1 - o.n0, income: inc,
                 routeShare: (inc.route + inc.routeDown) / Math.max(1, inc.contract + inc.story + inc.route + inc.routeDown + inc.prize),
                 rest: { med: median(rest), p10: pct(rest, 0.1), p90: pct(rest, 0.9), over3: rest.filter(x => x > 3).length / Math.max(1, rest.length),
                         under03: rest.filter(x => x < 0.3).length / Math.max(1, rest.length) } };
    }
    return out;
  }
  function openSegment(s) {
    // SINK 5: the segment's occasions (one-time listings of its own designs, at the occasion factor)
    if (cfg.occasions && s >= 1) {
      const ids = Object.keys(DESIGNS).filter(k => DESIGNS[k].seg === s && DESIGNS[k].work);
      for (let i = 0; i < cfg.occasions.perSeg && ids.length; i++) {
        const k = ids[Math.floor(R() * ids.length)];
        S.occOffered.push({ id: 'occ:s' + s + ':' + i, design: k, price: r100(C.econCatalogPrice(DESIGNS[k].cost) * cfg.occasionF), seg: s });
      }
    }
  }
  // the purchasable catalogue now -> [{ k, id, what, design?, price, seg }]
  function catalogue() {
    const out = [], home = d.sheds[C.PREM_MAIN];
    for (const k of Object.keys(DESIGNS)) {
      const D = DESIGNS[k];
      if (!D.work || D.seg > S.seg || (cfg.packs && !S.packs.has(D.seg))) continue;
      out.push({ k: 'airframe', id: 'af:' + k, design: k, seg: D.seg, what: D.label, price: r100(C.econAirframePrice(D.cost, home, D.wants) * (cfg.airframeF || 1)) });
    }
    for (const O of S.occOffered) if (!S.occBought.has(O.id)) out.push({ k: 'occasion', id: O.id, design: O.design, seg: O.seg, what: 'occasion: ' + DESIGNS[O.design].label, price: O.price });
    if (cfg.hangarsWanted) {
      const side = C.playerSideIds ? C.playerSideIds(d) : [];
      if (side.length < C.PREM_SIDE_MAX) for (const [aero, plot] of [['w3', 'w3'], ['tw_ski', 'tw_ski'], ['mk_sea', 'mk_sea'], ['SEA', 'SEA']]) {
        if (d.sheds[plot]) continue;
        out.push({ k: 'hangar', id: 'h:' + plot, aero, plot, shell: 'field', seg: 1, what: 'side hangar at ' + C.CONTRACT_FIELDS[aero].name, price: C.plotPrice(aero, plot, 'field') });
      }
    }
    if (cfg.landmarks) for (const L of cfg.landmarks) if (L.seg === S.seg && !S.landmarks.has(L.id))
      out.push({ k: 'landmark', id: 'lm:' + L.id, lm: L, seg: L.seg, what: L.words, price: r100(L.cubs * ref), keystone: L.keystone });
    if (cfg.packs) for (const s of Object.keys(cfg.packs)) if (+s <= S.seg && !S.packs.has(+s))
      out.push({ k: 'pack', id: 'pk:' + s, seg: +s, what: 'machine shop: ' + cfg.packs[s].words, price: r100(cfg.packs[s].cubs * ref) });
    return out;
  }
  function freeSlots() { return Object.keys(S.fleet).filter(s => { const F = S.fleet[s]; return !F.route && !F.delivered; }); }
  function workPick() {
    // the player's plane: the most capable free one (seats, then cruise)
    const fs2 = freeSlots();
    fs2.sort((a, b) => { const A = DESIGNS[S.fleet[a].design], B = DESIGNS[S.fleet[b].design]; return (B.seats - A.seats) || (B.cruiseKmh - A.cruiseKmh); });
    return fs2[0] || null;
  }
  function hire() {
    const offers = C.pilotsOffers(d).filter(id => id !== C.PILOTS_COMPANION);
    for (const id of offers) {
      const fee = C.pilotsSignOn(id);
      if (d.wallet < fee) continue;
      const h = C.pilotsHire(d, id);
      if (h.ok) { d = h.doc; S.spend.pilot += fee; S.purchases.push({ k: 'pilot', what: C.pilotsName(id), price: fee, n: S.done, seg: S.seg, real: S.real }); S.real += REAL_S.buy; return id; }
    }
    return null;
  }
  // a route for `slot` from where it stands, to the end that pays most per hour; o.pilot
  function signRoute(slot, pilot) {
    const F = S.fleet[slot], D = DESIGNS[F.design];
    const gear = D.gear === 'floats' || F.floats ? 'floats' : 'wheels';
    let best = null;
    for (const b of Object.keys(C.CONTRACT_FIELDS)) {
      if (b === F.at) continue;
      const o = C.routeOffer(d, F.at, b, slot, { design: Object.assign({}, D, { seats: D.seats }), gear });
      if (!o.ok) continue;
      const off = timetable(o.offer, cfg), perH = off.pay / off.tripS * 3600;
      if (!best || perH > best.perH) best = { off, perH };
    }
    if (!best) return null;
    const w0 = d.wallet;
    const sg = C.routeSign(d, best.off, slot, pilot, { now: S.abs });
    if (!sg.ok) return null;
    d = sg.doc; F.route = sg.route.id; S.income.routeDown += d.wallet - w0; S.real += REAL_S.route;
    S.events.push({ k: 'route', n: S.done, seg: S.seg, plane: F.design, a: sg.route.a, b: sg.route.b, pay: sg.route.pay, down: sg.route.down, tripS: sg.route.tripS });
    return sg.route;
  }
  // a competition round: entry paid, the dedicated design flies it, the placing drawn
  function compRun(Cm) {
    const fee = r100(Cm.fee * ref);
    if (d.wallet < fee) return false;
    if (fee) { d.wallet -= fee; d.ledger.push({ k: 'upgrade', amt: fee, ref: 'entry:' + Cm.id }); S.spend.entry += fee; }
    S.real += REAL_S.comp + COMP_FLY_S; advance(COMP_FLY_S); settle();
    const u = R(), place = u < 0.35 ? 0 : u < 0.65 ? 1 : u < 0.85 ? 2 : 3;
    const prize = place < 3 ? r100(Cm.prizes[place] * fee) : 0;
    d.wallet += prize; S.income.prize += prize;
    S.compRuns[Cm.id] = (S.compRuns[Cm.id] || 0) + 1;
    S.events.push({ k: 'comp', n: S.done, seg: S.seg, id: Cm.id, fee, prize });
    return true;
  }
  function keystoneCheck() {
    if (S.segN[S.seg] < SEG_K[S.seg]) return;
    const L = cfg.landmarks && cfg.landmarks.find(x => x.seg === S.seg && x.keystone);
    if (L && !S.landmarks.has(L.id)) {
      // the keystone waits for its co-funding (a policy that keeps spending on planes waits longer: that is the collector)
      const price = r100(L.cubs * ref);
      if (d.wallet < price) return;
      if (!buy('landmark', price, L.words)) return;
      S.spend.landmark += price; S.landmarks.add(L.id);
    }
    const k = 'seg' + S.seg;
    S.keystones[k] = { n: S.done, real: S.real, simH: (S.abs - S.t0) / 3600, wallet: Math.round(d.wallet),
                       fleet: Object.values(S.fleet).filter(F => !F.delivered).length, routes: C.routesActive(d).length,
                       types: S.owned.size };
    S.seg++;
    if (S.seg <= 3) { stamp(); openSegment(S.seg); P.shop(api()); }
  }
  // ---- the work
  function estFly(slot, rec) {
    const F = S.fleet[slot], D = DESIGNS[F.design];
    let at = F.at, km = 0, legs = 0;
    for (const st of rec.stages) for (const s of st.subs) {
      if (s.do === 'carry') { km += C.contractKm(at, s.from) || 0; km += C.contractKm(s.from, s.to); legs += 2; at = s.to; }
      else if (s.do === 'survey') { km += (C.contractKm(at, s.from) || 0) + 2 * C.contractKm(s.from, s.at); legs += 2; at = s.from; }
      else if (s.do === 'land' || s.do === 'fly') { if (s.from) { km += C.contractKm(at, s.from) || 0; at = s.from; legs++; } km += C.contractKm(at, s.to); legs++; at = s.to; }
      else if (s.do === 'deliver') { km += C.contractKm(at, s.to) || 0; legs++; at = s.to; }
    }
    return km / D.cruiseKmh * 3600 + legs * LEG_OVH_S + REAL_S.contract;
  }
  function pickContract() {
    const ids = C.careerOfferIds(d);
    const DS = designsOfFleet();
    let best = null;
    for (const id of ids) {
      if (S.black.has(id)) continue;
      const rec = C.careerContract(d, id);
      if (!rec) continue;
      if (rec.kind === 'build') {
        const cand = catalogue().filter(c => (c.k === 'airframe') && buildOk(DESIGNS[c.design], rec)).sort((a, b) => a.price - b.price)[0];
        if (!cand) continue;
        const pay = C.contractPay(rec).total, net = pay - cand.price;
        if (net <= 0 || d.wallet < cand.price) continue;
        const t = REAL_S.buildContract + 2 * LEG_OVH_S + (C.contractKm('HOME', contractSubsOfDeliver(rec)) || 0) / DESIGNS[cand.design].cruiseKmh * 3600;
        const sc = net / t * P.weight(rec, api());
        if (!best || sc > best.sc) best = { id, rec, build: cand, sc, pay };
        continue;
      }
      const flying = C.contractSubsOf(rec).filter(s => s.do !== 'deliver' && s.do !== 'accept');
      if (rec.stages.some(st => !C.contractDoers(st.subs.filter(s => s.do !== 'deliver' && s.do !== 'accept'), null, DS).length)) continue;
      const doers = C.contractDoers(flying, null, DS);
      if (!doers.length) continue;
      let bs = null;
      for (const slot of doers) { const t = estFly(slot, rec); if (!bs || t < bs.t) bs = { slot, t }; }
      const pay = C.contractPay(rec).total;
      // a job with a time-of-day window far off is left for later (a player flies the day's work first and the night
      // job when the night comes): its wait counts as half real time when over WINDOW_DEFER_H
      const wH = windowWaitH(rec, bs.slot);
      const sc = pay / (bs.t + (wH > WINDOW_DEFER_H ? wH * 1800 : 0)) * P.weight(rec, api());
      if (!best || sc > best.sc) best = { id, rec, slot: bs.slot, sc, pay };
    }
    return best;
  }
  // the hours this contract's first window would make the player wait from now (0: none, or open now)
  function windowWaitH(rec, slot) {
    const sub = C.contractSubsOf(rec).find(x => x.when);
    if (!sub) return 0;
    const t = estFly(slot, rec), sky = skyAt(S.abs + t);
    if (!C.contractWhenOk(sub.when, { hour: sky.hour, duskH: sky.duskH, dawnH: sky.dawnH })) return 0;
    const Sp = C.contractWhenSpan(sub.when, sky.duskH, sky.dawnH);
    return untilHour(S.abs + t, sub.when.before === 'dusk' ? sky.dawnH + 0.5 : Sp[0] + 0.25) / 3600;
  }
  function contractSubsOfDeliver(rec) { const s = C.contractSubsOf(rec).find(x => x.do === 'deliver'); return s ? s.to : 'HOME'; }
  function flyPick(pick) {
    if (pick.build) {
      // a build contract: the airframe built (paid), flown to the client, accepted, delivered (it leaves the fleet)
      const slot = 'B' + S.done + ':' + pick.build.design;
      if (!buy('airframe', pick.build.price, 'build contract ' + pick.id + ': ' + DESIGNS[pick.build.design].label)) return false;
      S.spend.airframe += pick.build.price;
      addPlane(slot, pick.build.design, 'HOME', 'build', pick.build.price);
      S.real += REAL_S.buildContract - REAL_S.buy;
      const okk = flyContract(pick.id, { slot });
      S.fleet[slot].delivered = true; delete d.fleet[slot];
      return okk;
    }
    return flyContract(pick.id, { slot: pick.slot });
  }
  // fly one contract to its end with `slot`: the legs in order, the stops handed to contractOnStop -> true when done
  function flyContract(id, o) {
    const a = C.careerAccept(d, id);
    if (!a.ok) return false;
    d = a.doc;
    const rec = C.careerContract(d, id), slot = o.slot;
    S.real += REAL_S.contract;
    const hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
    const NT = rec.night || null;
    const n0 = d.career.contracts.done.length;
    const onStop = st => { const q = C.contractOnStop(d, id, st, hooks); if (q.ok) d = q.doc; else if (process.env.ECON_SIM_DEBUG) console.log('stop refused', id, st.aero, q.why); return q; };
    for (const st of rec.stages) for (const sub of st.subs) {
      const when = sub.when || null;
      if (sub.do === 'carry') {
        let L = flyLeg(slot, sub.from);
        onStop(stopRec(sub.from, L, { load: JSON.parse(JSON.stringify(sub.load || { kg: 0, pax: 0 })) }));
        L = flyLeg(slot, sub.to, { when });
        onStop(stopRec(sub.to, L, { load: JSON.parse(JSON.stringify(sub.load || { kg: 0, pax: 0 })) }));
      } else if (sub.do === 'survey') {
        flyLeg(slot, sub.from);
        const L = flyLeg(slot, sub.from, { km: 2 * C.contractKm(sub.from, sub.at), when });
        onStop(stopRec(sub.from, L, { overflew: [sub.at] }));
      } else if (sub.do === 'fly') {
        if (sub.from) flyLeg(slot, sub.from);
        const L = flyLeg(slot, sub.to, { when });
        if (sub.medals) L.t = Math.min(L.t - LEG_OVH_S + 60, ...sub.medals.map(m => m.le - 1));
        onStop(stopRec(sub.to, L));
      } else if (sub.do === 'land' || sub.do === 'deliver') {
        const L = flyLeg(slot, sub.to, { when });
        onStop(stopRec(sub.to, L));
      } else {
        const L = flyLeg(slot, sub.to || S.fleet[slot].at, { when });
        onStop(stopRec(sub.to || S.fleet[slot].at, L));
      }
    }
    const D = d.career.contracts.done;
    if (D.length !== n0 + 1) {
      const ab = C.careerAbandon(d, id); if (ab.ok) d = ab.doc;
      return false;
    }
    const pay = D[D.length - 1].pay;
    S.income.contract += pay;
    S.done++;
    S.events.push({ k: 'done', id, n: S.done, seg: S.seg, pay, kind: rec.kind });
    if (NT) S.night = (S.night || 0) + 1;
    return true;
  }
}
// the proposal's timetable: a round trip is at least a day / dayTrips (the offer's pay unchanged, its down payment kept)
function timetable(offer, cfg) {
  if (!cfg.dayTrips) return offer;
  return Object.assign({}, offer, { tripS: Math.max(offer.tripS, Math.round(86400 / cfg.dayTrips)) });
}

// ---- the next meaningful purchase (money at rest's denominator) ----------------------------------------------------
// what THIS policy would buy next among what the stage sells now (P.want): its cheapest; nothing it wants -> the
// cheapest thing the stage sells at all (an unowned type, a hangar, a landmark: money with nothing it is for); nothing
// at all -> the next segment's cheapest airframe
function nextPurchase(A, P) {
  const cat = A.catalogue().filter(c => c.price > 0 && !(c.k === 'airframe' && A.S.owned.has(c.design)));
  const extra = P.wantExtra ? P.wantExtra(A) : [];
  const want = cat.filter(c => P.want(c, A)).concat(extra).sort((a, b) => a.price - b.price);
  if (want.length) return { what: want[0].what, price: want[0].price, wanted: true };
  const any = cat.slice().sort((a, b) => a.price - b.price);
  if (any.length) return { what: any[0].what, price: any[0].price, wanted: false };
  const home = A.d.sheds[C.PREM_MAIN], seg = Math.min(3, A.S.seg + 1), D = A.DESIGNS;
  const nxt = Object.keys(D).filter(k => D[k].work && D[k].seg === seg).map(k => ({ what: D[k].label, price: C.econAirframePrice(D[k].cost, home, D[k].wants) }));
  return nxt.sort((a, b) => a.price - b.price)[0] || null;
}
// the wants (one predicate per policy; the frugal's is the base the others extend)
const wantFrugal = (c, A) => (c.k === 'landmark' && c.keystone) ||
  ((c.k === 'airframe' || c.k === 'occasion') && A.DESIGNS[c.design].gear === 'wheels' && isUpgrade(A, A.DESIGNS[c.design])) ||
  (c.k === 'pack' && Object.values(A.DESIGNS).some(D => D.work && D.seg === c.seg && D.gear === 'wheels' && isUpgrade(A, D)));

// ============================================================================
// THE POLICIES (the player stand-ins)
// ============================================================================
// shop(api): purchases between contracts; routes(api): routes signed; compete(api): competitions entered;
// weight(rec, api): a multiplier on a contract's pay per minute (the taste); unstick(api): nothing flyable -> buy
// something that can work (true) or give up (false)
const cheapestWork = (A, filt) => A.catalogue().filter(c => (c.k === 'airframe' || c.k === 'occasion') && (!filt || filt(A.DESIGNS[c.design]))).sort((a, b) => a.price - b.price)[0];
function doBuy(A, c) {
  const { S } = A;
  if (c.k === 'airframe' || c.k === 'occasion') {
    if (!A.buy(c.k, c.price, c.what)) return false;
    S.spend[c.k === 'airframe' ? 'airframe' : 'occasion'] += c.price;
    const slot = (c.k === 'occasion' ? 'O' : 'A') + Object.keys(S.fleet).length + ':' + c.design;
    A.addPlane(slot, c.design, 'HOME', c.k, c.price);
    if (c.k === 'occasion') S.occBought.add(c.id);
    else S.real += REAL_S.build - REAL_S.buy;
    return true;
  }
  if (c.k === 'hangar') {
    const r = C.playerAcquire(A.d, c.aero, c.plot, c.shell, 'own');
    if (!r.ok) return false;
    const cost = A.d.wallet - r.doc.wallet;
    A.S.spend.hangar += cost;
    A.S.purchases.push({ k: 'hangar', what: c.what, price: cost, n: S.done, seg: S.seg, real: S.real });
    A.S.real += REAL_S.buy;
    A.setDoc(r.doc);
    return true;
  }
  if (c.k === 'landmark') { if (!A.buy('landmark', c.price, c.what)) return false; S.spend.landmark += c.price; S.landmarks.add(c.lm.id); return true; }
  if (c.k === 'pack') { if (!A.buy('pack', c.price, c.what)) return false; S.spend.pack += c.price; S.packs.add(c.seg); return true; }
  return false;
}
// the work plane of the segment: one that seats the most (then flies fastest) among what the stage sells
const bestWork = (A, seg) => A.catalogue().filter(c => (c.k === 'airframe' || c.k === 'occasion') && A.DESIGNS[c.design].seg === seg && A.DESIGNS[c.design].gear === 'wheels')
  .sort((a, b) => (A.DESIGNS[b.design].seats - A.DESIGNS[a.design].seats) || (a.price - b.price))[0];
const hasSeg = (A, seg, gear) => Object.values(A.S.fleet).some(F => !F.delivered && !F.route && A.DESIGNS[F.design].seg >= seg && (!gear || A.DESIGNS[F.design].gear === gear) && A.DESIGNS[F.design].seats >= 2);
const bestOwned = A => A.freeSlots().map(s => A.DESIGNS[A.S.fleet[s].design]).filter(D => D.gear === 'wheels')
  .sort((a, b) => (b.seats - a.seats) || (b.cruiseKmh - a.cruiseKmh))[0] || null;
const isUpgrade = (A, D) => { const B = bestOwned(A); return !B || D.seats > B.seats || (D.seats === B.seats && D.cruiseKmh > 1.15 * B.cruiseKmh); };
const packFirst = (A, seg) => { const p = A.catalogue().find(c => c.k === 'pack' && c.seg === seg); if (p) doBuy(A, p); return !p || A.S.packs.has(seg); };
const POLICIES = {
  // ONE PLANE, WORKS HARD: the segment's best work plane once (the old one stored), the keystone; nothing else
  frugal: {
    shop(A) {
      const seg = A.S.seg;
      if (seg > 3) return;
      const want = Object.values(A.DESIGNS).some(D => D.work && D.seg === seg && D.gear === 'wheels' && isUpgrade(A, D));
      if (!want || !packFirst(A, seg)) return;
      // an UPGRADE only: the segment's best work plane when it seats more (or, as many, flies 15 % faster) than the
      // best plane it has; the old one stays in the fleet, unflown (long-term storage is free)
      const c = bestWork(A, seg);
      if (c && isUpgrade(A, A.DESIGNS[c.design])) doBuy(A, c);
    },
    routes() {}, compete() {},
    want: wantFrugal,
    weight: rec => 1,
    unstick(A) {
      const st = Object.keys(A.S.fleet).filter(s => A.S.fleet[s].stored);
      if (st.length) { for (const s of st) delete A.S.fleet[s].stored; return true; }
      const c = bestWork(A, A.S.seg) || cheapestWork(A); return !!(c && doBuy(A, c));
    },
  },
  // A NEW TYPE WHENEVER IT CAN: every airframe and occasion of the stage, the side hangars as the fleet grows, every
  // landmark (the keystone among them), the packs as soon as they sell
  collector: {
    types: true,
    shop(A) {
      for (let guard = 0; guard < 12; guard++) {
        const seg = A.S.seg;
        if (seg > 3) return;
        packFirst(A, seg);
        const fleetN = Object.values(A.S.fleet).filter(F => !F.delivered).length;
        const cat = A.catalogue().filter(c =>
          ((c.k === 'airframe') && !A.S.owned.has(c.design)) || c.k === 'occasion' ||
          (c.k === 'hangar' && fleetN >= 3 + 2 * (C.playerSideIds(A.d) || []).length) || c.k === 'landmark').sort((a, b) => a.price - b.price);
        const c = cat.find(x => x.price <= A.d.wallet);
        if (!c || !doBuy(A, c)) return;
      }
    },
    routes() {}, compete() {},
    want: (c, A) => c.k !== 'hangar' || Object.values(A.S.fleet).filter(F => !F.delivered).length >= 3 + 2 * (C.playerSideIds(A.d) || []).length,
    weight: (rec, A) => 1,
    unstick(A) { const c = bestWork(A, A.S.seg) || cheapestWork(A); return !!(c && doBuy(A, c)); },
  },
  // SIGNS EVERY ROUTE: every pilot it can hire, a plane for each free pilot (the cheapest of the stage), the keystone
  router: {
    shop(A) { POLICIES.frugal.shop(A); },
    routes(A) {
      for (let guard = 0; guard < 6; guard++) {
        const pilotFree = C.pilotsHired(A.d).find(id => !C.routeOfPilot(A.d, id)) || A.hire();
        if (!pilotFree) return;
        const work = A.workPick();
        let idle = A.freeSlots().find(s => s !== work && s !== 'Rufus' && !A.S.fleet[s].stored) || A.freeSlots().find(s => A.S.fleet[s].stored);
        if (!idle) {
          const c = cheapestWork(A, D => D.gear === 'wheels');
          if (!c || A.d.wallet < c.price + 0) return;
          if (!doBuy(A, c)) return;
          idle = Object.keys(A.S.fleet).pop();
        }
        delete A.S.fleet[idle].stored;
        if (!A.signRoute(idle, pilotFree)) return;
      }
    },
    compete() {},
    // the router also wants a plane for a free pilot, and the next pilot
    want: (c, A) => wantFrugal(c, A) || ((c.k === 'airframe' || c.k === 'occasion') && A.DESIGNS[c.design].gear === 'wheels' && !!C.pilotsHired(A.d).find(id => !C.routeOfPilot(A.d, id))),
    wantExtra: A => C.pilotsOffers(A.d).filter(id => id !== C.PILOTS_COMPANION).map(id => ({ what: 'pilot ' + id, price: C.pilotsSignOn(id) })).filter(x => x.price > 0),
    weight: rec => 1,
    unstick(A) { return POLICIES.frugal.unstick(A); },
  },
  // CHASES COMPETITIONS: a dedicated design per class of its segment, every round entered; the challenges first
  competitor: {
    types: true,
    shop(A) {
      POLICIES.frugal.shop(A);
      if (!A.cfg.comps) {
        // no competitions in the game: the class designs bought anyway (a fast one, a short-field one)
        for (const cls of ['speed', 'stol']) {
          if (Object.values(A.S.fleet).some(F => !F.delivered && COMP_CLS[cls](A.DESIGNS[F.design]))) continue;
          const c = A.catalogue().filter(x => (x.k === 'airframe' || x.k === 'occasion') && COMP_CLS[cls](A.DESIGNS[x.design])).sort((a, b) => a.price - b.price)[0];
          if (c && c.price <= A.d.wallet) doBuy(A, c);
        }
      }
    },
    routes() {},
    compete(A) {
      if (!A.cfg.comps) return;
      for (const Cm of A.cfg.comps) {
        if (Cm.seg !== A.S.seg || (A.S.compRuns[Cm.id] || 0) >= Cm.rounds) continue;
        // one round per few contracts of the segment
        if (A.S.segN[A.S.seg] < (A.S.compRuns[Cm.id] || 0) * Math.floor(SEG_K[A.S.seg] / Cm.rounds) + 2) continue;
        const has = Object.values(A.S.fleet).some(F => !F.delivered && !F.route && COMP_CLS[Cm.cls](A.DESIGNS[F.design]) && F.compFor === Cm.cls);
        if (!has) {
          // a DEDICATED build for the class (the sink: a design per competition class)
          const c = A.catalogue().filter(x => x.k === 'airframe' && COMP_CLS[Cm.cls](A.DESIGNS[x.design])).sort((a, b) => a.price - b.price)[0];
          if (!c || A.d.wallet < c.price + r100(Cm.fee * A.ref)) continue;
          if (!doBuy(A, c)) continue;
          A.S.fleet[Object.keys(A.S.fleet).pop()].compFor = Cm.cls;
        }
        A.compRun(Cm);
      }
    },
    // the competitor also wants a design for each class of its segment's competitions, and the next entry
    want: (c, A) => wantFrugal(c, A) || ((c.k === 'airframe' || c.k === 'occasion') && (A.cfg.comps || []).some(Cm => Cm.seg === A.S.seg && COMP_CLS[Cm.cls](A.DESIGNS[c.design]) &&
      !Object.values(A.S.fleet).some(F => !F.delivered && F.compFor === Cm.cls))),
    // (an entry fee is not a meaningful purchase: a few per cent of a Cub, paid back by the prizes)
    weight: rec => rec.kind === 'challenge' ? 1.5 : 1,
    unstick(A) { return POLICIES.frugal.unstick(A); },
  },
};


// ============================================================================
// THE RUN: workers, the aggregate, the proposal's tables, the page
// ============================================================================
const POLICY_IDS = ['frugal', 'collector', 'router', 'competitor'];
const TARGETS = {
  cubClass: [3, 4], seat4: [6, 8], hangar: [8, 12],   // contracts of pace (§12 Q10: ~3-4 / 6-8 / ~10)
  rest: [0.3, 3], routeShare: 0.40, demoH: [2, 3],
};
// play a list of jobs [{ policy, seed, config }] -> results (in order); in worker processes when jobs > 1
function runJobs(jobs, DES, nWorkers) {
  if (nWorkers <= 1 || jobs.length < 2) return Promise.resolve(jobs.map(j => playSafe(j, DES)));
  // each worker plays a fixed slice (round-robin) and reports career by career; a career a worker did not report (it
  // died, or went silent for WORKER_IDLE_MS) is played here, so nothing is lost and nothing hangs
  return new Promise(resolve => {
    const out = new Array(jobs.length), t0 = Date.now();
    let alive = 0, got = 0;
    const finish = () => { for (let i = 0; i < jobs.length; i++) if (out[i] == null) out[i] = playSafe(jobs[i], DES); resolve(out); };
    for (let k = 0; k < Math.min(nWorkers, jobs.length); k++) {
      const idx = jobs.map((_, i) => i).filter(i => i % nWorkers === k);
      const w = cp.fork(__filename, ['--worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      alive++;
      let timer = null;
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => { try { w.kill(); } catch (e) {} }, WORKER_IDLE_MS); };
      w.on('message', m => {
        if (m.i != null) { out[m.i] = m.res; got++; if (got % 20 === 0 || got === jobs.length) process.stderr.write('  ' + got + ' / ' + jobs.length + ' careers (' + Math.round((Date.now() - t0) / 1000) + ' s)\n'); }
        arm();
      });
      w.on('exit', () => { clearTimeout(timer); if (--alive === 0) finish(); });
      arm();
      w.send({ idx, jobs: idx.map(i => jobs[i]), DES });
    }
  });
}
const WORKER_IDLE_MS = 120000;
function playSafe(job, DES) {
  try { return playCareer(job.policy, job.seed, configOf(job.config), DES); }
  catch (e) { return { policy: job.policy, seed: job.seed, config: job.config, error: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }; }
}
if (ARG('worker')) {
  process.on('message', m => {
    let k = 0;
    const one = () => {
      if (k >= m.jobs.length) { process.disconnect(); return; }
      const i = m.idx[k], res = playSafe(m.jobs[k], m.DES); k++;
      process.send({ i, res }, () => setImmediate(one));
    };
    one();
  });
}

// ---- the aggregate of one config x one policy -------------------------------------------------------------------------
function paceOf(res, seg, price) {
  // contracts flown from the segment's start until their pay covers `price` (an empty wallet at the segment's start)
  let sum = 0, n = 0;
  for (const p of res.pays) if (p.seg === seg) { sum += p.pay; n++; if (sum >= price) return n; }
  return null;
}
function aggregate(results, DES) {
  const by = {};
  for (const r of results) {
    const k = r.config + '|' + r.policy;
    (by[k] = by[k] || []).push(r);
  }
  const out = {};
  for (const k of Object.keys(by)) {
    const L = by[k], ok = L.filter(r => !r.error), cfg = configOf(L[0].config);
    const home = C.careerNew({ id: 'p' }).sheds[C.PREM_MAIN];
    const price = id => C.econAirframePrice(DES[id].cost, home, DES[id].wants);
    const items = { cubClass: { seg: 1, price: price('cub') }, seat4: { seg: 2, price: price('c172') + (cfg.packs && cfg.packs[2] ? r100(cfg.packs[2].cubs * REF()) : 0) },
                    hangar: { seg: 1, price: (() => { const SH0 = Object.assign({}, C.ECON_BOOK.shells); if (cfg.shells) Object.assign(C.ECON_BOOK.shells, cfg.shells);
                      const v = C.plotPrice('w3', 'w3', 'field'); Object.assign(C.ECON_BOOK.shells, SH0); return v; })() } };
    const pace = {};
    for (const it of Object.keys(items)) { const v = ok.map(r => paceOf(r, items[it].seg, items[it].price)).filter(x => x != null); pace[it] = { med: median(v), p10: pct(v, 0.1), p90: pct(v, 0.9), price: items[it].price, n: v.length }; }
    const stages = {};
    for (const st of ['tutorial', 'seg1', 'seg2', 'seg3']) {
      const S = ok.map(r => r.stages[st]).filter(Boolean);
      if (!S.length) continue;
      const m = f => median(S.map(f).filter(x => x != null && isFinite(x)));
      stages[st] = { n: S.length, realH: m(x => x.realH), realH4: m(x => x.realH4), simH: m(x => x.simH), contracts: m(x => x.contracts),
                     routeShare: m(x => x.routeShare), restMed: m(x => x.rest.med), restP10: m(x => x.rest.p10), restP90: m(x => x.rest.p90),
                     over3: m(x => x.rest.over3), under03: m(x => x.rest.under03) };
    }
    const keys = {};
    for (const st of ['tutorial', 'seg1', 'seg2', 'seg3']) {
      const K = ok.map(r => r.keystones[st]).filter(Boolean);
      if (!K.length) continue;
      keys[st] = { reached: K.length, n: median(K.map(x => x.n)), realH: median(K.map(x => x.real / 3600)), fleet: median(K.map(x => x.fleet)),
                   types: median(K.map(x => x.types || 0)), routes: median(K.map(x => x.routes || 0)), wallet: median(K.map(x => x.wallet)) };
    }
    // money at rest along the career (the median over seeds at each completed count)
    const curve = [];
    const maxN = Math.max(0, ...ok.map(r => r.done));
    for (let n = 0; n <= maxN; n++) {
      const v = ok.map(r => { let s = null; for (const x of r.samples) { if (x.n <= n && x.rest != null) s = x; else if (x.n > n) break; } return s && s.rest; }).filter(x => x != null);
      if (v.length >= Math.max(1, ok.length / 2)) curve.push({ n, med: median(v), p10: pct(v, 0.1), p90: pct(v, 0.9) });
    }
    const inc = c => median(ok.map(r => r.income[c]));
    out[k] = {
      config: L[0].config, policy: L[0].policy, seeds: L.length, errors: L.filter(r => r.error).map(r => r.seed + ': ' + r.error),
      stuck: ok.filter(r => r.stuck).map(r => r.seed + ': ' + r.stuck),
      routeShare: median(ok.map(r => r.routeShare)), routeShareP90: pct(ok.map(r => r.routeShare), 0.9),
      done: median(ok.map(r => r.done)), realH: median(ok.map(r => r.real / 3600)), simH: median(ok.map(r => r.simH)), waitH: median(ok.map(r => r.waitH)),
      wallet: median(ok.map(r => r.wallet)), income: { contract: inc('contract'), story: inc('story'), route: inc('route'), routeDown: inc('routeDown'), prize: inc('prize') },
      spend: Object.fromEntries(Object.keys((ok[0] || { spend: {} }).spend).map(c => [c, median(ok.map(r => r.spend[c]))])),
      pace, stages, keys, curve, routeStory: ok[0] && ok[0].routeStory,
      payMed: Object.fromEntries([1, 2, 3].map(s => [s, median([].concat(...ok.map(r => r.pays.filter(p => p.seg === s).map(p => p.pay))))])),
      fleetEnd: ok[0] ? ok[0].fleetEnd : [],
    };
  }
  return out;
}
// the targets, judged on the aggregate of a config: { rows: [{ what, target, got, ok }] }
function judge(A, cfgName) {
  const g = p => A[cfgName + '|' + p];
  const rows = [];
  const fr = g('frugal'), co = g('collector'), ro = g('router');
  if (!fr) return rows;
  const band = (v, b) => v != null && v >= b[0] && v <= b[1];
  rows.push({ what: 'contracts to a Cub-class build (pace, frugal)', target: TARGETS.cubClass.join('-'), got: fr.pace.cubClass.med, ok: band(fr.pace.cubClass.med, TARGETS.cubClass) });
  rows.push({ what: 'contracts to a segment-2 4-seater (pace, frugal)', target: TARGETS.seat4.join('-'), got: fr.pace.seat4.med, ok: band(fr.pace.seat4.med, TARGETS.seat4) });
  rows.push({ what: 'contracts to a side hangar (pace, frugal)', target: TARGETS.hangar.join('-'), got: fr.pace.hangar.med, ok: band(fr.pace.hangar.med, TARGETS.hangar) });
  for (const p of POLICY_IDS) { const a = g(p); if (!a) continue;
    for (const st of ['seg1', 'seg2', 'seg3']) if (a.stages[st]) rows.push({ what: 'money at rest, ' + p + ', ' + st + ' (median)', target: TARGETS.rest.join('-'), got: a.stages[st].restMed, ok: band(a.stages[st].restMed, TARGETS.rest) }); }
  if (ro) rows.push({ what: 'route income share, router', target: '<= ' + TARGETS.routeShare, got: ro.routeShare, ok: ro.routeShare <= TARGETS.routeShare });
  for (const p of POLICY_IDS) { const a = g(p); if (a && p !== 'router') rows.push({ what: 'route income share, ' + p, target: '<= ' + TARGETS.routeShare, got: a.routeShare, ok: a.routeShare <= TARGETS.routeShare }); }
  const demo = (fr.stages.tutorial ? fr.stages.tutorial.realH : 0) + (fr.stages.seg1 ? fr.stages.seg1.realH : 0);
  const demo4 = (fr.stages.tutorial ? fr.stages.tutorial.realH4 : 0) + (fr.stages.seg1 ? fr.stages.seg1.realH4 : 0);
  rows.push({ what: 'the demo (tutorial + segment 1), real h at 1x, frugal', target: TARGETS.demoH.join('-'), got: demo, ok: band(demo, TARGETS.demoH) });
  rows.push({ what: 'the demo with the cruise at 4x (not in the game)', target: TARGETS.demoH.join('-'), got: demo4, ok: band(demo4, TARGETS.demoH) });
  if (co && fr && co.keys.seg3 && fr.keys.seg3) rows.push({ what: 'fleet at keystone 3: collector ahead of frugal', target: 'collector > frugal', got: co.keys.seg3.fleet + ' vs ' + fr.keys.seg3.fleet, ok: co.keys.seg3.fleet > fr.keys.seg3.fleet });
  for (const p of POLICY_IDS) { const a = g(p); if (a) rows.push({ what: p + ' finishes segment 3 (seeds)', target: 'all', got: (a.keys.seg3 ? a.keys.seg3.reached : 0) + ' / ' + a.seeds, ok: a.keys.seg3 && a.keys.seg3.reached === a.seeds }); }
  return rows;
}

// ---- the proposal's tables (what this session hands the coordinator) -----------------------------------------------------
function proposalTables(DES) {
  const ref = REF(), P = PROPOSED;
  const home = C.careerNew({ id: 'p' }).sheds[C.PREM_MAIN];
  const price = [];
  price.push({ item: 'T6\'s commitment fee (the story\'s, beside the route\'s down payment)', live: 0, proposed: P.storyFee, rule: 'a story effect (79_story.js routeOffer): the first real money, enough for any one T7 occasion' });
  price.push({ item: 'the story career\'s starting grant', live: C.CAREER_GRANT, proposed: P.grant, rule: 'the Rufus and the cabin are the start (§0); T6\'s down payment is the first money' });
  for (const k of ['cub', 'jodel', 'chinook', 'twinf', 'c172', 'c172f', 'cjodel']) {
    const D = DES[k], a = C.econAirframePrice(D.cost, home, D.wants);
    price.push({ item: 'airframe: ' + D.label + ' (segment ' + D.seg + ')', live: a, proposed: r100(a * (P.airframeF || 1)), rule: 'the ledger x labour 0.8 (unchanged)' });
  }
  for (const L of STORY_OCC()) price.push({ item: 'T7 occasion: ' + L.what, live: L.live, proposed: L.proposed, rule: 'x ' + P.occasionF + ' of the maker\'s catalogue (live 0.30-0.35)' });
  price.push({ item: 'segment occasions (' + P.occasions.perSeg + ' per segment)', live: null, proposed: 'x ' + P.occasionF + ' catalogue', rule: 'one-time listings at each segment\'s opening (sink 5)' });
  for (const s of Object.keys(P.packs)) price.push({ item: 'machine shop: ' + P.packs[s].words, live: 0, proposed: r100(P.packs[s].cubs * ref), rule: P.packs[s].cubs + ' Cubs (sink 2; today the main hangar holds every kit)' });
  for (const L of P.landmarks) price.push({ item: 'landmark: ' + L.words, live: 0, proposed: r100(L.cubs * ref), rule: L.cubs + ' Cubs' + (L.keystone ? ', required to open the next segment' : ', optional') + ' (sink 1)' });
  { const SH0 = Object.assign({}, C.ECON_BOOK.shells);
    for (const [aero, plot] of [['w3', 'w3'], ['tw_ski', 'tw_ski'], ['mk_sea', 'mk_sea'], ['SEA', 'SEA']]) for (const sh of C.BASE_OFFERS[aero].plots[plot].shells) {
      const live = C.plotPrice(aero, plot, sh); Object.assign(C.ECON_BOOK.shells, P.shells); const pr = C.plotPrice(aero, plot, sh); Object.assign(C.ECON_BOOK.shells, SH0);
      price.push({ item: 'side hangar: ' + sh + ' at ' + C.CONTRACT_FIELDS[aero].name, live, proposed: pr, rule: 'ECON_BOOK.shells.' + sh + ' ' + SH0[sh] + ' -> ' + P.shells[sh] + ' Cubs x the plot factor (sink 3)' });
    } }
  for (const Cm of P.comps) price.push({ item: 'competition: ' + Cm.words + ' (segment ' + Cm.seg + ')', live: null, proposed: r100(Cm.fee * ref), rule: 'entry ' + Cm.fee + ' Cubs, prizes x' + Cm.prizes.join(' / x') + ' (sink 4; not in the game)' });
  for (const t of ['rookie', 'pilot', 'ace']) price.push({ item: 'pilot sign-on (' + t + ')', live: C.econSignOn(t), proposed: C.econSignOn(t), rule: 'unchanged' });
  // the route pay table: per round trip and down payment, live vs proposed, for the designs on typical routes
  const routes = [];
  const pairs = [['SEA', 'HOME'], ['HOME', 'w3'], ['HOME', 'tw_ski'], ['HOME', 'mn_strip'], ['HOME', 'w6']];
  const RP0 = Object.assign({}, C.ROUTES_PAY);
  for (const [a, b] of pairs) for (const k of ['cub', 'c172', 'cjodel']) {
    const D = DES[k], km = C.contractKm(a, b);
    if ((C.CONTRACT_FIELDS[a].surf === 'water' || C.CONTRACT_FIELDS[b].surf === 'water') && D.gear !== 'floats' && k !== 'cub') continue;
    const L = C.routeTerms(km, D);
    Object.assign(C.ROUTES_PAY, P.routes); const Q = timetable(C.routeTerms(km, D), P); Object.assign(C.ROUTES_PAY, RP0);
    routes.push({ route: C.CONTRACT_FIELDS[a].name + ' - ' + C.CONTRACT_FIELDS[b].name, km: Math.round(km * 10) / 10, design: D.label,
                  live: { pay: L.pay, down: L.down, tripMin: Math.round(L.tripS / 60), perDay: Math.round(L.pay * 86400 / L.tripS) },
                  proposed: { pay: Q.pay, down: Q.down, tripMin: Math.round(Q.tripS / 60), perDay: Math.round(Q.pay * 86400 / Q.tripS) },
                  airframe: C.econAirframePrice(D.cost, home, D.wants) });
  }
  return { price, routes, routesPay: { live: RP0, proposed: Object.assign({}, RP0, P.routes, { dayTrips: P.dayTrips }) } };
}
function STORY_OCC() {
  const d = C.careerNew({ id: 'o' }); const r = C.storyNewCareer(d, { aeros: AEROS }); const x = r.doc;
  x.career.story.occasions = C.STORY_OCCASIONS.map(L => L.id);
  return C.storyOccasionListings(x).map(L => ({ what: L.id + ' (' + L.design + ')', live: L.price, proposed: r100(L.catalogue * PROPOSED.occasionF) }));
}
// THE CALIBRATION ROWS PROPOSED for tools/_econ_check.js (a proposal: GATE ECON is not changed by this tool)
function calibrationRows(A) {
  const fr = A['proposed|frugal'], ro = A['proposed|router'], co = A['proposed|collector'];
  const f = (v, d) => v == null ? 'null' : (Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0));
  const lines = [
    '// G3250-G3259 ECON-SIM (proposed, not live): the story career\'s bands, measured by tools/econ_sim.js on the',
    '// proposal\'s table (median of ' + (fr ? fr.seeds : '?') + ' seeds per policy; the pace = contracts of the segment\'s own pay to the price)',
    'const ECON_BANDS_STORY = {',
    '  cubClass:   [3, 4],      // a Cub-class build (the scratch Cub)          measured ' + f(fr && fr.pace.cubClass.med, 1),
    '  seat4:      [6, 8],      // a segment-2 4-seater (+ its machine-shop rung) measured ' + f(fr && fr.pace.seat4.med, 1),
    '  hangar1:    [8, 12],     // a side hangar (a field shed at Tamgas Hill)   measured ' + f(fr && fr.pace.hangar.med, 1),
    '  rest:       [0.3, 3],    // money at rest, every policy, every segment (median)',
    '  routeShare: [0, 0.40],   // route income / all income, the router          measured ' + f(ro && ro.routeShare, 2),
    '  keystones:  3,           // every policy reaches keystone 3 on every seed',
    '};',
    'const ECON_REF_STORY = {   // the reference: tools/econ_sim.js playCareer (the story T0-T7, then open play)',
    '  seeds: ' + JSON.stringify(Array.from({ length: 8 }, (_, i) => 's' + (i + 1))) + ',',
    '  policies: [\'frugal\', \'router\'],   // the pace on the frugal, the share on the router',
    '  segK: ' + JSON.stringify(SEG_K) + ',',
    '};',
  ];
  return lines.join('\n');
}

// ---- THE PAGE (self-contained: the garage's look, IBM Plex Sans inlined from vendor/fonts, inline SVG, no script but
// the tooltip) ----------------------------------------------------------------------------------------------------------
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (v, d) => v == null || !isFinite(v) ? '-' : (typeof v === 'number' ? (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US').replace(/,/g, ' ') : (+v).toFixed(d == null ? 1 : d)) : String(v));
const SERIES = { live: 'var(--s-live)', proposed: 'var(--s-prop)' };
function svgRest(A, policy, w, h) {
  const pad = { l: 40, r: 12, t: 14, b: 26 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
  const curves = ['live', 'proposed'].map(c => ({ c, a: A[c + '|' + policy] })).filter(x => x.a);
  const maxN = Math.max(10, ...curves.map(x => x.a.curve.length ? x.a.curve[x.a.curve.length - 1].n : 0));
  const lo = Math.log10(0.1), hi = Math.log10(100);
  const X = n => pad.l + n / maxN * W, Y = v => pad.t + H - (Math.log10(Math.max(0.1, Math.min(100, v))) - lo) / (hi - lo) * H;
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="money at rest, ' + policy + '">';
  s += '<rect x="' + pad.l + '" y="' + Y(3) + '" width="' + W + '" height="' + (Y(0.3) - Y(3)) + '" class="band"/>';
  for (const v of [0.1, 0.3, 1, 3, 10, 30, 100]) s += '<line x1="' + pad.l + '" x2="' + (pad.l + W) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="grid"/><text x="' + (pad.l - 5) + '" y="' + (Y(v) + 3) + '" class="ax" text-anchor="end">' + v + '</text>';
  for (let n = 0; n <= maxN; n += 20) s += '<text x="' + X(n) + '" y="' + (h - 8) + '" class="ax" text-anchor="middle">' + n + '</text>';
  for (const { c, a } of curves) {
    const pts = a.curve;
    if (!pts.length) continue;
    s += '<path class="area" style="fill:' + SERIES[c] + '" d="M' + pts.map(p => X(p.n) + ',' + Y(p.p90)).join('L') + 'L' + pts.slice().reverse().map(p => X(p.n) + ',' + Y(p.p10)).join('L') + 'Z"/>';
    s += '<path class="line" style="stroke:' + SERIES[c] + '" d="M' + pts.map(p => X(p.n) + ',' + Y(p.med)).join('L') + '"/>';
    for (const st of ['seg1', 'seg2']) if (a.keys[st]) s += '<line class="key" style="stroke:' + SERIES[c] + '" x1="' + X(a.keys[st].n) + '" x2="' + X(a.keys[st].n) + '" y1="' + pad.t + '" y2="' + (pad.t + H) + '"><title>' + c + ': keystone ' + st.slice(3) + ' at contract ' + a.keys[st].n + '</title></line>';
    for (const p of pts.filter((p, i) => i % 2 === 0)) s += '<circle class="hit" cx="' + X(p.n) + '" cy="' + Y(p.med) + '" r="5" data-tip="' + esc(c + ' · contract ' + p.n + ' · at rest ' + fmt(p.med, 2) + ' (p10 ' + fmt(p.p10, 2) + ', p90 ' + fmt(p.p90, 2) + ')') + '"/>';
  }
  return s + '</svg>';
}
function svgBars(rows, w, opts) {
  // rows: [{ label, vals: [{ c, v, tip }] }], horizontal grouped bars; opts: { max, line, unit }
  const rowH = 30, pad = { l: 120, r: 50, t: 6, b: 18 }, h = pad.t + pad.b + rows.length * rowH, W = w - pad.l - pad.r;
  const max = opts.max || Math.max(...rows.map(r => Math.max(...r.vals.map(v => v.v || 0)))) * 1.1 || 1;
  const X = v => pad.l + Math.max(0, Math.min(1, v / max)) * W;
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img">';
  rows.forEach((r, i) => {
    const y0 = pad.t + i * rowH;
    s += '<text x="' + (pad.l - 8) + '" y="' + (y0 + rowH / 2 + 4) + '" class="lab" text-anchor="end">' + esc(r.label) + '</text>';
    r.vals.forEach((v, j) => {
      const y = y0 + 4 + j * 11, x1 = X(v.v || 0);
      s += '<rect x="' + pad.l + '" y="' + y + '" width="' + Math.max(1, x1 - pad.l) + '" height="9" rx="2" style="fill:' + SERIES[v.c] + '" data-tip="' + esc(v.tip) + '"/>';
      s += '<text x="' + (x1 + 4) + '" y="' + (y + 8) + '" class="val">' + esc(opts.f ? opts.f(v.v) : fmt(v.v)) + '</text>';
    });
  });
  if (opts.line != null) s += '<line class="target" x1="' + X(opts.line) + '" x2="' + X(opts.line) + '" y1="' + pad.t + '" y2="' + (h - pad.b) + '"/><text x="' + X(opts.line) + '" y="' + (h - 5) + '" class="ax" text-anchor="middle">' + esc(opts.lineLabel || '') + '</text>';
  return s + '</svg>';
}
function svgPace(A, w) {
  const items = [['cubClass', 'Cub-class build', TARGETS.cubClass], ['seat4', 'segment-2 4-seater', TARGETS.seat4], ['hangar', 'side hangar', TARGETS.hangar]];
  const pad = { l: 140, r: 20, t: 8, b: 24 }, rowH = 34, h = pad.t + pad.b + items.length * rowH, W = w - pad.l - pad.r, max = 16;
  const X = v => pad.l + Math.min(max, Math.max(0, v)) / max * W;
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="contracts to a purchase">';
  for (let v = 0; v <= max; v += 2) s += '<line class="grid" x1="' + X(v) + '" x2="' + X(v) + '" y1="' + pad.t + '" y2="' + (h - pad.b) + '"/><text class="ax" x="' + X(v) + '" y="' + (h - 8) + '" text-anchor="middle">' + v + '</text>';
  items.forEach(([k, label, T], i) => {
    const y = pad.t + i * rowH + rowH / 2;
    s += '<text class="lab" x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + label + '</text>';
    s += '<rect class="band" x="' + X(T[0]) + '" y="' + (y - 11) + '" width="' + (X(T[1]) - X(T[0])) + '" height="22" rx="3"/>';
    ['live', 'proposed'].forEach((c, j) => {
      const a = A[c + '|frugal'];
      if (!a || a.pace[k].med == null) return;
      const v = a.pace[k].med;
      s += '<circle cx="' + X(v) + '" cy="' + (y - 4 + j * 8) + '" r="5" style="fill:' + SERIES[c] + '" class="dot" data-tip="' + esc(c + ': ' + fmt(v, 1) + ' contracts (p10 ' + fmt(a.pace[k].p10, 0) + ', p90 ' + fmt(a.pace[k].p90, 0) + '), price ' + fmt(a.pace[k].price)) + '"/>';
      s += '<text class="val" x="' + (X(v) + 8) + '" y="' + (y - 1 + j * 8) + '">' + (v > max ? '>' + max : fmt(v, 1)) + '</text>';
    });
  });
  return s + '</svg>';
}
function page(R) {
  const { A, judgeLive, judgeProp, tables, calib, abl, sweep, DES, meta } = R;
  const font = (() => { try { return fs.readFileSync(path.join(ROOT, 'vendor', 'fonts', 'plex-sans-var.woff2')).toString('base64'); } catch (e) { return null; } })();
  const tbl = (head, rows) => '<div class="tw"><table><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i && typeof c !== 'string' ? ' class="n"' : '') + '>' + (typeof c === 'string' && c.startsWith('<') ? c : esc(typeof c === 'number' ? fmt(c, c < 10 && c % 1 ? 2 : 0) : c)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const pill = ok => ok ? '<span class="ok">✓ meets</span>' : '<span class="no">✕ misses</span>';
  const jt = J => tbl(['measure', 'target', 'measured', ''], J.map(r => [r.what, String(r.target), typeof r.got === 'number' ? fmt(r.got, r.got < 1 ? 2 : 1) : String(r.got), pill(r.ok)]));
  const legend = '<div class="legend"><span><i style="background:var(--s-live)"></i>live (master today)</span><span><i style="background:var(--s-prop)"></i>proposed table</span><span><i class="bandsw"></i>target band</span></div>';
  const stRows = cfgN => POLICY_IDS.map(p => { const a = A[cfgN + '|' + p]; if (!a) return null; const g = st => a.stages[st] || {};
    return [p, g('tutorial').realH, g('seg1').realH, g('seg2').realH, g('seg3').realH, (g('tutorial').realH4 || 0) + (g('seg1').realH4 || 0), g('seg1').simH, g('seg2').simH, g('seg3').simH, a.waitH]; }).filter(Boolean);
  const keyRows = cfgN => POLICY_IDS.map(p => { const a = A[cfgN + '|' + p]; if (!a) return null; const k = st => a.keys[st] ? a.keys[st].fleet + ' / ' + a.keys[st].types + ' types / ' + a.keys[st].routes + ' rt @ ' + a.keys[st].n : '- (' + 0 + ')';
    return [p, k('seg1'), k('seg2'), k('seg3'), (a.keys.seg3 ? a.keys.seg3.reached : 0) + ' / ' + a.seeds]; }).filter(Boolean);
  const incRows = cfgN => POLICY_IDS.map(p => { const a = A[cfgN + '|' + p]; if (!a) return null;
    return [p, a.income.story + a.income.contract, a.income.routeDown, a.income.route, a.income.prize, a.routeShare, a.wallet, a.done]; }).filter(Boolean);
  const restRows = cfgN => [].concat(...POLICY_IDS.map(p => { const a = A[cfgN + '|' + p]; if (!a) return [];
    return ['seg1', 'seg2', 'seg3'].filter(s => a.stages[s]).map(s => [p + ' ' + s, a.stages[s].restMed, a.stages[s].restP10, a.stages[s].restP90, a.stages[s].over3, a.stages[s].under03, a.stages[s].routeShare]); }));
  const css = `
${font ? `@font-face { font-family: 'IBM Plex Sans'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 700; font-style: normal; }` : ''}
:root { color-scheme: dark;
  --bg:#1a1815; --panel:#201d1a; --ink:#f4efe6; --dim:#c0b8ac; --faint:#97907f; --acc:#e6dbc9; --hair:rgba(255,248,236,.09);
  --border:rgba(255,248,236,.14); --soft:rgba(230,219,201,.10); --warn:#d8a07a; --good:#9fc59a;
  --s-live:#d95926; --s-prop:#3987e5; }
/* the garage is dark; a light page only when asked (data-theme="light" on the root) */
:root[data-theme="light"] { color-scheme: light;
  --bg:#f6f2ea; --panel:#fffdf8; --ink:#221f1b; --dim:#524c43; --faint:#7a7266; --acc:#221f1b; --hair:rgba(34,31,27,.10);
  --border:rgba(34,31,27,.16); --soft:rgba(34,31,27,.06); --warn:#9a5a2e; --good:#3b7a35; --s-live:#eb6834; --s-prop:#2a78d6; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:400 14px/1.55 'IBM Plex Sans', system-ui, sans-serif; }
main { max-width: 1060px; margin: 0 auto; padding: 28px 16px 64px; }
h1 { font-weight:600; font-size:24px; margin:0 0 4px; letter-spacing:.01em; }
h2 { font-weight:600; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--faint); margin:36px 0 10px; border-top:1px solid var(--hair); padding-top:18px; }
h3 { font-weight:600; font-size:14px; margin:14px 0 6px; color:var(--dim); }
p, li { color:var(--dim); max-width: 78ch; overflow-wrap: anywhere; } b, strong { color:var(--ink); font-weight:600; }
.sub { color:var(--faint); margin:0 0 18px; }
.grid4 { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px; }
.card { background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
.card h3 { margin:0 0 4px; color:var(--ink); }
.tw { overflow-x:auto; } table { border-collapse: collapse; width:100%; font-size:12.5px; }
th { text-align:left; font-weight:500; color:var(--faint); border-bottom:1px solid var(--border); padding:5px 8px; white-space:nowrap; }
td { border-bottom:1px solid var(--hair); padding:5px 8px; color:var(--dim); } td.n { text-align:right; font-variant-numeric: tabular-nums; color:var(--ink); }
.ok { color:var(--good); white-space:nowrap; } .no { color:var(--warn); white-space:nowrap; }
svg { width:100%; height:auto; display:block; max-width:720px; font-family:'IBM Plex Sans', system-ui, sans-serif; }
svg .grid { stroke:var(--hair); stroke-width:1; } svg .ax { fill:var(--faint); font-size:10px; } svg .lab { fill:var(--dim); font-size:11px; } svg .val { fill:var(--ink); font-size:10px; }
svg .band { fill:var(--soft); } svg .line { fill:none; stroke-width:2; } svg .area { opacity:.16; } svg .key { stroke-width:1; stroke-dasharray:3 3; opacity:.8; }
svg .hit { fill:transparent; } svg .target { stroke:var(--warn); stroke-width:1.5; stroke-dasharray:4 3; }
.legend { display:flex; flex-wrap:wrap; gap:16px; font-size:12px; color:var(--dim); margin:6px 0 10px; } .legend i { display:inline-block; width:12px; height:4px; border-radius:2px; margin-right:6px; vertical-align:middle; }
.legend i.bandsw { height:10px; background:var(--soft); border:1px solid var(--border); }
pre { background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:12px; overflow-x:auto; font:12px/1.5 'IBM Plex Mono', ui-monospace, monospace; color:var(--ink); }
#tip { position:fixed; pointer-events:none; background:var(--panel); border:1px solid var(--border); color:var(--ink); font-size:12px; padding:4px 8px; border-radius:6px; display:none; max-width:320px; z-index:9; }
.rec { background:var(--panel); border:1px solid var(--border); border-left:3px solid var(--s-prop); border-radius:8px; padding:12px 16px; }
`;
  const recs = R.recommend.map(x => '<li>' + x + '</li>').join('');
  let h = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Economy simulation</title><style>' + css + '</style></head><body><main>';
  h += '<h1>The economy simulation</h1><p class="sub">G3250-G3259 ECON-SIM · ' + esc(meta.when) + ' · ' + meta.seeds + ' seeds × 4 policies × live / proposed, on the game\'s own core (' + esc(meta.core) + '). GAME-PLAN §12.</p>';
  h += '<div class="rec"><h3 style="margin-top:0;color:var(--ink)">The recommendation, in plain words</h3><ul>' + recs + '</ul></div>';
  h += '<h2>Targets: the proposal</h2>' + jt(judgeProp) + '<h2>Targets: master today (live)</h2>' + jt(judgeLive);
  h += '<h2>Money at rest along a career</h2><p>The wallet divided by the next meaningful purchase, after each contract (median of the seeds; the shade is p10-p90). The band is 0.3-3: below is grind, above is money as a joke. Dashed: the keystones. Log scale.</p>' + legend;
  h += '<div class="grid4">' + POLICY_IDS.map(p => '<div class="card"><h3>' + p + '</h3>' + svgRest(A, p, 300, 190) + '</div>').join('') + '</div>';
  h += '<h3>The same, per segment (proposal)</h3>' + tbl(['policy · segment', 'median', 'p10', 'p90', 'share > 3', 'share < 0.3', 'route share'], restRows('proposed'));
  h += '<h3>Live</h3>' + tbl(['policy · segment', 'median', 'p10', 'p90', 'share > 3', 'share < 0.3', 'route share'], restRows('live'));
  h += '<h2>Contracts to a purchase (the pace)</h2><p>The contracts of a segment\'s own pay, from an empty wallet at its start, that buy the item (the frugal\'s fleet). The proposal\'s 4-seater includes its machine-shop rung.</p>' + legend + '<div class="card">' + svgPace(A, 640) + '</div>';
  h += '<h2>Route income share</h2><p>Down payments and round trips, over all income. The line is §12\'s 40 %.</p>' + legend;
  h += '<div class="card">' + svgBars(POLICY_IDS.map(p => ({ label: p, vals: ['live', 'proposed'].filter(c => A[c + '|' + p]).map(c => ({ c, v: A[c + '|' + p].routeShare, tip: c + ' ' + p + ': ' + Math.round(100 * A[c + '|' + p].routeShare) + ' % (p90 ' + Math.round(100 * A[c + '|' + p].routeShareP90) + ' %)' })) })), 640, { max: 1, line: 0.4, lineLabel: '40 %', f: v => Math.round(100 * v) + ' %' }) + '</div>';
  h += '<h3>Income (median, credits)</h3>' + tbl(['policy', 'contracts + story', 'route down payments', 'round trips', 'prizes', 'route share', 'wallet at the end', 'contracts'], incRows('proposed').map(r => ['proposed ' + r[0]].concat(r.slice(1))).concat(incRows('live').map(r => ['live ' + r[0]].concat(r.slice(1)))));
  h += '<h2>Hours</h2><p>Real hours at 1× (the game\'s career flies at 1×: a leg is its cruise + ' + Math.round(LEG_OVH_S / 60) + ' min of taxi, take-off, circuit and landing; menus and the editor cost the minutes in REAL_S). "Demo at 4×" flies the cruise four times faster: a compression the game does not have. Sim hours include the waits (windows, nights).</p>';
  h += '<h3>Proposal</h3>' + tbl(['policy', 'tutorial h', 'seg 1 h', 'seg 2 h', 'seg 3 h', 'demo at 4× h', 'seg 1 sim h', 'seg 2 sim h', 'seg 3 sim h', 'waited sim h'], stRows('proposed'));
  h += '<h3>Live</h3>' + tbl(['policy', 'tutorial h', 'seg 1 h', 'seg 2 h', 'seg 3 h', 'demo at 4× h', 'seg 1 sim h', 'seg 2 sim h', 'seg 3 sim h', 'waited sim h'], stRows('live'));
  h += '<h2>The fleet at each keystone</h2><p>Planes / types owned / routes flying @ the contract count (median).</p><h3>Proposal</h3>' + tbl(['policy', 'keystone 1', 'keystone 2', 'keystone 3', 'finished'], keyRows('proposed')) + '<h3>Live</h3>' + tbl(['policy', 'keystone 1', 'keystone 2', 'keystone 3', 'finished'], keyRows('live'));
  if (abl && abl.length) h += '<h2>The sinks, one at a time</h2><p>The proposal minus one sink (or with today\'s route terms), ' + meta.ablSeeds + ' seeds. The question each row answers: what does this sink hold?</p>' + tbl(['variant', 'policy', 'rest seg 1', 'rest seg 2', 'rest seg 3', 'share > 3', 'route share', 'finished'], abl);
  if (sweep && sweep.length) h += '<h2>The route pay sweep (the router)</h2><p>perKm × the timetable (round trips a sim day; 0 = none), the rest of the proposal held, ' + meta.sweepSeeds + ' seeds.</p>' + tbl(['perKm', 'trips a day', 'route share', 'p90', 'rest seg 1', 'rest seg 2', 'down payment, story Cub'], sweep);
  h += '<h2>The proposed price table</h2>' + tbl(['item', 'live', 'proposed', 'rule'], tables.price.map(r => [r.item, r.live == null ? '-' : r.live, r.proposed == null ? '-' : r.proposed, r.rule]));
  h += '<h2>The route pay table</h2><p>ROUTES_PAY live ' + esc(JSON.stringify(tables.routesPay.live)) + ' → proposed ' + esc(JSON.stringify(tables.routesPay.proposed)) + '. "a day": what one route earns in a sim day.</p>' +
    tbl(['route', 'km', 'design', 'airframe', 'live trip', 'live down', 'live min', 'live a day', 'proposed trip', 'proposed down', 'proposed min', 'proposed a day'],
        tables.routes.map(r => [r.route, r.km, r.design, r.airframe, r.live.pay, r.live.down, r.live.tripMin, r.live.perDay, r.proposed.pay, r.proposed.down, r.proposed.tripMin, r.proposed.perDay]));
  h += '<h2>The calibration rows proposed for tools/_econ_check.js</h2><p>Not applied: GATE ECON\'s live bands are unchanged until the coordinator and the user say so.</p><pre>' + esc(calib) + '</pre>';
  h += '<h2>The designs (measured off their build files)</h2>' + tbl(['id', 'design', 'segment', 'seats', 'baggage kg', 'cruise km/h', 'take-off m', 'range km', 'gear', 'ledger', 'source'],
    Object.keys(DES).map(k => [k, DES[k].label, DES[k].seg, DES[k].seats, DES[k].bagKg, Math.round(DES[k].cruiseKmh), Math.round(DES[k].toM), Math.round(DES[k].rangeKm), DES[k].gear, Math.round(DES[k].cost), DES[k].src]));
  h += '<h2>How it was measured</h2><ul>' + meta.notes.map(n => '<li>' + n + '</li>').join('') + '</ul>';
  h += '<div id="tip"></div><script>(function(){var t=document.getElementById("tip");document.addEventListener("mousemove",function(e){var el=e.target.closest&&e.target.closest("[data-tip]");if(!el){t.style.display="none";return;}t.textContent=el.getAttribute("data-tip");t.style.display="block";t.style.left=Math.min(innerWidth-330,e.clientX+12)+"px";t.style.top=(e.clientY+14)+"px";});})();</script>';
  return h + '</main></body></html>';
}

// ---- MAIN ---------------------------------------------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  const seeds = +(ARG('seeds') || 20), nW = Math.max(1, Math.min(6, +(ARG('jobs') || os.cpus().length)));
  process.stderr.write('ECON-SIM: measuring the designs off their build files...\n');
  const DES = measureDesigns();
  const cfgs = ARG('config') && ARG('config') !== true ? String(ARG('config')).split(',') : ['live', 'proposed'];
  const jobs = [];
  for (const config of cfgs) for (const policy of POLICY_IDS) for (let i = 1; i <= seeds; i++) jobs.push({ policy, seed: 's' + i, config });
  const ablSeeds = Math.min(seeds, 5), sweepSeeds = Math.min(seeds, 5);
  const ablJobs = [], sweepJobs = [];
  if (ARG('ablate')) for (const a of Object.keys(ABLATIONS)) for (const policy of POLICY_IDS) for (let i = 1; i <= ablSeeds; i++) ablJobs.push({ policy, seed: 's' + i, config: a });
  if (ARG('sweep')) for (const k of [100, 60, 40, 30, 20]) for (const t of [0, 12, 6, 4]) for (let i = 1; i <= sweepSeeds; i++) sweepJobs.push({ policy: 'router', seed: 's' + i, config: 'sweep:' + k + ':' + t });
  process.stderr.write('ECON-SIM: ' + jobs.length + ' careers' + (ablJobs.length ? ' + ' + ablJobs.length + ' ablation' : '') + (sweepJobs.length ? ' + ' + sweepJobs.length + ' sweep' : '') + ' on ' + nW + ' workers\n');
  const all = await runJobs(jobs.concat(ablJobs, sweepJobs), DES, nW);
  const res = all.slice(0, jobs.length), resA = all.slice(jobs.length, jobs.length + ablJobs.length), resS = all.slice(jobs.length + ablJobs.length);
  const A = aggregate(res, DES);
  const judgeLive = cfgs.includes('live') ? judge(A, 'live') : [], judgeProp = cfgs.includes('proposed') ? judge(A, 'proposed') : [];
  const tables = proposalTables(DES), calib = calibrationRows(A);
  const AA = aggregate(resA, DES), abl = [];
  for (const k of Object.keys(AA)) { const a = AA[k], g = s => a.stages[s] ? a.stages[s].restMed : null;
    abl.push([a.config, a.policy, g('seg1'), g('seg2'), g('seg3'), a.stages.seg2 ? a.stages.seg2.over3 : null, a.routeShare, (a.keys.seg3 ? a.keys.seg3.reached : 0) + ' / ' + a.seeds]); }
  const AS = aggregate(resS, DES), sweep = [];
  for (const k of Object.keys(AS)) { const a = AS[k], [, km, tr] = a.config.split(':');
    sweep.push([+km, +tr, a.routeShare, a.routeShareP90, a.stages.seg1 ? a.stages.seg1.restMed : null, a.stages.seg2 ? a.stages.seg2.restMed : null, a.routeStory ? a.routeStory.down : null]); }
  const errs = [].concat(...Object.values(A).map(a => a.errors), ...Object.values(AA).map(a => a.errors), ...Object.values(AS).map(a => a.errors));
  const stuck = [].concat(...Object.values(A).map(a => a.stuck.map(s => a.config + ' ' + a.policy + ' ' + s)));
  // ---- print
  const P = (s) => console.log(s);
  P('ECON-SIM: ' + res.length + ' careers in ' + Math.round((Date.now() - t0) / 1000) + ' s' + (errs.length ? ', ' + errs.length + ' ERRORS' : '') + (stuck.length ? ', ' + stuck.length + ' stuck' : ''));
  for (const e of errs.slice(0, 10)) P('  error: ' + e);
  for (const e of stuck.slice(0, 10)) P('  stuck: ' + e);
  for (const [name, J] of [['live', judgeLive], ['proposed', judgeProp]]) {
    if (!J.length) continue;
    P('\n== ' + name.toUpperCase() + ': the targets');
    for (const r of J) P('  ' + (r.ok ? 'meets ' : 'MISSES') + '  ' + r.what.padEnd(58) + ' target ' + String(r.target).padEnd(18) + ' got ' + (typeof r.got === 'number' ? fmt(r.got, r.got < 1 ? 2 : 1) : r.got));
  }
  for (const k of Object.keys(A)) { const a = A[k];
    P('\n' + k + ': done ' + a.done + ', real ' + fmt(a.realH, 1) + ' h, wallet ' + fmt(a.wallet) + ', route share ' + fmt(a.routeShare, 2) + ', pay/contract ' + [1, 2, 3].map(s => fmt(a.payMed[s])).join(' / '));
    for (const st of Object.keys(a.stages)) { const s = a.stages[st]; P('   ' + st.padEnd(9) + ' real ' + fmt(s.realH, 2) + ' h (4x ' + fmt(s.realH4, 2) + ')  sim ' + fmt(s.simH, 1) + ' h  contracts ' + s.contracts + '  rest ' + fmt(s.restMed, 2) + ' [' + fmt(s.restP10, 2) + '-' + fmt(s.restP90, 2) + ']  >3 ' + fmt(s.over3, 2) + '  route ' + fmt(s.routeShare, 2)); }
    P('   pace: cub ' + fmt(a.pace.cubClass.med, 1) + ', seat4 ' + fmt(a.pace.seat4.med, 1) + ', hangar ' + fmt(a.pace.hangar.med, 1) + '   keystones ' + Object.keys(a.keys).map(s => s + '@' + a.keys[s].n + ' fleet ' + a.keys[s].fleet).join(', '));
  }
  if (abl.length) { P('\n== THE SINKS, ONE AT A TIME'); for (const r of abl) P('  ' + r.map(x => typeof x === 'number' ? fmt(x, 2) : x).join('  ')); }
  if (sweep.length) { P('\n== THE ROUTE SWEEP (router)'); for (const r of sweep) P('  ' + r.map(x => typeof x === 'number' ? fmt(x, 2) : x).join('  ')); }
  P('\n' + calib);
  // ---- write
  if (!ARG('no-page')) {
    const outDir = path.resolve(ROOT, typeof ARG('out') === 'string' ? ARG('out') : 'futureDesigns/game/econ-sim');
    fs.mkdirSync(outDir, { recursive: true });
    const meta = { when: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', seeds, ablSeeds, sweepSeeds,
      core: 'tools/flight_core.js ' + crypto.createHash('sha1').update(fs.readFileSync(path.join(__dirname, 'flight_core.js'))).digest('hex').slice(0, 10),
      notes: NOTES() };
    const R = { A, judgeLive, judgeProp, tables, calib, abl, sweep, DES, meta, recommend: RECOMMEND(A, judgeProp, judgeLive, tables) };
    fs.writeFileSync(path.join(outDir, 'index.html'), page(R));
    const slim = {}; for (const k of Object.keys(A)) { const { curve, ...rest } = A[k]; slim[k] = Object.assign(rest, { curve: curve.filter((x, i) => i % 3 === 0) }); }
    fs.writeFileSync(path.join(outDir, 'econ_sim_results.json'), JSON.stringify({ meta, targets: TARGETS, segK: SEG_K, live: LIVE, proposed: PROPOSED, judgeLive, judgeProp, aggregate: slim, tables, ablation: abl, sweep }, null, 1));
    P('\nwrote ' + path.relative(ROOT, path.join(outDir, 'index.html')) + ' and econ_sim_results.json');
  }
}
// the measuring notes on the page
function NOTES() {
  return [
    'Every career starts with careerNew + storyNewCareer (the cabin found by name: the Cabin Strip, w1) and plays T0-T7 through storyStep / storyApply: the Rufus flies to HOME, the client\'s Cub is finished to the checklist (the client pays the work: no wallet line, as the page does), delivered to strip 11, given, flies T5\'s three authored jobs through contractOnStop, goes on floats (an edit: free today) and lands at the seaplane base, where T6 signs the real route with Kit (routeOffer + routeSign: the down payment).',
    'Open play: each contract is the offer (careerOfferIds: the real generator, arcs, build contracts, night work) with the best pay per real minute that one free plane of the fleet can fly (contractDoers over the measured designs); flown leg by leg (positioning unpaid), each stop handed to contractOnStop. A windowed job is left for later when its window opens more than ' + WINDOW_DEFER_H + ' h away; outside its window the player waits on the ground; a day leg is not flown between dusk and dawn (the night is waited out). Routes settle at every landing and wait (routeSettle), as the page does.',
    'Build contracts: the cheapest design of the open segments that meets every criterion (read off its certificate numbers) is built (paid, the ledger x labour), flown to the client and delivered (it leaves the fleet). xwindKt / batteryKWh criteria are not attempted.',
    'Segments are the sim\'s (TECH-MASK is not in the game): a design\'s segment is what it wants of a hangar (tube / wood 1, metal 2, composite 3); a segment opens its designs (and, in the proposal, after its machine-shop rung is bought); its keystone stands after ' + JSON.stringify(SEG_K) + ' contracts flown in it, and in the proposal once its landmark is co-funded.',
    'Real time: every leg at 1× (cruise + ' + LEG_OVH_S + ' s), plus ' + Object.entries(REAL_S).map(([k, v]) => k + ' ' + Math.round(v / 60) + ' min').join(', ') + '. These are estimates: the page measures nothing of a player.',
    'The pace ("contracts to X") is the contracts flown from the start of the segment that sells X until their pay covers its price: the earning rate, not when a policy happened to buy.',
    'Money at rest = the wallet / the cheapest thing the stage still offers that is not owned yet (an airframe type, an occasion, a side hangar, the segment\'s landmarks and the next rung); nothing left: the next segment\'s cheapest airframe.',
    'Competitions are NOT in the game: the competitor in the live config buys the class designs (a fast one, a short-field one) and favours the challenge contracts; in the proposal it builds a dedicated design per class and enters every round (35 / 30 / 20 % gold / silver / bronze).',
    'Not modelled: selling, damage (repair is free, a crash resets: no money), the used market beyond the occasions, the makers\' catalogue (a maker costs more than building), reputation\'s effect beyond what the generator already reads, the player\'s own exploration time.',
  ];
}
// the plain-words recommendation (from the measured aggregate)
function RECOMMEND(A, JP, JL, T) {
  const L = k => A['live|' + k], Pp = k => A['proposed|' + k], out = [];
  const f1 = v => fmt(v, 1), pc = v => Math.round(100 * v) + ' %';
  if (L('router') && Pp('router')) out.push('<b>Routes are the economy\'s leak today.</b> A route pays its down payment up front (8 round trips): a metal Cessna on HOME - strip 11 brings ' + fmt(T.routes.find(r => /strip 11/.test(r.route) && /Cessna/.test(r.design)) ? T.routes.find(r => /strip 11/.test(r.route) && /Cessna/.test(r.design)).live.down : null) + ' on signing, more than the aeroplane costs, and a wait earns round trips by the hour. The router ends with route income at ' + pc(L('router').routeShare) + ' of everything (target 40 %). <b>Proposed:</b> perKm ' + PROPOSED.routes.perKm + ', a down payment of ' + PROPOSED.routes.downTrips + ' trips, and a timetable of ' + PROPOSED.dayTrips + ' round trips a sim day: the router lands at ' + pc(Pp('router').routeShare) + '.');
  if (L('frugal')) out.push('<b>Money stops meaning anything early.</b> On master the 60 000 grant + T6\'s down payment put the wallet at ' + f1(L('frugal').stages.tutorial ? L('frugal').stages.tutorial.restMed : null) + '× the next purchase at T7, and every policy is above 3× through segments 2 and 3 (frugal ' + f1(L('frugal').stages.seg2 && L('frugal').stages.seg2.restMed) + '× / ' + f1(L('frugal').stages.seg3 && L('frugal').stages.seg3.restMed) + '×): nothing is left to want.');
  out.push('<b>The planes are already cheap enough.</b> The pace to a Cub-class build is ' + f1(Pp('frugal') && Pp('frugal').pace.cubClass.med) + ' contracts and to the 4-seater ' + f1(Pp('frugal') && Pp('frugal').pace.seat4.med) + ' (with its rung): keep the airframe price as the ledger × labour. What is missing is the reason to spend after the fleet is bought.');
  out.push('<b>The sink that holds is landmark co-funding</b> (the leading candidate, confirmed: without it money at rest goes back to 15-45× in segments 2-3, see the sinks table): the keystones at ' + PROPOSED.landmarks.filter(l => l.keystone).map(l => l.cubs).join(' / ') + ' Cubs, the optional landmarks beside them, plus a machine-shop rung per segment (' + Object.values(PROPOSED.packs).map(p => p.cubs).join(' / ') + ' Cubs) and the side hangars re-priced (a field shed ' + PROPOSED.shells.field + ' Cubs, ~10 contracts). Drop the story career\'s 60 000 grant and pay a ' + fmt(PROPOSED.storyFee) + ' commitment fee at T6 instead (the route\'s own down payment beside it): the first real money, enough for any one of the three occasions. Competitions, occasions and buildings are taste, not sinks: removing any one of them moves money at rest by a few hundredths.');
  const demo = Pp('frugal') ? (Pp('frugal').stages.tutorial.realH + (Pp('frugal').stages.seg1 ? Pp('frugal').stages.seg1.realH : 0)) : null;
  const F = Pp('frugal'), perC = F && F.stages.seg1 ? F.stages.seg1.realH / F.stages.seg1.contracts : null, perC4 = F && F.stages.seg1 ? F.stages.seg1.realH4 / F.stages.seg1.contracts : null;
  const fit4 = F ? Math.max(0, Math.floor((3 - F.stages.tutorial.realH4) / perC4)) : null;
  out.push('<b>Time is the real constraint, not money.</b> A contract takes ~' + fmt(perC * 60, 0) + ' min of real play at 1× (the island\'s legs, the positioning, the circuits) and the tutorial alone ~' + f1(F && F.stages.tutorial.realH) + ' h (T5\'s survey flies 63 km), so the demo (tutorial + segment 1 at ' + SEG_K[1] + ' contracts) is ~' + f1(demo) + ' h, not 2-3. At 1× the tutorial nearly fills the 3 h by itself; with the cruise at 4× segment 1 could hold ~' + fit4 + ' contracts. The economy\'s ratios hold whatever the length (they are per contract): the demo length is the user\'s call (a cruise time compression, a shorter T5, or a longer demo).');
  return out;
}
if (require.main === module && !ARG('worker')) main().catch(e => { console.error(e); process.exit(0); });
module.exports = { playCareer, measureDesigns, configOf, POLICIES, aggregate, judge };
