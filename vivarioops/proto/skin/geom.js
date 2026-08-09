// proto/skin/geom.js — the small amount of geometry machinery an anatomy needs.
//
// PROTOTYPE. Nothing here is imported by the app.
//
// ONE PRIMITIVE: A LOFT. A tube swept along a curve with an elliptical
// cross-section that varies per station. That single thing is a trunk, a limb
// AND a fin — a fin is a loft whose cross-section is wide and paper-thin and
// whose chord tapers to a rounded edge. So "different geometry per part class"
// turns out to mean different PROFILE CURVES, not different code, which is why
// there is one builder here and not three.
//
// Lofting rather than reconstructing is the whole reason this file replaced the
// signed-distance experiment. A loft is continuous because it is built
// continuous: consecutive rings are stitched to each other, so there is no seam
// to hide, no grid to resolve, no minimum feature size, and a fin comes out as a
// membrane instead of as whatever a uniform sampling grid could make of one.

import * as THREE from 'three';
import { add, sub, scale, cross, dot, normalise } from '../../engine/l1/vecmath.js';

/**
 * Accumulates one geometry out of many pieces. Every piece writes into the same
 * arrays, so the finished animal is a single draw call regardless of how many
 * limbs it grew.
 */
export function makeBuilder() {
  const P = [], UV = [], SI = [], SW = [], IDX = [];
  // Pairs of vertices that are the same point but carry different u, because a
  // tube has to be cut open somewhere to be given a texture coordinate. Their
  // normals are averaged at the end or the cut shows as a lit line down the body.
  const seams = [];

  function vertex(p, u, v, bones) {
    const i = P.length / 3;
    P.push(p[0], p[1], p[2]);
    UV.push(u, v);
    for (let s = 0; s < 4; s++) {
      SI.push(bones[s] ? bones[s][0] : 0);
      SW.push(bones[s] ? bones[s][1] : 0);
    }
    return i;
  }

  function quad(a, b, c, d) { IDX.push(a, b, c, a, c, d); }
  function tri(a, b, c) { IDX.push(a, b, c); }

  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    g.setIndex(IDX);
    g.computeVertexNormals();

    const n = g.getAttribute('normal');
    for (const [a, b] of seams) {
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l);
      n.setXYZ(b, x / l, y / l, z / l);
    }
    n.needsUpdate = true;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  return {
    vertex, quad, tri, seams, build,
    get vertexCount() { return P.length / 3; },
    get triangleCount() { return IDX.length / 3; },
  };
}

/**
 * Centripetal Catmull-Rom through the control points, plus whatever per-point
 * scalars the caller wants carried along the same parameter.
 *
 * CENTRIPETAL, not uniform: uniform Catmull-Rom overshoots at a sharp control
 * point, and a limb leaving a body at right angles is exactly that. The overshoot
 * shows up as the tube bulging back INTO its parent before setting off, which
 * reads as a broken joint.
 *
 * @param {number[][]} pts   control points
 * @param {number[][]} carry parallel arrays of scalars, one value per control pt
 * @param {number} n         samples out
 */
export function resample(pts, carry, n) {
  const m = pts.length;
  const at = (i) => pts[Math.max(0, Math.min(m - 1, i))];
  const out = { p: [], c: carry.map(() => []) };

  // Centripetal knots: t_{i+1} = t_i + |P_{i+1} - P_i|^0.5
  const knots = [0];
  for (let i = 1; i < m; i++) {
    const d = Math.hypot(...sub(pts[i], pts[i - 1]));
    knots.push(knots[i - 1] + Math.max(1e-4, Math.sqrt(d)));
  }
  const total = knots[m - 1];

  for (let s = 0; s < n; s++) {
    const t = (s / (n - 1)) * total;
    let seg = 0;
    while (seg < m - 2 && knots[seg + 1] < t) seg++;
    const t0 = knots[seg], t1 = knots[seg + 1];
    const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;

    const p0 = at(seg - 1), p1 = at(seg), p2 = at(seg + 1), p3 = at(seg + 2);
    const u2 = u * u, u3 = u2 * u;
    const q = [];
    for (let a = 0; a < 3; a++) {
      q.push(0.5 * (
        2 * p1[a] +
        (-p0[a] + p2[a]) * u +
        (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * u2 +
        (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * u3
      ));
    }
    out.p.push(q);
    // Carried scalars stay LINEAR. They are things like "which body is this" —
    // a spline through them would overshoot past the last body and index nothing.
    carry.forEach((arr, ci) => out.c[ci].push(arr[seg] + (arr[seg + 1] - arr[seg]) * u));
  }
  return out;
}

/**
 * Rotation-minimising frames along a polyline.
 *
 * The naive alternative — rebuild the frame at every station from a fixed world
 * up-vector — spins the cross-section as the curve turns, and on an elliptical
 * section that spin is visible as the body corkscrewing along its own length.
 * Transporting the previous frame instead means the section only rotates as much
 * as the curve forces it to.
 *
 * THE STEP IS A ROTATION, NOT A REFLECTION. Reflecting the frame across the
 * bisector of the two tangents does carry T[i-1] onto T[i] — it is the obvious
 * one-liner, and it is wrong, because a reflection reverses handedness. Applied
 * once per station it flips the frame's chirality on every station, so an
 * elliptical section swaps its major and minor axes all the way down the body.
 * On a straight chain nothing shows. On a curved one it renders as a concertina,
 * and it took a contact sheet of sixteen genomes to see that the fold frequency
 * was the STATION count and not the body count.
 *
 * @param {number[][]} pts
 * @param {number[]} up0  preferred initial normal (the first body's local X)
 */
export function frames(pts, up0) {
  const n = pts.length;
  const T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let t = sub(b, a);
    if (Math.hypot(...t) < 1e-9) t = [0, 0, 1];
    T.push(normalise(t));
  }
  let nrm = sub(up0, scale(T[0], dot(up0, T[0])));
  if (Math.hypot(...nrm) < 1e-6) {
    const alt = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    nrm = sub(alt, scale(T[0], dot(alt, T[0])));
  }
  nrm = normalise(nrm);
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      // Rodrigues: rotate the previous normal by the minimal rotation carrying
      // the previous tangent onto this one.
      const axis = cross(T[i - 1], T[i]);
      const s = Math.hypot(...axis);
      if (s > 1e-9) {
        const k = scale(axis, 1 / s);
        const ang = Math.atan2(s, dot(T[i - 1], T[i]));
        const c = Math.cos(ang), sn = Math.sin(ang);
        nrm = add(
          add(scale(nrm, c), scale(cross(k, nrm), sn)),
          scale(k, dot(k, nrm) * (1 - c)),
        );
      }
      nrm = normalise(sub(nrm, scale(T[i], dot(nrm, T[i]))));
    }
    N.push(nrm.slice());
    B.push(normalise(cross(T[i], nrm)));
  }
  return { T, N, B };
}

/**
 * Angles that walk an ellipse in EQUAL ARCLENGTH steps rather than equal angle.
 *
 * On a circle the two agree and this is wasted work. On a fin they do not: for a
 * section 1.4 wide and 0.19 thick, equal angles put most of the vertices around
 * the two thin tips, where dx/dtheta is small, and leave the broad faces — which
 * are the whole fin — described by three points each. The blade then reads as a
 * polygon. Equal arclength spends the vertices where the surface actually is.
 *
 * Sampled and inverted numerically because the ellipse perimeter has no
 * elementary form, and 64 samples is far more accuracy than 14 output vertices
 * can use.
 */
function ringAngles(rx, ry, n) {
  const M = 64;
  const cum = new Float64Array(M + 1);
  let px = rx, py = 0;
  for (let i = 1; i <= M; i++) {
    const th = (i / M) * Math.PI * 2;
    const x = rx * Math.cos(th), y = ry * Math.sin(th);
    cum[i] = cum[i - 1] + Math.hypot(x - px, y - py);
    px = x; py = y;
  }
  const total = cum[M] || 1;
  const out = new Float64Array(n);
  let k = 0;
  for (let j = 0; j < n; j++) {
    const target = (j / n) * total;
    while (k < M && cum[k + 1] < target) k++;
    const span = cum[k + 1] - cum[k];
    const f = span > 0 ? (target - cum[k]) / span : 0;
    out[j] = ((k + f) / M) * Math.PI * 2;
  }
  return out;
}

/**
 * Sweep a closed elliptical section along a framed curve.
 *
 * @param {object} b        builder
 * @param {object} path     { p, T, N, B } arrays, one entry per station
 * @param {object} spec
 * @param {number[]} spec.rx   half-width per station, along N
 * @param {number[]} spec.ry   half-height per station, along B
 * @param {number[]} spec.v    texture v per station
 * @param {number} spec.radial vertices around
 * @param {(i:number)=>Array} spec.bonesAt  skin binding per station
 * @param {boolean} [spec.capStart=true]
 * @param {boolean} [spec.capEnd=true]
 */
export function loft(b, path, spec) {
  const { p, T, N, B } = path;
  const { rx, ry, v, radial, bonesAt } = spec;
  const S = p.length;
  const rings = [];

  for (let i = 0; i < S; i++) {
    const bones = bonesAt(i);
    const ring = [];
    const th0 = ringAngles(rx[i], ry[i], radial);
    // radial + 1 vertices: the last is the first again, so u can reach 1.
    for (let c = 0; c <= radial; c++) {
      const th = c === radial ? Math.PI * 2 : th0[c];
      const ct = Math.cos(th), st = Math.sin(th);
      const q = [
        p[i][0] + N[i][0] * rx[i] * ct + B[i][0] * ry[i] * st,
        p[i][1] + N[i][1] * rx[i] * ct + B[i][1] * ry[i] * st,
        p[i][2] + N[i][2] * rx[i] * ct + B[i][2] * ry[i] * st,
      ];
      ring.push(b.vertex(q, c / radial, v[i], bones));
    }
    b.seams.push([ring[0], ring[radial]]);
    rings.push(ring);
  }

  for (let i = 0; i + 1 < S; i++) {
    for (let c = 0; c < radial; c++) {
      b.quad(rings[i][c], rings[i][c + 1], rings[i + 1][c + 1], rings[i + 1][c]);
    }
  }

  if (spec.capStart !== false) cap(b, rings[0], p[0], T[0], -1, v[0], bonesAt(0), radial);
  if (spec.capEnd !== false) cap(b, rings[S - 1], p[S - 1], T[S - 1], 1, v[S - 1], bonesAt(S - 1), radial);

  return rings;
}

/** A single pole vertex fanned to the end ring. The profile has already brought
 *  the radius almost to nothing, so this closes the surface without a visible
 *  flat disc. */
function cap(b, ring, centre, tangent, sign, v, bones, radial) {
  const pole = b.vertex(add(centre, scale(tangent, 0)), 0.5, v, bones);
  for (let c = 0; c < radial; c++) {
    if (sign < 0) b.tri(pole, ring[c + 1], ring[c]);
    else b.tri(pole, ring[c], ring[c + 1]);
  }
}

/** Smoothstep, clamped. The shape of every profile in anatomy.js. */
export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}
