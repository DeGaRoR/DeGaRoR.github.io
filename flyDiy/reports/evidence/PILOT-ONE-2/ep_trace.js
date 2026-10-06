// usage: node ep.js <flyDiy dir> [key] [fld] [tmax]
'use strict';
const path = require('path'), fs = require('fs');
const T = path.join(process.argv[2], 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const txt = fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8');
const world = IN.islandWorld('jolene', { premises: txt, rwyTrees: 'map' });
const key = process.argv[3] || 'cub', fld = process.argv[4] || 'nv_strip';
const def = C.buildGen(PT.specOf(key).spec);
const sim = C.makeSim(def, world); sim.reset(0);
const a = world.aerodromes.find(q => q.id === fld), site = C.siteOf(fld);
if (sim.stance) sim.stance(); C.placeAtStand(sim, a, site.stand);
for (let i = 0; i < 600; i++) sim.step(1 / 60);
const ap = C.makePilot(sim, def, world, { style: 'normal' });
ap.setRoute(a, a); ap.departFrom(a, a, site);
let last = '', out = [];
const R_OF = Tr => 0.7 * Tr.s + 0.12;
let contact = 0;
for (let k = 0; k < 60 * (+process.argv[5] || 800); k++) {
  ap.update(1 / 60); sim.step(1 / 60);
  if (ap.phase !== last) { const cg = sim.cgPos(); const m = ap._m || {}; console.log(ap.t.toFixed(1), ap.phase, 'cg', cg.map(q => q.toFixed(0)).join(','), 'V', (m.ias||0).toFixed(1), 'agl', (m.agl||0).toFixed(1), 'dbg s', ap.dbg && ap.dbg.s != null ? ap.dbg.s.toFixed(0) : '', 'z', ap.dbg && ap.dbg.z != null ? ap.dbg.z.toFixed(1):''); last = ap.phase; }
  if (k % 6 === 0) { const cg = sim.cgPos(); for (const ti of world.treesNear(cg[0], cg[2], out)) { const Tr = world.trees[ti], top = Tr.h + 4.6 * Tr.s; for (let i = 0; i < sim.n; i++) { if (sim.p[i*3+1] > top) continue; if (Math.hypot(sim.p[i*3]-Tr.x, sim.p[i*3+2]-Tr.z) - R_OF(Tr) <= 0) { contact++; break; } } } }
  if (ap.phase === 'STOPPED') break;
}
console.log('contacts', contact, 'outcome', ap.report.outcome, 'landing', JSON.stringify(ap.report.landing));
for (const v of ap.report.verdicts) console.log('  v', v.t, v.code, v.note);
console.log('appr', JSON.stringify(ap.report.appr));
