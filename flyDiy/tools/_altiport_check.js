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
//   node tools/_altiport_check.js            -> "GATE ALTIPORT: PASS|FAIL" (3 heavy jobs: --shard=i/3)
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
const JOBS = [{ name: "the user's Jodel", key: JODEL, n: 1 }, { name: "the user's Cub", key: TR.BUILDS.cub.key, n: 2, capacity: 29, knownRoll: true }];
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
if (SHD.take()) {
  const t0 = Date.now();
  const R = flyWatched(JODEL, { doctor: 250, tMax: 900 });
  const L = R.L, id = '3 the doctored arrival (tw_ski\'s record 250 m low), the Jodel';
  console.log('  doctored: ' + TR.fmtLeg(L).trim() + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  if (SHOW) console.log('    verdicts ' + R.says.join(' | ') + '\n    flares ' + JSON.stringify(R.flares) + '\n    final ' + JSON.stringify(R.finalAt));
  const guard = R.says.filter(s => /^flare-guard/.test(s));
  check(guard.length > 0 && R.finalAt && R.finalAt.h < R.SG.lo, id + ': the arrival came in under the strip and the arming law was met there - the guard caught it (calibration)',
    (R.finalAt ? 'FINAL at ' + R.finalAt.h + ' m MSL (the strip ' + Math.round(R.SG.lo) + '..' + Math.round(R.SG.hi) + ' m); ' : '') + (guard.join(' | ') || 'no flare-guard said'));
  const under = R.flares.filter(f => f.over < 0), high = R.flares.filter(f => f.low - R.SG.hi > ARM_MAX);
  check(!under.length && !high.length, id + ': no flare armed under the strip or over ' + ARM_MAX + ' m above it', R.flares.map(f => f.over + ' m over the strip ' + f.d + ' m out at ' + f.t + ' s').join('; ') || 'no flare');
  const D = R.damage;
  check(!!D && !D.over && !D.breaks, id + ': the airframe whole (no crash, no member broken)', D ? JSON.stringify({ yields: D.yields, breaks: D.breaks, over: !!D.over, reason: D.reason || null }) : '-');
}
console.log('GATE ALTIPORT' + SHD.tag + ': ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
