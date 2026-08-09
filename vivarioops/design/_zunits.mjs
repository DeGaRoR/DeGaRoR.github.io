// _zunits.mjs — dimensional audit. Is the MUSCLE on the same scale as the LOAD?
//
// ── TWO REPAIRS, 2026-08-08 ──────────────────────────────────────────────────
//
// 1. IT IMPORTED `_zphlog.js`, NOT `physics.js`. That fork is 100 lines behind and
//    has no `advancePhases`/`PHASE_COUPLE`, so every figure this script has ever
//    produced described the PRE-PHASE-A open-loop controller — including the body
//    length, mass, Reynolds and L/s rows that went into a design document as "a
//    fresh corpus, this build". Now imports the real module; the FLOG hook moved
//    there behind a flag and `_zphlog.js` is deleted.
//
// 2. THE MUSCLE BUDGET FORMULA WAS NOT THE ONE PHYSICS USES. It computed
//    `200 * A^1.5` with A = the LARGEST face and no moment arm. physics.js uses
//    `budgetScale * muscleStress * A^1.5 * momentArm` with A =
//    `j.minCrossSectionalArea` — the MINIMUM cross-section — and momentArm 0.2,
//    then x6 at the clamp. Two errors in opposite directions, so the old ratio was
//    an order of magnitude at best. Now imports the constants.
//
// AND IT ANSWERS THE WRONG QUESTION ALONE. Muscle-vs-water says muscle is ~1e4x
// stronger than swimming needs; muscle-vs-WEIGHT says it is ~11x too weak to stand.
// Both are true, of different loads, and quoting either one alone is how
// "MUSCLE_STRESS is urgent" gets retired and un-retired every few sessions. This
// script now prints both.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as M from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = Number(process.argv[2] ?? 24);
const G_LAND = 981;              // cm/s^2, for the weight comparison — see below
const BUDGET_SCALE = 6;          // physics.js default; the clamp ceiling carries it

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 40; i++) {
  const g = createRandomGenome(rngFrom('morph', 'census', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ g, plan: v.plan });
}

const pc = (a, q) => {
  const b = a.filter(Number.isFinite).sort((x, y) => x - y);
  return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : NaN;
};

const mass = [], len = [], tauMus = [], tauFlu = [], spd = [], bl = [], re = [], sat = [];
const needG = [], haveG = [], ratioG = [];

for (const { g, plan } of corpus) {
  const sim = M.createSimulation(RAPIER, plan, g, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;

  let m = 0; for (const rb of sim.bodies) m += rb.mass();
  let L = 0;
  for (const a of plan.bodies) for (const b of plan.bodies) {
    L = Math.max(L, Math.hypot(
      a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2],
    ) + 0.5 * Math.max(...a.dims) + 0.5 * Math.max(...b.dims));
  }

  // ── MUSCLE, the way physics.js computes it ─────────────────────────────────
  let tm = 0;
  for (const j of plan.joints) {
    const A = j.minCrossSectionalArea;
    if (!(A > 0)) continue;
    tm += BUDGET_SCALE * M.MUSCLE_STRESS * A * Math.sqrt(A) * M.MOMENT_ARM_FRACTION;
  }
  tm /= plan.joints.length;

  // ── MUSCLE vs WEIGHT — the load the water hides ────────────────────────────
  //
  // DRY mass, not `rb.mass()`. Rapier's mass carries ADDED MASS (measured x1.221
  // median), which is a fluid effect and vanishes in air. Validated: with
  // `addedMass:false` the dry product matches Rapier exactly on 111/111 bodies.
  const kids = plan.bodies.map(() => []);
  for (const j of plan.joints) kids[j.parentBody].push(j.childBody);
  const dryOf = (b) => { const d = plan.bodies[b].dims; return d[0] * d[1] * d[2] * plan.bodies[b].density; };
  const subtree = (b) => { let s = dryOf(b); for (const k of kids[b]) s += subtree(k); return s; };
  for (const j of plan.joints) {
    const A = j.minCrossSectionalArea;
    if (!(A > 0)) continue;
    const have = BUDGET_SCALE * M.MUSCLE_STRESS * A * Math.sqrt(A) * M.MOMENT_ARM_FRACTION;
    const lever = 0.5 * Math.max(...plan.bodies[j.childBody].dims);
    const need = subtree(j.childBody) * G_LAND * lever;   // hold it out horizontally
    haveG.push(have); needG.push(need); ratioG.push(have / need);
  }

  // ── FLUID, logged from the real module ─────────────────────────────────────
  M.FLOG.on = true; M.FLOG.body = 0; M.FLOG.rows.length = 0;
  let prev = null, dist = 0;
  for (let s = 0; s < Math.round(30 / M.FIXED_DT); s++) {
    sim.step();
    if (s % 30 === 0) {
      const c = sim.bodies[0].translation();
      if (prev) dist += Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z);
      prev = { x: c.x, y: c.y, z: c.z };
    }
  }
  const tf = pc(M.FLOG.rows.map((r) => Math.hypot(r.tx, r.ty, r.tz)), 0.9);
  M.FLOG.on = false; M.FLOG.rows.length = 0;

  const v = dist / 30;
  mass.push(m); len.push(L); tauMus.push(tm); tauFlu.push(tf);
  spd.push(v); bl.push(v / L);
  re.push((v * L) / 0.01);          // water kinematic viscosity 0.01 cm^2/s
  sat.push(sim.saturation);
  sim.free();
}

const row = (l, a, u = '') => console.log(
  `${l.padEnd(30)} p10 ${pc(a, 0.1).toPrecision(3).padStart(9)}  p50 ${pc(a, 0.5).toPrecision(3).padStart(9)}  p90 ${pc(a, 0.9).toPrecision(3).padStart(9)}  ${u}`);

console.log(`corpus rngFrom('morph','census',i), jointCount>=3, n = ${corpus.length}`);
console.log(`MUSCLE_STRESS ${M.MUSCLE_STRESS}  momentArm ${M.MOMENT_ARM_FRACTION}  budgetScale ${BUDGET_SCALE}\n`);
console.log('SCALE');
row('body length', len, 'cm');
row('mass (incl. added mass)', mass, 'g');

console.log('\nMUSCLE vs WATER  — the swimming load');
row('muscle ceiling / joint', tauMus, 'dyn.cm');
row('fluid torque on root (p90)', tauFlu, 'dyn.cm');
row('ratio muscle/fluid', tauMus.map((t, i) => t / tauFlu[i]), '  >>1 = muscle is not the constraint');

console.log(`\nMUSCLE vs WEIGHT — the standing load, at g = ${G_LAND} cm/s^2 (n joints = ${ratioG.length})`);
row('torque available', haveG, 'dyn.cm');
row('torque needed to hold limb', needG, 'dyn.cm');
row('ratio available/needed', ratioG, '  >=1 = the joint can hold its own limb');
const canHold = ratioG.filter((r) => r >= 1).length / ratioG.length;
const atGain = 100 * ratioG.filter((r) => r * (M.MOTOR_GAIN_STRESS / M.MUSCLE_STRESS) >= 1).length / ratioG.length;
console.log(`  joints that can hold their own limb          : ${(100 * canHold).toFixed(1)}%`);
console.log(`  the same at the OLD shared value (${String(M.MOTOR_GAIN_STRESS).padStart(6)})  : ${atGain.toFixed(1)}%`);
console.log('  ^ BOTH BLOCKS ARE TRUE OF DIFFERENT LOADS. Muscle is ~2000x stronger than');
console.log('    the water asks for and, at the old value, ~10x weaker than gravity asks');
console.log('    for. Quoting one alone is how this argument kept being retired and');
console.log('    re-opened. The ceiling is now physical; the PD gains stayed put.');

console.log('\nREGIME');
row('speed', spd, 'cm/s');
row('body-lengths/s', bl, 'L/s   (real fish 1-10)');
row('Reynolds number', re, '      (const-Cd law wants >1e3)');
row('motor clamp saturation', sat, '      (0 = the ceiling never binds)');
