// GATE ULTRALIGHT - THE SOFT SHELL, THE HUB AND THE ULTRALIGHT MONOWHEEL (WEIGHT STUDY L4-L6, 2026-11-12).
//
// The user (12 Nov): "a cabin ... tent-like material ... very, very low stiffness ... load any wing on top of it ... it
// should crumble ... the breaking at rest ... let physics teach and have this thing crumble. That would be fun"; "the
// soft material, yeah, we put it everywhere"; then "Let's keep going with the soft shell, and then you can go L5, L6 in
// one go ... the gear ... give it the weight you want, provided it remains something unique as a gear type ... it's
// really like a bicycle wheel ... And the wing attachment ... just giving it some number" (futureDesigns/archaeopteryx/
// WEIGHT_STUDY.md section 4, THE PATH).
//
//   L4 THE SOFT SHELL (60_gen_spec GEN_MATERIALS.softShell, the Construction tile's 7th option, intCons 6): poles under
//      ripstop, BUILT FOR A WEIGHT (buildKg: gauge capped, no knee, certified at buildKg / W0), a pole buckling wherever
//      it stands (30_solver dmgMember); on a hanging nacelle the keel tubes and the wing's box on the hub are its `hard`
//      row (carbon), the mast and the motor's mount steel as on every aeroplane.
//   L5 THE HUB (GEN_HANG.hubKg, boxK; 61_gen_frame HUBPIN): on a hanging nacelle the carry-through is the hub fitting on
//      the wing's root, and the 'bracing' box the wing's own, at boxK of its mass and springs.
//   L6 THE ULTRALIGHT MONOWHEEL (GEN_RULES.ulGear, the gear page's s1Ul -> gear.ul, a monowheel only): the bicycle
//      wheel in a sprung fork, its members at linK, its nose skid its own, built for ~250 kg.
//
//   A. THE ROWS: intCons 6 writes fuselage.material 'softShell' through the join; s1Ul writes gear.ul on a monowheel and
//      nothing off one; both rows latent (absent on every other card).
//   B. LIGHT: the Archaeopteryx's pod (fuselage) on the soft shell under a fifth of its moulded carbon; its carry-through
//      ('bracing') on the hub under half of the box billed whole; its gear on the ultralight monowheel under 60 % of
//      the standard; the card's empty mass under 95 kg.
//   C. IT STANDS AND HOLDS: parked 10 s with the damage layer and its certificate, nothing yields or breaks; on the wing's
//      destroy bench it holds the ultimate; dropped at the class's limit sink (0.22 m, ~2.1 m/s) nothing breaks.
//   D. THE MAST IS WHAT CARRIES IT: the same pod without the mast (hangOn 0: the wing on the poles) yields at rest and
//      its wing sinks more than on the mast.
//   E. HEAVIER AEROPLANES COME DOWN AT REST: a Cub and a C172 on the soft shell break members within 2 s parked,
//      cleanly (finite); on their own constructions they stand (nothing broken).
//   F. THE ULTRALIGHT WHEEL ON A HEAVIER AEROPLANE FOLDS: a Cub on one centreline main dropped at the limit sink loses
//      its gear's members on the ultralight monowheel, and keeps them on the standard one.
'use strict';
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const L = require(path.join(T, '_treecrash_lib.js'));
const BW = require(path.join(T, '..', 'src', 'viewer', 'bench_worker.js'));
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const { D } = BJ.loadPanel();
const r1 = v => v == null ? '-' : (+v).toFixed(1), r2 = v => v == null ? '-' : (+v).toFixed(2);

const born = (key, cage) => {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: Object.assign({}, A.over && A.over.spec) };
  const s0 = D.designBake(Object.assign({}, A.sel), over);
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const ledger = d => { const out = { empty: 0 }; for (const k in d.parts.ledger) { const e = d.parts.ledger[k]; out[k] = e.mass; if (!e.payload) out.empty += e.mass; } return out; };
const certified = sp => {
  const def0 = C.buildGen(JSON.parse(JSON.stringify(sp)));
  const cert = C.genCertify(def0, {});
  return { def0, def: Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: true }), cert }) };
};
// parked (spawnElev 0) or dropped from h: 0.5 s to settle, then the rest; the wing's sink after the settle
const ground = (def, h, secs) => {
  const F = L.flatWorld(0), s = C.makeSim(def, F.W); s.reset(0);
  C.placeAtAerodrome(s, Object.assign({}, F.strip, { elev: 0, spawnElev: h || 0 }));
  const wn = [...new Set(def.beams.filter(b => b.sec === 'wings').flatMap(b => [b.a, b.b]))];
  const wy = () => wn.reduce((a, i) => a + s.p[3 * i + 1], 0) / wn.length;
  let finite = true, t1 = null, y0 = null;
  for (let f = 0; f < 60 * secs; f++) {
    s.step(1 / 60);
    if (f === 29) y0 = wy();
    if (t1 == null && s.damage().breaks > 0) t1 = f / 60;
    if (!s.p.every(Number.isFinite)) { finite = false; break; }
  }
  const X = s.damage(), br = {};
  for (const q of X.broken || []) { const b = def.beams[typeof q === 'number' ? q : (q.bi != null ? q.bi : q.i)]; if (b) br[b.cls] = (br[b.cls] || 0) + 1; }
  return { yields: X.yields, breaks: X.breaks, t1, finite, sagCm: y0 == null ? null : 100 * (y0 - wy()), br };
};
const bench = def => {
  const sim = C.makeSim(def, null); sim.reset(0);
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, def.spec, { destroy: true });
  cfg.ult = 3 * C.GEN_LOAD_ULT; cfg.rampS = 4 * cfg.ult / C.GEN_LOAD_ULT; cfg.surface = 'wing';
  const rig = C.makeLoadTest(sim, def, cfg);
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) rig.step(1 / 60);
  return rig.state;
};
const ROW = C.GEN_MATERIALS.softShell, UG = C.GEN_RULES.ulGear, HANG = C.GEN_HANG;

console.log('A. THE ROWS');
const arch = born('archaeopteryx');
{ const c0 = born('archaeopteryx', { intCons: 0 }), m0 = born('archaeopteryx', { s1Ul: 0 }), tri = born('c172', { s1Ul: 1 });
  ok(ROW && ROW.buildKg > 0 && ROW.hard === 'carbon' && C.genPhysKey(ROW.phys) === 'softShell' && arch.fuselage.material === 'softShell' && c0.fuselage.material === 'carbon',
     `A the Construction tile's 7th option (intCons 6) writes '${arch.fuselage.material}' (0: '${c0.fuselage.material}'); the row built for ${ROW && ROW.buildKg} kg, its own phys, its hard roles '${ROW && ROW.hard}'`);
  ok(UG && UG.linK > 0 && UG.buildKg > 0 && arch.gear.mono === true && arch.gear.ul === true && !('ul' in m0.gear) && !('ul' in tri.gear),
     `A the ultralight monowheel (s1Ul) writes gear.ul on the monowheel (${arch.gear.ul}), nothing with it off (${'ul' in m0.gear}) nor on a two-wheel gear (${'ul' in tri.gear})`);
  const others = D.ARCHETYPES.filter(a => a.key !== 'archaeopteryx').map(a => { try { return [a.key, born(a.key)]; } catch (e) { return [a.key, null]; } }).filter(([, s]) => s);
  const leak = others.filter(([, s]) => s.fuselage.material === 'softShell' || (s.gear && s.gear.ul));
  ok(others.length > 10 && !leak.length, `A latent: none of the ${others.length} other cards flies either (${leak.map(x => x[0]).join(', ') || 'none'})`); }

console.log('B. LIGHT');
const A1 = certified(arch), LA = ledger(A1.def0);
{ const LC = ledger(C.buildGen(born('archaeopteryx', { intCons: 0 })));
  const box = (() => { const k = HANG.boxK; HANG.boxK = 1; const kg = HANG.hubKg; HANG.hubKg = 0;
    try { return ledger(C.buildGen(born('archaeopteryx'))).bracing; } finally { HANG.boxK = k; HANG.hubKg = kg; } })();
  const LS = ledger(C.buildGen(born('archaeopteryx', { s1Ul: 0 })));
  ok(LA.fuselage < 0.2 * LC.fuselage, `B the pod on the soft shell ${r1(LA.fuselage)} kg against its moulded carbon's ${r1(LC.fuselage)}`);
  ok(LA.bracing < 0.5 * box, `B the carry-through on the hub ${r1(LA.bracing)} kg (the fitting ${HANG.hubKg} + the box at ${HANG.boxK}) against the box billed whole ${r1(box)}`);
  ok(LA.gear < 0.6 * LS.gear, `B the gear on the ultralight monowheel ${r1(LA.gear)} kg against the standard monowheel's ${r1(LS.gear)}`);
  ok(LA.empty < 95, `B the Archaeopteryx empty ${r1(LA.empty)} kg (L7 118.7)`); }

console.log('C. IT STANDS AND HOLDS');
{ const p = ground(A1.def, 0, 10), d = ground(A1.def, 0.22, 4), b = bench(A1.def);
  ok(p.finite && p.yields === 0 && p.breaks === 0, `C parked 10 s: ${p.yields} yields, ${p.breaks} broken, the wing settles ${r1(p.sagCm)} cm`);
  ok(/^BROKE AT/.test(b.verdict) && b.brokeAt >= C.GEN_LOAD_ULT, `C the wing's destroy bench: ${b.verdict} at ${b.brokeKey || '-'} (the ultimate ${C.GEN_LOAD_ULT} g)`);
  ok(d.finite && d.breaks === 0, `C dropped at the limit sink (0.22 m): ${d.breaks} broken (${d.yields} yields: the poles take a set - a repair, not a wreck)`);
  // (C's sink, D's reference)
  ground.archSag = p.sagCm; }

console.log('D. THE MAST IS WHAT CARRIES IT');
{ const free = certified(born('archaeopteryx', { hangOn: 0 })), p = ground(free.def, 0, 10);
  ok(p.finite && p.yields > 0 && p.sagCm > ground.archSag + 3,
     `D without the mast (the wing on the poles) parked 10 s: ${p.yields} yields, ${p.breaks} broken, the wing sinks ${r1(p.sagCm)} cm (on the mast ${r1(ground.archSag)})`); }

console.log('E. HEAVIER AEROPLANES COME DOWN AT REST');
for (const k of ['cub', 'c172']) {
  const s = certified(born(k, { intCons: 6 })), own = certified(born(k));
  const p = ground(s.def, 0, 2), q = ground(own.def, 0, 2);
  ok(p.finite && p.breaks > 0 && q.breaks === 0,
     `E ${k} (W0 ${s.def0.parts.gauge.W0.toFixed(0)} kg) on the soft shell parked: ${p.breaks} broken by ${r2(p.t1)} s (${p.yields} yields); on its own construction ${q.breaks} broken`);
}

console.log('F. THE ULTRALIGHT WHEEL ON A HEAVIER AEROPLANE FOLDS');
{ const ul = certified(born('cub', { s1X: 0, s1Ul: 1 })), st = certified(born('cub', { s1X: 0 }));
  const a = ground(ul.def, 0.22, 4), b = ground(st.def, 0.22, 4);
  ok(ul.def0.spec.gear.ul === true && a.finite && (a.br.gear || 0) > 0 && !(b.br.gear > 0),
     `F a Cub on one centreline main (W0 ${ul.def0.parts.gauge.W0.toFixed(0)} kg) dropped at the limit sink: the ultralight wheel's gear loses ${a.br.gear || 0} members, the standard's ${b.br.gear || 0}`); }

console.log(fails.length ? 'GATE ULTRALIGHT: FAIL (' + fails.length + ')' : 'GATE ULTRALIGHT: PASS');
process.exit(fails.length ? 1 : 0);
