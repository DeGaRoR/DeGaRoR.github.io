#!/usr/bin/env node
// GATE DMGCERT (G1830-G1834, DMG-D2a CERTIFICATE) - the members anchored to the loads the aeroplane is certified for
// (DEFORM-AND-BREAK §4.3 (c), ruling dm1; 66_gen_cert.js, 30_solver.js certStamp), on the user's validated builds,
// damage ON:
//   1. THE CERTIFICATE: the load cases computed (their cost), every member that has physics limits has an envelope,
//      the stamp on the sim; the gear's joints stamped by the gear bracket (G1835, DMG-D2b; GATE DMGGEAR), its other members
//      (a float's hull) on D1a's limits; with the layer off
//      nothing is stamped (every limit infinite); the garage's build never carries one (genCertAttach is asked for by
//      the flight and the bench, cached by the spec)
//   2. THE CARD ON THE BENCH (the garage's own sandbag rig, the certified airframe): a pull to the limit x 1.0 leaves no
//      set; to the limit x 1.2 a set where the wing has a ductile load path (a spruce wing and its fittings are brittle:
//      it holds, or it breaks - printed, not failed); to the ultimate it holds, nothing broken; to the ultimate x 1.1 it
//      breaks, the first group to let go a joint's (a fitting or a seam: §7.4's over-g row)
//   3. TEST TO DESTRUCTION (ruling dm6: free): the bags on past the ultimate until the first group lets go: BROKE AT
//      within [1.5, 1.5 m] x the limit (m the card's margin; +2.5 % for the ramp's lag and a ductile box's plastic
//      redistribution), the first member broken a joint's (never the middle of a ductile member, §7.2); and the page's
//      own job (bench_worker.js benchLoadRun) gives the same number, which the card prints (bench.js benchDestroyLine)
//   4. THE FLIGHT: the flown pull to the limit (GATE TREECRASH's own, read up to the step the wing's load reaches it)
//      leaves no set; parked 10 s and 10 s of level flight: nothing yields, no frame armed once settled (the quiet
//      path, on the certificate's limits)
//   5. A BAD DESIGN FAILS ITS BENCH: the build's lift struts (or, a cantilever, its wing root's members) at a third of
//      their section - a copy, certified like any build: the bench breaks it before its ultimate (BROKE UP: G458 made real)
//   6. D1a's OPEN QUESTIONS under the certificate (REPORT lines): which member breaks first on the Jodel; the drawn lift
//      struts' compression limits; the twin's float nose-in
// Run: node tools/_dmg_cert_check.js   (one final `GATE DMGCERT: PASS|FAIL`; the builds in parallel children)
'use strict';
const path = require('path');
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js');

// the garage's rig on the certified airframe (damage on): to `ult`, held `hold` s; `destroy` - on past it at the load
// test's own rate until the first group lets go (bench_worker's own configuration)
function bench(def, o) {
  const C = L.core(), spec = def.spec, sim = C.makeSim(def, null); sim.reset(0);
  const BW = require(path.join(__dirname, '..', 'src', 'viewer', 'bench_worker.js'));
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, spec, o.destroy ? { destroy: true } : { limit: Math.min(C.GEN_LOAD_LIMIT, o.ult), ult: o.ult, holdS: o.hold == null ? 1.5 : o.hold });
  if (cfg.destroy) { cfg.ult = 3 * C.GEN_LOAD_ULT; cfg.rampS = 4 * cfg.ult / C.GEN_LOAD_ULT; }
  cfg.surface = 'wing';
  const rig = C.makeLoadTest(sim, def, cfg);
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) rig.step(1 / 60);
  const D = sim.damage(), st = rig.state, fb = D.firstBreak, b = fb ? sim.beams[fb.beam] : null;
  return { verdict: st.verdict, set: D.members, setMax: D.setMax, breaks: D.breaks, yieldAt: st.yieldAt, breakAt: st.breakAt, brokeAt: st.brokeAt,
    brokeKey: st.brokeKey || null, brokeSeam: st.brokeSeam || null, groups: D.groups.map(G => G.key),
    fb: fb && { cls: fb.cls, seam: fb.seam, how: fb.how, mat: b.mat, ductile: b.etu > 0, tags: def.nodes[b.a].tag + '-' + def.nodes[b.b].tag }, finite: L.finite(sim) };
}

if (argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k };
  const t0 = Date.now(), cert = L.certOf(k), tCert = Date.now() - t0;
  const def = L.defOf(k, { cert: true }), sim = C.makeSim(def, null); sim.reset(0);
  const phys = C.makeSim(L.defOf(k, { cert: false }), null); phys.reset(0);
  // 1. the certificate
  const nb = def.beams.length, B = sim.beams, P = phys.beams;
  let withPhys = 0, noEnv = 0, gearSame = true, gearN = 0, gearJ = 0, govT = 0, floorT = 0, govC = 0, floorC = 0, overPhys = 0;
  for (let i = 0; i < nb; i++) {
    const b = B[i], p = P[i];
    if (!(p.fy0 < Infinity)) continue;
    // G1835 (DMG-D2b): the gear's joints are the gear bracket's now (30_solver gearStamp): stamped from their own envelope,
    // and not past nothing - its lug at the ultimate in tension; everything else of the gear (a float's hull) keeps D1a's
    if (b.cls === 'gear') { gearN++; if (b.seam || b.fu !== p.fu) { if (!(b.fu > 0 && b.fu < Infinity && b.fc0 > 0)) gearSame = false; gearJ++; } else if (b.fy0 !== p.fy0 || b.fc0 !== p.fc0) gearSame = false; continue; }
    withPhys++;
    if (!(Number.isFinite(cert.Ft[i]) && Number.isFinite(cert.Fc[i]))) noEnv++;
    if (b.fy0 > p.fy0 * (1 + 1e-9) || b.fu > p.fu * (1 + 1e-9) || b.fc0 > p.fc0 * (1 + 1e-9)) overPhys++;
    const kap = (sim.damageCaps().KAP || [])[i] || C.GEN_CERT.kappa;   // G1895 (DMG-TUNE): the wing's floor or the body's
    if (b.fu > kap * p.fu * (1 + 1e-9)) govT++; else floorT++;
    if (!b.tens) { if (b.fc0 > kap * p.fc0 * (1 + 1e-9)) govC++; else floorC++; }
  }
  const off = C.makeSim(Object.assign({}, def, { params: Object.assign({}, def.params, { damage: false }) }), null);
  const offInf = off.beams.every(b => !(b.fy0 < Infinity)) && off.certStamp(cert) === false;
  const fresh = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(def.spec) : def.spec);
  C.genCertAttach(Object.assign({}, fresh), { world: fresh.parts && fresh.parts.floats ? C.makeWorld() : null });   // the first: computed
  const t1 = Date.now(), again = C.genCertAttach(Object.assign({}, fresh), {}), tCache = Date.now() - t1;           // the second: the cache
  out.cert = { ms: tCert, msParts: cert.ms, cases: cert.names, withPhys, noEnv, gearN, gearJ, gearSame, govT, floorT, govC, floorC, overPhys, stamped: !!sim.cert(), offInf,
    buildNone: fresh.cert == null, cacheMs: tCache, cacheSame: again === C.GEN_CERT_CACHE.get(C.genCertKey(fresh)), limit: cert.limit, ult: cert.ult, m: cert.m,
    flownNz: cert.flownNz, sink: cert.sink, speeds: cert.speeds };
  // 2. the card on the bench
  const lim = cert.limit, ult = cert.ult;
  out.lim10 = bench(def, { ult: lim });
  out.lim12 = bench(def, { ult: 1.2 * lim });
  out.ult = bench(def, { ult });
  out.ult11 = bench(def, { ult: 1.1 * ult });
  // a ductile load path in the wing: a member of the wing class the certificate governs, ductile (not a joint)
  out.ductileWing = B.some((b, i) => b.cls === 'wing' && !b.seam && b.etu > 0 && b.fy0 < P[i].fy0 * 0.999);
  // 3. to destruction
  out.destroy = bench(def, { destroy: true });
  // (train 41, A0 7 Oct: THE BAND PER AEROPLANE, FROM ITS OWN CERTIFICATE. A joint group's capacity on the bench is its
  // joints' certified breaks (1.5 F_l m each) over their bench loads at the limit, times the limit: the load at which the
  // whole group has let go once the load has moved off the first joint onto the others (a ductile box's redistribution,
  // capped by the group). Where the bench case governs every joint (F_l = its bench load) it is 1.5 m x the limit - the
  // band as it was (the metal Cessna's). Where another case governs (the Cessna on floats' wing-strut fittings: the
  // one-float DRIFT DROP, 38.03 against the bench's 36.68 kN, front 6.20 g / rear 7.75 g; it broke at 6.595 g, both struts
  // carrying the wing to ~6.9 g - DMG-BUNDLE-GREEN's 'NOT SOLVED 3') the band reads that case's capacity, not the bench's)
  { const grp = def.parts && def.parts.dmg ? def.parts.dmg.groups : [], bt = cert.cases && cert.cases.bench ? cert.cases.bench.t : null;
    const capOf = key => { const G = grp.find(g => g.key === key); if (!G || !bt) return null; let F = 0, Lb = 0; const gov = new Set();
      for (const bi of G.t0) if (bt[bi] > 0) { F += 1.5 * cert.m * cert.Ft[bi]; Lb += bt[bi]; gov.add(cert.names[cert.byT[bi]]); }
      return Lb > 0 ? { key, cap: cert.limit * F / Lb, gov: [...gov] } : null; };
    const all = grp.map(g => capOf(g.key)).filter(Boolean).sort((a, b) => a.cap - b.cap);
    out.band = { destroy: capOf(out.destroy.brokeKey), weakest: all[0] || null }; }
  // (and as the page's bench thread runs it: bench_worker.js benchLoadRun with the destroy configuration and the
  // roll-out's certificate handed in - the card's numbers are this run's)
  {
    const BW = require(path.join(__dirname, '..', 'src', 'viewer', 'bench_worker.js'));
    const CORE = { buildGen: C.buildGen, makeSim: C.makeSim, makeLoadTest: C.makeLoadTest, makeWorld: C.makeWorld, genSurfKey: C.genSurfKey,
                   genCertify: C.genCertify, genCertAttach: C.genCertAttach, GEN_LOAD_ULT: C.GEN_LOAD_ULT };
    const run = BW.benchLoadRun(CORE, { spec: def.spec, cfg: { destroy: true }, cert: { nb, Ft: cert.Ft, Fc: cert.Fc } });
    let n = 0; while (run.ok && !run.done && n < 60 * 120) { run.pump(60); n += 60; }
    const st = run.rig.state;
    const B2 = require(path.join(__dirname, '..', 'src', 'viewer', 'bench.js'));
    out.worker = { brokeAt: st.brokeAt, brokeKey: st.brokeKey, verdict: st.verdict,
      line: B2.benchDestroyLine({ done: true, brokeAt: st.brokeAt, key: st.brokeKey, seam: st.brokeSeam, limit: run.rig.limit, ult: BW.GEN_LOAD_ULT_OF(CORE), verdict: st.verdict }) };
  }
  // 4. the flight: the flown pull to the limit
  const Vs = def.params.gen.Vs, pu = L.pull(k, { V: 2.6 * Vs, sgn: 1, probe: true, cert: true, toLimit: lim });
  out.pull = { nzMax: pu.nzMax, naMax: pu.naMax, peak: pu.peak, finite: pu.finite };
  // (4b) parked 10 s and in level flight 10 s with the certificate: nothing yields, no frame armed once settled
  // (the damage layer's quiet path - GATE DMGMEMBERS' parked check, on the certificate's limits)
  {
    let W = null, s3;
    if (sim.hydro) { W = C.makeWorld(); s3 = C.makeSim(def, W); s3.reset(0); C.placeAtAerodrome(s3, W.aerodromes.find(a => a.id === 'SEA')); }
    else { const F = L.flatWorld(0); s3 = C.makeSim(def, F.W); s3.reset(0); C.placeAtAerodrome(s3, Object.assign({}, F.strip, { elev: 0, spawnElev: 0 })); }
    for (let f = 0; f < 120; f++) s3.step(1 / 60);
    const a0 = s3.damage().armedN;
    for (let f = 0; f < 600; f++) s3.step(1 / 60);
    const X = s3.damage();
    out.parked = { yields: X.yields, breaks: X.breaks, armed0: a0, armed: X.armedN - a0, water: !!sim.hydro };
    const F2 = L.flatWorld(0), s4 = C.makeSim(def, F2.W); s4.reset(0);
    C.placeAtAerodrome(s4, Object.assign({}, F2.strip, { elev: 0, spawnElev: 300 }));
    const fx = Math.cos(F2.strip.hdg), fz = Math.sin(F2.strip.hdg), V = 1.6 * def.params.gen.Vs;
    for (let i = 0; i < s4.n; i++) { s4.v[i * 3] = V * fx; s4.v[i * 3 + 2] = V * fz; }
    s4.ctl.thr = 0.75;
    for (let f = 0; f < 120; f++) s4.step(1 / 60);
    const b0 = s4.damage().armedN;
    for (let f = 0; f < 600; f++) s4.step(1 / 60);
    const Y = s4.damage();
    out.cruise = { yields: Y.yields, armed: Y.armedN - b0 };
  }
  // 5. a bad design: the lift struts (or the wing's root members) built at HALF the section their certified load asks
  // for (each member's section x 0.5 x its certified break over its physics break, at most a third), certified as built
  {
    const bad = Object.assign({}, L.defOf(k, { cert: false }));
    const groups = bad.parts.dmg.groups, strut = groups.filter(G => /:strut$/.test(G.key)), root = groups.filter(G => /:root$/.test(G.key));
    const pick = new Set((strut.length ? strut : root).flatMap(G => G.t0));
    const cut = i => Math.min(1 / 3, 0.5 * B[i].fu / P[i].fu);
    bad.beams = bad.beams.map((b, i) => (pick.has(i) ? Object.assign({}, b, { A: b.A * cut(i) }) : b));
    out.badCut = [...pick].map(cut).reduce((a, x) => Math.min(a, x), 1);
    bad.spec = Object.assign({}, bad.spec, { meta: Object.assign({}, bad.spec.meta || {}, { badDesign: 'the ' + (strut.length ? 'lift struts' : 'wing root') + ' at half the section their certificate asks' }) });
    const floats = !!(bad.parts && bad.parts.floats);
    bad.cert = C.genCertify(bad, { world: floats ? L.core().makeWorld() : null });
    out.bad = Object.assign({ what: strut.length ? 'lift struts' : 'wing root', n: pick.size }, bench(bad, { ult }));
  }
  // 6. D1a's open questions: the drawn lift struts' compression (the strut groups' members), the stamp against Euler
  {
    const st = def.parts.dmg.groups.filter(G => /:strut$/.test(G.key)).flatMap(G => G.t0).filter(i => def.beams[i].vis !== false && !def.beams[i].tens);
    out.struts = st.slice(0, 4).map(i => ({ i, Fc: cert.Fc[i], fc0: B[i].fc0, physFc: P[i].fc0, cy: C.GEN_CRASH[B[i].mat] ? C.GEN_CRASH[B[i].mat].cy * B[i].A : null, by: cert.names[cert.byC[i]] }));
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const rep = msg => console.log('  REPORT  ' + msg);
const f2 = x => (x == null ? '-' : (+x).toFixed(2));
(async () => {
  const { spawn } = require('child_process');
  const keys = Object.keys(L.BUILDS), t0 = Date.now();
  const run = k => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1200) }); });
  });
  const R = {}; const q = keys.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + keys.length + ' builds)');
  const C = L.core(), K = C.GEN_CERT;
  console.log('the rules: kappa ' + K.kappa + ', m ' + K.m + ', a joint at 1.5 F_l m x ' + K.uFit + ', a member at 1.5 F_l m x ' + K.uMember + ', the first set at ' + K.yTol + ' x F_l, the controls\' cases x ' + K.dynCtl);
  for (const k of keys) {
    const r = R[k], lab = L.BUILDS[k].label;
    console.log(lab + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    const c = r.cert, lim = c.limit, ult = c.ult, bandTop = Math.max(1.5 * c.m * lim, r.band && r.band.destroy ? r.band.destroy.cap : 0), bandHi = bandTop * 1.025;
    console.log('1. the certificate (' + c.cases.length + ' cases: ' + c.cases.join(', ') + ')');
    yes(c.noEnv === 0 && c.stamped && c.overPhys === 0, c.withPhys + ' members certified (the gear\'s ' + c.gearN + ' apart), every one with an envelope, none past its physics; tension: ' + c.govT + ' on the certificate, ' + c.floorT + ' on the floor; compression: ' + c.govC + ' / ' + c.floorC);
    yes(c.gearSame && c.gearJ > 0, 'the gear\'s ' + c.gearN + ' members: its ' + c.gearJ + ' joints stamped by the gear bracket (DMG-D2b, GATE DMGGEAR), the rest (a float\'s hull) on D1a\'s limits');
    yes(c.offInf && c.buildNone, 'with the layer off nothing is stamped (every limit infinite, the stamp refused); a garage build carries no certificate');
    yes(c.cacheSame && c.cacheMs < 50, 'computed once per build (' + c.ms + ' ms in node: flight cases ' + f2(c.msParts.flight) + ', bench ' + f2(c.msParts.bench) + ', the dynamic ones ' + f2(c.msParts.drop) + '); a second build of the same spec takes it from the cache in ' + c.cacheMs + ' ms');
    console.log('2. the card on the bench (LIMIT ' + f2(lim) + ' g / ULTIMATE ' + f2(ult) + ' g)');
    yes(r.lim10.set === 0 && r.lim10.breaks === 0 && /HELD/.test(r.lim10.verdict), 'to the limit x 1.0 (' + f2(lim) + ' g): ' + r.lim10.verdict + ', no set');
    if (r.ductileWing) yes(r.lim12.set > 0 && r.lim12.breaks === 0, 'to the limit x 1.2 (' + f2(1.2 * lim) + ' g): ' + r.lim12.set + ' members set (the largest ' + (100 * r.lim12.setMax).toFixed(2) + ' %), nothing broken - the first set is just past the limit');
    else { yes(r.lim12.breaks === 0, 'to the limit x 1.2 (' + f2(1.2 * lim) + ' g): ' + r.lim12.set + ' set, nothing broken'); rep('a brittle wing (spruce, its joints fittings): no member of it can take a set - past its limit it holds until it breaks'); }
    yes(r.ult.breaks === 0 && /HELD/.test(r.ult.verdict), 'to the ultimate (' + f2(ult) + ' g): ' + r.ult.verdict + ', ' + r.ult.set + ' set, nothing broken');
    const bw = r.band && r.band.destroy;   // (the group that broke to destruction - not the weakest of ALL groups: a wing's joints need not all be in one)
    if (bw && bw.cap > 1.1 * ult * 1.025) yes(r.ult11.breaks === 0, 'to the ultimate x 1.1 (' + f2(1.1 * ult) + ' g): it holds, as its certificate says - the joint group that breaks on the bench (' + bw.key + ', governed by ' + bw.gov.join(' / ') + ') goes at ' + f2(bw.cap) + ' g (' + r.ult11.breaks + ' broken)');
    else yes(r.ult11.breaks > 0 && r.ult11.groups.length > 0 && r.ult11.fb && r.ult11.fb.seam, 'to the ultimate x 1.1 (' + f2(1.1 * ult) + ' g): it breaks (' + r.ult11.breaks + ' members), the first group ' + (r.ult11.groups[0] || 'none') + ', the first member a ' + (r.ult11.fb ? (r.ult11.fb.seam || 'plain ' + r.ult11.fb.cls + ' member') + ' (' + r.ult11.fb.tags + ', ' + r.ult11.fb.how + ')' : '-'));
    console.log('3. to destruction');
    const d = r.destroy;
    yes(d.brokeAt != null && d.brokeAt >= 1.5 * lim && d.brokeAt <= bandHi, 'BROKE AT ' + f2(d.brokeAt) + ' g (' + d.brokeKey + ', ' + d.brokeSeam + ') - within [' + f2(1.5 * lim) + ', ' + f2(bandTop) + '] g' + (r.band && r.band.destroy && r.band.destroy.cap > 1.5 * c.m * lim * (1 + 1e-9) ? ' (its group by its own certificate: ' + r.band.destroy.gov.join(' / ') + ' governs, ' + f2(r.band.destroy.cap) + ' g - not the bench case ' + f2(1.5 * c.m * lim) + ')' : '') + ' (+2.5 % for the ramp\'s lag); first set ' + f2(d.yieldAt) + ' g');
    yes(d.fb && (d.fb.seam || !d.fb.ductile), 'the first member broken: ' + (d.fb ? (d.fb.seam || 'a plain member') + ' (' + d.fb.cls + ' ' + d.fb.tags + ', ' + d.fb.mat + ', ' + d.fb.how + ')' : '-') + ' - a joint, never the middle of a ductile member');
    yes(r.worker.brokeAt != null && Math.abs(r.worker.brokeAt - d.brokeAt) < 1e-9 && r.worker.brokeKey === d.brokeKey, 'the page\'s bench thread (bench_worker.js benchLoadRun, the roll-out\'s certificate handed in) breaks it the same: the card reads "' + r.worker.line + '"');
    console.log('4. the flight');
    yes(r.pull.finite && r.pull.naMax >= lim && r.pull.peak.max < 1, 'the flown pull to the limit (the wing\'s load ' + f2(r.pull.naMax) + ' W, the CG reading ' + f2(r.pull.nzMax) + ' g): nothing yields; the worst member ' + f2(r.pull.peak.max) + ' of its certified limit');
    yes(r.parked.yields === 0 && r.parked.breaks === 0 && r.parked.armed === 0 && r.cruise.yields === 0 && r.cruise.armed === 0, 'parked 10 s ' + (r.parked.water ? 'on the water' : 'on its wheels') + ' and 10 s in the air (1.6 Vs, 0.75 throttle): nothing yields, no frame armed once settled' + (r.parked.armed0 ? ' (' + r.parked.armed0 + ' armed while it settled)' : '') + ' - the quiet path stays quiet on the certificate\'s limits');
    console.log('5. a bad design');
    yes(r.bad.breaks > 0 && /BROKE UP/.test(r.bad.verdict), 'the ' + r.bad.what + ' (' + r.bad.n + ' members) built at half the section their certificate asks (x ' + f2(r.badCut) + ' and less), certified as built: the bench ' + r.bad.verdict + ' (first broken at ' + f2(r.bad.breakAt) + ' g, under its ' + f2(ult) + ' g ultimate)');
    if (r.struts.length) rep('the drawn lift struts in compression: ' + r.struts.map(s => 'member ' + s.i + ' certified ' + (s.Fc / 1000).toFixed(1) + ' kN (' + s.by + ') -> crushes at ' + (s.fc0 / 1000).toFixed(1) + ' kN (physics ' + (s.physFc / 1000).toFixed(1) + ')').join('; '));
    if (k === 'jodel') rep('the Jodel\'s first member broken on the bench to destruction: ' + (d.fb ? (d.fb.seam || 'a plain member') + ' ' + d.fb.tags + ' (' + d.fb.mat + ', ' + d.fb.how + ')' : '-') + '; its first group ' + d.brokeKey);
  }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGCERT: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
