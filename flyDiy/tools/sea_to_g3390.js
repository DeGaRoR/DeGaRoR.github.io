#!/usr/bin/env node
// sea_to_g3390.js - G3390 (FINAL CESSNA floats, RUFUS-CERT for A0, 20 Oct 2026): THE SEA TAKE-OFF RIG.
//
// The user's ruling: "taking the validated C172 and putting the exact Wipaire floats on it should work out of the box,
// otherwise we have another issue with realism." This flies a seaplane build off the sea, damage ON, and logs every
// second what decides a water take-off: the speed, the trim, the thrust (sim.out.thrust / W), the water's drag
// (the floats' fore-aft force / W), the aerodynamic drag by difference (T/W - R/W - a/g), the steps' ventilation.
//
// The builds (flyDiy/builds/, see reports/evidence/G3390/README.md for how they were made):
//   c172r_wipline2350_landprop_2026-10-20.json   the corrected 172R on Wipline 2350s (the editor's own preset, the
//                                                catalogue's float), the land prop as built (1.905 m, standard pitch)
//   c172r_wipline2350_stcprop_2026-10-20.json    the same with Wipaire's STC float prop (McCauley 1A200/WFA8243,
//                                                82 x 43 in: D 2.083 m, 'climb' pitch)
// The loadings: 'gross' = 2 pilots, full fuel, baggage up to the STC gross 1,157 kg (2,550 lb); 'half' = 2 pilots,
// half fuel. The winds: m/s along +x (the run is towards -x, so + is a HEADWIND; 4.12 = 8 kt).
// The technique is GATE FLOATS': full throttle, stick back (de 0.45), the step attitude (--step-trim, deg) held by a PD
// on the elevator once the water speed passes --step-v (m/s); 90 s on the clock.
// G3441 (HYDRO-TRIM): and, beside it, the Cessna 172 FLOATPLANE SUPPLEMENT's ('poh'): wing flaps 20 deg, the same stick
// through the hump and onto the step, and the lift-off MADE - the stick back at 50 KIAS (--vr, m/s of airspeed). The
// lift-off is now the first instant both floats stay dry for 2 s (a porpoise's skip read as 'airborne' before: the
// 8 kt rows lifted at 16 m/s of water speed, below the stall). --tech g3390,poh (default both).
//
//   node tools/build.js                       (the core must be fresh: _core_fresh refuses a stale one)
//   node tools/sea_to_g3390.js                the 8 runs (2 builds x gross/half x calm/8 kt) -> reports/evidence/G3390/sea_to_result.json
//   node tools/sea_to_g3390.js --builds builds/c172r_wipline2350_stcprop_2026-10-20.json --kinds gross --winds 0 \
//        --step-v 4 --tag _easeat4             one run, the stick eased from 4 m/s
//   options: --builds a.json[,b.json] (repo-relative to flyDiy/) --kinds gross,half --winds 0,4.12 --step-v 9
//            --step-trim 6 --max 90 --out <dir> --tag <suffix> --airspeed (print sim.out.ias each second)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, FLY = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const BUILDS = opt('builds', 'builds/c172r_wipline2350_landprop_2026-10-20.json,builds/c172r_wipline2350_stcprop_2026-10-20.json').split(',');
const KINDS = opt('kinds', 'gross,half').split(','), WINDS = opt('winds', '0,4.12').split(',').map(Number);
const STEP_V = +opt('step-v', 9), STEP_TRIM = +opt('step-trim', 6), MAXS = +opt('max', 90);
const TECHS = opt('tech', 'g3390,poh').split(','), VR = +opt('vr', 25.7);   // 50 KIAS: the 172 floatplane POH's lift-off
const OUT = path.resolve(FLY, opt('out', 'reports/evidence/G3390')), TAG = opt('tag', ''), AIRSPD = argv.includes('--airspeed');
const STC_GROSS = 1157;   // kg: 2,550 lb, Wipaire's Wipline 2350 table for the 172R / 172S
const f = (v, d = 3) => (v == null || !isFinite(v)) ? '-' : (+v).toFixed(d);
const world = C.makeWorld();
const X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
const mass = def => def.nodes.reduce((a, n) => a + n.m, 0);
const load = (spec, kind) => {
  const S = JSON.parse(JSON.stringify(spec));
  S.cabin = Object.assign({}, S.cabin, { pilots: 2, pax: 0 });
  const v0 = S.energy && S.energy.vessels && S.energy.vessels[0];
  const L0 = (v0 && v0.capacity) || S.fuel.litres;
  const setFuel = L => { S.fuel.litres = L; if (v0) v0.capacity = L; };
  S.cargo = Object.assign({}, S.cargo, { kg: 0 });
  if (kind === 'half') setFuel(L0 / 2);
  let def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(S)))), M = mass(def);
  if (kind === 'gross' && M < STC_GROSS) {
    S.cargo.kg = Math.min(400, STC_GROSS - M);
    def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(S)))); M = mass(def);
  }
  return { def, M, fuelL: S.fuel.litres, cargo: S.cargo.kg };
};
const out = [];
for (const b of BUILDS) {
  const env = JSON.parse(fs.readFileSync(path.join(FLY, b), 'utf8')), spec = env.spec || env;
  const fl = spec.gear && spec.gear.floats || {};
  console.log(b + ': floats L ' + f(fl.L, 2) + ' B ' + f(fl.B, 2) + ' step ' + f(fl.xs, 2) + ' m (' + f(fl.xs / fl.L, 3) + ' L) hs ' + f(fl.hs, 3) + '; prop D ' + spec.prop.D + ' ' + spec.prop.pitch);
  for (const tech of TECHS) for (const kind of KINDS) for (const wind of WINDS) {
    const poh = tech === 'poh';
    const { def, M, fuelL, cargo } = load(spec, kind);
    def.params.damage = true;
    world.setWind({ base: [wind, 0, 0], gust: 0, refH: 10 });
    const sim = C.makeSim(def, world); sim.reset(0);
    const Wt = M * 9.81, p = sim.p, v = sim.v, iK = def.refs.mains[0];
    { const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = (h + 0.3) - p[iK * 3 + 1];
      for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; } }
    sim.ctl.thr = 0;
    for (let s = 0; s < 60 * 8; s++) sim.step(1 / 60);       // settle on the water
    const st = () => {
      const [xA] = sim.axes(); let vx = 0, mm = 0, x = 0;
      for (let i = 0; i < sim.n; i++) { vx += sim.v[i * 3] * sim.m[i]; x += sim.p[i * 3] * sim.m[i]; mm += sim.m[i]; }
      const F = sim.hydro.floats;
      return { V: -vx / mm, x: x / mm, trim: Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI,
               R: F.reduce((a, q) => a + q.out.F[0], 0) / Wt, Fy: F.reduce((a, q) => a + q.out.F[1], 0) / Wt,
               wet: F.reduce((a, q) => a + q.wet, 0), vent: Math.min(...F.map(q => q.out.vent || 0)), Th: (sim.out.thrust || 0) / Wt };
    };
    const x0 = st().x, ser = [];
    sim.ctl.thr = 1; sim.ctl.de = 0.45;
    // 20 deg of flap as a fraction of the build's own travel
    if (poh) { const fl = spec.controls && spec.controls.flap; sim.ctl.flap = fl && fl.type && fl.type !== 'none' ? Math.min(1, 20 * Math.PI / 180 / C.genTravel('flap', fl.type)) : 0; }
    let tP = null, Tm = 0, air = null, dry = null, rot = false, hump = { R: 0, V: 0, Th: 0 }, prevV = 0, crashed = false;
    for (let s = 0; s < MAXS * 60; s++) {
      sim.step(1 / 60); Tm += 1 / 60;
      const r = st();
      if (!isFinite(r.V)) { crashed = 'non-finite'; break; }
      const tq = tP == null ? 0 : (r.trim - tP) * 60; tP = r.trim;
      if (poh && (sim.out.V || 0) >= VR) rot = true;
      sim.ctl.de = rot ? 0.45 : r.V > STEP_V ? Math.max(-0.2, Math.min(0.45, 0.2 + 0.04 * (STEP_TRIM - r.trim) - 0.01 * tq)) : 0.45;
      const a = (r.V - prevV) * 60 / 9.81; prevV = r.V;
      if (r.wet > 0 && r.V < 14 && r.R > hump.R) hump = { R: r.R, V: r.V, Th: r.Th, trim: r.trim };
      if (s % 60 === 59) {
        if (AIRSPD) console.log('   t' + Math.round(Tm) + ' V(water) ' + r.V.toFixed(1) + ' ias ' + JSON.stringify(sim.out.ias ?? null));
        ser.push({ t: Math.round(Tm), V: +r.V.toFixed(2), trim: +r.trim.toFixed(2), T: +r.Th.toFixed(4), R: +r.R.toFixed(4), D: +(r.Th - r.R - a).toFixed(4), vent: +r.vent.toFixed(3), wet: +r.wet.toFixed(2) });
      }
      if (r.wet === 0 && r.Fy === 0 && s > 60) { if (!dry) dry = { t: +Tm.toFixed(1), V: +r.V.toFixed(1), dist: Math.round(Math.abs(r.x - x0)) }; else if (Tm >= dry.t + 2) { air = dry; break; } }
      else dry = null;
      if (sim.out.dmg && sim.out.dmg.crashed) { crashed = 'damage: crashed'; break; }
    }
    const row = { build: b, tech, flap: sim.ctl.flap, kind, windMs: wind, mass: Math.round(M), fuelL: Math.round(fuelL), cargo: Math.round(cargo), stepV: STEP_V, stepTrim: STEP_TRIM,
      T1: ser[0] ? ser[0].T : null, hump: { R: +hump.R.toFixed(3), V: +hump.V.toFixed(2), T: +hump.Th.toFixed(3), trim: hump.trim != null ? +hump.trim.toFixed(1) : null },
      airborne: air, crashed, series: ser };
    out.push(row);
    console.log('  ' + tech.padEnd(5) + ' ' + kind.padEnd(5) + ' wind ' + wind + ' m/s | ' + row.mass + ' kg (fuel ' + row.fuelL + ' L, baggage ' + row.cargo + ' kg) | T/W at 1 s ' + f(row.T1) +
      ' | hump R/W ' + f(row.hump.R) + ' at ' + f(row.hump.V, 1) + ' m/s (T/W ' + f(row.hump.T) + ', trim ' + row.hump.trim + ') | ' +
      (air ? 'AIRBORNE ' + air.t + ' s, ' + air.V + ' m/s, run ' + air.dist + ' m' : 'NOT airborne in ' + MAXS + ' s') + (crashed ? ' | ' + crashed : ''));
  }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'sea_to_result' + TAG + '.json'), JSON.stringify(out, null, 1));
console.log('wrote ' + path.relative(FLY, path.join(OUT, 'sea_to_result' + TAG + '.json')));
