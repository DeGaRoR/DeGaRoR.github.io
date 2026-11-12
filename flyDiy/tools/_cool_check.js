#!/usr/bin/env node
// _cool_check.js — GATE COOL (ENGINE-COOLING, the user 12 Nov: "planes look the way they look because they need these
// things ... I'd rather that be encoded in physics"; futureDesigns/ENGINE-COOLING-2026-11.md, its defaults ruled "OK").
//
//   FACING        genCoolOpen on a hand-made spec: a tractor's front openings take the air in, a pusher's let it out; a
//                 scoop turned round (scoopRev) faces the flight on a pusher only; a nacelle cone's inlet faces the
//                 flight on a pusher; the lowered bottom and the gills are outlets; no cowl = bare; no measurement =
//                 legacy (no row, and the drag the per-kW law gave, bit for bit)
//   CALIBRATION   the cowls fitted to real reference models pass the hot-day climb (38 C at sea level) with a real
//                 margin - list:1 Cub, list:50 V2-172, list:2 Jodel; the Tiger Moth-alike on its heads in the wind; the
//                 Super Petrel's nacelle inlet is COUNTED (the user, 12 Nov)
//   THE SUCTION   a pusher's prop sucks on its outlet in flight (GEN_COOL.suck): the Petrel's air speeds up by the
//                 disc's root law, suck 0 gives the flight speed back exactly, the ground keeps its own inflow law
//   THE PUSHER    list:6 Twin busher floats 4b's OLD drawing (12 Nov, before the user's "modify them at once"): no opening
//                 faces the air, the row fails and says so; the remedy's own steps (turn the scoop, size it - buried in
//                 the deep cowl it measures nothing - stand it out of the skin, give the air a way out) never lower the
//                 margin, and the last one is the card as saved now, which passes; list:41 Super Petrel as saved passes
//   THE BURIED SCOOP  only the part of a scoop's mouth outside the cowl's skin is measured open
//   DRAG          the momentum figure within 0.006 m2 of the per-kW figure on the three light cowls; never less than
//                 the needed air's (a starved engine does not fly faster); a high-power liquid engine is no longer
//                 charged five times over (the per-kW law against the momentum one on the Merlin's numbers)
//   CERTIFICATE   the rows land PROPOSED: a fail withdraws neither certificate (genCertTiers); spec.cooling never
//                 moves the major fingerprint (certStrip) nor the bench's old f2 body (R3)
//   THE SERIES    (ENGINE-COOLING 3) the inlet, the engine's passages and a drawn outlet in series: a tiny inlet runs at
//                 its best velocity ratio, a huge one stops at the passages, more inlet never passes less
//   THE HEADS     the cylinders measured against the DRAWN skin: list:26 Client Cub's poke through (counted), list:1 Cub's
//                 are covered, list:7 Rufus (no cowl) gets its own figure, list:10 Tiger Moth-alike's are inside
//   THE BIRTH     the archetypes' birth rule (designCoolBirth): never shrinks, opens what each kind of mount needs
//   THE PUSH-PULL every engine on the body judged; the rear one breathes through its own turned scoop (cw_scoopAft)
//   THE SCOOP     turned round, its mouth at the firewall end and its skin still facing out; on TOP of the cowl
//                 (scoopTop), above the spine, skin out; absent = as it was, bit for bit
//
//   node tools/_cool_check.js   (~5 min: nine cards and an archetype through the load door)
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const LB = require('./_load_build.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); };
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const card = (f, patch) => { const b = LB.loadBuild(f, patch ? { patch } : undefined); const def = C.buildGen(b.spec); return { spec: b.spec, def }; };
const coolOf = def => C.genCooling(def.spec, { VClimb: def.params.ap.VClimb, VCruise: def.params.ap.VCruise });
const rowOf = (def, id) => C.genCoolRows(def).find(r => r.id === id) || null;

console.log('FACING (genCoolOpen on a hand-made resolved spec)');
{
  const base = { cage: { cowlOn: 1 }, cowl: {}, engines: [{ type: 'a65_sensenich74', mount: 'nose' }],
                 engAt: [{ mount: 'nose', pushes: false }],
                 cooling: { face: 0.05, scoop: 0.01, scoopRev: 0, nacInlet: 0.02, exit: 0.03, gills: 0.004 } };
  const O = s => C.genCoolOpen(s);
  const t = O(base);
  ok(t.kind === 'measured' && r3(t.inA) === 0.06 && r3(t.outA) === 0.054, 'a tractor: the face and the scoop in (0.06), the cone, the exit and the gills out (' + r3(t.inA) + ' / ' + r3(t.outA) + ')');
  const p = O(Object.assign({}, base, { engAt: [{ mount: 'pusher', pushes: true }] }));
  ok(r3(p.inA) === 0.054 && r3(p.outA) === 0.06, 'a pusher (its cowl turned round): the cone, the lowered bottom and the gills face the flight, the face and the scoop are its way out (' + r3(p.inA) + ' / ' + r3(p.outA) + ')');
  const pr = O(Object.assign({}, base, { engAt: [{ mount: 'pusher', pushes: true }], cooling: Object.assign({}, base.cooling, { scoopRev: 1 }) }));
  ok(r3(pr.inA) === 0.064, 'a pusher with its scoop turned round: the scoop faces the flight (' + r3(pr.inA) + ')');
  // a push-pull: unit 1 is the nose cowl turned round on the rear engine; its scoop turned on its own (scoopAft) faces
  // the flight there with the mouth at its other end (scoopAlt), its area x the unit's factor
  const pp = Object.assign({}, base, { engAt: [{ mount: 'nose', pushes: false }, { mount: 'pusher', pushes: true }],
    cooling: Object.assign({}, base.cooling, { scoopAlt: 0.012, units: [{ aft: 0, k: 1, turned: 0 }, { aft: 1, k: 0.5, turned: 1 }] }) });
  const r0 = C.genCoolOpen(pp, 0), r1 = C.genCoolOpen(pp, 1);
  ok(r3(r0.inA) === 0.06 && r3(r1.inA) === r3(0.5 * (0.02 + 0.03 + 0.004 + 0.012)),
     'a push-pull: the nose as a tractor (' + r3(r0.inA) + '), the rear engine through its own turned scoop and the turned shell, at its unit\'s size (' + r3(r1.inA) + ')');
  const tr = O(Object.assign({}, base, { cooling: Object.assign({}, base.cooling, { scoopRev: 1 }) }));
  ok(r3(tr.inA) === 0.05, 'a tractor with its scoop turned round: it faces aft (' + r3(tr.inA) + ')');
  ok(O(Object.assign({}, base, { cage: { cowlOn: 0 } })).kind === 'bare', 'no cowl: bare');
  ok(O(Object.assign({}, base, { cooling: undefined })).kind === 'legacy', 'no measurement: legacy');
  ok(O(Object.assign({}, base, { cooling: { face: 0.05 } })).exitSized === true, 'no outlet drawn: the outlet is sized for you');
  // the side gills (the "shark fins") on a tractor ADD to the exit sized for you, never cap it; the lowered bottom draws it
  const gl = O(Object.assign({}, base, { cooling: { face: 0.05, gills: 0.004 } }));
  ok(gl.exitSized === true && r3(gl.outA) === 0.004, 'a tractor\'s gills alone: still sized for you (they add, 0.004 m2 out), they never become the only way out');
}

console.log('CALIBRATION (the reference-fitted cowls, the hot-day climb)');
const CUB = card('builds/cub_2026-09-20_corrected.json');
const C172 = card('builds/cessna172r_2026-11-08.json');
const JOD = card('builds/jodel_2026-09-20_corrected.json');
const TM = card('builds/candidates/tigermoth_2026-10.json');
const PET = card('builds/candidates/superpetrel_V4_1.json');
const RUF = card('builds/rufus_2026-10-18_certified.json');
for (const [n, X, lo, hi] of [['list:1 Cub', CUB, 1.5, 3], ['list:50 V2-172', C172, 1.5, 3], ['list:2 Jodel', JOD, 1.5, 3.2]]) {
  const K = coolOf(X.def), row = rowOf(X.def, 'cool.climb');
  ok(K.kind === 'measured' && K.hot.margin >= lo && K.hot.margin <= hi && row && row.level === 'pass',
     n + ': ' + r2(K.hot.margin) + ' x the air at 38 C (band ' + lo + '-' + hi + '), in ' + r3(K.inA) + ' m2 (needs ' + r3(K.hot.inNeed) + ', ' + r3(K.hot.inPass) + ' to the pass line), the row ' + (row && row.level));
}
{
  const P = coolOf(PET.def), pr = rowOf(PET.def, 'cool.climb');
  ok(P.kind === 'measured' && P.pushes && P.inA > 0.03 && P.parts.some(q => q.what === 'the nacelle\'s inlet' && q.faces === 'fwd'),
     'list:41 Super Petrel: its nacelle inlet faces the air and is counted (' + r3(P.inA) + ' m2, ' + r2(P.hot.margin) + ' x)');
  ok(pr && pr.level === 'pass', 'list:41 Super Petrel as the user drew it (its inlet 0.42 of the nacelle): the hot climb passes (' + (pr && pr.value) + ')');
}

console.log('THE SERIES (the inlet, the engine\'s passages, the outlet)');
{
  // the Cub's own engine and speeds, its front opening scaled: a small inlet runs near its best velocity ratio, a big one
  // stops buying air at the engine's passages
  const at = f => { const S = JSON.parse(JSON.stringify(CUB.def.spec)); S.cooling.face *= f; S.cooling.scoop *= f; S.cooling.headsOut = 0;
                    return C.genCooling(S, { VClimb: CUB.def.params.ap.VClimb, VCruise: CUB.def.params.ap.VCruise }); };
  const tiny = at(0.02), big = at(30), K0 = C.GEN_COOL;
  const vr = tiny.hot.flow / (tiny.hot.rho * tiny.hot.Vin * tiny.inA);
  ok(vr > 0.97 * K0.ivr && vr <= K0.ivr, 'a tiny inlet runs at its best velocity ratio (' + r3(vr) + ' of ' + K0.ivr + ')');
  ok(big.hot.margin < K0.passages && big.hot.margin > 0.95 * K0.passages && big.hot.limit === 'engine',
     'a huge inlet stops at the engine\'s passages (' + r2(big.hot.margin) + ' x, limit ' + big.hot.limit + ')');
  const m = [0.25, 0.5, 1, 2, 4].map(f => at(f).hot.margin);
  ok(m.every((v, i) => !i || v > m[i - 1]), 'more inlet, more air, never less (' + m.map(r2).join(' < ') + ')');
}

console.log('THE HEADS (measured against the drawn cowl; a bare engine\'s figure)');
{
  const CC = card('builds/cub_2026-09-20.json'), Kc = coolOf(CC.def), rc = rowOf(CC.def, 'cool.climb');
  ok(CC.spec.cooling.headsOut > 0.03 && Math.abs(Kc.bareA - CC.spec.cooling.headsOut) < 1e-9 && rc && rc.level === 'pass',
     'list:26 Client Cub: its heads poke through the drawn skin (' + r3(CC.spec.cooling.headsOut) + ' m2), counted, the row passes (' + (rc && rc.value) + ')');
  ok(CUB.spec.cooling.headsOut === 0 && CUB.spec.cooling.headsAll > 0.1, 'list:1 Cub: its cowl covers its heads (0 of ' + r3(CUB.spec.cooling.headsAll) + ' m2 out)');
  const R = C.genCoolRows(RUF.def), Kr = coolOf(RUF.def);
  ok(R.length === 1 && Kr.kind === 'bare' && R[0].value > 1.5 && R[0].level === 'pass',
     'list:7 Rufus (no cowl): its own figure, ' + R[0].value + ' x on ' + r3(Kr.bareA) + ' m2 of cylinders in the wind');
  const K = coolOf(TM.def);
  ok(TM.spec.cooling.headsOut === 0, 'list:10 Tiger Moth-alike: its cylinders inside its drawn cowl (0 out; the generator\'s loft said ' + r3(C.genHeadsFrontal(TM.def.spec)) + ') - ' + r2(K.hot.margin) + ' x');
}

console.log('THE SUCTION (a pusher\'s prop on its outlet, in flight)');
{
  const P = coolOf(PET.def), V = PET.def.params.ap.VClimb / Math.sqrt(C.makeAtmos({ dISA: 23 }).sigma(0));
  ok(P.hot.Vin / V > 1.05 && P.hot.Vin / V < 1.3, 'list:41 Super Petrel: the air through its nacelle at ' + r2(P.hot.Vin / V) + ' x the climb speed');
  const s0 = C.GEN_COOL.suck; C.GEN_COOL.suck = 0;
  const P0 = coolOf(PET.def); C.GEN_COOL.suck = s0;
  ok(Math.abs(P0.hot.Vin - V) < 1e-9 && P0.taxi.Vin === P.taxi.Vin, 'suck 0: the flight speed exactly, and the ground\'s own inflow law either way');
  const T = coolOf(CUB.def); C.GEN_COOL.suck = 0; const T0 = coolOf(CUB.def); C.GEN_COOL.suck = s0;
  ok(T.hot.Vin === T0.hot.Vin, 'a tractor: untouched');
}

// the Twin busher as drawn before the user's ruling (12 Nov): a small chin scoop facing the propeller, no exit
const BU_OLD = { cw_scoopRev: 0, cw_scoopFollow: 0, cw_scoopW: 0.065, cw_scoopH: 0.055, cw_scoopAp: 0.68, cw_apW: 0.108, cw_apH: 0.108 };
console.log('THE PUSHER (list:6 Twin busher floats 4b, from its old drawing by the remedy\'s own steps)');
{
  const F = 'builds/candidates/Twin_busher_floats_4b.json';
  const ov = o => Object.assign({}, BU_OLD, o);
  const steps = [['the old drawing', ov({})], ['the scoop turned', ov({ cw_scoopRev: 1 })],
                 ['+ sized (buried)', ov({ cw_scoopRev: 1, cw_scoopW: 0.2, cw_scoopH: 0.15, cw_scoopAp: 0.9 })],
                 ['+ out of the skin', ov({ cw_scoopRev: 1, cw_scoopW: 0.2, cw_scoopH: 0.15, cw_scoopAp: 0.9, cw_scoopFollow: 1 })],
                 ['+ a way out (the face)', ov({ cw_scoopRev: 1, cw_scoopW: 0.2, cw_scoopH: 0.15, cw_scoopAp: 0.9, cw_scoopFollow: 1, cw_apW: 0.2, cw_apH: 0.2 })]];
  let prev = -1, last = null, first = null, buried = null;
  for (const [n, over] of steps) {
    const X = card(F, j => { Object.assign(j.spec.cage, over); return j; });
    const row = rowOf(X.def, 'cool.climb'), m = row ? row.value : null;
    if (!first) first = row;
    if (/buried/.test(n)) buried = { X, row };
    console.log('         ' + n.padEnd(18) + ' ' + r2(m) + ' x  ' + (row && row.fix ? '→ ' + row.fix : ''));
    ok(m != null && m >= prev, n + ': the margin does not fall (' + r2(m) + ')');
    prev = m; last = row;
  }
  ok(first && first.level === 'fail' && first.value === 0 && /face the propeller, which on a pusher is backwards/.test(first.why) && /turn the scoop round/.test(first.fix),
     'the old drawing: it fails, and says why and what to draw');
  ok(last && last.level === 'pass', 'the remedy followed: the hot climb passes (' + (last && last.value) + ')');
  console.log('THE BURIED SCOOP');
  ok(buried && !(buried.X.spec.cooling.scoop > 0) && /inside the cowl's skin/.test(buried.row.why),
     'a turned, sized scoop drawn inside the deep cowl measures nothing open (' + (buried && buried.X.spec.cooling.scoop) + ') and the row says why');
  const SV = card(F), sr = rowOf(SV.def, 'cool.climb');
  ok(sr && sr.level === 'pass' && sr.value === last.value, 'list:6 as saved now is the last step: it passes (' + (sr && sr.value) + ')');
}

console.log('DRAG (the momentum figure)');
{
  for (const [n, X] of [['Cub', CUB], ['V2-172', C172], ['Jodel', JOD]]) {
    const g = X.def.params.gen.drag, eng = X.def.params.engine, kW = C.GEN_DRAG.kCool.pressureCowl * C.genEngineThermo(eng).coolKW;
    ok(g.coolBy === 'momentum' && Math.abs(g.cool - kW) < 0.006, n + ': ' + r3(g.cool) + ' m2 by momentum against ' + r3(kW) + ' per kW');
  }
  const BU = card('builds/candidates/Twin_busher_floats_4b.json', j => { Object.assign(j.spec.cage, BU_OLD); return j; });
  const K = coolOf(BU.def);
  ok(K.cdA > 0.01 && Math.abs(K.Aeff - Math.max(0, K.hot.need - K.hot.bare) / (K.hot.rho * K.hot.Vin)) < 1e-9, 'a starved engine pays the drag of the air it needs (' + r3(K.cdA) + ' m2), not none');
  // the per-kW law on a 1283 kW liquid engine (a Merlin's 539 kW of heat) climbing at 72 m/s against the momentum one:
  // the air it needs is Q / cp dT; the drag of that air through a duct is 2 m (1 - r) / rho V
  const K0 = C.GEN_COOL, Q = 0.42 * 1283e3, rho = 1.225, dT = K0.path.liquid.eps * (K0.path.liquid.Tlim - 15);
  const m = Q / (K0.cp * dT), cdMom = 2 * m * (1 - K0.r.duct) / (rho * 72), cdKW = C.GEN_DRAG.kCool.liquid * Q / 1000;
  ok(cdKW / cdMom > 3, 'a Merlin-class engine: per kW ' + r3(cdKW) + ' m2 against ' + r3(cdMom) + ' by momentum (the law it replaces, x' + r2(cdKW / cdMom) + ')');
}

console.log('CERTIFICATE (the ruled rows, the proposed door, the fingerprint)');
{
  const T = C.genCertTiers([{ id: 'cool.climb', tier: 'safe', proposed: true, level: 'fail' }, { id: 'pitch.sm', level: 'pass' }]);
  ok(T.safe === 'warn' && T.comm === 'warn' && !T.safeFail.length && !T.commFail.length, 'a proposed fail: a warning on both certificates (' + T.safe + ' / ' + T.comm + ')');
  const T2 = C.genCertTiers([{ id: 'pitch.Vh', level: 'fail' }]);
  ok(T2.safe === 'warn' && T2.comm === 'fail', 'a ruled commercial fail still fails the commercial one');
  const s = JSON.parse(JSON.stringify(C172.spec)), s0 = JSON.parse(JSON.stringify(s)); delete s0.cooling;
  ok(!!s.cooling && C.certMajor(s).fp === C.certMajor(s0).fp, 'the measured block does not move the major fingerprint (R3)');
  const B = require('../src/viewer/bench.js');
  ok(B.BENCH_COSMETIC.indexOf('cooling') >= 0, "the bench's old f2 body leaves it out too");
  ok(C.GEN_CERT_TIER['cool.climb'] === 'safe' && C.GEN_CERT_TIER['cool.taxi'] === 'comm', 'the tiers: climb safe, ground commercial');
  ok(C.genCoolRows(C172.def).every(r => !r.proposed), 'both rows are ruled (the user, 12 Nov): no longer proposed');
  const BUo = card('builds/candidates/Twin_busher_floats_4b.json', j => { Object.assign(j.spec.cage, BU_OLD); return j; });
  const Tb = C.genCertTiers(C.genCoolRows(BUo.def));
  ok(Tb.safe === 'fail' && Tb.safeFail.some(r => r.id === 'cool.climb'), 'the Twin busher\'s old drawing: the hot climb now withholds the airworthiness certificate (' + Tb.safe + ')');
}

console.log('THE BIRTH (_cage_design designCoolBirth: an archetype born with the openings its engine needs)');
{
  const BJ = require('./_bake_joined.js'), { D } = BJ.loadPanel();
  const bake = k => { const a = D.ARCHETYPES.find(x => x.key === k); return D.designFull(a.sel, a.over).full; };
  const cub = bake('cub');
  ok(Math.round(cub.cw_apMode) === 2 && !+cub.cw_scoopFollow, 'cub: its front already holds it - left as its card draws it (the rule never shrinks, never adds)');
  const fp = bake('floatplane');
  ok(+fp.cw_scoopOn && +fp.cw_scoopFollow && !+fp.cw_scoopRev && fp.cw_scoopW > 0.1, 'floatplane (wing nacelles): a chin scoop into the air on each nacelle (' + fp.cw_scoopW + ' x ' + fp.cw_scoopH + ')');
  ok(fp.cw_scoopLen >= 2 * fp.cw_scoopH && fp.cw_scoopHold > 0, 'an inlet, not a disc: ' + fp.cw_scoopLen + ' m long for ' + fp.cw_scoopH + ' high, its section held over ' + fp.cw_scoopHold + ' of it');
  const tm = bake('tigermoth');
  ok(Math.round(tm.cw_apMode) >= 1 && tm.cw_apH > 2 * tm.cw_apW && !+tm.cw_scoopFollow, 'tigermoth (a narrow inline): a proper front opening, a tall slot (' + tm.cw_apW + ' x ' + tm.cw_apH + '), no scoop added');
  const sk = bake('skymaster');
  ok(+sk.cw_scoopAft && +sk.cw_scoopFollow && Math.round(sk.cw_apMode) >= 1, 'skymaster (push-pull): the nose\'s front opened, the rear engine\'s own scoop turned into the air');
  const sp = bake('spitfire');
  ok(Math.round(sp.radMode) > 0 && sp.radW > 0, 'spitfire (liquid, wing radiators): the radiators take the air (' + sp.radW + ' x ' + sp.radH + ')');
  const cv = bake('caravan');
  ok(+cv.cw_scoopOn && +cv.cw_scoopFollow, 'caravan (turbine): the oil cooler\'s scoop stands out of the skin');
}

console.log('THE PUSH-PULL (every engine on the body judged; the rear one through its own turned scoop)');
{
  const BJ = require('./_bake_joined.js'), { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === 'skymaster'), s0 = D.designBake(a.sel, a.over);
  const sp = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec, def = C.buildGen(sp), K = coolOf(def);
  const U = sp.cooling && sp.cooling.units;
  ok(Array.isArray(K.engines) && K.engines.length === 2 && K.engines[1].pushes, 'two engines judged, the rear one a pusher (' + (K.engines || []).map(e => r2(e.margin)).join(' / ') + ')');
  ok(U && U[1] && U[1].aft === 1 && U[1].turned === 1, 'the rear cowl is the nose cowl turned round, its scoop turned on its own');
  const r1 = C.genCoolOpen(def.spec, 1);
  ok(r1.parts.some(q => q.what === 'the scoop' && q.faces === 'fwd'), 'the rear engine\'s scoop faces the flight (' + r1.parts.map(q => q.what + ' ' + q.faces).join(', ') + ')');
  const row = rowOf(def, 'cool.climb');
  ok(row && row.level === 'pass', 'the row: the worst engine passes (' + (row && row.value) + ')');
}

console.log('THE SCOOP (turned round)');
{
  global.THREE = require('../vendor/three.min.js');
  const CW = require('./_cowl_gen.js');
  const cage = C172.spec.cage;
  for (const k of Object.keys(cage)) if (k.startsWith('cw_') && CW.P[k.slice(3)] !== undefined) CW.P[k.slice(3)] = cage[k];
  const shot = rev => {
    CW.P.scoopRev = rev; CW.P.scoopOn = 1; CW.prepareLid(); CW.prepareMesh();
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial();
    CW.buildScoop(g, { skin: m, inner: m, dark: m, host: m });
    const pos = g.children[0].geometry.attributes.position.array, idx = g.children[0].geometry.index.array;
    const NS = Math.max(9, Math.round(14 * Math.max(0.35, Math.min(2, CW.P.detail)))), SS = pos.length / 3 / NS;
    let out = 0, tot = 0;
    const v = k => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]];
    for (let t = 0; t < idx.length; t += 3) {
      const a = v(idx[t]), b = v(idx[t + 1]), c = v(idx[t + 2]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2]];
      const ri = Math.floor(idx[t] / SS); let rx = 0, ry = 0;
      for (let q = ri * SS; q < ri * SS + SS; q++) { rx += pos[3 * q]; ry += pos[3 * q + 1]; }
      rx /= SS; ry /= SS;
      const d = nn[0] * ((a[0] + b[0] + c[0]) / 3 - rx) + nn[1] * ((a[1] + b[1] + c[1]) / 3 - ry);
      if (Math.abs(d) < 1e-14) continue; tot++; if (d > 0) out++;
    }
    const lip = g.children[1].geometry.attributes.position.array;
    let lz = 0; for (let i = 2; i < lip.length; i += 3) lz += lip[i];
    let zs = 0; for (let i = 2; i < pos.length; i += 3) zs += pos[i];
    let ys = 0; for (let i = 1; i < pos.length; i += 3) ys += pos[i];
    return { out: out / tot, lipZ: lz / (lip.length / 3), midZ: zs / (pos.length / 3), midY: ys / (pos.length / 3), bytes: Array.from(pos).join(',') };
  };
  const a = shot(0), b = shot(1);
  ok(a.lipZ > a.midZ && b.lipZ < b.midZ, 'the mouth moves to the firewall end (' + r3(a.lipZ) + ' → ' + r3(b.lipZ) + ')');
  ok(a.out > 0.6 && b.out > 0.6, 'the skin faces out both ways (' + r2(a.out) + ' / ' + r2(b.out) + ')');
  delete CW.P.scoopRev;
  ok(shot(undefined).bytes === a.bytes, 'absent = 0: the scoop as it always was, bit for bit');
  // ON TOP (scoopTop): the same scoop above the spine, its skin still facing out, measured open like the chin one
  const spine = CW.spineY(CW.zEnd() * 0.6);
  CW.P.scoopTop = 1; const t = shot(0); const aT = CW.coolOpenings([]).scoop; CW.P.scoopTop = 0; const aC = CW.coolOpenings([]).scoop;
  ok(t.midY > spine && a.midY < spine, 'on top: above the spine (' + r3(t.midY) + ' against the chin\'s ' + r3(a.midY) + ', spine ' + r3(spine) + ')');
  ok(t.out > 0.6, 'on top: the skin faces out (' + r2(t.out) + ')');
  ok(aT > 0 && aC > 0, 'on top: its mouth is measured open (' + r3(aT) + ' m2; the chin ' + r3(aC) + ')');
  delete CW.P.scoopTop;
  ok(shot(0).bytes === a.bytes, 'scoopTop absent = 0: the chin scoop, bit for bit');
}
console.log('THE NEEDLE (the oil temperature now, display only)');
{
  const ISA = C.ATMOS_ISA, HOT = C.makeAtmos({ dISA: 23 });
  const cub = C.genCoolOilC(CUB.def.spec, { air: ISA, h: 300, pFrac: 0.75, Veas: CUB.def.params.ap.VCruise });
  const cubHot = C.genCoolOilC(CUB.def.spec, { air: HOT, h: 0, pFrac: 1, Veas: CUB.def.params.ap.VClimb });
  ok(cub && cub.oilC > 55 && cub.oilC < 100 && cubHot.oilC > cub.oilC && cubHot.oilC < C.GEN_COOL.oilRed,
     'list:1 Cub: cruise ' + Math.round(cub.oilC) + ' C, a 38 C climb ' + Math.round(cubHot.oilC) + ' C, under the red line ' + C.GEN_COOL.oilRed);
  const BU = card('builds/candidates/Twin_busher_floats_4b.json', j => { Object.assign(j.spec.cage, BU_OLD); return j; });
  const bu = C.genCoolOilC(BU.def.spec, { air: HOT, h: 0, pFrac: 1, Veas: BU.def.params.ap.VClimb });
  ok(bu && bu.oilC >= C.GEN_COOL.oilRed, 'list:6 Twin busher\'s old drawing, a 38 C climb: ' + Math.round(bu.oilC) + ' C, at or over the red line');
  const BN = card('builds/candidates/Twin_busher_floats_4b.json');
  const bn = C.genCoolOilC(BN.def.spec, { air: HOT, h: 0, pFrac: 1, Veas: BN.def.params.ap.VClimb });
  ok(bn && bn.oilC < C.GEN_COOL.oilRed, 'list:6 as saved now, the same climb: ' + Math.round(bn.oilC) + ' C, under it');
  ok(C.genCoolOilC(RUF.def.spec, { air: ISA, h: 0, pFrac: 0.75, Veas: 30 }).oilC < 100, 'list:7 Rufus (bare): a normal reading');
  const ck = require('fs').readFileSync(path.join(ROOT, 'src/viewer/cockpit.js'), 'utf8');
  ok(/genCoolOilC\(CK\.coolS/.test(ck), 'the cockpit\'s needle reads it');
}
console.log(`GATE COOL: ${fails ? 'FAIL' : 'PASS'}`);
process.exit(fails ? 1 : 0);
