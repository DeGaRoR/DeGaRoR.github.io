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
  // PILLAR-ANCHORS (3 Nov, the user: "I hate the pixelated shape used as a base"): THE OUTLINE IS A CURVE, NOT A
  // GRID. The plate was a 9 x 7 grid with the points outside the rounded rectangle dropped, so every plate's edge was
  // a staircase of grid cells. It is now RINGS of the outline itself - the rounded rectangle walked at 28 points
  // (each corner a quarter circle of radius rr), scaled in toward the centre - so the edge is smooth at any size
  // (28 x 2 quads + a fan, both sheets, ~280 triangles). The feather is kept: the outer ring stands at 15 % of `t`.
  const rr = Math.min(r || Math.min(w, h) * 0.30, Math.min(w, h) * 0.48);
  const hu = w / 2 - rr, hv = h / 2 - rr, NC = 7;
  const ol = [];
  for (const [cu, cv, a0] of [[hu, hv, 0], [-hu, hv, Math.PI / 2], [-hu, -hv, Math.PI], [hu, -hv, 1.5 * Math.PI]])
    for (let k = 0; k < NC; k++) { const a = a0 + (Math.PI / 2) * k / (NC - 1); ol.push([cu + rr * Math.cos(a), cv + rr * Math.sin(a)]); }
  const RINGS = [1, 0.92, 0.55];                      // the outline scaled in; the feather lives in the outer band
  const lift = [0.15, 1, 1];
  const pt = (u, v, dz) => {
    const P = surf ? surf(u, v) : at(F, u, v, 0);
    const N = surf && surf.n ? surf.n(u, v) : F.n;
    return bag.v(off(P, N, 0.0006 + dz));
  };
  const n = ol.length;
  const outer = RINGS.map((k, ri) => ol.map(([u, v]) => pt(u * k, v * k, t * lift[ri])));
  const inner = RINGS.map(k => ol.map(([u, v]) => pt(u * k, v * k, 0)));
  const cO = pt(0, 0, t), cI = pt(0, 0, 0);
  for (let ri = 0; ri + 1 < RINGS.length; ri++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      bag.quad(outer[ri][i], outer[ri][j], outer[ri + 1][j], outer[ri + 1][i]);
      bag.quad(inner[ri][i], inner[ri + 1][i], inner[ri + 1][j], inner[ri][j]);
    }
  const L = RINGS.length - 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    bag.tri(outer[L][i], outer[L][j], cO);
    bag.tri(inner[L][j], inner[L][i], cI);
    bag.quad(inner[0][i], inner[0][j], outer[0][j], outer[0][i]);      // the rim, closed
  }
}

// a ring of fasteners round a plate's outline — screws on a metal or ply
// panel, lacing eyelets on fabric. THE COUNT IS DERIVED FROM THE PITCH, not
// chosen: GEN_BUILD_GRAMMAR states real fastener pitches in millimetres and a
// panel with eight screws whatever its size is a panel drawn by eye.
// a hatch's SEAM: a 2 mm band along its outline, 1.5 mm off the skin - the drawn line of a hatch
function seamLine(bag, F, w, h, r, surf) {
  const rr = Math.min(r || Math.min(w, h) * 0.30, Math.min(w, h) * 0.48), hu = w / 2 - rr, hv = h / 2 - rr, NC = 7;
  const ol = [];
  for (const [cu, cv, a0] of [[hu, hv, 0], [-hu, hv, Math.PI / 2], [-hu, -hv, Math.PI], [hu, -hv, 1.5 * Math.PI]])
    for (let k = 0; k < NC; k++) { const a = a0 + (Math.PI / 2) * k / (NC - 1); ol.push([cu + rr * Math.cos(a), cv + rr * Math.sin(a)]); }
  const pt = (u, v) => { const P = surf ? surf(u, v) : at(F, u, v, 0); const N = surf && surf.n ? surf.n(u, v) : F.n; return bag.v(off(P, N, 0.0015)); };
  const k0 = 1, k1 = 1 - 0.002 / Math.max(0.01, Math.min(w, h) * 0.5);
  const A = ol.map(([u, v]) => pt(u * k0, v * k0)), B = ol.map(([u, v]) => pt(u * k1, v * k1));
  for (let i = 0; i < ol.length; i++) { const j = (i + 1) % ol.length; bag.quad(A[i], A[j], B[j], B[i]); }
}
function fastenRing(bag, F, w, h, t, pitch, r, surf, flat) {
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
    if (flat) revolve(bag, off(P, N, t), N, [[r, 0], [r, flat], [0, flat]], 8, false);   // a flat head, drawn
    else bolt(bag, off(P, N, t), N, r, r * 0.55);
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
    // PILLAR-ANCHORS (3 Nov, the user: the access doors "should probably be almost a texture job only drawing a
    // little trap somewhere"): THE HATCH IS DRAWN, NOT BOLTED ON. No plate at all - the skin under it is the hatch,
    // in the skin's own colour - only its SEAM, a 2 mm dark line round it a hair proud, and flat screw heads. (A
    // 0.4 mm plate was tried and failed: the fittings' paint is the livery's base colour, not the stripe it lands
    // on, and that close to the skin it fought the skin for depth)
    const w = S.w || 0.15, h = S.h || 0.11;
    seamLine(bags.metal, F, w, h, Math.min(w, h) * 0.42, ctx && ctx.surf);
    fastenRing(bags.metal, F, w * 0.90, h * 0.90, 0.0012,
      (ctx && ctx.pitch) || 0.048, 0.0024, ctx && ctx.surf, 0.0004);
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

  // THE FUEL SIGHT GAUGE (G2808, E8 of the status: billed, never drawn, and the minimal fit's only fuel
  // instrument): the J-3's cork on a wire - the proud cap with a stiff wire standing up through the middle of the
  // lid, its top bent over into a small hook the pilot reads against the windscreen. The cork rides inside the tank.
  capSight(bags, F, S, ctx) {
    FORMS.capProud(bags, F, S, ctx);
    const d = S.d || 0.075, hh = S.h || 0.014, rise = S.wire || 0.11;
    revolve(bags.metal, F.p, F.n, [[d * 0.09, hh * 0.98], [d * 0.07, hh * 1.25], [0, hh * 1.25]], 12, false);  // the guide boss
    tube(bags.metal, at(F, 0, 0, hh), at(F, 0, 0, hh + rise), 0.0012, 6);
    tube(bags.metal, at(F, 0, 0, hh + rise), at(F, 0.012, 0, hh + rise + 0.006), 0.0012, 6);
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

  // a hinged door — the oil filler flap, the baggage door. The door is the
  // skin, drawn by its seam; the HINGE and the LATCH are what make it read as
  // one, so they get the detail and the panel does not.
  doorHinged(bags, F, S, ctx) {
    // PILLAR-ANCHORS (3 Nov, the user: the access doors' "pixelated anchor"): the door is the skin, drawn by its
    // seam; the hinge and the latch stand on it
    const w = S.w || 0.17, h = S.h || 0.13, t = 0.0015;
    seamLine(bags.metal, F, w, h, Math.min(w, h) * 0.16, ctx && ctx.surf);
    // the piano hinge down the forward edge
    const hy = -h * 0.5;
    const n = Math.max(3, Math.round(w / 0.055));
    for (let i = 0; i < n; i++) {
      const u = (-0.5 + (i + 0.5) / n) * w * 0.92;
      tube(bags.metal, at(F, u - w * 0.030, hy, 0.0026),
           at(F, u + w * 0.030, hy, 0.0026), 0.0024, 8);
    }
    // the latch, on the aft edge: a small flat boss (a drawn catch, 1.5 mm proud)
    revolve(bags.metal, at(F, 0, h * 0.40, t), F.n,
      [[0.007, 0], [0.007, 0.0012], [0.005, 0.0016], [0, 0.0016]], 12, false);
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
    // PILLAR-ANCHORS (3 Nov, the user: "I keep hating the step handle. I hate the pixelated shape used as a base, I
    // hate the handle shape, this one has to be fully remodeled"; "always a narrow pillar step"). THE NARROW PILLAR
    // STEP: no plate - a turned boss on the post, one round stem out of it bent down and out, and a small tread pad
    // (a rounded disc with a lip) at its end; nothing wider than a pillar. S.reach the tread's stand-off, S.r the
    // stem's radius; the tread 64 mm across
    const reach = S.reach || 0.15, r = Math.min(S.r || 0.011, 0.010), d = 0.064;
    revolve(bags.metal, F.p, F.n,
      [[r * 2.3, 0.0004], [r * 2.3, 0.004], [r * 1.9, 0.009], [r * 1.25, 0.013]], 14, true);
    // the stem: out of the boss, a smooth bend, down to the tread (F.fore is the frame's along; -v is down the
    // flank on a side site - the stem drops a little so the pad sits below the boss, a foot's natural reach)
    // DOWN on the skin: the world's -y laid into the site's tangent plane (a step on a flank drops toward the
    // ground whatever the frame's own `fore` is)
    const n = F.n, dd = -n[1];
    let dn = [-n[0] * dd, -1 - n[1] * dd, -n[2] * dd];
    const dl = Math.hypot(dn[0], dn[1], dn[2]);
    dn = dl > 1e-6 ? [dn[0] / dl, dn[1] / dl, dn[2] / dl] : F.fore;
    const Pt = (out, down) => [F.p[0] + n[0] * out + dn[0] * down, F.p[1] + n[1] * out + dn[1] * down, F.p[2] + n[2] * out + dn[2] * down];
    const path = fillet([Pt(0.010, 0), Pt(reach * 0.55, 0), Pt(reach * 0.92, reach * 0.22)], r * 3, 6);
    sweep(bags.metal, resample(path, 12), () => secRound(r, 10), true, n);
    // the tread: a rounded pad, flat to the ground (its axis the world's up), at the stem's end
    revolve(bags.metal, Pt(reach * 0.92, reach * 0.22 + r), [0, 1, 0],
      [[0, -0.003], [d * 0.44, -0.003], [d * 0.5, 0], [d * 0.5, 0.004], [d * 0.44, 0.006], [0, 0.006]], 16, false);
  },

  // the grab handle: the same idea, one bolt-through each end, up where a
  // hand actually reaches
  handleGrab(bags, F, S, ctx) {
    const reach = S.reach || 0.07, w = S.w || 0.13, r = S.r || 0.009;
    for (const s of [-1, 1]) {
      const foot = at(F, s * w * 0.5, 0, 0);
      // PILLAR-ANCHORS (3 Nov, the user: "the old U style would even be better" - clean and smooth): a turned
      // foot, rounded into the bar, and a rounder bar (14 / 10 sides where it had 12 / 9)
      revolve(bags.paint, foot, F.n,
        [[r * 2.0, 0.0006], [r * 2.0, r * 0.35], [r * 1.75, r * 0.75], [r * 1.25, r * 1.0]], 14, true);
    }
    // a filleted U: two uprights and a bar, rounded at both bends
    const path = fillet([
      at(F, -w * 0.5, 0, 0.002),
      at(F, -w * 0.5, 0, reach),
      at(F,  w * 0.5, 0, reach),
      at(F,  w * 0.5, 0, 0.002),
    ], r * 2.6, 5);
    sweep(bags.metal, resample(path, 20), () => secRound(r, 10), true, F.n);
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
const FIT_SURFACES = { body: true, wing: true, cowl: true, rod: true, boom: true,   // G278: the twin booms
                       door: true };                                              // G310: the cabin doors

const API = { FORMS, FIT_BAGS, FIT_SURFACES, plateInto, fastenRing, at };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.FIT_GEN = API;

})();
