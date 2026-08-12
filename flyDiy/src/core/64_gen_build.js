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
  let CLmax = 0;
  for (let a = 2; a <= 22; a += 0.25) {
    const al = a * Math.PI / 180;
    const r = sim.probe([-V * Math.cos(al), -V * Math.sin(al), 0]);
    const L = -r.Fx * Math.sin(al) + r.Fy * Math.cos(al);
    CLmax = Math.max(CLmax, L / (0.5 * 1.225 * V * V * Sw));
  }
  return { CLmax, Sw, W: sim.totalM * 9.81 };
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
  // wing area from the strips, so a hand-written fiche reports the same way
  let Sw = 0;
  for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
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
    for (const k in P.ledger) out.cost += P.ledger[k].cost;
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
  // The approach is flown WITH the flaps out, so the speeds that matter scale
  // off the FLAPS-DOWN stall — Vref = 1.3 Vso is the real-world rule and the
  // fleet's hand-set VAppr values already have their own flaps in them. Derived
  // from the clean stall instead, a big high-lift device produced an aeroplane
  // that approached far too fast: measured on a Fowler-flapped build, it flew
  // the glideslope at MINUS 4.2 degrees alpha on 65% power and sailed over the
  // touchdown zone still 16 m up, never landing at all. The lift was right; the
  // speed it was told to fly was not.
  if (params.flaps) {
    const g = genClMax(def, 1);
    const VsFlap = Math.sqrt(2 * g.W / (1.225 * g.Sw * Math.max(1e-6, g.CLmax)));
    const r = VsFlap / params.gen.Vs;
    params.ap.VAppr *= r;
    params.ap.VApprShort *= r;
    params.gen.VsFlap = VsFlap;
  }
  return def;
}
