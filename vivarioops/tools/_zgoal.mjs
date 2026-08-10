// tools/_zgoal.mjs — DOES THIS CREATURE ARRIVE? The behavioural scorer.
//
//     node tools/_zgoal.mjs [nRandom] [seconds] [gain]
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// Every number this project has used to rank steering is KINEMATIC — turnRate3d,
// steeringAuthority, turnCapability, turnRadius, and the `_zreach` envelope built
// on them. All of them are measured by `S3` at `turnBias = +-1.0`, and none of
// them has ever been checked against a creature actually getting somewhere.
//
// Checked, they are ANTI-CORRELATED with arriving. Full-3D trial, 8 cm target,
// 90 s, six directions spanning the creature's own steering plane and 90 degrees
// out of it, blind arm subtracted:
//
//     creature          turnCapability          control-subtracted closure
//     eel                0.00 deg/s   <-- "provably never will steer"   +0.654
//     eel-fast           1.25                                           +0.292
//     eel-unison        16.27 deg/s   <-- "the one creature that works"  -0.111
//     snarlback-teal     3.21                                           -0.301
//
// `eel` closes 8.00 -> 0.14 cm on a target NINETY DEGREES OUT of the plane it can
// bend in: it corkscrews the target into that plane. `_zreach` scored it 0/5 with
// an infinite radius, and `ui/screens/vivarium.js` says in a comment that it will
// never steer. The ranking is upside down, and nothing has ever been selected for
// reaching a goal because nothing has ever SCORED reaching a goal.
//
// ── THE BLIND ARM IS NOT OPTIONAL ────────────────────────────────────────────
//
// `snarlback-teal` scores 0.333 mean closure with its sensor switched off, purely
// by wandering into an 8 cm sphere inside a bounded tank. Raw closure would rank
// it above creatures that genuinely home. So the reported number is always
// live-minus-blind on IDENTICAL geometry, which is `_zlight`'s own standard.
//
// The blind arm is run ONCE per creature rather than once per direction: at
// `turnBias = 0` the trajectory does not depend on where the target is, so one
// traverse is scored against all six targets. That is a 42% saving and it is
// exact, not an approximation.
//
// ── THINGS THAT COST TIME BEFORE AND ARE FIXED HERE ──────────────────────────
//
//   * BOUNDED, NEVER WRAPPED. The gain sweep in HANDOVER-STEERING.md ran with
//     `wrap: true`, so the torus teleported the creature and every absolute
//     number in that table is void. A goal trial in a torus is not a goal trial.
//   * ALWAYS PASS THE S3 PLANE. `bearingTo(sim, target, null)` falls back to the
//     horizontal, and these creatures turn in pitch. Same creature, same target:
//     own plane closes 6.32 -> 1.00, horizontal does nothing at all.
//   * THE TARGET FRAME IS BUILT THE WAY `bearingTo` BUILDS ITS OWN so the sensor
//     and the placement cannot drift apart. If that projection is ever changed,
//     both move together.
import RAPIER_NS from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { sensorTurnBias, sensorTurnBias2 } from '../engine/l1/controller.js';
import { S3, S3_BIAS, SOLO_GRAVITY } from '../engine/l2/probes.js';
import { bearingTo, bearingPair } from '../engine/l2/duel.js';
import { netSpeed } from '../engine/l2/objective.js';
import { SEEDS } from '../worlds/seeds.js';
import { CURATED } from '../worlds/w1_curated.js';
import W1_SLICE from '../worlds/w1_slice.js';

/** Imported as a library, or run as a tool — the `_zreach.mjs` idiom. */
const RUN_AS_TOOL = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('_zgoal.mjs');

/** Settle at effort 0 before the clock starts, exactly as `runSolo` does. */
export const GOAL_SETTLE = 2.0;
/** Trial length. `_zlight` ran 40 s; FORAGE_SECONDS is 300; this is the middle. */
export const GOAL_SECONDS = 90;
/**
 * Capture radius, cm. ABSOLUTE, not a fraction of the start distance: arriving
 * is a physical event — the creature is within about one body thickness of the
 * mark — and it should not get easier because the creature started further out.
 */
export const GOAL_CAPTURE = 1.5;
/**
 * FLOOR ON THE START DISTANCE, and it is the capture radius that sets it.
 *
 * The first run of this tool scored `staircase` at 0.259 closure and 0.67
 * ARRIVED while it travelled 0.72 cm in the whole 90 s. Its speed is 0.008 cm/s,
 * so the scaled distance came out at the old floor of 2.0 cm — barely above a
 * 1.5 cm capture radius, and drifting a body-thickness counted as arriving.
 *
 * The capture radius is PHYSICAL and must stay absolute: arriving means being
 * within about a body thickness of the mark, and that does not get easier
 * because the creature is slow. So the START has to move instead. At three
 * capture radii the creature must cover at least two thirds of the way under
 * its own steering before anything is credited.
 *
 * A creature too slow to cover 4.5 cm in the window then scores no arrivals,
 * which is TRUE, and its `closure` fraction still carries a usable gradient for
 * selection because closing 0.6 of 4.5 cm is 0.13 rather than 0.
 */
export const GOAL_MIN_DIST = 3 * GOAL_CAPTURE;
/** Came apart. `_zbase`/`_zboom`'s convention for `integrity().spread`. */
const SPREAD_BURST = 3;

/**
 * WHERE THE TARGETS GO, and the second coordinate is the whole point.
 *
 * `theta` is the angle inside the creature's own steering plane; `phi` is the
 * ELEVATION OUT of it. A single-plane bender has no mechanism for phi > 0 — it
 * gets there, when it gets there, by rolling the plane onto the target, which is
 * incidental rather than designed. Scoring only phi = 0 would flatter the tank,
 * because the player's beacon lands anywhere on the sphere.
 *
 * Six directions, not nine: theta 60 is the hard in-plane case (inside most
 * turning circles) and 180 the easy one, and three elevations span the gap. The
 * bands are reported separately so the 3-D deficit stays visible instead of
 * being averaged into a single flattering mean.
 */
export const DIRECTIONS = [
  [60, 0], [180, 0],          // in the steering plane
  [60, 45], [180, 45],        // half out
  [0, 90], [60, 90],          // square out of it — reachable only by rolling
];

/**
 * The cheap set — one direction per band, for use INSIDE a selection loop.
 *
 * Selection cannot afford the full set: six directions plus a blind arm is seven
 * traverses per creature per generation, and at a population of 12 over 5
 * generations on two arms and three seeds that is a working day of simulation.
 * Three directions is four traverses, and it keeps one sample of each band so a
 * lineage cannot win by getting good in-plane while the out-of-plane column goes
 * to zero — which is the specific way this objective could quietly narrow.
 *
 * WINNERS ARE ALWAYS RE-SCORED ON THE FULL `DIRECTIONS` SET before any gate is
 * read off them. The cheap set ranks; it does not report.
 */
export const DIRECTIONS_FAST = [[60, 0], [180, 45], [60, 90]];

const bandOf = (phi) => (phi === 0 ? 'inPlane' : phi === 90 ? 'out' : 'mid');

// ── small vector helpers; kept local, this file is the only consumer ──────────
const qrot = (q, v) => {
  const [x, y, z, w] = q, [a, b, c] = v;
  const ix = w * a + y * c - z * b, iy = w * b + z * a - x * c;
  const iz = w * c + x * b - y * a, iw = -x * a - y * b - z * c;
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};
const unit = (v) => { const m = Math.hypot(v[0], v[1], v[2]); return m > 1e-12 ? [v[0] / m, v[1] / m, v[2] / m] : [0, 0, 1]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * The creature's own (forward, right, planeNormal) frame at the moment the clock
 * starts, in world coordinates.
 *
 * This is `bearingTo`'s construction verbatim — rotate the root-local plane
 * normal by the CURRENT root orientation, project the root's local +Z into that
 * plane — for the reason in the header: a target placed by one projection and
 * sensed by another is the B2 §5 defect all over again, in a new place.
 */
export function goalFrame(sim, plane) {
  const q = sim.bodies[0].rotation();
  const qa = [q.x, q.y, q.z, q.w];
  const n = unit(qrot(qa, plane));
  const f3 = qrot(qa, [0, 0, 1]);
  const fd = f3[0] * n[0] + f3[1] * n[1] + f3[2] * n[2];
  const f = unit([f3[0] - fd * n[0], f3[1] - fd * n[1], f3[2] - fd * n[2]]);
  return { f, r: unit(cross(n, f)), n };
}

/** Target at (theta in-plane, phi out of plane), `dist` cm from `com`. */
function targetAt(com, frame, dist, thetaDeg, phiDeg) {
  const a = (thetaDeg * Math.PI) / 180, e = (phiDeg * Math.PI) / 180;
  const ce = Math.cos(e), se = Math.sin(e);
  return [0, 1, 2].map((i) => com[i]
    + dist * (ce * (Math.cos(a) * frame.f[i] + Math.sin(a) * frame.r[i]) + se * frame.n[i]));
}

/**
 * ONE TRAVERSE. Returns the sampled centre-of-mass path plus the frame and the
 * origin, so the caller can score it against any number of targets.
 *
 * `steer` is called every physics step with the simulation and returns the
 * turnBias. Passing `null` is the blind arm, and it is the reason a single
 * traverse can serve six directions: with no steering command the path is
 * independent of the target.
 */
function traverse(RAPIER, { plan, genome, world, plane, seconds, steer }) {
  const sim = createSimulation(RAPIER, plan, genome,
    { ...world, gravity: SOLO_GRAVITY },
    // Bounded and unwrapped. See the header — a goal trial in a torus is not one.
    { bounded: true, wrap: false, effort: 0, turnBias: 0 });

  for (let i = 0; i < Math.round(GOAL_SETTLE / FIXED_DT); i++) sim.step();
  sim.resetClock();
  sim.control.effort = 1;

  const frame = goalFrame(sim, plane);
  const origin = sim.centreOfMass();
  const path = [];
  const steps = Math.round(seconds / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    if (steer) { const c = steer(sim); sim.control.turnBias = c.a; sim.control.turnBias2 = c.b; }
    sim.step();
    // 15 Hz. The creature's CoM oscillates at 12-22 Hz and this is a DISTANCE,
    // not a path length, so it does not alias the way `straightness` did — the
    // nearest approach is a smooth function of a wobbling position.
    if ((s & 7) === 0) { const c = sim.centreOfMass(); path.push(c[0], c[1], c[2]); }
  }
  const burst = sim.integrity().spread > SPREAD_BURST;
  sim.free();
  return { frame, origin, path, burst };
}

/** Closest the sampled path ever came to `t`. */
function nearest(path, t) {
  let best = Infinity;
  for (let i = 0; i < path.length; i += 3) {
    const d = Math.hypot(path[i] - t[0], path[i + 1] - t[1], path[i + 2] - t[2]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * THE SCORE. Live minus blind, over `DIRECTIONS`, in the creature's own plane.
 *
 * `dist` scales to the creature — `0.35 * v * seconds`, held inside
 * [GOAL_MIN_DIST, 8] cm — because a 0.008 cm/s creature and a 0.76 cm/s one
 * asked to cover the same absolute distance are being given two different
 * experiments. The floor is the capture radius (see `GOAL_MIN_DIST`); the
 * ceiling is the tank: `tankBounds` is [32, 24, 32] and a target further out
 * than 8 cm from a creature starting near the middle is a wall trial.
 *
 * `gain` overrides both sensor channels when it is a number. The DEFAULT IS THE
 * GENOME'S OWN GAINS, which is the honest score and the one selection must use.
 * The override exists because the whole authored library ships `preyGain 0.600 /
 * threatGain -0.400`, a sum of 0.200, so the cast is commanding a fifth of what
 * the mechanism can take — a fact worth being able to separate from the bodies.
 *
 * @returns {{valid:boolean, reason?:string, dist:number, cells:Array,
 *            live:number, blind:number, closure:number, arrived:number,
 *            bands:Object}}
 */
export function goalScore(RAPIER, { plan, genome, world, plane, speed, seconds = GOAL_SECONDS, gain = null, dirs = DIRECTIONS, distance = 0 }) {
  // ── SCALED, OR ABSOLUTE, AND THE CHOICE HAS CONSEQUENCES ────────────────────
  //
  // Scaling to the creature is what makes a 0.008 cm/s animal rankable against a
  // 0.76 cm/s one, and it is the right default for comparing BODIES. But it also
  // normalises range out of the score entirely, and selection run on it produced
  // exactly what that implies: `oddfoot-glossy` aims beautifully and can travel
  // 2.3 cm in two minutes. Asked for a beacon 8 cm away — which is what the
  // player's tank asks — it cannot arrive however well it steers.
  //
  // `distance` overrides with an absolute figure, in cm, so an objective can be
  // written against the task the tank actually poses instead of against a
  // per-creature handicap.
  const dist = distance > 0
    ? distance
    : Math.max(GOAL_MIN_DIST, Math.min(8, 0.35 * speed * seconds));

  // BOTH CHANNELS. `bearingPair` returns the in-plane bearing and the elevation
  // out of that plane; channel A steers on the first, channel B on the second.
  // On a single-plane body B's actuator weights are all zero, so wiring it here
  // costs those creatures nothing and changes none of their numbers.
  //
  // The `gain` override drives channel A only, and deliberately: it exists to
  // separate "the bodies are weak" from "the shipped gains are small", and that
  // is a question about the channel the library actually has genes for.
  const sense = gain === null
    ? (sim, t) => {
        const { bearing, elevation } = bearingPair(sim, t, plane);
        return { a: sensorTurnBias(sim.genome, bearing, bearing),
                 b: sensorTurnBias2(sim.genome, elevation, elevation) };
      }
    : (sim, t) => {
        const b = bearingTo(sim, t, plane);
        return { a: Math.max(-1, Math.min(1, gain * b)), b: 0 };
      };

  // One blind traverse, scored against every target. See `traverse`.
  const blindRun = traverse(RAPIER, { plan, genome, world, plane, seconds, steer: null });
  if (blindRun.burst) return { valid: false, reason: 'burst', dist };
  const targets = dirs.map(([th, ph]) => targetAt(blindRun.origin, blindRun.frame, dist, th, ph));

  const cells = [];
  for (let i = 0; i < dirs.length; i++) {
    const [th, ph] = dirs[i];
    const liveRun = traverse(RAPIER, {
      plan, genome, world, plane, seconds,
      steer: (sim) => sense(sim, targets[i]),
    });
    if (liveRun.burst) return { valid: false, reason: 'burst', dist };
    // The live traverse rebuilds its own frame from its own settle, which is the
    // same deterministic settle, so its origin and frame match the blind run's.
    // Scored against the blind run's targets regardless, so the two arms are
    // answering one question and not two.
    const dLive = nearest(liveRun.path, targets[i]);
    const dBlind = nearest(blindRun.path, targets[i]);
    cells.push({
      theta: th, phi: ph, band: bandOf(ph),
      live: (dist - dLive) / dist,
      blind: (dist - dBlind) / dist,
      dLive, dBlind,
      arrived: dLive < GOAL_CAPTURE,
    });
  }

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const bands = {};
  for (const b of ['inPlane', 'mid', 'out']) {
    const cs = cells.filter((c) => c.band === b);
    bands[b] = { live: mean(cs.map((c) => c.live)), blind: mean(cs.map((c) => c.blind)) };
    bands[b].closure = bands[b].live - bands[b].blind;
  }
  const live = mean(cells.map((c) => c.live));
  const blind = mean(cells.map((c) => c.blind));
  return {
    valid: true, dist, cells, live, blind,
    closure: live - blind,
    arrived: cells.filter((c) => c.arrived).length / cells.length,
    bands,
  };
}

/**
 * Everything a creature needs before it can be scored: viability, cruise speed,
 * and its own steering plane. Separated out because selection wants to reuse it
 * and because a creature that fails any of the three is not a low score, it is
 * not a subject.
 */
export function prepare(RAPIER, genome, world, { sweep = false } = {}) {
  const v = assessViability(RAPIER, genome, world);
  if (!v.ok) return null;
  const ns = netSpeed(RAPIER, { plan: v.plan, genome, world });
  if (!ns.valid) return null;
  let s3;
  try {
    // ONE BIAS POINT, DELIBERATELY. All this needs from S3 is the steering
    // PLANE; the capability numbers it also returns are the ones `_zgoal` exists
    // to replace, and they are not read here. Sweeping would multiply an
    // already-hot path — `prepare` runs once per creature per generation inside
    // `_zgoalevo` — by five for a field nothing downstream uses.
    //
    // It also pins the plane to the operating point every earlier measurement in
    // this project used, so a baseline table and a selection run stay comparable
    // across the S3 repair rather than quietly measuring different frames.
    // `sweep: true` is the REPORTING path — a winner about to be proposed for
    // the library is worth the five points, and `bestBias` is worth seeing.
    s3 = sweep
      ? S3(RAPIER, { plan: v.plan, genome, world, cruiseSpeed: ns.score })
      : S3(RAPIER, { plan: v.plan, genome, world, cruiseSpeed: ns.score, biases: [S3_BIAS] });
  } catch { return null; }
  if (!s3.valid) return null;
  return {
    plan: v.plan,
    speed: ns.score,
    plane: [s3.turnPlaneX, s3.turnPlaneY, s3.turnPlaneZ],
    turnCapability: s3.turnRate3d * s3.steeringAuthority,
    turnRate3d: s3.turnRate3d,
    steeringAuthority: s3.steeringAuthority,
    turnRadius: s3.turnRadius,
    bestBias: s3.bestBias,
  };
}

if (!RUN_AS_TOOL) {
  // Imported for `goalScore` / `prepare`. Everything below is the tool.
} else {

const RAPIER = RAPIER_NS;
await RAPIER.init();

const N_RANDOM = Number(process.argv[2] ?? 0);
const SECONDS = Number(process.argv[3] ?? GOAL_SECONDS);
const GAIN_ARG = process.argv[4] ?? 'genome';
const GAIN = GAIN_ARG === 'genome' ? null : Number(GAIN_ARG);
const R2D = 180 / Math.PI;

const pop = [];
for (const s of [...SEEDS, ...CURATED]) pop.push({ label: s.id, genome: s.genome });
let n = 0;
for (let i = 0; n < N_RANDOM && i < N_RANDOM * 30; i++) {
  const g = createRandomGenome(rngFrom('morph', 'census', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (!v.ok || v.plan.jointCount < 3) continue;
  n++;
  pop.push({ label: `rand${n}`, genome: g });
}

console.log(`_zgoal — does it ARRIVE? ${DIRECTIONS.length} directions, ${SECONDS} s, bounded tank, own steering plane`);
console.log(`gain = ${GAIN === null ? "the genome's own" : GAIN}   capture = ${GOAL_CAPTURE} cm   n = ${pop.length}\n`);
console.log('name'.padEnd(16), 'v cm/s'.padStart(7), 'D cm'.padStart(6), 'turnCap'.padStart(8),
  '| live'.padStart(8), 'blind'.padStart(7), 'CLOSURE'.padStart(8), 'arrive'.padStart(7),
  '|  inPlane'.padStart(10), 'mid'.padStart(7), 'out'.padStart(7));

const rows = [];
for (const p of pop) {
  const prep = prepare(RAPIER, p.genome, W1_SLICE);
  if (!prep) { console.log(p.label.padEnd(16), '  — not a subject (inviable / no cruise / no plane)'); continue; }
  const r = goalScore(RAPIER, {
    plan: prep.plan, genome: p.genome, world: W1_SLICE,
    plane: prep.plane, speed: prep.speed, seconds: SECONDS, gain: GAIN,
  });
  if (!r.valid) { console.log(p.label.padEnd(16), `  — dropped (${r.reason})`); continue; }
  rows.push({ label: p.label, genome: p.genome, ...prep, ...r });
  console.log(
    p.label.padEnd(16), prep.speed.toFixed(3).padStart(7), r.dist.toFixed(2).padStart(6),
    (prep.turnCapability * R2D).toFixed(2).padStart(8),
    '|', r.live.toFixed(3).padStart(6), r.blind.toFixed(3).padStart(7),
    r.closure.toFixed(3).padStart(8), r.arrived.toFixed(2).padStart(7),
    '|', r.bands.inPlane.closure.toFixed(3).padStart(8),
    r.bands.mid.closure.toFixed(3).padStart(7), r.bands.out.closure.toFixed(3).padStart(7),
  );
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`\nn scored = ${rows.length}`);
console.log('  mean control-subtracted closure  ', mean(rows.map((r) => r.closure)).toFixed(3));
console.log('    in-plane / mid / out of plane  ',
  ['inPlane', 'mid', 'out'].map((b) => mean(rows.map((r) => r.bands[b].closure)).toFixed(3)).join('  /  '));
console.log('  creatures with closure > 0       ', `${rows.filter((r) => r.closure > 0).length}/${rows.length}`);
console.log(`  cells arriving within ${GOAL_CAPTURE} cm      `,
  `${rows.reduce((a, r) => a + r.cells.filter((c) => c.arrived).length, 0)}/${rows.length * DIRECTIONS.length}`);

// ── IS THE OLD RANKING A PROXY FOR THIS ONE? Pre-declared in the plan: below
// Spearman 0.3, turnCapability is retired as a selection proxy and this tool is
// the only scorer. Printed here rather than in a second tool so the correlation
// and the data it is computed from can never be quoted from different runs.
function spearman(a, b) {
  const rank = (xs) => {
    const idx = xs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const out = new Array(xs.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[idx[k][1]] = r;
      i = j + 1;
    }
    return out;
  };
  const ra = rank(a), rb = rank(b), ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}
if (rows.length >= 4) {
  const y = rows.map((r) => r.closure);
  console.log('\nSpearman against closure — is any cheap kinematic number a proxy?');
  for (const k of ['turnCapability', 'turnRate3d', 'steeringAuthority', 'turnRadius', 'speed']) {
    console.log(`  ${k.padEnd(18)} ${spearman(rows.map((r) => r[k]), y).toFixed(3).padStart(7)}`);
  }
  console.log(`  ${'|preyG+threatG|'.padEnd(18)} ${spearman(
    rows.map((r) => Math.abs((r.genome?.controller?.preyGain ?? 0) + (r.genome?.controller?.threatGain ?? 0))), y,
  ).toFixed(3).padStart(7)}   (flat across the authored library — see the header)`);
  console.log(`  n = ${rows.length}. Below n = 15 these are noise; HANDOVER-STEERING.md records a pair`);
  console.log('  swapping places between two runs at n = 8.');
}

}
