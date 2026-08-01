// THROWAWAY (scale audit, step 5) — MUSCLE STRENGTH x BODY SIZE.
//
// A centimetre reading of the length unit makes MUSCLE_STRESS = 200 mean 20 Pa
// (real vertebrate muscle is 2e5 Pa), i.e. 1e4 too weak. `motorScale` multiplies
// both the solver gain and the C1.2 error-clamp ceiling proportionally, so
// motorScale = k is exactly "MUSCLE_STRESS x k" for the shipped actuator. This
// sweeps k against the similarity factor s and asks: does making the muscle
// CGS-correct turn 0.006 BL/s into something a fish would recognise, or does the
// creature just go unstable?
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { S1 } from '../engine/l2/probes.js';
import { runSolo, indexAt, netSpeed, comSpeed, gaitFrequency } from '../engine/l2/probe.js';
import { STABLE_SPEED } from '../engine/l1/physics.js';
import { deserialise } from '../engine/l1/genome.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from '../worlds/w1_residents.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const DUR = 12, WIN = 8;

function scalePlan(plan, s) {
  if (s === 1) return plan;
  return {
    ...plan,
    bodies: plan.bodies.map(b => ({ ...b, dims: b.dims.map(d => d * s), position: b.position.map(p => p * s) })),
    joints: plan.joints.map(j => ({ ...j, anchor: j.anchor.map(a => a * s), minCrossSectionalArea: j.minCrossSectionalArea * s * s })),
  };
}

function run(plan, genome, k) {
  const r = runSolo(RAPIER, {
    plan, genome, world: W1_SLICE, gravity: 0, bounded: false, duration: DUR, effort: 1,
    simOpts: { motorScale: k },
  });
  if (!r.valid) return null;
  const from = indexAt(r.trace, DUR - WIN), to = r.trace.n;
  const L = S1(plan).longestAxis;
  const net = netSpeed(r.trace, from, to);
  const com = comSpeed(r.trace, from, to);
  return { bl: net / L, net, eff: com > 0 ? net / com : 0, hz: gaitFrequency(r.trace, from, to), L };
}

const cases = [];
for (const s of SEEDS) if (s.id !== 'staircase') cases.push([s.id, s.genome]);
for (const id of W1_RESIDENT_IDS) cases.push([id, deserialise(W1_RESIDENT_GENOMES[id])]);

const KS = [1, 3, 10, 30, 100, 300, 1000, 10000];
const SS = [1, 0.25, 0.0625];

for (const s of SS) {
  console.log(`\n  ══ similarity s = ${s}  (median body ${(7.24 * s).toFixed(2)} units) ══`);
  console.log('  BL/s by muscle multiplier k  (k=1e4 is CGS-correct vertebrate muscle at the cm reading)\n');
  console.log('  name        ' + KS.map(k => `k=${k}`.padStart(9)).join(''));
  const agg = new Map(KS.map(k => [k, []]));
  for (const [name, genome] of cases) {
    let base; try { base = morphogenesis(genome); } catch { continue; }
    const plan = scalePlan(base, s);
    const out = [];
    for (const k of KS) {
      let r = null; try { r = run(plan, genome, k); } catch {}
      if (!r || !Number.isFinite(r.bl)) { out.push('  UNSTABLE'); continue; }
      agg.get(k).push(r);
      out.push(r.bl.toFixed(4).padStart(9));
    }
    console.log(`  ${name.padEnd(12)}${out.join('')}`);
  }
  const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : NaN; };
  console.log('\n     k    median BL/s   median netSpeed(u/s)   median eff   median gaitHz   n stable');
  for (const k of KS) {
    const a = agg.get(k);
    if (!a.length) { console.log(`  ${String(k).padStart(6)}   all unstable`); continue; }
    console.log(`  ${String(k).padStart(6)} ${med(a.map(r => r.bl)).toFixed(4).padStart(12)} ${med(a.map(r => r.net)).toFixed(4).padStart(20)} ${med(a.map(r => r.eff)).toFixed(3).padStart(13)} ${med(a.map(r => r.hz)).toFixed(2).padStart(15)}   ${a.length}/${cases.length}`);
  }
}
console.log(`
  Reference: real swimmers do 0.5-10 BL/s. STABLE_SPEED clamps at ${STABLE_SPEED} u/s,
  so a median netSpeed approaching that means the guard, not the fluid, is setting the speed.
`);
