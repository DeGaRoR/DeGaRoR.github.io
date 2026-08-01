// tools/_zmyria.mjs — THROWAWAY. Reproduce the "tears itself apart" playtest bug
// on the saved Myriapoda multipes 2, across muscle-budget settings.
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const genome = JSON.parse(readFileSync(new URL('./_myria2.json', import.meta.url)));
const plan = morphogenesis(genome);
console.log(`\n  Myriapoda multipes 2 — ${plan.bodyCount} bodies, ${plan.jointCount} joints\n`);

function run(label, opts, T = 40) {
  const sim = createSimulation(RAPIER, plan, genome, W1_SLICE, { bounded: true, effort: 1, turnBias: 0, ...opts });
  let maxSpeed = 0, maxSpin = 0, blew = false, blewAt = 0;
  const steps = Math.round(T / FIXED_DT);
  for (let k = 0; k < steps; k++) {
    sim.step();
    let s = 0, w = 0, nf = false;
    for (const rb of sim.bodies) {
      const v = rb.linvel(), a = rb.angvel();
      const sp = Math.hypot(v.x, v.y, v.z), sw = Math.hypot(a.x, a.y, a.z);
      if (!Number.isFinite(sp + sw)) nf = true;
      s = Math.max(s, sp); w = Math.max(w, sw);
    }
    maxSpeed = Math.max(maxSpeed, s); maxSpin = Math.max(maxSpin, w);
    if ((nf || s > 60) && !blew) { blew = true; blewAt = k * FIXED_DT; }
  }
  sim.free();
  console.log(`  ${label.padEnd(34)} maxSpeed ${maxSpeed.toFixed(1).padStart(7)} m/s   maxSpin ${maxSpin.toFixed(0).padStart(5)} rad/s   ${blew ? `UNSTABLE @ ${blewAt.toFixed(1)}s` : 'stable'}`);
}

run('NEW DEFAULT ({})', {});
run('reference freq10 (opt-in, now capped)', { motorFreqHz: 10 });
run('NEW DEFAULT, no stability cap', { stableSpeed: 1e9 });
run('reference freq10, no cap', { motorFreqHz: 10, stableSpeed: 1e9 });
console.log('\n  "tears apart" = joints separate under runaway force; the proxy is maxSpeed > ~10 m/s.\n');
