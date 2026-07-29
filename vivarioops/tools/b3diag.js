// tools/b3diag.js — TEMPORARY B3 diagnostic. Not part of the gate.
// Reproduces the Rapier panic and reports the state of the step BEFORE it.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const N = Number(process.argv[2] ?? 40);
const STEPS = Number(process.argv[3] ?? 1800);
const bounded = process.argv.includes('--unbounded') ? false : true;
const motorScale = process.argv.includes('--nomotor') ? 0 : undefined;
const verbose = process.argv.includes('-v');

// `--set key=value` overrides a World field, so drag and buoyancy can be
// switched off without touching physics.js.
const overrides = {};
for (const a of process.argv) {
  const m = /^--set(?:=|\s+)?([A-Za-z]+)=(-?[\d.]+)$/.exec(a);
  if (m) overrides[m[1]] = Number(m[2]);
}
const WORLD = { ...W1_SLICE, ...overrides };
if (Object.keys(overrides).length) console.log(`  world overrides: ${JSON.stringify(overrides)}`);

/** Worst finite magnitudes seen this step, plus a non-finite flag. */
function probe(sim) {
  let maxSpeed = 0, maxSpin = 0, maxPos = 0, bad = null;
  for (let i = 0; i < sim.bodies.length; i++) {
    const rb = sim.bodies[i];
    const p = rb.translation(), v = rb.linvel(), a = rb.angvel(), q = rb.rotation();
    const nums = [p.x, p.y, p.z, v.x, v.y, v.z, a.x, a.y, a.z, q.x, q.y, q.z, q.w];
    if (!bad && nums.some(n => !Number.isFinite(n))) bad = { body: i, p, v, a, q };
    maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z) || 0);
    maxSpin = Math.max(maxSpin, Math.hypot(a.x, a.y, a.z) || 0);
    maxPos = Math.max(maxPos, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  }
  return { maxSpeed, maxSpin, maxPos, bad };
}

let panics = 0, diverged = 0, ok = 0;
const rows = [];

for (let i = 0; i < N; i++) {
  const genome = createRandomGenome(rngFrom('gate', 'l1', i));
  const plan = morphogenesis(genome);
  const sim = createSimulation(RAPIER, plan, genome, WORLD, {
    drive: DRIVE.POSITION, bounded, ...(motorScale !== undefined ? { motorScale } : {}),
  });

  let history = [];
  let result = 'ok', atStep = STEPS, detail = '';
  try {
    for (let s = 0; s < STEPS; s++) {
      const pr = probe(sim);
      history.push(pr);
      if (history.length > 4) history.shift();
      if (pr.bad) { result = 'NaN'; atStep = s; detail = `body ${pr.bad.body}`; break; }
      sim.step();
    }
  } catch (e) {
    result = 'PANIC'; atStep = sim.steps; detail = String(e.message || e).slice(0, 60);
  }

  const last = history[history.length - 1] || { maxSpeed: 0, maxSpin: 0, maxPos: 0 };
  if (result === 'PANIC') panics++; else if (result === 'NaN') diverged++; else ok++;

  rows.push({
    i, bodies: plan.bodyCount, joints: plan.jointCount,
    fits: sim.fitsTank ? 'y' : 'n', result, atStep,
    speed: last.maxSpeed, spin: last.maxSpin, pos: last.maxPos, detail,
    trail: history.map(h => `${h.maxSpeed.toFixed(1)}/${h.maxSpin.toFixed(1)}`).join(' '),
  });
  if (result !== 'ok') {
    console.log(`  #${i} ${result} @${atStep} bodies=${plan.bodyCount} fits=${sim.fitsTank ? 'y' : 'n'} ` +
      `| last 4 steps (speed/spin): ${rows[rows.length - 1].trail} ${detail}`);
  } else if (verbose) {
    console.log(`  #${i} ok  bodies=${plan.bodyCount} speed=${last.maxSpeed.toFixed(2)} spin=${last.maxSpin.toFixed(2)}`);
  }
  try { sim.free(); } catch {}
}

console.log(`\n  bounded=${bounded} motorScale=${motorScale ?? 'default'} steps=${STEPS}`);
console.log(`  ${ok}/${N} survived · ${panics} rapier panics · ${diverged} reached non-finite state`);
const worst = rows.filter(r => r.result === 'ok').sort((a, b) => b.spin - a.spin)[0];
if (worst) console.log(`  worst survivor: #${worst.i} spin=${worst.spin.toFixed(1)} rad/s speed=${worst.speed.toFixed(1)} m/s`);
