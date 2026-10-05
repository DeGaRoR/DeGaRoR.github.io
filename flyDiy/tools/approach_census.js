#!/usr/bin/env node
// approach_census.js - THE APPROACH CENSUS (ISLAND-TOUR, G1965): every land strip's final(s) and climb-out(s) against
// the ground, the woodland's trees and every cooked structure (tools/_approach_lib.js says how). Prints a table, the
// violations first.
//   node tools/approach_census.js [--island jolene] [--json]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const A = require(path.join(T, '_approach_lib.js'));
const argv = process.argv.slice(2);
const isl = (argv.find(a => a.startsWith('--island=')) || '--island=jolene').split('=')[1];
const W = IN.islandWorld(isl, { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_' + isl + '.json'), 'utf8') });
const OB = L.islandObstacles(C, isl, 'town');
const rows = [];
for (const a of W.aerodromes) {
  if (a.water || a.kind === 'water') continue;
  for (const k of A.landDirs(C, a)) rows.push(Object.assign({ what: 'approach k' + k }, A.censusDir(C, W, a, k, { obstacles: OB })));
  for (const t of A.takeoffDirs(C, a)) rows.push(Object.assign({ what: 'climb-out T' + t }, A.censusClimb(C, W, a, t, { obstacles: OB })));
}
if (argv.includes('--json')) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
for (const r of rows.sort((p, q) => (p.ok - q.ok))) {
  const w = r.worst;
  console.log((r.ok ? '  ok   ' : '  PEN  ') + r.id.padEnd(9) + r.what.padEnd(14) + ' 1:' + (1 / r.slope).toFixed(0) + ' to ' + r.reach + ' m, thr ' + r.thrH + ' m: worst ' +
    (w ? (w.p > 0 ? '+' : '') + w.p + ' m (' + w.what + ' at ' + w.d + ' m out, top ' + w.h + ')' : '-') +
    '; the pilot\'s 5.7 % final clears by ' + r.pilot.c + ' m (' + r.pilot.what + ' at ' + r.pilot.d + ' m)');
}
