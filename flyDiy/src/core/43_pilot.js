// ============================================================
// THE PILOT (G202, 2026-09-06). The third pilot, and the one the garage
// flies now. The user's brief: "The current autopilot has issues ... easily
// misses the glide slope, starts going around for no reason, doesn't deploy
// the flaps before landing, has no idea how to control the glideslope, does
// not rotate on take off for tricycles, overshoots its control points in the
// ground circuit, misses key steps and keeps in a flight phase forever ... no
// one has ever been able to properly land, turn around and take off again.
// It gets confused with the track direction. Robustness and precision, and
// clear feedback are the keys." And, mid-session: "write core functions
// typical from autopilots, Vs, fpm, altitude heading, gps, etc. The whole
// garmin thing."
//
// THREE LAYERS, like the box in a real panel:
//
//   THE SERVOS   holdPitch, airLateral, speedThrottle, holdVS, groundSteer,
//                the taxi governor, the path follower — the test pilot's
//                (41_test_pilot.js), carried VERBATIM. genTuneAP sizes their
//                gains per aeroplane; the G201 pass proved them on 25
//                archetypes. Nothing here re-tunes them.
//   THE AFCS     the modes a flight-control computer offers, each one a
//                function of a selected target (ap.afcs):
//                  lateral   HDG (hold a heading) · TRK (fly to a point) ·
//                            NAV (a leg, cross-track corrected, turn
//                            anticipation) · LOC (the runway centreline of
//                            the landing frame) · RWY (the centreline on the
//                            wheels) · TAXI (the ground path) · DECRAB
//                  vertical  ALT (hold an altitude) · VS (hold a vertical
//                            speed) · FLC (hold an airspeed with pitch) ·
//                            GS (fly the glideslope) · PITCH (an attitude) ·
//                            DE (a raw elevator)
//                  thrust    SPD (hold an airspeed with the throttle) · FULL ·
//                            IDLE · SET (a value) · TAXI (a ground speed)
//                The flight director (ap.afcs.fd) is the commanded pitch and
//                bank the servos are flying to.
//   THE PILOT    the phase machine: it only SELECTS modes and targets, plans
//                the ground route and the arrival, judges the take-off, and
//                says what it is doing (ap.status). Every phase is bounded.
//
// WHAT IS NEW AGAINST THE TEST PILOT.
//   1. A RECTANGULAR CIRCUIT flown as NAV legs (crosswind, downwind, base,
//      final) that lands in the direction it took off — into wind when
//      there is one. The old pilots flew out and back and landed downwind on
//      every windy day.
//   2. THE ARRIVAL IS PLANNED: an initial fix (IAF) on the extended
//      centreline at circuit height, a level segment, the slope captured
//      FROM BELOW, flaps down at the start of final, and a go-around only
//      when the landing is genuinely unrecoverable — far above the slope
//      inside 600 m, off the centreline on short final, floating with no
//      runway left, terrain under the approach.
//   3. EVERY AEROPLANE ROTATES — a tricycle at Vr like a taildragger (the old
//      ROLL held a fixed elevator on trikes until the wing floated them off).
//   4. THE ACCELERATE-STOP CALL: on the roll the pilot knows the runway left
//      and its stopping distance and rejects the moment it could no longer
//      stop before the end; it rejects EARLY when the measured acceleration
//      cannot reach Vr in what is left, or when a set fraction of the strip
//      is used without Vr. The same arithmetic decides, before the roll,
//      whether the run ahead of a stopped aeroplane is enough.
//   5. LAND, TURN AROUND, TAKE OFF AGAIN: the departure planner reads the
//      pose it is given (any point of the strip, any heading), picks the
//      take-off direction (into wind; else the run ahead if it fits; else
//      the nearer end), and when the route's first leg is behind the nose it
//      inserts a U-turn at the pose so the follower never spins on a point.
//   6. NO PHASE IS UNBOUNDED: a timeout and a fallback each; the go-around
//      count capped at two (then the landing is committed); the watchdog
//      budget still says 'gave-up'.
//   7. THE STATUS: ap.status = { phase, label, goal, conds[], afcs } — what
//      it is doing and exactly what it is waiting for, live, for the rail.
//   8. STYLES: makePilot(sim, def, world, { style }) — 'cautious' | 'normal'
//      | 'brisk' scale the margins.
//
// THE REPORT contract is the test pilot's, unchanged: ap.report =
// { verdicts: [{t, code, note}], outcome, landing, card?, phases[], abort? }.
// outcome ∈ completed | rejected-takeoff | gave-up (| broke-up by a runner).
// Units are SI throughout; PILOT_UNITS converts for a panel that wants kt,
// fpm and ft.
// G381 (2026-09-13, the user: "the new autopilot flying the circuit is a
// brute ... it turns really low and slow, it does not seem to follow the
// glideslope that well, he is bad at anticipating turns according to speed
// and turn radius, and most importantly, he slams planes real hard on the
// ground, and real quick when landing. It's like it does not even flare.
// On the runway, he tends to amplify tail oscillations"). Measured on the
// cub archetype's own circuit before this: the base-to-final turn crossed
// the centreline by 147 m (FINAL capped the bank at 10 deg while the turn
// was planned at 23), the level segment before the slope sagged 25 m (its
// ALT target was re-read from the aeroplane every tick), every leg was
// joined 13 s late (the pursuit tapers the bank as the error shrinks), the
// flare rotated 2.7 deg in 3 s and touched at 1.37 Vs with 1.1 m/s, and on
// two taildraggers the heading swung 60-70 deg as the tail came down at
// 17 m/s with the rudder on its stop (the tail-down steer gains never eased
// with speed; the tail-up ones do). What changed:
//   1. THE ARC TURN: a leg change is flown as a constant-bank turn at the
//      bank the arc was planned with, until the nose is within 11 deg of
//      the new course; only then does the pursuit take over. The fly-by
//      distance uses the GROUND speed and a roll-in allowance.
//   2. The crosswind turn at 0.6 of the circuit height (was 0.35), a
//      climbing turn banked at most 20 deg, the crosswind leg planned to
//      begin where the arc ends.
//   3. FINAL: the level altitude is latched once; the bank limit is the
//      planned one until established on the centreline.
//   4. THE FLARE IS A HOLD-OFF: the sink is flown to -max(0.35, agl/tau)
//      with a pitch law of its own (P + I on the sink error), capped at the
//      three-point attitude on a taildragger and thMax on a tricycle, so
//      the speed bleeds and the wheels arrive at ~0.35 m/s. The old attitude
//      ramp stays under flareMode 'ramp'.
//   5. A three-point touchdown pins the tail from the first frame; the
//      tail-down steer gains ease as (VTailUp/V)^2 like the trike's.
//   6. The speed hold's throttle gets a term on the measured acceleration.
// ============================================================
const PILOT_STYLES = {
  cautious: { name: 'cautious', rejectFrac: 0.50, bank: 0.80, VapprK: 1.06, gaHigh: 40,
              gaXT: 10, taxiK: 0.80, hTurnK: 1.30, reserve: 120, patW: 3.0, needK: 1.3 },
  normal:   { name: 'normal',   rejectFrac: 0.60, bank: 1.00, VapprK: 1.00, gaHigh: 60,
              gaXT: 15, taxiK: 1.00, hTurnK: 1.00, reserve: 80,  patW: 2.6, needK: 1.0 },
  brisk:    { name: 'brisk',    rejectFrac: 0.70, bank: 1.15, VapprK: 0.97, gaHigh: 80,
              gaXT: 20, taxiK: 1.25, hTurnK: 0.75, reserve: 50,  patW: 2.3, needK: 0.9 },
};
// the rail's labels and the tick each phase sits under (app.js reads this)
const PILOT_PHASES = {
  DEPART: ['DEPART', 'DEPART'], TAXI: ['TAXI', 'TAXI'], LINEUP: ['LINE UP', 'LINEUP'],
  STOP: ['STOP', 'LINEUP'], HOLD: ['HOLD', 'LINEUP'], ROLL: ['TAKEOFF ROLL', 'ROLL'],
  ABORT: ['ABORT', 'ROLL'], LIFTOFF: ['LIFT-OFF', 'LIFTOFF'], PUTDOWN: ['PUT DOWN', 'LIFTOFF'],
  CLIMB: ['CLIMB', 'CLIMB'], CROSSWIND: ['CROSSWIND', 'CRUISE'], DOWNWIND: ['DOWNWIND', 'CRUISE'],
  BASE: ['BASE', 'TURNBACK'], ENROUTE: ['ENROUTE', 'ENROUTE'], INBOUND: ['INBOUND', 'INBOUND'],
  FINAL: ['FINAL', 'APPROACH'], GOAROUND: ['GO-AROUND', 'APPROACH'], FLARE: ['FLARE', 'FLARE'],
  ROLLOUT: ['ROLLOUT', 'ROLLOUT'], STOPPED: ['STOPPED', 'STOPPED'],
  BOX: ['AP BOX', 'CRUISE'],
};
const PILOT_UNITS = {
  kt: v => v * 1.943844, fpm: v => v * 196.8504, ft: h => h * 3.28084, kmh: v => v * 3.6,
  deg: r => ((r * 180 / Math.PI) % 360 + 360) % 360,
};

function makePilot(sim, def, world, opts) {
  opts = opts || {};
  const A = def.params.ap;
  const ST = PILOT_STYLES[opts.style] || PILOT_STYLES.normal;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // P0.4 (PILOT-ROADMAP §6.3 rule 5): THE MACHINE SHEET — built lazily (the
  // shakedown behind it costs ~2 s; the garage memoises one, a gate may pass
  // one, `opts.shakedown` is a value or a getter). `opts.sheet` (the flag)
  // makes the pilot fly the sheet's ladder — Vref = 1.30 Vs0 for the
  // approach, 1.20 Vs0 short-field — instead of genAP's 1.42 Vs; off until
  // the matrix says it wins (the ramp-flare precedent). Either way the sheet
  // is published as `ap.sheet` for the panel and the planner to come.
  let sheetV = null;
  const sheetOf = () => sheetV || (sheetV = (typeof machineSheet === 'function'
    ? machineSheet(def, { shakedown: opts.shakedown }) : null));
  // G399.7 (P0.7): the sheet's ladder, TECS and the path ARE the pilot — the
  // flags that kept the old modes selectable (G399.2-G399.5) are retired,
  // the full matrix having judged every archetype under them
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  // ---- the aeroplane's ground facts (41_test_pilot.js, verbatim) ------------
  const GP = (typeof genGroundPowerCap === 'function')
    ? genGroundPowerCap(def, sim.thrustAt(0), sim.totalM * 9.81) : { cap: 1 };
  const TW = (() => {
    const N = def.nodes, R = def.refs;
    let Lwb = 4.0;
    if (R && R.mains && R.mains.length && R.tw != null && R.tw >= 0) {
      const mx = R.mains.reduce((s, i) => s + N[i].p[0], 0) / R.mains.length;
      Lwb = Math.max(0.5, Math.abs(N[R.tw].p[0] - mx));
    }
    return { Lwb, steer: Math.abs(def.params.twSteer || 0.5) };
  })();
  const trike = A.rolloutMode === 'trike' || (def.params.twSteer || 0.5) < 0;
  const threePoint = !trike && GP.cap < 1;
  // every taildragger rotates at Vr (G193); every TRICYCLE rotates too (G202)
  const rotateTD = !trike && (A.rotate != null ? !!A.rotate : true);
  const taxiFF = (() => {
    const PP = POWERPLANTS[def.params.powerplant];
    const PR = def.params.prop || PP.prop;
    const T0 = Math.max(1, PR.Tstatic * (def.params.nEngines || 1));
    // the surface's rolling resistance and the slope's pull, both live (P0.8)
    return () => Math.min(0.5, (((gSurf && gSurf[0]) ?? CRR) + Math.max(0, -gGrade)) * sim.totalM * 9.81 / T0);
  })();
  // the stopping deceleration the accelerate-stop call plans with: the grass
  // datum's rolling + braking coefficients at the pilot's own brake limit,
  // taken at 80 % (a wet-side margin; the measured stop goes on the report)
  // P0.8 (PILOT-ROADMAP §0.2): THE GROUND IS NOT LEVEL GRASS. The stop
  // decelerates on the SURFACE under the wheels (GROUND_SURF's rolling and
  // braking coefficients per class — the solver's own table) and on the
  // GRADIENT along the run (g sin: uphill helps a stop, hurts a take-off);
  // both read live (`groundHere`), the grass datum as the fallback.
  let gSurf = null, gGrade = 0;                  // the surface row and the gradient under the aeroplane, per update
  const aStopOf = () => {
    const row = gSurf || (typeof GROUND_SURF === 'object' && GROUND_SURF[0]) || [CRR, MU_BRAKE, 0.8];
    return A.aStop || 9.81 * ((row[0] ?? CRR) + (A.brakeMax || 0.3) * (row[1] ?? MU_BRAKE)) * 0.8 + 9.81 * gGrade;
  };
  const stopDist = v => v * v / (2 * Math.max(0.5, aStopOf())) + v * 1.0;
  // the run a take-off needs from a standstill: most of the sheet's roll
  // (Vr is reached before the sheet's lift-off point), the stop from Vr, the
  // reserve — the SAME arithmetic the roll rejects with, so the planner and
  // the judge never disagree
  const runNeeded = () => ST.needK * (0.85 * (A.TORun ?? 500) + stopDist(A.VRot || 18) + ST.reserve);

  // ---- frames -------------------------------------------------------------
  // The landing/departure frame is the test pilot's: origin td + 450 u so the
  // calibrated xAim (-520) is 70 m short of the touchdown target along the
  // landing direction u = (ux, uz). k = which of the pattern's two targets.
  const mkFrame = (a, sx, sz) => {
    let ux = snap(Math.cos(a.hdg)), uz = snap(Math.sin(a.hdg));
    if (sx !== undefined) {
      const d = ux * sx + uz * sz;
      if (d < 0) { ux = -ux; uz = -uz; }
    } else { ux = -ux; uz = -uz; }
    const k = (ux * Math.cos(a.hdg) + uz * Math.sin(a.hdg)) > 0 ? 1 : 0;
    const PT = ap.patOf(a);
    const td = (PT && PT.approaches && PT.approaches[k]) ? PT.approaches[k].td : a.tdz;
    return { ux, uz, ox: td[0] + 450 * ux, oz: td[1] + 450 * uz, k, td: [td[0], td[1]] };
  };
  const HOMEISH = { hdg: Math.PI, tdz: [-845, 0], elev: 0, len: 1100, x: -520, z: 0 };
  // the speed ladder: the sheet's when the flag is on and the stall is measured
  const SH0 = sheetOf();
  const sheetVAppr = SH0 && SH0.src.Vs0 === 'measured' ? SH0.Vref : null;
  const VApprShort = sheetVAppr != null ? 1.20 * SH0.Vs0 : A.VApprShort;
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: sheetVAppr ?? A.VAppr, xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
    targetDir: [-1, 0, 0], trackHold: true, dirX: -1,
    restAlt: null, refAlt: null, altRef: 0, tdInfo: null, dbg: {},
    route: null, xc: false, frame: null, gaN: 0, gaWhy: null,
    report: { verdicts: [], outcome: null, landing: null, phases: [], style: ST.name },
    status: { phase: 'ROLL', label: 'TAKEOFF ROLL', goal: '', conds: [], since: 0 },
    afcs: { lat: 'RWY', vert: 'DE', thr: 'SET', sel: {}, fd: { pitch: 0, bank: 0 } },
    // G202.1: the AP box — the modes as a device the hand can share
    box: { on: false, lat: null, vert: null, thr: null, sel: {}, resume: null },
    nav: null,
    budget: 600, style: ST.name, legs: null, legI: 0, path: null, pathI: 0, plan: null,
  };
  const say = (code, note) => {
    ap.report.verdicts.push({ t: Math.round(ap.t * 10) / 10, code, note });
  };
  let phaseT = 0;
  const go = (ph) => {
    if (ph !== ap.phase) ap.report.phases.push({ t: Math.round(ap.t * 10) / 10, phase: ph });
    ap.phase = ph; phaseT = 0;
  };
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
  // P0 (PILOT-ROADMAP): the watchdog's budget is the ROUTE's — 600 s was the
  // circuit's and a 10 km cross-country to A3 (300 s enroute for a cub, a
  // go-around, a second circuit) was "out of patience" at 600 s on the
  // matrix. The distance at the cruise speed, times 1.6 for the wind and the
  // circuit, on top of the circuit's own 600.
  const routeBudget = (from, to) => {
    const d = (from && to && from !== to) ? Math.hypot(to.x - from.x, to.z - from.z) : 0;
    return 600 + 1.6 * d / Math.max(15, ap.VCruise || A.VCruise || 30);
  };
  ap.setRoute = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.budget = Math.max(ap.budget, routeBudget(from, to));
  };
  ap.setRoute(world ? world.aerodromes[0] : HOMEISH, world ? world.aerodromes[0] : HOMEISH);
  let holdN = 0, planN = 0;
  ap.departFrom = (from, to, siteOrTaxiOut) => {
    const site = (siteOrTaxiOut && !Array.isArray(siteOrTaxiOut)) ? siteOrTaxiOut : null;
    ap.site = site;
    ap.path = null; ap.pathI = 0; ap.stopAfterLineup = false; holdN = 0; planN = 0;
    ap.taxiOut = Array.isArray(siteOrTaxiOut) && siteOrTaxiOut.length ? siteOrTaxiOut
               : (site && site.taxiOut) || null;
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.trackHold = false;
    ap.legs = null; ap.legI = 0; ap.plan = null;
    ap.budget = Math.max(ap.budget, ap.t + routeBudget(from, to));
    go('DEPART');
  };

  // ---- the servos' state (41_test_pilot.js, verbatim) ------------------------
  let thP = 0, phP = 0, eP = 0, q = 0, p = 0, eR = 0, eRslow = 0, thF = 0, phF = 0, thCA = 0, vsF = 0;
  let vsSlow = 0, gaT = 0;
  let aDe = 0, aDa = 0, aDr = 0, phCA = 0;
  let Ith = 0, thcI = 0.06, It = 0, thrC = 0.6;
  let thFlare0 = 0, thLift0 = 0, brakeRamp = 0, holdActive = false, holdWas = false;
  // ROTATION AUTHORITY (2026-09-11). holdPitch's integrator is capped at
  // 0.15 for the air; on the ground a high thrust line (a pusher pod 0.6 m
  // above the CG) holds the nose down harder than P + 0.15 can lift it — the
  // user's pusher was asked to rotate at 18 m/s and floated off at 33 after
  // 25 s. While ROLL is asking for rotation and the wheels are down the cap
  // opens to `rotateIMax` (the servo's own de limit is 0.35); it closes
  // again at a rate, never in a step, so liftoff sees no jolt.
  // ...and the integrator WINDS FASTER there (`rotateI`): pitchI is 0.05,
  // 0.0075 rad/s at a 0.15 rad error — a pilot on the ground past Vr pulls
  // until the nose comes up, and unwinds as it does. Off the ground both go
  // back to the air's numbers.
  let IthMax = 0.15, IthMaxT = 0.15, IthGain = null;
  // G381: the flare's own inner-loop gains (P up, rate damping down) — the
  // cruise loop moved 1 deg in 3 s at idle, which is no flare at all
  let pitchK = 1, pitchDK = 1;
  let taxiI = 0, taxiLastT = -1e9;
  let thRest = null, thrRoll = 0, taxiXT = 0, taxiSRem = 0, tailUpNow = false;
  let eAP = 0, eAR = 0, eARslow = 0;
  let eTrim = 0;
  let pendReEng = false;
  let rollS0 = null, rollN = 0, accF = 0, vPrev = null;
  let climbMode = true, ceilT = 0, ceilingSaid = false;
  let slopeCaptured = false, finalT0 = 0, committed = false, cardAcc = null;
  // G381: the arc turn in progress, the latched level altitude before the
  // slope, the flare's own integrator / cap / timescale, a three-point flag
  let finalLevel = null;
  let flI = 0, flCap = 0, flTau = 3.2, flVsF = 0, tdThree = false;
  // G381.1: the power assist on the approach (see apply)
  let pAsst = 0;
  let gearH = null, onGT = 0;             // P0.8: the CG's rest height above the terrain; the contact's duration
  // P0.5 (PILOT-ROADMAP §6.3 rule 1): TECS's own state — the throttle and the
  // balance integrators, the filtered rates, the speed weight
  // P0.6 (PILOT-ROADMAP §6.3 rules 1 and 3): THE PATH — the circuit as one
  // filleted geometry planned once, followed by one lateral law (L1) with
  // the arc's curvature fed forward; `path: false` keeps the pursuit + arc
  let airPath = null, airPathI = 0, pathDbg = null, heldOut = false, pathFrom = null, escapeHdg = null, escapeCircle = false, terrainTurnSaid = false, vxHeld = false, vxSaid = false;
  let tIthr = 0, tIpit = 0, tHdot = 0, tWk = 1, tOn = false, tecsDbg = null;
  // G399.7: the speed the ELEVATOR can hold — raised while it sits on its nose-up stop
  let tDeSatT = 0, tVAdapt = 0, tVAdaptSaid = false;
  let abortV0 = null, abortS0 = null, committedTO = false;
  ap.reEngage = (o) => {
    pendReEng = true;
    if (o && typeof o.phase === 'string' && o.phase !== ap.phase) go(o.phase);
  };
  ap.taxiFF = taxiFF;
  Object.defineProperty(ap, 'sheet', { get: sheetOf, enumerable: false });
  ap.useSheet = ap.useTecs = ap.usePath = true;   // G399.7: no longer optional; kept for the trace tool's summary

  // ---- THE AP BOX (G202.1): the modes as a device -------------------------
  // engage({lat, vert, thr}, sel): a mode per axis (undefined = keep, null =
  // release that axis to the hand); the phase machine steps aside while the
  // box is on and the hand keeps whatever axis has no mode. select(sel)
  // moves the targets. disengage(resume) hands back to the pilot, which
  // re-latches its filters from the live state and resumes at `resume` (a
  // phase name) or where the aeroplane is ('auto': ROLLOUT on the wheels,
  // CLIMB in the air, which plans a circuit home). setNav(nav) gives the NAV
  // mode a navigator (38_nav.js) to follow. Targets: hdg (rad, the world's
  // atan2 angle), alt (m, absolute), vs (m/s), ias (m/s), trk ([x, z]),
  // pitch (rad), thr (0..1), gs (the slope, LOC + GS on the landing frame).
  ap.engage = (modes, sel) => {
    const B = ap.box;
    modes = modes || {};
    for (const k of ['lat', 'vert', 'thr']) if (modes[k] !== undefined) B[k] = modes[k];
    if (sel) Object.assign(B.sel, sel);
    if (!B.on) { B.on = true; B.resume = null; pendReEng = true; go('BOX'); }
    return ap;
  };
  ap.select = (sel) => { if (sel) Object.assign(ap.box.sel, sel); return ap; };
  ap.disengage = (resume) => {
    const B = ap.box;
    if (!B.on) return ap;
    B.on = false; B.lat = B.vert = B.thr = null; B.resume = resume || 'auto';
    pendReEng = true;
    return ap;
  };
  ap.setNav = (nav) => { ap.nav = nav || null; return ap; };
  // THE ONE READOUT for a panel (the PFD/MFD to come): what the last update
  // measured, the modes and targets engaged, the flight director, the
  // navigator's readouts. SI; PILOT_UNITS converts.
  ap.instruments = () => Object.assign({}, ap._m || {}, {
    phase: ap.phase, box: ap.box.on,
    modes: { lat: ap.afcs.lat, vert: ap.afcs.vert, thr: ap.afcs.thr },
    sel: Object.assign({}, ap.afcs.sel), fd: ap.afcs.fd,
    nav: ap.nav ? ap.nav.last : null,
  });

  // ---- the test card (41_test_pilot.js, verbatim) ----------------------------
  ap.setCard = (card) => {
    if (!card || (!isFinite(card.alt) && !isFinite(card.V))) return;
    const c = { alt: null, V: null, altCmd: null, VCmd: null, altFlown: null, VFlown: null };
    if (isFinite(card.alt) && card.alt > 0) {
      c.alt = card.alt;
      c.altCmd = clamp(card.alt, A.hSafe + 20, 2500);
      if (c.altCmd !== card.alt)
        say('card-clamped', 'altitude ' + Math.round(card.alt) + ' m asked, ' +
            Math.round(c.altCmd) + ' m flown — the pilot sets the floor and the ceiling');
      ap.hCruise = c.altCmd;
      ap.budget = Math.max(ap.budget, 300 + c.altCmd * 1.5);
    }
    if (isFinite(card.V) && card.V > 0) {
      c.V = card.V;
      c.VCmd = clamp(card.V, A.VAppr || 15, 120);
      if (c.VCmd !== card.V)
        say('card-clamped', 'speed ' + card.V.toFixed(1) + ' m/s asked, ' +
            c.VCmd.toFixed(1) + ' m/s flown (' + Math.round(c.VCmd * 3.6) +
            ' km/h) — not slower than the approach, not absurd');
      ap.VCruise = c.VCmd;
    }
    ap.report.card = c;
    cardAcc = { n: 0, alt: 0, V: 0, saidV: false };
  };

  // ---- geometry -----------------------------------------------------------------
  const VTurn = A.VTurn || 0.5 * (A.VCruise + A.VAppr);
  const bankLim = clamp((A.bankLim ?? 0.30) * ST.bank, 0.15, 0.55);
  const Rturn = VTurn * VTurn / (9.81 * Math.tan(bankLim));
  const lookC = A.lookCruise ?? 150, lookA = A.lookAppr ?? 100;
  const windAt = (a, h) => {
    if (!world || !world.wind) return [0, 0];
    const wv = world.wind(a.x, (a.elev || 0) + (h || 30), a.z, ap.t);
    return [wv[0], wv[2]];
  };
  // P1.A (PILOT-ROADMAP §4): THE RUNWAY MODEL — the strip and what stands
  // past its ends (25_airfield.js siteRunwayModel), read once per aerodrome
  // and kept; null where the core has no world to read
  const siteModels = {};
  const siteModelOf = (a) => {
    if (!a || typeof siteRunwayModel !== 'function' || !world || typeof world.terrainH !== 'function') return null;
    const k = a.id || (a.x + ',' + a.z);
    if (!(k in siteModels)) { try { siteModels[k] = siteRunwayModel(a, world); } catch (e) { siteModels[k] = null; } }
    return siteModels[k];
  };
  // the aeroplane's own limits, off the sheet: the steepest approach it can
  // fly at idle in the landing configuration (1.4 / LDbest — the flaps and
  // the gear cost about 40 % of the clean glide; 6 deg without a sheet) and
  // the gradient a go-around may count on (0.8 of the measured Vy climb —
  // it begins at Vref, flaps down)
  const gsMax = SH0 && SH0.LDbest ? clamp(1.4 / SH0.LDbest, 0.07, 0.16) : 0.105;
  const gammaGA = SH0 && SH0.gammaClimb ? 0.8 * SH0.gammaClimb : 0.08;
  const dirLim = (mode) => ({ gs: A.gs, gsMax, gammaClimb: gammaGA, mode, LDGrun: SH0 && SH0.LDGrun ? SH0.LDGrun : null, TORun: SH0 && SH0.TORun ? SH0.TORun : null });
  // the take-off / landing direction at an aerodrome: the runway model's two
  // directions SCORED (25_airfield.js siteScoreDirections: the wind, the
  // slope, the approach the obstacles allow, the climb-out) with the
  // preference as the tie-break; without a model, into wind when there is
  // one, else the runway direction nearest the preference (a unit vector).
  // `mode` 'land' (default) or 'takeoff' — a strip in a valley is landed
  // toward the hill and left away from it
  const dirAt = (a, px, pz, mode) => {
    const axx = snap(Math.cos(a.hdg)), axz = snap(Math.sin(a.hdg));
    const w = windAt(a, 30);
    const M = siteModelOf(a);
    if (M && typeof siteScoreDirections === 'function') {
      let pref = [px, pz];
      // G398.3: a ONE-WAY strip (a premises runway with `approach`) names its landing direction
      if (typeof a.landHdg === 'number') pref = [Math.cos(a.landHdg), Math.sin(a.landHdg)];
      const sc = siteScoreDirections(M, w, dirLim(mode || 'land'), pref, typeof a.landHdg === 'number');
      ap.dirWhy = sc.why[sc.k];
      return M.dir[sc.k].u.slice();
    }
    let dx = px, dz = pz;
    if (Math.hypot(w[0], w[1]) > 0.7) { dx = -w[0]; dz = -w[1]; }
    else if (typeof a.landHdg === 'number') { dx = Math.cos(a.landHdg); dz = Math.sin(a.landHdg); }
    const sg = (dx * axx + dz * axz) >= 0 ? 1 : -1;
    return [axx * sg, axz * sg];
  };
  // P1.B: THE GUST, READ OFF THE DAY — the wind at the aerodrome sampled
  // over the next 30 s (the field is deterministic in t): the spread of
  // its speed. Half of it goes on Vref (the POH's rule); nothing asks the
  // world what it was set to
  const gustAt = (a) => {
    if (!world || !world.wind) return 0;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 60; k++) {
      const wv = world.wind(a.x, (a.elev || 0) + 30, a.z, ap.t + k * 0.5);
      const sp = Math.hypot(wv[0], wv[2]);
      lo = Math.min(lo, sp); hi = Math.max(hi, sp);
    }
    return Math.max(0, hi - lo);
  };
  // a point in a landing frame: s along u, c to the LEFT of u
  const wp = (F, s, c) => [F.ox + s * F.ux + c * F.uz, F.oz + s * F.uz - c * F.ux];
  // P0.8: the slope ends on the AIM POINT'S GROUND — the CG's rest altitude
  // there (terrain + gearH), not the flat datum; the runway's profile is
  // read straight off the terrain (the premises' `profile` grades it)
  // G418: THE GROUND IS THE SURFACE THE AEROPLANE RIDES ON — the terrain
  // or the water over it, whichever is higher. P0.8 read the TERRAIN, and
  // under the SEA lane the terrain is the sea floor: the slope ended 18 m
  // under the water at the aim, the floatplane met the surface 226 m short
  // of it (touch at 6 m of water where the gate wants the lane's 10+),
  // gearH was measured 16 m too tall at the spawn and aglG read negative on
  // the surface. One helper, every read the pilot makes of the ground.
  const groundH = (x, z) => {
    const t = world.terrainH(x, z);
    const w = (typeof world.waterH === 'function') ? world.waterH(x, z) : -Infinity;
    return w > t ? w : t;
  };
  const aimAlt = () => {
    if (!world || typeof world.terrainH !== 'function' || !ap.frame) return ap.refAlt;
    const P0 = wp(ap.frame, ap.xAim, 0);
    return groundH(P0[0], P0[1]) + (gearH || 0);
  };
  const leftOf = (F, cg) => (cg[0] - F.ox) * F.uz - (cg[2] - F.oz) * F.ux;
  const alongOf = (F, cg) => (cg[0] - F.ox) * F.ux + (cg[2] - F.oz) * F.uz;
  const legGeom = (L) => {
    const dx = L.B[0] - L.A[0], dz = L.B[1] - L.A[1], len = Math.hypot(dx, dz) || 1e-9;
    return { ux: dx / len, uz: dz / len, len };
  };
  // P1: THE GRADIENT THE GROUND AHEAD ASKS — the steepest (ground + clear -
  // alt) / distance over the same six samples: what the climb must beat
  // to fly that way from here (the runway model's cone, flown live)
  const gradAhead = (x, z, dx, dz, dist, alt, clear) => {
    if (!world || typeof world.terrainH !== 'function') return -1;
    let g = -1;
    const n = Math.max(6, Math.ceil(dist / 150));          // every 150 m: a ridge is narrower than a sixth of a leg
    const canopy = typeof world.canopyH === 'function';    // P1.C: the trees are what a climb-out clears
    for (let k = 1; k <= n; k++) {
      const d = dist * k / n, px = x + dx * d, pz = z + dz * d;
      g = Math.max(g, (groundH(px, pz) + (canopy ? world.canopyH(px, pz, 20) : 0) + clear - alt) / d);
    }
    return g;
  };
  const terrainAhead = (x, z, dx, dz, dist) => {
    if (!world || typeof world.terrainH !== 'function') return -1e9;
    let h = -1e9;
    for (let k = 0; k <= 6; k++) {
      const d = dist * k / 6;
      h = Math.max(h, groundH(x + dx * d, z + dz * d));   // G418: the surface, water included
    }
    return h;
  };
  // THE ARRIVAL PLAN: the landing frame at `to` along u; the aim; the slope
  // from the FAF; a level segment before it; the IAF at circuit height; the
  // pattern's width off the aeroplane's own turn radius.
  const planArrival = (to, u, from) => {
    const F = mkFrame(to, u[0], u[1]);
    ap.frame = F; ap.dirX = 1;
    ap.altRef = to.elev;
    ap.refAlt = (ap.restAlt == null ? 0 : ap.restAlt) + (to.elev - (from ? from.elev : to.elev));
    const sCen = alongOf(F, [to.x, 0, to.z]);
    const sThr = sCen - to.len / 2;
    // P1.B: THE APPROACH PLAN (PILOT-ROADMAP B.2-B.6) — what the runway, the
    // machine and the day ask, in one record the phases read:
    //   technique  'short' when the strip is under 450 m or under 1.6 x the
    //              sheet's landing run: Vref 1.2 Vs0, the aim 30 m past the
    //              threshold (8 % of the strip on a longer one), the brakes
    //              from the moment every wheel is down;
    //              'soft' when the surface rolls hard (a GROUND_SURF rolling
    //              resistance of 0.10: duff, sand, scree): no brakes until
    //              the aeroplane is walking, the nose held off;
    //              'normal' otherwise — 1.3 Vs0 on the 20 % mark (a strip
    //              under 700 m: 12 % in, 60 m at least)
    //   Vref       the technique's speed + half the gust (gustAt)
    //   aim        s along the frame; flap the build's landing setting
    // The record is on the report (`appr`) so the matrix can read what was
    // flown. The slope is the runway model's (below).
    {
      const row = (typeof GROUND_SURF === 'object' && GROUND_SURF[to.surface]) || null;
      const water = to.surface === 4 || !!sim.hydro;            // the water has its own laws (H4): no technique
      const soft = !water && !!row && row[0] >= 0.10;
      const runNeed = SH0 && SH0.LDGrun ? SH0.LDGrun : null;
      const short = !water && (to.len < 450 || (runNeed != null && to.len < 1.6 * runNeed));
      const gust = gustAt(to);
      const technique = short ? 'short' : soft ? 'soft' : 'normal';
      const Vbase = short && VApprShort ? VApprShort : (sheetVAppr ?? A.VAppr);
      const aim = short ? sThr + Math.max(30, 0.08 * to.len)
                : to.len < 700 ? sThr + Math.max(60, 0.12 * to.len)
                : Math.max(A.xAim, sThr + 40);
      const FS0 = def.params.flaps;
      ap.appr = { technique, Vref: Math.round((Vbase + 0.5 * gust) * 10) / 10, Vbase: Math.round(Vbase * 10) / 10, gust: Math.round(gust * 10) / 10,
                  aimIn: Math.round(aim - sThr), flap: FS0 ? (FS0.ldg ?? 1) : 0, len: to.len, surface: to.surface,
                  runNeed: runNeed != null ? Math.round(runNeed) : null };
      ap.report.appr = ap.appr;
      ap.xAim = aim; ap.shortFld = short; ap.VAppr = Vbase + 0.5 * gust;
      if (runNeed != null && to.len < 1.15 * runNeed && !ap.stripShortSaid) { ap.stripShortSaid = true; say('strip-short', to.len + ' m of strip for a ' + Math.round(runNeed) + ' m landing run — landing short-field, no margin'); }
    }
    let hC = ap.hCruise;
    // P1.A: THE SLOPE THE OBSTACLES ASK. The runway model's record for this
    // direction: the approach is flown at the archetype's own slope, or the
    // slope the obstacle cone needs (+5 %) when that is steeper, never past
    // gsMax; the pattern is flown on the side the climb-out turns to (a
    // valley strip's departure and go-around turn the same way), else on
    // the side whose ground under the downwind + base is lower
    const M = siteModelOf(to);
    const D = M ? M.dir[(u[0] * M.dir[1].u[0] + u[1] * M.dir[1].u[1]) > 0 ? 1 : 0] : null;
    ap.gs = D ? clamp(Math.max(A.gs, 1.05 * D.reqGs), A.gs, Math.max(A.gs, gsMax)) : A.gs;
    ap.siteDir = D;
    // P1 (found on the dn4 fixture, flown uphill for the first time): the
    // slope ends on the AIM'S ground (aimAlt, P0.8) while the level before
    // the FAF is hC over the aerodrome's datum — the FAF is where the slope
    // reaches THAT level, not hC / gs from the aim: 37 m of ground under
    // the aim put the level 37 m above the slope at the FAF, never captured
    const hFaf = () => Math.max(60, ap.altRef + hC - aimAlt());   // the level's height over the aim
    let Dfaf = hFaf() / ap.gs;
    let Diaf = Dfaf + Math.max(400, 10 * VTurn);
    // P0.8: the crosswind leg carries TWO fillets, each of the radius the
    // aeroplane turns at the speed it flies there (the cruise speed plus the
    // wind, at the planned bank) — a width planned on VTurn alone put the
    // beaver's two 365 m fillets on a 565 m leg, patternPath halved them,
    // and the aeroplane crossed the downwind by 240 m at its bank limit
    const wv0 = windAt(to, 30), RcW = (ap.VCruise + Math.hypot(wv0[0], wv0[1])) ** 2 / (9.81 * Math.tan(bankLim)) * 1.05;
    const W = clamp(Math.max(ST.patW * Rturn, 2.2 * RcW), 300, 1800);
    // the pattern's side: the TERRAIN under each side's downwind and base,
    // sampled (the trees do not move a circuit: the canopy counts for the
    // height below, not the side); the lower side when it is lower by a
    // quarter of the circuit height, else the left (side 1); forced when
    // the climb-out turns (climbTurn +1 about +y is side -1: wp's c is to
    // the LEFT of u) or when the other side stands more than half the
    // circuit height above the strip
    let side = 1, sideForced = false;
    if (M) {
      const gOf = (sd, fn) => {
        let g = -1e9;
        for (let s = ap.xAim + 300; s >= ap.xAim - Diaf; s -= 150) { const q = wp(F, s, sd * W); g = Math.max(g, fn(q[0], q[1])); }
        for (let c = 0; c <= W; c += 150) { const q = wp(F, ap.xAim - Diaf, sd * c); g = Math.max(g, fn(q[0], q[1])); }
        return g;
      };
      const tL = gOf(1, M.floor), tR = gOf(-1, M.floor), gStrip = M.hAt(0.5 * M.R.len);
      if (D && D.climbTurn) { side = -D.climbTurn; sideForced = true; }
      else side = tR < tL - 0.25 * hC ? -1 : 1;
      if (Math.max(tL, tR) - gStrip > 0.5 * hC) sideForced = true;
      const gL = gOf(1, M.ground), gR = gOf(-1, M.ground);
      // THE CIRCUIT HEIGHT over a strip in a valley: the pattern flies at
      // least 0.7 hC over the ground (canopy included) under the chosen
      // side's downwind and base — the strip's own hC where the ground is
      // the strip's, higher where the ground rises under the pattern (the
      // per-leg terrain floor is the reactive guard; this is the plan, so
      // the slope from the FAF is planned from that height)
      const gSide = side > 0 ? gL : gR;
      if (gSide - gStrip + 0.7 * hC > hC) { hC = gSide - gStrip + 0.7 * hC; Dfaf = hFaf() / ap.gs; Diaf = Dfaf + Math.max(400, 10 * VTurn); }
      ap.patGround = { L: Math.round(gL), R: Math.round(gR), strip: Math.round(gStrip), hC: Math.round(hC) };
    }
    ap.plan = { F, sAim: ap.xAim, sFaf: ap.xAim - Dfaf, sIaf: ap.xAim - Diaf, W, hC, side, sideForced };
    return ap.plan;
  };
  const patternLegs = (P, sJoin, side) => {
    const F = P.F, c = side * P.W;
    P.side = side;
    return [
      { name: 'DOWNWIND', A: wp(F, sJoin, c), B: wp(F, P.sIaf, c), h: P.hC, V: 'cruise' },
      { name: 'BASE', A: wp(F, P.sIaf, c), B: wp(F, P.sIaf, 0), h: P.hC, V: 'turn' },
      { name: 'FINAL', A: wp(F, P.sIaf, 0), B: wp(F, P.sAim, 0) },
    ];
  };
  const startLegs = (legs) => { ap.legs = legs; ap.legI = 0; ap.trackHold = false; airPath = null; };
  // P0.6: THE CIRCUIT AS ONE PATH. The legs' corners become patternPath's
  // nodes with the fillet radius the aeroplane turns at each corner's speed
  // (the leg's own: cruise / turn / the approach speed on the last corner)
  // at the planned bank; the path is sampled at 5 m and followed by L1. The
  // first node is the aeroplane's own position when the first leg starts
  // there (the crosswind leg begins one radius ahead; the path's first
  // corner IS that turn). `airPathLegOf[k]` = the leg each corner ends.
  const buildAirPath = (legs, from) => {
    if (!legs || !legs.length || typeof patternPath !== 'function') return null;
    const bC = Math.min(bankLim, A.bankClimb ?? 0.35);
    const nodes = [], ids = [];
    const add = (x, z, r) => { const id = 'p' + nodes.length; nodes.push({ id, x, z, kind: 'air', r }); ids.push(id); };
    const speedOf = L => L.V === 'turn' ? VTurn : L.V === 'climb' ? ap.VClimb : L.V === 'cruise' ? ap.VCruise : ap.VAppr;
    // P0.8: the fillet is followed over the GROUND (L1 on the ground track),
    // so it is planned at the ground speed a turn can reach — the airspeed
    // plus the wind (the beaver / twin in 2 m/s across crossed the crosswind
    // leg by 190-240 m on a fillet planned in still air); a wider fillet is
    // always flyable, the aeroplane banks a little less
    const wv = windAt(ap.route.to || ap.route.from, 30), wMag = Math.hypot(wv[0], wv[1]);
    const rOf = (Vl, climbing) => (Vl + wMag) * (Vl + wMag) / (9.81 * Math.tan(climbing ? bC : bankLim)) * 1.05;
    if (from) add(from[0], from[1], 0);
    for (let k = 0; k < legs.length; k++) {
      const L = legs[k], N = legs[k + 1];
      if (!L.A || !L.B) continue;
      // a leg's start that is not the previous leg's end is a corner too (the
      // crosswind leg's start, one radius ahead of the aeroplane): it fillets
      if (!nodes.length || Math.hypot(nodes[nodes.length - 1].x - L.A[0], nodes[nodes.length - 1].z - L.A[1]) > 1) add(L.A[0], L.A[1], nodes.length ? rOf(speedOf(L), k === 0 && climbMode) : 0);
      // the corner at B turns into N at the speed the SLOWER of the two legs asks
      const Vc = N ? Math.min(speedOf(L), speedOf(N)) : speedOf(L);
      add(L.B[0], L.B[1], N ? rOf(Vc, k === 0 && climbMode) : 0);
    }
    if (nodes.length < 2) return null;
    let len = 0; for (let k = 1; k < nodes.length; k++) len += Math.hypot(nodes[k].x - nodes[k - 1].x, nodes[k].z - nodes[k - 1].z);
    return patternPath({ nodes, fillet: 0 }, ids, Math.max(5.0, len / 3500), null);   // GP_MAXPTS is 4000
  };

  // ---- the ground planner ---------------------------------------------------------
  // From the pose it is given: the take-off direction, then the route. Every
  // route ends on a hold; every route the follower is handed begins AHEAD of
  // the nose (a U-turn is inserted at the pose when it would not).
  const planDeparture = (cg, nose) => {
    const from = ap.route.from;
    const PAT = ap.patOf(from);
    const half = (from.wid || 30) / 2;
    const need = runNeeded();
    const d0 = [snap(Math.cos(from.hdg)), snap(Math.sin(from.hdg))];
    const rx = cg[0] - from.x, rz = cg[2] - from.z;
    const along = rx * d0[0] + rz * d0[1];
    const cross = -rx * d0[1] + rz * d0[0];
    const onStrip = Math.abs(cross) <= half + 2 && Math.abs(along) <= from.len / 2 + 2;
    const w = windAt(from, 30);
    let t;
    // P1.A: with a runway model the take-off direction is SCORED (the wind,
    // the slope, the climb-out) with the nose as the tie-break; without one,
    // into wind when there is one, else the way the nose points
    const sgN = (nose[0] * d0[0] + nose[1] * d0[1]) >= 0 ? 1 : -1;
    const ahead = from.len / 2 - sgN * along;
    const enough = !onStrip || ahead >= need;                     // the run ahead of the nose suffices
    if (siteModelOf(from)) t = dirAt(from, enough ? nose[0] : -nose[0], enough ? nose[1] : -nose[1], 'takeoff');
    else if (Math.hypot(w[0], w[1]) > 0.7) t = dirAt(from, nose[0], nose[1]);
    else if (enough) t = [d0[0] * sgN, d0[1] * sgN];
    else t = [-d0[0] * sgN, -d0[1] * sgN];
    const T = (t[0] * d0[0] + t[1] * d0[1]) >= 0 ? 0 : 1;
    ap.frame = mkFrame(from, -t[0], -t[1]);
    ap.dirX = -1;
    ap.takeoffDir = t;
    const sPos = rx * t[0] + rz * t[1];
    const runAhead = from.len / 2 - sPos;
    const lined = Math.abs(cross) <= 8 && (nose[0] * t[0] + nose[1] * t[1]) > 0.9;
    if (onStrip && lined && runAhead >= need) {
      ap.path = null; ap.stopAfterLineup = true;
      return 'STOP';
    }
    if (PAT && PAT.routes && typeof patternPath === 'function') {
      let ids = null, nodes = PAT.nodes;
      if (!onStrip) ids = PAT.routes.out[T];
      if (!ids) ids = PAT.routes.back[T];
      if (ids && ids.length) {
        const byId = {}; for (const n of PAT.nodes) byId[n.id] = n;
        const n0 = byId[ids[0]];
        if (n0 && onStrip) {
          const vx = n0.x - cg[0], vz = n0.z - cg[2], vl = Math.hypot(vx, vz) || 1e-9;
          const cosA = (vx * nose[0] + vz * nose[1]) / vl;
          if (cosA < -0.2 && vl > 60) {
            // THE U-TURN AT THE POSE: out to the lane opposite the route's
            // first node, a half-circle of the lane's radius across the
            // strip, back along the node's own lane — the pattern's own
            // U-turn shape (25_airfield.js), drawn where the aeroplane is
            const lane = Math.min(12, half - 2.5);
            const nrm = [-t[1], t[0]];
            const sideN0 = ((n0.x - from.x) * nrm[0] + (n0.z - from.z) * nrm[1]) >= 0 ? 1 : -1;
            const cN = (rx * nrm[0] + rz * nrm[1]);
            const L1 = 30;
            const ua = [cg[0] + nose[0] * L1 + nrm[0] * (-sideN0 * lane - cN),
                        cg[2] + nose[1] * L1 + nrm[1] * (-sideN0 * lane - cN)];
            const ub = [ua[0] + nrm[0] * 2 * sideN0 * lane, ua[1] + nrm[1] * 2 * sideN0 * lane];
            const uc = [ub[0] - nose[0] * 2 * lane, ub[1] - nose[1] * 2 * lane];
            nodes = PAT.nodes.concat([
              { id: '@ua', x: ua[0], z: ua[1], kind: 'taxi', r: lane },
              { id: '@ub', x: ub[0], z: ub[1], kind: 'taxi', r: lane },
              { id: '@uc', x: uc[0], z: uc[1], kind: 'taxi', r: 12 }]);
            ids = ['@ua', '@ub', '@uc'].concat(ids);
          }
        }
        const P2 = Object.assign({}, PAT, { nodes });
        ap.path = patternPath(P2, ids, 1.0, [cg[0], cg[2]]);
        ap.pathI = 0; ap.stopAfterLineup = true;
        return 'TAXI';
      }
    }
    if (!onStrip && ap.taxiOut) {
      const path = ap.taxiOut.map(pp => [pp[0], pp[1]]);
      ap.taxiTgt = path.shift(); ap.taxiPath = path; ap.path = null;
      return 'TAXI';
    }
    const sStart = Math.max(-from.len / 2 + 25, from.len / 2 - need - 25);
    ap.taxiTgt = [from.x + t[0] * sStart, from.z + t[1] * sStart];
    ap.taxiPath = null; ap.path = null;
    return 'TAXI';
  };

  // ---- the status line ----------------------------------------------------------
  const cond = (what, have, want, ok, unit) => ({ what, have, want, ok: !!ok, unit: unit || '' });
  const setStatus = (goal, conds) => {
    const L = PILOT_PHASES[ap.phase] || [ap.phase, ap.phase];
    ap.status = { phase: ap.phase, label: L[0], goal, conds: conds || [], since: phaseT,
                  gaN: ap.gaN, style: ST.name, afcs: ap.afcs,
                  // SKY chantier: the day's night (civil twilight ended); absent without a day
                  night: !!(world && world.day && world.day.isNight) };
  };
  // THE LIGHTS A PILOT FLIES WITH (SKY chantier): navigation lights and the beacon from
  // sunset to sunrise - the rule, read off the day's sun; the cockpit applies them while
  // no hand is on the panel. Absent (null) without a day, so a headless fixture is unchanged.
  ap.lights = null;
  const lightsRule = () => {
    if (!world || !world.day) { ap.lights = null; return; }
    const up = world.day.sunUp;
    if (!ap.lights || ap.lights.nav !== (up ? 0 : 1)) ap.lights = { nav: up ? 0 : 1, beacon: up ? 0 : 1 };
  };

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    lightsRule();
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    if (ap.restAlt === null) {
      ap.restAlt = cg[1]; ap.refAlt = cg[1];
      // G381: the attitude filters start FROM the attitude, not from zero —
      // ROLL read its rest attitude (thRest) off the first filtered frame,
      // which was 0.7 x the truth (attFilt), so a cub's three-point
      // attitude was carried as 6.5 deg instead of 9.2 for the whole flight
      const th0 = Math.asin(clamp(-xA[1], -1, 1)), ph0 = Math.atan2(-zR[1], yU[1]);
      thF = thP = th0; phF = phP = ph0;
    }
    const agl = cg[1] - ap.refAlt;
    const F = ap.frame;
    const rxF = cg[0] - F.ox, rzF = cg[2] - F.oz;
    const sAl = rxF * F.ux + rzF * F.uz;
    const sCr = -rxF * F.uz + rzF * F.ux;
    const o_ = sim.out;
    const Vg = Math.hypot(vcg[0], vcg[1], vcg[2]);
    const Vt = Math.hypot(vcg[0] - (o_.windX || 0), vcg[1] - (o_.windY || 0), vcg[2] - (o_.windZ || 0));
    const V = Vt * (o_.easK || 1);
    const nose = [-xA[0], -xA[2]];
    const nL = Math.hypot(nose[0], nose[1]) || 1e-9;
    nose[0] /= nL; nose[1] /= nL;
    const terrainNow = (world && typeof world.terrainH === 'function') ? groundH(cg[0], cg[2]) : ap.refAlt;   // G418: the surface under the aeroplane, water included
    const aglT = cg[1] - terrainNow;
    // P0.8: THE HEIGHT ABOVE THE GROUND UNDER THE WHEELS — `agl` is the height
    // above one flat datum (the rest height at the spawn), and on a sloped
    // strip that datum meets the ground 770 m before the aim or 34 m above it
    // (G399.1's fixture). aglG subtracts the CG's rest height above the
    // terrain (gearH, measured once at rest) from aglT; without a world it
    // is agl. The flare, the screen height, the balk and the hold-off read it.
    if (gearH == null && world && typeof world.terrainH === 'function') gearH = cg[1] - terrainNow;
    const aglG = (world && typeof world.terrainH === 'function') ? aglT - (gearH || 0) : agl;
    // the surface class and the gradient along the nose, read on the ground
    if (world && typeof world.surface === 'function' && typeof GROUND_SURF === 'object') {
      const sc = world.surface(cg[0], cg[2]); gSurf = GROUND_SURF[sc] || null;
    }
    if (world && typeof world.terrainH === 'function') {
      const nx0 = -xA[0], nz0 = -xA[2], nl0 = Math.hypot(nx0, nz0) || 1;
      gGrade = (groundH(cg[0] + nx0 / nl0 * 40, cg[2] + nz0 / nl0 * 40) - groundH(cg[0] - nx0 / nl0 * 40, cg[2] - nz0 / nl0 * 40)) / 80;   // G418: the surface's grade (level on water)
    }

    let tx = ap.targetDir[0], tz = ap.targetDir[2];
    if (ap.trackHold) {
      const L = ap.phase === 'ROLL' || ap.phase === 'ROLLOUT' || ap.phase === 'ABORT' ? (A.lookRoll ?? 25)
              : ap.phase === 'FINAL' || ap.phase === 'FLARE' ? lookA
              : lookC;
      const fx = ap.dirX * L, fz = -sCr;
      tx = fx * F.ux - fz * F.uz; tz = fx * F.uz + fz * F.ux;
      const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    }
    const e = Math.atan2(tz * nose[0] - tx * nose[1], tx * nose[0] + tz * nose[1]);
    let eA = e;
    const tl2 = Math.hypot(vcg[0], vcg[2]);
    if (tl2 > 5) {
      const tkx = vcg[0] / tl2, tkz = vcg[2] / tl2;
      eA = Math.atan2(tz * tkx - tx * tkz, tx * tkx + tz * tkz);
    }

    const AFt = A.attFilt ?? 1.0;
    const thRaw = Math.asin(clamp(-xA[1], -1, 1));
    const phRaw = Math.atan2(-zR[1], yU[1]);
    if (pendReEng) {
      pendReEng = false;
      thF = thRaw; phF = phRaw; thP = thRaw; phP = phRaw; q = p = 0;
      eP = e; eR = eRslow = 0; eAP = eA; eAR = eARslow = 0;
      vsF = vcg[1]; thCA = thRaw; phCA = 0;
      aDe = sim.ctl.de; aDa = sim.ctl.da; aDr = sim.ctl.dr;
      Ith = 0; It = 0; thcI = 0.06; thrC = A.thrCruise ?? 0.6; IthMax = IthMaxT = 0.15; IthGain = null;
      eTrim = 0; brakeRamp = 0; holdWas = holdActive = false;
      ap.budget = Math.max(ap.budget, ap.t + 400);
    }
    thF += AFt * (thRaw - thF); phF += AFt * (phRaw - phF);
    const th = thF, ph = phF;
    const RF = A.rateFilt ?? 0.12;
    q += RF * ((th - thP) / dt - q); thP = th;
    p += RF * ((ph - phP) / dt - p); phP = ph;
    eR += RF * 0.85 * ((e - eP) / dt - eR); eP = e;
    eRslow += dt / 2.0 * (eR - eRslow);
    eAR += RF * 0.85 * ((eA - eAP) / dt - eAR); eAP = eA;
    eARslow += dt / 2.0 * (eAR - eARslow);
    vsSlow += dt / 2.0 * (vcg[1] - vsSlow);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(Vt, 5);
    if (vPrev !== null) accF += dt / 2.0 * ((V - vPrev) / dt - accF);
    vPrev = V;

    const c = sim.ctl, onG = sim.wheelsOnGround();
    let deFloor = 0;                          // G396.2: the water roll's back-stick floor, read by the servo
    // P0.8: A BUMP IS NOT A TOUCHDOWN — the balk detector wants the wheels
    // on the ground for 0.3 s (a rough strip's contact flickers)
    onGT = onG > 0 ? onGT + dt : 0;
    if (onGT > 0.3 && aglG < A.aglGuard && V < A.VRot * 0.9
        && ['LIFTOFF', 'CLIMB'].includes(ap.phase)) {
      rollN++;
      if (rollN >= 3) {
        say('balked', 'settled back onto the wheels ' + rollN + ' times — keeping it on the ground');
        abortV0 = V; abortS0 = sAl;
        go('ABORT');
      } else {
        say('balked', 'settled back at V=' + V.toFixed(1) + ' — attempt ' + (rollN + 1));
        go('ROLL'); rollS0 = null;
      }
    }
    if (ap.budget && ap.t > ap.budget && !ap.report.outcome && ap.phase !== 'STOPPED') {
      ap.report.outcome = 'gave-up';
      say('gave-up', 'still in ' + ap.phase + ' at t=' + Math.round(ap.t) + ' s — out of patience, not out of sky');
    }

    // ---- THE SERVOS (41_test_pilot.js, verbatim) ----------------------------------
    const holdPitch = (thC) => {
      if (!holdWas) thCA = th;
      holdActive = true;
      const sl = (A.pitchCmdSlew ?? 99) * dt;
      thCA += clamp(thC - thCA, -sl, sl);
      IthMax += clamp(IthMaxT - IthMax, -0.10 * dt, 0.10 * dt);
      Ith = clamp(Ith + (IthGain ?? (A.pitchI ?? 0.05)) * (thCA - th) * dt, -IthMax, IthMax);
      // G396.2: ON THE STEP THE STICK COMES ALL THE WAY BACK. The 0.35 stop
      // is a wheel's rotation (the ground never pins the tail); a planing
      // float rides nose-low against the thrust line and the servo sat on
      // its stop from 20 m/s to a 145 km/h lift-off (Vs 66) — a seaplane
      // pilot holds full back stick until the hull lets go, then eases.
      // Measured on the card: 0.7 lifts at 102 km/h, the fixture at 86.
      const deTop = (sim.hydro && onG > 0) ? (A.deWater ?? 0.70) : 0.35;
      c.de = clamp((A.pitchP ?? 1.2) * pitchK * (thCA - th) - (A.pitchD ?? 1.8) * pitchDK * q + Ith, -0.30, deTop);
      if (deFloor > 0 && deFloor > c.de) c.de = deFloor;   // (a zero floor is no floor: it clamped every nose-down command on every aeroplane for one build)
    };
    // the roll servo alone: a bank command in, the aileron and the yaw damper out
    const rollTo = (phC) => {
      phCA += clamp(phC - phCA, -(A.bankSlew ?? 0.18) * dt, (A.bankSlew ?? 0.18) * dt);
      c.da = clamp((A.rollP ?? 2.0) * (phCA - ph) - (A.rollD ?? 2.0) * p, -0.30, 0.30);
      c.dr = clamp(-(A.betaK ?? 0.3) * beta - (A.yawDampK ?? 0.6) * (eAR - eARslow)
                   - (A.ariK ?? 0.35) * c.da, -0.25, 0.25);
    };
    // ---- L1 OVER THE PATH (P0.6, PILOT-ROADMAP §6.1) --------------------------
    // Park, Deyst and How's nonlinear guidance (AIAA GNC 2004), the law
    // ArduPilot flies: a reference point on the path L1 ahead of the nearest
    // point, eta the angle from the ground-track vector to it, the lateral
    // acceleration 2 V^2 sin(eta) / L1 — one equation for a line and an arc
    // (on an arc it returns V^2 / R exactly), so the fly-by is a property of
    // the PATH (the fillet patternPath drew at the planned radius), not a
    // runtime heuristic. L1 = 4 V
    // (ArduPilot's period 17 s, damping 0.75: L1 = zeta T V / pi), floored
    // at 60 m. The bank goes to the roll servo; the yaw damper is unchanged.
    // Measured by the matrix (G399.3): the G381 arc, open-loop at a fixed
    // bank, crossed the downwind by 639 m on the C172 (its roll loop
    // limit-cycling 9-22 deg around 23) and 378-502 m on the stearman.
    const pathFollow = (bl) => {
      if (!airPath || !airPath.pts.length) return false;
      let L = pathLocate(airPath, airPathI, cg[0], cg[2]);
      const P = airPath.pts;
      const Vg2 = Math.max(o_.Vg ?? Vg, 8);
      const L1 = Math.max(60, 4.0 * Vg2);
      // P1 (found on the A3 cross-countries: every archetype flew away
      // from the strip for 900 s): the locate window is 60 points (300 m)
      // about the last index — an aeroplane that left the path during the
      // climb-out hold was 4 km off it, the window held the path's START,
      // the reference sat BEHIND the aeroplane, sin(eta) ~ 0 and L1 asked
      // for nothing. Far off the path the whole path is searched, and the
      // capture is L1's own: the reference L1 ahead of the nearest point
      // with the range floored at L1 — |eta| past 90 deg is the bank limit
      // toward the path, the way Park's law captures from any side
      if (L.dist > 2 * L1) { L = pathLocate(airPath, airPathI, cg[0], cg[2], true); }
      airPathI = L.i;
      let j = L.i;
      const s0 = P[L.i].s;
      while (j < P.length - 1 && P[j].s - s0 < L1) j++;
      const rx = P[j].x - cg[0], rz = P[j].z - cg[2], rl = Math.hypot(rx, rz) || 1e-9;
      const tx = vcg[0] / Math.max(tl2, 1e-6), tz = vcg[2] / Math.max(tl2, 1e-6);
      const eta = tl2 > 3 ? clamp(Math.atan2(rz * tx - rx * tz, rx * tx + rz * tz), -1.5708, 1.5708) : 0;
      // on a circle of radius R the reference L1 ahead sits at sin(eta) =
      // L1 / 2R, so the law returns V^2 / R by itself: the arc's centripetal
      // acceleration is NOT added again (a first cut did, and the cub rolled
      // to its limit at the start of every fillet, turned inside the arc and
      // crossed the leg by 67 m on the far side)
      const aL1 = 2 * Vg2 * Vg2 * Math.sin(eta) / clamp(rl, 20, L1);
      const phC = clamp(Math.atan(aL1 / 9.81), -bl, bl);
      rollTo(phC);
      pathDbg = { i: L.i, ey: L.ey, sRem: L.sRem, eta, kap: P[L.i].kap, phC };
      return true;
    };
    const airLateral = (bl = bankLim) => {
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
      if (Math.abs(eA) < 0.2) eTrim = clamp(eTrim + 0.15 * eA * dt, -0.10, 0.10);
      else eTrim -= 0.8 * eTrim * dt;
      const phC = clamp((A.hdgP ?? 0.7) * eA + (A.hdgD ?? 0.9) * eAR + eTrim, -bl, bl);
      rollTo(phC);
    };
    const speedThrottle = (Vtgt) => {
      It = clamp(It + 0.010 * (Vtgt - V) * dt, -0.30, 0.30);
      // G381: a term on the measured acceleration (accF, the 2 s filter)
      // damps the 40 s speed hunt the approach flew (+/-2 m/s, throttle
      // 0.15..0.63 on the cub); 0 keeps the G352 law to the bit
      const base = thrC + 0.05 * (Vtgt - V) - (A.spdD ?? 0.25) * accF, lo = A.thrFloor ?? 0.12;
      // G352: anti-windup — on a stop, the integrator holds the stop's value
      if (base + It < lo) It = lo - base;
      else if (base + It > 1) It = 1 - base;
      c.thr = clamp(base + It, lo, 1);
    };
    const holdVS = (VSc, thMax = 0.16) => {
      vsF += (A.vsFilt ?? 1.0) * (vcg[1] - vsF);
      const fl = A.vsFloor ?? -0.08;
      thcI = clamp(thcI + (A.vsI ?? 0.015) * (VSc - vsF) * dt, fl, thMax);
      holdPitch(clamp(thcI + (A.vsP ?? 0.010) * (VSc - vsF), fl, thMax));
    };
    // ---- TECS (P0.5, PILOT-ROADMAP §6.1) — ONE LONGITUDINAL LAW ------------
    // Lambregts' Total Energy Control System (AIAA 1983), the form ArduPilot
    // and PX4 fly: the THROTTLE commands the rate of the aeroplane's total
    // specific energy (height + V^2/2g, in metres of climb per second), the
    // ELEVATOR commands how that energy is DISTRIBUTED between height and
    // speed. Climb, level, descent, the slope, the approach: one law, two
    // references (a height or a vertical speed, and an airspeed); when the
    // throttle saturates the speed weight moves to the elevator by itself,
    // which is what the FLC/ALT switching, the level latch and the power
    // assist were each doing by hand.
    //   STE' = h' + V V'/g            (measured; V' the 2 s acceleration filter)
    //   demand: h'c from the height error (a 5 s time constant) or given;
    //           V'c from the speed error (a 3 s time constant), both bounded
    //           by the SHEET's limits — climbMax at full throttle, the sink
    //           at idle from the glide (44_machine_sheet.js)
    //   throttle = feed-forward (the sheet: cruise throttle for level, 1 at
    //           climbMax, the floor at the idle sink) + P + I on the STE'
    //           error, the integrator held at the stops (G352's rule)
    //   pitch   = the trim attitude at this speed (a 1/V^2 fit through the
    //           two MEASURED trims, cruise and approach) + the demanded flight
    //           path angle from the energy BALANCE rate + P + I on its error;
    //           the existing pitch servo (holdPitch) flies it — the servo the
    //           G201 pass proved on 25 archetypes, unchanged
    //   speed weight wK: 1 balanced; toward 2 (speed on the elevator) as the
    //           throttle saturates or the speed falls under 1.1 Vs0; 0 would
    //           be height only (unused)
    // Gains are DIMENSIONLESS over the sheet (rule 8): the throttle P is half
    // the feed-forward slope, its I a quarter of that per second; the pitch P
    // and I are angles per unit flight-path error. Nothing per aeroplane.
    const SH = sheetOf();
    const tClimbMax = Math.max(0.5, SH && SH.climbMax != null ? SH.climbMax : (A.VClimb || 20) * 0.08);
    const tSinkIdle = Math.max(0.8, SH && SH.sinkBg != null ? SH.sinkBg : (A.VAppr || 20) * 0.09);
    const tThrCruise = A.thrCruise ?? 0.6, tThrFloor = A.thrFloor ?? 0.12;
    const tVs0 = SH && SH.Vs0 != null ? SH.Vs0 : (A.VRot || 18) / 0.99;
    // the trim attitude at speed V: alpha = a0 + k / V^2 through (Vcruise, alphaCruise) and (VAppr, alphaAppr)
    const tAlphaAt = (() => {
      const g = def.params.gen || {};
      const V1 = A.VCruise || 30, V2 = A.VAppr || 22, a1 = g.alphaCruise ?? 0.05, a2 = g.alphaAppr ?? 0.12;
      const k = (a2 - a1) / (1 / (V2 * V2) - 1 / (V1 * V1) || 1e-9), a0 = a1 - k / (V1 * V1);
      return Vv => clamp(a0 + k / Math.max(Vv * Vv, 25), -0.05, (A.thMax ?? 0.2) + 0.05);
    })();
    const tecs = (o) => {
      // o: { ias, alt | vs | gs (the slope from the aim), thMax, vsUp, vsDn }
      const g9 = 9.81;
      if (!tOn) { tOn = true; tIthr = clamp(c.thr - tThrCruise, -0.3, 0.3); tIpit = 0; tHdot = vcg[1]; tWk = 1; }
      tHdot += 0.5 * (vcg[1] - tHdot);
      // G399.7: A SPEED THE ELEVATOR CANNOT HOLD IS RAISED, NOT CHASED. The
      // sheet's Vref (1.30 Vs0) is the textbook speed; an aeroplane whose
      // elevator runs out of nose-up authority at idle (the Caravan-alike:
      // de 0.30-0.35, V stuck at 31.8 against a 29.2 reference) carries a
      // permanent speed error, and in TECS a permanent speed error poisons
      // the ENERGY demand — the throttle sat at its floor 35 m below the
      // slope, asking to slow down more than to climb, and the aeroplane
      // went around for terrain every time. While the elevator sits on its
      // stop nose-up with the speed above the reference, the reference is
      // raised (0.5 m/s per second, at most a quarter of Vref) — the
      // approach the MACHINE can fly, said once on the record. The planner
      // will read this off the sheet (elevIdle) when the bench measures it.
      const eSat = aDe > 0.30 && V > (o.ias || A.VAppr) + 0.5;
      tDeSatT = eSat ? tDeSatT + dt : Math.max(0, tDeSatT - dt);
      if (tDeSatT > 1.5) tVAdapt = Math.min(tVAdapt + 0.5 * dt, 0.25 * (o.ias || A.VAppr));
      if (tVAdapt > 0.5 && !tVAdaptSaid) { tVAdaptSaid = true; say('vref-raised', 'the elevator cannot hold ' + (o.ias || A.VAppr).toFixed(1) + ' m/s at this power — flying the approach faster'); }
      const Vc = Math.max((o.ias || A.VAppr) + tVAdapt, 1.05 * tVs0);
      // the demands
      const vsUp = o.vsUp ?? tClimbMax, vsDn = o.vsDn ?? -Math.max(3.0, 1.5 * tSinkIdle);
      let hdotC;
      if (o.vs != null) hdotC = o.vs;
      else if (o.gs != null) {
        const d = ap.xAim - sAl, hGS = aimAlt() + Math.max(0, d) * o.gs;
        hdotC = -(o_.Vg ?? V) * o.gs + 0.2 * (hGS - cg[1]);
      } else hdotC = 0.2 * ((o.alt ?? cg[1]) - cg[1]);
      hdotC = clamp(hdotC, vsDn, vsUp);
      const VdotC = clamp(0.33 * (Vc - V), -1.5, 1.5);
      // P1.B: THE SPEED TERM CANNOT CANCEL A SATURATED HEIGHT DEMAND. Asked
      // to slow 3 m/s while 170 m below its height (the CLIMB's Vy+ into
      // the route's Vy) the speed term (-3.2 m/s of energy rate) outweighed
      // the full-climb demand (+2.93) and the throttle sat at 0.4 with the
      // hill rising under the aeroplane (A3's departure). With the height
      // demand on its stop the speed term may take at most half of it: the
      // throttle stays near the stop and the excess speed is traded for
      // height by the elevator (the balance loop asks exactly that)
      let sKdot = V * VdotC / g9;
      if (hdotC >= 0.95 * vsUp) sKdot = Math.max(sKdot, -0.5 * hdotC);
      else if (hdotC <= 0.95 * vsDn) sKdot = Math.min(sKdot, -0.5 * hdotC);
      const STEr = tHdot + V * accF / g9, STErC = hdotC + sKdot;
      // the throttle: feed-forward from the sheet, P + I on the energy-rate error
      const ff = STErC >= 0 ? tThrCruise + STErC / tClimbMax * (1 - tThrCruise)
                            : tThrCruise + STErC / tSinkIdle * (tThrCruise - tThrFloor);
      const kP = 0.5 * (1 - tThrCruise) / tClimbMax, kI = 0.25 * kP;
      const eT = STErC - STEr;
      const raw = ff + kP * eT + tIthr;
      if ((raw > 1 && eT > 0) || (raw < tThrFloor && eT < 0)) { /* held at the stop */ }
      else tIthr = clamp(tIthr + kI * eT * dt, -0.4, 0.4);
      c.thr = clamp(ff + kP * eT + tIthr, tThrFloor, 1);
      // the speed weight: toward the elevator as the throttle saturates or the speed is low
      // the weight when the throttle is on a stop: under 1.1 Vs0 the speed
      // is the elevator's whatever the reference; in a CLIMB (a vs reference,
      // full throttle by design) the speed is the elevator's too (Vy, the
      // climb rate is what the thrust allows); holding a HEIGHT or a SLOPE
      // with the throttle at its stop the height is the elevator's and the
      // speed settles where the thrust allows — GATE PILOT's FAST card (45
      // m/s the cub does not have) had it pitch down for a speed it could
      // never reach and fly the circuit into the ground
      const satHi = c.thr >= 0.99, satLo = c.thr <= tThrFloor + 0.005;
      const wKt = V < 1.1 * tVs0 ? 2
                : (o.vs != null && satHi && Vc - V > 1) ? 2
                : (satHi && Vc - V > 1) ? 0
                : (satLo && V - Vc > 1 && o.vs == null) ? 0.5
                : 1;
      tWk += clamp(wKt - tWk, -0.5 * dt, 0.5 * dt);
      // the balance: pitch = trim(V) + gamma demanded + P + I on the balance-rate error
      const SEBr = (2 - tWk) * tHdot - tWk * V * accF / g9, SEBrC = (2 - tWk) * hdotC - tWk * V * VdotC / g9;
      const eB = (SEBrC - SEBr) / Math.max(V, 8);
      tIpit = clamp(tIpit + 0.15 * eB * dt, -0.10, 0.10);
      const gammaC = (tWk < 1.99 ? hdotC / Math.max(V, 8) : 0);
      const thC = clamp(tAlphaAt(V) + gammaC + 0.8 * eB + tIpit, A.vsFloor ?? -0.08, o.thMax ?? A.thMax);
      holdPitch(thC);
      tecsDbg = { hdotC, Vc, STEr, STErC, ff, thr: c.thr, wK: tWk, thC, eB };
    };
    const groundSteer = () => {
      // H4 (G393): ON THE WATER the split is displacement / on the step
      // (wheelsOnGround reads 3 / 2 for exactly that), the water rudder is
      // up on the step and the air rudder alone holds the run, and there is
      // no castor to over-control: the pedals go to the stop either way.
      // Measured on the ultralight in a 5 m/s crosswind: with the
      // taildragger's 0.45 clamp it weathervaned 40 deg on the step and left
      // the lane 186 m off; with this, see the H4 entry.
      const onWater = !!(sim.hydro);
      // P1.D: the tail is up when the TAILWHEEL is off the ground
      // (sim.wheelContacts), not when the pitch says so — banked 8 deg on
      // one main at a three-point attitude the cub read "tail down", the
      // rudder was clamped to the tailwheel's 0.45 and the nose swung 32 deg
      // before the tail touched
      const WC = typeof sim.wheelContacts === 'function' ? sim.wheelContacts() : null;
      // (GATE TAKEOFF reads this line by regex: the tail-state schedule first)
      const tailUp = rotateTD && !onWater && (WC ? (!WC.tw && onG >= 1) : (onG <= 2 && thRest !== null && (thRest - th) > 0.04))
                  || (onWater && onG <= 2 && V > 6);
      // P1.D: the tail-down rudder stop is the TAILWHEEL's (0.45 keeps a
      // swerve out of the taxi), and it climbs with the speed to the full
      // pedal by VTailUp — at 19 m/s three-point in 4 m/s gusting across
      // the beaver weathervaned 31 deg each way on 0.45 of rudder that the
      // fin alone could have held
      const vTU = A.VTailUp ?? 12;
      const drMax = tailUp ? 0.95 : (onWater ? 0.9 : clamp(0.45 + 0.5 * V / vTU, 0.45, 0.95));
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
      const kS = trike ? clamp(((A.VSteer ?? 12) / Math.max(V, 5)) ** 2, A.steerMin ?? 0.30, 1.0)
               : clamp(((A.VTailUp ?? 12) / Math.max(V, 5)) ** 2, A.steerMin ?? 0.30, 1.0);
      const kM = Math.sqrt(Math.max(200, sim.totalM || 500) / 500);
      const kP = (tailUp
        ? 3.2 * 1.4 * clamp(((A.VTailUp ?? 12) / Math.max(V, 5)) ** 2, 0.6, 2.0)
        : 3.2 * kS) / kM;
      // P1.D: the heading gain falls and the damping rises with the square
      // root of the mass — the yaw inertia grows with it, the tailwheel's
      // moment does not, and a loop tuned on a 480 kg cub rang a 2 t beaver
      // at 10-19 m/s (+-35 deg at a 4 s period in 4 m/s gusting across)
      const kD = (tailUp ? 3.0 : 1.2 * (trike ? Math.sqrt(kS) : kS)) * kM;
      c.dr = clamp(-kP * e - kD * eR, -drMax, drMax);
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
      const wX = -(o_.windX || 0) * F.uz + (o_.windZ || 0) * F.ux;
      // On a tricycle the reference is VSteer, not VTailUp (99, which pinned
      // the clamp at 1.6 and asked 8 deg of bank at 2 m/s — the aeroplane ran
      // on one main from 15 m/s and left the strip 10 m off in the game's
      // "wind 4 + gusts"). And on three wheels the bias is a token: a trike
      // takes off wings-level and crabbed, the tyres hold it; the full
      // wing-low bias belongs after the nosewheel is off.
      const vRef = trike ? (A.VSteer ?? 12) : (A.VTailUp ?? 12);
      let phW = (A.xwBank ?? 0.06) * wX * clamp(vRef / Math.max(V, 6), 0.4, 1.6);
      // P1.D: ON THE WHEELS THE BANK COMES OFF — every type. The wing-low
      // target (xwBank x the crosswind, 8-11 deg in 4 m/s across) is the
      // decrab's, for the air; held on the ground it lifted the downwind
      // main and the cub ground-looped 96 deg on one wheel, the beaver 150
      // (the G431 wing at 3 deg on a three-point roll runs light). With
      // both mains down the target is the ground's own bank within 2 deg
      // into wind; the roll loop on the measured bank keeps the upwind
      // wing down against the crosswind's own rolling moment; from the FIRST
      // main down on a taildragger (the wing-low touchdown lands one wheel)
      if (!onWater && onG >= (trike ? 3 : 1)) phW = clamp(phW, -(A.xwBankGround ?? 0.035), A.xwBankGround ?? 0.035);
      c.da = clamp(-2.0 * (ph - phW) - 1.0 * p, -0.30, 0.30);
      tailUpNow = tailUp;
    };
    const taxi = (Vtgt) => {
      c.de = A.taxiDe ?? 0.30;
      const ff = taxiFF();
      const cap = Math.min(A.taxiThrMax ?? 0.85, GP.cap);
      if (ap.t - taxiLastT > 2) taxiI = 0;
      taxiLastT = ap.t;
      const err = Vtgt - Vg;
      const u0 = ff + 0.18 * err + taxiI;
      if ((err > 0 && u0 < cap) || (err < 0 && u0 > 0))
        taxiI = clamp(taxiI + 0.10 * err * dt, -ff, cap);
      c.thr = clamp(ff + 0.18 * err + taxiI, 0, cap);
      c.brake = Vg > Vtgt + 0.8 ? clamp(0.3 * (Vg - Vtgt - 0.8), 0, 0.6) : 0;
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
    };
    const vsAgl = v => aglG < A.hSafe ? Math.max(v, 1.0) : v;
    const taxiV = (A.taxiV ?? 5.0) * ST.taxiK;

    // ---- THE AFCS: modes and selected targets --------------------------------------
    // The phase below SELECTS; `apply` at the end flies. Lateral modes that
    // steer by the landing frame set trackHold for the next frame's error.
    const AF = ap.afcs;
    const SEL = AF.sel;
    const engage = (lat, vert, thr, sel) => {
      AF.lat = lat; AF.vert = vert; AF.thr = thr;
      if (sel) Object.assign(SEL, sel);
      ap.trackHold = (lat === 'LOC' || lat === 'RWY' || lat === 'DECRAB');
    };
    // NAV: pursuit along a leg with a lookahead; done at the turn-anticipation
    // distance before the corner into the next leg (R tan(dTheta/2))
    const navLeg = (L, look, nextL) => {
      const g = legGeom(L);
      const rx = cg[0] - L.A[0], rz = cg[2] - L.A[1];
      const s = rx * g.ux + rz * g.uz;
      const px = L.A[0] + g.ux * (s + look), pz = L.A[1] + g.uz * (s + look);
      const ddx = px - cg[0], ddz = pz - cg[2], dl = Math.hypot(ddx, ddz) || 1e-9;
      SEL.navDir = [ddx / dl, 0, ddz / dl];
      const rem = g.len - s;
      let ant = 0;
      if (nextL && nextL.A) {
        const g2 = legGeom(nextL);
        const dot = clamp(g.ux * g2.ux + g.uz * g2.uz, -1, 1);
        // G381: the fly-by distance from the GROUND speed at the bank the
        // arc will fly, plus half the roll-in (the bank reaches its limit
        // bankLim/bankSlew seconds after the switch)
        const bA = climbMode ? Math.min(bankLim, A.bankClimb ?? 0.35) : bankLim;
        const Rg = Math.max(Vg, 8) ** 2 / (9.81 * Math.tan(bA));
        ant = Rg * Math.tan(Math.min(Math.acos(dot), 2.6) / 2) + 0.5 * Vg * bA / (A.bankSlew ?? 0.18);
      }
      return { done: rem <= ant, rem, xt: -rx * g.uz + rz * g.ux, s, len: g.len };
    };
    const apply = () => {
      // thrust
      switch (AF.thr) {
        case 'FULL': c.thr = 1; c.brake = 0; break;
        case 'IDLE': c.thr = SEL.idle ?? 0; break;
        case 'SET': c.thr = SEL.thr ?? 0; break;
        case 'SPD': speedThrottle(SEL.ias); break;
        case 'TAXI': taxi(SEL.gsp); break;
        default: break;
      }
      // vertical
      switch (AF.vert) {
        case 'ALT': holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (SEL.alt - cg[1]), SEL.vsDn ?? -3.0, SEL.vsUp ?? 2.2))); break;
        case 'VS': holdVS(SEL.vs, SEL.thMax ?? 0.16); break;
        case 'FLC': holdPitch(clamp(A.climbThBase + A.climbThGain * (V - SEL.ias), 0.02, A.thMax)); break;
        case 'GS': {
          const d = ap.xAim - sAl;
          const hGS = aimAlt() + Math.max(0, d) * SEL.gs;
          holdVS(clamp(-(o_.Vg ?? V) * SEL.gs + 0.12 * (hGS - cg[1]), Math.min(-3.0, -1.6 * V * SEL.gs), 0.5));
          break;
        }
        case 'PITCH': holdPitch(SEL.pitch); break;
        case 'DE': c.de = SEL.de; break;
        case 'TECS': tecs(SEL); break;                 // P0.5: the throttle is this law's too
        default: break;
      }
      if (AF.vert !== 'TECS') tOn = false;
      // lateral
      switch (AF.lat) {
        case 'HDG': ap.targetDir = [Math.cos(SEL.hdg), 0, Math.sin(SEL.hdg)]; airLateral(SEL.bank ?? bankLim); break;
        case 'TRK': {
          const ddx = SEL.trk[0] - cg[0], ddz = SEL.trk[1] - cg[2], dl = Math.hypot(ddx, ddz) || 1e-9;
          ap.targetDir = [ddx / dl, 0, ddz / dl]; airLateral(SEL.bank ?? bankLim); break;
        }
        case 'NAV': ap.targetDir = SEL.navDir || ap.targetDir; airLateral(SEL.bank ?? bankLim); break;
        case 'PATH': if (!pathFollow(SEL.bank ?? bankLim)) { ap.targetDir = SEL.navDir || ap.targetDir; airLateral(SEL.bank ?? bankLim); } break;   // P0.6
        case 'LOC': airLateral(SEL.bank ?? bankLim); break;
        case 'DECRAB': {
          airLateral(0.12);
          // G381: THE RUDDER WENT THE WRONG WAY. This kicked the crab off with
          // -K x (the nose's angle FROM the runway), while groundSteer, the
          // proven loop, steers with -K x e, and e is the runway's angle from
          // the nose — the opposite sign. Measured on the cub in a 2 m/s
          // crosswind: a 7 deg crab became a 16 deg swing in the hold-off
          // and the rollout opened with the rudder on its stop. The same
          // law as the ground's now, on the same error (which also carries
          // the centreline correction trackHold folds into e).
          c.dr = clamp(-(A.decrabK ?? 2.2) * e - 0.6 * eR, -0.35, 0.35);
          break;
        }
        case 'RWY': groundSteer(); break;
        case 'TAXI': c.dr = SEL.dr; break;   // the follower's rudder (da from the governor)
        case 'NONE': c.dr = 0; c.da = 0; break;
        default: break;
      }
      // G381.1: POWER WHEN THE ELEVATOR RUNS OUT. On the approach and in the
      // flare, an aeroplane whose elevator sits on its nose-up stop cannot
      // hold the slope or the hold-off at idle — the drawn-tail Caravan-alike
      // fell 3 m/s below a 2.2 deg slope with de at 0.35 and went around
      // twice for the terrain; the C172-alike mushed on at 0.99 Vs with full
      // flap, de on its stop, at 1.9 m/s. What a pilot does is add power: the
      // slipstream gives the tail its authority back and the thrust carries
      // the sink. The assist winds up while the elevator is past 0.30
      // (0.35 is the stop), unwinds once it is back under 0.22, is capped at
      // `apAssistMax` (0.40) and is ADDED to whatever the thrust mode set —
      // the speed hold's floor, the flare's idle. It never fires when the
      // elevator has room, so every aeroplane that flies its approach at
      // idle is unchanged.
      if (ap.phase === 'FLARE' && AF.thr === 'IDLE') {   // G399.7: FINAL's half retired — TECS carries its own saturation (the raised Vref)
        const sat = aDe > 0.30, free = aDe < 0.22;
        // in the flare the assist depends on the SPEED: a slow arrival (the
        // C172-alike at 1.13 VRot, full flap) needs the power to finish its
        // hold-off (1.9 -> 1.0 m/s); a fast one (the Caravan-alike at 1.6
        // VRot, no flap, the tail out of authority) only floats on it — 836 m
        // of run, stopped 8 m from the end — so it gets a trickle (0.12: 0.59 m/s, 669 m; at 0.05 it arrived at 2.3 m/s)
        const fast = V > 1.35 * (A.VRot || 18);
        const cap = ap.phase === 'FLARE' ? (fast ? (A.apAssistFlareFast ?? 0.12) : (A.apAssistFlare ?? 0.30))
                  : (A.apAssistMax ?? 0.40);
        pAsst = clamp(pAsst + (sat ? (A.apAssistRate ?? 0.20) : free ? -0.25 : 0) * dt, 0, cap);
        if (pAsst > 0) c.thr = clamp(c.thr + pAsst, 0, 1);
      } else pAsst = 0;
      AF.fd = { pitch: thCA, bank: phCA };
    };

    // ---- the pilot's own helpers ---------------------------------------------------
    // climb-or-level on a leg: FLC + FULL until near the target, then ALT + SPD;
    // a ceiling that will not come is ACCEPTED, said once
    const altMode = (hTgtAbs, Vlevel, bl, nav) => {
      const dh = hTgtAbs - cg[1];
      // P0.5: ONE LAW — the height demand saturates at the sheet's climbMax
      // (full throttle) and the speed weight moves to the elevator by
      // itself; climbMode is kept as a REPORT (the ceiling check, the card)
      if (climbMode && dh < 8) climbMode = false; else if (!climbMode && dh > 40) climbMode = true;
      engage(nav, 'TECS', 'TECS', { alt: hTgtAbs, vs: null, gs: null, vsUp: null, vsDn: null, ias: climbMode ? ap.VClimb : Vlevel, bank: climbMode ? Math.min(bl, A.bankClimb ?? 0.35) : bl });
      if (climbMode) {
        ceilT += dt;
        const stalled = ceilT > 60 && vsSlow < 0.15, marginal = ceilT > 75 && vsSlow < 0.4;
        if ((stalled || marginal) && !ceilingSaid) {
          ceilingSaid = true;
          say(stalled ? 'wont-climb' : 'ceiling-accepted', (stalled ? 'no climb left (' : 'still climbing ') + vsSlow.toFixed(2) +
              (stalled ? ' m/s) — accepting ' : ' m/s — flying the circuit at ') + Math.round(cg[1] - ap.altRef) + ' m');
          ap.hCruise = Math.max(A.hSafe + 10, cg[1] - ap.altRef);
          if (ap.plan) ap.plan.hC = ap.hCruise;
          climbMode = false;
        }
      } else ceilT = 0;
    };
    const legAlt = (L) => {
      const g = legGeom(L);
      const base = ap.altRef + (L.h != null ? L.h : ap.hCruise);
      const floor = terrainAhead(cg[0], cg[2], g.ux, g.uz, 1500) + Math.max(2 * A.hSafe, 40);
      return Math.max(base, floor);
    };
    const legSpeed = (L) => L.V === 'turn' ? VTurn : L.V === 'climb' ? ap.VClimb : ap.VCruise;
    const goAround = why => {
      ap.gaN = (ap.gaN || 0) + 1; ap.gaWhy = why;
      say('go-around', why + ' (attempt ' + ap.gaN + ')');
      go('GOAROUND'); gaT = 0; finalLevel = null; tVAdapt = 0; tDeSatT = 0;
      thrC = A.thrCruise; thLift0 = th;
    };
    // the arrival at the destination, planned from where the aeroplane is now
    const planFromHere = () => {
      const { from, to } = ap.route;
      const climbDir = [F.ux * ap.dirX, 0, F.uz * ap.dirX];
      let u;
      if (ap.xc) u = dirAt(to, to.x - cg[0], to.z - cg[2]);
      // P1.A: the circuit lands the SCORED direction (the wind, the slope,
      // the obstacles) with the climb-out as the preference — on a flat strip
      // in calm air that is the way it took off; on a hillside the other way
      else if (siteModelOf(to)) u = dirAt(to, climbDir[0], climbDir[2], 'land');
      else u = ap.takeoffDir || [F.ux * ap.dirX, F.uz * ap.dirX];
      const P = planArrival(to, u, from);
      const FL = P.F;
      const sNow = alongOf(FL, cg), cNow = leftOf(FL, cg);
      // P1: the crosswind form is the CLIMB-OUT's — the aeroplane near the
      // extended centreline; resumed anywhere else (the AP box handed back
      // over the next valley) the arrival is joined the cross-country way
      if (!ap.xc && Math.abs(cNow) < 0.5 * P.W) {
        // G381: the crosswind leg begins where the ARC ends — one turn
        // radius ahead at the climbing bank — and the arc is armed from the
        // climb-out direction, so the aeroplane rolls out ON the leg
        // instead of R inside it
        const bC = Math.min(bankLim, A.bankClimb ?? 0.35);
        const Rc = (1.05 * Math.max(V, 8)) ** 2 / (9.81 * Math.tan(bC)) + 0.5 * V * bC / (A.bankSlew ?? 0.18);
        // P1.A: "ahead" is along the climb-out — when the landing runs the
        // other way (s falls as the aeroplane flies) the crosswind leg sits
        // one radius DOWN the frame, and the downwind that follows is flown
        // the way the aeroplane already flies: a jog out to W, no reversal
        const dirS = (u[0] * climbDir[0] + u[1] * climbDir[2]) >= 0 ? 1 : -1;
        const sA = sNow + dirS * Rc;
        startLegs([{ name: 'CROSSWIND', A: wp(FL, sA, 0), B: wp(FL, sA, P.side * P.W), h: P.hC, V: 'cruise' }]
          .concat(patternLegs(P, sA, P.side)));
        return 'CROSSWIND';
      }
      const toIaf = wp(FL, P.sIaf, 0);
      const vx = toIaf[0] - cg[0], vz = toIaf[1] - cg[2], vl = Math.hypot(vx, vz) || 1e-9;
      const cosA = (vx * FL.ux + vz * FL.uz) / vl;
      const straightIn = sNow < P.sIaf - 300 && cosA > 0.5;
      // P1: the first leg begins two turn radii AHEAD along the track, the
      // path from the aeroplane — the turn onto the leg is a corner the
      // path fillets (a leg through the aeroplane's own position, flown at
      // 100 deg to it, read 300 m of overshoot on every cross-country)
      const tl0 = Math.hypot(vcg[0], vcg[2]);
      const Rc2 = 2 * (1.05 * Math.max(V, 8)) ** 2 / (9.81 * Math.tan(bankLim));
      const ahead = tl0 > 3 ? [cg[0] + vcg[0] / tl0 * Rc2, cg[2] + vcg[2] / tl0 * Rc2] : [cg[0], cg[2]];
      if (straightIn) {
        startLegs([{ name: 'INBOUND', A: ahead, B: toIaf, h: P.hC, V: 'cruise', enroute: true },
                   { name: 'FINAL', A: toIaf, B: wp(FL, P.sAim, 0) }]);
      } else {
        // the join from the side the aeroplane arrives on, unless the plan's side is forced (P1.A)
        const side = P.sideForced ? P.side : Math.abs(cNow) < 100 ? P.side : (cNow > 0 ? 1 : -1);
        const sJoin = P.sAim + Math.max(400, 2 * Rturn);
        const entry = wp(FL, sJoin, side * P.W);
        startLegs([{ name: 'ENROUTE', A: ahead, B: entry, h: P.hC, V: 'cruise', enroute: true }]
          .concat(patternLegs(P, sJoin, side)));
      }
      if (tl0 > 3) pathFrom = [cg[0], cg[2]];
      ap.holdDir = climbDir;
      return ap.legs[0].name;
    };
    // the far end of the strip along the take-off direction, from the record
    const runwayLeft = () => {
      const from = ap.route.from;
      const t = ap.takeoffDir || [F.ux * ap.dirX, F.uz * ap.dirX];
      const ex = from.x + t[0] * from.len / 2, ez = from.z + t[1] * from.len / 2;
      return (ex - cg[0]) * t[0] + (ez - cg[2]) * t[1];
    };
    const FS = def.params.flaps;
    const flapsTo = (tgt) => {
      if (!FS) return;
      const rr = (FS.rate ?? 0.15) * dt;
      c.flap = clamp(c.flap + clamp(tgt - c.flap, -rr, rr), 0, 1);
    };
    let flapTgt = 0;
    const fTO = FS ? (FS.to ?? 0) : 0, fLDG = FS ? (FS.ldg ?? 1) : 0;

    // THE AP BOX flies instead of the phases while it is on; a disengage
    // resumes the pilot at a phase that fits where the aeroplane is
    const BX = ap.box;
    if (!BX.on && BX.resume) {
      const r = BX.resume; BX.resume = null;
      go(r === 'auto' ? (onG > 0 ? 'ROLLOUT' : 'CLIMB') : r);
      if (ap.phase === 'CLIMB') { climbMode = true; ceilT = 0; }
    }
    const boxFly = () => {
      if (ap.nav) ap.nav.update(cg[0], cg[2], vcg[0], vcg[2], Rturn);
      AF.lat = BX.lat || 'OFF'; AF.vert = BX.vert || 'OFF'; AF.thr = BX.thr || 'OFF';
      Object.assign(SEL, BX.sel);
      ap.trackHold = (AF.lat === 'LOC' || AF.lat === 'RWY');
      if (AF.lat === 'NAV') {
        const Lg = ap.nav && ap.nav.leg();
        if (Lg) navLeg({ A: Lg.A, B: Lg.B }, lookC, null); else AF.lat = 'OFF';
      }
      if (AF.lat === 'TRK' && !SEL.trk) AF.lat = 'OFF';
      apply();
      ap.budget = Math.max(ap.budget, ap.t + 300);
      const R = ap.nav && ap.nav.last;
      const hdgNow = PILOT_UNITS.deg(Math.atan2(nose[1], nose[0]));
      const conds = [];
      if (AF.vert === 'ALT') conds.push(cond('altitude', Math.round(cg[1]), Math.round(SEL.alt), Math.abs(cg[1] - SEL.alt) < 8, 'm'));
      else if (AF.vert === 'VS') conds.push(cond('vs', vcg[1], SEL.vs, Math.abs(vcg[1] - SEL.vs) < 0.4, 'm/s'));
      else if (AF.vert === 'FLC') conds.push(cond('airspeed', V, SEL.ias, Math.abs(V - SEL.ias) < 2, 'm/s'));
      if (AF.lat === 'HDG') conds.push(cond('heading', Math.round(hdgNow), Math.round(PILOT_UNITS.deg(SEL.hdg)), Math.abs(navDiff(hdgNow, PILOT_UNITS.deg(SEL.hdg))) < 3, 'deg'));
      else if (AF.lat === 'NAV' && R) conds.push(cond('xtk', Math.round(R.xtk), 50, Math.abs(R.xtk) < 50, 'm'));
      if (AF.thr === 'SPD') conds.push(cond('airspeed', V, SEL.ias, Math.abs(V - SEL.ias) < 2, 'm/s'));
      setStatus('AP box: ' + AF.lat + ' ' + AF.vert + ' ' + AF.thr, conds);
    };
    if (BX.on) boxFly(); else
    switch (ap.phase) {
      case 'DEPART': {
        // the panel arc: the pilot runs the checklist — mags on, engine
        // running — writing exactly what the cockpit key writes, so a key
        // the hand turned off comes back on when the pilot takes over
        if (sim.setEngine && sim.eng)
          for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
        const next = planDeparture(cg, nose);
        engage('NONE', 'DE', 'SET', { de: A.taxiDe ?? 0.30, thr: 0 });
        go(next === 'STOP' ? (Vg < 0.3 ? 'HOLD' : 'STOP') : 'TAXI');
        setStatus('planning the departure', []);
        break;
      }

      case 'TAXI': {
        if (ap.path) {
          const L = pathLocate(ap.path, ap.pathI, cg[0], cg[2]);
          ap.pathI = L.i; taxiXT = L.ey; taxiSRem = L.sRem;
          const K = pathLook(ap.path, L.i, Vg);
          const eXT = clamp(Math.atan2(0.9 * L.ey, Vg + 1.0), -0.6, 0.6);
          const hT = K.hdgL - eXT;
          ap.targetDir = [Math.cos(hT), 0, Math.sin(hT)];
          const drFF = -Math.atan(TW.Lwb * K.kapL) / Math.max(0.05, TW.steer);
          const drMaxG = 0.85 - 0.40 * clamp((Vg - 6) / 4, 0, 1);
          // a long straight (a backtrack) is taxied faster; the bend ahead
          // and the stop still govern through pathSpeed
          const vMax = L.sRem > 150 && Math.abs(L.ey) < 2 ? Math.min(A.taxiVFast ?? 8, 1.6 * taxiV) : taxiV;
          engage('TAXI', 'DE', 'TAXI', { dr: clamp(-3.2 * e - 1.2 * eR + drFF, -drMaxG, drMaxG),
                                          de: A.taxiDe ?? 0.30, gsp: pathSpeed(ap.path, L.i, Vg, vMax, L.sRem) });
          const tMax = 40 + 1.6 * ap.path.len / taxiV;
          setStatus('following the taxi route to the hold', [
            cond('to the hold', Math.round(L.sRem), 2, L.sRem < 2, 'm'),
            cond('off the line', Math.abs(L.ey), 2.5, Math.abs(L.ey) < 2.5, 'm')]);
          if (L.sRem < 2.0 || (L.sRem < 6 && Vg < 0.6)) go('STOP');
          else if (phaseT > tMax) { say('taxi-timeout', 'the route took ' + Math.round(phaseT) + ' s — stopping where it is'); go('STOP'); }
          break;
        }
        const ddx = ap.taxiTgt[0] - cg[0], ddz = ap.taxiTgt[1] - cg[2];
        const dist = Math.hypot(ddx, ddz) || 1e-9;
        ap.targetDir = [ddx / dist, 0, ddz / dist];
        engage('TAXI', 'DE', 'TAXI', { dr: clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45), de: A.taxiDe ?? 0.30,
                                        gsp: Math.abs(e) > 0.6 ? 2.5 : taxiV });
        const lastLeg = !(ap.taxiPath && ap.taxiPath.length);
        setStatus('taxiing to the next point', [cond('to the point', Math.round(dist), lastLeg ? 22 : 10, false, 'm')]);
        if (dist < (lastLeg ? 22 : 10) || phaseT > 120) {
          if (lastLeg) go('LINEUP');
          else { ap.taxiTgt = ap.taxiPath.shift(); phaseT = 0; }
        }
        break;
      }

      case 'LINEUP': {
        const alig = -(nose[0] * F.ux + nose[1] * F.uz);
        engage('TAXI', 'DE', 'TAXI', { dr: clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45), de: A.taxiDe ?? 0.30,
                                        gsp: alig > 0.5 ? 4.5 : 2.4 });
        ap.trackHold = true;
        setStatus('lining up on the centreline', [
          cond('off centre', Math.abs(sCr), 8, Math.abs(sCr) < 8, 'm'),
          cond('aligned', Math.round(Math.acos(clamp(alig, -1, 1)) * 57.3), 9, alig > 0.988, 'deg')]);
        if (alig > 0.988 && Math.abs(sCr) < 8 && Math.abs(eR) < 0.15) {
          if (ap.stopAfterLineup) { go('STOP'); break; }
          go('ROLL'); ap.t = Math.max(ap.t, 1); rollS0 = null;
        } else if (phaseT > 60) { say('lineup-timeout', 'could not line up in 60 s — stopping to replan'); go('STOP'); }
        break;
      }

      case 'STOP': {
        let dr = 0;
        if (ap.path && Vg > 1.0) {
          const L = pathLocate(ap.path, ap.pathI, cg[0], cg[2]);
          ap.pathI = L.i; taxiXT = L.ey; taxiSRem = L.sRem;
          const K = pathLook(ap.path, L.i, Vg);
          ap.targetDir = [Math.cos(K.hdgL), 0, Math.sin(K.hdgL)];
          dr = clamp(-3.2 * e - 1.2 * eR, -0.85, 0.85);
        }
        engage('TAXI', 'DE', 'SET', { dr, de: A.taxiDe ?? 0.30, thr: 0 });
        c.brake = 0.7; c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
        setStatus('braking to a standstill', [cond('ground speed', Vg, 0.3, Vg < 0.3, 'm/s')]);
        if (Vg < 0.3 || phaseT > 30) go('HOLD');
        break;
      }
      case 'HOLD': {
        engage('NONE', 'DE', 'SET', { de: A.taxiDe ?? 0.30, thr: 0.3 * taxiFF() });
        c.brake = 0.5;
        const alig = -(nose[0] * F.ux + nose[1] * F.uz);
        const lined = alig > 0.9945 && Math.abs(sCr) < 2.5;
        const left = runwayLeft();
        // the run it wants; on a short field, most of the field is the most
        // it can have, and the roll's own accelerate-stop call judges the rest
        const need = Math.min(runNeeded(), 0.7 * (ap.route.from.len || 1100));
        setStatus('holding: checking the line-up and the run ahead', [
          cond('off centre', Math.abs(sCr), 2.5, Math.abs(sCr) < 2.5, 'm'),
          cond('aligned', Math.round(Math.acos(clamp(alig, -1, 1)) * 57.3), 6, alig > 0.9945, 'deg'),
          cond('runway ahead', Math.round(left), Math.round(need), left >= need, 'm')]);
        if (phaseT >= (A.holdS ?? 2.0)) {
          const half = (ap.route.from.wid || 30) / 2;
          const onStrip = Math.abs(sCr) <= half - 1;
          if ((lined || (holdN >= 2 && onStrip && alig > 0.95)) && left >= need) {
            go('ROLL'); ap.t = Math.max(ap.t, 1);
            ap.trackHold = true; thrRoll = GP.cap; thRest = null; rollS0 = null;
          } else if (holdN < 2 && onStrip && left >= need) {
            holdN++;
            ap.stopAfterLineup = true; ap.trackHold = true;
            go('LINEUP');
          } else if (planN < 3) {
            planN++; holdN = 0;
            say('replan', 'not lined up with a run ahead (' + Math.round(left) + ' m, ' +
                Math.abs(sCr).toFixed(1) + ' m off) — planning the departure again');
            go('DEPART');
          } else {
            say('taxi-lost', 'could not reach a lined-up hold in ' + planN + ' plans — giving up on the ground');
            ap.report.outcome = ap.report.outcome || 'gave-up';
            go('STOPPED');
          }
        }
        break;
      }

      case 'ROLL': {
        {
          const capT = V < (A.VTailUp ?? 0) ? GP.cap : 1;
          thrRoll = GP.cap < 1
            ? Math.min(capT, Math.max(thrRoll, GP.cap) + (1 - GP.cap) / (A.thrRampS ?? 2) * dt)
            : capT;
        }
        if (thRest === null) thRest = th;
        if (rollS0 === null) {
          rollS0 = sAl; committedTO = false;
          // P1.C: THE DEPARTURE PLAN (PILOT-ROADMAP C.3-C.4), the approach
          // plan's twin: 'short' when the strip is under 2 x the sheet's
          // take-off run (an accelerate-stop wants about two runs) — the
          // brakes held until the power is up, the take-off asked to FIT
          // rather than the stop, the climb
          // at Vx while anything ahead stands above the aeroplane; 'soft'
          // when the surface rolls hard (GROUND_SURF 0.10) — the tail kept
          // down (a trike's nose light), unstuck early at 0.95 Vr, held in
          // ground effect until Vy before climbing; 'normal' otherwise.
          // Every departure climbs at Vx until the ground ahead is below it
          // (C.3, the obstacle-clearance climb), then Vy.
          const from0 = ap.route.from;
          // ON THE WATER neither applies (GATE SEAPLANE, found by the vehicles
          // session): the water's 0.35 rolling row read as "soft", the stick
          // went to the tail-down schedule and the hump law (H4) lost the
          // floatplane 780 m off its lane — the water has its own laws
          const onWaterNow = !!sim.hydro || from0.surface === 4;
          const row = (typeof GROUND_SURF === 'object' && GROUND_SURF[from0.surface]) || null;
          const soft = !onWaterNow && !!row && row[0] >= 0.10;
          const runNeed = SH0 && SH0.TORun ? SH0.TORun : null;
          const short = !onWaterNow && runNeed != null && (from0.len || 1100) < 2.0 * runNeed;   // an accelerate-stop wants about two runs
          ap.dep = { technique: short ? 'short' : soft ? 'soft' : 'normal', Vx: SH0 && SH0.Vx ? Math.round(SH0.Vx * 10) / 10 : null,
                     runNeed: runNeed != null ? Math.round(runNeed) : null, len: from0.len || null, surface: from0.surface };
          ap.report.dep = ap.dep;
        }
        flapTgt = fTO;
        const runUsed = Math.abs(sAl - rollS0);
        const left = runwayLeft();
        const vr = A.VRot || 18;
        const avail = ap.route.from.len || 1100;
        const sd = stopDist(V);
        // THE ACCELERATE-STOP CALL, and V1. While a stop on the strip is still
        // possible (left − sd ≥ reserve) any of five rules rejects, each said
        // with its numbers: the measured acceleration cannot reach Vr in what
        // is left; a set fraction of the strip used without Vr; not
        // accelerating; ON THE WHEELS WELL PAST Vr (rotated and not unsticking
        // — measured in the game on a 703 kg A-65 build: Vr at 22, rolling at
        // 25 with the tail up, off the end of the strip with every rule quiet
        // because every rule asked V < Vr first). Past that point the take-off
        // is COMMITTED like a real one past V1 — except that a strip which
        // ends under an aeroplane still rolling is a rejection with the fence
        // in it, said as such.
        let reject = null;
        const canStopHere = left - sd >= ST.reserve;
        // G396.4: THE HUMP IS NOT A FAILED RUN. A seaplane at the hump reads
        // 0.1 m/s^2 for twenty seconds and then planes (the single 582:
        // 8.5 m/s from t 10 to 22, on the step at 24, unstuck at 35); the
        // accelerate-stop planner condemned it at 13 s. In the displacement
        // regime (the afterbody wet) the planner waits; on the step it judges.
        const atHump = !!(sim.hydro && sim.hydro.floats.some(fx => fx.out && fx.out.wetA > 0.2));
        if (canStopHere) {
          // the prediction waits for the 2 s acceleration filter to settle
          // (three time constants after the throttle opens): at 3 s a slow
          // build read a third of its true acceleration and was condemned —
          // the Tiger Moth-alike on a hot day, 0.10 m/s^2 against 0.3 real
          if (V < vr && phaseT > 7 && accF > 0.02 && !atHump) {
            const dVr = (vr * vr - V * V) / (2 * accF);
            // P1.C short: the take-off must FIT, the stop is not asked (the
            // accelerate-stop is the long strip's luxury; on 340 m of gravel
            // the cub rejected at 7 s a run the sheet says it makes)
            const shortT = ap.dep && ap.dep.technique === 'short';
            if (dVr > left - (shortT ? 0 : stopDist(vr)) - ST.reserve)
              reject = 'will not reach Vr: ' + accF.toFixed(2) + ' m/s^2 needs ' +
                       Math.round(dVr) + ' m more, ' + Math.round(left) + ' m left';
          }
          // THE USER'S RULE, whatever the speed: "if the lift has not been
          // achieved within a certain point, let's just drop it". A speed
          // rule ("on the wheels well past Vr") was tried and condemned the
          // stock build: Vr is the DERIVED rotation (0.99 Vs, G159) and the
          // aeroplane unsticks at 1.4-1.5 Vr, 4-8 s later, on every build.
          // ...of the run AVAILABLE from where the roll began (a hold sits
          // 110 m in), not of the strip: measured, the 60 % of the strip came
          // 5 m AFTER the point of no stopping on a 990 m run
          if (!reject && runUsed > ST.rejectFrac * (runUsed + left))
            reject = Math.round(runUsed) + ' m used (' + Math.round(ST.rejectFrac * 100) +
                     ' % of the run) still on the wheels at V=' + V.toFixed(1) + (V >= vr ? ' past Vr=' + vr.toFixed(1) : ' of Vr=' + vr.toFixed(1)) +
                     ' (the sheet says ' + Math.round(A.TORun ?? 0) + ' m) — dropping it';
          if (!reject && phaseT > 8 && accF < 0.08 && V < 0.8 * vr && !atHump)
            reject = 'not accelerating (' + accF.toFixed(2) + ' m/s^2 at V=' + V.toFixed(1) + ') — thrust is going nowhere';
        } else if (V < vr) {
          // P1.C: PAST THE POINT OF STOPPING THE QUESTION IS WHETHER VR
          // COMES BEFORE THE FENCE, not whether a stop still fits (it does
          // not, by definition): the cub on 340 m of gravel was rejected at
          // 17.3 of 18.7 m/s with 217 m left, the C172 at 19.3 of 20.4 with
          // 249 m — both a second from flying
          const dVr = accF > 0.02 ? (vr * vr - V * V) / (2 * accF) : Infinity;
          if (dVr > left - ST.reserve)
            reject = 'out of runway: ' + Math.round(left) + ' m left, Vr in ' + (isFinite(dVr) ? Math.round(dVr) + ' m' : 'no distance (not accelerating)') +
                     ', V=' + V.toFixed(1) + ' of ' + vr.toFixed(1) + ' needed';
          else if (!committedTO) {
            committedTO = true;
            say('committed-takeoff', 'past the point of stopping at V=' + V.toFixed(1) + ' with ' + Math.round(left) + ' m left — Vr in ' + Math.round(dVr) + ' m, continuing');
          }
        } else if (left < 0) {
          reject = 'ran off the end at V=' + V.toFixed(1) + ' still on the wheels — will not unstick';
        } else if (!committedTO) {
          committedTO = true;
          say('committed-takeoff', 'past the point of stopping at V=' + V.toFixed(1) + ' with ' + Math.round(left) + ' m left — continuing');
        }
        setStatus('accelerating to rotation speed', [
          cond('airspeed', V, vr, V >= vr, 'm/s'),
          cond('runway left', Math.round(left), Math.round(sd + ST.reserve), left - sd >= ST.reserve, 'm'),
          cond('accel', accF, 0.08, accF >= 0.08, 'm/s²')]);
        if (reject) {
          say('rejected-takeoff', reject);
          abortV0 = V; abortS0 = sAl;
          go('ABORT');
          break;
        }
        // the rotation: a taildragger's tail-up / three-point schedule, a
        // tricycle's nosewheel up at Vr — every aeroplane rotates
        let vert = 'DE', pitch = 0, deRoll = A.rollDe;
        const softTO = ap.dep && ap.dep.technique === 'soft', shortTO = ap.dep && ap.dep.technique === 'short';
        const vrT = softTO ? 0.95 * vr : vr;                   // P1.C soft: unstuck early, into ground effect
        if (rotateTD) {
          vert = 'PITCH';
          pitch = V > vrT ? (A.thRotate ?? A.liftoffTh)
                : (threePoint || softTO || V < (A.VTailUp ?? 0)) ? ((threePoint || softTO) ? Math.min(thRest, A.liftoffTh) : (A.thTailUp ?? 0.02))
                : (A.thTailUp ?? 0.02);
        } else if (V > vrT) { vert = 'PITCH'; pitch = A.thRotate ?? A.liftoffTh; }
        else if (softTO) deRoll = 0.20;                        // P1.C soft, a trike: the nosewheel light through the roll
        const rotating = vert === 'PITCH' && V > vrT && onG > 0;
        IthMaxT = rotating ? (A.rotateIMax ?? 0.30) : 0.15;
        IthGain = rotating ? (A.rotateI ?? 0.8) : null;
        engage('RWY', vert, 'SET', { pitch, de: deRoll, thr: ap.t > 0.5 ? thrRoll : 0 });
        // P1.C short: the brakes hold the aeroplane until the power is up
        if (shortTO && V < 1.5 && thrRoll < Math.min(0.98, (V < (A.VTailUp ?? 0) ? GP.cap : 1) - 0.02)) c.brake = A.brakeMax;
        // G396.2: ON THE WATER, FULL BACK STICK THROUGH THE HUMP AND OFF THE
        // STEP. The attitude servo asks for the lift-off pitch and its gains
        // (an air loop) reach 0.38 of stick, which a planing float ignores:
        // the card rode the step nose-low to a 145 km/h lift-off (Vs 66).
        // A seaplane pilot holds the stick back from the hump until the hull
        // lets go; the servo eases it from there. Measured: 102 km/h.
        // G396.4: THE STICK ON THE WATER, in three parts. Through the hump and
        // onto the step the elevator is NEUTRAL — never forward: the
        // taildragger's tail-up law pushed 0.15-0.21 of forward stick on the
        // single 582, the hull planed nose-low at 14 m/s and porpoised to
        // 33 deg (a real float's lower trim limit); and never back either,
        // which buried the sterns and sank it back into the hump. From ON
        // THE STEP, at Vr (0.8 Vr ballooned the single 582 to 31 deg at 14 m/s and it fell back), the stick comes all the way back to unstick.
        if (sim.hydro && onG > 0) deFloor = V > (A.vWaterStick ?? 1.0) * vr ? (A.deWater ?? 0.70) : 0.02;
        c.brake = 0;
        if (onG === 0 && V > vr) { go('LIFTOFF'); thLift0 = th; IthMaxT = 0.15; IthGain = null; }
        break;
      }

      case 'ABORT': {
        IthMaxT = 0.15; IthGain = null;
        engage('RWY', 'DE', 'SET', { thr: 0, de: trike ? 0.15 : (V > (A.VTailDown ?? A.VTailUp) ? -0.05 : 0.35) });
        brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        const left = runwayLeft();
        setStatus('rejected: braking on the strip', [
          cond('ground speed', Vg, A.VStop, Vg < A.VStop, 'm/s'),
          cond('runway left', Math.round(left), 0, left > 0, 'm')]);
        if (Vg < A.VStop || phaseT > 90) {
          ap.report.outcome = ap.report.outcome || 'rejected-takeoff';
          if (abortV0 != null) ap.report.abort = {
            V0: Math.round(abortV0 * 10) / 10, run: Math.round(Math.abs(sAl - abortS0)),
            left: Math.round(left), onStrip: left > 0 && Math.abs(sCr) < (ap.route.from.wid || 30) / 2 };
          go('STOPPED');
        }
        break;
      }

      case 'LIFTOFF': {
        // G208.3: above the screen height the lift-off attitude is capped by
        // CLIMB's speed-seeking law, so a slow climber lowers its nose for
        // VClimb instead of climbing for ever 0.5 m/s under VClimbMin (the
        // default garage build did exactly that; see 41_test_pilot.js)
        let thT = Math.min(thLift0 + (A.liftoffRamp ?? 9) * phaseT, A.liftoffTh);
        // G396.2: a seaplane's lift-off is TRIMMED, not held — the thrust line
        // over the CG asks ~0.5 of stick to hold the attitude at 27 m/s, the
        // integrator's 0.15 could not, the nose fell, the floats touched
        // again and it skimmed the step to 145 km/h. The water's own
        // integrator ceiling and gain, until CLIMB.
        // G396.3: ON THE WATER THE HEIGHT IS OVER THE WATER. P0.8's aglG
        // reads the terrain under the CG and the SEA lane's floor runs 15 to
        // 95 m deep along it: a seaplane on the step read 10 m "up" and this
        // phase handed over to CLIMB with the floats wet (the card skimmed to
        // 135 km/h). The sea is the flat datum `agl` was built on.
        const aglL = sim.hydro ? agl : aglG;
        if (sim.hydro && aglL < 2 * A.hSafe) { IthMaxT = A.liftoffIWater ?? 0.35; IthGain = A.rotateI ?? 0.8; }
        // G396.4: THE HOLD-OFF ON THE WATER. LIFTOFF eased the stick to the
        // servo's 0.22 the moment the hull let go, the floats touched again
        // and the card skimmed the step 2 s to 115 km/h where full stick
        // unsticks it at 96: the stick stays back while a float is still
        // wet, and the servo takes over once the aeroplane is clear.
        if (sim.hydro && onG > 0) deFloor = A.deWater ?? 0.70;
        if (aglL > A.hSafe || (ap.dep && ap.dep.technique === 'soft'))   // P1.C soft: the attitude for speed from the first metre — level in ground effect until Vy
          thT = Math.min(thT, clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        engage('LOC', 'PITCH', 'FULL', { pitch: thT, bank: 0.15 });
        flapTgt = fTO;
        const left = runwayLeft();
        setStatus('climbing out of ground effect', [
          cond('height', aglG, A.hSafe, aglG > A.hSafe, 'm'),
          cond('airspeed', V, A.VClimbMin, V > A.VClimbMin, 'm/s')]);
        // THE PUT-DOWN, and V1. A hover in ground effect goes back on the
        // wheels after 25 s (the HOVER fixture) — or at once, while a stop on
        // the strip is STILL POSSIBLE, when it is not climbing and the strip
        // is running out. Past the point of stopping the aeroplane is
        // COMMITTED to the climb, the way a real one is past V1: measured in
        // the game on a marginal build (a 53 s roll to Vr, airborne with
        // 150 m left), the old rule dropped it three seconds after lift-off
        // into the last of the grass, which is the worse of the two ends.
        const lowStuck = aglL < A.hSafe * 0.6;
        const canStop = left > stopDist(V) + 40;
        if ((phaseT > 25 && lowStuck) || (lowStuck && vsSlow < 0.3 && canStop && left - stopDist(V) < 160 && phaseT > 3)) {
          say('wont-climb', 'airborne ' + Math.round(phaseT) + ' s and still at ' + agl.toFixed(1) +
              ' m with ' + Math.round(left) + ' m of strip left — cannot climb out, putting it back down');
          go('PUTDOWN');
          break;
        }
        if (lowStuck && !canStop && !committedTO) {
          committedTO = true;
          say('committed-takeoff', 'airborne with ' + Math.round(left) + ' m of strip left, past the point of stopping — continuing');
        }
        // ...and clearly away (twice the screen height) goes to CLIMB whatever
        // its speed — CLIMB's law finishes the acceleration (G208.3)
        if (aglL > A.hSafe && (V > A.VClimbMin || aglL > 2 * A.hSafe)) {
          go('CLIMB'); climbMode = true; ceilT = 0;
          // G396.2: the water's integrator stays on the water (left in, it
          // hunted the whole circuit: 240 s on final, never down). WATER
          // ONLY: a tricycle's rotation integrator (G250) rides into CLIMB
          // and its approach is tuned with it — reset there, the trike went
          // around "high on the slope" and never landed (GATE PILOT).
          if (sim.hydro) { IthMaxT = 0.15; IthGain = null; }
        }
        break;
      }

      case 'PUTDOWN':
        engage('LOC', 'PITCH', 'IDLE', { pitch: Math.min(th + 0.02, A.flareThMax ?? A.thMax), bank: 0.10, idle: 0 });
        setStatus('putting it back on the wheels', [cond('wheels down', onG, 1, onG > 0, '')]);
        if (onG > 0 || phaseT > 30) {
          ap.report.outcome = ap.report.outcome || 'rejected-takeoff';
          abortV0 = V; abortS0 = sAl;
          go('ABORT');
        }
        break;

      case 'CLIMB': {
        // straight ahead on the runway heading; the circuit turns at hTurn,
        // a cross-country climbs to its cruise height first (W10 rule 3)
        // G381: a CRUISE CLIMB once clear of the screen height — Vy plus a
        // tenth, the nose a little lower — instead of the best-rate attitude
        // held all the way to the circuit (the user: "it climbs like at max
        // speed"); the flaps come up at the same height
        // P1.C (C.3): Vx — the sheet's best angle — while the ground within
        // 1.5 km along the climb-out (canopy included, 15 m clear) stands
        // above the aeroplane; Vy / the cruise-climb once it is below
        const climbDir0 = [F.ux * ap.dirX, F.uz * ap.dirX];
        const obstAhead = SH0 && SH0.Vx && gradAhead(cg[0], cg[2], climbDir0[0], climbDir0[1], 1500, cg[1], 15) > 0;
        if (obstAhead !== vxHeld) { vxHeld = obstAhead; if (obstAhead && !vxSaid) { vxSaid = true; say('vx-climb', 'ground ahead above the aeroplane — climbing at Vx ' + SH0.Vx.toFixed(1) + ' m/s until clear'); } }
        const iasC = obstAhead ? SH0.Vx : agl > 2 * A.hSafe ? Math.min(ap.VCruise, ap.VClimb * (A.climbCruiseK ?? 1.10)) : ap.VClimb;
        engage('LOC', 'TECS', 'TECS', { vs: tClimbMax, alt: null, gs: null, vsUp: null, vsDn: null, ias: iasC, bank: bankLim });   // P0.5: full climb = the sheet's climbMax
        flapTgt = agl > 2 * A.hSafe ? 0 : fTO;
        // G381: the crosswind turn at 0.6 of the circuit height (was 0.35 —
        // 45 m on the cub, "it turns really low"), never above hCruise - 15
        const hTurn = ap.xc ? ap.hCruise - 8
                    : Math.min(ap.hCruise - 15, Math.max(A.hSafe + 10, ST.hTurnK * 0.6 * ap.hCruise));
        const stalled = phaseT > 60 && vsSlow < 0.15, marginal = phaseT > 75 && vsSlow < 0.4;
        setStatus(ap.xc ? 'climbing to cruise height on the runway heading' : 'climbing straight ahead to the crosswind turn', [
          cond('height', Math.round(agl), Math.round(hTurn), agl >= hTurn, 'm'),
          cond('airspeed', V, A.VClimbMin, V > A.VClimbMin, 'm/s')]);
        if (stalled || marginal) {
          if (!ceilingSaid) {
            ceilingSaid = true;
            say(stalled ? 'wont-climb' : 'ceiling-accepted',
                (stalled ? 'no climb left (' : 'still climbing ') + vsSlow.toFixed(2) +
                (stalled ? ' m/s) — accepting ' : ' m/s — flying the circuit at ') + Math.round(agl) + ' m');
          }
          ap.hCruise = Math.max(A.hSafe + 10, agl);
        }
        // P1: THE CLIMB TURNS EARLY WHEN THE GROUND AHEAD ASKS MORE THAN
        // THE AEROPLANE CLIMBS (the obstacle-clearance climb, C.3): past
        // the safe height the straight climb-out is given up for the plan
        // — the circuit's crosswind on the scored side, the route's escape
        // heading — the moment the runway-line ground within 1.5 km needs
        // a gradient over 0.8 of the measured climb, 30 m clear (A3's k1 departure
        // climbed into the 8 % hill with 1.5 m to spare at 122 m)
        const climbDirNow = [F.ux * ap.dirX, F.uz * ap.dirX];
        const terrainTurn = agl > A.hSafe + 10 && gradAhead(cg[0], cg[2], climbDirNow[0], climbDirNow[1], 1500, cg[1], 30) > gammaGA;
        if (terrainTurn && !terrainTurnSaid) { terrainTurnSaid = true; say('terrain-turn', 'the ground ahead climbs faster than the aeroplane — turning at ' + Math.round(agl) + ' m'); }
        if (agl >= hTurn || stalled || marginal || terrainTurn) {
          const first = planFromHere();
          go(first); climbMode = !(stalled || marginal); ceilT = 0;
          if (!climbMode) { thrC = A.thrCruise; thcI = 0.04; }
        }
        break;
      }

      case 'CROSSWIND': case 'DOWNWIND': case 'BASE': case 'ENROUTE': case 'INBOUND': {
        const L = ap.legs && ap.legs[ap.legI];
        if (!L || !L.A) { go(planFromHere()); break; }
        const next = ap.legs[ap.legI + 1];
        const P = ap.plan;
        const r = navLeg(L, L.enroute ? Math.max(lookC, 300) : lookC, next);
        let hTgt;
        if (L.enroute) {
          // cruise at the departure's circuit height (or higher for terrain),
          // descending at ~3 deg onto the destination's circuit height by
          // 800 m before the entry; the climb-out heading is held until
          // within 60 m of the leg height (W10 rule 3)
          const g = legGeom(L);
          const dRem = r.len - r.s;
          const base = ap.altRef + P.hC;
          const cruise = Math.min(base + Math.max(0, dRem - 800) * 0.05,
                                  Math.max(ap.route.from.elev + A.hCruise, base));
          // P0 (PILOT-ROADMAP, found by the matrix): the look-ahead stops at the
          // LEG'S END. It scanned 7.5 km whatever remained, so the cub bound
          // for A3 read the ridge 2 km PAST the strip (292 m) as its floor,
          // arrived over the threshold at 420 m, and went around from 255 m
          // above the slope
          const floor = terrainAhead(cg[0], cg[2], g.ux, g.uz, Math.max(1500, Math.min(7500, dRem))) + (A.hClear ?? 130);
          hTgt = Math.max(cruise, floor);
        } else hTgt = legAlt(L);
        // P1: THE HOLD IS THE OBSTACLE-CLEARANCE CLIMB (PILOT-ROADMAP C.3):
        // while the ground along the leg asks a gradient the aeroplane
        // cannot make from here (0.8 of its measured climb, 30 m clear) the
        // leg is not flown; the heading held is the ESCAPE — of a fan about
        // the climb-out (every 30 deg over +-90) the one whose ground asks
        // the least (1 % of hysteresis toward the one held), and when none
        // can be made the aeroplane CIRCLES toward it, climbing (the valley
        // departure). The runway model's cone, flown live. Held to the LEG
        // HEIGHT (W10 rule 3) the cub bound for A3 flew 4 km the wrong way
        // for a 448 m ridge floor; released at a fixed height it turned onto
        // the ridge and crossed it by 9 m; held on the climb-out heading it
        // flew A3's k1 departure straight into the hill (aglT 0.5 m)
        let gNeed = -1, holdOut = false;
        if (L.enroute && ap.legI === 0 && ap.holdDir && phaseT < 150) {
          const g = legGeom(L);
          gNeed = gradAhead(cg[0], cg[2], g.ux, g.uz, Math.max(1500, Math.min(7500, r.len - r.s)), cg[1], 30);
          if (gNeed > gammaGA) {
            holdOut = true;
            const h0 = Math.atan2(ap.holdDir[2], ap.holdDir[0]);
            let best = null;
            for (let k = -3; k <= 3; k++) {
              const h = h0 + k * Math.PI / 6;
              let gk = gradAhead(cg[0], cg[2], Math.cos(h), Math.sin(h), 1500, cg[1], 30);
              if (escapeHdg != null && Math.abs(Math.atan2(Math.sin(h - escapeHdg), Math.cos(h - escapeHdg))) < 0.1) gk -= 0.01;
              if (!best || gk < best.g) best = { h, g: gk };
            }
            escapeHdg = best.h; escapeCircle = best.g > gammaGA;
            if (escapeCircle) {
              // no heading can be made: a climbing turn toward the least bad
              // one — the selected heading stays 50 deg ahead of the track
              const trk = Math.atan2(vcg[2], vcg[0]), toward = Math.atan2(Math.sin(best.h - trk), Math.cos(best.h - trk));
              escapeHdg = trk + (toward >= 0 ? 0.87 : -0.87);
            }
            ap.escape = { hdg: Math.round(escapeHdg * 57.3), need: Math.round(gNeed * 1000) / 10, best: Math.round(best.g * 1000) / 10, circle: escapeCircle };
          }
        }
        if (!holdOut) { escapeHdg = null; escapeCircle = false; }
        // P1: the climb-out hold carried the aeroplane kilometres from the
        // enroute leg's start (its own take-off position); when the hold
        // ends the leg begins where the aeroplane is, and the path with it
        // — two radii AHEAD along the track, so the turn onto the leg is a
        // corner the path fillets (a leg through the aeroplane's own
        // position, flown the other way, read 308 m of "overshoot" on the
        // turn-back); the path starts at the aeroplane
        if (heldOut && !holdOut && L.enroute && ap.legI === 0) {
          const tl = Math.hypot(vcg[0], vcg[2]) || 1, Rc2 = 2 * (1.05 * Math.max(V, 8)) ** 2 / (9.81 * Math.tan(bankLim));
          L.A = [cg[0] + vcg[0] / tl * Rc2, cg[2] + vcg[2] / tl * Rc2]; airPath = null; pathFrom = [cg[0], cg[2]];
        }
        heldOut = !!holdOut;
        // P0.6: the path is built once per leg list and followed by L1; the
        // G381 arc + pursuit stay behind `path: false`
        if (!airPath) { airPath = buildAirPath(ap.legs, ap.legs[0] && ap.legs[0].name === 'CROSSWIND' ? [cg[0], cg[2]] : pathFrom); airPathI = 0; pathFrom = null; }
        const onPath = !!airPath && !holdOut;
        altMode(hTgt, legSpeed(L), bankLim, holdOut ? 'HDG' : onPath ? 'PATH' : 'NAV');
        if (holdOut) SEL.hdg = escapeHdg;
        flapTgt = 0;
        // the card is judged on the settled downwind (41_test_pilot.js)
        if (cardAcc && ap.phase === 'DOWNWIND' && !climbMode && phaseT > 8) {
          cardAcc.n += dt;
          cardAcc.alt += (cg[1] - ap.altRef) * dt;
          cardAcc.V += V * dt;
          const cd = ap.report.card;
          cd.altFlown = Math.round(cardAcc.alt / cardAcc.n);
          cd.VFlown = Math.round(cardAcc.V / cardAcc.n * 10) / 10;
          if (!cardAcc.saidV && cd.V && phaseT > 25 && V < cd.V * 0.93 && c.thr > 0.97) {
            cardAcc.saidV = true;
            say('cant-hold-speed', 'full throttle holds ' + Math.round(V * 3.6) + ' of the ' + Math.round(cd.V * 3.6) + ' km/h asked');
          }
        }
        const tLeg = r.len / Math.max(8, legSpeed(L) * 0.8) + 40;
        setStatus(L.enroute ? 'enroute to the pattern entry' : 'flying the ' + L.name.toLowerCase() + ' leg', [
          cond('to the turn', Math.round(r.rem), 0, r.done, 'm'),
          cond('height', Math.round(cg[1] - ap.altRef), Math.round(hTgt - ap.altRef), Math.abs(hTgt - cg[1]) < 12, 'm'),
          cond('off track', Math.round(Math.abs(r.xt)), 50, Math.abs(r.xt) < 50, 'm')]);
        if (r.done || phaseT > 2.5 * tLeg) {
          if (!r.done) say('leg-timeout', L.name + ' took ' + Math.round(phaseT) + ' s — moving to ' + (next ? next.name : 'FINAL'));
          ap.legI++;
          const N = ap.legs[ap.legI];
          if (!N || N.name === 'FINAL') {
            ap.trackHold = true; ap.dirX = 1;
            slopeCaptured = false; finalT0 = ap.t; thrC = A.thrAppr;
            finalLevel = null;                    // G381: latched on entry
            go('FINAL');
          } else go(N.name);
        }
        break;
      }

      case 'FINAL': {
        // level at the height it has until the slope rises to meet it, then
        // GS on groundspeed feed-forward; flaps go down here; SPD on the
        // throttle at the approach speed
        ap.dirX = 1;
        const d = ap.xAim - sAl;
        const hGS = aimAlt() + Math.max(0, d) * ap.gs;
        const above = cg[1] - hGS;
        if (!slopeCaptured && above < 4) slopeCaptured = true;
        // G381: THE LEVEL SEGMENT IS LATCHED — its target was min(cg[1],
        // hGS + 10) re-read every tick, so a sag was never corrected (25 m
        // on the cub, then a climb back into the slope). And THE BANK: the
        // base-to-final turn is the arc's (bankLim) until the nose is on the
        // course, then the planned limit while still off the centreline,
        // then the tracking bank of 0.18 — the 10 deg cap alone could not
        // finish a turn planned at 23 and crossed the centreline by 147 m.
        if (finalLevel == null) finalLevel = Math.min(cg[1], hGS + 10);
        // P0.6: the last fillet (base -> final) is the path's; LOC takes over
        // once the nose is within 11 deg of the runway and 60 m of the line
        const nS = nose[0] * F.ux + nose[1] * F.uz;
        const onPathF = !!airPath && !(nS > Math.cos(0.19) && Math.abs(sCr) < 60);
        const bF = onPathF ? bankLim : Math.abs(sCr) > 60 ? Math.min(bankLim, 0.30) : 0.18;
        const latF = onPathF ? 'PATH' : 'LOC';
        // the approach speed is asked from the leg change, through the turn
        // (keeping the base speed through the arc arrived on the slope 6 m/s
        // fast on the Caravan-alike, whose drawn tail cannot hold the nose
        // up at idle — the elevator on its stop, 3 m/s below a 2.2 deg
        // slope, two terrain go-arounds; GATE ARCHETYPES)
        const iasF = ap.VAppr * ST.VapprK;
        // P0.5: the slope and the level before it are two references of the one law
        if (slopeCaptured || above < 0) engage(latF, 'TECS', 'TECS', { gs: ap.gs, alt: null, vs: null, ias: iasF, bank: bF, vsUp: 1.5, vsDn: Math.min(-3.0, -1.6 * V * ap.gs) });
        // ABOVE THE SLOPE ON ENTRY (G434, the hill strip on Jolene): the enroute leg's clearance over
        // the ground under it (hClear) had left the aeroplane 30 m over the pattern height, the
        // level was latched THERE and the slope, descending to the aim, only fell away under it -
        // "high on the slope" at 534 m out, twice, on a strip it could have landed on. Above the
        // slope by more than the capture window the target is the SLOPE itself, descended onto at
        // half again the slope's own rate; the latched level is for the aeroplane the slope rises
        // to meet (the branch above)
        else if (above > 4) engage(latF, 'TECS', 'TECS', { alt: hGS, vs: null, gs: null, ias: iasF, bank: bF, vsUp: 1.5, vsDn: Math.min(-3.0, -2.4 * V * ap.gs) });
        else engage(latF, 'TECS', 'TECS', { alt: finalLevel, vs: null, gs: null, ias: iasF, bank: bF, vsUp: 1.5, vsDn: Math.min(-3.0, -1.6 * V * ap.gs) });
        ap.trackHold = !onPathF;
        if (!onPathF) airPath = null;
        flapTgt = fLDG;
        const canGA = (ap.gaN || 0) < 2 && !committed;
        setStatus(slopeCaptured ? 'down the slope to the aim point' : 'level, waiting for the slope', [
          cond('to the aim', Math.round(d), 0, d <= 0, 'm'),
          cond('above slope', Math.round(above), ST.gaHigh, above < ST.gaHigh, 'm'),
          cond('off centre', Math.round(Math.abs(sCr)), ST.gaXT, Math.abs(sCr) < ST.gaXT, 'm'),
          cond('flare at', aglG.toFixed(1), A.flareAgl, aglG < A.flareAgl, 'm')]);
        gaT = above > ST.gaHigh && d < 600 ? gaT + dt : 0;
        if (gaT > 3) { if (canGA) { goAround('high on the slope ' + Math.round(d) + ' m out'); break; }
                       else if (!committed) { committed = true; say('committed-landing', 'high but committed'); } }
        if (d < 250 && d > 0 && Math.abs(sCr) > ST.gaXT) {
          if (canGA) { goAround('off the centreline by ' + Math.round(Math.abs(sCr)) + ' m on short final'); break; }
          else if (!committed) { committed = true; say('committed-landing', 'off centre but committed'); }
        }
        if (world && d > 400 && canGA && aglT < 15) { goAround('terrain under the approach'); break; }
        if (d <= -150 && agl > A.flareAgl * 3) {
          if (canGA) { goAround('past the aim at ' + Math.round(agl) + ' m'); break; }
          if (!committed) { committed = true; say('committed-landing', 'past the aim at ' + Math.round(agl) + ' m agl — landing it'); }
        }
        if (ap.t - finalT0 > 240 && canGA) { goAround('final took ' + Math.round(ap.t - finalT0) + ' s'); break; }
        // G381: the hold-off begins 1.3x higher than the ramp did — it has a
        // sink to arrest AND a speed to bleed, and the pull takes a second to bite
        if (aglG < (A.flareK ?? 1.3) * A.flareAgl) {
          go('FLARE'); thFlare0 = th;
          // G381: the hold-off's timescale (continuous with the sink it
          // arrives with), its cap (the three-point attitude on a
          // taildragger, thMax on a tricycle), its integrator and filter
          flTau = clamp(A.flareAgl / Math.max(0.5, -vcg[1]), 2.0, 4.5);
          flCap = trike ? A.thMax
                : Math.min(A.thMax, (thRest != null ? thRest : A.liftoffTh) + (A.flareOverRest ?? 0.035));
          flCap = Math.max(flCap, thFlare0 + 0.03);
          flI = 0; flVsF = vcg[1];
        }
        break;
      }

      case 'GOAROUND': {
        // full power, flaps to the take-off setting, straight ahead on the
        // runway heading to the crosswind height, then the circuit again
        ap.dirX = 1;
        engage('LOC', 'TECS', 'TECS', { vs: tClimbMax, alt: null, gs: null, vsUp: null, vsDn: null, ias: ap.VClimb, bank: 0.20 });
        flapTgt = fTO;
        const hTurn = Math.min(ap.hCruise - 15, Math.max(A.hSafe + 10, ST.hTurnK * 0.6 * ap.hCruise));
        setStatus('going around: climbing on the runway heading', [
          cond('height', Math.round(agl), Math.round(hTurn), agl >= hTurn, 'm')]);
        if (agl >= hTurn || (phaseT > 60 && vsSlow < 0.15)) {
          ap.takeoffDir = [F.ux, F.uz];
          ap.xc = false;
          go(planFromHere()); climbMode = true; ceilT = 0;
        }
        break;
      }

      case 'FLARE': {
        flapTgt = fLDG;
        const to = ap.route.to;
        const left = (to.x + F.ux * to.len / 2 - cg[0]) * F.ux + (to.z + F.uz * to.len / 2 - cg[2]) * F.uz;
        setStatus('flaring', [cond('wheels down', onG, 1, onG > 0, ''), cond('runway left', Math.round(left), 0, left > 0, 'm')]);
        if (phaseT > 20 && left < 2 * stopDist(V) + 100 && (ap.gaN || 0) < 2 && !committed) { pitchK = pitchDK = 1; IthMaxT = 0.15; IthGain = null; goAround('floating with ' + Math.round(left) + ' m left'); break; }
        const decrab = agl < (A.decrabAgl ?? 3.5) && Math.abs(o_.windZ || 0) + Math.abs(o_.windX || 0) > 0.5;
        if (A.flareMode === 'vs')
          engage(decrab ? 'DECRAB' : 'LOC', 'VS', 'IDLE', { vs: -(0.15 + 0.28 * Math.max(0, agl)), thMax: A.flareThMax ?? A.thMax, bank: 0.10, idle: A.flareThr ?? 0 });
        else if (A.flareMode === 'ramp')
          engage(decrab ? 'DECRAB' : 'LOC', 'PITCH', 'IDLE', { pitch: Math.min(thFlare0 + A.flareRate * phaseT, A.flareThMax ?? A.thMax), bank: 0.10, idle: A.flareThr ?? 0 });
        else {
          // G381: THE HOLD-OFF. The sink is flown to -max(0.35, agl/tau): the
          // approach sink at the flare height, easing to 0.35 m/s in the
          // last metre, and held there while the speed bleeds — the wheels
          // touch when the wing can no longer hold it, which is the flare
          // a pilot flies. The pitch is its own law (P + I on the sink
          // error, from the attitude the flare began at, never below it),
          // because the VS servo's gains are the cruise's and were measured
          // too slow for this (genTuneAP, 'vs' rejected); the cap is the
          // three-point attitude on a taildragger (+2 deg), thMax on a
          // tricycle. The old ramp reached 5.8 deg of its 11 in 3 s and
          // touched at 1.37 Vs, 1.1 m/s.
          flVsF += 0.5 * (vcg[1] - flVsF);
          // the sink asked for: the hold-off's 0.35 m/s, easing to 0.7 as the
          // speed nears Vs — the C172 held off to 0.99 Vs and mushed on at
          // 1.5 m/s with the elevator on its stop; a firm arrival at 1.1 Vs
          // beats a stall from a metre
          const vr = A.VRot || 18;
          const sinkF = (A.flareSink ?? 0.35) + 0.35 * clamp((1.15 * vr - V) / (0.10 * vr), 0, 1);
          const vsC = -Math.max(sinkF, Math.max(0, aglG) / flTau);
          const ev = vsC - flVsF;
          // the elevator has no more to give: stop winding the demand up
          const deSat = aDe > 0.30;
          flI = clamp(flI + (deSat ? -0.15 : (A.flareI ?? 0.30) * ev) * dt, 0, Math.max(0, flCap - thFlare0));
          const thC = clamp(thFlare0 + (A.flareP ?? 0.20) * ev + flI, thFlare0 - 0.02, flCap);
          // the pull: a firmer inner loop and the rotation's integrator authority
          pitchK = A.flarePK ?? 2.0; pitchDK = A.flareDK ?? 1.0;
          IthMaxT = A.rotateIMax ?? 0.30; IthGain = A.flareIth ?? 0.4;
          engage(decrab ? 'DECRAB' : 'LOC', 'PITCH', 'IDLE', { pitch: thC, bank: 0.10, idle: A.flareThr ?? 0 });
        }
        if (onG > 0) {
          go('ROLLOUT');
          pitchK = pitchDK = 1; IthMaxT = 0.15; IthGain = null;
          // G381: a three-point arrival (the attitude at or above the rest
          // attitude, less 3 deg) is pinned from the first frame
          tdThree = !trike && th > (thRest != null ? thRest : A.liftoffTh) - 0.05;
          ap.tdInfo = { sink: -vcg[1], z: sCr, x: sAl, V, drift: -vcg[0] * F.uz + vcg[2] * F.ux, three: tdThree, th };
        }
        break;
      }

      case 'ROLLOUT': {
        if (trike) {
          // P1.B soft: the nosewheel stays off to 0.7 Vs, then full up
          const soft = ap.appr && ap.appr.technique === 'soft';
          if (V > (soft ? 0.7 * (SH0 && SH0.Vs0 ? SH0.Vs0 : (A.VRot || 18) / 0.99) : (A.VDerotate ?? 20))) engage('RWY', 'PITCH', 'SET', { pitch: A.rolloutTh ?? 0.035, thr: 0 });
          else engage('RWY', 'DE', 'SET', { de: soft ? 0.35 : 0.15, thr: 0 });
        } else if (A.flareMode !== 'ramp' && A.flareMode !== 'vs') {
          // G381: AFTER THE HOLD-OFF THE TAIL COMES DOWN AT ONCE. The stick
          // comes back the moment the wing cannot fly it again (1.15 VRot;
          // full back stick at 1.35 Vs lifted the cub off for six seconds),
          // the arrival attitude held until then — three-point or wheels
          // first alike. The wheel-landing hold (tail up on -0.05 until
          // VTailDown) belongs to the ramp flare's 1.3-1.4 Vs arrivals: at
          // the hold-off's 1.05-1.2 Vs it kept the tailwheel off the ground
          // for six seconds in a crosswind, the rudder alone weaving against
          // the weathercock (+/-9 deg, saturating), and the tail dropped
          // onto a heading 8 deg off — an 88 deg ground loop on the stearman
          // in 2 m/s across. The tailwheel steers from the first second now.
          if (V < 1.15 * (A.VRot || 18)) engage('RWY', 'DE', 'SET', { thr: 0, de: 0.35 });
          else engage('RWY', 'PITCH', 'SET', { thr: 0, pitch: Math.min(ap.tdInfo ? ap.tdInfo.th : th, flCap) });
        } else engage('RWY', 'DE', 'SET', { thr: 0, de: V > (A.VTailDown ?? A.VTailUp) ? -0.05
                    : (th > (A.thPinMax ?? 0.26) ? 0.05 : V > (A.VPinFull ?? 0) ? 0.14 : 0.35) });
        // G381.1: A TRICYCLE BRAKES AS SOON AS THE NOSEWHEEL IS DOWN. VBrakeOn
        // (0.75 Vs) is the taildragger's rule — brake hard with the tail up
        // and it noses over — and a trike landed fast (the drawn-tail
        // Caravan-alike at 1.6 Vs) rolled 836 m waiting for it, stopping 8 m
        // from the end of an 1100 m strip.
        // P1.B: the technique — short: the brakes from the moment every
        // wheel is down, the ramp twice as quick; soft: none until the
        // aeroplane is walking (0.5 Vs), the nose held off by the elevator
        // laws above (full up on a taildragger; a trike derotates late)
        const tq = ap.appr ? ap.appr.technique : 'normal';
        if (tq === 'soft') { if (Vg < 0.5 * (SH0 && SH0.Vs0 ? SH0.Vs0 : (A.VRot || 18) / 0.99)) brakeRamp = Math.min(brakeRamp + 0.5 * A.brakeRampRate * dt, 0.5 * A.brakeMax); }
        else if (tq === 'short') { if (onG >= 3 || Vg < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + 2 * A.brakeRampRate * dt, A.brakeMax); }
        else if (Vg < A.VBrakeOn || (trike && onG >= 3 && V < (A.VDerotate ?? 20)))
          brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        // G381.1: THROUGH A SKIP THE PILOT KEEPS FLYING IT. A bounce in a
        // crosswind put the wheels back in the air for a second, the ground
        // law's rudder let the nose weathercock 10 deg while nothing steered,
        // and the tailwheel then swung it (cub, 2 m/s across: 10.7 deg). Off
        // the wheels in the first seconds the flare's DECRAB flies the
        // lateral — wings level, the nose held on the centreline — until the
        // wheels are back.
        if (onG === 0 && phaseT < 6 && AF.lat === 'RWY') { AF.lat = 'DECRAB'; ap.trackHold = true; }
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        setStatus('rolling out', [cond('ground speed', Vg, A.VStop, Vg < A.VStop, 'm/s')]);
        if (Vg < A.VStop || phaseT > 120) {
          if (ap.tdInfo) ap.report.landing = {
            run: Math.round(Math.abs(sAl - ap.tdInfo.x)),
            sink: Math.round(ap.tdInfo.sink * 100) / 100,
            V: Math.round(ap.tdInfo.V * 10) / 10,
            offCentre: Math.round(ap.tdInfo.z * 10) / 10,
            pastAim: Math.round(ap.tdInfo.x - ap.xAim),
            k: F.k, three: !!ap.tdInfo.three,
          };
          ap.report.outcome = ap.report.outcome || 'completed';
          go('STOPPED');
        }
        break;
      }

      case 'STOPPED':
        engage('NONE', 'DE', 'SET', { de: 0.35, thr: 0 });
        c.brake = 0.25;
        setStatus('stopped', []);
        break;

      default:
        // an unknown phase (a manual-flight re-latch): back to a known one
        if (onG > 0) go('ROLLOUT'); else go('CLIMB');
        break;
    }
    if (!BX.on) { apply(); flapsTo(flapTgt); }
    // the servo slew on the axes the pilot owns; a hand-flown axis (the box
    // with that mode released) passes through and the servo tracks it, so
    // nothing jumps when the box takes the axis
    const ownV = !BX.on || AF.vert !== 'OFF', ownL = !BX.on || AF.lat !== 'OFF';
    if (ownV) { aDe += clamp(c.de - aDe, -A.slew * dt, A.slew * dt); c.de = aDe; } else aDe = c.de;
    if (ownL) {
      aDa += clamp(c.da - aDa, -A.slew * dt, A.slew * dt); c.da = aDa;
      aDr += clamp(c.dr - aDr, -A.slew * dt, A.slew * dt); c.dr = aDr;
    } else { aDa = c.da; aDr = c.dr; }
    holdWas = holdActive; holdActive = false;
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl, aglG, grade: gGrade, thRest, flCap, tecs: AF.vert === 'TECS' ? tecsDbg : null,
               xt: taxiXT, sRem: taxiSRem, tailUp: tailUpNow };
    // the measurements a panel reads (ap.instruments), SI
    ap._m = { ias: V, tas: Vt, gs: Vg, alt: cg[1], agl, aglT, vs: vcg[1], pitch: th, bank: ph,
              hdg: PILOT_UNITS.deg(Math.atan2(nose[1], nose[0])),
              trk: tl2 > 0.5 ? PILOT_UNITS.deg(Math.atan2(vcg[2], vcg[0])) : null,
              beta, x: cg[0], z: cg[2], onGround: onG, t: ap.t };
  };
  return ap;
}
