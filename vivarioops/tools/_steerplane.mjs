// tools/_steerplane.mjs — THE MISSING QUANTITY: the creature's own steering plane.
//
// §72 named the repair and then said it could not be done: "have bearingTo work
// in the creature's own bend plane rather than in world xz — but 'the creature's
// bend plane' is not currently a quantity anything computes."
//
// It is computable, and cheaply, from a probe S3 already runs. S3 applies the
// bias in BOTH directions so that intrinsic curl cancels. Do the same thing to
// the ROTATION AXIS rather than to the rate:
//
//     axis(+bias) and axis(-bias) are opposite when the input steers
//     their difference, normalised, is the creature's own steering axis
//
// The plane perpendicular to that axis is the plane the creature turns in, and
// it is the only plane in which a bearing means anything to it. Measure the
// bearing there, feed it to the creature's own gains, and the loop is closed
// with the same code everywhere — no per-body convention, no assumption that
// anything is horizontal.
//
// This tool measures the axis, reports how well-defined it is, and then scores
// seeking three ways on the same creature: world yaw (what duel.js does today),
// the fixed bend plane (session 10b's guess), and the measured steering plane.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE, sensorTurnBias } from '../engine/l1/controller.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const W = { ...W1_SLICE, gravity: 0 };
const MOTOR = { motor: 'solver' };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const nrm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

/** Mean rotation axis of the velocity direction over a run at a fixed bias. */
function turnAxis(plan, genome, turnBias, SEC = 12) {
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
  sim.free();
  if (bad || marks.length < 4) return null;
  const v = [];
  for (let i = 1; i < marks.length; i++) {
    const d = [marks[i][0]-marks[i-1][0], marks[i][1]-marks[i-1][1], marks[i][2]-marks[i-1][2]];
    if (Math.hypot(...d) > 1e-5) v.push(nrm(d));
  }
  let ax = [0, 0, 0], rate = 0, k = 0;
  for (let i = 1; i < v.length; i++) {
    const c = cross(v[i-1], v[i]);
    ax = [ax[0]+c[0], ax[1]+c[1], ax[2]+c[2]];
    rate += Math.asin(Math.min(1, Math.hypot(...c))); k++;
  }
  if (!k) return null;
  const mag = Math.hypot(...ax);
  return { axis: nrm(ax), rate: rate / k * 2, coherence: mag / k, heading: v[v.length - 1] };
}

/**
 * THE STEERING AXIS. Half the difference of the two bias runs' axes, exactly as
 * S3 takes half the difference of their rates — intrinsic curl is common to
 * both and cancels, and what survives is the response to the input.
 *
 * `authority` is how much the axis actually reverses: 1 means the two runs turn
 * in exactly opposite senses (clean steering), 0 means the input changes nothing
 * about which way the creature curls (no steering, whatever the rate says).
 */
function steeringPlane(plan, genome) {
  const p = turnAxis(plan, genome, +1), m = turnAxis(plan, genome, -1);
  if (!p || !m) return null;
  const d = [p.axis[0]-m.axis[0], p.axis[1]-m.axis[1], p.axis[2]-m.axis[2]];
  const mag = Math.hypot(...d);
  return {
    axis: mag > 1e-6 ? nrm(d) : [0, 1, 0],
    authority: mag / 2,                       // 0 .. 1
    rate: Math.abs(p.rate - m.rate) / 2,
    heading: p.heading,
  };
}

/**
 * Seek, with the bearing measured in a chosen plane. `basis` is [u, v]: two
 * orthonormal world vectors spanning the plane the bearing lives in.
 */
function seek(plan, genome, basis, { R = 6, SEC = 30, gainOverride = null,
                                     bearings = [0, 60, 120, 180, 240, 300] } = {}) {
  const [U, V] = basis;
  const sc = [];
  for (const deg of bearings) {
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
        va = 0.98 * va + 0.02 * dot(dv, U); vb = 0.98 * vb + 0.02 * dot(dv, V);
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

/** Orthonormal basis of the plane perpendicular to `axis`. */
function planeOf(axis) {
  const seed = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = nrm(cross(axis, seed));
  return [u, nrm(cross(axis, u))];
}

const YAW = [[1, 0, 0], [0, 0, 1]];      // world xz — what duel.js uses today
const BEND = [[0, 0, 1], [0, 1, 0]];     // world zy — session 10b's fixed guess

const corpus = [];
for (const s of SEEDS) { try { corpus.push({ tag: s.id, g: s.genome, p: morphogenesis(s.genome) }); } catch {} }
const N = Number(process.argv[2] ?? 12);
for (let i = 0; corpus.length < SEEDS.length + N && i < N * 10; i++) {
  const g = createRandomGenome(rngFrom(0x57EE ^ (i * 2654435761)));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.jointCount >= 1) corpus.push({ tag: `rand${i}`, g, p });
}

console.log('\n=== THE MEASURED STEERING AXIS, and seeking in each plane ===\n');
console.log('  id            steering axis (x,y,z)   auth   rate   | benefit: yaw    bend   MEASURED');
const rows = [];
for (const { tag, g, p } of corpus) {
  const sp = steeringPlane(p, g);
  if (!sp) continue;
  const mine = planeOf(sp.axis);
  const b = (basis) => {
    const live = seek(p, g, basis), dead = seek(p, g, basis, { gainOverride: 0 });
    return (live === null || dead === null) ? NaN : live - dead;
  };
  const r = { tag, ...sp, byaw: b(YAW), bbend: b(BEND), bmine: b(mine) };
  rows.push(r);
  const ax = sp.axis.map((x) => x.toFixed(2).padStart(5)).join(',');
  console.log(`  ${tag.padEnd(12)}  ${ax}   ${sp.authority.toFixed(2)}   ${sp.rate.toFixed(3)}   | ${r.byaw.toFixed(3).padStart(7)} ${r.bbend.toFixed(3).padStart(7)} ${r.bmine.toFixed(3).padStart(9)}`);
}

const mean = (f) => { const v = rows.map(f).filter(Number.isFinite); return v.reduce((a, b) => a + b, 0) / v.length; };
const won = (f) => rows.filter((r) => Number.isFinite(f(r)) && f(r) > 0.02).length;
console.log('\n  MEAN SENSOR BENEFIT      yaw ' + mean((r) => r.byaw).toFixed(4)
          + '   bend ' + mean((r) => r.bbend).toFixed(4)
          + '   MEASURED ' + mean((r) => r.bmine).toFixed(4));
console.log(`  creatures the sensor helps (>0.02)   yaw ${won((r)=>r.byaw)}/${rows.length}   bend ${won((r)=>r.bbend)}/${rows.length}   MEASURED ${won((r)=>r.bmine)}/${rows.length}`);
const hi = rows.filter((r) => r.authority > 0.5);
if (hi.length) {
  console.log(`\n  restricted to authority > 0.5 (n=${hi.length}):`);
  const m2 = (f) => { const v = hi.map(f).filter(Number.isFinite); return v.reduce((a, b) => a + b, 0) / v.length; };
  console.log(`    mean benefit   yaw ${m2((r)=>r.byaw).toFixed(4)}   bend ${m2((r)=>r.bbend).toFixed(4)}   MEASURED ${m2((r)=>r.bmine).toFixed(4)}`);
}
console.log('');
