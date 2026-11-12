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
//   THE PUSHER    list:6 Twin busher floats 4b as saved: no opening faces the air, the row fails and says so; the
//                 remedy's own steps (turn the scoop, size it, give the air a way out) each raise the margin, and the
//                 last one passes
//   DRAG          the momentum figure within 0.006 m2 of the per-kW figure on the three light cowls; never less than
//                 the needed air's (a starved engine does not fly faster); a high-power liquid engine is no longer
//                 charged five times over (the per-kW law against the momentum one on the Merlin's numbers)
//   CERTIFICATE   the rows land PROPOSED: a fail withdraws neither certificate (genCertTiers); spec.cooling never
//                 moves the major fingerprint (certStrip) nor the bench's old f2 body (R3)
//   THE SCOOP     turned round, its mouth at the firewall end and its skin still facing out; absent = as it was
//
//   node tools/_cool_check.js   (~2 min: six cards through the load door)
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
  ok(r3(p.inA) === 0.02 && r3(p.outA) === 0.094, 'a pusher: only the nacelle cone faces the air (0.02 in, 0.094 out: ' + r3(p.inA) + ' / ' + r3(p.outA) + ')');
  const pr = O(Object.assign({}, base, { engAt: [{ mount: 'pusher', pushes: true }], cooling: Object.assign({}, base.cooling, { scoopRev: 1 }) }));
  ok(r3(pr.inA) === 0.03, 'a pusher with its scoop turned round: the scoop faces the flight (' + r3(pr.inA) + ')');
  const tr = O(Object.assign({}, base, { cooling: Object.assign({}, base.cooling, { scoopRev: 1 }) }));
  ok(r3(tr.inA) === 0.05, 'a tractor with its scoop turned round: it faces aft (' + r3(tr.inA) + ')');
  ok(O(Object.assign({}, base, { cage: { cowlOn: 0 } })).kind === 'bare', 'no cowl: bare');
  ok(O(Object.assign({}, base, { cooling: undefined })).kind === 'legacy', 'no measurement: legacy');
  ok(O(Object.assign({}, base, { cooling: { face: 0.05 } })).exitSized === true, 'no outlet drawn: the outlet is sized for you');
}

console.log('CALIBRATION (the reference-fitted cowls, the hot-day climb)');
const CUB = card('builds/cub_2026-09-20_corrected.json');
const C172 = card('builds/cessna172r_2026-11-08.json');
const JOD = card('builds/jodel_2026-09-20_corrected.json');
const TM = card('builds/candidates/tigermoth_2026-10.json');
const PET = card('builds/candidates/superpetrel_V4_1.json');
const RUF = card('builds/rufus_2026-10-18_certified.json');
for (const [n, X, lo, hi] of [['list:1 Cub', CUB, 1.2, 2.5], ['list:50 V2-172', C172, 1.2, 2.5], ['list:2 Jodel', JOD, 1.2, 8]]) {
  const K = coolOf(X.def), row = rowOf(X.def, 'cool.climb');
  ok(K.kind === 'measured' && K.hot.margin >= lo && K.hot.margin <= hi && row && row.level === 'pass',
     n + ': ' + r2(K.hot.margin) + ' x the air at 38 C (band ' + lo + '-' + hi + '), in ' + r3(K.inA) + ' m2 (needs ' + r3(K.hot.inNeed) + '), the row ' + (row && row.level));
}
{
  const K = coolOf(TM.def);
  ok(K.bareA > 0.05 && K.hot.margin > 1.15, 'list:10 Tiger Moth-alike passes on its heads in the wind (' + r3(K.bareA) + ' m2 bare, ' + r2(K.hot.margin) + ' x)');
  const P = coolOf(PET.def);
  ok(P.kind === 'measured' && P.pushes && P.inA > 0.03 && P.parts.some(q => q.what === 'the nacelle\'s inlet' && q.faces === 'fwd'),
     'list:41 Super Petrel: its nacelle inlet faces the air and is counted (' + r3(P.inA) + ' m2, ' + r2(P.hot.margin) + ' x)');
  const R = C.genCoolRows(RUF.def);
  ok(R.length === 1 && R[0].level === 'pass' && coolOf(RUF.def).kind === 'bare', 'list:7 Rufus (no cowl): bare, passes');
}

console.log('THE PUSHER (list:6 Twin busher floats 4b, the remedy\'s own steps)');
{
  const F = 'builds/candidates/Twin_busher_floats_4b.json';
  const steps = [['as saved', {}], ['the scoop turned', { cw_scoopRev: 1 }],
                 ['+ sized', { cw_scoopRev: 1, cw_scoopW: 0.21, cw_scoopH: 0.16, cw_scoopAp: 0.9 }],
                 ['+ an exit', { cw_scoopRev: 1, cw_scoopW: 0.21, cw_scoopH: 0.16, cw_scoopAp: 0.9, cw_exitGap: 0.25 }]];
  let prev = -1, last = null, first = null;
  for (const [n, over] of steps) {
    const X = card(F, j => { Object.assign(j.spec.cage, over); return j; });
    const row = rowOf(X.def, 'cool.climb'), m = row ? row.value : null;
    if (!first) first = row;
    console.log('         ' + n.padEnd(18) + ' ' + r2(m) + ' x  ' + (row && row.fix ? '→ ' + row.fix : ''));
    ok(m != null && m >= prev, n + ': the margin does not fall (' + r2(m) + ')');
    prev = m; last = row;
  }
  ok(first && first.level === 'fail' && first.value === 0 && /face the propeller, which on a pusher is backwards/.test(first.why) && /turn the scoop round/.test(first.fix),
     'as saved: it fails, and says why and what to draw');
  ok(last && last.level === 'pass', 'the remedy followed: the hot climb passes (' + (last && last.value) + ')');
}

console.log('DRAG (the momentum figure)');
{
  for (const [n, X] of [['Cub', CUB], ['V2-172', C172], ['Jodel', JOD]]) {
    const g = X.def.params.gen.drag, eng = X.def.params.engine, kW = C.GEN_DRAG.kCool.pressureCowl * C.genEngineThermo(eng).coolKW;
    ok(g.coolBy === 'momentum' && Math.abs(g.cool - kW) < 0.006, n + ': ' + r3(g.cool) + ' m2 by momentum against ' + r3(kW) + ' per kW');
  }
  const BU = card('builds/candidates/Twin_busher_floats_4b.json');
  const K = coolOf(BU.def);
  ok(K.cdA > 0.01 && Math.abs(K.Aeff - K.hot.inNeed) < 1e-9, 'a starved engine pays the drag of the air it needs (' + r3(K.cdA) + ' m2), not none');
  // the per-kW law on a 1283 kW liquid engine (a Merlin's 539 kW of heat) climbing at 72 m/s against the momentum one:
  // the air it needs is Q / cp dT; the drag of that air through a duct is 2 m (1 - r) / rho V
  const K0 = C.GEN_COOL, Q = 0.42 * 1283e3, rho = 1.225, dT = K0.path.liquid.eps * (K0.path.liquid.Tlim - 15);
  const m = Q / (K0.cp * dT), cdMom = 2 * m * (1 - K0.r.duct) / (rho * 72), cdKW = C.GEN_DRAG.kCool.liquid * Q / 1000;
  ok(cdKW / cdMom > 3, 'a Merlin-class engine: per kW ' + r3(cdKW) + ' m2 against ' + r3(cdMom) + ' by momentum (the law it replaces, x' + r2(cdKW / cdMom) + ')');
}

console.log('CERTIFICATE (proposed rows, the fingerprint)');
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
  ok(C.genCoolRows(C172.def).every(r => r.proposed), 'both rows land proposed');
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
    return { out: out / tot, lipZ: lz / (lip.length / 3), midZ: zs / (pos.length / 3), bytes: Array.from(pos).join(',') };
  };
  const a = shot(0), b = shot(1);
  ok(a.lipZ > a.midZ && b.lipZ < b.midZ, 'the mouth moves to the firewall end (' + r3(a.lipZ) + ' → ' + r3(b.lipZ) + ')');
  ok(a.out > 0.6 && b.out > 0.6, 'the skin faces out both ways (' + r2(a.out) + ' / ' + r2(b.out) + ')');
  delete CW.P.scoopRev;
  ok(shot(undefined).bytes === a.bytes, 'absent = 0: the scoop as it always was, bit for bit');
}
console.log(`GATE COOL: ${fails ? 'FAIL' : 'PASS'}`);
process.exit(fails ? 1 : 0);
