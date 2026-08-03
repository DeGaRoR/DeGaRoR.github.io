// tools/_zboom.mjs — THROWAWAY: which creature explodes, when, and what tears?
//
// SYMPTOM, from a 300-minute open-ocean run on the Forage screen: one creature
// ("Polypoda multipes tentacules") reported 7864 g eaten against 31-49 g for the
// other five, its parts were visibly scattered across the whole view, and it had
// unlocked so many food chunks that the screen went unusable.
//
// 7864 g is not foraging. A mouth ingests 1.2 g/s, so 7864 g needs 6553 seconds of
// CONTINUOUS contact — and the creature only ran for 18000 s while its rivals ate
// 40. Either the mouth is teleporting through fresh water at enormous speed, or
// the body it is attached to has come apart and the pieces are sweeping
// independently. This tells them apart.
//
// WHAT IT MEASURES, per creature, over time:
//   spread     max distance between any body and the root, over the plan's own
//              rest radius. > ~3 means the animal is no longer one animal.
//   vmax       fastest body. STABLE_SPEED is 10 cm/s, so anything at the cap
//              means clampKinematics is holding it and the underlying dynamics
//              are already divergent.
//   travel     how far the root has gone. This is what unlocks food chunks.
import { readFileSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis, boundingRadius, totalMass } from '../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { authoredList } from '../worlds/atlas_seed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T = Number(process.argv[2] ?? 1800);
const ONLY = process.argv[3] ?? null;                 // substring of a common name
const SAMPLE = 5;                                     // seconds between samples

// THE ACTUAL CULPRIT, pulled out of the running app's IndexedDB. None of the
// authored eight burst in isolation, so the exploding creature was one the PLAYER
// bred and saved — which is exactly the population the authored list cannot
// represent. `tools/_zboom_polypoda.json` is that genome, frozen as a repro.
const SUSPECT = JSON.parse(readFileSync(new URL('./_zboom_polypoda.json', import.meta.url), 'utf8'));
const cast = [{ commonName: 'Polypoda multipes tentacules', genome: SUSPECT }]
  .concat(authoredList())
  .filter((e) => !ONLY || String(e.commonName ?? '').toLowerCase().includes(ONLY.toLowerCase()));

console.log(`\n  ${cast.length} creature(s), OPEN OCEAN (bounded:false), ${T}s each\n`);
console.log('  creature            mass g   rest r    t_burst   spread max   vmax cm/s   travel cm   verdict');
console.log('  ' + '-'.repeat(108));

for (const e of cast) {
  let plan, sim, arena;
  try {
    plan = morphogenesis(e.genome);
    // ONE creature per arena here, deliberately: the screen shares an arena, and
    // sharing would let a neighbour's contact be blamed for a tear that is
    // actually the creature's own. Isolate first, then re-test in company.
    // A shared arena forbids sim.step() (it would advance the world once per
    // occupant), so the isolation run uses stepAll on an arena of one — which is
    // the same code path the Forage screen takes.
    arena = createArena(RAPIER, W1_SLICE, { bounded: false });
    sim = createSimulation(RAPIER, plan, e.genome, W1_SLICE, { arena, wrap: false });
  } catch (err) {
    console.log(`  ${String(e.commonName).padEnd(20)} FAILED ${err.message}`);
    continue;
  }
  const rest = boundingRadius(plan);
  const p0 = sim.centreOfMass().slice();
  let tBurst = NaN, spreadMax = 0, vMax = 0;
  const steps = Math.round(T / FIXED_DT), every = Math.round(SAMPLE / FIXED_DT);

  for (let st = 0; st < steps; st++) {
    arena.stepAll([sim]);
    if (st % every) continue;
    const root = sim.bodies[0].translation();
    let spread = 0, v = 0;
    for (const rb of sim.bodies) {
      const t = rb.translation(), lv = rb.linvel();
      const d = Math.hypot(t.x - root.x, t.y - root.y, t.z - root.z);
      if (d > spread) spread = d;
      const sp = Math.hypot(lv.x, lv.y, lv.z);
      if (sp > v) v = sp;
    }
    spread /= Math.max(rest, 1e-6);
    if (spread > spreadMax) spreadMax = spread;
    if (v > vMax) vMax = v;
    // BURST = the first sample where the body is more than 3x its own rest radius
    // across. Chosen because a swimming creature's bodies stay inside their own
    // envelope; 3x cannot be reached by any pose.
    if (!Number.isFinite(tBurst) && spread > 3) tBurst = st * FIXED_DT;
  }

  const p = sim.centreOfMass();
  const travel = Math.hypot(p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]);
  console.log('  ' + String(e.commonName ?? '(unnamed)').slice(0, 19).padEnd(20)
    + totalMass(plan).toFixed(2).padStart(7)
    + rest.toFixed(2).padStart(9)
    + (Number.isFinite(tBurst) ? `${tBurst.toFixed(0)}s` : '-').padStart(11)
    + spreadMax.toFixed(1).padStart(13)
    + vMax.toFixed(2).padStart(12)
    + travel.toFixed(0).padStart(12)
    + '   ' + (spreadMax > 3 ? 'EXPLODED' : spreadMax > 1.6 ? 'strained' : 'intact'));
  sim.free();
  arena.free();
}

console.log('\n  spread = max |body - root| / boundingRadius(plan). A pose cannot reach 3.');
console.log('  vmax against STABLE_SPEED = 10 cm/s: at the cap, the clamp is the only thing holding it.\n');
