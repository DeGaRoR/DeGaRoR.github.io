// tools/_zreach.mjs — CAN THIS CREATURE PHYSICALLY GET THERE? Geometry, not simulation.
//
//     node tools/_zreach.mjs [nRandom]
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// `tools/_zlight.mjs` reports that 1 creature in 7 is helped by a light sensor,
// and that has been read for several sessions as "orientation is the open
// research question". IT IS NOT A SENSING RESULT. `_zlight` hands the creature a
// PERFECT, NOISELESS, UNLIMITED-RANGE BEARING every physics step
// (`bearingTo(sim, light, plane)` at line 112) — there is no perception to fail.
//
// What fails is ACTUATION, and it fails for a reason that can be computed without
// running anything: a swimmer has a minimum turning radius
//
//     r = v / omega
//
// and it cannot curve inside it. Ask a creature whose turning circle is 11 cm
// across to reach a point 3 cm away at 90 degrees off its heading and the answer
// is no, whatever it can see and however long it tries.
//
// This tool computes, for each creature, the shortest legal path to the target
// (Dubins: one arc on the minimum-radius circle, then a straight tangent — the
// optimal path to a POINT with free final heading) and compares it against the
// distance the creature could swim in the trial window. It is pure arithmetic on
// two measured numbers, so it costs one S2 and one S3 per creature rather than a
// 40 s trial per bearing.
//
// ── WHAT IT FOUND, AND IT REFRAMES PHASE 3 ───────────────────────────────────
//
// Over 21 creatures (7 library + 14 corpus), at `_zlight`'s own geometry —
// target 3.0 cm away, bearings +-90/+-135/180, 40 s window:
//
//     creatures that can reach ANY bearing:   1 / 21
//
// and the one is `eel-unison`, which is exactly the one creature `_zlight`
// reports as helped. THE MODEL PREDICTS THE EXPERIMENT. Six of the seven were
// being asked to do something kinematically impossible, so "1/7 helped" is not
// evidence about sensing, steering, or gains — it is a measurement of the task.
//
// ── THE WINDOW IS THE DOMINANT LEVER, AND IT IS FREE ─────────────────────────
//
// Same task, same creatures, only the trial length changed:
//
//     T (s)     reach >=1 bearing    5/5     mean/5    blocked by RANGE
//        40           1 / 21          1       0.24         12 / 21
//        80           4 / 21          2       0.67         10 / 21
//       120           4 / 21          3       0.90          7 / 21
//       200           6 / 21          5       1.38          6 / 21
//       300          10 / 21          8       2.14          5 / 21
//       600          15 / 21         13       3.48          1 / 21
//
// No gene, no schema, no selection. `FORAGE_SECONDS` is already 300 elsewhere in
// this project; `_zlight` alone runs at 40.
//
// ── AND THE CRITERION IS omega x T, NOT TURN RATE ────────────────────────────
//
// Place the target at a fixed FRACTION of the creature's own swim budget — the
// fair way to compare a 0.003 cm/s creature with a 0.76 cm/s one — and speed
// cancels exactly:
//
//     r/D = (v/omega) / (k v T) = 1 / (omega k T)
//
// so reachability depends only on `omega * T`, THE TOTAL ANGLE THE CREATURE CAN
// TURN THROUGH IN THE TRIAL. The corpus median of 1.57 deg/s over 40 s is 63
// degrees of total turning: it cannot complete a single 90-degree turn, let alone
// aim. That is the whole of the "orientation problem", stated as one number.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { S3 } from '../engine/l2/probes.js';
import { netSpeed } from '../engine/l2/objective.js';
import { SEEDS } from '../worlds/seeds.js';
import { CURATED } from '../worlds/w1_curated.js';
import W1_SLICE from '../worlds/w1_slice.js';

/**
 * IMPORTED AS A LIBRARY, OR RUN AS A TOOL — and it has to be both.
 *
 * `minPath` is the useful part and other measurements want it, but a bare
 * `import { minPath }` used to execute this whole file: RAPIER init, a corpus
 * sweep, and thirty lines of table printed into the middle of the importer's
 * output. Harmless once, and exactly the kind of thing that later gets "fixed"
 * by copying the function somewhere else.
 */
const RUN_AS_TOOL = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('_zreach.mjs');

/**
 * Shortest path from (origin, heading +x) to a point, for a vehicle with minimum
 * turning radius `r`. One arc then one straight tangent — the optimal path to a
 * POINT (as opposed to a pose), which is what a light is.
 *
 * A target INSIDE a turning circle is skipped for that side: the vehicle cannot
 * curve tightly enough to fall onto it and must use the other circle, which is
 * what makes a near, off-axis target so much harder than a far one.
 *
 * Validated against four analytic cases: straight ahead at huge r gives the
 * straight-line distance; turn-in-place at r->0 also gives it; a target inside
 * the near circle is forced onto the far one at a large cost; r = D/3 at 90
 * degrees gives 1.28 D.
 */
export function minPath(r, dist, bearingDeg) {
  return minPathParts(r, dist, bearingDeg).total;
}

/**
 * The same path, with the ARC and the STRAIGHT reported separately.
 *
 * ── WHY THE SPLIT IS NEEDED, AND WHY THE ORIGINAL COMPARISON WAS WRONG ───────
 *
 * `reach` used to ask `minPath(...) <= speed * T`, comparing a path length
 * against the distance the creature covers AT CRUISE. That silently assumes the
 * arc is traversed at cruise speed, and it is not: measured over the library,
 * creatures travel at 0.26-0.55x cruise while holding a turn (`turnSpeedRatio`).
 * The arc is the expensive part and it was being billed at the cheap rate.
 *
 * Stated in TIME, which is what the trial window actually is:
 *
 *     t = arc / v_turn  +  tangent / v_cruise  <=  T
 *
 * Two speeds, each applied to the segment it belongs to. Both are measured — S3
 * returns `turnSpeedRatio`, S2 returns the cruise — so this adds no constant.
 */
export function minPathParts(r, dist, bearingDeg) {
  const th = (bearingDeg * Math.PI) / 180;
  const T = [dist * Math.cos(th), dist * Math.sin(th)];
  let best = { arc: Infinity, tangent: Infinity, total: Infinity };
  for (const s of [1, -1]) {
    const C = [0, s * r];
    const dx = T[0] - C[0], dy = T[1] - C[1];
    const d = Math.hypot(dx, dy);
    if (d < r) continue;
    const tangent = Math.sqrt(d * d - r * r);
    const a0 = Math.atan2(-C[1], -C[0]);
    const aT = Math.atan2(dy, dx);
    const aOff = Math.acos(r / d);
    let arc = s * ((aT - s * aOff) - a0);
    arc = ((arc % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const total = r * arc + tangent;
    if (total < best.total) best = { arc: r * arc, tangent, total };
  }
  return best;
}

if (!RUN_AS_TOOL) {
  // Imported for `minPath` alone. Everything below is the tool.
} else {

await RAPIER.init();

const N_RANDOM = Number(process.argv[2] ?? 14);
/** `node tools/_zreach.mjs 0 validate` — score this model against `_zgoal`. */
const VALIDATE = process.argv[3] === 'validate';
const R2D = 180 / Math.PI;
/** `_zlight`'s own geometry. START_DIST is labelled "metres" there; this is CGS. */
const D = 3.0;
const BEARINGS = [90, -90, 135, -135, 180];
const WINDOWS = [40, 80, 120, 200, 300, 600];

function kinematics(genome) {
  const v = assessViability(RAPIER, genome, W1_SLICE);
  if (!v.ok) return null;
  const ns = netSpeed(RAPIER, { plan: v.plan, genome, world: W1_SLICE });
  if (!ns.valid) return null;
  let s3;
  try { s3 = S3(RAPIER, { plan: v.plan, genome, world: W1_SLICE, cruiseSpeed: ns.score }); }
  catch { return null; }
  if (!s3.valid) return null;
  // ── THE RADIUS COMES FROM S3 NOW, NOT FROM cruiseSpeed / capability ─────────
  //
  // This used to be `ns.score / (turnRate3d * steeringAuthority)`, and both
  // halves were wrong. The numerator was the STRAIGHT-LINE speed against a turn
  // rate measured while turning — two operating points. The denominator was
  // measured at `turnBias = 1.0`, where the commanded joint angle exceeds the
  // joint's own limit and thrust collapses, so it recorded `eel-fast` at
  // 1.25 deg/s where a sweep finds 8.88, and `eel` at exactly zero.
  //
  // Since BRIDGE_V 8, `S3.turnRadius` is the mean speed over the 3-D heading
  // rate FROM THE SAME RUN, at the creature's own `bestBias`. It is the
  // quantity this file always meant.
  const cap = s3.turnRate3d * s3.steeringAuthority;
  return {
    speed: ns.score,
    cap,
    radius: s3.turnRadius,
    bestBias: s3.bestBias,
    // Speed while holding the turn — the rate the ARC is actually travelled at.
    turnSpeed: Math.max(1e-9, ns.score * s3.turnSpeedRatio),
  };
}

const pop = [];
for (const s of [...SEEDS, ...CURATED]) {
  const k = kinematics(s.genome);
  if (k) pop.push({ label: s.id, ...k });
}
let n = 0;
for (let i = 0; n < N_RANDOM && i < N_RANDOM * 30; i++) {
  const g = createRandomGenome(rngFrom('morph', 'census', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (!v.ok || v.plan.jointCount < 3) continue;
  n++;
  const k = kinematics(g);
  if (k) pop.push({ label: `rand${n}`, ...k });
}

/**
 * A TIME budget, not a distance one. See `minPathParts` for why the distinction
 * is not pedantry: the arc is travelled at `turnSpeed` and the tangent at cruise,
 * and billing the whole path at cruise flattered every creature that turns.
 */
const reachTime = (p, D2, b) => {
  const mp = minPathParts(p.radius, D2, b);
  if (!Number.isFinite(mp.total)) return Infinity;
  return mp.arc / p.turnSpeed + mp.tangent / Math.max(1e-9, p.speed);
};
const reach = (p, T, D2 = D) => BEARINGS.filter((b) => reachTime(p, D2, b) <= T).length;

console.log(`_zreach — reachability of a point ${D} cm away, bearings ${BEARINGS.join('/')}`);
console.log(`n = ${pop.length}  (${SEEDS.length + CURATED.length} library + ${n} corpus)\n`);
console.log('name'.padEnd(16), 'v cm/s'.padStart(8), 'turn °/s'.padStart(9), 'radius cm'.padStart(10), `  reach @${WINDOWS[0]}s`);
for (const p of pop) {
  console.log(
    p.label.padEnd(16), p.speed.toFixed(3).padStart(8), (p.cap * R2D).toFixed(2).padStart(9),
    (Number.isFinite(p.radius) ? p.radius.toFixed(2) : 'inf').padStart(10),
    `   ${reach(p, WINDOWS[0])}/5`,
  );
}

console.log('\nTHE WINDOW IS THE LEVER — same task, same creatures, longer trial:');
console.log('  T (s)   >=1 bearing    5/5    mean/5   cannot even COVER 3 cm');
for (const T of WINDOWS) {
  let any = 0, all = 0, tot = 0, short = 0;
  for (const p of pop) {
    const k = reach(p, T);
    tot += k; if (k >= 1) any++; if (k === 5) all++;
    if (p.speed * T < D) short++;
  }
  console.log(
    String(T).padStart(7), `${any}/${pop.length}`.padStart(13), String(all).padStart(7),
    (tot / pop.length).toFixed(2).padStart(9), `${short}/${pop.length}`.padStart(24),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOES THE ENVELOPE AGREE WITH THE EXPERIMENT?  `node tools/_zreach.mjs 0 validate`
//
// This model has never been checked against a creature actually trying. It is
// cheap — two measured numbers and some trigonometry — and that is exactly why
// it needs checking: a cheap predictor that is never scored against the thing it
// predicts is a prior wearing a lab coat.
//
// PRE-DECLARED, before the first run: agreement on >= 75% of (creature,
// direction) cells keeps it as a gate on trials. BELOW 75% IT IS RETIRED AS A
// GATE AND RECORDED AS RETIRED — not tuned until it agrees. A model adjusted to
// match the experiment it was supposed to predict has stopped being evidence.
//
// ONLY THE IN-PLANE CELLS ARE COMPARABLE, and that is a real limit rather than a
// convenience. Dubins geometry is planar: it has no representation of a creature
// rolling its bend plane onto an out-of-plane target, which is measurably how
// `eel` reaches things. Scoring the envelope on cells it cannot express would be
// rigging the test in the other direction.
if (VALIDATE) {
  const { goalScore, prepare, GOAL_SECONDS, GOAL_CAPTURE } = await import('./_zgoal.mjs');
  console.log(`\n── ENVELOPE vs BEHAVIOUR (in-plane cells only, ${GOAL_SECONDS} s) ──`);
  console.log('name              D cm  radius |  dir   predicted   observed   agree');
  let agree = 0, cells = 0;
  for (const s of [...SEEDS, ...CURATED]) {
    const prep = prepare(RAPIER, s.genome, W1_SLICE);
    if (!prep) continue;
    const k = kinematics(s.genome);
    if (!k) continue;
    const r = goalScore(RAPIER, {
      plan: prep.plan, genome: s.genome, world: W1_SLICE,
      plane: prep.plane, speed: prep.speed, seconds: GOAL_SECONDS,
    });
    if (!r.valid) continue;
    for (const c of r.cells.filter((x) => x.phi === 0)) {
      const t = reachTime(k, r.dist, c.theta);
      const predicted = t <= GOAL_SECONDS;
      // "Observed" is the behavioural fact the envelope claims to predict:
      // did it get within the capture radius. Not closure — the envelope makes
      // a binary claim and has to be scored against a binary outcome.
      const observed = c.dLive < GOAL_CAPTURE;
      const ok = predicted === observed;
      if (ok) agree++;
      cells++;
      console.log(`${s.id.padEnd(16)} ${r.dist.toFixed(2).padStart(5)} ${(Number.isFinite(k.radius) ? k.radius.toFixed(2) : 'inf').padStart(7)} |`
        + ` ${String(c.theta).padStart(4)}   ${String(predicted).padStart(9)}   ${String(observed).padStart(8)}   ${ok ? 'yes' : 'NO'}`);
    }
  }
  const pct = cells ? (100 * agree / cells) : 0;
  console.log(`\n  agreement ${agree}/${cells} = ${pct.toFixed(0)}%   GATE: >= 75%`);
  console.log(pct >= 75
    ? '  The envelope may stand as a gate on trials.'
    : '  RETIRED AS A GATE. The envelope does not predict arriving and must not be\n'
      + '  used to decide which creatures are worth trialling. tools/_zgoal.mjs is the\n'
      + '  only scorer. Not tuned to agree — see the note above this block.');
}

console.log('\nomega x T — the total turning available, which is what actually decides it:');
for (const T of WINDOWS) {
  const med = [...pop].map((p) => p.cap * R2D).sort((a, b) => a - b)[pop.length >> 1];
  console.log(`  T=${String(T).padStart(3)}s  median creature turns ${(med * T).toFixed(0).padStart(5)}° in total`
    + `${med * T < 180 ? '   <- cannot complete a 180° turn' : ''}`);
}

}
