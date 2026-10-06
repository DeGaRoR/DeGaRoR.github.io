#!/usr/bin/env node
// ditch_osc.js - G2105 WATER-DAMP: HOW LONG A DITCHED AEROPLANE KEEPS ROCKING. One flight core (this tree's, or another
// checkout's via --core) ditches a validated build on the SEA lane (GEAR-WATER's entry: 0.3 m over the water, V forward,
// sinking 1 m/s, throttle closed; `--entry settle` sets it down still, 5 cm over) and records every frame:
//   heave  the mass centre's height over the water (m)
//   pitch  nose-up +, deg (the body's aft axis against the horizon); roll deg (its span axis against the horizon)
// then, per window (0-5, 5-10, ... s): the peak-to-peak of each, and of each with the window's straight line taken out
// (the oscillation alone - flooding sinks a hull slowly, which is not a rocking). The floatplanes (cfloats, twin) are
// settled from a 0.3 m drop (the float pass; no wet body) as the cross-check.
//   node tools/ditch_osc.js [--core path] [--builds cub,jodel,metal,cfloats,twin] [--secs 40] [--V 22] [--entry ditch]
//                           [--dt 0.016667] [--every N (hydroEvery)] [--thr 0] [--damage 0|1] [--rad 0|1] [--grad 0|1] [--cap 0|1] [--now 0|1] [--csv dir] [--json file]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const C = require(path.resolve(opt('core', path.join(__dirname, 'flight_core.js'))));
const SECS = +opt('secs', 40), V0 = +opt('V', 22), ENTRY = opt('entry', 'ditch'), DT = +opt('dt', 1 / 60);
const EVERY = opt('every', null), THR = +opt('thr', 0), WIN = +opt('win', 5), DMG = opt('damage', null);
// G2105's two fixes, each switchable (32_hydro.js WB_OPT): --rad 0 the radiation off, --grad 0 the held force's gradient off, --cap 0 the old cap (buoyancy capped too), --now 0 the air share from the last compute
if (C.HYDRO && C.HYDRO.WB_OPT) for (const k of ['rad', 'grad', 'cap', 'now']) if (opt(k, null) != null) C.HYDRO.WB_OPT[k] = +opt(k, 1);
const BUILDS = {
  cub: { file: 'builds/cub_2026-09-20_corrected.json' },
  jodel: { file: 'builds/jodel_2026-09-20_corrected.json' },
  metal: { file: 'bugReports/cessnaMetal (1).json' },
  cfloats: { file: 'bugReports/cessnaFloatsWOrks.json', floats: true },
  twin: { file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', floats: true,
          patch: s => { s.gear.type = 'floats'; s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); } },
};
const D = 180 / Math.PI;
const specOf = b => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, BUILDS[b].file), 'utf8'));
  const s = JSON.parse(JSON.stringify(j.spec || j)); if (BUILDS[b].patch) BUILDS[b].patch(s); return C.genMigrateSpec ? C.genMigrateSpec(s) : s; };

function run(b, o = {}) {
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const def = C.buildGen(specOf(b));
  if (o.every != null) def.params.hydroEvery = +o.every;
  const dmg = o.damage != null ? o.damage : DMG;
  if (dmg != null) def.params.damage = !!+dmg;          // the damage layer (off by default, G1898)
  const sim = C.makeSim(def, world);
  sim.reset(0); C.placeAtAerodrome(sim, sea);
  const n = def.nodes.length, p = sim.p, v = sim.v, [xA] = sim.axes(), c0 = sim.cgPos(), wh = world.waterH(c0[0], c0[2]);
  const fl = !!BUILDS[b].floats, ditch = !fl && (o.entry || ENTRY) === 'ditch';
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i * 3 + 1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]);
  const V = ditch ? (o.V != null ? o.V : V0) : 0, sink = ditch ? 1 : 0, gap = ditch || fl ? 0.3 : 0.05;
  for (let i = 0; i < n; i++) { p[i * 3 + 1] += wh + gap - yMin; v[i * 3] = -V * xA[0] / hl; v[i * 3 + 1] = -sink; v[i * 3 + 2] = -V * xA[2] / hl; }
  const thr = o.thr != null ? o.thr : THR;
  sim.ctl.thr = thr;
  const dt = o.dt || DT, N = Math.round((o.secs || SECS) / dt);
  const T = [], Hv = [], Pt = [], Rl = [], Th = [], Rpm = [];
  let finite = true;
  for (let s = 0; s < N; s++) {
    if (o.each) o.each(sim, s * dt);
    sim.step(dt);
    const c = sim.cgPos(), [x2, , z2] = sim.axes();
    if (!Number.isFinite(c[1])) { finite = false; break; }
    T.push((s + 1) * dt); Hv.push(c[1] - world.waterH(c[0], c[2], sim.t));
    Pt.push(Math.asin(Math.max(-1, Math.min(1, -x2[1]))) * D); Rl.push(Math.asin(Math.max(-1, Math.min(1, z2[1]))) * D);
    const e = sim.eng && sim.eng[0];
    Th.push(sim.out.thrust != null ? sim.out.thrust : NaN); Rpm.push(e && e.rpm != null ? e.rpm : NaN);
  }
  return { b, def, sim, finite, T, Hv, Pt, Rl, Th, Rpm, dt };
}
// peak-to-peak over [t0, t1), raw and with the window's least-squares line taken out
function pp(T, X, t0, t1) {
  let lo = Infinity, hi = -Infinity, sx = 0, sy = 0, sxx = 0, sxy = 0, k = 0;
  for (let i = 0; i < T.length; i++) if (T[i] >= t0 && T[i] < t1) { const x = T[i], y = X[i];
    lo = Math.min(lo, y); hi = Math.max(hi, y); sx += x; sy += y; sxx += x * x; sxy += x * y; k++; }
  if (!k) return { raw: NaN, osc: NaN };
  const den = k * sxx - sx * sx, a = den ? (k * sxy - sx * sy) / den : 0, c = (sy - a * sx) / k;
  let lo2 = Infinity, hi2 = -Infinity;
  for (let i = 0; i < T.length; i++) if (T[i] >= t0 && T[i] < t1) { const r = X[i] - (a * T[i] + c); lo2 = Math.min(lo2, r); hi2 = Math.max(hi2, r); }
  return { raw: hi - lo, osc: hi2 - lo2 };
}
// the dominant period over [t0, t1): the mean spacing of the detrended signal's upward zero crossings
function period(T, X, t0, t1) {
  const idx = []; for (let i = 0; i < T.length; i++) if (T[i] >= t0 && T[i] < t1) idx.push(i);
  if (idx.length < 4) return NaN;
  let m = 0; for (const i of idx) m += X[i]; m /= idx.length;
  const up = [];
  for (let j = 1; j < idx.length; j++) { const a = X[idx[j - 1]] - m, b = X[idx[j]] - m;
    if (a < 0 && b >= 0) up.push(T[idx[j - 1]] + (T[idx[j]] - T[idx[j - 1]]) * (-a / (b - a))); }
  return up.length >= 2 ? (up[up.length - 1] - up[0]) / (up.length - 1) : NaN;
}
// the first time after which every later window's heave oscillation stays under `lim` (m)
function settleTime(T, X, lim, win = 1) {
  const end = T[T.length - 1];
  let ts = null;
  for (let t = end - win; t >= 0; t -= 0.5) { if (pp(T, X, t, t + win).osc >= lim) break; ts = t; }
  return ts;
}
function summary(r, secs = SECS) {
  const W = [];
  for (let t = 0; t < secs - 1e-9; t += WIN) {
    const h = pp(r.T, r.Hv, t, t + WIN), pt = pp(r.T, r.Pt, t, t + WIN), rl = pp(r.T, r.Rl, t, t + WIN);
    W.push({ t0: t, t1: t + WIN, heave: h, pitch: pt, roll: rl, Th: period(r.T, r.Hv, t, t + WIN) });
  }
  const osc1s = []; for (let t = 0; t + 1 <= secs + 1e-9; t += 1) osc1s.push(pp(r.T, r.Hv, t, t + 1).osc);   // each second's heave oscillation
  return { b: r.b, finite: r.finite, W, osc1s, settle1cm: settleTime(r.T, r.Hv, 0.01), settle1mm: settleTime(r.T, r.Hv, 0.001),
           end: { heave: r.Hv[r.Hv.length - 1], pitch: r.Pt[r.Pt.length - 1], roll: r.Rl[r.Rl.length - 1] } };
}
const f = (x, n = 3) => Number.isFinite(x) ? x.toFixed(n) : String(x);
function print(S) {
  console.log(`\n${S.b}: ${S.finite ? 'finite' : 'NOT FINITE'}; heave oscillation under 1 cm p-p (1 s windows) from ${S.settle1cm == null ? 'never' : f(S.settle1cm, 1) + ' s'}, under 1 mm from ${S.settle1mm == null ? 'never' : f(S.settle1mm, 1) + ' s'}; ` +
              `at the end heave ${f(S.end.heave)} m, pitch ${f(S.end.pitch, 2)}, roll ${f(S.end.roll, 2)} deg`);
  console.log('   window s   heave p-p m (osc)     pitch p-p deg (osc)   roll p-p deg (osc)   heave period s');
  for (const w of S.W) console.log(`   ${String(w.t0).padStart(3)}-${String(w.t1).padEnd(4)} ${f(w.heave.raw, 4).padStart(8)} (${f(w.heave.osc, 4).padStart(7)})   ${f(w.pitch.raw, 2).padStart(7)} (${f(w.pitch.osc, 2).padStart(6)})      ${f(w.roll.raw, 2).padStart(6)} (${f(w.roll.osc, 2).padStart(6)})      ${f(w.Th, 2)}`);
}
module.exports = { run, summary, pp, period, settleTime, BUILDS };
if (require.main === module) {
  const builds = opt('builds', 'cub,jodel,metal,cfloats,twin').split(',');
  const csv = opt('csv', null), js = opt('json', null), all = {};
  for (const b of builds) {
    const r = run(b, { every: EVERY });
    const S = summary(r); print(S); all[b] = S;
    if (csv) { fs.mkdirSync(csv, { recursive: true });
      fs.writeFileSync(path.join(csv, `${b}.csv`), 't,heave,pitch,roll,thrust,rpm\n' + r.T.map((t, i) => `${t.toFixed(4)},${r.Hv[i].toFixed(5)},${r.Pt[i].toFixed(3)},${r.Rl[i].toFixed(3)},${f(r.Th[i], 1)},${f(r.Rpm[i], 0)}`).join('\n') + '\n'); }
  }
  if (js) fs.writeFileSync(js, JSON.stringify(all, null, 1));
}
