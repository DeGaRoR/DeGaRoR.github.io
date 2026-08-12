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
  const N = (x, y, z, tag, r = 0) => {
    nodes.push({ p: [x, y, z], m: 0, r, tag }); P.push([x, y, z]);
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
  const B = (a, b, cls, ext, vis) => {
    const L = Math.hypot(P[b][0]-P[a][0], P[b][1]-P[a][1], P[b][2]-P[a][2]);
    const isG = cls === 'gear';
    // GEN_RULES.wingK: the wing class is x19 softer than the cap its own mass
    // already buys. See the constant for the measurements and the substep
    // trade. Damping is NOT scaled with it — a stiffer structure at the same c
    // is a more lightly damped one, which is what a real one does, and c is not
    // what binds the timestep here.
    const kGain = cls === 'wing' ? (R.wingK ?? 1) : 1;
    // a gear member is either the SPRING (vis 'leg') or its bracing
    const kG = vis === 'leg' ? KG : KGB, cG = vis === 'leg' ? CG : CGB;
    beams.push({ a, b, k: M.k[cls] * (isG ? kG : KS) * kGain, c: M.c[cls] * (isG ? cG : CS),
                 gear: isG, cls, ext: vis === 'inner' ? false : (!!ext || isG),
                 vis: vis || null, L });
    // structural mass: linear density x length, half to each end (this is the
    // whole structural mass model — there is no separate mass budget to keep
    // in sync with the geometry)
    const h = 0.5 * L * M.lin[cls];
    nodes[a].m += h; nodes[b].m += h;
    bill(2 * h, 2 * h * M.price);
  };
  // ---- the LEDGER (G3). Mass and money, attributed to the section being built
  // rather than reconstructed afterwards. `SEC` is a moving marker because this
  // file is already written component by component; tagging every call site
  // would be noise. Structure is priced by its own mass; things that are BOUGHT
  // rather than built (engine, wheels, instruments, paint) call spend().
  const ledger = {};
  let SEC = 'fuselage';
  const bill = (mass, cost) => {
    const e = ledger[SEC] || (ledger[SEC] = { mass: 0, cost: 0 });
    e.mass += mass || 0; e.cost += cost || 0;
  };
  const sec = s => { SEC = s; };
  const spend = c => bill(0, c);
  const cover = (area, ids) => {
    const m = area * M.cover;
    const per = m / ids.length;
    for (const i of ids) nodes[i].m += per;
    bill(m, m * M.price);
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
  const ST = xs.map(x => {
    if (x <= boxRear) {
      // firewall is slightly narrower and lower than the cabin (cowl line)
      const u = x / Math.max(1e-6, cab.noseGap);
      const f = x < cab.noseGap ? u : 1;
      // ring 0 is the firewall: its top is the COWL DECK, well below the cabin
      // roof, and the step between them is the windscreen (see 63_gen_skin.js)
      const deck = fu.cowlDeck;
      return { x, w: cab.halfW * (0.92 + 0.08 * f), yb: -0.02 * f,
               yt: cab.h * (deck + (1 - deck) * f) };
    }
    // the SHAPE FAMILY is the profile of the aft taper: an exponent on the
    // station fraction, so width, floor and deck all narrow together but on a
    // straight, late (waisted) or early (pod-and-boom) curve. See GEN_SHAPES.
    const t0 = (x - boxRear) / Math.max(1e-6, fu.tailArm - boxRear);
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
    cover(genQuadArea(P, a.TL, a.TR, b.TR, b.TL), [a.TL, a.TR, b.TR, b.TL]);
    cover(genQuadArea(P, a.BL, a.BR, b.BR, b.BL), [a.BL, a.BR, b.BR, b.BL]);
    cover(genQuadArea(P, a.TL, a.BL, b.BL, b.TL), [a.TL, a.BL, b.BL, b.TL]);
    cover(genQuadArea(P, a.TR, a.BR, b.BR, b.TR), [a.TR, a.BR, b.BR, b.TR]);
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
  cover(genQuadArea(P, last.TL, last.BL, TPB, TPT)
      + genQuadArea(P, last.TR, last.BR, TPB, TPT), [last.TL, last.TR, TPB, TPT]);

  // ---- 2. engine ------------------------------------------------------
  sec('engines');
  const PP = POWERPLANTS[S.engine];
  const [EL, ER] = NM(S.engX, S.engY, 0.55 * cab.halfW, 'ENG');
  B(EL, ER, 'fus');
  B(EL, F[0].TL, 'fus'); B(EL, F[0].BL, 'fus'); B(EL, F[0].BR, 'fus');
  B(ER, F[0].TR, 'fus'); B(ER, F[0].BR, 'fus'); B(ER, F[0].BL, 'fus');
  // The BLADES weigh what the spec says they weigh (S.prop.mass, derived from
  // diameter, blade count and material) rather than the old 2 kg per metre of
  // registry diameter. It lands on the mount nodes rather than at the hub, which
  // is 0.10 m further forward — worth 3 cm of CG on a 500 kg aeroplane with the
  // heaviest prop the clamps allow, and there is no node out there to hang it on.
  pt(EL, 0.5 * (PP.engine.mass + S.prop.mass));
  pt(ER, 0.5 * (PP.engine.mass + S.prop.mass));
  spend((PP.price || 0) * S.engines.length);
  spend(S.prop.price || 0);

  // ---- 3. wing --------------------------------------------------------
  sec('wings');
  const w = S.wing, G = S.geom;
  const zRoot = cab.halfW;
  // CRANK: a second wing section. The break gets its own spar station, because
  // it is a real joint — the outer panel bolts to the centre section there —
  // and because the dihedral changes across it, so a node has to exist at the
  // kink or the two panels would be joined by a straight member cutting the
  // corner. Only ONE crank: two sections, no more.
  const zCrank = w.crankAt > 0 ? zRoot + (G.semi - zRoot) * w.crankAt : 0;
  const zs = [];
  for (let i = 1; i <= w.panels; i++)
    zs.push(zRoot + (G.semi - zRoot) * i / w.panels);
  if (zCrank > 0) {
    zs.push(zCrank);
    zs.sort((a2, b2) => a2 - b2);
    // a station landing on top of the crank would give a zero-length bay
    for (let i = zs.length - 1; i > 0; i--)
      if (zs[i] - zs[i - 1] < 0.12) zs.splice(zs[i] === zCrank ? i - 1 : i, 1);
  }
  // the planform, tip bow included. One function, so the ribs, the covering,
  // the strips and the outline cannot disagree about where the wing is.
  const linC = z => w.chord * (1 - (1 - w.taper) * (z - zRoot) / Math.max(1e-6, G.semi - zRoot));
  const chordAt = z => {
    if (!(w.tipR > 1e-6) || z <= w.tipZ) return linC(Math.min(z, G.semi));
    const u = Math.min(1, (z - w.tipZ) / w.tipR);
    return w.tipC * Math.sqrt(Math.max(0, 1 - u * u));
  };
  const sparFront = R.sparFront, sparRear = R.sparRear;
  const sparSpacing = (sparRear - sparFront) * w.chord;
  const xF = w.xLE + sparFront * w.chord, xR = w.xLE + sparRear * w.chord;
  // SWEEP: both spars walk aft with span. Measured from the root, so the root
  // rib, the strut anchor and the carry-through all stay exactly where they
  // were and only the outboard structure moves — which is what lets sweep be a
  // balance knob rather than a redesign.
  const swpT = Math.tan((w.sweep || 0) * D);
  const xFat = z => xF + (z - zRoot) * swpT;
  const xRat = z => xR + (z - zRoot) * swpT;
  const dih = Math.tan(w.dihedral * D);
  const incAt = z => (w.incidence - w.washout * (z - zRoot) / Math.max(1e-6, G.semi - zRoot)) * D;
  // WHERE THE WING MEETS THE FUSELAGE. High sits on the top longerons, low
  // under the floor, mid through the cabin. `attach` is which longeron pair
  // carries it and `oppose` is the one the strut or the depth tie reaches to —
  // the strut on a low wing goes UP, not down.
  const POS = { high: 1, mid: 0.5, low: 0 }[w.position] ?? 1;
  const wingY0 = cab.h * POS
    + R.wingStandoff * (POS >= 0.75 ? 1 : POS <= 0.25 ? -1 : 0);
  const attachHi = POS >= 0.5, attachTag = attachHi ? 'T' : 'B';
  const opposeTag = attachHi ? 'B' : 'T';
  // a strut is only a brace if its anchor is far enough from the wing — see
  // GEN_RULES.strutMinOffset. Otherwise build the box instead.
  const strutOffset = Math.abs(wingY0 - (attachHi ? 0 : cab.h));
  // A CRANKED WING CANNOT BE STRUT-BRACED either, for the same reason and with
  // the same cure (2026-08-11, GATE FLEX matrix). A crank INSERTS a spar
  // station, so the fan leaves the outer panel unbraced exactly as panels 4-5
  // did — measured, the jodel-crank preset read 22.95 deg @200 N.m at a
  // doubling ratio of 1.34x, the WORST corner in the whole configuration space
  // and worse than panels 5 ever was. And it cannot be cured by extending the
  // fan: a stiff member from the pod bottom to a station 14 deg up the outer
  // panel re-rigs the aeroelastics of nodes that carry strip force (rule 10),
  // and the aeroplane stopped completing a circuit.
  // The outer panel of a cranked wing wants a box, which is what the real
  // aeroplane this planform comes from actually has — the Jodel fiche is a
  // cantilever. Substituted, it measures 2.76 / 5.39 at 1.95x and flies.
  // Same shape of rule as strutMinOffset, and visible the same way: the panel
  // reports `bracing: cantilever box` so the substitution is never silent.
  const useStrut = w.strut && strutOffset >= R.strutMinOffset && !(w.crankAt > 0);
  // dihedral is piecewise across the crank: flat (or shallow) inboard, steeper
  // outboard. Without a crank both halves use the same angle and this is the
  // straight line it always was.
  const dihOut = Math.tan((w.dihedralOut == null ? w.dihedral : w.dihedralOut) * D);
  const yF = z => {
    const base = wingY0 + S.place.wingDy;
    if (zCrank <= 0 || z <= zCrank) return base + (z - zRoot) * dih;
    return base + (zCrank - zRoot) * dih + (z - zCrank) * dihOut;
  };
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
  const wf = { L: null, R: null };
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
    const strutRoot = F[nearestRing(xF)][opposeTag + sd];
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
      for (const i of [...new Set([iN, iA, iB])]) B(nd, F[i][side], 'wing');
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
    }
    let cFB = null, cRB = null;
    sec('bracing');
    if (useStrut) {
      // rule 1: SPAR BOX ALWAYS. This wing has no full-depth box, so the
      // barrier against snap-through fold is the strut anchor a full cabin
      // height below the wing — the Cub geometry, and the only reason a
      // planar two-spar wing survives at all.
      // The two members to the mid station are the REAL lift struts and are
      // the only ones drawn; the rest of the fan is the lumped stand-in for a
      // spar box this planar wing does not have, so it lives under the fabric.
      const mid = WF.length > 1 ? 1 : 0;
      B(strutRoot, WF[mid], 'wing', true);
      B(strutRoot, WR[mid], 'wing', true);
      for (const t of [WF[0], WR[0], WF[WF.length-1], WR[WR.length-1]])
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
        B(strutRoot, WF[i], 'wing'); B(strutRoot, WR[i], 'wing');
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
    wf[s > 0 ? 'R' : 'L'] = { F: cF, R: cR, FB: cFB, RB: cRB, strutRoot };
  };
  mkWing(+1); mkWing(-1);
  // carry-through: the two spars run across the top of the cabin as one piece,
  // diagonals per rule 4. This is what makes the wing a wing rather than two
  // half-wings bolted to a fuselage.
  B(wf.L.F[0], wf.R.F[0], 'wing'); B(wf.L.R[0], wf.R.R[0], 'wing');
  B(wf.L.F[0], wf.R.R[0], 'wing'); B(wf.R.F[0], wf.L.R[0], 'wing');
  if (wf.L.FB) {
    // a cantilever box that stops at the fuselage side is two half-boxes: the
    // lower caps have to run across as well, with their own shear diagonals
    B(wf.L.FB[0], wf.R.FB[0], 'wing'); B(wf.L.RB[0], wf.R.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.RB[0], 'wing'); B(wf.R.FB[0], wf.L.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.F[0], 'wing'); B(wf.R.FB[0], wf.L.F[0], 'wing');
  }
  cover(1.9 * 2 * zRoot * w.chord, [wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0]]);

  // ---- 4. empennage ---------------------------------------------------
  sec('tail');
  const t = S.tail;
  // A V-tail's panel tips ride UP as well as out. They keep the HTL/HTR tags —
  // they really are the tail tips, and the shadow proxy, the skin binding and
  // the gate harness all key off those names — so only their position changes
  // and there is simply no FIN node to build.
  const isV = t.type === 'v';
  const tailY = lastST.yb + 0.55 * (lastST.yt - lastST.yb);
  const [HTL, HTR] = NM(t.hX, isV ? tailY + t.vHeight : tailY, 0.5 * t.hSpan, 'HT');
  for (const [H, side] of [[HTL, 'L'], [HTR, 'R']]) {
    B(H, TPB, 'fus'); B(H, TPT, 'fus');
    B(H, side === 'L' ? last.BL : last.BR, 'fus');
    B(H, side === 'L' ? last.TL : last.TR, 'fus');
  }
  let FIN = null;
  if (isV) {
    cover(1.9 * t.Svt, [HTL, HTR, TPB, TPT]);
  } else {
    cover(1.9 * t.Sh, [HTL, HTR, TPB, TPT]);
    FIN = N(t.vX, lastST.yt + t.vHeight * 0.82, 0, 'FIN');
    B(FIN, TPT, 'fus'); B(FIN, last.TL, 'fus'); B(FIN, last.TR, 'fus');
    cover(1.9 * t.Sv, [FIN, TPT, last.TL, last.TR]);
  }

  // ---- 5. gear --------------------------------------------------------
  sec('gear');
  spend(2 * GEN_PRICES.wheel + GEN_PRICES.thirdWheel + (ARCH.price || 0));
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
  pt(GAL, 3.5); pt(GAR, 3.5);                          // wheels, tyres, brakes

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
    pt(TW, 3.0);
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
    pt(TW, 2.0);
  }

  // ---- 6. payload, fuel, systems --------------------------------------
  // tandem: pilot in the FRONT seat first (a J-3 is soloed from the rear, but
  // that is a CG choice the player can make by moving the seat, not a default)
  sec('cabin');
  spend(S.seats * GEN_PRICES.seat);
  const seatRings = S.seating === 'tandem2' ? [F[1], F[2]] : [F[1], F[1]];
  for (let i = 0; i < S.crew; i++) {
    const rg = seatRings[i] || F[1];
    pt(rg.BL, 40); pt(rg.BR, 40);
  }
  sec('fuel');
  const fuelM = S.fuelL * 0.72;
  // WHERE the fuel sits. Nose is the Cub's — ahead of the panel, and it moves
  // the CG forward. Wing-root hangs it on the spar carry-through. Outboard puts
  // it in the panel, which relieves the wing in flight and slows the roll,
  // because the tanks are the heaviest thing you can put out there.
  const tankL = S.fuel.tank === 'wing' ? wf.L.F[0]
              : S.fuel.tank === 'panel' ? wf.L.F[Math.min(1, wf.L.F.length - 1)]
              : F[0].TL;
  const tankR = S.fuel.tank === 'wing' ? wf.R.F[0]
              : S.fuel.tank === 'panel' ? wf.R.F[Math.min(1, wf.R.F.length - 1)]
              : F[0].TR;
  pt(tankL, 0.5 * fuelM); pt(tankR, 0.5 * fuelM);
  sec('systems');
  const SYS = GEN_SYSTEMS[S.systems.fit] || GEN_SYSTEMS.basic;
  spend(SYS.price);
  pt(F[0].TL, 0.5 * SYS.mass); pt(F[0].TR, 0.5 * SYS.mass);   // panel + systems
  sec('paint');
  spend(GEN_PRICES.paintJob);
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
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const parts = {
    ST, F, TPB, TPT, EL, ER, HTL, HTR, FIN, GAL, GAR, TW,
    wf, zs, zRoot, zCrank, xF, xR, xFat, xRat, sparFront, sparRear, sparSpacing,
    chordAt, yF, incAt, cabRear, gx, tr, twX, twY,
    bracing: useStrut ? 'strut' : 'cantilever box', strutOffset, trike,
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
