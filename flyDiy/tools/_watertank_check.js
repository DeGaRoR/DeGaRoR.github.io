// GATE WATERTANK - THE WATER TANKS (the user, 15 Nov 2026: "We need to be able to put tanks, and fill them with water. These
// will be called water tanks. Later they could be filled with stuff to be sprayed, they will have a release mechanism,
// and a particle animation when it releases (water shower). There will be a release point, by default a simple downwards
// opening with little checks. Let's simply reuse the fuel tank mechanism, but give it another appearance ... blue
// plastic"; then: "remove the ballast option and replace with the tanks, including for the archaeopteryx. Offer to
// partially fill the tank in the garage. Little checks means regarding collision").
//
// spec.water.vessels (60_gen_spec GEN_RULES.water, genWaterClamp) - the fuel tank's fields plus `fill`; the vessel
// GEN_VESSELS.waterPoly, the contents GEN_WATER (60c); 61_gen_frame bills the shell ('waterTank', the airframe's) and the
// water ('water', a payload) on the bay's nodes, records `mWater` per node and the outlets (parts.water -> params.water);
// the solver's dump valve (ctl.dump) drains them at Torricelli's rate (30_solver waterFrame); the garage's energy layer
// draws them blue with their outlet run checked (tools/_cage_energy.js outletJudge); the page's shower (app.js
// syncDumpFx, tools/water_dump_shot.js for the stills).
//
//   A. LATENT: no card but the Archaeopteryx carries spec.water, a 'water' / 'waterTank' line or params.water.
//   B. THE BILL: the motorglider with a 20 L tank in the cabin at half: the shell genVesselResolve's, the water 10 kg as a
//      PAYLOAD at the tank's station, the empty mass up by the shell (and its structure); the clamps (900 L -> 400, fill 2
//      -> 1, a strut pod -> the cabin, nothing listed -> no key).
//   C. THE DUMP: the valve shut 2 s - not a gram; open - it drains at rateLs x tanks (1 %); empty - the flow stops; a burn
//      after the dump leaves the water gone (the deficit kept); reset fills the tanks and shuts the valve, the mass to the
//      bit; the snapshot carries the dump.
//   D. THE CARD: the Archaeopteryx through the join (BJ.bakeCard) - its nose tank (5 L, full, -0.06 m) kept, the water
//      billed ahead of the pilot, the dump drains it.
//   E. THE GARAGE: the energy layer seeded with the Archaeopteryx (fromSpec(energy, spec)) lists the water tank beside the
//      packs, draws it blue (bluePoly) with its water, its outlet pipe and valve, judges the run (r.outlet), and gives it
//      back as spec.water (toWater) - not in the energy (toSpec); a fuel list seeded alone leaves the water unknown.
// Run: node tools/_watertank_check.js   (one final `GATE WATERTANK: PASS|FAIL`)
'use strict';
const path = require('path');
const T = __dirname;
const SH = require(path.join(T, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js', '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const { D, C } = BJ.loadPanel();
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const r2 = v => v == null ? '-' : (+v).toFixed(2), r3 = v => v == null ? '-' : (+v).toFixed(3);
const born = (key, cage, spec) => {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: Object.assign(JSON.parse(JSON.stringify((A.over && A.over.spec) || {})), spec || {}) };
  const s0 = D.designBake(Object.assign({}, A.sel), over);
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const build = s => C.buildGen(JSON.parse(JSON.stringify(s)));
const empty = d => { let m = 0; for (const k in d.parts.ledger) if (!d.parts.ledger[k].payload) m += d.parts.ledger[k].mass; return m; };

console.log('A. LATENT');
{ const leak = [];
  for (const A of D.ARCHETYPES) {
    let s; try { s = born(A.key); } catch (e) { continue; }
    const d = build(s), L = d.parts.ledger;
    const has = !!s.water || !!L.water || !!L.waterTank || !!d.params.water;
    if (has !== (A.key === 'archaeopteryx' || A.key === 'ls4')) leak.push(A.key);   // (the LS4-alike: its wings' ballast)
  }
  ok(!leak.length, `A only the Archaeopteryx and the LS4-alike carry water (${leak.join(', ') || 'none other'})`); }

console.log('B. THE BILL');
const sMG = born('motorglider'), dMG = build(sMG);
const sW = Object.assign(JSON.parse(JSON.stringify(sMG)), { water: { vessels: [{ bay: 'cabin', capacity: 20, fill: 0.5, along: 0.3, lv: 0.2 }] } });
const dW = build(sW);
{ const L = dW.parts.ledger, R = C.genVesselResolve('water', 20, 'waterPoly', 'water');
  ok(L.waterTank && Math.abs(L.waterTank.mass - R.vesselKg) < 1e-9 && !L.waterTank.payload,
     `B the shell ${r3(L.waterTank && L.waterTank.mass)} kg, the airframe's (genVesselResolve: ${r3(R.vesselKg)})`);
  ok(L.water && Math.abs(L.water.mass - 10) < 1e-9 && L.water.payload && Math.abs(L.water.mx / L.water.mass - 0.3) < 1e-6,
     `B the water ${r2(L.water && L.water.mass)} kg a payload at ${r3(L.water && L.water.mx / L.water.mass)} m (20 L at half, at 0.3)`);
  const dE = empty(dW) - empty(dMG);
  ok(dE >= R.vesselKg && dE < R.vesselKg + 3, `B the empty mass +${r2(dE)} kg (the shell and the structure for 20 kg more)`);
  const cl = C.resolveSpec(Object.assign(JSON.parse(JSON.stringify(sMG)), { water: { vessels: [{ bay: 'strut', capacity: 900, fill: 2 }, { bay: 'cabin', capacity: 0 }] } })).spec;
  const v0 = cl.water && cl.water.vessels[0];
  ok(v0 && cl.water.vessels.length === 1 && v0.capacity === C.GEN_RULES.water.maxL && v0.fill === 1 && v0.bay === 'cabin',
     `B the clamps: ${JSON.stringify(v0 && { bay: v0.bay, capacity: v0.capacity, fill: v0.fill })} (one tank kept: the empty one dropped)`);
  const none = C.resolveSpec(Object.assign(JSON.parse(JSON.stringify(sMG)), { water: { vessels: [] } })).spec;
  ok(!('water' in none), 'B nothing listed: no water key'); }

console.log('C. THE DUMP');
{ const PW = dW.params.water;
  ok(PW && PW.kg0 === 10 && PW.outlets.length === 1 && PW.rateLs > 1 && PW.rateLs < 3,
     `C the params: ${r2(PW && PW.kg0)} kg, ${PW ? PW.outlets.length : 0} outlet, ${r3(PW && PW.rateLs)} L/s (a 40 mm hole, Torricelli)`);
  const s = C.makeSim(dW, null); s.reset(0); const m0 = s.totalM;
  ok('dump' in s.ctl && s.ctl.dump === 0 && s.water && s.water.kg === 10, 'C the valve\'s key on a build with water, shut, the tanks full');
  for (let i = 0; i < 120; i++) s.step(1 / 60);
  ok(s.totalM === m0 && s.water.kg === 10, `C shut 2 s: ${r3(m0 - s.totalM)} kg gone`);
  s.ctl.dump = 1; const t0 = s.t; for (let i = 0; i < 180; i++) s.step(1 / 60);
  const want = PW.rateLs * (s.t - t0), got = 10 - s.water.kg;
  ok(Math.abs(got - want) / want < 0.01 && Math.abs((m0 - s.totalM) - got) < 1e-6 && s.out.waterFlow > 0,
     `C open 3 s: ${r3(got)} kg out (the rate says ${r3(want)}); the aeroplane ${r3(m0 - s.totalM)} kg lighter; the flow ${r3(s.out.waterFlow)} kg/s`);
  for (let i = 0; i < 600; i++) s.step(1 / 60);
  ok(s.water.kg === 0 && s.out.waterFlow === 0 && Math.abs((m0 - s.totalM) - 10) < 1e-6, `C empty: ${r3(s.water.kg)} kg left, the flow ${s.out.waterFlow}, ${r3(m0 - s.totalM)} kg gone`);
  // A BURN AFTER THE DUMP (the Cub: fuel, its tank's nodes shared with a water tank on the same station): the water
  // stays gone - the burn rewrites a tank node's mass from its base, and the dumped kilos are taken off it
  // (the Cub's own tank sits ahead of the nose ring, on nodes of its own: here it is moved onto the rings at 0.3 m, the
  //  water tank beside it - the same ring pair)
  { const sC = born('cub'), fv = sC.energy.vessels[0];
    Object.assign(fv, { bay: 'cabin', along: 0.3, lv: 0.7, form: 'box', dims: null }); delete fv.fit;
    const sCW = Object.assign(JSON.parse(JSON.stringify(sC)), { water: { vessels: [{ bay: 'cabin', capacity: 10, fill: 1, along: 0.3, lv: 0.7 }] } });
    const dCW = build(sCW), q = C.makeSim(dCW, null); q.reset(0);
    const mC0 = q.totalM, shared = dCW.nodes.filter(n => n.mFuel > 0 && n.mWater > 0).length;
    q.ctl.thr = 1; q.ctl.dump = 1; for (let i = 0; i < 600; i++) q.step(1 / 60); q.ctl.dump = 0;
    for (let i = 0; i < 1200; i++) q.step(1 / 60);
    const fuelGone = q.fuel.kg0 - q.fuel.kg, wGone = q.water.kg0 - q.water.kg, lost = mC0 - q.totalM;
    ok(shared > 0 && fuelGone > 0 && wGone > 9.99 && Math.abs(lost - (wGone + fuelGone)) < 1e-6,
       `C a burn after the dump (the Cub, ${shared} nodes holding both): ${r3(lost)} kg lighter = ${r3(wGone)} kg of water + ${r3(fuelGone)} kg of fuel`); }
  s.reset(0);
  ok(s.totalM === m0 && s.water.kg === 10 && s.ctl.dump === 0, `C reset: the tanks full, the valve shut, the mass ${s.totalM === m0 ? 'to the bit' : r3(s.totalM - m0)}`);
  if (typeof s.snap === 'function' && typeof s.unsnap === 'function') {
    s.ctl.dump = 1; for (let i = 0; i < 60; i++) s.step(1 / 60);
    const Sn = s.snap(), kgS = s.water.kg, mS = s.totalM;
    for (let i = 0; i < 60; i++) s.step(1 / 60);
    const back = s.unsnap(Sn);
    ok(back && s.water.kg === kgS && s.totalM === mS, `C the snapshot carries the dump (${r3(kgS)} kg, back: ${r3(s.water.kg)})`);
  }
  const s0 = C.makeSim(dMG, null); s0.reset(0);
  ok(!('dump' in s0.ctl) && s0.water === null, 'C a build without water: no valve key, no water state'); }

console.log('D. THE CARD');
const sA = BJ.bakeCard('archaeopteryx').spec, dA = build(sA);
{ const v = sA.water && sA.water.vessels[0];
  ok(v && v.bay === 'nose' && v.capacity === 5 && v.fill === 1 && v.along === -0.06, `D the Archaeopteryx through the join: ${JSON.stringify(v && { bay: v.bay, capacity: v.capacity, fill: v.fill, along: v.along })}`);
  const L = dA.parts.ledger, cab = L.cabin.mx / L.cabin.mass;
  ok(L.water && Math.abs(L.water.mass - 5) < 1e-9 && L.water.mx / L.water.mass < cab, `D 5 kg of water at ${r3(L.water && L.water.mx / L.water.mass)} m, ahead of the pilot (${r3(cab)})`);
  const s = C.makeSim(dA, null); s.reset(0); s.ctl.dump = 1; for (let i = 0; i < 600; i++) s.step(1 / 60);
  ok(s.water.kg === 0, `D the dump empties it (${r3(s.water.kg)} kg left after 10 s)`); }

console.log('E. THE GARAGE');
{ const C0 = SH.context(), W = C0.ctx; SH.stubCanvas();
  const E = W.CAGE_ENERGY;
  const A = D.ARCHETYPES.find(x => x.key === 'archaeopteryx'), birth = C.genNormaliseSpec(D.designBake(A.sel, A.over));
  E.fromSpec(birth.energy);
  ok(E.toWater() === undefined && !E.EN.vessels.some(v => v.holds === 'water'), 'E a fuel list seeded alone: the water unknown (the join leaves the spec\'s)');
  E.fromSpec(birth.energy, birth);
  const wv = E.EN.vessels.filter(v => v.holds === 'water');
  ok(wv.length === 1 && E.EN.vessels.length === 3 && !E.toSpec().vessels.some(v => v.holds) && E.toSpec().vessels.length === 2,
     `E seeded with the spec: ${E.EN.vessels.length} vessels (the water tank among them), the energy's own ${E.toSpec().vessels.length}`);
  const tw = E.toWater();
  ok(tw && tw.vessels.length === 1 && tw.vessels[0].capacity === 5 && tw.vessels[0].fill === 1, `E toWater: ${JSON.stringify(tw && tw.vessels.map(v => [v.bay, v.capacity, v.fill]))}`);
  const def = C.buildGen(JSON.parse(JSON.stringify(sA)));
  const r = SH.sceneBuild(sA, { garage: sA, resolved: () => def.spec, inGame: true });
  const names = []; r.scene.traverse(o => { if (o.name) names.push(o.name); });
  const i = E.EN.vessels.findIndex(v => v.holds === 'water');
  const RR = (E.results() || []).find(x => x.v && x.v.holds === 'water');
  ok(names.includes('edVessel_' + i + '_shell') && names.includes('edFuel_' + i) && names.includes('edVessel_' + i + '_outlet') && names.includes('edVessel_' + i + '_valve'),
     `E drawn: the shell, the water, the outlet and its valve (${names.filter(n => n.startsWith('edVessel_' + i) || n === 'edFuel_' + i).join(' ')})`);
  ok(RR && RR.outlet && typeof RR.outlet.ok === 'boolean' && RR.outlet.len > 0, `E the outlet's run judged: ${RR && JSON.stringify({ ok: RR.outlet.ok, len: r3(RR.outlet.len), why: RR.outlet.why })}`);
  let blue = null; r.scene.traverse(o => { if (o.name === 'edVessel_' + i + '_shell' && o.material) blue = o.material.color && o.material.color.getHex(); });
  ok(blue === 0x2f6fd0, `E the shell blue polyethylene (${blue != null ? '#' + blue.toString(16) : '-'})`); }

console.log(fails.length ? 'GATE WATERTANK: FAIL (' + fails.length + ')' : 'GATE WATERTANK: PASS');
process.exitCode = fails.length ? 1 : 0;
