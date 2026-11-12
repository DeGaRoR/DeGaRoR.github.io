// GATE RODROW - THE ROD ROW: THE ROD'S MATERIAL AND WALL (WEIGHT STUDY L2b, 2026-11-12).
//
// The user (12 Nov): "an ultralight rod that would also break somehow, that would have different stiffness ... the boom
// itself has to be an ultralight rod whose stiffness would be impacted" - independent of the wing. A0 (the performance
// coordinator): the rod row is material + wall per build, LATENT (absent: the fuselage's material at GEN_RULES.rodWall,
// 1.2 mm), its stiffness and strength following the section; AERO-BODY (claude/aero-body-1) merges it with the tube's own
// billing (pi d t rho), the buckling caps and the rod's height. No hidden build weight: the rod breaks at the solver's
// tube cut (30_solver.js, fu x the section modulus), which the certificate never stamps - a thin rod on a heavier
// aeroplane parts at its root from the physics alone.
//
// THE BENCH: the garage's destroy ramp on the stab (65_gen_loadtest makeLoadTest), THROUGH THE BOOM (cfg.throughBoom:
// only the cabin forward of the box's rear on the trestles - the default pins everything but the surface, so the rod
// would carry nothing). Its load is the stab at the WING's loading, harsher than a real tail limit load: a standard 4130
// rod on the 669 kg pusher pod cracks at 2.3 g on it. So the light rod is judged against the standard on the same card
// and bench, and a realistic tail limit load is owed (AERO-BODY's twin-floatplane "must hold" end needs it).
//
//   A. LATENT: no rod card's spec carries the keys; the row at its default (as the fuselage, 1.2 mm) builds the same
//      aeroplane, bit for bit; off a rod the spec drops them.
//   B. THE ROW WRITES: carbon at 0.8 mm -> fuselage.rodMat 'carbon', rodWall 0.0008.
//   C. THE SECTION GOVERNS: the tube element's EI and GJ follow E x t, its own members' mass rho x t.
//   D. THE ARCHAEOPTERYX HOLDS on a thin carbon rod (0.8 mm): through the boom, no rod crack before the stab's own
//      attachment goes (the stab, not the rod, is its weak link), and lighter than its 1.2 mm.
//   E. A LIGHT ROD ON A HEAVIER AEROPLANE PARTS: the pusher pod (669 kg) on a 0.5 mm 4130 rod cracks at its root at
//      well under half the g of its standard 1.2 mm, and under 1 g.
//   F. THE MINIMUM WALL (0.3 mm) on the heaviest rod card: a clean break (never a divergence), its substeps named.
'use strict';
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const BW = require(path.join(T, '..', 'src', 'viewer', 'bench_worker.js'));
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const { D } = BJ.loadPanel();
const r2 = v => v == null ? '-' : (+v).toFixed(2);
const born = (key, cage) => {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: Object.assign({}, A.over && A.over.spec) };
  const s0 = D.designBake(Object.assign({}, A.sel), over);
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const build = sp => C.buildGen(JSON.parse(JSON.stringify(sp)));
const rodOf = d => (d.clusters || []).find(c => c.cls === 'rod');
const empty = d => { let m = 0; for (const k in d.parts.ledger) if (!d.parts.ledger[k].payload) m += d.parts.ledger[k].mass; return m; };
// the stab's destroy ramp carried through the rod: the g of the first break and what it was
const bench = sp => {
  const def0 = build(sp), cert = C.genCertify(def0, {});
  const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: true }), cert });
  const sim = C.makeSim(def, null); sim.reset(0);
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, def.spec, { destroy: true });
  cfg.ult = 3 * C.GEN_LOAD_ULT; cfg.rampS = 4 * cfg.ult / C.GEN_LOAD_ULT; cfg.surface = 'stab'; cfg.throughBoom = true;
  const rig = C.makeLoadTest(sim, def, cfg);
  let nFirst = null, fb = null;
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) { rig.step(1 / 60); if (nFirst == null) { const d = sim.damage(); if (d.firstBreak) { nFirst = rig.state.n; fb = d.firstBreak; } } }
  const rodBreak = fb && fb.cls === 'fus' && /root/.test(fb.how || '');
  return { def: def0, verdict: rig.state.verdict, nFirst, what: fb ? fb.cls + '/' + fb.how : '-', rodBreak, diverged: rig.state.verdict === 'SIM DIVERGED' };
};
const ROD_CARDS = ['chinook', 'ul1', 'floatplane', 'pusherPod', 'mw5', 'archaeopteryx'];

console.log('A. LATENT');
{ let clean = true, same = true;
  for (const k of ROD_CARDS) {
    const sp = born(k), sp0 = born(k, { rodMat: 0, rodWallMm: 1.2 });
    if ('rodMat' in sp.fuselage || 'rodWall' in sp.fuselage) clean = false;
    if (JSON.stringify(build(sp).beams) !== JSON.stringify(build(sp0).beams)) same = false;
  }
  const off = born('cub', { rodMat: 1, rodWallMm: 0.5 });
  ok(clean && same && !('rodMat' in off.fuselage) && !('rodWall' in off.fuselage),
     `A the ${ROD_CARDS.length} rod cards carry no rod keys and build the same at the row's default; a lofted boom (the Cub) drops them`); }

console.log('B. THE ROW WRITES');
const spC = born('archaeopteryx', { rodMat: 1, rodWallMm: 0.8 });
ok(spC.fuselage.rodMat === 'carbon' && Math.abs(spC.fuselage.rodWall - 0.0008) < 1e-12,
   `B carbon at 0.8 mm -> fuselage.rodMat '${spC.fuselage.rodMat}', rodWall ${spC.fuselage.rodWall}`);

console.log('C. THE SECTION GOVERNS');
{ const d12 = build(born('pusherPod')), d05 = build(born('pusherPod', { rodWallMm: 0.5 })), dC = build(born('pusherPod', { rodMat: 1, rodWallMm: 1.2 }));
  const a = rodOf(d12).dmg, b = rodOf(d05).dmg, c = rodOf(dC).dmg;
  const E = k => C.GEN_MATERIALS[k].phys.E;
  ok(Math.abs(b.EI / a.EI - 0.5 / 1.2) < 1e-6 && Math.abs(b.GJ / a.GJ - 0.5 / 1.2) < 1e-6 && Math.abs(c.EI / a.EI - E('carbon') / E('tubeFabric')) < 1e-6 && empty(d05) < empty(d12) && empty(dC) < empty(d12),
     `C the pusher pod's rod: EI x${r2(b.EI / a.EI)} at 0.5 mm (t), x${r2(c.EI / a.EI)} in carbon (E); empty ${r2(empty(d12))} -> ${r2(empty(d05))} kg (0.5 mm), ${r2(empty(dC))} kg (carbon)`); }

console.log('D. THE ARCHAEOPTERYX HOLDS');
const archS = bench(born('archaeopteryx')), archC = bench(spC);
ok(!archC.rodBreak && !archC.diverged && archC.nFirst != null && archC.nFirst >= C.GEN_LOAD_ULT && empty(archC.def) < empty(archS.def),
   `D the Archaeopteryx on carbon 0.8 mm: first break ${archC.what} at ${r2(archC.nFirst)} g (1.2 mm: ${archS.what} at ${r2(archS.nFirst)} g) - not the rod; empty ${r2(empty(archS.def))} -> ${r2(empty(archC.def))} kg`);

console.log('E. A LIGHT ROD ON A HEAVIER AEROPLANE PARTS');
const ppS = bench(born('pusherPod')), ppL = bench(born('pusherPod', { rodWallMm: 0.5 }));
ok(ppL.rodBreak && !ppL.diverged && ppS.nFirst != null && ppL.nFirst < 0.5 * ppS.nFirst && ppL.nFirst < 1,
   `E the pusher pod (W0 ${r2(ppL.def.parts.gauge.W0)} kg) on a 0.5 mm rod cracks at its root at ${r2(ppL.nFirst)} g (${ppL.what}) against the standard's ${r2(ppS.nFirst)} g (${ppS.what})`);

console.log('F. THE MINIMUM WALL');
{ const sp = born('pusherPod', { rodWallMm: 0.3 }), r = bench(sp), p = r.def.params;
  ok(!r.diverged && r.nFirst != null,
     `F at the row's least (0.3 mm) the pusher pod breaks cleanly: ${r.what} at ${r2(r.nFirst)} g, ${r.verdict}; the build's substeps ${p.substeps}${p.substepsTrue ? ' (true ' + p.substepsTrue + ')' : ''} (1.2 mm: ${ppS.def.params.substeps}${ppS.def.params.substepsTrue ? ' (true ' + ppS.def.params.substepsTrue + ')' : ''})`); }

console.log(fails.length ? 'GATE RODROW: FAIL (' + fails.length + ')' : 'GATE RODROW: PASS');
process.exit(fails.length ? 1 : 0);
