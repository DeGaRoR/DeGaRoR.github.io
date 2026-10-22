// fast repro: the aeroplane stopped where leg 1's slope roll-on left it at tw_ski, chained leg to nv_strip
const path = require('path'), fs = require('fs');
const T = process.env.ROOT_T || require('path').join(__dirname, '..', '..', '..', 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const TL = require(path.join(T, '_taxiclear_lib.js'));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BUILD = opt('build', require('path').join(T, '..', 'builds', 'cub_2026-09-20_corrected.json'));
const X = +opt('x', 335.69), Z = +opt('z', -7843.75), NOSE = +opt('nose', -1.05);
const FROM = opt('from', 'tw_ski'), TO = opt('to', 'nv_strip');
const spec = PT.specOf(BUILD).spec;
const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec); def.params = Object.assign({}, def.params, { damage: true });
const TW = global.__TW || TR.tourWorld(C, IN, fs); const W = TW.W;
const I = TL.index(TW.shapes);
const A = id => W.aerodromes.find(q => q.id === id);
const a = A(FROM), b = A(TO);
const H = TR.gameHost(C, W, def, a, b, { day: undefined });
// placement: the stand = the stop pose (nose = hdg in atan2(z,x))
const sim = H.sim;
H.queueCmd({ cmd: 'start' });
// override the place: re-place at our pose after start
H.step();
sim.reset(0); if (sim.stance) sim.stance(); C.placeAtStand(sim, a, { x: X, z: Z, hdg: NOSE, elev: W.terrainH(X, Z) });
if (C.seatOnGround) C.seatOnGround(sim, (x, z) => W.terrainH(x, z), H.def ? H.def.refs : def.refs);
H.queueCmd({ cmd: 'leg', from: FROM, to: TO });
const half = def.params.gen.span / 2;
let minW = Infinity, at = null, path0 = null, obst = 0, t = 0;
for (let k = 0; k < 60 * (+opt('t', 60)); k++) {
  H.step(); t += 1 / 60;
  const ap = H.ap;
  if (!path0 && ap.path) { path0 = ap.path; }
  const cg = sim.cgPos(), zR = sim.axes()[2], rl = Math.hypot(zR[0], zR[2]) || 1;
  if (k % 6 === 0) for (let f = -1; f <= 1.0001; f += 0.1) {
    const x = cg[0] + zR[0] / rl * half * f, z = cg[2] + zR[2] / rl * half * f, n = I.nearest(x, z, 20);
    if (n && n.d < minW) { minW = n.d; at = TL.fmtWhat(n.s) + ' f ' + f.toFixed(1) + ' at (' + cg[0].toFixed(1) + ', ' + cg[2].toFixed(1) + ') ' + ap.phase + ' t ' + t.toFixed(1); }
  }
  if (sim.out && sim.out.obst > 0) obst++;
  if (k % 60 === 0 && opt('v')) { const xA = sim.axes()[0]; console.log(t.toFixed(0), ap.phase, cg[0].toFixed(1), cg[2].toFixed(1), Math.atan2(-xA[2], -xA[0]).toFixed(2)); }
  const D = sim.damage ? sim.damage() : null;
  if (D && D.over) { console.log('CRASH t ' + t.toFixed(1) + ' ' + D.reason); break; }
  if (/LIFTOFF|CLIMB/.test(ap.phase)) { console.log('airborne t ' + t.toFixed(1)); break; }
}
console.log('min wing clearance ' + minW.toFixed(2) + ' m: ' + at + '; obst steps ' + obst);
console.log('verdicts', JSON.stringify(H.ap.report.verdicts.map(v => v.code + ': ' + v.note)));
if (path0) { const P = path0.pts; let w = { d: Infinity }; for (const q of P) { const n = I.nearest(q.x, q.z, 30); if (n && n.d < w.d) w = { d: n.d, x: q.x, z: q.z, what: TL.fmtWhat(n.s) }; } console.log('path ids ' + path0.ids.join(',') + ' len ' + path0.len.toFixed(0) + ' centreline min ' + w.d.toFixed(2) + ' ' + w.what + ' at ' + w.x.toFixed(1) + ',' + w.z.toFixed(1)); if (opt('pts')) console.log(JSON.stringify(P.filter((q, i) => i % 5 === 0).map(q => [+q.x.toFixed(1), +q.z.toFixed(1)]))); }
