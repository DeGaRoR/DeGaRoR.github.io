#!/usr/bin/env node
// fleet_spots.js - THE FLEET'S TIE-DOWN SPOTS on Jolene, printed (G2223, FLEET-PROPS A): every runway's ordered spots
// (25_airfield.js fleetSpots off the census's world: tools/_taxiclear_lib.js), what each refused, and the census's
// independent check (GATE TAXICLEAR 10) - its failing rows first.
//   node tools/fleet_spots.js [--json out.json] [--all]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const txt = fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8');
const WI = IN.islandWorld('jolene', { premises: txt });
const SH = L.islandObstacles(C, 'jolene', 'town').concat(L.treeTrunks(WI)).concat(L.registryObstacles(WI));
const IX = L.index(SH);
const VB = L.BUILDS.map(B => { const def = C.buildGen(PT.specOf(B.key).spec); return Object.assign({}, B, { def, dims: L.buildDims(C, def) }); });
const foots = {}; for (const k in C.GP_PARKED_FOOT) { const f = C.GP_PARKED_FOOT[k]; foots[k] = { half: f[0], fwd: f[1], aft: f[2] }; }
foots.default = { half: C.GP_PARKED_DEFAULT[0], fwd: C.GP_PARKED_DEFAULT[1], aft: C.GP_PARKED_DEFAULT[2] };
const t0 = Date.now(), SC = L.spotCensus(C, WI, IX, VB, foots);
for (const p of SC.per) {
  console.log(p.id.padEnd(9) + String(p.n).padStart(3) + ' spots ' + p.kinds.padEnd(13) + ' refused ' + JSON.stringify(p.why));
  for (const s of p.spots) console.log('    ' + s.id.padEnd(22) + ' (' + s.x.toFixed(1) + ', ' + s.z.toFixed(1) + ') ry ' + s.ry.toFixed(3) + '  box ' + s.half.toFixed(2) + ' x ' + s.fwd.toFixed(2) + ' / ' + s.aft.toFixed(2));
}
const bad = SC.rows.filter(r => !r.ok);
console.log(SC.rows.length + ' census rows, ' + bad.length + ' failing, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
for (const r of (process.argv.includes('--all') ? SC.rows : bad).slice(0, 40)) console.log('  ' + (r.ok ? 'ok   ' : 'FAIL ') + r.id + ' ' + r.spot + ' [' + r.foot + '] ' + r.what + ' ' + (r.d != null ? r.d.toFixed(2) : '') + (r.need != null ? ' / ' + r.need.toFixed(2) : '') + ' ' + r.near);
const j = process.argv.indexOf('--json');
if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify({ per: SC.per, bad }, null, 1));
