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
function genOswald(AR, strut) {
  const e = 1.78 * (1 - 0.045 * Math.pow(AR, 0.68)) - 0.64;
  return Math.min(0.95, Math.max(0.55, e * (strut ? 0.90 : 1.0)));
}

// naca: 4-digit code; AR/taper/strut: planform; finish: material cd0 penalty.
function genPolar(naca, AR, strut, matCd0, clmaxK) {
  const { m, p, t } = nacaParts(naca);
  const { aL0, Cm0 } = genThinAirfoil(m, p);
  const a0 = 2 * Math.PI * GEN_KVISC * (1 + 0.77 * t);
  const eAR = Math.PI * genOswald(AR, strut) * AR;
  const a3d = 1 / (1 / a0 + 1 / eAR);
  const Cl0 = a3d * (-aL0);
  const ClMax = (1.38 + 5.0 * m + 1.2 * (t - 0.12)) * clmaxK;
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
  const semi = S.geom.semi, aStart = 0.62 * semi;

  const zAll = [P.zRoot, ...P.zs];
  for (const [side, fw] of [[1, P.wf.R], [-1, P.wf.L]]) {
    for (let b = 0; b < P.zs.length; b++) {
      const zi = zAll[b], zo = zAll[b + 1];
      for (const t of [0.28, 0.78]) {
        const zc = zi + (zo - zi) * t;
        const ch = P.chordAt(zc);
        strips.push({
          kind: 'wing', side, t, chord: ch,
          area: 0.5 * (zo - zi) * ch,
          fIn: fw.F[b], fOut: fw.F[b + 1], rIn: fw.R[b], rOut: fw.R[b + 1],
          w: [[fw.F[b], cf * (1 - t)], [fw.F[b + 1], cf * t],
              [fw.R[b], cr * (1 - t)], [fw.R[b + 1], cr * t]],
          wash: washAt(zc), ail: zc > aStart ? 1 : 0, flap: 0,
        });
      }
    }
  }
  // centre section over the cabin: one strip, fully in the slipstream
  strips.push({
    kind: 'wing', side: 1, t: 0.5, chord: S.wing.chord,
    area: 2 * P.zRoot * S.wing.chord,
    fIn: P.F[1].TL, fOut: P.F[1].TR, rIn: P.F[2].TL, rOut: P.F[2].TR,
    w: [[P.F[1].TL, cf * 0.5], [P.F[1].TR, cf * 0.5],
        [P.F[2].TL, cr * 0.5], [P.F[2].TR, cr * 0.5]],
    wash: 1, ail: 0, flap: 0,
  });

  const hc = S.tail.hChord;
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
  return {
    VRot: V('VRot'), VClimbMin: V('VClimbMin'), VClimb: V('VClimb'),
    VCruise: V('VCruise'), VAppr: V('VAppr'), VApprShort: V('VApprShort'),
    VTailUp: V('VTailUp'), VBrakeOn: V('VBrakeOn'),
    TORun: 60,                    // replaced by the analytic estimate in 64
    rollD: 0.8 * kD,
    hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
    rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
    thMax: 0.20, flareAgl: 4.8, flareRate: 0.062, aglGuard: 3,
    VStop: 0.4, slew: 1.5, thrCruise: 0.70, thrAppr: 0.35,
    brakeMax: 0.30, brakeRampRate: 0.12, VBrakeRelease: 1.5,
    _mass: mass,
  };
}

// Everything the fiche's params block needs, except the two numbers that can
// only come from a wind-tunnel run (stabTrim, thrCruise) — 64_gen_build.js
// measures those with sim.probe().
function genParams(S, fr, strips) {
  const M = GEN_MATERIALS[S.material];
  const G = S.geom;
  const polarWing = genPolar(S.wing.naca, G.AR, S.wing.strut, M.cd0, M.clmaxK);
  const hAR = S.tail.hSpan * S.tail.hSpan / S.tail.Sh;
  const polarTail = genTailPolar(hAR, M.cd0);
  const mass = fr.cg0[3];
  const ClMax3D = polarWing.Cl0 + polarWing.a3d * polarWing.aStall;
  const Vs = Math.sqrt(2 * mass * 9.81 / (1.225 * G.Sw * ClMax3D));
  const cda = genFusCdA(S, fr);
  return {
    name: S.name, viewDist: Math.max(9, 1.4 * S.wing.span),
    powerplant: S.engine,
    polarWing, polarTail,
    elevTau: 0.50, rudTau: 0.55, ailTau: 0.35, downwash: 0.40,
    stabTrim: 0, sparSpacing: fr.parts.sparSpacing,
    fusCdA: cda.fusCdA, fusCdAAft: cda.fusCdAAft,
    twSteer: 0.5,
    ap: genAP(S, Vs, mass),
    gen: { Vs, ClMax3D, Sw: G.Sw, AR: G.AR, cBar: G.cBar, mass,
           Sh: S.tail.Sh, Sv: S.tail.Sv, hAR },
  };
}
