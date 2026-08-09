// _zst.mjs — Strouhal number. St = f*A/U, where f is tailbeat frequency, A the
// peak-to-peak tail excursion, U the forward speed. Efficient swimmers from fish
// to cetaceans cluster at St = 0.2-0.4. It is THE test of whether a gait is
// converting oscillation into travel or just stirring water.
//
// ── WHY THIS SCRIPT WAS REWRITTEN, 2026-08-08 ────────────────────────────────
//
// The first version reported St p50 0.752, then 0.460 on re-run, and neither was
// a gait number. It measured the tail's lateral offset as `t.z - r.z` — a
// WORLD-FRAME difference, while its own comment claimed the root frame and no
// rotation was ever applied. With heading persistence at -0.22 (physics.js), the
// root->tail vector sweeps the world as the creature reorients, and that sweep
// swamps the beat.
//
// It was caught by a check the script itself computed and threw away: line 44 read
// `g.controller.omega` and never used it. Comparing the recovered frequency against
// each creature's OWN commanded tail frequency (omega * freqMult / 2pi) gave
//
//     ratio f_measured / f_commanded:  p10 0.034   p50 0.263   p90 0.877
//
// i.e. 26% of the commanded beat recovered at the median, 3.4% at p10, and only 2
// of 12 creatures tracked at all.
//
// FOUR REPAIRS, and the last one is the point:
//   1. the tail vector is rotated into the ROOT FRAME (conjugate of the root's
//      orientation), so body reorientation cannot appear as tail motion;
//   2. the beat axis is found by PCA rather than assumed to be z — a creature's
//      bend plane is its own, and B2 §5 already had to learn this for `bearingTo`;
//   3. amplitude is peak-to-peak PER BEAT, not max-min over the whole window, so
//      slow drift cannot inflate it;
//   4. THE CROSS-CHECK IS PRINTED. A frequency estimator that is not compared
//      against the commanded frequency is not an estimator, it is a number.
//
// Also prints `slip` (U / f*A), which the old version computed at line 45 and
// never printed, and which is the quantity ROADMAP.md §3 actually tracks.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as M from '../engine/l1/physics.js';
import { qrot } from '../engine/l1/vecmath.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

// ONE CORPUS, ONE SEED FAMILY, ONE n, ACROSS ALL FOUR _z SCRIPTS. The previous set
// mixed rngFrom('decay','corpus',i) at n=10-12 with rngFrom('morph','census',i) at
// n=120 and printed both into one table as "a fresh corpus". p10/p90 on n=10 is
// min/max wearing a percentile's clothes.
const N = Number(process.argv[2] ?? 24);
const SETTLE = 3;      // s at effort 0, to let the spawn transient die
const WARMUP = 5;      // s at effort 1, DISCARDED — acceleration from rest is not cruise
const WINDOW = 40;     // s of measurement

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
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];

/** Dominant variance direction of a set of mean-centred 3-vectors, by power iteration. */
function principalAxis(rows) {
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const r of rows) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) c[a][b] += r[a] * r[b];
  let v = [1, 1, 1];
  for (let it = 0; it < 64; it++) {
    const w = [
      c[0][0] * v[0] + c[0][1] * v[1] + c[0][2] * v[2],
      c[1][0] * v[0] + c[1][1] * v[1] + c[1][2] * v[2],
      c[2][0] * v[0] + c[2][1] * v[1] + c[2][2] * v[2],
    ];
    const n = Math.hypot(...w);
    if (!(n > 1e-18)) return [0, 0, 1];
    v = [w[0] / n, w[1] / n, w[2] / n];
  }
  return v;
}

const st = [], amps = [], freqs = [], slips = [], fRatio = [], fCmd = [];

for (const { g, plan } of corpus) {
  const sim = M.createSimulation(RAPIER, plan, g, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(SETTLE / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  for (let s = 0; s < Math.round(WARMUP / M.FIXED_DT); s++) sim.step();

  // tail = deepest body, by TREE depth recomputed from the joint list. NOT
  // plan.bodies[].depth, which is per-node-type and resets on a node change
  // (morphogen.js:105) — a different quantity that happens to share a name.
  const parent = new Array(plan.bodies.length).fill(-1);
  for (const j of plan.joints) parent[j.childBody] = j.parentBody;
  const dep = plan.bodies.map((_, i) => { let d = 0, k = i; while (parent[k] >= 0) { k = parent[k]; d++; } return d; });
  const tail = dep.indexOf(Math.max(...dep));

  // THE COMMANDED TAIL FREQUENCY, from the genome, for the cross-check below.
  const tj = plan.joints.find((j) => j.childBody === tail);
  const fMult = g.controller.jointGenes[tj.nodeId]?.freqMult ?? 1;
  const commanded = (g.controller.omega * fMult) / (2 * Math.PI);

  const steps = Math.round(WINDOW / M.FIXED_DT);
  const rel = [];                       // tail - root, IN THE ROOT FRAME
  let prev = null, path = 0;
  const first = sim.bodies[0].translation();
  for (let s = 0; s < steps; s++) {
    sim.step();
    const r = sim.bodies[0].translation(), t = sim.bodies[tail].translation();
    const q = sim.bodies[0].rotation();
    rel.push(qrot(qconj([q.x, q.y, q.z, q.w]), [t.x - r.x, t.y - r.y, t.z - r.z]));
    if (s % 30 === 0) {
      if (prev) path += Math.hypot(r.x - prev.x, r.y - prev.y, r.z - prev.z);
      prev = { x: r.x, y: r.y, z: r.z };
    }
  }
  const last = sim.bodies[0].translation();

  // Mean-centre, find the beat axis, project. The DC offset is a property of the
  // body plan (an off-centre tail never crosses zero), not of the gait.
  const mu = [0, 1, 2].map((k) => rel.reduce((a, v) => a + v[k], 0) / rel.length);
  const centred = rel.map((v) => [v[0] - mu[0], v[1] - mu[1], v[2] - mu[2]]);
  const axis = principalAxis(centred);
  const sig = centred.map((v) => v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2]);

  // Zero crossings, and the extremum reached within each half-cycle. Amplitude is
  // then PER BEAT — the median of adjacent half-swings — so a slow drift adds a
  // half-cycle rather than inflating one enormous max-min.
  let crossings = 0, lastSign = 0, ext = 0;
  const halves = [];
  for (const d of sig) {
    const sg = Math.sign(d);
    if (sg !== 0 && lastSign !== 0 && sg !== lastSign) { crossings++; halves.push(Math.abs(ext)); ext = 0; }
    if (sg !== 0) lastSign = sg;
    if (Math.abs(d) > Math.abs(ext)) ext = d;
  }
  const A = 2 * (pc(halves, 0.5) || 0);
  const f = crossings / (2 * WINDOW);
  const Upath = path / WINDOW;
  const Unet = Math.hypot(last.x - first.x, last.y - first.y, last.z - first.z) / WINDOW;

  st.push((f * A) / Upath);
  amps.push(A); freqs.push(f); fCmd.push(commanded);
  fRatio.push(f / commanded);
  slips.push(Upath / (f * A || 1e-9));
  sim.free();
}

const row = (l, a, u = '') => console.log(
  `${l.padEnd(28)} p10 ${pc(a, 0.1).toPrecision(3).padStart(9)}  p50 ${pc(a, 0.5).toPrecision(3).padStart(9)}  p90 ${pc(a, 0.9).toPrecision(3).padStart(9)}  ${u}`);

console.log(`corpus rngFrom('morph','census',i), jointCount>=3, n = ${corpus.length}`);
console.log(`settle ${SETTLE}s @ effort 0, warmup ${WARMUP}s discarded, window ${WINDOW}s\n`);
console.log('GAIT');
row('commanded f (omega*fm/2pi)', fCmd, 'Hz');
row('measured tailbeat f', freqs, 'Hz');
row('>> RATIO measured/commanded', fRatio, '  <-- 1.0 = the estimator works. BELIEVE NOTHING BELOW UNTIL THIS IS ~1');
console.log('\nSTROUHAL');
row('tail excursion A (per beat)', amps, 'cm');
row('slip U/(f*A)', slips, '  ROADMAP §3 wants 0.5-0.8');
row('STROUHAL f*A/U', st, '  <-- efficient swimmers 0.2-0.4');
// SLIP AND STROUHAL ARE EXACT RECIPROCALS, per creature: slip = U/(f*A) and
// St = f*A/U. Both are printed because they are compared against two different
// literatures, NOT because they are two pieces of evidence. If the percentiles
// above do not look like reciprocals it is the percentile index on even n, not
// physics: pc() takes b[floor(q*n)], and the q-th smallest of X maps to the
// (1-q)-th smallest of 1/X, which is one slot away when n is even.
console.log(`\n  n = ${corpus.length}. St and slip are exact reciprocals; 1/median(slip) = ${(1 / pc(slips, 0.5)).toPrecision(3)}`);
