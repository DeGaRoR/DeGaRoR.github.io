// ============================================================
function buildCub() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_CH = 2.0e5, C_CH = 60, K_GR = 4.07e4, C_GR = 1308, K_WG = 5.0e5, C_WG = 450;
  const B = (a, b, k = K_CH, c = C_CH) => beams.push({ a, b, k, c, gear: k === K_GR });
  const BG = (a, b) => B(a, b, K_GR, C_GR);

  // G158 — THE AIRFRAME WAS 23 % LIGHT, and it mattered far more than it looks.
  // This fiche billed 185.4 kg of structure which, with the 80 kg powerplant,
  // is a 265 kg empty J-3 against a real one's 345 kg (765 lb). That is not a
  // small error on its own; it became a load-bearing one because the A-65's
  // static thrust was then fitted so THIS aeroplane would reproduce the
  // published 433 fpm — a figure quoted at the 550 kg GROSS weight, not at the
  // 377 kg this fiche flew. Light airframe times weak propeller equalled the
  // book, and neither error was visible at the one point anybody checked.
  // Flown at 550 kg the same geometry climbed 0.78 m/s against a published
  // 2.29, and every garage-built aeroplane — which bills its mass honestly —
  // inherited the weak propeller with nothing left to cancel it.
  //
  // THE 80 kg GOES WHERE IT REALLY IS, and that is not "everywhere". A first
  // pass scaled every structural node by one factor, which preserves the
  // STRUCTURE's own centre of gravity — and moved the AEROPLANE's 136 mm aft,
  // because the three lumps that do not scale (engine, fuel, pilot) are all
  // forward of it. Measured, that was not a subtle drift: the mains came off
  // the ground, the legs went over-centre at 19.6 % strain and latched, and
  // the aeroplane settled on its tailwheel with the wheels 0.57 m in the air.
  // A mass correction that changes the balance is a second error, not a fix.
  //
  // So the missing weight is split into what it actually is, and the split is
  // SOLVED so the whole aeroplane's CG does not move at all (0.7987 m, before
  // and after):
  //   AF      1.16 on every modelled member — fabric, dope, and tube, spar and
  //           rib sections that were drawn too light. +29.7 kg.
  //   EQ_FW   22.8 kg at the firewall for what the fiche never modelled and a
  //           real Cub carries: engine mount, exhaust, oil and battery low
  //           (_B), upper cowl and instrument panel high (_T).
  //   EQ_CAB  27.5 kg in the cabin, same reason: seat pans, controls and floor
  //           low, glazing, doors and seat backs high.
  // 265 kg empty -> 345 kg; all-up in this fiche's own declared load state
  // (one pilot, full fuel) 377.4 -> 457.4 kg.
  //
  // AND THE SPLIT IS VERTICAL AS WELL AS FORE-AND-AFT, for a reason the first
  // pass missed: hanging all of it on the lower longerons held the balance in
  // x and dropped the CG 4.2 cm, which GATE MODEL caught at once — the PA-18's
  // 3D wheels are calibrated against the main-gear contact height measured
  // FROM THE CG, so a CG that moves down walks the aeroplane off its own
  // wheels. Both stations put their top and bottom nodes at the same x, so the
  // vertical share is free to solve for cgY without disturbing cgX at all.
  // Both are now exact: cgX 0.7987 m, cgY 0.4997 m, before and after.
  //
  // THE GEAR RATE MOVES WITH THE MASS (K_GR/C_GR above), and NOT by the mass
  // ratio, which was the first answer and was not enough. The binding
  // constraint on this leg is not comfort, it is the OVER-CENTRE LATCH: past
  // roughly 20 % member strain the leg goes through its own geometry and
  // springs the axle UP, and the aeroplane then stands on its tailwheel with
  // the mains half a metre in the air. Measured at 1.21x (the mass ratio) the
  // static stance was right and the LANDING was not — GATE XCTY4's arrival hit
  // 20.5 % and latched, and GATE XCTY3 never rolled at all because the spawn
  // settle latched it before it started.
  //
  // SO THE RATE IS SQUEEZED FROM BOTH SIDES and the window is narrow. Too soft
  // and the leg latches; too stiff and a stiffer spring hands its load to the
  // BRACE instead (the fiche's own G4.7 lesson) and bounces harder on arrival
  // — measured, 1.82x took GATE HOTHIGH's chassis strain to 10.3 % on an 8 %
  // bound and 2.0x failed its touchdown sink outright. 1.454x is what fits:
  // XCTY3 and XCTY4 upright, HOTHIGH's chassis inside its bound, PA-18 landing
  // at 1.40 m/s. c/k is held at the fiche's own 0.0321, so the damping ratio
  // is unchanged. Above about 2.2x the solver diverges outright.
  //
  // MEASURED AND REJECTED: starting the flare earlier to soften the arrival,
  // which 62_gen_aero's own rule (flareAgl = 3.2 * VAppr * gs) says it should,
  // since VAppr moved with the stall. It does soften it at HOME — the PA-18
  // touched at 1.17 m/s instead of 1.40 — and it makes the HOT-AND-HIGH strip
  // WORSE, 8.0 % chassis to 8.8 %, because up there the true airspeed behind
  // the same equivalent one is higher and the extra height buys float, not
  // cushion. The fiches are not density-adaptive, so flareAgl stays where it
  // was tuned and the gear rate carries the whole correction.
  //
  // THE CHECK IS EXTERNAL AND WAS NOT FITTED: this airframe at the published
  // 550 kg now climbs 465 fpm against a published 450, and tops out at
  // 144 km/h against a published 140 — two independent figures, one constant.
  // See GEN_RULES.propV0K and futureDesigns/PROP-THRUST-2026-09-02.md.
  const AF = 1.16;                             // per side, kg:
  const EQ_FW_B = 6.85, EQ_FW_T = 4.56;        // firewall, low / high
  const EQ_CAB_B = 7.83, EQ_CAB_T = 5.93;      // cabin,    low / high
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
    const [BL, BR] = NM(x, yb, w, mm * AF, `S${i}B`);
    const [TL, TR] = NM(x, yt, w, mm * AF, `S${i}T`);
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
  const TPB = N(5.12, 0.25, 0, 1.2 * AF, 'TPB'),
        TPT = N(5.12, 0.36, 0, 1.2 * AF, 'TPT');
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
  // engine mount, exhaust, oil, battery low; upper cowl and panel high —
  // never modelled, really there
  nodes[S0.BL].m += EQ_FW_B; nodes[S0.BR].m += EQ_FW_B;
  nodes[S0.TL].m += EQ_FW_T; nodes[S0.TR].m += EQ_FW_T;

  const [GAL, GAR] = NM(0.55, -0.80, 0.89, 6 * AF, 'AXLE', 0.20);
  BG(GAL, GAR);
  BG(GAL, S0.BL); BG(GAL, F[1].BL); BG(GAL, S0.BR);
  BG(GAR, S0.BR); BG(GAR, F[1].BR); BG(GAR, S0.BL);
  const TW = N(5.02, 0.02, 0, 3 * AF, 'TW', 0.10);
  BG(TW, TPB); BG(TW, S6.BL); BG(TW, S6.BR);
  // snap-blocking near-vertical member (structural rule 10, the drone cure):
  // without it the tailwheel folds UP about TPB and LATCHES (bare post on
  // the terrain) when parked in a tailwind — reset slam + breeze, W13.
  BG(TW, TPT);

  const MW = 8 * AF, wf = { L: null, R: null };
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

  const [HTL, HTR] = NM(4.92, 0.30, 1.05, 4 * AF, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S6.BL); B(HTL, S6.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S6.BR); B(HTR, S6.TR);
  // stab<->tailwheel pyramid (rule 10, the chinook cure): the fold that
  // survives the TW->TPT block is LATERAL (dTW body [+0.28 up, 0.25
  // sideways], measured) — wide anchors kill it
  BG(TW, HTL); BG(TW, HTR);
  const FIN = N(5.05, 0.95, 0, 4 * AF, 'FIN');
  B(FIN, TPT); B(FIN, S6.TL); B(FIN, S6.TR);

  // seat pans, controls and floor low; glazing, doors and seat backs high
  nodes[F[1].BL].m += EQ_CAB_B; nodes[F[1].BR].m += EQ_CAB_B;
  nodes[F[1].TL].m += EQ_CAB_T; nodes[F[1].TR].m += EQ_CAB_T;
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
    // THE TIP BOW (G159). The three bays above stop at the outermost SPAR
    // NODE, z = 5.0, and the drawn wing does not: the skin runs to z = 5.355,
    // so 35 cm a side of real wing was lifting on nothing. The fiche flew
    // 16.00 m2 while showing 16.58 — the published area — and the missing
    // 3.5 % sat on the stall, the induced drag and the roll damping at once.
    //
    // ONE STRIP PER SIDE, at t = 1, so its whole load acts at the tip node,
    // which is where a tip bow's lift acts and what makes its bending moment
    // right. 0.29 m2 is the bow's own planform: 0.355 m of span on a 1.6 m
    // chord at about half the area of the rectangle it sits in, which is what
    // a rounded tip is. NO AILERON on it — the Cub's aileron ends inboard of
    // the bow.
    //
    // eAR IS NOT TOUCHED, and that is the trap this change had to avoid.
    // POLARS.usa35b_AR7 has always declared pi * 0.75 * 6.95 — the REAL
    // aspect ratio, not the truss's 6.25 — so the induced drag was already
    // computed on the full span. Recomputing it from the new strip set would
    // have counted the same span twice.
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 1, 0.29, side, { ail: 0 });
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
    stabTrim: -0.0666, sparSpacing: 0.78,
    fusCdA: [0.55, 0.8, 0.8], fusCdAAft: [0, 0.5, 0.5],
    twSteer: 0.5,
    ap: {
    // G158 RE-ANCHORED, all of it. The airframe gained 80 kg (see AF above) and
    // the propeller gained 34 % of its thrust (GEN_RULES.propV0K), so every
    // speed here is stale in one direction and every THROTTLE in the other.
    // Method, per class:
    //   V-SPEEDS  scale with the stall, which moved 14.97 -> 16.47 m/s
    //             (x1.100). The ratios are the hand-tuned ones and are kept.
    //             VRot 15 was BELOW the new stall, which is not a rotation
    //             speed at all.
    //   VCruise   re-solved by 64_gen_build's own rule — the speed where drag
    //             is 65 % of the thrust available there. It comes out at
    //             33.9 m/s = 122 km/h against the real J-3's published 121, and
    //             the old 26 was low only because the propeller was weak.
    //   THROTTLES are fractions of a static thrust that moved 900 -> 1202 N,
    //             so they keep the THRUST they were tuned with, not the lever
    //             position (the reading G4.9 already ruled on): x 0.749.
    //   TORun     re-integrated, not adjusted: 172 m to 2.5 m agl (111 m of
    //             roll), against a published ~113 m ground roll at gross.
    //   stabTrim  re-solved by tunnel pitch balance at the new VCruise.
      // G159 re-anchored: the tip bow took Sw 16.00 -> 16.58 m2 (the published
      // wing area) and the stall 16.35 -> 16.12 m/s with it, so every
      // stall-referenced speed here moved by 0.986. VCruise, stabTrim,
      // thrCruise and TORun are re-measured, not scaled. VPinFull is NOT
      // scaled: it was found against a latch cliff in M3 and GATE WIND, not
      // derived from the stall, so it stays where measurement put it.
      VRot: 16.3, VClimbMin: 21.7, VClimb: 22.8, VCruise: 33.5, VAppr: 23.4,
      VApprShort: 20.4,             // fly-in strips < 450 m (1.25*Vs, doctrine floor)
      // NO VTurn ON PURPOSE. TURNBACK and INBOUND both read A.VTurn but with
      // DIFFERENT fallbacks — VCruise and a literal 24 — so this aeroplane
      // flies its turnback at 26 and its inbound at 24, and a single VTurn
      // key cannot express that. Writing `VTurn: 24` here to "make the
      // default explicit" silently moved TURNBACK 26 -> 24 and was measured
      // to shift the M3 stop 1 m and the drone's elevator chatter from
      // 0.3 to 5.5 deg/s. Generated fiches always set VTurn, so the literal
      // below is reached only by this family, which is what it was tuned on.
      // RE-ANCHORED G4.9 (was 60): the engine-count fix halved this aeroplane's
      // thrust, and the run to 2.5 m agl went 67 m -> 151 m. Re-read off
      // tools/make_perf.js, not adjusted by hand.
      TORun: 132,                   // measured run to 2.5 m agl
      // W16 lateral quiet: same 4 Hz aileron limit cycle as the pa18
      // (shared geometry) — default rollD 2.0 on the lagged rate estimate;
      // 0.8 kills it (see pa18 fiche note).
      rollD: 0.8,
      // G158: THE W13.2 HOP GUARD, which this fiche never needed and now does.
      // Left alone, `VTailDown` falls back to VTailUp, so the J-3 held the
      // tail UP (de -0.05) all the way down to 13.2 m/s and then pinned FULL
      // aft — and W13.2 already recorded that the full pin at touch speed is
      // itself a re-launch impulse. The J-3 used to be light enough and slow
      // enough to absorb it; 80 kg of real airframe raised its stall
      // 14.97 -> 16.35 m/s and its rollout with it, and GATE WIND watched it
      // rear to 23 deg nose-up, scrub 11 m downwind and put 11.9 % into the
      // chassis on an 8 % bound.
      //
      // IT IS THE ROLLOUT, NOT THE ARRIVAL, and the measurement is what says
      // so: a faster flare took the touchdown from 1.62 to 1.15 m/s and the
      // nose dug in HARDER (rollout pitch -11.6 -> -23.2 deg), while a
      // stiffer leg made it worse again (-43 deg). With the guard the arrival
      // is unchanged and the rollout is a different event: 4.7 % chassis,
      // +3.2 deg pitch, and it stops on the centreline instead of 11 m
      // downwind.
      //
      // 20.0 IS MEASURED AND THE CURVE IS NOT MONOTONIC, so it is not the
      // PA-18's 17.6 even though the wing is. This aeroplane has no flaps and
      // touches at 23.4 m/s, so full aft has to wait much longer: pinned at
      // 17.0 it balloons and comes down on a latched leg (M3 finished nose
      // 5.6 deg DOWN, sitting 0.9 m low on 23.5 % gear strain), 17.6 and 18.5
      // clear the latch but still dip the nose below the horizon (-2.7 and
      // -1.5 deg against M3's noseover bound of +1), and 20.0 holds +5.9 deg
      // with the gear back down to 7.8 %. 22.0 also passes and is worse
      // (13.0 %). Read off M3 and GATE WIND together — either alone picks a
      // different number.
      //
      // MEASURED AND REJECTED alongside it: 62_gen_aero's flareRate rule
      // (0.102 for this fiche now). It genuinely softens the touchdown, and
      // with the guard in place it still leaves 8.1 % in the chassis against
      // 4.7 % for the hand-tuned 0.062. The PA-18 takes its rule value; this
      // one does not.
      VTailDown: 99, VPinFull: 20.0,
      hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
      rollDe: 0.12,
      // G159: DERIVED, not fitted. The attitude that flies at 1.10 Vs is fixed
      // by the polar alone — CL = CLmax/1.21 gives 11.92 deg on this wing —
      // and this aeroplane's three-point deck is 11.75, so the deck binds and
      // the tailwheel is on the ground at the moment it leaves, which is how a
      // Cub takes off. It was 0.16 (9.2 deg), a fitted ratio that unstuck the
      // aeroplane at 1.31 x Vs and made the roll half as long again as the
      // book's. See genTuneAP in 62_gen_aero.js for the rule this now matches.
      liftoffTh: 0.205, climbThBase: 0.12, climbThGain: 0.030,
      thMax: 0.20, flareAgl: 4.8, flareRate: 0.062, aglGuard: 3,
      VTailUp: 13.0, VStop: 0.4, slew: 1.5, thrCruise: 0.649, thrAppr: 0.26,
      brakeMax: 0.30, brakeRampRate: 0.12, VBrakeOn: 9.8, VBrakeRelease: 1.5,
    },
  };
  return { nodes, beams, strips, refs, params };
}



