#!/usr/bin/env node
// GATE DMGWALL (G1857, DMG-D4c THE WALL) - THE COVERING AND ITS INSIDE STAY ONE WALL OVER A BREAK, node only. The user
// (2026-10-05): "There is a skin and an inside skin ... they really are the same physical thing ... the outside should
// never get inside the inside." On the validated builds' FLOWN CAGE SNAPSHOT (built headless: tools/_dmg_wall_lib.js -
// the page's drawing layers, the cage's own sheet as _cage_ui.js draws it, CAGE_JOIN.snapshot: one payload group per
// section, in the flown visual frame), damage ON, on GATE DMGSKIN's crash cases (the 30 m/s trunk on the centreline and
// 2.5 m out, the severe ground nose-in; the severe float nose-in on the floatplanes), app.js brkCage's path run on the
// snapshot's fuselage groups as the page runs it (skin_break.js: the records, the events, the nodes' frames, poseCage,
// the tear; skin_wall.js: the wall's event, its pose, the inside's tear on the wall), from the first break EVERY frame:
//   a. NO INSIDE-WALL VERTEX OUTSIDE THE COVERING: each inside vertex the wall poses (and every inside vertex G1851 makes
//      ride its nodes) is measured against the LIVE covering on its own (its nearest live covering triangle, the signed
//      distance along the covering's live inward normal there - not the wall's own construction): out past TOL_OUT
//      (and past its rest standing, for the few the base already draws outside at rest) is a leak. Reported BEFORE (the
//      inside on its own nodes: G1851's drawing, the branch base) and AFTER (the wall);
//   b. THE WALL'S THICKNESS KEPT: that depth within [rest - BAND, rest + BAND] (BAND = 2 mm + 10 % of the rest depth),
//      except where the crease clamp held it (counted);
//   c. NO INSIDE TRIANGLE LIVE OVER A REMOVED COVERING TRIANGLE: an inside triangle with a vertex bound to a covering
//      triangle that is removed or torn is removed with it;
//   d. AT REST THE WALL IS THE REST: every inside-wall vertex bound and posed on the covering at rest - 0.0 mm off;
//   e. NOTHING CHANGES WITH NOTHING BROKEN: before the first break, and with damage OFF on every frame of the same crash,
//      the inside layers' vertices are bit for bit their rest (what the base draws: nothing writes them).
// Counts per build: the sections (covering / inside-wall / furniture), the inside vertices on the wall and those with no
// covering within BOUND (they keep G1851's node binding), by section. The cost: the wall's events and its pose a frame.
// Run: node tools/_dmg_wall_check.js [--only cub,jodel] [--out <file.json>]   (one final `GATE DMGWALL: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SW = require(path.join(ROOT, 'src', 'viewer', 'skin_wall.js'));

const REACH = 0.06;         // m: the measure looks for live covering this far round each inside vertex
const LEAK_SHARE = 1e-4;     // the leak allowed: 1 vertex-frame in 10 000 measured (~0, as the yellow census' tolerance)
const TOL_OUT = 0.0005;        // m: an inside vertex more than 0.5 mm out through the live covering is a leak
const BAND_ABS = 0.002, BAND_REL = 0.10;      // the tight band: 2 mm + 10 % of the rest thickness
const HARD_ABS = 0.003, HARD_REL = 0.60, BAND_SHARE = 0.002, HARD_SHARE = 2e-5;   // ...0.2 % past it at most, and 2e-5 past 3 mm + 60 %
const SEVERE = { V: 50, sink: 10, pitch: 60, secs: 4 };
const WATER_SEVERE = { V: 150 / 3.6, sink: 10, pitch: 60, secs: 4 };
const BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const casesOf = k => /floats/i.test(k)
  ? [{ id: 'nosein-water', label: 'a severe float nose-in (150 km/h, 10 m/s, 60 deg)', kind: 'water', o: WATER_SEVERE }]
  : [{ id: 'trunk-0', label: 'a trunk at 30 m/s, the centreline', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 } },
     { id: 'trunk-2.5', label: 'a trunk at 30 m/s, the wing 2.5 m out', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 2.5 } },
     { id: 'nosein-ground', label: 'a severe nose-in on the ground (180 km/h, 10 m/s, 60 deg)', kind: 'ground', o: SEVERE }];

// ---- the cases, as GATE DMGSKIN sets them up (its `go`, verbatim in what it does) ----
function go(L, k, c, damage) {
  const C = L.core(), o = c.o, d0 = L.defOf(k), def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage }) });
  const mk = W => C.makeSim(def, W);
  const pitchAndDrop = (sim, top) => {
    const n = sim.n, p = sim.p, v = sim.v, [xA, , zR] = sim.axes(), c0 = sim.cgPos();
    const th = -(o.pitch || 0) * Math.PI / 180, kk = zR, cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = kk[0]*d[0] + kk[1]*d[1] + kk[2]*d[2];
      const cr = [kk[1]*d[2] - kk[2]*d[1], kk[2]*d[0] - kk[0]*d[2], kk[0]*d[1] - kk[1]*d[0]];
      for (let j = 0; j < 3; j++) p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + kk[j] * kd * (1 - cs);
    }
    let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - def.nodes[i].r);
    const hl = Math.hypot(xA[0], xA[2]);
    for (let i = 0; i < n; i++) { p[i*3+1] += top(c0) + 0.3 - yMin; v[i*3] = -o.V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -o.V * xA[2] / hl; }
    sim.ctl.thr = 0;
  };
  if (c.kind === 'trunk') {
    const elev = 300, { W, TH, strip } = L.flatWorld(elev), sim = mk(W);
    sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
    if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
    if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
    const c0 = sim.cgPos().slice(), off = o.off || 0, tk = { r: 0.3, h: 10.05, sink: 0 };
    TH.set('fill:test', [c0[0] + fx * o.D - fz * off, c0[2] + fz * o.D + fx * off, elev - tk.sink, tk.r, elev - tk.sink + tk.h]);
    sim.ctl.thr = o.thr == null ? 0 : o.thr;
    return { sim, def, N: o.secs * 60 };
  }
  if (c.kind === 'ground') {
    const { W } = L.flatWorld(0), sim = mk(W); sim.reset(0);
    pitchAndDrop(sim, () => 0);
    return { sim, def, N: o.secs * 60 };
  }
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = mk(world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  pitchAndDrop(sim, c0 => world.waterH(c0[0], c0[2]));
  return { sim, def, N: o.secs * 60 };
}

// ---- the independent measure: each inside vertex against the LIVE covering ----
// The covering welded (the wall's own weld - a position lattice, no binding in it), its live triangles on a grid each
// frame, the nearest live triangle to the vertex, and the signed distance along the covering's live inward normal at
// that point (the welded area-weighted normals blended by the barycentrics; + inside)
// the covering's welded pieces: triangles joined through shared (welded) vertices - the sections whose seams do not
// share vertices (the pillar rings against the body) are pieces of their own
function coverComps(W) {
  const par = new Int32Array(W.nw); for (let i = 0; i < W.nw; i++) par[i] = i;
  const f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let q = 0; q < W.nt; q++) { const a = f(W.tw[q * 3]), b = f(W.tw[q * 3 + 1]), c = f(W.tw[q * 3 + 2]); par[a] = c; par[b] = c; }
  const comp = new Int32Array(W.nt); for (let q = 0; q < W.nt; q++) comp[q] = f(W.tw[q * 3]);
  return comp;
}
function liveCover(W, P) {
  const N = new Float64Array(W.nw * 3);
  const alive = q => { const R = W.outers[W.tg[q]].R; return !R.dead || !R.dead[W.tt[q]]; };
  SW.normals(W, P, N, null, alive);
  // a grid of the live triangles (2.5 cm cells)
  const h = 0.025, cells = new Map(), hc = REACH, occ = new Set();
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  for (let w = 0; w < W.nw; w++) { x0 = Math.min(x0, P[w * 3]); y0 = Math.min(y0, P[w * 3 + 1]); z0 = Math.min(z0, P[w * 3 + 2]); }
  const key = (i, j, k) => (i * 8192 + j) * 8192 + k;
  for (let q = 0; q < W.nt; q++) { if (!alive(q)) continue;
    let a0 = Infinity, b0 = Infinity, c0 = Infinity, a1 = -Infinity, b1 = -Infinity, c1 = -Infinity;
    for (let k = 0; k < 3; k++) { const w = W.tw[q * 3 + k] * 3; a0 = Math.min(a0, P[w]); b0 = Math.min(b0, P[w + 1]); c0 = Math.min(c0, P[w + 2]); a1 = Math.max(a1, P[w]); b1 = Math.max(b1, P[w + 1]); c1 = Math.max(c1, P[w + 2]); }
    if (!(a1 - a0 < 2 && b1 - b0 < 2 && c1 - c0 < 2)) continue;        // (a triangle stretched over metres is torn: it is not live)
    for (let i = Math.floor((a0 - x0) / h); i <= Math.floor((a1 - x0) / h); i++) for (let j = Math.floor((b0 - y0) / h); j <= Math.floor((b1 - y0) / h); j++)
      for (let k = Math.floor((c0 - z0) / h); k <= Math.floor((c1 - z0) / h); k++) { const c = key(i, j, k); let L = cells.get(c); if (!L) cells.set(c, L = []); L.push(q); }
    // ...and a coarse lattice (REACH cells) saying only whether any live triangle is there
    for (let i = Math.floor((a0 - x0) / hc); i <= Math.floor((a1 - x0) / hc); i++) for (let j = Math.floor((b0 - y0) / hc); j <= Math.floor((b1 - y0) / hc); j++)
      for (let k = Math.floor((c0 - z0) / hc); k <= Math.floor((c1 - z0) / hc); k++) occ.add(key(i, j, k)); }
  // a covering triangle DOUBLED OVER: a live edge-neighbour's face more than 90 degrees from its own (the covering
  // folded back on itself - which side is outside is not defined there)
  const fnrm = new Float64Array(W.nt * 3);
  for (let q = 0; q < W.nt; q++) { const a = W.tw[q * 3] * 3, b = W.tw[q * 3 + 1] * 3, c = W.tw[q * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz) || 1; fnrm[q * 3] = nx / L; fnrm[q * 3 + 1] = ny / L; fnrm[q * 3 + 2] = nz / L; }
  const folded = new Uint8Array(W.nt);
  for (let q = 0; q < W.nt; q++) { if (!alive(q)) continue;
    for (let k = 0; k < 3 && !folded[q]; k++) { const w = W.tw[q * 3 + k];
      for (let j = W.incOff[w]; j < W.incOff[w + 1]; j++) { const u = W.inc[j]; if (u === q || !alive(u)) continue;
        let sh = 0; for (let m = 0; m < 3; m++) { const x = W.tw[u * 3 + m]; if (x === W.tw[q * 3] || x === W.tw[q * 3 + 1] || x === W.tw[q * 3 + 2]) sh++; }
        if (sh >= 2 && fnrm[q * 3] * fnrm[u * 3] + fnrm[q * 3 + 1] * fnrm[u * 3 + 1] + fnrm[q * 3 + 2] * fnrm[u * 3 + 2] < 0) { folded[q] = 1; break; } } } }
  const B = new Float64Array(3), Bb = new Float64Array(3), stamp = new Int32Array(W.nt); let qid = 0;
  // the signed depth of p (+ inside, along sigma x the normal) and its distance; null when no live covering within rMax
  return (px, py, pz, rMax, comp, cid) => {
    { const a = Math.floor((px - x0) / hc), b = Math.floor((py - y0) / hc), c = Math.floor((pz - z0) / hc); let any = false;
      for (let i = a - 1; i <= a + 1 && !any; i++) for (let j = b - 1; j <= b + 1 && !any; j++) for (let k = c - 1; k <= c + 1; k++) if (occ.has(key(i, j, k))) { any = true; break; }
      if (!any) return null; }
    const ci = Math.floor((px - x0) / h), cj = Math.floor((py - y0) / h), ck = Math.floor((pz - z0) / h), id = ++qid, R = Math.ceil(rMax / h) + 1;
    let best = -1, bd = rMax * rMax;
    for (let r = 0; r <= R; r++) {
      for (let i = ci - r; i <= ci + r; i++) { const ei = i === ci - r || i === ci + r;
        for (let j = cj - r; j <= cj + r; j++) { const ej = ei || j === cj - r || j === cj + r;
          for (let k = ck - r; k <= ck + r; k += (ej || r === 0) ? 1 : 2 * r) {
            const L = cells.get(key(i, j, k)); if (!L) continue;
            for (const q of L) { if (stamp[q] === id) continue; stamp[q] = id; if (comp && comp[q] !== cid) continue;
              const a = W.tw[q * 3] * 3, b = W.tw[q * 3 + 1] * 3, c = W.tw[q * 3 + 2] * 3;
              SW.closest(P, a, b, c, px, py, pz, Bb);
              const x = Bb[0] * P[a] + Bb[1] * P[b] + Bb[2] * P[c] - px, y = Bb[0] * P[a + 1] + Bb[1] * P[b + 1] + Bb[2] * P[c + 1] - py, z = Bb[0] * P[a + 2] + Bb[1] * P[b + 2] + Bb[2] * P[c + 2] - pz;
              const d = x * x + y * y + z * z; if (d < bd) { bd = d; best = q; B.set(Bb); } } } } }
      if (best >= 0 && bd <= (r * h) * (r * h)) break;
    }
    if (best < 0) return null;
    const a = W.tw[best * 3] * 3, b = W.tw[best * 3 + 1] * 3, c = W.tw[best * 3 + 2] * 3;
    let nx = B[0] * N[a] + B[1] * N[b] + B[2] * N[c], ny = B[0] * N[a + 1] + B[1] * N[b + 1] + B[2] * N[c + 1], nz = B[0] * N[a + 2] + B[1] * N[b + 2] + B[2] * N[c + 2];
    const Ln = Math.hypot(nx, ny, nz) || 1; nx /= Ln; ny /= Ln; nz /= Ln;
    const qx = px - (B[0] * P[a] + B[1] * P[b] + B[2] * P[c]), qy = py - (B[0] * P[a + 1] + B[1] * P[b + 1] + B[2] * P[c + 1]), qz = pz - (B[0] * P[a + 2] + B[1] * P[b + 2] + B[2] * P[c + 2]);
    return { s: W.sigma * (qx * nx + qy * ny + qz * nz), d: Math.sqrt(bd), q: best, folded: folded[best] };
  };
}

if (argv[0] === '--build') {
  const k = argv[1];
  const L = require('./_treecrash_lib.js');
  const WL = require('./_dmg_wall_lib.js');
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
  const t00 = Date.now();
  const B = L.BUILDS[k];
  const S0 = WL.snapshotOf(B.build, { patch: B.patch });
  const tr = m => { if (process.env.DMGWALL_TRACE) console.error('[dmgwall] ' + k + ' ' + m + ' ' + ((Date.now() - t00) / 1000).toFixed(1) + ' s'); };
  tr('snapshot');
  const C = L.core(), d0 = L.defOf(k), n = d0.nodes.length, core = d0.refs.noseFrame[0];
  const out = { key: k, label: B.label, snapMs: S0.ms, cases: [] };
  // the snapshot's fuselage groups, by aeroskin's roles
  const outerG = S0.groups.filter(g => SW.isOuter(g.sec, WL.AS)), wallG = S0.groups.filter(g => SW.isWall(g.sec, WL.AS));
  const furnG = S0.groups.filter(g => g.inside && !SW.isWall(g.sec, WL.AS));
  const vsum = a => a.reduce((s, g) => s + g.nv, 0);
  out.snap = { groups: S0.groups.length, verts: vsum(S0.groups), outer: outerG.map(g => g.sec), outerV: vsum(outerG), wall: wallG.map(g => g.sec + ':' + g.nv), wallV: vsum(wallG),
               furniture: furnG.map(g => (g.sec || g.key) + ':' + g.nv), furnV: vsum(furnG) };
  // the frame check: the covering's vertices' nearest node (the visual frame's nodes must sit in the snapshot's skin)
  { let m = 0, c = 0; for (const g of outerG) for (let v = 0; v < g.nv; v += 9) { let b = Infinity;
      for (let i = 0; i < n; i++) b = Math.min(b, Math.hypot(g.pos[v * 3] - S0.rest[i * 3], g.pos[v * 3 + 1] - S0.rest[i * 3 + 1], g.pos[v * 3 + 2] - S0.rest[i * 3 + 2]));
      m += b; c++; } out.snap.nearNodeMean = c ? m / c : null; }
  if (!outerG.length || !wallG.length) { out.none = true; console.log('RESULT ' + JSON.stringify(out)); process.exit(0); }
  const fabB = d0.spec && d0.spec.material === 'tubeFabric';
  const T = SB.topo(d0.beams, n);
  // a record set (app.js brkRec for the cage: nearest node at the first break, the full binding where the breaks are)
  const mkSet = () => {
    const mk = g => { const pos = g.pos.slice(), idx = g.idx.slice();
      const R = SB.make({ nv: g.nv, idx }, SB.NEAR_K, { fabric: fabB, cage: true, pos: g.pos, rest: S0.rest }); R.baseM = g.pos;
      return { g, R, pos }; };
    return { outer: outerG.map(mk), wall: wallG.map(mk) };
  };
  // the full binding at rest, for the counts (which inside vertices are on the wall) and the 0.0 mm proof
  const rest = (() => {
    const set = mkSet();
    const W = SW.make(set.outer.map(o => ({ R: o.R, base: o.g.pos, pos: o.pos, off: null })), set.wall.map(o => ({ R: o.R, base: o.g.pos, pos: o.pos, off: null })));
    const t0 = Date.now();
    for (const I of W.inners) for (let v = 0; v < I.wt.length; v++) SW.bindVertex(W, I, v);
    const bindMs = Date.now() - t0;
    // the sense, the folds: what the first event decides
    let sp = 0; for (const I of W.inners) for (let v = 0; v < I.wt.length; v++) if (I.wt[v] >= 0) sp += Math.sign(I.wc[v * 3 + 2]);
    W.sigma = sp < 0 ? -1 : 1; SW.folds(W, W.P0, W.N0, W.F0, null); W.F.set(W.F0); W.sensed = true;
    // pose every bound vertex on the covering at rest (the wall's own per-frame code: all covering vertices "moving")
    W.vB = 0; W.aw = Int32Array.from({ length: W.nw }, (_, i) => i); W.act.fill(1);
    for (const I of W.inners) { const l = []; for (let v = 0; v < I.wt.length; v++) if (I.wt[v] >= 0 && I.rep[v] === v) l.push(v); I.list = Int32Array.from(l); I.tris = new Int32Array(0); }
    SW.pose(W);
    let maxOff = 0, bits = 0, posed = 0;
    for (const I of W.inners) for (let v = 0; v < I.wt.length; v++) { if (I.wt[v] < 0) continue; posed++; let same = true;
      for (let q = 0; q < 3; q++) { const d = Math.abs(I.pos[v * 3 + q] - I.base[v * 3 + q]); if (d > maxOff) maxOff = d; if (I.pos[v * 3 + q] !== I.base[v * 3 + q]) same = false; }
      if (!same) bits++; }
    const bySec = {};
    W.inners.forEach((I, i) => { const sec = set.wall[i].g.sec; const r = bySec[sec] || (bySec[sec] = { nv: 0, bound: 0, unbound: 0, depthMm: [], out: 0 });
      const ds = []; for (let v = 0; v < I.wt.length; v++) { r.nv++; if (I.wt[v] >= 0) { r.bound++; ds.push(-W.sigma * -I.wc[v * 3 + 2]); if (W.sigma * I.wc[v * 3 + 2] < 0) r.out++; } else r.unbound++; }
      ds.sort((a, b) => a - b); const qq = f => ds.length ? +(Math.abs(ds[Math.floor(f * (ds.length - 1))]) * 1000).toFixed(1) : null;
      r.depthMm = [qq(0.5), qq(0.99), qq(1)]; });
    const reps = W.inners.reduce((a, I) => a + I.nRep, 0);
    return { bindMs, maxOff, bits, posed, reps, bySec, sigma: W.sigma, nw: W.nw, nt: W.nt, W };
  })();
  const Wref = rest.W; delete rest.W;
  const COMP = coverComps(Wref); rest.pieces = new Set(COMP).size;
  out.rest = rest;
  tr('rest');
  for (const c of casesOf(k).filter(c => !process.env.DMGWALL_CASES || process.env.DMGWALL_CASES.split(',').includes(c.id))) {
    const RC = { id: c.id, label: c.label };
    const run = go(L, k, c, true), sim = run.sim;
    const A = mkSet();                         // AFTER: the wall
    const Bf = { outer: A.outer, wall: mkSet().wall };   // BEFORE: the same covering, the inside on its own nodes (G1851)
    let WW = null;
    const hop = SH.simDmgHop0(), st = SV.simViewDmgState(n, d0.beams.length);
    const NF = {}, live = new Float64Array(n * 3);
    const S = { steps: 0, frames: 0, firstBreak: null, bitsBefore: 0, bitsBad: 0, meas: 0, measB: 0, outA: 0, outB: 0, worstA: 0, worstB: 0, worstAt: null,
                outVertsB: 0, outVertsA: 0, anyA: 0, anyB: 0, foldA: 0, foldB: 0, pinchedBand: 0, bandN: 0, hard: 0, d4aMs: 0, band: 0, bandWorst: 0, clamped: 0, overDeadA: 0, overDeadB: 0, finite: true,
                poseMs: 0, poses: 0, eventMs: 0, events: 0, posedMax: 0, boundLazy: 0, testedLazy: 0, removedWall: 0, removedB: 0, tornWall: 0 };
    const outSetA = new Set(), outSetB = new Set();
    let restS = null, restD = null; const Bq = new Float64Array(3);                          // each inside vertex's signed depth at rest (the independent measure)
    for (let s = 1; s <= run.N; s++) {
      sim.step(1 / 60); S.steps = s;
      const PI = SH.simDmgHop(sim, hop, core, 0); if (PI) SV.simViewDmgApply(st, PI);
      const D = st;
      if (!D.br.length) {
        // nothing broken: nothing writes the inside (brkState returns null) - bit for bit its rest
        for (const o of A.wall) { S.bitsBefore++; if (Buffer.compare(Buffer.from(o.pos.buffer), Buffer.from(o.g.pos.buffer)) !== 0) S.bitsBad++; }
        continue;
      }
      if (!S.firstBreak) S.firstBreak = +sim.t.toFixed(3);
      S.frames++;
      // the live nodes in the visual frame (app.js brkCage: into(K.live, inv3(xA, yU), sim.p, bodyOrigin) - o)
      const [xA, yU] = sim.axes(), Mi = WL.inv3(xA, yU), org = sim.bodyOrigin(), o = S0.o;
      for (let i = 0; i < n; i++) { const x = sim.p[i*3] - org[0], y = sim.p[i*3+1] - org[1], z = sim.p[i*3+2] - org[2];
        live[i*3] = Mi[0]*x + Mi[1]*y + Mi[2]*z - o[0]; live[i*3+1] = Mi[3]*x + Mi[4]*y + Mi[5]*z - o[1]; live[i*3+2] = Mi[6]*x + Mi[7]*y + Mi[8]*z - o[2]; }
      const down = [-Mi[1], -Mi[4], -Mi[7]];
      // the events (every group's), the nodes' frames
      for (const r of [...A.outer, ...A.wall, ...Bf.wall]) SB.event(r.R, T, D, S0.rest, r.g.pos);
      if (!WW) WW = SW.make(A.outer.map(r => ({ R: r.R, base: r.g.pos, pos: r.pos, off: null })), A.wall.map(r => ({ R: r.R, base: r.g.pos, pos: r.pos, off: null })));
      { const t0 = process.hrtime.bigint(); const ch = SW.event(WW, D.vB); if (ch) { S.events++; S.eventMs += Number(process.hrtime.bigint() - t0) / 1e6; } }
      SB.nodeFrames(NF, T, D, S0.rest, live);
      // the covering: its pose and tear (shared by both); the inside: G1851's pose (both), the tear BEFORE on its own
      { const t0 = process.hrtime.bigint();
        for (const r of A.outer) { SB.poseCage(r.R, S0.rest, live, r.g.pos, r.pos, NF, down, null); SB.tear(r.R, r.g.pos, r.pos); }
        for (const r of A.wall) SB.poseCage(r.R, S0.rest, live, r.g.pos, r.pos, NF, down, null);
        S.d4aMs += Number(process.hrtime.bigint() - t0) / 1e6; }
      for (const r of Bf.wall) { SB.poseCage(r.R, S0.rest, live, r.g.pos, r.pos, NF, down, null); SB.tear(r.R, r.g.pos, r.pos); }
      // AFTER: the wall's pose, then the inside's tear on it (app.js brkCage's order)
      { const t0 = process.hrtime.bigint(); SW.pose(WW); S.poseMs += Number(process.hrtime.bigint() - t0) / 1e6; S.poses++; }
      for (const r of A.wall) SB.tear(r.R, r.g.pos, r.pos);
      S.posedMax = Math.max(S.posedMax, WW.posed); S.poseMaxMs = Math.max(S.poseMaxMs || 0, WW._lastPose || 0); S.pinchMax = Math.max(S.pinchMax || 0, WW.pinchedN || 0); S.pinchQMax = Math.max(S.pinchQMax || 0, WW.pinchQ || 0);
      // ---- the measure: the live covering, each moving inside vertex against it ----
      const P = new Float64Array(WW.nw * 3);
      for (let w = 0; w < WW.nw; w++) { const r = A.outer[WW.rep[w * 2]], v = WW.rep[w * 2 + 1]; P[w * 3] = r.pos[v * 3]; P[w * 3 + 1] = r.pos[v * 3 + 1]; P[w * 3 + 2] = r.pos[v * 3 + 2]; }
      if (!restS) {
        // the rest standing of every inside vertex (the same measure on the covering at rest): on its OWN covering (the
        // welded piece of the covering its full binding's triangle is on) and on any
        const at = liveCover(WW, WW.P0);
        restS = A.wall.map((r, gi) => { const a = new Float32Array(r.g.nv).fill(NaN), b = new Float32Array(r.g.nv).fill(NaN), wt = Wref.inners[gi].wt;
          for (let v = 0; v < r.g.nv; v++) { if (wt[v] < 0) continue; const x = r.g.pos[v * 3], y = r.g.pos[v * 3 + 1], z = r.g.pos[v * 3 + 2];
            const m = at(x, y, z, REACH, COMP, COMP[wt[v]]); if (m) a[v] = m.s; const m2 = at(x, y, z, REACH); if (m2) b[v] = m2.s; }
          return { own: a, any: b }; });
        restD = A.wall.map((r, gi) => { const d = new Float32Array(r.g.nv), wt = Wref.inners[gi].wt, P0 = WW.P0;
          for (let v = 0; v < r.g.nv; v++) { const q = wt[v]; if (q < 0) continue; const a3 = WW.tw[q * 3] * 3, b3 = WW.tw[q * 3 + 1] * 3, c3 = WW.tw[q * 3 + 2] * 3, x = r.g.pos[v * 3], y = r.g.pos[v * 3 + 1], z = r.g.pos[v * 3 + 2];
            SW.closest(P0, a3, b3, c3, x, y, z, Bq); d[v] = Math.hypot(Bq[0] * P0[a3] + Bq[1] * P0[b3] + Bq[2] * P0[c3] - x, Bq[0] * P0[a3 + 1] + Bq[1] * P0[b3 + 1] + Bq[2] * P0[c3 + 1] - y, Bq[0] * P0[a3 + 2] + Bq[1] * P0[b3 + 2] + Bq[2] * P0[c3 + 2] - z); }
          return d; });
      }
      const at = liveCover(WW, P);
      const deadOuter = q => { const R = WW.outers[WW.tg[q]].R; return R.dead && R.dead[WW.tt[q]]; };
      const measure = (set, isA) => {
        set.wall.forEach((r, gi) => {
          const R = r.R, ride = R.ride, I = isA ? WW.inners[gi] : null, onList = new Uint8Array(r.g.nv), wt = Wref.inners[gi].wt;
          if (I && I.on) onList.set(I.on);
          // drawn: on some live triangle of its own (a vertex whose every triangle is removed is not drawn)
          const drawn = new Uint8Array(r.g.nv), ix0 = R.idx0 || R.idx;
          for (let t = 0; t < R.nt; t++) if (!R.dead || !R.dead[t]) { drawn[ix0[t * 3]] = 1; drawn[ix0[t * 3 + 1]] = 1; drawn[ix0[t * 3 + 2]] = 1; }
          for (let v = 0; v < r.g.nv; v++) {
            if (!(onList[v] || (ride && ride[v])) || !drawn[v]) continue;     // the rest are at rest under a covering at rest
            const s0 = restS[gi].own[v]; if (!(s0 === s0)) continue;  // no covering within REACH at rest: not measured
            const x = r.pos[v * 3], y = r.pos[v * 3 + 1], z = r.pos[v * 3 + 2];
            if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) { S.finite = false; continue; }
            if (isA) S.meas++; else S.measB++;
            // ANY live covering (a neighbouring section across an unwelded seam included): reported
            const s0a = restS[gi].any[v], ma = at(x, y, z, REACH);
            if (ma && s0a === s0a && ma.s < Math.min(-TOL_OUT, s0a - TOL_OUT)) { if (isA) S.anyA++; else S.anyB++; }
            // ITS OWN covering (the welded piece over it): judged
            const m = at(x, y, z, REACH, COMP, COMP[wt[v]]);
            if (!m) continue;
            const lim = Math.min(-TOL_OUT, s0 - TOL_OUT);
            if (m.s < lim && m.folded) { if (isA) S.foldA++; else S.foldB++; }
            else if (m.s < lim) {
              const ex = lim - m.s;
              if (isA && process.env.DMGWALL_DEBUG && (S.dbg = (S.dbg || 0) + 1) <= +process.env.DMGWALL_DEBUG)
                console.error('[dbg] t=' + sim.t.toFixed(3) + ' ' + r.g.sec + ' v' + v + ' s=' + (m.s * 1000).toFixed(1) + ' s0=' + (s0 * 1000).toFixed(1) + ' q=' + I.wt[v] + ' nearest=' + m.q + ' d=' + (m.d * 1000).toFixed(1) + ' wc=' + [0, 1, 2].map(i => (I.wc[v * 3 + i] * 1000).toFixed(1)) + ' F=' + [0, 1, 2].map(k => WW.F[WW.tw[I.wt[v] * 3 + k]].toFixed(3)) + ' F0=' + [0, 1, 2].map(k => WW.F0[WW.tw[I.wt[v] * 3 + k]].toFixed(3)) + ' list=' + onList[v] + ' ride=' + (ride ? ride[v] : '-') + ' ownAlive=' + (I.wt[v] >= 0 ? !deadOuter(I.wt[v]) : '-') + ' comp=' + (COMP[wt[v]] === COMP[m.q]) + ' pinched=' + I.pinched[v] + ' fo=' + (I.fo ? I.fo[v] : '-'));
              if (isA) { S.outA++; outSetA.add(gi * 1e7 + v); if (ex > S.worstA) { S.worstA = ex; S.worstAt = { t: +sim.t.toFixed(3), sec: r.g.sec, v, s: +m.s.toFixed(5), s0: +s0.toFixed(5) }; } }
              else { S.outB++; outSetB.add(gi * 1e7 + v); if (ex > S.worstB) S.worstB = ex; }
            }
            if (isA && onList[v]) {
              // b. the thickness: the distance to its OWN covering triangle (the full binding's, live) against the rest's
              const q = wt[v], a3 = WW.tw[q * 3] * 3, b3 = WW.tw[q * 3 + 1] * 3, c3 = WW.tw[q * 3 + 2] * 3;
              SW.closest(P, a3, b3, c3, x, y, z, Bq);
              const dn = Math.hypot(Bq[0] * P[a3] + Bq[1] * P[b3] + Bq[2] * P[c3] - x, Bq[0] * P[a3 + 1] + Bq[1] * P[b3 + 1] + Bq[2] * P[c3 + 1] - y, Bq[0] * P[a3 + 2] + Bq[1] * P[b3 + 2] + Bq[2] * P[c3 + 2] - z);
              const d0 = restD[gi][v], band = BAND_ABS + BAND_REL * d0, dv = dn - d0;
              if (Math.abs(dv) > band) {
                if (I.pinched && I.pinched[v]) S.pinchedBand++;
                else {
                  const cn = Math.abs(I.wc[v * 3 + 2]), fr = Math.min(WW.F0[WW.tw[q * 3]], WW.F0[WW.tw[q * 3 + 1]], WW.F0[WW.tw[q * 3 + 2]]);
                  const fn = Math.min(WW.F[WW.tw[q * 3]], WW.F[WW.tw[q * 3 + 1]], WW.F[WW.tw[q * 3 + 2]]), lim2 = SW.KAPPA * fn * Math.max(1, fr < Infinity ? cn / (SW.KAPPA * fr) : 1);
                  if (dv < 0 && (cn > lim2 + 1e-9 || fn < SW.CRUMPLE * fr)) S.clamped++;   // (the clamp, or the covering crumpled there: the crease)
                  else { S.band++; if (Math.abs(dv) > HARD_ABS + HARD_REL * d0) S.hard++; if (Math.abs(dv) - band > S.bandWorst) { S.bandWorst = Math.abs(dv) - band; S.bandAt = { t: +sim.t.toFixed(3), sec: r.g.sec, v, d: +dn.toFixed(5), d0: +d0.toFixed(5) }; } }
                }
              }
              S.bandN++;
            }
          }
        });
      };
      measure(A, true); measure(Bf, false);
      // c. no inside triangle live over a removed covering triangle (the vertex's covering triangle at rest: the full
      //    binding's, for BEFORE as well)
      const overDead = (set) => { let nbad = 0;
        set.wall.forEach((r, gi) => { const R = r.R; if (!R.active) return; const wt = Wref.inners[gi].wt, ix0 = R.idx0;
          for (let t = 0; t < R.nt; t++) { if (R.dead[t]) continue;
            for (let q = 0; q < 3; q++) { const v = ix0[t * 3 + q]; if (wt[v] >= 0 && deadOuter(wt[v])) { nbad++; break; } } } });
        return nbad; };
      const odA = overDead(A), odB = overDead(Bf);
      if (odA > S.overDeadA) S.overDeadA = odA; if (odB > S.overDeadB) S.overDeadB = odB;
    }
    if (WW) {
      S.msParts = WW.ms; S.boundLazy = WW.bound; S.testedLazy = WW.tested; S.unboundLazy = WW.unbound;
      for (const r of A.wall) { S.removedWall += r.R.removed; S.tornWall += r.R.torn; }
      for (const r of Bf.wall) S.removedB += r.R.removed;
      S.outerRemoved = A.outer.reduce((a, r) => a + r.R.removed, 0); S.outerTorn = A.outer.reduce((a, r) => a + r.R.torn, 0);
    }
    S.outVertsA = outSetA.size; S.outVertsB = outSetB.size;
    const Dm = sim.damage(); S.nb = Dm.broken.length; S.crashed = Dm.crashed; S.reason = Dm.reason;
    RC.S = S;
    // e. damage OFF: nothing breaks, nothing writes the inside on any frame
    {
      const OFF = go(L, k, c, false), so = OFF.sim, hp = SH.simDmgHop0(), sto = SV.simViewDmgState(n, d0.beams.length);
      const pos = wallG.map(g => g.pos.slice());
      let frames = 0, bad = 0, sends = 0;
      for (let s = 1; s <= OFF.N; s++) { so.step(1 / 60); const PI = SH.simDmgHop(so, hp, core, 0); if (PI) { sends++; SV.simViewDmgApply(sto, PI); }
        if (sto.br.length) bad++;
        pos.forEach((p, i) => { frames++; if (Buffer.compare(Buffer.from(p.buffer), Buffer.from(wallG[i].pos.buffer)) !== 0) bad++; }); }
      RC.off = { frames, bad, sends, broken: so.damage().broken.length };
    }
    out.cases.push(RC);
  }
  out.ms = Date.now() - t00;
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const oi = argv.indexOf('--only'), list = oi >= 0 ? argv[oi + 1].split(',') : BUILDS;
  const run = k => new Promise(res => {
    const ch = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: (se + so).slice(-2000) }); });
  });
  const R = {}, q = list.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + list.length + ' builds, damage on; the leak past ' + TOL_OUT * 1000 + ' mm; the band ' + BAND_ABS * 1000 + ' mm + ' + BAND_REL * 100 + ' %; BOUND ' + SW.BOUND * 1000 + ' mm, KAPPA ' + SW.KAPPA + ')');
  for (const k of list) {
    const r = R[k];
    console.log((r.label || k) + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    const z = r.snap;
    console.log('  the flown snapshot (headless, ' + (r.snapMs / 1000).toFixed(1) + ' s): ' + z.groups + ' groups, ' + z.verts + ' vertices; the covering ' + z.outerV + ' (' + z.outer.join(', ') + '); the inside wall ' + z.wallV + ' (' + z.wall.join(', ') + '); furniture (keeps G1851) ' + z.furnV + (z.furniture.length ? ' (' + z.furniture.join(', ') + ')' : ''));
    if (r.none) { console.log('  NO WALL ON THIS BUILD: ' + (z.outerV ? '' : 'no fuselage covering (an open frame: the inside layers ' + z.wall.join(', ') + ' have nothing to bind to and keep G1851\'s node binding)') + (z.wallV ? '' : 'no inside-wall layer') + ' - the gate measures nothing here'); continue; }
    yes(z.nearNodeMean != null && z.nearNodeMean < 0.5, 'the snapshot and the nodes in one frame: the covering\'s vertices ' + (z.nearNodeMean != null ? (z.nearNodeMean * 1000).toFixed(0) : '-') + ' mm from their nearest node on average');
    const rs = r.rest;
    console.log('  the full binding at rest: ' + rs.posed + ' inside vertices on the wall (' + rs.bindMs + ' ms, every vertex), the covering welded to ' + rs.nw + ' vertices / ' + rs.nt + ' triangles; inward = ' + (rs.sigma < 0 ? 'against' : 'along') + ' the covering\'s winding normals');
    for (const sec in rs.bySec) { const b = rs.bySec[sec];
      console.log('    ' + sec.padEnd(11) + ' ' + b.nv + ' vertices: ' + b.bound + ' on the wall, ' + b.unbound + ' with no covering within ' + SW.BOUND * 1000 + ' mm (G1851\'s node binding); the depth p50 / p99 / max ' + b.depthMm.join(' / ') + ' mm' + (b.out ? '; ' + b.out + ' stand OUTSIDE the covering at rest (the base\'s drawing)' : '')); }
    yes(rs.maxOff < 1e-9, 'd. at rest the wall is the rest: ' + rs.posed + ' inside vertices (' + rs.reps + ' positions) posed on the covering at rest, the worst ' + (rs.maxOff * 1000).toFixed(1) + ' mm off (' + rs.maxOff.toExponential(1) + ' m: ' + rs.bits + ' differ from the float32 rest in the last bit, near a zero coordinate)');
    for (const c of r.cases) {
      const S = c.S;
      console.log('  ' + c.label + ': ' + (S.crashed ? 'CRASHED (' + S.reason + ')' : 'no crash') + ', ' + S.nb + ' broken, the first break at ' + S.firstBreak + ' s, the wall checked on ' + S.frames + ' frames');
      yes(S.bitsBad === 0, 'e. before the first break the inside layers are their rest bit for bit (' + S.bitsBefore + ' group frames)');
      yes(c.off.bad === 0 && c.off.sends === 0 && c.off.frames > 0, 'e. damage OFF: nothing broken (' + c.off.broken + '), no payload, the inside layers their rest bit for bit on every frame (' + c.off.frames + ' group frames)');
      if (!S.frames) continue;
      console.log('    BEFORE (the inside on its own nodes, G1851): ' + S.outB + ' vertex-frames out through the covering (' + S.outVertsB + ' vertices), the worst ' + (S.worstB * 1000).toFixed(1) + ' mm out; ' + S.overDeadB + ' inside triangles live over a removed covering triangle (the most on a frame)');
      yes(S.outA <= LEAK_SHARE * S.meas && S.finite, 'a. AFTER: inside-wall vertices out through their own live covering past ' + TOL_OUT * 1000 + ' mm: ' + S.outA + ' vertex-frames of ' + S.meas + ' measured (' + (S.outA / Math.max(1, S.meas) * 1e4).toFixed(2) + 'e-4, at most ' + LEAK_SHARE * 1e4 + 'e-4; BEFORE ' + (S.outB / Math.max(1, S.measB) * 1e4).toFixed(1) + 'e-4), ' + S.outVertsA + ' vertices (BEFORE ' + S.outVertsB + '), the worst ' + (S.worstA * 1000).toFixed(2) + ' mm' + (S.worstAt ? ' ' + JSON.stringify(S.worstAt) : '')
        + '; through ANY live covering (a neighbouring section slid over it across a seam included): ' + S.anyA + ' (BEFORE ' + S.anyB + '); at a covering doubled over on itself (no outside defined): ' + S.foldA + ' (BEFORE ' + S.foldB + ')');
      yes(S.hard <= HARD_SHARE * S.bandN && S.band <= BAND_SHARE * S.bandN, 'b. the wall\'s thickness (the distance to its own covering triangle, live) kept: ' + S.band + ' of ' + S.bandN + ' vertex-frames (' + (100 * S.band / Math.max(1, S.bandN)).toFixed(4) + ' %, at most ' + BAND_SHARE * 100 + ' %) off their rest by more than ' + BAND_ABS * 1000 + ' mm + ' + BAND_REL * 100 + ' %, the worst ' + (S.bandWorst * 1000).toFixed(2) + ' mm past it' + (S.bandAt ? ' ' + JSON.stringify(S.bandAt) : '') + '; ' + S.hard + ' past ' + HARD_ABS * 1000 + ' mm + ' + HARD_REL * 100 + ' % (at most ' + HARD_SHARE * 1e6 + ' in a million); thinner where the crease held it: ' + S.clamped + ' by the clamp, ' + S.pinchedBand + ' by the pinch');
      yes(S.overDeadA === 0, 'c. no inside triangle live over a removed or torn covering triangle (' + S.overDeadA + ' on the worst frame; BEFORE ' + S.overDeadB + ')');
      console.log('    the wall: ' + S.boundLazy + ' inside vertices bound (lazily, ' + S.testedLazy + ' tested, ' + S.unboundLazy + ' with no covering within BOUND), up to ' + S.posedMax + ' posed a frame; ' + S.events + ' events at ' + (S.events ? (S.eventMs / S.events).toFixed(1) : '-') + ' ms, the pose ' + (S.poses ? (S.poseMs / S.poses).toFixed(2) : '-') + ' ms a frame on average, ' + (S.poseMaxMs || 0).toFixed(1) + ' at most (node; G1851\'s own pose of the same groups ' + (S.poses ? (S.d4aMs / S.poses).toFixed(2) : '-') + ' ms a frame)');
      console.log('    removed: the covering ' + S.outerRemoved + ' (torn ' + S.outerTorn + '); the inside wall AFTER ' + S.removedWall + ' (torn ' + S.tornWall + '), BEFORE ' + S.removedB);
    }
  }
  const outI = argv.indexOf('--out');
  if (outI >= 0) { fs.mkdirSync(path.dirname(argv[outI + 1]), { recursive: true }); fs.writeFileSync(argv[outI + 1], JSON.stringify(R, null, 1)); }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGWALL: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
