// ============================================================
// THE MACHINE SHEET (P0.4 of PILOT-ROADMAP-2026-09-14.md) — the one place
// the pilot reads the aeroplane from.
//
// PILOT-ROADMAP §6.3 rule 5: "the machine is a sheet of measured numbers,
// and the sheet is the only source." Before this the pilot knew the
// aeroplane through genAP's constants (ratios of the analytic stall) and
// genTuneAP's fits; the bench measured the same aeroplane — the stall in
// both configurations, the climb gradient, the glide ratio and its speed,
// the take-off run, the ground power cap — and the pilot never read it.
//
// WHAT IT IS. One flat record, SI, built from what exists: `def.params.gen`
// (the tunnel's measured block), `def.params.ap` (the speed ladder genAP
// derived, kept as the fallback), and `genShakedown`'s output when the
// caller has one (the garage memoises it; a gate passes it; the pilot asks
// for it lazily and does without — the fields that need it read null).
// Every field says where it came from (`src`): 'measured' (the tunnel or
// the shakedown), 'derived' (a textbook ratio over a measured number, named
// in the comment), 'genAP' (the old constant, until a measurement replaces
// it). Nothing here is tuned; a number the bench cannot measure yet is null
// and the consumer falls back, never a guess dressed as a fact.
//
// THE V-SPEEDS AND THE RATIOS (light-aeroplane practice, the same for a Cub
// and a flying boat):
//   Vs      clean stall (VsMeas when the tunnel measured it, else analytic)
//   Vs0     stall in the landing configuration (VsFlap; = Vs when flapless)
//   Vref    1.30 Vs0 — the approach reference speed
//   Vrot    genAP's VRot (0.99 Vs, G159: the derived rotation)
//   Vy      genAP's VClimb (1.38 Vs), where gammaClimb was measured
//   Vx      0.87 Vy — derived; the best-angle speed is not measured yet
//   Vbg     the best-glide speed, measured (the shakedown's L/D sweep)
//   Vms     0.76 Vbg — the minimum-sink speed (3^-1/4, a parabolic polar)
//   Vcruise genAP's VCruise (1.71 Vs)
//   Vne     null — not measured; a consumer that needs a ceiling uses 1.5 Vcruise and says so
// THE ENERGY LIMITS (what TECS reads, P0.5):
//   climbMax  gammaClimb x Vy (m/s) — measured at full thrust
//   sinkMin   0.877 x Vbg / LDbest (m/s) — the minimum sink at idle, derived
//             from the measured glide (3^(3/4)/2 on a parabolic polar)
//   sinkBg    Vbg / LDbest — the sink at best glide
//   sinkAt(V) the whole polar through those two points (CLIMATE K3), so a
//             variometer can say what the AIR is doing: netto = vs + sinkAt(V)
//   gammaClimb, LDbest — measured
// THE RUNS: TORun (measured, the sheet's), LDGrun (derived: the stop from
// 1.15 Vs0 at the grass datum's braking, the accelerate-stop's own law).
// THE ATTITUDES (rad, measured): alphaAppr, alphaTD (1.10 Vs0), alphaCruise,
// aStall, thMax / flareThMax / liftoffTh (genTuneAP's, from the measured
// attitudes). THE THROTTLE: thrCruise (measured), thrAppr (genAP), groundCap
// (measured: the power nose-over cap). THE EFFECTORS: what this machine
// has — engines, flaps (and their landing setting), the gear type, floats.
// ============================================================
function machineSheet(def, opts) {
  opts = opts || {};
  const A = def.params.ap || {}, G = def.params.gen || {}, P = def.params;
  const sh = typeof opts.shakedown === 'function' ? opts.shakedown() : (opts.shakedown || null);
  const src = {};
  const put = (k, v, s) => { src[k] = v == null ? null : s; return v == null ? null : v; };
  const r2 = v => v == null ? null : Math.round(v * 100) / 100;
  const Vs = put('Vs', G.VsMeas ?? G.Vs ?? (A.VRot ? A.VRot / 0.99 : null), G.VsMeas != null ? 'measured' : G.Vs != null ? 'measured' : 'genAP');
  const flapsLdg = !!(P.flaps && (P.flaps.ldg ?? 1) > 0) && !G.landsFlapless;
  const Vs0 = put('Vs0', flapsLdg && G.VsFlap != null ? G.VsFlap : Vs, flapsLdg && G.VsFlap != null ? 'measured' : src.Vs);
  const Vy = put('Vy', A.VClimb ?? null, 'genAP');
  const Vbg = put('Vbg', sh && sh.VbestLD != null ? sh.VbestLD : null, 'measured');
  const LDbest = put('LDbest', sh && sh.LDbest != null ? sh.LDbest : null, 'measured');
  const gammaClimb = put('gammaClimb', G.gammaClimb ?? null, 'measured');
  const trike = P.ap && P.ap.rolloutMode === 'trike' || (P.twSteer || 0.5) < 0;
  // the stop from 1.15 Vs0: the pilot's accelerate-stop law (43_pilot.js aStop)
  const aStop = A.aStop || 9.81 * ((typeof CRR === 'number' ? CRR : 0.05) + (A.brakeMax || 0.3) * (typeof MU_BRAKE === 'number' ? MU_BRAKE : 0.5)) * 0.8;
  const Vtd = Vs0 != null ? 1.15 * Vs0 : null;
  const S = {
    Vs, Vs0, Vref: put('Vref', Vs0 != null ? 1.30 * Vs0 : null, 'derived'),
    Vrot: put('Vrot', A.VRot ?? null, 'genAP'), Vy, Vx: put('Vx', Vy != null ? 0.87 * Vy : null, 'derived'),
    Vbg, Vms: put('Vms', Vbg != null ? 0.76 * Vbg : null, 'derived'),
    Vcruise: put('Vcruise', A.VCruise ?? null, 'genAP'), Vne: put('Vne', null, 'derived'),
    climbMax: put('climbMax', gammaClimb != null && Vy != null ? gammaClimb * Vy : null, 'measured'),
    sinkBg: put('sinkBg', Vbg != null && LDbest ? Vbg / LDbest : null, 'measured'),
    sinkMin: put('sinkMin', Vbg != null && LDbest ? 0.877 * Vbg / LDbest : null, 'derived'),
    gammaClimb, LDbest,
    TORun: put('TORun', A.TORun ?? (sh && sh.TORun) ?? null, 'measured'),
    LDGrun: put('LDGrun', Vtd != null ? Vtd * Vtd / (2 * aStop) + Vtd * 1.0 : null, 'derived'),
    alphaAppr: put('alphaAppr', G.alphaAppr ?? null, 'measured'),
    alphaTD: put('alphaTD', G.alphaTD ?? null, 'measured'),
    alphaCruise: put('alphaCruise', G.alphaCruise ?? null, 'measured'),
    aStall: put('aStall', G.aStall ?? null, 'measured'),
    thMax: put('thMax', A.thMax ?? null, 'genAP'), flareThMax: put('flareThMax', A.flareThMax ?? null, 'genAP'),
    liftoffTh: put('liftoffTh', A.liftoffTh ?? null, 'genAP'),
    thrCruise: put('thrCruise', A.thrCruise ?? null, 'measured'), thrAppr: put('thrAppr', A.thrAppr ?? null, 'genAP'),
    groundCap: put('groundCap', sh && sh.groundThrCap != null ? sh.groundThrCap : null, 'measured'),
    mass: put('mass', G.W != null ? G.W / 9.81 : (sh && sh.mass) || null, 'measured'),
    W: put('W', G.W ?? (sh && sh.W) ?? null, 'measured'),
    wingLoad: put('wingLoad', sh && sh.wingLoad != null ? sh.wingLoad : null, 'measured'),
    staticMargin: put('staticMargin', sh && sh.staticMargin != null ? sh.staticMargin : null, 'measured'),
    xwindLimit: put('xwindLimit', opts.xwind != null ? opts.xwind : null, 'measured'),
    elevIdle: put('elevIdle', null, 'measured'),            // elevator authority at idle: not measured yet (the C172 / Caravan finding)
    effectors: {
      engines: P.nEngines || 1,
      flaps: !!P.flaps, flapLdg: P.flaps ? (P.flaps.ldg ?? 1) : 0, flapTO: P.flaps ? (P.flaps.to ?? 0) : 0,
      gear: trike ? 'trike' : 'taildragger',
      floats: !!(def.hydro || (def.parts && def.parts.floats)),
      spoilers: false,
    },
    src,
    shakedown: !!sh,
  };
  // ---- THE POLAR, AS A CURVE (CLIMATE K3) -----------------------------------
  // The sheet knows two points of the glide polar - minimum sink at Vms and the
  // sink at best glide at Vbg - and a variometer needs the whole curve: to say
  // what the AIR is doing it must subtract what the AEROPLANE would be doing at
  // the speed it is flying.
  //
  //   sink(V) = a V^3 + b / V
  //
  // is the parabolic-polar sink rate (induced drag goes as 1/V, profile as V^3
  // in the sink), and two measured points fix a and b exactly. It is the same
  // curve Vms = 0.76 Vbg and sinkMin = 0.877 sinkBg were derived from, so this
  // adds no new assumption - it just stops throwing the curve away.
  //
  // NETTO, which is what a soaring pilot reads: vs + sink(V). The glider's own
  // sink is added back, so still air reads zero and what is left is the air.
  S.sinkAt = (() => {
    if (!(Vbg > 0) || !(S.sinkBg > 0) || !(S.Vms > 0) || !(S.sinkMin > 0)) return null;
    // solve [Vbg^3, 1/Vbg; Vms^3, 1/Vms] [a; b] = [sinkBg; sinkMin]
    const A1 = Vbg * Vbg * Vbg, B1 = 1 / Vbg, A2 = S.Vms * S.Vms * S.Vms, B2 = 1 / S.Vms;
    const det = A1 * B2 - A2 * B1;
    if (!(Math.abs(det) > 1e-12)) return null;
    const a = (S.sinkBg * B2 - S.sinkMin * B1) / det;
    const b = (A1 * S.sinkMin - A2 * S.sinkBg) / det;
    return V => {
      const v = Math.max(0.5 * S.Vms, Math.min(3 * Vbg, V || Vbg));   // the curve is only good where it was fitted
      return Math.max(0, a * v * v * v + b / v);
    };
  })();
  // the same numbers, rounded, for a plaque or a status line
  S.show = () => {
    const o = {};
    for (const k of ['Vs', 'Vs0', 'Vref', 'Vrot', 'Vx', 'Vy', 'Vbg', 'Vms', 'Vcruise', 'climbMax', 'sinkMin', 'LDbest', 'TORun', 'LDGrun', 'mass'])
      o[k] = r2(S[k]);
    return o;
  };
  return S;
}
