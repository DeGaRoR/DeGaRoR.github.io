// GATE SAILPLANE - THE CATEGORY, THE AIRBRAKES AND THE LS4-ALIKE (the user, 15 Nov 2026: "do everything required. Make
// the wing thicker if you think it's closer to the real model ... We can model airbrakes, along with their dashboard
// control ... By increasing the strength, we should also get heavier ... Wing thicker, stronger and more water").
//
//   A. THE CATEGORY (60_gen_spec GEN_CATEGORY; 61_gen_frame genDesignGross (Nz / 3.8)^e; 66_gen_cert genCertLim): the
//      motorglider as a sailplane (+5.3) builds heavier than as a normal one (+3.8) - the wing and the fuselage, not the
//      gear; its certificate flies the corners at 5.3 and the ultimate at 1.5 x; a normal build carries no key; the
//      cage's certCat row writes it through the join.
//   B. THE AIRBRAKES (GEN_RULES.airbrake; wings[0].airbrake): the clamp; the strips they span carry `ab` (the others
//      none); the plates' mass in their own line; the handle (ctl.airbrake) only on a build with brakes; full out the
//      LS4-alike's lift-for-weight drag rises and its L/D falls under 10; the wing layer draws both plates and the
//      crew layer the blue handle; the input's two keys move the handle by fifths.
//   C. THE LS4-ALIKE (the card): it bakes through the join - no engine, the 15 % section, the sailplane category, 170 L
//      of water in two wing tanks with 20 mm outlets (the dump ~3-4 min), the CG tow release, the airbrakes - and it
//      flies 30 s with the water dumping (finite, the water going).
// Run: node tools/_sailplane_check.js   (one final `GATE SAILPLANE: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const SH = require(path.join(T, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js', '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const L = require(path.join(T, '_treecrash_lib.js'));
const { D, C } = BJ.loadPanel();
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const r1 = v => v == null ? '-' : (+v).toFixed(1), r2 = v => v == null ? '-' : (+v).toFixed(2);
const born = (key, cage, spec) => {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: Object.assign(JSON.parse(JSON.stringify((A.over && A.over.spec) || {})), spec || {}) };
  const s0 = D.designBake(Object.assign({}, A.sel), over);
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const build = s => C.buildGen(JSON.parse(JSON.stringify(s)));
const led = (d, k) => (d.parts.ledger[k] || { mass: 0 }).mass;

console.log('A. THE CATEGORY');
{ const sN = born('motorglider'), sS = born('motorglider', { certCat: 2 }), sV = born('motorglider', { certCat: 1 });
  ok(!('category' in sN) && sS.category === 'sailplane' && sV.category === 'light', `A the row writes the key: normal ${JSON.stringify(sN.category)}, strong ${JSON.stringify(sS.category)}, very light ${JSON.stringify(sV.category)}`);
  ok(build(sV).parts.ledger.wings.mass < build(sN).parts.ledger.wings.mass, 'A very light builds lighter than normal');
  const dN = build(sN), dS = build(sS);
  ok(led(dS, 'wings') > led(dN, 'wings') * 1.05 && led(dS, 'fuselage') > led(dN, 'fuselage') && Math.abs(led(dS, 'gear') - led(dN, 'gear')) < 0.5,
     `A heavier as a sailplane: the wing ${r1(led(dN, 'wings'))} -> ${r1(led(dS, 'wings'))} kg, the fuselage ${r1(led(dN, 'fuselage'))} -> ${r1(led(dS, 'fuselage'))}, the gear ${r1(led(dN, 'gear'))} -> ${r1(led(dS, 'gear'))} (Nz not on the gear)`);
  ok(C.genCatNz(sS) === 5.3 && C.genCatNz(sN) === 3.8 && C.GEN_CATEGORY.light.nz === 3.0 && C.GEN_CATEGORY.aerobatic.nz === 6.0 &&
     C.GEN_CATEGORY_KEYS.join() === 'normal,light,sailplane,aerobatic',
     'A the four constructions: normal 3.8, very light 3.0, strong (sailplanes) 5.3, aerobatic 6.0 - the row\'s order');
  const R = C.resolveSpec(Object.assign(JSON.parse(JSON.stringify(sN)), { category: 'rocket' })).spec;
  ok(!('category' in R), 'A an unknown category: no key');
  const src = fs.readFileSync(path.join(T, '..', 'src', 'core', '66_gen_cert.js'), 'utf8');
  ok(/L = genCertLim\(def\);\n  \/\/ the V-n corners/.test(src) && /ult: genCertUlt\(def\)/.test(src),
     'A the certificate flies the category: genCertify\'s limit genCertLim, the record\'s ultimate genCertUlt'); }

console.log('B. THE AIRBRAKES');
const sL = BJ.bakeCard('ls4').spec, dL = build(sL);
{ const cl = C.resolveSpec(Object.assign(JSON.parse(JSON.stringify(sL)), { wings: sL.wings.map((w, k) => Object.assign({}, w, { airbrake: { z0: 0.95, z1: 0.2, h: 2 } })) })).spec;
  const a0 = cl.wings[0].airbrake;
  ok(a0 && a0.z1 - a0.z0 >= 0.04 - 1e-9 && a0.h === C.GEN_RULES.airbrake.h[1] && !(cl.wings[1] && cl.wings[1].airbrake),
     `B the clamp: ${JSON.stringify(a0)} (a span of at least 4 %, the plate's height capped)`);
  const S = dL.strips || [], ab = S.filter(s => s.ab > 0);
  ok(ab.length >= 2 && ab.every(s => s.kind === 'wing') && S.filter(s => 'ab' in s).length === ab.length,
     `B the strips: ${ab.length} carry the brake (${ab.map(s => r2(s.ab)).join(' ')}), no other strip a key`);
  ok(led(dL, 'airbrake') > 2 && led(dL, 'airbrake') < 6, `B the boxes ${r1(led(dL, 'airbrake'))} kg, their own line`);
  const s = C.makeSim(dL, null); s.reset(0);
  const dMG = build(born('motorglider')), s0 = C.makeSim(dMG, null); s0.reset(0);
  ok('airbrake' in s.ctl && !('airbrake' in s0.ctl), 'B the handle only on a build with brakes');
  // lift for weight at 28 m/s, drag and L/D, the handle in and out (the probe: the dead tunnel)
  const W = s.totalM * 9.81, V = 28, LD = e => { s.ctl.airbrake = e; let lo = -0.1, hi = 0.3;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, r = s.probe([-V * Math.cos(m), -V * Math.sin(m), 0], false, null); if (r.Fy < W) lo = m; else hi = m; }
    const a = (lo + hi) / 2, r = s.probe([-V * Math.cos(a), -V * Math.sin(a), 0], false, null), ca = Math.cos(a), sa = Math.sin(a);
    return { ld: (r.Fy * ca - r.Fx * sa) / (r.Fx * ca + r.Fy * sa), d: r.Fx * ca + r.Fy * sa }; };
  const e0 = LD(0), e1 = LD(1);
  ok(e1.d > e0.d * 1.8 && e1.ld < 10 && e0.ld > e1.ld * 1.8, `B full out at 28 m/s: the drag ${r1(e0.d)} -> ${r1(e1.d)} N, the L/D ${r1(e0.ld)} -> ${r1(e1.ld)}`);
  // the drawing
  const C0 = SH.context(), Wn = C0.ctx; SH.stubCanvas();
  const def = build(sL), r = SH.sceneBuild(sL, { garage: sL, resolved: () => def.spec, inGame: true });
  const names = []; r.scene.traverse(o => { if (o.name) names.push(o.name); });
  const surfs = ((Wn.CAGE_WING || {}).surfs || []).filter(x => x.kind === 'brk');
  ok(names.includes('edSurf_brkR') && names.includes('edSurf_brkL') && surfs.length === 2 && surfs.every(x => x.slide && x.slide[1] > 0.05),
     `B the plates drawn, each sliding up (${surfs.map(x => r2(x.slide[1])).join(', ')} m)`);
  ok(((Wn.CAGE_CREW || {}).moving || []).some(m => m.name === 'edCtl_airbrake' && m.drive === 'airbrake'), 'B the blue handle in the cockpit, on the airbrake');
  // the keys
  const src = fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'input.js'), 'utf8');
  ok(/id: 'brkOut'[^\n]*\n[^\n]*keys: \{ key: 'Digit8' \}/.test(src) && /id: 'brkIn'[^\n]*\n[^\n]*keys: \{ key: 'Digit7' \}/.test(src) &&
     /if \('airbrake' in ctl\) ctl.airbrake = abH;/.test(src), 'B the input: 8 out, 7 in (the brackets are the radio\'s), written only where the handle is'); }

console.log('C. THE LS4-ALIKE');
{ const v = (sL.water && sL.water.vessels) || [];
  ok(sL.engines[0].none === true && sL.wings[0].naca % 100 === 15 && sL.category === 'sailplane' && sL.gear.towHook === 'cg' && sL.wings[0].airbrake,
     `C the card: engineless, NACA ${sL.wings[0].naca}, ${sL.category}, the tow release ${sL.gear.towHook}, airbrakes`);
  const P = dL.params.water;
  ok(v.length === 2 && v.reduce((t, x) => t + x.capacity, 0) === 170 && P && 170 / P.rateLs > 180 && 170 / P.rateLs < 300,
     `C 170 L in the wings (${v.map(x => x.bay + ' ' + x.capacity).join(', ')}), dumped in ${r1(170 / (P ? P.rateLs : 1) / 60)} min`);
  const W0 = L.flatWorld(0), s = C.makeSim(dL, W0.W); s.reset(0);
  C.placeAtAerodrome(s, Object.assign({}, W0.strip, { elev: 0, spawnElev: 300 }));
  const g = dL.params.gen, Vf = 1.5 * (g.VsMeas || g.Vs), fx = Math.cos(W0.strip.hdg), fz = Math.sin(W0.strip.hdg);
  for (let i = 0; i < s.n; i++) { s.v[i * 3] = Vf * fx; s.v[i * 3 + 2] = Vf * fz; }
  const kg0 = s.water.kg; s.ctl.dump = 1; let fin = true;
  for (let f = 0; f < 1800; f++) { s.step(1 / 60); if (!s.p.every(Number.isFinite)) { fin = false; break; } }
  ok(fin && s.water.kg < kg0 - 20, `C 30 s at 300 m with the valve open: finite ${fin}, the water ${r1(kg0)} -> ${r1(s.water.kg)} kg`); }

console.log(fails.length ? 'GATE SAILPLANE: FAIL (' + fails.length + ')' : 'GATE SAILPLANE: PASS');
process.exitCode = fails.length ? 1 : 0;
