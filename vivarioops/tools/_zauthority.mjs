// tools/_zauthority.mjs — THROWAWAY. Re-derive TURN_AUTHORITY (C5.1).
//
// turnBias and TURN_AUTHORITY multiply, so sweeping turnBias at TURN_AUTHORITY=1
// IS an effective-authority sweep. For each authority measure the COHERENT
// steering response (the C0.1 headingVec, differenced across +/-bias, so the
// intrinsic drift cancels) and straightness. The plan predicts the response peaks
// near 0.5 and straightness collapses beyond it: at full authority the steering
// term is the whole joint range, the joint pins, and the gait stops.
//
//   node tools/_zauthority.mjs [nRandom] [seconds]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { runSolo, turn3d, straightness, comSpeed } from '../engine/l2/probe.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 6);
const T = Number(process.argv[3] ?? 14);
await RAPIER.init();
const DEG = 180 / Math.PI;
const AUTH = [0.125, 0.25, 0.5, 0.75, 1.0];
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

function head(genome, plan, bias) {
  const r = runSolo(RAPIER, { plan, genome, world: W1_SLICE, gravity: 0, bounded: false, wrap: true, duration: T, turnBias: bias });
  if (!r.valid) return null;
  return { hv: turn3d(r.trace, 0, r.trace.n).headingVec, straight: straightness(r.trace, 0, r.trace.n, false), speed: comSpeed(r.trace, 0, r.trace.n) };
}

const subs = [];
for (const sd of SEEDS) { if (sd.id === 'staircase') continue; const g = sd.genome ?? sd; try { subs.push({ id: sd.id, genome: g, plan: morphogenesis(g) }); } catch {} }
let n = 0;
for (let i = 0; n < N; i++) { const g = createRandomGenome(rngFrom('auth', i)); let p; try { p = morphogenesis(g); } catch { continue; } if (p.jointCount < 2) continue; subs.push({ id: `r${i}`, genome: g, plan: p }); n++; }

// drift floor: coherent "response" at bias 0 (should be small; it is the intrinsic wander)
const drift = [];
for (const s of subs) { const h = head(s.genome, s.plan, 0); if (h) drift.push(Math.hypot(...h.hv) * DEG); }

console.log(`\n  _zauthority · ${T}s · coherent steering response (deg/s) and straightness by effective authority\n`);
console.log('  authority   response   straightness   comSpeed   SNR (resp/drift)');
const driftFloor = median(drift);
for (const a of AUTH) {
  const resp = [], straight = [], spd = [];
  for (const s of subs) {
    const p = head(s.genome, s.plan, +a), m = head(s.genome, s.plan, -a);
    if (p && m) {
      resp.push(Math.hypot(p.hv[0] - m.hv[0], p.hv[1] - m.hv[1], p.hv[2] - m.hv[2]) / 2 * DEG);
      straight.push(p.straight); spd.push(p.speed);
    }
  }
  const r = median(resp), st = median(straight), sp = median(spd);
  console.log(`  ${a.toFixed(3).padStart(8)}   ${r.toFixed(2).padStart(8)}   ${st.toFixed(3).padStart(12)}   ${sp.toFixed(3).padStart(8)}   ${(r / (driftFloor || 1)).toFixed(1).padStart(6)}`);
}
console.log(`\n  drift floor (bias 0, median): ${driftFloor.toFixed(2)} deg/s`);
console.log('  pick the authority that maximises response x straightness (plan: ~0.5). SNR must cross 1.\n');
