// ============================================================
// THE SERVOS (G1570, the independent review E4 / B3 / B4) — ONE inner-loop
// module under all three pilots.
//
// 40_autopilot (the classic), 41_test_pilot (forked from it, G107) and
// 43_pilot (the test pilot's loops under a decision layer, G202) each carried
// their own copy of the same ~600 lines: the attitude and rate filters, the
// pitch / roll / yaw / speed / vertical-speed servos, the ground steer, the
// taxi governor, the crosswind decrab and the servo slew. The fixes landed in
// 43 only — G381 (the decrab's sign, the tail-down steer gains easing with
// speed, the speed hold's damping, the filters starting from the attitude),
// G630 (wrapped rates, a target that steps is not a rate, the ground's
// aileron deadband, the taxi on P + curvature with no rate term, the trike's
// rate term a quarter and none under the brakes) and G352 (the speed hold's
// integrator held at its stop) — so the classic pilot every structural gate
// flies, and the test pilot the bench flies, still had the pre-fix laws: the
// decrab rudder of 40/41 kicked the crab off the wrong way (B3).
//
// Now there is one copy. Each pilot keeps its own phase machine and calls
// these laws; the fixes live here once. Where 43 flies a law the other two
// never had and that is NOT one of those fixes, a FEATURE flag keeps it 43's
// (`makeServos(.., { features })`): the course trim in calm air (2026-09-08),
// the P1.D ground steer (the tail state from the tailwheel's contact, the
// tail-down rudder stop rising with speed, the gains scaled by the mass), the
// aileron into the wind on the ground (2026-09-08), the water branch (H4) and
// the water's elevator top (G396.2). 40 and 41 run with them off.
// G1940 (PILOT-ONE): 40 and 41 RETIRED - 43 is the one pilot and flies every
// feature on; the flags stay as the seams a personality (G1943) or a gate
// may switch, and the history above is why the module exists.
//
// THE GAINS ARE ONE TABLE (SERVO_GAINS). A per-aeroplane key in
// def.params.ap (genTuneAP writes rollP, pitchD, ...) wins over the table, as
// the `A.x ?? default` reads always did; everything that was a bare literal in
// the three copies (the rate filter's 0.85, the 2 s washouts, the ground's
// deadbands, the clamps) is a row too, so a solver change that moves the
// aeroplane's own damping (review D1: the deformation damper on rigid
// rotation) re-tunes here, in one place, for all three pilots.
//
// Conventions (as in 40): de > 0 nose-up, da > 0 roll right, dr > 0 nose
// left, e > 0 = the target left of the nose.
// ============================================================
const SERVO_GAINS = {
  // sensing
  attFilt: 1.0,          // attitude low-pass (1 = none)
  rateFilt: 0.12,        // the pitch / roll rate filter, per step
  eRateK: 0.85,          // the heading-error rate filter = rateFilt x this
  washS: 2.0,            // the yaw damper's washout and vsSlow, s
  accS: 2.0,             // the airspeed-rate filter (accF), s
  pGroundS: 0.3,         // G630: the slow roll rate the ground reads, s
  tgtJump: 0.05,         // G630: a target step past this (rad) is not a rate...
  tgtTurnRate: 1.0,      // G780: ...unless an aeroplane could have turned it (rad/s)
  tgtTurnWin: 0.5,       //        over at most this long since it last moved (s)
  // pitch
  pitchCmdSlew: 99, pitchP: 1.2, pitchD: 1.8, pitchI: 0.05,
  IthMax0: 0.15,         // the pitch integrator's cap in the air
  IthMaxRate: 0.10,      // the cap moves to its target at this rate (/s)
  deMin: -0.30, deMax: 0.35, deWater: 0.70,
  // roll / yaw in the air
  hdgP: 0.7, hdgD: 0.9, bankLim: 0.30, bankSlew: 0.18,
  rollP: 2.0, rollD: 2.0, daMax: 0.30,
  betaK: 0.3, yawDampK: 0.6, ariK: 0.35, drAirMax: 0.25,
  trimK: 0.15, trimMax: 0.10, trimWin: 0.2, trimBleed: 0.8,
  windArm: 0.5,          // |wind| that arms the classic's in-wind course trim
  // speed (throttle)
  spdP: 0.05, spdI: 0.010, spdIMax: 0.30, spdD: 0.25, thrFloor: 0.12,
  // vertical speed (pitch command)
  vsFilt: 1.0, vsFloor: -0.08, vsI: 0.015, vsP: 0.010,
  // ground steer
  steerP: 3.2, steerD: 1.2,
  steerTailUpK: 1.4, steerTailUpD: 3.0, steerTailUpMin: 0.6, steerTailUpMax: 2.0,
  VTailUp: 12, VSteer: 12, steerMin: 0.30, steerBW: 3.5, trikeSteerD: 0.25,
  steerMassRef: 500, steerMassMin: 200,
  drTailDown: 0.45, drTailUp: 0.95, drWater: 0.9,
  // G1937 (PILOT-ONE, for DMG-DAMP): the water-step entry - kP x waterStepK on the water with the hull on the step
  // (tail up); 1 today (no change), DAMP's only pilot gain (0.6 once the solver's rigid-rotation damper is gone)
  waterStepK: 1,
  gAilP: 2.0, gAilD: 1.0, gBankDb: 0.010, gRateDb: 0.02, gAilTaxi: 0.25, gAilRoll: 0.30,
  xwBank: 0.06, xwBankGround: 0.035,
  // taxi
  taxiDe: 0.30, taxiThrMax: 0.85, taxiP: 0.18, taxiIK: 0.10, taxiForgetS: 2,
  taxiBrakeDb: 0.8, taxiBrakeK: 0.3, taxiBrakeMax: 0.6, taxiHdgTau: 0.4, taxiHdgForgetS: 0.5,
  // the crosswind decrab
  decrabAgl: 3.5, decrabK: 2.2, decrabD: 0.6, decrabI: 1.0, decrabIMax: 0.2, decrabMax: 0.35,
  decrabBank: 0.12, xwArm: 0.5,
  // G1937: THE STEP-ATTITUDE HOLD (servoStepHold): de = stepDe0 + stepK (stepTrim - trim) - stepD trim-rate, trim in
  // deg, from stepV (m/s) on the step - DAMP's GATE FLOATS script law, owned here as a technique the gates call
  stepDe0: 0.2, stepK: 0.04, stepD: 0.01, stepTrim: 6, stepV: 9,
};

// ONE TABLE PER PILOT (A0, 2026-10-04: the Deform Coordinator's DMG-DAMP fixes the
// solver's rigid-rotation damping, review D1, and re-tunes after this lands): a
// pilot's gains are SERVO_GAINS overlaid with its own row here. Every row is
// EMPTY today — G1570 unified the laws and fixed B3-B7 without re-tuning a gain;
// a re-tune writes the keys it moves into the pilot's row, and a per-aeroplane
// key in def.params.ap still wins. G1940: the classic (40) and test (41) rows
// retired with their pilots - every gate flies 43 and its row.
const SERVO_TUNE = {
  pilot: {},       // 43_pilot.js — THE pilot: every flying gate (GEN, FLEX, STRESS, FLAPS, GE, HOTHIGH, PILOT, TAKEOFF, ...)
};

function servoWrapPi(a) { return a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); }

// the crosswind component in a runway frame F {ux, uz} (the axis either way):
// the air's velocity across the strip, + toward the frame's left. B4: the
// decrab arms on THIS, not on the world's z (only an x-aligned strip saw it)
function servoCrossWind(out, F) {
  return -((out && out.windX) || 0) * F.uz + ((out && out.windZ) || 0) * F.ux;
}

// makeServos(sim, def, opts) — opts:
//   pilot        'classic' | 'test' | 'pilot': the SERVO_TUNE row overlaid on SERVO_GAINS
//   now()        the pilot's clock (ap.t; a pilot may move it mid-update)
//   trike        the nosewheel steers (the G630 trike schedule)
//   rotateTD     a taildragger that lifts its tail (the tail-up steer arms)
//   TW           { Lwb, steer } the follower's geometry (the trike's bandwidth cap)
//   features     { trimCalm, groundP1D, xwBank, water, deTop } — 43's own laws
function makeServos(sim, def, opts) {
  opts = opts || {};
  const A = (def && def.params && def.params.ap) || {};
  const G = Object.assign({}, SERVO_GAINS, SERVO_TUNE[opts.pilot] || {});
  const g = n => (A[n] ?? G[n]);
  const FT = opts.features || {};
  const now = opts.now || (() => S.t);
  const trike = !!opts.trike, rotateTD = !!opts.rotateTD;
  const TW = opts.TW || { Lwb: 4.0, steer: 0.5 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const db = (x, w) => x - clamp(x, -w, w);
  const c = sim.ctl;

  const S = {
    t: 0, dt: 1 / 60,
    // the readings of the last sense()
    th: 0, ph: 0, q: 0, p: 0, pG: 0, e: 0, eA: 0, eR: 0, eRslow: 0, eAR: 0, eARslow: 0,
    beta: 0, V: 0, Vg: 0, vy: 0, onG: 0, accF: 0, vsSlow: 0, out: null,
    // the servos' memory a phase may set
    thCA: 0, phCA: 0, vsF: 0, thcI: 0.06, Ith: 0, It: 0, thrC: 0.6,
    IthMax: G.IthMax0, IthMaxT: G.IthMax0, IthGain: null, pitchK: 1, pitchDK: 1, deFloor: 0,
    eTrim: 0, aDe: 0, aDa: 0, aDr: 0, tailUp: false,
    dcI: 0, dcT: -1, taxiI: 0, taxiLastT: -1e9, taxiHdgF: null, taxiHdgT: -1e9,
  };
  let init = false, thF = 0, phF = 0, thP = 0, phP = 0, eP = 0, eAP = 0;
  let tgtHP = null, tgtMovedT = -1e9, vPrev = null, pend = false;
  let holdActive = false, holdWas = false;

  // W14: every integrator, filter and servo memory re-latches from the live
  // state on the next sense() (a re-engage after manual flight)
  S.relatch = () => { pend = true; };

  // one step of sensing. e: the target's angle from the nose (+ left);
  // eA: from the ground track; tgtH: the target heading (atan2) for the
  // bumpless check; the raw attitudes; beta; V (EAS), Vg; vy; onG
  S.sense = (dt, e, eA, tgtH, thRaw, phRaw, beta, V, Vg, vy, onG) => {
    S.dt = dt; S.t += dt;
    const t = now();
    S.out = sim.out;
    // G381: THE FILTERS START FROM THE ATTITUDE, not from zero — ROLL read its
    // rest attitude (thRest) off the first filtered frame at attFilt x the
    // truth (a cub's 9.2 deg three-point carried as 6.5 for the flight)
    if (!init) { init = true; thF = thP = thRaw; phF = phP = phRaw; }
    // G630: A TARGET THAT JUMPS IS NOT A RATE — a step past tgtJump is carried
    // into the rate filters' memory (bumpless); G780: unless an aeroplane
    // could have turned it since the target last moved (a sampled turn)
    if (tgtH != null) {
      if (tgtHP != null) {
        const dT = servoWrapPi(tgtH - tgtHP);
        if (Math.abs(dT) > Math.max(G.tgtJump, G.tgtTurnRate * Math.min(G.tgtTurnWin, t - tgtMovedT))) { eP = servoWrapPi(eP + dT); eAP = servoWrapPi(eAP + dT); }
        if (dT !== 0) tgtMovedT = t;
      } else tgtMovedT = t;
      tgtHP = tgtH;
    }
    if (pend) {
      pend = false;
      thF = thRaw; phF = phRaw; thP = thRaw; phP = phRaw; S.q = S.p = 0;
      eP = e; S.eR = S.eRslow = 0; eAP = eA; S.eAR = S.eARslow = 0; S.pG = 0;
      S.vsF = vy; S.thCA = thRaw; S.phCA = 0;
      S.aDe = c.de; S.aDa = c.da; S.aDr = c.dr;
      S.Ith = 0; S.It = 0; S.thcI = 0.06; S.thrC = A.thrCruise ?? 0.6;
      S.IthMax = S.IthMaxT = G.IthMax0; S.IthGain = null;
      S.eTrim = 0; holdWas = holdActive = false;
    }
    const AF = g('attFilt');
    thF += AF * (thRaw - thF); phF += AF * (phRaw - phF);
    const th = thF, ph = phF;
    const RF = g('rateFilt');
    S.q += RF * ((th - thP) / dt - S.q); thP = th;
    S.p += RF * ((ph - phP) / dt - S.p); phP = ph;
    // G630: an angle's rate is the rate of a WRAPPED difference
    S.eR += RF * G.eRateK * (servoWrapPi(e - eP) / dt - S.eR); eP = e;
    S.eRslow += dt / G.washS * (S.eR - S.eRslow);
    S.eAR += RF * G.eRateK * (servoWrapPi(eA - eAP) / dt - S.eAR); eAP = eA;
    S.eARslow += dt / G.washS * (S.eAR - S.eARslow);
    S.pG += dt / G.pGroundS * (S.p - S.pG);
    S.vsSlow += dt / G.washS * (vy - S.vsSlow);
    if (vPrev !== null) S.accF += dt / G.accS * ((V - vPrev) / dt - S.accF);
    vPrev = V;
    S.th = th; S.ph = ph; S.e = e; S.eA = eA; S.beta = beta; S.V = V; S.Vg = Vg; S.vy = vy; S.onG = onG;
    S.deFloor = 0;
  };

  // ---- pitch ----------------------------------------------------------------
  S.holdPitch = (thC) => {
    const dt = S.dt, th = S.th;
    if (!holdWas) S.thCA = th;                // (re-)engage from the current attitude
    holdActive = true;
    const sl = g('pitchCmdSlew') * dt;
    S.thCA += clamp(thC - S.thCA, -sl, sl);
    S.IthMax += clamp(S.IthMaxT - S.IthMax, -G.IthMaxRate * dt, G.IthMaxRate * dt);
    S.Ith = clamp(S.Ith + (S.IthGain ?? g('pitchI')) * (S.thCA - th) * dt, -S.IthMax, S.IthMax);
    // G396.2 / G970 (43): on the water the stick comes all the way back
    // G396.2: ON THE STEP THE STICK COMES ALL THE WAY BACK. The 0.35 stop
    // is a wheel's rotation (the ground never pins the tail); a planing
    // float rides nose-low against the thrust line and the servo sat on
    // its stop from 20 m/s to a 145 km/h lift-off (Vs 66) — a seaplane
    // pilot holds full back stick until the hull lets go, then eases.
    // Measured on the card: 0.7 lifts at 102 km/h, the fixture at 86.
    // G970: ...AND UNTIL CLIMB. The float ULM's thrust line sits 0.55 m over
    // its CG; the moment the floats let go the top fell back to 0.35 and at
    // full power the nose went to -15 deg with the stick on it, into the
    // water again (a second skip). G396.2's own reading: this lift-off asks
    // ~0.5 of stick. The water's top holds through LIFTOFF
    const deTop = FT.deTop ? FT.deTop(S.onG) : G.deMax;
    c.de = clamp(g('pitchP') * S.pitchK * (S.thCA - th) - g('pitchD') * S.pitchDK * S.q + S.Ith, G.deMin, deTop);
    if (S.deFloor > 0 && S.deFloor > c.de) c.de = S.deFloor;
  };
  S.holdVS = (VSc, thMax = 0.16) => {
    S.vsF += g('vsFilt') * (S.vy - S.vsF);
    const fl = g('vsFloor');
    S.thcI = clamp(S.thcI + g('vsI') * (VSc - S.vsF) * S.dt, fl, thMax);
    S.holdPitch(clamp(S.thcI + g('vsP') * (VSc - S.vsF), fl, thMax));
  };

  // ---- roll / yaw -------------------------------------------------------------
  // the roll servo alone: a bank command in, the aileron and the yaw damper out
  S.rollTo = (phC) => {
    const bs = g('bankSlew') * S.dt;
    S.phCA += clamp(phC - S.phCA, -bs, bs);
    c.da = clamp(g('rollP') * (S.phCA - S.ph) - g('rollD') * S.p, -G.daMax, G.daMax);
    c.dr = clamp(-g('betaK') * S.beta - g('yawDampK') * (S.eAR - S.eARslow)
                 - g('ariK') * c.da, -G.drAirMax, G.drAirMax);
  };
  // course over ground: the standing course trim (a slipping aeroplane needs a
  // standing bank), integrated only while the error is small. The classic
  // arms it in wind; 43 (trimCalm, 2026-09-08: propwash swirl needs it too)
  // always
  // (43, verbatim:)
  // THE COURSE TRIM IS NOT ABOUT THE WIND (2026-09-08). It was gated on
  // there BEING a wind, so in calm air a steady course error could not
  // be trimmed out at all — and a steady course error does not need a
  // wind: PROPWASH SWIRL yaws the aeroplane all the way down the
  // approach, the beta damper below only damps it, and the aeroplane
  // flies a heading that closes the centreline while TRACKING parallel
  // to it. Measured on the V-tail card's own approach: 17 m off,
  // holding, 1 deg of bank, two go-arounds and a give-up — in dead calm.
  // The integrator is the same one, with the same bounds and the same
  // wash-out through a turn; it simply runs whenever the error is small
  // and steady, which is when a pilot would be holding a boot of rudder.
  // An aeroplane that already tracks true keeps eTrim at 0 and is
  // unchanged, wind or no wind.
  S.airLateral = (bl) => {
    if (bl == null) bl = g('bankLim');
    const eA = S.eA, dt = S.dt, o = S.out || {};
    if (FT.trimCalm || Math.abs(o.windX || 0) + Math.abs(o.windZ || 0) > G.windArm) {
      if (Math.abs(eA) < G.trimWin) S.eTrim = clamp(S.eTrim + G.trimK * eA * dt, -G.trimMax, G.trimMax);
      else S.eTrim -= G.trimBleed * S.eTrim * dt;
    }
    const phC = clamp(g('hdgP') * eA + g('hdgD') * S.eAR + S.eTrim, -bl, bl);
    S.rollTo(phC);
  };
  // the crosswind decrab: wings near level (the bank keeps killing the drift),
  // the rudder flies the nose onto the runway. B3 / G381: on -K x e, the
  // ground steer's own sign (e = the runway's angle from the nose); the
  // classic and the test pilot carried -K x (the nose's angle from the
  // runway), the opposite sign. G970: with a slow integral (P alone left a
  // standing crab), reset whenever the decrab was not flown a step ago
  S.decrab = (bl) => {
    S.airLateral(bl ?? G.decrabBank);
    const t = now(), e = S.e;
    if (t - S.dcT > 0.1) S.dcI = 0;
    S.dcT = t;
    S.dcI = clamp(S.dcI + g('decrabI') * e * S.dt, -G.decrabIMax, G.decrabIMax);
    c.dr = clamp(-g('decrabK') * e - G.decrabD * S.eR - S.dcI, -G.decrabMax, G.decrabMax);
  };
  // B4: armed on the STRIP-FRAME cross component
  S.crossWind = (F) => servoCrossWind(S.out || sim.out, F);
  S.decrabArmed = (agl, F) => agl < g('decrabAgl') && Math.abs(S.crossWind(F)) > G.xwArm;

  // ---- throttle -----------------------------------------------------------------
  S.speedThrottle = (Vtgt) => {
    const V = S.V;
    S.It = clamp(S.It + G.spdI * (Vtgt - V) * S.dt, -G.spdIMax, G.spdIMax);
    // G381: a term on the measured acceleration damps the approach's speed hunt
    const base = S.thrC + G.spdP * (Vtgt - V) - g('spdD') * S.accF, lo = g('thrFloor');
    // G352: anti-windup — on a stop, the integrator holds the stop's value
    if (base + S.It < lo) S.It = lo - base;
    else if (base + S.It > 1) S.It = 1 - base;
    c.thr = clamp(base + S.It, lo, 1);
  };

  // ---- the ground -----------------------------------------------------------------
  // the steer gains [kP, kD]. G381: the tail-down gains ease as (VTailUp/V)^2
  // like the tail-up ones (a trike: (VSteer/V)^2, 2026-09-11); G630: a trike's
  // rate term a quarter, none under the brakes, its P capped at a kinematic
  // bandwidth. P1.D (43, groundP1D): P falls and D rises with sqrt(mass)
  // (43, verbatim:)
  //=====
  // THE STEER GAINS (groundSteer's, factored out G630 so the taxi flies
  // them too — the taxi ran the fixed 3.2 / 1.2 at any mass, the fault
  // G250 fixed for the take-off roll; a taildragger bit-identical)
  // P1.D: the heading gain falls and the damping rises with the square
  // root of the mass — the yaw inertia grows with it, the tailwheel's
  // moment does not, and a loop tuned on a 480 kg cub rang a 2 t beaver
  // at 10-19 m/s (+-35 deg at a 4 s period in 4 m/s gusting across)
  // G630: A TRICYCLE'S RATE TERM IS A QUARTER, AND NONE UNDER THE BRAKES.
  // The nosewheel turns the heading kinematically (yaw rate = V steer
  // dr / wheelbase: no inertia to damp at taxi speed), and the full rate
  // term fed the tyres' and springs' own 2.5 Hz yaw mode instead: the
  // rudder rang +-0.05..0.1 down every take-off roll and rollout of the
  // C172s (freeze test: rudder held at 0, the heading stays within 0.16
  // deg — the ring was ALL the loop's). Measured on the aluminium C172:
  // a quarter is quiet on the roll (169 -> 0 reversals/min) and still
  // GREW under the rollout's brakes (the loaded nosewheel); none is
  // quiet everywhere but gave back the crosswind damping (x2 rollout
  // swing 1.6 -> 5.6 deg on the C172); a quarter off the brakes, none on
  // them: 2.9 deg, 0 reversals. `trikeSteerD` is the fraction.
  // ...AND ITS P IS CAPPED AT A FIXED KINEMATIC BANDWIDTH: the loop's
  // crossover is kP V steer / Lwb and it GROWS with the ground speed
  // until the (VSteer/V)^2 schedule starts — ~7 rad/s at VSteer on the
  // C172 archetype, where it rang 1.7 Hz +-0.7 deg under the brakes on
  // P alone (frozen rudder: calm). `steerBW` rad/s.
  S.steerK = (tailUp) => {
    const V = S.V, Vg = S.Vg;
    const kS = trike ? clamp((g('VSteer') / Math.max(V, 5)) ** 2, g('steerMin'), 1.0)
             : clamp((g('VTailUp') / Math.max(V, 5)) ** 2, g('steerMin'), 1.0);
    const kM = FT.groundP1D ? Math.sqrt(Math.max(G.steerMassMin, sim.totalM || G.steerMassRef) / G.steerMassRef) : 1;
    const kP = (tailUp
      ? G.steerP * G.steerTailUpK * clamp((g('VTailUp') / Math.max(V, 5)) ** 2, G.steerTailUpMin, G.steerTailUpMax)
      : G.steerP * kS) / kM;
    const kD = (tailUp ? G.steerTailUpD : G.steerD * (trike ? Math.sqrt(kS) : kS)) * kM;
    if (tailUp || !trike) return [kP, kD];
    const kPb = Math.min(kP, g('steerBW') * TW.Lwb / (Math.max(Vg, 3) * TW.steer));
    return [kPb, kD * g('trikeSteerD') * (1 - clamp((c.brake || 0) / 0.1, 0, 1))];
  };
  // G630: THE WINGS-LEVEL LOOP ON THE WHEELS: the bank error with a deadband,
  // the slow roll rate with its own; off the wheels, the air's law
  // (43, verbatim:)
  // G630: THE WINGS-LEVEL LOOP ON THE WHEELS. -2 ph - p differentiated the
  // contact springs' bank jitter (a tenth of a degree at 1-2 Hz) into
  // aileron chatter the trace's aileron lane showed the whole taxi and
  // roll; on the ground the bank error has a 0.6 deg deadband and the
  // rate is the slow one (0.3 s) with its own 0.02 rad/s deadband. Off
  // the wheels it is the air's law, unchanged.
  S.groundAil = (phT, lim) => S.onG > 0
    ? clamp(-G.gAilP * db(S.ph - phT, G.gBankDb) - G.gAilD * db(S.pG, G.gRateDb), -lim, lim)
    : clamp(-G.gAilP * (S.ph - phT) - G.gAilD * S.p, -lim, lim);
  // the take-off roll / rollout steer. thRest: the latched three-point pitch;
  // F: the runway frame (the into-wind aileron, xwBank)
  // (43, verbatim:)
  // H4 (G393): ON THE WATER the split is displacement / on the step
  // (wheelsOnGround reads 3 / 2 for exactly that), the water rudder is
  // up on the step and the air rudder alone holds the run, and there is
  // no castor to over-control: the pedals go to the stop either way.
  // Measured on the ultralight in a 5 m/s crosswind: with the
  // taildragger's 0.45 clamp it weathervaned 40 deg on the step and left
  // the lane 186 m off; with this, see the H4 entry.
  // P1.D: the tail is up when the TAILWHEEL is off the ground
  // (sim.wheelContacts), not when the pitch says so — banked 8 deg on
  // one main at a three-point attitude the cub read "tail down", the
  // rudder was clamped to the tailwheel's 0.45 and the nose swung 32 deg
  // before the tail touched
  // (GATE TAKEOFF reads this line by regex: the tail-state schedule first)
  // P1.D: the tail-down rudder stop is the TAILWHEEL's (0.45 keeps a
  // swerve out of the taxi), and it climbs with the speed to the full
  // pedal by VTailUp — at 19 m/s three-point in 4 m/s gusting across
  // the beaver weathervaned 31 deg each way on 0.45 of rudder that the
  // fin alone could have held
  // A TRICYCLE'S STEER GAINS EASE WITH SPEED (2026-09-11). The taildragger
  // branch below already schedules on (VTailUp/V)^2 once the tail is up;
  // the trike ran the fixed 3.2 / 1.2 down the whole strip, and with the
  // rudder's authority growing as V^2 (in the propwash on a pusher) on
  // top of the nosewheel's, the loop crossed the rate estimate's lag at
  // ~12 m/s: a 1.25 Hz weave, rudder on its stop, on the user's pusher.
  // Same form, the trike's own reference speed (genAP VSteer, 0.6 VRot),
  // and a floor measured on that build. Taildraggers: bit-identical.
  // G381: ...AND A TAILDRAGGER'S TAIL-DOWN GAINS EASE THE SAME WAY. The
  // tail-up branch schedules on (VTailUp/V)^2; the tail-down branch ran
  // the fixed 3.2 / 1.2 at any speed, which is fine below VTailUp (the
  // roll it was tuned on) and unstable above it: a wheel landing at
  // 26 m/s drops its tail at 17-19, the rudder's authority is 1.5x what
  // the gains were sized for, and the weave grew 2 -> 7 -> 12 -> 52 deg
  // with the rudder on its stop (stearman and cub archetypes, measured).
  // The floor 0.3 = VTailUp x 1.8, the fastest a tail-down roll gets.
  // AILERON INTO THE WIND (2026-09-08) — the other half of a crosswind
  // ground roll, and the pilot had only the first. This held the wings
  // LEVEL, which is right in calm air and exactly wrong across the
  // wind: a level wing lets the upwind main unload, the aeroplane
  // drifts, and on a taildragger the drift becomes the weathercock the
  // rudder then fights at its stop. TRACED on the ultralight fixture at
  // 2 m/s across (TAIL CHANTIER 2 P5): the tail lightens at 17 m/s, the
  // tailwheel's steering goes with it (30_solver: only it steers), the
  // nose swings 34 deg with the rudder saturated for three seconds, and
  // the aeroplane leaves the centreline by 18 m. A pilot holds aileron
  // INTO the wind — most at low speed, easing as the ailerons bite — so
  // the upwind wheel keeps its load. The command is a BANK BIAS, so the
  // level-wing loop still flies it and nothing else changes; in calm
  // air `wX` is 0 and this is the old law to the bit.
  // `out.wind*` is the AIR'S VELOCITY, not the direction it comes from:
  // air moving toward +z blows FROM the starboard side, so into-wind is
  // the starboard wing DOWN, and the bias carries the same sign as the
  // cross component. (Measured both ways on the fixture: with the sign
  // reversed the wander grew to 29 m; with this one it is 2.6 m.)
  // On a tricycle the reference is VSteer, not VTailUp (99, which pinned
  // the clamp at 1.6 and asked 8 deg of bank at 2 m/s — the aeroplane ran
  // on one main from 15 m/s and left the strip 10 m off in the game's
  S.groundSteer = (thRest, F) => {
    const V = S.V, th = S.th, onG = S.onG, e = S.e, o = S.out || {};
    const onWater = !!(FT.water && sim.hydro);
    let tailUp, drMax;
    if (FT.groundP1D) {
      const WC = typeof sim.wheelContacts === 'function' ? sim.wheelContacts() : null;
      tailUp = rotateTD && !onWater && (WC ? (!WC.tw && onG >= 1) : (onG <= 2 && thRest !== null && (thRest - th) > 0.04))
            || (onWater && onG <= 2 && V > 6);
      drMax = tailUp ? G.drTailUp : (onWater ? G.drWater : clamp(G.drTailDown + 0.5 * V / g('VTailUp'), G.drTailDown, G.drTailUp));
    } else {
      tailUp = rotateTD && onG <= 2 && thRest !== null && (thRest - th) > 0.04;
      drMax = tailUp ? G.drTailUp : G.drTailDown;
    }
    const [kP0, kD] = S.steerK(tailUp);
    const kP = (onWater && tailUp) ? kP0 * g('waterStepK') : kP0;   // G1937: DAMP's water-step entry (1 = unchanged)
    c.dr = clamp(-kP * e - kD * S.eR, -drMax, drMax);
    if (FT.xwBank && F) {
      // AILERON INTO THE WIND (2026-09-08, 43): a bank bias the level-wing
      // loop flies; P1.D: on the wheels within xwBankGround
      const wX = -(o.windX || 0) * F.uz + (o.windZ || 0) * F.ux;
      const vRef = trike ? g('VSteer') : g('VTailUp');
      let phW = g('xwBank') * wX * clamp(vRef / Math.max(V, 6), 0.4, 1.6);
      if (!onWater && onG >= (trike ? 3 : 1)) phW = clamp(phW, -g('xwBankGround'), g('xwBankGround'));
      c.da = S.groundAil(phW, G.gAilRoll);
    } else c.da = S.groundAil(0, G.gAilTaxi);
    S.tailUp = tailUp;
    return tailUp;
  };
  // THE TAXI GOVERNOR: a PI on the ground speed over the rolling-resistance
  // feed-forward `ff`, saturated at `cap`, the integrator forgotten after
  // taxiForgetS without a call; the brake takes the overspeed in proportion
  S.taxi = (Vtgt, ff, cap) => {
    const t = now(), Vg = S.Vg;
    c.de = g('taxiDe');
    if (t - S.taxiLastT > G.taxiForgetS) S.taxiI = 0;
    S.taxiLastT = t;
    const err = Vtgt - Vg;
    const u0 = ff + G.taxiP * err + S.taxiI;
    if ((err > 0 && u0 < cap) || (err < 0 && u0 > 0))
      S.taxiI = clamp(S.taxiI + G.taxiIK * err * S.dt, -ff, cap);
    c.thr = clamp(ff + G.taxiP * err + S.taxiI, 0, cap);
    c.brake = Vg > Vtgt + G.taxiBrakeDb ? clamp(G.taxiBrakeK * (Vg - Vtgt - G.taxiBrakeDb), 0, G.taxiBrakeMax) : 0;
    c.da = S.groundAil(0, G.gAilTaxi);
  };
  // G630: the taxi's look-ahead target heading, filtered (it STEPS as the
  // index passes each sample of a bend); returns the heading to steer to
  S.taxiHeading = (hT) => {
    const t = now();
    if (S.taxiHdgF == null || t - S.taxiHdgT > G.taxiHdgForgetS) S.taxiHdgF = hT;
    else S.taxiHdgF = servoWrapPi(S.taxiHdgF + servoWrapPi(hT - S.taxiHdgF) * Math.min(1, S.dt / G.taxiHdgTau));
    S.taxiHdgT = t;
    return S.taxiHdgF;
  };
  // G630: the taxi rudder — the steer schedule's P, the curvature feed-forward,
  // NO rate term (at taxi speed the wheel steers the heading kinematically)
  S.taxiRudder = (ff, lim) => { const u = -S.steerK(false)[0] * S.e; return clamp(ff ? u + ff : u, -lim, lim); };

  // ---- the servo slew, on the axes the pilot owns ----------------------------------
  S.slew = (ownV = true, ownL = true) => {
    const sl = A.slew * (S.slewK || 1) * S.dt;   // G1943: a profile's smoothness (unset: 1, the expert)
    if (ownV) { S.aDe += clamp(c.de - S.aDe, -sl, sl); c.de = S.aDe; } else S.aDe = c.de;
    if (ownL) {
      S.aDa += clamp(c.da - S.aDa, -sl, sl); c.da = S.aDa;
      S.aDr += clamp(c.dr - S.aDr, -sl, sl); c.dr = S.aDr;
    } else { S.aDa = c.da; S.aDr = c.dr; }
  };
  // end of the pilot's update: holdPitch re-latches when the previous step did not call it
  S.endStep = () => { holdWas = holdActive; holdActive = false; };
  return S;
}

// G1937 (PILOT-ONE): THE STEP-ATTITUDE HOLD, a technique - the elevator that holds a planing hull at its trim:
// de = stepDe0 + stepK (trimTgt - trim) - stepD q (trim and its rate q in deg, deg/s), clamped to the water's stick
// [-0.30, deWater]. The Deform Coordinator's GATE FLOATS script flies exactly this from 9 m/s; a gate calls it
// (or SV.stepHold) instead of keeping its own copy. THE PILOT does not fly it today: measured on the float builds
// (scratch water_exp, law 'hold', between the step and the pull, with G1937's throttle ramp) it changed nothing on
// the v7 twin (lift-off 28.2 vs 28.1 m/s), lifted the ultralight off later (21.2 vs 20.9) and SKIPPED the Wipline
// C172 once (2 lifts, a 26.7 deg/s pitch rate) where the neutral stick lifts it off once - with the solver's
// rigid-rotation damper present. `A.stepHold` (true) or a personality turns it on in ROLL (43)
function servoStepHold(trimDeg, qDeg, gains) {
  const G = Object.assign({}, SERVO_GAINS, gains || {});
  return Math.max(G.deMin, Math.min(G.deWater, G.stepDe0 + G.stepK * ((gains && gains.trimTgt != null ? gains.trimTgt : G.stepTrim) - trimDeg) - G.stepD * qDeg));
}

// the CG's rest height over the ground in the design pose (sim.reset seats the
// lowest contact on the floor): B5's height datum for a pilot first engaged in
// the air, where no rest can be measured
function servoRestHeight(def) {
  if (!def || !def.nodes || !def.nodes.length) return 0;
  let y = 0, M = 0, lo = Infinity;
  for (const n of def.nodes) { y += n.p[1] * n.m; M += n.m; lo = Math.min(lo, n.p[1] - (n.r || 0)); }
  return M > 0 && isFinite(lo) ? y / M - lo : 0;
}

if (typeof module !== 'undefined') {
  module.exports = { SERVO_GAINS, SERVO_TUNE, makeServos, servoWrapPi, servoCrossWind, servoRestHeight };
}
