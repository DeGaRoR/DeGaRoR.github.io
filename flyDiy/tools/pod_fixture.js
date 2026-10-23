#!/usr/bin/env node
// G3462 (BELLY-POD-2): THE USER'S CESSNA WITH A POD - writes tools/fixtures/cessnaMetal_pod_2026-10-22.json: the user's
// metal Cessna (the validated 'metal' build AS THE GAME FLIES IT - tools/_load_build.js, the page's own load chain; GATE
// JOINPARITY's rule) with a belly pod sized the way the garage
// editor sizes one (genPodFromVolume: a 200 L hold at shape 0.5 on this aeroplane's own station table), and prints its
// sheet's pod rows (clearance, drag, the take-off / climb / cruise penalty). The build file itself is untouched.
//   node tools/pod_fixture.js [--write]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js'));
const OUT = 'tools/fixtures/cessnaMetal_pod_2026-10-22.json';
const LITRES = 200, SHAPE = 0.5;
const VB = require('./_load_build.js').loadValidated('metal');
const env = { name: VB.name || 'cessnaMetal', spec: VB.spec };
const spec = C.genMigrateSpec(JSON.parse(JSON.stringify(env.spec)));
const d0 = C.buildGen(JSON.parse(JSON.stringify(spec)));
const v = C.genPodFromVolume(spec, d0.parts.ST, LITRES, SHAPE);
const pod = { on: 1, len: v.len, width: v.width, depth: v.depth };
const out = Object.assign({}, env, { name: (env.name || 'cessnaMetal') + ' + belly pod', spec: Object.assign({}, env.spec, { pod }) });
const d = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(out.spec)))), sh = C.genShakedown(d, { corners: false }), p = sh.pod;
const kt = x => (x * 1.943844).toFixed(1), fpm = x => (x * 196.85).toFixed(0);
console.log('the user\'s metal Cessna + a ' + LITRES + ' L pod (shape ' + SHAPE + '): ' + pod.len + ' x ' + pod.width + ' x ' + pod.depth + ' m, hold ' + p.litres.toFixed(0) + ' L, rated ' + p.maxKg + ' kg, shell ' + p.shellKg.toFixed(1) + ' kg, ' + p.price + ' cr');
console.log('  clearance: ' + p.clearance.rows.map(r => r.name + ' ' + r.clear.toFixed(3) + ' m').join(' | ') + (p.clearance.ok ? ' -> fits' : ' -> REFUSED'));
console.log('  drag area ' + p.cda.toFixed(4) + ' m2 (' + (p.dragShare * 100).toFixed(1) + ' % of the body)');
const q = p.perf;
console.log('  take-off ' + q.toWithout + ' -> ' + q.toWith + ' m (' + (q.dTO >= 0 ? '+' : '') + q.dTO + ') | climb ' + fpm(q.climbWithout) + ' -> ' + fpm(q.climbWith) + ' ft/min (' + fpm(q.dClimb) + ') | cruise ' + kt(q.cruiseWithout) + ' -> ' + kt(q.cruiseWith) + ' KTAS (' + kt(q.dCruise) + ', ' + (q.dCruise / q.cruiseWithout * 100).toFixed(1) + ' %)');
if (process.argv.includes('--write')) { fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(out, null, 1) + '\n'); console.log('wrote ' + OUT); }
