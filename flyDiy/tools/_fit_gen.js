// FIT GEN (G83) — THE FITTINGS THEMSELVES.
//
// One function per `form` named in GEN_ACCESS, each building its geometry into
// a bag in the frame the airframe contract handed over. Nothing here decides
// WHERE anything goes — that is the table's job and _fit_site.js's — and
// nothing here knows what it serves. These are shapes.
//
// ---------------------------------------------------------------------------
// THEY ARE SWEEPS AND REVOLVES, for the reason _gear_kit.js already gives:
// "Nothing is a THREE primitive with a rotation — a BoxGeometry leg is exactly
// what made the game's gear unsatisfying to look at." A filler cap is a turned
// part, an inspection plate is a pressing, an aerial is an extrusion. Drawing
// them as boxes and cylinders would produce exactly the sticker-on-a-shape
// look this arc exists to avoid, so they go through the same kit the
// undercarriage does and come out of the same family.
//
// ---------------------------------------------------------------------------
// THE FRAME. Every form is handed `F = { p, n, fore, side }` from
// `fitFrame(AF, z, ang)` (_gear_gen.js:606) — a point ON the skin, the OUTWARD
// normal there, and two tangents. So a form is authored once, in its own flat
// frame, and lands correctly on a flat flank, a curved turtledeck or a
// tapering boom without knowing which it is. That is the pitot rule, and it is
// why none of these carry a hard-coded offset.
//
// ---------------------------------------------------------------------------
// THREE BAGS, THREE DRAW CALLS, and that is the whole material budget.
//   paint  painted with the airframe — plates, caps, doors, steps, fairings
//   metal  bare or plated — masts, probes, aerials, drain valves, bolts
//   lens   the beacon's cover, and nothing else
// A bag per fitting would be the first thing in this codebase to multiply draw
// calls (the cage skin is ONE mesh with a material array), and the snapshot
// merges by material anyway, so splitting further would be undone downstream.
//
// ---------------------------------------------------------------------------
// EVERY DIMENSION ARRIVES IN METRES from the table's `size`. Nothing is scaled
// here: the hardware is metric and does not grow with the aeroplane, which is
// the crew layer's rule and the reason a wheel can be a ruler. A 75 mm filler
// cap is 75 mm on a Cub and 75 mm on a DC-3, because that is what a filler cap
// is.
'use strict';
(function () {

const K = (typeof window !== 'undefined' && window.GEAR_KIT) ||
          (typeof require !== 'undefined' ? null : null);
if (!K) {
  // node: the kit is an IIFE onto window, so give it one. Only Bag().mesh()
  // needs THREE, and nothing here calls it — the geometry is pure, which is
  // what lets GATE ACCESS build these headlessly and measure them.
  if (typeof module === 'undefined') return;
}
const KIT = K || (function () {
  const g = (typeof globalThis !== 'undefined') ? globalThis : global;
  if (!g.window) g.window = g;
  require('./_gear_kit.js');
  return g.window.GEAR_KIT;
})();

const { sub, add, mul, nrm, crs, off, lerp3, rot,
        revolve, tube, taper, boxIn, lug, bolt, sweep, secRound,
        resample, bez, fillet } = KIT;

// a point in the fitting's own frame: u across (side), v along (fore),
// w out (normal). Authoring in (u, v, w) is what makes every form readable.
const at = (F, u, v, w) => [
  F.p[0] + F.side[0] * u + F.fore[0] * v + F.n[0] * w,
  F.p[1] + F.side[1] * u + F.fore[1] * v + F.n[1] * w,
  F.p[2] + F.side[2] * u + F.fore[2] * v + F.n[2] * w,
];

// a rounded rectangular plate lying ON the surface, `t` proud of it. The
// corners are a real radius rather than a chamfer because a pressed panel has
// one, and a square-cornered plate reads as a decal even in geometry.
//
// IT FOLLOWS THE SURFACE. Each of its grid points is offset along the frame's
// OWN normal from a point that has been pushed back onto the skin by the
// caller's `surf` — flat plates on a curved flank stand off at their corners,
// which is the single most obvious way a bolted-on part can look wrong.
function plateInto(bag, F, w, h, t, r, surf) {
  const NU = 9, NV = 7;
  const rr = Math.min(r || Math.min(w, h) * 0.30, Math.min(w, h) * 0.48);
  const inner = [], outer = [];
  for (let i = 0; i <= NU; i++) {
    const ri = [], ro = [];
    for (let j = 0; j <= NV; j++) {
      const u = (i / NU - 0.5) * w, v = (j / NV - 0.5) * h;
      // the rounded corner, as a real fillet on the plate's own outline
      const du = Math.max(0, Math.abs(u) - (w / 2 - rr));
      const dv = Math.max(0, Math.abs(v) - (h / 2 - rr));
      const over = Math.hypot(du, dv);
      if (over > rr) { ri.push(null); ro.push(null); continue; }
      // the plate thins to nothing at its edge: a pressed panel has a
      // feathered lip, and a slab has a step you can see from any angle
      const edge = Math.min(1, (rr - over) / (rr * 0.42) + 0.15);
      const P = surf ? surf(u, v) : at(F, u, v, 0);
      const N = surf && surf.n ? surf.n(u, v) : F.n;
      ri.push(bag.v(off(P, N, 0.0006)));
      ro.push(bag.v(off(P, N, 0.0006 + t * edge)));
    }
    inner.push(ri); outer.push(ro);
  }
  const q = (A, B, i, j, flip) => {
    const a = A[i][j], b = A[i + 1][j], c = A[i + 1][j + 1], d = A[i][j + 1];
    if (a == null || b == null || c == null || d == null) return;
    if (flip) bag.quad(a, d, c, b); else bag.quad(a, b, c, d);
  };
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    q(inner, null, i, j, true);
    q(outer, null, i, j, false);
  }
  // the rim: wherever an outer point exists and its neighbour does not, close
  // the plate's edge between the two sheets
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
    const here = outer[i][j]; if (here == null) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [di, dj] of nb) {
      const ii = i + di, jj = j + dj;
      const out2 = (ii < 0 || jj < 0 || ii > NU || jj > NV) ? null : outer[ii][jj];
      if (out2 != null) continue;
      // walk one step along the edge to make a quad rather than a gap
      const ti = di ? i : i + 1, tj = dj ? j : j + 1;
      if (ti > NU || tj > NV) continue;
      const h2 = outer[ti][tj], a2 = inner[ti][tj], a1 = inner[i][j];
      if (h2 == null || a2 == null || a1 == null) continue;
      bag.quad(a1, here, h2, a2);
    }
  }
}

// a ring of fasteners round a plate's outline — screws on a metal or ply
// panel, lacing eyelets on fabric. THE COUNT IS DERIVED FROM THE PITCH, not
// chosen: GEN_BUILD_GRAMMAR states real fastener pitches in millimetres and a
// panel with eight screws whatever its size is a panel drawn by eye.
function fastenRing(bag, F, w, h, t, pitch, r, surf) {
  const per = Math.PI * 0.5;               // rounded-rect perimeter, near enough
  const peri = 2 * (w + h) - (8 - 2 * per) * Math.min(w, h) * 0.15;
  const n = Math.max(6, Math.round(peri / Math.max(0.012, pitch)));
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n;
    // the outline, inset by an edge distance — 2D on a rivet, and the reason
    // a real row sits INSIDE the sheet edge rather than on it
    const cu = Math.cos(a), cv = Math.sin(a);
    const k = 1 / Math.max(Math.abs(cu) / (w * 0.5 - r * 2.2),
                           Math.abs(cv) / (h * 0.5 - r * 2.2));
    const u = cu * k, v = cv * k;
    const P = surf ? surf(u, v) : at(F, u, v, 0);
    const N = surf && surf.n ? surf.n(u, v) : F.n;
    bolt(bag, off(P, N, t), N, r, r * 0.55);
  }
}

// ---------------------------------------------------------------------------
// THE FORMS
// ---------------------------------------------------------------------------
// Each takes (bags, F, size, ctx). `ctx.surf` is the caller's "put this point
// back on the skin" helper, so a form that spreads over the surface follows
// it; a small form ignores it and sits on its own tangent plane, which for
// anything under about 60 mm is the same picture and half the vertices.
const FORMS = {

  // ---- ACCESS AND FLUIDS -------------------------------------------------

  // the screwed oval inspection plate: a 6 mm doubler with a ring of screws.
  // The single most characteristic thing about it is the SCREWS, and their
  // pitch is the construction's own.
  plateOval(bags, F, S, ctx) {
    const w = S.w || 0.15, h = S.h || 0.11, t = S.t || 0.0018;
    plateInto(bags.paint, F, w, h, t, Math.min(w, h) * 0.42, ctx && ctx.surf);
    fastenRing(bags.metal, F, w, h, t + 0.0006,
      (ctx && ctx.pitch) || 0.048, 0.0035, ctx && ctx.surf);
  },

  // the fabric inspection ring: a doped-on ring with lacing eyelets and NO
  // plate at all — you unlace it and the fabric is the cover. It is the
  // clearest visual difference between a fabric aeroplane and a metal one at
  // this scale, which is why the table picks it by construction.
  ringLace(bags, F, S, ctx) {
    const d = Math.min(S.w || 0.13, S.h || 0.13);
    // the ring itself: a shallow torus-ish revolve, 2 mm proud
    revolve(bags.paint, F.p, F.n,
      [[d * 0.40, 0.0006], [d * 0.46, 0.0020], [d * 0.50, 0.0016],
       [d * 0.50, 0.0004]], 24, false);
    revolve(bags.paint, F.p, F.n,
      [[d * 0.40, 0.0006], [d * 0.40, 0.0000]], 24, false);
    const n = Math.max(8, Math.round(Math.PI * d / 0.022));
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n;
      const P = at(F, Math.cos(a) * d * 0.45, Math.sin(a) * d * 0.45, 0);
      revolve(bags.metal, off(P, F.n, 0.0016), F.n,
        [[0.0022, 0], [0.0030, 0.0012], [0.0022, 0.0016]], 8, true);
    }
  },

  // a proud filler cap: the turned flange, the domed lid and its lever. This
  // is a thing you can catch a glove on, which is exactly why it is geometry
  // and not a decal.
  capProud(bags, F, S) {
    const d = S.d || 0.075, hh = S.h || 0.014;
    revolve(bags.metal, F.p, F.n,
      [[d * 0.62, 0.0008], [d * 0.62, 0.0030], [d * 0.54, 0.0042],
       [d * 0.50, hh * 0.55], [d * 0.44, hh * 0.92], [d * 0.30, hh],
       [0.0, hh * 0.98]], 26, false);
    revolve(bags.metal, F.p, F.n, [[d * 0.62, 0.0008], [0, 0.0008]], 26, false);
    // the lever, lying across the lid: two lugs and a bar
    const L = d * 0.72;
    tube(bags.metal, at(F, -L * 0.5, 0, hh * 1.02), at(F, L * 0.5, 0, hh * 1.02),
         d * 0.055, 8);
    for (const s of [-1, 1])
      tube(bags.metal, at(F, s * L * 0.5, 0, hh * 1.02),
           at(F, s * L * 0.42, 0, hh * 0.55), d * 0.045, 6);
  },

  // a flush cap: the same part, let into the skin. Almost nothing stands
  // proud — which is the point of a flush cap and why the wing gets one.
  capFlush(bags, F, S) {
    const d = S.d || 0.075, hh = S.h || 0.004;
    revolve(bags.metal, F.p, F.n,
      [[d * 0.58, 0.0004], [d * 0.58, hh * 0.5], [d * 0.50, hh],
       [d * 0.20, hh], [0, hh * 0.86]], 24, false);
    revolve(bags.metal, F.p, F.n, [[d * 0.58, 0.0004], [0, 0.0004]], 24, false);
  },

  // a hinged door — the oil filler flap, the baggage door. The door is a
  // plate; the HINGE and the LATCH are what make it read as one, so they get
  // the detail and the panel does not.
  doorHinged(bags, F, S, ctx) {
    const w = S.w || 0.17, h = S.h || 0.13, t = S.t || 0.006;
    plateInto(bags.paint, F, w, h, t, Math.min(w, h) * 0.16, ctx && ctx.surf);
    // the piano hinge down the forward edge
    const hy = -h * 0.5;
    const n = Math.max(3, Math.round(w / 0.055));
    for (let i = 0; i < n; i++) {
      const u = (-0.5 + (i + 0.5) / n) * w * 0.92;
      tube(bags.metal, at(F, u - w * 0.030, hy, t * 0.9),
           at(F, u + w * 0.030, hy, t * 0.9), t * 0.42, 8);
    }
    // the latch, on the aft edge: a small boss and a slot
    revolve(bags.metal, at(F, 0, h * 0.40, t), F.n,
      [[t * 1.5, 0], [t * 1.5, t * 0.5], [t * 0.9, t * 0.8]], 12, true);
  },

  // the quick-drain valve: the boss in the skin and the stem you push up with
  // a screwdriver to take a fuel sample.
  drainValve(bags, F, S) {
    const d = S.d || 0.022, hh = S.h || 0.030;
    revolve(bags.metal, F.p, F.n,
      [[d * 0.80, 0.0006], [d * 0.80, d * 0.30], [d * 0.55, d * 0.42],
       [d * 0.55, hh * 0.62], [d * 0.34, hh * 0.70], [d * 0.34, hh],
       [0, hh]], 14, false);
    revolve(bags.metal, F.p, F.n, [[d * 0.80, 0.0006], [0, 0.0006]], 14, false);
  },

  // ---- INSTRUMENTS -------------------------------------------------------

  // the static port: a disc with a hole, almost flush, and DELIBERATELY
  // barely there. A static port that stands out is a static port that reads
  // the wrong altitude.
  portStatic(bags, F, S) {
    const d = S.d || 0.030, hh = S.h || 0.003;
    revolve(bags.metal, F.p, F.n,
      [[d * 0.50, 0.0004], [d * 0.50, hh * 0.55], [d * 0.34, hh],
       [d * 0.10, hh]], 18, false);
    revolve(bags.metal, F.p, F.n, [[d * 0.50, 0.0004], [d * 0.10, 0.0004]],
      18, false);
    // the hole, as a real recess rather than a dark dot
    revolve(bags.metal, off(F.p, F.n, -0.004), F.n,
      [[d * 0.10, 0], [d * 0.10, hh + 0.004]], 10, false);
  },

  // the venturi: the waisted tube on its two legs. The WAIST is the whole
  // shape — a straight tube on legs is a pitot, not a venturi, and the two
  // are different instruments doing different jobs.
  venturi(bags, F, S) {
    const d = S.d || 0.058, L = S.len || 0.19, st = S.stand || 0.07;
    const prof = [];
    const NS = 14;
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      // a cosine throat: full at both ends, 0.46 at the middle
      const r = d * 0.5 * (0.46 + 0.54 * Math.abs(Math.cos(Math.PI * (t - 0.5))));
      prof.push([r, (t - 0.5) * L]);
    }
    const axis = F.fore;
    const ctr = off(F.p, F.n, st);
    // the barrel, and its bore
    revolve(bags.metal, ctr, axis, prof, 20, false);
    revolve(bags.metal, ctr, axis, prof.map(([r, h]) => [r * 0.72, h]), 20, false);
    for (const s of [-1, 1]) {
      const e = off(ctr, axis, s * L * 0.5);
      revolve(bags.metal, e, axis, [[d * 0.5, 0], [d * 0.36, 0]], 20, false);
    }
    // two legs down to the skin, splayed fore and aft
    for (const s of [-1, 1])
      taper(bags.metal, off(ctr, axis, s * L * 0.30), at(F, 0, s * L * 0.34, 0),
            0.0045, 0.0060, 8);
  },

  // the OAT probe: a short stem and the bulb on the end of it
  probeOAT(bags, F, S) {
    const d = S.d || 0.012, L = S.len || 0.075;
    const tip = off(F.p, F.n, L);
    revolve(bags.metal, F.p, F.n,
      [[d * 1.10, 0.0006], [d * 1.10, d * 0.5], [d * 0.62, d * 0.8]], 12, false);
    tube(bags.metal, off(F.p, F.n, d * 0.6), tip, d * 0.42, 10);
    revolve(bags.metal, tip, F.n,
      [[d * 0.42, -d * 0.2], [d * 0.62, 0], [d * 0.42, d * 0.5], [0, d * 0.7]],
      12, true);
  },

  // ---- AERIALS AND LIGHTS ------------------------------------------------

  // the blade aerial: a swept fin on a doubler. Comm and transponder are the
  // same part at two sizes, which is true of the real ones as well.
  bladeAerial(bags, F, S, ctx) {
    const H = S.h || 0.23, C = S.c || 0.09, T = S.t || 0.010;
    plateInto(bags.paint, F, C * 1.5, C * 0.62, 0.0016, C * 0.2,
      ctx && ctx.surf);
    // the blade, swept aft, tapering to its tip
    const NS = 8, rows = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      const c = C * (1 - 0.62 * t * t);              // chord falls off
      const sweepV = C * 0.55 * t * t;               // and it rakes aft
      const th = T * (1 - 0.55 * t) * 0.5;
      const row = [];
      const NA = 8;
      for (let k = 0; k < NA; k++) {
        const a = 2 * Math.PI * k / NA;
        // a flattened section: an aerial is a blade, not a rod
        row.push(bags.paint.v(at(F,
          Math.sin(a) * th,
          sweepV + Math.cos(a) * c * 0.5,
          0.0016 + H * t + (1 - Math.cos(a)) * 0)));
      }
      rows.push(row);
    }
    for (let i = 0; i < NS; i++) for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      bags.paint.quad(rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]);
    }
    // close the tip
    for (let k = 1; k < 7; k++)
      bags.paint.tri(rows[NS][0], rows[NS][k], rows[NS][k + 1]);
  },

  // the wire aerial: a short mast and the wire running aft from it. The WIRE
  // is the aerial; the mast is only what holds it off the skin.
  wireAerial(bags, F, S) {
    const H = S.h || 0.12, run = S.run || 1.2;
    const top = off(F.p, F.n, H);
    taper(bags.metal, F.p, top, 0.0060, 0.0035, 8);
    revolve(bags.metal, F.p, F.n,
      [[0.014, 0.0006], [0.014, 0.004], [0.008, 0.007]], 12, true);
    // the wire itself, with a real catenary — a dead straight wire looks
    // like a modelling mistake even when it is the right length
    const end = at(F, 0, run, H * 0.28);
    const N = 10, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = lerp3(top, end, t);
      const sag = Math.sin(Math.PI * t) * run * 0.012;
      pts.push([p[0] - F.n[0] * sag, p[1] - F.n[1] * sag, p[2] - F.n[2] * sag]);
    }
    for (let i = 0; i < N; i++) tube(bags.metal, pts[i], pts[i + 1], 0.0014, 5);
  },

  // the anti-collision beacon: the base, and the coloured lens on top of it
  lightBeacon(bags, F, S) {
    const d = S.d || 0.062, hh = S.h || 0.055;
    revolve(bags.paint, F.p, F.n,
      [[d * 0.56, 0.0006], [d * 0.56, hh * 0.16], [d * 0.44, hh * 0.30]],
      18, false);
    revolve(bags.paint, F.p, F.n, [[d * 0.56, 0.0006], [0, 0.0006]], 18, false);
    revolve(bags.lens, off(F.p, F.n, hh * 0.30), F.n,
      [[d * 0.44, 0], [d * 0.46, hh * 0.24], [d * 0.40, hh * 0.52],
       [d * 0.24, hh * 0.66], [0, hh * 0.70]], 18, true);
  },

  // ---- HANDLING ----------------------------------------------------------

  // the boarding step: a bar on two legs, bolted through a ring frame. It
  // reaches DOWN and OUT, because that is where a foot goes.
  stepBoard(bags, F, S, ctx) {
    const reach = S.reach || 0.15, w = S.w || 0.11, r = S.r || 0.011;
    plateInto(bags.paint, F, w * 1.6, w * 0.75, 0.0020, w * 0.22,
      ctx && ctx.surf);
    // out along the normal, then the tread across it
    const knee = off(F.p, F.n, reach * 0.86);
    const a = at(F, -w * 0.5, 0, reach * 0.86), b = at(F, w * 0.5, 0, reach * 0.86);
    for (const s of [-1, 1])
      tube(bags.metal, at(F, s * w * 0.34, 0, 0.002),
           at(F, s * w * 0.5, 0, reach * 0.86), r * 0.72, 8);
    tube(bags.metal, a, b, r, 10);
    // the tread's grip: three small bands rather than a texture
    for (const t of [-0.28, 0, 0.28])
      revolve(bags.metal, at(F, t * w, 0, reach * 0.86), F.side,
        [[r * 1.22, -w * 0.016], [r * 1.22, w * 0.016]], 10, false);
  },

  // the grab handle: the same idea, one bolt-through each end, up where a
  // hand actually reaches
  handleGrab(bags, F, S, ctx) {
    const reach = S.reach || 0.07, w = S.w || 0.13, r = S.r || 0.009;
    for (const s of [-1, 1]) {
      const foot = at(F, s * w * 0.5, 0, 0);
      revolve(bags.paint, foot, F.n,
        [[r * 2.0, 0.0006], [r * 2.0, r * 0.6], [r * 1.3, r * 0.9]], 12, true);
    }
    // a filleted U: two uprights and a bar, rounded at both bends
    const path = fillet([
      at(F, -w * 0.5, 0, 0.002),
      at(F, -w * 0.5, 0, reach),
      at(F,  w * 0.5, 0, reach),
      at(F,  w * 0.5, 0, 0.002),
    ], r * 2.2, 5);
    sweep(bags.metal, resample(path, 26), () => secRound(r, 9), true, F.n);
  },

  // the tie-down ring: the boss, and the ring hanging out of it. A tie-down
  // that is a solid loop is a tie-down nobody can get a rope through.
  ringTiedown(bags, F, S) {
    const d = S.d || 0.044, t = S.t || 0.008;
    revolve(bags.metal, F.p, F.n,
      [[d * 0.42, 0.0006], [d * 0.42, t * 0.5], [d * 0.28, t * 0.8]], 14, true);
    // the ring, in the plane of side x normal, standing out of the boss
    const ctr = off(F.p, F.n, t * 0.8 + d * 0.34);
    const N = 18, R = d * 0.34;
    const rows = [];
    for (let i = 0; i <= N; i++) {
      const a = 2 * Math.PI * i / N;
      const c = [ctr[0] + F.side[0] * Math.cos(a) * R + F.n[0] * Math.sin(a) * R,
                 ctr[1] + F.side[1] * Math.cos(a) * R + F.n[1] * Math.sin(a) * R,
                 ctr[2] + F.side[2] * Math.cos(a) * R + F.n[2] * Math.sin(a) * R];
      rows.push(c);
    }
    for (let i = 0; i < N; i++) tube(bags.metal, rows[i], rows[i + 1], t * 0.42, 6);
  },
};

// which bag names a form may write into — the three the layer creates
const FIT_BAGS = ['paint', 'metal', 'lens'];

// The three skins an aeroplane has, and all three are placed now (G84). They
// are three different kinds of thing — a mesh with a field in cage units, a
// mesh with the same field already in metres, and an analytic surface — which
// is why `on` names one rather than pretending there is a single surface.
// A row on a surface with no placer is REPORTED unplaced, never dropped: an
// aeroplane quietly missing its wing filler cap is the acceptance test failing
// quietly, and quietly is how this gap survived two chantiers.
// ...and a fourth since G189: the ROD boom, a tube a fitting is CLAMPED to
// rather than let into (placed by _cage_access.js rodSite — a split collar
// under whatever the row's own form is).
const FIT_SURFACES = { body: true, wing: true, cowl: true, rod: true };

const API = { FORMS, FIT_BAGS, FIT_SURFACES, plateInto, fastenRing, at };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.FIT_GEN = API;

})();
