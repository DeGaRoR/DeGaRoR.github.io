// tools/b3tune.js — TEMPORARY B3 instrument. Sweep MOTOR_SCALE against the gate
// corpus and report what the creatures actually do. Not gate code.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 40), STEPS = Number(process.argv[3] ?? 1800);
const drive = process.argv.includes('--velocity') ? DRIVE.VELOCITY : DRIVE.POSITION;
const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1] ?? 0;
console.log(`  drive=${drive}  ${N} creatures x ${STEPS} steps (${(STEPS/120).toFixed(1)} s)`);
console.log('  motorScale  bad   peakV med/max      peakW med   displacement med/max   work med');
for (const ms of [0.05, 0.2, 0.5, 1, 2, 5, 20, 60]) {
  const pv = [], pw = [], disp = [], wk = []; let bad = 0;
  for (let i = 0; i < N; i++) {
    const genome = createRandomGenome(rngFrom('gate', 'l1', i));
    const plan = morphogenesis(genome);
    const sim = createSimulation(RAPIER, plan, genome, W1_SLICE, { drive, motorScale: ms });
    const c0 = sim.centreOfMass();
    let mv = 0, mw = 0, broke = false;
    for (let s = 0; s < STEPS; s++) {
      let v = 0, a = 0;
      for (const rb of sim.bodies) {
        const l = rb.linvel(), g = rb.angvel();
        if (!Number.isFinite(l.x + l.y + l.z + g.x + g.y + g.z)) { broke = true; break; }
        v = Math.max(v, Math.hypot(l.x, l.y, l.z)); a = Math.max(a, Math.hypot(g.x, g.y, g.z));
      }
      if (broke) break;
      mv = Math.max(mv, v); mw = Math.max(mw, a);
      sim.step();
    }
    if (broke) { bad++; } else {
      const c1 = sim.centreOfMass();
      pv.push(mv); pw.push(mw); wk.push(sim.work);
      disp.push(Math.hypot(c1[0]-c0[0], c1[1]-c0[1], c1[2]-c0[2]));
    }
    sim.free();
  }
  console.log(`  ${String(ms).padStart(9)}  ${String(bad).padStart(3)}   ${med(pv).toFixed(2).padStart(7)}/${Math.max(0,...pv).toFixed(0).padEnd(9)}  ${med(pw).toFixed(1).padStart(8)}    ${med(disp).toFixed(2).padStart(6)}/${Math.max(0,...disp).toFixed(1).padEnd(8)}  ${med(wk).toFixed(1)}`);
}
