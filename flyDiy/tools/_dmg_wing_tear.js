#!/usr/bin/env node
// DMG-WALL (the Deform Coordinator's train-41 finding): WHY AN INTACT WING TEARS ITS COVERING. TUNE's Cub nose-over on the
// box broke gear and tail members only, yet the wing's upper covering showed torn rectangles. This rig rides the flown cage
// snapshot as app.js brkCage does on the page (the inherited binding, its tear flags, the events, wallSync, the crushed-bay
// cut, poseCage, the tear, and G1864's islands under BRK_ISLAND every 0.25 s) and attributes every covering triangle
// removed:
//   cause   - 'tear' (an edge past its bound this frame) or 'island' (G1864: a small piece that touched the tear);
//   strain  - the worst member strain among the nodes the triangle's places ride (a member broken = 'broken');
//   nodes   - the tags of the heaviest nodes its places ride (a wing panel riding a gear / tail / cabin node shows here);
//   stretch - its worst edge l / r at the moment.
// And, at rest, the covering's PIECES (places joined by triangles): a piece under BRK_ISLAND triangles that a single tear
// touches goes whole - the rectangles.
// Run: node tools/_dmg_wing_tear.js [--build cub] [--cases noseover] [--island 40] [--out <json>]
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const ST = require('./_dmg_wall_study.js');
const L = require('./_treecrash_lib.js');
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
const ISL = +opt('island', 40);
const STEP = +opt('stepped', 0), FRAME = +opt('frame', 2);       // (the page: BRK_INH 1500 places a frame, 30 fps = 2 sim steps)
const GATE = argv.includes('--gate');                            // (the candidate fix: no tear until the binding is done)

const k = opt('build', 'cub'), P = ST.prepare(k), def = P.def, tag = i => def.nodes[i].tag || ('n' + i);
const out = { build: k, island: SB.islands ? ISL : 'none in this build', crushCut: SB.SET_CRUSH != null, groups: [], cases: [] };

// ---- at rest: the covering's pieces per group ----
const mk = () => P.groups.map(g => SB.make({ nv: g.nv, idx: g.idx.slice() }, SB.INH_K, { fabric: P.fabric && g.cv.indexOf(SB.INH.cover) >= 0, cage: true, pos: g.bD, rest: P.rest, weld: true, rideAll: true }));
const R0 = mk();
P.groups.forEach((g, i) => {
  const R = R0[i], nt = g.idx.length / 3, rp = R.rep, at = v => rp ? rp[v] : v;
  let cov = 0; for (let t = 0; t < nt; t++) if (g.cv[g.idx[t*3]] === SB.INH.cover) cov++;
  if (!cov) return;
  const Pp = new Int32Array(g.nv); for (let v = 0; v < g.nv; v++) Pp[v] = v;
  const f = x => { while (Pp[x] !== x) { Pp[x] = Pp[Pp[x]]; x = Pp[x]; } return x; };
  for (let t = 0; t < nt; t++) { const a = f(at(g.idx[t*3])), b = f(at(g.idx[t*3+1])), c = f(at(g.idx[t*3+2])); if (a !== b) Pp[a] = b; const b2 = f(b), c2 = f(c); if (b2 !== c2) Pp[b2] = c2; }
  const size = new Map(); for (let t = 0; t < nt; t++) { const r = f(at(g.idx[t*3])); size.set(r, (size.get(r) || 0) + 1); }
  const sz = [...size.values()].sort((a, b) => a - b), small = sz.filter(s => s < ISL);
  out.groups.push({ i, key: g.key, sec: g.sec, role: g.role, tris: nt, cover: cov, pieces: sz.length, small: small.length, smallTris: small.reduce((a, b) => a + b, 0),
    hist: sz.length > 12 ? [sz[0], sz[sz.length >> 2], sz[sz.length >> 1], sz[(3 * sz.length) >> 2], sz[sz.length - 1]] : sz });
});
console.log('build ' + k + ': covering groups (pieces at rest, those under ' + ISL + ' triangles):');
for (const G of out.groups) console.log('  #' + G.i + ' ' + (G.sec || G.key) + ' tris ' + G.tris + ' cover ' + G.cover + ' pieces ' + G.pieces + ' small ' + G.small + ' (' + G.smallTris + ' tris) sizes ' + JSON.stringify(G.hist));

// ---- the crash ----
function run(cid) {
  const G = ST.go(k, ST.CASES[cid]), sim = G.sim, n = sim.n;
  const core = def.refs.noseFrame[0], hop = SH.simDmgHop0(), D = SV.simViewDmgState(n, def.beams.length);
  let inhIt = null, inhSt = null, doneAt = null;
  let recs = null, E = null, NF = {}, crushKey = null, first = -1, islT = -1;
  const X = R => ({ Mi: [1, 0, 0, 0, 1, 0, 0, 0, 1], B: [1, 0, 0, 0, 1, 0, 0, 0, 1], cg: [0, 0, 0], o: [0, 0, 0], w: R.w, n: null, nB: null });
  const scratch = new Map(), log = [], seen = new Map();
  const strainOf = (nodes) => { let worst = 0, br = false; const ns = [...nodes];
    for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) {
      const L2 = P.T.pairs.get(Math.min(ns[a], ns[b]) * P.T.n + Math.max(ns[a], ns[b])); if (!L2) continue;
      for (const bi of L2) { if (D.broken[bi]) br = true; const bm = P.T.beams[bi];
        const l = Math.hypot(sim.p[bm.a*3] - sim.p[bm.b*3], sim.p[bm.a*3+1] - sim.p[bm.b*3+1], sim.p[bm.a*3+2] - sim.p[bm.b*3+2]);
        const r0 = Math.hypot(P.rest[bm.a*3] - P.rest[bm.b*3], P.rest[bm.a*3+1] - P.rest[bm.b*3+1], P.rest[bm.a*3+2] - P.rest[bm.b*3+2]);
        worst = Math.max(worst, Math.abs(l / r0 - 1)); } }
    return br ? 'broken' : +worst.toFixed(3); };
  const note = (i, cause) => { const R = recs[i], g = P.groups[i], ix = R.idx0, K = R.K; let sn = seen.get(i); if (!sn) seen.set(i, sn = new Uint8Array(R.nt));
    for (let t = 0; t < R.nt; t++) { if (!R.dead[t] || sn[t]) continue; sn[t] = 1;
      if (R.dead[t] !== 2 || g.cv[ix[t*3]] !== SB.INH.cover) continue;
      const nodes = new Map(); for (let q = 0; q < 3; q++) { const v = R.rep ? R.rep[ix[t*3+q]] : ix[t*3+q]; for (let kk = 0; kk < K; kk++) { const w = R.w2[v*K+kk]; if (w > 0.05) nodes.set(R.wi[v*K+kk], (nodes.get(R.wi[v*K+kk]) || 0) + w); } }
      let st = 0; for (const [p, q] of [[ix[t*3], ix[t*3+1]], [ix[t*3+1], ix[t*3+2]], [ix[t*3], ix[t*3+2]]]) {
        const r0 = Math.hypot(g.bD[p*3] - g.bD[q*3], g.bD[p*3+1] - g.bD[q*3+1], g.bD[p*3+2] - g.bD[q*3+2]);
        const l = Math.hypot(R.w[p*3] - R.w[q*3], R.w[p*3+1] - R.w[q*3+1], R.w[p*3+2] - R.w[q*3+2]); if (r0 > 0.002) st = Math.max(st, l / r0); }
      const top = [...nodes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nd]) => tag(nd));
      const c = [0, 1, 2].map(q => g.bD[ix[t*3+q]*3 + 2]);
      log.push({ t: +sim.t.toFixed(3), g: i, sec: g.sec || g.key, tri: t, cause, strain: strainOf(nodes.keys()), stretch: +st.toFixed(3), nodes: top, zMid: +((c[0] + c[1] + c[2]) / 3).toFixed(2) }); } };
  for (let s = 1; s <= G.N; s++) {
    sim.step(1 / 60);
    const PI = SH.simDmgHop(sim, hop, core, 0); if (PI) SV.simViewDmgApply(D, PI);
    if (!D.br.length) continue;
    if (first < 0) first = s;
    if (!recs) {
      recs = mk(); recs.forEach(R => { R.w = new Float64Array(R.nv * 3); });
      E = recs.map((R, i) => { const g = P.groups[i], e = { R, cv: g.cv, obj: g.obj };
        if (g.layer.indexOf('cowl') >= 0) { e.cowl = new Uint8Array(g.nv); for (let v = 0; v < g.nv; v++) if (g.layer[v] === 'cowl') e.cowl[v] = 1; } return e; });
      // (--stepped: as the page - inhSteps BRK_INH places a page frame, every --frame sim steps; the riding weights stay
      // each place's one nearest node until the binding is done, then every record's event is made again)
      if (STEP > 0) { inhSt = {}; inhIt = SB.inhSteps(E, P.T, P.rest, inhSt, STEP); } else { SB.bindInherit(E, P.T, P.rest); inhSt = { done: true }; }
      recs.forEach((R, i) => { const cv = P.groups[i].cv, has = c => cv.indexOf(c) >= 0;
        R.noTear = has(SB.INH.tube) || (has(SB.INH.rigid) && !has(SB.INH.cover)) || (has(SB.INH.cover) && !P.fabric);
        R.tubeTear = has(SB.INH.tube) && !has(SB.INH.cover); R.sheetTear = has(SB.INH.cover) && !P.fabric; });
    }
    if (inhIt && !inhSt.done && s % FRAME === 0) { const r = inhIt.next(); if (r.done) { doneAt = +sim.t.toFixed(3); for (const R of recs) R.vB = -1; } }
    const tearOn = !GATE || inhSt.done;
    let evd = false; for (const R of recs) evd = SB.event(R, P.T, D, P.rest, R.g.pos) || evd;
    if (evd) for (const e of E) if (e.on) SB.wallSync(e, E);
    const key = D.vB + '|' + D.sS; if (SB.SET_CRUSH != null && crushKey !== key) { crushKey = key; const hot = SB.hotNodes(P.T, D, SB.SET_CRUSH); for (const e of E) if (e.cv.indexOf(SB.INH.wall) >= 0) SB.cutWall(e.R, hot, e.cv); }
    recs.forEach((R, i) => { if (R.dead) note(i, 'event'); });
    SB.nodeFrames(NF, P.T, D, P.rest, sim.p, true);
    let tornNew = false;
    recs.forEach((R, i) => { let pos = scratch.get(R.nv); if (!pos) scratch.set(R.nv, pos = new Float32Array(R.nv * 3));
      SB.poseCage(R, P.rest, sim.p, R.g.pos, pos, NF, [0, -1, 0], null, X(R)); if (tearOn && SB.tear(R, R.g.pos, R.w)) { tornNew = true; R.tornNew = true; } note(i, 'tear'); });
    if (ISL > 0 && SB.islands && !(sim.t - islT < 0.25) && recs.some(R => R.tornNew)) { islT = sim.t;
      recs.forEach((R, i) => { if (!R.tornNew) return; R.tornNew = false; if (SB.islands(R, ISL)) note(i, 'island'); }); }
    for (const e of E) if (e.on) SB.wallFollow(e, E);
  }
  const Dm = sim.damage(), up = sim.axes()[1];
  const brokenNames = D.br.map(b => { const bm = def.beams[b]; return tag(bm.a) + '-' + tag(bm.b); });
  const agg = {}; for (const r of log) { const kk = r.sec + (Math.abs(r.zMid) > 0.8 ? ' OUTBOARD' : '') + ' ' + r.cause + ' ' + (r.strain === 'broken' ? 'broken' : r.strain > 0.15 ? 'strained' : 'intact'); agg[kk] = (agg[kk] || 0) + 1; }
  return { stepped: STEP, gate: GATE, bindDoneAt: doneAt, case: cid, firstBreak: first, broken: D.br.length, brokenNames, upY: +up[1].toFixed(2), crashed: Dm.crashed, agg, log };
}
for (const cid of opt('cases', 'noseover').split(',')) {
  const t0 = Date.now(), r = run(cid); r.ms = Date.now() - t0; out.cases.push(r);
  console.log('stepped ' + r.stepped + ' gate ' + r.gate + ' binding done at t ' + r.bindDoneAt);
  console.log(cid + ' (' + r.ms + ' ms) first ' + r.firstBreak + ' broken ' + r.broken + ' up ' + r.upY + ': ' + r.brokenNames.join(', '));
  console.log('  removed covering by group / cause / its frame: ' + JSON.stringify(r.agg));
  const intact = r.log.filter(x => x.strain !== 'broken' && x.strain <= 0.15);
  for (const x of intact.slice(0, 25)) console.log('   ' + JSON.stringify(x));
  // the nodes ridden by intact-frame removals, counted
  const nc = {}; for (const x of intact) for (const nd of x.nodes) nc[nd] = (nc[nd] || 0) + 1;
  console.log('  nodes under intact-frame removals: ' + JSON.stringify(Object.entries(nc).sort((a, b) => b[1] - a[1]).slice(0, 20)));
}
if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify(out, null, 1));
