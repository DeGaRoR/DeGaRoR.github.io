#!/usr/bin/env node
// GATE DRAGROWS (PHYSICS-AUDIT step 5, 2026-11-22; reports/PHYSICS-AUDIT-2026-11-21.md): the three drag rows the study
// supports (60_gen_spec GEN_DRAG.float / hullK / radialWake; 62_gen_aero).
// 1. A FLOATPLANE PAYS ITS FLOATS: the validated float Super Cub's gear row is its two floats (cd x beam x depth) and
//    their exposed struts (strutCd x length x strutT) plus the lift struts - no wheel and no leg in it; its body row is
//    the landplane's
// 2. A LANDPLANE IS UNTOUCHED: the stock aeroplane's gear row is genGearCdA's own, no float key
// 3. A HULL: the body row of a fuselage that is the boat is hullK x the same body's without gear.hull
// 4. A BARE RADIAL ON THE NOSE: its body row is less the form share the engine's disc covers; an inline engine's, a
//    NACA-cowled radial's and a measured cowl's are whole
//   node tools/_dragrows_check.js  -> "GATE DRAGROWS: PASS|FAIL"   (a minute cold: three builds through the load door)
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const LB = require(path.join(__dirname, '_load_build.js'));
const bad = [];
const check = (c, m) => { console.log((c ? '  ok     ' : '  FAIL   ') + m); if (!c) bad.push(m); return c; };
const clone = o => JSON.parse(JSON.stringify(o));
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));
const D = C.GEN_DRAG;

// ---- 1: the floats ------------------------------------------------------------------------------------------------------
{ const def = C.buildGen(LB.loadBuild('builds/pa18_floats_2026-10-23.json').spec), S = def.spec, g = def.params.gen, F = S.gear.floats;
  let Ls = 0; for (const b of def.beams) if (b.cls === 'gear' && b.ext) Ls += b.L;
  const floats = 2 * D.float.cd * F.B * F.H, struts = D.float.strutCd * Ls * C.GEN_RULES.strutT;
  const lift = S.bracing.type === 'strut' ? 2 * 0.10 * (0.55 * S.geom.semi * 1.12) * 0.06 : 0;
  console.log('the float Super Cub: floats ' + floats.toFixed(3) + ' m2 (2 x ' + D.float.cd + ' x ' + F.B.toFixed(2) + ' x ' + F.H.toFixed(2) + '), struts ' + struts.toFixed(3) + ' (' + Ls.toFixed(1) + ' m), lift struts ' + lift.toFixed(3) + '; gear row ' + g.drag.gear.toFixed(3));
  check(S.gear.type === 'floats' && near(g.drag.floats, floats) && near(g.drag.floatStruts, struts), '1. the floats and their struts are billed as stated');
  check(near(g.drag.gear, floats + struts + lift), '1. the gear row is the floats, their struts and the lift struts - no wheel, no leg');
  check(near(C.genGearCdA(S, S.geom.semi, true), lift) && C.genGearCdA(S, S.geom.semi) > lift + 0.1, '1. ...where it was a phantom wheeled gear (' + C.genGearCdA(S, S.geom.semi).toFixed(3) + ' m2)'); }
// ---- 2: a landplane -----------------------------------------------------------------------------------------------------
const stock = C.buildGen(clone(C.GEN_DEFAULT));
check(near(stock.params.gen.drag.gear, C.genGearCdA(stock.spec, stock.spec.geom.semi)) && !('floats' in stock.params.gen.drag) && !('hullK' in stock.params.gen.drag) && !('radialWake' in stock.params.gen.drag),
      '2. the stock landplane: its gear row is genGearCdA\'s own, and it carries none of the three keys');
// ---- 3: a hull ----------------------------------------------------------------------------------------------------------
{ const sp = LB.loadBuild('builds/candidates/superpetrel_V4_2.json').spec, def = C.buildGen(clone(sp)), d = def.params.gen.drag;
  const FF = d.FF, bare = d.swet * d.cdWet * FF * d.boxK * (d.reK || 1);
  check(def.spec.gear.hull && Array.isArray(def.spec.gear.hull.sta) && d.hullK === D.hullK, '3. the Super Petrel is a hull (gear.hull) and says so (hullK ' + d.hullK + ')');
  check(near(d.body, D.hullK * bare, 1e-9), '3. its body row is hullK x the wetted build-up (' + d.body.toFixed(3) + ' = ' + D.hullK + ' x ' + bare.toFixed(3) + ' m2)'); }
// ---- 4: a bare radial ---------------------------------------------------------------------------------------------------
{ const sp = LB.loadBuild('builds/candidates/stearman_2026-10.json').spec, def = C.buildGen(clone(sp)), d = def.params.gen.drag, E = def.spec.engBox;
  const whole = d.swet * d.cdWet * d.FF * d.boxK * (d.reK || 1), cover = Math.min(1, Math.PI * E.cylReach * E.cylReach / d.frontal);
  console.log('the Stearman-alike: a bare radial, its disc over ' + (100 * cover).toFixed(0) + ' % of the body\'s frontal; body ' + whole.toFixed(3) + ' -> ' + d.body.toFixed(3) + ' m2');
  check(d.radialWake > 0 && near(d.radialWake, D.radialWake * cover * (d.FF - 1) / d.FF * whole) && near(d.body, whole - d.radialWake), '4. a bare radial on the nose: the body row less the form share its disc covers (' + d.radialWake.toFixed(3) + ' m2)');
  const tm = C.buildGen(LB.loadBuild('builds/candidates/tigermoth_2026-10.json').spec).params.gen.drag;
  check(!('radialWake' in tm), '4. an inline engine\'s body is whole (the Tiger Moth-alike)');
  const cm = C.buildGen(LB.loadBuild('builds/candidates/camel_2026-10.json').spec).params.gen.drag;
  check(!('radialWake' in cm) || cm.coolBy !== 'momentum', '4. a measured cowl\'s body is whole (the Camel-alike: cooling by ' + cm.coolBy + ')'); }

console.log('GATE DRAGROWS: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
