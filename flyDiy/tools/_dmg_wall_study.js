#!/usr/bin/env node
// G1855-G1859 (DMG-WALL): THE WALL AND THE PARTS, MEASURED IN NODE - the flown cage snapshot of a validated build, built
// headless (tools/_dmg_wall_lib.js: the cage's own sheet, the parts' layers, CAGE_JOIN.snapshot - one payload group a
// section or a colour, with G1859's layer ranges), ridden as app.js brkCage rides it (skin_break.js: the records, the
// events, the nodes' frames in the world, poseCage, the tear), on GATE DMGSKIN's crash cases and the brief's taxi and
// nose-over, damage ON, three bindings side by side on the same crash:
//   base  - the records as they are (each place its 4 nearest nodes, D4a / G1864);
//   g1858 - base + the lining cut at the damage (skin_break.js cutWall);
//   inh   - the binding inherited (skin_break.js bindInherit: the tubes on their members, the covering on its frame, the
//           lining / beads / glazing on their covering point, a compact part one binding), the wall following its
//           covering (wallFollow), no stretch tear on the tubes / parts / sheet metal.
// Measured every frame from the first break:
//   leak   - every 'wall' place (the lining, the fireproof, the sill, the door pads, the beads, the glazing) against the
//            covering triangle closest to it at rest: its signed depth under that triangle's LIVE plane, sign taken at
//            rest; a place out through it past 1 mm (both live) is a leak (place-frames / tested; the worst);
//   rigid  - every triangle of a compact part (one layer object under 1.2 m: a cowl panel, a fitting, a light): its edge
//            and area change against rest - the brief's 1 %;
//   bay    - covering triangles torn by stretch with none of their nodes at the damage (a bay whose members all hold);
//   pieces, removed / torn, the binding's own stats (over 8 nodes: the GPU's fallback).
// Run: node tools/_dmg_wall_study.js [--build cub] [--cases trunk-0,trunk-2.5,taxi,noseover] [--out <json>]
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const WL = require('./_dmg_wall_lib.js');
const L = require('./_treecrash_lib.js');
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
const AS = WL.AS;

const CASES = {
  'trunk-0':   { kind: 'trunk', o: { D: 40, agl: 4, V: 30, off: 0, secs: 5 } },
  'trunk-2.5': { kind: 'trunk', o: { D: 40, agl: 4, V: 30, off: 2.5, secs: 5 } },
  'taxi':      { kind: 'trunk', o: { D: 6, agl: 0, V: 3, off: 0, secs: 6 } },
  'noseover':  { kind: 'trunk', o: { D: 12, agl: 0, V: 12, off: 0, top: 0.35, r: 0.25, secs: 6 } },
  'nosein':    { kind: 'ground', o: { V: 50, sink: 10, pitch: 60, secs: 4 } },
  'nosein-water': { kind: 'water', o: { V: 150 / 3.6, sink: 10, pitch: 60, secs: 4 } },
};
function go(k, c) {
  const C = L.core(), o = c.o, def = L.defOf(k);
  const pitchAndDrop = (sim, top) => {
    const n = sim.n, p = sim.p, v = sim.v, [xA, , zR] = sim.axes(), c0 = sim.cgPos();
    const th = -(o.pitch || 0) * Math.PI / 180, kk = zR, cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) { const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = kk[0]*d[0] + kk[1]*d[1] + kk[2]*d[2];
      const cr = [kk[1]*d[2] - kk[2]*d[1], kk[2]*d[0] - kk[0]*d[2], kk[0]*d[1] - kk[1]*d[0]];
      for (let j = 0; j < 3; j++) p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + kk[j] * kd * (1 - cs); }
    let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - def.nodes[i].r);
    const hl = Math.hypot(xA[0], xA[2]);
    for (let i = 0; i < n; i++) { p[i*3+1] += top(c0) + 0.3 - yMin; v[i*3] = -o.V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -o.V * xA[2] / hl; }
    sim.ctl.thr = 0;
  };
  if (c.kind === 'trunk') {
    const elev = 300, { W, TH, strip } = L.flatWorld(elev), sim = C.makeSim(def, W);
    sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
    if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
    for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
    const c0 = sim.cgPos().slice(), off = o.off || 0;
    TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev, o.r || 0.3, elev + (o.top || 10.05)]);
    sim.ctl.thr = 0;
    return { sim, def, N: o.secs * 60 };
  }
  if (c.kind === 'ground') { const { W } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0); pitchAndDrop(sim, () => 0); return { sim, def, N: o.secs * 60 }; }
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA'), sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  pitchAndDrop(sim, c0 => world.waterH(c0[0], c0[2]));
  return { sim, def, N: o.secs * 60 };
}
const basis = (X, Y) => { const Z = [X[1]*Y[2]-X[2]*Y[1], X[2]*Y[0]-X[0]*Y[2], X[0]*Y[1]-X[1]*Y[0]]; return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]]; };

// the snapshot's groups in the design frame, each place's class and object (the layer ranges)
function prepare(k) {
  const B = L.BUILDS[k], S = WL.snapshotOf(B.build, { patch: B.patch });
  const def = L.defOf(k), n = def.nodes.length;
  if (S.def.nodes.length !== n) throw new Error('the snapshot def and the physics def differ: ' + S.def.nodes.length + ' / ' + n);
  const rest = new Float64Array(n * 3); def.nodes.forEach((d, i) => { rest[i*3] = d.p[0]; rest[i*3+1] = d.p[1]; rest[i*3+2] = d.p[2]; });
  const B0 = basis(S.X, S.Y), og = S.org, o = S.o;
  const lay = new Map(); for (const [ly, key, a, b, id] of (S.snap.layers || [])) { let Lr = lay.get(key); if (!Lr) lay.set(key, Lr = []); Lr.push([ly, a, b, id]); }
  const groups = S.groups.map(g => {
    const nv = g.nv, bD = new Float64Array(nv * 3);
    for (let v = 0; v < nv; v++) { const a = g.pos[v*3] + o[0], b = g.pos[v*3+1] + o[1], c = g.pos[v*3+2] + o[2];
      bD[v*3] = og[0] + B0[0]*a + B0[1]*b + B0[2]*c; bD[v*3+1] = og[1] + B0[3]*a + B0[4]*b + B0[5]*c; bD[v*3+2] = og[2] + B0[6]*a + B0[7]*b + B0[8]*c; }
    const role = g.sec ? (AS.AERO_ROLE[g.sec] || '') : '';
    const cv = new Uint8Array(nv), obj = new Int32Array(nv).fill(-1), layer = new Array(nv).fill('');
    for (const [ly, a, b, id] of (lay.get(g.key) || [])) for (let v = a; v < b; v++) { layer[v] = ly; obj[v] = id; }
    for (let v = 0; v < nv; v++) cv[v] = SB.inhClass(g.sec, role, layer[v]);
    // (a part object wider than RIGID_D is bound as covering, not rigid: not measured as rigid either)
    const ext = new Map(); for (let v = 0; v < nv; v++) if (cv[v] === SB.INH.rigid) { let e = ext.get(obj[v]); if (!e) ext.set(obj[v], e = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
      for (let j = 0; j < 3; j++) { e[j] = Math.min(e[j], bD[v*3+j]); e[j+3] = Math.max(e[j+3], bD[v*3+j]); } }
    const big = new Set(); for (const [id, e] of ext) if (Math.hypot(e[3] - e[0], e[4] - e[1], e[5] - e[2]) > 1.2) big.add(id);
    var rigidOk = new Uint8Array(nv); for (let v = 0; v < nv; v++) rigidOk[v] = cv[v] === SB.INH.rigid && !big.has(obj[v]) ? 1 : 0;
    return { key: g.key, sec: g.sec, role, nv, idx: g.idx, bD, cv, obj, layer, rigidOk };
  });
  return { k, S, def, rest, groups, T: SB.topo(def.beams, n), fabric: def.spec && def.spec.material === 'tubeFabric' };
}

function run(P, caseId) {
  const C = L.core(), c = CASES[caseId], G = go(P.k, c), sim = G.sim, n = sim.n;
  const core = P.def.refs.noseFrame[0], hop = SH.simDmgHop0(), D = SV.simViewDmgState(n, P.def.beams.length);
  const schemes = (opt('schemes', 'base,g1858,inh')).split(',').map(name => ({ name, recs: null, NF: {}, E: null, inhSt: null, wallKey: null,
    m: { frames: 0, tubeTris: 0, tubeBad: 0, tubeWorst: 0, nonFinite: 0, tnsBy: {}, tornNoStrain: 0, overStretched: 0, leak1cm: 0, leak5cm: 0, leakPiece: 0, leakBy: {}, leak: 0, tested: 0, worstLeak: 0, rigidTris: 0, rigidBad: 0, rigidWorst: 0, bayTorn: 0, removed: 0, torn: 0, cut: 0, followed: 0 } }));
  const X = (R) => ({ Mi: [1, 0, 0, 0, 1, 0, 0, 0, 1], B: [1, 0, 0, 0, 1, 0, 0, 0, 1], cg: [0, 0, 0], o: [0, 0, 0], w: R.w, n: null, nB: null });
  const scratch = new Map();
  // the measure's own map, scheme-free: each wall place's closest covering triangle at rest (the inheritance's search)
  let wallMap = null;
  const mkRecs = sc => {
    const K = sc.name === 'inh' ? SB.INH_K : SB.NEAR_K;
    sc.recs = P.groups.map(g => { const R = SB.make({ nv: g.nv, idx: g.idx.slice() }, K, { fabric: P.fabric && g.cv.indexOf(SB.INH.cover) >= 0, cage: true, pos: g.bD, rest: P.rest, weld: true, rideAll: true });
      R.w = new Float64Array(g.nv * 3); R.gk = g; return R; });
    if (sc.name === 'inh') {
      sc.E = sc.recs.map((R, i) => ({ R, cv: P.groups[i].cv, obj: P.groups[i].obj }));
      const t0 = Date.now(); sc.inhSt = SB.bindInherit(sc.E, P.T, P.rest); sc.inhSt.ms = Date.now() - t0;
      sc.recs.forEach((R, i) => { const cv = P.groups[i].cv; if (!P.fabric || cv.indexOf(SB.INH.tube) >= 0 || cv.indexOf(SB.INH.rigid) >= 0 && cv.indexOf(SB.INH.cover) < 0) R.noTear = true; });
    }
    if (!wallMap) {
      const E = sc.recs.map((R, i) => ({ R, cv: P.groups[i].cv })), Gd = SB.coverGrid(E);
      wallMap = P.groups.map((g, i) => { if (g.cv.indexOf(SB.INH.wall) < 0) return null; const R = sc.recs[i], m = new Int32Array(g.nv * 2).fill(-1), b = new Float64Array(g.nv * 3), d0 = new Float64Array(g.nv);
        for (let v = 0; v < g.nv; v++) { if (g.cv[v] !== SB.INH.wall || (R.rep && R.rep[v] !== v)) continue;
          const h = SB.closestCover(Gd, E, g.bD[v*3], g.bD[v*3+1], g.bD[v*3+2], 0.15); if (!h) continue;
          m[v*2] = h.r; m[v*2+1] = h.t; b.set(h.b, v * 3);
          d0[v] = sideOf(P.groups[h.r].bD, P.groups[h.r].idx, h.t, h.b, g.bD, v); }
        return { m, b, d0 }; });
    }
  };
  // the signed offset of place v (pos Q) off triangle t of a group (positions A, index I) along its normal, at bary b
  function sideOf(A, I, t, b, Q, v) {
    const a = I[t*3] * 3, bb = I[t*3+1] * 3, cc = I[t*3+2] * 3;
    const ux = A[bb] - A[a], uy = A[bb+1] - A[a+1], uz = A[bb+2] - A[a+2], wx = A[cc] - A[a], wy = A[cc+1] - A[a+1], wz = A[cc+2] - A[a+2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const px = b[0] * A[a] + b[1] * A[bb] + b[2] * A[cc], py = b[0] * A[a+1] + b[1] * A[bb+1] + b[2] * A[cc+1], pz = b[0] * A[a+2] + b[1] * A[bb+2] + b[2] * A[cc+2];
    return (Q[v*3] - px) * nx + (Q[v*3+1] - py) * ny + (Q[v*3+2] - pz) * nz;
  }
  let first = -1;
  for (let s = 1; s <= G.N; s++) {
    sim.step(1 / 60);
    const PI = SH.simDmgHop(sim, hop, core, 0); if (PI) SV.simViewDmgApply(D, PI);
    if (!D.br.length) continue;
    if (first < 0) first = s;
    for (const sc of schemes) {
      if (!sc.recs) mkRecs(sc);
      let evd = false; for (const R of sc.recs) evd = SB.event(R, P.T, D, P.rest, R.g.pos) || evd;
      if (evd && sc.E) for (const E of sc.E) if (E.on) SB.wallSync(E, sc.E);
      if (sc.name === 'g1858') { const key = D.vB + '|' + D.sS; if (sc.wallKey !== key) { sc.wallKey = key; const hot = SB.hotNodes(P.T, D);
        sc.recs.forEach((R, i) => { const g = P.groups[i]; if (g.sec && ['liner', 'fire', 'sill', 'doorPad'].includes(g.role)) SB.cutWall(R, hot); }); } }
      SB.nodeFrames(sc.NF, P.T, D, P.rest, sim.p, true);
      for (const R of sc.recs) { let pos = scratch.get(R.nv); if (!pos) scratch.set(R.nv, pos = new Float32Array(R.nv * 3));
        SB.poseCage(R, P.rest, sim.p, R.g.pos, pos, sc.NF, [0, -1, 0], null, X(R)); SB.tear(R, R.g.pos, R.w); }
      if (sc.E) for (const E of sc.E) if (E.on) SB.wallFollow(E, sc.E);
      measure(sc, D);
    }
  }
  function measure(sc, Dd) {
    const m = sc.m; m.frames++;
    for (const R of sc.recs) { const W = R.w; for (let q = 0; q < W.length; q++) if (!Number.isFinite(W[q])) { m.nonFinite++; break; } }
    // a covering triangle torn this frame while its own frame held: none of the members among its places' nodes broken,
    // none strained past the tear's 15 % (the drawing stretched where the structure did not)
    if (!sc.seen) sc.seen = sc.recs.map(R => new Uint8Array(R.nt));
    sc.recs.forEach((R, i) => { if (!R.dead || !R.torn) return; const g = P.groups[i], ix = R.idx0, sn = sc.seen[i], K = R.K;
      for (let t = 0; t < R.nt; t++) { if (R.dead[t] !== 2 || sn[t]) continue; sn[t] = 1;
        if (g.cv[ix[t*3]] !== SB.INH.cover) continue;
        const nodes = new Set(); for (let q = 0; q < 3; q++) { const v = ix[t*3+q]; for (let k = 0; k < K; k++) if (R.w2[v*K+k] > 0.05) nodes.add(R.wi[v*K+k]); }
        let strained = false; const ns = [...nodes];
        for (let a = 0; a < ns.length && !strained; a++) for (let b = a + 1; b < ns.length && !strained; b++) {
          const L2 = P.T.pairs.get(Math.min(ns[a], ns[b]) * P.T.n + Math.max(ns[a], ns[b])); if (!L2) continue;
          for (const bi of L2) { if (Dd.broken[bi]) { strained = true; break; } const bm = P.T.beams[bi], x = ns[a] * 3, y = ns[b] * 3;
            const l = Math.hypot(sim.p[bm.a*3] - sim.p[bm.b*3], sim.p[bm.a*3+1] - sim.p[bm.b*3+1], sim.p[bm.a*3+2] - sim.p[bm.b*3+2]);
            const r0 = Math.hypot(P.rest[bm.a*3] - P.rest[bm.b*3], P.rest[bm.a*3+1] - P.rest[bm.b*3+1], P.rest[bm.a*3+2] - P.rest[bm.b*3+2]);
            if (Math.abs(l / r0 - 1) > 0.15) { strained = true; break; } } }
        if (!strained) { m.tornNoStrain++; const kk = (g.sec || g.key) + ':' + (g.layer[ix[t*3]] || '-'); m.tnsBy[kk] = (m.tnsBy[kk] || 0) + 1; } } });
    const hot = SB.hotNodes(P.T, Dd);
    // leak
    P.groups.forEach((g, i) => { const WM = wallMap[i]; if (!WM) return; const R = sc.recs[i];
      const alive = new Uint8Array(g.nv), ix = R.idx0 || R.idx; for (let q = 0; q < R.nt; q++) if (!R.dead || !R.dead[q]) { alive[ix[q*3]] = alive[ix[q*3+1]] = alive[ix[q*3+2]] = 1; }
      if (R.rep) for (let v = 0; v < g.nv; v++) if (alive[v]) alive[R.rep[v]] = 1;
      for (let v = 0; v < g.nv; v++) { const r = WM.m[v*2]; if (r < 0 || !alive[v]) continue; const t = WM.m[v*2+1], C = sc.recs[r];
        if (C.dead && C.dead[t]) continue;
        { const I = P.groups[r].idx, A = P.groups[r].bD, Wc = C.w; let bad = false;
          for (const [p, q] of [[I[t*3], I[t*3+1]], [I[t*3+1], I[t*3+2]], [I[t*3], I[t*3+2]]]) { const r0 = Math.hypot(A[p*3] - A[q*3], A[p*3+1] - A[q*3+1], A[p*3+2] - A[q*3+2]);
            const l = Math.hypot(Wc[p*3] - Wc[q*3], Wc[p*3+1] - Wc[q*3+1], Wc[p*3+2] - Wc[q*3+2]); if (!(l <= 1.15 * r0 + 0.01)) bad = true; }
          if (bad) { m.overStretched++; continue; } }
        if (Math.abs(WM.d0[v]) < 0.001) continue;
        // (the place's own triangles: one alive)
        m.tested++;
        const d = sideOf(C.w, P.groups[r].idx, t, WM.b.subarray(v * 3, v * 3 + 3), R.w, v) * Math.sign(WM.d0[v]);
        if (d < -0.001 && -d > m.worstLeak && process.env.DBG && sc.name === process.env.DBG) {
          const I = P.groups[r].idx, K = R.K, Kc = C.K, f3 = a => Array.from(a).map(x => +x.toFixed(3));
          m.dbg = { d, sec: g.sec, v, t, w2: f3(R.w2.subarray(v * K, v * K + K)), wi: Array.from(R.wi.subarray(v * K, v * K + K)), vp: R.vp[v], pos: f3(R.w.subarray(v * 3, v * 3 + 3)), rest: f3(g.bD.subarray(v * 3, v * 3 + 3)),
            cov: [0, 1, 2].map(q => { const u = I[t * 3 + q]; return { u, vp: C.vp[u], w2: f3(C.w2.subarray(u * Kc, u * Kc + Kc)), wi: Array.from(C.wi.subarray(u * Kc, u * Kc + Kc)), pos: f3(C.w.subarray(u * 3, u * 3 + 3)), rest: f3(P.groups[r].bD.subarray(u * 3, u * 3 + 3)) }; }),
            on: sc.E ? [sc.E[i].on[v * 2], sc.E[i].on[v * 2 + 1]] : null, meas: [r, t], rep: R.rep ? R.rep[v] : null, repW2: R.rep ? f3(R.w2.subarray(R.rep[v] * K, R.rep[v] * K + K)) : null,
            repWi: R.rep ? Array.from(R.wi.subarray(R.rep[v] * K, R.rep[v] * K + K)) : null, repPos: R.rep ? f3(R.w.subarray(R.rep[v] * 3, R.rep[v] * 3 + 3)) : null, repRest: R.rep ? f3(g.bD.subarray(R.rep[v] * 3, R.rep[v] * 3 + 3)) : null }; }
        if (d < -0.001) { m.leak++; if (-d > m.worstLeak) m.worstLeak = -d; if (-d > 0.01) m.leak1cm++; if (-d > 0.05) m.leak5cm++;
          if (R.vp && C.vp && R.vp[v] !== C.vp[P.groups[r].idx[t*3]]) m.leakPiece++;
          const lk = g.sec || g.key; m.leakBy[lk] = (m.leakBy[lk] || 0) + 1; } } });
    // rigid parts and bays
    P.groups.forEach((g, i) => { const R = sc.recs[i], ix = R.idx0 || R.idx, A = g.bD, W = R.w;
      for (let t = 0; t < R.nt; t++) { if (R.dead && R.dead[t]) continue;
        const a = ix[t*3], b = ix[t*3+1], c = ix[t*3+2];
        // (a drawn tube: no edge past its rest by more than the solver's whole members allow (15 %) + 5 %)
        if (g.cv[a] === SB.INH.tube && g.cv[b] === SB.INH.tube && g.cv[c] === SB.INH.tube) { let w = 0;
          for (const [p, q] of [[a, b], [b, c], [a, c]]) { const r0 = Math.hypot(A[p*3] - A[q*3], A[p*3+1] - A[q*3+1], A[p*3+2] - A[q*3+2]); if (r0 < 0.004) continue;
            const l = Math.hypot(W[p*3] - W[q*3], W[p*3+1] - W[q*3+1], W[p*3+2] - W[q*3+2]); w = Math.max(w, l / r0); }
          m.tubeTris++; if (w > 1.2) m.tubeBad++; if (w > m.tubeWorst) m.tubeWorst = w; }
        if (g.rigidOk[a] && g.rigidOk[b] && g.rigidOk[c] && g.obj[a] === g.obj[b] && g.obj[b] === g.obj[c]) {
          let worst = 0;
          for (const [p, q] of [[a, b], [b, c], [a, c]]) { const r0 = Math.hypot(A[p*3] - A[q*3], A[p*3+1] - A[q*3+1], A[p*3+2] - A[q*3+2]); if (r0 < 0.004) continue;
            const l = Math.hypot(W[p*3] - W[q*3], W[p*3+1] - W[q*3+1], W[p*3+2] - W[q*3+2]); worst = Math.max(worst, Math.abs(l / r0 - 1)); }
          m.rigidTris++; if (worst > 0.01) m.rigidBad++; if (worst > m.rigidWorst) m.rigidWorst = worst; }
      }
      if (R.dead) for (let t = 0; t < R.nt; t++) if (R.dead[t] === 2 && !R._bayCounted) {} });
  }
  // the end: torn covering over bays whose nodes are none at the damage
  const out = { case: caseId, firstBreak: first, broken: D.br.length, pieces: D.nPc, crashed: sim.damage().crashed, schemes: {} };
  const hotEnd = SB.hotNodes(P.T, D);
  for (const sc of schemes) { if (!sc.recs) { out.schemes[sc.name] = null; continue; }
    const m = sc.m;
    sc.recs.forEach((R, i) => { const g = P.groups[i]; m.removed += R.removed; m.torn += R.torn; m.cut += R.cut || 0; m.followed += R.followed || 0;
      if (R.dead) for (let t = 0; t < R.nt; t++) if (R.dead[t] === 2) { const ix = R.idx0;
        let h = false; for (let q = 0; q < 3 && !h; q++) { const v = ix[t*3+q]; for (let k = 0; k < R.K; k++) if (R.ww[v * R.K + k] > 0.05 && hotEnd[R.wi[v * R.K + k]]) { h = true; break; } }
        if (!h && g.cv[ix[t*3]] === SB.INH.cover) m.bayTorn++; } });
    out.schemes[sc.name] = Object.assign({}, m, { leakShare: m.tested ? +(m.leak / m.tested).toFixed(5) : 0, worstLeak: +m.worstLeak.toFixed(4), rigidWorst: +m.rigidWorst.toFixed(4), inh: sc.inhSt });
  }
  return out;
}

if (require.main === module) {
  const k = opt('build', 'cub'), P = prepare(k);
  const cnt = {}; for (const g of P.groups) for (let v = 0; v < g.nv; v++) { const c = Object.keys(SB.INH).find(x => SB.INH[x] === g.cv[v]); cnt[c] = (cnt[c] || 0) + 1; }
  console.log('build ' + k + ': ' + P.groups.length + ' groups, classes ' + JSON.stringify(cnt));
  const res = { build: k, cases: [] };
  for (const cid of opt('cases', 'trunk-0,trunk-2.5,taxi,noseover').split(',')) {
    const t0 = Date.now(), r = run(P, cid); r.ms = Date.now() - t0; res.cases.push(r);
    console.log(cid + ' (' + r.ms + ' ms) broken ' + r.broken + ' pieces ' + r.pieces + ' first ' + r.firstBreak);
    for (const [nm, s] of Object.entries(r.schemes)) if (s) console.log('  ' + nm.padEnd(6) + ' leak ' + s.leak + '/' + s.tested + ' (' + s.leakShare + ', >1cm ' + s.leak1cm + ', >5cm ' + s.leak5cm + ', piece ' + s.leakPiece + ', worst ' + s.worstLeak + ' m) by ' + JSON.stringify(s.leakBy) + '\n         tornNoStrain ' + s.tornNoStrain + ' overStretched ' + s.overStretched + ' rigid bad ' + s.rigidBad + '/' + s.rigidTris + ' worst ' + s.rigidWorst +
      '  bayTorn ' + s.bayTorn + '  removed ' + s.removed + ' torn ' + s.torn + ' cut ' + s.cut + ' followed ' + s.followed + (s.inh ? '  inh ' + JSON.stringify(s.inh) : '') + (s.dbg ? '\n DBG ' + JSON.stringify(s.dbg) : ''));
  }
  if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify(res, null, 1));
}
module.exports = { prepare, run, CASES };
