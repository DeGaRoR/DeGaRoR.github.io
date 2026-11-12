#!/usr/bin/env node
// GATE PHYSPAGES - PHYSICS-PAGES: the fiche's physics pages (src/core/66c_gen_fiche_pages.js, the data; src/viewer/
// fiche_physics.js, the drawing) on the official Cub, the Metal Cessna and the Twin busher, each through the game's load
// door (tools/_load_build.js). Every page's numbers are held to an INDEPENDENT call of the function they read:
//   LOAD     a second makeLoadTest on a fresh sim (app.js startLoadTest's cfg): the verdict, the limit and ultimate tip
//            readings, and at the limit frame the worst member's force over its own yield (fy0 / fc0)
//   DESTROY  bench_worker.js benchLoadRun with destroy (the garage's own test to destruction): the verdict, the first
//            bend, the first break, the g a part lets go at, the parts that let go (sim.damage().groups), in order
//   DRAG     the rows add up to the axial row the solver flies (params.gen.drag.axial), the gear terms to the gear row
//            (genGearCdA's), the fuselage group is the body row, every km/h is a loss, the cruise inside its bracket
//   ELEC     genSystemsResolve with the light layer's fitted lamps (breakers, parts, loads deep-equal), makeBus run with
//            the alternator off to the same minute
//   TANKS    the vessels' litres and kilograms are their _res records, the bay genBayResolve's
//   MODEL    the counts, the mass, the propeller are buildGen's
//   DRAW     fitFrame recovers a known offset (and the side view's tilt) from a synthetic picture of the nodes; the four
//            pages in both themes are one <svg> each, with no NaN / undefined / Infinity in them
// Run: node tools/_physpages_check.js [--selftest]   (one final `GATE PHYSPAGES: PASS|FAIL`; the planes in parallel children)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const T = __dirname, FLY = path.join(T, '..');
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', c172: 'builds/cessna172_2026-09-20.json',
                 twin: 'builds/candidates/Twin_busher_floats_4b.json' };
const argv = process.argv.slice(2);

function child(k) {
  const C = require(path.join(T, 'flight_core.js'));
  const LB = require(path.join(T, '_load_build.js'));
  const BW = require(path.join(FLY, 'src', 'viewer', 'bench_worker.js'));
  const FP = require(path.join(FLY, 'src', 'viewer', 'fiche_physics.js'));
  const fails = [], notes = [];
  let checks = 0;
  const ok = (c, what) => { checks++; if (!c) fails.push(what); };
  const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol);
  const spec = LB.loadBuild(BUILDS[k]).spec, def = C.buildGen(spec), S = def.spec;
  const D = C.genFichePages(def);
  // ---- LOAD ---------------------------------------------------------------------------------------------------------------
  {
    const sim = C.makeSim(def, null); sim.reset(0);
    const rig = C.makeLoadTest(sim, def, { material: (S.fuselage && S.fuselage.material) || undefined, wingMaterial: C.genSurfKey(S, 'wing', 0) });
    let F = null;
    while (!rig.state.done) { rig.step(1 / 60); if (!F && rig.state.n >= rig.limit) F = sim.beams.map(b => ((b.tens && b.strain < 0) ? 0 : b.k * b.strain * b.L0)); }
    const st = rig.state, L = D.load;
    ok(L.ok && L.verdict === st.verdict, 'LOAD verdict ' + L.verdict + ' vs ' + st.verdict);
    ok(near(L.limitPct, st.limitPct) && near(L.ultPct, st.ultPct), 'LOAD tip readings differ from the rig');
    ok(near(L.tipM, st.limitPct / 100 * rig.semi, 5e-5), 'LOAD tipM is not limitPct x semi');
    const b = sim.beams[L.worst], f = F[L.worst], cap = f >= 0 ? (b.fy0 || b.fu) : (b.fc0 || b.fy0 || b.fu);
    ok(near(L.worstU, Math.abs(f) / cap, 1e-4), 'LOAD worst member ' + L.worstU + ' vs ' + Math.abs(f) / cap);
    ok(L.util.every((u, i) => u <= L.worstU + 1e-9) && L.shape && L.shape.length === def.nodes.length, 'LOAD worst is not the max, or no shape');
    notes.push(`load ${st.verdict} tip ${(L.tipM * 100).toFixed(1)} cm, worst ${(L.worstU * 100).toFixed(0)} %`);
  }
  // ---- DESTROY ------------------------------------------------------------------------------------------------------------
  {
    const run = BW.benchLoadRun(C, { spec: JSON.parse(JSON.stringify(spec)), cfg: { material: S.fuselage && S.fuselage.material, wingMaterial: C.genSurfKey(spec, 'wing', 0), destroy: true } });
    let n = 0; while (run.ok && !run.done && n < 60 * 120) { run.pump(60); n += 60; }
    const st = run.rig.state, Ds = D.destroy, G = run.sim.damage().groups.map(g => g.key);
    ok(Ds.ok && Ds.verdict === st.verdict, 'DESTROY verdict ' + Ds.verdict + ' vs the bench ' + st.verdict);
    for (const q of ['yieldAt', 'breakAt', 'brokeAt']) ok(Ds[q] === st[q], 'DESTROY ' + q + ' ' + Ds[q] + ' vs the bench ' + st[q]);
    ok(Ds.brokeKey === st.brokeKey && JSON.stringify(Ds.groups.map(g => g.key)) === JSON.stringify(G), 'DESTROY the parts that let go differ: ' + Ds.groups.map(g => g.key) + ' vs ' + G);
    ok(Ds.shape && Ds.shape.length === def.nodes.length && Ds.broken.length > 0, 'DESTROY no shape or nothing broken');
    notes.push(`destroy ${st.verdict}, first bend ${st.yieldAt != null ? st.yieldAt.toFixed(2) : '-'} g, ${G.join(' > ')}`);
  }
  // ---- DRAG ---------------------------------------------------------------------------------------------------------------
  {
    const g = def.params.gen.drag, Dg = D.drag;
    const sum = Object.values(Dg.rows).reduce((a, v) => a + v, 0);
    ok(near(sum, g.axial, 5e-4), 'DRAG rows add to ' + sum + ', the axial row is ' + g.axial);
    const terms = C.genFicheGearTerms(S), ts = Object.values(terms).reduce((a, v) => a + v, 0);
    ok(near(ts, g.gear, 1e-9), 'DRAG gear terms add to ' + ts + ', genGearCdA ' + g.gear);
    ok(near(Dg.groups.fuselage.cda, g.body, 1e-4), 'DRAG the fuselage group is not the body row');
    ok(Object.values(Dg.groups).every(x => x.dV > 0), 'DRAG a part that costs nothing or gains');
    const Vs = def.params.gen.Vs; ok(Dg.Vc >= 1.05 * Vs - 1e-6 && Dg.Vc <= 4 * Vs, 'DRAG cruise outside its bracket');
    ok(Dg.floats === (S.gear.type === 'floats'), 'DRAG the floats flag');
    notes.push(`drag cruise ${(Dg.Vc * 3.6).toFixed(0)} km/h, ${Object.keys(Dg.groups).length} parts`);
  }
  // ---- ELEC ---------------------------------------------------------------------------------------------------------------
  {
    const cg = S.cage || {}, LK = Object.keys(C.GEN_LIGHT_AMPS);
    const lights = cg.lightOn ? LK.filter(q => cg['li_' + q + 'Fit'] == null || !!+cg['li_' + q + 'Fit']) : [];
    const sy = C.genSystemsResolve(S, { lights }), E = D.elec;
    ok(JSON.stringify(sy.breakers) === JSON.stringify(E.breakers) && JSON.stringify(sy.parts) === JSON.stringify(E.parts) && JSON.stringify(sy.loads) === JSON.stringify(E.loads),
       'ELEC breakers / parts / loads differ from genSystemsResolve');
    ok(E.lamps.length === lights.length && E.altA === sy.altA && E.battAh === sy.battAh, 'ELEC lamps or ratings');
    if (sy.battAh > 0) {
      const loads = sy.loads.concat(lights.map(q => ({ key: 'lt_' + q, amps: C.GEN_LIGHT_AMPS[q] * (q === 'beacon' ? 0.5 : 1), cb: C.GEN_LIGHT_BREAKER[q] })));
      const bus = C.makeBus({ battAh: sy.battAh, altA: sy.altA, loads, breakers: sy.breakers });
      bus.master = true; bus.alt = false; bus.avionics = true; bus.step(0.5, 2300, false);
      let t = 0; while (bus.ok && t < 6 * 3600) { bus.step(5, 2300, false); t += 5; }
      ok(near(E.dark.min, Math.round(t / 60 * 10) / 10, 1e-9), 'ELEC the battery minutes ' + E.dark.min + ' vs makeBus ' + t / 60);
      notes.push(`elec night ${E.night.A} A of ${E.altA} A, battery alone ${E.dark.min} min`);
    }
  }
  // ---- TANKS --------------------------------------------------------------------------------------------------------------
  {
    const V = (S.energy && S.energy.vessels) || [], Tk = D.tanks;
    ok(Tk.vessels.length === V.length && V.every((v, i) => Tk.vessels[i].litres === v._res.litres && Tk.vessels[i].contentsKg === v._res.contentsKg), 'TANKS litres / kg differ from _res');
    ok(V.every((v, i) => { const B = C.genBayResolve(S, v.bay, def.parts.ST); return !B || Tk.vessels[i].bayRes.litres === B.litres; }), 'TANKS the bay differs from genBayResolve');
  }
  // ---- MODEL --------------------------------------------------------------------------------------------------------------
  {
    const M = D.model;
    ok(M.nodes.length === def.nodes.length && M.beams.length === def.beams.length && M.strips.length === def.strips.length, 'MODEL counts');
    const m0 = def.nodes.reduce((a, n) => a + n.m, 0), m1 = M.nodes.reduce((a, n) => a + n[3], 0);
    ok(near(m0, m1, 0.01 * def.nodes.length), 'MODEL mass ' + m1 + ' vs ' + m0);
    ok(near(M.prop.D, def.params.prop.D, 1e-3) && M.contacts.length >= (M.floats ? 1 : 3), 'MODEL propeller or contacts');
    { // the discs: at each engine station without the editor's measure (drawn 0); moved by it, exactly, with it (drawn 1)
      const E = (S.engAt || []).filter(Boolean), off = E.map((e, i) => [-0.2 - 0.01 * i, 0.03]), M2 = C.genFicheModel(def, { propOff: off });
      ok(M.prop.discs.length === E.length && M.prop.discs.every((q, i) => near(q[0], E[i].x, 2e-3) && near(q[1], E[i].y, 2e-3) && q[3] === 0)
         && M2.prop.discs.every((q, i) => near(q[0], E[i].x + off[i][0], 2e-3) && near(q[1], E[i].y + off[i][1], 2e-3) && q[3] === 1), 'MODEL propeller discs at the flange, or at the drawn hub given'); }
  }
  // ---- DRAW: the fit, and the pages in both themes ------------------------------------------------------------------------
  {
    const M = D.model, s = 84, res = {};
    for (const [view, w, h, ox, oy, rot] of [['side', 700, 300, 147, 191, 1.5], ['plan', 1000, 700, 501, 113, 0]]) {   // (the picture wider than the plane: every node lands on it)
      const a = new Uint8Array(w * h), c = Math.cos(rot * Math.PI / 180), sn = Math.sin(rot * Math.PI / 180);
      for (const nd of M.nodes) {
        const p = view === 'side' ? [nd[0], -nd[1]] : [nd[2], nd[0]], u = (p[0] * c - p[1] * sn) * s + ox, v = (p[0] * sn + p[1] * c) * s + oy;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = Math.round(u + dx), y = Math.round(v + dy); if (x >= 0 && x < w && y >= 0 && y < h && dx * dx + dy * dy <= 9) a[y * w + x] = 1; }
      }
      const fr = FP.fitFrame(M, view, a, w, h, s);
      ok(Math.abs(fr.ox - ox) <= 2 && Math.abs(fr.oy - oy) <= 2 && Math.abs(fr.rot - rot) <= 0.5 && fr.score >= M.nodes.length - 1,
         'DRAW the fit missed a known ' + view + ' frame: ' + JSON.stringify(fr) + ' vs ' + [ox, oy, rot]);
      res[view] = { href: 'data:image/png;base64,', W: w, H: h, s, frame: fr };
    }
    for (const th of ['sheet', 'screen']) for (const p of FP.PAGES) {
      let out = '';
      try { out = FP.svg(p.id, D, { theme: th, name: k, reg: 'F-TEST', pics: res, sig: 'Wingsmith · certified airworthy' }); } catch (e) { out = 'THROW ' + e.message; }
      ok(/^<svg [^>]*viewBox="0 0 1200 800"/.test(out) && out.endsWith('</svg>') && !/NaN|undefined|Infinity/.test(out),
         'DRAW ' + p.id + ' (' + th + ') ' + (out.startsWith('THROW') ? out : 'carries a bad number or is not one svg'));
    }
    // REFERENCE: the baked section's scores are real_report's own (scorePlane on the same result), and it draws whole
    { const RB = require(path.join(T, 'fiche_reference_bake.js')), REP = require(path.join(T, 'real_report.js'));
      const RF = RB.referenceOf('jodel'), got = RB.resultOf('jodel');
      if (!RF || !got) notes.push('REFERENCE no REAL-CHECK result for jodel here: not checked');
      else { const sc = REP.scorePlane(got.o);
        ok(['overall', 'geometry', 'specs', 'performance'].every(a => RF[a] === (sc[a] == null ? null : Math.round(sc[a]))) &&
           ['geometry', 'specs', 'performance'].every(a => RF.items[a].length === (sc.items[a] || []).length), 'REFERENCE the baked scores are not scorePlane\'s');
        for (const th of ['sheet', 'screen']) { let out = '';
          try { out = FP.svg('reference', Object.assign({}, D, { reference: RF }), { theme: th, name: k, reg: 'F-TEST', sig: 'Wingsmith' }); } catch (e) { out = 'THROW ' + e.message; }
          ok(/^<svg /.test(out) && !/NaN|undefined|Infinity/.test(out) && out.includes('OURS VS REAL'), 'DRAW reference (' + th + ') ' + (out.startsWith('THROW') ? out : 'bad')); } } }
  }
  return { k, checks, fails, notes, kb: Math.round(JSON.stringify(D).length / 1024) };
}

if (argv[0] === '--build') {
  const r = child(argv[1]);
  process.stdout.write('@@' + JSON.stringify(r) + '\n');
} else {
  const t0 = Date.now();
  const runs = Object.keys(BUILDS).map(k => new Promise(res => {
    const p = spawn(process.execPath, [__filename, '--build', k], { cwd: FLY });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('close', code => { const m = /@@(.*)\n/.exec(out); res(m ? JSON.parse(m[1]) : { k, checks: 1, fails: ['the child failed (' + code + '): ' + err.slice(-400)], notes: [] }); });
  }));
  Promise.all(runs).then(R => {
    let bad = 0;
    for (const r of R) {
      console.log(`  ${r.k.padEnd(5)} ${r.fails.length ? 'FAIL' : 'ok  '} ${r.checks} checks${r.kb ? ', data ' + r.kb + ' KB' : ''}`);
      for (const n of r.notes) console.log('        ' + n);
      for (const f of r.fails) console.log('        FAIL ' + f);
      bad += r.fails.length;
    }
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    console.log('GATE PHYSPAGES: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
    process.exit(bad ? 1 : 0);
  });
}
