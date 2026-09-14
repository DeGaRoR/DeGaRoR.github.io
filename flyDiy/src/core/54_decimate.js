// ===========================================================================
// THE DECIMATOR (G411) — quadric-error half-edge collapse on the wedge graph.
// ===========================================================================
// MOVED HERE VERBATIM from tools/prop_lod.js (G301/G303), which now calls it,
// so the one decimator serves the baker (node, the pier packs) AND the game
// (src/viewer/parked.js cuts a parked aeroplane's far levels at run time, in a
// Worker built from this function's own source — which is why it is ONE
// self-contained function: no module constants, no helpers outside it. The
// three knobs prop_lod.js kept at module scope ride in `opt`, with the same
// defaults).
//
//   meshDecimate(M, bb, target, opt) -> { idx, alive, nt, nBorder, nSeam, refused, refSeam }
//     M      { nv, nt, pos: Int16Array (quantised over bb), nrm: Int8Array,
//              idx: Uint32Array } — a wedge mesh: positions weld on the int16
//              triple, attributes stay per wedge. M.pos is WRITTEN (a wedge
//              with no twin moves to its target's position): pass a copy if
//              the input must survive.
//     bb     [x0, y0, z0, x1, y1, z1] metres, the quantisation box
//     target the triangle count to stop at
//     opt    { W_BORDER (10), W_SEAM (1), FLIP_COS (0.2) }
//
// WHY HALF-EDGE, WHY THE SEAM RULE: prop_lod.js's header says it (a surviving
// vertex keeps its position, normal and uv exactly; a seam vertex collapses
// along its seam or not at all; a wedge with no twin MOVES).
function meshDecimate(M, bb, target, opt) {
  const W_BORDER = (opt && opt.W_BORDER != null) ? opt.W_BORDER : 10;
  const W_SEAM = (opt && opt.W_SEAM != null) ? opt.W_SEAM : 1;
  const FLIP_COS = (opt && opt.FLIP_COS != null) ? opt.FLIP_COS : 0.2;
  const W = M.nv, T = M.nt, idx = M.idx;
  if (T <= target) return { idx: Array.from(idx), alive: null, nt: T };
  // metres, for the quadrics
  const [x0, y0, z0, x1, y1, z1] = bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  const X = new Float64Array(W * 3);
  for (let i = 0; i < W; i++) {
    X[i * 3] = x0 + (M.pos[i * 3] + 32768) * sx;
    X[i * 3 + 1] = y0 + (M.pos[i * 3 + 1] + 32768) * sy;
    X[i * 3 + 2] = z0 + (M.pos[i * 3 + 2] + 32768) * sz;
  }
  // wedges -> positions (welded on the int16 triple)
  const wPos = new Int32Array(W);
  const pmap = new Map();
  let P = 0;
  for (let i = 0; i < W; i++) {
    const k = (M.pos[i * 3] + 32768) * 4294967296 + (M.pos[i * 3 + 1] + 32768) * 65536 + (M.pos[i * 3 + 2] + 32768);
    let p = pmap.get(k);
    if (p === undefined) { p = P++; pmap.set(k, p); }
    wPos[i] = p;
  }
  const pWedges = new Array(P);
  const pX = new Float64Array(P * 3);
  for (let i = 0; i < W; i++) { const p = wPos[i]; pX[p * 3] = X[i * 3]; pX[p * 3 + 1] = X[i * 3 + 1]; pX[p * 3 + 2] = X[i * 3 + 2]; }

  // triangles, and every wedge's triangles
  const tri = new Int32Array(idx);
  const tAlive = new Uint8Array(T).fill(1);
  const wTris = new Array(W);
  for (let i = 0; i < W; i++) wTris[i] = [];
  for (let t = 0; t < T; t++) { wTris[tri[t * 3]].push(t); wTris[tri[t * 3 + 1]].push(t); wTris[tri[t * 3 + 2]].push(t); }
  // a wedge no triangle uses (a level cut from a level leaves them) is not
  // part of the surface: not alive, not a wedge of its position
  const wAlive = new Uint8Array(W);
  for (let i = 0; i < W; i++) if (wTris[i].length) {
    wAlive[i] = 1;
    (pWedges[wPos[i]] || (pWedges[wPos[i]] = [])).push(i);
  }

  // quadrics per position: area-weighted face planes
  const Q = new Float64Array(P * 10);
  const addPlane = (p, a, b, c, d, w) => {
    const o = p * 10;
    Q[o] += a * a * w; Q[o + 1] += a * b * w; Q[o + 2] += a * c * w; Q[o + 3] += a * d * w;
    Q[o + 4] += b * b * w; Q[o + 5] += b * c * w; Q[o + 6] += b * d * w;
    Q[o + 7] += c * c * w; Q[o + 8] += c * d * w; Q[o + 9] += d * d * w;
  };
  const tN = new Float64Array(T * 3);      // face normals (unit), kept for the flip test
  for (let t = 0; t < T; t++) {
    const a = tri[t * 3] * 3, b = tri[t * 3 + 1] * 3, c = tri[t * 3 + 2] * 3;
    const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2];
    const vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-18) { tAlive[t] = 0; continue; }
    nx /= l; ny /= l; nz /= l;
    tN[t * 3] = nx; tN[t * 3 + 1] = ny; tN[t * 3 + 2] = nz;
    const d = -(nx * X[a] + ny * X[a + 1] + nz * X[a + 2]);
    const area = l * 0.5;
    addPlane(wPos[tri[t * 3]], nx, ny, nz, d, area);
    addPlane(wPos[tri[t * 3 + 1]], nx, ny, nz, d, area);
    addPlane(wPos[tri[t * 3 + 2]], nx, ny, nz, d, area);
  }
  // boundaries and seams: a wedge edge in one triangle only is a border of
  // the wedge graph; if its positions meet in more triangles it is a seam
  const wEdge = new Map(), pEdge = new Map();
  const ek = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  for (let t = 0; t < T; t++) {
    if (!tAlive[t]) continue;
    for (let e = 0; e < 3; e++) {
      const a = tri[t * 3 + e], b = tri[t * 3 + (e + 1) % 3];
      const kw = ek(a, b), kp = ek(wPos[a], wPos[b]);
      wEdge.set(kw, (wEdge.get(kw) || 0) + 1);
      pEdge.set(kp, (pEdge.get(kp) || 0) + 1);
    }
  }
  let nBorder = 0, nSeam = 0;
  for (let t = 0; t < T; t++) {
    if (!tAlive[t]) continue;
    for (let e = 0; e < 3; e++) {
      const a = tri[t * 3 + e], b = tri[t * 3 + (e + 1) % 3];
      if (wEdge.get(ek(a, b)) !== 1) continue;
      const seam = pEdge.get(ek(wPos[a], wPos[b])) > 1;
      if (seam) nSeam++; else nBorder++;
      // the plane through the edge, normal to the face
      const ax = X[a * 3], ay = X[a * 3 + 1], az = X[a * 3 + 2];
      const ex = X[b * 3] - ax, ey = X[b * 3 + 1] - ay, ez = X[b * 3 + 2] - az;
      const fx = tN[t * 3], fy = tN[t * 3 + 1], fz = tN[t * 3 + 2];
      let nx = fy * ez - fz * ey, ny = fz * ex - fx * ez, nz = fx * ey - fy * ex;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-18) continue;
      nx /= l; ny /= l; nz /= l;
      const d = -(nx * ax + ny * ay + nz * az);
      const w = (ex * ex + ey * ey + ez * ez) * (seam ? W_SEAM : W_BORDER);
      addPlane(wPos[a], nx, ny, nz, d, w);
      addPlane(wPos[b], nx, ny, nz, d, w);
    }
  }
  wEdge.clear(); pEdge.clear();

  const evalQ = (pa, pb, p) => {
    const a = pa * 10, b = pb * 10, x = pX[p * 3], y = pX[p * 3 + 1], z = pX[p * 3 + 2];
    const q = i => Q[a + i] + Q[b + i];
    return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x +
      q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9);
  };

  // THE HEAP: entries (cost, a, b, va, vb) - collapse wedge a onto wedge b,
  // valid while both keep the versions it was pushed with
  let cap = T * 6;
  let eCost = new Float64Array(cap), eA = new Int32Array(cap), eB = new Int32Array(cap),
    eVa = new Int32Array(cap), eVb = new Int32Array(cap);
  let nE = 0;
  let heap = new Int32Array(cap), nH = 0;
  const wVer = new Int32Array(W);
  const grow = () => {
    cap *= 2;
    const g = (old, C) => { const n = new C(cap); n.set(old); return n; };
    eCost = g(eCost, Float64Array); eA = g(eA, Int32Array); eB = g(eB, Int32Array);
    eVa = g(eVa, Int32Array); eVb = g(eVb, Int32Array); heap = g(heap, Int32Array);
  };
  const push = (a, b) => {
    if (nE >= cap) grow();
    const e = nE++;
    eCost[e] = evalQ(wPos[a], wPos[b], wPos[b]); eA[e] = a; eB[e] = b; eVa[e] = wVer[a]; eVb[e] = wVer[b];
    let i = nH++;
    heap[i] = e;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (eCost[heap[p]] <= eCost[heap[i]]) break;
      const s = heap[p]; heap[p] = heap[i]; heap[i] = s; i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap[--nH];
    if (nH > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < nH && eCost[heap[l]] < eCost[heap[m]]) m = l;
        if (r < nH && eCost[heap[r]] < eCost[heap[m]]) m = r;
        if (m === i) break;
        const s = heap[m]; heap[m] = heap[i]; heap[i] = s; i = m;
      }
    }
    return top;
  };
  const pushAround = w => {
    const ts = wTris[w];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (!tAlive[t]) continue;
      for (let e = 0; e < 3; e++) {
        const o = tri[t * 3 + e];
        if (o === w) continue;
        push(o, w); push(w, o);
      }
    }
  };
  for (let t = 0; t < T; t++) {
    if (!tAlive[t]) continue;
    for (let e = 0; e < 3; e++) { const a = tri[t * 3 + e], b = tri[t * 3 + (e + 1) % 3]; push(a, b); push(b, a); }
  }

  const adjacent = (a, b) => {
    const ts = wTris[a];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (!tAlive[t]) continue;
      if (tri[t * 3] === b || tri[t * 3 + 1] === b || tri[t * 3 + 2] === b) return true;
    }
    return false;
  };
  const compact = w => {
    const ts = wTris[w], out = [];
    for (let i = 0; i < ts.length; i++) if (tAlive[ts[i]]) out.push(ts[i]);
    wTris[w] = out;
    return out;
  };
  let alive = 0;
  for (let t = 0; t < T; t++) alive += tAlive[t];
  const pairs = [];
  let refused = 0, refSeam = 0;
  while (alive > target && nH > 0) {
    const e = pop();
    const a = eA[e], b = eB[e];
    if (!wAlive[a] || !wAlive[b] || wVer[a] !== eVa[e] || wVer[b] !== eVb[e]) continue;
    const pa = wPos[a], pb = wPos[b];
    if (pa === pb) continue;
    // THE SEAM RULE: every wedge of pa finds at most one wedge of pb across
    // a shared triangle - into which it merges - or none, in which case it
    // MOVES to pb with its own normal and uv (a hard-surface mesh has three
    // wedges at every box corner and none of them a twin of the next
    // corner's; refusing those left the cinder pallet at 9k of 18k). Two
    // twins is ambiguous: refused. Either way every wedge of pa ends up at
    // pb's position, so no crack opens.
    pairs.length = 0;
    let ok = true;
    const A = pWedges[pa], B = pWedges[pb];
    for (let i = 0; i < A.length && ok; i++) {
      const ai = A[i];
      let hit = -1;
      for (let j = 0; j < B.length; j++) {
        if (!adjacent(ai, B[j])) continue;
        if (hit >= 0) { ok = false; break; }
        hit = B[j];
      }
      pairs.push(ai, hit);
    }
    if (!ok) { refused++; refSeam++; continue; }
    // THE FLIP TEST on every triangle that survives the move
    const bx = pX[pb * 3], by = pX[pb * 3 + 1], bz = pX[pb * 3 + 2];
    for (let k = 0; k < pairs.length && ok; k += 2) {
      const ai = pairs[k];
      const ts = wTris[ai];
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        if (!tAlive[t]) continue;
        const w0 = tri[t * 3], w1 = tri[t * 3 + 1], w2 = tri[t * 3 + 2];
        if (wPos[w0] === pb || wPos[w1] === pb || wPos[w2] === pb) continue;   // dies
        const p0 = w0 * 3, p1 = w1 * 3, p2 = w2 * 3;
        const x0 = w0 === ai ? bx : X[p0], y0 = w0 === ai ? by : X[p0 + 1], z0 = w0 === ai ? bz : X[p0 + 2];
        const x1 = w1 === ai ? bx : X[p1], y1 = w1 === ai ? by : X[p1 + 1], z1 = w1 === ai ? bz : X[p1 + 2];
        const x2 = w2 === ai ? bx : X[p2], y2 = w2 === ai ? by : X[p2 + 1], z2 = w2 === ai ? bz : X[p2 + 2];
        const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
        const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz);
        if (l < 1e-16 || (nx * tN[t * 3] + ny * tN[t * 3 + 1] + nz * tN[t * 3 + 2]) / l < FLIP_COS) { ok = false; break; }
      }
    }
    if (!ok) { refused++; continue; }
    // COLLAPSE
    const moved = [];
    for (let k = 0; k < pairs.length; k += 2) {
      const ai = pairs[k], bj = pairs[k + 1];
      const ts = wTris[ai];
      const kept = [];
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        if (!tAlive[t]) continue;
        const w0 = tri[t * 3], w1 = tri[t * 3 + 1], w2 = tri[t * 3 + 2];
        if (wPos[w0] === pb || wPos[w1] === pb || wPos[w2] === pb) { tAlive[t] = 0; alive--; continue; }
        if (bj >= 0) { if (w0 === ai) tri[t * 3] = bj; if (w1 === ai) tri[t * 3 + 1] = bj; if (w2 === ai) tri[t * 3 + 2] = bj; }
        else kept.push(t);
        // the face normal moves with the vertex
        const q0 = tri[t * 3] * 3, q1 = tri[t * 3 + 1] * 3, q2 = tri[t * 3 + 2] * 3;
        const ux = X[q1] - X[q0], uy = X[q1 + 1] - X[q0 + 1], uz = X[q1 + 2] - X[q0 + 2];
        const vx = X[q2] - X[q0], vy = X[q2 + 1] - X[q0 + 1], vz = X[q2 + 2] - X[q0 + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        tN[t * 3] = nx / l; tN[t * 3 + 1] = ny / l; tN[t * 3 + 2] = nz / l;
        if (bj >= 0) wTris[bj].push(t);
      }
      if (bj >= 0) { wTris[ai] = null; wAlive[ai] = 0; }
      else {
        // the wedge moves: pb's position, its own attributes
        wTris[ai] = kept;
        wPos[ai] = pb;
        X[ai * 3] = pX[pb * 3]; X[ai * 3 + 1] = pX[pb * 3 + 1]; X[ai * 3 + 2] = pX[pb * 3 + 2];
        const bw = B[0];
        M.pos[ai * 3] = M.pos[bw * 3]; M.pos[ai * 3 + 1] = M.pos[bw * 3 + 1]; M.pos[ai * 3 + 2] = M.pos[bw * 3 + 2];
        moved.push(ai);
      }
    }
    for (let i = 0; i < 10; i++) Q[pb * 10 + i] += Q[pa * 10 + i];
    pWedges[pa] = null;
    for (const ai of moved) B.push(ai);
    for (let j = 0; j < B.length; j++) {
      const bj = B[j];
      wVer[bj]++;
      compact(bj);
      pushAround(bj);
    }
  }
  const out = [];
  for (let t = 0; t < T; t++) if (tAlive[t]) out.push(tri[t * 3], tri[t * 3 + 1], tri[t * 3 + 2]);
  return { idx: out, alive: wAlive, nt: alive, nBorder, nSeam, refused, refSeam };
}
// THE WORKER'S SOURCE: the function above as text, so a page can run it off
// the main thread (`new Worker(URL.createObjectURL(new Blob([MESH_DECIMATE_SRC + ...])))`).
const MESH_DECIMATE_SRC = meshDecimate.toString();
