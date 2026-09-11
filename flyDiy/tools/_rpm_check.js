#!/usr/bin/env node
// GATE RPM — the panel arc's sources (session 1, 2026-09-11): the shaft
// speed, the burn, the load factor, the engine that can be off.
//
//   node tools/_rpm_check.js             -> "GATE RPM: PASS|FAIL"
//   node tools/_rpm_check.js --selftest  -> negative verification
//   node tools/_rpm_check.js --show      -> print the anchor table
//
// WHAT IS PROTECTED. Every needle on the panel reads one of these, and each
// can go quietly wrong: a registry row with no rated speed makes a tacho
// that reads 2300 on a Rotax; a static-speed constant that drifts puts the
// J-3's needle 200 rpm off at cruise with nothing else moving; a burn that
// stops draining leaves a fuel gauge frozen at full; a load factor with the
// wrong sign reads 1 g in free fall. The anchors are the REAL aeroplane's
// (a J-3 on an A-65 with the 74CK: 2150 tied down, 2200-2250 in the climb,
// 2300 in cruise), tolerance 3 %, and the law is ONE constant on top of
// numbers the model already had.
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));

const SELFTEST = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');
const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};
const cl = o => JSON.parse(JSON.stringify(o));
const within = (x, ref, tol) => Math.abs(x - ref) <= tol * ref;

function run() {
  fail.length = 0;
  // ---- 1. THE CENSUS: every row carries a rated speed ----------------------
  for (const [k, row] of Object.entries(C.POWERPLANTS)) {
    const e = row.engine || {};
    check(e.rpm > 0 && e.rpm <= 14000, 'census: ' + k + ' carries a rated rpm');
    check(e.gear === undefined || (e.gear >= 1 && e.gear <= 5), 'census: ' + k + ' gear in 1..5');
    check(!!e.cs === (e.aspiration === 'turbine'),
      'census: cs (constant-speed) on every turbine row and no other', k);
  }

  // ---- 2. THE LAW, on the A-65 / 74CK -------------------------------------
  const pp = C.POWERPLANTS.a65_sensenich74;
  const at = (thr, V, run = true, sig = 1, pk = 1) =>
    C.genShaftRpm(pp.engine, pp.prop, thr, V, sig, pk, run);
  const nStatic = at(1, 0), nClimb = at(1, 24), nCruise = at(1, 33);
  const rows = [['static, full throttle', nStatic, 2150],
                ['climb 24 m/s', nClimb, 2225],
                ['cruise 33 m/s', nCruise, 2300]];
  if (SHOW) {
    console.log('  A-65 / Sensenich 74CK — the law against the J-3');
    for (const [l, n, ref] of rows)
      console.log('    ' + l.padEnd(24) + n.toFixed(0).padStart(6) + '  real ' + ref);
    console.log('    idle on the ground      ' + at(0, 0).toFixed(0).padStart(6) + '  real ~650');
    console.log('    dead, 30 m/s (windmill) ' + at(0, 30, false).toFixed(0).padStart(6));
  }
  for (const [l, n, ref] of rows)
    check(within(n, ref, 0.03), 'law: ' + l + ' within 3 % of the J-3', n.toFixed(0) + ' vs ' + ref);
  check(within(at(0, 0), 650, 0.08), 'law: the A-65 idles near 650', at(0, 0).toFixed(0));
  // monotone in throttle and in airspeed
  let mono = true, prev = -1;
  for (let t = 0; t <= 1.0001; t += 0.1) { const n = at(t, 20); if (n < prev) mono = false; prev = n; }
  check(mono, 'law: rpm rises with throttle');
  prev = -1; mono = true;
  for (let V = 0; V <= 60; V += 5) { const n = at(1, V); if (n < prev) mono = false; prev = n; }
  check(mono, 'law: a fixed-pitch prop unloads with airspeed');
  // a dead engine windmills, and turns nothing when stopped
  check(at(0, 30, false) > 500 && at(0, 30, false) < at(0, 30, true),
    'law: a dead engine at 30 m/s windmills below a live idle');
  check(at(0, 0, false) === 0, 'law: a dead engine at rest turns nothing');
  // thin air: less torque, lower static rpm
  check(at(1, 0, true, 0.8, 0.77) < nStatic, 'law: static rpm falls in thin air');
  // a constant-speed row holds its governed speed
  const pt6 = C.POWERPLANTS.pt6a114a_hartzell3;
  check(C.genShaftRpm(pt6.engine, pt6.prop, 0.4, 60, 1, 1, true) === pt6.engine.rpm,
    'law: a turbine row is governed to its Np');
  check(C.genShaftRpm(pt6.engine, pt6.prop, 0.4, 60, 1, 1, false) === 0,
    'law: a stopped turbine turns nothing');
  // the reduction unit: a 912's tacho reads engine speed
  const r912 = C.POWERPLANTS.rotax912_warp;
  const p912 = C.genShaftRpm(r912.engine, r912.prop, 1, 30, 1, 1, true);
  check(within(C.genEngineRpm(r912.engine, p912), p912 * 2.27, 1e-9),
    'law: the tacho reads through the reduction unit');
  check(within(p912, 5800 / 2.27, 0.15), 'law: the 912 prop turns near its rated 2555 at cruise',
    p912.toFixed(0));

  // ---- 3. THE SIM: burn, nz, the key ----------------------------------------
  const def = C.buildGen(cl(C.GEN_DEFAULT));
  const sim = C.makeSim(def, null);
  sim.reset();
  sim.ctl.thr = 0; sim.ctl.brake = 1;
  const kg0 = sim.fuel.kg0;
  check(kg0 > 5, 'sim: the stock build carries fuel (' + kg0.toFixed(1) + ' kg)');
  check(sim.fuel.vessels.length >= 1 && within(sim.fuel.vessels.reduce((a, v) => a + v.litres, 0),
        sim.fuel.litres, 0.02), 'sim: the per-tank litres sum to the total');
  for (let i = 0; i < 180; i++) sim.step(1 / 60);          // settle, idling
  check(within(sim.out.nz, 1, 0.03), 'sim: nz reads 1 g at rest', sim.out.nz.toFixed(3));
  check(Math.abs(sim.out.r) < 0.01, 'sim: no yaw rate at rest', sim.out.r.toFixed(4));
  check(isFinite(sim.out.hdg) && isFinite(sim.out.beta) && isFinite(sim.out.pitch),
    'sim: heading, beta and pitch are numbers');
  const idle = sim.out.rpm[0];
  check(within(idle, 644, 0.05), 'sim: the engine idles', idle.toFixed(0));
  const kgIdle = sim.fuel.kg;
  check(kgIdle < kg0 && kgIdle > kg0 - 0.05, 'sim: 3 s at idle burns a few grams',
    (kg0 - kgIdle).toFixed(4) + ' kg');
  check(within(sim.totalM, def.nodes.reduce((a, nd) => a + nd.m, 0) - (kg0 - kgIdle), 1e-6),
    'sim: the burned kilos left totalM through the mass door');
  // full throttle against the brakes: the static anchor, and the sheet's burn
  sim.ctl.thr = 1;
  for (let i = 0; i < 30; i++) sim.step(1 / 60);
  const TH = C.genEngineThermo(def.params.engine);
  check(within(sim.fuel.burnKgH, TH.burnKgH, 0.02),
    'sim: full throttle at sea level burns the sheet\'s figure',
    sim.fuel.burnKgH.toFixed(2) + ' vs ' + TH.burnKgH.toFixed(2) + ' kg/h');
  check(within(sim.out.rpm[0], nStatic, 0.04) || sim.out.rpm[0] > nStatic,
    'sim: the tacho reads the static anchor against the brakes',
    sim.out.rpm[0].toFixed(0) + ' vs ' + nStatic.toFixed(0));
  // the key: off = no thrust, windmill
  sim.setEngine(0, { key: 'off' });
  sim.step(1 / 60);
  check(sim.out.thrust === 0 && sim.eng[0].running === false, 'sim: key off stops the engine');
  check(sim.fuel.burnKgH === 0, 'sim: a stopped engine burns nothing');
  sim.setEngine(0, { key: 'both' });
  check(sim.eng[0].running === false, 'sim: mags on does not start an engine by itself');
  sim.setEngine(0, { swing: true });
  check(sim.eng[0].running === true, 'sim: a hand on the prop starts it');
  sim.setEngine(0, { key: 'off' });
  sim.setEngine(0, { key: 'both', start: true });
  check(sim.eng[0].running === false && sim.eng[0].crank > 0, 'sim: the starter cranks first');
  for (let i = 0; i < 120; i++) sim.step(1 / 60);
  check(sim.eng[0].running === true, 'sim: ...and the engine catches after the crank');
  sim.starterOk = () => false;
  sim.setEngine(0, { key: 'off' }); sim.setEngine(0, { key: 'both', start: true });
  check(sim.eng[0].crank === 0 && !sim.eng[0].running, 'sim: no bus, no crank');
  sim.starterOk = null;
  // reset puts everything back
  sim.reset();
  check(sim.fuel.kg === kg0 && sim.eng[0].running && sim.out.nz === 1,
    'sim: reset restores the tanks, the engine and the readings');
  // free fall: nz falls toward zero
  sim.ctl.thr = 0; sim.setEngine(0, { key: 'off' });
  for (let i = 0; i < sim.n; i++) { sim.p[i * 3 + 1] += 400; sim.v[i * 3] = sim.v[i * 3 + 1] = sim.v[i * 3 + 2] = 0; }
  for (let i = 0; i < 20; i++) sim.step(1 / 60);
  check(sim.out.nz < 0.35 && sim.out.nzMin < 0.35, 'sim: nz falls toward zero in free fall',
    sim.out.nz.toFixed(2));
  // a dry tank stops the engine
  {
    const S3 = C.genSpecAtFuel(def.spec, 0.4);
    const d3 = C.buildGen(S3);
    const s3 = C.makeSim(d3, null);
    s3.reset(); s3.ctl.brake = 1; s3.ctl.thr = 1;
    let tDry = -1;
    for (let i = 0; i < 60 * 150 && tDry < 0; i++) { s3.step(1 / 60); if (!s3.eng[0].running) tDry = i / 60; }
    check(tDry > 0 && s3.fuel.kg === 0 && s3.out.thrust === 0,
      'sim: a 0.4 L tank runs dry at full throttle and the engine stops',
      tDry > 0 ? tDry.toFixed(0) + ' s' : 'never');
    const expect = 0.4 * 0.72 / TH.burnKgH * 3600;
    check(tDry > 0 && within(tDry, expect, 0.08), 'sim: ...at the sheet\'s rate',
      tDry.toFixed(0) + ' s vs ' + expect.toFixed(0));
    s3.setEngine(0, { swing: true });
    check(!s3.eng[0].running, 'sim: a dry tank will not restart');
  }
  // a pack: state of charge, no mass change
  {
    const Sp = C.resolveSpec(Object.assign(cl(C.GEN_DEFAULT),
      { engines: [Object.assign(cl(C.GEN_DEFAULT.engines[0]), { type: 'emrax228_3blade' })],
        energy: { kind: 'battery', vessels: [{ bay: 'nose', capacity: 6, along: 0, lv: 1 }] } })).spec;
    const dp = C.buildGen(Sp), sp = C.makeSim(dp, null);
    sp.reset(); sp.ctl.brake = 1; sp.ctl.thr = 1;
    const m0 = sp.totalM;
    for (let i = 0; i < 600; i++) sp.step(1 / 60);
    check(sp.fuel.kind === 'battery' && sp.fuel.soc < 1 && sp.fuel.soc > 0.9,
      'sim: a pack discharges at full power', sp.fuel.soc.toFixed(4));
    check(sp.totalM === m0, 'sim: ...and weighs the same');
    check(sp.fuel.drawKW > 0 && within(sp.fuel.drawKW, C.genEngineThermo(dp.params.engine).drawKW, 0.02),
      'sim: the pack draw is the sheet\'s');
  }
  return fail.length === 0;
}

let ok = run();
if (SELFTEST) {
  // (a) the constant drifts: the anchors must catch it
  const k0 = C.GEN_SHAFT.staticK; C.GEN_SHAFT.staticK = 0.80;
  const a = !run(); C.GEN_SHAFT.staticK = k0;
  // (b) a row loses its rated speed: the census must catch it
  const e = C.POWERPLANTS.o200_eprops.engine, r0 = e.rpm; delete e.rpm;
  const b = !run(); e.rpm = r0;
  ok = run();
  console.log('selftest: staticK drift ' + (a ? 'caught' : 'MISSED') +
              ', missing rpm ' + (b ? 'caught' : 'MISSED'));
  if (!a || !b) ok = false;
}
if (!ok) for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE RPM: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
