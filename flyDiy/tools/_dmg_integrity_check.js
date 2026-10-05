#!/usr/bin/env node
// GATE DMGINTEGRITY (G1820-G1823, DMG-D1b WRECK INTEGRITY) - a wreck stays one honest set of pieces (DEFORM-AND-BREAK
// §4.5, §4.6, §8.1), on the user's validated builds, damage ON (params.damage true):
//   1. THE STRIP COMPONENT TEST (G1820): the strips the aero pass flies never straddle two pieces. Intact: one piece,
//      every strip live. Every member a strip's nodes hold, broken ALONE (not a group's): the strip flies on unless its
//      nodes parted (TREE-CRASH's any-break kill silenced it - counted). Every group broken alone, then all of them: no
//      live strip on two pieces, and a part that came off keeps its own strips. In the crash runs (the 30 m/s trunk
//      flights, the severe nose-ins on the ground and the water): after EVERY frame with a new break, no live strip on
//      two pieces (the gate's own union-find against the solver's). The split itself on a V-tail Cub (its tail strips
//      read the body axes, so a parted one is split, not dropped): renormalised onto the core, the 70 % rule
//   2. THE REFS-CORE (G1821): every ref node (noseFrame, tailMid, upLo, upHi) is on the body; with every group broken at
//      once the refs are one piece holding the body's nodes only - one group-free core; no group alone breaks it up; a
//      fuselage cut across behind the cabin BREAKS UP (crashed, over at once, 'broke up: ...'); which crash runs did
//   3. SUPPORT LIMITERS (G1822): only with the damage layer on (and never members: the build's own either way); slack - not one
//      closes - in the load test to 5.7 g, a flown 3.8 g pull and FAR 23.473's drop; THE PASS-THROUGH they were put in
//      for - the nose engine through the firewall in a severe ground nose-in (180 km/h, 10 m/s, 60 deg) - present
//      without them and gone with them (the pass-through probe, _dmg_integrity_lib.js); every number finite. What the
//      probe still sees elsewhere is printed REPORT (not a limiter's case: a detached part or a folded panel, §8.2)
//   4. THE COST: the union-find a break event costs (us), against the beams it walks
// Run: node tools/_dmg_integrity_check.js   (one final `GATE DMGINTEGRITY: PASS|FAIL`; the builds in parallel children)
'use strict';
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js'), I = require('./_dmg_integrity_lib.js');

const SEVERE = { V: 50, sink: 10, pitch: 60, secs: 4 };                   // GATE TREECRASH's severe nose-in, on the ground
const WATER_SEVERE = { V: 150 / 3.6, sink: 10, pitch: 60, secs: 4 };      // its severe float nose-in
// a run checked after every frame with a new break; the strips at the end against the old rule
function watched(run, def0) {
  let sim = null, def = def0, nb = -1, frames = 0, bad = 0, firstBad = null;
  const r = run({ onStart: (s, d) => { sim = s; def = d; nb = 0; }, onFrame: s => {
    const D = s.damage(); if (D.breaks === nb) return; nb = D.breaks; frames++;
    const sp = I.spanning(s); if (sp.length) { bad++; if (!firstBad) firstBad = { t: s.t, strips: sp }; } } });
  sim = sim || r.sim; const D = sim.damage(), S = sim.damageStrips(), dead = S.dead.reduce((a, x) => a + x, 0);
  return { frames, bad, firstBad, breaks: D.breaks, groups: D.groups.map(G => G.key), dead, old: I.oldRule(sim, def).size, split: D.stripsSplit, dropped: D.stripsDropped,
    brokeUp: D.brokeUp, crashed: D.crashed, reason: D.reason, over: D.over, finite: L.finite(sim) };
}

if (argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k }, land = !/floats/i.test(k);
  const def = L.defOf(k), sim = C.makeSim(def, null); sim.reset(0);
  const nb0 = def.beams.length, B = sim.beams, G = def.parts.dmg.groups, PRT = def.parts.dmg.part;
  // ---- 1. the component test ----
  { const f = I.pieces(sim), r = f(0); let one = true; for (let i = 0; i < sim.n; i++) if (f(i) !== r) one = false;
    out.intact = { one, live: sim.damageStrips().dead.every(x => !x), span: I.spanning(sim).length, strips: def.strips.length }; }
  const inGrp = new Set(G.flatMap(g => g.t0.concat(g.t1)));
  const sets = def.strips.map(st => { const N = new Set(st.w.map(w => w[0])); for (const kk of ['fIn', 'fOut', 'rIn', 'rOut']) if (st[kk] != null) N.add(st[kk]); return N; });
  const single = { members: 0, oldKilled: 0, newKilled: 0, parted: 0, span: 0, keptLive: 0 };
  for (let bi = 0; bi < nb0; bi++) {
    if (inGrp.has(bi)) continue;
    const b = B[bi], held = []; sets.forEach((N, si) => { if (N.has(b.a) && N.has(b.b)) held.push(si); });
    if (!held.length) continue;
    sim.reset(0); sim.damageBreak(bi); single.members++;
    const S = sim.damageStrips(), f = I.pieces(sim);
    single.oldKilled += held.length; const nk = held.filter(si => S.dead[si]).length; single.newKilled += nk; single.keptLive += held.length - nk;
    if (f(b.a) !== f(b.b)) single.parted++;
    // a strip it held dies only where its nodes parted
    for (const si of held) if (S.dead[si] && [...sets[si]].every(i => f(i) === f(b.a))) single.span++;   // (dead with its nodes whole: wrong)
    single.span += I.spanning(sim).length;
  }
  out.single = single;
  out.groups = G.map(g => { sim.reset(0); sim.damageBreak(g.t0[0]); const D = sim.damage();
    return { key: g.key, span: I.spanning(sim).length, split: D.stripsSplit, dropped: D.stripsDropped, old: I.oldRule(sim, def).size, brokeUp: !!D.brokeUp }; });
  // every group at once: the parts off keep their own strips (a strip all of whose nodes are on one detached part flies)
  { sim.reset(0); for (const g of G) sim.damageBreak(g.t0[0]);
    const D = sim.damage(), S = sim.damageStrips(), f = I.pieces(sim), core = f(def.refs.noseFrame[0]);
    let offLive = 0, offAll = 0;
    S.w.forEach((w, si) => { const r = f(def.strips[si].w[0][0]); if (r === core) return; if (def.strips[si].w.every(([i]) => f(i) === r)) { offAll++; if (!S.dead[si]) offLive++; } });
    const refRoots = new Set([].concat(def.refs.noseFrame, def.refs.tailMid, def.refs.upLo, def.refs.upHi).map(f));
    let coreNodes = 0, coreOther = []; for (let i = 0; i < sim.n; i++) if (f(i) === core) { coreNodes++; if (PRT[i] !== 'body') coreOther.push(PRT[i] + ':' + def.nodes[i].tag); }
    out.allGroups = { span: I.spanning(sim).length, offAll, offLive, brokeUp: !!D.brokeUp, refPieces: refRoots.size, coreNodes, coreOther };
  }
  // ---- 2. the refs-core ----
  const refs = [...new Set([].concat(def.refs.noseFrame, def.refs.tailMid, def.refs.upLo, def.refs.upHi))];
  out.refs = { n: refs.length, onBody: refs.every(i => PRT[i] === 'body'), tags: refs.map(i => def.nodes[i].tag) };
  // a fuselage cut across: every live member with an end on ring <= j and one behind it (or the tail post), j the middle ring
  { const ring = i => { const m = /^S(\d+)[BT][LR]$/.exec(def.nodes[i].tag || ''); return m ? +m[1] : /^TP/.test(def.nodes[i].tag || '') ? 99 : -1; };
    const nR = Math.max(...def.nodes.map((_, i) => ring(i)).filter(x => x < 99)), j = Math.floor(nR / 2);
    sim.reset(0); let cut = 0;
    for (let bi = 0; bi < nb0; bi++) { const b = B[bi], ra = ring(b.a), rb = ring(b.b); if (ra < 0 || rb < 0) continue; if ((ra <= j) !== (rb <= j)) { sim.damageBreak(bi); cut++; } }
    const D = sim.damage();
    out.cut = { ring: j, cut, brokeUp: D.brokeUp, crashed: D.crashed, over: D.over, reason: D.reason, span: I.spanning(sim).length };
  }
  // ---- 3. SUPPORT ----
  { const off = C.makeSim(L.defOf(k, { elastic: true }), null); off.reset(0);
    const SP = sim.damageSupp();
    out.supp = { n: SP.length, offN: off.damageSupp().length, beams: B.length, offBeams: off.beams.length, nb0, data: (def.parts.dmg.supp || []).length, paths: [...new Set(SP.map(b => b.path))] }; }
  const slack = s => { let r = Infinity; for (const b of s.damageSupp()) { const p = s.p, Lc = Math.hypot(p[b.b*3]-p[b.a*3], p[b.b*3+1]-p[b.a*3+1], p[b.b*3+2]-p[b.a*3+2]); r = Math.min(r, Lc / b.L0); } return r; };
  const watchSlack = () => { let m = Infinity; return { onFrame: s => { m = Math.min(m, slack(s)); }, get m() { return m; } }; };
  if (out.supp.n) {
    const lt = watchSlack(); { const sm = C.makeSim(L.defOf(k), null); sm.reset(0); const spec = def.spec;
      const rig = C.makeLoadTest(sm, def, { material: spec.fuselage && spec.fuselage.material, wingMaterial: C.genSurfKey(spec, 'wing', 0), surface: 'wing' });
      for (let f = 0; f < 60 * 40 && !rig.state.done; f++) { rig.step(1 / 60); lt.onFrame(sm); }
      out.slackLoad = { m: lt.m, verdict: rig.state.verdict, yields: sm.damage().yields }; }
    const pu = watchSlack(); const P1 = L.pull(k, { V: 2.6 * def.params.gen.Vs, sgn: 1, onFrame: pu.onFrame }); out.slackPull = { m: pu.m, nz: P1.nzMax };
    const dr = watchSlack(); const D1 = L.hardLanding(k, { sink: L.far473(k), onFrame: dr.onFrame }); out.slackDrop = { m: dr.m, nz: D1.gMax, yields: D1.dmg.yields };
  }
  // the pass-through: a severe nose-in without the limiters and with them
  const nose = dd => { let pr = null;
    const r = I.groundCase(k, Object.assign({}, SEVERE, { def: dd, onStart: (s, d) => { pr = I.makeProbe(s, d); }, onFrame: s => pr.frame(s.t) }));
    const R = pr.res(); return { eng: R.filter(x => /^eng/.test(x.part)).map(x => ({ tag: x.tag, bay: x.bay, d: x.d, t: x.t, att: x.att })), other: R.filter(x => !/^eng/.test(x.part)).slice(0, 6).map(x => ({ part: x.part, tag: x.tag, node: x.node, bay: x.bay, d: x.d, t: x.t, att: x.att })),
      dmg: { breaks: r.dmg.breaks, crashed: r.dmg.crashed, reason: r.dmg.reason }, finite: r.finite }; };
  if (land) { out.noseBefore = nose(I.noSupp(L.defOf(k))); out.noseAfter = nose(L.defOf(k)); }
  // ---- the crash runs, watched after every break ----
  out.runs = [];
  if (land) {
    for (const off of [0, 2.5]) out.runs.push(Object.assign({ lab: 'a trunk at 30 m/s, ' + (off ? 'the wing ' + off + ' m out' : 'the centreline') },
      watched(o => L.atTrunk(k, Object.assign({ D: 40, agl: 4, V: 30, thr: 0, secs: 5, off }, o)), def)));
    out.runs.push(Object.assign({ lab: 'a severe nose-in on the ground (180 km/h, 10 m/s, 60 deg)' }, watched(o => I.groundCase(k, Object.assign({}, SEVERE, o)), def)));
  } else out.runs.push(Object.assign({ lab: 'a severe float nose-in (150 km/h, 10 m/s, 60 deg)' }, watched(o => L.waterCase(k, Object.assign({}, WATER_SEVERE, o)), def)));
  // ---- 4. the cost of a break event: the group's breaks + the union-find + the strips, the mean of 1000 events after
  // 300 to warm the JIT (a group broken, reset between) ----
  { const g = G[0]; let t = 0; const N = 1000; for (let q = 0; q < N + 300; q++) { sim.reset(0); const t0 = process.hrtime.bigint(); sim.damageBreak(g.t0[0]); if (q >= 300) t += Number(process.hrtime.bigint() - t0); }
    out.cost = { us: t / N / 1000, beams: B.length, nodes: sim.n, strips: def.strips.length, members: g.t0.length + g.t1.length }; }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// the V-tail Cub: tail strips that read the body axes - the split path
if (argv[0] === '--vtail') {
  const C = L.core(), fs = require('fs'), path = require('path');
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', L.BUILDS.cub.build), 'utf8')), spec = j.spec || j;
  spec.tail = Object.assign({}, spec.tail, { type: 'v', vAngle: 35 });
  const d0 = C.buildGen(C.genMigrateSpec(spec)), def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage: true }) });
  const sim = C.makeSim(def, null); sim.reset(0);
  const keys = ['stab:attach', 'tw:gear'], G = def.parts.dmg.groups.filter(g => keys.includes(g.key));
  for (const g of G) sim.damageBreak(g.t0[0]);
  const S = sim.damageStrips(), f = I.pieces(sim), core = f(def.refs.noseFrame[0]), D = sim.damage();
  const tail = def.strips.map((st, si) => ({ si, st })).filter(x => x.st.fIn == null);
  const out = { groups: D.groups.map(g => g.key), split: D.stripsSplit, dropped: D.stripsDropped, span: I.spanning(sim).length,
    strips: tail.map(({ si, st }) => { const keep = st.w.filter(([i]) => f(i) === core).reduce((a, [, w]) => a + w, 0), tot = st.w.reduce((a, [, w]) => a + w, 0);
      return { si, keep: keep / tot, dead: !!S.dead[si], sum: S.w[si].reduce((a, [, w]) => a + w, 0), onCore: S.w[si].every(([i]) => f(i) === core), split: S.w[si] !== st.w }; }) };
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const f2 = x => (x == null || !isFinite(x) ? String(x) : x.toFixed(2));
(async () => {
  const { spawn } = require('child_process');
  const keys = Object.keys(L.BUILDS), t0 = Date.now();
  const run = (args, k) => new Promise(res => {
    const c = spawn(process.execPath, [__filename, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-800) }); });
  });
  const R = {}; const q = keys.map(k => ['--build', k]).concat([['--vtail']]);
  const jobs = Math.max(1, Math.min(3, +(process.env.GATES_JOBS_INNER || 3)));
  await Promise.all(Array.from({ length: jobs }, async () => { while (q.length) { const a = q.shift(); R[a[1] || 'vtail'] = await run(a, a[1] || 'vtail'); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + keys.length + ' builds + the V-tail Cub)');
  const runsUp = [];
  for (const k of keys) {
    const r = R[k], lab = L.BUILDS[k].label;
    console.log(lab + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    console.log('1. the strip component test (G1820)');
    yes(r.intact.one && r.intact.live && r.intact.span === 0, 'intact: one piece, all ' + r.intact.strips + ' strips live, none on two pieces');
    const s = r.single;
    yes(s.span === 0 && s.members > 0, s.members + ' members a strip holds, each broken alone (no group): ' + s.keptLive + ' of the ' + s.oldKilled + ' strips TREE-CRASH\'s any-break kill silenced fly on, ' + s.newKilled + ' dropped (' + s.parted + ' breaks parted their nodes); never a strip dead with its nodes whole, never one on two pieces');
    yes(r.groups.every(g => g.span === 0 && !g.brokeUp), 'each of the ' + r.groups.length + ' groups broken alone: no strip on two pieces, no break-up (' + r.groups.map(g => g.key + ' ' + g.dropped + (g.split ? '+' + g.split + 's' : '') + '/' + g.old).join(', ') + ' dropped / the old rule\'s)');
    yes(r.allGroups.span === 0 && r.allGroups.offLive === r.allGroups.offAll, 'every group broken: no strip on two pieces; the parts off keep their own strips (' + r.allGroups.offLive + ' / ' + r.allGroups.offAll + ' live)');
    for (const w of r.runs) {
      yes(w.bad === 0 && w.finite, w.lab + ': after each of the ' + w.frames + ' frames with a new break, no live strip on two pieces' + (w.firstBad ? ' (first at ' + f2(w.firstBad.t) + ' s: ' + w.firstBad.strips.join(',') + ')' : '') + '; ' + w.breaks + ' broken, ' + w.dead + ' strips dropped (the old rule: ' + w.old + '), ' + w.split + ' split; ' + (w.crashed ? 'CRASHED (' + w.reason + ')' : 'no crash'));
      if (w.brokeUp) runsUp.push(lab + ', ' + w.lab + ': at ' + f2(w.brokeUp.t) + ' s (' + w.brokeUp.tag + ')');
    }
    console.log('2. the refs-core (G1821)');
    yes(r.refs.onBody && r.allGroups.refPieces === 1 && r.allGroups.coreOther.length === 0 && !r.allGroups.brokeUp,
      'the ' + r.refs.n + ' ref nodes (' + r.refs.tags.join(' ') + ') on the body; every group broken at once: the refs one piece, a core of ' + r.allGroups.coreNodes + ' body nodes and nothing of a group\'s part' + (r.allGroups.coreOther.length ? ' - ' + r.allGroups.coreOther.join(' ') : ''));
    yes(r.cut.brokeUp && r.cut.crashed && r.cut.over && /^broke up/.test(r.cut.reason) && r.cut.span === 0, 'the fuselage cut across behind ring ' + r.cut.ring + ' (' + r.cut.cut + ' members): ' + (r.cut.brokeUp ? 'BROKE UP (' + r.cut.reason + '), the flight over at once' : 'no break-up'));
    console.log('3. SUPPORT limiters (G1822)');
    yes(r.supp.offN === 0 && r.supp.n === r.supp.data && r.supp.beams === r.supp.nb0 && r.supp.offBeams === r.supp.nb0, r.supp.n + ' limiters (' + (r.supp.paths.join(', ') || 'none: no nose engine') + ') with the layer on, none off; the build\'s own ' + r.supp.nb0 + ' members either way (the limiters are no members)');
    if (r.supp.n) yes(r.slackLoad.m > 1 && r.slackPull.m > 1 && r.slackDrop.m > 1, 'slack in normal operations (the shortest over its closing length): the load test to 5.7 g ' + f2(r.slackLoad.m) + ' (' + r.slackLoad.verdict + '), a flown pull to ' + f2(r.slackPull.nz) + ' g ' + f2(r.slackPull.m) + ', FAR 23.473\'s drop ' + f2(r.slackDrop.m));
    if (r.supp.n && r.noseBefore) {
      const b = r.noseBefore, a = r.noseAfter, dmax = x => x.eng.reduce((m, e) => Math.max(m, e.d), 0);
      const desc = x => x.eng.length ? x.eng.map(e => e.tag + ' ' + f2(e.d) + ' m into bay ' + e.bay + (e.att ? '' : ' (off its mount)')).join(', ') : 'none';
      yes(a.eng.length === 0 && a.finite, 'THE ENGINE THROUGH THE FIREWALL, a severe nose-in on the ground: without the limiters ' + desc(b) + '; with them ' + desc(a) + ' (' + a.dmg.breaks + ' broken, ' + (a.dmg.crashed ? 'CRASHED' : 'no crash') + ', finite)');
      if (b.eng.length === 0) console.log('  REPORT  (this build\'s engine did not pass the firewall in this case without the limiters either: ' + b.dmg.breaks + ' broken)');
      if (a.other.length) console.log('  REPORT  the probe elsewhere, with them (not a limiter\'s: a detached part or a folded panel, §8.2): ' + a.other.map(x => x.part + ':' + x.tag + ' ' + f2(x.d) + ' m bay ' + x.bay + (x.att ? '' : ' off') + ' @' + f2(x.t)).join('; '));
    }
    console.log('4. the cost');
    console.log('  REPORT  a break event (' + r.cost.members + ' members, the union-find over ' + r.cost.beams + ' beams / ' + r.cost.nodes + ' nodes, ' + r.cost.strips + ' strips): ' + r.cost.us.toFixed(1) + ' us');
  }
  console.log('The V-tail Cub (its tail strips read the body axes: the SPLIT path):');
  const v = R.vtail;
  if (v.err) yes(false, 'the child ran: ' + v.err);
  else {
    const sp = v.strips.filter(x => x.split), dr = v.strips.filter(x => x.dead);
    yes(v.span === 0 && sp.length > 0 && sp.every(x => !x.dead && x.keep >= 0.7 && Math.abs(x.sum - 1) < 1e-12 && x.onCore) && dr.every(x => x.keep < 0.7),
      v.groups.join(' + ') + ' broken: ' + sp.length + ' tail strips split onto the core (they kept ' + sp.map(x => (100 * x.keep).toFixed(0) + ' %').join(', ') + ' of their weight; renormalised to ' + sp.map(x => x.sum.toFixed(3)).join(', ') + '), ' + dr.length + ' dropped (' + dr.map(x => (100 * x.keep).toFixed(0) + ' %').join(', ') + ' on the core: under 70 %); none on two pieces');
  }
  console.log('Broke up (the flight over at once): ' + (runsUp.length ? runsUp.join('; ') : 'none of the crash runs'));
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGINTEGRITY: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
