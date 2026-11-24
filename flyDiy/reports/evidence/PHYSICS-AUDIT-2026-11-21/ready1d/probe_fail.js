// usage: node probe_fail.js <flyDiy dir> [h=300] [key=c172] [every=2]
'use strict';
const fs = require('fs'), path = require('path');
const D = path.resolve(process.argv[2]), T = path.join(D, 'tools'), h0 = +(process.argv[3] || 300), key = process.argv[4] || 'c172', every = +(process.argv[5] || 2);
{ const src = fs.readFileSync(path.join(T, 'arch_fly.js'), 'utf8');
  eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(T)).replace('function loadPanel()', 'global.loadPanel = function ()')); global.loadPanel(); }
const DS = require(path.join(T, '_cage_design.js')), C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js'));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const AD = id => W.aerodromes.find(a => a.id === id);
const A = DS.ARCHETYPES.find(x => x.key === key), def = C.buildGen(DS.designBake(A.sel, A.over));
const H = AD('HOME'), To = AD('nv_strip');
const hd = Math.atan2(To.z - H.z, To.x - H.x), sx = H.x + Math.cos(hd) * 2600, sz = H.z + Math.sin(hd) * 2600;
const sim = C.makeSim(def, W); sim.reset(0);
C.placeAtLineup(sim, H, { x: H.x, z: H.z, hdg: hd }, W, def.refs); for (let i = 0; i < 60; i++) sim.step(1 / 60);
const P = Float64Array.from(sim.p), cg = sim.cgPos(), y = W.terrainH(sx, sz) + h0; sim.reset(0);
for (let i = 0; i < sim.n; i++) { sim.p[i*3] = P[i*3] - cg[0] + sx; sim.p[i*3+1] = P[i*3+1] - cg[1] + y; sim.p[i*3+2] = P[i*3+2] - cg[2] + sz; sim.v[i*3] = Math.cos(hd) * 50; sim.v[i*3+1] = 0; sim.v[i*3+2] = Math.sin(hd) * 50; }
for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
const ap = C.makePilot(sim, def, W); ap.setRoute(H, To); ap.reEngage({ phase: 'CLIMB' });
const f = (x, n = 1) => x == null ? '-' : (+x).toFixed(n);
let last = ''; const near = AD('w5'); let geo = null;
const sc = c => { const G = ap.report.glider; if (!G) return ''; const m = /heading (\d+) deg/.exec(G.way), hd2 = (+m[1]) * Math.PI / 180, ux = Math.sin(hd2), uz = -Math.cos(hd2);
  const dx = c[0] - near.x, dz = c[2] - near.z; geo = { len: near.len, hdg: near.hdg, ux, uz }; return 's ' + f(dx * ux + dz * uz + near.len / 2, 0) + ' c ' + f(dx * uz - dz * ux, 0); };
for (let fr = 0; fr < 60 * 700; fr++) {
  if (fr === 600) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { running: false });
  ap.update(1 / 60); sim.step(1 / 60);
  if (sim.stats().bad) { console.log('BAD'); break; }
  if (fr % (60 * every) === 0 || ap.phase !== last) {
    const c = sim.cgPos(), v = sim.cgVel ? sim.cgVel() : [0, 0, 0], G = ap.report.glider, st = ap.status;
    const V = Math.hypot(v[0], v[1], v[2]);
    console.log([f(fr / 60, 0).padStart(4), ap.phase.padEnd(8), (G && G.stages.length ? G.stages[G.stages.length - 1].stage : '-').padEnd(9), 'agl ' + f(c[1] - W.terrainH(c[0], c[2]), 0).padStart(4), sc(c).padEnd(16), 'hdg ' + f(((Math.atan2(v[0], -v[2]) * 180 / Math.PI) + 360) % 360, 0).padStart(3), 'V ' + f(V), 'vy ' + f(v[1], 2), 'L/D now ' + f(Math.hypot(v[0], v[2]) / Math.max(0.1, -v[1])), 'E ' + f(G && G.E) + ' Em ' + f(G && G.Em), 'flap ' + f(sim.ctl.flap, 2), 'thr ' + f(sim.ctl.throttle, 2), st && st.conds ? st.conds.map(q => (q.what + " " + f(q.have, 0) + "/" + f(q.want, 0))).join(' ; ') : ''].join('  '));
    last = ap.phase;
  }
  if (ap.phase === 'STOPPED') break;
}
const R = ap.report; console.log('geo ' + JSON.stringify(geo)); console.log(JSON.stringify({ outcome: R.outcome, landing: R.landing, glider: R.glider, verdicts: (R.verdicts || []).map(v => v.code) }).slice(0, 1500));
