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
//     B.setKnobs(o) / B.tuned() / B.ground   the world editor's knobs over KNOBS (WORLD-RAIL-VEG), the splat's live knobs
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
  // shoreReach 12 -> 16 m (17 Nov, the user's lush lake borders: the band of tall grass, bushes and birch wider)
  const KNOBS = { cliffLo: 32, cliffHi: 42, oldLo: 14, oldHi: 20, denseLo: 1, denseHi: 2.5, shoreReach: 22, shoreSlope: 34, shoreJit: 0.35,
    // 19 SUBALPINE (the user, 15 Nov: "In reality, there are little trees growing almost up to the summits, in most green zones.
    // Only the real high summits have no trees, or the top of the ridges, and these ones have lush grass formations"). The
    // tree fill gated heath by the canopy map, which reads under 0.5 m on subalpine ground (it cannot see a tree under ~2 m):
    // Skyline and Mount Ardent went bare from ~550 m (tools/veg_bench.js). The ramp 450 -> 600 m (+-40 m by a 140 m noise),
    // thinning to 15 % between 800 and 1 000 m (the real high summits: Ardent's cap; Skyline tops out at ~710 m and keeps its trees round the altiport) and to 35 % where a point stands 8 m over its surroundings (four taps at 110 m)
    // 16 Nov eve, the user: "the sub-alpine vegetation is a little too sparse ... a little more density": the ramp 420 -> 540 m and
    // the ridge keeps 60 % (the bench: Skyline's 550-700 m bands are 44-100 % ridge, so the ridge share WAS the summit's density -
    // ~90 trees / ha against the forest's 170-190 below; with the mix's clump gap 0.3 -> 0.15)
    // (17 Nov, the user: "a slight gradient for the trees ... a little too many at the very top, where the bushes should be more prominent"):
    // the thinning starts at 560 m, not 800 (Skyline's 700 m top keeps ~60 %, its ridges ~37 %; Ardent's cap still 15 %)
    subH0: 420, subH1: 540, subJit: 40, subTop0: 560, subTop1: 860, subTopKeep: 0.15, subRidgeDh: 8, subRidgeKeep: 0.6,
    // FOREST-EDGE (the user 16 Nov: "the sides of the forested areas often show the forest ground with no trees in them anymore
    // ... What would be much better is to have a ramp of tree sizes on the surroundings, then bushes"; their spec of 25 Oct:
    // young 0-6 m inside, medium 6-20 m, full beyond, never under x0.7). The canopy map ramps over ~50 m at an edge (its deep
    // value only 40-60 m in, tools/veg_bench.js --edge), and the fill read it as is: the first 10 m stood at 50-57 % of the
    // points and half the interior's height. Inside the edge the tree takes the interior's canopy (the tallest of 16 taps at
    // 30 and 45 m) x the ramp - edgeMin at the edge, edgeMid at edgeYoung, 1 at edgeFull, edgeOutK at edgeOut, where the map's
    // own takes over - and the NDVI's thinning is lifted to edgeFull, handed back by edgeOut. The field: edgeCell m cells,
    // edgeTile m tiles with an edgeMargin m margin
    // edgeIn: that INSIDE ramp on (1) or off (0, the default since the user's read of the bench, 16 Nov eve: "I have the feeling
    // it made the deep forest denser" - it filled and grew the first 60 m in; the forest now stays as it is inside)
    edgeIn: 0, edgeYoung: 6, edgeFull: 20, edgeMin: 0.72, edgeMid: 0.85, edgeOut: 60, edgeOutK: 0.75, edgeCell: 6, edgeTile: 192, edgeMargin: 48,
    // THE OUTWARD BAND (the user, 16 Nov eve, on the inside ramp's bench: "I don't feel like it added a gradient or extended wooded
    // zones as I expected"; the widths and the clumps below are MOUNTAIN-VEG's defaults, each a knob): outside the forest's drawn edge the fill plants the WOOD's own trees (its mix, read 10 m in) out to a reach that wanders
    // edgeReach m x (1 +- edgeReachVar) over a edgeReachM m noise; the share planted falls from edgeTreeDens at the line to 0 at
    // the reach (^edgeFall), the ground between clumps (a edgeClumpM m noise, edgeClump of it) left bare; a tree's size from
    // edgeSizeIn x the wood's canopy at the line to edgeSizeOut (a sapling) at the reach
    edgeReach: 30, edgeReachVar: 0.5, edgeReachM: 70, edgeTreeDens: 0.9, edgeFall: 1.2, edgeClump: 0.35, edgeClumpM: 14,
    edgeSizeIn: 0.7, edgeSizeOut: 0.22,
    // then the cover ring's EDGE BAND past the trees (the user's 25 Oct numbers, now measured from the band's own reach R):
    // bushes from edgeShrubIn x R out to R + edgeShrubOut at edgeShrubDens a m2, the weeds (fireweed, foam flower) from there to
    // R + edgeWeedOut at edgeWeedDens a m2; the grass field's weeds are LOOK-1's
    edgeShrubIn: 0.5, edgeShrubOut: 3, edgeWeedOut: 6, edgeShrubDens: 0.2, edgeWeedDens: 0.25 };   // shoreSlope: the bank's bankLo unless set
  // 18 LAKESHORE (G3430, the user 25 Oct: "a proper biome with its mask, and we can paint it and everything, like the
  // other"): a VEGETATION code - the band along the drawn lakes is its mask, a premises polygon paints it (or erases it)
  // like any biome; the ground under it stays its own code's (no splat row: NCODE 17)
  const SHORE = 18, SUBALPINE = 19;
  // 15 LUSH is AUTHORED, not classified: a premises `cover` polygon stamps it into the island's ttype grid
  // (the route BIOMES-IN-GAME-2026-09-20 L5 proposed), and it carries the `borders` mix - the deciduous
  // shrubs, holly, raspberry and the odd birch that had been left orphaned when 7 and 14 were re-pointed.
  const NAMES = { 0: 'sea', 1: 'lake', 2: 'heath', 3: 'muskeg', 4: 'sand', 5: 'scree', 6: 'rock', 7: 'scrub', 8: 'forest', 9: 'snow', 10: 'built', 11: 'shingle', 12: 'cliff', 13: 'forest old', 14: 'scrub dense', 15: 'lush', 16: 'city trees', 18: 'lake shore', 19: 'subalpine' };
  const smooth = (lo, hi, v) => { const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))); return t * t * (3 - 2 * t); };
  // a value noise of our own (the outward edge band's reach and clumps; the fill and the cover ring read it the same)
  const hsh = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x, z, cell, seed) => { const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz), n = (a, b) => hsh(a * 7 + seed * 131, b * 13 + seed * 17);
    return (n(ix, iz) * (1 - sx) + n(ix + 1, iz) * sx) * (1 - sz) + (n(ix, iz + 1) * (1 - sx) + n(ix + 1, iz + 1) * sx) * sz; };
  function make(pack, opts) {
    const src = (pack && pack.biomes) || {};
    const B = {
      map: Object.assign({}, src.map || {}),
      mixes: src.mixes || {},
      names: NAMES,
      knobs: () => {
        if (B.held) return B.held;   // a walk's snapshot (hold below)
        const R = (typeof GROUND_FIELDS !== 'undefined' && GROUND_FIELDS && GROUND_FIELDS.RECIPE) ? GROUND_FIELDS.RECIPE.knobs : null;
        // the ground's LIVE knobs (B.ground: the renderer's splat, which the world editor's split sliders move - the recipe's
        // copy above never moves), then the caller's, then the world editor's own (B.user, setKnobs)
        const L = B.ground ? B.ground() : null;
        return Object.assign({}, KNOBS, R || {}, L || {}, (opts && opts.knobs) || {}, B.user);
      },
      // THE WORLD EDITOR'S KNOBS (WORLD-RAIL-VEG 16 Nov, the user: every world setting editable for hand-tuning): setKnobs(o)
      // merges o over the rest (null or undefined values drop a key back to the default; setKnobs(null) drops them all);
      // `subOn` and `edgeOn` in o are the dials. kver counts the field's changes (edgeField re-lays its cells on one). The caller
      // replants (TREE_FILL.setKnobs); tuned() is the editor's own: what the world look saves
      ground: null, user: {}, kver: 0,
      setKnobs: o => {
        if (o === null) B.user = {};
        else for (const k in (o || {})) {
          if (k === 'subOn' || k === 'edgeOn') { B[k] = !!o[k]; continue; }
          if (o[k] === null || o[k] === undefined || !isFinite(+o[k])) delete B.user[k]; else B.user[k] = +o[k];
        }
        B.held = null; if (o === null || ['edgeCell', 'edgeTile', 'edgeMargin'].some(k => k in (o || {}))) B.kver++; return B.tuned();
      },
      tuned: () => Object.assign({}, B.user, { subOn: B.subOn !== false, edgeOn: B.edgeOn !== false }),
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
    // FOREST-EDGE (KNOBS edge*): the signed distance to the forest's edge (+ in, - out, m) over `isForest(x, z)` - a chamfer
    // field per tile, cached, read bilinear; the renderer's tree fill and tools/veg_bench.js build it on the same test
    B.edgeOn = true;
    B.edgeField = isForest => {
      let K, c, T, M, n, ver = -1; const cache = new Map();
      const lay = () => { K = B.knobs(); c = K.edgeCell; T = K.edgeTile; M = Math.ceil(K.edgeMargin / c); n = Math.round(T / c) + 2 * M; cache.clear(); ver = B.kver; };   // (again on a setKnobs: the cell, the tile, the margin)
      lay();
      const build = (ti, tj) => {
        const ox = ti * T - M * c, oz = tj * T - M * c, F = new Uint8Array(n * n), Din = new Float32Array(n * n), Dout = new Float32Array(n * n), BIG = 1e6, a = c, b = c * Math.SQRT2;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; F[k] = isForest(ox + (i + 0.5) * c, oz + (j + 0.5) * c) ? 1 : 0; Din[k] = F[k] ? BIG : 0; Dout[k] = F[k] ? 0 : BIG; }
        for (const D of [Din, Dout]) {
          for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; if (!D[k]) continue; let v = D[k];
            if (i > 0) v = Math.min(v, D[k - 1] + a); if (j > 0) { v = Math.min(v, D[k - n] + a); if (i > 0) v = Math.min(v, D[k - n - 1] + b); if (i < n - 1) v = Math.min(v, D[k - n + 1] + b); } D[k] = v; }
          for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) { const k = j * n + i; if (!D[k]) continue; let v = D[k];
            if (i < n - 1) v = Math.min(v, D[k + 1] + a); if (j < n - 1) { v = Math.min(v, D[k + n] + a); if (i < n - 1) v = Math.min(v, D[k + n + 1] + b); if (i > 0) v = Math.min(v, D[k + n - 1] + b); } D[k] = v; } }
        const S = new Float32Array(n * n); for (let k = 0; k < S.length; k++) S[k] = F[k] ? Din[k] - c / 2 : -(Dout[k] - c / 2);
        return { ox, oz, S };
      };
      const at = (x, z) => {
        if (ver !== B.kver) lay();
        const ti = Math.floor(x / T), tj = Math.floor(z / T), key = ti * 100003 + tj;
        let t = cache.get(key); if (!t) { if (cache.size > 512) cache.clear(); t = build(ti, tj); cache.set(key, t); }
        const u = (x - t.ox) / c - 0.5, v = (z - t.oz) / c - 0.5, i = Math.max(0, Math.min(n - 2, Math.floor(u))), j = Math.max(0, Math.min(n - 2, Math.floor(v)));
        const fu = u - i, fv = v - j, k = j * n + i, S = t.S;
        return (S[k] * (1 - fu) + S[k + 1] * fu) * (1 - fv) + (S[k + n] * (1 - fu) + S[k + n + 1] * fu) * fv;
      };
      at.clear = () => cache.clear();
      return at;
    };
    // the canopy a tree d m inside the edge stands at (null: the map's own): `canIn` the interior's, read by the caller
    B.edgeRamp = d => { const K = B.knobs();
      return d < K.edgeYoung ? K.edgeMin + (K.edgeMid - K.edgeMin) * Math.max(0, d) / K.edgeYoung
        : d < K.edgeFull ? K.edgeMid + (1 - K.edgeMid) * (d - K.edgeYoung) / (K.edgeFull - K.edgeYoung)
        : 1 - (1 - K.edgeOutK) * Math.min(1, (d - K.edgeFull) / (K.edgeOut - K.edgeFull)); };
    // the share of the NDVI's thinning lifted at d (1 to edgeFull, 0 at edgeOut)
    B.edgeLift = d => { const K = B.knobs(); return d >= K.edgeOut ? 0 : d < K.edgeFull ? 1 : 1 - (d - K.edgeFull) / (K.edgeOut - K.edgeFull); };
    // the interior's canopy round a point: the tallest of 16 taps, 8 directions at 30 and 45 m
    // THE OUTWARD BAND (KNOBS edgeReach..edgeSizeOut): the reach at a point (the band's irregular line), and a point d m from
    // the edge (d < 0: outside) -> { p: the share planted, k: the size over the wood's canopy, t: 0 at the line .. 1 at the reach }
    // or null past it. reachMax: the furthest it can go (the ring's and the field's margins)
    B.edgeReachAt = (x, z) => { const K = B.knobs(); return K.edgeReach * (1 + K.edgeReachVar * (2 * vnoise(x, z, K.edgeReachM, 91) - 1)); };
    B.edgeReachMax = () => { const K = B.knobs(); return K.edgeReach * (1 + K.edgeReachVar); };
    B.edgeBandAt = (d, x, z) => { if (!(d < 0)) return null; const K = B.knobs(), R = B.edgeReachAt(x, z), t = -d / Math.max(1, R); if (t >= 1) return null;
      const keep = smooth(K.edgeClump - 0.12, K.edgeClump + 0.12, vnoise(x, z, K.edgeClumpM, 37));
      return { p: K.edgeTreeDens * Math.pow(1 - t, K.edgeFall) * keep, k: K.edgeSizeIn + (K.edgeSizeOut - K.edgeSizeIn) * Math.pow(t, 0.8), t, R }; };
    B.edgeCanIn = (canopyAt, x, z) => { let m = 0; for (const L of [30, 45]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; m = Math.max(m, canopyAt(x + Math.cos(a) * L, z + Math.sin(a) * L)); } return m; };
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
