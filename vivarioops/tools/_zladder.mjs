// tools/_zladder.mjs — per-joint actuator tracking: gain, phase lag, lag spread,
// realised relOmega, and delivered spring torque vs the budget ceiling.
//
// This is the C1.4 acceptance instrument and the C1.2 decision data. It reads the
// per-step diagnostics physics.js exposes (sim.motorDiag) and fits each joint's
// achieved angle against its commanded angle at that joint's OWN commanded
// frequency, so a scrambled travelling wave shows up as lag spread even when the
// median lag looks fine.
//
//   node tools/_zladder.mjs [nRandom] [seconds] [arm]
//   arm: shipped | ref | refUnbounded  (default: compare all three)
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { boundingRadius } from '../engine/l1/morphogen.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 6);
const T = Number(process.argv[3] ?? 8);
const ARM = process.argv[4] ?? 'all';
await RAPIER.init();

const DEG = 180 / Math.PI;
const ARMS = {
  freq10_UNSTABLE: { motor: 'solver', motorFreqHz: 10, budgetScale: 6 }, // good swim, tears complex creatures
  k4:  { motor: 'solver', motorFreqHz: null, stiffness: 4, budgetScale: 6 },
  k8:  { motor: 'solver', motorFreqHz: null, stiffness: 8, budgetScale: 6 },
  k16: { motor: 'solver', motorFreqHz: null, stiffness: 16, budgetScale: 6 },
};

function median(a) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }
function pct(a, p) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }

// Least-squares fit of series y(t) to a*sin(wt)+b*cos(wt); returns amplitude & phase.
function fitSine(ys, ts, w) {
  let saa = 0, sbb = 0, sab = 0, say = 0, sby = 0;
  for (let k = 0; k < ys.length; k++) {
    const s = Math.sin(w * ts[k]), c = Math.cos(w * ts[k]);
    saa += s * s; sbb += c * c; sab += s * c; say += s * ys[k]; sby += c * ys[k];
  }
  const det = saa * sbb - sab * sab;
  if (Math.abs(det) < 1e-12) return { amp: 0, phase: 0 };
  const a = (say * sbb - sby * sab) / det;
  const b = (sby * saa - say * sab) / det;
  return { amp: Math.hypot(a, b), phase: Math.atan2(b, a) };
}

function measure(genome, plan, opts) {
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
    { bounded: false, wrap: true, effort: 1, turnBias: 0, ...opts });
  const settle = Math.round(2 / FIXED_DT);
  for (let k = 0; k < settle; k++) sim.step();
  const c0 = sim.centreOfMass();
  const J = plan.jointCount;
  const wants = Array.from({ length: J }, () => []);
  const thetas = Array.from({ length: J }, () => []);
  const ts = [];
  const relOmega = [], springRatio = [], dampRatio = [];
  const steps = Math.round(T / FIXED_DT);
  for (let k = 0; k <= steps; k++) {
    sim.step();
    const d = sim.motorDiag;
    ts.push(k * FIXED_DT);
    for (let i = 0; i < J; i++) {
      wants[i].push(d.want[i]); thetas[i].push(d.theta[i]);
      const ceil = d.budget[i]; // note: ceiling = motorScale*budget, motorScale=1 here
      if (ceil > 0) {
        relOmega.push(Math.abs(d.relOmega[i]));
        springRatio.push(Math.abs(d.springTau[i]) / ceil);
        dampRatio.push(Math.abs(d.dampTau[i]) / ceil);
      }
    }
  }
  const c1 = sim.centreOfMass();
  const L = 2 * boundingRadius(plan);
  const Ls = L > 1e-9 ? Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]) / T / L : 0;
  sim.free();
  // per-joint gain & lag at the joint's OWN commanded frequency
  const gains = [], lags = [];
  for (let i = 0; i < J; i++) {
    const jg = genome.controller.jointGenes[plan.joints[i].nodeId];
    const w = genome.controller.omega * (jg?.freqMult ?? 1); // rad/s, effort 1
    if (w < 1e-6) continue;
    const fw = fitSine(wants[i], ts, w);
    const ft = fitSine(thetas[i], ts, w);
    if (fw.amp < 1e-4) continue;
    gains.push(ft.amp / fw.amp);
    let lag = (fw.phase - ft.phase) * DEG; // achieved lags command
    while (lag > 180) lag -= 360; while (lag < -180) lag += 360;
    lags.push(lag);
  }
  const lagSpread = lags.length ? Math.max(...lags) - Math.min(...lags) : NaN;
  return {
    gain: median(gains), lag: median(lags.map(Math.abs)), lagSpread, Ls,
    relOmegaP50: median(relOmega), relOmegaP95: pct(relOmega, 0.95),
    springP95: pct(springRatio, 0.95), springMax: Math.max(...springRatio, 0),
    dampP95: pct(dampRatio, 0.95),
  };
}

const subs = [];
for (const sd of SEEDS) { if (sd.id === 'staircase') continue; const g = sd.genome ?? sd; try { subs.push({ id: sd.id, genome: g, plan: morphogenesis(g) }); } catch {} }
let n = 0;
for (let i = 0; n < N; i++) { const g = createRandomGenome(rngFrom('ladder', i)); let p; try { p = morphogenesis(g); } catch { continue; } if (p.jointCount < 2) continue; subs.push({ id: `r${i}`, genome: g, plan: p }); n++; }

const armKeys = ARM === 'all' ? Object.keys(ARMS) : [ARM];
for (const ak of armKeys) {
  console.log(`\n  ARM=${ak}  ${JSON.stringify(ARMS[ak])}\n`);
  console.log('  id            gain     lag    lagSpread | relOmega p50/p95 | springTau/ceil p95/max  damp p95');
  const rows = [];
  for (const s of subs) {
    const m = measure(s.genome, s.plan, ARMS[ak]);
    rows.push(m);
    console.log(`  ${s.id.padEnd(12)} ${m.gain.toFixed(3).padStart(6)} ${m.lag.toFixed(1).padStart(7)} ${m.lagSpread.toFixed(1).padStart(9)}   |`
      + ` ${m.relOmegaP50.toFixed(2).padStart(6)} ${m.relOmegaP95.toFixed(2).padStart(6)}  |`
      + ` ${m.springP95.toFixed(2).padStart(6)} ${m.springMax.toFixed(2).padStart(6)}   ${m.dampP95.toFixed(2).padStart(6)}  L/s=${m.Ls.toFixed(4)}`);
  }
  console.log('  ' + '-'.repeat(78));
  const above = rows.filter(r => r.Ls >= 0.02).length;
  console.log(`  MEDIAN       ${median(rows.map(r=>r.gain)).toFixed(3).padStart(6)} ${median(rows.map(r=>r.lag)).toFixed(1).padStart(7)} ${median(rows.map(r=>r.lagSpread)).toFixed(1).padStart(9)}`
    + `   | ${median(rows.map(r=>r.relOmegaP50)).toFixed(2).padStart(6)} ${median(rows.map(r=>r.relOmegaP95)).toFixed(2).padStart(6)}  | ${median(rows.map(r=>r.springP95)).toFixed(2).padStart(6)}`
    + `   L/s med=${median(rows.map(r=>r.Ls)).toFixed(4)} (>=0.02: ${above}/${rows.length})`);
}
console.log('\n  targets: gain >= 0.85, lag <= 10 deg, lagSpread <= 25 deg. OMEGA_MAX = 10 rad/s.\n');
