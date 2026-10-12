#!/usr/bin/env node
// G2840 CERT-SLIM: the garage tests' wall time, headless, before/after.
//
//   node tools/perf/g2840_bench_time.js [--reps=3] [--no-rigs] [--json=out.json] [--core=path/flight_core.js]
//
// Per validated aeroplane (the Cub, the Jodel, the Cessna):
//   shake    genShakedown(def, { corners: false })  - the bench check's sheet (+ G2640's design check)
//   dalt     genDensityAlt(def)                      - the hot-and-high sheet (merged into the bench check by G2840)
//   load     the sandbag rig ticked to its verdict   - wall in node, and the SIM seconds the page watches in real time
//   xwind    genCrosswindLimit(def)                  - the crosswind ladder (cut from the bench by G2840)
// The bench check's cost is shake + dalt (min over --reps, fresh def each rep); "run the tests" before G2840 was
// bench check + wing loading + density altitude + crosswind (+ the flight), after it is the bench check (+ the flight).
// Reads tools/flight_core.js: build first (node tools/build.js) on the tree being measured. CPU: book the lock.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const BJ = require(path.join(ROOT, 'tools', '_bake_joined.js'));
BJ.loadPanel();
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const C = require(path.resolve(arg('core', path.join(ROOT, 'tools', 'flight_core.js'))));   // --core=<a built flight_core.js>: time another tree's core on the same joined specs
const REPS = +arg('reps', 3), RIGS = !process.argv.includes('--no-rigs'), OUT = arg('json', null);
const rd = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec || j; };
const AC = [['cub', 'builds/cub_2026-09-20_corrected.json'], ['jodel', 'builds/jodel_2026-09-20_corrected.json'],
            ['cessna', 'bugReports/cessnaMetal (1).json']];
const now = () => Number(process.hrtime.bigint()) / 1e6;
const res = { when: new Date().toISOString(), node: process.version, reps: REPS, ac: {} };
for (const [id, f] of AC) {
  const J = BJ.bakeJoined(rd(f)).spec;
  const r = { shake: Infinity, dalt: Infinity };
  let da = null;
  for (let k = 0; k < REPS; k++) {
    const def = C.buildGen(JSON.parse(JSON.stringify(J)));
    let t = now(); C.genShakedown(def, { corners: false }); r.shake = Math.min(r.shake, now() - t);
    t = now(); da = C.genDensityAlt(def); r.dalt = Math.min(r.dalt, now() - t);
  }
  r.bench = r.shake + r.dalt;
  r.ceil = da ? { service: da.serviceCeiling, abs: da.absCeiling, hotTO: da.cases[1].TORun, hotClimb: da.cases[1].climbRate } : null;
  if (RIGS) {
    const def = C.buildGen(JSON.parse(JSON.stringify(J)));
    const sim = C.makeSim(def, null); sim.reset(0);
    const rig = C.makeLoadTest(sim, def, { material: J.fuselage && J.fuselage.material,
                                           wingMaterial: typeof C.genSurfKey === 'function' ? C.genSurfKey(J, 'wing', 0) : undefined });
    let t = now(), n = 0;
    if (rig.state.ok) for (; n < 60 * 120 && !rig.state.done; n++) rig.step(1 / 60);
    r.load = { wall: now() - t, simS: n / 60, verdict: rig.state.verdict };
    t = now();
    let X = null;
    try { X = C.genCrosswindLimit(def); } catch (e) { X = { error: e.message }; }
    r.xwind = { wall: now() - t, limit: X && X.limit, runs: X && X.runs ? X.runs.length : null };
  }
  res.ac[id] = r;
  console.log(id.padEnd(7) + ' shake ' + r.shake.toFixed(0) + ' ms · dalt ' + r.dalt.toFixed(0) + ' ms · bench check ' + r.bench.toFixed(0) + ' ms'
    + (r.ceil ? ' · ceiling ' + (r.ceil.service == null ? '>cap' : r.ceil.service.toFixed(1)) + ' / ' + (r.ceil.abs == null ? '>cap' : r.ceil.abs.toFixed(1)) + ' m' : '')
    + (r.load ? ' · load ' + r.load.wall.toFixed(0) + ' ms wall, ' + r.load.simS.toFixed(1) + ' s sim (' + r.load.verdict + ')' : '')
    + (r.xwind ? ' · xwind ' + r.xwind.wall.toFixed(0) + ' ms (' + r.xwind.limit + ' m/s)' : ''));
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
