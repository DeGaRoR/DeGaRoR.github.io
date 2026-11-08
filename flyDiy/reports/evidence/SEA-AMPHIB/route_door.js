// SEA-AMPHIB: the route door (25_airfield stripGear / stripAllows) per float build - which ends the game lets each use.
//   node reports/evidence/SEA-AMPHIB/route_door.js
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..', '..'), T = path.join(R, 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js')), LB = require(path.join(T, '_load_build.js'));
const W = TR.tourWorld(C, IN, fs).W;
for (const [n, f] of [['Twin 4b', 'builds/candidates/Twin_busher_floats_4b.json'], ['PA-18 floats', 'builds/pa18_floats_2026-10-23.json'], ['Cessna floats', 'bugReports/cessnaFloatsWOrks.json'],
                      ['Cessna floats fltAmph 1', path.join(__dirname, 'cessna_floats_amph1.json')], ['Cessna floats fltAmph 2', path.join(__dirname, 'cessna_floats_amph2.json')], ['Super Petrel V4.1', 'builds/candidates/superpetrel_V4_1.json']]) {
  const g = LB.gameSpec(JSON.parse(fs.readFileSync(path.isAbsolute(f) ? f : path.join(R, f), 'utf8')));
  const ok = W.aerodromes.filter(a => C.stripAllows(g, a).ok).map(a => a.id), no = W.aerodromes.filter(a => !C.stripAllows(g, a).ok);
  console.log(n.padEnd(24) + ' stripGear ' + C.stripGear(g).padEnd(10) + ' may use ' + ok.join(',') + (no.length ? '  | refused ' + no.length + ' (e.g. ' + no[0].id + ': ' + C.stripAllows(g, no[0]).why + ')' : ''));
}
