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
  } else {
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
  const paneMat = opt.paneMat || 'pasengerWindow';
  const wallMat = opt.wallMat || 'reveal';
  const V = m.V.map(p => p.slice()), F = [];
  const A = m.A ? m.A.slice() : null;
  const N = (m.N || knifeNormals(m)).map(n => n.slice());
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
  let n0 = [side, 0, 0], c0 = [0, win.y, win.z];
  {
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
  const t1 = nrm3([-n0[0] * dz, -n0[1] * dz, 1 - n0[2] * dz]);
  const t2 = cross(n0, t1);
  const uvOf = p => {
    const d = [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
    return [d[0]*t1[0] + d[1]*t1[1] + d[2]*t1[2],
            d[0]*t2[0] + d[1]*t2[1] + d[2]*t2[2]];
  };
  const outline = knifeOutline(Object.assign({}, win, { z: 0, y: 0 }));
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
      if (A) A.push(r.A ? r.A.slice() : [0, 0, 0, 0]);
    }
    return r.id;
  };
  const paneId = r => {
    if (r.pid < 0) {
      r.pid = V.length;
      V.push([r.P[0] - r.N[0] * depth, r.P[1] - r.N[1] * depth,
              r.P[2] - r.N[2] * depth]);
      N.push(r.N.slice());
      if (A) A.push(r.A ? r.A.slice() : [0, 0, 0, 0]);
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
  for (const f of m.F) {
    if (f.v.length < 3 || f.knife || (opt.mats && !opt.mats.has(f.m)) ||
        f.m === 'joint' || f.m === 'doorSeal') { F.push(f); continue; }
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
    if (nl < 1e-12 || facing < nMin) {
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
  for (const { pg, f } of paneRep) {
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
      if (A) A.push([0, 0, 0, 0]);
      bot.push(V.length);
      V.push([r.P[0] - r.N[0] * depth, r.P[1] - r.N[1] * depth,
              r.P[2] - r.N[2] * depth]);
      N.push([0, 0, 0]);
      if (A) A.push([0, 0, 0, 0]);
    }
    if (depth > 0) for (let i = 0; i < ring.length; i++) {
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

const API = { knifeOutline, knifeNormals, knifeCut, knifeBead, earClip };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.KNIFE_GEN = API;
})();
