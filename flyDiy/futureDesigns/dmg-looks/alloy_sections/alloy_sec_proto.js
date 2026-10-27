#!/usr/bin/env node
// alloy_sec_proto.js - DMG-LOOKS, ALLOY SECTIONS (the user via A0, 27 Oct: "the metal Cessna's formers/stringers torn as
// alloy sections, bare alloy then grey primer at the tear"). PROTOTYPE ONLY, node: no src/ change, DEFORM's pool code
// read and called, never edited.
//
// WHY NOT ONE SLOT A MEMBER. DEFORM's pool (dmg_members.js v2, G3770-G3773: the member drawn is the real tube RE-RINGED)
// takes a member whose drawn tube is bound to it (skin_break's inherited binding, R.mem). The metal Cessna's formers and
// stringers are the cage's 'aluminium' bucket - role 'struct', bound as COVERING (place by place, R.mem none), and drawn
// where the generator put them, not on the physics' members: the frame rings stand every ~0.97 m (stations 0, 0.95,
// 1.85, 2.82, 3.80, 4.77, 5.75), the drawn formers at 0, 0.5, 1.0, 2.6, 3.4, 4.2, 5.0 (alloy_sec_census.js). A drawn
// former is torn where the COVERING parts, wherever that is along it.
//
// SO A SLOT A TEAR CROSSING. At the end of a crash flown through the real binding (tools/_dmg_wall_study.js prepare + the
// 'inh' scheme's loop: SB.event, nodeFrames, poseCage, tear), the 'aluminium' record's dead triangles (removed or torn)
// are found on each drawn piece; each run of them along the piece is a CROSSING. A crossing becomes a VIRTUAL MEMBER:
//   - its two ends: the piece's spine 2 cm inside the live former on each side of the gap (their rest places), each a
//     VIRTUAL NODE riding the physics node its nearest live place leans on most (the place's own binding weights): live =
//     that node's live place + its turn (NF.q) applied to the rest offset - computed each posed frame, appended to the
//     arrays DEFORM's frame() reads (live, Q);
//   - its beam: { a, b: the virtual nodes, mat: 'aluTube' } - DEFORM's alloy look as it stands (MAT 2: the bare alloy,
//     then the GREY PRIMER band, LOOK_TINT), so dmg_members.js needs NO change;
//   - its section: the piece's own corners in the slice across the spine at the crossing (as measure() reads a tube's
//     ring: by angle about the slice's centre, at most AROUND), its radius their mean distance;
//   - its slot: MODE.torn at tb 0.5 - drawn CRACKED while the two sides are within the rest length, as two STUBS each on
//     its own side past it (the lips necked, jagged, curled, the bare rim) - DEFORM's pose(), unchanged.
// The former's own triangles at the gap are already gone (the covering's tear took them): the stubs fill the gap from
// 2 cm inside each live edge. No hide, no skin_break change.
//
// WRITES (next to this file): alloy_sec_proto.txt (the crossings per crash, slots, triangles, costs) and
// alloy_sec_proto.png (the worst crossing of the centreline crash: today, then the stubs; and the slot alone, unposed /
// cracked / parted). Run (from the repo's flyDiy):
//   node futureDesigns/dmg-looks/alloy_sections/alloy_sec_proto.js [--root <a flyDiy checkout at DEFORM's base>]
//        [--pool <dmg_members.js>] (default: git show origin/claude/dmg-looks:flyDiy/src/viewer/dmg_members.js)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const HERE = __dirname, ROOT = path.resolve(opt('root', path.join(HERE, '..', '..', '..'))), T = path.join(ROOT, 'tools');
const R3 = require(path.join(HERE, '..', 'raster3d.js'));
// DEFORM's pool, read-only
let poolFile = opt('pool', null);
if (!poolFile) { poolFile = path.join(os.tmpdir(), 'dmg_members_deform_' + process.pid + '.js');
  fs.writeFileSync(poolFile, cp.execSync('git show origin/claude/dmg-looks:flyDiy/src/viewer/dmg_members.js', { cwd: HERE, maxBuffer: 1 << 26 })); }
const DM = require(poolFile);
const WS = require(path.join(T, '_dmg_wall_study.js'));
const L = require(path.join(T, '_treecrash_lib.js'));
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
const V = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: a => Math.hypot(a[0], a[1], a[2]), nrm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] };
const qrot = (q, v) => { const t = V.mul(V.cross([q[0], q[1], q[2]], v), 2); return V.add(V.add(v, V.mul(t, q[3])), V.cross([q[0], q[1], q[2]], t)); };

const K = 'metal', INSET = 0.02, GAPJOIN = 0.03;
const CREASE = 60 * Math.PI / 180;   // (the user, 27 Oct: smooth normals, hard edges only at a real crease or a tear - a crease: faces meeting at over 60 deg)
const PAINT = [0.50, 0.56, 0.64];   // (the picture's paint on the formers - a stand-in for the bucket's own colour, chosen so the bands read)
const P = WS.prepare(K), def = P.def, n = def.nodes.length, nb = def.beams.length;
const gi = P.groups.findIndex(g => g.sec === 'aluminium'), G = P.groups[gi];
// the fuselage axis (design frame): the nose frame to the tail's middle
const avg = ids => { const q = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) q[k] += P.rest[i * 3 + k] / ids.length; return q; };
const X0 = avg(def.refs.noseFrame), UX = V.nrm(V.sub(avg(def.refs.tailMid), X0));

// ---- THE DRAWN PIECES of the 'aluminium' bucket, each with a SPINE parameter per vertex ----
function piecesOf(g) {
  const nv = g.nv, B = g.bD, key = new Map(), wid = new Int32Array(nv);
  for (let v = 0; v < nv; v++) { const q = Math.round(B[v * 3] / 5e-4) + ',' + Math.round(B[v * 3 + 1] / 5e-4) + ',' + Math.round(B[v * 3 + 2] / 5e-4);
    let w = key.get(q); if (w == null) key.set(q, w = key.size); wid[v] = w; }
  const par = new Int32Array(key.size).map((_, i) => i), f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let t = 0; t < g.idx.length; t += 3) { const a = f(wid[g.idx[t]]), b = f(wid[g.idx[t + 1]]), c = f(wid[g.idx[t + 2]]); par[b] = a; par[f(c)] = a; }
  const of = new Int32Array(nv).fill(-1), list = [], ids = new Map();
  for (let t = 0; t < g.idx.length; t += 3) { const r = f(wid[g.idx[t]]); let id = ids.get(r); if (id == null) { ids.set(r, id = list.length); list.push({ tris: [], vs: new Set() }); }
    list[id].tris.push(t / 3); for (let j = 0; j < 3; j++) { list[id].vs.add(g.idx[t + j]); of[g.idx[t + j]] = id; } }
  for (const pc of list) {
    const vs = [...pc.vs], pts = vs.map(v => [B[v * 3], B[v * 3 + 1], B[v * 3 + 2]]);
    const c = [0, 0, 0]; for (const p of pts) for (let j = 0; j < 3; j++) c[j] += p[j] / pts.length;
    let lo = Infinity, hi = -Infinity; for (const p of pts) { const s = V.dot(V.sub(p, X0), UX); lo = Math.min(lo, s); hi = Math.max(hi, s); }
    pc.c = c; pc.run = hi - lo > 0.3;                // a STRINGER (a run along the fuselage) or a FORMER (a ring across it)
    // the spine parameter (m): a run's station along the axis; a ring's arc - its angle about the fuselage's centre line at
    // its station, times its mean radius
    const ctr = V.add(X0, V.mul(UX, V.dot(V.sub(c, X0), UX)));
    const e1 = V.nrm(V.cross(UX, [0, 0, 1])), e2 = V.cross(UX, e1);
    let rr = 0; for (const p of pts) { const d = V.sub(p, ctr); rr += Math.hypot(V.dot(d, e1), V.dot(d, e2)) / pts.length; }
    pc.s = new Map(); pc.ctr = ctr; pc.e1 = e1; pc.e2 = e2; pc.rr = rr;
    for (let i = 0; i < vs.length; i++) { const p = pts[i];
      if (pc.run) pc.s.set(vs[i], V.dot(V.sub(p, X0), UX));
      else { const d = V.sub(p, ctr); let a = Math.atan2(V.dot(d, e2), V.dot(d, e1)); pc.s.set(vs[i], a * rr); } }
    pc.period = pc.run ? Infinity : 2 * Math.PI * rr;
  }
  return { list, of };
}

// ---- A CRASH through the real binding (the 'inh' scheme of _dmg_wall_study.js run(), its loop alone) ----
function fly(caseId) {
  const c = Object.assign({}, WS.CASES[caseId], { seed: 0 }), sim = goSim(c);
  const core = def.refs.noseFrame[0], hop = SH.simDmgHop0(), D = SV.simViewDmgState(n, nb);
  const NF = {}; let recs = null, E = null, crushKey = null; const X = R => ({ Mi: [1, 0, 0, 0, 1, 0, 0, 0, 1], B: [1, 0, 0, 0, 1, 0, 0, 0, 1], cg: [0, 0, 0], o: [0, 0, 0], w: R.w, n: null, nB: null });
  const scratch = new Map(); let evMs = 0, events = 0;
  for (let s = 1; s <= sim.N; s++) {
    sim.sim.step(1 / 60);
    const PI = SH.simDmgHop(sim.sim, hop, core, 0); if (PI) SV.simViewDmgApply(D, PI);
    if (!D.br.length) continue;
    if (!recs) {
      recs = P.groups.map(g => { const R = SB.make({ nv: g.nv, idx: g.idx.slice() }, SB.INH_K, { fabric: P.fabric && g.cv.indexOf(SB.INH.cover) >= 0, cage: true, pos: g.bD, rest: P.rest, weld: true, rideAll: true });
        R.w = new Float64Array(g.nv * 3); return R; });
      E = recs.map((R, i) => ({ R, cv: P.groups[i].cv, obj: P.groups[i].obj }));
      SB.bindInherit(E, P.T, P.rest);
      recs.forEach((R, i) => { const cv = P.groups[i].cv, has = q => cv.indexOf(q) >= 0;
        R.noTear = has(SB.INH.tube) || (has(SB.INH.rigid) && !has(SB.INH.cover)) || (has(SB.INH.cover) && !P.fabric);
        R.tubeTear = has(SB.INH.tube) && !has(SB.INH.cover); R.sheetTear = has(SB.INH.cover) && !P.fabric; });
    }
    let evd = false; for (const R of recs) evd = SB.event(R, P.T, D, P.rest, R.g.pos) || evd;
    if (evd) { events++; for (const e of E) if (e.on) SB.wallSync(e, E); }
    const key = D.vB + '|' + D.sS; if (crushKey !== key) { crushKey = key; const hot = SB.hotNodes(P.T, D, SB.SET_CRUSH); for (const e of E) if (e.cv.indexOf(SB.INH.wall) >= 0) SB.cutWall(e.R, hot, e.cv); }
    SB.nodeFrames(NF, P.T, D, P.rest, sim.sim.p, true);
    for (const R of recs) { let pos = scratch.get(R.nv); if (!pos) scratch.set(R.nv, pos = new Float32Array(R.nv * 3));
      SB.poseCage(R, P.rest, sim.sim.p, R.g.pos, pos, NF, [0, -1, 0], null, X(R)); SB.tear(R, R.g.pos, R.w); }
    for (const e of E) if (e.on) SB.wallFollow(e, E);
  }
  return { sim: sim.sim, D, NF, R: recs ? recs[gi] : null, events };
}
// _dmg_wall_study.js go()'s 'trunk' branch, verbatim in its steps (go() is not exported): the flat world at 300 m, placed
// on its strip (agl), rolled 2 s if on the ground, every node at V along the strip, the test trunk D m ahead (off m aside), throttle closed
function goSim(c) {
  const C = L.core(), o = c.o, elev = 300, { W, TH, strip } = L.flatWorld(elev), sim = C.makeSim(def, W);
  sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = o.V * fx; sim.v[i * 3 + 2] = o.V * fz; }
  const c0 = sim.cgPos().slice(), off = o.off || 0;
  TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev, o.r || 0.3, elev + (o.top || 10.05)]);
  sim.ctl.thr = 0;
  return { sim, N: o.secs * 60 };
}

// the 2D convex hull (monotone chain), counter-clockwise
function hull2(P2) {
  const p = P2.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  if (p.length < 3) return p; const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-10) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 1e-10) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
// ---- THE CROSSINGS: the dead triangles (removed or torn) of the 'aluminium' record, clustered in 3D at rest (linked within
// GAPJOIN); each cluster's local axis (the live section round it is long one way: PCA of the live vertices within 10 cm);
// its two LIVE EDGES (the live vertices just past the cluster along that axis, each side, within 4 cm of the axis line) ----
function crossings(R) {
  const out = []; if (!R || !R.dead) return out;
  const B = G.bD, I = R.idx0 || G.idx, nt = I.length / 3, cen = t => [0, 1, 2].map(j => (B[I[t * 3] * 3 + j] + B[I[t * 3 + 1] * 3 + j] + B[I[t * 3 + 2] * 3 + j]) / 3);
  const dead = [], liveV = new Uint8Array(G.nv);
  for (let t = 0; t < nt; t++) { if (R.dead[t]) dead.push(t); else for (let j = 0; j < 3; j++) liveV[I[t * 3 + j]] = 1; }
  // a 3 cm grid for the links
  const C = dead.map(cen), cell = new Map(), kOf = p => Math.floor(p[0] / GAPJOIN) + ',' + Math.floor(p[1] / GAPJOIN) + ',' + Math.floor(p[2] / GAPJOIN);
  C.forEach((p, i) => { const k = kOf(p); let L0 = cell.get(k); if (!L0) cell.set(k, L0 = []); L0.push(i); });
  const par = dead.map((_, i) => i), f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  C.forEach((p, i) => { const gx = Math.floor(p[0] / GAPJOIN), gy = Math.floor(p[1] / GAPJOIN), gz = Math.floor(p[2] / GAPJOIN);
    for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) for (let c = -1; c <= 1; c++) for (const j of (cell.get((gx + a) + ',' + (gy + b2) + ',' + (gz + c)) || [])) {
      if (j <= i) continue; if (Math.hypot(...V.sub(C[j], p)) < GAPJOIN) par[f(j)] = f(i); } });
  const groups = new Map(); C.forEach((p, i) => { const r = f(i); let g = groups.get(r); if (!g) groups.set(r, g = []); g.push(i); });
  const lg = new Map(), LG = 0.1; for (let v = 0; v < G.nv; v++) if (liveV[v]) { const k = Math.floor(B[v * 3] / LG) + ',' + Math.floor(B[v * 3 + 1] / LG) + ',' + Math.floor(B[v * 3 + 2] / LG); let q = lg.get(k); if (!q) lg.set(k, q = []); q.push(v); }
  const liveNear = (c, r) => { const out2 = [], gx = Math.floor(c[0] / LG), gy = Math.floor(c[1] / LG), gz = Math.floor(c[2] / LG);
    for (let a2 = -1; a2 <= 1; a2++) for (let b3 = -1; b3 <= 1; b3++) for (let c3 = -1; c3 <= 1; c3++) for (const v of (lg.get((gx + a2) + ',' + (gy + b3) + ',' + (gz + c3)) || []))
      if (Math.hypot(B[v * 3] - c[0], B[v * 3 + 1] - c[1], B[v * 3 + 2] - c[2]) < r) out2.push(v); return out2; };
  for (const g of groups.values()) {
    const c = [0, 0, 0]; for (const i of g) for (let j = 0; j < 3; j++) c[j] += C[i][j] / g.length;
    // the cluster's own drawn piece (most of its triangles'): the axis and the edges are read on it alone
    const piece = (() => { const cnt = new Map(); for (const i of g) { const pp = PC.of[I[dead[i] * 3]]; cnt.set(pp, (cnt.get(pp) || 0) + 1); } return [...cnt].sort((p1, p2) => p2[1] - p1[1])[0][0]; })();
    const near = liveNear(c, 0.10).filter(v => PC.of[v] === piece);
    if (near.length < 8) continue;
    // the local axis: the dead cluster and the live round it together (the section's long way)
    const pts = near.map(v => [B[v * 3], B[v * 3 + 1], B[v * 3 + 2]]).concat(g.filter(i => PC.of[I[dead[i] * 3]] === piece).map(i => C[i]));
    const m = [0, 0, 0]; for (const q of pts) for (let j = 0; j < 3; j++) m[j] += q[j] / pts.length;
    const Cv = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (const q of pts) { const d = V.sub(q, m); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Cv[i * 3 + j] += d[i] * d[j]; }
    let ax = [0.3, 1, 0.2]; for (let it = 0; it < 50; it++) ax = V.nrm([Cv[0] * ax[0] + Cv[1] * ax[1] + Cv[2] * ax[2], Cv[3] * ax[0] + Cv[4] * ax[1] + Cv[5] * ax[2], Cv[6] * ax[0] + Cv[7] * ax[1] + Cv[8] * ax[2]]);
    let h0 = Infinity, h1 = -Infinity; for (const i of g) { const s = V.dot(V.sub(C[i], c), ax); h0 = Math.min(h0, s); h1 = Math.max(h1, s); }
    // the live edges: the live vertices within 4 cm of the axis line past each end of the cluster, the nearest slab (6 mm)
    const side = (sg) => { const cand = near.map(v => { const d = V.sub([B[v * 3], B[v * 3 + 1], B[v * 3 + 2]], c), s2 = V.dot(d, ax), off = V.len(V.sub(d, V.mul(ax, s2))); return { v, s: s2, off }; })
        .filter(q => q.off < 0.04 && (sg < 0 ? q.s < h0 : q.s > h1)); if (!cand.length) return null;
      cand.sort((a2, b3) => (sg < 0 ? b3.s - a2.s : a2.s - b3.s)); const s0 = cand[0].s + sg * INSET;
      const slab = cand.filter(q => Math.abs(q.s - cand[0].s) < 0.006).map(q => q.v);
      return { s: s0, slab, edge: cand[0].s }; };
    const A = side(-1), Bs = side(1); if (!A || !Bs) continue;
    if (Bs.edge - A.edge > 0.25) continue;                     // (not one crossing: a long run of dead - a piece gone, not torn across)
    out.push({ c, ax, h0, h1, A, B: Bs, gap: Bs.edge - A.edge, deadN: g.length, run: Math.abs(V.dot(ax, UX)) > 0.7, piece });
  }
  return out;
}

// ---- THE PART'S OWN SMOOTH NORMALS. The flown snapshot gives the 'aluminium' bucket PER-FACE normals (every coincident
// pair of places differs - the generator's quads share no vertex), so its smooth normals are made here the standard way:
// the places welded at rest (0.5 mm), each corner's normal the area-weighted sum of the welded faces within CREASE of its
// own face (a box's 90 deg corner stays a hard edge - a real crease; a shallow turn is smoothed). pos: the positions the
// faces are taken from (rest: G.bD; posed: R.w), welded by REST place either way. Returns Float32Array 3 x nv ----
function creased(pos, I, alive) {
  const B = G.bD, nv = G.nv, nt = I.length / 3, key = new Map(), wid = new Int32Array(nv);
  for (let v = 0; v < nv; v++) { const q = Math.round(B[v * 3] / 5e-4) + ',' + Math.round(B[v * 3 + 1] / 5e-4) + ',' + Math.round(B[v * 3 + 2] / 5e-4); let w = key.get(q); if (w == null) key.set(q, w = key.size); wid[v] = w; }
  const fn = new Float64Array(nt * 3), own = new Int32Array(nv).fill(-1), byW = Array.from({ length: key.size }, () => []);
  for (let t = 0; t < nt; t++) { if (alive && !alive(t)) continue; const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const u = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]], w = [pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]];
    const nn = V.cross(u, w); fn[t * 3] = nn[0]; fn[t * 3 + 1] = nn[1]; fn[t * 3 + 2] = nn[2];   // (area-weighted: |nn| = 2 area)
    for (const v of [a, b, c]) { if (own[v] < 0) own[v] = t; byW[wid[v]].push(t); } }
  const out = new Float32Array(nv * 3), cc = Math.cos(CREASE);
  for (let v = 0; v < nv; v++) { const t0 = own[v]; if (t0 < 0) continue; const f0 = V.nrm([fn[t0 * 3], fn[t0 * 3 + 1], fn[t0 * 3 + 2]]); let sm = [0, 0, 0];
    for (const t of new Set(byW[wid[v]])) { const f = [fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]]; if (V.dot(V.nrm(f), f0) >= cc) sm = V.add(sm, f); }
    const r = V.nrm(sm); out[v * 3] = r[0]; out[v * 3 + 1] = r[1]; out[v * 3 + 2] = r[2]; }
  return out;
}

// ---- A CROSSING AS A VIRTUAL MEMBER, fed through DEFORM's pool API unchanged ----
function virtualise(X, R) {
  const B = G.bD, I = R.idx0 || G.idx, TG = 0.25, tg = new Map();   // (the live triangles on a 25 cm grid by their first place)
  for (let t = 0; t < I.length / 3; t++) { if (R.dead[t]) continue; const v = I[t * 3], k = Math.floor(B[v * 3] / TG) + ',' + Math.floor(B[v * 3 + 1] / TG) + ',' + Math.floor(B[v * 3 + 2] / TG); let q = tg.get(k); if (!q) tg.set(k, q = []); q.push(t); }
  const trisNear = c => { const out = [], gx = Math.floor(c[0] / TG), gy = Math.floor(c[1] / TG), gz = Math.floor(c[2] / TG);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) for (const t of (tg.get((gx + a) + ',' + (gy + b) + ',' + (gz + d)) || [])) out.push(t); return out; };
  const ext = { beams: def.beams.slice(), rest: Array.from(P.rest), ride: [], slots: [], slotOf: [], M: null, N2: [] };
  const NR = creased(B, I, t => !R.dead[t]);   // (the live part's own smooth normals at rest)
  const nbX = nb + X.length;
  const M = { drawn: new Uint8Array(nbX), K: new Uint8Array(nbX), off: new Float32Array(nbX * DM.AROUND * 3), uv: new Float32Array(nbX * DM.AROUND * 4),
    r: new Float32Array(nbX), tA: new Float32Array(nbX), tB: new Float32Array(nbX), up: new Float32Array(nbX * 3), key: new Array(nbX).fill(null) };
  X.forEach((x, i) => {
    const bi = nb + i, ia = n + i * 2, ib = ia + 1, u = x.ax;
    // THE SECTION AT EACH END: the live triangles of the same drawn piece cut by the plane across the axis INSET into the
    // live former (each triangle whose places straddle it gives a segment), within 5 cm of the axis line; the cut's convex
    // hull in the plane, cut to AROUND corners by least area (Visvalingam) - a flanged web's 4 mm recesses go, its depth and
    // flange width stay (measure()'s angle sort scrambles a section not star-shaped from its centre). The member's ends are
    // the two hulls' centres
    let e1 = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; e1 = V.nrm(V.sub(e1, V.mul(u, V.dot(e1, u)))); const e2 = V.cross(u, e1);
    const cutAt = sd => { const P0 = V.add(x.c, V.mul(u, sd.s)), pts = [];
      // (every live 'aluminium' triangle, not the one piece: a former is several strips the generator never welds - its two
      // flange boxes at +-7 mm, its web sheets at +-3 mm, bay by bay. A crossing stringer's edges lie IN the plane: an edge
      // counts only if it runs along the axis, |cos| > 0.5)
      for (const t of trisNear(P0)) {
        const q = [0, 1, 2].map(j => [B[I[t * 3 + j] * 3], B[I[t * 3 + j] * 3 + 1], B[I[t * 3 + j] * 3 + 2]]);
        if (Math.hypot(...V.sub(q[0], P0)) > 0.25) continue;
        const dd = q.map(z => V.dot(V.sub(z, P0), u));
        for (let j = 0; j < 3; j++) { const k2 = (j + 1) % 3; if ((dd[j] < 0) === (dd[k2] < 0)) continue;
          const ed = V.sub(q[k2], q[j]); if (Math.abs(V.dot(ed, u)) < 0.5 * V.len(ed)) continue;
          const f = dd[j] / (dd[j] - dd[k2]), z = V.add(q[j], V.mul(ed, f)), w = V.sub(z, P0);
          if (V.len(V.sub(w, V.mul(u, V.dot(w, u)))) >= 0.04) continue;
          // (the part's own smooth normal there: its edge's two places' creased normals, lerped, in the section's plane)
          const va = I[t * 3 + j], vb = I[t * 3 + k2], nl = [0, 1, 2].map(c => NR[va * 3 + c] * (1 - f) + NR[vb * 3 + c] * f);
          const n2 = [V.dot(nl, e1), V.dot(nl, e2)], l2 = Math.hypot(n2[0], n2[1]);
          const pt = [V.dot(w, e1), V.dot(w, e2)]; pt.n = l2 > 1e-6 ? [n2[0] / l2, n2[1] / l2] : null; pts.push(pt); } }
      const hull = hull2(pts); let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const h of hull) { a0 = Math.min(a0, h[0]); a1 = Math.max(a1, h[0]); b0 = Math.min(b0, h[1]); b1 = Math.max(b1, h[1]); }
      const hc = hull.length ? [(a0 + a1) / 2, (b0 + b1) / 2] : [0, 0];
      return { P0, pts, hull, hc, ctr: V.add(P0, V.add(V.mul(e1, hc[0]), V.mul(e2, hc[1]))), dims: hull.length ? [Math.max(a1 - a0, b1 - b0), Math.min(a1 - a0, b1 - b0)] : null, n: pts.length }; };
    const cA = cutAt(x.A), cB = cutAt(x.B), hull = cA.hull.slice(); x.secN = cA.n; x.hullN = hull.length; x.dims = cA.dims;
    let A = cA.hull.length >= 3 ? cA.ctr : cA.P0, Bp = cB.hull.length >= 3 ? cB.ctr : cB.P0;
    // THE RING'S ENTRIES, each with the part's own normal: at a hull corner the cut's normals within 1 mm of it, in families
    // CREASE apart - one family: one entry (smooth); two (the section's real crease, a box's corner): the corner TWICE, the
    // incoming face's normal then the outgoing one's - a hard edge along the stub; none carried: the bisector of its edges.
    // The hull is cut by least area until the entries fit AROUND
    const entriesOf = H => { const out = [], m = H.length;
      for (let k = 0; k < m; k++) { const p0 = H[(k + m - 1) % m], p1 = H[k], p2 = H[(k + 1) % m];
        const eIn = V.nrm([p1[1] - p0[1], -(p1[0] - p0[0]), 0]), eOut = V.nrm([p2[1] - p1[1], -(p2[0] - p1[0]), 0]);   // (outward on a CCW hull)
        const fam = []; for (const q of cA.pts) { if (!q.n || Math.hypot(q[0] - p1[0], q[1] - p1[1]) > 0.001) continue;
          const f = fam.find(F => F.n[0] * q.n[0] + F.n[1] * q.n[1] >= Math.cos(CREASE)); if (f) { f.s[0] += q.n[0]; f.s[1] += q.n[1]; } else fam.push({ n: q.n.slice(), s: q.n.slice() }); }
        const nr = F => { const l = Math.hypot(F.s[0], F.s[1]) || 1; return [F.s[0] / l, F.s[1] / l]; };
        if (fam.length >= 2) { fam.sort((F1, F2) => (F2.n[0] * eIn[0] + F2.n[1] * eIn[1]) - (F1.n[0] * eIn[0] + F1.n[1] * eIn[1]));
          out.push({ p: p1, n: nr(fam[0]), crease: 1 }, { p: p1, n: nr(fam[fam.length - 1]), crease: 2 }); }
        else if (fam.length === 1) out.push({ p: p1, n: nr(fam[0]) });
        else { const bs = V.nrm(V.add(eIn, eOut)); out.push({ p: p1, n: [bs[0], bs[1]], bis: 1 }); } }
      return out; };
    let ent = entriesOf(hull);
    while (ent.length > DM.AROUND && hull.length > 3) { let bk = 0, ba = Infinity; for (let k = 0; k < hull.length; k++) { const p0 = hull[(k + hull.length - 1) % hull.length], p1 = hull[k], p2 = hull[(k + 1) % hull.length];
      const ar = Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])); if (ar < ba) { ba = ar; bk = k; } } hull.splice(bk, 1); ent = entriesOf(hull); }
    if (ent.length > DM.AROUND) ent = ent.filter(e => e.crease !== 2).slice(0, DM.AROUND);
    x.creases = ent.filter(e => e.crease === 1).length; x.bis = ent.filter(e => e.bis).length;
    let CA = ent.map(e => { const q = V.add(V.mul(e1, e.p[0] - cA.hc[0]), V.mul(e2, e.p[1] - cA.hc[1])); return { q, rr: V.len(q), n3: V.add(V.mul(e1, e.n[0]), V.mul(e2, e.n[1])) }; });
    if (hull.length < 3) { const r0 = 0.004; CA = [0, 1, 2, 3].map(k => { const a = (k + 0.5) / 4 * Math.PI * 2, q = V.add(V.mul(e1, r0 * Math.cos(a)), V.mul(e2, r0 * Math.sin(a))); return { q, rr: r0, n3: V.nrm(q) }; }); x.hullN = 0; }
    ext.rest.push(...A, ...Bp);
    ext.beams.push({ a: ia, b: ib, mat: 'aluTube', cls: 'fus', virtual: true });
    // each end rides as the place it sits on: the kept weights (w2) of the slab's first vertex - skin_break onNodes' blend
    const rideOf = (sd, P0) => { let ws = [];   // (a welded copy's weights are its place's: rep; the kept ones (w2), else the bound ones)
      for (const v0 of sd.slab) { const v = R.rep ? R.rep[v0] : v0, o = v * R.K;
        for (const W of [R.w2, R.ww]) { if (!W) continue; ws = []; for (let k = 0; k < R.K; k++) if (W[o + k]) ws.push([R.wi[o + k], W[o + k]]); if (ws.length) break; }
        if (ws.length) break; }
      return { ws, x: P0 }; };
    ext.ride.push(rideOf(x.A, A), rideOf(x.B, Bp));
    M.K[bi] = CA.length; let rs = 0; CA.forEach((q, k) => { const o = (bi * DM.AROUND + k) * 3; M.off[o] = q.q[0]; M.off[o + 1] = q.q[1]; M.off[o + 2] = q.q[2]; rs += q.rr; });
    { const seen = new Set(); let rr = 0, nn = 0; for (const q of CA) { const kk = q.q.map(z => z.toFixed(6)).join(); if (seen.has(kk)) continue; seen.add(kk); rr += q.rr; nn++; } M.r[bi] = rr / nn; }
    M.tA[bi] = 0; M.tB[bi] = 1; M.drawn[bi] = 1; M.key[bi] = 'aluminium';
    const up = V.nrm(CA[0].q); M.up.set(up, bi * 3);
    // (the carried normals, as DEFORM's slotState writes a corner: x along the slot's bR (= up), y along du x bR - the texels
    // 12-15 proposed for dmg_members.js; here beside it)
    { const du = V.nrm(V.sub(Bp, A)), wv = V.cross(du, up); ext.N2[i] = CA.map(q => { const a2 = V.dot(q.n3, up), b2 = V.dot(q.n3, wv), l = Math.hypot(a2, b2) || 1; return [a2 / l, b2 / l]; }); }
    // (no outline - the cut found under three corners: no slot; the gap stays as today)
    if (x.hullN >= 3) { ext.slotOf[i] = ext.slots.length; ext.slots.push({ bi, mode: DM.MODE.torn, kt1: 0.5, tb: 0.5, dk: 0, axis: up }); } else ext.slotOf[i] = -1;
  });
  ext.M = M; ext.T = { nb: nbX, n: n + 2 * X.length, beams: ext.beams };
  return ext;
}
// each posed frame: the virtual nodes' live places and turns (skin_break onNodes: sum w live + q (x - sum w rest), q the
// weights' blended turn), appended to the physics' - what app.js would hand DEFORM's frame()
function liveOf(ext, simP, NF) {
  const nX = n + ext.ride.length, live = new Float64Array(nX * 3), Q = new Float64Array(nX * 4);
  live.set(simP.subarray(0, n * 3)); Q.set(NF.q.subarray(0, n * 4));
  ext.ride.forEach((r, j) => { if (!r.ws.length) { live.set(r.x, (n + j) * 3); Q.set([0, 0, 0, 1], (n + j) * 4); return; } let l = [0, 0, 0], rs = [0, 0, 0], q = [0, 0, 0, 0], W = 0; const d = r.ws.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    for (const [i, w] of r.ws) { W += w; for (let k = 0; k < 3; k++) { l[k] += w * simP[i * 3 + k]; rs[k] += w * P.rest[i * 3 + k]; }
      const sg = (NF.q[i * 4] * NF.q[d * 4] + NF.q[i * 4 + 1] * NF.q[d * 4 + 1] + NF.q[i * 4 + 2] * NF.q[d * 4 + 2] + NF.q[i * 4 + 3] * NF.q[d * 4 + 3]) < 0 ? -w : w;
      for (let k = 0; k < 4; k++) q[k] += sg * NF.q[i * 4 + k]; }
    l = V.mul(l, 1 / W); rs = V.mul(rs, 1 / W); const ql = Math.hypot(...q) || 1; q = q.map(x => x / ql);
    const o = qrot(q, V.sub(r.x, rs)); live.set(V.add(l, o), (n + j) * 3); Q.set(q, (n + j) * 4); });
  return { live, Q };
}
// THE NORMAL CARRIED (the proposed change, mirrored): DEFORM's pose() gives a vertex's normal from its corner's DIRECTION
// (normalize(N cn + B cs), N and B its ring's frame) - smooth all round, a box drawn as a rounded bar, nothing of the
// part's own. Here the ring's frame (N, B) is recovered from two corners' pose() normals (they are exactly N cn + B cs) and
// the corner's CARRIED normal (n2: x along bR, y along du x bR - texels 12-15 proposed) is put through it. The place is
// pose()'s, untouched. n2 null: pose()'s own normal (DEFORM's pool as it stands)
function poseN(S, u, k, pc, n2) {
  const r = DM.pose(S, u, k, pc); if (!n2) return r;
  const nK = S[28] | 0, kc = k < nK ? k : 0, c = j => { const x = S[32 + j * 2], y = S[33 + j * 2], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const ck = c(kc); let j = -1, best = 0;
  for (let q = 0; q < nK; q++) { const cq = c(q), dt = Math.abs(ck[0] * cq[1] - ck[1] * cq[0]); if (dt > best) { best = dt; j = q; } }
  if (j < 0 || best < 0.2) return r;
  const rj = DM.pose(S, u, j, pc), cj = c(j), det = ck[0] * cj[1] - cj[0] * ck[1];
  // [nk nj] = [N B] [[ck0 cj0], [ck1 cj1]]  ->  N = (nk cj1 - nj ck1) / det, B = (nj ck0 - nk cj0) / det
  const nk = [r[3], r[4], r[5]], nj = [rj[3], rj[4], rj[5]];
  const N = V.mul(V.sub(V.mul(nk, cj[1]), V.mul(nj, ck[1])), 1 / det), Bv = V.mul(V.sub(V.mul(nj, ck[0]), V.mul(nk, cj[0])), 1 / det);
  const m = n2[kc], nn = V.nrm(V.add(V.mul(N, m[0]), V.mul(Bv, m[1])));
  const out = r.slice(); out[3] = nn[0]; out[4] = nn[1]; out[5] = nn[2]; return out;
}
// a slot's triangles from DEFORM's pose() over its texels (both pieces, RINGS x AROUND, the pool's own index), each
// with its three VERTEX normals (drawn smooth); n2: the carried normals (null: pose()'s own). Also the smoothness read:
// the largest turn of a vertex normal ring to ring (along), and between neighbouring entries that are not a crease pair
function slotTris(S, nK, n2, st) {
  const tris = [], R = DM.RINGS, A = DM.AROUND;
  for (let pc = 0; pc < 2; pc++) { const vx = [];
    for (let i = 0; i < R; i++) for (let k = 0; k < A; k++) vx.push(poseN(S, i / (R - 1), k, pc, n2));
    if (st) for (let i = 0; i < R; i++) for (let k = 0; k < Math.min(nK, A); k++) { const a = vx[i * A + k], ang = (p, q) => Math.acos(Math.max(-1, Math.min(1, p[3] * q[3] + p[4] * q[4] + p[5] * q[5]))) * 180 / Math.PI;
      if (i + 1 < R && a[8] > 0.03 && vx[(i + 1) * A + k][8] > 0.03) st.along = Math.max(st.along, ang(a, vx[(i + 1) * A + k]));   // (3 cm or more off the torn lip: the tear is a hard edge)
      const k2 = (k + 1) % nK, b = vx[i * A + k2], same = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-7;
      if (same) st.crease = Math.max(st.crease, ang(a, b)); }
    for (let i = 0; i + 1 < R; i++) for (let k = 0; k < A; k++) { const k2 = (k + 1) % A, a = vx[i * A + k], b = vx[i * A + k2], c = vx[(i + 1) * A + k2], d = vx[(i + 1) * A + k];
      for (const tr of [[a, b, c], [a, c, d]]) { const bare = (tr[0][6] + tr[1][6] + tr[2][6]) / 3;
        const col = bare > 0.75 ? DM.COL.alloy.map(x => Math.min(1, x * 1.35)) : bare > 0.2 ? DM.COL.primer : PAINT;   // (alloy lifted for the print: the page lights it)
        tris.push({ p: tr.map(q => [q[0], q[1], q[2]]), n: tr.map(q => [q[3], q[4], q[5]]), col, back: col.map(x => x * DM.COL.bore), bare, spec: 0.25 }); } } }
  return tris;
}

// ---- RUN ----
const PC = piecesOf(G);
const lines = [], log = s => { lines.push(s); console.log(s); };
log('ALLOY SECTIONS prototype - the metal Cessna, ' + new Date().toISOString().slice(0, 10) + '; root ' + path.relative(process.cwd(), ROOT) + '; pool ' + (opt('pool', null) ? poolFile : 'origin/claude/dmg-looks dmg_members.js'));
log('the aluminium bucket: ' + PC.list.length + ' drawn pieces (' + PC.list.filter(p => p.run).length + ' runs / stringers, ' + PC.list.filter(p => !p.run).length + ' rings / formers), ' + (G.idx.length / 3) + ' triangles');
const perSlot = 2 * (DM.RINGS - 1) * DM.AROUND * 2;
let pic = null;
for (const cid of (opt('cases', 'trunk-0,trunk-2.5,noseover')).split(',')) {
  const t0 = Date.now(), F = fly(cid), tFly = Date.now() - t0;
  if (!F.R) { log(cid + ': nothing broke'); continue; }
  const t1 = process.hrtime.bigint(), X = crossings(F.R), ext = virtualise(X, F.R), tEv = Number(process.hrtime.bigint() - t1) / 1e6;
  // DEFORM's slotState for each slot (its static texels), then the posed frame's texels by hand (frame()'s writes)
  const d = new Float32Array(DM.SLOTS * DM.TX * 4), used = Math.min(ext.slots.length, DM.SLOTS);
  const t2 = process.hrtime.bigint(), LQ = liveOf(ext, F.sim.p, F.NF), tFr = Number(process.hrtime.bigint() - t2) / 1e6;
  const tris = [], st = { along: 0, crease: 0 }; let cracked = 0, parted = 0;
  for (let j = 0; j < used; j++) {
    const s = ext.slots[j], o = j * DM.TX * 4; DM.slotState(d, j, s, ext.M, ext.T, ext.rest, null);
    const b = ext.beams[s.bi]; d[o] = LQ.live[b.a * 3]; d[o + 1] = LQ.live[b.a * 3 + 1]; d[o + 2] = LQ.live[b.a * 3 + 2];
    d[o + 4] = LQ.live[b.b * 3]; d[o + 5] = LQ.live[b.b * 3 + 1]; d[o + 6] = LQ.live[b.b * 3 + 2];
    d.set(LQ.Q.subarray(b.a * 4, b.a * 4 + 4), o + 8); d.set(LQ.Q.subarray(b.b * 4, b.b * 4 + 4), o + 12);
    const S = d.subarray(o, o + DM.TX * 4), c = Math.hypot(d[o + 4] - d[o], d[o + 5] - d[o + 1], d[o + 6] - d[o + 2]);
    if (c < d[o + 19] * 0.999) cracked++; else parted++;
    tris.push(slotTris(S, ext.M.K[s.bi], ext.N2[s.bi - nb], st));
  }
  const gaps = X.map(x => x.gap).sort((a, b) => b - a);
  log(cid + ': broken ' + F.D.br.length + ', binding events ' + F.events + ' (flown ' + (tFly / 1000).toFixed(1) + ' s); the aluminium record: ' + (F.R.removed || 0) + ' removed, ' + (F.R.torn || 0) + ' torn');
  const dimsF = X.filter(x => !x.run && x.hullN >= 3).map(x => x.dims), dimsS = X.filter(x => x.run && x.hullN >= 3).map(x => x.dims), med = (A, k) => A.length ? (A.map(q => q[k]).sort((a, b) => a - b)[A.length >> 1] * 1000).toFixed(0) : '-';
  log('  crossings ' + X.length + ' (' + X.filter(x => x.run).length + ' on stringers, ' + X.filter(x => !x.run).length + ' on formers), gaps ' + (gaps.length ? gaps[0].toFixed(3) + ' m worst, ' + gaps[gaps.length >> 1].toFixed(3) + ' median' : '-') +
    '; outlines (median, mm) formers ' + med(dimsF, 0) + ' x ' + med(dimsF, 1) + ', stringers ' + med(dimsS, 0) + ' x ' + med(dimsS, 1) + '; slots ' + used + ' (of ' + DM.SLOTS + '; ' + X.filter(x => !(x.hullN >= 3)).length + ' crossings without an outline: none) - ' + cracked + ' cracked, ' + parted + ' parted; ' + (used * perSlot) + ' triangles (' + perSlot + ' a slot, DEFORM\'s pool as it stands)');
  const cr = X.filter(x => x.hullN >= 3), nCr = cr.reduce((a, x) => a + (x.creases || 0), 0), nBis = cr.reduce((a, x) => a + (x.bis || 0), 0);
  log('  normals (the user, 27 Oct: smooth, hard only at a real crease or the tear): carried from the part\'s own creased normals - ' + nCr + ' crease corners over ' + cr.length + ' sections (doubled entries: hard along the stub), ' + nBis + ' corners with no normal carried (their edges\' bisector); the largest turn of a vertex normal ring to ring 3 cm or more off the lip ' + st.along.toFixed(1) + ' deg; at a crease ' + st.crease.toFixed(0) + ' deg');
  log('  costs: the crossings and their virtual members at the event ' + tEv.toFixed(1) + ' ms; the virtual nodes a posed frame ' + tFr.toFixed(2) + ' ms (' + (2 * used) + ' nodes, 16 floats a slot as frame() writes)');
  if (cid === 'trunk-0' && X.length) pic = { F, X, ext, tris, d };
}
fs.writeFileSync(path.join(HERE, 'alloy_sec_proto.txt'), lines.join('\n') + '\n');

// ---- THE PICTURE: two crossings of the centreline crash (the widest on a former, the widest on a stringer) - today (the
// live 'aluminium' triangles round it, as posed) and with the stubs; then the widest one's slot alone, on a straight bar:
// unposed, cracked (its ends at 0.985 L0), parted (1.3 L0) ----
if (pic) {
  const { F, X, ext, tris, d } = pic, R = F.R, I = R.idx0 || G.idx, W = R.w, NW = creased(W, I, t => !R.dead[t]);
  const pick = run => { let j = -1; for (let i = 0; i < X.length; i++) if (X[i].run === run && X[i].hullN >= 4 && (j < 0 || X[i].gap > X[j].gap)) j = i; return j; };
  const chosen = [pick(false), pick(true)].filter(j => j >= 0 && ext.slotOf[j] >= 0);
  const Wd = 1600, H = 900, C = R3.Canvas(Wd, H, [0.95, 0.95, 0.94]);
  const notes = [];
  chosen.forEach((j, ci) => {
    const js = ext.slotOf[j], o = js * DM.TX * 4, cen = [(d[o] + d[o + 4]) / 2, (d[o + 1] + d[o + 5]) / 2, (d[o + 2] + d[o + 6]) / 2];
    // the live former round it: TODAY as the page draws it (the snapshot's per-face normals: flat), and with the part's own
    // CREASED normals taken on its posed shape (the bake proposed for the join's snapshot: smooth, hard at 60 deg+)
    const near = [], nearS = [];
    for (let t = 0; t < I.length / 3; t++) { if (R.dead && R.dead[t]) continue; const p = [0, 1, 2].map(q => [W[I[t * 3 + q] * 3], W[I[t * 3 + q] * 3 + 1], W[I[t * 3 + q] * 3 + 2]]);
      if (p.some(q => !Number.isFinite(q[0])) || Math.hypot(...V.sub(p[0], cen)) > 0.22) continue;
      near.push({ p, col: PAINT, back: PAINT.map(x => x * 0.5), spec: 0.25 });
      nearS.push({ p, n: [0, 1, 2].map(q => [NW[I[t * 3 + q] * 3], NW[I[t * 3 + q] * 3 + 1], NW[I[t * 3 + q] * 3 + 2]]), col: PAINT, back: PAINT.map(x => x * 0.5), spec: 0.25 }); }
    const T0 = V.nrm([d[o + 4] - d[o], d[o + 5] - d[o + 1], d[o + 6] - d[o + 2]]), yaw = Math.atan2(T0[2], T0[0]) + Math.PI / 2 + 0.5;
    const view = ox => ({ yaw, pitch: 0.55, scale: 1500, ox, oy: 250, cx: cen[0], cy: cen[1], cz: cen[2] });
    R3.draw(C, view(200 + ci * 800), near); R3.draw(C, view(600 + ci * 800), nearS.concat(tris[js]));
    notes.push('top ' + (ci ? 'right' : 'left') + ' pair: crossing ' + j + ' on a ' + (X[j].run ? 'stringer' : 'former') + ', gap ' + X[j].gap.toFixed(3) + ' m, outline ' + X[j].hullN + ' -> ' + ext.M.K[ext.slots[js].bi] + ' corners, r ' + ext.M.r[ext.slots[js].bi].toFixed(4) + ' m - today (the page\'s per-face normals) | the stubs (carried normals) on the former with its creased normals');
  });
  const j = chosen[0], o = ext.slotOf[j] * DM.TX * 4, Ssrc = d.subarray(o, o + DM.TX * 4), L0 = Ssrc[19], du = [Ssrc[16], Ssrc[17], Ssrc[18]], sl = ext.slots[ext.slotOf[j]];
  const n2 = ext.N2[sl.bi - nb];
  const mk = (sep, mode, carried) => { const S = Float32Array.from(Ssrc); S[0] = 0; S[1] = 0; S[2] = 0; S[4] = du[0] * L0 * sep; S[5] = du[1] * L0 * sep; S[6] = du[2] * L0 * sep;
    S[7] = mode; S[8] = S[9] = S[10] = 0; S[11] = 1; S[12] = S[13] = S[14] = 0; S[15] = 1; return slotTris(S, ext.M.K[sl.bi], carried ? n2 : null, null); };
  const bar = (tr, ox, sep) => { const c0 = V.mul(du, L0 * sep / 2); R3.draw(C, { yaw: Math.atan2(du[2], du[0]) + Math.PI / 2 + 0.6, pitch: 0.5, scale: 1700, ox, oy: 690, cx: c0[0], cy: c0[1], cz: c0[2] }, tr); };
  bar(mk(1.3, DM.MODE.torn, false), 200, 1.3); bar(mk(1, DM.MODE.whole, true), 600, 1); bar(mk(0.985, DM.MODE.torn, true), 1000, 0.985); bar(mk(1.3, DM.MODE.torn, true), 1400, 1.3);
  R3.save(C, path.join(HERE, 'alloy_sec_proto.png'));
  notes.push('bottom: crossing ' + j + '\'s slot alone (L0 ' + L0.toFixed(3) + ' m): parted with pose()\'s own normals (the pool as it stands: rounded all round) | carried normals: unposed | cracked at 0.985 L0 | parted at 1.3 L0; colours: the paint (stand-in), the GREY PRIMER band, the BARE ALLOY rim, the open inside dark');
  fs.appendFileSync(path.join(HERE, 'alloy_sec_proto.txt'), 'picture alloy_sec_proto.png:\n  ' + notes.join('\n  ') + '\n');
  if (argv.includes('--debug')) { const x = X[j];
    console.log('DEBUG crossing', j, 'gap', x.gap.toFixed(3), 'slab', x.A.slab.length, 'hull', x.hullN, 'K', ext.M.K[sl.bi], 'r', ext.M.r[sl.bi].toFixed(4), 'sep', Math.hypot(d[o + 4] - d[o], d[o + 5] - d[o + 1], d[o + 6] - d[o + 2]).toFixed(4), 'L0', L0.toFixed(4));
    const hist = {}; X.forEach(q => { hist[q.hullN] = (hist[q.hullN] || 0) + 1; }); console.log('  outline corners over the crossings', JSON.stringify(hist));
    console.log('  outline dims (deep x wide, mm):', X.map(q => q.dims ? (q.dims[0] * 1000).toFixed(0) + 'x' + (q.dims[1] * 1000).toFixed(0) + (q.run ? 's' : 'f') : '-').join(' ')); }
}
if (!opt('pool', null)) try { fs.unlinkSync(poolFile); } catch (e) { /* tmp */ }
