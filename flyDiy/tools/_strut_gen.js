// STRUT GENERATOR (G86/G87) — WHERE A LIFT STRUT MEETS THE FUSELAGE.
//
// The user's report, with the two feet circled on a screenshot: "struts need
// to be properly positioned on the 3d fuselage, probably using the same method
// as the suspension fittings; a clear metal plate with bolts and screws,
// constrained to the aircraft skin, with appropriate sliders in the editor to
// control the exact placement fore/aft and lateral".
//
// WHAT WAS WRONG. The lift struts came over from the game's own generator
// wholesale — `63_gen_skin.js` draws every external wing beam, and
// `_cage_wing.js` put that group on the cage unchanged. Their lower end is a
// TRUSS NODE: `61_gen_frame.js`'s cabin lower longeron (G59.2 clamped it to
// the last full-section ring, which is why it is close). But the truss is a
// synthetic frame built from a MEASURED cabin box, and the cage's skin is a
// lofted surface — the two agree to a few centimetres and no better. A few
// centimetres is exactly the distance at which a strut end reads as floating,
// and the strut arrived with no fitting at all: a streamline tube stopping in
// mid-air beside the belly.
//
// WHAT IS RIGHT, and it is the rule the undercarriage has followed since G20:
// NO PART IS DRAWN "NEAR" THE AEROPLANE. It asks the airframe contract for the
// surface point and normal at its station and builds its bracket ON that
// surface, oriented to it. `fitFrame`/`fitPad` (_gear_gen.js:606) already
// answer that question, they are proven over the entire undercarriage, and the
// user named them himself. So this file adds no new mounting machinery — it
// adds the one thing the undercarriage did not need: a way to CHOOSE the
// station from the structure instead of from a slider.
//
// ---------------------------------------------------------------------------
// THE SITE IS THE STRUCTURE'S OWN ANSWER, SNAPPED TO THE SKIN.
//
// G59.2's ruling stands — "the reference for hook points should be the
// internal structure" — and this does not overturn it, it finishes it. The
// frame still decides WHICH longeron and WHICH ring the strut lands on; the
// skin decides WHERE that is in space. `strutSnap` takes the frame's own strut
// root and returns the nearest point of the built surface, as a station and an
// angle the airframe contract can be asked for again. The foot is then on the
// skin BY CONSTRUCTION and cannot drift from it when the cage is reshaped,
// because it is re-derived from the cage every build.
//
// THE TWO TRIM OFFSETS ARE ARC LENGTHS IN METRES, not angles and not
// fractions. A degree is 6 mm on a tail cone and 11 mm on a cabin, so an
// angular slider means a different thing on every aeroplane and on the same
// aeroplane at two stations; a millimetre is a millimetre. `dLat` is measured
// AROUND THE SECTION from the snapped angle, positive outboard-and-up the
// flank the strut is already on, and it is clamped so a foot can never cross
// the keel onto the other side or climb over the deck.
//
// ---------------------------------------------------------------------------
// UNITS: METRES, throughout, in cage space (z forward, y up, x lateral). The
// airframe contract is already converted (`cageAirframe` scales once, on the
// vertices) and the hardware is metric and never scales — the crew layer's
// rule, and the reason a wheel can be a ruler.
'use strict';
(() => {

// ---- the declared fitting, in metres --------------------------------------
// Every number here is a real dimension of a real fitting, and the gate reads
// this table rather than the drawing: a plate shorter than the pins it carries
// or a blade thicker than the clevis it enters is a fault in THIS object, and
// it is cheaper to catch here than in a screenshot.
const STRUT_FIT = {
  padL: 0.260, padW: 0.100, padT: 0.007,  // the doubler that spreads the load
  lugGap: 0.058,        // front pin to rear pin, HALF the spread, along fore
  lugR: 0.016,          // the bored eye
  lugT: 0.009,          // one ear, across the pin
  standoff: 0.055,      // skin to pin centre
  pinR: 0.009, pinShank: 0.040,
  screwR: 0.0055, screwL: 0.007,
  strutR: 0.023,        // 63_gen_skin's own: GEN_TUBE_R.wing * 1.15 (ext)
  chordK: 3.6,          // ...and its chord rule, cw = 3.6 r
  bladeC: 0.052,        // the machined end, flattened into the clevis
  bladeT: 0.011,
  endFrac: 0.11,        // how much of each end is that transition
  // THE WING END. Smaller, because it spreads into a spar cap rather than into
  // a 0.6 mm skin, and shorter because the band it may sit in is the wing's
  // structural chord — see the fore/aft clamp in _cage_wing.js.
  wingPadL: 0.130, wingPadW: 0.078, wingPadT: 0.005,
  wingStandoff: 0.038,
};

// ---- the band the strut may be moved in, as CHORD FRACTIONS ---------------
// User, on the fore/aft slider: "my fore/aft suggestion was constrained to the
// wing chord of course, and even excluding the leading edge and the control
// surface sections, it can only move between those."
//
// So the trim is not a free number. The front fitting may not go ahead of the
// nose rib and the rear fitting may not go behind the aileron hinge, and both
// move TOGETHER because a strut is straight. The margins are what a fitting
// needs to be a fitting: 6 % of chord clear of the leading-edge skin, where
// there is no spar to bolt to, and 4 % clear of the hinge line, where there is
// a gap and a control horn.
const STRUT_BAND = { le: 0.06, hinge: 0.04 };

// -> { lo, hi }, metres of BODY x (aft positive), the interval the pair of
// fittings may be shifted by. It shrinks with chord, which is the point: a
// 1.15 m chord has less room than a 2.10 m one. It can be EMPTY — a wing whose
// rear spar already sits under its own aileron has nowhere to go — and an
// empty band is reported as {0, 0} rather than as an inverted one, so the
// caller's clamp degrades to "the frame's own answer" instead of to nonsense.
//
// AND IT ALWAYS CONTAINS ZERO, which is not a rounding but the whole posture
// the user asked for: "prefer constraining the visuals to the existing physics
// rather than adding new physics now". Zero is where 61_gen_frame.js put the
// beam. A band that excluded it would make the DEFAULT build move its own
// struts away from the beams they stand for, with the physics never told —
// exactly the divergence this bound exists to prevent.
//
// It happens, and the gate found it: a 35 % aileron chord puts the hinge line
// at 0.61 while the rear spar is at 0.65, so the frame's own rear fitting is
// already inside the control surface. Clamped, such a wing gets a band that
// only lets the pair move FORWARD — it can go where there is room and it never
// moves itself. That the frame builds it that way at all is a note for the
// frame, not something to quietly correct here.
function strutBand(chord, sparFront, sparRear, ailChord) {
  const c = chord > 0 ? chord : 1.6;
  const sF = sparFront != null ? sparFront : 0.15;
  const sR = sparRear != null ? sparRear : 0.65;
  const ac = ailChord > 0 ? ailChord : 0.22;
  const lo = (STRUT_BAND.le - sF) * c;
  const hi = ((1 - ac) - STRUT_BAND.hinge - sR) * c;
  if (!(hi > lo)) return { lo: 0, hi: 0 };
  return { lo: Math.min(lo, 0), hi: Math.max(hi, 0) };
}

// ---- vector helpers (this file's own: it must load in node) ---------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d3 = (a, b) => {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return Math.sqrt(x * x + y * y + z * z);
};
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                        a[0] * b[1] - a[1] * b[0]];
const nrm3 = v => {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
};

// ---- 1. THE SNAP -----------------------------------------------------------
// The nearest point of the airframe surface to `p`, as (z, ang).
//
// A SCAN, NOT A WALK, and the reason is the shape. A fuselage section is
// star-shaped about its own centre — that is what lets the contract express it
// as a radius per angle at all — but it is NOT convex: a cabin with a door
// sill, a fairing or a keel step has dents in it, and a gradient walk started
// at the wrong angle settles in one. The full sweep costs 72 x 21 table
// lookups (`surf` is an interpolated lookup, not a raycast) and cannot.
//
// Then four narrowing passes. Each halves the window and re-scans 9 x 9, so
// the answer converges to under a tenth of a millimetre in both coordinates
// while every evaluation is still an independent sample of the surface.
function strutSnap(AF, p, opt) {
  const pad = (opt && opt.pad != null) ? opt.pad : 0.05;
  const zLo = AF.z0 + pad, zHi = AF.z1 - pad;
  const NA = (opt && opt.na) || 72;
  const win = (opt && opt.win) || 0.70;      // the z window, half-width
  let bz = clamp(p[2], zLo, zHi), ba = 0, bd = Infinity;
  const test = (z, a) => {
    const d = d3(AF.surf(z, a), p);
    if (d < bd) { bd = d; bz = z; ba = a; }
  };
  const z0 = clamp(p[2], zLo, zHi);
  for (let k = 0; k < NA; k++) {
    const a = -Math.PI + 2 * Math.PI * k / NA;
    for (let i = -10; i <= 10; i++)
      test(clamp(z0 + win * i / 10, zLo, zHi), a);
  }
  let wz = win / 10, wa = Math.PI / NA;
  for (let pass = 0; pass < 5; pass++) {
    const cz = bz, ca = ba;
    for (let i = -4; i <= 4; i++) for (let k = -4; k <= 4; k++)
      test(clamp(cz + wz * i / 4, zLo, zHi), ca + wa * k / 4);
    wz *= 0.5; wa *= 0.5;
  }
  return { z: bz, ang: ba, d: bd, p: AF.surf(bz, ba) };
}

// ---- 2. THE SITE -----------------------------------------------------------
// The snap, plus the player's two trim offsets, clamped onto the body.
//
// THE FLANK IS PART OF THE ANSWER. `side` is the sign of the snapped angle —
// which flank of the aeroplane this foot is on — and every clamp below is
// expressed in it, so the right-hand slider and the left-hand slider move
// their feet the SAME way (outboard) rather than mirror-opposite ways. A
// slider that moves one strut out and the other in is a slider nobody can use.
function strutSite(AF, seed, dz, dLat, opt) {
  const pad = (opt && opt.pad != null) ? opt.pad : 0.05;
  const snap = strutSnap(AF, seed, opt);
  const z = clamp(snap.z + (dz || 0), AF.z0 + pad, AF.z1 - pad);
  const side = snap.ang >= 0 ? 1 : -1;
  const lim = Math.PI - 0.12;               // never over the deck
  const kel = 0.04;                         // never across the keel
  const lo = side > 0 ? kel : -lim, hi = side > 0 ? lim : -kel;
  // THE ARC IS WALKED, NOT DIVIDED. `dLat / r` at the starting angle is only
  // right on a circle: a section is an ellipse with a chine in it, so its
  // radius changes as you go round and a single division overshoots on the
  // way out to the flank and undershoots on the way back. Measured on the
  // gate's own body, dividing put a 60 mm slider 66 mm round the section —
  // a 10 % error in the one thing this slider claims to be. Walking it in
  // 3 mrad steps and interpolating the last one is exact to the step, and it
  // stops dead at the clamp instead of sliding past it.
  let ang = clamp(snap.ang, lo, hi);
  const dir = ((dLat || 0) >= 0 ? 1 : -1) * side;
  let rem = Math.abs(dLat || 0), p = AF.surf(z, ang);
  const STEP = 0.003;
  while (rem > 1e-9) {
    const nx = clamp(ang + dir * STEP, lo, hi);
    if (nx === ang) break;                  // the clamp: the flank ran out
    const q = AF.surf(z, nx);
    const seg = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    if (seg >= rem) { ang += (nx - ang) * (rem / Math.max(seg, 1e-12)); break; }
    rem -= seg; ang = nx; p = q;
  }
  // the section's own radius at the site, for the callers that report it
  const p1 = AF.surf(z, ang), cy = AF.cyAt(z);
  const r = Math.max(0.05, Math.hypot(p1[0], p1[1] - cy));
  return { z, ang, side, r, snap };
}

// ---- 3. THE SKIN, EXACTLY, OVER ONE PATCH ---------------------------------
// THE CONTRACT IS A SAMPLED SURFACE AND THE SKIN IS THE MESH, and the fitting
// has to sit on the second one.
//
// `meshAirframe` stores the body as a radius per (96 stations x 72 angles) and
// interpolates bilinearly between them. That is the right instrument for what
// it was built for — asking where to STAND a leg — and it is wrong by a few
// millimetres, in both directions, as the interpolation crosses a crease or a
// ring. MEASURED on the stock cage by casting the drawn skin against the
// doubler's own vertices: the plate stood 3.0 mm proud at some corners and was
// 3.5 mm UNDER the skin at others, against the 0.8 mm of clearance fitPad
// holds. So the skin came through the middle of the plate and cut it into two
// strips, which is what the first screenshot of this chantier showed.
//
// THE CURE IS NOT A BIGGER STAND-OFF. A doubler is flush; one floating 8 mm
// off the fabric is a different wrong picture, and a fudge factor tuned on one
// aeroplane is not a rule. The cure is to ask the MESH instead of the table
// over the small patch the fitting occupies: the same contract, the same
// angles, the same stations, an exact radius. The section solver is
// `meshAirframe`'s own, deliberately — one slice per query, the farthest hit
// wins — with the faces prefiltered to the band once, so a whole fitting costs
// one pass over the skin and a few hundred segment tests.
//
// It DEGRADES, and has to: a body with no mesh behind it (the gear bench's
// analytic stub) gets the table back, unchanged.
// ONE PER BUILD, and it has to be: the two sides of an aeroplane are mirrored,
// so both feet want the same band of the same body, and the walk over every
// face of a 14 000-quad skin is the expensive half. The key is the AIRFRAME
// OBJECT ITSELF, which the layer rebuilds from scratch every time the cage
// changes — so the cache cannot go stale, and there is nothing to invalidate.
let skinCache = null;

function strutSkin(AF, zLo, zHi) {
  const M = AF && AF.mesh;
  if (!M || !M.V || !M.F || !M.F.length) return null;
  const a = zLo - 0.06, b = zHi + 0.06;
  if (skinCache && skinCache.AF === AF &&
      Math.abs(skinCache.a - a) < 1e-9 && Math.abs(skinCache.b - b) < 1e-9)
    return skinCache.S;
  const band = [];
  for (const f of M.F) {
    let lo = Infinity, hi = -Infinity;
    for (const i of f) { const z = M.V[i][2]; if (z < lo) lo = z; if (z > hi) hi = z; }
    if (hi >= a && lo <= b) band.push(f);
  }
  if (!band.length) return null;
  // ...and bucketed by station inside the band, the same trick meshAirframe
  // uses on the whole body: a query slices at ONE z, so it has no business
  // testing a quad four bays away. Measured on the stock cage this is the
  // difference between 51 ms and 12 ms of rebuild.
  const NB = 24, span = Math.max(1e-6, b - a);
  const buckets = Array.from({ length: NB + 1 }, () => []);
  const ib = z => Math.max(0, Math.min(NB, Math.floor((z - a) / span * NB)));
  for (const f of band) {
    let lo = Infinity, hi = -Infinity;
    for (const i of f) { const z = M.V[i][2]; if (z < lo) lo = z; if (z > hi) hi = z; }
    for (let k = ib(lo); k <= ib(hi); k++) buckets[k].push(f);
  }
  const radAt = (z, ang) => {
    const cy = AF.cyAt(z);
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    let best = 0;
    for (const f of (z < a || z > b ? band : buckets[ib(z)])) {
      let n = 0, h0x = 0, h0y = 0, h1x = 0, h1y = 0;
      for (let k = 0; k < f.length && n < 2; k++) {
        const A = M.V[f[k]], B = M.V[f[(k + 1) % f.length]];
        const dA = A[2] - z, dB = B[2] - z;
        if ((dA > 0) === (dB > 0)) continue;
        const t = dA / (dA - dB);
        const x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t;
        if (n === 0) { h0x = x; h0y = y; } else { h1x = x; h1y = y; }
        n++;
      }
      if (n < 2) continue;
      const ex = h1x - h0x, ey = h1y - h0y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const rx = h0x, ry = h0y - cy;
      const tt = (rx * ey - ry * ex) / den;      // along the ray
      const uu = (rx * dy - ry * dx) / den;      // along the segment
      if (tt > best && uu >= 0 && uu <= 1) best = tt;
    }
    return best;
  };
  const surf = (z, ang) => {
    const r = radAt(z, ang);
    if (!(r > 0)) return AF.surf(z, ang);        // off the band: the table
    return [Math.sin(ang) * r, AF.cyAt(z) - Math.cos(ang) * r, z];
  };
  // the contract's own normal, over the exact surface. The steps are wider
  // than meshAirframe's (0.02 rad, 0.05 m) on purpose: the drawn skin is
  // FACETED, and a two-millimetre difference reads one quad's plane rather
  // than the shape the quad belongs to — which would tilt every bolt by the
  // subdivision's own noise.
  // OUTWARD IS AWAY FROM THE SECTION CENTRE, not "downward". The first rule
  // flipped any normal with a positive y, which is right at the keel and
  // wrong on a near-vertical flank: there the true outward normal carries a
  // few millimetres of +y and was turned INWARD, so the doubler's four bolts
  // pointed into the fuselage with their shanks 17 mm inside the skin
  // (GATE CLIP, 2026-09-12, on the stock strut foot at ang 0.8).
  const nrmAt = (z, ang) => {
    const p = surf(z, ang);
    const n = nrm3(crs3(sub3(surf(z, ang + 0.02), surf(z, ang - 0.02)),
                        sub3(surf(z + 0.05, ang), p)));
    const out = [p[0], p[1] - AF.cyAt(z), 0];
    return (n[0] * out[0] + n[1] * out[1]) < 0 ? [-n[0], -n[1], -n[2]] : n;
  };
  const halfWAt = z => Math.abs(surf(z, Math.PI / 2)[0]);
  const S = Object.assign({}, AF, { surf, nrmAt, halfWAt, exact: true });
  skinCache = { AF, a, b, S };
  return S;
}

// ---- 4. THE FITTING --------------------------------------------------------
// Browser half: needs GEAR_KIT's primitives and GEAR_GEN's fitFrame/fitPad.
// Returns null in node, which is why the gate above tests the site and the
// table and not this.
//
// WHAT IT DRAWS, from the skin outward:
//
//   the DOUBLER, `fitPad` — the same bolted plate every undercarriage leg
//   stands on, following the surface, carrying its own four bolts. A lift
//   strut is a primary member: its foot load is a tension spike into a
//   0.6 mm skin, and the plate is the thing that stops it being a tear.
//
//   the SCREWS — six more fasteners round the plate's edge. The bolts carry
//   the strut; the screws hold the doubler down, and the difference between
//   four heads and ten is the difference between a bracket and a fitting.
//
//   TWO CLEVISES, spaced fore and aft of the site. Both lift struts of a side
//   leave the same plate — that is the Cub geometry the frame already builds
//   (`B(strutRoot, WF[mid])` and `B(strutRoot, WR[mid])` share a root node) —
//   and each gets its own pair of ears and its own pin.
//
//   THE PIN AXIS IS FORE-AND-AFT. A lift strut works in the lateral/vertical
//   plane: it hinges about the body's own long axis and nothing else. An
//   athwartships pin would let it swing fore and aft, which is the one
//   direction a lift strut is not allowed to move.
//
//   THE WING FITTING, the same plate and clevis on the face the strut
//   comes from — under a high wing, over a low one.
//
//   THE STRUT, a streamline tube flattened into a blade for its last tenth so
//   it can enter the clevis. The section is 63_gen_skin's own GEN_STRUT_SECT,
//   REFERENCED and not copied (the wing-split refactor owns that table); with
//   no table in scope it degrades to a radiused blade of the same chord and
//   thickness, which is still a streamline member and never a round bar.
// WHICH WAY THE EAR REACHES, and it is exported because it is the whole of
// the bug this function had (G108, the user: "there is a small gap between the
// end of the struts and the metal plate they attach to, on both ends. There
// shouldn't be, especially since the modeling is pretty detailed").
//
// `lug`'s tang does NOT follow the vector its signature calls `up`. `up` only
// fixes the section's plane; the tang extends along the BINORMAL, axis x up.
// Handing it the surface normal therefore threw both ears sideways at pin
// height: measured in the fitting's own frame they spanned 39..71 mm off the
// skin, against a doubler whose top face is at 7. Thirty-two millimetres of
// daylight, at all four ends, and `stand * 0.92` — the number that was
// supposed to plant the ear 4.4 mm off the skin, inside the plate — was being
// spent in a direction where it bought nothing.
//
// With this, the same ear spans 4.4..70.6 mm and its root is buried in the
// doubler. `lug` IS NOT TOUCHED: it is _gear_kit's, the entire undercarriage
// is drawn with it, and that geometry is proven and accepted by the user. A
// caller was handing it the wrong vector, and the caller is what changes.
//
// EXPORTED so GATE STRUT asserts the GENERATOR'S OWN ANSWER. A gate that
// re-derived `crs(n, fore)` would be checking its own copy of the rule and
// would stay green if this line were reverted.
function strutClevisUp(K, n, fore) { return K.crs(n, fore); }

function strutBuild(bags, AF, site, ends, opt) {
  const W = typeof window !== 'undefined' ? window : null;
  const K = W && W.GEAR_KIT, GG = W && W.GEAR_GEN;
  if (!K || !GG || !bags || !ends || !ends.length) return null;
  // `opt.fit` overrides dimensions; `opt` itself carries the callbacks. They
  // are kept apart on purpose — merging the whole option bag into the declared
  // table puts a FUNCTION in it, and the table is the thing the gate reads.
  const FIT = Object.assign({}, STRUT_FIT, (opt && opt.fit) || {});
  const ray = (opt && opt.wingRay) || null;

  // EVERYTHING BELOW SITS ON THE MESH, not on the table. The patch is the
  // plate plus both clevises plus a station either side for the normals.
  const reach = FIT.padL * 0.5 + FIT.lugGap + 0.10;
  const S = strutSkin(AF, site.z - reach, site.z + reach) || AF;

  // NO SKIN, NO PLATE (2026-09-05, the user: the fittings "look for a plate to
  // attach to ... I thought I had asked already for no-plate-options, so it
  // can attach straight to a tube structure"). `opt.mount` is a frame ON A
  // TRUSS MEMBER, handed in by the caller when the contract says there is no
  // covering at this site — a naked frame, or a flank whose door has been
  // taken off. It is the SAME arrangement the undercarriage grew for the same
  // reason (GEAR_GEN's `pivotOn`, G180): a lug pair astride the tube with a
  // bolt through it, and nothing spreading a load into a skin that is not
  // there. The two feet then sit fore and aft along the MEMBER instead of
  // along the body, which is what a strut fitting on a longeron does.
  //
  // WHY IT MATTERS BEYOND THE LOOK: a doubler is drawn by sweeping the
  // airframe's own surface across the plate's footprint, and over an opening
  // that surface is inferred. Bolting the plate to it draws a large, thin,
  // twisted sheet standing where the skin would be — which on the reported
  // build was a sheet through the middle of the cockpit.
  const MT = (opt && opt.mount) || null;
  const F = MT || GG.fitFrame(S, site.z, site.ang);
  // where a foot sits: along the member for a pivot, round the body otherwise
  const footAt = d => MT
    ? { p: K.off(MT.p, MT.fore, d), n: MT.n, fore: MT.fore }
    : { p: S.surf(site.z + d, site.ang), n: S.nrmAt(site.z + d, site.ang),
        fore: F.fore };

  if (MT) {
    GG.pivotOn(bags, MT);
  } else {
    // the doubler and its four bolts
    GG.fitPad(bags, S, site.z, site.ang, FIT.padL, FIT.padW,
              { thick: FIT.padT });
    // ...and the screws, on the plate's own curve. The angular half-width is
    // the same conversion fitPad uses, so a screw lands on the plate and not
    // beside it however fat or thin the section under it is.
    const aw = (GG.padArc ? GG.padArc(S, site.z, FIT.padW)
                          : FIT.padW / Math.max(0.05, S.halfWAt(site.z))) * 0.36;
    for (const [dz, da] of [[0, -aw], [0, aw],
                            [-FIT.padL * 0.46, 0], [FIT.padL * 0.46, 0],
                            [-FIT.padL * 0.24, -aw], [FIT.padL * 0.24, aw]]) {
      const zz = site.z + dz, aa = site.ang + da;
      K.bolt(bags.alloy, K.off(S.surf(zz, aa), S.nrmAt(zz, aa), FIT.padT),
             S.nrmAt(zz, aa), FIT.screwR, FIT.screwL);
    }
  }

  const cw = FIT.chordK * FIT.strutR;
  const SECT = (typeof GEN_STRUT_SECT !== 'undefined') ? GEN_STRUT_SECT : null;
  const mix = (a, b, t) => a + (b - a) * t;
  // the member's own section: streamline over its length, flattened into a
  // blade at BOTH ends so it can enter a clevis at each.
  const sect = t => {
    const e = FIT.endFrac;
    const k = Math.min(1, Math.min(t, 1 - t) / e);
    const us = mix(FIT.bladeC, cw, k);
    const vs = mix(FIT.bladeT / (2 * 0.118), cw, k);
    return SECT ? SECT.map(c => [(c[0] - 0.40) * us, c[1] * vs])
                : K.secBlade(us, vs * 0.236, 4);
  };

  // A CLEVIS, wherever a strut end lands: two ears across a pin, the pin
  // FORE-AND-AFT. A lift strut works in the lateral/vertical plane — it hinges
  // about the body's own long axis and nothing else — so an athwartships pin
  // would let it swing in the one direction a lift strut may not.
  const half = FIT.bladeT * 0.5 + FIT.lugT * 0.5 + 0.0015;
  // THE EAR REACHES THE PLATE, AND FOR A YEAR IT DID NOT (G108, the user:
  // "there is a small gap between the end of the struts and the metal plate
  // they attach to, on both ends. There shouldn't be, especially since the
  // modeling is pretty detailed").
  //
  // `stand * 0.92` was always the right number — it puts the ear's root
  // 4.4 mm off the skin, inside a 7 mm doubler. It was being spent in the
  // WRONG DIRECTION. `lug`'s tang does not follow the vector named `up`: `up`
  // only fixes the section's plane, and the tang extends along the BINORMAL,
  // `axis x up`. Passing the surface normal therefore threw the ear sideways
  // at pin height, and the measured span off the skin was 39..71 mm against a
  // plate whose top is at 7 — twenty-six millimetres of daylight, which is
  // exactly what the user circled.
  //
  // MEASURED, NOT REASONED ABOUT (tools/_strut_probe.js): with `crs(n, fore)`
  // the same ear spans 4.4..70.6 mm and lands in the plate. `lug` IS NOT
  // TOUCHED: it is _gear_kit's, the whole undercarriage is drawn with it, and
  // that geometry is proven and accepted. This is a caller passing the wrong
  // vector, and the caller is the thing that changes.
  const clevis = (p, n, fore, stand) => {
    const ctr = K.off(p, n, stand);
    for (const e of [-1, 1])
      K.lug(bags.alloy, K.off(ctr, fore, e * half), fore,
            strutClevisUp(K, n, fore), FIT.lugR, FIT.lugT, stand * 0.92);
    K.bolt(bags.steel, K.off(ctr, fore, -(half + FIT.lugT * 0.5 + 0.004)),
           fore, FIT.pinR, FIT.pinShank);
    return ctr;
  };

  // the two struts. `ends` arrives FRONT FIRST (the caller sorts by cage z),
  // so the front strut takes the forward pin and the pair reads as the V it is
  // rather than as a crossed pair.
  const out = [];
  for (let i = 0; i < Math.min(2, ends.length); i++) {
    const sgn = i === 0 ? 1 : -1;
    const ft = footAt(sgn * FIT.lugGap);
    const foot = clevis(ft.p, ft.n, ft.fore, FIT.standoff);

    // THE WING END IS A FITTING TOO (user: "the struts are also well anchored
    // on the wings ... it also needs to be fixed through attachment with
    // geometry"). The beam's own endpoint is a SPAR NODE — it lives on the
    // wing's MEAN LINE, inside the aerofoil — so the plate goes where the
    // drawn surface actually is and the strut stops at a pin rather than
    // disappearing into the covering.
    //
    // WHICH SURFACE IS NOT A CONSTANT, AND THE RAY IS STILL NOT THE STRUT.
    // Two things have to be right here and they pull in opposite directions:
    //
    //   a high wing is braced from BELOW and a low wing from ABOVE, so the
    //   plate belongs on the face the strut arrives on — which the FOOT says,
    //   by being under the node or over it;
    //
    //   and the plate belongs DIRECTLY under (or over) the spar it bolts to,
    //   not wherever a slanted strut happens to leave the covering. Aiming
    //   the ray along the strut looks right and is not: at a strut's 28-ish
    //   degrees, an aerofoil half-thickness of 90 mm walks the exit point
    //   150 mm inboard of the spar. Measured, that is exactly what it did.
    //
    // So the ray is cast ACROSS the wing, from clear of the arriving face, and
    // the face it hits first is the one the strut arrives on. The fitting then
    // sits on the spar, and the reported divergence goes back to millimetres.
    const node = ends[i].top;
    let tip = node, wp = null;
    if (ray) {
      const up = foot[1] < node[1] ? -1 : 1;
      wp = ray([node[0], node[1] + up * 0.6, node[2]], [0, -up, 0]);
      if (wp) {
        // the plate's chordwise axis, lying on the wing's own surface
        const fw = nrm3(projOut([0, 0, 1], wp.n));
        // and its grid, dropped onto that surface from clear of it
        const back = [-wp.n[0], -wp.n[1], -wp.n[2]];
        const proj = q => ray(K.off(q, wp.n, 0.15), back);
        padOn(bags, K, wp.p, wp.n, fw, FIT.wingPadL, FIT.wingPadW,
              FIT.wingPadT, proj, FIT);
        tip = clevis(wp.p, wp.n, fw, FIT.wingStandoff);
      }
    }
    // upHint [0,0,1] pins the section's chord FORE-AND-AFT — the whole point
    // of a streamline strut, and the thing a transported frame loses if you
    // let it pick its own start.
    K.sweep(bags.strut, K.resample([foot, tip], 16), sect, true, [0, 0, 1]);
    // HOW FAR THE DRAWN END IS FROM THE BEAM IT STANDS FOR, IN PLAN. The
    // caller reports and gates on this: the visuals are constrained to the
    // physics, never the other way round.
    // IN PLAN, and only in plan, because the vertical difference is not
    // divergence — it is the AEROFOIL. A spar node is on the mean line and
    // the fitting is on the lower skin, so they are always a half-thickness
    // apart by construction, and counting that as error would report a
    // healthy 12 % wing as 90 mm out of place.
    const bm = ends[i].beam || node;
    out.push({ pin: foot, tip, node, len: d3(foot, tip),
               off: Math.hypot(tip[0] - bm[0], tip[2] - bm[2]) });
  }
  return { F, site, exact: !!S.exact, wing: !!ray, pivot: !!MT, struts: out };
}

// project v into the plane whose normal is n
function projOut(v, n) {
  const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
  return [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d];
}

// A DOUBLER ON A SURFACE THAT IS NOT THE AIRFRAME. fitPad is written against
// the airframe contract — a radius about a keel — and a wing is not that
// shape, so the wing's plate is the same object built over an arbitrary
// surface: the identical grid, the identical rounded corners, the identical
// four bolts, with each grid point PROJECTED onto the drawn wing instead of
// asked for by station and angle. Same rule, different question.
function padOn(bags, K, ctr, n0, fore, L, W, t, proj, FIT) {
  const bag = bags.alloy;
  const side = nrm3(crs3(n0, fore));
  const NL = 6, NW = 4;
  const at = (i, k) => {
    const q = K.off(K.off(ctr, fore, L * (i / NL - 0.5)), side, W * (k / NW - 0.5));
    const h = proj(q);
    return h || { p: q, n: n0 };
  };
  const rows = [], out = [];
  for (let i = 0; i <= NL; i++) {
    const ri = [], ro = [];
    for (let k = 0; k <= NW; k++) {
      const h = at(i, k);
      const fi = Math.min(1, 2.6 * Math.min(i / NL, 1 - i / NL) + 0.35);
      const fk = Math.min(1, 2.6 * Math.min(k / NW, 1 - k / NW) + 0.35);
      ri.push(bag.v(K.off(h.p, h.n, 0.0008)));
      ro.push(bag.v(K.off(h.p, h.n, t * Math.min(fi, fk))));
    }
    rows.push(ri); out.push(ro);
  }
  for (let i = 0; i < NL; i++) for (let k = 0; k < NW; k++) {
    bag.quad(rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]);
    bag.quad(out[i][k], out[i + 1][k], out[i + 1][k + 1], out[i][k + 1]);
  }
  for (let i = 0; i < NL; i++) {
    bag.quad(rows[i][0], rows[i + 1][0], out[i + 1][0], out[i][0]);
    bag.quad(rows[i][NW], out[i][NW], out[i + 1][NW], rows[i + 1][NW]);
  }
  for (let k = 0; k < NW; k++) {
    bag.quad(rows[0][k], out[0][k], out[0][k + 1], rows[0][k + 1]);
    bag.quad(rows[NL][k], rows[NL][k + 1], out[NL][k + 1], out[NL][k]);
  }
  for (const [i, k] of [[1, 1], [1, NW - 1], [NL - 1, 1], [NL - 1, NW - 1]]) {
    const h = at(i, k);
    K.bolt(bag, K.off(h.p, h.n, t), h.n, FIT.screwR * 1.5, FIT.screwL);
  }
}

const API = { STRUT_FIT, STRUT_BAND, strutBand,
              strutSnap, strutSite, strutSkin, strutBuild, strutClevisUp,
              padOn };   // G185: the wing plate, for the brace layer's wing-to-wing members
if (typeof window !== 'undefined') window.STRUT_GEN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
