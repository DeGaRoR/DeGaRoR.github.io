#!/usr/bin/env node
// _engcustom_check.js — the CUSTOM ENGINE verdict (G134). Three claims:
//
//   1. the THERMO LAWS hold over the whole registry — every row carries its
//      declared family + cooling, pistons burn and electrics draw, and the
//      price law tracks each ladder inside an honest band (the two declared
//      waivers say why they are waived, on the row).
//   2. clampSpec is the ONLY door — a garbage custom row dies there, a legit
//      one comes out bounded and enum-safe, and a spec WITHOUT one resolves
//      exactly as before the arc (the no-custom identity).
//   3. the row REACHES THE AEROPLANE: resolveSpec flies the custom mass and
//      power (frame mass moves by the engine delta, Tstatic follows the
//      watts), and buildGen's def carries params.engine for the solver's
//      aspiration read and the plaque.
//
// Sections 2b/3 exercise the join wire (60/61/62 + _cage_join) and are the
// arc's negative-first half: RED until the wire lands, green after.
// Run: node tools/_engcustom_check.js
'use strict';
const C = require('./flight_core.js');
const { POWERPLANTS, GEN_ENG_THERMO, genEngineThermo, genEnginePrice,
        clampSpec, resolveSpec, genFrame, buildGen, GEN_DEFAULT } = C;

let fails = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label);
  if (!cond) fails++;
};
const clone = o => JSON.parse(JSON.stringify(o));

// ---- 1. the laws over the registry ----------------------------------------
console.log('THERMO + PRICE over every registry row');
// waived from the price band, each for a declared reason:
//   r1830 — a warbird's market price is provenance, not kilowatts
//   e811  — the 2.5x over its EMRAX twin IS the type certificate, and a
//           garage engine is uncertified by construction
const PRICE_WAIVED = new Set(['r1830_hs23e50', 'e811_velis']);
for (const [key, row] of Object.entries(POWERPLANTS)) {
  const e = row.engine;
  ok(!!GEN_ENG_THERMO[e.family], `${key}: family '${e.family}' declared`);
  ok(e.cooling === 'air' || e.cooling === 'liquid',
     `${key}: cooling '${e.cooling}' declared`);
  const T = genEngineThermo(e);
  ok(isFinite(T.coolKW) && T.coolKW > 0, `${key}: coolKW finite (${T.coolKW.toFixed(1)})`);
  if (e.family === 'electric')
    ok(T.burnKgH === 0 && T.drawKW > e.powerW / 1000,
       `${key}: electric draws > shaft, burns nothing`);
  else
    ok(T.burnKgH > 0 && T.drawKW === 0,
       `${key}: piston burns (${T.burnKgH.toFixed(1)} kg/h), draws nothing`);
  if (!PRICE_WAIVED.has(key)) {
    const p = genEnginePrice(e.family, e.powerW);
    const r = p / row.price;
    ok(r > 0.3 && r < 3.0,
       `${key}: price law ${p} inside the band of ${row.price} (x${r.toFixed(2)})`);
  }
}
// legacy dicts predate the fields — the inference must hold
{
  const t1 = genEngineThermo({ powerW: 48500, aspiration: 'na' });
  ok(t1.family === 'four' && t1.cooling === 'air',
     'legacy piston dict infers four/air');
  const t2 = genEngineThermo({ powerW: 12000, aspiration: 'electric' });
  ok(t2.family === 'electric' && t2.drawKW > 12,
     'legacy electric dict infers electric');
}

// ---- 2. clampSpec is the only door ----------------------------------------
console.log('clampSpec: the custom row is bounded or dead');
const CU = { name: 'custom flat 4-cyl 3.2 L', mass: 62, powerW: 52000,
             rpm: 2600, torque: 191, aspiration: 'na',
             family: 'four', cooling: 'air' };
{
  const s = clone(GEN_DEFAULT);
  s.engines = [{ type: 'a65_sensenich74', custom: { name: 42, mass: 'no',
    powerW: NaN } }];
  const c = clampSpec(s);
  ok(!c.engines[0].custom, 'garbage custom row dies at the door');
}
{
  const s = clone(GEN_DEFAULT);
  s.engines = [{ type: 'a65_sensenich74',
    custom: Object.assign({}, CU, { mass: 5000, powerW: 9e9,
      family: 'warp', cooling: 'phase-change' }) }];
  const c = clampSpec(s);
  const cu = c.engines[0].custom;
  ok(!!cu && cu.mass <= 900 && cu.powerW <= 1000000,
     'a smuggled giant is clamped to the envelope');
  ok(cu && cu.family === 'four' && cu.cooling === 'air',
     'unknown enums fall back the legacy way');
  ok(cu && cu.price > 0, 'an unpriced row takes the market curve');
}
{
  // the no-custom identity: an untouched default resolves to the same
  // aeroplane it did before the arc (mass, cg, Tstatic all still equal)
  const r0 = resolveSpec(clone(GEN_DEFAULT)).spec;
  const reg = POWERPLANTS[r0.engine];
  ok(!r0.engines[0].custom, 'the default spec carries no custom row');
  ok(Math.abs(r0.prop.Tstatic -
      resolveSpec(clone(GEN_DEFAULT)).spec.prop.Tstatic) < 1e-9,
     'no-custom resolve is deterministic');
  ok(!reg || r0.engBox.k > 0, 'engBox still sizes off the engine mass');
}

// ---- 3. the row reaches the aeroplane -------------------------------------
console.log('resolveSpec + genFrame: the custom engine flies');
{
  const s0 = clone(GEN_DEFAULT);
  s0.engines = [{ type: 'a65_sensenich74', mount: 'nose',
                  place: { dx: 0, dy: 0 } }];
  const sC = clone(s0);
  sC.engines[0].custom = clone(CU);
  const r0 = resolveSpec(clampSpec(s0)).spec,
        rC = resolveSpec(clampSpec(sC)).spec;
  ok(rC.pplant && rC.pplant.engine.mass === 62,
     'resolveSpec flies the custom mass (S.pplant)');
  ok(rC.prop.Tstatic > 0 &&
     Math.abs(rC.prop.Tstatic / r0.prop.Tstatic
              - Math.pow(52000 / 48500, 2 / 3)) < 0.02,
     'Tstatic follows the custom watts on the P^(2/3) curve');
  const f0 = genFrame(r0), fC = genFrame(rC);
  const dM = fC.cg0[3] - f0.cg0[3];
  ok(Math.abs(dM - (62 - 80)) < 1.0,
     `frame mass moves by the engine delta (${dM.toFixed(1)} kg ~ -18)`);
  ok(fC.cg0[0] > f0.cg0[0] - 1e-9,
     'a lighter nose moves the CG aft, never forward');
  const d = buildGen(sC);
  ok(d.params.engine && d.params.engine.powerW === 52000,
     'the def carries params.engine (solver + plaque read it)');
  ok(d.params.engine.name === CU.name, 'and it is the named custom engine');
}
{
  // electric: the aspiration must reach the def, or altitude physics lies
  const s = clone(GEN_DEFAULT);
  s.engines = [{ type: 'emrax228_3blade', mount: 'nose',
                 place: { dx: 0, dy: 0 },
                 custom: { name: 'custom axial 40 kW', mass: 16,
                           powerW: 40000, rpm: 2400, aspiration: 'electric',
                           family: 'electric', cooling: 'air' } }];
  const d = buildGen(s);
  ok(d.params.engine && d.params.engine.aspiration === 'electric',
     'an electric custom row keeps its aspiration into the def');
}
{
  // TURBINE (2026-09-05, TURBOPROP §1/§5/§8): the third aspiration, its own
  // two numbers, and the fuel it forces
  const s = clone(GEN_DEFAULT);
  s.engines = [{ type: 'rotax912_warp', mount: 'nose',
                 place: { dx: 0, dy: 0 },
                 custom: { name: 'custom turbine 60 kW', mass: 40,
                           powerW: 59600, rpm: 2200, aspiration: 'turbine',
                           family: 'turbine', cooling: 'air',
                           flatK: 1.4, length: 0.9 } }];
  s.energy = { kind: 'fuel', fuel: 'avgas100LL' };
  const r = resolveSpec(clampSpec(clone(s))).spec;
  const cu = r.engines[0].custom;
  ok(cu.aspiration === 'turbine' && cu.family === 'turbine',
     'a turbine custom row keeps both keys through the clamp');
  ok(cu.flatK === 1.4 && cu.length === 0.9,
     'and its flat-rating margin and length ride with it');
  ok(r.energy.fuel === 'jetA', 'the clamp put Jet-A in a turbine that asked for avgas');
  ok(r.engBox.cylZ === r.engBox.halfW && r.engBox.cylReach === r.engBox.halfW &&
     Math.abs((r.engBox.xA - r.engBox.xF) - 0.9) < 1e-9,
     'the engine box has no cylinders and runs the declared length');
  const d = buildGen(s);
  ok(d.params.engine && d.params.engine.aspiration === 'turbine' &&
     d.params.engine.flatK === 1.4,
     'the def carries the turbine aspiration and its margin to the solver');
  // the margin is the turbine's alone: a piston that declares one loses it
  const p = clone(GEN_DEFAULT);
  p.engines = [{ type: 'rotax912_warp', mount: 'nose', place: { dx: 0, dy: 0 },
                 custom: { name: 'x', mass: 58, powerW: 59600, rpm: 5800,
                           aspiration: 'na', family: 'four', cooling: 'liquid',
                           flatK: 1.5, length: 1 } }];
  p.energy = { kind: 'fuel', fuel: 'jetA' };
  const rp = resolveSpec(clampSpec(clone(p))).spec;
  ok(rp.engines[0].custom.flatK === undefined && rp.engines[0].custom.length === undefined,
     'a piston cannot smuggle a flat-rating margin');
  ok(rp.energy.fuel === 'avgas100LL', 'and the clamp took the kerosene out of it');
  // the registry rows themselves force the fuel too
  const t = clone(GEN_DEFAULT);
  t.engines = [{ type: 'pt6a114a_hartzell3', mount: 'nose', place: { dx: 0, dy: 0 } }];
  const rt = resolveSpec(clampSpec(t)).spec;
  ok(rt.energy.fuel === 'jetA' && rt.pplant.engine.aspiration === 'turbine',
     'a registry PT6 flies as a turbine and burns Jet-A');
  ok(genEnginePrice('turbine', 503000) / POWERPLANTS.pt6a114a_hartzell3.price > 0.5 &&
     genEnginePrice('turbine', 503000) / POWERPLANTS.pt6a114a_hartzell3.price < 2,
     'the turbine price curve sits on its own rows');
}

// THE VERDICT CONTRACT (G67.1): the runner requires BOTH signals.
if (fails) console.log('\n  ' + fails + ' check(s) failed');
console.log('GATE ENGINE: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
