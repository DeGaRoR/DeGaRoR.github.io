// THROWAWAY (scale audit, step 3) — THE GEOMETRIC WHAT-IF.
//
// Shrink the BODY PLAN by an exact similarity factor s (dims, positions, joint
// anchors x s; joint cross-sections x s^2) and re-measure. Scaling the PLAN
// rather than the genome bypasses MIN/MAX_LIMB_DIMENSION, so this is pure
// similarity: same shape, same controller, same world, different size only.
//
// What it isolates: the engine has no viscosity and (in W1) no net buoyancy, so
// the only things that fix an absolute length scale are the ACTUATOR constants —
// MUSCLE_STRESS (a stress), the commanded controller frequency (0.5-6 rad/s) and
// OMEGA_MAX (10 rad/s). Those are frequencies and a stress; together they pick
// out one body size at which the creature is neither force-starved nor
// kinematics-starved. This finds it.
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { S1, S2 } from '../engine/l2/probes.js';
import { createSimulation, FIXED_DT, MUSCLE_STRESS, STABLE_SPEED } from '../engine/l1/physics.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { assessViability, VIABILITY } from '../engine/l1/viability.js';
import { MIN_LIMB_DIMENSION } from '../engine/l1/morphogen.js';
import { makeRng } from '../trunk/rng.js';
import { deserialise } from '../engine/l1/genome.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from '../worlds/w1_residents.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const f = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : 'n/a').padStart(9);

/** Exact geometric similarity on an already-built plan. */
function scalePlan(plan, s) {
  if (s === 1) return plan;
  return {
    ...plan,
    bodies: plan.bodies.map(b => ({ ...b, dims: b.dims.map(d => d * s), position: b.position.map(p => p * s) })),
    joints: plan.joints.map(j => ({
      ...j,
      anchor: j.anchor.map(a => a * s),
      minCrossSectionalArea: j.minCrossSectionalArea * s * s,
    })),
  };
}

/** One instrumented free run: clamp saturation and peak body speed. */
function instrument(plan, genome, seconds = 10) {
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 }, { bounded: false });
  for (let k = 0; k < Math.round(2 / FIXED_DT); k++) sim.step();
  sim.resetClock();
  let clampSum = 0, n = 0, peak = 0, relOmegaMax = 0;
  const steps = Math.round(seconds / FIXED_DT);
  for (let k = 0; k < steps; k++) {
    sim.step();
    const d = sim.motorDiag;
    for (let i = 0; i < plan.jointCount; i++) { clampSum += d.clamped[i]; n++; relOmegaMax = Math.max(relOmegaMax, Math.abs(d.relOmega[i])); }
    for (const rb of sim.bodies) { const v = rb.linvel(); peak = Math.max(peak, Math.hypot(v.x, v.y, v.z)); }
  }
  sim.free();
  return { clamp: n ? clampSum / n : 0, peak, relOmegaMax };
}

const cases = [];
for (const s of SEEDS) if (s.id !== 'staircase') cases.push([s.id, s.genome]);
for (const id of W1_RESIDENT_IDS) cases.push([id, deserialise(W1_RESIDENT_GENOMES[id])]);
const rng = makeRng(0x5CA1E);
for (let i = 0, found = 0; i < 300 && found < 6; i++) {
  const g = createRandomGenome(rng, SLICE_LIMITS);
  let v; try { v = assessViability(RAPIER, g, W1_SLICE); } catch { continue; }
  if (v.ok) { cases.push([`rand${found}`, g]); found++; }
}

const SCALES = [4, 2, 1, 0.5, 0.25, 0.125, 0.0625];
const agg = new Map(SCALES.map(s => [s, []]));

console.log('\n  PER-CREATURE, netSpeed in BODY LENGTHS PER SECOND, by similarity factor s\n');
console.log('  name        ' + SCALES.map(s => `s=${s}`.padStart(9)).join(''));
for (const [name, genome] of cases) {
  let base; try { base = morphogenesis(genome); } catch { continue; }
  const out = [];
  for (const s of SCALES) {
    const plan = scalePlan(base, s);
    const s1 = S1(plan);
    const r = S2(RAPIER, { plan, genome, world: W1_SLICE });
    if (!r.valid) { out.push('   invalid'); continue; }
    const cr = r.runs[1];
    const bl = cr.netSpeed / s1.longestAxis;
    agg.get(s).push({ bl, net: cr.netSpeed, hz: cr.gaitFrequency, eff: cr.netSpeed / (cr.comSpeed || 1), L: s1.longestAxis, mass: totalMass(plan) });
    out.push(f(bl, 4));
  }
  console.log(`  ${name.padEnd(12)}${out.join('')}`);
}

const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : NaN; };
console.log('\n  MEDIANS ACROSS THE SET\n');
console.log('     s   length(u)   mass(u^3)   netSpeed     BL/s    gaitHz      eff   BL/s vs s=1');
const base1 = med(agg.get(1).map(r => r.bl));
for (const s of SCALES) {
  const a = agg.get(s);
  if (!a.length) continue;
  console.log(`  ${String(s).padStart(6)} ${f(med(a.map(r => r.L)), 3)} ${f(med(a.map(r => r.mass)), 4)} ${f(med(a.map(r => r.net)), 4)} ${f(med(a.map(r => r.bl)), 4)} ${f(med(a.map(r => r.hz)), 2)} ${f(med(a.map(r => r.eff)), 3)}   x${(med(a.map(r => r.bl)) / base1).toFixed(2)}`);
}

console.log('\n  ACTUATOR STATE at each scale (eel + res_c), 10 s free run\n');
console.log('  creature      s   clampFrac   peakSpd   maxRelOmega   (STABLE_SPEED=' + STABLE_SPEED + ')');
for (const nm of ['eel', 'res_c']) {
  const entry = cases.find(c => c[0] === nm);
  if (!entry) continue;
  const base = morphogenesis(entry[1]);
  for (const s of SCALES) {
    const r = instrument(scalePlan(base, s), entry[1]);
    console.log(`  ${nm.padEnd(10)} ${String(s).padStart(6)} ${f(r.clamp, 3)} ${f(r.peak, 3)} ${f(r.relOmegaMax, 2)}`);
  }
}

console.log(`
  WHAT THE SHIPPED FILTERS DO AT EACH SCALE (mass and limb-size bounds are
  ABSOLUTE numbers, so a similarity shrink walks the corpus straight out of them)
`);
console.log(`  VIABILITY.minMass=${VIABILITY.minMass}  maxMass=${VIABILITY.maxMass}  MIN_LIMB_DIMENSION=${MIN_LIMB_DIMENSION}  RANGE.dim=[0.2,2.0]`);
console.log('\n     s   median mass   below minMass?   smallest legal limb dim   below MIN_LIMB?');
for (const s of SCALES) {
  const m = med(agg.get(s).map(r => r.mass));
  const limb = 0.2 * s;
  console.log(`  ${String(s).padStart(6)} ${f(m, 4)}   ${(m < VIABILITY.minMass ? 'YES — rejected' : m > VIABILITY.maxMass ? 'over maxMass' : 'ok').padEnd(16)} ${f(limb, 4)}         ${limb < MIN_LIMB_DIMENSION ? 'YES — limb dropped' : 'ok'}`);
}
console.log(`
  Muscle/inertia natural time at scale s:  T = L*sqrt(rho/sigma) = L/${Math.sqrt(MUSCLE_STRESS).toFixed(1)}
  Commanded controller band is 0.5-6 rad/s and OMEGA_MAX is 10 rad/s — both FIXED,
  so the body size at which the muscle timescale meets the command is:
`);
for (const s of SCALES) {
  const L = med(agg.get(s).map(r => r.L));
  if (!Number.isFinite(L)) continue;
  const wn = Math.sqrt(MUSCLE_STRESS) / L;
  console.log(`     s=${String(s).padEnd(7)} L=${L.toFixed(2).padStart(7)} u   muscle-limited omega ~ ${wn.toFixed(2).padStart(7)} rad/s   ${wn < 0.5 ? '<< command: FORCE-STARVED' : wn > 10 ? '>> command: KINEMATICS-LIMITED' : 'matched to the 0.5-6 command band'}`);
}
console.log();
