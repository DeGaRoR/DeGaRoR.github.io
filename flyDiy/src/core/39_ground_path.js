// ============================================================
// THE GROUND PATH (G193) — a declared pattern graph, sampled into a path
// the pilots can FOLLOW rather than chase.
//
// The user, 2026-09-05: "the current taxi pattern is wrong, the plane cuts
// corners. It should do mostly 90° turns (smoothed out), and complete a
// graph dot-arc and try to follow that. We need the notion of stop point,
// where the plane lines up and completely stops before taking off."
//
// Two facts drove the shape of this file. The old TAXI was pure pursuit at a
// single waypoint with a 10/22 m capture radius — it could not hold a LEG,
// only a point, so every corner was cut by the capture radius. And the
// aeroplane it was flying could not make the corner anyway: a tailwheel
// steer is a rear-steered bicycle, R = Lwb / tan(|twSteer| · dr), which on
// the user's ultralight at the ±0.45 rudder clamp is 20.8 m — the taxiway's
// 12 m corners were physically out of reach at the travel the pilot allowed.
// So the path carries its CURVATURE, the follower feeds that curvature
// forward into the rudder (the PD only trims), the taxi speed comes down for
// the bend ahead, and the rudder may use its whole travel at taxi speed.
//
// PURE: no THREE, no DOM, no solver. 25_airfield.js declares the pattern,
// 40_/41_ follow it, pattern_vis.js draws it, GATE SITE and GATE TAKEOFF
// measure it — all off this one sampling, so the ribbon on the ground is the
// line the aeroplane is steering to.
//
// THE PATTERN'S SHAPE (sitePattern, 25_airfield.js):
//   nodes[]      { id, x, z, kind, r?, hdg? }   kind: stand | apron | gate |
//                entry | taxi | hold. `r` is the corner's own fillet radius
//                (else pattern.fillet); a `hold` carries the lined-up heading.
//   arcs[]       [idA, idB] — the graph's edges, for the drawing
//   routes       { out: [ids by take-off direction T], back: [...] }
//   stops[]      the hold ids
//   approaches[] one per LANDING direction k (see 25_airfield.js)
//
// THE SAMPLED PATH (patternPath):
//   pts[]  { x, z, hdg, kap, s }  hdg = atan2(dz, dx) of the tangent, kap the
//          signed curvature (+ = turning toward increasing atan2, the same
//          sense as the pilots' heading error `e`), s the arc length
//   len, sEnd, sStop (= sEnd when the last node is a hold), rMin (the
//   smallest fillet actually drawn — a corner too tight for its legs is
//   REDUCED and reported, never silently drawn wrong).
// ============================================================

const GP_DS = 1.0;                 // sample spacing, metres
const GP_MAXPTS = 4000;

function gpUnit(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1e-9;
  return [dx / l, dz / l, l];
}
// left of a direction in the (x, z) plane, the +atan2 side
function gpLeft(ux, uz) { return [-uz, ux]; }

// pattern + an ordered list of node ids -> the sampled path. `from` (optional,
// [x, z]) is a start point PREPENDED as a node, so a route that begins where
// the aeroplane happens to be gets a real join leg and a real fillet at the
// first declared node, instead of a jump.
function patternPath(pattern, ids, ds, from) {
  ds = ds || GP_DS;
  const byId = {};
  for (const n of pattern.nodes) byId[n.id] = n;
  const nodes = [];
  if (from && isFinite(from[0]) && isFinite(from[1])) {
    const n0 = byId[ids[0]];
    if (!n0 || Math.hypot(from[0] - n0.x, from[1] - n0.z) > 1.0)
      nodes.push({ id: '@', x: from[0], z: from[1], kind: 'pose' });
  }
  for (const id of ids) { const n = byId[id]; if (n) nodes.push(n); }
  if (nodes.length < 2) return { pts: [], len: 0, sEnd: 0, sStop: null, rMin: Infinity, ids };
  // straight-through nodes (< 2 deg of bend) are drawn dots, not corners: the
  // fillet legs are measured between CORNERS and endpoints
  const isCorner = new Array(nodes.length).fill(false);
  for (let i = 1; i < nodes.length - 1; i++) {
    const [u1x, u1z] = gpUnit(nodes[i - 1].x, nodes[i - 1].z, nodes[i].x, nodes[i].z);
    const [u2x, u2z] = gpUnit(nodes[i].x, nodes[i].z, nodes[i + 1].x, nodes[i + 1].z);
    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1z * u2z));
    isCorner[i] = Math.acos(dot) > 2 * Math.PI / 180;
  }
  // the corner list with its legs to the previous / next corner-or-endpoint
  const cIdx = [];
  for (let i = 0; i < nodes.length; i++)
    if (i === 0 || i === nodes.length - 1 || isCorner[i]) cIdx.push(i);
  // tangent length per corner, clamped so neighbouring fillets never overlap
  const tan = {}, rEff = {};
  let rMin = Infinity;
  for (let k = 1; k < cIdx.length - 1; k++) {
    const i = cIdx[k], A = nodes[cIdx[k - 1]], B = nodes[i], C = nodes[cIdx[k + 1]];
    const [u1x, u1z, l1] = gpUnit(A.x, A.z, B.x, B.z);
    const [u2x, u2z, l2] = gpUnit(B.x, B.z, C.x, C.z);
    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1z * u2z));
    const th = Math.acos(dot);
    const r = B.r != null ? B.r : (pattern.fillet != null ? pattern.fillet : 12);
    let t = r * Math.tan(th / 2);
    const tMax = 0.5 * Math.min(l1, l2);
    if (t > tMax) t = tMax;
    const re = t / Math.max(1e-9, Math.tan(th / 2));
    tan[i] = t; rEff[i] = re;
    if (re < rMin) rMin = re;
  }
  // walk corner to corner: straight to the fillet's start, the arc, on
  const pts = [];
  let s = 0;
  const push = (x, z, hdg, kap) => {
    if (pts.length) {
      const q = pts[pts.length - 1];
      s += Math.hypot(x - q.x, z - q.z);
    }
    pts.push({ x, z, hdg, kap, s });
  };
  const straight = (ax, az, bx, bz) => {
    const [ux, uz, l] = gpUnit(ax, az, bx, bz);
    const hdg = Math.atan2(uz, ux);
    if (!pts.length) push(ax, az, hdg, 0);
    const n = Math.max(1, Math.round(l / ds));
    for (let i = 1; i <= n; i++) push(ax + ux * l * i / n, az + uz * l * i / n, hdg, 0);
  };
  let cur = [nodes[cIdx[0]].x, nodes[cIdx[0]].z];
  for (let k = 1; k < cIdx.length; k++) {
    const i = cIdx[k], B = nodes[i];
    if (k === cIdx.length - 1) { straight(cur[0], cur[1], B.x, B.z); break; }
    const A = nodes[cIdx[k - 1]], C = nodes[cIdx[k + 1]];
    const [u1x, u1z] = gpUnit(A.x, A.z, B.x, B.z);
    const [u2x, u2z] = gpUnit(B.x, B.z, C.x, C.z);
    const t = tan[i], r = rEff[i];
    const P1 = [B.x - u1x * t, B.z - u1z * t], P2 = [B.x + u2x * t, B.z + u2z * t];
    straight(cur[0], cur[1], P1[0], P1[1]);
    // the arc: centre off P1 on the turning side; sign = the turn's sense
    const cr = u1x * u2z - u1z * u2x;          // + = toward increasing atan2
    const sg = cr >= 0 ? 1 : -1;
    const [lx, lz] = gpLeft(u1x, u1z);
    const cx = P1[0] + sg * lx * r, cz = P1[1] + sg * lz * r;
    const a0 = Math.atan2(P1[1] - cz, P1[0] - cx);
    const a1 = Math.atan2(P2[1] - cz, P2[0] - cx);
    let dA = a1 - a0;
    while (dA > Math.PI) dA -= 2 * Math.PI;
    while (dA < -Math.PI) dA += 2 * Math.PI;
    const n = Math.max(2, Math.ceil(Math.abs(dA) * r / ds));
    for (let j = 1; j <= n; j++) {
      const a = a0 + dA * j / n;
      const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
      // the tangent turns with the arc: heading = radius angle +/- 90 deg
      const hdg = a + sg * Math.PI / 2;
      push(x, z, Math.atan2(Math.sin(hdg), Math.cos(hdg)), sg / r);
    }
    cur = P2;
  }
  if (pts.length > GP_MAXPTS) pts.length = GP_MAXPTS;
  const last = nodes[nodes.length - 1];
  return { pts, len: s, sEnd: s, sStop: last.kind === 'hold' ? s : null,
           rMin, ids: nodes.map(n => n.id), holdHdg: last.hdg };
}

// the nearest path point to (x, z), searched MONOTONICALLY from the last
// index so the aeroplane cannot latch onto a later leg that passes nearby (the
// U-turn's two legs are 22 m apart). Returns the index, the signed cross-track
// (+ = the aeroplane is on the path's left, the +atan2 side) and the length
// still to run.
function pathLocate(path, i0, x, z) {
  const P = path.pts;
  if (!P.length) return { i: 0, ey: 0, sRem: 0, dist: 0 };
  const a = Math.max(0, (i0 | 0) - 5), b = Math.min(P.length - 1, (i0 | 0) + 60);
  let best = a, bd = Infinity;
  for (let i = a; i <= b; i++) {
    const d = (P[i].x - x) * (P[i].x - x) + (P[i].z - z) * (P[i].z - z);
    if (d < bd) { bd = d; best = i; }
  }
  const q = P[best];
  const tx = Math.cos(q.hdg), tz = Math.sin(q.hdg);
  const dx = x - q.x, dz = z - q.z;
  const ey = tx * dz - tz * dx;
  return { i: best, ey, sRem: path.len - q.s, dist: Math.sqrt(bd) };
}

// what is AHEAD: the tangent heading and curvature a lookahead away, and the
// tightest bend within the stopping distance, for the speed governor
function pathLook(path, i, Vg) {
  const P = path.pts;
  if (!P.length) return { hdgL: 0, kapL: 0, kapMax: 0 };
  const La = Math.max(3, Math.min(8, 0.8 * Vg + 2));
  const s0 = P[Math.min(i, P.length - 1)].s;
  let j = i;
  while (j < P.length - 1 && P[j].s - s0 < La) j++;
  const dLook = Vg * Vg / (2 * 0.5) + 6;
  let kapMax = 0, k = i;
  while (k < P.length && P[k].s - s0 <= dLook) { kapMax = Math.max(kapMax, Math.abs(P[k].kap)); k++; }
  return { hdgL: P[j].hdg, kapL: P[j].kap, kapMax };
}

// the taxi speed this stretch allows: the cap, the bend ahead (1 m/s^2 of
// lateral acceleration), and the stop at the end of the path (0.5 m/s^2)
function pathSpeed(path, i, Vg, Vmax, sRem) {
  const K = pathLook(path, i, Vg);
  let v = Vmax;
  if (K.kapMax > 1e-6) v = Math.min(v, Math.sqrt(1.0 / K.kapMax));
  if (path.sStop != null) v = Math.min(v, Math.sqrt(2 * 0.5 * Math.max(0, sRem - 1.5)));
  return Math.max(0, v);
}

// the tightest turn this aeroplane can taxi: a rear-steered bicycle,
// wheelbase over the tangent of the steer angle at `drMax` of rudder
function groundRmin(def, drMax) {
  const N = def.nodes, R = def.refs;
  if (!R || !R.mains || !R.mains.length || R.tw == null || R.tw < 0) return Infinity;
  const mx = R.mains.reduce((s, i) => s + N[i].p[0], 0) / R.mains.length;
  const Lwb = Math.abs(N[R.tw].p[0] - mx);
  const st = Math.abs((def.params && def.params.twSteer) || 0.5) * (drMax || 0.85);
  return Lwb / Math.max(1e-6, Math.tan(st));
}

if (typeof module !== 'undefined') {
  module.exports = { patternPath, pathLocate, pathLook, pathSpeed, groundRmin,
                     GP_DS };
}
