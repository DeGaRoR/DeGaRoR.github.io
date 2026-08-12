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
