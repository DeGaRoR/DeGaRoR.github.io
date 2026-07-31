// CAN THEY AIM? Two questions, and only the second is what a duel needs.
//
//  1. MONOTONICITY. Sweeping turnBias -1..+1 must produce a SMOOTH, ORDERED
//     change of heading. A large response that is not ordered is chaos: the
//     creature is sensitive to the input but not steerable by it.
//  2. CLOSED LOOP. A pursuit controller sets turnBias from the bearing to a
//     target every step. Does the creature actually close on it?
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 12, STEPS = Math.round(SEC/FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const MOTOR = process.argv[2] ?? 'solver';
const corpus = [];
for (let i = 0; corpus.length < 30 && i < 250; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i*2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};

/** Final horizontal heading, radians, for a fixed turnBias. */
function heading(g, p, turn) {
  let sim; try { sim = createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,motor:MOTOR,turnBias:turn}); } catch { return null; }
  const c0 = sim.centreOfMass(); let bad = false;
  try { for (let s=0;s<STEPS;s++){ sim.step();
    const c = sim.centreOfMass(); if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;} } } catch { bad = true; }
  const c1 = sim.centreOfMass(); sim.free();
  if (bad) return null;
  const dx = c1[0]-c0[0], dz = c1[2]-c0[2];
  if (Math.hypot(dx,dz) < 1e-3) return null;
  return { ang: Math.atan2(dz, dx), dist: Math.hypot(dx, c1[1]-c0[1], dz) };
}
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// ── 1. monotonicity ─────────────────────────────────────────────────────────
const BIAS = [-1, -0.5, 0, 0.5, 1];
let mono = 0, tested = 0; const spans = [];
for (const { g, p } of corpus) {
  const hs = BIAS.map(b => heading(g, p, b));
  if (hs.some(h => !h)) continue;
  tested++;
  const rel = hs.map(h => wrap(h.ang - hs[2].ang));
  // ordered if the signed turn increases monotonically with turnBias
  let up = true, down = true;
  for (let i = 1; i < rel.length; i++) { if (rel[i] < rel[i-1]) up = false; if (rel[i] > rel[i-1]) down = false; }
  if (up || down) mono++;
  spans.push(Math.abs(wrap(hs[4].ang - hs[0].ang)) * 180/Math.PI);
}
console.log(`\nmotor='${MOTOR}', ${SEC}s, n=${tested}\n`);
console.log(`  1. MONOTONIC steering response: ${mono}/${tested} creatures (${(100*mono/Math.max(tested,1)).toFixed(0)}%)`);
console.log(`     heading span between turnBias -1 and +1:  p50 ${pct(spans,0.5).toFixed(0)} deg  p90 ${pct(spans,0.9).toFixed(0)} deg`);

// ── 2. closed-loop pursuit ──────────────────────────────────────────────────
const TARGET_R = 6;
let closed = 0, ran = 0; const gains = [];
for (const { g, p } of corpus) {
  let sim; try { sim = createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,motor:MOTOR}); } catch { continue; }
  const c0 = sim.centreOfMass();
  const target = [c0[0] + TARGET_R, c0[1], c0[2]];
  let bad = false, best = TARGET_R, prevC = c0;
  try {
    for (let s=0;s<STEPS;s++){
      const c = sim.centreOfMass();
      if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
      // bearing to target relative to current travel direction, in the xz plane
      const vx = c[0]-prevC[0], vz = c[2]-prevC[2];
      const tx = target[0]-c[0], tz = target[2]-c[2];
      if (Math.hypot(vx,vz) > 1e-5 && Math.hypot(tx,tz) > 1e-5) {
        const bearing = wrap(Math.atan2(tz,tx) - Math.atan2(vz,vx));
        sim.control.turnBias = Math.max(-1, Math.min(1, bearing / (Math.PI/2)));
      }
      prevC = c;
      const d = Math.hypot(target[0]-c[0], target[1]-c[1], target[2]-c[2]);
      if (d < best) best = d;
      sim.step();
    }
  } catch { bad = true; }
  sim.free(); if (bad) continue;
  ran++;
  gains.push(TARGET_R - best);
  if (best < 1.0) closed++;
}
console.log(`\n  2. CLOSED-LOOP pursuit to a target ${TARGET_R} m away, n=${ran}`);
console.log(`     reached within 1 m: ${closed}/${ran}`);
console.log(`     distance closed:  p50 ${pct(gains,0.5).toFixed(2)} m  p90 ${pct(gains,0.9).toFixed(2)} m  best ${Math.max(...gains).toFixed(2)} m  (of ${TARGET_R} m)`);
