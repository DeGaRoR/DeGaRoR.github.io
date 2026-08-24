// GEAR KIT — the geometry primitives the undercarriage bench is built
// from (G20). Throwaway prototype family (gitignored with _cage*/_gear*),
// never in MANIFEST.
//
// Everything here is a SWEEP or a REVOLVE, because that is what real
// undercarriage hardware is: tubes, tapered blades, leaf springs, turned
// cylinders and machined lugs. Nothing is a THREE primitive with a
// rotation — a BoxGeometry leg is exactly what made the game's gear
// unsatisfying to look at.
//
// The same sweeper draws a round tube, a tapered blade and a leaf spring:
// only the SECTION function changes. Corners are always filleted, frames
// are always parallel-transported, so nothing kinks and nothing flips.
'use strict';
(() => {
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- vector kit -----------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                       a[0] * b[1] - a[1] * b[0]];
const off = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                            a[2] + (b[2] - a[2]) * t];
// rotate v about a unit axis by ang (Rodrigues) — steering, castor rake
const rot = (v, axis, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return add(add(mul(v, c), mul(crs(axis, v), s)),
             mul(axis, dot(axis, v) * (1 - c)));
};

// ---- geometry bag ---------------------------------------------------------
// One indexed buffer per MATERIAL, so a leg is a handful of draw calls
// however many members it has.
function Bag() {
  const pos = [], idx = [];
  return {
    v: p => { pos.push(p[0], p[1], p[2]); return pos.length / 3 - 1; },
    quad: (a, b, c, d) => { idx.push(a, b, c, a, c, d); },
    tri: (a, b, c) => { idx.push(a, b, c); },
    get tris() { return idx.length / 3; },
    mesh: (parent, mat) => {
      if (!idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      parent.add(m);
      return m;
    },
  };
}

// ---- paths ----------------------------------------------------------------
// Fillet every bend to a real radius (the cageRims seal idiom): arms are
// inset by min(2.4r, 0.42 arm) and a quadratic bezier turns the corner.
function fillet(pts, r, seg) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const d1 = sub(b, a), d2 = sub(c, b);
    const l1 = len(d1), l2 = len(d2);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const u1 = nrm(d1), u2 = nrm(d2);
    if (Math.acos(clamp(dot(u1, u2), -1, 1)) < 0.08) { out.push(b); continue; }
    const d = Math.min(2.4 * r, 0.42 * Math.min(l1, l2));
    const p0 = off(b, u1, -d), p2 = off(b, u2, d);
    const N = seg || 5;
    for (let k = 0; k <= N; k++) {
      const t = k / N, m = 1 - t;
      out.push([m * m * p0[0] + 2 * m * t * b[0] + t * t * p2[0],
                m * m * p0[1] + 2 * m * t * b[1] + t * t * p2[1],
                m * m * p0[2] + 2 * m * t * b[2] + t * t * p2[2]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// resample a polyline to N points at equal arc length — a swept section
// that lags its path reads as a kink, and every taper law below wants an
// even parameter
function resample(pts, N) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + len(sub(pts[i], pts[i - 1])));
  const total = d[d.length - 1] || 1;
  const out = [];
  for (let k = 0; k <= N; k++) {
    const s = total * k / N;
    let i = 0;
    while (i < d.length - 2 && d[i + 1] < s) i++;
    const t = (s - d[i]) / Math.max(1e-9, d[i + 1] - d[i]);
    out.push(lerp3(pts[i], pts[i + 1], t));
  }
  return out;
}
// a quadratic bezier arc, for blade legs and leaf springs
function bez(a, b, c, N) {
  const out = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, m = 1 - t;
    out.push([m * m * a[0] + 2 * m * t * b[0] + t * t * c[0],
              m * m * a[1] + 2 * m * t * b[1] + t * t * c[1],
              m * m * a[2] + 2 * m * t * b[2] + t * t * c[2]]);
  }
  return out;
}

// ---- sections -------------------------------------------------------------
const secRound = (r, sides) => {
  const out = [], S = sides || 14;
  for (let k = 0; k < S; k++) {
    const a = 2 * Math.PI * k / S;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
};
// WIDE, THIN, RADIUSED — a leaf spring or a blade leg. A plain rectangle
// reads as a plank, and the radiused edge is most of what says "spring".
const secBlade = (w, t, arc) => {
  const out = [], A = arc || 3;
  const r = Math.min(t, w) * 0.5;
  const hw = Math.max(1e-4, w / 2 - r), ht = Math.max(1e-4, t / 2 - r);
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= A; k++) {
      const a = a0 + (Math.PI / 2) * k / A;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(hw, ht, 0);
  corner(-hw, ht, Math.PI / 2);
  corner(-hw, -ht, Math.PI);
  corner(hw, -ht, -Math.PI / 2);
  return out;
};

// ---- sweeps ---------------------------------------------------------------
// sect(t, i) -> [[u, v], ...] in the transported (normal, binormal) frame.
// upHint pins the frame's starting normal, which is how a blade keeps its
// flat face square to the aeroplane instead of rolling along the path.
function sweep(bag, path, sect, closeEnds, upHint) {
  const n = path.length;
  if (n < 2) return null;
  const T = path.map((p, i) =>
    nrm(sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)])));
  const proj = (v, t) => {
    const r = sub(v, mul(t, dot(v, t)));
    return len(r) < 1e-7 ? nrm(crs(t, [0, 0, 1])) : nrm(r);
  };
  let N = proj(upHint || (Math.abs(T[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]), T[0]);
  const rings = [];
  for (let i = 0; i < n; i++) {
    N = proj(N, T[i]);
    const B = crs(T[i], N);
    const s = sect(n > 1 ? i / (n - 1) : 0, i);
    rings.push(s.map(([u, v]) =>
      bag.v([path[i][0] + N[0] * u + B[0] * v,
             path[i][1] + N[1] * u + B[1] * v,
             path[i][2] + N[2] * u + B[2] * v])));
  }
  const K = rings[0].length;
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < K; k++) {
      const k2 = (k + 1) % K;
      bag.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]);
    }
  if (closeEnds) {
    const c0 = bag.v(path[0]), c1 = bag.v(path[n - 1]);
    for (let k = 0; k < K; k++) {
      const k2 = (k + 1) % K;
      bag.tri(c0, rings[0][k2], rings[0][k]);
      bag.tri(c1, rings[n - 1][k], rings[n - 1][k2]);
    }
  }
  return rings;
}
// a straight round member
function tube(bag, a, b, r, sides) {
  return sweep(bag, [a, b], () => secRound(r, sides), true);
}
// a tapered round member (fork legs, drag braces, axles)
function taper(bag, a, b, r0, r1, sides) {
  return sweep(bag, resample([a, b], 6),
               t => secRound(r0 + (r1 - r0) * t, sides), true);
}

// ---- revolve --------------------------------------------------------------
// prof = [[radius, along-axis], ...]. This is how every tyre, hub, oleo
// cylinder and swivel housing in the bench is made — the game's G4.6
// wheel rule: a revolved PROFILE, never a cylinder with lids.
function revolve(bag, ctr, axis, prof, segs, cap) {
  const S = segs || 30;
  // signed area of the profile closed back along the axis, in (h, r)
  let A2 = 0;
  {
    const pts = prof.map(([r, hh]) => [hh, r]);
    pts.push([prof[prof.length - 1][1], 0], [prof[0][1], 0]);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      A2 += p[0] * q[1] - q[0] * p[1];
    }
  }
  const flip = A2 > 0;
  const ax = nrm(axis);
  let e1 = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  e1 = nrm(sub(e1, mul(ax, dot(e1, ax))));
  const e2 = crs(ax, e1);
  const rows = prof.map(([r, h]) => {
    const row = [];
    for (let k = 0; k < S; k++) {
      const a = 2 * Math.PI * k / S;
      const c = Math.cos(a) * r, s = Math.sin(a) * r;
      row.push(bag.v([ctr[0] + e1[0] * c + e2[0] * s + ax[0] * h,
                      ctr[1] + e1[1] * c + e2[1] * s + ax[1] * h,
                      ctr[2] + e1[2] * c + e2[2] * s + ax[2] * h]));
    }
    return row;
  });
  for (let i = 0; i < rows.length - 1; i++)
    for (let k = 0; k < S; k++) {
      const k2 = (k + 1) % S;
      if (flip) bag.quad(rows[i + 1][k], rows[i + 1][k2], rows[i][k2], rows[i][k]);
      else bag.quad(rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]);
    }
  if (cap) {
    const c0 = bag.v(off(ctr, ax, prof[0][1]));
    const c1 = bag.v(off(ctr, ax, prof[prof.length - 1][1]));
    for (let k = 0; k < S; k++) {
      const k2 = (k + 1) % S;
      if (flip) {
        bag.tri(c0, rows[0][k], rows[0][k2]);
        bag.tri(c1, rows[rows.length - 1][k2], rows[rows.length - 1][k]);
      } else {
        bag.tri(c0, rows[0][k2], rows[0][k]);
        bag.tri(c1, rows[rows.length - 1][k], rows[rows.length - 1][k2]);
      }
    }
  }
  return rows;
}

// ---- machined shapes ------------------------------------------------------
// a box in an arbitrary frame — brackets, clamp blocks, pads
function boxIn(bag, c, e, X, Y, Z) {
  const p = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    p.push(bag.v([c[0] + X[0] * e[0] * sx + Y[0] * e[1] * sy + Z[0] * e[2] * sz,
                  c[1] + X[1] * e[0] * sx + Y[1] * e[1] * sy + Z[1] * e[2] * sz,
                  c[2] + X[2] * e[0] * sx + Y[2] * e[1] * sy + Z[2] * e[2] * sz]));
  const q = (a, b, c2, d) => bag.quad(p[a], p[b], p[c2], p[d]);
  q(0, 1, 3, 2); q(4, 6, 7, 5); q(0, 4, 5, 1);
  q(2, 3, 7, 6); q(0, 2, 6, 4); q(1, 5, 7, 3);
}
// A LUG: the flat machined tongue with a bored eye that every pivot in an
// undercarriage actually hangs off. Drawn as a rounded blade swept along
// its thickness, so the eye end is a real radius.
function lug(bag, ctr, axis, up, R, t, reach) {
  const ax = nrm(axis), u = nrm(sub(up, mul(ax, dot(up, ax))));
  const path = [off(ctr, ax, -t / 2), off(ctr, ax, t / 2)];
  const sect = () => {
    const out = [], A = 7;
    for (let k = 0; k <= A; k++) {            // the bored eye end
      const a = -Math.PI / 2 + Math.PI * k / A;
      out.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
    out.push([-R * 0.30, R]);                 // waist back to the root
    out.push([-reach, R * 0.72]);
    out.push([-reach, -R * 0.72]);
    out.push([-R * 0.30, -R]);
    return out;
  };
  // the section is authored in (u, along-path); sweep expects (N, B)
  const rings = sweep(bag, path, () => sect().map(([a, b]) => [b, a]),
                      true, u);
  return rings;
}
// a bolt: hex head + shank, for the fitments
function bolt(bag, p, dir, R, L) {
  const d = nrm(dir);
  revolve(bag, p, d, [[R * 0.55, 0], [R * 0.55, L]], 10, true);
  revolve(bag, off(p, d, -R * 0.34), d,
          [[R, 0], [R, R * 0.68]], 6, true);
}

window.GEAR_KIT = {
  clamp, sub, add, mul, len, nrm, dot, crs, off, lerp3, rot,
  Bag, fillet, resample, bez, secRound, secBlade, sweep, tube, taper,
  revolve, boxIn, lug, bolt,
};
})();
