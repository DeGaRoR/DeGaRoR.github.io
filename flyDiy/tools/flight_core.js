// GENERATED FILE - DO NOT EDIT. Built from src/core/ by tools/build.js.
// body-sha256: 5529bc486d9eb23f
// ============================================================
// CUB FLIGHT CORE — M1
// node-beam chassis + strip-theory aero + prop + ground
// Units: m, kg, N, s, rad. Axes: x aft (nose -x), y up, z right.
// ============================================================

const RHO = 1.225;


// ============================================================
// REGISTRIES — powerplants (engine + propeller) and airfoil polars.
// Thrust model per prop: T = thr * max(0, Tstatic - kV2 * V^2),
// propwash from momentum theory over the actual disk.
// ============================================================
// `price` is what the powerplant COSTS, in credits, second-hand and installed —
// added for the GARAGE's build ledger (G3). Inert for the hand-written fiches.
const POWERPLANTS = {
  a65_sensenich74: {
    price: 9000,
    engine: { name: 'Continental A-65', mass: 80, powerW: 48500 },
    prop:   { name: 'Sensenich 74CK', D: 1.88, Tstatic: 900, kV2: 0.26 },
  },
  r1830_hs23e50: {
    price: 65000,
    engine: { name: 'P&W R-1830 Twin Wasp', mass: 750, powerW: 895000 },
    prop:   { name: 'Hamilton Standard 23E50', D: 3.4, Tstatic: 11000, kV2: 0.543 },
  },
  io360_mccauley: {
    price: 38000,
    engine: { name: 'Lycoming IO-360-L2A', mass: 138, powerW: 134000 },
    prop:   { name: 'McCauley 1C235 fixed-pitch', D: 1.93, Tstatic: 2290, kV2: 0.136 },
  },
  rotax277_pusher: {
    price: 3500,
    engine: { name: 'Rotax 277 (pusher)', mass: 30, powerW: 21000 },
    prop:   { name: '2-pale bois 1.42 m', D: 1.42, Tstatic: 800, kV2: 0.545 },
  },
  o200_eprops: {
    price: 24000,
    engine: { name: 'Continental O-200-A', mass: 85, powerW: 74600 },
    prop:   { name: 'E-Props Durandal carbone', D: 1.73, Tstatic: 1700, kV2: 0.177 },
  },
  outrunner2212_9x47: {
    price: 25,
    engine: { name: '2212 outrunner 1000KV / 3S', mass: 0.10, powerW: 180 },
    prop:   { name: 'GWS 9x4.7 SlowFly', D: 0.229, Tstatic: 8.0, kV2: 0.0155 },
  },
};
const POLARS = {
  usa35b_AR7: { a3d: 4.34, Cl0: 0.35, aStall: 0.297, Cd0: 0.010, eAR: Math.PI * 0.75 * 6.95, Cm0: -0.080 },
  flat_tail_cub: { a3d: 3.4, Cl0: 0, aStall: 0.24, Cd0: 0.008, eAR: Math.PI * 0.7 * 3.7, Cm0: 0 },
  naca2215_AR9: { a3d: 4.66, Cl0: 0.22, aStall: 0.28, Cd0: 0.010, eAR: Math.PI * 0.8 * 9.14, Cm0: -0.045 },
  metal_tail_dc3: { a3d: 3.6, Cl0: 0, aStall: 0.25, Cd0: 0.009, eAR: Math.PI * 0.7 * 4.2, Cm0: 0 },
  naca2412_AR75: { a3d: 4.30, Cl0: 0.25, aStall: 0.314, Cd0: 0.008, eAR: Math.PI * 0.75 * 7.47, Cm0: -0.050 },
  metal_tail_c172: { a3d: 3.5, Cl0: 0, aStall: 0.24, Cd0: 0.009, eAR: Math.PI * 0.7 * 3.5, Cm0: 0 },
  chinook_wing_AR87: { a3d: 4.44, Cl0: 0.35, aStall: 0.293, Cd0: 0.010, eAR: Math.PI * 0.78 * 8.75, Cm0: -0.060 },
  fabric_tail: { a3d: 3.3, Cl0: 0, aStall: 0.26, Cd0: 0.010, eAR: Math.PI * 0.7 * 3.0, Cm0: 0 },
  jodel_wing_AR55: { a3d: 4.11, Cl0: 0.25, aStall: 0.28, Cd0: 0.0075, eAR: Math.PI * 0.85 * 5.55, Cm0: -0.050 },
  wood_tail: { a3d: 3.3, Cl0: 0, aStall: 0.24, Cd0: 0.009, eAR: Math.PI * 0.7 * 3.4, Cm0: 0 },
  foam_wing_AR56: { a3d: 4.0, Cl0: 0.25, aStall: 0.24, Cd0: 0.022, eAR: Math.PI * 0.8 * 5.6, Cm0: -0.055 },
  foam_tail: { a3d: 3.2, Cl0: 0, aStall: 0.22, Cd0: 0.015, eAR: Math.PI * 0.7 * 3.0, Cm0: 0 },
};

const PAR = {
  stabTrim: -0.0983,   // tuned: tunnel trim 24 m/s; in-flight bias acceptable
  rudderSign: 1,        // dr>0 = nose-left (probe reading corrected: +My = nose-LEFT)
  twSteer: 0.5,         // tailwheel deg per rudder deg
  fusCdA: [0.55, 1.30, 1.30], // body-axis CdA: axial, vertical, lateral
};

const CRR = 0.05, MU_LAT = 0.8, MU_BRAKE = 0.45;

// ============================================================
function buildCub() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_CH = 2.0e5, C_CH = 60, K_GR = 2.8e4, C_GR = 900, K_WG = 5.0e5, C_WG = 450;
  const B = (a, b, k = K_CH, c = C_CH) => beams.push({ a, b, k, c, gear: k === K_GR });
  const BG = (a, b) => B(a, b, K_GR, C_GR);

  const ST = [                       // [x, halfW, yBot, yTop, nodeMass]
    [0.00, 0.33,  0.00, 0.78, 3.0],
    [0.62, 0.36, -0.02, 1.00, 3.0],
    [1.40, 0.36, -0.02, 1.00, 3.0],
    [2.05, 0.30,  0.02, 0.74, 1.5],
    [2.85, 0.24,  0.08, 0.60, 1.5],
    [3.65, 0.17,  0.14, 0.48, 1.5],
    [4.45, 0.10,  0.20, 0.38, 1.5],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, mm], i) => {
    const [BL, BR] = NM(x, yb, w, mm, `S${i}B`);
    const [TL, TR] = NM(x, yt, w, mm, `S${i}T`);
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR);
    B(BL, TR); B(BR, TL);            // X-brace: mirror-symmetric shear
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1], alt = i % 2;
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(alt ? a.BL : a.TL, alt ? b.TL : b.BL);
    B(alt ? a.BR : a.TR, alt ? b.TR : b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL);    // top panel X
    B(a.BL, b.BR); B(a.BR, b.BL);    // bottom panel X
  }
  const TPB = N(5.12, 0.25, 0, 1.2, 'TPB'), TPT = N(5.12, 0.36, 0, 1.2, 'TPT');
  const S6 = F[6];
  B(TPB, TPT);
  B(S6.BL, TPB); B(S6.BR, TPB); B(S6.TL, TPT); B(S6.TR, TPT);
  B(S6.TL, TPB); B(S6.TR, TPB);

  const [EL, ER] = NM(-0.48, 0.36, 0.20, 40, 'ENG');   // engine+prop ~80 kg
  const S0 = F[0];
  B(EL, ER);
  B(EL, S0.TL); B(EL, S0.BL); B(EL, S0.BR);
  B(ER, S0.TR); B(ER, S0.BR); B(ER, S0.BL);
  nodes[S0.TL].m += 18; nodes[S0.TR].m += 18;          // fuel 36 kg at firewall

  const [GAL, GAR] = NM(0.55, -0.80, 0.89, 6, 'AXLE', 0.20);
  BG(GAL, GAR);
  BG(GAL, S0.BL); BG(GAL, F[1].BL); BG(GAL, S0.BR);
  BG(GAR, S0.BR); BG(GAR, F[1].BR); BG(GAR, S0.BL);
  const TW = N(5.02, 0.02, 0, 3, 'TW', 0.10);
  BG(TW, TPB); BG(TW, S6.BL); BG(TW, S6.BR);
  // snap-blocking near-vertical member (structural rule 10, the drone cure):
  // without it the tailwheel folds UP about TPB and LATCHES (bare post on
  // the terrain) when parked in a tailwind — reset slam + breeze, W13.
  BG(TW, TPT);

  const MW = 8, wf = { L: null, R: null };
  const mkWing = (s) => {
    const B = (a, b) => beams.push({ a, b, k: K_WG, c: C_WG, gear: false });
    const rootF = s > 0 ? F[1].TR : F[1].TL, rootR = s > 0 ? F[2].TR : F[2].TL;
    const strut = s > 0 ? F[1].BR : F[1].BL;
    const zs = [1.9, 3.4, 5.0], DIH = 0.0524;   // 3 deg dihedral (tan)
    const WF = zs.map(z => N(0.62, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WF'));
    const WR = zs.map(z => N(1.40, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WR'));
    B(rootF, WF[0]); B(WF[0], WF[1]); B(WF[1], WF[2]);
    B(rootR, WR[0]); B(WR[0], WR[1]); B(WR[1], WR[2]);
    B(WF[0], WR[0]); B(WF[1], WR[1]); B(WF[2], WR[2]);
    B(rootF, WR[0]); B(WF[0], WR[1]); B(WF[1], WR[2]);
    B(WR[0], WF[1]); B(WR[1], WF[2]);
    B(strut, WF[1]); B(strut, WR[1]); B(strut, WF[0]);
    B(strut, WR[0]); B(strut, WF[2]); B(strut, WR[2]);
    wf[s > 0 ? 'R' : 'L'] = { F: [rootF, ...WF], R: [rootR, ...WR] };
  };
  mkWing(+1); mkWing(-1);

  const [HTL, HTR] = NM(4.92, 0.30, 1.05, 4, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S6.BL); B(HTL, S6.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S6.BR); B(HTR, S6.TR);
  // stab<->tailwheel pyramid (rule 10, the chinook cure): the fold that
  // survives the TW->TPT block is LATERAL (dTW body [+0.28 up, 0.25
  // sideways], measured) — wide anchors kill it
  BG(TW, HTL); BG(TW, HTR);
  const FIN = N(5.05, 0.95, 0, 4, 'FIN');
  B(FIN, TPT); B(FIN, S6.TL); B(FIN, S6.TR);

  nodes[F[1].BL].m += 38; nodes[F[1].BR].m += 38;      // pilot, front seat

  // ---------- aero strips ----------
  const strips = [];
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, side, o = {}) => {
    const cf = 0.795, cr = 0.205;   // c/4 sits between the spars at 79.5/20.5
    strips.push({ kind: 'wing', side, t, area, chord: 1.6,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0 });
  };
  const bays = (fr, side) => {
    const bw = [1.54, 1.5, 1.6];
    for (let b = 0; b < 3; b++)
      for (const t of [0.28, 0.78])
        wingStrip(fr.F[b], fr.F[b + 1], fr.R[b], fr.R[b + 1], t, bw[b] * 1.6 / 2,
          side, { wash: b === 0 && t < 0.5 ? 0.5 : 0, ail: b === 2 ? 1 : 0 });
  };
  bays(wf.R, 1); bays(wf.L, -1);
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 0.5, 0.72 * 1.6, 1, { wash: 1 });

  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.65, chord: 0.9, wash: 0.6,
      w: [[nHT, .5], [TPB, .3], [TPT, .2]] });
    strips.push({ kind: 'stab', side, area: 0.50, chord: 0.9, wash: 0.6,
      w: [[nHT, .25], [TPB, .45], [TPT, .3]] });
  }
  strips.push({ kind: 'fin', area: 1.00, chord: 0.9, wash: 1,
    w: [[FIN, .4], [TPT, .35], [TPB, .25]] });

  const refs = {
    noseFrame: [S0.BL, S0.BR, S0.TL, S0.TR], tailMid: [TPB, TPT],
    upLo: [S0.BL, S0.BR], upHi: [S0.TL, S0.TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[5].BL, F[5].BR, F[5].TL, F[5].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Piper J-3 Cub', viewDist: 14,
    powerplant: 'a65_sensenich74',
    // ONE engine on TWO mount nodes (`refs.engine` above is the mounts). Stated
    // because the solver used to read the mount count as the engine count, and
    // this aeroplane flew on 1800 N. See HONEST CUTS / G4.9.
    nEngines: 1,
    polarWing: POLARS.usa35b_AR7, polarTail: POLARS.flat_tail_cub,
    elevTau: 0.50, rudTau: 0.55, ailTau: 0.35, downwash: 0.40,
    stabTrim: -0.0983, sparSpacing: 0.78,
    fusCdA: [0.55, 0.8, 0.8], fusCdAAft: [0, 0.5, 0.5],
    twSteer: 0.5,
    ap: {
      VRot: 15, VClimbMin: 20, VClimb: 21, VCruise: 26, VAppr: 21.5,
      VApprShort: 18.8,             // fly-in strips < 450 m (1.25*Vs, doctrine floor)
      // RE-ANCHORED G4.9 (was 60): the engine-count fix halved this aeroplane's
      // thrust, and the run to 2.5 m agl went 67 m -> 151 m. Re-read off
      // tools/make_perf.js, not adjusted by hand.
      TORun: 151,                   // measured run to 2.5 m agl
      // W16 lateral quiet: same 4 Hz aileron limit cycle as the pa18
      // (shared geometry) — default rollD 2.0 on the lagged rate estimate;
      // 0.8 kills it (see pa18 fiche note).
      rollD: 0.8,
      hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
      rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
      thMax: 0.20, flareAgl: 4.8, flareRate: 0.062, aglGuard: 3,
      VTailUp: 12, VStop: 0.4, slew: 1.5, thrCruise: 0.70, thrAppr: 0.35,
      brakeMax: 0.30, brakeRampRate: 0.12, VBrakeOn: 9, VBrakeRelease: 1.5,
    },
  };
  return { nodes, beams, strips, refs, params };
}



// ============================================================
// DOUGLAS DC-3 — 10.5 t twin, low tapered wing with spar box,
// oleo mains in the nacelles, tailwheel. x aft from nose.
// ============================================================
function buildDC3() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_S = 2.5e6, C_S = 3000, K_W3 = 2.0e7, C_W3 = 12000, K_O = 4.0e5, C_O = 3.0e4;
  const B = (a, b, k = K_S, c = C_S) => beams.push({ a, b, k, c, gear: k === K_O });
  const BG = (a, b) => B(a, b, K_O, C_O);

  // fuselage: [x, halfW, yBot, yTop, nodeMass]
  const ST = [
    [1.0, 0.55, 0.45, 1.55, 55],
    [3.5, 1.20, 0.05, 2.30, 70],
    [6.2, 1.45, 0.00, 2.55, 110],   // wing front spar frame
    [8.9, 1.45, 0.00, 2.55, 110],   // wing rear spar frame
    [11.4, 1.35, 0.05, 2.45, 95],
    [13.8, 1.10, 0.20, 2.20, 70],
    [16.0, 0.80, 0.45, 1.85, 55],
    [18.2, 0.45, 0.80, 1.50, 45],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, m]) => {
    const [BL, BR] = NM(x, yb, w, m, 'B');
    const [TL, TR] = NM(x, yt, w, m, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(19.3, 1.00, 0, 40, 'TPB'), TPT = N(19.3, 1.60, 0, 40, 'TPT');
  const S7 = F[7];
  B(TPB, TPT);
  B(S7.BL, TPB); B(S7.BR, TPB); B(S7.TL, TPT); B(S7.TR, TPT);
  B(S7.TL, TPB); B(S7.TR, TPB); B(S7.BL, TPT); B(S7.BR, TPT);

  // cabin payload + crew
  nodes[F[3].BL].m += 500; nodes[F[3].BR].m += 500;
  nodes[F[4].BL].m += 450; nodes[F[4].BR].m += 450;
  nodes[F[1].BL].m += 150; nodes[F[1].BR].m += 150;

  // ---- wing: low, tapered, LE sweep outboard of nacelles, 5 deg outer dihedral
  const zSt = [1.45, 3.2, 5.4, 7.6, 9.5, 11.4, 12.9, 14.3];
  const chord = z => z <= 3.2 ? 4.33 : 4.33 + (z - 3.2) * (1.55 - 4.33) / (14.3 - 3.2);
  const LEx = z => 6.05 + Math.max(0, z - 3.2) * 0.19;
  const yW = z => 0.15 + Math.max(0, z - 3.2) * 0.0875;
  const boxD = z => 0.68 + Math.max(0, z - 3.2) * (0.26 - 0.68) / 11.1;
  const wf = { L: null, R: null }, keel = { L: null, R: null };
  const mkWing = (sgn) => {
    const B = (a, b) => beams.push({ a, b, k: K_W3, c: C_W3, gear: false });
    const rootF = sgn > 0 ? F[2].BR : F[2].BL;
    const rootR = sgn > 0 ? F[3].BR : F[3].BL;
    // mass per station ~ chord x bay width (structure + fuel share)
    const MWs = zSt.slice(1).map((z, i) => {
      const dz = (zSt[i + 2] ?? z + 1.4) - zSt[i];
      return 11.8 * chord(z) * dz;
    });
    const WF = [], WR = [], BF = [], BR = [];
    zSt.slice(1).forEach((z, i) => {
      const c = chord(z);
      WF.push(N(LEx(z) + 0.15 * c, yW(z), sgn * z, MWs[i], 'WF'));
      WR.push(N(LEx(z) + 0.65 * c, yW(z) - 0.5 * c * 0.035, sgn * z, MWs[i] * 0.55, 'WR'));
      BF.push(N(LEx(z) + 0.15 * c, yW(z) - boxD(z), sgn * z, Math.max(16, MWs[i] * 0.30), 'WB'));
      BR.push(N(LEx(z) + 0.65 * c, yW(z) - 0.5 * c * 0.035 - boxD(z) * 0.8, sgn * z, Math.max(16, MWs[i] * 0.25), 'WB'));
    });
    // center-section keel: the box keeps full depth through the belly
    const cR = chord(1.45);
    const KF = N(LEx(1.45) + 0.15 * cR, yW(1.45) - boxD(1.45), sgn * 1.45, 55, 'WB');
    const KR = N(LEx(1.45) + 0.65 * cR, yW(1.45) - 0.5 * cR * 0.035 - boxD(1.45) * 0.8, sgn * 1.45, 45, 'WB');
    const F2b = sgn > 0 ? F[2].BR : F[2].BL, F3b = sgn > 0 ? F[3].BR : F[3].BL;
    const F2o = sgn > 0 ? F[2].BL : F[2].BR, F3o = sgn > 0 ? F[3].BL : F[3].BR;
    B(KF, rootF); B(KF, F2o); B(KF, F3b); B(KF, rootR);
    B(KR, rootR); B(KR, F3o); B(KR, F2b); B(KR, rootF);
    B(KF, KR);
    keel[sgn > 0 ? 'R' : 'L'] = { KF, KR };
    const chainF = [rootF, ...WF], chainR = [rootR, ...WR],
          chainB = [KF, ...BF], chainBR = [KR, ...BR];
    for (let i = 0; i < zSt.length - 1; i++) {
      B(chainF[i], chainF[i + 1]); B(chainR[i], chainR[i + 1]);
      B(chainB[i], chainB[i + 1]); B(chainBR[i], chainBR[i + 1]);
      B(chainF[i + 1], chainR[i + 1]);                        // top rib
      B(chainB[i + 1], chainBR[i + 1]);                       // bottom rib
      B(chainF[i], chainR[i + 1]); B(chainR[i], chainF[i + 1]); // top drag truss
      B(chainF[i + 1], chainB[i + 1]);                        // front web vertical
      B(chainF[i], chainB[i + 1]); B(chainB[i], chainF[i + 1]); // front web shear
      B(chainR[i + 1], chainBR[i + 1]);                       // rear web vertical
      B(chainR[i], chainBR[i + 1]); B(chainBR[i], chainR[i + 1]); // rear web shear
      B(chainB[i], chainBR[i + 1]); B(chainBR[i], chainB[i + 1]); // bottom drag truss
      B(chainB[i + 1], chainR[i + 1]); B(chainBR[i + 1], chainF[i + 1]); // box diagonals
    }
    wf[sgn > 0 ? 'R' : 'L'] = { F: chainF, R: chainR };
    return { WF, WR, BF };
  };
  const wR = mkWing(+1), wL = mkWing(-1);
  // keel continuity across the belly: the bending moment crosses the fuselage here
  const KB = (a, b) => beams.push({ a, b, k: K_W3, c: C_W3, gear: false });
  KB(keel.L.KF, keel.R.KF); KB(keel.L.KR, keel.R.KR);
  KB(keel.L.KF, keel.R.KR); KB(keel.R.KF, keel.L.KR);

  // ---- engines on nacelle mounts ahead of the front spar at z ±3.2
  const [EL, ER] = NM(4.4, 0.55, 3.2, 900, 'ENG');       // R-1830 + prop + nacelle
  for (const [E, w] of [[EL, wL], [ER, wR]]) {
    B(E, w.WF[0]); B(E, w.BF[0]); B(E, w.WR[0]);
    B(E, w.WF[1]); B(E, w.BF[1]);
  }

  // ---- gear: oleo mains under nacelles, tailwheel
  const [GAL, GAR] = NM(6.6, -1.45, 3.2, 120, 'AXLE', 0.50);
  for (const [G, E, w] of [[GAL, EL, wL], [GAR, ER, wR]]) {
    BG(G, E); BG(G, w.WF[0]); BG(G, w.BF[0]); BG(G, w.WR[0]); BG(G, w.BF[1]);
  }
  BG(GAL, wR.BF[0]); BG(GAR, wL.BF[0]);                  // cross bracing
  const TW = N(17.8, -0.30, 0, 60, 'TW', 0.22);
  BG(TW, F[6].BL); BG(TW, F[6].BR); BG(TW, F[7].BL); BG(TW, F[7].BR);

  // ---- tail
  const [HTL, HTR] = NM(18.5, 1.35, 4.3, 60, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S7.BL); B(HTL, S7.TL); B(HTL, F[6].BL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S7.BR); B(HTR, S7.TR); B(HTR, F[6].BR);
  const FIN = N(18.9, 4.6, 0, 60, 'FIN');
  B(FIN, TPT); B(FIN, S7.TL); B(FIN, S7.TR); B(FIN, F[6].TL); B(FIN, F[6].TR);

  // ---- strips
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, ch, side, o = {}) => {
    strips.push({ kind: 'wing', side, t, area, chord: ch,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    for (let b = 0; b < zSt.length - 1; b++) {
      const zm = (zSt[b] + zSt[b + 1]) / 2, dz = zSt[b + 1] - zSt[b];
      const ch = chord(zm), area = ch * dz;
      const wsh = zm < 4.6 ? 0.8 : zm < 6.5 ? 0.3 : 0;
      const ail = b >= zSt.length - 3 ? 1 : 0;
      wingStrip(fr.F[b], fr.F[b + 1], fr.R[b], fr.R[b + 1], 0.5, area, ch, side,
        { wash: wsh, ail, flap: ail ? 0 : 1 });   // split flaps inboard of ailerons
    }
  }
  wingStrip(F[2].BL, F[2].BR, F[3].BL, F[3].BR, 0.5, 12.5, 4.33, 1, { wash: 0.3, flap: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 6.0, chord: 2.3, wash: 0.4,
      w: [[nHT, .5], [TPB, .3], [TPT, .2]] });
    strips.push({ kind: 'stab', side, area: 4.6, chord: 2.3, wash: 0.4,
      w: [[nHT, .25], [TPB, .45], [TPT, .3]] });
  }
  strips.push({ kind: 'fin', area: 5.5, chord: 2.4, wash: 0.4,
    w: [[FIN, .45], [TPT, .3], [TPB, .25]] });
  strips.push({ kind: 'fin', area: 4.5, chord: 2.2, wash: 0.4,
    w: [[FIN, .2], [TPT, .45], [TPB, .35]] });

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [F[6].BL, F[6].BR, F[6].TL, F[6].TR],       // rigid box reference
    upLo: [F[1].BL, F[1].BR], upHi: [F[1].TL, F[1].TR],
    fusDrag: [F[3].BL, F[3].BR, F[3].TL, F[3].TR],
    fusDragAft: [F[6].BL, F[6].BR, F[6].TL, F[6].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Douglas DC-3', viewDist: 45, substeps: 72,
    powerplant: 'r1830_hs23e50',
    nEngines: 2,                    // genuinely a twin: one engine per mount node
    polarWing: POLARS.naca2215_AR9, polarTail: POLARS.metal_tail_dc3,
    elevTau: 0.45, rudTau: 0.50, ailTau: 0.30, downwash: 0.42,
    stabTrim: -0.0120, sparSpacing: 2.16,
    fusCdA: [1.40, 3.0, 3.0], fusCdAAft: [0, 2.0, 2.0],
    twSteer: 0.30,
    // split flaps: strong drag, quarter flaps for takeoff (shortens unstick)
    flaps: { to: 0.25, ldg: 0.7, rate: 0.10, dCl0: 0.80, dCd0: 0.090, dAStall: 0.025, dCm0: -0.20 },
    ap: {
      rotate: true,
      VRot: 45, VClimbMin: 42, VClimb: 46, VCruise: 58, VAppr: 43, VTurn: 55,
      TORun: 960,                   // measured run to 2.5 m agl (W14 multi-hop)
      thTailUp: 0.030, thRotate: 0.100,
      lookRoll: 45, lookAppr: 650, lookCruise: 900,
      // gs 0.044 -> 0.060 (flapped approaches are steeper): with split-flap
      // drag the shallow clean slope needed 0.70 throttle and the jet of
      // integrators railed into a powered 1 m/s mush 60 m above the slope
      hCruise: 250, hSafe: 30, xTurn: -5800, xAim: -810, gs: 0.060,
      thrFloor: 0.05,
      rollDe: 0.06, liftoffTh: 0.15, liftoffRamp: 0.06,
      climbThBase: 0.11, climbThGain: 0.015, thMax: 0.17,
      // flare from 10 m, faster ramp: the steeper flapped slope arrives at
      // -2.5 m/s and the old 0.030 ramp from 7 m was a 2.6 m/s carrier landing.
      // flareThMax 0.11 -> 0.085: flaps raise CL at a given attitude, so the
      // clean-era cap sat ABOVE the L=W attitude and the float came back
      // (117 km/h touchdown, 300 m past the window).
      flareAgl: 10, flareRate: 0.045, aglGuard: 6, flareThMax: 0.085,
      VTailUp: 20, VStop: 0.5, slew: 0.8, thrCruise: 0.55, thrAppr: 0.30,
      // GE retune (session 1): wing keeps lifting through the rollout in
      // ground effect -> less weight on wheels -> longer roll. Brake earlier
      // and harder, approach one knot slower; was 0.45/36/VAppr 44 (overran
      // to x=+124).
      // brake later/gentler than the GE retune: flap retraction on rollout
      // returns weight to the wheels, and braking at 39 with the tail still
      // flying dipped the nose to -3
      brakeMax: 0.50, brakeRampRate: 0.14, VBrakeOn: 34, VBrakeRelease: 2.5,
      rateFilt: 0.15, pitchP: 1.6, pitchD: 1.6, pitchI: 0.25,
      vsP: 0.006, vsI: 0.010, vsFloor: -0.12, altVSGain: 0.06,
      vsFilt: 0.5, pitchCmdSlew: 0.3,
      hdgP: 0.7, hdgD: 1.2, bankSlew: 0.14, rollP: 1.6, rollD: 2.2,
      betaK: 0.3, yawDampK: 0.7, ariK: 0.3, bankLim: 0.45,
    },
  };
  return { nodes, beams, strips, refs, params };
}




// ============================================================
// BIRDMAN CHINOOK 1S (WT-11) — 208 kg avec pilote, pod
// pentagonal, poutre monotube (tube triangulaire), PUSHER
// Rotax 277, gouvernes surdimensionnees. STOL-né. x arriere.
// ============================================================
function buildChinook() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const K_F = 2.2e5, C_F = 180, K_W = 6.0e5, C_W = 380, K_B = 8.5e5, C_B = 400, K_G = 3.5e4, C_G = 800;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BB = (a, b) => B(a, b, K_B, C_B);
  const BG = (a, b) => B(a, b, K_G, C_G);

  // ---- pod pentagonal : 3 cadres a 5 noeuds (BL BR ML MR T)
  const PST = [
    [0.35, 0.30, 0.25, 0.38, 0.85, 1.22, 2.2],
    [1.05, 0.34, 0.20, 0.42, 0.95, 1.42, 2.2],
    [1.75, 0.30, 0.28, 0.36, 0.92, 1.38, 1.8],
  ];
  const P = [];
  PST.forEach(([x, w, yb, w2, ym, yt, m]) => {
    const BL = N(x, yb, -w, m, 'B'), BR = N(x, yb, w, m, 'B');
    const ML = N(x, ym, -w2, m, 'M'), MR = N(x, ym, w2, m, 'M');
    const T  = N(x, yt, 0, m, 'T');
    P.push({ BL, BR, ML, MR, T });
    B(BL, BR); B(BL, ML); B(BR, MR); B(ML, T); B(MR, T);   // pentagone
    B(BL, MR); B(BR, ML); B(ML, MR); B(BL, T); B(BR, T);   // diagonales
  });
  for (let i = 0; i < 2; i++) {
    const a = P[i], b = P[i + 1];
    for (const k of ['BL', 'BR', 'ML', 'MR', 'T']) B(a[k], b[k]);
    B(a.BL, b.ML); B(a.BR, b.MR); B(a.ML, b.T); B(a.MR, b.T);
    B(a.ML, b.BL); B(a.MR, b.BR); B(a.T, b.ML); B(a.T, b.MR);
    B(a.BL, b.BR); B(a.BR, b.BL);
  }
  nodes[P[0].BL].m += 18; nodes[P[0].BR].m += 18;          // jambes pilote
  nodes[P[1].BL].m += 25; nodes[P[1].BR].m += 24;          // pilote
  nodes[P[2].BL].m += 5; nodes[P[2].BR].m += 5;            // essence

  // moteur pusher au sommet arriere du pod, helice derriere l aile
  const EM = N(2.05, 1.42, 0, 30, 'ENG');
  B(EM, P[2].T); B(EM, P[2].ML); B(EM, P[2].MR); B(EM, P[1].T);

  // ---- poutre monotube : tube triangulaire jusqu a l empennage.
  // Section 20 cm (le vrai tube est gros) — la section 8 cm etait un mecanisme
  // en flexion laterale (depth/bay 7%, regle structurelle 5) : la queue,
  // pendule inverse sur la roulette, tombait sur le cote a l arret.
  const boomY = 1.08;
  const bTri = (x, m) => {
    const T = N(x, boomY + 0.10, 0, m, 'BOOM');
    const L = N(x, boomY - 0.07, -0.10, m, 'BOOM');
    const R = N(x, boomY - 0.07, 0.10, m, 'BOOM');
    BB(T, L); BB(T, R); BB(L, R);
    return { T, L, R };
  };
  const B1 = bTri(2.85, 1.6), B2 = bTri(3.95, 1.4), B3 = bTri(5.05, 1.4);
  const link = (a, b) => {
    BB(a.T, b.T); BB(a.L, b.L); BB(a.R, b.R);
    BB(a.T, b.L); BB(a.T, b.R); BB(a.L, b.T); BB(a.R, b.T); BB(a.L, b.R); BB(a.R, b.L);
  };
  // emplanture de poutre dans le pod
  BB(P[2].T, B1.T); BB(P[2].ML, B1.L); BB(P[2].MR, B1.R);
  BB(P[2].T, B1.L); BB(P[2].T, B1.R); BB(P[2].ML, B1.T); BB(P[2].MR, B1.T);
  BB(P[1].T, B1.T); BB(EM, B1.T); BB(EM, B1.L); BB(EM, B1.R);
  // jurys d emplanture vers les coins bas du pod : raideur de roulis du 1er
  // ordre a la racine (les liaisons quasi axiales seules laissaient la poutre
  // se vriller de 16 deg a la racine quand la queue retombe au reset)
  BB(B1.L, P[2].BL); BB(B1.R, P[2].BR);
  link(B1, B2); link(B2, B3);

  // ---- aile haute haubanee, corde constante 1.22, fleche nulle
  const zSt = [0.55, 2.00, 3.70, 5.34];
  const CH = 1.22, LEX = 0.88;
  const yW = z => 1.55 + Math.max(0, z - 0.55) * 0.026;
  const wf = { L: null, R: null };
  const mkWing = (sgn) => {
    const MF = [3.2, 2.4, 1.8];
    const WF = [], WR = [], BF = [];
    zSt.forEach((z, i) => {
      const mi = i === 0 ? 2.8 : MF[i - 1];
      WF.push(N(LEX + 0.15 * CH, yW(z), sgn * z, mi, 'WF'));
      WR.push(N(LEX + 0.65 * CH, yW(z) - 0.5 * CH * 0.030, sgn * z, mi * 0.6, 'WR'));
      BF.push(N(LEX + 0.15 * CH, yW(z) - 0.13 * CH, sgn * z, Math.max(1.5, mi * 0.3), 'WB'));
    });
    // emplanture sur le sommet du pod
    const a1 = P[1].T, a2 = P[2].T, m1 = sgn > 0 ? P[1].MR : P[1].ML;
    BW(WF[0], a1); BW(WR[0], a2); BW(WF[0], a2); BW(WR[0], a1); BW(BF[0], m1); BW(BF[0], a1);
    for (let i = 0; i < 3; i++) {
      BW(WF[i], WF[i + 1]); BW(WR[i], WR[i + 1]); BW(BF[i], BF[i + 1]);
      BW(WF[i + 1], WR[i + 1]);
      BW(WF[i], WR[i + 1]); BW(WR[i], WF[i + 1]);
      BW(WF[i + 1], BF[i + 1]);
      BW(WF[i], BF[i + 1]); BW(BF[i], WF[i + 1]);
      BW(BF[i + 1], WR[i + 1]); BW(BF[i], WR[i + 1]);
      BW(BF[i], WR[i]);
    }
    // haubans vers le bas du pod — grand bras vertical
    const sb = sgn > 0 ? P[1].BR : P[1].BL, sb2 = sgn > 0 ? P[2].BR : P[2].BL;
    BW(sb, WF[1]); BW(sb2, WR[1]); BW(sb, WR[1]); BW(sb2, WF[1]); BW(sb, BF[1]);
    // ...ET JUSQU'AUX STATIONS EXTERIEURES (2026-08-10, GATE FLEX).
    // Le haubanage ne tenait que la station 1 (z=2.00) : les 3.34 m suivants,
    // soit 63% de la demi-envergure, pendaient sur le seul caisson triangulaire,
    // dont les baies font 1.70 m pour 0.16 m de hauteur — rapport hauteur/baie
    // 9.3%, exactement la regle 5 que la POUTRE de cet avion a deja payee
    // ("la section 8 cm etait un mecanisme, depth/bay 7%") sans qu'on l'applique
    // jamais a l'AILE. Mesure (couple antisymetrique en bout, statique, sans
    // aero) : 16.4 deg sous 200 N.m et 24.6 sous 400 — NON LINEAIRE, la
    // signature d'un quasi-mecanisme, contre cub 3.07 / gen 2.43 / c172 1.36 /
    // jodel 0.48. Trois remedes essayes et mesures :
    //   +X sous le caisson          14.95 deg  (les faces n'etaient pas le mal)
    //   +caisson a 4 semelles       8.37 deg, et 46 poutres + 8 noeuds + 72
    //                               sous-pas au lieu de 48 (omega*dt 0.579)
    //   +haubans station 2 seule    8.81 -> 13.83, TOUJOURS non lineaire
    //   +haubans jusqu'au saumon    2.22 -> 4.68, LINEAIRE, 8 poutres, 0 masse
    // C'est la cure du Cub, et pour la meme raison : le HANDOWER dit de son
    // eventail six branches qu'il est "the lumped stand-in for a spar box this
    // planar wing does not have". A 0.16 m d'epaisseur aucune structure interne
    // ne rivalise avec un ancrage 1.25 m SOUS l'aile (regle 1). La linearite
    // est le critere, pas la valeur : 2.22 rend l'aile plus raide que celle du
    // Cub, ce qui est discutable pour un ULM de 230 kg, mais l'alternative a
    // 8.8 deg reste un mecanisme. Si on veut l'assouplir un jour, c'est K_W
    // qu'on baisse — jamais en revenant a une reponse non lineaire.
    BW(sb, WF[2]); BW(sb2, WR[2]); BW(sb, WF[3]); BW(sb2, WR[3]);
    wf[sgn > 0 ? 'R' : 'L'] = { F: WF, R: WR, B: BF };
  };
  mkWing(+1); mkWing(-1);

  // ---- train classique : roues sous le pod, roulette au bout de la poutre
  const [GAL, GAR] = NM_(0.98, -0.30, 0.78, 3.5, 'AXLE', 0.20);
  function NM_(x, y, z, m, tag, r) {
    return [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  }
  BG(GAL, GAR);
  for (const [G, sgn] of [[GAL, -1], [GAR, 1]]) {
    const b1 = sgn > 0 ? P[1].BR : P[1].BL, b0 = sgn > 0 ? P[0].BR : P[0].BL;
    const b2 = sgn > 0 ? P[2].BR : P[2].BL, bo = sgn > 0 ? P[1].BL : P[1].BR;
    BG(G, b1); BG(G, b0); BG(G, b2); BG(G, bo);
  }
  const TW = N(4.95, -0.02, 0, 2, 'TW', 0.07);
  BG(TW, B3.L); BG(TW, B3.R); BG(TW, B2.T); BG(TW, B3.T);

  // ---- empennage surdimensionne sur la poutre
  const HTL = N(5.00, boomY + 0.02, -1.30, 2.5, 'HTL'), HTR = N(5.00, boomY + 0.02, 1.30, 2.5, 'HTR');
  BB(HTL, B3.T); BB(HTL, B3.L); BB(HTL, B2.T); BB(HTL, B2.L);
  BB(HTR, B3.T); BB(HTR, B3.R); BB(HTR, B2.T); BB(HTR, B2.R);
  const FIN = N(5.15, boomY + 0.95, 0, 2.5, 'FIN');
  BB(FIN, B3.T); BB(FIN, B2.T); BB(FIN, B3.L); BB(FIN, B3.R);
  // haubans d empennage (comme le vrai) : derive <-> saumons de stab.
  // Sans eux l empennage est un mecanisme en roulis (ressorts axiaux quasi
  // paralleles a x = raideur du 2e ordre) et la queue tombe sur le cote.
  BB(FIN, HTL); BB(FIN, HTR);
  // ...et les deux autres cotes de la pyramide + ancrage large vers l aile.
  // Mesure (probe 2026-08): CHAQUE jeu seul laisse la queue se coucher en
  // se verrouillant; les deux ensemble la font revenir droite elastiquement.
  // Ancrage sur les noeuds BAS du caisson (WB, pas de charge de bande) et
  // SOUPLE (1.2e5): assez pour retenir ~20 N.m de chute statique, trop mou
  // pour brider l aeroelasticite en vol (en 6e5 sur le longeron AR: battement
  // ampute de moitie, roulages TO/ldg derives de 10-30%).
  BB(HTL, TW); BB(HTR, TW);
  B(B3.T, wf.L.B[1], 1.2e5, 60); B(B3.T, wf.R.B[1], 1.2e5, 60);

  // ---- bandes : pusher -> AUCUN souffle sur l aile, souffle sur l empennage
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, area, side, o = {}) => {
    strips.push({ kind: 'wing', side, t: 0.5, area, chord: CH,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * 0.5], [fOut, cf * 0.5], [rIn, cr * 0.5], [rOut, cr * 0.5]],
      wash: 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  // flaperons: the aileron surfaces droop symmetrically -> flap = ail gearing
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 1.77, side, { ail: 0.5, flap: 0.5 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 2.07, side, { ail: 0.8, flap: 0.8 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 2.00, side, { ail: 1, flap: 1 });
  }
  wingStrip(wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0], 1.34, 1, {});
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 1.00, chord: 0.78, wash: 0.6,
      w: [[nHT, .55], [B3.L, .2], [B3.R, .2], [B3.T, .05]] });
  }
  strips.push({ kind: 'fin', area: 0.60, chord: 0.75, wash: 0.6,
    w: [[FIN, .5], [B3.T, .3], [B2.T, .2]] });
  strips.push({ kind: 'fin', area: 0.45, chord: 0.65, wash: 0.6,
    w: [[FIN, .2], [B3.T, .5], [B2.T, .3]] });

  const refs = {
    noseFrame: [P[0].BL, P[0].BR, P[0].ML, P[0].MR],
    tailMid: [B2.T, B2.L, B2.R],
    upLo: [P[1].BL, P[1].BR], upHi: [P[1].ML, P[1].MR],
    fusDrag: [P[1].BL, P[1].BR, P[1].ML, P[1].MR],
    fusDragAft: [B2.T, B2.L, B2.R],
    engine: [EM], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Birdman Chinook 1S', viewDist: 12, substeps: 48,
    powerplant: 'rotax277_pusher',
    nEngines: 1,
    polarWing: POLARS.chinook_wing_AR87, polarTail: POLARS.fabric_tail,
    elevTau: 0.62, rudTau: 0.62, ailTau: 0.50, downwash: 0.32,
    stabTrim: -0.0359, sparSpacing: 0.61,
    fusCdA: [0.59, 0.9, 0.9], fusCdAAft: [0, 0.50, 0.50],
    twSteer: 0.5,
    // flaperons: droop is an actual surface rotation (tau alpha-shift on the
    // ail-geared strips) + a little drag; partial droop for landing so the
    // ailerons keep authority in the flare (1.13*Vs stall history: margins!)
    flaps: { to: 0, ldg: 0.6, rate: 0.25, tau: 0.08, dCl0: 0.25, dCd0: 0.030, dAStall: 0.02, dCm0: -0.12 },
    ap: {
      VRot: 10, VClimbMin: 12, VClimb: 17, VCruise: 24, VAppr: 16, VTurn: 19,
      TORun: 105,                   // measured run to 2.5 m agl (W14 multi-hop)
      lookRoll: 25, lookAppr: 140, lookCruise: 220,
      hCruise: 120, hSafe: 12, xTurn: -2600, xAim: -520, gs: 0.068,
      thrFloor: 0.06,
      rollDe: 0.10, liftoffTh: 0.15, liftoffRamp: 0.12,
      climbThBase: 0.11, climbThGain: 0.025, thMax: 0.19,
      flareAgl: 3.5, flareRate: 0.08, aglGuard: 2,
      flareMode: 'vs', flareThr: 0.10, flareThMax: 0.14,
      VTailUp: 12, VStop: 0.3, slew: 2.2, thrCruise: 0.55, thrAppr: 0.35,
      brakeMax: 0.30, brakeRampRate: 0.20, VBrakeOn: 11, VBrakeRelease: 1.0,
      rateFilt: 0.14, attFilt: 0.65, pitchP: 1.2, pitchD: 0.55, pitchI: 0.10,
      // vsFloor RE-ANCHORED -0.11 -> -0.15 with the wing stiffening above.
      // holdVS clamps the PITCH command to [vsFloor, thMax], and -0.11 rad is
      // -6.30 deg: measured, the aeroplane sat at theta -6.30 EXACTLY, pinned
      // on the floor, climbing 0.48 m/s for ever (208 m against hCruise 120 on
      // a long leg — it never levels). The floppy wing used to wash out under
      // load and bleed the lift away; the braced one keeps it, so level flight
      // now wants theta -7.51 (= -0.131 rad) and the old floor could not reach
      // it. Swept: -0.13 still ends 23 m high, -0.14 holds 120.0 exactly (and
      // is the drone's value, the fleet's widest) but leaves 0.5 deg of margin;
      // -0.15 leaves 1.1 deg for gusts and turns and measures identically.
      // NOT a tuning knob turned until the gate went green: the floor was
      // marginal before and the stiffer wing made it inadequate.
      pitchCmdSlew: 0.7, vsP: 0.020, vsI: 0.040, vsFloor: -0.15, altVSGain: 0.10,
      vsFilt: 0.40, hdgP: 0.65, hdgD: 0.85, bankSlew: 0.25, rollP: 1.6, rollD: 0.6,
      betaK: 0.3, yawDampK: 0.45, ariK: 0.15, bankLim: 0.42,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// CESSNA 172S SKYHAWK — 1000 kg (2 crew + fuel), high strut-
// braced wing, TRICYCLE gear with steerable nosewheel. x aft.
// ============================================================
function buildC172() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_F = 8.0e5, C_F = 500, K_W = 2.2e6, C_W = 900, K_G = 1.6e5, C_G = 2600;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BG = (a, b) => B(a, b, K_G, C_G);

  const ST = [
    [0.60, 0.50, 0.15, 1.10, 25],
    [1.72, 0.60, 0.05, 1.42, 14],
    [2.56, 0.60, 0.05, 1.42, 14],
    [3.60, 0.50, 0.12, 1.30, 14],
    [5.00, 0.35, 0.30, 1.05, 11],
    [6.50, 0.22, 0.45, 0.85, 9],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, m]) => {
    const [BL, BR] = NM(x, yb, w, m, 'B');
    const [TL, TR] = NM(x, yt, w, m, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(7.95, 0.55, 0, 8, 'TPB'), TPT = N(7.95, 0.95, 0, 8, 'TPT');
  const S5 = F[5];
  B(TPB, TPT);
  B(S5.BL, TPB); B(S5.BR, TPB); B(S5.TL, TPT); B(S5.TR, TPT);
  B(S5.TL, TPB); B(S5.TR, TPB); B(S5.BL, TPT); B(S5.BR, TPT);

  const S0 = F[0];
  const MO = N(0.25, 0.58, 0, 155, 'ENG');            // IO-360 + prop + cowl
  B(MO, S0.TL); B(MO, S0.TR); B(MO, S0.BL); B(MO, S0.BR);
  nodes[F[1].BL].m += 50; nodes[F[1].BR].m += 50;      // crew
  nodes[F[2].BL].m += 40; nodes[F[2].BR].m += 40;      // pax
  nodes[F[3].BL].m += 12; nodes[F[3].BR].m += 12;      // bags

  // ---- high wing: constant chord inboard, taper outboard, 1.7 deg dihedral
  const zSt = [0.60, 2.30, 3.80, 5.50];
  const chord = z => z <= 2.5 ? 1.63 : 1.63 - (z - 2.5) * (1.63 - 1.13) / 3.0;
  const LEX = 1.50;
  const yW = z => 1.42 + Math.max(0, z - 0.6) * 0.030;
  const boxD = z => 0.12 * chord(z);
  const wf = { L: null, R: null };
  const mkWing = (sgn) => {
    const rootF = sgn > 0 ? F[1].TR : F[1].TL;
    const rootR = sgn > 0 ? F[2].TR : F[2].TL;
    const MF = [12, 8, 5];
    const WF = [], WR = [], BF = [], BR = [];
    zSt.slice(1).forEach((z, i) => {
      const c = chord(z);
      WF.push(N(LEX + 0.15 * c, yW(z), sgn * z, MF[i] + (i === 0 ? 45 : 0), 'WF'));  // fuel inboard
      WR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.026, sgn * z, MF[i] * 0.6, 'WR'));
      BF.push(N(LEX + 0.15 * c, yW(z) - boxD(z), sgn * z, Math.max(4, MF[i] * 0.35), 'WB'));
      BR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.026 - boxD(z) * 0.8, sgn * z, Math.max(3, MF[i] * 0.25), 'WB'));
    });
    const chF = [rootF, ...WF], chR = [rootR, ...WR], chB = [rootF, ...BF], chBR = [rootR, ...BR];
    for (let i = 0; i < zSt.length - 1; i++) {
      BW(chF[i], chF[i + 1]); BW(chR[i], chR[i + 1]);
      BW(chB[i], chB[i + 1]); BW(chBR[i], chBR[i + 1]);
      BW(chF[i + 1], chR[i + 1]); BW(chB[i + 1], chBR[i + 1]);
      BW(chF[i], chR[i + 1]); BW(chR[i], chF[i + 1]);
      BW(chB[i], chBR[i + 1]); BW(chBR[i], chB[i + 1]);
      BW(chF[i + 1], chB[i + 1]); BW(chF[i], chB[i + 1]); BW(chB[i], chF[i + 1]);
      BW(chR[i + 1], chBR[i + 1]); BW(chR[i], chBR[i + 1]); BW(chBR[i], chR[i + 1]);
      BW(chB[i + 1], chR[i + 1]); BW(chBR[i + 1], chF[i + 1]);
    }
    // lift struts to the lower fuselage — the Cessna signature
    const aF = sgn > 0 ? F[1].BR : F[1].BL, aR = sgn > 0 ? F[2].BR : F[2].BL;
    BW(aF, WF[0]); BW(aR, WR[0]); BW(aF, WR[0]); BW(aR, WF[0]);
    BW(aF, BF[0]); BW(aR, BR[0]);
    wf[sgn > 0 ? 'R' : 'L'] = { F: chF, R: chR };
  };
  mkWing(+1); mkWing(-1);

  // ---- TRICYCLE gear: sprung mains aft of CG, steerable nosewheel ahead.
  // Geometry calibrated against the 3D model (MODEL-IMPORT-PROC step 2):
  //   track 2.62 m (was 2.52), wheelbase 1.74 m (was 1.97 — the model and the
  //   real 172 are both ~1.7), tyre radii 0.173/0.174 measured off the meshes
  //   (were 0.28/0.24), and a LEVEL static stance: the model sits level on its
  //   gear, the old fiche sat 2.7 deg nose down.
  // The smaller tyres also drop the airframe 10 cm: the wing now rides 2.25 m
  // over the ground (was 2.35, real 172 ~2.2), which is what ground effect
  // reads. Do NOT shorten the legs further to chase the model's 1.95 m — the
  // axle attaches to the fuselage bottom rail at y 0.05 and |z| 0.60, so at
  // this track the legs already splay ~47 deg; take the drop below ~0.55 and
  // the gear goes over-centre and folds up under static load.
  const [GAL, GAR] = NM(2.72, -0.60, 1.31, 14, 'AXLE', 0.173);
  BG(GAL, GAR);
  for (const [G, sgn] of [[GAL, -1], [GAR, 1]]) {
    const b2 = sgn > 0 ? F[2].BR : F[2].BL, b3 = sgn > 0 ? F[3].BR : F[3].BL;
    const b1 = sgn > 0 ? F[1].BR : F[1].BL, bo = sgn > 0 ? F[2].BL : F[2].BR;
    BG(G, b2); BG(G, b3); BG(G, b1); BG(G, bo);
  }
  const NW = N(0.983, -0.566, 0, 10, 'TW', 0.174);     // nosewheel (steerable ref)
  BG(NW, S0.BL); BG(NW, S0.BR); BG(NW, F[1].BL); BG(NW, F[1].BR);

  // ---- tail
  const [HTL, HTR] = NM(7.55, 0.90, 1.72, 8, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S5.BL); B(HTL, S5.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S5.BR); B(HTR, S5.TR);
  const FIN = N(7.75, 2.10, 0, 9, 'FIN');
  B(FIN, TPT); B(FIN, S5.TL); B(FIN, S5.TR); B(FIN, TPB);

  // ---- strips
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, area, ch, side, o = {}) => {
    strips.push({ kind: 'wing', side, t: 0.5, area, chord: ch,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * 0.5], [fOut, cf * 0.5], [rIn, cr * 0.5], [rOut, cr * 0.5]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 2.77, 1.63, side, { wash: 0.45, flap: 1 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 2.31, 1.54, side, { ail: 0.4 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 2.12, 1.27, side, { ail: 1 });
  }
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 1.96, 1.63, 1, { wash: 0.9, flap: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 1.85, chord: 1.20, wash: 0.55,
      w: [[nHT, .55], [TPB, .25], [TPT, .2]] });
  }
  strips.push({ kind: 'fin', area: 0.95, chord: 1.10, wash: 0.55,
    w: [[FIN, .5], [TPT, .3], [TPB, .2]] });
  strips.push({ kind: 'fin', area: 0.70, chord: 0.95, wash: 0.55,
    w: [[FIN, .2], [TPT, .45], [TPB, .35]] });

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    upLo: [F[1].BL, F[1].BR], upHi: [F[1].TL, F[1].TR],
    fusDrag: [F[1].BL, F[1].BR, F[1].TL, F[1].TR],
    fusDragAft: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    engine: [MO], mains: [GAL, GAR], tw: NW, fin: FIN,
  };
  const params = {
    name: 'Cessna 172S Skyhawk', viewDist: 13, substeps: 48,
    powerplant: 'io360_mccauley',
    nEngines: 1,
    polarWing: POLARS.naca2412_AR75, polarTail: POLARS.metal_tail_c172,
    elevTau: 0.48, rudTau: 0.50, ailTau: 0.35, downwash: 0.40,
    stabTrim: 0.0006, sparSpacing: 0.82,
    fusCdA: [0.46, 1.0, 1.0], fusCdAAft: [0, 0.70, 0.70],
    // nosewheel. Sign verified: the solver turns the rolling direction by
    // -twSteer*dr about +y, so negative points the NOSE wheel left for
    // nose-left (a tailwheel wants the positive sign the taildraggers use).
    twSteer: -0.35,
    // barn-door Fowler-ish flaps 30: calibrated in the free-air tunnel against
    // POH Vs0 ~40-42 kt vs Vs1 46 (see test_flaps.js)
    // dCm0 ~ -0.25*dCl0 (thin-airfoil TE device): weaker values let the flap
    // lift increment pitch the nose UP and the AP ballooned above the slope
    flaps: { to: 0, ldg: 1, rate: 0.14, dCl0: 1.15, dCd0: 0.065, dAStall: 0.02, dCm0: -0.29 },
    ap: {
      rotate: true,
      VRot: 28, VClimbMin: 32, VClimb: 38, VCruise: 58, VAppr: 33.5, VTurn: 44,
      TORun: 400,                   // measured run to 2.5 m agl (W14 multi-hop)
      thTailUp: 0.02, thRotate: 0.10,
      lookRoll: 35, lookAppr: 320, lookCruise: 450,
      hCruise: 180, hSafe: 20, xTurn: -3800, xAim: -640, gs: 0.052,
      thrFloor: 0.05,
      rollDe: 0.02, liftoffTh: 0.13, liftoffRamp: 0.10,
      climbThBase: 0.10, climbThGain: 0.020, thMax: 0.17,
      flareAgl: 5.5, flareRate: 0.055, aglGuard: 3,
      flareMode: 'vs', flareThr: 0.10, flareThMax: 0.10,
      rolloutMode: 'trike', VDerotate: 16, rolloutTh: 0.035,
      VTailUp: 99, VStop: 0.4, slew: 1.8, thrCruise: 0.62, thrAppr: 0.32,
      brakeMax: 0.28, brakeRampRate: 0.12, VBrakeOn: 24, VBrakeRelease: 1.5,
      rateFilt: 0.15, attFilt: 0.70, pitchP: 1.2, pitchD: 0.90, pitchI: 0.12,
      pitchCmdSlew: 0.8, vsP: 0.019, vsI: 0.042, vsFloor: -0.10, altVSGain: 0.09,
      vsFilt: 0.40, hdgP: 0.6, hdgD: 0.9, bankSlew: 0.22, rollP: 1.5, rollD: 0.45,
      betaK: 0.3, yawDampK: 0.4, ariK: 0.15, bankLim: 0.45,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// JODEL DR-1050 SICILE "SPEEDJOJO" — 650 kg en config 2 pers.,
// aile cassee Jodel (diedre 14 deg externe), train classique.
// Cellule nettoyee : capot carbone, roulette carenee. x arriere.
// ============================================================
function buildJodel() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_F = 4.0e5, C_F = 300, K_W = 2.5e6, C_W = 950, K_G = 1.3e5, C_G = 2400;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BG = (a, b) => B(a, b, K_G, C_G);

  const ST = [
    [0.55, 0.42, 0.10, 0.95, 12],
    [1.45, 0.52, 0.02, 1.10, 10],
    [2.15, 0.55, 0.00, 1.15, 9],
    [3.00, 0.55, 0.00, 1.12, 9],
    [4.30, 0.35, 0.15, 0.80, 6],
    [5.60, 0.18, 0.32, 0.62, 5],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, m]) => {
    const [BL, BR] = NM(x, yb, w, m, 'B');
    const [TL, TR] = NM(x, yt, w, m, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(6.25, 0.40, 0, 4, 'TPB'), TPT = N(6.25, 0.72, 0, 4, 'TPT');
  const S5 = F[5];
  B(TPB, TPT);
  B(S5.BL, TPB); B(S5.BR, TPB); B(S5.TL, TPT); B(S5.TR, TPT);
  B(S5.TL, TPB); B(S5.TR, TPB); B(S5.BL, TPT); B(S5.BR, TPT);

  // O-200 + capot + helice sur cloison pare-feu
  const S0 = F[0];
  const MO = N(0.10, 0.48, 0, 85, 'ENG');
  B(MO, S0.TL); B(MO, S0.TR); B(MO, S0.BL); B(MO, S0.BR);
  // equipage avant (2 x 45 kg), essence (55 kg), amenagement cabine
  nodes[F[2].BL].m += 22; nodes[F[2].BR].m += 22;
  nodes[F[3].BL].m += 45; nodes[F[3].BR].m += 45;
  nodes[F[4].BL].m += 5; nodes[F[4].BR].m += 5;   // batterie LiFePO4 en soute
  nodes[F[2].TL].m += 12; nodes[F[2].TR].m += 12;
  nodes[F[3].TL].m += 10; nodes[F[3].TR].m += 10;

  // ---- aile Jodel : panneau central plat, cassure a z=2.10, diedre 14 deg
  const zSt = [0.55, 2.10, 3.30, 4.36];
  const chord = z => z <= 2.10 ? 1.71 : 1.71 - 0.3363 * (z - 2.10);
  const LEX = 1.80;
  const yW = z => 0.10 + Math.max(0, z - 2.10) * 0.249;
  const boxD = z => 0.13 * chord(z);
  const wf = { L: null, R: null }, keel = { L: null, R: null };
  const mkWing = (sgn) => {
    const rootF = sgn > 0 ? F[2].BR : F[2].BL;
    const rootR = sgn > 0 ? F[3].BR : F[3].BL;
    // quille : le longeron traverse le plancher a pleine hauteur
    const cR = chord(0.55);
    const KF = N(LEX + 0.15 * cR, yW(0.55) - boxD(0.55), sgn * 0.55, 6, 'WB');
    const KR = N(LEX + 0.65 * cR, yW(0.55) - 0.5 * cR * 0.035 - boxD(0.55) * 0.8, sgn * 0.55, 4, 'WB');
    const F2o = sgn > 0 ? F[2].BL : F[2].BR, F3o = sgn > 0 ? F[3].BL : F[3].BR;
    BW(KF, rootF); BW(KF, F2o); BW(KF, rootR);
    BW(KR, rootR); BW(KR, F3o); BW(KR, rootF);
    BW(KF, KR);
    keel[sgn > 0 ? 'R' : 'L'] = { KF, KR };
    const MF = [10, 6, 4];
    const WF = [], WR = [], BF = [], BR = [];
    zSt.slice(1).forEach((z, i) => {
      const c = chord(z);
      WF.push(N(LEX + 0.15 * c, yW(z), sgn * z, MF[i], 'WF'));
      WR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.035, sgn * z, MF[i] * 0.6, 'WR'));
      BF.push(N(LEX + 0.15 * c, yW(z) - boxD(z), sgn * z, Math.max(3.0, MF[i] * 0.35), 'WB'));
      BR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.035 - boxD(z) * 0.8, sgn * z, Math.max(2.5, MF[i] * 0.25), 'WB'));
    });
    const chF = [rootF, ...WF], chR = [rootR, ...WR], chB = [KF, ...BF], chBR = [KR, ...BR];
    for (let i = 0; i < zSt.length - 1; i++) {
      BW(chF[i], chF[i + 1]); BW(chR[i], chR[i + 1]);
      BW(chB[i], chB[i + 1]); BW(chBR[i], chBR[i + 1]);
      BW(chF[i + 1], chR[i + 1]);                            // nervure haute
      BW(chB[i + 1], chBR[i + 1]);                           // nervure basse
      BW(chF[i], chR[i + 1]); BW(chR[i], chF[i + 1]);        // treillis superieur
      BW(chB[i], chBR[i + 1]); BW(chBR[i], chB[i + 1]);      // treillis inferieur
      BW(chF[i + 1], chB[i + 1]);                            // montant ame avant
      BW(chF[i], chB[i + 1]); BW(chB[i], chF[i + 1]);        // cisaillement avant
      BW(chR[i + 1], chBR[i + 1]);                           // montant ame arriere
      BW(chR[i], chBR[i + 1]); BW(chBR[i], chR[i + 1]);      // cisaillement arriere
      BW(chB[i + 1], chR[i + 1]); BW(chBR[i + 1], chF[i + 1]); // diagonales caisson
    }
    wf[sgn > 0 ? 'R' : 'L'] = { F: chF, R: chR };
  };
  mkWing(+1); mkWing(-1);
  const KB = (a, b) => beams.push({ a, b, k: K_W, c: C_W, gear: false });
  KB(keel.L.KF, keel.R.KF); KB(keel.L.KR, keel.R.KR);
  KB(keel.L.KF, keel.R.KR); KB(keel.R.KF, keel.L.KR);

  // ---- train classique : jambes sous la cassure, roulette carenee
  const [GAL, GAR] = NM(1.82, -0.62, 1.05, 8, 'AXLE', 0.21);
  BG(GAL, GAR);
  for (const [G, side] of [[GAL, 'L'], [GAR, 'R']]) {
    const w = wf[side];
    const f1 = side === 'L' ? F[1].BL : F[1].BR;   // reprise de trainee vers l'avant
    BG(G, w.F[0]); BG(G, w.F[1]); BG(G, w.R[1]); BG(G, f1);
  }
  const TW = N(5.95, -0.08, 0, 3, 'TW', 0.09);
  BG(TW, S5.BL); BG(TW, S5.BR); BG(TW, TPB);

  // ---- empennage
  const [HTL, HTR] = NM(5.95, 0.55, 1.05, 3, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S5.BL); B(HTL, S5.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S5.BR); B(HTR, S5.TR);
  const FIN = N(6.05, 1.35, 0, 3, 'FIN');
  B(FIN, TPT); B(FIN, S5.TL); B(FIN, S5.TR);

  // ---- bandes aero
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, area, ch, side, o = {}) => {
    strips.push({ kind: 'wing', side, t: 0.5, area, chord: ch,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * 0.5], [fOut, cf * 0.5], [rIn, cr * 0.5], [rOut, cr * 0.5]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 2.65, 1.71, side, { wash: 0.35, flap: 1 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 1.81, 1.51, side, { ail: 0.5 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 1.20, 1.13, side, { ail: 1 });
  }
  wingStrip(F[2].BL, F[2].BR, F[3].BL, F[3].BR, 1.90, 1.71, 1, { wash: 0.9, flap: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 1.15, chord: 0.95, wash: 0.85,
      w: [[nHT, .55], [TPB, .25], [TPT, .2]] });
  }
  strips.push({ kind: 'fin', area: 0.65, chord: 0.85, wash: 0.85,
    w: [[FIN, .5], [TPT, .3], [TPB, .2]] });
  strips.push({ kind: 'fin', area: 0.50, chord: 0.75, wash: 0.85,
    w: [[FIN, .2], [TPT, .45], [TPB, .35]] });

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    upLo: [F[1].BL, F[1].BR], upHi: [F[1].TL, F[1].TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    engine: [MO], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Jodel DR-1050 "Speedjojo"', viewDist: 11, substeps: 48,
    powerplant: 'o200_eprops',
    nEngines: 1,
    polarWing: POLARS.jodel_wing_AR55, polarTail: POLARS.wood_tail,
    elevTau: 0.48, rudTau: 0.50, ailTau: 0.35, downwash: 0.38,
    stabTrim: -0.0411, sparSpacing: 0.75,
    fusCdA: [0.095, 0.50, 0.50], fusCdAAft: [0, 0.32, 0.32],
    twSteer: 0.45,
    // small plain flaps inboard
    // ldg 0.65: full deflection of these small plain flaps made the flare
    // harsh (sink 1.45, rollout nose-dip -8.4, gear strain 3x) for little gain
    flaps: { to: 0, ldg: 0.65, rate: 0.18, dCl0: 0.55, dCd0: 0.040, dAStall: 0.015, dCm0: -0.14 },
    ap: {
      rotate: true,
      VRot: 27, VClimbMin: 30, VClimb: 41.7, VCruise: 62, VAppr: 33, VTurn: 45,
      TORun: 410,                   // measured run to 2.5 m agl (W14 multi-hop)
      thTailUp: 0.030, thRotate: 0.11,
      lookRoll: 30, lookAppr: 300, lookCruise: 420,
      hCruise: 160, hSafe: 20, xTurn: -3600, xAim: -560, gs: 0.045,
      thrFloor: 0.05,
      rollDe: 0.08, liftoffTh: 0.13, liftoffRamp: 0.10,
      climbThBase: 0.10, climbThGain: 0.022, thMax: 0.18,
      flareAgl: 4.0, flareRate: 0.055, aglGuard: 3,
      flareMode: 'vs', flareThr: 0.06, flareThMax: 0.11,
      VTailUp: 14, VStop: 0.4, slew: 2.0, thrCruise: 0.62, thrAppr: 0.32,
      // GE retune (session 1): coasting from touchdown 32 m/s down to 12
      // before braking overran the runway once ground effect trimmed the
      // rolling friction; was VBrakeOn 12 (overran to x=+51).
      brakeMax: 0.30, brakeRampRate: 0.14, VBrakeOn: 20, VBrakeRelease: 1.5,
      rateFilt: 0.18, attFilt: 0.60, pitchP: 1.3, pitchD: 0.70, pitchI: 0.12,
      pitchCmdSlew: 1.0, vsP: 0.014, vsI: 0.030, vsFloor: -0.10, altVSGain: 0.10,
      // W16 lateral quiet: 1.1/0.30 limit-cycled 11 deg of REAL bank at
      // 1.8 Hz (28 deg aileron p2p) — an aileron-loop instability, proven
      // by the freeze test (rollP=rollD=0 -> dead calm; rudder freeze
      // changed nothing, so NOT dutch roll; raising servo slew made it
      // WORSE). rollP 0.5/rollD 0.15 kills it; hdgP 0.5 -> 0.65
      // compensates the softer roll loop for capture + decrab (measured:
      // calm tdZ 2.4, crosswind tdDrift -0.24 / tdZ 2.9 — better than
      // the OLD gains' -1.64 / -6.9). Pure-roll candidates failed the
      // crosswind drift bound: quiet needs the course loop to carry more.
      vsFilt: 0.40, hdgP: 0.65, hdgD: 0.8, bankSlew: 0.20, rollP: 0.5, rollD: 0.15,
      betaK: 0.3, yawDampK: 0.35, ariK: 0.0, bankLim: 0.48,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// FOAM TRAINER — 1.4 m span shoulder-wing electric trainer,
// ~1.15 kg AUW. Same solver, different fiche.
// ============================================================
function buildDrone() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  // K_G 420 -> 1100 (2026-08): the wire legs collapsed in the reset ground-eject
  // and the bare TPB tail node ended up resting ON the terrain with the
  // tailwheel floating 17 mm above it. C_G stays 9: the 10 g TW node is at the
  // c*dt/m damping limit already.
  const K_F = 3000, C_F = 3.5, K_W = 25000, C_W = 11, K_G = 1100, C_G = 9;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BG = (a, b) => B(a, b, K_G, C_G);

  const MN = 0.016;                    // typical foam node
  const ST = [                         // [x, halfW, yBot, yTop]
    [0.03, 0.045, 0.00, 0.105],
    [0.31, 0.050, -0.005, 0.115],
    [0.42, 0.050, -0.005, 0.115],
    [0.64, 0.035, 0.015, 0.085],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt]) => {
    const [BL, BR] = NM(x, yb, w, MN, 'B');
    const [TL, TR] = NM(x, yt, w, MN, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(0.92, 0.025, 0, MN, 'TPB'), TPT = N(0.92, 0.085, 0, MN, 'TPT');
  const S3 = F[3];
  const BT = (a, b) => B(a, b, 12000, 8);      // carbon boom
  BT(TPB, TPT);
  BT(S3.BL, TPB); BT(S3.BR, TPB); BT(S3.TL, TPT); BT(S3.TR, TPT);
  BT(S3.TL, TPB); BT(S3.TR, TPB); BT(S3.BL, TPT); BT(S3.BR, TPT);

  // motor on a short mount (mass from powerplant registry)
  const S0 = F[0];
  const MO = N(-0.045, 0.055, 0, 0.10, 'ENG');
  B(MO, S0.TL); B(MO, S0.TR); B(MO, S0.BL); B(MO, S0.BR);
  // battery pack under the wing LE (CG at ~29% MAC), 0.19 kg
  nodes[F[1].BL].m += 0.095; nodes[F[1].BR].m += 0.095;

  // shoulder wing: two spars at 15% / 60% of 0.25 m chord, 4 deg dihedral
  const wf = { L: null, R: null }, keel = { L: null, R: null };
  const mkWing = (sgn) => {
    const rootF = sgn > 0 ? F[1].TR : F[1].TL, rootR = sgn > 0 ? F[2].TR : F[2].TL;
    const anchB = sgn > 0 ? F[1].BR : F[1].BL;   // bottom chord root
    const zs = [0.36, 0.68], DIH = 0.070, MW = 0.045, MB = 0.020;
    const WF = zs.map(z => N(0.31, 0.115 + (z - 0.05) * DIH, sgn * z, MW, 'WF'));
    const WR = zs.map(z => N(0.42, 0.115 + (z - 0.05) * DIH, sgn * z, MW, 'WR'));
    // spar-box bottom chord under the front spar (real bending depth)
    const BF = zs.map(z => N(0.31, 0.060 + (z - 0.05) * DIH, sgn * z, MB, 'WB'));
    // top surface
    BW(rootF, WF[0]); BW(WF[0], WF[1]);
    BW(rootR, WR[0]); BW(WR[0], WR[1]);
    BW(WF[0], WR[0]); BW(WF[1], WR[1]);
    BW(rootF, WR[0]); BW(WF[0], WR[1]); BW(WR[0], WF[1]);
    // spar web: bottom chord, verticals, shear diagonals
    BW(anchB, BF[0]); BW(BF[0], BF[1]);
    BW(WF[0], BF[0]); BW(WF[1], BF[1]);
    BW(rootF, BF[0]); BW(anchB, WF[0]);
    BW(WF[0], BF[1]); BW(BF[0], WF[1]);
    // torsion box: bottom chord to rear spar
    BW(BF[0], WR[0]); BW(BF[1], WR[1]); BW(BF[0], WR[1]); BW(BF[0], rootR);
    // legacy fan retained as redundant bracing
    BW(anchB, WF[1]); BW(anchB, WR[0]); BW(anchB, WR[1]);
    wf[sgn > 0 ? 'R' : 'L'] = { F: [rootF, ...WF], R: [rootR, ...WR] };
  };
  mkWing(+1); mkWing(-1);

  // tail surfaces
  const [HTL, HTR] = NM(0.88, 0.055, 0.28, 0.012, 'HT');
  BT(HTL, TPB); BT(HTL, TPT); BT(HTL, S3.TL); BT(HTL, S3.BL);
  BT(HTR, TPB); BT(HTR, TPT); BT(HTR, S3.TR); BT(HTR, S3.BR);
  const FIN = N(0.90, 0.24, 0, 0.012, 'FIN');
  BT(FIN, TPT); BT(FIN, S3.TL); BT(FIN, S3.TR);

  // taildragger gear: wire mains + tailskid
  const [GAL, GAR] = NM(0.12, -0.115, 0.13, 0.022, 'AXLE', 0.030);
  BG(GAL, GAR);
  BG(GAL, S0.BL); BG(GAL, F[1].BL); BG(GAL, S0.BR);
  BG(GAR, S0.BR); BG(GAR, F[1].BR); BG(GAR, S0.BL);
  const TW = N(0.88, -0.005, 0, 0.010, 'TW', 0.015);
  BG(TW, TPB); BG(TW, S3.BL); BG(TW, S3.BR);
  // near-vertical member: without it the shallow leg tripod snap-throughs
  // during the reset ground-eject and latches FOLDED UP (TW above the tail
  // post, bare TPB resting on the terrain) — the Jodel rule-7 pathology.
  BG(TW, TPT);

  // ---- aero strips: chord 0.25, spar weights c/4 between 15%/60% spars ----
  const strips = [];
  const cf = 0.78, cr = 0.22;
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, side, o = {}) => {
    strips.push({ kind: 'wing', side, t, area, chord: 0.25,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 0.30, 0.31 * 0.25, side, { wash: 0.4 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 0.60, 0.32 * 0.25, side, { ail: 1 });
  }
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 0.5, 0.10 * 0.25, 1, { wash: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.028, chord: 0.14, wash: 1,
      w: [[nHT, .55], [TPB, .25], [TPT, .2]] });
  }
  strips.push({ kind: 'fin', area: 0.022, chord: 0.13, wash: 1,
    w: [[FIN, .45], [TPT, .3], [TPB, .25]] });

  const refs = {
    noseFrame: [S0.BL, S0.BR, S0.TL, S0.TR],
    tailMid: [S3.BL, S3.BR, S3.TL, S3.TR],   // rigid box, not the whippy boom
    upLo: [S0.BL, S0.BR], upHi: [S0.TL, S0.TR],
    fusDrag: [F[1].BL, F[1].BR, F[1].TL, F[1].TR],
    fusDragAft: [F[3].BL, F[3].BR, F[3].TL, F[3].TR],
    engine: [MO], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Foam Trainer 1.4m', viewDist: 3.2, substeps: 48,
    powerplant: 'outrunner2212_9x47',
    nEngines: 1,
    polarWing: POLARS.foam_wing_AR56, polarTail: POLARS.foam_tail,
    elevTau: 0.55, rudTau: 0.60, ailTau: 0.45, downwash: 0.35,
    stabTrim: -0.0781, sparSpacing: 0.11,
    fusCdA: [0.012, 0.03, 0.03], fusCdAAft: [0, 0.02, 0.02],
    twSteer: 0.75,
    ap: {
      VRot: 4.5, VClimbMin: 8.5, VClimb: 10, VCruise: 13, VAppr: 9,
      TORun: 15,                    // measured run to 2.5 m agl (W14 multi-hop)
      hCruise: 60, hSafe: 8, xTurn: -900, xAim: -430, gs: 0.075,
      rollDe: 0.05, liftoffTh: 0.17, climbThBase: 0.13, climbThGain: 0.030,
      thMax: 0.22, flareAgl: 2.2, flareRate: 0.10, aglGuard: 1.5,
      flareThMax: 0.16, flareThr: 0.15, flareMode: 'vs',
      VTailUp: 7.5, VStop: 0.3, slew: 2.5, thrCruise: 0.55, thrAppr: 0.30,
      liftoffRamp: 0.12,
      brakeMax: 0.25, brakeRampRate: 0.25, VBrakeOn: 5, VBrakeRelease: 0.8,
      rateFilt: 0.20, attFilt: 0.45, pitchP: 1.0, pitchD: 0.12, pitchI: 0.10,
      vsP: 0.018, vsI: 0.055, vsFloor: -0.14, altVSGain: 0.15,
      vsFilt: 0.25, pitchCmdSlew: 0.6,
      hdgP: 0.9, hdgD: 0.5, bankSlew: 0.7, rollP: 2.0, rollD: 0.25,
      betaK: 0.3, yawDampK: 0.3, ariK: 0.3, bankLim: 0.35,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// PIPER PA-18 SUPER CUB — the J-3 fiche (byte-copy geometry: same
// nodes/beams/masses, so the PA-18 skin calibration carries) plus the
// PA-18's slotted flaps. Carries the 3D flexbody skin (src/models/
// pa18_model.js); the J-3 stays wireframe and may retire later.
// ============================================================
function buildPA18() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_CH = 2.0e5, C_CH = 60, K_GR = 2.8e4, C_GR = 900, K_WG = 5.0e5, C_WG = 450;
  const B = (a, b, k = K_CH, c = C_CH) => beams.push({ a, b, k, c, gear: k === K_GR });
  const BG = (a, b) => B(a, b, K_GR, C_GR);

  const ST = [                       // [x, halfW, yBot, yTop, nodeMass]
    [0.00, 0.33,  0.00, 0.78, 3.0],
    [0.62, 0.36, -0.02, 1.00, 3.0],
    [1.40, 0.36, -0.02, 1.00, 3.0],
    [2.05, 0.30,  0.02, 0.74, 1.5],
    [2.85, 0.24,  0.08, 0.60, 1.5],
    [3.65, 0.17,  0.14, 0.48, 1.5],
    [4.45, 0.10,  0.20, 0.38, 1.5],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, mm], i) => {
    const [BL, BR] = NM(x, yb, w, mm, `S${i}B`);
    const [TL, TR] = NM(x, yt, w, mm, `S${i}T`);
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR);
    B(BL, TR); B(BR, TL);            // X-brace: mirror-symmetric shear
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1], alt = i % 2;
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(alt ? a.BL : a.TL, alt ? b.TL : b.BL);
    B(alt ? a.BR : a.TR, alt ? b.TR : b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL);    // top panel X
    B(a.BL, b.BR); B(a.BR, b.BL);    // bottom panel X
  }
  const TPB = N(5.12, 0.25, 0, 1.2, 'TPB'), TPT = N(5.12, 0.36, 0, 1.2, 'TPT');
  const S6 = F[6];
  B(TPB, TPT);
  B(S6.BL, TPB); B(S6.BR, TPB); B(S6.TL, TPT); B(S6.TR, TPT);
  B(S6.TL, TPB); B(S6.TR, TPB);

  const [EL, ER] = NM(-0.48, 0.36, 0.20, 40, 'ENG');   // engine+prop ~80 kg
  const S0 = F[0];
  B(EL, ER);
  B(EL, S0.TL); B(EL, S0.BL); B(EL, S0.BR);
  B(ER, S0.TR); B(ER, S0.BR); B(ER, S0.BL);
  nodes[S0.TL].m += 18; nodes[S0.TR].m += 18;          // fuel 36 kg at firewall

  const [GAL, GAR] = NM(0.55, -0.80, 0.89, 6, 'AXLE', 0.20);
  BG(GAL, GAR);
  BG(GAL, S0.BL); BG(GAL, F[1].BL); BG(GAL, S0.BR);
  BG(GAR, S0.BR); BG(GAR, F[1].BR); BG(GAR, S0.BL);
  const TW = N(5.02, 0.02, 0, 3, 'TW', 0.10);
  BG(TW, TPB); BG(TW, S6.BL); BG(TW, S6.BR);
  // snap-blocking near-vertical member (structural rule 10, the drone cure):
  // without it the tailwheel folds UP about TPB and LATCHES (bare post on
  // the terrain) when parked in a tailwind — reset slam + breeze, W13.
  BG(TW, TPT);

  const MW = 8, wf = { L: null, R: null };
  const mkWing = (s) => {
    const B = (a, b) => beams.push({ a, b, k: K_WG, c: C_WG, gear: false });
    const rootF = s > 0 ? F[1].TR : F[1].TL, rootR = s > 0 ? F[2].TR : F[2].TL;
    const strut = s > 0 ? F[1].BR : F[1].BL;
    const zs = [1.9, 3.4, 5.0], DIH = 0.0524;   // 3 deg dihedral (tan)
    const WF = zs.map(z => N(0.62, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WF'));
    const WR = zs.map(z => N(1.40, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WR'));
    B(rootF, WF[0]); B(WF[0], WF[1]); B(WF[1], WF[2]);
    B(rootR, WR[0]); B(WR[0], WR[1]); B(WR[1], WR[2]);
    B(WF[0], WR[0]); B(WF[1], WR[1]); B(WF[2], WR[2]);
    B(rootF, WR[0]); B(WF[0], WR[1]); B(WF[1], WR[2]);
    B(WR[0], WF[1]); B(WR[1], WF[2]);
    B(strut, WF[1]); B(strut, WR[1]); B(strut, WF[0]);
    B(strut, WR[0]); B(strut, WF[2]); B(strut, WR[2]);
    wf[s > 0 ? 'R' : 'L'] = { F: [rootF, ...WF], R: [rootR, ...WR] };
  };
  mkWing(+1); mkWing(-1);

  const [HTL, HTR] = NM(4.92, 0.30, 1.05, 4, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S6.BL); B(HTL, S6.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S6.BR); B(HTR, S6.TR);
  // stab<->tailwheel pyramid (rule 10, the chinook cure): the fold that
  // survives the TW->TPT block is LATERAL (dTW body [+0.28 up, 0.25
  // sideways], measured) — wide anchors kill it
  BG(TW, HTL); BG(TW, HTR);
  const FIN = N(5.05, 0.95, 0, 4, 'FIN');
  B(FIN, TPT); B(FIN, S6.TL); B(FIN, S6.TR);

  nodes[F[1].BL].m += 38; nodes[F[1].BR].m += 38;      // pilot, front seat

  // ---------- aero strips ----------
  const strips = [];
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, side, o = {}) => {
    const cf = 0.795, cr = 0.205;   // c/4 sits between the spars at 79.5/20.5
    strips.push({ kind: 'wing', side, t, area, chord: 1.6,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  const bays = (fr, side) => {
    const bw = [1.54, 1.5, 1.6];
    // flaps span |z| 0.43..2.06 (model voletG/D) = the inboard bay
    for (let b = 0; b < 3; b++)
      for (const t of [0.28, 0.78])
        wingStrip(fr.F[b], fr.F[b + 1], fr.R[b], fr.R[b + 1], t, bw[b] * 1.6 / 2,
          side, { wash: b === 0 && t < 0.5 ? 0.5 : 0, ail: b === 2 ? 1 : 0,
                  flap: b === 0 ? 1 : 0 });
  };
  bays(wf.R, 1); bays(wf.L, -1);
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 0.5, 0.72 * 1.6, 1, { wash: 1 });

  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.65, chord: 0.9, wash: 0.6,
      w: [[nHT, .5], [TPB, .3], [TPT, .2]] });
    strips.push({ kind: 'stab', side, area: 0.50, chord: 0.9, wash: 0.6,
      w: [[nHT, .25], [TPB, .45], [TPT, .3]] });
  }
  strips.push({ kind: 'fin', area: 1.00, chord: 0.9, wash: 1,
    w: [[FIN, .4], [TPT, .35], [TPB, .25]] });

  const refs = {
    noseFrame: [S0.BL, S0.BR, S0.TL, S0.TR], tailMid: [TPB, TPT],
    upLo: [S0.BL, S0.BR], upHi: [S0.TL, S0.TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[5].BL, F[5].BR, F[5].TL, F[5].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Piper PA-18 Super Cub', viewDist: 14,
    powerplant: 'a65_sensenich74',
    nEngines: 1,                    // one engine, two mount nodes (see cub)
    polarWing: POLARS.usa35b_AR7, polarTail: POLARS.flat_tail_cub,
    elevTau: 0.50, rudTau: 0.55, ailTau: 0.35, downwash: 0.40,
    stabTrim: -0.0983, sparSpacing: 0.78,
    fusCdA: [0.55, 0.8, 0.8], fusCdAAft: [0, 0.5, 0.5],
    twSteer: 0.5,
    // slotted flaps, inboard bay only: tunnel-calibrated to the POH Vs ratio
    // (43/48 mph flaps/clean = 0.90; measured 0.900 at dCl0 1.6).
    // dCm0 ~ -0.25*dCl0 (HANDOVER "watch Cm0")
    flaps: { to: 0, ldg: 1, rate: 0.2, dCl0: 1.6, dCd0: 0.07, dAStall: 0.02, dCm0: -0.40 },
    // vs the J-3: slower flapped approach, power carried through the flare
    // (flap drag is ~2x — throttle-cut flares arrived at sink 2.0), earlier
    // flare, gentler brakes (full flap + hard brakes nosed it over).
    // Measured: td sink 0.78, three-point 15.3 deg, no noseover.
    ap: {
      VRot: 15, VClimbMin: 20, VClimb: 21, VCruise: 26, VAppr: 20.5,
      VApprShort: 18.5,             // fly-in strips < 450 m (1.37*Vs flapped)
      // RE-ANCHORED G4.9 (was 60): the engine-count fix halved this aeroplane's
      // thrust, and the run to 2.5 m agl went 67 m -> 151 m. Re-read off
      // tools/make_perf.js, not adjusted by hand.
      TORun: 151,                   // measured run to 2.5 m agl
      // W16 lateral quiet: the default rollD 2.0 on the RF-lagged rate
      // estimate limit-cycled the aileron 8-12 deg p2p at ~4 Hz (bank
      // barely moved — surface flail + wing rock, user-visible on the
      // skin). 0.8 kills it dead (0.2 deg residual); doctrine says lower
      // D, and measured: a FASTER rate filter makes it worse.
      rollD: 0.8,
      VPinFull: 16,                 // moderate aft above this in rollout (hop guard)
      hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
      rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
      // flareThr 0.12 -> 0.24 (G4.9): `flareThr` is a THROTTLE fraction, and the
      // engine-count fix halved what a fraction buys. The flare keeps the
      // THRUST it was tuned with — 0.12*1800 N == 0.24*900 N — rather than the
      // lever position, which is the only reading of "unchanged" that means
      // anything here. Sink 1.71 (over the 1.5 bound) -> 0.95, against 0.78
      // before the fix.
      thMax: 0.20, flareAgl: 5.5, flareRate: 0.062, flareThr: 0.24, aglGuard: 3,
      VTailUp: 12, VTailDown: 99, VStop: 0.4, slew: 1.5, thrCruise: 0.70, thrAppr: 0.35,
      brakeMax: 0.18, brakeRampRate: 0.12, VBrakeOn: 7, VBrakeRelease: 1.5,
    },
  };
  return { nodes, beams, strips, refs, params };
}



// ============================================================
// WORLD — deterministic procedural terrain + trees, shared by
// physics and renderer. Integer-hash noise: identical across JS engines.
// v1 contract (futureDesigns/WORLD-CONTRACT.md) + v0 shim on one object.
// Seed 0 (or no argument) is the VALIDATED world, bit-identical to the
// pre-contract makeWorld(); nonzero seeds are coherent but unvalidated.
// GATE WORLD freezes seed-0 data with golden hashes — intentional terrain
// changes must re-capture goldens in the same commit.
// ============================================================
function makeWorld(seed) {
  const SEED = seed | 0;                     // undefined -> 0: no-arg callers get the validated world
  const SALT = Math.imul(SEED, 0x9E3779B9);  // 0 for seed 0 — exact identity in hash2/LCG below
  const smf = t => t * t * (3 - 2 * t);
  const sstep = (a, b, t) => smf(Math.min(1, Math.max(0, (t - a) / (b - a))));
  const hash2 = (ix, iz) => {
    let h = (ix * 374761393 + iz * 668265263 + 1013904223 + SALT) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function vnoise(x, z, cell) {
    const fx = x / cell, fz = z / cell;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = smf(fx - ix), tz = smf(fz - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz),
          c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  // W7: 5th octave (65 m) sharpens detail; the warp channels below are
  // deliberately 2-octave — h0 is the physics hot path (per node per
  // substep), full-fbm warp would double it
  const fbm = (x, z) =>
    vnoise(x, z, 1400) * 0.43 + vnoise(x + 91, z + 37, 650) * 0.29 +
    vnoise(x + 7, z + 211, 300) * 0.16 + vnoise(x + 313, z + 97, 140) * 0.08 +
    vnoise(x + 173, z + 419, 65) * 0.04;
  const ridge = (x, z, cell) => 1 - Math.abs(2 * vnoise(x + 555, z + 777, cell) - 1);
  const wnoise = (x, z) =>
    vnoise(x, z, 1400) * 0.65 + vnoise(x + 47, z + 61, 650) * 0.35;

  function h0(x, z) {
    // IQ-style domain warp (W7): displace the sampling point by two noise
    // channels before the main field — ridges curve, valleys wind, the
    // value-noise blobbiness dies. ⚙ WARP 320 m; the continental masks
    // get their own gentler warp (bays/headlands on the coast, a winding
    // mountain-belt edge) at ⚙ 700 m.
    const wq1 = wnoise(x + 1309, z + 3557), wq2 = wnoise(x - 911, z + 2129);
    const wx = x + 320 * (wq1 - 0.5), wz = z + 320 * (wq2 - 0.5);
    const n = fbm(wx, wz);
    // 24 km domain (W6): the mountain belt FALLS OFF beyond z~-6500 into
    // northern highlands/plains instead of extending as an endless plateau
    const mzw = z + 700 * (wq2 - 0.5);
    const mount = sstep(700, 3200, -mzw) * (1 - sstep(6500, 10500, -mzw));
    const sea = sstep(500, 2400, z + 700 * (wq1 - 0.5));
    const rid = ridge(wx, wz, 1100) * 0.6 + ridge(wx, wz, 520) * 0.4;
    let hm = (0.55 * (n - 0.3) + 0.65 * (rid - 0.35)) * 620 * mount;
    // W12 stage-5 cliffs: terrace the mountain component into strata
    // where it is high — flat treads + smoothstepped risers (C1 both
    // ends), band planes tilted by a coarse noise so strata dip like
    // real beds. Cheap amplitude gate instead of a slope probe: slope
    // cannot be computed inside the physics hot path. Risers steepen
    // locally and classify ROCK/SCREE through the existing slope rules.
    if (hm > 120) {
      const ST = 22, RW = 0.34;
      const t = (hm + (vnoise(wx + 888, wz + 1444, 700) - 0.5) * 16) / ST;
      const f = Math.floor(t), r = t - f;
      const terr = (f + smf(Math.min(1, Math.max(0, (r - (1 - RW) * 0.5) / RW)))) * ST;
      hm += (terr - hm) * 0.55 * sstep(120, 220, hm);
    }
    let h = (n - 0.35) * 45 + hm - 95 * sea;
    // far-field additions, EXACTLY zero inside the home box + 1.5 km
    // (box covers every validated circuit incl. the DC-3 turnback at
    // x=-5800 and its clearance mountains): long-wave continental relief
    // on land + an archipelago in the far sea. Validated trajectories fly
    // bit-identical base terrain.
    const bdx = Math.max(0, Math.max(-6300 - x, x - 600));
    const bdz = Math.max(0, Math.max(-3300 - z, z - 2600));
    const far = sstep(1500, 4000, Math.hypot(bdx, bdz));
    if (far > 0) {
      const big = vnoise(x + 4013, z + 1717, 5200);
      h += far * (big - 0.5) * 130 * (1 - sea);
      const isl = ridge(wx + 2222, wz + 4444, 2600);
      const islMask = sstep(3800, 5200, z);
      h += far * islMask * Math.max(0, isl - 0.62) * 520;
    }
    const dxC = Math.max(0, Math.max(-3400 - x, x - 400));
    const dzC = Math.max(0, Math.abs(z) - 750);
    h *= 0.06 + 0.94 * sstep(0, 700, Math.hypot(dxC, dzC));
    const dxR = Math.max(0, Math.max(-1180 - x, x - 130));
    const dzR = Math.max(0, Math.abs(z) - 90);
    h *= sstep(0, 260, Math.hypot(dxR, dzR));
    return h;
  }

  // surface enum — reserved classes included (PAVED/GRAVEL/... arrive with
  // WORLD-GEN-PROC stages); the classifier below is the honest v1 minimum.
  const SURFACE = { GRASS: 0, ROCK: 1, SCREE: 2, FOREST_FLOOR: 3, WATER: 4, PAVED: 5, GRAVEL: 6, SAND: 7 };

  // aerodrome registry — DESCRIPTIVE for now: the AP still flies the
  // def.params.ap constants (contract rule 6 deferred), and the h0 runway
  // carve box / renderer decals are not yet driven from these records.
  // hdg in radians from +x toward +z; the main strip's takeoff run is
  // along -x (hdg PI). tdz = touchdown-zone target point. elev for
  // meadows is filled from h0 below.
  const aerodromes = [
    { id: 'HOME', name: 'Home Strip', kind: 'main', x: -520, z: 0, hdg: Math.PI,
      len: 1100, wid: 30, surface: SURFACE.GRASS, elev: 0, tdz: [-450, 0],
      spawn: [0, 0] },   // the def-geometry rest position — W10 spawn identity
    { id: 'M1', name: 'Meadow 1', kind: 'meadow', x: -2200, z: -1500, r: 230,
      hdg: 0, len: 460, wid: 460, surface: SURFACE.GRASS, elev: 0, tdz: [-2200, -1500] },
    { id: 'M2', name: 'Meadow 2', kind: 'meadow', x: 1800, z: 1500, r: 260,
      hdg: 0, len: 520, wid: 520, surface: SURFACE.GRASS, elev: 0, tdz: [1800, 1500] },
    { id: 'M3', name: 'Meadow 3', kind: 'meadow', x: -3400, z: 650, r: 240,
      hdg: 0, len: 480, wid: 480, surface: SURFACE.GRASS, elev: 0, tdz: [-3400, 650] },
  ];
  // landing meadows: blend terrain toward the height at each meadow centre.
  // v0 shim member, derived from the registry — same literals, same order,
  // same {x,z,r,h} shape as the pre-contract array.
  const meadows = aerodromes.filter(a => a.kind === 'meadow').map(a => ({ x: a.x, z: a.z, r: a.r }));
  for (const m of meadows) m.h = h0(m.x, m.z);
  aerodromes.filter(a => a.kind === 'meadow').forEach((a, i) => { a.elev = meadows[i].h; });
  // meadow blend, factored: used by the pre-hydro base and final terrainH.
  // Applied AFTER the river carve so meadow interiors stay exactly flat.
  function blendM(x, z, h) {
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r) { const w = sstep(m.r * 0.45, m.r, d); h = m.h * (1 - w) + h * w; }
    }
    return h;
  }
  // runway-pad ramp: 0 inside the pad box, 1 past 260 m out — the same box
  // the h0 flatten uses; masks the river carve so the pad stays exactly 0.
  function padRamp(x, z) {
    const dxR = Math.max(0, Math.max(-1180 - x, x - 130));
    const dzR = Math.max(0, Math.abs(z) - 90);
    return sstep(0, 260, Math.hypot(dxR, dzR));
  }
  // ---- stage 1 hydrology (WORLD-GEN-PROC): baked on the pre-hydro base
  // plus bake-only "drainage domes" over the runway pad and meadows so
  // rivers route AROUND aerodromes (stage 4 grades them properly later).
  // Domes never touch the real terrain; river water surfaces are
  // dome-corrected back via wsAdjust.
  const DOME = 3;
  function domes(x, z) {
    let s = DOME * (1 - padRamp(x, z));
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r * 1.6) s += DOME * (1 - sstep(0, m.r * 1.6, d));
    }
    return s;
  }
  const HYD = bakeHydrology(
    (x, z) => blendM(x, z, h0(x, z)) + domes(x, z),
    // 24 km domain at 46.9 m cells; A0m2 = physical drainage threshold
    // (river widths/depths are normalized to drainage AREA inside the
    // bake, so the same physical rivers emerge at any grid resolution)
    { x0: -12000, z0: -12000, x1: 12000, z1: 12000, N: 512,
      lakeMin: 1.5, A0m2: 274650, kW: 0.35, kD: 0.4, maxW: 45, dLake: 2,
      dpEps: 25, bankFrac: 1.4, qCell: 96, wsAdjust: domes });
  // stage 0+1 terrain: carved + meadow-blended, PRE-road (the settle bake
  // scores sites and derives grading targets on this)
  function tV1(x, z) {
    let h = h0(x, z);
    const r = padRamp(x, z);
    if (r > 0) h += (HYD.carve(x, z, h) - h) * r;
    return blendM(x, z, h);
  }

  // ---- stage 3 settlements & roads (WORLD-GEN-PROC): sites scored on
  // the stage-1 grids, organic road network grown from the home airfield,
  // bridges across water runs, building footprints. Roads add a shallow
  // grading term to terrainH below.
  const SET = bakeSettlements({ grids: HYD.grids, terrain: tV1, water: HYD.water, distW: HYD.distW, meadows, salt: SALT });

  // stage 0-3 terrain: tV1 + road grading, masked off the runway pad
  // (padRamp) and faded inside meadows (same blend weight — meadow
  // centres stay EXACTLY at m.h, the WORLD gate pins that). Stage-4
  // aerodrome grading composes on top in terrainH below.
  let _cd = 0;   // carve depth at the last tV2 call — read by terrainH below
  function tV2(x, z) {
    let h = h0(x, z);
    const r = padRamp(x, z);
    _cd = 0;
    if (r > 0) {
      const hRaw = h;
      h += (HYD.carve(x, z, h) - h) * r;
      const carveDepth = hRaw - h;             // >0 inside river beds / lakes
      _cd = carveDepth;
      h = blendM(x, z, h);
      const g = SET.roadDelta(x, z, h) - h;
      if (g !== 0) {
        let mw = 1;
        for (const m of meadows) {
          const dd = Math.hypot(x - m.x, z - m.z);
          if (dd < m.r) { mw = sstep(m.r * 0.45, m.r, dd); break; }
        }
        // roads must never grade a carved bed back up — beds stay wet,
        // crossings are bridges (the deck spans, terrain keeps the carve)
        h += g * r * mw * (1 - Math.min(1, carveDepth / 1.5));
      }
      return h;
    }
    return blendM(x, z, h);
  }

  // ---- stage 4 aerodromes (WORLD-GEN-PROC): a main field per sizeable
  // town + fly-in backcountry strips, sited on the stage 0-3 terrain;
  // their grading composes into the final terrainH, records join the
  // W.aerodromes registry (still DESCRIPTIVE — AP integration pending).
  const AERO = bakeAerodromes({
    terrain: tV2, water: HYD.water, settlements: SET.settlements,
    meadows, roadNear: SET.roadNear, SURFACE, salt: SALT });
  for (const st of AERO.strips) aerodromes.push(st);

  function terrainH(x, z) {
    // strip grading must never fill a carved river bed (same rule as
    // roads) — fade it out by carve depth, sampled in the tV2 call
    const h = tV2(x, z);
    const g = AERO.grade(x, z, h) - h;
    return g !== 0 ? h + g * (1 - Math.min(1, _cd / 1.5)) : h;
  }

  // ---- stage 2 biomes: analytic classifier + tree placement plan ----
  // (waterAt/terrainH are function declarations — hoisted, safe to bind)
  const B = makeBiomes({ terrainH, waterOf: waterAt, distW: HYD.distW, SURFACE, salt: SALT, roadNear: SET.roadNear, aeroSurf: AERO.surfaceAt });

  // trees: stage-2 biome placement — deterministic jittered 64 m grid,
  // order-independent per point (replaces the v0 sequential LCG loop);
  // density + species from the biome module, clustered by stand noise.
  // v0 exclusions kept verbatim (battery safety): corridor box, meadows
  // 0.8r; the runway pad self-rejects via h<2 (carve-masked flat at 0).
  // Records {x,z,h,s,sp}: h = GROUND height at base, s scale in the v0
  // envelope (solver radius/canopy formulas unchanged), sp = species.
  const trees = [], CELL = 64, grid = new Map();
  {
    const G0 = -12000, GN = 375, GS = 64;  // ±12000 m (24 km domain, W6)
    for (let gz = 0; gz < GN; gz++) for (let gx = 0; gx < GN; gx++) {
      const j1 = hash2(gx + 9173, gz - 2417), j2 = hash2(gx - 5807, gz + 7919),
            j3 = hash2(gx + 1229, gz + 4051);
      const x = G0 + (gx + 0.15 + 0.70 * j1) * GS;
      const z = G0 + (gz + 0.15 + 0.70 * j2) * GS;
      const h = terrainH(x, z);
      if (h < 2 || h > B.TREELINE) continue;
      if (Math.abs(z) < 60 && x < 150 && x > -3300) continue;
      let nearMeadow = false;
      for (const m of meadows)
        if (Math.hypot(x - m.x, z - m.z) < m.r * 0.8) { nearMeadow = true; break; }
      if (nearMeadow) continue;
      if (HYD.water(x, z) > h) continue;
      if (SET.roadNear(x, z) < 12) continue;   // clear of roads
      if (SET.inCore(x, z)) continue;          // clear of settlement cores
      if (AERO.inBox(x, z, 30)) continue;      // clear of strips + margin
      const tp = B.treeAt(x, z, h);
      if (!tp || j3 > tp.p) continue;
      const idx = trees.length;
      trees.push({ x, z, h, s: tp.s, sp: tp.sp });
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(idx);
    }
  }
  function treesNear(x, z, out) {
    out.length = 0;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cell = grid.get(`${cx + a},${cz + b}`);
      if (cell) for (const i of cell) out.push(i);
    }
    return out;
  }

  // ---- v1 continuous fields. waterH: stage-1 rivers at their monotone
  // reach surfaces + lakes at spill height + sea (level 0) where the
  // PRE-CARVE base is below 0 — a riverbed carved under sea level inland
  // is a dry trench, not sea. surface is still the pre-biome minimum
  // (stages 2/5 refine ROCK/SCREE/etc.).
  function waterAt(t, x, z) {
    const ws = HYD.water(x, z);
    if (ws > t) return ws;
    if (t < 0 && blendM(x, z, h0(x, z)) < 0) return 0;
    return -Infinity;
  }
  function waterH(x, z) { return waterAt(terrainH(x, z), x, z); }
  // surface: stage-2 biome classifier (WATER/SAND/ROCK/SCREE/FOREST_FLOOR/
  // GRASS from altitude+slope+moisture+distance-to-water; PAVED/GRAVEL
  // still reserved for stage 4)
  const surface = B.surface;

  // ---- v1 tiled features: lazy bucketing of the eager tree array plus
  // stage-1 river reaches (a reach spanning several tiles appears in each
  // of them — reach records {pts, ws, w, d, acc, term} are shared refs).
  // trees stays ONE flat index-stable array — treesNear returns indices
  // into it and the solver depends on that; tiles hold the same objects.
  // roads/buildings are empty until WORLD-GEN-PROC stage 3.
  // tile() is never called during makeWorld: zero load-time cost.
  const TILE = 512;
  let tileIndex = null;
  function tile(ix, iz) {
    if (!tileIndex) {
      tileIndex = new Map();
      const rec0 = key => {
        let rec = tileIndex.get(key);
        if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
        return rec;
      };
      for (const t of trees) rec0(Math.floor(t.x / TILE) + ',' + Math.floor(t.z / TILE)).trees.push(t);
      const bucketPoly = (obj, list) => {
        const keys = new Set();
        for (let i = 0; i + 1 < obj.pts.length; i++) {
          const tx0 = Math.floor(Math.min(obj.pts[i][0], obj.pts[i + 1][0]) / TILE);
          const tx1 = Math.floor(Math.max(obj.pts[i][0], obj.pts[i + 1][0]) / TILE);
          const tz0 = Math.floor(Math.min(obj.pts[i][1], obj.pts[i + 1][1]) / TILE);
          const tz1 = Math.floor(Math.max(obj.pts[i][1], obj.pts[i + 1][1]) / TILE);
          for (let a = tx0; a <= tx1; a++) for (let b = tz0; b <= tz1; b++) keys.add(a + ',' + b);
        }
        for (const key of keys) rec0(key)[list].push(obj);
      };
      for (const r of HYD.rivers) bucketPoly(r, 'rivers');
      for (const r of SET.roads) bucketPoly(r, 'roads');
      for (const b of SET.buildings) rec0(Math.floor(b.x / TILE) + ',' + Math.floor(b.z / TILE)).buildings.push(b);
    }
    const key = ix + ',' + iz;
    let rec = tileIndex.get(key);
    if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
    return rec;
  }

  // ---- wind field: steady vector + deterministic Dryden-ish gusts ----
  // setWind({ base:[wx,wy,wz], gust:g }) — gusts are sums of incommensurate
  // sines with spatial phase (advecting waves), amplitude g horizontal and
  // 0.6*g vertical. Deterministic by construction: gates can rely on it.
  // Default null: wind() returns the shared zero vector (fast path).
  let windSpec = null;
  const W0 = [0, 0, 0], WV = [0, 0, 0];
  const GC = [ // [freq rad/s, kx, kz, phase, axis weight x,y,z]
    [0.63, 0.011, 0.005, 0.7, 1.0, 0.35, 0.55],
    [1.37, 0.004, 0.013, 2.9, 0.55, 0.6, 1.0],
    [2.71, 0.009, 0.008, 5.1, 0.7, 1.0, 0.6],
    [0.29, 0.002, 0.003, 1.9, 1.0, 0.25, 0.8],
  ];
  function wind(x, y, z, t) {
    if (!windSpec) return W0;
    const b = windSpec.base, g = windSpec.gust || 0;
    WV[0] = b[0]; WV[1] = b[1]; WV[2] = b[2];
    if (g > 0) for (const [om, kx, kz, ph, ax, ay, az] of GC) {
      const s = Math.sin(om * t + kx * x + kz * z + ph);
      WV[0] += g * 0.30 * ax * s;
      WV[1] += g * 0.18 * ay * s;
      WV[2] += g * 0.30 * az * s;
    }
    return WV;
  }
  function setWind(spec) { windSpec = spec ? { base: spec.base || [0, 0, 0], gust: spec.gust || 0 } : null; }

  return {
    // ---- v1 contract (futureDesigns/WORLD-CONTRACT.md) ----
    v: 1, seed: SEED,
    bounds: { x0: -12000, z0: -12000, x1: 12000, z1: 12000 },
    terrainH, waterH, surface, SURFACE,
    TILE, tile, aerodromes, settlements: SET.settlements,
    treesNear,
    // informative stage-3 block (not contract surface): road/building
    // records and queries for gates, renderer and debug.
    roadNet: { roads: SET.roads, buildings: SET.buildings, roadNear: SET.roadNear, bakeMs: SET.stats.bakeMs },
    // informative stage-1 block (not contract surface): gates/debug read
    // reach records and bake stats here without walking every tile.
    hydro: { rivers: HYD.rivers, lakeCount: HYD.lakeCount, lakeCells: HYD.lakeCells, bakeMs: HYD.stats.bakeMs, water: HYD.water, lakeSurf: HYD.lakeSurf, cellW: HYD.stats.cellW, distW: HYD.distW },
    // ---- v0 shim: same live objects, byte-identical values ----
    trees, meadows, CELL, wind, setWind,
  };
}
// ============================================================
// WORLD HYDROLOGY — WORLD-GEN-PROC stage 1: priority-flood depression
// filling (Barnes 2014), D8 flow routing with deterministic tie-breaks,
// accumulation, river extraction to polylines, lakes at spill height,
// and O(1) carve/water queries for terrainH/waterH composition.
// Pure function of (sample, cfg): no globals, deterministic by
// construction — same inputs give identical output on any JS engine
// (integer hashes, fixed iteration orders, total-order sorts).
// ============================================================
function bakeHydrology(sample, cfg) {
  const t0 = Date.now();
  const N = cfg.N, x0 = cfg.x0, z0 = cfg.z0;
  const dx = (cfg.x1 - x0) / N, dz = (cfg.z1 - z0) / N;
  const M = N * N;
  // physical normalization: thresholds and width/depth laws are stated in
  // drainage AREA (m²), converted to cells of THIS grid — the same rivers
  // emerge at any resolution. cfg.A0m2 preferred; legacy cfg.A0 = cells.
  const cellA = dx * dz;
  const A0 = cfg.A0m2 ? cfg.A0m2 / cellA : cfg.A0;
  const EQ = cellA / 549.3164;                // legacy 23.4 m cell equivalents
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const px = ix => x0 + (ix + 0.5) * dx, pz = iz => z0 + (iz + 0.5) * dz;

  // ---- heights + sea mask (sea level = 0) ----
  const H = new Float64Array(M);
  for (let iz = 0, k = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++, k++) H[k] = sample(px(ix), pz(iz));
  const sea = new Uint8Array(M);
  for (let k = 0; k < M; k++) if (H[k] < 0) sea[k] = 1;

  const NBX = [1, -1, 0, 0, 1, 1, -1, -1];
  const NBZ = [0, 0, 1, -1, 1, -1, 1, -1];
  const DIST = NBX.map((v, i) => Math.hypot(v * dx, NBZ[i] * dz));

  // ---- priority flood: fill depressions to spill from the boundary ----
  // binary min-heap on (key, cell index) — index tie-break keeps pop order
  // deterministic when filled levels are equal (flat regions).
  const filled = new Float64Array(M);
  const queued = new Uint8Array(M);
  const popOrder = new Int32Array(M);
  const hKey = new Float64Array(M), hIdx = new Int32Array(M);
  let hn = 0;
  const hLess = (a, b) => hKey[a] < hKey[b] || (hKey[a] === hKey[b] && hIdx[a] < hIdx[b]);
  function hSwap(a, b) {
    const k = hKey[a], i = hIdx[a];
    hKey[a] = hKey[b]; hIdx[a] = hIdx[b]; hKey[b] = k; hIdx[b] = i;
  }
  function hPush(key, idx) {
    let i = hn++; hKey[i] = key; hIdx[i] = idx;
    while (i > 0) { const p = (i - 1) >> 1; if (hLess(p, i)) break; hSwap(i, p); i = p; }
  }
  function hPop() {
    const top = hIdx[0];
    hn--; hKey[0] = hKey[hn]; hIdx[0] = hIdx[hn];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let s = i;
      if (l < hn && hLess(l, s)) s = l;
      if (r < hn && hLess(r, s)) s = r;
      if (s === i) break;
      hSwap(i, s); i = s;
    }
    return top;
  }
  for (let k = 0; k < M; k++) {
    const ix = k % N, iz = (k / N) | 0;
    if (ix === 0 || iz === 0 || ix === N - 1 || iz === N - 1) { filled[k] = H[k]; queued[k] = 1; hPush(H[k], k); }
  }
  let order = 0;
  while (hn > 0) {
    const c = hPop(); popOrder[c] = order++;
    const cix = c % N, ciz = (c / N) | 0;
    for (let d = 0; d < 8; d++) {
      const nix = cix + NBX[d], niz = ciz + NBZ[d];
      if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
      const n = niz * N + nix;
      if (queued[n]) continue;
      queued[n] = 1;
      filled[n] = Math.max(H[n], filled[c]);
      hPush(filled[n], n);
    }
  }

  // ---- D8 flow on the filled surface; steepest descent, hash-rotated
  // neighbour scan (kills axis bias without nondeterminism); flats drain
  // toward the earliest-flooded equal neighbour (guaranteed outlet path).
  const h32 = k => { let h = (Math.imul(k, 2654435761)) | 0; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
  const flow = new Int32Array(M).fill(-1); // -1 = domain outlet
  for (let k = 0; k < M; k++) {
    const cix = k % N, ciz = (k / N) | 0;
    if (cix === 0 || ciz === 0 || cix === N - 1 || ciz === N - 1) continue;
    let best = -1, bestSlope = 0;
    const start = h32(k) & 7;
    for (let s = 0; s < 8; s++) {
      const d = (start + s) & 7;
      const n = (ciz + NBZ[d]) * N + cix + NBX[d];
      const drop = filled[k] - filled[n];
      if (drop > 0) { const sl = drop / DIST[d]; if (sl > bestSlope) { bestSlope = sl; best = n; } }
    }
    if (best < 0) {
      let bo = popOrder[k];
      for (let d = 0; d < 8; d++) {
        const n = (ciz + NBZ[d]) * N + cix + NBX[d];
        if (filled[n] === filled[k] && popOrder[n] < bo) { bo = popOrder[n]; best = n; }
      }
    }
    flow[k] = best;
  }

  // ---- accumulation: upstream-first order = (filled desc, popOrder desc)
  // (in flats downstream cells were flooded earlier, so later pop = upstream)
  const idxs = new Int32Array(M);
  for (let k = 0; k < M; k++) idxs[k] = k;
  idxs.sort((a, b) => (filled[b] - filled[a]) || (popOrder[b] - popOrder[a]));
  const acc = new Float64Array(M).fill(1);
  let maxAcc = 0;
  for (let i = 0; i < M; i++) {
    const k = idxs[i], f = flow[k];
    if (f >= 0 && !sea[k]) acc[f] += acc[k];
    if (!sea[k] && acc[k] > maxAcc) maxAcc = acc[k];
  }

  // ---- lakes: fill difference above threshold; per-cell water = filled ----
  const lake = new Uint8Array(M);
  let lakeCells = 0;
  for (let k = 0; k < M; k++) if (!sea[k] && filled[k] - H[k] > cfg.lakeMin) { lake[k] = 1; lakeCells++; }
  // renderer lake surface: the data lakes (depth > lakeMin) PLUS their
  // shallow connected rim (depth > 0.25 at approximately the same level) —
  // in flat terrain the rim is wide and without it the rendered water
  // edge floats 1.5 m above ground as a visible cell-stepped outline.
  // Render-only: the lake mask, clamp carve and gates are untouched.
  const wet = new Uint8Array(M);
  {
    const stack = [];
    for (let k = 0; k < M; k++) if (lake[k]) { wet[k] = 1; stack.push(k); }
    while (stack.length) {
      const c = stack.pop();
      const cix = c % N, ciz = (c / N) | 0;
      for (let d = 0; d < 8; d++) {
        const nix = cix + NBX[d], niz = ciz + NBZ[d];
        if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
        const n = niz * N + nix;
        if (wet[n] || sea[n]) continue;
        if (filled[n] - H[n] > 0.25 && Math.abs(filled[n] - filled[c]) < 0.3) { wet[n] = 1; stack.push(n); }
      }
    }
  }
  // per-cell entries for the renderer: [x, z, waterLevel, edgeMask]
  // edgeMask bits: 1 = +x neighbour is wet, 2 = -x, 4 = +z, 8 = -z
  const lakeSurf = [];
  for (let k = 0; k < M; k++) {
    if (!wet[k]) continue;
    const ix = k % N, iz = (k / N) | 0;
    let mask = 0;
    if (ix + 1 < N && wet[k + 1]) mask |= 1;
    if (ix > 0 && wet[k - 1]) mask |= 2;
    if (iz + 1 < N && wet[k + N]) mask |= 4;
    if (iz > 0 && wet[k - N]) mask |= 8;
    lakeSurf.push([px(ix), pz(iz), filled[k], mask]);
  }
  const lakeId = new Int32Array(M).fill(-1);
  let lakeCount = 0;
  {
    const stack = [];
    for (let k = 0; k < M; k++) {
      if (!lake[k] || lakeId[k] >= 0) continue;
      stack.length = 0; stack.push(k); lakeId[k] = lakeCount;
      while (stack.length) {
        const c = stack.pop();
        const cix = c % N, ciz = (c / N) | 0;
        for (let d = 0; d < 8; d++) {
          const nix = cix + NBX[d], niz = ciz + NBZ[d];
          if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
          const n = niz * N + nix;
          if (lake[n] && lakeId[n] < 0) { lakeId[n] = lakeCount; stack.push(n); }
        }
      }
      lakeCount++;
    }
  }

  // ---- river extraction: trace acc > A0 downstream from heads; reaches
  // split at lake entry/exit; Douglas-Peucker simplify; per-vertex water
  // surface from filled (optionally cfg.wsAdjust-corrected), monotone.
  const wsAdj = cfg.wsAdjust || null;
  function mkReach(rp, rw, accEnd, term) {
    // Douglas-Peucker on indices
    const keep = new Uint8Array(rp.length);
    keep[0] = keep[rp.length - 1] = 1;
    const st = [[0, rp.length - 1]];
    while (st.length) {
      const [a, b] = st.pop();
      if (b - a < 2) continue;
      const ax = rp[a][0], az = rp[a][1], bx = rp[b][0], bz = rp[b][1];
      const vx = bx - ax, vz = bz - az, L = Math.hypot(vx, vz) || 1;
      let mi = -1, md = 0;
      for (let i = a + 1; i < b; i++) {
        const dd = Math.abs((rp[i][0] - ax) * vz - (rp[i][1] - az) * vx) / L;
        if (dd > md) { md = dd; mi = i; }
      }
      if (md > cfg.dpEps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    const pts = [], ws = [];
    for (let i = 0; i < rp.length; i++) if (keep[i]) {
      pts.push(rp[i]);
      let v = rw[i];
      if (wsAdj) v -= wsAdj(rp[i][0], rp[i][1]);
      ws.push(v);
    }
    for (let i = 1; i < ws.length; i++) if (ws[i] > ws[i - 1]) ws[i] = ws[i - 1];
    const accEq = accEnd * EQ;                // resolution-invariant drainage
    const w = Math.min(cfg.maxW, cfg.kW * Math.sqrt(accEq));
    const d = cfg.kD * Math.log(1 + accEq);
    return { pts, ws, w, d, acc: accEq, term };
  }
  const rivers = [];
  const claimed = new Uint8Array(M);
  let riverCells = 0;
  for (let k = 0; k < M; k++) if (acc[k] > A0 && !sea[k]) riverCells++;
  for (let k = 0; k < M; k++) {
    if (!(acc[k] > A0) || sea[k] || lake[k] || claimed[k]) continue;
    let head = true;
    const cix = k % N, ciz = (k / N) | 0;
    for (let d = 0; d < 8; d++) {
      const nix = cix + NBX[d], niz = ciz + NBZ[d];
      if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
      const n = niz * N + nix;
      if (flow[n] === k && acc[n] > A0 && !sea[n]) { head = false; break; }
    }
    if (!head) continue;
    let cur = k, rp = [], rw = [], accEnd = acc[k];
    const flush = term => { if (rp.length >= 2) rivers.push(mkReach(rp, rw, accEnd, term)); rp = []; rw = []; };
    while (cur >= 0) {
      const pt = [px(cur % N), pz((cur / N) | 0)];
      if (sea[cur]) { rp.push(pt); rw.push(Math.max(0, filled[cur])); flush('sea'); break; }
      if (claimed[cur]) { rp.push(pt); rw.push(filled[cur]); flush('junction'); break; }
      if (lake[cur]) {
        rp.push(pt); rw.push(filled[cur]); flush('lake');
        while (cur >= 0 && lake[cur]) { claimed[cur] = 1; cur = flow[cur]; }
        continue;
      }
      claimed[cur] = 1;
      rp.push(pt); rw.push(filled[cur]); accEnd = acc[cur];
      cur = flow[cur];
      if (cur < 0) { flush('boundary'); break; }
    }
  }

  // ---- distance-to-water: 3-4 chamfer transform over sea + lake/rim +
  // traced river cells, queried bilinearly in metres (stage-2 biome input)
  const dGrid = new Float64Array(M).fill(1e9);
  for (let k = 0; k < M; k++) if (sea[k] || wet[k] || claimed[k]) dGrid[k] = 0;
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const k = iz * N + ix; let d = dGrid[k];
    if (ix > 0 && dGrid[k - 1] + 3 < d) d = dGrid[k - 1] + 3;
    if (iz > 0) {
      if (dGrid[k - N] + 3 < d) d = dGrid[k - N] + 3;
      if (ix > 0 && dGrid[k - N - 1] + 4 < d) d = dGrid[k - N - 1] + 4;
      if (ix + 1 < N && dGrid[k - N + 1] + 4 < d) d = dGrid[k - N + 1] + 4;
    }
    dGrid[k] = d;
  }
  for (let iz = N - 1; iz >= 0; iz--) for (let ix = N - 1; ix >= 0; ix--) {
    const k = iz * N + ix; let d = dGrid[k];
    if (ix + 1 < N && dGrid[k + 1] + 3 < d) d = dGrid[k + 1] + 3;
    if (iz + 1 < N) {
      if (dGrid[k + N] + 3 < d) d = dGrid[k + N] + 3;
      if (ix + 1 < N && dGrid[k + N + 1] + 4 < d) d = dGrid[k + N + 1] + 4;
      if (ix > 0 && dGrid[k + N - 1] + 4 < d) d = dGrid[k + N - 1] + 4;
    }
    dGrid[k] = d;
  }
  const DSCALE = dx / 3;
  function distW(x, z) {
    let gx = (x - x0) / dx - 0.5, gz = (z - z0) / dz - 0.5;
    gx = Math.min(N - 1.001, Math.max(0, gx)); gz = Math.min(N - 1.001, Math.max(0, gz));
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const tx = gx - ix, tz = gz - iz, k = iz * N + ix;
    const a = dGrid[k] * (1 - tx) + dGrid[k + 1] * tx;
    const b = dGrid[k + N] * (1 - tx) + dGrid[k + N + 1] * tx;
    return (a * (1 - tz) + b * tz) * DSCALE;
  }

  // ---- segment spatial index for O(1) hot-path queries ----
  // numeric keys (no per-query string allocation); segments are inserted
  // into every cell their bank-inflated bbox overlaps, so a query only
  // ever reads its own cell.
  const QC = cfg.qCell;
  const qmap = new Map();
  const qKey = (qx, qz) => (qx + 512) * 4096 + (qz + 512);
  let segCount = 0;
  for (const r of rivers) {
    const bank = r.w * cfg.bankFrac;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const s = {
        ax: r.pts[i][0], az: r.pts[i][1], bx: r.pts[i + 1][0], bz: r.pts[i + 1][1],
        w: r.w, d: r.d, wsA: r.ws[i], wsB: r.ws[i + 1], bank,
      };
      segCount++;
      const qx0 = Math.floor((Math.min(s.ax, s.bx) - bank) / QC), qx1 = Math.floor((Math.max(s.ax, s.bx) + bank) / QC);
      const qz0 = Math.floor((Math.min(s.az, s.bz) - bank) / QC), qz1 = Math.floor((Math.max(s.az, s.bz) + bank) / QC);
      for (let qx = qx0; qx <= qx1; qx++) for (let qz = qz0; qz <= qz1; qz++) {
        const key = qKey(qx, qz);
        let arr = qmap.get(key);
        if (!arr) qmap.set(key, arr = []);
        arr.push(s);
      }
    }
  }

  let _depth = 0, _ws = -Infinity; // scan() scratch — consume immediately
  function scan(x, z) {
    _depth = 0; _ws = -Infinity;
    const arr = qmap.get(qKey(Math.floor(x / QC), Math.floor(z / QC)));
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const vx = s.bx - s.ax, vz = s.bz - s.az;
      const wx = x - s.ax, wz = z - s.az;
      const L2 = vx * vx + vz * vz || 1;
      let t = (wx * vx + wz * vz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = wx - t * vx, ez = wz - t * vz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist < s.bank) {
        const dep = s.d * (1 - smf01(dist / s.bank));
        if (dep > _depth) _depth = dep;
        if (dist < s.w * 0.5) { const v = s.wsA + (s.wsB - s.wsA) * t; if (v > _ws) _ws = v; }
      }
    }
  }
  // bilinear lake sampling in cell-center space: weight + water level
  let _lw = 0, _lws = 0;
  function lakeAt(x, z) {
    _lw = 0; _lws = 0;
    const gx = (x - x0) / dx - 0.5, gz = (z - z0) / dz - 0.5;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const tx = gx - ix, tz = gz - iz;
    let wsum = 0, lsum = 0;
    for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) {
      const jx = ix + a, jz = iz + b;
      if (jx < 0 || jz < 0 || jx >= N || jz >= N) continue;
      const k = jz * N + jx;
      if (!lake[k]) continue;
      const w = (a ? tx : 1 - tx) * (b ? tz : 1 - tz);
      wsum += w; lsum += w * filled[k];
    }
    if (wsum > 0) { _lw = wsum; _lws = lsum / wsum; }
  }
  function carve(x, z, h) {
    scan(x, z);
    let out = h - _depth;
    lakeAt(x, z);
    if (_lw > 0) out += smf01(_lw) * Math.min(0, (_lws - cfg.dLake) - out);
    return out;
  }
  function water(x, z) {
    scan(x, z);
    let ws = _ws;
    lakeAt(x, z);
    if (_lw > 0.5 && _lws > ws) ws = _lws;
    return ws;
  }

  return {
    rivers, lakeCount, lakeCells, riverCells, segCount, lakeSurf,
    carve, water, distW,
    // stage-1 grids for downstream stages (settlement scoring, roads):
    // row-major N×N over [x0,x1]×[z0,z1], cell centres at (i+0.5)·dx
    grids: { N, x0, z0, dx, dz, H, filled, sea, wet, lake, acc, claimed },
    stats: { bakeMs: Date.now() - t0, N, maxAcc, cellW: dx },
  };
}
// ============================================================
// WORLD BIOMES — WORLD-GEN-PROC stage 2: climate -> biomes -> forests.
// Analytic recombination, no stored map: biome = f(altitude, slope,
// moisture fBm, distance-to-water). Drives the W.surface classifier and
// per-point tree placement (density + species, clustered into stands by
// a coarse stand noise so forests read as stands, not confetti).
// Pure function of its deps; deterministic (integer-hash noise + salt).
// Species (tree.sp): 0 spruce, 1 pine, 2 oak, 3 birch, 4 willow.
// ============================================================
function makeBiomes(D) {
  // D: { terrainH, waterOf(h,x,z), distW, SURFACE, salt, roadNear?, aeroSurf? }
  const { terrainH, waterOf, distW, SURFACE, salt, roadNear, aeroSurf } = D;
  const smf = t => t * t * (3 - 2 * t);
  const clamp01 = v => Math.min(1, Math.max(0, v));
  // decorrelated from the terrain hash: swapped multipliers + own constant
  const hash2 = (ix, iz) => {
    let h = (ix * 668265263 + iz * 374761393 + 69069 + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function vnoise(x, z, cell) {
    const fx = x / cell, fz = z / cell;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = smf(fx - ix), tz = smf(fz - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz),
          c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  // per-point hash for placement/species decisions, keyed on quantized coords
  const ph = (x, z, k) => hash2(Math.round(x * 4) + Math.imul(k, 7349), Math.round(z * 4) - Math.imul(k, 4903));

  const TREELINE = 165;                       // no trees above; scrub belt below
  const moistN = (x, z) =>
    vnoise(x + 37, z + 911, 900) * 0.50 + vnoise(x + 211, z + 13, 380) * 0.33 +
    vnoise(x + 555, z + 333, 150) * 0.17;
  const moist = (x, z) =>
    clamp01(moistN(x, z) * 0.75 + Math.max(0, 1 - distW(x, z) / 240) * 0.45);
  const slope = (x, z) => {
    const e = 8;
    return Math.hypot(terrainH(x + e, z) - terrainH(x - e, z),
                      terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
  };
  const stand = (x, z) => vnoise(x + 77, z + 479, 210);   // stand/species field
  const forestness = (x, z, h) =>
    clamp01(0.55 * stand(x, z) + 0.30 * moist(x, z) + 0.15 * clamp01(1 - Math.abs(h - 70) / 140));

  function surface(x, z) {
    const h = terrainH(x, z);
    if (waterOf(h, x, z) > h) return SURFACE.WATER;
    if (aeroSurf) { const as = aeroSurf(x, z); if (as >= 0) return as; }  // stage-4 strips
    const sl = slope(x, z);
    if (h < 2.5 && distW(x, z) < 70) return SURFACE.SAND;     // coast + estuary bars
    if (h > 220 || sl > 0.75 || (h > TREELINE && sl > 0.38)) return SURFACE.ROCK;
    if (h > 100 && sl > 0.45) return SURFACE.SCREE;
    if (roadNear && roadNear(x, z) < 3.5) return SURFACE.GRAVEL;  // stage-3 roads
    if (h < TREELINE && sl < 0.5 && forestness(x, z, h) > 0.48) return SURFACE.FOREST_FLOOR;
    return SURFACE.GRASS;
  }

  // tree placement decision for one candidate point (caller already
  // rejected water / corridor / aerodromes / h out of [2, TREELINE]).
  // Returns null or { p, sp, s }: keep-probability, species, scale.
  function treeAt(x, z, h) {
    const sl = slope(x, z);
    if (sl > 0.5 || (h > 100 && sl > 0.45)) return null;  // mirrors the SCREE band
    const dW = distW(x, z);
    if (h < 2.5 && dW < 70) return null;                      // sand
    const st = stand(x, z), mo = moist(x, z);
    const fn = clamp01(0.55 * st + 0.30 * mo + 0.15 * clamp01(1 - Math.abs(h - 70) / 140));
    const rip = dW < 45 && h < 120 && sl < 0.4;
    let p;
    if (rip) p = 0.85;                                        // riparian strip
    else if (fn > 0.48) p = 0.85;                             // stand interior
    else if (fn > 0.40) p = 0.25;                             // open woodland
    else p = 0.05;                                            // lone field trees
    let scrub = false;
    if (h > TREELINE - 25) { p = Math.min(p, 0.12); scrub = true; }
    const r1 = ph(x, z, 1), r2 = ph(x, z, 2);
    let sp;
    if (rip) sp = r1 < 0.7 ? 4 : 2;
    else if (h > 115) sp = st < 0.5 ? 0 : 1;                  // high forest: conifer
    else if (st < 0.44) sp = mo > 0.55 ? 0 : 1;
    else if (st > 0.58) sp = r1 < 0.55 ? 2 : 3;
    else sp = r1 < 0.3 ? 1 : r1 < 0.6 ? 2 : 3;
    const S0 = [1.15, 1.0, 1.1, 0.9, 0.85][sp];
    let s = S0 * (0.78 + r2 * 0.5);
    if (scrub) s *= 0.62;
    s = Math.min(1.75, Math.max(0.65, s));
    return { p, sp, s };
  }

  return { surface, treeAt, moist, slope, stand, TREELINE };
}
// ============================================================
// WORLD SETTLEMENTS & ROADS — WORLD-GEN-PROC stage 3.
// Site scoring on the stage-1 grid (flat + near water + low altitude +
// confluence/coast bonuses, greedy pick with min spacing), organic road
// growth (multi-source Dijkstra from the existing network on a 2x
// decimated grid — new settlements attach to the nearest network point,
// so trunks are shared), explicit bridge pieces across water-cell runs,
// a shallow road-grading SDF (flatten ACROSS the road toward a smoothed
// along-profile, never on bridges), and building footprints laid out
// along the local road tangent. Deterministic: hash streams + index
// tie-breaks everywhere. The road network grows from the home airfield.
// ============================================================
function bakeSettlements(D) {
  // D: { grids, terrain(x,z) pre-road, water(x,z), distW(x,z), meadows, salt }
  const t0 = Date.now();
  const G = D.grids, meadows = D.meadows;
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const hash2 = (ix, iz) => {
    let h = (ix * 912931 + iz * 597269 + 41777 + D.salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // ---- 2x decimated road grid ----
  const NR = G.N >> 1, MR = NR * NR, dr = G.dx * 2;
  const px = ix => G.x0 + (2 * ix + 0.5) * G.dx, pz = iz => G.z0 + (2 * iz + 0.5) * G.dz;
  const fIdx = k => (2 * ((k / NR) | 0)) * G.N + 2 * (k % NR);
  const H2 = new Float64Array(MR), wat2 = new Uint8Array(MR);
  const isWetF = f => (G.sea[f] || G.wet[f] || G.lake[f] || G.claimed[f]) ? 1 : 0;
  for (let k = 0; k < MR; k++) {
    const f = fIdx(k);
    H2[k] = G.H[f];
    // OR the whole 2x2 fine block: 1-cell river lines must not leave gaps
    // a path could sneak through without a bridge
    const fx = f % G.N, fz = (f / G.N) | 0;
    let w = isWetF(f);
    if (fx + 1 < G.N) w = w || isWetF(f + 1);
    if (fz + 1 < G.N) w = w || isWetF(f + G.N);
    if (fx + 1 < G.N && fz + 1 < G.N) w = w || isWetF(f + G.N + 1);
    wat2[k] = w ? 1 : 0;
  }
  const inPadZone = (x, z) => x > -1230 && x < 180 && Math.abs(z) < 140;
  const meadowMult = (x, z) => {
    for (const m of meadows) if (Math.hypot(x - m.x, z - m.z) < m.r * 1.2) return 8;
    return 1;
  };

  // ---- river junctions (confluences) on the fine grid, for site bonus ----
  const junctions = [];
  {
    const inflow = new Uint8Array(G.N * G.N);
    for (let k = 0; k < G.N * G.N; k++) {
      if (!G.claimed[k] || G.sea[k]) continue;
      // count claimed upstream neighbours flowing here is expensive via flow
      // scan; approximate: a claimed cell with >=3 claimed 8-neighbours is a
      // junction-ish knot (straight reaches have 2)
      const ix = k % G.N, iz = (k / G.N) | 0;
      let n = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        const jx = ix + a, jz = iz + b;
        if (jx < 0 || jz < 0 || jx >= G.N || jz >= G.N) continue;
        if (G.claimed[jz * G.N + jx]) n++;
      }
      if (n >= 3 && !inflow[k]) {
        junctions.push([G.x0 + (ix + 0.5) * G.dx, G.z0 + (iz + 0.5) * G.dz]);
        // suppress neighbours so one knot emits one junction
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
          const jx = ix + a, jz = iz + b;
          if (jx >= 0 && jz >= 0 && jx < G.N && jz < G.N) inflow[jz * G.N + jx] = 1;
        }
      }
    }
  }

  // ---- settlement site scoring + greedy pick ----
  const sites = [];
  for (let k = 0; k < MR; k++) {
    const ix = k % NR, iz = (k / NR) | 0;
    if (ix < 2 || iz < 2 || ix >= NR - 2 || iz >= NR - 2) continue;
    if (wat2[k]) continue;
    const h = H2[k];
    if (h < 1.5 || h > 130) continue;
    const x = px(ix), z = pz(iz);
    if (Math.abs(z) < 400 && x < 400 && x > -3400) continue;      // circuit band
    let nearMeadow = false;
    for (const m of meadows) if (Math.hypot(x - m.x, z - m.z) < m.r * 1.8) nearMeadow = true;
    if (nearMeadow) continue;
    let sl = 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      sl = Math.max(sl, Math.abs(H2[(iz + b) * NR + ix + a] - h) / dr);
    if (sl > 0.11) continue;
    // neighbourhood dryness: the near-water bonus must not drop a town on
    // a shallow-lake islet — require the ±3-cell block nearly all dry
    let wet = 0;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const jx = ix + a, jz = iz + b;
      if (jx < 0 || jz < 0 || jx >= NR || jz >= NR || wat2[jz * NR + jx]) wet++;
    }
    if (wet > 10) continue;   // islets block ~half the 49-cell block; tarn shores just a few
    // grid masks miss water under DP-simplified river polylines (corner
    // cuts) — verify against the actual water query, centre + 60 m ring
    let qWet = false;
    for (let q = 0; q < 5; q++) {
      const qx = x + (q ? 60 * Math.cos(q * Math.PI / 2) : 0);
      const qz = z + (q ? 60 * Math.sin(q * Math.PI / 2) : 0);
      if (D.water(qx, qz) > D.terrain(qx, qz)) { qWet = true; break; }
    }
    if (qWet) continue;
    const dW = D.distW(x, z);
    let score = 2.2 * (1 - sl / 0.11) + 1.2 * Math.max(0, 1 - h / 140);
    if (dW > 25 && dW < 320) score += 1.6 * (1 - (dW - 25) / 295);
    for (const [jx, jz] of junctions)
      if (Math.hypot(x - jx, z - jz) < 260) { score += 1.4; break; }
    if (h < 8 && dW < 220) score += 1.0;                          // coast
    sites.push([score, k]);
  }
  sites.sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]));
  const settlements = [
    { x: 60, z: 112, r: 95, pop: 45, name: 'Home Field', kind: 'home' },
  ];
  for (const [score, k] of sites) {
    if (settlements.length >= 9 || score < 2.2) break;  // 24 km world holds more towns
    const x = px(k % NR), z = pz((k / NR) | 0);
    if (settlements.some(s => Math.hypot(s.x - x, s.z - z) < 2500)) continue;
    // rank-declining pop + hash spread: the score formula saturated and
    // made every town 900 — stage 4 wants a size mix (paved vs grass)
    const h0v = hash2(k, 71);
    const pop = Math.max(140, Math.min(900,
      Math.round((900 - (settlements.length - 1) * 95) * (0.78 + h0v * 0.35))));
    const h1 = hash2(k, 11), h2 = hash2(k, 23), h3 = hash2(k, 37), h4 = hash2(k, 53);
    const SYL1 = ['Al', 'Ber', 'Dal', 'Fen', 'Gil', 'Hol', 'Kes', 'Lun', 'Mor', 'Nor', 'Pel', 'Ros', 'Tor', 'Vim', 'Wes'];
    const SYL2 = ['by', 'stad', 'ford', 'ton', 'ham', 'wick', 'dorf', 'vik', 'field'];
    let name = '';
    for (let v = 0; v < 9; v++) {   // rotate the suffix on collision
      name = SYL1[(h1 * 15) | 0] + (h2 < 0.4 ? SYL1[(h3 * 15) | 0].toLowerCase() : '') + SYL2[(((h4 * 9) | 0) + v) % 9];
      if (!settlements.some(s => s.name === name)) break;
    }
    if (settlements.some(s => s.name === name)) name = 'New ' + name;
    settlements.push({ x, z, r: Math.min(320, 70 + pop * 0.28), pop, name, kind: 'town' });
  }

  // ---- roads: organic growth, multi-source Dijkstra on the road grid ----
  const nodeCell = settlements.map(s => {
    let ix = Math.min(NR - 2, Math.max(1, Math.round((s.x - G.x0) / dr - 0.5)));
    let iz = Math.min(NR - 2, Math.max(1, Math.round((s.z - G.z0) / dr - 0.5)));
    // nudge off water if needed (deterministic spiral)
    for (let rad = 0; rad < 6; rad++) {
      let done = false;
      for (let a = -rad; a <= rad && !done; a++) for (let b = -rad; b <= rad && !done; b++) {
        const jx = ix + a, jz = iz + b;
        if (jx < 1 || jz < 1 || jx >= NR - 1 || jz >= NR - 1) continue;
        if (!wat2[jz * NR + jx]) { ix = jx; iz = jz; done = true; }
      }
      if (done) break;
    }
    return iz * NR + ix;
  });
  const NBX = [1, -1, 0, 0, 1, 1, -1, -1], NBZ = [0, 0, 1, -1, 1, -1, 1, -1];
  const DD = NBX.map((v, i) => Math.hypot(v * dr, NBZ[i] * dr));
  const cost = new Float64Array(MR), prev = new Int32Array(MR);
  const hK = new Float64Array(MR * 2), hI = new Int32Array(MR * 2);
  let hn = 0;
  const hLess = (a, b) => hK[a] < hK[b] || (hK[a] === hK[b] && hI[a] < hI[b]);
  const hSwap = (a, b) => { const k = hK[a], i = hI[a]; hK[a] = hK[b]; hI[a] = hI[b]; hK[b] = k; hI[b] = i; };
  const hPush = (key, idx) => {
    let i = hn++; hK[i] = key; hI[i] = idx;
    while (i > 0) { const p = (i - 1) >> 1; if (hLess(p, i)) break; hSwap(i, p); i = p; }
  };
  const hPop = () => {
    const top = hI[0];
    hn--; hK[0] = hK[hn]; hI[0] = hI[hn];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let s = i;
      if (l < hn && hLess(l, s)) s = l;
      if (r < hn && hLess(r, s)) s = r;
      if (s === i) break;
      hSwap(i, s); i = s;
    }
    return top;
  };
  const network = new Uint8Array(MR);
  network[nodeCell[0]] = 1;
  const cellPaths = [];                        // arrays of road-grid cell indices
  const connected = new Uint8Array(settlements.length);
  connected[0] = 1;
  for (let step = 1; step < settlements.length; step++) {
    cost.fill(Infinity); prev.fill(-1); hn = 0;
    for (let k = 0; k < MR; k++) if (network[k]) { cost[k] = 0; hPush(0, k); }
    const want = new Int32Array(MR).fill(-1);
    for (let s = 0; s < settlements.length; s++) if (!connected[s]) want[nodeCell[s]] = s;
    let hit = -1, hitCell = -1;
    const done = new Uint8Array(MR);
    while (hn > 0) {
      const c = hPop();
      if (done[c]) continue;
      done[c] = 1;
      if (want[c] >= 0) { hit = want[c]; hitCell = c; break; }
      const cix = c % NR, ciz = (c / NR) | 0;
      if (cix < 1 || ciz < 1 || cix >= NR - 1 || ciz >= NR - 1) continue;
      for (let d = 0; d < 8; d++) {
        const n = (ciz + NBZ[d]) * NR + cix + NBX[d];
        if (done[n]) continue;
        const sl = (H2[n] - H2[c]) / DD[d];
        let e = DD[d] * (1 + 8 * sl * sl);
        if (wat2[n]) e *= 6;                   // crossings allowed; bridges are cheaper than long detours
        const nx = px(n % NR), nz = pz((n / NR) | 0);
        if (inPadZone(nx, nz)) e *= 60;
        e *= meadowMult(nx, nz);
        if (cost[c] + e < cost[n]) { cost[n] = cost[c] + e; prev[n] = c; hPush(cost[n], n); }
      }
    }
    if (hit < 0) break;                        // isolated site: leave unroaded
    const path = [];
    for (let c = hitCell; c >= 0; c = prev[c]) { path.push(c); if (network[c]) break; }
    path.reverse();                            // network -> settlement
    for (const c of path) network[c] = 1;
    cellPaths.push({ path, pop: settlements[hit].pop });
    connected[hit] = 1;
  }

  // ---- cell paths -> road pieces (dry runs simplified, wet runs = bridges)
  const roads = [];                            // {pts, cls, tgt?} tgt = grading targets
  const dpSimp = (pts, eps) => {
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop();
      if (b - a < 2) continue;
      const vx = pts[b][0] - pts[a][0], vz = pts[b][1] - pts[a][1];
      const L = Math.hypot(vx, vz) || 1;
      let mi = -1, md = 0;
      for (let i = a + 1; i < b; i++) {
        const dd = Math.abs((pts[i][0] - pts[a][0]) * vz - (pts[i][1] - pts[a][1]) * vx) / L;
        if (dd > md) { md = dd; mi = i; }
      }
      if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  };
  for (const { path, pop } of cellPaths) {
    const cls = pop < 150 ? 'track' : 'road';
    let run = [], runWet = wat2[path[0]] ? 1 : 0;
    const flushRun = (wet, nextPt) => {
      if (nextPt) run.push(nextPt);
      if (run.length >= 2) {
        if (wet) roads.push({ pts: [run[0], run[run.length - 1]], cls: 'bridge' });
        else {
          let pts = dpSimp(run, 30);
          // re-subdivide to <=50 m so grading targets track the terrain —
          // on warped (rough) ground a target lerped across a 100+ m
          // segment drifts metres off the surface and the clamp gouges
          const fine = [pts[0]];
          for (let i = 0; i + 1 < pts.length; i++) {
            const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
            const nSub = Math.max(1, Math.ceil(L / 50));
            for (let q = 1; q <= nSub; q++)
              fine.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * q / nSub,
                         pts[i][1] + (pts[i + 1][1] - pts[i][1]) * q / nSub]);
          }
          pts = fine;
          const tgt = pts.map(p => D.terrain(p[0], p[1]));
          for (let i = 1; i + 1 < tgt.length; i++) tgt[i] = (tgt[i - 1] + tgt[i] + tgt[i + 1]) / 3;
          roads.push({ pts, cls, tgt });
        }
      }
      run = nextPt ? [nextPt] : [];
    };
    for (const c of path) {
      const pt = [px(c % NR), pz((c / NR) | 0)];
      const wet = wat2[c] ? 1 : 0;
      if (wet !== runWet) { flushRun(runWet, pt); runWet = wet; }
      else run.push(pt);
    }
    flushRun(runWet, null);
  }

  // ---- segment index + queries (same pattern as the river carve) ----
  const QC = 64, qmap = new Map();
  const qKey = (qx, qz) => (qx + 512) * 4096 + (qz + 512);
  const RINF = 12;                             // grading feather halfwidth
  for (const r of roads) {
    if (r.cls === 'bridge') continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const s = { ax: r.pts[i][0], az: r.pts[i][1], bx: r.pts[i + 1][0], bz: r.pts[i + 1][1],
                  tA: r.tgt[i], tB: r.tgt[i + 1] };
      const qx0 = Math.floor((Math.min(s.ax, s.bx) - RINF) / QC), qx1 = Math.floor((Math.max(s.ax, s.bx) + RINF) / QC);
      const qz0 = Math.floor((Math.min(s.az, s.bz) - RINF) / QC), qz1 = Math.floor((Math.max(s.az, s.bz) + RINF) / QC);
      for (let qx = qx0; qx <= qx1; qx++) for (let qz = qz0; qz <= qz1; qz++) {
        const key = qKey(qx, qz);
        let arr = qmap.get(key);
        if (!arr) qmap.set(key, arr = []);
        arr.push(s);
      }
    }
  }
  let _d = Infinity, _t = 0;
  function roadScan(x, z) {
    _d = Infinity; _t = 0;
    const arr = qmap.get(qKey(Math.floor(x / QC), Math.floor(z / QC)));
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const vx = s.bx - s.ax, vz = s.bz - s.az;
      const wx = x - s.ax, wz = z - s.az;
      const L2 = vx * vx + vz * vz || 1;
      let t = (wx * vx + wz * vz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = wx - t * vx, ez = wz - t * vz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist < _d) { _d = dist; _t = s.tA + (s.tB - s.tA) * t; }
    }
  }
  function roadNear(x, z) { roadScan(x, z); return _d; }
  function roadDelta(x, z, h) {
    roadScan(x, z);
    if (_d >= RINF) return h;
    // flat roadbed core (4.5 m half-width), feathered shoulders to RINF —
    // "flatten across, not along"
    const prof = _d < 4.5 ? 1 : 1 - smf01((_d - 4.5) / (RINF - 4.5));
    let delta = (_t - h) * prof;
    // ±8: W12 terraced risers (22 m strata) need deeper road cuttings
    if (delta > 8) delta = 8; else if (delta < -8) delta = -8;
    return h + delta;
  }

  // ---- buildings: rows along the local road tangent at each settlement
  const buildings = [];
  for (let si = 0; si < settlements.length; si++) {
    const s = settlements[si];
    // street direction: tangent of the nearest road vertex pair
    let dirX = 1, dirZ = 0, best = Infinity;
    for (const r of roads) {
      if (r.cls === 'bridge') continue;
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const d = Math.hypot(r.pts[i][0] - s.x, r.pts[i][1] - s.z);
        if (d < best) {
          best = d;
          const L = Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]) || 1;
          dirX = (r.pts[i + 1][0] - r.pts[i][0]) / L; dirZ = (r.pts[i + 1][1] - r.pts[i][1]) / L;
        }
      }
    }
    const ang = Math.atan2(dirZ, dirX);
    const n = Math.min(22, 4 + Math.round(s.pop / 45));
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const h1 = hash2(si * 131 + i, 3), h2 = hash2(si * 131 + i, 7),
            h3 = hash2(si * 131 + i, 13), h4 = hash2(si * 131 + i, 17);
      const side = i % 2 ? 1 : -1;
      const along = (Math.floor(i / 2) - Math.floor(n / 4)) * 26 + (h1 - 0.5) * 12;
      const lat = side * (13 + h2 * 9);
      const bx = s.x + dirX * along - dirZ * lat;
      const bz = s.z + dirZ * along + dirX * lat;
      if (Math.hypot(bx - s.x, bz - s.z) > s.r) continue;
      const bh = D.terrain(bx, bz);
      if (bh < 0.5 || D.water(bx, bz) > bh) continue;
      roadScan(bx, bz);
      if (_d < 8) continue;
      buildings.push({
        x: bx, z: bz, w: 6 + h3 * 6, l: 8 + h4 * 7,
        hgt: 3 + h2 * 2.2, rot: ang + (h1 - 0.5) * 0.25,
        kind: h3 < 0.82 ? 'house' : 'barn',
      });
      placed++;
    }
  }

  const inCore = (x, z) => settlements.some(s => Math.hypot(x - s.x, z - s.z) < s.r * 0.75);

  return {
    settlements, roads, buildings, roadNear, roadDelta, inCore,
    stats: { bakeMs: Date.now() - t0, junctions: junctions.length },
  };
}
// ============================================================
// WORLD AERODROMES — WORLD-GEN-PROC stage 4 (the point of the exercise).
// A main field per sizeable settlement (candidate ring x 8 headings,
// scored on centreline flatness + cross-clearance + road proximity;
// length/width/surface by town size, >=900 m is paved) and backcountry
// strips on high benches (flat probe, fly-in flagged). Each strip emits
// an oriented grading SDF (the home runway carve, parameterized), a
// surface patch, a tree-exclusion box and a registry record with
// heading + touchdown zone for the future AP integration.
// Deterministic: fixed iteration orders, hash jitter only.
// ============================================================
function bakeAerodromes(D) {
  // D: { terrain(x,z), water(x,z), settlements, meadows, roadNear, SURFACE, salt }
  const t0 = Date.now();
  const { terrain, water, settlements, meadows, roadNear, SURFACE, salt } = D;
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const hash2 = (ix, iz) => {
    let h = (ix * 786433 + iz * 393241 + 65213 + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const strips = [];

  // centreline + shoulder probe: flatness, slope, wetness around a candidate
  function probe(cx, cz, hdg, len, wid) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const K = 11, hs = [];
    let sum = 0;
    for (let i = 0; i < K; i++) {
      const t = (i / (K - 1) - 0.5) * len;
      const h = terrain(cx + dx * t, cz + dz * t);
      hs.push(h); sum += h;
    }
    const elev = sum / K;
    let flat = 0, slopeMax = 0, wet = false;
    for (let i = 0; i < K; i++) {
      flat = Math.max(flat, Math.abs(hs[i] - elev));
      if (i) slopeMax = Math.max(slopeMax, Math.abs(hs[i] - hs[i - 1]) / (len / (K - 1)));
      const t = (i / (K - 1) - 0.5) * len;
      const px = cx + dx * t, pz = cz + dz * t;
      if (hs[i] < 1.2 || water(px, pz) > hs[i]) wet = true;
      for (const s of [-1, 1]) {
        const qx = px - dz * s * wid, qz = pz + dx * s * wid;
        const qh = terrain(qx, qz);
        if (qh < 1.2 || water(qx, qz) > qh) wet = true;
      }
    }
    return { flat, slopeMax, elev, wet };
  }
  const nearMeadow = (x, z, f) => meadows.some(m => Math.hypot(x - m.x, z - m.z) < m.r * f);
  const inHomeZone = (x, z) =>
    (x > -3400 && x < 400 && Math.abs(z) < 500) ||     // circuit band
    (x > -1900 && x < 900 && Math.abs(z) < 900);       // pad + generous margin
  const farFromStrips = (x, z, d) => strips.every(st => Math.hypot(x - st.x, z - st.z) >= d);

  function push(cx, cz, hdg, len, wid, surf, elev, name, kind, flyIn) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const feather = 90 + len * 0.1;
    const ex = Math.abs(dx) * len / 2 + Math.abs(dz) * wid / 2 + feather;
    const ez = Math.abs(dz) * len / 2 + Math.abs(dx) * wid / 2 + feather;
    // tdz on the APPROACH side: threshold + 25% (landing dir = -takeoffDir,
    // so the threshold is the +takeoffDir end). The W9 formula had it on
    // the rollout end — frame math was self-consistent so landings "worked",
    // but rollouts ran ~len/2 past the DRAWN strip (XCTY2 measured it).
    // spawn: the takeoff-run start, 35 m in from the rollout end.
    const tdzx = cx + dx * len * 0.25, tdzz = cz + dz * len * 0.25;
    strips.push({
      id: 'A' + strips.length, name, kind, x: cx, z: cz, hdg, len, wid,
      surface: surf, elev, tdz: [tdzx, tdzz],
      spawn: [cx - dx * (len / 2 - 35), cz - dz * (len / 2 - 35)],
      flyIn: !!flyIn,
      dx, dz, feather, bx0: cx - ex, bx1: cx + ex, bz0: cz - ez, bz1: cz + ez,
    });
  }

  // ---- main field per settlement above the pop threshold ----
  for (let si = 0; si < settlements.length; si++) {
    const s = settlements[si];
    if (s.kind === 'home' || s.pop < 250) continue;
    const len = s.pop >= 800 ? 900 : s.pop >= 450 ? 650 : 480;
    const wid = len >= 900 ? 30 : 22;
    const surf = len >= 900 ? SURFACE.PAVED : SURFACE.GRASS;
    let best = null;
    const r0 = Math.max(320, s.r + 160);
    for (let ri = 0; ri < 3; ri++) for (let ai = 0; ai < 12; ai++) {
      const ang = (ai / 12) * 2 * Math.PI + hash2(si * 37 + ri, ai) * 0.2;
      const cx = s.x + Math.cos(ang) * (r0 + ri * 280);
      const cz = s.z + Math.sin(ang) * (r0 + ri * 280);
      if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8) || !farFromStrips(cx, cz, 1500)) continue;
      if (roadNear(cx, cz) > 1100) continue;   // town fields must be road-reachable
      for (let hi = 0; hi < 8; hi++) {
        const hdg = hi * Math.PI / 8;
        const p = probe(cx, cz, hdg, len, wid);
        if (p.wet || p.flat > 6 || p.slopeMax > 0.06) continue;
        const cost = p.flat + p.slopeMax * 60 + Math.min(2, roadNear(cx, cz) / 600);
        if (!best || cost < best.cost) best = { cx, cz, hdg, cost, elev: p.elev };
      }
    }
    if (best)
      push(best.cx, best.cz, best.hdg, len, wid, surf, best.elev,
           s.name + (len >= 900 ? ' Airfield' : ' Field'), 'main', false);
  }

  // ---- backcountry strips: high benches, fly-in only ----
  {
    const cand = [];
    for (let gx = -11; gx <= 11; gx++) for (let gz = -11; gz <= 11; gz++) {
      for (let j = 0; j < 3; j++) {
        const cx = gx * 1000 + (hash2(gx + 900 + j * 131, gz) - 0.5) * 800;
        const cz = gz * 1000 + (hash2(gx, gz + 900 + j * 131) - 0.5) * 800;
        const h = terrain(cx, cz);
        if (h < 90 || h > 420) continue;
        if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8)) continue;
        if (settlements.some(s => Math.hypot(cx - s.x, cz - s.z) < 1800)) continue;
        let bestH = null;
        for (let hi = 0; hi < 8; hi++) {
          const hdg = hi * Math.PI / 8;
          const p = probe(cx, cz, hdg, 340, 18);
          if (p.wet || p.flat > 5 || p.slopeMax > 0.05) continue;
          if (!bestH || p.flat < bestH.flat) bestH = { hdg, flat: p.flat, elev: p.elev };
        }
        if (bestH) cand.push({ cx, cz, ...bestH });
      }
    }
    cand.sort((a, b) => (a.flat - b.flat) || (a.cx - b.cx) || (a.cz - b.cz));
    const SYL = ['Kar', 'Tyl', 'Ulv', 'Brekk', 'Stein', 'Vass'];
    for (const c of cand) {
      if (strips.filter(st => st.kind === 'strip').length >= 3) break;
      if (!farFromStrips(c.cx, c.cz, 3000)) continue;
      let nm = '';
      for (let v = 0; v < SYL.length; v++) {   // rotate on collision
        nm = SYL[(((hash2(Math.round(c.cx), Math.round(c.cz)) * SYL.length) | 0) + v) % SYL.length] + ' Strip';
        if (!strips.some(st => st.name === nm)) break;
      }
      push(c.cx, c.cz, c.hdg, 340, 18, SURFACE.GRAVEL, c.elev, nm, 'strip', true);
    }
  }

  // ---- queries: oriented grading SDF, surface patch, exclusion box ----
  function grade(x, z, h) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      const du = Math.max(0, Math.abs(lu) - st.len / 2);
      const dv = Math.max(0, Math.abs(lv) - st.wid / 2 - 6);
      const d = Math.hypot(du, dv);
      if (d < st.feather) h += (st.elev - h) * (1 - smf01(d / st.feather));
    }
    return h;
  }
  function surfaceAt(x, z) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 && Math.abs(lv) < st.wid / 2) return st.surface;
    }
    return -1;
  }
  function inBox(x, z, m) {
    for (const st of strips) {
      if (x < st.bx0 - m || x > st.bx1 + m || z < st.bz0 - m || z > st.bz1 + m) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 + m && Math.abs(lv) < st.wid / 2 + m) return true;
    }
    return false;
  }

  return { strips, grade, surfaceAt, inBox, stats: { bakeMs: Date.now() - t0 } };
}
// ============================================================
function makeSim(def, world) {
  const P_ = def.params;
  const PP = POWERPLANTS[P_.powerplant];
  // The PROP may be the aeroplane's own rather than the powerplant's: a GARAGE
  // build chooses its disc, and every prop number below is then synthesised from
  // it (60_gen_spec.js). A fiche sets no `prop`, so it reads the registry exactly
  // as before and no fleet number moves.
  const PR = P_.prop || PP.prop;
  const PROPA = Math.PI * (PR.D / 2) ** 2;
  const n = def.nodes.length;
  const p = new Float64Array(n * 3), v = new Float64Array(n * 3),
        f = new Float64Array(n * 3), m = new Float64Array(n),
        r = new Float64Array(n);
  const beams = def.beams.map(b => ({ ...b, L0: 0, strain: 0 }));
  const _treeScratch = [];
  const ctl = { thr: 0, de: 0, da: 0, dr: 0, brake: 0, flap: 0 };
  const FP = P_.flaps;   // per-aircraft high-lift deltas; undefined = no flaps
  let simT = 0;          // sim time for the deterministic wind field
  const out = { V: 0, alpha: 0, thrust: 0, wash: 0, alt: 0, vs: 0 };
  let totalM = 0;
  for (const nd of def.nodes) totalM += nd.m;

  // wingspan datum for ground effect: outermost wing-strip node |z| in def
  // coordinates. Derived, not a fiche param — works for every aircraft.
  let bSpan = 0;
  for (const st of def.strips) if (st.kind === 'wing')
    for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
      bSpan = Math.max(bSpan, Math.abs(def.nodes[i].p[2]));
  bSpan = Math.max(0.1, bSpan * 2);

  function reset(drop = 0) {
    for (let i = 0; i < n; i++) {
      const nd = def.nodes[i];
      p[i*3] = nd.p[0]; p[i*3+1] = nd.p[1]; p[i*3+2] = nd.p[2];
      v[i*3] = v[i*3+1] = v[i*3+2] = 0;
      m[i] = nd.m; r[i] = nd.r;
    }
    for (const b of beams) {
      b.L0 = Math.hypot(p[b.b*3]-p[b.a*3], p[b.b*3+1]-p[b.a*3+1], p[b.b*3+2]-p[b.a*3+2]);
      b.strain = 0;
    }
    let minC = Infinity;
    for (let i = 0; i < n; i++) minC = Math.min(minC, p[i*3+1] - r[i]);
    for (let i = 0; i < n; i++) p[i*3+1] += -minC + 0.01 + drop;
    ctl.thr = ctl.de = ctl.da = ctl.dr = ctl.brake = ctl.flap = 0;
    simT = 0;
  }

  // ---- small vec helpers on flat arrays ----
  const norm3 = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9;
    a[0] /= L; a[1] /= L; a[2] /= L; return a; };
  const xAft = [0,0,0], yUp = [0,0,0], zRt = [0,0,0], t1 = [0,0,0], t2 = [0,0,0];
  const avgP = (ids, o) => { o[0]=o[1]=o[2]=0;
    for (const i of ids) { o[0]+=p[i*3]; o[1]+=p[i*3+1]; o[2]+=p[i*3+2]; }
    const k = 1 / ids.length; o[0]*=k; o[1]*=k; o[2]*=k; };
  function bodyAxes() {
    avgP(def.refs.noseFrame, t1); avgP(def.refs.tailMid, t2);
    xAft[0]=t2[0]-t1[0]; xAft[1]=t2[1]-t1[1]; xAft[2]=t2[2]-t1[2]; norm3(xAft);
    avgP(def.refs.upLo, t1); avgP(def.refs.upHi, t2);
    yUp[0]=t2[0]-t1[0]; yUp[1]=t2[1]-t1[1]; yUp[2]=t2[2]-t1[2]; norm3(yUp);
    zRt[0]=yUp[1]*xAft[2]-yUp[2]*xAft[1];   // right = up x aft (nose -x)
    zRt[1]=yUp[2]*xAft[0]-yUp[0]*xAft[2];
    zRt[2]=yUp[0]*xAft[1]-yUp[1]*xAft[0]; norm3(zRt);
  }

  // sig = ground-effect downwash factor (1 = free air). It scales the induced
  // drag term AND raises the lift slope via the lifting-line identity
  // 1/a3d = 1/a0 + 1/eAR (a0 reconstructed from the registry constants).
  // dCl0/dCd0/dAStall = high-lift deltas (already scaled by flap fraction):
  // flaps are camber + drag + reduced stall margin, never a bare alpha shift.
  function polar(al, P, sig = 1, dCl0 = 0, dCd0 = 0, dAStall = 0) {
    const s = Math.min(1, Math.max(0, (Math.abs(al) - (P.aStall - dAStall)) / 0.10));
    let a3 = P.a3d;
    if (sig < 1) a3 = 1 / (1 / P.a3d - (1 - sig) / P.eAR);
    const Cl = (P.Cl0 + dCl0 + a3 * al) * (1 - s) + 1.1 * Math.sin(2 * al) * s;
    const CdAtt = P.Cd0 + dCd0 + sig * Cl * Cl / P.eAR;
    const Cd = CdAtt * (1 - s) + (P.Cd0 + dCd0 + 1.9 * Math.sin(al) * Math.sin(al)) * s;
    return [Cl, Cd];
  }

  // strip force pass. probe=true: no prop/wash, aero only.
  const sc=[0,0,0], sw_=[0,0,0], sn=[0,0,0];
  function aeroPass(probe) {
    bodyAxes();
    // mean velocity (mass-weighted)
    let vmx=0, vmy=0, vmz=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM;

    // world samples: ONE terrain height (ground effect) and ONE wind vector
    // under the wing per pass; strips re-sample wind at their own position
    // so spatial gust structure produces roll/twist forcing. All wind terms
    // are exact zeros when no wind is set — the zero-wind battery is
    // byte-identical to the pre-wind one.
    let gH = null, wcx = 0, wcy = 0, wcz = 0;
    if (world) {
      let sx = 0, sz = 0, sN = 0;
      for (const st of def.strips) if (st.kind === 'wing') {
        sx += p[st.fIn*3] + p[st.fOut*3];
        sz += p[st.fIn*3+2] + p[st.fOut*3+2];
        sN += 2;
      }
      const mx = sx / sN, mz = sz / sN;
      gH = world.terrainH(mx, mz);
      if (world.wind) { const wv = world.wind(mx, 0, mz, simT); wcx = wv[0]; wcy = wv[1]; wcz = wv[2]; }
    }
    // prop advance ratio uses AIRSPEED (thrust decays with air, not ground)
    const Vfwd = Math.max(0, -((vmx-wcx)*xAft[0]+(vmy-wcy)*xAft[1]+(vmz-wcz)*xAft[2]));

    // prop thrust + far-wake propwash
    let T = 0, wash = 0;
    if (!probe) {
      // TWO DIFFERENT COUNTS, and conflating them was a real defect (fixed
      // 2026-08-11). `refs.engine` is the list of NODES the thrust is applied
      // AT — the two mount points of ONE engine on the Cub, one node per
      // nacelle on the DC-3 — so it can say where the force goes but not how
      // many engines make it. `params.nEngines` says that, and every def
      // states it. The registry's Tstatic/kV2 are PER PROPELLER.
      const nE = def.params.nEngines || 1;
      const Tper = ctl.thr * Math.max(0, PR.Tstatic - PR.kV2 * Vfwd * Vfwd);
      T = Tper * nE;                                   // registry values are per engine
      // propwash is ONE disc's — the tail flies in the wake of the prop ahead
      // of it, not in the sum of the aeroplane's engines
      wash = Math.sqrt(Vfwd * Vfwd + 2 * Tper / (RHO * PROPA)) - Vfwd;
      const per = T / def.refs.engine.length;          // spread over the MOUNTS
      for (const e of def.refs.engine) {
        f[e*3]   -= per * xAft[0];
        f[e*3+1] -= per * xAft[1];
        f[e*3+2] -= per * xAft[2];
      }
    }
    out.aeroFy = 0; out.wingFy = 0; out.stabFy = 0; out.dbgAl = 0; out.dbgN = 0;
    out.thrust = T; out.wash = wash;
    // out.V/alpha are AIR-relative (true IAS/aero alpha); out.Vg is groundspeed
    const avx = vmx - wcx, avy = vmy - wcy, avz = vmz - wcz;
    out.V = Math.hypot(avx, avy, avz);
    out.Vg = Math.hypot(vmx, vmy, vmz);
    out.windX = wcx; out.windY = wcy; out.windZ = wcz;
    out.alpha = Math.atan2(-(avx*yUp[0]+avy*yUp[1]+avz*yUp[2]),
                           -(avx*xAft[0]+avy*xAft[1]+avz*xAft[2]));
    out.vs = vmy;

    for (const st of def.strips) {
      // --- strip frame ---
      if (st.kind === 'wing') {
        const fi=st.fIn*3, fo=st.fOut*3, ri=st.rIn*3, ro=st.rOut*3, t=st.t;
        sc[0]=(p[ri]+(p[ro]-p[ri])*t)-(p[fi]+(p[fo]-p[fi])*t);
        sc[1]=(p[ri+1]+(p[ro+1]-p[ri+1])*t)-(p[fi+1]+(p[fo+1]-p[fi+1])*t);
        sc[2]=(p[ri+2]+(p[ro+2]-p[ri+2])*t)-(p[fi+2]+(p[fo+2]-p[fi+2])*t);
        norm3(sc);
        sw_[0]=(p[fo]-p[fi])*st.side; sw_[1]=(p[fo+1]-p[fi+1])*st.side; sw_[2]=(p[fo+2]-p[fi+2])*st.side;
        norm3(sw_);
        sn[0]=sw_[1]*sc[2]-sw_[2]*sc[1];
        sn[1]=sw_[2]*sc[0]-sw_[0]*sc[2];
        sn[2]=sw_[0]*sc[1]-sw_[1]*sc[0]; norm3(sn);
      } else if (st.kind === 'stab') {
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=yUp[0]; sn[1]=yUp[1]; sn[2]=yUp[2];
      } else if (st.kind === 'vtail') {
        // V-TAIL panel: chord still aft, but the normal is canted out of the
        // vertical by the panel's own dihedral, INWARD on each side:
        //   n = cos G * up  -  side * sin G * right
        // Both panels then lift upward together (their lateral parts cancel in
        // symmetric flight) and oppositely in yaw, which is the whole trick —
        // the mixing falls out of the geometry instead of being asserted.
        const cV = st.cosV, sV = st.sinV * st.side;
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=cV*yUp[0]-sV*zRt[0]; sn[1]=cV*yUp[1]-sV*zRt[1]; sn[2]=cV*yUp[2]-sV*zRt[2];
        norm3(sn);
      } else { // fin
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=zRt[0]; sn[1]=zRt[1]; sn[2]=zRt[2];
      }
      // --- local velocity + position via attach weights ---
      let vx=0, vy=0, vz=0, spx=0, spy=0, spz=0;
      for (const [i, w] of st.w) {
        vx+=v[i*3]*w; vy+=v[i*3+1]*w; vz+=v[i*3+2]*w;
        spx+=p[i*3]*w; spy+=p[i*3+1]*w; spz+=p[i*3+2]*w;
      }
      // wind at the strip's own position (spatial gust structure -> roll/twist)
      let wx_ = wcx, wy_ = wcy, wz_ = wcz;
      if (world && world.wind) { const wv = world.wind(spx, spy, spz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      // relative air velocity = air motion (wash + wind) - node motion
      const wsh = wash * st.wash;
      let rx = wsh*xAft[0]+wx_-vx, ry = wsh*xAft[1]+wy_-vy, rz = wsh*xAft[2]+wz_-vz;
      const u = rx*sc[0]+ry*sc[1]+rz*sc[2];
      const w_ = rx*sn[0]+ry*sn[1]+rz*sn[2];
      const V2 = u*u + w_*w_;
      if (V2 < 0.01) continue;
      let al = Math.atan2(w_, u);
      let P = P_.polarWing;
      let fl = 0;                                  // flap fraction on this strip
      if (st.kind === 'wing') {
        al += P_.ailTau * ctl.da * st.side * st.ail;
        if (FP && st.flap && ctl.flap > 0) {
          fl = ctl.flap * st.flap;
          al += (FP.tau || 0) * fl;                // flaperon droop (surface rotates)
        }
      } else if (st.kind === 'stab') {
        al = (1 - P_.downwash) * al + P_.stabTrim - P_.elevTau * ctl.de;
        P = P_.polarTail;
      } else if (st.kind === 'vtail') {
        // ruddervator: elevator SYMMETRIC (both panels the same way, vertical
        // forces add and lateral cancel), rudder ANTISYMMETRIC (the reverse)
        // MINUS side, not plus. A V panel's normal leans INWARD (that is what
        // dihedral does — it is the same geometry that gives a dihedralled wing
        // its roll stability), so the panel that goes nose-up pushes the tail
        // toward the centreline, not away from it. With +side the aeroplane
        // yawed the wrong way on every rudder input: measured d(yawLeft)/d(dr)
        // = -6991 against a conventional tail's +3814.
        al = (1 - P_.downwash) * al + P_.stabTrim - P_.elevTau * ctl.de
             - P_.rudTau * ctl.dr * PAR.rudderSign * st.side;
        P = P_.polarTail;
      } else {
        al += P_.rudTau * ctl.dr * PAR.rudderSign;
        P = P_.polarTail;
      }
      // ground effect (wing strips only; tail excluded — honest cut):
      // McCormick sigma = (16h/b)^2 / (1 + (16h/b)^2)
      let sig = 1;
      if (gH !== null && st.kind === 'wing') {
        const hb = Math.max(0.02,
          ((p[st.fIn*3+1] + p[st.fOut*3+1]) * 0.5 - gH) / bSpan);
        const g16 = 16 * hb;
        sig = g16 * g16 / (1 + g16 * g16);
      }
      const [Cl, Cd] = fl > 0
        ? polar(al, P, sig, (FP.dCl0 || 0) * fl, (FP.dCd0 || 0) * fl, (FP.dAStall || 0) * fl)
        : polar(al, P, sig);
      const q = 0.5 * RHO * V2 * st.area, iv = 1 / Math.sqrt(V2);
      // drag along relative wind (in strip plane), lift perpendicular
      const dx=(u*sc[0]+w_*sn[0])*iv, dy=(u*sc[1]+w_*sn[1])*iv, dz=(u*sc[2]+w_*sn[2])*iv;
      const lx=(u*sn[0]-w_*sc[0])*iv, ly=(u*sn[1]-w_*sc[1])*iv, lz=(u*sn[2]-w_*sc[2])*iv;
      const Fx = q*(Cl*lx + Cd*dx), Fy = q*(Cl*ly + Cd*dy), Fz = q*(Cl*lz + Cd*dz);
      out.aeroFy += Fy;
      if (st.kind === 'wing') { out.wingFy += Fy; out.dbgAl += al; out.dbgN++;
        if (out.dump) out.dump.push({ side: st.side, t: st.t, wash: st.wash,
          al: al*57.3, Fy, ch: st.chord }); }
      else if (st.kind === 'stab' || st.kind === 'vtail') out.stabFy += Fy;
      for (const [i, w] of st.w) {
        f[i*3] += Fx*w; f[i*3+1] += Fy*w; f[i*3+2] += Fz*w;
      }
      // wing pitching moment as front/rear spar couple (d = spar spacing 0.78 m)
      // flap dCm0 feeds in here — the couple reading polarWing.Cm0 alone would
      // silently ignore the flap pitching moment (HANDOVER "watch Cm0")
      if (st.kind === 'wing') {
        const Fc = q * (P_.polarWing.Cm0 + (fl > 0 ? (FP.dCm0 || 0) * fl : 0))
                     * st.chord / P_.sparSpacing, t = st.t;
        const cW = [[st.fIn, (1-t)], [st.fOut, t], [st.rIn, -(1-t)], [st.rOut, -t]];
        for (const [i, w] of cW) {
          f[i*3] += Fc*w*sn[0]; f[i*3+1] += Fc*w*sn[1]; f[i*3+2] += Fc*w*sn[2];
        }
      }
    }
    // fuselage blobs: anisotropic CdA in body axes; side/vertical area split
    // between cabin and aft fuselage so yaw and pitch damping are physical
    const blob = (ids, CdA) => {
      let vx=0, vy=0, vz=0, bx=0, by=0, bz=0;
      for (const i of ids) {
        vx+=v[i*3]; vy+=v[i*3+1]; vz+=v[i*3+2];
        bx+=p[i*3]; by+=p[i*3+1]; bz+=p[i*3+2];
      }
      vx/=4; vy/=4; vz/=4; bx/=4; by/=4; bz/=4;
      // wind on the fuselage: without this there is no weathercocking
      let wx_ = 0, wy_ = 0, wz_ = 0;
      if (world && world.wind) { const wv = world.wind(bx, by, bz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      const rx=wx_-vx, ry=wy_-vy, rz=wz_-vz, Vr = Math.hypot(rx, ry, rz);
      if (Vr < 0.1) return;
      const cb = [rx*xAft[0]+ry*xAft[1]+rz*xAft[2],
                  rx*yUp[0]+ry*yUp[1]+rz*yUp[2],
                  rx*zRt[0]+ry*zRt[1]+rz*zRt[2]];
      const k = 0.5 * RHO * Vr * 0.25;
      for (const i of ids) {
        f[i*3]   += k*(CdA[0]*cb[0]*xAft[0] + CdA[1]*cb[1]*yUp[0] + CdA[2]*cb[2]*zRt[0]);
        f[i*3+1] += k*(CdA[0]*cb[0]*xAft[1] + CdA[1]*cb[1]*yUp[1] + CdA[2]*cb[2]*zRt[1]);
        f[i*3+2] += k*(CdA[0]*cb[0]*xAft[2] + CdA[1]*cb[1]*yUp[2] + CdA[2]*cb[2]*zRt[2]);
      }
    };
    blob(def.refs.fusDrag,    P_.fusCdA);
    blob(def.refs.fusDragAft, P_.fusCdAAft);
  }

  const G = -9.81, DEFDAMP = 0.5;
  // ground stiffness scales with node mass so light aircraft stay stable at the same dt
  const KGn = new Float64Array(n), CGn = new Float64Array(n),
        KTn = new Float64Array(n), CTn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const mi = def.nodes[i].m;
    // light nodes: Cub/drone-calibrated regime (unchanged); heavy nodes keep scaling
    KGn[i] = mi <= 6 ? Math.min(9e4, 2.5e5 * mi) : 1.5e4 * mi;
    CGn[i] = 1.6 * Math.sqrt(KGn[i] * mi);
    KTn[i] = Math.min(2.2e4, 2e5 * mi);
    CTn[i] = Math.min(40, 300 * mi);
  }

  function trqOf() {
    let cgx=0, cgy=0;
    if (out.trqDebugOnce) { out.trqDebugOnce = false;
      let sp=0, sf=0, sm=0;
      for (let i = 0; i < n; i++) { sp+=p[i*3]; sf+=f[i*3+1]; sm+=m[i]; }
      console.log("trqOf dbg: n=", n, "sum p.x=", sp, "sum f.y=", sf, "sum m=", sm, "totalM=", totalM, "G=", typeof G !== "undefined" ? G : "UNDEF"); }
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; }
    cgx/=totalM; cgy/=totalM;
    let Mz = 0;
    for (let i = 0; i < n; i++)
      Mz += (p[i*3]-cgx)*(f[i*3+1]-G*m[i]) - (p[i*3+1]-cgy)*f[i*3];
    return -Mz;   // nose-up positive, gravity excluded
  }
  function substep(dt) {
    for (let i = 0; i < n; i++) { f[i*3]=0; f[i*3+1]=G*m[i]; f[i*3+2]=0; }
    aeroPass(false);
    if (out.trq) out.trqAero = trqOf();
    for (const b of beams) {
      const a3=b.a*3, b3=b.b*3;
      let dx=p[b3]-p[a3], dy=p[b3+1]-p[a3+1], dz=p[b3+2]-p[a3+2];
      const L = Math.hypot(dx, dy, dz) || 1e-9;
      dx/=L; dy/=L; dz/=L;
      const vrel = (v[b3]-v[a3])*dx + (v[b3+1]-v[a3+1])*dy + (v[b3+2]-v[a3+2])*dz;
      const Fb = b.k * (L - b.L0) + b.c * vrel;
      b.strain = (L - b.L0) / b.L0;
      f[a3]+=Fb*dx; f[a3+1]+=Fb*dy; f[a3+2]+=Fb*dz;
      f[b3]-=Fb*dx; f[b3+1]-=Fb*dy; f[b3+2]-=Fb*dz;
    }
    // ground: wheels roll, everything else scrapes. Terrain-aware.
    const gH = world ? world.terrainH : null;
    for (let i = 0; i < n; i++) {
      const i3 = i*3;
      const gy = gH ? gH(p[i3], p[i3+2]) : 0;
      const pen = gy + r[i] - p[i3+1];
      if (pen <= 0) continue;
      let Fn = KGn[i] * pen - CGn[i] * v[i3+1];
      if (out.gndDump) out.gndPitch -= (p[i3] - out.gndCgx) * Fn;

      if (Fn < 0) Fn = 0;
      f[i3+1] += Fn;
      const isMain = def.refs.mains.includes(i), isTW = i === def.refs.tw;
      if (isMain || isTW) {
        // rolling dir = horizontal forward, tailwheel steered by rudder
        let hx = -xAft[0], hz = -xAft[2];
        if (isTW) {
          const s = P_.twSteer * ctl.dr;   // measured: matches nose-left convention
          const cs = Math.cos(s), sn_ = Math.sin(s);
          const nx = hx*cs - hz*sn_, nz = hx*sn_ + hz*cs;
          hx = nx; hz = nz;
        }
        const hL = Math.hypot(hx, hz) || 1e-9; hx/=hL; hz/=hL;
        const lx = -hz, lz = hx;
        const vr_ = v[i3]*hx + v[i3+2]*hz, vl = v[i3]*lx + v[i3+2]*lz;
        const muR = CRR + (isMain ? ctl.brake * MU_BRAKE : 0);
        const kR = Math.min(muR * Fn / Math.max(Math.abs(vr_), 0.2), m[i]/dt);
        const kL = Math.min(MU_LAT * Fn / Math.max(Math.abs(vl), 0.02), m[i]/dt);
        f[i3]   -= kR*vr_*hx + kL*vl*lx;
        f[i3+2] -= kR*vr_*hz + kL*vl*lz;
      } else {
        const vx=v[i3], vz=v[i3+2], sp = Math.hypot(vx, vz);
        if (sp > 1e-6) {
          const kf = Math.min(0.8 * Fn / sp, m[i]/dt);
          f[i3] -= kf*vx; f[i3+2] -= kf*vz;
        }
      }
    }
    // tree collisions: cheap cylinder push-out, only when low and near trees
    if (world) {
      const cgx = p[0], cgz = p[2];   // any chassis node as coarse anchor
      if (p[1] < 24) {
        const near = world.treesNear(cgx, cgz, _treeScratch);
        if (near.length) for (let i = 0; i < n; i++) {
          const i3 = i*3;
          for (const ti of near) {
            const T = world.trees[ti];
            const dx = p[i3] - T.x, dz = p[i3+2] - T.z;
            const R = 0.7 * T.s + 0.12;
            const d2 = dx*dx + dz*dz;
            if (d2 > R*R) continue;
            if (p[i3+1] > T.h + 4.6 * T.s) continue;
            const d = Math.sqrt(d2) || 1e-6;
            const push = KTn[i] * (R - d) / d;
            f[i3] += push * dx - CTn[i] * v[i3];
            f[i3+2] += push * dz - CTn[i] * v[i3+2];
          }
        }
      }
    }
    if (out.trq) out.trqTotal = trqOf();
    // integrate; damp only deformation (velocity relative to rigid mean)
    let vmx=0, vmy=0, vmz=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM;
    const dp = Math.max(0, 1 - DEFDAMP * dt);
    for (let i = 0; i < n; i++) {
      const i3 = i*3, im = dt/m[i];
      v[i3]   = vmx + (v[i3]   + f[i3]*im   - vmx) * dp;
      v[i3+1] = vmy + (v[i3+1] + f[i3+1]*im - vmy) * dp;
      v[i3+2] = vmz + (v[i3+2] + f[i3+2]*im - vmz) * dp;
      p[i3] += v[i3]*dt; p[i3+1] += v[i3+1]*dt; p[i3+2] += v[i3+2]*dt;
    }
    // altitude of CG (wheel-corrected later by caller if needed)
    let cy = 0;
    for (let i = 0; i < n; i++) cy += p[i*3+1]*m[i];
    out.alt = cy/totalM;
  }

  function step(dtFrame, sub = P_.substeps ?? 24) {
    const dt = dtFrame / sub;
    for (let s = 0; s < sub; s++) { substep(dt); simT += dt; }
  }

  // ---- wind tunnel: prescribe uniform velocity, measure aero force+moment ----
  function probe(vel) {
    for (let i = 0; i < n; i++) {
      f[i*3]=f[i*3+1]=f[i*3+2]=0;
      v[i*3]=vel[0]; v[i*3+1]=vel[1]; v[i*3+2]=vel[2];
    }
    aeroPass(true);
    let cgx=0, cgy=0, cgz=0;
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; cgz+=p[i*3+2]*m[i]; }
    cgx/=totalM; cgy/=totalM; cgz/=totalM;
    let Fx=0, Fy=0, Fz=0, Mz=0, My=0;
    for (let i = 0; i < n; i++) {
      Fx+=f[i*3]; Fy+=f[i*3+1]; Fz+=f[i*3+2];
      Mz += (p[i*3]-cgx)*f[i*3+1] - (p[i*3+1]-cgy)*f[i*3];
      My += (p[i*3+2]-cgz)*f[i*3] - (p[i*3]-cgx)*f[i*3+2];
    }
    // nose-up pitch = -Mz ; nose-LEFT yaw = +My  (nose -x, +z is the LEFT side)
    return { Fx, Fy, Fz, pitchUp: -Mz, yawLeft: My, cg: [cgx, cgy, cgz] };
  }

  function stats() {
    let smax = 0, bad = false;
    for (const b of beams) smax = Math.max(smax, Math.abs(b.strain));
    for (let i = 0; i < n; i++) if (!isFinite(p[i*3+1])) bad = true;
    return { smax, bad };
  }
  function impulse(i, ix, iy, iz) { v[i*3]+=ix/m[i]; v[i*3+1]+=iy/m[i]; v[i*3+2]+=iz/m[i]; }
  function wheelsOnGround() {
    let c = 0;
    for (const i of [...def.refs.mains, def.refs.tw]) {
      const gh = world ? world.terrainH(p[i*3], p[i*3+2]) : 0;
      if (p[i*3+1] - r[i] - gh < 0.03) c++;
    }
    return c;
  }
  function cgPos() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=p[i*3]*m[i]; y+=p[i*3+1]*m[i]; z+=p[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function cgVel() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=v[i*3]*m[i]; y+=v[i*3+1]*m[i]; z+=v[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function axes() { bodyAxes(); return [xAft.slice(), yUp.slice(), zRt.slice()]; }

  return { p, v, m, r, beams, n, ctl, out, totalM,
           reset, step, probe, stats, impulse, wheelsOnGround, cgPos, cgVel, axes };
}


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
// ============================================================
// W10 spawn-at-aerodrome: after sim.reset(0), rotate the def geometry
// from its built-in -x nose heading onto the strip's takeoff heading
// (theta = pi - hdg) and translate to the record's spawn point at strip
// elevation. HOME (hdg pi, spawn [0,0], elev 0) is a BIT-EXACT no-op,
// so calling this unconditionally changes nothing for the home battery.
function placeAtAerodrome(sim, a) {
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  const th = Math.PI - a.hdg;
  const c = snap(Math.cos(th)), s = snap(Math.sin(th));
  const sp = a.spawn || [0, 0];
  for (let i = 0; i < sim.n; i++) {
    const x = sim.p[i * 3], z = sim.p[i * 3 + 2];
    sim.p[i * 3] = x * c + z * s + sp[0];
    sim.p[i * 3 + 2] = -x * s + z * c + sp[1];
    sim.p[i * 3 + 1] += a.elev;
  }
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
  const taxiFF = (() => {
    const PP = POWERPLANTS[def.params.powerplant];
    const PR = def.params.prop || PP.prop;
    const T0 = Math.max(1, PR.Tstatic * (def.params.nEngines || 1));
    return Math.min(0.5, CRR * sim.totalM * 9.81 / T0);
  })();
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  // u = frame axis (landing direction); origin places tdz at s = -450
  const mkFrame = (a, sx, sz) => {
    let ux = snap(Math.cos(a.hdg)), uz = snap(Math.sin(a.hdg));
    if (sx !== undefined) {                 // pick the landing end facing travel
      const d = ux * sx + uz * sz;
      if (d < 0) { ux = -ux; uz = -uz; }
    } else { ux = -ux; uz = -uz; }          // departure: land opposite takeoff
    return { ux, uz, ox: a.tdz[0] + 450 * ux, oz: a.tdz[1] + 450 * uz };
  };
  const HOMEISH = { hdg: Math.PI, tdz: [-450, 0], elev: 0 };  // world-less fallback
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: A.VAppr,
    xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
    targetDir: [-1, 0, 0], trackHold: true, dirX: -1,
    restAlt: null, refAlt: null, altRef: 0, tdInfo: null, dbg: {},
    route: null, xc: false, frame: null,
  };
  ap.setRoute = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);               // departure frame
    ap.altRef = from.elev;
    ap.shortFld = false;                    // set per-arrival in enterArrival
  };
  ap.setRoute(world ? world.aerodromes[0] : HOMEISH,
              world ? world.aerodromes[0] : HOMEISH);
  // W14 multi-hop: depart from wherever the aircraft is standing on
  // `from` — no reset, no teleport. The plan runs on the first update
  // (it needs the live pose): takeoff INTO the wind when there is any,
  // else along the current nose; straight ahead when the runway left
  // covers TORun + margin, else taxi back along the strip and turn
  // around (TAXI/LINEUP), then the normal ROLL takes over. Use on a
  // fresh makeAutopilot instance so restAlt/integrators latch clean.
  ap.departFrom = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.trackHold = false;
    ap.taxiTgt = null;
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
  let thP = 0, phP = 0, eP = 0, q = 0, p = 0, eR = 0, eRslow = 0, thF = 0, phF = 0, thCA = 0, vsF = 0;
  let aDe = 0, aDa = 0, aDr = 0, phCA = 0;
  let Ith = 0, thcI = 0.06, It = 0, thrC = 0.6;
  let phaseT = 0, headingCapT = 0, thFlare0 = 0, thLift0 = 0, brakeRamp = 0, holdActive = false, holdWas = false;
  let eAP = 0, eAR = 0, eARslow = 0;   // course-over-ground error chain (air guidance)
  let eTrim = 0;                        // wind-only course trim (standing bank for slip)
  let pendReEng = false;                // W14: full state re-latch on next update
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // W14 manual-controls prep: call when the AP resumes after a stretch of
  // external/manual flight — every integrator, filter and servo memory
  // re-latches from the live state on the next update, so re-engage flies
  // from the CURRENT attitude instead of stale pre-handoff state (the
  // DC-3-at-Vr nose-over documented in HANDOVER). restAlt is left alone:
  // it anchors the current route's altitude refs. Never called by the
  // AP's own flow — zero effect on existing batteries.
  ap.reEngage = () => { pendReEng = true; };

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    if (ap.restAlt === null) { ap.restAlt = cg[1]; ap.refAlt = cg[1]; }
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
    const o_ = sim.out;
    const Vg = Math.hypot(vcg[0], vcg[1], vcg[2]);
    const V = Math.hypot(vcg[0] - (o_.windX || 0), vcg[1] - (o_.windY || 0), vcg[2] - (o_.windZ || 0));
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

    const AF = A.attFilt ?? 1.0;
    const thRaw = Math.asin(clamp(-xA[1], -1, 1));
    const phRaw = Math.atan2(-zR[1], yU[1]);
    if (pendReEng) {                    // W14: re-latch everything live
      pendReEng = false;
      thF = thRaw; phF = phRaw; thP = thRaw; phP = phRaw; q = p = 0;
      eP = e; eR = eRslow = 0; eAP = eA; eAR = eARslow = 0;
      vsF = vcg[1]; thCA = thRaw; phCA = 0;
      aDe = sim.ctl.de; aDa = sim.ctl.da; aDr = sim.ctl.dr;
      Ith = 0; It = 0; thcI = 0.06; thrC = A.thrCruise ?? 0.6;
      eTrim = 0; brakeRamp = 0; holdWas = holdActive = false;
    }
    thF += AF * (thRaw - thF); phF += AF * (phRaw - phF);
    const th = thF, ph = phF;
    const RF = A.rateFilt ?? 0.12;
    q += RF * ((th - thP) / dt - q); thP = th;
    p += RF * ((ph - phP) / dt - p); phP = ph;
    eR += RF * 0.85 * ((e - eP) / dt - eR); eP = e;
    eRslow += dt / 2.0 * (eR - eRslow);
    eAR += RF * 0.85 * ((eA - eAP) / dt - eAR); eAP = eA;
    eARslow += dt / 2.0 * (eAR - eARslow);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(V, 5);

    const c = sim.ctl, onG = sim.wheelsOnGround();
    if (onG > 0 && agl < A.aglGuard && V < A.VRot * 0.9
        && ['LIFTOFF','CLIMB'].includes(ap.phase)) {
      ap.phase = 'ROLL'; phaseT = 0;      // genuinely settled back (slow): retry
    }

    const holdPitch = (thC) => {
      // W14 fix of the documented holdWas bug: resync whenever the
      // PREVIOUS update did not call holdPitch (bookkeeping at the end of
      // ap.update). Continuous phase chains behave identically — the
      // resync now also fires after ROLL retries and manual-flight gaps
      // instead of only on the very first call of the AP's life.
      if (!holdWas) thCA = th;                // (re-)engage from current attitude
      holdActive = true;
      const sl = (A.pitchCmdSlew ?? 99) * dt;
      thCA += clamp(thC - thCA, -sl, sl);
      Ith = clamp(Ith + (A.pitchI ?? 0.05) * (thCA - th) * dt, -0.15, 0.15);
      c.de = clamp((A.pitchP ?? 1.2) * (thCA - th) - (A.pitchD ?? 1.8) * q + Ith, -0.30, 0.35);
    };
    const airLateral = (bankLim = A.bankLim ?? 0.30) => {
      // standing-disturbance trim: a slipping aircraft (dihedral, ariK=0)
      // needs a standing bank to hold a crosswind course; P-only leaves a
      // residual course error and a ~L*residual cross-track hang (Jodel 20 m,
      // DC-3 11 m measured). Integrate ONLY in the trim regime (|eA| small):
      // integrating during the capture is the windup failure documented in
      // HANDOVER. Exact zero in calm air.
      if (Math.abs(o_.windX || 0) + Math.abs(o_.windZ || 0) > 0.5) {
        if (Math.abs(eA) < 0.2) eTrim = clamp(eTrim + 0.15 * eA * dt, -0.10, 0.10);
        else eTrim -= 0.8 * eTrim * dt;
      }
      const phC = clamp((A.hdgP ?? 0.7) * eA + (A.hdgD ?? 0.9) * eAR + eTrim, -bankLim, bankLim);
      phCA += clamp(phC - phCA, -(A.bankSlew ?? 0.18) * dt, (A.bankSlew ?? 0.18) * dt);
      c.da = clamp((A.rollP ?? 2.0) * (phCA - ph) - (A.rollD ?? 2.0) * p, -0.30, 0.30);
      c.dr = clamp(-(A.betaK ?? 0.3) * beta - (A.yawDampK ?? 0.6) * (eAR - eARslow)
                   - (A.ariK ?? 0.35) * c.da, -0.25, 0.25);
    };
    const speedThrottle = (Vt) => {
      It = clamp(It + 0.010 * (Vt - V) * dt, -0.30, 0.30);
      c.thr = clamp(thrC + 0.05 * (Vt - V) + It, A.thrFloor ?? 0.12, 1);
    };
    const holdVS = (VSc, thMax = 0.16) => {
      vsF += (A.vsFilt ?? 1.0) * (vcg[1] - vsF);
      const fl = A.vsFloor ?? -0.08;
      thcI = clamp(thcI + (A.vsI ?? 0.015) * (VSc - vsF) * dt, fl, thMax);
      holdPitch(clamp(thcI + (A.vsP ?? 0.010) * (VSc - vsF), fl, thMax));
    };
    const groundSteer = () => {
      c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
    };

    // W14 taxi governor: slow ground speed hold, slower through tight turns
    const taxi = (Vt) => {
      c.de = A.taxiDe ?? 0.30;             // stick aft: tailwheel planted, steering bites
      // taxiFF cancels rolling resistance, the speed error does the rest, and
      // the cap rises with the feedforward so a heavy-footed aeroplane still
      // has the same 0.27 of authority ABOVE break-even that 0.35 used to mean.
      c.thr = clamp(taxiFF + 0.06 * (Vt - Vg), 0, taxiFF + 0.27);
      c.brake = Vg > Vt + 1.2 ? 0.45 : 0;
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
    };

    switch (ap.phase) {
      case 'DEPART': {
        // one-shot planning with the live pose (see ap.departFrom)
        const from = ap.route.from;
        const axx = snap(Math.cos(from.hdg)), axz = snap(Math.sin(from.hdg));
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
        if (from.len / 2 - sPos >= need) { ap.phase = 'LINEUP'; phaseT = 0; break; }
        // backtrack: taxi to the run start for this direction (clamped to
        // the strip); LINEUP then turns it onto the centreline
        const sStart = Math.max(-from.len / 2 + 25, from.len / 2 - need - 25);
        ap.taxiTgt = [from.x + ux * sStart, from.z + uz * sStart];
        ap.phase = 'TAXI'; phaseT = 0;
        break;
      }

      case 'TAXI': {
        const ddx = ap.taxiTgt[0] - cg[0], ddz = ap.taxiTgt[1] - cg[2];
        const dist = Math.hypot(ddx, ddz) || 1e-9;
        ap.targetDir = [ddx / dist, 0, ddz / dist];
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        taxi(Math.abs(e) > 0.6 ? 2.2 : 4.5);
        if (dist < 22 || phaseT > 120) { ap.phase = 'LINEUP'; phaseT = 0; }
        break;
      }

      case 'LINEUP': {
        ap.trackHold = true;                 // centreline pursuit, dirX = -1
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        const alig = -(nose[0] * F.ux + nose[1] * F.uz);  // dot(nose, takeoff dir)
        taxi(alig > 0.5 ? 4.5 : 2.4);
        if (alig > 0.988 && Math.abs(sCr) < 8 && Math.abs(eR) < 0.15) {
          ap.phase = 'ROLL'; phaseT = 0;
          ap.t = Math.max(ap.t, 1);          // ROLL's 0.5 s throttle delay is long past
        }
        break;
      }

      case 'ROLL':
        c.thr = ap.t > 0.5 ? 1 : 0; c.brake = 0;
        if (A.rotate) {
          // taildragger sequence: tail up first, run on the mains, rotate at Vr
          if (V > A.VRot) holdPitch(A.thRotate ?? A.liftoffTh);
          else if (V > A.VTailUp) holdPitch(A.thTailUp ?? 0.02);
          else c.de = A.rollDe;
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

      case 'CLIMB':
        c.thr = 1;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral();
        if (cg[1] > ap.altRef + ap.hCruise - 8) {
          if (ap.xc) {
            // remember the (safe, flat) climb-out heading: ENROUTE climbs
            // on it before turning toward terrain it cannot out-climb
            ap.holdDir = [ap.frame.ux * ap.dirX, 0, ap.frame.uz * ap.dirX];
            ap.phase = 'ENROUTE'; enterArrival(); ap.trackHold = false;
          } else ap.phase = 'CRUISE';
          phaseT = 0; thrC = A.thrCruise; thcI = 0.04;
        }
        break;

      case 'CRUISE':
        speedThrottle(ap.VCruise);
        holdVS(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2));
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
        holdVS(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -4.5, 2.2));
        airLateral();
        if (fDist < 600) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;
      }

      case 'TURNBACK':
        speedThrottle(A.VTurn ?? ap.VCruise);
        holdVS(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2));
        airLateral();
        headingCapT = Math.abs(e) < 0.12 ? headingCapT + dt : 0;
        if (headingCapT > 1.5) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;

      case 'INBOUND': {
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
        holdVS(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -3.5, 2.2));
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
        if (d > 0 && hGS <= cg[1] + 2 && cg[1] - hGS < 40) { ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr; }
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
        if (agl < A.flareAgl) { ap.phase = 'FLARE'; phaseT = 0; thFlare0 = th; }
        break;
      }

      case 'FLARE':
        c.thr = A.flareThr ?? 0;
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
        if (agl < (A.decrabAgl ?? 3.5) && Math.abs(o_.windZ || 0) > 0.5) {
          airLateral(0.12);
          const nS = nose[0] * F.ux + nose[1] * F.uz;      // frame-relative nose
          const nC = -nose[0] * F.uz + nose[1] * F.ux;
          const hdg = Math.atan2(nC, nS * ap.dirX) * ap.dirX;
          c.dr = clamp(-(A.decrabK ?? 2.2) * hdg - 0.6 * eR, -0.35, 0.35);
        } else airLateral(0.10);
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
    aDe += clamp(c.de - aDe, -A.slew * dt, A.slew * dt); c.de = aDe;
    aDa += clamp(c.da - aDa, -A.slew * dt, A.slew * dt); c.da = aDa;
    aDr += clamp(c.dr - aDr, -A.slew * dt, A.slew * dt); c.dr = aDr;
    holdWas = holdActive; holdActive = false;   // W14: per-frame resync bookkeeping
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl };
  };
  return ap;
}

// model_codec.js — decode baked model payloads (see tools/model_prep.py).
// Pure JS, no three.js: same code runs in the artifact and in the node gates.
// Layout per group (little-endian): u32 nVerts, u32 nTris,
//   int16 pos[3*nVerts] (quantized over bb), uint16 uv[2*nVerts], uint16 idx[3*nTris].

function decodeB64(b64) {
  if (typeof atob === 'function') {
    const s = atob(b64), a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function decodeModel(model) {
  const [x0, y0, z0, x1, y1, z1] = model.bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  const out = {};
  for (const name in model.groups) {
    const g = model.groups[name];
    const raw = decodeB64(g.b64);
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
    let o = 8;
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++, o += 6) {
      pos[i*3]   = x0 + (dv.getInt16(o,     true) + 32768) * sx;
      pos[i*3+1] = y0 + (dv.getInt16(o + 2, true) + 32768) * sy;
      pos[i*3+2] = z0 + (dv.getInt16(o + 4, true) + 32768) * sz;
    }
    for (let i = 0; i < nv * 2; i++, o += 2) uv[i] = dv.getUint16(o, true) / 65535;
    const idx = new Uint16Array(nt * 3);
    for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true);
    let sid = null;
    if (g.sid) { sid = new Uint8Array(nv); for (let i = 0; i < nv; i++, o++) sid[i] = dv.getUint8(o); }
    out[name] = { nv, nt, pos, uv, idx, sid };
  }
  return out;
}


// ---------------------------------------------------------------------------
// Skin deformation (see SKIN-PROC.md). Spanwise station binding:
// model wing-band vertices follow the sim's spar stations (tags WF/WR),
// interpolated along |z|. Everything else stays rigid in the body frame.
// Model frame orientation == body frame with z LEFT (zL = xAft x yUp).
// ---------------------------------------------------------------------------

function defCG(def) {
  let x = 0, y = 0, z = 0, M = 0;
  for (const n of def.nodes) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; M += n.m; }
  return [x/M, y/M, z/M];
}

// cfg: { tags:['WF','WR'], zRoot, xMax, off:[ox,oy,oz] }  (model-frame thresholds)
function makeSkinBinding(pos, nv, def, cfg) {
  const cg0 = defCG(def);
  const sides = { P: {}, N: {} };            // keyed by |z| station
  def.nodes.forEach((n, i) => {
    if (!cfg.tags.includes(n.tag)) return;
    const s = n.p[2] > 0 ? 'P' : 'N', key = Math.abs(n.p[2]).toFixed(2);
    (sides[s][key] = sides[s][key] || []).push(i);
  });
  const zs = Object.keys(sides.P).map(Number).sort((a, b) => a - b);
  const mkSide = (S) => {
    const st = zs.map(z => sides[S][z.toFixed(2)]);
    const rest = new Float32Array(zs.length * 3);
    st.forEach((ids, k) => {
      for (const i of ids) {
        rest[k*3]   += (def.nodes[i].p[0] - cg0[0]) / ids.length;
        rest[k*3+1] += (def.nodes[i].p[1] - cg0[1]) / ids.length;
        rest[k*3+2] += (def.nodes[i].p[2] - cg0[2]) / ids.length;
      }
    });
    return { st, rest };
  };
  // vertices: model z>0 maps to world +z at rest, i.e. sim nodes with p[2]>0
  const bound = [], seg = [], w = [], side = [];
  for (let i = 0; i < nv; i++) {
    const x = pos[i*3], z = pos[i*3+2], az = Math.abs(z);
    if (az < cfg.zRoot || x > cfg.xMax) continue;
    let k = 0;
    while (k < zs.length - 1 && az > zs[k]) k++;
    const zA = k === 0 ? cfg.zRoot : zs[k-1];
    bound.push(i); seg.push(k); side.push(z > 0 ? 1 : 0);
    w.push((az - zA) / (zs[k] - zA));        // may exceed 1 past the tip: extrapolates
  }
  return { zs, P: mkSide('P'), N: mkSide('N'),
           bound: Int32Array.from(bound), seg: Int8Array.from(seg),
           w: Float32Array.from(w), side: Int8Array.from(side) };
}

// Body-frame (z-left) station deltas vs rest. axes = [xAft, yUp]; zL derived.
function sparDeltas(bind, sim, out) {
  const cg = sim.cgPos(), [xA, yU] = sim.axes();
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  for (const S of ['P', 'N']) {
    const { st, rest } = bind[S], d = out[S];
    st.forEach((ids, k) => {
      let bx = 0, by = 0, bz = 0;
      for (const i of ids) {
        const dx = sim.p[i*3]-cg[0], dy = sim.p[i*3+1]-cg[1], dz = sim.p[i*3+2]-cg[2];
        bx += (dx*xA[0]+dy*xA[1]+dz*xA[2]) / ids.length;
        by += (dx*yU[0]+dy*yU[1]+dz*yU[2]) / ids.length;
        bz += (dx*zL[0]+dy*zL[1]+dz*zL[2]) / ids.length;
      }
      d[k*3] = bx - rest[k*3]; d[k*3+1] = by - rest[k*3+1]; d[k*3+2] = bz - rest[k*3+2];
    });
  }
  return out;
}

// pos <- base + gain * lerp(station deltas) for bound vertices only.
// seg k, weight w: between station k-1 (root: zero delta) and station k;
// w > 1 past the last station extrapolates linearly (model tip 5.36 vs spar 5.0).
// hinged: optional Uint8Array — for those verts the hinge pass already wrote
// pos, so flex is ADDED in place instead of overwriting from base.
function applySkinDeform(bind, base, pos, dP, dN, gain, hinged) {
  const { bound, seg, w, side } = bind;
  for (let j = 0; j < bound.length; j++) {
    const i = bound[j], k = seg[j], d = side[j] ? dP : dN, wj = w[j];
    const w0 = k === 0 ? 0 : gain * (1 - wj), w1 = gain * wj;
    const o0 = (k - 1) * 3, o1 = k * 3;
    const fx = (k === 0 ? 0 : w0 * d[o0])   + w1 * d[o1];
    const fy = (k === 0 ? 0 : w0 * d[o0+1]) + w1 * d[o1+1];
    const fz = (k === 0 ? 0 : w0 * d[o0+2]) + w1 * d[o1+2];
    if (hinged && hinged[i]) { pos[i*3] += fx; pos[i*3+1] += fy; pos[i*3+2] += fz; }
    else { pos[i*3] = base[i*3] + fx; pos[i*3+1] = base[i*3+1] + fy; pos[i*3+2] = base[i*3+2] + fz; }
  }
}

// ---------------------------------------------------------------------------
// Control surface hinges. Per-vertex rigid rotation about baked hinge lines,
// with an optional smoothstep weight ramp along x (fin+rudder fused meshes).
// Runs BEFORE the flex pass; applySkinDeform adds flex on top of hinged verts.
// ---------------------------------------------------------------------------

function makeHingeBinding(skin, surfaces) {
  const per = surfaces.map(() => ({ idx: [], w: [] }));
  for (let i = 0; i < skin.nv; i++) {
    const k = skin.sid[i];
    if (!k) continue;
    const s = surfaces[k - 1];
    let w = 1;
    if (s.ramp) {
      const u = (skin.pos[i*3] - s.ramp[0]) / (s.ramp[1] - s.ramp[0]);
      const c = Math.max(0, Math.min(1, u));
      w = c * c * (3 - 2 * c);
    }
    if (w <= 0) continue;
    per[k - 1].idx.push(i); per[k - 1].w.push(w);
  }
  const hinged = new Uint8Array(skin.nv);
  return { per: per.map(g => ({ idx: Int32Array.from(g.idx), w: Float32Array.from(g.w) })),
           hinged: (() => { for (const g of per) for (const i of g.idx) hinged[i] = 1;
                            return hinged; })() };
}

// Rodrigues rotation of (base - p) about unit axis by (angle * w), + p.
function applyHinges(hb, surfaces, base, pos, ctl) {
  surfaces.forEach((s, si) => {
    // A surface may answer to TWO inputs. A V-tail ruddervator is the reason:
    // it is the elevator and the rudder at once, symmetric in one and
    // antisymmetric in the other, and a vertex can only carry one surface id.
    const ang = s.sgn * (s.k || 1) * (ctl[s.drive] || 0)
      + (s.drive2 ? (s.sgn2 || 1) * (s.k2 || 1) * (ctl[s.drive2] || 0) : 0);
    const g = hb.per[si], [px, py, pz] = s.p, [ax, ay, az] = s.ax;
    for (let j = 0; j < g.idx.length; j++) {
      const i = g.idx[j], a = ang * g.w[j];
      const c = Math.cos(a), s_ = Math.sin(a), C = 1 - c;
      const vx = base[i*3] - px, vy = base[i*3+1] - py, vz = base[i*3+2] - pz;
      const d = ax*vx + ay*vy + az*vz;
      pos[i*3]   = px + vx*c + (ay*vz - az*vy)*s_ + ax*d*C;
      pos[i*3+1] = py + vy*c + (az*vx - ax*vz)*s_ + ay*d*C;
      pos[i*3+2] = pz + vz*c + (ax*vy - ay*vx)*s_ + az*d*C;
    }
  });
}

// ---------------------------------------------------------------------------
// Control linkage model (visual only). Two-pole low-pass between sim.ctl and
// the drawn surfaces: real cable runs and actuators filter exactly like this.
// Motivation: the AP roll/yaw loops limit-cycle at ~3.7 Hz (PD derivative on
// finite-differenced soft-body attitude); tau=0.12 s per pole attenuates that
// ~9x while tracking slewed maneuver commands with invisible lag.
// The HUD keeps showing raw sim.ctl; physics is untouched.
// ---------------------------------------------------------------------------
function makeLinkage(tau) {
  const s1 = { de: 0, da: 0, dr: 0, flap: 0 }, s2 = { de: 0, da: 0, dr: 0, flap: 0 };
  return {
    step(ctl, dt) {
      const a = Math.min(1, dt / tau);
      for (const k of ['de', 'da', 'dr', 'flap']) {
        s1[k] += a * ((ctl[k] || 0) - s1[k]);
        s2[k] += a * (s1[k] - s2[k]);
      }
      return s2;
    },
  };
}

if (typeof module !== 'undefined')
  module.exports = { decodeModel, decodeB64, defCG, makeSkinBinding, sparDeltas,
                     applySkinDeform, makeHingeBinding, applyHinges, makeLinkage };
// ============================================================
// GARAGE 1/5 — the SPEC. Source of truth for a generated airframe.
//
// Everything downstream (structure, aero, skin) is a pure function of a
// resolved spec, so the spec is the single root: there is no second place
// where a number about this aeroplane lives.
//
// PROCEDURAL BY DEFAULT: any field may be `null`, which means "derive it".
// resolveSpec() fills every null from the fields before it and records which
// ones it touched in `.auto`, so the editor can show auto-vs-manual and a
// player who changes nothing still gets a coherent aeroplane.
//
// Frame is the sim's: x AFT (nose at -x), y up, z lateral, datum x=0 at the
// firewall. Units SI throughout.
// ============================================================

// Build materials. `lin` = kg per metre of member, `cover` = kg/m^2 of covered
// surface (fabric + dope + stringers, or ply + finish). k/c are the beam
// spring/damping constants by member class — the tubeFabric row IS the Cub's
// (2.0e5/60 chassis, 5.0e5/450 wing, 2.8e4/900 gear), which is the only row
// this chantier validates. cd0 is the wing profile-drag finish penalty.
// PHYSICAL constants (`phys`) are REPORTING ONLY. Nothing in the solver, the
// generator or the viewer reads them — GATE FLEX does, and only GATE FLEX. They
// exist so the model's own spring rates can be compared against the structure
// they claim to represent, because `k` here is an absolute N/m per member and
// physics says EA/L. The area is not a new number: `lin` is kg/m, so A = lin/rho
// is already implied by the mass model, and it comes out right — tubeFabric's
// fuselage A is 0.58/7850 = 7.4e-5 m2, which IS 1" x 0.035" 4130 tube.
//   E     Pa    Young's modulus
//   rho   kg/m3 density (closes lin -> area)
//   sigY  Pa    the governing allowable in compression, which is what a truss
//               member usually fails in: 4130 yield, 2024-T3 yield, spruce
//               crushing parallel to grain, carbon UD tensile (it has no yield).
// Handbook class values (MIL-HDBK-5 / Wood Handbook), not measurements taken
// here. See GATE FLEX and the STRUCTURAL REALISM section of HANDOVER.md.
const GEN_MATERIALS = {
  tubeFabric: {
    name: '4130 tube + fabric',
    phys: { E: 205e9, rho: 7850, sigY: 460e6 },
    lin:   { fus: 0.58, wing: 0.62, gear: 1.05 },
    cover: 0.42,
    k:     { fus: 2.0e5, wing: 5.0e5, gear: 2.8e4 },
    c:     { fus: 60,    wing: 450,   gear: 900 },
    // The k/c above are the Cub's, and the Cub is a ~390 kg aeroplane. They are
    // NOT constants of the material — you build heavier tube for a heavier
    // machine — so they scale with all-up mass off this reference. Without it a
    // big engine simply folds the gear (measured: a 750 kg radial put the
    // aeroplane on its firewall with the gear hanging unloaded).
    refMass: 390,
    // `price` is credits per kg of finished structure — the stock, the covering
    // and the labour rolled into one number. Steel tube and fabric is the cheap
    // way to build an aeroplane; that is most of why the Cub exists.
    price: 42,
    cd0: 0.0022, clmaxK: 1.00,
  },
  wood: {
    name: 'spruce + ply',
    // sigY is spruce CRUSHING parallel to grain (~39 MPa), not its tension
    // figure (~70): a wooden airframe fails in compression and at its glue
    // joints long before the timber pulls apart.
    phys: { E: 10.9e9, rho: 450, sigY: 39e6 },
    lin:   { fus: 0.50, wing: 0.58, gear: 1.20 },
    cover: 0.62,
    k:     { fus: 4.0e5, wing: 2.5e6, gear: 1.3e5 },
    c:     { fus: 300,   wing: 950,   gear: 2400 },
    refMass: 630,                       // the Jodel's row, and the Jodel's mass
    // Dearer than steel tube despite cheaper stock: `price` is the FINISHED
    // cost with the labour in it, and a wooden airframe is thousands of hours
    // of gluing and clamping where a tube fuselage is a fortnight of welding.
    // At 30 it was strictly cheaper AND lighter AND stiffer AND slipperier
    // than tube+fabric, which is not a choice.
    price: 55,
    cd0: 0.0009, clmaxK: 1.02,
  },
  // Aluminium semi-monocoque. The k/c are MEASURED off the C172 fiche rather
  // than chosen — 8.0e5/500 through the fuselage, 2.2e6/900 through the wing,
  // 1.6e5/2600 in the gear — so the one material the fleet actually flies in
  // metal sets the numbers. refMass is that aeroplane's mass, which is what
  // makes a SMALL alloy aeroplane come out in thinner sheet.
  alloy: {
    name: '2024 alloy sheet',
    phys: { E: 73.1e9, rho: 2780, sigY: 345e6 },
    lin:   { fus: 0.50, wing: 0.55, gear: 1.10 },
    cover: 1.05,                        // the skin is structure here, and heavy
    k:     { fus: 8.0e5, wing: 2.2e6, gear: 1.6e5 },
    c:     { fus: 500,   wing: 900,   gear: 2600 },
    refMass: 998,
    price: 78,                          // jigs, rivets, and a skilled hand
    cd0: 0.0012, clmaxK: 1.02,          // flush rivets, but laps and oil-canning
  },
  // Carbon over foam. The lightest airframe here and the dearest by a long way.
  // Its DAMPING is deliberately the lowest of the four: a composite structure
  // rings where a bolted metal or glued wooden one does not, and that is not a
  // detail — c is what binds the timestep, so getting it wrong the flattering
  // way would have cost 64 substeps instead of 50 for no physical reason.
  carbon: {
    name: 'carbon + epoxy',
    // no yield at all — sigY is the UD tensile strength and the material goes
    // straight from elastic to in pieces. That is the second axis this row
    // gains once a failure model exists; today it is reporting only.
    phys: { E: 135e9, rho: 1550, sigY: 1500e6 },
    lin:   { fus: 0.38, wing: 0.44, gear: 0.85 },
    cover: 0.55,
    k:     { fus: 1.1e6, wing: 2.0e6, gear: 1.5e5 },
    c:     { fus: 250,   wing: 500,   gear: 1800 },
    refMass: 420,                       // tuned at the size this generator builds
    price: 165,                         // moulds, cloth, vacuum, and the hours
    cd0: 0.0004, clmaxK: 1.05,          // moulded: the best surface on the list
  },
};

// Fuselage shape families. The aft body tapers from the cabin box to the
// tailpost, and the FAMILY is the profile of that taper — an exponent on the
// station fraction, applied to width, floor and deck alike. Straight is a
// welded truss narrowing evenly (Cub, Jodel). Waisted holds the section aft of
// the cabin and necks down late, which is what a roomy machine looks like.
// Pod-and-boom drops to a slender tail quickly and runs it out.
//
// Deliberately NOT a preset over crownTop/crownSide: roundness is already a
// continuous knob and a family that reset it would fight the sliders. This
// changes geometry the sliders cannot reach.
const GEN_SHAPES = {
  straight: { name: 'Straight taper', taper: 1.00 },
  waisted:  { name: 'Waisted',        taper: 1.80 },
  boom:     { name: 'Pod and boom',   taper: 0.45 },
};

// High-lift devices. `dCl` is the SECTIONAL lift increment of a fully deployed
// flap at the reference chord fraction below — the strips decide how much span
// carries one, so this number is per section, not per aeroplane. The slotted
// row IS the PA-18's, tunnel-calibrated against its POH Vs ratio.
//
// The pitching moment is NOT a fourth free number. Both flapped fiches give the
// same ratio to their lift increment — PA-18 -0.40/1.60 = -0.250, C172
// -0.29/1.15 = -0.252 — so dCm0 is derived as GEN_FLAP_CM * dCl0 and cannot
// drift away from the lift it belongs to.
const GEN_FLAP_CREF = 0.20;   // chord fraction the dCl values are quoted at
const GEN_FLAP_CM = -0.25;
const GEN_FLAPS = {
  none:    { name: 'None',         dCl: 0,    cd: 0,     rate: 0.20 },
  plain:   { name: 'Plain flap',   dCl: 0.95, cd: 0.055, rate: 0.25 },
  slotted: { name: 'Slotted flap', dCl: 1.60, cd: 0.070, rate: 0.20 },
  fowler:  { name: 'Fowler flap',  dCl: 2.05, cd: 0.095, rate: 0.14 },
};

// Fuel tank station. Where the fuel sits moves the CG and the roll inertia, and
// those are the two things a builder gets wrong. Mass only — burn is not
// modelled, so this is the FULL-tanks case.
const GEN_TANKS = {
  nose: { name: 'Nose tank' },        // ahead of the panel: the Cub's, and the default
  wing: { name: 'Wing root' },
  panel: { name: 'Outboard wing' },   // out in the panel: relieves the spar, slows the roll
};

// Instrument fit. Mass is the TOTAL for the aeroplane.
const GEN_SYSTEMS = {
  minimal: { name: 'Minimal (day VFR)', mass: 6,  price: 700 },
  basic:   { name: 'Basic VFR',         mass: 12, price: 2400 },
  ifr:     { name: 'IFR panel + radios', mass: 26, price: 9500 },
};

// Undercarriage springing. The multipliers are relative to the Cub's bungee
// cord, read off the fleet's own gear constants normalised by mass:
// cub 74 k/kg (bungee) · c172 160 · chinook 152 · jodel 206 (spring steel).
// Damping is given PER ARCHETYPE rather than derived from k — an oleo really
// does damp far harder than a rubber cord — and genSubsteps() then picks a
// timestep that can integrate whatever this produces.
const GEN_SUSPENSION = {
  bungee: { name: 'Bungee cord',  k: 1.00, c: 1.00, price: 250 },
  spring: { name: 'Spring steel', k: 2.20, c: 1.20, price: 900 },
  oleo:   { name: 'Oleo strut',   k: 3.50, c: 2.60, price: 2600 },
};

// THE PROPELLER, which is not part of the engine. The registry welds one to each
// powerplant (`POWERPLANTS[k].prop`) because the fleet's fiches are real
// aeroplanes with the props they were built with; a GARAGE aeroplane chooses.
//
// Per BLADE at D = 1.88 m, scaling as (D/1.88)^2.5 — props are not
// geometrically similar, so this is a fitted exponent, not a derivation.
// Anchors: a 1.88 m two-blade wooden prop is about 4.8 kg, and a 1.73 m
// three-blade carbon one about 3.9 kg (E-Props Durandal, ~4 kg real).
const GEN_PROP_MATS = {
  wood:   { name: 'Wood',      kg: 2.40, price: 900 },
  alu:    { name: 'Aluminium', kg: 4.20, price: 2200 },
  carbon: { name: 'Carbon',    kg: 1.60, price: 5200 },
};

// PITCH is a real trade and ONE number carries it: the figure of merit in
// momentum theory (ideal = 1). A fine prop bites hard standing still and runs
// out of pitch early; a coarse one gives away static thrust and keeps pulling.
// `fm` runs low to high the other way round from what the names suggest for
// exactly that reason.
//
// MEASURED, which is how the second half of this stopped being a fudge. The six
// registry props imply fm from 0.36 (the Sensenich cruise prop on the A-65) to
// 0.67 (the Rotax's slow-fly wooden one) — real spread, real props.
// The zero-thrust speed is the part momentum theory does NOT give you, and the
// registry's own kV2 values are per-AEROPLANE fits carrying its drag as well as
// its prop, so they cannot all be reproduced. What CAN be: `P / Tstatic` is the
// only velocity scale available without a shaft rpm, and ONE constant on it
// (GEN_RULES.propV0K) reproduces the A-65 entry to under a per cent — AND the
// pitch trade then falls out for free, because a fine prop's higher Tstatic
// lowers P/Tstatic and therefore its own zero-thrust speed. A first cut tabled
// `v0k` per pitch as well and got the trade BACKWARDS: it put a fine prop's
// thrust running out at 86 km/h on an aeroplane that cruises at 103.
//
// `pd` IS THE GEOMETRY AND `fm` IS THE PHYSICS, and they are two fields on
// purpose. The blade twist is built from a real pitch law — atan(P / 2 pi r) —
// which needs pitch as a fraction of the DIAMETER, the number written on the
// side of a real prop (a 74x45 is a P/D of 0.61). `fm` cannot stand in for it:
// it is a momentum-theory efficiency, it runs the other way round, and its
// spread is nothing like a pitch ratio's. Using one for the other would give a
// fine prop a coarser twist than a cruise prop, which is backwards and visible.
const GEN_PROP_PITCH = {
  climb:    { name: 'Fine (climb)',    fm: 0.58, pd: 0.55 },
  standard: { name: 'Standard',        fm: 0.46, pd: 0.70 },
  cruise:   { name: 'Coarse (cruise)', fm: 0.36, pd: 0.85 },
};

// COWL INTAKES. Texture only, deliberately: a grill drawn on the cover reads at
// every distance the aeroplane is ever seen from, and a modelled duct would cost
// a hole in the one panel whose whole job since G1.7 has been to have no holes
// in it ("a big opening… either the prop attachment or an air intake").
// `u` and `w` are the centre and half-width in the cowl's own angle coordinate
// (0 = top, 0.25 = +z side, 0.5 = belly); `n` is how many louvres.
const GEN_INTAKES = {
  none:  { name: 'None',            slots: [] },
  chin:  { name: 'Chin scoop',      slots: [{ u: 0.50, w: 0.085, n: 5 }] },
  twin:  { name: 'Twin cheek',      slots: [{ u: 0.34, w: 0.055, n: 4 },
                                            { u: 0.66, w: 0.055, n: 4 }] },
  ring:  { name: 'Ring (radial)',   slots: [{ u: 0.25, w: 0.075, n: 6 },
                                            { u: 0.75, w: 0.075, n: 6 },
                                            { u: 0.50, w: 0.075, n: 6 }] },
};

// Bought, not built: things with a price that does not follow from their mass.
// Credits. Nothing is unaffordable yet — the ledger records, it does not gate.
const GEN_PRICES = {
  wheel: 320,          // each: wheel, tyre, brake
  thirdWheel: 260,     // tailwheel or nosewheel assembly
  instruments: 2400,   // basic VFR panel
  paintJob: 1800,
  seat: 380,
};

// Cabin box per seating layout: half-width, height above the lower longeron,
// fore-aft length, and the crew mass it carries.
// `deck` is the firewall top as a fraction of cabin height: the STEP between
// the two is the windscreen (see 63_gen_skin.js). A drone has no windscreen at
// all, so its deck is 1.0 and the nose runs continuously into the body — which
// is the whole visual difference between an aeroplane and an airframe.
const GEN_SEATING = {
  single:  { halfW: 0.32, h: 0.92, len: 0.62, crew: 1, deck: 0.70 },
  tandem2: { halfW: 0.36, h: 1.00, len: 0.78, crew: 2, deck: 0.70 },
  side2:   { halfW: 0.53, h: 1.05, len: 0.90, crew: 2, deck: 0.70 },
  drone:   { halfW: 0.20, h: 0.30, len: 0.55, crew: 0, deck: 1.00 },
};

// Tip treatment. `e` multiplies the Oswald efficiency: a square-cut tip sheds a
// stronger vortex than a rounded one, and a winglet is worth a few per cent of
// span for its height. Everything else about it is shape.
// `round` is how far the last station shrinks about the tip chord's mid point.
// `arc` is how many extra stations walk that shrink round a QUARTER CIRCLE of
// radius (reach x tip chord) — one station gives the old blunt corner, four
// give the half-round Spitfire/DC-3 tip. `fin` lifts the last station into a
// winglet.
// `bow` is the rounding radius as a fraction of the chord where the rounding
// STARTS, and the bow lives INSIDE the semispan: the planform runs straight to
// (semi - bow), then the chord closes to nothing on a half-ellipse whose tip is
// at exactly `semi`. So the wing you see is the wing you set — bow 0.5 is a
// true half-round of the tip chord. `arc` is how many skin rows draw it.
//
// This lives in the PLANFORM, not in the skin: chordAt() carries it, so the rib
// masses, the covered area, the strip areas and the outline are all one shape.
// A tip that only existed in the mesh would be a wing that lifts where there is
// no wing.
const GEN_TIPS = {
  square:  { name: 'Square cut', e: 0.97, bow: 0,    arc: 0, fin: 0 },
  clipped: { name: 'Clipped',    e: 0.99, bow: 0.15, arc: 2, fin: 0 },
  rounded: { name: 'Rounded',    e: 1.00, bow: 0.50, arc: 7, fin: 0 },
  elliptic:{ name: 'Elliptical', e: 1.03, bow: 0.80, arc: 9, fin: 0 },
  hoerner: { name: 'Hoerner',    e: 1.02, bow: 0.30, arc: 5, fin: 0 },
  winglet: { name: 'Winglet',    e: 1.07, bow: 0.20, arc: 4, fin: 0.42 },
};

// Design constants that are rules rather than choices. Each one reproduces a
// measured value on the Cub (noted), which is why they are constants and not
// parameters — see the derivations in resolveSpec.
const GEN_RULES = {
  tailArmC:    2.60,   // wing c/4 -> stab c/4, in root chords (Cub 4.14/1.6)
  hAR:         3.70,   // stab aspect ratio
  vAR:         1.90,   // fin aspect ratio
  Vh:          0.370,  // horizontal tail volume (Cub effective strip areas)
  Vv:          0.0267, // vertical tail volume
  // The carry-through spar sits ON the top longerons, not inside them. Without
  // this the wing root node lands exactly on a frame node, the tie between
  // them is a zero-length beam, and strain reads Infinity. Special-casing
  // degenerate beams would hide that; giving the spar the depth it physically
  // has removes the coincidence altogether.
  wingStandoff: 0.10,
  sparFront:   0.15,   // front spar, fraction of chord
  // Rule 1 again, as a NUMBER. "The Cub survives only because its strut root is
  // a full metre below the wing" — the anchor offset IS the barrier against
  // snap-through and against the wing twisting under aileron load. A MID wing
  // cannot give a strut more than about half a cabin height, and measured, that
  // is not enough: the mid-wing strut aeroplane saturated its ailerons and
  // spiralled into the ground while standing, settling and straining perfectly
  // (0.7%). The identical wing with a cantilever box flew and landed. So below
  // this offset the generator builds the box instead of a strut that cannot
  // work, and says so in the shakedown.
  strutMinOffset: 0.60,
  sparBoxDepth: 0.13,  // cantilever box depth, fraction of chord (Jodel's)
  // WING STIFFNESS CORRECTION (2026-08-11, GATE FLEX). The wing class is x19
  // softer than the structure the MASS MODEL already pays for: lin.wing
  // 0.62 kg/m over rho 7850 is 0.79 cm2 of cap, and E*A/L at a 1.7 m bay is
  // 9.5e6 N/m against the 5.0e5 in the material row. This takes 4 of those 19
  // back. It is a CORRECTION, not a buff — no extra mass, because the aeroplane
  // was already carrying a cap it was not getting the stiffness of.
  //
  // The strut fan hid this everywhere except on a cantilever, which has no
  // lever arm to hide behind: measured, the cantilever preset flew at 14.90 %/g
  // with its tip 12.64% of semispan up in LEVEL FLIGHT — twice a glass
  // sailplane, one click in the panel.
  //
  // WHY 4, and why not more. Measured (static bend % under 2 kN distributed,
  // and the substeps genSubsteps then demands, strut/cantilever):
  //     x1  1.00 / 6.48   24/28      x4  0.30 / 1.61   45/55
  //     x2  0.52 / 3.25   32/39      x8  0.19 / 0.76   63/78
  //   full E*A/L per member: 0.12 / 0.18 but 200/200 — AT THE CAP, dead.
  // Substeps are gate time (GATE GEN flies eleven circuits), so this is a
  // straight trade of realism against the battery, and x4 is where it lands:
  // the STRUT wing — the default, and what most builds are — comes out at
  // ~0.54 %/g, inside the real 0.3-1 band, for 1.9x the solver cost. The
  // cantilever lands ~2.9 %/g, still ~3x real but a 5x improvement on 14.90.
  // x8 would put the cantilever near-real at 2.7x the solver cost; take it if
  // the battery budget ever allows.
  // ALSO MEASURED AND REJECTED: stiffening only the spanwise cap chords, on the
  // theory that the short ribs were driving omega. They are not — chord-only x8
  // buys bend 1.50 for 56/69 substeps where uniform x4 buys 1.61 for 45/55, and
  // it leaves torsion untouched (2.21 vs 0.59). Uniform is strictly better.
  wingK: 4.0,
  sparRear:    0.65,   // rear spar. A two-spar wing is 15/65 because that is
                       // where the spars go — NOT, as it was, wherever the
                       // cabin frames happen to be. That coupling is exactly
                       // what made the wing unmovable.
  // PROP TIP TO GROUND, in the LEVEL attitude — which is the right attitude to
  // measure a taildragger in, because the critical moment is the take-off roll
  // with the tail already up, not the three-point stand where the nose is high
  // and the disc is well clear.
  //
  // It was 0.40 m, which is a Cub's actual 0.42 rounded down: what a real
  // aeroplane HAS, not what it is allowed. FAR 23.925 asks for nine inches on a
  // taildragger and seven on a nosewheel, with the tyres flat and the strut
  // deflated, and 0.40 is nearly double that — so it was buying a long leg
  // nobody asked for and standing the aeroplane on stilts. These are the
  // certificated minima instead, and the builder gets the rest of the range.
  //
  // The reason it errs high at all is still true and still worth reading: a leg
  // the player shortened into a prop strike is not a bad aeroplane, it is a
  // broken one on the first landing. So it is a MINIMUM, it still beats legDrop,
  // and gear.yBoundBy still says which bound applied.
  propClear:      0.229,  // taildragger, FAR 23.925 (nine inches)
  propClearNose:  0.178,  // nosewheel, FAR 23.925 (seven inches)
  // Zero-thrust speed as a multiple of power/static-thrust. CALIBRATED on the
  // A-65 + Sensenich 74CK registry entry, which it then reproduces to under 1%
  // in both Tstatic and kV2. See GEN_PROP_PITCH for why this is one constant and
  // not a table.
  propV0K:     1.10,
  // Minimum drop from the fuselage underside to the axle. This is rule 5, not
  // tidiness: a near-horizontal gear leg has almost no vertical stiffness no
  // matter what k it is given, so a short undercarriage squats onto its belly
  // and no amount of suspension tuning saves it. It also subsumes belly
  // clearance, being the stronger of the two constraints in every case.
  // DEFAULT only since G4.6 — spec.gear.legDrop overrides it, which is the
  // "mains" half of the split suspension height.
  // 0.35 UNTIL G8, AND IT HAD NEVER ONCE BOUND. propClear was 0.40 m and always
  // won, so this number — the one that is actually SUPPOSED to own leg length —
  // was never the constraint and was never validated. Dropping propClear to the
  // certificated minimum exposed it, and 0.35 turned out to be nowhere near
  // enough: GATE GEN failed on four undercarriage checks at once and GATE FLEX
  // called the gear a mechanism.
  //
  // MEASURED, sweeping legDrop with propClear at 0.229: the softest suspension
  // the panel offers stops standing below 0.64 m and rests on its tailwheel,
  // and some powerplants stop standing below 0.58. 0.66 is 0.64 with enough
  // headroom not to sit on the cliff. The aeroplane still ends up 0.12 m lower
  // than it was, because the leg now sets ride height and prop clearance is
  // only the floor beneath it — which is the right way round, and lets a
  // builder who WANTS the blades closer lower this and be allowed to, until
  // the prop stops them.
  legDrop:     0.66,
  // Tailwheel leg length below the tailpost foot. The three-point deck angle
  // is DERIVED from this, not the other way round: a real tailwheel spring has
  // a length, and the attitude is what falls out of it. (Fixing the deck angle
  // instead pushes the tailwheel up into the tailpost as the tail arm grows,
  // and the tailpost then drags — measured, parked clearance halved.)
  // Also a DEFAULT since G4.6: spec.gear.twLeg overrides it, and does the same
  // job for a nosewheel, where it replaces the trikeDeck derivation below.
  twLeg:       0.23,   // m (Cub: TPB 0.25, TW axle 0.02)
  // TRICYCLE: the fraction of the weight the nosewheel carries on the ground.
  // The textbook figure for a rigid aeroplane is 8-15%; this is 0.25, because
  // the fleet's only tricycle — the C172 fiche — sits at 26%, and because a
  // soft-body airframe on a long nose leg needs the margin. Measured: at 0.12
  // and 0.18 the aeroplane rocked back until the TAILPOST touched and sat there
  // on mains-plus-tail with the nosewheel in the air; from 0.24 it stands on
  // all three. The rest attitude is a touch nose-up — a trike that sits
  // nose-down wheelbarrows on the landing roll.
  noseLoad:    0.25,
  trikeDeck:   1.2,    // deg nose-up at rest
  deckMin:     8.0, deckMax: 15.0,   // deg, reported and gated
  gearRake:    16.0,   // deg, CG to main axle from vertical (nose-over guard)
  trackRatio:  1.23,   // main track / CG height above ground
  washSpread:  1.12,   // propwash effective radius / prop radius (Cub-fitted)
  stabWash:    0.60,   // fraction of propwash seen by the stab / fin
  finWash:     1.00,
};

// SECTIONS (G3). The spec is organised the way the aeroplane is, and the way
// the editor presents it: one block per component, each with its discrete
// options, its values, and its own `place` offsets. Multiplicity is an ARRAY
// only where it is real — `wings` (monoplane or biplane) and `engines` — so the
// rest stays a named block and the diff stays legible.
//
// `genNormaliseSpec` accepts the old flat shape as well, and `resolveSpec`
// republishes the flat aliases the generator reads, so 61-64 are untouched by
// the reshape. Those aliases retire as each consumer moves to sections.
// 4: the cabin gained its glazing surface — `cabin.glazing`, `cabin.canopy`,
// `cabin.panel`, `cabin.pilot`, the seat offsets — plus `fuselage.tailY`,
// `paint.regX` and `wings[].centre`.
//
// Nothing READS this number: `genNormaliseSpec` defaults every missing field
// from GEN_DEFAULT, and a field left `null` stays null and keeps being derived,
// so an older spec loads correctly without being told what it is. The version is
// here to be honest about the shape having changed, and to give a future
// migration something to branch on — not because one is needed today. Do not
// add a migration that only re-does what normalisation already does.
const GEN_SPEC_V = 4;

// The one preset this chantier ships: a strut-braced high-wing taildragger in
// the Cub envelope. Nulls are the derived fields — that is most of the
// aeroplane, which is the point.
const GEN_DEFAULT = {
  v: GEN_SPEC_V,
  meta: { name: 'Garage Special', reg: 'F-PGAR' },
  cabin: {
    seating: 'tandem2',
    // LOADING, not capacity: `seating` sizes the cabin, `pilots` says how many
    // seats are filled for the flight the shakedown and the gates measure. A
    // J-3-class aeroplane is flown solo; loading both seats is a different
    // aeroplane and should read as one.
    pilots: 1,
    baggage: 10,             // kg
    halfW: null, h: null, len: null, noseGap: 0.62,
    // WHERE THE SEATS SIT, as an OFFSET from what the cabin derives. The base is
    // per-layout (SEAT_BASE in 63_gen_skin.js) because a side-by-side and a
    // tandem measure their "right" seat station from different places; a single
    // common base means one layout always carries a constant the other undoes.
    seatX: 0, seatY: 0.10, seatPitch: 0.86,
    // GLAZING. `glazing` is the ROUTE the cabin transparency is built by, and it
    // is a route rather than a style because each has different failure modes
    // (topology, sorting, distortion):
    //   none        no cabin transparency at all (drones)
    //   windshield  the fuselage's OWN windscreen step, in glass: zero stand-off,
    //               so the covered surface is reproduced exactly and the seam is
    //               invisible. The control case for the edge-loop machinery.
    //   bubble      a rounded shell standing off that same cut
    //   greenhouse  kept only so old specs still load — it is now `facet: true`
    //               on a `bubble`, and clampSpec rewrites it as one.
    glazing: 'bubble',
    // THE COAMING + INSTRUMENT PANEL, off the windscreen fit line (which never
    // moves — see 63_gen_skin.js). `depth` is how far aft the coaming shelf runs;
    // `wrap` is how far down the sill arc it wraps, and 0.5 is exactly the sill.
    panel: { on: true, depth: 0.27, inset: 0.06, wrap: 0.50 },
    // THE OCCUPANT. A crash-test dummy on the first `pilots` seats. `stature` is
    // standing height in metres and everything else is a pose angle in degrees.
    // The rig is anthropometric (Drillis & Contini fractions), so the one length
    // scales the figure and every chain hangs off the one before it.
    pilot: { show: true, stature: 1.75, lean: 17, thigh: -9, shank: 10,
             armDown: 40, fore: 6, head: -11, armIn: 26,
             ankle: 40, toeOut: 7, hipOut: 0, kneeOut: 3 },
    // THE CANOPY'S OWN CONTROLS. `sill` and the window are what the CUT is made
    // from, so they move the fixed edge loop; `height` and `skew` move only the
    // middle of the shell.
    canopy: {
      // `height` is the rise above the body's own deck line: 0 means the
      // fuselage face turns to glass and nothing protrudes.
      height: 0, sill: 0.30, skew: 0.42,
      // `bubble` is the SECTION's fullness (1 = half-round blown canopy, 0 =
      // flat-sided with a crown). `lid` is a virtual clipping plane as a
      // fraction of the rise — 1 leaves the dome whole, lower slices the top off
      // flat. A wing inside the envelope lowers it further, which is the only
      // thing a high wing does differently.
      bubble: 0.70, lid: 1.0,
      // MAX WIDTH: how far the section swells sideways past the sill line. 1 is
      // flush with the body, 1.4 is a blown bubble standing proud of it.
      // Independent of height on purpose — the rise used to be capped at the
      // half-width, which silently tied the two knobs together.
      width: 1.0,
      // WHERE THE WINDOW BEGINS AND ENDS. `reach` is a FRACTION of the cabin and
      // is what the panel drives; `x1` is the absolute station it resolves to.
      // An absolute station cannot survive a cabin-length change — the window
      // stays put while the cabin moves out from under it — so the knob is the
      // fraction and the station is derived. x1 remains settable for a build
      // that wants the window pinned whatever the cabin does; setting it wins.
      x0: null, x1: null, reach: null,
      // THE JOINT. Chamfers the corner where the front bow meets the sill rail,
      // instead of letting it come to a downward point. `jointRun` is its length
      // in ring indices. Frame detail only — the glass and its seam are untouched.
      joint: 'square', jointRun: 3,
      // FACETED STRUCTURE (the old 'greenhouse' style, now a flag on any
      // canopy): frame bars down every section edge instead of two rails.
      facet: false,
      // SUNSCREEN: the fraction of the arc, from the crown down, that goes
      // opaque and is painted with the fuselage. `sunStart` is where along the
      // window the roof begins, so that it stops short of the screen.
      sun: 0, sunStart: 0.38,
      // SIDE LIGHTS: a band of the same cut at the waistline. Meant for a
      // WINDSCREEN build — with a full canopy the two openings meet, which is a
      // mistake the player is allowed to make. `sideGap` is the door post
      // between screen and light.
      sides: false, sideTop: 0.34, sideDepth: 0.5, sideReach: 1.0, sideGap: 0.10,
      // the windscreen's RAKE in degrees; null keeps the fuselage's own windRun
      // angle. The body's step and the canopy's front bow use it alike, so they
      // move together by construction rather than by agreement.
      wsAngle: null,
      // how much the screen bows in plan
      wsCurve: 1,
    },
  },
  // CARGO BAY: metres of full-section fuselage aft of the cabin, and what is in
  // it. It is the fuselage that grows, so the tail arm and the frames the wing
  // and gear attach to all move with it.
  cargo: { len: 0, kg: 0 },
  fuel: { litres: 50, tank: 'nose' },
  systems: { fit: 'basic' },
  // Control surfaces. Span fractions are of the SEMISPAN — the aileron measured
  // inboard from the tip, the flap outboard from the centreline — and clampSpec
  // keeps a gap between them. Chord fractions are of the local chord and are
  // what set each surface's effectiveness (genTauAt).
  controls: {
    flap:     { type: 'none', span: 0.50, chord: 0.20 },
    aileron:  { span: 0.38, chord: 0.22 },
    elevator: { chord: 0.40 },
    rudder:   { chord: 0.42 },
  },      // usable litres (avgas 0.72 kg/l)
  fuselage: {
          material: 'tubeFabric', shape: 'straight',
          tailArm: null, postGap: 0.67, tailBays: 4,
          tailW: 0.10, tailBot: 0.20, tailTop: 0.38,
          // TAIL-END SECTION HEIGHT. Not a new dimension: clampSpec moves
          // tailBot and tailTop together by it, on the clone, so 61_gen_frame.js
          // still reads only those two and the offset cannot accumulate across
          // repeated clamps the way gear.track once did.
          tailY: 0,
          // The top line ahead of the cabin is the COWL DECK, and the windscreen
          // is the step up from it — a fuselage whose top runs smoothly from
          // spinner to tail is a carrot, not an aeroplane. cowlDeck is a
          // fraction of cabin height; windRun is the fore-aft run of the
          // windscreen (0.30 m rise over 0.26 m run ~ 49 deg).
          cowlDeck: null, windRun: 0.26,
          // skin-only former bulge, 0 = bare truss. A tube-and-fabric fuselage
          // has FLAT sides and belly and a rounded turtledeck, so these are
          // very different numbers on purpose.
          crownTop: 0.72, crownSide: 0.07 },
  // The engine bay is its own component with its own cover, not the front of
  // the fuselage. It is a loft from the firewall section to a NOSE SECTION OF
  // ITS OWN, finished flat with a rounded-over front edge, and the propeller
  // mounts on that flat face. `fillet` is the radius of the rounded edge;
  // `taper` scales the derived nose section.
  //
  // `halfW`, `top` and `bot` are the nose section, and they are measured ABOUT
  // THE THRUSTLINE, which is the datum a cowl actually has — it is a cover over
  // an engine, and the engine sits on the thrustline. Referencing the firewall's
  // centre instead is what made the cowl "collapse below its engine": on a body
  // whose deck line is not near its mid-height (a drone, cowlDeck 1.0) the two
  // datums are 4 cm apart on a 30 cm cowl and the engine hangs out of the
  // bottom. `top` and `bot` are separate so the top line and the bottom line can
  // be set independently — a flat-top/bulged-chin Cub cowl and a round-top
  // Cessna cowl with a chin scoop are the same three numbers.
  // Left null they are derived from the firewall section (tapered, about the
  // thrustline), which is the shape that was there before.
  // `intake` is texture only, for now — see genCowlDataURI in garage.js.
  cowl: { fillet: 0.10, taper: 0.94,
          halfW: null, top: null, bot: null, intake: 'chin' },
  // An ARRAY because a twin is a real aeroplane, not a variant. Its LENGTH is
  // what the solver multiplies thrust by (via `params.nEngines`); `refs.engine`
  // is a separate thing entirely — the mount NODES the force is spread over.
  engines: [{ type: 'a65_sensenich74', mount: 'nose', place: { dx: 0, dy: 0 } }],
  // THE PROPELLER IS ITS OWN COMPONENT. `D` null keeps the one the chosen
  // powerplant shipped with, so a build nobody has touched flies exactly as it
  // did. Everything about it is honest physics rather than decoration: the disc
  // area sets static thrust AND the propwash the tail flies in, the pitch trades
  // static thrust against high-speed thrust, and the blades weigh something at
  // the very front of the aeroplane, where mass costs the most CG.
  // pitch 'cruise' is not a neutral default, it is the TRUTH about this preset:
  // the A-65 it ships with swings a Sensenich 74CK, which is a cruise prop. That
  // is also why the default build's thrust is unchanged by all of this.
  // The four fields above the line are the PROPELLER AS PHYSICS — disc area,
  // blade count, the mass of the material at the very front, and the pitch
  // trade. The three below it are the propeller as a SHAPE, and they buy
  // nothing but the look: blade planform, where the blade leaves the spinner,
  // and the spinner itself. Kept in the same block because a builder does not
  // think of them as two things, and marked here because a change to the top
  // four moves the aeroplane and a change to the bottom three does not.
  prop: { D: null, blades: 2, material: 'wood', pitch: 'cruise',
          // chord and root as fractions of the RADIUS, so they survive a
          // diameter change instead of being metres that no longer fit
          chord: 0.10, root: 0.16,
          spinner: { shape: 'ogive', len: 2.2, dia: 0.17 } },
  // An ARRAY because a biplane is a real aeroplane. `position` is where the
  // spar meets the fuselage.
  wings: [{ span: 10.0, chord: 1.60, taper: 1.0, dihedral: 3.0,
            incidence: 1.5, washout: 1.5, naca: 2412, panels: 3,
            position: 'high', sweep: 0, tip: 'rounded',
            crankAt: 0, dihedralOut: null,
            // THE CENTRE SECTION: what happens where a high wing's carry-through
            // crosses the cabin roof. 'solid' covers it, 'glass' makes the wing
            // itself the roof and you look up into it (a Cub's centre section),
            // 'open' leaves the bay out altogether. Ignored on a low wing, which
            // has no bay over the cabin to treat.
            centre: 'solid',
            xLE: null, place: { dx: 0, dy: 0 } }],
  // Wing fixation, its own section because it is its own structure. Cantilever
  // gets a real four-chord spar box — rule 1 says a planar two-spar wing only
  // survives because the strut anchor is a long way below it, so taking the
  // strut away without adding the box builds an aeroplane that folds.
  bracing: { type: 'strut' },
  tail: { type: 'conventional', vAngle: 33,
          hSpan: null, hChord: null, hX: null, hTaper: 1.0,
          // `tip` is the tail's shared tip shape and stays the one the V-tail
          // uses, since a V-tail is ONE surface. `tipV` and `tipH` override it
          // per surface on a conventional tail — a Cub has a big round fin and a
          // near-elliptical tailplane, and they are not obliged to match. Null
          // means "whatever `tip` says", so an older save keeps its shape.
          tip: 'rounded', tipV: null, tipH: null,
          // FIN RAKE, degrees of leading-edge sweep. Null derives the angle the
          // fin already had (its LE carried a hardcoded 0.30 chord of sweep over
          // its height), so an untouched build is unchanged and the control
          // starts where the aeroplane already was.
          vSweep: null,
          // WHERE THE TAILPLANE SITS UP THE FIN. 0 is on the tail cone, as it
          // has always been; 1 puts it at the fin tip, which IS a T-tail — so
          // the old backlog's "T-tail" is this control at its limit rather than
          // a separate kind of aeroplane. It moves the stab in Y only: `hX` is
          // the tail ARM and stays the builder's to set, because moving it here
          // would re-tune the pitch authority behind their back.
          stabH: 0,
          // THE DORSAL FIN, ahead of the fin's leading edge. `angle` is the
          // slope of its own leading edge and is nullable: set it and `len` is
          // driven from `height`, leave it and it is derived from the two
          // lengths and reads AUTO. Four controls for a three-cornered shape is
          // one too many, and this is which one gives way.
          dorsal: { len: 0.34, height: 0.16, width: 0.55, angle: null },
          vHeight: null, vChord: null, vX: null,
          place: { dx: 0 } },
  // `stiffness` is the suspension: 1.0 is the mass-scaled default, below that
  // is soft (long travel, bottoms out), above is hard (jars, but holds).
  // type 'taildragger' puts the third wheel at the tail and the mains AHEAD of
  // the CG; 'tricycle' puts a steerable nosewheel forward and the mains BEHIND
  // it. They are different aeroplanes on the ground, not a cosmetic swap: the
  // placement rule inverts, the rest attitude goes from nose-high to level, the
  // steering sign flips, and the autopilot needs its trike rollout.
  // Every section carries its own `place` OFFSETS — from whatever the rules
  // derived, never absolute positions — so a nudge rides along when something
  // upstream moves instead of pinning the component and quietly breaking the
  // aeroplane around it. Move the cabin and a wing you pulled back 0.2 m is
  // still 0.2 m back.
  //
  // They are deliberately NOT constrained to sensible values. Building a
  // machine that will not fly is a mistake the player is allowed to make; the
  // shakedown says so (static margin, nose-over, stands-on) rather than the
  // generator refusing. The clamps below only keep the geometry from becoming
  // degenerate enough to break generation itself.
  // `legDrop` and `twLeg` are the SPLIT SUSPENSION HEIGHT: how far the main
  // axle hangs below the fuselage underside, and how long the third wheel's leg
  // is, set independently. The rest attitude is then whatever those two
  // produce — the same doctrine the tailwheel has always followed (a real
  // spring has a length; the deck angle falls out of it), now applied to the
  // nosewheel as well, which used to work backwards from a fixed 1.2 deg.
  // `camber` leans the MAIN wheels: positive tips their tops outboard. It is
  // not cosmetic — a leaning wheel touches down R*cos(camber) below its axle,
  // so it is one of the two things that set prop clearance, the other being
  // legDrop. See GEN_RULES.legDrop / twLeg for the defaults these override.
  gear: { type: 'taildragger', fairing: 'none', suspension: 'bungee',
          track: null, x: null, y: null, wheelR: 0.20,
          twX: null, twY: null, twR: 0.10, stiffness: 1.0,
          legDrop: null, twLeg: null, camber: 0,
          place: { dx: 0, dtrack: 0 } },
  // `regX` places the registration along the body: 0 just aft of the cabin, 1 at
  // the fin. It was pinned at 45-78% of the run, which on a long fuselage put it
  // in the taper where the section halves in width.
  paint: { base: 0xf2c437, trim: 0x1b3a5c, sweep: 0.55, gloss: 0.42, regX: 0.30 },
};

const GEN_PRESETS = { garage: GEN_DEFAULT };

// ---------------------------------------------------------------------------
// NORMALISE. Accepts the old flat shape or the sectioned one and returns the
// sectioned one, with every missing field defaulted from GEN_DEFAULT. This is
// also the migration path: a spec written before a field existed simply gets
// the default, and a field that is `null` stays null so it keeps being derived.
// ---------------------------------------------------------------------------
function genDefaults(target, defaults) {
  for (const k in defaults) {
    const d = defaults[k];
    if (Array.isArray(d)) {
      if (!Array.isArray(target[k]) || !target[k].length) target[k] = genClone(d);
      else target[k] = target[k].map(e =>
        genDefaults(e && typeof e === 'object' ? e : {}, d[0]));
    } else if (d && typeof d === 'object') {
      target[k] = genDefaults(target[k] && typeof target[k] === 'object' ? target[k] : {}, d);
    } else if (target[k] === undefined) {
      target[k] = d;                        // note: an explicit null is KEPT
    }
  }
  return target;
}

function genNormaliseSpec(raw) {
  const r = genClone(raw && typeof raw === 'object' ? raw : {});
  if (Array.isArray(r.wings)) return genDefaults(r, GEN_DEFAULT);
  // --- pre-G3 flat shape ---
  const p = r.place || {}, w = r.wing || {}, f = r.fuse || {};
  const out = {
    v: GEN_SPEC_V,
    meta: { name: r.name, reg: r.reg },
    cabin: Object.assign({}, r.cab, { seating: r.seating, pilots: r.pilots,
                                      baggage: r.baggage }),
    cargo: { len: f.cargoLen, kg: r.cargoKg },
    fuel: { litres: r.fuelL },
    fuselage: Object.assign({}, f, { material: r.material }),
    cowl: r.cowl,
    engines: [{ type: r.engine, mount: 'nose',
                place: { dx: p.engineDx, dy: p.engineDy } }],
    wings: [Object.assign({}, w, { place: { dx: p.wingDx, dy: p.wingDy } })],
    bracing: { type: w.strut === false ? 'cantilever' : 'strut' },
    tail: Object.assign({}, r.tail, { place: { dx: p.tailDx } }),
    gear: Object.assign({}, r.gear, { place: { dx: p.gearDx, dtrack: p.gearDtrack } }),
    paint: r.paint,
  };
  delete out.fuselage.cargoLen; delete out.wings[0].strut;
  return genDefaults(out, GEN_DEFAULT);
}

// The flat aliases the generator (61-64) still reads. They are REFERENCES to
// the section objects wherever the value is an object, so a derivation that
// writes through an alias updates the section too.
function genAlias(S) {
  S.wing = S.wings[0];
  S.cab = S.cabin;
  S.fuse = S.fuselage;
  S.name = S.meta.name; S.reg = S.meta.reg;
  S.material = S.fuselage.material;
  S.engine = S.engines[0].type;
  S.seating = S.cabin.seating; S.pilots = S.cabin.pilots;
  S.baggage = S.cabin.baggage;
  S.fuelL = S.fuel.litres;
  S.cargoKg = S.cargo.kg;
  S.fuse.cargoLen = S.cargo.len;
  S.wing.strut = S.bracing.type === 'strut';
  S.place = {
    wingDx: S.wings[0].place.dx, wingDy: S.wings[0].place.dy,
    engineDx: S.engines[0].place.dx, engineDy: S.engines[0].place.dy,
    tailDx: S.tail.place.dx,
    gearDx: S.gear.place.dx, gearDtrack: S.gear.place.dtrack,
  };
  return S;
}

// ---- helpers ------------------------------------------------------------
function genClone(o) {
  if (Array.isArray(o)) return o.map(genClone);
  if (o && typeof o === 'object') {
    const r = {};
    for (const k in o) r[k] = genClone(o[k]);
    return r;
  }
  return o;
}
const genClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// null means "derive it" and must survive clamping — genClamp would coerce it
// to 0 and hand back the lower bound, silently turning every AUTO field into a
// pinned one. Nullable fields go through this.
const genClampN = (v, lo, hi) => (v == null ? null : genClamp(v, lo, hi));

// Thin-airfoil flap effectiveness: the fraction of a full-chord alpha change
// that a hinged rear portion of chord fraction `c` actually delivers.
//   tau = 1 - (theta - sin theta) / pi,   cos theta = 2c - 1
// Raw theory OVERSTATES what a real surface does — gaps, limited throw, adverse
// yaw, a fuselage in the way — so it is never used bare. genTauAt scales it so
// the fleet's own calibrated value is reproduced at that surface's reference
// chord, and theory only supplies the TREND away from it.
const genFlapTau = c => {
  const th = Math.acos(2 * genClamp(c, 0.05, 0.60) - 1);
  return 1 - (th - Math.sin(th)) / Math.PI;
};
const genTauAt = (c, refC, refTau) => refTau * genFlapTau(c) / genFlapTau(refC);

// NACA 4-digit digits -> {m, p, t} as fractions of chord.
function nacaParts(code) {
  const d = String(code | 0).padStart(4, '0');
  return { m: +d[0] / 100, p: Math.max(0.05, +d[1] / 10), t: +d.slice(2) / 100 };
}

// Keep the parameter space inside an envelope this chantier has flown. The
// editor calls this on every change, so a slider can never build something the
// structure rules were not written for.
function clampSpec(spec) {
  const S = genNormaliseSpec(spec);
  const fu = S.fuselage, cb = S.cabin;
  if (!GEN_MATERIALS[fu.material]) fu.material = 'tubeFabric';
  if (!GEN_SHAPES[fu.shape]) fu.shape = 'straight';
  if (!GEN_TANKS[S.fuel.tank]) S.fuel.tank = 'nose';
  if (!GEN_SYSTEMS[S.systems.fit]) S.systems.fit = 'basic';
  const ct = S.controls;
  if (!GEN_FLAPS[ct.flap.type]) ct.flap.type = 'none';
  ct.aileron.span = genClamp(ct.aileron.span, 0.15, 0.55);
  ct.aileron.chord = genClamp(ct.aileron.chord, 0.10, 0.35);
  // the flap gets whatever semispan the aileron leaves, less a 4% gap for the
  // break between them — they cannot share a section
  ct.flap.span = genClamp(ct.flap.span, 0.10, Math.max(0.10, 1 - ct.aileron.span - 0.04));
  ct.flap.chord = genClamp(ct.flap.chord, 0.10, 0.40);
  ct.elevator.chord = genClamp(ct.elevator.chord, 0.20, 0.55);
  ct.rudder.chord = genClamp(ct.rudder.chord, 0.20, 0.60);
  if (!GEN_SEATING[cb.seating]) cb.seating = 'tandem2';

  // ---- cabin glazing --------------------------------------------------------
  // Every fallback here matches GEN_DEFAULT exactly. genNormaliseSpec has
  // already filled anything missing, so these `== null` arms are only reached by
  // a spec built by hand — and a fallback that disagrees with the default is a
  // trap that only fires on that path.
  if (!['none', 'windshield', 'bubble', 'greenhouse'].includes(cb.glazing))
    cb.glazing = 'bubble';
  // 'greenhouse' survives only so old specs still load: it IS a faceted bubble,
  // and carrying it as a third shape would mean two code paths for one shell.
  if (cb.glazing === 'greenhouse') { cb.glazing = 'bubble'; cb.canopy.facet = true; }
  const cn = cb.canopy || (cb.canopy = {});
  cn.height   = genClamp(cn.height   == null ? 0    : cn.height,   0,    0.90);
  cn.width    = genClamp(cn.width    == null ? 1.0  : cn.width,    0.85, 1.60);
  cn.bubble   = genClamp(cn.bubble   == null ? 0.70 : cn.bubble,   0,    1);
  cn.lid      = genClamp(cn.lid      == null ? 1.0  : cn.lid,      0.25, 1);
  cn.sill     = genClamp(cn.sill     == null ? 0.30 : cn.sill,     0.10, 0.85);
  cn.skew     = genClamp(cn.skew     == null ? 0.42 : cn.skew,     0.20, 1.60);
  cn.sun      = genClamp(cn.sun      == null ? 0    : cn.sun,      0,    0.92);
  cn.sunStart = genClamp(cn.sunStart == null ? 0.38 : cn.sunStart, 0,    0.85);
  cn.sideTop  = genClamp(cn.sideTop  == null ? 0.34 : cn.sideTop,  0.05, 0.75);
  cn.sideDepth= genClamp(cn.sideDepth== null ? 0.5  : cn.sideDepth,0,    1);
  cn.sideReach= genClamp(cn.sideReach== null ? 1.0  : cn.sideReach,0.2,  1);
  cn.sideGap  = genClamp(cn.sideGap  == null ? 0.10 : cn.sideGap,  0,    0.6);
  // -1 concave, 0 the plain smoothstep, +1 convex. The panel only offers 0..1;
  // the clamp is wider so a hand-written spec can ask for a concave screen.
  cn.wsCurve  = genClamp(cn.wsCurve  == null ? 1    : cn.wsCurve,  -1,   1);
  cn.jointRun = genClamp(cn.jointRun == null ? 3    : cn.jointRun | 0, 1, 8);
  if (!['square', 'chamfer'].includes(cn.joint)) cn.joint = 'square';
  cn.facet = !!cn.facet;
  cn.sides = !!cn.sides;
  // nullable = "derive it", and they ride the panel's AUTO path
  cn.wsAngle = genClampN(cn.wsAngle, 22, 80);
  cn.x0      = genClampN(cn.x0, 0, 8);
  cn.x1      = genClampN(cn.x1, 0, 9);
  cn.reach   = genClampN(cn.reach, 0, 1);
  // a windscreen-only cut is covered flush — zero stand-off is the definition of
  // the case, and it is what makes it the control for the edge-loop machinery
  if (cb.glazing === 'windshield') cn.height = 0;

  const pn = cb.panel || (cb.panel = {});
  pn.on    = pn.on !== false;
  pn.depth = genClamp(pn.depth == null ? 0.27 : pn.depth, 0.05, 1.20);
  pn.inset = genClamp(pn.inset == null ? 0.06 : pn.inset, 0,    0.25);
  // how far down the sill arc the coaming wraps; 0.5 is exactly the sill
  pn.wrap  = genClamp(pn.wrap  == null ? 0.50 : pn.wrap,  0,    1);

  // seat station is an OFFSET about a per-layout base (SEAT_BASE, 63_gen_skin.js),
  // so 0 means "right" in either layout
  cb.seatX     = genClamp(cb.seatX     == null ? 0    : cb.seatX,     -0.45, 0.45);
  cb.seatY     = genClamp(cb.seatY     == null ? 0.10 : cb.seatY,      0.06, 0.50);
  // a real distance between tandem seats, not a fraction of the cabin
  cb.seatPitch = genClamp(cb.seatPitch == null ? 0.86 : cb.seatPitch,  0.55, 1.35);

  const pl = cb.pilot || (cb.pilot = {});
  pl.show    = pl.show !== false;
  // standing height in metres; the rig is anthropometric, so this one length
  // scales the whole figure
  pl.stature = genClamp(pl.stature == null ? 1.75 : pl.stature, 1.45, 2.05);
  pl.lean    = genClamp(pl.lean    == null ? 17   : pl.lean,    -5,  45);
  pl.thigh   = genClamp(pl.thigh   == null ? -9   : pl.thigh,  -20,  40);
  pl.shank   = genClamp(pl.shank   == null ? 10   : pl.shank,   10,  95);
  pl.armDown = genClamp(pl.armDown == null ? 40   : pl.armDown, -10, 90);
  pl.fore    = genClamp(pl.fore    == null ? 6    : pl.fore,   -45,  60);
  pl.head    = genClamp(pl.head    == null ? -11  : pl.head,   -25,  25);
  // arms IN toward the body centre — a tight canopy is narrower than a pair of
  // elbows, so this is a control and not a constant
  pl.armIn   = genClamp(pl.armIn   == null ? 26   : pl.armIn,  -10,  40);
  // the legs' OTHER axis: thigh and shank are flexion, these are abduction.
  // Both splays share a range because they are the same kind of control, and
  // because a clamp narrower than its slider leaves dead travel at the ends.
  pl.hipOut  = genClamp(pl.hipOut  == null ? 0    : pl.hipOut,  -5,  35);
  pl.kneeOut = genClamp(pl.kneeOut == null ? 3    : pl.kneeOut, -5,  35);
  // the feet: pitch about the ankle (toes up positive), and splay
  pl.ankle   = genClamp(pl.ankle   == null ? 40   : pl.ankle,  -25,  40);
  pl.toeOut  = genClamp(pl.toeOut  == null ? 7    : pl.toeOut,   0,  30);

  S.paint.regX = genClamp(S.paint.regX == null ? 0.30 : S.paint.regX, 0, 1);

  // TAIL-END SECTION HEIGHT. Applied here, on the clone, by moving the two
  // dimensions 61_gen_frame.js actually reads. clampSpec runs on a fresh
  // normalised clone every time, so this cannot accumulate across calls the way
  // gear.track once did.
  fu.tailY = genClamp(fu.tailY == null ? 0 : fu.tailY, -0.60, 0.80);
  fu.tailBot += fu.tailY;
  fu.tailTop += fu.tailY;

  for (const e of S.engines) {
    if (typeof POWERPLANTS !== 'undefined' && !POWERPLANTS[e.type])
      e.type = 'a65_sensenich74';
    if (!['nose', 'wing'].includes(e.mount)) e.mount = 'nose';
    e.place.dx = genClamp(e.place.dx, -0.60, 0.45);
    e.place.dy = genClamp(e.place.dy, -0.30, 0.40);
  }
  if (!['strut', 'cantilever'].includes(S.bracing.type)) S.bracing.type = 'strut';
  S.fuel.litres = genClamp(S.fuel.litres, 0, 140);
  cb.baggage = genClamp(cb.baggage, 0, 60);
  const w = S.wings[0];
  w.chord = genClamp(w.chord, 1.15, 2.10);
  w.span = genClamp(w.span, Math.max(6.5, 4.0 * w.chord),
                            Math.min(14.0, 10.0 * w.chord));
  w.taper = genClamp(w.taper, 0.45, 1.0);
  w.dihedral = genClamp(w.dihedral, 0, 6);
  // Quarter-chord sweep, degrees, positive aft. At the speeds this game flies
  // sweep buys nothing aerodynamically — it is a compressibility device — so it
  // is here as a BALANCE tool: it walks the aerodynamic centre aft without
  // moving the spar root off its frame. It costs lift-curve slope either way,
  // which is why forward sweep is allowed and is not free.
  w.sweep = genClamp(w.sweep || 0, -15, 30);
  if (!GEN_TIPS[w.tip]) w.tip = 'rounded';
  if (!GEN_TIPS[S.tail.tip]) S.tail.tip = 'rounded';
  // null is legal on the two overrides and means 'use tail.tip'
  S.tail.stabH = genClamp(S.tail.stabH == null ? 0 : S.tail.stabH, 0, 1);
  S.tail.vSweep = genClampN(S.tail.vSweep, -20, 60);
  const dr = S.tail.dorsal || (S.tail.dorsal = {});
  dr.height = genClamp(dr.height == null ? 0.16 : dr.height, 0, 0.90);
  dr.width  = genClamp(dr.width  == null ? 0.55 : dr.width,  0.15, 1.60);
  dr.angle  = genClampN(dr.angle, 8, 80);
  dr.len    = genClamp(dr.len    == null ? 0.34 : dr.len,    0, 2.00);
  if (S.tail.tipV != null && !GEN_TIPS[S.tail.tipV]) S.tail.tipV = null;
  if (S.tail.tipH != null && !GEN_TIPS[S.tail.tipH]) S.tail.tipH = null;
  S.tail.hTaper = genClamp(S.tail.hTaper == null ? 1 : S.tail.hTaper, 0.35, 1.0);
  if (!['conventional', 'v'].includes(S.tail.type)) S.tail.type = 'conventional';
  // the V's dihedral. Too shallow and it cannot make yaw at any sane area; too
  // steep and it cannot make pitch. The Bonanza's is about 33.
  S.tail.vAngle = genClamp(S.tail.vAngle == null ? 33 : S.tail.vAngle, 20, 55);
  // CRANK: a second wing section, and only a second. `crankAt` is the break
  // station as a fraction of the semispan; 0 means a single straight panel.
  // This is the Jodel's wing — a flat centre section and sharply dihedralled
  // outer panels — which is a real structure, not a styling choice: the crank
  // is where the outer panel bolts to the centre section.
  w.crankAt = genClamp(w.crankAt || 0, 0, 0.85);
  if (w.crankAt > 0 && w.crankAt < 0.15) w.crankAt = 0;
  w.dihedralOut = genClampN(w.dihedralOut, 0, 20);
  w.incidence = genClamp(w.incidence, -1, 4);
  w.washout = genClamp(w.washout, 0, 4);
  w.panels = genClamp(w.panels | 0, 2, 5);
  const n = nacaParts(w.naca);
  w.naca = (genClamp(Math.round(n.m * 100), 0, 6) * 1000)
         + (genClamp(Math.round(n.p * 10), 2, 6) * 100)
         + genClamp(Math.round(n.t * 100), 9, 18);
  if (!['high', 'mid', 'low'].includes(w.position)) w.position = 'high';
  // the centre section over the cabin. NOTE the path: this is `wings[].centre`,
  // not `cabin.wingBay` — the transfer spec named it the latter, and the latter
  // exists nowhere. The enum is `glass`, not `skylight`, for the same reason.
  if (!['solid', 'glass', 'open'].includes(w.centre)) w.centre = 'solid';
  // placement: generous bounds, because the point is to allow bad aeroplanes.
  // These stop the geometry going degenerate, nothing more.
  w.place.dx = genClamp(w.place.dx, -1.2, 1.8);
  w.place.dy = genClamp(w.place.dy, -0.25, 0.60);
  if (!['taildragger', 'tricycle'].includes(S.gear.type)) S.gear.type = 'taildragger';
  if (!GEN_SUSPENSION[S.gear.suspension]) S.gear.suspension = 'bungee';
  // WHEEL FAIRINGS, off by default. `spat` is the trouser over the wheel alone;
  // `full` carries it up the leg as well. Geometry ONLY — a real spat is worth
  // real drag, but the generated aeroplane has no parasite-drag build-up to hang
  // that on, and a fairing that quietly did nothing to the numbers while looking
  // as though it should is worse than one that is honestly cosmetic. If a drag
  // model arrives, this is the field it keys off.
  if (!['none', 'spat', 'full'].includes(S.gear.fairing)) S.gear.fairing = 'none';
  S.cargo.len = genClamp(S.cargo.len || 0, 0, 2.5);
  S.cargo.kg = genClamp(S.cargo.kg || 0, 0, 400);
  fu.tailBays = genClamp(fu.tailBays | 0, 3, 6);
  fu.postGap = genClamp(fu.postGap, 0.35, 1.10);
  fu.crownTop = genClamp(fu.crownTop, 0, 1);
  fu.crownSide = genClamp(fu.crownSide, 0, 0.6);
  // The TAIL-END SECTION. These were in the spec from the start but had no
  // control, so every aeroplane got a 0.10 m half-width tailpost whatever its
  // size. A bigger section is also a deeper truss, which is a GEOMETRY change,
  // not a stiffness one — the beam constants are untouched here.
  fu.tailW = genClamp(fu.tailW, 0.06, 0.45);
  fu.tailBot = genClamp(fu.tailBot, 0, 0.80);
  fu.tailTop = genClamp(fu.tailTop, 0.10, 1.20);
  fu.cowlDeck = genClampN(fu.cowlDeck, 0.50, 1.00);
  fu.windRun = genClamp(fu.windRun, 0.10, 0.60);
  S.cowl.fillet = genClamp(S.cowl.fillet, 0.02, 0.22);
  S.cowl.taper = genClamp(S.cowl.taper, 0.70, 1.0);
  // The cowl's own nose section. Generous, because a slim cowl on a fat engine
  // and a fat cowl on a slim one are both aeroplanes somebody builds — the
  // shakedown says which you have, it does not refuse to build it.
  S.cowl.halfW = genClampN(S.cowl.halfW, 0.05, 1.10);
  S.cowl.top = genClampN(S.cowl.top, 0.03, 1.10);
  S.cowl.bot = genClampN(S.cowl.bot, 0.03, 1.10);
  if (!GEN_INTAKES[S.cowl.intake]) S.cowl.intake = 'chin';
  // THE PROPELLER. Diameter is bounded by what a nose can carry rather than by
  // what flies: prop clearance is a GEN_RULES constraint and it will lengthen the
  // undercarriage to hold it, so a 4 m disc on a Cub is a legal, stilted mistake.
  S.prop.D = genClampN(S.prop.D, 0.20, 4.00);
  S.prop.blades = genClamp(Math.round(S.prop.blades) || 2, 2, 6);
  if (!GEN_PROP_MATS[S.prop.material]) S.prop.material = 'wood';
  if (!GEN_PROP_PITCH[S.prop.pitch]) S.prop.pitch = 'standard';
  // the shape half — visual only, so the bounds are what reads as a propeller
  // rather than what flies
  S.prop.chord = genClamp(S.prop.chord == null ? 0.10 : S.prop.chord, 0.05, 0.20);
  S.prop.root  = genClamp(S.prop.root  == null ? 0.16 : S.prop.root,  0.08, 0.35);
  const sn = S.prop.spinner || (S.prop.spinner = {});
  if (!['ogive', 'cone', 'dome', 'none'].includes(sn.shape)) sn.shape = 'ogive';
  // len and dia are multiples of the spinner RADIUS and of the prop radius
  // respectively — again fractions, so a bigger propeller gets a bigger nose
  sn.len = genClamp(sn.len == null ? 2.2  : sn.len, 0.6,  4.0);
  sn.dia = genClamp(sn.dia == null ? 0.17 : sn.dia, 0.08, 0.32);
  cb.noseGap = genClamp(cb.noseGap, 0.40, 1.10);
  S.gear.stiffness = genClamp(S.gear.stiffness == null ? 1 : S.gear.stiffness, 0.35, 3.0);
  S.gear.place.dx = genClamp(S.gear.place.dx, -0.80, 1.20);
  S.gear.place.dtrack = genClamp(S.gear.place.dtrack, -0.80, 1.50);
  S.tail.place.dx = genClamp(S.tail.place.dx, -1.5, 1.5);
  // fields the generator normally derives, but which the editor now exposes.
  // Bounded so an override cannot go degenerate; still nullable, so leaving
  // them alone keeps the derivation.
  cb.halfW = genClampN(cb.halfW, 0.28, 0.75);
  cb.h = genClampN(cb.h, 0.75, 1.45);
  cb.len = genClampN(cb.len, 0.60, 2.60);
  fu.tailArm = genClampN(fu.tailArm, 2.00, 6.50);
  S.tail.hSpan = genClampN(S.tail.hSpan, 1.50, 4.50);
  S.tail.hChord = genClampN(S.tail.hChord, 0.40, 1.60);
  S.tail.vHeight = genClampN(S.tail.vHeight, 0.60, 2.20);
  S.tail.vChord = genClampN(S.tail.vChord, 0.40, 1.80);
  S.gear.track = genClampN(S.gear.track, 0.90, 3.50);
  S.gear.wheelR = genClamp(S.gear.wheelR, 0.10, 0.40);
  S.gear.twR = genClamp(S.gear.twR, 0.05, 0.25);
  // Leg lengths: generous, because a stilt-legged bush aeroplane and a squatting
  // racer are both aeroplanes somebody builds. The floor is rule 5 (a leg this
  // short has no vertical stiffness whatever its k) and the shakedown says so.
  S.gear.legDrop = genClampN(S.gear.legDrop, 0.15, 1.20);
  S.gear.twLeg = genClampN(S.gear.twLeg, 0.06, 1.40);
  // Camber, degrees, tops-outboard positive. Real aeroplanes run a few degrees
  // either way; the range is wide enough to be a look and not wide enough for
  // the wheel to lie on its side.
  S.gear.camber = genClamp(S.gear.camber || 0, -12, 20);
  return genAlias(S);
}

// Fill every null from the fields before it. `auto` records what was derived
// so the editor can mark a field "auto" and show the proposal it overrode.
// Order matters: this IS the design flow (cabin -> fuselage -> engine ->
// wing -> tail -> gear), each step reading only what precedes it.
function resolveSpec(spec) {
  const S = clampSpec(spec);
  const auto = {};
  const put = (o, k, v, path) => { if (o[k] === null || o[k] === undefined) { o[k] = v; auto[path] = true; } };

  // 1. cabin — the payload box everything else is built around
  const seat = GEN_SEATING[S.seating];
  put(S.cab, 'halfW', seat.halfW, 'cab.halfW');
  put(S.cab, 'h', seat.h, 'cab.h');
  put(S.cab, 'len', seat.len, 'cab.len');
  // THE WINDOW'S AFT END, and why it is a fraction. `reach` is what the panel
  // drives; `x1` is the absolute station it resolves to, and it resolves HERE
  // because it needs the cabin length that was derived on the line above.
  //
  // An absolute station cannot survive a cabin-length change: stretch the cabin
  // and the window stays where it was while the cabin moves out from under it,
  // which is the failure the prototype harness hit and fixed. A fraction of the
  // cabin follows it by construction. The extra 0.5 m is the bay behind the
  // cabin, so reach = 1 runs the window to the end of it.
  //
  // Setting `x1` explicitly still wins — `put` only fills nulls — so a build
  // that wants the window pinned whatever the cabin does can still say so. The
  // aft-of-tailpost safety clamp stays in 63_gen_skin.js, where postX lives.
  put(S.cab.canopy, 'reach', (S.cab.len + 0.35) / (S.cab.len + 0.5),
      'cabin.canopy.reach');
  put(S.cab.canopy, 'x1', S.cab.noseGap + (S.cab.len + 0.5) * S.cab.canopy.reach,
      'cabin.canopy.x1');
  // no windscreen on a drone: the firewall top IS the cabin top, so the nose
  // runs straight into the body with no step to break
  put(S.fuse, 'cowlDeck', seat.deck, 'fuse.cowlDeck');
  // THE WINDSCREEN RAKE, as ONE number driving both things that must agree.
  // The fuselage owns its windscreen — the step up from the cowl deck over
  // `windRun` — and the canopy's front bow sits on that same step. Expressed as
  // two independent fields they drift, the shell stands off the body, and you
  // get the slab the transfer spec's crown-line note describes. So the angle is
  // the control and the run is derived from it: same rise, same angle, one
  // source. Left null, the angle is read back OUT of the fuselage's own run, so
  // an untouched build is bit-for-bit what it was.
  {
    const rise = Math.max(0.02, S.cab.h * (1 - S.fuse.cowlDeck));
    const cn = S.cab.canopy;
    if (cn.wsAngle == null)
      put(cn, 'wsAngle', Math.atan2(rise, S.fuse.windRun) * 180 / Math.PI,
          'cabin.canopy.wsAngle');
    else
      S.fuse.windRun = rise / Math.tan(cn.wsAngle * Math.PI / 180);
  }
  S.seats = seat.crew;
  S.crew = genClamp(S.pilots | 0, 1, seat.crew);

  // 2. wing longitudinal placement — the front spar lands on the cabin-front
  //    frame, which is what puts a high-wing carry-through over the cabin
  const w = S.wing, pl = S.place;
  put(w, 'xLE', S.cab.noseGap - GEN_RULES.sparFront * w.chord, 'wing.xLE');
  // the nudge lands BEFORE the tail arm is worked out, so pulling the wing back
  // takes the empennage with it and the aeroplane stays a coherent shape. Move
  // the tail relative to that with place.tailDx.
  w.xLE += pl.wingDx;
  // an uncranked wing's outer dihedral IS its dihedral, so the field can be
  // left alone and the aeroplane stays a single straight panel
  put(w, 'dihedralOut', w.crankAt > 0 ? Math.min(20, w.dihedral + 11) : w.dihedral,
      'wing.dihedralOut');
  const cBar = w.chord * (2 / 3) * (1 + w.taper + w.taper * w.taper) / (1 + w.taper);
  const semi = 0.5 * w.span;
  // The aerodynamic centre sits at the quarter chord OF THE MAC, and sweep
  // carries that aft with the spanwise station the MAC lives at:
  //   yMac = (b/6) (1 + 2 lambda) / (1 + lambda)
  // Everything downstream reads xAC — the tail arm above all — so getting this
  // wrong would leave a swept aeroplane with a tail sized for a straight one.
  const yMac = (w.span / 6) * (1 + 2 * w.taper) / (1 + w.taper);
  const xAC = w.xLE + 0.25 * w.chord + yMac * Math.tan(w.sweep * Math.PI / 180);
  // TIP BOW. The radius is a fraction of the chord AT the joint, and the joint
  // is a radius inboard of the tip — implicit, so settle it by iteration (it
  // converges in two on any sane taper).
  const zR0 = S.cab.halfW;
  const lin = z => w.chord * (1 - (1 - w.taper) * (z - zR0) / Math.max(1e-6, semi - zR0));
  const bowF = (GEN_TIPS[w.tip] || GEN_TIPS.rounded).bow || 0;
  let Rb = bowF * lin(semi);
  for (let i = 0; i < 3; i++) Rb = bowF * lin(Math.max(zR0, semi - Rb));
  Rb = Math.max(0, Math.min(Rb, 0.45 * (semi - zR0)));
  w.tipR = Rb;
  w.tipZ = semi - Rb;
  w.tipC = Rb > 1e-6 ? lin(w.tipZ) : 0;
  // the bow removes a quarter of the rectangle it replaces on each tip
  // (half-ellipse of span Rb and chord tipC), so the REFERENCE AREA is the
  // shape's area, not the trapezoid's
  const Sw = w.span * w.chord * 0.5 * (1 + w.taper)
             - 2 * w.tipC * Rb * (1 - Math.PI / 4);
  S.geom = { xAC, cBar, semi, Sw, AR: w.span * w.span / Sw };

  // 3. fuselage length from the tail arm rule. The cargo bay is full-section
  //    fuselage aft of the cabin, so the tail has to start behind it.
  S.fuse.boxRear = S.cab.noseGap + S.cab.len + S.fuse.cargoLen;
  put(S.fuse, 'tailArm', xAC + GEN_RULES.tailArmC * w.chord, 'fuse.tailArm');
  S.fuse.tailArm = Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord);
  const post = S.fuse.tailArm + S.fuse.postGap;
  S.fuse.postX = post;

  // 4. empennage from tail volume coefficients against the wing just sized
  const t = S.tail;
  put(t, 'hX', S.fuse.tailArm + 0.70 * S.fuse.postGap, 'tail.hX');
  put(t, 'vX', S.fuse.tailArm + 0.90 * S.fuse.postGap, 'tail.vX');
  t.hX += pl.tailDx; t.vX += pl.tailDx;
  const lh = Math.max(1.0, t.hX - xAC), lv = Math.max(1.0, t.vX - xAC);
  const Sh = GEN_RULES.Vh * S.geom.Sw * cBar / lh;
  const Sv = GEN_RULES.Vv * S.geom.Sw * w.span / lv;
  put(t, 'hSpan', Math.sqrt(Sh * GEN_RULES.hAR), 'tail.hSpan');
  put(t, 'hChord', Sh / t.hSpan, 'tail.hChord');
  put(t, 'vHeight', Math.sqrt(Sv * GEN_RULES.vAR), 'tail.vHeight');
  put(t, 'vChord', Sv / t.vHeight, 'tail.vChord');
  S.tail.Sh = Sh; S.tail.Sv = Sv; S.tail.lh = lh; S.tail.lv = lv;
  // THE FIN'S RAKE, derived from what it already was. The skin swept the fin's
  // leading edge by a hardcoded 0.30 of the chord over the fin's height; left
  // null that is exactly what comes back, so making it a control moves no
  // existing aeroplane. It is an ANGLE and not a chord fraction because that is
  // what a builder reads off a drawing and what stays meaningful when the fin's
  // height and chord both change.
  put(t, 'vSweep', Math.atan2(0.30 * t.vChord, t.vHeight) * 180 / Math.PI,
      'tail.vSweep');
  // the dorsal's over-determined corner: an angle SET drives the length, an
  // angle left null is read back out of it
  {
    const d = t.dorsal;
    if (d.angle != null && d.height > 0)
      d.len = Math.max(0, d.height / Math.tan(d.angle * Math.PI / 180));
    else
      put(d, 'angle', Math.atan2(d.height, Math.max(1e-6, d.len)) * 180 / Math.PI,
          'tail.dorsal.angle');
  }
  // ---- V-TAIL: one pair of panels doing both jobs ----
  // A panel canted at G contributes cos^2 G of its area to pitch and sin^2 G to
  // yaw (one cosine because a pitch rate only reaches the panel through its
  // tilted normal, a second because only the vertical part of the resulting
  // force makes a pitching moment). So the area that satisfies BOTH volume
  // coefficients is whichever requirement binds — and on a shallow V it is
  // always pitch, which is why real V-tails are big.
  if (S.tail.type === 'v') {
    const G = S.tail.vAngle * Math.PI / 180;
    const cG = Math.cos(G), sG = Math.sin(G);
    const Svt = Math.max(Sh / (cG * cG), Sv / (sG * sG));
    // panel geometry from the same aspect-ratio rule the stabiliser uses,
    // measured ALONG the panels rather than across their projection
    const bVt = Math.sqrt(Svt * GEN_RULES.hAR);       // tip to tip, along the V
    const cVt = Svt / bVt;
    S.tail.Svt = Svt; S.tail.vG = G;
    S.tail.hSpan = bVt * cG;                          // horizontal projection
    S.tail.hChord = cVt;
    S.tail.vHeight = 0.5 * bVt * sG;
    S.tail.vChord = cVt;
    S.tail.Sh = Svt * cG * cG;                        // effective, for reporting
    S.tail.Sv = Svt * sG * sG;
    auto['tail.hSpan'] = auto['tail.hChord'] = true;
    auto['tail.vHeight'] = auto['tail.vChord'] = true;
  }

  // 5. gear — the two hard geometric constraints of a taildragger.
  //    y: the prop must clear the ground in the LEVEL attitude (this is the
  //    binding case; three-point has the nose up and is generous).
  //    twY: falls out of the third leg's length (both gear types since G4.6).
  //    x and track need the CG, so genFrame() places them on a second pass.
  //
  //    CAMBER first, because the contact radius it produces is what every
  //    clearance below is measured from. A wheel leaning by gamma touches
  //    R*cos(gamma) under its axle, so a cambered aeroplane sits LOWER on the
  //    same legs. `contactR` is published on the spec because five places need
  //    to agree about it — the node radius the solver contacts on, the prop
  //    clearance rule, the frame's track derivation, the shakedown's ground
  //    line, and the wheel mesh.
  //    NOT modelled: the contact patch also moves inboard by R*sin(gamma). The
  //    solver contacts directly under the node, so the effective track is the
  //    axle track. At the clamp (20 deg, 0.40 m wheels) that is 14 cm on a
  //    track of about 1.5 m — an honest cut, and the only one camber makes.
  S.gear.camberRad = S.gear.camber * Math.PI / 180;
  S.gear.contactR = S.gear.wheelR * Math.cos(S.gear.camberRad);
  const PP = (typeof POWERPLANTS !== 'undefined' && POWERPLANTS[S.engine]) || null;
  // 4a. THE PROPELLER, synthesised from the disc it actually is. The registry's
  // prop is the DEFAULT diameter and nothing more; every number below is derived,
  // so a bigger disc really does pull harder and blow harder over the tail.
  {
    const pr = S.prop;
    put(pr, 'D', PP ? PP.prop.D : 1.80, 'prop.D');
    const PI = GEN_PROP_PITCH[pr.pitch] || GEN_PROP_PITCH.standard;
    const MT = GEN_PROP_MATS[pr.material] || GEN_PROP_MATS.wood;
    const P = PP ? PP.engine.powerW : 48500;
    pr.area = Math.PI * (pr.D / 2) * (pr.D / 2);
    // More blades is more disc solidity: better static thrust for the same
    // diameter, at a little peak efficiency. 5.5% a blade past two.
    pr.fm = PI.fm * (1 + 0.055 * (pr.blades - 2));
    // MOMENTUM THEORY. The ideal static thrust of a disc absorbing P is
    // (2 rho A)^(1/3) P^(2/3); a real propeller reaches a fraction of it.
    pr.Tstatic = pr.fm * Math.cbrt(2 * RHO * pr.area) * Math.pow(P, 2 / 3);
    // and the quadratic decay, through the speed at which thrust runs out. One
    // constant on the only velocity scale there is; the pitch trade rides in
    // Tstatic, so a fine prop's thrust runs out earlier without being told to.
    pr.V0 = GEN_RULES.propV0K * P / Math.max(1, pr.Tstatic);
    pr.kV2 = pr.Tstatic / (pr.V0 * pr.V0);
    // blade mass, at the very front of the aeroplane
    pr.mass = pr.blades * MT.kg * Math.pow(pr.D / 1.88, 2.5);
    pr.price = Math.round(MT.price * pr.blades / 2 * Math.pow(pr.D / 1.88, 2));
    pr.name = `${pr.blades}-blade ${MT.name.toLowerCase()} ${pr.D.toFixed(2)} m`;
  }
  const propR = S.prop.D / 2;
  S.propR = propR;
  S.engY = 0.36 * S.cab.h + pl.engineDy;        // thrustline, above the lower longeron
  S.engX = -(0.18 + 0.32 * propR) + pl.engineDx; // firewall forward: cowl + prop

  // 4b. THE ENGINE BLOCK's own size, derived here rather than in the skin that
  // draws it, because the cowl has to be able to ask whether it covers the
  // thing. Scaled off the registry mass so a bigger engine looks like one; the
  // floor stops a model-aircraft outrunner from vanishing. Cylinders reach out
  // to `cylZ` either side, which is what pokes out of a Cub's cowl on purpose.
  {
    const k = Math.cbrt(Math.max(8, PP ? PP.engine.mass : 80) / 80);
    const halfW = 0.105 * k, cylZ = 0.30 * k, cylR = 0.072 * k;
    // A cylinder is a TILTED tube, so its outer cap ring reaches further out
    // than its axis does — 15 mm on an O-200, which is exactly the margin the
    // enclosure verdict was getting wrong. `cylZ` is what the skin draws to;
    // `cylReach` is what actually sticks out, and is what the test uses.
    const tilt = (0.04 * k) / Math.hypot(0.04 * k, cylZ - halfW);
    S.engBox = { k, halfW, halfH: 0.105 * k, cylZ, cylR,
                 cylReach: cylZ + cylR * tilt,
                 xF: S.engX - 0.09 * k, xA: S.engX + 0.19 * k };
  }

  // 4c. THE COWL's nose section, about the THRUSTLINE. Derived from the firewall
  // section tapered about that datum, which is the same shape as before wherever
  // the two datums nearly coincide (every seating but the drone) and is centred
  // on the engine where they do not.
  {
    const cw = S.cowl, ck = genClamp(cw.taper, 0.70, 1.0);
    const fwW = S.cab.halfW * 0.92;               // firewall ring, as station 0
    const fwT = S.cab.h * S.fuse.cowlDeck, fwB = 0;
    // THE DERIVED TOP AND BOTTOM CLEAR THE CRANKCASE. That line is the fix for
    // "the drone cowl collapses below its engine", and it is drawn at the CASE
    // rather than at the cylinders on purpose: a cowl covers the case and lets
    // the cylinder heads out — that is what a J-3 does, and enclosing everything
    // by default would make every aeroplane a cowled Cessna. Measured, the floor
    // bites ONLY on the drone (its deck line is its cabin roof, so the firewall
    // section sits 4 cm above the thrustline on a 30 cm body): +2.4 cm of cowl
    // bottom there, and not a millimetre on any other seating.
    // The earlier attempt at this floored the FIREWALL RING on engine size and
    // had to be reverted because it widened every aeroplane's nose. The cowl
    // having a section of its own is what makes the same idea safe.
    const E = S.engBox;
    const clr = Math.max(0.02, 0.20 * E.halfH);
    const xNose = S.engX - 0.10, len = Math.max(0.12, 0 - xNose);
    // The cover is a loft with a FILLET rolled onto its nose, and the fillet is
    // an inset from every side. The case's forward face sits within a couple of
    // centimetres of the nose plane, i.e. INSIDE the fillet, so flooring the
    // nose section alone leaves the case poking out of the belly anyway
    // (measured: 1.7 cm on the drone, down from 4.3, but still there).
    // So solve for the nose section that covers the case AT THE CASE'S OWN
    // STATIONS. Four fixed passes rather than a while-loop: generation has to
    // stay deterministic (GATE GEN byte-compares a double-generate), and the
    // update is monotone, so four is past convergence everywhere measured.
    const shrinkAt = (t, nHW, hDN) => {
      const fil = Math.min(cw.fillet, 0.40 * Math.min(nHW, hDN), 0.45 * len);
      const d = (1 - t) * len;                     // distance back from the nose
      if (d >= fil) return 0;
      // the quarter-round: shrink = fil (1 - cos a), sin a = 1 - d/fil
      const s = Math.max(0, Math.min(1, 1 - d / Math.max(1e-6, fil)));
      return fil * (1 - Math.sqrt(Math.max(0, 1 - s * s)));
    };
    // ONE section function, shared by the floor solver and the verdict below, so
    // what the panel claims and what the loft builds cannot drift apart. `t` is
    // the fraction along the cowl (0 = firewall), and the fillet's inset is in it.
    const secAt = (t, nHW, nTop, nBot) => {
      const hDN = 0.5 * (nTop + nBot), yN = S.engY + 0.5 * (nTop - nBot);
      const sh = shrinkAt(t, nHW, hDN);
      const yc = 0.5 * (fwT + fwB) + (yN - 0.5 * (fwT + fwB)) * t;
      const hd = 0.5 * (fwT - fwB) + (hDN - 0.5 * (fwT - fwB)) * t;
      return { halfW: Math.max(0.02, fwW + (nHW - fwW) * t - sh),
               yLo: yc - hd + sh, yHi: yc + hd - sh, t };
    };
    let nT = Math.max(0.03, E.halfH + clr, (fwT - S.engY) * ck);
    let nB = Math.max(0.03, E.halfH + clr, (S.engY - fwB) * ck);
    const nHW0 = fwW * ck;
    for (let pass = 0; pass < 4; pass++) {
      let needT = 0, needB = 0;
      // the case occupies xF..xA; its most exposed station is the forward one,
      // but walk it so a long case cannot slip between samples
      for (let i = 0; i <= 4; i++) {
        const s2 = secAt(Math.max(0, Math.min(1,
          (0 - (E.xF + (E.xA - E.xF) * i / 4)) / len)), nHW0, nT, nB);
        needT = Math.max(needT, (S.engY + E.halfH + clr) - s2.yHi);
        needB = Math.max(needB, s2.yLo - (S.engY - E.halfH - clr));
      }
      if (needT <= 1e-6 && needB <= 1e-6) break;
      nT += Math.max(0, needT); nB += Math.max(0, needB);
    }
    put(cw, 'halfW', nHW0, 'cowl.halfW');
    put(cw, 'top', nT, 'cowl.top');
    put(cw, 'bot', nB, 'cowl.bot');
    S.cowl.secAt = t => secAt(t, cw.halfW, cw.top, cw.bot);
    S.cowl.tAt = x => Math.max(0, Math.min(1, (0 - x) / len));
    // What the cowl covers, reported rather than enforced: a cowl is not obliged
    // to enclose its engine (a Cub's cylinders stick out), but the player should
    // be told which it is instead of finding out by looking at a collapsed nose.
    //
    // Measured at EACH PART'S NARROWEST STATION, not at the nose and not at the
    // block's midpoint. The cover is a loft: widest at the firewall, narrowest at
    // the nose. Comparing against the nose section says "engine out" for cowls
    // that visibly swallow the engine; comparing at the block's midpoint says
    // "enclosed" for a cylinder that pokes through 6 mm further forward, which is
    // exactly the disagreement with the mesh this started as.
    // So: the crankcase is checked where its FORWARD face is, and the cylinders
    // where the FORWARD one of them is — through the same shrink-aware section
    // function the floor above solved with.
    const sCase = cw.secAt(cw.tAt(E.xF)), sCyl = cw.secAt(cw.tAt(S.engX + 0.01 * E.k));
    cw.atEngine = sCase;
    cw.covers = {
      above: sCase.yHi >= S.engY + E.halfH - 1e-6,
      below: sCase.yLo <= S.engY - E.halfH + 1e-6,
      sides: sCyl.halfW >= E.cylReach - 1e-6,
    };
    cw.enclosed = cw.covers.above && cw.covers.below && cw.covers.sides;
  }
  // Two constraints, and the gear has to satisfy BOTH: the propeller must clear
  // the ground, and the legs must be long enough to be stiff. Prop clearance
  // alone gave a tiny prop a tiny undercarriage, and the aeroplane squatted
  // onto its own floor (measured with the model-aircraft outrunner).
  put(S.gear, 'legDrop', GEN_RULES.legDrop, 'gear.legDrop');
  // twLeg is NOT resolved here. A tailwheel's default is a constant, but a
  // nosewheel's is only knowable once the wheelbase is — same reason gear.x and
  // gear.track are placed by genFrame on its second pass. Left null it keeps
  // each type's own derivation; set, it is the leg length for both.
  // the two gear types are certificated to different clearances, so they get
  // different ones here rather than sharing the stricter
  const clearReq = S.gear.type === 'tricycle' ? GEN_RULES.propClearNose
                                              : GEN_RULES.propClear;
  const byProp = S.engY - propR + S.gear.contactR - clearReq;
  const byLeg = -0.02 - S.gear.legDrop;
  // WHICH ONE BOUND IT, published because otherwise the legDrop slider looks
  // broken. min() picks the LOWER axle, i.e. the LONGER leg, so a legDrop
  // shorter than prop clearance demands changes nothing at all — measured, on
  // the default aeroplane the prop wants 0.76 m and anything under that is
  // silently ignored. The prop keeps winning on purpose: a leg the player
  // shortened into a prop strike is not a bad aeroplane, it is a broken one on
  // the first landing.
  S.gear.yBoundBy = byProp <= byLeg ? 'prop clearance' : 'legDrop';
  put(S.gear, 'y', Math.min(byProp, byLeg), 'gear.y');
  return { spec: S, auto };
}

if (typeof module !== 'undefined' && typeof exports !== 'undefined') { /* concat build: no-op */ }
// ============================================================
// GARAGE 2/5 — the FRAME. Resolved spec -> named node/beam lattice.
//
// This file is where the HANDOVER "STRUCTURAL RULES (each one paid for in
// blood)" live. They are enforced by construction here so that no generated
// airframe can omit one; the numbered comments below cite the rule they serve.
// Nothing downstream may relax them.
//
// The lattice is also the surface: 63_gen_skin.js reads the same stations and
// bays this file emits, so structure and skin cannot disagree. `parts` is that
// shared contract.
//
// Node tags match the hand-written fiches exactly (WF/WR/ENG/AXLE/TW/HT/FIN/
// TPB/TPT), because the solver, the skin binding, the shadow proxy and the
// gate harness all key off them.
// ============================================================

function genQuadArea(P, a, b, c, d) {
  const tri = (i, j, k) => {
    const ux = P[j][0]-P[i][0], uy = P[j][1]-P[i][1], uz = P[j][2]-P[i][2];
    const vx = P[k][0]-P[i][0], vy = P[k][1]-P[i][1], vz = P[k][2]-P[i][2];
    return 0.5 * Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx);
  };
  return tri(a, b, c) + tri(a, c, d);
}

// One pass of the lattice. gearX/track are supplied by genFrame on the second
// pass once the CG is known (see the gear section).
function genLattice(S, gearX, track, kScale) {
  const M = GEN_MATERIALS[S.material];
  const KS = kScale || 1;                       // structure sized for the mass
  const ARCH = GEN_SUSPENSION[S.gear.suspension] || GEN_SUSPENSION.bungee;
  const SUS = (S.gear.stiffness == null ? 1 : S.gear.stiffness) * ARCH.k;
  // Damping does NOT scale with stiffness the way stiffness does. Critical
  // damping is 2*sqrt(k*m), so at constant mass c goes as sqrt(k) — scaling it
  // linearly with the suspension knob piles damping onto the axle node until
  // sum(c)*dt/m passes 1 and the explicit integrator blows up. Measured: at
  // stiffness 3 the gear pinned at 100% strain and stayed there, which reads
  // exactly like a structural collapse and is nothing of the kind.
  // The archetype's damping is DESIGNED, not derived — an oleo really does damp
  // far harder than a bungee — so it multiplies directly. Only the player's
  // stiffness knob follows sqrt(k), since that is a change to one spring.
  // THE KNOB SOFTENS THE SPRING, NOT THE BRACING. It used to scale every gear
  // member, so turning the suspension down softened the drag braces and the
  // belly cross-bracing with it and the undercarriage FOLDED: measured, at 0.6x
  // the aeroplane settled on its belly with the axle 0.75 m in the air, fully at
  // rest, 1.4% strain — rule 1's snap-through, and no strain gate can see it.
  // The barrier was already that close: 1 kg more at the nose (G4.7's honest
  // prop mass) moved it from 0.6x standing at 8% strain to 0.6x folded.
  // Real gear behaves the way the split does: a soft spring gives long travel
  // and the drag brace is a tube either way. `vis === 'leg'` (see B, below) is
  // exactly the suspension member, which is why G4.6's visual work is what made
  // this expressible. IDENTICAL AT stiffness 1.0 for every archetype, which is
  // the whole default fleet — the split only opens up as the knob moves.
  const KG = KS * SUS;                       // the spring
  const KGB = KS * ARCH.k;                   // its bracing: archetype, no knob
  const CS = KS;
  const CG = KS * ARCH.c * Math.sqrt(S.gear.stiffness == null ? 1 : S.gear.stiffness);
  const CGB = KS * ARCH.c;
  const R = GEN_RULES;
  const D = Math.PI / 180;
  const nodes = [], beams = [];
  const P = [];                                     // positions, for area math
  const N = (x, y, z, tag, r = 0) => {
    nodes.push({ p: [x, y, z], m: 0, r, tag }); P.push([x, y, z]);
    return nodes.length - 1;
  };
  const NM = (x, y, z, tag, r = 0) =>
    [N(x, y, -Math.abs(z), tag + 'L', r), N(x, y, Math.abs(z), tag + 'R', r)];
  // ext = the member is OUTSIDE the covering (struts, gear legs). It stays
  // visible when the aeroplane is covered; everything else disappears under
  // the fabric, which is what the Frame/Covered view modes key off.
  //
  // vis = HOW it is drawn, and it never touches the physics. The undercarriage
  // needs this: the truss the solver wants is not the hardware a real
  // aeroplane wears, and the report was "the tailwheel has too many struts"
  // with "keep the physical model" attached to it. So a member can be a wire
  // instead of a 48 mm tube, or be declared INTERNAL and drop out of the
  // covered view while still standing in Frame mode — which is honest, because
  // Frame mode's whole job is to show the structure that was welded.
  //   null    hexagonal tube, as before
  //   'wire'  thin bracing wire or tie rod
  //   'leg'   the suspension leg — drawn as bungee / spring / oleo (63)
  //   'inner' structural, but inside the covering: goes in the frame mesh
  const B = (a, b, cls, ext, vis) => {
    const L = Math.hypot(P[b][0]-P[a][0], P[b][1]-P[a][1], P[b][2]-P[a][2]);
    const isG = cls === 'gear';
    // GEN_RULES.wingK: the wing class is x19 softer than the cap its own mass
    // already buys. See the constant for the measurements and the substep
    // trade. Damping is NOT scaled with it — a stiffer structure at the same c
    // is a more lightly damped one, which is what a real one does, and c is not
    // what binds the timestep here.
    const kGain = cls === 'wing' ? (R.wingK ?? 1) : 1;
    // a gear member is either the SPRING (vis 'leg') or its bracing
    const kG = vis === 'leg' ? KG : KGB, cG = vis === 'leg' ? CG : CGB;
    beams.push({ a, b, k: M.k[cls] * (isG ? kG : KS) * kGain, c: M.c[cls] * (isG ? cG : CS),
                 gear: isG, cls, ext: vis === 'inner' ? false : (!!ext || isG),
                 vis: vis || null, L });
    // structural mass: linear density x length, half to each end (this is the
    // whole structural mass model — there is no separate mass budget to keep
    // in sync with the geometry)
    const h = 0.5 * L * M.lin[cls];
    nodes[a].m += h; nodes[b].m += h;
    bill(2 * h, 2 * h * M.price);
  };
  // ---- the LEDGER (G3). Mass and money, attributed to the section being built
  // rather than reconstructed afterwards. `SEC` is a moving marker because this
  // file is already written component by component; tagging every call site
  // would be noise. Structure is priced by its own mass; things that are BOUGHT
  // rather than built (engine, wheels, instruments, paint) call spend().
  const ledger = {};
  let SEC = 'fuselage';
  const bill = (mass, cost) => {
    const e = ledger[SEC] || (ledger[SEC] = { mass: 0, cost: 0 });
    e.mass += mass || 0; e.cost += cost || 0;
  };
  const sec = s => { SEC = s; };
  const spend = c => bill(0, c);
  const cover = (area, ids) => {
    const m = area * M.cover;
    const per = m / ids.length;
    for (const i of ids) nodes[i].m += per;
    bill(m, m * M.price);
  };
  const pt = (i, m) => { nodes[i].m += m; bill(m, 0); };

  // ---- 1. fuselage stations ------------------------------------------
  // rings 0..2 are firewall / cabin front / cabin rear; the rest are evenly
  // spaced to the tail. The cabin rings are pinned because the wing spars and
  // the seats attach to them.
  const cab = S.cab, fu = S.fuse;
  const SHP = GEN_SHAPES[fu.shape] || GEN_SHAPES.straight;
  const cabRear = cab.noseGap + cab.len;
  const boxRear = fu.boxRear;                 // cabin + cargo bay: full section
  const xs = [0, cab.noseGap, cabRear];
  if (boxRear > cabRear + 1e-6) xs.push(boxRear);
  for (let i = 1; i <= fu.tailBays; i++)
    xs.push(boxRear + (fu.tailArm - boxRear) * i / fu.tailBays);
  const ST = xs.map(x => {
    if (x <= boxRear) {
      // firewall is slightly narrower and lower than the cabin (cowl line)
      const u = x / Math.max(1e-6, cab.noseGap);
      const f = x < cab.noseGap ? u : 1;
      // ring 0 is the firewall: its top is the COWL DECK, well below the cabin
      // roof, and the step between them is the windscreen (see 63_gen_skin.js)
      const deck = fu.cowlDeck;
      return { x, w: cab.halfW * (0.92 + 0.08 * f), yb: -0.02 * f,
               yt: cab.h * (deck + (1 - deck) * f) };
    }
    // the SHAPE FAMILY is the profile of the aft taper: an exponent on the
    // station fraction, so width, floor and deck all narrow together but on a
    // straight, late (waisted) or early (pod-and-boom) curve. See GEN_SHAPES.
    const t0 = (x - boxRear) / Math.max(1e-6, fu.tailArm - boxRear);
    const t = SHP.taper === 1 ? t0 : Math.pow(t0, SHP.taper);
    return { x, w: cab.halfW + (fu.tailW - cab.halfW) * t,
             yb: -0.02 + (fu.tailBot + 0.02) * t,
             yt: cab.h + (fu.tailTop - cab.h) * t };
  });

  const F = ST.map((s, i) => {
    const [BL, BR] = NM(s.x, s.yb, s.w, `S${i}B`);
    const [TL, TR] = NM(s.x, s.yt, s.w, `S${i}T`);
    // rule 4: every quad panel needs its diagonal — the ring frame gets a
    // mirror-symmetric X so shear cannot fold it into a parallelogram
    B(BL, BR, 'fus'); B(TL, TR, 'fus'); B(BL, TL, 'fus'); B(BR, TR, 'fus');
    B(BL, TR, 'fus'); B(BR, TL, 'fus');
    return { BL, BR, TL, TR };
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1], alt = i % 2;
    B(a.BL, b.BL, 'fus'); B(a.BR, b.BR, 'fus');
    B(a.TL, b.TL, 'fus'); B(a.TR, b.TR, 'fus');
    // side-panel diagonals alternate direction bay to bay (a real welded
    // truss does this so the shear path zig-zags instead of running one way)
    B(alt ? a.BL : a.TL, alt ? b.TL : b.BL, 'fus');
    B(alt ? a.BR : a.TR, alt ? b.TR : b.BR, 'fus');
    B(a.TL, b.TR, 'fus'); B(a.TR, b.TL, 'fus');     // rule 4, top panel
    B(a.BL, b.BR, 'fus'); B(a.BR, b.BL, 'fus');     // rule 4, bottom panel
    // covering, four panels per bay, onto the bay's own corners
    const s0 = ST[i], s1 = ST[i + 1];
    cover(genQuadArea(P, a.TL, a.TR, b.TR, b.TL), [a.TL, a.TR, b.TR, b.TL]);
    cover(genQuadArea(P, a.BL, a.BR, b.BR, b.BL), [a.BL, a.BR, b.BR, b.BL]);
    cover(genQuadArea(P, a.TL, a.BL, b.BL, b.TL), [a.TL, a.BL, b.BL, b.TL]);
    cover(genQuadArea(P, a.TR, a.BR, b.BR, b.TR), [a.TR, a.BR, b.BR, b.TR]);
    void s0; void s1;
  }
  const last = F[F.length - 1], lastST = ST[ST.length - 1];
  // tail post: two centreline nodes. refs.tailMid points here, so rule 8
  // (attitude reference on RIGID structure) is satisfied by construction.
  const TPB = N(fu.postX, lastST.yb + 0.05, 0, 'TPB');
  const TPT = N(fu.postX, lastST.yt - 0.02, 0, 'TPT');
  B(TPB, TPT, 'fus');
  B(last.BL, TPB, 'fus'); B(last.BR, TPB, 'fus');
  B(last.TL, TPT, 'fus'); B(last.TR, TPT, 'fus');
  B(last.TL, TPB, 'fus'); B(last.TR, TPB, 'fus');
  cover(genQuadArea(P, last.TL, last.BL, TPB, TPT)
      + genQuadArea(P, last.TR, last.BR, TPB, TPT), [last.TL, last.TR, TPB, TPT]);

  // ---- 2. engine ------------------------------------------------------
  sec('engines');
  const PP = POWERPLANTS[S.engine];
  const [EL, ER] = NM(S.engX, S.engY, 0.55 * cab.halfW, 'ENG');
  B(EL, ER, 'fus');
  B(EL, F[0].TL, 'fus'); B(EL, F[0].BL, 'fus'); B(EL, F[0].BR, 'fus');
  B(ER, F[0].TR, 'fus'); B(ER, F[0].BR, 'fus'); B(ER, F[0].BL, 'fus');
  // The BLADES weigh what the spec says they weigh (S.prop.mass, derived from
  // diameter, blade count and material) rather than the old 2 kg per metre of
  // registry diameter. It lands on the mount nodes rather than at the hub, which
  // is 0.10 m further forward — worth 3 cm of CG on a 500 kg aeroplane with the
  // heaviest prop the clamps allow, and there is no node out there to hang it on.
  pt(EL, 0.5 * (PP.engine.mass + S.prop.mass));
  pt(ER, 0.5 * (PP.engine.mass + S.prop.mass));
  spend((PP.price || 0) * S.engines.length);
  spend(S.prop.price || 0);

  // ---- 3. wing --------------------------------------------------------
  sec('wings');
  const w = S.wing, G = S.geom;
  const zRoot = cab.halfW;
  // CRANK: a second wing section. The break gets its own spar station, because
  // it is a real joint — the outer panel bolts to the centre section there —
  // and because the dihedral changes across it, so a node has to exist at the
  // kink or the two panels would be joined by a straight member cutting the
  // corner. Only ONE crank: two sections, no more.
  const zCrank = w.crankAt > 0 ? zRoot + (G.semi - zRoot) * w.crankAt : 0;
  const zs = [];
  for (let i = 1; i <= w.panels; i++)
    zs.push(zRoot + (G.semi - zRoot) * i / w.panels);
  if (zCrank > 0) {
    zs.push(zCrank);
    zs.sort((a2, b2) => a2 - b2);
    // a station landing on top of the crank would give a zero-length bay
    for (let i = zs.length - 1; i > 0; i--)
      if (zs[i] - zs[i - 1] < 0.12) zs.splice(zs[i] === zCrank ? i - 1 : i, 1);
  }
  // the planform, tip bow included. One function, so the ribs, the covering,
  // the strips and the outline cannot disagree about where the wing is.
  const linC = z => w.chord * (1 - (1 - w.taper) * (z - zRoot) / Math.max(1e-6, G.semi - zRoot));
  const chordAt = z => {
    if (!(w.tipR > 1e-6) || z <= w.tipZ) return linC(Math.min(z, G.semi));
    const u = Math.min(1, (z - w.tipZ) / w.tipR);
    return w.tipC * Math.sqrt(Math.max(0, 1 - u * u));
  };
  const sparFront = R.sparFront, sparRear = R.sparRear;
  const sparSpacing = (sparRear - sparFront) * w.chord;
  const xF = w.xLE + sparFront * w.chord, xR = w.xLE + sparRear * w.chord;
  // SWEEP: both spars walk aft with span. Measured from the root, so the root
  // rib, the strut anchor and the carry-through all stay exactly where they
  // were and only the outboard structure moves — which is what lets sweep be a
  // balance knob rather than a redesign.
  const swpT = Math.tan((w.sweep || 0) * D);
  const xFat = z => xF + (z - zRoot) * swpT;
  const xRat = z => xR + (z - zRoot) * swpT;
  const dih = Math.tan(w.dihedral * D);
  const incAt = z => (w.incidence - w.washout * (z - zRoot) / Math.max(1e-6, G.semi - zRoot)) * D;
  // WHERE THE WING MEETS THE FUSELAGE. High sits on the top longerons, low
  // under the floor, mid through the cabin. `attach` is which longeron pair
  // carries it and `oppose` is the one the strut or the depth tie reaches to —
  // the strut on a low wing goes UP, not down.
  const POS = { high: 1, mid: 0.5, low: 0 }[w.position] ?? 1;
  const wingY0 = cab.h * POS
    + R.wingStandoff * (POS >= 0.75 ? 1 : POS <= 0.25 ? -1 : 0);
  const attachHi = POS >= 0.5, attachTag = attachHi ? 'T' : 'B';
  const opposeTag = attachHi ? 'B' : 'T';
  // a strut is only a brace if its anchor is far enough from the wing — see
  // GEN_RULES.strutMinOffset. Otherwise build the box instead.
  const strutOffset = Math.abs(wingY0 - (attachHi ? 0 : cab.h));
  // A CRANKED WING CANNOT BE STRUT-BRACED either, for the same reason and with
  // the same cure (2026-08-11, GATE FLEX matrix). A crank INSERTS a spar
  // station, so the fan leaves the outer panel unbraced exactly as panels 4-5
  // did — measured, the jodel-crank preset read 22.95 deg @200 N.m at a
  // doubling ratio of 1.34x, the WORST corner in the whole configuration space
  // and worse than panels 5 ever was. And it cannot be cured by extending the
  // fan: a stiff member from the pod bottom to a station 14 deg up the outer
  // panel re-rigs the aeroelastics of nodes that carry strip force (rule 10),
  // and the aeroplane stopped completing a circuit.
  // The outer panel of a cranked wing wants a box, which is what the real
  // aeroplane this planform comes from actually has — the Jodel fiche is a
  // cantilever. Substituted, it measures 2.76 / 5.39 at 1.95x and flies.
  // Same shape of rule as strutMinOffset, and visible the same way: the panel
  // reports `bracing: cantilever box` so the substitution is never silent.
  const useStrut = w.strut && strutOffset >= R.strutMinOffset && !(w.crankAt > 0);
  // dihedral is piecewise across the crank: flat (or shallow) inboard, steeper
  // outboard. Without a crank both halves use the same angle and this is the
  // straight line it always was.
  const dihOut = Math.tan((w.dihedralOut == null ? w.dihedral : w.dihedralOut) * D);
  const yF = z => {
    const base = wingY0 + S.place.wingDy;
    if (zCrank <= 0 || z <= zCrank) return base + (z - zRoot) * dih;
    return base + (zCrank - zRoot) * dih + (z - zCrank) * dihOut;
  };
  // which frames straddle a given station, so a component that moves finds new
  // ones to attach to instead of dragging its old ones along
  const straddle = x => {
    let f = 0;
    for (let i = 0; i < ST.length; i++) if (ST[i].x < x - 0.05) f = i;
    let a = Math.min(F.length - 1, f + 1);
    for (let i = 0; i < ST.length; i++) if (ST[i].x > x + 0.05) { a = i; break; }
    return [f, Math.max(a, Math.min(f + 1, F.length - 1))];
  };
  const nearestRing = x => {
    let best = 0, bd = 1e9;
    ST.forEach((s, i) => { const d = Math.abs(s.x - x); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const wf = { L: null, R: null };
  const mkWing = (s) => {
    // The wing owns its spar roots. They USED to be two fuselage frame nodes,
    // which is why the wing could not move: shifting it aft left the root on
    // the old frame while the outboard stations walked away from it. Now the
    // roots are the wing's own, and the loads go into the fuselage through a
    // carry-through that re-attaches to whichever frames straddle them.
    const rootF = N(xF, yF(zRoot), s * zRoot, 'WF');
    const rootR = N(xR, yF(zRoot) - sparSpacing * Math.tan(incAt(zRoot)), s * zRoot, 'WR');
    B(rootF, rootR, 'wing');                             // root rib
    // the strut braces from the longeron OPPOSITE the wing: down from a high
    // wing, up from a low one. Rule 1's barrier is the offset, not the direction
    const sd = s > 0 ? 'R' : 'L';
    const strutRoot = F[nearestRing(xF)][opposeTag + sd];
    const side = attachTag + sd, other = attachTag + (s > 0 ? 'L' : 'R');
    // rule 3, box depth through the root: front and rear spars land on
    // DIFFERENT frames wherever the geometry allows, so the biggest moment in
    // the aeroplane has a couple arm instead of passing through a point.
    // The NEAREST frame matters as much as the straddling pair. straddle()
    // has a dead band, so a root sitting almost exactly over a frame gets the
    // two frames either SIDE of it and no direct tie to the one underneath —
    // the wing then hangs on long diagonals, is soft in torsion, and folds
    // through under full-deflection abuse at ~1% strain. That is rule 1's
    // snap-through, and it cost a red STRESS gate to find.
    const lo = opposeTag + sd;
    for (const [nd, x] of [[rootF, xF], [rootR, xR]]) {
      const [iA, iB] = straddle(x), iN = nearestRing(x);
      for (const i of [...new Set([iN, iA, iB])]) B(nd, F[i][side], 'wing');
      B(nd, F[iN][lo], 'wing');                          // full depth: rule 3
      B(nd, F[iN][other], 'wing');                       // lateral shear path
    }
    const WF = zs.map(z => N(xFat(z), yF(z), s * z, 'WF'));
    const WR = zs.map(z => N(xRat(z), yF(z) - sparSpacing * Math.tan(incAt(z)), s * z, 'WR'));
    const cF = [rootF, ...WF], cR = [rootR, ...WR];
    for (let i = 0; i < zs.length; i++) {
      B(cF[i], cF[i + 1], 'wing'); B(cR[i], cR[i + 1], 'wing');
      B(cF[i + 1], cR[i + 1], 'wing');                       // rib
      // rule 4 again: the wing plan bay is a quad and gets its diagonals
      B(cF[i], cR[i + 1], 'wing'); B(cR[i], cF[i + 1], 'wing');
      const zi = i === 0 ? zRoot : zs[i - 1], zo = zs[i];
      cover(1.9 * (zo - zi) * 0.5 * (chordAt(zi) + chordAt(zo)),
            [cF[i], cF[i + 1], cR[i], cR[i + 1]]);
      // ribs: one every 0.4 m of span, spruce/ply, hung on the two spars
      const nRib = Math.max(1, Math.round((zo - zi) / 0.4));
      const ribM = nRib * 0.5 * (chordAt(zi) + chordAt(zo)) * 0.30;
      pt(cF[i + 1], 0.5 * ribM); pt(cR[i + 1], 0.5 * ribM);
    }
    let cFB = null, cRB = null;
    sec('bracing');
    if (useStrut) {
      // rule 1: SPAR BOX ALWAYS. This wing has no full-depth box, so the
      // barrier against snap-through fold is the strut anchor a full cabin
      // height below the wing — the Cub geometry, and the only reason a
      // planar two-spar wing survives at all.
      // The two members to the mid station are the REAL lift struts and are
      // the only ones drawn; the rest of the fan is the lumped stand-in for a
      // spar box this planar wing does not have, so it lives under the fabric.
      const mid = WF.length > 1 ? 1 : 0;
      B(strutRoot, WF[mid], 'wing', true);
      B(strutRoot, WR[mid], 'wing', true);
      for (const t of [WF[0], WR[0], WF[WF.length-1], WR[WR.length-1]])
        B(strutRoot, t, 'wing');
      // ...AND EVERY STATION IN BETWEEN (2026-08-11, GATE FLEX matrix).
      // The four lines above reach exactly three stations: 0, mid=1 and the
      // last. `wing.panels` is a PLAYER SLIDER clamped 2..5, so at 4 panels the
      // fan skips station 2 and at 5 panels it skips 2 AND 3 — those stations
      // hang between fan members on a planar two-spar wing with no box, which
      // is rule 1 with the barrier removed. Measured (static antisymmetric tip
      // couple, deg @200 N.m / doubling ratio, span 13 chord 1.6):
      //     panels 2   2.38   1.98x      panels 4   21.41   *** 1.56x
      //     panels 3   3.84   1.97x      panels 5   28.73   *** 1.46x
      // A doubling ratio under 2 means it stiffened geometrically on the way,
      // i.e. it started near a MECHANISM — and the rank test cannot see it,
      // because the framework is infinitesimally rigid the whole time. This is
      // the chinook wing's defect exactly (16.4 deg at 1.50x, cured the same
      // way), and it was reachable from the panel by moving one slider.
      // Appended rather than folded into the loop above so the emission ORDER
      // of the existing members is untouched: at panels <= 3 this adds nothing
      // and the whole battery stays bit-identical.
      // Known, left alone: at panels 2, `mid` and `WF.length-1` are the SAME
      // station, so those four lines emit that pair twice — a duplicated beam
      // is double stiffness. It measures linear and stiff, and unpicking it
      // would move panels-2 geometry in a commit about panels 4 and 5.
      // INBOARD OF THE CRANK ONLY. A lift strut reaches the straight inner
      // panel; it does not climb the outer panel of a cranked wing, and
      // pretending otherwise is not a modelling shortcut but a different
      // aeroplane. Measured: the jodel-crank preset (crankAt 0.45, dihedralOut
      // 14) flew a circuit before this block and did NOT after, because a stiff
      // member from the pod bottom to a station 14 deg up the outer panel
      // re-rigs the aeroelastics of nodes that carry strip force — rule 10's
      // "wires that anchor to strip-force-carrying nodes re-rig the
      // aeroelastics". zCrank is 0 when there is no crank, so a straight wing
      // gets every interior station, which is the case this block exists for.
      for (let i = 2; i < WF.length - 1; i++) {
        if (zCrank && zs[i] > zCrank + 1e-9) continue;
        B(strutRoot, WF[i], 'wing'); B(strutRoot, WR[i], 'wing');
      }
    } else {
      // CANTILEVER: no strut, so rule 1 has to be paid for properly — a real
      // full-depth two-spar torsion box. Lower caps under both spars at every
      // station, webs, ribs and shear diagonals on all four faces. This is the
      // Jodel's construction; without it a planar fan folds (the drone did).
      // STRUCTURAL chord, not the aerodynamic outline. The tip bow is a light
      // fairing outboard of the spar box; the box itself does not taper to
      // nothing just because the planform is rounded. Using chordAt here drove
      // the box depth to zero at the tip and put a ZERO-LENGTH beam between the
      // upper and lower caps — the strain = Infinity trap from G2.3d, which
      // rule 1 says to remove geometrically rather than guard against.
      const depth = z => R.sparBoxDepth * linC(z);
      const zAll = [zRoot, ...zs];
      const mkLower = (up, z, dx) => N(dx, nodes[up].p[1] - depth(z), s * z, 'WB');
      cFB = []; cRB = [];
      for (let i = 0; i < zAll.length; i++) {
        const z = zAll[i];
        cFB.push(mkLower(cF[i], z, xFat(z)));
        cRB.push(mkLower(cR[i], z, xRat(z)));
        // station cell: webs down from each cap, lower rib, and its diagonals
        B(cF[i], cFB[i], 'wing'); B(cR[i], cRB[i], 'wing');
        B(cFB[i], cRB[i], 'wing');
        B(cF[i], cRB[i], 'wing'); B(cR[i], cFB[i], 'wing');
      }
      for (let i = 0; i < zs.length; i++) {
        B(cFB[i], cFB[i+1], 'wing'); B(cRB[i], cRB[i+1], 'wing');   // lower caps
        B(cFB[i], cRB[i+1], 'wing'); B(cRB[i], cFB[i+1], 'wing');   // lower plan
        B(cF[i], cFB[i+1], 'wing'); B(cFB[i], cF[i+1], 'wing');     // front web
        B(cR[i], cRB[i+1], 'wing'); B(cRB[i], cR[i+1], 'wing');     // rear web
      }
      // and the box has to carry through the fuselage too, or the whole
      // bending moment still arrives at a point (rule 3)
      const [iA] = straddle(xF), iN = nearestRing(xF);
      for (const i of [...new Set([iN, iA])]) {
        B(cFB[0], F[i][lo], 'wing'); B(cRB[0], F[i][lo], 'wing');
      }
    }
    sec('wings');
    wf[s > 0 ? 'R' : 'L'] = { F: cF, R: cR, FB: cFB, RB: cRB, strutRoot };
  };
  mkWing(+1); mkWing(-1);
  // carry-through: the two spars run across the top of the cabin as one piece,
  // diagonals per rule 4. This is what makes the wing a wing rather than two
  // half-wings bolted to a fuselage.
  B(wf.L.F[0], wf.R.F[0], 'wing'); B(wf.L.R[0], wf.R.R[0], 'wing');
  B(wf.L.F[0], wf.R.R[0], 'wing'); B(wf.R.F[0], wf.L.R[0], 'wing');
  if (wf.L.FB) {
    // a cantilever box that stops at the fuselage side is two half-boxes: the
    // lower caps have to run across as well, with their own shear diagonals
    B(wf.L.FB[0], wf.R.FB[0], 'wing'); B(wf.L.RB[0], wf.R.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.RB[0], 'wing'); B(wf.R.FB[0], wf.L.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.F[0], 'wing'); B(wf.R.FB[0], wf.L.F[0], 'wing');
  }
  cover(1.9 * 2 * zRoot * w.chord, [wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0]]);

  // ---- 4. empennage ---------------------------------------------------
  sec('tail');
  const t = S.tail;
  // A V-tail's panel tips ride UP as well as out. They keep the HTL/HTR tags —
  // they really are the tail tips, and the shadow proxy, the skin binding and
  // the gate harness all key off those names — so only their position changes
  // and there is simply no FIN node to build.
  const isV = t.type === 'v';
  const tailY = lastST.yb + 0.55 * (lastST.yt - lastST.yb);
  // STAB HEIGHT. 0 leaves it on the tail cone where it has always been; 1 puts
  // it level with the fin tip, which is a T-tail. Y only — `hX` is the tail arm
  // and is the builder's, so riding up the fin does not silently re-tune pitch.
  const finTopY = lastST.yt + t.vHeight * 0.82;
  const stabY = isV ? tailY + t.vHeight
                    : tailY + (t.stabH || 0) * (finTopY - tailY);
  const [HTL, HTR] = NM(t.hX, stabY, 0.5 * t.hSpan, 'HT');
  for (const [H, side] of [[HTL, 'L'], [HTR, 'R']]) {
    B(H, TPB, 'fus'); B(H, TPT, 'fus');
    B(H, side === 'L' ? last.BL : last.BR, 'fus');
    B(H, side === 'L' ? last.TL : last.TR, 'fus');
  }
  let FIN = null;
  if (isV) {
    cover(1.9 * t.Svt, [HTL, HTR, TPB, TPT]);
  } else {
    cover(1.9 * t.Sh, [HTL, HTR, TPB, TPT]);
    // the fin's apex node follows the RAKE, so the truss leans with the fin the
    // skin draws instead of standing upright inside a swept one
    FIN = N(t.vX + Math.tan((t.vSweep || 0) * Math.PI / 180) * t.vHeight * 0.82,
            finTopY, 0, 'FIN');
    B(FIN, TPT, 'fus'); B(FIN, last.TL, 'fus'); B(FIN, last.TR, 'fus');
    cover(1.9 * t.Sv, [FIN, TPT, last.TL, last.TR]);
  }

  // ---- 5. gear --------------------------------------------------------
  sec('gear');
  spend(2 * GEN_PRICES.wheel + GEN_PRICES.thirdWheel + (ARCH.price || 0));
  const gy = S.gear.y;
  const gx = gearX !== null && gearX !== undefined ? gearX : cab.noseGap * 0.9;
  const tr = track !== null && track !== undefined ? track : 5 * cab.halfW;
  // CAMBER: the node's radius is what the solver contacts the ground on, and a
  // leaning wheel touches R*cos(camber) below its axle. Resolved once, on the
  // spec, so the mesh and the clearance rules cannot disagree with the physics.
  const [GAL, GAR] = NM(gx, gy, 0.5 * tr, 'AXLE', S.gear.contactR);
  B(GAL, GAR, 'gear');
  // Rule 7: the gear needs a LONGITUDINAL (drag) load path anchored well fore
  // AND aft of the axle, into HEAVY nodes. The anchors used to be hard-coded to
  // rings 0 and 1 — but the axle position is DERIVED, and when it landed aft of
  // ring 1 both anchors ended up forward of it, so nothing resisted the axle
  // swinging back and the gear folded (measured on a light engine, which pushes
  // the CG and therefore the axle aft). Pick the frames that straddle it.
  const iFwd = (() => { let r = 0; for (let i = 0; i < ST.length; i++) if (ST[i].x < gx - 0.10) r = i; return r; })();
  const iAft = (() => {
    for (let i = 0; i < ST.length; i++) if (ST[i].x > gx + 0.10) return i;
    return Math.min(F.length - 1, iFwd + 1);
  })();
  // If the axle sits ahead of EVERY frame (a heavy engine drags the CG, and the
  // rake rule then drags the axle, out past the firewall) there is nothing
  // forward to brace against. Hang the forward leg off the ENGINE MOUNT, which
  // is what a real aeroplane does when the gear lives that far forward — and
  // which keeps rule 7's "into HEAVY nodes" satisfied.
  const aheadOfAll = ST[0].x > gx + 0.10;
  const fwdL = aheadOfAll ? EL : F[iFwd].BL, fwdR = aheadOfAll ? ER : F[iFwd].BR;
  const AA = F[Math.max(iAft, aheadOfAll ? 0 : Math.min(iFwd + 1, F.length - 1))];
  // What each of those six members IS, now that `vis` can say so. The forward
  // pair is the SUSPENSION LEG — bungee cord, spring steel or oleo, drawn as
  // whichever the spec bought. The same-side aft pair is the drag brace, a
  // tube, which is what it is on any aeroplane. The two CROSS members run from
  // one axle end to the other side's frame, under the belly: as 48 mm tubes
  // they made the undercarriage read as a cage, and an X of bracing wires under
  // the belly is both what a tube-and-fabric aeroplane actually has and the
  // same load path. Nothing here changes k, c or mass.
  B(GAL, fwdL, 'gear', false, 'leg'); B(GAL, AA.BL, 'gear');
  B(GAL, fwdR, 'gear', false, 'wire');
  B(GAR, fwdR, 'gear', false, 'leg'); B(GAR, AA.BR, 'gear');
  B(GAR, fwdL, 'gear', false, 'wire');
  pt(GAL, 3.5); pt(GAR, 3.5);                          // wheels, tyres, brakes

  // The third wheel. `refs.tw` is whichever it is — the solver steers that node
  // and the sign of twSteer says which end it lives at.
  const trike = S.gear.type === 'tricycle';
  let TW, twX, twY;
  if (trike) {
    // NOSEWHEEL, forward under the engine bay, at a height that leaves the
    // aeroplane essentially level (a touch nose-up, the way a real trike sits).
    twX = S.gear.twX !== null && S.gear.twX !== undefined
      ? S.gear.twX : Math.min(-0.05, S.engX * 0.45);
    // Sign: rotating the body so BOTH contacts reach the ground gives
    // tan(deck) = (y_third - y_main) / (x_third - x_main). The nosewheel is
    // AHEAD, so the denominator is negative and a nose-UP rest attitude needs
    // its contact BELOW the mains — the opposite of a tailwheel. Getting this
    // backwards stood the aeroplane on its nose at "deck 178.8 deg".
    // SPLIT HEIGHT: given a nose LEG LENGTH the attitude falls out of it, the
    // way the tailwheel's always has. Left null, trikeDeck still works
    // backwards from the attitude and every existing number is unchanged.
    twY = S.gear.twY !== null && S.gear.twY !== undefined
      ? S.gear.twY
      : (S.gear.twLeg !== null && S.gear.twLeg !== undefined
         ? -0.02 - S.gear.twLeg
         : (gy - S.gear.contactR) + S.gear.twR
           - Math.tan(R.trikeDeck * D) * (gx - twX));
    TW = N(twX, twY, 0, 'TW', S.gear.twR);
    // it hangs off the firewall frame and the engine mount — the heavy nodes
    // at that end of the aeroplane (rule 7), with a fore-and-aft path.
    // A real nose gear is one strut and a drag link, so the firewall pair is
    // the leg and the other four are links.
    B(TW, F[0].BL, 'gear', false, 'leg'); B(TW, F[0].BR, 'gear', false, 'leg');
    B(TW, EL, 'gear', false, 'wire'); B(TW, ER, 'gear', false, 'wire');
    B(TW, F[Math.min(1, F.length-1)].BL, 'gear', false, 'wire');
    B(TW, F[Math.min(1, F.length-1)].BR, 'gear', false, 'wire');
    pt(TW, 3.0);
  } else {
    twX = S.gear.twX !== null && S.gear.twX !== undefined
      ? S.gear.twX : fu.postX - 0.10;
    // the tailwheel hangs off the tailpost foot by its leg length; the
    // three-point attitude is whatever that geometry produces (spec twLeg,
    // defaulting to GEN_RULES.twLeg)
    twY = S.gear.twY !== null && S.gear.twY !== undefined
      ? S.gear.twY : nodes[TPB].p[1]
        - (S.gear.twLeg !== null && S.gear.twLeg !== undefined ? S.gear.twLeg : R.twLeg);
    TW = N(twX, twY, 0, 'TW', S.gear.twR);
    // Six members, and on a real tailwheel exactly one of them is hardware you
    // can see: the spring the wheel hangs on. Report: "too many struts, no
    // spring". So the tailpost member IS the spring/oleo, the pair to the last
    // frame and the pair up to the stabiliser are bracing WIRES (which is what
    // the rule-10 pyramid has always been called in this file), and the
    // near-vertical snap-blocker is declared INTERNAL — it runs from below the
    // tailwheel to the TOP of the tailpost, i.e. straight up through the
    // fuselage, so under the covering it should not be there at all. It still
    // stands in Frame mode and still carries exactly the same load.
    B(TW, TPB, 'gear', false, 'leg');
    B(TW, last.BL, 'gear', false, 'wire'); B(TW, last.BR, 'gear', false, 'wire');
    // rule 10: a near-axial chain LATCHES with every strain under 1%, and no
    // strain gate can see it. Both cures the Cub needed are mandatory here:
    // a snap-blocking near-vertical member, AND a wide lateral pyramid.
    B(TW, TPT, 'gear', false, 'inner');
    B(TW, HTL, 'gear', false, 'wire'); B(TW, HTR, 'gear', false, 'wire');
    pt(TW, 2.0);
  }

  // ---- 6. payload, fuel, systems --------------------------------------
  // tandem: pilot in the FRONT seat first (a J-3 is soloed from the rear, but
  // that is a CG choice the player can make by moving the seat, not a default)
  sec('cabin');
  spend(S.seats * GEN_PRICES.seat);
  const seatRings = S.seating === 'tandem2' ? [F[1], F[2]] : [F[1], F[1]];
  for (let i = 0; i < S.crew; i++) {
    const rg = seatRings[i] || F[1];
    pt(rg.BL, 40); pt(rg.BR, 40);
  }
  sec('fuel');
  const fuelM = S.fuelL * 0.72;
  // WHERE the fuel sits. Nose is the Cub's — ahead of the panel, and it moves
  // the CG forward. Wing-root hangs it on the spar carry-through. Outboard puts
  // it in the panel, which relieves the wing in flight and slows the roll,
  // because the tanks are the heaviest thing you can put out there.
  const tankL = S.fuel.tank === 'wing' ? wf.L.F[0]
              : S.fuel.tank === 'panel' ? wf.L.F[Math.min(1, wf.L.F.length - 1)]
              : F[0].TL;
  const tankR = S.fuel.tank === 'wing' ? wf.R.F[0]
              : S.fuel.tank === 'panel' ? wf.R.F[Math.min(1, wf.R.F.length - 1)]
              : F[0].TR;
  pt(tankL, 0.5 * fuelM); pt(tankR, 0.5 * fuelM);
  sec('systems');
  const SYS = GEN_SYSTEMS[S.systems.fit] || GEN_SYSTEMS.basic;
  spend(SYS.price);
  pt(F[0].TL, 0.5 * SYS.mass); pt(F[0].TR, 0.5 * SYS.mass);   // panel + systems
  sec('paint');
  spend(GEN_PRICES.paintJob);
  sec('cargo');
  // Freight goes in the cargo bay if there is one, otherwise on the baggage
  // frame with everything else — which is the point of building the bay: it
  // puts the load where you chose rather than wherever it fits.
  const load = S.baggage + S.cargoKg;
  if (fu.cargoLen > 1e-6) {
    // the bay spans frames 2 (cabin rear) and 3 (its own aft bulkhead); spread
    // the freight across both so it sits IN the bay rather than on one end
    for (const rg of [F[2], F[3]]) { pt(rg.BL, 0.25 * load); pt(rg.BR, 0.25 * load); }
  } else {
    const bag = F[Math.min(3, F.length - 1)];
    pt(bag.BL, 0.5 * load); pt(bag.BR, 0.5 * load);
  }

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [TPB, TPT],
    upLo: [F[0].BL, F[0].BR], upHi: [F[0].TL, F[0].TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[F.length-2].BL, F[F.length-2].BR, F[F.length-2].TL, F[F.length-2].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const parts = {
    ST, F, TPB, TPT, EL, ER, HTL, HTR, FIN, GAL, GAR, TW,
    wf, zs, zRoot, zCrank, xF, xR, xFat, xRat, sparFront, sparRear, sparSpacing,
    chordAt, yF, incAt, cabRear, gx, tr, twX, twY,
    bracing: useStrut ? 'strut' : 'cantilever box', strutOffset, trike,
    ledger,
    gearAnchors: [iFwd, iAft], kScale: KS, kGear: KG,
  };
  return { nodes, beams, refs, parts };
}

function genLatticeCG(nodes) {
  let x = 0, y = 0, z = 0, m = 0;
  for (const n of nodes) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; m += n.m; }
  return [x/m, y/m, z/m, m];
}

// Two fixed passes: the first sizes the aeroplane, the second places the main
// gear against the CG it produced. Fixed count, so generation stays
// deterministic (GATE GEN byte-compares a double-generate).
function genFrame(S) {
  const R = GEN_RULES, D = Math.PI / 180;
  const M = GEN_MATERIALS[S.material];
  const a = genLattice(S, S.gear.x, S.gear.track);
  const cg = genLatticeCG(a.nodes);
  // structure sized for the mass the first pass produced. Sub-linear: a bigger
  // aeroplane is not stiffer in proportion, and clamped so a foam trainer does
  // not end up with rubber tube nor a radial with an unbreakable one.
  const kScale = Math.min(4, Math.max(0.45,
    Math.pow(cg[3] / (M.refMass || 390), 0.85)));
  const gy = S.gear.y;
  // main axle rake: forward of the CG by gearRake degrees off vertical. Too
  // little and it noses over on the brakes; too much and it will not fly the
  // tail up. Track from the CG height, against ground-loop divergence.
  // The placement rule INVERTS with the gear type. A taildragger puts the mains
  // ahead of the CG so it rests on its tail; a tricycle puts them BEHIND, and
  // the design quantity is what fraction of the weight the nosewheel then
  // carries (real practice ~8-15%). Solving for that directly is clearer than
  // an angle: x_main = (x_cg - f*x_nose) / (1 - f).
  const trikeGear = S.gear.type === 'tricycle';
  const autoGx = trikeGear
    ? (() => {
        const xNose = Math.min(-0.05, S.engX * 0.45);
        return (cg[0] - R.noseLoad * xNose) / (1 - R.noseLoad);
      })()
    : cg[0] - Math.tan(R.gearRake * D) * (cg[1] - gy);
  const gx = (S.gear.x !== null && S.gear.x !== undefined ? S.gear.x : autoGx)
             + S.place.gearDx;
  const tr = Math.max(0.5, (S.gear.track !== null && S.gear.track !== undefined
    ? S.gear.track : R.trackRatio * (cg[1] - (gy - S.gear.contactR))) + S.place.gearDtrack);
  const out = genLattice(S, gx, tr, kScale);
  out.cg0 = genLatticeCG(out.nodes);
  return out;
}
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
// ============================================================
// GARAGE 4/5 — the SKIN. The same lattice, covered.
//
// The frame IS the surface. Every skin vertex is an affine blend of the truss
// nodes it sits on (weights summing to 1), so the covering follows the
// structure exactly and there is nothing to calibrate: SKIN_CFG's measured
// mount offset, which every imported model needs, is [0,0,0] here by
// construction. It also gets fuselage flex for free — SKIN-PROC.md §6 lists
// that as deferred for imported skins, because binding a foreign mesh to a
// truss is the hard part. Generating the mesh from the truss makes it trivial.
//
// The one thing a bare truss cannot do is a round cowl or a turtledeck: its
// faces are flat. The fix is the real construction technique — light
// non-structural FORMERS over the load-carrying frame. `crown` blends each
// station's section from the bare truss rectangle (0) to a rounded former
// outline (1). Formers carry no load and no mass in the solver; their vertices
// are still affine on the same four corner nodes, so they flex with the frame.
//
// Output is the shape decodeModel() returns, so src/viewer/app.js builds it
// with the code path it already has.
// ============================================================

// how far inside the covering the liner sits. Big enough that no pair of faces
// z-fights at any camera distance, small enough that the wall never reads as a
// thickness: 18 mm on an aeroplane whose fuselage is a metre across.
const INTR_T = 0.018;
const GEN_TUBE_R = { fus: 0.016, wing: 0.020, gear: 0.024 };
// FUSELAGE SECTION RESOLUTION. 40, not 20, because the cabin opening's sill is
// a RING INDEX — `round(sill * GEN_RADIAL / 2)` — so this constant is also the
// number of sill positions the slider can reach and how finely the cut can
// follow the deck. At 20 the canopy's lower edge steps visibly. It is the main
// driver of the triangle count; see the perf note in HANDOVER.
const GEN_RADIAL = 40;
// Wheel resolution, around. 18 read as a dodecagon from a metre away — a wheel
// is the one part of this aeroplane whose silhouette is a circle and the eye
// knows it. 24 costs 684 more triangles across three wheels.
const GEN_WHEEL_SEG = 24;
// Where the cowl's lofted cover stops in its own sheet. Above it is the flat
// nose face, mapped as a rim strip (see the cowl block).
const GEN_COWL_V = 0.88;

// STREAMLINE SECTION for the external lift struts. A real lift strut is a
// streamline tube — ~3.5:1 fineness, chord fore-and-aft — and a round bar in
// its place is the most model-kit thing on a strut-braced aeroplane: it has no
// direction, so it reads as scaffolding rather than as structure.
// Closed loop, TE -> upper -> LE -> lower; chord fraction and half-thickness.
const GEN_STRUT_SECT = [
  [1.00,  0.000], [0.86,  0.036], [0.72,  0.068], [0.57,  0.094],
  [0.42,  0.111], [0.29,  0.118], [0.18,  0.111], [0.10,  0.092],
  [0.04,  0.059], [0.00,  0.000],
  [0.04, -0.059], [0.10, -0.092], [0.18, -0.111], [0.29, -0.118],
  [0.42, -0.111], [0.57, -0.094], [0.72, -0.068], [0.86, -0.036],
];
// NOTE: the design session also carried a GEN_SPIN_SECT and a rebuilt propeller.
// That work was dismissed, and the propeller here is the trunk's — which is not
// decoration: `prop` is a top-level spec group whose disc area drives static
// thrust and propwash and whose blades weigh something at the very front. Do NOT
// restore the propeller from the session bundle's `gen/orig/`; orig predates the
// trunk's rebuild, and taking it would silently delete it.

// A WHEEL IS A REVOLVED PROFILE, not a cylinder with two flat lids. Fractions
// of the wheel radius and of the half-width, walked from one bead round to the
// other. The widest point is at 84% of the radius because an aviation tyre is
// fat and round-shouldered; the flat-sided cylinder these replace was most of
// the "wheel meshes are ugly" report.
// The bead sits at 42% of the radius because that is where an aviation tyre's
// rim is: an 8.00-6 is a 6 inch rim inside a 16 inch tyre. Drawn first at 55%
// and the wheel came out as a pale disc with a band of rubber round it.
const GEN_TYRE_SECT = [
  [0.42, -0.44], [0.62, -0.86], [0.80, -1.00], [0.92, -0.90],
  [0.99, -0.58], [1.00, -0.20], [1.00,  0.20], [0.99,  0.58],
  [0.92,  0.90], [0.80,  1.00], [0.62,  0.86], [0.42,  0.44],
];
// The wheel under it: hub cap, dished disc, and the rim barrel the beads sit
// on. Its flange point IS the tyre's bead point, so the two meet exactly and
// there is no gap to close. Deliberately axisymmetric — no bolt heads, no
// spokes — because nothing spins the wheel and a bolt circle that never moves
// is worse than none.
const GEN_HUB_SECT = [
  [0.00, -0.26], [0.10, -0.26], [0.17, -0.23], [0.30, -0.26], [0.42, -0.44],
  [0.42,  0.44], [0.30,  0.26], [0.17,  0.23], [0.10,  0.26], [0.00,  0.26],
];
const GEN_LSEG = 4;             // lengthwise slices per fuselage bay
const GEN_WSEG = 2;             // spanwise slices per wing bay
const GEN_AF = 22;              // airfoil points per surface

// ---- mesh accumulator ------------------------------------------------------
// infl: [[nodeIndex, weight], ...], at most GEN_INFL entries, weights sum to 1.
// 8, because a section between two frames blends both frames' four corners.
const GEN_INFL = 8;
function genMesh() {
  return {
    pos: [], uv: [], sid: [], idx: [], wi: [], ww: [],
    v(p, u, vv, infl, sidv) {
      this.pos.push(p[0], p[1], p[2]);
      this.uv.push(u, vv);
      this.sid.push(sidv || 0);
      for (let k = 0; k < GEN_INFL; k++) {
        const e = infl[k];
        this.wi.push(e ? e[0] : (infl[0] ? infl[0][0] : 0));
        this.ww.push(e ? e[1] : 0);
      }
      return this.pos.length / 3 - 1;
    },
    tri(a, b, c) { this.idx.push(a, b, c); },
    quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); },
    done() {
      const nv = this.pos.length / 3;
      return {
        nv, nt: this.idx.length / 3,
        pos: Float32Array.from(this.pos), uv: Float32Array.from(this.uv),
        idx: nv > 65535 ? Uint32Array.from(this.idx) : Uint16Array.from(this.idx),
        sid: Uint8Array.from(this.sid),
        wi: Int32Array.from(this.wi), ww: Float32Array.from(this.ww),
      };
    },
  };
}

// One paint texture serves the whole aeroplane, so the UV space is split into
// two zones: BODY takes v 0.03..0.47 (u = angle around the section, v = station
// along the body) and PANEL takes v 0.53..0.97 (u = chord fraction, v = span).
// A stripe drawn across u therefore runs fore-and-aft on the fuselage and
// spanwise on the wing, which is what both want.
const genUVBody = t => 0.03 + 0.44 * Math.max(0, Math.min(1, t));
const genUVPanel = t => 0.53 + 0.44 * Math.max(0, Math.min(1, t));

const genV3 = {
  sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  mul: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
  cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  norm: a => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/L, a[1]/L, a[2]/L]; },
};

// Rest body frame, computed with the same formula the solver's bodyAxes() uses
// so the generated skin lands in exactly the frame poseModel() will pose it in.
function genRestFrame(def) {
  const N = def.nodes, R = def.refs;
  const avg = ids => {
    const o = [0, 0, 0];
    for (const i of ids) { o[0] += N[i].p[0]; o[1] += N[i].p[1]; o[2] += N[i].p[2]; }
    return genV3.mul(o, 1 / ids.length);
  };
  const xA = genV3.norm(genV3.sub(avg(R.tailMid), avg(R.noseFrame)));
  let yU = genV3.norm(genV3.sub(avg(R.upHi), avg(R.upLo)));
  const zL = genV3.norm(genV3.cross(xA, yU));
  yU = genV3.norm(genV3.cross(zL, xA));
  let x = 0, y = 0, z = 0, m = 0;
  for (const n of N) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; m += n.m; }
  const cg = [x/m, y/m, z/m];
  return { cg, xA, yU, zL,
    // world point -> body coordinates
    to(p) {
      const d = genV3.sub(p, cg);
      return [d[0]*xA[0]+d[1]*xA[1]+d[2]*xA[2],
              d[0]*yU[0]+d[1]*yU[1]+d[2]*yU[2],
              d[0]*zL[0]+d[1]*zL[1]+d[2]*zL[2]];
    } };
}

// NACA 4-digit section. Returns closed contour, TE -> upper -> LE -> lower -> TE,
// in (chordFrac, thicknessFrac) with cosine spacing so the nose is resolved.
function genAirfoil(naca) {
  const { m, p, t } = nacaParts(naca);
  const yc = x => x <= p ? (m/(p*p))*(2*p*x - x*x) : (m/((1-p)*(1-p)))*((1-2*p) + 2*p*x - x*x);
  const dyc = x => x <= p ? (2*m/(p*p))*(p - x) : (2*m/((1-p)*(1-p)))*(p - x);
  const yt = x => 5*t*(0.2969*Math.sqrt(x) - 0.1260*x - 0.3516*x*x + 0.2843*x*x*x - 0.1015*x*x*x*x);
  const up = [], lo = [];
  for (let i = 0; i <= GEN_AF; i++) {
    const x = 0.5 * (1 - Math.cos(Math.PI * i / GEN_AF));
    const th = Math.atan(dyc(x)), s = Math.sin(th), c = Math.cos(th), T = yt(x);
    up.push([x - T*s, yc(x) + T*c]);
    lo.push([x + T*s, yc(x) - T*c]);
  }
  // TE closes on the mean line; walk upper aft->fwd then lower fwd->aft
  const pts = [];
  for (let i = up.length - 1; i >= 1; i--) pts.push(up[i]);
  pts.push([0, yc(0)]);
  for (let i = 1; i < lo.length; i++) pts.push(lo[i]);
  return pts;                                   // open contour, TE..LE..TE
}

// Aerofoil as EVALUATORS rather than a fixed point list, so a section can be
// resampled between any two chord fractions with a chosen point count. That is
// the whole trick behind separated control surfaces: the fixed wing is lofted
// over [0..hinge] and the surface over [hinge..1], both with constant row
// lengths, so each is its own closed mesh and neither has to know about the
// other. Sampling BOTH at the same parameter `hinge` makes the cove and the
// surface's leading edge the same points by construction — no gap to close.
function genAfEval(naca) {
  const { m, p, t } = nacaParts(naca);
  const yc = x => x <= p ? (m/(p*p))*(2*p*x - x*x) : (m/((1-p)*(1-p)))*((1-2*p) + 2*p*x - x*x);
  const dyc = x => x <= p ? (2*m/(p*p))*(p - x) : (2*m/((1-p)*(1-p)))*(p - x);
  const yt = x => 5*t*(0.2969*Math.sqrt(Math.max(0,x)) - 0.1260*x - 0.3516*x*x
                       + 0.2843*x*x*x - 0.1015*x*x*x*x);
  const at = (x, sgn) => {
    const th = Math.atan(dyc(x)), T = yt(x);
    return [x - sgn * T * Math.sin(th), yc(x) + sgn * T * Math.cos(th)];
  };
  return { up: x => at(x, 1), lo: x => at(x, -1) };
}

// Closed section between chord fractions a..b: upper walked b->a, then lower
// a->b. Treated as a LOOP, so the cove (upper-a to lower-a) and the trailing
// edge (lower-b back to upper-b) both close for free.
function genAfSeg(naca, a, b, n) {
  const E = genAfEval(naca);
  const xs = i => a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * i / n));
  const pts = [];
  for (let i = n; i >= 0; i--) pts.push(E.up(xs(i)));
  for (let i = 0; i <= n; i++) pts.push(E.lo(xs(i)));
  return pts;
}

// Station cross-section: blend from the bare truss rectangle to a rounded
// former. theta 0 = top, +pi/2 = +z side, pi = bottom.
// crownT applies at the top and fades to crownS by the sides — a step between
// upper and lower halves leaves a visible kink right along the waterline, which
// is exactly where the eye reads a fuselage's shape.
function genRing(theta, halfW, halfD, crownT, crownS) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  const s = Math.min(halfD / Math.max(1e-6, Math.abs(cy)), halfW / Math.max(1e-6, Math.abs(cz)));
  const ry = cy * s, rz = cz * s;                       // truss rectangle
  const crown = crownS + (crownT - crownS) * Math.max(0, cy);
  const k = 1 + 0.15 * crown;                           // formers stand a little proud
  const ey = halfD * cy * k, ez = halfW * cz * k;       // rounded former
  return [ry + (ey - ry) * crown, rz + (ez - rz) * crown];
}

// A member drawn between two nodes has to STRETCH with them. Otherwise the
// suspension travel it exists to show slides the whole leg down instead of
// compressing it, and the leg parts company with both the axle and the
// airframe. So the sweep helpers take their influence as a FUNCTION of position
// along the sweep as well as a fixed array.
const genInfl = infl => (typeof infl === 'function' ? infl : () => infl);
const genSpanInfl = (a, b) => t => [[a, 1 - t], [b, t]];

// generic swept tube, used for the engine block's cylinders and shaft
function genTubeInto(M, A, C, r, seg, infl, B) {
  const ax = genV3.norm(genV3.sub(C, A));
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
  const IN = genInfl(infl);
  const rings = [A, C].map((base, s) => {
    const row = [];
    for (let h = 0; h <= seg; h++) {
      const a = 2 * Math.PI * (h % seg) / seg;
      const off = genV3.add(genV3.mul(e1, r * Math.cos(a)), genV3.mul(e2, r * Math.sin(a)));
      row.push(M.v(B(genV3.add(base, off)), h / seg, s, IN(s)));
    }
    return row;
  });
  for (let h = 0; h < seg; h++)
    M.quad(rings[0][h], rings[0][h+1], rings[1][h+1], rings[1][h]);
  // The two caps face OPPOSITE ways, so they cannot share a winding. Both used
  // to be wound the C end's way, which left every A-end cap in the aeroplane
  // lit from inside — invisible on the engine cylinders it was written for
  // (they are buried in the block) and not invisible at all on a gear leg.
  for (const [row, base, s] of [[rings[0], A, 0], [rings[1], C, 1]]) {
    const c = M.v(B(base), 0.5, 0.5, IN(s));
    for (let h = 0; h < seg; h++)
      if (s) M.tri(c, row[h], row[h+1]); else M.tri(c, row[h+1], row[h]);
  }
}

// Revolved solid about an axle. `sect` is [[r/R, w/halfW], ...] walked from one
// side to the other; a row at r = 0 collapses to a single apex vertex, which is
// how the hub caps itself.
//
// UV is the point of this helper. u = angle around the wheel, v = ARC LENGTH
// along the section, normalised — so a texture drawn for it appears exactly as
// drawn: a band at v = 0.5 is the crown, a band near v = 0 or 1 is a sidewall,
// and neither stretches. The wheel this replaced put v = 0 on one flat face and
// v = 1 on the other, so both sidewalls were a single texel row smeared over a
// triangle fan and nothing could be painted on them at all.
//
// Winding: (b-a) runs +angle and (c-a) runs +section, which puts the computed
// normal outward. Getting it backwards leaves the wheel lit from inside.
function genRevolveInto(M, c, axis, R, halfW, sect, seg, infl, B) {
  const ax = genV3.norm(axis);
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
  const L = [0];
  for (let i = 1; i < sect.length; i++)
    L.push(L[i-1] + Math.hypot((sect[i][0] - sect[i-1][0]) * R,
                               (sect[i][1] - sect[i-1][1]) * halfW));
  const tot = L[L.length - 1] || 1;
  const rows = sect.map((s, i) => {
    const rr = s[0] * R, base = genV3.add(c, genV3.mul(ax, s[1] * halfW)), v = L[i] / tot;
    if (rr < 1e-6) return { apex: M.v(B(base), 0.5, v, infl) };
    const row = [];
    for (let h = 0; h <= seg; h++) {
      const a = 2 * Math.PI * (h % seg) / seg;
      row.push(M.v(B(genV3.add(base,
        genV3.add(genV3.mul(e1, rr * Math.cos(a)), genV3.mul(e2, rr * Math.sin(a))))),
        h / seg, v, infl));
    }
    return { row };
  });
  for (let i = 0; i < rows.length - 1; i++) {
    const A = rows[i], C = rows[i+1];
    for (let h = 0; h < seg; h++) {
      // `!= null`, not truthiness: an apex is a vertex INDEX and the hub's first
      // one is index 0
      if (A.apex != null) M.tri(A.apex, C.row[h+1], C.row[h]);
      else if (C.apex != null) M.tri(C.apex, A.row[h], A.row[h+1]);
      else M.quad(A.row[h], A.row[h+1], C.row[h+1], C.row[h]);
    }
  }
}

// Swept RECTANGULAR section, for the spring-steel gear leg. A leaf spring is a
// flat tapered bar and nothing else reads as one: half-dimensions are given at
// both ends so it tapers. The broad face comes out perpendicular to the leg and
// horizontal, which puts it fore-and-aft on a main leg (a Cessna leg, bending
// vertically) and across the aeroplane on a tailwheel leg (which is also right
// — one rule, both correct).
function genBladeInto(M, A, C, w0, t0, w1, t1, infl, B) {
  const ax = genV3.norm(genV3.sub(C, A));
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up));           // broad
  const e2 = genV3.cross(ax, e1);                       // thin
  const CN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];      // +angle order, as the revolve
  const IN = genInfl(infl);
  const rows = [[A, w0, t0], [C, w1, t1]].map(([base, w, t], s) =>
    CN.map(([su, sv], i) => M.v(B(genV3.add(base,
      genV3.add(genV3.mul(e1, su * w), genV3.mul(e2, sv * t)))), i / 4, s, IN(s))));
  for (let i = 0; i < 4; i++)
    M.quad(rows[0][i], rows[0][(i+1)%4], rows[1][(i+1)%4], rows[1][i]);
  M.quad(rows[0][3], rows[0][2], rows[0][1], rows[0][0]);
  M.quad(rows[1][0], rows[1][1], rows[1][2], rows[1][3]);
}

// The bungee wrap: a revolve about the LEG axis whose radius ripples, so one
// ripple is one turn of cord. Built rather than tabled because the turn count
// is the only thing that makes it read as cord.
// The valleys must stay OUTSIDE the leg they wrap — measured on screen, at
// 0.72 +- 0.28 of a 1.15 r0 wrap they dipped just inside the 0.55 r0 tube, so
// the steel showed through between the turns and the whole wrap read as a chain
// of pale beads instead of dark cord. 0.80 +- 0.20 of 1.30 r0 keeps the tightest
// turn at 0.78 r0, comfortably clear.
function genBungeeSect(turns) {
  const pts = [], n = turns * 4;
  for (let i = 0; i <= n; i++)
    pts.push([0.80 + 0.20 * Math.cos(2 * Math.PI * turns * (i / n) - Math.PI),
              -1 + 2 * (i / n)]);
  return pts;
}

// THE SUSPENSION IS VISIBLE. Bungee, spring steel and oleo were three numbers
// with identical geometry — "springing has no visual feedback" — and they are
// three completely different pieces of hardware. A = the axle end, C = the
// airframe end; `rb` is the gear tube radius everything is sized against.
// Returns the mesh the cord (if any) went into, so the caller can group it.
function genGearLegInto(steel, rubber, A, C, kind, rb, nA, nC, B) {
  const d = genV3.sub(C, A), L = Math.hypot(d[0], d[1], d[2]);
  const at = t => genV3.add(A, genV3.mul(d, t));
  // the sweep helpers take t along their own span, which has to be remapped
  // onto the leg's when a piece covers only part of it
  const span = genSpanInfl(nA, nC);
  const part = (t0, t1) => t => span(t0 + (t1 - t0) * t);
  if (kind === 'spring') {
    // 76 mm x 20 mm at the top, tapering to 58 x 13 at the axle — a Cessna leg
    genBladeInto(steel, A, C, 1.15*rb, 0.28*rb, 1.60*rb, 0.42*rb, span, B);
  } else if (kind === 'oleo') {
    // two stages with a visible step: the piston below, the cylinder above it
    genTubeInto(steel, A, at(0.52), 0.62*rb, 8, part(0, 0.52), B);
    genTubeInto(steel, at(0.45), C, 1.05*rb, 8, part(0.45, 1), B);
  } else {
    // a thin steel leg with the cord wrapped round it, low down where it shows
    genTubeInto(steel, A, C, 0.55*rb, 8, span, B);
    // the wrap rides at one point on the leg rather than stretching along it:
    // it spans a third of the leg and its own stretch is under a millimetre
    const c0 = 0.10, c1 = 0.46;
    genRevolveInto(rubber, at(0.5*(c0+c1)), d, 1.30*rb, 0.5*(c1-c0)*L,
                   genBungeeSect(4), 10, span(0.5*(c0+c1)), B);
  }
}

// axis-aligned box, for the crankcase
function genBoxInto(M, lo, hi, infl, B) {
  const V = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]])
    V.push(M.v(B([x, y, z]), (x === lo[0] ? 0 : 1), (y === lo[1] ? 0 : 1), infl));
  // index bits: x*4 + y*2 + z
  const q = (a, b, c, d) => M.quad(V[a], V[b], V[c], V[d]);
  q(0,1,3,2); q(4,6,7,5); q(0,4,5,1); q(2,3,7,6); q(0,2,6,4); q(1,5,7,3);
}

// ---------------------------------------------------------------------------
// genSkin(def) -> payload in the decodeModel shape, plus per-vertex bindings.
// ---------------------------------------------------------------------------
function genSkin(def) {
  const S = def.spec, P = def.parts, N = def.nodes;
  const FR = genRestFrame(def);
  const B = FR.to;
  // every control surface mesh, wing and tail alike: {group, pivot, axis, drive}
  const CTRL_MESH = [];
  const skin = genMesh(), frame = genMesh(), strut = genMesh(), decal = genMesh(),
        tyre = genMesh(), prop = genMesh(), hubM = genMesh(),
        // the suspension leg's rubber, which is not painted with the leg
        rubber = genMesh(),
        cowl = genMesh(), engine = genMesh(),
        // glazing: pane, cabin interior behind it, and the frame bars
        glass = genMesh(), gcabin = genMesh(), gframe = genMesh(),
        exhaust = genMesh(),
        // the propeller's own two: a revolved ogive nose, and the outboard
        // tenth of each blade as a separate group so the painted tip is paint
        // and not a UV band that moves when the blade's shape does
        spinner = genMesh(), proptip = genMesh(),
        // the coaming and the instrument panel, off the windscreen fit line
        dash = genMesh(),
        // the INSIDE of the covering — the same rows, stepped inward
        intr = genMesh(),
        liftstrut = genMesh(),
        // the pitot mast is its OWN group because it is the one part of the
        // aeroplane that is deliberately ONE-SIDED. Left in with the struts it
        // made the whole strut group fail GATE GEN's mirror check, and the
        // honest fix is to keep the symmetric hardware checkable rather than to
        // exempt it along with the mast.
        pitot = genMesh(),
        // the canopy shell: glazed panes, the shell itself, its frame, and the
        // opaque sunscreen roof over the top of it
        glazed = genMesh(), canopy = genMesh(), cframe = genMesh(), ctop = genMesh(),
        // seats — cushion, piping, tube frame
        seat = genMesh(), spipe = genMesh(), sframe = genMesh(),
        // the occupant: limbs, joints, extremities, and the harness
        dumm = genMesh(), dumj = genMesh(), dumk = genMesh(),
        belt = genMesh(), buckle = genMesh();
  const w1 = i => [[i, 1]];

  // ---- 1. tubes: one prism per beam -----------------------------------
  // A beam is not one kind of thing, and it is `vis` and `cls` (61_gen_frame.js)
  // that say which — what a member IS, which the solver has no opinion about.
  // Four treatments, in this order:
  //   leg    the suspension, drawn as the hardware the spec bought, with its
  //          own rubber. It is not a prism at all, so it is handled first and
  //          leaves the loop.
  //   wire   a wire is drawn as a wire: 9 mm across, still about twice a real
  //          tie rod so it reads at distance, but 12 mm left the tailwheel
  //          looking braced by scaffolding poles.
  //   strut  an EXTERNAL LIFT STRUT gets GEN_STRUT_SECT with its chord
  //          fore-and-aft — that is what a lift strut is, and the round bar it
  //          replaces is what made the bracing read as scaffolding.
  //   tube   everything else, round, at 8 sides rather than 6: a hex bar shows
  //          its flats wherever a highlight crosses it.
  // Both ends are CAPPED — computeVertexNormals has no face to average at an
  // open rim, so every tube end used to go dark.
  const rGear = GEN_TUBE_R.gear * 1.15;    // what an external gear tube measures
  for (const b of def.beams) {
    if (b.vis === 'leg') {
      genGearLegInto(strut, rubber, N[b.a].p, N[b.b].p,
                     S.gear.suspension, rGear, b.a, b.b, B);
      continue;
    }
    const M = !b.ext ? frame : (b.cls === 'wing' ? liftstrut : strut);
    const A = N[b.a].p, C = N[b.b].p;
    const ax = genV3.norm(genV3.sub(C, A));
    const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
    // 9 mm across for a wire: still about twice a real tie rod, so it reads at
    // distance, but 12 mm left the tailwheel looking braced by scaffolding poles
    const r = b.vis === 'wire' ? 0.0045 : GEN_TUBE_R[b.cls] * (b.ext ? 1.15 : 1);
    // Only a wing's external member is a lift strut. Every `vis === 'wire'` beam
    // 61_gen_frame.js emits is `cls: 'gear'`, so no wire reaches this branch.
    const lift = b.ext && b.cls === 'wing';
    if (lift) {
      // chord fore-and-aft: body x, projected perpendicular to the strut axis
      const d = ax[0];
      e1 = genV3.norm([1 - ax[0] * d, -ax[1] * d, -ax[2] * d]);
      e2 = genV3.norm(genV3.cross(ax, e1));
    }
    const SEG = lift ? GEN_STRUT_SECT.length : 8;
    const cw = 3.6 * r;
    const off = h => lift
      ? genV3.add(genV3.mul(e1, (GEN_STRUT_SECT[h][0] - 0.40) * cw),
                  genV3.mul(e2, GEN_STRUT_SECT[h][1] * cw))
      : genV3.add(genV3.mul(e1, r * Math.cos(2 * Math.PI * h / SEG)),
                  genV3.mul(e2, r * Math.sin(2 * Math.PI * h / SEG)));
    const ring = [];
    for (let s = 0; s < 2; s++) {
      const nd = s ? b.b : b.a, base = s ? C : A, row = [];
      for (let h = 0; h < SEG; h++)
        row.push(M.v(B(genV3.add(base, off(h))), h / SEG, s, w1(nd)));
      ring.push(row);
    }
    for (let h = 0; h < SEG; h++)
      M.quad(ring[0][h], ring[0][(h+1)%SEG], ring[1][(h+1)%SEG], ring[1][h]);
    for (const s of [0, 1]) {
      const row = ring[s], nd = s ? b.b : b.a;
      const c0 = M.v(B(s ? C : A), 0.5, 0.5, w1(nd));
      for (let h = 0; h < SEG; h++)
        if (s) M.tri(c0, row[h], row[(h+1)%SEG]);
        else   M.tri(c0, row[(h+1)%SEG], row[h]);
    }
  }

  // ---- 2. fuselage covering -------------------------------------------
  // Every section vertex is BILINEAR on that ring's four truss corners, in the
  // ring's own normalised (uz, uy). A former that stands proud of the truss has
  // |u| > 1 and simply extrapolates — same weights, no special case.
  const ST = P.ST, F = P.F, fu = S.fuse;
  // WINDOW CUTOUTS ARE OUT for now (user, G1.7). The glazing that was here cut
  // real holes in the covering, and at this vertex budget a hole reads as a
  // missing panel rather than a window. When it comes back it should be a
  // painted pane on a solid surface, or a separate inset frame — not a hole.
  //
  // One section per lengthwise slice; a slice between two frames blends both.
  // The TOP line of bay 0 is special: it holds the cowl deck level and then
  // steps up to the cabin roof over `windRun`, which is the windscreen.
  const WSC = genClamp(S.cab.canopy && S.cab.canopy.wsCurve != null ? S.cab.canopy.wsCurve : 0, -1, 1);
  const bay0 = Math.max(1e-6, ST[1].x - ST[0].x);
  // THE WINDSCREEN ANGLE (user: "we have the angle of the windshield as a param in
  // the sim, I need it here too"). The fuselage's step and the canopy's front rake
  // have to be the SAME line, or a small canopy shows the body's abrupt step
  // running out of a gentle shell — which is the discontinuity at height 0. So the
  // run is derived from an ANGLE: run = step / tan(angle), and the body's own
  // windscreen is stretched to match whatever the canopy asks for. `windRun` stays
  // the fallback, and its own angle is what the default reproduces.
  const wsStep = Math.max(0.02, S.cab.h * (1 - fu.cowlDeck));
  const wsAng = (S.cabin.canopy && S.cabin.canopy.wsAngle) ||
                (Math.atan2(wsStep, Math.max(0.02, fu.windRun)) * 180 / Math.PI);
  const wsRun = Math.max(0.08, wsStep / Math.tan(genClamp(wsAng, 22, 80) * Math.PI / 180));
  const windFrac = Math.min(0.95, wsRun / bay0);
  const smooth = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-6, e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  // A body interpolated LINEARLY between stations has a crease at every frame:
  // a chain of facets down the turtledeck and a visible kink where the taper
  // starts, which is most of what made the generated fuselage read as low-poly.
  // Catmull-Rom through the station values smooths it, and every sample is
  // CLAMPED to its own bay's two stations so the curve cannot overshoot into a
  // bulge behind the cabin — the pinned stations still land exactly on the
  // truss, so the covering is as affine on the frame nodes as it ever was.
  const crAt = (key, i, s) => {
    const g = j => ST[Math.max(0, Math.min(ST.length - 1, j))][key];
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), t = s;
    const v = p1 + 0.5 * t * (p2 - p0) + 0.5 * t * t * (2*p0 - 5*p1 + 4*p2 - p3)
                 + 0.5 * t * t * t * (-p0 + 3*p1 - 3*p2 + p3);
    return Math.max(Math.min(p1, p2), Math.min(Math.max(p1, p2), v));
  };
  const section = (i, s) => {
    const A = ST[i], C = ST[Math.min(i + 1, ST.length - 1)];
    const L = (a, b) => a + (b - a) * s;
    // ahead of the cabin the deck is FLAT, then the windscreen rises — bay 0
    // stays linear on purpose: its top line is a designed step, not a curve.
    // WINDSCREEN CURVATURE. The step's profile was a fixed smoothstep, which
    // puts its middle vertices exactly on the S-curve and reads as a bulge. The
    // knob moves that middle line: >0 pulls it up (the screen bellies FORWARD,
    // convex), <0 holds it down and turns up late (concave, the hollow-raked
    // screen of a Cub). 0 is the old smoothstep, so a spec that does not set it
    // is unchanged.
    const st = i === 0 ? (() => {
      const t = Math.max(0, Math.min(1, (s - (1 - windFrac)) / Math.max(1e-6, windFrac)));
      const e = smooth(0, 1, t);
      const p = Math.pow(t, Math.pow(2, -2 * WSC));
      return WSC >= 0 ? e + (p - e) * WSC : e + (p - e) * -WSC;
    })() : s;
    return { x: L(A.x, C.x),
             w:  i === 0 ? L(A.w, C.w)  : crAt('w', i, s),
             yb: i === 0 ? L(A.yb, C.yb) : crAt('yb', i, s),
             yt: i === 0 ? A.yt + (C.yt - A.yt) * st : crAt('yt', i, s) };
  };
  const sectionRow = (i, s) => {
    const g = section(i, s), fA = F[i], fB = F[Math.min(i + 1, F.length - 1)];
    const yc = 0.5 * (g.yb + g.yt), hD = 0.5 * (g.yt - g.yb);
    const row = [];
    for (let h = 0; h <= GEN_RADIAL; h++) {
      const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
      const [dy, dz] = genRing(th, g.w, hD, fu.crownTop, fu.crownSide);
      const uz = dz / Math.max(1e-6, g.w), uy = dy / Math.max(1e-6, hD);
      const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
      const kA = 1 - s, kB = s;
      row.push({ p: [g.x, yc + dy, dz], u: h / GEN_RADIAL, vv: genUVBody(g.x / Math.max(1e-6, fu.postX)),
        infl: [[fA.TL, kA*wT*wL], [fA.TR, kA*wT*wR], [fA.BL, kA*wBo*wL], [fA.BR, kA*wBo*wR],
               [fB.TL, kB*wT*wL], [fB.TR, kB*wT*wR], [fB.BL, kB*wBo*wL], [fB.BR, kB*wBo*wR]] });
    }
    return row;
  };
  const emitRow = (row, M) => row.map(pt => M.v(B(pt.p), pt.u, pt.vv, pt.infl));
  // ---- THE COCKPIT CUT -------------------------------------------------
  // A canopy is not a lid laid on a closed fuselage: the covering STOPS at a
  // sill line over the cabin, and the canopy closes the body from there up. So
  // the cut is made HERE, in the covering loop, and the shell below is lofted
  // off the very ring points the cut leaves behind — same x, same y, same z,
  // same node weights — which is why there is no gap and nothing to z-fight.
  // The opening is cut ALONG THE EXISTING TOPOLOGY: whole quads, on ring
  // vertices, between two whole section rows. So its boundary is a known
  // polyline — two sill lines of ring vertices and two end arcs — and the
  // canopy is lofted onto THAT polyline rather than fitted near it. Nothing is
  // evaluated twice: the shell reads the fuselage's own emitted vertices.
  const CN = S.cabin.canopy;
  const CANOPY = ['windshield', 'bubble', 'greenhouse'].includes(S.cabin.glazing)
                 && S.seating !== 'drone' && F.length > 2;
  // THE SILL IS A RING INDEX, and it is one on purpose (user: the plane-based
  // cut "makes it look ugly"). A constant index is a constant angle round the
  // section, which on a straight-sided body IS a straight line, and it always
  // lands exactly on ring vertices — that snap is what makes the seam exact
  // rather than nearly exact, and exact seams are what keep GATE GEN's
  // skin/structure coherence green by construction.
  //
  // It was a height plane for a while, and the transfer spec still documents it
  // as one. Do not "fix" it back: that version was rejected after being looked
  // at. Being an index is also why GEN_RADIAL sets how finely the sill can be
  // placed — at 20 the slider reaches half as many positions.
  //
  // One value for the whole opening, so the coaming below cannot describe a
  // different line from the cut above: two functions describing one line drift.
  const hSill = Math.max(1, Math.min(GEN_RADIAL / 2 - 2,
                Math.round(CN.sill * GEN_RADIAL / 2)));
  // every slice's station, in the same enumeration the covering loop uses:
  // slice k = frame (k / GEN_LSEG), so k indexes bodyRows directly
  const NSLICE = (F.length - 1) * GEN_LSEG;
  const sliceX = [];
  for (let k = 0; k <= NSLICE; k++) {
    const i = Math.min(F.length - 2, Math.floor(k / GEN_LSEG));
    sliceX.push(section(i, (k - i * GEN_LSEG) / GEN_LSEG).x);
  }
  const wsX = ST[1].x - wsRun;
  // WHERE THE CANOPY STARTS. Not at the windscreen — the fuselage already OWNS
  // its windscreen (the step in the deck line over `windRun`), and cutting the
  // opening forward of the cabin-front frame put the shell's leading rows on the
  // low, narrow cowl-deck section: they then had to climb the whole step, and a
  // dome climbing a step balloons. That is the cartoon nose. So the canopy sits
  // over the CABIN and the fuselage's own windscreen runs up to meet it.
  // A windshield-only build is the opposite case by definition: it covers
  // exactly that step and nothing else.
  const cx0 = CN.x0 == null ? wsX : CN.x0;
  // WHERE THE WINDOW ENDS. `x1` is resolved in 60_gen_spec.js's resolveSpec,
  // from `cabin.canopy.reach` as a FRACTION of the cabin — so it is never null
  // here, and it tracks a cabin-length change instead of being left behind by
  // one. What stays here is the only part that belongs here: the tailpost is a
  // property of the FRAME, not of the spec, so the safety clamp against running
  // the window off the back of the body is applied where postX is known.
  const cx1 = S.cabin.glazing === 'windshield' ? ST[1].x
                                              : Math.min(fu.postX * 0.92, CN.x1);
  // snap the window to slice boundaries: a partial slice would be a staircase
  const nearestSlice = x => {
    let b = 0, bd = 1e9;
    sliceX.forEach((v, k) => { const d = Math.abs(v - x); if (d < bd) { bd = d; b = k; } });
    return b;
  };
  let kCut0 = nearestSlice(cx0), kCut1 = nearestSlice(cx1);
  if (kCut1 <= kCut0) kCut1 = Math.min(NSLICE, kCut0 + 1);
  // THE JOINT, as a STEPPED CUT (user: "an option for a joint like the one I drew
  // in green ... to avoid the little dent downward"; "it's ok if it's stepped to
  // match the topology"). Without it the opening runs at full sill depth from its
  // very first station, so the front bow has to dive the whole depth in one slice
  // and the corner where it lands on the sill rail comes to a downward point.
  // With it the cut starts shallower and deepens one ring index per slice, which
  // is a chamfer built out of the topology the mesh already has. The shell reads
  // the same per-strip depth, so the seam stays exact by the same argument as
  // before: every boundary vertex is still a ring vertex or a point between two.
  const JSTEP = 0;
  // per-STRIP cut depth: the shallower of the two rows it spans, so the covering
  // is never removed where one end of the strip is still below the sill plane.
  // ---- THE CORNER JOINT ------------------------------------------------
  // Where the opening ENDS, its edge turns a right angle: the end bow drops the
  // full sill depth at one station while the sill line runs away aft. That corner
  // is a downward spike, and no amount of rail smoothing hides it — it is the
  // shape of the hole, not the shape of the frame.
  //
  //   'square'  the corner as it is: a vertical end, a horizontal sill.
  //   'chamfer' the corner cut off on a straight diagonal.
  //
  // The chamfer is exact, and this is the whole trick: the depth is ramped by
  // EXACTLY ONE ring index per slice over the last `jointRun` indices, so in every
  // transition cell the opening's edge runs corner-to-corner. A quad whose edge
  // runs corner to corner is two triangles, one of which is covering and one of
  // which is hole — so the diagonal is drawn by SPLITTING the cell, not by adding
  // a vertex to it. Every vertex on the joint is still one of the body's own ring
  // vertices, which is what keeps the seam exact and the node weights valid.
  // (A ramp of more than one index per slice cannot be done this way: the covered
  // part of the cell becomes a trapezoid, and cutting one needs a vertex that is
  // not on the ring. That is why the run is in INDICES and the ramp is unit.)
  const CHAM = CN.joint === 'chamfer';
  const JRUN = Math.max(1, Math.min(8, Math.round(CN.jointRun == null ? 3 : CN.jointRun)));
  const dRowAt = (row, k) => {
    const d = hSill;
    if (!CHAM) return d;
    const e = Math.min(k - kCut0, kCut1 - k);        // slices from the nearer end
    return Math.max(1, Math.min(d, d - JRUN + e));
  };
  const bodyRows = [];          // kept for the registration decal, below
  const sideQuads = [];
  // ---- SIDE LIGHTS, as a band of the SAME cut ---------------------------
  // A side window is not a patch and not a route: it is the canopy's own cut kept
  // at the waistline. The band runs between two height planes (so its edges are
  // straight lines, like the sill), from the windscreen station to the cabin rear
  // — in line with the windscreen, which is the only thing it is meant to be
  // combined with. The quads are RECORDED here and rebuilt as glass off the very
  // same ring vertices, so there is no second surface to fit.
  const SIDEW = !!CN.sides && S.seating !== 'drone' && F.length > 2;
  // A GAP between the windscreen and the side lights: on a real aeroplane there is
  // a door post there, and butting the two together read as one long slot.
  const sideGap = genClamp(CN.sideGap == null ? 0.10 : CN.sideGap, 0, 0.6);
  const kSide0 = SIDEW ? nearestSlice(ST[1].x + sideGap) : -1;
  const kSide1 = SIDEW ? nearestSlice(ST[1].x + sideGap + (fu.postX - ST[1].x) * 0.62
                   * genClamp(CN.sideReach == null ? 1 : CN.sideReach, 0.1, 1)) : -1;
  // the band, in RING INDICES like the sill: top edge and depth both snap, so
  // both edges are ring lines and the sliders move them a whole segment at a time
  const hSideT = Math.max(1, Math.round(genClamp(CN.sideTop == null ? 0.34 : CN.sideTop,
                          0.05, 0.75) * GEN_RADIAL / 2));
  const hSideB = Math.min(GEN_RADIAL / 2 - 1, hSideT + Math.max(1,
                   Math.round((0.06 + 0.30 * genClamp(CN.sideDepth == null ? 0.5
                     : CN.sideDepth, 0, 1)) * GEN_RADIAL / 2)));
  let lastFusRow = null;
  for (let i = 0; i < F.length - 1; i++) {
    for (let sg = 0; sg < GEN_LSEG; sg++) {
      // reuse the previous slice's row rather than emitting a coincident one:
      // duplicate vertices split the normal average and crease the fuselage
      const rowA = lastFusRow || sectionRow(i, sg / GEN_LSEG);
      const rowB = sectionRow(i, (sg + 1) / GEN_LSEG);
      const aS = rowA.ids || emitRow(rowA, skin), bS = emitRow(rowB, skin);
      rowA.ids = aS; rowB.ids = bS;
      // ---- THE INSIDE, as the same rows stepped inward ----------------
      // A covering has two faces and only one is modelled; a single-sided shell
      // seen from within is a lit exterior with its normals pointing away, which
      // is what makes an open cockpit read as a hole rather than a cabin. So the
      // same ring vertices are emitted a second time, walked in along their own
      // radial by INTR_T and wound the other way round. Same eight node weights,
      // so the liner flexes with the covering exactly and can never part from it;
      // the step is a rendering separation, not a structure.
      //
      // TWO MAPPING AREAS, because the two halves of an aeroplane's inside are
      // trimmed by different trades: stations inside the cabin take the cabin
      // zone of the sheet, everything else the fuselage zone. One material.
      const inRow = row => {
        if (row.iids) return row.iids;
        let yLo = 1e9, yHi = -1e9;
        for (let h = 0; h < GEN_RADIAL; h++) {
          yLo = Math.min(yLo, row[h].p[1]); yHi = Math.max(yHi, row[h].p[1]);
        }
        const yc = 0.5 * (yLo + yHi), xr = row[0].p[0];
        const cabZone = xr > S.cab.noseGap - 0.02 && xr < fu.boxRear + 0.02;
        const t = cabZone
          ? (xr - S.cab.noseGap) / Math.max(1e-6, fu.boxRear - S.cab.noseGap)
          : xr / Math.max(1e-6, fu.postX);
        const vv = cabZone ? genUVPanel(t) : genUVBody(t);
        return row.iids = row.map(pt => {
          const n = genV3.norm([0, pt.p[1] - yc, pt.p[2]]);
          return intr.v(B([pt.p[0] - n[0] * INTR_T, pt.p[1] - n[1] * INTR_T,
                           pt.p[2] - n[2] * INTR_T]), pt.u, vv, pt.infl);
        });
      };
      const aI = inRow(rowA), bI = inRow(rowB);
      const kSlice = i * GEN_LSEG + sg;         // this strip runs k -> k+1
      const cut = CANOPY && kSlice >= kCut0 && kSlice < kCut1;
      const dA = cut ? dRowAt(rowA, kSlice) : 0, dB = cut ? dRowAt(rowB, kSlice + 1) : 0;
      const step1 = Math.abs(dA - dB) === 1;         // the only case a cell splits
      const dsL = cut ? Math.min(dA, dB) : 0;      const sideOn = SIDEW && kSlice >= kSide0 && kSlice < kSide1 && !cut;      const bT = hSideT;      const bB = hSideB;
      for (let h = 0; h < GEN_RADIAL; h++) {
        // the opening: everything within thSill of the top is simply not
        // covered over the cockpit stations
        if (cut) {
          // j is the cell's depth from the crown on ITS OWN side, so one test
          // serves both sides of the opening
          const j = h < GEN_RADIAL / 2 ? h : GEN_RADIAL - 1 - h;
          const cA = j >= dA, cB = j >= dB;
          if (!cA && !cB) continue;                  // hole
          if (cA !== cB) {
            if (!step1) { if (j < dsL) continue; }   // fall back: leave it covered
            else {
              // the split. Which triangle is covering depends on which row is
              // deeper AND which side of the aeroplane this is — the far side's
              // ring indices run the other way, so its diagonal is the other one.
              const near = h < GEN_RADIAL / 2;
              const A0 = aS[h], A1 = aS[h+1], B1 = bS[h+1], B0 = bS[h];
              const I0 = aI[h], I1 = aI[h+1], J1 = bI[h+1], J0 = bI[h];
              if (cA) {
                if (near) { skin.tri(A0, A1, B1); intr.tri(J1, I1, I0); }
                else      { skin.tri(A0, A1, B0); intr.tri(J0, I1, I0); }
              } else {
                if (near) { skin.tri(A1, B1, B0); intr.tri(J0, J1, I1); }
                else      { skin.tri(A0, B1, B0); intr.tri(J0, J1, I0); }
              }
              continue;
            }
          }
        }
        if (sideOn && bB > bT) {
          const hm = GEN_RADIAL - h - 1;
          const inBand = (h >= bT && h < bB) || (hm >= bT && hm < bB);
          if (inBand) {
            const hi = (h >= bT && h < bB) ? h : hm;
            sideQuads.push({
              a0: rowA[h], a1: rowA[h+1], b0: rowB[h], b1: rowB[h+1],
              ka0: kSlice + '_' + h, ka1: kSlice + '_' + (h+1),
              kb0: (kSlice+1) + '_' + h, kb1: (kSlice+1) + '_' + (h+1),
              // which of the four edges is on the window's boundary, so the rail
              // frames the light instead of drawing a grid over it
              edgeLo: hi === bB - 1, edgeHi: hi === bT,
              edgeF: kSlice === kSide0, edgeA: kSlice === kSide1 - 1,
              mirror: hi === hm,
            });
            continue;
          }
        }
        skin.quad(aS[h], aS[h+1], bS[h+1], bS[h]);
        // reversed, so the liner faces into the cabin
        intr.quad(aI[h], bI[h], bI[h+1], aI[h+1]);
      }
      if (!bodyRows.length) bodyRows.push(rowA);
      bodyRows.push(rowB);
      lastFusRow = rowB;
    }
  }

  // ---- 2d. GLAZING ----------------------------------------------------
  // Windows are back, and not as holes (see the note above). Each pane is a
  // CONFORMING PATCH of the body's own surface — same section machinery, so it
  // follows whatever shape the sliders make — in three layers a few millimetres
  // apart along the local normal: a near-black interior, the glass over it, and
  // a frame border proud of both. A hole would need the covering
  // re-topologised and reads as a missing panel at this vertex budget; three
  // sheets read as a window from every angle and cost nothing structurally,
  // because every vertex is still an affine blend of the same four frame nodes.
  //
  // This is the biggest single item in the look pass: an aeroplane with no
  // glazing is a shape, and an aeroplane with glazing is a machine somebody
  // sits in.
  const bodySurf = (gi, th) => {
    const i = Math.max(0, Math.min(F.length - 2, Math.floor(gi)));
    const s = Math.max(0, Math.min(1, gi - i));
    const gm = section(i, s), fA = F[i], fB = F[i + 1];
    const yc = 0.5 * (gm.yb + gm.yt), hD = 0.5 * (gm.yt - gm.yb);
    const [dy, dz] = genRing(th, gm.w, hD, fu.crownTop, fu.crownSide);
    const uz = dz / Math.max(1e-6, gm.w), uy = dy / Math.max(1e-6, hD);
    const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
    const kA = 1 - s, kB = s;
    return { p: [gm.x, yc + dy, dz], rad: genV3.norm([0, dy, dz]),
      infl: [[fA.TL, kA*wT*wL], [fA.TR, kA*wT*wR], [fA.BL, kA*wBo*wL], [fA.BR, kA*wBo*wR],
             [fB.TL, kB*wT*wL], [fB.TR, kB*wT*wR], [fB.BL, kB*wBo*wL], [fB.BR, kB*wBo*wR]] };
  };
  // A patch lifted along its OWN geometric normal, not along the ring radius:
  // the windscreen is a near-vertical step, so a radial lift would slide the
  // pane up the glass instead of off the skin and the layers would z-fight.
  // The winding is measured against that normal too — a mirrored pane walks its
  // parameters the other way round and would otherwise be lit from inside.
  const bodyPatch = (M, g0, g1, t0, t1, ng, nt, lift) => {
    const eg = (g1 - g0) / Math.max(1, ng) * 0.25;
    const et = (t1 - t0) / Math.max(1, nt) * 0.25;
    const gs = [];
    for (let a = 0; a <= ng; a++) {
      const row = [];
      for (let k = 0; k <= nt; k++) {
        const gg = g0 + (g1 - g0) * a / ng, th = t0 + (t1 - t0) * k / nt;
        const P0 = bodySurf(gg, th), Pa = bodySurf(gg + eg, th), Pb = bodySurf(gg, th + et);
        let n = genV3.norm(genV3.cross(genV3.sub(Pa.p, P0.p), genV3.sub(Pb.p, P0.p)));
        if (n[0]*P0.rad[0] + n[1]*P0.rad[1] + n[2]*P0.rad[2] < 0) n = genV3.mul(n, -1);
        row.push({ p: genV3.add(P0.p, genV3.mul(n, lift || 0)), n,
                   infl: P0.infl, u: a / ng, v: k / nt });
      }
      gs.push(row);
    }
    const A0 = gs[0][0], A1 = gs[Math.min(1, gs.length - 1)][0];
    const A2 = gs[0][Math.min(1, gs[0].length - 1)];
    const nn = genV3.cross(genV3.sub(A1.p, A0.p), genV3.sub(A2.p, A0.p));
    const flip = (nn[0]*A0.n[0] + nn[1]*A0.n[1] + nn[2]*A0.n[2]) < 0;
    const ids = gs.map(row => row.map(pt => M.v(B(pt.p), pt.u, pt.v, pt.infl)));
    for (let a = 0; a < ids.length - 1; a++)
      for (let k = 0; k < ids[a].length - 1; k++)
        if (flip) M.quad(ids[a][k], ids[a+1][k], ids[a+1][k+1], ids[a][k+1]);
        else      M.quad(ids[a][k], ids[a][k+1], ids[a+1][k+1], ids[a+1][k]);
  };
  // ---- THE OPTION SWITCH -----------------------------------------------
  // `cabin.glazing` picks the ROUTE, not the shape:
  //   none       an airframe with no cabin glazing at all (drones, testing)
  //   projected  TEXTURE ONLY. One sheet drawn in SIDE ELEVATION and projected
  //              onto the body: geometry unchanged, so nothing depends on the
  //              truss topology and the artwork cannot distort. Window shape is
  //              a drawing, so any style is a canvas call.
  //   panels     FLAT INSET PANELS. Own geometry, but planar — a flat-sided
  //              tube-and-fabric aeroplane really does have flat glass, and a
  //              flat quad has no topology to fight.
  //   bubble     A CANOPY SHELL over the deck: its own lofted surface, sitting
  //              on the fuselage rather than cut into it. P-47 / homebuilt.
  //   greenhouse The same shell, faceted, with frame bars on every facet edge.
  const GLZ = ['none', 'windshield', 'bubble', 'greenhouse']
    .includes(S.cabin.glazing) ? S.cabin.glazing : 'bubble';
  const hasCab = S.seating !== 'drone' && F.length > 2;
  // the cabin's station window, in the same continuous station coordinate
  // bodySurf takes, and its physical extent, which the shells work in
  const gA = 1 - windFrac * 0.95, gB = Math.min(F.length - 1.02, 2.02);
  const xW = ST[1].x - fu.windRun, xR = Math.min(fu.postX * 0.99, S.cab.noseGap + S.cab.len);
  const deckY = S.cab.h * fu.cowlDeck, roofY = S.cab.h;

  if (CANOPY) {
    // THE SEAM IS A FIXED EDGE LOOP. The boundary of the hole is exactly:
    // rows kCut0 and kCut1 walked over the top, plus the two sill lines of ring
    // vertices between them. Every canopy boundary vertex is a POINT ON THAT
    // POLYLINE — either a ring vertex or a linear point between two adjacent
    // ones — so the seam is watertight for any sill depth, any window, any
    // fuselage shape. The sliders move the middle of the shell; they cannot
    // move its edge.
    const facet = !!CN.facet;
    const rowsK = [], hsK = [];
    for (let k = kCut0; k <= kCut1; k++) {
      // one entry per (station, depth): a station where the depth changes appears
      // TWICE, and the strip between the pair is the step's riser — the little
      // wall that fills the staircase notch. Both of its edges are on the hole's
      // own boundary, so it closes the step exactly rather than nearly.
      if (CHAM) {
        // one entry per station, at that station's own depth. The shell's own
        // quads then run diagonally across the transition cells, meeting the
        // covering triangles edge to edge — which is the joint.
        rowsK.push(bodyRows[k]); hsK.push(dRowAt(bodyRows[k], k));
        continue;
      }
      // One row per station. The sill is a constant ring index, so the RISER
      // PAIR a varying sill needed — two rows at one station, at different
      // depths, with a wall between them — can only arise on the chamfer path
      // above, which carries its own per-station dRowAt. Here dPrev and dNext
      // are the same value whenever both exist, and the guards say only where
      // the opening begins and ends.
      const dPrev = k > kCut0 ? hSill : null;
      const dNext = k < kCut1 ? hSill : null;
      if (dPrev != null) { rowsK.push(bodyRows[k]); hsK.push(dPrev); }
      if (dNext != null && dNext !== dPrev) { rowsK.push(bodyRows[k]); hsK.push(dNext); }
    }
    const mixRow = (A, C, t) => A.map((pt, i) => ({ p: [pt.p[0] + (C[i].p[0] - pt.p[0]) * t, pt.p[1] + (C[i].p[1] - pt.p[1]) * t, pt.p[2] + (C[i].p[2] - pt.p[2]) * t], u: pt.u, vv: pt.vv + (C[i].vv - pt.vv) * t, infl: pt.infl.map((e, k2) => [e[0], e[1] + (C[i].infl[k2][1] - e[1]) * t]) }));
    // FURTHER SUBDIVISION (user): one row per body slice is 3 per bay, too coarse
    // for a dome. Extra rows are SYNTHESISED by averaging the two body rows they
    // sit between — positions AND node weights, elementwise — then run through the
    // same profile, so they are real geometry on the same ruled surface and every
    // weight still sums to 1. A riser pair (same station, different depth) is
    // skipped: there is no station between them.
    const SUBR = CN.facet ? 1 : 7;
    for (let a = rowsK.length - 1; a > 0 && SUBR > 1; a--) {
      if (hsK[a] !== hsK[a - 1]) continue;
      for (let s = SUBR - 1; s >= 1; s--) {
        rowsK.splice(a, 0, mixRow(rowsK[a - 1], rowsK[a], s / SUBR));
        hsK.splice(a, 0, hsK[a]);
      }
    }
    const nR = rowsK.length;
    // NS is a multiple of the ring spacing, so on the end rows the samples land
    // on ring vertices and on the chords between them — both ON the edge.
    const NS = Math.max(10, 2 * Math.max.apply(null, hsK) * (facet ? 1 : 7));
    // a point on a row's top arc, by fractional ring index. u = 0 is the port
    // sill, u = 1 the starboard one, walking over the top.
    // `sm` blends the sample from the body's own CHORD (exact, so a seam row
    // lands on the covering's polyline to the millimetre) toward a Catmull-Rom
    // through the four surrounding ring points (smooth, so the canopy's arc does
    // not inherit the body's facets). It is 0 on the two seam rows and 1 inside,
    // which is the whole trick: the joint stays exact and the dome reads round at
    // a resolution the fuselage does not have to pay for.
    const basePt = (row, u, hsIn, sm) => {
      const hs = hsIn == null ? hSill : hsIn;
      const fi = (GEN_RADIAL - hs) + u * (2 * hs);
      const i0 = Math.floor(fi + 1e-9), t = Math.min(1, fi - i0);
      const A = row[i0 % GEN_RADIAL], C = row[(i0 + 1) % GEN_RADIAL];
      const p = [A.p[0] + (C.p[0] - A.p[0]) * t, A.p[1] + (C.p[1] - A.p[1]) * t,
                 A.p[2] + (C.p[2] - A.p[2]) * t];
      if (sm > 0) {
        const Pm = row[(i0 - 1 + GEN_RADIAL) % GEN_RADIAL].p,
              Pn = row[(i0 + 2) % GEN_RADIAL].p, t2 = t * t, t3 = t2 * t;
        for (let c2 = 0; c2 < 3; c2++) {
          const cr = 0.5 * ((2 * A.p[c2]) + (-Pm[c2] + C.p[c2]) * t
            + (2*Pm[c2] - 5*A.p[c2] + 4*C.p[c2] - Pn[c2]) * t2
            + (-Pm[c2] + 3*A.p[c2] - 3*C.p[c2] + Pn[c2]) * t3);
          p[c2] += (cr - p[c2]) * sm;
        }
      }

      // both rings carry the SAME eight nodes in the same order (the two
      // straddling frames' corners), so the weights interpolate elementwise and
      // still sum to 1 — which is what GATE GEN's coherence check asserts
      const infl = A.infl.map((e, i) => [e[0], e[1] + (C.infl[i][1] - e[1]) * t]);
      return { p, infl };
    };
    // how high the shell stands off the fuselage's own line, per row. Zero at
    // both ends BY CONSTRUCTION, which is what closes it into the cowl deck at
    // the front and the turtledeck at the back.
    // Height is a fraction of cabin height, but CAPPED AGAINST THE WIDTH OF THE
    // OPENING. A canopy is a dome: rise much greater than the half-width it
    // spans is not a canopy, it is a fin — which is exactly what a low wing was
    // showing, because nothing else clamped it there. 0.95 of the half-width is
    // about a half-round, which is the tallest a bubble ever really is.
    // ---- THE CROWN LINE. This is the root cause of every shape defect so far.
    // The shell used to be built as DECK PLUS A BUMP: a lift added on top of the
    // fuselage's own top line. But that line is not fair — it steps up over the
    // windscreen and tapers away aft — so deck + bump inherited the step and
    // came out as a blister with a hump in it, and every attempt to reshape the
    // bump was reshaping the wrong term.
    //
    // A canopy's crown is an ABSOLUTE line: it leaves the covering at the front
    // seam, rises to a peak, runs flat, and comes back down to the covering at
    // the aft seam. So compute that line in world y, and let each row's lift be
    // whatever gets it there. The seam rows land exactly on the fuselage's own
    // crown height, which is why the seam stays exact and why the windscreen
    // step is swallowed instead of climbed.
    const crownY = row => basePt(row, 0.5).p[1];
    const yF0 = crownY(rowsK[0]), yA0 = crownY(rowsK[nR - 1]);
    const zMid = Math.abs(basePt(rowsK[Math.floor(nR / 2)], 1).p[2]);
    // the peak: a fraction of cabin height above the HIGHER of the two seams,
    // capped against the half-width it spans (a rise taller than that is a fin,
    // not a canopy) and, on a high wing, under the carry-through
    // ---- WHAT SETS THE HEIGHT: THE SLOPES, NOT A HEIGHT KNOB.
    // `height` was an additive rise and the seam then dragged it back down —
    // exactly the diagnosis. On a high wing the carry-through happened to clamp
    // it and the shape looked right; on a low wing nothing did, so the same
    // number ballooned. The height was never the constraint that matters.
    //
    // What constrains a real canopy is the ANGLE of its glass: a windscreen
    // rakes at 40-50 deg, an aft fairing runs out at 10-18, and both angles are
    // rise over the LENGTH available for them. So the rise is capped by the
    // window's own length through those two slopes, and `height` becomes a
    // preference inside that envelope rather than a driver of it. A short window
    // is then automatically a low canopy in every configuration, and there is
    // nothing left for a clamp to have to catch.
    const rakeF = 0.20 + 0.45 * (CN.skew - 0.20) / 1.40;
    const fadeF = Math.min(0.55, Math.max(0.22, 1.05 - rakeF));
    const Lw = Math.abs(basePt(rowsK[nR - 1], 0.5).p[0] - basePt(rowsK[0], 0.5).p[0]);
    const ySeam = Math.max(yF0, yA0);
    const rise = Math.min(S.cab.h * CN.height,
                          // WIDTH IS ITS OWN KNOB NOW. This used to cap the rise at
                          // 0.95 of the half-width, which tied the two together: asking
                          // for a taller canopy on a narrow cabin did nothing, and that
                          // is why `bubble` appeared inert. Height is bounded by the
                          // glass slopes only; how far it bulges sideways is `width`.
                          // ...and the slope limits are SOFT: asking for a tall canopy
                          // is asking for steeper glass, so the two angles open with the
                          // height knob (rake 40->64 deg, fairing 12->32). Fixed angles
                          // made the knob inert on a short window, which is what it was
                          // doing at 0.42 and 0.86 alike.
                          Math.tan((40 + 24 * CN.height) * Math.PI / 180) * rakeF * Lw,
                          Math.tan((12 + 22 * CN.height) * Math.PI / 180) * fadeF * Lw);
    let yPk = ySeam + Math.max(0.02, rise);
    // ---- THE LID. One virtual clipping plane, always — the high wing's clamp
    // generalised. `lid` is where it sits as a fraction of the natural rise: 1
    // leaves the dome alone, 0.4 slices the top off flat, which is what a
    // low-decked cockpit actually looks like. And whenever the WING sits inside
    // that envelope the plane drops to just under it, so the same mechanism
    // covers high, mid and low without a special case: it is only the wing that
    // changes where the plane lands.
    const lidF = CN.lid == null ? 1 : Math.max(0.25, Math.min(1, CN.lid));
    let yLid = ySeam + Math.max(0.02, rise) * lidF;
    const yWing = P.yF(P.zRoot);
    if (yWing > ySeam + 0.04) yLid = Math.min(yLid, yWing - 0.05);
    if (S.wing.position === 'high')
      yPk = Math.min(yPk, Math.max(ySeam + 0.02, P.yF(P.zRoot) - 0.05));
    void 0;
    let yCap = Infinity;
    if (S.wing.position === 'high') yCap = P.yF(P.zRoot) - 0.05;
    const grid = rowsK.map((row, a) => {
      const hsA = hsK[a];
      // seam rows sample the body's chord EXACTLY (sm = 0); everything inside
      // rides the smooth ring curve, ramped over one row so there is no crease
      const smA = (a === 0 || a === nR - 1) ? 0 : (a === 1 || a === nR - 2) ? 0.55 : 1;
      const xFr = basePt(rowsK[0], 0.5, hsK[0]).p[0];
      const xAf = basePt(rowsK[nR - 1], 0.5, hsK[nR - 1]).p[0];
      // t comes from the STATION, not the row index: a stepped joint duplicates a
      // station, and index-based t would stretch the crown line over rows that
      // share an x, so the riser would lean instead of standing up.
      const t = Math.abs(xAf - xFr) > 1e-6
        ? Math.max(0, Math.min(1, (basePt(row, 0.5, hsA).p[0] - xFr) / (xAf - xFr)))
        : (nR > 1 ? a / (nR - 1) : 0);
      // the line: raked windscreen, flat top, long aft fairing. `skew` is how
      // much of the window the rake takes.
      const rake = 0.20 + 0.45 * (CN.skew - 0.20) / 1.40;   // 0.20 .. 0.65
      const fade = Math.min(0.55, Math.max(0.22, 1.05 - rake));
      const ss = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
      const yDeck = crownY(row);
      // absolute crown height for this row: up from the front seam, flat, then
      // down to the aft seam. Exactly the seam heights at t = 0 and t = 1.
      // THE CROWN LINE IS RELATIVE TO THE BODY, not absolute (user: a windshield
      // reduced to almost nothing still protruded, and every bubble came out an odd
      // shape). It used to ramp from the front seam's height to an absolute peak over
      // `rake` of the WINDOW, while the fuselage's own deck rises over the WINDSCREEN
      // RUN — two different lengths. Wherever the ramp got there first the shell stood
      // off the body as a slab, which is the wedge over the cowl.
      //
      // So the line is the body's own deck plus a bump that is zero at both seams:
      // at rise 0 the shell IS the fuselage, i.e. the face simply turns to glass, and
      // the windscreen angle is the fuselage's angle by construction rather than by
      // agreement. Every larger height swells from that same line.
      const bump = ss(t / rake) * ss((1 - t) / fade);
      const yCr = yDeck + Math.max(0, yPk - ySeam) * bump;

      // never BELOW the covering it replaces — the aft rows of a long window sit
      // over a tapering deck and would otherwise sink into it
      const rise = Math.max(0, yCr - yDeck);
      return Array.from({ length: NS + 1 }, (_, j) => {
        const u = j / NS;
        const bp = basePt(row, u, hsA, smA);
        // cross-section: a full, slightly flattened dome rather than a peak —
        // sin^0.85 came to a point at the crown, which is what made it read as a
        // blade once it was tall
        // cross-section fullness. `bubble` 1 is a half-round blown canopy; 0 is
        // a flat-sided turtledeck with a crown on it. It shapes the SECTION
        // only — how high the thing stands is the slope envelope's business, and
        // where it stops is the lid's.
        const bub = CN.bubble == null ? 0.7 : Math.max(0, Math.min(1, CN.bubble));
        // BALLOON. `width` scales the section outward from the fuselage's own
        // line, and sin(pi u) is exactly zero at both sills — so the fixed edge
        // loop is untouched and only the middle swells. That is the knob that
        // makes a blown canopy stand proud of the body instead of merely tall.
        // BALLOON, GATED BY THE RISE. sin(pi u) already pins the two SIDE sills,
        // but the fore and aft end rows are seams too — they sit on the body,
        // where rise is 0 — and pushing their middles outward opened exactly the
        // gaps this whole approach exists to avoid. Scaling the bulge by the
        // normalised rise makes it vanish wherever the shell touches the
        // fuselage, on every edge of the opening, by construction.
        const wK = CN.width == null ? 1 : CN.width;
        const riseF = Math.max(0, Math.min(1, rise / Math.max(1e-6, yPk - ySeam)));
        const zBulge = bp.p[2] * (1 + (wK - 1) * riseF * Math.sin(Math.PI * u));
        const lift = rise * Math.pow(Math.sin(Math.PI * u), facet ? 0.45 : 1.0 - 0.5 * bub);
        // a canopy cannot grow through the wing: on a high wing the shell is
        // capped under the carry-through, and the cap is the parametric way of
        // saying a bubble belongs on a low or mid wing
        // clipped by the lid plane, never below the covering it replaces
        const y = Math.min(bp.p[1] + lift, Math.max(bp.p[1], Math.min(yLid, yCap)));
        return { p: [bp.p[0], y, zBulge], infl: bp.infl, u, v: t };
      });
    });
    const sun = Math.max(0, Math.min(0.92, CN.sun == null ? 0 : CN.sun));
    const sunStart = Math.max(0, Math.min(0.85, CN.sunStart == null ? 0.38 : CN.sunStart));
    const tvc = {};
    // UV: the roof is PAINTED, so it has to live in the fuselage's own UV zone or
    // the livery does not line up across the seam (user: "the UV mapping is also
    // wrong"). u is the ring's normalised ANGLE, exactly as the covering computes
    // it, and v is the body's station — recovered from the same fractional ring
    // index basePt sampled, so a roof texel and the texel of the covering beside it
    // are the same texel.
    const roofUV = (a, j) => {
      const hs = hsK[a], fi = (GEN_RADIAL - hs) + (j / NS) * (2 * hs);
      return [(fi % GEN_RADIAL) / GEN_RADIAL,
              genUVBody(grid[a][j].p[0] / Math.max(1e-6, fu.postX))];
    };
    const tv = (a, j) => { const kk = a + '_' + j; if (tvc[kk] != null) return tvc[kk]; const pt = grid[a][j], uv = roofUV(a, j); return tvc[kk] = ctop.v(B(pt.p), uv[0], uv[1], pt.infl); };
    const ids = grid.map(r => r.map(pt => canopy.v(B(pt.p), pt.u, pt.v, pt.infl)));
    // ---- SUNSCREEN. The crown goes OPAQUE, painted like the rest of the aeroplane
    // -- a tinted roof, or a fabric-over-the-top cabin. `sun` is the fraction of the
    // arc it takes, centred on the crown. A MESH split, not a texture: the roof
    // quads are the shell's own, so glass and roof share an edge by construction,
    // and the boundary lands on a section line where it takes a rail like any other
    // frame member.
    for (let a = 0; a < ids.length - 1; a++)
      for (let j = 0; j < ids[a].length - 1; j++) {
        const um = (j + 0.5) / NS;
        // NOT OVER THE WINDSCREEN. A sunscreen that reaches the front of the canopy
        // is a blindfold: it starts partway along and runs aft. `sunStart` is that
        // station as a fraction of the window's length, and the rows already carry
        // that fraction as their v.
        const tm = 0.5 * (grid[a][j].v + grid[a+1][j].v);
        if (sun > 0 && tm >= sunStart && Math.abs(um - 0.5) < sun / 2)
          ctop.quad(tv(a, j), tv(a, j+1), tv(a+1, j+1), tv(a+1, j));
        else canopy.quad(ids[a][j], ids[a][j+1], ids[a+1][j+1], ids[a+1][j]);
      }
    if (sun > 0) {
      const jb = Math.max(1, Math.round((0.5 - sun / 2) * NS));
      let aFirst = -1;
      for (let a = 0; a < nR - 1; a++) {
        if (0.5 * (grid[a][jb].v + grid[a+1][jb].v) < sunStart) continue;
        if (aFirst < 0) aFirst = a;
        for (const j of [jb, NS - jb])
          genTubeInto(cframe, grid[a][j].p, grid[a+1][j].p, 0.011, 10, grid[a][j].infl, B);
      }
      // the front edge of the roof is a bow, like the ends of the canopy
      if (aFirst >= 0)
        for (let j = jb; j < NS - jb; j++)
          genTubeInto(cframe, grid[aFirst][j].p, grid[aFirst][j+1].p, 0.011, 10, grid[aFirst][j].infl, B);
    }
    // FRAME, on the same vertices: sill rails, the two end bows, and on the
    // faceted version a bar down every facet edge.
    const rail = (A, C, r) => genTubeInto(cframe, A.p, C.p, r, 10, A.infl, B);    const jn = 0;    const jr = 0;
    for (const j of [0, NS])
      for (let a = jr; a < nR - 1; a++) rail(grid[a][j], grid[a+1][j], 0.015);
    // NO JOIN WHERE THE SUNSCREEN MEETS THE BODY. The end bows are the canopy's
    // joint with the covering, and a rail across one is right for glass — but the
    // sunscreen is painted like the fuselage, so a bar there reads as a seam in
    // the body itself. Under the roof the bow is simply not drawn, and the two
    // surfaces run into each other.
    const roofAt = (a, j) => sun > 0 && grid[a][j].v >= sunStart
      && Math.abs((j + 0.5) / NS - 0.5) < sun / 2;
    for (const a of [0, nR - 1])
      for (let j = (a === 0 ? jn : 0); j < (a === 0 ? NS - jn : NS); j++)
        if (!roofAt(a, j)) rail(grid[a][j], grid[a][j+1], 0.014);
    if (facet)
      for (let j = 1; j < NS; j++)
        for (let a = 0; a < nR - 1; a++) rail(grid[a][j], grid[a+1][j], 0.011);
    // INTERIOR. Only when there is a real opening: a windshield-only cut is
    // covered by glass that reproduces the fuselage exactly, and floors nothing.
    if (yPk - Math.max(yF0, yA0) > 0.05) {
      const drop = 0.30 * S.cab.h;
      const fl = rowsK.map((row, a) => {
        const L = basePt(row, 0, hsK[a]), Rr = basePt(row, 1, hsK[a]);
        return [0, 0.5, 1].map(u => {
          const p = [L.p[0], 0.5 * (L.p[1] + Rr.p[1]) - drop,
                     L.p[2] + (Rr.p[2] - L.p[2]) * u];
          const infl = L.infl.map((e, i) => [e[0], e[1] + (Rr.infl[i][1] - e[1]) * u]);
          return gcabin.v(B(p), u, 0, infl);
        });
      });
      for (let a = 0; a < fl.length - 1; a++)
        for (let j = 0; j < 2; j++)
          gcabin.quad(fl[a][j], fl[a][j+1], fl[a+1][j+1], fl[a+1][j]);
    }
  }
  // ---- 2e. SIDE WINDOWS ------------------------------------------------
  // The other half of the combination the user asked for: a windscreen (or a
  // short canopy) plus real side lights along the cabin. These are CONFORMING
  // PATCHES, not cuts — the route that already works — so they follow whatever
  // shape the sliders give the body and need no seam management at all: three
  // sheets a few millimetres apart along the surface's own normal, plus a rail
  // round the edge. `depth` is how far down the side the light reaches, `reach`
  // how far aft it runs; both are fractions, so they survive any cabin.
  if (false && hasCab) {
    const rch = CN.sideReach == null ? 1 : CN.sideReach;
    const dep = CN.sideDepth == null ? 0.5 : CN.sideDepth;
    const g0 = 1.04, g1 = Math.min(F.length - 1.06, g0 + 0.94 * rch);
    if (g1 > g0 + 0.06) {
      const thC = Math.PI / 2, hh = 0.26 + 0.40 * dep;
      for (const sgn of [1, -1]) {
        const t0 = sgn * (thC - 0.62 * hh), t1 = sgn * (thC + 0.38 * hh);
        bodyPatch(gcabin, g0, g1, t0, t1, 5, 3, -0.005);
        bodyPatch(canopy, g0, g1, t0, t1, 5, 3, 0.005);
        // the rail walks each edge in segments, so a curved edge stays curved
        const edge = (a0, b0, a1, b1) => {
          const NSg = 4;
          let prev = null;
          for (let i = 0; i <= NSg; i++) {
            const q = bodySurf(a0 + (a1 - a0) * i / NSg, b0 + (b1 - b0) * i / NSg);
            const pt = genV3.add(q.p, genV3.mul(q.rad, 0.009));
            if (prev) genTubeInto(cframe, prev.p, pt, 0.011, 10, prev.infl, B);
            prev = { p: pt, infl: q.infl };
          }
        };
        edge(g0, t0, g1, t0); edge(g1, t0, g1, t1);
        edge(g1, t1, g0, t1); edge(g0, t1, g0, t0);
      }
    }
  }

  // ---- 2e. SIDE WINDOWS ------------------------------------------------
  // Not patches any more, and not a separate route: a side light is the SAME cut
  // as the canopy's, kept at the waistline instead of taken over the top. The
  // covering loop removes a band of ring quads between two height planes over the
  // cabin stations, and the glass fills exactly those quads off the very same ring
  // vertices — flush with the body, in line with the windscreen, no seam to
  // manage because there is no second surface. Meant to be combined with the
  // WINDSCREEN, not with a canopy: with a canopy the two openings would meet.
  if (sideQuads.length) {
    const LIFT = 0.004, INSET = 0.055;
    const yMid = 0.5 * (S.cab.h * 0.72);
    const lift = (pt, d) => {
      const n = genV3.norm([0, (pt.p[1] - yMid) * 0.30, pt.p[2]]);
      return [pt.p[0] + n[0] * d, pt.p[1] + n[1] * d, pt.p[2] + n[2] * d];
    };
    const emit = (M, d, uv) => {
      const seen = new Map();
      const vid = (pt, key) => {
        const kk = key + '|' + d;
        if (seen.has(kk)) return seen.get(kk);
        const id = M.v(B(lift(pt, d)), uv(pt)[0], uv(pt)[1], pt.infl);
        seen.set(kk, id); return id;
      };
      for (const q of sideQuads) {
        const a = vid(q.a0, q.ka0), b = vid(q.a1, q.ka1),
              c = vid(q.b1, q.kb1), e = vid(q.b0, q.kb0);
        if ((d >= 0) !== !!q.mirror) M.quad(a, b, c, e); else M.quad(e, c, b, a);
      }
    };
    emit(canopy, LIFT, pt => [pt.u, pt.vv]);
    void INSET;   // no interior sheet behind a side light (user): the glass reads dark
    // ---- THE FRAME, as a true PERIMETER. Railing each quad's flagged edges drew
    // bars across the middle of the light as well (the faceted look, which the canopy
    // no longer has either). The boundary of a set of quads is exactly the edges used
    // ONCE, so count them and rail the singletons: one black joint round the window,
    // whatever shape the band is and however it is subdivided.
    const ec = new Map();
    const eKey = (x, y) => (x < y ? x + '>' + y : y + '>' + x);
    for (const q of sideQuads) {
      const P4 = [[q.ka0, q.a0], [q.ka1, q.a1], [q.kb1, q.b1], [q.kb0, q.b0]];
      for (let n = 0; n < 4; n++) {
        const A = P4[n], C = P4[(n + 1) % 4], k2 = eKey(A[0], C[0]);
        const e = ec.get(k2);
        if (e) e.n++; else ec.set(k2, { n: 1, a: A[1], b: C[1] });
      }
    }
    for (const e of ec.values())
      if (e.n === 1) genTubeInto(cframe, lift(e.a, LIFT), lift(e.b, LIFT), 0.012, 10, e.a.infl, B);
  }

  // ---- 2g. COAMING + INSTRUMENT PANEL ----------------------------------
  // THE FIT LINE NEVER MOVES. It is the joint between the fuselage and the
  // windscreen — the body's own ring at the cabin-front station, taken between
  // the two sill points, i.e. the very arc the glazing cut is bounded by. A row
  // is one station, so those vertices already lie in a plane perpendicular to the
  // length axis and the line reads straight from above by construction rather
  // than by projection. They are the covering's own vertices, so the coaming
  // meets the body exactly and flexes with it.
  //
  // From that arc the shell is extruded: aft by `depth` (default the windscreen
  // run, i.e. the break line seen from the side), then a step inward, then a few
  // millimetres forward toward the prop, then closed with the flat panel the
  // instruments will go on.
  const PN = S.cab.panel || {};
  if (PN.on !== false && S.seating !== 'drone' && F.length > 2 && bodyRows.length) {
    const kW = Math.max(0, Math.min(bodyRows.length - 1, nearestSlice(ST[1].x - fu.windRun)));
    const rowW = bodyRows[kW];
    // THE ARC IS THE SILL'S. It used to be bounded by where the section falls
    // away from the cowl deck, which is a different line from the one the glazing
    // cut makes — so lowering the sill opened a gap between the coaming's ends and
    // the opening's edge. It reads hSill, the very value the cut uses, so the
    // two cannot disagree whatever the sill does. `wrap` modulates about it:
    // 0.5 is exactly the sill, less is a shallower coaming, more reaches past it.










    const hsW = Math.max(1, Math.min(GEN_RADIAL / 2 - 1,
      Math.round(hSill * 2 * genClamp(PN.wrap == null ? 0.5 : PN.wrap, 0.15, 0.95))));
    const arc = [];
    for (let j = -hsW; j <= hsW; j++) arc.push(rowW[(j + GEN_RADIAL) % GEN_RADIAL]);
    const dep = Math.max(0.02, PN.depth == null ? fu.windRun : PN.depth);
    const ins = 1 - Math.max(0, Math.min(0.25, PN.inset == null ? 0.06 : PN.inset));
    let cy = 0, cz = 0;
    for (const p of arc) { cy += p.p[1]; cz += p.p[2]; }
    cy /= arc.length; cz /= arc.length;
    const mv = (pt, dx, k) => ({ p: [pt.p[0] + dx, cy + (pt.p[1] - cy) * k,
                                     cz + (pt.p[2] - cz) * k], infl: pt.infl, u: pt.u });
    const R = [arc.map(p => mv(p, 0, 1)), arc.map(p => mv(p, dep, 1)),
               arc.map(p => mv(p, dep, ins)), arc.map(p => mv(p, dep - 0.006, ins))];
    const vs = R.map((row, r) => row.map(pt =>
      dash.v(B(pt.p), pt.u, genUVBody(pt.p[0] / Math.max(1e-6, fu.postX)), pt.infl)));
    for (let r = 0; r < vs.length - 1; r++)
      for (let j = 0; j < arc.length - 1; j++)
        dash.quad(vs[r][j], vs[r][j+1], vs[r+1][j+1], vs[r+1][j]);
    // the flat panel: the last ring capped in its own plane, fanned from the
    // centroid of the arc's chord. This is the face the instruments go on.
    const lastR = R[3];
    const cx = lastR[0].p[0];
    const cInfl = arc[Math.floor(arc.length / 2)].infl;
    const cId = dash.v(B([cx, cy, cz]), 0.5, genUVBody(cx / Math.max(1e-6, fu.postX)), cInfl);
    const cap = lastR.map(pt => dash.v(B([cx, pt.p[1], pt.p[2]]), pt.u,
      genUVBody(cx / Math.max(1e-6, fu.postX)), pt.infl));
    for (let j = 0; j < cap.length - 1; j++) dash.tri(cId, cap[j+1], cap[j]);
    // and close the panel's straight lower edge, sill to sill
    dash.tri(cId, cap[0], cap[cap.length - 1]);
  }

  // ---- 2f. SMALL PARTS -------------------------------------------------
  // A boarding step and a pitot mast: two tubes, and two of the things whose
  // absence makes an aeroplane read as a toy. Both hang off real nodes, so they
  // flex with whatever they are bolted to.
  {
    const s2 = ST[Math.min(2, ST.length - 1)], f2 = F[Math.min(2, F.length - 1)];
    const y0 = s2.yb + 0.04;
    for (const [sgn, nd] of [[1, f2.BR], [-1, f2.BL]]) {
      const foot = [s2.x - 0.02, y0 - 0.23, sgn * (s2.w + 0.15)];
      genTubeInto(strut, [s2.x - 0.05, y0, sgn * s2.w * 0.92], foot, 0.015, 8, [[nd, 1]], B);
      genTubeInto(strut, [foot[0] - 0.10, foot[1], foot[2]],
                        [foot[0] + 0.07, foot[1], foot[2]], 0.015, 8, [[nd, 1]], B);
    }
  }

  // ---- 2c. REGISTRATION, as a conforming DECAL ------------------------------
  // It used to be painted into the body texture, and the body's u is normalised
  // ANGLE while its circumference shrinks aft — so a glyph of fixed u-width got
  // narrower and narrower toward the tail. User: "the writing is all squeezed at
  // the back. It either needs to be a decal, or we need to live UV map better."
  //
  // This is the decal. It is built from the body's OWN rows, so it follows the
  // real surface however the fuselage is shaped, lifted a few millimetres along
  // the local outward normal, and given a plain 0..1 grid of its own — the text
  // cannot distort because nothing about the body's parameterisation reaches it.
  if (S.reg) {
    const DEC_LIFT = 0.006;
    // Between 30% and 60% of the run to the tailpost. It used to sit at
    // 45-78%, which on a tapered body is the wedge where the section halves in
    // width — so the glyphs shrank toward the tail even as a decal, which is the
    // squeeze the decal existed to cure. Forward of that the section is full.
    // ---- POSITION AND ASPECT (user: it must never stretch, "that's the point").
    // `paint.regX` places the patch: 0 just aft of the cabin, 1 at the fin. The
    // LENGTH is not a free choice — the sheet is 4:1, so the patch has to be four
    // times as long as it is tall or the glyphs distort however undistorted their
    // own grid is. So: measure the arc height in metres at the anchor row, ask for
    // 4x that in x, and take however many rows that comes to. A short body gets a
    // small registration, not a squeezed one.
    const REG_ASPECT = 4.0;
    const hA0 = Math.round(0.15 * GEN_RADIAL), hB0 = Math.round(0.35 * GEN_RADIAL);
    const anchor = Math.max(1, Math.min(bodyRows.length - 2,
      Math.round(bodyRows.length * (0.24 + 0.52 * genClamp(
        S.paint.regX == null ? 0.30 : S.paint.regX, 0, 1)))));
    const arcH = (() => {
      const r = bodyRows[anchor];
      let L = 0;
      for (let h = hA0; h < hB0; h++)
        L += Math.hypot(r[h+1].p[1] - r[h].p[1], r[h+1].p[2] - r[h].p[2]);
      return Math.max(0.05, L);
    })();
    const wantX = REG_ASPECT * arcH;
    let lo = anchor, hi = anchor;
    while (hi < bodyRows.length - 1 &&
           Math.abs(bodyRows[hi][0].p[0] - bodyRows[lo][0].p[0]) < wantX) hi++;
    // ran out of body: back the patch up rather than shrink it
    while (lo > 0 && Math.abs(bodyRows[hi][0].p[0] - bodyRows[lo][0].p[0]) < wantX) lo--;
    const rows = bodyRows.slice(lo, Math.max(lo + 2, hi + 1));
    // the two side arcs: u 0.15..0.35 (+z) and its mirror
    // The far side walks its arc BACKWARDS rather than flipping u. Traversing
    // both side arcs in the same index direction gives them opposite handedness
    // seen from outside, so flipping u on top of that was a SECOND flip: the
    // registration came out mirrored AND upside down. Reversing the traversal
    // restores the handedness, and then both sides share one (u, v) frame
    // relative to their own outward normal.
    // The arcs are FRACTIONS of GEN_RADIAL, not fixed indices: hard-coded 3..7
    // and 13..17 were the +z and -z sides at 20 segments and became the upper
    // side and the BELLY the moment the section resolution changed.
    const hA = hA0, hB = hB0;
    const hC = GEN_RADIAL - hB, hD = GEN_RADIAL - hA;
    // TWO SEPARATE FLIPS, and conflating them is what left the registration
    // mirrored. `back` walks the arc the other way and only fixes HANDEDNESS
    // (traversing both side arcs in the same index direction gives them opposite
    // orientation seen from outside). Reading direction is the OTHER one, and it
    // is a flip of u: on the +z side the nose is to the observer's RIGHT, so
    // increasing station runs to their left and the glyphs come out reversed
    // unless u is reversed with it. On the -z side it already reads forward.
    // (A real registration reads left-to-right from BOTH beams, which means it
    // runs nose-to-tail on one side and tail-to-nose on the other.)
    for (const [h0, h1, back, flipU] of [[hA, hB, false, false], [hC, hD, true, true]]) {
      const grid = rows.map(row => {
        const out = [];
        for (let j = h0; j <= h1; j++) {
          const h = back ? (h1 - (j - h0)) : j;
          const pt = row[h];
          // outward normal of a section point is its radial offset from the
          // section centre, which for these near-elliptical rings is exact
          // enough at 6 mm of lift
          const c = row[0].p, o = pt.p;
          const ry = o[1] - 0.5 * (row[0].p[1] + row[GEN_RADIAL / 2].p[1]);
          const n = genV3.norm([0, ry, o[2]]);
          out.push({ p: [o[0], o[1] + n[1] * DEC_LIFT, o[2] + n[2] * DEC_LIFT],
                     infl: pt.infl });
        }
        return out;
      });
      // u runs ALONG the body and v around it, so the sheet's long axis is the
      // aeroplane's long axis and the text reads nose-to-tail. The far side is
      // flipped so the registration reads the same way round from either beam,
      // which is what it does on a real aeroplane.
      // v runs the other way round the body than the sheet is drawn: measured
      // on both beams, u forward / v inverted is the one combination of the four
      // that reads F-PGAR the right way round on BOTH sides. It is a UV flip and
      // not a traversal flip on purpose — reversing the traversal instead would
      // invert this sheet's normals and light the registration from inside.
      // MEASURED, one arc at a time, from both beams (there are four
      // combinations and three of them are wrong): v runs the other way round
      // the body than the sheet is drawn, and the -z side additionally needs u
      // reversed, because a registration reads left-to-right from BOTH beams —
      // which means it runs nose-to-tail on one side and tail-to-nose on the
      // other. Doing it in UV and not in the traversal keeps the sheet's normals
      // pointing out; reversing the traversal would light the decal from inside.
      const ids = grid.map((g, r) => {
        const t = r / Math.max(1, grid.length - 1);
        return g.map((pt, k) =>
          decal.v(B(pt.p), flipU ? 1 - t : t, 1 - k / (h1 - h0), pt.infl));
      });
      for (let r = 0; r < ids.length - 1; r++)
        for (let k = 0; k < ids[r].length - 1; k++)
          decal.quad(ids[r][k], ids[r][k+1], ids[r+1][k+1], ids[r+1][k]);
    }
  }
  const secRows = [{ s: lastFusRow.ids }];   // last fuselage row, for the tail cone
  // tail cone closing onto the post: the section collapses to the TPB..TPT line
  {
    const lastRow = secRows[0].s, s = ST[ST.length - 1];
    const yc = 0.5 * (s.yb + s.yt), hD = 0.5 * (s.yt - s.yb);
    const tip = [];
    for (let h = 0; h <= GEN_RADIAL; h++) {
      const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
      const [dy] = genRing(th, s.w, hD, fu.crownTop, fu.crownSide);
      const t = 0.5 * (1 + dy / Math.max(1e-6, hD));          // 0 = TPB, 1 = TPT
      const p = [fu.postX, N[P.TPB].p[1] + t * (N[P.TPT].p[1] - N[P.TPB].p[1]), 0];
      tip.push(skin.v(B(p), h / GEN_RADIAL, genUVBody(1), [[P.TPB, 1 - t], [P.TPT, t]]));
    }
    for (let h = 0; h < GEN_RADIAL; h++)
      skin.quad(lastRow[h], lastRow[h+1], tip[h+1], tip[h]);
  }
  // ---- 2b. the ENGINE BAY: its own component, its own cover ------------
  // Deliberately NOT the front of the fuselage. Blending a firewall section
  // smoothly into a spinner gives a carrot; a real light aeroplane is a
  // straight-sided box with an engine in it and a cowl over the engine. So the
  // cowl holds full section for `cowl.straight` of its length and only then
  // necks to the spinner, and the block inside it is drawn separately —
  // uncovered in Frame mode, hidden under the cowl in Covered mode.
  const hub = [S.engX - 0.10, S.engY, 0];
  const eng2 = [[P.EL, 0.5], [P.ER, 0.5]];
  {
    const s0 = ST[0], f0 = F[0], CW = S.cowl;
    const yc0 = 0.5 * (s0.yb + s0.yt), hD0 = 0.5 * (s0.yt - s0.yb);
    const xNose = hub[0];                       // flat front face (x is AFT)
    const len = Math.max(0.12, s0.x - xNose);
    // TWO SECTIONS, and the loft runs between them. Aft is the firewall's own
    // ring (same crown, so the joint cannot ridge); forward is the COWL'S OWN
    // nose section, which is centred on the THRUSTLINE and sized by halfW / top
    // / bot. `taper` is already inside the derived nose numbers (60_gen_spec);
    // setting any of the three by hand replaces it there, so it is not applied
    // twice here.
    const nHW = CW.halfW, nT = CW.top, nB = CW.bot;
    const yN = S.engY + 0.5 * (nT - nB), hDN = 0.5 * (nT + nB);   // nose centre/depth
    const fil = Math.min(CW.fillet, 0.40 * Math.min(nHW, hDN), 0.45 * len);
    // A profile step is a fraction along the cowl plus an absolute inset for the
    // fillet. `shrink` is absolute — that is what makes it a true fillet rather
    // than a scale, so the corners round without the face going oval.
    const NF = 4;
    const steps = [{ t: 0, shrink: 0 },
                   { t: (len - fil) / len, shrink: 0 }];
    for (let i = 1; i <= NF; i++) {
      const a = (i / NF) * Math.PI / 2;
      steps.push({ t: (len - fil + fil * Math.sin(a)) / len,
                   shrink: fil * (1 - Math.cos(a)) });
    }
    const rows = steps.map(st => {
      const t2 = st.t;                                  // 0 at the firewall
      const x = s0.x - t2 * len;
      const hw = Math.max(0.02, s0.w + (nHW - s0.w) * t2 - st.shrink);
      const hd = Math.max(0.02, hD0 + (hDN - hD0) * t2 - st.shrink);
      const yc = yc0 + (yN - yc0) * t2;
      const row = [];
      for (let h = 0; h <= GEN_RADIAL; h++) {
        const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
        const [dy, dz] = genRing(th, hw, hd, fu.crownTop, fu.crownSide);
        // weights follow the section's own normalised coordinates, so the
        // covering still flexes with the firewall frame and the engine mounts
        const uz = dz / Math.max(1e-6, hw), uy = dy / Math.max(1e-6, hd);
        const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
        const k = 1 - t2;
        const infl = [[f0.TL, k*wT*wL], [f0.TR, k*wT*wR], [f0.BL, k*wBo*wL],
                      [f0.BR, k*wBo*wR], [P.EL, 0.5*t2], [P.ER, 0.5*t2]];
        // THE COWL HAS ITS OWN SHEET since G4.7: u is the angle around, v runs
        // from the firewall to the nose. It used to sample the body's paint at
        // v = 0.02*(1-t2), i.e. the whole cover squeezed into a 2%-tall sliver of
        // the shared sheet — measured 0.009 of it, which is one texel row at
        // 512 and nothing an intake could be drawn on.
        // The loft stops at GEN_COWL_V and the band above it is the NOSE FACE,
        // mapped as a rim strip: a fan whose whole ring sits at one v has no
        // texture area at all, and the front face is exactly where a spinner
        // ring or a radial's front intake wants to be drawn.
        row.push(cowl.v(B([x, yc + dy, dz]), h / GEN_RADIAL, GEN_COWL_V * t2, infl));
      }
      return row;
    });
    for (let r = 0; r < rows.length - 1; r++)
      for (let h = 0; h < GEN_RADIAL; h++)
        cowl.quad(rows[r+1][h], rows[r+1][h+1], rows[r][h+1], rows[r][h]);
    // flat nose, capped IN the plane of the last ring. (It was inset 12 mm
    // once, which left a lip you could see into — the "big opening".)
    const last = rows[rows.length - 1];
    const capC = cowl.v(B([xNose, yN, 0]), 0.5, 1, eng2);
    for (let h = 0; h < GEN_RADIAL; h++) cowl.tri(capC, last[h+1], last[h]);
    // COOLING INTAKES, one either side of the spinner: recessed dark cylinders
    // rather than painted circles, so they hold a shadow from every angle. The
    // nose was a blank plate with a spike in the middle of it, and the nose is
    // the view a taxiing aeroplane shows most.
    {
      // clear of the spinner, and low on the face: the first attempt put them
      // exactly where the spinner is and they could not be seen at all.
      const rSp0 = Math.max(0.085, 0.17 * S.propR);
      const rI = Math.min(0.070, 0.22 * Math.min(s0.w, hD0));
      for (const sgn of [1, -1]) {
        const cz = sgn * Math.min(0.80 * s0.w * S.cowl.taper - rI,
                                  Math.max(rSp0 + rI + 0.02, 0.52 * s0.w));
        const cy = yc0 - 0.34 * hD0;
        genTubeInto(gcabin, [xNose + 0.004, cy, cz], [xNose + 0.11, cy, cz],
                    rI, 12, eng2, B);
      }
    }
  }
  // the block: crankcase, four cylinders, prop shaft. Its size lives on the spec
  // (S.engBox, 60_gen_spec.js) rather than here, because the COWL has to be able
  // to ask whether it covers the thing — one number, agreed by the cover, the
  // block and the shakedown.
  {
    const E = S.engBox, k = E.k;
    genBoxInto(engine, [E.xF, S.engY - E.halfH, -E.halfW],
                       [E.xA, S.engY + E.halfH, E.halfW], eng2, B);
    for (const sgn of [1, -1]) {
      for (const xc of [S.engX + 0.01 * k, S.engX + 0.14 * k]) {
        genTubeInto(engine, [xc, S.engY - 0.02 * k, sgn * E.halfW],
                    [xc, S.engY + 0.02 * k, sgn * E.cylZ], 0.072 * k, 8, eng2, B);
      }
    }
    genTubeInto(engine, [E.xF, S.engY, 0], [hub[0] + 0.02, S.engY, 0],
                0.035 * k, 8, eng2, B);
  }

  // ---- 3. wing --------------------------------------------------------
  // A section at every spar station, lofted along the span. Chordwise position
  // is affine on the two spar nodes (the spars ARE the chord frame, so the
  // weights are exact and extrapolate past LE and TE); the thickness offset is
  // a rest-frame constant, which is what `base` carries.
  const af = genAirfoil(S.wing.naca);
  const sparF = P.sparFront, sparR = P.sparRear;
  const kOf = xc => (xc - sparF) / (sparR - sparF);
  // Hinge lines follow the chords the player actually set, so a 30% aileron
  // LOOKS like a 30% aileron. The flap band is inboard, the aileron outboard,
  // and clampSpec has already guaranteed the gap between them.
  const CTL = S.controls;
  const aStart = (1 - CTL.aileron.span) * S.geom.semi;
  const AIL_HINGE = 1 - CTL.aileron.chord;
  const FLAP_ON = GEN_FLAPS[CTL.flap.type].dCl > 0;
  const fEnd = FLAP_ON ? CTL.flap.span * S.geom.semi : -1;
  const FLAP_HINGE = 1 - CTL.flap.chord;
  // sidAt: which control surface this station belongs to, or 0. Outboard of
  // aStart is aileron, inboard of fEnd is flap; the hinge fraction differs
  // between them, so the caller passes both and the section picks per vertex.
  // A section from arbitrary spar POINTS with arbitrary influence lists, so a
  // row can sit between spar stations. The node weights are the chordwise blend
  // times the spanwise one, which is exactly what the loft was already doing at
  // the stations themselves — subdividing adds resolution on the same ruled
  // surface and moves no geometry.
  // `pts` is the chord-fraction contour to map — genAfSeg over whatever range
  // this piece needs. It USED to ignore its last argument and always map the
  // full aerofoil `af`, which is how the cut silently did nothing: the fixed
  // skin and the control surface were both built full-chord, so the aeroplane
  // grew a second wing that rotated. Measured: both spanned x -0.492..1.108.
  const wingSectionAt = (pF, pR, wF, wR, chord, pts) => {
    const ch = genV3.norm(genV3.sub(pR, pF));                 // LE -> TE
    // The section's thickness axis must point UP on BOTH wings. Deriving it
    // from the wing's own z sign flipped it on the left, so the aerofoil was
    // built upside down on one side — visible as a mirrored camber, and the
    // centre section came out twisted between the two.
    let nrm = genV3.norm(genV3.cross(ch, [0, 0, 1]));
    if (nrm[1] < 0) nrm = genV3.mul(nrm, -1);
    return (pts || af).map(([xc, yc]) => {
      const base = genV3.add(pF, genV3.mul(ch, (xc - sparF) * chord));
      const p = genV3.add(base, genV3.mul(nrm, yc * chord));
      const k = kOf(xc);
      const infl = [];
      for (const [i2, w2] of wF) if (w2 > 1e-6) infl.push([i2, (1 - k) * w2]);
      for (const [i2, w2] of wR) if (w2 > 1e-6) infl.push([i2, k * w2]);
      return { p, infl, u: xc };
    });
  };
  // `flip` reverses the winding. The left wing is the mirror of the right, so
  // the same index pattern traverses it the other way round and every triangle
  // ends up facing inward — the surface renders (materials are DoubleSide) but
  // computeVertexNormals then lights that whole wing from the wrong side.
  const wingSection = (nF, nR, chord) =>
    wingSectionAt(N[nF].p, N[nR].p, [[nF, 1]], [[nR, 1]], chord, af);

  // ---- 3a. PITOT MAST, on the wing's lower skin ------------------------
  // It hangs UNDER the wing, so its root has to be a point on the lower
  // SURFACE. It used to be a hardcoded 0.10 m below a front-spar NODE, and a
  // spar node is inside the wing: how far inside depends on the aerofoil's
  // thickness at that chord station, which moves with `naca`, `chord` and
  // taper. So the constant was right for exactly one aeroplane — thin the
  // section or lengthen the chord and the mast floated clear of the skin or
  // disappeared up into it.
  //
  // The fix is the same rule the glazing follows: put the part ON the emitted
  // surface rather than near it. `wingSectionAt` with a single lower-surface
  // point from the very evaluator the loft uses returns both the position and
  // the node weights, so the mast is attached by construction and flexes with
  // the wing instead of being fitted to it.
  {
    const i = Math.min(1, P.wf.L.F.length - 1);
    const nF = P.wf.L.F[i], nR = P.wf.L.R[i];
    // chordwise station of the mast: well aft of the leading edge, so it is
    // clear of the LE radius and sits on a part of the section that is
    // genuinely flat-ish whatever the aerofoil
    const XC = 0.35;
    const chord = P.chordAt(Math.abs(N[nF].p[2]));
    const root = wingSectionAt(N[nF].p, N[nR].p, [[nF, 1]], [[nR, 1]], chord,
                               [genAfEval(S.wing.naca).lo(XC)])[0];
    // the mast drops a fixed distance below the skin, and the probe runs
    // forward from its foot into clean air ahead of the leading edge
    const DROP = 0.22, REACH = 0.24;
    const foot = [root.p[0], root.p[1] - DROP, root.p[2]];
    genTubeInto(pitot, root.p, foot, 0.010, 8, root.infl, B);
    genTubeInto(pitot, foot, [foot[0] - REACH, foot[1], foot[2]], 0.011, 8,
                root.infl, B);
  }
  // `close` wraps the last column back onto the first, which is what turns an
  // open aerofoil contour into a closed tube — needed once a section is cut at
  // a hinge, because then its ends no longer meet at a sharp trailing edge.
  const emitLoft = (rows, mesh, vOf, flip, close) => {
    const ids = rows.map((row, r) => row.map(pt =>
      mesh.v(B(pt.p), pt.u, genUVPanel(vOf(r)), pt.infl, pt.sid)));
    for (let r = 0; r < ids.length - 1; r++) {
      const n = ids[r].length, last = close ? n : n - 1;
      for (let h = 0; h < last; h++) {
        const h2 = (h + 1) % n;
        if (flip) mesh.quad(ids[r][h], ids[r+1][h], ids[r+1][h2], ids[r][h2]);
        else      mesh.quad(ids[r][h], ids[r][h2], ids[r+1][h2], ids[r+1][h]);
      }
    }
    return ids;
  };
  const capLoft = (ids, mesh, flip) => {
    // close a section with a fan to its mid-chord point
    for (const row of ids) {
      const n = row.length;
      for (let h = 1; h < n - 1; h++)
        if (flip) mesh.tri(row[0], row[h+1], row[h]);
        else      mesh.tri(row[0], row[h], row[h+1]);
    }
  };
  const W = S.wing, TIP = GEN_TIPS[W.tip] || GEN_TIPS.rounded;
  // ---- 3b. the wing, and its control surfaces as SEPARATE MESHES ----------
  // The fixed skin is lofted over [0..hinge] and each surface over [hinge..1].
  // They are different groups, so a surface is a rigid body with a pivot and an
  // axis — the viewer turns the MESH. Nothing is deformed, so nothing outside
  // the surface can be dragged along by it (the rounded tip used to swing with
  // the aileron because it happened to carry the aileron's vertex tag).
  const NAF = 9, NSURF = 4;          // chordwise points: fixed part / surface
  for (const [side, fw] of [[1, P.wf.R], [-1, P.wf.L]]) {
    const sd = side > 0 ? 'R' : 'L';
    const zAll = [P.zRoot, ...P.zs];
    const zAilEnd = W.tipR > 1e-6 ? W.tipZ : zAll[zAll.length - 1];
    // which surface owns a station, and where its hinge is
    const bandAt = z => {
      if (z > aStart - 1e-6 && z < zAilEnd + 1e-6) return { n: 'ail', h: AIL_HINGE };
      if (FLAP_ON && z < fEnd + 1e-6 && z > P.zRoot - 1e-6) return { n: 'flap', h: FLAP_HINGE };
      return null;
    };
    // spar frame at an arbitrary z, and a section over any chord range
    const frameAt = z => {
      let b2 = 0;
      while (b2 < zAll.length - 2 && z > zAll[b2 + 1]) b2++;
      const z0 = zAll[b2], z1 = zAll[b2 + 1];
      const t = Math.max(0, Math.min(1, (z - z0) / Math.max(1e-9, z1 - z0)));
      const F0 = fw.F[b2], F1 = fw.F[b2 + 1], R0 = fw.R[b2], R1 = fw.R[b2 + 1];
      const lerp = (a3, b3) => [a3[0] + (b3[0]-a3[0])*t, a3[1] + (b3[1]-a3[1])*t,
                                a3[2] + (b3[2]-a3[2])*t];
      return { pF: lerp(N[F0].p, N[F1].p), pR: lerp(N[R0].p, N[R1].p),
               wF: [[F0, 1-t], [F1, t]], wR: [[R0, 1-t], [R1, t]],
               chord: P.chordAt(z) };
    };
    const secAt = (z, a, b, n) => {
      const f = frameAt(z);
      const row = wingSectionAt(f.pF, f.pR, f.wF, f.wR, f.chord, genAfSeg(W.naca, a, b, n));
      row.z0 = z;          // rows get duplicated at band ends, so carry the station
      return row;
    };
    // ---- station list: spar stations + surface edges, then subdivided ----
    const brk = zAll.slice();
    for (const zb of [fEnd, aStart, zAilEnd])
      if (zb > zAll[0] + 1e-3 && zb < zAll[zAll.length-1] - 1e-3) brk.push(zb);
    brk.sort((a2, b2) => a2 - b2);
    const zBrk = brk.filter((v, i) => i === 0 || v - brk[i-1] > 1e-3);
    const zStraight = W.tipR > 1e-6 ? W.tipZ : zAll[zAll.length - 1];
    const zEnd = zBrk.filter(v => v < zStraight - 1e-3).concat([zStraight]);
    const zs2 = [];
    for (let i = 0; i < zEnd.length - 1; i++)
      for (let sg = (i === 0 ? 0 : 1); sg <= GEN_WSEG; sg++)
        zs2.push(zEnd[i] + (zEnd[i+1] - zEnd[i]) * sg / GEN_WSEG);
    // THE BOW, stepped in angle (see G4.3): all curvature, no control surface
    if (W.tipR > 1e-6) {
      const nA = Math.max(2, TIP.arc | 0), thMax = (Math.PI/2) * 0.965;
      for (let i = 1; i <= nA; i++) zs2.push(W.tipZ + W.tipR * Math.sin(thMax * i / nA));
    }
    // ---- fixed skin: cut at the hinge wherever a surface lives ----
    const flip = side < 0;
    // EDGE LOOPS AT THE BAND ENDS. A cut row next to a full-chord row lofts as
    // a RAMP from the hinge line out to the trailing edge, so every band end
    // came out as a triangular wedge instead of a straight cut. (The root end
    // looked right only because the flap band starts at the first station and
    // has no neighbour to ramp from.) Emitting the boundary station TWICE —
    // once with each neighbour's chord range — turns that ramp into a
    // zero-width step, which is the vertical end wall of the cutout: the rib
    // face at the end of a real aileron.
    // The wall belongs to the station INSIDE the band (h !== 1), or the cutout
    // runs a subdivision past the surface that fills it — measured, a flap
    // ending at 2.50 left the wing open to 2.80.
    const hOf = z => { const b = bandAt(z); return b ? b.h : 1; };
    const fixRows = [];
    for (let i = 0; i < zs2.length; i++) {
      const z = zs2[i], h = hOf(z), inBand = Math.abs(h - 1) > 1e-9;
      const starts = inBand && i > 0 && Math.abs(hOf(zs2[i-1]) - h) > 1e-9;
      const ends = inBand && i < zs2.length - 1 && Math.abs(hOf(zs2[i+1]) - h) > 1e-9;
      // Each wall row is emitted TWICE. Rows do not share vertices, but a
      // single boundary row would be shared between the wall strip and the
      // skin strip beside it, and computeVertexNormals then averages a
      // near-vertical face into a near-horizontal one — the dark smear that
      // showed up on every cutout corner. Doubling the row gives the wall its
      // own vertices; the strip between the pair has zero area and so
      // contributes no normal at all.
      if (starts) {
        fixRows.push(secAt(z, 0, hOf(zs2[i-1]), NAF));
        fixRows.push(secAt(z, 0, hOf(zs2[i-1]), NAF));
      }
      fixRows.push(secAt(z, 0, h, NAF));
      if (starts || ends) fixRows.push(secAt(z, 0, h, NAF));
      if (ends) {
        fixRows.push(secAt(z, 0, hOf(zs2[i+1]), NAF));
        fixRows.push(secAt(z, 0, hOf(zs2[i+1]), NAF));
      }
    }
    if (TIP.fin > 0) {
      const h = TIP.fin * W.chord, last = fixRows[fixRows.length-1];
      fixRows.push(last.map(pt => ({ p: [pt.p[0], pt.p[1]+h, pt.p[2] - 0.22*h*side],
        infl: pt.infl, u: pt.u })));
    }
    // UV v is the TRUE span fraction, not the row index. Row-index v put the
    // paint's tip stripe wherever a loft happened to start, and once the
    // control surfaces became their own lofts each of them grew a stripe of its
    // own at its inboard end. Span fraction makes the paint continuous across
    // the cut, which is the point of cutting it there.
    const spanV = z => (z - P.zRoot) / Math.max(1e-6, S.geom.semi - P.zRoot);
    const ids = emitLoft(fixRows, skin, r => spanV(fixRows[r].z0), flip, true);
    capLoft([ids[0], ids[ids.length-1]], skin, flip);
    // ---- each surface: its own group, its own loft ----
    for (const [nm, gname, drive, sgnA, kA, drive2, sgn2] of [
      // da > 0 rolls right, which is right aileron DOWN (the solver raises that
      // wing's alpha). Signs re-measured after the cut became real: while the
      // "surface" was still a full-chord copy its centroid sat FORWARD of the
      // hinge, so every sign came out inverted and calibrated to the wrong body.
      ['ail',  'ail' + sd,  'da', -1, 1.0, null, 0],
      ['flap', 'flap' + sd, 'flap', -side, 0.70, null, 0],
    ]) {
      const zz = zs2.filter(z => { const b = bandAt(z); return b && b.n === nm; });
      if (zz.length < 2) continue;
      const hf = nm === 'ail' ? AIL_HINGE : FLAP_HINGE;
      const M = genMesh();
      const rows = zz.map(z => secAt(z, hf, 1, NSURF));
      const sIds = emitLoft(rows, M, r => spanV(zz[r]), flip, true);
      capLoft([sIds[0], sIds[sIds.length-1]], M, flip);
      // pivot on the hinge line at mid band, axis along it
      const zm = 0.5 * (zz[0] + zz[zz.length-1]);
      const hp = z => {
        const f = frameAt(z), E = genAfEval(W.naca);
        const u = E.up(hf), l = E.lo(hf), xc = 0.5*(u[0]+l[0]), yq = 0.5*(u[1]+l[1]);
        const ch = genV3.norm(genV3.sub(f.pR, f.pF));
        let nr = genV3.norm(genV3.cross(ch, [0,0,1])); if (nr[1] < 0) nr = genV3.mul(nr, -1);
        return genV3.add(genV3.add(f.pF, genV3.mul(ch, (xc - sparF) * f.chord)),
                         genV3.mul(nr, yq * f.chord));
      };
      const pA = hp(zz[0]), pB = hp(zz[zz.length-1]);
      CTRL_MESH.push({ group: gname, mesh: M, pivot: B(hp(zm)),
        axis: genV3.norm(genV3.sub(B(pB), B(pA))),
        drive, sgn: sgnA, k: kA, drive2, sgn2,
        infl: frameAt(zm).wF });
    }
  }
  // ---- centre section: the wing carries through above the cabin ----------
  // Three ways to build it, because on a high wing it IS the cabin roof.
  //   solid  the covering, as before
  //   glass  the same loft in the canopy's material - a skylight over the seats
  //   open   only the UPPER surface, so the wing's own top skin is the roof and
  //          you look up into it, which is what a Cub's centre section does
  {
    const CTR = (S.wing.centre === 'glass' || S.wing.centre === 'open')
      ? S.wing.centre : 'solid';
    let rows = [
      wingSection(P.wf.L.F[0], P.wf.L.R[0], S.wing.chord, 0),
      wingSection(P.wf.R.F[0], P.wf.R.R[0], S.wing.chord, 0),
    ];
    // the carry-through IS the root: both rows sit at span fraction 0. Row
    // index put the tip band on one side of it and the wing walk on the other.
    // the aerofoil contour runs TE -> upper -> LE -> lower -> TE, so its first
    // half IS the upper surface and the cut needs no new sampling
    if (CTR === 'open') rows = rows.map(r => r.slice(0, Math.ceil(r.length / 2)));
    emitLoft(rows, CTR === 'glass' ? canopy : skin, () => 0.02);
  }

  // ---- 4. empennage ---------------------------------------------------
  // Mini-wings on a symmetric section, blending their weights from the tail
  // post inboard to the tip node outboard.
  const sym = genAirfoil(9);                               // NACA 0009
  // A tail panel, cut at its hinge exactly like the wing: the fixed part goes
  // into `skin`, the moving part into its OWN group with a pivot and an axis.
  // `mv` names the surface and what drives it; omit it for a panel with no
  // control surface on it.
  const NTAIL = 7, NTSURF = 3;
  // THE HINGE IS A STRAIGHT LINE AT A STATION, not a constant chord fraction.
  //
  // `hinge` may be a number (a fraction of every row's chord, which is what the
  // V-tail wants — its two panels are untapered) or `{ x }`, a station in the
  // body frame. The station form is what a real tail has: look at any three-view
  // and the rudder and elevator hinges are STRAIGHT. A constant fraction bends
  // with the taper, and once the outline curves into a rounded tip it bends into
  // the tip and takes the control surface with it.
  //
  // A station also gives the Cub's shape for free. Its fin is the small forward
  // slice and the rudder the large aft one, and near the top the leading edge
  // curves aft PAST the hinge — so up there the section is all rudder and there
  // is no fin at all. That falls out here as a row whose fixed part has no
  // chord: such rows are DROPPED rather than emitted, so the fin simply ends
  // where the outline crosses the hinge and gets capped there.
  const panel = (rowsSpec, hinge, mv, tk) => {
    const spanDir = genV3.norm(genV3.sub(rowsSpec[1].le, rowsSpec[0].le));
    const seg = (a2, b2, n) => genAfSeg(9, a2, b2, n);
    // the chord of every tail row runs along x, so a station converts to a
    // fraction directly
    const fracAt = k => {
      const R = rowsSpec[k];
      if (typeof hinge === 'number') return hinge;
      const len = R.te[0] - R.le[0];
      return Math.abs(len) < 1e-9 ? 1 : (hinge.x - R.le[0]) / len;
    };
    const EPS = 0.02;                    // below this a part is a sliver, not a part
    // build over [aOf(k), bOf(k)], keeping each row's ORIGINAL index so the v
    // coordinate does not shift when rows are dropped
    const build = (aOf, bOf, n) => {
      const out = [];
      rowsSpec.forEach(({ le, te, infl }, k) => {
        const a2 = Math.max(0, Math.min(1, aOf(k))), b2 = Math.max(0, Math.min(1, bOf(k)));
        if (b2 - a2 < EPS) return;
        const ch = genV3.norm(genV3.sub(te, le));
        const len = Math.hypot(te[0]-le[0], te[1]-le[1], te[2]-le[2]);
        const nrm = genV3.norm(genV3.cross(ch, spanDir));
        out.push({ k, pts: seg(a2, b2, n).map(([xc, yc]) => ({
          // `tk` scales the section's thickness. The 9-series is 9% of chord,
          // which is right for a flying surface and far too fat for a fairing
          // whose chord is most of the tail cone.
          p: genV3.add(genV3.add(le, genV3.mul(ch, xc * len)),
                       genV3.mul(nrm, yc * len * (tk == null ? 1 : tk))),
          infl, u: xc })) });
      });
      return out;
    };
    // v 0.10..1: the root end clears the wing walk (which lives in the first
    // 8% of the panel zone) while the tip still picks up the tip band.
    const tv0 = k => 0.10 + 0.90 * k / Math.max(1, rowsSpec.length - 1);
    const emit = (built, mesh, close) => {
      const rows = built.map(b => b.pts);
      const ids = emitLoft(rows, mesh, r => tv0(built[r].k), false, close);
      if (ids.length) capLoft([ids[0], ids[ids.length - 1]], mesh);
      return ids;
    };
    const hOf = mv ? fracAt : (() => 1);
    emit(build(() => 0, hOf, NTAIL), skin, !!mv);
    if (!mv) return;
    const M = genMesh();
    const built = build(hOf, () => 1, NTSURF);
    if (!built.length) return;           // no moving surface at all: nothing to hinge
    emit(built, M, true);
    // pivot on the hinge line at mid panel; axis along the hinge. Taken from the
    // rows the MOVING surface actually got, so a hinge that runs out before the
    // tip still gets an axis along the part that exists.
    const onHinge = k => {
      const R = rowsSpec[k], ch = genV3.norm(genV3.sub(R.te, R.le));
      const len = Math.hypot(R.te[0]-R.le[0], R.te[1]-R.le[1], R.te[2]-R.le[2]);
      return genV3.add(R.le, genV3.mul(ch, Math.max(0, Math.min(1, fracAt(k))) * len));
    };
    const a0 = onHinge(built[0].k), a1 = onHinge(built[built.length - 1].k);
    const mid = genV3.mul(genV3.add(a0, a1), 0.5);
    CTRL_MESH.push({ group: mv.g, mesh: M, pivot: B(mid),
      axis: genV3.norm(genV3.sub(B(a1), B(a0))),
      drive: mv.drive, sgn: mv.sgn, k: mv.k || 1,
      drive2: mv.drive2 || null, sgn2: mv.sgn2 || 0, k2: mv.k2 || 1,
      infl: rowsSpec[built[Math.floor(built.length / 2)].k].infl });
  };
  {
    const t = S.tail, hx = t.hX;
    const hy = N[P.HTL].p[1], hz = 0.5 * t.hSpan;
    if (t.type === 'v') {
      // Two canted panels from the tail post out to the tips, and NO fin. The
      // tip nodes already carry the cant (they sit up as well as out), so each
      // panel is just a loft from the post to its own tip.
      const VT = GEN_TIPS[t.tip] || GEN_TIPS.rounded;
      const vpost = [[P.TPB, 0.5], [P.TPT, 0.5]];
      const py = N[P.TPT].p[1] * 0.55 + N[P.TPB].p[1] * 0.45;
      const vRow = (fz, fy, infl, shrink) => {
        const c = t.hChord * (shrink == null ? 1 : shrink);
        const xm = hx + 0.15 * t.hChord;
        return { le: [xm - 0.50*c, fy, fz], te: [xm + 0.50*c, fy, fz], infl };
      };
      for (const [tipN, sgn, vsid] of [[P.HTL, -1, 8], [P.HTR, 1, 7]]) {
        const tz = N[tipN].p[2], ty = N[tipN].p[1];
        const rows = [
          vRow(sgn * 0.10 * Math.abs(tz), py + 0.10 * (ty - py), vpost),
          vRow(tz * 0.55, py + 0.55 * (ty - py), [[tipN, 0.55],
               ...vpost.map(([i, w]) => [i, w * 0.45])]),
          vRow(tz, ty, [[tipN, 1]]),
        ];
        if (VT.round > 0)
          rows.push(vRow(tz + sgn * 0.055 * t.hChord, ty + 0.055 * t.hChord,
                         [[tipN, 1]], VT.round));
        // a V panel is BOTH surfaces: symmetric on the elevator, antisymmetric
        // on the rudder. Two drives, one mesh.
        panel(rows, 0.66, { g: sgn > 0 ? 'vtR' : 'vtL', drive: 'de', sgn: sgn,
                            drive2: 'dr', sgn2: 1 });
      }
      // THE CENTRE SECTION, which is what "the V-tail just intersects" was.
      // Each panel started 10% of the semispan out from the centreline and 10%
      // of the way up, so its root hung in mid air: measured 46 mm clear of the
      // fuselage envelope, and from above you could see the ground between the
      // panel and the body. There was nothing joining the two halves.
      //
      // A fixed loft from the centreline out to each panel's root, so the tail is
      // one continuous surface passing through the fuselage, which is what it is
      // on the aeroplane. Flared 28% in chord at the middle: that flare IS the
      // fillet, and it is where a real V-tail carries its root fairing. FIXED,
      // not part of either ruddervator — which is the whole reason to build it
      // separately, because the two panels deflect differentially on rudder and
      // would saw through each other if they met at the centreline.
      //
      // TWO lofts, one per side, NOT one loft through the middle. `panel` takes
      // its span direction from the first two rows and uses that one normal for
      // every section, so a single V-shaped loft gets the far half's thickness
      // axis wrong — measured, 42 skin vertices with no mirror twin.
      for (const [tipN, sgn] of [[P.HTL, -1], [P.HTR, 1]]) {
        const tz = N[tipN].p[2], ty = N[tipN].p[1];
        panel([vRow(0, py, vpost, 1.28),
               vRow(sgn * 0.10 * Math.abs(tz), py + 0.10 * (ty - py), vpost)],
              1, null);
      }
    } else {
    const post = [[P.TPB, 0.5], [P.TPT, 0.5]];
    // per-surface tips, falling back to the tail's shared one
    const TTIP = GEN_TIPS[t.tipH || t.tip] || GEN_TIPS.rounded;   // tailplane
    const VTIP = GEN_TIPS[t.tipV || t.tip] || GEN_TIPS.rounded;   // fin
    // hChord is the MEAN chord (Sh = hSpan * hChord, and the strips' area comes
    // from Sh), so tapering must hold that mean: root = 2 c / (1 + lambda).
    // Planform only — area and aspect ratio are unchanged, so this shapes the
    // stabiliser without quietly re-tuning the pitch authority under it.
    const hRoot = 2 * t.hChord / (1 + t.hTaper);
    const chAt = z => hRoot * (1 - (1 - t.hTaper) * Math.abs(z) / Math.max(1e-6, hz));
    const stabRow = (z, infl, shrink) => {
      const c = chAt(z) * (shrink == null ? 1 : shrink);
      // taper eats forward and aft of the mid-chord so the panel keeps its
      // spanwise axis where the strips put it
      const xm = hx + 0.15 * t.hChord;
      return { le: [xm - 0.50*c, hy, z], te: [xm + 0.50*c, hy, z], infl };
    };
    const stabRows = [
      stabRow(-hz, [[P.HTL, 1]]),
      stabRow(-0.18*hz, [[P.HTL, 0.30], ...post.map(([i,w]) => [i, w*0.70])]),
      stabRow(0.18*hz, [[P.HTR, 0.30], ...post.map(([i,w]) => [i, w*0.70])]),
      stabRow(hz, [[P.HTR, 1]]),
    ];
    // THE BOW, which is what makes a tailplane elliptical instead of a plank.
    // `bow` is how far out the tip carries as a fraction of the chord and `arc`
    // is how many stations resolve it — the SAME two fields the wing's tip uses,
    // because a builder choosing "Elliptical" means one thing and should get it
    // on every surface.
    //
    // The chord follows a quarter ellipse in the extra span, so the outline
    // leaves the last full-chord station tangentially and closes to a point.
    // This replaces three dead branches: the tail read `TTIP.round`, and NO
    // GEN_TIPS entry has ever had a `round` — `undefined > 0` is false, so every
    // tip option produced byte-identical geometry. Measured before the fix: all
    // six gave the same vertex count AND the same position hash.
    const bowRows = (make, at, sgn) => {
      const nA = Math.max(0, TTIP.arc | 0);
      const out = [];
      for (let i = 1; i <= nA; i++) {
        const th = (Math.PI / 2) * (i / nA) * 0.965;
        out.push(make(at + sgn * TTIP.bow * t.hChord * Math.sin(th), Math.cos(th)));
      }
      return out;
    };
    if (TTIP.bow > 0 && TTIP.arc > 0) {
      for (const r of bowRows((z, c) => stabRow(z, [[P.HTL, 1]], c), -hz, -1).reverse())
        stabRows.unshift(r);
      for (const r of bowRows((z, c) => stabRow(z, [[P.HTR, 1]], c), hz, 1))
        stabRows.push(r);
    }
    // the elevator hinge is a STRAIGHT line across the span, so it is a station
    // and not a fraction: on a tapered stab a fraction bends, and into the bow
    // it would curve away into the tip
    panel(stabRows, { x: hx + 0.15 * t.hChord + 0.16 * hRoot },
          { g: 'elev', drive: 'de', sgn: 1 });
    const vc = t.vChord, vx = t.vX, vy0 = N[P.TPT].p[1], vy1 = N[P.FIN].p[1];
    const finRow = (y, k, sw, shrink) => {
      const c = vc * (shrink == null ? 1 : shrink);
      return { le: [vx - 0.40*vc + sw, y, 0], te: [vx - 0.40*vc + sw + c, y, 0],
        infl: [[P.FIN, k], [P.TPT, (1-k)*0.6], [P.TPB, (1-k)*0.4]] };
    };
    // THE RAKE, from the spec rather than from three constants. The leading edge
    // used to sweep 0, 0.14 and 0.30 of the chord at root, mid and tip — very
    // nearly a straight line, and now exactly one: sweep is an angle and the
    // stations follow it. Left null the spec derives the angle those constants
    // implied, so an untouched fin is the fin it was.
    const finSw = Math.tan((t.vSweep || 0) * Math.PI / 180);
    const swAt = y => finSw * (y - vy0);
    const finRows = [finRow(vy0, 0, swAt(vy0)),
                     finRow(vy0 + 0.5*(vy1-vy0), 0.5, swAt(vy0 + 0.5*(vy1-vy0))),
                     finRow(vy1, 1, swAt(vy1))];
    // the same bow over the top, and the sweep carries on into it so the leading
    // edge and the rounded top are ONE curve — which is the whole point on a
    // Cub, where the fin and the rudder read as a single shape with a hinge
    // drawn through it rather than as two parts that happen to touch
    if (VTIP.bow > 0 && VTIP.arc > 0) {
      const nA = Math.max(1, VTIP.arc | 0);
      for (let i = 1; i <= nA; i++) {
        const th = (Math.PI / 2) * (i / nA) * 0.965, c = Math.cos(th);
        const yB = vy1 + VTIP.bow * vc * Math.sin(th);
        finRows.push(finRow(yB, 1, swAt(yB) + 0.5 * vc * (1 - c), c));
      }
    }
    // THE RUDDER HINGE, a straight vertical line. Above the point where the
    // swept leading edge crosses it there is no fin left at all and the section
    // is entirely rudder — which is exactly what the blueprint shows, and it
    // falls out of `panel` dropping the rows whose fixed part has no chord.
    panel(finRows, { x: vx - 0.40 * vc + 0.60 * vc },
          { g: 'rud', drive: 'dr', sgn: 1 });
    // THE DORSAL FIN, which runs FORWARD.
    //
    // What was here grew the root chord 30% AFT — a wider root, not a dorsal.
    // A real one goes the other way: look at the Cub three-view and a fairing
    // leaves the turtledeck well ahead of the fin and sweeps up into its leading
    // edge. So the leading edge is extended forward at the bottom and that
    // extension fades to nothing where it blends into the fin.
    //
    // `len` is how far forward it reaches, `height` how far up the fin's leading
    // edge it blends, `width` its thickness, and `angle` the slope of its own
    // leading edge. Those four are ONE too many — a triangle is fixed by two of
    // them — so `angle` is nullable and, when set, drives `len` from `height`.
    // Left null it is derived from the two lengths and shown as AUTO, which is
    // the same bargain every other over-determined control in this spec makes.
    const D = t.dorsal || {};
    if (D.len > 0 && D.height > 0) {
      const yTop = vy0 + D.height, yBot = vy0 - 0.07;
      const NR = 5, dRows = [];
      for (let i = 0; i <= NR; i++) {
        const y = yBot + (yTop - yBot) * i / NR;
        // the forward reach fades out toward the top; the exponent is what makes
        // the join a fillet rather than a corner
        const u = Math.max(0, Math.min(1, (y - yBot) / Math.max(1e-6, yTop - yBot)));
        const ext = D.len * Math.pow(1 - u, 1.6);
        const leX = vx - 0.40 * vc + swAt(Math.max(vy0, y)) - ext;
        const teX = vx - 0.40 * vc + swAt(Math.max(vy0, y)) + vc;
        dRows.push({ le: [leX, y, 0], te: [teX, y, 0],
                     infl: [[P.FIN, u * 0.35], [P.TPT, (1 - u * 0.35) * 0.6],
                            [P.TPB, (1 - u * 0.35) * 0.4]] });
      }
      panel(dRows, 1, null, D.width);
    }
    }
  }

  // ---- 5. wheels and propeller ----------------------------------------
  // Tyre and wheel are two materials, so they are two meshes, both revolved
  // about the axle from the profiles at the top of this file. The half-width is
  // tied to the radius: an 8.00-6 bush tyre is 0.20 m across a 0.44 m diameter,
  // which is where 0.40 comes from — the old wheels were 0.055 m half-width on
  // a 0.20 m radius and read as hockey pucks.
  const TYRE_W = 0.40;
  // CAMBER leans the mains: positive tips their tops OUTBOARD, so the axle
  // tilts to (0, -sin g, +-cos g) with the sign following which side the wheel
  // is on. The contact height that falls out of it (R cos g) is already on the
  // spec as contactR and is what the solver stands on — the mesh and the
  // physics read the same number. The third wheel never cambers; a nosewheel or
  // tailwheel castors, and a cambered castor is a shimmy.
  const wheel = (nd, r, camber) => {
    const c = N[nd].p, hw = TYRE_W * r, infl = w1(nd);
    const sgn = c[2] < 0 ? -1 : 1;
    const axis = [0, -Math.sin(camber), sgn * Math.cos(camber)];
    genRevolveInto(tyre, c, axis, r, hw, GEN_TYRE_SECT, GEN_WHEEL_SEG, infl, B);
    genRevolveInto(hubM, c, axis, r, hw, GEN_HUB_SECT, GEN_WHEEL_SEG, infl, B);
  };
  wheel(P.GAL, S.gear.wheelR, S.gear.camberRad);
  wheel(P.GAR, S.gear.wheelR, S.gear.camberRad);
  wheel(P.TW, S.gear.twR, 0);
  // ---- WHEEL FAIRINGS, when the build bought them --------------------------
  // A streamlined shell around the main wheels. It is a LOFT over slices across
  // the axle rather than a revolve: a spat is a teardrop seen from the side and
  // a flat-sided slab seen from the front, which no surface of revolution is.
  //
  // The outline is a symmetric section on the wheel's own chord, so the fairing
  // grows with the wheel it covers instead of being a size somebody typed in.
  // It CLEARS the tyre by construction — the section is scaled to the wheel's
  // diameter plus a margin, which is the same rule the spinner follows for the
  // cowl: parts either clear each other or overlap, never nearly touch.
  if (S.gear.fairing !== 'none') {
    const R = S.gear.wheelR, full = S.gear.fairing === 'full';
    const CH = 2.7 * R, TH = 1.28 * R;      // chord and half-height of the shell
    const HW = 0.62 * R;                    // half-width across the axle
    const E = genAfEval(12);                // a fat symmetric section: a trouser
    const NS = 7, NZ = 4;
    for (const nd of [P.GAL, P.GAR]) {
      const c = N[nd].p, infl = w1(nd), sgn = c[2] < 0 ? -1 : 1;
      // slices across the axle, the outer two pulled in to close the shell
      const rows = [];
      for (let j = 0; j <= NZ; j++) {
        const t2 = j / NZ, zz = c[2] + sgn * (-HW + 2 * HW * t2);
        // a flat-sided middle with rounded shoulders, not an ellipse
        const w = Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, t2))), 0.38);
        const row = [];
        for (let i = 0; i <= NS; i++) {
          const xc = i / NS;
          const up = E.up(xc), lo = E.lo(xc);
          row.push([c[0] + (xc - 0.42) * CH, c[1] + up[1] / 0.12 * TH * w, zz]);
          row.unshift([c[0] + (xc - 0.42) * CH, c[1] + lo[1] / 0.12 * TH * w, zz]);
        }
        rows.push(row);
      }
      // the leg comes out through the top on a `full` trouser, so that face is
      // left open; a `spat` is closed all round
      const ids = rows.map((row, r) => row.map((pp, i) =>
        strut.v(B(pp), i / row.length, r / NZ, infl)));
      for (let r = 0; r < ids.length - 1; r++)
        for (let i = 0; i < ids[r].length; i++) {
          const i2 = (i + 1) % ids[r].length;
          if (full && r === ids.length - 2 && i > ids[r].length * 0.35
                   && i < ids[r].length * 0.65) continue;
          strut.quad(ids[r][i], ids[r][i2], ids[r+1][i2], ids[r+1][i]);
        }
    }
  }
  {
    const eng = [[P.EL, 0.5], [P.ER, 0.5]];
    // The spinner used to be a twelve-sided cone with a point on it, drawn
    // here. It is now a revolved ogive built with the blades below, because the
    // two share the one rule that matters — nothing the propeller owns may
    // touch the cowl — and a rule enforced in two places is a rule that drifts.
    // DRIVEN BY THE TRUNK'S PROP GROUP, which is the one the solver pulls on:
    // same disc, same blade count, same pitch choice. The session drove this
    // from a per-engine `engines[0].prop` with a numeric pitch and no physics
    // behind it — that spec is gone, and taking it back would have unhooked the
    // propeller you can see from the propeller that makes the thrust.
    //
    // `pd` is the pitch as a fraction of the DIAMETER, which is what the twist
    // law below needs and what is written on a real prop. It is a field on
    // GEN_PROP_PITCH beside `fm`, NOT derived from it: `fm` is a momentum-theory
    // efficiency and runs the other way round.
    const PR = S.prop, R = S.propR;
    const nBl = Math.max(2, Math.min(6, PR.blades | 0 || 2));
    const pitch = (GEN_PROP_PITCH[PR.pitch] || GEN_PROP_PITCH.standard).pd;
    const cFrac = PR.chord, rootF = PR.root;
    // ---- SPINNER, and the one hard rule: NOTHING TOUCHES THE COWL ----------
    // `hub[0]` is the cowl's flat nose face. x is AFT, so everything the propeller
    // owns must live at x < xFace - GAP. The old blades were pinned 6 mm AFT of
    // that face and their chord swung another 60 mm back, i.e. the propeller was
    // drawn inside the engine bay.
    const GAP = 0.008, xFace = hub[0];
    const SP = PR.spinner || {};
    const spShape = ['ogive', 'cone', 'dome', 'none'].includes(SP.shape) ? SP.shape : 'ogive';
    const rSp = Math.max(0.055, (SP.dia == null ? 0.17 : genClamp(SP.dia, 0.08, 0.32)) * R);
    const spLen = (SP.len == null ? 2.2 : genClamp(SP.len, 0.6, 4.0)) * rSp;
    // the profile is one family with an exponent: a cone is straight, an ogive is
    // full, a dome is a hemisphere. Sampled coarsely — it is a small object.
    const spExp = spShape === 'cone' ? 1.0 : spShape === 'dome' ? 2.4 : 1.7;
    const SPS = [];
    {
      const NSp = 9;
      for (let i = 0; i <= NSp; i++) {
        const t2 = i / NSp;
        SPS.push([Math.pow(Math.max(0, 1 - Math.pow(t2, spExp)), 1 / spExp), 1 - 2 * t2]);
      }
      // no duplicate apex row: two consecutive r = 0 rows have no ring between
      // them, and genRevolveInto would read a row that does not exist
    }
    const xSpB = xFace - GAP;                       // spinner base, on the face
    if (spShape !== 'none')
      genRevolveInto(spinner, [xSpB - 0.5 * spLen, S.engY, 0], [1, 0, 0],
                     rSp, 0.5 * spLen, SPS, 20, eng, B);
    // ---- BLADES ----------------------------------------------------------
    // Aerofoil sections on a twist law, thick and round at the root, thin and
    // flat at the tip. Nine stations, thirteen points: about 210 triangles a
    // blade, which is the least a twisted surface reads correctly at.
    const E = genAfEval(4412);
    const NB = 6, NR = 8;
    // the disc sits a third of the way up the spinner, which is where a blade
    // actually leaves it
    const xDisc0 = xSpB - (spShape === 'none' ? 0.02 : 0.34 * spLen);
    // THE ROOT STARTS INSIDE THE SPINNER. `root` is a fraction of the RADIUS, so
    // on a slender nose — a cone above all, which is the thinnest of the family
    // at any station — the first blade station could sit outside the spinner's
    // own surface and the blade floated clear of it. The rule is the same one the
    // cowl clearance uses, in the other direction: measure the spinner where the
    // disc actually is and bury the root well inside it. Nothing is co-planar and
    // nothing is nearly-touching; parts either clear each other or overlap.
    const tDisc = spShape === 'none' ? 1 : 0.34;
    const rDisc = spShape === 'none' ? 0
      : rSp * Math.pow(Math.max(0, 1 - Math.pow(tDisc, spExp)), 1 / spExp);
    const rRoot = spShape === 'none' ? rootF * R
      : Math.min(rootF * R, 0.72 * rDisc);
    const bladeRows = [];
    let xMax = -1e9;
    for (let i = 0; i <= NR; i++) {
      const t2 = i / NR, r = rRoot + (R - rRoot) * t2;
      // planform: widest around a third out, closing to a round tip
      const shape = 0.62 + 0.60 * Math.sin(Math.PI * Math.min(1, 0.24 + 0.86 * t2));
      const tipR = t2 > 0.90 ? Math.sqrt(Math.max(0, 1 - ((t2 - 0.90) / 0.104) ** 2)) : 1;
      const cw = cFrac * R * shape * tipR;
      // THE PITCH LAW. atan(P / 2 pi r) — coarse inboard, fine outboard, and
      // exactly as coarse as the pitch says.
      const tw = Math.atan((pitch * 2 * R) / (2 * Math.PI * Math.max(0.04, r)));
      // thickness ratio falls from a fat root to a thin tip; the section is a
      // 4412 scaled about its own chord line, so one evaluator serves all of it
      const tk = (0.20 - 0.13 * t2) / 0.12;
      const ch = [Math.sin(tw), 0, Math.cos(tw)];
      const pts = [];
      for (let q = NB; q >= 0; q--) pts.push(E.up(q / NB));
      for (let q = 1; q <= NB; q++) pts.push(E.lo(q / NB));
      const row = pts.map(([xc, yc]) => {
        const yS = yc * tk;
        const p = [xDisc0 + ch[0] * (xc - 0.42) * cw - ch[2] * yS * cw,
                   r,
                   ch[2] * (xc - 0.42) * cw + ch[0] * yS * cw];
        xMax = Math.max(xMax, p[0]);
        return { p, u: xc, v: t2 };
      });
      bladeRows.push(row);
    }
    // NOTHING TOUCHES THE COWL, enforced rather than hoped for: whatever the
    // pitch and chord came out as, the whole blade is walked forward until its
    // aft-most vertex clears the face. This is the check that makes the
    // parametrisation safe — a coarse, wide blade swings a long way back.
    const shift = Math.max(0, xMax - (xFace - GAP));
    // blade b is the first blade turned about the thrust axis
    const bladeAt = (row, ang) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      return row.map(pt => ({
        p: [pt.p[0] - shift, S.engY + pt.p[1] * ca - pt.p[2] * sa,
            pt.p[1] * sa + pt.p[2] * ca],
        u: pt.u, v: pt.v }));
    };
    for (let b = 0; b < nBl; b++) {
      const ang = 2 * Math.PI * b / nBl;
      const rows = bladeRows.map(row => bladeAt(row, ang));
      // the outboard tenth is the tip stripe, and so it is its own group: a
      // painted blade tip is how a propeller reads as a propeller when stopped.
      const emit = (M, i0, i1) => {
        const ids = [];
        for (let i = i0; i <= i1; i++)
          ids.push(rows[i].map(pt => M.v(B(pt.p), pt.u, pt.v, eng)));
        for (let i = 0; i < ids.length - 1; i++) {
          const n = ids[i].length;
          for (let h = 0; h < n; h++) {
            const h2 = (h + 1) % n;
            M.quad(ids[i][h], ids[i][h2], ids[i+1][h2], ids[i+1][h]);
          }
        }
        return ids;
      };
      const iS = NR - 1;
      const rootIds = emit(prop, 0, iS), tipIds = emit(proptip, iS, NR);
      for (const [ids, M, first] of [[rootIds, prop, true], [tipIds, proptip, false]]) {
        const row = ids[first ? 0 : ids.length - 1], n = row.length;
        for (let h = 1; h < n - 1; h++)
          if (first) M.tri(row[0], row[h+1], row[h]);
          else       M.tri(row[0], row[h], row[h+1]);
      }
    }
  }

  // ---- 6. control surface hinges --------------------------------------
  // Analytic, because the geometry is known. (An imported model has to have
  // these least-squares fitted off the mesh — see MODEL-IMPORT-PROC.md.)
  const bp = p => B(p);
  const hingeAxis = (a, b) => {
    const d = genV3.norm(genV3.sub(bp(b), bp(a)));
    return d;
  };
  const t = S.tail;
  const stabY = N[P.HTL].p[1];
  const semi = S.geom.semi, zA = 0.5 * (aStart + semi);
  // THE SURFACE TABLE. Its length and ORDER are a contract: a skin vertex
  // carries `sid` and the hinge pass resolves surfaces[sid-1], so an entry can
  // never be dropped for a configuration that lacks it — that renumbers
  // everything after it. Every entry is always present; the ones this aeroplane
  // does not have are made inert with k:0. (Learned the hard way on the V-tail:
  // removing the rudder sent the ailerons reading past the end of the array.)
  //
  //   1 elevator   2 rudder   3 ailR   4 ailL
  //   5 flapR      6 flapL    7 vtailR 8 vtailL
  const isV = t.type === 'v';
  const FLAP_K = 0.70;             // ~40 deg at ctl.flap = 1, which is full flap
  const zF = 0.5 * (P.zRoot + Math.max(P.zRoot + 0.1, fEnd));
  // SIGNS. The left and right hinge AXES are mirrored (they run out along their
  // own semispan), so an equal `sgn` on the two sides produces OPPOSITE motion
  // in the world and a mirrored `sgn` produces the SAME motion. That inversion
  // is why the ailerons had been deflecting together — measured, both wings
  // +0.020 m on da — and why every pair below looks back-to-front at a glance.
  //   ailerons  antisymmetric -> equal sgn
  //   flaps     symmetric     -> mirrored sgn
  const flapSurf = (sgn2side) => ({
    name: sgn2side > 0 ? 'flapR' : 'flapL', drive: 'flap', sgn: -sgn2side,
    k: FLAP_ON ? FLAP_K : 0,
    p: bp([P.xFat(zF) + (FLAP_HINGE - sparF) * P.chordAt(zF),
           P.yF(zF), sgn2side * zF]),
    ax: hingeAxis([0, P.yF(P.zRoot), sgn2side * P.zRoot],
                  [0, P.yF(Math.max(P.zRoot + 0.1, fEnd)),
                   sgn2side * Math.max(P.zRoot + 0.1, fEnd)]),
  });
  // A V-tail panel is BOTH surfaces at once: symmetric on the elevator,
  // antisymmetric on the rudder. Hence drive2.
  const vSurf = (tipN, sd) => {
    const tip = N[tipN].p, post = [t.hX, N[P.TPT].p[1] * 0.55 + N[P.TPB].p[1] * 0.45, 0];
    const mid = [0.5*(tip[0]+post[0]), 0.5*(tip[1]+post[1]), 0.5*(tip[2]+post[2])];
    return { name: sd > 0 ? 'vtailR' : 'vtailL',
      // elevator half: SYMMETRIC, so mirrored sgn. rudder half: ANTIsymmetric,
      // so equal sgn. The two halves of a ruddervator want opposite conventions.
      drive: 'de', sgn: sd, k: isV ? 1.0 : 0,
      drive2: 'dr', sgn2: 1, k2: isV ? 1.0 : 0,
      p: bp([t.hX + 0.15 * t.hChord, mid[1], mid[2]]),
      ax: hingeAxis([0, post[1], post[2]], [0, tip[1], tip[2]]) };
  };
  const surfaces = [
    { name: 'elevator', drive: 'de', sgn: 1, k: isV ? 0 : 1.0,
      p: bp([t.hX + 0.31 * t.hChord, stabY, 0]),
      ax: hingeAxis([t.hX + 0.31*t.hChord, stabY, -1], [t.hX + 0.31*t.hChord, stabY, 1]) },
    { name: 'rudder', drive: 'dr', sgn: 1, k: (isV || P.FIN == null) ? 0 : 1.0,
      p: bp([t.vX + 0.20 * t.vChord, N[P.TPT].p[1], 0]),
      ax: hingeAxis([t.vX + 0.20*t.vChord, N[P.TPT].p[1], 0],
                    [t.vX + 0.20*t.vChord + 0.30*t.vChord,
                     P.FIN == null ? N[P.TPT].p[1] + 1 : N[P.FIN].p[1], 0]) },
    { name: 'ailR', drive: 'da', sgn: 1, k: 1.0,
      p: bp([P.xFat(zA) + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), zA]),
      ax: hingeAxis([0, P.yF(aStart), aStart], [0, P.yF(semi), semi]) },
    { name: 'ailL', drive: 'da', sgn: 1, k: 1.0,   // equal, not mirrored: see above
      p: bp([P.xFat(zA) + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), -zA]),
      ax: hingeAxis([0, P.yF(aStart), -aStart], [0, P.yF(semi), -semi]) },
    flapSurf(1), flapSurf(-1),
    vSurf(P.HTR, 1), vSurf(P.HTL, -1),
  ];


  // ---- 2h. SEATS -------------------------------------------------------
  // A light aeroplane's seat is a welded tube frame with two cushions laced or
  // dropped into it: a squab on a shallow pan and a back that rakes about 12
  // degrees, both piped round the edge, both fluted into panels by the seams the
  // upholsterer runs to stop the filling migrating. That is four things — frame,
  // pan, cushion, piping — and leaving any of them out is what makes a seat read
  // as a box. Nothing here is a primitive: the cushions are PUFFED SLABS, i.e. a
  // grid whose thickness falls to zero at the rim on a soft power curve and is
  // grooved along the seam lines, which is how a filled cushion actually sits.
  //
  // Everything binds to the cabin frames it stands between, with the same
  // bilinear weights the covering uses, so the seats flex with the fuselage.
  {
    const cb = S.cab;
    const seatsN = S.seating === 'drone' ? 0 : (S.seating === 'single' ? 1 : 2);
    // where the frames put them: tandem down the centreline, side-by-side across
    // SEAT STATION. An OFFSET from where the layout puts them, so it rides along
    // when the cabin moves instead of pinning the seats to an absolute x — and
    // so zero means "right" in every layout rather than in one of them.
    //
    // RE-ZEROED (user, 2026-08-11). The base used to be the cabin front for all
    // layouts, and the two layouts do not want the same station: a tandem's
    // front seat sits well aft of the firewall (the panel, the tank and the
    // rudder pedals are in front of it), while a side-by-side is one row on the
    // cabin's own centre. Measured on the two builds the user calibrated, the
    // good stations were +0.41 tandem and -0.03 side by side against the old
    // common base — 0.44 m apart, which is that difference. Both are folded into
    // the base here, so the slider is now a nudge about a correct default in
    // either layout and neither carries a constant the other has to undo.
    const SEAT_BASE = { side2: -0.03, tandem2: 0.41, single: 0.41, drone: 0 };
    const sdx = (SEAT_BASE[S.seating] ?? 0.41)
              + genClamp(cb.seatX == null ? 0 : cb.seatX, -0.45, 0.45);
    const x0 = cb.noseGap + sdx, xL = Math.max(0.35, cb.len);
    const places = [];
    if (seatsN === 1) places.push([x0 + 0.50 * xL, 0]);
    else if (S.seating === 'side2') {
      const dz = Math.min(0.30, cb.halfW * 0.50);
      places.push([x0 + 0.52 * xL, -dz], [x0 + 0.52 * xL, dz]);
    } else if (seatsN === 2) {
      // TANDEM PITCH IS A REAL DISTANCE, not a fraction of the cabin. It was
      // 0.46 of the cabin length, and `tandem2` sizes its box at 0.78 m — so the
      // two seats came out 0.36 m apart and the back-seater had nowhere to put
      // his knees. A tandem aeroplane's seat pitch is 0.80-0.95 m whatever the
      // fuselage does, so that is what this is: a metre value, defaulting to the
      // cabin's own length where the cabin is long enough to beat it.
      const pitch = genClamp(cb.seatPitch == null ? 0.86 : cb.seatPitch, 0.55, 1.35);
      const mid = x0 + 0.53 * xL;
      places.push([mid - 0.5 * pitch, 0], [mid + 0.5 * pitch, 0]);
    }
    // bilinear cabin weights at a point, exactly the covering's formula
    const cabInfl = (x, y, z) => {
      let i0 = 0;
      for (let i = 0; i < ST.length - 1; i++) if (ST[i].x <= x) i0 = i;
      const i1 = Math.min(ST.length - 1, i0 + 1);
      const t = Math.max(0, Math.min(1, (x - ST[i0].x) / Math.max(1e-6, ST[i1].x - ST[i0].x)));
      const w = ST[i0].w + (ST[i1].w - ST[i0].w) * t;
      const yb = ST[i0].yb + (ST[i1].yb - ST[i0].yb) * t;
      const yt = ST[i0].yt + (ST[i1].yt - ST[i0].yt) * t;
      const uz = Math.max(-1, Math.min(1, z / Math.max(1e-6, w)));
      const uy = Math.max(-1, Math.min(1, (y - 0.5 * (yb + yt)) / Math.max(1e-6, 0.5 * (yt - yb))));
      const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wB = 0.5*(1-uy);
      const A = F[i0], C = F[i1], kA = 1 - t, kB = t;
      return [[A.TL, kA*wT*wL], [A.TR, kA*wT*wR], [A.BL, kA*wB*wL], [A.BR, kA*wB*wR],
              [C.TL, kB*wT*wL], [C.TR, kB*wT*wR], [C.BL, kB*wB*wL], [C.BR, kB*wB*wR]];
    };
    // A PUFFED SLAB. `ori` maps (across, along, up) into body axes, so the same
    // builder makes the squab lying down and the back standing up. `flutes` is
    // how many seams run ACROSS it; the grooves are gaussian, not steps, because
    // a seam pulls the filling down over a finite width.
    const cushion = (ctr, hw, hd, th, ori, flutes, tuck) => {
      const NU = 14, NV = 16;
      const P3 = (a, b, up) => {
        const p = [0, 0, 0];
        for (let k = 0; k < 3; k++)
          p[k] = ctr[k] + ori[0][k] * a * hw + ori[1][k] * b * hd + ori[2][k] * up;
        return p;
      };
      // ROUNDER than a slab with soft corners: the exponent pair sets how far in
      // from the rim the filling starts to rise, and a cushion rises fast and
      // then sits nearly flat. 3 / 0.45 is a filled squab; 5 / 0.30 was a board.
      const puff = (a, b) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(a), 3)), 0.45)
                           * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(b), 3)), 0.45);
      const groove = b => {
        let g = 1;
        for (let f = 1; f <= flutes; f++) {
          const bf = -1 + 2 * f / (flutes + 1);
          const d = (b - bf) / 0.085;
          g -= 0.30 * Math.exp(-d * d);
        }
        return Math.max(0.45, g);
      };
      const grid = (sgn) => {
        const rows = [];
        for (let i = 0; i <= NU; i++) {
          const a = -1 + 2 * i / NU, row = [];
          for (let j = 0; j <= NV; j++) {
            const b = -1 + 2 * j / NV;
            const pf = puff(a, b);
            // the top face is the filled one; the underside is shallow and, on a
            // squab, tucked where it meets the pan
            const up = sgn > 0 ? th * pf * groove(b)
                               : -th * pf * (tuck ? 0.20 : 0.45);
            const p = P3(a, b, up);
            row.push(seat.v(B(p), 0.5 + 0.5 * a, 0.5 + 0.5 * b, cabInfl(p[0], p[1], p[2])));
          }
          rows.push(row);
        }
        return rows;
      };
      const top = grid(1), bot = grid(-1);
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        seat.quad(top[i][j], top[i][j+1], top[i+1][j+1], top[i+1][j]);
        seat.quad(bot[i][j], bot[i+1][j], bot[i+1][j+1], bot[i][j+1]);
      }
      // PIPING round the rim: the welt an upholsterer sews into the seam. It is
      // the line that gives a cushion its shape at a distance, so it is its own
      // material in the trim colour.
      const rim = [];
      for (let j = 0; j <= NV; j++) rim.push([-1, -1 + 2*j/NV]);
      for (let i = 1; i <= NU; i++) rim.push([-1 + 2*i/NU, 1]);
      for (let j = NV - 1; j >= 0; j--) rim.push([1, -1 + 2*j/NV]);
      for (let i = NU - 1; i >= 0; i--) rim.push([-1 + 2*i/NU, -1]);
      for (let k = 0; k < rim.length - 1; k++) {
        const A = P3(rim[k][0], rim[k][1], 0), C = P3(rim[k+1][0], rim[k+1][1], 0);
        genTubeInto(spipe, A, C, 0.009, 6, cabInfl(A[0], A[1], A[2]), B);
      }
    };
    const tube = (a, c, r) => genTubeInto(sframe, a, c, r || 0.014, 8,
                                          cabInfl(a[0], a[1], a[2]), B);
    const PIL = S.cabin.pilot || {};
    let seatIdx = 0;
    for (const [sx, sz] of places) {
      const floor = -0.01;                       // cabin floor, above the keel
      const hw = Math.min(0.24, (S.seating === 'side2' ? cb.halfW * 0.42 : cb.halfW * 0.80));
      // SQUAB HEIGHT above the cabin floor. The seat is what sets the pilot's
      // eye line and whether his knees clear the panel, so it is a control and
      // not the 0.20 m it was pinned at.
      const panY = floor + genClamp(cb.seatY == null ? 0.20 : cb.seatY, 0.06, 0.50);
      const rake = 13 * Math.PI / 180;           // back angle
      const backH = Math.min(0.56, cb.h * 0.60);
      // the squab: lying flat, a touch nose-down so you do not slide out
      cushion([sx, panY, sz], hw, 0.22, 0.075,
              [[0, 0, 1], [1, -0.06, 0], [0, 1, 0]], 2, true);
      // the back: standing up, raked aft about its foot
      const bc = Math.cos(rake), bs = Math.sin(rake);
      cushion([sx + 0.20 + 0.5 * backH * bs, panY + 0.02 + 0.5 * backH * bc, sz],
              hw * 0.96, 0.5 * backH, 0.062,
              [[0, 0, 1], [bs, bc, 0], [-bc, bs, 0]], 3, false);
      // ---- the frame: two side loops and the cross tubes between them ----
      for (const s2 of [-1, 1]) {
        const zz = sz + s2 * (hw + 0.012);
        const front = [sx - 0.21, floor, zz], frontT = [sx - 0.19, panY - 0.03, zz];
        const rear = [sx + 0.20, floor, zz], rearT = [sx + 0.19, panY - 0.03, zz];
        const backT = [sx + 0.20 + backH * bs, panY - 0.02 + backH * bc, zz];
        tube(front, frontT);                     // front leg
        tube(rear, rearT);                       // rear leg
        tube(frontT, rearT);                     // seat rail
        tube(rearT, backT, 0.013);               // back upright
        tube(front, rearT, 0.010);               // the diagonal every seat has
      }
      const zl = sz - (hw + 0.012), zr = sz + (hw + 0.012);
      tube([sx - 0.19, panY - 0.03, zl], [sx - 0.19, panY - 0.03, zr], 0.012);
      tube([sx + 0.19, panY - 0.03, zl], [sx + 0.19, panY - 0.03, zr], 0.012);
      tube([sx - 0.21, floor, zl], [sx - 0.21, floor, zr], 0.011);
      tube([sx + 0.20, floor, zl], [sx + 0.20, floor, zr], 0.011);
      // the top rail, which is what you grab climbing in
      tube([sx + 0.20 + backH * bs, panY - 0.02 + backH * bc, zl],
           [sx + 0.20 + backH * bs, panY - 0.02 + backH * bc, zr], 0.013);
      // ---- LAP BELTS, hanging ------------------------------------------
      // Anchored at the rear corners of the frame, laid over the squab's rim and
      // left hanging down the front, which is how a lap belt sits in an unoccupied
      // aeroplane and what stops the seat reading as furniture. A RIBBON, not a
      // tube: webbing is flat, and its flatness is most of what identifies it.
      const ribbon = (pts, wid, tw) => {
        let prev = null;
        for (let k = 0; k < pts.length - 1; k++) {
          const A = pts[k], C = pts[k+1];
          const ax = genV3.norm(genV3.sub(C, A));
          // the strap's width lies across the path and level; the twist rolls it
          // over as it goes over the rim, which is what webbing does
          let across = genV3.norm(genV3.cross(ax, [0, 1, 0]));
          if (!isFinite(across[0])) across = [0, 0, 1];
          const th = (tw || 0) * (k / Math.max(1, pts.length - 2));
          const up = genV3.norm(genV3.cross(across, ax));
          const e1 = [across[0]*Math.cos(th) + up[0]*Math.sin(th),
                      across[1]*Math.cos(th) + up[1]*Math.sin(th),
                      across[2]*Math.cos(th) + up[2]*Math.sin(th)];
          const e2 = genV3.mul(genV3.norm(genV3.cross(ax, e1)), 0.0035);
          const quadAt = (Pt) => [0, 1, 2, 3].map(q => {
            const sgnW = (q === 0 || q === 3) ? -1 : 1, sgnT = q < 2 ? 1 : -1;
            const p = [0, 0, 0];
            for (let c2 = 0; c2 < 3; c2++)
              p[c2] = Pt[c2] + e1[c2] * sgnW * 0.5 * wid + e2[c2] * sgnT;
            return belt.v(B(p), q < 2 ? 0 : 1, k / (pts.length - 1),
                          cabInfl(p[0], p[1], p[2]));
          });
          const a4 = prev || quadAt(A), c4 = quadAt(C);
          belt.quad(a4[0], a4[1], c4[1], c4[0]);
          belt.quad(a4[3], c4[3], c4[2], a4[2]);
          belt.quad(a4[0], c4[0], c4[3], a4[3]);
          belt.quad(a4[1], a4[2], c4[2], c4[1]);
          prev = c4;
        }
      };
      for (const s3 of [-1, 1]) {
        const zz = sz + s3 * (hw + 0.010);
        ribbon([
          [sx + 0.19, panY - 0.045, zz],
          [sx + 0.10, panY + 0.015, sz + s3 * hw * 0.96],
          [sx - 0.06, panY + 0.020, sz + s3 * hw * 0.88],
          [sx - 0.17, panY - 0.055, sz + s3 * hw * 0.80],
          [sx - 0.19, panY - 0.155, sz + s3 * hw * 0.74],
          [sx - 0.17, panY - 0.235, sz + s3 * hw * 0.72],
        ], 0.048, 0.5);
        // the hardware at the loose end: a buckle on one side, the tongue on the
        // other, both hanging where the webbing left off
        const bx = sx - 0.17, by = panY - 0.255, bz = sz + s3 * hw * 0.72;
        const inf = cabInfl(bx, by, bz);
        if (s3 > 0) genBoxInto(buckle, [bx - 0.030, by - 0.036, bz - 0.026],
                                       [bx + 0.030, by + 0.010, bz - 0.018], inf, B);
        else genBoxInto(buckle, [bx - 0.016, by - 0.050, bz + 0.018],
                                [bx + 0.016, by + 0.010, bz + 0.024], inf, B);
      }
      // ---- 2i. THE DUMMY ------------------------------------------------
      // A crash-test dummy, because an empty cockpit has no scale and a figure
      // with a face has an expression to get wrong. It is a small FORWARD-
      // KINEMATIC RIG: joint centres are anthropometric fractions of the stature,
      // the pose is seven angles, and every segment is a tapered capsule between
      // two of those centres — so the limbs cannot come apart, whatever the pose
      // or the cabin does. The rig is anchored at the HIP on the squab, because
      // sitting height is what has to fit, and every chain hangs off the one
      // before it: move the hip and the whole figure goes with it.
      if (PIL.show !== false && seatIdx < S.crew) {
        const H = genClamp(PIL.stature == null ? 1.75 : PIL.stature, 1.45, 2.05);
        const D2 = Math.PI / 180;
        const ang = (v, d) => (v == null ? d : v) * D2;
        const lean = ang(PIL.lean, 13), thighA = ang(PIL.thigh, 6);
        const shankA = ang(PIL.shank, 56), armA = ang(PIL.armDown, 40);
        const foreA = ang(PIL.fore, 6), headA = ang(PIL.head, 0);
        // ARMS IN. A canopy can be narrower than a pair of elbows, so the upper
        // arm's outboard splay is a control and not a constant: `armIn` subtracts
        // from it, and the forearm follows by a third of the same, which is how a
        // real elbow tucks (the shoulder adducts, the forearm mostly doesn't).
        const armIn = ang(PIL.armIn, 0);
        // FEET. `ankle` is the foot's pitch about the ankle joint, positive toes
        // UP — a pilot on the rudder pedals has them up, a pilot with feet on the
        // floor has them level. `toeOut` splays them.
        const ankA = ang(PIL.ankle, 10), toeOut = ang(PIL.toeOut, 7);
        // THE HIP AND THE KNEE, outboard. `thigh` and `shank` are the FLEXION
        // angles — how far below horizontal each segment runs — and they were the
        // only leg controls there were. These are the other axis: how far the
        // knees splay from the centreline, which is what a narrow cockpit or a
        // tank between the legs actually constrains. Same convention as the arm:
        // the hip carries it and the knee adds its own.
        const hipOut = ang(PIL.hipOut, 9), kneeOut = ang(PIL.kneeOut, 3);
        // segment lengths as fractions of stature (Drillis & Contini)
        const Lthigh = 0.245*H, Lshank = 0.246*H, Lfoot = 0.152*H;
        const Ltorso = 0.288*H, Lneck = 0.052*H, Lhead = 0.130*H;
        const Lupper = 0.186*H, Lfore = 0.146*H, Lhand = 0.108*H;
        const wHip = 0.070*H, wSho = 0.105*H;
        const add = genV3.add, mul = genV3.mul;
        // ---- a tapered CAPSULE between two joint centres --------------------
        // Round ends by construction: the profile runs from -rA to L + rB and
        // closes on a sphere at each cap, so two segments sharing a joint centre
        // always overlap and a limb cannot show a gap however it is posed.
        const capsule = (M, A, C, rA, rB, kz) => {
          const d = genV3.sub(C, A), L = Math.hypot(d[0], d[1], d[2]) || 1e-6;
          const ax = mul(d, 1 / L);
          const upv = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
          const e1 = genV3.norm(genV3.cross(ax, upv)), e2 = genV3.cross(ax, e1);
          const NL = 9, NC = 9, rows = [];
          for (let i = 0; i <= NL; i++) {
            const x = -rA + (L + rA + rB) * i / NL;
            const u = Math.max(0, Math.min(1, x / L));
            let r = rA + (rB - rA) * u;
            if (x < 0) r *= Math.sqrt(Math.max(0, 1 - (x / rA) * (x / rA)));
            else if (x > L) r *= Math.sqrt(Math.max(0, 1 - ((x - L) / rB) * ((x - L) / rB)));
            const base = add(A, mul(ax, x)), row = [];
            for (let h = 0; h <= NC; h++) {
              const a2 = 2 * Math.PI * (h % NC) / NC;
              const p = [0, 0, 0];
              for (let k = 0; k < 3; k++)
                p[k] = base[k] + e1[k] * r * Math.cos(a2)
                               + e2[k] * r * (kz || 1) * Math.sin(a2);
              row.push(M.v(B(p), h / NC, i / NL, cabInfl(p[0], p[1], p[2])));
            }
            rows.push(row);
          }
          for (let i = 0; i < NL; i++) for (let h = 0; h < NC; h++)
            M.quad(rows[i][h], rows[i][h+1], rows[i+1][h+1], rows[i+1][h]);
        };
        const ball = (M, c, r) => capsule(M, [c[0] - 1e-4, c[1], c[2]],
                                             [c[0] + 1e-4, c[1], c[2]], r, r, 1);
        const hip = [sx + 0.055, panY + 0.085, sz];
        // a limb direction: `a` below the forward horizontal, `out` outboard
        const dir = (a, out) => [-Math.cos(a) * Math.cos(out), -Math.sin(a),
                                 Math.cos(a) * Math.sin(out)];
        const sho0 = add(hip, [Math.sin(lean) * Ltorso, Math.cos(lean) * Ltorso, 0]);
        const neck = add(sho0, [Math.sin(lean) * Lneck * 1.25, Math.cos(lean) * Lneck * 1.25, 0]);
        const headC = add(neck, [Math.sin(lean + headA) * 0.62 * Lhead,
                                 Math.cos(lean + headA) * 0.62 * Lhead, 0]);
        // TORSO, to real proportions. `kz` scales the fore-and-aft axis against
        // the lateral radius, and it was ABOVE 1 — a body deeper than it is wide,
        // which is a barrel, not a person. Anthropometry at H = 1.75: shoulder
        // breadth 0.45 m against a chest depth of 0.24, hip breadth 0.36 against
        // 0.23. So the radius is the HALF-BREADTH and kz is depth/breadth, both
        // under 0.7. Pelvis and chest also taper through a waist rather than
        // running one width from seat to shoulder.
        const wPelv = 0.103 * H, wWaist = 0.088 * H, wChest = 0.126 * H;
        const midT = add(hip, mul(genV3.sub(sho0, hip), 0.42));
        capsule(dumm, hip, midT, wPelv, wWaist, 0.64);
        capsule(dumm, add(hip, mul(genV3.sub(sho0, hip), 0.36)), sho0,
                wWaist, wChest, 0.55);
        capsule(dumj, sho0, neck, 0.034 * H, 0.031 * H, 0.95);
        // ---- THE HEAD, as a real ovoid --------------------------------------
        // It was a capsule, i.e. a cylinder with two hemispheres — which is a
        // pill, and reads as one. This is a triaxial ellipsoid on the head's own
        // axis (length 0.23 m, breadth 0.15, depth 0.19 at H = 1.75, which are the
        // measured ones), with a slight egg: the section shrinks toward the chin
        // and swells toward the crown, on a smooth curve rather than a taper, so
        // there is no seam anywhere on it.
        const ovoid = (M, c, ax0, rAx, rLat, rDep, egg) => {
          const ax = genV3.norm(ax0);
          const e1 = genV3.norm(genV3.cross(ax, Math.abs(ax[1]) > 0.9 ? [1,0,0] : [0,1,0]));
          const e2 = genV3.cross(ax, e1);
          const NV = 14, NU = 16, rows = [];
          for (let i = 0; i <= NV; i++) {
            const t = i / NV, ph = Math.PI * t;              // 0 = chin, pi = crown
            const y = -Math.cos(ph), rr = Math.sin(ph);
            // the egg: a smooth fore-aft-symmetric bias, fattest above the middle
            const k = 1 + (egg || 0) * (0.5 - Math.abs(0.5 - t)) * (t - 0.5) * 2.2;
            const base = add(c, mul(ax, y * rAx)), row = [];
            for (let h = 0; h <= NU; h++) {
              const a2 = 2 * Math.PI * (h % NU) / NU;
              const p = [0, 0, 0];
              for (let q = 0; q < 3; q++)
                p[q] = base[q] + e1[q] * rLat * k * rr * Math.cos(a2)
                               + e2[q] * rDep * k * rr * Math.sin(a2);
              row.push(M.v(B(p), h / NU, t, cabInfl(p[0], p[1], p[2])));
            }
            rows.push(row);
          }
          for (let i = 0; i < NV; i++) for (let h = 0; h < NU; h++)
            M.quad(rows[i][h], rows[i][h+1], rows[i+1][h+1], rows[i+1][h]);
        };
        {
          const hax = genV3.norm(genV3.sub(headC, neck));
          // the centre sits a head-radius up the axis from the neck joint, so the
          // jaw closes on the neck however the head is tilted
          // clear of the shoulders by a neck's worth: with the centre exactly one
          // head-radius up, the jaw sat ON the chest and the neck never showed
          const hc = add(neck, mul(hax, 0.090 * H));
          ovoid(dumm, hc, hax, 0.068 * H, 0.044 * H, 0.056 * H, 0.34);
        }
        const disc = (c, r, nrm) => {
          const e1 = genV3.norm(genV3.cross(nrm, [0, 1, 0]));
          const e2 = genV3.norm(genV3.cross(nrm, e1));
          const ring = [], ctr = dumk.v(B(c), 0.5, 0.5, cabInfl(c[0], c[1], c[2]));
          for (let h = 0; h <= 14; h++) {
            const a2 = 2 * Math.PI * (h % 14) / 14;
            const p = [0, 0, 0];
            for (let k = 0; k < 3; k++)
              p[k] = c[k] + e1[k] * r * Math.cos(a2) + e2[k] * r * Math.sin(a2);
            ring.push(dumk.v(B(p), 0.5 + 0.5 * Math.cos(a2), 0.5 + 0.5 * Math.sin(a2),
                             cabInfl(p[0], p[1], p[2])));
          }
          for (let h = 0; h < 14; h++) dumk.tri(ctr, ring[h], ring[h+1]);
        };
        for (const sd of [-1, 1]) {
          // ---- leg: hip -> knee -> ankle -> toe ----
          const hipJ = add(hip, [0, 0, sd * wHip]);
          const knee = add(hipJ, mul(dir(thighA, sd * hipOut), Lthigh));
          const ankle = add(knee, mul(dir(shankA, sd * (hipOut + kneeOut) * 0.35), Lshank));
          // ---- THE FOOT ----
          // Heel behind and below the ankle, toe ahead of it, and the shoe
          // between them: a flat wedge, wider and blunter at the toe. The whole
          // thing pivots about the ankle by `ankle` degrees (toes up positive) and
          // splays by `toeOut`, so it can sit on a pedal or flat on the floor.
          const fc = Math.cos(toeOut), fs = Math.sin(toeOut);
          const fwd = [-Math.cos(ankA) * fc, Math.sin(ankA), sd * fc * fs +
                       sd * 0.02];
          const heel = add(ankle, [Lfoot * 0.26 * Math.cos(ankA) * fc,
                                   -0.052 * H - Lfoot * 0.26 * Math.sin(ankA),
                                   -sd * 0.01]);
          const toe = add(heel, mul(genV3.norm(fwd), Lfoot));
          ball(dumj, hipJ, 0.050 * H);
          capsule(dumm, hipJ, knee, 0.058 * H, 0.044 * H, 1);
          ball(dumj, knee, 0.044 * H);
          capsule(dumm, knee, ankle, 0.042 * H, 0.030 * H, 1);
          ball(dumj, ankle, 0.029 * H);
          // ankle to heel, then the shoe: kz < 1 flattens it, because for a
          // near-horizontal segment the capsule's kz axis IS the vertical one
          capsule(dumm, ankle, heel, 0.028 * H, 0.030 * H, 0.85);
          capsule(dumm, heel, add(heel, mul(genV3.sub(toe, heel), 0.94)),
                  0.032 * H, 0.036 * H, 0.52);
          // ---- arm: shoulder -> elbow -> wrist -> hand ----
          const shoJ = add(sho0, [0, 0, sd * wSho]);
          const elb = add(shoJ, mul(dir(armA, sd * Math.max(-0.10, 0.34 - armIn)), Lupper));
          const wri = add(elb, mul(dir(foreA, sd * Math.max(-0.12, 0.10 - armIn / 3)), Lfore));
          const hnd = add(wri, mul(dir(foreA, sd * Math.max(-0.14, 0.06 - armIn / 3)),
                                   0.55 * Lhand));
          ball(dumj, shoJ, 0.046 * H);
          capsule(dumm, shoJ, elb, 0.042 * H, 0.032 * H, 1);
          ball(dumj, elb, 0.032 * H);
          capsule(dumm, elb, wri, 0.030 * H, 0.024 * H, 1);
          ball(dumj, wri, 0.023 * H);
          capsule(dumm, wri, hnd, 0.026 * H, 0.022 * H, 0.62);
          // CALIBRATION ROUNDELS: the yellow discs a dummy carries on the head
          // and the chest for the high-speed cameras. Flat, a few mm proud.
          disc(add(add(neck, mul(genV3.norm(genV3.sub(headC, neck)), 0.070 * H)),
                       [0, 0, sd * 0.046 * H]), 0.019 * H, [0, 0, sd]);
        }
        disc(add(sho0, [-0.072 * H, -0.055 * H, 0]), 0.024 * H, [-1, 0, 0]);
      }
      seatIdx++;
    }
  }

  const groups = {};
  const put = (nm, M) => { const g = M.done(); if (g.nv) groups[nm] = g; };
  put('skin', skin); put('cowl', cowl); put('frame', frame);
  put('engine', engine); put('gearmetal', strut); put('tyre', tyre); put('prop', prop);
  put('wheelhub', hubM); put('rubber', rubber);
  put('decal', decal);
  // glazing in three layers, and the exhaust stacks
  put('glass', glass); put('gcabin', gcabin); put('gframe', gframe);
  put('exhaust', exhaust); put('spinner', spinner); put('proptip', proptip);
  put('liftstrut', liftstrut); put('pitot', pitot);
  put('dash', dash); put('intr', intr);
  put('seat', seat); put('spipe', spipe); put('sframe', sframe);
  put('belt', belt); put('buckle', buckle);
  put('dumm', dumm); put('dumj', dumj); put('dumk', dumk);
  put('glazed', glazed); put('canopy', canopy); put('ctop', ctop); put('cframe', cframe);
  // Control surfaces are their OWN groups. `moving` is the contract with the
  // viewer: a group name, the point it turns about, the axis it turns on, and
  // what drives it. The viewer rotates the mesh — there is no per-vertex hinge
  // pass for a generated aeroplane any more.
  const moving = [];
  for (const c of CTRL_MESH) {
    put(c.group, c.mesh);
    if (!groups[c.group]) continue;
    moving.push({ group: c.group, p: c.pivot, ax: c.axis, infl: c.infl,
                  drive: c.drive, sgn: c.sgn, k: c.k,
                  drive2: c.drive2 || null, sgn2: c.sgn2 || 0 });
  }
  return {
    v: 5, generated: true,
    // DATA maps, not colour: the viewer must decode these LINEAR.
    linTex: ['bump', 'mr'],
    // WHAT COUNTS AS COVERING, declared here rather than transcribed in the
    // viewer. Frame mode hides all of it; covered mode hides the truss and the
    // engine instead. This list has to be exactly right or the glazing floats in
    // mid-air over a bare truss — and it drifted twice while it lived in
    // app.js, once per handoff, because a group added here is invisible to a
    // list maintained over there. The generator knows what it built; the viewer
    // does not need to guess.
    //
    // Everything NOT named here shows in both modes, which is correct for the
    // things that hang outside any covering: liftstrut, gearmetal, rubber,
    // exhaust, prop, tyre, wheelhub.
    // The control surfaces are in it too, and they are appended rather than
    // listed because they are named by 3b — a hard-coded copy would go stale the
    // first time a surface is added. They were NOT hidden before this list
    // existed (app.js hid only `skin` and `cowl`), so Frame mode showed painted
    // fabric ailerons, elevator and rudder floating at the trailing edges of a
    // bare truss. The wing carries 68 real beams, so there is structure to see
    // underneath them.
    cover: ['skin', 'cowl', 'decal', 'intr',
            'glass', 'glazed', 'gcabin', 'gframe',
            'canopy', 'cframe', 'ctop',
            'dash', 'seat', 'spipe', 'sframe', 'belt', 'buckle',
            'dumm', 'dumj', 'dumk'].concat(moving.map(m => m.group)),
    hub: B(hub),
    groups, surfaces, moving,
    mats: {
      // the viewer bakes `paint` procedurally (src/viewer/garage.js) and drops
      // it in before the material is built; without it this falls back to flat
      skin:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      // the registration, on its own transparent sheet just off the skin
      decal:     { tex: 'reg', rough: 1 - S.paint.gloss, alphaTest: 0.45 },
      // control surfaces are painted with the aeroplane, not against it
      ailR:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      ailL:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      flapR:     { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      flapL:     { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      elev:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      rud:       { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      vtR:       { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      vtL:       { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      // The cowl is a separate panel and reads as one: its OWN sheet, painted
      // from the same livery, carrying the intake and the nose face. It takes
      // the shared bump and metal/rough sheets like everything else painted, but
      // at a lower normal scale — a metal cowl is not doped fabric over ribs.
      cowl:      { tex: 'cowl', color: S.paint.base, nrm: 'bump', nrmScale: 0.55, mr: 'mr',
                   rough: Math.max(0.10, 0.85 - S.paint.gloss) },
      engine:    { color: 0x3c3f45 },
      frame:     { color: 0x5a6470 },
      // bare gear legs: painted steel, not chrome — at 0.80 metalness they took
      // their colour off the sky and read as black bars against grass.
      gearmetal: { color: 0x7d8792, rough: 0.42, metal: 0.45 },
      // the pitot mast: bare steel, like the gear legs it is made of
      pitot:     { color: 0x7d8792, rough: 0.42, metal: 0.45 },
      // lift struts are painted with the aeroplane, and semi-gloss
      liftstrut: { color: 0xe6e2d8, rough: 0.30, metal: 0.10 },
      // the tyre carries a baked sheet too (genTyreDataURI): circumferential
      // ribs and sidewall bands, which is what an aviation tyre actually has.
      // Ribs run AROUND the wheel, so they are u-invariant and a wheel that
      // does not spin still reads correctly.
      tyre:      { tex: 'tyre', color: 0x24262b, rough: 0.95, metal: 0.0 },
      // THESE TWO HEXES LOOK ABSURDLY DARK AND ARE NOT. r128 does NOT convert a
      // material's flat `color` from sRGB — it feeds it to the shader as LINEAR
      // — while a texture declared sRGBEncoding IS converted. So a hex picked as
      // if it were a paint chip renders far lighter than it looks here — and the
      // sun in this scene is a 2.75-intensity directional, which multiplies the
      // error. MEASURED on the cord in shade (green channel):
      //   0x2d2f34 -> 143    0x141519 -> 92    0x0b0c0e -> 65    0x060607 -> 43
      // and on the hub cap dead-on in full sun (rgb):
      //   0x000000  r.55/m.25 -> 107 83 53   <- the SPECULAR FLOOR on its own
      //   0x000000  r.90/m.00 ->  48 36 21
      //   0x1a1c20  r.90/m.00 -> 181 164 139
      //   0x33373d  r.90/m.00 -> 214 202 181
      // The first cut had the cord at a "charcoal" 0x2d2f34 and the hub at
      // 0x99a0a8 metal 0.85: a pale grey sausage and a chrome dome. Note that
      // floor — at metal 0.85 NO base colour could have saved the hub, which is
      // why metalness is low here. A wheel is a painted steel disc anyway.
      // Every other flat colour in this file carries the same bias and is left
      // alone: they were all chosen by eye against it.
      wheelhub:  { color: 0x101216, rough: 0.85, metal: 0.12 },
      // the bungee cord, and only present when that is what was bought
      rubber:    { color: 0x08090b, rough: 0.88, metal: 0.0 },
      // THE BLADE IS THE MATERIAL IT IS MADE OF. `prop.material` is already a
      // physics choice — GEN_PROP_MATS carries its mass, at the front of the
      // aeroplane where mass costs the most CG — so the colour follows it
      // rather than being a second, separate decision that can disagree.
      prop:      S.prop.material === 'alu'
                   ? { color: 0xa8adb3, rough: 0.34, metal: 0.85 }
                   : S.prop.material === 'carbon'
                   ? { color: 0x1d1f22, rough: 0.28, metal: 0.10 }
                   : { color: 0x6b4a2a, rough: 0.46, metal: 0.02 },
      // painted tips, and a polished spinner. At 0.92 metalness the spinner
      // went black anywhere the sky was dim, so it is a bright semi-metal.
      proptip:   { color: 0xe8e1d1, rough: 0.30, metal: 0.05 },
      spinner:   { color: 0xd9dce2, rough: 0.22, metal: 0.55 },
      exhaust:   { color: 0x483f37, rough: 0.55, metal: 0.55 },
      // GLAZING, in three layers: what you see through the glass is the dark
      // interior sheet, which is why the pane can be this clear.
      glass:     { color: 0xaec9d8, opacity: 0.30, rough: 0.04, metal: 0 },
      // the projected sheet: a CUT-OUT, so it belongs in the opaque pass
      glazed:     { tex: 'glaze', color: 0xa9c6d6, alphaTest: 0.45, rough: 0.07, metal: 0.0 },
      canopy:     { color: 0xa9c6d6, opacity: 0.32, rough: 0.04, metal: 0.0 },
      // the sunscreen roof: the aeroplane's own paint, on the canopy's own quads
      ctop:      { tex: 'paint', color: S.paint.base, nrm: 'bump', mr: 'mr', nrmScale: 0.7,
                   rough: 1 - S.paint.gloss },
      cframe:     { color: S.paint.trim, rough: 0.30, metal: 0.20 },
      gcabin:    { color: 0x14161a, rough: 0.90, metal: 0 },
      gframe:    { color: S.paint.trim, rough: 0.28, metal: 0.20 },
      // THE COAMING + INSTRUMENT PANEL. One shell, off the windscreen fit line.
      dash:      { color: 0x22242a, rough: 0.58, metal: 0.08 },
      // THE INSIDE. Its own sheet with two zones (fuselage / cabin), so the
      // interior is trimmed independently of the livery — the one thing a paint
      // change must not touch.
      intr:      { tex: 'cabin', color: 0x1b1d21, rough: 0.86, metal: 0 },
      // SEATS. Leather-or-vinyl on the cushions (satin, never glossy — a shiny
      // cushion reads as plastic), the welt in the aeroplane's trim colour, and
      // the frame in the same tube the fuselage is welded from.
      seat:      { color: 0xa32c22, rough: 0.72, metal: 0.02 },
      spipe:     { color: S.paint.trim, rough: 0.55, metal: 0.02 },
      sframe:    { color: 0x54595f, rough: 0.42, metal: 0.75 },
      belt:      { color: 0x7b7466, rough: 0.92, metal: 0 },
      buckle:    { color: 0xb9bec4, rough: 0.30, metal: 0.90 },
      // THE DUMMY: pale moulded skin, bare metal joints, and the yellow
      // calibration roundels the high-speed cameras track.
      dumm:      { color: 0xcac3ae, rough: 0.62, metal: 0.03 },
      dumj:      { color: 0x30343a, rough: 0.42, metal: 0.55 },
      dumk:      { color: 0xe3b41f, rough: 0.45, metal: 0.05 },
    },
    // rest node positions in the body frame — poseSkinGen adds (live - rest)
    rest: (() => {
      const a = new Float32Array(N.length * 3);
      N.forEach((n, i) => { const b = B(n.p); a[i*3] = b[0]; a[i*3+1] = b[1]; a[i*3+2] = b[2]; });
      return a;
    })(),
  };
}

// Pose a generated skin: rigid mount is the group matrix (as for any model);
// this adds the structural delta, exactly parallel to applySkinDeform.
//   pos = base + SUM w_i * (node_i_body - node_i_rest_body)
// `hinged` verts already have their hinge-rotated position in `pos`, so the
// delta is ADDED rather than written, same contract as the imported path.
function poseSkinGen(g, rest, live, base, pos, gain, hinged) {
  const { wi, ww, nv } = g;
  for (let v = 0; v < nv; v++) {
    let dx = 0, dy = 0, dz = 0;
    for (let k = 0; k < GEN_INFL; k++) {
      const o = v * GEN_INFL + k, w = ww[o];
      if (w === 0) continue;
      const i3 = wi[o] * 3;
      dx += w * (live[i3] - rest[i3]);
      dy += w * (live[i3+1] - rest[i3+1]);
      dz += w * (live[i3+2] - rest[i3+2]);
    }
    dx *= gain; dy *= gain; dz *= gain;
    const o3 = v * 3;
    if (hinged && hinged[v]) { pos[o3] += dx; pos[o3+1] += dy; pos[o3+2] += dz; }
    else { pos[o3] = base[o3] + dx; pos[o3+1] = base[o3+1] + dy; pos[o3+2] = base[o3+2] + dz; }
  }
}

// Live node positions in the body frame, for poseSkinGen. Mirrors the codec's
// sparDeltas: same axes, same CG reference.
function genNodeBody(sim, out) {
  const cg = sim.cgPos(), [xA, yU] = sim.axes();
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  for (let i = 0; i < sim.n; i++) {
    const dx = sim.p[i*3]-cg[0], dy = sim.p[i*3+1]-cg[1], dz = sim.p[i*3+2]-cg[2];
    out[i*3]   = dx*xA[0]+dy*xA[1]+dz*xA[2];
    out[i*3+1] = dx*yU[0]+dy*yU[1]+dz*yU[2];
    out[i*3+2] = dx*zL[0]+dy*zL[1]+dz*zL[2];
  }
  return out;
}
// ============================================================
// GARAGE 5/5 — the BUILD. Spec in, fiche out.
//
// buildGen(spec) is the entry point the sim, the gates and the viewer all
// use. Two of the fiche's numbers cannot be reasoned out of the geometry —
// the stabiliser trim setting and the cruise throttle — so the garage does
// what a builder does: it puts the aeroplane in the tunnel. sim.probe()
// already exists for exactly this (30_solver.js), is deterministic, and costs
// one strip pass per call.
//
// shakedown() is the same instrument turned into the garage's readout: stall
// speed, cruise L/D, static margin, three-point attitude, prop clearance.
// ============================================================

// Prescribed-flow probe at a given body angle of attack. The aeroplane is in
// its rest pose (reset translates, never rotates), so the body frame is level
// and Fy reads as lift.
function genProbeAt(sim, V, a) {
  const [xA, yU] = sim.axes();
  const vel = [0, 0, 0];
  for (let k = 0; k < 3; k++) vel[k] = -V * (Math.cos(a) * xA[k] + Math.sin(a) * yU[k]);
  const r = sim.probe(vel);
  // forward unit vector: drag is the aero force opposing it
  r.drag = -(r.Fx * -Math.cos(a) * xA[0] + r.Fy * -Math.cos(a) * xA[1] + r.Fz * -Math.cos(a) * xA[2])
           - (r.Fx * -Math.sin(a) * yU[0] + r.Fy * -Math.sin(a) * yU[1] + r.Fz * -Math.sin(a) * yU[2]);
  return r;
}

// Free-air CLmax by alpha sweep — the same scan GATE FLAPS runs on the fleet.
// `flap` is the deflection to hold during the sweep, so one function measures
// both the clean and the flapped maximum.
function genClMax(def, flap) {
  const sim = makeSim(def, null);
  sim.reset(0);
  sim.ctl.flap = flap;
  let Sw = 0;
  for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
  const V = 30;
  let CLmax = 0;
  for (let a = 2; a <= 22; a += 0.25) {
    const al = a * Math.PI / 180;
    const r = sim.probe([-V * Math.cos(al), -V * Math.sin(al), 0]);
    const L = -r.Fx * Math.sin(al) + r.Fy * Math.cos(al);
    CLmax = Math.max(CLmax, L / (0.5 * 1.225 * V * V * Sw));
  }
  return { CLmax, Sw, W: sim.totalM * 9.81 };
}

// alpha at which lift balances weight, secant, clamped short of the stall.
function genAlphaForLift(sim, V, W, aMax) {
  let a0 = 0.01, a1 = 0.09;
  let f0 = genProbeAt(sim, V, a0).Fy - W, f1 = genProbeAt(sim, V, a1).Fy - W;
  for (let i = 0; i < 8; i++) {
    if (Math.abs(f1 - f0) < 1e-9) break;
    let a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
    a2 = Math.min(aMax, Math.max(-0.06, a2));
    a0 = a1; f0 = f1; a1 = a2; f1 = genProbeAt(sim, V, a1).Fy - W;
    if (Math.abs(f1) < 0.5) break;
  }
  return a1;
}

// Solve stabTrim so the aeroplane is in pitch balance at its own cruise speed
// and its own trimmed alpha. Two-point secant on an almost perfectly linear
// relation, then one refinement — the fleet's hand-tuned values were found the
// same way, by tunnel trim at cruise.
function genTrim(def) {
  const sim = makeSim(def, null);
  sim.reset(0);
  const W = sim.totalM * 9.81;
  const V = def.params.ap.VCruise;
  const aMax = 0.85 * def.params.polarWing.aStall;
  const at = s => {
    def.params.stabTrim = s;
    const a = genAlphaForLift(sim, V, W, aMax);
    return { a, r: genProbeAt(sim, V, a) };
  };
  let s0 = 0, s1 = -0.08;
  let m0 = at(s0).r.pitchUp, m1 = at(s1).r.pitchUp;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(m1 - m0) < 1e-9) break;
    const s2 = Math.min(0.15, Math.max(-0.25, s1 - m1 * (s1 - s0) / (m1 - m0)));
    s0 = s1; m0 = m1; s1 = s2; m1 = at(s1).r.pitchUp;
    if (Math.abs(m1) < 1.0) break;
  }
  def.params.stabTrim = s1;
  const fin = at(s1);
  // cruise throttle from the drag the tunnel just measured against the thrust
  // the prop can make at that speed
  // the aeroplane's OWN prop where it has one (a GARAGE build always does)
  const PP = POWERPLANTS[def.params.powerplant];
  const PR = def.params.prop || PP.prop;
  // BOTH estimates below are about what the AEROPLANE pulls, so both carry the
  // engine count. They used to read the per-disc figure while the solver flew
  // on twice it (`T = Tper * refs.engine.length`, fixed G4.9).
  const nE = def.params.nEngines || 1;
  const Tavail = Math.max(1, PR.Tstatic - PR.kV2 * V * V) * nE;
  def.params.ap.thrCruise = Math.min(0.95, Math.max(0.15, fin.r.drag / Tavail));
  def.params.gen.alphaCruise = fin.a;
  def.params.gen.LD = fin.r.Fy / Math.max(1e-6, fin.r.drag);
  // TAKEOFF RUN to 2.5 m agl. The AP only uses it to decide whether to
  // backtrack, so it has to err LONG.
  //
  // Rebuilt in G4.9, because the engine-count fix took away the error that was
  // cancelling this one. The old form was `1.35 * Vlof^2 / (2*acc)` with ONE
  // constant acceleration off 0.92*Tstatic and `Vlof = 1.05*VRot`. Two things
  // were wrong with it and the doubled thrust hid both — it read 119 m against
  // the 103 m the over-powered aeroplane actually flew, which looked like the
  // deliberate safety bias the comment claimed. On honest thrust the same
  // formula reads 119 m against 292 m flown: optimistic by 2.4x, and on a
  // backtrack decision optimistic is the dangerous direction.
  //
  // 1. IT DOES NOT UNSTICK AT 1.05*VRot. VRot is where the autopilot starts
  //    asking; the wheels leave when the wing can carry the aeroplane AT THE
  //    LIFTOFF ATTITUDE, which is a tunnel question. Measured against flown
  //    takeoffs this is right to a few per cent and high rather than low
  //    (gen 21.4 predicted / 20.8 flown, cub 19.0 / 17.6).
  // 2. THE ACCELERATION IS NOT CONSTANT. Thrust falls as kV2*V^2 the whole way
  //    down the roll while drag climbs, so the mean is nothing like the
  //    standing value. Integrate s = INT V dV / a(V) instead.
  //
  // The roll integrates at ZERO body alpha — the aeroplane accelerates roughly
  // level — which under-reads lift and so over-reads both the weight on the
  // wheels and the rolling drag: conservative, deliberately.
  const A_ = def.params.ap;
  let Vun = 1.05 * A_.VRot;
  {
    let lo = 1, hi = 4 * Vun + 40;
    for (let k = 0; k < 40; k++) {
      const mV = 0.5 * (lo + hi);
      if (genProbeAt(sim, mV, A_.liftoffTh).Fy < W) lo = mV; else hi = mV;
    }
    Vun = Math.max(Vun, 0.5 * (lo + hi));
  }
  const NS = 32;
  let sRoll = 0;
  for (let i = 0; i < NS; i++) {
    const Vi = Vun * (i + 0.5) / NS;
    const Ti = Math.max(0, PR.Tstatic - PR.kV2 * Vi * Vi) * nE;
    const ri = genProbeAt(sim, Vi, 0);
    const Ni = Math.max(0, W - ri.Fy);                  // weight still on wheels
    const ai = Math.max(0.15, (Ti - ri.drag - CRR * Ni) / sim.totalM);
    sRoll += Vi * (Vun / NS) / ai;
  }
  // AIR SEGMENT, unstick to 2.5 m. NOT a climb at a settled speed — the
  // aeroplane is accelerating and climbing at once, and how much of the
  // surplus goes into height rather than into speed is an aeroplane-by-
  // aeroplane thing: measured 23 m on the cub against 101 m on the garage
  // preset, for the same 2.5 m. So it is carried as a fraction of the roll
  // rather than modelled, at 0.8 — above the worse of the two measured ratios
  // (0.53 gen, 0.18 cub), because this number's whole job is to be long.
  // Reads 320 m against the preset's 292 m flown.
  def.params.ap.TORun = Math.round(1.8 * sRoll);
  return def;
}

// The garage readout. Everything a builder would want to know before rolling
// it out of the shed, measured rather than asserted.
// Works on ANY fiche, generated or hand-written — the geometry-only fields are
// skipped when there is no spec. That is deliberate: the garage's numbers have
// to be comparable with the fleet's, or they mean nothing.
function genShakedown(def) {
  const S = def.spec, P = def.parts;
  const g = def.params.gen || {};
  const sim = makeSim(def, null);
  sim.reset(0);
  const W = sim.totalM * 9.81;
  const V = def.params.ap.VCruise;
  const aMax = 0.85 * def.params.polarWing.aStall;
  const a = genAlphaForLift(sim, V, W, aMax);
  const r0 = genProbeAt(sim, V, a), r1 = genProbeAt(sim, V, a + 0.02);
  const dM = (r1.pitchUp - r0.pitchUp) / 0.02;
  const dL = (r1.Fy - r0.Fy) / 0.02;
  // neutral point: how far aft the CG could move before dM/dalpha reaches zero
  const npShift = -dM / Math.max(1e-6, dL);
  const cg = r0.cg;
  // wing area from the strips, so a hand-written fiche reports the same way
  let Sw = 0;
  for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
  const cBar = g.cBar || (def.strips.find(s => s.kind === 'wing') || {}).chord || 1;
  // ---- does it stand up? -------------------------------------------------
  // Settled on a flat plane (world = null), so the answer does not depend on
  // which patch of grass it is parked on. This is the instrument that catches
  // the failure a big engine used to cause: the gear folds, the aeroplane goes
  // down on its firewall, and every aerodynamic number above stays perfectly
  // healthy while it does. The nose-over angle is MEASURED off the settled
  // geometry rather than derived — the derivation has to guess the attitude.
  const st = makeSim(def, null);
  st.reset(0);
  for (let i = 0; i < 150; i++) st.step(1/60);
  const idOf = t => def.nodes.findIndex(n => n.tag === t);
  const iAx = idOf('AXLER'), iTw = def.refs.tw;
  const aglOf = i => st.p[i*3+1] - st.r[i];
  let gearStrain = 0, chassisStrain = 0, lowY = 1e9, lowTag = '';
  for (const b of st.beams) {
    if (b.gear) gearStrain = Math.max(gearStrain, Math.abs(b.strain));
    else chassisStrain = Math.max(chassisStrain, Math.abs(b.strain));
  }
  for (let i = 0; i < st.n; i++) {
    const y = st.p[i*3+1] - st.r[i];
    if (y < lowY) { lowY = y; lowTag = def.nodes[i].tag; }
  }
  // THE SUSPENSION, measured as suspension rather than as a strain maximum.
  // `gearStrain` above is the worst-loaded gear MEMBER, which is a structural
  // number and since G4.7 is usually the drag brace — it goes UP with stiffness,
  // because a stiffer spring hands more load to the brace. What the knob claims
  // is travel, so travel is what gets measured — plus `susShift`, which is the
  // only thing that can see a FOLD (see below).
  let springStrain = 0, legL = 0, iLegTop = -1, iLegAx = -1;
  def.beams.forEach((b, i) => {
    if (!b.gear || b.vis !== 'leg') return;
    springStrain = Math.max(springStrain, Math.abs(st.beams[i].strain));
    const ta = def.nodes[b.a].tag || '', tb = def.nodes[b.b].tag || '';
    if (iLegTop < 0 && (ta.indexOf('AXLE') === 0 || tb.indexOf('AXLE') === 0)) {
      legL = b.L;
      iLegAx = ta.indexOf('AXLE') === 0 ? b.a : b.b;
      iLegTop = ta.indexOf('AXLE') === 0 ? b.b : b.a;
    }
  });
  // travel IS the spring's own compression. A vertical node-difference cannot
  // measure it: the main leg is long and steeply raked into the FIREWALL, so the
  // axle moves along the leg rather than under it — measured, 5 mm of vertical
  // change for 52 mm of actual compression, and the rest of any node-difference
  // is the body pitching.
  const susTravel = springStrain * legL;
  // THE FOLD, and it has to be geometric. A snap-through rotates the gear rather
  // than stretching it — the folded case sat at 1.3% leg strain, which is rule 10
  // exactly ("no strain gate can see a mechanism"). So: how far has the axle moved
  // RELATIVE to the airframe node it hangs on, as a fraction of the leg? A working
  // suspension is under 0.1 of its leg; the fold measured 1.4.
  let susShift = 0;
  if (iLegTop >= 0) {
    const d0 = [0, 1, 2].map(k => def.nodes[iLegAx].p[k] - def.nodes[iLegTop].p[k]);
    const d1 = [0, 1, 2].map(k => st.p[iLegAx*3+k] - st.p[iLegTop*3+k]);
    susShift = Math.hypot(d1[0]-d0[0], d1[1]-d0[1], d1[2]-d0[2]) / Math.max(1e-6, legL);
  }
  const cgS = st.cgPos(), axX = st.p[iAx*3], axY = aglOf(iAx);
  const noseOver = Math.atan2(cgS[0] - axX, Math.max(0.05, cgS[1] - axY)) * 180 / Math.PI;
  const onWheels = iAx >= 0 && Math.abs(aglOf(iAx)) < 0.06 && Math.abs(aglOf(iTw)) < 0.06;

  const PPr = POWERPLANTS[def.params.powerplant];
  const hp = PPr.engine.powerW / 745.7;
  const out = {
    mass: sim.totalM, W,
    engineName: PPr.engine.name, hp, engineMass: PPr.engine.mass,
    powerLoad: sim.totalM / Math.max(1e-6, hp),
    onWheels, restsOn: lowTag, gearStrain, restChassisStrain: chassisStrain,
    springStrain, susTravel, susShift, gearFolded: susShift > 0.5,
    noseOver,
    Vs: g.Vs, VCruise: V, LD: r0.Fy / Math.max(1e-6, r0.drag),
    alphaCruise: a * 180 / Math.PI,
    Sw, wingLoad: sim.totalM / Sw,
    cgX: cg[0], npX: cg[0] + npShift, staticMargin: npShift / cBar,
    TORun: def.params.ap.TORun, thrCruise: def.params.ap.thrCruise,
    stabTrim: def.params.stabTrim,
  };
  if (S && P) {
    // contactR, not wheelR: a cambered wheel touches down above its own radius
    const ground = S.gear.y - S.gear.contactR;
    const tw = def.nodes[P.TW];
    out.AR = g.AR;
    // atan, not atan2: this is the slope of the line through the two contacts,
    // and a nosewheel sits AHEAD of the mains so atan2 wraps it to ~180 deg
    out.deckAngle = Math.atan(((tw.p[1] - S.gear.twR) - ground) /
                              (P.twX - P.gx)) * 180 / Math.PI;
    out.gearType = S.gear.type;
    out.bracing = P.bracing;
    out.propClear = (S.engY - S.propR) - ground;
    // The two halves of the split suspension height, as BUILT rather than as
    // asked for: legDrop is the knob, but gear.y can be bound by prop clearance
    // instead, and the third leg's length is derived for a nosewheel. Reporting
    // both is what makes "nose vs mains, set separately" legible.
    out.mainDrop = -0.02 - S.gear.y;
    out.mainBoundBy = S.gear.yBoundBy;
    // THE COWL, reported rather than enforced. A cowl is not obliged to enclose
    // its engine — a Cub's cylinders stick out on purpose — but "the cowl
    // collapses below its engine" was a real bug hiding behind that, so the
    // panel says which one you have built.
    out.cowlHalfW = S.cowl.halfW;
    out.cowlTop = S.cowl.top; out.cowlBot = S.cowl.bot;
    out.cowlEnclosed = S.cowl.enclosed;
    out.cowlOut = ['above', 'below', 'sides'].filter(k => !S.cowl.covers[k]);
    // THE PROPELLER as a component of its own: the disc it sweeps, what it pulls
    // standing still, where its thrust runs out, and what the blades weigh.
    out.propName = S.prop.name;
    out.propD = S.prop.D; out.propBlades = S.prop.blades;
    out.propDisc = S.prop.area;
    out.propTstatic = S.prop.Tstatic; out.propV0 = S.prop.V0;
    out.propMass = S.prop.mass;
    // WHAT THE AEROPLANE ACTUALLY PULLS: the disc's static thrust once per
    // ENGINE. It used to be once per MOUNT NODE, which is two on this airframe
    // family, and the whole fleet was anchored on the resulting doubling
    // (fixed G4.9). Same expression the solver uses, so the panel and the
    // aeroplane cannot disagree again.
    out.propThrust = S.prop.Tstatic * (def.params.nEngines || 1);
    out.propTW = out.propThrust / W;
    out.thirdLeg = S.gear.type === 'tricycle' ? -0.02 - tw.p[1]
                                             : def.nodes[P.TPB].p[1] - tw.p[1];
    out.camber = S.gear.camber;
  }
  // High lift, measured rather than assumed. `gen.Vs` is the CLEAN stall the
  // whole aero synthesis is built on; this runs the same free-air CLmax scan
  // GATE FLAPS uses on the fleet, with the flaps down, so the panel can show
  // what the high-lift device actually buys. Without it a flap is a line in the
  // spec that changes no number anyone can see.
  if (def.params.flaps) {
    const cl = genClMax(def, 0), fl = genClMax(def, 1);
    out.ClMaxClean = cl.CLmax;
    out.ClMaxFlap = fl.CLmax;
    out.VsFlap = Math.sqrt(2 * fl.W / (1.225 * fl.Sw * Math.max(1e-6, fl.CLmax)));
    out.VsRatio = out.VsFlap / Math.sqrt(2 * cl.W / (1.225 * cl.Sw * Math.max(1e-6, cl.CLmax)));
    out.VAppr = def.params.ap.VAppr;
  }
  if (P && P.ledger) {
    out.ledger = P.ledger;
    out.cost = 0;
    for (const k in P.ledger) out.cost += P.ledger[k].cost;
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildGen(spec) — the fiche. Same shape the hand-written builders return, so
// makeSim / makeAutopilot / the gate harness take it unchanged. `spec` and
// `parts` ride along for the skin generator and the editor; the solver spreads
// only what it knows about and ignores them.
// ---------------------------------------------------------------------------
function buildGen(specIn) {
  const R = resolveSpec(specIn || GEN_DEFAULT);
  const S = R.spec;
  // which fields the player left to the generator, so the editor can say so
  S._auto = R.auto;
  const fr = genFrame(S);
  // gear placement needs the CG, so genFrame owns it — hand the numbers it
  // chose back on the resolved spec, or the editor has nothing to report
  for (const [k, v] of [['track', fr.parts.tr], ['x', fr.parts.gx],
                        ['twX', fr.parts.twX], ['twY', fr.parts.twY]]) {
    if (S.gear[k] === null || S.gear[k] === undefined) S._auto['gear.' + k] = true;
    S.gear[k] = v;
  }
  const strips = genStrips(S, fr);
  const params = genParams(S, fr, strips);
  const def = { nodes: fr.nodes, beams: fr.beams, strips, refs: fr.refs, params };
  def.spec = S; def.parts = fr.parts;
  genTrim(def);
  // The approach is flown WITH the flaps out, so the speeds that matter scale
  // off the FLAPS-DOWN stall — Vref = 1.3 Vso is the real-world rule and the
  // fleet's hand-set VAppr values already have their own flaps in them. Derived
  // from the clean stall instead, a big high-lift device produced an aeroplane
  // that approached far too fast: measured on a Fowler-flapped build, it flew
  // the glideslope at MINUS 4.2 degrees alpha on 65% power and sailed over the
  // touchdown zone still 16 m up, never landing at all. The lift was right; the
  // speed it was told to fly was not.
  if (params.flaps) {
    const g = genClMax(def, 1);
    const VsFlap = Math.sqrt(2 * g.W / (1.225 * g.Sw * Math.max(1e-6, g.CLmax)));
    const r = VsFlap / params.gen.Vs;
    params.ap.VAppr *= r;
    params.ap.VApprShort *= r;
    params.gen.VsFlap = VsFlap;
  }
  return def;
}
// ============================================================
// GARAGE 5/5 — the LOAD TEST RIG. Static proof-of-structure, in the sim.
//
// The sandbag test an amateur-built aeroplane has to pass before it flies:
// bags over the wing to LIMIT load (no permanent set), then to ULTIMATE, which
// is 1.5x limit (no failure). FAR 23 normal category is +3.8 g and +5.7 g.
//
// ONE IMPLEMENTATION. This drives a sim step by step and holds all its state,
// so GATE LOAD runs it headless and the garage ticks the same object per frame
// and draws the result. There is no second place a load-test number lives.
//
// THE RIG, and why it is built this way — three versions of it were wrong
// first, and each looked right:
//   1. Load the wing and let the aeroplane's own INERTIA react it. A legitimate
//      pull-up on paper. But only the wing is loaded and nothing balances the
//      pitching moment, so it rotates under the measurement: the C172 read
//      1.25 % at 1 g and -0.95 % at 3.8 g.
//   2. React at the wing root stations, making it self-equilibrated in FORCE.
//      The net MOMENT still is not zero, so it rotates slowly instead of fast,
//      and at 5.7 g the body frame flipped mid-run: the trace jumped 5.10 -> 0.22.
//   3. BOLT THE FUSELAGE DOWN. Every non-wing node is pinned each step, which
//      is what trestles are. Nothing to balance, nothing to tumble.
// And the load is RAMPED, not stepped: DEFDAMP is a rate with tau = 2 s, so a
// step leaves the wing ringing past fifteen seconds and reading it at one
// instant samples the ring. `relax` bleeds the deformation velocity — only the
// part relative to the mass-weighted mean, so rigid motion is untouched — which
// converges to the same static answer quickly. Legitimate because only the
// settled state is wanted; nothing here claims to be a transient.
//
// The acceptance number is LINEARITY: 3.8 g of bags must give 3.8x the
// deflection. All three broken rigs failed it. See HANDOVER, GATE LOAD.
// ============================================================
const GEN_LOAD_LIMIT = 3.8;         // FAR 23 normal category
const GEN_LOAD_ULT = 5.7;           // 1.5 x limit
const GEN_LOAD_WINGTAGS = ['WF', 'WR', 'WB', 'WB2'];

// spar stations on the +z wing, front node paired with its nearest rear node
function genLoadStations(def) {
  const wf = [], wr = [];
  def.nodes.forEach((n, i) => {
    if (n.p[2] <= 0) return;
    if (n.tag === 'WF') wf.push(i);
    if (n.tag === 'WR') wr.push(i);
  });
  wf.sort((a, b) => def.nodes[a].p[2] - def.nodes[b].p[2]);
  return wf.map(f => {
    const z = def.nodes[f].p[2];
    let r = -1, bd = Infinity;
    for (const q of wr) { const d = Math.abs(def.nodes[q].p[2] - z); if (d < bd) { bd = d; r = q; } }
    return { f: f, r: r, z: z };
  });
}

// makeLoadTest(sim, def, cfg) -> rig
//   rig.step(dt)  advance one frame; returns rig.state
//   rig.state     { phase, n, nTarget, tipPct, tipM, defl[], worstPct, worstCls,
//                   limitPct, ultPct, verdict, done }
// cfg: { limit, ult, rampS, holdS, material } — material is the GEN_MATERIALS
// key, and only supplies the yield allowable; omit it and the yield column is
// simply absent (the hand fiches have no material behind their k).
function makeLoadTest(sim, def, cfg) {
  cfg = cfg || {};
  const LIM = cfg.limit == null ? GEN_LOAD_LIMIT : cfg.limit;
  const ULT = cfg.ult == null ? GEN_LOAD_ULT : cfg.ult;
  const RAMP = (cfg.rampS == null ? 4.0 : cfg.rampS);
  const HOLD = (cfg.holdS == null ? 1.5 : cfg.holdS);
  const SETTLE = (cfg.settleS == null ? 2.0 : cfg.settleS);
  const MAT = (typeof GEN_MATERIALS !== 'undefined' && cfg.material)
    ? GEN_MATERIALS[cfg.material] : null;

  const st = genLoadStations(def);
  const ok = st.length >= 2;
  const root = ok ? st[0] : null, tip = ok ? st[st.length - 1] : null;
  const semi = ok ? def.nodes[tip.f].p[2] : 1;

  // total weight, and the bags: n*W split over the wing strips by area, then on
  // to nodes through each strip's own attachment weights — the same path the
  // solver uses for lift, so the bags sit where the lift does by construction.
  let W = 0;
  for (const nd of def.nodes) W += nd.m;
  W *= 9.81;
  const perG = new Map();
  {
    const wing = def.strips.filter(s => s.kind === 'wing');
    let area = 0;
    for (const s of wing) area += s.area;
    if (area > 0) for (const s of wing) {
      const share = W * (s.area / area);
      for (const wq of s.w) perG.set(wq[0], (perG.get(wq[0]) || 0) + share * wq[1]);
    }
  }
  const bags = [];
  perG.forEach((f, i) => bags.push([i, f]));

  // the trestles: everything that is not wing is pinned where it starts
  const wingTag = {};
  for (const t of GEN_LOAD_WINGTAGS) wingTag[t] = 1;
  const pin = [];

  const state = { phase: 'settle', n: 0, nTarget: ULT, tipPct: 0, tipM: 0,
                  defl: st.map(function () { return 0; }), z: st.map(s => s.z),
                  semi: semi, worstPct: null, worstCls: null,
                  limitPct: null, ultPct: null, limitYield: null, ultYield: null,
                  verdict: null, done: false, W: W, ok: ok };

  let t = 0, base = null, peak = {};

  function clamp() {
    for (let k = 0; k < pin.length; k++) {
      const p = pin[k], i = p[0] * 3;
      sim.p[i] = p[1]; sim.p[i+1] = p[2]; sim.p[i+2] = p[3];
      sim.v[i] = sim.v[i+1] = sim.v[i+2] = 0;
    }
  }
  function relax() {
    const vm = sim.cgVel();
    for (let i = 0; i < sim.n; i++) {
      const o = i * 3;
      sim.v[o]   = vm[0] + (sim.v[o]   - vm[0]) * 0.85;
      sim.v[o+1] = vm[1] + (sim.v[o+1] - vm[1]) * 0.85;
      sim.v[o+2] = vm[2] + (sim.v[o+2] - vm[2]) * 0.85;
    }
  }
  function rise(s, yB) {
    const dx = sim.p[s.f*3] - sim.p[root.f*3],
          dy = sim.p[s.f*3+1] - sim.p[root.f*3+1],
          dz = sim.p[s.f*3+2] - sim.p[root.f*3+2];
    return dx*yB[0] + dy*yB[1] + dz*yB[2];
  }
  function yieldPct() {
    if (!MAT || !MAT.phys) return null;
    let worst = null;
    for (const cls in peak) {
      if (!MAT.lin[cls]) continue;
      const A = MAT.lin[cls] / MAT.phys.rho;
      const pct = 100 * peak[cls].F / (MAT.phys.sigY * A);
      if (!worst || pct > worst.pct) worst = { cls: cls, pct: pct };
    }
    return worst;
  }

  function begin() {
    // clear of the ground so contact never joins in, then bolt the rig down
    for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += 200;
    pin.length = 0;
    def.nodes.forEach(function (nd, i) {
      if (!wingTag[nd.tag]) pin.push([i, sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]]);
    });
  }
  begin();

  function step(dt) {
    if (state.done || !ok) return state;
    t += dt;
    if (state.phase === 'settle') {
      sim.step(dt); clamp(); relax();
      if (t >= SETTLE) {
        // the settled shape under the wing's OWN weight is the jig datum, which
        // is what the real test measures deflection from
        const ax = sim.axes();
        base = st.map(s => rise(s, ax[1]));
        state.phase = 'ramp'; t = 0;
      }
      return state;
    }
    // ramp to ultimate, recording the limit case on the way past
    const n = state.phase === 'hold' ? ULT : Math.min(ULT, ULT * (t / RAMP));
    state.n = n;
    for (let k = 0; k < bags.length; k++)
      sim.impulse(bags[k][0], 0, n * bags[k][1] * dt, 0);
    sim.step(dt); clamp(); relax();

    for (const bm of sim.beams) {
      const cls = bm.cls || (bm.gear ? 'gear' : 'chassis');
      const F = Math.abs(bm.k * bm.strain * bm.L0);
      const g = peak[cls] || (peak[cls] = { F: 0 });
      if (F > g.F) g.F = F;
    }
    const ax = sim.axes();
    state.defl = st.map((s, i) => 100 * (rise(s, ax[1]) - base[i]) / semi);
    state.tipPct = state.defl[state.defl.length - 1];
    state.tipM = state.tipPct / 100 * semi;
    const w = yieldPct();
    if (w) { state.worstPct = w.pct; state.worstCls = w.cls; }

    if (state.limitPct === null && n >= LIM) {
      state.limitPct = state.tipPct;
      state.limitYield = state.worstPct;
    }
    if (state.phase === 'ramp' && n >= ULT) { state.phase = 'hold'; t = 0; }
    else if (state.phase === 'hold' && t >= HOLD) {
      state.ultPct = state.tipPct;
      state.ultYield = state.worstPct;
      state.phase = 'done'; state.done = true;
      // The structure held if it stayed finite. Permanent set is PROXIED by
      // peak force against sigY*A — the load at which a member takes a set, and
      // correct even on soft springs because failure is a force threshold. It
      // is reported rather than failed on: `A = lin/rho` is one area for the
      // whole wing class and the worst member is usually the LIFT STRUT, which
      // a real aeroplane sizes on its own. See HANDOVER, GATE LOAD.
      state.verdict = sim.stats().bad ? 'BROKE UP'
        : (state.ultYield !== null && state.ultYield >= 100 ? 'HELD — over yield'
                                                           : 'HELD');
    }
    if (sim.stats().bad) { state.verdict = 'BROKE UP'; state.done = true; }
    return state;
  }

  return { step: step, state: state, stations: st, semi: semi, W: W,
           limit: LIM, ult: ULT };
}
if (typeof module !== 'undefined')
  module.exports = { buildCub, buildDrone, buildDC3, buildJodel, buildC172, buildChinook, buildPA18, makeSim, makeAutopilot, placeAtAerodrome, makeWorld, bakeHydrology, POWERPLANTS, POLARS, PAR, decodeModel, decodeB64, defCG, makeSkinBinding, sparDeltas, applySkinDeform, makeHingeBinding, applyHinges, makeLinkage, buildGen, resolveSpec, clampSpec, genFrame, genShakedown, genPolar, genThinAirfoil, GEN_DEFAULT, GEN_PRESETS, GEN_MATERIALS, GEN_SHAPES, GEN_FLAPS, GEN_TANKS, GEN_SYSTEMS, GEN_SEATING, GEN_TIPS, GEN_INTAKES, GEN_PROP_MATS, GEN_PROP_PITCH, GEN_RULES, genSkin, poseSkinGen, genNodeBody, genRestFrame, genAirfoil, makeLoadTest, genLoadStations, GEN_LOAD_LIMIT, GEN_LOAD_ULT };
