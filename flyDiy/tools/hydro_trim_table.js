#!/usr/bin/env node
// hydro_trim_table.js - G3441 (HYDRO-TRIM): THE VALIDATED FLOATPLANES' WATER TAKE-OFFS, ONE TABLE, ANY CORE.
//
// Flies every float build the user has validated (and the G3390 172R on Wipline 2350s) off the sea south of HOME
// (0, 1600), damage ON, with the G3390 rig's technique (tools/sea_to_g3390.js: full throttle, stick back (de 0.45),
// the step attitude held by a PD once the water speed passes 9 m/s, no flap, no rotation: the wing lifts it off at the
// step attitude), and THE FLOATPLANE SUPPLEMENT's ('poh': the Cessna 172 floatplane POH - wing flaps 20 deg, the same
// stick through the hump and onto the step, and the lift-off made: the stick back at Vr, 50 KIAS on the 172R = 0.97 Vs
// of the loaded build clean, ~1.1 Vs at 20 deg of flap). It prints, per build and technique, the
// hump (the largest R/W under 14 m/s, its speed and trim) and the LIFT-OFF: the first instant both floats stay dry
// for 2 s (a porpoise's skip is not a lift-off), its time from throttle-up, the water speed and the run.
//
//   node tools/build.js && node tools/hydro_trim_table.js              this tree's core
//   node tools/hydro_trim_table.js --core <path/to/flight_core.js>     another tree's (the before of a change)
//   options: --only key[,key]  --max 90  --json <file>
// keys: c172r_stc (the 172R + 2350, STC 82x43 prop, the STC gross 1,157 kg), c172r_land (the land prop, gross),
//       floats (bugReports/cessnaFloatsWOrks.json as built), wipline (tools/fixtures/build_v10_c172_wipline2350,
//       as built), twin (GATE FLOATS' twin on floats: build_v7_ultralight + the float patch).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, FLY = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const C = require(path.resolve(opt('core', path.join(T, 'flight_core.js'))));
const MAXS = +opt('max', 90), ONLY = opt('only', '').split(',').filter(Boolean);
const STC_GROSS = 1157;
const mass = def => def.nodes.reduce((a, n) => a + n.m, 0);
const readSpec = rel => { const j = JSON.parse(fs.readFileSync(path.join(FLY, rel), 'utf8')); return j.spec || j; };
const build = S => C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(S))));
// the G3390 loading: two pilots, full fuel, baggage up to the STC gross
function gross(S0) {
  const S = JSON.parse(JSON.stringify(S0));
  S.cabin = Object.assign({}, S.cabin, { pilots: 2, pax: 0 }); S.cargo = Object.assign({}, S.cargo, { kg: 0 });
  let def = build(S);
  const M = mass(def);
  if (M < STC_GROSS) { S.cargo.kg = Math.min(400, STC_GROSS - M); def = build(S); }
  return def;
}
const CASES = {
  c172r_stc: { label: '172R + 2350, STC prop, 1157 kg', def: () => gross(readSpec('builds/c172r_wipline2350_stcprop_2026-10-20.json')) },
  c172r_land: { label: '172R + 2350, land prop, 1157 kg', def: () => gross(readSpec('builds/c172r_wipline2350_landprop_2026-10-20.json')) },
  floats: { label: 'Cessna floats (cessnaFloatsWOrks)', def: () => build(readSpec('bugReports/cessnaFloatsWOrks.json')) },
  wipline: { label: 'Wipline fixture (172 on 2350s, v10)', def: () => build(readSpec('tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json')) },
  twin: { label: 'twin on floats (GATE FLOATS)', def: () => { const S = readSpec('tools/fixtures/build_v7_ultralight_2026-09-05.json'); S.gear.type = 'floats'; S.cage = Object.assign({}, S.cage, { gearFloats: 1 }); return build(S); } },
};
// G3446 (HYDRO-TRIM, after train L25b): THE PILOT'S FEET AND HANDS. G2080 (ENGINE-TORQUE) made the propeller's torque,
// P-factor and swirl real: with the rudder and the ailerons left alone the 172R swung 45 deg off its heading in 12 s and
// heeled 17-19 deg onto a float - every take-off a water loop. A float pilot holds the heading with the rudder (the
// water rudders below their raise speed, the air rudder on the step) and the wings level with the ailerons: the rudder
// on the heading error from the throttle-up (2 per rad, damped by the yaw rate), the ailerons on the roll (2 per rad,
// damped). Signs measured on the 172R (+dr swings the nose further the torque's way, -da lifts the low wing).
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
function latHold(sim, L) {
  const [xA, yU] = sim.axes(), psi = Math.atan2(xA[2], xA[0]), roll = Math.asin(Math.max(-1, Math.min(1, yU[2])));
  if (L.psi0 == null) { L.psi0 = psi; L.e = 0; L.roll = roll; }
  const e = wrapPi(psi - L.psi0), de = (e - L.e) * 60, dr = (roll - L.roll) * 60;
  L.e = e; L.roll = roll;
  sim.ctl.dr = Math.max(-1, Math.min(1, 2 * e + 1.0 * de));
  sim.ctl.da = Math.max(-1, Math.min(1, 2 * roll + 0.5 * dr));
}
function fly(def, poh) {
  const world = C.makeWorld(), X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
  def.params.damage = true;
  world.setWind({ base: [0, 0, 0], gust: 0, refH: 10 });
  const sim = C.makeSim(def, world); sim.reset(0);
  const M = mass(def), Wt = M * 9.81, p = sim.p, v = sim.v, iK = def.refs.mains[0];
  { const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = (h + 0.3) - p[iK * 3 + 1];
    for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; } }
  sim.ctl.thr = 0;
  for (let s = 0; s < 60 * 8; s++) sim.step(1 / 60);
  const F = sim.hydro.floats;
  const st = () => {
    const [xA] = sim.axes(); let vx = 0, vz = 0, x = 0, z = 0;
    for (let i = 0; i < sim.n; i++) { vx += sim.v[i * 3] * sim.m[i]; vz += sim.v[i * 3 + 2] * sim.m[i]; x += sim.p[i * 3] * sim.m[i]; z += sim.p[i * 3 + 2] * sim.m[i]; }
    const V = Math.hypot(vx, vz) / M, ux = V > 0.05 ? vx / M / V : -1, uz = V > 0.05 ? vz / M / V : 0;
    // (G3446: the speed along the track and the water's force against the motion - a swing read as a slow-down)
    return { V, x: x / M, z: z / M, trim: Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI,
             R: -F.reduce((a, q) => a + q.out.F[0] * ux + q.out.F[2] * uz, 0) / Wt, wet: F.reduce((a, q) => a + q.wet, 0) };
  };
  const s0 = st(), x0 = s0.x, z0 = s0.z, LAT = {}, Vr = 0.97 * ((def.params.gen && def.params.gen.Vs) || 25);
  let swing = 0;
  sim.ctl.thr = 1; sim.ctl.de = 0.45;
  // 20 deg of flap, as a fraction of the build's own travel (00_registry / 60_gen_spec genTravel)
  if (poh) { const fl = def.spec.controls && def.spec.controls.flap; sim.ctl.flap = fl && fl.type && fl.type !== 'none' ? Math.min(1, 20 * Math.PI / 180 / C.genTravel('flap', fl.type)) : 0; }
  let tP = null, hump = { R: 0, V: 0, trim: 0 }, dry = null, out = null, crashed = null, rot = false, past = null;
  for (let s = 0; s < MAXS * 60 && !out; s++) {
    sim.step(1 / 60);
    const r = st(), t = (s + 1) / 60;
    if (!Number.isFinite(r.V)) { crashed = 'non-finite'; break; }
    if (sim.out.dmg && sim.out.dmg.crashed) { crashed = 'crashed'; break; }
    const tq = tP == null ? 0 : (r.trim - tP) * 60; tP = r.trim;
    if (poh && (sim.out.V || 0) >= Vr) rot = true;
    sim.ctl.de = rot ? 0.45 : r.V > 9 ? Math.max(-0.2, Math.min(0.45, 0.2 + 0.04 * (6 - r.trim) - 0.01 * tq)) : 0.45;
    latHold(sim, LAT); swing = Math.max(swing, Math.abs(LAT.e) * 180 / Math.PI);
    if (r.wet > 0 && r.V < 14 && r.R > hump.R) hump = { R: r.R, V: r.V, trim: r.trim };
    if (!past && r.V >= 16 && r.wet > 0) past = { R: r.R, t, trim: r.trim };
    if (r.wet === 0) { if (!dry) dry = { t, V: r.V, dist: Math.hypot(r.x - x0, r.z - z0) }; else if (t - dry.t >= 2) out = dry; }
    else dry = null;
  }
  const b = def.parts.floats[0].P.B;
  hump.Cv = hump.V / Math.sqrt(9.81 * b);
  return { M: Math.round(M), Vr: +Vr.toFixed(1), hump, past, air: out, crashed, swing };
}
const f = (v, d = 3) => (v == null || !Number.isFinite(v)) ? '-' : (+v).toFixed(d);
// GATE HYDROTRIM flies these same flights (require: no table printed)
if (require.main !== module) module.exports = { C, CASES, fly, mass };
else {
const rows = [];
for (const [key, c] of Object.entries(CASES)) {
  if (ONLY.length && !ONLY.includes(key)) continue;
  for (const poh of [false, true]) {
    const r = fly(c.def(), poh);
    rows.push(Object.assign({ key, tech: poh ? 'poh' : 'rig' }, r));
    console.log(`${key.padEnd(10)} ${poh ? 'POH      ' : 'G3390 rig'} | ${r.M} kg | hump R/W ${f(r.hump.R)} at ${f(r.hump.V, 1)} m/s, trim ${f(r.hump.trim, 1)} | ` +
      (r.air ? `LIFT-OFF ${f(r.air.t, 1)} s, ${f(r.air.V, 1)} m/s, run ${Math.round(r.air.dist)} m` : `not off in ${MAXS} s`) +
      (poh ? ` (Vr ${r.Vr} m/s)` : '') + ` | swing ${f(r.swing, 1)} deg` + (r.crashed ? ` | ${r.crashed}` : ''));
  }
}
if (opt('json')) fs.writeFileSync(path.resolve(opt('json')), JSON.stringify(rows, null, 1));
}
