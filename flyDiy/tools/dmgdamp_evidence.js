#!/usr/bin/env node
// dmgdamp_evidence.js - DMG-DAMP's evidence (G1887), node only: reports/evidence/DMG-DAMP/
//   L_<build>.svg      L about the CG against time in vacuum, spun at 1 rad/s about roll, pitch and yaw: BEFORE (the
//                      pre-G1885 damper, params.defDampMean - bit-identical to the base core, checked) and AFTER
//   modes.json / modes the flown modes of the five validated builds, before and after, controls FIXED at a trim the
//                      probe finds (its own slow loops, an instrument, not a pilot): the dutch roll (a rudder doublet:
//                      period, damping ratio), the roll rate decay (a 0.3 rad/s roll-rate kick: the time to 1/e), the
//                      yaw rate decay (a 0.2 rad/s yaw-rate kick: the time the envelope takes to halve), the short
//                      period (a 0.2 rad/s pitch-rate kick: the time to half), the spiral (a 3 deg bank: the time to
//                      double or to half, fitted over 5-30 s); every signal the kicked run minus an unkicked one from
//                      the same trim, so the trim's own drift cancels
//   perf.json / perf   sim.step(1/60) of the STOCK build (damage off, the default) with nothing touching: the base core
//                      against this one, alternating processes, the median of 5 processes' medians, 600 steps, the Cub
//                      and the metal Cessna, ground and air (tools/treecrash_evidence.js's method)
// Run: node tools/dmgdamp_evidence.js [--perf-base <base's tools/flight_core.js>] [--no-perf | --perf-only]
//      [--no-modes] [--no-L] [--only=cub,metal]
//      (the perf child loads _treecrash_lib.js beside the core it is given: the base's own tree has it)
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); if (a) return a.slice(k.length + 3); const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-DAMP');

// ---- the perf child: the stock build's sim.step(1/60), nothing touching ----
if (argv[0] === '--perf-child') {
  const core = argv[1], key = argv[2], mode = argv[3];
  const L = require(path.join(path.dirname(core), '_treecrash_lib.js'));
  const C = L.core(), def = L.defOf(key, { elastic: true }), { W, strip } = L.flatWorld(0);
  delete def.params.damage;                                   // the stock build: the switch's default (off)
  if (process.env.DMGDAMP_MEAN) def.params.defDampMean = true;   // the old formula on this core: the base's trajectory, this core's code
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: mode === 'air' ? 300 : 0 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), V = mode === 'air' ? 1.6 * def.params.gen.Vs : 0;
  if (V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
  sim.ctl.thr = mode === 'air' ? 0.75 : 0.3;
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  const ms = [];
  for (let f = 0; f < 600; f++) { const a = process.hrtime.bigint(); sim.step(1 / 60); ms.push(Number(process.hrtime.bigint() - a) / 1e6); }
  ms.sort((a, b) => a - b);
  console.log('PERF ' + JSON.stringify({ med: ms[300], p90: ms[540], mean: ms.reduce((a, b) => a + b, 0) / ms.length }));
  process.exit(0);
}

const L = require('./_treecrash_lib.js');
const C = L.core();
fs.mkdirSync(OUT, { recursive: true });
const ONLY = opt('only', null);
const KEYS = ONLY ? ONLY.split(',') : ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const PERF_ONLY = argv.includes('--perf-only');
const COL = { before: '#2a78d6', after: '#eb6834', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', surf: '#fcfcfb' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${COL.surf}"/>${body}</svg>`;

// ---- the rigid state of the airframe: CG, its velocity, w = I^-1 L about the CG ----
function rigid(sim, m) {
  let M = 0, cx = 0, cy = 0, cz = 0, ux = 0, uy = 0, uz = 0;
  for (let i = 0; i < sim.n; i++) { const mi = m[i]; M += mi; cx += mi*sim.p[i*3]; cy += mi*sim.p[i*3+1]; cz += mi*sim.p[i*3+2]; ux += mi*sim.v[i*3]; uy += mi*sim.v[i*3+1]; uz += mi*sim.v[i*3+2]; }
  cx /= M; cy /= M; cz /= M; ux /= M; uy /= M; uz /= M;
  let Lx = 0, Ly = 0, Lz = 0, Sxx = 0, Syy = 0, Szz = 0, Sxy = 0, Sxz = 0, Syz = 0;
  for (let i = 0; i < sim.n; i++) {
    const mi = m[i], rx = sim.p[i*3] - cx, ry = sim.p[i*3+1] - cy, rz = sim.p[i*3+2] - cz, vx = sim.v[i*3] - ux, vy = sim.v[i*3+1] - uy, vz = sim.v[i*3+2] - uz;
    Lx += mi*(ry*vz - rz*vy); Ly += mi*(rz*vx - rx*vz); Lz += mi*(rx*vy - ry*vx);
    Sxx += mi*rx*rx; Syy += mi*ry*ry; Szz += mi*rz*rz; Sxy += mi*rx*ry; Sxz += mi*rx*rz; Syz += mi*ry*rz;
  }
  const a = Syy + Szz, b = Sxx + Szz, c = Sxx + Syy;
  const k0 = b*c - Syz*Syz, k1 = Sxy*c + Syz*Sxz, k2 = Sxy*Syz + b*Sxz, k4 = a*c - Sxz*Sxz, k5 = a*Syz + Sxy*Sxz, k8 = a*b - Sxy*Sxy;
  const det = a*k0 - Sxy*k1 - Sxz*k2;
  const w = [(k0*Lx + k1*Ly + k2*Lz) / det, (k1*Lx + k4*Ly + k5*Lz) / det, (k2*Lx + k5*Ly + k8*Lz) / det];
  return { c: [cx, cy, cz], u: [ux, uy, uz], w, L: [Lx, Ly, Lz] };
}
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
// the body state: forward f, up u, right r = f x u (the world is right-handed, y up); rates about them
function state(sim, m) {
  const R = rigid(sim, m), ax = sim.axes(), f = ax[0].map(x => -x), u = ax[1], r = cross(f, u);
  const V = Math.hypot(...R.u);
  return { V, h: R.c[1], vy: R.u[1], theta: Math.asin(f[1]), phi: Math.atan2(-r[1], u[1]), psi: Math.atan2(f[2], f[0]),
           p: dot(R.w, f), q: dot(R.w, r), r: dot(R.w, u), beta: Math.asin(dot(R.u, r) / V), c: R.c, f, u, rt: r };
}
// add a rigid rotation about an axis through the CG (a rate kick), or turn the airframe about one (a bank)
function kickRate(sim, m, axis, w) {
  const R = rigid(sim, m);
  for (let i = 0; i < sim.n; i++) {
    const rr = [sim.p[i*3] - R.c[0], sim.p[i*3+1] - R.c[1], sim.p[i*3+2] - R.c[2]], dv = cross(axis.map(x => x * w), rr);
    sim.v[i*3] += dv[0]; sim.v[i*3+1] += dv[1]; sim.v[i*3+2] += dv[2];
  }
}
function rotAbout(x, a, ang) {        // Rodrigues
  const c = Math.cos(ang), s = Math.sin(ang), d = dot(a, x), cr = cross(a, x);
  return [x[0]*c + cr[0]*s + a[0]*d*(1 - c), x[1]*c + cr[1]*s + a[1]*d*(1 - c), x[2]*c + cr[2]*s + a[2]*d*(1 - c)];
}
function turnAbout(sim, m, axis, ang) {
  const R = rigid(sim, m);
  for (let i = 0; i < sim.n; i++) {
    const rr = rotAbout([sim.p[i*3] - R.c[0], sim.p[i*3+1] - R.c[1], sim.p[i*3+2] - R.c[2]], axis, ang);
    const vv = rotAbout([sim.v[i*3] - R.u[0], sim.v[i*3+1] - R.u[1], sim.v[i*3+2] - R.u[2]], axis, ang);
    for (let k = 0; k < 3; k++) { sim.p[i*3+k] = R.c[k] + rr[k]; sim.v[i*3+k] = R.u[k] + vv[k]; }
  }
}

// ---- the trim: the probe's own slow loops, then the stick FIXED at their average ----
const TRIM_S = 45, AVG_S = 8;
function trimmed(key, before) {
  const def = L.defOf(key, { elastic: true });
  delete def.params.damage;
  if (before) def.params.defDampMean = true;
  const m = def.nodes.map(nd => nd.m), sim = C.makeSim(def, null); sim.reset(0);
  const H0 = 1000, Vt = 1.6 * def.params.gen.Vs;
  for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += H0;
  const s0 = state(sim, m), fh = [s0.f[0], 0, s0.f[2]], fl = Math.hypot(...fh);
  for (let i = 0; i < sim.n; i++) { sim.v[i*3] = Vt * fh[0] / fl; sim.v[i*3+1] = 0; sim.v[i*3+2] = Vt * fh[2] / fl; }
  const ctl = sim.ctl; ctl.thr = 0.7; ctl.de = 0; ctl.da = 0; ctl.dr = 0;
  // the signs, measured (de > 0 nose-up, da > 0 roll right, dr > 0 nose left are the solver's; checked, not assumed)
  let iV = 0, iH = 0, iB = 0;
  const acc = { thr: 0, de: 0, da: 0, dr: 0, n: 0 };
  const clamp = (x, a) => x < -a ? -a : x > a ? a : x;
  for (let f = 0; f < TRIM_S * 60; f++) {
    const s = state(sim, m), dt = 1 / 60;
    const eV = Vt - s.V; iV += eV * dt;
    ctl.thr = clamp(0.7 + 0.08 * eV + 0.02 * iV, 1) < 0 ? 0 : clamp(0.7 + 0.08 * eV + 0.02 * iV, 1);
    const vyC = clamp(0.25 * (H0 - s.h), 3), eH = vyC - s.vy; iH += eH * dt;
    ctl.de = clamp(0.03 * eH + 0.015 * iH - 0.4 * s.q, 1);
    ctl.da = clamp(-1.2 * s.phi - 0.25 * s.p, 1);
    iB += s.beta * dt;
    ctl.dr = clamp(-1.5 * s.beta - 0.6 * iB - 0.3 * s.r, 1);
    if (process.env.TRIM_DEBUG && f % 300 === 0) console.log('trim', key, (f / 60).toFixed(0), 'V', s.V.toFixed(1), 'h', s.h.toFixed(1), 'phi', (s.phi * 57.3).toFixed(2), 'beta', (s.beta * 57.3).toFixed(2), 'theta', (s.theta * 57.3).toFixed(1), 'r', s.r.toFixed(3), 'ctl', ctl.thr.toFixed(2), ctl.de.toFixed(3), ctl.da.toFixed(3), ctl.dr.toFixed(3));
    if (f >= (TRIM_S - AVG_S) * 60) { acc.thr += ctl.thr; acc.de += ctl.de; acc.da += ctl.da; acc.dr += ctl.dr; acc.n++; }
    sim.step(dt);
  }
  ctl.thr = acc.thr / acc.n; ctl.de = acc.de / acc.n; ctl.da = acc.da / acc.n; ctl.dr = acc.dr / acc.n;
  return { sim, m, def, Vt, trim: { thr: ctl.thr, de: ctl.de, da: ctl.da, dr: ctl.dr }, s: state(sim, m) };
}
// fly a trimmed aeroplane with the stick fixed for T s, a perturbation at t = 0; the state every frame
function fly(key, before, T, perturb) {
  const t = trimmed(key, before), out = [];
  if (perturb) perturb.at0 && perturb.at0(t);
  for (let f = 0; f < T * 60; f++) {
    if (perturb && perturb.ctl) perturb.ctl(t.sim.ctl, f / 60, t.trim);
    t.sim.step(1 / 60);
    out.push(state(t.sim, t.m));
  }
  return { tr: t, out };
}
// the analyses
function oscFit(ts, ys) {                    // a damped oscillation: extrema, period, the log decrement
  const amax = Math.max(...ys.map(Math.abs)), ext = [];
  for (let i = 1; i < ys.length - 1; i++) {
    if (Math.abs(ys[i]) < 0.03 * amax) continue;
    if ((ys[i] > ys[i-1] && ys[i] >= ys[i+1]) || (ys[i] < ys[i-1] && ys[i] <= ys[i+1])) {
      if (ext.length && Math.sign(ext[ext.length-1].y) === Math.sign(ys[i])) { if (Math.abs(ys[i]) > Math.abs(ext[ext.length-1].y)) ext[ext.length-1] = { t: ts[i], y: ys[i] }; continue; }
      ext.push({ t: ts[i], y: ys[i] });
    }
  }
  if (ext.length < 3) return { osc: false, ext: ext.length };
  const halves = []; for (let i = 1; i < ext.length; i++) halves.push(ext[i].t - ext[i-1].t);
  halves.sort((a, b) => a - b);
  const T = 2 * halves[halves.length >> 1], n = Math.min(ext.length, 6);
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const x = ext[i].t, y = Math.log(Math.abs(ext[i].y)); sx += x; sy += y; sxx += x*x; sxy += x*y; }
  const sig = -(n * sxy - sx * sy) / (n * sxx - sx * sx), wd = 2 * Math.PI / T;
  return { osc: true, T, sigma: sig, zeta: sig / Math.hypot(sig, wd), ext: ext.length, tHalf: Math.LN2 / sig };
}
const tCross = (ts, ys, y0, frac) => { for (let i = 0; i < ys.length; i++) if (Math.abs(ys[i]) <= frac * Math.abs(y0)) { const a = i ? Math.abs(ys[i-1]) : Math.abs(y0), b = Math.abs(ys[i]), ta = i ? ts[i-1] : 0; return ta + (ts[i] - ta) * (a - frac * Math.abs(y0)) / ((a - b) || 1); } return null; };
const tStays = (ts, ys, lim) => { let last = 0; for (let i = 0; i < ys.length; i++) if (Math.abs(ys[i]) > lim) last = ts[i]; return last; };
function expFit(ts, ys, t0, t1) {
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let i = 0; i < ts.length; i++) if (ts[i] >= t0 && ts[i] <= t1 && Math.abs(ys[i]) > 1e-6) { const x = ts[i], y = Math.log(Math.abs(ys[i])); sx += x; sy += y; sxx += x*x; sxy += x*y; n++; }
  return n > 5 ? (n * sxy - sx * sy) / (n * sxx - sx * sx) : null;
}

function modes(key, before) {
  const ref = fly(key, before, 60, null), R = ref.out, ts = R.map((_, i) => (i + 1) / 60);
  const dif = (o, k, wrap) => o.map((s, i) => { let d = s[k] - R[i][k]; if (wrap) d = Math.atan2(Math.sin(d), Math.cos(d)); return d; });
  const res = { trim: ref.tr.trim, V: ref.tr.Vt, refDrift: { dh60: R[R.length - 1].h - R[0].h, dphi60: R[R.length - 1].phi * 180 / Math.PI, dV60: R[R.length - 1].V - R[0].V } };
  // dutch roll: a rudder doublet (0.2 of full for 0.5 s each way)
  const dr = fly(key, before, 20, { ctl: (c, t, tr) => { c.dr = tr.dr + (t < 0.5 ? 0.2 : t < 1.0 ? -0.2 : 0); } });
  const dR = dif(dr.out, 'r').slice(0, 20 * 60), tsD = ts.slice(0, 20 * 60);
  const i0 = Math.round(1.2 * 60), fitD = oscFit(tsD.slice(i0), dR.slice(i0));
  res.dutch = fitD; res.dutchBetaMax = Math.max(...dif(dr.out, 'beta').map(Math.abs)) * 180 / Math.PI;
  // roll rate: a 0.3 rad/s kick about the forward axis
  const rp = fly(key, before, 15, { at0: t => kickRate(t.sim, t.m, t.s.f, 0.3) });
  const pR = dif(rp.out, 'p');
  res.roll = { tau: tCross(ts, pR, 0.3, 1 / Math.E), tHalf: tCross(ts, pR, 0.3, 0.5), phiAfter5s: dif(rp.out, 'phi', true)[5 * 60 - 1] * 180 / Math.PI };
  // yaw rate: a 0.2 rad/s kick about the up axis
  const ry = fly(key, before, 20, { at0: t => kickRate(t.sim, t.m, t.s.u, 0.2) });
  const rR = dif(ry.out, 'r');
  res.yaw = { tHalf: tStays(ts, rR, 0.1), t10: tStays(ts, rR, 0.02), osc: oscFit(ts.slice(6), rR.slice(6)) };
  // short period: a 0.2 rad/s pitch-rate kick
  const pq = fly(key, before, 10, { at0: t => kickRate(t.sim, t.m, t.s.rt, 0.2) });
  const qR = dif(pq.out, 'q');
  res.pitch = { tHalf: tStays(ts, qR, 0.1), t10: tStays(ts, qR, 0.02), osc: oscFit(ts, qR) };
  // spiral: a 10 deg bank about the velocity, the stick fixed for 60 s
  const sp = fly(key, before, 60, { at0: t => { const R0 = rigid(t.sim, t.m), vh = R0.u.map(x => x / Math.hypot(...R0.u)); turnAbout(t.sim, t.m, vh, 3 * Math.PI / 180); } });
  const phiD = dif(sp.out, 'phi', true), lam = expFit(ts, phiD, 5, 30);
  res.spiral = { lambda: lam, T2: lam > 0 ? Math.LN2 / lam : null, Thalf: lam < 0 ? -Math.LN2 / lam : null, phi10: phiD[10 * 60 - 1] * 180 / Math.PI, phi30: phiD[30 * 60 - 1] * 180 / Math.PI, phi60: phiD[60 * 60 - 1] * 180 / Math.PI,
                 hdg60: dif(sp.out, 'psi', true)[60 * 60 - 1] * 180 / Math.PI };
  res.series = { t: ts.filter((_, i) => i % 3 === 2), dutch_r: dR.filter((_, i) => i % 3 === 2), roll_p: pR.slice(0, 15 * 60).filter((_, i) => i % 3 === 2), spiral_phi: phiD.filter((_, i) => i % 3 === 2).map(x => x * 180 / Math.PI) };
  return res;
}

// ---- L(t) in vacuum ----
function Lseries(key, axis, before) {
  const def = L.defOf(key, { elastic: true }); delete def.params.damage; if (before) def.params.defDampMean = true;
  const m = def.nodes.map(nd => nd.m), sim = C.makeSim(def, null); sim.reset(0);
  sim.setAtmos(Object.assign({}, C.ATMOS_ISA, { rho: () => 1e-9, sigma: () => 1e-9 / C.ATMOS_ISA.rho(0) }), 0);
  for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += 3000;
  const ax = sim.axes(), a = axis === 'roll' ? ax[0] : axis === 'pitch' ? ax[2] : ax[1];
  kickRate(sim, m, a, 1);
  const N0 = Math.hypot(...rigid(sim, m).L), out = [1];
  for (let f = 1; f <= 600; f++) { sim.step(1 / 60); if (f % 6 === 0) out.push(Math.hypot(...rigid(sim, m).L) / N0); }
  return out;
}
function lPlot(key, S) {
  const W = 640, H = 300, x0 = 56, y0 = 30, w = W - x0 - 20, h = H - y0 - 50;
  const X = t => x0 + w * t / 10, Y = v => y0 + h * (1 - v / 1.1);
  let b = `<text x="${x0}" y="20" font-size="14" fill="${COL.ink}">${esc(L.BUILDS[key].label)}: |L| / L0 about the CG in vacuum, spun at 1 rad/s</text>`;
  for (let v = 0; v <= 1.0001; v += 0.25) b += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.grid}"/><text x="${x0 - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="${COL.ink2}">${v.toFixed(2)}</text>`;
  for (let t = 0; t <= 10; t += 2) b += `<text x="${X(t)}" y="${y0 + h + 16}" font-size="11" text-anchor="middle" fill="${COL.ink2}">${t} s</text>`;
  const dash = { roll: '', pitch: '6 3', yaw: '2 3' };
  for (const axis of ['roll', 'pitch', 'yaw']) for (const k of ['before', 'after']) {
    const s = S[axis][k]; b += `<polyline fill="none" stroke="${COL[k]}" stroke-width="2" ${dash[axis] ? `stroke-dasharray="${dash[axis]}"` : ''} points="${s.map((v, i) => X(i * 0.1).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`;
  }
  b += `<text x="${X(10)}" y="${Y(S.roll.after[100]) - 6}" font-size="12" text-anchor="end" fill="${COL.after}">after (G1885): kept, worst ${(Math.max(...['roll', 'pitch', 'yaw'].map(a => Math.max(...S[a].after.map(v => Math.abs(v - 1)))))).toExponential(1)}</text>`;
  b += `<text x="${X(2.2)}" y="${Y(0.368) - 8}" font-size="12" fill="${COL.before}">before: exp(-0.5 t) on all three axes</text>`;
  b += `<text x="${x0}" y="${H - 10}" font-size="11" fill="${COL.ink2}">solid roll, dashed pitch, dotted yaw; blue before (the mean's damper), orange after (the rigid field's)</text>`;
  return svgDoc(W, H, b, 'L about the CG, ' + L.BUILDS[key].label);
}

const RES = {};
if (!PERF_ONLY && !argv.includes('--no-L')) {
  for (const key of KEYS) {
    const S = {};
    for (const axis of ['roll', 'pitch', 'yaw']) S[axis] = { before: Lseries(key, axis, true), after: Lseries(key, axis, false) };
    fs.writeFileSync(path.join(OUT, 'L_' + key + '.svg'), lPlot(key, S));
    RES['L:' + key] = { roll: [1, 2, 4, 10].map(t => [S.roll.before[t * 10], S.roll.after[t * 10]]), pitch: [1, 2, 4, 10].map(t => [S.pitch.before[t * 10], S.pitch.after[t * 10]]), yaw: [1, 2, 4, 10].map(t => [S.yaw.before[t * 10], S.yaw.after[t * 10]]) };
    console.log('L', key, JSON.stringify(RES['L:' + key]));
  }
}
if (!PERF_ONLY && !argv.includes('--no-modes')) {
  const MO = {};
  const f2 = (x, d = 2) => x == null || !Number.isFinite(x) ? '-' : x.toFixed(d);
  for (const key of KEYS) {
    MO[key] = { before: modes(key, true), after: modes(key, false) };
    for (const k of ['before', 'after']) {
      const r = MO[key][k];
      console.log(`modes ${key} ${k}: trim thr ${f2(r.trim.thr)} de ${f2(r.trim.de, 3)} da ${f2(r.trim.da, 3)} dr ${f2(r.trim.dr, 3)} V ${f2(r.V, 1)} | dutch ${r.dutch.osc ? `T ${f2(r.dutch.T)} s zeta ${f2(r.dutch.zeta, 3)} t1/2 ${f2(r.dutch.tHalf)} s` : 'no oscillation (' + r.dutch.ext + ' extrema)'} | roll tau ${f2(r.roll.tau, 3)} s | yaw t1/2 ${f2(r.yaw.tHalf)} s | pitch t1/2 ${f2(r.pitch.tHalf)} s | spiral ${r.spiral.T2 ? 'T2 ' + f2(r.spiral.T2, 1) + ' s' : 'T1/2 ' + f2(r.spiral.Thalf, 1) + ' s'} (phi 10/30/60 s ${f2(r.spiral.phi10, 1)}/${f2(r.spiral.phi30, 1)}/${f2(r.spiral.phi60, 1)} deg) | ref drift 60 s dh ${f2(r.refDrift.dh60, 1)} m dphi ${f2(r.refDrift.dphi60, 1)} deg dV ${f2(r.refDrift.dV60, 2)}`);
    }
  }
  const prev = fs.existsSync(path.join(OUT, 'modes.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'modes.json'), 'utf8')) : {};
  fs.writeFileSync(path.join(OUT, 'modes.json'), JSON.stringify(Object.assign(prev, MO), null, 1));
}

// perf: the base core (--perf-base) against this one, alternating child processes, nothing touching
if (!argv.includes('--no-perf')) {
  const base = opt('perf-base', null), mine = path.join(__dirname, 'flight_core.js');
  const { spawnSync } = require('child_process');
  const one = (core, k, mode) => { const r = spawnSync(process.execPath, [__filename, '--perf-child', core, k, mode], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); return l ? JSON.parse(l.slice(5)) : null; };
  const P = {}, reps = +opt('perf-reps', 5);
  for (const k of ['cub', 'metal']) for (const mode of ['ground', 'air']) {
    const rows = { base: [], mine: [] };
    for (let rep = 0; rep < reps; rep++) { if (base) rows.base.push(one(base, k, mode)); rows.mine.push(one(mine, k, mode)); }
    const med = a => { const v = a.filter(Boolean).map(x => x.med).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
    P[k + ':' + mode] = { base: med(rows.base), mine: med(rows.mine), runs: rows };
    const b = P[k + ':' + mode].base, n = P[k + ':' + mode].mine;
    console.log('perf', k, mode, 'base', b && b.toFixed(4), 'ms, now', n.toFixed(4), 'ms', b ? ((n / b - 1) * 100).toFixed(2) + ' %' : '', `(the median of ${reps} processes' medians, 600 steps each)`);
  }
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(P, null, 1));
}
