// 29_obstacles.js — THE SOLID THINGS ON THE GROUND (G433, the user: "hitbox for
// static car props ... audit hitboxes for everything ... No more than 1 meter
// discrepancy with the visual mesh").
//
// Until now the solver collided with TREES only (30_solver.js: a cylinder per
// tree, treesNear); houses, props, cars, the parked aeroplanes' named boxes
// (parked.js, read by nothing) were pictures the aeroplane flew through.
//
// ONE SHAPE FOR EVERYTHING: a COLUMN GRID in the object's own frame - a cell
// of 0.5 or 1 m holds the lowest and the highest surface point over it (so a
// deck on posts keeps the air under it free, a car's roof its height), plus a
// 2-D signed distance to the footprint's edge for the push direction. It is
// rasterised from the object's own triangles (the same mesh the eye sees),
// so the discrepancy is bounded by the cell: an L-shaped house, a semi with
// its trailer, a boat's bow are all followed to the cell. A plain box is the
// same shape with one column height (`box`).
// A PARKED AEROPLANE IS THE EXCEPTION (G1060): a cell round a wingtip overhung the drawn tip by up to the cell (the
// Cub's 15 cm, the 172's 50), and a taxi past it touched nothing the eye saw. Its shape is a list of CONVEX PIECES
// cut from its own spec's physics frame (`aircraftShape`: the wing's loft rows, the tail's stations, the cage for
// the fuselage, the struts, the wheels, the engines), exact to the geometry, no grid; `penetration` takes either.
//
// The REGISTRY is the world's (W.obstacles, 20_world.js): bins of 64 m like
// the trees', near(x, z) for the solver, add/move/remove for the viewer that
// stands and takes down the objects (render_premises.js), move for the
// traffic. `penetration(rec, px, py, pz, out)` answers a point: null, or the
// world displacement that takes it out - the smaller of straight up and
// sideways along the distance field's gradient - which the solver turns into
// a spring force per node (the trees' KTn / CTn).
//
// Pure: no THREE, browser and node.
const OBSTACLES = (() => {
  'use strict';
  const BIN = 64;

  // ---- the shape: a column grid over a triangle soup in the object's frame -----------------
  // pos: flat xyz (Float32Array or Array), idx: triangle indices or null (consecutive triples),
  // cell: metres. opts.pad: cells of free border kept round the footprint (1).
  // opts.base (G844, C2c): a shape rasterised EARLIER from other triangles of the same object, in the same frame, cell and
  // pad (the house worker's raster of a house's own bags): the result is the raster of both soups - the grid is the lattice
  // both share (every grid starts on a multiple of the cell), grown to hold both, the base's columns copied in and the new
  // triangles marked over them. The same cells, lows and highs one pass over both soups gives, up to a vertex lying
  // exactly on a lattice line.
  // opts.pts (G1999): POINTS, x y z flat, each marked once (columnPoints' - a prop key's raster stood in the object's frame), with
  // the triangles or alone; their box joins the grid's. Absent, nothing changes.
  function rasterise(pos, idx, cell, opts) {
    const B = opts && opts.base && opts.base.cell === cell ? opts.base : null;
    const PT = opts && opts.pts && opts.pts.length ? opts.pts : null;
    const nTri = idx ? idx.length / 3 : pos.length / 9;
    if (!nTri && !B && !PT) return null;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const nv = nTri ? pos.length / 3 : 0;
    for (let i = 0; i < nv; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (PT) for (let i = 0; i < PT.length; i += 3) { const x = PT[i], z = PT[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (!isFinite(x0) && !B) return null;
    const pad = (opts && opts.pad !== undefined) ? opts.pad : 1;
    let ox = isFinite(x0) ? Math.floor(x0 / cell) * cell - pad * cell : Infinity, oz = isFinite(z0) ? Math.floor(z0 / cell) * cell - pad * cell : Infinity;
    let nx = isFinite(x0) ? Math.ceil((x1 - ox) / cell) + pad + 1 : 0, nz = isFinite(z0) ? Math.ceil((z1 - oz) / cell) + pad + 1 : 0;
    if (B) {   // the union's grid: its origin the lower of the two (both on the lattice), its far edge the farther
      const ex = Math.max(isFinite(ox) ? ox + nx * cell : -Infinity, B.ox + B.nx * cell), ez = Math.max(isFinite(oz) ? oz + nz * cell : -Infinity, B.oz + B.nz * cell);
      ox = Math.min(ox, B.ox); oz = Math.min(oz, B.oz);
      nx = Math.round((ex - ox) / cell); nz = Math.round((ez - oz) / cell);
    }
    const lo = new Float32Array(nx * nz).fill(Infinity), hi = new Float32Array(nx * nz).fill(-Infinity);
    if (B) {
      const di = Math.round((B.ox - ox) / cell), dj = Math.round((B.oz - oz) / cell);
      for (let j = 0; j < B.nz; j++) for (let i = 0; i < B.nx; i++) { const s = j * B.nx + i, k = (j + dj) * nx + i + di; lo[k] = B.lo[s]; hi[k] = B.hi[s]; }
    }
    const mark = (x, y, z) => {
      const i = Math.floor((x - ox) / cell), j = Math.floor((z - oz) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return;
      const k = j * nx + i;
      if (y < lo[k]) lo[k] = y;
      if (y > hi[k]) hi[k] = y;
    };
    if (PT) for (let i = 0; i < PT.length; i += 3) mark(PT[i], PT[i + 1], PT[i + 2]);   // (G1999: the points, once each)
    // every triangle sampled on a barycentric lattice at half a cell (its vertices always)
    const step = cell * 0.5;
    for (let t = 0; t < nTri; t++) {
      const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
      const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
      const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
      const e1 = Math.hypot(bx - ax, bz - az), e2 = Math.hypot(cx - ax, cz - az), e3 = Math.hypot(cx - bx, cz - bz);
      const n = Math.min(64, Math.max(1, Math.ceil(Math.max(e1, e2, e3) / step)));
      for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) {
        const fu = u / n, fv = v / n, fw = 1 - fu - fv;
        mark(ax * fw + bx * fu + cx * fv, ay * fw + by * fu + cy * fv, az * fw + bz * fu + cz * fv);
      }
    }
    // the 2-D signed distance to the footprint's edge (metres; negative inside): a 3-4 chamfer
    // transform in cells, outward from the occupied cells and inward from the free ones
    const occ = new Uint8Array(nx * nz);
    let top = -Infinity, any = 0;
    for (let k = 0; k < nx * nz; k++) if (hi[k] >= lo[k]) { occ[k] = 1; any++; if (hi[k] > top) top = hi[k]; }
    if (!any) return null;
    const d = new Float32Array(nx * nz);
    const dt = (inside) => {
      const D = new Float32Array(nx * nz);
      for (let k = 0; k < nx * nz; k++) D[k] = (occ[k] === inside) ? 1e9 : 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i; let m = D[k];
        if (i > 0) m = Math.min(m, D[k - 1] + 3);
        if (j > 0) { m = Math.min(m, D[k - nx] + 3); if (i > 0) m = Math.min(m, D[k - nx - 1] + 4); if (i + 1 < nx) m = Math.min(m, D[k - nx + 1] + 4); }
        D[k] = m;
      }
      for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i; let m = D[k];
        if (i + 1 < nx) m = Math.min(m, D[k + 1] + 3);
        if (j + 1 < nz) { m = Math.min(m, D[k + nx] + 3); if (i + 1 < nx) m = Math.min(m, D[k + nx + 1] + 4); if (i > 0) m = Math.min(m, D[k + nx - 1] + 4); }
        D[k] = m;
      }
      return D;
    };
    const dOut = dt(0), dIn = dt(1);      // dOut: free cells' distance to the footprint; dIn: occupied cells' distance to free ground
    for (let k = 0; k < nx * nz; k++) d[k] = (occ[k] ? -(dIn[k] / 3) : (dOut[k] / 3)) * cell;
    const xr = Math.max(Math.hypot(ox, oz), Math.hypot(ox + nx * cell, oz), Math.hypot(ox, oz + nz * cell), Math.hypot(ox + nx * cell, oz + nz * cell));
    return { cell, nx, nz, ox, oz, lo, hi, d, top, xr, cells: any };
  }
  // a plain box, L along z, W along x, H up, its footprint centred on the origin, its underside on y = 0
  function box(L, W, H, cell) {
    const c = cell || 0.5, hw = W / 2, hl = L / 2;
    const pos = [-hw, 0, -hl, hw, 0, -hl, hw, 0, hl, -hw, 0, hl, -hw, H, -hl, hw, H, -hl, hw, H, hl, -hw, H, hl];
    const idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
    return rasterise(pos, idx, c);
  }

  // ---- CONVEX PIECES (G1060, the user: "the hitbox of the wing of the cub is a few centimeters too long compared
  // to the wing mesh ... can't the editor tell you the exact dimensions of the wing box? And the fuselage?") ----------
  // The second shape: a list of convex pieces, each the hull of a handful of points (a wing bay's two sections, a
  // cage frustum's two stations, a wheel's drum), kept as its face planes n.p <= d. A point is inside the shape when
  // it is inside one piece; the way out is the nearest face of a piece it is in whose exit lands in no other piece
  // (a bay's root face is the next bay's: never an exit). No grid, so no cell: the discrepancy is the geometry's own.
  // THE HULL: brute force over the point triples (a piece has <= ~30 points: 4k triples) - every plane with all the
  // points on one side is a face; coplanar triples of one face dedupe. Fewer than 4 faces is a flat set: no piece.
  function hull(pts) {
    const n = pts.length;
    let sc = 1; for (const p of pts) sc = Math.max(sc, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
    const eps = 1e-7 * sc, P = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      const a = pts[i], b = pts[j], c = pts[k];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz);
      if (L < 1e-10 * sc * sc) continue;
      nx /= L; ny /= L; nz /= L;
      const d = nx * a[0] + ny * a[1] + nz * a[2];
      let mn = Infinity, mx = -Infinity;
      for (const p of pts) { const s = nx * p[0] + ny * p[1] + nz * p[2] - d; if (s < mn) mn = s; if (s > mx) mx = s; }
      if (mx - mn < eps) continue;
      let q = null;
      if (mx <= eps) q = [nx, ny, nz, d]; else if (mn >= -eps) q = [-nx, -ny, -nz, -d];
      if (!q) continue;
      let dup = false;
      for (let m = 0; m < P.length && !dup; m += 4) dup = P[m] * q[0] + P[m + 1] * q[1] + P[m + 2] * q[2] > 1 - 1e-9 && Math.abs(P[m + 3] - q[3]) < eps;
      if (!dup) P.push(q[0], q[1], q[2], q[3]);
    }
    return P.length >= 16 ? Float64Array.from(P) : null;
  }
  // the most-outside face's signed distance (<= 0: inside)
  function sdist(pc, x, y, z) {
    const P = pc.planes; let m = -Infinity;
    for (let i = 0; i < P.length; i += 4) { const s = P[i] * x + P[i + 1] * y + P[i + 2] * z - P[i + 3]; if (s > m) m = s; }
    return m;
  }
  const inBox = (b, x, y, z) => x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5];
  // list: [{ tag, pts: [[x, y, z], ...] }] in the object's frame -> the shape (null when no piece stands)
  function pieces(list) {
    const out = [];
    for (const q of list) {
      const planes = hull(q.pts); if (!planes) continue;
      const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const p of q.pts) for (let a = 0; a < 3; a++) { if (p[a] < bb[a]) bb[a] = p[a]; if (p[a] > bb[a + 3]) bb[a + 3] = p[a]; }
      out.push({ tag: q.tag, planes, bb });
    }
    if (!out.length) return null;
    let top = -Infinity, xr = 0;
    for (const pc of out) { const b = pc.bb; top = Math.max(top, b[4]); for (const x of [b[0], b[3]]) for (const z of [b[2], b[5]]) xr = Math.max(xr, Math.hypot(x, z)); }
    return { pieces: out, top, xr, cells: out.length, cell: 0, grid: pieceGrid(out) };
  }
  // G1063.1 (train 16's ratchet: the solver +1.7 ms at the taxi): a node inside a parked aeroplane's reach tested all
  // ~60 pieces' boxes (136 ns a query against the raster's one cell). A 0.5 m plan grid lists, per cell, the pieces
  // whose box covers it, in the pieces' own order - the same candidates, the same order, the same answer
  function pieceGrid(out) {
    const g = 0.5;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const pc of out) { const b = pc.bb; x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[2]); x1 = Math.max(x1, b[3]); z1 = Math.max(z1, b[5]); }
    const nx = Math.max(1, Math.ceil((x1 - x0) / g)), nz = Math.max(1, Math.ceil((z1 - z0) / g));
    if (nx * nz > 65536) return null;
    const cells = new Array(nx * nz);
    for (let i = 0; i < out.length; i++) {
      const b = out[i].bb;
      const i0 = Math.max(0, Math.floor((b[0] - x0) / g)), i1 = Math.min(nx - 1, Math.floor((b[3] - x0) / g));
      const j0 = Math.max(0, Math.floor((b[2] - z0) / g)), j1 = Math.min(nz - 1, Math.floor((b[5] - z0) / g));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) (cells[j * nx + k] || (cells[j * nx + k] = [])).push(i);
    }
    return { x0, z0, g, nx, nz, cells };
  }
  function penPieces(S, lx, y, lz) {
    const L = S.pieces, G = S.grid;
    let C = null;
    if (G) {
      const gi = Math.floor((lx - G.x0) / G.g), gj = Math.floor((lz - G.z0) / G.g);
      if (gi < 0 || gj < 0 || gi >= G.nx || gj >= G.nz) {
        // a point on the grid's far edge (lx == x1) still reads the last cell
        const ei = gi === G.nx && lx - G.x0 <= G.nx * G.g ? G.nx - 1 : gi, ej = gj === G.nz && lz - G.z0 <= G.nz * G.g ? G.nz - 1 : gj;
        if (ei < 0 || ej < 0 || ei >= G.nx || ej >= G.nz) return null;
        C = G.cells[ej * G.nx + ei];
      } else C = G.cells[gj * G.nx + gi];
      if (!C) return null;
    }
    let best = Infinity, bx = 0, by = 0, bz = 0, any = false;
    const nC = C ? C.length : L.length;
    for (let c = 0; c < nC; c++) {
      const i = C ? C[c] : c, pc = L[i];
      if (!inBox(pc.bb, lx, y, lz) || sdist(pc, lx, y, lz) > 0) continue;
      any = true;
      const P = pc.planes, grounded = pc.bb[1] < 0.25;
      for (let m = 0; m < P.length; m += 4) {
        const depth = P[m + 3] - (P[m] * lx + P[m + 1] * y + P[m + 2] * lz);
        if (depth >= best) continue;
        if (grounded && P[m + 1] < -0.5) continue;              // a thing on the ground never pushes a node into it
        const e = depth + 0.01, qx = lx + P[m] * e, qy = y + P[m + 1] * e, qz = lz + P[m + 2] * e;
        let inner = false;
        for (let j = 0; j < L.length && !inner; j++) if (j !== i && inBox(L[j].bb, qx, qy, qz) && sdist(L[j], qx, qy, qz) < 0) inner = true;
        if (inner) continue;                                      // a face shared with the next piece is no way out
        best = depth; bx = P[m]; by = P[m + 1]; bz = P[m + 2];
      }
    }
    if (!any) return null;
    if (best === Infinity) { best = S.top - y; bx = 0; by = 1; bz = 0; }   // deep in a knot of pieces: over the top
    return [bx, by, bz, best];
  }

  // ---- A PARKED AEROPLANE FROM ITS OWN SPEC (G1060) -------------------------------------------------------------
  // The frame the physics flies (genFrame of the resolved spec: the same nodes buildGen makes, 6 ms not 100) holds
  // every dimension: the wing's spar stations (its chord, taper, dihedral, incidence, the tip's bow as the loft rows
  // it), the tail's stations and chords, THE CAGE (the fuselage's stations, BL BR TL TR), the external struts, legs
  // and wires, every wheel's axle and radius, the engines' mounts, the propeller's diameter. The pieces are cut from
  // those, in the frame's own coordinates (x aft, y up, z right), then carried into the parked object's frame by the
  // map the drawn aeroplane went through (aircraftShape below).
  const AF = new Map();     // naca -> the aerofoil's hull, reduced to <= ~10 points outward (2 mm), chord units
  function hull2(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  // an edge dropped by extending its two neighbours to their meeting point, while that point stays within tol of it:
  // the polygon only grows, so the reduced section still holds the aerofoil
  function reduce2(poly, tol, kMin) {
    let P = poly.slice();
    for (;;) {
      const n = P.length; if (n <= kMin) return P;
      let best = null;
      for (let i = 0; i < n; i++) {
        const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
        const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = c[0] - d[0], s1 = c[1] - d[1], den = r0 * s1 - r1 * s0;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((d[0] - a[0]) * s1 - (d[1] - a[1]) * s0) / den, u = ((d[0] - a[0]) * r1 - (d[1] - a[1]) * r0) / den;
        if (t < 1 || u < 1) continue;
        const X = [a[0] + r0 * t, a[1] + r1 * t], ex = c[0] - b[0], ey = c[1] - b[1], el = Math.hypot(ex, ey) || 1e-12;
        const h = Math.abs((X[0] - b[0]) * ey - (X[1] - b[1]) * ex) / el;
        if (h <= tol && (!best || h < best.h)) best = { i, X, h };
      }
      if (!best) return P;
      const Q = []; for (let j = 0; j < n; j++) { if (j === best.i) Q.push(best.X); else if (j !== (best.i + 1) % n) Q.push(P[j]); }
      P = Q;
    }
  }
  function aerofoil(naca) {
    let a = AF.get(naca);
    if (!a) { a = reduce2(hull2(genAirfoil(naca)), 0.002, 8); AF.set(naca, a); }
    return a;
  }
  function aircraftPieces(fr, S, hubs) {
    const N = fr.nodes, P = fr.parts, out = [];
    const add = (tag, pts) => out.push({ tag, pts });
    const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    // THE WING, per plane and side: a section at every row the loft has (the spar stations, and past tipZ the bow's
    // rows, stepped in angle as 63_gen_wing lofts them), the spars linear between their stations; the section the
    // aerofoil's hull on the chord the planform gives there (chordAt: the bow shortens it to nothing at the tip),
    // hung on the spars as the loft hangs it (front spar at sparFront of the chord, thickness normal to it, up)
    const planes = P.planes && P.planes.length ? P.planes : [P];
    planes.forEach((PP, k) => {
      const W = S.wings[k] || S.wings[0], wf = PP.wf;
      if (!W || !wf || !wf.L || !wf.R) return;
      const af = aerofoil(W.naca), chordAt = PP.chordAt || P.chordAt, sF = PP.sparFront != null ? PP.sparFront : P.sparFront;
      const TIP = (typeof GEN_TIPS !== 'undefined' && (GEN_TIPS[W.tip] || GEN_TIPS.rounded)) || { arc: 4 };
      const sec = (pF, pR) => {
        const d = [pR[0] - pF[0], pR[1] - pF[1], pR[2] - pF[2]], L = Math.hypot(d[0], d[1], d[2]) || 1, ch = [d[0] / L, d[1] / L, d[2] / L];
        let nr = [ch[1], -ch[0], 0]; const nl = Math.hypot(nr[0], nr[1]) || 1; nr = [nr[0] / nl, nr[1] / nl, 0]; if (nr[1] < 0) nr = [-nr[0], -nr[1], 0];
        const c = Math.max(0.01, chordAt(Math.abs(pF[2])));
        return af.map(([xc, yc]) => [0, 1, 2].map(a => pF[a] + ch[a] * (xc - sF) * c + nr[a] * yc * c));
      };
      const side = (F, R) => {
        const zz = F.map(i => Math.abs(N[i].p[2]));
        let rows = zz.slice();
        if (W.tipR > 1e-6) {
          rows = rows.filter(v => v < W.tipZ - 1e-3).concat([W.tipZ]);
          const nA = Math.max(2, TIP.arc | 0), th = Math.PI / 2 * 0.965;
          for (let i = 1; i <= nA; i++) rows.push(W.tipZ + W.tipR * Math.sin(th * i / nA));
        }
        return rows.map(z => {
          let j = 0; while (j + 2 < zz.length && z > zz[j + 1]) j++;
          const j1 = Math.min(j + 1, zz.length - 1), t = j1 > j ? Math.max(0, Math.min(1, (z - zz[j]) / ((zz[j1] - zz[j]) || 1))) : 0;
          return sec(lerp3(N[F[j]].p, N[F[j1]].p, t), lerp3(N[R[j]].p, N[R[j1]].p, t));
        });
      };
      const L = side(wf.L.F, wf.L.R), R = side(wf.R.F, wf.R.R);
      for (let i = 0; i + 1 < L.length; i++) add('wing' + k, L[i].concat(L[i + 1]));
      for (let i = 0; i + 1 < R.length; i++) add('wing' + k, R[i].concat(R[i + 1]));
      if (L.length && R.length) add('wing' + k, L[0].concat(R[0]));            // the centre, root to root
    });
    // THE FUSELAGE: the cage - a frustum between each two stations, the tail post closing it; twin booms their chains
    const st = (P.F || []).map(f => [f.BL, f.BR, f.TL, f.TR].map(i => N[i].p));
    for (let i = 0; i + 1 < st.length; i++) add('fuselage', st[i].concat(st[i + 1]));
    if (st.length && P.TPB != null && P.TPT != null) {
      const b = N[P.TPB].p, t = N[P.TPT].p, w = Math.max(0.03, (S.fuse && S.fuse.tailW) || 0.04);
      add('fuselage', st[st.length - 1].concat([[b[0], b[1], -w], [b[0], b[1], w], [t[0], t[1], -w], [t[0], t[1], w]]));
    }
    if (P.BOOMS) for (const sd of ['L', 'R']) {
      const ch = P.BOOMS[sd] || [], ring = q => Object.keys(q).filter(k => typeof q[k] === 'number' && N[q[k]]).map(k => N[q[k]].p);
      for (let i = 0; i + 1 < ch.length; i++) add('boom', ring(ch[i]).concat(ring(ch[i + 1])));
    }
    // THE TAIL: the stab's and the fins' stations, leading to trailing edge along their spars (the front spar at
    // sparFront of the chord), a skin either side (2 cm + 6 % of the chord: the drawn sheet's thickness and camber)
    const TA = P.TAIL, TH = c => 0.02 + 0.06 * c;
    const surf = (pF, pR, chord, nrm, sF) => {
      const d = [pR[0] - pF[0], pR[1] - pF[1], pR[2] - pF[2]], L = Math.hypot(d[0], d[1], d[2]) || 1, u = [d[0] / L, d[1] / L, d[2] / L], th = TH(chord);
      const le = [0, 1, 2].map(a => pF[a] - u[a] * sF * chord), te = [0, 1, 2].map(a => le[a] + u[a] * chord);
      return [le, te].flatMap(p => [[p[0] + nrm[0] * th, p[1] + nrm[1] * th, p[2] + nrm[2] * th], [p[0] - nrm[0] * th, p[1] - nrm[1] * th, p[2] - nrm[2] * th]]);
    };
    if (TA) {
      const sF = TA.sparFront != null ? TA.sparFront : 0.15;
      if (TA.HF && TA.HF.L && TA.zsH) {
        const secs = {};
        for (const sd of ['L', 'R']) {
          secs[sd] = TA.HF[sd].map((f, i) => surf(N[f].p, N[TA.HR[sd][i]].p, TA.chordH(TA.zsH[i]), [0, 1, 0], sF));
          for (let i = 0; i + 1 < secs[sd].length; i++) add('stab', secs[sd][i].concat(secs[sd][i + 1]));
        }
        if (secs.L.length && secs.R.length) add('stab', secs.L[0].concat(secs.R[0]));
      }
      const fins = TA.fins || (TA.VF ? [{ VF: TA.VF, VR: TA.VR, nV: TA.nV, chordV: TA.chordV }] : []);
      for (const F of fins) {
        const nV = F.nV || (F.VF.length - 1), cv = F.chordV || TA.chordV;
        const secs = F.VF.map((f, i) => surf(N[f].p, N[F.VR[i]].p, cv(i / nV), [0, 0, 1], sF));
        for (let i = 0; i + 1 < secs.length; i++) add('fin', secs[i].concat(secs[i + 1]));
      }
    } else if (P.HTL != null && P.HTR != null && P.TPT != null && S.tail) {
      // a V: each panel from the post's top to its tip node, the tail's chord and taper
      const t = S.tail, root = N[P.TPT].p, c0 = t.hChord || 0.8, c1 = c0 * (t.hTaper == null ? 1 : t.hTaper);
      for (const H of [P.HTL, P.HTR]) {
        const tip = N[H].p, u = [tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]], ul = Math.hypot(u[0], u[1], u[2]) || 1;
        let nr = [0, u[2] / ul, -u[1] / ul]; const nl = Math.hypot(nr[1], nr[2]) || 1; nr = [0, nr[1] / nl, nr[2] / nl];
        const sec = (p, c) => { const th = TH(c); return [-0.5, 0.5].flatMap(f => [1, -1].map(s => [p[0] + f * c, p[1] + nr[1] * th * s, p[2] + nr[2] * th * s])); };
        add('stab', sec([t.hX != null ? t.hX : root[0], root[1], root[2]], c0).concat(sec(tip, c1)));
      }
    }
    // THE TRUSS OUTSIDE THE SKIN: every external member a square tube round its two nodes (a strut 5 cm, a leg 3.5,
    // a wire 6 mm)
    for (const b of fr.beams || []) {
      if (!b.ext || !N[b.a] || !N[b.b]) continue;
      const A = N[b.a].p, B = N[b.b].p, r = b.vis === 'wire' ? 0.006 : (b.cls === 'gear' ? 0.035 : 0.05);
      const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(d[0], d[1], d[2]); if (L < 1e-6) continue;
      const u = [d[0] / L, d[1] / L, d[2] / L], up = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let e1 = [u[1] * up[2] - u[2] * up[1], u[2] * up[0] - u[0] * up[2], u[0] * up[1] - u[1] * up[0]]; const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map(v => v / l1);
      const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
      const ring = p => [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, c]) => [0, 1, 2].map(q => p[q] + (e1[q] * a + e2[q] * c) * r));
      add('truss', ring(A).concat(ring(B)));
    }
    // THE WHEELS: every node with a radius, a drum of that radius across its axle (the tyre's width 0.45 r, 5 cm least)
    for (const nd of N) {
      if (!(nd.r > 0)) continue;
      const w = Math.max(0.05, 0.45 * nd.r), R = nd.r / Math.cos(Math.PI / 12), ring = [];
      for (let i = 0; i < 12; i++) { const a = 2 * Math.PI * i / 12; for (const s of [-1, 1]) ring.push([nd.p[0] + R * Math.cos(a), nd.p[1] + R * Math.sin(a), nd.p[2] + s * w]); }
      add('wheel', ring);
    }
    // THE ENGINES: each mount's nodes. On the nose (ahead of the first station, within its width) the cowl from the
    // first station to 12 cm ahead of the mount, as wide as the cylinders (the mount's half-width + 21 cm); elsewhere
    // a nacelle 30 cm round the mount, 80 cm aft of it. The propeller a slab of its diameter, blades upright as the
    // parked capture stands them, 20 cm ahead of the mount (a pusher's behind its nacelle)
    const groups = [];
    const eo = fr.refs && fr.refs.engineOf, en = fr.refs && fr.refs.engine;
    if (Array.isArray(en) && en.length) en.forEach((i, j) => { const k = (Array.isArray(eo) && eo[j] != null) ? eo[j] : 0; (groups[k] = groups[k] || []).push(i); });   // refs.engineOf: each mount node's engine
    else if (P.EL != null && P.ER != null) groups.push([P.EL, P.ER]);
    const D = (S.prop && S.prop.D) || 1.8;
    groups.forEach((g, k) => {
      const ps = g.map(i => N[i] && N[i].p).filter(Boolean); if (!ps.length) return;
      let x0 = Infinity, x1 = -Infinity, y = 0, z = 0, zw = 0;
      for (const p of ps) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y += p[1] / ps.length; z += p[2] / ps.length; }
      for (const p of ps) zw = Math.max(zw, Math.abs(p[2] - z));
      const e = S.engines && S.engines[k], push = !!(e && /push|aft|rear/.test(String(e.mount || '')));
      const s0 = st[0], onNose = s0 && x0 < s0[0][0] && Math.abs(z) < 0.2;
      if (onNose && !push) {
        const yb = Math.min(s0[0][1], s0[1][1]), yt = Math.max(s0[2][1], s0[3][1]), cw = Math.max(Math.abs(s0[0][2]), zw + 0.21), xf = x0 - 0.12;
        add('engine', s0.concat([[xf, yb + 0.1, z - cw], [xf, yb + 0.1, z + cw], [xf, yt, z - cw], [xf, yt, z + cw]]));
      } else {
        const r = 0.3, xa = push ? x0 - 0.8 : x0 - 0.12, xb = push ? x1 + 0.12 : x1 + 0.8, pts = [];
        for (const x of [xa, xb]) for (const dy of [-r, r]) for (const dz of [-r, r]) pts.push([x, y + dy, z + dz]);
        add('engine', pts);
      }
      if (hubs) return;                            // the capture's own hubs stand the blades (aircraftShape)
      const xp = push ? x1 + 0.2 : x0 - 0.2, pts = [];
      for (const x of [xp - 0.08, xp + 0.08]) for (const dy of [-D / 2, D / 2]) for (const dz of [-0.1, 0.1]) pts.push([x, y + dy, z + dz]);
      add('prop', pts);
    });
    return out;
  }
  // THE MAP INTO THE PARKED OBJECT'S FRAME. The drawn aeroplane (CAGE_JOIN.snapshot) is in the model frame through
  // the flight pose's INVERSE: xy' = B^-1 xy + T, with B the pose's basis off the frame's own nodes (the body axis
  // noseFrame -> tailMid, the up pair upLo -> upHi: G337's oblique pair - on the Cub a 3.4 deg shear), z' = -z. T is
  // what lands the frame's mains on the drawn ones (the calibration's own contract), read off the capture:
  // drawn.mains = the mean of its mainsL / mainsR pivots. Then the parked stance (drawn.stance: pitch about z, the
  // lift) and the turn nose to +x (x, z negated) - parked.js hitboxOf's own chain. Returns the shape, or null (no
  // spec door, no mains: the caller keeps the mesh raster).
  function aircraftShape(spec, drawn) {
    if (!spec || !drawn || !drawn.mains || !drawn.stance || typeof resolveSpec !== 'function' || typeof genFrame !== 'function') return null;
    const RS = resolveSpec(JSON.parse(JSON.stringify(spec))), S = RS.spec || RS, fr = genFrame(S);
    const refs = fr.refs || {};
    if (!refs.mains || refs.mains.length < 2) return null;
    const mean = ids => { const a = Array.isArray(ids) ? ids : [ids]; let x = 0, y = 0; for (const i of a) { x += fr.nodes[i].p[0]; y += fr.nodes[i].p[1]; } return [x / a.length, y / a.length]; };
    const nF = mean(refs.noseFrame), tM = mean(refs.tailMid), uH = mean(refs.upHi), uL = mean(refs.upLo);
    const ax = [tM[0] - nF[0], tM[1] - nF[1]], la = Math.hypot(ax[0], ax[1]) || 1e-9, uy = [uH[0] - uL[0], uH[1] - uL[1]], lu = Math.hypot(uy[0], uy[1]) || 1e-9;
    const xA = [ax[0] / la, ax[1] / la], yU = [uy[0] / lu, uy[1] / lu], det = xA[0] * yU[1] - yU[0] * xA[1];
    const BK = Math.abs(det) > 0.2 ? [yU[1] / det, -yU[0] / det, -xA[1] / det, xA[0] / det] : [1, 0, 0, 1];
    const lin = (x, y) => [BK[0] * x + BK[1] * y, BK[2] * x + BK[3] * y];
    const m = mean(refs.mains), lm = lin(m[0], m[1]), T = [drawn.mains[0] - lm[0], drawn.mains[1] - lm[1]];
    const c = Math.cos(drawn.stance.pitch), s = Math.sin(drawn.stance.pitch), lift = drawn.stance.lift || 0;
    const map = p => { const l = lin(p[0], p[1]), vx = l[0] + T[0], vy = l[1] + T[1]; return [-(vx * c - vy * s), vx * s + vy * c + lift, p[2]]; };
    const list = aircraftPieces(fr, S, !!(drawn.props && drawn.props.length)).map(q => ({ tag: q.tag, pts: q.pts.map(map) }));
    // THE BLADES where the capture hung them (its prop parts' hubs, in the model frame, x aft: the stance and the turn
    // only), upright in that frame as the parked capture stands them, the spec's diameter, the blade root's chord (12 cm
    // either side) and its pitch (20 cm fore and aft of the disc); the spinner ahead of the hub (its radius spinner.dia of the prop's, its length
    // spinner.len of its own radius)
    const D = (S.prop && S.prop.D) || 1.8, sp = S.prop && S.prop.spinner, rs = (sp && sp.shape !== 'none') ? 1.05 * (sp.dia || 0.17) * D / 2 : 0;
    const mdl = (x, y, z) => [-(x * c - y * s), x * s + y * c + lift, -z];
    for (const h of drawn.props || []) {
      const pts = [];
      for (const dx of [-0.2, 0.2]) for (const dy of [-D / 2, D / 2]) for (const dz of [-0.12, 0.12]) pts.push(mdl(h[0] + dx, h[1] + dy, (h[2] || 0) + dz));
      list.push({ tag: 'prop', pts });
      if (rs > 0) { const q = []; for (const dx of [0.25, -(sp.len || 2.2) * rs / 1.05]) for (const dy of [-rs, rs]) for (const dz of [-rs, rs]) q.push(mdl(h[0] + dx, h[1] + dy, (h[2] || 0) + dz)); list.push({ tag: 'prop', pts: q }); }
    }
    const shape = pieces(list);
    if (shape) shape.aircraft = true;
    return shape;
  }

  // what aircraftShape needs of a parked capture (parked.js's record, its LOD's stance): the drawn mains' mean and
  // the propellers' hubs, both off the capture's own parts (model frame)
  function parkedDrawn(vis, stance) {
    if (!vis || !vis.parts || !stance) return null;
    const m = vis.parts.filter(p => p.kind === 'mainsL' || p.kind === 'mainsR');
    if (!m.length) return null;
    return { mains: [m.reduce((a, p) => a + p.pivot[0], 0) / m.length, m.reduce((a, p) => a + p.pivot[1], 0) / m.length],
             props: vis.parts.filter(p => p.kind === 'prop').map(p => p.pivot), stance };
  }

  // ---- a point against a placed shape --------------------------------------------------------
  // rec: { x, z, yaw, y0, c, s, shape }. out: [dx, dy, dz] world displacement to be out of it, or null.
  const MARGIN = 0.05;
  function penetration(rec, px, py, pz, out) {
    const S = rec.shape;
    const dx = px - rec.x, dz = pz - rec.z;
    if (dx * dx + dz * dz > S.xr * S.xr) return null;
    const lx = dx * rec.c - dz * rec.s, lz = dx * rec.s + dz * rec.c;
    if (S.pieces) {
      if (py - rec.y0 > S.top) return null;
      const q = penPieces(S, lx, py - rec.y0, lz); if (!q) return null;
      const o = out || [0, 0, 0], e = q[3] + MARGIN;
      o[0] = (q[0] * rec.c + q[2] * rec.s) * e; o[1] = q[1] * e; o[2] = (-q[0] * rec.s + q[2] * rec.c) * e;
      return o;
    }
    const i = Math.floor((lx - S.ox) / S.cell), j = Math.floor((lz - S.oz) / S.cell);
    if (i < 0 || j < 0 || i >= S.nx || j >= S.nz) return null;
    const k = j * S.nx + i;
    if (S.hi[k] < S.lo[k]) return null;
    const y = py - rec.y0;
    if (y > S.hi[k] || y < S.lo[k]) return null;
    // up (or down, from under a deck), and sideways along the distance field's gradient
    const up = S.hi[k] - y + MARGIN, down = y - S.lo[k] + MARGIN;
    const iL = Math.max(0, i - 1), iR = Math.min(S.nx - 1, i + 1), jL = Math.max(0, j - 1), jR = Math.min(S.nz - 1, j + 1);
    let gx = (S.d[j * S.nx + iR] - S.d[j * S.nx + iL]) / ((iR - iL) * S.cell), gz = (S.d[jR * S.nx + i] - S.d[jL * S.nx + i]) / ((jR - jL) * S.cell);
    const gl = Math.hypot(gx, gz);
    if (gl < 1e-6) { gx = lx - (S.ox + S.nx * S.cell / 2); gz = lz - (S.oz + S.nz * S.cell / 2); const g2 = Math.hypot(gx, gz) || 1; gx /= g2; gz /= g2; } else { gx /= gl; gz /= gl; }
    const side = -S.d[k] + S.cell * 0.5 + MARGIN;
    const o = out || [0, 0, 0];
    // down only from under something that stands clear of the ground (a deck on posts, a wing): a
    // box on the ground never pushes a node into the ground
    if (S.lo[k] > 0.25 && down < up && down < side) { o[0] = 0; o[1] = -down; o[2] = 0; return o; }
    if (up <= side) { o[0] = 0; o[1] = up; o[2] = 0; return o; }
    // local (gx, gz) -> world through the yaw (world = R(yaw) local: wx = lx c + lz s, wz = -lx s + lz c)
    o[0] = (gx * rec.c + gz * rec.s) * side; o[1] = 0; o[2] = (-gx * rec.s + gz * rec.c) * side;
    return o;
  }

  // ---- the registry ---------------------------------------------------------------------------
  function make() {
    const recs = new Map();
    const bins = new Map();
    let nextId = 1, maxTop = -Infinity;
    const key = (bx, bz) => bx + ',' + bz;
    const binsOf = r => {
      const R = r.shape.xr, out = [];
      for (let bx = Math.floor((r.x - R) / BIN); bx <= Math.floor((r.x + R) / BIN); bx++)
        for (let bz = Math.floor((r.z - R) / BIN); bz <= Math.floor((r.z + R) / BIN); bz++) out.push(key(bx, bz));
      return out;
    };
    const link = r => { r.bins = binsOf(r); for (const k of r.bins) { let b = bins.get(k); if (!b) bins.set(k, b = []); b.push(r.id); } };
    const unlink = r => { for (const k of r.bins || []) { const b = bins.get(k); if (!b) continue; const i = b.indexOf(r.id); if (i >= 0) b.splice(i, 1); if (!b.length) bins.delete(k); } r.bins = null; };
    const retop = () => { maxTop = -Infinity; for (const [, r] of recs) { const t = r.y0 + r.shape.top; if (t > maxTop) maxTop = t; } };
    const api = {
      add(o) {
        if (!o || !o.shape) return 0;
        const r = { id: nextId++, x: +o.x || 0, z: +o.z || 0, yaw: +o.yaw || 0, y0: +o.y0 || 0, c: 0, s: 0, shape: o.shape, tag: o.tag || '', bins: null };
        r.c = Math.cos(r.yaw); r.s = Math.sin(r.yaw);
        recs.set(r.id, r); link(r);
        const t = r.y0 + r.shape.top; if (t > maxTop) maxTop = t;
        return r.id;
      },
      remove(id) { const r = recs.get(id); if (!r) return false; unlink(r); recs.delete(id); retop(); return true; },
      move(id, x, z, yaw, y0) {
        const r = recs.get(id); if (!r) return false;
        r.x = x; r.z = z; if (yaw !== undefined) { r.yaw = yaw; r.c = Math.cos(yaw); r.s = Math.sin(yaw); }
        if (y0 !== undefined) { r.y0 = y0; const t = y0 + r.shape.top; if (t > maxTop) maxTop = t; }
        const nb = binsOf(r);
        if (!r.bins || nb.length !== r.bins.length || nb.some((k, i) => k !== r.bins[i])) { unlink(r); link(r); }
        return true;
      },
      get: id => recs.get(id) || null,
      near(x, z, out) {
        out.length = 0;
        const bx = Math.floor(x / BIN), bz = Math.floor(z / BIN);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const cell = bins.get(key(bx + a, bz + b));
          if (cell) for (const id of cell) if (out.indexOf(id) < 0) out.push(id);
        }
        return out;
      },
      get count() { return recs.size; },
      get maxTop() { return maxTop; },
      list: () => Array.from(recs.values()),
      clear() { recs.clear(); bins.clear(); maxTop = -Infinity; },
    };
    return api;
  }
  // ---- A SHAPE AS POINTS (G1999, TOWN-CHEAP): a column grid's occupied columns as a k x k lattice of points over the
  // column's square (k = 3: its corners, its edges' midpoints, its centre), at the column's low, at its high and every `dy`
  // between them (0.5 m: a column TILTED with its placement - a pole on a slope - leans, and its mid-height reaches cells its
  // foot and its top do not) - k^2 points a level, x y z flat. Rasterised again (as degenerate triangles, rasterise above) in another frame - turned,
  // tilted, scaled - and at a coarser cell, they mark the cells the column's square reaches, between its low and its high:
  // every point of the square lies within half a lattice step's diagonal (0.088 m at a 0.25 m column, k 3) of a marked
  // point, so a vertex of the mesh the grid was made from is in an occupied cell, or within that of one (GATE PROPHIT).
  // The page rasterises a prop key's full level ONCE at a fine cell and stands its points per placement (render_premises.js
  // shapeOf): the retro town step on a 4x-throttled CPU was 82 % the raster of the props' full meshes, every placement again.
  // eps keeps a corner inside its own column (one on a lattice line would read as the neighbour's)
  function columnPoints(shape, eps, k, dy) {
    if (!shape) return null;
    const c = shape.cell, e = eps === undefined ? c * 1e-3 : eps, K = Math.max(2, k | 0 || 3), DY = dy > 0 ? dy : 0.5;
    let levels = 0;
    for (let q = 0; q < shape.nx * shape.nz; q++) if (shape.hi[q] >= shape.lo[q]) levels += 1 + Math.max(1, Math.ceil((shape.hi[q] - shape.lo[q]) / DY));
    const out = new Float32Array(levels * 3 * K * K), st = (c - 2 * e) / (K - 1);
    let o = 0;
    for (let j = 0; j < shape.nz; j++) for (let i = 0; i < shape.nx; i++) {
      const kk = j * shape.nx + i, lo = shape.lo[kk], hi = shape.hi[kk];
      if (!(hi >= lo)) continue;
      const x0 = shape.ox + i * c + e, z0 = shape.oz + j * c + e, nL = Math.max(1, Math.ceil((hi - lo) / DY));
      for (let L = 0; L <= nL; L++) { const y = L === nL ? hi : lo + (hi - lo) * L / nL;
        for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) { out[o++] = x0 + a * st; out[o++] = y; out[o++] = z0 + b * st; } }
    }
    return o === out.length ? out : out.subarray(0, o);
  }
  return { rasterise, box, penetration, make, BIN, MARGIN, hull, pieces, sdist, aircraftPieces, aircraftShape, parkedDrawn, columnPoints };
})();

// ---- TREE_HITS (G1330, TREE-HITBOX) - THE TREES YOU SEE ARE THE TREES YOU HIT ---------------------------------------
// The user (2026-10-03): "trees have no hitbox, only some of them. We should at least be able to hit the trunks." Until
// now the solver met the WOODLAND only (20_world.js trees: one candidate per 64 m cell, 0.8 % of the trees drawn); the
// forest fill (render_world.js walk - every drawn stand on the island), the woodland's clump neighbours, the hand-placed
// trees (TREE_PLACE: the aerodrome's windbreak) and the premises' zone trees (27_premises.js records.trees) were
// pictures. The fill's placement reads the viewer's own data (the island's colour boot - NDVI, the biome mixes, the tree
// pack's pools, the 'forest density' setting), so the core cannot re-derive it: the VIEWER registers what it draws.
//
// A SET is one source's trunks (a fill chunk part, the woodland, the premises), keyed, stride 5: x, z, y0 (the trunk's
// foot, world y), r (its radius, m), y1 (its top, world y) - a Float32Array. Each set is binned ONCE, at set(), into a
// CSR grid of CELL m cells (coarser for a set spread wide) (a trunk in every cell its circle touches), so a point asks its own cell of each set whose box
// holds it: no candidate list, no allocation per step. The page's world and the sim worker's hold the same sets
// (sim_link.js forwards set / drop / clear as the `trees` world op, stamped like the obstacles').
// trunkOf(H, wFrac): the trunk of a drawn tree H m tall whose crown's half width is wFrac x H (the species' own bb):
// a narrow conifer's trunk runs up to ~0.8 H, a broad crown's splits at ~0.5 H. Radius 2 % of H, held to 0.3..0.6 m (a
// game's hitbox, a little fatter than the bark). The solver tests it against the BEAMS (30_solver.js trunkFrame).
const TREE_HITS = (() => {
  'use strict';
  const CELL = 8, STRIDE = 5, MAXC = 1 << 18;
  function trunkOf(H, wFrac, out) {
    const o = out || [0, 0];
    o[0] = Math.max(0.3, Math.min(0.6, 0.02 * H));
    o[1] = Math.max(0.5, Math.min(0.8, 0.95 - (wFrac > 0 ? wFrac : 0.3))) * H;
    return o;
  }
  function bin(arr) {
    const n = (arr.length / STRIDE) | 0;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, top = -Infinity;
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE, r = arr[o + 3];
      if (arr[o] - r < x0) x0 = arr[o] - r; if (arr[o] + r > x1) x1 = arr[o] + r;
      if (arr[o + 1] - r < z0) z0 = arr[o + 1] - r; if (arr[o + 1] + r > z1) z1 = arr[o + 1] + r;
      if (arr[o + 4] > top) top = arr[o + 4];
    }
    if (!n) return { arr, n: 0, x0: 0, z0: 0, x1: -1, z1: -1, top: -Infinity, cell: CELL, cx0: 0, cz0: 0, nx: 0, nz: 0, start: new Int32Array(1), idx: new Int32Array(0) };
    // the cell: CELL m, doubled until the set's box is at most MAXC cells (a fill chunk part is 128 x 128 of 8 m; the
    // woodland's whole island one set of ~32-64 m cells, a few trees each - not 36 MB of empty 8 m cells)
    let cell = CELL; while (((x1 - x0) / cell + 2) * ((z1 - z0) / cell + 2) > MAXC) cell *= 2;
    const cx0 = Math.floor(x0 / cell), cz0 = Math.floor(z0 / cell);
    const nx = Math.floor(x1 / cell) - cx0 + 1, nz = Math.floor(z1 / cell) - cz0 + 1;
    const start = new Int32Array(nx * nz + 1);
    const each = (i, f) => { const o = i * STRIDE, r = arr[o + 3];
      const a0 = Math.floor((arr[o] - r) / cell) - cx0, a1 = Math.floor((arr[o] + r) / cell) - cx0;
      const b0 = Math.floor((arr[o + 1] - r) / cell) - cz0, b1 = Math.floor((arr[o + 1] + r) / cell) - cz0;
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) f(b * nx + a); };
    for (let i = 0; i < n; i++) each(i, c => { start[c + 1]++; });
    for (let c = 0; c < nx * nz; c++) start[c + 1] += start[c];
    const idx = new Int32Array(start[nx * nz]), at = start.slice(0, nx * nz);
    for (let i = 0; i < n; i++) each(i, c => { idx[at[c]++] = i; });
    return { arr, n, x0, z0, x1, z1, top, cell, cx0, cz0, nx, nz, start, idx };
  }
  function make() {
    const sets = new Map();
    const list = [];          // the live sets, for the solver's walk (rebuilt on set / drop, never per step)
    let count = 0, top = -Infinity, ver = 0;
    const relist = () => { list.length = 0; count = 0; top = -Infinity;
      for (const S of sets.values()) if (S.n) { list.push(S); count += S.n; if (S.top > top) top = S.top; } ver++; };
    const api = {
      CELL, STRIDE, trunkOf,
      // one source's trunks, replacing what that key held (arr: Float32Array or plain numbers, stride 5)
      set(key, arr) { const a = arr instanceof Float32Array ? arr : Float32Array.from(arr || []); const S = bin(a); S.key = key; sets.set(key, S); relist(); return S.n; },
      drop(key) { if (!sets.delete(key)) return false; relist(); return true; },
      clear() { if (!sets.size) return; sets.clear(); relist(); },
      has: key => sets.has(key),
      keys: () => Array.from(sets.keys()),
      get(key) { const S = sets.get(key); return S ? S.arr : null; },
      get count() { return count; }, get top() { return top; }, get ver() { return ver; }, get sets() { return list.length; },
      // every trunk whose cylinder holds the point: fn(dx, dz, d2, r) per hit (dx, dz from its axis); returns the hits.
      // The solver's own walk is inline (30_solver.js) - this one is for the gates and the probes
      at(px, py, pz, fn) {
        let k = 0;
        for (let s = 0; s < list.length; s++) {
          const S = list[s];
          if (py > S.top || px < S.x0 || px > S.x1 || pz < S.z0 || pz > S.z1) continue;
          const c = (Math.floor(pz / S.cell) - S.cz0) * S.nx + (Math.floor(px / S.cell) - S.cx0), A = S.arr;
          for (let j = S.start[c], j1 = S.start[c + 1]; j < j1; j++) {
            const o = S.idx[j] * STRIDE, dx = px - A[o], dz = pz - A[o + 1], r = A[o + 3], d2 = dx * dx + dz * dz;
            if (d2 > r * r || py > A[o + 4] || py < A[o + 2] - 1) continue;
            k++; if (fn) fn(dx, dz, d2, r);
          }
        }
        return k;
      },
      list,
    };
    return api;
  }
  return { make, trunkOf, CELL, STRIDE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { OBSTACLES, TREE_HITS };
