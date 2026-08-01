// THROWAWAY (scale audit, step 4) — is `gravity` actually load-bearing?
//
// Under a centimetre reading of the length unit, w1_slice.gravity = 9.81 means
// 9.81 cm/s^2, i.e. 1/100 of real gravity, and would have to become 981. This
// asks whether that matters AT ALL today: SLICE_LIMITS.density is [1,1] and
// mediumDensity is 1.0, so (mediumDensity - density) is exactly 0 and the whole
// weight+buoyancy term cancels. Run the same creature at g = 0, 9.81 and 981 in
// the BOUNDED tank and compare trajectories bit for bit.
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { makeRng } from '../trunk/rng.js';
import { deserialise } from '../engine/l1/genome.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from '../worlds/w1_residents.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();

function track(genome, g, seconds = 20, densityOverride = null) {
  let gg = genome;
  if (densityOverride !== null) {
    gg = structuredClone(genome);
    for (const n of gg.nodes) n.density = densityOverride;
  }
  const plan = morphogenesis(gg);
  const sim = createSimulation(RAPIER, plan, gg, { ...W1_SLICE, gravity: g }, { bounded: true });
  for (let k = 0; k < Math.round(seconds / FIXED_DT); k++) sim.step();
  const c = sim.centreOfMass();
  sim.free();
  return c;
}

const cases = [];
for (const s of SEEDS) if (s.id !== 'staircase') cases.push([s.id, s.genome]);
for (const id of W1_RESIDENT_IDS) cases.push([id, deserialise(W1_RESIDENT_GENOMES[id])]);
const rng = makeRng(0xB00);
for (let i = 0; i < 4; i++) cases.push([`rand${i}`, createRandomGenome(rng, SLICE_LIMITS)]);

const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

console.log('\n  SLICE DENSITY IS PINNED TO 1.0 — gravity term is (1.0 - 1.0)*V*g = 0\n');
console.log('  creature     |CoM(g=9.81) - CoM(g=0)|   |CoM(g=981) - CoM(g=0)|');
let worst = 0;
for (const [name, genome] of cases) {
  let a, b, c;
  try { a = track(genome, 0); b = track(genome, 9.81); c = track(genome, 981); } catch { continue; }
  const e1 = d(a, b), e2 = d(a, c);
  worst = Math.max(worst, e1, e2);
  console.log(`  ${name.padEnd(12)} ${e1.toExponential(2).padStart(20)} ${e2.toExponential(2).padStart(23)}`);
}
console.log(`\n  worst deviation over 20 s: ${worst.toExponential(2)} units — gravity is INERT in W1.\n`);

// And what it would cost the day densities unpin (step F's thick-gas world).
console.log('  WITH A DENSITY GENE UNPINNED (density 0.9, i.e. 10% buoyant) the term wakes up:\n');
console.log('  creature      g=0 -> g=9.81 drift    g=9.81 -> g=981 drift');
for (const [name, genome] of cases.slice(0, 5)) {
  let a, b, c;
  try {
    a = track(genome, 0, 20, 0.9); b = track(genome, 9.81, 20, 0.9); c = track(genome, 981, 20, 0.9);
  } catch { continue; }
  console.log(`  ${name.padEnd(12)} ${d(a, b).toFixed(3).padStart(18)} ${d(b, c).toFixed(3).padStart(23)}`);
}
console.log();
