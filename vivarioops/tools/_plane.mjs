// WHICH PLANE DOES turnBias ACTUALLY STEER IN?
//
// _orient.mjs found real authority (total turn 4 -> 41 deg/s as |turnBias| goes
// 0 -> 1) but essentially zero YAW. So the turn exists and is not horizontal.
//
// Mechanism, from the code: a 'revolute' joint rotates about the limb's local X
// (jointAxisAtSpawn takes j.axes.x), so a uniform bias bends a Z-axial chain in
// the Y-Z plane — it PITCHES. But turnSides() decides which side a joint is on
// from `bodies[child].position[0] - rootX`, the lateral offset along X — the
// same axis the joint rotates ABOUT. And every pursuit controller, here and in
// duel.js, reduces the bearing to the xz plane, i.e. to YAW.
//
// So the control input actuates one plane and the feedback measures another.
// This measures the SIGNED turn about each world axis, and then runs pursuit in
// the plane the creature actually turns in.
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

function serpent({ segs = 12, taper = 0.95, lag = Math.PI/2, amp = 0.8, omega = 4.0 } = {}) {
  return { version: GENOME_V, seed: 0, rootNodeId: 'seg',
    nodes: [{ id:'seg', dims:[0.5,0.35,1.2], density:1, recursiveLimit:segs,
      joint:{type:'revolute', angleLimits:[0.9,0.9,0.9], phaseLag:lag},
      colorGenes:{hueShift:.5,valueShift:0,patternPhase:0} }],
    connections: [{ id:'c_self', parentNodeId:'seg', childNodeId:'seg', parentFace:5,
      position:[0,0], orientation:[0,0,0], scale:[taper,taper,taper],
      reflectX:false, reflectY:false, reflectZ:false, terminalOnly:false }],
    material:{hueShift:.5,valueShift:0,patternPhase:0},
    controller:{omega, preyGain:0, threatGain:0, jointGenes:{seg:{amplitude:amp,bias:0,freqMult:1}}},
    social:{} };
}

/** Signed turn rate of the velocity direction, projected into each plane. */
function planes(genome, opts, turnBias, SEC = 20) {
  const plan = morphogenesis(genome);
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded:false, turnBias, ...opts }); }
  catch (e) { return { err: e.message }; }
  const STEPS = Math.round(SEC / FIXED_DT);
  const marks = []; let prev = sim.centreOfMass(), bad = false;
  try {
    for (let s = 0; s < STEPS; s++) {
      sim.step();
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0]+c[1]+c[2])) { bad = true; break; }
      if (s % 120 === 0) marks.push([...c]);
      prev = c;
    }
  } catch { bad = true; }
  sim.free();
  if (bad || marks.length < 5) return { err: 'diverged' };
  // heading within each coordinate plane; PAIRS: [a,b] means atan2(b,a)
  const PAIRS = { 'yaw   (x,z)': [0,2], 'pitch (z,y)': [2,1], 'roll  (x,y)': [0,1] };
  const out = {};
  for (const [name, [a,b]] of Object.entries(PAIRS)) {
    const h = [];
    for (let i = 1; i < marks.length; i++) {
      const da = marks[i][a]-marks[i-1][a], db = marks[i][b]-marks[i-1][b];
      if (Math.hypot(da,db) > 1e-4) h.push(Math.atan2(db,da));
    }
    let t = 0, k = 0;
    for (let i = 1; i < h.length; i++) { t += wrap(h[i]-h[i-1]); k++; }
    out[name] = k ? t/k*D : NaN;
  }
  return out;
}

const BIAS = [-1,-0.5,-0.25,0,0.25,0.5,1];
const CFG = [['solver budget',{motor:'solver'}], ['solver 10Hz',{motor:'solver',motorFreqHz:10}]];
const g = serpent();
console.log('\n=== SIGNED turn rate per plane, deg/s, 12-seg chain ===\n');
console.log('  actuator        plane          ' + BIAS.map(b=>String(b).padStart(8)).join('') + '  monotone?');
for (const [label,opts] of CFG) {
  const rs = BIAS.map(b => planes(g,opts,b));
  if (rs.some(r=>r.err)) { console.log(`  ${label}: ${rs.find(r=>r.err).err}`); continue; }
  for (const name of Object.keys(rs[0])) {
    const v = rs.map(r=>r[name]);
    let up=true,down=true;
    for (let i=1;i<v.length;i++){ if(v[i]<v[i-1])up=false; if(v[i]>v[i-1])down=false; }
    console.log(`  ${label.padEnd(15)} ${name}  ` + v.map(x=>x.toFixed(1).padStart(8)).join('') + `  ${up||down?'YES':'no'}`);
  }
  console.log('');
}

// ── pursuit, in the plane the creature actually turns in ────────────────────
function pursue(genome, opts, plane, sign, TARGET_R = 6, SEC = 60, kp = 2/Math.PI) {
  const [a,b] = plane;
  const plan = morphogenesis(genome);
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded:false, ...opts }); }
  catch (e) { return { err: e.message }; }
  const STEPS = Math.round(SEC/FIXED_DT);
  const c0 = sim.centreOfMass();
  const target = [...c0]; target[a] += TARGET_R;      // 90 deg off the initial heading
  let best = TARGET_R, bad = false, prev = c0, va = 0, vb = 0;
  try {
    for (let s = 0; s < STEPS; s++) {
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0]+c[1]+c[2])) { bad = true; break; }
      va = 0.98*va + 0.02*(c[a]-prev[a]); vb = 0.98*vb + 0.02*(c[b]-prev[b]);
      const ta = target[a]-c[a], tb = target[b]-c[b];
      if (Math.hypot(va,vb) > 1e-7 && Math.hypot(ta,tb) > 1e-4) {
        const bearing = wrap(Math.atan2(tb,ta) - Math.atan2(vb,va));
        sim.control.turnBias = Math.max(-1, Math.min(1, sign*kp*bearing));
      }
      prev = c;
      const d = Math.hypot(target[0]-c[0], target[1]-c[1], target[2]-c[2]);
      if (d < best) best = d;
      sim.step();
    }
  } catch { bad = true; }
  sim.free();
  return bad ? { err:'diverged' } : { best };
}

console.log('=== CLOSED LOOP, feedback taken in each plane, target 6 m, 60 s ===\n');
console.log('  actuator         plane          sign   closest m   reached <1 m?');
for (const [label,opts] of CFG) {
  for (const [pname,pair] of [['yaw   (x,z)',[0,2]], ['pitch (z,y)',[2,1]]]) {
    for (const sign of [1,-1]) {
      const r = pursue(g,opts,pair,sign);
      if (r.err) { console.log(`  ${label.padEnd(15)}  ${pname}  ${String(sign).padStart(4)}   ${r.err}`); continue; }
      console.log(`  ${label.padEnd(15)}  ${pname}  ${String(sign).padStart(4)}   ${r.best.toFixed(2).padStart(8)}    ${r.best<1?'YES':'no'}`);
    }
  }
}
console.log('');
