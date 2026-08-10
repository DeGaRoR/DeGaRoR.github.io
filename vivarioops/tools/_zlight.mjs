// tools/_zlight.mjs — CAN A CREATURE FOLLOW A LIGHT? (B2 §7.1, headless)
//
// ── ENDPOINTS AND n, DECLARED BEFORE THE FIRST RUN ───────────────────────────
//
// §7.1: "Session 10 lost a run to a target placed dead ahead by an off-by-one,
// and lost three claims to secondary readings promoted mid-series. State the
// endpoint and the n before the first run." So:
//
// EXPERIMENT 1 — CAPABILITY. Is the loop closed at all?
//   n            15 creatures (5 authored + 10 random) x 5 light placements
//                = 75 paired trials.
//   placements   bearings +-90, +-135 and 180 degrees off the initial heading,
//                IN THE CREATURE'S OWN STEERING PLANE. All are >= 90 degrees off,
//                as §7.1 requires, and they are SYMMETRIC IN PAIRS — which is the
//                real defence against session 10's dead-ahead failure. A creature
//                that simply swims forward closes on the +90 light exactly as
//                much as it opens on the -90 one, so its mean score is zero BY
//                CONSTRUCTION rather than by my hoping the placement was fair.
//   primary      mean over placements of (closest approach with gains ZEROED
//                minus closest approach with gains LIVE), divided by the start
//                distance. Positive means the sensor helped.
//   control      the same creature, same seed, same everything, preyGain and
//                threatGain set to zero. Control-subtracted, per §7.1.
//   test         sign test over the 15 per-creature means. Reported as k/15.
//   secondary    correlation of the score with turnRate3d and steeringAuthority.
//                DECLARED SECONDARY. It does not become the result if the
//                primary disappoints.
//
// EXPERIMENT 2 — EVOLVABILITY. Can selection improve it?
//   n            6 replicate bursts, 3 generations, population 24.
//   primary      best light-score in the population after the burst,
//                score-selected against RANDOM-selected on the identical seed.
//   test         how many of 6 replicates the score arm wins.
//
// Both experiments also run an arm with the 00 §9 torque bound lifted, because
// tools/_zturn.mjs measured that bound costing 45% of turn rate. That arm is
// NOT a proposal to ship unbounded — it measures the headroom a better-derived
// bound would return.
//
//   node tools/_zlight.mjs [nRandom] [replicates]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom, makeRng } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { sensorTurnBias } from '../engine/l1/controller.js';
import { bearingTo } from '../engine/l2/duel.js';
import { S2, S3, SOLO_GRAVITY, SOLO_BOUNDED } from '../engine/l2/probes.js';
import { autoBurst } from '../engine/l2/objective.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N_RANDOM = Number(process.argv[2] ?? 10);
const REPLICATES = Number(process.argv[3] ?? 6);
const ONLY = process.argv[4] ?? 'both';
await RAPIER.init();

const START_DIST = 3.0;      // metres — reachable at corpus cruise speeds
/**
 * The trial window, seconds. `node tools/_zlight.mjs [nRandom] [reps] [only] [window]`
 *
 * DEFAULT STAYS 40 so the pre-declared experiment above is still the experiment
 * that runs by default — a parameter that silently changed what "the _zlight
 * result" means would be worse than no parameter.
 *
 * BUT 40 IS ALMOST CERTAINLY WHY THIS TEST FAILS, and that is now measured rather
 * than suspected. `tools/_zreach.mjs` computes the shortest legal path to the
 * target for a swimmer of minimum turning radius `r = v/omega`, and at 40 s ONE
 * CREATURE IN TWENTY-ONE can physically arrive — the one being `eel-unison`,
 * which is exactly the one creature this script reports as helped. At 300 s it is
 * nine in twenty-one. The window, not the sensor, is the binding constraint.
 *
 * The original comment here read "135 deg at ~6 deg/s is 22 s, then swim". The
 * corpus does not turn at 6 deg/s; the median is 1.57, which is 63 degrees of
 * TOTAL turning in the whole 40 s window.
 */
const WINDOW = Number(process.argv[5] ?? 40.0);
const SETTLE = 2.0;
const BEARINGS = [90, -90, 135, -135, 180];

const qrot = (q, v) => {
  const [x, y, z, w] = q;
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  return [v[0] + w * t[0] + (y * t[2] - z * t[1]),
          v[1] + w * t[1] + (z * t[0] - x * t[2]),
          v[2] + w * t[2] + (x * t[1] - y * t[0])];
};

/** In-plane basis at the creature's current pose. */
function basis(sim, plane) {
  const q = sim.bodies[0].rotation();
  const qa = [q.x, q.y, q.z, q.w];
  const up = qrot(qa, plane);
  const fw = qrot(qa, [0, 0, 1]);
  const fd = fw[0] * up[0] + fw[1] * up[1] + fw[2] * up[2];
  const f = [fw[0] - fd * up[0], fw[1] - fd * up[1], fw[2] - fd * up[2]];
  const fn = Math.hypot(...f) || 1;
  const fu = f.map(v => v / fn);
  const r = [up[1] * fu[2] - up[2] * fu[1], up[2] * fu[0] - up[0] * fu[2], up[0] * fu[1] - up[1] * fu[0]];
  return { fu, r };
}

/**
 * One trial. Returns the closest approach to the light over the window.
 * `gains: 'zero'` is the control arm.
 */
function trial(plan, genome, plane, bearingDeg, gains, opts = {}) {
  const g = JSON.parse(JSON.stringify(genome));
  if (gains === 'zero') { g.controller.preyGain = 0; g.controller.threatGain = 0; }

  const sim = createSimulation(RAPIER, plan, g, { ...W1_SLICE, gravity: 0 },
    { bounded: false, wrap: true, effort: 1, turnBias: 0, ...opts });
  sim.genome = g;
  for (let k = 0; k < Math.round(SETTLE / FIXED_DT); k++) sim.step();

  const com = sim.centreOfMass();
  const { fu, r } = basis(sim, plane);
  const a = bearingDeg * Math.PI / 180;
  const light = [0, 1, 2].map(i =>
    com[i] + START_DIST * (Math.cos(a) * fu[i] + Math.sin(a) * r[i]));

  let closest = START_DIST;
  const steps = Math.round(WINDOW / FIXED_DT);
  for (let k = 0; k < steps; k++) {
    // THE WHOLE MECHANISM, and it is §7.1's point that there is nothing else in
    // it: a bearing goes in, an evolved gain scales it, turnBias comes out. Both
    // channels carry the same bearing, so the SIGN of the summed gain decides
    // whether the creature approaches or flees. Nothing assigns a role.
    const bearing = bearingTo(sim, light, plane);
    sim.control.turnBias = sensorTurnBias(g, bearing, bearing);
    sim.step();
    if (k % 6 === 0) {
      const c = sim.centreOfMass();
      const d = Math.hypot(c[0] - light[0], c[1] - light[1], c[2] - light[2]);
      if (Number.isFinite(d) && d < closest) closest = d;
    }
  }
  sim.free();
  return closest;
}

// ── corpus, with each creature's own steering plane ──────────────────────────
const subjects = [];
for (const sd of SEEDS) {
  if (sd.id === 'staircase') continue;
  const genome = sd.genome ?? sd;
  try { subjects.push({ id: sd.id, genome, plan: morphogenesis(genome) }); } catch { /* skip */ }
}
let added = 0;
for (let i = 0; added < N_RANDOM; i++) {
  const genome = createRandomGenome(rngFrom('turn', i));
  let plan; try { plan = morphogenesis(genome); } catch { continue; }
  if (plan.bodyCount < 3) continue;
  subjects.push({ id: `r${i}`, genome, plan }); added++;
}
for (const s of subjects) {
  const c = S2(RAPIER, { plan: s.plan, genome: s.genome, world: W1_SLICE, gravity: SOLO_GRAVITY, bounded: SOLO_BOUNDED });
  const t = S3(RAPIER, {
    plan: s.plan, genome: s.genome, world: W1_SLICE, gravity: SOLO_GRAVITY,
    bounded: SOLO_BOUNDED, cruiseSpeed: c.valid ? c.cruiseSpeed : 0.1,
  });
  s.plane = t.valid ? [t.turnPlaneX, t.turnPlaneY, t.turnPlaneZ] : [0, 1, 0];
  s.turnRate3d = t.valid ? t.turnRate3d : 0;
  s.authority = t.valid ? t.steeringAuthority : 0;
  s.gain = s.genome.controller.preyGain + s.genome.controller.threatGain;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
function pearson(a, b) {
  const n = a.length, ma = mean(a), mb = mean(b);
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const p = a[i] - ma, q = b[i] - mb; sab += p * q; sa += p * p; sb += q * q; }
  return sa > 0 && sb > 0 ? sab / Math.sqrt(sa * sb) : 0;
}

// ── EXPERIMENT 1 ─────────────────────────────────────────────────────────────
console.log(`\n  _zlight · EXPERIMENT 1 — CAPABILITY`);
console.log(`  ${subjects.length} creatures x ${BEARINGS.length} placements x 2 arms, `
  + `light at ${START_DIST} m, ${WINDOW} s window\n`);
console.log(`  ${'id'.padEnd(12)} ${'gain'.padStart(7)} ${'turn3d'.padStart(8)} ${'auth'.padStart(6)}`
  + ` ${'live'.padStart(7)} ${'zeroed'.padStart(7)} ${'score'.padStart(8)}`);

for (const arm of [
  { label: 'as shipped (bounded torque)', opts: {} },
  { label: 'torque bound lifted', opts: { boundTorque: false } },
]) {
  const scores = [];
  const rows = [];
  for (const s of subjects) {
    const live = [], ctrl = [];
    for (const b of BEARINGS) {
      live.push(trial(s.plan, s.genome, s.plane, b, 'own', arm.opts));
      ctrl.push(trial(s.plan, s.genome, s.plane, b, 'zero', arm.opts));
    }
    const score = (mean(ctrl) - mean(live)) / START_DIST;
    scores.push(score);
    rows.push({ s, live: mean(live), ctrl: mean(ctrl), score });
  }
  console.log(`\n  --- ${arm.label} ---`);
  for (const r of rows) {
    console.log(`  ${r.s.id.padEnd(12)} ${r.s.gain.toFixed(2).padStart(7)} ${r.s.turnRate3d.toFixed(3).padStart(8)}`
      + ` ${r.s.authority.toFixed(2).padStart(6)} ${r.live.toFixed(3).padStart(7)} ${r.ctrl.toFixed(3).padStart(7)}`
      + ` ${(r.score >= 0 ? '+' : '') + r.score.toFixed(3)}`);
  }
  const wins = scores.filter(x => x > 0.01).length;
  console.log(`\n  PRIMARY  mean control-subtracted closing ${(mean(scores) >= 0 ? '+' : '') + mean(scores).toFixed(4)}`
    + `   creatures helped by the sensor: ${wins}/${scores.length}`);
  console.log(`  SECONDARY (declared)  corr(score, turnRate3d) ${pearson(scores, subjects.map(s => s.turnRate3d)).toFixed(2)}`
    + `   corr(score, steeringAuthority) ${pearson(scores, subjects.map(s => s.authority)).toFixed(2)}`
    + `   corr(score, |gain|) ${pearson(scores, subjects.map(s => Math.abs(s.gain))).toFixed(2)}`);
}

if (ONLY === '1') process.exit(0);

// ── EXPERIMENT 2 ─────────────────────────────────────────────────────────────
console.log(`\n\n  _zlight · EXPERIMENT 2 — EVOLVABILITY`);
console.log(`  ${REPLICATES} bursts x 3 generations x population 24, score-selected vs random-selected\n`);

/** Light-seeking score for one genome, for use as a selection objective. */
function lightScore(RAPIER_, genome, world) {
  let plan; try { plan = morphogenesis(genome); } catch { return 0; }
  if (plan.bodyCount < 2) return 0;
  const c = S2(RAPIER_, { plan, genome, world, gravity: SOLO_GRAVITY, bounded: SOLO_BOUNDED });
  const t = S3(RAPIER_, {
    plan, genome, world, gravity: SOLO_GRAVITY, bounded: SOLO_BOUNDED,
    cruiseSpeed: c.valid ? c.cruiseSpeed : 0.1,
  });
  const plane = t.valid ? [t.turnPlaneX, t.turnPlaneY, t.turnPlaneZ] : [0, 1, 0];
  // Two symmetric placements only, for cost. Symmetry still makes "swim
  // straight" score zero in expectation, which is the property that matters.
  let acc = 0;
  for (const b of [135, -135]) {
    const live = trial(plan, genome, plane, b, 'own');
    acc += (START_DIST - live) / START_DIST;
  }
  return acc / 2;
}

console.log(`  ${'rep'.padStart(4)} ${'before'.padStart(9)} ${'score-sel'.padStart(10)} ${'random-sel'.padStart(11)}   verdict`);
let sw = 0;
for (let rep = 0; rep < REPLICATES; rep++) {
  const start = seedPopulation({ RAPIER, rng: makeRng(7000 + rep), world: W1_SLICE });
  const before = Math.max(...start.genomes.map(g => lightScore(RAPIER, g, W1_SLICE)));
  const out = {};
  for (const selection of ['score', 'random']) {
    const r = autoBurst({
      RAPIER, genomes: start.genomes, rng: makeRng(8000 + rep),
      world: W1_SLICE, selection, generations: 3, population: 24, keep: 6,
      objective: (RA, gs) => gs.map(g => lightScore(RA, g, W1_SLICE)),
    });
    out[selection] = Math.max(...r.genomes.map(g => lightScore(RAPIER, g, W1_SLICE)));
  }
  if (out.score > out.random) sw++;
  console.log(`  ${String(rep).padStart(4)} ${before.toFixed(4).padStart(9)} ${out.score.toFixed(4).padStart(10)}`
    + ` ${out.random.toFixed(4).padStart(11)}   ${out.score > out.random ? 'score wins' : 'null wins'}`);
}
console.log(`\n  PRIMARY  score-selection beats the null arm in ${sw}/${REPLICATES} replicates\n`);
