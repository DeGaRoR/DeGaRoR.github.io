// node mnpiv.js <flyDiy> <endSign +1|-1> <distFromEnd> [to]
'use strict';
const path = require('path'), fs = require('fs');
const T = path.join(process.argv[2], 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const txt = fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8');
const WI = IN.islandWorld('jolene', { premises: txt });
const SH = L.islandObstacles(C, 'jolene', 'town').concat(L.treeTrunks(WI)).concat(L.registryObstacles(WI));
const IX = L.index(SH);
const a = WI.aerodromes.find(q => q.id === 'mn_strip'), site = C.siteOf('mn_strip');
L.intoWorld(C, WI, SH, a.x, a.z, 600);
const to = WI.aerodromes.find(q => q.id === (process.argv[5] || 'w2'));
const def = C.buildGen(PT.specOf(path.join(process.argv[2], 'builds', 'cub_2026-09-20_corrected.json')).spec);
const sg = +process.argv[3], dEnd = +process.argv[4];
const ux = Math.cos(a.hdg) * sg, uz = Math.sin(a.hdg) * sg;
const pose = { x: a.x + ux * (a.len / 2 - dEnd), z: a.z + uz * (a.len / 2 - dEnd), hdg: Math.atan2(uz, ux) };
const sim = C.makeSim(def, WI); sim.reset(0); if (sim.stance) sim.stance();
C.placeAtLineup(sim, a, pose, WI, def.refs);
for (let i = 0; i < 300; i++) sim.step(1 / 60);
const ap = C.makePilot(sim, def, WI); ap.setRoute(a, to); ap.departFrom(a, to, site);
const half = def.params.gen.span / 2;
let minW = Infinity, at = '', last = '', contacts = 0;
const ax = Math.cos(a.hdg), az = Math.sin(a.hdg);
console.log('end z', (a.z + az * a.len / 2 * sg).toFixed(0), 'pose', pose.x.toFixed(0), pose.z.toFixed(0));
for (let k = 0; k < 60 * 150; k++) {
  ap.update(1 / 60); sim.step(1 / 60);
  const cg = sim.cgPos(), rx = cg[0] - a.x, rz = cg[2] - a.z, al = rx * ax + rz * az, cr = -rx * az + rz * ax;
  if (ap.phase !== last || k % 120 === 0) { console.log((k / 60).toFixed(1), ap.phase, 'al', al.toFixed(1), 'cr', cr.toFixed(1), 'piv', ap.dbg && ap.dbg.piv != null ? 'Y' : '-', 'pathI', ap.path ? ap.pathI + '/' + ap.path.pts.length : '-'); last = ap.phase; }
  if (k % 6 === 0) {
    const zR = sim.axes()[2], rl = Math.hypot(zR[0], zR[2]) || 1;
    for (let f = -1; f <= 1.0001; f += 0.1) { const x = cg[0] + zR[0] / rl * half * f, z = cg[2] + zR[2] / rl * half * f, n = IX.nearest(x, z, 20); if (n && n.d < minW) { minW = n.d; at = L.fmtWhat(n.s) + ' al ' + al.toFixed(0) + ' cr ' + cr.toFixed(1) + ' ' + ap.phase; } }
    const q = L.nodesInside(C, WI, sim); contacts += q.k;
  }
  if (ap.phase === 'CLIMB' || ap.phase === 'ABORT') break;
}
const D = sim.damage ? sim.damage() : null;
console.log('minWing', minW.toFixed(2), at, 'contacts', contacts, 'crashed', !!(D && D.crashed), ap.report.verdicts.map(v => v.code + ':' + v.note).join(' | '));
