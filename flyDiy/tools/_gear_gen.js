// GEAR GENERATOR — the undercarriage bench (G20). Throwaway prototype
// family (gitignored with _cage*/_gear*), never in MANIFEST.
//
// THE MODEL (user brief 2026-08-19). Four INDEPENDENT layers, so the
// space stays small and nothing is hard-coded to a configuration:
//
//   1 STATION   where a leg stands: z along the body, x half-track
//               (x = 0 is a single centreline wheel, x > 0 a mirrored
//               pair). Any number, anywhere — 'taildragger' and
//               'tricycle' are PRESETS over this, never types. Four
//               wheels on a light aeroplane is a legal thing to build.
//   2 LEG       how the wheel MOVES. Three kinematic families:
//                 beam  a bending blade — the leg IS the spring
//                 link  a swinging arm on a pivot + a separate shock
//                 oleo  a telescopic strut, piston + torque scissor
//   3 STEERING  ORTHOGONAL to the leg (the tailwheel forced this
//               correction): fixed | linked | castor | breakout.
//               A tailwheel and a trike nosewheel are THE SAME steering
//               module over different legs.
//   4 CONTACT   the wheel: tyre, hub, brake, optional fairing.
//
// FITMENTS ARE GENERATED. No leg is drawn "near" the aeroplane: each one
// asks the airframe contract for the SURFACE POINT AND NORMAL at its
// station and builds its bracket ON that surface, oriented to it — the
// pitot rule from G5, applied to every bolt.
//
// THE AIRFRAME CONTRACT lets the same module run on this bench's stub
// body and later on the real cage:
//   AF = { surf(z, ang), keelAt(z), halfWAt(z), heightAt(z), z0, z1 }
// `ang` is measured from the keel (0 = bottom centreline, +/- pi/2 = the
// flanks), so a fitting can be placed anywhere round the belly.
'use strict';
(() => {
const K = window.GEAR_KIT;
const { clamp, sub, add, mul, len, nrm, dot, crs, off, lerp3, rot,
        Bag, fillet, resample, bez, secRound, secBlade, sweep, tube,
        taper, revolve, boxIn, lug, bolt } = K;
const D2R = Math.PI / 180;

// ---- materials ------------------------------------------------------------
const lam = (c, o) => new THREE.MeshLambertMaterial(
  Object.assign({ color: c }, o || {}));
const MAT = {
  body:    lam(0x8a95a2, { transparent: true, opacity: 0.20,
                           side: THREE.DoubleSide, depthWrite: false }),
  tyre:    lam(0x23262b),
  hub:     lam(0xb9c2cc),
  brake:   lam(0x6e757e),
  brakefix: lam(0x6e757e),     // the caliper: brake-coloured, does not turn
  steel:   lam(0x98a2ad),      // legs, blades, leaf springs
  alloy:   lam(0xc6ccd3),      // machined fittings, oleo cylinder
  chrome:  lam(0xdde3ea),      // the polished piston
  dark:    lam(0x3a4048),      // rubber, boots, bungee
  bronze:  lam(0xa8843c),      // bushes, castor pivot
  fair:    lam(0xcfd6de),      // spats
  mark:    new THREE.MeshBasicMaterial({ color: 0xff4d3d }),
};

// AEROSKIN (G70). The undercarriage was the most visible thing still wearing
// G38's understudy grey — it is at eye height, it is what you walk past, and
// a tyre that is not rubber is the single most obvious wrong material on the
// aeroplane. `AERO_HARD.gear` says what each of the names above is MADE OF;
// the colour stays the one on the row beside it.
//
// LAZY, AND IT HAS TO BE: in the game bundle `aeroskin.js` loads AFTER this
// file (dev.html's order, and build.js copies it), so resolving at module
// load would find no AEROSKIN and cache the Lambert answer forever. It is
// resolved on first use and pooled by the factory, so this costs one map
// lookup per bag.
// NOT CACHED HERE, deliberately: the material view is a switch the player can
// throw mid-session, and a cache in the layer would have to be invalidated by
// something that knows about it. The factory already pools on the look, so
// asking every time costs a string join and a Map hit.
function gearMat(name) {
  const A = (typeof window !== 'undefined' && window.AEROSKIN) || null;
  const m0 = MAT[name];
  if (!A || !A.aeroHardMat) return m0;
  // FrontSide, matching the Lambert it replaces: these are closed solids,
  // and the one open shell (the spat) has always shown its inside as empty.
  return A.aeroHardMat(THREE, 'gear', name,
    m0 && m0.color ? m0.color.getHex() : 0x9aa1a9,
    { side: THREE.FrontSide }) || m0;
}

// ---- THE AIRFRAME STUB ----------------------------------------------------
// The bench's own body: an elliptical section swept along z with a
// drooping keel. It exists ONLY to give the fitments a real surface to
// sit on — swap this provider for cageResolve and the same legs bolt to
// the real aeroplane.
function stubAirframe(P) {
  const z0 = -P.afLen * 0.62, z1 = P.afLen * 0.38;
  const shape = z => {
    const t = clamp((z - z0) / (z1 - z0), 0, 1);
    // fat through the cabin, tapering to the tail, rounded at the nose
    const f = t < 0.72 ? 0.34 + 0.66 * Math.pow(t / 0.72, 0.45)
                       : 1 - 0.55 * Math.pow((t - 0.72) / 0.28, 1.6);
    return clamp(f, 0.10, 1);
  };
  const halfWAt = z => P.afHalfW * shape(z);
  const heightAt = z => P.afHeight * shape(z);
  const keelAt = z => {
    const t = clamp((z - z0) / (z1 - z0), 0, 1);
    return P.afKeelY + P.afKeelRise * Math.pow(1 - t, 2.0);
  };
  const cyAt = z => keelAt(z) + heightAt(z);
  // ang from the keel: 0 = bottom centreline, +pi/2 = +x flank
  const surf = (z, ang) => [Math.sin(ang) * halfWAt(z),
                            cyAt(z) - Math.cos(ang) * heightAt(z), z];
  const nrmAt = (z, ang) => {
    const e = 0.004;
    const a = surf(z, ang - e), b = surf(z, ang + e), c = surf(z + 0.02, ang);
    const n = nrm(crs(sub(b, a), sub(c, surf(z, ang))));
    return dot(n, [0, -1, 0]) > 0 ? n : mul(n, -1);   // outward (downward)
  };
  return { z0, z1, halfWAt, heightAt, keelAt, cyAt, surf, nrmAt,
           stub: true };
}
function drawStub(parent, AF, P) {
  const bag = Bag();
  const NZ = 44, NA = 30;
  const rows = [];
  for (let i = 0; i <= NZ; i++) {
    const z = AF.z0 + (AF.z1 - AF.z0) * i / NZ, row = [];
    for (let k = 0; k <= NA; k++)
      row.push(bag.v(AF.surf(z, -Math.PI + 2 * Math.PI * k / NA)));
    rows.push(row);
  }
  for (let i = 0; i < NZ; i++) for (let k = 0; k < NA; k++)
    bag.quad(rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]);
  bag.mesh(parent, MAT.body);
  // THE LINES ARE WHAT MAKE IT READ AS A BODY: station rings every so
  // often, the keel, and a waterline each side. Cheap, and it beats
  // turning the opacity up until the gear is hard to see.
  const pos = [];
  const seg = (a2, b2) => pos.push(a2[0], a2[1], a2[2], b2[0], b2[1], b2[2]);
  for (let i = 0; i <= 8; i++) {
    const z = AF.z0 + (AF.z1 - AF.z0) * i / 8;
    for (let k = 0; k < NA; k++)
      seg(AF.surf(z, -Math.PI + 2 * Math.PI * k / NA),
          AF.surf(z, -Math.PI + 2 * Math.PI * (k + 1) / NA));
  }
  for (const ang of [0, Math.PI / 2, -Math.PI / 2, Math.PI])
    for (let i = 0; i < NZ; i++) {
      const z0 = AF.z0 + (AF.z1 - AF.z0) * i / NZ;
      const z1 = AF.z0 + (AF.z1 - AF.z0) * (i + 1) / NZ;
      seg(AF.surf(z0, ang), AF.surf(z1, ang));
    }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(pos), 3));
  parent.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
    color: 0x7d8996, transparent: true, opacity: 0.42 })));
}

// ---- 4. THE CONTACT: WHEEL, TYRE, BRAKE -----------------------------------
// A revolved PROFILE in two shells (the G4.6 rule — never a cylinder with
// lids): the hub flange point IS the tyre bead point, so they meet with
// no gap. Sizes follow the radius: half-width 0.40 R, bead at 0.42 R.
// THE TYRE CARCASS. Three real profiles: a standard aviation tyre, a
// TUNDRA balloon (fat, low pressure, round-shouldered — the bush tyre)
// and a SLIM one for a glider or a spatted racer. Everything scales off
// the radius, so one number sizes the wheel.
const TYRE = {
  0: { hw: 0.40, bead: 0.42, bulge: 1.02, bulgeAt: 0.80, crown: 0.035 },
  1: { hw: 0.58, bead: 0.34, bulge: 1.04, bulgeAt: 0.72, crown: 0.10 },
  2: { hw: 0.29, bead: 0.46, bulge: 1.00, bulgeAt: 0.84, crown: 0.02 },
};
function wheel(bags, ctr, axis, R, opt) {
  opt = opt || {};
  const P = opt.P || {};
  const prof = TYRE[Math.round(P.whProfile || 0)] || TYRE[0];
  const hw = R * prof.hw, bead = R * prof.bead;
  const half = hw * 0.70;                    // the crown band
  const beadH = hw * 0.90;                   // where the tyre meets the rim
  const face = hw * 0.74;                    // THE RIM IS INSET (user)
  const tread = Math.round(P.whTread == null ? 0 : P.whTread);
  const T = bags.tyre, Hb = bags.hub;
  const ax = nrm(axis);
  let e1 = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  e1 = nrm(sub(e1, mul(ax, dot(e1, ax))));
  const e2 = crs(ax, e1);
  const at = (rad, hh, an) => add(ctr, add(mul(ax, hh),
    add(mul(e1, Math.cos(an) * rad), mul(e2, Math.sin(an) * rad))));

  // ---- carcass ----------------------------------------------------------
  // The tread is GEOMETRY: circumferential grooves fall out of a revolve,
  // and being u-invariant they read right on a wheel that never spins.
  const ribs = Math.max(1, Math.round(P.whRibs == null ? 3 : P.whRibs));
  const rEdge = R * (1 - prof.crown);        // crown radius at its edge
  // SIDEWALL INFLATION (G33, user: "a more inflated shape on the
  // sides"): whBulge multiplies the two sidewall widths only — the bead
  // stays on the rim and the crown band stays put, so the tyre balloons
  // without leaving its wheel. 1 = the profile as drawn before (and
  // TYRE's own `bulge` column stays what it always was: unread).
  const B = P.whBulge == null ? 1 : Math.max(0.5, P.whBulge);
  const flank = s => [
    [bead * 1.03, s * beadH * 1.00],
    [R * 0.60, s * hw * B],                  // widest: the sidewall bulge
    [R * prof.bulgeAt, s * hw * 0.97 * B],
    [R * 0.945, s * half * 1.16],
    [rEdge, s * half],                       // MEETS THE CROWN EXACTLY
  ];
  // SUBDIVIDE ONLY WHERE THERE IS SOMETHING TO RESOLVE (user: a smooth
  // tyre was still carrying 44 bands across the crown). The crown is a
  // gentle parabola, so it needs five samples; each groove brings its own
  // cluster. Smooth tread: 5 rows. Three ribs: 32.
  const rAt = t => {
    let r = R * (1 - prof.crown * t * t);
    if (tread === 0)
      for (let k = 0; k < ribs; k++) {
        const gp = -1 + 2 * (k + 0.5) / ribs;
        const d = (t - gp) / 0.075;
        r -= R * 0.052 * Math.exp(-d * d * 3.2);
      }
    return r;
  };
  const ts = new Set([-1, -0.55, 0, 0.55, 1]);
  if (tread === 0)
    for (let k = 0; k < ribs; k++) {
      const gp = -1 + 2 * (k + 0.5) / ribs;
      for (const d of [-0.16, -0.10, -0.055, -0.02, 0, 0.02, 0.055, 0.10, 0.16])
        ts.add(clamp(gp + d, -1, 1));
    }
  const crown = [...ts].sort((p, q) => p - q).map(t => [rAt(t), t * half]);
  revolve(T, ctr, ax, flank(-1).concat(crown, flank(1).reverse()), 44);
  if (tread === 2) {
    const NB = 15;
    for (let row = -1; row <= 1; row += 2)
      for (let k = 0; k < NB; k++) {
        const an = 2 * Math.PI * (k + (row > 0 ? 0.5 : 0)) / NB;
        const c0 = at(R * 0.985, row * half * 0.46, an);
        const rad = nrm(sub(c0, add(ctr, mul(ax, row * half * 0.46))));
        // (ax, rad x ax, rad) is RIGHT-handed; (ax, ax x rad, rad) is not,
        // and every lug came out inside out
        boxIn(bags.tyre, off(c0, rad, R * 0.030),
              [R * 0.085, R * 0.20, R * 0.042], ax, crs(rad, ax), rad);
      }
  }
  for (const s of [-1, 1])
    for (const rr of [0.62, 0.70])
      revolve(T, ctr, ax, [[R * rr, s * hw * 0.90],
        [R * (rr + 0.035), s * hw * 0.93], [R * (rr + 0.07), s * hw * 0.90]],
        36);

  // ---- the rim ----------------------------------------------------------
  const rimK = Math.round(P.whRim == null ? 0 : P.whRim);
  const bolts = Math.max(3, Math.round(P.whBolts == null ? 6 : P.whBolts));
  // bead seats, flange lips and the well between them — the drum the
  // tyre actually mounts on, sitting INSIDE the tyre wall
  // A REAL FLANGE, standing PROUD of the bead: the tyre seats against it
  // and it closes the ring of daylight that showed between tyre and rim.
  // Rolled over at its lip, which is what the tyre bead beds into.
  // THE SECTION IS A CLOSED LOOP, so this revolves into a solid with a
  // real wall. As an open shell its inside faces showed through the well
  // and read as inverted normals.
  const wall = R * 0.028;
  const outer = [
    [bead * 1.19, -beadH * 1.16], [bead * 1.21, -beadH * 1.08],
    [bead * 1.16, -beadH * 1.02], [bead * 1.02, -beadH * 0.97],
    [R * 0.335, -beadH * 0.52], [R * 0.335, beadH * 0.52],
    [bead * 1.02, beadH * 0.97], [bead * 1.16, beadH * 1.02],
    [bead * 1.21, beadH * 1.08], [bead * 1.19, beadH * 1.16],
  ];
  const inner = outer.map(([r, hh], i) => {
    const endLip = i === 0 || i === outer.length - 1;
    return [r - wall, endLip ? hh - Math.sign(hh) * wall * 0.6 : hh];
  }).reverse();
  const loop = outer.concat(inner);
  loop.push(loop[0].slice());                 // close the section
  revolve(Hb, ctr, ax, loop, 40);
  // hub barrel
  revolve(Hb, ctr, ax, [[R * 0.11, -hw * 0.92], [R * 0.17, -hw * 0.86],
    [R * 0.17, hw * 0.86], [R * 0.11, hw * 0.92]], 26);
  // THE OUTER FACE IS THE RIM STYLE — drawn on both faces, inset
  for (const s of [-1, 1]) {
    const hf = s * face;
    if (rimK === 1) {                        // SPOKED: open, see-through
      const NS = Math.max(6, bolts * 2);
      for (let k = 0; k < NS; k++) {
        const an = 2 * Math.PI * k / NS;
        taper(Hb, at(R * 0.165, hf * 0.80, an), at(R * 0.33, hf * 1.02, an),
              R * 0.026, R * 0.017, 7);
      }
      revolve(Hb, ctr, ax, [[R * 0.31, hf * 1.02], [R * 0.345, hf * 1.02],
        [R * 0.345, hf * 0.86], [R * 0.31, hf * 0.86]], 34, true);
    } else if (rimK === 2) {                 // LIGHTENED: ring + webs
      revolve(Hb, ctr, ax, [[R * 0.155, hf * 0.84], [R * 0.225, hf * 0.96],
        [R * 0.225, hf * 0.84], [R * 0.155, hf * 0.72]], 34, true);
      revolve(Hb, ctr, ax, [[R * 0.305, hf * 1.00], [R * 0.35, hf * 1.00],
        [R * 0.35, hf * 0.86], [R * 0.305, hf * 0.86]], 34, true);
      for (let k = 0; k < bolts; k++) {
        const an = 2 * Math.PI * k / bolts;
        const a0 = at(R * 0.20, hf * 0.92, an), a1 = at(R * 0.33, hf * 0.96, an);
        sweep(Hb, resample([a0, a1], 4),
              () => secBlade(R * 0.10, R * 0.030), true, ax);
      }
    } else {                                 // CAST DISC: solid, dished
      revolve(Hb, ctr, ax, [[R * 0.16, hf * 0.80], [R * 0.24, hf * 1.00],
        [R * 0.32, hf * 0.96], [bead * 0.99, hf * 0.72]], 38);
    }
  }
  // bolt heads on the outer face, where a wheel shows them
  for (let k = 0; k < bolts; k++) {
    const an = 2 * Math.PI * k / bolts;
    bolt(bags.alloy, at(R * 0.255, face * 1.02, an), ax, R * 0.040, hw * 0.10);
    bolt(bags.alloy, at(R * 0.255, -face * 1.02, an), mul(ax, -1),
         R * 0.034, hw * 0.06);
  }
  const cap = Math.round(P.whCap == null ? 1 : P.whCap);
  if (cap) for (const s of [-1, 1]) {
    const dome = [], ND = 8;
    for (let i = 0; i <= ND; i++) {
      const t = i / ND;
      dome.push(cap === 1
        ? [R * 0.165 * Math.cos(t * Math.PI / 2),
           s * (hw * 0.88 + R * 0.090 * Math.sin(t * Math.PI / 2))]
        : [R * 0.165 * (1 - t), s * (hw * 0.88 + R * 0.020)]);
    }
    revolve(bags.alloy, ctr, ax, dome, 26);
  }
  if (P.whValve == null || P.whValve) {
    const an = Math.PI * 0.28;
    const b0 = at(R * 0.345, face * 0.80, an);
    const b1 = at(R * 0.405, hw * 1.24, an);
    taper(bags.dark, b0, b1, R * 0.030, R * 0.022, 8);
    revolve(bags.alloy, b1, nrm(sub(b1, b0)), [[R * 0.023, 0],
      [R * 0.023, R * 0.034], [R * 0.015, R * 0.040]], 10, true);
  }

  // ---- brake --------------------------------------------------------------
  if (opt.brake) {
    // +axis IS outboard for both wheels of a pair (the station builds
    // axis = [sgn,0,0]), so inboard is simply -axis. Taking the sign from
    // the station as well flipped it back on the port wheel and put that
    // brake — and the valve — on the wrong face.
    const s = 1;
    const kind = Math.round(P.whBrake == null ? 0 : P.whBrake);
    if (kind === 1) {
      revolve(bags.brake, off(ctr, ax, -s * hw * 1.02), ax,
        [[R * 0.20, 0], [R * 0.60, 0], [R * 0.60, -s * hw * 0.44],
         [R * 0.54, -s * hw * 0.52], [R * 0.20, -s * hw * 0.52]], 30, true);
    } else {
      const dz = -s * hw * 1.16;
      revolve(bags.brake, off(ctr, ax, dz), ax,
        [[R * 0.22, 0], [R * 0.62, 0], [R * 0.62, -s * 0.010],
         [R * 0.22, -s * 0.010]], 30, true);
      for (let k = 0; k < 16; k++) {
        const an = 2 * Math.PI * k / 16;
        revolve(bags.hub, at(R * 0.46, dz + s * 0.001, an), ax,
                [[R * 0.032, 0], [R * 0.032, -s * 0.012]], 8, true);
      }
      const up = [0, 1, 0];
      const rad = nrm(sub(up, mul(ax, dot(up, ax))));
      const cc = add(off(ctr, ax, dz), mul(rad, R * 0.52));
      // G58.3: the CALIPER does not turn with the wheel — it bolts to the
      // leg. When the caller provides a `brakefix` bag (the cage join's
      // per-wheel split), the caliper goes there and stays static; the
      // bench and every other caller fall through to `brake` unchanged.
      boxIn(bags.brakefix || bags.brake, cc, [R * 0.15, R * 0.24, R * 0.115],
            nrm(crs(rad, ax)), rad, ax);
      taper(bags.dark, add(cc, mul(rad, R * 0.16)),
            add(cc, add(mul(rad, R * 0.40), mul(ax, -s * R * 0.10))),
            R * 0.022, R * 0.018, 7);
    }
  }
}
// ---- THE SPAT -------------------------------------------------------------
// A wheel fairing is a STREAMLINED BODY, and the shape is the whole point
// of it — the first attempt was a swept teardrop that read as a blob, so
// it was deleted rather than left rough (user: properly or not at all).
//
// Built as a chordwise loft in the wheel's own plane: a rounded nose
// AHEAD of the tyre, maximum depth just aft of the axle, then a long fine
// run-out behind — and an elliptical section at every station, narrow at
// the crown and full at the axle line, so it is egg-shaped rather than a
// tube. The bottom is OPEN on a chord line so the tyre reaches the
// ground, and the opening carries a rolled edge bead, which is what a
// real glassfibre spat has where the two halves are joined.
function spat(bags, hub, axis, R, full) {
  const ax = nrm(axis);
  let up = sub([0, 1, 0], mul(ax, dot([0, 1, 0], ax)));
  up = nrm(up);
  let fwd = crs(up, ax);
  if (fwd[2] < 0) fwd = mul(fwd, -1);            // point it at the nose
  const zN = R * 1.62, zT = R * 2.45;            // nose ahead, tail behind
  const Hm = R * 1.20, Wm = R * 0.62;            // depth and half width
  const yCut = full ? -R * 0.80 : -R * 0.48;     // how far down it wraps
  const NT = 30, NA = 22;
  // THE FAIRING IS THE GREATER OF TWO SHAPES. Streamline alone is
  // shallower than the tyre at the front and back of the wheel, and the
  // wheel punched through it; the envelope alone is a drum. Take the max
  // and it encloses the wheel AND runs out to a fine tail.
  const gap = R * 0.07;
  const env = z => Math.abs(z) < R ? Math.sqrt(Math.max(0, R * R - z * z)) : 0;
  const stream = z => z >= 0
    ? Hm * Math.sqrt(Math.max(0, 1 - (z / zN) * (z / zN)))
    : Hm * Math.pow(Math.max(0, 1 - Math.pow(-z / zT, 1.85)), 0.62);
  const Hat = z => Math.max(stream(z), env(z) > 0 ? env(z) + gap : 0);
  const Wat = z => {
    // full width wherever the tyre is, easing out just past it
    const kw = clamp((R * 1.06 - Math.abs(z)) / (R * 0.28), 0, 1);
    return Math.max(Wm * Math.pow(Math.max(0, stream(z) / Hm), 0.62),
                    (R * 0.40 + gap) * kw);
  };
  const bag = bags.fair;
  const rows = [], edges = [[], []];
  for (let i = 0; i <= NT; i++) {
    const t = i / NT;
    const z = zN - t * (zN + zT);
    const Hh = Math.max(1e-4, Hat(z)), Ww = Math.max(1e-4, Wat(z));
    // where the ellipse meets the cut, measured from the crown
    const c = clamp(yCut / Hh, -1, 1);
    const aMax = Math.acos(c);                   // 0 = crown, pi = keel
    const row = [];
    for (let j = 0; j <= NA; j++) {
      const an = -aMax + 2 * aMax * j / NA;
      const y = Hh * Math.cos(an), x = Ww * Math.sin(an);
      row.push(bag.v(add(hub, add(mul(fwd, z), add(mul(up, y), mul(ax, x))))));
    }
    rows.push(row);
    const pE = an2 => add(hub, add(mul(fwd, z),
      add(mul(up, Hh * Math.cos(an2)), mul(ax, Ww * Math.sin(an2)))));
    edges[0].push(pE(-aMax));
    edges[1].push(pE(aMax));
  }
  // the (fwd, up, ax) frame flips handedness with the wheel side, which
  // turned one fairing of the pair inside out
  //
  // THE SIGN WAS INVERTED, and the reason it survived is that this term only
  // ever made the PAIR agree with each other — measured, both sides came out
  // 1599 faces inward against 329 outward, so left and right were consistently
  // wrong and nothing about the pair looked asymmetric. A fairing lit from
  // inside reads as a dark shell rather than as an obvious hole, which is why
  // the tyre's version of this (G20b) was caught and the spat's was not.
  // Counting normals against the outward radial is what found it; comparing
  // the two sides never could.
  const hand = dot(crs(fwd, up), ax) >= 0 ? -1 : 1;
  for (let i = 0; i < NT; i++) for (let j = 0; j < NA; j++) {
    if (hand > 0)
      bag.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
    else
      bag.quad(rows[i][j + 1], rows[i][j], rows[i + 1][j], rows[i + 1][j + 1]);
  }
  // the rolled edge bead down both sides of the opening
  for (const e of edges)
    sweep(bag, resample(e, 24), () => secRound(R * 0.030, 7), true);
}

// ---- AN AIRFRAME FROM A MESH ---------------------------------------------
// Same contract as the stub, backed by the real exported fuselage. The
// export is a whole aeroplane (wings, interior, instruments), so faces
// are filtered to the CAGE MATERIALS — that set is exactly the fuselage
// skin, 1272 faces of it, and it keeps the wings out of the sections.
//
// surf(z, ang) is answered from a table baked once: slice the mesh at
// each station, then cast a ray from the section centre at each angle
// and keep the OUTERMOST hit. Ray casting (rather than tracing the
// section into an ordered loop) means a slice that comes back as loose
// segments still answers correctly.
// boomTube = the G26 rod boom: it IS the aft fuselage — the tailwheel
// probes it, and the fin/stab deck sweep (which borrows this set) must
// trace its top line to the tail
const CAGE_MATS = new Set(["body", "pillarWindow", "pillarCabin",
  "pillarPassenger", "pillarTail", "pillarFront", "windshield",
  "skyWindows", "pilotWindow", "pasengerWindow", "ceilingLoop",
  "floorLoop", "waistband", "boomTube", "taper", "pillarTaper",
  "taperPanel"]);
// THE BAKE, over a plain indexed mesh — `V` a list of points, `F` a list of
// index arrays, already filtered to the skin. Split out of objAirframe so a
// FROZEN export and a LIVE cage reach the contract by the same code path
// instead of two that can drift; the parser below and cageAirframe are now
// only their two front doors.
function meshAirframe(V, F) {
  if (!F || !F.length) return null;
  let z0 = 1e9, z1 = -1e9;
  for (const f of F) for (const i of f) {
    if (V[i][2] < z0) z0 = V[i][2];
    if (V[i][2] > z1) z1 = V[i][2];
  }
  z0 += 1e-4; z1 -= 1e-4;
  const NZ = 96, NA = 72;
  // bucket faces by the stations they span, so each slice tests few
  const buckets = Array.from({ length: NZ + 1 }, () => []);
  const iz = z => clamp(Math.floor((z - z0) / (z1 - z0) * NZ), 0, NZ);
  for (const f of F) {
    let a = 1e9, b = -1e9;
    for (const i of f) { a = Math.min(a, V[i][2]); b = Math.max(b, V[i][2]); }
    for (let k = iz(a); k <= iz(b); k++) buckets[k].push(f);
  }
  const RAD = [], CY = [];
  for (let i = 0; i <= NZ; i++) {
    const z = z0 + (z1 - z0) * i / NZ;
    // slice: every face crossing this plane yields one segment
    const segs = [];
    let yLo = 1e9, yHi = -1e9;
    for (const f of buckets[i]) {
      const hits = [];
      for (let k = 0; k < f.length; k++) {
        const A = V[f[k]], B = V[f[(k + 1) % f.length]];
        const dA = A[2] - z, dB = B[2] - z;
        if ((dA > 0) === (dB > 0)) continue;
        const t = dA / (dA - dB);
        hits.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
      }
      if (hits.length >= 2) {
        segs.push([hits[0], hits[1]]);
        for (const p of hits) { yLo = Math.min(yLo, p[1]); yHi = Math.max(yHi, p[1]); }
      }
    }
    const cy = segs.length ? (yLo + yHi) / 2 : 0;
    CY.push(cy);
    const row = [];
    for (let k = 0; k < NA; k++) {
      const ang = -Math.PI + 2 * Math.PI * k / NA;
      const dx = Math.sin(ang), dy = -Math.cos(ang);   // 0 = straight down
      let best = 0;
      for (const [A, B] of segs) {
        const ex = B[0] - A[0], ey = B[1] - A[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const rx = A[0] - 0, ry = A[1] - cy;
        const t = (rx * ey - ry * ex) / den;          // along the ray
        const u = (rx * dy - ry * dx) / den;          // along the segment
        if (t > best && u >= 0 && u <= 1) best = t;
      }
      row.push(best);
    }
    RAD.push(row);
  }
  const radAt = (z, ang) => {
    const fz = clamp((z - z0) / (z1 - z0) * NZ, 0, NZ);
    const i0 = Math.floor(fz), i1 = Math.min(NZ, i0 + 1), tz = fz - i0;
    let a = ang;
    while (a < -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    const fa = (a + Math.PI) / (2 * Math.PI) * NA;
    const k0 = Math.floor(fa) % NA, k1 = (k0 + 1) % NA, ta = fa - Math.floor(fa);
    const r0 = RAD[i0][k0] * (1 - ta) + RAD[i0][k1] * ta;
    const r1 = RAD[i1][k0] * (1 - ta) + RAD[i1][k1] * ta;
    return r0 * (1 - tz) + r1 * tz;
  };
  const cyAt = z => {
    const fz = clamp((z - z0) / (z1 - z0) * NZ, 0, NZ);
    const i0 = Math.floor(fz), i1 = Math.min(NZ, i0 + 1), tz = fz - i0;
    return CY[i0] * (1 - tz) + CY[i1] * tz;
  };
  const surf = (z, ang) => {
    const r = radAt(z, ang);
    return [Math.sin(ang) * r, cyAt(z) - Math.cos(ang) * r, z];
  };
  const keelAt = z => surf(z, 0)[1];
  const halfWAt = z => Math.abs(surf(z, Math.PI / 2)[0]);
  const heightAt = z => (surf(z, Math.PI)[1] - surf(z, 0)[1]) / 2;
  const nrmAt = (z, ang) => {
    const e = 0.01;
    const a = surf(z, ang - e), b = surf(z, ang + e), c = surf(z + 0.05, ang);
    const n = nrm(crs(sub(b, a), sub(c, surf(z, ang))));
    return dot(n, [0, -1, 0]) > 0 ? n : mul(n, -1);
  };
  return { z0, z1, surf, keelAt, halfWAt, heightAt, cyAt, nrmAt,
           mesh: { V, F }, stub: false };
}

function objAirframe(text) {
  const V = [], F = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const p = line.trim().split(/\s+/);
      V.push([+p[1], +p[2], +p[3]]);
    } else if (line.startsWith("usemtl ")) cur = line.slice(7).trim();
    else if (line.startsWith("f ") && CAGE_MATS.has(cur)) {
      F.push(line.trim().split(/\s+/).slice(1)
        .map(s => parseInt(s.split("/")[0], 10) - 1));
    }
  }
  return meshAirframe(V, F);
}

// THE LIVE CAGE, in the same contract — this is what the stub was always a
// stand-in for. Takes the cage mesh as built (`{V, F:[{v, m}]}`) and the scale
// that turns cage units into metres.
//
// The hardware is METRIC and the aeroplane is not: the cage is generated at
// its own size and worn at `planeScale`, so the conversion happens ONCE, here,
// on the vertices. Every leg, pad, lug and bolt downstream is then in metres
// without knowing a cage exists — which is the same rule the crew layer
// follows, and the reason a dummy or a wheel can be the ruler at all.
//
// Faces are filtered to the skin materials for the reason the OBJ path filters
// them: an interior, a dash and a set of seats are inside the body, and a ray
// cast from the section centre would otherwise stop on the nearest of them.
function cageAirframe(mesh, scale) {
  if (!mesh || !mesh.V || !mesh.F) return null;
  const k = scale || 1;
  const V = mesh.V.map(p => [p[0] * k, p[1] * k, p[2] * k]);
  // AS-BUILT, not as-displayed (G29, user: the undercarriage moved with
  // `explode`): a cut part's faces carry their translation as `cutOff` —
  // measure every part back at its own place, the dims-pane rule. Cut
  // verts are per-part duplicates, so each is moved back exactly once.
  const F = [], undone = new Set();
  for (const f of mesh.F)
    if (f && f.v && f.v.length >= 3 && CAGE_MATS.has(f.m)) {
      if (f.cutOff)
        for (const i of f.v) {
          if (undone.has(i)) continue;
          undone.add(i);
          V[i] = [V[i][0] - f.cutOff[0] * k, V[i][1] - f.cutOff[1] * k,
                  V[i][2] - f.cutOff[2] * k];
        }
      F.push(f.v.slice());
    }
  return meshAirframe(V, F);
}
function drawBody(parent, AF) {
  const bag = Bag();
  const map = new Map();
  const vid = i => {
    if (!map.has(i)) map.set(i, bag.v(AF.mesh.V[i]));
    return map.get(i);
  };
  for (const f of AF.mesh.F) {
    if (f.length === 3) bag.tri(vid(f[0]), vid(f[1]), vid(f[2]));
    else if (f.length >= 4) bag.quad(vid(f[0]), vid(f[1]), vid(f[2]), vid(f[3]));
  }
  bag.mesh(parent, MAT.body);
}
// ---- FITMENTS -------------------------------------------------------------
// Where the leg meets the aeroplane. Each returns the ATTACH FRAME the
// leg then grows from, so the leg never has to know about the body.
// n = the surface's outward normal (downward-ish on a belly).
function fitFrame(AF, z, ang) {
  const p = AF.surf(z, ang), n = AF.nrmAt(z, ang);
  const fore = nrm(sub(AF.surf(z + 0.05, ang), AF.surf(z - 0.05, ang)));
  const side = nrm(crs(n, fore));
  return { p, n, fore, side };
}
// a bolted DOUBLER PAD: the plate that spreads a leg's load into the
// skin. Sits ON the surface, follows it, and carries its own bolts.
function fitPad(bags, AF, z, ang, L, W, opt) {
  opt = opt || {};
  const NL = 7, NW = 5;
  const bag = bags.alloy;
  const rows = [], out = [];
  for (let i = 0; i <= NL; i++) {
    const zz = z + L * (i / NL - 0.5);
    const ri = [], ro = [];
    for (let k = 0; k <= NW; k++) {
      const aa = ang + (W / Math.max(0.05, AF.halfWAt(zz))) * (k / NW - 0.5);
      const p = AF.surf(zz, aa), n = AF.nrmAt(zz, aa);
      // rounded corners: pull the plate in at the ends
      const fi = Math.min(1, 2.6 * Math.min(i / NL, 1 - i / NL) + 0.35);
      const fk = Math.min(1, 2.6 * Math.min(k / NW, 1 - k / NW) + 0.35);
      const t = (opt.thick || 0.006) * Math.min(fi, fk);
      ri.push(bag.v(off(p, n, 0.0008)));
      ro.push(bag.v(off(p, n, t)));
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
  if (opt.bolts !== false) {
    const bw = W * 0.34 / Math.max(0.05, AF.halfWAt(z));
    for (const dz of [-L * 0.38, L * 0.38])
      for (const da of [-bw, bw]) {
        const p = AF.surf(z + dz, ang + da), n = AF.nrmAt(z + dz, ang + da);
        bolt(bags.alloy, off(p, n, (opt.thick || 0.006)), n, 0.011, 0.010);
      }
  }
}

// the STUB AXLE: from where the leg ends, out through the hub and a
// little past it — the piece that was missing when legs ran to the
// wheel centre. Machined step + a nut face at the end.
function axleStub(bags, from, axis, reach) {
  revolve(bags.alloy, from, axis,
          [[0.026, 0], [0.030, 0.012], [0.030, 0.030],
           [0.018, 0.036], [0.018, reach * 1.55], [0.024, reach * 1.62],
           [0.024, reach * 1.70], [0.012, reach * 1.74]], 16, true);
}

// ---- 2. THE LEGS ----------------------------------------------------------
// Each builds from an attach frame down to an AXLE POINT and returns
// { axle, axis, travel } — travel is the unit direction the wheel moves
// when the leg compresses, which is what the physics will want.

// (a) BENDING BEAM — the leg IS the spring: a tapered blade bolted to a
// belly saddle, bowing out and down to the axle. Cessna spring steel,
// Wittman rod, composite blade.
function legBeam(bags, AF, P, st, sgn) {
  const F = fitFrame(AF, st.z, sgn * P.beamAng * D2R);
  const drop = st.drop, half = st.x;
  // the blade sits ON its doubler, not above it
  const root = off(F.p, F.n, 0.009 + P.beamT * 0.5);
  const axle = [sgn * half, AF.keelAt(st.z) - drop, st.z + P.beamRake * drop];
  // A LEG STOPS AT THE WHEEL, and a stub axle carries on to the hub — the
  // blade used to run to the axle CENTRE and so passed through the tyre.
  const hubIn = st.R * 0.40 + 0.020;
  const axleIn = [axle[0] - sgn * hubIn, axle[1], axle[2]];
  // the blade bows: the control point pulls it outboard, which is what
  // gives a spring leg its arc and its track gain under load
  const ctrl = [sgn * half * P.beamBow, root[1] - drop * 0.62,
                lerp3(root, axle, 0.5)[2]];
  const path = resample(bez(root, ctrl, axleIn, 14), 18);
  const w0 = P.beamW, w1 = P.beamW * P.beamTaper;
  const t0 = P.beamT, t1 = P.beamT * (0.62 + 0.38 * P.beamTaper);
  sweep(bags.steel, path,
        t => secBlade(w0 + (w1 - w0) * t, t0 + (t1 - t0) * t),
        true, F.side);
  fitPad(bags, AF, st.z, sgn * P.beamAng * D2R,
         P.beamW * 1.5, P.beamW * 1.35, { thick: 0.009 });
  // the CLAMP: the blade is trapped between the pad and a machined block
  boxIn(bags.alloy, off(root, F.n, t0 * 0.5 + 0.004),
        [P.beamW * 0.60, 0.012, P.beamW * 0.72],
        F.side, F.n, F.fore);
  for (const s of [-1, 1])
    bolt(bags.alloy, off(add(root, mul(F.fore, s * P.beamW * 0.42)),
                         F.n, t0 * 0.5 + 0.016), mul(F.n, -1), 0.010, 0.026);
  // axle boss at the tip
  const axis = [sgn, 0, 0];
  axleStub(bags, axleIn, axis, hubIn);
  // G58.7: `root` is the AIRFRAME anchor — the join pins the leg there
  return { axle, axis, root: F.p, travel: nrm([sgn * 0.32, 1, 0]) };
}

// (b) SWINGING LINK — the axle rides an arm that rotates about a pivot on
// the airframe; a separate shock takes the load. Trailing link, and the
// Cub's V-strut-plus-bungee is this with an elastic tie.
function legLink(bags, AF, P, st, sgn) {
  const drop = st.drop, half = st.x;
  const ang = sgn * P.linkAng * D2R;
  // WHEEL ANGLE TO THE FUSELAGE, CONTINUOUS: the arm swings about its
  // pivot line, negative trailing through 0 (axle under the pivot) to
  // positive leading. The DROP stays authoritative — swinging the arm
  // moves the wheel fore and aft, never up and down. Ride height is
  // therefore unaffected; the DECK ANGLE still changes, correctly, because
  // the wheelbase does (measured: swing -60 to +40 takes the wheelbase
  // 2.82 -> 4.94 m and the deck 14.3 -> 8.2 deg).
  const axY = AF.keelAt(st.z) - drop;
  const swing = (P.linkSwing || 0) * D2R;
  const pivY = AF.surf(st.z, sgn * P.linkAng * D2R)[1];
  const axle = [sgn * half, axY,
                st.z + Math.max(0.02, pivY - axY) * Math.tan(swing)];
  const hubIn = st.R * 0.40 + 0.020;
  const axleIn = [axle[0] - sgn * hubIn, axle[1], axle[2]];
  const PADT = 0.008, R = P.linkArmW * 0.5;
  // THE V: two tubes, their fuselage ends split fore and aft. The line
  // between those two fittings IS the hinge, which is what makes the
  // triangle a swinging link and not a strut.
  const vee = P.linkVee > 0.5;
  const sp = vee ? P.linkSpread * 0.5 : 0;
  const FF = fitFrame(AF, st.z + sp, ang), FR = fitFrame(AF, st.z - sp, ang);
  const seat = (Fr) => off(Fr.p, Fr.n, PADT + R * 0.7);
  const pF = seat(FF), pR = seat(FR);
  const feet = vee ? [[pF, FF, st.z + sp], [pR, FR, st.z - sp]]
                   : [[lerp3(pF, pR, 0.5), FF, st.z]];
  const pax = vee ? nrm(sub(pF, pR))                  // hinge along the body
                  : nrm(crs(sub(axleIn, pF), FF.n));  // lateral pin
  for (const [p] of feet) {
    const path = resample([p, axleIn], 8);
    sweep(bags.steel, path, t => secRound(R * (1 - 0.14 * t), 12), true);
  }
  for (const [p, Fr, z] of feet) {
    fitPad(bags, AF, z, ang, 0.13, 0.11, { thick: PADT });
    for (const s of [-1, 1])
      lug(bags.alloy, off(p, pax, s * (R + 0.013)), pax, sub(Fr.p, p),
          0.024, 0.009, 0.062);
    revolve(bags.bronze, off(p, pax, -(R + 0.021)), pax,
            [[0.012, 0], [0.012, 2 * (R + 0.021)]], 14, true);
  }
  // THE PANEL IN THE V (user, Cub reference): a light sheet filling the
  // triangle between the two tubes and the axle knuckle — on the real
  // aeroplane it carries the NO STEP and stiffens the vee. Inset from the
  // tube centrelines so the tubes still read as tubes at the edges.
  if (vee && P.linkPanel) {
    const cen = [(pF[0] + pR[0] + axleIn[0]) / 3, (pF[1] + pR[1] + axleIn[1]) / 3,
                 (pF[2] + pR[2] + axleIn[2]) / 3];
    const inset = q => lerp3(q, cen, 0.055);
    const tri = [inset(pF), inset(pR), inset(axleIn)];
    const nz = nrm(crs(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
    const th = P.linkPanelT || 0.004;
    const fa = tri.map(q => bags.steel.v(off(q, nz, th / 2)));
    const fb = tri.map(q => bags.steel.v(off(q, nz, -th / 2)));
    bags.steel.tri(fa[0], fa[1], fa[2]);
    bags.steel.tri(fb[2], fb[1], fb[0]);
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      bags.steel.quad(fa[k], fb[k], fb[k2], fa[k2]);
    }
  }
  // the KNUCKLE where the tubes meet the axle
  const axis0 = [sgn, 0, 0];
  revolve(bags.alloy, off(axleIn, axis0, -0.026), axis0,
          [[0.020, 0], [0.034, 0.012], [0.034, 0.040], [0.026, 0.050]],
          16, true);
  const pivot = vee ? lerp3(pF, pR, 0.5) : feet[0][0];
  const F = FF;
  // THE SHOCK: from a second fitting up on the body down to the arm.
  // THE CUB'S CROSSED SHOCK STRUTS (user ask). On a J-3 the two shock
  // struts run up and INBOARD past the centreline, so head-on the gear
  // reads as an X under the belly rather than two separate vees. The
  // strut still carries the same bungee — only its upper fitting moves
  // to the far side. NOTE: modelled from the head-on X the user
  // described; if the real J-3 fitting is same-side, flip this back.
  const xTop = P.linkX > 0.5 ? -sgn : sgn;
  const sTop = fitFrame(AF, st.z + P.shockZ, xTop * P.shockAng * D2R);
  const top = off(sTop.p, sTop.n, 0.008 + 0.014);
  const foot = lerp3(vee ? pF : pivot, axleIn, clamp(P.shockAt, 0.15, 0.95));
  fitPad(bags, AF, st.z + P.shockZ, sgn * P.shockAng * D2R, 0.11, 0.10,
         { thick: 0.007 });
  const dir = nrm(sub(foot, top));
  const L = len(sub(foot, top));
  const mode = Math.round(P.shockKind);
  if (mode === 0) {                     // COIL-OVER
    const body = off(top, dir, L * 0.42);
    revolve(bags.alloy, top, dir, [[0.014, 0], [0.014, L * 0.44]], 14, true);
    revolve(bags.chrome, body, dir, [[0.009, 0], [0.009, L * 0.58]], 12, true);
    const turns = 7, NP = turns * 12;
    const e1 = nrm(sub([0, 1, 0], mul(dir, dot([0, 1, 0], dir))));
    const e2 = crs(dir, e1);
    const coil = [];
    for (let k = 0; k <= NP; k++) {
      const t = k / NP, a = 2 * Math.PI * turns * t, R = 0.028;
      coil.push(add(off(top, dir, L * (0.06 + 0.88 * t)),
                    add(mul(e1, Math.cos(a) * R), mul(e2, Math.sin(a) * R))));
    }
    sweep(bags.steel, coil, () => secRound(0.0055, 8), true);
  } else if (mode === 1) {
    // THE BUNGEE IS ONE CORD, WRAPPED (user: it was "only a set of
    // toruses"). A shock cord is lashed racetrack-wise round two pins —
    // straight down one side, round the lower pin, back up the other,
    // round the upper — turn after turn, each lying beside the last. So
    // it is a single continuous path swept once.
    const pinR = 0.026, turns = 7, gapT = 0.0085;
    const e1 = nrm(sub([0, 1, 0], mul(dir, dot([0, 1, 0], dir))));
    const e2 = crs(dir, e1);
    // the lashing is COMPACT and lives in the middle of the run; rods
    // carry the load out to the fuselage fitting and down to the strut
    const zA = clamp(0.5 - P.bungeeSpan * 0.5, 0.08, 0.45);
    const pinA = off(top, dir, L * zA);
    const pinB = off(top, dir, L * (zA + P.bungeeSpan));
    for (const p of [pinA, pinB])
      revolve(bags.alloy, add(p, mul(e2, -0.034)), e2,
              [[0.009, 0], [0.009, 0.068]], 12, true);
    taper(bags.steel, top, off(pinA, dir, 0.004), 0.011, 0.009, 12);
    taper(bags.steel, off(pinB, dir, -0.004), foot, 0.009, 0.011, 12);
    const path = [];
    for (let t = 0; t < turns; t++) {
      const o0 = (t - (turns - 1) / 2) * gapT;
      const o1 = (t + 1 - (turns - 1) / 2) * gapT;
      const lat = q => mul(e2, q);
      path.push(add(add(pinA, mul(e1, pinR)), lat(o0)));
      path.push(add(add(pinB, mul(e1, pinR)), lat(o0)));
      for (let k = 1; k < 7; k++) {          // round the lower pin
        const ang = Math.PI * k / 7;
        path.push(add(add(pinB, add(mul(e1, Math.cos(ang) * pinR),
                                    mul(dir, Math.sin(ang) * pinR))),
                      lat(o0 + (o1 - o0) * k / 14)));
      }
      path.push(add(add(pinB, mul(e1, -pinR)), lat(o0 + (o1 - o0) * 0.5)));
      path.push(add(add(pinA, mul(e1, -pinR)), lat(o0 + (o1 - o0) * 0.5)));
      for (let k = 1; k < 7; k++) {          // round the upper pin
        const ang = Math.PI * k / 7;
        path.push(add(add(pinA, add(mul(e1, -Math.cos(ang) * pinR),
                                    mul(dir, -Math.sin(ang) * pinR))),
                      lat(o0 + (o1 - o0) * (0.5 + k / 14))));
      }
    }
    sweep(bags.dark, resample(path, path.length * 2),
          () => secRound(0.0072, 8), true);
  } else {                              // RUBBER DONUT STACK
    revolve(bags.chrome, top, dir, [[0.008, 0], [0.008, L]], 12, true);
    for (let k = 0; k < 5; k++)
      revolve(bags.dark, off(top, dir, L * (0.16 + 0.62 * k / 5)), dir,
              [[0.010, 0], [0.030, 0.008], [0.030, L * 0.088],
               [0.010, L * 0.096]], 18, true);
  }
  for (const [p, r] of [[top, 0.016], [foot, 0.014]])
    revolve(bags.alloy, off(p, pax, -r), pax, [[r * 0.7, 0], [r * 0.7, r * 2]],
            12, true);
  const axis = [sgn, 0, 0];
  axleStub(bags, axleIn, axis, hubIn);
  return { axle, axis, root: FF.p, travel: nrm(crs(pax, sub(axle, pivot))) };
}

// (c) TELESCOPIC OLEO — a sliding piston in a cylinder, held in torsion
// by a SCISSOR link (the signature element), braced by a drag strut.
function legOleo(bags, AF, P, st, sgn) {
  const F = fitFrame(AF, st.z, sgn * P.oleoAng * D2R);
  const drop = st.drop, half = st.x;
  const trunn = off(F.p, F.n, 0.009 + P.oleoDia * 0.42);
  const axle = [sgn * half, AF.keelAt(st.z) - drop, st.z];
  const hubIn = st.R * 0.40 + 0.020;
  const axleIn = [axle[0] - sgn * hubIn, axle[1], axle[2]];
  const dir = nrm(sub(axleIn, trunn));
  const L = len(sub(axleIn, trunn));
  const Rc = P.oleoDia * 0.5;
  fitPad(bags, AF, st.z, sgn * P.oleoAng * D2R, 0.19, 0.15, { thick: 0.009 });
  // trunnion: two lugs and the pin the strut swings on
  const pax = nrm(crs(dir, F.fore));
  for (const s of [-1, 1])
    lug(bags.alloy, off(trunn, pax, s * (Rc + 0.016)), pax, mul(dir, -1),
        0.028, 0.011, 0.070);
  revolve(bags.bronze, off(trunn, pax, -Rc - 0.028), pax,
          [[0.012, 0], [0.012, 2 * Rc + 0.056]], 14, true);
  // cylinder (upper) and polished piston (lower)
  const cylL = L * clamp(P.oleoCyl, 0.30, 0.80);
  revolve(bags.alloy, trunn, dir,
          [[Rc * 0.72, 0], [Rc, Rc * 0.5], [Rc, cylL - Rc * 0.3],
           [Rc * 0.92, cylL]], 20, true);
  revolve(bags.chrome, off(trunn, dir, cylL - 0.004), dir,
          [[Rc * 0.62, 0], [Rc * 0.62, L - cylL - 0.02]], 16, true);
  // the wiper boot at the gland
  revolve(bags.dark, off(trunn, dir, cylL - 0.010), dir,
          [[Rc * 0.68, 0], [Rc * 0.86, 0.008], [Rc * 0.86, 0.026],
           [Rc * 0.68, 0.034]], 18, true);
  // THE TORQUE SCISSOR — two arms with a knuckle, on the forward face
  const fwd = nrm(sub(F.fore, mul(dir, dot(F.fore, dir))));
  const a0 = add(off(trunn, dir, cylL * 0.80), mul(fwd, Rc * 0.95));
  const a2 = add(off(trunn, dir, L - 0.055), mul(fwd, Rc * 0.80));
  const knee = add(lerp3(a0, a2, 0.5), mul(fwd, P.oleoScissor));
  for (const [p, q] of [[a0, knee], [knee, a2]]) {
    const path = resample([p, q], 4);
    sweep(bags.alloy, path, t => secBlade(0.030 - 0.006 * Math.abs(t - 0.5),
                                          0.011), true, pax);
  }
  for (const p of [a0, knee, a2])
    revolve(bags.bronze, off(p, pax, -0.012), pax,
            [[0.008, 0], [0.008, 0.024]], 10, true);
  // drag brace back into the structure
  if (P.oleoBrace) {
    const bTop = fitFrame(AF, st.z + P.oleoBraceZ, sgn * P.oleoAng * D2R * 0.6);
    const bp = off(bTop.p, bTop.n, 0.018);
    fitPad(bags, AF, st.z + P.oleoBraceZ, sgn * P.oleoAng * D2R * 0.6,
           0.10, 0.09, { thick: 0.006 });
    taper(bags.steel, bp, off(trunn, dir, cylL * 0.72), 0.013, 0.010, 12);
  }
  const axis = [sgn, 0, 0];
  axleStub(bags, axleIn, axis, hubIn);
  return { axle, axis, root: F.p, travel: mul(dir, -1) };
}

// ---- 3. STEERING: THE CASTOR MODULE ---------------------------------------
// The correction the tailwheel forced. A steerable/castoring wheel is NOT
// a leg — it is a swivel unit that hangs UNDER one, and the same module
// serves a tailwheel and a trike nosewheel.
//
// Rigorously: the swivel axis is RAKED (top forward) by `rake`, the axle
// sits behind it by `trail`, and it is that trail on a raked axis that
// makes the wheel follow and self-centre. Steering springs and chains run
// from the steering arm to the rudder horn; past `breakout` degrees the
// unit unlocks and free-castors.
function castorUnit(bags, P, top, sgn, R, steer, showLink) {
  const rake = P.twRake * D2R;
  // swivel axis: down, tilted top-forward (+z is the nose)
  const ax = nrm([0, -Math.cos(rake), Math.sin(rake)]);
  const fwd = nrm(sub([0, 0, 1], mul(ax, dot([0, 0, 1], ax))));
  const side = crs(ax, fwd);
  const yaw = steer * D2R;
  const F = v => rot(v, ax, yaw);            // steered frame
  // the housing on the swivel axis
  revolve(bags.alloy, top, ax,
          [[0.026, -0.010], [0.030, 0.004], [0.030, 0.052], [0.022, 0.062]],
          18, true);
  revolve(bags.bronze, off(top, ax, 0.060), ax,
          [[0.016, 0], [0.016, 0.020]], 14, true);
  // the fork: offset BEHIND the axis by trail, straddling the wheel
  const hub = add(off(top, ax, P.twLegDrop), mul(F(fwd), -P.twTrail));
  const yoke = off(top, ax, P.twLegDrop * 0.42);
  const yokeC = add(yoke, mul(F(fwd), -P.twTrail * 0.55));
  boxIn(bags.steel, yokeC, [0.030, 0.014, 0.026],
        F(side), ax, F(fwd));
  for (const s of [-1, 1]) {
    const legTop = add(yokeC, mul(F(side), s * (R * 0.46)));
    const legBot = add(hub, mul(F(side), s * (R * 0.46)));
    sweep(bags.steel, resample(fillet([off(yokeC, ax, -0.004), legTop, legBot],
                                      0.03), 10),
          t => secBlade(0.026 - 0.006 * t, 0.012), true, F(fwd));
  }
  taper(bags.alloy, add(hub, mul(F(side), -R * 0.56)),
        add(hub, mul(F(side), R * 0.56)), 0.011, 0.011, 12);
  // the STEERING ARM and its springs/chains to the rudder horn
  if (showLink && P.twSteerVis) {
    for (const s of [1, -1])
      sweep(bags.alloy, resample([off(top, ax, 0.030),
              add(add(off(top, ax, 0.030), mul(F(fwd), -0.010)),
                  mul(F(side), s * 0.052))], 4),
            () => secBlade(0.020, 0.008), true, ax);
    const horn = [0, top[1] + P.twHornY, top[2] + P.twHornZ];
    // THE TWO RUNS MUST NOT CROSS (user). The steering arm swings with
    // the wheel so its ends use the STEERED frame, but the rudder horn is
    // bolted to the fin and must use the UNSTEERED one — mixing them put
    // the port arm on the starboard horn and the runs crossed. There are
    // always two: one each side, spring at the wheel end, chain to the
    // horn.
    for (const s of [1, -1]) {
      const e = add(add(off(top, ax, 0.030), mul(F(fwd), -0.010)),
                    mul(F(side), s * 0.052));
      const h = add(horn, mul(side, s * 0.045));
      const d = nrm(sub(h, e)), Ls = len(sub(h, e));
      // spring at the wheel end, chain the rest
      const e1 = nrm(sub([0, 1, 0], mul(d, dot([0, 1, 0], d))));
      const e2 = crs(d, e1);
      const NP = 60, turns = 9, Rs = 0.011;
      const coil = [];
      for (let k = 0; k <= NP; k++) {
        const t = k / NP, a = 2 * Math.PI * turns * t;
        coil.push(add(off(e, d, Ls * 0.10 + Ls * 0.34 * t),
                      add(mul(e1, Math.cos(a) * Rs), mul(e2, Math.sin(a) * Rs))));
      }
      sweep(bags.steel, coil, () => secRound(0.0026, 6), true);
      taper(bags.steel, e, off(e, d, Ls * 0.10), 0.004, 0.004, 8);
      // THE CHAIN INTERLOCKS (user: "the circles do not interlock").
      // Links are OVAL, not round, they alternate 90 degrees, and each
      // sits back inside the last by a third of its length — spaced a
      // whole link apart they were just a row of loose rings.
      const c0 = off(e, d, Ls * 0.46), c1 = h;
      const run = len(sub(c1, c0));
      const lk = 0.026, lw = 0.011, wire = 0.0024;
      const step = lk * 0.62;
      const NL = Math.max(2, Math.round(run / step));
      for (let k = 0; k < NL; k++) {
        const p = lerp3(c0, c1, (k + 0.5) / NL);
        const per = (k % 2) ? e1 : e2;
        const path = [];
        const NR = 16;
        for (let j = 0; j <= NR; j++) {           // a stadium, not a circle
          const an = 2 * Math.PI * j / NR;
          const cs = Math.cos(an), sn = Math.sin(an);
          const along = Math.sign(cs) * Math.min(Math.abs(cs) / 0.72, 1)
                        * (lk / 2 - lw / 2);
          path.push(add(p, add(mul(d, along + cs * lw / 2),
                               mul(per, sn * lw / 2))));
        }
        sweep(bags.steel, path, () => secRound(wire, 6), false);
      }
      boxIn(bags.alloy, h, [0.006, 0.020, 0.010], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    }
  }
  return { hub, axis: F(side), ax, top, trail: P.twTrail };
}

// ---- THE TAILWHEEL ASSEMBLY ----------------------------------------------
// leaf-spring bending beam + castor unit + steering. Modelled as its own
// thing because it IS its own thing (user, 2026-08-19).
function legTailwheel(bags, AF, P, st) {
  // the station owns the wheel radius, as it does for every other leg —
  // a second `twR` alongside it was two names for one thing
  const F = fitFrame(AF, st.z, 0);
  const root = off(F.p, F.n, 0.008 + P.twSpringT * 0.5);
  const tipZ = st.z - P.twSpringLen;
  const tip = [0, AF.keelAt(st.z) - P.twSpringDrop, tipZ];
  const ctrl = [0, root[1] - P.twSpringDrop * 0.30,
                lerp3(root, tip, 0.55)[2]];
  const path = resample(bez(root, ctrl, tip, 12), 16);
  // A LEAF SPRING IS LAMINATED: 3 leaves, each shorter than the one above
  const leaves = Math.max(1, Math.round(P.twLeaves));
  for (let i = 0; i < leaves; i++) {
    const frac = 1 - i * 0.26;
    const seg = path.slice(0, Math.max(3, Math.round(path.length * frac)));
    sweep(bags.steel, seg,
          t => secBlade(P.twSpringW * (1 - 0.22 * t), P.twSpringT),
          true, [1, 0, 0]);
    // each leaf sits under the last
    for (let k = 0; k < seg.length; k++) seg[k] = seg[k];
  }
  fitPad(bags, AF, st.z, 0, P.twSpringW * 2.2, P.twSpringW * 1.6,
         { thick: 0.008 });
  boxIn(bags.alloy, off(root, F.n, P.twSpringT * leaves * 0.5 + 0.006),
        [P.twSpringW * 0.62, 0.010, 0.030], [1, 0, 0], F.n, F.fore);
  for (const s of [-1, 1])
    bolt(bags.alloy, off(add(root, mul(F.fore, s * 0.022)), F.n,
                         P.twSpringT * leaves * 0.5 + 0.016),
         mul(F.n, -1), 0.009, 0.024);
  // G58.3: a caller that wants the castor assembly separable (the cage
  // join yaws it for ground manoeuvring) passes `bags.castorBags`; the
  // bench and every other caller fall through unchanged.
  const u = castorUnit(bags.castorBags || bags, P, tip, 1, st.R,
                       P.twSteer, true);
  wheel(bags, u.hub, u.axis, st.R, { brake: false, P });
  // G58.7: the leaf spring's two ends — `root` bolts to the fuselage and
  // must not move; `tip` is the castor's swivel top. The join pins both.
  return { axle: u.hub, axis: u.axis, root, tip, travel: nrm([0, 1, 0.35]),
           castor: u };
}

window.GEAR_GEN = { MAT, gearMat, stubAirframe, drawStub, objAirframe, drawBody,
                    meshAirframe, cageAirframe, CAGE_MATS,
                    wheel, spat, fitFrame,
                    fitPad, legBeam, legLink, legOleo, castorUnit,
                    legTailwheel, Bag };
})();
