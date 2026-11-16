// ===========================================================================
// 28c_biomes.js — THE BIOMES: a terrain-type code names a bench mix (2026-09-20,
// futureDesigns/BIOMES-IN-GAME-2026-09-20.md). Pure, no three.js.
//
// The island's ground is drawn per TERRAIN TYPE (island_prep's ttype byte,
// codes 0-11, plus three the splat derives from slope and canopy: 12 cliff,
// 13 forest old, 14 scrub dense). The vegetation reads the SAME code and
// draws the biome that code names — the table is the bench's `mixes` and its
// `biomes` map, shipped in the payload (TREE_PACK.biomes, baked by
// tools/tree_prep.py from tools/_trees_tuning.json), so what the bench judged
// is what the game plants, and the user's F8 edits export back to that file.
//
//   BIOMES.make(pack, opts) -> B
//     B.map           { code: mixName }          (a copy; F8 edits it)
//     B.mixes         { mixName: { species, forest } }
//     B.codeOf(tt, slopeDeg, canopyM, r)   the code, the splat's derivation on the
//                     CPU: rock -> cliff by slope, forest -> old and scrub -> dense
//                     by canopy; the shader's smoothstep becomes a draw on r in
//                     [0,1) so the split is the same share, jittered per point
//     B.mixAt(code)   the mix name or null (no biome here: sea, snow, built...)
//     B.mixHere(code, x, z)  the same at a point, a premises polygon's own vegetation first (B.over)
//     B.mixOf(name)   the mix record
//     B.SHORE / B.shore / B.shoreHere(x, z)   18 LAKESHORE (G3430): the land within shoreReach m of a
//                     drawn lake's line under the bank's slope - the renderer sets B.shore (the lake field
//                     lives there); shoreHere is it where no premises polygon speaks and map[18] names a mix.
//                     The COVER RING's band (tufts, flowers, bushes); the trees keep their own code's mix
//     B.density(name) the mix's trees per m2 (its `count` in its `radius`)
//     B.set(code, mixName) / B.export()   F8's handle
//     B.SUBALPINE / B.subOn / B.subCode(code, h, n, r2) / B.subKeep(h, ridgeDh) / B.subAt / B.keepAt
//                     19 SUBALPINE (MOUNTAIN-VEG, 15 Nov 2026): heath (2) and scrub (7, 14) above a height ramp take the
//                     subalpine mix - a VEGETATION code like 18: the GROUND keeps its own code (codeAt, the splat, the
//                     grass's colour), only the mix changes. subCode is the derivation (n: a value noise in [0,1) that
//                     breaks the ramp's edge, r2 the point's draw); subKeep the share of the mix's density that stands at
//                     h (the high summits thin out) and on a ridge top (ridgeDh: the point's height over its
//                     surroundings', m). The renderer sets subAt(code, x, z) -> the vegetation code (mixHere and the
//                     walks read it) and keepAt(code, x, z, h) (the ridge read). subOn: the dial (?subalpine=0 = off)
//   The derivation's thresholds are the splat's knobs (GROUND_FIELDS.RECIPE
//   .knobs when that module is present, its defaults otherwise): ONE knob set,
//   two readers (the shader may not take a texture for it — the sampler census).
// ===========================================================================
'use strict';
const BIOMES = (() => {
  const KNOBS = { cliffLo: 32, cliffHi: 42, oldLo: 14, oldHi: 20, denseLo: 1, denseHi: 2.5, shoreReach: 12, shoreJit: 0.35,
    // 19 SUBALPINE (the user, 15 Nov: "In reality, there are little trees growing almost up to the summits, in most green zones.
    // Only the real high summits have no trees, or the top of the ridges, and these ones have lush grass formations"). The
    // tree fill gated heath by the canopy map, which reads under 0.5 m on subalpine ground (it cannot see a tree under ~2 m):
    // Skyline and Mount Ardent went bare from ~550 m (tools/veg_bench.js). The ramp 450 -> 600 m (+-40 m by a 140 m noise),
    // thinning to 15 % between 800 and 1 000 m (the real high summits: Ardent's cap; Skyline tops out at ~710 m and keeps its trees round the altiport) and to 35 % where a point stands 8 m over its surroundings (four taps at 110 m)
    subH0: 450, subH1: 600, subJit: 40, subTop0: 800, subTop1: 1000, subTopKeep: 0.15, subRidgeDh: 8, subRidgeKeep: 0.35 };   // shoreSlope: the bank's bankLo unless set
  // 18 LAKESHORE (G3430, the user 25 Oct: "a proper biome with its mask, and we can paint it and everything, like the
  // other"): a VEGETATION code - the band along the drawn lakes is its mask, a premises polygon paints it (or erases it)
  // like any biome; the ground under it stays its own code's (no splat row: NCODE 17)
  const SHORE = 18, SUBALPINE = 19;
  // 15 LUSH is AUTHORED, not classified: a premises `cover` polygon stamps it into the island's ttype grid
  // (the route BIOMES-IN-GAME-2026-09-20 L5 proposed), and it carries the `borders` mix - the deciduous
  // shrubs, holly, raspberry and the odd birch that had been left orphaned when 7 and 14 were re-pointed.
  const NAMES = { 0: 'sea', 1: 'lake', 2: 'heath', 3: 'muskeg', 4: 'sand', 5: 'scree', 6: 'rock', 7: 'scrub', 8: 'forest', 9: 'snow', 10: 'built', 11: 'shingle', 12: 'cliff', 13: 'forest old', 14: 'scrub dense', 15: 'lush', 16: 'city trees', 18: 'lake shore', 19: 'subalpine' };
  const smooth = (lo, hi, v) => { const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))); return t * t * (3 - 2 * t); };
  function make(pack, opts) {
    const src = (pack && pack.biomes) || {};
    const B = {
      map: Object.assign({}, src.map || {}),
      mixes: src.mixes || {},
      names: NAMES,
      knobs: () => {
        if (B.held) return B.held;   // a walk's snapshot (hold below)
        const R = (typeof GROUND_FIELDS !== 'undefined' && GROUND_FIELDS && GROUND_FIELDS.RECIPE) ? GROUND_FIELDS.RECIPE.knobs : null;
        return Object.assign({}, KNOBS, R || {}, (opts && opts.knobs) || {});
      },
      // HOLD (MOUNTAIN-VEG 16 Nov): knobs() merges three objects per call, and the per-point rules (subCode, subKeep) made it the
      // walk's top cost (5 of 11 s in veg_bench's Cabin window). A caller that runs many points in one synchronous pass holds a
      // snapshot for it - hold(true) before, hold(false) after (the editor's live knobs reach the next pass)
      held: null,
      hold: on => { B.held = null; if (on) B.held = B.knobs(); },
    };
    B.codeOf = (tt, slopeDeg, canopyM, r) => {
      const K = B.knobs();
      if (tt === 6 && r < smooth(K.cliffLo, K.cliffHi, slopeDeg)) return 12;
      if (tt === 8 && r < smooth(K.oldLo, K.oldHi, canopyM)) return 13;
      if (tt === 7 && r < smooth(K.denseLo, K.denseHi, canopyM)) return 14;
      return tt;
    };
    B.SHORE = SHORE; B.shore = null;
    // 19 SUBALPINE: the derivation and the thinning (the walk, the stand cards and the cover ring all reach it through codeAt)
    B.SUBALPINE = SUBALPINE; B.subOn = true; B.subAt = null; B.keepAt = null;
    B.subCode = (code, h, n, r2) => {
      if (!B.subOn || !(code === 2 || code === 7 || code === 14) || !B.mixAt(SUBALPINE)) return code;
      const K = B.knobs();
      return r2 < smooth(K.subH0, K.subH1, h + (n - 0.5) * 2 * K.subJit) ? SUBALPINE : code;
    };
    B.subKeep = (h, ridgeDh) => {
      const K = B.knobs();
      return (1 - (1 - K.subTopKeep) * smooth(K.subTop0, K.subTop1, h)) * (ridgeDh > K.subRidgeDh ? K.subRidgeKeep : 1);
    };
    B.shoreHere = (x, z) => { if (!B.shore || !B.mixAt(SHORE)) return false; if (B.over && B.over(x, z) !== undefined) return false; return !!B.shore(x, z); };
    B.mixAt = code => { const m = B.map[code]; return (m && B.mixes[m]) ? m : null; };
    B.mixOf = name => B.mixes[name] || null;
    // A POLYGON'S OWN VEGETATION (G1385 EDITOR-VEG, contract v1.31): `over(x, z)` - set by the renderer from the
    // premises' vegAt - says undefined (the polygon has nothing to say: the code's biome), null (no vegetation) or a
    // mix name (an existing biome, or a premises' own '@id' mix registered in B.mixes). mixHere is mixAt at a POINT.
    B.over = null;
    B.mixHere = (code, x, z) => {
      if (B.over) { const o = B.over(x, z); if (o !== undefined) return (o && B.mixes[o]) ? o : null; }
      return code < 0 ? null : B.mixAt(B.subAt ? B.subAt(code, x, z) : code);
    };
    // trees per m2: the bench's `count` in its stand of `radius` (220 m by default)
    B.density = name => { const M = B.mixes[name]; if (!M || !M.forest) return 0; const r = M.forest.radius || 220; return (M.forest.count || 0) / (Math.PI * r * r); };
    B.set = (code, name) => { if (name === null || name === '' || name === undefined) delete B.map[code]; else B.map[code] = name; return B.map[code] || null; };
    B.export = () => JSON.stringify({ biomes: B.map, mixes: B.mixes }, null, 1);
    return B;
  }
  return { make, NAMES, KNOBS, SHORE, SUBALPINE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BIOMES;
if (typeof window !== 'undefined') window.BIOMES = BIOMES;
