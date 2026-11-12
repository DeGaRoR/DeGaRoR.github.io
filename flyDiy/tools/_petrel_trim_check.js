#!/usr/bin/env node
// PETREL-TRIM (SEAPLANES-LAND, 10 Nov; the user: "it sits down at the back on the take-off, the rudder almost under
// water; the real one stays level, at most the tail boom comes parallel to the water") - a hull amphibian on the water,
// read in node: the card's geometry, its rest on the SEA lane and the game's pilot taking it off.
//
//   node tools/_petrel_trim_check.js [card] [--show]     -> "GATE PETRELTRIM: PASS|FAIL"
//        card: a build file relative to flyDiy/ (default builds/candidates/superpetrel_V4_1.json), loaded through the
//        load door (_load_build gameSpec) as the game loads it; the core is tools/flight_core.js (build it first)
//
// THE ACCEPTANCE (A0 + the user, 10 Nov):
//   (a) REST     at rest on the water (throttle shut, 20 s), the tail's lowest point is >= 0.10 m over the water
//   (b) RUN      the pilot's take-off from SEA: the fin and the tailplane never touch the water from the start of the
//                run to lift-off (13 Nov, A0 + REAL-FIGURES: was "the tail" - the boom root dips over the hump)
//   (b3) FOOT    the fin's root row and the tail post (where they sit on the boom) on that run >= -0.15 m (V4.2 dips -0.09 m at 12 kt; A0's default)
//   (b2) BOOM    the boom's lowest on that run >= -0.40 m (the hump's squat at the maker's root, bounded coarse)
//   (c) LEVEL    the highest pitch on the water is <= the boom's own upsweep (the line from the lowest point just aft of
//                the hull's stern to the tail post): "the boom at most parallel to the water"
//   (d) AWAY     the run reaches 30 kt and lifts off (dry 2 s) inside 90 s
// THE TAIL = every node more than 0.3 m aft of the hull's stern (the hull record's pos + its xStern; x aft, y up).
// It also prints the reads that name a cause: the hull step's angle aft of the CG (the seaplane rule, 10-15 deg) and
// the thrust line's height over the CG. Master db2298a41 on superpetrel_V4_1: the step 16.2 deg aft (not tail-heavy),
// the thrust 0.88 m over the CG (nose-down), the tail's underside 0.27 m over the step keel with the hull 0.29 m deep:
// (a)-(c) FAIL - the tail is drawn too low, not the balance.
// REAL-FIGURES' superpetrel_V4_2 (practical-cerf-7fjpwp cbb88444b, read 13 Nov on 23ce68c1f): the tail drawn 0.59 m over
// the keel and the boom swept up 13.4 deg - (a) 0.20 m PASS, (c) 7.8 deg PASS, (d) lift-off 28.7 s PASS; (b) FAIL -0.17 m:
// node 21, the boom's root 0.65 m aft of the stern, at 6.6 s / 12 kt / pitch 3.6 deg - the hump's squat, not the rotation
// (--show prints that line). The step sits 26 deg aft of V4.2's CG (the rule 10-15).
'use strict';
const path = require('path'), fs = require('fs');
const FLY = path.join(__dirname, '..');
const SHOW = process.argv.includes('--show');
const CARD = process.argv.slice(2).find(a => !a.startsWith('--')) || 'builds/candidates/superpetrel_V4_1.json';
const C = require('./flight_core.js'), LB = require('./_load_build.js');
const j = JSON.parse(fs.readFileSync(path.join(FLY, CARD), 'utf8'));
const spec = LB.gameSpec(j.spec || j);
const f2 = (v, n = 2) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(n) : String(v);
const mkDef = () => C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
let fails = 0;
const FOOT_DIP = -0.15;   // (b3): V4.2's rudder foot (the tail post, TPB) dips -0.09 m at 12 kt over the hump (A0 13 Nov, default 1)
const BOOM_DIP = -0.40;   // (b2): V4.2 dips -0.17 / -0.22 m over the hump (REAL-FIGURES: the maker's root, the squat) - twice that fails
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };

// ---- the geometry ----
const def0 = mkDef(), N = def0.nodes;
let m = 0, cx = 0, cy = 0; for (const nd of N) { m += nd.m; cx += nd.p[0] * nd.m; cy += nd.p[1] * nd.m; } cx /= m; cy /= m;
const sim0 = C.makeSim(def0, C.makeWorld()); sim0.reset(0);
const hull = sim0.hydro.floats.find(f => f.rec && f.rec.hull);
if (!hull) { console.log('FAIL the card has no hull (a hull amphibian is what this reads)\nGATE PETRELTRIM: FAIL'); process.exit(1); }
const step = hull.rec.pos, xStern = step[0] + hull.F.xStern;
const tail = N.map((nd, i) => i).filter(i => N[i].p[0] > xStern + 0.3);
// THE TAIL SURFACES (A0 + REAL-FIGURES 13 Nov: the gate is the fin and the rudder; the boom's root is where the maker
// draws it): every fin's VF/VR/VX/VX2 rows and its tip, the tail post (TPB/TPT), the tailplane (HF/HR/HB). The rest of
// the tail set is the BOOM - its root dips over the hump: a named row with a coarse bound, not the gate's row (b).
const TP = def0.parts || {}, TT = TP.TAIL || {}, surf = new Set();
// THE FOOT (A0 13 Nov 01:10, default 1): where the fin and the rudder sit on the boom - each fin's ROOT row (index 0 of
// VF/VR/VX/VX2: the boom's top) and the tail post (TPB/TPT): its own row (b3), bounded; everything above it is (b)
const footS = new Set();
for (const fn of (TT.fins || [])) for (const k of ['VF', 'VR', 'VX', 'VX2']) (fn[k] || []).forEach((i, r) => (r === 0 ? footS : surf).add(i));
for (const fn of (TT.fins || [])) if (fn.FIN != null) surf.add(fn.FIN);
for (const k of ['HF', 'HR', 'HB']) for (const sd of ['L', 'R']) for (const i of ((TT[k] || {})[sd] || [])) surf.add(i);
for (const k of ['FIN', 'FIN2']) if (TP[k] != null && TP[k] >= 0 && N[TP[k]]) surf.add(TP[k]);
for (const k of ['TPB', 'TPT']) if (TP[k] != null && TP[k] >= 0 && N[TP[k]] && !surf.has(TP[k])) footS.add(TP[k]);
const foot = [...footS];
const surfs = [...surf], boom = tail.filter(i => !surf.has(i) && !foot.includes(i));
if (!surfs.length) { console.log('FAIL the card names no fin, rudder or tailplane nodes (parts.TAIL)\nGATE PETRELTRIM: FAIL'); process.exit(1); }
const near = N.map((nd, i) => i).filter(i => N[i].p[0] > xStern && N[i].p[0] <= xStern + 0.8);
const lowNear = near.length ? near.reduce((a, i) => N[i].p[1] < N[a].p[1] ? i : a, near[0]) : null;
const post = def0.parts.TPB != null && N[def0.parts.TPB] ? def0.parts.TPB : tail.reduce((a, i) => N[i].p[0] > N[a].p[0] ? i : a, tail[0]);
const boomDeg = lowNear != null ? Math.atan2(N[post].p[1] - N[lowNear].p[1], N[post].p[0] - N[lowNear].p[0]) * 180 / Math.PI : NaN;
const eng = (def0.refs && def0.refs.engine) || [], engY = eng.length ? eng.reduce((a, i) => a + N[i].p[1], 0) / eng.length : NaN;
console.log('card ' + CARD + '  ' + f2(m, 1) + ' kg  gear ' + spec.gear.type);
console.log('  CG x ' + f2(cx, 3) + ' y ' + f2(cy, 3) + '; the hull step keel x ' + f2(step[0], 3) + ' y ' + f2(step[1], 3) + ', stern x ' + f2(xStern) +
            ': the step ' + f2(Math.atan2(step[0] - cx, cy - step[1]) * 180 / Math.PI, 1) + ' deg aft of the CG (the seaplane rule 10-15)');
console.log('  the thrust line ' + f2(engY - cy, 3) + ' m over the CG; the tail ' + tail.length + ' nodes, its underside ' + f2(Math.min(...tail.map(i => N[i].p[1])), 3) +
            ' m over the step keel; the boom upsweep ' + f2(boomDeg, 1) + ' deg (node ' + lowNear + ' -> ' + post + ')');

// ---- the water ----
function run(o) {
  const d = mkDef(), world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(d, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  const ap = o.pilot ? C.makePilot(sim, d, world) : null; if (ap) ap.setRoute(sea, sea);
  const p = sim.p, R = { tailRest: null, tailRun: Infinity, surfRun: Infinity, boomRun: Infinity, footRun: Infinity, pitchMax: -99, kt30: null, lift: null, phases: [] };
  let T = 0, wasWet = true, dry = null, ran = false, last = '';
  for (let s = 0; s < o.secs * 60; s++) {
    if (ap) ap.update(1 / 60); else { sim.ctl.thr = 0; sim.ctl.de = 0; }
    sim.step(1 / 60); T += 1 / 60;
    const [xA] = sim.axes(), pitch = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI;
    if (!isFinite(pitch)) { R.finite = false; break; }
    let tl = Infinity, tlI = -1; for (const i of tail) { const h = p[i * 3 + 1] - world.waterH(p[i * 3], p[i * 3 + 2]); if (h < tl) { tl = h; tlI = i; } }
    const wet = sim.hydro.floats.reduce((a, x) => a + x.wet, 0) > 0, v = sim.cgVel(), kt = Math.hypot(v[0], v[2]) / 0.5144;
    if (ap && ap.phase !== last) { R.phases.push(f2(T, 1) + ' ' + ap.phase); last = ap.phase; }
    if (ap && (ap.phase === 'ROLL' || ap.phase === 'LIFTOFF')) ran = true;
    if (!ap) { if (T > o.secs - 0.5) R.tailRest = R.tailRest == null ? tl : Math.min(R.tailRest, tl); continue; }
    if (ran && R.lift == null && wet) { if (tl < R.tailRun) R.tailAt = { t: +T.toFixed(1), kt: +kt.toFixed(1), pitch: +pitch.toFixed(1), node: tlI, x: +N[tlI].p[0].toFixed(2), y: +N[tlI].p[1].toFixed(2), phase: ap.phase };
      R.tailRun = Math.min(R.tailRun, tl);
      for (const i of surfs) { const h = p[i * 3 + 1] - world.waterH(p[i * 3], p[i * 3 + 2]);
        if (h < R.surfRun) { R.surfRun = h; R.surfAt = { t: +T.toFixed(1), kt: +kt.toFixed(1), pitch: +pitch.toFixed(1), node: i, x: +N[i].p[0].toFixed(2), y: +N[i].p[1].toFixed(2) }; } }
      for (const i of foot) R.footRun = Math.min(R.footRun, p[i * 3 + 1] - world.waterH(p[i * 3], p[i * 3 + 2]));
      for (const i of boom) R.boomRun = Math.min(R.boomRun, p[i * 3 + 1] - world.waterH(p[i * 3], p[i * 3 + 2]));
      R.pitchMax = Math.max(R.pitchMax, pitch); }
    if (ran && R.kt30 == null && kt >= 30) R.kt30 = T;
    if (!wet && wasWet && ran && R.lift == null) dry = T;
    if (wet && R.lift == null) dry = null;
    if (!wet && dry != null && R.lift == null && T - dry >= 2) R.lift = dry;
    wasWet = wet;
    if (R.lift != null && T - R.lift > 3) break;
  }
  return R;
}
const rest = run({ secs: 20 }), to = run({ pilot: true, secs: 90 });
if (SHOW) console.log('  the pilot: ' + to.phases.join(' | ')); if (SHOW) console.log('  the tail lowest on the run: ' + JSON.stringify(to.tailAt) + ' (t s, kt, pitch deg, the node and its drawn x aft / y up)');
if (SHOW) console.log('  the fin and tailplane lowest: ' + JSON.stringify(to.surfAt) + '; their drawn lowest ' + f2(Math.min(...surfs.map(i => N[i].p[1]))) + ' m over the step keel');
verdict(rest.tailRest != null && rest.tailRest >= 0.10, '(a) REST: the tail ' + f2(rest.tailRest) + ' m over the water at rest (>= 0.10)');
verdict(isFinite(to.surfRun) && to.surfRun > 0, '(b) RUN: the fin, the rudder (over the root) and the tailplane lowest on the run ' + f2(to.surfRun) + ' m over the water (> 0: never touch)');
verdict(!foot.length || (isFinite(to.footRun) && to.footRun >= FOOT_DIP), '(b3) FOOT: the fin\'s root and the tail post (on the boom) lowest on the run ' + f2(to.footRun) + ' m over the water (>= ' + FOOT_DIP + ': a brief dip over the hump allowed, A0 13 Nov)');
verdict(isFinite(to.boomRun) && to.boomRun >= BOOM_DIP, '(b2) BOOM ROOT: the boom\'s lowest on the run ' + f2(to.boomRun) + ' m over the water (>= ' + BOOM_DIP + ': the hump\'s squat, a coarse bound)');
verdict(to.pitchMax <= boomDeg, '(c) LEVEL: the highest pitch on the water ' + f2(to.pitchMax, 1) + ' deg <= the boom\'s upsweep ' + f2(boomDeg, 1) + ' deg (at most parallel)');
verdict(to.kt30 != null && to.lift != null, '(d) AWAY: 30 kt at ' + f2(to.kt30, 1) + ' s, lift-off at ' + f2(to.lift, 1) + ' s (inside 90 s)');
console.log('GATE PETRELTRIM: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
