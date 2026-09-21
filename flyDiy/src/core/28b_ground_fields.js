// ===========================================================================
// GROUND FIELDS — the micro-variation inside ONE terrain type, shared by the
// ground (the splat, per fragment) and the vegetation (per instance, at
// plant time). 2026-09-20, the user: "the grass needs variation of shades,
// the muskeg slight variations plus procedural puddles ... what would allow
// us to automatically color grass" — the blades and the ground under them
// must read the SAME fields, or a tuft stands on a colour it does not have.
// ===========================================================================
// One primitive, three fields, one table of constants, and the SAME source
// twice: the JS below and the GLSL string `GROUND_FIELDS.glsl` are the same
// functions line for line, hashed on 32-bit integers so a CPU sample and a
// GPU sample of the same point give the same number (uint arithmetic in ES
// 3.00 wraps mod 2^32; JS uses |0 and Math.imul for the same bits).
//
//   hash2(ix, iz)                   0..1, the integer hash (the vegetation's)
//   vnoiseT(u, w, N)                tileable value noise, u,w in [0,1) over
//                                   ONE period, N cells, smoothstep bilinear
//   poolAt(x, z, wet, edge)         0 = peat, 1 = open water; the puddles.
//                                   period POOL.period (400 m), three octaves,
//                                   threshold 0.66 - 0.30*wet (muskeg wet 0.45);
//                                   `edge` half-width in noise units - the
//                                   vegetation's 0.035 is a 15 m fade, the
//                                   ground's default is 0.01 (water is a line)
//   mixK(x, z, period, bias, sharp) 0..1, the cloud mask that picks the SECOND
//                                   of a code's two sets: two reads of a four-
//                                   octave fbm, the second rotated + scaled
//                                   (one read tiled as a polka-dot grid)
//   blotch(x, z, seed)              0..1, per cover species: the fraction of
//                                   its tufts kept here (WHICH grass drifts by
//                                   area, not its colour)
//   shade(x, z, cell)               { hue: -1..1, value: -1..1 } the colour
//                                   swing field; a code scales it by its own
//                                   amplitudes (the bench's `vary`)
//   hueTurn(rgb, a)                 the colour turned about the grey axis by a rad
//   deriveCode(tt, slopeDeg, canopyM, knobs)
//                                   the effective code: rock -> 12 cliff by slope,
//                                   forest -> 13 old by canopy, scrub -> 14 dense
//                                   (the shader's splits, picked at their midpoint)
//   groundColor(x, z, period, bias, sharp, meanA, meanB)
//                                   the two sets' mean colours lerped by mixK -
//                                   the number a tuft's instanceColor needs
//   RECIPE                          the splat whole: codes (sets, scales, masks,
//                                   vary, orient), knobs, grades, the library order
//   CODES[ttype]                    DERIVED from RECIPE: the ground's arguments
//                                   per terrain type (muskeg: wet + poolScale):
//                                   period / bias / sharp for mixK, the set
//                                   pair, the vary amplitudes - call the fields
//                                   with the code's row, never with a constant
//
// Values are the vegetation session's (tools/_trees.html, G454.x): the
// vegetation OWNS them; the ground samples them. Change a constant here and
// both sides move together - that is the point of the file.
'use strict';
const GROUND_FIELDS = (() => {
  // ---- THE TABLE (the vegetation's numbers) ------------------------------
  const C = {
    pool:   { period: 400, oct: [[5, 0.55, 0.0, 0.0], [11, 0.30, 0.37, 0.11], [23, 0.15, 0.71, 0.53]],   // [cells, weight, du, dw]
              thr0: 0.66, thrWet: 0.30, edgeVeg: 0.035, edgeGround: 0.01 },
    mix:    { period: 160, oct: [[6, 0.5, 0.0, 0.0], [12, 0.25, 0.3, 0.7], [24, 0.125, 0.6, 0.2], [48, 0.0625, 0.1, 0.9]], norm: 0.9375,
              rot: [0.62, -0.78, 0.78, 0.62], scale2: 0.41, off2: [0.37, 0.71], w1: 0.65, w2: 0.35, bias: 0.52, biasMuskeg: 0.60, sharp: 4 },
    blotch: { cellM: 18, cells: 64, amount: 0.6 },
    shade:  { octA: 0.7, octB: 0.3, scaleB: 0.31, offH: [3.1, 57.0], offV: [91.0, 7.0] },
  };
  // ---- THE RECIPE: the splat, whole - one default for the bench AND the game --
  // Per terrain-type code: the near sets (metres per repeat), the far sets (the
  // aerial packs, over the detail-fade range), the mask [cell m, sharpness,
  // bias A|B, bias C], the variation [hue deg, value, cell m], orient ('sea':
  // the beach turned to face the water). Then the knobs and the grades per
  // set. The bench edits a copy (localStorage), `export` prints it; the game
  // reads this and its own localStorage copy (F8 > map layers > splat).
  const RECIPE = {
    codes: {
      2:  { tex: ['dry', 'grass', 'rockyA'],   scale: [4, 4, 90],   far: ['grassRock', 'grassRock', 'rockyA'], farScale: [15, 15, 90], mix: [40, 3, 0, -0.1],    vary: [10, 0.18, 25], para: 0.2 },
      3:  { tex: ['mud', 'lush', null],        scale: [3, 4, 0],    far: ['grassRock', null, null],           farScale: [15, 0, 0],   mix: [25, 3, 0.08, 0],    vary: [8, 0.2, 15], para: 0.2, wet: 0.32, poolScale: 3 },
      4:  { tex: ['beach', null, null],        scale: [30, 0, 0],   far: [null, null, null],                  farScale: [0, 0, 0],    mix: [30, 1, 0, 0],       vary: [2, 0.06, 20], para: 0.3, orient: 'sea' },
      5:  { tex: ['rocksG', 'rockyB', null],   scale: [4, 90, 0],   far: ['rockyB', null, null],              farScale: [90, 0, 0],   mix: [30, 3, 0, 0],       vary: [3, 0.1, 20], para: 1 },
      6:  { tex: ['rocksB', 'rocksA', null],   scale: [50, 79, 0],  far: ['rocksA', 'rockyA', null],          farScale: [79, 90, 0],  mix: [60, 3, 0, 0],       vary: [3, 0.1, 40], para: 1 },
      7:  { tex: ['grassRock', 'rockyA', 'mud'], scale: [15, 90, 3], far: ['grassRock', 'rockyA', null],     farScale: [15, 90, 0],  mix: [35, 3, 0, -0.25],   vary: [10, 0.18, 25], para: 0.2 },   // the user, 2026-09-21: the bush was a lawn (grass + lush); the moor instead
      8:  { tex: ['forestAir', 'mud', null],   scale: [81, 3, 0],   far: ['forestAir', null, null],           farScale: [81, 0, 0],   mix: [20, 3, -0.3, 0],     vary: [6, 0.15, 30], para: 0.3 },   // the user, 2026-09-21: the forest ground is aerial rock 04
      9:  { tex: ['snowAir', null, null],      scale: [81, 0, 0],   far: [null, null, null],                  farScale: [0, 0, 0],    mix: [30, 1, 0, 0],       vary: [0, 0.04, 40], para: 0.2 },
      10: { tex: ['dirt', null, null],         scale: [2, 0, 0],    far: ['grassRock', null, null],           farScale: [15, 0, 0],   mix: [20, 1, 0, 0],       vary: [2, 0.06, 10], para: 0.2 },
      11: { tex: ['pebble', 'rocksG', null],   scale: [4.5, 2, 0],  far: ['rocksB', null, null],              farScale: [50, 0, 0],   mix: [12, 3, 0, 0],       vary: [3, 0.08, 15], para: 0.6 },   // the rocky beach (a coast_land_rocks set is owed)
      12: { tex: ['cliff', 'rocksA', null],    scale: [7, 79, 0],   far: ['rocksB', null, null],              farScale: [50, 0, 0],   mix: [40, 3, 0, 0],       vary: [2, 0.08, 40], para: 1 },
      13: { tex: ['forestAir', 'mud', null],   scale: [81, 3, 0],   far: ['forestAir', null, null],           farScale: [81, 0, 0],   mix: [25, 3, -0.3, 0],    vary: [5, 0.12, 30], para: 0.3 },
      14: { tex: ['lush', 'grass', 'rockyA'],  scale: [4, 4, 90],   far: ['grassRock', null, 'rockyA'],       farScale: [15, 0, 90],  mix: [30, 3, 0, -0.2],    vary: [8, 0.15, 25], para: 0.2 },
    },
    // the map's code names (0-11 from island_prep's ttype) and the three derived in the shader
    names: { 0: 'sea', 1: 'lake', 2: 'heath', 3: 'muskeg', 4: 'sand', 5: 'scree', 6: 'rock', 7: 'scrub', 8: 'forest', 9: 'snow', 10: 'built', 11: 'shingle', 12: 'cliff', 13: 'forest old', 14: 'scrub dense' },
    knobs: {
      cliffLo: 32, cliffHi: 42, oldLo: 14, oldHi: 20, denseLo: 1, denseHi: 2.5,   // the derived codes: rock -> cliff by slope (deg), forest -> old / scrub -> dense by canopy (m)
      splatWobble: 8, splatBlend: 1.6, beachRot: 90, triK: 6,
      detailFrom: 150, detailTo: 900, macroFrom: 800, macroTo: 6000, macroMix: 0.85, macroNear: 0.45, macroExp: 2.2,   // macroExp is the BENCH's (its light); the game's macro is the lit stack: 1
      hDepth: 0.2, seamDepth: 0.45, hexOn: 1, hexN: 2, hexRot: 180, nrmK: 1, specK: 0.6,
      pudCell: 0, pudCover: 0.32, pudEdge: 0.01, pudSlope: 3, lakeEdge: 1,
      para: 0, paraSteps: 10,   // the parallax (bench only, 2026-09-21): OFF - on the aerial sets it smears, on the detail sets it is invisible without real displacement maps
    },
    // the mild grade per set (the sheet's numbers, tools/splat_sheet.py): a gain and a saturation, never a recolour
    grade: { dry: { gain: '#b3b3a6', sat: 1 }, snowAir: { gain: '#ffffff', sat: 0.6 }, rockyB: { gain: '#ffffff', sat: 0.6 }, cliff: { gain: '#ffffff', sat: 0.7 },
             grass: { gain: '#ffffff', sat: 0.7 }, lush: { gain: '#ffffff', sat: 0.7 } },   // the lawn grasses toned down where heath and dense scrub still use them
    // the library, in LAYER ORDER (the texture arrays are built in this order; a code's set is its index here):
    // assets/splat (splat_tex_import.py, Poly Haven CC0) then the lot's five (ambientCG CC0, lot_tex_prep.js's tiles)
    library: [
      ['beach', 29.98], ['rocksA', 78.93], ['rocksB', 50.18], ['mud', 1.25], ['leaves', 1.49], ['cliff', 6.86], ['rocksG', 2.03], ['rockyA', 89.94], ['rockyB', 89.79],
      ['grassRock', 15.04], ['forestAir', 80.81], ['snowAir', 81.2],
      ['lush', 2.4], ['grass', 2.4], ['pebble', 4.5], ['dry', 2.2], ['dirt', 1.8],
    ],
  };
  // ---- PER TERRAIN-TYPE CODE: the ground's arguments to the fields ---------
  // DERIVED from the recipe: the row a tuft calls mixK / shade with (period =
  // 6 x cell, sharp = 4 x sharpness, bias = 0.52 - biasAB, the near set pair,
  // the vary amplitudes; muskeg's wet + poolScale). Never with a constant.
  const CODES = {};
  for (const k in RECIPE.codes) { const c = RECIPE.codes[k];
    CODES[k] = { name: RECIPE.names[k], period: Math.round(c.mix[0] * 6), bias: +(0.52 - c.mix[2]).toFixed(3), sharp: c.mix[1] * 2, sets: [c.tex[0], c.tex[1]], vary: c.vary.slice() };
    if (c.wet !== undefined) CODES[k].wet = c.wet;
    if (c.poolScale !== undefined) CODES[k].poolScale = c.poolScale; }

  // ---- the primitive ------------------------------------------------------
  function hash2(ix, iz) {
    let n = (ix * 374761393 + iz * 668265263 + 1013904223) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  // tileable value noise over one period: u, w in [0, 1), N cells
  function vnoiseT(u, w, N) {
    u = u - Math.floor(u); w = w - Math.floor(w);
    const fu = u * N, fw = w * N;
    const iu = Math.floor(fu), iw = Math.floor(fw);
    let tu = fu - iu, tw = fw - iw;
    tu = tu * tu * (3 - 2 * tu); tw = tw * tw * (3 - 2 * tw);
    const i0 = iu % N, i1 = (iu + 1) % N, j0 = iw % N, j1 = (iw + 1) % N;
    const a = hash2(i0, j0), b = hash2(i1, j0), c = hash2(i0, j1), d = hash2(i1, j1);
    return (a + (b - a) * tu) + ((c + (d - c) * tu) - (a + (b - a) * tu)) * tw;
  }
  const fbmT = (u, w, oct) => { let n = 0; for (const [N, k, du, dw] of oct) n += k * vnoiseT(u + du, w + dw, N); return n; };
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const smooth = t => t * t * (3 - 2 * t);

  // ---- the fields --------------------------------------------------------
  function poolAt(x, z, wet, edge) {
    const P = C.pool, e = edge === undefined ? P.edgeGround : edge;
    const n = fbmT(x / P.period, z / P.period, P.oct);
    const thr = P.thr0 - P.thrWet * wet;
    return smooth(clamp01((n - (thr - e)) / (2 * e)));
  }
  function mixK(x, z, period, bias, sharp) {
    const M = C.mix;
    const u = x / period, w = z / period;
    const u2 = (M.rot[0] * u + M.rot[1] * w) * M.scale2 + M.off2[0], w2 = (M.rot[2] * u + M.rot[3] * w) * M.scale2 + M.off2[1];
    const n = (M.w1 * fbmT(u, w, M.oct) + M.w2 * fbmT(u2, w2, M.oct)) / M.norm;
    return clamp01((n - bias) * sharp + 0.5);
  }
  function blotch(x, z, seed) {
    const B = C.blotch, L = B.cellM * B.cells;
    return 1 - B.amount * (0.5 + 0.5 * vnoiseT(x / L + (seed % 13) / 13, z / L + (seed % 7) / 7, B.cells));
  }
  // the colour swing: two octaves of the same noise, decorrelated, -1..1 each
  function shade(x, z, cell) {
    const S = C.shade, c = Math.max(cell, 1), L = c * 64, L2 = c * S.scaleB * 64;
    const h = (S.octA * vnoiseT(x / L + S.offH[0], z / L + S.offH[0] * 0.5, 64) + S.octB * vnoiseT(x / L2 + S.offH[1], z / L2, 64)) * 2 - 1;
    const v = (S.octA * vnoiseT(x / L + S.offV[0], z / L + S.offV[0] * 0.5, 64) + S.octB * vnoiseT(x / L2 + S.offV[1], z / L2, 64)) * 2 - 1;
    return { hue: h, value: v };
  }
  // a turn of a colour about the grey axis (Rodrigues on (1,1,1)/sqrt3) - the
  // shade field's hue swing is applied with this on both sides
  function hueTurn(rgb, a) {
    if (!a) return rgb.slice();
    const k = 0.57735027, ca = Math.cos(a), sa = Math.sin(a);
    const [r, g, b] = rgb, d = k * (r + g + b) * (1 - ca);
    // cross(k, c) = k * (b - g, r - b, g - r)
    return [r * ca + k * (b - g) * sa + k * d, g * ca + k * (r - b) * sa + k * d, b * ca + k * (g - r) * sa + k * d];
  }
  // THE DERIVED CODES, on the CPU: what the shader's sSplat does to a cell's
  // code by the continuous fields - rock steeper than the cliff split is the
  // cliff, forest under a tall canopy is old growth, scrub under a canopy is
  // dense. Returns the effective code (a hard pick at the split's midpoint;
  // the shader blends across the split's width). knobs default to RECIPE's.
  function deriveCode(tt, slopeDeg, canopyM, knobs) {
    const K = knobs || RECIPE.knobs;
    if (tt === 6 && slopeDeg >= (K.cliffLo + K.cliffHi) / 2) return 12;
    if (tt === 8 && canopyM >= (K.oldLo + K.oldHi) / 2) return 13;
    if (tt === 7 && canopyM >= (K.denseLo + K.denseHi) / 2) return 14;
    return tt;
  }
  function groundColor(x, z, period, bias, sharp, meanA, meanB) {
    const k = mixK(x, z, period, bias, sharp);
    return [meanA[0] + (meanB[0] - meanA[0]) * k, meanA[1] + (meanB[1] - meanA[1]) * k, meanA[2] + (meanB[2] - meanA[2]) * k];
  }

  // ---- the same functions in GLSL (ES 3.00: uint wraps mod 2^32) ---------
  const glsl = `
  // GROUND FIELDS (src/core/28b_ground_fields.js - the JS is the reference; keep them identical)
  float gfHash2(int ix, int iz){
    uint n = uint(ix) * 374761393u + uint(iz) * 668265263u + 1013904223u;
    n = (n ^ (n >> 13u)) * 1274126177u;
    return float(n ^ (n >> 16u)) / 4294967296.0;
  }
  float gfVnoiseT(float u, float w, int N){
    u = u - floor(u); w = w - floor(w);
    float fu = u * float(N), fw = w * float(N);
    int iu = int(floor(fu)), iw = int(floor(fw));
    float tu = fu - float(iu), tw = fw - float(iw);
    tu = tu * tu * (3.0 - 2.0 * tu); tw = tw * tw * (3.0 - 2.0 * tw);
    int i0 = iu % N, i1 = (iu + 1) % N, j0 = iw % N, j1 = (iw + 1) % N;
    float a = gfHash2(i0, j0), b = gfHash2(i1, j0), c = gfHash2(i0, j1), d = gfHash2(i1, j1);
    return (a + (b - a) * tu) + ((c + (d - c) * tu) - (a + (b - a) * tu)) * tw;
  }
  float gfPoolNoise(float u, float w){
    return ${C.pool.oct.map(([N, k, du, dw]) => `${k.toFixed(4)} * gfVnoiseT(u + ${du.toFixed(4)}, w + ${dw.toFixed(4)}, ${N})`).join(' + ')};
  }
  float gfPoolAt(vec2 xz, float wet, float edge){
    float n = gfPoolNoise(xz.x / ${C.pool.period.toFixed(1)}, xz.y / ${C.pool.period.toFixed(1)});
    float thr = ${C.pool.thr0.toFixed(4)} - ${C.pool.thrWet.toFixed(4)} * wet;
    return smoothstep(0.0, 1.0, clamp((n - (thr - edge)) / (2.0 * edge), 0.0, 1.0));
  }
  float gfMixNoise(float u, float w){
    return (${C.mix.oct.map(([N, k, du, dw]) => `${k.toFixed(4)} * gfVnoiseT(u + ${du.toFixed(4)}, w + ${dw.toFixed(4)}, ${N})`).join(' + ')}) / ${C.mix.norm.toFixed(4)};
  }
  float gfMixK(vec2 xz, float period, float bias, float sharp){
    float u = xz.x / period, w = xz.y / period;
    float u2 = (${C.mix.rot[0].toFixed(4)} * u + ${C.mix.rot[1].toFixed(4)} * w) * ${C.mix.scale2.toFixed(4)} + ${C.mix.off2[0].toFixed(4)};
    float w2 = (${C.mix.rot[2].toFixed(4)} * u + ${C.mix.rot[3].toFixed(4)} * w) * ${C.mix.scale2.toFixed(4)} + ${C.mix.off2[1].toFixed(4)};
    float n = ${C.mix.w1.toFixed(4)} * gfMixNoise(u, w) + ${C.mix.w2.toFixed(4)} * gfMixNoise(u2, w2);
    return clamp((n - bias) * sharp + 0.5, 0.0, 1.0);
  }
  float gfBlotch(vec2 xz, int seed){
    float L = ${(C.blotch.cellM * C.blotch.cells).toFixed(1)};
    return 1.0 - ${C.blotch.amount.toFixed(4)} * (0.5 + 0.5 * gfVnoiseT(xz.x / L + float(seed % 13) / 13.0, xz.y / L + float(seed % 7) / 7.0, ${C.blotch.cells}));
  }
  vec2 gfShade(vec2 xz, float cell){
    float c = max(cell, 1.0), L = c * 64.0, L2 = c * ${C.shade.scaleB.toFixed(4)} * 64.0;
    float h = (${C.shade.octA.toFixed(4)} * gfVnoiseT(xz.x / L + ${C.shade.offH[0].toFixed(4)}, xz.y / L + ${(C.shade.offH[0] * 0.5).toFixed(4)}, 64) + ${C.shade.octB.toFixed(4)} * gfVnoiseT(xz.x / L2 + ${C.shade.offH[1].toFixed(4)}, xz.y / L2, 64)) * 2.0 - 1.0;
    float v = (${C.shade.octA.toFixed(4)} * gfVnoiseT(xz.x / L + ${C.shade.offV[0].toFixed(4)}, xz.y / L + ${(C.shade.offV[0] * 0.5).toFixed(4)}, 64) + ${C.shade.octB.toFixed(4)} * gfVnoiseT(xz.x / L2 + ${C.shade.offV[1].toFixed(4)}, xz.y / L2, 64)) * 2.0 - 1.0;
    return vec2(h, v);
  }
  vec3 gfHueTurn(vec3 c, float a){
    vec3 k = vec3(0.57735027); float ca = cos(a), sa = sin(a);
    return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
  }
`;

  // a self-check: the JS against itself at a few points (the GLSL is checked
  // on the bench by reading pixels back - see tools/_island.html)
  function selfCheck() {
    const a = poolAt(123.4, -567.8, 0.45), b = mixK(10, 20, 160, 0.52, 4), c = blotch(5, 5, 42), d = shade(1000, 2000, 25);
    return isFinite(a + b + c + d.hue + d.value) && a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
  }

  return { C, RECIPE, CODES, hash2, vnoiseT, poolAt, mixK, blotch, shade, hueTurn, deriveCode, groundColor, glsl, selfCheck };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = GROUND_FIELDS;
