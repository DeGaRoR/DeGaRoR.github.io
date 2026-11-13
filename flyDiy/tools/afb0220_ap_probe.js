// afb0220_ap_probe.js - JOLENE 02/20 (AFB-0220): does the autopilot land on the CENTRAL BAND? (43_pilot.js untouched)
//   node tools/afb0220_ap_probe.js [build: gen | arch:<key>] [from: w2]
// Flies the pilot's own circuit off w2 (makePilot + setRoute(w2, w2), as tools/circuit_harness.js does; the composed island, and reads where
// the wheels first touch, the CG's lateral offset from the band's centreline from then to the stop, and how much of the
// roll a main wheel spent off the 15 m band (the band's half width less the build's half track).
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const which = process.argv[2] || 'gen', from = process.argv[3] || 'w2';
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const a = W.aerodromes.find(q => q.id === from);
const d = [Math.cos(a.hdg), Math.sin(a.hdg)], nrm = [-d[1], d[0]];
const lat = (x, z) => (x - a.x) * nrm[0] + (z - a.z) * nrm[1], alongOf = (x, z) => (x - a.x) * d[0] + (z - a.z) * d[1];
let build;
if (which === 'gen') build = () => C.buildGen();
else { const D = require(path.join(T, '_cage_design.js')); build = () => C.buildGen(D.ARCHETYPES[which.replace(/^arch:/, '')].spec || D.ARCHETYPES[which.replace(/^arch:/, '')]); }
let td = null, latMax = 0, offBand = 0, rollN = 0, phases = [];
const def = build(), sim = C.makeSim(def, W);
sim.reset(0); C.placeAtAerodrome(sim, a);
for (let i = 0; i < 4 * 60; i++) sim.step(1 / 60);
const ap = C.makePilot(sim, def, W); ap.setRoute(a, a);   // a circuit: off w2, back onto w2 (the harness's own calls)
for (let s0 = 0; s0 < 480 * 60; s0++) {
  ap.update(1 / 60); sim.step(1 / 60);
  if (sim.stats().bad) { console.log('NaN at ' + (s0 / 60).toFixed(1) + ' s, ' + ap.phase); break; }
  const c = sim.cgPos(), ph = ap.phase;
  if (phases[phases.length - 1] !== ph) phases.push(ph);
  const air = phases.some(p => /APPROACH|FINAL|FLARE|LAND/.test(p));
  const wog = sim.wheelsOnGround ? sim.wheelsOnGround() : 0;
  if (air && !td && wog > 0) td = { lat: lat(c[0], c[2]), along: alongOf(c[0], c[2]), ph, t: s0 / 60 };
  if (td && ph !== 'STOPPED') { const v = lat(c[0], c[2]); latMax = Math.max(latMax, Math.abs(v)); rollN++; if (Math.abs(v) > a.wid / 2 - 1.2) offBand++; }
  if (ph === 'STOPPED' && td) break;
}
console.log('AFB0220 AP PROBE ' + which + ' at ' + from + ' (' + a.name + ', ' + a.wid + ' m wide): phases ' + phases.join(' > '));
console.log('  touchdown: ' + (td ? 'lateral ' + td.lat.toFixed(2) + ' m, ' + td.along.toFixed(0) + ' m from the centre (phase ' + td.ph + ')' : 'none'));
console.log('  the roll: the CG at most ' + latMax.toFixed(2) + ' m off the centreline; ' + (rollN ? (100 * offBand / rollN).toFixed(1) : '0') + ' % of it within 1.2 m of the band\'s edge');
console.log('  verdict: ' + (td && Math.abs(td.lat) < a.wid / 2 - 1.2 && latMax < a.wid / 2 - 1.2 && phases.includes('STOPPED') ? 'ON ' + from + '\'S CENTRELINE (' + (from === 'w2' ? 'the central band' : 'its own strip') + ')' : 'OFF / NOT STOPPED'));
