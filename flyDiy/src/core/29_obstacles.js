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
  function rasterise(pos, idx, cell, opts) {
    const nTri = idx ? idx.length / 3 : pos.length / 9;
    if (!nTri) return null;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const nv = pos.length / 3;
    for (let i = 0; i < nv; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (!isFinite(x0)) return null;
    const pad = (opts && opts.pad !== undefined) ? opts.pad : 1;
    const ox = Math.floor(x0 / cell) * cell - pad * cell, oz = Math.floor(z0 / cell) * cell - pad * cell;
    const nx = Math.ceil((x1 - ox) / cell) + pad + 1, nz = Math.ceil((z1 - oz) / cell) + pad + 1;
    const lo = new Float32Array(nx * nz).fill(Infinity), hi = new Float32Array(nx * nz).fill(-Infinity);
    const mark = (x, y, z) => {
      const i = Math.floor((x - ox) / cell), j = Math.floor((z - oz) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return;
      const k = j * nx + i;
      if (y < lo[k]) lo[k] = y;
      if (y > hi[k]) hi[k] = y;
    };
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

  // ---- a point against a placed shape --------------------------------------------------------
  // rec: { x, z, yaw, y0, c, s, shape }. out: [dx, dy, dz] world displacement to be out of it, or null.
  const MARGIN = 0.05;
  function penetration(rec, px, py, pz, out) {
    const S = rec.shape;
    const dx = px - rec.x, dz = pz - rec.z;
    if (dx * dx + dz * dz > S.xr * S.xr) return null;
    const lx = dx * rec.c - dz * rec.s, lz = dx * rec.s + dz * rec.c;
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
  return { rasterise, box, penetration, make, BIN, MARGIN };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { OBSTACLES };
