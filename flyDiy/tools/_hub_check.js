#!/usr/bin/env node
// GATE HUB (the Archaeopteryx study's stage 2, futureDesigns/archaeopteryx/CONFIG_STUDY.md) - THE HUB'S REAR SOCKET: the
// rod slots into the wing's centre section.
//
// The user (11 Nov 2026): "the centre section is the heart of the plane ... a rear socket for the rod to slot in".
//
//   node tools/_hub_check.js            -> "GATE HUB: PASS|FAIL"
//
// A. THE SPEC: fuselage.rodHub reaches the spec from the cage's row on a rod (the join's), and only there - gone on a
//    loft or twin booms, gone when off; a build without it carries no key.
// B. THE FRAME: the rod's rigid cluster holds the wing's root bay (both spars, both sides, their box caps), the rod's root
//    ring is tied to every one of them, nothing degenerate; the socket weighs ~1.2 kg (the ties are weightless); without
//    the row the cluster and the masses are the bytes they were.
// C. THE LOAD PATH: a download at the tail post, the airframe held at the wing's root bay alone - with the socket the
//    tail stands on the wing (its sag a fraction of the rod hung through the pod).
// D. THE DRAWING: where the rod runs into the centre section, one blended surface growing it into the wing (rodHubSocket);
//    no socket without the row.
'use strict';
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const SH = require(path.join(T, '_scene_headless.js'));
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const { D } = BJ.loadPanel();
const A = D.ARCHETYPES.find(x => x.key === 'archaeopteryx');
const born = cage => {
  const s0 = D.designBake(Object.assign({}, A.sel), { cage: Object.assign({}, A.over.cage, cage), spec: Object.assign({}, A.over.spec) });
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const s0 = born({}), s1 = born({ rodHub: 1 });
const d0 = C.buildGen(JSON.parse(JSON.stringify(s0))), d1 = C.buildGen(JSON.parse(JSON.stringify(s1)));
const rod = d => (d.parts.clusters || d.clusters || []).find(c => c.tag === 'ROD');

console.log('A. THE SPEC');
ok(s1.fuselage.rodHub === true && !('rodHub' in s0.fuselage) && d1.spec.fuse.rodHub === true && !('rodHub' in d0.spec.fuse),
   `A the row writes fuselage.rodHub on a rod (${s1.fuselage.rodHub}); none without it`);
{ const cs = f => { const x = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); Object.assign(x.fuselage, f); return C.clampSpec(x).fuselage; };
  ok(!('rodHub' in cs({ boom: 'loft', rodHub: true })) && !('rodHub' in cs({ boom: 'twin', rodHub: true })) && !('rodHub' in cs({ boom: 'rod', rodHub: false })),
     'A gone on a loft, on twin booms, and when off'); }

console.log('B. THE FRAME');
{ const R1 = rod(d1), R0 = rod(d0), wf = d1.parts.wf;
  const hub = [];
  for (const sd of ['L', 'R']) for (const j of [0, 1]) for (const k of ['F', 'R', 'FB', 'RB']) if (wf[sd][k] && wf[sd][k][j] != null && !hub.includes(wf[sd][k][j])) hub.push(wf[sd][k][j]);
  const tied = R1 ? R1.rings[0].every(q => hub.every(m => d1.beams.some(b => (b.a === q && b.b === m) || (b.a === m && b.b === q)))) : false;
  ok(R1 && hub.every(m => R1.nodes.includes(m)) && tied && !(d1.parts.degenerate || []).length,
     `B the rod's cluster holds the root bay's ${hub.length} spar and cap nodes, its root ring tied to each, nothing degenerate`);
  const m0 = d0.nodes.reduce((a, n) => a + n.m, 0), m1 = d1.nodes.reduce((a, n) => a + n.m, 0);
  ok(Math.abs(m1 - m0 - 1.2) < 0.25, `B the socket weighs ${(m1 - m0).toFixed(2)} kg (~1.2: the ties weightless)`);
  ok(R0 && !R0.hub && R0.nodes.length === R1.nodes.length - hub.length, `B without the row the rod's cluster is its own (${R0 ? R0.nodes.length : '-'} nodes)`); }

console.log('C. THE LOAD PATH');
{ // 300 N down at the tail post, the wing's root bay nodes pinned (every other node free): the tail's static drop
  const sag = d => {
    const sim = C.makeSim(d, null); sim.reset(0);
    const wf = d.parts.wf, pin = new Set();
    for (const sd of ['L', 'R']) for (const j of [0, 1]) for (const k of ['F', 'R', 'FB', 'RB']) if (wf[sd][k] && wf[sd][k][j] != null) pin.add(wf[sd][k][j]);
    const p0 = Array.from(sim.p), tp = d.parts.TPB, y0 = sim.p[tp * 3 + 1];
    // (the load rig's own way, 65_gen_loadtest: the load an impulse a substep, the trestle clamped after every substep)
    const dt = 1 / 3000;
    for (let s = 0; s < 3000 * 3; s++) {
      sim.impulse(tp, 0, -300 * dt, 0);
      sim.step(dt, 1);
      for (const i of pin) { for (let c = 0; c < 3; c++) { sim.p[i * 3 + c] = p0[i * 3 + c]; sim.v[i * 3 + c] = 0; } }
    }
    return y0 - sim.p[tp * 3 + 1];
  };
  const a = sag(d0), b = sag(d1);
  ok(isFinite(a) && isFinite(b) && b < a, `C the tail post held off the wing alone drops ${(1000 * b).toFixed(0)} mm with the socket (${(1000 * a).toFixed(0)} mm through the pod)`); }

console.log('D. THE DRAWING');
{ const has = sp => { const S = SH.sceneBuild(sp, { over: {}, garage: sp }); let f = false; S.scene.traverse(o => { if (o.name === 'rodHubSocket') f = true; }); return f; };
  const S1 = born({ rodHub: 1 });
  ok(has(S1) && !has(s0), 'D the rod carried through the wing (rodHubSocket) under its hump with the row, none without'); }

console.log(fails.length ? 'GATE HUB: FAIL (' + fails.length + ')' : 'GATE HUB: PASS');
process.exit(fails.length ? 1 : 0);
