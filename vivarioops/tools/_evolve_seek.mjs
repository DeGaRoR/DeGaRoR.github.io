// tools/_evolve_seek.mjs — CAN SELECTION FIND A SEEKER?
//
// Everything needed for this run landed this session:
//   - the sensor genes are drawn and mutable (factory.js, mutate.js)
//   - the objective is control-subtracted, so it is not a speed proxy
//   - the bearing is taken in the creature's own measured steering plane
//   - the trial is scaled to the creature so a slow one is still rankable
//
// The question is whether the loop closes end to end: does a population whose
// gains start uniform-random move toward gains that close distance?
//
// FITNESS is deliberately NOT distance closed. That is 98% a speed metric
// (HYDRODYNAMICS 83). It is
//
//     benefit = score(sensor live) - score(sensor disabled)
//
// which is independent of speed (Spearman 0.07) and a real function of the gene
// (0.49). Two runs per creature per generation, which is what makes this
// affordable at all.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE, sensorTurnBias } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const W = { ...W1_SLICE, gravity: 0 };
const MOTOR = { motor: 'solver' };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const nrm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const mean = (v) => v.reduce((a, b) => a + b, 0) / (v.length || 1);

function axisRun(plan, genome, turnBias, SEC = 8) {
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, turnBias, ...MOTOR }); }
  catch { return null; }
  const marks = []; let bad = false;
  try {
    for (let s = 0; s < Math.round(SEC / FIXED_DT); s++) {
      sim.step();
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      if (s % 60 === 0) marks.push([...c]);
    }
  } catch { bad = true; }
  const c1 = sim.centreOfMass(); sim.free();
  if (bad || marks.length < 4) return null;
  const v = [];
  for (let i = 1; i < marks.length; i++) {
    const d = [marks[i][0]-marks[i-1][0], marks[i][1]-marks[i-1][1], marks[i][2]-marks[i-1][2]];
    if (Math.hypot(...d) > 1e-5) v.push(nrm(d));
  }
  let ax = [0, 0, 0];
  for (let i = 1; i < v.length; i++) {
    const c = cross(v[i-1], v[i]); ax = [ax[0]+c[0], ax[1]+c[1], ax[2]+c[2]];
  }
  const d0 = marks[0], travel = Math.hypot(c1[0]-d0[0], c1[1]-d0[1], c1[2]-d0[2]);
  return { axis: nrm(ax), speed: travel / SEC };
}

/** The creature's own steering plane, plus how fast it travels. */
function profile(plan, genome) {
  const p = axisRun(plan, genome, +1), m = axisRun(plan, genome, -1);
  if (!p || !m) return null;
  const d = [p.axis[0]-m.axis[0], p.axis[1]-m.axis[1], p.axis[2]-m.axis[2]];
  const mag = Math.hypot(...d);
  const axis = mag > 1e-6 ? nrm(d) : [0, 1, 0];
  const seed = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = nrm(cross(axis, seed));
  return { basis: [u, nrm(cross(axis, u))], authority: mag / 2, speed: (p.speed + m.speed) / 2 };
}

/**
 * Seek score. TWO REPAIRS over the naive trial:
 *   - the target range is scaled to what this creature could cover if it swam
 *     straight, so a slow creature is ranked against its own siblings instead of
 *     tying at zero with every other slow creature (HYDRODYNAMICS 90);
 *   - the score is the time-integrated closing, not arrival, so it is non-zero
 *     the moment the creature moves at all.
 */
function seek(plan, genome, prof, gainOverride, SEC = 20) {
  const R = Math.max(1.0, Math.min(8, prof.speed * SEC * 0.6));
  const [U, V] = prof.basis;
  const sc = [];
  for (const deg of [0, 72, 144, 216, 288]) {
    let sim;
    try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...MOTOR }); }
    catch { return null; }
    const c0 = sim.centreOfMass(), th = deg * Math.PI / 180;
    const target = [0, 1, 2].map((i) => c0[i] + R * (Math.cos(th) * U[i] + Math.sin(th) * V[i]));
    let best = R, bad = false, prev = c0, va = 0, vb = 0;
    try {
      for (let s = 0; s < Math.round(SEC / FIXED_DT); s++) {
        const c = sim.centreOfMass();
        if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
        const dv = [c[0]-prev[0], c[1]-prev[1], c[2]-prev[2]];
        va = 0.98*va + 0.02*dot(dv, U); vb = 0.98*vb + 0.02*dot(dv, V);
        const td = [target[0]-c[0], target[1]-c[1], target[2]-c[2]];
        const ta = dot(td, U), tb = dot(td, V);
        if (Math.hypot(va, vb) > 1e-7 && Math.hypot(ta, tb) > 1e-4) {
          const bearing = wrap(Math.atan2(tb, ta) - Math.atan2(vb, va)) / Math.PI;
          sim.control.turnBias = gainOverride === null
            ? sensorTurnBias(genome, bearing, bearing)
            : Math.max(-1, Math.min(1, gainOverride * bearing));
        }
        prev = c;
        const d = Math.hypot(target[0]-c[0], target[1]-c[1], target[2]-c[2]);
        if (d < best) best = d;
        sim.step();
      }
    } catch { bad = true; }
    sim.free(); if (bad) return null;
    sc.push(Math.max(0, (R - best) / R));
  }
  return mean(sc);
}

function evaluate(genome) {
  let plan; try { plan = morphogenesis(genome); } catch { return null; }
  if (plan.jointCount < 1) return null;
  const prof = profile(plan, genome);
  if (!prof || !(prof.speed > 1e-4)) return null;
  const live = seek(plan, genome, prof, null);
  const dead = seek(plan, genome, prof, 0);
  if (live === null || dead === null) return null;
  return {
    benefit: live - dead, live, dead,
    authority: prof.authority, speed: prof.speed,
    gain: genome.controller.preyGain + genome.controller.threatGain,
  };
}

// ── the run ─────────────────────────────────────────────────────────────────
const POP = Number(process.argv[2] ?? 18);
const GENS = Number(process.argv[3] ?? 6);
const ELITE = Math.max(2, Math.round(POP * 0.3));

let pop = [];
for (let i = 0; pop.length < POP && i < POP * 12; i++) {
  const g = createRandomGenome(rngFrom('seekevo', 'init', i));
  try { if (morphogenesis(g).jointCount >= 1) pop.push(g); } catch { /* skip */ }
}

console.log(`\n  selection on control-subtracted seek benefit`);
console.log(`  population ${POP}, elites ${ELITE}, ${GENS} generations, solver motor\n`);
console.log('  gen   benefit p50   benefit best    |gain| p50   authority p50   speed p50');
for (let gen = 0; gen < GENS; gen++) {
  const scored = [];
  for (const g of pop) {
    const r = evaluate(g);
    if (r) scored.push({ g, ...r });
  }
  if (scored.length < ELITE + 1) { console.log(`  ${gen}  too few viable (${scored.length})`); break; }
  scored.sort((a, b) => b.benefit - a.benefit);
  const p50 = (f) => { const v = scored.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log(`  ${String(gen).padStart(3)}   ${p50(s => s.benefit).toFixed(4).padStart(10)}   ${scored[0].benefit.toFixed(4).padStart(11)}    ${p50(s => Math.abs(s.gain)).toFixed(3).padStart(8)}   ${p50(s => s.authority).toFixed(3).padStart(12)}   ${p50(s => s.speed).toFixed(4).padStart(8)}`);

  if (gen === GENS - 1) break;
  const elites = scored.slice(0, ELITE).map(s => s.g);
  const next = elites.slice();
  let k = 0;
  while (next.length < POP && k < POP * 20) {
    const parent = elites[k % elites.length];
    const child = mutate(parent, rngFrom('seekevo', gen, k)).genome;
    try { if (morphogenesis(child).jointCount >= 1) next.push(child); } catch { /* skip */ }
    k++;
  }
  pop = next;
}
console.log('');
