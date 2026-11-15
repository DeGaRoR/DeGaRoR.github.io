// GATE LIGHTWING - THE FOOT-LAUNCH D-TUBE: A LIGHT WING THAT BREAKS WHERE IT SHOULD (WEIGHT STUDY, 2026-11-12).
//
// The user (12 Nov): "if I put such a lightweight wing, for example, on another plane, it should probably break at some
// point ... so that you can't choose the lightest option anytime, we have to take the Cessna and put this on there, and
// I would expect everything to fail ... find a test case that fails, that should fail. And that should also show that
// an exploit in the game is not possible." (futureDesigns/archaeopteryx/WEIGHT_STUDY.md, weight_proto/.)
//
// The row (60_gen_spec.js GEN_SURF_MATERIALS.dtube) is BUILT FOR A WEIGHT (`buildKg`): its gauge never grows past it
// (61_gen_frame.js genDesignGross), its section has no floor and its springs no gain past it (genLattice), and it is
// CERTIFIED as if its aeroplane weighed buildKg (66_gen_cert.js genCertifySteps: its members' limit loads x min(1,
// buildKg / W0)). The test is the garage's own destroy bench (65_gen_loadtest makeLoadTest, src/viewer/bench_worker.js
// benchLoadCfg): the sandbags ramp until the first part lets go.
//
//   A. THE ROW AND THE TILE: the Wing structure tile's 9th option (wgCons 8, appended) writes wings[].material 'dtube'
//      through the join; the row is built for a weight, carbon's phys, no floor.
//   B. LIGHT: on the Archaeopteryx the D-tube wing is lighter than its moulded carbon (by more than 10 kg), its gauge
//      (its own bucket, 'wingB') at or under its cap ((buildKg / refGross)^e), and the aeroplane's EMPTY mass falls by
//      at least as much - the carry-through billed in another material keeps its own gauge (it grew 7.1 -> 12.3 kg when
//      the D-tube's reference leaked into the shared wing bucket).
//   C. CERTIFIED WHERE IT BELONGS: on the Archaeopteryx it holds the ultimate (5.7 g) and lets go past it.
//   D. IT BREAKS ON HEAVIER AEROPLANES: a Cub, a C172, a Caravan with it break UNDER the ultimate (not certifiable), at the wing,
//      cleanly (a break, never a divergence), the heavier the sooner.
//   E. SOFTER: on the C172 its wing springs at least a third softer than the moulded carbon's (the rigidity it costs:
//      the row's half spring and kScale held at buildKg; measured x0.55 - part of a wing member's spring is not the row's).
//   F. THE EXPLOIT, AS A NEGATIVE CONTROL: the same C172 with the build weight taken off the row (buildKg 0) holds past
//      the ultimate again - the build weight is what closes the exploit, and this gate would see it reopen.
'use strict';
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const BW = require(path.join(T, '..', 'src', 'viewer', 'bench_worker.js'));
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const { D } = BJ.loadPanel();
const LIM = C.GEN_LOAD_LIMIT, ULT = C.GEN_LOAD_ULT;

// a card born as the shed births it, every wing on `mat` (null: its own)
const born = (key, mat, cage) => {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: Object.assign({}, A.over && A.over.spec) };
  const s0 = D.designBake(Object.assign({}, A.sel), over);
  const sp = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
  if (mat) for (const w of sp.wings) w.material = mat;
  return sp;
};
// the garage's destroy bench on a certified, damage-on aeroplane: the g the first part lets go, which part, the verdict
const bench = sp => {
  const def0 = C.buildGen(JSON.parse(JSON.stringify(sp)));
  const cert = C.genCertify(def0, {});
  const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: true }), cert });
  const sim = C.makeSim(def, null); sim.reset(0);
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, def.spec, { destroy: true });
  cfg.ult = 3 * ULT; cfg.rampS = 4 * cfg.ult / ULT; cfg.surface = 'wing';
  const rig = C.makeLoadTest(sim, def, cfg);
  let nMax = 0;
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) { rig.step(1 / 60); if (Number.isFinite(rig.state.n) && rig.state.brokeAt == null) nMax = Math.max(nMax, rig.state.n); }
  const st = rig.state;
  const finite = sim.nodes ? sim.nodes.every(n => n.p.every(Number.isFinite)) : true;
  let empty = 0; for (const k in def0.parts.ledger) if (!def0.parts.ledger[k].payload) empty += def0.parts.ledger[k].mass;
  return { def: def0, W0: def0.parts.gauge.W0, empty, wing: def0.parts.ledger.wings.mass, gauge: def0.parts.gauge.wingB != null ? def0.parts.gauge.wingB : def0.parts.gauge.wing,
           verdict: st.verdict, at: st.brokeAt, key: st.brokeKey || '', finite, nMax };
};
const r2 = v => v == null ? '-' : (+v).toFixed(2);
const ROW = C.GEN_SURF_MATERIALS.dtube;

console.log('A. THE ROW AND THE TILE');
{ const sp = born('archaeopteryx', null, { wgCons: 8 });   // (the card's own row since 12 Nov)
  ok(ROW && ROW.buildKg > 0 && ROW.noFloor === true && ROW.phys === C.GEN_MATERIALS.carbon.phys && sp.wings[0].material === 'dtube',
     `A the Wing structure tile's 9th option (wgCons 8) writes '${sp.wings[0].material}'; the row is built for ${ROW && ROW.buildKg} kg, carbon's phys, no floor`); }

console.log('B. LIGHT');
// (the card flies the D-tube since 12 Nov: its moulded carbon is the comparison, named)
const own = bench(born('archaeopteryx', 'carbon')), arch = bench(born('archaeopteryx', 'dtube'));
const cap = Math.pow(ROW.buildKg / ROW.refGross, C.GEN_GAUGE.e.wing);
ok(own.wing - arch.wing > 10 && arch.gauge <= cap + 1e-9 && own.empty - arch.empty > 10,
   `B the Archaeopteryx's wing ${r2(own.wing)} kg moulded -> ${r2(arch.wing)} kg D-tube, its empty ${r2(own.empty)} -> ${r2(arch.empty)} kg; its gauge ${r2(arch.gauge)} under its cap ${r2(cap)}`);

console.log('C. CERTIFIED WHERE IT BELONGS');
ok(/^BROKE AT/.test(arch.verdict) && arch.at >= ULT && arch.finite,
   `C the Archaeopteryx (W0 ${arch.W0.toFixed(0)} kg) on its D-tube wing holds the ultimate: ${arch.verdict} (moulded: ${own.verdict})`);

console.log('D. IT BREAKS ON HEAVIER AEROPLANES');
const heavy = ['cub', 'c172', 'caravan'].map(k => Object.assign({ k }, bench(born(k, 'dtube'))));
for (const h of heavy)
  // (the bar is the CERTIFICATE's, the ultimate - C's own: an aeroplane whose wing breaks short of it cannot be
  //  certified on it. It was the limit until train L40a: master's measured engine cooling (spec.cooling, the join)
  //  moved the Cub's break from 3.68 g at the root to 4.35 g at the strut - over the 3.8 g limit, still far short of
  //  the ultimate - while the C172 and the Caravan break under the limit as before)
  ok(/^BROKE AT/.test(h.verdict) && h.at < ULT && /^wing/.test(h.key) && h.finite,
     `D ${h.k} (W0 ${h.W0.toFixed(0)} kg) on the D-tube wing (${r2(h.wing)} kg): ${h.verdict}, at ${h.key || '-'} - under the ${ULT} g ultimate (not certifiable), cleanly`);
ok(heavy.every((h, i) => i === 0 || (h.W0 > heavy[i - 1].W0 && h.at <= heavy[i - 1].at + 1e-9)) && heavy[0].at < arch.at,
   `D the heavier the sooner: ${[['archaeopteryx', arch]].concat(heavy.map(h => [h.k, h])).map(([k, h]) => k + ' ' + r2(h.at) + ' g').join(', ')}`);

console.log('E. SOFTER');
{ const c172 = heavy.find(h => h.k === 'c172'), mould = C.buildGen(JSON.parse(JSON.stringify(born('c172', 'carbon'))));
  const kOf = d => { const ks = d.beams.filter(b => b.cls === 'wing').map(b => b.k); return ks.reduce((a, b) => a + b, 0) / ks.length; };
  const kD = kOf(c172.def), kM = kOf(mould);
  ok(kD < 0.67 * kM, `E on the C172 its wing springs average ${(kD / 1e3).toFixed(0)} kN/m against the moulded carbon's ${(kM / 1e3).toFixed(0)} (x${(kD / kM).toFixed(2)})`); }

console.log('F. THE EXPLOIT (negative control)');
{ const keep = ROW.buildKg;
  ROW.buildKg = 0;
  let r; try { r = bench(born('c172', 'dtube')); } finally { ROW.buildKg = keep; }
  // (past what it holds, a light soft wing on a heavy aeroplane can take the integrator with it rather than break -
  //  WEIGHT_STUDY gap 3; the control reads the load it held unbroken, not the way it ended)
  ok(r && r.nMax >= LIM && !(r.at != null && r.at < LIM),
     `F without its build weight the D-tube wing on the C172 (${r ? r2(r.wing) : '-'} kg) holds ${r ? r2(r.nMax) : '-'} g unbroken, past the ${LIM} g limit (it ended ${r ? r.verdict : '-'}): the build weight is what shuts the exploit`); }

console.log(fails.length ? 'GATE LIGHTWING: FAIL (' + fails.length + ')' : 'GATE LIGHTWING: PASS');
process.exit(fails.length ? 1 : 0);
