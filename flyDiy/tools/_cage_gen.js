// CAGE2 GENERATOR — parametric rebuild of templatePlaneProcedural_{0,1,2}.
// Throwaway prototype family (gitignored with _cage*), never in MANIFEST.
//
// THE MODEL. One closed all-quad control cage for Catmull-Clark, built as a
// STATION x LEVEL lattice. Nose at +z, tail at -z, y up, x mirrored.
//
//   LEVELS are the aeroplane's longitudinal feature lines, present on every
//   ring from the tail cap to wherever the line terminates:
//     keel, floor, waist (the widest line, y const), waistband top (y const —
//     a painted stripe must be straight), ceiling, roof
//   plus two derived GUARD lines (step 2) that pin Catmull-Clark:
//     waistG = lerp(waist, floor, gWaistT), bandG = lerp(band, ceil, gBandT)
//     — full-3D lerps, on every ring including caps, slope and centre chain.
//
//   STATIONS are anatomy: tail cap, tailpost, boom, passenger pillar, pax
//   bay(s), cabin pillar, pilot bay, window ring, A-pillar, windshield, cowl,
//   nose ring, nose cap. Pillars are TIGHT RING PAIRS; step 2 adds guard
//   rings as constant-t lerps of the two rings bounding their bay.
//
//   THE WINDSHIELD is not a special surface: the global lines continue onto a
//   slanted plane. Glass sits between the waistband line and the ceiling line
//   — the same rails the side windows use — the A-pillar is a full ring whose
//   upper half lies on the slope, and the waistband flows around the
//   windshield base. Forward of it the upper levels fold onto the centreline
//   chain; the cowl is a flat deck at waist level (no roof, no ceiling).
//
// Derivation rules measured off the reference (each verified to ~1e-5):
//   band x  = Ww - bandXFrac*(Ww - Wr)          bandXFrac 0.081740
//   ceil x  = Ww - ceilXFrac*(Ww - Wr)          ceilXFrac 0.939852
//   floor   = designed y; x,z lerped along the keel->waist wall
//   guards  = pure lerps (gWaistT 0.269721, gBandT 0.019837, per-bay t table)
//
// STEPS: 0 = zone cage (keel/waist/roof), 1 = + pillar twins + floor/ceiling/
// waistband rails, 2 = + guard rings + guard levels (the CC control mesh).
// Vertex sets nest across steps exactly as the reference files do.

'use strict';

// ---------------------------------------------------------------------------
// the template fiche — every number measured off templatePlaneProcedural_2
// ---------------------------------------------------------------------------
const CAGE_DEFAULT = {
  waistY: 0.091103,
  bandY: 0.153652,
  bandXFrac: 0.081740,
  ceilXFrac: 0.939852,
  gWaistT: 0.269721,
  gBandT: 0.019837,

  cabin: { halfW: 0.554104, roofHalfW: 0.431009, roofY: 1.0,
           keelY: -0.921275, ceilY: 0.939850, floorY: -0.497590 },

  // window ring: the windshield sill is narrower than the body
  ring: { z: 2.585791, waistHalfW: 0.531061, keelY: -0.915322,
          ceilY: 0.945212, floorY: -0.475468 },

  pilot: { len: 0.662567, guardT: 0.0410328 },       // pilCabB -> ring
  cabinPillarW: 0.100000,                            // 1.823224 -> 1.923224
  pax:   { count: 1, len: 1.756670, guardTA: 0.0199222, guardTB: 0.9767545 },
  paxPillarW: 0.075041,                              // -0.008487 -> 0.066554

  // aft-cabin section (where the boom leaves the cabin). A/B are the pillar's
  // two rings; keel and floor lean through the band, roof and ceiling do not.
  aft: { roofY: 0.677945, ceilY: 0.637167,
         keelYA: -0.646919, floorYA: -0.343252,
         keelYB: -0.656475, floorYB: -0.348627 },

  boom: { len: 3.983966, guardTA: 0.0071424, guardTB: 0.9902325 },

  tail: { len: 0.169815, midT: 0.531385, halfW: 0.053446,
          roofY: 0.5, keelY: -0.077750, ceilY: 0.469925, floorY: -0.023068 },

  // windshield assembly. front = the frame columns (planar base ring below
  // the waist); aft = the A-pillar's aft edge (a full ring, upper half on the
  // slope); chain = the centreline columns the slope folds onto.
  ws: {
    guardT: 0.9066628,                               // ring -> aft, step 2
    aft: { roofZ: 2.627455,
           ceil:  { y: 0.945632, z: 2.664685 },
           bandZ: 3.282856,
           waist: { x: 0.529256, z: 3.336194 },
           floorY: -0.425921,
           keel:  { y: -0.829859, z: 3.334202 } },
    front: { roofZ: 2.667615,
             ceil:  { y: 0.945700, z: 2.710438 },
             bandZ: 3.321350,
             waist: { x: 0.528965, z: 3.379546 },
             floorY: -0.417930,
             keelY: -0.816075 },
    chain: { ceil: { y: 0.945700, z: 2.839737 },
             bandZ: 3.834546,
             waistZ: 3.938426 },
  },

  // TOP SHAPE. round 0 = the box template (bit-identical path, guarded by the
  // fit). round 1 = the upper half of every ring lies on an ELLIPTICAL ARC
  // from the waist to a crown at roofY: ceil and roofF become arc samples at
  // angCeil/angRoof degrees, roofC becomes the crown. This is "relaxing the
  // rings": the ceiling loop stops hugging the roof (which is what held it
  // flat under CC) and the dome emerges. comp inflates the control points so
  // the CC limit surface lands on the intended arc (~3-5% for this spacing).
  // The waistband pair is NOT relaxed — the sill edge stays crisp, which is
  // what a bubble canopy on a round fuselage looks like. bubble 1 swaps the
  // ceiling-band and windshield top-frame materials to glass so the canopy
  // reads as one dome of glass from sill to crown.
  top: { round: 0, angCeil: 52, angRoof: 76, comp: 1.045, bubble: 0 },

  // crease weights per edge family (step 'crease' only). These replace the
  // guard-loop layer: same step-1 geometry, sharpness as a tag. >=1 = fully
  // sharp for that many subdivision levels, fractional = softer.
  // DISCIPLINE (G12.3 v3): crease lines must not cross — every crossing
  // pins a corner vertex and reads as a kink. So pillars default to 0 (the
  // tight ring PAIR holds them, the template's own mechanism), the rails
  // carry INTEGER weights, and window frames never touch the rails.
  crease: { pillar: 0, sill: 2, band: 1, ceil: 1, frame: 2, cap: 2,
            frontCap: 0.3 },

  // nose: designed per level; twin = pillarFront's aft ring. yC/zC are the
  // centre-column variants where the ring is not planar.
  nose: {
    twin: { deck:  { x: 0.527526, z: 3.994212, zC: 4.002276 },
            floor: { x: 0.529980, y: -0.368611, z: 3.992354 },
            keel:  { x: 0.312862, y: -0.706156, z: 3.990909,
                     yC: -0.708920, zC: 3.993562 } },
    ring: { deck:  { x: 0.527223, z: 4.025818, zC: 4.029000 },
            floor: { x: 0.527223, y: -0.364353, z: 4.023570,
                     yC: -0.365537, zC: 4.026767 },
            keel:  { x: 0.310118, y: -0.698364, z: 4.021821,
                     yC: -0.701709, zC: 4.025031 } },
  },
};

// band materials by bay pattern; bands named by their upper level
const CAGE_MAT = {
  plain: { roof: 'body', ceilB: 'ceilingLoop', glass: 'body', bandG: 'body',
           band: 'waistband', waistG: 'body', door: 'body',
           floorB: 'floorLoop', belly: 'body' },
  pax:   { roof: 'skyWindows', ceilB: 'ceilingLoop', glass: 'pasengerWindow',
           bandG: 'pasengerWindow', band: 'waistband', waistG: 'body',
           door: 'body', floorB: 'floorLoop', belly: 'body' },
  pilot: { roof: 'skyWindows', ceilB: 'ceilingLoop', glass: 'pilotWindow',
           bandG: 'pilotWindow', band: 'waistband', waistG: 'body',
           door: 'body', floorB: 'floorLoop', belly: 'body' },
};
const CAGE_PILLAR = m => ({ roof: m, ceilB: m, glass: m, bandG: m, band: m,
                            waistG: m, door: m, floorB: m, belly: m });
const isPillarMat = mat => mat.roof === mat.glass && mat.roof === mat.belly;

// ---------------------------------------------------------------------------
// resolve: spec -> ordered rings + bays + windshield/nose specials
// ---------------------------------------------------------------------------
function lerpLv(a, b, t) {
  const o = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
              z: a.z + (b.z - a.z) * t };
  if (a.yC != null || b.yC != null || a.zC != null || b.zC != null) {
    const ay = a.yC != null ? a.yC : a.y, by = b.yC != null ? b.yC : b.y;
    const az = a.zC != null ? a.zC : a.z, bz = b.zC != null ? b.zC : b.z;
    o.yC = ay + (by - ay) * t; o.zC = az + (bz - az) * t;
  }
  return o;
}
function lerpRing(A, B, t, name) {
  const lv = {};
  for (const k in A.lv) if (B.lv[k]) lv[k] = lerpLv(A.lv[k], B.lv[k], t);
  return { name, kind: A.kind, lv };
}

function cageResolve(S) {
  const c = S.cabin, W = c.halfW, Wr = c.roofHalfW;
  const bandX = (ww, wr) => ww - S.bandXFrac * (ww - wr);
  const ceilX = (ww, wr) => ww - S.ceilXFrac * (ww - wr);
  const TOP = S.top || { round: 0 };

  // blend a ring's upper (and, with botRound, lower) levels onto the
  // waist->crown arcs. Operates on the box-built lv IN PLACE; round 0
  // touches nothing. comp is faded in with sin(theta) so the waist stays
  // exactly at Ww and only the dome inflates against CC shrinkage.
  // Round top + round bottom = the full oval tube (sailplane pod, bizjet).
  function roundTop(lv, Ww, roofY, Wk, keelY) {
    const rT = TOP.round || 0, rB = TOP.botRound || 0;
    const arcTo = (ww, half, deg) => {
      const th = deg * Math.PI / 180;
      const k = 1 + (TOP.comp - 1) * Math.sin(th);
      return { x: ww * Math.cos(th) * k,
               y: S.waistY + half * Math.sin(th) * k };
    };
    const mix = (l, p, r, useYC) => {
      l.x = l.x + (p.x - l.x) * r;
      if (useYC) { if (l.yC == null) { l.yC = l.y; l.zC = l.z; }
                   l.yC = l.yC + (p.y - l.yC) * r; }
      else l.y = l.y + (p.y - l.y) * r;
    };
    const topH = roofY - S.waistY;
    if (rT && topH > 1e-6) {
      mix(lv.roof, arcTo(Ww, topH, 90), rT, true);       // crown (centre col)
      mix(lv.roof, arcTo(Ww, topH, TOP.angRoof), rT);
      mix(lv.ceil, arcTo(Ww, topH, TOP.angCeil), rT);
      const bt = Math.min(0.99, (S.bandY - S.waistY) / topH);
      const bx = Ww * Math.sqrt(1 - bt * bt);
      lv.band.x = lv.band.x + (bx - lv.band.x) * rT;     // band: x only
    }
    const wk = Wk != null ? Wk : Ww;
    const botH = (keelY != null ? keelY : lv.keel.y) - S.waistY;   // < 0
    if (rB && botH < -1e-6) {
      mix(lv.keel, arcTo(wk, botH, 90), rB, true);       // bottom crown
      mix(lv.keel, arcTo(wk, botH, TOP.angRoof), rB);
      mix(lv.floor, arcTo(wk, botH, TOP.angCeil), rB);
    }
    return lv;
  }

  function fullRing(name, z, d) {
    const Wk = d.Wk != null ? d.Wk : d.Ww;
    const wallT = (d.floorY - d.keelY) / (S.waistY - d.keelY);
    const lv = {
      roof:  { x: d.Wr, y: d.roofY, z },
      ceil:  { x: ceilX(d.Ww, d.Wr), y: d.ceilY, z },
      band:  { x: bandX(d.Ww, d.Wr), y: S.bandY, z },
      waist: { x: d.Ww, y: S.waistY, z },
      floor: { x: Wk + (d.Ww - Wk) * wallT, y: d.floorY, z },
      keel:  { x: Wk, y: d.keelY, z },
    };
    return { name, kind: 'full', lv: roundTop(lv, d.Ww, d.roofY, Wk, d.keelY) };
  }

  const rings = [], bays = [];
  const add = (R, bay) => { rings.push(R); bays.push(bay || null); };

  // bubble: the ceiling band joins the glass, so the canopy is glass from
  // the sill guard to the crown (skyWindows already reads as glazing)
  const MATS = TOP.bubble
    ? { pax:   { ...CAGE_MAT.pax, ceilB: 'pasengerWindow' },
        pilot: { ...CAGE_MAT.pilot, ceilB: 'pilotWindow' } }
    : CAGE_MAT;
  // skylight: the roof strip (skyWindows) is optional and has an EXTENT,
  // counted in window bays from the front (pilot bay = rank 0, then pax
  // bays going aft). Uncovered bays get plain body — and the win marks
  // below follow the materials, so the outlines always trace the REAL
  // glass: bubble+sky = one door-to-door arch per bay, sky only = side
  // windows + per-bay skylights, bubble only = taller side windows,
  // neither = the box sides. (Defaults sky on, ext all = the template.)
  const GL = S.glaze || { sky: 1, ext: 9 };
  const roofFor = rank =>
    (GL.sky && rank < GL.ext) ? MATS.pilot.roof : 'body';
  const matPilot = { ...MATS.pilot, roof: roofFor(0) };
  const matPax = i => ({ ...MATS.pax, roof: roofFor(S.pax.count - i) });

  const zPaxB = S.ring.z - S.pilot.len - S.cabinPillarW
              - S.pax.count * S.pax.len - (S.pax.count - 1) * S.paxPillarW;
  const zPaxA = zPaxB - S.paxPillarW;
  const zPost = zPaxA - S.boom.len;
  const zCap  = zPost - S.tail.len;

  const tailD = { Ww: S.tail.halfW, Wr: S.tail.halfW, roofY: S.tail.roofY,
                  ceilY: S.tail.ceilY, floorY: S.tail.floorY, keelY: S.tail.keelY };
  const aftDA = { Ww: W, Wr, roofY: S.aft.roofY, ceilY: S.aft.ceilY,
                  floorY: S.aft.floorYA, keelY: S.aft.keelYA };
  const aftDB = { Ww: W, Wr, roofY: S.aft.roofY, ceilY: S.aft.ceilY,
                  floorY: S.aft.floorYB, keelY: S.aft.keelYB };
  const cabD  = { Ww: W, Wr, roofY: c.roofY, ceilY: c.ceilY,
                  floorY: c.floorY, keelY: c.keelY };
  const ringD = { Ww: S.ring.waistHalfW, Wk: W, Wr, roofY: c.roofY,
                  ceilY: S.ring.ceilY, floorY: S.ring.floorY, keelY: S.ring.keelY };

  const CFG = S.config || {};
  add(fullRing('tailCap', zCap, tailD), { mat: CAGE_MAT.plain });
  // the tail pillar band is tailMid -> tailPost: with the unified pillar
  // width set, tailMid sits pillarW forward of the post (template midT
  // placement otherwise — fit identity path)
  add(fullRing('tailMid', S.pillarW > 0
      ? Math.max(zCap + 0.05 * S.tail.len, zPost - S.pillarW)
      : zCap + S.tail.midT * S.tail.len, tailD),
      { mat: CAGE_PILLAR('pillarTail') });
  add(fullRing('tailPost', zPost, tailD),
      { mat: CAGE_MAT.plain,
        guards: CFG.boomMid ? null : [S.boom.guardTA, S.boom.guardTB] });
  // optional mid-boom control ring: the sailplane pod-to-boom pinch. The
  // boom is a single CC span otherwise, which cannot waist.
  if (CFG.boomMid) {
    const t = CFG.boomMid.t, p = CFG.boomMid.pinch;
    const lp = (a, b) => a + (b - a) * (1 - t);      // 1-t: from aft toward tail
    const sq = y => S.waistY + (y - S.waistY) * p;
    add(fullRing('boomMid', zPost + t * S.boom.len, {
      Ww: lp(aftDA.Ww, tailD.Ww) * p, Wr: lp(aftDA.Wr, tailD.Wr) * p,
      roofY: sq(lp(aftDA.roofY, tailD.roofY)),
      ceilY: sq(lp(aftDA.ceilY, tailD.ceilY)),
      floorY: sq(lp(aftDA.floorY, tailD.floorY)),
      keelY: sq(lp(aftDA.keelY, tailD.keelY)),
    }), { mat: CAGE_MAT.plain });
  }
  add(fullRing('pilPaxA', zPaxA, aftDA), { mat: CAGE_PILLAR('pillarPassenger') });
  let z = zPaxB;
  for (let i = 0; i < S.pax.count; i++) {
    add(fullRing('pilPaxB' + (i || ''), z, i ? cabD : aftDB),
        { mat: matPax(i), guards: [S.pax.guardTA, S.pax.guardTB] });
    z += S.pax.len;
    if (i < S.pax.count - 1) {
      add(fullRing('pilPaxM' + i, z, cabD),
          { mat: CAGE_PILLAR('pillarPassenger') });
      z += S.paxPillarW;
    }
  }
  add(fullRing('pilCabA', z, cabD), { mat: CAGE_PILLAR('pillarCabin') });
  add(fullRing('pilCabB', z + S.cabinPillarW, cabD),
      { mat: matPilot, guards: [S.pilot.guardT] });

  // ---- AERO NOSE (bizjet / sailplane / pusher front) ----------------------
  // No fold at the windshield: the full rings continue through the screen
  // zone and a shrinking, drooping cone to a front grid cap. The windshield
  // is a MATERIAL ZONE on the upper bands — a transparent region of one
  // continuous surface, which is how a C172/bizjet/sailplane front works.
  if (CFG.noseMode === 'aero') {
    const A = CFG.aero;
    const wsZone = { roof: TOP.bubble ? 'skyWindows' : 'body',
      ceilB: 'windshield', glass: 'windshield', bandG: 'windshield',
      band: 'waistband', waistG: 'body', door: 'body',
      floorB: 'floorLoop', belly: 'body' };
    const z0 = S.ring.z, zWs = z0 + A.wsLen, zTip = zWs + A.len;
    const ringAt = (name, zz) => {
      const f = Math.min(1, (zz - z0) / (zTip - z0));
      // ellipse-quadrant taper: slope 0 at the cabin, steep at the tip —
      // the outline stays CONVEX and merges into a point (the smoothstep it
      // replaces plateaued at the tip while the droop kept pulling down,
      // which read concave)
      const e = 1 - Math.sqrt(Math.max(0, 1 - f * f));
      const dy = -A.droop * f * f;
      const scW = 1 - (1 - A.tipW) * e, scH = 1 - (1 - A.tipH) * e;
      const R = fullRing(name, zz, {
        Ww: S.ring.waistHalfW * scW, Wk: W * scW, Wr: Wr * scW,
        roofY: S.waistY + (c.roofY - S.waistY) * scH,
        ceilY: S.waistY + (S.ring.ceilY - S.waistY) * scH,
        floorY: S.waistY + (S.ring.floorY - S.waistY) * scH,
        keelY: S.waistY + (S.ring.keelY - S.waistY) * scH,
      });
      for (const k in R.lv) { R.lv[k].y += dy;
        if (R.lv[k].yC != null) R.lv[k].yC += dy; }
      return R;
    };
    add(fullRing('ring', z0, ringD), { mat: wsZone });
    add(ringAt('aeroWsA', zWs), { mat: CAGE_PILLAR('pillarWindow') });
    add(ringAt('aeroWsB', zWs + A.pillarW), { mat: CAGE_MAT.plain });
    add(ringAt('noseMid', zWs + A.pillarW
        + (zTip - zWs - A.pillarW) * 0.55), { mat: CAGE_MAT.plain });
    add(ringAt('noseTip', zTip), null);
    return { rings, bays, aero: true };
  }

  add(fullRing('ring', S.ring.z, ringD),
      { mat: matPilot, guards: [S.ws.guardT] });

  // windshield rings (upper levels on the slope, keel band slightly slanted).
  // `lift` rounds the BASE OF THE WINDSHIELD VERTICALLY: the base edge (and
  // the waistband with it) rises above the waist line, so the section below
  // the glass has more arc to cover and the nose gets round — like a real
  // cowl shoulder. The lift fades aft through the quarter-window bay.
  const wa = S.ws.aft, wf = S.ws.front;
  const BL = S.ws.baseLift || 0;
  const slopeRing = (name, roofZ, ceil, bandZ, waist, floorY, keel,
                     keelPlanar, lift) => {
    const kl = keelPlanar
      ? { x: W, y: keel.y, z: waist.z, yC: keel.y, zC: waist.z }
      : { x: W, y: keel.y, z: keel.z, yC: keel.y, zC: keel.z };
    const wl = { x: waist.x, y: S.waistY + (lift || 0), z: waist.z };
    const t = (floorY - kl.y) / (wl.y - kl.y);
    const lv = {
      roof:  { x: Wr, y: c.roofY, z: roofZ },
      ceil:  { x: ceilX(waist.x, Wr), y: ceil.y, z: ceil.z },
      band:  { x: bandX(waist.x, Wr), y: S.bandY + (lift || 0), z: bandZ },
      waist: wl,
      floor: { x: kl.x + (wl.x - kl.x) * t, y: floorY,
               z: kl.z + (wl.z - kl.z) * t },
      keel:  kl,
    };
    return { name, kind: 'full', lv: roundTop(lv, waist.x, c.roofY, W, kl.y) };
  };
  // the base lift ramps LINEARLY in z from the window ring (lift 0) to
  // the windshield base (full BL) — the old hand constant 0.85 made the
  // rise rate jump ~3x across the narrow A-pillar band, and higher
  // subsurf levels resolved that as a pinch in the sill fold (user
  // report at L3). Geometric ramp = one straight sill line, no kink.
  const liftT = Math.max(0, Math.min(1,
    (wa.waist.z - S.ring.z) / Math.max(1e-9, wf.waist.z - S.ring.z)));
  add(slopeRing('wsAft', wa.roofZ, wa.ceil, wa.bandZ, wa.waist, wa.floorY,
                wa.keel, false, BL * liftT),
      { mat: CAGE_PILLAR('pillarWindow') });
  add(slopeRing('wsFront', wf.roofZ, wf.ceil, wf.bandZ, wf.waist, wf.floorY,
                { y: wf.keelY }, true, BL), null);

  const chain = {
    ceil:  { x: 0, y: S.ws.chain.ceil.y, z: S.ws.chain.ceil.z },
    band:  { x: 0, y: S.bandY, z: S.ws.chain.bandZ },
    waist: { x: 0, y: S.waistY, z: S.ws.chain.waistZ },
  };
  // NOSE CROWN: the deck centreline rises so the cowl top is CONVEX (a
  // round nose in the BASE topology — no alternate geometry). The lift
  // fades toward the ceiling line so the windshield centre profile stays
  // monotone: the glass base curves up over the crown, which is the
  // "gracious link" — the base frame arches over the rounded cowl.
  const CROWN = CFG.noseCrown || 0;
  if (CROWN + BL) {
    const lift = y => (CROWN + BL) * Math.max(0,
      (chain.ceil.y - y) / (chain.ceil.y - S.waistY || 1e-9));
    chain.band = { ...chain.band, y: chain.band.y + lift(chain.band.y) };
    chain.waist = { ...chain.waist, y: chain.waist.y + lift(chain.waist.y) };
  }
  // in round mode the chain's ceil (the glass-band edge across the front)
  // levels out with the rounded ceiling of the windshield frame
  if (TOP.round) {
    const th = TOP.angCeil * Math.PI / 180;
    const k = 1 + (TOP.comp - 1) * Math.sin(th);
    const yR = S.waistY + (c.roofY - S.waistY) * Math.sin(th) * k;
    chain.ceil.y = chain.ceil.y + (yR - chain.ceil.y) * TOP.round;
  }

  const ND = S.nose.droop || 0;
  const noseLv = n => ({
    waist: { x: n.deck.x, y: S.waistY - ND, z: n.deck.z,
             yC: S.waistY + CROWN - ND, zC: n.deck.zC },
    floor: { x: n.floor.x, y: n.floor.y, z: n.floor.z,
             yC: n.floor.yC != null ? n.floor.yC : n.floor.y,
             zC: n.floor.zC != null ? n.floor.zC : n.floor.z },
    keel:  { x: n.keel.x, y: n.keel.y, z: n.keel.z,
             yC: n.keel.yC != null ? n.keel.yC : n.keel.y,
             zC: n.keel.zC != null ? n.keel.zC : n.keel.z },
  });
  const noseTwin = { name: 'noseTwin', kind: 'nose', lv: noseLv(S.nose.twin) };
  const noseRing = { name: 'noseRing', kind: 'nose', lv: noseLv(S.nose.ring) };

  return { rings, bays, chain, noseTwin, noseRing };
}

// ---------------------------------------------------------------------------
// emit: resolved structure -> {V, F} for one step
// ---------------------------------------------------------------------------
const STEP0_DROP = new Set(['tailMid', 'pilPaxA', 'pilCabB', 'wsAft']);

// step: 0 zones | 1 pillars+rails | 2 guard loops | 'crease' = step-1
// geometry + edge crease tags (the canonical economic output)
function buildCage2(S, step) {
  const creaseMode = step === 'crease';
  const sv = creaseMode ? 1 : step;               // structural step
  const CW = S.crease || {};
  const R = cageResolve(S);
  const LV = sv === 0 ? ['roof', 'waist', 'keel']
    : sv === 1 ? ['roof', 'ceil', 'band', 'waist', 'floor', 'keel']
    : ['roof', 'ceil', 'bandG', 'band', 'waist', 'waistG', 'floor', 'keel'];

  // ---- ring sequence for this step ---------------------------------------
  const STEP0_XTRA = new Set(['aeroWsB', 'noseMid', 'boomMid']);
  const kept = [], keptBay = [];
  R.rings.forEach((r, i) => {
    if (sv === 0 && (STEP0_DROP.has(r.name) || STEP0_XTRA.has(r.name))) return;
    kept.push(r); keptBay.push(i);
  });
  // bay for each kept pair: when pillar rings drop (step 0) the pillar bay
  // merges into its zone neighbour — keep the non-pillar material
  const bays = [];
  for (let k = 0; k < kept.length - 1; k++) {
    const i0 = keptBay[k], i1 = keptBay[k + 1];
    let mat = null, guards = null;
    for (let i = i0; i < i1; i++) {
      const b = R.bays[i] || { mat: CAGE_MAT.plain };
      if (mat === null || !isPillarMat(b.mat)) { mat = b.mat; guards = b.guards; }
    }
    bays.push({ mat, guards: sv >= 2 ? guards : null });
  }

  const seq = [], bayOf = [];
  for (let k = 0; k < kept.length; k++) {
    seq.push(kept[k]);
    if (k < kept.length - 1) {
      const b = bays[k];
      if (b.guards)
        for (const t of b.guards)
          seq.push(lerpRing(kept[k], kept[k + 1], t, kept[k].name + '+g'));
      const subs = 1 + (b.guards ? b.guards.length : 0);
      for (let s = 0; s < subs; s++) bayOf.push(b.mat);
    }
  }

  // guard levels on every ring (step 2)
  if (sv >= 2) for (const r of seq) {
    r.lv = { ...r.lv };
    r.lv.bandG = lerpLv(r.lv.band, r.lv.ceil, S.gBandT);
    r.lv.waistG = lerpLv(r.lv.waist, r.lv.floor, S.gWaistT);
  }

  // ---- vertices -----------------------------------------------------------
  const V = [], F = [];
  const vid = new Map();
  const P = (x, y, z) => {
    if (Math.abs(x) < 1e-9) x = 0;
    const k = x.toFixed(6) + ',' + y.toFixed(6) + ',' + z.toFixed(6);
    if (vid.has(k)) return vid.get(k);
    V.push([x, y, z]); vid.set(k, V.length - 1);
    return V.length - 1;
  };
  const face = (a, b, c, d, m) => F.push({ v: [a, b, c, d], m });
  // crease tags (step 'crease' only): max weight wins on shared edges
  const E = creaseMode ? new Map() : null;
  const tagE = (a, b, w) => {
    if (!E || !w || a === b || a == null || b == null) return;
    const k = cageEdgeKey(a, b);
    if (!(E.get(k) >= w)) E.set(k, w);
  };
  // the full ordered cycle of a ring's vertex ids, for perimeter creases
  const loopIds = (o, r) => {
    const lv = LV.filter(k => r.lv[k] != null);
    const out = [];
    if (o.C[lv[0]] != null) out.push(o.C[lv[0]]);
    for (const k of lv) if (o.P[k] != null) out.push(o.P[k]);
    if (o.C[lv[lv.length - 1]] != null) out.push(o.C[lv[lv.length - 1]]);
    for (let i = lv.length - 1; i >= 0; i--)
      if (o.M[lv[i]] != null) out.push(o.M[lv[i]]);
    return out;
  };
  const tagLoop = (o, r, w) => {
    const l = loopIds(o, r);
    for (let i = 0; i < l.length; i++) tagE(l[i], l[(i + 1) % l.length], w);
  };

  const mkIds = (r, capRing) => {
    const o = { P: {}, M: {}, C: {} };
    for (const k of LV) {
      const l = r.lv[k];
      if (!l) continue;
      o.P[k] = P(l.x, l.y, l.z);
      o.M[k] = P(-l.x, l.y, l.z);
      if (k === 'roof' || k === 'keel' || k === 'waist' && r.kind === 'nose'
          || capRing)
        o.C[k] = P(0, l.yC != null ? l.yC : l.y, l.zC != null ? l.zC : l.z);
    }
    return o;
  };
  const ids = seq.map((r, i) =>
    mkIds(r, i === 0 || (R.aero && i === seq.length - 1)));

  // level order present on a ring, top -> bottom
  const ordOf = r => LV.filter(k => r.lv[k] != null);

  // ---- cap grids ----------------------------------------------------------
  // One mechanism for both fuselage ends. 'aperture' = the engine face
  // (pusher rear / later the cowl front): the whole face reads as the
  // pillarFront panel; the crease weight on the cap ring decides dome
  // (low, aero radome) vs flat cut (high).
  const capMat = aperture => (hi, lo) =>
      aperture ? 'pillarFront'
    : hi === 'roof' && lo === 'ceil' ? 'ceilingLoop'
    : hi === 'floor' ? 'floorLoop'
    : hi === 'band' && lo === 'waist' ? 'waistband'
    : 'body';
  const emitCap = (o, r, mf, mark) => {
    const pres = ordOf(r);
    for (let i = 0; i < pres.length - 1; i++) {
      const hi = pres[i], lo = pres[i + 1], m = mf(hi, lo);
      face(o.P[hi], o.P[lo], o.C[lo], o.C[hi], m);
      face(o.C[hi], o.C[lo], o.M[lo], o.M[hi], m);
      // aperture caps are marked so the interior pass can back them with
      // a firewall panel (crease mode only, like the win/door marks)
      if (mark && creaseMode)
        F[F.length - 1].capFace = F[F.length - 2].capFace = 1;
    }
  };
  emitCap(ids[0], seq[0], capMat(S.config && S.config.rearAperture),
          !!(S.config && S.config.rearAperture));

  // ---- bridge the ring sequence ------------------------------------------
  const bandMat = (mat, hi, lo) =>
      hi === 'roof' ? (lo === 'ceil' ? mat.ceilB : mat.glass)  // step 0: roof->waist
    : hi === 'ceil' ? mat.glass
    : hi === 'bandG' ? mat.bandG
    : hi === 'band' ? mat.band
    : hi === 'waist' ? (lo === 'waistG' ? mat.waistG : mat.door)
    : hi === 'waistG' ? mat.door
    : mat.floorB;                                              // floor->keel
  for (let i = 0; i < seq.length - 1; i++) {
    const a = ids[i], b = ids[i + 1], mat = bayOf[i];
    face(a.C.roof, b.C.roof, b.P.roof, a.P.roof, mat.roof);
    face(a.M.roof, b.M.roof, b.C.roof, a.C.roof, mat.roof);
    // the roof strip is glass when the skylight covers this bay; marking
    // it joins the two sides across the centreline, so bubble + skylight
    // union-finds into ONE door-to-door arch per bay
    if (creaseMode && mat.roof === 'skyWindows')
      F[F.length - 1].win = F[F.length - 2].win = 1;
    const sh = ordOf(seq[i]).filter(k => seq[i + 1].lv[k] != null);
    for (let k = 0; k < sh.length - 1; k++) {
      const hi = sh[k], lo = sh[k + 1], m = bandMat(mat, hi, lo);
      face(a.P[hi], b.P[hi], b.P[lo], a.P[lo], m);
      face(a.M[lo], b.M[lo], b.M[hi], a.M[hi], m);
      // zone marks (crease mode only). win = any glass band (side windows,
      // aero windscreen). door = THE WHOLE DOOR (user spec): it encompasses
      // the window and runs from the window top down to almost the bottom
      // of the plane — glass + waistband + door band (+ the floor band when
      // 'deep'), pillar to pillar; only the thin ceiling band remains above
      // it. Doors on the pilot bay and, optionally, every pax bay.
      if (creaseMode) {
        // any band in a glass material is window: the ceil band always,
        // and the ceiling band (hi 'roof' -> ceilB) when bubble routes it
        // to the bay glass — marks follow materials, never a level list
        if (m === 'pilotWindow' || m === 'pasengerWindow'
            || m === 'windshield')
          F[F.length - 1].win = F[F.length - 2].win = 1;
        const D = (S.config && S.config.doors) || {};
        const bayName = seq[i].name;
        // the pilot door spans pillar to pillar in the REAL sense: from the
        // cabin pillar forward THROUGH the quarter bay to the A-pillar, so
        // its front edge follows the windshield slant (user's yellow
        // outline). The quarter bay starts at the window ring.
        const doorBay = !isPillarMat(mat) &&
          ((D.pilot && mat.glass === 'pilotWindow'
            && (/^pilCab/.test(bayName) || bayName === 'ring'))
           || (D.pax && mat.glass === 'pasengerWindow'
               && /^pilPax[BM]/.test(bayName)));
        if (doorBay && (hi === 'ceil' || hi === 'band' || hi === 'waist'
            || (D.deep && hi === 'floor'))) {
          F[F.length - 1].door = F[F.length - 2].door = 1;
          // door identity: which door this face belongs to, so each door
          // can carry its own sill ('pilot', 'pax0', 'pax1', ...)
          const dk = mat.glass === 'pilotWindow' ? 'pilot'
            : 'pax' + (parseInt(bayName.slice(7), 10) || 0);
          F[F.length - 1].doorKey = F[F.length - 2].doorKey = dk;
        }
      }
    }
    face(a.P.keel, b.P.keel, b.C.keel, a.C.keel, mat.belly);
    face(a.C.keel, b.C.keel, b.M.keel, a.M.keel, mat.belly);
    // longitudinal rails: the sill (waist) and waistband-top lines stay
    // crisp the whole length — this is what the guard levels did. The ceil
    // rail gets a gentle continuous crease too: it anchors the top edge of
    // the window zones (else the dome above pulls the boundary past the
    // pinned window frames and the reveal band folds).
    if (E) for (const [k, w] of [['waist', CW.sill], ['band', CW.band],
                                 ['ceil', CW.ceil]]) {
      if (a.P[k] != null && b.P[k] != null) {
        tagE(a.P[k], b.P[k], w);
        tagE(a.M[k], b.M[k], w);
      }
    }
  }
  // ring-loop creases: pillar bands, caps and the windshield frame — what
  // the guard RINGS did. The window ring itself stays untagged (the
  // template left it unguarded: glass on both sides).
  if (E) {
    const fam = nm =>
        nm === 'tailCap' ? CW.cap
      : nm === 'tailMid' || nm === 'tailPost' ? CW.pillar
      : /^pilPax/.test(nm) || /^pilCab/.test(nm) ? CW.pillar
      : nm === 'wsAft' || nm === 'wsFront' ? CW.frame
      : /^aeroWs/.test(nm) ? CW.frame
      : nm === 'noseTip' ? (CW.frontCap != null ? CW.frontCap : 0.3)
      : 0;
    seq.forEach((r, i) => { const w = fam(r.name); if (w) tagLoop(ids[i], r, w); });
  }

  // ---- forward end --------------------------------------------------------
  // aero mode: the rings already ran to the tip — close with the front cap
  if (R.aero) {
    emitCap(ids[seq.length - 1], seq[seq.length - 1], capMat(false));
    orientCage({ V, F });
    return E ? { V, F, E } : { V, F };
  }

  // ---- windshield slope + deck + cowl + nose (cowl mode) ------------------
  {
    const iF = seq.length - 1;                 // wsFront is last in seq
    const a = ids[iF];
    // centre chain
    const chLv = sv >= 2 ? ['ceil', 'bandG', 'band', 'waist']
               : sv === 1 ? ['ceil', 'band', 'waist'] : ['waist'];
    const chAll = { ...R.chain };
    if (sv >= 2) chAll.bandG = lerpLv(chAll.band, chAll.ceil, S.gBandT);
    const chain = { roof: a.C.roof };
    for (const k of chLv) chain[k] = P(0, chAll[k].y, chAll[k].z);
    // slope bands: wsFront flank columns fold to the chain
    const sOrd = ['roof'].concat(chLv);
    const bub = S.top && S.top.bubble;
    const slopeMat = (hi, lo) =>
        hi === 'roof' ? (lo === 'ceil' && !bub ? 'ceilingLoop' : 'windshield')
      : hi === 'ceil' || hi === 'bandG' ? 'windshield'
      : 'waistband';
    for (let k = 0; k < sOrd.length - 1; k++) {
      const hi = sOrd[k], lo = sOrd[k + 1], m = slopeMat(hi, lo);
      face(a.P[hi], a.P[lo], chain[lo], chain[hi], m);
      face(chain[hi], chain[lo], a.M[lo], a.M[hi], m);
      // the windshield glass gets a joint too; left and right share the
      // centre-chain edges so the union-find yields ONE zone with one
      // outline around the whole screen
      if (creaseMode && m === 'windshield')
        F[F.length - 1].win = F[F.length - 2].win = 1;
    }
    // the rails continue across the slope: sill = the windshield base edge
    if (E) for (const [k, w] of [['waist', CW.sill], ['band', CW.band],
                                 ['ceil', CW.ceil]]) {
      if (a.P[k] != null && chain[k] != null) {
        tagE(a.P[k], chain[k], w);
        tagE(chain[k], a.M[k], w);
      }
    }

    // nose rings (waist = the deck edge; centre cols via yC/zC)
    const noseSeq = [];
    const prepNose = src => {
      const r = { name: src.name, kind: 'nose', lv: { ...src.lv } };
      if (sv === 0) delete r.lv.floor;
      if (sv >= 2) r.lv.waistG = lerpLv(r.lv.waist, r.lv.floor, S.gWaistT);
      return r;
    };
    // THE COWL PROFILE — one parametric mechanism for both nose finishes.
    // N sample loops interpolate the windshield-base section toward the
    // nose ring along z, with the DIMS eased by an ellipse blend: ease 0 =
    // straight loft (engine nose), ease 1 = fat-then-fast convex (aero).
    // z advances linearly while dims lag, so the outline bulges outward —
    // never concave. finish 'engine' keeps the twin ring + pillarFront
    // band + flat-ish cap (the firewall face; the game's cowl assembly
    // bolts on there). finish 'aero' skips the aperture band and ends in
    // a tiny drooped ring + domed cap: the FINAL nose, nicely convex.
    const CFGb = S.config || {};
    const aeroFin = CFGb.noseFinish === 'aero';
    const cowl = CFGb.cowl || { loops: 0, ease: 0, bulge: 1 };
    const wsLv = seq[iF].lv;
    const wsLow = {
      waist: { x: wsLv.waist.x, y: wsLv.waist.y, z: wsLv.waist.z,
               yC: chAll.waist.y, zC: chAll.waist.z },
      floor: { x: wsLv.floor.x, y: wsLv.floor.y, z: wsLv.floor.z,
               yC: wsLv.floor.y, zC: wsLv.floor.z },
      keel:  wsLv.keel,
    };
    if (cowl.loops > 0 && sv >= 1) {
      const target = (aeroFin ? R.noseRing : R.noseTwin).lv;
      for (let i = 1; i <= cowl.loops; i++) {
        const t = i / (cowl.loops + 1);
        const e = t * (1 - cowl.ease)
                + (1 - Math.sqrt(Math.max(0, 1 - t * t))) * cowl.ease;
        const bg = 1 + (cowl.bulge - 1) * Math.sin(Math.PI * t);
        const lv = {};
        for (const k of ['waist', 'floor', 'keel']) {
          lv[k] = lerpLv(wsLow[k], target[k], e);
          // dims follow the eased blend, z stays linear — that lag IS the
          // convexity
          lv[k].z = wsLow[k].z + (target[k].z - wsLow[k].z) * t;
          if (lv[k].zC != null) {
            const az = wsLow[k].zC != null ? wsLow[k].zC : wsLow[k].z;
            const bz = target[k].zC != null ? target[k].zC : target[k].z;
            lv[k].zC = az + (bz - az) * t;
          }
        }
        const wY = lv.waist.y, wYC = lv.waist.yC;
        for (const k of ['floor', 'keel']) {
          lv[k].x *= bg;
          lv[k].y = wY + (lv[k].y - wY) * bg;
          if (lv[k].yC != null) lv[k].yC = wYC + (lv[k].yC - wYC) * bg;
        }
        lv.waist.x *= bg;
        noseSeq.push(prepNose({ name: 'cowlLoop' + i, lv }));
      }
    }
    if (sv >= 1 && !aeroFin) noseSeq.push(prepNose(R.noseTwin));
    noseSeq.push(prepNose(R.noseRing));
    const nIds = noseSeq.map((r, i) => mkIds(r, i === noseSeq.length - 1));

    // low bands: wsFront -> [cowl loops] -> [twin] -> ring; deck at waist
    const lowSets = [];
    lowSets.push({ a: { P: a.P, M: a.M, C: { waist: chain.waist, keel: a.C.keel } },
                   b: nIds[0], mat: CAGE_MAT.plain, deck: 'body' });
    for (let i = 0; i + 1 < nIds.length; i++) {
      const pf = !aeroFin && noseSeq[i + 1].name === 'noseRing';
      lowSets.push({ a: nIds[i], b: nIds[i + 1],
                     mat: pf ? CAGE_PILLAR('pillarFront') : CAGE_MAT.plain,
                     deck: pf ? 'pillarFront' : 'body' });
    }
    const lowOrd = LV.filter(k =>
      k === 'waist' || k === 'waistG' || k === 'floor' || k === 'keel');
    for (const s of lowSets) {
      face(s.a.P.waist, s.b.P.waist, s.b.C.waist, s.a.C.waist, s.deck);
      face(s.a.C.waist, s.b.C.waist, s.b.M.waist, s.a.M.waist, s.deck);
      const sh = lowOrd.filter(k => s.a.P[k] != null && s.b.P[k] != null);
      for (let k = 0; k < sh.length - 1; k++) {
        const hi = sh[k], lo = sh[k + 1];
        const m = hi === 'floor' ? s.mat.floorB : s.mat.door;
        face(s.a.P[hi], s.b.P[hi], s.b.P[lo], s.a.P[lo], m);
        face(s.a.M[lo], s.b.M[lo], s.b.M[hi], s.a.M[hi], m);
      }
      face(s.a.P.keel, s.b.P.keel, s.b.C.keel, s.a.C.keel, s.mat.belly);
      face(s.a.C.keel, s.b.C.keel, s.b.M.keel, s.a.M.keel, s.mat.belly);
      // the sill continues as the cowl deck edge
      if (E) { tagE(s.a.P.waist, s.b.P.waist, CW.sill);
               tagE(s.a.M.waist, s.b.M.waist, CW.sill); }
    }

    // nose cap grid
    {
      const o = nIds[nIds.length - 1];
      const pres = lowOrd.filter(k => o.P[k] != null);
      const engineCap = !aeroFin;      // engine aperture face -> firewall
      for (let k = 0; k < pres.length - 1; k++) {
        const hi = pres[k], lo = pres[k + 1];
        const m = hi === 'floor' ? 'floorLoop' : 'body';
        face(o.P[hi], o.P[lo], o.C[lo], o.C[hi], m);
        face(o.C[hi], o.C[lo], o.M[lo], o.M[hi], m);
        if (engineCap && creaseMode)
          F[F.length - 1].capFace = F[F.length - 2].capFace = 1;
      }
    }
    // nose ring creases: the twin band is a pillar, the end ring a cap edge
    // (own family so a round nose can dome while the tail cap stays crisp);
    // an intermediate cowl loop stays smooth
    if (E) noseSeq.forEach((r, i) => {
      if (r.name === 'noseTwin') tagLoop(nIds[i], r, CW.pillar);
      if (r.name === 'noseRing')
        tagLoop(nIds[i], r, CW.noseCap != null ? CW.noseCap : CW.cap);
    });
  }
  if (E) tagLoop(ids[0], seq[0], CW.cap);        // tail cap edge

  orientCage({ V, F });
  const out = E ? { V, F, E } : { V, F };
  if (creaseMode) cageWindows(out, S);
  // NOTE: cageRims is NOT called here — the rim joints are swept from the
  // mesh AT ITS DISPLAYED SUBSURF LEVEL (call cageRims(mesh, spec) after
  // subdividing), so the bead follows the real surface polyline exactly.
  return out;
}

// ---------------------------------------------------------------------------
// WINDOW JOINTS — the rim strategy (user ruling after the inset detour):
// windows stay MATERIAL ZONES on the untouched surface; the joint is a
// separate closed tube bead swept along the zone outline at the LIMIT
// surface — clean geometry that cannot fight the subsurf. Same idiom as the
// game's cframe/gframe canopy rails. Door zones get the same bead (a seal).
// ---------------------------------------------------------------------------
function cageRims(m, S) {
  const W = S.win;
  if (!W) return m;
  const { V, F } = m;
  const E = m.E || new Map();
  const sub = (A, B) => [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1;
                     return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2],
                           a[0]*b[1]-a[1]*b[0]];

  // adjacency + crease-aware limit stencil (same rules as the inset pass)
  const vEdges = new Map(), vFaces = new Map();
  const seenE = new Set();
  for (const f of F) {
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k], b = f.v[(k + 1) % f.v.length];
      const key = cageEdgeKey(a, b);
      if (!seenE.has(key)) {
        seenE.add(key);
        if (!vEdges.has(a)) vEdges.set(a, []);
        if (!vEdges.has(b)) vEdges.set(b, []);
        vEdges.get(a).push(b); vEdges.get(b).push(a);
      }
      if (!vFaces.has(a)) vFaces.set(a, []);
    }
    for (const vi of f.v) vFaces.get(vi).push(f);
  }
  const limitPos = v => {
    const ne = vEdges.get(v) || [], nf = vFaces.get(v) || [];
    const n = ne.length, P0 = V[v];
    if (n < 3 || nf.length !== n) return P0.slice();
    const sharp = [];
    for (const o of ne) {
      const w = E.get(cageEdgeKey(v, o)) || 0;
      if (w > 0) sharp.push({ o, w });
    }
    if (sharp.length >= 3) return P0.slice();
    const L = [0, 0, 0];
    for (const o of ne) {
      L[0] += 2 * (P0[0] + V[o][0]); L[1] += 2 * (P0[1] + V[o][1]);
      L[2] += 2 * (P0[2] + V[o][2]);
    }
    for (const f of nf) {
      for (const vi of f.v) { L[0] += V[vi][0] / f.v.length;
        L[1] += V[vi][1] / f.v.length; L[2] += V[vi][2] / f.v.length; }
    }
    const d = n * (n + 5);
    const sm = [(n*n*P0[0] + L[0]) / d, (n*n*P0[1] + L[1]) / d,
                (n*n*P0[2] + L[2]) / d];
    if (sharp.length === 2) {
      sharp.sort((a, b) => b.w - a.w);
      const t = Math.min(1, (sharp[0].w + sharp[1].w) / 2);
      const A = V[sharp[0].o], B2 = V[sharp[1].o];
      const cr = [(A[0] + 4*P0[0] + B2[0]) / 6, (A[1] + 4*P0[1] + B2[1]) / 6,
                  (A[2] + 4*P0[2] + B2[2]) / 6];
      return [sm[0] + (cr[0]-sm[0])*t, sm[1] + (cr[1]-sm[1])*t,
              sm[2] + (cr[2]-sm[2])*t];
    }
    return sm;
  };

  // zones: a face can belong to BOTH a window zone and a door zone (the
  // door encompasses the window), so the two kinds are grouped in
  // independent passes. A door zone spans all its marked bands but only
  // within one bay side, so union-find merges only faces sharing an edge.
  const groupZones = flag => {
    const marked = [];
    F.forEach((f, i) => {
      if (f.v.length === 4 && f[flag]) marked.push({ i });
    });
    const byIdx = new Map(marked.map((r, k) => [r.i, k]));
    const parent = marked.map((_, k) => k);
    const find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
    const eOwner = new Map();
    for (const r of marked) {
      const f = F[r.i];
      for (let e = 0; e < 4; e++) {
        const key = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
        if (eOwner.has(key))
          parent[find(byIdx.get(r.i))] = find(byIdx.get(eOwner.get(key)));
        else eOwner.set(key, r.i);
      }
    }
    const zones = new Map();
    for (const r of marked) {
      const root = find(byIdx.get(r.i));
      if (!zones.has(root)) zones.set(root, []);
      zones.get(root).push(r.i);
    }
    return [...zones.values()];
  };
  const jobs = [];
  for (const z of groupZones('win')) jobs.push({ kind: 'win', faceIdxs: z });
  for (const z of groupZones('door')) jobs.push({ kind: 'door', faceIdxs: z });

  m.outlines = [];
  const add = [];
  for (const { kind, faceIdxs } of jobs) {
    const zoneFaces = faceIdxs.map(i => F[i]);
    const dir = new Map();
    for (const f of zoneFaces)
      for (let e = 0; e < 4; e++) {
        const a = f.v[e], b = f.v[(e + 1) % 4], k = cageEdgeKey(a, b);
        if (dir.has(k)) dir.delete(k); else dir.set(k, [a, b]);
      }
    const nxt = new Map();
    for (const [, [a, b]] of dir) nxt.set(a, b);
    // subdivided zones have interior vertices — only the boundary cycle
    // matters; the walk must close over exactly the boundary edges
    const start = nxt.keys().next().value;
    const ring = [start];
    for (let v = nxt.get(start); v !== start && ring.length <= nxt.size;
         v = nxt.get(v)) ring.push(v);
    if (ring.length !== nxt.size) continue;

    const vN = new Map();
    for (const f of zoneFaces) {
      const p = f.v.map(i => V[i]);
      const n = cross(sub(p[1], p[0]), sub(p[3], p[0]));
      for (const vi of f.v) {
        const s = vN.get(vi) || [0, 0, 0];
        vN.set(vi, [s[0]+n[0], s[1]+n[1], s[2]+n[2]]);
      }
    }

    const zMat = F[faceIdxs[0]].m;
    let pts = ring.map(v => limitPos(v));
    let ns = ring.map(v => nrm(vN.get(v)));
    let ids = ring.slice();

    // per-door sill: the pilot door reads doorSill, pax doors doorSillPax;
    // spec.win.sills = {pilot: v, pax0: v, ...} overrides any single door
    const doorKey = F[faceIdxs[0]].doorKey || null;
    const sill = kind !== 'door' ? 0
      : W.sills && doorKey && W.sills[doorKey] != null ? W.sills[doorKey]
      : doorKey && doorKey.lastIndexOf('pax', 0) === 0
        ? (W.doorSillPax != null ? W.doorSillPax : W.doorSill)
      : W.doorSill;

    // DOOR SILL — continuous bottom lift that FOLLOWS THE MESH (user: a
    // horizontal iso-cut slopes across the lattice rows because the rows
    // follow the drooping keel line — the bottom edge must stay parallel
    // to the mesh). The clip field is the height ABOVE THE ZONE'S OWN
    // BOTTOM LINE, and the bottom line is EXACT: the lowest crossing of
    // the zone's boundary ring at each z — piecewise linear, continuous,
    // and adjacent doors share the same belly row, so equal sills line up
    // across a pillar BY CONSTRUCTION. (The old per-zone z-bin estimate
    // stepped at bin edges and disagreed between neighbouring doors —
    // the visible sill jumps at the cabin pillar.)
    if (kind === 'door' && sill > 0) {
      const clip = (() => {
        const NR = pts.length;
        // the bottom line is built from the BOTTOM RUN of the boundary
        // only: segments more horizontal than vertical (|dz| >= |dy|) in
        // the lower half of the zone. The side edges are only NEAR-
        // vertical (limit positions of the pillar columns bow ~1e-3 in z),
        // and a lowest-crossing query inside that z-sliver — beyond the
        // bottom row's extent — would return a side-edge y far above the
        // belly, poisoning the field (the v9 bin-poison lesson, boundary
        // edition). Queries beyond the run's extent clamp to its ends.
        let gy0 = 1e9, gy1 = -1e9;
        for (const p of pts) {
          gy0 = Math.min(gy0, p[1]); gy1 = Math.max(gy1, p[1]);
        }
        const yMid = gy0 + 0.5 * (gy1 - gy0);
        const bot = [];
        let z0 = 1e9, z1 = -1e9;
        for (let i = 0; i < NR; i++) {
          const A = pts[i], B = pts[(i + 1) % NR];
          if (Math.abs(B[2] - A[2]) < Math.abs(B[1] - A[1])) continue;
          if ((A[1] + B[1]) / 2 > yMid) continue;
          bot.push([A, B]);
          z0 = Math.min(z0, A[2], B[2]); z1 = Math.max(z1, A[2], B[2]);
        }
        if (!bot.length) return null;
        const bottomAt = z => {
          const zc = Math.max(z0, Math.min(z1, z));
          let y = 1e9;
          for (const [A, B] of bot) {
            if ((A[2] - zc) * (B[2] - zc) > 0) continue;
            const dz = B[2] - A[2];
            if (Math.abs(dz) < 1e-12) { y = Math.min(y, A[1], B[1]); continue; }
            const t = Math.max(0, Math.min(1, (zc - A[2]) / dz));
            y = Math.min(y, A[1] + (B[1] - A[1]) * t);
          }
          return y;
        };
        const gOf = p => p[1] - (bottomAt(p[2]) + sill);
        // every g evaluation lives in LIMIT space: the boundary points ARE
        // the ring's limit positions, and interior face corners go through
        // the same limit stencil — shared edges then give bit-equal
        // crossings and the chain below needs no loose snaps (the old
        // limit-vs-raw mix needed a 0.05-radius snap at the joints, which
        // was itself a visible jog in the bead)
        const lim = new Map();
        ring.forEach((vid, i) => lim.set(vid, pts[i]));
        const limOf = vi => {
          let p = lim.get(vi);
          if (!p) { p = limitPos(vi); lim.set(vi, p); }
          return p;
        };
        const N = pts.length;
        const ab = pts.map(p => gOf(p) >= 0);
        if (ab.every(x => x) || !ab.some(x => x)) return null;
        let s = -1;
        for (let i = 0; i < N; i++)
          if (ab[i] && !ab[(i + 1) % N]) { s = i; break; }
        if (s < 0) return null;
        const order = [...Array(N)].map((_, k) => (s + k) % N);
        let runEnd = -1;
        for (let k = 1; k < N; k++) if (ab[order[k]]) { runEnd = k; break; }
        if (runEnd < 0) return null;
        for (let k = runEnd; k < N; k++)
          if (!ab[order[k]]) return null;          // >1 below-run: bail
        const lerpAt = (P, Q) => {
          const gP = gOf(P), gQ = gOf(Q);
          const t = -gP / (gQ - gP);
          return [P[0] + (Q[0]-P[0])*t, P[1] + (Q[1]-P[1])*t,
                  P[2] + (Q[2]-P[2])*t];
        };
        const x1 = lerpAt(pts[order[0]], pts[order[1]]);
        const x2 = lerpAt(pts[order[runEnd]], pts[order[runEnd - 1]]);
        // cut-line segments of the zone faces at g = 0 (the offset line)
        const segs = [];
        for (const f of zoneFaces) {
          const p4 = f.v.map(limOf);
          const g4 = p4.map(gOf);
          let lo = 1e9, hi = -1e9;
          for (const g of g4) { lo = Math.min(lo, g); hi = Math.max(hi, g); }
          if (!(lo < 0 && hi > 0)) continue;
          const hits = [];
          for (let e = 0; e < 4; e++) {
            if (g4[e] * g4[(e + 1) % 4] < 0)
              hits.push(lerpAt(p4[e], p4[(e + 1) % 4]));
          }
          if (hits.length !== 2) continue;
          const u = sub(p4[1], p4[0]), w2 = sub(p4[3], p4[0]);
          segs.push({ a: hits[0], b: hits[1], n: nrm(cross(u, w2)) });
        }
        // chain x1 -> x2 by nearest endpoints. Everything is in limit
        // space now, so every hop is exact (adjacent faces share edge
        // crossings, and x1/x2 ARE boundary-edge crossings) — the snap
        // radius is a pure float-noise guard, far below the bead size.
        const SNAP = 1e-9;
        const d2 = (p, q) => (p[0]-q[0])**2 + (p[2]-q[2])**2;
        const runP = [], runN = [], used = new Set();
        let cur = x1;
        for (let g = 0; g <= segs.length; g++) {
          if (d2(cur, x2) < SNAP) break;
          let bi = -1, bd = SNAP, flip = false;
          segs.forEach((sg, i) => {
            if (used.has(i)) return;
            const da = d2(cur, sg.a), db = d2(cur, sg.b);
            if (da < bd) { bd = da; bi = i; flip = false; }
            if (db < bd) { bd = db; bi = i; flip = true; }
          });
          if (bi < 0) break;
          used.add(bi);
          const nx = flip ? segs[bi].a : segs[bi].b;
          runP.push(nx); runN.push(segs[bi].n);
          cur = nx;
        }
        while (runP.length && d2(runP[runP.length - 1], x2) < SNAP) {
          runP.pop(); runN.pop();
        }
        // assemble: the above-run, then x1, the iso run, x2
        const nP = [], nN = [], nI = [];
        for (let k = runEnd; k < N; k++) {
          nP.push(pts[order[k]]); nN.push(ns[order[k]]);
          nI.push(ids[order[k]]);
        }
        nP.push(pts[order[0]]); nN.push(ns[order[0]]); nI.push(ids[order[0]]);
        nP.push(x1); nN.push(ns[order[0]]); nI.push(-1);
        for (let k = 0; k < runP.length; k++) {
          nP.push(runP[k]); nN.push(runN[k]); nI.push(-1);
        }
        nP.push(x2); nN.push(ns[order[runEnd]]); nI.push(-1);
        return { nP, nN, nI };
      })();
      if (clip) { pts = clip.nP; ns = clip.nN; ids = clip.nI; }
    }

    // the OUTLINE is a first-class object: recorded for later manipulation
    // (kind, zone material, vertex ids — -1 for synthesized sill points —
    // and on-surface positions) even when the tube itself is disabled
    m.outlines.push({ kind, mat: zMat, ids: ids.slice(),
                      pts: pts.map(p => p.slice()) });
    const enabled = kind === 'door' ? W.rimDoor
      : zMat === 'windshield' ? W.rimWs : W.rimWin;
    if (!enabled || !(W.rim > 0)) continue;

    // sweep an octagon section along the zone boundary of THE MESH AS
    // GIVEN — run this after subdividing and the path IS the displayed
    // surface polyline, so the bead sticks exactly at any level. The tube
    // itself is final geometry (never subdivided): section radius is the
    // real radius, and the section centre sits ON the surface so half the
    // tube is buried — only the outer half shows (user spec).
    const r = kind === 'door' ? W.rim * 0.85 : W.rim;
    // ROUND SHARP CORNERS of the sweep path (user: shading at the seal
    // elbows): corners sharper than ~35 deg are Chaikin-cut into two
    // points a small way down each arm — a physical seal rounds its
    // corners, parallel transport stays smooth, and the miter stretch
    // goes small. The recorded outline keeps the TRUE boundary; only the
    // swept path is rounded.
    {
      const P0 = pts, N0 = ns, NPP = P0.length;
      const outP = [], outN = [];
      for (let i = 0; i < NPP; i++) {
        const pm = P0[(i - 1 + NPP) % NPP], pc = P0[i], pp = P0[(i + 1) % NPP];
        const d0 = nrm(sub(pc, pm)), d1 = nrm(sub(pp, pc));
        if (d0[0]*d1[0] + d0[1]*d1[1] + d0[2]*d1[2] > 0.82) {
          outP.push(pc); outN.push(N0[i]); continue;
        }
        const l0 = Math.hypot(...sub(pc, pm)), l1 = Math.hypot(...sub(pp, pc));
        const d = Math.min(r * 2.2, 0.4 * Math.min(l0, l1));
        outP.push([pc[0]-d0[0]*d, pc[1]-d0[1]*d, pc[2]-d0[2]*d]);
        outN.push(N0[i]);
        outP.push([pc[0]+d1[0]*d, pc[1]+d1[1]*d, pc[2]+d1[2]*d]);
        outN.push(N0[i]);
      }
      pts = outP; ns = outN;
    }
    const path = pts;
    const pN = ns;
    const NP = path.length;
    // section sides are budgetable: the seals are ~half the face count at
    // L2, so rimSides 6 buys a visible chunk back (default 8 = octagon)
    const SS = Math.max(4, Math.round(W.rimSides || 8));
    // MITER JOINTS: at each path vertex the section sits on the corner
    // BISECTOR plane and is stretched 1/cos(half-turn) along the miter
    // axis — the exact ellipse where the two straight tube runs intersect
    // (SVG stroke-miter / a plumber's elbow). A circular section on the
    // averaged tangent pinches to r*cos(half-turn) at every corner, which
    // was the notched elbows on the door outline. Arms are normalized
    // per-segment first (raw central difference biases the bisector toward
    // the longer arm — the sill run's crossings are much shorter than the
    // rail edges they meet).
    const MITER_MAX = 2.5;                 // clamp for very sharp turns
    const sec = [];
    let bPrev = null;
    for (let i = 0; i < NP; i++) {
      let d0 = sub(path[i], path[(i - 1 + NP) % NP]);
      let d1 = sub(path[(i + 1) % NP], path[i]);
      const l0 = Math.hypot(d0[0], d0[1], d0[2]);
      const l1 = Math.hypot(d1[0], d1[1], d1[2]);
      d0 = l0 < 1e-9 ? null : [d0[0]/l0, d0[1]/l0, d0[2]/l0];
      d1 = l1 < 1e-9 ? null : [d1[0]/l1, d1[1]/l1, d1[2]/l1];
      if (!d0) d0 = d1 || [0, 0, 1];
      if (!d1) d1 = d0;
      const ts = [d0[0]+d1[0], d0[1]+d1[1], d0[2]+d1[2]];
      const tl = Math.hypot(ts[0], ts[1], ts[2]);
      const t = tl < 1e-6 ? d1 : [ts[0]/tl, ts[1]/tl, ts[2]/tl];
      const stretch = Math.min(MITER_MAX, 1 / Math.max(tl / 2, 1e-3)) - 1;
      let mit = [d1[0]-d0[0], d1[1]-d0[1], d1[2]-d0[2]];  // in-plane, ⊥ t
      const ml = Math.hypot(mit[0], mit[1], mit[2]);
      mit = ml < 1e-6 ? null : [mit[0]/ml, mit[1]/ml, mit[2]/ml];
      let b = bPrev
        ? nrm([bPrev[0] - t[0]*(bPrev[0]*t[0]+bPrev[1]*t[1]+bPrev[2]*t[2]),
               bPrev[1] - t[1]*(bPrev[0]*t[0]+bPrev[1]*t[1]+bPrev[2]*t[2]),
               bPrev[2] - t[2]*(bPrev[0]*t[0]+bPrev[1]*t[1]+bPrev[2]*t[2])])
        : nrm(cross(t, pN[i]));
      // parallel transport keeps the frame continuous; seed once so the
      // section's "out" is the surface normal
      let n2 = nrm(cross(b, t));
      if (i === 0 &&
          n2[0]*pN[0][0] + n2[1]*pN[0][1] + n2[2]*pN[0][2] < 0) {
        b = [-b[0], -b[1], -b[2]];
        n2 = nrm(cross(b, t));
      }
      bPrev = b;
      const sN = [];
      for (let k = 0; k < SS; k++) {
        const a = k * 2 * Math.PI / SS;
        const cb = Math.cos(a) * r, cn = Math.sin(a) * r;
        let qx = b[0]*cb + n2[0]*cn, qy = b[1]*cb + n2[1]*cn,
            qz = b[2]*cb + n2[2]*cn;
        if (mit) {
          const dm = (qx*mit[0] + qy*mit[1] + qz*mit[2]) * stretch;
          qx += mit[0]*dm; qy += mit[1]*dm; qz += mit[2]*dm;
        }
        sN.push(V.push([
          path[i][0] + qx, path[i][1] + qy, path[i][2] + qz,
        ]) - 1);
      }
      sec.push(sN);
    }
    const first = add.length;
    for (let i = 0; i < NP; i++) {
      const a = sec[i], bq = sec[(i + 1) % NP];
      for (let j = 0; j < SS; j++) {
        const j2 = (j + 1) % SS;
        add.push({ v: [a[j], bq[j], bq[j2], a[j2]], m: 'joint' });
      }
    }
    // the tube is a disjoint component: orient it outward by its own volume
    let vol = 0;
    for (let k = first; k < add.length; k++) {
      const p = add[k].v.map(i => V[i]);
      for (const [x, y, z] of [[p[0], p[1], p[2]], [p[0], p[2], p[3]]])
        vol += x[0]*(y[1]*z[2]-y[2]*z[1]) - x[1]*(y[0]*z[2]-y[2]*z[0])
             + x[2]*(y[0]*z[1]-y[1]*z[0]);
    }
    if (vol < 0)
      for (let k = first; k < add.length; k++) add[k].v.reverse();
  }
  m.F = F.concat(add);
  return m;
}

// ---------------------------------------------------------------------------
// INTERIOR — G13. A post-subdivision pass like cageRims: every element is
// a DISJOINT component behind its own flag (revert = flag off), traced
// from the displayed mesh's MATERIALS so it survives every slider. OBJ
// export still ships the control cage only. Panels are double-sided with
// their OWN vertices, so each component is edge-manifold on its own.
// I1: aft bulkhead (plain face at the aft-most pillarPassenger band —
// hides the tail interior) + firewall (inboard copy of the aperture cap).
// ---------------------------------------------------------------------------
function cageInterior(m, S) {
  const I = S.interior;
  if (!I || !I.on) return m;
  const { V, F } = m;
  const add = [];
  // panels are SINGLE sheets with their own vertices: materials render
  // double-sided, and a doubled sheet would put 4 faces on every interior
  // edge. Interior components may therefore carry open boundary edges —
  // the strict 2-manifold rule applies to the skin and the joint tubes.

  // ---- aft bulkhead --------------------------------------------------------
  if (I.bulk) (() => {
    // group pillarPassenger faces into bands; the aft-most band is the
    // pilPaxA station (pax mid pillars share the material)
    const idx = [];
    F.forEach((f, i) => {
      if (f.m === 'pillarPassenger' && f.v.length === 4) idx.push(i);
    });
    if (!idx.length) return;
    const byIdx = new Map(idx.map((fi, k) => [fi, k]));
    const parent = idx.map((_, k) => k);
    const find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
    const eOwn = new Map();
    for (const fi of idx) {
      const f = F[fi];
      for (let e = 0; e < 4; e++) {
        const key = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
        if (eOwn.has(key)) parent[find(byIdx.get(fi))] =
          find(byIdx.get(eOwn.get(key)));
        else eOwn.set(key, fi);
      }
    }
    const zones = new Map();
    for (const fi of idx) {
      const r = find(byIdx.get(fi));
      if (!zones.has(r)) zones.set(r, []);
      zones.get(r).push(fi);
    }
    let band = null, bandZ = 1e9;
    for (const fs of zones.values()) {
      let z = 0, n = 0;
      for (const fi of fs) for (const vi of F[fi].v) { z += V[vi][2]; n++; }
      z /= n;
      if (z < bandZ) { bandZ = z; band = fs; }
    }
    // boundary edges of the band -> two cycles; the CABIN side is the one
    // with the larger mean z
    const dir = new Map();
    for (const fi of band)
      for (let e = 0; e < 4; e++) {
        const a = F[fi].v[e], b = F[fi].v[(e + 1) % 4];
        const k = cageEdgeKey(a, b);
        if (dir.has(k)) dir.delete(k); else dir.set(k, [a, b]);
      }
    const nxt = new Map();
    for (const [, [a, b]] of dir) nxt.set(a, b);
    const cycles = [];
    const seen = new Set();
    for (const s0 of nxt.keys()) {
      if (seen.has(s0)) continue;
      const cyc = [s0]; seen.add(s0);
      for (let v = nxt.get(s0); v !== s0 && cyc.length <= nxt.size;
           v = nxt.get(v)) { cyc.push(v); seen.add(v); }
      cycles.push(cyc);
    }
    if (!cycles.length) return;
    cycles.sort((a, b) =>
      b.reduce((s, v) => s + V[v][2], 0) / b.length -
      a.reduce((s, v) => s + V[v][2], 0) / a.length);
    const ring = cycles[0];
    // ladder fill between the two side chains split at top/bottom — the
    // wall gets its OWN vertices at the ring positions (exact seam,
    // disjoint component)
    const N = ring.length;
    let iT = 0, iB = 0;
    ring.forEach((v, i) => {
      if (V[v][1] > V[ring[iT]][1]) iT = i;
      if (V[v][1] < V[ring[iB]][1]) iB = i;
    });
    const c1 = [], c2 = [];
    for (let i = iT; ; i = (i + 1) % N) { c1.push(ring[i]); if (i === iB) break; }
    for (let i = iT; ; i = (i - 1 + N) % N) { c2.push(ring[i]); if (i === iB) break; }
    const nid = new Map();
    const my = vi => {
      if (!nid.has(vi)) nid.set(vi, V.push(V[vi].slice()) - 1);
      return nid.get(vi);
    };
    const K = Math.max(c1.length, c2.length) - 1;
    for (let k = 0; k < K; k++) {
      const i1a = Math.round(k * (c1.length - 1) / K),
            i1b = Math.round((k + 1) * (c1.length - 1) / K),
            i2a = Math.round(k * (c2.length - 1) / K),
            i2b = Math.round((k + 1) * (c2.length - 1) / K);
      if (i1a === i1b && i2a === i2b) continue;
      add.push({ v: [my(c1[i1a]), my(c1[i1b]), my(c2[i2b]), my(c2[i2a])],
                 m: 'bulkhead' });
    }
  })();

  // ---- dashboard (I2, user recipe verbatim) --------------------------------
  // 1. the windshield bottom line where it meets the fuselage = the mesh
  //    edges shared by 'windshield' and 'waistband' faces (traced, so it
  //    follows base bow / base lift / nose crown by construction);
  // 2. extrude toward the cabin;
  // 3. the extruded row is aligned onto ONE transverse plane (perpendicular
  //    to the long axis) at dashBack aft of the line's aft-most point;
  // 4. extrude + slightly INSET within that plane (the glareshield roll);
  // 5. extrude toward the NOSE by the SAME value (the return lip);
  // 6. merge: the panel presents a FLAT FACE (arc-topped plate, ladder
  //    fill between the two half-chains, flat bottom chord).
  if (I.dash) (() => {
    const owners = new Map();                    // edgeKey -> Set(materials)
    for (const f of F) {
      if (f.v.length !== 4) continue;
      if (f.m !== 'windshield' && f.m !== 'waistband') continue;
      for (let e = 0; e < 4; e++) {
        const k = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
        if (!owners.has(k)) owners.set(k, new Set());
        owners.get(k).add(f.m);
      }
    }
    const link = new Map();                      // vert -> neighbours
    for (const [k, mats] of owners) {
      if (!(mats.has('windshield') && mats.has('waistband'))) continue;
      const [a, b] = k.split('_').map(Number);
      if (!link.has(a)) link.set(a, []);
      if (!link.has(b)) link.set(b, []);
      link.get(a).push(b); link.get(b).push(a);
    }
    let start = -1;
    for (const [v, ns] of link) if (ns.length === 1) { start = v; break; }
    if (start < 0) return;
    const line = [start];
    const seen = new Set([start]);
    for (let v = start; ;) {
      const nx = (link.get(v) || []).find(n => !seen.has(n));
      if (nx == null) break;
      line.push(nx); seen.add(nx); v = nx;
    }
    if (line.length < 5) return;
    const base = line.map(vi => V[vi].slice());
    // tuck the whole dashboard a few mm inboard — the corner poked
    // through the skin at the windshield fold (user report)
    const TUCK = 0.008;
    for (const p of base)
      p[0] -= Math.sign(p[0]) * Math.min(Math.abs(p[0]), TUCK);
    const back = Math.max(0.005, I.dashBack || 0.05);
    const lip = Math.max(0.005,
      (I.dashLip != null ? I.dashLip : I.dashInset) || 0.035);
    const dep = Math.max(0.02, I.dashDepth || 0.35);
    let zP = 1e9;
    for (const p of base) zP = Math.min(zP, p[2]);
    zP -= back;
    const zF = zP + lip;
    let yB = 1e9;
    for (const p of base) yB = Math.min(yB, p[1]);
    yB -= dep;
    // the panel OUTLINE in the transverse plane: the flattened base arc
    // extended by vertical side drops to the flat bottom line — the roll
    // and lip border wraps the sides. The side chains exclude the arc end
    // (shared corner point).
    const NL = base.length;
    const NS = 3;
    const bL = base[0], bR = base[NL - 1];
    const O = [];
    for (let j = 0; j < NS; j++)
      O.push([bL[0], yB + (bL[1] - yB) * j / NS, zP]);
    for (let i = 0; i < NL; i++) O.push([base[i][0], base[i][1], zP]);
    for (let j = NS - 1; j >= 0; j--)
      O.push([bR[0], yB + (bR[1] - yB) * j / NS, zP]);
    const NX = O.length;
    // in-plane inset of the full outline (normals toward the interior)
    let yTop = -1e9;
    for (const p of base) yTop = Math.max(yTop, p[1]);
    const cen = [0, (yB + yTop) / 2];
    const O1 = O.map((p, i) => {
      const a = O[Math.max(0, i - 1)], b = O[Math.min(NX - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      if (nx * (cen[0] - p[0]) + ny * (cen[1] - p[1]) < 0) { nx = -nx; ny = -ny; }
      return [p[0] + nx * lip, p[1] + ny * lip, zP];
    });
    const O2 = O1.map(p => [p[0], p[1], zF]);       // forward lip
    // CLOSED SOLID, explicit pieces (user rulings: the SIDES are FLAT
    // PANELS at the lip's OUTER edge — the body never extrudes from the
    // inset inner edge). Coincident points fuse via a coordinate-keyed
    // vertex map; < 3-distinct quads are skipped (repeated-vert quads act
    // as triangles); orientation is fixed afterwards by orientCage on the
    // component, so pieces are emitted in whatever winding is convenient.
    const vid = new Map();
    const pid = p => {
      const k = p[0].toFixed(9) + ',' + p[1].toFixed(9) + ',' + p[2].toFixed(9);
      if (!vid.has(k)) vid.set(k, V.push([p[0], p[1], p[2]]) - 1);
      return vid.get(k);
    };
    const baseId = base.map(pid);
    const oid = O.map(pid), o1id = O1.map(pid), o2id = O2.map(pid);
    const R5 = base.map(p => pid([p[0], yB, p[2]]));
    const dashStart = add.length;
    const quad = (a, b, c, d) => {
      const u = new Set([a, b, c, d]);
      if (u.size < 3) return;
      if (u.size === 3) {                 // true triangle, cyclic order kept
        const vv = [];
        for (const x of [a, b, c, d]) if (!vv.includes(x)) vv.push(x);
        add.push({ v: vv, m: 'dash' });
      } else add.push({ v: [a, b, c, d], m: 'dash' });
    };
    const strip = (A, B) => {
      for (let i = 0; i + 1 < A.length; i++)
        quad(A[i], A[i + 1], B[i + 1], B[i]);
    };
    const ladder = (A, B) => {             // proportional resample fill
      const K = Math.max(A.length, B.length) - 1;
      for (let k = 0; k < K; k++) {
        const a0 = Math.round(k * (A.length - 1) / K),
              a1 = Math.round((k + 1) * (A.length - 1) / K),
              b0 = Math.round(k * (B.length - 1) / K),
              b1 = Math.round((k + 1) * (B.length - 1) / K);
        quad(A[a0], A[a1], B[b1], B[b0]);
      }
    };
    strip(baseId, oid.slice(NS, NS + NL));          // glareshield
    strip(oid, o1id);                               // border roll
    strip(o1id, o2id);                              // lip
    // face plate: ladder between the two halves of the lip path split at
    // the crown — the final rung is the flat bottom chord
    let iC = 0;
    O2.forEach((p, i) => { if (p[1] > O2[iC][1]) iC = i; });
    const cA = [], cB = [];
    for (let i = iC; i >= 0; i--) cA.push(o2id[i]);
    for (let i = iC; i < NX; i++) cB.push(o2id[i]);
    ladder(cA, cB);
    // side panels: FLAT at the outer x — ladder from the outline side
    // chain (zP, top->bottom incl the shared arc corner) to the 2-point
    // forward edge under the base end
    const sideL = [oid[NS]];
    for (let j = NS - 1; j >= 0; j--) sideL.push(oid[j]);
    ladder(sideL, [baseId[0], pid([bL[0], yB, bL[2]])]);
    const sideR = [oid[NS + NL - 1]];
    for (let j = NS + NL; j < NX; j++) sideR.push(oid[j]);
    ladder(sideR, [baseId[NL - 1], pid([bR[0], yB, bR[2]])]);
    // bottom: ladder between the aft chain (outer corner -> roll corner ->
    // lip corner -> chord -> mirrored) and the under-base line
    ladder([oid[0], o1id[0], o2id[0], o2id[NX - 1], o1id[NX - 1],
            oid[NX - 1]], R5);
    strip(R5, baseId);                              // front return
    // coherent windings + outward, on this component only
    orientCage({ V, F: add.slice(dashStart) });
    // ROUNDED EDGES (user ruling): the dash goes through the SAME
    // crease-CC machinery as the cage — sharp edges are auto-tagged by
    // DIHEDRAL (> ~30 deg) with dashCrease weight and the closed solid is
    // subdivided twice, so lips, insets and the 90-degree extrusions
    // become properly rounded corners with clean shading. The control
    // solid is compacted into its own submesh, subdivided, merged back.
    const dc = I.dashCrease != null ? I.dashCrease : 1.5;
    const faces = add.splice(dashStart);
    const used = new Map();
    const sv = [];
    for (const f of faces) f.v = f.v.map(vi => {
      if (!used.has(vi)) { used.set(vi, sv.length); sv.push(V[vi].slice()); }
      return used.get(vi);
    });
    const fnOf = f => {
      const p = f.v.map(i => sv[i]);
      return f.v.length === 4
        ? nrm(cross(sub(p[2], p[0]), sub(p[3], p[1])))
        : nrm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    };
    const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1;
                       return [v[0]/l, v[1]/l, v[2]/l]; };
    const sub = (A, B) => [A[0]-B[0], A[1]-B[1], A[2]-B[2]];
    const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2],
                             a[0]*b[1]-a[1]*b[0]];
    const EN = new Map();
    for (const f of faces) {
      const n = fnOf(f);
      for (let i = 0; i < f.v.length; i++) {
        const k = cageEdgeKey(f.v[i], f.v[(i + 1) % f.v.length]);
        if (!EN.has(k)) EN.set(k, []);
        EN.get(k).push(n);
      }
    }
    const E2 = new Map();
    for (const [k, nsl] of EN)
      if (nsl.length === 2 && nsl[0][0]*nsl[1][0] + nsl[0][1]*nsl[1][1]
          + nsl[0][2]*nsl[1][2] < 0.87)
        E2.set(k, dc);
    let sm = { V: sv, F: faces, E: E2 };
    sm = cageSubdivide(cageSubdivide(sm));
    const off = V.length;
    for (const p of sm.V) V.push(p);
    for (const f of sm.F) add.push({ v: f.v.map(i => i + off), m: 'dash' });
  })();

  // ---- firewall ------------------------------------------------------------
  // an inboard copy of every marked aperture-cap face (engine nose grid,
  // pusher tail disc) — the cabin's forward view ends on a wall instead
  // of the cap's backface. capFace marks are set at emission and survive
  // subdivision.
  if (I.fire) (() => {
    const nid = new Map();
    for (const f of F) {
      if (!f.capFace || f.v.length !== 4) continue;
      const p = f.v.map(i => V[i]);
      const u = [p[2][0]-p[0][0], p[2][1]-p[0][1], p[2][2]-p[0][2]];
      const w = [p[3][0]-p[1][0], p[3][1]-p[1][1], p[3][2]-p[1][2]];
      const n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      const off = [-n[0]/l*0.012, -n[1]/l*0.012, -n[2]/l*0.012];
      const my = vi => {
        if (!nid.has(vi)) nid.set(vi, V.push([
          V[vi][0]+off[0], V[vi][1]+off[1], V[vi][2]+off[2]]) - 1);
        return nid.get(vi);
      };
      add.push({ v: f.v.map(my), m: 'firewall' });
    }
  })();

  m.F = F.concat(add);
  return m;
}

// ---------------------------------------------------------------------------
// WINDOWS — the inset pass (crease mode only; the loop steps stay the
// fit-verified template). Every marked glass quad becomes a picture frame:
// an inner rectangle at margin frameW, recessed by depth along the outward
// normal (negative depth = proud/blown pane), frame band around it in the
// body material, glass inside keeping the zone material. The inner loop is
// creased with crGlass — LOWER weight rounds the window corners under CC,
// which is where the elegant joints come from. Door quads get the same
// structure as a shallow groove that keeps the body material.
// ---------------------------------------------------------------------------
function cageWindows(m, S) {
  const W = S.win;
  if (!W || !(W.frameW > 0)) return m;
  const { V, F } = m;
  const E = m.E || (m.E = new Map());
  const sub = (A, B) => [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1;
                     return [v[0] / l, v[1] / l, v[2] / l]; };

  // LIMIT-SURFACE COMPENSATION. Corner-pinned vertices stay ON the control
  // cage, but the smooth surface converges INSIDE it — a frame placed at
  // cage positions stands proud on a collapsing rim and the reveal band
  // folds (measured: 148 inverted quads). So the frame rings are placed at
  // the LIMIT position of their boundary vertex (Halstead-Kass-DeRose
  // stencil: L = (n^2 P + 4*sum(edge mids) + sum(face centroids))/(n(n+5)))
  // — the same idea as the dome's comp factor, in the other direction.
  const vEdges = new Map(), vFaces = new Map();
  const seenE = new Set();
  for (const f of F) {
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k], b = f.v[(k + 1) % f.v.length];
      const key = cageEdgeKey(a, b);
      if (!seenE.has(key)) {
        seenE.add(key);
        if (!vEdges.has(a)) vEdges.set(a, []);
        if (!vEdges.has(b)) vEdges.set(b, []);
        vEdges.get(a).push(b); vEdges.get(b).push(a);
      }
      if (!vFaces.has(a)) vFaces.set(a, []);
    }
    for (const vi of f.v) vFaces.get(vi).push(f);
  }
  const limitDelta = v => {
    const ne = vEdges.get(v) || [], nf = vFaces.get(v) || [];
    const n = ne.length;
    if (n < 3 || nf.length !== n) return [0, 0, 0];
    const P0 = V[v];
    // crease-aware: a vertex ON a creased rail converges to the B-spline
    // CURVE limit (E1 + 4P + E2)/6 along the rail, not the smooth-surface
    // limit — using the smooth stencil there put the frame rings off the
    // real surface and folded the reveal at exactly the rail corners.
    const sharp = [];
    for (const o of ne) {
      const w = E.get(cageEdgeKey(v, o)) || 0;
      if (w > 0) sharp.push({ o, w });
    }
    if (sharp.length >= 3) return [0, 0, 0];         // corner: pinned
    const L = [0, 0, 0];
    for (const o of ne) {
      L[0] += 4 * (P0[0] + V[o][0]) / 2;
      L[1] += 4 * (P0[1] + V[o][1]) / 2;
      L[2] += 4 * (P0[2] + V[o][2]) / 2;
    }
    for (const f of nf) {
      let cx = 0, cy = 0, cz = 0;
      for (const vi of f.v) { cx += V[vi][0] / f.v.length;
        cy += V[vi][1] / f.v.length; cz += V[vi][2] / f.v.length; }
      L[0] += cx; L[1] += cy; L[2] += cz;
    }
    const d = n * (n + 5);
    const sm = [(n * n * P0[0] + L[0]) / d - P0[0],
                (n * n * P0[1] + L[1]) / d - P0[1],
                (n * n * P0[2] + L[2]) / d - P0[2]];
    if (sharp.length === 2) {
      sharp.sort((a, b) => b.w - a.w);
      const t = Math.min(1, (sharp[0].w + sharp[1].w) / 2);
      const A = V[sharp[0].o], B2 = V[sharp[1].o];
      const cr = [(A[0] + 4 * P0[0] + B2[0]) / 6 - P0[0],
                  (A[1] + 4 * P0[1] + B2[1]) / 6 - P0[1],
                  (A[2] + 4 * P0[2] + B2[2]) / 6 - P0[2]];
      return [sm[0] + (cr[0] - sm[0]) * t, sm[1] + (cr[1] - sm[1]) * t,
              sm[2] + (cr[2] - sm[2]) * t];
    }
    return sm;
  };
  const faceN = f => {
    const p = f.v.map(i => V[i]);
    return nrm([
      (p[1][1]-p[0][1])*(p[3][2]-p[0][2]) - (p[1][2]-p[0][2])*(p[3][1]-p[0][1]),
      (p[1][2]-p[0][2])*(p[3][0]-p[0][0]) - (p[1][0]-p[0][0])*(p[3][2]-p[0][2]),
      (p[1][0]-p[0][0])*(p[3][1]-p[0][1]) - (p[1][1]-p[0][1])*(p[3][0]-p[0][0]),
    ]);
  };

  // ---- group marked faces into ZONES (connected, same material+kind) -----
  // The pilot side glass and the quarter glass share the edge at the window
  // ring, so they merge into ONE window — a single pane, as on the real
  // aircraft. Union-find over shared edges.
  const marked = [];
  F.forEach((f, i) => {
    if (f.v.length !== 4) return;
    if (f.win && !W.noWin) marked.push({ i, kind: 'win', mat: f.m });
    else if (f.door && W.door) marked.push({ i, kind: 'door', mat: f.m });
  });
  const byIdx = new Map(marked.map((r, k) => [r.i, k]));
  const parent = marked.map((_, k) => k);
  const find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
  const eOwner = new Map();
  for (const r of marked) {
    const f = F[r.i];
    for (let e = 0; e < 4; e++) {
      const key = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
      if (eOwner.has(key)) {
        const o = marked[byIdx.get(eOwner.get(key))];
        if (o.kind === r.kind && o.mat === r.mat)
          parent[find(byIdx.get(r.i))] = find(byIdx.get(o.i));
      } else eOwner.set(key, r.i);
    }
  }
  const zones = new Map();
  for (const r of marked) {
    const root = find(byIdx.get(r.i));
    if (!zones.has(root)) zones.set(root, []);
    zones.get(root).push(r.i);
  }

  const drop = new Set(), add = [];
  for (const faceIdxs of zones.values()) {
    const zoneFaces = faceIdxs.map(i => F[i]);
    const kind = F[faceIdxs[0]].door ? 'door' : 'win';
    const mat = F[faceIdxs[0]].m;
    // boundary edges = used once within the zone, as directed edges so the
    // cycle keeps the faces' (outward-coherent) winding
    const dir = new Map();
    for (const f of zoneFaces)
      for (let e = 0; e < 4; e++) {
        const a = f.v[e], b = f.v[(e + 1) % 4], k = cageEdgeKey(a, b);
        if (dir.has(k)) dir.delete(k); else dir.set(k, [a, b]);
      }
    const nxt = new Map();
    for (const [, [a, b]] of dir) nxt.set(a, b);
    // every zone vertex must lie on the boundary (quad strips do); if not,
    // skip the zone rather than emit garbage
    const vSet = new Set();
    for (const f of zoneFaces) for (const v of f.v) vSet.add(v);
    if (nxt.size !== vSet.size) continue;
    const start = nxt.keys().next().value;
    const ring = [start];
    for (let v = nxt.get(start); v !== start && ring.length <= nxt.size;
         v = nxt.get(v)) ring.push(v);
    if (ring.length !== nxt.size) continue;

    // per-vertex inset direction: average of the inward normals of the two
    // adjacent boundary edges (inward = from edge midpoint toward the
    // owning face's centroid, perpendicular to the edge)
    const inwardOf = new Map();
    for (const f of zoneFaces) {
      const c = [0, 0, 0];
      for (const vi of f.v) { c[0] += V[vi][0] / 4; c[1] += V[vi][1] / 4;
                              c[2] += V[vi][2] / 4; }
      for (let e = 0; e < 4; e++) {
        const a = f.v[e], b = f.v[(e + 1) % 4], k = cageEdgeKey(a, b);
        if (!dir.has(k)) continue;
        const A = V[a], B = V[b];
        const mid = [(A[0]+B[0])/2, (A[1]+B[1])/2, (A[2]+B[2])/2];
        const ed = nrm(sub(B, A));
        let iw = sub(c, mid);
        const d = iw[0]*ed[0] + iw[1]*ed[1] + iw[2]*ed[2];
        iw = nrm([iw[0]-d*ed[0], iw[1]-d*ed[1], iw[2]-d*ed[2]]);
        inwardOf.set(k, iw);
      }
    }
    const vN = new Map();          // per-vertex outward normal (depth dir)
    for (const f of zoneFaces) {
      const n = faceN(f);
      for (const vi of f.v) {
        const s = vN.get(vi) || [0, 0, 0];
        vN.set(vi, [s[0]+n[0], s[1]+n[1], s[2]+n[2]]);
      }
    }
    let eMin = 1e9;
    for (const [, [a, b]] of dir)
      eMin = Math.min(eMin, Math.hypot(...sub(V[b], V[a])));
    const fw0 = kind === 'door' ? W.frameW * 1.5 : W.frameW;
    const sc = Math.min(1, (eMin * 0.42) / (fw0 * 1.8));
    const g0 = fw0 * 0.8 * sc;          // reveal: boundary -> frame edge
    const g1 = g0 + fw0 * sc;           // frame edge -> glass edge
    const dp = kind === 'door' ? W.doorDepth : W.depth - (W.blow || 0);

    // TRIPLE RING: the zone boundary stays UNTOUCHED and uncreased (window
    // creases must never meet the rails/pillars — every crossing pins a
    // corner and kinks the line), then ring0 = the frame's outer edge,
    // ring1 = the glass edge, recessed. Both interior rings plus their
    // spokes are creased, so every frame vertex holds >= 3 sharp edges and
    // is corner-pinned: the frame is rigid and SQUARE, while the reveal
    // band blends smoothly into the surrounding surface.
    const mkRing = (dist, depth) => {
      const out = new Map();
      for (let i = 0; i < ring.length; i++) {
        const v = ring[i], p = ring[(i - 1 + ring.length) % ring.length],
              q = ring[(i + 1) % ring.length];
        const iwA = inwardOf.get(cageEdgeKey(p, v)) || [0, 0, 0];
        const iwB = inwardOf.get(cageEdgeKey(v, q)) || [0, 0, 0];
        const n = nrm(vN.get(v));
        // the two inward dirs may live in DIFFERENT planes when the zone
        // bends (side glass wrapping onto the windshield slope) — their sum
        // can leave the surface and the inset would spike outward. Project
        // it into the local tangent plane before use.
        let d = [iwA[0]+iwB[0], iwA[1]+iwB[1], iwA[2]+iwB[2]];
        const dn = d[0]*n[0] + d[1]*n[1] + d[2]*n[2];
        d = nrm([d[0]-dn*n[0], d[1]-dn*n[1], d[2]-dn*n[2]]);
        const P0 = V[v], dl = limitDelta(v);
        out.set(v, V.push([
          P0[0] + dl[0] + d[0]*dist - n[0]*depth,
          P0[1] + dl[1] + d[1]*dist - n[1]*depth,
          P0[2] + dl[2] + d[2]*dist - n[2]*depth,
        ]) - 1);
      }
      return out;
    };
    const r0 = mkRing(g0, 0), r1 = mkRing(g1, dp);
    for (const [, [a, b]] of dir) {
      add.push({ v: [a, b, r0.get(b), r0.get(a)], m: 'body' });
      add.push({ v: [r0.get(a), r0.get(b), r1.get(b), r1.get(a)], m: 'body' });
    }
    for (const f of zoneFaces)
      add.push({ v: f.v.map(vi => r1.get(vi)),
                 m: kind === 'door' ? 'body' : mat });
    const cw = Math.max(2, W.crGlass);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      for (const k of [cageEdgeKey(r0.get(a), r0.get(b)),
                       cageEdgeKey(r1.get(a), r1.get(b)),
                       cageEdgeKey(r0.get(a), r1.get(a))])
        if (!(E.get(k) >= cw)) E.set(k, cw);
    }
    for (const i of faceIdxs) drop.add(i);
  }
  m.F = F.filter((_, i) => !drop.has(i)).concat(add);
  return m;
}

// ---------------------------------------------------------------------------
// crease-aware Catmull-Clark (semi-sharp, Pixar rules)
// ---------------------------------------------------------------------------
// m = {V, F:[{v:[4], m}], E?: Map('a_b' sorted -> weight)}. Weight semantics:
// 0 = smooth, >=1 = fully sharp this level, fractional = lerp(smooth, sharp).
// Child edges inherit weight-1, so a weight of 2 stays sharp for two levels
// then rounds — Pixar's semi-sharp crease. Vertices: two sharp edges -> the
// crease rule (E1 + 6P + E2)/8, three or more -> corner (pinned), blended by
// the incident weights when fractional. This is what replaces the template's
// guard-loop layer: the geometry is step 1's, the sharpness is a tag.
const cageEdgeKey = (a, b) => a < b ? a + '_' + b : b + '_' + a;

function cageSubdivide(m) {
  const { V, F } = m;
  const E = m.E || new Map();
  const fp = F.map(f => {
    const s = [0, 0, 0];
    for (const i of f.v) { s[0] += V[i][0]; s[1] += V[i][1]; s[2] += V[i][2]; }
    return s.map(v => v / f.v.length);
  });
  const ER = new Map();
  F.forEach((f, fi) => {
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k], b = f.v[(k + 1) % f.v.length], key = cageEdgeKey(a, b);
      if (!ER.has(key)) ER.set(key, { a, b, f: [] });
      ER.get(key).f.push(fi);
    }
  });
  // per-vertex adjacency incl. incident crease weights
  const vAdj = V.map(() => ({ F: [0, 0, 0], R: [0, 0, 0], n: 0, nf: 0,
                              sharp: [] }));
  for (const [key, e] of ER) {
    const mid = [0, 1, 2].map(i => (V[e.a][i] + V[e.b][i]) / 2);
    const w = E.get(key) || 0;
    for (const v of [e.a, e.b]) {
      const A = vAdj[v];
      A.R[0] += mid[0]; A.R[1] += mid[1]; A.R[2] += mid[2]; A.n++;
      if (w > 0) A.sharp.push({ w, o: v === e.a ? e.b : e.a });
    }
  }
  F.forEach((f, fi) => { for (const v of f.v) { const A = vAdj[v];
    A.F[0] += fp[fi][0]; A.F[1] += fp[fi][1]; A.F[2] += fp[fi][2]; A.nf++; } });
  const NV = V.map((P0, i) => {
    const A = vAdj[i], n = A.n || 1, nf = A.nf || 1;
    const Fp = A.F.map(v => v / nf), R = A.R.map(v => v / n);
    const sm = [0, 1, 2].map(k => (Fp[k] + 2 * R[k] + (n - 3) * P0[k]) / n);
    if (A.sharp.length < 2) return sm;
    A.sharp.sort((x, y) => y.w - x.w);
    const t = Math.min(1, (A.sharp[0].w + A.sharp[1].w) / 2);
    if (A.sharp.length === 2) {
      const E1 = V[A.sharp[0].o], E2 = V[A.sharp[1].o];
      const cr = [0, 1, 2].map(k => (E1[k] + 6 * P0[k] + E2[k]) / 8);
      return [0, 1, 2].map(k => sm[k] + (cr[k] - sm[k]) * t);
    }
    return [0, 1, 2].map(k => sm[k] + (P0[k] - sm[k]) * t);   // corner
  });
  const fpIdx = fp.map(pt => { NV.push(pt); return NV.length - 1; });
  const epIdx = new Map();
  for (const [key, e] of ER) {
    const w = E.get(key) || 0;
    const sm = [0, 1, 2].map(i => {
      let s = V[e.a][i] + V[e.b][i], d = 2;
      for (const fi of e.f) { s += fp[fi][i]; d++; }
      return s / d;
    });
    const t = Math.min(1, w);
    const sh = [0, 1, 2].map(i => (V[e.a][i] + V[e.b][i]) / 2);
    NV.push([0, 1, 2].map(i => sm[i] + (sh[i] - sm[i]) * t));
    epIdx.set(key, NV.length - 1);
  }
  const NF = [], NE = new Map();
  for (const [key, e] of ER) {
    const w = (E.get(key) || 0) - 1;
    if (w > 0) {
      const ep = epIdx.get(key);
      NE.set(cageEdgeKey(e.a, ep), w);
      NE.set(cageEdgeKey(e.b, ep), w);
    }
  }
  F.forEach((f, fi) => {
    for (let k = 0; k < f.v.length; k++) {
      const prev = f.v[(k - 1 + f.v.length) % f.v.length], cur = f.v[k],
            next = f.v[(k + 1) % f.v.length];
      const nf = { v: [cur, epIdx.get(cageEdgeKey(cur, next)), fpIdx[fi],
                       epIdx.get(cageEdgeKey(prev, cur))], m: f.m };
      // zone marks survive subdivision so the rim pass can run on the
      // ACTUAL displayed level and trace the real boundary polyline
      if (f.win) nf.win = 1;
      if (f.door) { nf.door = 1; if (f.doorKey) nf.doorKey = f.doorKey; }
      if (f.capFace) nf.capFace = 1;
      NF.push(nf);
    }
  });
  return { V: NV, F: NF, E: NE };
}

// make face windings globally consistent and outward (positive volume) —
// the emitters above build bands in whatever order was convenient
function orientCage(m) {
  const EF = new Map();
  m.F.forEach((f, fi) => {
    for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i], b = f.v[(i + 1) % f.v.length];
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!EF.has(k)) EF.set(k, []);
      EF.get(k).push(fi);
    }
  });
  const dirHas = (f, a, b) => {
    for (let i = 0; i < f.v.length; i++)
      if (f.v[i] === a && f.v[(i + 1) % f.v.length] === b) return true;
    return false;
  };
  const seen = new Array(m.F.length).fill(false);
  const stack = [0];
  seen[0] = true;
  while (stack.length) {
    const fi = stack.pop(), f = m.F[fi];
    for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i], b = f.v[(i + 1) % f.v.length];
      const k = a < b ? a + '_' + b : b + '_' + a;
      for (const gi of EF.get(k)) {
        if (seen[gi]) continue;
        seen[gi] = true;
        if (dirHas(m.F[gi], a, b)) m.F[gi].v.reverse();  // same dir = flip
        stack.push(gi);
      }
    }
  }
  let vol = 0;
  for (const f of m.F) {
    const p = f.v.map(i => m.V[i]);
    for (let t = 1; t + 1 < p.length; t++) {
      const [a, b, c] = [p[0], p[t], p[t + 1]];
      vol += a[0] * (b[1] * c[2] - b[2] * c[1])
           - a[1] * (b[0] * c[2] - b[2] * c[0])
           + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
  }
  if (vol < 0) for (const f of m.F) f.v.reverse();
}

// ---------------------------------------------------------------------------
// the slider layer: high-level params -> spec. Template defaults are the
// identity (cageSpec(CAGE_PARAMS) rebuilds CAGE_DEFAULT bit-close); fractions
// and offsets are computed FROM the fiche so nothing here goes stale.
// ---------------------------------------------------------------------------
const CAGE_PARAMS = {
  paxCount: 1, paxLen: 1.756670, pilotLen: 0.662567, boomLen: 3.983966,
  tailLen: 0.169815, cabPillarW: 0.100000, paxPillarW: 0.075041,
  // unified pillar width: > 0 overrides BOTH cab and pax pillar widths
  // (user: pillars start equal; the template's 0.100 vs 0.075 was a hand
  // edit). 0 = off, per-pillar values above apply (the fit identity path).
  pillarW: 0,
  halfW: 0.554104, roofHalfW: 0.431009, roofY: 1.0, keelY: -0.921275,
  floorY: -0.497590, ceilInset: 1.0, waistY: 0.091103, bandH: 0.062549,
  aftRoofY: 0.677945, aftKeelY: -0.656475,
  tailHalfW: 0.053446, tailRoofY: 0.5, tailKeelY: -0.077750,
  ringPullIn: 0.023043,
  wsRun: 0.793755, wsTopOff: 0.081824, wsBaseBow: 0.558880,
  wsCeilBow: 0.129299, apilW: 1.0, apilPerp: 0,
  noseLen: 0.646272, noseW: 1.0, pfW: 1.0,
  topRound: 0, topAngCeil: 52, topAngRoof: 76, topComp: 1.045, bubble: 0,
  // skylight defaults = the template: roof glass on, covering all bays
  skylight: 1, skyExt: 5,
  // pillar crease defaults to MAX (user ruling): the pillar bands render
  // at their drawn width — width itself is adjusted via pillarW below,
  // never via the crease.
  // crFrame defaults 0 (G12.3 L3 fix): the wsAft/wsFront RING PAIR holds
  // the A-pillar fold (the template's own pillar mechanism) and the seal
  // tubes delineate the frame — a ring crease here CROSSES the sill/band
  // rails, corner-pins the fold vertices, and higher subsurf levels
  // resolve that as a pinch (HARD-WON #2: crease lines must not cross;
  // pins are invisible on straight lines, ruinous on bent ones).
  crPillar: 3, crSill: 2, crBand: 1, crCeil: 1, crFrame: 0, crCap: 2,
  crFrontCap: 0.3, crNoseCap: 2,
  botRound: 0,
  noseCrown: 0, noseH: 1, noseDroop: 0, wsBaseLift: 0,
  cowlLoops: 0, cowlEase: 0, cowlBulge: 1.05, noseFinish: 0,
  aeroNose: 0, aeroWsLen: 0.9, aeroLen: 1.5, aeroDroop: 0.30,
  aeroTipW: 0.10, aeroTipH: 0.12,
  rearAperture: 0,
  boomMidOn: 0, boomMidT: 0.35, boomMidPinch: 0.6,
  winFrameW: 0, winDepth: 0.015, winBlow: 0, crGlass: 3.0,
  rimW: 0.012, rimWin: 1, rimWs: 1, rimDoor: 1, rimSides: 8,
  doorOn: 1, doorPax: 0, doorDeep: 1, doorSill: 0.06, doorSillPax: 0.06,
  doorDepth: 0.008,
  // interior (G13): master + per-element flags — every element disjoint
  // and individually revertible
  intOn: 0, intBulk: 1, intFire: 1,
  intDash: 1, dashBack: 0.05, dashLip: 0.035, dashDepth: 0.35,
  dashCrease: 1.5,
};

function cageSpec(P) {
  const T = CAGE_DEFAULT, S = JSON.parse(JSON.stringify(T));
  const fr = (v, a, b) => (v - a) / (b - a);          // fraction of v in [a,b]
  const ap = (f, a, b) => a + f * (b - a);
  const upT = y => fr(y, T.waistY, T.cabin.roofY);    // template upper frac
  const up = f => ap(f, P.waistY, P.roofY);           // rebuilt upper y
  const dnT = y => fr(y, T.waistY, T.cabin.keelY);
  const dn = f => ap(f, P.waistY, P.keelY);
  const rW = P.halfW / T.cabin.halfW;

  S.waistY = P.waistY;
  S.bandY = P.waistY + P.bandH;
  S.top = { round: P.topRound, angCeil: P.topAngCeil, angRoof: P.topAngRoof,
            comp: P.topComp, bubble: P.bubble ? 1 : 0,
            botRound: P.botRound };
  S.glaze = { sky: P.skylight == null || P.skylight ? 1 : 0,
              ext: Math.max(0, Math.round(P.skyExt != null ? P.skyExt : 5)) };
  S.crease = { pillar: P.crPillar, sill: P.crSill, band: P.crBand,
               ceil: P.crCeil, frame: P.crFrame, cap: P.crCap,
               frontCap: P.crFrontCap, noseCap: P.crNoseCap };
  S.config = {
    noseMode: P.aeroNose ? 'aero' : 'cowl',
    rearAperture: P.rearAperture ? 1 : 0,
    noseCrown: P.noseCrown,
    noseFinish: P.noseFinish ? 'aero' : 'engine',
    cowl: { loops: Math.max(0, Math.round(P.cowlLoops)),
            ease: P.cowlEase, bulge: P.cowlBulge },
    aero: { wsLen: P.aeroWsLen, len: P.aeroLen, droop: P.aeroDroop,
            tipW: P.aeroTipW, tipH: P.aeroTipH, pillarW: 0.05 },
    boomMid: P.boomMidOn ? { t: P.boomMidT, pinch: P.boomMidPinch } : 0,
  };
  S.ws.baseLift = P.wsBaseLift;

  S.cabin = { halfW: P.halfW, roofHalfW: P.roofHalfW, roofY: P.roofY,
              keelY: P.keelY, floorY: P.floorY,
              ceilY: P.roofY - P.ceilInset * (P.roofY - up(upT(T.cabin.ceilY))) };

  S.ring.waistHalfW = P.halfW - P.ringPullIn;
  S.ring.keelY = dn(dnT(T.ring.keelY));
  S.ring.floorY = ap(fr(T.ring.floorY, T.waistY, T.cabin.floorY),
                     P.waistY, P.floorY);
  S.ring.ceilY = P.roofY - P.ceilInset * (P.roofY - up(upT(T.ring.ceilY)));

  S.pilot.len = P.pilotLen;
  S.pillarW = Math.max(0, P.pillarW || 0);
  S.cabinPillarW = P.pillarW > 0 ? P.pillarW : P.cabPillarW;
  S.pax.count = Math.max(0, Math.round(P.paxCount));
  S.pax.len = P.paxLen;
  S.paxPillarW = P.pillarW > 0 ? P.pillarW : P.paxPillarW;
  S.boom.len = P.boomLen;

  const aLean = { keel: T.aft.keelYA - T.aft.keelYB,
                  floor: T.aft.floorYA - T.aft.floorYB };
  S.aft.roofY = P.aftRoofY;
  S.aft.ceilY = ap(fr(T.aft.ceilY, T.waistY, T.aft.roofY), P.waistY, P.aftRoofY);
  S.aft.keelYB = P.aftKeelY;
  S.aft.floorYB = ap(fr(T.aft.floorYB, T.waistY, T.aft.keelYB),
                     P.waistY, P.aftKeelY);
  S.aft.keelYA = S.aft.keelYB + aLean.keel;
  S.aft.floorYA = S.aft.floorYB + aLean.floor;

  S.tail.len = P.tailLen;
  S.tail.halfW = P.tailHalfW;
  S.tail.roofY = P.tailRoofY;
  S.tail.keelY = P.tailKeelY;
  S.tail.ceilY = ap(fr(T.tail.ceilY, T.tail.keelY, T.tail.roofY),
                    P.tailKeelY, P.tailRoofY);
  S.tail.floorY = ap(fr(T.tail.floorY, T.tail.keelY, T.tail.roofY),
                     P.tailKeelY, P.tailRoofY);

  // windshield: front frame from run/top offsets, interior lines by the
  // template's fractional positions along the slope, aft ring by scaled
  // per-level offsets (the A-pillar width), chain by the two bows
  const wf = T.ws.front, wa = T.ws.aft, wc = T.ws.chain;
  const F = S.ws.front, A = S.ws.aft, C = S.ws.chain;
  F.waist = { x: S.ring.waistHalfW - (T.ring.waistHalfW - wf.waist.x),
              z: T.ring.z + P.wsRun };
  F.roofZ = T.ring.z + P.wsTopOff;
  F.ceil = { y: up(upT(wf.ceil.y)),
             z: ap(fr(wf.ceil.z, wf.roofZ, wf.waist.z), F.roofZ, F.waist.z) };
  F.bandZ = ap(fr(wf.bandZ, wf.waist.z, wf.ceil.z), F.waist.z, F.ceil.z);
  F.floorY = ap(fr(wf.floorY, T.waistY, T.cabin.floorY), P.waistY, P.floorY);
  F.keelY = dn(dnT(wf.keelY));
  C.waistZ = F.waist.z + P.wsBaseBow;
  C.ceil = { y: F.ceil.y, z: F.ceil.z + P.wsCeilBow };
  C.bandZ = ap(fr(wc.bandZ, wc.waistZ, wc.ceil.z), C.waistZ, C.ceil.z);
  // A-pillar band width per level. The template's z-deltas are hand-drawn
  // and uneven (0.0385..0.0458) — in ROUND mode that unevenness reads as a
  // frown along the frame, so the deltas are pulled to their mean with
  // roundness; the box path keeps the template numbers exactly.
  const s = P.apilW;
  const dz0 = { roof: wf.roofZ - wa.roofZ, ceil: wf.ceil.z - wa.ceil.z,
                band: wf.bandZ - wa.bandZ, waist: wf.waist.z - wa.waist.z,
                keel: wf.waist.z - wa.keel.z };
  const dzM = (dz0.roof + dz0.ceil + dz0.band + dz0.waist + dz0.keel) / 5;
  const rr = (S.top && S.top.round) || 0;
  const dz = {};
  for (const k in dz0) dz[k] = s * (dz0[k] + (dzM - dz0[k]) * rr);
  A.roofZ = F.roofZ - dz.roof;
  A.ceil = { y: F.ceil.y - s * (wf.ceil.y - wa.ceil.y), z: F.ceil.z - dz.ceil };
  A.bandZ = F.bandZ - dz.band;
  A.waist = { x: F.waist.x - s * (wf.waist.x - wa.waist.x),
              z: F.waist.z - dz.waist };
  A.floorY = F.floorY - s * (wf.floorY - wa.floorY);
  A.keel = { y: F.keelY - s * (wf.keelY - wa.keel.y),
             z: F.waist.z - dz.keel };
  // EVEN PERPENDICULAR WIDTH for the window pillar (user ruling): the
  // width is the perpendicular distance between the two frame edges, NOT
  // the z distance — a pure z offset reads sin(slope) thinner along the
  // angled part. The frame polyline is walked level by level: levels with
  // a pinned y (the rails, the roof, the vertical lower edge) take
  // dz = w / sin(local slope); the free ceil level offsets along the true
  // perpendicular. w = the template's mean width read AS the perpendicular
  // width (x apilW), so the drawn proportion is preserved. apilPerp
  // blends 0 -> 1; 0 is the exact template path (fit identity).
  const PERP = Math.max(0, Math.min(1, P.apilPerp || 0));
  if (PERP > 0) {
    const w = dzM * s;
    const BLift = P.wsBaseLift || 0;
    const pl = [
      [F.keelY,             F.waist.z],
      [P.waistY + BLift,    F.waist.z],
      [S.bandY + BLift,     F.bandZ],
      [F.ceil.y,            F.ceil.z],
      [P.roofY,             F.roofZ],
    ];
    const dirAt = i => {
      const a = pl[Math.max(0, i - 1)], b = pl[Math.min(pl.length - 1, i + 1)];
      const dy = b[0] - a[0], dzt = b[1] - a[1];
      const l = Math.hypot(dy, dzt) || 1;
      return [dy / l, dzt / l];
    };
    const zOff = i => w / Math.max(Math.abs(dirAt(i)[0]), 0.35);
    const bl = (a, b) => a + (b - a) * PERP;
    A.roofZ = bl(A.roofZ, F.roofZ - zOff(4));
    A.bandZ = bl(A.bandZ, F.bandZ - zOff(2));
    A.waist.z = bl(A.waist.z, F.waist.z - zOff(1));
    A.keel.z = bl(A.keel.z, F.waist.z - zOff(0));
    const [ty, tz] = dirAt(3);              // ceil: true perpendicular —
    const sgn = ty >= 0 ? 1 : -1;           // n = (tz,-ty), aft (n.z < 0)
    A.ceil = { y: bl(A.ceil.y, F.ceil.y + sgn * w * tz),
               z: bl(A.ceil.z, F.ceil.z - sgn * w * ty) };
  }

  // nose: template offsets off the windshield base, scaled. noseW/noseH
  // shrink the nose ring in width and depth (about the deck line), and
  // noseDroop lowers the whole nose end — the base-topology nose can taper
  // to a small drooped aperture (bizjet radome with crNoseCap low).
  const nr = T.nose.ring, nt = T.nose.twin;
  const nz = F.waist.z + P.noseLen;                   // nose ring deck flank z
  const nX = x => x * rW * P.noseW;
  const nY0 = y => y >= T.waistY ? y : dn(dnT(y));
  const nY = y => P.waistY + (nY0(y) - P.waistY) * P.noseH - P.noseDroop;
  const mkN = (tpl, z0) => ({
    deck:  { x: nX(tpl.deck.x), z: z0,
             zC: z0 + (tpl.deck.zC - tpl.deck.z) },
    floor: { x: nX(tpl.floor.x), y: nY(tpl.floor.y),
             z: z0 + (tpl.floor.z - tpl.deck.z),
             yC: nY(tpl.floor.yC != null ? tpl.floor.yC : tpl.floor.y),
             zC: z0 + ((tpl.floor.zC != null ? tpl.floor.zC : tpl.floor.z)
                       - tpl.deck.z) },
    keel:  { x: nX(tpl.keel.x), y: nY(tpl.keel.y),
             z: z0 + (tpl.keel.z - tpl.deck.z),
             yC: nY(tpl.keel.yC), zC: z0 + (tpl.keel.zC - tpl.deck.z) },
  });
  S.nose.ring = mkN(nr, nz);
  // front pillar band = noseTwin -> noseRing gap: unified pillar width
  // when set (x pfW as the fine-tune), template offset otherwise
  S.nose.twin = mkN(nt, nz - (P.pillarW > 0
    ? P.pillarW * P.pfW : P.pfW * (nr.deck.z - nt.deck.z)));
  S.nose.droop = P.noseDroop;
  S.win = { frameW: P.winFrameW, depth: P.winDepth, blow: P.winBlow,
            crGlass: P.crGlass, door: P.doorOn ? 1 : 0,
            doorDepth: P.doorDepth, rim: P.rimW,
            rimSides: P.rimSides || 8,
            rimWin: P.rimWin ? 1 : 0, rimWs: P.rimWs ? 1 : 0,
            rimDoor: P.rimDoor ? 1 : 0,
            doorSill: Math.max(0, P.doorSill || 0),
            // pax doors carry their own sill; spec-level W.sills =
            // {pilot: v, pax0: v, ...} overrides any door individually
            doorSillPax: Math.max(0,
              (P.doorSillPax != null ? P.doorSillPax : P.doorSill) || 0) };
  S.config.doors = { pilot: P.doorOn ? 1 : 0, pax: P.doorPax ? 1 : 0,
                     deep: P.doorDeep ? 1 : 0 };
  S.interior = { on: P.intOn ? 1 : 0, bulk: P.intBulk ? 1 : 0,
                 fire: P.intFire ? 1 : 0, dash: P.intDash ? 1 : 0,
                 dashBack: P.dashBack,
                 dashLip: P.dashLip != null ? P.dashLip : P.dashInset,
                 dashDepth: P.dashDepth, dashCrease: P.dashCrease };
  return S;
}

// ---------------------------------------------------------------------------
if (typeof module !== 'undefined')
  module.exports = { CAGE_DEFAULT, CAGE_PARAMS, CAGE_MAT, buildCage2,
                     cageResolve, cageSpec, cageSubdivide, cageRims,
                     cageInterior };
if (typeof window !== 'undefined')
  window.CAGE2 = { CAGE_DEFAULT, CAGE_PARAMS, CAGE_MAT, buildCage2,
                   cageResolve, cageSpec, cageSubdivide, cageRims,
                   cageInterior };
