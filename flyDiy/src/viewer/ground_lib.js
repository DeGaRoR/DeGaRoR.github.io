// ===========================================================================
// THE GROUND LIBRARY'S LAYERS, INTO THE ARRAYS (G911, AS2) - no canvas
// ===========================================================================
// The splat (splat_ground.js buildArrays) and the pavement (pavement.js library) each assembled their two texture
// arrays in the page: every map an Image, decoded, drawn into a 2D canvas, read back (getImageData) and shuffled
// channel by channel into a Uint8Array - ~130 images at the roll-out, on the main thread. The ground library
// (src/viewer/ground_tex.js, tools/ground_tex_prep.js) now COOKS those layers offline, packed exactly as those
// loops packed them (A = colour rgb + height a, N = normal rgb + roughness a; tools/array_cook.js; GATE GROUNDLIB
// holds every one to what the old code packed in Chrome). What is left for the page is this: fetch a set's
// cooked file (ASSET_FETCH, which gunzips a .gz.bin) and COPY its two planes into the arrays.
//
// GROUND_LIB.pack(items, done, prev)
//   items  [{ layers: url, mean: [r, g, b] linear, label }] in LAYER ORDER (null: a key the library does not
//          know - its layer stays zero, the caller says so)
//   done   (A, N, failed): two Uint8Arrays of items.length layers (px * px * 4 bytes each), and the labels of the
//          sets whose file failed - their layer is the set's MEAN colour (sRGB-encoded, height 128) over a flat
//          normal (roughness 230), the pavement's G751 rule, and never a stall. done(null, null) where there is
//          no fetch (a node harness): the caller keeps its no-array path.
//   prev   { urls, A, N } the arrays being REPLACED (a library grown by a new key): a layer already in them is
//          copied, not fetched again.
// The callers keep their own textures (format, colour space, filtering, anisotropy): what reaches the GPU is the
// same object with the same bytes as before - only how the bytes were made moved.
'use strict';
const GROUND_LIB = (() => {
  const PX = () => (typeof GROUND_TEX !== 'undefined' && GROUND_TEX ? GROUND_TEX.px : 512);
  const enc = v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  const stats = { packs: 0, fetched: 0, lent: 0, failed: 0, bytes: 0 };
  function pack(items, done, prev) {
    const F = (typeof ASSET_FETCH === 'function') ? ASSET_FETCH : null;
    if (!F) { done(null, null, []); return; }
    const px = PX(), S = px * px * 4, n = items.length;
    const A = new Uint8Array(S * n), N = new Uint8Array(S * n), failed = [];
    const had = new Map();
    if (prev && prev.A && prev.N && prev.urls) prev.urls.forEach((u, j) => { if (u && prev.A.length >= (j + 1) * S && prev.N.length >= (j + 1) * S) had.set(u, j); });
    const fill = (i, mean) => {
      const c = (mean || [0.2, 0.2, 0.2]).map(enc), o = i * S;
      for (let q = 0; q < px * px; q++) { const k = o + q * 4; A[k] = c[0]; A[k + 1] = c[1]; A[k + 2] = c[2]; A[k + 3] = 128; N[k] = 128; N[k + 1] = 128; N[k + 2] = 255; N[k + 3] = 230; }
    };
    stats.packs++;
    Promise.all(items.map((it, i) => {
      if (!it) return null;
      const j = it.layers ? had.get(it.layers) : undefined;
      if (j !== undefined) { A.set(prev.A.subarray(j * S, (j + 1) * S), i * S); N.set(prev.N.subarray(j * S, (j + 1) * S), i * S); stats.lent++; return null; }
      if (!it.layers) { failed.push(it.label); fill(i, it.mean); return null; }
      return F(it.layers).then(b => {
        if (!b || b.length !== 2 * S) throw new Error('size ' + (b && b.length));
        A.set(b.subarray(0, S), i * S); N.set(b.subarray(S, 2 * S), i * S);
        stats.fetched++; stats.bytes += b.length;
      }).catch(() => { failed.push(it.label); stats.failed++; fill(i, it.mean); });
    })).then(() => done(A, N, failed));
  }
  return { pack, stats: () => Object.assign({}, stats) };
})();
if (typeof window !== 'undefined') window.GROUND_LIB = GROUND_LIB;
