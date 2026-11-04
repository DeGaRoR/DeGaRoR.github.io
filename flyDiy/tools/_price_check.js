#!/usr/bin/env node
// ============================================================================
// GATE PRICE — the price calibration (PRICE-CAL 2026-11, futureDesigns/PRICE-STUDY-2026-11.md)
// ============================================================================
// THE CONVENTION: credits are USD 2025-26 at parity, and the ledger is a PARTS BILL (what a builder buys, the labour
// free: the maker way). A labour-heavy line (paint, interior, covering) is priced as its materials. This gate holds it:
//   THE BENCHMARK   every row below has a sourced real range (search of 2026-11-04: dealer price lists, overhaul
//                   flat rates, listings; the links are in the study, sections 1 and C). The game's row must sit
//                   within x1.5 of the range's geometric middle (real / game in [1/1.5, 1.5]). A row with no source
//                   says so and is not held. Electric rows are not benchmarked.
//   THE PLANS ROUTE the stock Cub and Jodel built in a fitted hangar against what each costs to build from plans
//                   (materials + engine + panel: estimates, held loosely, x1.6).
//   THE PAY         econPayScale() = the reference Cub's ledger / ECON_BOOK.payRef; a job's pay, a route's per km,
//                   T6's fee, the grant and the loan threshold all ride it (doubling the Cub doubles each).
//   ONE MARGIN      econCatalogPrice(c) = c x PROCURE_MARGIN = c x ECON_BOOK.makerMargin.
//   THE TIERS       the age curve: 1 new, `s` used at once, falling, never under its floor; every used listing's
//                   condition in PROCURE_COND and its mean where the agreed economy had it (0.55-0.60); its age, its
//                   hours and its build year agree; a sale never pays more than was paid, a story airframe nothing,
//                   an own build less than it cost to build.
//   THE LEDGER      a twin bills a prop per engine; no seat is billed twice (the cabin section bills nothing); a tank
//                   arrives empty (its price does not move with the fuel's); the paint follows the painted area.
//
//   node tools/_price_check.js            -> "GATE PRICE: PASS|FAIL"
//   node tools/_price_check.js --selftest -> each block doctored once must go red
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');

// [what, the game's row (a function of the core), real [lo, hi] USD, basis]
const propP = (m, b, D) => Math.round(C.GEN_PROP_MATS[m].price * b / 2 * Math.pow(D / 1.88, 2));
const ENG = k => C.POWERPLANTS[k].price;
const BENCH = [
  // engines: overhauled / exchange for the certified ones, new for the Rotax
  ['Continental A-65', () => ENG('a65_sensenich74'), [9.5e3, 13e3], 'shop overhaul (Aviation Consumer)'],
  ['Rotax 503', () => ENG('rotax503_wood'), [4.5e3, 5e3], 'zero-time rebuild'],
  ['Rotax 582 + gearbox', () => ENG('rotax582_ivo'), [8.2e3, 9.5e3], 'new (afors.uk, Controller)'],
  ['Rotax 912 UL/ULS', () => ENG('rotax912_warp'), [20.6e3, 23.7e3], 'new (Motive, Six Chuter)'],
  ['Rotax 915 iS', () => ENG('rotax915_carbon'), [48.5e3, 55e3], 'new (Motive)'],
  ['Rotax 916 iS', () => ENG('rotax916_carbon'), [51e3, 60e3], 'new (flying411)'],
  ['Continental O-200', () => ENG('o200_eprops'), [40e3, 47.5e3], 'rebuilt / new (Air Power)'],
  ['Lycoming O-320', () => ENG('o320_mccauley'), [48e3, 56e3], 'overhaul exchange 2024'],
  ['Lycoming IO-360', () => ENG('io360_mccauley'), [48e3, 56e3], 'overhaul / rebuilt exchange'],
  ['Lycoming O-540', () => ENG('o540_hartzell'), [61e3, 67e3], 'overhaul exchange 2024'],
  ['DH Gipsy Major', () => ENG('gipsymajor1_wood'), [43e3, 70e3], 'GBP 34-55k asking (afors.uk)'],
  ['P&W R-985', () => ENG('r985_hs2b20'), [45e3, 60e3], 'ESTIMATE'],
  ['P&W R-1830', () => ENG('r1830_hs23e50'), [60e3, 100e3], 'ESTIMATE'],
  ['P&W PT6A-114A', () => ENG('pt6a114a_hartzell3'), [350e3, 433e3], 'P&WC flat-rate overhaul 2025'],
  ['P&W PT6A-34', () => ENG('pt6a34_hartzell4'), [387e3, 455e3], 'P&WC flat rate 2026'],
  ['P&W PT6A-42', () => ENG('pt6a42_hartzell4'), [420e3, 489e3], 'P&WC flat rate 2026'],
  // props (GEN_PROP_MATS through the frame's law)
  ['prop: fixed wood, Cub 1.88 m', () => propP('wood', 2, 1.88), [3.5e3, 4.4e3], 'Sensenich W72 (Univair)'],
  ['prop: fixed metal, C172 1.91 m', () => propP('alu', 2, 1.91), [8.2e3, 10.8e3], 'Sensenich 74DM6 / McCauley 1C160'],
  ['prop: composite 3-blade 1.73 m', () => propP('carbon', 3, 1.73), [1.3e3, 4.4e3], 'Warp Drive / E-Props / IVO'],
  ['prop: constant speed 2-blade 1.93 m', () => propP('alu', 2, 1.93) + C.GEN_PRICES.csHub, [10.5e3, 11.8e3], 'Hartzell via Van\'s + governor'],
  ['prop: PT6A 3-blade 2.69 m (CS)', () => propP('alu', 3, 2.69) + C.GEN_PRICES.csHub, [18.5e3, 45e3], 'Hartzell (ESTIMATE today)'],
  // the panel (G251's list prices)
  ['airspeed', () => C.GEN_INSTR.asi.price, [254, 374], 'Swift (experimental)'],
  ['altimeter', () => C.GEN_INSTR.alt.price, [429, 1200], 'Winter'],
  ['attitude, vacuum', () => C.GEN_INSTR.ai.price, [1487, 2495], 'Falcon / Sigma-Tek'],
  ['attitude, electric', () => C.GEN_INSTR.aiE.price, [893, 4195], 'non-TSO / TSO'],
  ['turn coordinator', () => C.GEN_INSTR.turn.price, [1195, 1325], 'RC Allen 82A'],
  ['compass', () => C.GEN_INSTR.compass.price, [455, 883], 'Airpath C2400'],
  ['vacuum pump', () => C.GEN_ELEC.vac.pump.price, [553, 809], 'Rapco'],
  ['battery, lead', () => C.GEN_ELEC.battery.lead.price, [183, 281], 'Odyssey PC680'],
  ['battery, lithium', () => C.GEN_ELEC.battery.lithium.price, [379, 450], 'EarthX'],
  ['alternator 60 A', () => C.GEN_ELEC.alternator.alt60.price, [1057, 1287], 'Plane-Power'],
  ['starter', () => C.GEN_ELEC.starter.yes.price, [1086, 1120], 'Sky-Tec'],
  ['harness', () => C.GEN_ELEC.harness.price, [500, 3000], 'ESTIMATE'],
  ['VHF COM', () => C.GEN_AVIONICS.com.compact.price, [1364, 2110], 'GTR 200 / Trig TY91'],
  ['Mode-S transponder', () => C.GEN_AVIONICS.xpdr.modeS.price, [3053, 3893], 'TT21 / GTX 335'],
  ['VOR nav (used)', () => C.GEN_AVIONICS.nav.vor.price, [1995, 3000], 'KX 155 listings'],
  ['portable GPS', () => C.GEN_AVIONICS.gps.portable.price, [849, 1549], 'aera 660 / 760'],
  ['panel GPS', () => C.GEN_AVIONICS.gps.panel.price, [4995, 7995], 'GPS 175 / GNX 375'],
  ['glass EFIS 7 in', () => C.GEN_AVIONICS.gps.glass.price, [3360, 6500], 'G3X Touch / SkyView HDX'],
  // gear, finish, interior, tanks, lights
  ['main wheel + tyre + brake', () => C.GEN_PRICES.wheel, [680, 900], 'Matco + a tyre'],
  ['tailwheel assembly', () => C.GEN_PRICES.thirdWheel, [1000, 1410], 'ABI / Scott 3200'],
  ['bungee set', () => C.GEN_SUSPENSION.bungee.price, [200, 260], 'Univair (ESTIMATE for the set)'],
  ['spring-steel legs', () => C.GEN_SUSPENSION.spring.price, [2000, 2500], 'Grove class'],
  ['lights (nav/strobe + landing)', () => C.GEN_PRICES.lights, [1190, 1900], 'AeroLEDs'],
  ['fuel tank, Cub 44 L (alu)', () => C.genVesselResolve ? null : null, [400, 2274], 'used J-3 tank / new PA-18 wing tank'],
];
// the tank row reads the energy module's own resolver (genVesselResolve's signature varies by arc: measured off a Cub)
function cubTankPrice() {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/cub_2026-09-20_corrected.json'), 'utf8'));
  const spec = C.genMigrateSpec(j.spec || j);
  return Math.round(C.genShakedown(C.buildGen(spec), spec).ledger.vessel.cost);
}

function run(doctor) {
  const fails = [], lines = [];
  const ok = (c, what) => { if (!c) fails.push(what); return c; };
  const undo = doctor ? doctor() : null;
  try {
    // 1. THE BENCHMARK
    for (const [what, fn, real, src] of BENCH) {
      const game = what.startsWith('fuel tank') ? cubTankPrice() : fn();
      const mid = Math.sqrt(real[0] * real[1]), r = mid / game;
      lines.push('  ' + what.padEnd(38) + String(game).padStart(8) + '  real ' + (real[0] + '-' + real[1]).padEnd(14) + ' x' + r.toFixed(2) + '  ' + src);
      ok(r >= 1 / 1.5 && r <= 1.5, what + ': ' + game + ' against $' + real[0] + '-' + real[1] + ' (x' + r.toFixed(2) + ', outside x1.5)');
    }
    // 2. THE PLANS ROUTE (the maker way, a fitted hangar: the ledger x labourFit)
    for (const [k, real] of [['cub', [35e3, 60e3]], ['jodel', [25e3, 45e3]]]) {
      const v = C.CONTRACT_DESIGNS[k].cost * C.PREM_RATES.labourFit, r = Math.sqrt(real[0] * real[1]) / v;
      lines.push('  plans: ' + k.padEnd(31) + String(Math.round(v)).padStart(8) + '  real ' + (real[0] + '-' + real[1]).padEnd(14) + ' x' + r.toFixed(2) + '  materials + engine + panel (ESTIMATE)');
      ok(r >= 1 / 1.6 && r <= 1.6, k + ' built from plans: ' + Math.round(v) + ' against $' + real[0] + '-' + real[1]);
    }
    // 3. THE PAY RIDES THE CUB
    const s0 = C.econPayScale();
    ok(Math.abs(s0 - C.econRefPrice() / C.ECON_BOOK.payRef) < 1e-9, 'econPayScale is the reference Cub over payRef');
    // payRef is HISTORY, not a measurement: the Cub's ledger when the pay was tuned (G2261, G3359). Re-deriving it
    // would silently undo the anchor
    ok(C.ECON_BOOK.payRef === 31203, 'payRef is the Cub the pay was tuned at (31 203), never re-derived');
    const job = (() => { const ids = C.careerOfferIds(C.careerNew({ id: 'p', seed: 'price' })); for (const id of ids) if (/^job:/.test(id)) return id; return null; })();
    const d0 = C.careerNew({ id: 'p', seed: 'price' });
    const rec = job ? C.careerContract(d0, job) : null;
    const pay0 = rec ? C.contractPay(rec).total : null, grant0 = C.careerGrant(), fee0 = C.econPay(C.STORY_T6_FEE);
    const cub0 = C.CONTRACT_DESIGNS.cub.cost;
    C.CONTRACT_DESIGNS.cub.cost = cub0 * 2;
    try {
      ok(Math.abs(C.econPayScale() - 2 * s0) < 1e-9, 'the pay scale doubles with the Cub');
      if (rec) ok(Math.abs(C.contractPay(rec).total / pay0 - 2) < 0.02, 'a job pays twice as much when the Cub costs twice as much (' + pay0 + ' -> ' + C.contractPay(rec).total + ')');
      ok(Math.abs(C.careerGrant() / grant0 - 2) < 0.01 && Math.abs(C.econPay(C.STORY_T6_FEE) / fee0 - 2) < 0.01, 'the grant and T6\'s fee double with it');
      const rt = C.routeTerms(20, { seats: 2, bagKg: 10, cruiseKmh: 120 });
      C.CONTRACT_DESIGNS.cub.cost = cub0;
      const rt0 = C.routeTerms(20, { seats: 2, bagKg: 10, cruiseKmh: 120 });
      ok(Math.abs(rt.pay / rt0.pay - 2) < 0.05, 'a route pays twice as much per trip (' + rt0.pay + ' -> ' + rt.pay + ')');
    } finally { C.CONTRACT_DESIGNS.cub.cost = cub0; }
    ok(!!rec, 'a generated job to measure the pay on');
    // 4. ONE MARGIN
    ok(C.PROCURE_MARGIN === C.ECON_BOOK.makerMargin, 'PROCURE reads the one maker\'s margin');
    for (const k of Object.keys(C.CONTRACT_DESIGNS)) { const c = C.CONTRACT_DESIGNS[k].cost;
      ok(C.econCatalogPrice(c) === C.econRound(c * C.ECON_BOOK.makerMargin), k + ': the catalogue is the ledger x the margin'); }
    // 5. THE TIERS
    const A = C.ECON_BOOK.age;
    ok(C.econAgeFactor(0) === 1 && Math.abs(C.econAgeFactor(1e-6) - A.s) < 1e-4, 'the curve: 1 new, ' + A.s + ' the moment it is used');
    let prev = 2; for (let a = 0.5; a <= 80; a += 0.5) { const f = C.econAgeFactor(a); ok(f < prev && f > A.s * A.floor, 'the curve falls and holds its floor at ' + a + ' y'); prev = f; }
    let n = 0, sum = 0;
    for (let sd = 0; sd < 12; sd++) for (let e = 0; e < 6; e++) for (let i = 0; i < 4; i++) {
      const L = C.procureUsedListing('price' + sd, e, i); if (!L) continue; n++; sum += L.condition;
      ok(L.condition >= C.PROCURE_COND[0] && L.condition <= C.PROCURE_COND[1], L.id + ': its condition in the band');
      ok(L.age >= A.listAges[0] && L.age <= A.listAges[1] && L.built === 2026 - L.age, L.id + ': its age and its year agree');
      ok(L.hours >= 150 && L.hours <= 2950 && L.kg <= A.kgMax, L.id + ': its hours and its kilos are a used aeroplane\'s');
      ok(L.price === Math.round(L.catalogue * L.condition / 100) * 100, L.id + ': its price is the catalogue x its condition');
    }
    const mean = sum / Math.max(1, n);
    lines.push('  used market: ' + n + ' listings, mean condition ' + mean.toFixed(3));
    ok(n > 100 && mean >= 0.55 && mean <= 0.60, 'the used market\'s mean condition where the agreed economy had it (' + mean.toFixed(3) + ')');
    const d = C.careerNew({ id: 's', seed: 'price' }), cost = C.CONTRACT_DESIGNS.cub.cost, build = C.econAirframePrice(cost, d.sheds[C.PREM_MAIN], ['tube']);
    d.career.airframes.own = { paid: build }; d.career.airframes.gift = { paid: 0 }; d.career.airframes.used = { paid: 20000, age: 8, v0: cost * 1.15, repairs: 1 };
    const sOwn = C.econSaleValue(d, 'own', cost), sGift = C.econSaleValue(d, 'gift', cost), sUsed = C.econSaleValue(d, 'used', cost);
    ok(sOwn.value > 0 && sOwn.value < build, 'an own build sells for less than it cost to build (' + sOwn.value + ' < ' + build + ')');
    ok(sGift.value === 0, 'a story airframe sells for nothing');
    ok(sUsed.value <= 20000, 'a used one never sells for more than it was bought for');
    // 6. THE LEDGER
    const shake = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); const sp = C.genMigrateSpec(j.spec || j); return { s: C.genShakedown(C.buildGen(sp), sp), S: C.resolveSpec(sp).spec }; };
    const cub = shake('builds/cub_2026-09-20_corrected.json');
    ok(!(cub.s.ledger.cabin && cub.s.ledger.cabin.cost), 'no seat is billed twice (the cabin section bills nothing)');
    const paintA = cub.s.ledger.paint.mass / C.GEN_FINISH.full.kgM2;
    ok(cub.s.ledger.paint.cost >= C.GEN_FINISH.full.perM2 * paintA * 0.95, 'the paint follows the painted area');
    const fuel0 = C.GEN_FUELS.avgas100LL.price; C.GEN_FUELS.avgas100LL.price = fuel0 * 10;
    try { ok(shake('builds/cub_2026-09-20_corrected.json').s.ledger.vessel.cost === cub.s.ledger.vessel.cost, 'a tank arrives empty: its price does not move with the fuel\'s'); }
    finally { C.GEN_FUELS.avgas100LL.price = fuel0; }
    const dc3 = shake('builds/candidates/dc3_2026-10.json');
    const nE = dc3.S.engines.length, eng = dc3.S.pplant.price * nE, prop = (dc3.S.prop.price + (dc3.S.pplant.engine && dc3.S.pplant.engine.cs ? C.GEN_PRICES.csHub : 0)) * nE;
    ok(nE === 2 && dc3.s.ledger.engines.cost >= eng + prop - 1, 'a twin bills a propeller per engine (' + Math.round(dc3.s.ledger.engines.cost) + ' >= ' + (eng + prop) + ')');
  } finally { if (undo) undo(); }
  return { fails, lines };
}

const base = run(null);
if (!SELF) {
  for (const l of base.lines) console.log(l);
  for (const f of base.fails) console.log('FAIL ' + f);
  console.log('GATE PRICE: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}
// SELFTEST: each doctoring must turn the gate red
if (base.fails.length) { console.log('the undoctored gate is red'); console.log('GATE PRICE selftest: FAIL'); process.exit(1); }
const set = (o, k, v) => () => { const old = o[k]; o[k] = v; return () => { o[k] = old; }; };
const DOCTORS = [
  ['the wood prop back at 900', set(C.GEN_PROP_MATS.wood, 'price', 900)],
  ['the O-320 back at 28 000', set(C.POWERPLANTS.o320_mccauley, 'price', 28000)],
  ['payRef re-derived to today\'s Cub (the anchor undone)', set(C.ECON_BOOK, 'payRef', 44683)],
  ['a second margin', set(C.ECON_BOOK, 'makerMargin', 1.08)],
  ['the age curve inverted', set(C.ECON_BOOK.age, 'tau', -27.5)],
  ['the market aged to 40 years', () => { const a = C.ECON_BOOK.age.listAges; C.ECON_BOOK.age.listAges = [20, 40]; return () => { C.ECON_BOOK.age.listAges = a; }; }],
  ['a sale over its cost', set(C.ECON_BOOK, 'sellK', 5)],
  ['the lights unpriced', set(C.GEN_PRICES, 'lights', 0)],
  ['a tank filled again (the fuel in the vessel\'s price)', set(C.GEN_VESSELS.alu, 'priceM2', 15000)],
];
let bad = 0;
for (const [what, doc] of DOCTORS) {
  const r = run(doc);
  console.log('  ' + (r.fails.length ? 'caught' : 'MISSED') + '  ' + what + (r.fails.length ? ' (' + r.fails[0] + ')' : ''));
  if (!r.fails.length) bad++;
}
console.log('GATE PRICE selftest: ' + (bad ? 'FAIL (' + bad + ' missed)' : 'PASS'));
process.exit(bad ? 1 : 0);
