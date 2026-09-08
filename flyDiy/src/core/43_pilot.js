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
    return () => Math.min(0.5, CRR * sim.totalM * 9.81 / T0);
  })();
  // the stopping deceleration the accelerate-stop call plans with: the grass
  // datum's rolling + braking coefficients at the pilot's own brake limit,
  // taken at 80 % (a wet-side margin; the measured stop goes on the report)
  const aStop = A.aStop || 9.81 * (CRR + (A.brakeMax || 0.3) * MU_BRAKE) * 0.8;
  const stopDist = v => v * v / (2 * aStop) + v * 1.0;
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
  const HOMEISH = { hdg: Math.PI, tdz: [-450, 0], elev: 0, len: 1100, x: -520, z: 0 };
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: A.VAppr, xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
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
  ap.setRoute = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);
    ap.altRef = from.elev;
    ap.shortFld = false;
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
    go('DEPART');
  };

  // ---- the servos' state (41_test_pilot.js, verbatim) ------------------------
  let thP = 0, phP = 0, eP = 0, q = 0, p = 0, eR = 0, eRslow = 0, thF = 0, phF = 0, thCA = 0, vsF = 0;
  let vsSlow = 0, gaT = 0;
  let aDe = 0, aDa = 0, aDr = 0, phCA = 0;
  let Ith = 0, thcI = 0.06, It = 0, thrC = 0.6;
  let thFlare0 = 0, thLift0 = 0, brakeRamp = 0, holdActive = false, holdWas = false;
  let taxiI = 0, taxiLastT = -1e9;
  let thRest = null, thrRoll = 0, taxiXT = 0, taxiSRem = 0, tailUpNow = false;
  let eAP = 0, eAR = 0, eARslow = 0;
  let eTrim = 0;
  let pendReEng = false;
  let rollS0 = null, rollN = 0, accF = 0, vPrev = null;
  let climbMode = true, ceilT = 0, ceilingSaid = false;
  let slopeCaptured = false, finalT0 = 0, committed = false, cardAcc = null;
  let abortV0 = null, abortS0 = null, committedTO = false;
  ap.reEngage = (o) => {
    pendReEng = true;
    if (o && typeof o.phase === 'string' && o.phase !== ap.phase) go(o.phase);
  };
  ap.taxiFF = taxiFF;

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
  // the take-off / landing direction at an aerodrome: into wind when there is
  // one, else the runway direction nearest the preference (a unit vector)
  const dirAt = (a, px, pz) => {
    const axx = snap(Math.cos(a.hdg)), axz = snap(Math.sin(a.hdg));
    let dx = px, dz = pz;
    const w = windAt(a, 30);
    if (Math.hypot(w[0], w[1]) > 0.7) { dx = -w[0]; dz = -w[1]; }
    const sg = (dx * axx + dz * axz) >= 0 ? 1 : -1;
    return [axx * sg, axz * sg];
  };
  // a point in a landing frame: s along u, c to the LEFT of u
  const wp = (F, s, c) => [F.ox + s * F.ux + c * F.uz, F.oz + s * F.uz - c * F.ux];
  const leftOf = (F, cg) => (cg[0] - F.ox) * F.uz - (cg[2] - F.oz) * F.ux;
  const alongOf = (F, cg) => (cg[0] - F.ox) * F.ux + (cg[2] - F.oz) * F.uz;
  const legGeom = (L) => {
    const dx = L.B[0] - L.A[0], dz = L.B[1] - L.A[1], len = Math.hypot(dx, dz) || 1e-9;
    return { ux: dx / len, uz: dz / len, len };
  };
  const terrainAhead = (x, z, dx, dz, dist) => {
    if (!world || typeof world.terrainH !== 'function') return -1e9;
    let h = -1e9;
    for (let k = 0; k <= 6; k++) {
      const d = dist * k / 6;
      h = Math.max(h, world.terrainH(x + dx * d, z + dz * d));
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
    ap.xAim = Math.max(A.xAim, sThr + 40);
    ap.shortFld = to.len < 450;
    if (to.len < 700) ap.xAim = sThr + Math.max(60, 0.12 * to.len);
    if (ap.shortFld && A.VApprShort) ap.VAppr = A.VApprShort; else ap.VAppr = A.VAppr;
    const hC = ap.hCruise;
    const Dfaf = hC / ap.gs;
    const Diaf = Dfaf + Math.max(400, 10 * VTurn);
    const W = clamp(ST.patW * Rturn, 300, 1800);
    ap.plan = { F, sAim: ap.xAim, sFaf: ap.xAim - Dfaf, sIaf: ap.xAim - Diaf, W, hC, side: 1 };
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
  const startLegs = (legs) => { ap.legs = legs; ap.legI = 0; ap.trackHold = false; };

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
    if (Math.hypot(w[0], w[1]) > 0.7) t = dirAt(from, nose[0], nose[1]);
    else {
      const sgN = (nose[0] * d0[0] + nose[1] * d0[1]) >= 0 ? 1 : -1;
      const ahead = from.len / 2 - sgN * along;
      if (!onStrip || ahead >= need) t = [d0[0] * sgN, d0[1] * sgN];
      else t = [-d0[0] * sgN, -d0[1] * sgN];
    }
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
                  gaN: ap.gaN, style: ST.name, afcs: ap.afcs };
  };

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    if (ap.restAlt === null) { ap.restAlt = cg[1]; ap.refAlt = cg[1]; }
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
    const terrainNow = (world && typeof world.terrainH === 'function') ? world.terrainH(cg[0], cg[2]) : ap.refAlt;
    const aglT = cg[1] - terrainNow;

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
      Ith = 0; It = 0; thcI = 0.06; thrC = A.thrCruise ?? 0.6;
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
    if (onG > 0 && agl < A.aglGuard && V < A.VRot * 0.9
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
      Ith = clamp(Ith + (A.pitchI ?? 0.05) * (thCA - th) * dt, -0.15, 0.15);
      c.de = clamp((A.pitchP ?? 1.2) * (thCA - th) - (A.pitchD ?? 1.8) * q + Ith, -0.30, 0.35);
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
      phCA += clamp(phC - phCA, -(A.bankSlew ?? 0.18) * dt, (A.bankSlew ?? 0.18) * dt);
      c.da = clamp((A.rollP ?? 2.0) * (phCA - ph) - (A.rollD ?? 2.0) * p, -0.30, 0.30);
      c.dr = clamp(-(A.betaK ?? 0.3) * beta - (A.yawDampK ?? 0.6) * (eAR - eARslow)
                   - (A.ariK ?? 0.35) * c.da, -0.25, 0.25);
    };
    const speedThrottle = (Vtgt) => {
      It = clamp(It + 0.010 * (Vtgt - V) * dt, -0.30, 0.30);
      c.thr = clamp(thrC + 0.05 * (Vtgt - V) + It, A.thrFloor ?? 0.12, 1);
    };
    const holdVS = (VSc, thMax = 0.16) => {
      vsF += (A.vsFilt ?? 1.0) * (vcg[1] - vsF);
      const fl = A.vsFloor ?? -0.08;
      thcI = clamp(thcI + (A.vsI ?? 0.015) * (VSc - vsF) * dt, fl, thMax);
      holdPitch(clamp(thcI + (A.vsP ?? 0.010) * (VSc - vsF), fl, thMax));
    };
    const groundSteer = () => {
      const tailUp = rotateTD && onG <= 2 && thRest !== null && (thRest - th) > 0.04;
      const drMax = tailUp ? 0.95 : 0.45;
      const kP = tailUp
        ? 3.2 * 1.4 * clamp(((A.VTailUp ?? 12) / Math.max(V, 5)) ** 2, 0.6, 2.0)
        : 3.2;
      const kD = tailUp ? 3.0 : 1.2;
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
      const phW = (A.xwBank ?? 0.06) * wX * clamp((A.VTailUp ?? 12) / Math.max(V, 6), 0.4, 1.6);
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
    const vsAgl = v => agl < A.hSafe ? Math.max(v, 1.0) : v;
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
        ant = Rturn * Math.tan(Math.min(Math.acos(dot), 2.6) / 2);
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
          const hGS = ap.refAlt + Math.max(0, d) * SEL.gs;
          holdVS(clamp(-(o_.Vg ?? V) * SEL.gs + 0.12 * (hGS - cg[1]), Math.min(-3.0, -1.6 * V * SEL.gs), 0.5));
          break;
        }
        case 'PITCH': holdPitch(SEL.pitch); break;
        case 'DE': c.de = SEL.de; break;
        default: break;
      }
      // lateral
      switch (AF.lat) {
        case 'HDG': ap.targetDir = [Math.cos(SEL.hdg), 0, Math.sin(SEL.hdg)]; airLateral(SEL.bank ?? bankLim); break;
        case 'TRK': {
          const ddx = SEL.trk[0] - cg[0], ddz = SEL.trk[1] - cg[2], dl = Math.hypot(ddx, ddz) || 1e-9;
          ap.targetDir = [ddx / dl, 0, ddz / dl]; airLateral(SEL.bank ?? bankLim); break;
        }
        case 'NAV': ap.targetDir = SEL.navDir || ap.targetDir; airLateral(SEL.bank ?? bankLim); break;
        case 'LOC': airLateral(SEL.bank ?? bankLim); break;
        case 'DECRAB': {
          airLateral(0.12);
          const nS = nose[0] * F.ux + nose[1] * F.uz;
          const nC = -nose[0] * F.uz + nose[1] * F.ux;
          const hdg = Math.atan2(nC, nS);
          c.dr = clamp(-(A.decrabK ?? 2.2) * hdg - 0.6 * eR, -0.35, 0.35);
          break;
        }
        case 'RWY': groundSteer(); break;
        case 'TAXI': c.dr = SEL.dr; break;   // the follower's rudder (da from the governor)
        case 'NONE': c.dr = 0; c.da = 0; break;
        default: break;
      }
      AF.fd = { pitch: thCA, bank: phCA };
    };

    // ---- the pilot's own helpers ---------------------------------------------------
    // climb-or-level on a leg: FLC + FULL until near the target, then ALT + SPD;
    // a ceiling that will not come is ACCEPTED, said once
    const altMode = (hTgtAbs, Vlevel, bl, nav) => {
      const dh = hTgtAbs - cg[1];
      if (climbMode && dh < 8) { climbMode = false; thrC = A.thrCruise; thcI = 0.04; }
      else if (!climbMode && dh > 40) climbMode = true;
      if (climbMode) {
        engage(nav, 'FLC', 'FULL', { ias: ap.VClimb, bank: bl });
        ceilT += dt;
        const stalled = ceilT > 60 && vsSlow < 0.15, marginal = ceilT > 75 && vsSlow < 0.4;
        if ((stalled || marginal) && !ceilingSaid) {
          ceilingSaid = true;
          say(stalled ? 'wont-climb' : 'ceiling-accepted',
              (stalled ? 'no climb left (' : 'still climbing ') + vsSlow.toFixed(2) +
              (stalled ? ' m/s) — accepting ' : ' m/s — flying the circuit at ') +
              Math.round(cg[1] - ap.altRef) + ' m');
          ap.hCruise = Math.max(A.hSafe + 10, cg[1] - ap.altRef);
          if (ap.plan) ap.plan.hC = ap.hCruise;
          climbMode = false; thrC = A.thrCruise; thcI = 0.04;
        }
      } else {
        ceilT = 0;
        engage(nav, 'ALT', 'SPD', { alt: hTgtAbs, ias: Vlevel, bank: bl, vsDn: -3.0, vsUp: 2.2 });
      }
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
      go('GOAROUND'); gaT = 0;
      thrC = A.thrCruise; thLift0 = th;
    };
    // the arrival at the destination, planned from where the aeroplane is now
    const planFromHere = () => {
      const { from, to } = ap.route;
      const climbDir = [F.ux * ap.dirX, 0, F.uz * ap.dirX];
      let u;
      if (ap.xc) u = dirAt(to, to.x - cg[0], to.z - cg[2]);
      else u = ap.takeoffDir || [F.ux * ap.dirX, F.uz * ap.dirX];
      const P = planArrival(to, u, from);
      const FL = P.F;
      const sNow = alongOf(FL, cg), cNow = leftOf(FL, cg);
      if (!ap.xc) {
        startLegs([{ name: 'CROSSWIND', A: wp(FL, sNow, 0), B: wp(FL, sNow, P.W), h: P.hC, V: 'cruise' }]
          .concat(patternLegs(P, sNow, 1)));
        return 'CROSSWIND';
      }
      const toIaf = wp(FL, P.sIaf, 0);
      const vx = toIaf[0] - cg[0], vz = toIaf[1] - cg[2], vl = Math.hypot(vx, vz) || 1e-9;
      const cosA = (vx * FL.ux + vz * FL.uz) / vl;
      const straightIn = sNow < P.sIaf - 300 && cosA > 0.5;
      if (straightIn) {
        startLegs([{ name: 'INBOUND', A: [cg[0], cg[2]], B: toIaf, h: P.hC, V: 'cruise', enroute: true },
                   { name: 'FINAL', A: toIaf, B: wp(FL, P.sAim, 0) }]);
      } else {
        const side = Math.abs(cNow) < 100 ? 1 : (cNow > 0 ? 1 : -1);
        const sJoin = P.sAim + Math.max(400, 2 * Rturn);
        const entry = wp(FL, sJoin, side * P.W);
        startLegs([{ name: 'ENROUTE', A: [cg[0], cg[2]], B: entry, h: P.hC, V: 'cruise', enroute: true }]
          .concat(patternLegs(P, sJoin, side)));
      }
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
        if (rollS0 === null) { rollS0 = sAl; committedTO = false; }
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
        if (canStopHere) {
          // the prediction waits for the 2 s acceleration filter to settle
          // (three time constants after the throttle opens): at 3 s a slow
          // build read a third of its true acceleration and was condemned —
          // the Tiger Moth-alike on a hot day, 0.10 m/s^2 against 0.3 real
          if (V < vr && phaseT > 7 && accF > 0.02) {
            const dVr = (vr * vr - V * V) / (2 * accF);
            if (dVr > left - stopDist(vr) - ST.reserve)
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
          if (!reject && phaseT > 8 && accF < 0.08 && V < 0.8 * vr)
            reject = 'not accelerating (' + accF.toFixed(2) + ' m/s^2 at V=' + V.toFixed(1) + ') — thrust is going nowhere';
        } else if (V < vr) {
          reject = 'out of runway: ' + Math.round(left) + ' m left, ' + Math.round(sd) +
                   ' m to stop, V=' + V.toFixed(1) + ' of ' + vr.toFixed(1) + ' needed';
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
        let vert = 'DE', pitch = 0;
        if (rotateTD) {
          vert = 'PITCH';
          pitch = V > vr ? (A.thRotate ?? A.liftoffTh)
                : (threePoint || V < (A.VTailUp ?? 0)) ? (threePoint ? Math.min(thRest, A.liftoffTh) : (A.thTailUp ?? 0.02))
                : (A.thTailUp ?? 0.02);
        } else if (V > vr) { vert = 'PITCH'; pitch = A.thRotate ?? A.liftoffTh; }
        engage('RWY', vert, 'SET', { pitch, de: A.rollDe, thr: ap.t > 0.5 ? thrRoll : 0 });
        c.brake = 0;
        if (onG === 0 && V > vr) { go('LIFTOFF'); thLift0 = th; }
        break;
      }

      case 'ABORT': {
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
        if (agl > A.hSafe)
          thT = Math.min(thT, clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        engage('LOC', 'PITCH', 'FULL', { pitch: thT, bank: 0.15 });
        flapTgt = fTO;
        const left = runwayLeft();
        setStatus('climbing out of ground effect', [
          cond('height', agl, A.hSafe, agl > A.hSafe, 'm'),
          cond('airspeed', V, A.VClimbMin, V > A.VClimbMin, 'm/s')]);
        // THE PUT-DOWN, and V1. A hover in ground effect goes back on the
        // wheels after 25 s (the HOVER fixture) — or at once, while a stop on
        // the strip is STILL POSSIBLE, when it is not climbing and the strip
        // is running out. Past the point of stopping the aeroplane is
        // COMMITTED to the climb, the way a real one is past V1: measured in
        // the game on a marginal build (a 53 s roll to Vr, airborne with
        // 150 m left), the old rule dropped it three seconds after lift-off
        // into the last of the grass, which is the worse of the two ends.
        const lowStuck = agl < A.hSafe * 0.6;
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
        if (agl > A.hSafe && (V > A.VClimbMin || agl > 2 * A.hSafe)) { go('CLIMB'); climbMode = true; ceilT = 0; }
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
        engage('LOC', 'FLC', 'FULL', { ias: ap.VClimb, bank: bankLim });
        flapTgt = agl > 2 * A.hSafe ? 0 : fTO;
        const hTurn = ap.xc ? ap.hCruise - 8
                    : Math.max(A.hSafe + 10, ST.hTurnK * 0.35 * ap.hCruise);
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
        if (agl >= hTurn || stalled || marginal) {
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
          const floor = terrainAhead(cg[0], cg[2], g.ux, g.uz, 7500) + (A.hClear ?? 130);
          hTgt = Math.max(cruise, floor);
        } else hTgt = legAlt(L);
        const holdOut = L.enroute && hTgt - cg[1] > 60 && ap.holdDir && phaseT < 150 && ap.legI === 0;
        altMode(hTgt, legSpeed(L), bankLim, holdOut ? 'HDG' : 'NAV');
        if (holdOut) SEL.hdg = Math.atan2(ap.holdDir[2], ap.holdDir[0]);
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
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        const above = cg[1] - hGS;
        if (!slopeCaptured && above < 4) slopeCaptured = true;
        if (slopeCaptured || above < 0)
          engage('LOC', 'GS', 'SPD', { gs: ap.gs, ias: ap.VAppr * ST.VapprK, bank: 0.18 });
        else
          engage('LOC', 'ALT', 'SPD', { alt: Math.min(cg[1], hGS + 10), ias: ap.VAppr * ST.VapprK, bank: 0.18,
                                        vsDn: Math.min(-3.0, -1.6 * V * ap.gs), vsUp: 0.5 });
        flapTgt = fLDG;
        const canGA = (ap.gaN || 0) < 2 && !committed;
        setStatus(slopeCaptured ? 'down the slope to the aim point' : 'level, waiting for the slope', [
          cond('to the aim', Math.round(d), 0, d <= 0, 'm'),
          cond('above slope', Math.round(above), ST.gaHigh, above < ST.gaHigh, 'm'),
          cond('off centre', Math.round(Math.abs(sCr)), ST.gaXT, Math.abs(sCr) < ST.gaXT, 'm'),
          cond('flare at', agl.toFixed(1), A.flareAgl, agl < A.flareAgl, 'm')]);
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
        if (agl < A.flareAgl) { go('FLARE'); thFlare0 = th; }
        break;
      }

      case 'GOAROUND': {
        // full power, flaps to the take-off setting, straight ahead on the
        // runway heading to the crosswind height, then the circuit again
        ap.dirX = 1;
        engage('LOC', 'FLC', 'FULL', { ias: ap.VClimb, bank: 0.20 });
        flapTgt = fTO;
        const hTurn = Math.max(A.hSafe + 10, ST.hTurnK * 0.35 * ap.hCruise);
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
        if (phaseT > 20 && left < 2 * stopDist(V) + 100 && (ap.gaN || 0) < 2 && !committed) { goAround('floating with ' + Math.round(left) + ' m left'); break; }
        const decrab = agl < (A.decrabAgl ?? 3.5) && Math.abs(o_.windZ || 0) + Math.abs(o_.windX || 0) > 0.5;
        if (A.flareMode === 'vs')
          engage(decrab ? 'DECRAB' : 'LOC', 'VS', 'IDLE', { vs: -(0.15 + 0.28 * Math.max(0, agl)), thMax: A.flareThMax ?? A.thMax, bank: 0.10, idle: A.flareThr ?? 0 });
        else
          engage(decrab ? 'DECRAB' : 'LOC', 'PITCH', 'IDLE', { pitch: Math.min(thFlare0 + A.flareRate * phaseT, A.flareThMax ?? A.thMax), bank: 0.10, idle: A.flareThr ?? 0 });
        if (onG > 0) {
          go('ROLLOUT');
          ap.tdInfo = { sink: -vcg[1], z: sCr, x: sAl, V, drift: -vcg[0] * F.uz + vcg[2] * F.ux };
        }
        break;
      }

      case 'ROLLOUT': {
        if (trike) {
          if (V > (A.VDerotate ?? 20)) engage('RWY', 'PITCH', 'SET', { pitch: A.rolloutTh ?? 0.035, thr: 0 });
          else engage('RWY', 'DE', 'SET', { de: 0.15, thr: 0 });
        } else engage('RWY', 'DE', 'SET', { thr: 0, de: V > (A.VTailDown ?? A.VTailUp) ? -0.05
                    : (th > (A.thPinMax ?? 0.26) ? 0.05 : V > (A.VPinFull ?? 0) ? 0.14 : 0.35) });
        if (Vg < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        setStatus('rolling out', [cond('ground speed', Vg, A.VStop, Vg < A.VStop, 'm/s')]);
        if (Vg < A.VStop || phaseT > 120) {
          if (ap.tdInfo) ap.report.landing = {
            run: Math.round(Math.abs(sAl - ap.tdInfo.x)),
            sink: Math.round(ap.tdInfo.sink * 100) / 100,
            V: Math.round(ap.tdInfo.V * 10) / 10,
            offCentre: Math.round(ap.tdInfo.z * 10) / 10,
            pastAim: Math.round(ap.tdInfo.x - ap.xAim),
            k: F.k,
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
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl,
               xt: taxiXT, sRem: taxiSRem, tailUp: tailUpNow };
    // the measurements a panel reads (ap.instruments), SI
    ap._m = { ias: V, tas: Vt, gs: Vg, alt: cg[1], agl, aglT, vs: vcg[1], pitch: th, bank: ph,
              hdg: PILOT_UNITS.deg(Math.atan2(nose[1], nose[0])),
              trk: tl2 > 0.5 ? PILOT_UNITS.deg(Math.atan2(vcg[2], vcg[0])) : null,
              beta, x: cg[0], z: cg[2], onGround: onG, t: ap.t };
  };
  return ap;
}
