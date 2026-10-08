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
// MERGED (G2105 x WATER-LOOK G2094, the tool both sessions wrote - one now): `--cases wl` runs WATER-LOOK's six named cases
// (the Cub ditched at 22 m/s sinking 1.5 m/s, 0.5 m over, throttle closed / LEFT AT 0.6, damage off / on; the metal Cessna
// at 25 m/s; the Cessna floats' hard touchdown, 15 m/s sinking 2.3 m/s) and per case the free decay once stopped - the
// heave's, the pitch's and the roll's damping ratio (log decrement of successive peaks), period and cycles to settle - with
// the thrust the solver applies after the stop, the prop's depth under the water and whether the engine runs; --csv writes
// those columns and summary.json for `node tools/ditch_osc_plot.js --cases <dir>`.
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
  const fl = !!BUILDS[b].floats, ditch = (!fl || o.V != null) && (o.entry || ENTRY) === 'ditch';   // (a floatplane ditched at speed when o.V is given: WATER-LOOK's touchdown case)
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i * 3 + 1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]);
  const V = ditch ? (o.V != null ? o.V : V0) : 0, sink = ditch ? (o.sink != null ? o.sink : 1) : 0, gap = o.gap != null ? o.gap : (ditch || fl ? 0.3 : 0.05);
  for (let i = 0; i < n; i++) { p[i * 3 + 1] += wh + gap - yMin; v[i * 3] = -V * xA[0] / hl; v[i * 3 + 1] = -sink; v[i * 3 + 2] = -V * xA[2] / hl; }
  const thr = o.thr != null ? o.thr : THR;
  sim.ctl.thr = thr;
  const dt = o.dt || DT, N = Math.round((o.secs || SECS) / dt);
  const T = [], Hv = [], Pt = [], Rl = [], Th = [], Rpm = [];
  const Vy = [], Gs = [], Run = [], Pd = [], Bu = [], Dr = [], Cr = [], engN = (def.refs.engine || [])[0];   // (WATER-LOOK's columns)
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
    const cv = sim.cgVel(), wl = world.waterH(c[0], c[2], sim.t);
    Vy.push(cv[1]); Gs.push(Math.hypot(cv[0], cv[2])); Run.push(e ? (e.running ? 1 : 0) : NaN);
    Pd.push(engN != null ? wl - p[engN * 3 + 1] : NaN); Bu.push(sim.out.wetBuoy != null ? sim.out.wetBuoy : NaN); Dr.push(sim.out.wetDrag || 0);
    Cr.push(sim.damage && sim.damage().crashed ? 1 : 0);
  }
  return { b, def, sim, finite, T, Hv, Pt, Rl, Th, Rpm, Vy, Gs, Run, Pd, Bu, Dr, Cr, dt, mass: sim.totalM, seaA: world.sea ? world.sea.A : null,
           dmgOn: typeof C.genDamageOn === 'function' ? C.genDamageOn(def) : null };
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
// WATER-LOOK G2094: the free decay of X after t0 - peaks about the drift line (the last half's fit), the log decrement over
// successive same-sign peaks -> zeta, the period, the cycles until |X - mean| stays under tol
function decay(T, X, t0, tol) {
  const I = []; for (let i = 0; i < T.length; i++) if (T[i] >= t0) I.push(i);
  if (I.length < 120) return null;
  // the slow drift taken out (a flooding hull sinks - not a rocking): the line fitted to the last half, extended back
  const tail = I.slice(Math.floor(I.length * 0.5)); let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const i of tail) { sx += T[i]; sy += X[i]; sxx += T[i] * T[i]; sxy += T[i] * X[i]; }
  const nT = tail.length, den = nT * sxx - sx * sx, sl = den ? (nT * sxy - sx * sy) / den : 0, ic = (sy - sl * sx) / nT;
  const mean = ic + sl * T[I[I.length - 1]];
  const x = I.map(i => X[i] - (ic + sl * T[i])), pk = [];
  for (let j = 1; j + 1 < x.length; j++) if (Math.abs(x[j]) >= Math.abs(x[j - 1]) && Math.abs(x[j]) > Math.abs(x[j + 1]) && Math.abs(x[j]) > tol * 0.25) pk.push({ t: T[I[j]], a: x[j] });
  const pos = pk.filter(q => q.a > 0);
  const dec = []; for (let j = 0; j + 1 < pos.length && j < 6; j++) dec.push(Math.log(pos[j].a / pos[j + 1].a));
  const d = dec.length ? dec.reduce((a, b) => a + b, 0) / dec.length : NaN;
  const zeta = d / Math.sqrt(4 * Math.PI * Math.PI + d * d);
  const Tp = pos.length > 1 ? (pos[Math.min(pos.length - 1, 4)].t - pos[0].t) / Math.min(pos.length - 1, 4) : NaN;
  let tSettle = null; for (let j = x.length - 1; j >= 0; j--) if (Math.abs(x[j]) > tol) { tSettle = T[I[j]]; break; }
  return { mean, a0: pk.length ? Math.max(...pk.slice(0, 3).map(q => Math.abs(q.a))) : 0, peaks: pk.length, zeta, T: Tp, tSettle,
           cycles: Number.isFinite(Tp) && tSettle != null ? (tSettle - t0) / Tp : null };
}
const WL_CASES = [
  { id: 'cub_thr0', label: 'Cub, ditched at 22 m/s, 1.5 m/s sink, throttle CLOSED', b: 'cub', V: 22, sink: 1.5, thr: 0, damage: 0 },
  { id: 'cub_thr0_dmg', label: 'the same, damage ON', b: 'cub', V: 22, sink: 1.5, thr: 0, damage: 1 },
  { id: 'cub_thr60', label: 'Cub, the same ditch, throttle LEFT at 0.6 (a pilot that keeps power)', b: 'cub', V: 22, sink: 1.5, thr: 0.6, damage: 0 },
  { id: 'cub_thr60_dmg', label: 'the same, damage ON', b: 'cub', V: 22, sink: 1.5, thr: 0.6, damage: 1 },
  { id: 'cessna_thr0', label: 'metal Cessna, ditched at 25 m/s, 1.5 m/s sink, throttle closed', b: 'metal', V: 25, sink: 1.5, thr: 0, damage: 0 },
  { id: 'floats_drop', label: 'Cessna floats, a hard touchdown: 15 m/s, 2.3 m/s sink, throttle closed', b: 'cfloats', V: 15, sink: 2.3, thr: 0, damage: 0 },
];
function wlCases(csv) {
  const out = [];
  for (const cs of WL_CASES) {
    let r; try { r = run(cs.b, { V: cs.V, sink: cs.sink, gap: 0.5, thr: cs.thr, damage: cs.damage, entry: 'ditch' }); } catch (e) { console.log('== ' + cs.id + ': threw ' + e.message); continue; }
    // the window: from the stop (ground speed under 1 m/s) - or, an aeroplane still gliding on (a floatplane), 1.5 s in
    let t0 = 1.5; for (let i = 0; i < r.T.length; i++) if (r.T[i] > 1 && r.Gs[i] < 1) { if (r.T[i] < 10) t0 = r.T[i]; break; }
    const Hd = decay(r.T, r.Hv, t0, 0.02), Pd = decay(r.T, r.Pt, t0, 1), Rd = decay(r.T, r.Rl, t0, 1);
    let thrMax = 0, under = 0, nA = 0; for (let i = 0; i < r.T.length; i++) if (r.T[i] >= t0) { nA++; thrMax = Math.max(thrMax, r.Th[i] || 0); if (r.Pd[i] > 0) under++; }
    const runEnd = r.Run[r.Run.length - 1] === 1, crashed = r.Cr[r.Cr.length - 1] === 1;
    console.log('\n== ' + cs.id + ': ' + cs.label + ' (staged inline, ' + f(r.mass, 0) + ' kg, damage ' + (r.dmgOn ? 'ON' : 'off') + ', sea wave amplitude ' + r.seaA + ' m)');
    console.log('  stopped (gs < 1 m/s) at ' + f(t0, 2) + ' s; crashed ' + crashed + '; engine running at the end ' + runEnd +
      '; thrust after the stop up to ' + f(thrMax, 0) + ' N with the prop under water ' + f(100 * under / Math.max(1, nA), 0) + ' % of the time');
    { const S = summary(r); console.log('  heave oscillation (1 s windows, the drift out) under 1 cm p-p from ' + (S.settle1cm == null ? 'never' : f(S.settle1cm, 1) + ' s') +
        ', under 1 mm from ' + (S.settle1mm == null ? 'never' : f(S.settle1mm, 1) + ' s') + '   (WATER-DAMP settle - the robust one; the decay lines below: zeta from the first peaks)'); }
    for (const [k, Dd, u] of [['heave', Hd, 'm'], ['pitch', Pd, 'deg'], ['roll', Rd, 'deg']]) if (Dd)
      console.log('  ' + k.padEnd(6) + ' about ' + f(Dd.mean, 2) + ' ' + u + ': first swing ' + f(Dd.a0, 2) + ' ' + u + ', period ' + f(Dd.T, 2) + ' s, zeta ' + f(Dd.zeta, 3) +
        ', settled (' + (u === 'm' ? '2 cm' : '1 deg') + ') at ' + (Dd.tSettle == null ? 'never moved' : f(Dd.tSettle, 1) + ' s') + ' = ' + f(Dd.cycles, 1) + ' cycles');
    out.push({ id: cs.id, label: cs.label, t0, heave: Hd, pitch: Pd, roll: Rd, thrustAfterMax: thrMax, propUnder: under / Math.max(1, nA), runningEnd: runEnd });
    if (csv) { fs.mkdirSync(csv, { recursive: true }); fs.writeFileSync(path.join(csv, cs.id + '.csv'), 't,heave,pitch,roll,vy,gs,thrust,running,propDepth,buoy,drag,crashed\n' +
      r.T.map((t, i) => [t.toFixed(4), r.Hv[i].toFixed(4), r.Pt[i].toFixed(3), r.Rl[i].toFixed(3), r.Vy[i].toFixed(3), r.Gs[i].toFixed(3), f(r.Th[i], 1), r.Run[i],
        Number.isFinite(r.Pd[i]) ? r.Pd[i].toFixed(3) : '', Number.isFinite(r.Bu[i]) ? r.Bu[i].toFixed(0) : '', r.Dr[i].toFixed(0), r.Cr[i]].join(',')).join('\n')); }
  }
  if (csv) fs.writeFileSync(path.join(csv, 'summary.json'), JSON.stringify(out, null, 1));
  return out;
}
module.exports = { run, summary, pp, period, settleTime, BUILDS, decay, WL_CASES, wlCases };
if (require.main === module && opt('cases', null) === 'wl') wlCases(opt('csv', null));
else if (require.main === module) {
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
