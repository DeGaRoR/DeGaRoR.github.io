// tools/_evolib.mjs — shared evaluation machinery for the chunked selection runs.
// Extracted verbatim from _evolve_run.mjs so that every chunk measures the same
// thing; a run split across sessions is only comparable if the metric is one
// definition in one file.
export const p50 = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash } from '../engine/l1/genome.js';
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

export const AXIS_SEC = 8, SEEK_SEC = 15;
// §106: measured S/N by trial size is 1.64 at four bearings and 2.45 at six;
// the estimates above nine rest on too few distinct rotations to trust. Twelve
// is the smallest size the grid supports that is plausibly above 3, and it is
// re-measured rather than assumed.
export const NB = Number(process.env.NB ?? 12);
const BEARINGS = Array.from({ length: NB }, (_, i) => i * 360 / NB);

function axisRun(plan, genome, turnBias) {
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, turnBias, ...MOTOR }); }
  catch { return null; }
  const marks = []; let bad = false;
  try {
    for (let s = 0; s < Math.round(AXIS_SEC / FIXED_DT); s++) {
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
  for (let i = 1; i < v.length; i++) { const c = cross(v[i-1], v[i]); ax = [ax[0]+c[0], ax[1]+c[1], ax[2]+c[2]]; }
  return { axis: nrm(ax), speed: Math.hypot(c1[0]-marks[0][0], c1[1]-marks[0][1], c1[2]-marks[0][2]) / AXIS_SEC };
}

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

function seek(plan, genome, prof, gainOverride) {
  const R = Math.max(1.0, Math.min(8, prof.speed * SEEK_SEC * 0.6));
  const [U, V] = prof.basis;
  const sc = [];
  for (const deg of BEARINGS) {
    let sim;
    try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...MOTOR }); }
    catch { return null; }
    const c0 = sim.centreOfMass(), th = deg * Math.PI / 180;
    const target = [0, 1, 2].map((i) => c0[i] + R * (Math.cos(th) * U[i] + Math.sin(th) * V[i]));
    let best = R, bad = false, prev = c0, va = 0, vb = 0;
    try {
      for (let s = 0; s < Math.round(SEEK_SEC / FIXED_DT); s++) {
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
  return sc.reduce((a, b) => a + b, 0) / sc.length;
}

// Deterministic in the genome, so cache it: elites persist for many generations
// and re-simulating them is the single largest avoidable cost in the run.
const CACHE = new Map();
let evals = 0, skipped = 0;
const COST = [];
// A PER-EVALUATION BUDGET. Simulation cost scales with body count, and at twelve
// bearings one evaluation is 24 seek runs plus 2 axis runs — 376 sim-seconds. A
// 3-body creature costs about 5 s of wall; a 20-body one costs ten times that,
// and a population that happens to draw several of them can take an order of
// magnitude longer than the same population of small ones. Measured: identical
// settings, one seed finished in 191 s and another had not finished in 1400.
// An auto-breeder cannot have its generation time set by its largest creature,
// so the budget is explicit and the skips are counted rather than hidden.
const BUDGET_MS = Number(process.env.BUDGET_MS ?? 12000);
export function evaluate(genome) {
  const h = genomeHash(genome);
  if (CACHE.has(h)) return CACHE.get(h);
  let out = null;
  const t0 = Date.now();
  let plan; try { plan = morphogenesis(genome); } catch { plan = null; }
  if (plan && plan.bodyCount > (Number(process.env.MAX_BODIES ?? 12))) {
    skipped++; CACHE.set(h, null); return null;   // too expensive to rank fairly
  }
  if (plan && plan.jointCount >= 1) {
    const prof = profile(plan, genome);
    if (prof && prof.speed > 1e-4) {
      const live = seek(plan, genome, prof, null), dead = seek(plan, genome, prof, 0);
      if (live !== null && dead !== null) {
        out = { benefit: live - dead, live, dead, authority: prof.authority, speed: prof.speed,
                gain: genome.controller.preyGain + genome.controller.threatGain, hash: h };
      }
    }
  }
  evals++;
  const ms = Date.now() - t0; COST.push(ms);
  if (ms > BUDGET_MS) skipped++;
  CACHE.set(h, out);
  return out;
}


export { rngFrom, createRandomGenome, mutate, morphogenesis, genomeHash };
