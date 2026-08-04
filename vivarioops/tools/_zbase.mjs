// tools/_zbase.mjs — THE POST-A1 RE-BASELINE.
//
// A1 fixed an accumulating force (engine/l1/physics.js applyEnvironment, and see
// tools/_zaccum.mjs for the measurement). Every trajectory-derived number in this
// repo was measured against the broken integrator and is now wrong. This runs the
// corpus once and prints the numbers everything else is re-anchored on.
//
// It also discharges the two A0 gates:
//   1. workOut + workAbsorbed == the old unsigned `work`, to 1e-9.
//   2. workOut ~ 0 on a passive drifter (effort 0), because an actuator that is
//      not driving injects nothing.
// and reports `spinSaturation`, the angular clamp fraction that until A0 was
// applied every step and counted nowhere.
//
// KE RUNAWAY is measured window-to-window (150-300 s vs 60-150 s), NOT as a
// corpus-median level: a creature accelerating from rest to cruise looks
// identical to a runaway over a single window, which is the confound
// planLocomotion/HANDOFF-A1.md flags in its own caveats.
//
// Run: node tools/_zbase.mjs [SECONDS=300] [N=16]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { totalMass } from '../engine/l1/morphogen.js';
import { makeFood, mouthsOf, forageStep, ledger, INGEST_RATE } from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 300);
const N = Number(process.argv[3] ?? 16);

// The same corpus every A1 tool uses, so the numbers are comparable across them.
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan, idx: i });
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, f) => (100 * a.filter(f).length) / Math.max(1, a.length);

function trial(plan, genome, { effort, motorScale = 1 }) {
  const food = makeFood(W1_SLICE, { seed: 31337 });
  const mouths = mouthsOf(plan);
  const buf = mouths.map(() => [0, 0, 0]);
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: false, wrap: true, effort: 0, turnBias: 0, motorScale });
  } catch { return null; }
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();   // settle
  sim.resetClock(); sim.resetIntegrity(); sim.control.effort = effort;

  const steps = Math.round(SECONDS / FIXED_DT);
  const smp = Math.max(1, Math.round(0.25 / FIXED_DT));
  let path = 0, prev = null, eaten = 0;
  let keA = 0, nA = 0, keB = 0, nB = 0;                            // 60-150 s, 150-300 s
  const p0 = sim.bodies[0].translation();
  const start = { x: p0.x, y: p0.y, z: p0.z };
  for (let s = 0; s < steps; s++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, INGEST_RATE, buf);
    if (s % smp !== 0) continue;
    const c = sim.bodies[0].translation();
    if (prev) path += Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z);
    prev = { x: c.x, y: c.y, z: c.z };
    const sec = s * FIXED_DT;
    if (sec > 60 && sec <= 150) { let e = 0; for (const rb of sim.bodies) { const v = rb.linvel(); e += 0.5 * rb.mass() * (v.x * v.x + v.y * v.y + v.z * v.z); } keA += e; nA++; }
    else if (sec > 150) { let e = 0; for (const rb of sim.bodies) { const v = rb.linvel(); e += 0.5 * rb.mass() * (v.x * v.x + v.y * v.y + v.z * v.z); } keB += e; nB++; }
  }
  const end = sim.bodies[0].translation();
  const net = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  const integ = sim.integrity();
  const out = {
    path: path / SECONDS, net: net / SECONDS, eaten,
    workOut: sim.workOut, workAbsorbed: sim.workAbsorbed, work: sim.work,
    saturation: integ.saturation, spinSaturation: integ.spinSaturation,
    spread: integ.spread,
    keRatio: nA > 0 && nB > 0 && keA > 0 ? (keB / nB) / (keA / nA) : NaN,
  };
  sim.free();
  return out;
}

console.log(`\n  POST-A1 RE-BASELINE — ${corpus.length} creatures, ${SECONDS} s each\n`);
console.log('   #   J    path      net    workOut  workAbs   spread   sat   spinSat  KEratio');
console.log('  ' + '-'.repeat(84));

const rows = [];
for (const { genome, plan, idx } of corpus) {
  const r = trial(plan, genome, { effort: 1 });
  if (!r) { console.log(`  ${String(idx).padStart(2)}  —  failed to build`); continue; }
  r.idx = idx; r.J = plan.jointCount; r.mass = totalMass(plan);
  r.ledger = ledger(W1_SLICE, r.mass, r.eaten, r.workOut, SECONDS);
  rows.push(r);
  console.log('  ' + String(idx).padStart(2) + String(r.J).padStart(4)
    + r.path.toExponential(2).padStart(10) + r.net.toExponential(2).padStart(9)
    + r.workOut.toExponential(2).padStart(11) + r.workAbsorbed.toExponential(2).padStart(9)
    + r.spread.toFixed(2).padStart(9) + r.saturation.toFixed(3).padStart(7)
    + r.spinSaturation.toFixed(3).padStart(9)
    + (Number.isFinite(r.keRatio) ? r.keRatio.toFixed(2) : ' n/a').padStart(9));
}

// ── A0 gate 1: the split is exact ───────────────────────────────────────────
const worstSplit = Math.max(...rows.map((r) =>
  Math.abs((r.workOut + r.workAbsorbed) - r.work) / Math.max(1e-30, Math.abs(r.work))));

// ── A0 gate 2: a passive drifter injects nothing ────────────────────────────
//
// motorScale 0, NOT effort 0. At effort 0 the oscillator stops but the motors
// still hold each joint at its `bias`, so the actuator actively resists every
// fluid disturbance and legitimately injects energy — the first cut of this
// measured workOut/work = 0.51 and that was the test being wrong, not the code.
// motorScale 0 is the actuator switched off, which is what the gate means.
const passive = [];
for (const { genome, plan } of corpus.slice(0, 6)) {
  const r = trial(plan, genome, { effort: 1, motorScale: 0 });
  if (r) passive.push(r);
}

console.log('\n  ' + '='.repeat(84));
console.log('  A0 gate 1 — (workOut + workAbsorbed) vs work, worst relative error: '
  + worstSplit.toExponential(2) + (worstSplit < 1e-9 ? '   PASS' : '   FAIL'));
const passRatio = med(passive.map((r) => r.workOut / Math.max(1e-30, r.work)));
console.log('  A0 gate 2 — passive drifter (motorScale 0), median workOut/work: '
  + passRatio.toFixed(4) + (passRatio < 0.05 ? '   PASS' : '   see note'));

console.log('\n  CORPUS MEDIANS');
console.log('    path speed        ' + med(rows.map((r) => r.path)).toExponential(3) + ' cm/s');
console.log('    net speed         ' + med(rows.map((r) => r.net)).toExponential(3) + ' cm/s');
console.log('    workOut           ' + med(rows.map((r) => r.workOut)).toExponential(3) + ' erg');
console.log('    workOut / work    ' + med(rows.map((r) => r.workOut / Math.max(1e-30, r.work))).toFixed(3));
console.log('    cost of transport ' + med(rows.map((r) => r.workOut / Math.max(1e-9, r.mass * r.net * SECONDS))).toExponential(3));
console.log('    clamp saturation  ' + med(rows.map((r) => r.saturation)).toFixed(4));
console.log('    SPIN saturation   ' + med(rows.map((r) => r.spinSaturation)).toFixed(4) + '   <- was never measured before A0');
console.log('    ledger in/out     ' + med(rows.map((r) => r.ledger.ratio)).toFixed(3));

console.log('\n  STABILITY');
console.log('    KE window ratio in [0.8, 1.25]  ' + pct(rows, (r) => r.keRatio >= 0.8 && r.keRatio <= 1.25).toFixed(0)
  + '%   (A-exit target >= 90%, was ~69%)');
console.log('    KE runaway (ratio > 1.25)       ' + pct(rows, (r) => r.keRatio > 1.25).toFixed(0)
  + '%   (was 5 of 16 = 31%)');
console.log('    spread > 3 (came apart)         ' + pct(rows, (r) => r.spread > 3).toFixed(0) + '%');
console.log('    creatures reaching in/out > 1   ' + pct(rows, (r) => r.ledger.ratio > 1).toFixed(0) + '%');
console.log('  ' + '='.repeat(84) + '\n');
