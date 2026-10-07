// ============================================================
// M3 — autopilot: full circuit. takeoff, climb, outbound cruise,
// 180 turnback, inbound track, glideslope, flare, rollout, stop.
// W10 cross-country: all along/cross geometry runs in a RUNWAY FRAME
// {origin o, unit axis u} built from a W.aerodromes record (contract
// rule 6). The frame puts the touchdown zone at s = -450 (the home
// strip's tdz coordinate), so every fiche's tuned xTurn/xAim/gs
// transfers to any strip unchanged. Axis components are SNAPPED so the
// HOME frame is exactly s = x, cross = z: the whole calm + wind battery
// is byte-identical through this refactor. A->B flights replace
// TURNBACK with ENROUTE (destination landing frame, terrain-aware
// cruise altitude), then reuse INBOUND..STOPPED untouched.
// Conventions: de>0 nose-up, da>0 roll-right, dr>0 nose-left,
// e>0 = nose left of target.
// G1570 (review E4): the servos — the filters and every inner loop — are
// 39b_servos.js, one module under all three pilots; this file keeps its phases.
// ============================================================
// W10 spawn-at-aerodrome: after sim.reset(0), rotate the def geometry
// from its built-in -x nose heading onto the strip's takeoff heading
// (theta = pi - hdg) and translate to the record's spawn point at strip
// elevation. HOME (hdg pi, spawn [0,0], elev 0) is a BIT-EXACT no-op,
// so calling this unconditionally changes nothing for the home battery.
function placeAtAerodrome(sim, a) {
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  const th = Math.PI - a.hdg;
  const c = snap(CORE_MATH.cos(th)), s = snap(CORE_MATH.sin(th));
  const sp = a.spawn || [0, 0];
  for (let i = 0; i < sim.n; i++) {
    const x = sim.p[i * 3], z = sim.p[i * 3 + 2];
    sim.p[i * 3] = x * c + z * s + sp[0];
    sim.p[i * 3 + 2] = -x * s + z * c + sp[1];
    sim.p[i * 3 + 1] += (a.spawnElev !== undefined ? a.spawnElev : a.elev);   // G398.3: a premises strip's spawn may sit on its profile, not at the strip's elevation
  }
}

// G151: THE STAND. placeAtAerodrome puts the aeroplane on the strip's SPAWN
// IDENTITY — the W10 datum every flying gate departs from, which is exactly
// why it must never move: shifting it would move every take-off measurement
// in the battery at once. But a PLAYER rolling out of the shed has not been
// teleported onto the runway; the aeroplane was wheeled onto the apron, and
// landing it 75 m away facing the wrong way is the first thing every flight
// used to show (G123 named it and wired `site.stand` to nothing).
// This places it on that declared stand instead. The spawn identity is NOT
// touched — the taxi that follows ENDS on the centreline, so the datum keeps
// its meaning and the gates keep their numbers.
// It is deliberately a THIN wrapper rather than a second copy of the
// transform: placeAtAerodrome reads exactly hdg / spawn / elev, so a stand is
// just another pose to hand it. One transform, one place, as ever.
function placeAtStand(sim, a, st) {
  return placeAtAerodrome(sim, st
    ? { hdg: st.hdg, spawn: [st.x, st.z], elev: st.elev !== undefined ? st.elev : a.elev } : a);   // G398.3: the stand's own ground when the site names it
}

// G700: THE WHEELS ON THE GROUND UNDER THEM. placeAtStand lifts the airframe by ONE elevation, read at
// the stand's point, and stance() set the third wheel on the mains' ground line in the design frame, which
// is flat; the wheels stand metres away on a slope (Jolene's East Point clearing is a 15 % grade under the
// stand: the tailwheel 84 cm up, the airframe falling 19 cm onto it at 0.9 m/s; the Skyline altiport's
// lowest tyre 2.7 cm into the ground). seatOnGround pitches the airframe about the mains' centroid until
// the third wheel (refs.tw, the nose wheel of a tricycle) meets ITS ground as the mains meet theirs, then
// moves it vertically so the lowest contact (node minus radius, over the ground at its own x, z) is 1 cm
// clear - the clearance sim.reset() leaves on the design floor. The GAME's placement step (app.js
// applyRoute); the gates' spawn datums are untouched. Returns the vertical shift (m).
function seatOnGround(sim, groundH, refs) {
  if (typeof groundH !== 'function') return 0;
  const P = sim.p, R = sim.r;
  const clr = i => P[i * 3 + 1] - (R[i] || 0) - groundH(P[i * 3], P[i * 3 + 2]);
  const M = refs && refs.mains, tw = refs && refs.tw;
  if (M && M.length && tw != null && tw >= 0) {
    for (let it = 0; it < 3; it++) {           // the ground under the wheel moves as it swings: three passes
      let ax = 0, ay = 0, az = 0, cM = 0;
      for (const i of M) { ax += P[i * 3]; ay += P[i * 3 + 1]; az += P[i * 3 + 2]; cM += clr(i); }
      ax /= M.length; ay /= M.length; az /= M.length; cM /= M.length;
      let ux = P[tw * 3] - ax, uz = P[tw * 3 + 2] - az;
      const L = Math.hypot(ux, uz);
      if (L < 0.2) break;
      ux /= L; uz /= L;
      const hT = P[tw * 3 + 1] - ay, Rr = Math.hypot(L, hT), want = hT - (clr(tw) - cM);
      if (Math.abs(want) >= Rr) break;
      const th = Math.asin(want / Rr) - Math.atan2(hT, L);
      if (!(Math.abs(th) < 0.35) || Math.abs(th) < 1e-5) break;   // 20 deg: past that it is not a stand
      const cs = CORE_MATH.cos(th), sn = CORE_MATH.sin(th);
      for (let i = 0; i < sim.n; i++) {
        const s = (P[i * 3] - ax) * ux + (P[i * 3 + 2] - az) * uz, h = P[i * 3 + 1] - ay;
        const s2 = s * cs - h * sn, h2 = s * sn + h * cs;
        P[i * 3] += (s2 - s) * ux; P[i * 3 + 2] += (s2 - s) * uz; P[i * 3 + 1] = ay + h2;
      }
    }
  }
  let minC = Infinity;
  for (let i = 0; i < sim.n; i++) minC = Math.min(minC, clr(i));
  if (!Number.isFinite(minC)) return 0;
  const dy = 0.01 - minC;
  for (let i = 0; i < sim.n; i++) P[i * 3 + 1] += dy;
  return dy;
}

// G771: THE LINE-UP, WITHOUT THE TAXI (the user: "button to skip the taxi phase and straight to starting
// line"). The pose is the hold the pilot's own taxi would have ended on (43_pilot ap.lineupPose), and the
// aeroplane goes onto it the way it goes onto the stand - the one transform - then onto the strip's TRUE
// surface with G700's seatOnGround: the third wheel pitched onto its own ground, the lowest contact 1 cm over
// the solver's own ground (world.terrainH, what the tyres roll on). No record's elev, no premises' declared
// height: a sloped or crowned strip, a hold off the aerodrome's datum, all get the ground the tyres will meet.
// `refs` = def.refs (the wheels); without them the airframe is only lifted as one. Call after sim.reset (and
// stance), like placeAtStand.
function placeAtLineup(sim, a, pose, world, refs) {
  placeAtAerodrome(sim, { hdg: pose.hdg, spawn: [pose.x, pose.z], elev: (a && a.elev) || 0 });
  const gH = (world && typeof world.terrainH === 'function') ? world.terrainH : (() => (a && a.elev) || 0);
  return seatOnGround(sim, gH, refs);
}

function makeAutopilot(sim, def, world) {
  const A = def.params.ap;
  // TAXI BREAKAWAY (G4.9). The taxi governor below is a proportional speed
  // hold, and a fraction of throttle is not a fixed amount of push: what it
  // has to beat is CRR*W, which is a property of the AEROPLANE. The old
  // constant 0.08 bias happened to clear that on every fiche only because the
  // solver was handing the single-engine ones twice their thrust — on honest
  // thrust the Cub's governor asked for 0.20, got 180 N against 185 N of
  // rolling resistance, and the backtrack in GATE XCTY5 crept 16 m in 120 s
  // and timed out onto the wrong end of the strip.
  // So the bias is the throttle that exactly cancels rolling resistance,
  // derived per aeroplane. Nothing is tuned here: CRR and the prop curve are
  // both already in the registry.
  // G121: a FUNCTION of the live mass, not a number captured at engagement —
  // this exact feedforward being wrong is the documented 16 m creep below,
  // and burning fuel would have made it wrong again. Identical value on every
  // call for anything whose mass never changes, which is the whole fleet.
  // THE POWER NOSE-OVER CAP (G179): see genGroundPowerCap. 1 for every
  // aeroplane whose thrust line sits at or below its CG, and for every
  // tricycle — the whole fleet; less than 1 only on a taildragger that would
  // go over on power alone, until its tail is up.
  const GP = (typeof genGroundPowerCap === 'function')
    ? genGroundPowerCap(def, sim.thrustAt(0), sim.totalM * 9.81) : { cap: 1 };
  // G193: THE FOLLOWER'S OWN NUMBERS. A tailwheel steer is a rear-steered
  // bicycle: the turn the rudder commands is atan(Lwb * kap) / twSteer, so
  // the wheelbase and the steer gain are read off the frame once. And the
  // THREE-POINT RUN: a taildragger whose ground power is capped (thrust line
  // above the CG, the user's wing-mounted twin) keeps its tail DOWN until
  // rotation so the tailwheel steers the whole run; every other build rolls
  // exactly as before (A.rotate was never set by anything, and still is not
  // for them).
  const TW = (() => {
    const N = def.nodes, R = def.refs;
    let Lwb = 4.0;
    if (R && R.mains && R.mains.length && R.tw != null && R.tw >= 0) {
      const mx = R.mains.reduce((s, i) => s + N[i].p[0], 0) / R.mains.length;
      Lwb = Math.max(0.5, Math.abs(N[R.tw].p[0] - mx));
    }
    return { Lwb, steer: Math.abs(def.params.twSteer || 0.5) };
  })();
  // (measured: three-point for EVERY taildragger was tried and is wrong — the
  // elevator cannot hold the tail down at full power anyway, the crosswind
  // drift grew to 10 m and the hover fixture changed verdict. Capped builds
  // only, as designed.)
  const threePoint = (def.params.twSteer || 0.5) > 0 && GP.cap < 1;
  // ...and EVERY taildragger rotates at Vr (G193). A.rotate was never set by
  // anything, so the tail-up branch was dead code and a taildragger ran on its
  // mains until it floated off — measured on the user's ultralight: Vr 15.4,
  // airborne at 34 m/s after 300 m on two wheels with the wing carrying the
  // weight and the tyres carrying nothing, which a 2 m/s crosswind turned into
  // a 36 m slide. The tail-up steering schedule below arms for the same set.
  const rotateTD = A.rotate != null ? !!A.rotate : (def.params.twSteer || 0.5) > 0;
  const taxiFF = (() => {
    const PP = POWERPLANTS[def.params.powerplant];
    const PR = def.params.prop || PP.prop;
    const T0 = Math.max(1, PR.Tstatic * (def.params.nEngines || 1));
    return () => Math.min(0.5, CRR * sim.totalM * 9.81 / T0);
  })();
  // G1570: THE SERVOS ARE ONE MODULE (39b_servos.js), shared with 41 and 43:
  // the G381 / G630 / G352 fixes are flown here too (they had landed in 43
  // only); 43's own laws (the calm-air trim, P1.D's ground steer, the aileron
  // into wind, the water) stay off. The trike is 43's reading of the gear.
  const trike = A.rolloutMode === 'trike' || (def.params.twSteer || 0.5) < 0;
  const SV = makeServos(sim, def, { pilot: 'classic', now: () => ap.t, trike, rotateTD, TW });
  // B5: the CG's rest height in the design pose — the height datum of a pilot
  // first engaged in the air (no rest to measure)
  const restH0 = servoRestHeight(def);
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  // u = frame axis (landing direction); origin places tdz at s = -450
  const mkFrame = (a, sx, sz) => {
    let ux = snap(CORE_MATH.cos(a.hdg)), uz = snap(CORE_MATH.sin(a.hdg));
    if (sx !== undefined) {                 // pick the landing end facing travel
      const d = ux * sx + uz * sz;
      if (d < 0) { ux = -ux; uz = -uz; }
    } else { ux = -ux; uz = -uz; }          // departure: land opposite takeoff
    // G193: TWO TOUCHDOWN TARGETS, one per landing direction. k = 0 lands
    // along -hdg on the record's own tdz, to the bit, so every calm gate keeps
    // its number; k = 1 lands along +hdg on the pattern's mirror target off
    // the other threshold — a wind-flipped arrival used to aim at mid-field.
    const k = (ux * CORE_MATH.cos(a.hdg) + uz * CORE_MATH.sin(a.hdg)) > 0 ? 1 : 0;
    const PT = (k === 1 && ap.patOf) ? ap.patOf(a) : null;
    const td = (PT && PT.approaches && PT.approaches[1]) ? PT.approaches[1].td : a.tdz;
    return { ux, uz, ox: td[0] + 450 * ux, oz: td[1] + 450 * uz, k };
  };
  const HOMEISH = { hdg: Math.PI, tdz: [-845, 0], elev: 0 };  // world-less fallback (G381: 20 % in)
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: A.VAppr,
    xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
    targetDir: [-1, 0, 0], trackHold: true, dirX: -1,
    restAlt: null, refAlt: null, altRef: 0, tdInfo: null, dbg: {},
    route: null, xc: false, frame: null, gaN: 0, gaWhy: null,
  };
  // G1375 STRIP-SURFACE: no destination on a surface this gear may not use (25_airfield.js stripLandable)
  const gearK = typeof stripGear === 'function' ? stripGear(def && def.spec && def.spec.gear ? def : sim) : 'wheels';
  const landable = (from, to) => (typeof stripLandable === 'function') ? stripLandable(gearK, world && world.aerodromes, from, to).to : to;
  const setRoute0 = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);               // departure frame
    ap.altRef = from.elev;
    ap.shortFld = false;                    // set per-arrival in enterArrival
  };
  ap.setRoute = (from, to) => setRoute0(from, landable(from, to));
  setRoute0(world ? world.aerodromes[0] : HOMEISH,
            world ? world.aerodromes[0] : HOMEISH);
  // W14 multi-hop: depart from wherever the aircraft is standing on
  // `from` — no reset, no teleport. The plan runs on the first update
  // (it needs the live pose): takeoff INTO the wind when there is any,
  // else along the current nose; straight ahead when the runway left
  // covers TORun + margin, else taxi back along the strip and turn
  // around (TAXI/LINEUP), then the normal ROLL takes over. Use on a
  // fresh makeAutopilot instance so restAlt/integrators latch clean.
  // G151: `taxiOut` is the SITE's declared way from its stand to the
  // centreline (see 25_airfield.js). Optional, and absent for every caller
  // that departs from the strip itself — GATE XCTY5's backtrack passes two
  // arguments and is unchanged.
  // G193: the pattern of an aerodrome, built once per record from its site
  // (25_airfield.js sitePattern) — the graph the taxi follows and the two
  // approaches the frame lands on
  const PATS = {};
  ap.patOf = a => {
    if (!a) return null;
    const key = a.id || 'HOME';
    if (PATS[key] !== undefined) return PATS[key];
    let P = null;
    try {
      if (typeof sitePattern === 'function')
        P = sitePattern(a, typeof siteOf === 'function' ? siteOf(a.id) : null);
    } catch (e) { P = null; }
    PATS[key] = P;
    return P;
  };
  // the third argument is the SITE now (the pattern is built from it); a
  // bare taxiOut list still works for the callers that pass one
  ap.departFrom = (from, to, siteOrTaxiOut) => {
    const site = (siteOrTaxiOut && !Array.isArray(siteOrTaxiOut)) ? siteOrTaxiOut : null;
    ap.site = site;
    ap.path = null; ap.pathI = 0; ap.stopAfterLineup = false; holdN = 0;
    ap.taxiPath = null;
    ap.taxiOut = Array.isArray(siteOrTaxiOut) && siteOrTaxiOut.length ? siteOrTaxiOut
               : (site && site.taxiOut) || null;
    to = landable(from, to);
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.trackHold = false;
    ap.taxiTgt = null;
    ap.taxiPath = null;
    ap.phase = 'DEPART'; phaseT = 0;
  };
  // arrival switch: destination landing frame + arrival altitude refs
  const enterArrival = () => {
    const { from, to } = ap.route;
    if (ap.xc) {
      // W13.2: land INTO the wind when there is any (a quartering
      // tailwind at Stein bounced + veered + nosed-over every PA-18
      // arrival), else keep facing travel as before. Sampled once at
      // arrival setup — the viewer presets are constant fields.
      let hx = to.tdz[0] - from.tdz[0], hz = to.tdz[1] - from.tdz[1];
      if (world && world.wind) {
        const wv = world.wind(to.x, to.elev + 30, to.z, ap.t);
        if (Math.hypot(wv[0], wv[2]) > 0.7) { hx = -wv[0]; hz = -wv[2]; }
      }
      ap.frame = mkFrame(to, hx, hz);
      // aim from the ACTUAL approach threshold of the chosen frame. The
      // old "-450 - 0.25*len" assumed the tdz sits 25% from the approach
      // end, which is only true in the record's canonical direction — a
      // FLIPPED arrival aimed 0.5*len (195 m at Stein) too deep. In the
      // canonical direction sThr is identical to the old formula, so
      // calm bearing-picked gates are untouched.
      const sCen = (to.x - ap.frame.ox) * ap.frame.ux + (to.z - ap.frame.oz) * ap.frame.uz;
      const sThr = sCen - to.len / 2;
      ap.xAim = Math.max(A.xAim, sThr + 40);
      // short strips (fly-in benches, len < 450): aim just past the
      // threshold and fly the fiche's short-field speed if it has one —
      // the 1100 m-runway VAppr floats a third of a 340 m strip away.
      ap.shortFld = to.len < 450;
      if (ap.shortFld) {
        ap.xAim = sThr + 75;       // measured touch scatter -50..+20 about aim
        if (A.VApprShort) ap.VAppr = A.VApprShort;
      } else ap.VAppr = A.VAppr;   // re-arm after a short-strip leg
    }
    ap.dirX = 1;
    ap.altRef = to.elev;
    ap.refAlt = ap.restAlt + (to.elev - from.elev);
  };
  // the servos' state lives in SV (39b_servos.js, G1570). W19's 2 s climb-rate
  // filter (vsSlow, read by the CLIMB acceptance) is the module's SV.vsSlow,
  // kept outside holdVS's vsF as before.
  let gaT = 0;
  let phaseT = 0, headingCapT = 0, thFlare0 = 0, thLift0 = 0, brakeRamp = 0;
  // G193: the path follower's and the three-point run's state
  let holdN = 0, thRest = null, thrRoll = 0, taxiXT = 0, taxiSRem = 0, tailUpNow = false;
  let pendReEng = false;                // W14: full state re-latch on next update
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // W14 manual-controls prep: call when the AP resumes after a stretch of
  // external/manual flight — every integrator, filter and servo memory
  // re-latches from the live state on the next update, so re-engage flies
  // from the CURRENT attitude instead of stale pre-handoff state (the
  // DC-3-at-Vr nose-over documented in HANDOVER). restAlt is left alone:
  // it anchors the current route's altitude refs. Never called by the
  // AP's own flow — zero effect on existing batteries.
  ap.reEngage = (o) => {
    pendReEng = true;
    // G200: after a stretch of MANUAL flight the PHASE can be a lie as well —
    // a hand-flown take-off leaves the AP in DEPART with the aeroplane at
    // 300 m, and DEPART would taxi it. The caller (app.js setManual) says
    // where the aeroplane actually is; phaseT restarts with the phase.
    if (o && typeof o.phase === 'string' && o.phase !== ap.phase) { ap.phase = o.phase; phaseT = 0; }
  };

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    const c = sim.ctl, onG = sim.wheelsOnGround();
    // B5: THE DATUM IS LATCHED ON THE GROUND. The first update used to latch
    // whatever height the CG had — a pilot first engaged at 300 m took 300 m
    // as the field and flared there. On the wheels: the CG's rest height (as
    // always, bit-identical for every ground start); in the air: the departure
    // field's elevation + the design pose's rest height (restH0)
    if (ap.restAlt === null) {
      const r0 = onG > 0 ? cg[1] : ap.route.from.elev + restH0;
      ap.restAlt = r0; ap.refAlt = r0;
    }
    const agl = cg[1] - ap.refAlt;
    // runway-frame coordinates: sAl along the frame axis (was cg[0]),
    // sCr cross-track (was cg[2]); HOME frame is exactly s=x, cross=z
    const F = ap.frame;
    const rxF = cg[0] - F.ox, rzF = cg[2] - F.oz;
    const sAl = rxF * F.ux + rzF * F.uz;
    const sCr = -rxF * F.uz + rzF * F.ux;
    // V = AIRSPEED (aero speeds: rotation, approach, stall margins);
    // Vg = groundspeed (wheels: brakes, stop detection). The wind sample is
    // the solver's last CG wind — exact zeros when no wind is set, so the
    // zero-wind battery is byte-identical to the pre-wind one.
    //
    // AND V IS AN EQUIVALENT AIRSPEED (G72). Every speed this autopilot flies —
    // VClimb, VCruise, VAppr, VTurn, VClimbMin, VDerotate — was derived or
    // tuned at rho0, which makes every one of them an EAS whether anyone said
    // so or not. Feeding it a TRUE airspeed instead works perfectly at sea
    // level and stalls the aeroplane at altitude, because it would hold a
    // number that no longer corresponds to the dynamic pressure it was chosen
    // for. easK is exactly 1 at sea level, so this line moves nothing there.
    // Vt (TRUE) is kept for beta, which is a geometric angle and wants the real
    // speed, not the felt one.
    const o_ = sim.out;
    const Vg = Math.hypot(vcg[0], vcg[1], vcg[2]);
    const Vt = Math.hypot(vcg[0] - (o_.windX || 0), vcg[1] - (o_.windY || 0), vcg[2] - (o_.windZ || 0));
    const V = Vt * (o_.easK || 1);
    const nose = [-xA[0], -xA[2]];
    const nL = Math.hypot(nose[0], nose[1]) || 1e-9;
    nose[0] /= nL; nose[1] /= nL;

    let tx = ap.targetDir[0], tz = ap.targetDir[2];
    if (ap.trackHold) {
      const L = ap.phase === 'ROLL' || ap.phase === 'ROLLOUT' ? (A.lookRoll ?? 25)
              : ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (A.lookAppr ?? 100)
              : (A.lookCruise ?? 150);
      const fx = ap.dirX * L, fz = -sCr;      // pursuit target in frame coords
      tx = fx * F.ux - fz * F.uz; tz = fx * F.uz + fz * F.ux;
      const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    }
    const e = Math.atan2(tz * nose[0] - tx * nose[1], tx * nose[0] + tz * nose[1]);
    // air guidance steers COURSE OVER GROUND, not the nose: a crabbing /
    // slipping aircraft with nose-referenced pursuit parks at a standing
    // cross-track offset ~ L*(crab - slip) with e exactly zero (measured:
    // C172 frozen at z=+21..26 in a 3 m/s crosswind). Velocity-referenced
    // pursuit makes the crab implicit. Ground steering keeps the nose error.
    let eA = e;
    const tl2 = Math.hypot(vcg[0], vcg[2]);
    if (tl2 > 5) {
      const tkx = vcg[0] / tl2, tkz = vcg[2] / tl2;
      eA = Math.atan2(tz * tkx - tx * tkz, tx * tkx + tz * tkz);
    }

    const thRaw = Math.asin(clamp(-xA[1], -1, 1));
    const phRaw = Math.atan2(-zR[1], yU[1]);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(Vt, 5);
    if (pendReEng) {                    // W14: re-latch everything live
      pendReEng = false;
      SV.relatch(); brakeRamp = 0;
    }
    // THE SENSING (39b_servos.js): the attitude and rate filters (from the
    // attitude on the first step, G381), the bumpless target and the wrapped
    // rates (G630), the slow climb and acceleration filters
    SV.sense(dt, e, eA, Math.atan2(tz, tx), thRaw, phRaw, beta, V, Vg, vcg[1], onG);
    const th = SV.th, ph = SV.ph, q = SV.q, p = SV.p, eR = SV.eR, vsSlow = SV.vsSlow;

    if (onG > 0 && agl < A.aglGuard && V < A.VRot * 0.9
        && ['LIFTOFF','CLIMB'].includes(ap.phase)) {
      ap.phase = 'ROLL'; phaseT = 0;      // genuinely settled back (slow): retry
    }

    // ---- THE SERVOS: one module, 39b_servos.js (G1570) ----------------------------
    // holdPitch (the W14 resync when the previous step did not call it),
    // airLateral (the in-wind course trim), speedThrottle (G352's anti-windup,
    // G381's damping on the measured acceleration), holdVS, groundSteer (the
    // G193 tail-up schedule; G381: the tail-down gains ease with speed; G630:
    // the ground's aileron deadband, the trike's rate term) and the taxi
    // governor (the 2026-09-04 PI on the ground speed) are the module's.
    const holdPitch = SV.holdPitch, holdVS = SV.holdVS, speedThrottle = SV.speedThrottle;
    const airLateral = (bl) => SV.airLateral(bl);
    const groundSteer = () => { tailUpNow = SV.groundSteer(thRest, F); };
    const taxi = (Vt) => SV.taxi(Vt, taxiFF(), Math.min(A.taxiThrMax ?? 0.85, GP.cap));   // G179: the cap


    // W19 MISSED APPROACH. Everything from APPROACH onwards used to be one-way:
    // once committed the autopilot arrived whatever happened, because the only
    // re-entry in the whole machine was the balked-takeoff guard. Each trigger
    // below is set well outside every fiche's measured margin, and gaN caps the
    // attempts — a go-around loop is worse than a firm arrival, and a gate run
    // has to terminate.
    const goAround = why => {
      ap.gaN = (ap.gaN || 0) + 1; ap.gaWhy = why;
      ap.phase = 'GOAROUND'; phaseT = 0; gaT = 0;
      SV.thrC = A.thrCruise;
    };
    // W19 GROUND FLOOR on the cruise legs. Measured: a build flew the last
    // 1.5 km of INBOUND at 1 m agl and nothing in the autopilot objected.
    // hSafe is the AP's own "safely airborne" height; the fleet's minimum on
    // these legs is 87-90 m against an hSafe of 8-30, so this never fires
    // for them.
    // hSafe ALONE, not max(hSafe, something): the drone's whole circuit is
    // 60 m and its hSafe is 8, so a flat 25 m floor forced a climb in the
    // middle of its INBOUND descent and moved its gate numbers. hSafe is
    // already scaled per aeroplane, which is the whole point of it.
    const vsAgl = v => agl < A.hSafe ? Math.max(v, 1.0) : v;

    switch (ap.phase) {
      case 'DEPART': {
        // one-shot planning with the live pose (see ap.departFrom)
        const from = ap.route.from;
        const axx = snap(CORE_MATH.cos(from.hdg)), axz = snap(CORE_MATH.sin(from.hdg));
        let dx = nose[0], dz = nose[1];
        if (world && world.wind) {
          const wv = world.wind(from.x, from.elev + 30, from.z, ap.t);
          if (Math.hypot(wv[0], wv[2]) > 0.7) { dx = -wv[0]; dz = -wv[2]; }
        }
        const sg = (dx * axx + dz * axz) >= 0 ? 1 : -1;
        const ux = axx * sg, uz = axz * sg;          // takeoff direction
        ap.frame = mkFrame(from, -ux, -uz);          // frame u = landing dir
        ap.dirX = -1;
        const need = (A.TORun ?? 500) + 60;
        const sPos = (cg[0] - from.x) * ux + (cg[2] - from.z) * uz;
        // G151: HOW FAR OFF THE CENTRELINE — the question this planner never
        // asked, because until the stand was wired every departure already
        // stood on the strip. LINEUP is a FINAL ALIGNMENT: it pursues the
        // centreline at taxi speed on whatever intercept it happens to have,
        // which is right after a backtrack turn (a metre or two off) and
        // hopeless from an APRON. MEASURED from the home stand, 40 m out:
        // 324 s to reach ROLL, wandering 375 m down the runway to do it, and
        // the test pilot's 600 s budget then expired during the ROLLOUT of a
        // perfectly sound aeroplane. So when we are genuinely off the strip,
        // TAXI onto the centreline first — which is what TAXI already does.
        const sCr0 = -(cg[0] - from.x) * uz + (cg[2] - from.z) * ux;
        const offCl = Math.abs(sCr0) > 15;
        // G193: THE PATTERN WINS. Off the strip, the declared route out for
        // this take-off direction; on the strip with too little run, the
        // lane-and-U-turn back; on the strip with the run in front, a full
        // STOP on the spot, lined up, before the roll. Every route ends on a
        // hold: the aeroplane stops there, checks its alignment, then rolls.
        {
          const T = sg > 0 ? 0 : 1;
          const PAT = ap.patOf(from);
          const fits = !offCl && from.len / 2 - sPos >= need;
          if (PAT && PAT.routes) {
            const ids = offCl ? PAT.routes.out[T] : (fits ? null : PAT.routes.back[T]);
            if (ids && typeof patternPath === 'function') {
              ap.path = patternPath(PAT, ids, 1.0, [cg[0], cg[2]]);
              ap.pathI = 0; ap.stopAfterLineup = true;
              ap.phase = 'TAXI'; phaseT = 0;
              break;
            }
            if (fits) {
              ap.stopAfterLineup = true;
              ap.phase = Vg < 0.3 ? 'HOLD' : 'STOP'; phaseT = 0;
              break;
            }
          }
        }
        if (!offCl && from.len / 2 - sPos >= need) { ap.phase = 'LINEUP'; phaseT = 0; break; }
        // THE DECLARED WAY OUT wins whenever the site states one, because the
        // obstacles are the PLACE's and this planner cannot see a fence.
        if (offCl && ap.taxiOut) {
          const path = ap.taxiOut.map(p => [p[0], p[1]]);
          ap.taxiTgt = path.shift();
          ap.taxiPath = path;
          ap.phase = 'TAXI'; phaseT = 0;
          break;
        }
        // THE ENTRY POINT, computed. On the centreline and short of runway —
        // the BACKTRACK case — this is the run start, and the expression is
        // unchanged because GATE XCTY5 flies exactly it.
        // Off the centreline with nothing declared, aim AHEAD by a lead
        // proportional to the offset so the intercept is shallow: TAXI's own
        // 22 m exit then hands over near LINEUP's 8 m gate rather than far
        // outside it. Clamped onto the strip, and far enough back that the run
        // still fits.
        const sStart = offCl
          ? Math.min(Math.max(sPos + Math.max(60, 3.5 * Math.abs(sCr0)),
                              -from.len / 2 + 25), from.len / 2 - need - 25)
          : Math.max(-from.len / 2 + 25, from.len / 2 - need - 25);
        ap.taxiTgt = [from.x + ux * sStart, from.z + uz * sStart];
        ap.taxiPath = null;
        ap.phase = 'TAXI'; phaseT = 0;
        break;
      }

      case 'TAXI': {
        if (ap.path) {
          // G193: FOLLOW THE PATH, do not chase a point. Cross-track error
          // (Stanley's atan of the offset over the speed) turns the target
          // heading toward the line; the path's own curvature a lookahead
          // ahead goes STRAIGHT INTO THE RUDDER as a feed-forward, so a
          // corner is steered before an error exists — pure pursuit had to
          // build the error first, which is the corner-cut. The speed comes
          // down for the bend within the stopping distance and for the STOP
          // at the end, and the rudder has its whole travel at taxi speed
          // (the ±0.45 clamp could not make a 12 m corner on this aeroplane).
          const L = pathLocate(ap.path, ap.pathI, cg[0], cg[2]);
          ap.pathI = L.i; taxiXT = L.ey; taxiSRem = L.sRem;
          const K = pathLook(ap.path, L.i, Vg);
          const eXT = clamp(Math.atan2(0.9 * L.ey, Vg + 1.0), -0.6, 0.6);
          // G630: the look-ahead target filtered (it steps as the index
          // passes each sample of a bend), and the rudder on the steer
          // schedule's P + the curvature feed-forward, NO rate term (it only
          // differentiated the contact's yaw jitter)
          const hT = SV.taxiHeading(K.hdgL - eXT);
          ap.targetDir = [CORE_MATH.cos(hT), 0, CORE_MATH.sin(hT)];
          const drFF = -Math.atan(TW.Lwb * K.kapL) / Math.max(0.05, TW.steer);
          const drMaxG = 0.85 - 0.40 * clamp((Vg - 6) / 4, 0, 1);
          c.dr = SV.taxiRudder(drFF, drMaxG);
          taxi(pathSpeed(ap.path, L.i, Vg, A.taxiV ?? 5.0, L.sRem));
          const tMax = 40 + 1.6 * ap.path.len / (A.taxiV ?? 5.0);
          if (L.sRem < 2.0 || (L.sRem < 6 && Vg < 0.6)) { ap.phase = 'STOP'; phaseT = 0; }
          else if (phaseT > tMax) { ap.phase = 'LINEUP'; phaseT = 0; }
          break;
        }
        const ddx = ap.taxiTgt[0] - cg[0], ddz = ap.taxiTgt[1] - cg[2];
        const dist = Math.hypot(ddx, ddz) || 1e-9;
        ap.targetDir = [ddx / dist, 0, ddz / dist];
        c.dr = SV.taxiRudder(0, 0.45);                     // G630
        taxi(Math.abs(e) > 0.6 ? 2.2 : 4.5);
        // G151: a declared route is a LIST of points, and only the LAST one
        // hands over to LINEUP. Intermediate points are held to a tighter
        // radius than the final one, because a 22 m corner-cut through a 24 m
        // fence gate is a fence. A single-target taxi — W14's backtrack — has
        // no list, takes the 22 m branch, and is unchanged.
        const lastLeg = !(ap.taxiPath && ap.taxiPath.length);
        if (dist < (lastLeg ? 22 : 10) || phaseT > 120) {
          if (lastLeg) { ap.phase = 'LINEUP'; phaseT = 0; }
          else { ap.taxiTgt = ap.taxiPath.shift(); phaseT = 0; }
        }
        break;
      }

      case 'LINEUP': {
        ap.trackHold = true;                 // centreline pursuit, dirX = -1
        c.dr = SV.taxiRudder(0, 0.45);                     // G630
        const alig = -(nose[0] * F.ux + nose[1] * F.uz);  // dot(nose, takeoff dir)
        taxi(alig > 0.5 ? 4.5 : 2.4);
        if (alig > 0.988 && Math.abs(sCr) < 8 && Math.abs(eR) < 0.15) {
          // G193: a departure that came by the pattern STOPS before the roll
          if (ap.stopAfterLineup) { ap.phase = 'STOP'; phaseT = 0; break; }
          ap.phase = 'ROLL'; phaseT = 0;
          ap.t = Math.max(ap.t, 1);          // ROLL's 0.5 s throttle delay is long past
        }
        break;
      }

      // G193: THE STOP POINT (the user: "the plane lines up and completely
      // stops before taking off"). STOP brakes to a standstill, still
      // steering the path's last heading while it has speed to steer with;
      // HOLD sits two seconds, checks it is lined up inside 2.5 m and 6 deg,
      // and rolls — or takes one LINEUP correction and stops again.
      case 'STOP': {
        c.thr = 0; c.brake = 0.7; c.de = A.taxiDe ?? 0.30;
        if (ap.path && Vg > 1.0) {
          const L = pathLocate(ap.path, ap.pathI, cg[0], cg[2]);
          ap.pathI = L.i; taxiXT = L.ey; taxiSRem = L.sRem;
          const K = pathLook(ap.path, L.i, Vg);
          const hT = SV.taxiHeading(K.hdgL);              // G630
          ap.targetDir = [CORE_MATH.cos(hT), 0, CORE_MATH.sin(hT)];
          c.dr = SV.taxiRudder(0, 0.85);
        } else c.dr = 0;
        c.da = SV.groundAil(0, 0.25);
        if (Vg < 0.3 || phaseT > 30) { ap.phase = 'HOLD'; phaseT = 0; }
        break;
      }
      case 'HOLD': {
        c.thr = 0.3 * taxiFF(); c.brake = 0.5; c.de = A.taxiDe ?? 0.30;
        c.dr = 0; c.da = 0;
        if (phaseT >= (A.holdS ?? 2.0)) {
          const alig = -(nose[0] * F.ux + nose[1] * F.uz);   // dot(nose, takeoff dir)
          const lined = alig > 0.9945 && Math.abs(sCr) < 2.5;
          if (lined || holdN >= 2) {
            ap.phase = 'ROLL'; phaseT = 0; ap.t = Math.max(ap.t, 1);
            ap.trackHold = true; thrRoll = GP.cap; thRest = null;
          } else {
            holdN++;
            ap.stopAfterLineup = true;
            ap.phase = 'LINEUP'; phaseT = 0; ap.trackHold = true;
          }
        }
        break;
      }

      case 'ROLL':
        // G179: power up as the tail comes up (GP.cap is 1 for the fleet)
        // G193: the capped build RAMPS to full power over thrRampS once the
        // tail-up speed is reached, instead of stepping in one frame — the
        // step was the nose-over moment arriving all at once. cap 1 (the
        // fleet): capT is 1 throughout, bit-identical to before.
        {
          const capT = V < (A.VTailUp ?? 0) ? GP.cap : 1;
          thrRoll = GP.cap < 1
            ? Math.min(capT, Math.max(thrRoll, GP.cap) + (1 - GP.cap) / (A.thrRampS ?? 2) * dt)
            : capT;
          c.thr = ap.t > 0.5 ? thrRoll : 0; c.brake = 0;
        }
        if (thRest === null) thRest = th;    // the stance pitch, latched at the roll's start
        if (rotateTD) {
          // taildragger sequence: rotate at Vr; before that a THREE-POINT
          // build (G193) holds the stance it started in so the tailwheel
          // keeps steering, a conventional one lifts the tail at VTailUp
          if (V > A.VRot) holdPitch(A.thRotate ?? A.liftoffTh);
          else if (threePoint || V < (A.VTailUp ?? 0))
            holdPitch(threePoint ? Math.min(thRest, A.liftoffTh) : (A.thTailUp ?? 0.02));
          else holdPitch(A.thTailUp ?? 0.02);
        } else c.de = A.rollDe;
        groundSteer();
        if (onG === 0 && V > A.VRot) { ap.phase = 'LIFTOFF'; phaseT = 0; thLift0 = th; }
        break;

      case 'LIFTOFF':
        c.thr = 1;
        holdPitch(Math.min(thLift0 + (A.liftoffRamp ?? 9) * phaseT, A.liftoffTh));
        airLateral(0.15);
        if (agl > A.hSafe && V > A.VClimbMin) { ap.phase = 'CLIMB'; phaseT = 0; }
        break;

      case 'CLIMB': {
        c.thr = 1;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral();
        // ACCEPT WHAT IT CAN ACTUALLY CLIMB (W19). CLIMB used to have exactly
        // one exit — reaching hCruise — so an aeroplane that could not reach
        // the circuit height stayed in it until the clock ran out. That IS the
        // reported "it keeps climbing forever": measured, a 28 hp build sat
        // here for 350 s at 0.09 m/s, and a short-span one for 286 s.
        // The cure is to stop pretending: take the height it has, fly the
        // circuit at that, and let the glideslope intercept sooner. gs and
        // refAlt carry the arrival, so a lower circuit is self-consistent.
        //
        // NO-OP FOR THE FLEET, by two independent margins: it needs 60 s in
        // CLIMB *and* a 2 s-filtered climb rate under 0.15 m/s, where the
        // fiches climb at 3-5 m/s and top out in 14-47 s.
        const stalled = phaseT > 60 && vsSlow < 0.15;
        if (stalled) ap.hCruise = Math.max(A.hSafe + 10, cg[1] - ap.altRef);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || stalled) {
          if (ap.xc) {
            // remember the (safe, flat) climb-out heading: ENROUTE climbs
            // on it before turning toward terrain it cannot out-climb
            ap.holdDir = [ap.frame.ux * ap.dirX, 0, ap.frame.uz * ap.dirX];
            ap.phase = 'ENROUTE'; enterArrival(); ap.trackHold = false;
          } else ap.phase = 'CRUISE';
          phaseT = 0; SV.thrC = A.thrCruise; SV.thcI = 0.04;
        }
        break;
      }

      case 'CRUISE':
        speedThrottle(ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        if (sAl < ap.xTurn) {
          ap.phase = 'TURNBACK'; phaseT = 0;
          ap.trackHold = false; enterArrival();
          ap.targetDir = [ap.frame.ux, 0, ap.frame.uz];
        }
        break;

      case 'ENROUTE': {
        // cross-country leg: steer at the APPROACH FIX — the frame point
        // (xTurn, 0) on the destination's extended centreline — so arrival
        // works from any bearing (an "s > xTurn" handoff alone is a trap:
        // approaching from abeam, along-track is instantly inside xTurn
        // while cross-track is kilometres out — measured, Holtorham probe).
        // Altitude is terrain-aware: clear the highest terrain within
        // ~4 km of track, then sink back to circuit height (asymmetric VS
        // budget — the mountain belt needs more descent than a circuit).
        speedThrottle(ap.VCruise);
        // approach fix 1.2 km before xTurn on the extended centreline —
        // buys INBOUND room to settle onto the slope after a high arrival.
        // W14: arrivals HIGHER than the fix cone push the fix OUTBOUND so
        // the whole descent fits the final (excess height converts to
        // track at a -0.10 slope; it walks back in as the aircraft
        // descends). A Stein -> HOME PA-18 arrived 160 m over the old
        // fixed fix — INBOUND couldn't shed it by the aim and flew a
        // controlled descent into the dirt 200 m past the strip.
        const hCone0 = ap.refAlt + (ap.xAim - (ap.xTurn - 1200)) * ap.gs + 15;
        const fixOut = 1200 + Math.max(0, (cg[1] - hCone0) / 0.10);
        const fdx = (ap.xTurn - fixOut) - sAl, fdz = -sCr;
        const fDist = Math.hypot(fdx, fdz) || 1;
        const fixDir = [(fdx * F.ux - fdz * F.uz) / fDist, 0,
                        (fdx * F.uz + fdz * F.ux) / fDist];
        // terrain guard samples along the LEG track (not velocity — at the
        // turn the velocity still points down the old leg while the belt
        // rises on the new one; measured 1 m clearance). 7.5 km horizon.
        let hTgt = ap.altRef + ap.hCruise;
        if (world) {
          // dense near samples: 1.5 km gaps let narrow warped ridges slip
          // between guard points (measured 16 m clearance over one)
          for (const dA of [0, 400, 800, 1500, 2500, 4000, 5500, 7500]) {
            const hT = world.terrainH(cg[0] + fixDir[0] * dA, cg[2] + fixDir[2] * dA)
                     + (A.hClear ?? 130);
            if (hT > hTgt) hTgt = hT;
          }
        }
        // climb FIRST on the (flat, known) climb-out heading when the leg
        // needs more altitude than we have — the belt south of the corridor
        // rises faster than any of the fleet can climb head-on
        ap.targetDir = (hTgt - cg[1] > 60 && ap.holdDir) ? ap.holdDir : fixDir;
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -4.5, 2.2)));
        airLateral();
        if (fDist < 600) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;
      }

      case 'TURNBACK':
        speedThrottle(A.VTurn ?? ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        headingCapT = Math.abs(e) < 0.12 ? headingCapT + dt : 0;
        if (headingCapT > 1.5) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;

      case 'INBOUND': {
        // THE LITERAL 24 IS THE CUB FAMILY'S, and it stays. It is that
        // aeroplane's own (VCruise+VAppr)/2 = 23.75 frozen into the
        // autopilot, and cub/pa18/drone genuinely fly it — note TURNBACK
        // above falls back to VCruise instead, so those three fly 26/26/13
        // on the turnback and 24 on the inbound, and no single VTurn key can
        // say that. Stating one in the fiches to "make the default explicit"
        // was tried and MOVED THE FLEET (drone elevator chatter 0.3 ->
        // 5.5 deg/s, M3 stop 1 m, PA18 stop 5 m).
        //
        // What was actually wrong is that GENERATED fiches never set VTurn
        // either, so every garage build was commanded the Cub's 24 whatever
        // it was: 0.6x trim on a 39 m/s build (throttle to the floor, 100 m
        // lost over the leg, the last 1.5 km at 1 m agl) and 1.04x on a
        // 23 m/s one (full throttle, float, touch 240 m past the aim). Both
        // reported symptoms, one constant. genTuneAP now emits VTurn, so
        // this fallback is reached only by the family it was tuned on.
        speedThrottle(A.VTurn ?? 24);
        const d = ap.xAim - sAl;
        // Math.max(0, d): past the aim the raw slope target dives below
        // the field and INBOUND flew into the dirt (W14, Stein return
        // leg). No-op before the aim, i.e. for every nominal arrival.
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        // descend toward just-above-slope when arriving HIGH (cross-country
        // over the belt): min() is a no-op for standard circuits, which fly
        // level at hCruise below the slope until it comes down to them
        const hTgt = Math.min(ap.altRef + ap.hCruise, hGS + 15);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -3.5, 2.2)));
        airLateral();
        // in wind: align laterally BEFORE descending (localizer before
        // glideslope) — the turnback exits ~1.2-1.6 km off centreline and a
        // capture flown inside the descent runs out of approach (Jodel landed
        // 16 m off, DC-3 10 m). Calm-air condition untouched.
        // NOTE: no align-before-descend gate. It was tried and is geometrically
        // a trap here: the level alignment leg makes the descent start above
        // the slope by gs*(leg length), which the catch-up authority cannot
        // recover (Jodel/DC-3 landed 0.6-1.1 km long). In-descent capture
        // works once the course loop carries a slip trim (see airLateral).
        // the <40 bound keeps a high cross-country arrival in INBOUND (still
        // descending) instead of engaging APPROACH far above the slope;
        // standard circuits switch from BELOW (cg-hGS ~ -2), unaffected
        if (d > 0 && hGS <= cg[1] + 2 && cg[1] - hGS < 40) { ap.phase = 'APPROACH'; phaseT = 0; SV.thrC = A.thrAppr; }
        // PAST THE AIM AND STILL AIRBORNE (W19). hGS collapses to refAlt here
        // (the Math.max above), hTgt becomes refAlt+15, and the handoff is
        // gated on d > 0 — so this state could never leave INBOUND. The
        // aeroplane levelled at 15 m agl and flew straight ahead for ever.
        // FLEET-UNREACHABLE: every fiche hands off at d = hCruise/gs, i.e.
        // 800-4200 m before the aim.
        else if (d <= 0) {
          if (agl < A.flareAgl * 3 || (ap.gaN || 0) >= 2) {
            ap.phase = 'APPROACH'; phaseT = 0; SV.thrC = A.thrAppr;   // low: just land it
          } else goAround('past-aim');
        }
        break;
      }

      case 'APPROACH': {
        speedThrottle(ap.VAppr);
        const d = ap.xAim - sAl;
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        // catch-up clamp scales with the aircraft's own slope rate: a flat
        // -3.0 gave the DC-3 (nominal -2.6 m/s on its slope) only 0.4 m/s of
        // authority to descend back onto the slope from above
        // feedforward uses GROUNDSPEED (W13.2): the slope is fixed in the
        // ground frame — -V*gs in a headwind commands W*gs too much sink
        // and the +0.5 recovery clamp cannot close the standing low (the
        // PA-18 crossed the Stein threshold 5.6 m under the slope and
        // touched 83 m short of the aim). Identical in calm (Vg = V).
        holdVS(clamp(-(o_.Vg ?? V) * ap.gs + 0.12 * (hGS - cg[1]), Math.min(-3.0, -1.6 * V * ap.gs), 0.5));
        airLateral(0.18);
        // W19 missed approach: HIGH ON THE SLOPE, sustained. Measured fleet
        // margin — cub 3.2 m, pa18 5.5 m, drone 26.2 m above the slope at
        // worst, against 60. INBOUND only hands over inside 40 m of the
        // slope, so reaching 60 means it climbed away from it.
        //
        // AN OVERSPEED TRIGGER WAS TRIED AND REMOVED. `V > 1.35*VAppr` looks
        // obviously safe and is not: the drone's INBOUND rides the literal 24
        // against a VAppr of 9, so it enters APPROACH at 1.48 and fired TWO
        // go-arounds on a gate that had passed for years. A genuine float is
        // caught by the FLARE timeout below, which needs no speed threshold.
        gaT = cg[1] - hGS > 60 ? gaT + dt : 0;
        if (gaT > 5 && (ap.gaN || 0) < 2) { goAround('high'); break; }
        if (agl < A.flareAgl) { ap.phase = 'FLARE'; phaseT = 0; thFlare0 = th; }
        break;
      }

      case 'GOAROUND':
        // Deliberately dull: it reuses the CLIMB laws, then rejoins the circuit
        // OUTBOUND (dirX -1, trackHold on) so CRUISE -> TURNBACK -> INBOUND
        // re-flies the whole arrival, including a fresh enterArrival(). Flaps
        // come up by themselves — the schedule at the foot of update() targets
        // 0 outside APPROACH/FLARE.
        c.thr = 1; c.brake = 0;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral(0.20);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || (phaseT > 60 && vsSlow < 0.15)) {
          ap.phase = 'CRUISE'; phaseT = 0;
          ap.dirX = -1; ap.trackHold = true;
          SV.thrC = A.thrCruise; SV.thcI = 0.04;
        }
        break;

      case 'FLARE':
        c.thr = A.flareThr ?? 0;
        // W19: a flare that will not end is a float. The fleet flares for ~3 s
        // (flareAgl is 3.2 s of sink by construction), so 20 s cannot happen
        // to them.
        if (phaseT > 20 && (ap.gaN || 0) < 2) { goAround('float'); break; }
        if (A.flareMode === 'vs') {
          // sink-rate-targeted flare (needs a fast VS loop)
          holdVS(-(0.15 + 0.28 * Math.max(0, agl)), A.flareThMax ?? A.thMax);
        } else {
          // progressive attitude ramp toward the arrival attitude
          holdPitch(Math.min(thFlare0 + A.flareRate * phaseT, A.flareThMax ?? A.thMax));
        }
        // crosswind decrab: below decrabAgl, the rudder aligns the nose with
        // the runway while airLateral keeps killing drift with bank (slip).
        // Inactive in calm air (windZ gate) — zero-wind identity preserved.
        // B3: THE RUDDER WENT THE WRONG WAY — -K x (the nose's angle from the
        // runway) where the ground steer, and 43 since G381, fly -K x e (e =
        // the runway's angle from the nose): a crab became a swing in the
        // hold-off. B4: armed on the STRIP-FRAME crosswind (it read the
        // world's z, so only an x-aligned strip ever decrabbed). The law is
        // the module's (39b_servos.js decrab: G381's sign, G970's integral)
        if (SV.decrabArmed(agl, F)) SV.decrab(0.12);
        else airLateral(0.10);
        if (onG > 0) {
          ap.phase = 'ROLLOUT'; phaseT = 0;
          ap.tdInfo = { sink: -vcg[1], z: sCr, x: sAl, V,
                        drift: -vcg[0] * F.uz + vcg[2] * F.ux };
        }
        break;

      case 'ROLLOUT': {
        c.thr = 0;
        if (A.rolloutMode === 'trike') {
          if (V > (A.VDerotate ?? 20)) holdPitch(A.rolloutTh ?? 0.035);
          else c.de = 0.15;
        // VTailDown (default VTailUp): below it, stick hard back pins the tail.
        // Flapped taildraggers set it above touchdown speed — flap lift +
        // nose-down dCm0 make the tail-up wheel-landing hold noseover-prone.
        // thPinMax guard (W13.2): full-aft AT TOUCH SPEED with flaps out
        // re-flies the aircraft — the PA-18 ballooned to 3 m agl / 18 deg
        // nose-up for 4 s after every touchdown (traced at Stein; HOME's
        // 1100 m simply absorbed it). Relax the pin while the nose is
        // above ~3-point attitude; identical otherwise (rest deck ~0.21).
        // VPinFull (default 0 = old behavior): above it, only moderate aft
        // — the full pin AT touch speed is itself the re-launch impulse;
        // brakes engage far below it, so the noseover guard window holds.
        } else c.de = V > (A.VTailDown ?? A.VTailUp) ? -0.05
                    : (th > (A.thPinMax ?? 0.26) ? 0.05
                    : V > (A.VPinFull ?? 0) ? 0.14 : 0.35);
        // brakes act on WHEELS: thresholds are groundspeed, not airspeed
        if (Vg < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        groundSteer();
        if (Vg < A.VStop) { ap.phase = 'STOPPED'; phaseT = 0; }
        break;
      }

      case 'STOPPED':
        c.thr = 0; c.de = 0.35; c.brake = 0.25; c.da = 0; c.dr = 0;
        break;
    }
    // flaps: phase-scheduled, rate-limited (flaps travel over seconds, and the
    // slow deployment is what lets holdPitch absorb the nose-down dCm0 step).
    // Retracted for the rollout: weight back on the wheels for brake grip.
    const FS = def.params.flaps;
    if (FS) {
      const tgt = ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (FS.ldg ?? 1)
                : ap.phase === 'ROLL' || ap.phase === 'LIFTOFF' ? (FS.to ?? 0)
                : 0;
      const rr = (FS.rate ?? 0.15) * dt;
      c.flap = clamp(c.flap + clamp(tgt - c.flap, -rr, rr), 0, 1);
    }
    // servo slew limits
    SV.slew();
    SV.endStep();   // W14: per-frame resync bookkeeping
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl,
               xt: taxiXT, sRem: taxiSRem, tailUp: tailUpNow };   // G193
  };
  return ap;
}

