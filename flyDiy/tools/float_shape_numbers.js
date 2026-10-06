#!/usr/bin/env node
// float_shape_numbers.js - THE HYDRO NUMBERS A FLOAT'S SHAPE MOVES (FLOAT-SHAPE, G1930, 2026-10-05)
//
// For each build: the pair's volume to the deck, the settle on the sea (L/W, draft at the step, trim), and a full-throttle
// take-off with GATE FLOATS' technique (stick back 0.45, eased to 0.2 past 14 m/s): the hump (max R/W under 14 m/s and its
// speed), the time and distance onto the step (trim peak passed, R/W back under half the hump), the lift-off (time, run
// along the track, speed). Headless, the real solver; a JSON line per build.
//
//   node tools/float_shape_numbers.js [--core tools/flight_core.js] [--json out.json]
//        [--builds cessna,cessnaWorks,twin]  (cessna = the WIPLINE fixture, cessnaWorks = bugReports/cessnaFloatsWOrks.json,
//                                             twin = GATE FLOATS' ultralight on floats)
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const CORE = path.resolve(opt('core', path.join(__dirname, 'flight_core.js')));
const C = require(CORE);
// the builds are read from the core's own tree (a baseline worktree's core flies that tree's fixtures)
const T = path.dirname(CORE);
const BUILDS = {
  cessna: { file: path.join(T, 'fixtures', 'build_v10_c172_wipline2350_2026-09-20.json'), label: 'the Cessna 172 on Wipline 2350s (GATE WIPLINE fixture)' },
  cessnaWorks: { file: path.join(T, '..', 'bugReports', 'cessnaFloatsWOrks.json'), label: 'the Cessna on floats the user validated (W-CHECK, custom rows)' },
  twin: { file: path.join(T, 'fixtures', 'build_v7_ultralight_2026-09-05.json'), floats: true, label: 'the twin-582 ultralight on floats (GATE FLOATS)' },
};
const want = opt('builds', 'cessna,cessnaWorks,twin').split(',');
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? +v.toFixed(n) : null;
const out = {};
for (const key of want) {
  const B = BUILDS[key]; if (!B) continue;
  const j = JSON.parse(fs.readFileSync(B.file, 'utf8')), spec = j.spec || j;
  if (B.floats) spec.gear.type = 'floats';
  const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  const fl = def.parts.floats, P = fl[0].P;
  let M = 0; for (const n of def.nodes) M += n.m;
  const W = M * 9.81;
  const F = C.HYDRO.makeFloat(P);
  const world = C.makeWorld(), X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
  const state = (sim) => {
    const [xA, yU] = sim.axes();
    const trim = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI;
    let vx = 0, vz = 0, mm = 0, cx = 0, cz = 0;
    for (let i = 0; i < sim.n; i++) { vx += sim.v[i * 3] * sim.m[i]; vz += sim.v[i * 3 + 2] * sim.m[i]; cx += sim.p[i * 3] * sim.m[i]; cz += sim.p[i * 3 + 2] * sim.m[i]; mm += sim.m[i]; }
    const flo = sim.hydro.floats;
    return { V: Math.hypot(vx, vz) / mm, x: cx / mm, z: cz / mm, trim,
             Fy: flo.reduce((s, x) => s + x.out.F[1], 0) / W, R: flo.reduce((s, x) => s + x.out.F[0], 0) / W,
             wet: flo.reduce((s, x) => s + x.wet, 0), draft: flo.map(x => x.h - x.out.W[x.F.edge.K][1]) };
  };
  const sim = C.makeSim(def, world); sim.reset(0);
  { const p = sim.p, v = sim.v, iK = def.refs.mains[0];
    const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = (h + 0.3) - p[iK * 3 + 1];
    for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; } }
  sim.ctl.thr = 0;
  let Fy = 0, dr = 0, tr = 0, n = 0;
  for (let s = 0; s < 600; s++) { sim.step(1 / 60); if (s >= 480) { const r = state(sim); Fy += r.Fy; dr += 0.5 * (r.draft[0] + r.draft[1]); tr += r.trim; n++; } }
  const settle = { LW: f(Fy / n), draftStep: f(dr / n), trim: f(tr / n, 2) };
  // the take-off
  sim.ctl.thr = 1; sim.ctl.de = 0.45;
  let t = 0, run = 0, hump = { R: 0, V: 0, t: 0 }, onStep = null, lift = null, trimMax = -Infinity, p0 = state(sim);
  let prev = p0;
  for (let s = 0; s < 60 * 60; s++) {
    sim.step(1 / 60); t += 1 / 60;
    const r = state(sim);
    if (!Number.isFinite(r.V)) break;
    run += Math.hypot(r.x - prev.x, r.z - prev.z); prev = r;
    sim.ctl.de = r.V > 14 ? 0.2 : 0.45;
    if (r.wet > 0 && r.V < 14 && r.R > hump.R) hump = { R: r.R, V: r.V, t };
    if (r.wet > 0) trimMax = Math.max(trimMax, r.trim);
    if (onStep == null && hump.R > 0 && r.V > hump.V + 1 && r.R < 0.6 * hump.R) onStep = { t: f(t, 1), run: f(run, 0), V: f(r.V, 1) };
    if (lift == null && r.wet === 0 && r.Fy === 0 && s > 60) { lift = { t: f(t, 1), run: f(run, 0), V: f(r.V, 1) }; break; }
  }
  out[key] = { label: B.label, preset: P.preset || 'custom', L: f(P.L, 2), B: f(P.B, 2), H: f(P.H, 3), beta: f(P.beta, 1), betaA: f(P.betaA, 1),
    gross: f(M, 0), pairDispKg: f(2 * F.volDeck * P.rho, 0), reserve: f(2 * F.volDeck * P.rho / M, 2), settle,
    hump: { RW: f(hump.R), V: f(hump.V, 1), t: f(hump.t, 1) }, trimMax: f(trimMax, 1), onStep, liftOff: lift };
  console.log('FLOAT_NUMBERS ' + JSON.stringify(Object.assign({ build: key }, out[key])));
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
