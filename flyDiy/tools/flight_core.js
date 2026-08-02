// GENERATED FILE - DO NOT EDIT. Built from src/core/ by tools/build.js.
// body-sha256: 5722b283de8a75e7
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
      wash: o.wash || 0, ail: o.ail || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    for (let b = 0; b < zSt.length - 1; b++) {
      const zm = (zSt[b] + zSt[b + 1]) / 2, dz = zSt[b + 1] - zSt[b];
      const ch = chord(zm), area = ch * dz;
      const wsh = zm < 4.6 ? 0.8 : zm < 6.5 ? 0.3 : 0;
      const ail = b >= zSt.length - 3 ? 1 : 0;
      wingStrip(fr.F[b], fr.F[b + 1], fr.R[b], fr.R[b + 1], 0.5, area, ch, side,
        { wash: wsh, ail });
    }
  }
  wingStrip(F[2].BL, F[2].BR, F[3].BL, F[3].BR, 0.5, 12.5, 4.33, 1, { wash: 0.3 });
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
    ap: {
      rotate: true,
      VRot: 45, VClimbMin: 42, VClimb: 46, VCruise: 58, VAppr: 44, VTurn: 55,
      thTailUp: 0.030, thRotate: 0.100,
      lookRoll: 45, lookAppr: 650, lookCruise: 900,
      hCruise: 250, hSafe: 30, xTurn: -5800, xAim: -810, gs: 0.044,
      thrFloor: 0.05,
      rollDe: 0.06, liftoffTh: 0.15, liftoffRamp: 0.06,
      climbThBase: 0.11, climbThGain: 0.015, thMax: 0.17,
      flareAgl: 7, flareRate: 0.030, aglGuard: 6, flareThMax: 0.11,
      VTailUp: 20, VStop: 0.5, slew: 0.8, thrCruise: 0.55, thrAppr: 0.30,
      brakeMax: 0.45, brakeRampRate: 0.18, VBrakeOn: 36, VBrakeRelease: 2.5,
      rateFilt: 0.15, pitchP: 1.6, pitchD: 1.6, pitchI: 0.25,
      vsP: 0.006, vsI: 0.010, vsFloor: -0.06, altVSGain: 0.06,
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

  // ---- poutre monotube : tube triangulaire fin (8 cm) jusqu a l empennage
  const boomY = 1.08;
  const bTri = (x, m) => {
    const T = N(x, boomY + 0.05, 0, m, 'BOOM');
    const L = N(x, boomY - 0.03, -0.045, m, 'BOOM');
    const R = N(x, boomY - 0.03, 0.045, m, 'BOOM');
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
    wf[sgn > 0 ? 'R' : 'L'] = { F: WF, R: WR };
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

  // ---- bandes : pusher -> AUCUN souffle sur l aile, souffle sur l empennage
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, area, side, o = {}) => {
    strips.push({ kind: 'wing', side, t: 0.5, area, chord: CH,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * 0.5], [fOut, cf * 0.5], [rIn, cr * 0.5], [rOut, cr * 0.5]],
      wash: 0, ail: o.ail || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 1.77, side, { ail: 0.5 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 2.07, side, { ail: 0.8 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 2.00, side, { ail: 1 });
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
    ap: {
      VRot: 10, VClimbMin: 12, VClimb: 17, VCruise: 24, VAppr: 16, VTurn: 19,
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

  // ---- TRICYCLE gear: sprung mains aft of CG, steerable nosewheel ahead
  const [GAL, GAR] = NM(2.72, -0.60, 1.26, 14, 'AXLE', 0.28);
  BG(GAL, GAR);
  for (const [G, sgn] of [[GAL, -1], [GAR, 1]]) {
    const b2 = sgn > 0 ? F[2].BR : F[2].BL, b3 = sgn > 0 ? F[3].BR : F[3].BL;
    const b1 = sgn > 0 ? F[1].BR : F[1].BL, bo = sgn > 0 ? F[2].BL : F[2].BR;
    BG(G, b2); BG(G, b3); BG(G, b1); BG(G, bo);
  }
  const NW = N(0.75, -0.54, 0, 10, 'TW', 0.24);        // nosewheel (steerable ref)
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
      wash: o.wash || 0, ail: o.ail || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 2.77, 1.63, side, { wash: 0.45 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 2.31, 1.54, side, { ail: 0.4 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 2.12, 1.27, side, { ail: 1 });
  }
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 1.96, 1.63, 1, { wash: 0.9 });
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
    twSteer: -0.35,          // nosewheel: sign to be verified empirically
    ap: {
      rotate: true,
      VRot: 28, VClimbMin: 32, VClimb: 38, VCruise: 58, VAppr: 33.5, VTurn: 44,
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
      wash: o.wash || 0, ail: o.ail || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 2.65, 1.71, side, { wash: 0.35 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 1.81, 1.51, side, { ail: 0.5 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 1.20, 1.13, side, { ail: 1 });
  }
  wingStrip(F[2].BL, F[2].BR, F[3].BL, F[3].BR, 1.90, 1.71, 1, { wash: 0.9 });
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
    ap: {
      rotate: true,
      VRot: 27, VClimbMin: 30, VClimb: 41.7, VCruise: 62, VAppr: 33, VTurn: 45,
      thTailUp: 0.030, thRotate: 0.11,
      lookRoll: 30, lookAppr: 300, lookCruise: 420,
      hCruise: 160, hSafe: 20, xTurn: -3600, xAim: -560, gs: 0.045,
      thrFloor: 0.05,
      rollDe: 0.08, liftoffTh: 0.13, liftoffRamp: 0.10,
      climbThBase: 0.10, climbThGain: 0.022, thMax: 0.18,
      flareAgl: 4.0, flareRate: 0.055, aglGuard: 3,
      flareMode: 'vs', flareThr: 0.06, flareThMax: 0.11,
      VTailUp: 14, VStop: 0.4, slew: 2.0, thrCruise: 0.62, thrAppr: 0.32,
      brakeMax: 0.30, brakeRampRate: 0.14, VBrakeOn: 12, VBrakeRelease: 1.5,
      rateFilt: 0.18, attFilt: 0.60, pitchP: 1.3, pitchD: 0.70, pitchI: 0.12,
      pitchCmdSlew: 1.0, vsP: 0.014, vsI: 0.030, vsFloor: -0.10, altVSGain: 0.10,
      vsFilt: 0.40, hdgP: 0.5, hdgD: 0.8, bankSlew: 0.20, rollP: 1.1, rollD: 0.30,
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
  const K_F = 3000, C_F = 3.5, K_W = 25000, C_W = 11, K_G = 420, C_G = 9;
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
// WORLD — deterministic procedural terrain + trees, shared by
// physics and renderer. Integer-hash noise: identical across JS engines.
// ============================================================
function makeWorld() {
  const smf = t => t * t * (3 - 2 * t);
  const sstep = (a, b, t) => smf(Math.min(1, Math.max(0, (t - a) / (b - a))));
  const hash2 = (ix, iz) => {
    let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0;
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
  const fbm = (x, z) =>
    vnoise(x, z, 1400) * 0.45 + vnoise(x + 91, z + 37, 650) * 0.30 +
    vnoise(x + 7, z + 211, 300) * 0.17 + vnoise(x + 313, z + 97, 140) * 0.08;
  const ridge = (x, z, cell) => 1 - Math.abs(2 * vnoise(x + 555, z + 777, cell) - 1);

  function h0(x, z) {
    const n = fbm(x, z);
    const mount = sstep(700, 3200, -z);
    const sea = sstep(500, 2400, z);
    const rid = ridge(x, z, 1100) * 0.6 + ridge(x, z, 520) * 0.4;
    let h = (n - 0.35) * 45 + (0.55 * (n - 0.3) + 0.65 * (rid - 0.35)) * 620 * mount - 95 * sea;
    const dxC = Math.max(0, Math.max(-3400 - x, x - 400));
    const dzC = Math.max(0, Math.abs(z) - 750);
    h *= 0.06 + 0.94 * sstep(0, 700, Math.hypot(dxC, dzC));
    const dxR = Math.max(0, Math.max(-1180 - x, x - 130));
    const dzR = Math.max(0, Math.abs(z) - 90);
    h *= sstep(0, 260, Math.hypot(dxR, dzR));
    return h;
  }
  // landing meadows: blend terrain toward the height at each meadow centre
  const meadows = [
    { x: -2200, z: -1500, r: 230 },
    { x: 1800, z: 1500, r: 260 },
    { x: -3400, z: 650, r: 240 },
  ];
  for (const m of meadows) m.h = h0(m.x, m.z);
  function terrainH(x, z) {
    let h = h0(x, z);
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r) { const w = sstep(m.r * 0.45, m.r, d); h = m.h * (1 - w) + h * w; }
    }
    return h;
  }

  // trees on terrain, deterministic; spatial hash for collisions
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(7);
  const trees = [], CELL = 64, grid = new Map();
  let guard = 0;
  while (trees.length < 2200 && guard++ < 60000) {
    const x = (rng() - 0.5) * 8400, z = (rng() - 0.5) * 8400;
    const h = terrainH(x, z);
    if (h < 2 || h > 160) continue;
    if (Math.abs(z) < 60 && x < 150 && x > -3300) continue;
    let nearMeadow = false;
    for (const m of meadows)
      if (Math.hypot(x - m.x, z - m.z) < m.r * 0.8) { nearMeadow = true; break; }
    if (nearMeadow) continue;
    const s = 0.7 + rng() * 1.1;
    const idx = trees.length;
    trees.push({ x, z, h, s });
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(idx);
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
  return { terrainH, trees, treesNear, meadows, CELL };
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
  const ctl = { thr: 0, de: 0, da: 0, dr: 0, brake: 0 };
  const out = { V: 0, alpha: 0, thrust: 0, wash: 0, alt: 0, vs: 0 };
  let totalM = 0;
  for (const nd of def.nodes) totalM += nd.m;

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
    ctl.thr = ctl.de = ctl.da = ctl.dr = ctl.brake = 0;
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

  function polar(al, P) {
    const s = Math.min(1, Math.max(0, (Math.abs(al) - P.aStall) / 0.10));
    const Cl = (P.Cl0 + P.a3d * al) * (1 - s) + 1.1 * Math.sin(2 * al) * s;
    const CdAtt = P.Cd0 + Cl * Cl / P.eAR;
    const Cd = CdAtt * (1 - s) + (P.Cd0 + 1.9 * Math.sin(al) * Math.sin(al)) * s;
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
    const Vfwd = Math.max(0, -(vmx*xAft[0]+vmy*xAft[1]+vmz*xAft[2]));

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
    out.V = Math.hypot(vmx, vmy, vmz);
    out.alpha = Math.atan2(-(vmx*yUp[0]+vmy*yUp[1]+vmz*yUp[2]),
                           -(vmx*xAft[0]+vmy*xAft[1]+vmz*xAft[2]));
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
      // --- local velocity via attach weights ---
      let vx=0, vy=0, vz=0;
      for (const [i, w] of st.w) { vx+=v[i*3]*w; vy+=v[i*3+1]*w; vz+=v[i*3+2]*w; }
      // relative air velocity = air motion - node motion (propwash blows aft)
      const wsh = wash * st.wash;
      let rx = wsh*xAft[0]-vx, ry = wsh*xAft[1]-vy, rz = wsh*xAft[2]-vz;
      const u = rx*sc[0]+ry*sc[1]+rz*sc[2];
      const w_ = rx*sn[0]+ry*sn[1]+rz*sn[2];
      const V2 = u*u + w_*w_;
      if (V2 < 0.01) continue;
      let al = Math.atan2(w_, u);
      let P = P_.polarWing;
      if (st.kind === 'wing') {
        al += P_.ailTau * ctl.da * st.side * st.ail;
      } else if (st.kind === 'stab') {
        al = (1 - P_.downwash) * al + P_.stabTrim - P_.elevTau * ctl.de;
        P = P_.polarTail;
      } else {
        al += P_.rudTau * ctl.dr * PAR.rudderSign;
        P = P_.polarTail;
      }
      const [Cl, Cd] = polar(al, P);
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
      if (st.kind === 'wing') {
        const Fc = q * P_.polarWing.Cm0 * st.chord / P_.sparSpacing, t = st.t;
        const cW = [[st.fIn, (1-t)], [st.fOut, t], [st.rIn, -(1-t)], [st.rOut, -t]];
        for (const [i, w] of cW) {
          f[i*3] += Fc*w*sn[0]; f[i*3+1] += Fc*w*sn[1]; f[i*3+2] += Fc*w*sn[2];
        }
      }
    }
    // fuselage blobs: anisotropic CdA in body axes; side/vertical area split
    // between cabin and aft fuselage so yaw and pitch damping are physical
    const blob = (ids, CdA) => {
      let vx=0, vy=0, vz=0;
      for (const i of ids) { vx+=v[i*3]; vy+=v[i*3+1]; vz+=v[i*3+2]; }
      vx/=4; vy/=4; vz/=4;
      const rx=-vx, ry=-vy, rz=-vz, Vr = Math.hypot(rx, ry, rz);
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
    for (let s = 0; s < sub; s++) substep(dt);
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
// Conventions: de>0 nose-up, da>0 roll-right, dr>0 nose-left,
// e>0 = nose left of target.
// ============================================================
function makeAutopilot(sim, def) {
  const A = def.params.ap;
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: A.VAppr,
    xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
    targetDir: [-1, 0, 0], trackHold: true, dirX: -1,
    restAlt: null, tdInfo: null, dbg: {},
  };
  let thP = 0, phP = 0, eP = 0, q = 0, p = 0, eR = 0, eRslow = 0, thF = 0, phF = 0, thCA = 0, vsF = 0;
  let aDe = 0, aDa = 0, aDr = 0, phCA = 0;
  let Ith = 0, thcI = 0.06, It = 0, thrC = 0.6;
  let phaseT = 0, headingCapT = 0, thFlare0 = 0, thLift0 = 0, brakeRamp = 0, holdActive = false, holdWas = false;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    if (ap.restAlt === null) ap.restAlt = cg[1];
    const agl = cg[1] - ap.restAlt;
    const V = Math.hypot(vcg[0], vcg[1], vcg[2]);
    const nose = [-xA[0], -xA[2]];
    const nL = Math.hypot(nose[0], nose[1]) || 1e-9;
    nose[0] /= nL; nose[1] /= nL;

    let tx = ap.targetDir[0], tz = ap.targetDir[2];
    if (ap.trackHold) {
      const L = ap.phase === 'ROLL' || ap.phase === 'ROLLOUT' ? (A.lookRoll ?? 25)
              : ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (A.lookAppr ?? 100)
              : (A.lookCruise ?? 150);
      tx = ap.dirX * L; tz = -cg[2];
      const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    }
    const e = Math.atan2(tz * nose[0] - tx * nose[1], tx * nose[0] + tz * nose[1]);

    const AF = A.attFilt ?? 1.0;
    const thRaw = Math.asin(clamp(-xA[1], -1, 1));
    const phRaw = Math.atan2(-zR[1], yU[1]);
    thF += AF * (thRaw - thF); phF += AF * (phRaw - phF);
    const th = thF, ph = phF;
    const RF = A.rateFilt ?? 0.12;
    q += RF * ((th - thP) / dt - q); thP = th;
    p += RF * ((ph - phP) / dt - p); phP = ph;
    eR += RF * 0.85 * ((e - eP) / dt - eR); eP = e;
    eRslow += dt / 2.0 * (eR - eRslow);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(V, 5);

    const c = sim.ctl, onG = sim.wheelsOnGround();
    if (onG > 0 && agl < A.aglGuard && V < A.VRot * 0.9
        && ['LIFTOFF','CLIMB'].includes(ap.phase)) {
      ap.phase = 'ROLL'; phaseT = 0;      // genuinely settled back (slow): retry
    }

    const holdPitch = (thC) => {
      if (!holdWas && !holdActive) thCA = th; // re-engage from current attitude
      holdActive = true;
      const sl = (A.pitchCmdSlew ?? 99) * dt;
      thCA += clamp(thC - thCA, -sl, sl);
      Ith = clamp(Ith + (A.pitchI ?? 0.05) * (thCA - th) * dt, -0.15, 0.15);
      c.de = clamp((A.pitchP ?? 1.2) * (thCA - th) - (A.pitchD ?? 1.8) * q + Ith, -0.30, 0.35);
    };
    const airLateral = (bankLim = A.bankLim ?? 0.30) => {
      const phC = clamp((A.hdgP ?? 0.7) * e + (A.hdgD ?? 0.9) * eR, -bankLim, bankLim);
      phCA += clamp(phC - phCA, -(A.bankSlew ?? 0.18) * dt, (A.bankSlew ?? 0.18) * dt);
      c.da = clamp((A.rollP ?? 2.0) * (phCA - ph) - (A.rollD ?? 2.0) * p, -0.30, 0.30);
      c.dr = clamp(-(A.betaK ?? 0.3) * beta - (A.yawDampK ?? 0.6) * (eR - eRslow)
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

    switch (ap.phase) {
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
        if (cg[1] > ap.hCruise - 8) { ap.phase = 'CRUISE'; phaseT = 0; thrC = A.thrCruise; thcI = 0.04; }
        break;

      case 'CRUISE':
        speedThrottle(ap.VCruise);
        holdVS(clamp((A.altVSGain ?? 0.08) * (ap.hCruise - cg[1]), -2.2, 2.2));
        airLateral();
        if (cg[0] < ap.xTurn) {
          ap.phase = 'TURNBACK'; phaseT = 0;
          ap.trackHold = false; ap.targetDir = [1, 0, 0]; ap.dirX = 1;
        }
        break;

      case 'TURNBACK':
        speedThrottle(A.VTurn ?? ap.VCruise);
        holdVS(clamp((A.altVSGain ?? 0.08) * (ap.hCruise - cg[1]), -2.2, 2.2));
        airLateral();
        headingCapT = Math.abs(e) < 0.12 ? headingCapT + dt : 0;
        if (headingCapT > 1.5) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;

      case 'INBOUND': {
        speedThrottle(A.VTurn ?? 24);
        holdVS(clamp((A.altVSGain ?? 0.08) * (ap.hCruise - cg[1]), -2.2, 2.2));
        airLateral();
        const d = ap.xAim - cg[0];
        const hGS = ap.restAlt + d * ap.gs;
        if (d > 0 && hGS <= cg[1] + 2) { ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr; }
        break;
      }

      case 'APPROACH': {
        speedThrottle(ap.VAppr);
        const d = ap.xAim - cg[0];
        const hGS = ap.restAlt + Math.max(0, d) * ap.gs;
        holdVS(clamp(-V * ap.gs + 0.12 * (hGS - cg[1]), -3.0, 0.5));
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
        airLateral(0.10);
        if (onG > 0) {
          ap.phase = 'ROLLOUT'; phaseT = 0;
          ap.tdInfo = { sink: -vcg[1], z: cg[2], x: cg[0], V };
        }
        break;

      case 'ROLLOUT': {
        c.thr = 0;
        if (A.rolloutMode === 'trike') {
          if (V > (A.VDerotate ?? 20)) holdPitch(A.rolloutTh ?? 0.035);
          else c.de = 0.15;
        } else c.de = V > A.VTailUp ? -0.05 : 0.35;           // then stick hard back: pin the tail
        // progressive brakes only once the tail is pinned; release before stopping
        if (V < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (V - A.VBrakeRelease) / 2.0));
        groundSteer();
        if (V < A.VStop) { ap.phase = 'STOPPED'; phaseT = 0; }
        break;
      }

      case 'STOPPED':
        c.thr = 0; c.de = 0.35; c.brake = 0.25; c.da = 0; c.dr = 0;
        break;
    }
    // servo slew limits
    aDe += clamp(c.de - aDe, -A.slew * dt, A.slew * dt); c.de = aDe;
    aDa += clamp(c.da - aDa, -A.slew * dt, A.slew * dt); c.da = aDa;
    aDr += clamp(c.dr - aDr, -A.slew * dt, A.slew * dt); c.dr = aDr;
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: cg[2], agl };
  };
  return ap;
}

if (typeof module !== 'undefined')
  module.exports = { buildCub, buildDrone, buildDC3, buildJodel, buildC172, buildChinook, makeSim, makeAutopilot, makeWorld, POWERPLANTS, POLARS, PAR };
