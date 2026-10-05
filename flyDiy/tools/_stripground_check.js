#!/usr/bin/env node
// _stripground_check.js — GATE STRIPGROUND (REVIEW 2026-10-04, finding A5): every generated land strip of the analytic
// world stands on the ground its record says. The strip probe (24_world_aero.js) sampled the centreline at eleven
// points and a river fitted between two of them: seed 0's A2 "Pelham Field" had 5.4 m of trench and water across its
// centreline under a record that said elev 24.4 (and seeds 1, 2, 3, 7, 12345 each had one or two such fields). This
// walks every strip at 2 m down its centreline AND both edges and holds |elev - terrainH| under TOL and no water over
// the ground, on seed 0 (the validated world) and three procedural seeds.
// Verdict contract: one final `GATE STRIPGROUND: PASS|FAIL`, exit code to match.
// REGISTERED (core) with G1560 WORLD-STRIPS: the probe walks every winning candidate at 4 m on the centreline and the
// graded flat's edges and refuses one over a carved bed or water (moving the field when no candidate is clean).
const C = require('./flight_core.js');
const TOL = 0.5;                                        // the grading's own tolerance, generous
const SEEDS = [0, 1, 2, 3];
const fails = [];
let n = 0;
for (const seed of SEEDS) {
  const W = C.makeWorld(seed);
  for (const a of W.aerodromes) {
    if (a.kind === 'meadow' || a.kind === 'water' || a.premises) continue;
    const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
    let worst = 0, wT = 0, wV = 0, wet = 0;
    for (const v of [0, -a.wid / 2, a.wid / 2]) for (let t = -a.len / 2; t <= a.len / 2; t += 2) {
      const x = a.x + ux * t - uz * v, z = a.z + uz * t + ux * v, h = W.terrainH(x, z);
      const d = Math.abs(h - a.elev); if (d > worst) { worst = d; wT = t; wV = v; }
      if (W.waterH(x, z) > h + 0.05) wet++;
    }
    const ok = worst < TOL && wet === 0;
    n++;
    console.log(`${ok ? 'ok ' : 'BAD'} seed ${String(seed).padEnd(2)} ${a.id.padEnd(5)} ${String(a.kind).padEnd(5)} hdg ${(a.hdg * 57.3).toFixed(0).padStart(4)} len ${String(a.len).padStart(5)}  |elev-terrainH| max ${worst.toFixed(2)} m at t ${wT} v ${wV}, wet samples ${wet}  ${a.name}`);
    if (!ok) fails.push(`seed ${seed} ${a.id} ${a.name} ground ${worst.toFixed(2)} m / wet ${wet}`);
  }
}
console.log(`${n} strips on seeds ${SEEDS.join(', ')}`);
if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log(fails.length ? 'GATE STRIPGROUND: FAIL' : 'GATE STRIPGROUND: PASS');
process.exitCode = fails.length ? 1 : 0;
