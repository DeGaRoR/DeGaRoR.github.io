// VESSEL MESH — WHAT A TANK LOOKS LIKE, as opposed to where it is.
//
// `_vessel_gen.js` is the PLACEMENT: a vessel's box, its station, its level,
// its fit against the skin and the crew. Every number in it is load-bearing —
// the ledger bills the mass at that centre and GATE ENERGY checks that fit —
// and none of it is touched here. This file takes the box that file decided on
// and answers a different question: what is IN that box.
//
// The answer used to be "the box", drawn by GEAR_KIT.boxIn as six flat quads
// with no uv, and it looked like exactly what it was. A fuel tank is not a
// cube. It is a welded or moulded shell with radiused corners, held down by
// two straps on rubber pads, with a filler neck and cap on top, a sender
// plate, a sump and drain at the keel, an outlet stub at one end and a vent
// standing off the crown — and a battery pack is a bolted case with a lid
// seam, cooling ribs, terminal posts and a pressure vent. Those are the
// things that make it read as a real fitting at the distance the rest of this
// aeroplane is modelled at.
//
// ---------------------------------------------------------------------------
// ONE SECTION FUNCTION, AND EVERY PIECE COMES OUT OF IT.
//
// The shell is a MINKOWSKI ROUNDED BOX (a box swept by a sphere of radius r)
// or a CYLINDER with elliptical domed ends. Both have the same property, and
// it is the one this file is built on: a plane cut through either,
// perpendicular to ANY axis, is a rectangle with elliptical corners. So there
// is one section function — `sectRR(hx, hy, rx, ry)` — and:
//
//   the SHELL     is that section lofted up the y axis, capped at both poles
//   the CONTENTS  is the same section, inset by the wall, lofted from the
//                 keel to the fuel level and capped flat there — which is why
//                 the fuel slider can be SEEN in a round tank at all
//   a STRAP       is that section taken in the x-y plane at a station z,
//                 offset outward, and lofted over the strap's own width
//   a LID SEAM    is the same band taken about y instead of z
//   a COOLING RIB is a narrow strap
//
// Offsetting a Minkowski box outward by t is exactly (hx+t, hy+t, rx+t, ry+t),
// which is why the straps sit on the shell however round it is and need no
// projection step. On the cylinder's elliptical ends the same addition is an
// approximation, and at strap thicknesses (3 mm against a 200 mm radius) it is
// below a tenth of a millimetre.
//
// NORMALS ARE PARAMETRIC, NOT ACCUMULATED. Every lofted patch computes its
// normal from central differences of its own (u, v) grid, WRAPPING in u — so
// the seam where the section closes has the same normal on both sides and
// there is no shading crease down the side of every tank. computeVertexNormals
// cannot do that: it welds by position and this grid deliberately duplicates
// the seam column for the uv. It also cannot tell a fillet (which must be
// smooth) from a cap rim (which must be hard); here the caps carry their own
// vertices and so are hard by construction.
//
// UVS ARE IN METRES. `tile` (from the texture table) is metres per repeat, and
// this file lays u and v out as real arc length, rounded to a whole number of
// repeats around each closed loop so the seam matches. That is what makes the
// library scale: a 20-litre header tank and a 180-litre ferry tank wear the
// same grain at the same size, and neither is a stretched copy of the other.
// The same rule governs the FITTINGS, which are clamped in metres rather than
// scaled with the tank — a filler neck is 60 mm across on a Cub and 60 mm
// across on a Cessna.
//
// PURE: no THREE, no DOM. The caller turns each part's {pos, nor, uv, idx}
// into whatever it draws with, and GATE ENERGY runs the whole thing in node.
'use strict';
(() => {

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                       a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1;
                   return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------------------------------------------------------------------
// THE BUFFER. One per material slot; the caller uploads each as one mesh.
// ---------------------------------------------------------------------------
function Buf() {
  return {
    pos: [], nor: [], uv: [], idx: [],
    v(p, n, uv) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uv[0], uv[1]);
      return this.pos.length / 3 - 1;
    },
    tri(a, b, c) { this.idx.push(a, b, c); },
    quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); },
    get tris() { return this.idx.length / 3; },
  };
}

// ---------------------------------------------------------------------------
// THE SECTION: a rectangle with elliptical corners, walked anticlockwise from
// the middle of the +x edge. FIXED POINT COUNT, 4*(NS+NC), whatever the
// proportions — a loft can only join two sections that correspond point for
// point, and a section that allocated its samples by arc length would not.
// A corner that has eaten its whole edge (rx = hx, which is the cylinder's
// barrel) simply emits NS coincident points there: a strip of zero-area
// triangles, and every index still aligned.
// ---------------------------------------------------------------------------
function sectRR(hx, hy, rx, ry, NS, NC) {
  const X = Math.max(0, hx), Y = Math.max(0, hy);
  const RX = clamp(rx, 0, X), RY = clamp(ry, 0, Y);
  const ex = X - RX, ey = Y - RY;          // the flat half-edges
  const out = [];
  const edge = (x0, y0, x1, y1) => {
    for (let i = 0; i < NS; i++) {
      const t = i / NS;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  };
  const corner = (cx, cy, a0) => {
    for (let i = 0; i < NC; i++) {
      const a = a0 + (Math.PI / 2) * (i / NC);
      out.push([cx + RX * Math.cos(a), cy + RY * Math.sin(a)]);
    }
  };
  edge(X, -ey, X, ey);     corner(ex, ey, 0);
  edge(ex, Y, -ex, Y);     corner(-ex, ey, Math.PI / 2);
  edge(-X, ey, -X, -ey);   corner(-ex, -ey, Math.PI);
  edge(-ex, -Y, ex, -Y);   corner(ex, -ey, 3 * Math.PI / 2);
  return out;
}
// the x half-extent of such a section at height v — where a bolt on the flank
// or a fitting on the side has to sit
function widthAt(s, v) {
  const ey = s.hy - s.ry, av = Math.abs(v);
  if (av <= ey) return s.hx;
  if (av >= s.hy || s.ry <= 1e-9) return s.hx - s.rx;
  const t = (av - ey) / s.ry;
  return s.hx - s.rx + s.rx * Math.sqrt(Math.max(0, 1 - t * t));
}
// and the y half-extent at a lateral offset x — where a vent or a terminal
// standing off the crown has to sit. The pair is not one function with its
// arguments swapped: hx/rx and hy/ry are different numbers.
function heightAt(s, x) {
  const ex = s.hx - s.rx, ax = Math.abs(x);
  if (ax <= ex) return s.hy;
  if (ax >= s.hx || s.rx <= 1e-9) return s.hy - s.ry;
  const t = (ax - ex) / s.rx;
  return s.hy - s.ry + s.ry * Math.sqrt(Math.max(0, 1 - t * t));
}
// the area a closed section encloses — zero where it has collapsed to a line
function sectArea(P) {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}
// the closed loop's own length, for the uv's whole-repeat rounding
function loopLen(P) {
  let L = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}

// ---------------------------------------------------------------------------
// THE SHAPE: half extents e = [ex, ey, ez] in the vessel's own frame
//   x across the body    y up    z along
// Both forms answer the same two questions — the cut at a height and the cut
// at a station — which is the whole trick.
// ---------------------------------------------------------------------------
function mkShape(form, e, opt) {
  const o = opt || {};
  const ex = Math.max(1e-4, e[0]), ey = Math.max(1e-4, e[1]), ez = Math.max(1e-4, e[2]);
  if (form === 'cyl') {
    // the dome is a fraction of the length, never deeper than the radius it
    // springs from: a tank whose ends are deeper than they are wide is a
    // capsule, not a tank
    const dome = clamp(o.dome == null ? 0.30 : o.dome, 0.05, 0.49);
    const a = Math.min(ez * dome, Math.min(ex, ey) * 0.95);
    const zc = ez - a;
    return {
      form: 'cyl', ex, ey, ez, r: Math.min(ex, ey), a, zc,
      // a horizontal cut: the straight barrel plus the two domes, narrowing
      // together as k falls. At the crown k = 0 and the cut is the ridge LINE,
      // which sectRR draws exactly (a zero-width rectangle) — no pole case.
      atY(y) {
        const k = Math.sqrt(Math.max(0, 1 - (y / ey) * (y / ey)));
        return { hx: ex * k, hy: zc + a * k, rx: ex * k, ry: a * k, k };
      },
      // a cut across the barrel: an ellipse, shrinking through the domes
      atZ(z) {
        const az = Math.abs(z);
        const k = az <= zc ? 1
          : Math.sqrt(Math.max(0, 1 - ((az - zc) / a) * ((az - zc) / a)));
        return { hx: ex * k, hy: ey * k, rx: ex * k, ry: ey * k, k };
      },
      // BY ANGLE, NOT BY HEIGHT: an even ladder in y under-samples the crown
      // and the keel, where all the curvature of a lying cylinder is
      ySlices(N) {
        const M = Math.max(6, N || 12), out = [];
        for (let i = 0; i <= M; i++) out.push(-ey * Math.cos(Math.PI * i / M));
        return out;
      },
    };
  }
  const r = clamp(o.r == null ? 0.16 * Math.min(ex, ey, ez) : o.r,
                  0.003, Math.min(ex, ey, ez) * 0.98);
  const inset = (c, half) => {
    const d = Math.abs(c) - (half - r);
    if (d <= 0) return 0;
    return r - Math.sqrt(Math.max(0, r * r - d * d));
  };
  return {
    form: 'box', ex, ey, ez, r,
    atY(y) { const d = inset(y, ey); return { hx: ex - d, hy: ez - d, rx: r - d, ry: r - d, k: 1 }; },
    atZ(z) { const d = inset(z, ez); return { hx: ex - d, hy: ey - d, rx: r - d, ry: r - d, k: 1 }; },
    // the two fillets get an arc ladder each and the flat band its two ends: a
    // rounded box is straight over most of its height and there is nothing to
    // sample there
    ySlices(N) {
      const K = Math.max(3, Math.round((N || 12) / 3)), out = [];
      for (let i = 0; i <= K; i++) out.push(-ey + r * (1 - Math.cos(Math.PI / 2 * i / K)));
      for (let i = K; i >= 0; i--) out.push(ey - r * (1 - Math.cos(Math.PI / 2 * i / K)));
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// A LOFT over a list of stations on one axis.
//   axis 'y'  sections cut in x-z, stacked up   (the shell, the lid seam)
//   axis 'z'  sections cut in x-y, run along    (a strap, a rib)
// `off` offsets the section outward — 0 is the shell, +t a band standing off
// it. `faces` false emits the vertex grid only, for a caller that will wind
// its own.
// ---------------------------------------------------------------------------
// `w` IS THE WINDING SIGN, and it is not a taste. Laying a 2D section into 3D
// about y sends (p0, p1) to (x, z) with y as the third axis, and the basis
// (x, z, y) is LEFT-handed where (x, y, z) is right-handed — so the identical
// point order that faces OUT on a z-axis loft faces IN on a y-axis one. Found
// by measurement, not by reading: every triangle of the first shell disagreed
// with its own vertex normal (560 of 560), which draws as a tank you can see
// the inside of the far wall through, since the near wall is what gets culled.
const AXIS = {
  y: { put: (p, c) => [p[0], c, p[1]], up: [0, 1, 0], w: -1, sec: (s, c) => s.atY(c) },
  z: { put: (p, c) => [p[0], p[1], c], up: [0, 0, 1], w: 1, sec: (s, c) => s.atZ(c) },
};

function loftBuild(buf, shape, axis, stations, off, tile, NS, NC, faces) {
  const A = AXIS[axis];
  const N = 4 * (NS + NC);
  const T = Math.max(1e-4, tile);
  const secs = stations.map(c => {
    const s = A.sec(shape, c);
    return sectRR(s.hx + off, s.hy + off, s.rx + off, s.ry + off, NS, NC);
  });
  // A COLLAPSED STATION HAS NO SURFACE NORMAL OF ITS OWN. The crown of a lying
  // cylinder is the one place this happens: the horizontal cut there is the
  // ridge LINE, which sectRR draws exactly — as a zero-width rectangle walked
  // up one side and back down the other. The parametric normal is then du x dv
  // with du REVERSED on the return half, so half the ridge's normals point
  // down while the surface points up. Caught by GATE ENERGY as 14 faces wound
  // against their own normal on every cylinder, which is a hairline of black
  // along the crown and nothing else — invisible until it is named. Where the
  // section encloses no area the outward direction is the axis, and its sign
  // is which end of the axis this is.
  const flat = secs.map(P => sectArea(P) < 1e-8);
  // THE WIDEST STATION SETS THE REPEAT COUNT, and every slice then wears that
  // same whole number of repeats — so the seam where u wraps matches all the
  // way along, and the grain merely gathers a little where the shell narrows.
  let refL = 0;
  for (const P of secs) { const L = loopLen(P); if (L > refL) refL = L; }
  const reps = Math.max(1, Math.round(refL / T));
  const grid = [], vs = [];
  let vAcc = 0, prev = null;
  for (let i = 0; i < stations.length; i++) {
    const P = secs[i], c = stations[i], L = loopLen(P);
    // v advances by the distance this slice moved ALONG THE SURFACE, measured
    // on the flank the section starts at — the meridian a flat face follows
    const mid = A.put(P[0], c);
    if (prev) vAcc += Math.hypot(mid[0] - prev[0], mid[1] - prev[1], mid[2] - prev[2]);
    prev = mid;
    vs.push(vAcc);
    const row = [];
    let arc = 0;
    for (let j = 0; j <= N; j++) {
      const p = P[j % N];
      if (j > 0) { const q = P[(j - 1) % N]; arc += Math.hypot(p[0] - q[0], p[1] - q[1]); }
      row.push({ p: A.put(p, c), u: (arc / Math.max(1e-9, L)) * reps });
    }
    grid.push(row);
  }
  const idx = [];
  for (let i = 0; i < grid.length; i++) {
    const line = [];
    for (let j = 0; j <= N; j++) {
      const P0 = grid[i][j].p;
      const jm = j === 0 ? N - 1 : j - 1, jp = j === N ? 1 : j + 1;
      const a = grid[i][jm].p, b = grid[i][jp].p;
      const im = Math.max(0, i - 1), ip = Math.min(grid.length - 1, i + 1);
      const c = grid[im][j].p, d = grid[ip][j].p;
      const du = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const dv = [d[0] - c[0], d[1] - c[1], d[2] - c[2]];
      let n = crs(du, dv);
      let L = Math.hypot(n[0], n[1], n[2]);
      if (L < 1e-13 || flat[i]) {
        // the section has closed to a point or a line: the surface's own axis
        // is the only direction left, and its sign is which end we are at
        const k = axis === 'y' ? P0[1] : P0[2];
        n = A.up.map(x => x * (k >= 0 ? 1 : -1));
      } else n = [n[0] / L, n[1] / L, n[2] / L];
      // outward — away from the axis wherever there is a radius to be away from
      const rad = axis === 'y' ? [P0[0], 0, P0[2]] : [P0[0], P0[1], 0];
      if (Math.hypot(rad[0], rad[1], rad[2]) > 1e-9 &&
          n[0] * rad[0] + n[1] * rad[1] + n[2] * rad[2] < 0)
        n = [-n[0], -n[1], -n[2]];
      line.push(buf.v(P0, n, [grid[i][j].u, vs[i] / T]));
    }
    idx.push(line);
  }
  if (faces !== false)
    for (let i = 0; i + 1 < grid.length; i++)
      for (let j = 0; j < N; j++) {
        if (A.w > 0) buf.quad(idx[i][j], idx[i][j + 1], idx[i + 1][j + 1], idx[i + 1][j]);
        else buf.quad(idx[i + 1][j], idx[i + 1][j + 1], idx[i][j + 1], idx[i][j]);
      }
  return { idx, N, reps };
}

// A FLAT CAP over one end of a loft: a fan from the section's centre, with its
// own vertices so the rim is a hard edge, uv straight off the plane. A section
// that has closed to a point or a line has no cap and says so.
function capBuild(buf, shape, axis, c, off, tile, NS, NC, dir) {
  const A = AXIS[axis], s = A.sec(shape, c);
  const P = sectRR(s.hx + off, s.hy + off, s.rx + off, s.ry + off, NS, NC);
  if (sectArea(P) < 1e-7) return 0;
  const T = Math.max(1e-4, tile);
  const n = A.up.map(x => x * dir);
  const ctr = buf.v(A.put([0, 0], c), n, [0, 0]);
  const ring = P.map(p => buf.v(A.put(p, c), n, [p[0] / T, p[1] / T]));
  const cw = dir * A.w;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    if (cw > 0) buf.tri(ctr, ring[i], ring[j]); else buf.tri(ctr, ring[j], ring[i]);
  }
  return 1;
}

// ---------------------------------------------------------------------------
// A BAND round the shell: a strap, a lid seam, a cooling rib. The outer
// surface stands off by `t`, and a rim at each end closes it down onto the
// shell — so it is a ribbon with a thickness you can see edge-on, and it is
// watertight from every angle outside the tank. No inner surface: it is
// pressed against a shell that is already there.
// ---------------------------------------------------------------------------
function bandBuild(buf, shape, axis, c0, c1, t, tile, NS, NC) {
  const A = AXIS[axis];
  const seat = 0.0004;                  // clear of the shell, not through it
  const st = [c0, c1];
  loftBuild(buf, shape, axis, st, t, tile, NS, NC);
  const T = Math.max(1e-4, tile);
  for (const [k, dir] of [[0, -1], [1, 1]]) {
    const c = st[k], s = A.sec(shape, c);
    const Po = sectRR(s.hx + t, s.hy + t, s.rx + t, s.ry + t, NS, NC);
    const Pi = sectRR(s.hx + seat, s.hy + seat, s.rx + seat, s.ry + seat, NS, NC);
    const n = A.up.map(x => x * dir);
    const ro = Po.map(p => buf.v(A.put(p, c), n, [p[0] / T, p[1] / T]));
    const ri = Pi.map(p => buf.v(A.put(p, c), n, [p[0] / T, p[1] / T]));
    const cw = dir * A.w;
    for (let i = 0; i < ro.length; i++) {
      const j = (i + 1) % ro.length;
      if (cw > 0) buf.quad(ri[i], ro[i], ro[j], ri[j]);
      else buf.quad(ri[j], ro[j], ro[i], ri[i]);
    }
  }
}

// ---------------------------------------------------------------------------
// TURNED HARDWARE: everything on a vessel that came off a lathe. One builder,
// because a filler neck, a sender boss, a drain sump, a terminal post, a
// mounting foot and a bolt head are all a cylinder with two optional caps.
//   c the centre of the base, ax the unit axis, r0/r1 the two radii, h high
// ---------------------------------------------------------------------------
function tubeBuild(buf, c, ax, r0, r1, h, tile, seg, capA, capB) {
  const guide = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const X = nrm(crs(guide, ax)), Y = crs(ax, X);
  const S = Math.max(4, seg || 16), T = Math.max(1e-4, tile);
  const reps = Math.max(1, Math.round(TAU * Math.max(r0, r1) / T));
  const lean = (r0 - r1) / Math.max(1e-6, h);
  const ringOf = (r, k) => {
    const out = [];
    for (let i = 0; i <= S; i++) {
      const a = TAU * (i % S) / S, ca = Math.cos(a), sa = Math.sin(a);
      const rad = [X[0] * ca + Y[0] * sa, X[1] * ca + Y[1] * sa, X[2] * ca + Y[2] * sa];
      out.push(buf.v([c[0] + ax[0] * h * k + rad[0] * r,
                      c[1] + ax[1] * h * k + rad[1] * r,
                      c[2] + ax[2] * h * k + rad[2] * r],
                     nrm([rad[0] + ax[0] * lean, rad[1] + ax[1] * lean,
                          rad[2] + ax[2] * lean]),
                     [(i / S) * reps, k * h / T]));
    }
    return out;
  };
  const A = ringOf(r0, 0), B = ringOf(r1, 1);
  for (let i = 0; i < S; i++) buf.quad(A[i], A[i + 1], B[i + 1], B[i]);
  const cap = (r, k, dir) => {
    if (r < 1e-5) return;
    const n = [ax[0] * dir, ax[1] * dir, ax[2] * dir];
    const cc = [c[0] + ax[0] * h * k, c[1] + ax[1] * h * k, c[2] + ax[2] * h * k];
    const ctr = buf.v(cc, n, [0, 0]);
    const ring = [];
    for (let i = 0; i < S; i++) {
      const a = TAU * i / S, ca = Math.cos(a), sa = Math.sin(a);
      const rad = [X[0] * ca + Y[0] * sa, X[1] * ca + Y[1] * sa, X[2] * ca + Y[2] * sa];
      ring.push(buf.v([cc[0] + rad[0] * r, cc[1] + rad[1] * r, cc[2] + rad[2] * r],
                      n, [r * ca / T, r * sa / T]));
    }
    for (let i = 0; i < S; i++) {
      const j = (i + 1) % S;
      if (dir > 0) buf.tri(ctr, ring[i], ring[j]); else buf.tri(ctr, ring[j], ring[i]);
    }
  };
  if (capB !== false) cap(r1, 1, 1);
  if (capA) cap(r0, 0, -1);
}

// where the crown and the keel are at a station, and where the end face is at
// a height — so a fitting lands ON the shell rather than inside it or floating
const surfY = (shape, z, sign) => sign * shape.atZ(z).hy;
const surfZ = (shape, y, sign) => sign * shape.atY(y).hy;

// ---------------------------------------------------------------------------
// THE VESSEL, ASSEMBLED.
//   opt.e        half extents [x, y, z] in metres — the placement's own box
//   opt.form     'box' | 'cyl'
//   opt.kind     'fuel' | 'battery'
//   opt.quality  segment budget: 1 a tank in the editor, 0.5 something small
//   opt.tile     {shell, hard, seal} metres per texture repeat
// Returns the four material slots as buffers, plus the shape, so the caller
// can ask the same solid for its fuel level.
// ---------------------------------------------------------------------------
function build(opt) {
  const o = opt || {};
  const e0 = [Math.max(0.02, (o.e || [])[0] || 0.2),
              Math.max(0.02, (o.e || [])[1] || 0.15),
              Math.max(0.02, (o.e || [])[2] || 0.3)];
  // THE LONG WAY IS THE LENGTH, whichever axis the placement calls it. Straps
  // sit at the quarter points, the filler goes forward and the sump aft, and
  // all of that is laid out along z — but a bay-shaped tank is very often
  // WIDER than it is long (the Cub's deck tank is 0.84 across and 0.24 along,
  // measured), and laying it out along the short axis crowds every fitting
  // into a hand's width. So the solid is built in a canonical frame with the
  // longer horizontal half-extent as z, and the caller adds `yaw` to the
  // placement's own turn. The declared box is unchanged: this is which way
  // round the tank is, not how big it is.
  const swap = e0[0] > e0[2] * 1.15;
  const e = swap ? [e0[2], e0[1], e0[0]] : e0;
  const yaw = swap ? Math.PI / 2 : 0;
  const kind = o.kind === 'battery' ? 'battery' : 'fuel';
  const form = o.form === 'cyl' ? 'cyl' : 'box';
  const q = clamp(o.quality == null ? 1 : o.quality, 0.35, 2);
  const tile = o.tile || {};
  const tS = tile.shell || 0.5, tH = tile.hard || 0.22, tK = tile.seal || 0.3;
  // A BATTERY CASE IS NOT A TANK. Its corners are a moulding radius — a few
  // millimetres — not the deep round a welded or blow-moulded shell takes.
  const rBox = kind === 'battery'
    ? clamp(0.10 * Math.min(e[0], e[1], e[2]), 0.005, 0.030)
    : clamp(0.34 * Math.min(e[0], e[1], e[2]), 0.008, 0.075);
  const shape = mkShape(form, e, { r: rBox, dome: 0.30 });
  const NS = Math.max(1, Math.round(3 * q)), NC = Math.max(2, Math.round(5 * q));
  const NY = Math.max(6, Math.round(12 * q));
  const out = { shell: Buf(), hard: Buf(), seal: Buf(), mark: Buf(),
                shape, form, kind, e, r: rBox, yaw };

  const ys = shape.ySlices(NY);
  loftBuild(out.shell, shape, 'y', ys, 0, tS, NS, NC);
  capBuild(out.shell, shape, 'y', ys[0], 0, tS, NS, NC, -1);
  capBuild(out.shell, shape, 'y', ys[ys.length - 1], 0, tS, NS, NC, 1);

  // THE HARDWARE'S SCALE IS CLAMPED, NOT PROPORTIONAL — the rule the crew
  // layer and the fittings arc both state, and the one this file would
  // otherwise break the first time a 200-litre ferry tank appeared.
  // ...and the floor of that clamp is itself bounded by the tank: a 60 mm
  // filler on an 80 mm-tall header tank is a fitting wearing an aeroplane
  const rMin = Math.min(e[0], e[1]);
  const rn = Math.min(clamp(0.13 * rMin, 0.018, 0.048), 0.35 * rMin);
  const NB = Math.max(8, Math.round(14 * q));
  if (kind === 'battery') buildPack(out, shape, e, NB, q, tH, tK);
  else buildTank(out, shape, e, rn, NB, q, tH, tK);

  out.tris = out.shell.tris + out.hard.tris + out.seal.tris + out.mark.tris;
  return out;
}

// ---------------------------------------------------------------------------
// A FUEL TANK.
// ---------------------------------------------------------------------------
function buildTank(out, shape, e, rn, NB, q, tH, tK) {
  const H = out.hard, K = out.seal, M = out.mark;
  const up = [0, 1, 0], dn = [0, -1, 0];
  const NS = 3, NC = 5;

  // ---- the straps ----------------------------------------------------------
  // Two, at the quarter points, each on a rubber pad a little wider than
  // itself — which is how a tank is actually held into an airframe, and the
  // one detail that stops a smooth shell reading as a bar of soap.
  const sw = clamp(0.055 * e[2], 0.010, 0.022), pw = sw * 1.6;
  const st = 0.0028, pt = 0.0012;
  for (const zc of [-0.48 * e[2], 0.48 * e[2]]) {
    bandBuild(K, shape, 'z', zc - pw, zc + pw, pt, tK, NS, NC);
    bandBuild(H, shape, 'z', zc - sw, zc + sw, st + pt, tH, NS, NC);
  }

  // ---- the filler, forward on the crown ------------------------------------
  const zF = Math.min(0.52 * e[2], e[2] - rn * 1.8);
  const yF = surfY(shape, zF, 1) - 0.004;
  tubeBuild(H, [0, yF, zF], up, rn * 1.45, rn * 1.30, 0.008, tH, NB, false, true);
  tubeBuild(H, [0, yF + 0.006, zF], up, rn, rn * 0.96, rn * 0.55, tH, NB, false, false);
  // the cap is the one spot of colour on a tank, and the thing a builder looks
  // for to know which way round it is
  tubeBuild(M, [0, yF + 0.006 + rn * 0.55, zF], up, rn * 1.22, rn * 1.10,
            rn * 0.34, tH, NB, false, true);

  // ---- the sender plate ----------------------------------------------------
  const zS = 0.06 * e[2], rs = rn * 1.15;
  const yS = surfY(shape, zS, 1) - 0.003;
  tubeBuild(H, [0, yS, zS], up, rs, rs, 0.005, tH, NB, false, true);
  for (let i = 0; i < 5; i++) {
    const a = TAU * i / 5;
    tubeBuild(H, [Math.cos(a) * rs * 0.76, yS + 0.005, zS + Math.sin(a) * rs * 0.76],
              up, 0.0035, 0.0032, 0.0030, tH, 6, false, true);
  }

  // ---- the sump and drain, at the keel -------------------------------------
  const zD = -0.42 * e[2];
  const yD = surfY(shape, zD, -1) + 0.004;
  tubeBuild(H, [0, yD, zD], dn, rn * 1.10, rn * 0.85, 0.016, tH, NB, false, true);
  tubeBuild(H, [0, yD - 0.016, zD], dn, rn * 0.38, rn * 0.34, 0.014, tH, 8, false, true);

  // ---- the outlet, low on the aft face -------------------------------------
  // A gravity tank feeds from the bottom of its aft end; the stub runs aft out
  // of the shell with a union collar where the hose clamps on.
  const yO = -0.55 * e[1], zO = surfZ(shape, yO, -1);
  const aft = [0, 0, -1];
  tubeBuild(H, [0, yO, zO + 0.004], aft, rn * 0.46, rn * 0.42, 0.032, tH, 10, false, true);
  tubeBuild(H, [0, yO, zO - 0.020], aft, rn * 0.58, rn * 0.58, 0.006, tH, 10, true, true);

  // ---- the vent, off the crown at the forward end --------------------------
  const zV = Math.min(0.74 * e[2], e[2] - 0.02);
  const xV = 0.35 * e[0];
  // ON THE CROWN AT ITS OWN x, through the section itself. A cosine of x/ex
  // is right for the cylinder and wrong for the box, whose crown is flat
  // until the corner radius — and 6% of a tank's height is a vent buried in
  // the shell, which is exactly the class of error a screenshot shows late.
  const yV = heightAt(shape.atZ(zV), xV) - 0.003;
  const rv = Math.max(0.0035, rn * 0.24);
  const hV = Math.min(0.042, 1.3 * e[1]);
  tubeBuild(H, [xV, yV, zV], up, rv * 1.7, rv * 1.5, 0.006, tH, 8, false, true);
  tubeBuild(H, [xV, yV + 0.006, zV], up, rv, rv, hV, tH, 8, false, false);
  tubeBuild(H, [xV, yV + 0.006 + hV, zV], [0, 0, 1], rv, rv, hV * 0.66, tH, 8, true, true);
}

// ---------------------------------------------------------------------------
// A BATTERY PACK: a bolted case. The lid seam runs round it near the top on a
// gasket with bolt heads along the flanks, cooling ribs stand off it, two
// terminal posts sit on the crown under booted covers with a pressure vent
// between them, and it stands on four feet.
// ---------------------------------------------------------------------------
function buildPack(out, shape, e, NB, q, tH, tK) {
  const H = out.hard, K = out.seal, M = out.mark;
  const up = [0, 1, 0];
  const NS = 3, NC = 5;

  // ---- the lid seam --------------------------------------------------------
  const yL = e[1] * 0.60;
  bandBuild(H, shape, 'y', yL - 0.005, yL + 0.005, 0.0035, tH, NS, NC);
  bandBuild(K, shape, 'y', yL - 0.010, yL - 0.005, 0.0022, tK, NS, NC);
  const nBolt = Math.max(3, Math.round(5 * q));
  for (let i = 0; i < nBolt; i++) {
    const z = -e[2] + 2 * e[2] * (i + 0.5) / nBolt;
    const x = widthAt(shape.atZ(z), yL);
    for (const sg of [1, -1])
      tubeBuild(H, [sg * (x + 0.0030), yL, z], [sg, 0, 0], 0.0045, 0.0042, 0.0045,
                tH, 6, false, true);
  }

  // ---- cooling ribs on the flanks ------------------------------------------
  const nRib = Math.max(3, Math.round(5 * q));
  const rw = clamp(0.020 * e[2], 0.004, 0.009);
  for (let i = 0; i < nRib; i++) {
    const z = -0.70 * e[2] + 1.40 * e[2] * (i + 0.5) / nRib;
    bandBuild(H, shape, 'z', z - rw, z + rw, 0.0035, tH, NS, NC);
  }

  // ---- the terminals, on the crown -----------------------------------------
  const zT = Math.min(0.62 * e[2], e[2] - 0.03);
  const rt = clamp(0.10 * Math.min(e[0], e[1]), 0.008, 0.020);
  let k = 0;
  for (const sg of [1, -1]) {
    const x = sg * Math.min(0.55 * e[0], 4 * rt);
    const yT = heightAt(shape.atZ(zT), x) - 0.003;
    tubeBuild(H, [x, yT, zT], up, rt * 1.9, rt * 1.7, 0.005, tH, NB, false, true);
    tubeBuild(H, [x, yT + 0.005, zT], up, rt, rt * 0.9, rt * 1.8, tH, NB, false, true);
    // the boot: coloured on the positive, black on the negative, which is the
    // one thing anybody actually reads off a pack
    tubeBuild(k === 0 ? M : K, [x, yT + 0.004, zT], up, rt * 1.6, rt * 1.35,
              rt * 1.15, tH, NB, false, true);
    k++;
  }
  tubeBuild(H, [0, heightAt(shape.atZ(zT), 0) - 0.003, zT], up,
            rt * 0.8, rt * 0.7, 0.010, tH, 10, false, true);

  // ---- the feet ------------------------------------------------------------
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const z = sz * 0.70 * e[2];
    tubeBuild(H, [sx * widthAt(shape.atZ(z), -e[1] * 0.92) * 0.86, -e[1] + 0.002, z],
              [0, -1, 0], 0.011, 0.011, 0.006, tH, 8, false, true);
  }
}

// ---------------------------------------------------------------------------
// WHAT IS IN IT, at a fill fraction: the same shell inset by the wall, lofted
// from the keel to the level and capped flat there. A round tank's fuel then
// has a round bottom and a flat top, which is what a fuel level IS — the box
// version drew a smaller box floating inside a bigger one.
// ---------------------------------------------------------------------------
// THE LEVEL IS A VOLUME, NOT A HEIGHT, and in a round tank those are not the
// same number. Half the litres in a lying cylinder is exactly half its height
// (it is symmetric about its axis) but a QUARTER of the litres is 19.6% of the
// height, not 25% — so a level placed at the fill fraction would read wrong
// everywhere except empty, half and full. The section's own area is integrated
// up the tank and the fraction inverted on that. It changes no mass: the
// ledger bills the litres, this only draws where they lie.
function contents(res, fill, wall) {
  const buf = Buf();
  const f = clamp(fill == null ? 1 : fill, 0, 1);
  if (f <= 0.002) return buf;
  const w = Math.min(wall == null ? 0.006 : wall,
                     0.3 * Math.min(res.e[0], res.e[1], res.e[2]));
  const shape = res.shape, e = res.e;
  const yLo = -e[1] + w, yHi = e[1] - w;
  const NS = 3, NC = 5;
  // cumulative volume up the tank, on a ladder fine enough to interpolate
  const M = 48, area = [], cum = [0];
  for (let i = 0; i <= M; i++) {
    const y = yLo + (yHi - yLo) * i / M;
    const s = shape.atY(y);
    area.push(sectArea(sectRR(s.hx - w, s.hy - w, s.rx - w, s.ry - w, 4, 6)));
    if (i > 0) cum.push(cum[i - 1] + (area[i] + area[i - 1]) / 2 * (yHi - yLo) / M);
  }
  const want = cum[M] * f;
  let yL = yHi;
  for (let i = 1; i <= M; i++) if (cum[i] >= want) {
    const t = (want - cum[i - 1]) / Math.max(1e-12, cum[i] - cum[i - 1]);
    yL = yLo + (yHi - yLo) * (i - 1 + t) / M;
    break;
  }
  yL = clamp(yL, yLo + 1e-4, yHi);
  const ys = shape.ySlices(10).filter(y => y > yLo + 1e-4 && y < yL - 1e-4);
  ys.unshift(yLo); ys.push(yL);
  loftBuild(buf, shape, 'y', ys, -w, 0.5, NS, NC);
  capBuild(buf, shape, 'y', yLo, -w, 0.5, NS, NC, -1);
  capBuild(buf, shape, 'y', yL, -w, 0.5, NS, NC, 1);
  buf.level = yL;
  return buf;
}

// ---------------------------------------------------------------------------
// THE WING TANK, and it is deliberately the simple one (the user, 2026-09-04:
// "if we don't have geometry for the wing-mounted tanks, just fit a cube
// within the first section of each wing after the central section, and that
// will be it"). A wing tank lives between the spars where nothing can see it,
// so it stays the tapered box the placement already decided on — given real
// outward normals and metre-true uv so it wears the same material as
// everything else, and nothing more.
//   p8  the eight corners in the layer's own order: root(lo-rear, lo-front,
//       hi-front, hi-rear) then tip(the same four)
// ---------------------------------------------------------------------------
function wingBox(p8, tile) {
  const buf = Buf();
  const T = Math.max(1e-4, tile || 0.5);
  const ctr = [0, 0, 0];
  for (const p of p8) { ctr[0] += p[0] / 8; ctr[1] += p[1] / 8; ctr[2] += p[2] / 8; }
  const F = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1],
             [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  for (const f of F) {
    const A = p8[f[0]], B = p8[f[1]], C = p8[f[2]];
    let n = nrm(crs([B[0] - A[0], B[1] - A[1], B[2] - A[2]],
                    [C[0] - A[0], C[1] - A[1], C[2] - A[2]]));
    // OUTWARD, whatever the winding: the layer mirrors the left side, which
    // reverses every face on it, and a box lit from the inside is the exact
    // artefact that is easy to ship and hard to see
    const out = [A[0] - ctr[0], A[1] - ctr[1], A[2] - ctr[2]];
    const flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0;
    if (flip) n = [-n[0], -n[1], -n[2]];
    const U = nrm([B[0] - A[0], B[1] - A[1], B[2] - A[2]]);
    const V = crs(n, U);
    const q = f.map(i => {
      const p = p8[i], d = [p[0] - A[0], p[1] - A[1], p[2] - A[2]];
      return buf.v(p, n, [(d[0] * U[0] + d[1] * U[1] + d[2] * U[2]) / T,
                          (d[0] * V[0] + d[1] * V[1] + d[2] * V[2]) / T]);
    });
    if (flip) buf.quad(q[3], q[2], q[1], q[0]); else buf.quad(q[0], q[1], q[2], q[3]);
  }
  return buf;
}

const API = { build, contents, wingBox, mkShape, sectRR, widthAt, heightAt, Buf,
              loftBuild, capBuild, bandBuild, tubeBuild };
if (typeof window !== 'undefined') window.VESSEL_MESH = API;
if (typeof module !== 'undefined') module.exports = API;
})();
