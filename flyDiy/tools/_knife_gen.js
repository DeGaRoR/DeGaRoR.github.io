'use strict';
// ===========================================================================
// KNIFE_GEN — cut a drawn window through the SUBDIVIDED skin (knife project).
//
// The band windows (G12.3) are MATERIAL ZONES: a window is the set of cage
// faces between the sill rail and the ceil rail, so its shape is whatever the
// lattice gives — a bay wide, a band tall, square corners. This pass is the
// other thing: a window DRAWN in the side view (station, height, width,
// corner radius, or a round one) and cut into the displayed surface exactly
// where it was drawn, with a real reveal and a recessed pane.
//
// WHY IT CUTS THE SUBDIVIDED MESH AND NOT THE CAGE. The cage-inset detour
// (G12.3 v1-v3) bought three lessons: a creased loop is still a smooth curve,
// crease lines must not cross, and corner-pinned vertices stand proud of the
// converging surface. A drawn outline has nothing to do with the cage's rails,
// so cutting it into the cage would fight all three at once. The DISPLAYED
// surface (cageSubdivide x L) is a plain polygon mesh: an outline projected
// through it splits faces along exact crossings, and nothing downstream
// smooths it away — the G14 lesson ("step through the available geometry, no
// fighting the subsurf"), taken to the curve.
//
// THE METHOD, per window, per side:
//   1. the outline is a CONVEX polyline in (u, v) = (z, y) — a rounded
//      rectangle or an ellipse, sampled at `step`. Convexity is load-bearing:
//      a convex clip is an intersection of half-planes, which is what makes
//      the per-face cut exact and the pieces well-formed.
//   2. candidate faces: skin quads facing the projection side (n.x * side
//      above a floor) whose side-view box meets the outline's.
//   3. each candidate is clipped in 2D against the outline lines that
//      actually touch it (Sutherland-Hodgman): the INSIDE polygon is the
//      pane's share of that face. The OUTSIDE is the face minus the inside —
//      walked as a simple polygon (quad boundary, then the cut arc reversed)
//      and ear-clipped. A window smaller than one face is the annulus case,
//      bridged to one polygon.
//   4. every created point is the intersection of two CARRIERS (an original
//      edge or an outline line) and is keyed by that pair, so the same point
//      made from two faces welds bit-for-bit; points on a shared edge are then
//      inserted into every polygon using that edge (no T-junctions, even
//      against a face the cut skipped).
//   5. normals and the surface field are LERPED from the split edge's ends —
//      the pane is pushed in along that smooth normal and keeps it, so the
//      glass shades exactly as the skin it was cut from. The reveal WALL is
//      its own part (flat normals): a crisp step, deliberately.
//
// Output: the mesh with n-gon faces (the viewer fans them), `N` per vertex
// (explicit — computeVertexNormals on a cut skin would seam at the hole),
// and `knifeLoops` (the on-surface outline + its normals) for the joint bead.
// ===========================================================================
(function () {

const EPS = 1e-9;
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len3 = v => Math.hypot(v[0], v[1], v[2]);
const nrm3 = v => { const l = len3(v) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const lerpN = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

// ---------------------------------------------------------------------------
// OUTLINES — drawn in the side view, centred on (z, y), CONVEX, CCW in (u, v).
// ---------------------------------------------------------------------------
// a window with no corner rows set is the rectangle every build drew before
// T2.2: topK 1, no skew, one radius on all four corners
function knifeIsPlainRect(w) {
  const topK = w.topK == null ? 1 : +w.topK;
  if (Math.abs(topK - 1) > 1e-12 || Math.abs(+w.skew || 0) > 1e-12) return false;
  if (!Array.isArray(w.rr) || w.rr.length !== 4) return true;
  const r = +w.r || 0;
  return w.rr.every(v => Math.abs((+v || 0) - r) < 1e-12);
}
function knifeOutline(w) {
  const step = w.step || 0.012;
  const W = Math.max(0.02, w.w), H = Math.max(0.02, w.h);
  const pts = [];
  if (w.shape === 'ellipse') {
    const a = W / 2, b = H / 2;
    const per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    const n = Math.max(24, Math.ceil(per / step));
    for (let i = 0; i < n; i++) {
      const t = i / n * 2 * Math.PI;
      pts.push([w.z + a * Math.cos(t), w.y + b * Math.sin(t)]);
    }
  } else if (w.shape !== 'quad' && knifeIsPlainRect(w)) {
    // THE RECTANGLE, VERBATIM (every window drawn before T2.2): one radius
    // on four right angles, the quarter arcs sampled as they always were
    const r = Math.max(0, Math.min(w.r || 0, W / 2, H / 2));
    const cx = [W/2 - r, -(W/2 - r), -(W/2 - r), W/2 - r];
    const cy = [H/2 - r, H/2 - r, -(H/2 - r), -(H/2 - r)];
    const n = r > 1e-6 ? Math.max(3, Math.ceil(Math.PI / 2 * r / step)) : 0;
    for (let c = 0; c < 4; c++) {
      const a0 = c * Math.PI / 2;
      if (!n) { pts.push([w.z + cx[c], w.y + cy[c]]); continue; }
      for (let i = 0; i <= n; i++) {
        const t = a0 + i / n * Math.PI / 2;
        pts.push([w.z + cx[c] + r * Math.cos(t), w.y + cy[c] + r * Math.sin(t)]);
      }
    }
  } else {
    // THE QUAD BY CONSTRUCTION (T2.2, the user: "a quad base with rounded
    // corners, so triangles and odd shapes are reachable"): the bottom edge
    // is the width, the top edge is topK x the width (0 = a triangle) shifted
    // fore/aft by skew (a parallelogram, the Jodel's rear window), and each
    // corner has its own radius, clamped to what its corner can take. Always
    // convex — an intersection of four half-planes — which the knife needs.
    const topK = Math.max(0, w.topK == null ? 1 : +w.topK);
    const sk = +w.skew || 0;
    const Wt = W * topK;
    let corners, radii;
    const rr = Array.isArray(w.rr) && w.rr.length === 4
      ? w.rr.map(v => Math.max(0, +v || 0)) : [w.r, w.r, w.r, w.r].map(v => Math.max(0, +v || 0));
    if (w.shape === 'quad' && Array.isArray(w.q) && w.q.length === 4) {
      // WINDOWS-FREE: THE FREE QUAD - its four corners as placed (cageQuadWindow: side-view offsets from the
      // window's centre, Q1..Q4 the rectangle's own order), each rounded by its own radius. Wound CCW like every
      // outline here: a quad whose corners were dragged round the other way is turned back, its radii with it
      corners = w.q.map(c => [c[0], c[1]]); radii = rr;
      let a2 = 0;
      for (let i = 0; i < 4; i++) { const p = corners[i], q = corners[(i + 1) % 4]; a2 += p[0] * q[1] - q[0] * p[1]; }
      if (a2 < 0) { corners.reverse(); radii = radii.slice().reverse(); }
    } else if (Wt < 1e-6) {                 // the triangle: one apex, its radius the larger of the top pair
      corners = [[sk, H / 2], [-W / 2, -H / 2], [W / 2, -H / 2]];
      radii = [Math.max(rr[0], rr[1]), rr[2], rr[3]];
    } else {                         // CCW: top-fwd, top-aft, bottom-aft, bottom-fwd
      corners = [[sk + Wt / 2, H / 2], [sk - Wt / 2, H / 2], [-W / 2, -H / 2], [W / 2, -H / 2]];
      radii = rr;
    }
    const k = corners.length;
    for (let i = 0; i < k; i++) {
      const P = corners[i], A = corners[(i + k - 1) % k], B = corners[(i + 1) % k];
      const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
      const e1 = [(A[0] - P[0]) / la, (A[1] - P[1]) / la];
      const e2 = [(B[0] - P[0]) / lb, (B[1] - P[1]) / lb];
      const th = Math.acos(Math.max(-1, Math.min(1, e1[0] * e2[0] + e1[1] * e2[1])));
      const tanH = Math.tan(th / 2);
      const r = Math.min(radii[i], Math.min(la, lb) / 2 * tanH);
      if (r < 1e-6 || th < 1e-6) { pts.push([w.z + P[0], w.y + P[1]]); continue; }
      const d = r / tanH;
      const T1 = [P[0] + e1[0] * d, P[1] + e1[1] * d];
      const T2 = [P[0] + e2[0] * d, P[1] + e2[1] * d];
      const bis = [e1[0] + e2[0], e1[1] + e2[1]], bl = Math.hypot(bis[0], bis[1]) || 1;
      const C = [P[0] + bis[0] / bl * r / Math.sin(th / 2), P[1] + bis[1] / bl * r / Math.sin(th / 2)];
      const a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
      let da = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a1;
      while (da <= 0) da += 2 * Math.PI;
      while (da > 2 * Math.PI) da -= 2 * Math.PI;
      const n = Math.max(3, Math.ceil(da * r / step));
      for (let j = 0; j <= n; j++) {
        const t = a1 + j / n * da;
        pts.push([w.z + C[0] + r * Math.cos(t), w.y + C[1] + r * Math.sin(t)]);
      }
    }
  }
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  if (area < 0) pts.reverse();
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.hypot(p[0]-q[0], p[1]-q[1]) < 1e-7) continue;
    out.push(p);
  }
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0]-b[0], a[1]-b[1]) < 1e-7) out.pop();
  }
  return out;
}

// ---------------------------------------------------------------------------
// VERTEX NORMALS of the welded mesh, area-weighted (Newell), BEFORE the cut —
// these are the normals the skin keeps: the hole must not change how the
// surface around it shades.
// ---------------------------------------------------------------------------
function knifeNormals(m) {
  const N = m.V.map(() => [0, 0, 0]);
  for (const f of m.F) {
    const k = f.v.length, n = [0, 0, 0];
    for (let i = 0; i < k; i++) {
      const a = m.V[f.v[i]], b = m.V[f.v[(i + 1) % k]];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    for (const vi of f.v) {
      N[vi][0] += n[0]; N[vi][1] += n[1]; N[vi][2] += n[2];
    }
  }
  return N.map(nrm3);
}

// ---- 2D helpers ------------------------------------------------------------
// polygons here are arrays of RECORDS ({uv, ...}) or of {rec, car} entries;
// `uvs` pulls the 2D points out of either
const uvsOf = pg => pg.map(e => (e.rec ? e.rec : e).uv);
const area2 = pg => {
  const u = uvsOf(pg);
  let a = 0;
  for (let i = 0; i < u.length; i++) {
    const p = u[i], q = u[(i + 1) % u.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};
const sdist = (L, p) =>
  (L.b[0] - L.a[0]) * (p[1] - L.a[1]) - (L.b[1] - L.a[1]) * (p[0] - L.a[0]);
const segCross = (p, q, r, s) => {
  const d = (q[0]-p[0]) * (s[1]-r[1]) - (q[1]-p[1]) * (s[0]-r[0]);
  if (Math.abs(d) < 1e-14) return false;
  const t = ((r[0]-p[0]) * (s[1]-r[1]) - (r[1]-p[1]) * (s[0]-r[0])) / d;
  const u = ((r[0]-p[0]) * (q[1]-p[1]) - (r[1]-p[1]) * (q[0]-p[0])) / d;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9;
};
// is a polygon (uv list) convex? consecutive turns all the same way
const isConvex = uvs => {
  let sgn = 0;
  for (let i = 0; i < uvs.length; i++) {
    const a = uvs[i], b = uvs[(i + 1) % uvs.length], c = uvs[(i + 2) % uvs.length];
    const x = (b[0]-a[0]) * (c[1]-b[1]) - (b[1]-a[1]) * (c[0]-b[0]);
    if (Math.abs(x) < 1e-13) continue;
    if (!sgn) sgn = Math.sign(x); else if (Math.sign(x) !== sgn) return false;
  }
  return true;
};
// point in a convex polygon (uv list), any orientation
const inConvex = (p, uvs) => {
  let sgn = 0;
  for (let i = 0; i < uvs.length; i++) {
    const a = uvs[i], b = uvs[(i + 1) % uvs.length];
    const c = (b[0]-a[0]) * (p[1]-a[1]) - (b[1]-a[1]) * (p[0]-a[0]);
    if (Math.abs(c) < 1e-12) continue;
    if (!sgn) sgn = Math.sign(c); else if (Math.sign(c) !== sgn) return false;
  }
  return true;
};

// EAR CLIPPING of a simple polygon (records with .uv, .key), returns index
// triples in the polygon's own orientation. Bridge twins (the annulus case
// repeats two vertices) are excused from the containment test.
function earClip(pg) {
  const n = pg.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];
  const idx = [...Array(n).keys()];
  const sgn = Math.sign(area2(pg)) || 1;
  const tris = [];
  const cr = (a, b, c) => {
    const p = pg[a].uv, q = pg[b].uv, r = pg[c].uv;
    return ((q[0]-p[0]) * (r[1]-p[1]) - (q[1]-p[1]) * (r[0]-p[0])) * sgn;
  };
  const inTri = (p, a, b, c) => {
    const A = pg[a].uv, B = pg[b].uv, C = pg[c].uv;
    const s1 = ((B[0]-A[0]) * (p[1]-A[1]) - (B[1]-A[1]) * (p[0]-A[0])) * sgn;
    const s2 = ((C[0]-B[0]) * (p[1]-B[1]) - (C[1]-B[1]) * (p[0]-B[0])) * sgn;
    const s3 = ((A[0]-C[0]) * (p[1]-C[1]) - (A[1]-C[1]) * (p[0]-C[0])) * sgn;
    return s1 > 1e-13 && s2 > 1e-13 && s3 > 1e-13;
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < 4 * n) {
    let done = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i - 1 + idx.length) % idx.length], b = idx[i],
            c = idx[(i + 1) % idx.length];
      if (cr(a, b, c) <= 1e-14) continue;               // reflex or flat
      let ok = true;
      for (const j of idx) {
        if (j === a || j === b || j === c) continue;
        if (pg[j].key === pg[a].key || pg[j].key === pg[b].key ||
            pg[j].key === pg[c].key) continue;
        if (inTri(pg[j].uv, a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      tris.push([a, b, c]); idx.splice(i, 1); done = true; break;
    }
    if (!done) {
      // collinear leftovers: drop a flat vertex and go on
      let dropped = false;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i - 1 + idx.length) % idx.length], b = idx[i],
              c = idx[(i + 1) % idx.length];
        if (Math.abs(cr(a, b, c)) <= 1e-14) { idx.splice(i, 1); dropped = true; break; }
      }
      if (!dropped) break;
    }
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

// ---------------------------------------------------------------------------
// THE CUT.
//   m    {V, F, A?, N?}  — the displayed (subdivided) mesh
//   win  {shape, z, y, w, h, r, step}
//   opt  {side: +1|-1, mats: Set|null, nMin, depth, paneMat, wallMat}
// ---------------------------------------------------------------------------
function knifeCut(m, win, opt) {
  opt = opt || {};
  const side = opt.side || 1;
  const depth = opt.depth != null ? opt.depth : 0.006;
  // the side test only has to tell the two flanks apart (the far flank
  // faces away); a face nearly edge-on to the projection is still cut if
  // it is convex in the side view, so a window can run up to the crown
  const nMin = opt.nMin != null ? opt.nMin : 0.03;
  const paneMat = opt.paneMat || 'drawnPane';
  const wallMat = opt.wallMat || 'reveal';
  const V = m.V.map(p => p.slice()), F = [];
  const A = m.A ? m.A.slice() : null;
  const N = (m.N || knifeNormals(m)).map(n => n.slice());
  // a new vertex's surface field when it has none: zeros of the mesh's own width (the sheet's 4; a wing's packed attributes)
  const aW = A && A.length ? (A.find(a => a) || [0, 0, 0, 0]).length : 4, aZ = () => new Array(aW).fill(0);
  // THE WINDOW IS DRAWN ON THE SKIN WHERE IT SITS, not in the pure side view
  // (the user, on a window that landed on the aft deck's shoulder: "strange
  // shape there" — a side-view outline projected along x smears over a
  // surface that has turned towards the roof). The station and the height
  // still say WHERE in the side view: the ray along x at (z, y) finds the
  // skin, and the outline is laid in the tangent plane there and projected
  // along that normal — so the shape is the drawn shape, seen face-on, on
  // the flank, on the shoulder, or on a belly.
  const newell = idx => {
    const n = [0, 0, 0], k = idx.length;
    for (let i = 0; i < k; i++) {
      const a = m.V[idx[i]], b = m.V[idx[(i + 1) % k]];
      n[0] += (a[1]-b[1]) * (a[2]+b[2]); n[1] += (a[2]-b[2]) * (a[0]+b[0]);
      n[2] += (a[0]-b[0]) * (a[1]+b[1]);
    }
    return n;
  };
  // RETRACT G4 (THE WELL, cut from below): `opt.frame` {n0, c0, t1, t2} gives the projection and the plane the outline
  // is laid in outright (a well's: n0 straight down, t1 along the body), `opt.outline` the convex CCW outline in that
  // frame's (u, v) - no side-view probe, no drawn shape. `opt.ceil` (a height, the mesh's y) makes the recess a BOX:
  // the pane is the flat ceiling at that height (each point straight up from where the outline met the skin, never
  // below the skin) and the walls stand vertical - a wheel well, not a window's reveal
  // (GM: `opt.ceil` may be a FUNCTION of the plan place (x, z) - a fitted ceiling, deep only where the unit goes)
  const FR = opt.frame || null, CEIL = opt.ceil == null ? null : typeof opt.ceil === 'function' ? opt.ceil : +opt.ceil;
  const ceilAt = typeof CEIL === 'function' ? CEIL : () => CEIL;
  let n0 = FR ? FR.n0.slice() : [side, 0, 0], c0 = FR ? FR.c0.slice() : [0, win.y, win.z];
  if (!FR) {
    let best = null;
    for (const f of m.F) {
      if (f.v.length < 3 || f.knife || (opt.mats && !opt.mats.has(f.m)) ||
          f.m === 'joint' || f.m === 'doorSeal') continue;
      const n = newell(f.v), nl = len3(n);
      if (nl < 1e-12 || n[0] * side / nl < 0.03) continue;
      const off = f.cutOff || [0, 0, 0];
      const zy = f.v.map(i => [m.V[i][2] - off[2], m.V[i][1] - off[1]]);
      if (!isConvex(zy) || !inConvex([win.z, win.y], zy)) continue;
      let cx = 0;
      for (const i of f.v) cx += (m.V[i][0] - off[0]) / f.v.length;
      if (!best || cx * side > best.cx * side) best = { f, n: nrm3(n), cx, off };
    }
    if (best) {
      n0 = best.n;
      // the point on that face's plane at (y, z) — the window's centre
      const c = [0, 0, 0];
      for (const i of best.f.v) for (let k = 0; k < 3; k++)
        c[k] += (m.V[i][k] - best.off[k]) / best.f.v.length;
      const x = Math.abs(n0[0]) > 1e-6
        ? c[0] - (n0[1] * (win.y - c[1]) + n0[2] * (win.z - c[2])) / n0[0] : c[0];
      c0 = [x, win.y, win.z];
    }
  }
  // the frame: t1 along the body (z, made tangent), t2 = n0 x t1 (up-ish)
  const dz = n0[2];
  const t1 = FR ? FR.t1.slice() : nrm3([-n0[0] * dz, -n0[1] * dz, 1 - n0[2] * dz]);
  const t2 = FR ? FR.t2.slice() : cross(n0, t1);
  const uvOf = p => {
    const d = [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
    return [d[0]*t1[0] + d[1]*t1[1] + d[2]*t1[2],
            d[0]*t2[0] + d[1]*t2[1] + d[2]*t2[2]];
  };
  let outline = opt.outline ? opt.outline.map(p => [p[0], p[1]]) : knifeOutline(Object.assign({}, win, { z: 0, y: 0 }));
  // WINDOWS-FREE: A QUAD IS PLACED IN THE SIDE VIEW, corner by corner, and each corner must land where it was put
  // (the Cub's wing-line edge): its outline is in side-view offsets, so it is laid on the tangent plane by the
  // plane's own relation - the point of the plane at side-view offset (dz, dy) is c0 + (dx, dy, dz) with
  // dx = -(n.y dy + n.z dz) / n.x - and read in (t1, t2). A linear map: the outline stays convex, each corner lands
  // on the plane exactly under its side-view place, and the projection along n0 onto the skin moves it by the
  // sagitta only. (The rounded rectangle and the oval keep the drawn shape seen face-on, as they always have.)
  if (!opt.outline && win.shape === 'quad' && Math.abs(n0[0]) > 0.2) {
    const kz = -n0[2] / n0[0], ky = -n0[1] / n0[0];
    const m11 = t1[2] + kz * t1[0], m12 = t1[1] + ky * t1[0];
    const m21 = t2[2] + kz * t2[0], m22 = t2[1] + ky * t2[0];
    outline = outline.map(([dz, dy]) => [m11 * dz + m12 * dy, m21 * dz + m22 * dy]);
    let a2 = 0;
    for (let i = 0; i < outline.length; i++) { const p = outline[i], q = outline[(i + 1) % outline.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) outline.reverse();
  }
  const bb = { u0: 1e9, u1: -1e9, v0: 1e9, v1: -1e9 };
  for (const p of outline) {
    bb.u0 = Math.min(bb.u0, p[0]); bb.u1 = Math.max(bb.u1, p[0]);
    bb.v0 = Math.min(bb.v0, p[1]); bb.v1 = Math.max(bb.v1, p[1]);
  }
  const lines = outline.map((p, i) =>
    ({ a: p, b: outline[(i + 1) % outline.length], i, car: 'L' + i }));
  const stats = { faces: 0, cut: 0, pane: 0, skipped: 0, pieces: 0,
                  loops: 0, loopPts: 0, open: 0 };

  // VERTEX RECORDS. Original: key 'v#'. Created: the canonical pair of its
  // two carriers. `id` is the skin vertex, `pid` the pane copy (lazy).
  const reg = new Map();
  // A CUT PART IS DRAWN IN ITS OWN FRAME: an exploded door carries its
  // translation as cutOff on its faces (G14), and a window drawn at an
  // absolute station must land on the door where it would with the door
  // shut — so the side-view coordinates are taken with that offset removed.
  // Parts separate by vertex duplication, so a vertex has one offset.
  const origRec = (i, off) => {
    const key = 'v' + i;
    let r = reg.get(key);
    if (!r) {
      const p0 = off ? [V[i][0] - off[0], V[i][1] - off[1], V[i][2] - off[2]] : V[i];
      r = { key, P: V[i], N: N[i], A: A ? A[i] : null, uv: uvOf(p0), id: i,
            pid: -1, onEdge: null, used: true };
      reg.set(key, r);
    }
    return r;
  };
  // points placed on ORIGINAL edges, for the T-junction repair. Only points
  // that END UP in a pane polygon are `used`: a clip by a line whose segment
  // stops inside the face also crosses the boundary beyond the segment, and
  // that point is clipped away again by the next line — it must not be
  // inserted anywhere.
  const onEdge = new Map();                    // 'E:a|b' -> [{t, rec}]
  const edgeCar = (ka, kb) => 'E:' + (ka < kb ? ka + '|' + kb : kb + '|' + ka);
  const madePoint = (ra, rb, t, car, li) => {
    const k1 = car, k2 = 'L' + li;
    const key = k1 < k2 ? k1 + '^' + k2 : k2 + '^' + k1;
    let r = reg.get(key);
    if (r) return r;
    // canonical evaluation: from the smaller key, so both faces agree
    let a = ra, b = rb, tt = t;
    if (a.key > b.key) { a = rb; b = ra; tt = 1 - t; }
    r = { key, P: lerpN(a.P, b.P, tt), N: nrm3(lerpN(a.N, b.N, tt)),
          A: a.A && b.A ? lerpN(a.A, b.A, tt) : null,
          uv: [a.uv[0] + (b.uv[0] - a.uv[0]) * tt,
               a.uv[1] + (b.uv[1] - a.uv[1]) * tt],
          id: -1, pid: -1, onEdge: null, used: false };
    reg.set(key, r);
    if (car[0] === 'E') {
      // parameter along the ORIGINAL edge, from its own end records
      const [ka, kb] = car.slice(2).split('|');
      const A0 = reg.get(ka), B0 = reg.get(kb);
      const du = B0.uv[0] - A0.uv[0], dv = B0.uv[1] - A0.uv[1];
      const te = ((r.uv[0] - A0.uv[0]) * du + (r.uv[1] - A0.uv[1]) * dv) /
                 ((du * du + dv * dv) || 1);
      r.onEdge = { car, t: te };
      if (!onEdge.has(car)) onEdge.set(car, []);
      onEdge.get(car).push({ t: te, rec: r });
    }
    return r;
  };
  const skinId = r => {
    if (r.id < 0) {
      r.id = V.length; V.push(r.P.slice()); N.push(r.N.slice());
      if (A) A.push(r.A ? r.A.slice() : aZ());
    }
    return r.id;
  };
  // the recessed point: along the skin's normal by `depth` (a window), or straight up to the ceiling (a well)
  // (GR: `opt.ceilP` - a well in any frame: the recess goes INWARD (-n0) to the target its function gives for the point,
  // in the inward coordinate a . P - the Catalina's side recess)
  const CP = typeof opt.ceilP === 'function' ? opt.ceilP : null, aIn = [-n0[0], -n0[1], -n0[2]];
  const recess = r => CP ? (() => { const s0 = r.P[0] * aIn[0] + r.P[1] * aIn[1] + r.P[2] * aIn[2], t = Math.max(0, CP(r.P) - s0);
      return [r.P[0] + aIn[0] * t, r.P[1] + aIn[1] * t, r.P[2] + aIn[2] * t]; })()
    : CEIL != null ? [r.P[0], Math.max(ceilAt(r.P[0], r.P[2]), r.P[1]), r.P[2]]
    : [r.P[0] - r.N[0] * depth, r.P[1] - r.N[1] * depth, r.P[2] - r.N[2] * depth];
  const paneId = r => {
    if (r.pid < 0) {
      r.pid = V.length;
      V.push(recess(r));
      N.push(CEIL != null || CP ? n0.slice() : r.N.slice());
      if (A) A.push(r.A ? r.A.slice() : aZ());
    }
    return r.pid;
  };

  // polygon = array of {rec, car}: car is the carrier of the edge LEAVING
  // that vertex ('E:..' an original edge, 'L#' an outline line)
  const clipHalf = (pg, L) => {
    const d = pg.map(e => sdist(L, e.rec.uv));
    let anyIn = false, anyOut = false;
    for (const x of d) { if (x > EPS) anyIn = true; else if (x < -EPS) anyOut = true; }
    if (!anyOut) return pg;
    if (!anyIn) return null;
    const out = [];
    for (let i = 0; i < pg.length; i++) {
      const j = (i + 1) % pg.length, ei = pg[i], ej = pg[j];
      const di = d[i], dj = d[j];
      if (di >= -EPS) out.push({ rec: ei.rec, car: ei.car });
      if ((di > EPS && dj < -EPS) || (di < -EPS && dj > EPS)) {
        const t = di / (di - dj);
        const x = madePoint(ei.rec, ej.rec, t, ei.car, L.i);
        // leaving the half-plane: the edge out of this point is the chord;
        // entering: back onto the carrier we were on
        out.push({ rec: x, car: di > EPS ? L.car : ei.car });
      }
    }
    return out.length >= 3 ? out : null;
  };
  // remove consecutive duplicates and zero-area leftovers
  const cleanPoly = pg => {
    const o = [];
    for (const e of pg) {
      if (o.length && o[o.length - 1].rec === e.rec) continue;
      o.push(e);
    }
    while (o.length > 1 && o[0].rec === o[o.length - 1].rec) o.pop();
    return o.length >= 3 && Math.abs(area2(o)) > 1e-14 ? o : null;
  };

  // FACES OF ANY SIZE: the skin is quads on the first cut, but a second
  // window meets the first one's triangles and n-gons, and a point the new
  // cut puts on a shared edge has to reach them too — so every skin face
  // goes through the same polygon path (a cut-out piece is convex: a
  // triangle, or an n-gon whose extra points are collinear).
  const pieces = [];      // outside polygons {pg, f}
  const panes = [];       // inside polygons {pg, f}
  const untouched = [];   // skin faces that may still need edge points
  // A WELL'S FAST PATH (RETRACT G4): with the frame given, a face whose box in (u, v) misses the outline's passes as it
  // is - no point is made on its edges (a crossing lies inside the outline's box and on the face's edge, so inside the
  // face's box too), so it would have come out the same, at the price of a record for each of its vertices
  const far = FR ? f => {
    if (f.cutOff) return false;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const i of f.v) { const uv = uvOf(m.V[i]); a0 = Math.min(a0, uv[0]); a1 = Math.max(a1, uv[0]); b0 = Math.min(b0, uv[1]); b1 = Math.max(b1, uv[1]); }
    return a1 < bb.u0 - 1e-9 || a0 > bb.u1 + 1e-9 || b1 < bb.v0 - 1e-9 || b0 > bb.v1 + 1e-9;
  } : null;
  // (GR: `opt.yMax` - a face wholly over it is not this well's: a high wing's centre section over a nose well)
  const over = opt.yMax != null ? f => f.v.every(i => m.V[i][1] > opt.yMax) : null;
  for (const f of m.F) {
    if (f.v.length < 3 || f.knife || (opt.mats && !opt.mats.has(f.m)) ||
        f.m === 'joint' || f.m === 'doorSeal' || (far && far(f)) || (over && over(f))) { F.push(f); continue; }
    const nV = f.v.length, Pn = f.v.map(i => m.V[i]);
    const n = [0, 0, 0];
    for (let i = 0; i < nV; i++) {
      const a = Pn[i], b = Pn[(i + 1) % nV];
      n[0] += (a[1]-b[1]) * (a[2]+b[2]); n[1] += (a[2]-b[2]) * (a[0]+b[0]);
      n[2] += (a[0]-b[0]) * (a[1]+b[1]);
    }
    const nl = len3(n);
    const recs = f.v.map(i => origRec(i, f.cutOff || null));
    // a face not on this side still shares edges with faces that are: it
    // takes the repair pass like any untouched face
    const quad0 = () => recs.map((r, k) =>
      ({ rec: r, car: edgeCar(r.key, recs[(k + 1) % nV].key) }));
    const facing = (n[0]*n0[0] + n[1]*n0[1] + n[2]*n0[2]) / (nl || 1);
    // CAR-4: opt.only(f, V) - a face the caller excludes is never cut (the rear window: the rear wall only, not every
    // aft-facing face the projection meets along the body); absent = every facing face, as before
    if (nl < 1e-12 || facing < nMin || (opt.only && !opt.only(f, V))) {
      untouched.push({ pg: quad0(), f }); continue;
    }
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const r of recs) {
      u0 = Math.min(u0, r.uv[0]); u1 = Math.max(u1, r.uv[0]);
      v0 = Math.min(v0, r.uv[1]); v1 = Math.max(v1, r.uv[1]);
    }
    const quad = quad0();
    if (u1 < bb.u0 || u0 > bb.u1 || v1 < bb.v0 || v0 > bb.v1) {
      untouched.push({ pg: quad, f }); continue;
    }
    stats.faces++;
    // convex in the side view? (a grazing or folded face is skipped)
    const uvs = recs.map(r => r.uv);
    if (!isConvex(uvs) || Math.abs(area2(recs)) < 1e-10) {
      stats.skipped++; untouched.push({ pg: quad, f }); continue;
    }
    // outline lines that touch this face
    const rel = lines.filter(L => {
      if (inConvex(L.a, uvs) || inConvex(L.b, uvs)) return true;
      for (let k = 0; k < nV; k++)
        if (segCross(L.a, L.b, uvs[k], uvs[(k + 1) % nV])) return true;
      return false;
    });
    if (!rel.length) {
      if (inConvex(uvs[0], outline)) { panes.push({ pg: quad, f }); stats.pane++; }
      else untouched.push({ pg: quad, f });
      continue;
    }
    let inside = quad;
    for (const L of rel) { inside = clipHalf(inside, L); if (!inside) break; }
    inside = inside && cleanPoly(inside);
    if (!inside) { untouched.push({ pg: quad, f }); continue; }
    stats.cut++;
    panes.push({ pg: inside, f });

    // THE OUTSIDE. The inside polygon's boundary alternates between runs
    // on the quad boundary (carrier 'E') and cut ARCS (carrier 'L'). Each
    // arc closes one outside piece: the inside polygon leaves the quad
    // boundary at the arc's START and rejoins it at its END, so the part
    // of the boundary it does NOT use runs from START forward to END —
    // walk that, then the arc back from END to START. No boundary run at
    // all is the annulus (window inside one face).
    const n2 = inside.length;
    const arcs = [];
    let k0 = -1;
    for (let i = 0; i < n2; i++) if (inside[i].car[0] === 'E') { k0 = i; break; }
    if (k0 < 0) arcs.push({ ring: true, pts: inside.map(e => e.rec) });
    else {
      let cur = null;
      for (let g = 0; g <= n2; g++) {
        const i = (k0 + g) % n2, e = inside[i];
        if (e.car[0] === 'L') {
          if (!cur) cur = [e.rec];
          cur.push(inside[(i + 1) % n2].rec);
        } else if (cur) { arcs.push({ ring: false, pts: cur }); cur = null; }
      }
      if (cur) arcs.push({ ring: false, pts: cur });
    }
    // the quad boundary with this face's true crossings inserted, in order
    const onB = new Set(inside.map(e => e.rec));
    for (const r of onB) r.used = true;
    const bnd = [];
    for (let k = 0; k < nV; k++) {
      const a = recs[k], b = recs[(k + 1) % nV], car = quad[k].car;
      bnd.push({ rec: a, car });
      const ins = (onEdge.get(car) || []).filter(p => onB.has(p.rec))
        .map(p => ({ t: (a.key < b.key) ? p.t : 1 - p.t, rec: p.rec }))
        .sort((x, y) => x.t - y.t);
      for (const p of ins) bnd.push({ rec: p.rec, car });
    }
    if (arcs.length === 1 && arcs[0].ring) {
      const ring = arcs[0].pts;
      let bi = 0, bj = 0, bd = 1e18;
      bnd.forEach((e, i) => ring.forEach((r, j) => {
        const d = (e.rec.uv[0]-r.uv[0])**2 + (e.rec.uv[1]-r.uv[1])**2;
        if (d < bd) { bd = d; bi = i; bj = j; }
      }));
      const pg = [];
      for (let g = 0; g <= bnd.length; g++) pg.push(bnd[(bi + g) % bnd.length]);
      for (let g = 0; g <= ring.length; g++)
        pg.push({ rec: ring[(bj - g + ring.length * 2) % ring.length], car: 'L' });
      pieces.push({ pg, f });
      stats.pieces++;
      continue;
    }
    const at = new Map(bnd.map((e, i) => [e.rec, i]));
    for (const arc of arcs) {
      const start = arc.pts[0], end = arc.pts[arc.pts.length - 1];
      const i0 = at.get(start), i1 = at.get(end);
      if (i0 == null || i1 == null) continue;
      const pg = [];
      for (let g = 0; g <= bnd.length; g++) {
        const i = (i0 + g) % bnd.length;
        pg.push(bnd[i]);
        if (i === i1) break;
      }
      for (let g = arc.pts.length - 2; g >= 1; g--) pg.push({ rec: arc.pts[g], car: 'L' });
      const pc = cleanPoly(pg);
      if (pc) { pieces.push({ pg: pc, f }); stats.pieces++; }
    }
  }

  // T-JUNCTION REPAIR: every polygon edge riding an original carrier takes
  // the points registered on that carrier between its ends.
  const tOn = (r, car) => {
    if (r.onEdge && r.onEdge.car === car) return r.onEdge.t;
    const [ka, kb] = car.slice(2).split('|');
    if (r.key === ka) return 0;
    if (r.key === kb) return 1;
    return null;
  };
  const repair = pg => {
    const o = [];
    for (let i = 0; i < pg.length; i++) {
      const e = pg[i], nx = pg[(i + 1) % pg.length];
      o.push(e);
      if (e.car[0] !== 'E') continue;
      const lst = onEdge.get(e.car);
      if (!lst) continue;
      const ta = tOn(e.rec, e.car), tb = tOn(nx.rec, e.car);
      if (ta == null || tb == null) continue;
      const lo = Math.min(ta, tb), hi = Math.max(ta, tb);
      const ins = lst.filter(p => p.rec.used && p.t > lo + 1e-12 &&
                                  p.t < hi - 1e-12 &&
                                  p.rec !== e.rec && p.rec !== nx.rec)
        .sort((x, y) => ta < tb ? x.t - y.t : y.t - x.t);
      for (const p of ins) o.push({ rec: p.rec, car: e.car });
    }
    return o;
  };

  // EMIT. Outside pieces: ear-clipped (the walk is a simple polygon).
  // Untouched quads with inserted points: n-gons (the viewer fans them).
  // Panes: convex n-gons, on their own recessed vertices.
  for (const { pg, f } of untouched) {
    const r = repair(pg);
    F.push(Object.assign({}, f, { v: r.map(e => skinId(e.rec)) }));
  }
  for (const { pg, f } of pieces) {
    const r = repair(pg);
    const tris = earClip(r.map(e => e.rec));
    for (const t of tris)
      F.push(Object.assign({}, f, { v: [skinId(r[t[0]].rec), skinId(r[t[1]].rec),
                                         skinId(r[t[2]].rec)], knifeSkin: 1 }));
  }
  // pane boundary walk (on repaired polygons, by record identity)
  const own = new Map();
  const paneRep = panes.map(({ pg, f }) => ({ pg: repair(pg), f }));
  for (const { pg } of paneRep)
    for (let i = 0; i < pg.length; i++) {
      const a = pg[i].rec, b = pg[(i + 1) % pg.length].rec;
      const k = a.key < b.key ? a.key + '~' + b.key : b.key + '~' + a.key;
      if (!own.has(k)) own.set(k, { a, b, n: 0 });
      own.get(k).n++;
    }
  const nxt = new Map();
  for (const { a, b, n } of own.values()) if (n === 1) nxt.set(a, b);
  const loops = [];
  const seen = new Set();
  for (const s0 of nxt.keys()) {
    if (seen.has(s0)) continue;
    const ring = [s0]; seen.add(s0);
    for (let v = nxt.get(s0); v && v !== s0 && ring.length <= nxt.size; v = nxt.get(v)) {
      if (seen.has(v)) break;
      ring.push(v); seen.add(v);
    }
    const closed = nxt.get(ring[ring.length - 1]) === s0;
    if (!closed) stats.open++;
    loops.push({ ring, closed });
  }
  stats.loops = loops.length;
  // BUBBLE WINDOWS (BUBBLE-WINDOWS, the user 7 Nov: "bubble windows would be
  // cool"): win.bulge > 0 blows the pane OUT into a blister instead of setting
  // it in. The dome stands on the hole's own loop (its rim on the skin, under
  // the bead), its rings are the outline shrunk towards the outline's centroid
  // in the tangent plane, each laid on the skin under it (the pane pieces,
  // which carry the skin's points) and lifted along the skin's normal on an
  // ellipse: rim on the skin, the full bulge at the centre, never overhanging.
  // One part, one loop, one host: a window across a door's edge (two hosts)
  // or with an open loop keeps the flat pane. No reveal wall: there is no
  // recess.
  const bulgeOf = () => {
    const b = Math.max(0, +win.bulge || 0);
    if (!b || loops.length !== 1 || !loops[0].closed || loops[0].ring.length < 3) return 0;
    const tag = f => JSON.stringify([f.doorKey, f.cutPart, f.cutOff]);
    if (!paneRep.every(p => tag(p.f) === tag(paneRep[0].f))) return 0;
    return Math.min(b, 0.5 * Math.min(bb.u1 - bb.u0, bb.v1 - bb.v0));
  };
  const bulge = bulgeOf();
  const wallDepth = bulge ? 0 : depth;
  if (bulge) {
    const ring = loops[0].ring, n0r = ring.length;
    // the skin under a tangent-plane point: barycentric in the pane pieces' fans
    const tris = [];
    for (const { pg } of paneRep)
      for (let i = 1; i + 1 < pg.length; i++) tris.push([pg[0].rec, pg[i].rec, pg[i + 1].rec]);
    const skinAt = uv => {
      let best = null, bw = -1e9;
      for (const t of tris) {
        const [a, b, c] = t.map(r => r.uv);
        const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(d) < 1e-16) continue;
        const l1 = ((b[1] - c[1]) * (uv[0] - c[0]) + (c[0] - b[0]) * (uv[1] - c[1])) / d;
        const l2 = ((c[1] - a[1]) * (uv[0] - c[0]) + (a[0] - c[0]) * (uv[1] - c[1])) / d;
        const l = [l1, l2, 1 - l1 - l2], mn = Math.min(l[0], l[1], l[2]);
        if (mn > bw) { bw = mn; best = { t, l }; }
        if (mn >= 0) break;
      }
      const l = best.l.map(x => Math.max(0, x)), s = l[0] + l[1] + l[2] || 1;
      const mix = k => best.t[0][k] && best.t[1][k] && best.t[2][k]
        ? [0, 1, 2, 3].slice(0, best.t[0][k].length).map(i =>
            (best.t[0][k][i] * l[0] + best.t[1][k][i] * l[1] + best.t[2][k][i] * l[2]) / s)
        : null;
      return { P: mix('P'), N: nrm3(mix('N')), A: mix('A') };
    };
    // the rim by arc length (each ring is sampled at the same fractions of it)
    const cum = [0];
    for (let i = 1; i <= n0r; i++) {
      const p = ring[i - 1].uv, q = ring[i % n0r].uv;
      cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]));
    }
    const Ltot = cum[n0r] || 1;
    const rimAt = fr => {
      const L = fr * Ltot;
      let i = 0;
      while (i < n0r - 1 && cum[i + 1] < L) i++;
      const p = ring[i].uv, q = ring[(i + 1) % n0r].uv, seg = cum[i + 1] - cum[i] || 1;
      const t = (L - cum[i]) / seg;
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    let ca = 0, cu = 0, cv = 0;                    // the outline's centroid
    for (let i = 0; i < n0r; i++) {
      const p = ring[i].uv, q = ring[(i + 1) % n0r].uv, x = p[0] * q[1] - q[0] * p[1];
      ca += x; cu += (p[0] + q[0]) * x; cv += (p[1] + q[1]) * x;
    }
    const cuv = Math.abs(ca) > 1e-14 ? [cu / (3 * ca), cv / (3 * ca)] : [0, 0];
    const baseN = [];                               // per dome vertex, for the winding
    const dv = (P, Nn, Aa, h) => {
      const id = V.length;
      V.push([P[0] + Nn[0] * h, P[1] + Nn[1] * h, P[2] + Nn[2] * h]);
      N.push([0, 0, 0]); baseN[id] = Nn;
      if (A) A.push(Aa ? Aa.slice() : [0, 0, 0, 0]);
      return id;
    };
    // CLEAN GEOMETRY (the user 8 Nov: "little squares on their side at the bottom of the windows ... make sure the
    // geometry is as clean as it can"). The rings stood on the pane pieces (the skin's flat facets, their normals
    // blended across the sill's crease) and each ring had its own count, so the lift came out in lumps and the
    // stitch in slivers. Now: the skin under the window is one smooth surface, a quadratic height over the tangent
    // plane, w(u, v) = a + bu + cv + du^2 + euv + fv^2 along n0, least squares over the pane's own skin points; the
    // rings stand on it and lift along ITS normal. The rim keeps the loop's exact points (watertight with the skin
    // and the bead); what the rim sits off the smooth surface fades out inward (s^2). Every inner ring has the same
    // count, so the rings stitch as a regular polar grid. skinAt still gives the field coordinates (A).
    // the fit's points: the pane's skin points AND the skin sampled inside the outline (an oval's rim is a conic, so the
    // rim alone leaves a quadratic free to bulge at the centre - KNIFE BUBBLE caught 9 cm over a 5 cm row)
    const fitPts = new Map();
    for (const { pg } of paneRep) for (const e of pg) fitPts.set(e.rec, e.rec);
    for (const s of [0.75, 0.5, 0.25]) for (let j = 0; j < 16; j++) {
      const q = rimAt(j / 16), uv = [cuv[0] + (q[0] - cuv[0]) * s, cuv[1] + (q[1] - cuv[1]) * s], sk = skinAt(uv);
      if (sk.P) fitPts.set('in' + s + ':' + j, { uv, P: sk.P });
    }
    { const sk = skinAt(cuv); if (sk.P) fitPts.set('in0', { uv: cuv, P: sk.P }); }
    const hOf = P => (P[0] - c0[0]) * n0[0] + (P[1] - c0[1]) * n0[1] + (P[2] - c0[2]) * n0[2];
    const basis = uv => [1, uv[0], uv[1], uv[0] * uv[0], uv[0] * uv[1], uv[1] * uv[1]];
    const solve = nb => {                          // normal equations, Gauss with partial pivoting
      const M = Array.from({ length: nb }, () => new Array(nb + 1).fill(0));
      for (const r of fitPts.values()) {
        const b = basis(r.uv).slice(0, nb), w = hOf(r.P);
        for (let i = 0; i < nb; i++) { for (let j = 0; j < nb; j++) M[i][j] += b[i] * b[j]; M[i][nb] += b[i] * w; }
      }
      for (let c = 0; c < nb; c++) {
        let p = c;
        for (let i = c + 1; i < nb; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
        if (Math.abs(M[p][c]) < 1e-14) return null;
        [M[c], M[p]] = [M[p], M[c]];
        for (let i = 0; i < nb; i++) if (i !== c) {
          const f = M[i][c] / M[c][c];
          for (let j = c; j <= nb; j++) M[i][j] -= f * M[c][j];
        }
      }
      return M.map((row, i) => row[nb] / row[i]);
    };
    const cf = (fitPts.size >= 6 && solve(6)) || (solve(3) || [hOf(ring[0].P), 0, 0]).concat([0, 0, 0]);
    const smoothAt = uv => {
      const [u, v] = uv, w = cf[0] + cf[1] * u + cf[2] * v + cf[3] * u * u + cf[4] * u * v + cf[5] * v * v;
      const wu = cf[1] + 2 * cf[3] * u + cf[4] * v, wv = cf[2] + cf[4] * u + 2 * cf[5] * v;
      const P = [0, 1, 2].map(k => c0[k] + u * t1[k] + v * t2[k] + w * n0[k]);
      const Nn = nrm3([0, 1, 2].map(k => n0[k] - wu * t1[k] - wv * t2[k]));
      return { P, N: Nn };
    };
    // the rim's offset off the smooth surface, at a fraction of the rim (linear between the loop's points)
    const res = ring.map(r => { const q = smoothAt(r.uv).P; return [r.P[0] - q[0], r.P[1] - q[1], r.P[2] - q[2]]; });
    const resAt = fr => {
      const L = fr * Ltot;
      let i = 0;
      while (i < n0r - 1 && cum[i + 1] < L) i++;
      const a = res[i], b = res[(i + 1) % n0r], t = (L - cum[i]) / (cum[i + 1] - cum[i] || 1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    // one spoke per rim point (each ring at the rim's own fractions): the dome is quads, ring to ring, no slivers
    const K = 6, rings = [], fr = ring.map((r, i) => cum[i] / Ltot);
    rings.push(ring.map((r, i) => ({ id: dv(r.P, r.N, r.A, 0), t: fr[i] })));
    for (let k = 1; k < K; k++) {
      const th = k / K * Math.PI / 2, s = Math.cos(th), h = bulge * Math.sin(th), rk = [];
      for (let j = 0; j < n0r; j++) {
        const q = ring[j].uv, uv = [cuv[0] + (q[0] - cuv[0]) * s, cuv[1] + (q[1] - cuv[1]) * s];
        const sm = smoothAt(uv), r = res[j], f = s * s;
        rk.push({ id: dv([sm.P[0] + r[0] * f, sm.P[1] + r[1] * f, sm.P[2] + r[2] * f], sm.N, skinAt(uv).A, h), t: fr[j] });
      }
      rings.push(rk);
    }
    const apex = smoothAt(cuv), apexId = dv(apex.P, apex.N, skinAt(cuv).A, bulge);
    const host = paneRep[0].f, faces = [];
    const tri = (a, b, c) => {
      let v = [a, b, c];
      const nf = cross(sub(V[b], V[a]), sub(V[c], V[a]));
      const nb = [0, 1, 2].map(k => baseN[a][k] + baseN[b][k] + baseN[c][k]);
      if (nf[0] * nb[0] + nf[1] * nb[1] + nf[2] * nb[2] < 0) v = [a, c, b];
      faces.push(v);
    };
    // zip two rings sampled at increasing fractions of the rim
    const zip = (ra, rb) => {
      const na = ra.length, nb = rb.length;
      let i = 0, j = 0;
      while (i < na || j < nb) {
        const ta = i < na ? (i + 1 < na ? ra[i + 1].t : 1) : Infinity;
        const tb = j < nb ? (j + 1 < nb ? rb[j + 1].t : 1) : Infinity;
        if (ta <= tb) { tri(ra[i % na].id, ra[(i + 1) % na].id, rb[j % nb].id); i++; }
        else { tri(ra[i % na].id, rb[(j + 1) % nb].id, rb[j % nb].id); j++; }
      }
    };
    for (let k = 0; k + 1 < rings.length; k++) zip(rings[k], rings[k + 1]);
    const last = rings[rings.length - 1];
    for (let j = 0; j < last.length; j++) tri(last[j].id, last[(j + 1) % last.length].id, apexId);
    // the dome's own normals, area-weighted (it is smooth glass, rim included)
    for (const v of faces) {
      const nf = cross(sub(V[v[1]], V[v[0]]), sub(V[v[2]], V[v[0]]));
      for (const vi of v) { N[vi][0] += nf[0]; N[vi][1] += nf[1]; N[vi][2] += nf[2]; }
    }
    for (const v of faces) for (const vi of v) N[vi] = nrm3(N[vi]);
    for (const v of faces) {
      const nf = Object.assign({}, host, { v, m: paneMat, knife: 1 });
      delete nf.door; delete nf.win;
      F.push(nf);
    }
    stats.blister = faces.length;
  } else for (const { pg, f } of paneRep) {
    // NOT `win`-marked: that tag is the band-window contract (cageCut /
    // cageRims trace quads by it) and a knife pane is n-gons on its own loop
    // ...but the pane KEEPS its part tags (doorKey, cutPart, cutOff): a
    // window cut into a door belongs to the door and travels with it
    // (G14 v2 semantics — doors own their windows)
    const nf = Object.assign({}, f, { v: pg.map(e => paneId(e.rec)), m: paneMat,
                                      knife: 1 });
    delete nf.door; delete nf.win;
    F.push(nf);
  }
  // the hole's skin edges -> which loop they belong to, for the zone
  // tracer: a door's outline must not pick a window inside it up as a
  // second boundary (a window ACROSS the door's edge is different — there
  // the door's outline follows the cut, and the tracer keeps those edges)
  const hole = m.knifeHole || new Map();
  const holeLen = m.knifeHoleLen || [];
  // THE REVEAL WALL: one quad per loop segment, skin outline to pane
  // outline, its own vertices, wound to face the hole's centre.
  m.knifeLoops = m.knifeLoops || [];
  for (const { ring, closed } of loops) {
    if (!closed || ring.length < 3) continue;
    stats.loopPts += ring.length;
    const loopId = holeLen.length;
    holeLen.push(ring.length);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i].id, b = ring[(i + 1) % ring.length].id;
      if (a >= 0 && b >= 0) hole.set(a < b ? a + '_' + b : b + '_' + a, loopId);
    }
    // the part the hole was cut in (its tags ride on the wall and the loop)
    let host = null;
    for (const { pg, f } of paneRep)
      if (pg.some(e => e.rec === ring[0])) { host = f; break; }
    const tags = {};
    if (host) for (const k of ['doorKey', 'cutPart', 'cutOff'])
      if (host[k] != null) tags[k] = host[k];
    let c = [0, 0, 0];
    for (const r of ring) { c[0] += r.P[0]; c[1] += r.P[1]; c[2] += r.P[2]; }
    c = c.map(x => x / ring.length);
    const top = [], bot = [];
    for (const r of ring) {
      top.push(V.length); V.push(r.P.slice()); N.push([0, 0, 0]);
      if (A) A.push(aZ());
      bot.push(V.length);
      V.push(bulge ? r.P.slice() : recess(r));   // (BUBBLE-WINDOWS: a dome has no reveal wall - the ring stays on the skin)
      N.push([0, 0, 0]);
      if (A) A.push(aZ());
    }
    if (wallDepth > 0 || CEIL != null || CP) for (let i = 0; i < ring.length; i++) {
      const j2 = (i + 1) % ring.length, gone = q => Math.hypot(V[top[q]][0] - V[bot[q]][0], V[top[q]][1] - V[bot[q]][1], V[top[q]][2] - V[bot[q]][2]) < 1e-7;
      if ((CEIL != null || CP) && gone(i) && gone(j2)) continue;
      const j = (i + 1) % ring.length;
      let q = [top[i], top[j], bot[j], bot[i]];
      const nq = cross(sub(V[q[2]], V[q[0]]), sub(V[q[3]], V[q[1]]));
      const toC = sub(c, V[q[0]]);
      if (nq[0] * toC[0] + nq[1] * toC[1] + nq[2] * toC[2] < 0)
        q = [top[j], top[i], bot[i], bot[j]];
      F.push(Object.assign({ v: q, m: wallMat, knife: 1 }, tags));
      // wall normals: welded along the loop so a curved reveal shades
      // smooth; at an r = 0 corner they simply average (wall-scale, fine)
      const nn = nrm3(cross(sub(V[q[2]], V[q[0]]), sub(V[q[3]], V[q[1]])));
      for (const vi of q) { N[vi][0] += nn[0]; N[vi][1] += nn[1]; N[vi][2] += nn[2]; }
    }
    for (const vi of top) N[vi] = nrm3(N[vi]);
    for (const vi of bot) N[vi] = nrm3(N[vi]);
    m.knifeLoops.push({ pts: ring.map(r => r.P.slice()), ns: ring.map(r => r.N.slice()),
                        side, win, mat: paneMat, doorKey: tags.doorKey || null,
                        cutOff: tags.cutOff || null });
  }
  const out = Object.assign({}, m, { V, F, N, A, knifeLoops: m.knifeLoops,
                                     knifeHole: hole, knifeHoleLen: holeLen });
  out.knifeStats = (m.knifeStats || []).concat([stats]);
  return out;
}

// ---------------------------------------------------------------------------
// THE BEAD — an octagon tube swept along an on-surface loop, centre ON the
// surface so half is buried (the cageRims idiom). Frames parallel-transported.
// ---------------------------------------------------------------------------
function knifeBead(m, loop, r, mat, sides) {
  sides = sides || 8;
  const V = m.V, F = m.F, N = m.N, A = m.A;
  const P0 = [], N0 = [];
  for (let i = 0; i < loop.pts.length; i++) {
    const p = loop.pts[i], q = P0[P0.length - 1];
    if (q && len3(sub(p, q)) < r * 0.5) continue;
    P0.push(p); N0.push(loop.ns[i]);
  }
  if (P0.length > 2 && len3(sub(P0[0], P0[P0.length - 1])) < r * 0.5) { P0.pop(); N0.pop(); }
  const n = P0.length;
  if (n < 3) return;
  const T = P0.map((p, i) => nrm3(sub(P0[(i + 1) % n], P0[(i - 1 + n) % n])));
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  let U = N0[0];
  { const d = dot(U, T[0]); U = nrm3([U[0] - T[0][0]*d, U[1] - T[0][1]*d, U[2] - T[0][2]*d]); }
  const rings = [];
  for (let i = 0; i < n; i++) {
    if (i) {
      const t = T[i], d = dot(U, t);
      U = nrm3([U[0] - t[0]*d, U[1] - t[1]*d, U[2] - t[2]*d]);
    }
    const W = cross(T[i], U);
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = k / sides * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
      const dir = [U[0]*ca + W[0]*sa, U[1]*ca + W[1]*sa, U[2]*ca + W[2]*sa];
      ring.push(V.length);
      V.push([P0[i][0] + dir[0]*r, P0[i][1] + dir[1]*r, P0[i][2] + dir[2]*r]);
      N.push(dir); if (A) A.push([0, 0, 0, 0]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < n; i++) {
    const a = rings[i], b = rings[(i + 1) % n];
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      F.push({ v: [a[k], b[k], b[k1], a[k1]], m: mat || 'joint', knife: 1 });
    }
  }
}

// ---------------------------------------------------------------------------
// RETRACT G4 - THE WHEEL WELLS cut into a finished sheet from below: each cut {outline (u, v) = (z, -x) CCW, ceil}
// in the sheet's units (the gear layer's CAGE_GEAR.cuts), through the skin's sections only (never the floor, the
// linings or the frames above it), recessed into a box of section `wheelWell`. The skin keeps the normals the sheet
// had (a drawn window's pass fixed them), every other vertex its faces' mean; the knife writes its loops and hole
// maps into the mesh it is handed, so it is handed copies - the sheet stays as it was. Used by the editor's drawn
// fuselage (_cage_ui wellApply, the eye sheet) and by quickshot.
// ---------------------------------------------------------------------------
const WELL_MATS = new Set(['body', 'taper', 'taperPanel', 'waistband', 'floorLoop', 'ceilingLoop', 'pillarWindow',
  'pillarCabin', 'pillarPassenger', 'pillarTail', 'pillarFront', 'pillarTaper', 'boomTube']);
const WELL_FRAME = { n0: [0, -1, 0], c0: [0, 0, 0], t1: [0, 0, 1], t2: [-1, 0, 0] };
// a cut's FITTED CEILING (GM): its height map { x0, z0, d, nx, nz, y } (cage units, row-major by z), bilinear, never
// above the cut's top
function wellCeilFn(c) {
  const H = c.hf;
  return (x, z) => {
    const fx = Math.max(0, Math.min(H.nx - 1.000001, (x - H.x0) / H.d)), fz = Math.max(0, Math.min(H.nz - 1.000001, (z - H.z0) / H.d));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, y = (a, b) => H.y[b * H.nx + a];
    return Math.min(c.ceil, y(i, j) * (1 - tx) * (1 - tz) + y(i + 1, j) * tx * (1 - tz) + y(i, j + 1) * (1 - tx) * tz + y(i + 1, j + 1) * tx * tz);
  };
}
// GR: a SIDE WELL's floor - its height map over its frame's (u, v), the target in its inward coordinate
function wellFloorFn(c) {
  const H = c.hf, F = c.frame;
  return P => {
    const u = P[0] * F.t1[0] + P[1] * F.t1[1] + P[2] * F.t1[2], v = P[0] * F.t2[0] + P[1] * F.t2[1] + P[2] * F.t2[2];
    const fu = Math.max(0, Math.min(H.nu - 1.000001, (u - H.u0) / H.d)), fv = Math.max(0, Math.min(H.nv - 1.000001, (v - H.v0) / H.d));
    const i = Math.floor(fu), j = Math.floor(fv), tu = fu - i, tv = fv - j, e = (a, b) => H.e[b * H.nu + a];
    return Math.min(c.ceil, e(i, j) * (1 - tu) * (1 - tv) + e(i + 1, j) * tu * (1 - tv) + e(i, j + 1) * (1 - tu) * tv + e(i + 1, j + 1) * tu * tv);
  };
}
// GR: THE CARVE IN ANY FRAME (a side well): a face's parts inside the outline's walls (in the frame's (u, v)) and under
// the floor (its inward coordinate at the piece's centroid less than the floor's there) are carved
function knifeCarveF(m, cuts, skip) {
  const V = m.V, N = m.N, A = m.A, F = [];
  const aW = A && A.length ? (A.find(a => a) || [0, 0, 0, 0]).length : 4;
  const mk = (i, j, t) => { const k = V.length; V.push(lerpN(V[i], V[j], t));
    if (N) N.push(nrm3(lerpN(N[i] || [0, 0, 0], N[j] || [0, 0, 0], t)));
    if (A) A.push(A[i] && A[j] ? lerpN(A[i], A[j], t) : (A[i] || A[j] || new Array(aW).fill(0)).slice());
    return k; };
  const pr = cuts.map(c => {
    const Fr = c.frame, o = c.outline, aIn = Fr.n0.map(x => -x);
    const uvOf = p => [p[0] * Fr.t1[0] + p[1] * Fr.t1[1] + p[2] * Fr.t1[2], p[0] * Fr.t2[0] + p[1] * Fr.t2[1] + p[2] * Fr.t2[2]];
    const walls = o.map((a, i) => { const b = o[(i + 1) % o.length]; return p => { const q = uvOf(p); return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); }; });
    return { walls, floor: wellFloorFn(c), aIn };
  });
  let carved = 0;
  const minus = (pg, P) => {
    let rest = pg; const outs = [];
    for (const W of P.walls) {
      const d = rest.map(i => W(V[i]));
      if (d.every(x => x > 1e-9)) continue;
      if (d.every(x => x <= 1e-9)) return null;
      const inn = [], out = [];
      for (let a = 0; a < rest.length; a++) { const b = (a + 1) % rest.length, da = d[a], db = d[b];
        (da > 1e-9 ? inn : out).push(rest[a]);
        if ((da > 1e-9) !== (db > 1e-9)) { const x = mk(rest[a], rest[b], da / (da - db)); inn.push(x); out.push(x); } }
      if (out.length >= 3) outs.push(out);
      rest = inn; if (rest.length < 3) return null;
    }
    // inside the walls: the part in FRONT of the floor carved, the part beyond it kept - the floor taken as the plane of
    // its value at the piece's centroid (a face reaching from behind the floor into the recess is cut at the floor)
    const c = [0, 0, 0]; for (const i of rest) for (let k = 0; k < 3; k++) c[k] += V[i][k] / rest.length;
    // (the floor is fitted, not flat: the deepest of it under the piece, and 8 mm more - nothing shows through)
    let fl = P.floor(c); for (const i of rest) fl = Math.max(fl, P.floor(V[i])); fl += 0.008;
    const e = rest.map(i => V[i][0] * P.aIn[0] + V[i][1] * P.aIn[1] + V[i][2] * P.aIn[2] - fl);
    if (e.every(x => x >= -1e-9)) return outs.length ? outs.concat([rest]) : null;            // wholly beyond: as it was
    if (e.some(x => x > 1e-9)) {
      const keep = [];
      for (let a = 0; a < rest.length; a++) { const b = (a + 1) % rest.length;
        if (e[a] >= -1e-9) keep.push(rest[a]);
        if ((e[a] > 1e-9 && e[b] < -1e-9) || (e[a] < -1e-9 && e[b] > 1e-9)) keep.push(mk(rest[a], rest[b], e[a] / (e[a] - e[b]))); }
      if (keep.length >= 3) outs.push(keep);
    }
    return outs;
  };
  for (const f of m.F) {
    if (f.v.length < 3 || (skip && skip.has(f.m)) || f.m === 'wheelWell') { F.push(f); continue; }
    let pieces = [f.v], changed = false;
    for (const P of pr) { const next = []; for (const pg of pieces) { const r = minus(pg, P); if (r) { changed = true; next.push(...r); } else next.push(pg); } pieces = next; }
    if (!changed) { F.push(f); continue; }
    carved++;
    for (const k of pieces) F.push(Object.assign({}, f, { v: k }));
  }
  const out = Object.assign({}, m, { V, F, N, A });
  out.knifeStats = (m.knifeStats || []).concat([{ carvedSide: carved }]);
  return out;
}
// RETRACT P2 (the user: "Did you build an actual volume after the cut? It should really be a closed section, where we
// first cut, then extrude the cut and close it so it forms a closed volume"): THE WELL, A CLOSED BOX OF ITS OWN - built
// from the cut's OUTLINE, never from the skin's faces it cut (a skin with an opening of its own - a cowl's open belly -
// left the old recessed pane, and so the well, open there; and a pane carried the curved skin's facets up to a flat
// ceiling). The outline sampled finely, each point dropped onto the ORIGINAL skin from below (`skinY`: its lowest
// surface over that plan place); the walls from there straight up to ONE flat ceiling (the lowest of the cut's ceiling
// function over its outline and inside it: a wing's upper skin, a nacelle's top still cap it), their normals level and
// facing the well's axis; the ceiling the outline at that height, facing the opening. The knife then only cuts the
// hole (its pane and its walls are dropped) and carves the structure out of the volume. Returns { V, F (triangles, CCW
// seen from inside the well), N } in the cut's units
function wellBox(c, skinY, inBody, skinTop) {
  const ceilF = c.hf ? wellCeilFn(c) : () => c.ceil, o = c.outline;
  let per = 0; for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const step = Math.max(per / 240, 1e-4), ring = [];
  for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) { const t = k / n; ring.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
  // (u, v) = (z, -x): a plan point's x and z
  const X = q => -q[1], Z = q => q[0];
  let ys = ring.map(q => skinY(X(q), Z(q)));
  if (!ys.some(y => y != null)) return null;
  // (P2, the user: "a hole, plus a little border that extrudes out with no cap"): THE BOX IS THE SKIN'S THAT CARRIES THE
  // CUT - a mesh under less than 40 % of the outline (the wing's centre section, grazed at the root) builds none (its
  // walls, from the nearest hit's height, hung under the wing); and an outline point with no skin under it (aft of a
  // trailing edge) is walked inward till it finds the skin - the wall closes the well there, not in the air behind it
  if (ys.filter(y => y != null).length < 0.4 * ys.length) return null;
  { const r0 = ring.map(q => q.slice()), m = r0.length;
    for (let i = 0; i < m; i++) if (ys[i] == null) {
      const a = r0[(i - 1 + m) % m], b = r0[(i + 1) % m], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv) || 1, iu = -dv / l, iv = du / l;
      for (let k = 1; k <= 80; k++) { const d = k * 0.005, u = r0[i][0] + iu * d, v = r0[i][1] + iv * d, y = skinY(-v, u);
        if (y != null) { ring[i] = [u + iu * 0.003, v + iv * 0.003]; ys[i] = skinY(-ring[i][1], ring[i][0]); if (ys[i] == null) ys[i] = y; break; } } } }
  for (let i = 0; i < ys.length; i++) if (ys[i] == null) {          // (a miss: the nearest answered point's height)
    for (let d = 1; d < ys.length; d++) { const a = ys[(i + d) % ys.length], b = ys[(i - d + ys.length) % ys.length]; if (a != null || b != null) { ys[i] = a != null ? a : b; break; } } }
  let cu = 0, cv = 0; for (const q of ring) { cu += q[0] / ring.length; cv += q[1] / ring.length; }
  let yc = Infinity; for (const q of ring) yc = Math.min(yc, ceilF(X(q), Z(q)));
  for (let k = 1; k <= 4; k++) for (const q of ring) { const f = k / 5, u = cu + (q[0] - cu) * f, v = cv + (q[1] - cv) * f; yc = Math.min(yc, ceilF(-v, u)); }
  yc = Math.max(yc, Math.max(...ys) + 1e-3);
  // (a wing's well where it runs into the body - `inBody`: the body's own box is the one seen there; the wing's ceiling
  // sits 2 mm under it and its walls stay out, so no two surfaces share a place)
  if (inBody && ring.some(q => inBody(X(q), Z(q)))) yc -= 0.002;
  const V = [], N = [], F = [], n = ring.length, nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  // the walls, with a CHAMFER at the opening's lip (P2: "ensure all corners are beveled"): per point three vertices - on
  // the skin, BEV in and BEV up (the chamfer's top), and at the ceiling; the chamfer looks out of the well at 45
  // degrees, the wall level toward the axis
  const BEV = Math.min(0.003, (yc - Math.max(...ys)) * 0.3), WV = 5;
  // (P2: THE SHOULDER - where the skin over an outline point is lower than the ceiling (a nacelle narrowing to its top
  // under the wing: the straight wall stood out of its side), the wall stops 3 mm under that skin and slopes in to a
  // ceiling point drawn inward until the skin over it clears the ceiling; `skinTop`: the skin's highest over a plan place)
  const M = 0.003, inner = [];
  const clearOf = (x, z) => { const lo = skinY(x, z), hi = skinTop ? skinTop(x, z) : null; return lo != null && hi != null && hi - lo > 0.01 ? hi : null; };
  for (let i = 0; i < n; i++) { const a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n], q = ring[i];
    // (the edge turned left - (du, dv) -> (-dv, du) - points inside a CCW outline; in 3D x = -v, z = u)
    const du = b[0] - a[0], dv = b[1] - a[1], ni = nrm(-du, 0, -dv), nc = nrm(ni[0], -1, ni[2]);
    const x = X(q), z = Z(q), y0 = ys[i] - 0.0005;
    let s = 0, need = false, top0 = skinTop ? clearOf(x + ni[0] * BEV, z + ni[2] * BEV) : null;
    if (skinTop) for (let k = 0; k <= 75; k++) { const d = BEV + k * 0.002, t = clearOf(x + ni[0] * d, z + ni[2] * d);
      if (t == null) { if (!need && k >= 5) break; continue; }
      if (t >= yc + M) { s = need ? d - BEV : 0; break; }
      need = true; }
    if (!need) s = 0;
    const ysh = s > 0 ? Math.max(y0 + BEV + 0.001, Math.min(yc, (top0 != null ? top0 : y0) - M)) : yc;
    const xb = x + ni[0] * BEV, zb = z + ni[2] * BEV, h = yc - ysh, ns = s > 0 ? nrm(ni[0] * h, -s, ni[2] * h) : ni;
    V.push([x, y0, z], [xb, y0 + BEV, zb], [xb, y0 + BEV, zb], [xb, ysh, zb], [xb + ni[0] * s, yc, zb + ni[2] * s]);
    N.push(nc, nc, ni, s > 0 ? ns : ni, s > 0 ? ns : ni); inner.push([xb + ni[0] * s, zb + ni[2] * s]); }
  const cu2 = cu, cv2 = cv;
  // (each quad wound to face the well's axis and the opening - the knife's own test, against the axis point)
  const faces = (a, b, c) => { const A = V[a], B = V[b], C = V[c], u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
    return nx * (-cv2 - A[0]) + nz * (cu2 - A[2]) - ny * 1e-3 > 0; };
  for (let i = 0; i < n; i++) { const j = (i + 1) % n;
    const mx = (V[WV * i][0] + V[WV * j][0]) / 2, mz = (V[WV * i][2] + V[WV * j][2]) / 2;
    if (inBody && inBody(mx, mz)) continue;
    for (const [lo, hi] of [[0, 1], [2, 3], [3, 4]]) { if (lo === 3 && V[WV * i + 3][1] === yc && V[WV * j + 3][1] === yc) continue;   // (no shoulder)
      const b0 = WV * i + lo, t0 = WV * i + hi, b1 = WV * j + lo, t1 = WV * j + hi;
      if (faces(b0, b1, t1)) F.push([b0, b1, t1], [b0, t1, t0]); else F.push([b0, t1, b1], [b0, t0, t1]); } }
  // the ceiling: the outline at its height, a fan from the axis, facing down (the opening)
  const c0 = V.length; V.push([-cv, yc, cu]); N.push([0, -1, 0]);
  for (let i = 0; i < n; i++) { V.push([inner[i][0], yc, inner[i][1]]); N.push([0, -1, 0]); }
  for (let i = 0; i < n; i++) { const a = c0 + 1 + i, b = c0 + 1 + (i + 1) % n;
    // (seen from below the fan must turn the way that faces down: check with the first triangle)
    const A = V[c0], B = V[a], C = V[b], ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);   // (the normal's y)
    F.push(ny < 0 ? [c0, a, b] : [c0, b, a]); }
  return { V, F, N, yc };
}
// the original skin's lowest surface over a plan place (x, z), from its triangles (a bucket grid over the plan); `hi`:
// its highest
function skinYOf(tris, cell, hi) {
  const g = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
  for (const t of tris) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of t) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
      const k = key(i, j); if (!g.has(k)) g.set(k, []); g.get(k).push(t); } }
  return (x, z) => { const ts = g.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!ts) return null; let best = null;
    for (const [A, B, C] of ts) { const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(d) < 1e-14) continue;
      const l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d, l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * A[1] + l2 * B[1] + l3 * C[1]; if (best == null || (hi ? y > best : y < best)) best = y; }
    return best; };
}
function knifeWells(sh, cuts, sides) {
  // (one list may hold both: a cut with its own frame is a side well)
  if (sides === undefined && cuts) { sides = cuts.filter(c => c.frame); cuts = cuts.filter(c => !c.frame); }
  if (!sh || ((!cuts || !cuts.length) && (!sides || !sides.length))) return sh;
  cuts = cuts || [];
  const N = knifeNormals(sh);
  if (sh.N) for (let i = 0; i < sh.N.length && i < N.length; i++) { const n = sh.N[i]; if (n && (n[0] || n[1] || n[2])) N[i] = n; }
  let m = Object.assign({}, sh, { N, knifeLoops: (sh.knifeLoops || []).slice(), knifeHole: new Map(sh.knifeHole || []),
                                  knifeHoleLen: (sh.knifeHoleLen || []).slice(), knifeStats: (sh.knifeStats || []).slice() });
  for (const c of cuts)
    m = knifeCut(m, { well: (c.units || []).join('') }, { frame: WELL_FRAME, outline: c.outline, ceil: c.hf ? wellCeilFn(c) : c.ceil,
                                                         mats: WELL_MATS, paneMat: 'wheelWell', wallMat: 'wheelWell' });
  if (cuts.length) m = knifeCarve(m, cuts);
  // P2: the knife's panes and walls dropped (the hole stays); each cut's own closed box, off the sheet's ORIGINAL skin
  if (cuts.length) {
    const tris = []; for (const f of sh.F) if (WELL_MATS.has(f.m) && f.v.length >= 3) for (let i = 1; i + 1 < f.v.length; i++) tris.push([sh.V[f.v[0]], sh.V[f.v[i]], sh.V[f.v[i + 1]]]);
    const skinY = skinYOf(tris, 0.1), skinTop = skinYOf(tris, 0.1, true);
    const V = m.V.slice(), N = m.N.slice(), A = m.A ? m.A.slice() : null, aw = A && A.length ? (A.find(a => a) || [0, 0, 0, 0]).length : 4;
    const F = m.F.filter(f => f.m !== 'wheelWell');
    for (const c of cuts) { const b = wellBox(c, skinY, null, skinTop); if (!b) continue; const base = V.length;
      for (let i = 0; i < b.V.length; i++) { V.push(b.V[i]); N.push(b.N[i]); if (A) A.push(new Array(aw).fill(0)); }
      for (const t of b.F) F.push({ v: t.map(i => i + base), m: 'wheelWell', knife: 1 }); }
    m = Object.assign({}, m, { V, N, A, F });
  }
  // GR: THE SIDE WELLS (the Catalina's recesses): the knife looking at the side, the recess inward to the fitted floor
  (sides || []).forEach((c, si) => {
    const was = new Set(m.F);
    m = knifeCut(m, { well: (c.units || []).join('') }, { frame: c.frame, outline: c.outline, ceilP: wellFloorFn(c),
                                                         mats: WELL_MATS, paneMat: 'wheelWell', wallMat: 'wheelWell' });
    for (const f of m.F) if (!was.has(f) && f.knife && f.m === 'wheelWell') f.sideCut = si; });
  // P2 (the folding knee's keyhole - its round recess and the slot over it, two cuts of one `group` on one floor): the
  // walls BETWEEN them dropped - a wall of one standing inside the other's outline (grown a hair) - one opening
  if (sides && sides.some(c => c.group)) {
    const inO = (o, q, e) => { for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) < -e * L) return false; } return true; };
    m = Object.assign({}, m, { F: m.F.filter(f => {
      const c = f.sideCut != null ? sides[f.sideCut] : null; if (!c || !c.group || f.v.length !== 4) return true;
      const Fr = c.frame, P = [0, 0, 0]; for (const i of f.v) for (let k = 0; k < 3; k++) P[k] += m.V[i][k] / 4;
      // (a wall: its face edge-on to the frame's view)
      const A = m.V[f.v[0]], B = m.V[f.v[1]], Cc = m.V[f.v[2]], u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
      const nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nl = Math.hypot(nn[0], nn[1], nn[2]) || 1;
      if (Math.abs(nn[0] * Fr.n0[0] + nn[1] * Fr.n0[1] + nn[2] * Fr.n0[2]) / nl > 0.5) return true;
      const q = [P[0] * Fr.t1[0] + P[1] * Fr.t1[1] + P[2] * Fr.t1[2], P[0] * Fr.t2[0] + P[1] * Fr.t2[1] + P[2] * Fr.t2[2]];
      return !sides.some((d, j) => j !== f.sideCut && d.group === c.group && d.side === c.side && (() => {
        let u0 = Infinity, u1 = -Infinity; for (const p of d.outline) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); }
        return inO(d.outline, q, (u1 - u0) * 0.01); })()); }) });
  }
  if (sides && sides.length) m = knifeCarveF(m, sides, WELL_MATS);
  return m;
}
// THE WELL IS EMPTY: what the sheet built inside a well's volume that is not its skin (the frames, the liners, the
// bulkheads below the floor) is carved out of it - each such face clipped against the well's prism (its outline's
// vertical planes and its ceiling) and only the parts outside kept, as convex pieces (a polygon minus a convex prism:
// the part outside each plane in turn, the rest carried to the next). Exact; the pieces' new points are their own
// (interior structure, where a hairline is never seen), their normals and fields lerped
function knifeCarve(m, cuts, skip) {
  // the prism's WALLS (the outline's vertical planes) clip exactly; a piece inside them is carved only when it lies
  // under the cut's ceiling (GM: the fitted one, at the piece's centroid) - the structure over a shallow part stays
  skip = skip === undefined ? WELL_MATS : skip;
  const prisms = cuts.map(c => {
    const o = c.outline, pl = [];
    // (u, v) = (z, -x): inside an edge a->b (CCW) is its left, sdist > 0 - linear in the point: d = A x + C z + D
    for (let i = 0; i < o.length; i++) {
      const a = o[i], b = o[(i + 1) % o.length], du = b[0] - a[0], dv = b[1] - a[1];
      pl.push({ A: du, B: 0, C: -dv, D: -du * a[1] + dv * a[0] });     // du*(-x - a.v) - dv*(z - a.u)
    }
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of o) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
    return { pl, z0: u0, z1: u1, x0: -v1, x1: -v0, ceil: c.ceil, at: c.hf ? wellCeilFn(c) : () => c.ceil };
  });
  const V = m.V, N = m.N, A = m.A, F = [];
  const aW = A && A.length ? (A.find(a => a) || [0, 0, 0, 0]).length : 4;
  const dOf = (P, p) => P.A * p[0] + P.B * p[1] + P.C * p[2] + P.D;
  const mk = (i, j, t) => {
    const k = V.length;
    V.push(lerpN(V[i], V[j], t));
    if (N) N.push(nrm3(lerpN(N[i] || [0, 0, 0], N[j] || [0, 0, 0], t)));
    if (A) A.push(A[i] && A[j] ? lerpN(A[i], A[j], t) : (A[i] || A[j] || new Array(aW).fill(0)).slice());
    return k;
  };
  let carved = 0;
  // one polygon against one prism: null when no part of it is carved (it stays as it was), else the pieces kept
  const minus = (pg, pr) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of pg) { const p = V[i]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    if (x1 < pr.x0 || x0 > pr.x1 || z1 < pr.z0 || z0 > pr.z1 || y0 >= pr.ceil) return null;
    let rest = pg;
    const outs = [];
    for (const P of pr.pl) {
      const d = rest.map(i => dOf(P, V[i]));
      if (d.every(x => x > 1e-9)) continue;                  // inside this wall: on to the next, whole
      if (d.every(x => x <= 1e-9)) return null;              // outside it: no part of the polygon is in the prism
      const inn = [], out = [];
      for (let a = 0; a < rest.length; a++) {
        const b = (a + 1) % rest.length, da = d[a], db = d[b];
        (da > 1e-9 ? inn : out).push(rest[a]);
        if ((da > 1e-9) !== (db > 1e-9)) { const x = mk(rest[a], rest[b], da / (da - db)); inn.push(x); out.push(x); }
      }
      if (out.length >= 3) outs.push(out);
      rest = inn;
      if (rest.length < 3) return null;
    }
    // inside every wall: the part UNDER the ceiling carved, the part over it kept - the ceiling taken as the plane of its
    // height at the piece's centroid (a face reaching from over the ceiling down into the well is cut at it)
    let cx = 0, cy = 0, cz = 0;
    for (const i of rest) { cx += V[i][0]; cy += V[i][1]; cz += V[i][2]; }
    cx /= rest.length; cy /= rest.length; cz /= rest.length;
    let ch = pr.at(cx, cz); for (const i of rest) ch = Math.max(ch, pr.at(V[i][0], V[i][2])); ch += 0.008;   // (the highest of it, 8 mm over)
    const e = rest.map(i => V[i][1] - ch);
    if (e.every(x => x >= -1e-9)) return null;                    // wholly over the ceiling: the face is left whole
    if (e.some(x => x > 1e-9)) {
      const keep = [];
      for (let a = 0; a < rest.length; a++) { const b = (a + 1) % rest.length;
        if (e[a] >= -1e-9) keep.push(rest[a]);
        if ((e[a] > 1e-9 && e[b] < -1e-9) || (e[a] < -1e-9 && e[b] > 1e-9)) keep.push(mk(rest[a], rest[b], e[a] / (e[a] - e[b]))); }
      if (keep.length >= 3) outs.push(keep);
    }
    return outs;
  };
  for (const f of m.F) {
    if (f.v.length < 3 || (skip && skip.has(f.m)) || f.m === 'wheelWell') { F.push(f); continue; }
    let pieces = [f.v], changed = false;
    for (const pr of prisms) {
      const next = [];
      for (const pg of pieces) { const r = minus(pg, pr); if (r) { changed = true; next.push(...r); } else next.push(pg); }
      pieces = next;
    }
    if (!changed) { F.push(f); continue; }
    carved++;
    for (const k of pieces) F.push(Object.assign({}, f, { v: k }));
  }
  const out = Object.assign({}, m, { V, F, N, A });
  out.knifeStats = (m.knifeStats || []).concat([{ carved }]);
  return out;
}

// G5: A WING'S SKIN CUT THE SAME WAY - a THREE geometry (the wing layer's meshes, the layer's metres) to the knife's mesh
// (one section, `skin`; every attribute but the position and the normal packed into the field, lerped like it), cut
// from below by the cuts (metres), carved (every face: the wing has no structure of its own to keep), and back: the
// skin's geometry and the well's (walls and ceiling, section wheelWell) apart, so each keeps its own material
function knifeWellsGeo(THREE, geo, cuts, tops, inBody) {
  const P = geo.attributes.position, Nm = geo.attributes.normal, nv = P.count;
  const extra = Object.keys(geo.attributes).filter(k => k !== 'position' && k !== 'normal');
  const V = [], N = [], A = [];
  for (let i = 0; i < nv; i++) {
    V.push([P.getX(i), P.getY(i), P.getZ(i)]);
    N.push(Nm ? [Nm.getX(i), Nm.getY(i), Nm.getZ(i)] : [0, 0, 0]);
    const a = [];
    for (const k of extra) { const at = geo.attributes[k]; for (let c = 0; c < at.itemSize; c++) a.push(at.array[i * at.itemSize + c]); }
    A.push(a);
  }
  const F = [], ix = geo.index ? geo.index.array : null, nt = (ix ? ix.length : nv) / 3;
  for (let t = 0; t < nt; t++) F.push({ v: ix ? [ix[t * 3], ix[t * 3 + 1], ix[t * 3 + 2]] : [t * 3, t * 3 + 1, t * 3 + 2], m: 'skin' });
  let m = { V, F, N, A: extra.length ? A : null, knifeLoops: [], knifeHole: new Map(), knifeHoleLen: [] };
  for (const c of cuts)
    m = knifeCut(m, { well: (c.units || []).join('') }, { frame: WELL_FRAME, outline: c.outline, ceil: c.hf ? wellCeilFn(c) : c.ceil,
                                                         mats: new Set(['skin']), paneMat: 'wheelWell', wallMat: 'wheelWell', yMax: c.ceil + 0.01 });
  m = knifeCarve(m, cuts, null);
  // GR R4: THE HOLES WHERE A STOWED WHEEL STANDS PROUD of the upper skin - the knife from ABOVE (its frame's n0 up, the
  // outline in (z, x)), the inside taken away: no pane, no wall
  for (const t of (tops || []))
    m = knifeCut(m, { pierce: (t.units || []).join('') }, { frame: { n0: [0, 1, 0], c0: [0, 0, 0], t1: [0, 0, 1], t2: [1, 0, 0] },
                                                             outline: t.outline, depth: 0, mats: new Set(['skin']), paneMat: '__drop', wallMat: '__drop' });
  if (tops && tops.length) m = Object.assign({}, m, { F: m.F.filter(f => f.m !== '__drop') });
  const build = keep => {
    const fs = m.F.filter(keep);
    if (!fs.length) return null;
    const pos = new Float32Array(m.V.length * 3), nor = new Float32Array(m.V.length * 3);
    m.V.forEach((v, i) => { pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]; const n = m.N[i] || [0, 1, 0]; nor[i * 3] = n[0]; nor[i * 3 + 1] = n[1]; nor[i * 3 + 2] = n[2]; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    let off = 0;
    for (const k of extra) {
      const at = geo.attributes[k], w = at.itemSize, arr = new (at.array.constructor)(m.V.length * w);
      m.V.forEach((_, i) => { const a = m.A && m.A[i]; for (let c = 0; c < w; c++) arr[i * w + c] = a ? a[off + c] || 0 : 0; });
      g.setAttribute(k, new THREE.BufferAttribute(arr, w, at.normalized)); off += w;
    }
    const idx = [];
    for (const f of fs) for (let i = 1; i + 1 < f.v.length; i++) idx.push(f.v[0], f.v[i], f.v[i + 1]);
    g.setIndex(idx);
    return g;
  };
  const st = m.knifeStats || [];
  // P2: the well, each cut's own closed box off the ORIGINAL skin (the knife's panes and walls are not it)
  const tris = []; for (let t = 0; t < nt; t++) { const q = ix ? [ix[t * 3], ix[t * 3 + 1], ix[t * 3 + 2]] : [t * 3, t * 3 + 1, t * 3 + 2]; tris.push(q.map(i => V[i])); }
  const skinY = skinYOf(tris, 0.1), skinTop = skinYOf(tris, 0.1, true), bv = [], bn = [], bi = [];
  for (const c of cuts) { const b = wellBox(c, skinY, inBody || null, skinTop); if (!b) continue; const base = bv.length / 3;
    for (let i = 0; i < b.V.length; i++) { bv.push(...b.V[i]); bn.push(...b.N[i]); }
    for (const t of b.F) bi.push(t[0] + base, t[1] + base, t[2] + base); }
  let well = null;
  if (bi.length) { well = new THREE.BufferGeometry();
    well.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bv), 3));
    well.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bn), 3));
    well.setIndex(bi); }
  return { skin: build(f => f.m !== 'wheelWell'), well, stats: st };
}

// GR: A MESH CUT IN THE LAYER'S FRAME (a nacelle's skin sits inside the cowl unit's own frame): its geometry carried
// to the layer by `rel` (a THREE.Matrix4: the mesh's matrix relative to the layer's scene), cut by knifeWellsGeo, and
// both results carried back; an inner twin keeps the skin only (its well is the skin's)
function knifeWellsMesh(THREE, geo, rel, cuts, twin) {
  const g = geo.clone(); g.applyMatrix4(rel);
  const r = knifeWellsGeo(THREE, g, cuts, null);
  g.dispose();
  const back = new THREE.Matrix4().copy(rel).invert();
  if (r.skin) r.skin.applyMatrix4(back);
  if (r.well) { if (twin) { r.well.dispose(); r.well = null; } else r.well.applyMatrix4(back); }
  return r;
}
const API = { wellBox, skinYOf, knifeWellsMesh, knifeOutline, knifeNormals, knifeCut, knifeBead, earClip, knifeWells, knifeWellsGeo, knifeCarve, knifeCarveF, wellCeilFn, wellFloorFn };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.KNIFE_GEN = API;
})();
