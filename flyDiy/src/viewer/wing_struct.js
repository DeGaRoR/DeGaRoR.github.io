// WING-STRUCTURE (9 Nov 2026; futureDesigns/WING-STRUCTURE-STUDY-2026-11.md): THE WING'S INSIDE, DRAWN FROM THE ROWS THAT
// FLY IT. The user, on the fiche: "the cutaway takes the wings off ... replace it with the wing's proper internal
// structure"; the reference is their own Jodel wing hanging in the shed (assets/jodel_structure, airframe_jodel_wing).
//
// NOTHING HERE IS PER PLANE. Every member stands where a row of the build already says it is:
//   THE SPARS     at the frame's sparFront / sparRear chord fractions, on the spar NODES' own line (61_gen_frame WF/WR):
//                 the surface field's integer rails (_cage_wing.js wingField .w: 0 at the front spar, 1 at the rear) -
//                 the lines the covering's normal texture prints (aeroskin.js "THE REAL MEMBERS")
//   THE RIBS      at the root and at parts.ribZ - the "one rib every 0.4 m" stations the mass model bills and the
//                 covering prints at its integer stations (wingField .z)
//   THE BAYS      the frame's spar stations: each bay's two diagonals ARE the drag / anti-drag wires on a cloth wing
//                 (61_gen_frame "rule 4": the plan bay's diagonals), each station's spar-to-spar member the
//                 compression strut - the same members the crash breaks (30_solver, DMG)
//   THE STRINGERS a stressed-skin wing's, at the build grammar's stringerPitch in metres from the leading edge - the
//                 metric stringers the covering prints (aeroskin.js uG0.y off GEN_BUILD_GRAMMAR)
//   THE CONTROLS  the hinge lines and bands genWingInto cuts (the aileron outboard of aStart, the flap inboard of fEnd)
//   THE FITTINGS  the root, and the lift strut's own station (parts.planes[k].wf.R.strutF / strutR)
// The KIND (what the members are made of and how they are built) is the wing's construction row (genSurfKey:
// fabric, steel, aluFabric, fabricAlu, alloy, carbon, glass) and, for the wooden row, its bracing: a cantilever wooden
// wing is the Jodel's single box spar under a ply D-box, a strut-braced one the J-3's two spruce spars with alloy ribs
// and drag wires. A row this file does not know draws as the wooden one and says so (info.fallback).
//
// THE SECTION IS THE SKIN'S. A point is placed exactly as 63_gen_wing.js wingSectionAt places a skin vertex - the spar
// frame at that station (frameAt: the two bounding spar stations' nodes, lerped; the elliptic law's walk), the chord
// axis LE -> TE, its normal up, the NACA contour - so a cap sits INSET inside the covering everywhere and the spar on
// the covering's printed line.
//
// LIGHT: one geometry per wing half (a plane, a side), at most two materials (the kind's finish and the metal), so at
// most two draws a wing; the triangle budget is BUDGET.tris per half at each LOD (GATE WINGSTRUCT holds it). The
// materials come from matlib.js (GATE ASSETS). Nothing is built until a view asks for it (the fiche's cutaway, the
// garage's see-inside and cutaway, a wreck whose covering tore): normal flight never builds it.
//
// PURE apart from make() (THREE passed in): node loads it (module.exports, GATE WINGSTRUCT); window.WING_STRUCT in the
// page. The core's functions (genAfEval, genSurfKey, GEN_FLAPS, GEN_BUILD_GRAMMAR) are read off `lib` or the page.
(function () {
  'use strict';
  const BUDGET = { tris: [12000, 7000], draws: 2 };   // per wing half: LOD 0 (the cutaways), LOD 1 (a wreck) - the twin's 16 ribs a side, 10.1k / 6.5k, the worst validated
  const INSET = 0.004;          // m: a member's outer face inside the covering (the skin draws at zero thickness)
  const GAP = 0.010;            // chord fraction: a rib's fixed part stops this far ahead of a hinge line
  // the finishes, LINEAR (jodel_prep.py's spruce: the user's own wing)
  const COL = {
    spruce: [0.340, 0.190, 0.073], ply: [0.56, 0.40, 0.21], alu: [0.62, 0.64, 0.67], steel: [0.30, 0.33, 0.31],
    primer: [0.33, 0.40, 0.27], carbon: [0.030, 0.030, 0.034], glass: [0.70, 0.72, 0.64], foam: [0.80, 0.66, 0.36],
    fit: [0.44, 0.46, 0.49], wire: [0.55, 0.56, 0.58],
  };
  const METAL = new Set(['alu', 'steel', 'primer', 'fit', 'wire']);   // drawn by the metal material (draw 2)
  // THE KINDS: what each construction row's members are (the study's section per family). Widths are chord fractions
  // (sparW, rearW) or metres (cap, the rest).
  //   spar  box: a wood box spar, flat caps and ply webs; plank: a solid spruce plank (the J-3's 13/16 in);
  //         ibeam: caps + a web (an extruded PA-18 spar, a moulded spar's carbon caps on a foam-cored web);
  //         channel: the metal wing's built-up C spar; tube: a round tube (4130, 6061)
  //   rib   truss: capstrips + Warren diagonals (+ gussets); stamped: a formed alloy rib, flanged caps + diagonals;
  //         formed: an ultralight's bent-tube outline; plate: a sheet rib with flanged lightening holes;
  //         sparse: a moulded wing's few foam ribs (root, ends of the controls, strut, tip)
  //   nose  the leading edge's cover drawn (upper surface only - the cutaway's peel, so the nose ribs read from below):
  //         ply (the D-box, lapped onto the spar), sheet (the alloy leading edge), null
  const KINDS = {
    dbox:      { name: 'wood box spar, truss ribs, ply D-box (Jodel)', spar: 'box', sparW: 0.065, sparC: 'spruce', webC: 'ply',
                 rear: 'plank', rearW: 0.016, rearC: 'spruce', rib: 'truss', ribC: 'spruce', cap: 0.011, gusset: 'ply',
                 nose: 'ply', noseRibs: true, wires: false, le: 'spruce', te: 'spruce', rootC: 'ply' },
    cub:       { name: 'two spruce spars, alloy ribs, drag wires (J-3)', spar: 'plank', sparW: 0.013, sparC: 'spruce',
                 rear: 'plank', rearW: 0.014, rearC: 'spruce', rib: 'stamped', ribC: 'alu', cap: 0.014,
                 nose: 'sheet', noseC: 'alu', noseRibs: true, wires: true, le: 'alu', te: 'alu', rootC: 'alu' },
    steel:     { name: '4130 tube spars and ribs, drag wires', spar: 'tube', sparW: 0.030, sparC: 'steel', rear: 'tube',
                 rearW: 0.026, rearC: 'steel', rib: 'tube', ribC: 'steel', cap: 0.012, nose: null, wires: true,
                 le: 'steel', te: 'steel', rootC: 'steel' },
    aluFabric: { name: '6061 tube spars, formed ribs, drag cables', spar: 'tube', sparW: 0.032, sparC: 'alu', rear: 'tube',
                 rearW: 0.028, rearC: 'alu', rib: 'formed', ribC: 'alu', cap: 0.012, nose: null, wires: true,
                 le: 'alu', te: 'alu', rootC: 'alu' },
    fabricAlu: { name: 'extruded alloy spars, stamped ribs, drag wires (PA-18)', spar: 'ibeam', sparW: 0.024, sparC: 'alu',
                 webC: 'alu', rear: 'ibeam', rearW: 0.020, rearC: 'alu', rib: 'stamped', ribC: 'alu', cap: 0.014,
                 nose: 'sheet', noseC: 'alu', noseRibs: true, wires: true, le: 'alu', te: 'alu', rootC: 'alu' },
    alloy:     { name: 'stressed skin: channel spars, flanged plate ribs, stringers (172)', spar: 'channel', sparW: 0.022,
                 sparC: 'alu', webC: 'alu', rear: 'channel', rearW: 0.018, rearC: 'alu', rib: 'plate', ribC: 'alu',
                 cap: 0.016, nose: null, stringers: true, wires: false, le: null, te: 'alu', rootC: 'alu' },
    carbon:    { name: 'moulded: carbon spar caps on a foam-cored web, rear web, few ribs', spar: 'ibeam', sparW: 0.030,
                 sparC: 'carbon', webC: 'foam', rear: 'web', rearW: 0.010, rearC: 'foam', rib: 'sparse', ribC: 'foam',
                 cap: 0.012, nose: null, wires: false, le: null, te: 'carbon', rootC: 'foam' },
    glass:     { name: 'moulded: glass spar caps on a foam-cored web, rear web, few ribs', spar: 'ibeam', sparW: 0.030,
                 sparC: 'glass', webC: 'foam', rear: 'web', rearW: 0.010, rearC: 'foam', rib: 'sparse', ribC: 'foam',
                 cap: 0.012, nose: null, wires: false, le: null, te: 'glass', rootC: 'foam' },
  };
  const G = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  const libOf = lib => ({
    genAfEval: (lib && lib.genAfEval) || G.genAfEval,
    genSurfKey: (lib && lib.genSurfKey) || G.genSurfKey,
    GEN_FLAPS: (lib && lib.GEN_FLAPS) || G.GEN_FLAPS,
    GEN_BUILD_GRAMMAR: (lib && lib.GEN_BUILD_GRAMMAR) || G.GEN_BUILD_GRAMMAR,
  });
  // ---- small vector helpers ----
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const nrmz = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-12; return [a[0] / L, a[1] / L, a[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const uniq = (A, eps) => A.slice().sort((a, b) => a - b).filter((z, i, B) => i === 0 || z - B[i - 1] > (eps || 1e-4));

  // which kind a plane's wing is built as -> { key, kind, row, fallback }
  function kindOf(def, k, lib) {
    const L = libOf(lib), S = def.spec, P0 = def.parts || {}, PP = (P0.planes && P0.planes[k | 0]) || P0;
    let row = 'fabric';
    try { row = L.genSurfKey(S, 'wing', k | 0); } catch (e) {}
    let key = row, fallback = false;
    if (row === 'fabric') key = (PP.useStrut || PP.truss) ? 'cub' : 'dbox';
    if (!KINDS[key]) { key = 'dbox'; fallback = true; }
    return { key, kind: KINDS[key], row, fallback };
  }

  // ---- the geometry accumulator: positions, colours, two index lists (0 the kind's finish, 1 the metal) ----
  function acc() { return { p: [], c: [], i: [[], []], n: 0 }; }
  function vtx(A, p, col) { A.p.push(p[0], p[1], p[2]); A.c.push(col[0], col[1], col[2]); return A.n++; }
  const matOf = cn => (METAL.has(cn) ? 1 : 0);
  function tri(A, m, a, b, c) { A.i[m].push(a, b, c); }
  function quad(A, m, a, b, c, d) { A.i[m].push(a, b, c, a, c, d); }
  // rings swept: each ring the same count of points, closed (a tube, a box) or open (a sheet's row)
  function sweep(A, rings, cn, closed) {
    const col = COL[cn], m = matOf(cn), K = rings[0].length, ids = rings.map(r => r.map(p => vtx(A, p, col)));
    for (let j = 0; j + 1 < ids.length; j++)
      for (let q = 0; q < (closed ? K : K - 1); q++) {
        const q2 = (q + 1) % K;
        quad(A, m, ids[j][q], ids[j + 1][q], ids[j + 1][q2], ids[j][q2]);
      }
    if (closed && K > 2) for (const e of [0, ids.length - 1])   // the ends capped (a fan)
      for (let q = 1; q + 1 < K; q++) tri(A, m, ids[e][0], ids[e][q], ids[e][q + 1]);
  }
  // a member between two points: a box (4) or a round section (n), `up` the section's second axis
  function bar(A, a, b, w, h, up, cn, n) {
    const ax = nrmz(sub(b, a)), s1 = nrmz(cross(ax, up)), s2 = nrmz(cross(s1, ax));
    const ring = c => {
      const r = [];
      if (n && n > 4) for (let q = 0; q < n; q++) { const t = 2 * Math.PI * q / n; r.push(add(add(c, mul(s1, 0.5 * w * Math.cos(t))), mul(s2, 0.5 * h * Math.sin(t)))); }
      else for (const [x, y] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) r.push(add(add(c, mul(s1, 0.5 * w * x)), mul(s2, 0.5 * h * y)));
      return r;
    };
    sweep(A, [ring(a), ring(b)], cn, true);
  }
  // a flat disc (a gusset), in the plane of u and v
  function disc(A, c, u, v, ru, rv, cn, n) {
    const col = COL[cn], m = matOf(cn), o = vtx(A, c, col), ids = [];
    for (let q = 0; q < n; q++) { const t = 2 * Math.PI * q / n; ids.push(vtx(A, add(add(c, mul(u, ru * Math.cos(t))), mul(v, rv * Math.sin(t))), col)); }
    for (let q = 0; q < n; q++) tri(A, m, o, ids[q], ids[(q + 1) % n]);
  }

  // ---- THE PLAN: one plane's wing, both sides -> { info, halves: [{ side, plane, A }] } ----
  // opts: { lod 0|1, sides ['R','L'], planes [k...], map (body point -> the caller's frame) }
  function plan(def, opts) {
    opts = opts || {};
    const L = libOf(opts.lib), lod = opts.lod | 0, S = def.spec, N = def.nodes, P0 = def.parts || {};
    const map = opts.map || (p => p);
    const planes = opts.planes || (S.wings || []).map((w, k) => k).filter(k => k === 0 || (P0.planes && P0.planes[k]));
    const out = { info: { planes: [] }, halves: [] };
    for (const k of planes) {
      const PP = (P0.planes && P0.planes[k]) || P0, W = S.wings[k] || S.wings[0];
      if (!PP || !PP.wf || !W) continue;
      const K = kindOf(def, k, opts.lib), KD = K.kind;
      const E = L.genAfEval(W.naca);
      const semi = k === 0 ? S.geom.semi : (PP.semi != null ? PP.semi : 0.5 * W.span);
      const CTL = k === 0 ? S.controls : (W.controls || { aileron: { span: 0, chord: 0.22 }, flap: { type: 'none', span: 0.5, chord: 0.2 } });
      const aStart = (1 - CTL.aileron.span) * semi, AIL_H = 1 - CTL.aileron.chord;
      const FL = L.GEN_FLAPS && L.GEN_FLAPS[CTL.flap.type], FLAP_ON = !!(FL && FL.dCl > 0);
      const fEnd = FLAP_ON ? CTL.flap.span * semi : -1, FLAP_H = 1 - CTL.flap.chord;
      const sparF = PP.sparFront != null ? PP.sparFront : 0.15, sparR = PP.sparRear != null ? PP.sparRear : 0.65;
      const zAll = [PP.zRoot, ...PP.zs];
      const zLast = zAll[zAll.length - 1];
      const zS = W.tipR > 1e-6 ? Math.min(W.tipZ, zLast) : zLast;          // the straight wing's end (the bow beyond)
      const zAilEnd = W.tipR > 1e-6 ? W.tipZ : zLast;
      const bands = [];
      if (CTL.aileron.span > 0 && aStart < zAilEnd - 1e-3) bands.push({ n: 'ail', z0: Math.max(aStart, PP.zRoot), z1: zAilEnd, h: AIL_H });
      if (FLAP_ON && fEnd > PP.zRoot + 1e-3) bands.push({ n: 'flap', z0: PP.zRoot, z1: fEnd, h: FLAP_H });
      const bandAt = z => bands.find(b => z > b.z0 - 1e-6 && z < b.z1 + 1e-6) || null;
      const ribZ = uniq([PP.zRoot, ...(PP.ribZ || [])]).filter(z => z <= zS + 1e-6 && z >= PP.zRoot - 1e-6);
      const zSpan = uniq([...zAll.filter(z => z <= zS + 1e-6), ...ribZ, zS, ...bands.flatMap(b => [b.z0, b.z1])]).filter(z => z >= PP.zRoot - 1e-6 && z <= zS + 1e-6);
      const GR = L.GEN_BUILD_GRAMMAR && L.GEN_BUILD_GRAMMAR[K.row];
      const strPitch = KD.stringers && GR && GR.stringerPitch > 0 ? GR.stringerPitch : 0;
      const pinfo = { plane: k, kind: K.key, row: K.row, name: KD.name, fallback: K.fallback, sparF, sparR, ribs: ribZ.slice(), zS,
                      bays: [], stringers: [], bands: bands.map(b => ({ n: b.n, z0: b.z0, z1: b.z1, h: b.h })), strut: null, halves: [] };
      out.info.planes.push(pinfo);
      for (const sd of (opts.sides || ['R', 'L'])) {
        const fw = PP.wf[sd], side = sd === 'R' ? 1 : -1;
        if (!fw || !fw.F || !fw.R || fw.F.length < 2) continue;
        // frameAt: 63_gen_wing.js genWingInto's own, line for line (the stations, the lerp, the elliptic walk)
        const frameAt = z => {
          let b2 = 0;
          while (b2 < zAll.length - 2 && z > zAll[b2 + 1]) b2++;
          const z0 = zAll[b2], z1 = zAll[b2 + 1];
          const t = Math.max(0, Math.min(1, (z - z0) / Math.max(1e-9, z1 - z0)));
          const F0 = fw.F[b2], F1 = fw.F[b2 + 1], R0 = fw.R[b2], R1 = fw.R[b2 + 1];
          const lerp = (a3, b3) => [a3[0] + (b3[0] - a3[0]) * t, a3[1] + (b3[1] - a3[1]) * t, a3[2] + (b3[2] - a3[2]) * t];
          const pF = lerp(N[F0].p, N[F1].p), pR = lerp(N[R0].p, N[R1].p);
          if (PP.ell && PP.xFat && PP.xRat) {
            const zs0 = N[F0].p[2] * side, zs1 = N[F1].p[2] * side;
            pF[0] += PP.xFat(z) - (PP.xFat(zs0) + (PP.xFat(zs1) - PP.xFat(zs0)) * t);
            pR[0] += PP.xRat(z) - (PP.xRat(zs0) + (PP.xRat(zs1) - PP.xRat(zs0)) * t);
          }
          const ch = nrmz(sub(pR, pF));
          let up = nrmz(cross(ch, [0, 0, 1]));
          if (up[1] < 0) up = mul(up, -1);
          const lat = nrmz(cross(ch, up));
          return { z, pF, ch, up, lat, chord: PP.chordAt(z) };
        };
        // a point: chord fraction xc, metres along the section's normal (wingSectionAt's own map)
        const P = (f, xc, ym) => map(add(add(f.pF, mul(f.ch, (xc - sparF) * f.chord)), mul(f.up, ym)));
        const yU = (f, x) => E.up(x)[1] * f.chord - INSET, yL = (f, x) => E.lo(x)[1] * f.chord + INSET;
        // the depth a member of chord width [x0, x1] has inside the covering (the thinner end's)
        const top = (f, x0, x1) => Math.min(yU(f, x0), yU(f, x1), yU(f, 0.5 * (x0 + x1)));
        const bot = (f, x0, x1) => Math.max(yL(f, x0), yL(f, x1), yL(f, 0.5 * (x0 + x1)));
        const A = acc();
        const FR = zSpan.map(frameAt);
        const sw = KD.sparW, rw = KD.rearW;
        // ---- THE SPARS, along the span ----
        // a member of chord span [x0, x1] between two heights given per frame: four corners a frame
        const boxSpan = (fr, x0, x1, yt, yb, cn) => sweep(A, fr.map(f => [P(f, x0, yt(f)), P(f, x1, yt(f)), P(f, x1, yb(f)), P(f, x0, yb(f))]), cn, true);
        const spar = (xc, type, w, cn, webC) => {
          const x0 = xc - 0.5 * w, x1 = xc + 0.5 * w;
          const T = f => top(f, x0, x1), B = f => bot(f, x0, x1);
          if (type === 'tube') {
            const n = lod ? 6 : 8;
            sweep(A, FR.map(f => {
              const r = Math.min(0.5 * w * f.chord, 0.45 * (T(f) - B(f))), ym = 0.5 * (T(f) + B(f)), r2 = [];
              for (let q = 0; q < n; q++) { const t = 2 * Math.PI * q / n; r2.push(map(add(add(add(f.pF, mul(f.ch, (xc - sparF) * f.chord)), mul(f.ch, r * Math.cos(t))), mul(f.up, ym + r * Math.sin(t))))); }
              return r2;
            }), cn, true);
            return;
          }
          if (type === 'box' || type === 'plank' || type === 'web') { boxSpan(FR, x0, x1, T, B, cn); return; }
          // ibeam / channel: two caps and a web
          const capH = f => Math.max(0.006, 0.09 * (T(f) - B(f)));
          const tw = 0.004 / Math.max(0.3, FR[0].chord);        // a web's few mm, as a chord fraction
          boxSpan(FR, x0, x1, T, f => T(f) - capH(f), cn);
          boxSpan(FR, x0, x1, f => B(f) + capH(f), B, cn);
          const wx = type === 'channel' ? x1 - tw : xc - 0.5 * tw;
          boxSpan(FR, wx, wx + tw, f => T(f) - capH(f), f => B(f) + capH(f), webC || cn);
        };
        spar(sparF, KD.spar, sw, KD.sparC, KD.webC);
        const AU = opts.audit ? { spars: { F: [], R: [] }, wires: [], struts: [] } : null;
        if (AU) for (const z of zAll.filter(z => z <= zS + 1e-6)) { const f = frameAt(z);
          for (const [k2, xc, w] of [['F', sparF, sw], ['R', sparR, rw]]) AU.spars[k2].push({ z, p: P(f, xc, 0.5 * (top(f, xc - 0.5 * w, xc + 0.5 * w) + bot(f, xc - 0.5 * w, xc + 0.5 * w))) }); }
        if (KD.spar === 'box') {   // a wood box spar's ply faces (webs) drawn proud of its caps: the box reads as one
          const x0 = sparF - 0.5 * sw, x1 = sparF + 0.5 * sw, t = 0.003 / Math.max(0.3, FR[0].chord);
          boxSpan(FR, x0 - t, x0, f => top(f, x0, x1), f => bot(f, x0, x1), KD.webC);
          boxSpan(FR, x1, x1 + t, f => top(f, x0, x1), f => bot(f, x0, x1), KD.webC);
        }
        // the rear spar where it carries no surface's hinge closer than its own width: the whole span; a band whose
        // hinge sits aft of it gets a false spar at its hinge line instead (below)
        spar(sparR, KD.rear, rw, KD.rearC, KD.webC);
        // ---- THE LEADING AND TRAILING EDGES ----
        if (KD.le) boxSpan(FR, 0.004, 0.022, f => 0.6 * yU(f, 0.013), f => 0.6 * yL(f, 0.013), KD.le);
        // the trailing edge strip, outside the bands; each band's own hinge spar (the wing's false spar ahead of the
        // hinge, the surface's spar aft of it) and its trailing edge
        const runs = [];   // [z0, z1, which] pieces of span between band edges
        { const cuts = uniq([PP.zRoot, zS, ...bands.flatMap(b => [b.z0, b.z1])]).filter(z => z >= PP.zRoot - 1e-6 && z <= zS + 1e-6);
          for (let i = 0; i + 1 < cuts.length; i++) runs.push([cuts[i], cuts[i + 1], bandAt(0.5 * (cuts[i] + cuts[i + 1]))]); }
        const frIn = (z0, z1) => FR.filter(f => f.z >= z0 - 1e-6 && f.z <= z1 + 1e-6);
        for (const [z0, z1, b] of runs) {
          const fr = frIn(z0, z1);
          if (fr.length < 2) continue;
          if (!b) { if (KD.te) boxSpan(fr, 0.955, 0.985, f => yU(f, 0.955), f => yL(f, 0.955), KD.te); continue; }
          const hf = b.h - GAP;
          if (hf - sparR > rw + 0.02)   // the false spar: the fixed wing's aft member, at the cove
            boxSpan(fr, hf - 0.010, hf, f => top(f, hf - 0.01, hf), f => bot(f, hf - 0.01, hf), KD.rearC);
          const hs = b.h + GAP + 0.012, sw2 = 0.012;
          boxSpan(fr, hs, hs + sw2, f => top(f, hs, hs + sw2), f => bot(f, hs, hs + sw2), KD.te || KD.rearC);
          if (KD.te) boxSpan(fr, 0.955, 0.985, f => yU(f, 0.955), f => yL(f, 0.955), KD.te);
          // hinge fittings: at the band's ends and its middle, under the hinge line
          for (const zh of [z0 + 0.06, 0.5 * (z0 + z1), z1 - 0.06]) {
            if (zh <= z0 || zh >= z1) continue;
            const f = frameAt(zh), y = yL(f, b.h) + 0.004;
            bar(A, P(f, b.h - 0.03, y), P(f, b.h + 0.02, y), 0.006, 0.030, mul(f.up, 1), 'fit');
          }
        }
        // ---- THE COVER DRAWN: the D-box / the alloy leading edge, upper surface ----
        if (KD.nose) {
          const xe = KD.nose === 'ply' ? sparF + 0.5 * sw : sparF - 0.5 * sw, n = lod ? 5 : 9;
          const cn = KD.nose === 'ply' ? 'ply' : KD.noseC;
          const row = f => { const r = []; for (let q = 0; q <= n; q++) { const x = xe * (1 - Math.cos(0.5 * Math.PI * q / n)); const a = E.up(Math.max(0.0, x)); r.push(P(f, a[0], a[1] * f.chord - 0.5 * INSET)); } return r; };
          sweep(A, FR.map(row), cn, false);
        }
        // ---- THE RIBS ----
        const capPts = (f, x0, x1, upper, n) => {   // a cap's points along the contour, cosine-spaced
          const r = [];
          for (let q = 0; q <= n; q++) {
            const x = x0 + (x1 - x0) * 0.5 * (1 - Math.cos(Math.PI * q / n));
            r.push(x);
          }
          return r.map(x => ({ x, y: upper ? yU(f, x) : yL(f, x) }));
        };
        // a cap: a strip of [x0, x1] along the upper or lower contour, `w` wide across the rib (lat), `h` deep
        const cap = (f, x0, x1, upper, w, h, cn, n) => {
          if (x1 - x0 < 1e-3) return;
          const pts = capPts(f, x0, x1, upper, n), s = upper ? -1 : 1;
          sweep(A, pts.map(q => {
            const c = P(f, q.x, q.y), d = P(f, q.x, q.y + s * h), lw = mul(f.lat, 0.5 * w);
            return [add(c, lw), sub(c, mul(lw, 1)), sub(d, lw), add(d, lw)];
          }), cn, true);
        };
        const member = (f, xa, ya, xb, yb, w, cn, n) => bar(A, P(f, xa, ya), P(f, xb, yb), w, w, f.lat, cn, n);
        // a flat plate between the contours on [x0, x1], lightening holes in it; `flange` its caps turned across
        const plate = (f, x0, x1, cn, holes, flange, lip) => {
          if (x1 - x0 < 0.01) return;
          const nC = Math.max(1, holes ? Math.round((x1 - x0) * f.chord / Math.max(0.10, 1.3 * (top(f, x0, x1) - bot(f, x0, x1)))) : 1);
          const col = COL[cn], m = matOf(cn), Kq = lod ? 8 : 16;
          for (let c = 0; c < nC; c++) {
            const xa = x0 + (x1 - x0) * c / nC, xb = x0 + (x1 - x0) * (c + 1) / nC, xm = 0.5 * (xa + xb);
            const tY = x => yU(f, x) - 0.002, bY = x => yL(f, x) + 0.002;
            const hm = tY(xm) - bY(xm), wM = (xb - xa) * f.chord;
            const r = holes ? 0.30 * Math.min(wM, Math.max(0, Math.min(tY(xa), tY(xb)) - Math.max(bY(xa), bY(xb)))) : 0;
            if (r < 0.012) {   // no hole: the cell's sheet, three columns so it follows the contour
              const col3 = [xa, xm, xb].map(x => [vtx(A, P(f, x, tY(x)), col), vtx(A, P(f, x, bY(x)), col)]);
              for (let q = 0; q < 2; q++) quad(A, m, col3[q][0], col3[q + 1][0], col3[q + 1][1], col3[q][1]);
              continue;
            }
            const ym = 0.5 * (tY(xm) + bY(xm)), inn = [], outr = [];
            for (let q = 0; q < Kq; q++) {
              const t = 2 * Math.PI * q / Kq, co = Math.cos(t), si = Math.sin(t), mx = Math.max(Math.abs(co), Math.abs(si));
              inn.push(vtx(A, P(f, xm + r * co / f.chord, ym + r * si), col));
              const s = co / mx, u = si / mx, x = xm + s * 0.5 * (xb - xa);
              outr.push(vtx(A, P(f, x, bY(x) + 0.5 * (u + 1) * (tY(x) - bY(x))), col));
            }
            for (let q = 0; q < Kq; q++) quad(A, m, outr[q], outr[(q + 1) % Kq], inn[(q + 1) % Kq], inn[q]);
            if (lip && !lod) {   // the flanged hole: a short collar across the plate
              const ring0 = [], ring1 = [];
              for (let q = 0; q < Kq; q++) { const t = 2 * Math.PI * q / Kq, pp = [xm + r * Math.cos(t) / f.chord, ym + r * Math.sin(t)];
                ring0.push(P(f, pp[0], pp[1])); ring1.push(add(P(f, pp[0], pp[1]), mul(f.lat, 0.007))); }
              sweep(A, [ring0, ring1], cn, false);
              // close the collar's seam
              const ids0 = ring0.map(p => vtx(A, p, col)), ids1 = ring1.map(p => vtx(A, p, col));
              quad(A, m, ids0[Kq - 1], ids1[Kq - 1], ids1[0], ids0[0]);
            }
          }
          if (flange) for (const upper of [true, false]) {   // the flange turned across the rib: one strip on the contour
            const pts = capPts(f, x0, x1, upper, lod ? 4 : 8), lw = mul(f.lat, 0.018);
            sweep(A, pts.map(q => { const c = P(f, q.x, q.y); return [c, add(c, lw)]; }), cn, false);
          }
        };
        // a truss rib's piece on [x0, x1]: the caps, uprights at its ends, Warren diagonals, gussets at the joints
        const truss = (f, x0, x1, cn, w, round, gus) => {
          if (x1 - x0 < 0.01) return;
          const nseg = lod ? 5 : 10, n = round ? (lod ? 4 : 6) : 0;
          cap(f, x0, x1, true, w, w, cn, Math.max(2, Math.round(nseg * (x1 - x0) / 0.6)));
          cap(f, x0, x1, false, w, w, cn, Math.max(2, Math.round(nseg * (x1 - x0) / 0.6)));
          const pM = Math.max(0.09, 1.2 * (top(f, x0, x1) - bot(f, x0, x1)));
          const nd = Math.max(1, Math.round((x1 - x0) * f.chord / pM));
          const T = x => yU(f, x) - w, B = x => yL(f, x) + w;
          for (const x of [x0 + 0.004, x1 - 0.004]) if (T(x) - B(x) > 0.02) member(f, x, B(x), x, T(x), 0.8 * w, cn, n);
          const js = [];
          for (let q = 0; q < nd; q++) {
            const xa = x0 + (x1 - x0) * q / nd, xb = x0 + (x1 - x0) * (q + 1) / nd, upA = q % 2 === 0;
            const ya = upA ? T(xa) : B(xa), yb = upA ? B(xb) : T(xb);
            if (Math.abs(ya - yb) > 0.015) member(f, xa, ya, xb, yb, 0.8 * w, cn, n);
            js.push([xb, yb]);
          }
          if (gus && !lod) for (const [x, y] of js.slice(0, -1)) {
            const c = add(P(f, x, y), mul(f.lat, 0.5 * w + 0.0012));
            disc(A, c, f.ch, f.up, 0.026, 0.017, gus, 8);
          }
        };
        const formed = (f, x0, x1, cn, w) => {   // the ultralight's bent outline, an upright at each spar
          cap(f, x0, x1, true, w, w, cn, lod ? 6 : 12); cap(f, x0, x1, false, w, w, cn, lod ? 6 : 12);
          for (const x of [sparF + 0.5 * sw + 0.01, sparR - 0.5 * rw - 0.01]) member(f, x, yL(f, x) + w, x, yU(f, x) - w, w, cn, lod ? 4 : 6);
        };
        // the chord pieces a rib is made of at a station: nose | between spars | aft (to the hinge or the edge) | the surface
        const ribAt = (z, special) => {
          const f = frameAt(z), b = bandAt(z);
          const xF0 = sparF - 0.5 * sw, xF1 = sparF + 0.5 * sw, xR0 = sparR - 0.5 * rw, xR1 = sparR + 0.5 * rw;
          const xEnd = b ? b.h - GAP : 0.985;
          const pieces = [[0.004, xF0], [xF1, Math.min(xR0, xEnd)], [xR1, xEnd]].filter(p => p[1] - p[0] > 0.01);
          if (b) pieces.push([b.h + GAP, 0.985]);
          const cn = special ? KD.rootC : KD.ribC;
          for (const [x0, x1] of pieces) {
            if (special) { plate(f, x0, x1, cn, KD.rib !== 'truss' || cn !== 'ply', METAL.has(cn), METAL.has(cn)); continue; }
            if (KD.rib === 'truss') truss(f, x0, x1, cn, KD.cap, false, KD.gusset);
            else if (KD.rib === 'tube') truss(f, x0, x1, cn, KD.cap, true, null);
            else if (KD.rib === 'stamped') truss(f, x0, x1, cn, KD.cap, false, null);
            else if (KD.rib === 'formed') { formed(f, x0, x1, cn, KD.cap); break; }
            else if (KD.rib === 'plate') plate(f, x0, x1, cn, true, true, true);
            else plate(f, x0, x1, cn, false, false, false);
          }
          if (KD.rib === 'formed' && !special && b) { /* the surface's piece drawn by formed's outline */ }
        };
        // the special ribs: the root, the strut's station, the crank, the ends of the controls, the tip
        const strutZ = fw.strutF != null ? Math.abs(N[fw.strutF].p[2]) : null;
        const specials = uniq([PP.zRoot, zS, ...(strutZ != null && strutZ < zS ? [strutZ] : []), ...(PP.zCrank > 0 ? [PP.zCrank] : [])]);
        const nearSpecial = z => specials.some(s => Math.abs(s - z) < 0.05);
        const ribsDrawn = [];
        if (KD.rib === 'sparse') {
          const zz = uniq([...specials, ...bands.flatMap(b => [b.z0, b.z1])]).filter(z => z >= PP.zRoot - 1e-6 && z <= zS + 1e-6);
          for (const z of zz) { ribAt(z, z === PP.zRoot); ribsDrawn.push(z); }
        } else {
          for (const z of ribZ) { ribAt(z, nearSpecial(z) && (z === PP.zRoot || KD.rib !== 'plate')); ribsDrawn.push(z); }
          // a station that is special but carries no rib of the 0.4 m rule (the strut's, off the pitch): its own
          for (const s of specials) if (!ribZ.some(z => Math.abs(z - s) < 0.05)) { ribAt(s, true); ribsDrawn.push(s); }
        }
        // nose ribs: between two main ribs, ahead of the front spar (the J-3's, the Jodel's false nose ribs)
        if (KD.noseRibs && !lod) for (let i = 0; i + 1 < ribZ.length; i++) {
          const z = 0.5 * (ribZ[i] + ribZ[i + 1]), f = frameAt(z);
          if (KD.rib === 'stamped') truss(f, 0.004, sparF - 0.5 * sw, KD.ribC, KD.cap, false, null);
          else { cap(f, 0.004, sparF - 0.5 * sw, true, KD.cap, KD.cap, KD.ribC, lod ? 4 : 7); cap(f, 0.004, sparF - 0.5 * sw, false, KD.cap, KD.cap, KD.ribC, lod ? 4 : 7); }
        }
        // ---- THE BAYS: compression struts at the spar stations, drag / anti-drag wires across each bay ----
        const bayZ = zAll.filter(z => z <= zS + 1e-6);
        if (KD.wires) {
          const xa = sparF + 0.5 * sw + 0.004, xb = sparR - 0.5 * rw - 0.004;
          const midY = (f, x) => 0.5 * (yU(f, x) + yL(f, x));
          for (let i = 0; i < bayZ.length; i++) {
            const f = frameAt(bayZ[i]);
            if (i > 0) { member(f, xa, midY(f, xa), xb, midY(f, xb), 0.016, KD.rib === 'tube' ? 'steel' : 'alu', lod ? 4 : 6);
              if (AU) AU.struts.push({ i, z: bayZ[i] }); }
            if (i + 1 < bayZ.length) {
              const g = frameAt(bayZ[i + 1]);
              const wire = (f1, x1, f2, x2, dy) => { const a = P(f1, x1, midY(f1, x1) + dy), b3 = P(f2, x2, midY(f2, x2) + dy);
                bar(A, a, b3, 0.004, 0.004, f1.up, 'wire', 0); if (AU) AU.wires.push({ i, a, b: b3, from: x1 < x2 ? 'F' : 'R' }); };
              wire(f, xa, g, xb, 0.006); wire(f, xb, g, xa, -0.006);
              pinfo.bays.push([bayZ[i], bayZ[i + 1]]);
            }
          }
        }
        // ---- THE STRINGERS (a stressed-skin wing): at the grammar's pitch, metres from the leading edge ----
        if (strPitch > 0) {
          const xBox = f => [(sparF + 0.5 * sw) + 0.01, (sparR - 0.5 * rw) - 0.01];
          const f0 = FR[0], f1 = FR[FR.length - 1];
          for (let j = 1; j * strPitch < 1.2 * f0.chord; j++) {
            const sC = j * strPitch;
            const okAt = f => { const [a, b] = xBox(f), x = sC / f.chord; return x > a && x < b; };
            const fr = FR.filter(okAt);
            if (fr.length < 2) continue;
            if (!okAt(f0) && !okAt(f1) && fr.length < 2) continue;
            for (const upper of [true, false]) {
              const s = upper ? -1 : 1;
              sweep(A, fr.map(f => { const x = sC / f.chord, y = upper ? yU(f, x) : yL(f, x);
                return [P(f, x - 0.008 / f.chord, y), P(f, x + 0.008 / f.chord, y), P(f, x + 0.008 / f.chord, y + s * 0.012)]; }), 'alu', false);
            }
            if (sd === 'R') pinfo.stringers.push(sC);
          }
        }
        // ---- THE FITTINGS: the root (both spars' attach plates), the lift strut's station ----
        {
          const f = frameAt(PP.zRoot + 0.07);
          for (const [xc, w] of [[sparF, sw], [sparR, rw]]) {
            const x0 = xc - 0.5 * w, x1 = xc + 0.5 * w, T = top(f, x0, x1) * 0.85, B = bot(f, x0, x1) * 0.85;
            for (const xe of [x0 - 0.004 / f.chord, x1 + 0.004 / f.chord]) {
              const a = frameAt(PP.zRoot), b2 = frameAt(PP.zRoot + 0.16);
              bar(A, P(a, xe, 0.5 * (T + B)), P(b2, xe, 0.5 * (T + B)), 0.004, Math.max(0.03, T - B), a.ch, 'fit', 0);
            }
          }
        }
        if (fw.strutF != null && strutZ != null) {
          const f = frameAt(Math.min(strutZ, zS));
          for (const [nd, xc, w] of [[fw.strutF, sparF, sw], [fw.strutR, sparR, rw]]) {
            if (nd == null) continue;
            const y = bot(f, xc - 0.5 * w, xc + 0.5 * w) - 0.002;
            bar(A, P(f, xc - 0.5 * w - 0.012 / f.chord, y), P(f, xc + 0.5 * w + 0.012 / f.chord, y), 0.07, 0.008, f.up, 'fit', 0);
            bar(A, P(f, xc, y), P(f, xc, y - 0.004), 0.012, 0.035, f.ch, 'fit', 0);   // the tang, to the skin
          }
          if (sd === 'R') pinfo.strut = { z: strutZ, front: fw.strutF, rear: fw.strutR };
        }
        // ---- THE TIP: the bow's outline (a tube at mid-depth, inside the covering's bow) ----
        if (W.tipR > 1e-6) {
          const f = frameAt(zS), n = lod ? 8 : 14, R = 0.85 * W.tipR, pts = [];
          for (let q = 0; q <= n; q++) {
            const t = Math.PI * q / n, x = 0.08 + 0.80 * (0.5 - 0.5 * Math.cos(t));
            const ym = 0.5 * (yU(f, x) + yL(f, x)) * (1 - 0.5 * Math.sin(t));
            pts.push(map(add(add(add(f.pF, mul(f.ch, (x - sparF) * f.chord)), mul(f.up, ym)), mul(f.lat, -side * 0 + 0))));
            // (the bow runs outboard along the span axis: placed below from the frame's own span direction)
            const sp = mul([0, 0, side], R * Math.sin(t));
            pts[pts.length - 1] = map(add(add(add(f.pF, mul(f.ch, (x - sparF) * f.chord)), mul(f.up, ym)), sp));
          }
          for (let q = 0; q + 1 < pts.length; q++) bar(A, pts[q], pts[q + 1], 0.014, 0.014, [0, 1, 0], KD.le || KD.ribC, lod ? 4 : 6);
        }
        const tris = (A.i[0].length + A.i[1].length) / 3;
        out.halves.push({ plane: k, side: sd, kind: K.key, A, tris, verts: A.n, ribs: ribsDrawn, audit: AU,
                          draws: (A.i[0].length ? 1 : 0) + (A.i[1].length ? 1 : 0) });
        pinfo.halves.push({ side: sd, tris, verts: A.n });
      }
    }
    return out;
  }

  // ---- THE MESHES: a half's arrays into one BufferGeometry, its two materials from the library ----
  const MATS = { 0: { roughness: 0.78, metalness: 0.03 }, 1: { roughness: 0.38, metalness: 0.85 } };
  function material(T, m) {
    const p = Object.assign({ vertexColors: true, flatShading: true, side: T.DoubleSide }, MATS[m]);
    const ML = (typeof window !== 'undefined' && window.MATLIB) || G.MATLIB;
    return ML.shared(T, 'std', p, 'wingStruct');
  }
  function make(T, half) {
    const A = half.A, g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(A.p, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(A.c, 3));
    const I = A.i[0].concat(A.i[1]);
    g.setIndex(A.n > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1));
    const mats = [];
    if (A.i[0].length) { g.addGroup(0, A.i[0].length, mats.length); mats.push(material(T, 0)); }
    if (A.i[1].length) { g.addGroup(A.i[0].length, A.i[1].length, mats.length); mats.push(material(T, 1)); }
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new T.Mesh(g, mats.length === 1 ? mats[0] : mats);
    m.name = 'wingStruct:' + half.plane + half.side;
    m.castShadow = false; m.receiveShadow = true;
    m.userData.wingStruct = { plane: half.plane, side: half.side, kind: half.kind, tris: half.tris };
    return m;
  }
  // a whole wing set as a group (every plane, both sides by default)
  function group(T, def, opts) {
    const pl = plan(def, opts), grp = new T.Group();
    grp.name = (opts && opts.name) || 'wingStruct';
    for (const h of pl.halves) if (h.A.n) grp.add(make(T, h));
    grp.userData.wingStruct = pl.info;
    return grp;
  }
  function dispose(o) {
    if (!o) return;
    if (o.parent) o.parent.remove(o);
    o.traverse(m => { if (m.geometry) m.geometry.dispose(); });   // (the materials are the library's, shared)
  }
  const api = { BUDGET, KINDS, COL, INSET, kindOf, plan, make, group, dispose };
  if (typeof window !== 'undefined') window.WING_STRUCT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---- THE GARAGE'S LAYER (the page only): `cageLayer:wingStruct`, built from the wing layer's own def ----
  // WHEN: the fiche's cutaway asks (show(true) .. show(false), plane_fiche.js cutOn / cutOff) or the garage's cutaway box
  // is on; never otherwise - nothing is built, nothing drawn (the see-inside view leaves the wing's covering opaque, so
  // the structure would stand unseen inside it). The wing layer publishes the def it lofted and the map its nodes take
  // to the cage (CAGE_WING.def / nodeCage), so the structure stands on the very spar stations the covering was lofted on.
  // NOT THE AEROPLANE: every mesh is an `edMarker` (the join's snapshot skips it, _cage_join.js) - the flown aeroplane
  // never carries it.
  // THE CUTAWAY BOX: the bench's page clips with a global renderer plane (_cage_ui.js); the game's garage has no such
  // renderer and clips the BUILD's materials (REF_MOUNT.setBuildClip, app.js: the plane remembered across rebuilds) -
  // cut(on) below. Either way the structure is drawn whole: each mesh, as it is drawn, wears one local plane that is
  // never negative under clipIntersection (onBeforeRender, so a walk that writes every build material - the build clip -
  // cannot take it away), and with local clipping on, a fragment is clipped only where EVERY plane says so: never.
  if (typeof window !== 'undefined' && window.CAGE_PAGE) {
    const L = { grp: null, scene: null, def: null, lc0: null, force: false, cut: false };
    const cutBox = () => { const e = typeof document !== 'undefined' && document.getElementById('cutaway'); return !!(e && e.checked); };
    const rendererOf = () => { try { return window.FLIGHT_PROBE && window.FLIGHT_PROBE.renderer ? window.FLIGHT_PROBE.renderer() : null; } catch (e) { return null; } };
    let IMMUNE = null;
    const immune = function (r, s, c, g, m) {   // onBeforeRender: this mesh's materials keep their never-negative plane
      const ms = Array.isArray(this.material) ? this.material : [this.material];
      for (const mt of ms) if (mt.clippingPlanes !== IMMUNE) { mt.clippingPlanes = IMMUNE; mt.clipIntersection = true; }
    };
    // the build's symmetry plane in the world, the cage's x < 0 half (the left wing) on its negative side
    function cutPlane(T) {
      const root = window.CAGE_UI_SCENE; if (!root) return null;
      root.updateMatrixWorld(true);
      const n = new T.Vector3(1, 0, 0).transformDirection(root.matrixWorld), o = new T.Vector3().setFromMatrixPosition(root.matrixWorld);
      return new T.Plane().setFromNormalAndCoplanarPoint(n, o);
    }
    function sync(scene) {
      const T = window.THREE, W = window.CAGE_WING;
      scene = scene || L.scene;
      const cut = cutBox();
      const want = !!(T && W && W.def && W.nodeCage && scene && (L.force || cut));
      const R = rendererOf();
      if (!want) {
        dispose(L.grp); L.grp = null; L.def = null;
        if (R && L.lc0 != null) { R.localClippingEnabled = L.lc0; L.lc0 = null; }
        return null;
      }
      if (!L.grp || L.def !== W.def || L.grp.parent !== scene) {
        dispose(L.grp);
        L.grp = group(T, W.def, { map: W.nodeCage, lod: 0, name: 'cageLayer:wingStruct' });
        if (!IMMUNE) IMMUNE = [new T.Plane(new T.Vector3(0, 1, 0), 1e6)];
        L.grp.traverse(o => { if (o.isMesh) { o.userData.edMarker = true; o.userData.wingStruct.layer = true; o.onBeforeRender = immune; } });
        L.def = W.def;
        scene.add(L.grp);
      }
      // the box's cut: the side it takes away shows its structure, the other keeps its covering (the fiche: both, its
      // own cutOn picks the near one)
      L.grp.updateMatrixWorld(true);
      const pl = cut ? ((R && R.clippingPlanes && R.clippingPlanes[0]) || cutPlane(T)) : null, c = new T.Vector3();
      for (const m of L.grp.children) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        c.copy(m.geometry.boundingSphere.center).applyMatrix4(m.matrixWorld);
        const gone = !!(pl && pl.distanceToPoint(c) < 0);
        m.userData.wingStruct.cut = gone;
        m.visible = L.force || gone;
      }
      if (R) { if (L.lc0 == null) L.lc0 = R.localClippingEnabled; R.localClippingEnabled = true; }
      return L.grp;
    }
    // NOT A LAYER OF THE POST CHAIN (_cage_chain.js holds its registrations to a fixed ORDER; one more would cost
    // every drag tick its plan): the wing layer calls this at the end of its own turn, as it calls the tip floats'
    // (_cage_wing.js PAGE.post), so the structure is the wing's - re-made when the wing is, kept when a plan skips it
    window.CAGE_WINGSTRUCT_DRAW = ctx => {
      L.scene = (ctx && ctx.scene) || L.scene;
      try { sync(L.scene); } catch (e) { console.error('wing structure:', e); }
    };
    const safe = f => (...a) => { try { return f(...a); } catch (e) { console.error('wing structure:', e); return null; } };
    window.CAGE_WINGSTRUCT = {
      sync: safe(() => sync()),
      // the fiche's cutaway: the layer up whatever the box says, and down again
      show: safe(on => { L.force = !!on; return sync(); }),
      // the game's garage cutaway (the box, _cage_ui.js, when its page has no renderer of its own): the build's
      // materials clipped at its symmetry plane, the left half away
      cut: safe(on => {
        const T = window.THREE, M = window.REF_MOUNT, R = rendererOf();
        if (!T || !M || !M.setBuildClip) return null;
        if (on) { const p = cutPlane(T); if (!p) return null; if (R) R.localClippingEnabled = true; M.setBuildClip([p]); L.cut = true; }
        else if (L.cut) { M.setBuildClip(null); L.cut = false; }
        return sync();
      }),
      layer: () => L.grp,
    };
  }
})();
