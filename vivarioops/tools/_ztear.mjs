// tools/_ztear.mjs — THROWAWAY: WHY does the creature come apart, not just when.
//
// tools/_zboom.mjs established the WHAT: `_zboom_polypoda.json` survives an hour
// alone (spread 0.8) and bursts at t = 3670 s in a SHARED arena, reaching a spread
// of 297x its own rest radius via a SINGLE-STEP position jump. Contact is the
// trigger and the tear is a solver event.
//
// This asks which knob owns it. Three candidates, each with a reason to suspect it:
//
//   addedMass    C6.2 put anisotropic added inertia into the mass matrix, up to
//                x10.4 on a plate's worst axis. Extreme inertia RATIOS across a
//                joint are the classic way an impulse solver fails to converge.
//   solver iters Rapier's default iteration count may simply be too few to hold a
//                7-body tree against a contact impulse.
//   both         the interaction, which is what a matrix is for.
//
// Every arm is the SAME creature with the SAME five neighbours from the same
// origins. A knob that PREVENTS the burst is the cause; one that only delays it
// is not, which is why every arm runs the full duration rather than stopping at
// the control's burst time.
import { readFileSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { authoredList } from '../worlds/atlas_seed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T = Number(process.argv[2] ?? 5400);
const SUS = JSON.parse(readFileSync(new URL('./_zboom_polypoda.json', import.meta.url), 'utf8'));
const HAB = W1_SLICE.habitatBounds ?? W1_SLICE.tankBounds;

/**
 * One arm. `tune(world3d)` runs after the arena exists, so an arm may reach into
 * Rapier's integration parameters directly — the only way to test the solver
 * hypothesis without shipping the change first.
 */
function arm(label, { simOpts = {}, tune = null } = {}) {
  const arena = createArena(RAPIER, W1_SLICE, { bounded: false });
  if (tune) tune(arena.world3d);
  const entries = [{ genome: SUS }].concat(authoredList().slice(0, 5));
  const cast = entries.map((e, i) => {
    const a = (i / entries.length) * Math.PI * 2;
    const plan = morphogenesis(e.genome);
    return {
      rest: boundingRadius(plan),
      sim: createSimulation(RAPIER, plan, e.genome, W1_SLICE, {
        arena, wrap: false,
        origin: [Math.cos(a) * (HAB[0] / 4), Math.sin(a) * (HAB[1] / 3), 0],
        ...simOpts,
      }),
    };
  });
  const sims = cast.map((c) => c.sim);
  const c0 = cast[0];
  let tBurst = NaN, spreadMax = 0, jumpMax = 0, prev = c0.sim.integrity().spread;
  const t0 = Date.now();
  for (let st = 0; st < Math.round(T / FIXED_DT); st++) {
    arena.stepAll(sims);
    const g = c0.sim.integrity();
    const jump = g.spread - prev;
    if (jump > jumpMax) jumpMax = jump;
    prev = g.spread;
    if (g.spread > spreadMax) spreadMax = g.spread;
    if (!Number.isFinite(tBurst) && g.spread > 3) tBurst = st * FIXED_DT;
    if (g.spread > 200) break;                    // gone; no need to watch it fly
  }
  const wall = (Date.now() - t0) / 1000;
  console.log('  ' + label.padEnd(28)
    + (Number.isFinite(tBurst) ? tBurst.toFixed(0) + 's' : 'never').padStart(9)
    + spreadMax.toFixed(1).padStart(12)
    + jumpMax.toFixed(2).padStart(13)
    + wall.toFixed(0).padStart(8) + 's'
    + '   ' + (Number.isFinite(tBurst) ? 'BURST' : 'held'));
  for (const c of cast) c.sim.free();
  arena.free();
}

console.log('\n  the same creature and the same five neighbours, ' + T + 's per arm\n');
console.log('  arm                          t_burst   spreadMax    maxJump/step    wall');
console.log('  ' + '-'.repeat(82));

arm('shipped (control)');
arm('addedMass OFF', { simOpts: { addedMass: false } });
arm('addedMass x0.25', { simOpts: { addedMassScale: 0.25 } });
arm('solver 8 iterations', { tune: (w) => { w.integrationParameters.numSolverIterations = 8; } });
arm('solver 16 iterations', { tune: (w) => { w.integrationParameters.numSolverIterations = 16; } });
arm('8 iters + addedMass x0.25', {
  simOpts: { addedMassScale: 0.25 },
  tune: (w) => { w.integrationParameters.numSolverIterations = 8; },
});

console.log('\n  maxJump/step is the largest single-step change in spread. A converging solver');
console.log('  cannot move a jointed body by a whole rest radius in one step.\n');
