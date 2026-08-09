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
function genLattice(S, gearX, track) {
  const M = GEN_MATERIALS[S.material];
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
  const B = (a, b, cls, ext) => {
    const L = Math.hypot(P[b][0]-P[a][0], P[b][1]-P[a][1], P[b][2]-P[a][2]);
    beams.push({ a, b, k: M.k[cls], c: M.c[cls], gear: cls === 'gear', cls,
                 ext: !!ext || cls === 'gear', L });
    // structural mass: linear density x length, half to each end (this is the
    // whole structural mass model — there is no separate mass budget to keep
    // in sync with the geometry)
    const h = 0.5 * L * M.lin[cls];
    nodes[a].m += h; nodes[b].m += h;
  };
  const cover = (area, ids) => {
    const per = area * M.cover / ids.length;
    for (const i of ids) nodes[i].m += per;
  };
  const pt = (i, m) => { nodes[i].m += m; };

  // ---- 1. fuselage stations ------------------------------------------
  // rings 0..2 are firewall / cabin front / cabin rear; the rest are evenly
  // spaced to the tail. The cabin rings are pinned because the wing spars and
  // the seats attach to them.
  const cab = S.cab, fu = S.fuse;
  const cabRear = cab.noseGap + cab.len;
  const xs = [0, cab.noseGap, cabRear];
  for (let i = 1; i <= fu.tailBays; i++)
    xs.push(cabRear + (fu.tailArm - cabRear) * i / fu.tailBays);
  const ST = xs.map(x => {
    if (x <= cabRear) {
      // firewall is slightly narrower and lower than the cabin (cowl line)
      const u = x / Math.max(1e-6, cab.noseGap);
      const f = x < cab.noseGap ? u : 1;
      return { x, w: cab.halfW * (0.92 + 0.08 * f), yb: -0.02 * f,
               yt: cab.h * (0.78 + 0.22 * f) };
    }
    const t = (x - cabRear) / Math.max(1e-6, fu.tailArm - cabRear);
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
  const PP = POWERPLANTS[S.engine];
  const [EL, ER] = NM(S.engX, S.engY, 0.55 * cab.halfW, 'ENG');
  B(EL, ER, 'fus');
  B(EL, F[0].TL, 'fus'); B(EL, F[0].BL, 'fus'); B(EL, F[0].BR, 'fus');
  B(ER, F[0].TR, 'fus'); B(ER, F[0].BR, 'fus'); B(ER, F[0].BL, 'fus');
  const propM = 2.0 * PP.prop.D;
  pt(EL, 0.5 * (PP.engine.mass + propM)); pt(ER, 0.5 * (PP.engine.mass + propM));

  // ---- 3. wing --------------------------------------------------------
  const w = S.wing, G = S.geom;
  const zRoot = cab.halfW;
  const zs = [];
  for (let i = 1; i <= w.panels; i++)
    zs.push(zRoot + (G.semi - zRoot) * i / w.panels);
  const chordAt = z => w.chord * (1 - (1 - w.taper) * (z - zRoot) / Math.max(1e-6, G.semi - zRoot));
  const sparFront = R.sparFront;
  // rear spar sits on the cabin-rear frame; its chord fraction follows, which
  // is what ties the wing box to the fuselage frames rather than to skin
  const sparSpacing = cabRear - cab.noseGap;
  const sparRear = Math.min(R.sparRearMax, sparFront + sparSpacing / w.chord);
  const xF = w.xLE + sparFront * w.chord, xR = w.xLE + sparRear * w.chord;
  const dih = Math.tan(w.dihedral * D);
  const incAt = z => (w.incidence - w.washout * (z - zRoot) / Math.max(1e-6, G.semi - zRoot)) * D;
  const yF = z => cab.h + (z - zRoot) * dih;
  const wf = { L: null, R: null };
  const mkWing = (s) => {
    const rootF = s > 0 ? F[1].TR : F[1].TL;
    const rootR = s > 0 ? F[2].TR : F[2].TL;
    const strutRoot = s > 0 ? F[1].BR : F[1].BL;
    const WF = zs.map(z => N(xF, yF(z), s * z, 'WF'));
    const WR = zs.map(z => N(xR, yF(z) - sparSpacing * Math.tan(incAt(z)), s * z, 'WR'));
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
    if (w.strut) {
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
    }
    wf[s > 0 ? 'R' : 'L'] = { F: cF, R: cR, strutRoot };
  };
  mkWing(+1); mkWing(-1);
  // centre section covering, over the cabin
  cover(1.9 * 2 * zRoot * w.chord, [F[1].TL, F[1].TR, F[2].TL, F[2].TR]);

  // ---- 4. empennage ---------------------------------------------------
  const t = S.tail;
  const [HTL, HTR] = NM(t.hX, lastST.yb + 0.55 * (lastST.yt - lastST.yb), 0.5 * t.hSpan, 'HT');
  for (const [H, side] of [[HTL, 'L'], [HTR, 'R']]) {
    B(H, TPB, 'fus'); B(H, TPT, 'fus');
    B(H, side === 'L' ? last.BL : last.BR, 'fus');
    B(H, side === 'L' ? last.TL : last.TR, 'fus');
  }
  cover(1.9 * t.Sh, [HTL, HTR, TPB, TPT]);
  const FIN = N(t.vX, lastST.yt + t.vHeight * 0.82, 0, 'FIN');
  B(FIN, TPT, 'fus'); B(FIN, last.TL, 'fus'); B(FIN, last.TR, 'fus');
  cover(1.9 * t.Sv, [FIN, TPT, last.TL, last.TR]);

  // ---- 5. gear --------------------------------------------------------
  const gy = S.gear.y, wr = S.gear.wheelR;
  const gx = gearX !== null && gearX !== undefined ? gearX : cab.noseGap * 0.9;
  const tr = track !== null && track !== undefined ? track : 5 * cab.halfW;
  const [GAL, GAR] = NM(gx, gy, 0.5 * tr, 'AXLE', wr);
  B(GAL, GAR, 'gear');
  // rule 7: the gear needs a LONGITUDINAL (drag) load path anchored well
  // fore and aft of the axle, into HEAVY nodes — the firewall ring and the
  // cabin-front ring, never into light structure.
  B(GAL, F[0].BL, 'gear'); B(GAL, F[1].BL, 'gear'); B(GAL, F[0].BR, 'gear');
  B(GAR, F[0].BR, 'gear'); B(GAR, F[1].BR, 'gear'); B(GAR, F[0].BL, 'gear');
  pt(GAL, 3.5); pt(GAR, 3.5);                          // wheels, tyres, brakes

  const twX = S.gear.twX !== null && S.gear.twX !== undefined
    ? S.gear.twX : fu.postX - 0.10;
  // the tailwheel hangs off the tailpost foot by its leg length; the
  // three-point attitude is whatever that geometry produces (GEN_RULES.twLeg)
  const twY = S.gear.twY !== null && S.gear.twY !== undefined
    ? S.gear.twY : nodes[TPB].p[1] - R.twLeg;
  const TW = N(twX, twY, 0, 'TW', S.gear.twR);
  B(TW, TPB, 'gear'); B(TW, last.BL, 'gear'); B(TW, last.BR, 'gear');
  // rule 10: a near-axial chain LATCHES with every strain under 1%, and no
  // strain gate can see it. Both cures the Cub needed are mandatory here:
  // a snap-blocking near-vertical member, AND a wide lateral pyramid.
  B(TW, TPT, 'gear');
  B(TW, HTL, 'gear'); B(TW, HTR, 'gear');
  pt(TW, 2.0);

  // ---- 6. payload, fuel, systems --------------------------------------
  // tandem: pilot in the FRONT seat first (a J-3 is soloed from the rear, but
  // that is a CG choice the player can make by moving the seat, not a default)
  const seatRings = S.seating === 'tandem2' ? [F[1], F[2]] : [F[1], F[1]];
  for (let i = 0; i < S.crew; i++) {
    const rg = seatRings[i] || F[1];
    pt(rg.BL, 40); pt(rg.BR, 40);
  }
  const fuelM = S.fuelL * 0.72;
  pt(F[0].TL, 0.5 * fuelM); pt(F[0].TR, 0.5 * fuelM);   // header/wing-root tank
  pt(F[0].TL, 6); pt(F[0].TR, 6);                       // panel + systems
  const bag = F[Math.min(3, F.length - 1)];
  pt(bag.BL, 0.5 * S.baggage); pt(bag.BR, 0.5 * S.baggage);

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
    wf, zs, zRoot, xF, xR, sparFront, sparRear, sparSpacing,
    chordAt, yF, incAt, cabRear, gx, tr, twX, twY,
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
  const a = genLattice(S, S.gear.x, S.gear.track);
  const cg = genLatticeCG(a.nodes);
  const gy = S.gear.y;
  // main axle rake: forward of the CG by gearRake degrees off vertical. Too
  // little and it noses over on the brakes; too much and it will not fly the
  // tail up. Track from the CG height, against ground-loop divergence.
  const gx = S.gear.x !== null && S.gear.x !== undefined
    ? S.gear.x : cg[0] - Math.tan(R.gearRake * D) * (cg[1] - gy);
  const tr = S.gear.track !== null && S.gear.track !== undefined
    ? S.gear.track : R.trackRatio * (cg[1] - (gy - S.gear.wheelR));
  const out = genLattice(S, gx, tr);
  out.cg0 = genLatticeCG(out.nodes);
  return out;
}
