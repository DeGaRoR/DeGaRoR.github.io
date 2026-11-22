#!/usr/bin/env node
// GATE PROPFIT (PHYSICS-AUDIT step 3, 2026-11-21; reports/PHYSICS-AUDIT-2026-11-21.md): the fixed-pitch propeller is cut
// for its aeroplane and held to its redline (60_gen_spec genPropFit, 64_gen_build, 30_solver thrLimit, 00_registry
// genShaftRpm).
// 1. THE ANCHOR HOLDS: the stock aeroplane (the A-65 on its wooden 1.88 m, standard pitch) keeps its static thrust to
//    the bit and its curve within 5 % everywhere up to its top speed - the J-3 calibration is not undone
// 2. THE DESIGN POINT IS THE DISC'S: at the design speed the thrust is the actuator disc's at the blade's efficiency
//    (genPropDiscT), so the efficiency there is etaBlade x the ideal - 0.70-0.76 on the stock's wood
// 3. THE BLADE'S MATERIAL: the same aeroplane on metal or composite blades pulls etaBlade's ratio more at its design
//    point and the same standing
// 4. NO PROPELLER BEATS ITS DISC: from standing to 1.5 x the design speed the law stays within 3 % of the disc's thrust, on a
//    slow aeroplane with a big disc as on a fast one - and the slow one's static thrust is the larger one its design
//    point needs
// 5. THE REDLINE: at the redline speed the full-throttle shaft turns its rated rpm; below it the thrust is the law's own;
//    past it the thrust is held and the tachometer stays on the redline; a lower rpm limit holds it sooner
// 6. THE PITCH CLASSES: a climb propeller stands harder, is cut for less and meets its redline before the top speed; a
//    cruise one the other way round and never meets it in level flight
// 7. WHAT IS NOT FITTED: a governed propeller (the engine's cs) and an unpowered build are genPropSynth's own
// 8. A FIXED POINT: the built spec rebuilds the same propeller
//   node tools/_propfit_check.js  -> "GATE PROPFIT: PASS|FAIL"   (seconds)
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const bad = [];
const check = (c, m) => { console.log((c ? '  ok     ' : '  FAIL   ') + m); if (!c) bad.push(m); return c; };
const clone = o => JSON.parse(JSON.stringify(o));
const build = f => { const s = clone(C.GEN_DEFAULT); if (f) f(s); return C.buildGen(s); };
const RHO = 1.225, F = C.GEN_PROP_FIT, kmh = v => (v * 3.6).toFixed(0);
const law = (pr, V) => Math.max(0, pr.Tstatic - pr.kV2 * V * V);
const old = pr0 => { const V0 = C.GEN_RULES.propV0K * pr0.powerW / pr0.Tstatic; return { Tstatic: pr0.Tstatic, kV2: pr0.Tstatic / (V0 * V0) }; };

// ---- 1, 2: the anchor ---------------------------------------------------------------------------------------------------
const stock = build(), sp = stock.spec.prop, pp = stock.params.prop;
const syn = C.genPropSynth({ D: sp.D, blades: sp.blades, material: sp.material, powerW: sp.powerW }, 'standard');
const o0 = old(syn);
console.log('the stock: ' + sp.name + ' on ' + (sp.powerW / 1000).toFixed(1) + ' kW; design top speed ' + kmh(sp.Vtop) + ' km/h, cut for ' + kmh(sp.Vd) +
            ', efficiency there ' + sp.etaD.toFixed(3) + '; Tstatic ' + sp.Tstatic.toFixed(0) + ' N, kV2 ' + sp.kV2.toFixed(4) + ' (it was ' + o0.kV2.toFixed(4) + '), redline speed ' + kmh(sp.V1 * Math.sqrt(1 - 0.92 * 0.92)));
check(sp.Tstatic === syn.Tstatic, '1. the stock keeps its class\'s static thrust to the bit (' + sp.Tstatic.toFixed(1) + ' N)');
let worst = 0; for (let V = 0; V <= sp.Vtop; V += 1) worst = Math.max(worst, Math.abs(law(sp, V) / law(o0, V) - 1));
check(worst < 0.05, '1. ...and its thrust within 5 % of the old curve from standing to its top speed (worst ' + (100 * worst).toFixed(1) + ' %)');
check(pp.Tstatic === sp.Tstatic && pp.kV2 === sp.kV2 && pp.V1 === sp.V1 && pp.V1 > 0, '1. the def flies the fitted numbers (params.prop)');
const A = sp.area, Td = C.genPropDiscT(sp.powerW, A, sp.Vd, F.etaBlade.wood, RHO);
check(Math.abs(law(sp, sp.Vd) / Td - 1) < 1e-9, '2. at the design speed the thrust is the actuator disc\'s at the blade\'s efficiency');
check(sp.etaD > 0.70 && sp.etaD < 0.76 && sp.etaD < F.etaBlade.wood, '2. ...an efficiency of ' + sp.etaD.toFixed(3) + ' there (wood: 0.70-0.76, under the blade\'s own ' + F.etaBlade.wood + ')');

// ---- 3: the material ----------------------------------------------------------------------------------------------------
for (const m of ['alu', 'carbon']) {
  const d = build(s => { s.prop.material = m; }), q = d.spec.prop;
  const r = law(q, q.Vd) * q.Vd / (law(sp, sp.Vd) * sp.Vd);
  check(q.Tstatic === sp.Tstatic, '3. ' + m + ' blades stand as the wooden ones do');
  check(r > 1.04 && r < 1.09, '3. ...and deliver ' + (100 * (r - 1)).toFixed(1) + ' % more thrust power at their design point (the blade efficiencies\' ratio: ' + (100 * (F.etaBlade[m] / F.etaBlade.wood - 1)).toFixed(1) + ' %)');
}

// ---- 4: the disc bounds it --------------------------------------------------------------------------------------------
const under = (d, label) => {
  const q = d.spec.prop, eb = F.etaBlade[q.material] || F.etaBlade.wood; let w = 0;
  for (let V = 0; V <= 1.5 * q.Vd; V += 0.5) w = Math.max(w, law(q, V) / C.genPropDiscT(q.powerW, q.area, V, eb, RHO));
  return check(w < F.over + 0.005, '4. ' + label + ': the law stays within ' + Math.round(100 * (F.over - 1)) + ' % of the disc\'s thrust from standing to 1.5 x its design speed (worst ' + w.toFixed(3) + ')');
};
under(stock, 'the stock');
// a slow aeroplane on a big disc: a draggy airframe (an open frame, round struts) behind the same engine
const slow = build(s => { s.fuselage = Object.assign({}, s.fuselage, { covering: 'open' }); s.bracing = Object.assign({}, s.bracing, { section: 'tube', jury: 'cabin' }); s.gear = Object.assign({}, s.gear, { wheelR: 0.30 }); });
const sq = slow.spec.prop;
console.log('a slow one: design top speed ' + kmh(sq.Vtop) + ' km/h; Tstatic ' + sq.Tstatic.toFixed(0) + ' N (its class: ' + syn.Tstatic.toFixed(0) + ')');
under(slow, 'a slow aeroplane');
check(sq.Vtop < sp.Vtop, '4. the draggy airframe\'s design top speed is the lower one (' + kmh(sq.Vtop) + ' against ' + kmh(sp.Vtop) + ' km/h)');
check(sq.Tstatic >= syn.Tstatic, '4. ...and its static thrust is at least its class\'s');
const fast = build(s => { s.engines[0].type = 'io360_mccauley'; s.prop.material = 'alu'; });
under(fast, 'a faster one (IO-360, metal)');

// ---- 5: the redline -----------------------------------------------------------------------------------------------------
{
  const sim = C.makeSim(stock, null); sim.reset(0);
  const EN = stock.params.engine, nR = EN.rpm / (EN.gear > 0 ? EN.gear : 1), sK = C.GEN_SHAFT.staticK;
  const Vred = sp.V1 * Math.sqrt(1 - sK * sK);
  check(Math.abs(Vred / (F.redline.standard * sp.Vtop) - 1) < 1e-9, '5. a standard propeller\'s redline speed is its aeroplane\'s design top speed (' + kmh(Vred) + ' km/h)');
  const nAt = V => C.genShaftRpm(EN, pp, 1, V, 1, 1, true);
  check(Math.abs(nAt(Vred) / nR - 1) < 1e-6, '5. flat out at the redline speed the shaft turns its rated ' + nR.toFixed(0) + ' rpm (' + nAt(Vred).toFixed(1) + ')');
  check(Math.abs(nAt(0) / (sK * nR) - 1) < 1e-9, '5. ...and ' + nAt(0).toFixed(0) + ' standing (staticK, as ever)');
  check(nAt(1.3 * Vred) === nR, '5. past it the tachometer stays on the redline');
  let same = true; for (let V = 0; V <= 0.999 * Vred; V += 2) same = same && sim.thrustAt(V, 0) === Math.max(0, pp.Tstatic - pp.kV2 * V * V);
  check(same, '5. below the redline speed the thrust is the law\'s own, to the bit');
  const V2 = 1.25 * Vred, held = sim.thrustAt(V2, 0), free = Math.max(0, pp.Tstatic - pp.kV2 * V2 * V2);
  check(held < free && held > 0.6 * free, '5. past it the thrust is held (' + held.toFixed(0) + ' N of the law\'s ' + free.toFixed(0) + ' at ' + kmh(V2) + ' km/h)');
  const lo = sim.thrustAt(0.9 * Vred, 0, undefined, 0.92), full = sim.thrustAt(0.9 * Vred, 0);
  check(lo < full, '5. a lower rpm limit (0.92 of rated) holds it sooner (' + lo.toFixed(0) + ' against ' + full.toFixed(0) + ' N at ' + kmh(0.9 * Vred) + ' km/h)');
  // flown: full throttle in a dive past the redline speed - the published rpm stays at the rated speed
  sim.reset(600); sim.ctl.thr = 1;
  const [xA] = sim.axes(); for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = -1.3 * Vred * xA[0]; sim.v[i * 3 + 1] = -1.3 * Vred * xA[1]; sim.v[i * 3 + 2] = -1.3 * Vred * xA[2]; }
  sim.step(1 / 60);
  const rp = sim.out.rpm && sim.out.rpm[0];
  check(rp > 0 && rp <= nR * (1 + 1e-9) && rp > 0.98 * nR, '5. flown past the redline speed at full throttle the shaft reads ' + (rp || 0).toFixed(0) + ' rpm (rated ' + nR.toFixed(0) + ')');
}

// ---- 6: the classes -----------------------------------------------------------------------------------------------------
{
  const cl = build(s => { s.prop.pitch = 'climb'; }).spec.prop, cr = build(s => { s.prop.pitch = 'cruise'; }).spec.prop, sK = C.GEN_SHAFT.staticK, k = Math.sqrt(1 - sK * sK);
  check(cl.Tstatic > sp.Tstatic && sp.Tstatic > cr.Tstatic, '6. standing: climb ' + cl.Tstatic.toFixed(0) + ' > standard ' + sp.Tstatic.toFixed(0) + ' > cruise ' + cr.Tstatic.toFixed(0) + ' N');
  check(cl.Vd < sp.Vd && sp.Vd < cr.Vd, '6. cut for: climb ' + kmh(cl.Vd) + ' < standard ' + kmh(sp.Vd) + ' < cruise ' + kmh(cr.Vd) + ' km/h');
  check(cl.V1 * k < cl.Vtop && cr.V1 * k > cr.Vtop, '6. the climb propeller meets its redline before the top speed (' + kmh(cl.V1 * k) + ' of ' + kmh(cl.Vtop) + '), the cruise one never in level flight (' + kmh(cr.V1 * k) + ')');
}

// ---- 7: what is not fitted ----------------------------------------------------------------------------------------------
{
  const csKey = Object.keys(C.POWERPLANTS).find(k => C.POWERPLANTS[k].engine && C.POWERPLANTS[k].engine.cs);
  const d = build(s => { s.engines[0].type = csKey; }), q = d.spec.prop;
  check(!(d.params.prop.V1 > 0) && Math.abs(q.Tstatic * q.V0 / q.powerW / C.GEN_RULES.propV0K - 1) < 1e-9, '7. a governed propeller (' + csKey + ') keeps the synthesis\'s curve and has no redline speed');
  let un = null; try { un = build(s => { s.engines = []; }); } catch (e) {}
  if (un && C.genUnpowered && C.genUnpowered(un.spec)) check(!(un.params.prop && un.params.prop.V1 > 0) && !(un.spec.prop.Tstatic > 0), '7. an unpowered build has no propeller to fit');
  else console.log('  (no unpowered build from the stock spec: row 7b not read)');
}

// ---- 8: the fixed point -------------------------------------------------------------------------------------------------
{
  const again = C.buildGen(clone(stock.spec)), q = again.spec.prop;
  check(q.Tstatic === sp.Tstatic && q.kV2 === sp.kV2 && q.V1 === sp.V1 && q.Vtop === sp.Vtop, '8. the built spec rebuilds the same propeller');
}

console.log('GATE PROPFIT: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
