// tools/_zproprio.mjs — THE A5 GATES.
//
// A5 gives each joint's oscillator a term that pulls it toward the phase the
// joint is ACTUALLY at (controller.js advancePhases). Four things to establish,
// and the third is the one the chantier exists for.
//
// 1. NEUTRAL AT INSERTION. K = 0 must reproduce A3/A4 behaviour to the bit. It
//    does so BY CODE PATH, not by arithmetic coincidence: physics.js does not run
//    the integrator at all when K = 0 and `targetAngles` keeps its closed-form
//    argument. This measures WHY that matters — running the integrator at K = 0
//    accumulates `omega*dt` N times instead of computing `omega*(N*dt)`, and the
//    two differ in the last bits of a double.
//
// 2. THE GENE IS LIVE. A non-zero K must actually move the trajectory, or the
//    neutrality above would be satisfied by an organ that does nothing.
//
// 3. ENTRAINMENT UNDER LOAD. The point of the whole thing. A creature is given a
//    body it was not tuned for — every limb dimension scaled so the animal
//    carries about 30% more mass — and the question is whether the COMMAND and
//    the BODY stay in a fixed phase relation. Open loop they need not: the
//    oscillator marches on at its genetic omega while a joint too loaded to keep
//    up falls further and further behind, and the phase relation drifts freely.
//    Entrained, the oscillator is pulled toward what the joint is doing and the
//    relation locks.
//
//    Measured as achieved-vs-commanded coherence over pairs of joints that are
//    ACTUALLY COMMANDED TO SWING — the A4 lesson, since Pearson is scale-
//    invariant and a joint asked to move 0.001 rad correlates perfectly in
//    command and not at all in achievement.
//
// 4. IT COSTS SOMETHING. Entrainment is metered like every other organ: the
//    energy bill is reported so a lineage cannot buy coordination for free.
//
// Run: node tools/_zproprio.mjs [SECONDS=60] [N=16]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { cloneGenome } from '../engine/l1/mutate.js';
import { qClamp, RANGE } from '../engine/l1/genome.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 60);
const N = Number(process.argv[3] ?? 16);
const KS = (process.argv[4] ? process.argv[4].split(',').map(Number) : [0, 0.25, 0.5, 1, 2]);
const COUPLE = process.argv[5] ? Number(process.argv[5]) : undefined;
const LOAD = Math.cbrt(1.3);      // limb dims scaled so volume, hence mass, is +30%

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}

function withK(genome, K) { const g = cloneGenome(genome); g.controller.proprioGain = K; return g; }
/** The same animal carrying more of itself: every limb dimension scaled. */
function loaded(genome) {
  const g = cloneGenome(genome);
  for (const n of g.nodes) n.dims = n.dims.map((d) => qClamp(d * LOAD, RANGE.dim));
  return g;
}

function corr(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sa += x * x; sb += y * y; sab += x * y; }
  return sa > 1e-12 && sb > 1e-12 ? sab / Math.sqrt(sa * sb) : NaN;
}
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const HZ = 10, every = Math.round(1 / (HZ * FIXED_DT));

function trial(genome) {
  let plan;
  try { plan = morphogenesis(genome); } catch { return null; }
  if (plan.jointCount < 3) return null;
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: false, wrap: true, effort: 0, turnBias: 0, ...(COUPLE !== undefined ? { phaseCouple: COUPLE } : {}) });
  } catch { return null; }
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;

  const J = plan.jointCount, NS = Math.floor(SECONDS * HZ);
  const th = Array.from({ length: J }, () => new Float64Array(NS));
  const wa = Array.from({ length: J }, () => new Float64Array(NS));
  let k = 0;
  const p0 = sim.bodies[0].translation();
  const start = { x: p0.x, y: p0.y, z: p0.z };
  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    try { sim.step(); } catch { break; }
    if (s % every !== 0 || k >= NS) continue;
    const d = sim.motorDiag;
    for (let j = 0; j < J; j++) { th[j][k] = d.theta[j]; wa[j][k] = d.want[j]; }
    k++;
  }
  const end = sim.bodies[0].translation();
  const net = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) / SECONDS;

  const swing = new Float64Array(J);
  for (let j = 0; j < J; j++) {
    let wx = -1e9, wn = 1e9;
    for (let i = 0; i < k; i++) { if (wa[j][i] > wx) wx = wa[j][i]; if (wa[j][i] < wn) wn = wa[j][i]; }
    swing[j] = wx - wn;
  }
  const maxSwing = Math.max(...swing, 1e-12);
  let caL = 0, cwL = 0, nL = 0;
  for (let j = 0; j + 1 < J; j++) {
    if (swing[j] < 0.1 * maxSwing || swing[j + 1] < 0.1 * maxSwing) continue;
    const a = corr(th[j].subarray(0, k), th[j + 1].subarray(0, k));
    const w = corr(wa[j].subarray(0, k), wa[j + 1].subarray(0, k));
    if (Number.isFinite(a) && Number.isFinite(w)) { caL += Math.abs(a); cwL += Math.abs(w); nL++; }
  }
  // COMMAND-TO-BODY LOCK, per joint: does what the joint DID track what it was
  // ASKED for? This is the quantity entrainment is supposed to hold under load.
  let lock = 0, nLock = 0;
  for (let j = 0; j < J; j++) {
    if (swing[j] < 0.1 * maxSwing) continue;
    const r = corr(th[j].subarray(0, k), wa[j].subarray(0, k));
    if (Number.isFinite(r)) { lock += Math.abs(r); nLock++; }
  }
  const out = {
    cohA: nL ? caL / nL : NaN, cohW: nL ? cwL / nL : NaN,
    lock: nLock ? lock / nLock : NaN,
    net, workOut: sim.workOut, com: [end.x, end.y, end.z],
  };
  sim.free();
  return out;
}

// ── 1 & 2 — neutrality, and the gene is live ────────────────────────────────
console.log('\n  1. NEUTRAL AT INSERTION, AND NOT INERT\n');
{
  const { genome } = corpus[0];
  const a = trial(withK(genome, 0));
  const b = trial(withK(genome, 0));
  const same = a && b && a.com.every((v, i) => v === b.com[i]);
  console.log(`    K=0 twice, identical final CoM:      ${same ? 'yes   PASS' : 'NO    FAIL'}`);
  const c = trial(withK(genome, 1));
  const moved = a && c && !a.com.every((v, i) => v === c.com[i]);
  console.log(`    K=1 moves the trajectory:            ${moved ? 'yes   PASS' : 'NO — the gene is inert   FAIL'}`);
}

// ── 3 & 4 — entrainment under load ──────────────────────────────────────────
console.log(`\n  3. ENTRAINMENT — nominal body vs the same animal carrying +30% mass\n`);
console.log('      K     body      coh(ach)  coh(cmd)   ratio    lock    netSpd    workOut');
console.log('  ' + '-'.repeat(82));

const summary = [];
for (const K of KS) {
  const row = { K };
  for (const [label, make] of [['nominal', (g) => g], ['loaded', loaded]]) {
    const rows = [];
    for (const { genome } of corpus) {
      const r = trial(withK(make(genome), K));
      if (r) rows.push(r);
    }
    const cohA = med(rows.map((r) => r.cohA)), cohW = med(rows.map((r) => r.cohW));
    row[label] = { cohA, cohW, ratio: cohA / cohW, lock: med(rows.map((r) => r.lock)),
      net: med(rows.map((r) => r.net)), work: med(rows.map((r) => r.workOut)) };
    console.log('  ' + String(K).padStart(5) + '  ' + label.padEnd(9)
      + cohA.toFixed(3).padStart(9) + cohW.toFixed(3).padStart(10)
      + row[label].ratio.toFixed(3).padStart(8)
      + row[label].lock.toFixed(3).padStart(8)
      + row[label].net.toExponential(1).padStart(10)
      + row[label].work.toExponential(1).padStart(11));
  }
  summary.push(row);
  console.log('');
}

const base = summary.find((r) => r.K === 0);
const best = summary.filter((r) => r.K > 0).sort((a, b) => b.loaded.ratio - a.loaded.ratio)[0];
console.log('  ' + '='.repeat(82));
console.log(`  GATE: achieved/commanded >= 0.90 under load.`);
console.log(`    K=0            loaded ratio ${base.loaded.ratio.toFixed(3)}   lock ${base.loaded.lock.toFixed(3)}`);
console.log(`    best K=${String(best.K).padEnd(5)}  loaded ratio ${best.loaded.ratio.toFixed(3)}   lock ${best.loaded.lock.toFixed(3)}`);
console.log(`    ${best.loaded.ratio >= 0.90 ? 'PASS' : 'BELOW TARGET'}`);
console.log(`  ENERGY: K=0 ${base.loaded.work.toExponential(1)} -> K=${best.K} ${best.loaded.work.toExponential(1)} erg`);
console.log('  ' + '='.repeat(82) + '\n');
