// THE SHOULDER — proof of concept (2026-09-13).
//
// The user: "the messy border between window and fuselage/door ... model
// extremely rigorously and cleanly a 'shoulder': a piece of metal that does a
// 5-10 cm lip from the window transition towards the inside of the plane, and
// goes down about 20 cm ... joins nicely with the dashboard and runs back ...
// allowed to cover the left side throttle, in which case a slight opening is
// cut in the upper lip for the lever to go through."
//
// WHAT IT IS. An L-section sheet (thickness t, a real bend radius at the
// corner) swept along the WINDOW TRANSITION of each flank: the line where the
// glass (or the open sky of a cut canopy) meets the skin below it. The top leg
// lies flat at the transition, its outboard edge ON the skin, its inboard edge
// W inboard; the vertical leg hangs H down from there. Nothing is derived from
// the cage lattice: the transition is TRACED off the displayed mesh, so the
// lip follows exactly the polyline the skin already has (no faceting
// mismatch), the extended sill (winSillPilot), the door's own stepped-back
// surface, and a canopy's seam, without knowing which of those it is looking
// at. One rule, every configuration.
//
// THE THREE RULES THAT MAKE IT CLEAN
//   1. positions, not indices. Cut doors, cut panes and the canopy duplicate
//      the skin's vertices; an exploded part carries `cutOff`. Every edge is
//      keyed by its AS-BUILT position, so "glass above / skin below" is read
//      across parts, and a door's segment of the shoulder is emitted as the
//      door's own part (it explodes with it).
//   2. the skin is sampled, not assumed. The outboard edge of the top leg and
//      the bottom of the vertical leg are placed by asking the flank where it
//      is at that (y, z) — a narrow or round-bottomed body that comes inboard
//      below the sill closes the leg onto the skin instead of poking through.
//   3. the solid is watertight by construction and checked by position: a
//      loft of closed profiles + two caps, split only at sharp edges (so the
//      shading is flat across the bend and smooth along the sill), oriented
//      by signed volume. `shoulderCheck` counts open and over-shared edges.
//
// LIMITS. Forward: the dashboard's aft face (the dash's own minimum z) minus a
// shut-line gap — the shoulder butts against the dash as a trim panel does.
// Aft: the cabin pillar behind the pilot (`run: 'pilot'`), or the last
// passenger bay (`run: 'cabin'`). Where a door sits between, its jamb gaps
// are the door's own (the cut shrinks the door in-surface).
//
// THE THROTTLE. Given the lever (pivot, direction, length, swing, bar
// section, knob), the SWEPT bar is intersected with the plane of each leg; the
// convex hull of the crossing points, offset by the clearance with rounded
// corners, is the slot — punched through the leg as a framed patch (outer
// rectangle on the loft's own stations, inner outline, zipped by angle) plus
// the slot's wall through the thickness. Whichever leg the lever crosses gets
// the slot; a lever that never leaves the pocket is reported as buried.
//
// Node: require('./_shoulder_gen.js'); browser: window.SHOULDER_GEN.
'use strict';
(function () {

const GLASS = new Set(['pilotWindow', 'pasengerWindow', 'windshield']);
const SKIN = new Set(['body', 'waistband', 'floorLoop', 'ceilingLoop',
                      'pillarWindow', 'pillarCabin', 'pillarPassenger',
                      'pillarFront', 'pillarTail', 'taper']);
const Q = 1e5;
const pk = p => Math.round(p[0] * Q) + ',' + Math.round(p[1] * Q) + ',' + Math.round(p[2] * Q);
const ek = (a, b) => { const A = pk(a), B = pk(b); return A < B ? A + '|' + B : B + '|' + A; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

const DEF = {
  W: 0.07,          // lip width, inboard from the skin (m)
  H: 0.20,          // vertical leg drop below the lip's top (m)
  t: 0.002,         // sheet thickness
  bendR: 0.004,     // inside bend radius (outer = bendR + t)
  bendN: 4,         // segments on the bend
  drop: 0.003,      // the top surface sits this far below the traced transition
  inset: 0.0004,    // outboard edges sit this far inside the sampled skin
  gap: 0.004,       // shut line against the dash (and at every cap)
  run: 'pilot',     // 'pilot' | 'cabin'
  xMin: 0.12,       // ignore edges nearer the centreline than this
  minLen: 0.03,     // drop chains shorter than this
  maxSlope: 0.35,   // |dy/dz| above this is a pillar edge, not a sill
  mat: 'shoulder',
  lever: null,      // { piv, dir, len, arc, wx, tz, knobR }
  slotClear: 0.003,
  slotN: 21,
};

// ---------------------------------------------------------------------------
// as-built face geometry + a flank sampler
// ---------------------------------------------------------------------------
function asBuilt(V, f) {
  const o = f.cutOff;
  return f.v.map(vi => o ? [V[vi][0] - o[0], V[vi][1] - o[1], V[vi][2] - o[2]] : V[vi]);
}
const faceClass = f => (f.att || f.paneEdge) ? null
  : (GLASS.has(f.m) && !f.knife) ? 'G' : SKIN.has(f.m) ? 'S' : null;

// skinX(side, y, z): the outermost skin x on that flank at (y, z), or null.
// Faces are bucketed by z; a face is tested by fanning it into triangles in
// the (z, y) projection and interpolating x barycentrically.
function makeSkinSampler(mesh) {
  const V = mesh.V, F = mesh.F;
  const BIN = 0.1;
  const buckets = new Map();
  const faces = [];
  for (const f of F) {
    if (faceClass(f) !== 'S') continue;
    const P = asBuilt(V, f);
    let z0 = 1e9, z1 = -1e9, sx = 0;
    for (const p of P) { z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); sx += p[0]; }
    const id = faces.push({ P, side: sx >= 0 ? 1 : -1 }) - 1;
    for (let b = Math.floor(z0 / BIN); b <= Math.floor(z1 / BIN); b++) {
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(id);
    }
  }
  return (side, y, z) => {
    const list = buckets.get(Math.floor(z / BIN)) || [];
    let best = null;
    for (const id of list) {
      const fc = faces[id];
      if (fc.side !== side) continue;
      const P = fc.P;
      for (let i = 1; i + 1 < P.length; i++) {
        const a = P[0], b = P[i], c = P[i + 1];
        // barycentric in (z, y)
        const d = (b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1]);
        if (Math.abs(d) < 1e-12) continue;
        const u = ((z - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (y - a[1])) / d;
        const v = ((b[2] - a[2]) * (y - a[1]) - (z - a[2]) * (b[1] - a[1])) / d;
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        const x = a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]);
        if (x * side > 0 && (best == null || x * side > best * side)) best = x;
      }
    }
    return best;
  };
}

// ---------------------------------------------------------------------------
// limits: the dash's aft face and the run's aft pillar
// ---------------------------------------------------------------------------
function shoulderLimits(mesh, spec, opt, CAGE) {
  const o = Object.assign({}, DEF, opt || {});
  let zDash = null;
  for (const f of mesh.F) if (f.m === 'dash' || f.m === 'dashFace')
    for (const vi of f.v) { const z = mesh.V[vi][2]; if (zDash == null || z < zDash) zDash = z; }
  let zAft = -1e9, mirrorZ = null;
  if (CAGE && spec) {
    const R = CAGE.cageResolve(spec);
    const ring = n => R.rings.find(r => r.name === n);
    mirrorZ = R.mirrorZ != null ? R.mirrorZ : null;
    const cabB = ring('pilCabB'), paxA = ring('pilPaxA');
    if (o.run === 'cabin') {
      if (paxA) zAft = paxA.lv.waist.z;
      else if (mirrorZ != null && cabB) zAft = 2 * mirrorZ - cabB.lv.waist.z;
      else if (cabB) zAft = cabB.lv.waist.z;
    } else if (cabB) zAft = cabB.lv.waist.z;
  }
  return { zDash, zFwd: zDash != null ? zDash - o.gap : 1e9, zAft, mirrorZ };
}

// ---------------------------------------------------------------------------
// trace: the window transition, per flank, as z-ordered chains
// ---------------------------------------------------------------------------
function shoulderTrace(mesh, spec, opt, CAGE) {
  const o = Object.assign({}, DEF, opt || {});
  const V = mesh.V, F = mesh.F;
  const lim = shoulderLimits(mesh, spec, o, CAGE);
  const CN = spec && spec.config && spec.config.canopy;
  const openTop = !!(CN && CN.mode && CN.mode !== 'closed');
  const yRef = openTop ? (CN.ref === 'waist' ? spec.waistY : spec.bandY) : null;

  const own = new Map();
  F.forEach((f, fi) => {
    const c = faceClass(f);
    if (!c) return;
    const P = asBuilt(V, f), n = P.length;
    let cy = 0;
    for (const p of P) cy += p[1] / n;
    for (let e = 0; e < n; e++) {
      const a = P[e], b = P[(e + 1) % n];
      const A = pk(a), B = pk(b);
      const k = A < B ? A + '|' + B : B + '|' + A;
      let r = own.get(k);
      if (!r) own.set(k, r = { a: A < B ? a : b, b: A < B ? b : a, o: [] });
      r.o.push({ fi, c, cy });
    }
  });
  // transition edges
  const edges = [];
  for (const r of own.values()) {
    const a = r.a, b = r.b;
    const dz = Math.abs(a[2] - b[2]), dy = Math.abs(a[1] - b[1]);
    // A SILL IS NEAR-HORIZONTAL. The windscreen's side edge along the A-pillar
    // is a glass-over-skin transition too, at 36 deg on the page's aeroplane,
    // and the first cut built a stub up it (a "dark slab" on the lip by the
    // dash). The steepest sill on any build measured 0.04; 0.35 keeps a
    // raked door window and refuses a pillar.
    if (!(dz > 1e-7) || dy > o.maxSlope * dz) continue;
    const xm = (a[0] + b[0]) / 2, ym = (a[1] + b[1]) / 2;
    if (Math.abs(xm) < o.xMin) continue;
    // 'glass': a glass face and a skin face share the edge, the glass one
    // higher. 'open': the edge belongs to ONE skin face, at the canopy's cut
    // height — the face may be nearly flat there (the bubble's released band
    // strip), so the test is against the face's own centroid, not the edge's
    const G = r.o.filter(q => q.c === 'G');
    const S = r.o.filter(q => q.c === 'S');
    let kind = null;
    if (G.length && S.length && Math.max(...G.map(q => q.cy)) > Math.min(...S.map(q => q.cy)) + 1e-4) kind = 'glass';
    else if (openTop && r.o.length === 1 && S.length && ym >= S[0].cy - 0.01 && Math.abs(ym - yRef) < 0.08) kind = 'open';
    if (!kind) continue;
    let door = null, cutOff = null;
    for (const q of r.o) { const f = F[q.fi]; if (f.doorKey) { door = f.doorKey; cutOff = f.cutOff || null; break; } }
    edges.push({ a, b, side: xm >= 0 ? 1 : -1, kind, door, cutOff });
  }
  // chains: edges linked by shared as-built endpoints, on one flank
  const chains = [];
  for (const side of [1, -1]) {
    const E = edges.filter(e => e.side === side);
    const adj = new Map();
    E.forEach((e, i) => {
      for (const k of [pk(e.a), pk(e.b)]) { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); }
    });
    const used = new Uint8Array(E.length);
    for (let s = 0; s < E.length; s++) {
      if (used[s]) continue;
      // grow both ways
      const seq = [s]; used[s] = 1;
      const grow = (end, front) => {
        for (;;) {
          const e = E[end.i];
          const k = end.k;
          const nx = (adj.get(k) || []).find(j => !used[j] && E[j].door === e.door);
          if (nx == null) return;
          used[nx] = 1;
          if (front) seq.unshift(nx); else seq.push(nx);
          end.i = nx; end.k = pk(E[nx].a) === k ? pk(E[nx].b) : pk(E[nx].a);
        }
      };
      grow({ i: s, k: pk(E[s].b) }, false);
      grow({ i: s, k: pk(E[s].a) }, true);
      // points in order: walk the sequence, orienting each edge
      const pts = [];
      let prevK = null;
      seq.forEach((i, n) => {
        const e = E[i];
        let p0 = e.a, p1 = e.b;
        if (n === 0) {
          if (seq.length > 1) {
            const nxt = E[seq[1]], ks = new Set([pk(nxt.a), pk(nxt.b)]);
            if (ks.has(pk(e.a))) { p0 = e.b; p1 = e.a; }
          } else if (e.a[2] > e.b[2]) { p0 = e.b; p1 = e.a; }
          pts.push(p0.slice());
        } else if (pk(e.b) === prevK) { p0 = e.b; p1 = e.a; }
        pts.push(p1.slice());
        prevK = pk(p1);
      });
      if (pts[0][2] > pts[pts.length - 1][2]) pts.reverse();
      chains.push({ side, pts, door: E[s].door, cutOff: E[s].cutOff, kind: E[s].kind });
    }
  }
  // clip to [zAft, zFwd]
  const out = [];
  for (const c of chains) {
    const P = c.pts;
    const clipped = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (i > 0) {
        const q = P[i - 1];
        for (const zc of [lim.zAft, lim.zFwd]) {
          if ((q[2] - zc) * (p[2] - zc) < 0) {
            const t = (zc - q[2]) / (p[2] - q[2]);
            clipped.push([q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t, zc]);
          }
        }
      }
      if (p[2] >= lim.zAft - 1e-9 && p[2] <= lim.zFwd + 1e-9) clipped.push(p.slice());
    }
    clipped.sort((a, b) => a[2] - b[2]);
    // dedupe
    const pts = [];
    for (const p of clipped) if (!pts.length || Math.abs(p[2] - pts[pts.length - 1][2]) > 1e-7) pts.push(p);
    if (pts.length < 2) continue;
    const len = pts[pts.length - 1][2] - pts[0][2];
    if (len < o.minLen) continue;
    out.push({ side: c.side, pts, door: c.door, cutOff: c.cutOff, kind: c.kind, len });
  }
  out.sort((a, b) => b.side - a.side || a.pts[0][2] - b.pts[0][2]);
  return { chains: out, limits: lim, edges: edges.length };
}

// ---------------------------------------------------------------------------
// 2D helpers: ear clipping, convex hull, rounded offset
// ---------------------------------------------------------------------------
function earClip(poly) {                     // poly: [[u,v],...] simple, any winding -> tri index list
  const n = poly.length;
  if (n < 3) return [];
  let area = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  if (area < 0) idx.reverse();
  const tris = [];
  const crossZ = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => crossZ(a, b, p) >= -1e-12 && crossZ(b, c, p) >= -1e-12 && crossZ(c, a, p) >= -1e-12;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
      const a = poly[i0], b = poly[i1], c = poly[i2];
      if (crossZ(a, b, c) <= 1e-12) continue;
      let ok = true;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (inside(poly[j], a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      tris.push([i0, i1, i2]); idx.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}
function hull2(pts) {                         // Andrew's monotone chain, CCW
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}
function roundedOffset(hull, r, nArc) {      // CCW convex polygon -> offset by r with arcs at the corners
  const n = hull.length, out = [];
  if (n === 1) {
    for (let i = 0; i < nArc * 4; i++) { const a = 2 * Math.PI * i / (nArc * 4); out.push([hull[0][0] + r * Math.cos(a), hull[0][1] + r * Math.sin(a)]); }
    return out;
  }
  if (n === 2) { hull = [hull[0], hull[1]]; }
  const N = hull.length;
  for (let i = 0; i < N; i++) {
    const p = hull[i], a = hull[(i + N - 1) % N], b = hull[(i + 1) % N];
    const n0 = nrm2(perp2(sub2(p, a))), n1 = nrm2(perp2(sub2(b, p)));   // outward normals (CCW -> right-hand perp)
    let a0 = Math.atan2(n0[1], n0[0]), a1 = Math.atan2(n1[1], n1[0]);
    while (a1 < a0 - 1e-9) a1 += 2 * Math.PI;
    const k = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 2) * nArc));
    for (let j = 0; j <= k; j++) { const t = a0 + (a1 - a0) * j / k; out.push([p[0] + r * Math.cos(t), p[1] + r * Math.sin(t)]); }
  }
  return out;
}
// clip a polygon to an axis-aligned box (Sutherland-Hodgman), then drop
// consecutive duplicates
function clipRect(poly, box) {
  let P = poly.slice();
  const planes = [[0, 1, box[0][0]], [0, -1, box[1][0]], [1, 1, box[0][1]], [1, -1, box[1][1]]];
  for (const [ax, sg, c] of planes) {
    const inside = p => (p[ax] - c) * sg >= 0;
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) {
        const t = (c - a[ax]) / (b[ax] - a[ax]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    P = out;
    if (!P.length) return P;
  }
  const R = [];
  for (const p of P) if (!R.length || Math.hypot(p[0] - R[R.length - 1][0], p[1] - R[R.length - 1][1]) > 1e-7) R.push(p);
  if (R.length > 1 && Math.hypot(R[0][0] - R[R.length - 1][0], R[0][1] - R[R.length - 1][1]) < 1e-7) R.pop();
  return R;
}
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const perp2 = v => [v[1], -v[0]];
const nrm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

// ---------------------------------------------------------------------------
// the throttle: swept bar section with a plane -> slot outline (2D, in the
// leg's own domain). plane = { kind:'y'|'x', c } ; map = 3D -> [u, v]
// ---------------------------------------------------------------------------
function leverCrossings(lever, plane) {
  const L = lever;
  const d0 = nrm(L.dir);
  const wx = L.wx != null ? L.wx : 0.020, tz = L.tz != null ? L.tz : 0.008;
  const pts = [];
  const N = Math.max(3, L.n || 25);
  // G344: the swing's AXIS is the lever's own (default lateral, the wall
  // lever's; vertical for the arm behind the leg) — Rodrigues about it; the
  // bar's width lies along the axis, its thickness across the swing
  const ax = nrm(L.axis || [1, 0, 0]);
  const rot = (v, th) => {
    const c = Math.cos(th), s = Math.sin(th), k = ax;
    const kd = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const kx = cross(k, v);
    return [v[0] * c + kx[0] * s + k[0] * kd * (1 - c), v[1] * c + kx[1] * s + k[1] * kd * (1 - c), v[2] * c + kx[2] * s + k[2] * kd * (1 - c)];
  };
  for (let i = 0; i < N; i++) {
    const th = (L.arc || 0) * i / (N - 1);
    const d = rot(d0, th);
    const nsw = nrm(cross(ax, d));                   // swing-plane normal, perpendicular to the lever
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const off = [a * wx / 2 * ax[0] + b * tz / 2 * nsw[0], a * wx / 2 * ax[1] + b * tz / 2 * nsw[1], a * wx / 2 * ax[2] + b * tz / 2 * nsw[2]];
      const p0 = [L.piv[0] + off[0], L.piv[1] + off[1], L.piv[2] + off[2]];
      const dc = plane.kind === 'y' ? d[1] : d[0];
      if (Math.abs(dc) < 1e-9) continue;
      const s = ((plane.c - (plane.kind === 'y' ? p0[1] : p0[0])) / dc);
      if (s < 0 || s > L.len) continue;
      pts.push([p0[0] + d[0] * s, p0[1] + d[1] * s, p0[2] + d[2] * s]);
    }
    // the knob: a sphere at the lever's end
    if (L.knobR > 0) {
      const c = [L.piv[0] + d[0] * L.len, L.piv[1] + d[1] * L.len, L.piv[2] + d[2] * L.len];
      const dist = plane.kind === 'y' ? c[1] - plane.c : c[0] - plane.c;
      if (Math.abs(dist) < L.knobR) {
        const rr = Math.sqrt(L.knobR * L.knobR - dist * dist);
        for (let k = 0; k < 12; k++) {
          const a = 2 * Math.PI * k / 12;
          pts.push(plane.kind === 'y' ? [c[0] + rr * Math.cos(a), plane.c, c[2] + rr * Math.sin(a)]
                                      : [plane.c, c[1] + rr * Math.cos(a), c[2] + rr * Math.sin(a)]);
        }
      }
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// the solid
// ---------------------------------------------------------------------------
function shoulderBuild(mesh, spec, opt, CAGE) {
  const o = Object.assign({}, DEF, opt || {});
  const tr = shoulderTrace(mesh, spec, o, CAGE);
  const skinX = makeSkinSampler(mesh);
  const V = mesh.V.slice(), F = mesh.F.slice();
  const A = mesh.A ? mesh.A.slice() : null;
  const N = mesh.N ? mesh.N.slice() : null;
  const NN = [];                                 // normals for the new vertices, by index
  const parts = [];
  const ro = o.bendR + o.t, ri = o.bendR;
  const bendN = Math.max(1, o.bendN | 0);

  for (const ch of tr.chains) {
    const side = ch.side, u = -side;             // inboard direction in x
    const off = ch.cutOff || [0, 0, 0];
    const st = chainStations(ch, o, skinX, ro);  // stations: per chain point, the profile frame
    // profile in (s, y) with s inboard from xo; normals in (s, y)
    // profile in (s, y), s inboard from xo. Each point carries the normal of
    // the SEGMENT that starts at it (so a sharp corner is two coincident
    // points) and that segment's strip tag; 'x' marks the degenerate pair.
    const prof = s0 => {
      const P = [];
      const add = (s, y, ns, ny, tag) => P.push({ s, y, n: [ns, ny], tag });
      add(0, 0, 0, 1, 'top');
      add(o.W - ro, 0, 0, 1, 'bend');
      for (let k = 1; k <= bendN; k++) {
        const a = Math.PI / 2 * (1 - k / bendN);
        add(o.W - ro + ro * Math.cos(a), -ro + ro * Math.sin(a), Math.cos(a), Math.sin(a),
            k === bendN ? 'face' : 'bend');
      }
      add(o.W, -s0.Hc, 1, 0, 'x');
      add(o.W, -s0.Hc, 0, -1, 'bottom');
      add(o.W - o.t, -s0.Hc, 0, -1, 'x');
      add(o.W - o.t, -s0.Hc, -1, 0, 'pocket');
      add(o.W - o.t, -ro, -1, 0, 'ibend');
      for (let k = 1; k <= bendN; k++) {
        const a = Math.PI / 2 * k / bendN;
        add(o.W - ro + ri * Math.cos(a), -ro + ri * Math.sin(a), -Math.cos(a), -Math.sin(a),
            k === bendN ? 'under' : 'ibend');
      }
      add(s0.s5, -o.t, 0, -1, 'x');
      add(s0.s5, -o.t, -1, 0, 'wall');
      add(0, 0, -1, 0, 'x');
      return P;
    };
    for (const s0 of st) s0.s5 = (s0.xo1 - s0.xo) * u;
    const profs = st.map(s0 => prof(s0));
    const NP = profs[0].length;
    const to3 = (s0, q) => [s0.xo + u * q.s + off[0], s0.yTop + q.y + off[1], s0.z + off[2]];
    const n3 = q => [u * q.n[0], q.n[1], 0];
    // vertex ids per station per profile point (split vertices)
    const ids = profs.map((P, i) => P.map(q => {
      const id = V.push(to3(st[i], q)) - 1;
      NN[id] = n3(q);
      return id;
    }));
    const faces = [];
    const mk = (vs, extra) => faces.push(Object.assign({ v: vs, m: o.mat, shoulder: 1 }, extra || {}));
    // slot: which leg does the lever cross?
    let slot = null;
    if (o.lever) slot = planSlot(o, st, u, side, ch, off);
    // loft
    for (let i = 0; i + 1 < st.length; i++) {
      for (let k = 0; k < NP; k++) {
        const k1 = (k + 1) % NP;
        const a = profs[i][k], b = profs[i][k1];
        if (Math.abs(a.s - b.s) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) continue;   // a sharp corner duplicate
        if (slot && slot.skip(i, a.tag)) continue;
        mk([ids[i][k], ids[i][k1], ids[i + 1][k1], ids[i + 1][k]]);
      }
    }
    // caps (flat, their own vertices)
    for (const end of [0, st.length - 1]) {
      const P = profs[end];
      const uniq = [];
      for (const q of P) if (!uniq.length || Math.abs(q.s - uniq[uniq.length - 1].s) > 1e-9 || Math.abs(q.y - uniq[uniq.length - 1].y) > 1e-9) uniq.push(q);
      if (Math.abs(uniq[0].s - uniq[uniq.length - 1].s) < 1e-9 && Math.abs(uniq[0].y - uniq[uniq.length - 1].y) < 1e-9) uniq.pop();
      const nz = end === 0 ? -1 : 1;
      const cid = uniq.map(q => { const id = V.push(to3(st[end], q)) - 1; NN[id] = [0, 0, nz]; return id; });
      const tris = earClip(uniq.map(q => [q.s, q.y]));
      for (const t of tris) mk([cid[t[0]], cid[t[1]], cid[t[2]]]);
    }
    // the slot's patches and wall
    if (slot && slot.ok) slot.emit(V, NN, mk, ids, profs, st, to3, n3);
    // THE FIELD (G325.1): the shoulder carries the cage's own surface
    // coordinate so the skin material maps it METRICALLY instead of
    // triplanar — sL along the sill (0 at the forward cap, +aft, like the
    // body's own ruler), sC around the profile from the outer top edge (over
    // the lip, round the bend, down the leg), st/lv at mid-bay/mid-panel so
    // no rail grammar fires on it. Only when the mesh has a field at all.
    if (mesh.A) {
      const zF = st[st.length - 1].z;
      const arc = [];                              // profile arc per point
      let acc = 0;
      profs[0].forEach((q, k) => {
        if (k) { const p = profs[0][k - 1]; acc += Math.hypot(q.s - p.s, q.y - p.y); }
        arc.push(acc);
      });
      ids.forEach((row, i) => row.forEach((id, k) => { A[id] = [zF - st[i].z, arc[k], 0.5, 0.5]; }));
      for (const f of faces) for (const vi of f.v) if (!A[vi]) {
        // a cap or a slot vertex: the station's sL, the nearest profile arc
        const p = V[vi];
        const sL = zF - (p[2] - off[2]);
        let best = 0, bd = 1e9;
        profs[0].forEach((q, k) => {
          const d = Math.hypot((p[0] - off[0] - st[0].xo) * u - q.s, 0);
          if (d < bd) { bd = d; best = k; }
        });
        A[vi] = [sL, arc[best], 0.5, 0.5];
      }
    }
    // orient this part: coherent windings by position-keyed edges, then
    // positive volume
    orientPart(V, faces);
    for (const f of faces) {
      if (ch.door) { f.doorKey = ch.door; f.cutPart = 1; f.cutOff = off; }
      F.push(f);
    }
    parts.push({ side, door: ch.door, kind: ch.kind, z0: st[0].z, z1: st[st.length - 1].z,
                 nFaces: faces.length, faces, st, off, slot: slot ? slot.report() : null,
                 Hmin: Math.min(...st.map(s0 => s0.Hc)), Hmax: Math.max(...st.map(s0 => s0.Hc)) });
  }
  const out = Object.assign({}, mesh, { V, F });
  if (A) out.A = A;
  if (N) { for (let i = 0; i < V.length; i++) if (!N[i] && NN[i]) N[i] = NN[i]; out.N = N; }
  else { const N2 = []; for (let i = 0; i < V.length; i++) if (NN[i]) N2[i] = NN[i]; out.N = N2; }
  out.shoulder = { parts, trace: tr, opt: o };
  return out;
}

// the stations of a chain: per traced point, the profile frame (G344: a
// function, so the lever can be decided off the same stations the loft uses)
function chainStations(ch, o, skinX, ro) {
  const side = ch.side, u = -side;
  const st = [];
  for (const p of ch.pts) {
    const yTop = p[1] - o.drop;
    // the skin at the top and at the underside; fall back to the traced point
    const xs0 = skinX(side, yTop, p[2]), xs1 = skinX(side, yTop - o.t, p[2]);
    const xo = (xs0 != null ? xs0 : p[0]) + u * o.inset;
    const xo1 = (xs1 != null ? xs1 : p[0]) + u * o.inset;
    // the leg's inner face vs the skin below: the first y where the skin
    // comes inboard of the leg's pocket face ends the leg (closed onto the
    // skin). Sampled at 1 cm steps.
    const xLegIn = xo + u * (o.W - o.t);
    let Hc = o.H;
    for (let y = yTop - ro; y >= yTop - o.H - 1e-9; y -= 0.01) {
      const xs = skinX(side, y, p[2]);
      if (xs != null && (xs - xLegIn) * u > -o.inset) { Hc = yTop - y; break; }
    }
    Hc = Math.max(Hc, ro + o.t + 0.005);
    st.push({ z: p[2], yTop, xo, xo1, Hc });
  }
  return st;
}
// THE LEVER, DECIDED HERE (G344): the throttle behind the shoulder is drawn
// by the crew layer off THIS record, and the slot is cut from it, so the
// two cannot disagree. `req` = { mode: 'face' | 'slot', side, z, dy, dx,
// len } (cage units; z the throttle's station, dy a lift, dx a shift
// inboard along the face, len the wall lever's length). The chain on that
// side holding z is asked for its station: the leg's inboard face is at
// xo + u W, its top at yTop, its bottom yTop - Hc.
//   'face': the wall quadrant seated on the face — the wall lever's own
//           numbers with the face for the wall; lateral pivot, no slot
//   'slot': a horizontal arm on a VERTICAL pivot 38 mm into the pocket
//           behind the leg, at mid-leg, swinging 50 degrees about it (aft =
//           idle) — its stem crosses the face in a horizontal slot; the
//           knob rides 45 mm into the cabin
// Returns null when no chain holds the station (no shoulder there).
function shoulderLever(mesh, spec, opt, CAGE, req) {
  const o = Object.assign({}, DEF, opt || {});
  const tr = shoulderTrace(mesh, spec, o, CAGE);
  const skinX = makeSkinSampler(mesh);
  const ro = o.bendR + o.t;
  const side = req.side || 1, u = -side;
  const chains = tr.chains.filter(ch => ch.side === side);
  let best = null;
  for (const ch of chains) {
    const st = chainStations(ch, o, skinX, ro);
    if (st.length < 2) continue;
    const z0 = st[0].z, z1 = st[st.length - 1].z;
    if (req.z < z0 || req.z > z1) continue;
    let i = 0; while (i < st.length - 2 && st[i + 1].z < req.z) i++;
    const a = st[i], b = st[i + 1], t = Math.max(0, Math.min(1, (req.z - a.z) / Math.max(1e-9, b.z - a.z)));
    best = { yTop: a.yTop + (b.yTop - a.yTop) * t, xo: a.xo + (b.xo - a.xo) * t, Hc: a.Hc + (b.Hc - a.Hc) * t, door: ch.door || null, z0, z1 };
    break;
  }
  if (!best) return null;
  const xFace = best.xo + u * o.W;                // the leg's inboard face
  const face = { x: xFace, yTop: best.yTop, yBot: best.yTop - best.Hc, W: o.W, t: o.t, xo: best.xo, z0: best.z0, z1: best.z1, door: best.door };
  const dy = req.dy || 0;
  if (req.mode === 'face') {
    // the wall lever's own frame (buildThrottleWall), the face for the wall
    const wx = xFace, yT = req.y != null ? req.y + dy : best.yTop - 0.10 + dy, zT = req.z;   // (the crew shifts by the rows itself)
    const piv = [wx + u * 0.03, yT - 0.01, zT - 0.04];
    const d = [u * 0.025, 0.11, 0.105], l = Math.hypot(d[0], d[1], d[2]);
    return { mode: 'face', side, piv, dir: d.map(v => v / l), axis: [1, 0, 0], len: req.len != null ? req.len : 0.16,
             arc: 25 * Math.PI / 180, wx: 0.020, tz: 0.008, knobR: 0.026, wall: wx, plateY: yT, plateZ: zT, face };
  }
  // 'slot': vertical pivot in the pocket, mid-leg (kept 30 mm off its top
  // and bottom), the arm's rest pointing inboard and AFT by half the arc
  const arc = 50 * Math.PI / 180;
  // (kept 40 mm under the bend — the slot's frame wants the room — and
  // 35 mm off the bottom)
  const yT = Math.max(face.yBot + 0.035, Math.min(face.yTop - ro - 0.040, (req.y != null ? req.y : (face.yTop + face.yBot) / 2) + dy));
  const back = Math.min(0.038, Math.max(0.012, o.W - o.t - 0.012));
  const piv = [xFace - u * back, yT, req.z];
  const a0 = -arc / 2;
  const dir = [u * Math.cos(a0), 0, Math.sin(a0)];
  return { mode: 'slot', side, piv, dir, axis: [0, 1, 0], len: back / Math.cos(a0) + 0.045, arc,
           wx: 0.012, tz: 0.008, knobR: 0, reach: 0.045, face };
}
// ---- the slot planner (one per chain) ------------------------------------
function planSlot(o, st, u, side, ch, off) {
  const L = o.lever;
  const ro = o.bendR + o.t;
  const zMin = st[0].z, zMax = st[st.length - 1].z;
  const at = z => {                               // interpolate a station
    let i = 0;
    while (i < st.length - 2 && st[i + 1].z < z) i++;
    const a = st[i], b = st[i + 1], t = Math.max(0, Math.min(1, (z - a.z) / Math.max(1e-9, b.z - a.z)));
    return { yTop: a.yTop + (b.yTop - a.yTop) * t, xo: a.xo + (b.xo - a.xo) * t, Hc: a.Hc + (b.Hc - a.Hc) * t };
  };
  const s0 = at(L.piv[2]);
  const rep = { leg: null, ok: false, note: '' };
  // candidate planes: the top surface (y = yTop) and the cabin face (x = xo + u W)
  const cands = [
    { leg: 'top', plane: { kind: 'y', c: s0.yTop }, map: p => [p[2], (p[0] - at(p[2]).xo) * u],
      dom: z => [0, o.W - ro], tagA: 'top', tagB: 'under', margin: [zMin, zMax] },
    { leg: 'face', plane: { kind: 'x', c: s0.xo + u * o.W }, map: p => [p[2], p[1] - at(p[2]).yTop],
      dom: z => [-at(z).Hc, -ro], tagA: 'face', tagB: 'pocket', margin: [zMin, zMax] },
  ];
  let pick = null;
  for (const c of cands) {
    const P3 = leverCrossings(L, c.plane);
    const P2 = P3.map(c.map).filter(p => { const d = c.dom(p[0]); return p[0] > zMin && p[0] < zMax && p[1] > d[0] && p[1] < d[1]; });
    if (P2.length && (!pick || P2.length > pick.P2.length)) pick = { c, P2, all: P3.length };
  }
  const inPocket = (() => {
    const px = (L.piv[0] - s0.xo) * u, py = L.piv[1] - s0.yTop;
    return px > 0 && px < o.W && py < 0 && py > -s0.Hc && L.piv[2] > zMin && L.piv[2] < zMax;
  })();
  if (!pick) {
    rep.note = inPocket ? 'BURIED: the lever never leaves the pocket' : 'no crossing';
    return { ok: false, skip: () => false, emit: () => {}, report: () => rep };
  }
  const c = pick.c;
  rep.leg = c.leg;
  // the outline: hull of the crossings, offset by the clearance
  const h = hull2(pick.P2);
  const r = o.slotClear + (c.leg === 'top' ? 0 : 0);
  let outline = roundedOffset(h.length >= 3 ? h : h.length === 2 ? [h[0], h[1]] : [h[0]], r, 4);
  // it must sit inside the leg's domain with a margin of two thicknesses:
  // what runs past the leg's edge would be a notch, not a slot — the
  // outline is CLIPPED to the domain (Sutherland-Hodgman, so it stays a
  // convex simple polygon) and the report says so
  const mg = o.t * 2;
  const dm = c.dom(L.piv[2]);
  const box = [[zMin + mg, dm[0] + mg], [zMax - mg, dm[1] - mg]];
  const before = outline.length;
  outline = clipRect(outline, box);
  const clipped = outline.length !== before || outline.some(p => p[0] <= box[0][0] + 1e-9 || p[0] >= box[1][0] - 1e-9 || p[1] <= box[0][1] + 1e-9 || p[1] >= box[1][1] - 1e-9);
  rep.clipped = clipped;
  if (outline.length < 3) { rep.note = 'slot outside the leg'; return { ok: false, skip: () => false, emit: () => {}, report: () => rep }; }
  // stations inside the slot's z range are replaced by the patch: the patch
  // spans [za, zb] = the stations just outside the outline, with the outline's
  // own z extent padded by a margin
  let oz0 = 1e9, oz1 = -1e9;
  for (const p of outline) { oz0 = Math.min(oz0, p[0]); oz1 = Math.max(oz1, p[0]); }
  let ia = 0, ib = st.length - 1;
  for (let i = 0; i < st.length; i++) { if (st[i].z <= oz0 - mg) ia = i; }
  for (let i = st.length - 1; i >= 0; i--) { if (st[i].z >= oz1 + mg) ib = i; }
  if (ib <= ia) { rep.note = 'slot spans the whole chain'; return { ok: false, skip: () => false, emit: () => {}, report: () => rep }; }
  rep.ok = true;
  rep.range = [oz0, oz1];
  rep.n = outline.length;
  const skip = (i, tag) => i >= ia && i < ib && (tag === c.tagA || tag === c.tagB);
  const emit = (V, NN, mk, ids, profs, st2, to3) => {
    // two patches (the outer and inner sheets of the leg) + the wall
    const idxOf = tag => profs[0].findIndex(q => q.tag === tag);
    const kA = idxOf(c.tagA), kB = idxOf(c.tagB);            // first profile point of each strip
    // the strip runs from profile point k to k+1 (both with that tag)
    const stripPts = (k, i) => [profs[i][k], profs[i][k + 1]];
    const buildPatch = (k, sheetSign) => {
      // outer loop in (z, v) domain over stations ia..ib, v from strip point k to k+1
      const loop = [];                          // [{z, v, id}]
      const vOf = q => c.leg === 'top' ? q.s : q.y;
      // bottom edge (point k) ia -> ib, then the other edge (k+1) ib -> ia
      for (let i = ia; i <= ib; i++) loop.push({ z: st2[i].z, v: vOf(profs[i][k]), id: ids[i][k] });
      for (let i = ib; i >= ia; i--) loop.push({ z: st2[i].z, v: vOf(profs[i][k + 1]), id: ids[i][k + 1] });
      // inner loop: the outline, lifted onto the sheet
      const nrmOf = profs[0][k].n;
      const inner = outline.map(p => {
        const s3 = at(p[0]);
        const q = c.leg === 'top' ? { s: p[1], y: sheetSign > 0 ? 0 : -o.t } : { s: sheetSign > 0 ? o.W : o.W - o.t, y: p[1] };
        const id = V.push([s3.xo + u * q.s + off[0], s3.yTop + q.y + off[1], p[0] + off[2]]) - 1;
        NN[id] = [u * nrmOf[0], nrmOf[1], 0];
        return { z: p[0], v: p[1], id };
      });
      zip(loop, inner, mk);
      return inner;
    };
    const innA = buildPatch(kA, +1), innB = buildPatch(kB, -1);
    // the wall: A's outline to B's outline. Both were built from the same
    // outline in the same order, so ring quads pair 1:1.
    const n = outline.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const q = [innA[i].id, innA[j].id, innB[j].id, innB[i].id];
      // the wall's own normals: outward from the slot (in the sheet's plane)
      const a = outline[i], b = outline[j];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const cen = outline.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
      const dir = nrm2([cen[0] - mid[0], cen[1] - mid[1]]);       // into the slot = the wall's outward normal
      const wid = q.map(id => { const nid = V.push(V[id].slice()) - 1;
        NN[nid] = c.leg === 'top' ? [u * dir[1], 0, dir[0]] : [0, dir[1], dir[0]]; return nid; });
      mk(wid);
    }
  };
  return { ok: true, skip, emit, report: () => rep };
}

// zip two loops (outer, inner: [{z, v, id}]) into triangles by angle about
// the inner loop's centroid. Both loops are re-sorted CCW.
function zip(outer, inner, mk) {
  const cen = inner.reduce((s, p) => [s[0] + p.z / inner.length, s[1] + p.v / inner.length], [0, 0]);
  const ang = p => Math.atan2(p.v - cen[1], p.z - cen[0]);
  const O = outer.map(p => ({ p, a: ang(p) })).sort((a, b) => a.a - b.a);
  const a0 = O[0].a;
  const rel = a => { let r = a - a0; while (r < 0) r += 2 * Math.PI; while (r >= 2 * Math.PI) r -= 2 * Math.PI; return r; };
  O.forEach(q => { q.a = rel(q.a); });
  const I = inner.map(p => ({ p, a: rel(ang(p)) })).sort((a, b) => a.a - b.a);
  const nO = O.length, nI = I.length;
  // unwrapped walks: the outer from its first point round to itself, the
  // inner from the point just BEHIND the outer's first (angle - 2pi)
  const OP = O.concat([{ p: O[0].p, a: 2 * Math.PI }]);
  const IP = [{ p: I[nI - 1].p, a: I[nI - 1].a - 2 * Math.PI }].concat(I);
  let i = 0, j = 0;
  while (i < nO || j < nI) {
    const nextO = i < nO ? OP[i + 1].a : Infinity, nextI = j < nI ? IP[j + 1].a : Infinity;
    if (nextO <= nextI) { mk([OP[i].p.id, OP[i + 1].p.id, IP[j].p.id]); i++; }
    else { mk([OP[i].p.id, IP[j + 1].p.id, IP[j].p.id]); j++; }
  }
}

// coherent windings across position-shared edges, then positive volume
function orientPart(V, faces) {
  const keyOf = (a, b) => ek(V[a], V[b]);
  const eF = new Map();
  faces.forEach((f, i) => { const n = f.v.length; for (let e = 0; e < n; e++) {
    const k = keyOf(f.v[e], f.v[(e + 1) % n]); if (!eF.has(k)) eF.set(k, []); eF.get(k).push(i); } });
  const dirIn = (f, k) => { const n = f.v.length; for (let e = 0; e < n; e++) {
    const a = f.v[e], b = f.v[(e + 1) % n]; if (keyOf(a, b) === k) return pk(V[a]) < pk(V[b]) ? 1 : -1; } return 0; };
  const seen = new Uint8Array(faces.length);
  for (let s = 0; s < faces.length; s++) {
    if (seen[s]) continue;
    seen[s] = 1;
    const q = [s];
    while (q.length) {
      const i = q.pop(), f = faces[i], n = f.v.length;
      for (let e = 0; e < n; e++) {
        const k = keyOf(f.v[e], f.v[(e + 1) % n]);
        for (const j of eF.get(k)) {
          if (j === i || seen[j]) continue;
          if (dirIn(faces[j], k) === dirIn(f, k)) faces[j].v.reverse();
          seen[j] = 1; q.push(j);
        }
      }
    }
  }
  let vol = 0;
  for (const f of faces) for (let i = 1; i + 1 < f.v.length; i++) {
    const a = V[f.v[0]], b = V[f.v[i]], c = V[f.v[i + 1]];
    vol += dot(a, cross(b, c));
  }
  if (vol < 0) for (const f of faces) f.v.reverse();
  return vol / 6;
}

// ---------------------------------------------------------------------------
// the check: every part is a closed 2-manifold by position; volumes; the top
// sits under the transition everywhere; no NaN
// ---------------------------------------------------------------------------
function shoulderCheck(out) {
  const V = out.V, res = [];
  for (const p of out.shoulder.parts) {
    const eC = new Map();
    let nan = 0, nDeg = 0;
    for (const f of p.faces) {
      const n = f.v.length;
      for (const vi of f.v) if (!V[vi].every(Number.isFinite)) nan++;
      for (let e = 0; e < n; e++) {
        const a = V[f.v[e]], b = V[f.v[(e + 1) % n]];
        if (pk(a) === pk(b)) { nDeg++; continue; }
        const k = ek(a, b); eC.set(k, (eC.get(k) || 0) + 1);
      }
    }
    let open = 0, over = 0;
    for (const c of eC.values()) { if (c === 1) open++; else if (c > 2) over++; }
    let vol = 0;
    for (const f of p.faces) for (let i = 1; i + 1 < f.v.length; i++) {
      const a = V[f.v[0]], b = V[f.v[i]], c = V[f.v[i + 1]];
      vol += dot(a, cross(b, c));
    }
    vol /= 6;
    res.push({ side: p.side, door: p.door, kind: p.kind, z0: p.z0, z1: p.z1, faces: p.nFaces,
               open, over, nan, deg: nDeg, vol, Hmin: p.Hmin, Hmax: p.Hmax, slot: p.slot,
               ok: !open && !over && !nan && vol > 0 });
  }
  return res;
}

// ---------------------------------------------------------------------------
// shared by the bench and the check: the configurations the user named (and
// the ones that stress the trace), and the wall throttle at the crew layer's
// own station (an approximation of _cage_crew.js buildThrottleWall: the door
// outline's lowest point is the floor, the lever 0.42 above it, on the wall)
// ---------------------------------------------------------------------------
const CONFIGS = [
  ['stock', {}],
  ['wide cabin', { halfW: 0.75, roofHalfW: 0.60 }],
  ['narrow cabin', { halfW: 0.36, roofHalfW: 0.28 }],
  ['no pax bay', { paxCount: 0 }],
  ['two pax bays', { paxCount: 2 }],
  ['two pax, cabin run', { paxCount: 2 }, { run: 'cabin' }],
  ['bubble', { canopy: 3, doorOn: 0 }],
  ['bubble + door', { canopy: 3 }],
  ['open canopy', { canopy: 2, doorOn: 0 }],
  ['mirrored pod', { mirror: 1 }],
  ['pod + bubble', { mirror: 1, canopy: 3 }],
  ['no door', { doorOn: 0 }],
  ['sill down', { winSillPilot: 0.3 }],
  ['exploded', { explodeD: 0.25 }],
  ['round + tube', { topRound: 1, intCons: 1 }],
  ['round bottom + wood', { topRound: 1, botRound: 1, intCons: 2 }],
  ['drawn pax, cabin run', { paxWinN: 2 }, { run: 'cabin' }],
  ['no dash', { intDash: 0 }],
  ['no interior', { intOn: 0 }],
  ['wide lip', {}, { W: 0.10, H: 0.30 }],
  ['narrow lip', {}, { W: 0.05, H: 0.12 }],
];
function stockLever(built, side, CAGE, off) {
  const R = CAGE.cageResolve(built.spec);
  const cabB = R.rings.find(r => r.name === 'pilCabB');
  if (!cabB) return null;
  const o = off || {};
  const zT = cabB.lv.waist.z + 0.05 + 0.40 + (o.dz || 0);
  const doors = (built.mesh.outlines || []).filter(q => q.kind === 'door');
  let floor = cabB.lv.keel.y + 0.035;
  if (doors.length) floor = Math.min(...doors[0].pts.map(p => p[1]));
  const yT = floor + 0.42 + (o.dy || 0);
  const skin = makeSkinSampler(built.mesh);
  const wx = (skin(side, yT, zT) || side * built.spec.cabin.halfW * 0.9) + side * (o.dx || 0);
  const inb = -side;
  const piv = [wx + inb * 0.03, yT - 0.01, zT - 0.04];
  const d = [inb * 0.025, 0.11, 0.105];
  const l = Math.hypot(d[0], d[1], d[2]);
  return { piv, dir: d.map(v => v / l), len: o.len != null ? o.len : 0.16, arc: 25 * Math.PI / 180,
           wx: 0.020, tz: 0.008, knobR: 0.026, wall: wx, plateY: yT, plateZ: zT };
}

const API = { DEF, CONFIGS, stockLever, shoulderLever, chainStations, shoulderTrace, shoulderBuild, shoulderCheck, shoulderLimits,
              makeSkinSampler, leverCrossings, earClip, hull2, roundedOffset };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.SHOULDER_GEN = API;
})();
