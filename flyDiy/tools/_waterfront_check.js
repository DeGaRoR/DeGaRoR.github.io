#!/usr/bin/env node
// GATE WATERFRONT (G3031) - the waterfront prototype's verdict, headless and
// quick (~1-2 s): tools/_waterfront_gen.js builds the user's two references and
// every row below is a number, not a picture.
//
//   node tools/_waterfront_check.js            -> the rows + the numbers
//   node tools/_waterfront_check.js --json     -> the numbers as JSON (the design note's table)
//
// THE CASES (futureDesigns/WATERFRONT-2026-10-12.md §6):
//   A  Metlakatla Boat Harbor's outer hook - the author's own polyline
//      (tools/metlakatla_author.py BREAKWATERS mk_bw_outer), root on the shore
//      fill, the round head at the entrance with its light; an armoured crest.
//   B  Walden Point's jetty - straight off reclaimed fill, a grassy crest track,
//      unequal slopes (1.6 / 1.4).
//   C  a Metlakatla main float - 110 m, fingers both sides at 9 m, a gangway to
//      the paved lot, boats in 3/4 of the slips.
// The seabed is the island's own law (28_island.js seaFloor: -5 m at the
// waterline to -14 m 500 m out) behind a riprap shore from a 3 m fill - the
// world has no bathymetry finer than that.
//
// ROWS
//   1  DETERMINISM: the same seed builds the same digest; another seed another.
//   2  THE MOUND: no NaN; the core's every face looks up (a height field, wound
//      outward); its toe sits ON the seabed (5 cm); the crest is flat at
//      crestH (1 mm) under the track; the head is ROUND - the waterline about
//      the end point is a circle of hw + crestH * slope (5 cm), each side its own slope.
//   3  THE ARMOUR: >= 80 % of the band (the waterline - band .. the crest) is under
//      a stone seen along its own up, in EVERY metre of height (no thinning down the
//      slope - the old kit's look); no stone floats or is swallowed (its centre
//      0.3-0.8 of its half-height off the surface along the normal); none on the
//      track; sizes within the spread.
//   4  THE FLOAT: every deck at the freeboard (1 mm); the fingers at the pitch on
//      both sides; every boat inside its slip, clear of the fingers, the main
//      float and the other boats (0.25 m), its waterline at the water; the share
//      of slips with a boat near the dial; the gangway lands on ground at
//      <= 1:3 (marina practice at low water).
//   5  THE BUDGET (the note's §5): Metlakatla's whole basin (both moles, four
//      main floats) from four viewpoints - triangles drawn and casting, the
//      draws once merged by material, GPU bytes; the build time is printed, not gated.
//   6  THE GROUND (src/core/27w_waterfront.js groundLines, through 27_premises.js's
//      own makeModifier): on the flanks the ground stands UNDER the drawn law and
//      within 0.35 m of it (no ground through the stones); on the crest 3 cm under
//      the track to 1 cm (the wheels meet what is drawn); past the toe untouched.
//   7  THE REVETMENT (case D, Metlakatla's lot edge on a natural beach): it builds,
//      its armour as row 3, the berm on the land side and the slope on the sea's,
//      its ground as row 6.
//   8  THE LOG BOOM (case E, Walden Point's): the logs end to end at the gap,
//      floating a tenth of their diameter under.
//   9  THE PIER (case F, a dogleg trestle to a T): one MARINE_GEN trestle item a
//      segment, in placeSite's own frame (the decks end on the line's corners, +z
//      the left normal), the head and the ladder on the last, every parameter one
//      MARINE_GEN reads.
//  10  THE FOOTPRINTS hold every stone, finger and boat; issues() passes the cases
//      and names the broken ones.
'use strict';
const path = require('path');
const WG = require(path.join(__dirname, '_waterfront_gen.js'));
const JSON_OUT = process.argv.includes('--json');

let fails = 0, rows = 0;
const check = (ok, label, detail) => { rows++; if (!ok) fails++; if (!JSON_OUT) console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? '  - ' + detail : '')); };
const f2 = v => (Math.round(v * 100) / 100).toString();

// ---- the seabed: a 3 m fill whose riprap face runs 1:1.5 down to the -5 m shelf, then the island's shelf
function shoreBed(shoreZ, landSign) {
  // landSign +1: the land is at z > shoreZ
  return (x, z) => {
    const d = (z - shoreZ) * landSign;           // + inland
    if (d >= 0) return 3.0;
    const face = 3.0 + d / 1.5;                  // the riprap face
    const shelf = -5 - 9 * Math.min(1, Math.max(0, -d / 500));
    return Math.max(face, shelf);
  };
}
const SHORE_MET = -8690;                         // Metlakatla's harbour front (game z), land to the south (+z)
const bedMet = shoreBed(SHORE_MET, 1);

// A: the outer hook, root first (the author's list runs head -> root)
const OUTER = [[-4004, -8912], [-4048, -8864], [-4070, -8837], [-4086, -8801], [-4086, -8760], [-4070, -8719], [-4030, -8682]].reverse();
const A_P = { crest: 8, crestH: 4.0, slopeL: 1.5, slopeR: 1.5, block: 1.8, head: 'round', track: 0, light: 1, seed: 11 };
// B: Walden Point's jetty, straight out from fill, a grassy track
const SHORE_WAL = 0;
const bedWal = shoreBed(SHORE_WAL, 1);
const JETTY = [[0, 10], [0, -150]];
const B_P = { crest: 12, crestH: 3.6, slopeL: 1.6, slopeR: 1.4, block: 1.4, track: 6, trackLook: 'grass', light: 0, seed: 5 };
// C: a main float in the basin, 110 m north (-z) from 12 m off the lot's edge
const MAIN = [[-3905, SHORE_MET - 12], [-3905, SHORE_MET - 122]];
const C_P = { w: 2.6, freeboard: 0.5, fingers: 'both', pitch: 9, fingerL: 10, fingerW: 1.0, boats: 0.75, seed: 7 };

const t0 = Date.now();
const A = WG.breakwater(OUTER, A_P, { waterY: 0, bed: bedMet });
const tA = Date.now() - t0;
const t1 = Date.now();
const B = WG.breakwater(JETTY, B_P, { waterY: 0, bed: bedWal });
const tB = Date.now() - t1;
const t2 = Date.now();
const C = WG.floatDock(MAIN, C_P, { waterY: 0, bed: bedMet });
const tC = Date.now() - t2;

// ---- 1 DETERMINISM
{
  const a2 = WG.breakwater(OUTER, A_P, { waterY: 0, bed: bedMet });
  const a3 = WG.breakwater(OUTER, Object.assign({}, A_P, { seed: 12 }), { waterY: 0, bed: bedMet });
  const c2 = WG.floatDock(MAIN, C_P, { waterY: 0, bed: bedMet });
  const dA = WG.digest(A), dA2 = WG.digest(a2), dA3 = WG.digest(a3), dC = WG.digest(C), dC2 = WG.digest(c2);
  check(dA === dA2 && dC === dC2, '1a the same seed builds the same thing', 'A ' + dA + ' / ' + dA2 + ', C ' + dC + ' / ' + dC2);
  check(dA !== dA3, '1b another seed builds another armour', dA + ' vs ' + dA3);
}

// ---- 2 THE MOUND
function mound(tag, X, pts) {
  const core = X.meshes.core, p = core.pos, I = core.idx;
  let nan = 0; for (const v of p) if (!isFinite(v)) nan++;
  for (const k in X.batches) for (const v of X.batches[k].inst.mat) if (!isFinite(v)) nan++;
  check(nan === 0, '2a ' + tag + ' no NaN', nan + ' non-finite');
  let down = 0;
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    const ny = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
    const area2 = Math.hypot((p[b + 1] - p[a + 1]) * (p[c + 2] - p[a + 2]) - (p[b + 2] - p[a + 2]) * (p[c + 1] - p[a + 1]), ny, (p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a]));
    if (area2 > 1e-6 && ny < -1e-9) down++;
  }
  check(down === 0, '2b ' + tag + ' the core is wound to face up', down + ' of ' + I.length / 3 + ' faces down');
  // the toe on the bed: every vertex either on the mound law or on the bed, and the outermost ring on the bed
  let worst = 0;
  for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1], z = p[i + 2]; worst = Math.max(worst, Math.abs(y - X.H(x, z))); }
  let toeOff = 0, toes = 0;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2]; const c = WG.closest(X.PL, x, z);
    if (c.d > X.hw + 0.5 && X.M(x, z) <= X.bed(x, z) + 1e-6) { toes++; toeOff = Math.max(toeOff, Math.abs(p[i + 1] - X.bed(x, z))); }
  }
  check(worst < 1e-6 && toes > 0 && toeOff < 0.05, '2c ' + tag + ' the mound meets the seabed at its toe', toes + ' toe vertices, off the bed by ' + f2(toeOff * 100) + ' cm; off the law ' + worst.toExponential(1));
  // the crest along the axis
  let crestOff = 0;
  for (let s = 2; s < X.PL.len - X.hw; s += 3) { const f = WG.at(X.PL, s); if (X.bed(f.x, f.z) < X.top) crestOff = Math.max(crestOff, Math.abs(X.H(f.x, f.z) - X.top)); }
  check(crestOff < 1e-3, '2d ' + tag + ' the crest is flat at crestH', 'off by ' + f2(crestOff * 1000) + ' mm at ' + f2(X.P.crestH) + ' m');
  // the head
  const e = WG.at(X.PL, X.PL.len);
  {
    const want = X.hw + X.P.crestH * X.P.slopeL;
    let off = 0;
    for (let k = -3; k <= 3; k++) {
      const ph = k * Math.PI / 7, dx = e.tx * Math.cos(ph) + e.nx * Math.sin(ph), dz = e.tz * Math.cos(ph) + e.nz * Math.sin(ph);
      const sl = k >= 0 ? X.P.slopeL : X.P.slopeR, w = X.hw + X.P.crestH * (k === 0 ? X.P.slopeL : sl);
      let r0 = 0, r1 = w * 2;
      for (let it = 0; it < 40; it++) { const m = (r0 + r1) / 2; if (X.H(e.x + dx * m, e.z + dz * m) > X.wy) r0 = m; else r1 = m; }
      off = Math.max(off, Math.abs(r0 - w));
    }
    check(off < 0.05, '2e ' + tag + ' the head is round', 'the waterline about the end point: r = ' + f2(want) + ' m, off by ' + f2(off * 100) + ' cm over 7 rays');
  }
  void pts;
}
mound('A', A, OUTER);
mound('B', B, JETTY);

// ---- 3 THE ARMOUR
function armour(tag, X) {
  const S = X.batches.stone.inst, n = S.n, m = S.mat;
  // each stone: centre, axes, scale
  const st = [];
  for (let i = 0; i < n; i++) {
    const o = i * 16, ax = [m[o], m[o + 1], m[o + 2]], ay = [m[o + 4], m[o + 5], m[o + 6]], az = [m[o + 8], m[o + 9], m[o + 10]];
    const sx = Math.hypot(...ax), sy = Math.hypot(...ay), sz = Math.hypot(...az);
    st.push({ c: [m[o + 12], m[o + 13], m[o + 14]], X: ax.map(v => v / sx), Y: ay.map(v => v / sy), Z: az.map(v => v / sz), sx, sy, sz, r: S.r[i] });
  }
  const cell = X.P.block * 2, grid = new Map(), key = (i, j) => i + ',' + j;
  for (const s of st) { const k = key(Math.floor(s.c[0] / cell), Math.floor(s.c[2] / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
  const under = (x, y, z) => {
    const gi = Math.floor(x / cell), gj = Math.floor(z / cell);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const L = grid.get(key(gi + di, gj + dj)); if (!L) continue;
      for (const s of L) {
        const d = [x - s.c[0], y - s.c[1], z - s.c[2]];
        const lx = (d[0] * s.X[0] + d[1] * s.X[1] + d[2] * s.X[2]) / s.sx, ly = (d[0] * s.Y[0] + d[1] * s.Y[1] + d[2] * s.Y[2]) / s.sy, lz = (d[0] * s.Z[0] + d[1] * s.Z[1] + d[2] * s.Z[2]) / s.sz;
        if (lx * lx + lz * lz <= 0.85 * 0.85 && Math.abs(ly) <= 2.0) return true;
      }
    }
    return false;
  };
  // sample the band uniformly on the mound law (a fine lattice about the line), in 1 m height bins
  const bins = new Map(); let inT = 0, cov = 0;
  const trackHalf = X.kind === 'breakwater' && X.P.track > 0 ? Math.min(X.P.track, X.P.crest - 0.6) / 2 : -1;
  const ext = X.hw + (X.P.crestH + 20) * Math.max(X.Md.S.sL, X.Md.S.sR) + (X.Md.S.hwL + X.Md.S.hwR);
  const bb = X.PL.pts.reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  for (let x = bb[0] - ext; x <= bb[2] + ext; x += 0.7) for (let z = bb[1] - ext; z <= bb[3] + ext; z += 0.7) {
    const y = X.H(x, z);
    if (y < X.wy - X.P.band + 0.15 || X.bed(x, z) >= y - 0.05) continue;
    if (trackHalf > 0 && y > X.top - 0.01) { const q = WG.closest(X.PL, x, z); if (q.d < trackHalf + 0.6 && q.s < X.PL.len - X.hw * 0.6) continue; }
    const b = Math.floor(y - X.wy); const e = bins.get(b) || [0, 0];
    const u = under(x, y, z); e[0]++; if (u) e[1]++; bins.set(b, e); inT++; if (u) cov++;
  }
  const share = cov / inT;
  const binTxt = [...bins.keys()].sort((a, b) => a - b).map(b => { const e = bins.get(b); return b + 'm ' + Math.round(100 * e[1] / e[0]) + '%'; }).join(', ');
  const minBin = Math.min(...[...bins.values()].filter(e => e[0] > 40).map(e => e[1] / e[0]));
  check(share >= 0.8 && minBin >= 0.75, '3a ' + tag + ' the band is under stone, at every height', Math.round(share * 100) + ' % of ' + inT + ' samples; by height ' + binTxt);
  // seated: the centre's height off the surface along the normal, as a share of its half-height
  let bad = 0, lo = 1e9, hi = -1e9;
  for (const s of st) {
    const e = 0.25, gx = (X.H(s.c[0] + e, s.c[2]) - X.H(s.c[0] - e, s.c[2])) / (2 * e), gz = (X.H(s.c[0], s.c[2] + e) - X.H(s.c[0], s.c[2] - e)) / (2 * e);
    const ny = 1 / Math.hypot(gx, 1, gz);
    const dn = (s.c[1] - X.H(s.c[0], s.c[2])) * ny / s.sy;
    lo = Math.min(lo, dn); hi = Math.max(hi, dn);
    if (!(dn >= 0.3 && dn <= 0.8)) bad++;
  }
  check(bad <= n * 0.02, '3b ' + tag + ' no stone floats or is swallowed', bad + ' of ' + n + ' outside 0.3-0.8 of their half-height (range ' + f2(lo) + '..' + f2(hi) + '; a bend\'s inside reads lower)');
  if (trackHalf > 0) {
    let on = 0; for (const s of st) { const q = WG.closest(X.PL, s.c[0], s.c[2]); if (q.d < trackHalf - 0.2 && s.c[1] > X.top - 0.3 && q.s < X.PL.len - X.hw) on++; }
    check(on === 0, '3c ' + tag + ' the crest track is clear of stone', on + ' stones on a ' + f2(trackHalf * 2) + ' m track');
  }
  const rm = X.P.block / 2, prim = st.filter((s, i) => !S.chink[i]).map(s => s.r), ch = st.filter((s, i) => S.chink[i]).map(s => s.r);
  const pmin = Math.min(...prim), pmax = Math.max(...prim), cmin = ch.length ? Math.min(...ch) : rm * 0.45, cmax = ch.length ? Math.max(...ch) : rm * 0.7;
  check(pmin >= rm * (1 - X.P.blockVar) - 1e-6 && pmax <= rm * (1 + X.P.blockVar) + 1e-6 && cmin >= rm * 0.45 - 1e-6 && cmax <= rm * 0.7 + 1e-6, '3d ' + tag + ' stone sizes within the spread',
    prim.length + ' primary r ' + f2(pmin) + '..' + f2(pmax) + ' m about ' + f2(rm) + ', ' + ch.length + ' chinking r ' + f2(cmin) + '..' + f2(cmax) + ' m');
  return { share, minBin };
}
const covA = armour('A', A), covB = armour('B', B);

// ---- 4 THE FLOAT
{
  const y = C.y;
  const dOff = Math.max(...C.decks.map(d => Math.abs(d.y - (C.wy + C_P.freeboard))));
  check(dOff < 1e-3, '4a every deck at the freeboard', C.decks.length + ' deck slabs, off by ' + f2(dOff * 1000) + ' mm at ' + C_P.freeboard + ' m');
  const nSide = s => C.fingers.filter(f => f.side === s).length;
  const want = Math.floor((C.PL.len - C.P.fingerW - C.P.fingerStart) / C.P.pitch) + 1;
  const pit = C.fingers.filter(f => f.side === 1).map(f => f.s).sort((a, b) => a - b);
  let pitOff = 0; for (let i = 1; i < pit.length; i++) pitOff = Math.max(pitOff, Math.abs(pit[i] - pit[i - 1] - C_P.pitch));
  check(nSide(1) === want && nSide(-1) === want && pitOff < 1e-6, '4b fingers both sides at the pitch', nSide(1) + ' + ' + nSide(-1) + ' fingers (want ' + want + ' a side), pitch off ' + pitOff.toExponential(1));
  // rectangles in plan: [cx, cz, ux, uz, hu, hw]
  const rects = C.decks.map(d => [d.x, d.z, d.ux, d.uz, d.hu, d.hw]);
  const boatRect = b => [b.x, b.z, b.X[0], b.X[2], b.L / 2, b.B / 2];
  const sep = (A, B, gap) => {      // separating axis for two oriented rectangles, with a clearance
    const ax = [[A[2], A[3]], [-A[3], A[2]], [B[2], B[3]], [-B[3], B[2]]];
    const half = (R, a) => Math.abs(R[4] * (R[2] * a[0] + R[3] * a[1])) + Math.abs(R[5] * (-R[3] * a[0] + R[2] * a[1]));
    for (const a of ax) { const d = Math.abs((B[0] - A[0]) * a[0] + (B[1] - A[1]) * a[1]); if (d > half(A, a) + half(B, a) + gap) return true; }
    return false;
  };
  let hit = 0, hitB = 0;
  for (const b of C.boats) { const R = boatRect(b); for (const r of rects) if (!sep(R, r, 0.25)) hit++; }
  for (let i = 0; i < C.boats.length; i++) for (let j = i + 1; j < C.boats.length; j++) if (!sep(boatRect(C.boats[i]), boatRect(C.boats[j]), 0.25)) hitB++;
  check(hit === 0 && hitB === 0, '4c every boat clear in its slip', C.boats.length + ' boats; ' + hit + ' touch a float, ' + hitB + ' touch a boat (0.25 m)');
  let wl = 0; for (let i = 0; i < C.batches.boat.inst.n; i++) wl = Math.max(wl, Math.abs(C.batches.boat.inst.mat[i * 16 + 13] - C.wy));
  check(wl < 1e-6, '4d the boats float at the water', 'waterline off ' + wl.toExponential(1));
  const share = C.boats.length / C.slips.length;
  check(Math.abs(share - C_P.boats) <= 0.15, '4e the slips are filled as the dial says', C.boats.length + ' of ' + C.slips.length + ' slips (' + Math.round(share * 100) + ' %, dial ' + Math.round(C_P.boats * 100) + ' %); ' + Object.entries(C.boats.reduce((o, b) => (o[b.type] = (o[b.type] || 0) + 1, o), {})).map(e => e.join(' ')).join(', '));
  const g = C.gang;
  check(g && g.slope <= 1 / 3 && bedMet(g.x0, g.z0) >= C.P.abut - 0.4 - 1e-6, '4f the gangway lands on the lot at <= 1:3', g ? ('run ' + f2(g.run) + ' m, ' + f2(g.y0) + ' -> ' + f2(g.y1) + ' m, 1:' + f2(1 / g.slope)) : 'none');
  void y;
}

// ---- 6 THE GROUND THE WORLD GETS: the law's stack of abs grade lines through the composer's own makeModifier
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const LAW = WG.LAW;
function groundOf(e, bed) {
  const specs = LAW.groundLines(e, bed, { waterY: 0 });
  const mods = specs.map(m => PG.makeModifier(m, 0));
  return { specs, T: (x, z) => mods.reduce((h, m) => m.apply(x, z, h), bed(x, z)) };
}
function ground(tag, X, e) {
  const G = groundOf(e, X.bed);
  const bb = X.PL.pts.reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const ext = 50;
  let n = 0, above = 0, below = 0, worstUp = -1e9, worstDn = 1e9, far = 0, farOff = 0;
  for (let x = bb[0] - ext; x <= bb[2] + ext; x += 0.9) for (let z = bb[1] - ext; z <= bb[3] + ext; z += 0.9) {
    const law = X.H(x, z), b = X.bed(x, z), t = G.T(x, z), m = X.M(x, z);
    if (m > b + 0.3 && m < X.top - 0.05) {           // the flank band, clear of the toe's blend and the crest's edge
      n++; const d = t - law; worstUp = Math.max(worstUp, d); worstDn = Math.min(worstDn, d);
      if (d > 0.0) above++; if (d < -0.35) below++;
    } else if (m < b - 4) { far++; farOff = Math.max(farOff, Math.abs(t - b)); }
  }
  check(n > 500 && above === 0 && below <= n * 0.01, '6a ' + tag + ' the ground under the drawn mound on its flanks', G.specs.length + ' grade lines; ' + n + ' flank samples: ground - law ' + f2(worstDn) + '..' + f2(worstUp) + ' m (' + above + ' above, ' + below + ' deeper than 0.35)');
  let crest = 0, cn = 0;
  if (X.kind === 'breakwater') {
    for (let s = 2; s < X.PL.len - X.hw * 1.5; s += 3) { const f = WG.at(X.PL, s); if (X.bed(f.x, f.z) < X.top - 0.5) { cn++; crest = Math.max(crest, Math.abs(G.T(f.x, f.z) - (X.top - 0.03))); } }
    check(cn > 10 && crest < 0.01, '6b ' + tag + ' the wheels meet the crest 3 cm under the drawn track', cn + ' stations, off by ' + f2(crest * 1000) + ' mm');
  }
  check(far > 100 && farOff < 1e-9, '6c ' + tag + ' the bed past the toe is untouched', far + ' samples, moved by ' + farOff.toExponential(1) + ' m');
  return G;
}
ground('A', A, { id: 'fA', kind: 'breakwater', pts: OUTER, P: A_P });
ground('B', B, { id: 'fB', kind: 'breakwater', pts: JETTY, P: B_P });

// ---- 7 THE REVETMENT: Metlakatla's lot edge as riprap on a natural beach (land at 1.5 m, 1:10 to the shelf)
const bedBeach = (x, z) => { const d = z - SHORE_MET; return d >= 0 ? 1.5 + d * 0.02 : Math.max(1.5 + d / 10, -5 - 9 * Math.min(1, -d / 500)); };
// travel +x: the left normal is +z, the land; the sea on the right (water: -1)
const SHOREL = [[-4040, SHORE_MET], [-3990, SHORE_MET + 1], [-3940, SHORE_MET]];
const D_P = { crestH: 3.0, slope: 1.5, block: 1.2, berm: 2.0, water: -1, seed: 4 };
const D = WG.revetment(SHOREL, D_P, { waterY: 0, bed: bedBeach, water: -1 });
{
  let nan = 0; for (const v of D.meshes.core.pos) if (!isFinite(v)) nan++;
  check(nan === 0 && D.stats.stones > 100, '7a D the revetment builds', D.stats.stones + ' stones over ' + f2(D.stats.len) + ' m, ' + nan + ' NaN');
  armour('D', D);
  const f = WG.at(D.PL, D.PL.len / 2);
  const land = [f.x + f.nx * 6, f.z + f.nz * 6], sea = [f.x - f.nx * 3, f.z - f.nz * 3];
  const hl = D.H(land[0], land[1]), hs = D.H(sea[0], sea[1]), hb = D.H(f.x + f.nx * 1, f.z + f.nz * 1);
  check(Math.abs(hl - bedBeach(land[0], land[1])) < 1e-9 && Math.abs(hb - D.top) < 1e-9 && hs < D.top - 1.5,
    '7b D the berm on the land side, the slope on the sea side', 'crest ' + f2(D.top) + ' m to 2 m inland; 6 m inland the beach (' + f2(hl) + '); 3 m seaward ' + f2(hs) + ' m');
  ground('D', D, { id: 'fD', kind: 'revetment', pts: SHOREL, P: D_P });
}

// ---- 8 THE LOG BOOM: Walden Point's, from off the jetty's head along the basin
const BOOMPTS = [[30, -60], [40, -140], [58, -205]];
const E = WG.boom(BOOMPTS, { logD: 0.55, logL: 10, gap: 0.6 }, { waterY: 0 });
{
  const want = WG.line(BOOMPTS).segs.reduce((t, g) => t + Math.max(1, Math.round(g.L / 10.6)), 0);
  const fl = Math.max(...E.logs.map(l => Math.abs(l.mat[13] - (0 - 0.055))));
  let gapOff = 0;
  for (let i = 0; i + 1 < E.logs.length; i++) {
    const a = E.logs[i], b = E.logs[i + 1], d = Math.hypot(b.x - a.x, b.z - a.z) - (a.L + b.L) / 2;
    if (d < 2) gapOff = Math.max(gapOff, Math.abs(d - 0.6));
  }
  check(E.logs.length === want && fl < 1e-6 && gapOff < 0.12, '8a the boom floats end to end', E.logs.length + ' logs (want ' + want + '), centre 0.1 D under the water (off ' + fl.toExponential(1) + '), gaps off 0.6 m by <= ' + f2(gapOff) + ' m; ' + E.stats.tris0 + ' tris');
}

// ---- 9 THE PIER: a dogleg trestle to a T, expanded to MARINE_GEN items in placeSite's own frame
const PIERPTS = [[60, 5], [60, -60], [92, -96]];
const F_E = { id: 'f9', kind: 'pier', pts: PIERPTS, P: { w: 3.2, head: 1, headL: 12, headW: 16 } };
{
  const sites = LAW.pierSites(F_E), PL = WG.line(PIERPTS);
  let off = 0, left = 0;
  sites.forEach((st, i) => {
    const it = st.items[0], psi = st.at.yaw + Math.PI + it.yaw, cy = Math.cos(psi), sy = Math.sin(psi);
    const toW = (lx, lz) => [st.at.x + lx * cy + lz * sy, st.at.z - lx * sy + lz * cy];
    const g = PL.segs[i], ext0 = i > 0 ? it.P.w / 2 : 0, ext1 = i < sites.length - 1 ? it.P.w / 2 : 0;
    const a = toW(-it.P.L / 2 + ext0, 0), b = toW(it.P.L / 2 - ext1, 0);
    off = Math.max(off, Math.hypot(a[0] - g.a[0], a[1] - g.a[1]), Math.hypot(b[0] - g.b[0], b[1] - g.b[1]));
    const zz = toW(0, 1); left = Math.max(left, Math.abs((zz[0] - st.at.x) - (-g.tz)) + Math.abs((zz[1] - st.at.z) - g.tx));
  });
  check(sites.length === 2 && off < 1e-6 && left < 1e-9, "9a each segment a trestle item, in placeSite's frame", sites.length + " items; their decks end on the line's corners (off " + off.toExponential(1) + ' m); +z is the left normal (off ' + left.toExponential(1) + ')');
  const heads = sites.map(st => st.items[0].P.head), lad = sites.map(st => st.items[0].P.ladder);
  check(heads[0] === 0 && heads[1] === 1 && lad[0] === 0, '9b the T head and the ladder on the last segment only', 'heads ' + heads.join(',') + ', ladders ' + lad.join(','));
  const mg = require('fs').readFileSync(path.join(__dirname, '_marine_gen.js'), 'utf8');
  const d0 = mg.indexOf('const DEF = {'), defTxt = mg.slice(d0, mg.indexOf('};', d0));
  const unknown = Object.keys(sites[0].items[0].P).filter(k => !new RegExp('\\b' + k + ':').test(defTxt));
  check(unknown.length === 0, '9c every parameter handed over is one MARINE_GEN reads', unknown.length ? 'unknown: ' + unknown.join(', ') : Object.keys(sites[0].items[0].P).length + ' parameters, all in its DEF');
}

// ---- 10 THE FOOTPRINTS: what keeps the plots, the trees and the surface out holds every stone, finger and boat
{
  const inPoly = (poly, x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const fpA = LAW.footprint({ kind: 'breakwater', pts: OUTER, P: A_P }, { waterY: 0 }), IA = A.batches.stone.inst;
  let oA = 0; for (let i = 0; i < IA.n; i++) if (!inPoly(fpA, IA.mat[i * 16 + 12], IA.mat[i * 16 + 14])) oA++;
  const fpC = LAW.footprint({ kind: 'float', pts: MAIN, P: C_P }, {});
  let oC = 0; for (const q of C.fingers.concat(C.boats)) if (!inPoly(fpC, q.x, q.z)) oC++;
  check(oA === 0 && oC === 0, '10a the footprints hold what is built', 'A: ' + oA + ' of ' + IA.n + ' stones outside its ' + fpA.length + '-gon; C: ' + oC + ' of ' + (C.fingers.length + C.boats.length) + ' fingers + boats outside');
  const iss = LAW.issues([{ id: 'f1', kind: 'breakwater', pts: OUTER, P: A_P }, { id: 'f2', kind: 'float', pts: MAIN, P: C_P }, { id: 'f3', kind: 'pier', pts: PIERPTS, P: {} }]);
  const bad = LAW.issues([{ id: 'f1', kind: 'jetty', pts: [[0, 0]] }, { id: 'f1', kind: 'float', pts: [[0, 0], [9, 0]], P: { pitch: 1 } }]);
  check(iss.length === 0 && bad.length >= 3, '10b issues(): the cases pass, the broken ones are named', iss.length + ' on the cases; ' + bad.length + ' on the broken: ' + bad.join('; '));
}

const per100 = (X, k) => X.stats[k] * 100 / X.stats.len;
// ---- 5 THE BUDGET: Metlakatla's whole basin (both moles, four main floats) from four places
// The caps are the note's §5: what one harbour may cost in a frame on the preset
// (stable 30), before the GPU slot that times it.
const BUDGET = { tris: 150000, cast: 100000, draws: 12, mb: 8 };
const NE = [[-3989, -8814], [-3920, -8868], [-3866, -8910], [-3825, -8873], [-3793, -8837], [-3761, -8792], [-3725, -8714]].reverse();
const t3 = Date.now();
const basin = [A, WG.breakwater(NE, Object.assign({}, A_P, { seed: 12, light: 1 }), { waterY: 0, bed: bedMet }), C];
for (const [x, L, sd] of [[-3950, 95, 8], [-3860, 100, 9], [-3815, 85, 10]]) basin.push(WG.floatDock([[x, SHORE_MET - 12], [x, SHORE_MET - 12 - L]], Object.assign({}, C_P, { seed: sd }), { waterY: 0, bed: bedMet }));
const tBasin = Date.now() - t3 + tA + tC;
const VIEWS = [
  ['the lot by the harbour master', [-3880, 4.7, -8680]],
  ['the crest of the outer mole', [-4086, 5.7, -8780]],
  ['a seaplane taxiing in the basin', [-3930, 1.6, -8840]],
  ['the approach, 600 m out, 150 m up', [-3900, 150, -9400]],
];
const mergeDraws = 6;   // in the game the basin's batches + merged meshes share materials: stone, core, track, timber, steel, boats
const views = [];
for (const [name, cam] of VIEWS) {
  const v = { tris: 0, cast: 0, draws: 0, inst: [0, 0, 0, 0], back: 0 };
  for (const X of basin) { const c = WG.viewCost(X, cam); v.tris += c.tris; v.cast += c.cast; v.draws += c.draws; v.back += c.back; for (let r = 0; r < 4; r++) v.inst[r] += c.inst[r]; }
  views.push(Object.assign({ name }, v));
}
const bytes = basin.reduce((t, X) => t + X.stats.bytes, 0);
for (const v of views) check(v.tris <= BUDGET.tris && v.cast <= BUDGET.cast, '5a the basin from ' + v.name + ' within the frame budget',
  Math.round(v.tris / 1000) + 'k tris (cap ' + BUDGET.tris / 1000 + 'k), ' + Math.round(v.cast / 1000) + 'k casting (cap ' + BUDGET.cast / 1000 + 'k); stones+boats by rung ' + v.inst.join(' / ') + ' (last = past the rings), ' + v.back + ' on the back flank');
const featDraws = basin.reduce((t, X) => t + X.stats.draws, 0);
check(mergeDraws <= BUDGET.draws && bytes / 1048576 <= BUDGET.mb, '5b the draws and the memory of the basin',
  featDraws + ' draws built feature by feature -> ' + mergeDraws + ' once merged by material (cap ' + BUDGET.draws + '); ' + (bytes / 1048576).toFixed(2) + ' MB on the GPU (cap ' + BUDGET.mb + ')');
for (const [tag, X] of [['A', A], ['B', B], ['C', C]]) if (!JSON_OUT) console.log('     ' + tag + ' ' + X.kind + ': ' + f2(X.stats.len) + ' m' + (X.stats.stones ? ', ' + X.stats.stones + ' stones (' + X.stats.chinks + ' chinking; ' + Math.round(X.stats.stones * 100 / X.stats.len) + ' /100 m)' : ', ' + X.stats.fingers + ' fingers, ' + X.stats.boats + ' boats') + '; all-LOD0 ' + Math.round(per100(X, 'tris0')) + ' tris /100 m, core/deck ' + Math.round(per100(X, 'trisFar')));
const N = {
  A: Object.assign({}, A.stats, { per: undefined, ms: tA, cover: covA }), B: Object.assign({}, B.stats, { per: undefined, ms: tB, cover: covB }),
  C: Object.assign({}, C.stats, { per: C.stats.per, ms: tC, gang: C.gang }), budget: BUDGET, views, basinMB: bytes / 1048576, basinMs: tBasin,
};
if (JSON_OUT) console.log(JSON.stringify(N, null, 1));
else console.log('build ms: A ' + tA + ', B ' + tB + ', C ' + tC + ', the whole basin ' + tBasin + ' (node, one core, not gated)');
if (!JSON_OUT) console.log('GATE WATERFRONT: ' + (fails ? 'FAIL (' + fails + ' of ' + rows + ')' : 'PASS (' + rows + ' rows)'));
process.exit(fails ? 1 : 0);
