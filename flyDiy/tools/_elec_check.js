#!/usr/bin/env node
// GATE ELEC — the panel arc's bus (session 4, 2026-09-12): the battery, the
// alternator, the loads, the starter.
//
//   node tools/_elec_check.js             -> "GATE ELEC: PASS|FAIL"
//   node tools/_elec_check.js --selftest  -> negative verification
//   node tools/_elec_check.js --show      -> print the endurance table
//
// WHAT IS PROTECTED. The volt/ammeter is the one instrument that reads the
// bus, and the bus decides which of the others are alive: a battery that
// never drains makes a night flight with no alternator free; an alternator
// that carries the bus at idle hides a generator that cuts in above 1100;
// a starter that cranks on a dead battery is a starter nobody needs; loads
// that do not sum are a ledger that lies. The numbers are the catalogue's
// (GEN_ELEC's Ah and amps, GEN_INSTR's draws) and the anchors are the
// real ones — a 16 Ah lead battery under the basic panel's ~1 A plus nav
// (2.5 A) plus a beacon (3 A, half on average) runs three and a half hours (Ah over amps; no
// Peukert — the gauge cannot tell).
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
// the cockpit's own lamp draws (cockpit.js LIGHT_AMPS)
const LIGHT_AMPS = { taxi: 5, beacon: 3, land: 8, nav: 2.5, flood: 0.5, instr: 0.6, pedal: 0.3, pax: 0.5 };

// a bus from a resolved fit, the way cockpit.js binds one
function busFor(tier, lights) {
  const S = cl(C.GEN_DEFAULT); S.systems = Object.assign(S.systems || {}, { fit: tier, items: null, elec: null, avionics: null });
  const fit = C.genSystemsResolve(S);
  const loads = fit.loads.map(l => ({ key: l.key, amps: l.amps }));
  for (const k of Object.keys(LIGHT_AMPS))
    loads.push({ key: 'sw_' + k, amps: lights && lights[k] ? LIGHT_AMPS[k] * (k === 'beacon' ? 0.5 : 1) : 0 });
  return { fit, bus: C.makeBus({ battAh: fit.battAh, altA: fit.altA, loads, altCutIn: 1100, starterA: 150 }) };
}
// run a bus at one rpm until the volts fall below `vMin` or `tMax` s
function runDown(bus, rpm, vMin, tMax) {
  const dt = 1; let t = 0;
  for (; t < tMax; t += dt) { bus.step(dt, rpm, false); if (bus.V < vMin) break; }
  return t;
}

function run() {
  fail.length = 0;
  // ---- 1. THE CATALOGUE: the bus reads real rows ---------------------------
  const E = C.GEN_ELEC;
  check(E && E.battery && E.battery.lead && E.battery.lead.Ah > 0, 'catalogue: a lead battery with a capacity');
  check(E && E.alternator && E.alternator.gen20 && E.alternator.gen20.A > 0, 'catalogue: a generator with its amps');
  const basic = busFor('basic'), ifr = busFor('ifr'), min = busFor('minimal');
  check(basic.fit.battAh > 0 && basic.fit.altA > 0, 'tiers: the basic fit has a battery and a generator',
        basic.fit.battAh + ' Ah / ' + basic.fit.altA + ' A');
  check(ifr.fit.altA > basic.fit.altA, 'tiers: the ifr fit carries the bigger alternator');
  check(min.fit.battAh === 0 && min.fit.altA === 0, 'tiers: the minimal fit has no electrics');

  // ---- 2. THE LOADS SUM ----------------------------------------------------
  {
    const { bus, fit } = busFor('basic', { nav: 1, beacon: 1 });
    bus.step(1, 0, false);
    const expect = fit.loads.reduce((a, l) => a + l.amps, 0) + LIGHT_AMPS.nav + LIGHT_AMPS.beacon * 0.5;
    check(Math.abs(bus.loadA - expect) < 1e-9, 'loads: the bus draws exactly the sum of its rows',
          bus.loadA.toFixed(3) + ' vs ' + expect.toFixed(3));
    bus.on.sw_nav = false; bus.step(1, 0, false);
    check(Math.abs(bus.loadA - (expect - LIGHT_AMPS.nav)) < 1e-9, 'loads: a switched-off load leaves the sum');
    bus.master = false; bus.step(1, 0, false);
    check(bus.loadA === 0 && bus.V === 0, 'loads: master off — nothing flows, the bus is dead');
  }

  // ---- 3. THE BATTERY ALONE: a night with no alternator --------------------
  {
    const { bus, fit } = busFor('basic', { nav: 1, beacon: 1 });
    bus.alt = false;
    const v0 = bus.step(1, 0, false).V;
    check(within(v0, 12.7, 0.01), 'battery: a full battery reads 12.7 V', v0.toFixed(2));
    const t = runDown(bus, 0, 9.0, 12 * 3600);
    const load = bus.loadA;
    const expect = fit.battAh / load * 3600;          // the Ah over the amps, to empty
    if (SHOW) {
      console.log('  the basic panel + nav + beacon on a ' + fit.battAh + ' Ah battery, alternator off');
      console.log('    load ' + load.toFixed(2) + ' A — dead at ' + (t / 3600).toFixed(2) + ' h (Ah/A = ' + (expect / 3600).toFixed(2) + ' h)');
    }
    check(t > 3.0 * 3600 && t < 4.0 * 3600, 'battery: ...runs the basic panel + nav + beacon three and a half hours',
          (t / 3600).toFixed(2) + ' h');
    check(within(t, expect, 0.02), 'battery: ...to the Ah over the amps', (t / 3600).toFixed(2) + ' vs ' + (expect / 3600).toFixed(2));
    check(bus.V < 9 && !bus.ok && !bus.starterOk, 'battery: a flat battery is a dead bus');
    // the voltage falls monotonically on the way down
    const b2 = busFor('basic', { nav: 1 }).bus; b2.alt = false;
    let vPrev = Infinity, mono = true;
    for (let i = 0; i < 6 * 3600; i += 60) { b2.step(60, 0, false); if (b2.V > vPrev + 1e-9) mono = false; vPrev = b2.V; }
    check(mono, 'battery: the volts never rise while it drains');
  }

  // ---- 4. THE ALTERNATOR: cut-in, 14.1 V, the charge -----------------------
  {
    const { bus } = busFor('basic', { nav: 1, beacon: 1, land: 1 });
    bus.step(1, 800, false);
    check(!bus.altOn && within(bus.V, 12.7, 0.02), 'alternator: below cut-in the battery carries the bus', bus.V.toFixed(2));
    bus.step(1, 2300, false);
    check(bus.altOn && bus.V === 14.1, 'alternator: at cruise rpm it holds 14.1 V', bus.V);
    // drained a third, then charged back: the alternator gives what it has spare
    bus.soc = 0.67;
    for (let i = 0; i < 1800; i++) bus.step(1, 2300, false);
    check(bus.soc > 0.85, 'alternator: half an hour at cruise charges most of a third back', bus.soc.toFixed(3));
    check(bus.amps >= 0, 'alternator: ...with the net into the battery');
    // more load than the generator makes comes out of the battery
    const { bus: b3 } = busFor('basic', { nav: 1, beacon: 1, land: 1, taxi: 1 });
    b3.setLoad('sw_land', 40);
    b3.step(1, 2300, false);
    check(b3.altOn && b3.amps < 0, 'alternator: a load past its amps discharges the battery even at cruise', b3.amps.toFixed(1));
    // alternator switch off: the bus is the battery's
    const { bus: b4 } = busFor('basic'); b4.alt = false; b4.step(1, 2300, false);
    check(!b4.altOn && b4.V < 13, 'alternator: its switch off leaves the battery carrying the bus');
  }

  // ---- 5. THE STARTER ------------------------------------------------------
  {
    const { bus } = busFor('basic');
    bus.step(1, 0, true);
    check(bus.loadA >= 150, 'starter: cranking is a 150 A load', bus.loadA);
    check(bus.V < 12.7 && bus.starterOk, 'starter: a full battery cranks, the bus sagging', bus.V.toFixed(2));
    // no battery: nothing cranks
    const { bus: b0 } = busFor('minimal');
    b0.step(1, 0, true);
    check(b0.V === 0 && !b0.starterOk && b0.loadA === 0, 'starter: without a battery it does nothing');
    // a flat battery: nothing cranks either
    const { bus: b1 } = busFor('basic'); b1.alt = false; b1.soc = 0.05;
    b1.step(1, 0, true);
    check(!b1.starterOk, 'starter: a flat battery will not crank', b1.V.toFixed(2));
    // the solver asks the bus (30_solver's starterOk hook): a build whose
    // hook says no never starts
    const Sp = C.resolveSpec(cl(C.GEN_DEFAULT)).spec;
    const d = C.buildGen(Sp), s = C.makeSim(d, null);
    s.reset(); s.starterOk = () => false;
    s.setEngine(0, { key: 'off' }); s.setEngine(0, { key: 'both', start: true });
    for (let i = 0; i < 300; i++) s.step(1 / 60);
    check(!s.eng[0].running, 'starter: the solver refuses to start on a bus that says no');
    s.starterOk = () => true;
    s.setEngine(0, { key: 'both', start: true });
    for (let i = 0; i < 300; i++) s.step(1 / 60);
    check(s.eng[0].running, 'starter: ...and starts on one that says yes');
  }

  // ---- 6. A GENERATOR-ONLY AEROPLANE -----------------------------------------
  {
    const bus = C.makeBus({ battAh: 0, altA: 20, loads: [{ key: 'x', amps: 2 }], altCutIn: 1100 });
    bus.step(1, 0, false);
    check(bus.V === 0, 'generator only: nothing at rest');
    bus.step(1, 2000, false);
    check(bus.V === 14.1 && bus.ok, 'generator only: the loads are carried above cut-in');
  }

  // ---- 7. G2809: WHAT IS DRAWN IS BILLED (the user, 25 Oct: "Wysiwyg, and as billed for all") ---------------------
  {
    const LP = C.GEN_LIGHT_PARTS;
    const census = { nav: 3, beacon: 1, land: 1, pedal: 1 };
    const R = C.genSystemsResolve({ systems: { fit: 'basic', lights: census } });
    const lr = R.rows.filter(r => /^light:/.test(r.key));
    check(lr.length === 4 && lr.every(r => Math.abs(r.kg - LP[r.key.slice(6)].kg * census[r.key.slice(6)]) < 1e-9 &&
          r.price === LP[r.key.slice(6)].price * census[r.key.slice(6)]), 'lamps: one row a key drawn, billed per lamp',
          lr.map(r => r.key + ' ' + r.kg).join(', '));
    check(JSON.stringify(R.lamps) === JSON.stringify(['nav', 'beacon', 'land', 'pedal']), 'lamps: the keys drawn, for the flight\'s loads', R.lamps);
    check(R.breakers.some(b => b.key === 'navLt') && !R.breakers.some(b => b.key === 'taxiLt') && R.breakers.some(b => b.key === 'cabinLt'),
          'lamps: the breakers are the drawn lamps\' (no taxi lamp, no taxi breaker)');
    const Rn = C.genSystemsResolve({ systems: { fit: 'basic', lights: {} } });
    check(!Rn.rows.some(r => /^light:/.test(r.key)) && !Rn.breakers.some(b => /Lt$/.test(b.key)), 'lamps: none drawn, none billed');
    check(C.genSystemsResolve({ systems: { fit: 'basic' } }).lamps === null, 'lamps: no census (a spec with no drawing) - every fitted light counts');
    // no battery: no lamp, no generator, no starter
    const R0 = C.genSystemsResolve({ systems: { fit: 'custom', items: ['asi', 'alt'], lights: census,
      elec: { battery: 'none', alternator: 'gen20', starter: 'yes', vac: 'none' } } });
    check(!R0.rows.some(r => /^light:|^alternator:|^starter:/.test(r.key)) && R0.elec.alternator === 'none' && !R0.starter,
          'no battery: no lamp, no generator, no starter billed');
    check(['alternator', 'starter', 'light:nav'].every(k => R0.dropped.some(d => d.key === k && d.why === 'no battery')),
          'no battery: each named "no battery"', R0.dropped.map(d => d.key).join());
    // the harness carries a lamp's wire as any powered item's
    const Rh = C.genSystemsResolve({ systems: { fit: 'basic', lights: { nav: 3 } } }), Rh0 = C.genSystemsResolve({ systems: { fit: 'basic', lights: {} } });
    const hk = q => q.rows.find(r => r.key === 'harness').kg;
    check(Math.abs(hk(Rh) - hk(Rh0) - C.GEN_ELEC.harness.kgPerItem) < 1e-9, 'lamps: each key drawn adds its wire to the harness');
    // no room on the dash = not billed
    const Rr = C.genSystemsResolve({ systems: { fit: 'ifr', noRoom: ['volts', 'xpdr', 'breaker:aiE'] } });
    check(!Rr.items.includes('volts') && Rr.avionics.xpdr === 'none' && !Rr.breakers.some(b => b.key === 'aiE') && Rr.items.includes('aiE'),
          'no room: the dial and the radio not billed, the breaker not fitted (its load fed straight)');
  }
  return fail.length === 0;
}

let ok = run();
if (SELFTEST) {
  // (a) the battery's capacity lost: the endurance anchor must catch it
  const b = C.GEN_ELEC.battery.lead, ah0 = b.Ah; b.Ah = 40;
  const a = !run(); b.Ah = ah0;
  // (b) the generator's amps lost: the cut-in / charge checks must catch it
  const g = C.GEN_ELEC.alternator.gen20, a0 = g.A; g.A = 0;
  const bb = !run(); g.A = a0;
  ok = run();
  console.log('selftest: capacity drift ' + (a ? 'caught' : 'MISSED') +
              ', dead generator ' + (bb ? 'caught' : 'MISSED'));
  if (!a || !bb) ok = false;
}
if (!ok) for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE ELEC: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
