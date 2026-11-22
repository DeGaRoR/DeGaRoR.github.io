#!/usr/bin/env node
// GATE SHAPEDRAG (FUSELAGE-DRAG, 2026-11-22; reports/FUSELAGE-DRAG-STUDY-2026-11-22.md): the drag laws that read the
// aeroplane AS DRAWN, held by their own properties - what a builder is told a choice costs is what it costs.
// (60_gen_spec GEN_DRAG.body / legSec / laminar / sticks / junct; 62_gen_aero genFusCdA, genGearLegsCdA, genLamK,
//  genSticksOutCdA; 60_gen_spec genPropFit's stated cut.)
//  1. THE BODY BY ITS SHAPE: with the editor's measured block (spec.bodyShape) the body row is its four shape rows -
//     friction, sharp corners, steps, a blunt base; a sharper corner costs more, a step and a base cost their own
//     coefficients; with no block the body is the wetted build-up it always was
//  2. THE SKIN BY ITS MATERIAL: glass and carbon under wood under alloy under fabric on tube under a soft shell
//  3. LAMINAR FLOW ON A BODY: a moulded, soft-cornered body with no propeller on its nose (the glider); never behind a
//     nose propeller, never on sharp corners
//  4. THE LIFTING SURFACES: one transition point by the construction; none in a propeller's wash; fabric none
//  5. THE GEAR LEGS AS DRAWN: a round tube over a blade over a covered panel over a fairing, on the same member
//  6. THE HEADS IN THE WIND: the drawing decides - a measured cowl that covers its heads pays nothing, whatever the
//     `covers.sides` flag says; heads standing out pay in the measured share
//  7. WHAT STICKS OUT: a fitting family switched off is not paid; hinge fairings, a piano hinge, no horns each do what
//     they say; the core's family map is the fittings page's own
//  8. THE JUNCTION BY ITS ROOT: twice the chord, four times the drag; a thin root next to nothing; a fillet leaves 0.3
//  9. A STATED PROPELLER CUT: the design point and the redline are the stated speed; unstated, the pitch class's
//   node tools/_shapedrag_check.js  -> "GATE SHAPEDRAG: PASS|FAIL"   (a few seconds; one build through the load door)
'use strict';
const fs = require('fs'), path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const LB = require(path.join(__dirname, '_load_build.js'));
const bad = [];
const check = (c, m) => { console.log((c ? '  ok     ' : '  FAIL   ') + m); if (!c) bad.push(m); return c; };
const clone = o => JSON.parse(JSON.stringify(o));
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));
const D = C.GEN_DRAG, f3 = v => (+v).toFixed(3), f4 = v => (+v).toFixed(4);
const SHAPE0 = { v: 1, sharp: 0.2, stepM2: 0.03, baseM2: 0.02, trip: 0.3 };
// the stock aeroplane with a measured body block (and whatever else `ed` changes), built
const mk = (bs, ed) => { const s = clone(C.GEN_DEFAULT); if (bs) s.bodyShape = Object.assign({}, SHAPE0, bs); if (ed) ed(s); return C.buildGen(s); };
const dragOf = (bs, ed) => mk(bs, ed).params.gen.drag;

// ---- 1: the body by its shape -----------------------------------------------------------------------------------------
{ const old = dragOf(null), a = dragOf({}), sh = dragOf({ sharp: 0.6 }), st = dragOf({ stepM2: 0.13 }), ba = dragOf({ baseM2: 0.52 });
  check(!('shape' in old) && old.screen > 0, '1. no measured block: the body is the wetted build-up and its screen row, as ever (' + f3(old.body) + ' + ' + f3(old.screen) + ' m2)');
  check(a.shape && near(a.body, a.shape.friction + a.shape.corners + a.shape.steps + a.shape.base) && a.screen === 0,
        '1. a measured body is its four shape rows, the screen inside its steps (' + [a.shape.friction, a.shape.corners, a.shape.steps, a.shape.base].map(f3).join(' + ') + ' = ' + f3(a.body) + ')');
  check(near(a.shape.corners, a.shape.friction * D.body.corner * 0.2) && near(sh.shape.corners, sh.shape.friction * D.body.corner * 0.6) && sh.body > a.body,
        '1. a sharper corner costs more: friction x ' + D.body.corner + ' x sharpness (' + f3(a.shape.corners) + ' at 0.2 -> ' + f3(sh.shape.corners) + ' at 0.6)');
  check(near(st.shape.steps - a.shape.steps, D.body.step * 0.10) && near(ba.shape.base - a.shape.base, D.body.base * 0.50),
        '1. a step pays ' + D.body.step + ' x its area, a blunt base ' + D.body.base + ' x its own');
  check(dragOf({ sharp: -1 }).shape === undefined && dragOf({ v: 2 }).shape === undefined, '1. a block that is not a v1 measurement is not read'); }

// ---- 2: the skin by its material --------------------------------------------------------------------------------------
{ const K = D.body.kSkin, order = ['glass', 'wood', 'alloy', 'tubeFabric', 'softShell'];
  const fr = order.map(m => { const d = dragOf({}, s => { s.fuselage = Object.assign({}, s.fuselage, { material: m }); }); return d.shape.friction / (d.swet * d.FF); });
  check(order.every((m, i) => !i || K[m] > K[order[i - 1]]) && fr.every((v, i) => !i || v > fr[i - 1]),
        '2. the skin by its material, per m2 of wetted area and form: ' + order.map((m, i) => m + ' ' + (fr[i] * 1000).toFixed(2)).join(' < ') + ' (x 1e-3)'); }

// ---- 3: laminar flow on a body ----------------------------------------------------------------------------------------
{ const gl = dragOf({ sharp: 0.1 }, s => { s.fuselage = Object.assign({}, s.fuselage, { material: 'glass' }); });
  check(gl.shape.lam === 0, '3. a moulded body behind a nose propeller: no laminar share');
  const ls = C.buildGen(LB.loadBuild('builds/ls4_2026-11-13.json').spec), sh = ls.params.gen.drag.shape;
  check(sh && sh.lam > 0 && sh.lam <= D.body.lamMax && sh.sharp < D.body.lamSharp, '3. the glass glider (no propeller, soft corners ' + f3(sh.sharp) + '): ' + sh.lam + ' of its skin laminar');
  const s2 = clone(ls.spec); s2.bodyShape = Object.assign({}, s2.bodyShape, { sharp: D.body.lamSharp + 0.05 });
  check(C.buildGen(clone(LB.loadBuild('builds/ls4_2026-11-13.json').spec)).params.gen.drag.shape.lam > 0 &&
        (() => { const sp = LB.loadBuild('builds/ls4_2026-11-13.json').spec; sp.bodyShape = Object.assign({}, sp.bodyShape, { sharp: D.body.lamSharp + 0.05 }); return C.buildGen(sp).params.gen.drag.shape.lam === 0; })(),
        '3. the same glider with sharp corners (' + f3(D.body.lamSharp + 0.05) + '): none'); }

// ---- 4: the lifting surfaces ------------------------------------------------------------------------------------------
{ const L = D.laminar.x, c = C.genLamK(1.0, 'carbon', 0, false), w = C.genLamK(1.0, 'wood', 0, false), fab = C.genLamK(1.0, 'fabric', 0, false);
  check(c.x === L.carbon && c.k < w.k && w.k < 1 && fab.k === 1 && fab.x === 0, '4. one transition point by the construction: carbon ' + c.x + ' (profile drag x ' + f3(c.k) + '), wood ' + w.x + ' (x ' + f3(w.k) + '), fabric none');
  check(C.genLamK(1.0, 'carbon', 1, false).k === 1 && C.genLamK(1.0, 'carbon', 0, true).k === 1 && C.genLamK(1.0, 'carbon', 0.5, false).x === L.carbon * 0.5,
        '4. none in a propeller\'s wash, none on a tripped surface; half a wash, half the run'); }

// ---- 5: the gear legs as drawn ----------------------------------------------------------------------------------------
{ const leg = sec => C.genGearLegsCdA({ gearShape: { v: 1, legs: [{ L: 0.8, d: 0.04, sec }] } });
  const r = leg('round'), b = leg('blade'), p = leg('panel'), f = leg('fair'), T = D.legSec;
  check(near(r, 0.8 * 0.04 * T.round) && r > b && b > p && p > f, '5. the same member: a round tube ' + f4(r) + ' > a blade ' + f4(b) + ' > a covered panel ' + f4(p) + ' > a fairing ' + f4(f) + ' m2');
  check(C.genGearLegsCdA({}) === null && C.genGearLegsCdA({ gearShape: { v: 1, legs: [{ L: 0.8, d: 0.04, sec: 'what' }] } }) === null, '5. no drawn legs, or a member it cannot read: the old figure stands (null)'); }

// ---- 6: the heads in the wind -----------------------------------------------------------------------------------------
{ const cool = (out, all) => ({ face: 0.04, scoop: 0, scoopAlt: 0, scoopRev: 0, nacInlet: 0, exit: 0, gills: 0, units: [{ aft: 0, k: 1, turned: 0 }], headsOut: out, headsAll: all });
  const cov = dragOf({}, s => { s.cooling = cool(0, 0.16); }), half = dragOf({}, s => { s.cooling = cool(0.08, 0.16); }), all = dragOf({}, s => { s.cooling = cool(0.16, 0.16); });
  check(cov.heads === 0, '6. a measured cowl that covers its heads pays nothing for them');
  check(half.heads > 0 && near(all.heads, 2 * half.heads, 1e-6), '6. heads standing out pay in the measured share (' + f3(half.heads) + ' at half, ' + f3(all.heads) + ' m2 all out)'); }

// ---- 7: what sticks out -----------------------------------------------------------------------------------------------
{ const S = mk({}).spec, base = C.genSticksOutCdA(S), cg = o => C.genSticksOutCdA(Object.assign({}, S, { cage: Object.assign({}, S.cage || {}, o) }));
  check(base.sum > 0 && near(base.sum, base.fittings + base.hinges + base.horns + base.links) && near(mk({}).params.gen.drag.sticks, base.sum),
        '7. the stock aeroplane: fittings ' + f4(base.fittings) + ', hinges ' + f4(base.hinges) + ', horns ' + f4(base.horns) + ', pushrods ' + f4(base.links) + ' = its sticks row ' + f4(base.sum) + ' m2');
  const noH = cg({ accHandling: 0 }), noAll = cg({ accOn: 0 });
  check(noH.fittings < base.fittings && noAll.fittings < noH.fittings && near(noH.hinges, base.hinges), '7. a fitting family switched off is not paid (steps and handles off: ' + f4(base.fittings) + ' -> ' + f4(noH.fittings) + '; the layer off: ' + f4(noAll.fittings) + ', the pitot)');
  const fair = cg({ hgFair: 1 }), piano = cg({ hgFamily: 2 }), noHorn = cg({ hgHorn: 0 }), noLink = cg({ hgLink: 0 });
  check(near(fair.hinges, base.hinges * D.sticks.fair) && piano.hinges === 0 && noHorn.horns === 0 && noHorn.links === 0 && noLink.links === 0 && near(noLink.horns, base.horns),
        '7. hinge fairings leave ' + D.sticks.fair + ' of the hinges, a piano hinge lies in the gap, no horns: no horns and no pushrods');
  // the core's family map is the fittings page's (tools/_cage_access.js FAMILY): one table said twice, held together
  const src = fs.readFileSync(path.join(__dirname, '_cage_access.js'), 'utf8'), m = /const FAMILY = \{([\s\S]*?)\n\};/.exec(src);
  const page = {}; if (m) for (const q of m[1].replace(/\/\/[^\n]*/g, '').matchAll(/(\w+):\s*'(\w+)'/g)) page[q[1]] = q[2];
  const core = D.sticks.family, drawn = Object.keys(core).filter(k => k in page), diff = drawn.filter(k => core[k] !== page[k]);
  check(m && drawn.length >= 12 && !diff.length && Object.keys(core).every(k => k in page || /Wing2$/.test(k)),
        '7. the core\'s fitting families are the fittings page\'s (' + drawn.length + ' fittings' + (diff.length ? '; differ: ' + diff.join(', ') : '') + ')'); }

// ---- 8: the junction by its root --------------------------------------------------------------------------------------
{ const J = D.junct, jr = (c, tc) => Math.max(0, c * c * (J.kT * tc * tc * tc - J.k0));
  // (the tail's three junctions ride in the same row, by its own root chords: taken off to read the wing's)
  const W = (c, naca, ed) => { const d = mk({}, s => { s.wings[0].chord = c; s.wings[0].naca = naca; if (ed) ed(s); }), tl = d.spec.tail;
    const tail = 2 * jr(tl.hChord, J.tailT) + jr(tl.vChord, J.tailT); return { wing: d.params.gen.drag.junct - tail, tail, strut: d.spec.bracing.type === 'strut' }; };
  const a = W(1.2, 2412), b = W(2.4, 2412), thin = W(1.2, 2409), fil = W(1.2, 2412, s => { s.cage = Object.assign({}, s.cage || {}, { wgFillet: 1 }); });
  const k = a.strut ? J.strutHigh : 1;
  check(near(a.wing, 2 * jr(1.2, 0.12) * k, 1e-6), '8. a 1.2 m root 12 % thick: 2 x ' + f4(jr(1.2, 0.12)) + ' x ' + k + ' = ' + f4(a.wing) + ' m2 (the tail\'s three thin junctions: ' + f4(a.tail) + ')');
  check(near(b.wing, 4 * a.wing, 1e-6), '8. twice the chord, four times the drag (' + f4(a.wing) + ' -> ' + f4(b.wing) + ')');
  check(near(thin.wing, 2 * jr(1.2, 0.09) * k, 1e-6) && thin.wing < a.wing / 3 && jr(1.2, 0.06) === 0, '8. a thinner root pays far less (9 %: ' + f4(thin.wing) + '), a 6 % one nothing');
  check(near(fil.wing, a.wing * J.fillet, 1e-6), '8. a root fillet leaves ' + J.fillet + ' of it (' + f4(fil.wing) + ')'); }

// ---- 9: a stated propeller cut ----------------------------------------------------------------------------------------
{ const base = () => ({ D: 1.8, area: Math.PI * 0.81, material: 'wood', powerW: 48e3, Tstatic: 1100, pitchUsed: 'standard', blades: 2 });
  const o = { nE: 1, f: 0.6, W: 5400, S: 16, eAR: Math.PI * 0.75 * 7 };
  const a = C.genPropFit(base(), o), b = C.genPropFit(base(), Object.assign({}, o, { vRed: 25 }));
  const kS = Math.sqrt(1 - C.GEN_SHAFT.staticK * C.GEN_SHAFT.staticK);
  check(a && near(a.Vd, C.GEN_PROP_FIT.design.standard * a.Vtop) && near(a.V1 * kS, C.GEN_PROP_FIT.redline.standard * a.Vtop), '9. unstated: the design point and the redline are the pitch class\'s share of the aeroplane\'s top speed (' + (a.Vd * 3.6).toFixed(0) + ' km/h)');
  check(b && near(b.Vd, 25) && near(b.V1 * kS, 25) && b.Tstatic >= a.Tstatic && b.kV2 > a.kV2, '9. stated at 90 km/h: cut for that speed - more thrust standing (' + a.Tstatic.toFixed(0) + ' -> ' + b.Tstatic.toFixed(0) + ' N), less at speed'); }

console.log(bad.length ? 'GATE SHAPEDRAG: FAIL (' + bad.length + ')' : 'GATE SHAPEDRAG: PASS');
process.exit(bad.length ? 1 : 0);
