#!/usr/bin/env node
// GATE ALTIPORT (G2520 ALTIPORT-ARRIVAL) - A FIELD ABOVE THE AEROPLANE, ARRIVED AT AS THE GAME FLIES IT.
//
// THE FINDING (the game on the GPU, 8 Oct, build 594a68063d35 = pilot-42 on train 40, damage on, the game's 8 kt day):
// HOME (31 m) > Skyline Altiport (tw_ski, 695 m, a 380 m strip rising ~8 %), the user's Jodel: FINAL began 270 m under
// the strip, the altiport's slope-line flare armed 180 m under it, 'go-around: floating with 1630 m left', 'vref-raised:
// the elevator cannot hold 26.1 m/s at this power', the airframe broken (prop strike). Train 40 landed the same flight
// (0.93 m/s). Node reproduces both (the game's flight: tools/_tour_lib.js gameHost - the worker's host, the page's
// placement and pilot, DAY_CLOCK's day ticked; ISLAND-TOUR-2 G1970) to the verdict and the metre.
//
//   node tools/_altiport_check.js            -> "GATE ALTIPORT: PASS|FAIL" (5 heavy jobs: --shard=i/4)
//   node tools/_altiport_check.js --show     -> every line, passed ones too
//   PILOT_CORE=<flight_core.js> flies another core (the before / after)
//
// 1 / 2 THE JODEL AND THE CUB, HOME > tw_ski, the game's flight, damage ON:
//   a  WHAT THE PAGE SAW: stopped at tw_ski with no fault (_tour_lib flyLeg: no member yielded or broken, no prop strike,
//      no dent, no ground loop, no off-strip, no crash) and landed on it - THE CUB'S ROLL-OUT (its ground loop / off-strip,
//      30.1-30.4 deg at ~9.7 m/s on pilot-42, train 40 and the fix alike: the roll-out law's, routed) printed KNOWN
//   b  THE ARRIVAL'S CONTRACT (the fix): the final begins at the field's circuit height (within the climb hold's 60 m:
//      at or above tw_ski's elevation + the circuit height - 60), over the strip's highest ground - never from below it
//   c  THE FLARE: every flare armed with the aeroplane's lowest node over the strip's lowest ground and at most
//      FLARE_ARM_MAX (25 m) over its highest
//   d  the final's lowest node >= 3 m over the ground and the forest (GATE TOUR's rule)
// 3 THE FLARE GUARD'S OWN ROW - A DOCTORED ARRIVAL: the Jodel to tw_ski with the field's RECORD 250 m low (the pilot's
//   altRef, its circuit and its climb hold all believe it): the arrival comes in under the strip. Caught: the arming law
//   is met under the strip (the guard says 'flare-guard' - the calibration: the doctored arrival is a real one), no flare
//   ever armed under the strip or over FLARE_ARM_MAX above it, and the airframe whole (no crash, no break) for 900 s
// 4 THE METAL CESSNA (G2530): the user's metal Cessna as the load door makes it, HOME > tw_ski - stopped on the altiport
//   with no fault, or the altiport refused with its reason said and landed and stopped where it diverted (below)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(process.env.PILOT_CORE ? path.resolve(process.env.PILOT_CORE) : path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const SHD = require(path.join(T, '_shard.js'));
const SHOW = process.argv.includes('--show');
let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const r1 = v => Math.round(v * 10) / 10;
const ARM_MAX = typeof C.FLARE_ARM_MAX === 'number' ? C.FLARE_ARM_MAX : 25;   // (a core before G2520 has none: the gate's own 25)
const ROOT = path.join(T, '..');
const JODEL = path.join(ROOT, 'builds', 'jodel_2026-09-20_corrected.json');

// the To's strip: its ground along the centreline, the lowest and the highest
function stripGround(W, b) {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k <= 40; k++) {
    const s = -b.len / 2 + b.len * k / 40;
    const g = W.terrainH(b.x + Math.cos(b.hdg) * s, b.z + Math.sin(b.hdg) * s);
    lo = Math.min(lo, g); hi = Math.max(hi, g);
  }
  return { lo, hi };
}
// one leg in the game's flight, every flare's arming watched (the aeroplane's lowest node when the phase turns FLARE)
function flyWatched(key, o) {
  let def = TR.defOf(C, PT, key);
  if (o.capacity) {
    // THE GAME'S TANK ON THIS BASE: the page's load door shapes the Cub's nose tank to its bay - 29 L, 462.3 kg on a page
    // without JOIN-PARITY's G1986 (TOUR-REAL's page, ISLAND-TOUR-2 G1970.1/.3; tour_real_node.js --capacity 29); the
    // Jodel's flies as its file (45 L, 463 kg: the game's verdicts and times to the second, G2520)
    const spec = PT.specOf(key).spec, V = spec.energy && spec.energy.vessels && spec.energy.vessels[0];
    V.capacity = o.capacity; spec.fuel = Object.assign({}, spec.fuel || {}, { litres: o.capacity });
    def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
    def.params = Object.assign({}, def.params, { damage: true });
  }
  const TW = TR.tourWorld(C, IN, fs);
  const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
  const a = A('HOME'), b = A('tw_ski');
  const SG = stripGround(W, b);
  const elev = b.elev;
  if (o.doctor) b.elev -= o.doctor;                       // THE DOCTORED RECORD (job 3): the field believed 250 m low
  const H = TR.gameHost(C, W, def, a, b, {});
  const sim = H.sim, step0 = sim.step;
  const flares = [], says = [];
  let last = null, nV = 0, finalAt = null;
  sim.step = dt => {
    step0(dt);
    const ap = H.ap, ph = ap.phase;
    if (o.committed && ph === 'FINAL') ap.gaN = Math.max(ap.gaN || 0, 2);   // G3077: the arrival's go-arounds spent (job 3)
    if (ph !== last) {
      const cg = sim.cgPos();
      if (ph === 'FINAL' && !finalAt) finalAt = { h: r1(cg[1]), d: r1(Math.hypot(cg[0] - b.x, cg[2] - b.z) - b.len / 2), hC: ap.report.circuit ? ap.report.circuit.hC : null };
      if (ph === 'FLARE') {
        let low = Infinity;
        for (let i = 0; i < sim.n; i++) low = Math.min(low, sim.p[i * 3 + 1]);
        flares.push({ low: r1(low), over: r1(low - SG.lo), d: r1(Math.hypot(cg[0] - b.x, cg[2] - b.z) - b.len / 2), t: r1(ap.t) });
      }
      last = ph;
    }
    const vs = ap.report.verdicts;
    while (nV < vs.length) { const v = vs[nV++]; says.push(v.code + (v.note ? ': ' + v.note : '')); }
  };
  const L = TR.flyLeg(C, W, sim, def, a, b, { first: true, host: H, tMax: o.tMax || 1800 });
  sim.step = step0;
  return { L, flares, says, finalAt, SG, elev, game: H.game, damage: sim.damage ? sim.damage() : null };
}

// 1 / 2 the two validated taildraggers, HOME > tw_ski
// G3077 (TORQUE-RETUNE-66): THE CUB IS THE REFERENCE FOR SHORT STRIPS (the user, 14 Oct: "Stop testing the Jodel, the cub is
// the reference for short strips"; G3071: a gate row flying the Jodel on a short strip goes, check-only, when the gate is next
// touched) - the Jodel's row 1 HOME > tw_ski is dropped; the Cub's row 2 stands
const JOBS = [{ name: "the user's Cub", key: TR.BUILDS.cub.key, n: 2, capacity: 29, knownRoll: true }];
for (const J of JOBS) {
  if (!SHD.take()) continue;
  const t0 = Date.now();
  const R = flyWatched(J.key, { capacity: J.capacity });
  const L = R.L, id = J.n + ' ' + J.name + ' HOME > tw_ski';
  console.log('  ' + J.name + ': ' + TR.fmtLeg(L).trim() + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  if (SHOW) console.log('    verdicts ' + R.says.join(' | ') + '\n    flares ' + JSON.stringify(R.flares) + '\n    final ' + JSON.stringify(R.finalAt));
  const GW = R.game && R.game.day && R.game.day.wind;
  check(!!(GW && GW.kts === 8 && GW.dirDeg === 250 && R.game.shake && R.game.damage === true), id + ': the game\'s flight (the 8 kt / 250 deg day, the page\'s pilot, the damage on)', JSON.stringify(R.game && { wind: GW, shake: R.game.shake, damage: R.game.damage, fuel: R.game.fuel, mass: R.game.mass }));
  // (the Cub's roll-out on the strip - its ground loop and off-strip excursion, 30.1-30.4 deg at ~9.7 m/s - is the same on
  // pilot-42, on train 40 and here: the roll-out law's on this uphill strip in the 8 kt westerly, not the arrival's;
  // printed KNOWN with its numbers, every other fault gated - J.knownRoll)
  const known = J.knownRoll ? L.faults.filter(f => f.k === 'ground-loop' || f.k === 'off-strip') : [];
  const faults = L.faults.filter(f => !known.includes(f));
  check(L.arr.stopS != null, id + 'a: stopped at Skyline Altiport (what the page saw)', L.phases.slice(-4).join('>'));
  check(!faults.length, id + 'a: no fault - no member yielded or broken, no prop strike, no dent, no crash' + (J.knownRoll ? ' (the roll-out\'s own two printed below)' : ', no ground loop, no off-strip'), faults.map(f => f.k + ': ' + f.note).join('; ') || 'td ' + JSON.stringify(L.arr.landing));
  if (known.length) console.log('  KNOWN ' + id + ': the roll-out (pre-existing on pilot-42 and train 40, routed - HANDOVER G2520): ' + known.map(f => f.k + ': ' + f.note).join('; '));
  check(L.landedOn === 'tw_ski', id + 'a: landed on Skyline Altiport', 'on ' + L.landedOn);
  const hNeed = R.elev + ((R.finalAt && R.finalAt.hC) || 0) - 60;
  check(!!R.finalAt && R.finalAt.h >= hNeed && R.finalAt.h > R.SG.hi, id + 'b: the final begun at the field\'s circuit height (>= ' + Math.round(hNeed) + ' m, over the strip\'s ' + Math.round(R.SG.hi) + ' m)',
    R.finalAt ? 'FINAL at ' + R.finalAt.h + ' m MSL, ' + R.finalAt.d + ' m out (' + r1(R.finalAt.h - R.SG.hi) + ' m over the strip\'s highest ground; the circuit ' + R.finalAt.hC + ' m)' : 'no final');
  const outF = R.flares.filter(f => !(f.over >= 0 && f.low - R.SG.hi <= ARM_MAX));
  check(R.flares.length > 0 && !outF.length, id + 'c: every flare armed over the strip, at most ' + ARM_MAX + ' m above it', R.flares.map(f => f.over + ' m over the strip\'s lowest ground ' + f.d + ' m out at ' + f.t + ' s').join('; ') || 'no flare');
  if (L.arr.apprClear) check(L.arr.apprClear.c >= 3, id + 'd: the final\'s lowest node 3 m over the ground and the forest', L.arr.apprClear.c + ' m (' + L.arr.apprClear.what + ', ' + L.arr.apprClear.d + ' m out)');
}

// 3 the flare guard's own row: the doctored arrival
// G3077 (TORQUE-RETUNE-66, the owed G3076): AN ARRIVAL THE GO-AROUND DOES NOT CATCH. PERSONA-2 G2460's stabilised approach took
// the doctored final round before G2520's flare guard was ever reached (the Jodel: 'unstabilised approach at -133 m: low 242 m
// on the slope', twice, then the divert - printed KNOWN, G3074) - so the row could not see the guard. The guard is for the
// arrival nothing else stops: the go-arounds spent (the pilot's gaN at two from the final's start, as on a third arrival -
// 43 canGA false: the stabilised approach says 'committed-unstable' and flies on), the field still believed 250 m low. And
// the Cub flies it (the user, 14 Oct: the Cub is the reference for short strips) - judged as before G2540: the guard said
// with the final begun under the strip, no flare armed under it or over FLARE_ARM_MAX above it, the airframe whole for 900 s
if (SHD.take()) {
  const t0 = Date.now();
  const R = flyWatched(TR.BUILDS.cub.key, { doctor: 250, tMax: 900, capacity: 29, committed: true });
  const L = R.L, id = '3 the doctored arrival (tw_ski\'s record 250 m low, the go-arounds spent), the Cub';
  console.log('  doctored: ' + TR.fmtLeg(L).trim() + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  if (SHOW) console.log('    verdicts ' + R.says.join(' | ') + '\n    flares ' + JSON.stringify(R.flares) + '\n    final ' + JSON.stringify(R.finalAt));
  const guard = R.says.filter(s => /^flare-guard/.test(s));
  check(guard.length > 0 && R.finalAt && R.finalAt.h < R.SG.lo, id + ': the arrival came in under the strip and the arming law was met there - the guard caught it (calibration)',
    (R.finalAt ? 'FINAL at ' + R.finalAt.h + ' m MSL (the strip ' + Math.round(R.SG.lo) + '..' + Math.round(R.SG.hi) + ' m); ' : '') + (guard.join(' | ') || 'no flare-guard said') + ' | ' + R.says.filter(s => /^(go-around|committed|divert)/.test(s)).join(' | '));
  const under = R.flares.filter(f => f.over < 0), high = R.flares.filter(f => f.low - R.SG.hi > ARM_MAX);
  check(!under.length && !high.length, id + ': no flare armed under the strip or over ' + ARM_MAX + ' m above it', R.flares.map(f => f.over + ' m over the strip ' + f.d + ' m out at ' + f.t + ' s').join('; ') || 'no flare');
  const D = R.damage;
  check(!!D && !D.over && !D.breaks, id + ': the airframe whole (no crash, no member broken)', D ? JSON.stringify({ yields: D.yields, breaks: D.breaks, over: !!D.over, reason: D.reason || null }) : '-');
}
// 4 THE METAL CESSNA (G2530, PILOT-44-REDS) - the user's metal Cessna as the load door makes it (bugReports/cessnaMetal
//   (1).json: 887 kg, the engine at its drawn station - CESSNA-VREF G2500), HOME > tw_ski, the game's flight, damage ON.
//   The finding (GATE TOUR shard 1, 8 Oct, this tree): its elevator cannot hold Vref ('vref-raised'), the altiport is
//   landed one way - uphill - with the game's 8 kt westerly 4.9 m/s BEHIND, the touch 127 m in at 36.7 m/s over the
//   ground, off the top end at 8 m/s: broken up. THE BAR (CESSNAVREF's): the case is the finding's ('vref-raised' said);
//   stopped ON the altiport with no fault (a / c / d as 1 and 2), or THE STRIP REFUSED WITH ITS REASON SAID
//   ('strip-too-short') and the aeroplane landed and stopped on the strip it diverted to - no flare ever armed at the
//   altiport, nothing yielded, broken or dented either way
const METAL = path.join(ROOT, 'bugReports', 'cessnaMetal (1).json');
if (SHD.take()) {
  const t0 = Date.now();
  const R = flyWatched(METAL, {});
  const L = R.L, id = '4 the metal Cessna HOME > tw_ski', ld = L.arr.landing || {};
  const said = c => R.says.some(v => v.startsWith(c));
  console.log('  the metal Cessna: ' + TR.fmtLeg(L).trim() + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  console.log('    verdicts ' + R.says.join(' | '));
  if (SHOW) console.log('    flares ' + JSON.stringify(R.flares) + '\n    final ' + JSON.stringify(R.finalAt));
  const GW = R.game && R.game.day && R.game.day.wind;
  check(!!(GW && GW.kts === 8 && GW.dirDeg === 250 && R.game.shake && R.game.damage === true), id + ': the game\'s flight (the 8 kt / 250 deg day, the page\'s pilot, the damage on)', JSON.stringify(R.game && { wind: GW, mass: R.game.mass, fuel: R.game.fuel }));
  // SKYLINE-RESORT (13-14 Nov; A0 + Game 14 Nov: "fine as long as it's a said refusal, not a crash"): the altiport halved to
  // 190 m is shorter than this aeroplane's sheet landing run (249 m), so the pilot refuses it AT DISPATCH (pilotCanFly / G2450:
  // 'strip-too-short ... not going there') and the leg is never flown - the finding's approach cannot arise. That refusal is
  // held as TAXICLEAR 11c holds East Point's: the reason said, no take-off roll, nothing damaged. Otherwise the bar as it was
  const dispatch = said('strip-too-short') && R.says.some(v => /^strip-too-short.*not going there/.test(v)) && !/ROLL/.test(TR.fmtLeg(L));
  if (dispatch) check(true, id + ': the altiport REFUSED AT DISPATCH, said (190 m < its 249 m landing run) - never flown', R.says.find(v => v.startsWith('strip-too-short')));
  else check(said('vref-raised'), id + ': the finding\'s case - the load door\'s build, the elevator ran out on the approach (vref-raised)');
  const D = R.damage || {};
  // DARE (the user, 17 Nov): the final no longer refuses the altiport (43 'strip-short ... landing it short-field, no margin'); in that
  // committed path the roll-out's off-strip / ground-loop are the OUTCOME, said below as KNOWN - never a yield, a break, a dent or a crash
  const dareShort = said('strip-short');
  check(!D.yields && !D.breaks && !D.dented && !D.over && !L.faults.some(f => (dareShort ? /^(prop-strike|crash|yield|break|dent|obstacle|trunk)$/ : /^(prop-strike|crash|yield|break|dent|ground-loop|off-strip|obstacle|trunk)$/).test(f.k)), id + ': undamaged - no yield, no break, no dent, no prop strike, no ground loop, no off-strip',
    JSON.stringify({ yields: D.yields, breaks: D.breaks, dented: !!D.dented, over: !!D.over }) + '; ' + (L.faults.map(f => f.k + ': ' + f.note).join('; ') || 'no fault'));
  if (dispatch) { /* (the refusal's row above; no flight, no flare, no landing to judge) */ }
  else if (dareShort) {
    // DARE: TRIED, THE OUTCOME SAID. The case's elevator still cannot hold Vref (said above) and the one way in still carries the wind
    // behind; landed committed on the altiport, it is held to not breaking (the row above) and its roll-out is printed for what it is
    check(L.landedOn === 'tw_ski', id + ': tried (the user\'s dare) - the short final said and landed on Skyline Altiport, not diverted', (R.says.find(v => v.startsWith('strip-short')) || '') + ' | landed on ' + L.landedOn);
    console.log('  KNOWN ' + id + ': tried, landed committed - ' + (L.faults.map(f => f.k + ': ' + f.note).join('; ') || 'no fault') + ' (td ' + JSON.stringify(ld) + ')' +
      (R.finalAt ? '; the final begun at ' + R.finalAt.h + ' m MSL - row 2\'s finding (the final begun low at tw_ski)' : '') + ' - ROLL-OUT TRACKING + the vref-raised elevator, owed');
  } else if (said('strip-too-short')) {
    const atTw = R.flares.filter(f => f.d < 2000);
    check(L.landedOn && L.landedOn !== 'tw_ski' && ld.onStrip === true && L.faults.every(f => f.k === 'diverted'), id + ': the altiport REFUSED, said - landed and stopped on the strip diverted to',
      (R.says.find(v => v.startsWith('strip-too-short')) || '') + ' | landed on ' + L.landedOn + ', ' + JSON.stringify(ld) + ', faults ' + (L.faults.map(f => f.k).join(',') || 'none'));
    check(!atTw.length, id + ': no flare armed at the altiport it refused', atTw.map(f => f.over + ' m over its lowest ground ' + f.d + ' m out').join('; ') || 'none');
  } else {
    check(L.arr.stopS != null && !L.faults.length && L.landedOn === 'tw_ski', id + 'a: stopped on Skyline Altiport with no fault', 'td ' + JSON.stringify(ld) + ', faults ' + (L.faults.map(f => f.k + ': ' + f.note).join('; ') || 'none'));
    const hNeed = R.elev + ((R.finalAt && R.finalAt.hC) || 0) - 60;
    check(!!R.finalAt && R.finalAt.h >= hNeed && R.finalAt.h > R.SG.hi, id + 'b: the final begun at the field\'s circuit height (>= ' + Math.round(hNeed) + ' m, over the strip\'s ' + Math.round(R.SG.hi) + ' m)',
      R.finalAt ? 'FINAL at ' + R.finalAt.h + ' m MSL, ' + R.finalAt.d + ' m out' : 'no final');
    const outF = R.flares.filter(f => !(f.over >= 0 && f.low - R.SG.hi <= ARM_MAX));
    check(R.flares.length > 0 && !outF.length, id + 'c: every flare armed over the strip, at most ' + ARM_MAX + ' m above it', R.flares.map(f => f.over + ' m over the strip\'s lowest ground ' + f.d + ' m out at ' + f.t + ' s').join('; ') || 'no flare');
    if (L.arr.apprClear) check(L.arr.apprClear.c >= 3, id + 'd: the final\'s lowest node 3 m over the ground and the forest', L.arr.apprClear.c + ' m (' + L.arr.apprClear.what + ', ' + L.arr.apprClear.d + ' m out)');
  }
}
// 5 THE CONTRACT LAW'S ALTIPORT CREDIT, FLOWN (SKYLINE-RESORT; Game's condition 14 Nov via A0): 73_contracts CONTRACT_FIT.altiK
//   (an altiport's take-off run = the flat run x altiK: it is left downhill) must hold in the game's own flight. Each doer the
//   halved Skyline keeps - the Cub with one passenger (resort.01 / clients.01's lightest doer) and the metal Cessna with two and
//   40 kg (resort.05's only doer) - loaded as the contract loads it (the seats, the baggage), lined up on tw_ski and flown off
//   downhill by the page's pilot in the game's day (709 m: the density altitude is in it): the run from brake release to the
//   lowest node 2.5 m over the ground (genTORunAt's own end, so the same thing as the snapshot's toM) is
//   a  no longer than the contract law's run (contractTakeoffM: toM x mass ratio^2 x the surface x altiK) - the measured
//      ratio to the flat law's run printed: altiK must not be under it
//   b  inside the strip with room: at most its length - 10 m (from the top end)
const ALTI_CASES = [
  { name: 'the Cub + 1 passenger (resort.01)', design: 'cub', pax: 1, kg: 0,
    load: (s, bag) => { s.cabin = Object.assign({}, s.cabin, { pax: 1, occupied: [1, 1], baggage: bag }); s.cage = Object.assign({}, s.cage, { paxOcc1: 1, cabOcc: 1 }); } },
  { name: 'the metal Cessna + 2 passengers + 40 kg (resort.05)', design: 'c172', pax: 2, kg: 40,
    load: (s, bag) => { s.cabin = Object.assign({}, s.cabin, { pax: 2, occupied: [1, 1, 1, 1], baggage: bag }); s.cage = Object.assign({}, s.cage, { paxOcc1: 1, paxOcc2: 1, paxOcc3: 1, paxOcc4: 1, cabOcc: 1 }); } },
];
if (SHD.take()) {
  const TW = TR.tourWorld(C, IN, fs), W = TW.W, A = id => W.aerodromes.find(q => q.id === id), tw = A('tw_ski'), home = A('HOME');
  const K = C.CONTRACT_FIT && C.CONTRACT_FIT.altiK, Msum = d => d.nodes.reduce((a, n) => a + n.m, 0);
  check(typeof K === 'number' && K > 0 && K <= 1, '5 the contract law carries an altiport credit (CONTRACT_FIT.altiK ' + K + ')');
  for (const Q of ALTI_CASES) {
    const D = C.CONTRACT_DESIGNS[Q.design], j = JSON.parse(fs.readFileSync(path.join(ROOT, D.build), 'utf8'));
    const base = C.genMigrateSpec(JSON.parse(JSON.stringify(j.spec || j))), want = Q.pax * C.CONTRACT_FIT.occKg + Q.kg, m0 = Msum(C.buildGen(base));
    // the load the contract carries: the seats filled, the baggage grown to the rest (a baggage kg weighs ~0.6 kg built; the
    // cabin's own cap may stop it short - the mass flown is printed and the law is read at the contract's mass, the stricter)
    let bag = (base.cabin && base.cabin.baggage) || 0, sp = null, dm = 0;
    for (let it = 0; it < 12; it++) { sp = C.genMigrateSpec(JSON.parse(JSON.stringify(j.spec || j))); Q.load(sp, bag); dm = Msum(C.buildGen(sp)) - m0; if (Math.abs(dm - want) < 1.5) break; bag += (want - dm) / 0.6; }
    const def = C.buildGen(sp); def.params = Object.assign({}, def.params, { damage: true });
    const H = TR.gameHost(C, W, def, tw, home, { lineup: true }), sim = H.sim;
    H.queueCmd({ cmd: 'start' });
    let roll = null, lift = false, out = null;
    for (let k = 0; k < 240 * 60 && !out; k++) {
      H.step(); const ap = H.ap, cg = sim.cgPos();
      if (ap.phase === 'STOPPED' && !roll) break;
      if (!roll && ap.phase === 'ROLL') roll = [cg[0], cg[2]];
      if (roll && ap.phase === 'LIFTOFF') lift = true;
      if (roll && lift) { let low = Infinity; for (let i = 0; i < sim.n; i++) low = Math.min(low, sim.p[i * 3 + 1] - W.terrainH(sim.p[i * 3], sim.p[i * 3 + 2])); if (low >= 2.5) out = [cg[0], cg[2]]; }
    }
    const law = C.contractTakeoffM(D, want, C.CONTRACT_FIELDS.tw_ski), flat = law / K;
    const run = out ? Math.hypot(out[0] - roll[0], out[1] - roll[1]) : Infinity;
    const top = tw.len / 2, along = p => (p[0] - tw.x) * Math.cos(tw.hdg) + (p[1] - tw.z) * Math.sin(tw.hdg);
    const tag = '5 ' + Q.name + ' (+' + Math.round(dm) + ' kg flown, the law at +' + want + ')';
    console.log('  ' + tag + ': brake release ' + (roll ? (top - along(roll)).toFixed(0) + ' m below the top end' : '-') + ', 2.5 m up after ' + (isFinite(run) ? run.toFixed(1) : '-') +
      ' m; the law ' + law.toFixed(0) + ' m (flat ' + flat.toFixed(0) + ' m): measured ratio ' + (isFinite(run) ? (run / flat).toFixed(3) : '-') + ' vs altiK ' + K);
    check(isFinite(run) && run <= law, tag + 'a: the flown downhill run no longer than the contract law\'s', isFinite(run) ? run.toFixed(1) + ' m vs ' + law.toFixed(1) + ' m, ratio ' + (run / flat).toFixed(3) : 'never 2.5 m up');
    check(isFinite(run) && run <= tw.len - 10, tag + 'b: the run fits the ' + tw.len + ' m strip from its top end with 10 m to spare (the pilot lines up ' + (roll ? Math.round(top - along(roll)) : '?') + ' m below the top: Pilot\'s)', isFinite(run) ? run.toFixed(1) + ' m' : '-');
  }
}
// (the verdict line is run_gates.js's contract, `^GATE <ID>: PASS$` - a shard's tag in it never matched: G2520)
if (SHD.tag) console.log('  (' + SHD.tag.trim() + ')');
console.log('GATE ALTIPORT: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
