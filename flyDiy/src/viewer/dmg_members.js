// G3770-G3773 (DMG-LOOKS, ?dmglook=1 - OFF by default): THE STRUCTURE BY MATERIAL. The user, 25 Oct: "the tubular cage,
// the wooden pillars, the metal frames ... the metal should bend, wood should break like wood" - and "beware of
// performance". The study (futureDesigns/DMG-LOOKS-STUDY-2026-10.md section 10, brief 2) measured why the wreck cannot
// show it today: every broken member is drawn split at exactly half its length, its ends flat; and the flown snapshot's
// members have a ring only every ~14 cm (median 7 a metre, many one straight segment) - no vertex where a hinge or a
// splinter would go. Two pieces here, both drawn only once something is broken:
//   1. THE PLAN (plan(), at a break event - pure, node-tested by GATE DMGLOOK): for each broken frame member, where its
//      drawn places part (skin_break.js's parting rule: R.look.part) - a member released at a fitting or by a cluster's
//      cut goes WHOLE with the part that came off; a kink on one piece is UNPARTED (the solver's floor holds its crushed
//      length: one piece); a fold parts at its hinge; a tension, ragged or core break at a seeded station - and which
//      members the POOL draws instead of the snapshot (R.look.hide: their snapshot triangles collapse, as a break's).
//   2. THE MEMBER POOL (make(), parked at roll-out with the world - ground_scar.js's rule: its program links with the
//      world's, none in a crash): one mesh of SLOTS x 2 pieces x RINGS x AROUND canonical vertices (a vertex's position
//      is (u along its piece, k round it, slot x 2 + piece)), one RGBA float texture of 8 texels a slot. At an event a
//      slot gets its member (texels 4-7: the rest direction and length, the bend axis and hinge, the section, the break
//      station, the paint); each POSED frame (the wreck moving - brkCage) the CPU writes texels 0-3 (the two nodes' live
//      places less the pool's origin, their turns: skin_break.js nodeFrames') - 16 floats a used slot, ~8 kB at the cap
//      - and the vertex shader poses every vertex from them (LOOK_GLSL below; pose() is the same in JS, the gate's
//      mirror). No CPU a vertex, no program linked, no GL object made at a crash; ONE draw while a wreck exists (the
//      study's flag 1, A0 OK 26 Oct), none at rest before a crash (the mesh is hidden), no shadow cast.
// The looks, by material and the solver's state (study 10.3; pictures futureDesigns/dmg-looks/steel_cage.png,
// wood_members.png):
//   STEEL TUBE (tubeFabric: the Cub's cage, every engine mount) and ALLOY TUBE (aluTube)
//     bent, whole       two legs that keep their rest length, meeting at a short rounded crease at the hinge (kt1:
//                       the solver's own for a trunk bend, seeded 0.5 +- 0.15 for a buckle); the tube OVALISED there
//                       (-38 % in the bend plane, +20 % across) and the crease's inside pushed in
//     kinked (a floor)  folded, ONE piece, never split
//     broken            each stub rides its own end, keeps its leg's bend, its end NECKED (the radius -40 % over the
//                       last 1.5 r) and TORN (the end ring jagged +-0.9 r round the tube, seeded); bare steel at the
//                       tear - an alloy tube's bare alloy then the GREY PRIMER band (the user's ruling, 25 Oct)
//   WOOD (spruce longerons, pillars, spar caps)
//     elastic           straight: the pool never takes elastic wood
//     broken            a comb of SLIVERS along the grain, 3-6 x the section depth and uneven (some short), tapered to
//                       their tips, on both pieces; raw wood at the fracture
//     bent, whole       GREENSTICK: hanging bent at a sharp crack, the tension face's raw wood showing
//     kinked            a CRUSH: a kink band inclined across the depth, still one piece
// The alloy SECTIONS (the metal Cessna's formers and stringers: drawn on its inside wall, not as tubes) are the
// stretch's (crimps and the rivet-line tear): not here.
// PURE apart from make() (THREE passed in): node loads it (module.exports); window.DMG_MEMBERS in the page.
(function () {
  'use strict';
  const SLOTS = 128;          // the cap: every census run needed at most 98 (study 10.3); past it a member keeps today's drawing
  const RINGS = 14;           // rings a piece (two pieces a slot): clustered at the hinge or the break (ringU)
  const AROUND = 8;           // vertices round a ring (a tube's octagon; a wood section's four corners and four mid-sides)
  const TX = 8;               // texels a slot
  const BEND_MIN = 0.015;     // m: a trunk bend drawn (= sim_host.js SIM_DMG_BEND_MIN)
  const SET_MIN = 0.01;       // a chord shortened past 1 % by its set: buckled (a tube; wood stays straight)
  const KINK_STRETCH = 1.05;
  const R_MAX = 0.025, H_MAX = 0.05;   // m: a tube's radius, a wood member's half-depth, at most (the Cub's 4130: 0.9-1.6 cm)  // a kinked member whose ends are pulled past 1.05 x its rest length is drawn torn
  // the materials the pool takes (30_solver's member `mat`, 60_gen_spec GEN_CRASH keys): 1 steel, 2 alloy tube, 3 wood
  const MAT = { tubeFabric: 1, aluTube: 2, wood: 3 };
  // the modes (texel 1's w): whole (0: bent or straight), torn stubs (1), unparted kink (2), wood: slivers (3),
  // greenstick (4), crush (5)
  const MODE = { whole: 0, torn: 1, kink: 2, sliver: 3, green: 4, crush: 5 };
  // 30_solver.js howCode: 1 tension, 2 kink, 3 fold, 4 ragged, 5 group, 6 a cluster's cut, 7 core, 8 gate
  const RELEASE = c => c === 5 || c === 6 || c === 8;
  const COL = { steel: [0.78, 0.79, 0.80], alloy: [0.84, 0.86, 0.88], primer: [0.62, 0.63, 0.64], raw: [0.93, 0.80, 0.58] };

  // a seeded hash in [0, 1) - the shader's own (uint arithmetic: the same bits in JS and GLSL)
  function h1(k, seed) {
    let h = (Math.imul(k >>> 0, 374761393) + Math.imul(seed >>> 0, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }
  // a member's station seeded in [lo, hi]
  const seeded = (bi, lo, hi) => lo + (hi - lo) * h1(bi, 0x5eed);

  // ---- WHAT THE SNAPSHOT DRAWS OF EACH MEMBER (once a binding: skin_break.js inhSteps' R.mem / R.mt) ----
  // recs: the cage's records; rest: the nodes in the frame's coordinates (the records' g.pos frame). For each member with
  // drawn places: its section about its line (a tube's mean radius; a wood member's two half-depths along its principal
  // axes, and the first axis - the section's 'up'), and its paint (the record's R.col, linear RGB)
  function measure(recs, T, rest) {
    const nb = T.nb, beams = T.beams;
    const n = new Int32Array(nb), sr = new Float64Array(nb), cov = new Float64Array(nb * 6), col = new Float32Array(nb * 3).fill(-1), rd = new Map();
    for (const R of recs) { const M = R.mem; if (!M) continue; const P = R.g.pos, rp = R.rep;
      for (let v = 0; v < R.nv; v++) { const bi = M[v]; if (bi < 0 || (rp && rp[v] !== v)) continue;
        const b = beams[bi], ax = rest[b.a * 3], ay = rest[b.a * 3 + 1], az = rest[b.a * 3 + 2];
        const ex = rest[b.b * 3] - ax, ey = rest[b.b * 3 + 1] - ay, ez = rest[b.b * 3 + 2] - az, L = Math.hypot(ex, ey, ez) || 1e-9;
        const ux = ex / L, uy = ey / L, uz = ez / L;
        let dx = P[v * 3] - ax, dy = P[v * 3 + 1] - ay, dz = P[v * 3 + 2] - az; const t = dx * ux + dy * uy + dz * uz;
        dx -= t * ux; dy -= t * uy; dz -= t * uz;
        n[bi]++; const dd = Math.hypot(dx, dy, dz); sr[bi] += dd; let Ld = rd.get(bi); if (!Ld) rd.set(bi, Ld = []); Ld.push(dd);
        const o = bi * 6; cov[o] += dx * dx; cov[o + 1] += dy * dy; cov[o + 2] += dz * dz; cov[o + 3] += dx * dy; cov[o + 4] += dx * dz; cov[o + 5] += dy * dz;
        if (col[bi * 3] < 0 && R.col) { col[bi * 3] = R.col[0]; col[bi * 3 + 1] = R.col[1]; col[bi * 3 + 2] = R.col[2]; } } }
    const drawn = new Uint8Array(nb), r = new Float32Array(nb), hh = new Float32Array(nb), up = new Float32Array(nb * 3);
    for (let bi = 0; bi < nb; bi++) {
      if (n[bi] < 6) continue;
      const b = beams[bi], ex = rest[b.b * 3] - rest[b.a * 3], ey = rest[b.b * 3 + 1] - rest[b.a * 3 + 1], ez = rest[b.b * 3 + 2] - rest[b.a * 3 + 2], L = Math.hypot(ex, ey, ez) || 1e-9;
      const u = [ex / L, ey / L, ez / L], o = bi * 6, k = 1 / n[bi];
      const C = [cov[o] * k, cov[o + 3] * k, cov[o + 4] * k, cov[o + 3] * k, cov[o + 1] * k, cov[o + 5] * k, cov[o + 4] * k, cov[o + 5] * k, cov[o + 2] * k];
      // the section's first axis: the power iteration on C from the axis least along the member
      let a = Math.abs(u[0]) < 0.6 ? [1, 0, 0] : Math.abs(u[1]) < 0.6 ? [0, 1, 0] : [0, 0, 1];
      for (let it = 0; it < 24; it++) { const x = [C[0] * a[0] + C[1] * a[1] + C[2] * a[2], C[3] * a[0] + C[4] * a[1] + C[5] * a[2], C[6] * a[0] + C[7] * a[1] + C[8] * a[2]];
        const d = x[0] * u[0] + x[1] * u[1] + x[2] * u[2]; x[0] -= d * u[0]; x[1] -= d * u[1]; x[2] -= d * u[2];
        const l = Math.hypot(x[0], x[1], x[2]); if (!(l > 1e-12)) break; a = [x[0] / l, x[1] / l, x[2] / l]; }
      { const d = a[0] * u[0] + a[1] * u[1] + a[2] * u[2]; a = [a[0] - d * u[0], a[1] - d * u[1], a[2] - d * u[2]]; const l = Math.hypot(a[0], a[1], a[2]) || 1; a = [a[0] / l, a[1] / l, a[2] / l]; }
      const c = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
      const va = a[0] * (C[0] * a[0] + C[1] * a[1] + C[2] * a[2]) + a[1] * (C[3] * a[0] + C[4] * a[1] + C[5] * a[2]) + a[2] * (C[6] * a[0] + C[7] * a[1] + C[8] * a[2]);
      const vc = c[0] * (C[0] * c[0] + C[1] * c[1] + C[2] * c[2]) + c[1] * (C[3] * c[0] + C[4] * c[1] + C[5] * c[2]) + c[2] * (C[6] * c[0] + C[7] * c[1] + C[8] * c[2]);
      // (the radius: the MEDIAN of the places' distances off the line - a joint's knuckle or a fitting bound to the member
      // pulls a mean up 3-4 x: the first stills, 27 Oct, drew the Cub's cage as bars; capped at R_MAX)
      const Ld = rd.get(bi).sort((x, y) => x - y), med = Ld[Ld.length >> 1];
      drawn[bi] = 1; r[bi] = Math.min(med, R_MAX);
      // (a box section's places sit on its faces: the rms off-axis along a face's normal is ~0.8 of the half-depth)
      hh[bi] = Math.sqrt(Math.max(va, 0)) * 1.2; up[bi * 3] = a[0]; up[bi * 3 + 1] = a[1]; up[bi * 3 + 2] = a[2];
      r[bi] = Math.max(r[bi], 1e-3); if (MAT[b.mat] === 3) r[bi] = Math.min(Math.sqrt(Math.max(vc, 0)) * 1.2, med, H_MAX);
      hh[bi] = Math.max(Math.min(hh[bi], med * 1.5, H_MAX), 1e-3);
    }
    return { drawn, r, hh, up, col };
  }

  // ---- THE PLAN, at a break event (or a bend's move): pure. D: the page's damage state (sim_view.js: br, broken, pc,
  // how, bend, set); M: measure()'s, or null (the binding not done: the parting rule alone, no slot); prev: the last plan.
  // Returns { v, part (Float32Array nb: the station, -1 unparted, NaN none), hide (Uint8Array nb), slots: [{ bi, mode,
  // kt1, tb, dk, axis }], nodes (Int32Array: the ends of the members whose station or slot moved since prev) }
  let _v = 0;
  function plan(T, D, M, rest, prev) {
    const nb = T.nb, beams = T.beams, part = new Float32Array(nb).fill(NaN), hide = new Uint8Array(nb), cand = [];
    const how = D.how, pc = D.pc, bend = D.bend, set = D.set;
    const matOf = b => MAT[b.mat] || 0;
    const axisOf = (bi, bd) => {          // the bend's axis in the frame's coordinates: the push's horizontal direction (a
      const b = beams[bi];                 // trunk's), else the section's first axis (a buckle has none: a side, seeded)
      const ex = rest[b.b * 3] - rest[b.a * 3], ey = rest[b.b * 3 + 1] - rest[b.a * 3 + 1], ez = rest[b.b * 3 + 2] - rest[b.a * 3 + 2], L = Math.hypot(ex, ey, ez) || 1e-9;
      const u = [ex / L, ey / L, ez / L];
      let a = bd ? [bd.nx, 0, bd.nz] : M ? [M.up[bi * 3], M.up[bi * 3 + 1], M.up[bi * 3 + 2]] : [0, 1, 0];
      if (!bd && h1(bi, 7) < 0.5) a = [-a[0], -a[1], -a[2]];
      const d = a[0] * u[0] + a[1] * u[1] + a[2] * u[2]; a = [a[0] - d * u[0], a[1] - d * u[1], a[2] - d * u[2]];
      let l = Math.hypot(a[0], a[1], a[2]);
      if (!(l > 1e-6)) { a = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const e = a[0] * u[0] + a[1] * u[1] + a[2] * u[2]; a = [a[0] - e * u[0], a[1] - e * u[1], a[2] - e * u[2]]; l = Math.hypot(a[0], a[1], a[2]); }
      return [a[0] / l, a[1] / l, a[2] / l]; };
    // the broken members: the parting rule, and a slot for the ones whose look is the material's
    for (const bi of D.br) {
      const b = beams[bi]; if (!b || b.cls === 'wire') continue;
      const c = how ? how[bi] : 0, mt = matOf(b), one = !pc || pc[b.a] === pc[b.b], bd = bend ? bend.get(bi) : null;
      if (!c) continue;
      if (RELEASE(c)) { part[bi] = one ? -1 : (pc[b.a] < pc[b.b] ? 0 : 1); continue; }   // whole, with the part that came off
      if (c === 2 && one) { part[bi] = -1;                                                  // a kink: one piece
        if (mt) { const kt = seeded(bi, 0.35, 0.65); cand.push({ bi, mode: mt === 3 ? MODE.crush : MODE.kink, kt1: kt, tb: kt, dk: 0, axis: axisOf(bi, null), score: 2 }); } continue; }
      const tb = c === 3 ? (bd ? bd.kt1 : 0.5) : c === 2 ? seeded(bi, 0.35, 0.65) : seeded(bi, 0.3, 0.7);
      part[bi] = tb;
      if (mt) cand.push({ bi, mode: mt === 3 ? MODE.sliver : MODE.torn, kt1: tb, tb, dk: bd ? bd.dk : 0, axis: axisOf(bi, bd), score: 3 });
    }
    // the bent members still whole: a trunk's bend (both tubes and wood: wood hangs greenstick), a buckle's set (tubes)
    for (let bi = 0; bi < nb; bi++) {
      if (D.broken[bi]) continue;
      const b = beams[bi], mt = matOf(b); if (!mt || b.cls === 'wire') continue;
      const bd = bend ? bend.get(bi) : null, st = set ? set[bi] : 0;
      if (bd && bd.dk > BEND_MIN) cand.push({ bi, mode: mt === 3 ? MODE.green : MODE.whole, kt1: bd.kt1, tb: bd.kt1, dk: bd.dk, axis: axisOf(bi, bd), score: 1 + bd.dk });
      else if (mt !== 3 && st < -SET_MIN) cand.push({ bi, mode: MODE.whole, kt1: seeded(bi, 0.35, 0.65), tb: 0.5, dk: 0, axis: axisOf(bi, null), score: 1 - st });
    }
    // the slots: drawn members only (the pool replaces a drawing - it never draws a member the snapshot did not), the
    // largest changes first, at most SLOTS; the order kept from the last plan where it can (a slot moves no member)
    const slots = [];
    if (M) {
      const ok = cand.filter(s => M.drawn[s.bi]).sort((a, b) => b.score - a.score || a.bi - b.bi).slice(0, SLOTS);
      const at = new Map(ok.map(s => [s.bi, s]));
      if (prev && prev.slots) for (const s of prev.slots) { const q = at.get(s.bi); if (q) { slots.push(q); at.delete(s.bi); } }
      for (const s of ok) if (at.has(s.bi)) slots.push(s);
      for (const s of slots) hide[s.bi] = 1;
    }
    // what moved since prev: the ends of those members (the records' local events re-test their places)
    const nodes = [];
    for (let bi = 0; bi < nb; bi++) {
      const p0 = prev ? prev.part[bi] : NaN, h0 = prev ? prev.hide[bi] : 0, p1 = part[bi];
      if (!((p0 === p1) || (p0 !== p0 && p1 !== p1)) || h0 !== hide[bi]) nodes.push(beams[bi].a, beams[bi].b);
    }
    return { v: ++_v, part, hide, slots, nodes: Int32Array.from(nodes) };
  }

  // ---- THE POSE: one vertex of a slot (the vertex shader, line for line). S: the slot's 8 texels (Float32Array 32);
  // u in [0, 1] along its piece, k round it, piece 0 (end a's) or 1 (end b's). Returns [x, y, z, nx, ny, nz, bare, raw,
  // s] - the place less the pool's origin, the normal, the bare-metal and raw-wood amounts (the fragment's colour), the
  // vertex's distance along its leg or its station (m / fraction: the gate's checks) ----
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function qrot(q, v) { const tx = 2 * (q[1] * v[2] - q[2] * v[1]), ty = 2 * (q[2] * v[0] - q[0] * v[2]), tz = 2 * (q[0] * v[1] - q[1] * v[0]);
    return [v[0] + q[3] * tx + (q[1] * tz - q[2] * ty), v[1] + q[3] * ty + (q[2] * tx - q[0] * tz), v[2] + q[3] * tz + (q[0] * ty - q[1] * tx)]; }
  const V = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: a => Math.hypot(a[0], a[1], a[2]),
    nrm: a => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; },
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] };
  // u -> the piece's own fraction, dense at the hinge / break end (piece 0's u = 1, piece 1's u = 0)
  const dense1 = u => 0.5 * u + 0.5 * (1 - (1 - u) * (1 - u));
  const dense0 = u => 0.5 * u + 0.5 * u * u;
  // the section's point k (x along N, y along B) and its normal's, at radius r (tube) or half-depths (r, hh) (wood)
  const SQ = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  function secPt(k, wood, r, hh) {
    if (wood) { const q = SQ[k % 8]; return [q[0] * hh, q[1] * r, q[0], q[1]]; }
    const th = k / AROUND * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th); return [c * r, s * r, c, s];
  }
  function pose(S, u, k, piece) {
    const A = [S[0], S[1], S[2]], mat = S[3], B = [S[4], S[5], S[6]];
    let mode = S[7];
    const qA = [S[8], S[9], S[10], S[11]], qB = [S[12], S[13], S[14], S[15]];
    const dR = [S[16], S[17], S[18]], L0 = S[19], bR = [S[20], S[21], S[22]], kt1 = S[23];
    const r = S[24], hh = S[25], seed = S[26] | 0, tb = S[27], dk = S[31];
    if (!(mat > 0.5)) return [0, 0, 0, 0, 1, 0, 0, 0];
    const wood = mat > 2.5, steel = mat < 1.5;
    const cB = B[0] - A[0], cBy = B[1] - A[1], cBz = B[2] - A[2], c = Math.hypot(cB, cBy, cBz);
    if (mode === MODE.kink && c > KINK_STRETCH * L0) mode = MODE.torn;
    if (mode === MODE.crush && c > KINK_STRETCH * L0) mode = MODE.sliver;
    let p, T, Nn, s, bare = 0, raw = 0, nk = 1, ov = 0, cr = 0, endE = 1e9;
    const sp = secPt(k, wood, r, hh);
    if (mode === MODE.torn || mode === MODE.sliver) {
      // A STUB: rigid on its own end (that node's turn), along its leg (the rest direction turned toward the bend's axis
      // by the leg's angle over the bend's depth), to its torn end - or its slivers' tips
      const own = piece === 0 ? A : B, q = piece === 0 ? qA : qB, sg = piece === 0 ? 1 : -1;
      const legL = piece === 0 ? tb * L0 : (1 - tb) * L0, al = dk > 0 && legL > 1e-6 ? Math.atan(dk / legL) : 0;
      const dirR = V.nrm(V.add(V.mul(dR, sg * Math.cos(al)), V.mul(bR, Math.sin(al))));
      T = V.nrm(qrot(q, dirR)); let ax = qrot(q, bR); ax = V.nrm(V.sub(ax, V.mul(T, V.dot(ax, T))));
      Nn = ax;
      let reach, end;
      if (wood) {                          // the slivers: each strip its own length past the break, some short
        const depth = 2 * Math.max(r, hh), ext = depth * (3 + 3 * h1(k + piece * 31, seed)) * (h1(k * 7 + piece * 5, seed + 1) < 0.35 ? 0.25 : 1);
        reach = legL + 6 * depth; end = legL + ext;
        const x = Math.min(dense1(u) * reach, end); s = x;
        endE = end - x; nk = 0.3 + 0.7 * sm(0, 0.45 * ext, endE);
        raw = x > legL - 0.5 * depth ? 1 : 0;
      } else {                             // the torn end: necked, jagged round the tube, bare at the tear
        const lip = 0.9 * r, jag = (h1(k, seed + piece * 77) * 2 - 1) * 0.9 * r;
        reach = legL + lip; end = Math.min(reach, reach + jag);
        const x0 = dense1(u) * reach, x = Math.min(x0, end); s = x;
        endE = Math.abs(reach - x0); nk = 1 - 0.4 * (1 - sm(0, 1.5 * r, endE));
        bare = endE < 0.6 * r ? 1 : endE < 1.6 * r && !steel ? 0.5 : 0;   // (an alloy tube: the bare rim, then the primer band)
      }
      p = V.add(own, V.mul(T, s));
    } else {
      // WHOLE: the two live ends; bent, two legs keeping their rest length meet at the hinge (a rounded crease)
      const uu = c > 1e-6 ? [cB / c, cBy / c, cBz / c] : [1, 0, 0];
      const qm = V.dot(qA, qB) < 0 ? [qA[0] - qB[0], qA[1] - qB[1], qA[2] - qB[2], qA[3] - qB[3]] : [qA[0] + qB[0], qA[1] + qB[1], qA[2] + qB[2], qA[3] + qB[3]];
      { const l = Math.hypot(qm[0], qm[1], qm[2], qm[3]) || 1; qm[0] /= l; qm[1] /= l; qm[2] /= l; qm[3] /= l; }
      let bd = qrot(qm, bR); bd = V.sub(bd, V.mul(uu, V.dot(bd, uu))); { const l = V.len(bd); bd = l > 1e-5 ? V.mul(bd, 1 / l) : V.nrm(V.cross(uu, Math.abs(uu[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); }
      const hk = mode === MODE.crush ? tb : kt1, a = hk * L0, b = (1 - hk) * L0;
      s = piece === 0 ? hk * dense1(u) : hk + (1 - hk) * dense0(u);
      const qS = s * L0;
      if (mode === MODE.crush || !(c < L0 * 0.9995)) { p = V.add(A, V.mul(uu, s * c)); T = uu; Nn = bd; }
      else {
        const x = (a * a - b * b + c * c) / (2 * c), h = Math.sqrt(Math.max(a * a - x * x, 0));
        const H = V.add(V.add(A, V.mul(uu, x)), V.mul(bd, h)), d1 = V.nrm(V.sub(H, A)), d2 = V.nrm(V.sub(B, H));
        const rc = Math.min(mode === MODE.green ? 0.3 * hh : 2 * r, 0.45 * Math.min(a, b));
        if (qS <= a - rc) { p = V.add(A, V.mul(d1, qS)); T = d1; }
        else if (qS >= a + rc) { p = V.add(H, V.mul(d2, qS - a)); T = d2; }
        else { const w = (qS - (a - rc)) / (2 * rc), P1 = V.sub(H, V.mul(d1, rc)), P2 = V.add(H, V.mul(d2, rc));
          p = V.add(V.add(V.mul(P1, (1 - w) * (1 - w)), V.mul(H, 2 * w * (1 - w))), V.mul(P2, w * w));
          T = V.nrm(V.add(V.mul(V.sub(H, P1), 2 * (1 - w)), V.mul(V.sub(P2, H), 2 * w))); }
        Nn = V.nrm(V.sub(bd, V.mul(T, V.dot(bd, T))));
        const ang = Math.acos(Math.max(-1, Math.min(1, V.dot(d1, d2))));
        if (!wood) ov = Math.min(1, ang / 1.2) * Math.exp(-Math.pow((qS - a) / (1.8 * r), 2));
        else if (mode === MODE.green) raw = sp[2] > 0.5 ? Math.exp(-Math.pow((qS - a) / (1.5 * hh), 2)) : 0;
      }
      if (mode === MODE.crush) {           // the kink band, inclined across the depth
        const z = qS - tb * L0, band = 1.4 * hh, y = sp[0], kb = sm(-band / 2 + y * 0.8, band / 2 + y * 0.8, z);
        cr = 0.35 * hh * Math.sin(Math.PI * kb); raw = kb > 0.05 && kb < 0.95 ? 0.6 : 0;
      }
    }
    const Bv = V.cross(T, Nn);
    // the ring: ovalised in the bend plane, the crease's inside (the concave side) pushed in
    let x = sp[0], y = sp[1];
    if (!wood) { const cn = sp[2], dent = ov > 0 && cn < -0.6 ? 1 - 0.25 * ov * (-cn - 0.6) / 0.4 : 1;
      x = r * nk * (1 - 0.38 * ov) * cn * dent; y = r * nk * (1 + 0.2 * ov) * sp[3]; }
    else { x *= nk; y *= nk; }
    const P = V.add(V.add(V.add(p, V.mul(Nn, x + cr)), V.mul(Bv, y)), [0, 0, 0]);
    const nn = V.nrm(V.add(V.mul(Nn, sp[2]), V.mul(Bv, sp[3])));
    return [P[0], P[1], P[2], nn[0], nn[1], nn[2], bare, raw, s];
  }

  // THE SAME IN GLSL (MeshStandardMaterial's vertex shader, onBeforeCompile: begin_vertex / beginnormal_vertex)
  const LOOK_GLSL = [
    'uniform highp sampler2D uLook;',
    'varying float vBare; varying float vRaw; varying vec3 vPaint; varying float vMat;',
    'vec4 lkT(int s, int j) { return texelFetch(uLook, ivec2(s * ' + TX + ' + j, 0), 0); }',
    'vec3 lkQ(vec4 q, vec3 v) { vec3 t = 2.0 * cross(q.xyz, v); return v + q.w * t + cross(q.xyz, t); }',
    'float lkH(int k, int seed) { uint h = uint(k) * 374761393u + uint(seed) * 668265263u; h = (h ^ (h >> 13u)) * 1274126177u; h = h ^ (h >> 16u); return float(h) / 4294967296.0; }',
    'float lkS(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }',
    'float lkD1(float u) { return 0.5 * u + 0.5 * (1.0 - (1.0 - u) * (1.0 - u)); }',
    'float lkD0(float u) { return 0.5 * u + 0.5 * u * u; }',
    'vec4 lkSec(int k, bool wood, float r, float hh) {',
    '  if (wood) { int j = k - 8 * (k / 8); vec2 q = j == 0 ? vec2(1.0, 0.0) : j == 1 ? vec2(1.0, 1.0) : j == 2 ? vec2(0.0, 1.0) : j == 3 ? vec2(-1.0, 1.0) :',
    '    j == 4 ? vec2(-1.0, 0.0) : j == 5 ? vec2(-1.0, -1.0) : j == 6 ? vec2(0.0, -1.0) : vec2(1.0, -1.0); return vec4(q.x * hh, q.y * r, q.x, q.y); }',
    '  float th = float(k) / ' + AROUND + '.0 * 6.283185307179586; float c = cos(th), s = sin(th); return vec4(c * r, s * r, c, s); }',
    'void lkPose(out vec3 Pp, out vec3 Pn) {',
    '  int sid = int(position.z + 0.5) / 2; int piece = int(position.z + 0.5) - 2 * sid; float u = position.x; int k = int(position.y + 0.5);',
    '  vec4 T0 = lkT(sid, 0), T1 = lkT(sid, 1), qA = lkT(sid, 2), qB = lkT(sid, 3), T4 = lkT(sid, 4), T5 = lkT(sid, 5), T6 = lkT(sid, 6), T7 = lkT(sid, 7);',
    '  float mat = T0.w; float mode = T1.w; vBare = 0.0; vRaw = 0.0; vPaint = T7.rgb; vMat = mat;',
    '  if (mat < 0.5) { Pp = vec3(0.0); Pn = vec3(0.0, 1.0, 0.0); return; }',
    '  vec3 A = T0.xyz, B = T1.xyz, dR = T4.xyz, bR = T5.xyz; float L0 = T4.w, kt1 = T5.w, r = T6.x, hh = T6.y, tb = T6.w, dk = T7.w; int seed = int(T6.z + 0.5);',
    '  bool wood = mat > 2.5, steel = mat < 1.5;',
    '  vec3 cv = B - A; float c = length(cv);',
    '  if (mode > 1.5 && mode < 2.5 && c > ' + KINK_STRETCH.toFixed(2) + ' * L0) mode = 1.0;',
    '  if (mode > 4.5 && c > ' + KINK_STRETCH.toFixed(2) + ' * L0) mode = 3.0;',
    '  vec3 p, T, Nn; float s, nk = 1.0, ov = 0.0, cr = 0.0;',
    '  vec4 sp = lkSec(k, wood, r, hh);',
    '  if ((mode > 0.5 && mode < 1.5) || (mode > 2.5 && mode < 3.5)) {',
    '    vec3 own = piece == 0 ? A : B; vec4 q = piece == 0 ? qA : qB; float sg = piece == 0 ? 1.0 : -1.0;',
    '    float legL = piece == 0 ? tb * L0 : (1.0 - tb) * L0; float al = dk > 0.0 && legL > 1e-6 ? atan(dk / legL) : 0.0;',
    '    vec3 dirR = normalize(dR * sg * cos(al) + bR * sin(al));',
    '    T = normalize(lkQ(q, dirR)); vec3 ax = lkQ(q, bR); Nn = normalize(ax - T * dot(ax, T));',
    '    if (wood) {',
    '      float depth = 2.0 * max(r, hh); float ext = depth * (3.0 + 3.0 * lkH(k + piece * 31, seed)) * (lkH(k * 7 + piece * 5, seed + 1) < 0.35 ? 0.25 : 1.0);',
    '      float reach = legL + 6.0 * depth, ed = legL + ext; float x = min(lkD1(u) * reach, ed); s = x;',
    '      float e = ed - x; nk = 0.3 + 0.7 * lkS(0.0, 0.45 * ext, e); vRaw = x > legL - 0.5 * depth ? 1.0 : 0.0;',
    '    } else {',
    '      float lip = 0.9 * r, jag = (lkH(k, seed + piece * 77) * 2.0 - 1.0) * 0.9 * r; float reach = legL + lip, ed = min(reach, reach + jag);',
    '      float x0 = lkD1(u) * reach, x = min(x0, ed); s = x; float e = abs(reach - x0); nk = 1.0 - 0.4 * (1.0 - lkS(0.0, 1.5 * r, e));',
    '      vBare = e < 0.6 * r ? 1.0 : (e < 1.6 * r && !steel ? 0.5 : 0.0);',
    '    }',
    '    p = own + T * s;',
    '  } else {',
    '    vec3 uu = c > 1e-6 ? cv / c : vec3(1.0, 0.0, 0.0);',
    '    vec4 qm = dot(qA, qB) < 0.0 ? qA - qB : qA + qB; qm = normalize(qm);',
    '    vec3 bd = lkQ(qm, bR); bd -= uu * dot(bd, uu); float bl = length(bd); bd = bl > 1e-5 ? bd / bl : normalize(cross(uu, abs(uu.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));',
    '    float hk = mode > 4.5 ? tb : kt1; float a = hk * L0, b = (1.0 - hk) * L0;',
    '    s = piece == 0 ? hk * lkD1(u) : hk + (1.0 - hk) * lkD0(u); float qS = s * L0;',
    '    if (mode > 4.5 || !(c < L0 * 0.9995)) { p = A + uu * (s * c); T = uu; Nn = bd; }',
    '    else {',
    '      float x = (a * a - b * b + c * c) / (2.0 * c), h = sqrt(max(a * a - x * x, 0.0));',
    '      vec3 H = A + uu * x + bd * h, d1 = normalize(H - A), d2 = normalize(B - H);',
    '      float rc = min(mode > 3.5 ? 0.3 * hh : 2.0 * r, 0.45 * min(a, b));',
    '      if (qS <= a - rc) { p = A + d1 * qS; T = d1; }',
    '      else if (qS >= a + rc) { p = H + d2 * (qS - a); T = d2; }',
    '      else { float w = (qS - (a - rc)) / (2.0 * rc); vec3 P1 = H - d1 * rc, P2 = H + d2 * rc;',
    '        p = P1 * ((1.0 - w) * (1.0 - w)) + H * (2.0 * w * (1.0 - w)) + P2 * (w * w); T = normalize((H - P1) * (2.0 * (1.0 - w)) + (P2 - H) * (2.0 * w)); }',
    '      Nn = normalize(bd - T * dot(bd, T));',
    '      float ang = acos(clamp(dot(d1, d2), -1.0, 1.0));',
    '      if (!wood) ov = min(1.0, ang / 1.2) * exp(-pow((qS - a) / (1.8 * r), 2.0));',
    '      else if (mode > 3.5) vRaw = sp.z > 0.5 ? exp(-pow((qS - a) / (1.5 * hh), 2.0)) : 0.0;',
    '    }',
    '    if (mode > 4.5) { float z = qS - tb * L0, band = 1.4 * hh, y = sp.x, kb = lkS(-band / 2.0 + y * 0.8, band / 2.0 + y * 0.8, z);',
    '      cr = 0.35 * hh * sin(3.141592653589793 * kb); vRaw = kb > 0.05 && kb < 0.95 ? 0.6 : 0.0; }',
    '  }',
    '  vec3 Bv = cross(T, Nn); float x = sp.x, y = sp.y;',
    '  if (!wood) { float cn = sp.z; float dent = ov > 0.0 && cn < -0.6 ? 1.0 - 0.25 * ov * (-cn - 0.6) / 0.4 : 1.0;',
    '    x = r * nk * (1.0 - 0.38 * ov) * cn * dent; y = r * nk * (1.0 + 0.2 * ov) * sp.w; }',
    '  else { x *= nk; y *= nk; }',
    '  Pp = p + Nn * (x + cr) + Bv * y; Pn = normalize(Nn * sp.z + Bv * sp.w);',
    '}'].join('\n');
  const LOOK_FRAG = [
    'varying float vBare; varying float vRaw; varying vec3 vPaint; varying float vMat;'].join('\n');
  // the fragment's colour: the paint; the bare metal at a tear (steel's, or an alloy tube's bare rim then its grey primer
  // band - vBare 1 / 0.5), raw wood at a fracture
  const LOOK_COLOUR = [
    'vec3 lkC = vPaint;',
    'if (vMat < 2.5) { vec3 bareC = vMat < 1.5 ? vec3(' + COL.steel.join(', ') + ') : (vBare > 0.75 ? vec3(' + COL.alloy.join(', ') + ') : vec3(' + COL.primer.join(', ') + '));',
    '  lkC = mix(lkC, bareC, clamp(vBare * 2.0, 0.0, 1.0)); }',
    'else lkC = mix(lkC, vec3(' + COL.raw.join(', ') + '), clamp(vRaw, 0.0, 1.0));',
    'vec4 diffuseColor = vec4(lkC, opacity);'].join('\n');

  // ---- THE POOL (the page's): made once a page, PARKED (hidden; its program linked with the world's at roll-out) ----
  function make(THREE) {
    const nPer = RINGS * AROUND, nV = SLOTS * 2 * nPer;
    const pos = new Float32Array(nV * 3), idx = new Uint32Array(SLOTS * 2 * (RINGS - 1) * AROUND * 6);
    let w = 0, t = 0;
    for (let sl = 0; sl < SLOTS; sl++) for (let pc = 0; pc < 2; pc++) {
      const base = (sl * 2 + pc) * nPer;
      for (let i = 0; i < RINGS; i++) for (let k = 0; k < AROUND; k++) { pos[w++] = i / (RINGS - 1); pos[w++] = k; pos[w++] = sl * 2 + pc; }
      for (let i = 0; i + 1 < RINGS; i++) for (let k = 0; k < AROUND; k++) {
        const k2 = (k + 1) % AROUND, a = base + i * AROUND + k, b = base + i * AROUND + k2, c = base + (i + 1) * AROUND + k2, d = base + (i + 1) * AROUND + k;
        idx[t++] = a; idx[t++] = b; idx[t++] = c; idx[t++] = a; idx[t++] = c; idx[t++] = d; }   // (outward: k turns from N to B = T x N)
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0); g.name = 'dmglook:pool';
    const data = new Float32Array(SLOTS * TX * 4);
    const tex = new THREE.DataTexture(data, SLOTS * TX, 1, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true; tex.name = 'dmglook:slots';
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide });
    m.name = 'dmglook:pool';
    m.onBeforeCompile = sh => {
      sh.uniforms.uLook = { value: tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + LOOK_GLSL)
        .replace('#include <beginnormal_vertex>', 'vec3 lkP, lkN; lkPose(lkP, lkN);\nvec3 objectNormal = lkN;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif')
        .replace('#include <begin_vertex>', 'vec3 transformed = lkP;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LOOK_FRAG)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', LOOK_COLOUR);
    };
    m.customProgramCacheKey = () => 'dmglook:pool:1';
    const mesh = new THREE.Mesh(g, m);
    mesh.name = 'dmglook:pool'; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.look = { tex, data, used: 0, slots: [], frames: 0, ms: 0, msMax: 0, events: 0 };
    return mesh;
  }
  // AT AN EVENT: the plan's slots into the texture (the static texels 4-7) and the draw range. rest: the frame's
  // coordinates; M: measure()'s. The mesh shows while any slot is used
  function assign(mesh, P, M, T, rest) {
    const U = mesh.userData.look, d = U.data, beams = T.beams;
    d.fill(0);
    const n = Math.min(SLOTS, P.slots.length);
    for (let j = 0; j < n; j++) {
      const s = P.slots[j], b = beams[s.bi], o = j * TX * 4;
      const ex = rest[b.b * 3] - rest[b.a * 3], ey = rest[b.b * 3 + 1] - rest[b.a * 3 + 1], ez = rest[b.b * 3 + 2] - rest[b.a * 3 + 2], L = Math.hypot(ex, ey, ez) || 1e-9;
      d[o + 3] = MAT[b.mat] || 0; d[o + 7] = s.mode;
      d[o + 16] = ex / L; d[o + 17] = ey / L; d[o + 18] = ez / L; d[o + 19] = L;
      d[o + 20] = s.axis[0]; d[o + 21] = s.axis[1]; d[o + 22] = s.axis[2]; d[o + 23] = s.kt1;
      d[o + 24] = M.r[s.bi]; d[o + 25] = M.hh[s.bi]; d[o + 26] = (s.bi * 2654435761 >>> 8) & 0xffff; d[o + 27] = s.tb;
      const ci = s.bi * 3, has = M.col[ci] >= 0;
      d[o + 28] = has ? M.col[ci] : 0.5; d[o + 29] = has ? M.col[ci + 1] : 0.5; d[o + 30] = has ? M.col[ci + 2] : 0.5; d[o + 31] = s.dk;
      d[o + 11] = 1; d[o + 15] = 1;                       // (the turns: identity until the first posed frame)
    }
    U.used = n; U.slots = P.slots.slice(0, n); U.beams = beams; U.events++;
    mesh.geometry.setDrawRange(0, n * 2 * (RINGS - 1) * AROUND * 6);
    mesh.visible = n > 0; U.tex.needsUpdate = true;
    return n;
  }
  // EACH POSED FRAME: the used slots' nodes (live, less the origin O - the pool's own position) and their turns (NF.q:
  // skin_break.js nodeFrames, rest -> live, x y z w)
  function frame(mesh, live, Q, O) {
    const U = mesh.userData.look; if (!U.used) return 0;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0, d = U.data;
    for (let j = 0; j < U.used; j++) { const s = U.slots[j], o = j * TX * 4;
      const bm = U.beams[s.bi], ia = bm.a * 3, ib = bm.b * 3, qa = bm.a * 4, qb = bm.b * 4;
      d[o] = live[ia] - O[0]; d[o + 1] = live[ia + 1] - O[1]; d[o + 2] = live[ia + 2] - O[2];
      d[o + 4] = live[ib] - O[0]; d[o + 5] = live[ib + 1] - O[1]; d[o + 6] = live[ib + 2] - O[2];
      if (Q) { d[o + 8] = Q[qa]; d[o + 9] = Q[qa + 1]; d[o + 10] = Q[qa + 2]; d[o + 11] = Q[qa + 3];
        d[o + 12] = Q[qb]; d[o + 13] = Q[qb + 1]; d[o + 14] = Q[qb + 2]; d[o + 15] = Q[qb + 3]; } }
    mesh.position.set(O[0], O[1], O[2]); mesh.updateMatrix(); mesh.matrixWorldNeedsUpdate = true;
    U.tex.needsUpdate = true; U.frames++;
    if (t0) { const ms = performance.now() - t0; U.ms += ms; if (ms > U.msMax) U.msMax = ms; }
    return U.used;
  }
  // a heal (a reset, a new flight): nothing drawn
  function clear(mesh) { const U = mesh.userData.look; if (!U.used && !mesh.visible) return; U.used = 0; U.slots = []; mesh.visible = false; mesh.geometry.setDrawRange(0, 0); }
  // the slot's 8 texels as pose() reads them (the gate's mirror)
  const slotTexels = (mesh, j) => mesh.userData.look.data.subarray(j * TX * 4, (j + 1) * TX * 4);

  const API = { SLOTS, RINGS, AROUND, TX, MAT, MODE, COL, BEND_MIN, SET_MIN, KINK_STRETCH, h1, measure, plan, pose, make, assign, frame, clear, slotTexels, LOOK_GLSL, LOOK_FRAG, LOOK_COLOUR };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_MEMBERS = API;
})();
