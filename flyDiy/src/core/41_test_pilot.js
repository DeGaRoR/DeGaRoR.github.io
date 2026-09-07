// ============================================================
// THE TEST PILOT (G107, ROADMAP P-2 / QUALITY-REVIEW P-2). A SECOND autopilot,
// forked VERBATIM from 40_autopilot.js's makeAutopilot and then given the one
// thing that file cannot grow without moving eleven calibrated fleet gates:
// BOUNDED ATTEMPTS WITH STRUCTURED VERDICTS. The user's brief, in their words:
// "It should really behave more like a test pilot... The autopilot would take
// appropriate actions when unable to reach the setpoints, or if the
// performance of the plane is too bad. It wouldn't take off, or wouldn't
// land. It really needs to rely on himself rather than the aircraft fully."
//
// WHO FLIES WHAT: generated builds (the garage) fly THIS pilot; the hand-built
// fleet keeps makeAutopilot, so WIND/M3/XCTY/... stay the benchmarks they are.
// GATE PILOT (tools/test_pilot.js) is this file's own battery, negative-first:
// an aeroplane that cannot fly MUST come back saying so, in bounded time.
//
// THE FORK RULE: every deliberate divergence from 40_autopilot.js is marked
// `TP:`. Anything unmarked is the fork being faithful, and a fix to the donor
// should be considered for a matching `TP:`-audited pass here. The donor's own
// W19 work (climb acceptance, missed approach, ground floor) is kept whole —
// this file extends it to the failures W19 left unbounded: ROLL had no exit at
// all (an aeroplane that never reaches Vr rolls to the fence, for ever), the
// balked-takeoff guard was an unbounded retry loop, a 0.2 m/s climber slips
// under the 0.15 m/s acceptance trigger and "climbs for ever", and nothing
// anywhere RECORDED what happened.
//
// THE REPORT is the contract: ap.report = { verdicts: [{t, code, note}],
// outcome, landing }. outcome is null in flight, then exactly one of
// 'completed' | 'rejected-takeoff' | 'gave-up' (a runner may add 'broke-up'
// when the sim itself diverges). 'completed' with verdicts in
// the list is an EVENTFUL flight (go-arounds, an accepted ceiling) — the
// distinction between clean and eventful is the report's whole point.
// landing = { run, sink, V, offCentre, pastAim } once stopped off a real
// touchdown — `run` is the landing run the plaque has never had.
// ============================================================
function makeTestPilot(sim, def, world) {
  const A = def.params.ap;
  // TP + G121: live mass (see the donor's note); exposed as ap.taxiFF so
  // the mass-proofing gate can watch it follow a drained tank.
  // THE POWER NOSE-OVER CAP (G179): see genGroundPowerCap. 1 for every
  // aeroplane whose thrust line sits at or below its CG, and for every
  // tricycle — the whole fleet; less than 1 only on a taildragger that would
  // go over on power alone, until its tail is up.
  const GP = (typeof genGroundPowerCap === 'function')
    ? genGroundPowerCap(def, sim.thrustAt(0), sim.totalM * 9.81) : { cap: 1 };
  // G193: THE FOLLOWER'S OWN NUMBERS. A tailwheel steer is a rear-steered
  // bicycle: the turn the rudder commands is atan(Lwb * kap) / twSteer, so
  // the wheelbase and the steer gain are read off the frame once. And the
  // THREE-POINT RUN: a taildragger whose ground power is capped (thrust line
  // above the CG, the user's wing-mounted twin) keeps its tail DOWN until
  // rotation so the tailwheel steers the whole run; every other build rolls
  // exactly as before (A.rotate was never set by anything, and still is not
  // for them).
  const TW = (() => {
    const N = def.nodes, R = def.refs;
    let Lwb = 4.0;
    if (R && R.mains && R.mains.length && R.tw != null && R.tw >= 0) {
      const mx = R.mains.reduce((s, i) => s + N[i].p[0], 0) / R.mains.length;
      Lwb = Math.max(0.5, Math.abs(N[R.tw].p[0] - mx));
    }
    return { Lwb, steer: Math.abs(def.params.twSteer || 0.5) };
  })();
  // (measured: three-point for EVERY taildragger was tried and is wrong — the
  // elevator cannot hold the tail down at full power anyway, the crosswind
  // drift grew to 10 m and the hover fixture changed verdict. Capped builds
  // only, as designed.)
  const threePoint = (def.params.twSteer || 0.5) > 0 && GP.cap < 1;
  // ...and EVERY taildragger rotates at Vr (G193). A.rotate was never set by
  // anything, so the tail-up branch was dead code and a taildragger ran on its
  // mains until it floated off — measured on the user's ultralight: Vr 15.4,
  // airborne at 34 m/s after 300 m on two wheels with the wing carrying the
  // weight and the tyres carrying nothing, which a 2 m/s crosswind turned into
  // a 36 m slide. The tail-up steering schedule below arms for the same set.
  const rotateTD = A.rotate != null ? !!A.rotate : (def.params.twSteer || 0.5) > 0;
  const taxiFF = (() => {
    const PP = POWERPLANTS[def.params.powerplant];
    const PR = def.params.prop || PP.prop;
    const T0 = Math.max(1, PR.Tstatic * (def.params.nEngines || 1));
    return () => Math.min(0.5, CRR * sim.totalM * 9.81 / T0);
  })();
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  const mkFrame = (a, sx, sz) => {
    let ux = snap(Math.cos(a.hdg)), uz = snap(Math.sin(a.hdg));
    if (sx !== undefined) {
      const d = ux * sx + uz * sz;
      if (d < 0) { ux = -ux; uz = -uz; }
    } else { ux = -ux; uz = -uz; }
    // G193: TWO TOUCHDOWN TARGETS, one per landing direction. k = 0 lands
    // along -hdg on the record's own tdz, to the bit, so every calm gate keeps
    // its number; k = 1 lands along +hdg on the pattern's mirror target off
    // the other threshold — a wind-flipped arrival used to aim at mid-field.
    const k = (ux * Math.cos(a.hdg) + uz * Math.sin(a.hdg)) > 0 ? 1 : 0;
    const PT = (k === 1 && ap.patOf) ? ap.patOf(a) : null;
    const td = (PT && PT.approaches && PT.approaches[1]) ? PT.approaches[1].td : a.tdz;
    return { ux, uz, ox: td[0] + 450 * ux, oz: td[1] + 450 * uz, k };
  };
  const HOMEISH = { hdg: Math.PI, tdz: [-450, 0], elev: 0, len: 1100 };
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: A.VAppr,
    xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
    targetDir: [-1, 0, 0], trackHold: true, dirX: -1,
    restAlt: null, refAlt: null, altRef: 0, tdInfo: null, dbg: {},
    route: null, xc: false, frame: null, gaN: 0, gaWhy: null,
    // TP: the report, and the flight-time budget the watchdog holds it to
    report: { verdicts: [], outcome: null, landing: null },
    budget: 600,
  };
  // TP: a verdict is one line, timestamped, never overwritten. The pilot's
  // log of what it decided and why — the raw material of the WHY report.
  const say = (code, note) => {
    ap.report.verdicts.push({ t: Math.round(ap.t * 10) / 10, code, note });
  };
  ap.setRoute = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);
    ap.altRef = from.elev;
    ap.shortFld = false;
  };
  ap.setRoute(world ? world.aerodromes[0] : HOMEISH,
              world ? world.aerodromes[0] : HOMEISH);
  // G151: `taxiOut` — the site's declared way out. Donor's signature, carried.
  // G193: the pattern of an aerodrome, built once per record from its site
  // (25_airfield.js sitePattern) — the graph the taxi follows and the two
  // approaches the frame lands on
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
  // the third argument is the SITE now (the pattern is built from it); a
  // bare taxiOut list still works for the callers that pass one
  ap.departFrom = (from, to, siteOrTaxiOut) => {
    const site = (siteOrTaxiOut && !Array.isArray(siteOrTaxiOut)) ? siteOrTaxiOut : null;
    ap.site = site;
    ap.path = null; ap.pathI = 0; ap.stopAfterLineup = false; holdN = 0;
    ap.taxiPath = null;
    ap.taxiOut = Array.isArray(siteOrTaxiOut) && siteOrTaxiOut.length ? siteOrTaxiOut
               : (site && site.taxiOut) || null;
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.trackHold = false;
    ap.taxiTgt = null;
    ap.phase = 'DEPART'; phaseT = 0;
  };
  const enterArrival = () => {
    const { from, to } = ap.route;
    if (ap.xc) {
      let hx = to.tdz[0] - from.tdz[0], hz = to.tdz[1] - from.tdz[1];
      if (world && world.wind) {
        const wv = world.wind(to.x, to.elev + 30, to.z, ap.t);
        if (Math.hypot(wv[0], wv[2]) > 0.7) { hx = -wv[0]; hz = -wv[2]; }
      }
      ap.frame = mkFrame(to, hx, hz);
      const sCen = (to.x - ap.frame.ox) * ap.frame.ux + (to.z - ap.frame.oz) * ap.frame.uz;
      const sThr = sCen - to.len / 2;
      ap.xAim = Math.max(A.xAim, sThr + 40);
      ap.shortFld = to.len < 450;
      if (ap.shortFld) {
        ap.xAim = sThr + 75;
        if (A.VApprShort) ap.VAppr = A.VApprShort;
      } else ap.VAppr = A.VAppr;
    }
    ap.dirX = 1;
    ap.altRef = to.elev;
    ap.refAlt = ap.restAlt + (to.elev - from.elev);
  };
  let thP = 0, phP = 0, eP = 0, q = 0, p = 0, eR = 0, eRslow = 0, thF = 0, phF = 0, thCA = 0, vsF = 0;
  let vsSlow = 0, gaT = 0;
  let aDe = 0, aDa = 0, aDr = 0, phCA = 0;
  let Ith = 0, thcI = 0.06, It = 0, thrC = 0.6;
  let phaseT = 0, headingCapT = 0, thFlare0 = 0, thLift0 = 0, brakeRamp = 0, holdActive = false, holdWas = false;
  // THE TAXI GOVERNOR'S INTEGRATOR (2026-09-04). See taxi() below.
  let taxiI = 0, taxiLastT = -1e9;
  // G193: the path follower's and the three-point run's state
  let holdN = 0, thRest = null, thrRoll = 0, taxiXT = 0, taxiSRem = 0, tailUpNow = false;
  let eAP = 0, eAR = 0, eARslow = 0;
  let eTrim = 0;
  let pendReEng = false;
  // TP: the takeoff instrument — where the roll started, how many times it has
  // been attempted, and a 2 s acceleration filter for the stagnation call.
  let rollS0 = null, rollN = 0, accF = 0, vPrev = null;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  ap.reEngage = (o) => {
    pendReEng = true;
    // G200: the phase re-latches with the state (see 40_autopilot.js)
    if (o && typeof o.phase === 'string' && o.phase !== ap.phase) { ap.phase = o.phase; phaseT = 0; }
  };
  ap.taxiFF = taxiFF;              // TP/G121: instrument surface

  // TP: THE TEST CARD (G107.1). The game imposes a card on the flight —
  // target altitude and target speed — and the pilot flies it: the card
  // overrides the circuit height and the cruise speed, the flown MEANS are
  // measured on the settled cruise leg, and the plaque judges flown against
  // asked. The pilot CLAMPS an unsafe ask and says so — it will not cruise
  // slower than just above approach speed and it will not fly a circuit
  // under its own safe height — and the budget grows with the climb, so a
  // capable aeroplane asked for real altitude is given the time to earn it
  // instead of a 'gave-up'. Call before the first update.
  let cardAcc = null;                    // { n, alt, V, saidV } while flying
  // G208: THE TRIM ACCUMULATOR rides beside the card and does not need one —
  // the elevator held on the settled cruise leg is the trim advisor's number,
  // and a standard circuit (blank card) is where most builds first fly.
  let trimAcc = { n: 0, de: 0 };
  ap.setCard = (card) => {
    if (!card || (!isFinite(card.alt) && !isFinite(card.V))) return;
    const c = { alt: null, V: null, altCmd: null, VCmd: null,
                altFlown: null, VFlown: null, deFlown: null };
    // THE ASK GOES ON THE REPORT AS IT WAS ASKED (G159). It used to be the
    // CLAMPED value that was recorded, which reads as the pilot having been
    // asked for something it was always going to do — and the clamp then has
    // nothing to have clamped. Latent for as long as no ask ever hit a limit;
    // GATE PILOT found it the moment the stock build put on enough weight for
    // its approach speed (25.1 m/s) to overtake a 25 m/s ask. The commanded
    // value rides beside it as `altCmd` / `VCmd`, and `altFlown` / `VFlown`
    // still say what it actually managed, so the report carries all three:
    // what you wanted, what the pilot would accept, and what it got.
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
      // the floor is the APPROACH SPEED ITSELF — a speed the aeroplane
      // sustains for minutes on every arrival, so it is a safe cruise ask.
      // It was VAppr*1.05 for one gate run, and the stock build's own
      // numbers refuted the margin: its VAppr (23.9) sits within 5% of its
      // cruise (25.2), so the arbitrary 5% clamped a legitimate near-cruise
      // ask UP. Narrow-envelope builds are the ones a test card exists for.
      c.V = card.V;
      c.VCmd = clamp(card.V, A.VAppr || 15, 120);
      if (c.VCmd !== card.V)
        // ONE DECIMAL, in m/s as well: rounded to whole km/h the first clamp
        // this ever fired read "90 km/h asked, 90 km/h flown", which is a
        // message that says nothing. The clamp was real (25.0 -> 25.1 m/s).
        say('card-clamped', 'speed ' + card.V.toFixed(1) + ' m/s asked, ' +
            c.VCmd.toFixed(1) + ' m/s flown (' + Math.round(c.VCmd * 3.6) +
            ' km/h) — not slower than the approach, not absurd');
      ap.VCruise = c.VCmd;
    }
    ap.report.card = c;
    cardAcc = { n: 0, alt: 0, V: 0, de: 0, saidV: false };
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

    let tx = ap.targetDir[0], tz = ap.targetDir[2];
    if (ap.trackHold) {
      const L = ap.phase === 'ROLL' || ap.phase === 'ROLLOUT' ? (A.lookRoll ?? 25)
              : ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (A.lookAppr ?? 100)
              : (A.lookCruise ?? 150);
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

    const AF = A.attFilt ?? 1.0;
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
    vsSlow += dt / 2.0 * (vcg[1] - vsSlow);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(Vt, 5);
    // TP: acceleration filter for the stagnation call — same 2 s form as vsSlow
    if (vPrev !== null) accF += dt / 2.0 * ((V - vPrev) / dt - accF);
    vPrev = V;

    const c = sim.ctl, onG = sim.wheelsOnGround();
    if (onG > 0 && agl < A.aglGuard && V < A.VRot * 0.9
        && ['LIFTOFF','CLIMB'].includes(ap.phase)) {
      // TP: the balked-takeoff retry is BOUNDED. The donor loops here for
      // ever; a test pilot tries twice more and then keeps the aeroplane.
      rollN++;
      if (rollN >= 3) {
        say('balked', 'settled back onto the wheels ' + rollN +
            ' times — keeping it on the ground');
        ap.phase = 'ABORT'; phaseT = 0;
      } else {
        say('balked', 'settled back at V=' + V.toFixed(1) + ' — attempt ' +
            (rollN + 1));
        ap.phase = 'ROLL'; phaseT = 0;
        rollS0 = null;                     // TP: re-latch the run instrument
      }
    }

    // TP: the watchdog. A flight that outlives its budget without an outcome
    // is a verdict in itself, said once; external runners bound the sim.
    if (ap.budget && ap.t > ap.budget && !ap.report.outcome
        && ap.phase !== 'STOPPED') {
      ap.report.outcome = 'gave-up';
      say('gave-up', 'still in ' + ap.phase + ' at t=' + Math.round(ap.t) +
          ' s — out of patience, not out of sky');
    }

    const holdPitch = (thC) => {
      if (!holdWas) thCA = th;
      holdActive = true;
      const sl = (A.pitchCmdSlew ?? 99) * dt;
      thCA += clamp(thC - thCA, -sl, sl);
      Ith = clamp(Ith + (A.pitchI ?? 0.05) * (thCA - th) * dt, -0.15, 0.15);
      c.de = clamp((A.pitchP ?? 1.2) * (thCA - th) - (A.pitchD ?? 1.8) * q + Ith, -0.30, 0.35);
    };
    const airLateral = (bankLim = A.bankLim ?? 0.30) => {
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
      // G193: THE PLANT CHANGES WHEN THE TAIL LIFTS. Only the tailwheel
      // steers on the ground (30_solver.js), and its branch stops the frame
      // the wheel unloads: authority drops from a first-order steer to the
      // aero rudder alone — an inertial plant at low q — while these gains
      // were tuned on the first. Measured on the user's ultralight: the
      // heading it had at tail-up was the heading it kept, into the grass.
      // The tail state is read solver-free (both mains down, pitch under the
      // latched three-point stance), and only a three-point build takes the
      // branch — the fleet's calm numbers do not move.
      const tailUp = rotateTD && onG <= 2 && thRest !== null && (thRest - th) > 0.04;
      // (measured on the crosswind trace: the full travel with the 1.4x gain
      // swings the nose +-10 deg once but holds the excursion to 7 m at 2 m/s
      // across; a softer 0.70 / 1.0x let it drift to 15 m)
      const drMax = tailUp ? 0.95 : 0.45;
      const kP = tailUp
        ? 3.2 * 1.4 * clamp(((A.VTailUp ?? 12) / Math.max(V, 5)) ** 2, 0.6, 2.0)
        : 3.2;
      const kD = tailUp ? 3.0 : 1.2;
      c.dr = clamp(-kP * e - kD * eR, -drMax, drMax);
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
      tailUpNow = tailUp;
    };

    // THE TAXI GOVERNOR FEEDS BACK ON GROUND SPEED (2026-09-04, the user:
    // "still too slow on taxi, much too slow ... you might have a constant
    // throttle, but it really needs to feedback on ground speed"). The G4.9
    // law was taxiFF — break-even against rolling resistance, which assumes
    // thrust LINEAR in throttle, and it is not — plus 0.06 per m/s of error
    // under a cap 0.27 above the feedforward. Measured on the ultralight: it
    // asked 0.34 and got 1.5 m/s for thirty seconds; on the default build
    // 1.2 m/s for thirty-five. This is a PI on Vg: the proportional term
    // answers at once, the integrator finds whatever throttle THIS aeroplane
    // on THIS surface actually needs, and the command saturates at
    // A.taxiThrMax (0.85 — a taxi is not a take-off). Anti-windup: the
    // integrator only moves while the command is not pinned in the direction
    // it would push. The feedforward stays as the starting guess, so the
    // first frame asks what it always asked. Overspeed is the brake's, in
    // proportion, not a 0.45 slam at +1.2. The integrator forgets itself
    // after two seconds without a taxi call, so a landing's backtrack does
    // not open the throttle with the departure's memory.
    const taxi = (Vtgt) => {
      c.de = A.taxiDe ?? 0.30;
      const ff = taxiFF();
      const cap = Math.min(A.taxiThrMax ?? 0.85, GP.cap);   // G179
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

    const goAround = why => {
      ap.gaN = (ap.gaN || 0) + 1; ap.gaWhy = why;
      say('go-around', why + ' (attempt ' + ap.gaN + ')');   // TP: recorded
      ap.phase = 'GOAROUND'; phaseT = 0; gaT = 0;
      thrC = A.thrCruise;
    };
    const vsAgl = v => agl < A.hSafe ? Math.max(v, 1.0) : v;

    switch (ap.phase) {
      case 'DEPART': {
        const from = ap.route.from;
        const axx = snap(Math.cos(from.hdg)), axz = snap(Math.sin(from.hdg));
        let dx = nose[0], dz = nose[1];
        if (world && world.wind) {
          const wv = world.wind(from.x, from.elev + 30, from.z, ap.t);
          if (Math.hypot(wv[0], wv[2]) > 0.7) { dx = -wv[0]; dz = -wv[2]; }
        }
        const sg = (dx * axx + dz * axz) >= 0 ? 1 : -1;
        const ux = axx * sg, uz = axz * sg;
        ap.frame = mkFrame(from, -ux, -uz);
        ap.dirX = -1;
        const need = (A.TORun ?? 500) + 60;
        const sPos = (cg[0] - from.x) * ux + (cg[2] - from.z) * uz;
        // G151, the donor's change carried across verbatim (this planner is
        // 40_autopilot's, forked): LINEUP is a final alignment and cannot be
        // asked to cross an apron. See the donor for the measurement — 324 s
        // and a 375 m wander, which on THIS pilot also burned the 600 s
        // budget and produced a 'gave-up' on a sound aeroplane.
        const sCr0 = -(cg[0] - from.x) * uz + (cg[2] - from.z) * ux;
        const offCl = Math.abs(sCr0) > 15;
        // G193: THE PATTERN WINS. Off the strip, the declared route out for
        // this take-off direction; on the strip with too little run, the
        // lane-and-U-turn back; on the strip with the run in front, a full
        // STOP on the spot, lined up, before the roll. Every route ends on a
        // hold: the aeroplane stops there, checks its alignment, then rolls.
        {
          const T = sg > 0 ? 0 : 1;
          const PAT = ap.patOf(from);
          const fits = !offCl && from.len / 2 - sPos >= need;
          if (PAT && PAT.routes) {
            const ids = offCl ? PAT.routes.out[T] : (fits ? null : PAT.routes.back[T]);
            if (ids && typeof patternPath === 'function') {
              ap.path = patternPath(PAT, ids, 1.0, [cg[0], cg[2]]);
              ap.pathI = 0; ap.stopAfterLineup = true;
              ap.phase = 'TAXI'; phaseT = 0;
              break;
            }
            if (fits) {
              ap.stopAfterLineup = true;
              ap.phase = Vg < 0.3 ? 'HOLD' : 'STOP'; phaseT = 0;
              break;
            }
          }
        }
        if (!offCl && from.len / 2 - sPos >= need) { ap.phase = 'LINEUP'; phaseT = 0; break; }
        // the site's declared route wins — the fence is the place's, not the
        // pilot's (see the donor for the measurement that proved it).
        if (offCl && ap.taxiOut) {
          const path = ap.taxiOut.map(p => [p[0], p[1]]);
          ap.taxiTgt = path.shift();
          ap.taxiPath = path;
          ap.phase = 'TAXI'; phaseT = 0;
          break;
        }
        const sStart = offCl
          ? Math.min(Math.max(sPos + Math.max(60, 3.5 * Math.abs(sCr0)),
                              -from.len / 2 + 25), from.len / 2 - need - 25)
          : Math.max(-from.len / 2 + 25, from.len / 2 - need - 25);
        ap.taxiTgt = [from.x + ux * sStart, from.z + uz * sStart];
        ap.taxiPath = null;
        ap.phase = 'TAXI'; phaseT = 0;
        break;
      }

      case 'TAXI': {
        if (ap.path) {
          // G193: FOLLOW THE PATH, do not chase a point. Cross-track error
          // (Stanley's atan of the offset over the speed) turns the target
          // heading toward the line; the path's own curvature a lookahead
          // ahead goes STRAIGHT INTO THE RUDDER as a feed-forward, so a
          // corner is steered before an error exists — pure pursuit had to
          // build the error first, which is the corner-cut. The speed comes
          // down for the bend within the stopping distance and for the STOP
          // at the end, and the rudder has its whole travel at taxi speed
          // (the ±0.45 clamp could not make a 12 m corner on this aeroplane).
          const L = pathLocate(ap.path, ap.pathI, cg[0], cg[2]);
          ap.pathI = L.i; taxiXT = L.ey; taxiSRem = L.sRem;
          const K = pathLook(ap.path, L.i, Vg);
          const eXT = clamp(Math.atan2(0.9 * L.ey, Vg + 1.0), -0.6, 0.6);
          const hT = K.hdgL - eXT;
          ap.targetDir = [Math.cos(hT), 0, Math.sin(hT)];
          const drFF = -Math.atan(TW.Lwb * K.kapL) / Math.max(0.05, TW.steer);
          const drMaxG = 0.85 - 0.40 * clamp((Vg - 6) / 4, 0, 1);
          c.dr = clamp(-3.2 * e - 1.2 * eR + drFF, -drMaxG, drMaxG);
          taxi(pathSpeed(ap.path, L.i, Vg, A.taxiV ?? 5.0, L.sRem));
          const tMax = 40 + 1.6 * ap.path.len / (A.taxiV ?? 5.0);
          if (L.sRem < 2.0 || (L.sRem < 6 && Vg < 0.6)) { ap.phase = 'STOP'; phaseT = 0; }
          else if (phaseT > tMax) { ap.phase = 'LINEUP'; phaseT = 0; }
          break;
        }
        const ddx = ap.taxiTgt[0] - cg[0], ddz = ap.taxiTgt[1] - cg[2];
        const dist = Math.hypot(ddx, ddz) || 1e-9;
        ap.targetDir = [ddx / dist, 0, ddz / dist];
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        taxi(Math.abs(e) > 0.6 ? 2.5 : 5.0);
        // G151, carried: only the LAST point hands over to LINEUP, and the
        // intermediate ones hold a tighter radius so a corner-cut cannot clip
        // the gate the route exists to use.
        const lastLeg = !(ap.taxiPath && ap.taxiPath.length);
        if (dist < (lastLeg ? 22 : 10) || phaseT > 120) {
          if (lastLeg) { ap.phase = 'LINEUP'; phaseT = 0; }
          else { ap.taxiTgt = ap.taxiPath.shift(); phaseT = 0; }
        }
        break;
      }

      case 'LINEUP': {
        ap.trackHold = true;
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        const alig = -(nose[0] * F.ux + nose[1] * F.uz);
        taxi(alig > 0.5 ? 4.5 : 2.4);
        if (alig > 0.988 && Math.abs(sCr) < 8 && Math.abs(eR) < 0.15) {
          // G193: a departure that came by the pattern STOPS before the roll
          if (ap.stopAfterLineup) { ap.phase = 'STOP'; phaseT = 0; break; }
          ap.phase = 'ROLL'; phaseT = 0;
          ap.t = Math.max(ap.t, 1);          // ROLL's 0.5 s throttle delay is long past
          rollS0 = null;                   // TP: fresh run instrument
        }
        break;
      }

      // G193: THE STOP POINT (the user: "the plane lines up and completely
      // stops before taking off"). STOP brakes to a standstill, still
      // steering the path's last heading while it has speed to steer with;
      // HOLD sits two seconds, checks it is lined up inside 2.5 m and 6 deg,
      // and rolls — or takes one LINEUP correction and stops again.
      case 'STOP': {
        c.thr = 0; c.brake = 0.7; c.de = A.taxiDe ?? 0.30;
        if (ap.path && Vg > 1.0) {
          const L = pathLocate(ap.path, ap.pathI, cg[0], cg[2]);
          ap.pathI = L.i; taxiXT = L.ey; taxiSRem = L.sRem;
          const K = pathLook(ap.path, L.i, Vg);
          ap.targetDir = [Math.cos(K.hdgL), 0, Math.sin(K.hdgL)];
          c.dr = clamp(-3.2 * e - 1.2 * eR, -0.85, 0.85);
        } else c.dr = 0;
        c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
        if (Vg < 0.3 || phaseT > 30) { ap.phase = 'HOLD'; phaseT = 0; }
        break;
      }
      case 'HOLD': {
        c.thr = 0.3 * taxiFF(); c.brake = 0.5; c.de = A.taxiDe ?? 0.30;
        c.dr = 0; c.da = 0;
        if (phaseT >= (A.holdS ?? 2.0)) {
          const alig = -(nose[0] * F.ux + nose[1] * F.uz);   // dot(nose, takeoff dir)
          const lined = alig > 0.9945 && Math.abs(sCr) < 2.5;
          if (lined || holdN >= 2) {
            ap.phase = 'ROLL'; phaseT = 0; ap.t = Math.max(ap.t, 1);
            ap.trackHold = true; thrRoll = GP.cap; thRest = null;
            rollS0 = null;                   // TP: fresh run instrument
          } else {
            holdN++;
            ap.stopAfterLineup = true;
            ap.phase = 'LINEUP'; phaseT = 0; ap.trackHold = true;
          }
        }
        break;
      }

      case 'ROLL': {
        // G179: power up as the tail comes up (GP.cap is 1 for the fleet)
        // G193: the capped build RAMPS to full power over thrRampS once the
        // tail-up speed is reached, instead of stepping in one frame — the
        // step was the nose-over moment arriving all at once. cap 1 (the
        // fleet): capT is 1 throughout, bit-identical to before.
        {
          const capT = V < (A.VTailUp ?? 0) ? GP.cap : 1;
          thrRoll = GP.cap < 1
            ? Math.min(capT, Math.max(thrRoll, GP.cap) + (1 - GP.cap) / (A.thrRampS ?? 2) * dt)
            : capT;
          c.thr = ap.t > 0.5 ? thrRoll : 0; c.brake = 0;
        }
        if (thRest === null) thRest = th;    // the stance pitch, latched at the roll's start
        // TP: THE ROLL HAS AN EXIT NOW. The donor's ROLL has exactly one —
        // reaching Vr — so an aeroplane that never will rolls to the fence.
        // Three rejection calls, each with margin the whole fleet clears by
        // construction (fleet TORun 150-500 m on 1100 m, accel > 1 m/s^2):
        //   out of runway   — 80 m from the end, still below Vr
        //   won't make it   — 60% of the strip used, still under 80% of Vr
        //   going nowhere   — 8 s at full power, accel under 0.08 m/s^2
        if (rollS0 === null) rollS0 = sAl;
        const avail = (ap.route.from.len || 1100);
        const runUsed = Math.abs(sAl - rollS0);
        const vr = A.VRot || 18;
        let reject = null;
        if (runUsed > avail - 80 && V < vr)
          reject = 'out of runway: ' + Math.round(runUsed) + ' m used, V=' +
                   V.toFixed(1) + ' of ' + vr.toFixed(1) + ' needed';
        else if (runUsed > 0.6 * avail && V < 0.8 * vr)
          reject = Math.round(runUsed) + ' m used for V=' + V.toFixed(1) +
                   ' — will not reach Vr=' + vr.toFixed(1) + ' in what is left';
        else if (phaseT > 8 && accF < 0.08 && V < 0.8 * vr)
          reject = 'not accelerating (' + accF.toFixed(2) + ' m/s^2 at V=' +
                   V.toFixed(1) + ') — thrust is going nowhere';
        if (reject) {
          say('rejected-takeoff', reject);
          ap.phase = 'ABORT'; phaseT = 0;
          break;
        }
        if (rotateTD) {
          // taildragger sequence: rotate at Vr; before that a THREE-POINT
          // build (G193) holds the stance it started in so the tailwheel
          // keeps steering, a conventional one lifts the tail at VTailUp
          if (V > A.VRot) holdPitch(A.thRotate ?? A.liftoffTh);
          else if (threePoint || V < (A.VTailUp ?? 0))
            holdPitch(threePoint ? Math.min(thRest, A.liftoffTh) : (A.thTailUp ?? 0.02));
          else holdPitch(A.thTailUp ?? 0.02);
        } else c.de = A.rollDe;
        groundSteer();
        if (onG === 0 && V > A.VRot) { ap.phase = 'LIFTOFF'; phaseT = 0; thLift0 = th; }
        break;
      }

      // TP: a rejected takeoff ends ON THE STRIP, brakes on, straight ahead —
      // the donor has no ground phase that stops without having landed first.
      case 'ABORT': {
        c.thr = 0;
        if (A.rolloutMode === 'trike') c.de = 0.15;
        else c.de = V > (A.VTailDown ?? A.VTailUp) ? -0.05 : 0.35;
        brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        groundSteer();
        if (Vg < A.VStop) {
          ap.report.outcome = ap.report.outcome || 'rejected-takeoff';
          ap.phase = 'STOPPED'; phaseT = 0;
        }
        break;
      }

      case 'LIFTOFF': {
        c.thr = 1;
        // G208.3: PAST THE SCREEN HEIGHT THE NOSE COMES DOWN FOR SPEED. The
        // lift-off attitude was held for as long as LIFTOFF lasted, and on the
        // default garage build (tube-and-fabric, 10 m high wing, 65 hp) that
        // is for ever: airborne at 23 m/s, climbing 2 m/s at 9.6°, the speed
        // sits 0.5 m/s UNDER VClimbMin and the exit below never fires — 1160 m
        // up and still "taking off". Measured on f7fcf5f, HEAD and the shared
        // tree alike (the user: "the last test gets stuck in take off mode,
        // never gets into the next phases, despite the plane climbing"). Above
        // hSafe the pitch is capped by CLIMB's own speed-seeking law, so a slow
        // climber lowers its nose and picks up VClimb the way CLIMB would.
        let thT = Math.min(thLift0 + (A.liftoffRamp ?? 9) * phaseT, A.liftoffTh);
        if (agl > A.hSafe)
          thT = Math.min(thT, clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        holdPitch(thT);
        airLateral(0.15);
        // TP: LIFTOFF is bounded too. Measured (rotax582 + 260 kg): airborne
        // at t=65, then HOVERING at half a metre in ground effect for the
        // rest of time — above the balked guard's V, below CLIMB's entry, and
        // no rule in the donor ever objects. 25 s without clearing 60% of
        // hSafe means it is not climbing out: close the throttle, put it
        // back down, keep it. The fleet clears hSafe in seconds.
        if (phaseT > 25 && agl < A.hSafe * 0.6) {
          say('wont-climb', 'airborne ' + Math.round(phaseT) + ' s and still at ' +
              agl.toFixed(1) + ' m — cannot climb out of ground effect, putting it back down');
          ap.phase = 'PUTDOWN'; phaseT = 0;
          break;
        }
        // ...and a climber that is clearly away — twice the screen height —
        // goes to CLIMB whatever its speed; CLIMB's law finishes the job
        if (agl > A.hSafe && (V > A.VClimbMin || agl > 2 * A.hSafe)) { ap.phase = 'CLIMB'; phaseT = 0; }
        break;
      }

      // TP: the low-hover reject — throttle closed, a gentle nose-up mush
      // until the wheels touch, then the ABORT brakes take it. Outcome is a
      // rejected takeoff: the flight never happened.
      case 'PUTDOWN':
        c.thr = 0;
        holdPitch(Math.min(th + 0.02, A.flareThMax ?? A.thMax));
        airLateral(0.10);
        if (onG > 0) {
          ap.report.outcome = ap.report.outcome || 'rejected-takeoff';
          ap.phase = 'ABORT'; phaseT = 0;
        }
        break;

      case 'CLIMB': {
        c.thr = 1;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral();
        // TP: the donor's W19 acceptance (60 s under 0.15 m/s) kept, and a
        // second, gentler call added over it: a 0.2-0.4 m/s climber slips
        // under W19's trigger and "climbs for ever" toward a circuit height
        // it will reach next week. 75 s under 0.4 m/s is nowhere near the
        // fleet (they top out in 14-47 s at 3-5 m/s) and is an ACCEPTED
        // ceiling, said so, not a failure.
        const stalled = phaseT > 60 && vsSlow < 0.15;
        const marginal = phaseT > 75 && vsSlow < 0.4;
        if (stalled)
          say('wont-climb', 'no climb left (' + vsSlow.toFixed(2) +
              ' m/s) — accepting ' + Math.round(cg[1] - ap.altRef) + ' m');
        else if (marginal)
          say('ceiling-accepted', 'still climbing ' + vsSlow.toFixed(2) +
              ' m/s after ' + Math.round(phaseT) + ' s — flying the circuit at ' +
              Math.round(cg[1] - ap.altRef) + ' m instead of waiting');
        if (stalled || marginal)
          ap.hCruise = Math.max(A.hSafe + 10, cg[1] - ap.altRef);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || stalled || marginal) {
          if (ap.xc) {
            ap.holdDir = [ap.frame.ux * ap.dirX, 0, ap.frame.uz * ap.dirX];
            ap.phase = 'ENROUTE'; enterArrival(); ap.trackHold = false;
          } else ap.phase = 'CRUISE';
          phaseT = 0; thrC = A.thrCruise; thcI = 0.04;
        }
        break;
      }

      case 'CRUISE':
        speedThrottle(ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        // TP: the card is JUDGED here, on the settled leg — time-weighted
        // means of height and speed, and a said-once verdict when full
        // throttle cannot hold the asked speed. The accumulators live in the
        // closure; only the flown numbers reach the report.
        if (phaseT > 8) {
          // G208: the elevator held on the settled leg (the slewed command,
          // which is what a hand would hold), published as `report.trimDe`
          trimAcc.n += dt; trimAcc.de += aDe * dt;
          ap.report.trimDe = Math.round(trimAcc.de / trimAcc.n * 1000) / 1000;
        }
        if (cardAcc && phaseT > 8) {
          cardAcc.n += dt;
          cardAcc.alt += (cg[1] - ap.altRef) * dt;
          cardAcc.V += V * dt;
          const cd = ap.report.card;
          cd.altFlown = Math.round(cardAcc.alt / cardAcc.n);
          cd.VFlown = Math.round(cardAcc.V / cardAcc.n * 10) / 10;
          if (!cardAcc.saidV && cd.V && phaseT > 25
              && V < cd.V * 0.93 && c.thr > 0.97) {
            cardAcc.saidV = true;
            say('cant-hold-speed', 'full throttle holds ' +
                Math.round(V * 3.6) + ' of the ' + Math.round(cd.V * 3.6) +
                ' km/h asked');
          }
        }
        if (sAl < ap.xTurn) {
          ap.phase = 'TURNBACK'; phaseT = 0;
          ap.trackHold = false; enterArrival();
          ap.targetDir = [ap.frame.ux, 0, ap.frame.uz];
        }
        break;

      case 'ENROUTE': {
        speedThrottle(ap.VCruise);
        const hCone0 = ap.refAlt + (ap.xAim - (ap.xTurn - 1200)) * ap.gs + 15;
        const fixOut = 1200 + Math.max(0, (cg[1] - hCone0) / 0.10);
        const fdx = (ap.xTurn - fixOut) - sAl, fdz = -sCr;
        const fDist = Math.hypot(fdx, fdz) || 1;
        const fixDir = [(fdx * F.ux - fdz * F.uz) / fDist, 0,
                        (fdx * F.uz + fdz * F.ux) / fDist];
        let hTgt = ap.altRef + ap.hCruise;
        if (world) {
          for (const dA of [0, 400, 800, 1500, 2500, 4000, 5500, 7500]) {
            const hT = world.terrainH(cg[0] + fixDir[0] * dA, cg[2] + fixDir[2] * dA)
                     + (A.hClear ?? 130);
            if (hT > hTgt) hTgt = hT;
          }
        }
        ap.targetDir = (hTgt - cg[1] > 60 && ap.holdDir) ? ap.holdDir : fixDir;
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -4.5, 2.2)));
        airLateral();
        if (fDist < 600) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;
      }

      case 'TURNBACK':
        speedThrottle(A.VTurn ?? ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        headingCapT = Math.abs(e) < 0.12 ? headingCapT + dt : 0;
        if (headingCapT > 1.5) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;

      case 'INBOUND': {
        speedThrottle(A.VTurn ?? 24);
        const d = ap.xAim - sAl;
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        const hTgt = Math.min(ap.altRef + ap.hCruise, hGS + 15);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -3.5, 2.2)));
        airLateral();
        if (d > 0 && hGS <= cg[1] + 2 && cg[1] - hGS < 40) { ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr; }
        else if (d <= 0) {
          if (agl < A.flareAgl * 3 || (ap.gaN || 0) >= 2) {
            // TP: the donor lands here silently; the pilot says it is out of
            // tidy options and committing.
            say('committed-landing', 'past the aim at ' + Math.round(agl) +
                ' m agl — landing it');
            ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr;
          } else goAround('past-aim');
        }
        break;
      }

      case 'APPROACH': {
        speedThrottle(ap.VAppr);
        const d = ap.xAim - sAl;
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        holdVS(clamp(-(o_.Vg ?? V) * ap.gs + 0.12 * (hGS - cg[1]), Math.min(-3.0, -1.6 * V * ap.gs), 0.5));
        airLateral(0.18);
        gaT = cg[1] - hGS > 60 ? gaT + dt : 0;
        if (gaT > 5 && (ap.gaN || 0) < 2) { goAround('high'); break; }
        // TP: the pilot knows what is UNDER it, not just where the field
        // datum is. The donor's agl is height above field elevation, so an
        // approach over rising ground descends into it with no objection.
        // Far from the aim (d > 400 m), less than 15 m over the real terrain
        // is a go-around, not a landing.
        if (world && d > 400 && (ap.gaN || 0) < 2
            && cg[1] - world.terrainH(cg[0], cg[2]) < 15) {
          goAround('terrain');
          break;
        }
        if (agl < A.flareAgl) { ap.phase = 'FLARE'; phaseT = 0; thFlare0 = th; }
        break;
      }

      case 'GOAROUND':
        c.thr = 1; c.brake = 0;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral(0.20);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || (phaseT > 60 && vsSlow < 0.15)) {
          ap.phase = 'CRUISE'; phaseT = 0;
          ap.dirX = -1; ap.trackHold = true;
          thrC = A.thrCruise; thcI = 0.04;
        }
        break;

      case 'FLARE':
        c.thr = A.flareThr ?? 0;
        if (phaseT > 20 && (ap.gaN || 0) < 2) { goAround('float'); break; }
        if (A.flareMode === 'vs') {
          holdVS(-(0.15 + 0.28 * Math.max(0, agl)), A.flareThMax ?? A.thMax);
        } else {
          holdPitch(Math.min(thFlare0 + A.flareRate * phaseT, A.flareThMax ?? A.thMax));
        }
        if (agl < (A.decrabAgl ?? 3.5) && Math.abs(o_.windZ || 0) > 0.5) {
          airLateral(0.12);
          const nS = nose[0] * F.ux + nose[1] * F.uz;
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
        } else c.de = V > (A.VTailDown ?? A.VTailUp) ? -0.05
                    : (th > (A.thPinMax ?? 0.26) ? 0.05
                    : V > (A.VPinFull ?? 0) ? 0.14 : 0.35);
        if (Vg < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        groundSteer();
        if (Vg < A.VStop) {
          // TP: the landing goes in the report — the run is the plaque's new
          // number, and pastAim is the arrival judged against its own aim.
          if (ap.tdInfo) ap.report.landing = {
            run: Math.round(Math.abs(sAl - ap.tdInfo.x)),
            sink: Math.round(ap.tdInfo.sink * 100) / 100,
            V: Math.round(ap.tdInfo.V * 10) / 10,
            offCentre: Math.round(ap.tdInfo.z * 10) / 10,
            pastAim: Math.round(ap.tdInfo.x - ap.xAim),
          };
          ap.report.outcome = ap.report.outcome || 'completed';
          ap.phase = 'STOPPED'; phaseT = 0;
        }
        break;
      }

      case 'STOPPED':
        c.thr = 0; c.de = 0.35; c.brake = 0.25; c.da = 0; c.dr = 0;
        break;
    }
    const FS = def.params.flaps;
    if (FS) {
      const tgt = ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (FS.ldg ?? 1)
                : ap.phase === 'ROLL' || ap.phase === 'LIFTOFF' ? (FS.to ?? 0)
                : 0;
      const rr = (FS.rate ?? 0.15) * dt;
      c.flap = clamp(c.flap + clamp(tgt - c.flap, -rr, rr), 0, 1);
    }
    aDe += clamp(c.de - aDe, -A.slew * dt, A.slew * dt); c.de = aDe;
    aDa += clamp(c.da - aDa, -A.slew * dt, A.slew * dt); c.da = aDa;
    aDr += clamp(c.dr - aDr, -A.slew * dt, A.slew * dt); c.dr = aDr;
    holdWas = holdActive; holdActive = false;
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl,
               xt: taxiXT, sRem: taxiSRem, tailUp: tailUpNow };   // G193
  };
  return ap;
}
