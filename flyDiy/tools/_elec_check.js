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

  // ---- 7. THE ENGINE'S SETS (ELEC-SYSTEMS, 9 Nov; futureDesigns/ELEC-SYSTEMS-2026-11.md) ------------------------------
  // (a) ADDITIVE: the tiers' electrics are what they were, so the Cub, the Jodel and the C172 do not move
  {
    const T = C.GEN_SYSTEMS;
    const was = { minimal: 'none/none/none/none', basic: 'lead/gen20/yes/venturi', ifr: 'lead/alt60/yes/pump', custom: 'lead/gen20/yes/venturi' };
    for (const t of Object.keys(was)) {
      const e = T[t].elec, k = [e.battery, e.alternator, e.starter, e.vac].join('/');
      check(k === was[t], 'sets: the ' + t + ' tier\'s electrics are unchanged', k);
    }
    const L = E.battery.lead, G = E.alternator.gen20, S = E.starter.yes;
    check(L.kg === 7 && L.Ah === 16 && G.kg === 4 && G.A === 20 && !G.cutIn && S.kg === 4 && S.amps === 150,
          'sets: the light rows are the rows every build had (no cutIn on gen20: the bus\'s 1100 stands)');
  }
  // (b) every class resolves to rows that exist, and its mass sits in its band (the real anchors: ultralight 4-9 kg,
  //     light 12-18 kg - the 17 kg the basic fit always carried with its harness -, heavy 35-55 kg)
  {
    const CL = C.GEN_ELEC_SETS;
    check(CL && CL.ultralight && CL.light && CL.heavy, 'sets: ultralight / light / heavy declared');
    const band = { ultralight: [4, 9], light: [12, 18], heavy: [35, 55] };
    for (const k of Object.keys(CL || {})) {
      const c = CL[k];
      const ok = E.battery[c.battery] && E.alternator[c.alternator] && E.starter[c.starter];
      check(!!ok, 'sets: ' + k + ' names catalogue rows', [c.battery, c.alternator, c.starter].join('/'));
      if (!ok) continue;
      const kg = E.battery[c.battery].kg + E.alternator[c.alternator].kg + E.starter[c.starter].kg + E.harness.kg;
      const b = band[k];
      check(!b || (kg >= b[0] && kg <= b[1]), 'sets: ' + k + ' weighs ' + kg.toFixed(1) + ' kg with the harness', b && b.join('-'));
      const S = cl(C.GEN_DEFAULT); S.systems = { fit: 'basic', elec: { battery: c.battery, alternator: c.alternator, starter: c.starter } };
      const R = C.genSystemsResolve(S);
      check(R.elecSet === k, 'sets: a fit of the ' + k + ' rows reads back as that class', R.elecSet);
      check(R.starter === true && R.starterA === (E.starter[c.starter].amps || 150), 'sets: ' + k + '\'s starter cranks at its own amps', R.starterA);
    }
    // the new rows carry what the bus reads: Ah, A, a cut-in for the engine-driven coils, the starter's crank
    check(E.alternator.coil12.cutIn < 1100 && E.alternator.int18.cutIn < 1100, 'sets: the engine\'s own coils charge below 1100 prop rpm');
    for (const k of Object.keys(E.battery)) if (k !== 'none') check(E.battery[k].Ah > 0 && E.battery[k].kg > 0, 'sets: battery ' + k + ' has Ah and mass');
  }
  // (c) the engine suggests, by the registry: a Rotax two-stroke and a 912 ultralight, an A-65 light, the radials heavy,
  //     a motor none
  {
    const PP = C.POWERPLANTS, sug = k => (C.genElecSetOf(PP[k].engine) || {}).set;
    const want = { rotax503_wood: 'ultralight', rotax582_ivo: 'ultralight', rotax912_warp: 'ultralight', a65_sensenich74: 'light',
                   o200_eprops: 'light', io360_mccauley: 'light', r1830_hs23e50: 'heavy', r985_hs2b20: 'heavy', e811_velis: null };
    for (const k of Object.keys(want)) check(PP[k] && sug(k) === want[k], 'suggest: ' + k + ' -> ' + want[k], PP[k] ? String(sug(k)) : 'no row');
    check(C.genElecSetOf(PP.rotax582_ivo.engine).alternator === 'coil12' && C.genElecSetOf(PP.rotax912_warp.engine).alternator === 'int18',
          'suggest: a two-stroke\'s coil, a 912\'s integrated generator');
  }
  // (d) THE REFUSALS ARE SAID: a starter with no battery, a generator-only bus, an alternator with no battery, a 12 V
  //     starter on a motor; nothing re-billed. A self-exciting generator (a DC generator, a PM coil) feeds the dials with
  //     no battery; an alternator, whose field the battery excites, feeds nothing (FAA AC 20-40)
  {
    const S = cl(C.GEN_DEFAULT); S.systems = { fit: 'basic', elec: { battery: 'none' } };
    const R = C.genSystemsResolve(S), keys = (R.warnings || []).map(w => w.key);
    check(keys.includes('starterNoBatt') && keys.includes('genOnly'), 'refusals: a starter with no battery and a generator-only bus are said', keys.join(','));
    check(R.rows.some(r => r.key === 'starter:yes'), 'refusals: ...and still billed (the player\'s choice keeps its mass)');
    check(R.hasBus && !R.dropped.some(d => d.why === 'no battery') && R.items.includes('fuel'), 'generator only: a DC generator feeds the dials with no battery');
    const A = cl(C.GEN_DEFAULT); A.systems = { fit: 'basic', elec: { battery: 'none', alternator: 'alt60' } };
    const RA = C.genSystemsResolve(A);
    check(!RA.hasBus && RA.warnings.some(w => w.key === 'altNoBatt') && RA.dropped.some(d => d.why === 'no battery'),
          'alternator only: no bus, the dials refused with their reason, the alternator said');
    const ba = C.makeBus({ battAh: 0, altA: 60, altSelf: false, loads: [{ key: 'x', amps: 1 }] });
    ba.step(1, 2000, false);
    check(!ba.altOn && ba.V === 0, 'alternator only: the bus never comes up');
    const B = C.genSystemsResolve(cl(C.GEN_DEFAULT));
    check(Array.isArray(B.warnings) && B.warnings.length === 0, 'refusals: the stock build has nothing to say', (B.warnings || []).map(w => w.key).join(','));
    const M = cl(C.GEN_DEFAULT); M.energy = Object.assign({}, M.energy, { kind: 'battery' });
    check(C.genSystemsResolve(M).warnings.some(w => w.key === 'starterOnMotor'), 'refusals: a 12 V starter on a motor is said');
  }
  // (e) the bus on the class rows: an ultralight's 9 Ah under the basic panel's day load lasts hours; its 12 A coil
  //     charges at a geared Rotax's cruise prop rpm (~2100) and not at idle (~550)
  {
    const S = cl(C.GEN_DEFAULT); S.systems = { fit: 'basic', elec: { battery: 'leadSmall', alternator: 'int18', starter: 'ul' } };
    const R = C.genSystemsResolve(S);
    const bus = C.makeBus({ battAh: R.battAh, altA: R.altA, loads: R.loads, altCutIn: R.altCutIn, starterA: R.starterA });
    bus.step(1, 550, false);
    check(!bus.altOn, 'ul bus: no charge at idle prop rpm', 'altOn at 550');
    bus.step(1, 2100, false);
    check(bus.altOn && bus.V === 14.1, 'ul bus: the integrated generator carries the bus at cruise');
    const b2 = C.makeBus({ battAh: R.battAh, altA: 0, loads: R.loads });
    const h = runDown(b2, 0, 11.8, 30 * 3600) / 3600;
    check(h > 3, 'ul bus: the 9 Ah battery runs the basic panel by day over 3 h', h.toFixed(1) + ' h');
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
  // (c) ELEC-SYSTEMS: a class row moved into a tier (the additive rule broken) must be caught
  const t = C.GEN_SYSTEMS.basic.elec, b0 = t.battery; t.battery = 'leadSmall';
  const cc = !run(); t.battery = b0;
  ok = run();
  console.log('selftest: capacity drift ' + (a ? 'caught' : 'MISSED') +
              ', dead generator ' + (bb ? 'caught' : 'MISSED') + ', a tier moved ' + (cc ? 'caught' : 'MISSED'));
  if (!a || !bb || !cc) ok = false;
}
if (!ok) for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE ELEC: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
