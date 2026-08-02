// tools/_zadded.mjs — WHAT DOES ADDED MASS ACTUALLY COST AND BUY? (C6.2)
//
// Added mass is the largest physical omission in the fluid model: a body
// accelerating through water drags fluid with it, and for a flat plate that fluid
// outweighs the plate several times over. Without it limbs are far too cheap to
// flick, which is the peak-speed tail STABLE_SPEED exists to cap.
//
// It is implemented behind `opts.addedMass` and OFF, because switching it on is a
// worldHash change that invalidates every recorded capability. This tool is what
// the decision is made on. Three questions, in order:
//
//   1. HOW HEAVY IS IT? The ratio of added to own mass/inertia over a real corpus.
//      F1 predicted ~0.8x for a segment and ~5x for a fin, on mass. The inertia
//      ratio is the one that matters and it has never been measured.
//   2. DOES IT KILL THE PEAK-SPEED TAIL? That is the claim. Peak body speed and
//      the share of creatures pinned at STABLE_SPEED, with and without.
//   3. WHAT DOES IT COST? Net speed and body-lengths/s. Expect a LOSS: more
//      inertia against the same muscle. C6.7 (MUSCLE_STRESS 200 -> 2e6) is the
//      compensating change and is measured here too, so the pair can be judged
//      together rather than one looking like a regression.
//
//   node tools/_zadded.mjs [nRandom] [seconds]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, STABLE_SPEED } from '../engine/l1/physics.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const N = Number(process.argv[2] ?? 24);
const T = Number(process.argv[3] ?? 12);
const STEPS = Math.round(T / FIXED_DT);
const W = { ...W1_SLICE, gravity: 0 };

const med = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (xs, p) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};

// ── the corpus: authored library + random factory draws ──────────────────────
const subs = [];
for (const sd of SEEDS) {
  const g = sd.genome ?? sd;
  try { subs.push({ id: sd.id, g, p: morphogenesis(g) }); } catch { /* skip */ }
}
for (let i = 0, n = 0; n < N; i++) {
  const g = createRandomGenome(rngFrom('added', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 3) continue;
  subs.push({ id: `r${i}`, g, p }); n++;
}

// ── 1 · how heavy is it? ─────────────────────────────────────────────────────
// Read straight off Rapier, so it is what the SOLVER sees rather than what the
// formula intends.
{
  const mR = [], iR = [];
  for (const { g, p } of subs) {
    const a = createSimulation(RAPIER, p, g, W, { bounded: false, motorScale: 0 });
    const b = createSimulation(RAPIER, p, g, W, { bounded: false, motorScale: 0, addedMass: true });
    // Rapier defers the additional-mass merge; physics.js forces it with
    // recomputeMassPropertiesFromColliders, so these reads are already augmented.
    for (let k = 0; k < p.bodyCount; k++) {
      const m0 = a.bodies[k].mass(), m1 = b.bodies[k].mass();
      const I0 = a.bodies[k].principalInertia(), I1 = b.bodies[k].principalInertia();
      mR.push(m1 / m0);
      iR.push(Math.max(I1.x, I1.y, I1.z) / Math.max(I0.x, I0.y, I0.z));
    }
    a.free(); b.free();
  }
  console.log(`\n  _zadded · ${subs.length} creatures, ${mR.length} bodies, ${T}s trials\n`);
  console.log('  1 · HOW HEAVY  (ratio of augmented to own, as Rapier reports it)');
  console.log(`      mass     p10 ${pct(mR, 0.1).toFixed(2)}   p50 ${med(mR).toFixed(2)}   p90 ${pct(mR, 0.9).toFixed(2)}   max ${Math.max(...mR).toFixed(1)}`);
  console.log(`      inertia  p10 ${pct(iR, 0.1).toFixed(2)}   p50 ${med(iR).toFixed(2)}   p90 ${pct(iR, 0.9).toFixed(2)}   max ${Math.max(...iR).toFixed(1)}`);
  console.log('      (1.00 = unchanged. Translation is scalar in Rapier so it takes the');
  console.log('       MINIMUM axis and barely moves; the inertia column is the real effect.)');
}

// ── 2 and 3 · what it does to the corpus ─────────────────────────────────────
function run(opts) {
  const net = [], ls = [], peak = [], pinned = [], cot = [];
  for (const { g, p } of subs) {
    let sim;
    try { sim = createSimulation(RAPIER, p, g, W, { bounded: false, wrap: false, ...opts }); }
    catch { continue; }
    const c0 = sim.centreOfMass();
    let bmax = 0, bad = false;
    try {
      for (let s = 0; s < STEPS; s++) {
        sim.step();
        for (const rb of sim.bodies) {
          const v = rb.linvel();
          const q = Math.hypot(v.x, v.y, v.z);
          if (!Number.isFinite(q)) { bad = true; break; }
          if (q > bmax) bmax = q;
        }
        if (bad) break;
      }
    } catch { bad = true; }
    const c1 = sim.centreOfMass();
    const work = sim.work;
    let mass = 0; for (const rb of sim.bodies) mass += rb.mass();
    sim.free();
    if (bad) continue;
    const d = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
    net.push(d / T);
    ls.push(d / T / Math.max(2 * boundingRadius(p), 1e-9));
    peak.push(bmax);
    pinned.push(bmax >= STABLE_SPEED * 0.999 ? 1 : 0);
    cot.push(work / Math.max(mass * d, 1e-9));
  }
  return { net, ls, peak, pinned, cot, n: net.length };
}

const ARMS = [
  ['shipped (no added mass)', {}],
  ['+ added mass', { addedMass: true }],
  ['+ added mass, half', { addedMass: true, addedMassScale: 0.5 }],
  ['+ added mass + C6.7 muscle', { addedMass: true, motorScale: 1e4 }],
];

console.log('\n  2/3 · WHAT IT DOES  (motorScale 1e4 stands in for MUSCLE_STRESS 200 -> 2e6)\n');
console.log('  arm                            n   net cm/s    L/s     peak p50  peak p90  pinned   CoT p50');
console.log('  ' + '-'.repeat(100));
for (const [label, opts] of ARMS) {
  const r = run(opts);
  const pin = r.pinned.length ? (100 * r.pinned.reduce((a, b) => a + b, 0)) / r.pinned.length : NaN;
  console.log('  ' + label.padEnd(28)
    + String(r.n).padStart(4)
    + med(r.net).toFixed(4).padStart(11)
    + med(r.ls).toFixed(4).padStart(9)
    + med(r.peak).toFixed(2).padStart(11)
    + pct(r.peak, 0.9).toFixed(2).padStart(10)
    + `${pin.toFixed(0)}%`.padStart(8)
    + med(r.cot).toFixed(0).padStart(10));
}
console.log(`\n  STABLE_SPEED is ${STABLE_SPEED} cm/s; "pinned" is the share of creatures whose fastest`);
console.log('  body reached it. If added mass is the missing physical damper, that column');
console.log('  falls and the peak columns fall with it. If L/s falls too, that is the');
console.log('  honest cost — and the C6.7 arm is what pays it back.\n');

// ── 4 · the pumping case, which is what F1's stability claim is really about ──
// The corpus above barely pins, so it cannot test "added mass is the missing
// damper". tools/_myria2.json is the saved morphology that TORE ITSELF APART —
// the myriapod that reached 60 cm/s in 2.8 s and is the reason STABLE_SPEED
// exists. If added mass is the physical stand-in for that clamp, this is where
// it shows.
{
  const { readFileSync } = await import('node:fs');
  const g = JSON.parse(readFileSync(new URL('./_myria2.json', import.meta.url)));
  const p = morphogenesis(g);
  console.log(`  4 · THE PUMPING CASE  (_myria2, ${p.bodyCount} bodies, ${T}s, uncapped)\n`);
  console.log('  arm                          peak cm/s   final cm/s   net cm/s');
  console.log('  ' + '-'.repeat(60));
  for (const [label, o] of [
    ['shipped', {}],
    ['+ added mass', { addedMass: true }],
  ]) {
    // stableSpeed lifted to the tunnelling limit so the CLAMP is not what we
    // measure — the question is whether the physics still needs it.
    const sim = createSimulation(RAPIER, p, g, W, { bounded: false, wrap: false, stableSpeed: 1e9, ...o });
    const c0 = sim.centreOfMass();
    let peak = 0, bad = false;
    for (let s = 0; s < STEPS; s++) {
      try { sim.step(); } catch { bad = true; break; }
      for (const rb of sim.bodies) {
        const v = rb.linvel(); const q = Math.hypot(v.x, v.y, v.z);
        if (!Number.isFinite(q)) { bad = true; break; }
        if (q > peak) peak = q;
      }
      if (bad) break;
    }
    let fin = 0;
    for (const rb of sim.bodies) { const v = rb.linvel(); fin = Math.max(fin, Math.hypot(v.x, v.y, v.z)); }
    const c1 = sim.centreOfMass();
    const net = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]) / T;
    sim.free();
    console.log('  ' + label.padEnd(26) + (bad ? 'DIVERGED' : peak.toFixed(1)).padStart(10)
      + fin.toFixed(1).padStart(13) + net.toFixed(4).padStart(11));
  }
  console.log('');
}
