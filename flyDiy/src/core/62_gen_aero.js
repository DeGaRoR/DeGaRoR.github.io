// ============================================================
// GARAGE 3/5 — the AERO. Frame -> strips, polars and params.
//
// The polars are SYNTHESISED, not looked up: the same NACA digits that shape
// the visible wing section produce the six numbers the solver's polar()
// wants. That is the single root extended to aerodynamics — there is no
// airfoil table to keep in step with the geometry.
//
// The synthesis is anchored on the hand-written fleet: the tail model
// reproduces POLARS.flat_tail_cub to two decimals (a3d 3.34 vs 3.4,
// aStall 0.239 vs 0.24) and the Cd0 model reproduces the Cub's 0.010 and the
// C172's 0.008. Those agreements are the reason the constants are what they
// are; they are not free parameters.
// ============================================================

// Thin-airfoil theory on the NACA 4-digit mean line, integrated numerically
// (closed forms exist per branch, but the integral is 3 lines and exact for
// any m/p). Returns the zero-lift angle in radians and Cm about c/4.
function genThinAirfoil(m, p) {
  if (m <= 0) return { aL0: 0, Cm0: 0 };
  const NS = 400;
  let i0 = 0, i1 = 0, i2 = 0;
  for (let i = 0; i < NS; i++) {
    const th = (i + 0.5) * Math.PI / NS, x = 0.5 * (1 - Math.cos(th));
    const dz = x <= p ? (2 * m / (p * p)) * (p - x)
                      : (2 * m / ((1 - p) * (1 - p))) * (p - x);
    const dth = Math.PI / NS;
    i0 += dz * (1 - Math.cos(th)) * dth;
    i1 += dz * Math.cos(th) * dth;
    i2 += dz * Math.cos(2 * th) * dth;
  }
  const aL0 = i0 / Math.PI;                       // negative for positive camber
  const A1 = (2 / Math.PI) * i1, A2 = (2 / Math.PI) * i2;
  return { aL0, Cm0: (Math.PI / 4) * (A2 - A1) };
}

// 2D lift slope. kVisc 0.845 is the fleet-fitted viscous deficit: reconstructing
// a0 from the registry's (a3d, eAR) pairs gives 5.7-5.9 /rad across cub, jodel
// and c172, not the 2*pi of inviscid theory.
const GEN_KVISC = 0.845;

// Oswald efficiency, Raymer's straight-wing estimate, times a bracing penalty
// (a strut and its fairing spoil the span loading near the attach).
function genOswald(AR, strut, tipE) {
  const e = 1.78 * (1 - 0.045 * Math.pow(AR, 0.68)) - 0.64;
  // the tip treatment multiplies span efficiency BEFORE the cap: a winglet on
  // an already-efficient wing cannot conjure e past the Raymer ceiling
  return Math.min(0.95, Math.max(0.55, e * (strut ? 0.90 : 1.0) * (tipE || 1)));
}

// naca: 4-digit code; AR/taper/strut: planform; finish: material cd0 penalty.
function genPolar(naca, AR, strut, matCd0, clmaxK, sweepDeg, tipE) {
  const { m, p, t } = nacaParts(naca);
  const { aL0, Cm0 } = genThinAirfoil(m, p);
  // Simple-sweep theory: only the velocity component NORMAL to the quarter
  // chord line does the lifting, so the section lift slope and the maximum lift
  // both go with cos(sweep). It depends on |sweep| — forward sweep costs
  // exactly as much as aft, which is the honest reason forward sweep is not a
  // free way to move the CG.
  const cosL = Math.cos((sweepDeg || 0) * Math.PI / 180);
  const a0 = 2 * Math.PI * GEN_KVISC * (1 + 0.77 * t) * cosL;
  const eAR = Math.PI * genOswald(AR, strut, tipE) * AR;
  const a3d = 1 / (1 / a0 + 1 / eAR);
  const Cl0 = a3d * (-aL0);
  const ClMax = (1.38 + 5.0 * m + 1.2 * (t - 0.12)) * clmaxK * cosL;
  return {
    a3d, Cl0, aStall: Math.max(0.16, (ClMax - Cl0) / a3d),
    Cd0: 0.0055 + 0.018 * t + matCd0, eAR, Cm0,
    _ClMax: ClMax,
  };
}

// Tail sections are symmetric and thin; e is 0.70 across the whole fleet.
function genTailPolar(AR, matCd0) {
  const t = 0.09;
  const a0 = 2 * Math.PI * GEN_KVISC * (1 + 0.77 * t);
  const eAR = Math.PI * 0.70 * AR;
  const a3d = 1 / (1 / a0 + 1 / eAR);
  return { a3d, Cl0: 0, aStall: 0.80 / a3d, Cd0: 0.0055 + 0.018 * t + matCd0,
           eAR, Cm0: 0 };
}

// ---------------------------------------------------------------------------
// Strips. Two per wing bay per side, plus one over the cabin; two per stab
// panel; one fin. Attach weights put the quarter chord where it belongs
// between the two spars, exactly as the hand fiches do.
// ---------------------------------------------------------------------------
function genStrips(S, fr) {
  const P = fr.parts, R = GEN_RULES, strips = [];
  const PP = POWERPLANTS[S.engine];
  const Reff = (PP.prop.D / 2) * R.washSpread;
  // fraction of propwash a strip at |z| sees; fitted to the Cub's hand values
  // (centre strip 1.0, first outboard strip 0.5, everything beyond 0)
  const washAt = z => Math.max(0, 1 - (z / Reff) * (z / Reff));
  // c/4 between the spars: weight the front spar by how far the quarter chord
  // sits from the rear one
  const cf = (P.sparRear - 0.25) / (P.sparRear - P.sparFront), cr = 1 - cf;
  const semi = S.geom.semi;
  // where the surfaces live along the semispan. The aileron is measured inboard
  // from the tip, the flap outboard from the centreline, and clampSpec has
  // already guaranteed a gap between the two.
  const CT = S.controls;
  const aStart = (1 - CT.aileron.span) * semi;
  const fEnd = GEN_FLAPS[CT.flap.type].dCl > 0 ? CT.flap.span * semi : -1;

  const zAll = [P.zRoot, ...P.zs];
  for (const [side, fw] of [[1, P.wf.R], [-1, P.wf.L]]) {
    for (let b = 0; b < P.zs.length; b++) {
      const zi = zAll[b], zo = zAll[b + 1];
      for (const t of [0.28, 0.78]) {
        const zc = zi + (zo - zi) * t;
        const ch = P.chordAt(zc);
        // Each strip is HALF a bay, so it has a real sub-span, and `flap` is a
        // FRACTION rather than a flag: how much of this strip carries a flap.
        // With a bare flag the span slider quantised — 0.50 and 0.62 produced
        // the identical aeroplane because they caught the same strip centres.
        const zLo = t < 0.5 ? zi : 0.5 * (zi + zo);
        const zHi = t < 0.5 ? 0.5 * (zi + zo) : zo;
        const fFrac = fEnd <= zLo ? 0
                    : fEnd >= zHi ? 1
                    : (fEnd - zLo) / (zHi - zLo);
        strips.push({
          kind: 'wing', side, t, chord: ch,
          area: 0.5 * (zo - zi) * ch,
          fIn: fw.F[b], fOut: fw.F[b + 1], rIn: fw.R[b], rOut: fw.R[b + 1],
          w: [[fw.F[b], cf * (1 - t)], [fw.F[b + 1], cf * t],
              [fw.R[b], cr * (1 - t)], [fw.R[b + 1], cr * t]],
          wash: washAt(zc), ail: zc > aStart ? 1 : 0, flap: fFrac,
        });
      }
    }
  }
  // Centre section over the cabin: one strip, fully in the slipstream. It hangs
  // off the WING's own spar roots, not the fuselage frames — otherwise the
  // centre section's lift stays behind when the wing is moved.
  const cL = P.wf.L, cR2 = P.wf.R;
  strips.push({
    kind: 'wing', side: 1, t: 0.5, chord: S.wing.chord,
    area: 2 * P.zRoot * S.wing.chord,
    fIn: cL.F[0], fOut: cR2.F[0], rIn: cL.R[0], rOut: cR2.R[0],
    w: [[cL.F[0], cf * 0.5], [cR2.F[0], cf * 0.5],
        [cL.R[0], cr * 0.5], [cR2.R[0], cr * 0.5]],
    wash: 1, ail: 0, flap: 0,
  });

  const hc = S.tail.hChord;
  if (S.tail.type === 'v') {
    // Two canted panels, and no fin. Each carries the TRUE panel area (not the
    // horizontal projection) — the cant is in the strip's normal, so the
    // solver resolves pitch and yaw from the geometry rather than from a pair
    // of book-keeping areas that could disagree with it.
    const cV = Math.cos(S.tail.vG), sV = Math.sin(S.tail.vG);
    for (const [H, side] of [[P.HTL, -1], [P.HTR, 1]]) {
      strips.push({ kind: 'vtail', side, cosV: cV, sinV: sV,
        area: 0.565 * S.tail.Svt / 2, chord: hc,
        wash: R.stabWash, w: [[H, .50], [P.TPB, .30], [P.TPT, .20]] });
      strips.push({ kind: 'vtail', side, cosV: cV, sinV: sV,
        area: 0.435 * S.tail.Svt / 2, chord: hc,
        wash: R.stabWash, w: [[H, .25], [P.TPB, .45], [P.TPT, .30]] });
    }
    return strips;
  }
  for (const [H, side] of [[P.HTL, -1], [P.HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.565 * S.tail.Sh / 2, chord: hc,
      wash: R.stabWash, w: [[H, .50], [P.TPB, .30], [P.TPT, .20]] });
    strips.push({ kind: 'stab', side, area: 0.435 * S.tail.Sh / 2, chord: hc,
      wash: R.stabWash, w: [[H, .25], [P.TPB, .45], [P.TPT, .30]] });
  }
  strips.push({ kind: 'fin', area: S.tail.Sv, chord: S.tail.vChord,
    wash: R.finWash, w: [[P.FIN, .40], [P.TPT, .35], [P.TPB, .25]] });
  return strips;
}

// Body-axis CdA for the two fuselage blobs. Coefficients calibrated so the
// Cub's own geometry reproduces its hand-tuned [0.55, 0.8, 0.8] / [0, 0.5, 0.5]:
// 0.75 on max frontal area, 0.57 on forward side area, 0.31 aft (the aft body
// is tapered and cleaner, which is why the two are not the same number).
function genFusCdA(S, fr) {
  const ST = fr.parts.ST;
  let frontal = 0, sFwd = 0, sAft = 0;
  for (const s of ST) frontal = Math.max(frontal, 2 * s.w * (s.yt - s.yb));
  for (let i = 0; i < ST.length - 1; i++) {
    const a = ST[i], b = ST[i + 1];
    const A = 0.5 * ((a.yt - a.yb) + (b.yt - b.yb)) * (b.x - a.x);
    if (i < 2) sFwd += A; else sAft += A;
  }
  return {
    fusCdA: [0.75 * frontal, 0.57 * sFwd, 0.57 * sFwd],
    fusCdAAft: [0, 0.31 * sAft, 0.31 * sAft],
  };
}

// Autopilot block. Speeds come from the aeroplane's OWN stall speed; the
// remaining ratios and gains are the Cub's, which is the airframe timescale
// (span/V ~ 0.4 s) this family sits at. HANDOVER "AUTOPILOT RULES": D-gains
// scale with that timescale, so they are rescaled rather than copied.
const GEN_VRATIO = {
  VRot: 0.99, VClimbMin: 1.32, VClimb: 1.38, VCruise: 1.71,
  VAppr: 1.42, VApprShort: 1.24, VTailUp: 0.79, VBrakeOn: 0.59,
};
const GEN_TAU_REF = 10.0 / 26.0;      // Cub span / VCruise

function genAP(S, Vs, mass) {
  const V = k => Math.round(GEN_VRATIO[k] * Vs * 10) / 10;
  const tau = S.wing.span / (GEN_VRATIO.VCruise * Vs);
  const kD = tau / GEN_TAU_REF;
  // A tricycle lands and rolls out differently: there is no tail to fly down,
  // so the AP de-rotates onto the nosewheel instead of pinning a tailwheel.
  // VTailUp 99 disables the taildragger's tail-up logic outright (C172 fiche).
  const trike = S.gear.type === 'tricycle';
  const trikeAP = trike ? {
    rolloutMode: 'trike', VDerotate: Math.round(0.58 * GEN_VRATIO.VCruise * Vs),
    rolloutTh: 0.035, VTailUp: 99,
  } : {};
  return Object.assign({
    VRot: V('VRot'), VClimbMin: V('VClimbMin'), VClimb: V('VClimb'),
    VCruise: V('VCruise'), VAppr: V('VAppr'), VApprShort: V('VApprShort'),
    VTailUp: V('VTailUp'), VBrakeOn: V('VBrakeOn'),
    // PROVISIONAL. Everything below the speeds is overwritten by genTuneAP once
    // the tunnel has run (64_gen_build.js) — these values only have to be sane
    // enough for the probe pass itself, which reads VCruise, VClimb and VRot.
    TORun: 60,                    // replaced by the analytic estimate in 64
    rollD: 0.8 * kD,
    hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
    rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
    thMax: 0.20, flareAgl: 4.8, flareRate: 0.062, aglGuard: 3,
    VStop: 0.4, slew: 1.5, thrCruise: 0.70, thrAppr: 0.35,
    brakeMax: 0.30, brakeRampRate: 0.12, VBrakeRelease: 1.5,
    _mass: mass,
  }, trikeAP);
}

// ---------------------------------------------------------------------------
// OUTER-LOOP SYNTHESIS — pass B, after the tunnel.
//
// genAP above only knows the geometry. Everything here needs the aeroplane's
// own drag polar, its approach trim, its stall attitude and what it can climb,
// so it runs from genTrim once those are measured (64_gen_build.js).
//
// WHY IT EXISTS. genAP emitted 34 keys; the autopilot dereferences 69. The
// other 35 fell through to `??` defaults in 40_autopilot.js, and those defaults
// are the CUB's — as were the dozen circuit constants genAP hardcoded. So a
// 1200 kg, 43 m/s, L/D 6.3 aeroplane flew the Cub's 100 m circuit, the Cub's
// 4.5 degree slope, the Cub's 150 m pursuit lookahead and the Cub's 0.30 bank
// limit. Measured consequences, before this: a short-span build spent 286 s
// stuck in CLIMB never reaching 100 m; a big slow one touched 240 m past the
// aim with the throttle on its floor for 62% of the descent; a flapped one
// crossed the fence at 0.92 Vs.
//
// METHOD is the one GEN_LOOP used a few lines up: propose a DIMENSIONLESS
// ratio, tabulate the seven hand fiches, and adopt it only if it CLUSTERS.
// Where it does not cluster that is said out loud and a stated fallback is
// taken, rather than a fleet mean dressed up as physics. Scatter quoted per
// line is measured across the fiches' own blocks.
// The four fiches that set bankLim cluster 0.42-0.48; 0.40 is deliberately
// inside them, because a generated wing may have poor roll authority. It is a
// module constant because the circuit geometry has to size the turnback against
// it before the lateral block runs.
const GEN_BANKLIM = 0.40;

function genTuneAP(def) {
  const A = def.params.ap, g = def.params.gen, S = def.spec;
  const cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const r3 = x => Math.round(x * 1000) / 1000;
  const trike = S.gear.type === 'tricycle';

  // The gain placement has to be REDONE here. genPlant scales every derivative
  // with q = rho V^2 / 2, so the gains genParams placed at the provisional
  // cruise speed are simply wrong once the power curve moves it.
  const pl = genPlant(def.nodes, def.strips, def.params, A.VCruise);
  Object.assign(A, genGains(pl, def.params));
  g.plant = pl;
  // the two loops' natural frequencies, which set every servo rate below
  const wRoll = Math.sqrt(Math.max(1e-9, pl.Lda * A.rollP / pl.Ixx));
  const wPitch = Math.sqrt(Math.max(1e-9, pl.Mde * A.pitchP / pl.Iyy));

  // ---- speeds ------------------------------------------------------------
  // VTurn: fiche/midpoint 1.089 .950 .962 .947 -> 0.987 +/- 0.067, the TIGHTEST
  // ratio in the whole set, and it retrodicts the literal 24 that used to sit
  // in INBOUND (the Cub's own midpoint is 23.75). VTurn/VCruise scatters
  // 0.73-0.95 and VTurn/VAppr 1.19-1.36; the midpoint beats both.
  A.VTurn = Math.round(0.5 * (A.VCruise + A.VAppr) * 10) / 10;
  // VBrakeOn/Vs scatters 0.47-1.01 — WEAK (2.1x). 0.59 was at the late-braking
  // edge of it; 0.75 is the fleet median. Flagged as low-confidence.
  A.VBrakeOn = Math.round(0.75 * g.Vs * 10) / 10;

  // ---- energy: the decel-margin chain ------------------------------------
  // Steady descent on slope gs needs thrust D - W*gs. If that is below the
  // throttle floor the aeroplane accelerates for ever, which is the documented
  // DC-3/Jodel/C172 float. So the floor comes first, then the slope under it.
  //
  // thrFloor: idle thrust as a fraction of weight reads 0.0125 +/- 0.0035
  // across the four fiches that bother to set thrFloor. Back-substituted this
  // gives cub .057 dc3 .064 c172 .055 jodel .049 — i.e. it lands on their tuned
  // ~0.05 — and it fixes the drone, whose inherited 0.12 is 8% of its weight
  // and by itself makes any commanded slope steeper than its idle equilibrium.
  A.thrFloor = r3(cl(0.012 * g.W / Math.max(1, g.TavailAppr), 0.03, 0.12));
  const gsIdle = g.dragAppr / g.W - A.thrFloor * g.TavailAppr / g.W;
  // gs/gsIdle across the fleet: 0.574 +/- 0.13, or 0.532 +/- 0.10 excluding the
  // flapless Cub — whose 0.822 is exactly why it floats 90 m off a 340 m strip.
  A.gs = r3(cl(0.55 * gsIdle, 0.035, 0.10));
  // thrAppr is EXACT, not a fit: it is the throttle that trims the approach.
  // Every fiche's hand value sits within speedThrottle's +-0.30 integrator band
  // of its true one — "close enough by hand". A generated build whose true
  // approach throttle is 0.75 cannot get there from a 0.35 bias.
  A.thrAppr = r3(cl((g.dragAppr - g.W * A.gs) / Math.max(1, g.TavailAppr),
                    A.thrFloor, 0.85));

  // ---- attitude family, all anchored on the measured stall attitude -------
  // thMax/aStall = 0.672 +/- 0.043 (6%) over six fiches; the drone's 0.917 is
  // the outlier and is excluded.
  A.thMax = r3(cl(0.67 * g.aStall, 0.13, 0.26));
  // climbThBase/thMax = 0.594 +/- 0.028 (4.7%) — the tightest ratio here.
  // The physically obvious alpha(VClimb) + gammaClimb form fits WORSE (0.25 to
  // 0.75) because the probe has no propwash; the stall attitude is the right
  // normaliser, not the climb performance.
  A.climbThBase = r3(0.60 * A.thMax);
  // climbThGain*VClimb scatters 0.30-0.92 (3x): NO CLUSTER. The 1/V form at
  // least gets the trend right, and the old flat 0.030 sits inside the clamp.
  A.climbThGain = r3(cl(0.7 / A.VClimb, 0.012, 0.032));
  // liftoffTh/thMax = 0.790 +/- 0.048 (6%), additionally capped below the
  // three-point deck: doctrine, "a taildragger cannot rotate past 3-point".
  let liftoff = 0.79 * A.thMax;
  if (!trike) {
    const P = def.parts, G = S.gear;
    const twN = def.nodes[P.TW];
    const deck = Math.atan((((twN && twN.p[1]) || 0) - G.twR - (G.y - G.contactR))
                           / Math.max(0.1, P.twX - P.gx));
    if (isFinite(deck) && deck > 0.05) liftoff = Math.min(liftoff, 0.85 * deck);
  }
  A.liftoffTh = r3(liftoff);
  // flareThMax - alpha(1.10 VsFlap) = -0.056 +/- 0.031 on six of seven. The
  // SIGN is the doctrine ("flareThMax BELOW the L=W attitude kills float");
  // the chinook is the outlier because its body datum puts that alpha near 0.
  A.flareThMax = r3(Math.min(A.thMax, g.alphaTD - 0.055));
  // vsFloor is a REACHABILITY condition, not a fit. holdVS clamps the pitch
  // COMMAND to [vsFloor, thMax], so a floor above the attitude level flight
  // needs means the aeroplane climbs for ever — written out verbatim in the
  // chinook fiche, whose -0.017 margin is exactly why it was marginal.
  // Erring low is free; erring high is the reported bug.
  A.vsFloor = r3(cl(Math.min(g.alphaAppr - A.gs, g.alphaCruise - 2.2 / A.VCruise)
                    - 0.05, -0.30, -0.03));
  // flareAgl/(VAppr*gs) = 3.21 +/- 0.38 (12%): every fiche begins its flare
  // about 3.2 SECONDS before impact. Raw flareAgl scatters 4.5x.
  A.flareAgl = r3(cl(3.2 * A.VAppr * A.gs, 1.5, 12));
  // THE RAMP HAS TO GET THERE. flareAgl buys about 3.2 s, but a ramp that only
  // just reaches flareThMax at the end of it spends the whole flare short of
  // the attitude it is aiming for, and the aeroplane arrives still descending —
  // measured 2.5-3.5 m/s across the faster half of the envelope. Sizing the
  // rate to reach the flare attitude in 1.5 s and hold it there is worth
  // 1.3-1.9 m/s of sink on the same builds.
  //
  // MEASURED AND REJECTED: switching generated fiches to flareMode 'vs', which
  // is what drone/Jodel/C172/Chinook all carry. It made every sink WORSE
  // (stock 1.13 -> 1.63, heavyLoad 2.53 -> 3.39, flapped 2.58 -> 3.10) even
  // with the VS loop moved onto the fast family to fly it. The attitude ramp
  // stays.
  A.flareRate = r3(cl((A.flareThMax - (g.alphaAppr - A.gs)) / 1.5, 0.02, 0.30));

  // ---- circuit geometry --------------------------------------------------
  // hCruise/Vs = 7.70 +/- 1.1 (14%); hCruise/VCruise is worse (26%). 7.0 is
  // the light-aeroplane end of that band (cub 6.67, jodel 6.93, c172 7.56).
  // CAPPED BY WHAT IT CAN CLIMB: CLIMB only ever exits on reaching hCruise-8,
  // so a circuit height the aeroplane cannot reach is an infinite climb. 90 s
  // of climb at its own measured gradient is the budget.
  A.hCruise = Math.round(cl(Math.min(7.0 * g.Vs, 90 * A.VClimb * g.gammaClimb),
                            40, 220) / 5) * 5;
  A.hSafe = Math.round(cl(0.125 * A.hCruise, 6, 40));      // 0.124 +/- 0.014
  A.aglGuard = r3(cl(0.185 * A.hSafe, 1.5, 8));            // 0.183 +/- 0.027
  // xAim does NOT cluster against speed, mass or Vs — the only fiche that moved
  // it (DC-3) moved it to buy stopping room. So keep the constant and let the
  // cross-country clamp in the autopilot handle short strips.
  // xTurn: (|xTurn|-|xAim|)/(hCruise/gs) = 1.16 +/- 0.22 ex-drone. What that
  // ratio really encodes is the height above the slope at INBOUND entry, which
  // is -50..+25 m across the whole fleet: everyone turns in essentially ON the
  // slope. 1.2 keeps a generated build on the slightly-LOW side, which
  // INBOUND's level-until-intercept handles and the high side does not.
  // SECOND TERM: the descent is not the only thing that has to fit. TURNBACK is
  // a 180 at VTurn against bankLim, so the leg also has to be long enough to
  // fly that turn AND then capture the centreline from ~2R off it. Without it a
  // fast build simply runs out of circuit — measured 1037 m of cross-track at
  // touchdown on the radial build. bankLim is set below but is a constant, so
  // it is named here rather than read.
  const Rturn = A.VTurn * A.VTurn / (9.81 * Math.tan(GEN_BANKLIM));
  A.xTurn = Math.round(Math.min(A.xAim - 1.2 * A.hCruise / A.gs,
                                A.xAim - 4.0 * Rturn, -900));

  // ---- guidance and lateral ----------------------------------------------
  // NO CLEAN INVARIANT EXISTS for the cruise lookahead. Time scatters 5.8-15.5 s
  // (2.7x) and the doctrine's own turn-radius form is WORSE (5.7x) — the DC-3
  // and the C172 have the same speed (58) and the same turn radius (710) and
  // lookaheads of 900 against 450. The discriminator is roll-loop speed, but
  // L*wRoll/V scatters 23-176. So: fleet median, stated as such, and gated.
  A.lookCruise = Math.round(cl(8 * A.VCruise, 120, 1000));
  A.lookAppr = Math.round(A.lookCruise / 1.45);   // lookC/lookA 1.466 +/- 0.065
  A.lookRoll = Math.round(cl(1.2 * A.VRot, 20, 60));         // 1.12 +/- 0.13
  A.hdgP = 0.65;                                   // constant, fleet 0.6-0.9
  A.hdgD = r3(1.35 * A.hdgP);                      // hdgD/hdgP 1.39 +/- 0.18
  A.bankLim = GEN_BANKLIM;
  A.bankSlew = r3(cl(0.05 * wRoll, 0.05, 0.8));    // 0.048 +/- 0.021
  A.betaK = 0.30;                                  // 0.30 on all seven, exact
  A.yawDampK = 0.40;                               // no cluster; setters .30-.45
  // ARI is DESTABILIZING on high effective dihedral (Jodel's 14 degree crank
  // runs ariK 0, proven by ablation). A garage wing reaches 6 degrees plus a
  // crank plus dihedralOut, so fade it out rather than inherit the Cub's 0.35.
  const dih = (S.wings && S.wings[0] ? S.wings[0].dihedral : 0) || 0;
  A.ariK = dih > 4 ? 0 : 0.15;

  // ---- servo and filters -------------------------------------------------
  // Doctrine: "wrong-scale D-gains create slew-rate limit cycles; the cure is
  // always LOWER D + command slew, not more filtering." Both rates therefore
  // scale with the pitch loop the plant actually has.
  A.slew = r3(cl(0.40 * wPitch, 0.5, 3.0));        // slew/wPitch 0.39 +/- 0.10
  A.pitchCmdSlew = r3(cl(0.16 * wPitch, 0.2, 2.0));// 0.16 +/- 0.03 over 4 setters
  A.rateFilt = 0.15;    // fleet 0.12-0.20; NOT faster — a faster filter was
  A.attFilt = 0.70;     // measured to make the limit cycle worse (W16)
  A.altVSGain = 0.08;   // no cluster; six of seven sit in 0.06-0.10
  // vsI/vsP = 2.01 +/- 0.51 (adopt), but the ABSOLUTE value has no cluster at
  // all (V*vsI spreads 6x). The fleet splits by flare type: attitude-ramp
  // flares run slow VS loops (0.39-0.58), VS-targeted ones fast (0.72-2.44).
  // A generated fiche flies the attitude-ramp flare (see flareRate above), so
  // it belongs to the SLOW half of that split: target w_vs ~ 0.5 rad/s, capped
  // at wPitch/7 for loop separation. A bounded choice, not a fit.
  A.vsI = r3(Math.min(0.5, wPitch / 7) / A.VCruise);
  A.vsP = r3(A.vsI / 2);
  A.vsFilt = 0.5;

  // ---- ground ------------------------------------------------------------
  // rollDe has no cluster against anything measured; the only structure in the
  // fleet is trike-vs-taildragger, so take that and stop.
  A.rollDe = trike ? 0.02 : 0.10;
  if (def.params.flaps && !trike) {
    // the PA-18's documented cure: flap lift plus the nose-down dCm0 make a
    // tail-up wheel-landing hold noseover-prone, so pin the tail from touchdown
    A.VTailDown = 99;
    A.VPinFull = Math.round(1.05 * g.VsFlap * 10) / 10;
  }
  return A;
}

// ---------------------------------------------------------------------------
// SUBSTEPS. The solver is explicit, so the timestep has to suit the stiffest
// oscillator in the structure — which is why the hand fiches carry 24 (Cub),
// 48 (Jodel) and 72 (DC-3) rather than one number. A generated airframe picks
// its own material and its own stiffness scale, so it has to work this out.
//
// Two limits, and the DAMPING one binds first in practice. Measured on the
// fleet at their own substep counts: worst omega*dt is 0.50 (Jodel) and worst
// c*dt is 0.73 (Cub) — both stable. Spruce+ply on the Cub's 24 substeps ran at
// omega*dt 0.615 and c*dt 0.947 and diverged, which is the whole bug.
// The bounds below sit just inside the fleet's proven envelope.
const GEN_WDT_MAX = 0.45;      // omega * dt
const GEN_CDT_MAX = 0.65;      // damping rate * dt
function genSubsteps(nodes, beams) {
  let wMax = 0, cMax = 0;
  for (const b of beams) {
    const inv = 1 / nodes[b.a].m + 1 / nodes[b.b].m;   // 1/reduced mass
    wMax = Math.max(wMax, Math.sqrt(b.k * inv));
    cMax = Math.max(cMax, b.c * inv);
  }
  const need = Math.max(wMax / (60 * GEN_WDT_MAX), cMax / (60 * GEN_CDT_MAX));
  // floor at 24: the whole fleet's minimum, and what the gated preset runs at
  return Math.min(200, Math.max(24, Math.ceil(need)));
}

// ---------------------------------------------------------------------------
// AUTOPILOT GAIN SYNTHESIS.
//
// HANDOVER doctrine: "gains scale with airframe timescale ~ span/V", and
// wrong-scale D-gains cause slew-rate limit cycles. Taken literally that says
// omega ~ 1/tau — but reconstructing the fleet's own hand-tuned gains through a
// plant model says otherwise. omega*tau(span/V) scatters 0.6-3.6 across the
// fleet, so it is NOT the invariant. Normalise instead by the plant's OWN
// damping time constant (Ixx/-Lp for roll, Iyy/-Mq for pitch) and the
// independently-tuned fiches collapse onto two numbers per axis:
//
//   axis   omega*tau_plant                        zeta
//   roll   cub .66 jodel .49 c172 .82 dc3 .56     1.63 1.68 1.57 1.91
//          chnk .58 drone 1.30                    2.38 1.34
//   pitch  cub 1.11 jodel 1.88 c172 1.30 dc3 1.37 2.92 1.72 2.15 1.78
//          chnk 1.25 drone 1.33                   1.31 0.95
//
// A 10.9 t DC-3 and a 230 kg Chinook agreeing within a factor of 1.7 is the
// physics showing through. The targets below are those clusters' centres.
// Measured need: placement offsets barely move the loop (roll omega*tau holds
// 0.61-0.62 across every offset) — it is WING SPAN that breaks it. At 13 m the
// untuned loop fell to 0.43 with zeta 2.50, both outside everything the fleet
// has ever flown.
const GEN_LOOP = { rollWT: 0.62, rollZeta: 1.70, pitchWT: 1.30, pitchZeta: 1.90 };

// Rigid-body plant at cruise: control authority, natural damping, inertias.
// Analytic from the strips — the same model the solver integrates, so these are
// the real numbers rather than an estimate of them.
function genPlant(nodes, strips, P, V) {
  const q = 0.5 * RHO * V * V;
  let M = 0, cx = 0, cy = 0, cz = 0;
  for (const n of nodes) { M += n.m; cx += n.p[0]*n.m; cy += n.p[1]*n.m; cz += n.p[2]*n.m; }
  cx /= M; cy /= M; cz /= M;
  let Ixx = 0, Iyy = 0;
  for (const n of nodes) {
    const dx = n.p[0]-cx, dy = n.p[1]-cy, dz = n.p[2]-cz;
    Ixx += n.m * (dy*dy + dz*dz); Iyy += n.m * (dx*dx + dy*dy);
  }
  const aW = P.polarWing.a3d, aT = P.polarTail.a3d;
  // ShC and ShD are the SAME area on a conventional tail and different on a V.
  // A ruddervator DEFLECTION makes alpha in the panel's own frame, so only the
  // force needs projecting: one cos. A pitch RATE reaches the panel through its
  // tilted normal and the force is projected again: two. Using one number for
  // both would over-damp a V-tail by cos G and mis-tune its pitch loop.
  let Lda = 0, Lp = 0, ShC = 0, ShD = 0, arm = 0;
  const px = ws => { let x = 0; for (const [i, w] of ws) x += nodes[i].p[0] * w; return x; };
  for (const st of strips) {
    if (st.kind === 'wing') {
      const zc = nodes[st.fIn].p[2] + (nodes[st.fOut].p[2] - nodes[st.fIn].p[2]) * st.t;
      Lp += st.area * zc * zc;                       // roll damping, all strips
      if (st.ail) Lda += st.area * st.ail * Math.abs(zc);
    } else if (st.kind === 'stab') {
      ShC += st.area; ShD += st.area; arm += st.area * (px(st.w) - cx);
    } else if (st.kind === 'vtail') {
      const c = st.cosV;
      ShC += st.area * c; ShD += st.area * c * c;
      arm += st.area * c * c * (px(st.w) - cx);
    }
  }
  Lda *= q * aW * P.ailTau;                          // roll moment per unit da
  Lp = -(q * aW / V) * Lp;                           // negative: it damps
  const lh = arm / Math.max(1e-6, ShD);
  return { M, Ixx, Iyy, Lda, Lp, lh,
           Mde: q * ShC * aT * P.elevTau * lh,       // pitch moment per unit de
           Mq: -(q * aT * ShD * lh * lh) / V };
}

// Second-order placement: omega^2 = C*P/I and 2*zeta*omega*I = C*D - damping.
function genGains(pl, params) {
  const g = (C, D, I, wt, zeta) => {
    const tau = I / Math.max(1e-9, -D);              // plant's own time constant
    const w = wt / tau;
    const kp = w * w * I / Math.max(1e-9, C);
    // D can come out negative on a plant that already damps itself past the
    // target — that is a real answer, and asking for negative rate feedback is
    // not. Floor it.
    const kd = Math.max(0.01, (2 * zeta * w * I + D) / Math.max(1e-9, C));
    return [kp, kd, w, tau];
  };
  const [rollP, rollD] = g(pl.Lda, pl.Lp, pl.Ixx, GEN_LOOP.rollWT, GEN_LOOP.rollZeta);
  const [pitchP, pitchD] = g(pl.Mde, pl.Mq, pl.Iyy, GEN_LOOP.pitchWT, GEN_LOOP.pitchZeta);
  const r = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)) * 1000) / 1000;
  return {
    // The bounds are limit-cycle guards, not design limits: a big-span wing
    // legitimately asks for rollP ~4, and the servo slew plus the lagged rate
    // estimate are what eventually bite. Nothing in the fleet exceeds these.
    rollP: r(rollP, 0.15, 5), rollD: r(rollD, 0.02, 3),
    pitchP: r(pitchP, 0.3, 3), pitchD: r(pitchD, 0.05, 3),
    // "Trim-heavy stable aircraft need pitchI authority" (DC-3 0.05 -> 0.25).
    // A coarse fit on three points; the Cub's 0.05 is the floor by construction.
    pitchI: r(0.05 * Math.sqrt(pl.M / 377), 0.05, 0.25),
    _plant: pl,
  };
}

// Everything the fiche's params block needs, except the two numbers that can
// only come from a wind-tunnel run (stabTrim, thrCruise) — 64_gen_build.js
// measures those with sim.probe().
function genParams(S, fr, strips) {
  const M = GEN_MATERIALS[S.material];
  const G = S.geom;
  const polarWing = genPolar(S.wing.naca, G.AR, S.wing.strut, M.cd0, M.clmaxK, S.wing.sweep,
                             (GEN_TIPS[S.wing.tip] || GEN_TIPS.rounded).e);
  const hAR = S.tail.hSpan * S.tail.hSpan / S.tail.Sh;
  const polarTail = genTailPolar(hAR, M.cd0);
  const mass = fr.cg0[3];
  const ClMax3D = polarWing.Cl0 + polarWing.a3d * polarWing.aStall;
  const Vs = Math.sqrt(2 * mass * 9.81 / (1.225 * G.Sw * ClMax3D));
  const cda = genFusCdA(S, fr);
  // Control effectiveness from surface chord. The reference pairs are the
  // fleet's own calibrated numbers at the default chord fractions, so a stock
  // aeroplane reproduces them exactly and theory only supplies the trend.
  const CT = S.controls;
  const elevTau = genTauAt(CT.elevator.chord, 0.40, 0.50);
  const rudTau  = genTauAt(CT.rudder.chord,   0.42, 0.55);
  const ailTau  = genTauAt(CT.aileron.chord,  0.22, 0.35);
  // High lift. dCl scales off the reference chord the table is quoted at; the
  // pitching moment is DERIVED from the lift increment, not chosen separately
  // (see GEN_FLAP_CM — both flapped fiches agree on the ratio).
  const FL = GEN_FLAPS[CT.flap.type];
  let flaps;
  if (FL.dCl > 0) {
    const kc = genFlapTau(CT.flap.chord) / genFlapTau(GEN_FLAP_CREF);
    const dCl0 = FL.dCl * kc;
    flaps = { to: 0, ldg: 1, rate: FL.rate, dCl0,
              dCd0: FL.cd * kc, dAStall: 0.02, dCm0: GEN_FLAP_CM * dCl0 };
  }
  const P0 = { polarWing, polarTail, elevTau, ailTau };
  const ap = genAP(S, Vs, mass);
  // synthesise the attitude-loop gains from the plant this airframe actually
  // is, rather than inheriting the Cub's
  const pl = genPlant(fr.nodes, strips, P0, ap.VCruise);
  Object.assign(ap, genGains(pl, P0));
  return {
    name: S.name, viewDist: Math.max(9, 1.4 * S.wing.span),
    powerplant: S.engine,
    // HOW MANY ENGINES, which is NOT how many mount nodes. `refs.engine` is the
    // two mount points of one engine here, and the solver used to multiply
    // thrust by its length — so a generated single fell on 2x its own prop.
    // Stated explicitly rather than left to the solver's `|| 1` fallback: a twin
    // is a real aeroplane in this spec and the day `engines` has two entries
    // this must already be right.
    nEngines: S.engines.length,
    // THE PROP IS THE AEROPLANE'S, not the powerplant's. The solver prefers this
    // over POWERPLANTS[powerplant].prop when it is present, and a fiche never
    // sets it — so the fleet reads the registry exactly as before.
    prop: { D: S.prop.D, Tstatic: S.prop.Tstatic, kV2: S.prop.kV2 },
    substeps: genSubsteps(fr.nodes, fr.beams),
    polarWing, polarTail,
    elevTau, rudTau, ailTau, downwash: 0.40,
    flaps,
    stabTrim: 0, sparSpacing: fr.parts.sparSpacing,
    fusCdA: cda.fusCdA, fusCdAAft: cda.fusCdAAft,
    // the solver turns the rolling direction by -twSteer*dr, so a NOSEwheel
    // wants the opposite sign from a tailwheel (C172 fiche, sign verified there)
    twSteer: S.gear.type === 'tricycle' ? -0.35 : 0.5,
    ap,
    gen: { Vs, ClMax3D, Sw: G.Sw, AR: G.AR, cBar: G.cBar, mass,
           Sh: S.tail.Sh, Sv: S.tail.Sv, hAR, plant: pl },
  };
}
