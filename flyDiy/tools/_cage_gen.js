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
  // ring editor: the window ring may carry its own roof height and
  // flank width; the cabin PILLAR pair gets its own dim set when
  // offsets are present (identity alias otherwise — the fit path)
  const RO = S.ringOff || {};
  const ringD = { Ww: S.ring.waistHalfW + (RO.winW || 0),
                  Wk: W + (RO.winW || 0), Wr,
                  roofY: S.ring.roofY != null ? S.ring.roofY : c.roofY,
                  ceilY: S.ring.ceilY, floorY: S.ring.floorY, keelY: S.ring.keelY };
  const cabPilD = (RO.cabT || RO.cabB || RO.cabW) ? {
    ...cabD,
    Ww: cabD.Ww + (RO.cabW || 0),
    roofY: cabD.roofY + (RO.cabT || 0),
    ceilY: cabD.ceilY + (RO.cabT || 0),
    floorY: cabD.floorY + (RO.cabB || 0),
    keelY: cabD.keelY + (RO.cabB || 0),
  } : cabD;

  const CFG = S.config || {};
  // MIRRORED POD (G18 S2): the table stops at pilCabB — buildCage2
  // reflects the emitted front half about the pillar mid-plane
  // (mirrorZ below), so the tail stack, pax machinery and aft shoulder
  // never exist in this mode; the boom re-bases on the mirrored
  // aperture. pax is forced 0 in cageSpec.
  const MIR = !!CFG.mirror;
  if (!MIR) {
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
  }
  let z = zPaxB;
  if (!MIR) for (let i = 0; i < S.pax.count; i++) {
    add(fullRing('pilPaxB' + (i || ''), z, i ? cabD : aftDB),
        { mat: matPax(i), guards: [S.pax.guardTA, S.pax.guardTB] });
    z += S.pax.len;
    if (i < S.pax.count - 1) {
      add(fullRing('pilPaxM' + i, z, cabD),
          { mat: CAGE_PILLAR('pillarPassenger') });
      z += S.paxPillarW;
    }
  }
  if (!MIR) add(fullRing('pilCabA', z, cabPilD),
                { mat: CAGE_PILLAR('pillarCabin') });
  add(fullRing('pilCabB', z + S.cabinPillarW, cabPilD),
      { mat: matPilot, guards: [S.pilot.guardT] });
  const mirrorZ = z + S.cabinPillarW / 2;

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
    // ring editor: the screen pair's keel width rides ringOff.scrW
    // (the waist x offset is applied to the ws data in cageSpec)
    const kW = W + ((S.ringOff && S.ringOff.scrW) || 0);
    const kl = keelPlanar
      ? { x: kW, y: keel.y, z: waist.z, yC: keel.y, zC: waist.z }
      : { x: kW, y: keel.y, z: keel.z, yC: keel.y, zC: keel.z };
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
  // BUBBLE BASE (user, sketch 2026-08-18): the window-pillar RING PAIR +
  // crease is the template's FOLD mechanism — the opposite of what a
  // bubble needs. In bubble mode wsAft is NOT EMITTED: no pair, no
  // crease, no double points on the seam — the cutout rim becomes one
  // continuous, evenly spaced loop for the canopy to interpolate.
  if (!(CFG.canopy && CFG.canopy.mode === 'bubble'))
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
  const NL = S.nose.lift || 0;     // ring editor: nose-ring deck lift
  const noseLv = n => ({
    waist: { x: n.deck.x, y: S.waistY - ND + NL, z: n.deck.z,
             yC: S.waistY + CROWN * (n.crownF != null ? n.crownF : 1)
                 - ND + NL, zC: n.deck.zC },
    floor: { x: n.floor.x, y: n.floor.y, z: n.floor.z,
             yC: n.floor.yC != null ? n.floor.yC : n.floor.y,
             zC: n.floor.zC != null ? n.floor.zC : n.floor.z },
    keel:  { x: n.keel.x, y: n.keel.y, z: n.keel.z,
             yC: n.keel.yC != null ? n.keel.yC : n.keel.y,
             zC: n.keel.zC != null ? n.keel.zC : n.keel.z },
  });
  const noseTwin = { name: 'noseTwin', kind: 'nose', lv: noseLv(S.nose.twin) };
  const noseRing = { name: 'noseRing', kind: 'nose', lv: noseLv(S.nose.ring) };

  // ---- BUBBLE CREST (config.crest) ---------------------------------------
  // A smooth longitudinal crest over the pilot+pax cabin: roof/ceil of
  // every station inside [aft shoulder .. windshield top] lifts onto an
  // eased bump (sin^2 — zero slope at both ends AND at the apex), and
  // optional 'crest' FORMER loops add mid-bay samples so the apex can
  // live between stations. Formers carry no crease family and no pillar
  // material, so the interior pass never sees them as structure — real
  // aeroplanes round a turtledeck exactly this way: light formers over
  // the load-carrying frame. h 0 / absent = untouched (fit identity).
  if (CFG.crest && CFG.crest.h > 0) {
    const CR = CFG.crest;
    const z0 = zPaxA, z1 = wa.roofZ;
    const s2 = t => { const s = Math.sin(Math.PI * 0.5 * t); return s * s; };
    const dy = z => {
      const u = (z - z0) / (z1 - z0);
      if (u <= 0 || u >= 1) return 0;
      const a = Math.min(0.9, Math.max(0.1, CR.at));
      return CR.h * (u <= a ? s2(u / a) : s2((1 - u) / (1 - a)));
    };
    for (const r of rings) {
      const lr = r.lv.roof, lc = r.lv.ceil;
      if (lr) { const d = dy(lr.z); lr.y += d; if (lr.yC != null) lr.yC += d; }
      if (lc) lc.y += dy(lc.z);
    }
    const n = Math.min(2, CR.loops || 0);
    if (n) for (let i = rings.length - 2; i >= 0; i--) {
      const A = rings[i], B = rings[i + 1], bay = bays[i];
      if (!bay || bay.mat === CAGE_MAT.plain || isPillarMat(bay.mat)) continue;
      const zA = A.lv.roof.z, zB = B.lv.roof.z;
      if (Math.min(zA, zB) < z0 - 1e-9 || Math.max(zA, zB) > z1 + 1e-9)
        continue;
      // sub-bays cannot carry the bay's guard fractions (full-bay ts) —
      // crest bays drop guards; crest is never on the fit path
      bays[i] = { mat: bay.mat };
      const ins = [];
      for (let s = 1; s <= n; s++) {
        const t = s / (n + 1);
        const r = lerpRing(A, B, t, 'crest' + i + '_' + s);
        // the lerp inherits the stations' lift linearly; correct roof and
        // ceil onto the true arc at the loop's own z
        const fix = (l, la, lb) => {
          if (!l || !la || !lb) return;
          const d = dy(l.z) - (dy(la.z) * (1 - t) + dy(lb.z) * t);
          l.y += d; if (l.yC != null) l.yC += d;
        };
        fix(r.lv.roof, A.lv.roof, B.lv.roof);
        fix(r.lv.ceil, A.lv.ceil, B.lv.ceil);
        ins.push(r);
      }
      rings.splice(i + 1, 0, ...ins);
      bays.splice(i + 1, 0, ...ins.map(() => ({ mat: bay.mat })));
    }
  }

  // (the G16 bubble-canopy repositioning experiment lived here — DELETED
  // at user request 2026-08-18, pending a re-explained design once the
  // convertible/open modes and their dash are right. The cutout modes in
  // buildCage2 are the keepers; the seam they expose stays the contract
  // for whatever the bubble becomes.)

  return { rings, bays, chain, noseTwin, noseRing, mirrorZ };
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
  // canopy (G16): 'conv' opens the pilot-area top (windshield stays),
  // 'open' also removes the windshield + A-pillar above the cut. The cut
  // line is the waistband TOP ('band') or BOTTOM ('waist') — the exposed
  // rail is max-creased (THE CREASE LAW: a boundary must stay put), which
  // also makes the open mesh safe through cageSubdivide: sharp edge
  // points never average missing faces.
  const CNY = S.config && S.config.canopy && S.config.canopy.mode
    && S.config.canopy.mode !== 'closed' ? S.config.canopy : null;
  // bubble = the open cutout (windshield removed, wsAft ring not even
  // emitted) + the dedicated CANOPY CAGE emitted below, subdivided with
  // everything else
  const CNCUT = CNY && (CNY.mode === 'conv' || CNY.mode === 'open'
    || CNY.mode === 'bubble') ? CNY : null;
  const CNBUB = !!(CNY && CNY.mode === 'bubble');
  const cutLv = CNY ? (CNY.ref === 'waist' ? 'waist' : 'band') : null;
  const cutHi = k => k === 'roof' || k === 'ceil'
    || (cutLv === 'waist' && k === 'band') || k === 'bandG';
  const R = cageResolve(S);
  const MIR = !!(S.config && S.config.mirror);
  const LV = sv === 0 ? ['roof', 'waist', 'keel']
    : sv === 1 ? ['roof', 'ceil', 'band', 'waist', 'floor', 'keel']
    : ['roof', 'ceil', 'bandG', 'band', 'waist', 'waistG', 'floor', 'keel'];

  // ---- ring sequence for this step ---------------------------------------
  const STEP0_XTRA = new Set(['aeroWsB', 'noseMid', 'boomMid']);
  const kept = [], keptBay = [];
  R.rings.forEach((r, i) => {
    if (sv === 0 && (STEP0_DROP.has(r.name) || STEP0_XTRA.has(r.name)
        || /^crest/.test(r.name))) return;
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
  const V = [], F = [], dashRim = [], seamS = [], seamA = [];
  const dashRimA = [], seamSA = [];      // pod bubble: aft-half records
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
  // crest mode: the roof/ceil rails BEND, and a pillar crease crossing a
  // bent rail corner-pins it (the refined crossing law: pins are invisible
  // on straight lines, ruinous on bent ones). Span pillars therefore keep
  // their crease only from the waistband down — the upper band goes soft,
  // which is what canopy hoops following a dome look like.
  const tagLoopLow = (o, r, w) => {
    const lv = LV.filter(k => r.lv[k] != null);
    const pts = [];
    if (o.C[lv[0]] != null) pts.push([lv[0], o.C[lv[0]]]);
    for (const k of lv) if (o.P[k] != null) pts.push([k, o.P[k]]);
    if (o.C[lv[lv.length - 1]] != null)
      pts.push([lv[lv.length - 1], o.C[lv[lv.length - 1]]]);
    for (let i = lv.length - 1; i >= 0; i--)
      if (o.M[lv[i]] != null) pts.push([lv[i], o.M[lv[i]]]);
    const hiL = k => k === 'roof' || k === 'ceil' || k === 'bandG';
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i], B = pts[(i + 1) % pts.length];
      if (hiL(A[0]) || hiL(B[0])) continue;
      tagE(A[1], B[1], w);
    }
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
  // mirrored pod: seq[0] is pilCabB — its aft side is covered by the
  // reflected half, never a cap
  if (!MIR)
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
    // bay identity: inserted rings (crest/crestB formers) belong to the
    // station bay behind them — walk back for the OWNING station's name
    // (door marks and the canopy tests key on it)
    let bi = i;
    while (bi > 0 && /^crest/.test(seq[bi].name)) bi--;
    const bayName = seq[bi].name;
    // canopy: pilot-area gaps = the pilot + quarter bays (pilot glass,
    // not a pillar); the A-pillar band gap joins the cut in 'open' only
    const cnPilot = CNY && !isPillarMat(mat) && mat.glass === 'pilotWindow';
    const cut = CNCUT && (cnPilot
      || (CNCUT.mode === 'open' && bayName === 'wsAft'));
    if (!cut) {
      face(a.C.roof, b.C.roof, b.P.roof, a.P.roof, mat.roof);
      face(a.M.roof, b.M.roof, b.C.roof, a.C.roof, mat.roof);
      // the roof strip is glass when the skylight covers this bay; marking
      // it joins the two sides across the centreline, so bubble + skylight
      // union-finds into ONE door-to-door arch per bay
      if (creaseMode && mat.roof === 'skyWindows')
        F[F.length - 1].win = F[F.length - 2].win = 1;
    }
    // the exposed rail is a boundary — it must stay put through CC:
    // weight 3. The FRONT segments (A-pillar gap) are also RECORDED as
    // the dash base line for 'open' mode: generic boundary tracing is
    // poisoned there (the door hole merges with the cockpit rim once
    // the roof is gone, and interior sheets add their own boundaries) —
    // the emitter KNOWS the seam, so it says so, exactly like wsBase.
    if (E && cut) {
      // bubble (user): the WHOLE window-pillar section flows smooth —
      // the quarter-bay rim relaxes to 1 and the slope rim below goes
      // free, so the old A-pillar fold melts; the canopy follows the
      // rounded seam automatically because it SAMPLES the displayed
      // boundary (the post-pass strategy pays off here)
      const wRim = CNBUB && bayName === 'ring' ? 1 : 3;
      tagE(a.P[cutLv], b.P[cutLv], wRim);
      tagE(a.M[cutLv], b.M[cutLv], wRim);
      if (bayName === 'wsAft') {
        dashRim.push([a.P[cutLv], b.P[cutLv]], [a.M[cutLv], b.M[cutLv]]);
      }
      // bubble: the sill rails are the canopy's side boundary (seamS)
      if (CNBUB && cnPilot) {
        seamS.push([a.P[cutLv], b.P[cutLv]], [a.M[cutLv], b.M[cutLv]]);
      }
    }
    const sh = ordOf(seq[i]).filter(k => seq[i + 1].lv[k] != null);
    for (let k = 0; k < sh.length - 1; k++) {
      const hi = sh[k], lo = sh[k + 1], m = bandMat(mat, hi, lo);
      if (cut && cutHi(hi)) continue;
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
      // a frame ring crease would PIN the repositioned canopy (bent
      // crossing) — the bubble's front frame is the seam crease instead
      // bubble: the remaining window-pillar ring must read SMOOTH (user:
      // "round the angles of the pillar — relaxing its crease should
      // work") — the front corner surface rounds with it
      : nm === 'wsAft' || nm === 'wsFront' ? (CNBUB ? 0 : CW.frame)
      : /^aeroWs/.test(nm) ? CW.frame
      : nm === 'noseTip' ? (CW.frontCap != null ? CW.frontCap : 0.3)
      : 0;
    const crestOn = !!(S.config && S.config.crest && S.config.crest.h > 0);
    seq.forEach((r, i) => {
      const w = fam(r.name);
      if (!w) return;
      if (crestOn && (/^pilPax/.test(r.name) || /^pilCab/.test(r.name)))
        tagLoopLow(ids[i], r, w);
      else tagLoop(ids[i], r, w);
    });
    // bubble: the arch's front-face outline above the cut is the canopy's
    // rear boundary (seamA) — the ordered upper run of the pilCabB loop,
    // foot to foot through the crown
    if (CNBUB) {
      const i2 = seq.findIndex(r => r.name === 'pilCabB');
      if (i2 >= 0) {
        const o = ids[i2];
        const upper = LV.slice(0, LV.indexOf(cutLv) + 1);  // roof..cutLv
        const run = [];
        for (let k = upper.length - 1; k >= 0; k--)
          if (o.P[upper[k]] != null) run.push(o.P[upper[k]]);
        if (o.C.roof != null) run.push(o.C.roof);
        for (let k = 0; k < upper.length; k++)
          if (o.M[upper[k]] != null) run.push(o.M[upper[k]]);
        for (let k = 0; k + 1 < run.length; k++)
          seamA.push([run[k], run[k + 1]]);
      }
    }
  }

  // ---- forward end --------------------------------------------------------
  // aero mode: the rings already ran to the tip — close with the front cap
  if (R.aero) {
    emitCap(ids[seq.length - 1], seq[seq.length - 1], capMat(false));
    orientCage({ V, F });
    return E ? { V, F, E } : { V, F };
  }

  // ---- windshield slope + deck + cowl + nose (cowl mode) ------------------
  let mirAp = null;      // mirrored pod: aperture ring + its cap face range
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
    const cutSlope = CNCUT
      && (CNCUT.mode === 'open' || CNCUT.mode === 'bubble');
    for (let k = 0; k < sOrd.length - 1; k++) {
      const hi = sOrd[k], lo = sOrd[k + 1], m = slopeMat(hi, lo);
      if (cutSlope && cutHi(hi)) continue;      // 'open': no windshield
      face(a.P[hi], a.P[lo], chain[lo], chain[hi], m);
      face(chain[hi], chain[lo], a.M[lo], a.M[hi], m);
      // the windshield glass gets a joint too; left and right share the
      // centre-chain edges so the union-find yields ONE zone with one
      // outline around the whole screen
      if (creaseMode && m === 'windshield')
        F[F.length - 1].win = F[F.length - 2].win = 1;
    }
    // the rails continue across the slope: sill = the windshield base edge
    // (bubble: released — the front must flow, user ruling)
    if (E && !CNBUB) for (const [k, w] of [['waist', CW.sill], ['band', CW.band],
                                 ['ceil', CW.ceil]]) {
      if (a.P[k] != null && chain[k] != null) {
        tagE(a.P[k], chain[k], w);
        tagE(chain[k], a.M[k], w);
      }
    }
    // the exposed slope rail is a boundary: weight 3, and it is the
    // front arc of the dash base line
    if (E && cutSlope && a.P[cutLv] != null
        && chain[cutLv] != null) {
      if (!CNBUB) {
        tagE(a.P[cutLv], chain[cutLv], 3);
        tagE(chain[cutLv], a.M[cutLv], 3);
      }
      dashRim.push([a.P[cutLv], chain[cutLv]], [chain[cutLv], a.M[cutLv]]);
    }
    // (the G16c v2 in-cage canopy emission lived here — moved to the
    // cageCanopy POST-PASS same day: fusing to cage verts froze the
    // seam's ANGULAR cage shape, when the target is the smooth curve
    // the displayed seam takes after subdivision. The seam recordings
    // above are its input.)

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
        // ring editor: per-loop flank width offset (the intermediate
        // loops between the cabin and the nose are individually
        // settable, user ruling)
        const cwO = S.ringOff && S.ringOff.cowl
          ? (S.ringOff.cowl[i - 1] || 0) : 0;
        if (cwO) for (const k of ['waist', 'floor', 'keel'])
          if (lv[k]) lv[k].x += cwO;
        noseSeq.push(prepNose({ name: 'cowlLoop' + i, lv }));
      }
    }
    // the TWIN BAND STAYS in aero finish too (user: the pillar is a
    // structural station, not an engine accessory — it vanished with
    // pusher/aero configs); the cone runs cowl -> band -> tip
    if (sv >= 1) {
      let tw;
      if (aeroFin) {
        // aero cone: the band's TEMPLATE section is engine-sized and
        // shouldered out of the taper (user: the nose kept a fat
        // face). The twin's whole section now sits ON the cowl
        // profile at its own z — the same math as the loops — so the
        // cone runs smooth through the band to the (collapsible) tip.
        const zw2 = wsLow.waist.z, zr2 = R.noseRing.lv.waist.z;
        const t2 = Math.max(0, Math.min(1,
          (R.noseTwin.lv.waist.z - zw2) / ((zr2 - zw2) || 1e-9)));
        const e2 = t2 * (1 - cowl.ease)
                 + (1 - Math.sqrt(Math.max(0, 1 - t2 * t2))) * cowl.ease;
        const lv3 = {};
        for (const k of ['waist', 'floor', 'keel']) {
          lv3[k] = lerpLv(wsLow[k], R.noseRing.lv[k], e2);
          lv3[k].z = wsLow[k].z
                   + (R.noseRing.lv[k].z - wsLow[k].z) * t2;
          if (lv3[k].zC != null) {
            const az = wsLow[k].zC != null ? wsLow[k].zC : wsLow[k].z;
            const bz = R.noseRing.lv[k].zC != null
              ? R.noseRing.lv[k].zC : R.noseRing.lv[k].z;
            lv3[k].zC = az + (bz - az) * t2;
          }
        }
        tw = prepNose({ name: 'noseTwin', lv: lv3 });
      } else {
        tw = prepNose(R.noseTwin);
        // THE PILLAR FOLLOWS THE ACTIVE CURVE (user, red/green
        // sketch): the twin and the nose ring shared one constant
        // crown, so the pillar band was a FLAT segment interrupting
        // the eased deck profile. The twin's deck centre now takes
        // the cowl profile's own value at its z (same ease law as
        // the loops); identity when the chain and ring crowns
        // already agree (template path).
        const yCw = wsLow.waist.yC, yCr = R.noseRing.lv.waist.yC;
        if (Math.abs(yCw - yCr) > 1e-9) {
          const zw = wsLow.waist.z, zr = R.noseRing.lv.waist.z;
          const t = Math.max(0, Math.min(1, (tw.lv.waist.z - zw) /
            ((zr - zw) || 1e-9)));
          const e = t * (1 - cowl.ease)
                  + (1 - Math.sqrt(Math.max(0, 1 - t * t))) * cowl.ease;
          tw.lv.waist = { ...tw.lv.waist, yC: yCw + (yCr - yCw) * e };
        }
      }
      noseSeq.push(tw);
    }
    noseSeq.push(prepNose(R.noseRing));
    const nIds = noseSeq.map((r, i) => mkIds(r, i === noseSeq.length - 1));

    // low bands: wsFront -> [cowl loops] -> [twin] -> ring; deck at waist
    const lowSets = [];
    lowSets.push({ a: { P: a.P, M: a.M, C: { waist: chain.waist, keel: a.C.keel } },
                   b: nIds[0], mat: CAGE_MAT.plain, deck: 'body' });
    for (let i = 0; i + 1 < nIds.length; i++) {
      const pf = noseSeq[i].name === 'noseTwin'
              && noseSeq[i + 1].name === 'noseRing';
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
      // the sill continues as the cowl deck edge — with its OWN weight
      // when set (user: the deck must be able to smooth out while the
      // cabin sill stays creased; -1 follows crSill = fit identity)
      if (E) {
        const wS = CW.sillNose != null && CW.sillNose >= 0
          ? CW.sillNose : CW.sill;
        tagE(s.a.P.waist, s.b.P.waist, wS);
        tagE(s.a.M.waist, s.b.M.waist, wS);
      }
    }

    // nose cap grid
    {
      const o = nIds[nIds.length - 1];
      const pres = lowOrd.filter(k => o.P[k] != null);
      const engineCap = !aeroFin;      // engine aperture face -> firewall
      const capF0 = F.length;
      for (let k = 0; k < pres.length - 1; k++) {
        const hi = pres[k], lo = pres[k + 1];
        const m = hi === 'floor' ? 'floorLoop' : 'body';
        face(o.P[hi], o.P[lo], o.C[lo], o.C[hi], m);
        face(o.C[hi], o.C[lo], o.M[lo], o.M[hi], m);
        if (engineCap && creaseMode)
          F[F.length - 1].capFace = F[F.length - 2].capFace = 1;
      }
      // the mirrored copy of this cap is SKIPPED — the boom extrudes
      // from the open aft aperture instead
      if (MIR) mirAp = { o, r: noseSeq[noseSeq.length - 1],
                         capF0, capF1: F.length };
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
  if (E && !MIR) tagLoop(ids[0], seq[0], CW.cap);      // tail cap edge

  // ---- MIRRORED POD (user design, G18 S2) ---------------------------------
  // The aft half is the front half REFLECTED about the cabin-pillar
  // mid-plane: the aft deck falls away exactly like the nose rises,
  // which no cutaway can produce. The mirror is INITIAL GEOMETRY only
  // (per-half controls are a later chantier) and happens at the
  // emitted-cage level, so the slope/cowl/nose machinery runs once,
  // forward, and every material, zone mark and crease tag reflects by
  // construction. The pilCabB ring pair bridges into the ARCEAU (the
  // central pillar band — v1 keeps it as real structure; the
  // single-loop collapse is the S4 chantier). The mirrored aperture
  // keeps no cap: the BOOM extrudes from it ("stick the boom in place
  // of the engine", user), tapering to a tip drawn from the tail
  // params.
  if (MIR && !(S.config && S.config.mirrorHalfOnly)) {
    // S2.5 — PER-HALF CONTROLS: with aft overrides the reflected half
    // is a SECOND EMISSION of the front block from the substituted
    // spec (config.mirrorAftSpec) — mirroring stays the initial
    // geometry only, each half owns its params. Without overrides the
    // half reflects itself (the bit-identical S2 path). The reflection
    // constant aligns the SOURCE's pilCabB ring onto the arceau's aft
    // edge whatever the source's own z layout (aftPilotLen moves it).
    const SA = S.config.mirrorAftSpec;
    let sV = V, sF = F, sE = E, sAp = mirAp, sIds0 = ids[0],
        sDR = dashRim, sSS = seamS,
        zBs = R.mirrorZ + S.cabinPillarW / 2;
    if (SA) {
      const half = buildCage2(SA, step);
      sV = half.V; sF = half.F; sE = half.E || null;
      sAp = half._mirAp; sIds0 = half._ids0; zBs = half._zB;
      sDR = half.dashRim || []; sSS = half.seamS || [];
    }
    const zBm = R.mirrorZ + S.cabinPillarW / 2;
    const CZ = zBm - S.cabinPillarW + zBs;
    const rz = z => CZ - z;
    const nF0 = sF.length;
    const map = new Map();
    const mOf = i => {
      if (!map.has(i)) {
        const p = sV[i];
        map.set(i, P(p[0], p[1], rz(p[2])));
      }
      return map.get(i);
    };
    for (let i = 0; i < nF0; i++) {
      if (sAp && i >= sAp.capF0 && i < sAp.capF1) continue;
      const f = sF[i];
      // the aft twin band IS the pod's passenger pillar (user) — it
      // reads as one in the sections legend and to the interior
      const nf = { v: f.v.slice().reverse().map(mOf),
                   m: f.m === 'pillarFront' ? 'pillarPassenger' : f.m };
      if (f.win) nf.win = 1;
      F.push(nf);
    }
    // S3 — the pod bubble's seam lives on BOTH halves: the records
    // reflect through the vertex map. dashRimA = the aft screen's base
    // arc (the canopy's rear boundary, taking the arch's role), seamSA
    // = the aft sill rails (cageCanopy merges them with the front's
    // across the arceau).
    for (const [a, b] of sDR)
      if (map.has(a) && map.has(b))
        dashRimA.push([map.get(a), map.get(b)]);
    for (const [a, b] of sSS)
      if (map.has(a) && map.has(b))
        seamSA.push([map.get(a), map.get(b)]);
    // the ARCEAU: bridge seq[0] (pilCabB) to the source half's pilCabB
    // reflection with the pillar band materials — the generic bay
    // idiom on the ring pair. The cabin section params are shared, so
    // the two rings are identical and the band is a clean prism. The
    // mirrored ring builds through mOf (create-on-demand): in bubble
    // mode the source's upper ring verts are face-orphaned (the skin
    // above the seam is cut), yet the hoop still spans them — and this
    // runs BEFORE the crease copy so the hoop's loop tags reflect too.
    const o = ids[0], r0 = seq[0];
    const mo = { P: {}, M: {}, C: {} };
    for (const g of ['P', 'M', 'C'])
      for (const k in sIds0[g]) mo[g][k] = mOf(sIds0[g][k]);
    if (E && sE) for (const [k, w] of [...sE]) {
      const [a, b] = k.split('_').map(Number);
      if (map.has(a) && map.has(b)) tagE(map.get(a), map.get(b), w);
    }
    const pm = CAGE_PILLAR('pillarCabin');
    face(mo.C.roof, o.C.roof, o.P.roof, mo.P.roof, pm.roof);
    face(mo.M.roof, o.M.roof, o.C.roof, mo.C.roof, pm.roof);
    const shA = ordOf(r0);
    for (let k = 0; k + 1 < shA.length; k++) {
      const hi = shA[k], lo = shA[k + 1], m2 = bandMat(pm, hi, lo);
      face(mo.P[hi], o.P[hi], o.P[lo], mo.P[lo], m2);
      face(mo.M[lo], o.M[lo], o.M[hi], mo.M[hi], m2);
    }
    face(mo.P.keel, o.P.keel, o.C.keel, mo.C.keel, pm.belly);
    face(mo.C.keel, o.C.keel, o.M.keel, mo.M.keel, pm.belly);
    // BOOM from the mirrored aperture: sections lerp the aperture
    // levels to a tip section drawn from the tail params, z marching
    // aft over boomLen + tailLen; smooth stations (CC fairs the cone),
    // capped and cap-creased at the tip only.
    if (sAp) {
      const ap = sAp.r.lv;
      const apIds = { P: {}, M: {}, C: {} };
      for (const g of ['P', 'M', 'C'])
        for (const k in sAp.o[g])
          if (map.has(sAp.o[g][k]))
            apIds[g][k] = map.get(sAp.o[g][k]);
      const tipY = { waist: S.tail.roofY, floor: S.tail.floorY,
                     keel: S.tail.keelY };
      const dzB = S.boom.len + S.tail.len;
      const mk2 = (lv2, cap2) => {
        const o2 = { P: {}, M: {}, C: {} };
        for (const k in lv2) {
          const l = lv2[k];
          o2.P[k] = P(l.x, l.y, l.z);
          o2.M[k] = P(-l.x, l.y, l.z);
          if (k === 'waist' || k === 'keel' || cap2)
            o2.C[k] = P(0, l.yC != null ? l.yC : l.y,
                        l.zC != null ? l.zC : l.z);
        }
        return o2;
      };
      // stations mirror the regular tail (user: "the pod's boom is
      // the boom without the top part — it needs the same pillar"):
      // smooth boom run, then the TAIL PILLAR BAND over pillarW, then
      // the cone over tailLen to the capped tip. The band takes
      // pillarTail + the pillar crease on both rings, so the
      // interior's band machinery gives the pod a tail frame exactly
      // like the regular plane's.
      const pwT = S.pillarW > 0 ? S.pillarW : 0.05 * S.tail.len;
      const tPost = Math.min(0.92, S.boom.len / dzB);
      const tMid = Math.max(0.05, tPost - pwT / dzB);
      const stations = [
        { t: tMid * 0.45 }, { t: tMid * 0.78 }, { t: tMid },
        { t: tPost, band: 1 }, { t: 1, cap: 1 },
      ];
      let pa = apIds, paLv = null;
      for (const st of stations) {
        const t = st.t;
        const lv2 = {};
        for (const k of ['waist', 'floor', 'keel']) {
          const l = ap[k];
          if (!l) continue;
          lv2[k] = { x: l.x + (S.tail.halfW - l.x) * t,
                     y: l.y + (tipY[k] - l.y) * t,
                     z: rz(l.z) - dzB * t };
          if (l.yC != null) lv2[k].yC = l.yC + (tipY[k] - l.yC) * t;
          if (l.zC != null) lv2[k].zC = rz(l.zC) - dzB * t;
        }
        if (sv >= 2 && lv2.waist && lv2.floor)
          lv2.waistG = lerpLv(lv2.waist, lv2.floor, S.gWaistT);
        const pb = mk2(lv2, !!st.cap);
        const mDk = st.band ? 'pillarTail' : 'body';
        face(pa.P.waist, pb.P.waist, pb.C.waist, pa.C.waist, mDk);
        face(pa.C.waist, pb.C.waist, pb.M.waist, pa.M.waist, mDk);
        const shB = LV.filter(k => pa.P[k] != null && pb.P[k] != null
          && (k === 'waist' || k === 'waistG' || k === 'floor'
              || k === 'keel'));
        for (let k2 = 0; k2 + 1 < shB.length; k2++) {
          const hi = shB[k2], lo = shB[k2 + 1];
          const m2 = st.band ? 'pillarTail'
            : hi === 'floor' ? CAGE_MAT.plain.floorB
            : CAGE_MAT.plain.door;
          face(pa.P[hi], pb.P[hi], pb.P[lo], pa.P[lo], m2);
          face(pa.M[lo], pb.M[lo], pb.M[hi], pa.M[hi], m2);
        }
        const mBl = st.band ? 'pillarTail' : CAGE_MAT.plain.belly;
        face(pa.P.keel, pb.P.keel, pb.C.keel, pa.C.keel, mBl);
        face(pa.C.keel, pb.C.keel, pb.M.keel, pa.M.keel, mBl);
        if (E && st.band) {
          if (paLv) tagLoop(pa, { lv: paLv }, CW.pillar);
          tagLoop(pb, { lv: lv2 }, CW.pillar);
        }
        if (st.cap) {
          const pres2 = ['waist', 'waistG', 'floor', 'keel']
            .filter(k => pb.P[k] != null);
          for (let k2 = 0; k2 + 1 < pres2.length; k2++) {
            const hi = pres2[k2], lo = pres2[k2 + 1];
            const m2 = hi === 'floor' ? 'floorLoop' : 'body';
            face(pb.P[hi], pb.P[lo], pb.C[lo], pb.C[hi], m2);
            face(pb.C[hi], pb.C[lo], pb.M[lo], pb.M[hi], m2);
          }
          if (E) tagLoop(pb, { lv: lv2 }, CW.cap);
        }
        pa = pb; paLv = lv2;
      }
    }
  }

  orientCage({ V, F });
  const out = E ? { V, F, E } : { V, F };
  if (dashRim.length) out.dashRim = dashRim;
  if (seamS.length) out.seamS = seamS;
  if (seamA.length) out.seamA = seamA;
  if (dashRimA.length) out.dashRimA = dashRimA;
  if (seamSA.length) out.seamSA = seamSA;
  // half-only emission (the S2.5 aft-spec recursion): hand the caller
  // what the reflection needs — the aperture cap range, the pilCabB
  // ring ids, and this build's own pillar-plane z
  if (MIR && S.config && S.config.mirrorHalfOnly) {
    out._mirAp = mirAp;
    out._ids0 = ids[0];
    out._zB = R.mirrorZ + S.cabinPillarW / 2;
    return out;
  }
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
    if (kind === 'door' && sill > 0 && !(S.cut && S.cut.on)) {
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
    // wood doors are FRAMED, not sealed (user: the door is integral
    // structure): the door tube is suppressed when the interior builds
    // that door's section in wood — cageInterior raises the wooden
    // frame from this same recorded outline. Windows and the
    // windshield keep their seals in every construction.
    const IC = S.interior || {};
    const CMr = IC.consMap || {};
    const consD = (doorKey && doorKey.lastIndexOf('pax', 0) === 0
      ? CMr.paxBelow : CMr.pilotBelow) || IC.cons || 'carbon';
    // structural doors carry no rubber seal: wood/metal raise a frame,
    // tube its own tube outline (all from this same recorded outline)
    const structDoor = IC.on &&
      (consD === 'wood' || consD === 'tube' || consD === 'metal');
    const enabled = kind === 'door' ? (W.rimDoor && !structDoor)
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
      // merge micro-segments FIRST: the sill-clip junction points sit a
      // hair from their neighbours, splitting a 90-deg corner across two
      // vertices with tiny arms — the fillet size (0.4 x arm) collapsed
      // and door corners stayed chamfered (user report). Points closer
      // than 0.6 r to the kept predecessor drop.
      const P0 = [], N0 = [];
      for (let i = 0; i < pts.length; i++) {
        const prev = P0.length ? P0[P0.length - 1] : null;
        if (prev && Math.hypot(pts[i][0]-prev[0], pts[i][1]-prev[1],
                               pts[i][2]-prev[2]) < r * 0.6) continue;
        P0.push(pts[i]); N0.push(ns[i]);
      }
      if (m.rimDebug)
        m.outlines[m.outlines.length - 1].stageMerge = P0.map(p => p.slice());
      if (P0.length > 2) {
        const a = P0[0], b = P0[P0.length - 1];
        if (Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) < r * 0.6) {
          P0.pop(); N0.pop();
        }
      }
      // SPLIT-CORNER RECONSTRUCTION (replaces the fold-to-chord collapse,
      // measured harmful): a corner split across two NEARBY vertices
      // (segment < ~2.5 r, combined turn > ~30 deg) becomes ONE point
      // where the outer arms meet (closest approach of the two arm
      // lines; the pair midpoint when the arms are parallel or the meet
      // runs away) — the exact inverse of the split, so the path passes
      // through the TRUE corner and the fillet sees one full turn.
      // The old pass folded any low-deviation vertex onto its
      // neighbours' chord, which was scale-dependent (fired at one
      // subsurf level and not the next: the windshield top apex folded
      // at L2 only — the user's "missing mid interpolation point"),
      // order-dependent (L/R doors diverged, 108 vs 114 path points)
      // and CASCADING — each fold re-based the next test, flattening
      // whole curved runs (pane top corner at L3: 0.056 off the drawn
      // boundary, 4.6 r, measured). Reconstruction cannot cascade: it
      // only fires on sub-seal-scale segments and the new point is
      // clamped within 3 r of the pair it replaces.
      for (let pass = 0; pass < 4; pass++) {
        let did = false;
        for (let i = 0; P0.length > 4 && i < P0.length; i++) {
          const Np = P0.length, i1 = (i + 1) % Np;
          const p = P0[i], q = P0[i1];
          const seg = Math.hypot(...sub(q, p));
          if (seg >= r * 2.5) continue;
          const a = P0[(i - 1 + Np) % Np], b = P0[(i1 + 1) % Np];
          const dIn = nrm(sub(p, a)), dMid = nrm(sub(q, p)),
                dOut = nrm(sub(b, q));
          const t0 = dIn[0]*dMid[0] + dIn[1]*dMid[1] + dIn[2]*dMid[2];
          const t1 = dMid[0]*dOut[0] + dMid[1]*dOut[1] + dMid[2]*dOut[2];
          const turn = Math.acos(Math.max(-1, Math.min(1, t0)))
                     + Math.acos(Math.max(-1, Math.min(1, t1)));
          if (turn < 0.52) continue;
          const mid = [(p[0]+q[0])/2, (p[1]+q[1])/2, (p[2]+q[2])/2];
          // closest approach of line(p, dIn) and line(q, dOut)
          const c = dIn[0]*dOut[0] + dIn[1]*dOut[1] + dIn[2]*dOut[2];
          const w0 = sub(p, q);
          const den = 1 - c * c;
          let X = mid;
          if (Math.abs(den) > 1e-6) {
            const wA = w0[0]*dIn[0] + w0[1]*dIn[1] + w0[2]*dIn[2];
            const wB = w0[0]*dOut[0] + w0[1]*dOut[1] + w0[2]*dOut[2];
            const tt = (c * wB - wA) / den;
            const ss = (wB - c * wA) / den;
            X = [(p[0]+dIn[0]*tt + q[0]+dOut[0]*ss) / 2,
                 (p[1]+dIn[1]*tt + q[1]+dOut[1]*ss) / 2,
                 (p[2]+dIn[2]*tt + q[2]+dOut[2]*ss) / 2];
            if (Math.hypot(X[0]-mid[0], X[1]-mid[1], X[2]-mid[2]) > r * 3)
              X = mid;
          }
          const n = nrm([N0[i][0]+N0[i1][0], N0[i][1]+N0[i1][1],
                         N0[i][2]+N0[i1][2]]);
          P0[i] = X; N0[i] = n;
          P0.splice(i1, 1); N0.splice(i1, 1);
          did = true;
        }
        if (!did) break;
      }
      if (m.rimDebug)
        m.outlines[m.outlines.length - 1].stageFold = P0.map(p => p.slice());
      const NPP = P0.length;
      const outP = [], outN = [];
      for (let i = 0; i < NPP; i++) {
        const pm = P0[(i - 1 + NPP) % NPP], pc = P0[i], pp = P0[(i + 1) % NPP];
        const d0 = nrm(sub(pc, pm)), d1 = nrm(sub(pp, pc));
        // bends gentler than ~8 deg pass through; everything else gets
        // the rimArc bezier — so the windshield's curved top and bottom
        // runs smooth with the same slider as the 90-deg corners
        // (user ask), not only sharp turns
        if (d0[0]*d1[0] + d0[1]*d1[1] + d0[2]*d1[2] > 0.99) {
          outP.push(pc); outN.push(N0[i]); continue;
        }
        const l0 = Math.hypot(...sub(pc, pm)), l1 = Math.hypot(...sub(pp, pc));
        const d = Math.min(r * 2.2, 0.4 * Math.min(l0, l1));
        // rimArc = SECTIONS PER CORNER (user param): the fillet is a
        // quadratic bezier through the corner point, tangent to both
        // arms — extra points concentrate AT the bend only, straight
        // runs stay two-point. rimArc 1 = the plain chamfer.
        const AR = Math.max(1, Math.round(W.rimArc || 1));
        const A2 = [pc[0]-d0[0]*d, pc[1]-d0[1]*d, pc[2]-d0[2]*d];
        const B2 = [pc[0]+d1[0]*d, pc[1]+d1[1]*d, pc[2]+d1[2]*d];
        for (let j = 0; j <= AR; j++) {
          const t = j / AR, u = 1 - t;
          outP.push([
            u*u*A2[0] + 2*u*t*pc[0] + t*t*B2[0],
            u*u*A2[1] + 2*u*t*pc[1] + t*t*B2[1],
            u*u*A2[2] + 2*u*t*pc[2] + t*t*B2[2]]);
          outN.push(N0[i]);
        }
      }
      pts = outP; ns = outN;
    }
    const path = pts;
    // the PROCESSED sweep path is recorded next to the true boundary —
    // outline.pts is the contract, outline.path is what the bead actually
    // follows; their divergence is the seal-mismatch instrument
    m.outlines[m.outlines.length - 1].path = pts.map(p => p.slice());
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
      sec.push({ t, b, n2, mit, stretch });
    }
    // CLOSED-LOOP HOLONOMY: parallel transport around a loop returns the
    // frame TWISTED by some angle, and the whole mismatch used to land on
    // the seam quads (user report: skylight joint vertices rotate).
    // Measure the twist and distribute the correction around the loop.
    {
      const f0 = sec[0], fL = sec[NP - 1];
      const t0 = f0.t;
      const d = fL.b[0]*t0[0] + fL.b[1]*t0[1] + fL.b[2]*t0[2];
      const bT = nrm([fL.b[0]-t0[0]*d, fL.b[1]-t0[1]*d, fL.b[2]-t0[2]*d]);
      const cx = [f0.b[1]*bT[2]-f0.b[2]*bT[1], f0.b[2]*bT[0]-f0.b[0]*bT[2],
                  f0.b[0]*bT[1]-f0.b[1]*bT[0]];
      const hol = Math.atan2(cx[0]*t0[0]+cx[1]*t0[1]+cx[2]*t0[2],
        Math.max(-1, Math.min(1,
          f0.b[0]*bT[0]+f0.b[1]*bT[1]+f0.b[2]*bT[2])));
      for (let i = 0; i < NP; i++) {
        const ph = -hol * i / NP, c = Math.cos(ph), s2 = Math.sin(ph);
        const f = sec[i], t = f.t;
        const rot = v => {
          const tv = [t[1]*v[2]-t[2]*v[1], t[2]*v[0]-t[0]*v[2],
                      t[0]*v[1]-t[1]*v[0]];
          return [v[0]*c + tv[0]*s2, v[1]*c + tv[1]*s2, v[2]*c + tv[2]*s2];
        };
        f.b = rot(f.b); f.n2 = rot(f.n2);
      }
    }
    const secIds = [];
    for (let i = 0; i < NP; i++) {
      const { b, n2, mit, stretch } = sec[i];
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
      secIds.push(sN);
    }
    const first = add.length;
    for (let i = 0; i < NP; i++) {
      const a = secIds[i], bq = secIds[(i + 1) % NP];
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
// GLASS SILL — G12.3 v8's "the whole door can become a window", now
// BUILT (user ask): winSillPilot / winSillPax extend the pilot and
// passenger glass DOWN past the waistband, STEPPED THROUGH THE
// SUBDIVIDED LATTICE (the G14 sill idiom — whole rows, no iso cuts, so
// joints and cuttings stay clean by construction). Runs on the
// displayed mesh AFTER subdivision and BEFORE cageCut/cageRims: rows
// of skin faces under the glass are REASSIGNED to the glass material
// and win-marked, so zones, seals, cuts, door ownership and the wood
// door's glass exclusion all follow automatically. At full depth the
// door is ALL window.
// ---------------------------------------------------------------------------
function cageGlassSill(m, S) {
  const G2 = S.glaze || {};
  const jobs = [['pilotWindow', G2.sillPilot || 0],
                ['pasengerWindow', G2.sillPax || 0]];
  const { V, F } = m;
  const BELOW = new Set(['waistband', 'body', 'floorLoop']);
  const horiz = (a, b) => {
    const A = V[a], B = V[b];
    return Math.abs(B[2] - A[2]) >= Math.abs(B[1] - A[1]);
  };
  for (const [gm, sv] of jobs) {
    if (!(sv > 0)) continue;
    const eF = new Map();
    F.forEach((f, i) => {
      if (f.v.length !== 4 || f.capFace) return;
      if (f.m !== gm && !BELOW.has(f.m)) return;
      for (let e = 0; e < 4; e++) {
        const k = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
        if (!eF.has(k)) eF.set(k, []);
        eF.get(k).push(i);
      }
    });
    // row 0 = skin faces sharing a horizontal edge with this glass —
    // exactly the window's own column, no z bookkeeping needed
    const row = new Map();
    let q = [];
    for (const [k, fl] of eF) {
      if (fl.length !== 2) continue;
      const [a, b] = k.split('_').map(Number);
      if (!horiz(a, b)) continue;
      const m0 = F[fl[0]].m, m1 = F[fl[1]].m;
      let cand = null;
      if (m0 === gm && BELOW.has(m1)) cand = fl[1];
      if (m1 === gm && BELOW.has(m0)) cand = fl[0];
      if (cand != null && !row.has(cand)) { row.set(cand, 0); q.push(cand); }
    }
    if (!q.length) continue;
    let rh = 0, nh = 0;
    for (const fi of q) {
      let lo = 1e9, hi = -1e9;
      for (const vi of F[fi].v) {
        lo = Math.min(lo, V[vi][1]); hi = Math.max(hi, V[vi][1]);
      }
      rh += hi - lo; nh++;
    }
    rh = nh ? rh / nh : 0.05;
    const NR = Math.round(sv / Math.max(1e-6, rh));
    // BFS strictly DOWNWARD row by row (the drop test blocks sideways
    // spread along the continuous band — measured necessity at the
    // quarter bay, where fore-aft edges also read as "horizontal")
    const cenY = fi => {
      let cy = 0;
      for (const vi of F[fi].v) cy += V[vi][1] / 4;
      return cy;
    };
    while (q.length) {
      const nq = [];
      for (const fi of q) {
        const r = row.get(fi);
        if (r + 1 >= NR) continue;
        const cy = cenY(fi);
        const f = F[fi];
        for (let e = 0; e < 4; e++) {
          const a = f.v[e], b = f.v[(e + 1) % 4];
          if (!horiz(a, b)) continue;
          for (const gi of eF.get(cageEdgeKey(a, b)) || []) {
            if (gi === fi || row.has(gi) || !BELOW.has(F[gi].m)) continue;
            if (cenY(gi) > cy - rh * 0.3) continue;
            row.set(gi, r + 1); nq.push(gi);
          }
        }
      }
      q = nq;
    }
    for (const [fi, r] of row) {
      if (r < NR) { F[fi].m = gm; F[fi].win = 1; }
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// CUT — G14 (user chantier): doors and windows become SEPARATE MESH
// parts AFTER subdivision, cut face-granular on the subdivided topology
// — no fighting the subsurf: the sill STEPS through the available
// geometry. Runs after cageSubdivide and BEFORE cageRims, so zone
// tracing happens on the moved parts and every joint bead travels with
// its panel. cut.explode offsets each part along its mean outward
// normal (side panels go sideways, skylights up, windshield forward).
// Window faces inside a door carry both marks and separate again from
// the door part — the pane explodes out of its door, assembly-style.
// Flag off = the untouched continuous-sill pipeline (fully reversible).
// ---------------------------------------------------------------------------
function cageCut(m, S) {
  const C = S.cut;
  if (!C || !C.on) return m;
  const { V, F } = m;
  const W = S.win || {};
  // record the windshield BASE LINE before the glass separates — the
  // dashboard traces the windshield/waistband adjacency, and cutting
  // duplicates the glass verts, breaking it (user report: cut parts
  // stripped the dashboard). The waistband side keeps these vert ids.
  if (!m.wsBase) {
    // mirrored pod: BOTH screens match this adjacency — the dash and
    // its cross-beam belong to the FRONT one (the aft copy is the
    // turtledeck), so the trace filters to faces forward of the arceau
    let zSp = -1e9;
    if (S.config && S.config.mirror) {
      for (const f of F)
        if (f.m === 'pillarCabin' && f.v.length === 4)
          for (const vi of f.v) zSp = Math.max(zSp, V[vi][2]);
      zSp -= 0.01;
    }
    const own = new Map();
    for (const f of F) {
      if (f.v.length !== 4) continue;
      if (f.m !== 'windshield' && f.m !== 'waistband') continue;
      if (zSp > -1e9) {
        let cz = 0;
        for (const vi of f.v) cz += V[vi][2] / 4;
        if (cz < zSp) continue;
      }
      for (let e = 0; e < 4; e++) {
        const k = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
        if (!own.has(k)) own.set(k, new Set());
        own.get(k).add(f.m);
      }
    }
    m.wsBase = [];
    for (const [k, mats] of own)
      if (mats.has('windshield') && mats.has('waistband'))
        m.wsBase.push(k.split('_').map(Number));
  }
  const groups = (kind, filt) => {
    const idx = [];
    F.forEach((f, i) => {
      if (f[kind] && f.v.length === 4 && (!filt || filt(i))) idx.push(i);
    });
    const byI = new Map(idx.map((fi, k) => [fi, k]));
    const par = idx.map((_, k) => k);
    const find = k => par[k] === k ? k : (par[k] = find(par[k]));
    const own = new Map();
    for (const fi of idx) {
      const f = F[fi];
      for (let e = 0; e < 4; e++) {
        const key = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
        if (own.has(key)) par[find(byI.get(fi))] = find(byI.get(own.get(key)));
        else own.set(key, fi);
      }
    }
    const z = new Map();
    for (const fi of idx) {
      const r = find(byI.get(fi));
      if (!z.has(r)) z.set(r, []);
      z.get(r).push(fi);
    }
    return [...z.values()];
  };
  const cutZone = (fis, sill) => {
    let keep = fis;
    if (sill > 0) {
      // ROW-STEPPED SILL (user correction: cut STRAIGHT along the rows
      // the mesh already has — the centroid-vs-bin test staircased).
      // BFS face rows upward from the zone's bottom boundary run and
      // drop round(sill / rowHeight) whole rows.
      const eOwn2 = new Map();
      for (const fi of fis) {
        const f = F[fi];
        for (let e = 0; e < 4; e++) {
          const k = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
          if (!eOwn2.has(k)) eOwn2.set(k, []);
          eOwn2.get(k).push(fi);
        }
      }
      let y0 = 1e9, y1 = -1e9;
      for (const fi of fis) for (const vi of F[fi].v) {
        y0 = Math.min(y0, V[vi][1]); y1 = Math.max(y1, V[vi][1]);
      }
      const yMid = y0 + 0.5 * (y1 - y0);
      const row = new Map();
      const q = [];
      for (const [k, fl] of eOwn2) {
        if (fl.length !== 1) continue;               // boundary edge
        const [a, b] = k.split('_').map(Number);
        const A = V[a], B = V[b];
        if (Math.abs(B[2] - A[2]) < Math.abs(B[1] - A[1])) continue;
        if ((A[1] + B[1]) / 2 > yMid) continue;      // bottom run only
        if (!row.has(fl[0])) { row.set(fl[0], 0); q.push(fl[0]); }
      }
      let rowH = 0, nH = 0;
      for (const fi of q) {
        let lo = 1e9, hi = -1e9;
        for (const vi of F[fi].v) {
          lo = Math.min(lo, V[vi][1]); hi = Math.max(hi, V[vi][1]);
        }
        rowH += hi - lo; nH++;
      }
      rowH = nH ? rowH / nH : 0.05;
      const NDROP = Math.round(sill / Math.max(1e-6, rowH));
      while (q.length) {
        const fi = q.shift(), r = row.get(fi), f = F[fi];
        for (let e = 0; e < 4; e++) {
          const A = V[f.v[e]], B = V[f.v[(e + 1) % 4]];
          if (Math.abs(B[2] - A[2]) < Math.abs(B[1] - A[1])) continue;
          for (const gi of eOwn2.get(cageEdgeKey(f.v[e], f.v[(e + 1) % 4]))) {
            if (gi === fi || row.has(gi)) continue;
            row.set(gi, r + 1); q.push(gi);
          }
        }
      }
      keep = fis.filter(fi => {
        const r = row.get(fi);
        return r == null || r >= NDROP;
      });
      const ks = new Set(keep);
      for (const fi of fis) if (!ks.has(fi)) {
        delete F[fi].door; delete F[fi].win; delete F[fi].doorKey;
      }
    }
    if (!keep.length) return;
    // separate: duplicate the part's vertices (the skin keeps the hole),
    // offset along the part's mean outward normal
    let nx = 0, ny = 0, nz = 0;
    for (const fi of keep) {
      const p = F[fi].v.map(i => V[i]);
      const u = [p[2][0]-p[0][0], p[2][1]-p[0][1], p[2][2]-p[0][2]];
      const w2 = [p[3][0]-p[1][0], p[3][1]-p[1][1], p[3][2]-p[1][2]];
      nx += u[1]*w2[2]-u[2]*w2[1];
      ny += u[2]*w2[0]-u[0]*w2[2];
      nz += u[0]*w2[1]-u[1]*w2[0];
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    const off = [nx/nl*C.explode, ny/nl*C.explode, nz/nl*C.explode];
    const map = new Map();
    for (const fi of keep) {
      F[fi].v = F[fi].v.map(vi => {
        if (!map.has(vi)) map.set(vi,
          V.push([V[vi][0]+off[0], V[vi][1]+off[1], V[vi][2]+off[2]]) - 1);
        return map.get(vi);
      });
      F[fi].cutPart = 1;
      // the part's translation, recorded so interior passes can anchor
      // fuselage-line features (the waist) in the part's OWN frame
      F[fi].cutOff = off;
    }
  };
  if (C.doors) for (const z of groups('door')) {
    const dk = F[z[0]].doorKey;
    const sill = W.sills && dk && W.sills[dk] != null ? W.sills[dk]
      : dk && dk.lastIndexOf('pax', 0) === 0
        ? (W.doorSillPax != null ? W.doorSillPax : W.doorSill)
      : W.doorSill;
    cutZone(z, Math.max(0, sill || 0));
  }
  // DOORS OWN THEIR WINDOWS (user ruling): glass already separated with
  // a door stays with it — only window faces OUTSIDE every cut door form
  // their own parts (a window straddling a door edge splits: the door
  // keeps its share, the rest becomes a fuselage-side window part).
  if (C.wins) for (const z of groups('win', fi => !F[fi].cutPart))
    cutZone(z, 0);
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
  // CONSTRUCTION (G13 idioms, user brief): the material idiom IS the
  // internal structure. 'carbon' = the thickened-skin liner over the
  // pillar bands; 'tube' = a welded truss off the CONTROL cage; 'wood'
  // = plywood sheets + spruce posts/longerons + ajoure frames.
  const cons = I.cons || 'carbon';
  // THE SECTION MODEL (user: ready for MIXED techniques — e.g. tube
  // canopy over wooden boom, like the jodel). The airframe divides into
  // {boom | pax | pilot | nose} x {Below | Above}, the vertical border
  // being the TOP OF THE WAISTBAND (user ruling). Every builder below
  // asks consAt(y, z) instead of the global switch; spec.interior
  // .consMap carries one technique per section (today all eight equal
  // the global — the UI still shows 3 options — but flipping any one
  // key just works).
  const R0 = cageResolve(S);
  const rgn0 = n => R0.rings.find(r => r.name === n);
  const zBoom0 = rgn0('tailPost') ? rgn0('tailPost').lv.waist.z : -1e9;
  const zPax0 = rgn0('pilPaxA') ? rgn0('pilPaxA').lv.waist.z : -1e9;
  const zCab0 = rgn0('pilCabA') ? rgn0('pilCabA').lv.waist.z : 0;
  const wsF0 = rgn0('wsFront');
  const zNose0 = wsF0 ? wsF0.lv.waist.z : 1e9;
  const secOf = (y, z) =>
    (z < zPax0 ? 'boom' : z < zCab0 ? 'pax' : z < zNose0 ? 'pilot' : 'nose')
    + (y < S.bandY ? 'Below' : 'Above');
  const CM = I.consMap || {};
  const consAt = (y, z) => CM[secOf(y, z)] || cons;
  const cenOf = f => {
    let cy = 0, cz = 0;
    for (const vi of f.v) { cy += V[vi][1] / f.v.length;
                            cz += V[vi][2] / f.v.length; }
    return [cy, cz];
  };
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
    // FLAT AT THE CABIN-SIDE PLANE (user, 2026-08-18): the outline comes
    // from the cabin-side cycle ONLY — the old mid-pillar midpoint blend
    // paired each vertex with the band's OTHER cycle, which under a
    // sharp aft drop is the ANGLED pilPaxA section, so the panel leaned
    // and shrank with the angle. The coplanar-sliver report that
    // motivated the blend is answered by the fixed AFT SETBACK plus the
    // inset instead: the panel sits just behind the back end of the
    // pillarCabin, toward the tail, flat and vertical regardless of the
    // aft shoulder.
    const SETB = 0.010;
    const INS = (I.pillars && cons !== 'tube' ? (I.shellT || 0.035) : 0)
              + 0.008;
    let bcx = 0, bcy = 0;
    for (const v of ring) { bcx += V[v][0]; bcy += V[v][1]; }
    bcx /= ring.length; bcy /= ring.length;
    const bPos = new Map();
    for (const v of ring) {
      const p = V[v];
      const dx = bcx - p[0], dy = bcy - p[1];
      const l = Math.hypot(dx, dy) || 1;
      bPos.set(v, [p[0] + dx/l*INS, p[1] + dy/l*INS, p[2] - SETB]);
    }
    // ladder fill between the two side chains split at top/bottom — the
    // wall gets its OWN vertices at the panel outline positions (exact
    // seam within the component, disjoint from the skin)
    const N = ring.length;
    let iT = 0, iB = 0;
    ring.forEach((v, i) => {
      if (V[v][1] > V[ring[iT]][1]) iT = i;
      if (V[v][1] < V[ring[iB]][1]) iB = i;
    });
    const c1 = [], c2 = [];
    for (let i = iT; ; i = (i + 1) % N) { c1.push(ring[i]); if (i === iB) break; }
    for (let i = iT; ; i = (i - 1 + N) % N) { c2.push(ring[i]); if (i === iB) break; }
    // CLOSED SOLID (user): the panel is extruded to the same 5 mm as
    // the boom webs — front sheet, back sheet, rim wall on the outline
    const BTH = 0.005;
    const nidF = new Map(), nidB = new Map();
    const myAt = (vi, dz, mp) => {
      if (!mp.has(vi)) {
        const p = bPos.get(vi);
        mp.set(vi, V.push([p[0], p[1], p[2] + dz]) - 1);
      }
      return mp.get(vi);
    };
    const myF = vi => myAt(vi, BTH / 2, nidF);
    const myB = vi => myAt(vi, -BTH / 2, nidB);
    const K = Math.max(c1.length, c2.length) - 1;
    for (let k = 0; k < K; k++) {
      const i1a = Math.round(k * (c1.length - 1) / K),
            i1b = Math.round((k + 1) * (c1.length - 1) / K),
            i2a = Math.round(k * (c2.length - 1) / K),
            i2b = Math.round((k + 1) * (c2.length - 1) / K);
      if (i1a === i1b && i2a === i2b) continue;
      add.push({ v: [myF(c1[i1a]), myF(c1[i1b]), myF(c2[i2b]), myF(c2[i2a])],
                 m: 'bulkhead' });
      add.push({ v: [myB(c2[i2a]), myB(c2[i2b]), myB(c1[i1b]), myB(c1[i1a])],
                 m: 'bulkhead' });
    }
    for (let i = 0; i < N; i++) {
      const a = ring[i], b = ring[(i + 1) % N];
      add.push({ v: [myF(a), myF(b), myB(b), myB(a)], m: 'bulkhead' });
    }
  })();

  // ---- I3': pillar bodies = THICKENED REMAINING SKIN -----------------------
  // The pillar bands (window / cabin / passenger — the remaining, never-
  // cut skin) get BODY: an inward-offset LINER copy of their faces plus
  // rim walls along every selection boundary. Where the boundary borders
  // a cut hole, the wall IS the door jamb / window reveal — real depth
  // seen through the openings, and the A-pillar reads structural from
  // inside. Liner idiom (no outer duplicate, no z-fight): the same pass
  // extends to the whole fuselage inner shell later by widening the
  // selection. Attachment faces carry att:1 and their own duplicated
  // seam vertices (disjoint component, coincident seam).
  // the liner idiom, selection-agnostic: inward-offset copy of the
  // selected faces (smooth per-vertex normals from the selection's own
  // faces) + rim walls on every selection-boundary edge. Against a cut
  // hole the wall IS the door jamb / window reveal.
  // baseT (optional): the extrusion STARTS at baseT below the skin
  // instead of at the skin — the composite's second-stage extrusions
  // ("from this surface, extrude further") begin on the shell's face
  const liner = (sel, t, matF, baseT) => {
    if (!sel.length) return;
    const vN = new Map();
    const fN = fi => {
      const p = F[fi].v.map(i => V[i]);
      const u = [p[2][0]-p[0][0], p[2][1]-p[0][1], p[2][2]-p[0][2]];
      const w = [p[3][0]-p[1][0], p[3][1]-p[1][1], p[3][2]-p[1][2]];
      const n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2],
                 u[0]*w[1]-u[1]*w[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      return [n[0]/l, n[1]/l, n[2]/l];
    };
    for (const fi of sel) {
      const n = fN(fi);
      for (const vi of F[fi].v) {
        const s = vN.get(vi) || [0, 0, 0];
        vN.set(vi, [s[0]+n[0], s[1]+n[1], s[2]+n[2]]);
      }
    }
    const inner = new Map(), outer = new Map();
    const innerOf = vi => {
      if (!inner.has(vi)) {
        const n = vN.get(vi);
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        inner.set(vi, V.push([V[vi][0] - n[0]/l*t, V[vi][1] - n[1]/l*t,
                              V[vi][2] - n[2]/l*t]) - 1);
      }
      return inner.get(vi);
    };
    const outerOf = vi => {
      if (!outer.has(vi)) {
        if (baseT) {
          const n = vN.get(vi);
          const l = Math.hypot(n[0], n[1], n[2]) || 1;
          outer.set(vi, V.push([V[vi][0] - n[0]/l*baseT,
                                V[vi][1] - n[1]/l*baseT,
                                V[vi][2] - n[2]/l*baseT]) - 1);
        } else outer.set(vi, V.push(V[vi].slice()) - 1);
      }
      return outer.get(vi);
    };
    const eCount = new Map();
    for (const fi of sel) {
      const f = F[fi];
      for (let e = 0; e < 4; e++) {
        const k = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
        eCount.set(k, (eCount.get(k) || 0) + 1);
      }
    }
    for (const fi of sel) {
      const f = F[fi];
      add.push({ v: f.v.slice().reverse().map(innerOf), m: matF(F[fi]),
                 att: 1 });
      for (let e = 0; e < 4; e++) {
        const a = f.v[e], b = f.v[(e + 1) % 4];
        if (eCount.get(cageEdgeKey(a, b)) !== 1) continue;
        add.push({ v: [outerOf(b), outerOf(a), innerOf(a), innerOf(b)],
                   m: matF(F[fi]), att: 1 });
      }
    }
  };
  // the FRONT pillar is a pillar in ALL constructions (user ruling);
  // capFace excluded — the pusher rear disc shares its material
  const PM = new Set(['pillarWindow', 'pillarCabin', 'pillarPassenger',
                      'pillarFront']);
  // ---- carbon: the COMPOSITE MONOCOQUE (user redesign) ---------------------
  // 1) the WHOLE skin extrudes into ONE continuous inner shell — the
  //    body IS the structure; 2) FROM THAT SURFACE the pillar bands
  //    extrude further inward (baseT starts them on the shell face);
  //    3) waist and bottom reinforcement bands — the waistband and
  //    lower-corner material strips, running along the plywood's
  //    support beam lines — extrude the same way. One piece, one
  //    material; doors included (they ride their parts and keep their
  //    seals: a composite door seals in rubber), glass excluded.
  if (I.pillars) (() => {
    const t0c = I.shellT || 0.035;
    // the monocoque shell depth takes skinT too (its doublers keep
    // shellT and start on the shell face wherever it sits)
    const t1 = I.skinT > 0 ? I.skinT : t0c * 0.35;
    const GLM2 = new Set(['windshield', 'pilotWindow', 'pasengerWindow',
                          'skyWindows']);
    const shell = [], pil = [], bands = [];
    F.forEach((f, i) => {
      if (f.v.length !== 4 || f.m === 'joint' || f.capFace) return;
      if (GLM2.has(f.m)) return;
      const [cy, cz] = cenOf(f);
      if (consAt(cy, cz) !== 'carbon') return;
      shell.push(i);
      if (PM.has(f.m)) pil.push(i);
      else if (f.m === 'waistband' || f.m === 'floorLoop') bands.push(i);
    });
    if (!shell.length) return;
    liner(shell, t1, () => 'composite');
    liner(pil, t1 + t0c * 0.9, () => 'composite', t1);
    liner(bands, t1 + t0c * 0.55, () => 'composite', t1);
    // DOOR OUTLINE (user): the door's perimeter ring extrudes further
    // from the shell — the molded edge doubler of a composite door.
    // Per door PER SIDE (left/right share a doorKey): the outer
    // boundary = edges owned once across ALL the door's faces (glass
    // included, so the pane border stays internal); the ring = the
    // non-glass faces touching that boundary. Rides the cut part.
    const byDoor = new Map();
    F.forEach((f, i) => {
      if (f.v.length !== 4 || !f.doorKey || f.m === 'joint') return;
      const [cy, cz] = cenOf(f);
      if (consAt(cy, cz) !== 'carbon') return;
      const k = f.doorKey + ':' + (V[f.v[0]][0] >= 0 ? 'P' : 'M');
      if (!byDoor.has(k)) byDoor.set(k, []);
      byDoor.get(k).push(i);
    });
    for (const fis of byDoor.values()) {
      const eCnt2 = new Map();
      for (const fi of fis)
        for (let e = 0; e < 4; e++) {
          const key = cageEdgeKey(F[fi].v[e], F[fi].v[(e + 1) % 4]);
          eCnt2.set(key, (eCnt2.get(key) || 0) + 1);
        }
      const perim = [];
      for (const fi of fis) {
        if (GLM2.has(F[fi].m)) continue;
        for (let e = 0; e < 4; e++)
          if (eCnt2.get(cageEdgeKey(F[fi].v[e],
                                    F[fi].v[(e + 1) % 4])) === 1) {
            perim.push(fi);
            break;
          }
      }
      liner(perim, t1 + t0c * 0.55, () => 'composite', t1);
    }
  })();

  // ---- wood: the plywood BATHTUB, v2 (user rework) -------------------------
  // TWO SEPARATE EXTRUSIONS at different thicknesses, never joined
  // (user ruling: IRL the posts are thick sections, the body panels
  // thin sheets — separate extrusions will do):
  // - THIN SHEETS (0.4 x shellT): everything below the waist PLUS the
  //   whole waistband band (by MATERIAL — it follows the windshield
  //   base lift), aft bulkhead .. windshield base, minus doors/cut
  //   parts. The sheet runs CONTINUOUS THROUGH the pillar bands (their
  //   sub-band faces are included) so no holes hide behind the posts
  //   and no interior rim walls fight them.
  // - THICK POSTS (1.6 x shellT): the pillar bands, full ring, their
  //   own liner — they PROTRUDE past the sheets, reading as the spruce
  //   sections the sheets are glued to. Material 'woodFrame'.
  if (I.pillars) (() => {
    const yW = S.waistY + 1e-3;
    const yB = S.bandY + 1e-3;
    const t0 = I.shellT || 0.035;
    const GLM = new Set(['windshield', 'pilotWindow', 'pasengerWindow',
                         'skyWindows']);
    // METAL sections build like wood (user: based on the wooden
    // version) — same layout — with sheet-metal realizations for skin,
    // frames and stringers
    const woodLike = c => c === 'wood' || c === 'metal';
    const wMat = c => c === 'metal' ? 'aluminium' : 'woodFrame';
    // L-ANGLE (user asked what real metal members are — bent/extruded
    // thin profiles: angles, Z and hat sections; never tubes or solid
    // squares, and NEVER lightening-holed like the first stringer
    // blades were): two thin legs meeting at the anchor line, opening
    // TOWARD the given axis point, flat-shaded like the beams. This is
    // THE metal linear member, propagated everywhere.
    const prismSec = (A, B, sec, mat) => {
      const dn = nrm3([B[0]-A[0], B[1]-A[1], B[2]-A[2]]);
      let sd = [dn[2], 0, -dn[0]];
      const sl = Math.hypot(sd[0], sd[1], sd[2]);
      sd = sl < 1e-6 ? [1, 0, 0] : [sd[0]/sl, sd[1]/sl, sd[2]/sl];
      const uv = nrm3([dn[1]*sd[2]-dn[2]*sd[1], dn[2]*sd[0]-dn[0]*sd[2],
                       dn[0]*sd[1]-dn[1]*sd[0]]);
      const cor = sec.map(([s, u]) =>
        [sd[0]*s + uv[0]*u, sd[1]*s + uv[1]*u, sd[2]*s + uv[2]*u]);
      const ca = cor.map(c2 => [A[0]+c2[0], A[1]+c2[1], A[2]+c2[2]]);
      const cb = cor.map(c2 => [B[0]+c2[0], B[1]+c2[1], B[2]+c2[2]]);
      const q2 = (p0, p1, p2, p3) => add.push({
        v: [V.push(p0.slice()) - 1, V.push(p1.slice()) - 1,
            V.push(p2.slice()) - 1, V.push(p3.slice()) - 1], m: mat });
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        q2(ca[k], cb[k], cb[k2], ca[k2]);
      }
      q2(ca[3], ca[2], ca[1], ca[0]);
      q2(cb[0], cb[1], cb[2], cb[3]);
    };
    const metalAngle = (A, B, w, axisPt) => {
      if (typeof globalThis !== 'undefined' && globalThis.CAGE_DBG)
        globalThis.CAGE_DBG.push({ k: 'metalAngle', A: A.slice(),
          B: B.slice(), w, at: (new Error().stack.split('\n')[2] || '').trim() });
      const dn = nrm3([B[0]-A[0], B[1]-A[1], B[2]-A[2]]);
      let sd = [dn[2], 0, -dn[0]];
      const sl = Math.hypot(sd[0], sd[1], sd[2]);
      sd = sl < 1e-6 ? [1, 0, 0] : [sd[0]/sl, sd[1]/sl, sd[2]/sl];
      const uv = nrm3([dn[1]*sd[2]-dn[2]*sd[1], dn[2]*sd[0]-dn[0]*sd[2],
                       dn[0]*sd[1]-dn[1]*sd[0]]);
      const mid = [(A[0]+B[0])/2, (A[1]+B[1])/2];
      const ax = [axisPt[0] - mid[0], axisPt[1] - mid[1]];
      const sS = Math.sign(ax[0]*sd[0] + ax[1]*sd[1]) || 1;
      const sU = Math.sign(ax[0]*uv[0] + ax[1]*uv[1]) || 1;
      const T = 0.005;
      prismSec(A, B, [[0, 0], [sS*w, 0], [sS*w, sU*T], [0, sU*T]],
               'aluminium');
      prismSec(A, B, [[0, 0], [sS*T, 0], [sS*T, sU*w], [0, sU*w]],
               'aluminium');
    };
    // THE WHOLE SKIN IS PLYWOOD (user simplification: the bathtub was
    // getting complex — a wooden fuselage's skin is simply thin
    // plywood sheet bent to shape, everywhere, like the tube's cloth
    // but structural). One continuous sheet lining, running through
    // the posts; the structure (posts, beams, webs) stays as built.
    const selPan = [], selPil = [], selPanM = [];
    F.forEach((f, i) => {
      if (f.v.length !== 4 || f.cutPart || f.m === 'joint' || f.capFace)
        return;
      const [cy, cz] = cenOf(f);
      const c = consAt(cy, cz);
      if (!woodLike(c)) return;
      if (PM.has(f.m)) {
        // wood gets thick posts; metal pillar frames are slim punched
        // webs built in the bands loop — the toele runs behind them
        if (c === 'wood') { selPil.push(i); selPan.push(i); }
        else selPanM.push(i);
        return;
      }
      if (f.door || GLM.has(f.m)) return;
      (c === 'wood' ? selPan : selPanM).push(i);
    });
    // SKIN THICKNESS (user, anti-clipping): I.skinT overrides every
    // sheet lining's depth — a deeper lining cannot graze the skin on
    // tight curvature. Pillars/posts/frames stay on shellT.
    const tSk = I.skinT > 0 ? I.skinT : 0;
    liner(selPan, tSk || t0 * 0.4, () => 'plywood');
    liner(selPil, t0 * 1.6, () => 'woodFrame');
    // the TOELE (user): the metal skin's interior is metal too — thin
    // sheet, same continuous-lining idiom. Own material name so the
    // viewer can fade interior SKIN apart from metal STRUCTURE
    // (aluminium = frames/stringers/angles).
    liner(selPanM, tSk || 0.008, () => 'toele');
    // the DOOR PANEL is plywood like the tub (user): inner liner +
    // edge walls over the door's own faces, glass excluded (the pane
    // keeps its seal and its view). Rides the exploded part.
    const selDoor = [], selDoorM = [];
    F.forEach((f, i) => {
      if (!f.doorKey || f.v.length !== 4 || GLM.has(f.m)) return;
      const [cy, cz] = cenOf(f);
      const c = consAt(cy, cz);
      if (c === 'wood') selDoor.push(i);
      else if (c === 'metal') selDoorM.push(i);
    });
    liner(selDoor, tSk || t0 * 0.4, () => 'plywood');
    liner(selDoorM, tSk || 0.008, () => 'toele');
    // WOODEN BEAMS — TRUE SQUARE prisms (user ruling, second ask: the
    // chamfered octagon still read "rounded" at every level). Every
    // face carries its OWN four vertices, so the smooth-normal pass
    // has nothing to blend across and each face shades FLAT — a crisp
    // square profile at any subsurf level, no chamfer, no weld.
    const tS = t0 * 0.4;
    const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0]/l, v[1]/l, v[2]/l]; };
    const beam = (A, B, w, h, mat) => {
      const dn = nrm3([B[0]-A[0], B[1]-A[1], B[2]-A[2]]);
      let sd = [dn[2], 0, -dn[0]];
      const sl = Math.hypot(sd[0], sd[1], sd[2]);
      sd = sl < 1e-6 ? [1, 0, 0] : [sd[0]/sl, sd[1]/sl, sd[2]/sl];
      const uv = nrm3([dn[1]*sd[2]-dn[2]*sd[1], dn[2]*sd[0]-dn[0]*sd[2],
                       dn[0]*sd[1]-dn[1]*sd[0]]);
      const cor = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([pw, ph]) =>
        [sd[0]*pw*w/2 + uv[0]*ph*h/2, sd[1]*pw*w/2 + uv[1]*ph*h/2,
         sd[2]*pw*w/2 + uv[2]*ph*h/2]);
      const ca = cor.map(c => [A[0]+c[0], A[1]+c[1], A[2]+c[2]]);
      const cb = cor.map(c => [B[0]+c[0], B[1]+c[1], B[2]+c[2]]);
      const quad = (p0, p1, p2, p3) => add.push({
        v: [V.push(p0.slice()) - 1, V.push(p1.slice()) - 1,
            V.push(p2.slice()) - 1, V.push(p3.slice()) - 1],
        m: mat || 'woodFrame' });
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        quad(ca[k], cb[k], cb[k2], ca[k2]);
      }
      quad(ca[3], ca[2], ca[1], ca[0]);
      quad(cb[0], cb[1], cb[2], cb[3]);
    };
    // PUNCHED WEB (user: real planes punch their structures full of
    // holes): a thin single sheet between an outer and an inner rail,
    // split into three radial bands — the middle band skips every
    // other segment, so the web reads stamped with lightening holes
    // wz (optional): WIDTH along z — the web becomes a thin box (two
    // sheets + rail and hole walls) instead of a paper-thin single
    // sheet (user correction on the pillar frames)
    // fz (optional): I-BEAM MODE (user) — the un-punched edge bands
    // ("the lips around the adjourning") extrude to a couple of
    // centimetres as FLANGES while the punched middle stays a thin
    // web: a stamped I-profile instead of the raw extrusion
    const punched = (O, H, closed, mat, wz, fz) => {
      const n = Math.min(O.length, H.length);
      if (n < 2) return;
      const NQ = closed ? n : n - 1;
      const lp3 = (a, b, t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t,
                                a[2]+(b[2]-a[2])*t];
      const q = (p0, p1, p2, p3) => add.push({
        v: [V.push(p0.slice()) - 1, V.push(p1.slice()) - 1,
            V.push(p2.slice()) - 1, V.push(p3.slice()) - 1], m: mat });
      const hz = (wz || 0) / 2;
      const hf = (fz || 0) / 2;
      const zo = w => p => [p[0], p[1], p[2] + w];
      const Fz = p => [p[0], p[1], p[2] + hz];
      const Bz = p => [p[0], p[1], p[2] - hz];
      // a quad band as a box of half-width h2, with walls on its two
      // long edges
      const band = (P0, P1, P2, P3, h2) => {
        const F1 = zo(h2), B1 = zo(-h2);
        q(F1(P0), F1(P1), F1(P2), F1(P3));
        q(B1(P3), B1(P2), B1(P1), B1(P0));
        q(B1(P0), B1(P1), F1(P1), F1(P0));
        q(F1(P3), F1(P2), B1(P2), B1(P3));
      };
      for (let i = 0; i < NQ; i++) {
        const j = (i + 1) % n;
        const a25 = lp3(O[i], H[i], 0.28), b25 = lp3(O[j], H[j], 0.28);
        const a75 = lp3(O[i], H[i], 0.72), b75 = lp3(O[j], H[j], 0.72);
        const hole = i % 2 === 1;
        if (!hz && !hf) {
          q(O[i], O[j], b25, a25);
          q(a75, b75, H[j], H[i]);
          if (!hole) q(a25, b25, b75, a75);
          continue;
        }
        if (hf) {
          // I-BEAM: flanges on the edge bands, thin punched web — with
          // FLAT MARGINS beside the holes (user: the lip does not
          // start straight from the ajoure; a plain strip comes first).
          // Final proportions (user): the LIP band cut to a third
          // (0.10 of the depth), the flat zones kept at their exact
          // absolute width (0.14), and the HOLES enlarged to absorb
          // the freed depth (0.24..0.76).
          const aL = lp3(O[i], H[i], 0.10), bL = lp3(O[j], H[j], 0.10);
          const aU = lp3(O[i], H[i], 0.90), bU = lp3(O[j], H[j], 0.90);
          const a40 = lp3(O[i], H[i], 0.24), b40 = lp3(O[j], H[j], 0.24);
          const a60 = lp3(O[i], H[i], 0.76), b60 = lp3(O[j], H[j], 0.76);
          band(O[i], O[j], bL, aL, hf);
          band(aU, bU, H[j], H[i], hf);
          q(Fz(aL), Fz(bL), Fz(b40), Fz(a40));
          q(Bz(a40), Bz(b40), Bz(bL), Bz(aL));
          q(Fz(a60), Fz(b60), Fz(bU), Fz(aU));
          q(Bz(aU), Bz(bU), Bz(b60), Bz(a60));
          if (!hole) {
            q(Fz(a40), Fz(b40), Fz(b60), Fz(a60));
            q(Bz(a60), Bz(b60), Bz(b40), Bz(a40));
          } else {
            q(Fz(b40), Fz(b60), Bz(b60), Bz(b40));
            q(Bz(a40), Bz(a60), Fz(a60), Fz(a40));
          }
          continue;
        }
        q(Fz(O[i]), Fz(O[j]), Fz(b25), Fz(a25));
        q(Bz(a25), Bz(b25), Bz(O[j]), Bz(O[i]));
        q(Fz(a75), Fz(b75), Fz(H[j]), Fz(H[i]));
        q(Bz(H[i]), Bz(H[j]), Bz(b75), Bz(a75));
        if (!hole) {
          q(Fz(a25), Fz(b25), Fz(b75), Fz(a75));
          q(Bz(a75), Bz(b75), Bz(b25), Bz(a25));
        } else {
          q(Fz(a25), Fz(b25), Bz(b25), Bz(a25));
          q(Bz(a75), Bz(b75), Fz(b75), Fz(a75));
          q(Fz(b25), Fz(b75), Bz(b75), Bz(b25));
          q(Bz(a25), Bz(a75), Fz(a75), Fz(a25));
        }
        q(Bz(O[i]), Bz(O[j]), Fz(O[j]), Fz(O[i]));
        q(Fz(H[i]), Fz(H[j]), Bz(H[j]), Bz(H[i]));
      }
    };
    // ONE SKELETON, TWO REALIZATIONS (user): the plywood layout is the
    // procedural base for the tube construction. Every structural
    // member below goes through member(), which emits a square spruce
    // beam OR a round steel tube depending on the section's technique
    // — same key nodes, different material. Tube radius maps from the
    // wood width (w/3) so the visual weight stays comparable.
    // sized down a tad (user: the tubing poked the skin here and there)
    const TUBE_R = 0.010, TUBE_RP = 0.018;
    const tubeSeg = (A, B, r) => {
      if (typeof globalThis !== 'undefined' && globalThis.CAGE_DBG)
        globalThis.CAGE_DBG.push({ k: 'tubeSeg', A: A.slice(),
          B: B.slice(), r, at: (new Error().stack.split('\n')[2] || '').trim() });
      const dv = [B[0]-A[0], B[1]-A[1], B[2]-A[2]];
      const dl = Math.hypot(dv[0], dv[1], dv[2]) || 1;
      const d = [dv[0]/dl, dv[1]/dl, dv[2]/dl];
      let u = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const du = u[0]*d[0] + u[1]*d[1] + u[2]*d[2];
      const ul = Math.hypot(u[0]-du*d[0], u[1]-du*d[1], u[2]-du*d[2]) || 1;
      u = [(u[0]-du*d[0])/ul, (u[1]-du*d[1])/ul, (u[2]-du*d[2])/ul];
      const w2 = [d[1]*u[2]-d[2]*u[1], d[2]*u[0]-d[0]*u[2],
                  d[0]*u[1]-d[1]*u[0]];
      const ra = [], rb = [];
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        const ox = (Math.cos(a)*u[0] + Math.sin(a)*w2[0]) * r;
        const oy = (Math.cos(a)*u[1] + Math.sin(a)*w2[1]) * r;
        const oz = (Math.cos(a)*u[2] + Math.sin(a)*w2[2]) * r;
        ra.push(V.push([A[0]+ox, A[1]+oy, A[2]+oz]) - 1);
        rb.push(V.push([B[0]+ox, B[1]+oy, B[2]+oz]) - 1);
      }
      for (let k = 0; k < 6; k++) {
        const k2 = (k + 1) % 6;
        add.push({ v: [ra[k], rb[k], rb[k2], ra[k2]], m: 'tube' });
      }
    };
    const member = (A, B, w) => {
      const c = consAt((A[1]+B[1])/2, (A[2]+B[2])/2);
      if (c === 'wood') beam(A, B, w, w);
      else if (c === 'metal')
        metalAngle(A, B, w * 0.75, [0, (A[1] + B[1]) / 2 - 0.2]);
      else if (c === 'tube') tubeSeg(A, B, Math.max(0.008, w / 3));
    };
    // BENT TUBES ARE ONE CONTINUOUS SWEEP (user: the per-segment hexes
    // read as capped sections — the shading broke at every joint).
    // tubePath sweeps a welded 8-sided tube along a polyline with a
    // parallel-transported frame: rings are SHARED between segments,
    // so the smooth normals run the whole bend; open ends get quad-fan
    // caps. tubeRuns splits a path into maximal 'tube'-section runs
    // (mixed construction maps drop exactly the arcs that changed).
    const tubePath = (pts, r, closed) => {
      const N = pts.length;
      if (N < 2) return;
      if (typeof globalThis !== 'undefined' && globalThis.CAGE_DBG)
        globalThis.CAGE_DBG.push({ k: 'tubePath', A: pts[0].slice(),
          B: pts[N - 1].slice(), n: N, closed: !!closed,
          at: (new Error().stack.split('\n')[2] || '').trim() });
      const SS = 8;
      const tanAt = i => {
        const p = pts[i > 0 ? i - 1 : (closed ? N - 1 : 0)];
        const q = pts[i < N - 1 ? i + 1 : (closed ? 0 : N - 1)];
        return nrm3([q[0]-p[0], q[1]-p[1], q[2]-p[2]]);
      };
      const t0 = tanAt(0);
      let b = Math.abs(t0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const rings = [];
      for (let i = 0; i < N; i++) {
        const t = tanAt(i);
        const d = b[0]*t[0] + b[1]*t[1] + b[2]*t[2];
        b = nrm3([b[0]-d*t[0], b[1]-d*t[1], b[2]-d*t[2]]);
        const n2 = [t[1]*b[2]-t[2]*b[1], t[2]*b[0]-t[0]*b[2],
                    t[0]*b[1]-t[1]*b[0]];
        const ring = [];
        for (let k = 0; k < SS; k++) {
          const a = k * 2 * Math.PI / SS;
          ring.push(V.push([
            pts[i][0] + (Math.cos(a)*b[0] + Math.sin(a)*n2[0]) * r,
            pts[i][1] + (Math.cos(a)*b[1] + Math.sin(a)*n2[1]) * r,
            pts[i][2] + (Math.cos(a)*b[2] + Math.sin(a)*n2[2]) * r]) - 1);
        }
        rings.push(ring);
      }
      const NQ = closed ? N : N - 1;
      for (let i = 0; i < NQ; i++) {
        const ra = rings[i], rb = rings[(i + 1) % N];
        for (let k = 0; k < SS; k++) {
          const k2 = (k + 1) % SS;
          add.push({ v: [ra[k], rb[k], rb[k2], ra[k2]], m: 'tube' });
        }
      }
      if (!closed) {
        for (const [ring, rev] of [[rings[0], 0], [rings[N - 1], 1]]) {
          const q = rev ? ring.slice().reverse() : ring;
          add.push({ v: [q[0], q[1], q[2], q[3]], m: 'tube' });
          add.push({ v: [q[0], q[3], q[4], q[5]], m: 'tube' });
          add.push({ v: [q[0], q[5], q[6], q[7]], m: 'tube' });
        }
      }
    };
    const tubeRuns = (pts, r, closed) => {
      const N = pts.length;
      if (N < 2) return;
      const nSeg = closed ? N : N - 1;
      const ok = [];
      for (let i = 0; i < nSeg; i++) {
        const A = pts[i], B = pts[(i + 1) % N];
        ok.push(consAt((A[1]+B[1])/2, (A[2]+B[2])/2) === 'tube');
      }
      if (closed && ok.every(x => x)) { tubePath(pts, r, true); return; }
      let run = [];
      const flush = () => {
        if (run.length >= 2) tubePath(run, r, false);
        run = [];
      };
      for (let i = 0; i < nSeg; i++) {
        if (ok[i]) {
          if (!run.length) run.push(pts[i]);
          run.push(pts[(i + 1) % N]);
        } else flush();
      }
      flush();
    };
    // WAIST REINFORCEMENTS (user): a spruce rail along the waistline of
    // every bay WITHOUT a defined door — a defined door owns its rail
    // (the door chantier, not pre-empted here).
    // ALL beams share one SQUARE section (user ruling)
    const D = (S.config && S.config.doors) || {};
    const wW = 0.04, wH = 0.04;
    // rails record their endpoints — key nodes for the bay diagonals
    const waistRails = [];
    const waistBeam = (a, b) => {
      if (!a || !b) return;
      const A = a.lv.waist, B = b.lv.waist;
      // wood/metal only: the tube waist longerons are continuous and
      // mid-pillar anchored, emitted in the band-pairs loop
      const cwb = consAt(A.y, (A.z + B.z) / 2);
      if (!woodLike(cwb)) return;
      for (const sx of [1, -1]) {
        // +0.01: the rail grazed the skin above/below the waist bulge
        // (user report) — one extra centimetre inboard clears it
        // 0.02: one more centimetre toward the centreline (user: the
        // rails still grazed the hull between stations)
        const PA = [sx*(A.x - tS - wW/2 - 0.02), A.y, A.z];
        const PB = [sx*(B.x - tS - wW/2 - 0.02), B.y, B.z];
        if (cwb === 'metal') {
          // bubble: no straight L-angle through the rounded canopy
          // region — the rails shot clear of the hull (user); the open
          // cockpit sill carries the canopy rail instead, skip
          if (S.config && S.config.canopy
              && S.config.canopy.mode === 'bubble'
              && (a.name === 'pilCabB' || a.name === 'ring')) continue;
          // metal rails reach the pillar MIDDLES (user): half a band
          // width past each bay-bounding ring — and they are L-angles
          const bw = (S.pillarW > 0 ? S.pillarW : S.cabinPillarW) / 2;
          if (A.z <= B.z) { PA[2] -= bw; PB[2] += bw; }
          else { PA[2] += bw; PB[2] -= bw; }
          metalAngle(PA, PB, 0.03, [0, A.y]);
        } else {
          // bubble (user: the beams got tortured): the seam ROUNDS in
          // the canopy region, so a straight chord pokes the skin —
          // sweep the rail along the DISPLAYED seam chain in plan
          // (x follows the rounded rail, y stays on the waistline)
          const CNb = S.config && S.config.canopy
            && S.config.canopy.mode === 'bubble';
          let run = null;
          if (CNb && m.seamS) {
            const zLo = Math.min(A.z, B.z) - 1e-6,
                  zHi = Math.max(A.z, B.z) + 1e-6;
            const pts3 = [];
            for (const [va, vb] of m.seamS)
              for (const vi of [va, vb]) {
                const p = V[vi];
                if (sx * p[0] > 0 && p[2] > zLo && p[2] < zHi) pts3.push(p);
              }
            if (pts3.length > 2) {
              const uniq = [...new Map(pts3.map(p =>
                [p[2].toFixed(5), p])).values()].sort((p, q) => p[2] - q[2]);
              run = uniq.map(p =>
                [sx * (Math.abs(p[0]) - tS - wW / 2 - 0.02), A.y, p[2]]);
            }
          }
          if (run && run.length > 2)
            for (let i2 = 0; i2 + 1 < run.length; i2++)
              beam(run[i2], run[i2 + 1], wW, wW, wMat(cwb));
          else beam(PA, PB, wW, wW, wMat(cwb));
        }
        waistRails.push({ sx, zA: Math.min(A.z, B.z),
                          zB: Math.max(A.z, B.z),
                          fwdEnd: B.z >= A.z ? PB : PA });
      }
    };
    if (!D.pax) {
      const n = S.pax.count;
      for (let i = 0; i < n; i++)
        waistBeam(rgn0('pilPaxB' + (i || '')),
                  i < n - 1 ? rgn0('pilPaxM' + i) : rgn0('pilCabA'));
    }
    if (!D.pilot) {
      waistBeam(rgn0('pilCabB'), rgn0('ring'));
      waistBeam(rgn0('ring'), rgn0('wsAft') || rgn0('wsFront'));
    }
    // CHINE LONGERONS v2 (user corrections): pieces run BETWEEN the
    // posts only — endpoints are the bottom corners of the pillar
    // bands read off the DISPLAYED (subsurf) mesh, so the beams move
    // with the level and never poke the limit skin the way the cage
    // coordinates did (the v1 "not well placed"); the posts hide the
    // ends, so the ugly segment junctions are gone; the run sits much
    // further inboard.
    const bands = (() => {
      const idx = [];
      F.forEach((f, i) => {
        if (PM.has(f.m) && f.v.length === 4 && !f.cutPart && !f.capFace)
          idx.push(i);
      });
      const byI = new Map(idx.map((fi, k) => [fi, k]));
      const par = idx.map((_, k) => k);
      const find = k => par[k] === k ? k : (par[k] = find(par[k]));
      const own = new Map();
      for (const fi of idx) {
        const f = F[fi];
        for (let e = 0; e < 4; e++) {
          const key = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
          if (own.has(key))
            par[find(byI.get(fi))] = find(byI.get(own.get(key)));
          else own.set(key, fi);
        }
      }
      const g = new Map();
      for (const fi of idx) {
        const r = find(byI.get(fi));
        if (!g.has(r)) g.set(r, []);
        g.get(r).push(fi);
      }
      return [...g.values()];
    })();
    const bandEnds = [];
    for (const fis of bands) {
      const dir = new Map();
      for (const fi of fis)
        for (let e = 0; e < 4; e++) {
          const a = F[fi].v[e], b = F[fi].v[(e + 1) % 4];
          const k = cageEdgeKey(a, b);
          if (dir.has(k)) dir.delete(k); else dir.set(k, [a, b]);
        }
      const nxt = new Map();
      for (const [, [a, b]] of dir) nxt.set(a, b);
      const cycles = [];
      const seen2 = new Set();
      for (const s0 of nxt.keys()) {
        if (seen2.has(s0)) continue;
        const cyc = [s0]; seen2.add(s0);
        for (let v = nxt.get(s0); v !== s0 && cyc.length <= nxt.size;
             v = nxt.get(v)) { cyc.push(v); seen2.add(v); }
        cycles.push(cyc);
      }
      if (cycles.length < 2) continue;
      cycles.sort((a, b) =>
        a.reduce((s, v) => s + V[v][2], 0) / a.length -
        b.reduce((s, v) => s + V[v][2], 0) / b.length);
      const corner = (cyc, sx) => {
        let best = null, bv = -1e9;
        for (const v of cyc) {
          const s = sx * V[v][0] - V[v][1];
          if (s > bv) { bv = s; best = v; }
        }
        return V[best];
      };
      const aftC = cycles[0], fwdC = cycles[cycles.length - 1];
      // smooth per-vertex normals from the band's own faces — the same
      // normals the post liner extrudes along, so "centred in the
      // extrusion" is exact by construction
      const vN2 = new Map();
      for (const fi of fis) {
        const p = F[fi].v.map(i2 => V[i2]);
        const u = [p[2][0]-p[0][0], p[2][1]-p[0][1], p[2][2]-p[0][2]];
        const w2 = [p[3][0]-p[1][0], p[3][1]-p[1][1], p[3][2]-p[1][2]];
        const n = [u[1]*w2[2]-u[2]*w2[1], u[2]*w2[0]-u[0]*w2[2],
                   u[0]*w2[1]-u[1]*w2[0]];
        for (const vi of F[fi].v) {
          const s = vN2.get(vi) || [0, 0, 0];
          vN2.set(vi, [s[0]+n[0], s[1]+n[1], s[2]+n[2]]);
        }
      }
      const cornerN = (cyc, sx) => {
        let best = null, bv = -1e9;
        for (const v of cyc) {
          const s = sx * V[v][0] - V[v][1];
          if (s > bv) { bv = s; best = v; }
        }
        return { id: best, n: vN2.get(best) || [0, 0, 0] };
      };
      // more anchors off the same sampled cycles (user): TWO ceiling
      // rails at the MIDDLE OF THE CEILING LOOP per side (user
      // correction: a single crown beam only suits bubbles/canopies —
      // the loop midpoint also lands right on square box roofs), and
      // two FLOOR points at +/- a third of the chine span — the
      // seat/load rails divide the belly in three. Targets come from
      // the resolved ring levels (they carry the round-top state), the
      // PICKED points are subsurf vertices.
      let zs = 0, ys = 0, zn = 0, nfr = 0, nwn = 0;
      for (const fi of fis) {
        if (F[fi].m === 'pillarFront') nfr++;
        if (F[fi].m === 'pillarWindow') nwn++;
        for (const vi of F[fi].v) { zs += V[vi][2]; ys += V[vi][1]; zn++; }
      }
      const zmv = zs / zn;
      const cyv = ys / zn;
      let rB = null, rD = 1e9;
      for (const r of R0.rings) {
        if (!r.lv.ceil || !r.lv.roof) continue;
        const d = Math.abs(r.lv.waist.z - zmv);
        if (d < rD) { rD = d; rB = r; }
      }
      const ctx = rB ? (rB.lv.ceil.x + rB.lv.roof.x) / 2 : 0;
      const cty = rB ? (rB.lv.ceil.y + rB.lv.roof.y) / 2 : 1e9;
      const nearN = (cyc, tx, ty) => {
        let best = null, bv = 1e9;
        for (const v of cyc) {
          const s = (V[v][0]-tx)*(V[v][0]-tx) + (V[v][1]-ty)*(V[v][1]-ty);
          if (s < bv) { bv = s; best = v; }
        }
        return { id: best, n: vN2.get(best) || [0, 0, 0] };
      };
      const floorN = (cyc, xt) => {
        let y0 = 1e9, y1 = -1e9;
        for (const v of cyc) {
          y0 = Math.min(y0, V[v][1]); y1 = Math.max(y1, V[v][1]);
        }
        const yMid = y0 + 0.5 * (y1 - y0);
        let best = null, bv = 1e9;
        for (const v of cyc) {
          if (V[v][1] > yMid) continue;
          const s = Math.abs(V[v][0] - xt);
          if (s < bv) { bv = s; best = v; }
        }
        return { id: best, n: vN2.get(best) || [0, 0, 0] };
      };
      // the MAIN LONGERON node: the point nearest the TOP OF THE
      // WAISTLINE per side (user, annotated drawing). bandY is one of
      // the template's global constants, so the chained nodes form a
      // dead-straight line in side view — the widest-point pick it
      // replaces wandered vertically as the sections changed shape.
      // target = the MIDDLE of the waistband (user: it sat mid-line in
      // the cabin but on the top edge in the boom — always middle now)
      const yWmid = (S.waistY + S.bandY) / 2;
      const bandN = (cyc, sx) => {
        let best = null, bv = 1e9;
        for (const v of cyc) {
          if (sx * V[v][0] <= 0) continue;
          const s = Math.abs(V[v][1] - yWmid);
          if (s < bv) { bv = s; best = v; }
        }
        return best == null ? null
          : { id: best, n: vN2.get(best) || [0, 0, 0] };
      };
      const mkEnds = cyc => {
        const Pc = cornerN(cyc, 1), Mc = cornerN(cyc, -1);
        const xc = Math.abs(V[Pc.id][0]);
        return { P: Pc, M: Mc,
                 tL: nearN(cyc, -ctx, cty), tR: nearN(cyc, ctx, cty),
                 fL: floorN(cyc, -xc / 3), fR: floorN(cyc, xc / 3),
                 wP: bandN(cyc, 1), wM: bandN(cyc, -1) };
      };
      // MID-PILLAR ANCHORS (user, tube feedback): tubes start and end
      // at the MIDDLE of the pillars — the aft/fwd cycle anchors
      // midpointed and pulled inside along the averaged band normal to
      // the hoop line — so members intersect the pillar hoops. Wood
      // keeps the band-edge anchors (beams end at the post faces).
      const eA = mkEnds(aftC), eF2 = mkEnds(fwdC);
      const HIN2 = TUBE_RP + 0.005;
      const midOf = k2 => {
        const A2 = eA[k2], B2 = eF2[k2];
        if (!A2 || A2.id == null || !B2 || B2.id == null) return null;
        const n = nrm3([A2.n[0]+B2.n[0], A2.n[1]+B2.n[1],
                        A2.n[2]+B2.n[2]]);
        return [(V[A2.id][0]+V[B2.id][0])/2 - n[0]*HIN2,
                (V[A2.id][1]+V[B2.id][1])/2 - n[1]*HIN2,
                (V[A2.id][2]+V[B2.id][2])/2 - n[2]*HIN2];
      };
      const mid = {};
      for (const k2 of ['P', 'M', 'tL', 'tR', 'fL', 'fR', 'wP', 'wM'])
        mid[k2] = midOf(k2);
      bandEnds.push({
        zm: zmv,
        cy: cyv,
        isFront: nfr > fis.length / 2,
        isWin: nwn > fis.length / 2,
        aft: eA,
        fwd: eF2,
        mid,
      });
      // SECTION-PLANE INSET (user, 2026-08-18): frame rings inset
      // RADIALLY IN THE TRANSVERSE PLANE (toward the section centroid,
      // z untouched) — the boom-station idiom — NEVER along the band's
      // surface normals: at a sharp aft shoulder the transition band's
      // faces are slanted, their normals carry a z component, and the
      // hoop/frame leaned with them (the frame poked through the
      // bulkhead at the keel, user screenshot). For straight bands the
      // two directions coincide, so nothing else moves.
      const secIn = (p, d) => {
        const dx = p[0], dy = p[1] - cyv;
        const l = Math.hypot(dx, dy) || 1;
        return [p[0] - dx / l * d, p[1] - dy / l * d, p[2]];
      };
      // TUBE PILLAR HOOPS (user: the main pillars become tubes, with a
      // larger section): a bent tube swept along the band's MID-RING —
      // each aft-cycle vertex midpointed with its nearest fwd partner
      // (the bulkhead's placement idiom) and pulled inside the skin
      // in the section plane. Per-segment section gate,
      // so a mixed map drops exactly the hoop arcs that changed.
      (() => {
        const HIN = TUBE_RP + 0.005;
        const ringP = [];
        for (const v of aftC) {
          let bp = v, bd = 1e9;
          for (const o2 of fwdC) {
            const d = (V[o2][0]-V[v][0])**2 + (V[o2][1]-V[v][1])**2
                    + (V[o2][2]-V[v][2])**2;
            if (d < bd) { bd = d; bp = o2; }
          }
          ringP.push(secIn([(V[v][0]+V[bp][0])/2, (V[v][1]+V[bp][1])/2,
                            (V[v][2]+V[bp][2])/2], HIN));
        }
        tubeRuns(ringP, TUBE_RP, true);
      })();
      // METAL PILLAR FRAME (user): SLIM along the long axis — one
      // stamped web at mid-band instead of a thick post — but AS DEEP
      // as the wooden posts, and PUNCHED with lightening holes. Outer
      // rail just under the toele, inner rail at the wood-post depth,
      // inset in the section plane.
      (() => {
        const ringO = [], ringI = [];
        const DEEP = (I.shellT || 0.035) * 1.6;
        for (const v of aftC) {
          let bp = v, bd = 1e9;
          for (const o2 of fwdC) {
            const d = (V[o2][0]-V[v][0])**2 + (V[o2][1]-V[v][1])**2
                    + (V[o2][2]-V[v][2])**2;
            if (d < bd) { bd = d; bp = o2; }
          }
          const mx = [(V[v][0]+V[bp][0])/2, (V[v][1]+V[bp][1])/2,
                      (V[v][2]+V[bp][2])/2];
          ringO.push(secIn(mx, 0.009));
          ringI.push(secIn(mx, DEEP));
        }
        // a FULLY metal ring closes (user: the frames gapped at the
        // crown — the ring was emitted as an open run, so the closing
        // segment never existed); mixed maps still split into runs
        const allOk = ringO.every(p => consAt(p[1], p[2]) === 'metal');
        if (allOk) {
          punched(ringO, ringI, true, 'aluminium', 0.006, 0.014);
        } else {
          const runO = [], runI = [];
          for (let k = 0; k <= ringO.length; k++) {
            const kk = k % ringO.length;
            const A = ringO[kk];
            const ok = k < ringO.length &&
              consAt(A[1], A[2]) === 'metal';
            if (ok) { runO.push(ringO[kk]); runI.push(ringI[kk]); }
            else {
              if (runO.length > 1)
                punched(runO, runI, false, 'aluminium', 0.006, 0.014);
              runO.length = 0; runI.length = 0;
            }
          }
        }
      })();
    }
    bandEnds.sort((a, b) => a.zm - b.zm);
    // ONE CENTIMETRE FURTHER IN, TOWARD THE AXIS (user: rails and
    // chines grazed or pierced the hull between stations — a straight
    // member chords a curved surface): every longitudinal member
    // anchor pulls 0.01 toward the local section axis (x -> 0, y ->
    // the station's centroid height), in EVERY construction; the ends
    // still land inside the pillar thickness.
    const inCtr = (p, cyv) => {
      const dx = -p[0], dy = cyv - p[1];
      const l = Math.hypot(dx, dy) || 1;
      return [p[0] + dx/l*0.01, p[1] + dy/l*0.01, p[2]];
    };
    // SQUARE section (user), CENTRED IN THE POST EXTRUSION (user): the
    // endpoint sits midway between the subsurf skin corner and its
    // extruded liner counterpart — corner - n * tPil/2 — so the beam
    // emerges from the post's own thickness at both ends.
    const cB = 0.04;
    const tPil = t0 * 1.6;
    const cenP = c => {
      const n = nrm3(c.n);
      return [V[c.id][0] - n[0]*tPil/2, V[c.id][1] - n[1]*tPil/2,
              V[c.id][2] - n[2]*tPil/2];
    };
    // slice the DISPLAYED skin at z (the boom-station idiom, shared):
    // quads only, seals/caps out; CUT PARTS count at their AS-BUILT
    // place (minus the recorded explode offset) so an exploded door
    // still closes its section.
    const sliceAt = zk => {
      const pmap = new Map();
      for (const f of F) {
        if (f.v.length !== 4 || f.m === 'joint' || f.capFace) continue;
        const o = f.cutPart && f.cutOff ? f.cutOff : null;
        const P4 = f.v.map(vi => o
          ? [V[vi][0] - o[0], V[vi][1] - o[1], V[vi][2] - o[2]] : V[vi]);
        for (let e = 0; e < 4; e++) {
          const a = P4[e], b = P4[(e + 1) % 4];
          const za = a[2] - zk, zb = b[2] - zk;
          if (Math.abs(za) < 1e-9) pmap.set('v' + f.v[e], [a[0], a[1], zk]);
          if (za * zb >= 0) continue;
          const key = 'e' + cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
          if (pmap.has(key)) continue;
          const t = za / (za - zb);
          pmap.set(key, [a[0] + (b[0] - a[0]) * t,
                         a[1] + (b[1] - a[1]) * t, zk]);
        }
      }
      const pts = [...pmap.values()];
      if (pts.length < 8) return null;
      let cx = 0, cy = 0;
      for (const p of pts) { cx += p[0] / pts.length;
                             cy += p[1] / pts.length; }
      return { pts, cx, cy };
    };
    // belly-corner nodes sliced from the displayed mesh between two
    // stations (bubble: the window band is deleted, so the chine needs
    // on-skin support across the cockpit span instead of one chord).
    // `d` = inboard pull; a 4 cm spruce beam needs its CENTRE deeper
    // than the standard 1 cm or its flank pokes the skin (pod belly).
    const chineSamples = (zA, zB, sx, d) => {
      const dd = d || 0.01;
      const out = [];
      const z0 = Math.min(zA, zB), z1 = Math.max(zA, zB);
      const n = Math.max(0, Math.round((z1 - z0) / 0.45) - 1);
      for (let k = 1; k <= n; k++) {
        const sec = sliceAt(z0 + (z1 - z0) * k / (n + 1));
        if (!sec) continue;
        let best = null, bv = -1e9;
        for (const p of sec.pts) {
          const s = sx * p[0] - p[1];
          if (sx * p[0] > 0 && s > bv) { bv = s; best = p; }
        }
        if (best) {
          const dx = -best[0], dy = sec.cy - best[1];
          const l = Math.hypot(dx, dy) || 1;
          out.push([best[0] + dx / l * dd, best[1] + dy / l * dd,
                    best[2]]);
        }
      }
      return out;
    };
    // land an extrapolated stringer head ON the displayed hull. The
    // straight continuation keeps its height (the aft-shoulder rule),
    // but its raw x follows the boom's widening trend and can miss the
    // hull sideways (measured 8 cm proud on the jodel defaults) — a
    // head OUTSIDE the sliced section snaps to the nearest section
    // point, inset radially; heads already inside (the no-shoulder
    // identity) return null and stay untouched.
    const landSec = (p, inset) => {
      const sec = sliceAt(p[2]);
      if (!sec) return null;
      let best = null, bv = 1e9;
      for (const q of sec.pts) {
        if (p[0] !== 0 && q[0] * p[0] < 0) continue;
        const d2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
        if (d2 < bv) { bv = d2; best = q; }
      }
      if (!best) return null;
      const rH = Math.hypot(p[0] - sec.cx, p[1] - sec.cy);
      const rB = Math.hypot(best[0] - sec.cx, best[1] - sec.cy);
      if (rH <= rB - inset) return null;
      const dx = sec.cx - best[0], dy = sec.cy - best[1];
      const l = Math.hypot(dx, dy) || 1;
      return [best[0] + dx / l * inset, best[1] + dy / l * inset, p[2]];
    };
    for (let i = 0; i + 1 < bandEnds.length; i++) {
      // bubble (user: "the aluminium option screws up with the front
      // tubes"): the window-pillar band is DELETED, so the pair from
      // the cabin band to the NOSE band would span the whole cockpit
      // in one straight chord — the L-angles shot out of the curved
      // belly. The WAIST-level rails stay out (an open cockpit carries
      // no flank stringers through the opening IRL) but the BELLY
      // chine is real structure: it reattaches to the nose's bottom
      // corners SWEPT along the displayed hull, its nodes sliced
      // post-subsurf (user ruling). Tube chines live in the chn
      // machinery below and get the same samples there. On the POD
      // every bay flanks the open cockpit, so every pair takes this
      // branch (S5).
      if (S.config && S.config.canopy
          && S.config.canopy.mode === 'bubble'
          && (bandEnds[i + 1].isFront
              || (S.config && S.config.mirror))) {
        const ba2 = bandEnds[i], bb2 = bandEnds[i + 1];
        for (const k2 of ['P', 'M']) {
          const At = ba2.mid[k2], Bt = bb2.mid[k2];
          if (!At || !Bt) continue;
          const c = consAt((At[1] + Bt[1]) / 2, (At[2] + Bt[2]) / 2);
          if (!woodLike(c)) continue;
          const A0 = ba2.fwd[k2], B0 = bb2.aft[k2];
          const wA = c === 'metal' ? inCtr(At, ba2.cy)
            : A0 && A0.id != null ? inCtr(cenP(A0), ba2.cy) : null;
          const wB = c === 'metal' ? inCtr(Bt, bb2.cy)
            : B0 && B0.id != null ? inCtr(cenP(B0), bb2.cy) : null;
          if (!wA || !wB) continue;
          const sx = k2 === 'P' ? 1 : -1;
          const run = [wA, ...chineSamples(ba2.zm, bb2.zm, sx,
            c === 'metal' ? 0.01 : 0.01 + cB / 2), wB];
          for (let s2 = 0; s2 + 1 < run.length; s2++) {
            if (c === 'metal')
              metalAngle(run[s2], run[s2 + 1], 0.03,
                         [0, (ba2.cy + bb2.cy) / 2]);
            else beam(run[s2], run[s2 + 1], cB, cB);
          }
        }
        continue;
      }
      const a = bandEnds[i].fwd, b = bandEnds[i + 1].aft;
      const midA = bandEnds[i].mid, midB = bandEnds[i + 1].mid;
      const ba = bandEnds[i], bb = bandEnds[i + 1];
      // chine pairs run every bay including the cowl; the CEILING and
      // FLOOR rails (user) are cabin furniture and stop before the
      // cowl bay. The REALIZATION picks the anchors: wood beams end at
      // the post faces (band-edge cycles), tubes at the pillar MIDDLES
      // so they intersect the hoops (user correction).
      const kinds = ['P', 'M'];
      if (!bandEnds[i + 1].isFront) kinds.push('tL', 'tR', 'fL', 'fR');
      for (const k2 of kinds) {
        const At = midA[k2], Bt = midB[k2];
        if (!At || !Bt) continue;
        const c = consAt((At[1] + Bt[1]) / 2, (At[2] + Bt[2]) / 2);
        if (woodLike(c)) {
          if (c === 'metal') {
            // metal members are L-ANGLES, run to the pillar MIDDLES
            metalAngle(inCtr(At, ba.cy), inCtr(Bt, bb.cy), 0.03,
                       [0, (ba.cy + bb.cy) / 2]);
          } else {
            const A0 = a[k2], B0 = b[k2];
            if (A0 && A0.id != null && B0 && B0.id != null)
              beam(inCtr(cenP(A0), ba.cy), inCtr(cenP(B0), bb.cy),
                   cB, cB);
          }
        } else if (c === 'tube') {
          // the chine line is swept CONTINUOUSLY with the boom chains
          // below — per-pair segments only for the cabin rails
          if (k2 !== 'P' && k2 !== 'M')
            tubeSeg(inCtr(At, ba.cy), inCtr(Bt, bb.cy),
                    Math.max(0.008, cB / 3));
        }
      }
      // PAX-BAY DIAGONAL (user): ties the waist rail's NOSE-side end
      // to the chine's TAIL-side end, per side — same key-node
      // principles: both ends are the existing beams' own end centres,
      // and the brace is slightly thinner (0.032 < 0.04) so its ends
      // live inside them. Pax bays only (the pilot bay's brace belongs
      // to its door), and only where the waist rail exists.
      if (!bandEnds[i + 1].isFront) {
        // a bay WITH a defined door owns its bracing (user): the bay
        // diagonal exists only in doorless bays, in both realizations
        const D2 = (S.config && S.config.doors) || {};
        const bayDoor = bandEnds[i + 1].isWin ? D2.pilot : D2.pax;
        for (const sx of [1, -1]) {
          const cKey = sx > 0 ? 'P' : 'M', wKey = sx > 0 ? 'wP' : 'wM';
          const cMid = midA[cKey], wMid = midB[wKey];
          if (!bayDoor && cMid && wMid && consAt((cMid[1] + wMid[1]) / 2,
              (cMid[2] + wMid[2]) / 2) === 'tube') {
            tubeSeg(wMid, cMid, TUBE_R * 0.9);
            continue;
          }
          if (bandEnds[i + 1].isWin || bayDoor) continue;
          const chineEnd = cenP(sx > 0 ? a.P : a.M);
          const rail = waistRails.filter(r => r.sx === sx &&
              r.zB > bandEnds[i].zm && r.zA < bandEnds[i + 1].zm)
            .sort((r1, r2) =>
              Math.abs(r1.zB - bandEnds[i + 1].zm) -
              Math.abs(r2.zB - bandEnds[i + 1].zm))[0];
          if (!rail || !chineEnd) continue;
          const cpd = consAt((rail.fwdEnd[1] + chineEnd[1]) / 2,
                             (rail.fwdEnd[2] + chineEnd[2]) / 2);
          if (woodLike(cpd)) {
            // metal: the chine anchor is the mid-pillar node too
            const cEnd = inCtr(cpd === 'metal' && midA[cKey]
              ? midA[cKey] : chineEnd, ba.cy);
            if (cpd === 'metal')
              metalAngle(rail.fwdEnd, cEnd, 0.026,
                         [0, (rail.fwdEnd[1] + cEnd[1]) / 2]);
            else beam(rail.fwdEnd, cEnd, 0.032, 0.032);
          }
        }
      }
    }
    // DOOR STRUCTURE (user: in wood the door is INTEGRAL structure —
    // no rubber seal; cageRims suppresses its tube). Along each
    // recorded door outline: a wooden FRAME extruded INWARD so the
    // exterior stays aerodynamic (rail verts shared along the loop —
    // smooth lengthwise, flat across the section), a WAIST BAR like
    // the bay rails, and one DIAGONAL brace. The outline travels with
    // the cut part, so the frame rides the exploded door too.
    if (m.outlines) {
      const dvN = new Map(), vOff = new Map();
      for (const f of F) {
        if (!f.doorKey || f.v.length !== 4) continue;
        const p = f.v.map(i2 => V[i2]);
        const u = [p[2][0]-p[0][0], p[2][1]-p[0][1], p[2][2]-p[0][2]];
        const w2 = [p[3][0]-p[1][0], p[3][1]-p[1][1], p[3][2]-p[1][2]];
        const n = [u[1]*w2[2]-u[2]*w2[1], u[2]*w2[0]-u[0]*w2[2],
                   u[0]*w2[1]-u[1]*w2[0]];
        for (const vi of f.v) {
          const s = dvN.get(vi) || [0, 0, 0];
          dvN.set(vi, [s[0]+n[0], s[1]+n[1], s[2]+n[2]]);
          if (f.cutOff) vOff.set(vi, f.cutOff);
        }
      }
      const FW = 0.05, FD = 0.028, FE = 0.003, BAR = 0.022;
      for (const o of m.outlines) {
        if (o.kind !== 'door') continue;
        const pts2 = o.pts, NN = pts2.length;
        if (NN < 8) continue;
        let cx3 = 0, cy3 = 0, cz3 = 0;
        for (const p of pts2) {
          cx3 += p[0]/NN; cy3 += p[1]/NN; cz3 += p[2]/NN;
        }
        const cD = consAt(cy3, cz3);
        if (!woodLike(cD) && cD !== 'tube') continue;
        // per-point outward normal; synthesized sill points (id -1)
        // borrow the nearest tagged neighbour's
        const nrms = pts2.map((p, i) => {
          const id = o.ids[i];
          const n = id >= 0 ? dvN.get(id) : null;
          return n ? nrm3(n) : null;
        });
        for (let i = 0; i < NN; i++) {
          if (nrms[i]) continue;
          for (let d2 = 1; d2 < NN; d2++) {
            const a2 = nrms[(i + d2) % NN], b2 = nrms[(i - d2 + NN) % NN];
            if (a2 || b2) { nrms[i] = a2 || b2; break; }
          }
          if (!nrms[i]) nrms[i] = [cx3 >= 0 ? 1 : -1, 0, 0];
        }
        if (cD === 'tube') {
          // THE TUBE DOOR (user): its own continuous tube outline that
          // FITS INSIDE the door — inset toward the door centre AND
          // pulled toward the centreline, so it cannot intersect the
          // fuselage — plus the waist bar and the X, all anchored ON
          // that outline. The seal is dropped (cageRims). Slim gauge:
          // the thick lines are the airframe's, not the door's.
          const TIN = 0.024, TDEP = 0.022;
          const ring3 = [];
          for (let i = 0; i < NN; i++) {
            const p = pts2[i], n = nrms[i];
            let iw = [cx3 - p[0], cy3 - p[1], cz3 - p[2]];
            const dnn = iw[0]*n[0] + iw[1]*n[1] + iw[2]*n[2];
            iw = nrm3([iw[0]-dnn*n[0], iw[1]-dnn*n[1], iw[2]-dnn*n[2]]);
            ring3.push([p[0] + iw[0]*TIN - n[0]*TDEP,
                        p[1] + iw[1]*TIN - n[1]*TDEP,
                        p[2] + iw[2]*TIN - n[2]*TDEP]);
          }
          tubePath(ring3, TUBE_R, true);
          let off2 = [0, 0, 0];
          for (const id of o.ids)
            if (id >= 0 && vOff.has(id)) { off2 = vOff.get(id); break; }
          const yWd2 = S.waistY + off2[1];
          let bF2 = -1, bA2 = -1, dF3 = 1e9, dA3 = 1e9;
          pts2.forEach((p, i) => {
            const dy = Math.abs(p[1] - yWd2);
            if (p[2] >= cz3) { if (dy < dF3) { dF3 = dy; bF2 = i; } }
            else if (dy < dA3) { dA3 = dy; bA2 = i; }
          });
          // straight bars chord the concave panel — 15 mm deeper than
          // the outline tube (same measured sagitta as the wood/metal
          // bars)
          const barP = i2 => {
            const r2 = ring3[i2], n = nrms[i2];
            return [r2[0] - n[0]*0.015, r2[1] - n[1]*0.015,
                    r2[2] - n[2]*0.015];
          };
          if (bF2 >= 0 && bA2 >= 0) {
            tubeSeg(barP(bF2), barP(bA2), TUBE_R);
            let z0b = 1e9, y0b = 1e9, z1b = -1e9, y1b = -1e9;
            for (const p of pts2) {
              z0b = Math.min(z0b, p[2]); y0b = Math.min(y0b, p[1]);
              z1b = Math.max(z1b, p[2]); y1b = Math.max(y1b, p[1]);
            }
            let iBB2 = 0, bd4 = 1e9;
            pts2.forEach((p, i) => {
              const s = (p[2]-z0b)*(p[2]-z0b) + (p[1]-y0b)*(p[1]-y0b);
              if (s < bd4) { bd4 = s; iBB2 = i; }
            });
            tubeSeg(barP(bF2), barP(iBB2), TUBE_R * 0.9);
            const yLim2 = y0b + 0.25 * (y1b - y0b);
            let iBF2 = -1, bz2 = -1e9;
            pts2.forEach((p, i) => {
              if (p[1] > yLim2) return;
              if (p[2] > bz2) { bz2 = p[2]; iBF2 = i; }
            });
            if (iBF2 >= 0) tubeSeg(barP(bA2), barP(iBF2), TUBE_R * 0.9);
          }
          continue;
        }
        // four rails: outline / toward-centre pair, at FE and FE + FD
        // below the surface
        const rails = [[], [], [], []];
        for (let i = 0; i < NN; i++) {
          const p = pts2[i], n = nrms[i];
          let iw = [cx3 - p[0], cy3 - p[1], cz3 - p[2]];
          const dnn = iw[0]*n[0] + iw[1]*n[1] + iw[2]*n[2];
          iw = nrm3([iw[0]-dnn*n[0], iw[1]-dnn*n[1], iw[2]-dnn*n[2]]);
          const at = (wq, dq) => V.push([
            p[0] + iw[0]*wq - n[0]*dq,
            p[1] + iw[1]*wq - n[1]*dq,
            p[2] + iw[2]*wq - n[2]*dq]) - 1;
          rails[0].push(at(0, FE));
          rails[1].push(at(FW, FE));
          rails[2].push(at(FW, FE + FD));
          rails[3].push(at(0, FE + FD));
        }
        for (let i = 0; i < NN; i++) {
          const j = (i + 1) % NN;
          for (const [ra, rb] of [[0, 1], [1, 2], [2, 3], [3, 0]])
            add.push({ v: [rails[ra][i], rails[ra][j],
                           rails[rb][j], rails[rb][i]], m: wMat(cD) });
        }
        // vertex -> part translation (recorded by cageCut): anchors
        // defined against fuselage lines must follow the EXPLODED part
        let off = [0, 0, 0];
        for (const id of o.ids)
          if (id >= 0 && vOff.has(id)) { off = vOff.get(id); break; }
        const yWd = S.waistY + off[1];
        // KEY-NODE ANCHORING (user, annotated screenshot): every bar
        // end sits at the FRAME'S OWN SECTION CENTRE — the outline
        // point pushed HALF THE FRAME WIDTH toward the door centre
        // (the middle of the outer and inner rim) and HALF THE FRAME
        // DEPTH under the skin (the middle of its thickness) — the
        // same formula the frame rails use, so the anchor is exact by
        // construction. Bars are slightly THINNER than the frame
        // (0.022 < FD < FW): their ends live strictly inside the
        // frame solid — no face overlap, nothing near the exterior.
        const frameMidD = (i2, dq) => {
          const p = pts2[i2], n = nrms[i2];
          let iw = [cx3 - p[0], cy3 - p[1], cz3 - p[2]];
          const dnn = iw[0]*n[0] + iw[1]*n[1] + iw[2]*n[2];
          iw = nrm3([iw[0]-dnn*n[0], iw[1]-dnn*n[1], iw[2]-dnn*n[2]]);
          return [p[0] + iw[0]*FW/2 - n[0]*dq,
                  p[1] + iw[1]*FW/2 - n[1]*dq,
                  p[2] + iw[2]*FW/2 - n[2]*dq];
        };
        const frameMid = i2 => frameMidD(i2, FE + FD/2);
        // BAR anchors sit 15 mm deeper (user report + measured: the
        // door panel is genuinely CONCAVE in plan — the flank's ring
        // pull-in dips the skin 0.011 inside the fwd/aft chord at
        // mid-door, so a straight bar on the frame plane stood proud)
        const barMid = i2 => frameMidD(i2, FE + FD/2 + 0.015);
        // WAIST BAR: between the outline's fwd/aft crossings of the
        // door's OWN waist height
        let bF = -1, bA = -1, dF2 = 1e9, dA2 = 1e9;
        pts2.forEach((p, i) => {
          const dy = Math.abs(p[1] - yWd);
          if (p[2] >= cz3) { if (dy < dF2) { dF2 = dy; bF = i; } }
          else if (dy < dA2) { dA2 = dy; bA = i; }
        });
        const dBar = (P1, P2) => {
          if (cD === 'metal')
            metalAngle(P1, P2, 0.022, [cx3, cy3]);
          else beam(P1, P2, BAR, BAR, wMat(cD));
        };
        if (bF >= 0 && bA >= 0) {
          dBar(barMid(bF), barMid(bA));
          // DIAGONAL: from the waist-line angle on the front edge to
          // EXACTLY the bottom-back corner — the end centred in the
          // corner the outline forms (nearest outline point to the
          // true bbox corner, at frame mid)
          let z0b = 1e9, y0b = 1e9, z1b = -1e9, y1b = -1e9;
          for (const p of pts2) {
            z0b = Math.min(z0b, p[2]); y0b = Math.min(y0b, p[1]);
            z1b = Math.max(z1b, p[2]); y1b = Math.max(y1b, p[1]);
          }
          let iBB = 0, bd2 = 1e9;
          pts2.forEach((p, i) => {
            const s = (p[2]-z0b)*(p[2]-z0b) + (p[1]-y0b)*(p[1]-y0b);
            if (s < bd2) { bd2 = s; iBB = i; }
          });
          dBar(barMid(bF), barMid(iBB));
          // the X (user): the second diagonal — waist-aft crossing to
          // the BOTTOM-FRONT corner (the most-forward point of the
          // outline's bottom region; the outline's global max z is the
          // waist angle, so the corner is found within the bottom band)
          const yLim = y0b + 0.25 * (y1b - y0b);
          let iBF = -1, bz = -1e9;
          pts2.forEach((p, i) => {
            if (p[1] > yLim) return;
            if (p[2] > bz) { bz = p[2]; iBF = i; }
          });
          // metal doors take a SINGLE diagonal (user ruling — the X
          // stays with wood and tube)
          if (iBF >= 0 && cD !== 'metal') dBar(barMid(bA), barMid(iBF));
        }
      }
    }
    // HIDDEN DASH CROSS-BEAM (user): one straight spruce member linking
    // the two symmetrical points where the windshield angle starts —
    // the base-line ends at the A-pillars, read off the displayed mesh
    // (the pre-cut wsBase record when parts are cut, the material
    // adjacency otherwise). It lives inside the dash solid; no joining
    // geometry, ends pulled inboard so they stay under the skin.
    (() => {
      let xP = null, xM = null;
      const take = vi => {
        const p = V[vi];
        if (!xP || p[0] > xP[0]) xP = p;
        if (!xM || p[0] < xM[0]) xM = p;
      };
      if (m.wsBase && m.wsBase.length) {
        for (const [a2, b2] of m.wsBase) { take(a2); take(b2); }
      } else {
        const own = new Map();
        for (const f of F) {
          if (f.v.length !== 4) continue;
          if (f.m !== 'windshield' && f.m !== 'waistband') continue;
          for (let e = 0; e < 4; e++) {
            const k = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
            if (!own.has(k)) own.set(k, new Set());
            own.get(k).add(f.m);
          }
        }
        for (const [k, ms] of own)
          if (ms.has('windshield') && ms.has('waistband'))
            k.split('_').map(Number).forEach(take);
      }
      if (!xP || !xM) return;
      const cD = consAt((xP[1] + xM[1]) / 2, (xP[2] + xM[2]) / 2);
      if (!woodLike(cD) && cD !== 'tube') return;
      // anchored at the BOTTOM of the waistband (user correction): the
      // base-line ends drop by the band height onto the waist line —
      // both lines carry the same windshield-base lift, so the drop is
      // a pure vertical
      const dropB = S.bandY - S.waistY;
      const pull = tS + wW / 2;
      member([xP[0] - pull, xP[1] - dropB, xP[2]],
             [xM[0] + pull, xM[1] - dropB, xM[2]], wW);
    })();
    // BOOM STRUCTURE — one station machinery, two realizations (user):
    // wood gets the AJOURE plywood webs, tube gets SECTION RINGS at
    // the same metre stations plus bent LONGERONS (top-side pair by
    // ring angle, bottom corner pair) and zigzag bay diagonals — the
    // bathtub structure's mesh IS the tube boom's procedural base.
    // Sections are SLICED FROM THE DISPLAYED MESH (angle sort is
    // sound: the boom section is convex); the wood web is an annulus —
    // the big lightening hole IS the ajoure.
    const consBoom = CM.boomBelow || cons;
    if (consBoom === 'wood' || consBoom === 'tube'
        || consBoom === 'metal') {
      const NFr = Math.max(0, Math.round(S.boom.len) - 1);
      const sp = S.boom.len / (NFr + 1);
      // no station forward of k=1 (user: the floating mini-ring by the
      // cabin is gone — the boom connects to the pax pillar HOOP)
      const kLo = 1;
      const kHi = consBoom === 'wood' ? NFr : NFr + 1;
      const mtW = [[], []], mtB = [[], []];   // metal stringer nodes
      // the boom nodes carry the THICK longerons now — the inset must
      // track the big radius (it was TUBE_R-sized, which is exactly why
      // the waist longeron poked through the boom skin, user screenshot)
      const BOOM_IN = TUBE_RP + 0.005;
      const topCh = [[], []], botCh = [[], []];
      for (let k = kLo; k <= kHi; k++) {
        const zk = k === 0 ? zPax0 - 0.03
                 : k === NFr + 1 ? zBoom0 + 0.05
                 : zPax0 - k * sp;
        // the frame stations can land EXACTLY on the subdivision's own
        // vertex rings (boomLen/4 spacing = the L2 lattice — measured:
        // every slice found 0 crossings), so on-plane VERTICES are
        // section points too (dedup by id); strict crossings cover the
        // in-between case at other levels/lengths.
        const pmap = new Map();
        for (const f of F) {
          if (f.v.length !== 4 || f.cutPart || f.m === 'joint'
              || f.capFace) continue;
          for (let e = 0; e < 4; e++) {
            const a = f.v[e], b = f.v[(e + 1) % 4];
            const za = V[a][2] - zk, zb = V[b][2] - zk;
            if (Math.abs(za) < 1e-9) pmap.set('v' + a,
              [V[a][0], V[a][1], zk]);
            if (za * zb >= 0) continue;
            const key = 'e' + cageEdgeKey(a, b);
            if (pmap.has(key)) continue;
            const t = za / (za - zb);
            pmap.set(key, [V[a][0] + (V[b][0]-V[a][0])*t,
                           V[a][1] + (V[b][1]-V[a][1])*t, zk]);
          }
        }
        const pts = [...pmap.values()];
        if (pts.length < 8) continue;
        let cx = 0, cy2 = 0;
        for (const p of pts) { cx += p[0]/pts.length;
                               cy2 += p[1]/pts.length; }
        pts.sort((p, q) => Math.atan2(p[1]-cy2, p[0]-cx)
                         - Math.atan2(q[1]-cy2, q[0]-cx));
        if (consBoom === 'metal') {
          // METAL STATION FRAME (user): a thin PUNCHED web ring — the
          // sliced section inset just under the toele for the outer
          // rail, the constant-margin offset (the ajoure rule) for the
          // inner, with the raised half-moon floor kept; stringer
          // nodes recorded at the waist-mid and chine corners
          const ring0 = pts.map(p => {
            const dx = cx - p[0], dy = cy2 - p[1];
            const l = Math.hypot(dx, dy) || 1;
            return [p[0] + dx/l*0.009, p[1] + dy/l*0.009, zk];
          });
          if (k >= 1 && k <= NFr) {
            // SAME LOOK AS THE CABIN PILLAR FRAMES (user): the boom's
            // internal pillars are narrow punched RINGS at the cabin
            // frames' depth and box thickness — one consistent metal
            // structure, not the wide ajoure web (that idiom stays
            // with the wood panels)
            const DEEP2 = (I.shellT || 0.035) * 1.6;
            const ringH = ring0.map(p => {
              const dx = cx - p[0], dy = cy2 - p[1];
              const l = Math.hypot(dx, dy) || 1;
              const d = Math.min(DEEP2 - 0.009, l * 0.6);
              return [p[0] + dx/l*d, p[1] + dy/l*d, zk];
            });
            punched(ring0, ringH, true, 'aluminium', 0.006, 0.014);
          }
          const pickW = sx => {
            const yWm3 = (S.waistY + S.bandY) / 2;
            let best = ring0[0], bv = 1e9;
            for (const p of ring0) {
              if (sx * p[0] <= 0) continue;
              const s = Math.abs(p[1] - yWm3);
              if (s < bv) { bv = s; best = p; }
            }
            return best;
          };
          const pickC = sx => {
            let best = ring0[0], bv = -1e9;
            for (const p of ring0) {
              const s = sx * p[0] - p[1];
              if (s > bv) { bv = s; best = p; }
            }
            return best;
          };
          const dirOf = p => {
            const dx = cx - p[0], dy = cy2 - p[1];
            const l = Math.hypot(dx, dy) || 1;
            return [dx / l, dy / l];
          };
          for (const [arr, pk] of [[mtW, pickW], [mtB, pickC]]) {
            const pP = pk(1), pM = pk(-1);
            arr[0].push({ p: pP, d: dirOf(pP) });
            arr[1].push({ p: pM, d: dirOf(pM) });
          }
          continue;
        }
        if (consBoom === 'tube') {
          // SECTION RING: a bent tube along the sliced outline, pulled
          // inside the skin radially; longeron nodes recorded — the
          // top pair by ring angle (~60/120 deg), the bottom pair at
          // the chine corners
          const ring2 = pts.map(p => {
            const dx = cx - p[0], dy = cy2 - p[1];
            const l = Math.hypot(dx, dy) || 1;
            return [p[0] + dx/l*BOOM_IN, p[1] + dy/l*BOOM_IN, zk];
          });
          tubeRuns(ring2, TUBE_R, true);
          // main longeron nodes at the TOP OF THE WAISTLINE (user,
          // annotated drawing): bandY is a global constant, so the
          // chained nodes are a straight line; bottom pair at the
          // chines
          const yWm2 = (S.waistY + S.bandY) / 2;   // middle of the band
          const wPick = sx => {
            let best = ring2[0], bv = 1e9;
            for (const p of ring2) {
              if (sx * p[0] <= 0) continue;
              const s = Math.abs(p[1] - yWm2);
              if (s < bv) { bv = s; best = p; }
            }
            return best;
          };
          const cornPick = sx => {
            let best = ring2[0], bv = -1e9;
            for (const p of ring2) {
              const s = sx * p[0] - p[1];
              if (s > bv) { bv = s; best = p; }
            }
            return best;
          };
          topCh[0].push(inCtr(wPick(1), cy2));
          topCh[1].push(inCtr(wPick(-1), cy2));
          botCh[0].push(inCtr(cornPick(1), cy2));
          botCh[1].push(inCtr(cornPick(-1), cy2));
          continue;
        }
        // the web is a SOLID (user: half a centimetre of thickness) and
        // the lightening hole's FLOOR is raised to the section centroid
        // — the hole reads as a half circle and the web below the chord
        // stays full (user correction: the hole was too big, a raised
        // floor shrinks it into the half-moon of the real plywood webs)
        // CONSTANT WOOD WIDTH around the opening (user): the hole is
        // the outline offset INWARD by a fixed margin along the local
        // boundary normal — the radial lerp scaled the wood with the
        // local radius (the middle read thicker than the sides). The
        // margin is ~12 cm, clamped to 3/4 of the local distance to
        // the centroid so small aft webs keep a small opening instead
        // of inverting; the raised half-moon floor stays.
        const MW = 0.12;
        const n2p = pts.length;
        let y0w = 1e9;
        for (const p of pts) y0w = Math.min(y0w, p[1]);
        // the hole floor sits LOW (user): constant margin above the
        // section bottom, like the top — the centroid clamp is out
        const yFloor = Math.min(y0w + MW, cy2);
        const o2 = [], h2 = [];
        for (let i2 = 0; i2 < n2p; i2++) {
          const p = pts[i2];
          const dx = cx - p[0], dy = cy2 - p[1];
          const l = Math.hypot(dx, dy) || 1;
          o2.push([p[0] + dx/l*0.012, p[1] + dy/l*0.012]);
          const pm = pts[(i2 - 1 + n2p) % n2p], pp = pts[(i2 + 1) % n2p];
          const tx = pp[0] - pm[0], ty = pp[1] - pm[1];
          const tl = Math.hypot(tx, ty) || 1;
          let nx = -ty / tl, ny = tx / tl;
          if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
          const mm = Math.min(MW, l * 0.75);
          h2.push([p[0] + nx * mm, Math.max(p[1] + ny * mm, yFloor)]);
        }
        const TH = 0.0025;
        const oF = o2.map(p => V.push([p[0], p[1], zk + TH]) - 1);
        const oB = o2.map(p => V.push([p[0], p[1], zk - TH]) - 1);
        const hF = h2.map(p => V.push([p[0], p[1], zk + TH]) - 1);
        const hB = h2.map(p => V.push([p[0], p[1], zk - TH]) - 1);
        const n2 = pts.length;
        for (let i2 = 0; i2 < n2; i2++) {
          const j = (i2 + 1) % n2;
          add.push({ v: [oF[i2], oF[j], hF[j], hF[i2]], m: 'woodFrame' });
          add.push({ v: [hB[i2], hB[j], oB[j], oB[i2]], m: 'woodFrame' });
          add.push({ v: [oB[i2], oB[j], oF[j], oF[i2]], m: 'woodFrame' });
          add.push({ v: [hF[i2], hF[j], hB[j], hB[i2]], m: 'woodFrame' });
        }
      }
      if (consBoom === 'metal') {
        // METAL STRINGERS v2 (user reality check): L-ANGLES, solid —
        // real stringers are bent profiles, never lightening-holed
        // (the punched blades are gone). The chains CONNECT TO THE
        // CABIN (user: the cabin-side section was missing): the aft
        // pillar band's mid nodes are prepended, same junction rule
        // as the tube chains.
        const b0m = bandEnds[0];
        if (b0m && b0m.mid) {
          const jd = p => {
            const l = Math.hypot(p[0], b0m.cy - p[1]) || 1;
            return [-p[0] / l, (b0m.cy - p[1]) / l];
          };
          const pre = (arr, node) => {
            if (node && arr.length)
              arr.unshift({ p: inCtr(node, b0m.cy), d: jd(node) });
          };
          // BOTTOM chains under a sharp aft shoulder (user rule): the
          // stringer follows the boom profile to the (angled) pax
          // pillar, then continues STRAIGHT to the pillarCabin section
          // plane at whatever height the line naturally intersects —
          // never bent down to reach the dropped corner node. With no
          // shoulder the extrapolation lands on the corner anyway, so
          // straight sections are unchanged.
          const preLine = (arr, node) => {
            if (arr.length >= 2 && bandEnds.length > 1) {
              // bubble: bandEnds[1] can be the NOSE band (the window
              // band is deleted and there may be no pax bay) — the
              // line would extrapolate metres ahead of the boom. The
              // head lands on the nearest forward frame instead; the
              // swept belly run (band-pairs loop) carries the chine
              // on to the nose corners.
              const bT = S.config && S.config.canopy
                  && S.config.canopy.mode === 'bubble'
                  && bandEnds[1].isFront ? bandEnds[0] : bandEnds[1];
              const A = arr[0].p, B = arr[1].p;
              const dz = A[2] - B[2];
              if (Math.abs(dz) > 1e-6) {
                const t = (bT.zm - A[2]) / dz;
                const ep = [A[0] + (A[0] - B[0]) * t,
                            A[1] + (A[1] - B[1]) * t, bT.zm];
                arr.unshift({ p: landSec(ep, 0.009) || ep,
                              d: arr[0].d });
                return;
              }
            }
            pre(arr, node);
          };
          pre(mtW[0], b0m.mid.wP); pre(mtW[1], b0m.mid.wM);
          preLine(mtB[0], b0m.mid.P); preLine(mtB[1], b0m.mid.M);
        }
        for (const chain of [mtW[0], mtW[1], mtB[0], mtB[1]])
          for (let i = 0; i + 1 < chain.length; i++) {
            const a2 = chain[i], b2 = chain[i + 1];
            const mid2 = [(a2.p[0]+b2.p[0])/2, (a2.p[1]+b2.p[1])/2];
            const dd = [(a2.d[0]+b2.d[0])/2, (a2.d[1]+b2.d[1])/2];
            metalAngle(a2.p, b2.p, 0.03,
                       [mid2[0] + dd[0], mid2[1] + dd[1]]);
          }
      }
      if (consBoom === 'tube') {
        // LONGERONS: simple bent tubes station to station (top-side
        // pair + bottom chine pair), and one ZIGZAG DIAGONAL per bay
        // per side between the top and bottom chains — the Warren
        // truss the fabric hides
        const seg = (A, B, r) => {
          if (!A || !B) return;
          if (consAt((A[1]+B[1])/2, (A[2]+B[2])/2) === 'tube')
            tubeSeg(A, B, r);
        };
        // THE MAIN LONGERON (user, annotated drawing): ONE continuous
        // tube per side runs all along the top of the waistline, nose
        // to tail — every cabin band's mid node (front pillar first)
        // chained with the boom stations into a single sweep. The
        // bottom chine line gets the identical treatment.
        // the waist longeron BREAKS at any bay with a defined door
        // (user: no bar across a doorway) — the chain is assembled as
        // runs that split at doored bays; the chine line stays
        // continuous (the door sill sits above it)
        const D3 = (S.config && S.config.doors) || {};
        const runsP = [[]], runsM = [[]];
        const chnP = [], chnM = [];
        for (let i = bandEnds.length - 1; i >= 0; i--) {
          if (i < bandEnds.length - 1 && !bandEnds[i + 1].isFront) {
            const doored = bandEnds[i + 1].isWin ? D3.pilot : D3.pax;
            if (doored) { runsP.push([]); runsM.push([]); }
          }
          const md = bandEnds[i].mid, cyv = bandEnds[i].cy;
          if (md.wP) runsP[runsP.length - 1].push(inCtr(md.wP, cyv));
          if (md.wM) runsM[runsM.length - 1].push(inCtr(md.wM, cyv));
          // the aft-most band's corner node is NOT a chine anchor (user
          // rule, sharp aft shoulder): the boom chine run below gets a
          // straight extrapolated terminus instead of bending down to
          // the dropped corner
          if (i > 0 && md.P) chnP.push(inCtr(md.P, cyv));
          if (i > 0 && md.M) chnM.push(inCtr(md.M, cyv));
        }
        for (const p of topCh[0]) runsP[runsP.length - 1].push(p);
        for (const p of topCh[1]) runsM[runsM.length - 1].push(p);
        // the boom's bottom-corner stations run as their OWN chine run,
        // opened by a straight extrapolation of the first two stations
        // onto the pillarCabin section plane — the run lands ON the
        // cabin hoop at whatever height the boom line dictates (user
        // rule; with no shoulder the line passes the old corner anyway).
        // The cabin-side chine run above ends at its own corner line —
        // longerons landing on a frame from both sides, as built IRL.
        const boomRun = ch => {
          if (ch.length >= 2 && bandEnds.length > 1) {
            // same target + landing rules as the metal preLine: in
            // bubble mode a front bandEnds[1] means no intermediate
            // frame — land on bandEnds[0]'s own plane; and a head
            // that misses the hull sideways snaps onto the sliced
            // section (no-shoulder heads stay put).
            const bT = S.config && S.config.canopy
                && S.config.canopy.mode === 'bubble'
                && bandEnds[1].isFront ? bandEnds[0] : bandEnds[1];
            const A = ch[0], B = ch[1];
            const dz = A[2] - B[2];
            if (Math.abs(dz) > 1e-6) {
              const t = (bT.zm - A[2]) / dz;
              const ep = [A[0] + (A[0] - B[0]) * t,
                          A[1] + (A[1] - B[1]) * t, bT.zm];
              return [landSec(ep, BOOM_IN) || ep, ...ch];
            }
          }
          const b0c = bandEnds[0];
          const md0 = b0c && b0c.mid;
          const node = ch === botCh[0] ? md0 && md0.P : md0 && md0.M;
          return node ? [inCtr(node, b0c.cy), ...ch] : ch;
        };
        const chnPb = boomRun(botCh[0]), chnMb = boomRun(botCh[1]);
        // bubble: the deleted window band leaves the nose->cabin chine
        // span unsupported — the chord dived off the curved belly
        // (user strays). Sampled belly nodes fill the span; with no
        // intermediate frame at all (no pax bay) the swept run carries
        // the chine from the nose corner onto the boom run's landing.
        if (S.config && S.config.canopy
            && S.config.canopy.mode === 'bubble'
            && bandEnds.length > 1
            && bandEnds[bandEnds.length - 1].isFront) {
          const zF = bandEnds[bandEnds.length - 1].zm;
          for (const [ch, chb, sx] of [[chnP, chnPb, 1],
                                       [chnM, chnMb, -1]]) {
            if (ch.length >= 2)
              ch.splice(1, 0, ...chineSamples(ch[1][2], zF, sx).reverse());
            else if (ch.length === 1 && chb.length)
              ch.push(...chineSamples(chb[0][2], zF, sx).reverse(),
                      chb[0]);
          }
        }
        // the MAIN lines are as thick as the pillars (user): waistband
        // longeron + bottom-corner longeron at TUBE_RP; the rest slim
        for (const ch of [...runsP, ...runsM, chnP, chnM, chnPb, chnMb])
          tubeRuns(ch, TUBE_RP, false);
        for (const s2 of [0, 1])
          for (let i = 0; i + 1 < topCh[s2].length; i++)
            seg(i % 2 ? botCh[s2][i] : topCh[s2][i],
                i % 2 ? topCh[s2][i + 1] : botCh[s2][i + 1], TUBE_R * 0.85);
        // the FIRST boom bay was unbraced (user): its diagonal runs
        // from the pax pillar hoop's waist node down to station 1's
        // chine — completing THE RULE: every non-door body panel gets
        // ONE diagonal, doors get the X
        const b0 = bandEnds[0];
        if (b0 && b0.mid) {
          if (b0.mid.wP && botCh[0].length)
            seg(inCtr(b0.mid.wP, b0.cy), botCh[0][0], TUBE_R * 0.85);
          if (b0.mid.wM && botCh[1].length)
            seg(inCtr(b0.mid.wM, b0.cy), botCh[1][0], TUBE_R * 0.85);
        }
      }
    // CLOTH INTERIOR (user v2): a PROPER EXTRUSION — the liner idiom
    // (inner copy + rim walls at every opening) instead of the floating
    // inset duplicate whose edge gap showed. Tube sections: the whole
    // skin, doors included, glass excluded. Wood sections get the same
    // cloth, but only where the plywood does not already line the wall
    // (above the sheets: upper cabin walls, roof, boom top).
    (() => {
      const covered = new Set([...selPan, ...selPil, ...selDoor]);
      const selC = [];
      F.forEach((f, i) => {
        if (f.v.length !== 4 || f.m === 'joint' || f.capFace) return;
        if (GLM.has(f.m)) return;
        const [cy, cz] = cenOf(f);
        const c = consAt(cy, cz);
        if (c === 'tube' || (c === 'wood' && !covered.has(i)))
          selC.push(i);
      });
      liner(selC, (I.skinT > 0 ? I.skinT : 0.006), () => 'cloth');
    })();
    }
  })();

  // (the original cageResolve-based welded truss is RETIRED — the tube
  // construction is now realized from the plywood skeleton above: same
  // key nodes, member() dispatch, pillar hoops, boom rings + bent
  // longerons. One structure, techniques per section.)

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
    const link = new Map();                      // vert -> neighbours
    if (m.wsBase && m.wsBase.length) {
      // the cut recorded the base line before separating the glass
      for (const [a, b] of m.wsBase) {
        if (!link.has(a)) link.set(a, []);
        if (!link.has(b)) link.set(b, []);
        link.get(a).push(b); link.get(b).push(a);
      }
    } else if (m.dashRim && m.dashRim.length) {
      // open cockpit (G16): no windshield to trace — the dash references
      // the RECORDED seam (user rule: the bottom-of-waist reference
      // moves the dash down with it). The emitter records the A-pillar
      // stubs + the slope's front arc as dashRim and cageSubdivide
      // propagates it — generic boundary tracing is poisoned here (the
      // door hole merges with the cockpit rim once the roof is gone,
      // and interior sheets carry boundaries of their own).
      for (const [a, b] of m.dashRim) {
        if (!link.has(a)) link.set(a, []);
        if (!link.has(b)) link.set(b, []);
        link.get(a).push(b); link.get(b).push(a);
      }
    } else {
      const owners = new Map();                  // edgeKey -> Set(materials)
      for (const f of F) {
        if (f.v.length !== 4) continue;
        if (f.m !== 'windshield' && f.m !== 'waistband') continue;
        for (let e = 0; e < 4; e++) {
          const k = cageEdgeKey(f.v[e], f.v[(e + 1) % 4]);
          if (!owners.has(k)) owners.set(k, new Set());
          owners.get(k).add(f.m);
        }
      }
      for (const [k, mats] of owners) {
        if (!(mats.has('windshield') && mats.has('waistband'))) continue;
        const [a, b] = k.split('_').map(Number);
        if (!link.has(a)) link.set(a, []);
        if (!link.has(b)) link.set(b, []);
        link.get(a).push(b); link.get(b).push(a);
      }
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
    // PERFECT FIT at the glass (user ruling): the dash top edge stays
    // VERBATIM on the traced windshield base line — the old global tuck
    // opened a gap there. The tuck is PROGRESSIVE instead: zero at the
    // base row, full on the flattened outline and everything behind and
    // below it, so the body still clears the skin at the fold and under
    // the waist while the glareshield seals against the glass exactly.
    const TUCK = 0.008;
    const baseT = base.map(p => [
      p[0] - Math.sign(p[0]) * Math.min(Math.abs(p[0]), TUCK), p[1], p[2]]);
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
    const bLT = baseT[0], bRT = baseT[NL - 1];
    const O = [];
    for (let j = 0; j < NS; j++)
      O.push([bLT[0], yB + (bL[1] - yB) * j / NS, zP]);
    for (let i = 0; i < NL; i++) O.push([baseT[i][0], baseT[i][1], zP]);
    for (let j = NS - 1; j >= 0; j--)
      O.push([bRT[0], yB + (bR[1] - yB) * j / NS, zP]);
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
    // CLOSED SOLID as CONSISTENT GRIDS (user diagnosis: the old side
    // topology anchored every side column to ONE repeated base vertex —
    // a triangle fan — and filled the side panel by laddering a 4-point
    // chain against a 2-point edge, whose middle quad twisted across the
    // panel. CC redistributed those uneven control points differently at
    // every level, so the corner crawled until faces crossed. Now every
    // column gets a REAL anchor: arc columns anchor to the base line,
    // side columns anchor to the FORWARD EDGE sampled at the SAME
    // heights as the outline side chain — every strip quad is a clean
    // rectangle, the front return is a grid matched to that sampling,
    // and no fans or lids exist at all.)
    const vid = new Map();
    const pid = p => {
      const k = p[0].toFixed(9) + ',' + p[1].toFixed(9) + ',' + p[2].toFixed(9);
      if (!vid.has(k)) vid.set(k, V.push([p[0], p[1], p[2]]) - 1);
      return vid.get(k);
    };
    // the side anchor chain lerps x exactly like the return grid rows do
    // (identical formula = float-identical seam points)
    const zPillA = (bL[2] + bR[2]) / 2 + 0.15;
    const anchor = [];
    for (let j = 0; j < NS; j++)
      anchor.push([bLT[0] + (bL[0] - bLT[0]) * j / NS,
                   yB + (bL[1] - yB) * j / NS,
                   zPillA + (bL[2] - zPillA) * j / NS]);
    for (let i = 0; i < NL; i++) anchor.push(base[i]);
    for (let j = NS - 1; j >= 0; j--)
      anchor.push([bRT[0] + (bR[0] - bRT[0]) * j / NS,
                   yB + (bR[1] - yB) * j / NS,
                   zPillA + (bR[2] - zPillA) * j / NS]);
    const aid = anchor.map(pid);
    const oid = O.map(pid), o1id = O1.map(pid), o2id = O2.map(pid);
    // the back-bottom edge is FLAT (user ruling): one straight
    // transverse line at the window-pillar station — the hidden return
    // face morphs from the curved glass base down to it (worst case,
    // that back face can be deleted entirely, as IRL)
    // pulled toward the nose past the window pillar (user spec: the
    // back face must cross the pillar so no gap shows beside it)
    const zPill = (bL[2] + bR[2]) / 2 + 0.15;
    const R5 = base.map((p, i) => pid([baseT[i][0], yB, zPill]));
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
    strip(aid, oid);           // flat side panels + glareshield, one strip
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
    // bottom: ladder between the aft chain (outer corner -> roll corner ->
    // lip corner -> chord -> mirrored) and the under-base line
    ladder([oid[0], o1id[0], o2id[0], o2id[NX - 1], o1id[NX - 1],
            oid[NX - 1]], R5);
    // THE FRONT RETURN IS GONE (user ruling, option reserved at
    // e933ae5): the morph face joining the straight back-bottom line
    // to the curved base arc does not exist on a real dashboard and no
    // longer exists here — the dash is OPEN at the nose side, as IRL.
    // The new boundary chains (the base line and the back-bottom line)
    // both carry MAX crease, so the open edges hold their polylines
    // through CC; materials render DoubleSide, so the open back reads
    // fine from every reasonable viewpoint (and the firewall hides it).
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
    // EXPLICIT CREASE LOOPS ONLY (user ruling after the lip-height
    // threshold find: the dihedral auto-crease flipped edges as the lip
    // size crossed ~0.025 and the crease graph changed — dynamic
    // affectation is out). Exactly THREE continuous paths carry crease:
    // the outer lip (outline), the inset lip (roll inner edge) and the
    // inner lip (face edge). Nothing else — every crease vertex holds
    // exactly 2 sharp edges, no crossings can exist, and corners turn as
    // smooth crease curves. Deterministic at every lip size.
    const E2 = new Map();
    const tagPath = (ids2, w) => {
      for (let i = 0; i + 1 < ids2.length; i++) {
        const a = used.get(ids2[i]), b = used.get(ids2[i + 1]);
        if (a != null && b != null && a !== b)
          E2.set(cageEdgeKey(a, b), w);
      }
    };
    // BACK / STRUCTURAL loops at MAX crease (user diagnosis: position-
    // pinning cannot survive CC — the uncreased base row was pulled off
    // the glass line, the gap. Weight 3 keeps a chain exactly on its
    // polyline at every displayed level): the base line, the under-base
    // return, the outer outline. The lip pair keeps the adjustable
    // dashCrease rounding.
    tagPath(aid.slice(NS, NS + NL), 3);   // the base line (arc anchors)
    tagPath(R5, 3); tagPath(oid, 3);
    tagPath(o1id, dc); tagPath(o2id, dc);
    // THE BOTTOM IS A BOX (user ruling: no rounding — the dash
    // protrudes STRAIGHT toward the nose): vertical front corners
    // (the side anchor chains) and the bottom-side edges at max crease.
    // Their meeting vertices hold >= 3 sharp edges = true box corners
    // (pins on straight lines are exact, per the crease law).
    tagPath(aid.slice(0, NS + 1), 3);              // left front corner
    const rc = [];
    for (let j = NX - 1; j >= NS + NL - 1; j--) rc.push(aid[j]);
    tagPath(rc, 3);                                // right front corner
    tagPath([oid[0], R5[0]], 3);                   // bottom-side edges
    tagPath([oid[NX - 1], R5[NL - 1]], 3);
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
  // the fire plate is a CLOSED SOLID now (user): front sheet at the
  // group's offset, back sheet 5 mm inboard (the boom-web thickness),
  // rim wall on the cap-grid boundary. The NOSE plate sits slightly
  // PROUD of the aperture plane (the old inboard setback overlapped
  // the liner rim walls once the cap skin was dropped); the pusher
  // tail disc keeps its skin, so its plate stays tucked behind it.
  if (I.fire) (() => {
    const nose = [], rear = [];
    F.forEach((f, i) => {
      if (!f.capFace || f.v.length !== 4) return;
      let cz = 0;
      for (const vi of f.v) cz += V[vi][2] / f.v.length;
      (cz >= zPax0 ? nose : rear).push(i);
    });
    const FTH = 0.005;
    const plate = (fis, d0) => {
      if (!fis.length) return;
      const vN = new Map();
      for (const fi of fis) {
        const p = F[fi].v.map(i2 => V[i2]);
        const u = [p[2][0]-p[0][0], p[2][1]-p[0][1], p[2][2]-p[0][2]];
        const w = [p[3][0]-p[1][0], p[3][1]-p[1][1], p[3][2]-p[1][2]];
        const n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2],
                   u[0]*w[1]-u[1]*w[0]];
        for (const vi of F[fi].v) {
          const s = vN.get(vi) || [0, 0, 0];
          vN.set(vi, [s[0]+n[0], s[1]+n[1], s[2]+n[2]]);
        }
      }
      const pF = new Map(), pB = new Map();
      const of2 = (vi, d, mp) => {
        if (!mp.has(vi)) {
          const n = vN.get(vi);
          const l = Math.hypot(n[0], n[1], n[2]) || 1;
          mp.set(vi, V.push([V[vi][0]+n[0]/l*d, V[vi][1]+n[1]/l*d,
                             V[vi][2]+n[2]/l*d]) - 1);
        }
        return mp.get(vi);
      };
      const eCnt = new Map(), eDir = new Map();
      for (const fi of fis) {
        const f = F[fi];
        for (let e = 0; e < 4; e++) {
          const a = f.v[e], b = f.v[(e + 1) % 4];
          const k = cageEdgeKey(a, b);
          eCnt.set(k, (eCnt.get(k) || 0) + 1);
          if (!eDir.has(k)) eDir.set(k, [a, b]);
        }
      }
      for (const fi of fis) {
        add.push({ v: F[fi].v.map(vi => of2(vi, d0, pF)),
                   m: 'firewall' });
        add.push({ v: F[fi].v.slice().reverse()
                     .map(vi => of2(vi, d0 - FTH, pB)), m: 'firewall' });
      }
      for (const [k, c] of eCnt) {
        if (c !== 1) continue;
        const [a, b] = eDir.get(k);
        add.push({ v: [of2(b, d0, pF), of2(a, d0, pF),
                       of2(a, d0 - FTH, pB), of2(b, d0 - FTH, pB)],
                   m: 'firewall' });
      }
    };
    plate(nose, 0.008);
    plate(rear, -0.012);
  })();

  // THE ENGINE NOSE OPENS (user): the firewall closes the bay now, so
  // the aperture-cap skin faces at the NOSE are dropped — the opening
  // shows the firewall, as the real assembly would. Aero noses carry no
  // capFace marks (nothing to drop); the pusher tail disc (also
  // capFace-marked) is kept — only the front opens.
  let FK = F;
  if (I.fire) FK = F.filter(f => {
    if (!f.capFace) return true;
    let cz = 0;
    for (const vi of f.v) cz += V[vi][2] / f.v.length;
    return cz < zPax0;
  });
  m.F = FK.concat(add);
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
  const out = { V: NV, F: NF, E: NE };
  // recorded seam lines (open/bubble modes) survive subdivision: each
  // parent edge becomes its two children through the edge point
  for (const key of ['dashRim', 'seamS', 'seamA', 'dashRimA', 'seamSA'])
    if (m[key]) {
    out[key] = [];
    for (const [a, b] of m[key]) {
      const ep = epIdx.get(cageEdgeKey(a, b));
      if (ep == null) continue;
      out[key].push([a, ep], [ep, b]);
    }
  }
  return out;
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
  // glass sill: extend the pilot/pax glass DOWN the door, row-stepped;
  // 0 = template extent, ~0.9 = the whole door is window
  winSillPilot: 0, winSillPax: 0,
  // pillar crease defaults to MAX (user ruling): the pillar bands render
  // at their drawn width — width itself is adjusted via pillarW below,
  // never via the crease.
  // crFrame defaults 0 (G12.3 L3 fix): the wsAft/wsFront RING PAIR holds
  // the A-pillar fold (the template's own pillar mechanism) and the seal
  // tubes delineate the frame — a ring crease here CROSSES the sill/band
  // rails, corner-pins the fold vertices, and higher subsurf levels
  // resolve that as a pinch (HARD-WON #2: crease lines must not cross;
  // pins are invisible on straight lines, ruinous on bent ones).
  // crFrame 3 + crCeil 0 (user rulings after L3 review): fully-sharp
  // frame edges stay ON the cage polylines at every displayed level (no
  // sharp-then-smooth funnel), and the ceil rail crease is retired.
  crPillar: 3, crSill: 2, crBand: 1, crCeil: 0, crFrame: 3, crCap: 2,
  crFrontCap: 0.3, crNoseCap: 2,
  botRound: 0,
  noseCrown: 0, noseH: 1, noseDroop: 0, wsBaseLift: 0,
  cowlLoops: 0, cowlEase: 0, cowlBulge: 1.05, noseFinish: 0,
  aeroNose: 0, aeroWsLen: 0.9, aeroLen: 1.5, aeroDroop: 0.30,
  aeroTipW: 0.10, aeroTipH: 0.12,
  rearAperture: 0,
  boomMidOn: 0, boomMidT: 0.35, boomMidPinch: 0.6,
  // bubble crest (G15, superseded by canopy below — kept as a dev param):
  // a smooth longitudinal bump of the roof/ceil over the pilot+pax cabin.
  // h 0 = off (the fit identity path).
  crestH: 0, crestAt: 0.55, crestLoops: 1,
  // canopy (G16): 0 closed | 1 convertible (open pilot-bay top, windshield
  // stays — the baby-jodel design) | 2 open (windshield removed too) |
  // 3 bubble (the open base with the wsAft pillar ring DELETED + the
  // cageCanopy component on the recorded seam — G16c). The cut line is
  // the waistband TOP (the bottom option was DROPPED, user 2026-08-18:
  // "it causes only issues").
  canopy: 0, bubH: 0.85, bubAt: 0.45,
  // bubble width: 1 = flush arcs; >1 bulges the crown shoulders past
  // the flanks (blown canopy) — the feet stay on the sills
  bubW: 1.0,
  // CANOPY CONTROL LOOPS (G18 S1, user ask): 1 = the single crown arc
  // (bubH/bubAt/bubW, the v4 path exactly); 2-3 add control arcs with
  // their own station/height/width — the column profile becomes a
  // Bezier through all of them (loops are CONTROLS, not interpolated —
  // the control-cage idiom).
  canLoops: 1, bubH2: 0.7, bubAt2: 0.25, bubW2: 1.0,
  bubH3: 0.6, bubAt3: 0.7, bubW3: 1.0,
  // ARCEAU FIT (user, replacing the S4 collapse): the hoop's upper
  // profile projects onto the canopy's own section and tucks one
  // glass-gap inside — it hugs the bubble whatever the loops do
  arcFit: 1,
  // AERO NOSE TO A POINT (user: the aero finish kept a flat
  // engine-sized face): collapses the aero ring onto the deck point.
  // 0 = template ring, 0.98 max keeps the cap grid non-degenerate —
  // visually a point, CC rounds it. Aft twin for the pod's tail cone.
  noseTip: 0, aftNoseTip: -1,
  // DECK-EDGE CREASE split from the cabin sill (user: the deck would
  // not smooth out — the cowl deck edge carried the global crSill):
  // -1 = follow crSill (fit identity); explicit 0..3 creases the nose
  // deck edge alone, aft twin for the pod's aft deck.
  crSillNose: -1, aftCrSillNose: -1,
  // RING WIDTHS (user: halfW scales everything proportionally — the
  // belly could not fatten locally): per-ring flank width offsets in
  // metres (waist + keel; the roof width stays with roofHalfW). Cabin
  // pillar = the arceau on the pod (shared, no aft twin); window /
  // screen / cowl loops get aft twins for the pod's mirrored stations.
  ringCabW: 0, ringWinW: 0, ringScrW: 0, ringCowl1W: 0, ringCowl2W: 0,
  aftRingWinW: -1, aftRingScrW: -1, aftRingCowl1W: -1,
  aftRingCowl2W: -1,
  // MIRRORED POD (G18 S2, user design): the aft body = the front half
  // [cabin|slope|cowl|nose] REFLECTED about the cabin-pillar mid-plane
  // (the arceau), boom extruded from the mirrored engine aperture. The
  // aft deck falls away exactly like the nose rises — the base a true
  // stick-out bubble needs, which no cutaway can give. 0 = fit path.
  mirror: 0,
  // AFT POD OVERRIDES (S2.5): the mirrored half re-emits the front
  // block with these substituted for their front params — mirroring is
  // the INITIAL geometry only (user ruling). -1 (below each param's
  // floor) = follow the front value. Only read with mirror 1.
  aftPilotLen: -1, aftWsRun: -1, aftNoseLen: -1, aftNoseW: -1,
  aftNoseH: -1, aftDroop: -1, aftNoseCrown: -1, aftCowlEase: -1,
  aftCowlBulge: -1,
  // ...completed to the FULL front set (user: "all controls just
  // needed to be duplicated"): the aft deck + aft cabin mirror the
  // nose + cabin sections control for control
  aftWsBaseLift: -1, aftWsTopOff: -1, aftWsBaseBow: -1,
  aftWsCeilBow: -1, aftCowlLoops: -1,
  // RING EDITOR (G18, user design): the aeroplane's shape = RINGS
  // (cross-sections) + LONGERONS (the rails through them). These move
  // a main ring's TOP (roof+ceil) or BOTTOM (keel+floor) points
  // bodily, in metres — direct cage manipulation, 0 = fit identity.
  // The aft/tail rings already carry absolute height params (aftRoofY/
  // aftKeelY/tailRoofY/tailKeelY); the waist and band lines are
  // longerons and never move with a ring.
  ringNoseBot: 0, ringScrBot: 0, ringWinTop: 0, ringWinBot: 0,
  ringCabTop: 0, ringCabBot: 0,
  // nose-ring TOP = the deck at the nose/aperture pair (twin+ring):
  // lifts waist + crown there only — orthogonal to droop (whole end)
  // and to ringNoseBot (keel/floor). On the pod the AFT twin raises
  // the "passenger pillar" so the deck curve runs continuously to the
  // tail (user ask); the boom inherits the lifted aperture.
  ringNoseTop: 0, aftRingNoseTop: -1, aftRingNoseBot: -1,
  winFrameW: 0, winDepth: 0.015, winBlow: 0, crGlass: 3.0,
  rimW: 0.012, rimWin: 1, rimWs: 1, rimDoor: 1, rimSides: 8, rimArc: 3,
  doorOn: 1, doorPax: 0, doorDeep: 1, doorSill: 0.06, doorSillPax: 0.06,
  doorDepth: 0.008,
  // interior (G13): master + per-element flags — every element disjoint
  // and individually revertible
  intOn: 0, intBulk: 1, intFire: 1, intPillars: 1, shellT: 0.035,
  // SKIN THICKNESS (user, anti-clipping): the sheet linings' inward
  // depth — plywood/toele/cloth/composite shell — separated from
  // shellT (which keeps the pillars, posts and frames). 0 = the
  // per-construction defaults; raise it to pull every lining
  // conservatively deeper wherever panels graze the skin.
  skinT: 0,
  // construction idiom: 0 carbon (pillars+shell liner), 1 tube (welded
  // truss), 2 wood (plywood bathtub + pillar posts + floorboards)
  intCons: 0,
  intDash: 1, dashBack: 0.05, dashLip: 0.035, dashDepth: 0.35,
  dashCrease: 1.5,
  // G14: post-subsurf cutting of doors/windows into separate parts
  cutParts: 0, explodeD: 0,
};

// aft-param table: [aftKey, frontKey, sentinel-threshold] — used by
// cageSpec (substitution into the aft half's spec) and by the pages'
// FOREVER-SPLIT (user ruling): the moment the pod is on, aft sliders
// still below their threshold take a ONE-SHOT copy of the front's
// current value and are independent from then on.
const CAGE_AFT_SUB = [
  ['aftPilotLen', 'pilotLen', 0.1], ['aftWsRun', 'wsRun', 0.1],
  ['aftNoseLen', 'noseLen', 0.1], ['aftNoseW', 'noseW', 0.2],
  ['aftNoseH', 'noseH', 0.02], ['aftDroop', 'noseDroop', -0.5],
  ['aftNoseCrown', 'noseCrown', -0.01],
  ['aftCowlEase', 'cowlEase', -0.01],
  ['aftCowlBulge', 'cowlBulge', 0.2],
  ['aftWsBaseLift', 'wsBaseLift', -0.01],
  ['aftWsTopOff', 'wsTopOff', -0.01],
  ['aftWsBaseBow', 'wsBaseBow', -0.01],
  ['aftWsCeilBow', 'wsCeilBow', -0.01],
  ['aftCowlLoops', 'cowlLoops', -0.5],
  ['aftRingNoseTop', 'ringNoseTop', -0.5],
  ['aftRingNoseBot', 'ringNoseBot', -0.5],
  ['aftNoseTip', 'noseTip', -0.01],
  ['aftCrSillNose', 'crSillNose', -0.5],
  ['aftRingWinW', 'ringWinW', -0.5],
  ['aftRingScrW', 'ringScrW', -0.5],
  ['aftRingCowl1W', 'ringCowl1W', -0.5],
  ['aftRingCowl2W', 'ringCowl2W', -0.5],
];

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
              ext: Math.max(0, Math.round(P.skyExt != null ? P.skyExt : 5)),
              sillPilot: Math.max(0, P.winSillPilot || 0),
              sillPax: Math.max(0, P.winSillPax || 0) };
  S.crease = { pillar: P.crPillar, sill: P.crSill, band: P.crBand,
               ceil: P.crCeil, frame: P.crFrame, cap: P.crCap,
               frontCap: P.crFrontCap, noseCap: P.crNoseCap,
               sillNose: P.crSillNose };
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
    crest: P.crestH > 0 ? { h: P.crestH, at: P.crestAt,
                            loops: Math.max(0, Math.round(P.crestLoops || 0)) }
                        : 0,
    canopy: P.canopy ? {
      mode: ['closed', 'conv', 'open', 'bubble'][Math.round(P.canopy)] ||
            'closed',
      ref: 'band',
      h: P.bubH, at: P.bubAt, w: P.bubW,
      fit: P.arcFit == null || P.arcFit ? 1 : 0,
      // S1: 2-3 control loops, sorted front->aft (at counts from the
      // aft side, so descending at = ascending station)
      loops: Math.round(P.canLoops || 1) >= 2 ? [
        { at: P.bubAt, h: P.bubH, w: P.bubW },
        { at: P.bubAt2, h: P.bubH2, w: P.bubW2 },
      ].concat(Math.round(P.canLoops) >= 3
        ? [{ at: P.bubAt3, h: P.bubH3, w: P.bubW3 }] : [])
        .sort((a, b) => b.at - a.at) : 0,
    } : 0,
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
  // RING EDITOR (user design): direct manipulation of the main rings'
  // top/bottom points — the plane's shape is rings + longerons, so
  // the cross-sections get hand controls. RIGID shifts: top moves
  // roof+ceil, bottom moves keel+floor (+ their centre columns); the
  // waist/band lines are longerons and stay put. All 0 = fit
  // identity. The aft/tail rings are already absolute params
  // (aftRoofY/aftKeelY/tailRoofY/tailKeelY) — this covers the front
  // rings: nose (ring+twin pair), screen base (wsFront+wsAft pair),
  // window ring, cabin pillar (pair, via ringOff -> cageResolve).
  {
    const dWT = P.ringWinTop || 0, dWB = P.ringWinBot || 0;
    if (dWT) { S.ring.roofY = P.roofY + dWT; S.ring.ceilY += dWT; }
    if (dWB) { S.ring.keelY += dWB; S.ring.floorY += dWB; }
    const dCT = P.ringCabTop || 0, dCB = P.ringCabBot || 0;
    const dCW = P.ringCabW || 0, dWW = P.ringWinW || 0;
    const dSW = P.ringScrW || 0;
    const cw1 = P.ringCowl1W || 0, cw2 = P.ringCowl2W || 0;
    if (dCT || dCB || dCW || dWW || dSW || cw1 || cw2)
      S.ringOff = { cabT: dCT, cabB: dCB, cabW: dCW, winW: dWW,
                    scrW: dSW, cowl: [cw1, cw2] };
    const dS2 = P.ringScrBot || 0;
    if (dS2) {
      F.keelY += dS2; F.floorY += dS2;
      A.keel.y += dS2; A.floorY += dS2;
    }
    if (dSW) { F.waist.x += dSW; A.waist.x += dSW; }
    const dN = P.ringNoseBot || 0;
    if (dN) for (const n of [S.nose.ring, S.nose.twin])
      for (const k of ['keel', 'floor']) {
        n[k].y += dN;
        if (n[k].yC != null) n[k].yC += dN;
      }
    // nose-ring TOP: the deck y lives in cageResolve's noseLv (built
    // from waistY/crown/droop), so the lift rides the spec as
    // S.nose.lift and noseLv adds it to the deck levels only
    S.nose.lift = P.ringNoseTop || 0;
  }
  // AERO NOSE TO A TRUE POINT (user: it kept a flat engine-sized
  // face). noseTip collapses the aero-finish ring toward the deck
  // point: x scales out, keel/floor converge on the deck line, the
  // ring's crown fades (a crest spike otherwise). The twin band now
  // STAYS in aero finish (the user's pillar): cowl -> band -> point.
  if (P.noseFinish && P.noseTip > 0) {
    const t = Math.min(0.98, Math.max(0, P.noseTip));
    const n = S.nose.ring;
    const yD = P.waistY - (S.nose.droop || 0) + (S.nose.lift || 0);
    n.crownF = 1 - t;
    n.deck.x *= 1 - t;
    for (const k of ['floor', 'keel']) {
      n[k].x *= 1 - t;
      n[k].y += (yD - n[k].y) * t;
      if (n[k].yC != null) n[k].yC += (yD - n[k].yC) * t;
    }
  }
  S.win = { frameW: P.winFrameW, depth: P.winDepth, blow: P.winBlow,
            crGlass: P.crGlass, door: P.doorOn ? 1 : 0,
            doorDepth: P.doorDepth, rim: P.rimW,
            rimSides: P.rimSides || 8, rimArc: P.rimArc || 1,
            rimWin: P.rimWin ? 1 : 0, rimWs: P.rimWs ? 1 : 0,
            rimDoor: P.rimDoor ? 1 : 0,
            doorSill: Math.max(0, P.doorSill || 0),
            // pax doors carry their own sill; spec-level W.sills =
            // {pilot: v, pax0: v, ...} overrides any door individually
            doorSillPax: Math.max(0,
              (P.doorSillPax != null ? P.doorSillPax : P.doorSill) || 0) };
  S.config.doors = { pilot: P.doorOn ? 1 : 0, pax: P.doorPax ? 1 : 0,
                     deep: P.doorDeep ? 1 : 0 };
  S.cut = { on: P.cutParts ? 1 : 0, doors: 1, wins: 1,
            explode: Math.max(0, P.explodeD || 0) };
  // MIRRORED POD (G18 S2): v1 constraints — no pax bays, canopy closed
  // (S3 brings the bubble to the pod), doors off (the canopy IS the
  // door on a pod), interior off (S5 adapts it), cowl nose only. Each
  // constraint lifts with its own chantier.
  S.config.mirror = P.mirror ? 1 : 0;
  if (S.config.mirror) {
    S.pax.count = 0;
    // S3: the pod exists FOR the bubble — it stays; conv/open remain
    // closed on the pod until they earn their own chantier
    if (!(S.config.canopy && S.config.canopy.mode === 'bubble'))
      S.config.canopy = 0;
    S.config.noseMode = 'cowl';
    S.config.doors = { pilot: 0, pax: 0, deep: 0 };
    // S2.5 — PER-HALF CONTROLS: any aft override below its floor means
    // "follow the front"; if any is set, derive a FULL second spec with
    // the substitutions and buildCage2 emits the aft half from it (the
    // second-emission plan — never vertex surgery on the reflection).
    // The cabin section params stay SHARED: one cockpit, so the arceau
    // bridges two identical rings whatever the halves do. (The pages
    // materialize sentinels on mirror-on — the FOREVER-SPLIT — so this
    // path normally sees explicit values; sentinels remain for
    // headless callers.)
    const P2 = { ...P };
    let nSub = 0;
    for (const [ak, fk, thr] of CAGE_AFT_SUB)
      if (P[ak] != null && P[ak] >= thr) { P2[fk] = P[ak]; nSub++; }
    // the aft band IS the PASSENGER PILLAR (user: it responded to the
    // nose pillar's pfW — wrong station): its width follows
    // paxPillarW, "where the tightening for rod booms happens"; the
    // front band keeps pfW. Warrants the second emission on its own.
    if (P.pillarW > 0 && P.paxPillarW > 0) {
      P2.pfW = P.paxPillarW / P.pillarW;
      if (Math.abs(P2.pfW - P.pfW) > 1e-9) nSub++;
    }
    if (nSub) {
      P2.mirror = 0;                       // no recursion below this
      const SA = cageSpec(P2);
      SA.pax.count = 0;
      if (!(SA.config.canopy && SA.config.canopy.mode === 'bubble'))
        SA.config.canopy = 0;
      SA.config.noseMode = 'cowl';
      SA.config.doors = { pilot: 0, pax: 0, deep: 0 };
      SA.interior.on = 0;
      SA.config.mirror = 1;                // the front-half table
      SA.config.mirrorHalfOnly = 1;        // emit the half, no mirror pass
      S.config.mirrorAftSpec = SA;
    }
  }
  const consG = ['carbon', 'tube', 'wood', 'metal'][
    Math.max(0, Math.min(3, Math.round(P.intCons || 0)))];
  const skinTv = Math.max(0, P.skinT || 0);
  S.interior = { on: P.intOn ? 1 : 0, bulk: P.intBulk ? 1 : 0,
                 fire: P.intFire ? 1 : 0, dash: P.intDash ? 1 : 0,
                 pillars: P.intPillars ? 1 : 0,
                 skinT: skinTv,
                 cons: consG,
                 // the SECTION MODEL: one technique per {boom|pax|
                 // pilot|nose} x {Below|Above band-top} — all equal to
                 // the global today (3 UI options), but the builders
                 // already consult this map, so a mixed airframe (tube
                 // canopy over a wooden boom, like the jodel) is one
                 // spec edit away
                 consMap: { boomBelow: consG, boomAbove: consG,
                            paxBelow: consG, paxAbove: consG,
                            pilotBelow: consG, pilotAbove: consG,
                            noseBelow: consG, noseAbove: consG },
                 shellT: Math.max(0.005, P.shellT || 0.035),
                 dashBack: P.dashBack,
                 dashLip: P.dashLip != null ? P.dashLip : P.dashInset,
                 dashDepth: P.dashDepth, dashCrease: P.dashCrease };
  // (S5: the pod interior is LIVE — the pairs loop sweeps belly chines
  // per bay in pod bubble, wsBase filters to the front screen, and the
  // boom machinery idles without its stations. Known v1 gaps in
  // HANDOVER: no boom-cone structure, no aft-belly tube chine.)
  return S;
}

// ---------------------------------------------------------------------------
// THE CANOPY (G16c v3, user reviews): a POST-SUBDIVISION COMPONENT — the
// dash idiom. The base rows sample the DISPLAYED seam (dashRim / seamS /
// seamA, recorded at emission and propagated through cageSubdivide), so
// the canopy follows the smooth, rounded curve the seam actually takes
// after subdivision — fusing at cage level froze the seam's ANGULAR cage
// shape instead (v2b mistake, user catch). The component is a coarse
// 3-row cage (front seam row, crown row, arch row) subdivided TWICE on
// its own with creased boundary chains: dense boundary points refine by
// midpoints and stay on the seam path; the interior smooths into the
// corner-wrapping grid of the user's topology sketch. `bubW` bulges the
// crown row's shoulders past the flanks (blown canopy) — the feet stay
// on the sills.
function cageCanopy(m, S) {
  const CN = S.config && S.config.canopy;
  if (!CN || CN.mode !== 'bubble') return m;
  // pod (mirror) bubble: the rear boundary is the MIRRORED dash arc
  // (dashRimA) — the arch never exists on a pod
  const POD = !!(S.config && S.config.mirror);
  if (!m.dashRim || !m.seamS
      || (POD ? !(m.dashRimA && m.seamSA) : !m.seamA)) return m;
  const { V, F } = m;
  // WAIST REINFORCEMENT AT CONSTANT SECTION (user: the band strip on
  // the doors pinched and flared in bubble mode). The strip's TOP is
  // the displayed seam — the canopy contract — but its BOTTOM stayed
  // on the template waist line, so wherever the released seam departs
  // from the template band line the width wandered (measured 0.047 to
  // 0.083 m across the pilot door vs 0.063 nominal). Every waistband
  // column hanging from an OPEN top edge (the cut rim — pax bays keep
  // faces above and are untouched) is re-offset from its own top
  // vert: bottom = top + bandH along the column, interior rows at
  // their original fractions. Cut door parts carry their own columns,
  // so the door strip and the fuselage rim stay coincident, exploded
  // or not.
  (() => {
    const W = S.bandY - S.waistY;
    if (!(W > 1e-6)) return;
    const ek = (a, b) => a < b ? a + '_' + b : b + '_' + a;
    const own = new Map();
    for (const f of F) {
      const n = f.v.length;
      for (let e = 0; e < n; e++) {
        const k = ek(f.v[e], f.v[(e + 1) % n]);
        own.set(k, (own.get(k) || 0) + 1);
      }
    }
    // eligible tops lie ON the recorded SILL seam (seamS) — cut
    // windows also leave once-owned band-top edges (their glass part
    // duplicates the verts), and those bands keep their template
    // width; the nose-deck band under the dash arc lies flat and has
    // no meaningful "down". Door-part duplicates match the seam by
    // their AS-BUILT position (minus the part's explode offset).
    const seamP = [];
    for (const rec of (m.seamSA ? [m.seamS, m.seamSA] : [m.seamS]))
      for (const [a, b] of rec) { seamP.push(V[a]); seamP.push(V[b]); }
    const onSeam = p => {
      for (const q of seamP) {
        const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
                + (q[2] - p[2]) ** 2;
        if (d < 1e-10) return true;
      }
      return false;
    };
    const down = new Map();
    const tops = new Set();
    const below = new Set();
    const voff = new Map();
    for (const f of F)
      if (f.m !== 'waistband') for (const vi of f.v) below.add(vi);
    for (const f of F) {
      if (f.m !== 'waistband' || f.v.length !== 4) continue;
      if (f.cutPart && f.cutOff)
        for (const vi of f.v) voff.set(vi, f.cutOff);
      let cy = 0;
      for (const vi of f.v) cy += V[vi][1] / 4;
      // the strip is much longer than tall: per face, the SHORTER
      // opposite-edge pair is the column pair — robust where the band
      // leans up the A-pillar foot and |dy| alone misclassifies
      const eLen = e => {
        const a = V[f.v[e]], b = V[f.v[(e + 1) % 4]];
        return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      };
      const m02 = (eLen(0) + eLen(2)) / 2, m13 = (eLen(1) + eLen(3)) / 2;
      const colPair = m02 < m13 / 1.3 ? 0 : m13 < m02 / 1.3 ? 1 : -1;
      for (let e = 0; e < 4; e++) {
        const a = f.v[e], b = f.v[(e + 1) % 4];
        if (colPair === e % 2) {
          if (V[a][1] > V[b][1]) down.set(a, b); else down.set(b, a);
        } else if (colPair >= 0 && own.get(ek(a, b)) === 1
                   && (V[a][1] + V[b][1]) / 2 >= cy) {
          tops.add(a); tops.add(b);
        }
      }
    }
    for (const t of [...tops]) {
      const o = voff.get(t);
      const p = o ? [V[t][0] - o[0], V[t][1] - o[1], V[t][2] - o[2]]
                  : V[t];
      if (!onSeam(p)) tops.delete(t);
    }
    const done = new Set();
    for (const t of tops) {
      if (done.has(t)) continue;
      const col = [t];
      for (let v = t; down.has(v) && col.length < 12; v = down.get(v))
        col.push(down.get(v));
      // a valid column reaches the strip's bottom row (shared with the
      // body flank); a chain broken by slanted classification would
      // otherwise be stretched to the full width — skip it instead
      if (col.length < 2 || !below.has(col[col.length - 1])) continue;
      col.forEach(v => done.add(v));
      const cum = [0];
      for (let i = 1; i < col.length; i++)
        cum.push(cum[i - 1] + Math.hypot(
          V[col[i]][0] - V[col[i - 1]][0],
          V[col[i]][1] - V[col[i - 1]][1],
          V[col[i]][2] - V[col[i - 1]][2]));
      const L = cum[col.length - 1];
      // a column much longer than the band is a walk that escaped the
      // strip — leave it (the seam test already rejects hoop
      // pass-throughs; the door's front-corner FLARE at ~2.3 W is a
      // real strip column and must equalize)
      if (L < 1e-6 || L > 2.6 * W) continue;
      const p0 = V[col[0]];
      const u = [(V[col[col.length - 1]][0] - p0[0]) / L,
                 (V[col[col.length - 1]][1] - p0[1]) / L,
                 (V[col[col.length - 1]][2] - p0[2]) / L];
      for (let i = 1; i < col.length; i++) {
        const s = cum[i] / L * W;
        V[col[i]] = [p0[0] + u[0] * s, p0[1] + u[1] * s,
                     p0[2] + u[2] * s];
      }
    }
  })();
  const chainOf = pairs => {
    const link = new Map();
    for (const [a, b] of pairs) {
      if (!link.has(a)) link.set(a, []);
      if (!link.has(b)) link.set(b, []);
      link.get(a).push(b); link.get(b).push(a);
    }
    let start = -1;
    for (const [v, ns] of link) if (ns.length === 1) { start = v; break; }
    if (start < 0) return [];
    const out = [start];
    const seen = new Set([start]);
    for (let v = start; ;) {
      const nx = (link.get(v) || []).find(n => !seen.has(n));
      if (nx == null) break;
      out.push(nx); seen.add(nx); v = nx;
    }
    return out;
  };
  const split = rec => {
    const sb = [], pt = [];
    for (const [a, b] of rec)
      ((V[a][0] + V[b][0]) / 2 >= 0 ? sb : pt).push([a, b]);
    return [sb, pt];
  };
  const [sSb, sPt] = split(m.seamS);
  const front = chainOf(m.dashRim);
  const arch = POD ? chainOf(m.dashRimA) : chainOf(m.seamA);
  let railS = chainOf(sSb), railP = chainOf(sPt);
  const last = c => c[c.length - 1];
  // rails run front -> aft; transverse rows run port(-x) -> starboard
  const fwdOrder = c => {
    if (c.length > 1 && V[c[0]][2] < V[last(c)][2]) c.reverse();
    return c;
  };
  fwdOrder(railS); fwdOrder(railP);
  if (POD) {
    // the aft sills continue the front ones across the arceau — chain
    // each half separately (the arceau gap breaks vertex adjacency),
    // orient both front->aft and concatenate; the row sampler bridges
    // the gap straight, which the band-top line there IS
    const [aSb, aPt] = split(m.seamSA);
    railS = railS.concat(fwdOrder(chainOf(aSb)));
    railP = railP.concat(fwdOrder(chainOf(aPt)));
  }
  if (front.length < 3 || arch.length < 3
      || railS.length < 2 || railP.length < 2) return m;
  const pts = c => c.map(i => V[i].slice());
  const path = c => {
    const L = [0];
    for (let i = 1; i < c.length; i++)
      L.push(L[i - 1] + Math.hypot(c[i][0] - c[i - 1][0],
        c[i][1] - c[i - 1][1], c[i][2] - c[i - 1][2]));
    return { c, L, T: L[L.length - 1] || 1 };
  };
  const at2 = (p, t) => {
    const d = p.T * t;
    let i = 1;
    while (i < p.L.length - 1 && p.L[i] < d) i++;
    const u = (d - p.L[i - 1]) / Math.max(1e-12, p.L[i] - p.L[i - 1]);
    return [0, 1, 2].map(j =>
      p.c[i - 1][j] + (p.c[i][j] - p.c[i - 1][j]) * u);
  };
  const resample = (P2, n) => {
    const p = path(P2), out = [];
    for (let k = 0; k <= n; k++) out.push(at2(p, k / n));
    return out;
  };
  // v4 — THE WINDSHIELD-FIT STRATEGY, GLOBAL (user): one row per rail
  // point, boundaries VERBATIM (front row = the seam chain itself, feet
  // = the rail points themselves) or ON-PATH (the arch row resampled
  // along its own polyline — same curve, corners verbatim), and creases
  // ONLY on the boundary loop — interior edges never (creased coarse
  // columns were the corner-drift source: the crease vertex rule pulls
  // a corner toward its far sharp neighbour; dense verbatim boundaries
  // make every sharp neighbour close). The dome is a quadratic Bezier
  // per column through the crown CONTROL arc — the same one-bump
  // character CC gave the approved coarse cage, no easing curves.
  let fr = pts(front), ar = pts(arch);
  if (fr[0][0] > last(fr)[0]) fr.reverse();
  if (ar[0][0] > last(ar)[0]) ar.reverse();
  let rpP = pts(railP), rpS = pts(railS);
  const NR = Math.min(rpP.length, rpS.length);   // rows: front..arch
  if (NR < 3) return m;
  const NVp = fr.length - 1;                     // row width from the seam
  ar = resample(ar, NVp);
  const pP = path(rpP), pS = path(rpS);
  const tOf = k => pP.L[Math.min(k, pP.L.length - 1)] / pP.T;
  // a crown CONTROL ARC at rail fraction t: feet ON the rails, height
  // h above the chord, shoulders bulged by w (the feet stay put)
  const mkArc = (tj, hj, wj) => {
    const A2 = at2(pP, tj), B2 = at2(pS, tj);
    const C2 = [(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2,
                (A2[2] + B2[2]) / 2];
    const arc = [];
    for (let i = 0; i <= NVp; i++) {
      const th = Math.PI * i / NVp;
      const f = 1 + (wj - 1) * Math.sin(th);
      arc.push([C2[0] + (A2[0] - C2[0]) * Math.cos(th) * f,
                C2[1] + (A2[1] - C2[1]) * Math.cos(th)
                      + hj * Math.sin(th),
                C2[2] + (A2[2] - C2[2]) * Math.cos(th)]);
    }
    return arc;
  };
  // S1 — CONTROL LOOPS (user ask): one loop = the v4 path exactly
  // (quadratic Bezier, apex reparam so the bump lands at bubAt); 2-3
  // loops = one control arc each at its own station/height/width and
  // the column profile is a Bezier through [front, arcs..., rear] on
  // the raw arc-length parameter — the fullness placement comes from
  // where the loops sit. Loops are CONTROLS, not interpolated points:
  // the control-cage idiom, same as the skin.
  const LOOPS = CN.loops && CN.loops.length >= 2 ? CN.loops : null;
  const tClamp = at => Math.min(0.9, Math.max(0.1,
    1 - (at != null ? at : 0.45)));
  const rows = [fr];
  if (!LOOPS) {
    const t3 = tClamp(CN.at);
    const kAt = Math.log(0.5) / Math.log(t3);    // Bezier apex reparam
    const crown = mkArc(t3, CN.h != null ? CN.h : 0.85, CN.w || 1);
    m.canArcs = [crown];                         // loop overlay (viewer)
    for (let k = 1; k < NR - 1; k++) {
      const t = Math.pow(tOf(k), kAt);
      const b0 = (1 - t) * (1 - t), b1 = 2 * t * (1 - t), b2 = t * t;
      const row = [rpP[k].slice()];              // verbatim port foot
      for (let i = 1; i < NVp; i++)
        row.push([b0 * fr[i][0] + b1 * crown[i][0] + b2 * ar[i][0],
                  b0 * fr[i][1] + b1 * crown[i][1] + b2 * ar[i][1],
                  b0 * fr[i][2] + b1 * crown[i][2] + b2 * ar[i][2]]);
      row.push(rpS[k].slice());                  // verbatim starboard foot
      rows.push(row);
    }
  } else {
    const arcs = LOOPS.map(l => mkArc(tClamp(l.at),
      l.h != null ? l.h : 0.85, l.w || 1));
    m.canArcs = arcs.slice();                    // loop overlay (viewer)
    // implicit REAR TANGENT control (user: "the arch does not survive
    // the loop height options — it doesn't stick to the canopy"): one
    // automatic arc straight above the rear row steepens the arrival,
    // so the glass lands ON the arch (or dives to the pod's aft seam
    // under the deck lip) whatever the user loops do. Feet weighted
    // by sin, so the boundary corners stay put.
    {
      let y0 = 1e9, y1 = -1e9;
      for (const p of ar) { y0 = Math.min(y0, p[1]);
                            y1 = Math.max(y1, p[1]); }
      const tang = Math.max(0.12, 0.5 * (y1 - y0));
      arcs.push(ar.map((p, i) => {
        const th = Math.PI * i / NVp;
        return [p[0], p[1] + tang * Math.sin(th), p[2]];
      }));
    }
    const bez = (ps, t) => {
      const q = ps.map(p => p.slice());
      for (let r = q.length - 1; r > 0; r--)
        for (let j = 0; j < r; j++)
          for (let d = 0; d < 3; d++)
            q[j][d] += (q[j + 1][d] - q[j][d]) * t;
      return q[0];
    };
    for (let k = 1; k < NR - 1; k++) {
      const t = tOf(k);
      const row = [rpP[k].slice()];
      for (let i = 1; i < NVp; i++)
        row.push(bez([fr[i], ...arcs.map(a3 => a3[i]), ar[i]], t));
      row.push(rpS[k].slice());
      rows.push(row);
    }
  }
  rows.push(ar);
  const LVc = [], LFc = [], LEc = new Map();
  const push = p => LVc.push([p[0], p[1], p[2]]) - 1;
  const vids = rows.map(r2 => r2.map(push));
  const tag = (a, b) => LEc.set(cageEdgeKey(a, b), 3);
  // wound OUTWARD (glass renders front-side only — the far pane through
  // the near one read as a phantom circle, so backfaces are culled)
  for (let k = 0; k + 1 < rows.length; k++)
    for (let i = 0; i < NVp; i++)
      LFc.push({ v: [vids[k][i], vids[k][i + 1], vids[k + 1][i + 1],
                     vids[k + 1][i]], m: 'windshield', win: 1 });
  const NRr = rows.length;
  for (let i = 0; i < NVp; i++) {
    tag(vids[0][i], vids[0][i + 1]);
    tag(vids[NRr - 1][i], vids[NRr - 1][i + 1]);
  }
  for (let k = 0; k + 1 < NRr; k++) {
    tag(vids[k][0], vids[k + 1][0]);
    tag(vids[k][NVp], vids[k + 1][NVp]);
  }
  let comp = { V: LVc, F: LFc, E: LEc };
  comp = cageSubdivide(cageSubdivide(comp));
  const off = V.length;
  for (const p of comp.V) V.push(p);
  for (const f of comp.F) {
    const nf = { v: f.v.map(i2 => i2 + off), m: f.m, att: 1 };
    if (f.win) nf.win = 1;
    F.push(nf);
  }
  // ARCEAU CONSTRAINED TO THE CANOPY (user, replacing the S4 collapse):
  // the hoop's displayed verts above the seam project RADIALLY onto
  // the canopy's own section at their z (sliced from the component
  // just built) and tuck one glass-gap inside — the hoop hugs the
  // bubble whatever the loops do. Blend over the first 8 cm above the
  // seam, so the band leaves the fuselage without a step; verts at or
  // below the seam never move. cageInterior runs after this, so the
  // arceau's thickened body follows the fitted hoop.
  if (POD && CN.fit) {
    const ySeam = S.bandY;
    // ray centre BELOW the seam (user: the base did an S) — with the
    // centre AT seam height the foot-level rays ran nearly horizontal
    // and grazed the vertical glass wall; from below, every ray meets
    // the section cleanly and the base swings out monotonically
    const yC0 = ySeam - 0.2;
    const secAt2 = zk => {
      const pmap = new Map();
      for (const f of comp.F)
        for (let e = 0; e < f.v.length; e++) {
          const a = f.v[e], b = f.v[(e + 1) % f.v.length];
          const A = comp.V[a], B = comp.V[b];
          const za = A[2] - zk, zb = B[2] - zk;
          if (za * zb >= 0) continue;
          const k = a < b ? a + '_' + b : b + '_' + a;
          if (pmap.has(k)) continue;
          const t = za / (za - zb);
          pmap.set(k, [A[0] + (B[0] - A[0]) * t,
                       A[1] + (B[1] - A[1]) * t]);
        }
      const pts2 = [...pmap.values()];
      if (pts2.length < 4) return null;
      pts2.sort((q, r) => Math.atan2(q[1] - yC0, q[0])
                        - Math.atan2(r[1] - yC0, r[0]));
      return pts2;
    };
    const av = new Set();
    for (const f of F)
      if (f.m === 'pillarCabin')
        for (const vi of f.v) if (V[vi][1] > ySeam - 0.02) av.add(vi);
    const cache = new Map();
    for (const vi of av) {
      const p = V[vi];
      const zk = Math.round(p[2] * 200) / 200;
      let sec = cache.get(zk);
      if (sec === undefined) { sec = secAt2(zk); cache.set(zk, sec); }
      if (!sec) continue;
      const dx = p[0], dy = p[1] - yC0;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      let sBest = -1;
      for (let i = 0; i + 1 < sec.length; i++) {
        const ax = sec[i][0], ay = sec[i][1] - yC0;
        const ex = sec[i + 1][0] - sec[i][0];
        const ey = sec[i + 1][1] - sec[i][1];
        const det = -ux * ey + ex * uy;
        if (Math.abs(det) < 1e-12) continue;
        const s = (-ax * ey + ex * ay) / det;
        const u = (ux * ay - uy * ax) / det;
        if (u >= -1e-6 && u <= 1 + 1e-6 && s > 1e-6
            && (sBest < 0 || s < sBest)) sBest = s;
      }
      if (sBest <= 0) continue;
      // 4 mm gap: the hoop rides just under the glass (user: 15 mm
      // read as "set below the canopy" once the interior frame added
      // its own 9 mm inset on top)
      const tgt = sBest - 0.004;
      const u2 = Math.max(0, Math.min(1, (p[1] - ySeam) / 0.12));
      const bl = u2 * u2 * (3 - 2 * u2);           // smoothstep
      const nl = dl + (tgt - dl) * bl;
      V[vi] = [ux * nl, yC0 + uy * nl, p[2]];
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// THE UNIT (2026-08-19, user: "we need solid ground here")
// ---------------------------------------------------------------------------
// ONE definition of how cage numbers become world numbers:
//
//     metres = cage units x CAGE_UNIT x spec-level plane scale
//
// CAGE_UNIT is a CONSTANT — the unit the fiche is written in. It is 1.0:
// the template IS metric, measured against the crew (a 50th-percentile
// dummy's seated eye lands 0.97 m above the floor in it, and the cage's
// own length reads 6.6 m — both real light-aircraft numbers). The
// "planes are too big" reading is NOT a unit error: it is PROPORTION
// (the template's cabin is ~0.4 m taller than a light aeroplane's for
// its length), which the cage's own sliders fix — see HANDOVER G19d.
//
// Changing this constant re-scales every measurement the tools report
// without touching the fiche, so the fit gate (which works in template
// units, against the Blender reference) stays exact either way. Do not
// introduce a SECOND hidden factor anywhere: the per-build design
// scale is a spec parameter, and it is the only other multiplier.
const CAGE_UNIT = 1.0;                    // metres per cage unit

if (typeof module !== 'undefined')
  module.exports = { CAGE_DEFAULT, CAGE_PARAMS, CAGE_MAT, CAGE_AFT_SUB,
                     CAGE_UNIT,
                     buildCage2, cageResolve, cageSpec, cageSubdivide,
                     cageRims, cageInterior, cageCut, cageGlassSill,
                     cageCanopy };
if (typeof window !== 'undefined')
  window.CAGE2 = { CAGE_DEFAULT, CAGE_PARAMS, CAGE_MAT, CAGE_AFT_SUB,
                   CAGE_UNIT,
                   buildCage2, cageResolve, cageSpec, cageSubdivide,
                   cageRims, cageInterior, cageCut, cageGlassSill,
                   cageCanopy };
