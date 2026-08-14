// THE BODY LOFT — one curve, sampled.
//
// This module owns the fuselage's SHAPE. It exists because the shape used to be
// owned by two different interpolants that met at station 1 with no continuity
// condition between them, and the meeting point is the crank the whole rework is
// about (63_gen_skin.js:544-565, now deleted):
//
//   - bay 0 held the cowl deck flat, then climbed the entire windscreen rise
//     over `windRun`, arriving at station 1 on a ~49 degree slope;
//   - bays >= 1 used a Catmull-Rom whose every sample was CLAMPED into its own
//     bay's endpoint interval, so wherever two consecutive stations shared a
//     value — always true for `yt` and `w` across the cabin — the "smoothed"
//     curve collapsed to a dead flat.
//
// Measured with tools/loft_fit.js on the stock preset, the deck-line slope went
// 0.009 -> 1.633 -> 0.418 across two adjacent vertex rows. The reference meshes
// do nothing of the kind. The C172's envelope through the windshield is
// 1.598 -> 1.660 -> 1.857 -> 1.949 -> 1.998 -> 2.002, monotone and smooth: its
// skin has a HOLE there and the glass fills it. The PA-18 does have a visible
// hard edge at its windscreen bow, but its envelope is monotone too — that edge
// is a CREASE IN THE SURFACE NORMAL at a real frame tube, not a discontinuity in
// the station curve.
//
// So the two things were conflated, and they are separated here: the curve is
// always smooth, and a station may additionally be TAGGED to crease, which
// splits normals without moving a single vertex.
//
// THE RULE THAT MAKES THE CRANK UNREPRESENTABLE: there is exactly one curve, and
// both the truss and the covering are samples of it. No code path can produce a
// slope jump at a station that is not tagged.

// ---------------------------------------------------------------------------
// 1. the section
// ---------------------------------------------------------------------------
// Asymmetric superellipse |z/w|^n + |y/h|^n = 1, with n independent above and
// below the waterline.
//
// It replaces genRing's per-angle LINEAR BLEND between an axis-aligned rectangle
// and an ellipse. That blend had a defect nobody had named: the rectangle's
// radius min(halfD/|cy|, halfW/|cz|) has a derivative discontinuity at each of
// its four corners, so for ANY crown < 1 the blend inherited four C1 breaks
// around EVERY ring — at the default crownSide 0.07 the belly and sides were
// essentially a creased rectangle running the whole length of the aeroplane.
// The superellipse has no corners at any finite n, so those go for free.
//
// It also subsumes both ends of the old blend exactly:
//   n = 2        -> the ellipse
//   n -> large   -> the rectangle (t -> 1/max(|cy|,|cz|), which IS genRing's s)
//
// theta 0 = top, +pi/2 = +z side, pi = bottom — genRing's convention, unchanged.
const GEN_N_ELL = 2;      // n of a true ellipse
const GEN_N_BOX = 14;     // beyond this a 40-gon ring cannot tell it from a box

// THE SECTION, waist-relative. This is the one to use.
//
// A station is NOT a symmetric shape about the mid-height between belly and
// deck. It is a WAISTLINE — the widest line of the body, which on a real tube
// fuselage is the top longeron and on a moulded one is the sill — with an upper
// surface rising off it and a lower surface hanging below it. The two are
// independent.
//
// The version this replaces centred the section on yc = (yb+yt)/2 and gave it
// one half-depth both ways, so the widest line of the aeroplane was a BY-PRODUCT
// of the deck and belly rather than a designed curve. Through the windscreen,
// where yt climbs 0.30 m, yc climbed 0.15 m with it — so the body's waist rode
// up over the cabin and back down again. That is a large part of what read as
// the model being bastardized around the windshield, and no amount of smoothing
// yt could fix it, because the waist was never a degree of freedom.
//
// WHY THE SPLIT IS FREE. A superellipse has a VERTICAL TANGENT at its equator
// for any n > 1: differentiating |y/h|^n + |z/W|^n = 1 gives dz/dy = 0 at y = 0.
// So the upper and lower quadrants meet the waist vertically whatever their
// exponents are, and the section is C1 across the waist BY CONSTRUCTION. No
// blend, no smoothstep, no shared half-depth. A chine, if one is ever wanted, is
// then something you must add deliberately rather than something you must avoid.
//
// yUp / yDn are measured FROM THE WAIST (both positive). Returns [dy, dz]
// relative to the waist plane. theta 0 = top, +pi/2 = +z side, pi = bottom.
function genSect(theta, halfW, yUp, yDn, nTop, nBot) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  const up = cy >= 0;
  const h = Math.max(1e-5, up ? yUp : yDn);
  const n = Math.max(1.2, Math.min(GEN_N_BOX, up ? nTop : nBot));
  const a = Math.abs(cy), b = Math.abs(cz);
  const t = Math.pow(Math.pow(a, n) + Math.pow(b, n), -1 / n);
  return [h * t * cy, halfW * t * cz];
}

// Symmetric superellipse about the section centre. Retained because the cowl,
// the tail cone cap and the legacy genRing wrapper all want a shape that is the
// same above and below; new work should prefer genSect.
function genSuper(theta, halfW, halfD, nTop, nBot) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  // THE EXPONENT IS BLENDED, NOT THE RADIUS, and it is blended with a smoothstep
  // rather than genRing's max(0, cy).
  //
  // At the waterline cy = 0, so |cy|^n = 0 for any n and the RADIUS is already
  // continuous under a hard switch — but its derivative is not, which is exactly
  // the "crown steps at the waterline" trap HANDOVER records. max(0, cy) is C0
  // there and leaves a shallow version of the same step. A smoothstep has zero
  // derivative at cy = 0, so the upper and lower halves meet C1 by construction.
  const s = Math.max(0, cy);
  const f = s * s * (3 - 2 * s);
  const n = Math.max(1.2, nBot + (nTop - nBot) * f);
  const a = Math.abs(cy), b = Math.abs(cz);
  // t scales the unit direction onto the superellipse. Guarded because a is 0 at
  // the waterline and b is 0 at the crown, and 0^n underflows for large n.
  const t = Math.pow(Math.pow(a, n) + Math.pow(b, n), -1 / n);
  return [halfD * t * cy, halfW * t * cz];
}

// ---------------------------------------------------------------------------
// 2. legacy compatibility
// ---------------------------------------------------------------------------
// `crownTop` / `crownSide` stay in the spec and keep their paths, so every saved
// build still loads; they are reinterpreted as exponents.
//
// Both constants are LEAST-SQUARES FITS of genSuper against the genRing it
// replaces, over theta at Cub-like proportions (halfW 0.42, halfD 0.34). Fitted
// pairs, and what this rational form gives:
//
//   crown  0.00  0.07  0.25  0.35  0.50  0.72  0.85  1.00
//   fit    6.70  5.72  4.38  3.84  3.14  2.48  2.22  2.00
//   here   6.70  5.81  4.30  3.75  3.14  2.52  2.25  2.00
//
// The residual at crown = 0 is large (11% of halfD) and that is the POINT: a
// true rectangle has sharp corners and no finite n reproduces them. Not
// reproducing them is the fix.
//
// Note what the defaults mean once read this way, because it is the argument for
// the whole asymmetric-exponent design: the Cub is crownTop 0.72 / crownSide
// 0.07, i.e. a ROUND TURTLEDECK (n 2.5) on a FLAT-SIDED BOX (n 5.8). The C172,
// measured off assets/c172/c172.obj, is the inverse — a flat roof (n ~5) on a
// rounded belly (n ~2.5). One symmetric roundness knob cannot express both.
const genCrownToN = crown => {
  const c = Math.min(1, Math.max(0, crown));
  return GEN_N_ELL + (GEN_N_BOX - GEN_N_ELL) * 0.392 * (1 - c) / (1 + 2.12 * c);
};

// genRing scaled the rounded former up by 1 + 0.15*crown so formers stand a
// little proud of the truss. Fitted against the same sweep, the equivalent under
// a superellipse is quadratic rather than linear (fit: 1.000 1.000 1.000 1.005
// 1.025 1.070 1.105 1.150 for the crowns above).
const genCrownScale = crown => {
  const c = Math.min(1, Math.max(0, crown));
  return 1 + 0.15 * c * c;
};

// ---------------------------------------------------------------------------
// 3. one monotone C1 curve
// ---------------------------------------------------------------------------
// Fritsch-Carlson monotone cubic Hermite, per key, with NO clamp.
//
// WHY NOT THE CLAMP IT REPLACES. The old code limited the VALUE — every sample
// forced into [min(p1,p2), max(p1,p2)] — which annihilates the tangent whenever
// two consecutive stations are equal. Fritsch-Carlson limits the TANGENT into
// the monotonicity region instead. It still cannot overshoot (that is the
// theorem, and overshoot — "a bulge behind the cabin" — is what the clamp was
// written to prevent), but it only zeroes a tangent at a genuine local extremum
// in the data. Everywhere else it carries the three-point slope.
//
// One honest consequence to know about: at a genuine extremum, such as the deck
// peak over the cabin, the tangent IS zero. That is correct and C1, but it reads
// flat — which is why the station set carries a `seatBack` control point, to
// give the roof somewhere to start falling from.
function genMonoSpline(xs, ys, tanK) {
  const n = xs.length;
  if (n < 2) return () => (ys[0] || 0);
  const d = new Array(n - 1), m = new Array(n);
  for (let i = 0; i < n - 1; i++)
    d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = 0.5 * (d[i - 1] + d[i]);
  // Fritsch-Carlson: flatten across a plateau, then bound the rest into the
  // circle of radius 3 that guarantees monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-12) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    // a sign flip means this station is a local extremum: pin it
    if (a < 0) m[i] = 0;
    if (b < 0) m[i + 1] = 0;
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  // a station may ask for a softer or harder tangent (this is what wsCurve
  // becomes: a multiplier at the windscreen's two ends, not an ad-hoc power)
  if (tanK) for (let i = 0; i < n; i++) if (tanK[i] != null) m[i] *= tanK[i];
  return x => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const md = (lo + hi) >> 1; if (xs[md] <= x) lo = md; else hi = md; }
    const h = xs[hi] - xs[lo], t = (x - xs[lo]) / Math.max(1e-9, h);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo]
         + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}

// stations: [{x, w, yb, yt, nTop, nBot, role, crease, truss, tan}]
// -> a curve that can be sampled at ANY x, by both the truss and the covering.
function genBodyCurve(stations) {
  const st = stations.slice().sort((a, b) => a.x - b.x)
    // yw is the WAISTLINE — the widest line of the body, and the master curve of
    // the section. A station that does not declare one falls back to the old
    // mid-height, which is a by-product rather than a design; declare it.
    .map(s => (s.yw == null ? { ...s, yw: 0.5 * (s.yb + s.yt) } : s))
    // yd is the COWL DECK line — the upper surface forward of the windscreen,
    // carried the whole length as if the cowl ran all of it. A body with no
    // windscreen (a drone, a boom) simply has yd = yt and no transition.
    .map(s => (s.yd == null ? { ...s, yd: s.yt } : s));
  const xs = st.map(s => s.x);
  const tanK = st.map(s => (s.tan == null ? null : s.tan));
  const K = ['w', 'yb', 'yw', 'yd', 'yt', 'nTop', 'nBot'];
  const f = {};
  for (const k of K) f[k] = genMonoSpline(xs, st.map(s => s[k]), tanK);
  const at = x => {
    const o = { x };
    for (const k of K) o[k] = f[k](x);
    // exponents are shape, not geometry: keep them in the range the section
    // function can actually evaluate however the spline wanders
    o.nTop = Math.min(GEN_N_BOX, Math.max(1.2, o.nTop));
    o.nBot = Math.min(GEN_N_BOX, Math.max(1.2, o.nBot));
    o.w = Math.max(1e-4, o.w);
    // the waist may not cross the surfaces it separates
    o.yw = Math.min(Math.min(o.yt, o.yd) - 1e-4, Math.max(o.yb + 1e-4, o.yw));
    return o;
  };
  return {
    at, stations: st,
    x0: xs[0], x1: xs[xs.length - 1],
    roleAt: r => st.find(s => s.role === r) || null,
    roleX: r => { const s = st.find(s2 => s2.role === r); return s ? s.x : null; },
    creaseX: st.filter(s => s.crease).map(s => s.x),
  };
}

// ---------------------------------------------------------------------------
// 4. rows
// ---------------------------------------------------------------------------
// Every control station gets a row, so a crease and a truss ring always land
// exactly on one; between them, subdivide to about GEN_LSTEP metres.
//
// This is what replaces GEN_LSEG's fixed slices-per-bay. A fixed count spends
// the same number of rows on a 0.15 m windscreen and a 0.9 m tail bay, which is
// backwards: the rows are wanted where the curvature is.
const GEN_LSTEP = 0.16;
const GEN_LSEG_MIN = 1;
const GEN_LSEG_MAX = 6;

function genBodyRows(curve) {
  const st = curve.stations, rows = [];
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    const n = Math.max(GEN_LSEG_MIN,
              Math.min(GEN_LSEG_MAX, Math.round((b.x - a.x) / GEN_LSTEP)));
    for (let k = 0; k < n; k++)
      rows.push({ x: a.x + (b.x - a.x) * k / n, crease: k === 0 ? !!a.crease : false });
  }
  const last = st[st.length - 1];
  rows.push({ x: last.x, crease: !!last.crease });
  return rows;
}
