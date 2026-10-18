// ============================================================
// GROUND TIER (G2115, TERRAIN-MATCH) - THE 1 m GROUND UNDER THE AEROPLANE.
//
// The wheels, the wreck's nodes and its debris stand on world.terrainH (the premises raster). The eye sees a lattice of
// it: the premises' patch every 2 m, the fine tiles every 5 m (render_world.js FINE), straight between. Where the ground
// curves the chord stands off it - the patch's open grass p95 13 mm, 6-12 cm on the over-runs' rough ground and at a
// cut's bank; the fine tiles 15 cm (tools/ground_lattice.js, G1380; tools/terrain_match.js). G1380's option (b): round the
// aeroplane the ground is drawn at 1 m from terrainH itself - 2.4-2.8 mm at p95 on Jolene's land, the solver's own surface.
//
// HOW IT SITS IN THE LAYER IT REPLACES (the patch, or the fine tiles off the premises):
//   - the tier is a square of quads (S.patch: 0.5 m, 16 m each way - the feathers' banks beside a cut road curve inside a
//     metre; S.fine: 1 m, 24 m each way) round a centre snapped to S.snap (even: every patch vertex and every fine vertex is
//     a tier vertex), its triangles split as both layers split theirs ((i, j + 1) - (i + 1, j)), so within
//     2 cells of its edge it is the layer's own surface REFINED - the same planes to the float (`layer`), drawn over it
//     with a polygon offset - and inside that the contact law (`law`: terrainH, and under a pavement the patch's own
//     sink), blended over S.ramp. Its edge meets the layer exactly: no crack, no step, nothing seen to change at it;
//   - the layer's own vertices more than a cell inside the square are pushed S.drop under (the ground hook's uTier, a
//     vertex test - no discard, early-Z kept): every triangle they belong to lies within 2 cells of them, inside the
//     square, under the tier's layer-coplanar band or its core;
//   - one draw, 8 192 triangles on the patch (4 608 on the fine tiles) - paid out of the patch's skirts between the chunks
//     of one block (render_premises.js, G2115: ~70 k fewer on potato's budget at HOME's stand), so no budget's count grows.
// ON when the aeroplane is near the ground (S.agl), slow (S.vmax: the take-off roll's tyres are a blur) and the eye is
// near it (S.eye: within it the patch's block under the tier is at its 2 m level, the one this tier refines); the square
// is rebuilt in slices of S.budgetMs when the aeroplane leaves its centre's cell, the old one drawn until the new one is
// whole and the two swapped with the layer's uniform in one frame.
//
//   GROUND_TIER.S                       the dials (S.patch / S.fine: the square's half and its step on each layer)
//   GROUND_TIER.centreOf(x, z)          the snapped centre
//   GROUND_TIER.weight(t, cell)         the contact law's share at t metres inside the square's edge
//   GROUND_TIER.sinkU(cx, cz, half, cell)  the layer's uniform (x, z, half - cell, drop); (0, 0, 0, 0) is off
//   GROUND_TIER.lattice(cell, f)        f at a layer's vertices, linear on its triangles (memoised): the layer's surface
//   GROUND_TIER.build(THREE, spec)      a generator (yields as it goes) -> { geometry, y0 }; spec { cx, cz, half, step, cell,
//                                       layer(x, z), base(x, z), sink(x, z), nR, uv(x, z), coarse }: the layer's surface;
//                                       the law = base - sink, its normal from base's differences at +-nR (the layer's own
//                                       normal law: the patch's 2 m, the fine tiles' 2.5 m) - the layer's normal is the same
//                                       law at its vertices, linear between; the uv law; the fine tiles' aCoarse / aCoarseN
// Loads in node (module.exports) for tools/terrain_match.js and GATE TERRAINMATCH.
// ============================================================
(function () {
  const S = { on: true, patch: { half: 16, step: 0.5 }, fine: { half: 24, step: 1 }, ramp: 4, drop: 3, eye: 75, agl: 30, vmax: 15, snap: 4, budgetMs: 2 };
  const ss01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const centreOf = (x, z) => [Math.round(x / S.snap) * S.snap, Math.round(z / S.snap) * S.snap];
  // 0 within 2 cells of the edge (the layer's triangles there, its dragged ones included), 1 past S.ramp more
  const weight = (t, cell) => ss01(2 * cell, 2 * cell + S.ramp, t);
  const sinkU = (cx, cz, half, cell) => [cx, cz, half - cell, S.drop];
  // the layer's surface: f at its vertices (a world grid of `cell`), linear on the triangles (i, j)(i, j + 1)(i + 1, j) and
  // (i, j + 1)(i + 1, j + 1)(i + 1, j) - the patch's (a, cc, b2), (b2, cc, dd) and the fine tiles' (a, b, d), (b, c, d)
  const tri = (at, x, z, cell, mix) => {
    const u = x / cell, v = z / cell, i = Math.floor(u + 1e-9), j = Math.floor(v + 1e-9), fu = u - i, fv = v - j;
    if (fu + fv <= 1) return mix(at(i, j), at(i + 1, j), at(i, j + 1), 1 - fu - fv, fu, fv);
    return mix(at(i + 1, j + 1), at(i + 1, j), at(i, j + 1), fu + fv - 1, 1 - fv, 1 - fu);
  };
  const mix1 = (a, b, c, wa, wb, wc) => a * wa + b * wb + c * wc;
  const mix3 = (a, b, c, wa, wb, wc) => [a[0] * wa + b[0] * wb + c[0] * wc, a[1] * wa + b[1] * wb + c[1] * wc, a[2] * wa + b[2] * wb + c[2] * wc];
  function lattice(cell, f) {
    const M = new Map(), at = (i, j) => { const k = i * 1048576 + j; let v = M.get(k); if (v === undefined) { v = f(i * cell, j * cell); M.set(k, v); } return v; };
    return (x, z) => tri(at, x, z, cell, typeof f(0, 0) === 'number' ? mix1 : mix3);
  }
  function* build(THREE, spec) {
    const st = spec.step, half = spec.half, n = Math.round(2 * half / st), N = n + 1, x0 = spec.cx - half, z0 = spec.cz - half;
    // THE BASE ON A GRID with a border for its differences (nR a whole number of steps: the patch's 2 m at 0.5 m) - or at
    // +-nR off the grid (the fine tiles' 2.5 m at 1 m)
    const kb = Math.round(spec.nR / st), onGrid = Math.abs(kb * st - spec.nR) < 1e-9, B = onGrid ? kb : 0, NB = N + 2 * B;
    const base = new Float64Array(NB * NB);
    for (let j = 0; j < NB; j++) { for (let i = 0; i < NB; i++) base[j * NB + i] = spec.base(x0 + (i - B) * st, z0 + (j - B) * st); if ((j & 7) === 7) yield 'tier base'; }
    const bAt = (i, j) => base[(j + B) * NB + i + B];
    const nrmAt = (i, j) => {
      let gx, gz;
      if (onGrid) { gx = (bAt(i + kb, j) - bAt(i - kb, j)) / (2 * spec.nR); gz = (bAt(i, j + kb) - bAt(i, j - kb)) / (2 * spec.nR); }
      else { const x = x0 + i * st, z = z0 + j * st, R = spec.nR; gx = (spec.base(x + R, z) - spec.base(x - R, z)) / (2 * R); gz = (spec.base(x, z + R) - spec.base(x, z - R)) / (2 * R); }
      const l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, -gz / l];
    };
    // the layer's normal: the law's at its vertices (tier grid points: cell is a whole number of steps), linear between
    const kc = Math.round(spec.cell / st), NM = new Map();
    const layerNat = (I, J) => { const k = I * 1048576 + J; let v = NM.get(k); if (v === undefined) { v = nrmAt(Math.round((I * spec.cell - x0) / st), Math.round((J * spec.cell - z0) / st)); NM.set(k, v); } return v; };
    const pos = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
    const ac = spec.coarse ? new Float32Array(N * N) : null, acn = spec.coarse ? new Float32Array(N * N * 3) : null;
    const Y = new Float64Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i, x = x0 + i * st, z = z0 + j * st;
        const t = half - Math.max(Math.abs(x - spec.cx), Math.abs(z - spec.cz)), w = weight(t, spec.cell);
        const yl = w < 1 ? spec.layer(x, z) : 0, yc = w > 0 ? bAt(i, j) - spec.sink(x, z) : 0, y = w <= 0 ? yl : w >= 1 ? yc : yl + w * (yc - yl);
        const nl = w < 1 ? tri(layerNat, x, z, spec.cell, mix3) : null, nw = w > 0 ? nrmAt(i, j) : null;
        let nx = nl ? nl[0] * (1 - w) : 0, ny = nl ? nl[1] * (1 - w) : 0, nz = nl ? nl[2] * (1 - w) : 0;
        if (nw) { nx += nw[0] * w; ny += nw[1] * w; nz += nw[2] * w; }
        const l = Math.hypot(nx, ny, nz) || 1;
        Y[k] = y; nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
        const q = spec.uv(x, z); uv[k * 2] = q[0]; uv[k * 2 + 1] = q[1];
      }
      if ((j & 3) === 3) yield 'tier rows';
    }
    // the positions about the centre (the patch's blocks are about theirs: Float32 to a tenth of a millimetre either way)
    let lo = Infinity, hi = -Infinity; for (let k = 0; k < N * N; k++) { lo = Math.min(lo, Y[k]); hi = Math.max(hi, Y[k]); }
    const y0 = (lo + hi) / 2;
    for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++, k++) {
      pos[k * 3] = i * st - half; pos[k * 3 + 1] = Y[k] - y0; pos[k * 3 + 2] = j * st - half;
      if (ac) { ac[k] = Y[k] - y0; acn[k * 3] = nor[k * 3]; acn[k * 3 + 1] = nor[k * 3 + 1]; acn[k * 3 + 2] = nor[k * 3 + 2]; }   // (no geomorph: the tier is the disc's middle)
    }
    const idx = new Uint16Array(n * n * 6);
    for (let j = 0, q = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * N + i, b = a + N, c = b + 1, d = a + 1; idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (ac) { g.setAttribute('aCoarse', new THREE.BufferAttribute(ac, 1)); g.setAttribute('aCoarseN', new THREE.BufferAttribute(acn, 3)); }
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    return { geometry: g, y0, Y, N };
  }
  const api = { S, centreOf, weight, sinkU, lattice, build };
  if (typeof window !== 'undefined') window.GROUND_TIER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
