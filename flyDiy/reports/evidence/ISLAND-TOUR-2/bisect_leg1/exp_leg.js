// bisect rig: fly ONE leg of the Cub tour in node under switches, compare with the page's 4 Hz samples
// node exp_leg.js --leg 1 --run run2_rest [--raw] [--shake] [--day frozen|tick|calm] [--host] [--nav] [--out f.json]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
if (flag('raw')) process.env.FLYDIY_RAW_BUILDS = '1';
const T = '/home/user/DeGaRoR.github.io/flyDiy/tools';
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const SH = require(path.join(T, '..', 'src', 'viewer', 'sim_host.js'));
const RD = path.join(__dirname, 'real', opt('run', 'run2_rest'));
const PL = JSON.parse(fs.readFileSync(path.join(RD, 'legs.json'), 'utf8'));
const PS = JSON.parse(fs.readFileSync(path.join(RD, 'samples.json'), 'utf8'));
const LEG = +opt('leg', 1);
const BUILD = '/home/user/DeGaRoR.github.io/flyDiy/builds/cub_2026-09-20_corrected.json';
const spec = PT.specOf(BUILD).spec;
if (opt('fuel', null) != null) { spec.fuel = Object.assign({}, spec.fuel, { litres: +opt('fuel') }); }
const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
def.params = Object.assign({}, def.params, { damage: false });
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W;
const dayMode = opt('day', 'frozen');
const pday = PL.start.day;
if (dayMode !== 'calm') W.setDay(pday);
const t0w = Date.now();
const shake = flag('shake') ? C.genShakedown(def, { corners: false }) : null;
const order = PL.order;
const A = id => W.aerodromes.find(q => q.id === id);
const a = A(order[LEG - 1]), b = A(order[LEG]);
let sim, H = null, AP = null;
const mk = C.makePilot;
C.makePilot = function (s, d, w, o) { o = Object.assign({}, o || {}); if (shake && !o.shakedown) o.shakedown = () => shake; AP = mk.call(this, s, d, w, o); return AP; };
if (LEG !== 1) throw new Error('leg 1 only for now');
if (flag('host')) {
  // the worker's host, as sim_link inits it: the walked stand (standFor with the default player's shed)
  const st = C.siteOf(a.id);
  const shedD = C.playerShedDims ? C.playerShedDims(C.playerDefault(), 'HOME', st) : null;
  const stand = shedD && C.standFor ? C.standFor(st, shedD, (x, z) => W.terrainH(x, z)) : st.stand;
  H = SH.makeSimHost(C, { spec: def.spec, place: { from: a.id, to: b.id, stand: JSON.parse(JSON.stringify(stand)), seat: true }, pilot: { kind: 'auto', shakedown: shake, nav: flag('nav') }, withV: false, day: dayMode === 'calm' ? null : pday, damage: false }, W);
  if (dayMode === 'frozen') { H.dayTick = () => {}; }
  if (opt('hcruise')) { H.def.params.ap.hCruise = +opt('hcruise'); console.log('hCruise', H.ap.hCruise, '->', +opt('hcruise')); H.ap.hCruise = +opt('hcruise'); }
  sim = H.sim; H.queueCmd({ cmd: 'start' });
  console.log('host: cg0', sim.cgPos().map(v => v.toFixed(2)).join(','), 'page cg0', PL.start.cg, 'stand', JSON.stringify(stand).slice(0, 200));
} else {
  sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
  C.placeAtStand(sim, a, C.siteOf(a.id).stand);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  AP = C.makePilot(sim, def, W, { style: 'normal' });
  if (flag('nav')) AP.setNav(C.navMake({ waypoints: W.aerodromes }));
  AP.setRoute(a, b); AP.departFrom(a, b, C.siteOf(a.id));
}
console.log('mass', sim.totalM.toFixed(2), 'fuel', sim.fuel && sim.fuel.litres.toFixed(2), 'shake', !!shake, 'day', dayMode, 'utc0', W.day.utc.toFixed(1));
const rows = [];
let t = 0, n = 0;
const ap = () => (H ? H.ap : AP);
for (let k = 0; k < 1300 * 60; k++) {
  if (H) H.step(); else { AP.update(1 / 60); sim.step(1 / 60); if (dayMode === 'tick') { const cg = sim.cgPos(); W.dayTick(1 / 60, sim.t, cg[0], cg[2]); } }
  t += 1 / 60;
  if ((n++ % 15) === 0) {
    const cg = sim.cgPos(), v = sim.cgVel(), xA = sim.axes()[0], nl = Math.hypot(xA[0], xA[2]) || 1e-9;
    rows.push({ t, x: cg[0], y: cg[1], z: cg[2], agl: cg[1] - W.terrainH(cg[0], cg[2]), phase: ap().phase, Vg: Math.hypot(v[0], v[2]), ias: sim.out.ias, nose: Math.atan2(-xA[2] / nl, -xA[0] / nl) });
  }
  if (ap().phase === 'STOPPED' && t > 20) break;
}
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const pg = PS.rows.filter(r => r[9] === LEG).map(r => ({ t: r[0], x: r[1], y: r[2], z: r[3], agl: r[4], phase: r[5], Vg: r[6] }));
function summ(R, t0) {
  const ph = {}; let last = null;
  for (const p of R) { if (p.phase !== last) { ph[p.phase] = ph[p.phase] || r1(p.t - t0); last = p.phase; } }
  const enr = R.filter(p => p.phase === 'ENROUTE');
  const m = (q, f) => q.length ? r1(q.reduce((s, p) => s + f(p), 0) / q.length) : null;
  return { phases: ph, T: r1(R[R.length - 1].t - t0), enrVg: m(enr, p => p.Vg), enrAgl: m(enr, p => p.agl), enrIas: m(enr, p => p.ias || 0) };
}
function dev(P, N) {
  const near = (x, z) => { let best = Infinity; for (let i = 0; i < N.length - 1; i++) { const ax = N[i].x, az = N[i].z, dx = N[i + 1].x - ax, dz = N[i + 1].z - az, L2 = dx * dx + dz * dz; const u = L2 > 1e-9 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0; best = Math.min(best, Math.hypot(x - ax - u * dx, z - az - u * dz)); } return best; };
  const d = P.map(p => near(p.x, p.z)).sort((x, y) => x - y);
  return { p50: r1(d[d.length >> 1]), p95: r1(d[Math.floor(d.length * 0.95)]), max: r1(d[d.length - 1]) };
}
const pl = PL.legs.find(L => L.leg === LEG);
const out = { args: argv.join(' '), node: summ(rows, 0), page: summ(pg, pg[0].t), dev: dev(pg, rows), landing: ap().report.landing, pageLanding: pl.report.report.landing, verdicts: ap().report.verdicts.map(v => v.code), wall: (Date.now() - t0w) / 1000,
  sheet: (() => { const S = ap().sheet; return S ? { Vs0: r1(S.Vs0), Vref: r1(S.Vref), LDbest: S.LDbest, sinkBg: S.sinkBg, climbMax: S.climbMax, src: S.src.Vs0 } : null; })(), mass: sim.totalM };
console.log(JSON.stringify(out, null, 1));
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify({ out, rows }));
