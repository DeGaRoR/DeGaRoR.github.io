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
// outcome ∈ completed | rejected-takeoff | gave-up (| sim-diverged / broke-up / crashed by a runner, G1800).
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
  FINAL: ['FINAL', 'APPROACH'], GOAROUND: ['GO-AROUND', 'APPROACH'], GLIDE: ['GLIDE', 'APPROACH'], FLARE: ['FLARE', 'FLARE'],
  ROLLOUT: ['ROLLOUT', 'ROLLOUT'], STOPPED: ['STOPPED', 'STOPPED'],
  BOX: ['AP BOX', 'CRUISE'],
};
const PILOT_UNITS = {
  kt: v => v * 1.943844, fpm: v => v * 196.8504, ft: h => h * 3.28084, kmh: v => v * 3.6,
  deg: r => ((r * 180 / Math.PI) % 360 + 360) % 360,
};

// G1943 (PILOT-ONE): THE PERSONALITIES - one parameter set on the one pilot (futureDesigns/PILOT-PERSONALITY-
// 2026-10-05.md). A downgrade is a PROFILE, never a fork. 'expert' is today's pilot to the bit (every hook is
// bypassed: PILOT_PROFILES.expert.active is false). Fields (any may be left out: the expert's value):
//   skill      reaction  s of delay on the stick, pedals (a pure delay line, per physics step)
//              smooth    x the servo slew (< 1 smoother and slower, > 1 snatchier)
//              hamFist   the rms of a deterministic disturbance on de / da / dr (stick units)
//   quirks     overRotate  rad added to the rotation's attitude target
//              flareK      x the flare height (< 1: a late flare)
//   limits     bankK     x the circuit's bank limit (on top of the style's)
//              comfortG  the load factor the pilot will pull in a turn (caps the bank: acos(1 / g))
//   technique  field     null (the pilot's choice) | 'short' | 'normal' - the approach technique forced
//              slip      true: the forward slip on ANY final high on energy at idle (the expert: short ones only)
//              stepHold  true: the step-attitude hold on the water (39b servoStepHold)
const PILOT_PROFILES = {
  expert:  { name: 'expert', active: false },
  club:    { name: 'club pilot', active: true, skill: { reaction: 0.25, smooth: 0.8, hamFist: 0.005 }, quirks: { flareK: 0.95 }, limits: { bankK: 0.9, comfortG: 1.3 } },
  student: { name: 'student', active: true, skill: { reaction: 0.45, smooth: 0.7, hamFist: 0.015 }, quirks: { overRotate: 0.035, flareK: 0.8 }, limits: { bankK: 0.7, comfortG: 1.15 }, technique: { field: 'normal' } },
  bush:    { name: 'bush pilot', active: true, skill: { reaction: 0.15, smooth: 1.1, hamFist: 0.003 }, limits: { bankK: 1.15, comfortG: 1.6 }, technique: { field: 'short', slip: true } },
  hamfist: { name: 'ham-fist', active: true, skill: { reaction: 0.2, smooth: 1.6, hamFist: 0.05 }, quirks: { overRotate: 0.02 } },
};
function pilotProfile(p) {
  const base = PILOT_PROFILES.expert;
  if (!p) return base;
  const P = typeof p === 'string' ? (PILOT_PROFILES[p] || base) : Object.assign({ name: 'custom', active: true }, p);
  const g = (sec, k, d) => (P[sec] && P[sec][k] != null) ? P[sec][k] : d;
  return { name: P.name, active: !!P.active,
           reaction: g('skill', 'reaction', 0), smooth: g('skill', 'smooth', 1), hamFist: g('skill', 'hamFist', 0),
           overRotate: g('quirks', 'overRotate', 0), flareK: g('quirks', 'flareK', 1),
           bankK: g('limits', 'bankK', 1), comfortG: g('limits', 'comfortG', null),
           field: g('technique', 'field', null), slip: !!g('technique', 'slip', false), stepHold: !!g('technique', 'stepHold', false) };
}

function makePilot(sim, def, world, opts) {
  opts = opts || {};
  const A = def.params.ap;
  const ST = PILOT_STYLES[opts.style] || PILOT_STYLES.normal;
  // G1943: the personality (opts.profile: a PILOT_PROFILES name or an object); 'expert' bypasses every hook
  const PRF = pilotProfile(opts.profile);
  const PRA = PRF.active;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // P0.4 (PILOT-ROADMAP §6.3 rule 5): THE MACHINE SHEET — built lazily (the
  // shakedown behind it costs ~2 s; the garage memoises one, a gate may pass
  // one, `opts.shakedown` is a value or a getter). `opts.sheet` (the flag)
  // makes the pilot fly the sheet's ladder — Vref = 1.30 Vs0 for the
  // approach, 1.20 Vs0 short-field — instead of genAP's 1.42 Vs; off until
  // the matrix says it wins (the ramp-flare precedent). Either way the sheet
  // is published as `ap.sheet` for the panel and the planner to come.
  // G1302 (GARAGE-LAG-2): ...AND READ LAZILY. The pilot took the sheet at construction (SH0, the speed ladder, the
  // approach's limits), so every setAircraft ran the shakedown behind it - in the garage, on the tank row's release
  // (an energy commit rebuilds the aeroplane), 0.4-0.7 s inside the change for a pilot that is not flying. Every read
  // below is a call to this memo now, so the sheet is built the first time the pilot needs it - the same sheet, off
  // the same shakedown (machineSheet is a pure function of the def and its getter), only later; and a memo of the
  // value rather than of its truth, so a page with no machineSheet asks once
  let sheetV = null, sheetDone = false;
  const sheetOf = () => {
    if (!sheetDone) { sheetV = (typeof machineSheet === 'function' ? machineSheet(def, { shakedown: opts.shakedown }) : null); sheetDone = true; }
    return sheetV;
  };
  // G399.7 (P0.7): the sheet's ladder, TECS and the path ARE the pilot — the
  // flags that kept the old modes selectable (G399.2-G399.5) are retired,
  // the full matrix having judged every archetype under them
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  // ---- the aeroplane's ground facts (41_test_pilot.js, verbatim) ------------
  const GP = (typeof genGroundPowerCap === 'function')
    ? genGroundPowerCap(def, sim.thrustAt(0), sim.totalM * 9.81) : { cap: 1 };
  // G435: THE THRUST LINE'S HEIGHT OVER THE CG, a ground fact of the
  // aeroplane as built (the rest nodes, mass-weighted). A pusher on its boom
  // pulls the nose DOWN with the throttle: the user's birdman (0.59 m over
  // the CG, 985 N) lifted off at 24 m/s and sank back at 28 with the stick
  // at the servo's 0.20 - the same story G396.2 met on the water, where the
  // integrator's 0.15 ceiling could not hold the attitude against the
  // thrust line. A nose mount reads ~0 here and changes nothing.
  const THRUST_ARM = (() => {
    const N = def.nodes, E = def.refs && def.refs.engine;
    if (!E || !E.length) return 0;
    let M = 0, cy = 0;
    for (const nd of N) { M += nd.m; cy += nd.m * nd.p[1]; }
    const ey = E.reduce((s, i) => s + N[i].p[1], 0) / E.length;
    return M > 0 ? ey - cy / M : 0;
  })();
  // G455: ...AND NOT ON THE WATER. The float card's wing-pod engines sit
  // 0.548 m over the CG, so this rule held the stick back from t = 0 on
  // GATE SEAPLANE's crosswind run and the aeroplane WATER-LOOPED at 4 s
  // (hdg -20 deg at 3.0 s, -176 at 4.0, V 7.2 -> 2.5 m/s, water rudder on
  // its stop). Bisected on the built cores: 38.7 deg through the G438
  // build, the loop from the G439 build (G435 the only core change);
  // reverting these three uses on that core restores 38.7 exactly, the
  // shapeMatch re-centring changes nothing. On the water the hydro rules
  // (G396.4: neutral through the hump, the 0.15 ceiling) already say what
  // the stick does; the thrust line is theirs to hold, not this rule's.
  const highThrust = !sim.hydro && THRUST_ARM > (A.highThrustArm ?? 0.30);
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
  // G435: ...AND A HIGH THRUST LINE ROLLS THREE-POINT. The tail-up schedule
  // eases the stick to lift the tail at 3 m/s; on the user's pusher the
  // thrust line lifts it by itself and kept going - the nose reached -14 deg
  // with the servo at 0.20 and the keel touched at 15 m/s (the birth spec
  // rolled, the game's joined spec did not: a knife edge, 1320 N.m of thrust
  // moment against 1330 of weight). Held three-point, the stick stays back
  // until Vr and the tail rides where the thrust line puts it.
  const threePoint = !trike && (GP.cap < 1 || highThrust);
  // every taildragger rotates at Vr (G193); every TRICYCLE rotates too (G202)
  const rotateTD = !trike && (A.rotate != null ? !!A.rotate : true);
  // G1570: THE SERVOS ARE ONE MODULE (39b_servos.js), shared with 40 and 41;
  // this pilot flies it with its own laws on (the calm-air course trim, P1.D's
  // ground steer, the aileron into wind, the water's branch and stick top)
  const restH0 = servoRestHeight(def);      // B5: the design pose's CG rest height over the ground
  const SV = makeServos(sim, def, { pilot: 'pilot', now: () => ap.t, trike, rotateTD, TW, features: {
    trimCalm: true, groundP1D: true, xwBank: true, water: true,
    // G396.2 / G970: on the step the stick comes all the way back, through LIFTOFF
    deTop: (onG) => (sim.hydro && (onG > 0 || ap.phase === 'LIFTOFF')) ? (A.deWater ?? 0.70) : 0.35 } });
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
  // G1936: THE SHORT FIELD'S STOP - the brakes to the short-field limit (ROLLOUT, below). MEASURED, not the friction
  // law: the user's Cub three-point from 19 m/s ran 152 m at the 0.3 brake and 128 m at full brake (0.84 x) - the
  // wing still carries the weight at that speed and the tyres have little to brake on; the friction law said 0.5 x
  const brakeShort = A.brakeShort ?? 1.0;
  const stopDistShort = v => (A.stopShortK ?? 0.84) * stopDist(v);
  // THE RESERVE IS THE FIELD'S (G531): the style's 120/80/50 m past the Vr
  // point is a long runway's margin, and no strip under ~230 m could pass it
  // - on East Point's 150 m of gravel the cub was condemned at 6 m/s by a
  // run it makes (lift-off 104 m into 112 m ahead, measured with every rule
  // off). Under 300 m it falls with the square of the length: half the
  // strip, a quarter of the margin (150 m: 30 / 20 / 12.5 m, so the cautious
  // pilot still refuses a field at the aeroplane's limit). Every strip of
  // 300 m and more keeps the style's number to the bit.
  const reserveOf = () => {
    const L = ap.route.from.len || 1100;
    return L >= 300 ? ST.reserve : ST.reserve * (L / 300) * (L / 300);
  };
  // the run a take-off needs from a standstill: most of the sheet's roll
  // (Vr is reached before the sheet's lift-off point), the stop from Vr, the
  // reserve — the SAME arithmetic the roll rejects with, so the planner and
  // the judge never disagree
  const runNeeded = () => ST.needK * (0.85 * (A.TORun ?? 500) + stopDist(A.VRot || 18) + reserveOf());

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
  const sheetVAppr = () => { const S = sheetOf(); return S && S.src.Vs0 === 'measured' ? S.Vref : null; };
  const VApprShort = () => sheetVAppr() != null ? 1.20 * sheetOf().Vs0 : A.VApprShort;
  let vAppr;                                  // G1302: the approach speed, the sheet's once first read
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise,
    get VAppr() { if (vAppr === undefined) vAppr = sheetVAppr() ?? A.VAppr; return vAppr; },
    set VAppr(v) { vAppr = v; },
    xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
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
    // THE SHEET, PUBLISHED (CLIMATE K3). The header has said since P0.4 that it
    // is "published as ap.sheet for the panel and the planner to come" and it
    // never was - the panel came (the netto variometer reads its polar), so it
    // is published now, lazily, through the same memo the pilot uses.
    get sheet() { return sheetOf(); },
    // G710: THE PLAN, PUBLISHED (the Jolene playtest: "it's unclear to what altitude the autopilot
    // intends to go ... no waypoints on the map"). Written at the end of every update, one object
    // mutated in place (no garbage at 60 Hz): the phase, the legs and the active one, the point flown
    // to and the height asked there (MSL; `hField` over the field's datum altRef, `hGround` over the
    // ground under that point), the vertical speed asked and the TECS limits it is clamped to (the
    // ones the law used this step; the sheet's climbMax / idle sink otherwise), and the filleted air
    // path L1 follows (null on the ground and in the climb-out). The map, the HUD's plan line and
    // the 3-D legs read THIS - nothing re-derives the plan.
    intent: { phase: 'ROLL', legs: null, legI: 0, to: null, x: null, z: null, h: null, hField: null, hGround: null, vs: 0, vsCmd: null,
              vsUp: null, vsDn: null, climbMax: null, sinkIdle: null, path: null, pathI: 0, taxi: null },
  };
  const say = (code, note) => {
    ap.report.verdicts.push({ t: Math.round(ap.t * 10) / 10, code, note });
  };
  let phaseT = 0;
  const go = (ph) => {
    if (ph !== ap.phase) ap.report.phases.push({ t: Math.round(ap.t * 10) / 10, phase: ph });
    ap.phase = ph; phaseT = 0;
    piv = null;                                  // G1938: a pivot belongs to the phase that began it
  };
  const PATS = {};
  const patOpts = { half: (def.params.gen && def.params.gen.span > 0) ? def.params.gen.span / 2 : null };
  ap.patOf = a => {
    if (!a) return null;
    const key = a.id || 'HOME';
    if (PATS[key] !== undefined) return PATS[key];
    let P = null;
    try {
      if (typeof sitePattern === 'function')
        P = sitePattern(a, typeof siteOf === 'function' ? siteOf(a.id) : null, patOpts);   // G710: the way out round the parked aeroplanes, for THIS span
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
  // G1375 STRIP-SURFACE: the gear this pilot lands on (25_airfield.js stripGear: the build's spec, else the sim's
  // floats) - no destination is planned on a surface it may not use (stripLandable: the circuit, else the fallback)
  const gearK = typeof stripGear === 'function' ? stripGear(def && def.spec && def.spec.gear ? def : sim) : 'wheels';
  ap.gear = gearK;
  const landable = (from, to) => {
    if (typeof stripLandable !== 'function') return to;
    const L = stripLandable(gearK, world && world.aerodromes, from, to);
    if (L.why) say('wrong-surface', L.why);
    return L.to;
  };
  const setRoute0 = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.budget = Math.max(ap.budget, routeBudget(from, to));
  };
  ap.setRoute = (from, to) => setRoute0(from, landable(from, to));
  setRoute0(world ? world.aerodromes[0] : HOMEISH, world ? world.aerodromes[0] : HOMEISH);
  let holdN = 0, planN = 0;
  // G771: `opts.atHold` = the pose ap.lineupPose() gave, the aeroplane placed on it (placeAtLineup): DEPART
  // takes THAT direction and goes to STOP / HOLD with no route - the state the taxi ends in - instead of
  // planning afresh (planDeparture's own run test is the uncapped need, which a short strip's hold fails and
  // would send the aeroplane round a U-turn it has already been spared)
  ap.departFrom = (from, to, siteOrTaxiOut, opts) => {
    const site = (siteOrTaxiOut && !Array.isArray(siteOrTaxiOut)) ? siteOrTaxiOut : null;
    ap.site = site;
    ap.atHold = (opts && opts.atHold) || null;
    ap.path = null; ap.pathI = 0; ap.stopAfterLineup = false; holdN = 0; planN = 0;
    ap.taxiOut = Array.isArray(siteOrTaxiOut) && siteOrTaxiOut.length ? siteOrTaxiOut
               : (site && site.taxiOut) || null;
    to = landable(from, to);
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.trackHold = false;
    ap.legs = null; ap.legI = 0; ap.plan = null;
    // REVIEW C: A NEW DEPARTURE IS A NEW FLIGHT — the balk count, the go-around
    // count and the committed flags of the last leg were carried into it (a
    // multi-hop's second take-off began two balks from ABORT, a second
    // arrival with no go-around left and 'committed' already said)
    rollN = 0; ap.gaN = 0; ap.gaWhy = null; committed = false; committedTO = false;
    ap.budget = Math.max(ap.budget, ap.t + routeBudget(from, to));
    go('DEPART');
  };

  // ---- the servos' state lives in SV (39b_servos.js, G1570) -------------------
  let gaT = 0;
  // A9: THE TRIM THE PILOT HELD (41_test_pilot.js, verbatim in intent): the
  // slewed elevator on the settled downwind, time-weighted, published as
  // `report.trimDe` for the bench's trim advisor — the test flight is a real
  // flight on THIS pilot now, so the reading has to come from here
  let trimAcc = { n: 0, de: 0 };
  let thFlare0 = 0, thLift0 = 0, brakeRamp = 0;
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
  // back to the air's numbers. (SV.IthMax / SV.IthMaxT / SV.IthGain)
  // G381: the flare's own inner-loop gains (P up, rate damping down) — the
  // cruise loop moved 1 deg in 3 s at idle, which is no flare at all (SV.pitchK / SV.pitchDK)
  let thRest = null, thrRoll = 0, taxiXT = 0, taxiSRem = 0, tailUpNow = false;
  // G630: AN ANGLE'S RATE IS THE RATE OF A WRAPPED DIFFERENCE. The heading
  // errors live in (-pi, pi]; differenced raw, an error that crosses +-pi
  // (the nose 180 deg from a target nobody refreshed) steps 2 pi in one
  // 1/60 s step, a 377 rad/s spike the 2 s washout then holds for seconds
  // — the downwind's rudder square wave on its +-0.25 stop, measured (now in SV.sense)
  let flatRoll = null;                       // G630.1: the level stretch of a sloped strip the rollout rolls on to
  const wrapPi = servoWrapPi;
  let pendReEng = false;
  let rollS0 = null, rollN = 0, thrRollW = 0, humpStuckT = 0;
  let humpR = 0, humpPk = 0, humpPast = false;   // G790: the hull's resistance / weight on the water run, filtered; its peak; past it
  let climbMode = true, ceilT = 0, ceilingSaid = false;
  let slopeCaptured = false, finalT0 = 0, committed = false, cardAcc = null;
  let starvedSaid = false, glideTo = null, glideHdg = 0;      // G435: the forced landing
  // G381: the arc turn in progress, the latched level altitude before the
  // slope, the flare's own integrator / cap / timescale, a three-point flag
  let finalLevel = null;
  let flI = 0, flCap = 0, flTau = 3.2, flVsF = 0, tdThree = false, altG = 0;   // altG: GTRAM, the altiport's grade at the aim
  // G381.1: the power assist on the approach (see apply)
  let pAsst = 0, flLeft = Infinity;
  // G1936: the forward slip on a short final (FINAL, below) - its amount 0..1, its side, said once
  let slipK = 0, slipSg = 1, slipSaid = false;
  // G1938: THE PIVOT (TAXI / LINEUP, below) - the tightest turn the wheels steer (39_ground_path groundRmin, at the
  // taxi's 0.85 of rudder) and the pivot in progress { hdg, j, thr, t0 }; a trike's nosewheel turns tight enough
  const RgMin = (typeof groundRmin === 'function') ? groundRmin(def, 0.85) : Infinity;
  let piv = null, pivSaid = false, pivN = 0;
  // G1943: THE HUMAN IN THE LOOP (a profile's skill; the expert never enters it) - the reaction's delay line on the
  // stick and pedals, the ham-fist's disturbance (an Ornstein-Uhlenbeck sequence, 0.3 s, from a fixed seed: every
  // flight of a profile is the same flight, the gates stay deterministic)
  const HUM = PRA ? { n: 0, buf: null, i: 0, x: [0, 0, 0], seed: 1935 } : null;
  if (PRA) SV.slewK = PRF.smooth;
  const humRand = () => { HUM.seed = (HUM.seed + 0x6D2B79F5) | 0; let t = HUM.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const humanise = (dt, onG) => {
    const c = sim.ctl;   // (the update's own `c` is not in scope here)
    if (PRF.hamFist > 0) {
      const a = Math.min(1, dt / 0.3), sq = Math.sqrt(2 * a);
      for (let k = 0; k < 3; k++) {
        const g = Math.sqrt(-2 * Math.log(Math.max(1e-12, humRand()))) * Math.cos(2 * Math.PI * humRand());
        HUM.x[k] += -a * HUM.x[k] + sq * g;
      }
      c.de += PRF.hamFist * HUM.x[0]; c.da += PRF.hamFist * HUM.x[1]; c.dr += PRF.hamFist * HUM.x[2];
    }
    // ON THE WHEELS THE DELAY IS 0.15 s AT MOST: the ground steer is the tightest loop the pilot flies, and the
    // student's 0.45 s inside it swerved the stock build 31 deg on the roll (0.10 m/s^2, a rejected take-off every
    // time) - a person on the roll watches the centreline and the feet are quick; in the air the delay is whole
    const N = Math.round((onG > 0 ? Math.min(PRF.reaction, 0.15) : PRF.reaction) / Math.max(1e-3, dt));
    if (N > 0) {
      if (!HUM.buf || HUM.n !== N) { HUM.n = N; HUM.buf = new Float64Array(3 * (N + 1)); for (let k = 0; k <= N; k++) { HUM.buf[3 * k] = c.de; HUM.buf[3 * k + 1] = c.da; HUM.buf[3 * k + 2] = c.dr; } HUM.i = 0; }
      const B = HUM.buf, w = HUM.i, r = (w + 1) % (N + 1);
      B[3 * w] = c.de; B[3 * w + 1] = c.da; B[3 * w + 2] = c.dr;
      c.de = B[3 * r]; c.da = B[3 * r + 1]; c.dr = B[3 * r + 2];
      HUM.i = r;
    }
  };
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
  // G975: the landing flap the ELEVATOR can hold (FINAL, below) - a cap that only comes down, kept for the flight
  let fLandCap = 1, fCapT = 0, deF = 0;
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
  // G1936 (PILOT-ONE): A SHORT FIELD IS FLOWN SLOW FROM THE BASE LEG. The base was flown at VTurn (the cub: 27.5 m/s)
  // and the final asked 1.2 Vs0 (19.2) on East Point's 6 deg slope: the energy came off as speed on the slope, never
  // as drag (25.4 m/s at the flare). A pilot slows on the base to 1.25 Vref with the first stage of flap
  const VTurnLeg = () => ap.shortFld ? Math.min(VTurn, 1.25 * ap.VAppr) : VTurn;
  const bankLim = PRA
    ? clamp(Math.min((A.bankLim ?? 0.30) * ST.bank * PRF.bankK, PRF.comfortG ? Math.acos(1 / Math.max(1.02, PRF.comfortG)) : 9), 0.12, 0.55)
    : clamp((A.bankLim ?? 0.30) * ST.bank, 0.15, 0.55);
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
  const gsMax = () => { const S = sheetOf(); return S && S.LDbest ? clamp(1.4 / S.LDbest, 0.07, 0.16) : 0.105; };
  const gammaGA = () => { const S = sheetOf(); return S && S.gammaClimb ? 0.8 * S.gammaClimb : 0.08; };
  const dirLim = (mode) => ({ gs: A.gs, gsMax: gsMax(), gammaClimb: gammaGA(), mode, LDGrun: sheetOf() && sheetOf().LDGrun ? sheetOf().LDGrun : null, TORun: sheetOf() && sheetOf().TORun ? sheetOf().TORun : null });
  // the take-off / landing direction at an aerodrome: the runway model's two
  // directions SCORED (25_airfield.js siteScoreDirections: the wind, the
  // slope, the approach the obstacles allow, the climb-out) with the
  // preference as the tie-break; without a model, into wind when there is
  // one, else the runway direction nearest the preference (a unit vector).
  // `mode` 'land' (default) or 'takeoff' — a strip in a valley is landed
  // toward the hill and left away from it
  // G772: `taxiLen` [T0, T1] - the metres each take-off direction's way out is from where the aeroplane
  // stands (planDeparture, off the strip): a kilometre of taxiing weighs 1 point (a third of a metre per
  // second of headwind, 0.6 km of a 1 % uphill run). The wind still decides; in calm air the way out does,
  // not the nose - Jolene's calm day was settled by the stand's heading alone (0.12 points: a 0.4 % grade
  // against the nose), which sent the aeroplane on a 1.7 km taxi when 0.9 km went to the other end
  const TAXI_K = 1.0 / 1000;
  const dirAt = (a, px, pz, mode, taxiLen) => {
    const axx = snap(Math.cos(a.hdg)), axz = snap(Math.sin(a.hdg));
    const w = windAt(a, 30);
    const M = siteModelOf(a);
    if (M && typeof siteScoreDirections === 'function') {
      let pref = [px, pz];
      // G398.3: a ONE-WAY strip (a premises runway with `approach`) names its landing direction
      if (typeof a.landHdg === 'number') pref = [Math.cos(a.landHdg), Math.sin(a.landHdg)];
      // GTRAM: an ALTIPORT is landed uphill and LEFT DOWNHILL - its one way reverses for the take-off
      if (typeof a.landHdg === 'number' && a.altiport && mode === 'takeoff') pref = [-pref[0], -pref[1]];
      // G527.3: a strip that names its way out (runway `departure`) is left that way in calm air
      const tko = mode === 'takeoff' && typeof a.takeoffHdg === 'number';
      if (tko) pref = [Math.cos(a.takeoffHdg), Math.sin(a.takeoffHdg)];
      const sc = siteScoreDirections(M, w, dirLim(mode || 'land'), pref, typeof a.landHdg === 'number' || tko);
      if (taxiLen && mode === 'takeoff') {
        const s2 = M.dir.map((D, i) => {
          const L = taxiLen[(D.u[0] * axx + D.u[1] * axz) >= 0 ? 0 : 1];
          return isFinite(L) ? sc.score[i] - TAXI_K * L : sc.score[i];
        });
        sc.k = s2[0] >= s2[1] ? 0 : 1;
        sc.why = sc.why.map((y, i) => { const L = taxiLen[(M.dir[i].u[0] * axx + M.dir[i].u[1] * axz) >= 0 ? 0 : 1]; return isFinite(L) ? (y ? y + ', ' : '') + 'taxi ' + Math.round(L) + ' m' : y; });
      }
      ap.dirWhy = sc.why[sc.k];
      return M.dir[sc.k].u.slice();
    }
    let dx = px, dz = pz;
    if (a.altiport && typeof a.landHdg === 'number') { const k = mode === 'takeoff' ? -1 : 1; dx = k * Math.cos(a.landHdg); dz = k * Math.sin(a.landHdg); }   // GTRAM: whatever the wind
    else if (Math.hypot(w[0], w[1]) > 0.7) { dx = -w[0]; dz = -w[1]; }
    else if (mode === 'takeoff' && typeof a.takeoffHdg === 'number') { dx = Math.cos(a.takeoffHdg); dz = Math.sin(a.takeoffHdg); }   // G527.3: the named way out, in calm air
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
  // GTRAM: THE ALTIPORT'S SLOPE - the grade the aeroplane lands ONTO (uphill along the landing frame,
  // read off the ground 20 m either side of the aim) and the height above that slope's line; 0 and
  // aglG on every other strip, so nothing else flies differently
  const altiGrade = () => {
    const to = ap.route && ap.route.to;
    if (!to || !to.altiport || !world || typeof world.terrainH !== 'function' || !ap.frame) return 0;
    const P1 = wp(ap.frame, ap.xAim + 20, 0), P0 = wp(ap.frame, ap.xAim - 20, 0);
    return Math.max(0, (groundH(P1[0], P1[1]) - groundH(P0[0], P0[1])) / 40);
  };
  const aimAlt = () => {
    if (!world || typeof world.terrainH !== 'function' || !ap.frame) return ap.refAlt;
    const P0 = wp(ap.frame, ap.xAim, 0);
    return groundH(P0[0], P0[1]) + (gearH ?? restH0);
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
      const runNeed = sheetOf() && sheetOf().LDGrun ? sheetOf().LDGrun : null;
      const short = !water && (to.len < 450 || (runNeed != null && to.len < 1.6 * runNeed));
      const gust = gustAt(to);
      let technique = short ? 'short' : soft ? 'soft' : 'normal';
      if (PRA && PRF.field && !water) technique = PRF.field;   // G1943: a profile's own field technique
      const shortT = technique === 'short';
      const Vbase = shortT && VApprShort() ? VApprShort() : (sheetVAppr() ?? A.VAppr);
      // G1936 (PILOT-ONE, the user: "aim for touching down at the beginning of the strip"): the short aim is 10 m
      // in (6 % of a longer short strip) - the hold-off's float carries the wheels on from there; 30 m in left the
      // user's Cub 120 m of East Point's 150 for a 135 m landing run, and it touched 213 m in (below)
      // G1949 (PILOT-ONE-2): ...AND ROUND AGAIN AFTER A FLOAT IT AIMS EARLIER - by the float's shortfall measured at
      // the go-around + 10 m (ap.aimBack, this strip's only), never more than 10 m before the threshold. The Cub at East
      // Point floated with 122 m left for a 122 m stop; aimed 15 m earlier it touched 14 m in and stopped with 24 m left
      const back = (shortT && ap.aimBack && ap.aimBack.to === to) ? ap.aimBack.m : 0;
      const aim = shortT ? sThr + Math.max(Math.max(10, 0.06 * to.len) - back, -10)
                : to.len < 700 ? sThr + Math.max(60, 0.12 * to.len)
                : Math.max(A.xAim, sThr + 40);
      const FS0 = def.params.flaps;
      ap.appr = { technique, Vref: Math.round((Vbase + 0.5 * gust) * 10) / 10, Vbase: Math.round(Vbase * 10) / 10, gust: Math.round(gust * 10) / 10,
                  aimIn: Math.round(aim - sThr), flap: FS0 ? (FS0.ldg ?? 1) : 0, len: to.len, surface: to.surface,
                  runNeed: runNeed != null ? Math.round(runNeed) : null };
      ap.report.appr = ap.appr;
      ap.xAim = aim; ap.shortFld = technique === 'short'; ap.VAppr = Vbase + 0.5 * gust;
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
    ap.gs = D ? clamp(Math.max(A.gs, 1.05 * D.reqGs), A.gs, Math.max(A.gs, gsMax())) : A.gs;
    ap.siteDir = D;
    if (ap.appr) { ap.appr.gs = Math.round(ap.gs * 1000) / 1000; ap.appr.reqGs = D ? Math.round(D.reqGs * 1000) / 1000 : null; }   // G1936: the slope flown, the obstacles'
    // P1 (found on the dn4 fixture, flown uphill for the first time): the
    // slope ends on the AIM'S ground (aimAlt, P0.8) while the level before
    // the FAF is hC over the aerodrome's datum — the FAF is where the slope
    // reaches THAT level, not hC / gs from the aim: 37 m of ground under
    // the aim put the level 37 m above the slope at the FAF, never captured
    const hFaf = () => Math.max(60, ap.altRef + hC - aimAlt());   // the level's height over the aim
    let Dfaf = hFaf() / ap.gs;
    // G1936: A SHORT FIELD'S FINAL BEGINS FARTHER OUT (the user: "they should start from farther away") - 900 m or
    // 30 s at Vref of straight final before the slope, where a long strip's is 400 m: the speed and the flap are
    // set on the level before the slope is met, the slope is flown stabilized
    const iafRun = () => ap.shortFld ? Math.max(900, 30 * ap.VAppr) : Math.max(400, 10 * VTurn);
    let Diaf = Dfaf + iafRun();
    // P0.8: the crosswind leg carries TWO fillets, each of the radius the
    // aeroplane turns at the speed it flies there (the cruise speed plus the
    // wind, at the planned bank) — a width planned on VTurn alone put the
    // beaver's two 365 m fillets on a 565 m leg, patternPath halved them,
    // and the aeroplane crossed the downwind by 240 m at its bank limit
    const wv0 = windAt(to, 30), easK0 = (sim.out && sim.out.easK) || 1, RcW = (ap.VCruise / easK0 + Math.hypot(wv0[0], wv0[1])) ** 2 / (9.81 * Math.tan(bankLim)) * 1.05;   // P1.F: at the true airspeed
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
      // G790: ON THE WATER THE CLIMB-OUT'S TURN DOES NOT CARRY THE PATTERN ONTO THE HILLS. The runway model scores a
      // 30 deg turn from 300 m past the end against 1.5 km of ground (25_airfield siteRunwayModel) - Jolene's lane
      // (Annette Dock) turns right past a 90 m point, and its sense forced the whole circuit onto the island's side:
      // 359-436 m of ground under the Cessna on floats' downwind and base against 39 m over the Sound, a circuit
      // planned at 482-562 m, flown by a 0.4 m/s climb (ceiling-accepted), the 180 hp build 1.9 m over the ridge at
      // 160 s (a 34 deg zoom, then a dive), the O-540 build never round (leg time-outs, a go-around, gave up). A water
      // lane's circuit is flown over the water when that side's ground under the pattern is lower by a quarter of the
      // circuit height (the rule below, as on land without a turn); the climb-out keeps its own turn. Land strips as before.
      const onWater = to.surface === 4 || !!to.water;
      const turnSide = D && D.climbTurn ? -D.climbTurn : 0;
      if (turnSide && !(onWater && (turnSide > 0 ? tL - tR : tR - tL) > 0.25 * hC)) { side = turnSide; sideForced = true; }
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
      if (gSide - gStrip + 0.7 * hC > hC) { hC = gSide - gStrip + 0.7 * hC; Dfaf = hFaf() / ap.gs; Diaf = Dfaf + iafRun(); }
      ap.patGround = { L: Math.round(gL), R: Math.round(gR), strip: Math.round(gStrip), hC: Math.round(hC) };
    }
    // P1.E: THE PROTOCOL (PILOT-ROADMAP §3.3, G.4) — a strip's DECLARED
    // circuit, `to.circuit` { hand: 'left' | 'right', height: m over the
    // strip, join: 'downwind' | 'straight' }: the hand names the side (a
    // left-hand circuit turns left: the downwind lies to the LEFT of the
    // landing direction, wp's c > 0, side 1), the height the least the
    // pattern flies (the terrain may ask more, never less), the join
    // whether a straight-in is allowed ('downwind': never — the aeroplane
    // joins the downwind at the entry). The terrain's FORCED side (a
    // climb-out that turns, a ridge over half the circuit height) wins
    // over the hand and is said once; a preference does not
    const PR = to.circuit && typeof to.circuit === 'object' ? to.circuit : null;
    let join = 'straight';
    if (PR) {
      const handSide = PR.hand === 'right' ? -1 : PR.hand === 'left' ? 1 : 0;
      if (handSide) {
        if (sideForced && side !== handSide) { if (!ap.protocolSaid) { ap.protocolSaid = true; say('protocol-overridden', 'the ' + PR.hand + '-hand circuit declared at ' + (to.id || 'the strip') + ' is flown ' + (side > 0 ? 'left' : 'right') + '-hand — the terrain on that side'); } }
        else { side = handSide; sideForced = true; }
      }
      if (PR.height > 0 && PR.height > hC) { hC = PR.height; Dfaf = hFaf() / ap.gs; Diaf = Dfaf + iafRun(); }
      if (PR.join === 'downwind') join = 'downwind';
    }
    ap.plan = { F, sAim: ap.xAim, sFaf: ap.xAim - Dfaf, sIaf: ap.xAim - Diaf, W, hC, side, sideForced, join, protocol: PR };
    ap.report.circuit = { hand: side > 0 ? 'left' : 'right', hC: Math.round(hC), join, declared: PR ? { hand: PR.hand || null, height: PR.height || null, join: PR.join || null } : null };
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
  // G710: EACH LEG'S HEIGHT AS IT WILL BE FLOWN, planned when the legs are: legAlt's rule (the leg's
  // height over the datum, raised to 2 hSafe (40 m at least) over the ground a 1.5 km look-ahead sees
  // anywhere along the leg - the union of every look-ahead from A to B), the enroute leg's cruise and
  // hClear; the FINAL from the slope's height at its start (never above the leg before it) down to
  // the ground at the aim. `hPlan` (MSL) at B, `hPlanA` at A, `gB` the ground under B. The live
  // target of the active leg (ap.intent.h) is the pilot's own, read every step.
  const planLegH = (legs) => {
    const hasT = !!(world && typeof world.terrainH === 'function');
    let prev = null;
    for (const L of legs) {
      if (!L.A || !L.B) continue;
      const dx = L.B[0] - L.A[0], dz = L.B[1] - L.A[1], len = Math.hypot(dx, dz) || 1e-9, ux = dx / len, uz = dz / len;
      L.gB = hasT ? Math.round(groundH(L.B[0], L.B[1])) : ap.altRef;
      if (L.name === 'FINAL') {
        L.hPlan = L.gB;
        L.hPlanA = Math.round(Math.min(prev != null ? prev : Infinity, L.gB + len * (ap.gs || 0.06)));
        continue;
      }
      // the highest ground from A to B + 1.5 km (every 150 m), and over B's own 1.5 km look-ahead
      let top = -1e9, topB = -1e9;
      if (hasT) {
        const reach = len + 1500, n = Math.max(6, Math.ceil(reach / 150));
        for (let k = 0; k <= n; k++) { const d = reach * k / n, h = groundH(L.A[0] + ux * d, L.A[1] + uz * d); top = Math.max(top, h); if (d >= len) topB = Math.max(topB, h); }
      }
      const base = ap.altRef + (L.h != null ? L.h : ap.hCruise);
      if (L.enroute) {
        // the enroute leg cruises (the departure's cruise height or the terrain's hClear) and arrives at
        // the circuit height at its end (ENROUTE's own descent, 800 m before the entry)
        L.hCruiseLeg = Math.round(Math.max(Math.max(ap.route.from.elev + A.hCruise, base), top + (A.hClear ?? 130)));
        L.hPlan = Math.round(Math.max(base, topB + (A.hClear ?? 130)));
        L.hPlanA = L.hCruiseLeg;
      } else {
        L.hPlan = Math.round(Math.max(base, top + Math.max(2 * A.hSafe, 40)));
        L.hPlanA = prev != null ? prev : L.hPlan;
      }
      prev = L.hPlan;
    }
  };
  const startLegs = (legs) => { ap.legs = legs; ap.legI = 0; ap.trackHold = false; airPath = null; planLegH(legs); };
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
    const speedOf = L => L.V === 'turn' ? VTurnLeg() : L.V === 'climb' ? ap.VClimb : L.V === 'cruise' ? ap.VCruise : ap.VAppr;
    // P0.8: the fillet is followed over the GROUND (L1 on the ground track),
    // so it is planned at the ground speed a turn can reach — the airspeed
    // plus the wind (the beaver / twin in 2 m/s across crossed the crosswind
    // leg by 190-240 m on a fillet planned in still air); a wider fillet is
    // always flyable, the aeroplane banks a little less
    const wv = windAt(ap.route.to || ap.route.from, 30), wMag = Math.hypot(wv[0], wv[1]);
    // P1.F: the turn is flown over the ground at the TRUE airspeed plus the
    // wind — the plan's speeds are indicated (EAS); on the hot day (35 C,
    // sigma 0.9) the true speed is 5 % higher and the radius 10 %
    const easK = (sim.out && sim.out.easK) || 1;
    const rOf = (Vl, climbing) => (Vl / easK + wMag) * (Vl / easK + wMag) / (9.81 * Math.tan(climbing ? bC : bankLim)) * 1.05;
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
  const setTakeoffDir = (t) => {
    ap.frame = mkFrame(ap.route.from, -t[0], -t[1]);
    ap.dirX = -1;
    ap.takeoffDir = t;
  };
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
    if (from.altiport && typeof from.landHdg === 'number') t = [-snap(Math.cos(from.landHdg)), -snap(Math.sin(from.landHdg))];   // GTRAM: an altiport is left downhill, whatever the wind
    else if (siteModelOf(from)) {
      // G772: off the strip, each direction's way out is measured (its route from here, as it would be flown)
      let tl = null;
      if (!onStrip && PAT && PAT.routes && typeof patternPath === 'function') {
        tl = [0, 1].map(T => { const ids = PAT.routes.out[T] || PAT.routes.back[T];
          if (!ids || !ids.length) return NaN;
          try { return patternPath(PAT, ids, 2.0, [cg[0], cg[2]]).len; } catch (e) { return NaN; } });
      }
      t = dirAt(from, enough ? nose[0] : -nose[0], enough ? nose[1] : -nose[1], 'takeoff', tl);
    }
    else if (Math.hypot(w[0], w[1]) > 0.7) t = dirAt(from, nose[0], nose[1]);
    else if (enough) t = [d0[0] * sgN, d0[1] * sgN];
    else t = [-d0[0] * sgN, -d0[1] * sgN];
    const T = (t[0] * d0[0] + t[1] * d0[1]) >= 0 ? 0 : 1;
    setTakeoffDir(t);
    const sPos = rx * t[0] + rz * t[1];
    const runAhead = from.len / 2 - sPos;
    const lined = Math.abs(cross) <= 8 && (nose[0] * t[0] + nose[1] * t[1]) > 0.9;
    if (onStrip && lined && runAhead >= need) {
      ap.path = null; ap.stopAfterLineup = true;
      return 'STOP';
    }
    // G1938: ON A SHORT STRIP THE TURN-AROUND IS WHERE THE AEROPLANE STOPPED. Landed toward a one-way strip's closed
    // end (East Point: in over the sea, out over the sea), the Cub stood 20 m from the end facing it; the route
    // ran a lane U-turn 9 m from the end and back to the hold a quarter in (G527) - 113 m of the 150 ahead, and
    // the roll was rightly rejected. Under 300 m, on the centreline with at least the hold's run ahead (3/4 of
    // the strip), a taildragger turns on the spot (LINEUP's pivot) and rolls from there
    if (onStrip && !trike && isFinite(RgMin) && (from.len || 1100) < 300 && Math.abs(cross) <= 4 && runAhead >= 0.75 * (from.len || 1100)) {
      ap.path = null; ap.stopAfterLineup = true;
      return 'LINEUP';
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

  // G771: WHERE THE TAXI WOULD END. planDeparture run from the live pose (the stand, where the taxi
  // begins) exactly as DEPART runs it - the same take-off direction (the wind, the slope, the climb-out,
  // the nose as the tie-break) and the same route - and the route's END read off it: the hold the path
  // stops on, the centreline under the last taxi point (the legacy point list's rolling line-up), the
  // computed backtrack target, or the centreline under the aeroplane when it is already lined up. The
  // heading is the take-off direction, which is where HOLD hands the aeroplane to ROLL. The pilot's plan
  // is put back as it was: this asks, it does not fly. Needs ap.route (setRoute / departFrom first).
  ap.lineupPose = () => {
    const [xA] = sim.axes(), cg = sim.cgPos();
    const nl = Math.hypot(xA[0], xA[2]) || 1e-9, nose = [-xA[0] / nl, -xA[2] / nl];
    const keep = { frame: ap.frame, dirX: ap.dirX, takeoffDir: ap.takeoffDir, path: ap.path, pathI: ap.pathI,
                   stopAfterLineup: ap.stopAfterLineup, taxiTgt: ap.taxiTgt, taxiPath: ap.taxiPath };
    try {
      const from = ap.route.from;
      const ux = Math.cos(from.hdg), uz = Math.sin(from.hdg);
      const onC = (x, z) => { const s = (x - from.x) * ux + (z - from.z) * uz; return [from.x + ux * s, from.z + uz * s]; };
      // ALREADY ON THE LINE: a start on the spawn identity (a strip with no stand - the game rolls from it
      // with no taxi at all) is lined up along the nose with HOLD's own run ahead (the need, capped at 0.7
      // of the strip). planDeparture's uncapped need would send a 340 m strip's spawn round to the far
      // hold, which leaves less than HOLD accepts - the skip must never be a longer way than no skip
      {
        const sg = (nose[0] * ux + nose[1] * uz) >= 0 ? 1 : -1;
        const al = (cg[0] - from.x) * ux + (cg[2] - from.z) * uz, cr = -(cg[0] - from.x) * uz + (cg[2] - from.z) * ux;
        const ahead = (from.len || 0) / 2 - sg * al;
        if (Math.abs(cr) <= Math.min(8, (from.wid || 30) / 2 - 1) && Math.abs(al) <= (from.len || 0) / 2
            && sg * (nose[0] * ux + nose[1] * uz) > 0.9 && ahead >= Math.min(runNeeded(), 0.7 * (from.len || 1100))) {
          const q = onC(cg[0], cg[2]);
          return { x: q[0], z: q[1], hdg: Math.atan2(sg * uz, sg * ux), from: from.id || 'HOME', how: 'lined' };
        }
      }
      const next = planDeparture(cg, nose);
      const t = ap.takeoffDir;
      let q, how;
      if (next === 'STOP') { q = onC(cg[0], cg[2]); how = 'lined'; }
      else if (ap.path && ap.path.pts && ap.path.pts.length) { const e = ap.path.pts[ap.path.pts.length - 1]; q = [e.x, e.z]; how = 'hold'; }
      else {
        const tg = (ap.taxiPath && ap.taxiPath.length) ? ap.taxiPath[ap.taxiPath.length - 1] : ap.taxiTgt;
        q = onC(tg[0], tg[1]); how = ap.taxiPath ? 'taxiOut' : 'backtrack';
      }
      return { x: q[0], z: q[1], hdg: Math.atan2(t[1], t[0]), from: from.id || 'HOME', how };
    } finally { Object.assign(ap, keep); }
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
  // THE LIGHTS A PILOT FLIES WITH (SKY chantier) were written here as ap.lights (nav and
  // beacon from sunset to sunrise); since G436.12 the rule is the cockpit's (cockpit.js
  // CK.lightsRule - it runs under a hand too, and knows the height and the speed for the
  // landing and taxi lights). The status line keeps its `night` for the rail.

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    let pubH = null, pubN = null, pubX = null, pubZ = null;   // G710: the height asked and the point flown to, this step (ap.intent)
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    const c = sim.ctl, onG = sim.wheelsOnGround();
    // B5: THE DATUMS ARE LATCHED ON THE GROUND. restAlt / refAlt (and gearH
    // below) were latched on the FIRST update, wherever the aeroplane was: a
    // flight begun by hand and handed to the pilot at 300 m took 300 m as the
    // field and the CG's height over the terrain as its gear, and flared 300 m
    // up. On the wheels nothing changes (bit-identical for a ground start); in
    // the air the datum is the departure field's elevation + the design pose's
    // rest height (restH0), and gearH waits for the wheels.
    // (G381: the attitude filters start FROM the attitude — SV.sense's first step)
    if (ap.restAlt === null) {
      const r0 = onG > 0 ? cg[1] : ((ap.route && ap.route.from && ap.route.from.elev) || 0) + restH0;
      ap.restAlt = r0; ap.refAlt = r0;
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
    if (gearH == null && onG > 0 && world && typeof world.terrainH === 'function') gearH = cg[1] - terrainNow;   // B5: on the wheels only
    const aglG = (world && typeof world.terrainH === 'function') ? aglT - (gearH ?? restH0) : agl;
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
    // G630: A TARGET THAT JUMPS IS NOT A RATE. A new target heading (a mode
    // change, a taxi point shifted, a look-ahead index stepping past a
    // corner) moves e in one step; no aeroplane's target turns 3 rad/s, so
    // a step past 0.05 rad is carried into the rate filters' memory (eP,
    // eAP) and they see only the continuous part — a bumpless transfer.
    // G780: ...UNLESS THE STEP IS A TURN SAMPLED. A target commanded a few
    // times a second (GATE SOAR's orbit law re-selects HDG every 0.25 s,
    // 0.11 rad a time at the circle's 0.45 rad/s) moves in steps that are
    // its RATE: carried into the memory, the rate filters saw the nose turn
    // and never the target, hdgD x eAR became -0.9 x 0.45 rad of bank against
    // the 0.72 asked, and the glider circled off the core (climb 0.59 ->
    // 0.21 m/s). A step is a jump only if no aeroplane could have turned it
    // since the target last moved (1 rad/s, over 0.5 s at most): a target
    // that moved one step ago (PATH's tangent, the look-ahead, the CROSSWIND
    // entry's -pi and its 0.3 rad/step sweep, FINAL's one-step 0.6 rad
    // glitch) is judged on 0.05 rad exactly as G630 wrote it (SV.sense)
    const tgtH = Math.atan2(tz, tx);
    let eA = e;
    const tl2 = Math.hypot(vcg[0], vcg[2]);
    if (tl2 > 5) {
      const tkx = vcg[0] / tl2, tkz = vcg[2] / tl2;
      eA = Math.atan2(tz * tkx - tx * tkz, tx * tkx + tz * tkz);
    }

    const thRaw = Math.asin(clamp(-xA[1], -1, 1));
    const phRaw = Math.atan2(-zR[1], yU[1]);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(Vt, 5);
    if (pendReEng) {
      pendReEng = false;
      SV.relatch();                           // every servo memory, from the live state (SV.sense)
      brakeRamp = 0;
      ap.budget = Math.max(ap.budget, ap.t + 400);
    }
    // THE SENSING (39b_servos.js): the attitude and rate filters, the bumpless
    // target, the wrapped rates, the slow roll / climb / acceleration filters
    SV.sense(dt, e, eA, tgtH, thRaw, phRaw, beta, V, Vg, vcg[1], onG);
    const th = SV.th, ph = SV.ph, q = SV.q, p = SV.p, eR = SV.eR, accF = SV.accF, vsSlow = SV.vsSlow;

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

    // ---- THE SERVOS: one module, 39b_servos.js (G1570) ---------------------------
    const holdPitch = SV.holdPitch, rollTo = SV.rollTo;
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
      // G630: THE TARGET IS THE PATH'S TANGENT. PATH never wrote
      // ap.targetDir, so the yaw damper's eA (the track against the target)
      // was measured against the TAXI's last heading for the whole circuit:
      // on the downwind, 180 deg from the runway's, it sat on +-pi and the
      // damper rang the rudder stop to stop (6 s, the Jolene playtest). The
      // tangent is interpolated between the 5 m samples (a fillet's heading
      // steps 1-2 deg per sample, and the damper differentiates it)
      const q0 = P[L.i], qd = (cg[0] - q0.x) * Math.cos(q0.hdg) + (cg[2] - q0.z) * Math.sin(q0.hdg);
      const qa = qd >= 0 ? q0 : P[Math.max(0, L.i - 1)], qb = qd >= 0 ? P[Math.min(P.length - 1, L.i + 1)] : q0;
      const qf = qb.s > qa.s ? clamp((qd >= 0 ? qd : qd + (qb.s - qa.s)) / (qb.s - qa.s), 0, 1) : 0;
      const hT = qa.hdg + qf * wrapPi(qb.hdg - qa.hdg);
      ap.targetDir = [Math.cos(hT), 0, Math.sin(hT)];
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
    const airLateral = (bl = bankLim) => SV.airLateral(bl);
    const speedThrottle = SV.speedThrottle, holdVS = SV.holdVS;
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
      // G970: THE SERVO'S LIMIT IS THE ELEVATOR'S TOO. holdPitch's authority
      // is P + an integrator clamped at SV.IthMax: with 5 deg of attitude to go
      // it tops out near 0.26 and never reaches the 0.30 this read. The
      // Caravan-alike (drawn tail, half tanks) flew a 5 km final 12 m under
      // the slope, 2 m/s fast, thC on thMax (11.2 deg) and the nose at 6.1 on
      // 0.24 of elevator, the throttle on its floor - and went around twice
      // for the terrain. The integrator on its clamp with the attitude short
      // of the command is the same "cannot hold this speed"
      const eSat = (SV.aDe > 0.30 || (SV.Ith >= SV.IthMax - 1e-3 && SV.thCA - th > 0.03)) && V > (o.ias || A.VAppr) + 0.5;
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
                : (satLo && V - Vc > 1 && o.vs == null) ? (o.spdPri && ap.phase === 'FINAL' ? 2 : 0.5)   // G1936: a short final holds its SPEED (the slip takes the height)
                : 1;
      tWk += clamp(wKt - tWk, -0.5 * dt, 0.5 * dt);
      // the balance: pitch = trim(V) + gamma demanded + P + I on the balance-rate error
      const SEBr = (2 - tWk) * tHdot - tWk * V * accF / g9, SEBrC = (2 - tWk) * hdotC - tWk * V * VdotC / g9;
      const eB = (SEBrC - SEBr) / Math.max(V, 8);
      tIpit = clamp(tIpit + 0.15 * eB * dt, -0.10, 0.10);
      const gammaC = (tWk < 1.99 ? hdotC / Math.max(V, 8) : 0);
      const thC = clamp(tAlphaAt(V) + gammaC + 0.8 * eB + tIpit, A.vsFloor ?? -0.08, o.thMax ?? A.thMax);
      holdPitch(thC);
      tecsDbg = { hdotC, Vc, STEr, STErC, ff, thr: c.thr, wK: tWk, thC, eB, vsUp, vsDn };
    };
    const steerK = SV.steerK, groundAil = SV.groundAil;
    const groundSteer = () => { tailUpNow = SV.groundSteer(thRest, F); };
    const taxi = (Vtgt) => SV.taxi(Vtgt, taxiFF(), Math.min(A.taxiThrMax ?? 0.85, GP.cap));
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
      // G435 GLIDE: TECS winds its throttle to the stop asking an engine that
      // is dead (which is what puts the speed on the elevator); the lever the
      // cockpit shows stays closed
      if (SEL.deadThr) c.thr = 0;
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
        case 'DECRAB':
          // G381 (the sign: -K x e, the ground's own) + G970 (the slow integral): 39b_servos.js
          SV.decrab(0.12);
          break;
        case 'RWY': groundSteer(); break;
        case 'TAXI': c.dr = SEL.dr; break;   // the follower's rudder (da from the governor)
        case 'NONE': c.dr = 0; c.da = 0; break;
        default: break;
      }
      // G1936: THE SLIP'S RUDDER, mixed over the lateral law's (whose bank then holds the track)
      if (slipK > 0 && (AF.lat === 'LOC' || AF.lat === 'PATH')) c.dr = (1 - slipK) * c.dr + slipK * slipSg * (A.drSlip ?? 0.80);
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
      // G970: ...AND THE FLOOR IS A SPEED. Past 0.30 of elevator the assist
      // came in the last half-second: the stick winds back over the whole
      // hold-off while the wing bleeds, and in ground effect (the ground's
      // image takes the tail's downwash away) the attitude falls short of what
      // the servo asks long before the stop - the C172-alike held 6.9 deg on
      // 0.25-0.29 of elevator from 3.5 m, bled 24 -> 22 m/s (1.07 Vs0) and
      // arrived at 2.0 m/s; the Stearman-alike held 11 deg from 2.2 m and
      // arrived at 1.5 at its tunnel's ground-effect limit, 1.14 Vs. Under
      // 1.15 Vs0 with the stick back the power comes in (0.5 a second), as a
      // pilot cushions a flare the elevator cannot finish, up to the assist's
      // own 0.40 (0.30 held the C172 in x2 to 1.04 Vs0); the hold-off asks a
      // firmer sink there (below). C172 2.10 -> 1.14 m/s at 1.09 Vs0 (x2:
      // 2.34 -> 1.21 at 1.07), Stearman 1.57 -> 1.17. The fast arrival's
      // trickle cap and the unwind are unchanged
      if (ap.phase === 'FLARE' && AF.thr === 'IDLE') {   // G399.7: FINAL's half retired — TECS carries its own saturation (the raised Vref)
        const slow = V < (A.flareFloorK ?? 1.15) * (sheetOf() && sheetOf().Vs0 ? sheetOf().Vs0 : (A.VRot || 18) / 0.99);
        const sat = SV.aDe > 0.30 || (slow && SV.aDe > 0), free = SV.aDe < 0.22 && !slow;
        // in the flare the assist depends on the SPEED: a slow arrival (the
        // C172-alike at 1.13 VRot, full flap) needs the power to finish its
        // hold-off (1.9 -> 1.0 m/s); a fast one (the Caravan-alike at 1.6
        // VRot, no flap, the tail out of authority) only floats on it — 836 m
        // of run, stopped 8 m from the end — so it gets a trickle (0.12: 0.59 m/s, 669 m; at 0.05 it arrived at 2.3 m/s)
        const fast = V > 1.35 * (A.VRot || 18);
        const cap = ap.phase === 'FLARE' ? (fast ? (A.apAssistFlareFast ?? 0.12) : slow ? (A.apAssistMax ?? 0.40) : (A.apAssistFlare ?? 0.30))
                  : (A.apAssistMax ?? 0.40);
        // G1949 (PILOT-ONE-2): WHERE THE STRIP IS TIGHT THE POWER ARRESTS A HARD ARRIVAL, IT DOES NOT HOLD THE AEROPLANE
        // OFF. Under 1.15 Vs0 the assist cushioned the Cub's hold-off at East Point (150 m) at 0.75 m/s of sink on 0.2-0.3
        // of throttle from 1 m: it touched 55 m in and rolled 23 m past the end (no assist at all: 39 m in, 2 m left - but
        // at Jumbo Mine's 8.5 deg slope the Cub then arrived at 2.9 m/s). So on a short field with less strip ahead than
        // the short stop + 40 m (flLeft, FLARE) it winds up only while the sink is over 1 m/s and comes off at once (1/s)
        // under 0.9: the landing is put on, firmly, not floated. With the room (Jumbo Mine: ~220 m ahead for ~130) the
        // cushion is the one every landing has
        const tight = ap.shortFld && flLeft < stopDistShort(V) + 40, sinkNow = -vcg[1];
        pAsst = clamp(pAsst + (sat && !(tight && sinkNow < 1.0) ? (A.apAssistRate ?? 0.50) : (tight && sinkNow < 0.9) ? -1.0 : free ? -0.25 : 0) * dt, 0, cap);
        if (pAsst > 0) c.thr = clamp(c.thr + pAsst, 0, 1);
      } else pAsst = 0;
      AF.fd = { pitch: SV.thCA, bank: SV.phCA };
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
          // B6: THE ACCEPTED CEILING IS THE CIRCUIT'S. Only hCruise came down;
          // every leg kept its planned L.h, legAlt asked it again the next step,
          // dh > 40 put climbMode back on and the aeroplane went on climbing for
          // the height it had just given up — the verdict was a word. The legs
          // above the ceiling come down to it, and their published heights
          // (hPlan, G710) are planned again.
          if (ap.legs) {
            for (const L of ap.legs) if (L.h != null && L.h > ap.hCruise) L.h = ap.hCruise;
            planLegH(ap.legs);
          }
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
    const legSpeed = (L) => L.V === 'turn' ? VTurnLeg() : L.V === 'climb' ? ap.VClimb : ap.VCruise;
    const goAround = why => {
      ap.gaN = (ap.gaN || 0) + 1; ap.gaWhy = why;
      say('go-around', why + ' (attempt ' + ap.gaN + ')');
      go('GOAROUND'); gaT = 0; SV.IthMaxT = 0.15; finalLevel = null; tVAdapt = 0; tDeSatT = 0;
      SV.thrC = A.thrCruise; thLift0 = th;
      // G1936: TWICE ROUND A SHORT FIELD IS A DIVERSION, NOT A COMMITTED THIRD TRY. The go-around count is capped
      // at two and the third arrival is committed - into the trees past East Point's end on the user's Cub (touched
      // 81 m in, stopped 74 m past it). A pilot diverts: the nearest strip this gear lands on with room for the
      // landing run (1.6 x the sheet's, 450 m at least), said, flown as a cross-country from here
      if (ap.shortFld && ap.gaN >= 2 && world && world.aerodromes) {
        const need = Math.max(450, 1.6 * ((sheetOf() && sheetOf().LDGrun) || 0));
        let best = null, bd = Infinity;
        for (const a of world.aerodromes) {
          if (a === ap.route.to || !(a.len >= need)) continue;
          if (typeof stripAllows === 'function' && !stripAllows(gearK, a).ok) continue;
          const dd = Math.hypot(a.x - cg[0], a.z - cg[2]);
          if (dd < bd) { bd = dd; best = a; }
        }
        if (best) {
          say('divert', 'twice round ' + (ap.route.to.name || ap.route.to.id) + ' — diverting to ' + (best.name || best.id) + ' (' + Math.round(best.len) + ' m, ' + (bd / 1000).toFixed(1) + ' km)');
          ap.route = { from: ap.route.to, to: best }; ap.xc = true; ap.gaN = 0; committed = false; ap.diverting = true;
          ap.budget = Math.max(ap.budget, ap.t + routeBudget(ap.route.from, best));
        }
      }
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
      const straightIn = P.join !== 'downwind' && sNow < P.sIaf - 300 && cosA > 0.5;   // P1.E: a 'downwind' protocol never straight-in
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
    // G630.1: the nearest LEVEL ground on the strip still ahead of a rollout
    // stopped on a grade (grade over +-20 m under 1 %, 25 m short of the end,
    // 400 m at most), or null — none needed, none there, no terrain
    const flatAhead = () => {
      const to = ap.route && ap.route.to;
      if (!to || !to.len || !world || typeof world.terrainH !== 'function' || sim.hydro || to.surface === 4 || Math.abs(gGrade) < 0.015) return null;
      const ux = ap.dirX * F.ux, uz = ap.dirX * F.uz;
      const rem = (to.x + ux * to.len / 2 - cg[0]) * ux + (to.z + uz * to.len / 2 - cg[2]) * uz;
      const gAt = d => (groundH(cg[0] + ux * (d + 20), cg[2] + uz * (d + 20)) - groundH(cg[0] + ux * (d - 20), cg[2] + uz * (d - 20))) / 40;
      for (let d = 10; d <= Math.min(rem - 25, 400); d += 10)
        if (Math.abs(gAt(d)) < 0.01) return { x: cg[0] + ux * d, z: cg[2] + uz * d, ux, uz, d, t0: ap.t };
      return null;
    };
    const FS = def.params.flaps;
    const flapsTo = (tgt) => {
      if (!FS) return;
      const rr = (FS.rate ?? 0.15) * dt;
      c.flap = clamp(c.flap + clamp(tgt - c.flap, -rr, rr), 0, 1);
    };
    let flapTgt = 0;
    const fTO = FS ? (FS.to ?? 0) : 0, fLDG = FS ? Math.min(FS.ldg ?? 1, fLandCap) : 0;

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
    // G435: OUT OF ENERGY, SAID AND FLOWN. The user's 2 kWh trainer ran its
    // pack down on the downwind leg and this pilot held the throttle at
    // 1.00 into a spiral and the sea, its only word "no climb left". The
    // solver now says `starved` (30_solver.js, the tanks or the pack
    // stopping every engine); airborne, the pilot says it and glides for a
    // FORCED LANDING - the nearest strip when it is inside the glide cone,
    // straight ahead otherwise - through the flare it already knows. A
    // starvation in the flare or on the wheels changes nothing but the note.
    // The emergency's finer judgement (a field chosen, a turn back, the
    // wind) is the pilot track's (PLAYTEST-TRIAGE A8); this is the floor.
    if (sim.fuel && sim.fuel.starved && !starvedSaid) {
      starvedSaid = true;
      const what = sim.fuel.kind === 'battery' ? 'out of charge' : 'out of fuel';
      const landingPh = ap.phase === 'FLARE' || ap.phase === 'ROLLOUT' || ap.phase === 'STOPPED' || ap.phase === 'ABORT' || ap.phase === 'PUTDOWN';
      if (onG === 0 && !landingPh && !BX.on) {
        // the glide cone: the sheet's L/D when it has one, else a modest 8
        const ld = (SH && SH.LDbest > 0) ? SH.LDbest : 8;
        let best = null, bestD = Infinity;
        for (const a of (world && world.aerodromes) || []) {
          if (typeof stripAllows === 'function' && !stripAllows(gearK, a).ok) continue;   // G1375: never a forced landing on the wrong surface
          const d = Math.hypot(a.x - cg[0], a.z - cg[2]);
          if (d < bestD) { bestD = d; best = a; }
        }
        const reach = best && bestD < 0.7 * ld * Math.max(0, aglG);
        glideTo = reach ? best : null;
        glideHdg = Math.atan2(nose[1], nose[0]);
        say('out-of-energy', what + ' at t=' + Math.round(ap.t) + ' s, ' + Math.round(aglG) + ' m up — engines stopped; gliding ' +
            (reach ? 'to ' + (best.name || best.id) + ', ' + Math.round(bestD) + ' m away' : 'straight ahead for a forced landing'));
        ap.report.outcome = ap.report.outcome || 'forced-landing';
        committed = true;
        go('GLIDE');
      } else say('out-of-energy', what + ' at t=' + Math.round(ap.t) + ' s — engines stopped');
    }
    // ...and UNDER THE WATER the flight is over (30_solver.js out.submerged)
    if (o_.submerged && ap.phase !== 'STOPPED') {
      say('in-the-water', 'under the water at t=' + Math.round(ap.t) + ' s — the flight is over');
      ap.report.outcome = ap.report.outcome || 'in-the-water';
      go('STOPPED');
    }
    const phRun = ap.phase, legRun = ap.legI;   // G710: the phase and leg this step flies (ap.intent names them, not the next)
    if (ap.phase !== 'FINAL') slipK = 0;   // G1936: the slip is the short final's only
    if (!BX.on && c.brakeD) c.brakeD = 0;    // G1938: the differential brake is the pivot's only
    // G1938 (PILOT-ONE, the user: "No autopilot manages to turn sharp for a 180 degrees. Most planes should allow
    // for almost static turn, which is required for small landing strips ... turning at the end of a 1 way strip").
    // THE PIVOT: what a taildragger pilot does where the wheels cannot steer the turn - stopped, full rudder toward
    // the turn, the INSIDE BRAKE locked (sim.ctl.brakeD, G1938's differential brake), a burst of power on the
    // rudder and the outside wheel, the stick neutral so the tail is light, power off as the nose comes round,
    // both brakes to stop it on the heading. Measured on the user's Cub (scratch pivot): the tailwheel's steering
    // alone turns it on a 9.4 m radius (19 m across, East Point is 12 m wide); stick back pins the tail and it
    // barely turns (16 deg in 30 s at 0.3 throttle); stick neutral at 0.7 it turns 180 deg in 8.6 s on 2.6 m.
    // pivotFly(hdg) flies one step toward the world heading `hdg` (rad, atan2(z, x)); true once on it and still.
    // THE WAY ROUND IS CHOSEN ONCE (piv.sg: +1 left, the path's own turn or the shorter way at the start): a target
    // 180 deg behind the nose is "left" or "right" by a degree of wobble, and re-deciding every step rocked the
    // Cub +-4 deg on the spot for 60 s (scratch turnaround, the first cut)
    const pivotFly = (hdgT) => {
      const err0 = wrapPi(hdgT - Math.atan2(nose[1], nose[0]));   // > 0: the target LEFT of the nose (e's sign)
      if (!piv.sg) piv.sg = err0 >= 0 ? 1 : -1;
      // the angle still to turn the chosen way, (-0.6, 2 pi - 0.6]: a small overshoot reads negative, not a full turn
      let rem = piv.sg * err0; if (rem < -0.6) rem += 2 * Math.PI;
      const err = piv.sg * rem, sg = rem >= 0 ? piv.sg : -piv.sg, r = Math.abs(SV.eR);
      if (!piv.thr) piv.thr = A.pivotThr0 ?? 0.35;
      ap.targetDir = [Math.cos(hdgT), 0, Math.sin(hdgT)];
      // on the heading within ~9 deg and not swinging fast: the taxi's own steering takes the rest rolling
      if (Math.abs(err) < 0.15 && r < 0.20 && Vg < 1.0) { c.brakeD = 0; return true; }
      const slow = Vg < (A.pivotVg ?? 1.2);
      const near = Math.abs(err) < 0.45;                           // ~25 deg: the power off, the turn coasts in
      // the throttle walks up until the nose turns at ~20 deg/s, back down if the aeroplane starts to roll away
      // (the last 25 deg at ~7 deg/s: a fixed 60 % there crawled the Cub's last 20 deg for 27 s)
      const rT = near ? 0.12 : 0.35;
      if (slow) piv.thr = clamp(piv.thr + (r < rT ? 0.15 : -0.30) * dt, 0.15, A.pivotThrMax ?? 0.75);
      const noseDown = thRest != null && th < thRest - 0.10;      // the tail coming up: no power
      // near the heading the power comes off while the nose still swings, and back on (60 %) if it has stopped short
      const thr = (!slow || noseDown || (near && r > rT)) ? 0 : piv.thr;
      // the last 25 deg proportional (bang-bang there hunted +-4 deg about the heading for 60 s)
      const k = near ? clamp(Math.abs(err) / 0.45, 0.25, 1) : 1;
      // the SIGN: e > 0 (the target at a larger atan2(z, x) angle) is turned by NEGATIVE rudder - groundSteer's
      // own -kP x e - and the differential brake turns the aeroplane the way the rudder of its sign does (G1938)
      engage('TAXI', 'DE', 'SET', { dr: -sg * k, de: trike ? (A.taxiDe ?? 0.30) : 0, thr });
      c.brakeD = slow ? -sg * k : 0;
      c.brake = slow ? (near && r > 0.15 ? 0.3 : 0) : 0.6;
      c.da = groundAil(0, 0.25);
      return false;
    };
    if (BX.on) boxFly(); else
    switch (ap.phase) {
      case 'GLIDE': {
        // best glide toward the strip or the heading held, no power, flaps
        // as for the landing once low; the hold-off flare from FINAL's height
        // TECS, not FLC: FLC's pitch floor (+0.02 rad) is a climb's and held
        // the nose up with no power - the first cut mushed on at 1.01 Vs and
        // 6 m/s of sink. TECS asked for the sheet's idle sink at Vbg puts the
        // speed on the elevator once the (dead) throttle saturates.
        const vbg = Math.max(A.VAppr || 18, (SH && SH.Vbg > 0) ? SH.Vbg : 0) || 20;
        const tec = { vs: -tSinkIdle, alt: null, gs: null, vsUp: null, vsDn: null, ias: vbg, deadThr: true };
        if (glideTo) engage('TRK', 'TECS', 'TECS', Object.assign(tec, { trk: [glideTo.x, glideTo.z], bank: 0.35 }));
        else engage('HDG', 'TECS', 'TECS', Object.assign(tec, { hdg: glideHdg, bank: 0.25 }));
        flapTgt = aglG < 60 ? fLDG : 0;
        setStatus('gliding for a forced landing', [
          cond('height', Math.round(aglG), 0, aglG > 0, 'm'),
          cond('airspeed', V, vbg, Math.abs(V - vbg) < 2, 'm/s')]);
        if (aglG < (A.flareK ?? 1.3) * A.flareAgl) {
          go('FLARE'); thFlare0 = th; SEL.deadThr = false; altG = 0;
          flTau = clamp(A.flareAgl / Math.max(0.5, -vcg[1]), 2.0, 4.5);
          flCap = trike ? A.thMax
                : Math.min(A.thMax, (thRest != null ? thRest : A.liftoffTh) + (A.flareOverRest ?? 0.035));
          flCap = Math.max(flCap, thFlare0 + 0.03);
          flI = 0; flVsF = vcg[1];
        }
        break;
      }
      case 'DEPART': {
        // the panel arc: the pilot runs the checklist — mags on, engine
        // running — writing exactly what the cockpit key writes, so a key
        // the hand turned off comes back on when the pilot takes over
        if (sim.setEngine && sim.eng)
          for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
        let next;
        if (ap.atHold) {
          const H = ap.atHold; ap.atHold = null;
          setTakeoffDir([snap(Math.cos(H.hdg)), snap(Math.sin(H.hdg))]);
          ap.path = null; ap.stopAfterLineup = true; next = 'STOP';
        } else next = planDeparture(cg, nose);
        engage('NONE', 'DE', 'SET', { de: A.taxiDe ?? 0.30, thr: 0 });
        go(next === 'STOP' ? (Vg < 0.3 ? 'HOLD' : 'STOP') : next === 'LINEUP' ? 'LINEUP' : 'TAXI');   // G1938: the short strip's turn on the spot
        setStatus('planning the departure', []);
        break;
      }

      case 'TAXI': {
        if (ap.path && piv) {
          setStatus('turning on the spot (the inside brake, full rudder)', [cond('heading to go', Math.round(Math.abs(wrapPi(piv.hdg - Math.atan2(nose[1], nose[0]))) * 57.3), 6, false, 'deg')]);
          if (pivotFly(piv.hdg) || ap.t - piv.t0 > 40) { ap.pathI = piv.j; piv = null; SV.relatch(); }
          break;
        }
        if (ap.path) {
          const L = pathLocate(ap.path, ap.pathI, cg[0], cg[2]);
          ap.pathI = L.i; taxiXT = L.ey; taxiSRem = L.sRem;
          // G1938: A HAIRPIN THE WHEELS CANNOT STEER is turned on the spot: a bend ahead tighter than 1 / (1.1 RgMin)
          // turning more than 150 deg in all (a U-turn) - stop at its entry, pivot to the heading the path leaves it on, carry on
          // from there (the lane beside is joined on the follower's own cross-track law)
          // ...AND ON A SHORT STRIP (under 300 m) EVERY AEROPLANE PIVOTS AT A HAIRPIN: the site's lane U-turn is a
          // 12 m arc 15 m from the end (G527), and the C172 (a nosewheel that turns on 4.4 m) swung it 7.7 m past
          // Jumbo Mine's end, 10.7 s off the strip - a pilot there turns on a toe brake instead
          // ...ONLY ON A STRIP UNDER 300 m: on a long one the site's lane U-turn fits, and the follower's own wide
          // turn is the base's to the bit (pivoting at Jolene HOME's lane U-turn, a fillet a hair under the Cub's
          // 9.4 m, cost GATE LINEUP 26 s and a roll 12.7 m off the skip's pose)
          const shortHere = (ap.route.from.len || 1100) < 300;
          const Rpiv = Math.max(RgMin, 13);
          // (a TAILDRAGGER's: the C172's nosewheel pivot at East Point's lane U-turn looped its replanning and never
          // rolled - a tricycle steers the U-turn as before; its wide swing at Jumbo Mine's end is OWED, G1938)
          if (shortHere && isFinite(Rpiv) && !trike) {
            const P = ap.path.pts, s0 = P[L.i].s;
            let b0 = -1;
            for (let k = L.i; k < P.length && P[k].s - s0 < 3 + 1.5 * Vg; k++) if (Math.abs(P[k].kap) > 1 / (1.1 * Rpiv)) { b0 = k; break; }
            if (b0 >= 0) {
              let b1 = b0, turn = 0;
              while (b1 + 1 < P.length && P[b1 + 1].s - P[b0].s < 6 * Rpiv) {
                turn += wrapPi(P[b1 + 1].hdg - P[b1].hdg); b1++;
                if (Math.abs(P[b1].kap) < 0.5 / Rpiv && Math.abs(turn) > 0.5) {
                  let k2 = b1; while (k2 + 1 < P.length && P[k2 + 1].s - P[b1].s < 4 && Math.abs(P[k2 + 1].kap) < 0.5 / Rpiv) k2++;
                  if (P[k2].s - P[b1].s >= 3.5 || k2 === P.length - 1) break;
                }
              }
              // A HAIRPIN IS A U-TURN (150 deg and more): a 90 deg taxi corner tighter than the wheels steer is steered
              // round as it always was - pivoting there beat the stock's taxi rudder to 62 reversals a minute (GATE
              // PILOTACT) and swung the Cub's wing within 5 m of Jolene's apron fence (GATE LINEUP)
              // G1949 (PILOT-ONE-2): ...AND ONLY ONE ENTERED ON THE STRIP'S CENTRELINE (within 2 m), as at East Point's lane
              // U-turn after a landing. An AUTHORED TEARDROP (MILL-TAXI's at Jumbo Mine, rMin 8 m) swings its lobe off the
              // centreline first: pivoting where its tight part began (4.4 m off, the CG 3 m from the clinic) put the Cub's
              // wing into the clinic and left it stuck 6 m off the centreline - the follower flies the teardrop clean, as before
              const fr = ap.route.from, fh = fr.hdg || 0;
              const crB0 = -(P[b0].x - fr.x) * Math.sin(fh) + (P[b0].z - fr.z) * Math.cos(fh);
              if (Math.abs(turn) > 2.6 && Math.abs(crB0) <= 2) {   // (Rpiv: 13 m at least - the site's lane U-turn is a 12 m arc)
                piv = { hdg: P[b1].hdg, j: b1, t0: ap.t, thr: 0, sg: turn >= 0 ? 1 : -1 }; pivN++;
                if (!pivSaid) { pivSaid = true; say('pivot', 'a ' + Math.round(Math.abs(turn) * 57.3) + ' deg turn tighter than the wheels steer (' + RgMin.toFixed(1) + ' m) — turning on the spot'); }
                pivotFly(piv.hdg);
                break;
              }
            }
          }
          const K = pathLook(ap.path, L.i, Vg);
          const eXT = clamp(Math.atan2(0.9 * L.ey, Vg + 1.0), -0.6, 0.6);
          const hT = K.hdgL - eXT;
          // G630: THE LOOK-AHEAD TARGET, FILTERED (0.4 s). hdgL is a sample's
          // heading a look-ahead away, and it STEPS as the index passes each
          // sample of a bend (and as the look-ahead shrinks with the speed):
          // the rudder differentiated every step into a kick
          const hF = SV.taxiHeading(hT);
          ap.targetDir = [Math.cos(hF), 0, Math.sin(hF)];
          { const pe = ap.path.pts[ap.path.pts.length - 1]; if (pe) { pubN = 'HOLD'; pubX = pe.x; pubZ = pe.z; } }
          const drFF = -Math.atan(TW.Lwb * K.kapL) / Math.max(0.05, TW.steer);
          const drMaxG = 0.85 - 0.40 * clamp((Vg - 6) / 4, 0, 1);
          // a long straight (a backtrack) is taxied faster; the bend ahead
          // and the stop still govern through pathSpeed
          const vMax = L.sRem > 150 && Math.abs(L.ey) < 2 ? Math.min(A.taxiVFast ?? 8, 1.6 * taxiV) : taxiV;
          // G630: groundSteer's gain schedule (speed, mass), and NO rate
          // term: at taxi speed the wheel steers the heading kinematically on
          // either gear, and the rate term only differentiated the contact's
          // yaw jitter (the rudder lane's 2.5-4 Hz chatter, 76-290 reversals
          // a minute on the stock, the C172 and the aluminium C172)
          engage('TAXI', 'DE', 'TAXI', { dr: SV.taxiRudder(drFF, drMaxG),
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
        pubN = 'TAXI POINT'; pubX = ap.taxiTgt[0]; pubZ = ap.taxiTgt[1];
        // G1938: the point BEHIND the aeroplane (a backtrack from where the landing stopped) is turned to on the spot
        if (!trike && isFinite(RgMin) && (ap.route.from.len || 1100) < 300 && (piv || (Math.abs(e) > 1.4 && Vg < 3 && dist > 3 * RgMin))) {
          if (!piv) { piv = { hdg: Math.atan2(ddz, ddx), j: 0, t0: ap.t, thr: 0 }; if (!pivSaid) { pivSaid = true; say('pivot', 'the taxi point is behind — turning on the spot'); } }
          setStatus('turning on the spot (the inside brake, full rudder)', [cond('heading to go', Math.round(Math.abs(e) * 57.3), 6, false, 'deg')]);
          if (pivotFly(piv.hdg) || ap.t - piv.t0 > 40) { piv = null; SV.relatch(); }
          break;
        }
        ap.targetDir = [ddx / dist, 0, ddz / dist];
        engage('TAXI', 'DE', 'TAXI', { dr: SV.taxiRudder(0, 0.45), de: A.taxiDe ?? 0.30,
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
        // G1938: facing more than ~100 deg away from the take-off direction (a one-way strip's far end), the line-up
        // is a turn on the spot, not a circle round the strip's edge
        if (!trike && isFinite(RgMin) && (piv || (alig < -0.2 && Vg < 3 && RgMin > 0.5 * (ap.route.from.wid || 30) - Math.abs(sCr)))) {
          if (!piv) { piv = { hdg: Math.atan2(-F.uz, -F.ux), j: 0, t0: ap.t, thr: 0 }; if (!pivSaid) { pivSaid = true; say('pivot', 'lined up the wrong way on a strip narrower than the turn — turning on the spot'); } }
          setStatus('turning on the spot (the inside brake, full rudder)', [cond('aligned', Math.round(Math.acos(clamp(alig, -1, 1)) * 57.3), 9, false, 'deg')]);
          if (pivotFly(piv.hdg) || ap.t - piv.t0 > 40) { piv = null; SV.relatch(); }
          break;
        }
        engage('TAXI', 'DE', 'TAXI', { dr: SV.taxiRudder(0, 0.45), de: A.taxiDe ?? 0.30,
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
          const hT = K.hdgL;
          const hF = SV.taxiHeading(hT);
          ap.targetDir = [Math.cos(hF), 0, Math.sin(hF)];
          dr = SV.taxiRudder(0, 0.85);
        }
        engage('TAXI', 'DE', 'SET', { dr, de: A.taxiDe ?? 0.30, thr: 0 });
        c.brake = 0.7; c.da = groundAil(0, 0.25);
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
          // G1937 (PILOT-ONE, the user: the take-off "pulls on the stick much too fast, and hops" - on the WATER).
          // ON THE WATER THE POWER COMES IN OVER SECONDS. The throttle went from 0 to full in one step at 0.5 s:
          // on the v7 twin on floats (two 582s over the CG, undersized floats) the bow dug in at 2 m/s - the trim
          // -68 deg at 2.7 s, near capsize - and on the ultralight the hull porpoised -6 <-> +8 deg through the
          // hump. A seaplane pilot opens the throttle smoothly with the bow up; measured (pilot_one_trace, scratch
          // water_exp): a 4 s ramp keeps the twin's trim at +1.4..+13.7 deg and it leaves the water once at 28.1 m/s
          // (base: never airborne in 150 s); the ultralight's porpoise is gone (trim from +0.1, lift-off unchanged at
          // 20.9 m/s), the Wipline C172 unchanged (27.7 m/s, 345 m). Back stick through the hump changed nothing
          // (G396.4 measured why it is neutral)
          if (sim.hydro) { if (rollS0 === null) thrRollW = 0; thrRollW = Math.min(capT, thrRollW + dt / (A.waterThrRampS ?? 4)); thrRoll = thrRollW; }
        }
        if (thRest === null) thRest = th;
        if (rollS0 === null) {
          rollS0 = sAl; committedTO = false; humpR = humpPk = 0; humpPast = false;
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
          const runNeed = sheetOf() && sheetOf().TORun ? sheetOf().TORun : null;
          const short = !onWaterNow && runNeed != null && (from0.len || 1100) < 2.0 * runNeed;   // an accelerate-stop wants about two runs
          ap.dep = { technique: short ? 'short' : soft ? 'soft' : 'normal', Vx: sheetOf() && sheetOf().Vx ? Math.round(sheetOf().Vx * 10) / 10 : null,
                     runNeed: runNeed != null ? Math.round(runNeed) : null, len: from0.len || null, surface: from0.surface };
          ap.report.dep = ap.dep;
        }
        flapTgt = fTO;
        const runUsed = Math.abs(sAl - rollS0);
        const left = runwayLeft();
        const vr = A.VRot || 18;
        const avail = ap.route.from.len || 1100;
        const sd = stopDist(V), resv = reserveOf();   // G531: the field's reserve
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
        const canStopHere = left - sd >= resv;
        // G396.4: THE HUMP IS NOT A FAILED RUN. A seaplane at the hump reads
        // 0.1 m/s^2 for twenty seconds and then planes (the single 582:
        // 8.5 m/s from t 10 to 22, on the step at 24, unstuck at 35); the
        // accelerate-stop planner condemned it at 13 s. In the displacement
        // regime (the afterbody wet) the planner waits; on the step it judges.
        // G790: ...AND THE HUMP IS THE PEAK OF THE HULL'S RESISTANCE, not a wet afterbody alone. The user's
        // Cessna on floats (IO-360, 6.3 m hulls) ventilates its step at 6.9 m/s - the afterbody dry, the planing
        // lift over the buoyancy - and then ploughs on at 12-15 deg of trim, R/W 0.19-0.24, 0.15-0.3 m/s^2, for
        // 25 s until the resistance falls away at 11-13 m/s; it unsticks at 54 s in 690 m of the 1 500 m lane
        // (the sheet says 1 160). Judged at 9.9 s on the hump's acceleration it was condemned ("0.23 m/s^2 needs
        // 1 201 m more") on the game's SEA lane, every flight. The hull is past the hump once its resistance
        // (the floats' hydro force against the motion, over the weight, a 1 s filter) has fallen under
        // `humpOff` of the run's peak, and stays past it; until then the planner waits, as G396.4 wanted. A
        // hull that never gets over it still meets the user's rule below (the fraction of the run used).
        if (sim.hydro) {
          const vn = Math.max(0.5, Math.hypot(vcg[0], vcg[2]));
          let R = 0;
          for (const fx of sim.hydro.floats) if (fx.out && fx.out.F) R -= (fx.out.F[0] * vcg[0] + fx.out.F[2] * vcg[2]) / vn;
          humpR += Math.min(1, dt / 1.0) * (R / (sim.totalM * 9.81) - humpR);
          humpPk = Math.max(humpPk, humpR);
          if (humpPk > 0.05 && humpR < (A.humpOff ?? 0.6) * humpPk) humpPast = true;
        }
        const atHump = !!(sim.hydro && (sim.hydro.floats.some(fx => fx.out && fx.out.wetA > 0.2) || !humpPast));
        if (canStopHere) {
          // the prediction waits for the 2 s acceleration filter to settle
          // (three time constants after the throttle opens): at 3 s a slow
          // build read a third of its true acceleration and was condemned —
          // the Tiger Moth-alike on a hot day, 0.10 m/s^2 against 0.3 real
          if (V < vr && phaseT > 7 && accF > 0.02 && !atHump) {
            // GTRAM: LEFT DOWNHILL, THE SLOPE STILL TO COME PULLS TOO - off an altiport's flat top the measured
            // acceleration is the top's; the grade of the run that is left (less the grade already under the
            // wheels, which accF has) adds g x grade (the C172 was condemned at 12 m/s on the flat with the 10 %
            // ahead of it). Every other strip: 0
            let accX = 0;
            if (ap.route.from.altiport && ap.takeoffDir && world && typeof world.terrainH === 'function') {
              const T = ap.takeoffDir, ex = cg[0] + T[0] * left, ez = cg[2] + T[1] * left;
              const gAhead = (groundH(cg[0], cg[2]) - groundH(ex, ez)) / Math.max(20, left);
              accX = 9.81 * Math.max(0, gAhead + gGrade);
            }
            const dVr = (vr * vr - V * V) / (2 * (accF + accX));
            // P1.C short: the take-off must FIT, the stop is not asked (the
            // accelerate-stop is the long strip's luxury; on 340 m of gravel
            // the cub rejected at 7 s a run the sheet says it makes)
            // GTRAM: an ALTIPORT's departure is committed at brake release (the stop after Vr is asked on no slope:
            // on 10 % of downhill grass it is longer than the strip, and the cub was condemned needing 33 m of 227)
            const shortT = (ap.dep && ap.dep.technique === 'short') || !!ap.route.from.altiport;
            // GTRAM: an altiport's low end is the mountain falling away, not a fence - the run may use it all
            if (dVr > left - (shortT ? 0 : stopDist(vr)) - (ap.route.from.altiport ? 0 : resv))
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
          // G435: A NOSE-OVER IS SAID AS ONE. The user's pusher (985 N on a
          // boom-mounted engine) was thrown onto its nose in two seconds and
          // the verdict read "thrust is going nowhere" - true and useless.
          // Pitched past 12 deg nose-down on the wheels and not accelerating
          // there is no run to judge; the keel is on the ground. (A tail-high
          // roll on a high thrust line reads -8 deg at 9 m/s and is fine.)
          if (!reject && phaseT > 1 && onG > 0 && th < -0.21 && accF < 0.5 && !sim.hydro)
            reject = 'nose-over: ' + Math.round(-th * 180 / Math.PI) + ' deg nose-down on the wheels at V=' + V.toFixed(1) +
                     ' — the thrust line is pushing the nose into the ground (a high pusher, the mains under the CG)';
          if (!reject && phaseT > 8 && accF < 0.08 && V < 0.8 * vr && !atHump)
            reject = 'not accelerating (' + accF.toFixed(2) + ' m/s^2 at V=' + V.toFixed(1) + ') — thrust is going nowhere';
          // G1937: STUCK ON THE HUMP IS A REJECTION TOO. G396.4 / G790 taught the planner to wait through the hump
          // (0.15-0.3 m/s^2 for 25 s is a hull that gets over it); the user's Cessna 172 on floats (1135 kg, 2198 N
          // static: T/W 0.20) sat at 5.73 m/s with 0.00 m/s^2 for the whole run and the pilot ploughed on for
          // minutes. Twenty seconds at the hump with no acceleration at all (< 0.03 m/s^2), past the first 20 s, is
          // a hull the thrust cannot get over: said with its numbers
          humpStuckT = (sim.hydro && atHump && phaseT > 20 && accF < 0.03 && V < 0.6 * vr) ? humpStuckT + dt : 0;
          if (!reject && humpStuckT > 20)
            reject = 'stuck on the hump at V=' + V.toFixed(1) + ' (' + accF.toFixed(2) + ' m/s^2 for ' + Math.round(humpStuckT) + ' s) — the thrust cannot push the hull onto the step (lighter, more power, bigger floats)';
        } else if (V < vr) {
          // P1.C: PAST THE POINT OF STOPPING THE QUESTION IS WHETHER VR
          // COMES BEFORE THE FENCE, not whether a stop still fits (it does
          // not, by definition): the cub on 340 m of gravel was rejected at
          // 17.3 of 18.7 m/s with 217 m left, the C172 at 19.3 of 20.4 with
          // 249 m — both a second from flying
          const dVr = accF > 0.02 ? (vr * vr - V * V) / (2 * accF) : Infinity;
          if (dVr > left - (ap.route.from.altiport ? 0 : resv))   // GTRAM: an altiport's low end falls away (the rule above)
            reject = 'out of runway: ' + Math.round(left) + ' m left, Vr in ' + (isFinite(dVr) ? Math.round(dVr) + ' m' : 'no distance (not accelerating)') +
                     ', V=' + V.toFixed(1) + ' of ' + vr.toFixed(1) + ' needed';
          else if (!committedTO) {
            committedTO = true;
            say('committed-takeoff', 'past the point of stopping at V=' + V.toFixed(1) + ' with ' + Math.round(left) + ' m left — Vr in ' + Math.round(dVr) + ' m, continuing');
          }
        } else if (left < 0 && !(ap.route.from.altiport && V >= vr)) {   // GTRAM: past an altiport's end at Vr the ground falls away under a flying aeroplane
          reject = 'ran off the end at V=' + V.toFixed(1) + ' still on the wheels — will not unstick';
        } else if (!committedTO) {
          committedTO = true;
          say('committed-takeoff', 'past the point of stopping at V=' + V.toFixed(1) + ' with ' + Math.round(left) + ' m left — continuing');
        }
        setStatus('accelerating to rotation speed', [
          cond('airspeed', V, vr, V >= vr, 'm/s'),
          cond('runway left', Math.round(left), Math.round(sd + resv), left - sd >= resv, 'm'),
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
          pitch = V > vrT ? (A.thRotate ?? A.liftoffTh) + (PRA ? PRF.overRotate : 0)
                : (threePoint || softTO || V < (A.VTailUp ?? 0)) ? ((threePoint || softTO) ? Math.min(thRest, A.liftoffTh) : (A.thTailUp ?? 0.02))
                : (A.thTailUp ?? 0.02);
        } else if (V > vrT) { vert = 'PITCH'; pitch = (A.thRotate ?? A.liftoffTh) + (PRA ? PRF.overRotate : 0); }
        else if (softTO) deRoll = 0.20;                        // P1.C soft, a trike: the nosewheel light through the roll
        // G970: ON THE WATER THE RUN ATTITUDE IS NOT A WHEEL'S. G431's tail-up
        // attitude (liftoffTh - 0.05, the J-3's run a few degrees under its
        // fly-off one) reached the float card too, and G431 measured it there
        // (the crosswind run 35.8 deg); through the hump the attitude servo
        // pulled 0.47-0.66 of stick at 3-4 m/s, the hull porpoised -9 <-> +13
        // deg on a 1.5 s cycle, skipped off at 14.6 m/s, came back bow-down
        // and water-looped (78 deg, capsized - GATE SEAPLANE's crosswind,
        // first bad aa8b8a59). The water keeps the 0.02 it ran on before
        // (G396.4's stick law on top of it, unchanged): lift-off 7.8 s, 27.8
        // deg - G426's 27.7, the last good
        if (sim.hydro && vert === 'PITCH' && V <= vrT) pitch = 0.02;
        // G1937: THE STEP-ATTITUDE HOLD, a technique the pilot can fly (39b servoStepHold) - off by default (measured
        // no better with today's solver, see 39b); `A.stepHold` turns it on from stepV on the step to the pull
        if (sim.hydro && (A.stepHold || (PRA && PRF.stepHold)) && onG > 0 && onG <= 2 && V >= SERVO_GAINS.stepV && V <= (A.vWaterStick ?? 1.12) * vr) {
          vert = 'DE'; deRoll = servoStepHold(th * 180 / Math.PI, q * 180 / Math.PI, A.stepGains || null);
        }
        const rotating = vert === 'PITCH' && V > vrT && onG > 0;
        SV.IthMaxT = rotating ? (A.rotateIMax ?? 0.30) : 0.15;
        SV.IthGain = rotating ? (A.rotateI ?? 0.8) : null;
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
        // G451.2: ...at 1.12 Vr, not Vr. Vr is 0.99 Vs (GEN_VRATIO): a hull
        // that ventilates its step (G451.1) leaves the water on its own
        // around Vs, and a full pull there skipped the ultralight off at
        // 15 m/s in a 5 m/s crosswind, ballooned it, dropped it back crabbed
        // at 12.5 m/s and water-looped it 140 deg. Pulled at 1.12 Vr it
        // touches once and climbs away (max swing 21 deg).
        if (sim.hydro && onG > 0) SV.deFloor = V > (A.vWaterStick ?? 1.12) * vr ? (A.deWater ?? 0.70) : 0.02;
        c.brake = 0;
        if (onG === 0 && V > vr) { go('LIFTOFF'); thLift0 = th; SV.IthMaxT = 0.15; SV.IthGain = null; }
        break;
      }

      case 'ABORT': {
        SV.IthMaxT = 0.15; SV.IthGain = null;
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
        // G435: ...and a HIGH THRUST LINE on land asks the same stick (THRUST_ARM above)
        if ((sim.hydro || highThrust) && aglL < 2 * A.hSafe) { SV.IthMaxT = A.liftoffIWater ?? 0.35; SV.IthGain = A.rotateI ?? 0.8; }
        // G396.4: THE HOLD-OFF ON THE WATER. LIFTOFF eased the stick to the
        // servo's 0.22 the moment the hull let go, the floats touched again
        // and the card skimmed the step 2 s to 115 km/h where full stick
        // unsticks it at 96: the stick stays back while a float is still
        // wet, and the servo takes over once the aeroplane is clear.
        if (sim.hydro && onG > 0) SV.deFloor = A.deWater ?? 0.70;
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
          if (sim.hydro || highThrust) { SV.IthMaxT = 0.15; SV.IthGain = null; }
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
        const obstAhead = sheetOf() && sheetOf().Vx && gradAhead(cg[0], cg[2], climbDir0[0], climbDir0[1], 1500, cg[1], 15) > 0;
        if (obstAhead !== vxHeld) { vxHeld = obstAhead; if (obstAhead && !vxSaid) { vxSaid = true; say('vx-climb', 'ground ahead above the aeroplane — climbing at Vx ' + sheetOf().Vx.toFixed(1) + ' m/s until clear'); } }
        const iasC = obstAhead ? sheetOf().Vx : agl > 2 * A.hSafe ? Math.min(ap.VCruise, ap.VClimb * (A.climbCruiseK ?? 1.10)) : ap.VClimb;
        engage('LOC', 'TECS', 'TECS', { vs: tClimbMax, alt: null, gs: null, vsUp: null, vsDn: null, ias: iasC, bank: bankLim });   // P0.5: full climb = the sheet's climbMax
        flapTgt = agl > 2 * A.hSafe ? 0 : fTO;
        // G381: the crosswind turn at 0.6 of the circuit height (was 0.35 —
        // 45 m on the cub, "it turns really low"), never above hCruise - 15
        const hTurn = ap.xc ? ap.hCruise - 8
                    : Math.min(ap.hCruise - 15, Math.max(A.hSafe + 10, ST.hTurnK * 0.6 * ap.hCruise));
        pubH = ap.refAlt + hTurn; pubN = ap.xc ? 'CRUISE HEIGHT' : 'CROSSWIND TURN'; pubX = null; pubZ = null;
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
        const terrainTurn = agl > A.hSafe + 10 && gradAhead(cg[0], cg[2], climbDirNow[0], climbDirNow[1], 1500, cg[1], 30) > gammaGA();
        if (terrainTurn && !terrainTurnSaid) { terrainTurnSaid = true; say('terrain-turn', 'the ground ahead climbs faster than the aeroplane — turning at ' + Math.round(agl) + ' m'); }
        if (agl >= hTurn || stalled || marginal || terrainTurn) {
          const first = planFromHere();
          go(first); climbMode = !(stalled || marginal); ceilT = 0;
          if (!climbMode) { SV.thrC = A.thrCruise; SV.thcI = 0.04; }
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
        pubH = hTgt; pubN = L.name; pubX = L.B[0]; pubZ = L.B[1];
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
          if (gNeed > gammaGA()) {
            holdOut = true;
            const h0 = Math.atan2(ap.holdDir[2], ap.holdDir[0]);
            let best = null;
            for (let k = -3; k <= 3; k++) {
              const h = h0 + k * Math.PI / 6;
              let gk = gradAhead(cg[0], cg[2], Math.cos(h), Math.sin(h), 1500, cg[1], 30);
              if (escapeHdg != null && Math.abs(Math.atan2(Math.sin(h - escapeHdg), Math.cos(h - escapeHdg))) < 0.1) gk -= 0.01;
              if (!best || gk < best.g) best = { h, g: gk };
            }
            escapeHdg = best.h; escapeCircle = best.g > gammaGA();
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
          L.A = [cg[0] + vcg[0] / tl * Rc2, cg[2] + vcg[2] / tl * Rc2]; airPath = null; pathFrom = [cg[0], cg[2]]; planLegH(ap.legs);
        }
        heldOut = !!holdOut;
        // P0.6: the path is built once per leg list and followed by L1; the
        // G381 arc + pursuit stay behind `path: false`
        if (!airPath) { airPath = buildAirPath(ap.legs, ap.legs[0] && ap.legs[0].name === 'CROSSWIND' ? [cg[0], cg[2]] : pathFrom); airPathI = 0; pathFrom = null; }
        const onPath = !!airPath && !holdOut;
        // P1.F: THE STRAIGHT-IN SLOWS BEFORE THE FIX. An enroute leg is flown
        // at the cruise; its last 1.5 km at the pattern speed (VTurn, what
        // the base leg flies) so the final begins at a speed the slope can
        // be captured from — the C172 arrived at A0's fix at 51 m/s, zoomed
        // 30 m shedding it to 25 and rode 12 m above the slope (nine
        // machines, one class, in the full run)
        const Vleg = (L.enroute && r.len - r.s < 1500 && ap.legI === ap.legs.length - 2) ? VTurnLeg() : legSpeed(L);
        altMode(hTgt, Vleg, bankLim, holdOut ? 'HDG' : onPath ? 'PATH' : 'NAV');
        if (holdOut) SEL.hdg = escapeHdg;
        // G1936: on a short field's base the first half of the landing flap
        flapTgt = (ap.shortFld && L.name === 'BASE') ? Math.max(fTO, 0.5 * fLDG) : 0;
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
            slopeCaptured = false; finalT0 = ap.t; SV.thrC = A.thrAppr; deF = SV.aDe;
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
        { const aim = wp(F, ap.xAim, 0); pubH = (slopeCaptured || above < 0 || above > 4) ? hGS : finalLevel; pubN = 'AIM'; pubX = aim[0]; pubZ = aim[1]; }
        // P0.6: the last fillet (base -> final) is the path's; LOC takes over
        // once the nose is within 11 deg of the runway and 60 m of the line
        const nS = nose[0] * F.ux + nose[1] * F.uz;
        const onPathF = !!airPath && !(nS > Math.cos(0.19) && Math.abs(sCr) < 60);
        const bF = onPathF ? bankLim : Math.abs(sCr) > 60 ? Math.min(bankLim, 0.30) : 0.18;
        const latF = onPathF ? 'PATH' : 'LOC';
        const bFs = slipK > 0.02 ? Math.max(bF, 0.35) : bF;   // G1936: the slip's bank holds the track
        // the approach speed is asked from the leg change, through the turn
        // (keeping the base speed through the arc arrived on the slope 6 m/s
        // fast on the Caravan-alike, whose drawn tail cannot hold the nose
        // up at idle — the elevator on its stop, 3 m/s below a 2.2 deg
        // slope, two terrain go-arounds; GATE ARCHETYPES)
        const iasF = ap.VAppr * ST.VapprK;
        // G1936 (PILOT-ONE): THE FORWARD SLIP. A short field's slope is the obstacles' (East Point's trees ask 6 deg)
        // and a clean aeroplane cannot fly it at 1.2 Vs0 at idle: the user's Cub (no flap) came down it with the
        // throttle closed, 4 m over the slope and 2.5 m/s fast, and arrived at the flare at 25 m/s = 1.56 Vs.
        // A pilot crosses the controls: the rudder yaws the nose off the runway, the bank holds the track, the
        // fuselage side-on to the air is the drag the flap would have been. Armed on a short final, on the slope,
        // with the throttle at its floor and the ENERGY still over the plan (the speed's excess as height + the
        // height over the slope, > 2 m); eased off as the excess goes and straightened before the flare. The
        // low wing is the upwind one (the slip is the crosswind landing's own attitude); calm air: right wing low.
        {
          const eE = (V * V - iasF * iasF) / (2 * 9.81) + above;
          const hOff = (A.flareK ?? 1.3) * A.flareAgl + 0.6 * V;
          if ((ap.shortFld || (PRA && PRF.slip)) && slopeCaptured && aglG > hOff && c.thr < 0.10 && eE > 2) {
            if (slipK === 0) slipSg = SV.crossWind(F) >= 0 ? 1 : -1;
            slipK = Math.min(1, slipK + dt / 3);
            if (!slipSaid) { slipSaid = true; say('slip', 'high on energy on the short final (+' + eE.toFixed(1) + ' m at idle) — slipping it down'); }
          } else slipK = Math.max(0, slipK - dt / (aglG > hOff && eE > 0.5 ? 6 : 1.5));
        }
        // P0.5: the slope and the level before it are two references of the one law
        if (slopeCaptured || above < 0) engage(latF, 'TECS', 'TECS', { gs: ap.gs, alt: null, vs: null, ias: iasF, bank: bFs, vsUp: 1.5, vsDn: Math.min(-3.0, -1.6 * V * ap.gs), spdPri: ap.shortFld });
        // ABOVE THE SLOPE ON ENTRY (G434, the hill strip on Jolene): the enroute leg's clearance over
        // the ground under it (hClear) had left the aeroplane 30 m over the pattern height, the
        // level was latched THERE and the slope, descending to the aim, only fell away under it -
        // "high on the slope" at 534 m out, twice, on a strip it could have landed on. Above the
        // slope by more than the capture window the target is the SLOPE itself, descended onto at
        // half again the slope's own rate; the latched level is for the aeroplane the slope rises
        // to meet (the branch above)
        else if (above > 4) engage(latF, 'TECS', 'TECS', { alt: hGS, vs: null, gs: null, ias: iasF, bank: bFs, vsUp: 1.5, vsDn: Math.min(-3.0, -2.4 * V * ap.gs), spdPri: ap.shortFld });
        else engage(latF, 'TECS', 'TECS', { alt: finalLevel, vs: null, gs: null, ias: iasF, bank: bF, vsUp: 1.5, vsDn: Math.min(-3.0, -1.6 * V * ap.gs) });
        ap.trackHold = !onPathF;
        if (!onPathF) airPath = null;
        flapTgt = fLDG;
        // G975: THE LANDING FLAP COMES OUT AS FAR AS THE ELEVATOR HOLDS IT. genTrim sizes the landing
        // flap in the tunnel, prop OFF (deAppr inside the 0.18 budget); under approach power the
        // propwash over the flaps is another airframe. The twin bush hauler (two wing engines 0.26 m
        // over the CG) on full flap at 0.25 throttle: the elevator reached its stop and the nose
        // went -2 -> -70 deg in 2 s, into the ground 2.2 km out ("terrain under the approach", twice,
        // gave up) - the freeze test: flap frozen at 0 or 0.5 flies the slope on 0.2 of elevator,
        // full flap at IDLE flies, full flap at 0.25 throttle tucks. So the flap comes out in the
        // pilot's stages: past the take-off setting it stops where it is while the elevator (0.5 s
        // filter) is past the trim budget the build was sized to, and it comes back a stage (0.25,
        // never below the take-off setting) when the elevator sits on its stop; the cap holds for
        // the flight (the flare, the next circuit). No flap, or an elevator inside its budget: as before
        deF += (SV.aDe - deF) * Math.min(1, dt / 0.5);
        if (FS && c.flap < fLDG - 0.01 && c.flap > fTO && deF > 0.18) { fLandCap = c.flap; flapTgt = c.flap; say('flap-limited', 'the elevator holds flap ' + c.flap.toFixed(2) + ' at its trim budget — no more'); }
        if (FS && c.flap > fTO + 0.01 && SV.aDe > 0.30) {
          fCapT += dt;
          if (fCapT > 0.3) { fLandCap = Math.max(fTO, c.flap - 0.25); fCapT = 0; flapTgt = Math.min(flapTgt, fLandCap); say('flap-limited', 'the elevator cannot hold flap ' + c.flap.toFixed(2) + ' — landing on ' + fLandCap.toFixed(2)); }
        } else fCapT = 0;
        // G975: THE APPROACH'S TRIM IS THE SERVO'S TO FIND. holdPitch's integrator is capped at 0.15 in
        // the air, and a drawn tail's approach trim is more than that: the Tiger Moth-alike on final
        // held 5 deg against the 12.5 TECS asked (elevator 0.24 of its 0.35, the pitch error standing),
        // so the speed stayed 3 m/s over Vref, the energy loop read "too fast" and took the power off,
        // and the aeroplane rode 13 m under the slope to the terrain go-around (the Beaver-alike: 7 m/s
        // over, 14 m under). On final the cap opens to the rotation's authority (rotateIMax, as the
        // flare's does); a go-around closes it again. An aeroplane that trims inside 0.15 flies as before
        SV.IthMaxT = A.rotateIMax ?? 0.30;
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
        // G975: THE TERRAIN GO-AROUND IS FOR AN AEROPLANE UNDER ITS PLAN. The slope from the aim at
        // the motorglider's 2.1 deg (gs 0.037) is itself 15 m over the ground 400 m out: flown to the
        // metre it passed 407 m out at 16 m, and a metre's sag was a go-around that the next circuit
        // flies again, the same slope over the same ground. The clearance on the slope is the runway
        // model's to plan (its cone, the canopy included); the pilot goes around when it is under 15 m
        // AND more than a third below what the slope leaves over the ground here
        if (world && d > 400 && canGA && aglT < Math.min(15, 0.67 * (hGS - terrainNow))) { goAround('terrain under the approach'); break; }
        if (d <= -150 && agl > A.flareAgl * 3) {
          if (canGA) { goAround('past the aim at ' + Math.round(agl) + ' m'); break; }
          if (!committed) { committed = true; say('committed-landing', 'past the aim at ' + Math.round(agl) + ' m agl — landing it'); }
        }
        if (ap.t - finalT0 > 240 && canGA) { goAround('final took ' + Math.round(ap.t - finalT0) + ' s'); break; }
        // G1936: A SHORT FINAL IS STABILIZED OR FLOWN AGAIN - 5 m/s over Vref under 20 m is a float the strip has no
        // room for (the Cub's 25 m/s at the flare touched 213 m into 150 m)
        if (ap.shortFld && canGA && d > 0 && aglG < 20 && V > iasF + 5) { goAround('fast on the short final: ' + V.toFixed(1) + ' m/s for ' + iasF.toFixed(1)); break; }
        // G381: the hold-off begins 1.3x higher than the ramp did — it has a
        // sink to arrest AND a speed to bleed, and the pull takes a second to bite
        // GTRAM: onto an altiport's slope the height is over the SLOPE'S LINE through the aim, and the
        // round-out begins a second of the rising ground earlier - the path turns from down to up
        altG = altiGrade();
        const hFl = altG > 0 ? cg[1] - (aimAlt() + altG * (sAl - ap.xAim)) : aglG;
        if (hFl < (A.flareK ?? 1.3) * A.flareAgl * (PRA ? PRF.flareK : 1) + altG * V) {
          go('FLARE'); thFlare0 = th;
          // G381: the hold-off's timescale (continuous with the sink it
          // arrives with), its cap (the three-point attitude on a
          // taildragger, thMax on a tricycle), its integrator and filter
          flTau = clamp(A.flareAgl / Math.max(0.5, -vcg[1]), 2.0, 4.5);
          flCap = trike ? A.thMax
                : Math.min(A.thMax, (thRest != null ? thRest : A.liftoffTh) + (A.flareOverRest ?? 0.035));
          flCap = Math.max(flCap, thFlare0 + 0.03);
          if (altG > 0) flCap += Math.atan(altG);   // GTRAM: the attitude on the slope is the slope's more
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
        pubH = ap.refAlt + hTurn; pubN = 'CROSSWIND TURN'; pubX = null; pubZ = null;
        setStatus('going around: climbing on the runway heading', [
          cond('height', Math.round(agl), Math.round(hTurn), agl >= hTurn, 'm')]);
        if (agl >= hTurn || (phaseT > 60 && vsSlow < 0.15)) {
          ap.takeoffDir = [F.ux, F.uz];
          ap.xc = !!ap.diverting; ap.diverting = false;   // G1936: a diversion flies on as a cross-country
          go(planFromHere()); climbMode = true; ceilT = 0;
        }
        break;
      }

      case 'FLARE': {
        flapTgt = fLDG;
        const to = ap.route.to;
        const left = (to.x + F.ux * to.len / 2 - cg[0]) * F.ux + (to.z + F.uz * to.len / 2 - cg[2]) * F.uz;
        flLeft = left;   // G1949: the strip ahead, for the flare's power (apply)
        setStatus('flaring', [cond('wheels down', onG, 1, onG > 0, ''), cond('runway left', Math.round(left), 0, left > 0, 'm')]);
        if (phaseT > 20 && left < 2 * stopDist(V) + 100 && (ap.gaN || 0) < 2 && !committed) { SV.pitchK = SV.pitchDK = 1; SV.IthMaxT = 0.15; SV.IthGain = null; goAround('floating with ' + Math.round(left) + ' m left'); break; }
        // G1936: ON A SHORT FIELD THE FLOAT IS JUDGED AT ONCE - floating in ground effect (0.3-1.0 m) with less strip
        // ahead than the short-field stop from this speed, the landing will end in the trees: power, and round
        // again (twice, then committed). Judged from the flare's start it sent the C172 round from 11 m up
        if (ap.shortFld && phaseT > 0.5 && aglG > 0.3 && aglG < 1.0 && left < stopDistShort(V) && (ap.gaN || 0) < 2 && !committed) {
          ap.aimBack = { to, m: (ap.aimBack && ap.aimBack.to === to ? ap.aimBack.m : 0) + Math.max(0, stopDistShort(V) - left) + 10 };   // G1949: the next aim, earlier (planArrival)
          SV.pitchK = SV.pitchDK = 1; SV.IthMaxT = 0.15; SV.IthGain = null; goAround('floating on the short field with ' + Math.round(left) + ' m left, ' + Math.round(stopDistShort(V)) + ' m to stop'); break; }
        // B4: armed on the STRIP-FRAME crosswind (|windZ| + |windX| armed it on
        // a headwind straight down the strip too) — 39b_servos.js decrabArmed
        const decrab = SV.decrabArmed(agl, F);
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
          // G970: ...AND UNDER THE FLOOR (1.15 Vs0, the power's) THE ARRIVAL IS
          // FIRM: 1.0 m/s. Held to 0.7 on power the C172-alike floated 7 s from
          // 10 m and touched at 1.04 Vs0; asked 1.0 there it arrives at 1.07-1.09
          const sinkF = Math.max((A.flareSink ?? 0.35) + 0.35 * clamp((1.15 * vr - V) / (0.10 * vr), 0, 1),
                                 V < (A.flareFloorK ?? 1.15) * (sheetOf() && sheetOf().Vs0 ? sheetOf().Vs0 : vr / 0.99) ? 1.0 : 0);
          // GTRAM: onto an altiport the sink is asked RELATIVE TO THE SLOPE - the ground rises at grade x
          // the ground speed under the aeroplane, so the path must climb that much, and on power (below)
          const hFl = altG > 0 ? cg[1] - (aimAlt() + altG * (sAl - ap.xAim)) : aglG;
          const vsC = -Math.max(sinkF, Math.max(0, hFl) / flTau) + altG * Math.hypot(vcg[0], vcg[2]);
          const ev = vsC - flVsF;
          // the elevator has no more to give: stop winding the demand up
          const deSat = SV.aDe > 0.30;
          flI = clamp(flI + (deSat ? -0.15 : (A.flareI ?? 0.30) * ev) * dt, 0, Math.max(0, flCap - thFlare0));
          const thC = clamp(thFlare0 + (A.flareP ?? 0.20) * ev + flI, thFlare0 - 0.02, flCap);
          // the pull: a firmer inner loop and the rotation's integrator authority
          SV.pitchK = A.flarePK ?? 2.0; SV.pitchDK = A.flareDK ?? 1.0;
          SV.IthMaxT = A.rotateIMax ?? 0.30; SV.IthGain = A.flareIth ?? 0.4;
          if (altG > 0) engage(decrab ? 'DECRAB' : 'LOC', 'PITCH', 'SPD', { pitch: thC, bank: 0.10, ias: 0.95 * ap.VAppr });   // GTRAM: the round-out onto the slope is flown on power
          else engage(decrab ? 'DECRAB' : 'LOC', 'PITCH', 'IDLE', { pitch: thC, bank: 0.10, idle: A.flareThr ?? 0 });
        }
        if (onG > 0) {
          go('ROLLOUT');
          SV.pitchK = SV.pitchDK = 1; SV.IthMaxT = 0.15; SV.IthGain = null;
          // G381: a three-point arrival (the attitude at or above the rest
          // attitude, less 3 deg) is pinned from the first frame
          tdThree = !trike && th > (thRest != null ? thRest : A.liftoffTh) - 0.05;
          ap.tdInfo = { sink: -vcg[1], z: sCr, x: sAl, V, drift: -vcg[0] * F.uz + vcg[2] * F.ux, three: tdThree, th };
        }
        break;
      }

      case 'ROLLOUT': {
        if (flatRoll) {
          // G630.1: the slow roll to the level part (see the stop below)
          const dRem = (flatRoll.x - cg[0]) * flatRoll.ux + (flatRoll.z - cg[2]) * flatRoll.uz;
          engage('RWY', 'DE', 'TAXI', { de: A.taxiDe ?? 0.30, gsp: Math.min(0.6 * taxiV, Math.sqrt(2 * 0.5 * Math.max(0, dRem - 1.5))) });
          setStatus('rolling on to the level part of the strip', [cond('to the level part', Math.round(Math.max(0, dRem)), 2, dRem < 2, 'm')]);
          if (dRem < 2 || (dRem < 6 && Vg < 0.3) || ap.t - flatRoll.t0 > 90) {
            ap.report.outcome = ap.report.outcome || 'completed';
            go('STOPPED');
          }
          break;
        }
        if (trike) {
          // P1.B soft: the nosewheel stays off to 0.7 Vs, then full up
          const soft = ap.appr && ap.appr.technique === 'soft';
          if (V > (soft ? 0.7 * (sheetOf() && sheetOf().Vs0 ? sheetOf().Vs0 : (A.VRot || 18) / 0.99) : (A.VDerotate ?? 20))) engage('RWY', 'PITCH', 'SET', { pitch: A.rolloutTh ?? 0.035, thr: 0 });
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
        if (tq === 'soft') { if (Vg < 0.5 * (sheetOf() && sheetOf().Vs0 ? sheetOf().Vs0 : (A.VRot || 18) / 0.99)) brakeRamp = Math.min(brakeRamp + 0.5 * A.brakeRampRate * dt, 0.5 * A.brakeMax); }
        else if (tq === 'short') {
          // G1936: A SHORT FIELD IS BRAKED TO THE LIMIT, the stick full back - the user's Cub three-point from 19 m/s on
          // HOME's grass: 152 m at the 0.3 every landing brakes to, 128 m at full brake, no nose-over (pitch never
          // under +2.1 deg). The limit is the TAIL: the moment a taildragger's tailwheel leaves the ground (or a
          // tricycle's nose pitches 3 deg under its rest) the brake comes off at once and winds back slowly
          const WCb = typeof sim.wheelContacts === 'function' ? sim.wheelContacts() : null;
          const tailRising = trike ? (thRest != null && th < thRest - 0.05) : !!(WCb && !WCb.tw && onG >= 1 && phaseT > 0.5);
          if (tailRising) brakeRamp = Math.max(0, brakeRamp - 3.0 * dt);
          else if (onG >= 3 || Vg < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + 2 * A.brakeRampRate * dt, brakeShort);
        }
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
          if (ap.tdInfo && !flatRoll) ap.report.landing = {
            run: Math.round(Math.abs(sAl - ap.tdInfo.x)),
            sink: Math.round(ap.tdInfo.sink * 100) / 100,
            V: Math.round(ap.tdInfo.V * 10) / 10,
            offCentre: Math.round(ap.tdInfo.z * 10) / 10,
            pastAim: Math.round(ap.tdInfo.x - ap.xAim),
            k: F.k, three: !!ap.tdInfo.three,
          };
          // G1936: THE LANDING IS ON THE STRIP OR IT IS SAID - 'completed' was written for a Cub that stopped 63 m
          // past East Point's end in the trees. The touch and the stop against the strip's two ends along the frame
          {
            const to = ap.route.to, sEnd = (to.x - F.ox) * F.ux + (to.z - F.oz) * F.uz + to.len / 2, sThr0 = sEnd - to.len;
            const onS = ap.tdInfo.x >= sThr0 - 2 && sAl <= sEnd + 2 && Math.abs(sCr) <= (to.wid || 30) / 2 + 2;
            if (ap.report.landing) { ap.report.landing.onStrip = onS; ap.report.landing.tdIn = Math.round(ap.tdInfo.x - sThr0); ap.report.landing.stopLeft = Math.round(sEnd - sAl); }
            if (!onS) say('off-the-strip', 'touched ' + Math.round(ap.tdInfo.x - sThr0) + ' m in, stopped ' + Math.round(sAl - sEnd) + ' m past the end of ' + Math.round(to.len) + ' m (' + Math.round(Math.abs(sCr)) + ' m off the centreline)');
          }
          // G630.1: ON A SLOPED STRIP, ROLL ON TO THE LEVEL PART (the Jolene
          // playtest: "on inclined runways, the pilot should try and reach
          // the flat part before stopping"). Stopped on a grade past 1.5 %,
          // the pilot looks down the strip still ahead (to 25 m short of its
          // end, 400 m at most) for ground under 1 %, and taxis there. None
          // ahead (the whole strip is the hill — the matrix's up4 / dn4) and
          // it stops where it is, as before; the landing is judged at the
          // first stop either way.
          if (!flatRoll && phaseT <= 120) flatRoll = flatAhead();
          if (flatRoll) { say('slope', 'stopped on a ' + (Math.abs(gGrade) * 100).toFixed(1) + ' % grade — rolling ' + Math.round(flatRoll.d) + ' m on to the level part'); break; }
          ap.report.outcome = ap.report.outcome || 'completed';
          go('STOPPED');
        }
        break;
      }

      case 'STOPPED':
        flatRoll = null;
        engage('NONE', 'DE', 'SET', { de: 0.35, thr: 0 });
        c.brake = 0.25;
        setStatus('stopped', []);
        break;

      default:
        // an unknown phase (a manual-flight re-latch): back to a known one
        if (onG > 0) go('ROLLOUT'); else go('CLIMB');
        break;
    }
    if (!BX.on) { apply(); flapsTo(flapTgt); if (PRA) humanise(dt, onG); }   // G1943: a profile's hands (the expert's are the servos')
    // the servo slew on the axes the pilot owns; a hand-flown axis (the box
    // with that mode released) passes through and the servo tracks it, so
    // nothing jumps when the box takes the axis
    const ownV = !BX.on || AF.vert !== 'OFF', ownL = !BX.on || AF.lat !== 'OFF';
    SV.slew(ownV, ownL);
    if (ap.phase === 'DOWNWIND' && phaseT > 8 && onG === 0 && ap.report) {
      trimAcc.n += dt; trimAcc.de += SV.aDe * dt;
      ap.report.trimDe = Math.round(trimAcc.de / trimAcc.n * 1000) / 1000;
    }
    SV.endStep();
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl, aglG, grade: gGrade, thRest, flCap, tecs: AF.vert === 'TECS' ? tecsDbg : null,
               xt: taxiXT, sRem: taxiSRem, tailUp: tailUpNow, piv: piv ? piv.hdg : null, pivN: pivN,
               kap: AF.lat === 'PATH' && pathDbg ? pathDbg.kap : 0 };   // P1.F: the path's curvature under the aeroplane (a fillet is not a wander — the matrix reads it)
    // the measurements a panel reads (ap.instruments), SI
    ap._m = { ias: V, tas: Vt, gs: Vg, alt: cg[1], agl, aglT, vs: vcg[1], pitch: th, bank: ph,
              hdg: PILOT_UNITS.deg(Math.atan2(nose[1], nose[0])),
              trk: tl2 > 0.5 ? PILOT_UNITS.deg(Math.atan2(vcg[2], vcg[0])) : null,
              beta, x: cg[0], z: cg[2], onGround: onG, t: ap.t };
    // G710: THE PLAN, published (see ap.intent above)
    const IN_ = ap.intent, TD = AF.vert === 'TECS' ? tecsDbg : null;
    IN_.phase = phRun; IN_.legs = ap.legs; IN_.legI = legRun;
    IN_.to = pubN; IN_.x = pubX; IN_.z = pubZ;
    IN_.h = pubH; IN_.hField = pubH != null ? pubH - ap.altRef : null;
    IN_.hGround = (pubH != null && pubX != null && world && typeof world.terrainH === 'function') ? pubH - groundH(pubX, pubZ) : IN_.hField;
    IN_.vs = vcg[1]; IN_.vsCmd = TD ? TD.hdotC : null;
    IN_.vsUp = TD ? TD.vsUp : tClimbMax; IN_.vsDn = TD ? TD.vsDn : -Math.max(3.0, 1.5 * tSinkIdle);
    IN_.climbMax = tClimbMax; IN_.sinkIdle = tSinkIdle;
    IN_.path = (onG === 0 && ap.legs) ? airPath : null; IN_.pathI = airPathI;
    IN_.taxi = ap.path || null;
  };
  return ap;
}
