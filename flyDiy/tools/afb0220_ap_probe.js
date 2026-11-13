// afb0220_ap_probe.js - JOLENE 02/20 (AFB-0220): does the autopilot land on the CENTRAL BAND? (43_pilot.js untouched)
//   node tools/afb0220_ap_probe.js [build: gen | arch:<key>] [from: w2]
// Flies the pilot's own circuit off w2 (makePilot + setRoute(w2, w2), as tools/circuit_harness.js does; the composed island, and reads where
// the wheels first touch, the CG's lateral offset from the band's centreline from then to the stop, and how much of the
// roll a main wheel spent off the 15 m band (the band's half width less the build's half track).
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
require(path.join(T, 'pilot_trace.js')).loadPanel();   // (the cage's globals: an archetype's design bake needs them, as GATE HITBOX loads them)
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const which = process.argv[2] || 'gen', from = process.argv[3] || 'w2', dest = process.argv[4] || from;   // (dest: land there, flown off `from`)
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(process.env.FIX || path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const a0 = W.aerodromes.find(q => q.id === from), a = W.aerodromes.find(q => q.id === dest);
const d = [Math.cos(a.hdg), Math.sin(a.hdg)], nrm = [-d[1], d[0]];
const lat = (x, z) => (x - a.x) * nrm[0] + (z - a.z) * nrm[1], alongOf = (x, z) => (x - a.x) * d[0] + (z - a.z) * d[1];
let build;
if (which === 'gen') build = () => C.buildGen();
else { const D = require(path.join(T, '_cage_design.js')), A = D.ARCHETYPES.find(q => q.key === which.replace(/^arch:/, '')); if (!A) throw new Error('no archetype ' + which); build = () => C.buildGen(D.designBake(A.sel, A.over)); }
let td = null, latPeak = 0, latMax = 0, offBand = 0, rollN = 0, phases = [];
const def = build(), sim = C.makeSim(def, W);
sim.reset(0); C.placeAtAerodrome(sim, a0);
for (let i = 0; i < 4 * 60; i++) sim.step(1 / 60);
const ap = C.makePilot(sim, def, W); ap.setRoute(a0, a);   // a circuit off `from` back onto it, or off `from` to `dest` (the harness's own calls)
for (let s0 = 0; s0 < 480 * 60; s0++) {
  ap.update(1 / 60); sim.step(1 / 60);
  if (sim.stats().bad) { console.log('NaN at ' + (s0 / 60).toFixed(1) + ' s, ' + ap.phase); break; }
  const c = sim.cgPos(), ph = ap.phase;
  if (phases[phases.length - 1] !== ph) phases.push(ph);
  const air = phases.some(p => /APPROACH|FINAL|FLARE|LAND/.test(p));
  const wog = sim.wheelsOnGround ? sim.wheelsOnGround() : 0;
  if (air && !td && wog > 0) td = { lat: lat(c[0], c[2]), along: alongOf(c[0], c[2]), ph, t: s0 / 60 };
  if (td && ph !== 'STOPPED') { const v = lat(c[0], c[2]); if (Math.abs(v) > Math.abs(latPeak)) latPeak = v; latMax = Math.max(latMax, Math.abs(v)); rollN++; if (Math.abs(v) > a.wid / 2 - 1.2) offBand++; }
  if (ph === 'STOPPED' && td) break;
}
console.log('AFB0220 AP PROBE ' + which + ' off ' + from + ' onto ' + dest + ' (' + a.name + ', ' + a.wid + ' m wide): phases ' + phases.join(' > '));
console.log('  touchdown: ' + (td ? 'lateral ' + td.lat.toFixed(2) + ' m, ' + td.along.toFixed(0) + ' m from the centre (phase ' + td.ph + ')' : 'none'));
console.log('  the roll: the CG at most ' + latMax.toFixed(2) + ' m off the centreline (peak ' + latPeak.toFixed(2) + ', + west); ' + (rollN ? (100 * offBand / rollN).toFixed(1) : '0') + ' % of it within 1.2 m of the band\'s edge');
{ const Dm = sim.damage ? sim.damage() : null; console.log('  damage: ' + (Dm ? (Dm.crashed ? 'CRASHED (' + Dm.reason + ')' : 'none crashed') + ', ' + Dm.broken.length + ' members broken' : 'n/a')); }
console.log('  verdict: ' + (td && Math.abs(td.lat) < a.wid / 2 - 1.2 && latMax < a.wid / 2 - 1.2 && phases.includes('STOPPED') && !(sim.damage && sim.damage().crashed) ? 'ON ' + dest + '\'S CENTRELINE (' + (dest === 'w2' ? 'the central band' : 'its own strip') + ')' : 'OFF / NOT STOPPED'));
