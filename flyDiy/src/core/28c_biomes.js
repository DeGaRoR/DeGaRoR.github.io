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
//     B.mixOf(name)   the mix record
//     B.density(name) the mix's trees per m2 (its `count` in its `radius`)
//     B.set(code, mixName) / B.export()   F8's handle
//   The derivation's thresholds are the splat's knobs (GROUND_FIELDS.RECIPE
//   .knobs when that module is present, its defaults otherwise): ONE knob set,
//   two readers (the shader may not take a texture for it — the sampler census).
// ===========================================================================
'use strict';
const BIOMES = (() => {
  const KNOBS = { cliffLo: 32, cliffHi: 42, oldLo: 14, oldHi: 20, denseLo: 1, denseHi: 2.5 };
  const NAMES = { 0: 'sea', 1: 'lake', 2: 'heath', 3: 'muskeg', 4: 'sand', 5: 'scree', 6: 'rock', 7: 'scrub', 8: 'forest', 9: 'snow', 10: 'built', 11: 'shingle', 12: 'cliff', 13: 'forest old', 14: 'scrub dense' };
  const smooth = (lo, hi, v) => { const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))); return t * t * (3 - 2 * t); };
  function make(pack, opts) {
    const src = (pack && pack.biomes) || {};
    const B = {
      map: Object.assign({}, src.map || {}),
      mixes: src.mixes || {},
      names: NAMES,
      knobs: () => {
        const R = (typeof GROUND_FIELDS !== 'undefined' && GROUND_FIELDS && GROUND_FIELDS.RECIPE) ? GROUND_FIELDS.RECIPE.knobs : null;
        return Object.assign({}, KNOBS, R || {}, (opts && opts.knobs) || {});
      },
    };
    B.codeOf = (tt, slopeDeg, canopyM, r) => {
      const K = B.knobs();
      if (tt === 6 && r < smooth(K.cliffLo, K.cliffHi, slopeDeg)) return 12;
      if (tt === 8 && r < smooth(K.oldLo, K.oldHi, canopyM)) return 13;
      if (tt === 7 && r < smooth(K.denseLo, K.denseHi, canopyM)) return 14;
      return tt;
    };
    B.mixAt = code => { const m = B.map[code]; return (m && B.mixes[m]) ? m : null; };
    B.mixOf = name => B.mixes[name] || null;
    // trees per m2: the bench's `count` in its stand of `radius` (220 m by default)
    B.density = name => { const M = B.mixes[name]; if (!M || !M.forest) return 0; const r = M.forest.radius || 220; return (M.forest.count || 0) / (Math.PI * r * r); };
    B.set = (code, name) => { if (name === null || name === '' || name === undefined) delete B.map[code]; else B.map[code] = name; return B.map[code] || null; };
    B.export = () => JSON.stringify({ biomes: B.map, mixes: B.mixes }, null, 1);
    return B;
  }
  return { make, NAMES, KNOBS };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BIOMES;
if (typeof window !== 'undefined') window.BIOMES = BIOMES;
