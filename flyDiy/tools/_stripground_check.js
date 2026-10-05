#!/usr/bin/env node
// _stripground_check.js — GATE STRIPGROUND (REVIEW 2026-10-04, finding A5): every generated land strip of the analytic
// world stands on the ground its record says. The strip probe (24_world_aero.js) sampled the centreline at eleven
// points and a river fitted between two of them: seed 0's A2 "Pelham Field" has 5.4 m of trench and water across its
// centreline under a record that says elev 24.4. This walks every centreline at 2 m and holds |elev - terrainH| under
// TOL and no water over the ground. Verdict contract: one final `GATE STRIPGROUND: PASS|FAIL`, exit code to match.
// NOT REGISTERED in run_gates.js yet: it is RED on master until A5 is fixed (the probe sampled densely, carved beds
// rejected); register it as core when it is - it costs two seconds.
const C = require('./flight_core.js');
const TOL = 0.5;                                        // the grading's own tolerance, generous
const W = C.makeWorld();
const fails = [];
for (const a of W.aerodromes) {
  if (a.kind === 'meadow' || a.kind === 'water' || a.premises) continue;
  const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
  let worst = 0, wT = 0, wet = 0;
  for (let t = -a.len / 2; t <= a.len / 2; t += 2) {
    const x = a.x + ux * t, z = a.z + uz * t, h = W.terrainH(x, z);
    const d = Math.abs(h - a.elev); if (d > worst) { worst = d; wT = t; }
    if (W.waterH(x, z) > h + 0.05) wet++;
  }
  const ok = worst < TOL && wet === 0;
  console.log(`${ok ? 'ok ' : 'BAD'} ${a.id.padEnd(5)} ${String(a.kind).padEnd(7)} hdg ${(a.hdg * 57.3).toFixed(0).padStart(4)} len ${String(a.len).padStart(5)}  |elev-terrainH| max ${worst.toFixed(2)} m at t ${wT}, wet samples ${wet}`);
  if (!ok) fails.push(`${a.id} ground ${worst.toFixed(2)} m / wet ${wet}`);
}
if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log(fails.length ? 'GATE STRIPGROUND: FAIL' : 'GATE STRIPGROUND: PASS');
process.exitCode = fails.length ? 1 : 0;
