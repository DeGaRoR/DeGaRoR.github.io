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
  let CLmax = 0, aStall = 0;
  // Sweep starts at -2, not 2: a low-incidence generated wing can trim
  // negative, and the ATTITUDE the peak occurs at is now a return value.
  // Numerically inert for CLmax — -2 + 16*0.25 lands exactly on the old 2, so
  // the grid is identical and nothing below the stall can out-lift the peak.
  for (let a = -2; a <= 22; a += 0.25) {
    const al = a * Math.PI / 180;
    const r = sim.probe([-V * Math.cos(al), -V * Math.sin(al), 0]);
    const L = -r.Fx * Math.sin(al) + r.Fy * Math.cos(al);
    const CL = L / (0.5 * 1.225 * V * V * Sw);
    if (CL > CLmax) { CLmax = CL; aStall = al; }
  }
  // aStall is a BODY angle (the probe pitches the flow about the rest pose),
  // which is what the autopilot's pitch commands are also in. The whole
  // attitude family — thMax, climbThBase, liftoffTh, flareThMax — hangs off it.
  return { CLmax, Sw, W: sim.totalM * 9.81, aStall };
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
  const aMax = 0.85 * def.params.polarWing.aStall;
  const PPc = POWERPLANTS[def.params.powerplant];
  const PRc = def.params.prop || PPc.prop;
  const nEc = def.params.nEngines || 1;
  const Tav = v => Math.max(1, PRc.Tstatic - PRc.kV2 * v * v) * nEc;
  const dragAt = v => genProbeAt(sim, v, genAlphaForLift(sim, v, W, aMax)).drag;

  // ---- CRUISE SPEED FROM THE POWER CURVE ---------------------------------
  // It used to be 1.71 * Vs flat (GEN_VRATIO), which is the Cub's ratio, and
  // that ratio is not a property of aeroplanes: across the fleet VCruise/Vs
  // scatters 1.69-2.68 (55%). Worse, it says nothing about whether the
  // aeroplane can actually GO that fast — measured, a short-span build came out
  // with thrCruise pinned at its 0.95 clamp, i.e. asked to cruise on 95% power
  // with nothing left to climb on, and it never reached circuit height at all
  // (286 s stuck in CLIMB, which IS the reported "it climbs forever").
  //
  // So solve for the speed where drag is 65% of the thrust available there.
  // Against the fleet the solution reproduces the hand-set values to
  // 0.96 +/- 0.12, and it GUARANTEES thrCruise ~ 0.65: authority in both
  // directions, which is the property the autopilot actually needs.
  {
    // The upper clamp is 2.2, not the fleet's own 2.68 (jodel) or 2.44 (c172):
    // this is the speed a CIRCUIT is flown at, and those two fiches carry
    // hand-matched circuit geometry to go with it. Left at 2.8 the 1200 hp
    // radial build solved to 69.7 m/s — a genuine 250 km/h racer, and measured,
    // it flew a 1037 m wide circuit because its turn radius no longer fitted
    // inside anything the strip could offer.
    const Vs = def.params.gen.Vs;
    let lo = 1.55 * Vs, hi = 2.2 * Vs;
    if (dragAt(lo) >= 0.65 * Tav(lo)) {
      // cannot even make the floor: it is a brick, and saying so honestly is
      // better than commanding a speed it will never see
      def.params.ap.VCruise = Math.round(lo * 10) / 10;
    } else {
      for (let k = 0; k < 18; k++) {
        const mV = 0.5 * (lo + hi);
        if (dragAt(mV) < 0.65 * Tav(mV)) lo = mV; else hi = mV;
      }
      def.params.ap.VCruise = Math.round(0.5 * (lo + hi) * 10) / 10;
    }
  }
  const V = def.params.ap.VCruise;
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

  // ---- THE APPROACH, MEASURED --------------------------------------------
  // The glideslope, the approach throttle and the pitch floor used to be the
  // Cub's three constants (gs 0.0786, thrAppr 0.35, vsFloor -0.08) on every
  // aeroplane the garage could build. HANDOVER "APPROACH" says the slope has to
  // sit below the IDLE-EQUILIBRIUM slope or the overspeed never washes off —
  // that is a measurable inequality, so measure it instead of asserting it.
  //
  // NOTE the probe runs with the prop and propwash OFF (30_solver.js), so every
  // alpha and drag here is FREE-AIR. That is exactly right for an idle
  // approach, and it is why the attitude family below hangs off the stall
  // attitude rather than off a probed climb alpha.
  {
    const A = def.params.ap, g = def.params.gen;
    const ldg = def.params.flaps ? (def.params.flaps.ldg ?? 1) : 0;
    const Va = A.VAppr;
    sim.ctl.flap = ldg;
    const aA = genAlphaForLift(sim, Va, W, aMax);
    const rA = genProbeAt(sim, Va, aA);
    // ELEVATOR REQUIRED FOR PITCH BALANCE ON FINAL. holdPitch clamps de to
    // [-0.30, +0.35] and needs headroom inside that for the loop itself, so an
    // aeroplane whose trim alone eats the stop cannot be flown down an
    // approach by any set of gains. Differenced, not solved: the relation is
    // linear in de over this range.
    sim.ctl.de = 0.20;
    const m1 = genProbeAt(sim, Va, aA).pitchUp;
    sim.ctl.de = 0;
    const dM = (m1 - rA.pitchUp) / 0.20;
    g.deAppr = Math.abs(dM) < 1e-9 ? 0 : -rA.pitchUp / dM;
    // THE TRIM BUDGET. Fleet worst is the Jodel at +0.118; the bound is 0.18 —
    // half the servo stop — so the loop keeps headroom for its own P/D/I terms.
    // Past that, NO set of gains can fly the approach: measured, a small-wing
    // build spent 64% of final with the elevator hard against its stop and
    // touched 894 m short. The cure has to be airframe-side, so make the one
    // change a builder would make — LAND IT FLAPLESS, at the clean-stall
    // approach speed — and if that does not fit either, say so in the shakedown
    // rather than ship an aeroplane that cannot be landed.
    if (Math.abs(g.deAppr) > 0.18 && ldg > 0) {
      sim.ctl.flap = 0;
      const rat = g.Vs / Math.max(1e-6, g.VsFlap);        // back onto the clean stall
      const Va0 = A.VAppr * rat;
      const a0 = genAlphaForLift(sim, Va0, W, aMax);
      const r0 = genProbeAt(sim, Va0, a0);
      sim.ctl.de = 0.20;
      const n1 = genProbeAt(sim, Va0, a0).pitchUp;
      sim.ctl.de = 0;
      const dM0 = (n1 - r0.pitchUp) / 0.20;
      const de0 = Math.abs(dM0) < 1e-9 ? 0 : -r0.pitchUp / dM0;
      if (Math.abs(de0) < Math.abs(g.deAppr)) {
        def.params.flaps.ldg = 0;        // the AP's flap schedule reads this
        A.VAppr *= rat; A.VApprShort *= rat;
        g.VsFlap = g.Vs; g.landsFlapless = true;
        return genTrim(def);             // re-measure the lot at the new config
      }
    }
    if (Math.abs(g.deAppr) > 0.18) g.apprTrimFail = g.deAppr;
    g.W = W;
    g.alphaAppr = aA;
    g.LDappr = rA.Fy / Math.max(1e-6, rA.drag);
    g.dragAppr = rA.drag;
    g.TavailAppr = Tav(Va);
    // arrival attitude, for the flare ceiling
    g.alphaTD = genAlphaForLift(sim, 1.10 * g.VsFlap, W, aMax);
    sim.ctl.flap = 0;
    // WHAT IT CAN CLIMB, which is what decides how big a circuit it can fly.
    const rc = genProbeAt(sim, A.VClimb, genAlphaForLift(sim, A.VClimb, W, aMax));
    g.gammaClimb = Math.max(0.004, (Tav(A.VClimb) - rc.drag) / W);
    genTuneAP(def);
  }
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
  // ONE REFERENCE AREA ON THE SHEET. This summed the strips, which is all a
  // hand-written fiche has — but a generated aeroplane also carries `gen.Sw`,
  // the planform area the whole aero synthesis stands on (Vs, AR, the tail
  // volume coefficients), and the two are not the same number. The strip sum is
  // a QUADRATURE: it samples each half-bay at 0.28/0.78 instead of at its
  // centre, so it under-integrates a tapered wing by a few tenths of a per
  // cent. Tiny — but it put the panel's `wing` and `loading` cells on one area
  // while the `stall` cell next to them was on another, which is the kind of
  // disagreement a builder is right not to trust. Prefer the planform where
  // there is one; fall back to the strips for the fiches, unchanged.
  let Sw = g.Sw || 0;
  if (!Sw) for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
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
    // CAN IT FLY A CIRCUIT AT ALL — reported, never enforced, exactly like
    // noseOver and gearFolded above. The garage does not refuse to build the
    // aeroplane; it measures it and says so, and "whether a given engine is a
    // sensible choice is the player's call" (GATE GEN's own words).
    // Both numbers are already measured: the climb gradient at VClimb on full
    // thrust, and the takeoff run. The bar is a climb RATE, because that is
    // what compares across aeroplanes — the fleet climbs at 3-5 m/s, so 0.3 m/s
    // is a tenth of the slowest thing that ships, and TORun is checked against
    // the actual runway rather than a round number.
    // Measured, either side of it: a 28 hp two-seater reads 0.09 m/s and
    // TORun 1508 m, runs off the end of the strip and then mushes along at
    // 1 m agl on full throttle — no autopilot can fly that. A short-span
    // 65 hp build reads 0.61 m/s and TORun 781 m, and flies a complete if
    // leisurely circuit, so it must NOT be excluded.
    climbGrad: g.gammaClimb,
    climbRate: (g.gammaClimb || 0) * (def.params.ap.VClimb || 0),
    flyableCircuit: (g.gammaClimb || 0) * (def.params.ap.VClimb || 0) >= 0.3
                    && def.params.ap.TORun <= 1100,
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
    // EMPTY AND ALL-UP, because `mass` alone was misleading about the one
    // decision it was most often used to judge. The lattice mass is everything
    // the aeroplane weighs with its crew, fuel and freight aboard — the right
    // number to fly and to load-test, and the wrong one to compare materials
    // with: 126 kg of the preset's 402 is payload, so swapping tube-and-fabric
    // for carbon moved the only figure the panel showed by 9% (402 -> 364) when
    // what it had actually bought was 14% of the empty weight (276 -> 238), and
    // more than that of the structure alone, since the 85 kg of engine and prop
    // inside `empty` do not move with the material either. The materials were
    // working; the readout was hiding it. `empty + payload === mass` — the split is
    // the ledger's own flag (61_gen_frame.js), not a second sum over the nodes.
    out.empty = 0; out.payload = 0;
    for (const k in P.ledger) {
      const e = P.ledger[k];
      out.cost += e.cost;
      if (e.payload) out.payload += e.mass; else out.empty += e.mass;
    }
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
  // The approach is flown WITH the flaps out, so the speeds that matter scale
  // off the FLAPS-DOWN stall — Vref = 1.3 Vso is the real-world rule and the
  // fleet's hand-set VAppr values already have their own flaps in them. Derived
  // from the clean stall instead, a big high-lift device produced an aeroplane
  // that approached far too fast: measured on a Fowler-flapped build, it flew
  // the glideslope at MINUS 4.2 degrees alpha on 65% power and sailed over the
  // touchdown zone still 16 m up, never landing at all. The lift was right; the
  // speed it was told to fly was not.
  //
  // MOVED AHEAD OF genTrim: the tunnel now probes the APPROACH as well as the
  // cruise, and it cannot do that until it knows what speed the approach is
  // flown at. Inert for the two numbers genTrim already measured — stabTrim and
  // thrCruise read VCruise, TORun reads VRot and liftoffTh, and none of those
  // move with VAppr.
  const gClean = genClMax(def, 0);
  params.gen.aStall = gClean.aStall;
  if (params.flaps) {
    const g = genClMax(def, params.flaps.ldg ?? 1);
    const VsFlap = Math.sqrt(2 * g.W / (1.225 * g.Sw * Math.max(1e-6, g.CLmax)));
    // BOTH SPEEDS OFF THE SAME INSTRUMENT. `r` is a ratio, so everything common
    // to the two ends cancels — but only if the two are measured the same way.
    // This divided the flapped PROBE by `gen.Vs`, which is analytic and on the
    // geometric reference area, so what reached VAppr was the flap increment
    // PLUS the clean model's own disagreement with the probe. genShakedown's
    // `VsRatio` was already doing it this way; this is the same sum, and
    // `gClean` is the scan that was run three lines up.
    const VsClean = Math.sqrt(2 * gClean.W /
                    (1.225 * gClean.Sw * Math.max(1e-6, gClean.CLmax)));
    const r = VsFlap / VsClean;
    params.ap.VAppr *= r;
    params.ap.VApprShort *= r;
    params.gen.VsFlap = VsFlap;
    params.gen.aStallLdg = g.aStall;
  } else {
    params.gen.VsFlap = params.gen.Vs;
    params.gen.aStallLdg = gClean.aStall;
  }
  genTrim(def);
  return def;
}
