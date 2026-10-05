// G1855 / G1856 (DMG-D4c THE WALL): THE COVERING AND ITS INSIDE ARE ONE WALL. The user (2026-10-05): "There's enormous
// clipping between the outside and the inside shell. There is a skin and an inside skin. These are 2 meshes, but they
// really are the same physical thing, so their vertices should be coupled ... They should deform together, and the
// outside should never get inside the inside." And the test: "The Cub ... should be yellow, even crashed. If you see
// grey/black, it means the inside leaks to the outside."
//
// WHY IT LEAKED: after a break (G1851, skin_break.js) a cage vertex at the break rides its OWN nearest nodes' frames. An
// inside vertex (the liner, the frames on the wall, the sill, the door pad, the firewall's rim) and the covering over it
// are bound to DIFFERENT nearest nodes - a liner 3 cm in can be nearer a cabin node than the skin over it is - so once
// the nodes turn apart they move differently and pass through each other: grey liner and black tube over yellow fabric.
//
// THE WALL BINDING (G1855), made at the break events (never before the first break; never per frame):
//   - each vertex of an INSIDE-WALL layer (aeroskin's inside roles that line the wall: liner, struct, fire, sill,
//     doorPad - NOT the dash's pad / panel, the seats, the crew, the controls, which keep D4a's node binding) is bound
//     to the OUTSIDE covering (aeroskin's skin roles: skin, rail, pillar): its closest point on the covering at rest
//     (a triangle and its barycentrics) and its offset off that point in the triangle's own frame - mostly its depth d
//     along the inward normal (the wall's thickness there), plus the small in-plane remainder where the closest point
//     is on an edge. The covering's vertices are WELDED by position across its sections (the snapshot is a triangle
//     soup, one group per section), so the frame's normal is the area-weighted normal of the whole covering round the
//     vertex, blended by the barycentrics: the liner stays smooth across the sections' seams;
//   - per frame, once broken: inside vertex = the outer point (the same barycentrics on the triangle's CURRENT vertices)
//     + the offset in the triangle's CURRENT frame (N the blended live vertex normal, T1 the first edge off N, T2 = N x
//     T1). At rest this is the rest vertex to the last bit (the same code on the same numbers; GATE DMGWALL: 0.0 mm);
//   - THE CREASE: where the covering folds tighter than d the offset surface would turn inside out. Each welded vertex
//     carries the distance tmax at which its inward normals and its neighbours' meet (for an edge e and normals n_i,
//     n_j converging inward: |e|^2 / -(e . (n_j - n_i)); a cylinder of radius r: r). The depth is held to it:
//     d' = min(d, KAPPA x tmax_now x max(1, d / (KAPPA x tmax_rest))) (KAPPA = 0.9) - at rest d' = d exactly (a wall
//     already deeper than its rest fold keeps that ratio), and a fold never turns the inside out through the outside;
//   - BOUND: an inside vertex with no covering within BOUND (0.15 m) is not on the wall - the bulkhead's middle, the
//     firewall's face, an open cockpit's frames - and keeps D4a's node binding (counted per build by GATE DMGWALL).
//   - THE GUARD: never shallower under its own triangle's plane than at rest (nor than PINCH_IN, 1 mm): a covering
//     triangle sheared off its vertex normals would otherwise let the offset through its face. At rest: no move;
//   - THE PINCH: the covering itself is not one welded sheet everywhere (the pillar rings, the flanges and the body
//     meet without sharing vertices, and G1851 rides each side on its own nodes), and in a wreck it crumples - so a
//     piece of the covering can slide or fold in front of an inside vertex that sits exactly where its own triangle
//     says. Such vertices (a covering triangle within its depth + PINCH_NB at rest that is not in its own triangle's
//     2-ring - "foreign" covering; or its own triangle's fold radius under CRUMPLE of the rest's) are asked every frame
//     against the LIVE covering round them (a grid of the live triangles over their box, each searched within its own
//     triangle's distance): found outside the nearest live triangle, the vertex is pushed back PINCH_IN inside it. At a
//     crease both layers pinch together.
// It is LAZY: at each event only the inside vertices within BOUND of a covering triangle that moves (one of its
// vertices rides its nodes or drapes) or that D4a made ride are bound and posed - the cost follows the damage. The
// rest of the inside is rigid on the body under a rigid covering, exactly as before. The snapshot is a triangle soup
// (each position ~6 vertices): positions are welded, each posed once and copied. Per frame only what moved: an inside
// vertex whose covering triangle (and foreign covering) did not move since the last frame keeps its pose, so a wreck
// lying still costs the read of the moving covering and no more.
//
// TEAR BOTH LAYERS TOGETHER (G1856): an inside triangle with a vertex bound to a covering triangle that is removed (on
// two pieces / across a broken member) or torn (stretched past TEAR) goes with it, at the event and on the frame the
// covering tears; one whose bound vertices sit on covering triangles of two pieces spans the break and goes too; one
// wholly on live covering of one piece stays (D4a's own node test, which made the liner part where the skin over it
// held, is overruled there: the wall reads as one wall, its edge where the covering's is). A piece that came off takes
// its liner with it: the liner rides the piece's covering.
// PURE: no THREE, no DOM. window.SKIN_WALL in the page; module.exports in node (GATE DMGWALL, tools/_dmg_wall_check.js).
(function () {
  'use strict';
  const BOUND = 0.15;          // m: farther than this from the covering, an inside vertex is not on the wall
  const KAPPA = 0.9;           // the crease: the depth held under 0.9 x the distance where the inward normals meet
  const WELD = 2e4;            // the covering's vertices welded on a 0.05 mm lattice
  const CRUMPLE = 0.6;         // a covering vertex whose fold radius fell under 0.6 x its rest's is crumpling: the pinch looks there
  const PINCH_IN = 0.001;      // ...and holds an inside vertex at least 1 mm inside the live covering it found itself outside of
  const CELL = 0.04;           // the covering's triangles on a 4 cm grid (the search walks out a ring at a time)
  // the layers that line the wall (aeroskin's inside roles less the dash's pad and panel: furniture)
  const WALL_ROLES = new Set(['liner', 'struct', 'fire', 'sill', 'doorPad']);
  const isWall = (sec, A) => !!(sec && A && A.aeroIsInside && A.aeroIsInside(sec) && WALL_ROLES.has(A.AERO_ROLE[sec]));
  const isOuter = (sec, A) => !!(sec && A && A.aeroIsSkin && A.aeroIsSkin(sec));

  // ---- MAKE: the covering welded, its triangles on a grid; the inside layers' slots (nothing bound yet) ----
  // outers / inners: [{ R (the group's skin_break record), base (its rest, model frame), pos (the live array), off
  // (the group's pivot offset or null: pos = model - off) }]
  function make(outers, inners) {
    const t0 = now();
    const wid = [], key = new Map(), rep = [];           // per outer group: welded id per vertex; a copy per welded id
    let nw = 0;
    outers.forEach((O, g) => {
      const nv = O.base.length / 3, w = new Int32Array(nv), b = O.base, of = O.off;
      for (let v = 0; v < nv; v++) {
        const x = b[v * 3] + (of ? of[0] : 0), y = b[v * 3 + 1] + (of ? of[1] : 0), z = b[v * 3 + 2] + (of ? of[2] : 0);
        const k = Math.round(x * WELD) + ',' + Math.round(y * WELD) + ',' + Math.round(z * WELD);
        let id = key.get(k);
        if (id === undefined) { id = nw++; key.set(k, id); rep.push(g, v); }
        w[v] = id;
      }
      wid.push(w);
    });
    // the triangles: the welded ids, the group and its triangle (the record's dead flag)
    let nt = 0; for (const O of outers) nt += (O.R.idx0 || O.R.idx).length / 3;
    const tw = new Int32Array(nt * 3), tg = new Int32Array(nt), tt = new Int32Array(nt), tOff = [];
    { let q = 0; outers.forEach((O, g) => { tOff.push(q); const ix = O.R.idx0 || O.R.idx, n = ix.length / 3;
        for (let t = 0; t < n; t++, q++) { tg[q] = g; tt[q] = t; for (let k = 0; k < 3; k++) tw[q * 3 + k] = wid[g][ix[t * 3 + k]]; } }); }
    // incidence (CSR): each welded vertex's triangles
    const cnt = new Int32Array(nw + 1);
    for (let i = 0; i < nt * 3; i++) cnt[tw[i] + 1]++;
    for (let i = 0; i < nw; i++) cnt[i + 1] += cnt[i];
    const inc = new Int32Array(nt * 3), fill = cnt.slice(0, nw);
    for (let q = 0; q < nt; q++) for (let k = 0; k < 3; k++) inc[fill[tw[q * 3 + k]]++] = q;
    // the welded rest positions (float64 of the float32 base), normals, folds
    const P0 = new Float64Array(nw * 3);
    for (let w = 0; w < nw; w++) { const g = rep[w * 2], v = rep[w * 2 + 1], O = outers[g], of = O.off;
      P0[w * 3] = O.base[v * 3] + (of ? of[0] : 0); P0[w * 3 + 1] = O.base[v * 3 + 1] + (of ? of[1] : 0); P0[w * 3 + 2] = O.base[v * 3 + 2] + (of ? of[2] : 0); }
    const W = { outers, inners, wid, rep, nw, nt, tw, tg, tt, tOff, inc, incOff: cnt, P0, N0: new Float64Array(nw * 3),
                F0: new Float64Array(nw), sigma: 1, grid: null, P: new Float64Array(nw * 3), N: new Float64Array(nw * 3),
                F: new Float64Array(nw), act: new Uint8Array(nw), tAct: new Uint8Array(nt), vB: -1, ms: { make: 0, bind: 0, event: 0, pose: 0 },
                bound: 0, tested: 0, unbound: 0, posed: 0, killed: 0, kept: 0, stats: null };
    const all = null;
    normals(W, P0, W.N0, all, null);
    W.P.set(P0); W.N.set(W.N0);
    // the inward sense: decided at the first binding (the side the inside vertices stand on)
    W.grid = triGrid(W, P0);
    W.rad = new Float64Array(nt);
    for (let q = 0; q < nt; q++) { const a = tw[q * 3] * 3, b = tw[q * 3 + 1] * 3, c = tw[q * 3 + 2] * 3;
      const cx = (P0[a] + P0[b] + P0[c]) / 3, cy = (P0[a + 1] + P0[b + 1] + P0[c + 1]) / 3, cz = (P0[a + 2] + P0[b + 2] + P0[c + 2]) / 3;
      let r = 0; for (const o of [a, b, c]) r = Math.max(r, Math.sqrt((P0[o] - cx) ** 2 + (P0[o + 1] - cy) ** 2 + (P0[o + 2] - cz) ** 2)); W.rad[q] = r; }
    inners.forEach(I => {
      const nv = I.base.length / 3;
      I.wt = new Int32Array(nv).fill(-2);              // -2 not tested, -1 tested and not on the wall, else the outer triangle
      I.wb = new Float64Array(nv * 3);                  // barycentrics
      I.wc = new Float64Array(nv * 3);                  // the offset in the triangle's frame (T1, T2, N)
      I.wf = new Float64Array(nv);                      // its depth under the triangle's own plane at rest (the guard)
      // the snapshot is a triangle soup: every position is ~6 vertices. Welded here (exact positions): each position is
      // bound and posed once, its copies written alongside
      const rep = new Int32Array(nv), k2 = new Map(), b = I.base;
      for (let v = 0; v < nv; v++) { const k = b[v * 3] + ',' + b[v * 3 + 1] + ',' + b[v * 3 + 2]; const r = k2.get(k);
        if (r === undefined) { k2.set(k, v); rep[v] = v; } else rep[v] = r; }
      const cnt = new Int32Array(nv + 1); for (let v = 0; v < nv; v++) cnt[rep[v] + 1]++;
      for (let v = 0; v < nv; v++) cnt[v + 1] += cnt[v];
      const cp = new Int32Array(nv), fl = cnt.slice(0, nv); for (let v = 0; v < nv; v++) cp[fl[rep[v]]++] = v;
      I.rep = rep; I.cpOff = cnt; I.cp = cp; I.nRep = k2.size;
      I.list = null; I.tris = null; I.on = new Uint8Array(nv); I.pinched = new Uint8Array(nv);
    });
    W.ms.make = now() - t0;
    return W;
  }
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // area-weighted vertex normals over the covering's triangles (only `which` welded vertices when given; `live` the
  // per-triangle alive flags, all when null - a vertex with no live triangle falls back to all of its)
  function normals(W, P, N, which, live) {
    const { tw, inc, incOff } = W;
    const one = w => {
      let nx = 0, ny = 0, nz = 0, any = false;
      for (let pass = 0; pass < 2 && !any; pass++) {
        for (let j = incOff[w]; j < incOff[w + 1]; j++) {
          const q = inc[j]; if (live && pass === 0 && !live(q)) continue;
          const a = tw[q * 3] * 3, b = tw[q * 3 + 1] * 3, c = tw[q * 3 + 2] * 3;
          const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
          nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx; any = true;
        }
        if (!live) break;
      }
      const L = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (L > 0) { N[w * 3] = nx / L; N[w * 3 + 1] = ny / L; N[w * 3 + 2] = nz / L; }
    };
    if (which) for (let i = 0; i < which.length; i++) one(which[i]); else for (let w = 0; w < W.nw; w++) one(w);
  }
  // the fold: the distance along sigma x n at which a vertex's inward normal meets a neighbour's (Infinity if none)
  function folds(W, P, N, F, which) {
    const { tw, inc, incOff } = W, s = W.sigma;
    const one = w => {
      let m = Infinity;
      const ax = P[w * 3], ay = P[w * 3 + 1], az = P[w * 3 + 2], nx = N[w * 3], ny = N[w * 3 + 1], nz = N[w * 3 + 2];
      for (let j = incOff[w]; j < incOff[w + 1]; j++) {
        const q = inc[j];
        for (let k = 0; k < 3; k++) { const u = tw[q * 3 + k]; if (u === w) continue;
          const ex = P[u * 3] - ax, ey = P[u * 3 + 1] - ay, ez = P[u * 3 + 2] - az;
          const dn = s * (ex * (N[u * 3] - nx) + ey * (N[u * 3 + 1] - ny) + ez * (N[u * 3 + 2] - nz));
          if (dn < 0) { const t = -(ex * ex + ey * ey + ez * ez) / dn; if (t < m) m = t; } }
      }
      F[w] = m;
    };
    if (which) for (let i = 0; i < which.length; i++) one(which[i]); else for (let w = 0; w < W.nw; w++) one(w);
  }
  // the covering's triangles on a grid of BOUND cells (rest geometry)
  function triGrid(W, P) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let w = 0; w < W.nw; w++) { x0 = Math.min(x0, P[w * 3]); y0 = Math.min(y0, P[w * 3 + 1]); z0 = Math.min(z0, P[w * 3 + 2]);
      x1 = Math.max(x1, P[w * 3]); y1 = Math.max(y1, P[w * 3 + 1]); z1 = Math.max(z1, P[w * 3 + 2]); }
    if (!(x1 >= x0)) { x0 = y0 = z0 = 0; x1 = y1 = z1 = 1; }
    const h = CELL, gx = Math.ceil((x1 - x0) / h) + 1, gy = Math.ceil((y1 - y0) / h) + 1, gz = Math.ceil((z1 - z0) / h) + 1;
    const cells = new Map();
    for (let q = 0; q < W.nt; q++) {
      let a0 = Infinity, b0 = Infinity, c0 = Infinity, a1 = -Infinity, b1 = -Infinity, c1 = -Infinity;
      for (let k = 0; k < 3; k++) { const w = W.tw[q * 3 + k] * 3; a0 = Math.min(a0, P[w]); b0 = Math.min(b0, P[w + 1]); c0 = Math.min(c0, P[w + 2]);
        a1 = Math.max(a1, P[w]); b1 = Math.max(b1, P[w + 1]); c1 = Math.max(c1, P[w + 2]); }
      for (let i = Math.floor((a0 - x0) / h); i <= Math.floor((a1 - x0) / h); i++)
        for (let j = Math.floor((b0 - y0) / h); j <= Math.floor((b1 - y0) / h); j++)
          for (let k = Math.floor((c0 - z0) / h); k <= Math.floor((c1 - z0) / h); k++) {
            const c = (i * gy + j) * gz + k; let L = cells.get(c); if (!L) cells.set(c, L = []); L.push(q); }
    }
    return { x0, y0, z0, h, gx, gy, gz, cells, stamp: new Int32Array(W.nt), q: 0 };
  }
  // the closest point on triangle (a, b, c) to p (Ericson, Real-Time Collision Detection 5.1.5): its barycentrics in B
  function closest(P, a, b, c, px, py, pz, B) {
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const abx = P[b] - ax, aby = P[b + 1] - ay, abz = P[b + 2] - az, acx = P[c] - ax, acy = P[c + 1] - ay, acz = P[c + 2] - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) { B[0] = 1; B[1] = 0; B[2] = 0; return; }
    const bpx = px - P[b], bpy = py - P[b + 1], bpz = pz - P[b + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { B[0] = 0; B[1] = 1; B[2] = 0; return; }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); B[0] = 1 - v; B[1] = v; B[2] = 0; return; }
    const cpx = px - P[c], cpy = py - P[c + 1], cpz = pz - P[c + 2];
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) { B[0] = 0; B[1] = 0; B[2] = 1; return; }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); B[0] = 1 - w; B[1] = 0; B[2] = w; return; }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); B[0] = 0; B[1] = 1 - w; B[2] = w; return; }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
    B[0] = 1 - v - w; B[1] = v; B[2] = w;
  }
  // the nearest covering triangle to p within BOUND (rest): its index (or -1) and barycentrics in B, distance^2 out
  const _B = new Float64Array(3), _Bb = new Float64Array(3);
  function nearest(W, P, px, py, pz, B) {
    const G = W.grid, h = G.h, st = G.stamp, id = ++G.q, rMax = Math.ceil(BOUND / h) + 1;
    const ci = Math.floor((px - G.x0) / h), cj = Math.floor((py - G.y0) / h), ck = Math.floor((pz - G.z0) / h);
    let best = -1, bd = BOUND * BOUND;
    // ring r: the cells at Chebyshev distance r; done once the best is nearer than anything outside the block (r h)
    for (let r = 0; r <= rMax; r++) {
      for (let i = ci - r; i <= ci + r; i++) { if (i < 0 || i >= G.gx) continue; const ei = i === ci - r || i === ci + r;
        for (let j = cj - r; j <= cj + r; j++) { if (j < 0 || j >= G.gy) continue; const ej = ei || j === cj - r || j === cj + r;
          for (let k = ck - r; k <= ck + r; k += (ej || r === 0) ? 1 : 2 * r) { if (k < 0 || k >= G.gz) continue;
            const L = G.cells.get((i * G.gy + j) * G.gz + k); if (!L) continue;
            for (let n = 0; n < L.length; n++) {
              const q = L[n]; if (st[q] === id) continue; st[q] = id;
              const a = W.tw[q * 3] * 3, b = W.tw[q * 3 + 1] * 3, c = W.tw[q * 3 + 2] * 3;
              closest(P, a, b, c, px, py, pz, _Bb);
              const x = _Bb[0] * P[a] + _Bb[1] * P[b] + _Bb[2] * P[c] - px, y = _Bb[0] * P[a + 1] + _Bb[1] * P[b + 1] + _Bb[2] * P[c + 1] - py,
                    z = _Bb[0] * P[a + 2] + _Bb[1] * P[b + 2] + _Bb[2] * P[c + 2] - pz, d = x * x + y * y + z * z;
              if (d < bd || (d === bd && q < best)) { bd = d; best = q; B[0] = _Bb[0]; B[1] = _Bb[1]; B[2] = _Bb[2]; }
            } } } }
      if (best >= 0 && bd <= (r * h) * (r * h)) break;
    }
    return best;
  }
  // a triangle's frame at barycentrics B: the point (o[0..2]), N (o[3..5]), T1 (o[6..8]), T2 = N x T1 (o[9..11])
  const _f = new Float64Array(12);
  function frame(W, P, N, q, B, o) {
    const a = W.tw[q * 3] * 3, b = W.tw[q * 3 + 1] * 3, c = W.tw[q * 3 + 2] * 3;
    o[0] = B[0] * P[a] + B[1] * P[b] + B[2] * P[c]; o[1] = B[0] * P[a + 1] + B[1] * P[b + 1] + B[2] * P[c + 1]; o[2] = B[0] * P[a + 2] + B[1] * P[b + 2] + B[2] * P[c + 2];
    let nx = B[0] * N[a] + B[1] * N[b] + B[2] * N[c], ny = B[0] * N[a + 1] + B[1] * N[b + 1] + B[2] * N[c + 1], nz = B[0] * N[a + 2] + B[1] * N[b + 2] + B[2] * N[c + 2];
    let L = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(L > 1e-12)) {                                 // the vertex normals cancel (a fold flat on itself): the face's
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx; L = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    }
    nx /= L; ny /= L; nz /= L;
    let ex = P[b] - P[a], ey = P[b + 1] - P[a + 1], ez = P[b + 2] - P[a + 2];
    const en = ex * nx + ey * ny + ez * nz; ex -= en * nx; ey -= en * ny; ez -= en * nz;
    let E = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (!(E > 1e-12)) { ex = P[c] - P[a]; ey = P[c + 1] - P[a + 1]; ez = P[c + 2] - P[a + 2]; const e2 = ex * nx + ey * ny + ez * nz; ex -= e2 * nx; ey -= e2 * ny; ez -= e2 * nz; E = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1; }
    ex /= E; ey /= E; ez /= E;
    o[3] = nx; o[4] = ny; o[5] = nz; o[6] = ex; o[7] = ey; o[8] = ez;
    o[9] = ny * ez - nz * ey; o[10] = nz * ex - nx * ez; o[11] = nx * ey - ny * ex;
  }

  // bind one inside vertex (rest): its triangle, barycentrics and offset - or -1
  function bindVertex(W, I, v0) {
    const v = I.rep[v0];
    if (I.wt[v] !== -2) { if (I.wt[v0] === -2) copyBind(I, v); return; }
    const of = I.off, b = I.base;
    const px = b[v * 3] + (of ? of[0] : 0), py = b[v * 3 + 1] + (of ? of[1] : 0), pz = b[v * 3 + 2] + (of ? of[2] : 0);
    const q = nearest(W, W.P0, px, py, pz, _B);
    I.wt[v] = q; W.tested++;
    if (q < 0) { W.unbound++; return; }
    frame(W, W.P0, W.N0, q, _B, _f);
    const dx = px - _f[0], dy = py - _f[1], dz = pz - _f[2];
    I.wb[v * 3] = _B[0]; I.wb[v * 3 + 1] = _B[1]; I.wb[v * 3 + 2] = _B[2];
    I.wc[v * 3] = dx * _f[6] + dy * _f[7] + dz * _f[8];
    I.wc[v * 3 + 1] = dx * _f[9] + dy * _f[10] + dz * _f[11];
    I.wc[v * 3 + 2] = dx * _f[3] + dy * _f[4] + dz * _f[5];
    I.wf[v] = faceDepth(W, W.P0, q, px, py, pz);
    W.bound++;
    copyBind(I, v);
  }
  function copyBind(I, v) {
    for (let j = I.cpOff[v]; j < I.cpOff[v + 1]; j++) { const u = I.cp[j]; if (u === v) continue;
      I.wt[u] = I.wt[v]; I.wf[u] = I.wf[v]; for (let k = 0; k < 3; k++) { I.wb[u * 3 + k] = I.wb[v * 3 + k]; I.wc[u * 3 + k] = I.wc[v * 3 + k]; } }
  }
  // the depth of p under triangle q's own plane (along sigma x its winding normal), unsigned sigma not applied here
  function faceDepth(W, P, q, px, py, pz) {
    const a = W.tw[q * 3] * 3, b = W.tw[q * 3 + 1] * 3, c = W.tw[q * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return ((px - P[a]) * nx + (py - P[a + 1]) * ny + (pz - P[a + 2]) * nz) / L;
  }
  // the inward sense: the side most inside vertices stand on (signed depths summed over a sample), decided once
  function senseOf(W) {
    let s = 0, n = 0;
    for (const I of W.inners) { const nv = I.wt.length; for (let v = 0; v < nv && n < 20000; v += 7) {
      if (I.wt[v] === -2) bindVertex(W, I, v);
      if (I.wt[v] >= 0) { s += Math.sign(I.wc[v * 3 + 2]); n++; } } }
    W.sigma = s < 0 ? -1 : 1;
    folds(W, W.P0, W.N0, W.F0, null);
  }

  // ---- THE EVENT (after every group's skin_break.event): which covering moves, the inside vertices bound over it,
  // the triangles of both layers together. Returns the inside groups whose index changed ----
  function event(W, vB) {
    if (W.vB === vB) return null;
    W.vB = vB;
    const t0 = now();
    if (!W.sensed) { senseOf(W); W.F.set(W.F0); W.sensed = true; }
    const { outers, tw, tg, tt, nt, tOff } = W;
    // the covering triangles that move: a vertex riding its nodes, or draping, in its own record
    const tAct = W.tAct; tAct.fill(0);
    const act = W.act; act.fill(0);
    let nAct = 0;
    for (let q = 0; q < nt; q++) {
      const O = outers[tg[q]], R = O.R; if (!R.active) continue;
      const ix = R.idx0 || R.idx, t = tt[q], ride = R.ride, sag = R.sag;
      let m = false;
      for (let k = 0; k < 3; k++) { const v = ix[t * 3 + k]; if ((ride && ride[v]) || (sag && sag[v] > 0)) { m = true; break; } }
      if (m) { tAct[q] = 1; nAct++; for (let k = 0; k < 3; k++) act[tw[q * 3 + k]] = 1; }
    }
    const aw = []; for (let w = 0; w < W.nw; w++) if (act[w]) aw.push(w);
    W.aw = Int32Array.from(aw); W.nAct = nAct;
    // the moving triangles' rest boxes, grown by BOUND, on a coarse lattice (BOUND cells): the inside vertices near them
    const G = W.grid, hN = BOUND, near = new Set(), cellN = (x, y, z) => (Math.floor((x - G.x0) / hN) * 4096 + Math.floor((y - G.y0) / hN)) * 4096 + Math.floor((z - G.z0) / hN);
    for (let q = 0; q < nt; q++) if (tAct[q]) {
      let a0 = Infinity, b0 = Infinity, c0 = Infinity, a1 = -Infinity, b1 = -Infinity, c1 = -Infinity;
      for (let k = 0; k < 3; k++) { const w = tw[q * 3 + k] * 3, P = W.P0; a0 = Math.min(a0, P[w]); b0 = Math.min(b0, P[w + 1]); c0 = Math.min(c0, P[w + 2]);
        a1 = Math.max(a1, P[w]); b1 = Math.max(b1, P[w + 1]); c1 = Math.max(c1, P[w + 2]); }
      for (let x = a0 - BOUND; x < a1 + BOUND + hN; x += hN) for (let y = b0 - BOUND; y < b1 + BOUND + hN; y += hN)
        for (let z = c0 - BOUND; z < c1 + BOUND + hN; z += hN) near.add(cellN(Math.min(x, a1 + BOUND), Math.min(y, b1 + BOUND), Math.min(z, c1 + BOUND)));
    }
    const changed = [];
    for (const I of W.inners) {
      const R = I.R, nv = I.wt.length, b = I.base, of = I.off;
      // the candidates: near a moving covering triangle, or riding their nodes (D4a): bound if not yet tested
      const list = [], rep = I.rep, on = I.on, was = I.was || (I.was = new Uint8Array(nv)); was.set(on); on.fill(0);
      for (let v = 0; v < nv; v++) {
        if (rep[v] !== v) continue;                     // a copy: posed with its representative
        let cand = R.active && R.ride && R.ride[v];
        if (!cand && near.size) {
          const px = b[v * 3] + (of ? of[0] : 0), py = b[v * 3 + 1] + (of ? of[1] : 0), pz = b[v * 3 + 2] + (of ? of[2] : 0);
          cand = near.has(cellN(px, py, pz));
        }
        if (!cand) continue;
        if (I.wt[v] === -2) bindVertex(W, I, v);
        if (I.wt[v] >= 0) { list.push(v); for (let j = I.cpOff[v]; j < I.cpOff[v + 1]; j++) on[I.cp[j]] = 1; foreignOf(W, I, v); }
      }
      I.list = Int32Array.from(list);
      // a vertex the wall posed that it no longer poses is back at its rest (G1851's own pose rewrites it if it rides)
      for (let v = 0; v < nv; v++) if (was[v] && !on[v]) for (let k = 0; k < 3; k++) I.pos[v * 3 + k] = b[v * 3 + k] - (of ? of[k] : 0);
      // the triangles with a vertex on the wall's posed list (both layers' rule, at the event and per frame)
      const ix0 = R.idx0 || R.idx, ntI = ix0.length / 3, mark = on, tris = [];
      for (let t = 0; t < ntI; t++) if (mark[ix0[t * 3]] || mark[ix0[t * 3 + 1]] || mark[ix0[t * 3 + 2]]) tris.push(t);
      I.tris = Int32Array.from(tris);
      // the tear watches them too (they move with the covering now)
      if (R.watch && tris.length) { const s = new Set(R.watch); for (const t of tris) s.add(t); R.watch = Int32Array.from([...s].sort((x, y) => x - y)); }
      if (applyTris(W, I)) changed.push(I);
    }
    W.tornSeen = 0; for (const O of W.outers) W.tornSeen += O.R.torn || 0;
    void tOff;
    W.ms.event += now() - t0; W.events = (W.events || 0) + 1;
    return changed;
  }
  // the covering triangle q: alive (its record's dead flag 0) and its piece (its first vertex's)
  const aliveT = (W, q) => { const R = W.outers[W.tg[q]].R; return !R.dead || !R.dead[W.tt[q]]; };
  const pieceT = (W, q) => { const R = W.outers[W.tg[q]].R, ix = R.idx0 || R.idx; return R.vp ? R.vp[ix[W.tt[q] * 3]] : 0; };
  // G1856: both layers' triangles together. Returns true when the inside group's index changed
  function applyTris(W, I) {
    const R = I.R; if (!R.active || !I.tris) return false;
    const ix0 = R.idx0, idx = R.idx, dead = R.dead, vp = R.vp, wt = I.wt;
    let ch = false;
    for (let j = 0; j < I.tris.length; j++) {
      const t = I.tris[j], a = ix0[t * 3], b = ix0[t * 3 + 1], c = ix0[t * 3 + 2];
      if (dead[t] === 2) continue;                       // torn by its own stretch: stays torn
      let kill = false, piece = -1, all = true, nb = 0;
      for (const v of [a, b, c]) {
        const q = wt[v];
        if (q < 0) { all = false; continue; }
        nb++;
        if (!aliveT(W, q)) { kill = true; break; }
        const p = pieceT(W, q);
        if (piece < 0) piece = p; else if (p !== piece) { kill = true; break; }
      }
      let d;
      if (kill) d = 1;
      else if (all) d = 0;                               // wholly on live covering of one piece: the wall holds
      else {                                             // mixed: D4a's own rule, and on the covering's piece
        d = dead[t];
        if (!d && nb && vp) for (const v of [a, b, c]) if (wt[v] < 0 && vp[v] !== piece) { d = 1; break; }
      }
      if (d !== dead[t]) {
        if (d) { idx[t * 3] = idx[t * 3 + 1] = idx[t * 3 + 2] = a; R.removed++; W.killed++; }
        else { idx[t * 3] = a; idx[t * 3 + 1] = b; idx[t * 3 + 2] = c; R.removed--; W.kept++; }
        dead[t] = d; ch = true;
      }
    }
    return ch;
  }

  // ---- PER FRAME (after the covering's own pose and tear): the inside vertices on the wall, and the triangles of
  // both layers again where the covering tore this frame. Returns the inside groups whose index changed ----
  function pose(W) {
    if (W.vB < 0 || !W.aw) return null;
    const t0 = now();
    const { outers, rep, P, N, F, aw } = W;
    // the moving covering's live positions (model frame), normals over live triangles, folds
    // what moved since the last frame: a covering vertex that moved dirties its triangles' vertices (their normals and
    // folds); an inside vertex whose triangle is clean keeps its pose (a wreck lying still costs the read and no more).
    // An event (the moving set changed) or a tear (the live triangles changed) dirties everything
    let torn = 0; for (const O of outers) torn += O.R.torn || 0;
    const force = W.awPrev !== aw || torn !== W.tornPose; W.tornPose = torn;
    if (!W.mv || W.mv.length !== W.nw) { W.mv = new Uint8Array(W.nw); W.dirty = new Uint8Array(W.nw); }
    const mv = W.mv, dirty = W.dirty; mv.fill(0); dirty.fill(0);
    for (let i = 0; i < aw.length; i++) { const w = aw[i], O = outers[rep[w * 2]], v = rep[w * 2 + 1], of = O.off;
      const x = O.pos[v * 3] + (of ? of[0] : 0), y = O.pos[v * 3 + 1] + (of ? of[1] : 0), z = O.pos[v * 3 + 2] + (of ? of[2] : 0);
      if (force || x !== P[w * 3] || y !== P[w * 3 + 1] || z !== P[w * 3 + 2]) { mv[w] = 1; P[w * 3] = x; P[w * 3 + 1] = y; P[w * 3 + 2] = z; } }
    // (a vertex that stopped moving at an event is back at its rest: so is the record's pose of it)
    if (W.awPrev !== aw) { if (W.awPrev) for (const w of W.awPrev) if (!W.act[w]) {
        for (let k = 0; k < 3; k++) { P[w * 3 + k] = W.P0[w * 3 + k]; N[w * 3 + k] = W.N0[w * 3 + k]; } F[w] = W.F0[w]; }
      W.awPrev = aw; }
    const dw = [];
    for (let i = 0; i < aw.length; i++) { const w = aw[i]; if (!mv[w]) continue;
      for (let j = W.incOff[w]; j < W.incOff[w + 1]; j++) { const q = W.inc[j]; for (let k = 0; k < 3; k++) { const u = W.tw[q * 3 + k]; if (!dirty[u] && W.act[u]) { dirty[u] = 1; dw.push(u); } } } }
    const tA = now();
    normals(W, P, N, dw, q => aliveT(W, q));
    folds(W, P, N, F, dw);
    W.ms.nf = (W.ms.nf || 0) + now() - tA;
    const changed = [];
    let posed = 0;
    const pinchQ = [], sg = W.sigma, tw = W.tw;
    for (const I of W.inners) {
      if (!I.list || !I.list.length) continue;
      const list = I.list, pos = I.pos, of = I.off, wb = I.wb, wc = I.wc, wt = I.wt, wf = I.wf, cpOff = I.cpOff, cp = I.cp, pin = I.pinched;
      const ox = of ? of[0] : 0, oy = of ? of[1] : 0, oz = of ? of[2] : 0;
      for (let j = 0; j < list.length; j++) {
        const v = list[j], q = wt[v];
        if (!dirty[tw[q * 3]] && !dirty[tw[q * 3 + 1]] && !dirty[tw[q * 3 + 2]]) {
          // its triangle is clean: its pose stands - unless foreign covering round it moved (the pinch's own test)
          if (I.fo && I.fo[v] === 1) { const L = I.nbF.get(v); let d = false;
            for (let m = 0; m < L.length && !d; m++) { const t = L[m]; d = dirty[tw[t * 3]] || dirty[tw[t * 3 + 1]] || dirty[tw[t * 3 + 2]]; }
            if (d && foreignMoved(W, I, v, pos[v * 3] + ox, pos[v * 3 + 1] + oy, pos[v * 3 + 2] + oz)) pinchQ.push(I, v, 2); }
          continue;
        }
        _B[0] = wb[v * 3]; _B[1] = wb[v * 3 + 1]; _B[2] = wb[v * 3 + 2];
        frame(W, P, N, q, _B, _f);
        const ca = wc[v * 3], cb = wc[v * 3 + 1];
        let cn = wc[v * 3 + 2];
        const a = tw[q * 3], b = tw[q * 3 + 1], c = tw[q * 3 + 2];
        const fn = Math.min(F[a], F[b], F[c]);
        // the crease: the inward depth held under the fold (the triangle's three vertices' least fold, now and at rest)
        if (cn * sg > 0 && fn < Infinity) {
          const fr = Math.min(W.F0[a], W.F0[b], W.F0[c]), d = Math.abs(cn);
          const lim = KAPPA * fn * Math.max(1, fr < Infinity ? d / (KAPPA * fr) : 1); if (d > lim) cn = sg * lim;
        }
        let X = _f[0] + ca * _f[6] + cb * _f[9] + cn * _f[3], Y = _f[1] + ca * _f[7] + cb * _f[10] + cn * _f[4], Z = _f[2] + ca * _f[8] + cb * _f[11] + cn * _f[5];
        // THE GUARD: never shallower under its own triangle's plane than at rest (nor than PINCH_IN): a triangle sheared
        // off its vertex normals would otherwise let the offset through its face. At rest it is the rest: no move
        let pinched = 0;
        { const f0 = sg * wf[v], tgt = Math.min(PINCH_IN, f0);
          if (f0 > 0) { const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (L > 1e-12) { nx /= L; ny /= L; nz /= L;
              const df = sg * ((X - P[a * 3]) * nx + (Y - P[a * 3 + 1]) * ny + (Z - P[a * 3 + 2]) * nz);
              if (df < tgt - 1e-9) { const pu = sg * (tgt - df); X += nx * pu; Y += ny * pu; Z += nz * pu; pinched = 1; } } } }
        X -= ox; Y -= oy; Z -= oz;
        for (let k = cpOff[v]; k < cpOff[v + 1]; k++) { const u = cp[k]; pos[u * 3] = X; pos[u * 3 + 1] = Y; pos[u * 3 + 2] = Z; pin[u] = pinched; }
        // foreign covering within reach, or the covering crumpling: the pinch (below) asks the live covering round it
        if (fn < CRUMPLE * Math.min(W.F0[a], W.F0[b], W.F0[c]) || (I.fo && I.fo[v] === 1 && foreignMoved(W, I, v, X + ox, Y + oy, Z + oz))) pinchQ.push(I, v, 2);
      }
      posed += list.length;
    }
    const tB = now();
    W.ms.verts = (W.ms.verts || 0) + tB - tA;
    if (pinchQ.length) pinch(W, pinchQ);
    W.ms.pinch = (W.ms.pinch || 0) + now() - tB;
    // both layers' triangles again, when the covering tore this frame
    if (torn !== W.tornSeen) { W.tornSeen = torn; for (const I of W.inners) if (I.list && I.list.length && applyTris(W, I)) changed.push(I); }
    W.posed = posed;
    W._lastPose = now() - t0; W.ms.pose += W._lastPose; W.poses = (W.poses || 0) + 1;
    return changed;
  }
  // THE PINCH: where the covering crumples (its fold radius under CRUMPLE x its rest's: a crease, or part of it swung in
  // over another) the offset alone can leave an inside vertex behind a piece of the covering that moved in front of it.
  // Each such vertex is asked against the LIVE covering round it (the nearest live triangle within its depth + 1 cm, its
  // live inward normal there): found outside, it is pushed back PINCH_IN inside - at a crease both layers pinch
  // together. Twice (a push can meet the next fold). Only the crumpling patch's vertices pay for it
  const _Bp = new Float64Array(3);
  // a vertex's covering neighbourhood at rest: the triangles within its depth + PINCH_NB (the rest grid's ring walk, each
  // triangle's rest sphere), made when the vertex joins the wall at an event
  const PINCH_NB = 0.06;
  const FOREIGN_K = 4;         // ...its 4 nearest foreign triangles (by centroid) are watched
  function nbOf(W, I, v) {
    if (!I.nb) I.nb = new Map();
    let L = I.nb.get(v); if (L) return L;
    const G = W.grid, h = G.h, P = W.P0, of = I.off, b = I.base, r0 = Math.min(BOUND, Math.abs(I.wc[v * 3 + 2])) + PINCH_NB;
    const px = b[v * 3] + (of ? of[0] : 0), py = b[v * 3 + 1] + (of ? of[1] : 0), pz = b[v * 3 + 2] + (of ? of[2] : 0);
    const ci = Math.floor((px - G.x0) / h), cj = Math.floor((py - G.y0) / h), ck = Math.floor((pz - G.z0) / h), R = Math.ceil(r0 / h), id = ++G.q, out = [];
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) for (let k = ck - R; k <= ck + R; k++) {
      const C = G.cells.get((i * G.gy + j) * G.gz + k); if (!C || i < 0 || j < 0 || k < 0 || i >= G.gx || j >= G.gy || k >= G.gz) continue;
      for (const q of C) { if (G.stamp[q] === id) continue; G.stamp[q] = id;
        // (its rest sphere within r0: a superset of the triangles within r0, no closest point needed)
        const a = W.tw[q * 3] * 3, bb = W.tw[q * 3 + 1] * 3, c = W.tw[q * 3 + 2] * 3;
        const cx = (P[a] + P[bb] + P[c]) / 3 - px, cy = (P[a + 1] + P[bb + 1] + P[c + 1]) / 3 - py, cz = (P[a + 2] + P[bb + 2] + P[c + 2]) / 3 - pz;
        const rr = r0 + W.rad[q];
        if (cx * cx + cy * cy + cz * cz <= rr * rr) out.push(q); } }
    L = Int32Array.from(out); I.nb.set(v, L);
    return L;
  }
  // FOREIGN covering round a vertex: a triangle of its rest neighbourhood that is not in the 2-ring of the triangle it is
  // bound to - the next section across a seam (the pillar rings against the body), a flange: covering that can slide in
  // front of it without any crumpling. Such a vertex is asked by the pinch every frame (I.fo: 1 yes, 2 no, 0 not known)
  function foreignOf(W, I, v) {
    if (!I.fo) I.fo = new Uint8Array(I.wt.length);
    if (I.fo[v]) return I.fo[v] === 1;
    const L = nbOf(W, I, v), q0 = I.wt[v], near = new Set([q0]), ring = qs => { const out = [];
      for (const q of qs) for (let k = 0; k < 3; k++) { const w = W.tw[q * 3 + k]; for (let j = W.incOff[w]; j < W.incOff[w + 1]; j++) { const u = W.inc[j]; if (!near.has(u)) { near.add(u); out.push(u); } } }
      return out; };
    ring(ring([q0]));
    // (the FOREIGN_K nearest by centroid: the next section's few triangles over it, not the whole neighbourhood)
    const P0f = W.P0, of0 = I.off, b0 = I.base, qx = b0[v * 3] + (of0 ? of0[0] : 0), qy = b0[v * 3 + 1] + (of0 ? of0[1] : 0), qz = b0[v * 3 + 2] + (of0 ? of0[2] : 0);
    const F = []; for (let m = 0; m < L.length; m++) if (!near.has(L[m])) F.push(L[m]);
    if (F.length > FOREIGN_K) { F.sort((x, y) => centDist(W, P0f, x, qx, qy, qz) - centDist(W, P0f, y, qx, qy, qz)); F.length = FOREIGN_K; }
    I.fo[v] = F.length ? 1 : 2;
    if (F.length) {
      // ...and each one's rest distance from the vertex (to its centroid): the pinch asks only when one has changed
      if (!I.nbF) { I.nbF = new Map(); I.nbFd = new Map(); }
      const P0 = W.P0, of = I.off, b = I.base, px = b[v * 3] + (of ? of[0] : 0), py = b[v * 3 + 1] + (of ? of[1] : 0), pz = b[v * 3 + 2] + (of ? of[2] : 0);
      I.nbF.set(v, Int32Array.from(F)); I.nbFd.set(v, Float64Array.from(F, q => centDist(W, P0, q, px, py, pz)));
    }
    return F.length > 0;
  }
  function centDist(W, P, q, px, py, pz) {
    const a = W.tw[q * 3] * 3, b = W.tw[q * 3 + 1] * 3, c = W.tw[q * 3 + 2] * 3;
    const x = (P[a] + P[b] + P[c]) / 3 - px, y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - py, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - pz;
    return Math.sqrt(x * x + y * y + z * z);
  }
  // has foreign covering round v moved against it since rest (a centroid's distance off its rest's by over 1 mm)?
  function foreignMoved(W, I, v, px, py, pz) {
    const L = I.nbF.get(v), D = I.nbFd.get(v), P = W.P;
    for (let m = 0; m < L.length; m++) if (Math.abs(centDist(W, P, L[m], px, py, pz) - D[m]) > 0.001) return true;
    return false;
  }
  function pinch(W, Q) {
    const P = W.P, N = W.N, s = W.sigma, tw = W.tw;
    // the live covering on a grid of the candidates' box (typed arrays: a count pass, a fill pass)
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let j = 0; j < Q.length; j += 3) { const I = Q[j], v = Q[j + 1], of = I.off;
      const x = I.pos[v * 3] + (of ? of[0] : 0), y = I.pos[v * 3 + 1] + (of ? of[1] : 0), z = I.pos[v * 3 + 2] + (of ? of[2] : 0);
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
    const M = BOUND + 0.01; x0 -= M; y0 -= M; z0 -= M; x1 += M; y1 += M; z1 += M;
    let h = 0.05; while (((x1 - x0) / h + 1) * ((y1 - y0) / h + 1) * ((z1 - z0) / h + 1) > 2e6) h *= 2;
    const gx = Math.floor((x1 - x0) / h) + 1, gy = Math.floor((y1 - y0) / h) + 1, gz = Math.floor((z1 - z0) / h) + 1, nc = gx * gy * gz;
    if (!W.pg || W.pg.cnt.length < nc + 1) W.pg = { cnt: new Int32Array(nc + 1), box: new Int32Array(W.nt * 6), ent: new Int32Array(1 << 16) };
    const G = W.pg, cnt = G.cnt, box = G.box; cnt.fill(0, 0, nc + 1);
    let ne = 0;
    for (let q = 0; q < W.nt; q++) {
      box[q * 6] = 1; box[q * 6 + 3] = 0;                 // empty unless it lies in the box
      if (!aliveT(W, q)) continue;
      const a = tw[q * 3] * 3, b = tw[q * 3 + 1] * 3, c = tw[q * 3 + 2] * 3;
      const a0 = Math.min(P[a], P[b], P[c]), a1 = Math.max(P[a], P[b], P[c]), b0 = Math.min(P[a + 1], P[b + 1], P[c + 1]), b1 = Math.max(P[a + 1], P[b + 1], P[c + 1]),
            c0 = Math.min(P[a + 2], P[b + 2], P[c + 2]), c1 = Math.max(P[a + 2], P[b + 2], P[c + 2]);
      if (a1 < x0 || a0 > x1 || b1 < y0 || b0 > y1 || c1 < z0 || c0 > z1 || a1 - a0 > 1 || b1 - b0 > 1 || c1 - c0 > 1) continue;
      const i0 = Math.max(0, Math.floor((a0 - x0) / h)), i1 = Math.min(gx - 1, Math.floor((a1 - x0) / h)), j0 = Math.max(0, Math.floor((b0 - y0) / h)), j1 = Math.min(gy - 1, Math.floor((b1 - y0) / h)),
            k0 = Math.max(0, Math.floor((c0 - z0) / h)), k1 = Math.min(gz - 1, Math.floor((c1 - z0) / h));
      box[q * 6] = i0; box[q * 6 + 1] = j0; box[q * 6 + 2] = k0; box[q * 6 + 3] = i1; box[q * 6 + 4] = j1; box[q * 6 + 5] = k1;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) { cnt[(i * gy + j) * gz + k + 1]++; ne++; }
    }
    for (let i = 0; i < nc; i++) cnt[i + 1] += cnt[i];
    if (G.ent.length < ne) G.ent = new Int32Array(ne * 2);
    const ent = G.ent, fill = W.pgFill && W.pgFill.length >= nc ? W.pgFill : (W.pgFill = new Int32Array(nc));
    fill.set(cnt.subarray(0, nc));
    for (let q = 0; q < W.nt; q++) { if (box[q * 6] > box[q * 6 + 3]) continue;
      for (let i = box[q * 6]; i <= box[q * 6 + 3]; i++) for (let j = box[q * 6 + 1]; j <= box[q * 6 + 4]; j++) for (let k = box[q * 6 + 2]; k <= box[q * 6 + 5]; k++) ent[fill[(i * gy + j) * gz + k]++] = q; }
    const stamp = W.pinStamp && W.pinStamp.length === W.nt ? W.pinStamp : (W.pinStamp = new Int32Array(W.nt));
    let n = 0;
    for (let jq = 0; jq < Q.length; jq += 3) {
      const I = Q[jq], v = Q[jq + 1], of = I.off, pos = I.pos, q0 = I.wt[v];
      if (!aliveT(W, q0)) continue;                     // its covering went: so do its triangles (G1856)
      for (let it = 0; it < 2; it++) {
        const px = pos[v * 3] + (of ? of[0] : 0), py = pos[v * 3 + 1] + (of ? of[1] : 0), pz = pos[v * 3 + 2] + (of ? of[2] : 0);
        // its own triangle first: nothing farther than that can be the nearest
        let best = -1, bd = Infinity, b0 = 0, b1 = 0, b2 = 0;
        const test = q => { const a = tw[q * 3] * 3, b = tw[q * 3 + 1] * 3, c = tw[q * 3 + 2] * 3;
          // (its sphere - the centroid, 1.2 x its rest radius: the tear takes an edge past 1.15 x - beyond the best: skip)
          const cx = (P[a] + P[b] + P[c]) / 3 - px, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - py, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - pz;
          const rr = Math.sqrt(cx * cx + cy * cy + cz * cz) - 1.2 * W.rad[q]; if (rr > 0 && rr * rr >= bd) return;
          closest(P, a, b, c, px, py, pz, _Bp);
          const x = _Bp[0] * P[a] + _Bp[1] * P[b] + _Bp[2] * P[c] - px, y = _Bp[0] * P[a + 1] + _Bp[1] * P[b + 1] + _Bp[2] * P[c + 1] - py, z = _Bp[0] * P[a + 2] + _Bp[1] * P[b + 2] + _Bp[2] * P[c + 2] - pz;
          const d = x * x + y * y + z * z; if (d < bd) { bd = d; best = q; b0 = _Bp[0]; b1 = _Bp[1]; b2 = _Bp[2]; } };
        test(q0);
        const id = W.pinId = (W.pinId || 0) + 1; stamp[q0] = id;
        const rad = Math.min(BOUND + 0.01, Math.sqrt(bd)), ci = Math.floor((px - x0) / h), cj = Math.floor((py - y0) / h), ck = Math.floor((pz - z0) / h);
        const i0 = Math.max(0, Math.floor((px - rad - x0) / h)), i1 = Math.min(gx - 1, Math.floor((px + rad - x0) / h)), j0 = Math.max(0, Math.floor((py - rad - y0) / h)),
              j1 = Math.min(gy - 1, Math.floor((py + rad - y0) / h)), k0 = Math.max(0, Math.floor((pz - rad - z0) / h)), k1 = Math.min(gz - 1, Math.floor((pz + rad - z0) / h));
        void ci; void cj; void ck;
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
          const cc = (i * gy + j) * gz + k;
          for (let e = cnt[cc]; e < cnt[cc + 1]; e++) { const q = ent[e]; if (stamp[q] === id) continue; stamp[q] = id; test(q); } }
        if (best < 0) break;
        const a = tw[best * 3] * 3, b = tw[best * 3 + 1] * 3, c = tw[best * 3 + 2] * 3;
        let nx = b0 * N[a] + b1 * N[b] + b2 * N[c], ny = b0 * N[a + 1] + b1 * N[b + 1] + b2 * N[c + 1], nz = b0 * N[a + 2] + b1 * N[b + 2] + b2 * N[c + 2];
        const Ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= Ln; ny /= Ln; nz /= Ln;
        const qx = px - (b0 * P[a] + b1 * P[b] + b2 * P[c]), qy = py - (b0 * P[a + 1] + b1 * P[b + 1] + b2 * P[c + 1]), qz = pz - (b0 * P[a + 2] + b1 * P[b + 2] + b2 * P[c + 2]);
        const dep = s * (qx * nx + qy * ny + qz * nz);
        if (dep >= 0) break;
        const push = PINCH_IN - dep;
        const X = pos[v * 3] + s * nx * push, Y = pos[v * 3 + 1] + s * ny * push, Z = pos[v * 3 + 2] + s * nz * push;
        for (let k = I.cpOff[v]; k < I.cpOff[v + 1]; k++) { const u = I.cp[k]; pos[u * 3] = X; pos[u * 3 + 1] = Y; pos[u * 3 + 2] = Z; I.pinched[u] = 1; }
        if (it === 0) n++;
      }
    }
    W.pinchedN = n; W.pinchQ = Q.length / 3;
  }
  // the healed aeroplane (a reset): nothing held (the inside groups' records restore their own index)
  function reset(W) { W.vB = -1; W.aw = null; W.awPrev = null; W.tornPose = -1; W.mv = null; W.P.set(W.P0); W.N.set(W.N0); if (W.sensed) W.F.set(W.F0); for (const I of W.inners) { I.list = null; I.tris = null; } }
  const API = { BOUND, KAPPA, CRUMPLE, PINCH_IN, WALL_ROLES, isWall, isOuter, make, event, pose, reset, closest, nearest, normals, folds, frame, bindVertex };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SKIN_WALL = API;
})();
