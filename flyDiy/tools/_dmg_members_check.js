#!/usr/bin/env node
// GATE DMGMEMBERS (G1810-G1817, DMG-D1a MEMBERS) - the members' own limits on top of TREE-CRASH's loop
// (DEFORM-AND-BREAK §4.0, §4.1, §4.4, §7.1, §7.2), on the user's validated builds, damage ON (params.damage true):
//   1. THE SEAMS (G1810): every member carries `seam` (null / fitting / rivet / bond / opening) and `grp`; a member
//      joining two parts is a fitting in a group
//   2. THE GROUPS ARE CLOSED SETS (G1815): the generator's assertion (61_gen_frame parts.dmg.issues) is empty, and in
//      the solver breaking ONE member of a group breaks exactly its group (the pair's own links with it) and no other;
//      breaking a pair's own link breaks nothing else
//   3. EULER (G1812): Fc = min(cy A, pi^2 E I / L^2) on the tube members (I of a thin tube of their A, D / wall 30): the
//      table, the reference 0.7 m 1" x 0.035" 4130 tube at ~0.75, and nothing else capped
//   4. THE SEAM RULES (G1811): fitting 1.15 x Fu brittle; rivet 0.7 x Fu, travel <= 2 %; bond 0.6-0.8 x Fu brittle,
//      seeded (two sims of a build the same, the scatter spread); opening Fu / Kt, Kt 1.5-2
//   5. WOOD'S RAGGED BREAK (G1814): spruce's tension strength +-15 % (seeded); on the bench to destruction a spruce
//      member that lets go cracks to 60 % (and 30 %) first: 2-3 stages, over milliseconds
//   6. THE KINK FLOOR (G1813): after a 30 m/s crash a kinked member's ends never come closer than half its crushed
//      length (its floor pushes), and nothing is non-finite
//   7. PARKED, NOTHING (§11.2): 10 s at rest on the wheels (the floats on the water): no yield, no frame armed
//   8. THE BREAK ORDER (G1816, §7.2): the bench to destruction (the garage's rig, damage on, the bags ramped to 60 g),
//      and TREECRASH's wing / centreline trunk flights at 30 m/s: the FIRST GROUP to break is a fitting's; the first
//      MEMBER to break is a fitting, a seam, or one folded round the trunk - never a ductile member broken by load
//      (anything else is printed REPORT, with where it is)
// Run: node tools/_dmg_members_check.js   (one final `GATE DMGMEMBERS: PASS|FAIL`; the builds in parallel children)
'use strict';
const path = require('path');
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js');

const SEAMS = [null, 'fitting', 'rivet', 'bond', 'opening'];
// the bench to destruction: the garage's rig, the bags ramped at twice its own rate to `ult`; stops 0.5 s after the
// first group has let go
function destroy(k) {
  const C = L.core(), def = L.defOf(k), spec = def.spec, sim = C.makeSim(def, null); sim.reset(0);
  const ULT = 60;
  const rig = C.makeLoadTest(sim, def, { material: spec.fuselage && spec.fuselage.material, wingMaterial: C.genSurfKey(spec, 'wing', 0), surface: 'wing', ult: ULT, rampS: ULT / 5.7 * 2 });
  let fb = null, nAtB = null, g0 = null, nAtG = null, yAt = null;
  for (let f = 0; f < 60 * 60 && !rig.state.done; f++) {
    rig.step(1 / 60);
    const D = sim.damage();
    if (yAt == null && D.yields) yAt = rig.state.n;
    if (!fb && D.firstBreak) { fb = D.firstBreak; nAtB = rig.state.n; }
    if (!g0 && D.groups.length) { g0 = D.groups[0]; nAtG = rig.state.n; }
    if (g0 && sim.t - g0.t > 0.5) break;
  }
  const D = sim.damage(), b = fb ? sim.beams[fb.beam] : null;
  // the spruce members' stages: crack (60 %), [30 %], gone - their times
  const st = {}; for (let i = 0; i < D.rag.length; i += 3) (st[D.rag[i]] = st[D.rag[i]] || []).push([D.rag[i + 1], D.rag[i + 2]]);
  const rag = Object.keys(st).map(bi => ({ bi: +bi, n: sim.beams[bi].rgN, st: st[bi] })).filter(r => r.st.length && r.st[r.st.length - 1][0] >= r.n);
  return { yAt, fb: fb && { cls: fb.cls, seam: fb.seam, how: fb.how, mat: b.mat, ductile: b.etu > 0, tags: def.nodes[b.a].tag + '-' + def.nodes[b.b].tag, z: [def.nodes[b.a].p[2], def.nodes[b.b].p[2]], t1: (def.parts.dmg.groups.some(G => G.t1.includes(fb.beam))) },
    nAtB, g0: g0 && { key: g0.key, seam: g0.seam, cls: g0.cls }, nAtG, breaks: D.breaks, groups: D.groups.map(G => G.key), cracks: D.cracks, floors: D.floors,
    rag: rag.map(r => ({ n: r.n, stages: r.st.length, ms: 1000 * (r.st[r.st.length - 1][1] - r.st[0][1]) })), finite: L.finite(sim) };
}

if (argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k };
  const def = L.defOf(k), D = def.parts.dmg, sim = C.makeSim(def, null); sim.reset(0);
  const B = sim.beams;
  // 1. the seams
  const cnt = {}; let bad = 0;
  B.forEach(b => { if (!SEAMS.includes(b.seam) || typeof b.grp !== 'number') bad++; const kk = (b.seam || '-') + ':' + b.cls; cnt[kk] = (cnt[kk] || 0) + 1; });
  out.seams = { n: B.length, bad, cnt, fitNoGrp: B.filter(b => b.seam === 'fitting' && b.grp < 0).length, grpNoFit: B.filter(b => b.grp >= 0 && b.seam !== 'fitting').length };
  // 2. the groups, closed: the generator's assertion, then the solver's
  out.groups = D.groups.map(G => ({ key: G.key, t0: G.t0.length, t1: G.t1.length }));
  out.issues = D.issues;
  out.closed = D.groups.map(G => {
    sim.reset(0); sim.damageBreak(G.t0[0]);
    const X = sim.damage(), want = new Set(G.t0.concat(G.t1)), got = new Set(X.broken);
    return { key: G.key, ok: X.groups.length === 1 && got.size === want.size && [...want].every(i => got.has(i)), broke: got.size, want: want.size, chained: X.groups.length - 1 };
  });
  const links = [...new Set(D.groups.flatMap(G => G.t1))];
  out.links = links.map(bi => { sim.reset(0); sim.damageBreak(bi); const X = sim.damage(); return X.broken.length === 1 && X.groups.length === 0; });
  sim.reset(0);
  // 3. Euler: the table by class, and which members it caps
  const eu = {}; let capOff = 0;
  B.forEach(b => {
    const R = C.GEN_CRASH[b.mat]; if (!R || !(b.A > 0) || b.tens) return;
    const r = b.fc0 / (R.cy * b.A), tube = b.cls === 'cabane' || b.cls === 'interplane' || (b.cls === 'fus' && (b.mat === 'tubeFabric' || b.mat === 'aluTube'));
    if (r < 0.9999 && !tube) capOff++;
    const key = b.cls + ' ' + b.mat + (tube ? ' (tube)' : '');
    const e = eu[key] || (eu[key] = { n: 0, capped: 0, Lmin: 1e9, Lmax: 0, rmin: 1, rs: [] });
    e.n++; if (r < 0.9999) e.capped++; e.Lmin = Math.min(e.Lmin, b.Lr); e.Lmax = Math.max(e.Lmax, b.Lr); e.rmin = Math.min(e.rmin, r); e.rs.push(r);
  });
  for (const e of Object.values(eu)) { e.rs.sort((a, b) => a - b); e.rmed = e.rs[e.rs.length >> 1]; delete e.rs; }
  out.euler = { tab: eu, capOff };
  // 4. the seam rules, against the member's physics (GEN_CRASH x A)
  const rule = { fitting: [], rivet: [], bond: [], opening: [] }, travel = { rivet: 0, opening: 0 };
  B.forEach(b => { if (!b.seam) return; const R = C.GEN_CRASH[b.mat]; if (!R) return; const fu = R.tu * b.A;
    rule[b.seam].push(b.fu / fu);
    if (b.seam === 'fitting' && !(Math.abs(b.fy0 - b.fu) < 1e-6 * b.fu && b.etu === 0)) rule.fitBad = (rule.fitBad || 0) + 1;
    if (b.seam === 'bond' && !(b.fy0 === b.fu && b.etu === 0)) rule.bondBad = (rule.bondBad || 0) + 1;
    if (b.seam in travel) travel[b.seam] = Math.max(travel[b.seam], b.etu); });
  // (a spruce opening takes its +-15 % on top of its Kt)
  out.openWood = B.some(b => b.seam === 'opening' && b.rgN > 0);
  const rng = a => a.length ? [Math.min(...a), Math.max(...a)] : null;
  out.rules = { fitting: rng(rule.fitting), rivet: rng(rule.rivet), bond: rng(rule.bond), opening: rng(rule.opening), fitBad: rule.fitBad || 0, bondBad: rule.bondBad || 0, travel };
  const sim2 = C.makeSim(L.defOf(k), null); sim2.reset(0);
  out.seeded = B.every((b, i) => b.fy0 === sim2.beams[i].fy0 && b.fu === sim2.beams[i].fu && b.rgN === sim2.beams[i].rgN);
  // 5. spruce: the scatter and the stage counts
  const wood = B.filter(b => b.rgN > 0 && b.seam !== 'opening');
  out.wood = { n: wood.length, sc: rng(wood.map(b => b.fy0 / (C.GEN_CRASH.wood.ty * b.A))), n2: wood.filter(b => b.rgN === 2).length, n3: wood.filter(b => b.rgN === 3).length };
  // 7. parked: 10 s at rest
  {
    let W = null, s3;
    const pr = C.makeSim(def, null);
    if (pr.hydro) { W = C.makeWorld(); s3 = C.makeSim(def, W); s3.reset(0); C.placeAtAerodrome(s3, W.aerodromes.find(a => a.id === 'SEA')); }
    else { const F = L.flatWorld(0); s3 = C.makeSim(def, F.W); s3.reset(0); C.placeAtAerodrome(s3, Object.assign({}, F.strip, { elev: 0, spawnElev: 0 })); }
    for (let f = 0; f < 120; f++) s3.step(1 / 60);
    const a0 = s3.damage().armedN;
    for (let f = 0; f < 600; f++) s3.step(1 / 60);
    const X = s3.damage();
    out.parked = { yields: X.yields, breaks: X.breaks, armed0: a0, armed: X.armedN - a0, water: !!pr.hydro };
  }
  // 8. the break order: the bench to destruction, and the trunk flights (the land builds)
  out.bench = destroy(k);
  if (!/floats/i.test(k)) {
    out.trunk = [0, 2.5].map(off => { const r = L.atTrunk(k, { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off }), s = L.lastRun.sim, X = s.damage(), fb = X.firstBreak, b = fb ? s.beams[fb.beam] : null;
      // 6. the kink floors: how close each kinked member's ends came, from its crushed length on
      let fl = Infinity;
      for (const bi of X.broken) { const m = s.beams[bi]; if (!m.kink) continue; const a3 = m.a * 3, b3 = m.b * 3; fl = Math.min(fl, Math.hypot(s.p[b3] - s.p[a3], s.p[b3 + 1] - s.p[a3 + 1], s.p[b3 + 2] - s.p[a3 + 2]) / m.Lf); }
      return { off, crashed: X.crashed, finite: r.finite, fb: fb && { cls: fb.cls, seam: fb.seam, how: fb.how, mat: b.mat, ductile: b.etu > 0 }, g0: X.groups[0] ? { key: X.groups[0].key, seam: X.groups[0].seam } : null,
        groups: X.groups.map(G => G.key), breaks: X.breaks, floors: X.floors, floorMin: fl, cracks: X.cracks }; });
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const f2 = x => (x == null ? '-' : (+x).toFixed(2)), rg = a => (a ? f2(a[0]) + '-' + f2(a[1]) : '-');
(async () => {
  const { spawn } = require('child_process');
  const keys = Object.keys(L.BUILDS), t0 = Date.now();
  const run = k => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-800) }); });
  });
  const R = {}, q = keys.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + keys.length + ' builds)');
  // the reference tube (§4.1): 0.7 m of 1" x 0.035" 4130, as the solver reads a member of its area
  {
    const C = L.core(), A = Math.PI * 0.0254 * 0.000889 - Math.PI * 0.000889 * 0.000889, D2 = C.GEN_CRASH_TUBE_DT * A / Math.PI;
    const r = Math.PI * Math.PI * C.GEN_MATERIALS.tubeFabric.phys.E * (A * D2 / 8) / (0.7 * 0.7) / (C.GEN_CRASH.tubeFabric.cy * A);
    console.log('the reference: 0.7 m of 1" x 0.035" 4130 buckles at ' + f2(r) + ' of its crush force');
    yes(r > 0.6 && r < 0.9, 'Euler on the reference tube: ' + f2(r) + ' (DEFORM-AND-BREAK §4.0: ~0.7)');
  }
  for (const k of keys) {
    const r = R[k], lab = L.BUILDS[k].label;
    console.log(lab + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    console.log('1. the seams (G1810)');
    yes(r.seams.bad === 0 && r.seams.fitNoGrp === 0 && r.seams.grpNoFit === 0, r.seams.n + ' members, each with its seam and group: ' + Object.entries(r.seams.cnt).filter(([kk]) => kk[0] !== '-').map(([kk, v]) => v + ' ' + kk).join(', '));
    console.log('2. the break groups are closed sets (G1815)');
    yes(r.issues.length === 0, r.groups.length + ' groups (' + r.groups.map(G => G.key + ' ' + G.t0 + (G.t1 ? '+' + G.t1 : '')).join(', ') + '); the generator\'s assertion: ' + (r.issues.length ? r.issues.join('; ') : 'clean'));
    const nc = r.closed.filter(c => !c.ok);
    yes(nc.length === 0, 'one member of each group broken in the solver breaks exactly its group' + (nc.length ? ': ' + nc.map(c => c.key + ' ' + c.broke + '/' + c.want + (c.chained ? ' +' + c.chained + ' chained' : '')).join(', ') : ''));
    yes(r.links.every(Boolean), 'a pair\'s own link broken alone breaks nothing else (' + r.links.length + ' links)');
    console.log('3. Euler (G1812): Fc / (cy A) by class (L range; the smallest, the median; members capped)');
    for (const [kk, e] of Object.entries(r.euler.tab)) console.log('        ' + kk.padEnd(28) + String(e.n).padStart(4) + '  L ' + f2(e.Lmin) + '-' + f2(e.Lmax) + ' m  ' + f2(e.rmin) + ' / ' + f2(e.rmed) + '  capped ' + e.capped);
    yes(r.euler.capOff === 0, 'Euler caps the tube members only (the truss, the bearer, the cabane and interplane struts)');
    console.log('4. the seam rules (G1811): Fu over the member\'s physics Fu');
    const ru = r.rules;
    yes((!ru.fitting || (Math.abs(ru.fitting[0] - 1.15) < 1e-9 && Math.abs(ru.fitting[1] - 1.15) < 1e-9)) && !ru.fitBad, 'fittings ' + rg(ru.fitting) + ', brittle (no set)');
    yes(!ru.rivet || (Math.abs(ru.rivet[0] - 0.7) < 1e-9 && Math.abs(ru.rivet[1] - 0.7) < 1e-9 && ru.travel.rivet <= 0.02), 'rivet lines ' + rg(ru.rivet) + ', travel ' + (100 * ru.travel.rivet).toFixed(1) + ' %');
    yes(!ru.bond || (ru.bond[0] >= 0.6 && ru.bond[1] <= 0.8 && ru.bond[1] - ru.bond[0] > 0.1 && !ru.bondBad), 'glue lines ' + rg(ru.bond) + ' (seeded), brittle');
    const sw = r.openWood ? 0.15 : 0;
    yes(!ru.opening || (ru.opening[0] >= 0.5 * (1 - sw) - 1e-9 && ru.opening[1] <= (1 + sw) / 1.5 + 1e-9), 'openings ' + rg(ru.opening) + ' (Kt 1.5-2' + (sw ? '; spruce, its +-15 % on top' : '') + ')');
    yes(r.seeded, 'the scatter is the build\'s own: a second sim of it stamps the same limits');
    console.log('5. spruce (G1814)');
    yes(!r.wood.n || (r.wood.sc[0] >= 0.85 - 1e-9 && r.wood.sc[1] <= 1.15 + 1e-9 && r.wood.sc[1] - r.wood.sc[0] > 0.2 && r.wood.n2 && r.wood.n3), r.wood.n + ' spruce members: tension strength x ' + rg(r.wood.sc) + ', ' + r.wood.n2 + ' break in 2 stages, ' + r.wood.n3 + ' in 3');
    const rag = r.bench.rag;
    if (rag.length) {
      const ms = rag.map(x => x.ms).sort((a, b) => a - b);
      yes(rag.every(x => x.stages === x.n && x.ms > 0), 'on the bench to destruction ' + rag.length + ' spruce members let go in ' + rag.map(x => x.stages).join('/') + ' stages, crack to gone in ' + f2(ms[0]) + '-' + f2(ms[ms.length - 1]) + ' ms (median ' + f2(ms[ms.length >> 1]) + ')');
    }
    console.log('7. parked 10 s (damage on)');
    yes(r.parked.yields === 0 && r.parked.breaks === 0 && r.parked.armed === 0, 'nothing yields, nothing breaks; once settled (2 s) no frame armed in 10 s'
      + (r.parked.armed0 ? ' (' + r.parked.armed0 + ' armed while it settled' + (r.parked.water ? ' onto the water: the water\'s own arm, G1479' : '') + ')' : ''));
    console.log('8. the break order (G1816)');
    const bo = r.bench, fbOk = fb => fb && (fb.seam || fb.how === 'fold' || !fb.ductile);
    const fbTxt = fb => fb ? fb.cls + ' ' + fb.mat + (fb.seam ? ' ' + fb.seam : ' (no seam)') + ' (' + fb.how + ')' : 'none';
    yes(bo.finite && bo.g0 && bo.g0.seam === 'fitting' && fbOk(bo.fb),
      'the bench to destruction: first yield at ' + f2(bo.yAt) + ' g; the first member broken at ' + f2(bo.nAtB) + ' g: ' + fbTxt(bo.fb) + ' ' + (bo.fb ? bo.fb.tags : '') + '; the first GROUP at ' + f2(bo.nAtG) + ' g: ' + (bo.g0 ? bo.g0.key : 'none') + '; ' + bo.breaks + ' broken, groups ' + bo.groups.join(', '));
    if (bo.fb && !bo.fb.seam) console.log('  REPORT  the bench\'s first member is not a fitting or a seam: ' + fbTxt(bo.fb) + ' ' + bo.fb.tags + ' at z ' + bo.fb.z.map(f2).join(' / ') + (bo.fb.t1 ? ' (a pair\'s own link: the carry-through)' : '') + ' - ' + (bo.fb.ductile ? 'DUCTILE' : 'brittle') + '; the lattice\'s spar has one section root to tip (DMG-D2\'s per-member envelope)');
    for (const t of r.trunk || []) {
      yes(t.finite && t.crashed && (!t.g0 || t.g0.seam === 'fitting') && fbOk(t.fb),
        (t.off ? 'the wing ' + t.off + ' m out' : 'the centreline') + ' at 30 m/s: the first member ' + fbTxt(t.fb) + '; the first group ' + (t.g0 ? t.g0.key : 'none') + '; ' + t.breaks + ' broken, groups ' + (t.groups.join(', ') || '-'));
      if (t.floors) yes(t.floorMin >= 0.5, '  6. the kink floor: ' + t.floors + ' kinked members, their ends at least ' + f2(t.floorMin) + ' of their crushed length apart at the end');
    }
  }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGMEMBERS: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
