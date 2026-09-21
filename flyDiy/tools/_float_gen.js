'use strict';
// FLOAT_GEN — THE DRAWN WIPLINE (G451, 2026-09-20).
//
// The float the builder sees, built from the SAME hull the water pushes on
// (src/core/32_hydro.js: sectionOf / keelOf / deckAt — one section family,
// read here at drawing resolution, read there at panel resolution). Pure
// geometry, no THREE: every part comes back as { pos: number[], idx:
// number[] } in the MODEL frame (x aft of the step, y up from the step
// keel, z right), and the layer (tools/_cage_float.js) turns each into a
// mesh in its own material. Runs under node for GATE WIPLINE.
//
// WHAT IS DRAWN, and why it is drawn this way (the user's brief, item by
// item — "proper profile and sections", "the paddle properly placed",
// "modeling of the protrusions", "a handful of details", "proper high
// quality bevels on hard edges", "proper continuous geometry"):
//
//   THE HULL is ONE indexed mesh: ~90 rings of 30 shared vertices lofted
//   bow to stern, the bow closing on a single point, the transom closed by
//   a filleted cap. Every hard edge of a real float is an extrusion with a
//   radius, and every one here is a FILLET LOOP — the keel (rKeel), the
//   chine (rChine), the gunwale (rGun), the step's lip (rLip), the transom's
//   edge (rTransom) — with a SUPPORT LOOP on each flat beside it, so the
//   area-weighted vertex normals of the big flat facets do not smear into
//   the fillet (the shading gradient stays inside the radius, where the
//   highlight belongs). A fillet whose radius would not fit the edge it
//   sits on is shrunk to fit (the bow's last rings are millimetres).
//
//   THE PROTRUSIONS ride on the skin, each its own closed strip swept along
//   the hull's own lines: the keel bar, the two sister keelsons on the
//   forebody bottom (at skZ of the chine half-beam, following the warped
//   deadrise), the chine spray straps (forebody), the rubber nose bumper
//   (the stem's own rings offset along their normals, walled at the back).
//
//   THE DETAILS, from the 2350 parts manual's deck and hardware sections:
//   inspection covers (large and small alternating, one per watertight
//   bay, screwed round), the baggage hatch ahead of the step (hinge line
//   outboard, two flush latch rings), a pump-out cup per bay on the
//   outboard deck, a tie-down cleat on the bow deck and on the stern deck,
//   the spreader-bar deck blocks and the strut fitting plates at the two
//   rigging stations; the non-skid deck as a coating overlay with a painted
//   margin at the gunwale.
//
//   THE WATER RUDDER is its own part: the post on the transom in its two
//   bearing brackets, the bellcrank on top with its two steering cables
//   running forward to a pulley bracket, two arms on a horizontal pivot at
//   the post's foot, and the blade — its area and depth are the hull's
//   wrArea / wrDepth, the numbers 32_hydro's waterRudder() reads, so the
//   blade the water feels is the blade that is drawn. The part carries its
//   pivots so the game can steer it (about the post) and retract it (about
//   the arm pivot), see app.js.
//
//   THE PADDLE — the canoe paddle every Wipline carries clipped along the
//   INBOARD side skin of the forebody, under the gunwale, blade forward
//   (the parts manual: "BRACKET (PADDLE), PADDLE STOP, CLIP (HOLDS
//   PADDLE), PADDLES" on the step-to-bow side skin) — is a real-size paddle
//   (it does not scale with the float), on the side the caller says.
//
// UNITS: metres. `sc` below is the hull's size against the family's
// default (P.scale, or L / DEF.L): the hardware scales with it, the paddle
// does not.
(function () {

const D2R = Math.PI / 180;

// ---- small vectors ---------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const L = len(a) || 1e-12; return [a[0] / L, a[1] / L, a[2] / L]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---- the bag: an indexed triangle soup with vertex welding ------------------
// Welding is what makes the loft CONTINUOUS: a ring's shared points (the
// keel, the deck centre, the bow tip every ring collapses onto) resolve to
// one vertex, and a quad with two equal corners becomes the triangle it is.
function Bag(weld) {
  const pos = [], idx = [], map = new Map();
  const key = p => (Math.round(p[0] * 2e4) + ',' + Math.round(p[1] * 2e4) + ',' + Math.round(p[2] * 2e4));
  const B = {
    v(p) {
      if (weld) { const k = key(p); const h = map.get(k); if (h != null) return h; map.set(k, pos.length / 3); }
      pos.push(p[0], p[1], p[2]); return pos.length / 3 - 1;
    },
    tri(a, b, c) { if (a === b || b === c || a === c) return; idx.push(a, b, c); },
    quad(a, b, c, d) { B.tri(a, b, c); B.tri(a, c, d); },
    get n() { return pos.length / 3; },
    get tris() { return idx.length / 3; },
    out() { return { pos, idx }; },
    pos, idx,
  };
  return B;
}
// area-weighted vertex normals of a bag (for the bumper's offset shell and
// the gate's checks)
function vertexNormals(B) {
  const N = new Float64Array(B.pos.length);
  const p = B.pos, ix = B.idx;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) { const L = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= L; N[i + 1] /= L; N[i + 2] /= L; }
  return N;
}
// signed volume (positive = outward winding) and the closure sum of a bag
function meshStats(B) {
  const p = B.pos, ix = B.idx;
  let vol = 0, sx = 0, sy = 0, sz = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const A = [p[a], p[a + 1], p[a + 2]], Bv = [p[b], p[b + 1], p[b + 2]], C = [p[c], p[c + 1], p[c + 2]];
    const n = crs(sub(Bv, A), sub(C, A));
    sx += n[0]; sy += n[1]; sz += n[2];
    vol += dot(A, n) / 6;
  }
  // open edges: every directed edge must have its reverse
  const E = new Map();
  for (let t = 0; t < ix.length; t += 3)
    for (let k = 0; k < 3; k++) { const a = ix[t + k], b = ix[t + (k + 1) % 3]; E.set(a + '>' + b, (E.get(a + '>' + b) || 0) + 1); }
  let open = 0;
  for (const [k, n] of E) { const [a, b] = k.split('>'); if (!E.has(b + '>' + a) || n !== 1) open++; }
  return { vol, closure: [sx / 2, sy / 2, sz / 2], open, tris: ix.length / 3, verts: p.length / 3 };
}

// ---- the section, at drawing resolution -----------------------------------
// One side (z >= 0) of a ring, keel to the deck centre, as [y, z] points with
// their 2D outward normals: K, the keel round, the bottom, the chine round,
// the side, the gunwale round, the deck margin, the deck centre. Every ring
// has the same point count, whatever the fillets could fit, so the loft is
// a regular grid — that is what lets the rings weld into one surface.
const NK = 2, NC = 3, NG = 4;                 // arc points: keel (half), chine, gunwale
function ringSide(P, s, o) {
  const rKeel = Math.min(o.rKeel, 0.45 * s.b), rC = Math.min(o.rChine, 0.30 * s.b, 0.30 * (s.yd - s.yc));
  const rG = Math.min(o.rGun, 0.30 * (s.yd - s.yc), 0.30 * s.bd, 0.30 * (s.bd - 0));
  const pts = [];
  const push = (y, z, ny, nz) => pts.push([y, z, ny, nz]);
  const tb = Math.tan(s.beta * D2R), cb = Math.cos(s.beta * D2R), sb = Math.sin(s.beta * D2R);
  // the bottom's outward normal (down and out) and the side's
  const nB = [-cb, sb];                        // [ny, nz]
  // the side's slope from the section's own chine and deck edge (the flare
  // dies toward the bow where the deck closes to its point)
  const fl = Math.atan2(s.bd - s.b, Math.max(1e-6, s.yd - s.yc));
  const tf = Math.tan(fl), cf = Math.cos(fl), sf = Math.sin(fl);
  const nS = [-sf, cf];                        // the side leans out by the flare: normal tilts down a hair
  // 1. the keel: a round of radius rKeel between the two bottom planes —
  //    the centre sits rKeel / cos(beta) above the keel on the centreline
  const yK0 = s.yk;
  const cK = [yK0 + rKeel / Math.max(0.2, cb), 0];
  const aK = s.beta * D2R;                     // the round turns from straight down to the bottom's normal
  push(cK[0] - rKeel, 0, -1, 0);               // K itself, on the centreline
  for (let i = 1; i <= NK; i++) {
    const a = -Math.PI / 2 + aK * i / NK;      // from straight down toward the bottom's normal
    push(cK[0] + rKeel * Math.sin(a), cK[1] + rKeel * Math.cos(a), Math.sin(a), Math.cos(a));
  }
  // the keel round's end on the bottom (z = r sin beta), and its support
  const tK = rKeel * sb;
  const onB = z => yK0 + z * tb;               // the bottom's y at z
  const zKs = Math.min(tK + 1.6 * rKeel, 0.45 * s.b);
  push(onB(zKs), zKs, nB[0], nB[1]);
  // 2. the chine round: centre inside, at distance rC from both the bottom and the side
  //    bisector of the bottom's and the side's inward normals
  const iB = [cb, -sb], iS = [sf, -cf];        // inward normals
  const bis = [iB[0] + iS[0], iB[1] + iS[1]]; const bl = Math.hypot(bis[0], bis[1]) || 1; bis[0] /= bl; bis[1] /= bl;
  const half = Math.acos(Math.max(-1, Math.min(1, iB[0] * iS[0] + iB[1] * iS[1]))) / 2;   // half the angle between the normals
  const dC = rC / Math.max(0.2, Math.cos(half));
  const cC = [s.yc + bis[0] * dC, s.b + bis[1] * dC];
  const tC = rC * Math.tan(half);              // tangent length along each face
  // support on the bottom, then the arc from the bottom's normal to the side's
  const zCs = Math.max(zKs + 1e-4, s.b - tC * Math.min(2.2, 0.35 * s.b / Math.max(1e-6, tC)) * cb);
  push(onB(zCs), zCs, nB[0], nB[1]);
  const a0 = Math.atan2(nB[1], nB[0]), a1 = Math.atan2(nS[1], nS[0]);
  for (let i = 0; i <= NC; i++) {
    const a = a0 + (a1 - a0) * i / NC;
    push(cC[0] + rC * Math.cos(a), cC[1] + rC * Math.sin(a), Math.cos(a), Math.sin(a));
  }
  // 3. the side: support above the chine round, support below the gunwale round
  const onS = y => s.b + (y - s.yc) * tf;      // the side's z at y
  const yCs = s.yc + Math.min(2.2 * tC, 0.35 * (s.yd - s.yc)) * cf;
  push(yCs, onS(yCs), nS[0], nS[1]);
  // the gunwale: between the side (normal nS) and the deck (normal up)
  const iD = [-1, 0];
  const bisG = [iS[0] + iD[0], iS[1] + iD[1]]; const gl = Math.hypot(bisG[0], bisG[1]) || 1; bisG[0] /= gl; bisG[1] /= gl;
  const halfG = Math.acos(Math.max(-1, Math.min(1, iS[0] * iD[0] + iS[1] * iD[1]))) / 2;
  const dG = rG / Math.max(0.2, Math.cos(halfG));
  const cG = [s.yd + bisG[0] * dG, s.bd + bisG[1] * dG];
  const tG = rG * Math.tan(halfG);
  const yGs = Math.max(yCs + 1e-4, s.yd - Math.min(2.2 * tG, 0.35 * (s.yd - s.yc)) * cf);
  push(yGs, onS(yGs), nS[0], nS[1]);
  const g0 = Math.atan2(nS[1], nS[0]), g1 = Math.atan2(0, 1);      // to straight up
  for (let i = 0; i <= NG; i++) {
    const a = g0 + (g1 - g0) * i / NG;
    push(cG[0] + rG * Math.cos(a), cG[1] + rG * Math.sin(a), Math.cos(a), Math.sin(a));
  }
  // 4. the deck margin support and the deck centre
  const zD = Math.max(0, cG[1] - Math.min(2.2 * tG + o.margin, 0.45 * s.bd));
  push(s.yd, zD, 1, 0);
  push(s.yd, 0, 1, 0);
  return pts;
}
const RING_N = 1 + NK + 1 + 1 + (NC + 1) + 1 + 1 + (NG + 1) + 1 + 1;   // points a side, incl. K and the centre
// which ring points belong to the BOTTOM (they wrap round the step's lip
// and rise by the step); the rest is side and deck, continuous across it
const BOTTOM_N = 1 + NK + 1 + 1 + (NC + 1) - 1;   // through the chine arc's penultimate point

// a full ring as 3D points: starboard side keel -> centre, then port side
// centre -> keel, so consecutive points are neighbours and the loop closes
// on K. Also the 2D normals, for the transom fillet.
function ringAt(P, HY, x, o, xEval) {
  const s = HY.sectionOf(P, xEval != null ? xEval : (x === 0 ? -1e-9 : x));
  // the bow tip is ONE point (the keel round would lift K a tenth of a
  // millimetre off the deck point and leave a 0.1 mm ring the weld cannot
  // close: two open edges on every hull)
  const side = s.b < 1e-4 ? ringSide(P, s, o).map(() => [s.yd, 0, -1, 0]) : ringSide(P, s, o);
  const R = [], N = [];
  for (const q of side) { R.push([x, q[0], q[1]]); N.push([0, q[2], q[3]]); }
  for (let i = side.length - 2; i >= 1; i--) { const q = side[i]; R.push([x, q[0], -q[1]]); N.push([0, q[2], -q[3]]); }
  return { R, N, s };
}
// the ring's index of each point's mirror and whether it is a bottom point
const RING_LEN = 2 * RING_N - 2;
const isBottom = i => (i < BOTTOM_N) || (i > RING_LEN - BOTTOM_N);

// ---- the hull ----------------------------------------------------------------
function buildHull(P, HY, o) {
  const B = Bag(true);
  const rings = [];                              // [{ R, N, x }]
  const xs = P.xs, LA = P.L - P.xs;
  const K = HY.keelOf(P);
  const rLip = Math.min(o.rLip, 0.4 * P.hs), rT = o.rTransom;
  // forebody stations: cosine-crowded toward the bow, the tip last
  const nF = o.nF || 56;
  const stas = [];
  for (let i = nF; i >= 1; i--) { const u = i / nF; stas.push(-xs * Math.sin(0.5 * Math.PI * u)); }   // sin: the spacing vanishes at the tip
  // the last forebody ring sits rLip ahead of the step (the lip's support)
  const xLipS = -rLip * 2.2;
  const fore = stas.filter(x => x < xLipS - 1e-6);
  fore.push(xLipS);
  fore.push(-rLip);
  for (const x of fore) { const r = ringAt(P, HY, x, o); rings.push({ R: r.R, N: r.N, x }); }
  // THE LIP: the bottom points wrap round a quarter circle of rLip from
  // the bottom (facing down) to the step face (facing aft); the side and
  // deck points advance to x = 0 with them
  const base = ringAt(P, HY, -rLip, o);
  for (let k = 1; k <= 3; k++) {
    const th = (Math.PI / 2) * k / 3;
    const xr = -rLip + rLip * Math.sin(th);
    const R = base.R.map((p, i) => isBottom(i) ? [xr, p[1] + rLip * (1 - Math.cos(th)), p[2]] : [xr, p[1], p[2]]);
    rings.push({ R, N: base.N, x: xr, lip: true });
  }
  // the afterbody's first ring: the step's top, same x, bottom raised
  const nA = o.nA || 22;
  const aft = [];
  for (let i = 0; i <= nA; i++) aft.push(1e-9 + (LA - rT * 2.2) * i / nA);
  aft.push(LA - rT);
  for (const x of aft) { const r = ringAt(P, HY, x, o); rings.push({ R: r.R, N: r.N, x }); }
  // THE TRANSOM: every point wraps round rT from the side (its 2D normal)
  // to the aft face, then the inset polygon is capped
  const last = rings[rings.length - 1];
  const inset = [];
  for (let k = 1; k <= 3; k++) {
    const th = (Math.PI / 2) * k / 3;
    const xr = LA - rT + rT * Math.sin(th);
    const R = last.R.map((p, i) => { const n = last.N[i]; return [xr, p[1] - n[1] * rT * (1 - Math.cos(th)), p[2] - n[2] * rT * (1 - Math.cos(th))]; });
    rings.push({ R, N: last.N, x: xr });
    if (k === 3) inset.push(...R);
  }
  // the loft: quads between consecutive rings, winding so the normal points OUT
  // (checked by meshStats: the signed volume must be positive)
  const ids = rings.map(r => r.R.map(p => B.v(p)));
  for (let i = 0; i + 1 < ids.length; i++) {
    const a = ids[i], b = ids[i + 1];
    for (let k = 0; k < RING_LEN; k++) {
      const k2 = (k + 1) % RING_LEN;
      B.quad(a[k], b[k], b[k2], a[k2]);
    }
  }
  // the transom cap: a fan from its centroid (the inset polygon is convex)
  {
    const c = [0, 0, 0];
    for (const p of inset) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    const cc = B.v(mul(c, 1 / inset.length));
    const ii = ids[ids.length - 1];
    for (let k = 0; k < RING_LEN; k++) B.tri(cc, ii[(k + 1) % RING_LEN], ii[k]);
  }
  return { bag: B, rings, ids };
}

// ---- strips on the skin --------------------------------------------------------
// a closed strip swept along a path with an explicit frame per station:
// sect = [[u, v], ...] in (B, N) — B across, N the outward normal
function stripSweep(bag, path, frames, sect, closeEnds) {
  const rings = [];
  for (let i = 0; i < path.length; i++) {
    const { N, B } = frames[i];
    rings.push(sect.map(([u, v]) => bag.v(add(path[i], add(mul(B, u), mul(N, v))))));
  }
  const K = sect.length;
  for (let i = 0; i + 1 < rings.length; i++)
    for (let k = 0; k < K; k++) { const k2 = (k + 1) % K; bag.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]); }
  if (closeEnds) {
    const c0 = bag.v(path[0]), c1 = bag.v(path[path.length - 1]);
    for (let k = 0; k < K; k++) { const k2 = (k + 1) % K; bag.tri(c0, rings[0][k2], rings[0][k]); bag.tri(c1, rings[rings.length - 1][k], rings[rings.length - 1][k2]); }
  }
  return rings;
}
// a rounded rectangle section (w across, t proud; sunk `sink` into the skin)
function secRRect(w, t, sink, arc) {
  const A = arc || 2, r = Math.min(t, w) * 0.4;
  const out = [];
  const corner = (cx, cy, a0) => { for (let k = 0; k <= A; k++) { const a = a0 + (Math.PI / 2) * k / A; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  const hw = w / 2 - r, top = t - r, bot = -sink;
  corner(hw, top, 0); corner(-hw, top, Math.PI / 2);
  out.push([-hw - r, bot], [hw + r, bot]);
  return out;
}
// the bottom's point and frame at (x, z-fraction of the chine half-beam)
function bottomAt(P, HY, x, zf) {
  const s = HY.sectionOf(P, x === 0 ? -1e-9 : x);
  const z = zf * s.b, tb = Math.tan(s.beta * D2R), cb = Math.cos(s.beta * D2R), sb = Math.sin(s.beta * D2R);
  return { p: [x, s.yk + Math.abs(z) * tb, z], N: [0, -cb, Math.sign(z || 1) * sb], B: [0, sb * Math.sign(z || 1), cb], s };
}

function buildProtrusions(P, HY, o, sc) {
  const bag = Bag(false);
  const xs = P.xs, LA = P.L - P.xs;
  const K = HY.keelOf(P);
  // THE KEEL BAR: forebody from the stem's foot to the step, afterbody step to
  // the transom; a rounded flat sunk into the V, keelH proud
  const keelPath = (x0, x1, n) => {
    const path = [], frames = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n;
      const s = HY.sectionOf(P, x === 0 ? -1e-9 : x);
      const e = 0.01, s2 = HY.sectionOf(P, Math.min(x + e, x1) === 0 ? -1e-9 : Math.min(x + e, x1));
      const T = nrm([e, s2.yk - s.yk, 0]);
      const N = nrm(crs([0, 0, 1], T));           // down-ish, perpendicular to the keel line
      const Nd = N[1] > 0 ? mul(N, -1) : N;
      path.push([x, s.yk, 0]); frames.push({ N: Nd, B: [0, 0, 1] });
    }
    return { path, frames };
  };
  {
    const kf = keelPath(K.xFoot + 0.02 * sc, -P.hs * 0.2, 40);
    stripSweep(bag, kf.path, kf.frames, secRRect(P.keelW, P.keelH, 0.6 * P.keelH, 2), true);
    const ka = keelPath(0.02 * sc, LA - o.rTransom, 12);
    stripSweep(bag, ka.path, ka.frames, secRRect(P.keelW, P.keelH, 0.6 * P.keelH, 2), true);
  }
  // THE SISTER KEELSONS: a side, from 0.10 xs ahead of the step to where
  // the bottom starts to lift into the stem (0.82 xs), on the warped bottom
  for (const sd of [-1, 1]) {
    const path = [], frames = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const x = -xs * (0.82 - 0.72 * i / n);           // bow to step: the path runs +x
      const b = bottomAt(P, HY, x, sd * P.skZ);
      path.push(b.p); frames.push({ N: b.N, B: b.B });
    }
    stripSweep(bag, path, frames, secRRect(P.skW, P.skH, 0.6 * P.skH, 2), true);
  }
  // THE CHINE SPRAY STRAPS: a flat lip out from the forebody chine, from the
  // step to 0.86 xs (where the chine sweeps up), horizontal, rooted 4 mm in
  for (const sd of [-1, 1]) {
    const path = [], frames = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const x = -xs * (0.86 * (1 - i / n)) - 0.005 * sc;   // bow to step: the path runs +x
      const s = HY.sectionOf(P, x);
      path.push([x, s.yc - 0.5 * P.railT, sd * (s.b - 0.004)]);
      frames.push({ N: [0, -sd, 0], B: [0, 0, sd] });   // B x N = +x (the path's direction): a right-handed frame a side
    }
    // the section: a flat tongue railW out, railT thick, its outer edge rounded
    const w = P.railW + 0.004, t = P.railT;
    const sect = [[0, -t / 2], [w - t / 2, -t / 2], [w, 0], [w - t / 2, t / 2], [0, t / 2]];
    stripSweep(bag, path, frames, sect, true);
  }
  return bag;
}

// THE NOSE BUMPER: the stem's own rings, offset 20 mm along their smooth
// normals, walled at the back onto the skin
function buildBumper(P, HY, hull, o, sc) {
  const bag = Bag(true);
  const K = HY.keelOf(P);
  const Nrm = vertexNormals(hull.bag);
  const t = 0.012 * sc;
  const xEnd = -P.xs + 0.04 * sc;                  // the cap's depth along the nose: the stem and the start of the round
  const use = hull.rings.map((r, i) => ({ r, i })).filter(q => q.r.x <= xEnd);
  if (use.length < 2) return bag;
  const rows = use.map(q => q.r.R.map((p, k) => {
    const vi = hull.ids[q.i][k] * 3;
    const n = [Nrm[vi], Nrm[vi + 1], Nrm[vi + 2]];
    return bag.v(add(p, mul(n, t)));
  }));
  for (let i = 0; i + 1 < rows.length; i++)
    for (let k = 0; k < RING_LEN; k++) { const k2 = (k + 1) % RING_LEN; bag.quad(rows[i][k], rows[i + 1][k], rows[i + 1][k2], rows[i][k2]); }
  // the wall: from the last offset ring down onto the skin's ring
  const lastQ = use[use.length - 1];
  const skin = lastQ.r.R.map(p => bag.v(p));
  const off = rows[rows.length - 1];
  for (let k = 0; k < RING_LEN; k++) { const k2 = (k + 1) % RING_LEN; bag.quad(off[k], skin[k], skin[k2], off[k2]); }
  return bag;
}

// ---- hardware shapes ---------------------------------------------------------
function boxAt(bag, c, e, X, Y, Z) {
  const p = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    p.push(bag.v([c[0] + X[0] * e[0] * sx + Y[0] * e[1] * sy + Z[0] * e[2] * sz,
                  c[1] + X[1] * e[0] * sx + Y[1] * e[1] * sy + Z[1] * e[2] * sz,
                  c[2] + X[2] * e[0] * sx + Y[2] * e[1] * sy + Z[2] * e[2] * sz]));
  const q = (a, b, c2, d) => bag.quad(p[a], p[b], p[c2], p[d]);
  q(0, 1, 3, 2); q(4, 6, 7, 5); q(0, 4, 5, 1); q(2, 3, 7, 6); q(0, 2, 6, 4); q(1, 5, 7, 3);
}
// a cylinder along `axis` from c, radius r, length L, capped
function cyl(bag, c, axis, r, L, segs) {
  const ax = nrm(axis);
  let e1 = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  e1 = nrm(sub(e1, mul(ax, dot(e1, ax)))); const e2 = crs(ax, e1);
  const S = segs || 10, r0 = [], r1 = [];
  for (let k = 0; k < S; k++) {
    const a = 2 * Math.PI * k / S, d = add(mul(e1, r * Math.cos(a)), mul(e2, r * Math.sin(a)));
    r0.push(bag.v(add(c, d))); r1.push(bag.v(add(add(c, d), mul(ax, L))));
  }
  const c0 = bag.v(c), c1 = bag.v(add(c, mul(ax, L)));
  for (let k = 0; k < S; k++) { const k2 = (k + 1) % S; bag.quad(r0[k], r0[k2], r1[k2], r1[k]); bag.tri(c0, r0[k2], r0[k]); bag.tri(c1, r1[k], r1[k2]); }
}
// a plate on the deck (y up): a rounded rectangle w (x) by h (z), radius r,
// proud t over y0, its edge chamfered
function plateOnDeck(bag, cx, cz, y0, w, h, r, t) {
  const A = 4, ring = [];
  const corner = (px, pz, a0) => { for (let k = 0; k <= A; k++) { const a = a0 + (Math.PI / 2) * k / A; ring.push([cx + px + r * Math.cos(a), cz + pz + r * Math.sin(a)]); } };
  const hw = w / 2 - r, hh = h / 2 - r;
  corner(hw, hh, 0); corner(-hw, hh, Math.PI / 2); corner(-hw, -hh, Math.PI); corner(hw, -hh, -Math.PI / 2);
  const ch = 0.35 * t;
  const base = ring.map(([x, z]) => bag.v([x, y0, z]));
  const mid = ring.map(([x, z]) => bag.v([x, y0 + t - ch, z]));
  const top = ring.map(([x, z]) => { const dx = x - cx, dz = z - cz; return bag.v([cx + dx * (1 - ch / Math.max(hw + r, 1e-6) * 0.6), y0 + t, cz + dz * (1 - ch / Math.max(hh + r, 1e-6) * 0.6)]); });
  const cc = bag.v([cx, y0 + t, cz]);
  const n = ring.length;
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    bag.quad(base[k], mid[k], mid[k2], base[k2]);
    bag.quad(mid[k], top[k], top[k2], mid[k2]);
    bag.tri(cc, top[k2], top[k]);
  }
}
// a screw head: a short cylinder up out of the deck
const screw = (bag, x, y0, z, r) => cyl(bag, [x, y0, z], [0, 1, 0], r, 1.6 * r, 6);
// a flush ring latch: a small torus-ish ring lying on the deck
function ringOnDeck(bag, cx, cz, y0, R, r) {
  const S = 12, T = 6, rows = [];
  for (let i = 0; i < T; i++) {
    const a = 2 * Math.PI * i / T, row = [];
    for (let k = 0; k < S; k++) {
      const b = 2 * Math.PI * k / S;
      const rr = R + r * Math.cos(a);
      row.push(bag.v([cx + rr * Math.cos(b), y0 + r * Math.sin(a), cz + rr * Math.sin(b)]));
    }
    rows.push(row);
  }
  for (let i = 0; i < T; i++) for (let k = 0; k < S; k++) {
    const i2 = (i + 1) % T, k2 = (k + 1) % S;
    bag.quad(rows[i][k], rows[i2][k], rows[i2][k2], rows[i][k2]);
  }
}
// a horn cleat on the deck along x: base plate, two posts, the horn bar
function cleat(bag, x, y0, z, L, sc) {
  boxAt(bag, [x, y0 + 0.004 * sc, z], [0.55 * L, 0.004 * sc, 0.16 * L], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (const s of [-1, 1]) cyl(bag, [x + s * 0.22 * L, y0, z], [0, 1, 0], 0.055 * L, 0.30 * L, 8);
  cyl(bag, [x - 0.5 * L, y0 + 0.30 * L, z], [1, 0, 0], 0.075 * L, L, 10);
}

// ---- the deck and its details -------------------------------------------------
function buildDeck(P, HY, o, sc) {
  const deck = Bag(true), hard = Bag(false);
  const xs = P.xs, LA = P.L - P.xs;
  const K = HY.keelOf(P);
  // THE NON-SKID OVERLAY: 1.5 mm over the deck between the margins, from
  // the nose round's end to the transom's round
  const x0 = -xs + K.rN + o.margin * 2, x1 = LA - o.rTransom - o.margin;
  const n = 40, rows = [];
  const lift = 0.0015;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    const s = HY.sectionOf(P, x === 0 ? -1e-9 : x);
    const side = ringSide(P, s, o);
    const zM = side[side.length - 2][1];       // the margin support's z
    const w = Math.max(0, zM - 0.008 * sc);
    rows.push([deck.v([x, s.yd + lift, w]), deck.v([x, s.yd + lift, -w])]);
  }
  for (let i = 0; i + 1 < rows.length; i++) deck.quad(rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]);
  // its edge, so it reads as a coating with thickness
  const eR = rows.map(r => deck.v([deck.pos[r[0] * 3], deck.pos[r[0] * 3 + 1] - lift, deck.pos[r[0] * 3 + 2]]));
  const eL = rows.map(r => deck.v([deck.pos[r[1] * 3], deck.pos[r[1] * 3 + 1] - lift, deck.pos[r[1] * 3 + 2]]));
  for (let i = 0; i + 1 < rows.length; i++) { deck.quad(rows[i][0], eR[i], eR[i + 1], rows[i + 1][0]); deck.quad(rows[i][1], rows[i + 1][1], eL[i + 1], eL[i]); }
  deck.quad(rows[0][0], rows[0][1], eL[0], eR[0]); deck.quad(rows[n][0], eR[n], eL[n], rows[n][1]);

  const yDeck = x => HY.sectionOf(P, x === 0 ? -1e-9 : x).yd + lift + 0.0005;
  // THE BAYS: one watertight bay every ~0.62 m on the 2350, a bulkhead at
  // the step; the covers alternate large / small, one per bay, on the
  // centreline; a pump-out cup per bay on the outboard deck
  const nBay = Math.max(6, Math.round(P.L / (0.62 * sc)));
  const xBow = -xs + K.rN + 0.25 * sc, xSt = LA - o.rTransom - 0.10 * sc;
  const hatchX = -0.62 * sc, hatchW = 0.52 * sc, hatchH = 0.27 * sc;   // the baggage hatch, ahead of the step
  const stations = [];
  for (let i = 0; i < nBay; i++) stations.push(xBow + (xSt - xBow) * (i + 0.5) / nBay);
  const details = { covers: [], cups: [] };
  let alt = 0;
  for (const x of stations) {
    if (Math.abs(x - hatchX) < 0.5 * hatchW + 0.14 * sc) continue;        // the hatch owns its bay
    const s = HY.sectionOf(P, x === 0 ? -1e-9 : x);
    const big = (alt++ % 2) === 0;
    const w = (big ? 0.24 : 0.16) * sc;
    if (w > 1.4 * s.bd) continue;                                          // no room near the bow
    plateOnDeck(hard, x, 0, yDeck(x), w, w, 0.22 * w, 0.003 * sc);
    const nS = big ? 12 : 8, rr = 0.5 * w - 0.018 * sc;
    for (let k = 0; k < nS; k++) { const a = 2 * Math.PI * (k + 0.5) / nS; screw(hard, x + rr * Math.cos(a), yDeck(x) + 0.003 * sc, rr * Math.sin(a), 0.0035 * sc); }
    details.covers.push([x, w]);
    // the pump-out cup on the outboard deck edge (the layer mirrors the
    // float, so "outboard" is +z here and the caller flips the port float)
    const zc = s.bd - 0.075 * sc;
    if (zc > 0.06 * sc) { cyl(hard, [x + 0.10 * sc, yDeck(x), zc], [0, 1, 0], 0.020 * sc, 0.004 * sc, 10); details.cups.push([x + 0.10 * sc, zc]); }
  }
  // THE BAGGAGE HATCH: the door, its hinge line outboard, two latch rings inboard
  {
    const y = yDeck(hatchX);
    plateOnDeck(hard, hatchX, 0, y, hatchW, hatchH, 0.03 * sc, 0.004 * sc);
    cyl(hard, [hatchX - 0.46 * hatchW, y + 0.003 * sc, 0.5 * hatchH - 0.006 * sc], [1, 0, 0], 0.005 * sc, 0.92 * hatchW, 8);
    for (const dx of [-0.30, 0.30]) ringOnDeck(hard, hatchX + dx * hatchW, -0.5 * hatchH + 0.035 * sc, y + 0.004 * sc, 0.016 * sc, 0.004 * sc);
  }
  // THE CLEATS: bow and stern, on the centreline
  cleat(hard, -xs + K.rN + 0.16 * sc, yDeck(-xs + K.rN + 0.16 * sc), 0, 0.11 * sc, sc);
  cleat(hard, LA - o.rTransom - 0.22 * sc, yDeck(LA - o.rTransom - 0.22 * sc), 0, 0.11 * sc, sc);
  // THE RIGGING STATIONS: the spreader-bar deck blocks and the strut fitting
  // plates, at the two stations the layer rigs (published back to it)
  const rig = { fwd: -P.flatK * xs, aft: o.xAft };
  for (const x of [rig.fwd, rig.aft]) {
    const s = HY.sectionOf(P, x === 0 ? -1e-9 : x), y = yDeck(x);
    for (const sd of [-1, 1]) {
      boxAt(hard, [x, y + 0.02 * sc, sd * (s.bd - 0.06 * sc)], [0.055 * sc, 0.02 * sc, 0.03 * sc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      // the strut fitting: a plate with a lug standing up
      boxAt(hard, [x + 0.12 * sc, y + 0.003 * sc, sd * (s.bd - 0.05 * sc)], [0.045 * sc, 0.003 * sc, 0.03 * sc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      boxAt(hard, [x + 0.12 * sc, y + 0.022 * sc, sd * (s.bd - 0.05 * sc)], [0.02 * sc, 0.02 * sc, 0.005 * sc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    }
  }
  return { deck, hard, rig, details };
}

// a plate from an outline in (x, y), between z0 - t/2 and z0 + t/2; the
// outline may be given in either sense (it is made counter-clockwise)
function plateXY(bag, outl, z0, t) {
  let A2 = 0;
  for (let i = 0; i < outl.length; i++) { const a = outl[i], b = outl[(i + 1) % outl.length]; A2 += a[0] * b[1] - b[0] * a[1]; }
  const O = A2 < 0 ? outl.slice().reverse() : outl;
  let cx = 0, cy = 0; for (const q of O) { cx += q[0]; cy += q[1]; } cx /= O.length; cy /= O.length;
  const Pf = O.map(([x, y]) => bag.v([x, y, z0 + t / 2])), Mf = O.map(([x, y]) => bag.v([x, y, z0 - t / 2]));
  const cP = bag.v([cx, cy, z0 + t / 2]), cM = bag.v([cx, cy, z0 - t / 2]);
  const n = O.length;
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    bag.tri(cP, Pf[k], Pf[k2]); bag.tri(cM, Mf[k2], Mf[k]);
    bag.quad(Pf[k], Mf[k], Mf[k2], Pf[k2]);
  }
}

// ---- the water rudder --------------------------------------------------------
// Returns the blade + arms as one bag (painted with the hull), the fixed
// hardware (post, brackets, bellcrank, cables) as another, and the pivots.
function buildRudder(P, HY, o, sc) {
  const blade = Bag(false), hard = Bag(false);
  const LA = P.L - P.xs;
  const sT = HY.sectionOf(P, LA - o.rTransom);
  const xT = LA + 0.012 * sc;                            // the transom's face, plus the bracket stand-off
  const rPost = 0.011 * sc;
  const yTop = sT.yd + 0.06 * sc, yFoot = sT.yk - 0.03 * sc;
  // the post and its two bearing brackets on the transom
  cyl(hard, [xT + 0.02 * sc, yFoot, 0], [0, 1, 0], rPost, yTop - yFoot, 12);
  for (const y of [sT.yd - 0.03 * sc, sT.yk + 0.05 * sc])
    boxAt(hard, [xT + 0.01 * sc, y, 0], [0.012 * sc, 0.014 * sc, 0.03 * sc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  // the bellcrank: a flat bar across the post's top, a cable eye each end
  const post = [xT + 0.02 * sc, 0, 0];
  boxAt(hard, [post[0], yTop - 0.008 * sc, 0], [0.012 * sc, 0.004 * sc, 0.075 * sc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  // the steering cables: from the bellcrank's ends forward along the deck to
  // a pulley bracket 0.45 m ahead
  for (const sd of [-1, 1]) {
    const a = [post[0], yTop - 0.006 * sc, sd * 0.07 * sc];
    const b = [LA - o.rTransom - 0.45 * sc, sT.yd + 0.02 * sc, sd * 0.05 * sc];
    cyl(hard, a, sub(b, a), 0.0015 * sc, len(sub(b, a)), 6);
  }
  boxAt(hard, [LA - o.rTransom - 0.47 * sc, sT.yd + 0.012 * sc, 0], [0.02 * sc, 0.012 * sc, 0.06 * sc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  // THE BLADE: its span (fore-aft) and depth from the hull's own area and
  // depth — the physics reads these two numbers, so what it feels is drawn
  const depth = P.wrDepth + 0.01 * sc;                   // the foot exactly wrDepth under the stern keel, the head a hair above it
  const span = P.wrArea / (0.92 * depth);                // a rounded lower-aft corner takes 8 %
  const pivot = [post[0], yFoot + 0.01 * sc, 0];         // the arms' horizontal pivot at the post's foot
  const xB0 = pivot[0] + 0.06 * sc;                      // the blade's leading edge
  const yB1 = pivot[1] + 0.03 * sc, yB0 = yB1 - depth;   // top and foot
  const t = 0.008 * sc, r = 0.35 * depth;
  // the outline in (x, y), lower-aft corner rounded
  const outl = [[xB0, yB1], [xB0 + span, yB1], [xB0 + span, yB0 + r]];
  for (let k = 1; k <= 5; k++) { const a = (Math.PI / 2) * k / 5; outl.push([xB0 + span - r + r * Math.cos(a), yB0 + r - r * Math.sin(a)]); }
  outl.push([xB0, yB0]);
  plateXY(blade, outl, 0, t);
  // the two arms: flat bars from the pivot to the blade's top edge
  for (const sd of [-1, 1]) {
    const a = [pivot[0], pivot[1], sd * 0.02 * sc], b = [xB0 + 0.04 * sc, yB1 - 0.02 * sc, sd * (t / 2 + 0.003 * sc)];
    const d = sub(b, a), L = len(d), X = nrm(d), Z = [0, 0, 1], Y = nrm(crs(Z, X));
    boxAt(blade, lerp(a, b, 0.5), [L / 2 + 0.012 * sc, 0.012 * sc, 0.003 * sc], X, Y, Z);
  }
  // the pivot boss on the post
  cyl(blade, [pivot[0], pivot[1], -0.025 * sc], [0, 0, 1], 0.012 * sc, 0.05 * sc, 10);
  return { blade, hard, post, axis: [0, 1, 0], pivot, hinge: [0, 0, 1], span, depth };
}

// ---- the paddle --------------------------------------------------------------
// A canoe paddle (1.45 m, real size) clipped along the inboard side skin of
// the forebody, under the gunwale, blade forward. `sd` is the inboard side.
function buildPaddle(P, HY, o, sc, sd) {
  const shaft = Bag(false), blade = Bag(false);
  const xs = P.xs;
  const Lp = 1.45, rS = 0.016, bladeL = 0.46, bladeW = 0.17;
  const yP = HY.sectionOf(P, -0.4 * xs).yd - 0.14 * Math.max(0.6, sc);
  const x1 = -0.10 * xs, x0 = Math.max(-0.92 * xs, x1 - Lp);      // aft end near the step, blade forward
  const zAt = x => { const s = HY.sectionOf(P, x); return sd * (s.b + (yP - s.yc) * (s.bd - s.b) / Math.max(1e-6, s.yd - s.yc) + 0.024); };
  // the shaft, in two pieces so it follows the skin's plan
  const pts = [x0 + bladeL * 0.85, x0 + bladeL * 0.85 + (x1 - x0 - bladeL * 0.85) * 0.5, x1 - 0.05];
  for (let i = 0; i + 1 < pts.length; i++) { const a = [pts[i], yP, zAt(pts[i])], b = [pts[i + 1], yP, zAt(pts[i + 1])]; cyl(shaft, a, sub(b, a), rS, len(sub(b, a)), 10); }
  // the T grip
  cyl(shaft, [x1 - 0.05, yP - 0.045, zAt(x1 - 0.05)], [0, 1, 0], 0.012, 0.09, 8);
  // the blade: a leaf, round-tipped, flat against the skin
  const zB = zAt(x0 + 0.5 * bladeL), tB = 0.012;
  const outl = [], NB = 9, cx = x0 + bladeW / 2, half = bladeW / 2;
  for (let k = 0; k <= NB; k++) { const a = Math.PI / 2 + Math.PI * k / NB; outl.push([cx + half * Math.cos(a), yP + half * Math.sin(a)]); }
  outl.push([x0 + bladeL, yP - 0.25 * half], [x0 + bladeL, yP + 0.25 * half]);
  plateXY(blade, outl, zB, tB);
  // two clips bridging the shaft to the skin, and the paddle stop at the grip
  for (const x of [x0 + bladeL + 0.12, x1 - 0.25]) boxAt(shaft, [x, yP, zAt(x) - sd * 0.012], [0.012, 0.022, 0.014], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  return { shaft, blade };
}

// ---- the whole float ---------------------------------------------------------
// opts: { HY (the hydro module), detail (0/1), paddle (side: -1, 0, +1), rudder (0/1), xAft }
function build(P, opts) {
  const HY = opts.HY;
  const sc = P.scale || (P.L / (HY.DEF.L || 4.6));
  const o = {
    rKeel: 0.55 * P.keelW, rChine: P.rChine, rGun: P.rGun, rLip: P.rLip, rTransom: P.rTransom,
    margin: 0.035 * sc,
    xAft: opts.xAft != null ? opts.xAft : 0.36 * sc,
    nF: opts.nF, nA: opts.nA,
  };
  const hull = buildHull(P, HY, o);
  const out = { hull: hull.bag.out(), sc, rig: { fwd: -P.flatK * P.xs, aft: o.xAft }, stats: meshStats(hull.bag) };
  if (opts.detail !== 0) {
    out.protrusions = buildProtrusions(P, HY, o, sc).out();
    out.bumper = buildBumper(P, HY, hull, o, sc).out();
    const dk = buildDeck(P, HY, o, sc);
    out.deck = dk.deck.out(); out.hard = dk.hard.out(); out.details = dk.details;
  }
  if (opts.rudder !== 0) {
    const r = buildRudder(P, HY, o, sc);
    out.rudder = { blade: r.blade.out(), hard: r.hard.out(), post: r.post, axis: r.axis, pivot: r.pivot, hinge: r.hinge, span: r.span, depth: r.depth };
  }
  if (opts.paddle) {
    const pd = buildPaddle(P, HY, o, sc, opts.paddle);
    out.paddle = { shaft: pd.shaft.out(), blade: pd.blade.out() };
  }
  return out;
}

const API = { build, meshStats, vertexNormals, ringSide, RING_N, RING_LEN, Bag };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.FLOAT_GEN = API;
})();
