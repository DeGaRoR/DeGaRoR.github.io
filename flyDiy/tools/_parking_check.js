#!/usr/bin/env node
// _parking_check.js - GATE PARKING (PARKING-AREA, the user 13 Nov: "parking = an AREA, a polygon or a circle, sized in the
// editor; the parked planes fill it. No hand-dropped single spots"). 25_airfield.js fleetSpots fills a field's parking areas
// (a paved polygon whose draw says `parking`) FIRST: a grid in the area's own lanes (its yaw), nearest the stand first, every
// spot through the fleet's rules. Held here on Jolene's own HOME, off the island world (tools/island_node.js):
//   1 an area with `parking` gets spots of kind 'park', every corner inside it, before any apron or row spot
//   2 `parking.max` caps them; the field's FLEET_SPOT.max still caps the whole list
//   3 the same area WITHOUT `parking` gets none (the painted-stands path untouched)
//   4 a circle area (a 24-gon) fills the same way - its grid clipped to the circle by the corner rule
//   5 the pieces: 27_premises carries `parking` onto the paved polygon, the cook's paveOf hands it on, the editor has its row
//   node tools/_parking_check.js   -> "GATE PARKING: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const a = W.aerodromes.find(q => q.id === 'HOME'), s = C.siteOf('HOME');
const st = s.stand;
// a 44 x 30 m rectangle 60 m behind HOME's stand, along the runway's heading (on the flat pad)
const R = C.siteRunway ? C.siteRunway(a) : null;
const dx = R ? R.dx : Math.cos(a.hdg), dz = R ? R.dz : Math.sin(a.hdg), nx = -dz, nz = dx;
const cx = st.x - nx * 60, cz = st.z - nz * 60;
const rect = (hl, hw) => [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => [cx + dx * u + nx * v, cz + dz * u + nz * v]);
const yaw = Math.atan2(dz, dx);
const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const ground = (x, z) => W.terrainH(x, z);
const run = pave => C.fleetSpots(a, s, { pave, ground });
const P1 = rect(22, 15);
const r1 = run([{ id: 'pk1', poly: P1, yaw, parking: {} }]);
const park1 = r1.spots.filter(q => q.kind === 'park');
ok(park1.length >= 3, '1 an area with parking fills with park spots', park1.length + ' of ' + r1.spots.length);
ok(r1.spots.slice(0, park1.length).every(q => q.kind === 'park'), '1 the area\'s spots come first, before any apron or row spot');
ok(park1.every(q => C.fleetSpotPts(q, 1e9).every(p => inPoly(P1, p[0], p[1]))), '1 every park spot\'s four corners inside the area');
const r2 = run([{ id: 'pk1', poly: P1, yaw, parking: { max: 2 } }]);
ok(r2.spots.filter(q => q.kind === 'park').length === 2 && r2.spots.length <= C.FLEET_SPOT.max, '2 parking.max caps the area (2), the field\'s max the list');
const r3 = run([{ id: 'pk1', poly: P1, yaw, stands: null }]);
ok(!r3.spots.some(q => q.kind === 'park'), '3 the same area without parking: no park spot');
const circ = []; for (let i = 0; i < 24; i++) { const t = i / 24 * 2 * Math.PI; circ.push([cx + 20 * Math.cos(t), cz + 20 * Math.sin(t)]); }
const r4 = run([{ id: 'pk2', poly: circ, yaw, parking: {} }]);
const park4 = r4.spots.filter(q => q.kind === 'park');
ok(park4.length >= 1 && park4.every(q => C.fleetSpotPts(q, 1e9).every(p => inPoly(circ, p[0], p[1]))), '4 a circle area (24-gon, r 20 m) fills, every corner inside the circle', park4.length);
const P27 = fs.readFileSync(path.join(ROOT, 'src', 'core', '27_premises.js'), 'utf8');
const A25 = fs.readFileSync(path.join(ROOT, 'src', 'core', '25_airfield.js'), 'utf8');
const LIB = fs.readFileSync(path.join(T, '_taxiclear_lib.js'), 'utf8');
const UI = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'premises_ui.js'), 'utf8');
ok(/parking: m\.parking && typeof m\.parking === 'object' \? m\.parking : null/.test(P27), '5 27_premises carries `parking` onto the paved polygon');
ok(/filter\(p => p && p\.poly && \(p\.stands \|\| p\.parking\)/.test(A25), '5 fleetField takes a parking area as its own');
ok(/filter\(p => p\.stands \|\| p\.parking\)/.test(LIB) && /parking: p\.parking \|\| null/.test(LIB), '5 the cook (paveOf) hands parking on to fleetSpots');
ok(/rows\.check\(insp, 'parked aeroplanes fill it'/.test(UI), '5 the editor\'s draw section has the parking row');
console.log('GATE PARKING: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
