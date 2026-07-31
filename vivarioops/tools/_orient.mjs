// CAN A BODY THAT ACTUALLY SWIMS BE AIMED?
//
// Session 9 measured 3% monotone steering and 0/30 pursuit, and concluded
// "steering is downstream of gait coherence — a static differential deflection
// can only rotate a velocity vector that already exists". Session 10 produced a
// velocity vector: a 12-segment chain at efficiency 0.93. So the conclusion is
// now testable rather than merely plausible.
//
// Three questions, in order of how much they cost to answer:
//
//   1. AUTHORITY. Does turnBias produce a yaw rate at all, and is it ordered?
//      Yaw rate rather than net heading: a creature swimming a circle has a
//      constant yaw rate, which is the thing a pursuit controller integrates.
//   2. SIGN. Does +turnBias turn the same way the pursuit controller assumes?
//      A sign error looks exactly like "cannot steer", and tools/_aim.mjs
//      assumes a convention it never checks.
//   3. CLOSED LOOP. Set turnBias from the bearing to a target every step. Does
//      it close?
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import { GENOME_V } from '../contracts/versions.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const W = { ...W1_SLICE, gravity: 0 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const D = 180 / Math.PI;

/** The straight chain from _wave.mjs: self-connected on +Z, the growth face. */
function serpent({ segs = 12, dims = [0.5, 0.35, 1.2], taper = 0.95,
                   lag = Math.PI / 2, amp = 0.8, omega = 4.0 } = {}) {
  return {
    version: GENOME_V, seed: 0, rootNodeId: 'seg',
    nodes: [{
      id: 'seg', dims, density: 1, recursiveLimit: segs,
      joint: { type: 'revolute', angleLimits: [0.9, 0.9, 0.9], phaseLag: lag },
      colorGenes: { hueShift: 0.5, valueShift: 0, patternPhase: 0 },
    }],
    connections: [{
      id: 'c_self', parentNodeId: 'seg', childNodeId: 'seg', parentFace: 5,
      position: [0, 0], orientation: [0, 0, 0], scale: [taper, taper, taper],
      reflectX: false, reflectY: false, reflectZ: false, terminalOnly: false,
    }],
    material: { hueShift: 0.5, valueShift: 0, patternPhase: 0 },
    controller: { omega, preyGain: 0, threatGain: 0, jointGenes: { seg: { amplitude: amp, bias: 0, freqMult: 1 } } },
    social: {},
  };
}

const CONFIGS = [
  ['pd', { motor: 'pd' }],
  ['solver budget', { motor: 'solver' }],
  ['solver 10Hz', { motor: 'solver', motorFreqHz: 10 }],
  ['solver 25Hz', { motor: 'solver', motorFreqHz: 25 }],
];

/**
 * Swim at a fixed turnBias. Returns the mean YAW RATE of the velocity direction
 * in the horizontal plane, plus speed and efficiency, sampled over whole
 * seconds so the within-stroke wobble averages out.
 */
function openLoop(genome, opts, turnBias, SEC = 20) {
  const plan = morphogenesis(genome);
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, turnBias, ...opts }); }
  catch (e) { return { err: e.message }; }
  const STEPS = Math.round(SEC / FIXED_DT), HZ = 120;
  const marks = []; let prev = sim.centreOfMass(), path = 0, bad = false;
  const c0 = prev;
  try {
    for (let s = 0; s < STEPS; s++) {
      sim.step();
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      path += Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]);
      prev = c;
      if (s % HZ === 0) marks.push([...c]);
    }
  } catch { bad = true; }
  const c1 = sim.centreOfMass(); sim.free();
  if (bad || marks.length < 5) return { err: 'diverged' };
  // FULL 3-D heading. The xz projection only sees YAW; a chain whose joints
  // rotate about their local X swings in the Y-Z plane and turns in PITCH,
  // which an xz heading cannot see at all.
  const v = [];
  for (let i = 1; i < marks.length; i++) {
    const d = [marks[i][0]-marks[i-1][0], marks[i][1]-marks[i-1][1], marks[i][2]-marks[i-1][2]];
    const n = Math.hypot(...d);
    if (n > 1e-4) v.push([d[0]/n, d[1]/n, d[2]/n]);
  }
  let turn = 0, k = 0, ax = [0,0,0];
  const heads = [];
  for (let i = 1; i < marks.length; i++) {
    const dx = marks[i][0]-marks[i-1][0], dz = marks[i][2]-marks[i-1][2];
    if (Math.hypot(dx,dz) > 1e-4) heads.push(Math.atan2(dz,dx));
  }
  let yaw = 0, ky = 0;
  for (let i = 1; i < heads.length; i++) { yaw += wrap(heads[i]-heads[i-1]); ky++; }
  for (let i = 1; i < v.length; i++) {
    const a = v[i-1], b = v[i];
    const c = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const dot = Math.min(1, Math.max(-1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));
    turn += Math.acos(dot); k++;
    ax[0]+=c[0]; ax[1]+=c[1]; ax[2]+=c[2];
  }
  const an = Math.hypot(...ax) || 1;
  const net = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
  return {
    turn3d: k ? turn / k : NaN,         // TOTAL turn rate, any plane, rad/s
    yaw: ky ? yaw / ky : NaN,           // horizontal component only
    axis: [ax[0]/an, ax[1]/an, ax[2]/an],
    net: net / SEC, eff: net / Math.max(path, 1e-9),
  };
}

const BIAS = [-1, -0.5, -0.25, 0, 0.25, 0.5, 1];
console.log('\n=== 1 & 2. OPEN LOOP: TOTAL turn rate (any plane) against turnBias, 12-seg chain, omega 4, lag pi/2 ===\n');
console.log('  actuator          ' + BIAS.map(b => String(b).padStart(7)).join('') + '   monotone?');
console.log('                    ' + BIAS.map(() => '  deg/s').join(' ') + '');
const g = serpent();
const usable = [];
for (const [label, opts] of CONFIGS) {
  const rs = BIAS.map(b => openLoop(g, opts, b));
  if (rs.some(r => r.err)) { console.log(`  ${label.padEnd(18)} ${rs.find(r => r.err).err}`); continue; }
  const y = rs.map(r => r.turn3d * D);
  let up = true, down = true;
  for (let i = 1; i < y.length; i++) { if (y[i] < y[i - 1]) up = false; if (y[i] > y[i - 1]) down = false; }
  const mono = up ? 'yes (+)' : down ? 'yes (-)' : 'NO';
  console.log(`  ${label.padEnd(18)}` + y.map(v => v.toFixed(1).padStart(7)).join('') + `   ${mono}`);
  console.log(`    yaw only        ` + rs.map(r => (r.yaw*D).toFixed(1).padStart(7)).join(''));
  console.log(`    turn axis .y    ` + rs.map(r => r.axis[1].toFixed(2).padStart(7)).join(''));
  console.log(`    net m/s         ` + rs.map(r => r.net.toFixed(3).padStart(7)).join(''));
  console.log(`    efficiency      ` + rs.map(r => r.eff.toFixed(3).padStart(7)).join(''));
  if (mono !== 'NO') usable.push([label, opts, up ? 1 : -1]);
}

// ── 3. closed-loop pursuit ──────────────────────────────────────────────────
function pursue(genome, opts, sign, TARGET_R = 6, SEC = 40, kp = 2 / Math.PI) {
  const plan = morphogenesis(genome);
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...opts }); }
  catch (e) { return { err: e.message }; }
  const STEPS = Math.round(SEC / FIXED_DT);
  const c0 = sim.centreOfMass();
  // target placed 90 degrees off the initial heading so the run REQUIRES a turn
  const target = [c0[0] + TARGET_R, c0[1], c0[2]];
  let best = TARGET_R, bad = false, prev = c0, vx = 0, vz = 0;
  try {
    for (let s = 0; s < STEPS; s++) {
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      // low-passed velocity direction — the raw per-step one is stroke wobble
      vx = 0.98 * vx + 0.02 * (c[0] - prev[0]); vz = 0.98 * vz + 0.02 * (c[2] - prev[2]);
      const tx = target[0] - c[0], tz = target[2] - c[2];
      if (Math.hypot(vx, vz) > 1e-7 && Math.hypot(tx, tz) > 1e-4) {
        const bearing = wrap(Math.atan2(tz, tx) - Math.atan2(vz, vx));
        sim.control.turnBias = Math.max(-1, Math.min(1, sign * kp * bearing));
      }
      prev = c;
      const d = Math.hypot(target[0] - c[0], target[1] - c[1], target[2] - c[2]);
      if (d < best) best = d;
      sim.step();
    }
  } catch { bad = true; }
  sim.free();
  if (bad) return { err: 'diverged' };
  return { best, closed: TARGET_R - best };
}

console.log('\n=== 3. CLOSED LOOP: pursuit of a target 6 m away, 40 s ===\n');
console.log('  actuator            sign   closest m   closed m   reached <1 m?');
for (const [label, opts] of CONFIGS) {
  for (const sign of [1, -1]) {
    const r = pursue(g, opts, sign);
    if (r.err) { console.log(`  ${label.padEnd(18)}  ${String(sign).padStart(4)}   ${r.err}`); continue; }
    console.log(`  ${label.padEnd(18)}  ${String(sign).padStart(4)}   ${r.best.toFixed(2).padStart(8)}   ${r.closed.toFixed(2).padStart(7)}    ${r.best < 1 ? 'YES' : 'no'}`);
  }
}
console.log('');
