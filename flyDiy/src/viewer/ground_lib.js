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
//
// AS3 (G917): THE LAYERS AS KTX2. An item may carry `ktx` { A, N } (ground_tex.js's KTX2 planes for ITS consumer's
// array - kA / kAl + kN). When the page can take them (KTX2.off() is null) and every item has them, pack() fetches
// those instead, has them TRANSCODED in the workers (src/viewer/ktx2.js), and hands back two COMPRESSED planes:
// { ktx2: true, px, format, type, levels, layers: [[level data] per layer] } - each layer's mip chain as the file
// carried it (the GPU's own generateMipmap filter, baked: tools/_ktx2_lib.js). ANY failure (a fetch, a transcode, a
// layer whose target format or mip count differs) drops the WHOLE pack back to the raw layers above, which keep the
// G751 rule; so an array is never half compressed. arrayTexture() makes the caller's texture from either kind:
// a DataArrayTexture (the GPU makes the mips) or a CompressedArrayTexture (the file's mips, generateMipmaps off),
// the same wrap, filters, anisotropy and colour space. `prev` lends layers of the same kind (a grow).
'use strict';
const GROUND_LIB = (() => {
  const PX = () => (typeof GROUND_TEX !== 'undefined' && GROUND_TEX ? GROUND_TEX.px : 512);
  const enc = v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  const stats = { packs: 0, fetched: 0, lent: 0, failed: 0, bytes: 0, ktx2Packs: 0, ktx2Layers: 0, ktx2Bytes: 0, ktx2Lent: 0, ktx2Shared: 0, ktx2Fallbacks: 0, ktx2Why: null };
  const ktxOff = () => (typeof KTX2 === 'undefined' ? 'no ktx2.js' : KTX2.off('ground'));
  function pack(items, done, prev) {
    const F = (typeof ASSET_FETCH === 'function') ? ASSET_FETCH : null;
    if (!F) { done(null, null, []); return; }
    const why = ktxOff();
    const ktxAll = items.some(it => it) && items.every(it => !it || (it.ktx && it.ktx.A && it.ktx.N));
    if (why || !ktxAll) { stats.ktx2Why = why || 'a set without KTX2 planes'; packRaw(items, done, prev); return; }
    stats.ktx2Why = null;
    packKtx(items, prev, F).then(r => done(r.A, r.N, []), e => {
      stats.ktx2Fallbacks++; stats.ktx2Why = 'fell back: ' + (e && e.message || e);
      if (typeof KTX2 !== 'undefined') KTX2._stats.fallbacks++;
      console.warn('ground library: KTX2 layers failed (' + (e && e.message || e) + ') - the raw layers stand in');
      packRaw(items, done, prev);
    });
  }
  // THE TRANSCODED LAYERS, ONE PER URL FOR THE PAGE'S LIFE: a pack that asks for a file another pack already has (or
  // has in flight - the pavement's library grows while its first pack is still in the workers) shares it: one fetch,
  // one transcode. What is kept is the layer's own compressed levels (~0.35 MB a 512^2 plane with its mips; the whole
  // library ~38 MB), the same arrays a grow would lend. A failure is not kept (the next pack tries again).
  const KT = new Map();
  function transcoded(url, F) {
    let p = KT.get(url);
    if (p) { stats.ktx2Shared++; return p; }
    p = F(url).then(b => { stats.ktx2Bytes += b.length; return KTX2.parse(b, 'ground'); });
    KT.set(url, p);
    p.catch(() => { if (KT.get(url) === p) KT.delete(url); });
    return p;
  }
  // THE KTX2 PACK: two compressed planes, or a rejection (the caller falls back to the raw layers)
  function packKtx(items, prev, F) {
    const px = PX(), n = items.length;
    const had = new Map();
    if (prev && prev.A && prev.A.ktx2 && prev.N && prev.N.ktx2 && prev.urls) prev.urls.forEach((u, j) => { if (u && prev.A.layers[j] && prev.N.layers[j]) had.set(u, j); });
    const A = { ktx2: true, px, format: null, type: null, levels: 0, layers: new Array(n) }, N = Object.assign({}, A, { layers: new Array(n) });
    const one = (plane, i, url) => transcoded(url, F).then(t => {
      if (t.width !== px || t.height !== px) throw new Error(url + ' is ' + t.width + ' x ' + t.height);
      if (plane.format === null) { plane.format = t.format; plane.type = t.type; plane.levels = t.mipmaps.length; }
      if (t.format !== plane.format || t.mipmaps.length !== plane.levels) throw new Error(url + ': another target format or mip count');
      plane.layers[i] = t.mipmaps.map(m => m.data);
      stats.ktx2Layers++;
    });
    stats.ktx2Packs++;
    const jobs = [];
    items.forEach((it, i) => {
      if (!it) { jobs.push(Promise.reject(new Error('a key the library does not know'))); return; }
      const j = it.layers ? had.get(it.layers) : undefined;
      if (j !== undefined) { A.layers[i] = prev.A.layers[j]; N.layers[i] = prev.N.layers[j]; stats.ktx2Lent++; return; }
      jobs.push(one(A, i, it.ktx.A), one(N, i, it.ktx.N));
    });
    return Promise.all(jobs).then(() => {
      // lent layers carry the previous arrays' format (one GPU, one target): check it matches the fetched ones
      for (const [P, Q] of [[A, prev && prev.A], [N, prev && prev.N]]) {
        if (P.format === null && Q) { P.format = Q.format; P.type = Q.type; P.levels = Q.levels; }
        if (Q && Q.ktx2 && stats.ktx2Lent && (Q.format !== P.format || Q.levels !== P.levels)) throw new Error('lent layers of another format');
      }
      return { A, N };
    });
  }
  // THE RAW PACK (G911, and the fallback of every KTX2 failure)
  function packRaw(items, done, prev) {
    const F = ASSET_FETCH;
    const px = PX(), S = px * px * 4, n = items.length;
    const A = new Uint8Array(S * n), N = new Uint8Array(S * n), failed = [];
    const had = new Map();
    if (prev && prev.A && prev.N && prev.urls && !prev.A.ktx2 && !prev.N.ktx2) prev.urls.forEach((u, j) => { if (u && prev.A.length >= (j + 1) * S && prev.N.length >= (j + 1) * S) had.set(u, j); });
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
  // the caller's array texture from a plane pack() delivered: raw -> DataArrayTexture (the GPU makes the mips, as
  // before AS3), KTX2 -> CompressedArrayTexture (the file's mips). o: { srgb, aniso }
  function arrayTexture(THREE, plane, n, o) {
    o = o || {};
    const px = PX();
    let t;
    if (plane && plane.ktx2) {
      const mips = [];
      for (let l = 0; l < plane.levels; l++) {
        const parts = plane.layers.map(L => L[l]), size = parts.reduce((s, d) => s + d.byteLength, 0);
        const data = new Uint8Array(size); let off = 0;
        for (const d of parts) { data.set(d, off); off += d.byteLength; }
        mips.push({ data, width: Math.max(1, px >> l), height: Math.max(1, px >> l) });
      }
      t = new THREE.CompressedArrayTexture(mips, px, px, n, plane.format, plane.type);
      t.generateMipmaps = false;
      t.minFilter = plane.levels > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    } else {
      t = new THREE.DataArrayTexture(plane, px, px, n);
      t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    }
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
    if (o.srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = o.aniso || 16;
    t.userData.groundPlane = plane;   // a grow lends its layers from here (either kind)
    t.needsUpdate = true;
    return t;
  }
  // what a grow lends from a standing array texture: its plane (raw bytes or the compressed layers)
  const planeOf = t => (t && t.userData && t.userData.groundPlane) || (t && t.image && t.image.data) || null;
  return { pack, arrayTexture, planeOf, stats: () => Object.assign({}, stats) };
})();
if (typeof window !== 'undefined') window.GROUND_LIB = GROUND_LIB;
