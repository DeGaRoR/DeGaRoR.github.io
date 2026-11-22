#!/usr/bin/env node
// GATE IDLEPROP (PHYSICS-AUDIT step 4, 2026-11-21; reports/PHYSICS-AUDIT-2026-11-21.md): the propeller that is not driven
// is a brake (60_gen_spec GEN_PROP_IDLE, genPropIdleK; 30_solver; 64_gen_build genTrim).
// 1. FULL THROTTLE AND STANDING ARE AS THEY WERE: flown at full throttle the thrust is the law's own to the bit; standing
//    with the throttle closed it is zero
// 2. THE THROTTLE CLOSED, FLOWN: the thrust is minus `run` x the disc's q A; halfway it is half the law's less half of
//    that (linear)
// 3. BY THE ENGINE'S STATE: a dead engine windmills at `dead` x the disc, a seized one at `stopped`; an electric motor
//    at `electric` running or not; a governed propeller on a dead engine at `governedDead`
// 4. THE TRIM READS THE SAME LAW: the cruise throttle is (D + Dw) / (Tav + Dw) and flown at it the thrust is the drag;
//    the approach's two numbers carry Dw
// 5. THE GLIDE: the stock aeroplane's best glide with the engine dead is under its clean one by what the disc's share
//    of drag makes it, and the closed-throttle glide lies between
// 6. NOTHING DIVERGES: thirty seconds flown with the throttle closed stay finite
//   node tools/_idleprop_check.js  -> "GATE IDLEPROP: PASS|FAIL"   (seconds)
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const PP = require(path.join(__dirname, '_perf_probe.js'));
const bad = [];
const check = (c, m) => { console.log((c ? '  ok     ' : '  FAIL   ') + m); if (!c) bad.push(m); return c; };
const clone = o => JSON.parse(JSON.stringify(o));
const build = f => { const s = clone(C.GEN_DEFAULT); if (f) f(s); return C.buildGen(s); };
const K = C.GEN_PROP_IDLE, near = (a, b, t) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
// one frame flown level at V with the throttle at thr: the published thrust
function flown(def, V, thr, prep) {
  const sim = C.makeSim(def, null); sim.reset(600);
  const [xA] = sim.axes();
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = -V * xA[0]; sim.v[i * 3 + 1] = -V * xA[1]; sim.v[i * 3 + 2] = -V * xA[2]; }
  sim.ctl.thr = thr; if (prep) prep(sim);
  sim.step(1 / 600);
  // (a sim without a world flies the datum air at any height: the probe's)
  return { T: sim.out.thrust, V: sim.out.V, h: undefined, rho: sim.probeAir().rho, sim };
}
const stock = build(), A = Math.PI * stock.params.prop.D * stock.params.prop.D / 4;
const qA = r => 0.5 * r.rho * r.V * r.V * A;

// ---- 1 ----------------------------------------------------------------------------------------------------------------
{ const r = flown(stock, 30, 1);
  check(near(r.T, r.sim.thrustAt(r.V, 0, r.h), 1e-4), '1. flown at full throttle the thrust is the law\'s own (' + r.T.toFixed(1) + ' N at 30 m/s; no idle term: x (1 - 1))');
  const s = C.makeSim(stock, null); s.reset(0); s.ctl.thr = 0; for (let i = 0; i < 120; i++) s.step(1 / 60);
  check(Math.abs(s.out.thrust) < 1e-6, '1. standing with the throttle closed the thrust is zero (' + s.out.thrust.toExponential(1) + ')'); }
// ---- 2 ----------------------------------------------------------------------------------------------------------------
{ const r0 = flown(stock, 30, 0), rh = flown(stock, 30, 0.5), law = rh.sim.thrustAt(rh.V, 0, rh.h);
  check(near(r0.T, -K.run * qA(r0), 1e-3), '2. the throttle closed at 30 m/s: ' + r0.T.toFixed(1) + ' N = -' + K.run + ' x q A (' + (-K.run * qA(r0)).toFixed(1) + ')');
  check(near(rh.T, 0.5 * law - 0.5 * K.run * qA(rh), 1e-3), '2. half throttle: half the law\'s less half the idle drag (' + rh.T.toFixed(1) + ' N)');
  check(near(r0.sim.idleDragAt(r0.V, r0.h), K.run * qA(r0), 1e-9), '2. sim.idleDragAt is that drag (' + r0.sim.idleDragAt(30).toFixed(1) + ' N)'); }
// ---- 3 ----------------------------------------------------------------------------------------------------------------
{ const dead = flown(stock, 30, 1, s => { const e = s.engine && s.engine(0); if (s.engineKey) s.engineKey(0, 'off'); else if (e) e.running = false; });
  const off = dead.sim.engine ? dead.sim.engine(0) : null;
  if (off && off.running === false) check(near(dead.T, -K.dead * qA(dead), 1e-9), '3. a dead engine windmills: ' + dead.T.toFixed(1) + ' N = -' + K.dead + ' x q A');
  else console.log('  (no engine switch on the sim API from here: the dead-engine row read through genPropIdleK)');
  const P = stock.params;
  check(C.genPropIdleK(P.engine, P.prop, 'run') === K.run && C.genPropIdleK(P.engine, P.prop, 'dead') === K.dead && C.genPropIdleK(P.engine, P.prop, 'stopped') === K.stopped, '3. a piston\'s fixed pitch: run ' + K.run + ', dead ' + K.dead + ', stopped ' + K.stopped);
  check(C.genPropIdleK({ aspiration: 'electric' }, P.prop, 'run') === K.electric && C.genPropIdleK({ aspiration: 'electric' }, P.prop, 'dead') === K.electric, '3. an electric motor\'s, driven or not: ' + K.electric);
  check(C.genPropIdleK({ cs: true }, P.prop, 'dead') === K.governedDead && C.genPropIdleK({ cs: true }, P.prop, 'run') === K.run, '3. a governed propeller: ' + K.run + ' turning, ' + K.governedDead + ' on a dead engine');
  check(C.genPropIdleK(P.engine, { D: 1.8, Tstatic: 0 }, 'dead') === 0 && C.genPropIdleK(P.engine, null, 'run') === 0, '3. no propeller, no drag');
  const el = build(s => { s.engines[0].type = Object.keys(C.POWERPLANTS).find(k => C.POWERPLANTS[k].engine.aspiration === 'electric'); });
  const re = flown(el, 30, 0), Ae = Math.PI * el.params.prop.D * el.params.prop.D / 4;
  check(near(re.T, -K.electric * 0.5 * re.rho * re.V * re.V * Ae, 1e-3), '3. flown, an electric build with the throttle closed: ' + re.T.toFixed(1) + ' N = -' + K.electric + ' x q A'); }
// ---- 4 ----------------------------------------------------------------------------------------------------------------
{ const sim = C.makeSim(stock, null); sim.reset(0);
  const ap = stock.params.ap, g = stock.params.gen, V = ap.VCruise, Dw = sim.idleDragAt(V), Tav = sim.thrustAt(V, 1);
  const W = sim.totalM * 9.81, al = PP.alphaForLift(sim, V, W, 0.85 * stock.params.polarWing.aStall), D = PP.probeAt(sim, V, al.a).drag;
  check(ap.thrCruise > 0.15 && ap.thrCruise < 0.95 && near(ap.thrCruise * Tav - (1 - ap.thrCruise) * Dw, D, 0.03), '4. at the cruise throttle (' + ap.thrCruise.toFixed(3) + ') the thrust is the cruise drag (' + (ap.thrCruise * Tav - (1 - ap.thrCruise) * Dw).toFixed(0) + ' against ' + D.toFixed(0) + ' N)');
  const DwA = sim.idleDragAt(ap.VAppr);
  check(DwA > 0 && near(g.TavailAppr, sim.thrustAt(ap.VAppr, 1) + DwA, 1e-9), '4. the approach\'s available thrust carries the idle drag (' + g.TavailAppr.toFixed(0) + ' = ' + sim.thrustAt(ap.VAppr, 1).toFixed(0) + ' + ' + DwA.toFixed(0) + ' N)');
  check(g.dragAppr > DwA, '4. ...and so does its drag (' + g.dragAppr.toFixed(0) + ' N)'); }
// ---- 5 ----------------------------------------------------------------------------------------------------------------
{ const sim = C.makeSim(stock, null); sim.reset(0);
  const W = sim.totalM * 9.81, rows = PP.sweepAt(stock, sim, W, stock.params.gen.VsMeas), rho = sim.probeAir().rho;
  const best = k => rows.reduce((m, r) => Math.max(m, W / (r.drag + k * 0.5 * rho * r.V * r.V * A)), 0);
  const clean = best(0), idle = best(K.run), deadLD = best(K.dead);
  console.log('the stock\'s best glide: clean ' + clean.toFixed(2) + ', throttle closed ' + idle.toFixed(2) + ', engine dead ' + deadLD.toFixed(2));
  check(deadLD < idle && idle < clean && deadLD > 0.75 * clean, '5. dead < closed < clean, and the dead-engine glide within a quarter of the clean one'); }
// ---- 6 ----------------------------------------------------------------------------------------------------------------
{ const sim = C.makeSim(stock, null); sim.reset(600);
  const [xA] = sim.axes(), V = stock.params.ap.VCruise;
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = -V * xA[0]; sim.v[i * 3 + 1] = -V * xA[1]; sim.v[i * 3 + 2] = -V * xA[2]; }
  sim.ctl.thr = 0; let ok = true, minT = 0;
  for (let i = 0; i < 1800; i++) { sim.step(1 / 60); const o = sim.out; if (!isFinite(o.V) || !isFinite(o.thrust) || !isFinite(o.wash)) { ok = false; break; } minT = Math.min(minT, o.thrust); }
  check(ok && minT < 0, '6. thirty seconds flown with the throttle closed stay finite (the thrust down to ' + minT.toFixed(0) + ' N, the wash finite)'); }

console.log('GATE IDLEPROP: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
