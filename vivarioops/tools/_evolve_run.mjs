// tools/_evolve_run.mjs — THE REAL RUN, WITH A CONTROL.
//
// §97: the first selection run improved median benefit 28x in three generations
// and then converged to a single genotype and stopped searching. The handover
// names the fix and the shipped code already contains it — N17's stranger slot
// (immigration) and N18's untouched elites. This applies both at a population
// size worth the name.
//
// `engine/l1/breed.js` CANNOT BE USED DIRECTLY: `POPULATION = 6` is a module
// constant and `breed()` throws if the array is any other length. That is
// correct for the tank — six slots is the player's screen — and it means an
// auto-breeder needs `POPULATION` to become an argument. The two RULES are what
// matter and they are reimplemented here at size, faithfully:
//
//   N18  elites survive UNCHANGED, the same object, not a re-derivation
//   N17  a fixed share of each generation is fresh random immigrants
//
// AND A CONTROL ARM. A harness that carries elites forward and re-measures them
// will show a rising median even if the fitness is noise, because the maximum of
// a resampled set drifts upward. So the same machinery is run twice: once
// selecting by fitness, once selecting AT RANDOM. If the control also climbs,
// the signal is the harness and not the biology.
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
const p50 = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const AXIS_SEC = 8, SEEK_SEC = 15;
// §106: measured S/N by trial size is 1.64 at four bearings and 2.45 at six;
// the estimates above nine rest on too few distinct rotations to trust. Twelve
// is the smallest size the grid supports that is plausibly above 3, and it is
// re-measured rather than assumed.
const NB = Number(process.env.NB ?? 12);
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
function evaluate(genome) {
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

/**
 * One arm. `byFitness = false` selects the elites AT RANDOM — the control.
 */
function run(label, byFitness, { POP = 30, GENS = 12, ELITE_FRAC = 0.3, IMMIGRANT_FRAC = 1/6, tag = 'A' } = {}) {
  const ELITE = Math.max(2, Math.round(POP * ELITE_FRAC));
  const IMM = Math.max(1, Math.round(POP * IMMIGRANT_FRAC));
  let pop = [];
  for (let i = 0; pop.length < POP && i < POP * 15; i++) {
    const g = createRandomGenome(rngFrom('run', tag, 'init', i));
    try { if (morphogenesis(g).jointCount >= 1) pop.push(g); } catch { /* skip */ }
  }
  console.log(`\n  ── ${label} ──  pop ${POP}, elites ${ELITE}, immigrants ${IMM}/gen, ${GENS} generations`);
  console.log('  gen   benefit p50   benefit p90    best    distinct   |gain| p50   authority p50');
  const history = [];
  for (let gen = 0; gen < GENS; gen++) {
    const scored = [];
    for (const g of pop) { const r = evaluate(g); if (r) scored.push({ g, ...r }); }
    if (scored.length < ELITE + 1) { console.log(`  ${gen}: too few viable (${scored.length})`); break; }
    const bens = scored.map(s => s.benefit).sort((a, b) => a - b);
    const distinct = new Set(pop.map(genomeHash)).size;
    const row = {
      gen, p50: p50(bens), p90: bens[Math.floor(bens.length * 0.9)], best: bens[bens.length - 1],
      distinct, gain: p50(scored.map(s => Math.abs(s.gain))), auth: p50(scored.map(s => s.authority)),
    };
    history.push(row);
    console.log(`  ${String(gen).padStart(3)}   ${row.p50.toFixed(4).padStart(10)}   ${row.p90.toFixed(4).padStart(10)}  ${row.best.toFixed(4).padStart(7)}    ${String(distinct).padStart(3)}/${POP}      ${row.gain.toFixed(3).padStart(6)}       ${row.auth.toFixed(3).padStart(8)}`);
    if (gen === GENS - 1) break;

    // N18 — elites survive UNCHANGED, same object.
    const rng = rngFrom('run', tag, 'gen', gen);
    const ranked = byFitness
      ? [...scored].sort((a, b) => b.benefit - a.benefit)
      : (() => { const s = [...scored]; for (let i = s.length - 1; i > 0; i--) { const j = rng.int(i + 1); [s[i], s[j]] = [s[j], s[i]]; } return s; })();
    const elites = ranked.slice(0, ELITE).map(s => s.g);
    const next = elites.slice();
    // N17 — immigration. Fresh random genomes, unrelated to anything selected.
    for (let i = 0; next.length < POP && i < IMM * 15; i++) {
      if (next.length >= POP) break;
      const g = createRandomGenome(rngFrom('run', tag, 'imm', gen, i));
      try { if (morphogenesis(g).jointCount >= 1 && next.length < ELITE + IMM) next.push(g); } catch { /* skip */ }
    }
    let k = 0;
    while (next.length < POP && k < POP * 25) {
      const child = mutate(elites[k % elites.length], rngFrom('run', tag, 'off', gen, k)).genome;
      try { if (morphogenesis(child).jointCount >= 1) next.push(child); } catch { /* skip */ }
      k++;
    }
    pop = next;
  }
  return history;
}

const POP = Number(process.argv[2] ?? 30);
const GENS = Number(process.argv[3] ?? 12);
const ARM = process.argv[4] ?? 'both';
const SEED = process.argv[5] ?? '';
const t0 = Date.now();
const real = ARM === 'control' ? [] : run('SELECTION on seek benefit', true, { POP, GENS, tag: 'fit' + SEED });
const ctrl = ARM === 'selected' ? [] : run('CONTROL — selection at random', false, { POP, GENS, tag: 'ctl' + SEED });

console.log('\n  ── side by side, median benefit ──');
console.log('  gen        selected      control       ratio');
for (let i = 0; i < Math.min(real.length, ctrl.length); i++) {
  const r = real[i].p50, c = ctrl[i].p50;
  console.log(`  ${String(i).padStart(3)}   ${r.toFixed(4).padStart(11)}  ${c.toFixed(4).padStart(11)}   ${(c > 1e-6 ? (r / c).toFixed(2) : '—').padStart(8)}`);
}
if (real.length) {
  const a = real[0], b = real[real.length - 1];
  console.log(`\n  selected: median ${a.p50.toFixed(4)} -> ${b.p50.toFixed(4)}   best ${a.best.toFixed(4)} -> ${b.best.toFixed(4)}   distinct ${a.distinct} -> ${b.distinct}`);
}
if (ctrl.length) {
  const a = ctrl[0], b = ctrl[ctrl.length - 1];
  console.log(`  control : median ${a.p50.toFixed(4)} -> ${b.p50.toFixed(4)}   best ${a.best.toFixed(4)} -> ${b.best.toFixed(4)}   distinct ${a.distinct} -> ${b.distinct}`);
}
COST.sort((a,b)=>a-b);
if (COST.length) console.log(`  evaluation cost ms: p50 ${COST[Math.floor(COST.length/2)]}  p90 ${COST[Math.floor(COST.length*0.9)]}  max ${COST[COST.length-1]}   over budget/oversize: ${skipped}`);
console.log(`\n  ${evals} evaluations, ${((Date.now() - t0) / 1000).toFixed(0)} s wall\n`);
