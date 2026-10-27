// G3770-G3773 (DMG-LOOKS, ?dmglook=1 - OFF by default): THE STRUCTURE BY MATERIAL. The user, 25 Oct: "the tubular cage,
// the wooden pillars, the metal frames ... the metal should bend, wood should break like wood" - and "beware of
// performance". The study (futureDesigns/DMG-LOOKS-STUDY-2026-10.md section 10, brief 2) measured why the wreck cannot
// show it today: every broken member is drawn split at exactly half its length, its ends flat; and the drawn member has
// no vertex where a bend or a tear would go - a cage tube (tools/_cage_gen.js tubeSeg) is a six-sided prism with its
// vertices at its two ends only (a bent run, tubePath: rings at its polyline points only).
// THE USER, 27 Oct, on the first stills ("I'm a little worried by that replacement, why can't we start from the actual
// tube mesh?"): so the member drawn here IS the tube's own mesh, RE-RINGED - its own section (its six hex corners, or
// the sweep's eight, as the snapshot drew them, at the radius the generator drew: no estimate), its own material (a clone
// of its bucket's, the same map and colour, each vertex the uv of its own real place), with rings added only along its
// length. Its own triangles collapse in the snapshot (the event's index, as a break's). Giving the snapshot itself those
// vertices would rebuild its baked, merged buffers at the crash frame - that is the one reason it is drawn from here.
// Two pieces, both drawn only once something is broken:
//   1. THE PLAN (plan(), at a break event - pure, node-tested by GATE DMGLOOK): for each broken frame member, where its
//      drawn places part (skin_break.js's parting rule: R.look.part) - a member released at a fitting or by a cluster's
//      cut goes WHOLE with the part that came off; a kink on one piece is UNPARTED (the solver's floor holds its crushed
//      length: one piece); a fold parts at its hinge; a tension, ragged or core break at a seeded station - and which
//      members are drawn here instead of in the snapshot (R.look.hide).
//   2. THE POOLS (make(), one a tube bucket's material, parked with the world at roll-out - ground_scar.js's rule: its
//      program links with the world's, none in a crash): SLOTS x 2 pieces x RINGS x AROUND canonical vertices (position =
//      (u along its piece, k round it, slot x 2 + piece)), one RGBA float texture of TX texels a slot. At an event a slot
//      gets its member (the rest direction and length, the bend axis and hinge, its real section's corners, the break
//      station) and its vertices their uv (one range of the uv buffer); each POSED frame the CPU writes the two nodes'
//      live places and turns (16 floats a used slot) and the vertex shader poses every vertex (LOOK_GLSL; pose() is the
//      same in JS, the gate's mirror). No CPU a vertex, no program linked, no GL object made at a crash; one draw a
//      pool while a wreck exists, none before; no shadow cast.
// The looks (study 10.3; futureDesigns/dmg-looks/steel_cage.png, wood_members.png):
//   STEEL TUBE (tubeFabric) / ALLOY TUBE (aluTube)
//     bent, whole       two legs that keep their rest length, meeting at a short rounded crease at the hinge; the tube
//                       ovalised there and the crease's inside pushed in
//     kinked            folded, ONE piece
//     torn, ends together  the bent member CRACKED OPEN at its crease (the user: "I can see nothing bent, I can mostly
//                       see junction points" - torn members were drawn as stubs from their nodes): both legs, the lips
//                       necked, jagged, curled out, the dark bore showing
//     torn, parted      each stub on its own end, its leg's bend kept, the same torn end
//     the tear's rim    a narrow band of bare steel - an alloy tube's bare alloy then the GREY PRIMER band (25 Oct)
//   WOOD (spruce longerons, pillars, spar caps)
//     elastic           straight: never taken here
//     broken            splinters along the grain - each corner of its section its own length past the break, some short,
//                       tapered; a darker raw spruce at the fracture (never white: the user, 27 Oct)
//     bent, whole       GREENSTICK: hanging bent at a sharp crack, the tension face's raw wood showing
//     kinked            a CRUSH band across the depth, one piece
// The open tube's INSIDE (its back faces) is dark - lit as its outside it read white at every break (the user, 27 Oct).
// The alloy SECTIONS (the metal Cessna's formers: drawn on its inside wall, not as tubes) are the stretch's: not here.
// PURE apart from make() (THREE passed in): node loads it (module.exports); window.DMG_MEMBERS in the page.
(function () {
  'use strict';
  const SLOTS = 128;          // a pool's slots (every census run needed at most 98, study 10.3); past them a member keeps today's drawing
  const RINGS = 14;           // rings a piece (two pieces a slot): clustered at the hinge or the break
  const AROUND = 8;           // the most corners a section has (a sweep's eight; a hex tube's six; a beam's four)
  const TX = 12;              // texels a slot: 8 of state, 4 of the section's corners (8 x (x, y))
  const BEND_MIN = 0.015;     // m: a trunk bend drawn (= sim_host.js SIM_DMG_BEND_MIN)
  const SET_MIN = 0.01;       // a chord shortened past 1 % by its set: buckled (a tube; wood stays straight)
  const KINK_STRETCH = 1.05;  // a kinked member whose ends are pulled past 1.05 x its rest length is drawn torn
  // the materials taken here (30_solver's member `mat`, 60_gen_spec GEN_CRASH keys): 1 steel, 2 alloy tube, 3 wood
  const MAT = { tubeFabric: 1, aluTube: 2, wood: 3 };
  // the modes (texel 1's w): whole (0: bent or straight), torn (1), unparted kink (2), wood: splintered (3), greenstick
  // (4), crush (5). Torn and splintered draw CRACKED (both legs, bent) while the ends are within the rest length, as
  // stubs past it
  const MODE = { whole: 0, torn: 1, kink: 2, sliver: 3, green: 4, crush: 5 };
  // 30_solver.js howCode: 1 tension, 2 kink, 3 fold, 4 ragged, 5 group, 6 a cluster's cut, 7 core, 8 gate
  const RELEASE = c => c === 5 || c === 6 || c === 8;
  // the tear's colours: they REPLACE the material's at the rim (linear RGB) - bare steel a dark grey metal, bare alloy,
  // the grey primer, raw spruce (a mid tan: it read white at 0.93); the bore's darkening
  const COL = { steel: [0.30, 0.31, 0.33], alloy: [0.55, 0.57, 0.60], primer: [0.40, 0.41, 0.42], raw: [0.46, 0.33, 0.19], bore: 0.12 };
  const RIM = 0.3;            // the bare band, x r from the torn end
  const GAP = 0.35;           // a crack's opening at the crease, x r each side

  // a seeded hash in [0, 1) - the shader's own (uint arithmetic: the same bits in JS and GLSL)
  function h1(k, seed) {
    let h = (Math.imul(k >>> 0, 374761393) + Math.imul(seed >>> 0, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }
  const seeded = (bi, lo, hi) => lo + (hi - lo) * h1(bi, 0x5eed);

  // ---- EACH MEMBER'S OWN DRAWN TUBE (once a binding: skin_break.js inhSteps' R.mem / R.mt) ----
  // recs: the cage's records (R.g.pos the places at rest, in the frame's coordinates; R.uv their uv; R.secName their
  // bucket); keys: the buckets drawn here (a pool each), or null for all. For each member drawn in one of them: its
  // section's CORNERS at its first end (each a 3D offset off the member's line, as the snapshot drew it: the hex's six,
  // the sweep's eight, a beam's four), each corner's uv at the drawn tube's two ends, the stations the drawn tube spans
  // (tA, tB), its radius (the corners' mean distance from their centre: the generator's own), its first axis (to corner 0)
  function measure(recs, T, rest, keys) {
    const nb = T.nb, beams = T.beams, at = new Map();
    for (const R of recs) { const M = R.mem; if (!M || (keys && !keys.has(R.secName))) continue; const rp = R.rep;
      for (let v = 0; v < R.nv; v++) { const bi = M[v]; if (bi < 0 || (rp && rp[v] !== v)) continue;
        let E = at.get(bi); if (!E) at.set(bi, E = { R, vs: [] }); if (E.R === R) E.vs.push(v); } }
    const drawn = new Uint8Array(nb), K = new Uint8Array(nb), off = new Float32Array(nb * AROUND * 3), uv = new Float32Array(nb * AROUND * 4);
    const r = new Float32Array(nb), tA = new Float32Array(nb), tB = new Float32Array(nb), up = new Float32Array(nb * 3), key = new Array(nb).fill(null);
    for (const [bi, E] of at) {
      const R = E.R, P = R.g.pos, U = R.uv, vs = E.vs; if (vs.length < 6) continue;
      const b = beams[bi], ax = rest[b.a * 3], ay = rest[b.a * 3 + 1], az = rest[b.a * 3 + 2];
      const ex = rest[b.b * 3] - ax, ey = rest[b.b * 3 + 1] - ay, ez = rest[b.b * 3 + 2] - az, L = Math.hypot(ex, ey, ez) || 1e-9;
      const u = [ex / L, ey / L, ez / L];
      const offOf = v => { const t = R.mt[v]; return [P[v * 3] - ax - t * ex, P[v * 3 + 1] - ay - t * ey, P[v * 3 + 2] - az - t * ez]; };
      let t0 = Infinity, t1 = -Infinity; for (const v of vs) { const t = R.mt[v]; if (t < t0) t0 = t; if (t > t1) t1 = t; }
      if (!(t1 - t0 > 0.05)) continue;
      const tol = Math.max(0.01 / L, 1e-3), ringA = vs.filter(v => R.mt[v] <= t0 + tol), ringB = vs.filter(v => R.mt[v] >= t1 - tol);
      if (ringA.length < 3 || ringB.length < 3) continue;
      // the ring's own frame: e1 any perpendicular, e2 = u x e1; corners by angle about the ring's centre
      let e1 = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      { const d = e1[0] * u[0] + e1[1] * u[1] + e1[2] * u[2]; e1 = [e1[0] - d * u[0], e1[1] - d * u[1], e1[2] - d * u[2]]; const l = Math.hypot(e1[0], e1[1], e1[2]); e1 = [e1[0] / l, e1[1] / l, e1[2] / l]; }
      const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
      const ring = list => { const o = list.map(offOf), c = [0, 0, 0]; for (const q of o) for (let j = 0; j < 3; j++) c[j] += q[j] / o.length;
        const C = list.map((v, i) => { const q = o[i], dx = q[0] - c[0], dy = q[1] - c[1], dz = q[2] - c[2];
          return { v, q, ang: Math.atan2(dx * e2[0] + dy * e2[1] + dz * e2[2], dx * e1[0] + dy * e1[1] + dz * e1[2]), rr: Math.hypot(dx, dy, dz) }; });
        C.sort((x, y) => x.ang - y.ang);
        const out = []; for (const q of C) if (!out.length || q.ang - out[out.length - 1].ang > 1e-3) out.push(q);
        return { c, C: out }; };
      const RA = ring(ringA), RB = ring(ringB);
      let CA = RA.C; if (CA.length > AROUND) { const s = []; for (let k = 0; k < AROUND; k++) s.push(CA[Math.floor(k * CA.length / AROUND)]); CA = s; }
      if (CA.length < 3) continue;
      const n = CA.length; K[bi] = n;
      let rs = 0; for (const q of CA) rs += q.rr; r[bi] = rs / n;
      for (let k = 0; k < n; k++) { const q = CA[k], o = (bi * AROUND + k) * 3; off[o] = q.q[0]; off[o + 1] = q.q[1]; off[o + 2] = q.q[2];
        // its uv at the first end, and at the far end the corner of the far ring nearest it in angle
        let best = RB.C[0], bd = Infinity; for (const w of RB.C) { let d = Math.abs(w.ang - q.ang); if (d > Math.PI) d = 2 * Math.PI - d; if (d < bd) { bd = d; best = w; } }
        const o4 = (bi * AROUND + k) * 4;
        if (U) { uv[o4] = U[q.v * 2]; uv[o4 + 1] = U[q.v * 2 + 1]; uv[o4 + 2] = U[best.v * 2]; uv[o4 + 3] = U[best.v * 2 + 1]; } }
      { const q = CA[0].q, c = RA.c, dx = q[0] - c[0], dy = q[1] - c[1], dz = q[2] - c[2], l = Math.hypot(dx, dy, dz) || 1; up[bi * 3] = dx / l; up[bi * 3 + 1] = dy / l; up[bi * 3 + 2] = dz / l; }
      tA[bi] = t0; tB[bi] = t1; key[bi] = R.secName || null; drawn[bi] = 1;
    }
    return { drawn, K, off, uv, r, tA, tB, up, key };
  }

  // ---- THE PLAN, at a break event: pure. D: the page's damage state (sim_view.js: br, broken, pc, how, bend, set); M:
  // measure()'s, or null (the binding not done: the parting rule alone, no slot); prev: the last plan. Returns { v, part
  // (Float32Array nb: the station, -1 unparted, NaN none), hide (Uint8Array nb), slots: [{ bi, mode, kt1, tb, dk, axis }],
  // nodes (Int32Array: the ends of the members whose station or slot moved since prev) }
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
    // the slots: drawn members only (it never draws a member the snapshot did not), the largest changes first, at most
    // SLOTS; the order kept from the last plan where it can (a slot moves no member)
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

  // ---- THE POSE: one vertex of a slot (the vertex shader, line for line). S: the slot's TX texels (Float32Array);
  // u in [0, 1] along its piece, k round it, piece 0 (end a's) or 1 (end b's). Returns [x, y, z, nx, ny, nz, bare, raw,
  // e, x0] - the place less the pool's origin, the normal, the bare-metal and raw-wood amounts (the colour), the distance
  // to its torn end (m; 1e9 none) and, for a stub, its distance out along its leg from its own node (m) ----
  // The texels: 0 A live, mat | 1 B live, mode | 2 qA | 3 qB | 4 dR, L0 | 5 bR, kt1 | 6 r, -, seed, tb | 7 K, tA, tB, dk |
  // 8-11 the corners (x along bR, y along dR x bR), two a texel
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
  // the drawn station of vertex (u, piece) on the whole member, as the uv reads it (the hinge hk between tA and tB)
  const stationOf = (u, piece, tA, tB, hk) => piece === 0 ? tA + (hk - tA) * dense1(u) : hk + (tB - hk) * dense0(u);
  function poseAt(S, u, k, piece) {
    const A = [S[0], S[1], S[2]], mat = S[3], B = [S[4], S[5], S[6]];
    let mode = S[7];
    const qA = [S[8], S[9], S[10], S[11]], qB = [S[12], S[13], S[14], S[15]];
    const dR = [S[16], S[17], S[18]], L0 = S[19], bR = [S[20], S[21], S[22]], kt1 = S[23];
    const r = S[24], seed = S[26] | 0, tb = S[27], nK = S[28] | 0, tA = S[29], tB = S[30], dk = S[31];
    if (!(mat > 0.5) || nK < 3) return [0, 0, 0, 0, 1, 0, 0, 0, 1e9, 0];
    const kc = k < nK ? k : 0, cx = S[32 + kc * 2], cy = S[33 + kc * 2], cr0 = Math.hypot(cx, cy) || 1e-6, cn = cx / cr0, cs = cy / cr0;
    const wood = mat > 2.5, steel = mat < 1.5;
    const cB = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], c = V.len(cB);
    if (mode === MODE.kink && c > KINK_STRETCH * L0) mode = MODE.torn;
    if (mode === MODE.crush && c > KINK_STRETCH * L0) mode = MODE.sliver;
    const broken = mode === MODE.torn || mode === MODE.sliver, crack = broken && c < L0 * 0.999, stub = broken && !crack;
    const depth = 2 * r;
    let p, T, Nn, bare = 0, raw = 0, e = 1e9, x0 = 0, ov = 0, cr = 0, nk = 1, curl = 1;
    // the torn end's own reach per corner: a tube's jag (+-1.2 r, never past the lip), wood's splinter (3-6 x its depth,
    // some short) - the stub's out along its leg, the crack's back from its crease
    const jag = (h1(kc, seed + piece * 77) * 2 - 1) * 1.2 * r;   // (by the corner: a ring's spare vertices on corner 0, all of it)
    const ext = depth * (3 + 3 * h1(kc + piece * 31, seed)) * (h1(kc * 7 + piece * 5, seed + 1) < 0.35 ? 0.25 : 1);
    if (stub) {
      const own = piece === 0 ? A : B, q = piece === 0 ? qA : qB, sg = piece === 0 ? 1 : -1;
      const legL = piece === 0 ? tb * L0 : (1 - tb) * L0, al = dk > 0 && legL > 1e-6 ? Math.atan(dk / legL) : 0;
      const dirR = V.nrm(V.add(V.mul(dR, sg * Math.cos(al)), V.mul(bR, Math.sin(al))));
      T = V.nrm(qrot(q, dirR)); const ax = qrot(q, bR); Nn = V.nrm(V.sub(ax, V.mul(T, V.dot(ax, T))));
      const tE = piece === 0 ? tA : 1 - tB, s0 = tE * L0, lip = wood ? 0 : 0.9 * r;
      const reach = legL + lip + (wood ? 6 * depth : 0);
      const endK = wood ? legL + ext : Math.min(reach, reach + jag);
      const xa = s0 + dense1(u) * (reach - s0), x = Math.min(xa, endK);
      e = endK - x; x0 = x; p = V.add(own, V.mul(T, x));
    } else {
      // the centreline: the two live ends; bent, two legs keeping their rest length meet at the hinge (a rounded crease);
      // a crack opens GAP x r each side of its crease
      const uu = c > 1e-6 ? V.mul(cB, 1 / c) : [1, 0, 0];
      const qm = V.dot(qA, qB) < 0 ? [qA[0] - qB[0], qA[1] - qB[1], qA[2] - qB[2], qA[3] - qB[3]] : [qA[0] + qB[0], qA[1] + qB[1], qA[2] + qB[2], qA[3] + qB[3]];
      { const l = Math.hypot(qm[0], qm[1], qm[2], qm[3]) || 1; qm[0] /= l; qm[1] /= l; qm[2] /= l; qm[3] /= l; }
      let bd = qrot(qm, bR); bd = V.sub(bd, V.mul(uu, V.dot(bd, uu))); { const l = V.len(bd); bd = l > 1e-5 ? V.mul(bd, 1 / l) : V.nrm(V.cross(uu, Math.abs(uu[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); }
      const hk = mode === MODE.crush ? tb : kt1, a = hk * L0, b = (1 - hk) * L0, g = crack ? GAP * r / L0 : 0;
      let s = piece === 0 ? tA + (hk - g - tA) * dense1(u) : (hk + g) + (tB - hk - g) * dense0(u);
      if (crack) {                         // the lips: each corner its own end back from the crease
        const back = wood ? 0 : Math.max(0, -jag) / L0, fwd = wood ? ext / L0 : 0;
        if (piece === 0) { const endS = hk - g - back + fwd; s = tA + (hk - g + fwd - tA) * dense1(u); s = Math.min(s, endS); e = (endS - s) * L0; }
        else { const endS = hk + g + back - fwd; s = endS + (tB - endS) * dense0(u); s = Math.max(s, endS); e = (s - endS) * L0; }
      }
      const qS = s * L0;
      if (mode === MODE.crush || !(c < L0 * 0.9995)) { p = V.add(A, V.mul(uu, s * c)); T = uu; Nn = bd; }
      else {
        const x = (a * a - b * b + c * c) / (2 * c), h = Math.sqrt(Math.max(a * a - x * x, 0));
        const H = V.add(V.add(A, V.mul(uu, x)), V.mul(bd, h)), d1 = V.nrm(V.sub(H, A)), d2 = V.nrm(V.sub(B, H));
        const rc = Math.min(mode === MODE.green ? 0.3 * r : 2 * r, 0.45 * Math.min(a, b));
        if (qS <= a - rc) { p = V.add(A, V.mul(d1, qS)); T = d1; }
        else if (qS >= a + rc) { p = V.add(H, V.mul(d2, qS - a)); T = d2; }
        else { const w = (qS - (a - rc)) / (2 * rc), P1 = V.sub(H, V.mul(d1, rc)), P2 = V.add(H, V.mul(d2, rc));
          p = V.add(V.add(V.mul(P1, (1 - w) * (1 - w)), V.mul(H, 2 * w * (1 - w))), V.mul(P2, w * w));
          T = V.nrm(V.add(V.mul(V.sub(H, P1), 2 * (1 - w)), V.mul(V.sub(P2, H), 2 * w))); }
        Nn = V.nrm(V.sub(bd, V.mul(T, V.dot(bd, T))));
        const ang = Math.acos(Math.max(-1, Math.min(1, V.dot(d1, d2))));
        if (!wood && !crack) ov = Math.min(1, ang / 1.2) * Math.exp(-Math.pow((qS - a) / (1.8 * r), 2));
        else if (mode === MODE.green) raw = cn > 0.5 ? Math.exp(-Math.pow((qS - a) / (1.5 * r), 2)) : 0;
      }
      if (mode === MODE.crush) {           // the kink band, inclined across the depth
        const z = qS - tb * L0, band = 1.4 * r, kb = sm(-band / 2 + cx * 0.8, band / 2 + cx * 0.8, z);
        cr = 0.35 * r * Math.sin(Math.PI * kb); raw = kb > 0.05 && kb < 0.95 ? 0.6 : 0;
      }
    }
    // the torn end: necked, its lips curled out (every other corner), the bare rim; wood: the splinter tapered, raw
    if (e < 1e8) {
      if (wood) { nk = 0.3 + 0.7 * sm(0, 0.45 * ext, e); raw = e < ext + 0.5 * depth ? 1 : raw; }
      else { nk = 1 - 0.35 * (1 - sm(0.4 * r, 1.5 * r, e)); if (kc & 1) curl = 1 + 0.6 * (1 - sm(0, 0.5 * r, e));
        bare = e < RIM * r ? 1 : e < 3 * RIM * r && !steel ? 0.5 : 0; }
    }
    const Bv = V.cross(T, Nn);
    const dent = ov > 0 && cn < -0.6 ? 1 - 0.25 * ov * (-cn - 0.6) / 0.4 : 1;
    const X = cx * nk * curl * (1 - 0.38 * ov) * dent, Y = cy * nk * curl * (1 + 0.2 * ov);
    const P = V.add(V.add(p, V.mul(Nn, X + cr)), V.mul(Bv, Y));
    const nn = V.nrm(V.add(V.mul(Nn, cn), V.mul(Bv, cs)));
    return [P[0], P[1], P[2], nn[0], nn[1], nn[2], bare, raw, e, x0];
  }
  // THE NORMAL OF THE DEFORMED TUBE (the user, 27 Oct: never flat - "looks like a bench"): the surface's own, from the
  // vertex's neighbours round its ring and along its piece (central differences: a vertex's normal the mean of its
  // faces', smooth over the body, the bend, the neck, the curled lip and the crush band alike); the section's own
  // radial normal where the surface folds to nothing (a lip's clamped rings)
  function pose(S, u, k, piece) {
    const o = poseAt(S, u, k, piece), nK = S[28] | 0;
    if (!(S[3] > 0.5) || nK < 3) return o;
    const kc = k < nK ? k : 0, kp = kc + 1 >= nK ? 0 : kc + 1, km = kc === 0 ? nK - 1 : kc - 1, du = 1 / (RINGS - 1);
    const a1 = poseAt(S, u, kp, piece), a0 = poseAt(S, u, km, piece), b1 = poseAt(S, Math.min(u + du, 1), kc, piece), b0 = poseAt(S, Math.max(u - du, 0), kc, piece);
    const ta = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], tl = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
    let n = V.cross(ta, tl); const l = V.len(n);
    if (!(l > 1e-9)) return o;
    n = V.mul(n, (n[0] * o[3] + n[1] * o[4] + n[2] * o[5] < 0 ? -1 : 1) / l);
    o[3] = n[0]; o[4] = n[1]; o[5] = n[2]; return o;
  }

  // THE SAME IN GLSL, chained after the bucket's own material hooks: the pose computed at the top of main, written over
  // `transformed` and `objectNormal` just before three projects them (whatever the material's own hook did to them)
  const LOOK_GLSL = [
    'uniform highp sampler2D uLook;',
    'varying float vBare; varying float vRaw; varying float vMat;',
    'vec4 lkT(int s, int j) { return texelFetch(uLook, ivec2(s * ' + TX + ' + j, 0), 0); }',
    'vec3 lkQ(vec4 q, vec3 v) { vec3 t = 2.0 * cross(q.xyz, v); return v + q.w * t + cross(q.xyz, t); }',
    'float lkH(int k, int seed) { uint h = uint(k) * 374761393u + uint(seed) * 668265263u; h = (h ^ (h >> 13u)) * 1274126177u; h = h ^ (h >> 16u); return float(h) / 4294967296.0; }',
    'float lkS(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }',
    'float lkD1(float u) { return 0.5 * u + 0.5 * (1.0 - (1.0 - u) * (1.0 - u)); }',
    'float lkD0(float u) { return 0.5 * u + 0.5 * u * u; }',
    'void lkAt(int sid, int piece, float u, int k, out vec3 Pp, out vec3 Pn) {',
    '  vec4 T0 = lkT(sid, 0), T1 = lkT(sid, 1), qA = lkT(sid, 2), qB = lkT(sid, 3), T4 = lkT(sid, 4), T5 = lkT(sid, 5), T6 = lkT(sid, 6), T7 = lkT(sid, 7);',
    '  float mat = T0.w; float mode = T1.w; int nK = int(T7.x + 0.5); vBare = 0.0; vRaw = 0.0; vMat = mat;',
    '  if (mat < 0.5 || nK < 3) { Pp = vec3(0.0); Pn = vec3(0.0, 1.0, 0.0); return; }',
    '  int kc = k < nK ? k : 0; vec4 CC = lkT(sid, 8 + kc / 2); vec2 cxy = (kc - 2 * (kc / 2)) == 0 ? CC.xy : CC.zw;',
    '  float cx = cxy.x, cy = cxy.y, cr0 = max(length(cxy), 1e-6), cn = cx / cr0, cs = cy / cr0;',
    '  vec3 A = T0.xyz, B = T1.xyz, dR = T4.xyz, bR = T5.xyz; float L0 = T4.w, kt1 = T5.w, r = T6.x, tb = T6.w, tA = T7.y, tB = T7.z, dk = T7.w; int seed = int(T6.z + 0.5);',
    '  bool wood = mat > 2.5, steel = mat < 1.5;',
    '  vec3 cv = B - A; float c = length(cv);',
    '  if (mode > 1.5 && mode < 2.5 && c > ' + KINK_STRETCH.toFixed(2) + ' * L0) mode = 1.0;',
    '  if (mode > 4.5 && c > ' + KINK_STRETCH.toFixed(2) + ' * L0) mode = 3.0;',
    '  bool broken = (mode > 0.5 && mode < 1.5) || (mode > 2.5 && mode < 3.5), crack = broken && c < L0 * 0.999, stub = broken && !crack;',
    '  float depth = 2.0 * r;',
    '  vec3 p, T, Nn; float e = 1e9, ov = 0.0, cr = 0.0, nk = 1.0, curl = 1.0;',
    '  float jag = (lkH(kc, seed + piece * 77) * 2.0 - 1.0) * 1.2 * r;',
    '  float ext = depth * (3.0 + 3.0 * lkH(kc + piece * 31, seed)) * (lkH(kc * 7 + piece * 5, seed + 1) < 0.35 ? 0.25 : 1.0);',
    '  if (stub) {',
    '    vec3 own = piece == 0 ? A : B; vec4 q = piece == 0 ? qA : qB; float sg = piece == 0 ? 1.0 : -1.0;',
    '    float legL = piece == 0 ? tb * L0 : (1.0 - tb) * L0; float al = dk > 0.0 && legL > 1e-6 ? atan(dk / legL) : 0.0;',
    '    vec3 dirR = normalize(dR * sg * cos(al) + bR * sin(al));',
    '    T = normalize(lkQ(q, dirR)); vec3 ax = lkQ(q, bR); Nn = normalize(ax - T * dot(ax, T));',
    '    float tE = piece == 0 ? tA : 1.0 - tB; float s0 = tE * L0, lip = wood ? 0.0 : 0.9 * r;',
    '    float reach = legL + lip + (wood ? 6.0 * depth : 0.0);',
    '    float endK = wood ? legL + ext : min(reach, reach + jag);',
    '    float xa = s0 + lkD1(u) * (reach - s0), x = min(xa, endK);',
    '    e = endK - x; p = own + T * x;',
    '  } else {',
    '    vec3 uu = c > 1e-6 ? cv / c : vec3(1.0, 0.0, 0.0);',
    '    vec4 qm = dot(qA, qB) < 0.0 ? qA - qB : qA + qB; qm = normalize(qm);',
    '    vec3 bd = lkQ(qm, bR); bd -= uu * dot(bd, uu); float bl = length(bd); bd = bl > 1e-5 ? bd / bl : normalize(cross(uu, abs(uu.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));',
    '    float hk = mode > 4.5 ? tb : kt1; float a = hk * L0, b = (1.0 - hk) * L0, g = crack ? ' + GAP.toFixed(2) + ' * r / L0 : 0.0;',
    '    float s = piece == 0 ? tA + (hk - g - tA) * lkD1(u) : (hk + g) + (tB - hk - g) * lkD0(u);',
    '    if (crack) {',
    '      float back = wood ? 0.0 : max(0.0, -jag) / L0, fwd = wood ? ext / L0 : 0.0;',
    '      if (piece == 0) { float endS = hk - g - back + fwd; s = tA + (hk - g + fwd - tA) * lkD1(u); s = min(s, endS); e = (endS - s) * L0; }',
    '      else { float endS = hk + g + back - fwd; s = endS + (tB - endS) * lkD0(u); s = max(s, endS); e = (s - endS) * L0; }',
    '    }',
    '    float qS = s * L0;',
    '    if (mode > 4.5 || !(c < L0 * 0.9995)) { p = A + uu * (s * c); T = uu; Nn = bd; }',
    '    else {',
    '      float x = (a * a - b * b + c * c) / (2.0 * c), h = sqrt(max(a * a - x * x, 0.0));',
    '      vec3 H = A + uu * x + bd * h, d1 = normalize(H - A), d2 = normalize(B - H);',
    '      float rc = min(mode > 3.5 ? 0.3 * r : 2.0 * r, 0.45 * min(a, b));',
    '      if (qS <= a - rc) { p = A + d1 * qS; T = d1; }',
    '      else if (qS >= a + rc) { p = H + d2 * (qS - a); T = d2; }',
    '      else { float w = (qS - (a - rc)) / (2.0 * rc); vec3 P1 = H - d1 * rc, P2 = H + d2 * rc;',
    '        p = P1 * ((1.0 - w) * (1.0 - w)) + H * (2.0 * w * (1.0 - w)) + P2 * (w * w); T = normalize((H - P1) * (2.0 * (1.0 - w)) + (P2 - H) * (2.0 * w)); }',
    '      Nn = normalize(bd - T * dot(bd, T));',
    '      float ang = acos(clamp(dot(d1, d2), -1.0, 1.0));',
    '      if (!wood && !crack) ov = min(1.0, ang / 1.2) * exp(-pow((qS - a) / (1.8 * r), 2.0));',
    '      else if (mode > 3.5 && mode < 4.5) vRaw = cn > 0.5 ? exp(-pow((qS - a) / (1.5 * r), 2.0)) : 0.0;',
    '    }',
    '    if (mode > 4.5) { float z = qS - tb * L0, band = 1.4 * r, kb = lkS(-band / 2.0 + cx * 0.8, band / 2.0 + cx * 0.8, z);',
    '      cr = 0.35 * r * sin(3.141592653589793 * kb); vRaw = kb > 0.05 && kb < 0.95 ? 0.6 : 0.0; }',
    '  }',
    '  if (e < 1e8) {',
    '    if (wood) { nk = 0.3 + 0.7 * lkS(0.0, 0.45 * ext, e); vRaw = e < ext + 0.5 * depth ? 1.0 : vRaw; }',
    '    else { nk = 1.0 - 0.35 * (1.0 - lkS(0.4 * r, 1.5 * r, e)); if ((kc - 2 * (kc / 2)) == 1) curl = 1.0 + 0.6 * (1.0 - lkS(0.0, 0.5 * r, e));',
    '      vBare = e < ' + RIM.toFixed(2) + ' * r ? 1.0 : (e < ' + (3 * RIM).toFixed(2) + ' * r && !steel ? 0.5 : 0.0); }',
    '  }',
    '  vec3 Bv = cross(T, Nn);',
    '  float dent = ov > 0.0 && cn < -0.6 ? 1.0 - 0.25 * ov * (-cn - 0.6) / 0.4 : 1.0;',
    '  float X = cx * nk * curl * (1.0 - 0.38 * ov) * dent, Y = cy * nk * curl * (1.0 + 0.2 * ov);',
    '  Pp = p + Nn * (X + cr) + Bv * Y; Pn = normalize(Nn * cn + Bv * cs);',
    '}',
    // (the normal from the neighbours, as pose: the four first, the vertex itself last - its varyings are its own)
    'void lkPose(out vec3 Pp, out vec3 Pn) {',
    '  int sid = int(position.z + 0.5) / 2; int piece = int(position.z + 0.5) - 2 * sid; float u = position.x; int k = int(position.y + 0.5);',
    '  int nK = int(lkT(sid, 7).x + 0.5); vec3 Q[4]; vec3 nq;',
    '  int kc = k < nK ? k : 0, kp = kc + 1 >= nK ? 0 : kc + 1, km = kc == 0 ? nK - 1 : kc - 1; float du = ' + (1 / (RINGS - 1)).toFixed(8) + ';',
    '  for (int j = 0; j < 4; j++) { Q[j] = vec3(0.0);',
    '    if (nK >= 3) lkAt(sid, piece, j == 2 ? min(u + du, 1.0) : (j == 3 ? max(u - du, 0.0) : u), j == 0 ? kp : (j == 1 ? km : kc), Q[j], nq); }',
    '  lkAt(sid, piece, u, k, Pp, Pn);',
    '  vec3 n = cross(Q[0] - Q[1], Q[2] - Q[3]); float l = length(n);',
    '  if (nK >= 3 && l > 1e-9) Pn = n * ((dot(n, Pn) < 0.0 ? -1.0 : 1.0) / l);',
    '}'].join('\n');
  const LOOK_FRAG = 'varying float vBare; varying float vRaw; varying float vMat;';
  // the colour at the tear (after the material's own map: the body is the bucket's, untouched), and the open tube's
  // inside dark (its back faces)
  const LOOK_TINT = [
    'if (vMat < 2.5) { vec3 bareC = vMat < 1.5 ? vec3(' + COL.steel.join(', ') + ') : (vBare > 0.75 ? vec3(' + COL.alloy.join(', ') + ') : vec3(' + COL.primer.join(', ') + '));',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, bareC, clamp(vBare * 2.0, 0.0, 1.0)); }',
    'else diffuseColor.rgb = mix(diffuseColor.rgb, vec3(' + COL.raw.join(', ') + '), clamp(vRaw, 0.0, 1.0));',
    'if (!gl_FrontFacing) diffuseColor.rgb *= ' + COL.bore.toFixed(2) + ';'].join('\n');

  // ---- A POOL (the page's): one a tube bucket's material, made once a model and PARKED (hidden; its program linked with
  // the world's at roll-out). src: the bucket's own material - cloned (its map, colour, roughness, metalness), its own
  // onBeforeCompile run first, then the pose; drawn on both faces (the open tube's bore) ----
  function make(THREE, src) {
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
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nV * 3), 3));
    const uvA = new THREE.BufferAttribute(new Float32Array(nV * 2), 2); uvA.setUsage(THREE.DynamicDrawUsage); g.setAttribute('uv', uvA);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nV * 3).fill(1), 3));   // (a vertex-coloured bucket: white, its map's)
    g.setDrawRange(0, 0); g.name = 'dmglook:pool';
    const data = new Float32Array(SLOTS * TX * 4);
    const tex = new THREE.DataTexture(data, SLOTS * TX, 1, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true; tex.name = 'dmglook:slots';
    const m = src && src.clone ? src.clone() : new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.2 });
    const own = src ? src.onBeforeCompile : null, ownKey = src && src.customProgramCacheKey ? src.customProgramCacheKey.bind(src) : null;
    m.side = THREE.DoubleSide; m.name = 'dmglook:' + ((src && src.name) || 'pool');
    m.onBeforeCompile = (sh, rr) => {
      if (typeof own === 'function') own.call(m, sh, rr);
      sh.uniforms.uLook = { value: tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + LOOK_GLSL)
        .replace('void main() {', 'void main() {\n  vec3 lkP, lkN; lkPose(lkP, lkN);')
        .replace('#include <defaultnormal_vertex>', 'objectNormal = lkN;\n#include <defaultnormal_vertex>')
        .replace('#include <project_vertex>', 'transformed = lkP;\n#include <project_vertex>');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LOOK_FRAG)
        .replace('#include <alphamap_fragment>', LOOK_TINT + '\n#include <alphamap_fragment>');
    };
    m.customProgramCacheKey = () => 'dmglook:2:' + (ownKey ? ownKey() : '');
    const mesh = new THREE.Mesh(g, m);
    mesh.name = 'dmglook:pool'; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.look = { tex, data, uv: uvA, used: 0, slots: [], beams: null, frames: 0, ms: 0, msMax: 0, events: 0 };
    return mesh;
  }
  // the static texels of slot j (texels 4-11) and its vertices' uv (uvOut: Float32Array 2 x 2 x RINGS x AROUND, or null)
  function slotState(d, j, s, M, T, rest, uvOut) {
    const b = T.beams[s.bi], o = j * TX * 4, bi = s.bi;
    const ex = rest[b.b * 3] - rest[b.a * 3], ey = rest[b.b * 3 + 1] - rest[b.a * 3 + 1], ez = rest[b.b * 3 + 2] - rest[b.a * 3 + 2], L = Math.hypot(ex, ey, ez) || 1e-9;
    const du = [ex / L, ey / L, ez / L], bR = s.axis, wv = [du[1] * bR[2] - du[2] * bR[1], du[2] * bR[0] - du[0] * bR[2], du[0] * bR[1] - du[1] * bR[0]];
    for (let q = 0; q < TX * 4; q++) d[o + q] = 0;
    d[o + 3] = MAT[b.mat] || 0; d[o + 7] = s.mode; d[o + 11] = 1; d[o + 15] = 1;   // (the turns: identity until the first posed frame)
    d[o + 16] = du[0]; d[o + 17] = du[1]; d[o + 18] = du[2]; d[o + 19] = L;
    d[o + 20] = bR[0]; d[o + 21] = bR[1]; d[o + 22] = bR[2]; d[o + 23] = s.kt1;
    d[o + 24] = M.r[bi]; d[o + 26] = (bi * 2654435761 >>> 8) & 0xffff; d[o + 27] = s.tb;
    const nK = M.K[bi]; d[o + 28] = nK; d[o + 29] = M.tA[bi]; d[o + 30] = M.tB[bi]; d[o + 31] = s.dk;
    for (let k = 0; k < nK; k++) { const q = (bi * AROUND + k) * 3, x = M.off[q], y = M.off[q + 1], z = M.off[q + 2];
      d[o + 32 + k * 2] = x * bR[0] + y * bR[1] + z * bR[2]; d[o + 33 + k * 2] = x * wv[0] + y * wv[1] + z * wv[2]; }
    if (uvOut) { const hk = s.mode === MODE.crush ? s.tb : s.kt1, tA = M.tA[bi], tB = M.tB[bi], span = Math.max(tB - tA, 1e-6); let w = 0;
      for (let pc = 0; pc < 2; pc++) for (let i = 0; i < RINGS; i++) { const f = Math.max(0, Math.min(1, (stationOf(i / (RINGS - 1), pc, tA, tB, hk) - tA) / span));
        for (let k = 0; k < AROUND; k++) { const kc = k < nK ? k : 0, q = (bi * AROUND + kc) * 4;
          uvOut[w++] = M.uv[q] + (M.uv[q + 2] - M.uv[q]) * f; uvOut[w++] = M.uv[q + 1] + (M.uv[q + 3] - M.uv[q + 1]) * f; } } }
  }
  // AT AN EVENT: the plan's slots into their buckets' pools (pools: Map bucket key -> mesh), the static texels and the uv
  // (one range a pool); a pool shows while any of its slots is used. Returns the slots used
  function assign(pools, P, M, T, rest) {
    const per = new Map(); for (const pm of pools.values()) per.set(pm, []);
    for (const s of P.slots) { const pm = pools.get(M.key[s.bi]); if (pm) { const L = per.get(pm); if (L.length < SLOTS) L.push(s); } }
    let used = 0;
    for (const [pm, L] of per) {
      const U = pm.userData.look, uvArr = U.uv.array, nPer = 2 * RINGS * AROUND, tmp = new Float32Array(nPer * 2);
      U.data.fill(0);
      for (let j = 0; j < L.length; j++) { slotState(U.data, j, L[j], M, T, rest, tmp); uvArr.set(tmp, j * nPer * 2); }
      U.used = L.length; U.slots = L; U.beams = T.beams; U.events++; used += L.length;
      if (L.length) { if (U.uv.clearUpdateRanges) { U.uv.clearUpdateRanges(); U.uv.addUpdateRange(0, L.length * nPer * 2); } else U.uv.updateRange = { offset: 0, count: L.length * nPer * 2 };
        U.uv.needsUpdate = true; }
      pm.geometry.setDrawRange(0, L.length * 2 * (RINGS - 1) * AROUND * 6);
      pm.visible = L.length > 0; U.tex.needsUpdate = true;
    }
    return used;
  }
  // EACH POSED FRAME: every pool's used slots' nodes (live, less the origin O - the pools' own position) and their turns
  // (NF.q: skin_break.js nodeFrames, rest -> live, x y z w)
  function frame(pools, live, Q, O) {
    let n = 0;
    for (const mesh of pools.values()) {
      const U = mesh.userData.look; if (!U.used) continue;
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0, d = U.data;
      for (let j = 0; j < U.used; j++) { const s = U.slots[j], o = j * TX * 4;
        const bm = U.beams[s.bi], ia = bm.a * 3, ib = bm.b * 3, qa = bm.a * 4, qb = bm.b * 4;
        d[o] = live[ia] - O[0]; d[o + 1] = live[ia + 1] - O[1]; d[o + 2] = live[ia + 2] - O[2];
        d[o + 4] = live[ib] - O[0]; d[o + 5] = live[ib + 1] - O[1]; d[o + 6] = live[ib + 2] - O[2];
        if (Q) { d[o + 8] = Q[qa]; d[o + 9] = Q[qa + 1]; d[o + 10] = Q[qa + 2]; d[o + 11] = Q[qa + 3];
          d[o + 12] = Q[qb]; d[o + 13] = Q[qb + 1]; d[o + 14] = Q[qb + 2]; d[o + 15] = Q[qb + 3]; } }
      mesh.position.set(O[0], O[1], O[2]); mesh.updateMatrix(); mesh.matrixWorldNeedsUpdate = true;
      U.tex.needsUpdate = true; U.frames++; n += U.used;
      if (t0) { const ms = performance.now() - t0; U.ms += ms; if (ms > U.msMax) U.msMax = ms; }
    }
    return n;
  }
  // a heal (a reset, a new flight): nothing drawn
  function clear(pools) { for (const mesh of pools.values()) { const U = mesh.userData.look; if (!U.used && !mesh.visible) continue; U.used = 0; U.slots = []; mesh.visible = false; mesh.geometry.setDrawRange(0, 0); } }
  // a slot's TX texels as pose() reads them (the gate's mirror)
  const slotTexels = (mesh, j) => mesh.userData.look.data.subarray(j * TX * 4, (j + 1) * TX * 4);

  const API = { SLOTS, RINGS, AROUND, TX, MAT, MODE, COL, RIM, GAP, BEND_MIN, SET_MIN, KINK_STRETCH, h1, measure, plan, pose, stationOf, slotState, make, assign, frame, clear, slotTexels, LOOK_GLSL, LOOK_FRAG, LOOK_TINT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_MEMBERS = API;
})();
