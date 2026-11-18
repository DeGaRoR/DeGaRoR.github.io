#!/usr/bin/env node
// GATE SLOPE (TOW-LAUNCH, 2026-11-12) - THE GROUND PUSHES ALONG ITS NORMAL: a slope pulls an aeroplane downhill.
//
//   node tools/_slope_check.js            -> "GATE SLOPE: PASS|FAIL"
//   node tools/_slope_check.js --show     -> every run's table
//
// The bug (the user: "a real nasty bug ... everything should roll"): the contact pushed every node straight up and its
// friction lived in the horizontal plane, so the motorglider set down on Skyline Altiport (tw_ski, ~9 % grass) never
// moved, and pushed to 4.4 m/s it slowed at g Crr (0.47 m/s2) as on flat ground. 30_solver.js now reads the terrain's
// normal (GROUND_SLOPE_D), pushes along it, lays the friction in the tangent plane and holds a wheel under 0.2 m/s up
// to its Coulomb limit (THE HOLD). The motorglider archetype on Jolene's island, engine off, at tw_ski:
//   1 THE FREE ROLL: released from rest facing downhill on ~9 % grass it rolls, and its acceleration over 2-10 s is
//     g (sin t - Crr cos t) (grass Crr 0.05, the grade under the CG along the track) within 5 %
//   2 THE PUSH UPHILL: pushed uphill at 4.4 m/s it slows at g (sin t + Crr cos t) within 5 %, stops, and rolls back
//   3 THE HOLD UNDER Crr: parked, no brake, on a grade of ~3 % (under grass Crr 0.05) it stays where it stands
//     (under 2 cm in 8 s)
//   4 THE BRAKES: parked on the ~9 % grade with the brakes on it holds (under 3 cm in 8 s); 1 is the same place without
//   5 ACROSS THE SLOPE: parked across the ~9 % grade, no brake, the tyres' side grip holds it (under 3 cm in 8 s)
// Flat ground is master's to the bit (a contact whose difference is exactly zero takes the old lines): proved by the
// branch's bit-compare (HANDOVER TOW-LAUNCH SLOPE), held in the battery by every flat-HOME gate's own pins.
// ~1 min (the island loaded once, five runs of 8-12 s).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const DS = require(path.join(T, '_cage_design.js'));
const SHOW = process.argv.includes('--show');

const F = [], lines = [];
const ok = (cond, label, info) => { lines.push((cond ? '  ok   ' : '  FAIL ') + label + (info ? ' - ' + info : '')); if (!cond) F.push(label); };

const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
if (!W) { console.log('GATE SLOPE: FAIL (the island world did not load)'); process.exit(1); }
const A = DS.ARCHETYPES.find(x => x.key === 'motorglider');
const def = C.buildGen(DS.designBake(A.sel, A.over));
const alt = W.aerodromes.find(a => a.id === 'tw_ski');
const ux = Math.cos(alt.hdg), uz = Math.sin(alt.hdg);
const G = 9.81, CRR = C.GROUND_SURF[0][0];
// the grade along the strip (+ uphill toward +s), at a station s of the strip's axis
const gradeAt = (x, z, dx, dz) => (W.terrainH(x + dx * 2, z + dz * 2) - W.terrainH(x - dx * 2, z - dz * 2)) / 4;
const stationOf = want => { let best = null; for (let s = -alt.len / 2 + 20; s <= alt.len / 2 - 20; s += 1) {
  const g = gradeAt(alt.x + ux * s, alt.z + uz * s, ux, uz); if (!best || Math.abs(g - want) < Math.abs(best.g - want)) best = { s, g }; } return best; };
const steep = { s: alt.len / 2 - 180, g: gradeAt(alt.x + ux * (alt.len / 2 - 180), alt.z + uz * (alt.len / 2 - 180), ux, uz) };
const mild = stationOf(0.03);

// one run: placed at station s, nose along `hdg`, engine off; opt.brake, opt.push (m/s along the nose, at t = 0)
function run(s, hdg, T_, opt) {
  const o = opt || {};
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtLineup(sim, alt, { x: alt.x + ux * s, z: alt.z + uz * s, hdg }, W, def.refs);
  for (let i = 0; i < (sim.nEng || 4); i++) try { sim.setEngine(i, { key: 'off' }); } catch (e) {}
  sim.ctl.thr = 0; sim.ctl.brake = o.brake || 0;
  const fx = Math.cos(hdg), fz = Math.sin(hdg);
  if (o.push) { const gr = gradeAt(sim.cgPos()[0], sim.cgPos()[2], fx, fz); for (let i = 0; i < sim.n; i++) { sim.v[i * 3] += fx * o.push; sim.v[i * 3 + 1] += gr * o.push; sim.v[i * 3 + 2] += fz * o.push; } }
  const rows = [], dt = 1 / 60;
  for (let fr = 0; fr <= T_ * 60; fr++) {
    if (fr % 30 === 0) { const cg = sim.cgPos(), cv = sim.cgVel(); rows.push({ t: fr * dt, x: cg[0], z: cg[2], vAl: cv[0] * fx + cv[2] * fz, g: gradeAt(cg[0], cg[2], fx, fz), nan: !isFinite(cg[0] + cg[1] + cg[2]) }); }
    if (fr < T_ * 60) sim.step(dt);
  }
  if (SHOW) for (const r of rows) console.log('    t ' + r.t.toFixed(1) + ' vAlong ' + r.vAl.toFixed(3) + ' grade(nose +up) ' + (r.g * 100).toFixed(2) + ' %');
  return rows;
}
const at = (rows, t) => rows.reduce((b, r) => Math.abs(r.t - t) < Math.abs(b.t - t) ? r : b);
const drift = (rows, t0, t1) => { const a = at(rows, t0), b = at(rows, t1); return Math.hypot(b.x - a.x, b.z - a.z); };
// the slope's law over [t0, t1] along the nose: g (sin t - Crr cos t) downhill (sign: -grade is downhill ahead)
const lawOf = (rows, t0, t1, sgn) => { const rs = rows.filter(r => r.t >= t0 - 1e-9 && r.t <= t1 + 1e-9); const gr = -rs.reduce((q, r) => q + r.g, 0) / rs.length;
  const c = 1 / Math.sqrt(1 + gr * gr); return G * (gr * c + sgn * CRR * c); };
const accel = (rows, t0, t1) => (at(rows, t1).vAl - at(rows, t0).vAl) / (t1 - t0);
const pct = (a, b) => (100 * (a - b) / b).toFixed(1) + ' %';

console.log('SLOPE: the motorglider (' + def.nodes.length + ' nodes) at ' + alt.id + ', grass Crr ' + CRR + '; steep station s ' + steep.s + ' grade ' + (steep.g * 100).toFixed(2) + ' %, mild station s ' + mild.s + ' grade ' + (mild.g * 100).toFixed(2) + ' %');
ok(steep.g > 0.07 && mild.g > 0.02 && mild.g < CRR - 0.01, '0 the stations: a steep one over Crr and a mild one under it', 'steep ' + (steep.g * 100).toFixed(2) + ' %, mild ' + (mild.g * 100).toFixed(2) + ' %');

// 1 THE FREE ROLL (the nose downhill: hdg + PI)
{ if (SHOW) console.log('  1 the free roll'); const R = run(steep.s, alt.hdg + Math.PI, 10);
  const a = accel(R, 2, 10), e = lawOf(R, 2, 10, -1);
  ok(!R.some(r => r.nan) && Math.abs(a - e) <= 0.05 * Math.abs(e) && drift(R, 0, 10) > 10, '1 the free roll on ~9 % grass: a = g (sin - Crr cos)', 'a ' + a.toFixed(3) + ' m/s2, the law ' + e.toFixed(3) + ' (' + pct(a, e) + '), ' + drift(R, 0, 10).toFixed(1) + ' m in 10 s'); }
// 2 THE PUSH UPHILL (the nose uphill: hdg)
{ if (SHOW) console.log('  2 the push uphill'); const R = run(steep.s, alt.hdg, 8, { push: 4.4 });
  // (uphill: the grade ahead is +, the law -g (sin + Crr cos) = lawOf's with the sign of Crr turned)
  const a = accel(R, 0.5, 2.5), e = lawOf(R, 0.5, 2.5, -1);
  ok(Math.abs(a - e) <= 0.05 * Math.abs(e), '2 pushed uphill at 4.4 m/s it slows at g (sin + Crr cos)', 'a ' + a.toFixed(3) + ' m/s2, the law ' + e.toFixed(3) + ' (' + pct(a, e) + ')');
  const back = at(R, 8).vAl;
  ok(back < -0.3, '2 it stops and rolls back down', 'vAlong at 8 s ' + back.toFixed(2) + ' m/s'); }
// 3 THE HOLD UNDER Crr (no brake, ~3 %, the nose downhill)
{ if (SHOW) console.log('  3 the hold under Crr'); const R = run(mild.s, alt.hdg + Math.PI, 10);
  const d = drift(R, 2, 10); ok(d < 0.02, '3 parked on ' + (mild.g * 100).toFixed(1) + ' % (under Crr), no brake: it stays', (d * 100).toFixed(2) + ' cm in 2-10 s (' + (drift(R, 6, 10) * 100).toFixed(2) + ' cm in 6-10 s)'); }
// 4 THE BRAKES (~9 %, the nose downhill)
{ if (SHOW) console.log('  4 the brakes'); const R = run(steep.s, alt.hdg + Math.PI, 10, { brake: 1 });
  const d = drift(R, 2, 10); ok(d < 0.03, '4 parked on ~9 % with the brakes on: it holds', (d * 100).toFixed(2) + ' cm in 2-10 s (' + (drift(R, 6, 10) * 100).toFixed(2) + ' cm in 6-10 s)'); }
// 5 ACROSS THE SLOPE (~9 %, the nose across, no brake)
{ if (SHOW) console.log('  5 across the slope'); const R = run(steep.s, alt.hdg + Math.PI / 2, 10);
  const d = drift(R, 2, 10); ok(d < 0.03, '5 parked across ~9 %, no brake: the side grip holds', (d * 100).toFixed(2) + ' cm in 2-10 s (' + (drift(R, 6, 10) * 100).toFixed(2) + ' cm in 6-10 s)'); }

for (const l of lines) console.log(l);
console.log(lines.length + ' checks, ' + F.length + ' failed');
console.log('GATE SLOPE: ' + (F.length ? 'FAIL (' + F.length + ')' : 'PASS'));
process.exit(F.length ? 1 : 0);
