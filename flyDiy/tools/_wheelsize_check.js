#!/usr/bin/env node
// GATE WHEELSIZE (SNOW-MUD, 2026-11-15) — IN MUD A SMALL WHEEL STRUGGLES, A BIG ONE ROLLS.
//
// The user (15 Nov): "for the mud, there I would expect small wheels to struggle more than large wheels, would that be right?
// Maybe we can test that too". The law says so (00_registry groundSinkWheel: in the rigid regime the drag goes as
// sqrt(z / D), and a smaller, narrower or harder tyre sinks deeper - load over footprint); this flies it. The Cub (list:1, as
// the game loads it) with its main wheels changed and nothing else: gear.wheelR 0.15, 0.22 (as built), 0.30 on the standard
// carcass, and 0.36 on the TUNDRA carcass (cage.whProfile 1: wider, softer). No pilot: full power from rest, the heading held,
// the stick neutral, to 0.9 Vs within 60 s and 1100 m, on grass (the control), firm mud (11) and soft mud (12).
//
//   node tools/_wheelsize_check.js          -> "GATE WHEELSIZE: PASS|FAIL" and the table
//
// THE MEASURE is the MUD'S PENALTY - the time to 0.9 Vs on mud over the same wheels' on grass - not the distance: a bigger
// wheel costs a little on grass too (its drag and its mass: the control row shows it), and what the mud does is the question.
// A. ON SOFT MUD the penalty falls as the wheel grows (0.15 > 0.22 > 0.30 > tundra 0.36), and the smallest wheel is STUCK.
// B. THE SINKAGE at rest on soft mud falls as the wheel grows (8 cm on the 0.15 m wheel, under 1 cm on the tundra).
// C. ON FIRM MUD the penalty never grows with the wheel (small everywhere: firm mud is every wheel's ground).
// D. THE CONTROL: on grass the wheels' runs stay within 25 % of one another (the size is not what grass is about).
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js')), LB = require(path.join(__dirname, '_load_build.js'));
const base = LB.loadBuild(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json')).spec;
const WHEELS = [{ nm: '0.15 m standard', r: 0.15, prof: 0 }, { nm: '0.22 m standard (as built)', r: 0.22, prof: 0 },
                { nm: '0.30 m standard', r: 0.30, prof: 0 }, { nm: '0.36 m tundra', r: 0.36, prof: 1 }];
function run(w, sc) {
  const s = JSON.parse(JSON.stringify(base));
  s.gear = Object.assign({}, s.gear, { wheelR: w.r }); s.cage = Object.assign({}, s.cage, { whProfile: w.prof });
  const d = C.buildGen(s), Vs = d.params.gen.Vs, sim = C.makeSim(d, { terrainH: () => 0, surface: () => sc, treesNear: () => [] });
  sim.reset(0); for (let i = 0; i < 300; i++) sim.step(1 / 60);
  const R = d.refs, P = sim.p, hdg = () => Math.atan2((P[R.mains[0] * 3 + 2] + P[R.mains[1] * 3 + 2]) / 2 - P[R.tw * 3 + 2], (P[R.mains[0] * 3] + P[R.mains[1] * 3]) / 2 - P[R.tw * 3]);
  const h0 = hdg(), p0 = sim.cgPos(), sink = sim.out.softW ? (sim.out.softW[0] + sim.out.softW[1]) / 2 : 0;
  sim.ctl.thr = 1; let t = 0, dist = null, Vm = 0;
  for (; t < 60; t += 1 / 60) {
    let e = hdg() - h0; e = Math.atan2(Math.sin(e), Math.cos(e)); sim.ctl.dr = Math.max(-1, Math.min(1, 4 * e)); sim.step(1 / 60);
    Vm = Math.max(Vm, sim.out.V);
    const p = sim.cgPos(), dd = Math.hypot(p[0] - p0[0], p[2] - p0[2]);
    if (dd > 1100) break;
    if (sim.out.V > 0.9 * Vs) { dist = dd; break; }
  }
  return { r: d.nodes[R.mains[0]].r, sink, dist, t: dist == null ? null : t, Vm };
}
const t0 = Date.now(), fail = [], yes = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); };
const T = WHEELS.map(w => ({ w, g: run(w, 0), f: run(w, 11), s: run(w, 12) }));
const cell = q => q.dist == null ? ('STUCK at ' + q.Vm.toFixed(1) + ' m/s').padEnd(18) : (Math.round(q.dist) + ' m ' + q.t.toFixed(1) + ' s').padEnd(18);
const pen = (q, g) => q.t == null || g.t == null ? Infinity : q.t / g.t;
console.log('  the Cub (list:1), its main wheels changed; full power from rest to 0.9 Vs (m, s); the mud\'s penalty = time on mud / time on grass');
console.log('  ' + 'main wheels'.padEnd(28) + 'grass'.padEnd(18) + 'firm mud'.padEnd(18) + 'soft mud'.padEnd(20) + 'penalty firm / soft   sinkage on soft mud');
for (const q of T) console.log('  ' + q.w.nm.padEnd(28) + cell(q.g) + cell(q.f) + cell(q.s) + '  ' + ('x' + pen(q.f, q.g).toFixed(2) + ' / ' + (isFinite(pen(q.s, q.g)) ? 'x' + pen(q.s, q.g).toFixed(2) : 'STUCK')).padEnd(22) + (q.s.sink * 100).toFixed(1) + ' cm');
// A
yes(T[0].s.dist == null, 'A the smallest wheel (0.15 m) is STUCK in soft mud', cell(T[0].s));
for (let k = 1; k + 1 < T.length; k++) yes(pen(T[k + 1].s, T[k + 1].g) < pen(T[k].s, T[k].g), 'A on soft mud the ' + T[k + 1].w.nm + ' pays less than the ' + T[k].w.nm, 'x' + pen(T[k + 1].s, T[k + 1].g).toFixed(2) + ' vs x' + pen(T[k].s, T[k].g).toFixed(2));
// B
for (let k = 0; k + 1 < T.length; k++) yes(T[k + 1].s.sink < T[k].s.sink, 'B the ' + T[k + 1].w.nm + ' sinks less than the ' + T[k].w.nm, (T[k + 1].s.sink * 100).toFixed(1) + ' vs ' + (T[k].s.sink * 100).toFixed(1) + ' cm');
// C
for (let k = 0; k + 1 < T.length; k++) yes(pen(T[k + 1].f, T[k + 1].g) <= pen(T[k].f, T[k].g) + 0.01, 'C on firm mud the ' + T[k + 1].w.nm + '\'s penalty is no bigger than the ' + T[k].w.nm + '\'s', 'x' + pen(T[k + 1].f, T[k + 1].g).toFixed(3) + ' vs x' + pen(T[k].f, T[k].g).toFixed(3));
yes(T.every(q => pen(q.f, q.g) < 1.15), 'C firm mud is every wheel\'s ground (penalty under x1.15)');
// D
const gs = T.map(q => q.g.dist).filter(v => v != null);
yes(gs.length === T.length && Math.max(...gs) <= 1.25 * Math.min(...gs), 'D the control: on grass the runs within 25 % of one another', gs.map(Math.round).join(' / '));
for (const f of fail) console.log('  FAIL ' + f);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
console.log('GATE WHEELSIZE: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
