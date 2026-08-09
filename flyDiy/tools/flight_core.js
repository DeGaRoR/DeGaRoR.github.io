// GENERATED FILE - DO NOT EDIT. Built from src/core/ by tools/build.js.
// body-sha256: 70deb8b8ba6e995a
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
const POWERPLANTS = {
  a65_sensenich74: {
    engine: { name: 'Continental A-65', mass: 80, powerW: 48500 },
    prop:   { name: 'Sensenich 74CK', D: 1.88, Tstatic: 900, kV2: 0.26 },
  },
  r1830_hs23e50: {
    engine: { name: 'P&W R-1830 Twin Wasp', mass: 750, powerW: 895000 },
    prop:   { name: 'Hamilton Standard 23E50', D: 3.4, Tstatic: 11000, kV2: 0.543 },
  },
  io360_mccauley: {
    engine: { name: 'Lycoming IO-360-L2A', mass: 138, powerW: 134000 },
    prop:   { name: 'McCauley 1C235 fixed-pitch', D: 1.93, Tstatic: 2290, kV2: 0.136 },
  },
  rotax277_pusher: {
    engine: { name: 'Rotax 277 (pusher)', mass: 30, powerW: 21000 },
    prop:   { name: '2-pale bois 1.42 m', D: 1.42, Tstatic: 800, kV2: 0.545 },
  },
  o200_eprops: {
    engine: { name: 'Continental O-200-A', mass: 85, powerW: 74600 },
    prop:   { name: 'E-Props Durandal carbone', D: 1.73, Tstatic: 1700, kV2: 0.177 },
  },
  outrunner2212_9x47: {
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
    polarWing: POLARS.usa35b_AR7, polarTail: POLARS.flat_tail_cub,
    elevTau: 0.50, rudTau: 0.55, ailTau: 0.35, downwash: 0.40,
    stabTrim: -0.0983, sparSpacing: 0.78,
    fusCdA: [0.55, 0.8, 0.8], fusCdAAft: [0, 0.5, 0.5],
    twSteer: 0.5,
    ap: {
      VRot: 15, VClimbMin: 20, VClimb: 21, VCruise: 26, VAppr: 21.5,
      VApprShort: 18.8,             // fly-in strips < 450 m (1.25*Vs, doctrine floor)
      TORun: 60,                    // measured run to 2.5 m agl (W14 multi-hop)
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
      pitchCmdSlew: 0.7, vsP: 0.020, vsI: 0.040, vsFloor: -0.11, altVSGain: 0.10,
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
      TORun: 60,                    // measured run to 2.5 m agl (W14 multi-hop)
      // W16 lateral quiet: the default rollD 2.0 on the RF-lagged rate
      // estimate limit-cycled the aileron 8-12 deg p2p at ~4 Hz (bank
      // barely moved — surface flail + wing rock, user-visible on the
      // skin). 0.8 kills it dead (0.2 deg residual); doctrine says lower
      // D, and measured: a FASTER rate filter makes it worse.
      rollD: 0.8,
      VPinFull: 16,                 // moderate aft above this in rollout (hop guard)
      hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
      rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
      thMax: 0.20, flareAgl: 5.5, flareRate: 0.062, flareThr: 0.12, aglGuard: 3,
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
  const PROPA = Math.PI * (PP.prop.D / 2) ** 2;
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
      const nE = def.refs.engine.length;
      const Tper = ctl.thr * Math.max(0, PP.prop.Tstatic - PP.prop.kV2 * Vfwd * Vfwd);
      T = Tper * nE;                                   // registry values are per engine
      wash = Math.sqrt(Vfwd * Vfwd + 2 * Tper / (RHO * PROPA)) - Vfwd;
      const per = T / def.refs.engine.length;
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
      else if (st.kind === 'stab') out.stabFy += Fy;
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
      c.thr = clamp(0.08 + 0.06 * (Vt - Vg), 0, 0.35);
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
    const ang = s.sgn * (s.k || 1) * (ctl[s.drive] || 0);
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
const GEN_MATERIALS = {
  tubeFabric: {
    name: '4130 tube + fabric',
    lin:   { fus: 0.58, wing: 0.62, gear: 1.05 },
    cover: 0.42,
    k:     { fus: 2.0e5, wing: 5.0e5, gear: 2.8e4 },
    c:     { fus: 60,    wing: 450,   gear: 900 },
    cd0: 0.0022, clmaxK: 1.00, cost: 1.0,
  },
  wood: {
    name: 'spruce + ply',
    lin:   { fus: 0.50, wing: 0.58, gear: 1.20 },
    cover: 0.62,
    k:     { fus: 4.0e5, wing: 2.5e6, gear: 1.3e5 },
    c:     { fus: 300,   wing: 950,   gear: 2400 },
    cd0: 0.0009, clmaxK: 1.02, cost: 0.8,
  },
};

// Cabin box per seating layout: half-width, height above the lower longeron,
// fore-aft length, and the crew mass it carries.
const GEN_SEATING = {
  single:  { halfW: 0.32, h: 0.92, len: 0.62, crew: 1 },
  tandem2: { halfW: 0.36, h: 1.00, len: 0.78, crew: 2 },
  side2:   { halfW: 0.53, h: 1.05, len: 0.90, crew: 2 },
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
  sparFront:   0.15,   // front spar, fraction of chord
  sparRearMax: 0.72,
  propClear:   0.40,   // m, prop tip to ground in the LEVEL attitude (Cub 0.42)
  // Tailwheel leg length below the tailpost foot. The three-point deck angle
  // is DERIVED from this, not the other way round: a real tailwheel spring has
  // a length, and the attitude is what falls out of it. (Fixing the deck angle
  // instead pushes the tailwheel up into the tailpost as the tail arm grows,
  // and the tailpost then drags — measured, parked clearance halved.)
  twLeg:       0.23,   // m (Cub: TPB 0.25, TW axle 0.02)
  deckMin:     8.0, deckMax: 15.0,   // deg, reported and gated
  gearRake:    16.0,   // deg, CG to main axle from vertical (nose-over guard)
  trackRatio:  1.23,   // main track / CG height above ground
  washSpread:  1.12,   // propwash effective radius / prop radius (Cub-fitted)
  stabWash:    0.60,   // fraction of propwash seen by the stab / fin
  finWash:     1.00,
};

// The one preset this chantier ships: a strut-braced high-wing taildragger in
// the Cub envelope. Nulls are the derived fields — that is most of the
// aeroplane, which is the point.
const GEN_DEFAULT = {
  name: 'Garage Special',
  reg: 'F-PGAR',
  material: 'tubeFabric',
  engine: 'a65_sensenich74',
  seating: 'tandem2',
  // LOADING, not capacity: `seating` sizes the cabin, `pilots` says how many
  // seats are filled for the flight the shakedown and the gates measure. A
  // J-3-class aeroplane is flown solo; loading both seats is a different
  // aeroplane and should read as one.
  pilots: 1,
  fuelL: 50,                 // usable litres (avgas 0.72 kg/l)
  baggage: 10,               // kg

  cab:  { halfW: null, h: null, len: null, noseGap: 0.62 },
  fuse: { tailArm: null, postGap: 0.67, tailBays: 4,
          tailW: 0.10, tailBot: 0.20, tailTop: 0.38,
          crownTop: 0.60, crownSide: 0.18 },   // skin-only: former bulge, 0 = bare truss
  wing: { span: 10.0, chord: 1.60, taper: 1.0, dihedral: 3.0,
          incidence: 1.5, washout: 1.5, naca: 2412, panels: 3,
          strut: true, xLE: null },
  tail: { hSpan: null, hChord: null, hX: null,
          vHeight: null, vChord: null, vX: null },
  gear: { track: null, x: null, y: null, wheelR: 0.20,
          twX: null, twY: null, twR: 0.10 },
  paint: { base: 0xf2c437, trim: 0x1b3a5c, sweep: 0.55, gloss: 0.42 },
};

const GEN_PRESETS = { garage: GEN_DEFAULT };

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

// NACA 4-digit digits -> {m, p, t} as fractions of chord.
function nacaParts(code) {
  const d = String(code | 0).padStart(4, '0');
  return { m: +d[0] / 100, p: Math.max(0.05, +d[1] / 10), t: +d.slice(2) / 100 };
}

// Keep the parameter space inside an envelope this chantier has flown. The
// editor calls this on every change, so a slider can never build something the
// structure rules were not written for.
function clampSpec(spec) {
  const S = genClone(spec);
  if (!GEN_MATERIALS[S.material]) S.material = 'tubeFabric';
  if (!GEN_SEATING[S.seating]) S.seating = 'tandem2';
  if (typeof POWERPLANTS !== 'undefined' && !POWERPLANTS[S.engine])
    S.engine = 'a65_sensenich74';
  S.fuelL = genClamp(S.fuelL, 0, 140);
  S.baggage = genClamp(S.baggage, 0, 60);
  const w = S.wing;
  w.chord = genClamp(w.chord, 1.15, 2.10);
  w.span = genClamp(w.span, Math.max(6.5, 4.0 * w.chord),
                            Math.min(14.0, 10.0 * w.chord));
  w.taper = genClamp(w.taper, 0.45, 1.0);
  w.dihedral = genClamp(w.dihedral, 0, 6);
  w.incidence = genClamp(w.incidence, -1, 4);
  w.washout = genClamp(w.washout, 0, 4);
  w.panels = genClamp(w.panels | 0, 2, 5);
  const n = nacaParts(w.naca);
  w.naca = (genClamp(Math.round(n.m * 100), 0, 6) * 1000)
         + (genClamp(Math.round(n.p * 10), 2, 6) * 100)
         + genClamp(Math.round(n.t * 100), 9, 18);
  S.fuse.tailBays = genClamp(S.fuse.tailBays | 0, 3, 6);
  S.fuse.postGap = genClamp(S.fuse.postGap, 0.35, 1.10);
  S.fuse.crownTop = genClamp(S.fuse.crownTop, 0, 1);
  S.fuse.crownSide = genClamp(S.fuse.crownSide, 0, 0.6);
  S.cab.noseGap = genClamp(S.cab.noseGap, 0.40, 1.10);
  return S;
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
  S.seats = seat.crew;
  S.crew = genClamp(S.pilots | 0, 1, seat.crew);

  // 2. wing longitudinal placement — the front spar lands on the cabin-front
  //    frame, which is what puts a high-wing carry-through over the cabin
  const w = S.wing;
  put(w, 'xLE', S.cab.noseGap - GEN_RULES.sparFront * w.chord, 'wing.xLE');
  const xAC = w.xLE + 0.25 * w.chord;                 // wing quarter chord
  const cBar = w.chord * (2 / 3) * (1 + w.taper + w.taper * w.taper) / (1 + w.taper);
  const semi = 0.5 * w.span;
  const Sw = w.span * w.chord * 0.5 * (1 + w.taper);
  S.geom = { xAC, cBar, semi, Sw, AR: w.span * w.span / Sw };

  // 3. fuselage length from the tail arm rule
  put(S.fuse, 'tailArm', xAC + GEN_RULES.tailArmC * w.chord, 'fuse.tailArm');
  const post = S.fuse.tailArm + S.fuse.postGap;
  S.fuse.postX = post;

  // 4. empennage from tail volume coefficients against the wing just sized
  const t = S.tail;
  put(t, 'hX', S.fuse.tailArm + 0.70 * S.fuse.postGap, 'tail.hX');
  put(t, 'vX', S.fuse.tailArm + 0.90 * S.fuse.postGap, 'tail.vX');
  const lh = Math.max(1.0, t.hX - xAC), lv = Math.max(1.0, t.vX - xAC);
  const Sh = GEN_RULES.Vh * S.geom.Sw * cBar / lh;
  const Sv = GEN_RULES.Vv * S.geom.Sw * w.span / lv;
  put(t, 'hSpan', Math.sqrt(Sh * GEN_RULES.hAR), 'tail.hSpan');
  put(t, 'hChord', Sh / t.hSpan, 'tail.hChord');
  put(t, 'vHeight', Math.sqrt(Sv * GEN_RULES.vAR), 'tail.vHeight');
  put(t, 'vChord', Sv / t.vHeight, 'tail.vChord');
  S.tail.Sh = Sh; S.tail.Sv = Sv; S.tail.lh = lh; S.tail.lv = lv;

  // 5. gear — the two hard geometric constraints of a taildragger.
  //    y: the prop must clear the ground in the LEVEL attitude (this is the
  //    binding case; three-point has the nose up and is generous).
  //    twY: set so the three-point deck angle is the design value.
  //    x and track need the CG, so genFrame() places them on a second pass.
  const PP = (typeof POWERPLANTS !== 'undefined' && POWERPLANTS[S.engine]) || null;
  const propR = PP ? PP.prop.D / 2 : 0.9;
  S.propR = propR;
  S.engY = 0.36 * S.cab.h;                      // thrustline, above the lower longeron
  S.engX = -(0.18 + 0.32 * propR);              // firewall forward: cowl + prop
  put(S.gear, 'y', S.engY - propR + S.gear.wheelR - GEN_RULES.propClear, 'gear.y');
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
function genLattice(S, gearX, track) {
  const M = GEN_MATERIALS[S.material];
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
  const B = (a, b, cls, ext) => {
    const L = Math.hypot(P[b][0]-P[a][0], P[b][1]-P[a][1], P[b][2]-P[a][2]);
    beams.push({ a, b, k: M.k[cls], c: M.c[cls], gear: cls === 'gear', cls,
                 ext: !!ext || cls === 'gear', L });
    // structural mass: linear density x length, half to each end (this is the
    // whole structural mass model — there is no separate mass budget to keep
    // in sync with the geometry)
    const h = 0.5 * L * M.lin[cls];
    nodes[a].m += h; nodes[b].m += h;
  };
  const cover = (area, ids) => {
    const per = area * M.cover / ids.length;
    for (const i of ids) nodes[i].m += per;
  };
  const pt = (i, m) => { nodes[i].m += m; };

  // ---- 1. fuselage stations ------------------------------------------
  // rings 0..2 are firewall / cabin front / cabin rear; the rest are evenly
  // spaced to the tail. The cabin rings are pinned because the wing spars and
  // the seats attach to them.
  const cab = S.cab, fu = S.fuse;
  const cabRear = cab.noseGap + cab.len;
  const xs = [0, cab.noseGap, cabRear];
  for (let i = 1; i <= fu.tailBays; i++)
    xs.push(cabRear + (fu.tailArm - cabRear) * i / fu.tailBays);
  const ST = xs.map(x => {
    if (x <= cabRear) {
      // firewall is slightly narrower and lower than the cabin (cowl line)
      const u = x / Math.max(1e-6, cab.noseGap);
      const f = x < cab.noseGap ? u : 1;
      return { x, w: cab.halfW * (0.92 + 0.08 * f), yb: -0.02 * f,
               yt: cab.h * (0.78 + 0.22 * f) };
    }
    const t = (x - cabRear) / Math.max(1e-6, fu.tailArm - cabRear);
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
  const PP = POWERPLANTS[S.engine];
  const [EL, ER] = NM(S.engX, S.engY, 0.55 * cab.halfW, 'ENG');
  B(EL, ER, 'fus');
  B(EL, F[0].TL, 'fus'); B(EL, F[0].BL, 'fus'); B(EL, F[0].BR, 'fus');
  B(ER, F[0].TR, 'fus'); B(ER, F[0].BR, 'fus'); B(ER, F[0].BL, 'fus');
  const propM = 2.0 * PP.prop.D;
  pt(EL, 0.5 * (PP.engine.mass + propM)); pt(ER, 0.5 * (PP.engine.mass + propM));

  // ---- 3. wing --------------------------------------------------------
  const w = S.wing, G = S.geom;
  const zRoot = cab.halfW;
  const zs = [];
  for (let i = 1; i <= w.panels; i++)
    zs.push(zRoot + (G.semi - zRoot) * i / w.panels);
  const chordAt = z => w.chord * (1 - (1 - w.taper) * (z - zRoot) / Math.max(1e-6, G.semi - zRoot));
  const sparFront = R.sparFront;
  // rear spar sits on the cabin-rear frame; its chord fraction follows, which
  // is what ties the wing box to the fuselage frames rather than to skin
  const sparSpacing = cabRear - cab.noseGap;
  const sparRear = Math.min(R.sparRearMax, sparFront + sparSpacing / w.chord);
  const xF = w.xLE + sparFront * w.chord, xR = w.xLE + sparRear * w.chord;
  const dih = Math.tan(w.dihedral * D);
  const incAt = z => (w.incidence - w.washout * (z - zRoot) / Math.max(1e-6, G.semi - zRoot)) * D;
  const yF = z => cab.h + (z - zRoot) * dih;
  const wf = { L: null, R: null };
  const mkWing = (s) => {
    const rootF = s > 0 ? F[1].TR : F[1].TL;
    const rootR = s > 0 ? F[2].TR : F[2].TL;
    const strutRoot = s > 0 ? F[1].BR : F[1].BL;
    const WF = zs.map(z => N(xF, yF(z), s * z, 'WF'));
    const WR = zs.map(z => N(xR, yF(z) - sparSpacing * Math.tan(incAt(z)), s * z, 'WR'));
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
    if (w.strut) {
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
    }
    wf[s > 0 ? 'R' : 'L'] = { F: cF, R: cR, strutRoot };
  };
  mkWing(+1); mkWing(-1);
  // centre section covering, over the cabin
  cover(1.9 * 2 * zRoot * w.chord, [F[1].TL, F[1].TR, F[2].TL, F[2].TR]);

  // ---- 4. empennage ---------------------------------------------------
  const t = S.tail;
  const [HTL, HTR] = NM(t.hX, lastST.yb + 0.55 * (lastST.yt - lastST.yb), 0.5 * t.hSpan, 'HT');
  for (const [H, side] of [[HTL, 'L'], [HTR, 'R']]) {
    B(H, TPB, 'fus'); B(H, TPT, 'fus');
    B(H, side === 'L' ? last.BL : last.BR, 'fus');
    B(H, side === 'L' ? last.TL : last.TR, 'fus');
  }
  cover(1.9 * t.Sh, [HTL, HTR, TPB, TPT]);
  const FIN = N(t.vX, lastST.yt + t.vHeight * 0.82, 0, 'FIN');
  B(FIN, TPT, 'fus'); B(FIN, last.TL, 'fus'); B(FIN, last.TR, 'fus');
  cover(1.9 * t.Sv, [FIN, TPT, last.TL, last.TR]);

  // ---- 5. gear --------------------------------------------------------
  const gy = S.gear.y, wr = S.gear.wheelR;
  const gx = gearX !== null && gearX !== undefined ? gearX : cab.noseGap * 0.9;
  const tr = track !== null && track !== undefined ? track : 5 * cab.halfW;
  const [GAL, GAR] = NM(gx, gy, 0.5 * tr, 'AXLE', wr);
  B(GAL, GAR, 'gear');
  // rule 7: the gear needs a LONGITUDINAL (drag) load path anchored well
  // fore and aft of the axle, into HEAVY nodes — the firewall ring and the
  // cabin-front ring, never into light structure.
  B(GAL, F[0].BL, 'gear'); B(GAL, F[1].BL, 'gear'); B(GAL, F[0].BR, 'gear');
  B(GAR, F[0].BR, 'gear'); B(GAR, F[1].BR, 'gear'); B(GAR, F[0].BL, 'gear');
  pt(GAL, 3.5); pt(GAR, 3.5);                          // wheels, tyres, brakes

  const twX = S.gear.twX !== null && S.gear.twX !== undefined
    ? S.gear.twX : fu.postX - 0.10;
  // the tailwheel hangs off the tailpost foot by its leg length; the
  // three-point attitude is whatever that geometry produces (GEN_RULES.twLeg)
  const twY = S.gear.twY !== null && S.gear.twY !== undefined
    ? S.gear.twY : nodes[TPB].p[1] - R.twLeg;
  const TW = N(twX, twY, 0, 'TW', S.gear.twR);
  B(TW, TPB, 'gear'); B(TW, last.BL, 'gear'); B(TW, last.BR, 'gear');
  // rule 10: a near-axial chain LATCHES with every strain under 1%, and no
  // strain gate can see it. Both cures the Cub needed are mandatory here:
  // a snap-blocking near-vertical member, AND a wide lateral pyramid.
  B(TW, TPT, 'gear');
  B(TW, HTL, 'gear'); B(TW, HTR, 'gear');
  pt(TW, 2.0);

  // ---- 6. payload, fuel, systems --------------------------------------
  // tandem: pilot in the FRONT seat first (a J-3 is soloed from the rear, but
  // that is a CG choice the player can make by moving the seat, not a default)
  const seatRings = S.seating === 'tandem2' ? [F[1], F[2]] : [F[1], F[1]];
  for (let i = 0; i < S.crew; i++) {
    const rg = seatRings[i] || F[1];
    pt(rg.BL, 40); pt(rg.BR, 40);
  }
  const fuelM = S.fuelL * 0.72;
  pt(F[0].TL, 0.5 * fuelM); pt(F[0].TR, 0.5 * fuelM);   // header/wing-root tank
  pt(F[0].TL, 6); pt(F[0].TR, 6);                       // panel + systems
  const bag = F[Math.min(3, F.length - 1)];
  pt(bag.BL, 0.5 * S.baggage); pt(bag.BR, 0.5 * S.baggage);

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
    wf, zs, zRoot, xF, xR, sparFront, sparRear, sparSpacing,
    chordAt, yF, incAt, cabRear, gx, tr, twX, twY,
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
  const a = genLattice(S, S.gear.x, S.gear.track);
  const cg = genLatticeCG(a.nodes);
  const gy = S.gear.y;
  // main axle rake: forward of the CG by gearRake degrees off vertical. Too
  // little and it noses over on the brakes; too much and it will not fly the
  // tail up. Track from the CG height, against ground-loop divergence.
  const gx = S.gear.x !== null && S.gear.x !== undefined
    ? S.gear.x : cg[0] - Math.tan(R.gearRake * D) * (cg[1] - gy);
  const tr = S.gear.track !== null && S.gear.track !== undefined
    ? S.gear.track : R.trackRatio * (cg[1] - (gy - S.gear.wheelR));
  const out = genLattice(S, gx, tr);
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

const GEN_TUBE_R = { fus: 0.016, wing: 0.020, gear: 0.024 };
const GEN_RADIAL = 20;          // fuselage section resolution
const GEN_LSEG = 3;             // lengthwise slices per fuselage bay
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

// Station cross-section: blend from the bare truss rectangle to a rounded
// former. theta 0 = top, +pi/2 = +z side, pi = bottom.
function genRing(theta, halfW, halfD, crownT, crownS) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  const s = Math.min(halfD / Math.max(1e-6, Math.abs(cy)), halfW / Math.max(1e-6, Math.abs(cz)));
  const ry = cy * s, rz = cz * s;                       // truss rectangle
  const crown = cy > 0 ? crownT : crownS;
  const k = 1 + 0.15 * crown;                           // formers stand a little proud
  const ey = halfD * cy * k, ez = halfW * cz * k;       // rounded former
  return [ry + (ey - ry) * crown, rz + (ez - rz) * crown];
}

// ---------------------------------------------------------------------------
// genSkin(def) -> payload in the decodeModel shape, plus per-vertex bindings.
// ---------------------------------------------------------------------------
function genSkin(def) {
  const S = def.spec, P = def.parts, N = def.nodes;
  const FR = genRestFrame(def);
  const B = FR.to;
  const skin = genMesh(), glass = genMesh(), frame = genMesh(),
        strut = genMesh(), tyre = genMesh(), prop = genMesh();
  const w1 = i => [[i, 1]];

  // ---- 1. tubes: one hexagonal prism per beam -------------------------
  const HEX = 6;
  for (const b of def.beams) {
    const M = b.ext ? strut : frame;
    const A = N[b.a].p, C = N[b.b].p;
    const ax = genV3.norm(genV3.sub(C, A));
    let up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
    const r = GEN_TUBE_R[b.cls] * (b.ext ? 1.15 : 1);
    const ring = [];
    for (let s = 0; s < 2; s++) {
      const nd = s ? b.b : b.a, base = s ? C : A, row = [];
      for (let h = 0; h < HEX; h++) {
        const a2 = 2 * Math.PI * h / HEX;
        const off = genV3.add(genV3.mul(e1, r * Math.cos(a2)), genV3.mul(e2, r * Math.sin(a2)));
        row.push(M.v(B(genV3.add(base, off)), h / HEX, s, w1(nd)));
      }
      ring.push(row);
    }
    for (let h = 0; h < HEX; h++)
      M.quad(ring[0][h], ring[0][(h+1)%HEX], ring[1][(h+1)%HEX], ring[1][h]);
  }

  // ---- 2. fuselage covering -------------------------------------------
  // Every section vertex is BILINEAR on that ring's four truss corners, in the
  // ring's own normalised (uz, uy). A former that stands proud of the truss has
  // |u| > 1 and simply extrapolates — same weights, no special case.
  const ST = P.ST, F = P.F, fu = S.fuse;
  // Glazing is INSET inside its bay, both along the body and around the
  // section — a window that runs frame to frame reads as a missing panel, not
  // as a window. Angles are measured from the top (0) toward either side.
  const nCabinBays = 2;
  const glazing = (bay, seg, th) => {
    const a = Math.abs(((th + Math.PI) % (2*Math.PI)) - Math.PI);
    if (bay === 0) return seg === GEN_LSEG - 1 && a < 1.02;     // windscreen
    if (bay <= nCabinBays) return seg < GEN_LSEG - 1 && a > 0.92 && a < 1.86;  // side glass
    return false;
  };
  // one section per lengthwise slice; a slice between two frames blends both
  const section = (i, s) => {
    const A = ST[i], C = ST[Math.min(i + 1, ST.length - 1)];
    const L = (a, b) => a + (b - a) * s;
    return { x: L(A.x, C.x), w: L(A.w, C.w), yb: L(A.yb, C.yb), yt: L(A.yt, C.yt) };
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
  let lastFusRow = null;
  for (let i = 0; i < F.length - 1; i++) {
    for (let sg = 0; sg < GEN_LSEG; sg++) {
      // reuse the previous slice's row rather than emitting a coincident one:
      // duplicate vertices split the normal average and crease the fuselage
      const rowA = lastFusRow || sectionRow(i, sg / GEN_LSEG);
      const rowB = sectionRow(i, (sg + 1) / GEN_LSEG);
      const aS = rowA.ids || emitRow(rowA, skin), bS = emitRow(rowB, skin);
      rowA.ids = aS; rowB.ids = bS;
      let aG = null, bG = null;
      for (let h = 0; h < GEN_RADIAL; h++) {
        const th = 2 * Math.PI * (h + 0.5) / GEN_RADIAL;
        if (glazing(i, sg, th)) {
          if (!aG) { aG = emitRow(rowA, glass); bG = emitRow(rowB, glass); }
          glass.quad(aG[h], aG[h+1], bG[h+1], bG[h]);
        } else {
          skin.quad(aS[h], aS[h+1], bS[h+1], bS[h]);
        }
      }
      lastFusRow = rowB;
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
  // cowl: ring 0 forward to the spinner backplate, blending to a circle and
  // handing its weights over from the firewall frame to the engine mounts
  const hub = [S.engX - 0.10, S.engY, 0];
  {
    const s0 = ST[0], f0 = F[0];
    const yc0 = 0.5 * (s0.yb + s0.yt), hD0 = 0.5 * (s0.yt - s0.yb);
    // the cowl must close ON the spinner backplate, or it ends as an open tube
    const rHub = Math.max(0.075, 0.16 * S.propR);
    const steps = [0, 0.35, 0.68, 0.90, 1];
    const rows = steps.map(t2 => {
      const x = s0.x + (hub[0] - s0.x) * t2;
      const row = [];
      for (let h = 0; h <= GEN_RADIAL; h++) {
        const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
        const [dy, dz] = genRing(th, s0.w, hD0, fu.crownTop, fu.crownSide);
        // blend the firewall section into a circle at the spinner backplate
        const e = 1 - Math.pow(1 - t2, 2);
        const cy2 = yc0 + dy * (1 - e) + (S.engY - yc0 + rHub * Math.cos(th)) * e;
        const cz2 = dz * (1 - e) + rHub * Math.sin(th) * e;
        const uz = dz / Math.max(1e-6, s0.w), uy = dy / Math.max(1e-6, hD0);
        const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
        const k = 1 - t2;
        const infl = [[f0.TL, k*wT*wL], [f0.TR, k*wT*wR], [f0.BL, k*wBo*wL],
                      [f0.BR, k*wBo*wR], [P.EL, 0.5*t2], [P.ER, 0.5*t2]];
        row.push(skin.v(B([x, cy2, cz2]), h / GEN_RADIAL, genUVBody(0) * (1 - t2), infl));
      }
      return row;
    });
    for (let r = 0; r < rows.length - 1; r++)
      for (let h = 0; h < GEN_RADIAL; h++)
        skin.quad(rows[r+1][h], rows[r+1][h+1], rows[r][h+1], rows[r][h]);
  }

  // ---- 3. wing --------------------------------------------------------
  // A section at every spar station, lofted along the span. Chordwise position
  // is affine on the two spar nodes (the spars ARE the chord frame, so the
  // weights are exact and extrapolate past LE and TE); the thickness offset is
  // a rest-frame constant, which is what `base` carries.
  const af = genAirfoil(S.wing.naca);
  const sparF = P.sparFront, sparR = P.sparRear;
  const kOf = xc => (xc - sparF) / (sparR - sparF);
  const aStart = 0.62 * S.geom.semi;
  const AIL_HINGE = 0.72;                       // aileron hinge, fraction of chord
  const wingSection = (nF, nR, chord, sid) => {
    const pF = N[nF].p, pR = N[nR].p;
    const ch = genV3.norm(genV3.sub(pR, pF));                 // LE -> TE
    const span = genV3.norm(genV3.sub(pR, pF));
    void span;
    // section normal: chord x spanwise. Spanwise from the node's own z sign so
    // both wings get an outward-consistent normal.
    const sgn = pF[2] >= 0 ? 1 : -1;
    const nrm = genV3.norm(genV3.cross(ch, genV3.mul([0, 0, 1], sgn)));
    return af.map(([xc, yc]) => {
      const base = genV3.add(pF, genV3.mul(ch, (xc - sparF) * chord));
      const p = genV3.add(base, genV3.mul(nrm, yc * chord));
      const k = kOf(xc);
      return { p, infl: [[nF, 1 - k], [nR, k]],
               sid: sid && xc > AIL_HINGE ? sid : 0, u: xc };
    });
  };
  const emitLoft = (rows, mesh, vOf) => {
    const ids = rows.map((row, r) => row.map(pt =>
      mesh.v(B(pt.p), pt.u, genUVPanel(vOf(r)), pt.infl, pt.sid)));
    for (let r = 0; r < ids.length - 1; r++)
      for (let h = 0; h < ids[r].length - 1; h++)
        mesh.quad(ids[r][h], ids[r][h+1], ids[r+1][h+1], ids[r+1][h]);
    return ids;
  };
  const capLoft = (ids, mesh) => {
    // close a section with a fan to its mid-chord point
    for (const row of ids) {
      const n = row.length;
      for (let h = 1; h < n - 1; h++) mesh.tri(row[0], row[h], row[h+1]);
    }
  };
  for (const [side, fw, sid] of [[1, P.wf.R, 3], [-1, P.wf.L, 4]]) {
    const zAll = [P.zRoot, ...P.zs];
    const rows = [];
    for (let i = 0; i < fw.F.length; i++) {
      const z = zAll[i];
      rows.push(wingSection(fw.F[i], fw.R[i], P.chordAt(z), z > aStart ? sid : 0));
    }
    // rounded tip: one extra section, shrunk about the tip chord's mid point
    const tipF = fw.F[fw.F.length-1], tipR = fw.R[fw.R.length-1];
    const tipSec = wingSection(tipF, tipR, P.chordAt(S.geom.semi), sid);
    const mid = genV3.mul(genV3.add(N[tipF].p, N[tipR].p), 0.5);
    const dz = 0.055 * S.wing.chord * side;
    rows.push(tipSec.map(pt => ({
      p: [mid[0] + (pt.p[0]-mid[0])*0.42, mid[1] + (pt.p[1]-mid[1])*0.42, pt.p[2] + dz],
      infl: pt.infl, sid: pt.sid, u: pt.u })));
    const ids = emitLoft(rows, skin, r => r / rows.length);
    capLoft([ids[ids.length - 1]], skin);
  }
  // centre section: the wing carries through above the cabin
  {
    const rows = [
      wingSection(P.wf.L.F[0], P.wf.L.R[0], S.wing.chord, 0),
      wingSection(P.wf.R.F[0], P.wf.R.R[0], S.wing.chord, 0),
    ];
    emitLoft(rows, skin, r => r);
  }

  // ---- 4. empennage ---------------------------------------------------
  // Mini-wings on a symmetric section, blending their weights from the tail
  // post inboard to the tip node outboard.
  const sym = genAirfoil(9);                               // NACA 0009
  const panel = (rowsSpec, sid, hingeFrac) => {
    const rows = rowsSpec.map(({ le, te, infl }) => {
      const ch = genV3.norm(genV3.sub(te, le));
      const len = Math.hypot(te[0]-le[0], te[1]-le[1], te[2]-le[2]);
      const nrm = genV3.norm(genV3.cross(ch, genV3.norm(genV3.sub(rowsSpec[1].le, rowsSpec[0].le))));
      return sym.map(([xc, yc]) => ({
        p: genV3.add(genV3.add(le, genV3.mul(ch, xc * len)), genV3.mul(nrm, yc * len)),
        infl, sid: xc > hingeFrac ? sid : 0, u: xc }));
    });
    const ids = emitLoft(rows, skin, r => r / Math.max(1, rowsSpec.length - 1));
    capLoft([ids[0], ids[ids.length - 1]], skin);
  };
  {
    const t = S.tail, hc = t.hChord, hx = t.hX;
    const hy = N[P.HTL].p[1], hz = 0.5 * t.hSpan;
    const post = [[P.TPB, 0.5], [P.TPT, 0.5]];
    const stabRow = (z, infl) => ({ le: [hx - 0.35*hc, hy, z], te: [hx + 0.65*hc, hy, z], infl });
    panel([stabRow(-hz, [[P.HTL, 1]]), stabRow(-0.18*hz, [[P.HTL, 0.30], ...post.map(([i,w]) => [i, w*0.70])]),
           stabRow(0.18*hz, [[P.HTR, 0.30], ...post.map(([i,w]) => [i, w*0.70])]), stabRow(hz, [[P.HTR, 1]])],
          1, 0.66);
    const vc = t.vChord, vx = t.vX, vy0 = N[P.TPT].p[1], vy1 = N[P.FIN].p[1];
    const finRow = (y, k, sw) => ({ le: [vx - 0.40*vc + sw, y, 0], te: [vx + 0.60*vc, y, 0],
      infl: [[P.FIN, k], [P.TPT, (1-k)*0.6], [P.TPB, (1-k)*0.4]] });
    panel([finRow(vy0, 0, 0), finRow(vy0 + 0.5*(vy1-vy0), 0.5, 0.14*vc),
           finRow(vy1, 1, 0.30*vc)], 2, 0.60);
  }

  // ---- 5. wheels and propeller ----------------------------------------
  const wheel = (nd, r, halfWid) => {
    const SEG = 14, rows = [];
    for (const off of [-halfWid, halfWid]) {
      const row = [];
      for (let h = 0; h <= SEG; h++) {
        const a = 2 * Math.PI * (h % SEG) / SEG;
        row.push(tyre.v(B([N[nd].p[0] + r*Math.cos(a), N[nd].p[1] + r*Math.sin(a),
                           N[nd].p[2] + off]), h/SEG, off > 0 ? 1 : 0, w1(nd)));
      }
      rows.push(row);
    }
    for (let h = 0; h < SEG; h++) tyre.quad(rows[0][h], rows[0][h+1], rows[1][h+1], rows[1][h]);
    for (const row of rows) for (let h = 1; h < SEG - 1; h++) tyre.tri(row[0], row[h], row[h+1]);
  };
  wheel(P.GAL, S.gear.wheelR, 0.055);
  wheel(P.GAR, S.gear.wheelR, 0.055);
  wheel(P.TW, S.gear.twR, 0.035);
  {
    const eng = [[P.EL, 0.5], [P.ER, 0.5]];
    const rSp = Math.max(0.075, 0.16 * S.propR), SEG = 12;
    const back = [], tip = prop.v(B([hub[0] - 1.5*rSp, S.engY, 0]), 0.5, 1, eng);
    for (let h = 0; h <= SEG; h++) {
      const a = 2*Math.PI*(h % SEG)/SEG;
      back.push(prop.v(B([hub[0], S.engY + rSp*Math.cos(a), rSp*Math.sin(a)]), h/SEG, 0, eng));
    }
    for (let h = 0; h < SEG; h++) prop.tri(back[h], back[h+1], tip);
    // two blades, tapered and twisted, on the disc plane
    for (const bs of [1, -1]) {
      const r0 = 0.9*rSp, r1 = S.propR;
      const row = [];
      for (let i = 0; i <= 5; i++) {
        const t2 = i/5, r = r0 + (r1-r0)*t2;
        // narrow, tapered, and rounded off at the tip — a blade, not a paddle
        const cw = 0.055*S.propR*(1 - 0.30*t2) * (t2 > 0.88 ? (1 - t2) / 0.12 : 1);
        const tw = (0.34 - 0.27*t2);
        const cy = S.engY + bs*r*Math.cos(0), cz = bs*r*Math.sin(0);
        void cz;
        row.push([
          prop.v(B([hub[0] - cw*Math.sin(tw) - 0.02, cy, -cw*Math.cos(tw)]), 0, t2, eng),
          prop.v(B([hub[0] + cw*Math.sin(tw) - 0.02, cy, cw*Math.cos(tw)]), 1, t2, eng),
        ]);
      }
      for (let i = 0; i < row.length - 1; i++)
        prop.quad(row[i][0], row[i][1], row[i+1][1], row[i+1][0]);
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
  const surfaces = [
    { name: 'elevator', drive: 'de', sgn: -1, k: 1.0,
      p: bp([t.hX + 0.31 * t.hChord, stabY, 0]),
      ax: hingeAxis([t.hX + 0.31*t.hChord, stabY, -1], [t.hX + 0.31*t.hChord, stabY, 1]) },
    { name: 'rudder', drive: 'dr', sgn: 1, k: 1.0,
      p: bp([t.vX + 0.20 * t.vChord, N[P.TPT].p[1], 0]),
      ax: hingeAxis([t.vX + 0.20*t.vChord, N[P.TPT].p[1], 0],
                    [t.vX + 0.20*t.vChord + 0.30*t.vChord, N[P.FIN].p[1], 0]) },
    { name: 'ailR', drive: 'da', sgn: -1, k: 1.0,
      p: bp([P.xF + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), zA]),
      ax: hingeAxis([0, P.yF(aStart), aStart], [0, P.yF(semi), semi]) },
    { name: 'ailL', drive: 'da', sgn: 1, k: 1.0,
      p: bp([P.xF + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), -zA]),
      ax: hingeAxis([0, P.yF(aStart), -aStart], [0, P.yF(semi), -semi]) },
  ];

  const groups = {};
  const put = (nm, M) => { const g = M.done(); if (g.nv) groups[nm] = g; };
  put('skin', skin); put('glass', glass); put('frame', frame);
  put('gearmetal', strut); put('tyre', tyre); put('prop', prop);
  return {
    v: 5, generated: true,
    hub: B(hub),
    groups, surfaces,
    mats: {
      // the viewer bakes `paint` procedurally (src/viewer/garage.js) and drops
      // it in before the material is built; without it this falls back to flat
      skin:      { tex: 'paint', rough: 1 - S.paint.gloss },
      glass:     { opacity: 0.30, color: 0xaad4ea },
      frame:     { color: 0x5a6470 },
      gearmetal: { color: 0x6d7682 },
      tyre:      { color: 0x22242a },
      prop:      { color: 0x2a2620 },
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
  const PP = POWERPLANTS[def.params.powerplant];
  const Tavail = Math.max(1, PP.prop.Tstatic - PP.prop.kV2 * V * V);
  def.params.ap.thrCruise = Math.min(0.95, Math.max(0.15, fin.r.drag / Tavail));
  def.params.gen.alphaCruise = fin.a;
  def.params.gen.LD = fin.r.Fy / Math.max(1e-6, fin.r.drag);
  // takeoff run to 2.5 m agl, conservative on purpose: the AP only uses it to
  // decide whether to backtrack, and over-estimating means it backtracks when
  // in doubt (measured Cub 60 m, this estimate 98 m).
  const Vlof = 1.05 * def.params.ap.VRot;
  const acc = Math.max(0.3, (0.92 * PP.prop.Tstatic - 0.05 * W) / sim.totalM);
  def.params.ap.TORun = Math.round(1.35 * Vlof * Vlof / (2 * acc));
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
  const out = {
    mass: sim.totalM, W,
    Vs: g.Vs, VCruise: V, LD: r0.Fy / Math.max(1e-6, r0.drag),
    alphaCruise: a * 180 / Math.PI,
    Sw, wingLoad: sim.totalM / Sw,
    cgX: cg[0], npX: cg[0] + npShift, staticMargin: npShift / cBar,
    TORun: def.params.ap.TORun, thrCruise: def.params.ap.thrCruise,
    stabTrim: def.params.stabTrim,
  };
  if (S && P) {
    const ground = S.gear.y - S.gear.wheelR;
    const tw = def.nodes[P.TW];
    out.AR = g.AR;
    out.deckAngle = Math.atan2((tw.p[1] - S.gear.twR) - ground, P.twX - P.gx) * 180 / Math.PI;
    out.propClear = (S.engY - S.propR) - ground;
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
  return def;
}
if (typeof module !== 'undefined')
  module.exports = { buildCub, buildDrone, buildDC3, buildJodel, buildC172, buildChinook, buildPA18, makeSim, makeAutopilot, placeAtAerodrome, makeWorld, bakeHydrology, POWERPLANTS, POLARS, PAR, decodeModel, decodeB64, defCG, makeSkinBinding, sparDeltas, applySkinDeform, makeHingeBinding, applyHinges, makeLinkage, buildGen, resolveSpec, clampSpec, genFrame, genShakedown, genPolar, genThinAirfoil, GEN_DEFAULT, GEN_PRESETS, GEN_MATERIALS, GEN_SEATING, GEN_RULES, genSkin, poseSkinGen, genNodeBody, genRestFrame, genAirfoil };
