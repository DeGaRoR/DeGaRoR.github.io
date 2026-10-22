// scratch: TAXICLEAR 11c, the Cub from Jumbo Mine's street 45 m from its south end, instrumented
'use strict';
const path = require('path'), fs = require('fs');
const T = path.join(process.env.FD || path.join(__dirname, '..', '..', '..'), 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const txt = fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8');
const WI = IN.islandWorld('jolene', { premises: txt });
const SH = L.islandObstacles(C, 'jolene', 'town').concat(L.treeTrunks(WI)).concat(L.registryObstacles(WI));
const IX = L.index(SH);
const land = WI.aerodromes.filter(q => !q.water && q.kind !== 'water');
const keep = SH.filter(s => land.some(q => Math.hypot(s.x - q.x, s.z - q.z) - (s.r || 0) < 700 + q.len / 2));
L.intoWorld(C, WI, keep, 0, 0, Infinity);
const bk = process.argv[2] || 'cub';
const file = { cub: path.join(T, '..', 'builds', 'cub_2026-09-20_corrected.json'), jodel: path.join(T, '..', 'builds', 'jodel_2026-09-20_corrected.json'), metal: path.join(T, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json') }[bk];
const sp = PT.specOf(file).spec, def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(sp) : sp);
const mn = WI.aerodromes.find(q => q.id === 'mn_strip'), w2 = WI.aerodromes.find(q => q.id === 'w2');
const dEnd = +(process.argv[3] || 45);
const ux = Math.cos(mn.hdg), uz = Math.sin(mn.hdg), s = -(mn.len / 2 - dEnd);
const pose = { x: mn.x + ux * s, z: mn.z + uz * s, hdg: Math.atan2(-uz, -ux) };
console.log('mn', mn.x.toFixed(1), mn.z.toFixed(1), 'len', mn.len, 'hdg', mn.hdg.toFixed(3), 'elev', WI.terrainH(mn.x, mn.z).toFixed(1), 'pose', JSON.stringify(pose));
const half = def.params.gen.span / 2;
const sim = L.placeAt(C, WI, def, pose);
const ap = C.makePilot(sim, def, WI, { style: 'normal' }); ap.departFrom(mn, w2);
let t = 0, minW = Infinity, at = null, lastPh = '';
for (let k = 0; k < 60 * 150; k++) {
  ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60;
  const cg = sim.cgPos(), zR = sim.axes()[2], rl = Math.hypot(zR[0], zR[2]) || 1;
  const agl = cg[1] - WI.terrainH(cg[0], cg[2]);
  if (ap.phase !== lastPh) { console.log('t', t.toFixed(1), 'phase', ap.phase, 'cg', cg.map(v => v.toFixed(1)).join(','), 'agl', agl.toFixed(1)); lastPh = ap.phase; }
  if (k % 6) continue;
  let lowY = Infinity; for (let i = 0; i < sim.n; i++) lowY = Math.min(lowY, sim.p[i * 3 + 1]);
  const v = sim.vel ? sim.vel() : null;
  for (let f = -1; f <= 1.0001; f += 0.1) {
    const x = cg[0] + zR[0] / rl * half * f, z = cg[2] + zR[2] / rl * half * f, n = IX.nearest(x, z, 20);
    if (n && n.d < 1.5) console.log('  t', t.toFixed(1), ap.phase, 'f', f.toFixed(1), 'd', n.d.toFixed(2), L.fmtWhat(n.s), 'top', ((n.s.y0 || 0) + (n.s.top || 0)).toFixed(1), 'lowY', lowY.toFixed(1), 'over', (lowY - (n.s.y0 || 0) - (n.s.top || 0)).toFixed(1), 'agl', agl.toFixed(1), 'cg', cg[0].toFixed(1), cg[2].toFixed(1));
    if (n && n.d < minW) { minW = n.d; at = L.fmtWhat(n.s) + ' t ' + t.toFixed(0); }
  }
  if (agl > 30) { console.log('airborne 30 m at t', t.toFixed(1)); break; }
}
console.log('minW', minW.toFixed(2), at);
console.log(ap.report.verdicts.map(v => v.code + (v.note ? ': ' + v.note : '')).join('\n'));
