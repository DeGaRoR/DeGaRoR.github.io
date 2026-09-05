// ============================================================
// GARAGE 2/5 — the FRAME. Resolved spec -> named node/beam lattice.
//
// This file is where the HANDOVER "STRUCTURAL RULES (each one paid for in
// blood)" live. They are enforced by construction here so that no generated
// airframe can omit one; the numbered comments below cite the rule they serve.
// Nothing downstream may relax them.
//
// The lattice is also the surface: 63_gen_skin.js reads the same stations and
// bays this file emits, so structure and skin cannot disagree. `parts` is that
// shared contract.
//
// Node tags match the hand-written fiches exactly (WF/WR/ENG/AXLE/TW/HT/FIN/
// TPB/TPT), because the solver, the skin binding, the shadow proxy and the
// gate harness all key off them.
// ============================================================

function genQuadArea(P, a, b, c, d) {
  const tri = (i, j, k) => {
    const ux = P[j][0]-P[i][0], uy = P[j][1]-P[i][1], uz = P[j][2]-P[i][2];
    const vx = P[k][0]-P[i][0], vy = P[k][1]-P[i][1], vz = P[k][2]-P[i][2];
    return 0.5 * Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx);
  };
  return tri(a, b, c) + tri(a, c, d);
}

// One pass of the lattice. gearX/track are supplied by genFrame on the second
// pass once the CG is known (see the gear section).
function genLattice(S, gearX, track, kScale) {
  const M = GEN_MATERIALS[S.material];
  // THE PART'S OWN CONSTRUCTION REACHES THE STRUCTURE (G116 mass + price,
  // G117 stiffness + damping — the user: "carbon should cost", then
  // "WYSIWYG is the rule"). `wing.material` / `tail.finMaterial` /
  // `tail.stabMaterial` are additive spec fields (absent = the aeroplane's
  // own), and the section material below follows the ledger's own marker:
  // the wing's members weigh, cost, FLEX and damp as what the wing is built
  // from. See B()'s note for why G116's mass move made the k/c coupling
  // safe to take. A V-TAIL IS ONE SURFACE and takes the stab's material:
  // it IS the horizontal tail, raked; there is no fin to build.
  const MSEC = {
    wings: GEN_MATERIALS[S.wing && S.wing.material] || M,
    tail:  GEN_MATERIALS[S.tail && S.tail.stabMaterial] || M,
  };
  let MB = M;                                   // what the open section BILLS
  const KS = kScale || 1;                       // structure sized for the mass
  const ARCH = GEN_SUSPENSION[S.gear.suspension] || GEN_SUSPENSION.bungee;
  const SUS = (S.gear.stiffness == null ? 1 : S.gear.stiffness) * ARCH.k;
  // Damping does NOT scale with stiffness the way stiffness does. Critical
  // damping is 2*sqrt(k*m), so at constant mass c goes as sqrt(k) — scaling it
  // linearly with the suspension knob piles damping onto the axle node until
  // sum(c)*dt/m passes 1 and the explicit integrator blows up. Measured: at
  // stiffness 3 the gear pinned at 100% strain and stayed there, which reads
  // exactly like a structural collapse and is nothing of the kind.
  // The archetype's damping is DESIGNED, not derived — an oleo really does damp
  // far harder than a bungee — so it multiplies directly. Only the player's
  // stiffness knob follows sqrt(k), since that is a change to one spring.
  // THE KNOB SOFTENS THE SPRING, NOT THE BRACING. It used to scale every gear
  // member, so turning the suspension down softened the drag braces and the
  // belly cross-bracing with it and the undercarriage FOLDED: measured, at 0.6x
  // the aeroplane settled on its belly with the axle 0.75 m in the air, fully at
  // rest, 1.4% strain — rule 1's snap-through, and no strain gate can see it.
  // The barrier was already that close: 1 kg more at the nose (G4.7's honest
  // prop mass) moved it from 0.6x standing at 8% strain to 0.6x folded.
  // Real gear behaves the way the split does: a soft spring gives long travel
  // and the drag brace is a tube either way. `vis === 'leg'` (see B, below) is
  // exactly the suspension member, which is why G4.6's visual work is what made
  // this expressible. IDENTICAL AT stiffness 1.0 for every archetype, which is
  // the whole default fleet — the split only opens up as the knob moves.
  const KG = KS * SUS;                       // the spring
  const KGB = KS * ARCH.k;                   // its bracing: archetype, no knob
  const CS = KS;
  const CG = KS * ARCH.c * Math.sqrt(S.gear.stiffness == null ? 1 : S.gear.stiffness);
  const CGB = KS * ARCH.c;
  const R = GEN_RULES;
  const D = Math.PI / 180;
  const nodes = [], beams = [];
  const P = [];                                     // positions, for area math
  // G185: WHICH PLANE a node belongs to. Tags stay WF/WR/WB on every plane
  // (a tag suffix would silently drop the second plane from the load test's
  // wing set, the skin binding and the join's span); the plane is a FIELD.
  let curPlane = 0;
  const N = (x, y, z, tag, r = 0) => {
    nodes.push({ p: [x, y, z], m: 0, r, tag, plane: curPlane }); P.push([x, y, z]);
    return nodes.length - 1;
  };
  const NM = (x, y, z, tag, r = 0) =>
    [N(x, y, -Math.abs(z), tag + 'L', r), N(x, y, Math.abs(z), tag + 'R', r)];
  // ext = the member is OUTSIDE the covering (struts, gear legs). It stays
  // visible when the aeroplane is covered; everything else disappears under
  // the fabric, which is what the Frame/Covered view modes key off.
  //
  // vis = HOW it is drawn, and it never touches the physics. The undercarriage
  // needs this: the truss the solver wants is not the hardware a real
  // aeroplane wears, and the report was "the tailwheel has too many struts"
  // with "keep the physical model" attached to it. So a member can be a wire
  // instead of a 48 mm tube, or be declared INTERNAL and drop out of the
  // covered view while still standing in Frame mode — which is honest, because
  // Frame mode's whole job is to show the structure that was welded.
  //   null    hexagonal tube, as before
  //   'wire'  thin bracing wire or tie rod
  //   'leg'   the suspension leg — drawn as bungee / spring / oleo (63)
  //   'inner' structural, but inside the covering: goes in the frame mesh
  //   mnt     an ENGINE BEARER member: GEN_RULES.mountK on k, its root on c
  //   opt     G185: { tens, pre } — a TENSION-ONLY member (a wire: no spring
  //           and no damper in compression) and its rigging pre-strain
  const B = (a, b, cls, ext, vis, mnt, opt) => {
    const L = Math.hypot(P[b][0]-P[a][0], P[b][1]-P[a][1], P[b][2]-P[a][2]);
    const isG = cls === 'gear';
    // GEN_RULES.wingK: the wing class is x19 softer than the cap its own mass
    // already buys. See the constant for the measurements and the substep
    // trade. Damping is NOT scaled with it — a stiffer structure at the same c
    // is a more lightly damped one, which is what a real one does, and c is not
    // what binds the timestep here.
    const kGain = cls === 'wing' ? (R.wingK ?? 1) : 1;
    // a gear member is either the SPRING (vis 'leg') or its bracing
    let kG = vis === 'leg' ? KG : KGB, cG = vis === 'leg' ? CG : CGB;
    // A SHORT SPRING IS A STIFF SPRING (2026-09-04, the user: "quite a few of
    // my builds break their tailwheel simply on spawning, it just flips").
    // k was a constant per build, so a 6 cm third-wheel leg deflected the
    // same 4 cm under the tail's weight that the 23 cm default does — 60 % of
    // its own length — and the node passed through the plane of its anchors
    // and latched there (measured: leg strain 0.37, the leg's direction
    // 70 deg off its rest). The join hands the frame that leg from the DRAWN
    // spring's hub, so a player's short spring is exactly how it happens.
    // A real spring of one section is stiffer in proportion to being shorter:
    // k scales by twLeg/L, floored at 1 so nothing at or above the default
    // length moves; c by its root, so the damping ratio is what it was. Only
    // gear springs — the mains' legs are long members and stay at the floor.
    if (isG && vis === 'leg' && L > 1e-6) {
      const short = Math.min(4, Math.max(1, R.twLeg / L));
      kG *= short; cG *= Math.sqrt(short);
    }
    // MB THROUGHOUT (G117, the user: "WYSIWYG is the rule"): a member is
    // stiff, damped, heavy and priced as WHAT THE SECTION IS BUILT FROM —
    // G116 coupled the mass and the money and deliberately left k/c on the
    // aeroplane's own calibration; G117 finished it, and G116's own mass
    // move is what made that safe: with lin AND k from the same material,
    // a carbon wing's stiffness-to-mass ratio in a MIXED build equals the
    // all-carbon aeroplane's wing — a corner the FLEX matrix already flies.
    // The aeroplane-level scalings (KS from the global refMass, wingK, the
    // gear archetype) stay exactly where they were.
    // THE ENGINE BEARER IS 4130 TUBE ON EVERY AEROPLANE (G179): a wooden or
    // a carbon airframe still hangs its engine on a welded steel-tube mount,
    // so a `mnt` member is stiff, damped and heavy as the tubeFabric row says
    // — WYSIWYG (G117), and the member IS steel — and takes GEN_RULES.mountK
    // on k, its root on c (see the constant). Measured and rejected: x10 on
    // the SECTION'S own fus row put a carbon cantilever's load test into a
    // slow divergence (0.66 -> 14.7 % at 1 g), the rig's per-frame trestle
    // clamp resonating with a fuselage row that is already stiff. Steel
    // x10 is x1.5 over carbon's own row and the rig is quiet.
    // G185: the truss classes are steel on every airframe too
    const steel = mnt || cls === 'cabane' || cls === 'interplane' || cls === 'wire';
    const MM = steel ? (GEN_MATERIALS.tubeFabric || MB) : MB;
    const mK = mnt ? (R.mountK == null ? 1 : R.mountK) : 1;
    const bm = { a, b, k: MM.k[cls] * (isG ? kG : KS) * kGain * mK,
                 c: MM.c[cls] * (isG ? cG : CS) * Math.sqrt(mK),
                 gear: isG, cls, ext: vis === 'inner' ? false : (!!ext || isG),
                 vis: vis || null, L };
    if (opt && opt.tens) bm.tens = true;
    if (opt && opt.pre) bm.pre = opt.pre;
    beams.push(bm);
    // structural mass: linear density x length, half to each end (this is the
    // whole structural mass model — there is no separate mass budget to keep
    // in sync with the geometry)
    // ...except a member that only LOCATES a mass (opt.noMass — the engine's
    // CG node, 2026-09-05): the bearer that carries the engine already weighs
    // what it weighs on the mount nodes; six more steel tubes to hold a point
    // where the engine's mass sits would bill 1.7 kg of tube that is not
    // there (measured on the stock build). Stiff and damped like the rest,
    // weightless and unpriced.
    if (!(opt && opt.noMass)) {
      const h = 0.5 * L * MM.lin[cls];
      nodes[a].m += h; nodes[b].m += h;
      bill(2 * h, 2 * h * MM.price);          // ...and priced as it (G179)
    }
  };
  // ---- the LEDGER (G3). Mass and money, attributed to the section being built
  // rather than reconstructed afterwards. `SEC` is a moving marker because this
  // file is already written component by component; tagging every call site
  // would be noise. Structure is priced by its own mass; things that are BOUGHT
  // rather than built (engine, wheels, instruments, paint) call spend().
  const ledger = {};
  let SEC = 'fuselage';
  // WHAT IS THE AEROPLANE AND WHAT IS THE LOAD. `pt()` bills crew, fuel and
  // freight into the same node masses the structure uses — it has to, the
  // solver flies the sum — so the ONLY place the two can be told apart is here,
  // by which section was open when the mass was billed. Naming the PAYLOAD
  // sections rather than the empty ones is deliberate: a component added later
  // and never classified then lands in the empty weight, where it is visible,
  // instead of vanishing into a payload figure nobody reads.
  // The flag rides on the ENTRY rather than in a list the rollup keeps, for the
  // same reason `cover` lives in the skin payload (63_gen_skin.js): the thing
  // that billed the mass knows what it was, and a list maintained anywhere else
  // goes stale the first time a section is added.
  const PAYLOAD_SECS = { cabin: 1, fuel: 1, cargo: 1 };
  const bill = (mass, cost) => {
    const e = ledger[SEC] ||
      (ledger[SEC] = { mass: 0, cost: 0, payload: !!PAYLOAD_SECS[SEC] });
    e.mass += mass || 0; e.cost += cost || 0;
  };
  // ...and the section marker is ALSO the billing-material switch (G116):
  // one coupling point, so bracing, gear and everything after the wing reset
  // to the aeroplane's own material without a call site to forget.
  const sec = s => { SEC = s; MB = MSEC[s] || M; };
  const spend = c => bill(0, c);
  // EVERY SQUARE METRE THE AEROPLANE IS COVERED IN, kept as it is billed. The
  // paint has to weigh on something and this is the only place that knows the
  // real number -- it is summed from the panels actually built, not from a
  // planform estimate, so a bigger cabin or a longer boom is painted too.
  let coverA = 0;
  const coverSeen = {}, coverIds = [];
  const cover = (area, ids) => {
    coverA += area;
    for (const i of ids) if (!coverSeen[i]) { coverSeen[i] = 1; coverIds.push(i); }
    const m = area * MB.cover;
    const per = m / ids.length;
    for (const i of ids) nodes[i].m += per;
    bill(m, m * MB.price);
  };
  const pt = (i, m) => { nodes[i].m += m; bill(m, 0); };

  // ---- 1. fuselage stations ------------------------------------------
  // rings 0..2 are firewall / cabin front / cabin rear; the rest are evenly
  // spaced to the tail. The cabin rings are pinned because the wing spars and
  // the seats attach to them.
  const cab = S.cab, fu = S.fuse;
  const SHP = GEN_SHAPES[fu.shape] || GEN_SHAPES.straight;
  const cabRear = cab.noseGap + cab.len;
  const boxRear = fu.boxRear;                 // cabin + cargo bay: full section
  const xs = [0, cab.noseGap, cabRear];
  if (boxRear > cabRear + 1e-6) xs.push(boxRear);
  for (let i = 1; i <= fu.tailBays; i++)
    xs.push(boxRear + (fu.tailArm - boxRear) * i / fu.tailBays);
  // G54.1: when the join measured the boom PROFILE, the aft stations take
  // their section from it, row-interpolated by the same normalised t — the
  // built boom's own heights, section by section, instead of the family
  // exponent. The user's prescription verbatim: mains fixed, tailwheel
  // measured, "adjust the height of every section of the boom".
  const PROF = Array.isArray(fu.profile) && fu.profile.length >= 2
             ? fu.profile : null;
  const profAt = t0 => {
    let a = PROF[0], b = PROF[PROF.length - 1];
    if (t0 <= a.t) b = PROF[1];
    else if (t0 >= b.t) a = PROF[PROF.length - 2];
    else for (let i = 1; i < PROF.length; i++)
      if (PROF[i].t >= t0) { b = PROF[i]; a = PROF[i - 1]; break; }
    const u = Math.max(0, Math.min(1,
      (t0 - a.t) / Math.max(1e-6, b.t - a.t)));
    return { w: a.w + (b.w - a.w) * u, yb: a.yb + (b.yb - a.yb) * u,
             yt: a.yt + (b.yt - a.yt) * u };
  };
  const ST = xs.map(x => {
    if (x <= boxRear) {
      // G54.3: the ring AT the box end takes the measured profile's first
      // row when there is one — the built belly can already be sweeping up
      // at the passenger pillar, and the full-box default dipped below it
      // (user: "still one fitting issue around the passenger pillar").
      if (PROF && x >= boxRear - 1e-6) {
        const p = profAt(0);
        return { x, w: p.w, yb: p.yb, yt: p.yt };
      }
      // firewall is slightly narrower and lower than the cabin (cowl line)
      const u = x / Math.max(1e-6, cab.noseGap);
      const f = x < cab.noseGap ? u : 1;
      // ring 0 is the firewall: its top is the COWL DECK, well below the cabin
      // roof, and the step between them is the windscreen (see 63_gen_skin.js)
      const deck = fu.cowlDeck;
      return { x, w: cab.halfW * (0.92 + 0.08 * f), yb: -0.02 * f,
               yt: cab.h * (deck + (1 - deck) * f) };
    }
    const t0 = (x - boxRear) / Math.max(1e-6, fu.tailArm - boxRear);
    if (PROF) { const p = profAt(t0); return { x, w: p.w, yb: p.yb, yt: p.yt }; }
    // the SHAPE FAMILY is the profile of the aft taper: an exponent on the
    // station fraction, so width, floor and deck all narrow together but on a
    // straight, late (waisted) or early (pod-and-boom) curve. See GEN_SHAPES.
    const t = SHP.taper === 1 ? t0 : Math.pow(t0, SHP.taper);
    return { x, w: cab.halfW + (fu.tailW - cab.halfW) * t,
             yb: -0.02 + (fu.tailBot + 0.02) * t,
             yt: cab.h + (fu.tailTop - cab.h) * t };
  });

  const F = ST.map((s, i) => {
    const [BL, BR] = NM(s.x, s.yb, s.w, `S${i}B`);
    const [TL, TR] = NM(s.x, s.yt, s.w, `S${i}T`);
    // rule 4: every quad panel needs its diagonal — the ring frame gets a
    // mirror-symmetric X so shear cannot fold it into a parallelogram
    B(BL, BR, 'fus'); B(TL, TR, 'fus'); B(BL, TL, 'fus'); B(BR, TR, 'fus');
    B(BL, TR, 'fus'); B(BR, TL, 'fus');
    return { BL, BR, TL, TR };
  });
  // AN OPEN FRAME CARRIES NO COVERING (2026-09-04): the truss below is built
  // exactly the same; the four panels per bay and the tail-post panel are
  // simply not billed — no cloth, no paint on them — and genFusCdA prices the
  // exposed truss. The wing and the tail keep their own covering.
  const fusCovered = !(S.fuselage && S.fuselage.covering === 'open');
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1], alt = i % 2;
    B(a.BL, b.BL, 'fus'); B(a.BR, b.BR, 'fus');
    B(a.TL, b.TL, 'fus'); B(a.TR, b.TR, 'fus');
    // side-panel diagonals alternate direction bay to bay (a real welded
    // truss does this so the shear path zig-zags instead of running one way)
    B(alt ? a.BL : a.TL, alt ? b.TL : b.BL, 'fus');
    B(alt ? a.BR : a.TR, alt ? b.TR : b.BR, 'fus');
    B(a.TL, b.TR, 'fus'); B(a.TR, b.TL, 'fus');     // rule 4, top panel
    B(a.BL, b.BR, 'fus'); B(a.BR, b.BL, 'fus');     // rule 4, bottom panel
    // covering, four panels per bay, onto the bay's own corners
    const s0 = ST[i], s1 = ST[i + 1];
    if (fusCovered) {
      cover(genQuadArea(P, a.TL, a.TR, b.TR, b.TL), [a.TL, a.TR, b.TR, b.TL]);
      cover(genQuadArea(P, a.BL, a.BR, b.BR, b.BL), [a.BL, a.BR, b.BR, b.BL]);
      cover(genQuadArea(P, a.TL, a.BL, b.BL, b.TL), [a.TL, a.BL, b.BL, b.TL]);
      cover(genQuadArea(P, a.TR, a.BR, b.BR, b.TR), [a.TR, a.BR, b.BR, b.TR]);
    }
    void s0; void s1;
  }
  const last = F[F.length - 1], lastST = ST[ST.length - 1];
  // tail post: two centreline nodes. refs.tailMid points here, so rule 8
  // (attitude reference on RIGID structure) is satisfied by construction.
  const TPB = N(fu.postX, lastST.yb + 0.05, 0, 'TPB');
  const TPT = N(fu.postX, lastST.yt - 0.02, 0, 'TPT');
  B(TPB, TPT, 'fus');
  B(last.BL, TPB, 'fus'); B(last.BR, TPB, 'fus');
  B(last.TL, TPT, 'fus'); B(last.TR, TPT, 'fus');
  B(last.TL, TPB, 'fus'); B(last.TR, TPB, 'fus');
  if (fusCovered)
    cover(genQuadArea(P, last.TL, last.BL, TPB, TPT)
        + genQuadArea(P, last.TR, last.BR, TPB, TPT), [last.TL, last.TR, TPB, TPT]);

  // ---- 2. engine ------------------------------------------------------
  sec('engines');
  // G134: the resolved spec's own powerplant row — custom dials outrank the
  // registry preset; same shape either way (see resolveSpec's S.pplant).
  const PP = S.pplant || POWERPLANTS[S.engine];
  // THE MOUNT (2026-09-04): a nose engine is the firewall pair below, byte for
  // byte; every other mount needs the wing's spar nodes and is built in 2b,
  // after the wing — so the default aeroplane's node order never moves.
  const EAT = S.engAt || [{ mount: 'nose', x: S.engX, y: S.engY, z: 0 }];
  const noseEng = EAT[0].mount === 'nose';
  let EL = -1, ER = -1;
  // every engine bearer member, on every mount, goes through here (G179)
  const BM = (a, b, vis) => B(a, b, 'fus', false, vis || null, true);
  if (noseEng) {
    [EL, ER] = NM(S.engX, S.engY, 0.55 * cab.halfW, 'ENG');
    BM(EL, ER);
    BM(EL, F[0].TL); BM(EL, F[0].BL); BM(EL, F[0].BR);
    BM(ER, F[0].TR); BM(ER, F[0].BR); BM(ER, F[0].BL);
    // The BLADES weigh what the spec says they weigh (S.prop.mass, derived from
    // diameter, blade count and material) rather than the old 2 kg per metre of
    // registry diameter. It lands on the mount nodes rather than at the hub, which
    // is 0.10 m further forward — worth 3 cm of CG on a 500 kg aeroplane with the
    // heaviest prop the clamps allow, and there is no node out there to hang it on.
    //
    // THE ENGINE'S MASS SITS WHERE THE ENGINE IS (2026-09-05, the cgFwd
    // half-session, TURBOPROP §8). The mount nodes are the FLANGE station
    // (engX — the join measures a drawn engine's flange, the prop rule
    // approximates one), and the engine's centre of mass is `S.engCgAft`
    // behind it: 0.20 m on a boxer, 0.63 on a PT6 — the longest arm on the
    // aeroplane, and the lump on the flange had every CG a few centimetres
    // forward of true (a Caravan-alike's by a seat). One node at the CG,
    // held by the two mount nodes and the firewall ring's four corners — a
    // deep truss, the G179 bearer's own lesson — carries the ENGINE; the
    // blades stay on the flange, where they are. A row with no measured CG
    // (S.engCgAft null) hangs the lump exactly as before, byte for byte.
    if (S.engCgAft != null) {
      const CG = N(S.engX + S.engCgAft, S.engY, 0, 'CGE');
      const farN = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1],
                                        P[a][2] - P[b][2]) > 0.05;
      for (const q of [EL, ER, F[0].TL, F[0].TR, F[0].BL, F[0].BR])
        if (farN(CG, q)) B(CG, q, 'fus', false, 'inner', true, { noMass: true });
      pt(CG, PP.engine.mass);
      pt(EL, 0.5 * S.prop.mass);
      pt(ER, 0.5 * S.prop.mass);
    } else {
      pt(EL, 0.5 * (PP.engine.mass + S.prop.mass));
      pt(ER, 0.5 * (PP.engine.mass + S.prop.mass));
    }
  }
  spend((PP.price || 0) * S.engines.length);
  spend(S.prop.price || 0);

  // which frames straddle a given station, so a component that moves finds new
  // ones to attach to instead of dragging its old ones along
  const straddle = x => {
    let f = 0;
    for (let i = 0; i < ST.length; i++) if (ST[i].x < x - 0.05) f = i;
    let a = Math.min(F.length - 1, f + 1);
    for (let i = 0; i < ST.length; i++) if (ST[i].x > x + 0.05) { a = i; break; }
    return [f, Math.max(a, Math.min(f + 1, F.length - 1))];
  };
  const nearestRing = x => {
    let best = 0, bd = 1e9;
    ST.forEach((s, i) => { const d = Math.abs(s.x - x); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  // ---- 3. wing --------------------------------------------------------
  // G185: ONE PLANE AT A TIME. The wing block is a function of the plane
  // index so a biplane's second plane is the same construction over
  // S.wings[1] and S.geom.planes[1]; a monoplane calls it once and emits the
  // nodes and beams it always did, in the same order (GATE GEN's G8 and the
  // WINGSPLIT digests hold that).
  // G185: THE INTERPLANE STATION, one number both planes share — measured on
  // the first plane's exposed semispan so the struts stand vertical between
  // equal planes; a shorter second plane clamps it inboard (its own
  // buildPlane does), so the struts lean, as a sesquiplane's do.
  const IP = (() => {
    const BR = S.bracing || {};
    if (!(S.biplane && BR.interplane && BR.interplane !== 'none')) return 0;
    const w0 = S.wings[0], p0 = (S.geom.planes && S.geom.planes[0]) || S.geom;
    const cH = w0.position === 'parasol' ? (w0.cabaneH == null ? 0.55 : w0.cabaneH) : 0;
    const zR = cab.halfW + (cH > R.cabaneMin ? R.cabaneSplay : 0);
    return zR + (p0.semi - zR) * (BR.interplaneAt == null ? 0.62 : BR.interplaneAt);
  })();
  // where a plane sits, before it is built — the truss needs to know which
  // of the two is the upper one to put the box caps on the far side
  const yOfPlane = w => {
    const POSk = { high: 1, mid: 0.5, low: 0, parasol: 1 }[w.position] ?? 1;
    const cH = w.position === 'parasol' ? (w.cabaneH == null ? 0.55 : w.cabaneH) : 0;
    return cab.h * POSk + (cH > 0 ? cH : R.wingStandoff * (POSk >= 0.75 ? 1 : POSk <= 0.25 ? -1 : 0));
  };
  const buildPlane = (k) => {
  sec('wings');
  curPlane = k;
  const w = S.wings[k], G = (S.geom.planes && S.geom.planes[k]) || S.geom;
  // G185: a PARASOL plane stands on a cabane this far above the roof, and
  // its roots splay outboard of the cabin side (see GEN_RULES.cabaneSplay)
  const cabH = w.position === 'parasol' ? (w.cabaneH == null ? 0.55 : w.cabaneH) : 0;
  const cabane = cabH > R.cabaneMin;
  const zRoot = cab.halfW + (cabane ? R.cabaneSplay : 0);
  // CRANK: a second wing section. The break gets its own spar station, because
  // it is a real joint — the outer panel bolts to the centre section there —
  // and because the dihedral changes across it, so a node has to exist at the
  // kink or the two panels would be joined by a straight member cutting the
  // corner. Only ONE crank: two sections, no more.
  const zCrank = w.crankAt > 0 ? zRoot + (G.semi - zRoot) * w.crankAt : 0;
  const zs = [];
  const ribZ = [];              // rib stations, metres from the centreline
  for (let i = 1; i <= w.panels; i++)
    zs.push(zRoot + (G.semi - zRoot) * i / w.panels);
  if (zCrank > 0) {
    zs.push(zCrank);
    zs.sort((a2, b2) => a2 - b2);
    // a station landing on top of the crank would give a zero-length bay
    for (let i = zs.length - 1; i > 0; i--)
      if (zs[i] - zs[i - 1] < 0.12) zs.splice(zs[i] === zCrank ? i - 1 : i, 1);
  }
  // G185: the interplane station is a real joint too — the strut and the
  // wires bolt on there — so it gets its own spar station, the crank's rule
  let zIP = IP > 0 ? Math.min(IP, G.semi - 0.12) : 0;
  if (zIP > zRoot + 0.12) {
    zs.push(zIP);
    zs.sort((a2, b2) => a2 - b2);
    for (let i = zs.length - 1; i > 0; i--)
      if (zs[i] - zs[i - 1] < 0.12) zs.splice(zs[i] === zIP ? i - 1 : i, 1);
  } else zIP = 0;
  // the wired truss: both planes braced by the interplane struts and the
  // flying/landing wires, never by a fuselage fan
  const BRk = S.bracing || {};
  const trussHere = zIP > 0 && BRk.wires !== 'none';
  // THE WIRED PLANE KEEPS ITS SPAR BOX (measured, twice). First cut: planar
  // two-spar inboard of the strut station, G140's box outboard — rank
  // 272/276: a spar station between the root and the strut has every member
  // in the wing's plane and is free to leave it. Second cut, one inner bay:
  // 248/252 — the outer panel HINGES at the strut station about its own
  // chord line, because the overhang's bending moment is reacted by nothing
  // but spar continuity through the station, and a planar inner bay has
  // none (the strut and the wires act AT the station, with no lever). That
  // is also the real aeroplane's load path: a braced spar is a bending
  // member everywhere and the truss relieves it. So a wired plane is built
  // as the cantilever box below and the interplane struts and wires go ON
  // it (block 3b) — the wires then carry a measured share of the lift
  // (GATE BIPLANE) rather than being the only thing between the wing and
  // the ground. DECLARED SIMPLIFICATION: the braced spar is modelled at
  // cantilever depth and cantilever cap stiffness; a lighter braced-spar
  // row (spruce I-beam sized for the braced case) is owed.

  // is this the UPPER plane of the pair (the box caps go on the far side)
  const upperHere = !S.biplane || S.wings.length < 2
    || (k === 0 ? yOfPlane(S.wings[0]) >= yOfPlane(S.wings[1])
                : yOfPlane(S.wings[1]) > yOfPlane(S.wings[0]));
  // the planform, tip bow included. One function, so the ribs, the covering,
  // the strips and the outline cannot disagree about where the wing is —
  // G140: and that one function is genPlanLaw's, shared with resolveSpec's
  // area/MAC/bow derivation, so the sheet and the structure agree too.
  const LAW = genPlanLaw(w, zRoot, G.semi);
  const linC = LAW.cAt;             // structural chord (box depth reads this)
  const chordAt = z => {
    if (!(w.tipR > 1e-6) || z <= w.tipZ) return LAW.cAt(Math.min(z, G.semi));
    const u = Math.min(1, (z - w.tipZ) / w.tipR);
    return w.tipC * Math.sqrt(Math.max(0, 1 - u * u));
  };
  const sparFront = R.sparFront, sparRear = R.sparRear;
  const sparSpacing = (sparRear - sparFront) * w.chord;
  const xF = w.xLE + sparFront * w.chord, xR = w.xLE + sparRear * w.chord;
  // THE SECTION WALK: both spars move together with the station's own
  // fore/aft offset — the legacy tan(sweep) line verbatim when the station
  // fields are null, the piecewise root->crank->tip walk when set. Measured
  // from the root either way, so the root rib, the strut anchor and the
  // carry-through stay exactly where they were.
  const xFat = z => xF + LAW.xoff(z);
  const xRat = z => xR + LAW.xoff(z);
  const dih = Math.tan(w.dihedral * D);
  const incAt = z => (w.incidence - w.washout * (z - zRoot) / Math.max(1e-6, G.semi - zRoot)) * D;
  // WHERE THE WING MEETS THE FUSELAGE. High sits on the top longerons, low
  // under the floor, mid through the cabin. `attach` is which longeron pair
  // carries it and `oppose` is the one the strut or the depth tie reaches to —
  // the strut on a low wing goes UP, not down.
  const POS = { high: 1, mid: 0.5, low: 0, parasol: 1 }[w.position] ?? 1;
  const wingY0 = cab.h * POS
    + (cabH > 0 ? cabH : R.wingStandoff * (POS >= 0.75 ? 1 : POS <= 0.25 ? -1 : 0));
  // G188: THE DRAWN HEIGHT WINS. wingY0 is the position's rule; a wing the
  // join measured (w.y, root chord line over the keel) sits where it was
  // drawn — the rule put a low wing 0.10 m below the keel while the cage
  // seated it 22 % up the section, 0.24-0.4 m apart on every low-wing build.
  const wingYr = w.y != null ? w.y : wingY0;
  const attachHi = POS >= 0.5, attachTag = attachHi ? 'T' : 'B';
  const opposeTag = attachHi ? 'B' : 'T';
  // a strut is only a brace if its anchor is far enough from the wing — see
  // GEN_RULES.strutMinOffset. Otherwise build the box instead.
  const strutOffset = Math.abs(wingYr - (attachHi ? 0 : cab.h));
  // G140: A CRANKED WING CAN BE STRUT-BRACED — WHEN THE STRUT LANDS ON THE
  // CRANK. The 2026-08-11 exclusion stays true for what it measured: a fan
  // reaching PAST the crank read 22.95 deg @200 N.m at 1.34x (the worst
  // corner in the configuration space), and extending it re-rigged the
  // aeroelastics of strip-force nodes (rule 10) until the aeroplane stopped
  // completing a circuit. Nothing reaches past the crank now: the crank
  // station IS the strut station (the user's ruling — "constrain the crank
  // point to the strut if there's one, free if not"), the fan braces the
  // inner panel only, and the OUTER panel gets the cantilever box from the
  // crank outward — which is the C172's own construction, crank at the
  // strut. An uncranked strutted wing is byte-identical to before; a
  // cranked cantilever keeps its full box; the hybrid is measured by GATE
  // FLEX's new row, and the panel reports `strut + boxed outer` so the
  // construction is never silent.
  const useStrut = w.strut && strutOffset >= R.strutMinOffset;
  // dihedral is piecewise across the crank: flat (or shallow) inboard, steeper
  // outboard. Without a crank both halves use the same angle and this is the
  // straight line it always was.
  const dihOut = Math.tan((w.dihedralOut == null ? w.dihedral : w.dihedralOut) * D);
  const yF = z => {
    const base = wingYr + S.place.wingDy;
    if (zCrank <= 0 || z <= zCrank) return base + (z - zRoot) * dih;
    return base + (zCrank - zRoot) * dih + (z - zCrank) * dihOut;
  };
  const wf = { L: null, R: null };
  let iStrutK = 0;
  const mkWing = (s) => {
    // The wing owns its spar roots. They USED to be two fuselage frame nodes,
    // which is why the wing could not move: shifting it aft left the root on
    // the old frame while the outboard stations walked away from it. Now the
    // roots are the wing's own, and the loads go into the fuselage through a
    // carry-through that re-attaches to whichever frames straddle them.
    const rootF = N(xF, yF(zRoot), s * zRoot, 'WF');
    const rootR = N(xR, yF(zRoot) - sparSpacing * Math.tan(incAt(zRoot)), s * zRoot, 'WR');
    B(rootF, rootR, 'wing');                             // root rib
    // the strut braces from the longeron OPPOSITE the wing: down from a high
    // wing, up from a low one. Rule 1's barrier is the offset, not the direction
    const sd = s > 0 ? 'R' : 'L';
    // G59.2: THE LIFT STRUT LANDS ON THE CABIN LONGERON (user: "the truss
    // should get onto the main longerons of the cabin, at the bottom for
    // high wing, and at the top for low wings"). `nearestRing` alone could
    // pick a station AFT of the cabin — on a measured boom those rings are
    // already tapering, so the strut foot came out 0.23 m inboard and
    // 0.19 m above the cabin's own corner: hanging in air, attached to a
    // former instead of the structure. A lift strut is a primary member and
    // lands on the cabin box; clamp it to the last full-section ring.
    // STRICTLY forward of boxRear: since G54.3 the ring AT the box end
    // takes the measured profile's first row — the PAX PILLAR section,
    // which is already narrower and higher than the cabin. That is right
    // for the skin and wrong for a strut foot, and it is what put the
    // foot 0.23 m inboard of the cabin side. The cabin rings keep the
    // full cab.halfW section; land on the aft-most of those.
    const iBox = (() => {
      let r = 0;
      ST.forEach((s, i) => { if (s.x < boxRear - 0.01) r = i; });
      return r;
    })();
    const strutRoot = F[Math.min(nearestRing(xF), iBox)][opposeTag + sd];
    const side = attachTag + sd, other = attachTag + (s > 0 ? 'L' : 'R');
    // rule 3, box depth through the root: front and rear spars land on
    // DIFFERENT frames wherever the geometry allows, so the biggest moment in
    // the aeroplane has a couple arm instead of passing through a point.
    // The NEAREST frame matters as much as the straddling pair. straddle()
    // has a dead band, so a root sitting almost exactly over a frame gets the
    // two frames either SIDE of it and no direct tie to the one underneath —
    // the wing then hangs on long diagonals, is soft in torsion, and folds
    // through under full-deflection abuse at ~1% strain. That is rule 1's
    // snap-through, and it cost a red STRESS gate to find.
    const lo = opposeTag + sd;
    for (const [nd, x] of [[rootF, xF], [rootR, xR]]) {
      const [iA, iB] = straddle(x), iN = nearestRing(x);
      const rings = [...new Set([iN, iA, iB])];
      if (!cabane) for (const i of rings) B(nd, F[i][side], 'wing');
      else {
        // G185: THE CABANE IS THESE MEMBERS, IN OPEN AIR. On a plane a cabane
        // height above the roof the root ties to the top longerons are not
        // hidden under the fabric — they are the struts you see, so they are
        // drawn (G117: WYSIWYG) and carry the steel class. Which are drawn
        // is the drawing selector bracing.cabane: 'N' = the post to the
        // nearest ring and one diagonal to the straddling ring (the third,
        // if any, stays inner); 'V' = the two straddling members, the post
        // inner. The structure is identical either way — the rigidity rank
        // is the proof — and no member is lumped: what is drawn is the
        // load path.
        const style = (S.bracing && S.bracing.cabane) === 'V' ? 'V' : 'N';
        const iD = iA !== iN ? iA : iB;
        for (const i of rings) {
          const drawn = style === 'N' ? (i === iN || i === iD) : (i === iA || i === iB);
          B(nd, F[i][side], 'cabane', drawn, drawn ? null : 'inner');
        }
      }
      B(nd, F[iN][lo], 'wing');                          // full depth: rule 3
      B(nd, F[iN][other], 'wing');                       // lateral shear path
    }
    const WF = zs.map(z => N(xFat(z), yF(z), s * z, 'WF'));
    const WR = zs.map(z => N(xRat(z), yF(z) - sparSpacing * Math.tan(incAt(z)), s * z, 'WR'));
    const cF = [rootF, ...WF], cR = [rootR, ...WR];
    for (let i = 0; i < zs.length; i++) {
      B(cF[i], cF[i + 1], 'wing'); B(cR[i], cR[i + 1], 'wing');
      B(cF[i + 1], cR[i + 1], 'wing');                       // rib
      // rule 4 again: the wing plan bay is a quad and gets its diagonals
      B(cF[i], cR[i + 1], 'wing'); B(cR[i], cF[i + 1], 'wing');
      const zi = i === 0 ? zRoot : zs[i - 1], zo = zs[i];
      cover(1.9 * (zo - zi) * 0.5 * (chordAt(zi) + chordAt(zo)),
            [cF[i], cF[i + 1], cR[i], cR[i + 1]]);
      // ribs: one every 0.4 m of span, spruce/ply, hung on the two spars
      const nRib = Math.max(1, Math.round((zo - zi) / 0.4));
      const ribM = nRib * 0.5 * (chordAt(zi) + chordAt(zo)) * 0.30;
      pt(cF[i + 1], 0.5 * ribM); pt(cR[i + 1], 0.5 * ribM);
      // ...AND WHERE THEY ARE (G66). This loop has always known the rib
      // COUNT — it bills their mass — and thrown the stations away, so
      // anything that wanted to draw a rib tape had to guess: garage.js
      // carried GEN_RIBS = 13, which is right for the default Cub's
      // semispan and drifts on every other one. The pitch is the same 0.4 m
      // rule, read once, so the structure that pays for the ribs and the
      // surface that shows them cannot disagree.
      for (let k = 1; k <= nRib; k++) ribZ.push(zi + (zo - zi) * k / nRib);
    }
    let cFB = null, cRB = null;
    sec('bracing');
    // G140: where the visible strut lands. Uncranked: the first interior
    // station, exactly as always. Cranked: THE CRANK — the crank station is
    // the strut station now (zCrank was inserted into zs, so it is findable
    // by value), which is what keeps every brace member inboard of the break.
    // G153: a crank station that cannot be found is a BUG, not a root strut.
    // `Math.max(0, findIndex(...))` turned the -1 into station 0 — the
    // CENTRELINE — so a float mismatch in the 1e-9 compare would silently root
    // both lift struts at the fuselage and draw a plausible aeroplane with its
    // bracing attached to nothing. Latent today (zCrank is inserted into zs by
    // value, so it is always found), and latent is exactly when to fix it.
    // The honest fallback is the UNCRANKED rule: the first interior station,
    // which is where the strut goes on a wing with no break.
    const iCrank = zCrank > 0
      ? zs.findIndex(z2 => Math.abs(z2 - zCrank) < 1e-9) : -1;
    const iIP = zIP > 0 ? zs.findIndex(z2 => Math.abs(z2 - zIP) < 1e-9) : -1;
    const iStrut = iCrank >= 0 ? iCrank : (WF.length > 1 ? 1 : 0);
    // G185: on a biplane the station the truss reads is the interplane one
    iStrutK = iIP >= 0 ? iIP : iStrut;
    if (useStrut && !trussHere) {
      // rule 1: SPAR BOX ALWAYS. This wing has no full-depth box, so the
      // barrier against snap-through fold is the strut anchor a full cabin
      // height below the wing — the Cub geometry, and the only reason a
      // planar two-spar wing survives at all.
      // The two members to the strut station are the REAL lift struts and are
      // the only ones drawn; the rest of the fan is the lumped stand-in for a
      // spar box this planar wing does not have, so it lives under the fabric.
      B(strutRoot, WF[iStrut], 'wing', true);
      B(strutRoot, WR[iStrut], 'wing', true);
      // fan ends: station 0 always; the TIP pair only where the fan may
      // reach it — an uncranked wing (byte-identical emissions). On a
      // cranked wing nothing reaches past the crank; the outer panel's
      // stiffness is the box below.
      const ends = zCrank > 0
        // ...and when the crank IS station 0, the real struts already hold
        // it — a second pair would be the double-stiffness shape again
        ? (iStrut === 0 ? [] : [WF[0], WR[0]])
        : [WF[0], WR[0], WF[WF.length - 1], WR[WR.length - 1]];
      for (const t of ends)
        B(strutRoot, t, 'wing');
      // ...AND EVERY STATION IN BETWEEN (2026-08-11, GATE FLEX matrix).
      // The four lines above reach exactly three stations: 0, mid=1 and the
      // last. `wing.panels` is a PLAYER SLIDER clamped 2..5, so at 4 panels the
      // fan skips station 2 and at 5 panels it skips 2 AND 3 — those stations
      // hang between fan members on a planar two-spar wing with no box, which
      // is rule 1 with the barrier removed. Measured (static antisymmetric tip
      // couple, deg @200 N.m / doubling ratio, span 13 chord 1.6):
      //     panels 2   2.38   1.98x      panels 4   21.41   *** 1.56x
      //     panels 3   3.84   1.97x      panels 5   28.73   *** 1.46x
      // A doubling ratio under 2 means it stiffened geometrically on the way,
      // i.e. it started near a MECHANISM — and the rank test cannot see it,
      // because the framework is infinitesimally rigid the whole time. This is
      // the chinook wing's defect exactly (16.4 deg at 1.50x, cured the same
      // way), and it was reachable from the panel by moving one slider.
      // Appended rather than folded into the loop above so the emission ORDER
      // of the existing members is untouched: at panels <= 3 this adds nothing
      // and the whole battery stays bit-identical.
      // Known, left alone: at panels 2, `mid` and `WF.length-1` are the SAME
      // station, so those four lines emit that pair twice — a duplicated beam
      // is double stiffness. It measures linear and stiff, and unpicking it
      // would move panels-2 geometry in a commit about panels 4 and 5.
      // INBOARD OF THE CRANK ONLY. A lift strut reaches the straight inner
      // panel; it does not climb the outer panel of a cranked wing, and
      // pretending otherwise is not a modelling shortcut but a different
      // aeroplane. Measured: the jodel-crank preset (crankAt 0.45, dihedralOut
      // 14) flew a circuit before this block and did NOT after, because a stiff
      // member from the pod bottom to a station 14 deg up the outer panel
      // re-rigs the aeroelastics of nodes that carry strip force — rule 10's
      // "wires that anchor to strip-force-carrying nodes re-rig the
      // aeroelastics". zCrank is 0 when there is no crank, so a straight wing
      // gets every interior station, which is the case this block exists for.
      for (let i = 2; i < WF.length - 1; i++) {
        if (zCrank && zs[i] > zCrank + 1e-9) continue;
        // G140: the crank station already carries the REAL struts — a fan
        // pair on top would be the panels-2 double-stiffness case, chosen
        if (zCrank && i === iStrut) continue;
        B(strutRoot, WF[i], 'wing'); B(strutRoot, WR[i], 'wing');
      }
      // G140: THE OUTER PANEL OF A CRANKED STRUTTED WING IS A BOX — the
      // C172's construction: strut to the crank joint, cantilever box from
      // the crank out. Same members as the full cantilever box below, built
      // over the outer stations only; its root moment lands on the crank
      // station, where the strut and the inner spars react it. No fuselage
      // carry-through — that is the root box's own line, and this box's
      // root is the crank.
      if (zCrank > 0 && iStrut + 1 < cF.length - 0) {
        const depth = z => R.sparBoxDepth * linC(z);
        const zAll = [zRoot, ...zs];
        const bs = iStrut + 1;              // cF/zAll index of the crank
        const mkLower = (up, z, dx) =>
          N(dx, nodes[up].p[1] - depth(z), s * z, 'WB');
        cFB = []; cRB = [];
        for (let i = bs; i < zAll.length; i++) {
          const z = zAll[i];
          cFB[i] = mkLower(cF[i], z, xFat(z));
          cRB[i] = mkLower(cR[i], z, xRat(z));
          B(cF[i], cFB[i], 'wing'); B(cR[i], cRB[i], 'wing');
          B(cFB[i], cRB[i], 'wing');
          B(cF[i], cRB[i], 'wing'); B(cR[i], cFB[i], 'wing');
        }
        for (let i = bs; i < zAll.length - 1; i++) {
          B(cFB[i], cFB[i+1], 'wing'); B(cRB[i], cRB[i+1], 'wing');
          B(cFB[i], cRB[i+1], 'wing'); B(cRB[i], cFB[i+1], 'wing');
          B(cF[i], cFB[i+1], 'wing'); B(cFB[i], cF[i+1], 'wing');
          B(cR[i], cRB[i+1], 'wing'); B(cRB[i], cR[i+1], 'wing');
        }
        // THE STRUT IS THE LOWER CHORD (G140, measured before this pair
        // existed): the box's lower caps END at the crank, so the outer
        // panel's bending moment had no couple arm inboard — the joint was
        // a HINGE, the tip folded 2.4 m up in flight, and the aeroplane
        // hovered at 1 m at full throttle while the static TORSION probe
        // read a healthy 1.81x (bending, not twist — the instrument that
        // catches this is the tip-lift, and GATE FLEX grew it). The real
        // C172 closes the path exactly here: outer lower-cap tension runs
        // into the STRUT at the crank and down to the fuselage. Two lumped
        // members under the fabric, like the fan they extend.
        B(strutRoot, cFB[bs], 'wing');
        B(strutRoot, cRB[bs], 'wing');
      }
    } else {
      // CANTILEVER: no strut, so rule 1 has to be paid for properly — a real
      // full-depth two-spar torsion box. Lower caps under both spars at every
      // station, webs, ribs and shear diagonals on all four faces. This is the
      // Jodel's construction; without it a planar fan folds (the drone did).
      // STRUCTURAL chord, not the aerodynamic outline. The tip bow is a light
      // fairing outboard of the spar box; the box itself does not taper to
      // nothing just because the planform is rounded. Using chordAt here drove
      // the box depth to zero at the tip and put a ZERO-LENGTH beam between the
      // upper and lower caps — the strain = Infinity trap from G2.3d, which
      // rule 1 says to remove geometrically rather than guard against.
      const depth = z => R.sparBoxDepth * linC(z);
      const zAll = [zRoot, ...zs];
      const mkLower = (up, z, dx) => N(dx, nodes[up].p[1] - depth(z), s * z, 'WB');
      cFB = []; cRB = [];
      for (let i = 0; i < zAll.length; i++) {
        const z = zAll[i];
        cFB.push(mkLower(cF[i], z, xFat(z)));
        cRB.push(mkLower(cR[i], z, xRat(z)));
        // station cell: webs down from each cap, lower rib, and its diagonals
        B(cF[i], cFB[i], 'wing'); B(cR[i], cRB[i], 'wing');
        B(cFB[i], cRB[i], 'wing');
        B(cF[i], cRB[i], 'wing'); B(cR[i], cFB[i], 'wing');
      }
      for (let i = 0; i < zs.length; i++) {
        B(cFB[i], cFB[i+1], 'wing'); B(cRB[i], cRB[i+1], 'wing');   // lower caps
        B(cFB[i], cRB[i+1], 'wing'); B(cRB[i], cFB[i+1], 'wing');   // lower plan
        B(cF[i], cFB[i+1], 'wing'); B(cFB[i], cF[i+1], 'wing');     // front web
        B(cR[i], cRB[i+1], 'wing'); B(cRB[i], cR[i+1], 'wing');     // rear web
      }
      // and the box has to carry through the fuselage too, or the whole
      // bending moment still arrives at a point (rule 3)
      const [iA] = straddle(xF), iN = nearestRing(xF);
      for (const i of [...new Set([iN, iA])]) {
        B(cFB[0], F[i][lo], 'wing'); B(cRB[0], F[i][lo], 'wing');
      }
    }
    sec('wings');
    // G140: the strut's LANDING rides out with the frame — the viewer's
    // two-end strut binding needs the exact nodes the beam runs between,
    // and guessing "station 1" over there is how the kink bug was born
    wf[s > 0 ? 'R' : 'L'] = { F: cF, R: cR, FB: cFB, RB: cRB, strutRoot,
                              strutF: useStrut && !trussHere ? WF[iStrut] : null,
                              strutR: useStrut && !trussHere ? WR[iStrut] : null };
  };
  mkWing(+1); mkWing(-1);
  // carry-through: the two spars run across the top of the cabin as one piece,
  // diagonals per rule 4. This is what makes the wing a wing rather than two
  // half-wings bolted to a fuselage.
  B(wf.L.F[0], wf.R.F[0], 'wing'); B(wf.L.R[0], wf.R.R[0], 'wing');
  B(wf.L.F[0], wf.R.R[0], 'wing'); B(wf.R.F[0], wf.L.R[0], 'wing');
  // G140 guard: only a box that REACHES THE ROOT carries through — the
  // hybrid's outer box (strut + boxed outer) starts at the crank, so its
  // FB array is sparse below the crank index and has nothing at [0]
  if (wf.L.FB && wf.L.FB[0] != null) {
    // a cantilever box that stops at the fuselage side is two half-boxes: the
    // lower caps have to run across as well, with their own shear diagonals
    B(wf.L.FB[0], wf.R.FB[0], 'wing'); B(wf.L.RB[0], wf.R.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.RB[0], 'wing'); B(wf.R.FB[0], wf.L.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.F[0], 'wing'); B(wf.R.FB[0], wf.L.F[0], 'wing');
  }
  cover(1.9 * 2 * zRoot * w.chord, [wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0]]);
  curPlane = 0;
  return { k, w, wf, zs, zRoot, zCrank, xF, xR, xFat, xRat, sparSpacing, chordAt,
           yF, incAt, ribZ, linC, useStrut, strutOffset, iStrut: iStrutK,
           semi: G.semi, sparFront, sparRear, cabane, cabH, wingY0,
           zIP, truss: trussHere, upper: upperHere,
           bracing: trussHere ? 'interplane truss'
                  : useStrut ? (w.crankAt > 0 ? 'strut + boxed outer' : 'strut')
                             : 'cantilever box' };
  };
  const planes = [buildPlane(0)];
  for (let k = 1; k < S.wings.length; k++) planes.push(buildPlane(k));
  // ---- 3b. THE INTERPLANE TRUSS (G185) ----------------------------------
  // Both planes exist now. Per side: the interplane strut between the two
  // station pairs ('N' = two posts and a diagonal, all drawn; 'I' = a blade,
  // drawn as its two posts, its shear path the one inner diagonal); the
  // wires — flying, lower root to upper station; landing, upper root to
  // lower station — tension-only and rigged (see B's opt). The truss
  // closes: quad root-station-station-root, its post, both its diagonals.
  if (planes.length > 1) {
    sec('bracing');
    const BR = S.bracing || {};
    const [pA, pB] = planes;
    const up = pA.wingY0 >= pB.wingY0 ? pA : pB, lo = up === pA ? pB : pA;
    const iU = up.iStrut + 1, iL = lo.iStrut + 1;      // cF index of the station
    const wopt = { tens: true, pre: R.wirePreStrain };
    for (const sd of ['L', 'R']) {
      const U = up.wf[sd], Lw = lo.wf[sd];
      const U1F = U.F[iU], U1R = U.R[iU], L1F = Lw.F[iL], L1R = Lw.R[iL];
      if (U1F == null || L1F == null || U1R == null || L1R == null) continue;
      if (BR.interplane === 'N') {
        B(U1F, L1F, 'interplane', true); B(U1R, L1R, 'interplane', true);
        B(U1F, L1R, 'interplane', true);
      } else if (BR.interplane === 'I') {
        B(U1F, L1F, 'interplane', true); B(U1R, L1R, 'interplane', true);
        B(U1F, L1R, 'interplane', false, 'inner');      // the blade's shear path
      }
      if (BR.wires && BR.wires !== 'none') {
        B(Lw.F[0], U1F, 'wire', true, null, false, wopt);      // flying
        B(Lw.R[0], U1R, 'wire', true, null, false, wopt);
        if (BR.wires === 'both') {
          B(U.F[0], L1F, 'wire', true, null, false, wopt);     // landing
          B(U.R[0], L1R, 'wire', true, null, false, wopt);
        }
      }
    }
    sec('wings');
  }
  // plane 0's record under the names every later block has always read
  const { wf, zs, zRoot, zCrank, xF, xR, xFat, xRat, sparSpacing, chordAt, yF,
          incAt, ribZ, linC, useStrut, strutOffset, sparFront, sparRear } = planes[0];
  const w = S.wing, G = S.geom;

  // ---- 2b. engines OFF the nose (2026-09-04) ----------------------------
  // The pusher hangs on the ring nearest its station (the aft bulkhead) as
  // the nose engine hangs on the firewall; the over-the-wing engine is a
  // pylon: its pair braces to the root spars of BOTH sides and back to the
  // cabin roof; a wing nacelle sits on the four spar nodes of its own bay.
  // Each mount node carries its engine's share of engine + blades. refs.engine
  // is whatever list results — the solver spreads the thrust over it and
  // nEngines (the entries) multiplies it, so a pair pulls twice.
  const engNodes = noseEng ? [EL, ER] : [];
  // G194: WHICH ENGINE each mount node belongs to — a single mount hangs one
  // engine on two nodes (0, 0); a wing pair hangs entry 0 on the port node
  // and entry 1 on the starboard one. Published as refs.engineOf so the
  // solver can share thrust per ENGINE (a cut engine, a trimmed lever)
  // instead of evenly over the nodes.
  const engIdx = noseEng ? [0, 0] : [];
  if (!noseEng) {
    sec('engines');
    const iRing = x => {
      let b = 0, d = 1e9;
      ST.forEach((s, i) => { const dd = Math.abs(s.x - x); if (dd < d) { d = dd; b = i; } });
      return b;
    };
    const engM = PP.engine.mass + S.prop.mass;
    // the engine's mass at its CG, behind the flange (ahead of it on a
    // pusher, whose flange faces aft) — the nose block's rule, per mount
    // (2026-09-05, the cfFwd half-session). Anchors: the mount pair and the
    // members the mount itself stands on. Null = the lump on the mount nodes.
    const cgA = S.engCgAft;
    const farN = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1],
                                      P[a][2] - P[b][2]) > 0.05;
    const hangEngine = (e, mountNodes, anchors, z, mEng, mProp) => {
      if (cgA == null) {
        for (const n of mountNodes) pt(n, (mEng + mProp) / mountNodes.length);
        return;
      }
      const CG = N(e.x + (e.pushes ? -cgA : cgA), e.y, z, 'CGE');
      for (const q of mountNodes.concat(anchors))
        if (farN(CG, q)) B(CG, q, 'fus', false, 'inner', true, { noMass: true });
      pt(CG, mEng);
      for (const n of mountNodes) pt(n, mProp / mountNodes.length);
    };
    for (let i = 0; i < EAT.length; i++) {
      const e = EAT[i];
      if (e.mount === 'wing' && i > 0) continue;      // the pair's mirror
      if (e.mount === 'pusher') {
        const [PL, PR] = NM(e.x, e.y, 0.55 * cab.halfW, 'ENG');
        const rg = F[iRing(e.x)];
        BM(PL, PR);
        BM(PL, rg.TL); BM(PL, rg.BL); BM(PL, rg.BR); BM(PL, rg.TR);
        BM(PR, rg.TR); BM(PR, rg.BR); BM(PR, rg.BL); BM(PR, rg.TL);
        hangEngine(e, [PL, PR], [rg.TL, rg.TR, rg.BL, rg.BR], 0,
                   PP.engine.mass, S.prop.mass);
        engNodes.push(PL, PR); engIdx.push(0, 0);
      } else if (e.mount === 'wingTop') {
        const [WL, WR] = NM(e.x, e.y, 0.35 * cab.halfW, 'ENG');
        const rg = F[iRing(e.x)];
        BM(WL, WR);
        for (const [n, o] of [[WL, 'L'], [WR, 'R']]) {
          const q = o === 'L' ? 'R' : 'L';
          BM(n, wf[o].F[0]); BM(n, wf[o].R[0]);
          BM(n, wf[q].F[0]);                             // cross-brace
          BM(n, rg['T' + o]);                            // pylon leg, roof
        }
        hangEngine(e, [WL, WR], [wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0]], 0,
                   PP.engine.mass, S.prop.mass);
        engNodes.push(WL, WR); engIdx.push(0, 0);
      } else if (e.mount === 'wing') {
        // THE BEARER HAS DEPTH (G179). One node on the four spar nodes of
        // its bay is a node IN THE PLANE OF ITS ANCHORS — rule 1's mechanism
        // — and it read 300 mm of sag and a 2.5 Hz bounce on the user's
        // twin (see GEN_RULES.mountFoot). The engine node stays exactly
        // where the spec puts the engine; a FOOT goes under the front spar
        // at the nacelle station (above it, for an engine slung under the
        // wing), one box depth through the spar plane, and a post joins the
        // two. Engine and foot each brace to the bay's four spar nodes (and
        // to the box's lower caps where the wing has them): the post and
        // the two fans are a deep truss with a guaranteed couple arm, which
        // is what a nacelle ahead of the leading edge really hangs on.
        // GEN_RULES.mountFootAt says where along the engine->spar line the
        // foot stands, and why the spar (measured: 6.7 mm on the twin, vs
        // 13.3 under the engine). Whichever station the join measured, the
        // arm is there. The foot's legs are `inner`.
        const [NL, NR] = NM(e.x, e.y, e.z, 'ENG');
        const zAll = [zRoot, ...zs];
        let b = 0;
        for (let k = 0; k < zAll.length - 1; k++) if (e.z >= zAll[k]) b = k;
        b = Math.min(b, zs.length - 1);
        const ySp = yF(e.z), above = e.y >= ySp;
        const depth = R.sparBoxDepth * linC(Math.min(e.z, G.semi));
        const xFoot = e.x + (R.mountFootAt == null ? 1 : R.mountFootAt)
                            * (xFat(e.z) - e.x);
        const feet = R.mountFoot
          ? NM(xFoot, ySp + (above ? -depth : depth), e.z, 'MNT') : null;
        for (const [n, o, ft] of [[NL, 'L', feet && feet[0]],
                                  [NR, 'R', feet && feet[1]]]) {
          const W = wf[o];
          const ring = [W.F[b], W.F[b + 1], W.R[b], W.R[b + 1]];
          for (const q of ring) BM(n, q);
          if (ft != null) {
            BM(n, ft);                                   // the post
            for (const q of ring) BM(ft, q, 'inner');
            // a box's own cap can sit where the foot does (an engine drawn
            // exactly on a station, on the spar) — a zero-length member is
            // strain = Infinity, so that one leg is simply not built
            const far = q => Math.hypot(P[q][0] - P[ft][0], P[q][1] - P[ft][1],
                                        P[q][2] - P[ft][2]) > 0.05;
            for (const caps of [W.FB, W.RB]) if (caps)
              for (const k of [b, b + 1])
                if (caps[k] != null && far(caps[k])) BM(ft, caps[k], 'inner');
          }
          // a whole engine a side — at its CG when the row knows one, on the
          // nacelle node otherwise (the mirror's z is the node's own)
          hangEngine({ x: e.x, y: e.y, pushes: e.pushes }, [n], ring,
                     P[n][2], PP.engine.mass, S.prop.mass);
        }
        engNodes.push(NL, NR); engIdx.push(0, 1);
      }
    }
    EL = engNodes[0]; ER = engNodes[1];
  }

  // ---- 4. empennage ---------------------------------------------------
  sec('tail');
  const t = S.tail;
  // A V-tail's panel tips ride UP as well as out. They keep the HTL/HTR tags —
  // they really are the tail tips, and the shadow proxy, the skin binding and
  // the gate harness all key off those names — so only their position changes
  // and there is simply no FIN node to build.
  const isV = t.type === 'v';
  const isTB = t.type === 'twinBoom' && t.boomX > 0 && t.boomLen > 0;
  const tailY = lastST.yb + 0.55 * (lastST.yt - lastST.yb);
  // STAB HEIGHT. 0 leaves it on the tail cone where it has always been; 1 puts
  // it level with the fin tip, which is a T-tail. Y only — `hX` is the tail arm
  // and is the builder's, so riding up the fin does not silently re-tune pitch.
  const finTopY = lastST.yt + t.vHeight * 0.82;
  const stabY = isV ? tailY + t.vHeight
                    : tailY + (t.stabH || 0) * (finTopY - tailY);
  let HTL, HTR, FIN = null, FIN2 = null, HTBL = null, HTBR = null, BOOMS = null;
  if (isTB) {
    // ---- TWIN BOOMS (2026-09-04, TWIN-BOOM spec §1.3, cut 2) --------------
    // Each boom is a PRISM TRUSS — three nodes a station (a top and two
    // bottoms, in and out), triangles at the stations, longitudinals and
    // diagonals along the bays — rooted on the wing's four spar nodes of its
    // own bay just aft of the rear spar, running `boomLen` aft at ±boomX in
    // the wing's own plane. The stab's nodes ARE the two tail tops (they keep
    // the HTL/HTR tags every consumer keys off); the panel between the booms
    // ties them; one FIN node stands over each tail. The booms are covered
    // tubes (their skin billed at 2πr per metre) in the tail's material.
    const bx = t.boomX, len = t.boomLen;
    const rB = Math.max(0.04, t.boomR || 0.09);
    const zAll = [zRoot, ...zs];
    let b = 0;
    for (let k = 0; k < zAll.length - 1; k++) if (bx >= zAll[k]) b = k;
    b = Math.min(b, zs.length - 1);
    const zB = Math.min(bx, zs[zs.length - 1]);
    const x0 = xRat(zB) + 0.10, y0 = yF(zB);
    const NB = 3, chains = {};
    for (const [sd, sg] of [['L', -1], ['R', 1]]) {
      const st = [];
      for (let k = 0; k <= NB; k++) {
        const x = x0 + len * k / NB;
        const T = N(x, y0 + rB, sg * bx, k === NB ? 'HT' + sd : 'BM' + sd + 'T');
        const I = N(x, y0 - 0.5 * rB, sg * bx - sg * 0.9 * rB, 'BM' + sd + 'I');
        const O = N(x, y0 - 0.5 * rB, sg * bx + sg * 0.9 * rB, 'BM' + sd + 'O');
        B(T, I, 'fus'); B(I, O, 'fus'); B(O, T, 'fus');
        if (k) {
          const p = st[k - 1];
          B(p.T, T, 'fus'); B(p.I, I, 'fus'); B(p.O, O, 'fus');
          B(p.T, I, 'fus'); B(p.I, O, 'fus'); B(p.O, T, 'fus');
        }
        st.push({ T, I, O });
      }
      const w = wf[sd];
      for (const n of [st[0].T, st[0].I, st[0].O])
        for (const m of [w.F[b], w.F[b + 1], w.R[b], w.R[b + 1]]) B(n, m, 'fus');
      cover(2 * Math.PI * rB * len, st.flatMap(q => [q.T, q.I, q.O]));
      chains[sd] = st;
    }
    const tl = chains.L[NB], tr = chains.R[NB];
    HTL = tl.T; HTR = tr.T; HTBL = tl.I; HTBR = tr.I;
    // the panel between the booms ties them — the stab's own cover
    B(tl.T, tr.T, 'fus'); B(tl.I, tr.I, 'fus'); B(tl.T, tr.I, 'fus'); B(tr.T, tl.I, 'fus');
    cover(1.9 * t.Sh, [HTL, HTR, tl.I, tr.I]);
    MB = GEN_MATERIALS[t.finMaterial] || M;
    const finTopB = y0 + rB + t.vHeight * 0.82;
    const xFin = x0 + len - 0.30 * t.vChord;
    FIN = N(xFin, finTopB, bx, 'FIN');
    FIN2 = N(xFin, finTopB, -bx, 'FIN2');
    for (const [f, q, sd] of [[FIN, tr, 'R'], [FIN2, tl, 'L']]) {
      B(f, q.T, 'fus'); B(f, q.I, 'fus'); B(f, q.O, 'fus');
      B(f, chains[sd][NB - 1].T, 'fus');
    }
    cover(1.9 * t.Sv, [FIN, FIN2, tl.T, tr.T]);
    BOOMS = { L: chains.L, R: chains.R, r: rB, x0, len };
  } else {
  [HTL, HTR] = NM(t.hX, stabY, 0.5 * t.hSpan, 'HT');
  for (const [H, side] of [[HTL, 'L'], [HTR, 'R']]) {
    B(H, TPB, 'fus'); B(H, TPT, 'fus');
    B(H, side === 'L' ? last.BL : last.BR, 'fus');
    B(H, side === 'L' ? last.TL : last.TR, 'fus');
  }
  if (isV) {
    cover(1.9 * t.Svt, [HTL, HTR, TPB, TPT]);
  } else {
    cover(1.9 * t.Sh, [HTL, HTR, TPB, TPT]);
    // THE FIN'S OWN MATERIAL (G116): the stab was billed above under the
    // tail section's default; the fin bills its own from here — sec('gear')
    // below resets the marker, so nothing after can inherit it by accident
    MB = GEN_MATERIALS[t.finMaterial] || M;
    // the fin's apex node follows the RAKE, so the truss leans with the fin the
    // skin draws instead of standing upright inside a swept one
    FIN = N(t.vX + Math.tan((t.vSweep || 0) * Math.PI / 180) * t.vHeight * 0.82,
            finTopY, 0, 'FIN');
    B(FIN, TPT, 'fus'); B(FIN, last.TL, 'fus'); B(FIN, last.TR, 'fus');
    cover(1.9 * t.Sv, [FIN, TPT, last.TL, last.TR]);
  }
  }

  // ---- 5. gear --------------------------------------------------------
  sec('gear');
  spend(2 * GEN_PRICES.wheel + GEN_PRICES.thirdWheel + (ARCH.price || 0));
  // G133: THE FAIRINGS WEIGH AND COST. Glassfibre datum: a shell's mass
  // scales with the wheel's area (55·R² ≈ 2.2 kg at R 0.20; a trouser's
  // deeper shell 88·R², its leg shroud included), stretched a little by the
  // droplet; a shroud bought on its own goes by the leg's length.
  // GEN_FAIR_MATS scales mass and price both ways. Every term is zero at
  // the defaults, so no pre-G133 build gains a gram or a credit.
  const FMAT = GEN_FAIR_MATS[S.gear.fairMat] || GEN_FAIR_MATS.glass;
  const fairShellM = (f, r2, t2) => f === 'none' ? 0
    : (f === 'full' ? 88 : 55) * r2 * r2 * (0.8 + 0.2 * (t2 || 1)) * FMAT.m;
  const fairShroudM = l2 => 3.2 * l2 * FMAT.m;
  const mFairMain = fairShellM(S.gear.fairing, S.gear.wheelR || 0.20,
                               S.gear.fairTail)
    + (S.gear.legFair === 'fair' && S.gear.fairing !== 'full'
       ? fairShroudM(S.gear.legDrop || 0.42) : 0);
  const mFairTw = fairShellM(S.gear.twFairing, S.gear.twR || 0.10,
                             S.gear.twFairTail)
    + (S.gear.twLegFair === 'fair' && S.gear.twFairing !== 'full'
       ? fairShroudM(S.gear.twLeg || 0.20) : 0);
  spend(FMAT.price * (
    (S.gear.fairing === 'full' ? 2 * GEN_PRICES.trouser
      : S.gear.fairing === 'spat' ? 2 * GEN_PRICES.spat : 0)
    + (S.gear.legFair === 'fair' && S.gear.fairing !== 'full'
       ? 2 * GEN_PRICES.legFair : 0)
    + (S.gear.twFairing === 'full' ? GEN_PRICES.trouser
      : S.gear.twFairing === 'spat' ? GEN_PRICES.spat : 0)
    + (S.gear.twLegFair === 'fair' && S.gear.twFairing !== 'full'
       ? GEN_PRICES.legFair : 0)));
  const gy = S.gear.y;
  const gx = gearX !== null && gearX !== undefined ? gearX : cab.noseGap * 0.9;
  const tr = track !== null && track !== undefined ? track : 5 * cab.halfW;
  // CAMBER: the node's radius is what the solver contacts the ground on, and a
  // leaning wheel touches R*cos(camber) below its axle. Resolved once, on the
  // spec, so the mesh and the clearance rules cannot disagree with the physics.
  const [GAL, GAR] = NM(gx, gy, 0.5 * tr, 'AXLE', S.gear.contactR);
  B(GAL, GAR, 'gear');
  // Rule 7: the gear needs a LONGITUDINAL (drag) load path anchored well fore
  // AND aft of the axle, into HEAVY nodes. The anchors used to be hard-coded to
  // rings 0 and 1 — but the axle position is DERIVED, and when it landed aft of
  // ring 1 both anchors ended up forward of it, so nothing resisted the axle
  // swinging back and the gear folded (measured on a light engine, which pushes
  // the CG and therefore the axle aft). Pick the frames that straddle it.
  const iFwd = (() => { let r = 0; for (let i = 0; i < ST.length; i++) if (ST[i].x < gx - 0.10) r = i; return r; })();
  const iAft = (() => {
    for (let i = 0; i < ST.length; i++) if (ST[i].x > gx + 0.10) return i;
    return Math.min(F.length - 1, iFwd + 1);
  })();
  // If the axle sits ahead of EVERY frame (a heavy engine drags the CG, and the
  // rake rule then drags the axle, out past the firewall) there is nothing
  // forward to brace against. Hang the forward leg off the ENGINE MOUNT, which
  // is what a real aeroplane does when the gear lives that far forward — and
  // which keeps rule 7's "into HEAVY nodes" satisfied.
  const aheadOfAll = ST[0].x > gx + 0.10;
  const fwdL = aheadOfAll ? EL : F[iFwd].BL, fwdR = aheadOfAll ? ER : F[iFwd].BR;
  const AA = F[Math.max(iAft, aheadOfAll ? 0 : Math.min(iFwd + 1, F.length - 1))];
  // What each of those six members IS, now that `vis` can say so. The forward
  // pair is the SUSPENSION LEG — bungee cord, spring steel or oleo, drawn as
  // whichever the spec bought. The same-side aft pair is the drag brace, a
  // tube, which is what it is on any aeroplane. The two CROSS members run from
  // one axle end to the other side's frame, under the belly: as 48 mm tubes
  // they made the undercarriage read as a cage, and an X of bracing wires under
  // the belly is both what a tube-and-fabric aeroplane actually has and the
  // same load path. Nothing here changes k, c or mass.
  B(GAL, fwdL, 'gear', false, 'leg'); B(GAL, AA.BL, 'gear');
  B(GAL, fwdR, 'gear', false, 'wire');
  B(GAR, fwdR, 'gear', false, 'leg'); B(GAR, AA.BR, 'gear');
  B(GAR, fwdL, 'gear', false, 'wire');
  // RULE 10 FOR THE MAINS (G53). Every one of the six members above lands on a
  // BELLY node, and the belly is a near-horizontal plane — so the axle is held
  // by three anchors it can REFLECT THROUGH. That is a snap-through, and it is
  // invisible to every strain gate: measured, the axle flipped 0.62 m UP at
  // 0.28% strain and the aeroplane settled on its belly with the wheels in the
  // air. It stayed hidden while the ride height was DERIVED, because a deep leg
  // puts the mirror position far enough away that the members must compress 37%
  // to reach it; measuring the ride height off a real build (0.32 m of leg)
  // drops that barrier to 13% and the gear flips on the first bounce.
  // The tailwheel has carried exactly this cure since G4.6 (TW->TPT, below).
  // A near-vertical member up to the ring's TOP corner is also what a
  // bungee-sprung light aeroplane actually has, and like the tailwheel's it is
  // INTERNAL: under the covering it should not be visible.
  B(GAL, F[iFwd].TL, 'gear', false, 'inner');
  B(GAR, F[iFwd].TR, 'gear', false, 'inner');
  pt(GAL, 3.5 + mFairMain); pt(GAR, 3.5 + mFairMain);  // wheels + fairings

  // The third wheel. `refs.tw` is whichever it is — the solver steers that node
  // and the sign of twSteer says which end it lives at.
  const trike = S.gear.type === 'tricycle';
  let TW, twX, twY;
  if (trike) {
    // NOSEWHEEL, forward under the engine bay, at a height that leaves the
    // aeroplane essentially level (a touch nose-up, the way a real trike sits).
    twX = S.gear.twX !== null && S.gear.twX !== undefined
      ? S.gear.twX : Math.min(-0.05, S.engX * 0.45);
    // Sign: rotating the body so BOTH contacts reach the ground gives
    // tan(deck) = (y_third - y_main) / (x_third - x_main). The nosewheel is
    // AHEAD, so the denominator is negative and a nose-UP rest attitude needs
    // its contact BELOW the mains — the opposite of a tailwheel. Getting this
    // backwards stood the aeroplane on its nose at "deck 178.8 deg".
    // SPLIT HEIGHT: given a nose LEG LENGTH the attitude falls out of it, the
    // way the tailwheel's always has. Left null, trikeDeck still works
    // backwards from the attitude and every existing number is unchanged.
    twY = S.gear.twY !== null && S.gear.twY !== undefined
      ? S.gear.twY
      : (S.gear.twLeg !== null && S.gear.twLeg !== undefined
         ? -0.02 - S.gear.twLeg
         : (gy - S.gear.contactR) + S.gear.twR
           - Math.tan(R.trikeDeck * D) * (gx - twX));
    TW = N(twX, twY, 0, 'TW', S.gear.twR);
    // it hangs off the firewall frame and the engine mount — the heavy nodes
    // at that end of the aeroplane (rule 7), with a fore-and-aft path.
    // A real nose gear is one strut and a drag link, so the firewall pair is
    // the leg and the other four are links.
    B(TW, F[0].BL, 'gear', false, 'leg'); B(TW, F[0].BR, 'gear', false, 'leg');
    B(TW, EL, 'gear', false, 'wire'); B(TW, ER, 'gear', false, 'wire');
    B(TW, F[Math.min(1, F.length-1)].BL, 'gear', false, 'wire');
    B(TW, F[Math.min(1, F.length-1)].BR, 'gear', false, 'wire');
    pt(TW, 3.0 + mFairTw);
  } else {
    twX = S.gear.twX !== null && S.gear.twX !== undefined
      ? S.gear.twX : fu.postX - 0.10;
    // the tailwheel hangs off the tailpost foot by its leg length; the
    // three-point attitude is whatever that geometry produces (spec twLeg,
    // defaulting to GEN_RULES.twLeg)
    twY = S.gear.twY !== null && S.gear.twY !== undefined
      ? S.gear.twY : nodes[TPB].p[1]
        - (S.gear.twLeg !== null && S.gear.twLeg !== undefined ? S.gear.twLeg : R.twLeg);
    TW = N(twX, twY, 0, 'TW', S.gear.twR);
    // Six members, and on a real tailwheel exactly one of them is hardware you
    // can see: the spring the wheel hangs on. Report: "too many struts, no
    // spring". So the tailpost member IS the spring/oleo, the pair to the last
    // frame and the pair up to the stabiliser are bracing WIRES (which is what
    // the rule-10 pyramid has always been called in this file), and the
    // near-vertical snap-blocker is declared INTERNAL — it runs from below the
    // tailwheel to the TOP of the tailpost, i.e. straight up through the
    // fuselage, so under the covering it should not be there at all. It still
    // stands in Frame mode and still carries exactly the same load.
    B(TW, TPB, 'gear', false, 'leg');
    B(TW, last.BL, 'gear', false, 'wire'); B(TW, last.BR, 'gear', false, 'wire');
    // rule 10: a near-axial chain LATCHES with every strain under 1%, and no
    // strain gate can see it. Both cures the Cub needed are mandatory here:
    // a snap-blocking near-vertical member, AND a wide lateral pyramid.
    B(TW, TPT, 'gear', false, 'inner');
    B(TW, HTL, 'gear', false, 'wire'); B(TW, HTR, 'gear', false, 'wire');
    pt(TW, 2.0 + mFairTw);
  }

  // ---- 6. payload, fuel, systems --------------------------------------
  // tandem: pilot in the FRONT seat first (a J-3 is soloed from the rear, but
  // that is a CG choice the player can make by moving the seat, not a default)
  sec('cabin');
  spend(S.seats * GEN_PRICES.seat);
  // WHICH FRAME EACH OCCUPANT SITS ON. This was a two-element literal, which
  // is the whole of why the aeroplane could not carry more than two people:
  // a third occupant fell through `|| F[1]` and was billed onto the front row
  // with the pilot, so a full cabin loaded like a solo one and the CG did not
  // move. It is per-LAYOUT now, and every existing layout resolves to exactly
  // what it resolved to before.
  //
  // A ROW OF TWO IS ONE FRAME. `side2` and the front row of `side4` sit
  // abreast, so both occupants bill onto the same ring — the mass is already
  // split BL/BR, which is where the lateral half comes from.
  const SEAT_ROWS = {
    single:  [1],
    tandem2: [1, 2],
    side2:   [1, 1],
    side4:   [1, 1, 2, 2],
    tandem4: [1, 1, 2, 2],
    drone:   [],
  };
  const seatRows = SEAT_ROWS[S.seating] || [1, 1];
  // OCCUPANTS, not crew: `S.crew` is the flight crew and `S.pax` the rest.
  // `S.occupants` is absent on a spec resolved by an older core, and there
  // the old meaning is the right fallback rather than a guess.
  const aboard = S.occupants != null ? S.occupants : S.crew;
  // THE SEATS THE CAGE DRAWS, when the join has measured them (2026-09-03).
  // `cabin.seatsX` is one station per seat, metres aft of the firewall, in
  // this same seat order. A ring is a pillar, not a chair: on the user's Cub
  // the pilot's seat back sat 0.27 m ahead of the front pillar and the
  // passenger's 0.86 m ahead of the aft one, so billing the people on the
  // pillars carried 13 % of MAC of CG aft and read a negative static margin
  // on an aeroplane built to its reference. A station between two rings is
  // split between them by lever arm, so the mass centre lands exactly there
  // and the frame nodes still carry it. Absent (a fiche, an older save), the
  // pillar rule below is unchanged — GATE BUILD's "old layouts resolve
  // exactly as they did" holds to the millimetre.
  const seatsX = Array.isArray(S.cab && S.cab.seatsX) ? S.cab.seatsX : null;
  const billAt = (x, m) => {
    const [f, a] = straddle(x);
    if (f === a || !F[a]) { pt(F[f].BL, 0.5 * m); pt(F[f].BR, 0.5 * m); return; }
    const x0 = ST[f].x, x1 = ST[a].x;
    const wa = Math.max(0, Math.min(1, (x - x0) / Math.max(1e-6, x1 - x0)));
    pt(F[f].BL, 0.5 * m * (1 - wa)); pt(F[f].BR, 0.5 * m * (1 - wa));
    pt(F[a].BL, 0.5 * m * wa);       pt(F[a].BR, 0.5 * m * wa);
  };
  const seatAt = i => (seatsX && typeof seatsX[i] === 'number') ? seatsX[i] : null;
  // WHICH CHAIRS ARE FILLED (G180). `S.occupied` is the resolved per-seat
  // list when the spec named one; otherwise the first `aboard` seats, the rule
  // this loop has always had. The capacity can exceed the layout table now (a
  // bench in every bay), so a seat past the table's rows falls to the row its
  // index implies — one ring per row of `abreast` — rather than to the front
  // ring, which is the collapse the SEAT_ROWS comment above describes.
  const occ = Array.isArray(S.occupied) ? S.occupied : null;
  const nSeats = occ ? occ.length : aboard;
  const abreast = /^side|^tandem4/.test(S.seating || '') ? 2 : 1;
  for (let i = 0; i < nSeats; i++) {
    if (occ ? !occ[i] : i >= aboard) continue;
    const sx = seatAt(i);
    if (sx != null) { billAt(sx, 80); continue; }
    const ri = seatRows[i] != null ? Math.min(seatRows[i], F.length - 1)
             : Math.min(1 + Math.floor(i / abreast), F.length - 1);
    const rg = F[ri] || F[1];
    pt(rg.BL, 40); pt(rg.BR, 40);
  }
  // ---- THE ENERGY, ITS VESSELS AND WHERE THEY SIT (G98, placed at G99) ----
  // A vessel is a real solid in a declared bay, so its mass goes where the
  // solid is rather than onto one of three hard-coded nodes. `along` is metres
  // aft of the firewall for a body bay and a span fraction for a wing bay;
  // `lv` picks the level, keel to crown. Both may be null, and null means the
  // bay's own default — which for a migrated build is the station the old
  // enum's node was AT, so a v6 save does not move (GATE ENERGYBASE).
  //
  // ONE PAIR OF NODES, MIRRORED. Everything the frame bills is symmetric and
  // this is no exception: a tank on the centreline is billed half to each side
  // so the aeroplane does not fly one wing low, which is the same rule
  // GATE GEN's mirror check has enforced since G1.
  const bodyRing = (xWant, lvWant) => {
    let best = 0, bd = Infinity;
    for (let i2 = 0; i2 < F.length; i2++) {
      const d2 = Math.abs((ST[i2] ? ST[i2].x : 0) - xWant);
      if (d2 < bd) { bd = d2; best = i2; }
    }
    const rg = F[best];
    return (lvWant >= 0.5) ? [rg.TL, rg.TR] : [rg.BL, rg.BR];
  };
  const wingPair = (frac, plane) => {
    const W2 = (planes[plane | 0] || planes[0]).wf;        // G185: per plane
    const arrL = W2.L.F, arrR = W2.R.F;
    const k = Math.max(0, Math.min(arrL.length - 1,
      Math.round(frac * (arrL.length - 1))));
    return [arrL[k], arrR[k]];
  };
  sec('vessel');
  let fuelTotalM = 0;
  const VES = (S.energy && S.energy.vessels) || [];
  for (const v of VES) {
    const B = GEN_BAYS[v.bay] || GEN_BAYS.nose;
    const bay = genBayResolve(S, GEN_BAYS[v.bay] ? v.bay : 'nose', ST);
    const r = genVesselResolve(
      S.energy.kind === 'battery' ? 'battery' : 'fuel',
      v.capacity, S.energy.vessel || (S.energy.kind === 'battery' ? 'packCase' : 'alu'),
      S.energy.kind === 'battery' ? S.energy.cell : S.energy.fuel);
    let pair;
    if (B.on === 'wing') {
      // the old 'wing' station was the ROOT spar node and 'panel' the next one
      // out; a null `along` reproduces that rather than picking a midpoint.
      const frac = v.along != null ? v.along
                 : (v.bay === 'wingPanel' ? 0.34 : 0);
      pair = wingPair(frac, B.plane || 0);
    } else {
      const xW = v.along != null ? v.along : bay.xMid;
      const lvW = v.lv != null ? v.lv
                : 0.5 * ((B.lv || [0, 1])[0] + (B.lv || [0, 1])[1]);
      pair = bodyRing(xW, lvW);
    }
    if (r.emptyKg > 0) { pt(pair[0], 0.5 * r.emptyKg); pt(pair[1], 0.5 * r.emptyKg);
                         spend(r.price); }
    v._pair = pair; v._res = r;
    fuelTotalM += r.payloadKg;
  }
  sec('fuel');
  const fuelM = fuelTotalM;
  for (const v of VES) {
    const m = v._res ? v._res.payloadKg : 0;
    if (m <= 0) continue;
    const [a2, b2] = v._pair;
    pt(a2, 0.5 * m); pt(b2, 0.5 * m);
    // G121: WHICH KILOS ARE FUEL, recorded on the node itself — the burn
    // chantier drains these through the solver's setNodeMass door, and
    // genSubsteps sizes the integrator at DRY mass off the same records (a
    // beam is stiffest, per unit mass, when its tank is empty: sized at full
    // it is stable on departure and divergent at reserves).
    // A PACK RECORDS NOTHING HERE, and that is not an omission: `mFuel` is
    // what the burn model drains, and cells do not drain.
    nodes[a2].mFuel = (nodes[a2].mFuel || 0) + 0.5 * m;
    nodes[b2].mFuel = (nodes[b2].mFuel || 0) + 0.5 * m;
  }
  sec('systems');
  const SYS = GEN_SYSTEMS[S.systems.fit] || GEN_SYSTEMS.basic;
  spend(SYS.price);
  pt(F[0].TL, 0.5 * SYS.mass); pt(F[0].TR, 0.5 * SYS.mass);   // panel + systems
  // ---- THE OUTFIT (G159) ------------------------------------------------
  // Everything a real aeroplane carries between its structure and its payload.
  // Each item hangs off a CHOICE or a MEASUREMENT of this aeroplane, never a
  // constant: see GEN_OUTFIT / GEN_SEATS for what each one is and why it is
  // the size it is. Billed to its own section so the plaque can show it and so
  // a future item added here cannot hide inside `fuselage`.
  sec('outfit');
  {
    const O = GEN_OUTFIT, cb = S.cab;
    const seat = GEN_SEATS[(S.outfit && S.outfit.seats)] || GEN_SEATS.sling;
    // HOW MANY SEATS THE AEROPLANE HAS, not how many are filled today. A
    // four-seater carries four seats whether or not anyone is in them, and
    // billing them per OCCUPANT made a passenger appear to weigh 86 kg — the
    // person plus the seat they arrived with. GATE BUILD caught it, which is
    // exactly what that check is for: an occupant weighs 80 kg and nothing
    // else may ride in on the same number.
    const seats = Math.max(1, seatRows.length);
    const EN = (S.engines && S.engines[0]) || {};
    const PPn = S.pplant || POWERPLANTS[EN.type] || POWERPLANTS.a65_sensenich74;
    const kW = ((PPn.engine && PPn.engine.powerW) || 0) / 1000;
    const electric = (PPn.engine && PPn.engine.aspiration) === 'electric';
    // SEATS: one per position, at the weight of the kind you chose.
    // Spread over the seat frames so they sit where the people sit — the
    // cabin rings, which is where `pt` already puts the occupants.
    const seatM = seat.kg * seats;
    // THE PANEL BOARD, from its own geometry. `cab.panel` carries the depth
    // and how far the coaming wraps; the board spans the cabin.
    let panelM = 0;
    if (cb.panel && cb.panel.on) {
      const pw = 2 * cb.halfW * (0.6 + 0.8 * (cb.panel.wrap || 0));
      panelM = pw * (cb.panel.depth || 0.25) * O.panelKgM2;
    }
    // THE COWL, from the surface it actually has: the cowl's own half-width
    // and depth round the engine, over the nose length. Its skin follows the
    // aeroplane's material, because a fabric-over-frame cowl on a tube
    // aeroplane is not an alloy pressing.
    let cowlM = 0;
    if (S.cowl && S.cowl.halfW > 0) {
      const cw = S.cowl.halfW, ch = (S.cowl.top || 0) + (S.cowl.bot || 0);
      // ellipse perimeter, Ramanujan's first approximation
      const a2 = cw, b2 = 0.5 * ch;
      const per = Math.PI * (3 * (a2 + b2) - Math.sqrt((3 * a2 + b2) * (a2 + 3 * b2)));
      cowlM = per * Math.max(0.1, cb.noseGap) *
              (O.cowlKgM2[S.material] || O.cowlKgM2.alloy);
    }
    // THE EXHAUST, from the power it carries. Electric has none.
    const exhM = electric ? 0 : O.exhaustKgKW * kW;
    // THE FUEL PLUMBING, from the litres. A pack's cabling is the energy
    // module's, not this row's, so an electric aeroplane pays nothing here.
    const plumbM = (electric || S.fuelL <= 0) ? 0
                 : O.fuelKgFixed + O.fuelKgL * S.fuelL;
    // THE CONTROLS, from the reach: out to the tips and back to the tail.
    // Dual controls are a second stick and a second set of pedals.
    const reach = S.geom.semi + S.fuse.tailArm;
    const ctlM = O.ctlKgM * reach + (seats > 1 ? O.ctlDualKg : 0);
    // THE GLAZING: the windscreen and the side windows, over the cabin.
    const glassM = cb.glazing === 'none' ? 0        // an open cockpit (2026-09-04)
      : O.glassKgM2 * (2 * cb.halfW * cb.h * 0.55 + 2 * cb.len * cb.h * 0.30);
    // WHERE IT ALL SITS. Each item goes on the frame it belongs to, so the
    // centre of gravity is the real one: seats and controls and glazing on
    // the cabin rings, the panel and the plumbing at the panel frame, the
    // cowl and the exhaust on the firewall.
    const half = (i, j, m) => { nodes[i].m += 0.5 * m; nodes[j].m += 0.5 * m;
                                bill(m, 0); };
    // THE SEATS GO WHERE THE SEATS ARE. With measured stations each chair is
    // billed at its own; without, the front ring as before.
    if (seatsX && seatsX.length)
      for (let i = 0; i < seats; i++) billAt(seatAt(i) != null ? seatAt(i) : ST[1].x, seat.kg);
    else half(F[1].BL, F[1].BR, seatM);
    half(F[1].TL, F[1].TR, panelM + plumbM);
    // the cowl and the exhaust go where the ENGINE is (2026-09-04): a nose
    // mount bills them on the firewall frame exactly as before
    half(noseEng ? F[0].TL : EL, noseEng ? F[0].TR : ER, cowlM);
    half(noseEng ? F[0].BL : EL, noseEng ? F[0].BR : ER, exhM);
    half(F[1].TL, F[1].TR, glassM);
    half(F[1].BL, F[1].BR, 0.5 * ctlM);
    half(F[2].BL, F[2].BR, 0.5 * ctlM);
    spend(Math.round(seat.price * seats + 40 * (panelM + cowlM + glassM) +
                     28 * (exhM + plumbM + ctlM)));
  }
  sec('paint');
  {
    // PAINT HAS MASS (G159). It was `spend()` -- money and nothing else -- and
    // the empty weight was light by it on every aeroplane the garage has ever
    // built. The covering is NOT double counted: GEN_MATERIALS.cover already
    // carries the fabric and its dope, and this is the colour on top. It rides
    // on the covered nodes in proportion, so it lands where the paint is and
    // moves no centre of gravity.
    const FIN = GEN_FINISH[S.paint.job] || GEN_FINISH.full;
    spend(FIN.price);
    const pm = coverA * (FIN.kgM2 || 0);
    if (pm > 0 && coverIds.length) {
      const per = pm / coverIds.length;
      for (const i of coverIds) nodes[i].m += per;
      bill(pm, 0);
    }
  }
  sec('cargo');
  // Freight goes in the cargo bay if there is one, otherwise on the baggage
  // frame with everything else — which is the point of building the bay: it
  // puts the load where you chose rather than wherever it fits.
  const load = S.baggage + S.cargoKg;
  if (fu.cargoLen > 1e-6) {
    // the bay spans frames 2 (cabin rear) and 3 (its own aft bulkhead); spread
    // the freight across both so it sits IN the bay rather than on one end
    for (const rg of [F[2], F[3]]) { pt(rg.BL, 0.25 * load); pt(rg.BR, 0.25 * load); }
  } else {
    const bag = F[Math.min(3, F.length - 1)];
    pt(bag.BL, 0.5 * load); pt(bag.BR, 0.5 * load);
  }

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [TPB, TPT],
    upLo: [F[0].BL, F[0].BR], upHi: [F[0].TL, F[0].TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[F.length-2].BL, F[F.length-2].BR, F[F.length-2].TL, F[F.length-2].TR],
    engine: engNodes, engineOf: engIdx, mains: [GAL, GAR], tw: TW, fin: FIN, fin2: FIN2,
    // THE DRAWING'S DATUM IS THE WING CARRY-THROUGH (G179.3, the user: "we
    // have to treat the whole wing consistently, and get rid of that
    // different treatment for the central part"). The centre section is
    // drawn rigid with the fuselage mesh; the panels outboard follow their
    // spar stations; the two meet at the root — so the root must be where
    // the pose is pinned, or the wing tears there by whatever the root
    // moves against the firewall (8-29 mm on the twin's roll). With the
    // four root spar nodes as the origin, that step is zero by definition,
    // and what the drawing does not show is the fuselage's own flex.
    origin: [wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0]],
  };
  const parts = {
    ST, F, TPB, TPT, EL, ER, HTL, HTR, FIN, FIN2, HTBL, HTBR, BOOMS, GAL, GAR, TW,
    wf, zs, zRoot, zCrank, xF, xR, xFat, xRat, sparFront, sparRear, sparSpacing,
    chordAt, yF, incAt, cabRear, gx, tr, twX, twY,
    ribZ,
    planes,                     // G185: one record per plane; the flat fields above are planes[0]'s                       // G66: where the ribs the mass model billed are

    bracing: useStrut ? (w.crankAt > 0 ? 'strut + boxed outer' : 'strut')
                      : 'cantilever box', strutOffset, trike,
    ledger,
    gearAnchors: [iFwd, iAft], kScale: KS, kGear: KG,
  };
  return { nodes, beams, refs, parts };
}

function genLatticeCG(nodes) {
  let x = 0, y = 0, z = 0, m = 0;
  for (const n of nodes) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; m += n.m; }
  return [x/m, y/m, z/m, m];
}

// Two fixed passes: the first sizes the aeroplane, the second places the main
// gear against the CG it produced. Fixed count, so generation stays
// deterministic (GATE GEN byte-compares a double-generate).
function genFrame(S) {
  const R = GEN_RULES, D = Math.PI / 180;
  const M = GEN_MATERIALS[S.material];
  const a = genLattice(S, S.gear.x, S.gear.track);
  const cg = genLatticeCG(a.nodes);
  // structure sized for the mass the first pass produced. Sub-linear: a bigger
  // aeroplane is not stiffer in proportion, and clamped so a foam trainer does
  // not end up with rubber tube nor a radial with an unbreakable one.
  const kScale = Math.min(4, Math.max(0.45,
    Math.pow(cg[3] / (M.refMass || 390), 0.85)));
  const gy = S.gear.y;
  // main axle rake: forward of the CG by gearRake degrees off vertical. Too
  // little and it noses over on the brakes; too much and it will not fly the
  // tail up. Track from the CG height, against ground-loop divergence.
  // The placement rule INVERTS with the gear type. A taildragger puts the mains
  // ahead of the CG so it rests on its tail; a tricycle puts them BEHIND, and
  // the design quantity is what fraction of the weight the nosewheel then
  // carries (real practice ~8-15%). Solving for that directly is clearer than
  // an angle: x_main = (x_cg - f*x_nose) / (1 - f).
  const trikeGear = S.gear.type === 'tricycle';
  const autoGx = trikeGear
    ? (() => {
        const xNose = Math.min(-0.05, S.engX * 0.45);
        return (cg[0] - R.noseLoad * xNose) / (1 - R.noseLoad);
      })()
    : cg[0] - Math.tan(R.gearRake * D) * (cg[1] - gy);
  const gx = (S.gear.x !== null && S.gear.x !== undefined ? S.gear.x : autoGx)
             + S.place.gearDx;
  const tr = Math.max(0.5, (S.gear.track !== null && S.gear.track !== undefined
    ? S.gear.track : R.trackRatio * (cg[1] - (gy - S.gear.contactR))) + S.place.gearDtrack);
  const out = genLattice(S, gx, tr, kScale);
  out.cg0 = genLatticeCG(out.nodes);
  return out;
}
