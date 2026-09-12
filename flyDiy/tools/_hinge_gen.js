// HINGE GEN (G238) — THE SHAPES A CONTROL SURFACE HANGS AND MOVES ON.
//
// The third file of the hinge arc: `GEN_HINGE_KIT` (60_gen_spec.js) says what
// each surface needs, `_cage_hinge.js` says where it goes on this aeroplane,
// and this draws it. The split is the fittings arc's, deliberately — table,
// placer, shapes — because that is the arrangement that made GEN_ACCESS
// testable without a browser.
//
// EVERYTHING IS A SWEEP OR A REVOLVE, over GEAR_KIT, for the reason that
// file's own header gives: a BoxGeometry with a rotation is exactly what made
// the undercarriage unsatisfying to look at, and hinge hardware is smaller
// and closer to the eye than a wheel.
//
// ---------------------------------------------------------------------------
// THE FRAME. Every form takes F = { p, x, y, z }:
//
//   p   a point ON THE HINGE AXIS
//   z   along the hinge axis (spanwise on a wing, up on a rudder)
//   x   AFT — towards the surface's trailing edge
//   y   OUT through the face the hardware shows on (down under a wing,
//       sideways on a rudder)
//
// and S, the sizes, in metres: r (the surface's nose radius — half the
// section thickness at the hinge, which is the cylinder everything has to
// clear), gap, w, t, reach, pinR...
//
// ---------------------------------------------------------------------------
// TWO BAGS, AND WHICH ONE A TRIANGLE GOES IN IS THE WHOLE ANIMATION.
//
// `bF` is what stays with the airframe and `bM` is what turns with the
// surface. The layer hands the second bag's mesh to the surface's own drawn
// object, whose vertices the game already rotates about the hinge — so a
// strap's moving tail, a horn and a Fowler carriage are animated by
// construction, with no new code in the flown model. The only thing that is
// neither is the PUSHROD, which spans the two: that is a two-end member and
// the join publishes it as one (G179.2's contract, extended).
//
// ---------------------------------------------------------------------------
// WHAT A STRAP HINGE ACTUALLY IS, since the first cut of this file got it
// wrong. The eye sits on the hinge axis, which is at MID-THICKNESS, inside
// the aeroplane; the two tails come out through the gap and lie on the
// OUTSIDE of the two skins, riveted down. The fixed tail runs forward onto
// the fixed skin, the moving tail runs aft onto the surface's, and the two
// straps are OFFSET ALONG THE HINGE LINE so they pass each other in the gap
// rather than through each other — which is what the alternating knuckles of
// a piano hinge are doing too, and why both families are the same drawing
// with a different pitch.
'use strict';
(() => {
// GEAR_KIT is a browser module (it hangs itself off `window` and exports
// nothing), so node reaches it the way every gate in this family does: shim
// `global.window`, require _gear_kit.js, then this.
const K = typeof window !== 'undefined' ? window.GEAR_KIT : null;
if (!K) { console.error('_hinge_gen: _gear_kit.js first'); return; }

const { sub, add, mul, nrm, dot, crs, off, sweep, tube, taper, revolve,
        boxIn, lug, bolt, fillet, secBlade, secRound, Bag } = K;

// a point in the frame: p + x*a + y*b + z*c
const at = (F, a, b, c) =>
  [F.p[0] + F.x[0] * a + F.y[0] * b + F.z[0] * c,
   F.p[1] + F.x[1] * a + F.y[1] * b + F.z[1] * c,
   F.p[2] + F.x[2] * a + F.y[2] * b + F.z[2] * c];

// the frame with its face flipped — a rudder wears its hardware both sides
const flipF = F => ({ p: F.p, x: F.x, y: mul(F.y, -1), z: mul(F.z, -1) });

// ---------------------------------------------------------------------------
// THE STRAP HINGE — one tail, one eye, one half of the pin
// ---------------------------------------------------------------------------
// `dir` is +1 for the half that runs AFT (the surface's) and -1 for the one
// that runs forward (the airframe's). The tail leaves the eye, comes out
// through the gap and flattens onto the skin at radius r + its own gauge;
// aft of the hinge the section is thinning, so the far end sits a little
// closer in — 0.86 r, measured off the aerofoils this generator draws and
// close enough that a 75 mm tail lies down on all of them.
// THE TAIL LIES ON THE SKIN AS DRAWN, NOT ON A CYLINDER (G304, the fitment
// study P2). `lie` assumed the skin sits at the nose radius `r` all the way
// out to the tail's end, and the section is not a cylinder: forward of the
// hinge the wing THICKENS, so at 130 mm the fixed tail sat 8-11 mm INSIDE
// the wing (GATE CLIP), and 3-6 mm inside the fin and stab, whose rounded
// rims are not centred on the hinge either. `S.skin(a, zOff, dir)` is the
// layer's measurement of the skin's own height along F.y at chordwise `a`
// (a ray through the drawn surface); with it, each point of the tail sits
// at the measured skin plus the gauge. Without it (the headless gate, a
// page without the meshes), the cylinder stands in as before.
function strapHalf(bag, F, S, dir, zOff) {
  const r = S.r, t = S.t, w = S.w, reach = S.reach;
  const lie = r + t * 0.5 + 0.0008;             // the skin, plus the gauge
  const far0 = dir > 0 ? lie * 0.86 : lie;      // aft thins, forward does not
  // ...and the strap is FLAT ACROSS its width, so on a skin that curves
  // along the hinge (a fin's rounded rim, a tapering stab) it sits at the
  // highest of its two edges; and it follows the skin ALONG the tail with
  // intermediate samples, or the straight run between two points on a
  // convex aerofoil lies inside it by the sagitta (measured: 2-3 mm)
  const hAt = (a, fb) => {
    if (!S.skin) return fb;
    let h = null;
    for (const dz of [-w * 0.5, -w * 0.25, 0, w * 0.25, w * 0.5]) {
      const q = S.skin(a, zOff + dz, dir);
      if (q != null && (h == null || q > h)) h = q;
    }
    return h == null ? fb : h + t * 0.5 + 0.0008;
  };
  const aFar = dir * (r * 0.90 + reach), aLie = dir * (r * 0.62);
  const far = hAt(aFar, far0), lie2 = hAt(aLie, lie);
  // dense along the tail: the wing's cove LIP is a ridge between the wall
  // and the skin, and a chord from either side of it passes inside it
  // (measured 9 mm with three samples; ~12 mm apart it stays on the skin)
  const pts = [at(F, aFar, far, zOff)];
  if (S.skin) {
    const nS = Math.max(3, Math.round(Math.abs(aFar - aLie) / 0.012));
    for (let i = nS - 1; i >= 1; i--) {
      const f = i / nS, a = aLie + (aFar - aLie) * f;
      pts.push(at(F, a, hAt(a, lie2 + (far - lie2) * f), zOff));
    }
  }
  pts.push(at(F, aLie, lie2, zOff));
  // THE KNEE GOES ROUND THE FIXED SIDE'S END, NOT THROUGH IT (G304). The
  // old knee at (0.2 r, 0.52 r) assumed a cove open all the way to the
  // axis; a FIN has no cove — its trailing edge is a square end a gap ahead
  // of the hinge (the strap sat 2.9 mm inside it) — and a WING's cove is
  // shrouded below by a lip that runs aft under the nose to a knife edge
  // (the strap went 9 mm through the lip). Two probes tell them apart:
  // `S.edge` (a ray from the axis along the chord at 0.45 r) meets a slot
  // wall within half a radius and a cove wall only near the nose radius;
  // and the skin scan from `aLie` toward the axis finds where the lip's
  // outer skin STOPS. The tail then either comes down the wall — a point at
  // its top and one at its foot — or runs to the lip's edge, and turns in
  // to the eye from there. Those corners are SHARP: filleting a short arm
  // cuts the corner by half its inset, which on a slot wall is 2.5 mm into
  // the fin; the outer tail keeps its fillets.
  const dEdge = S.edge ? S.edge(zOff, dir) : null;
  const wallEnd = dEdge != null && dEdge > t * 2 && dEdge < r * 0.5;
  let inner = null;
  if (wallEnd) {
    // on the GAP side of the wall: the slot is between the wall and the axis
    const aW = dir * (dEdge - t * 0.6);
    pts.push(at(F, aW, Math.max(hAt(aW, lie2), r * 0.45 + t), zOff));
    inner = [at(F, aW, r * 0.45, zOff)];
  } else if (S.skin) {
    // the lip's edge: the last chordwise station, walking in from aLie,
    // where the skin below still answers
    let aE = aLie, hE = lie2, found = false;
    for (let a = Math.abs(aLie) - 0.003; a > t; a -= 0.003) {
      const h = hAt(dir * a, null);
      if (h == null) { found = true; break; }
      aE = dir * a; hE = h;
    }
    if (found && Math.abs(aE) < Math.abs(aLie)) pts.push(at(F, aE, hE, zOff));
    else pts.push(at(F, dir * (r * 0.20), r * 0.52, zOff));
  } else {
    pts.push(at(F, dir * (r * 0.20), r * 0.52, zOff));
  }
  const eye = at(F, 0, 0, zOff);
  if (S.trace) S.trace({ dir, zOff, pts, dEdge, wallEnd, lie2, far });
  const path = fillet(pts, Math.max(0.004, r * 0.35), 4).concat(inner || [], [eye]);
  sweep(bag, path, () => secBlade(w, t), true, F.z);
  // the eye: a turned boss round the pin, and the pin's own head. THE EYE
  // FITS THE SLOT (G304): on a fin the slot wall is `dEdge` ahead of the
  // axis and a boss of 0.42 w punched through it (5.7 mm on the twin's
  // 45 mm fin); the boss is no wider than the gap allows, and never under
  // the pin's own collar.
  const rEye = wallEnd ? Math.max(S.pinR * 1.3, Math.min(w * 0.42, dEdge - t * 0.6)) : w * 0.42;
  revolve(bag, at(F, 0, 0, zOff - w * 0.5), F.z,
    [[S.pinR * 1.05, 0], [rEye, 0], [rEye, w], [S.pinR * 1.05, w]], 14, false);
  // two rivets down the tail, which is what says "riveted on" at 2 m. A DOME,
  // not GEAR_KIT's `bolt`: a hex head and a shank on a 4 mm rivet is 200
  // triangles nobody can resolve, and a hinge carries six of them.
  for (const f of [0.62, 0.92]) {
    const rr = Math.max(0.0022, w * 0.09);
    const aR = dir * (r * 0.90 + reach) * f;
    revolve(bag, at(F, aR, hAt(aR, far) + t * 0.45, zOff),
      F.y, [[rr, 0], [rr * 0.86, rr * 0.5], [rr * 0.45, rr * 0.78], [0, rr * 0.86]],
      8, false);
  }
}

// the pin itself: it belongs to the airframe half (you drive it out to take
// the surface off), and it is the one part that spans both straps
function strapPin(bag, F, S, zOff, span) {
  const a = at(F, 0, 0, zOff - span * 0.5), b = at(F, 0, 0, zOff + span * 0.5);
  tube(bag, a, b, S.pinR, 10);
  revolve(bag, b, F.z, [[S.pinR * 1.6, 0], [S.pinR * 1.6, S.pinR * 0.9]], 8, true);
}

// ONE STATION OF A STRAP HINGE: the airframe's half, the surface's half beside
// it, and the pin through both. The two are offset along the hinge line by
// just over their own width, which is the clearance that lets them pass.
function strapHinge(bF, bM, F, S) {
  const w = S.w, d = w * 0.55 + 0.0015;
  strapHalf(bF, F, S, -1, -d);
  strapHalf(bM, F, S, +1, +d);
  strapPin(bF, F, S, 0, w * 2.4);
}

// ---------------------------------------------------------------------------
// THE PIANO HINGE — the metal wing's answer: a continuous run of knuckles,
// every other one on the surface, one pin down the whole length. Drawn as a
// run of `n` knuckle pairs over `len` about F.p; the pin is one tube.
// ---------------------------------------------------------------------------
function pianoHinge(bF, bM, F, S, len) {
  // pitch: a real piano hinge's knuckles are ~25 mm, which over a 4 m flap
  // would be 160 of them and 40 000 triangles for a part 3 mm proud. The
  // knuckle is drawn at the strap's own width instead — the same READ at any
  // distance a player looks from, at a tenth of the cost — and `detail`
  // scales it for anyone who wants the real pitch.
  const kn = Math.max(2, Math.round(len / Math.max(0.02, S.w * 2.6 / Math.max(0.35, S.detail || 1))));
  const pitch = len / kn;
  const r = S.r, t = S.t * 1.6;
  const lie = r + t * 0.5 + 0.0008;
  for (let i = 0; i < kn; i++) {
    const zc = -len * 0.5 + pitch * (i + 0.5);
    const fixed = (i % 2) === 0;
    const bag = fixed ? bF : bM, dir = fixed ? -1 : 1;
    // the knuckle: a short barrel on the pin
    revolve(bag, at(F, 0, 0, zc - pitch * 0.40), F.z,
      [[S.pinR * 1.02, 0], [S.pinR * 2.1, 0], [S.pinR * 2.1, pitch * 0.80],
       [S.pinR * 1.02, pitch * 0.80]], 8, false);
    // and its leaf, flat on the skin — the MEASURED skin where the layer
    // offers it (G304; see strapHalf)
    const hAt = (a, fb) => {
      if (!S.skin) return fb;
      let h = null;
      for (const dz of [-pitch * 0.4, 0, pitch * 0.4]) {
        const q = S.skin(a, zc + dz, dir);
        if (q != null && (h == null || q > h)) h = q;
      }
      return h == null ? fb : h + t * 0.5 + 0.0008;
    };
    const a1 = dir * (r * 0.5), a2 = dir * (r * 0.9 + S.reach * 0.7);
    const h1 = hAt(a1, lie), h2 = hAt(a2, lie * (dir > 0 ? 0.88 : 1));
    const path = [at(F, 0, S.pinR * 1.2, zc), at(F, a1, h1, zc)];
    if (S.skin) for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const a = a1 + (a2 - a1) * f;
      path.push(at(F, a, hAt(a, h1 + (h2 - h1) * f), zc));
    }
    path.push(at(F, a2, h2, zc));
    sweep(bag, fillet(path, r * 0.3, 2), () => secBlade(pitch * 0.86, t, 2), true, F.z);
  }
  tube(bF, at(F, 0, 0, -len * 0.52), at(F, 0, 0, len * 0.52), S.pinR, 10);
}

// ---------------------------------------------------------------------------
// THE CONTROL HORN — the lever the pushrod or the cable pulls on. One lug:
// the eye out in the air, the tang running back to the surface's skin, the
// plate standing in the section's own plane. Turns with the surface, always.
// ---------------------------------------------------------------------------
// `reach` is the eye's distance from the hinge AXIS, which is the moment arm
// and the thing a builder would move; `back` slides the eye aft along the
// chord, which is how a horn clears the fixed structure at full travel.
function controlHorn(bM, F, S) {
  const reach = S.hornReach, back = S.hornBack || 0;
  const eye = at(F, back, reach, 0);
  const R = Math.max(0.008, S.pinR * 2.2);
  // lug's tang follows cross(up, axis) — G108's lesson, stated in _gear_kit.
  // cross(x, z) = -y, so `up` = F.x sends the tang back towards the skin.
  lug(bM, eye, F.z, F.x, R, S.hornT, Math.max(0.02, reach - S.r * 0.55));
  // the root pad it bolts through
  const root = at(F, back, S.r * 0.72, 0);
  revolve(bM, root, F.y, [[R * 1.5, 0], [R * 1.5, S.hornT * 1.4]], 10, true);
  return eye;
}

// ---------------------------------------------------------------------------
// THE LINK — a pushrod or a cable between two points. Both are drawn here
// because the difference is only the diameter and the ends: a rod gets rod
// ends, a cable gets a swaged nipple and no slack (a slack cable is a cable
// that is about to be tightened).
// ---------------------------------------------------------------------------
function linkRod(bag, A, B, S, kind) {
  const r = kind === 'cable' ? S.cableR : S.linkR;
  const d = sub(B, A), L = Math.hypot(d[0], d[1], d[2]);
  if (!(L > 1e-4)) return;
  const u = nrm(d);
  tube(bag, A, B, r, kind === 'cable' ? 6 : 10);
  if (kind === 'cable') {
    for (const [P, s] of [[A, 1], [B, -1]])
      revolve(bag, P, mul(u, s), [[r * 2.0, 0], [r * 2.0, r * 4],
                                  [r * 1.1, r * 5.2]], 8, true);
    return;
  }
  // a rod end at each end: the turned shank, then the bored eye
  for (const [P, s] of [[A, 1], [B, -1]]) {
    const q = off(P, u, s * r * 2.2);
    revolve(bag, q, mul(u, -s), [[r * 1.5, 0], [r * 1.5, r * 1.6]], 10, true);
    // the eye is drawn as a small torus-ish boss, its bore across the rod
    const axe = nrm(crs(u, Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    revolve(bag, off(P, axe, -r * 0.8), axe,
      [[r * 0.75, 0], [r * 1.7, 0], [r * 1.7, r * 1.6], [r * 0.75, r * 1.6]],
      12, false);
  }
}

// ---------------------------------------------------------------------------
// THE BELLCRANK — inside the wing, under the cover the fittings table has
// been putting over it since G83 ("the aileron bellcrank and its cable
// ends"). Two arms on a pivot bolt: one takes the cable from the cabin, the
// other pushes the rod up to the horn.
// ---------------------------------------------------------------------------
function bellcrank(bag, F, S, armA, armB) {
  const R = Math.max(0.009, S.pinR * 2.4), t = S.hornT * 1.3;
  for (const a of [armA, armB]) {
    const d = nrm(a);
    const eye = off(F.p, d, Math.hypot(a[0], a[1], a[2]));
    lug(bag, eye, F.z, crs(F.z, d), R, t, Math.hypot(a[0], a[1], a[2]) * 0.9);
  }
  revolve(bag, off(F.p, F.z, -t * 1.8), F.z,
    [[R * 0.5, 0], [R * 1.25, 0], [R * 1.25, t * 3.6], [R * 0.5, t * 3.6]], 12, false);
  bolt(bag, off(F.p, F.z, t * 2.0), F.z, R * 0.55, t * 2.2);
}

// ---------------------------------------------------------------------------
// THE FAIRING — the optional aerodynamic cover over the hinge line. It is a
// strip on the FIXED side that laps over the gap, which is what a real gap
// seal does; it moves with nothing, and switching it off is a legitimate
// build (a fabric aeroplane rarely has one).
// ---------------------------------------------------------------------------
function hingeFair(bag, F, S, len) {
  const r = S.r, t = S.fairT, lie = r + t + 0.0016;
  const sec = () => {
    // a shallow lipped strip: flat on the skin, rolled at both edges
    const w = S.fairW || (r * 1.5);
    const out = [];
    const N = 7;
    for (let i = 0; i <= N; i++) {
      const u = -0.5 + i / N;
      out.push([u * w, Math.cos(u * Math.PI) * t * 1.6]);
    }
    for (let i = N; i >= 0; i--) {
      const u = -0.5 + i / N;
      out.push([u * w, Math.cos(u * Math.PI) * t * 1.6 - t]);
    }
    return out;
  };
  const a = at(F, 0, lie, -len * 0.5), b = at(F, 0, lie, len * 0.5);
  // the strip runs along the hinge; its own width lies along the chord
  const path = [a, b];
  sweep(bag, path, () => sec().map(([u, v]) => [v, u]), true, F.y);
}

// ---------------------------------------------------------------------------
// THE FOWLER'S TRACK AND CARRIAGE (G239) — the one flap type whose mechanism
// is outside the wing, and the reason a Fowler used to be invisible.
// ---------------------------------------------------------------------------
// The track is a curved beam under the wing, running aft and down along the
// path the flap takes; the carriage is a block on the flap that rides it.
// The track stays with the wing, the carriage turns and slides with the flap,
// so the two draw themselves apart exactly as the flap runs out.
function fowlerTrack(bF, F, S, travel, drop) {
  const t = S.hornT * 2.2, w = S.w * 0.8;
  const path = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    path.push(at(F, -S.r * 0.6 + (travel + S.r * 1.2) * u,
                 S.r + 0.010 + drop * u * u, 0));
  }
  sweep(bF, path, () => secBlade(w, t), true, F.z);
  // the two ribs that carry it
  for (const u of [0.06, 0.42])
    sweep(bF, [at(F, -S.r * 0.6 + travel * u, S.r + 0.010 + drop * u * u, 0),
               at(F, -S.r * 0.6 + travel * u, S.r * 0.2, 0)],
          () => secBlade(w * 0.8, t), true, F.z);
}

function fowlerCarriage(bM, F, S) {
  const t = S.hornT * 2.0, w = S.w * 0.9;
  boxIn(bM, at(F, S.r * 0.2, S.r + 0.010, 0), [S.r * 0.55, 0.012, w * 0.5],
        F.x, F.y, F.z);
  for (const s of [-1, 1])                       // the rollers
    revolve(bM, at(F, S.r * 0.2 + s * S.r * 0.34, S.r + 0.010, -w * 0.6), F.z,
      [[0, 0], [0.009, 0], [0.009, w * 1.2], [0, w * 1.2]], 10, false);
}

const API = { at, flipF, strapHinge, strapHalf, strapPin, pianoHinge,
              controlHorn, linkRod, bellcrank, hingeFair,
              fowlerTrack, fowlerCarriage,
              HINGE_BAGS: ['metal', 'fair'] };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.HINGE_GEN = API;
})();
