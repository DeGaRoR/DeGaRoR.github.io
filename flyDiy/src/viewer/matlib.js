// ============================================================
// MATLIB — THE MATERIAL LIBRARY (AS4a, G920; futureDesigns/ASSETS-2026-09-27.md §5.1).
//
// THE ONE PLACE A MATERIAL IS MADE. GATE ASSETS counts every
// `new THREE.*Material` outside this file against a shrinking allowlist; the
// families migrated here (props, the pier kit, the animals, the trees, the
// strip stones, the cliffs, the cover ring's rocks, the prop disc, the tyres'
// contact blobs) ask this file instead.
//
// THE SHAPES. A material is one of a few SHAPES; what varies between objects
// is DATA the shape reads (the params), never a new kind of material:
//     std     opaque PBR (MeshStandardMaterial)
//     cut     alpha-tested PBR: foliage, cards, fences
//     glass   transparent PBR (depthWrite off unless the params say)
//     glow    PBR with an emissive the day's hand dims
//     basic   unlit (MeshBasicMaterial): the loom, the flat cards
//     shader  a special shader that stays its own (ShaderMaterial)
//     house   THE TOWN'S (C3b, G855): opaque PBR whose finish is not a uniform but a SLOT into house_tarr.js's float
//             table and its texture arrays - the TARR town material (G574) and the town kit's (townkit.js: the slot
//             looked up by the vertex's ROLE x the instance's finish set). Its hook is house_tarr.js's; its rows
//             (the finishes a look wears) are the slot table's, counted here as rows of this table (`row`)
// The shapes above are the array-free step (AS4a-EARLY): the same material
// objects three already draws, made once per distinct RECORD. THE ARRAY SHAPES
// (AS4a-rest, G941; `MATLIB.arr`, below) go the rest of the way: the record a
// ROW of a float table, its maps LAYERS of texture arrays (pages of KTX2 twins,
// by kind, size and codec), the row carried per vertex - so the parts of a prop
// that wore a dozen records are one geometry drawn once by one material.
//
// ONE MATERIAL PER RECORD. `MATLIB.shared(THREE, shape, params, scope)` hands
// out ONE material per distinct (shape, params, scope): the same maps (by
// texture object) and the same values give the same material, whoever asks.
// The signature is exact - numbers at full precision, colours by their float
// channels, textures by identity - so a shared material is by construction the
// material each asker would have made (GATE MATLIB checks the uniforms three
// uploads for each draw are the same both ways). `scope` keeps apart what a
// caller will mutate on its own (a prop whose glow the day's hand dims per key,
// a dusted prop): a scoped material is shared only within its scope.
//
// ONE MATERIAL PER DRAW KIND. three keeps a material's program per object
// state, and a material drawn by a plain mesh AND an InstancedMesh (or a
// SkinnedMesh) re-derives its program parameters at every switch between them
// in the sorted list (WebGLRenderer setProgram's needsProgramChange). So a
// record's material has a sibling per draw kind - `MATLIB.variant(m, 'inst')`,
// `'skin'`, `'batch'` - the same params, its own object: one lookup a kind.
//
// THE PARAMS TABLE. Every distinct record is a ROW (`MATLIB.row(sig)`); the
// table (`MATLIB.table()`) is the rows as RGBA32F-ready floats - colour,
// roughness, metalness, normal scale, emissive, opacity, cutoff - house_tarr.js's
// slot table generalised, for the array shapes to index once AS3 lands. Today
// it is the census: `MATLIB.stats()` says how many records were asked, how many
// materials made, how many rows exist.
//
// THE A/B. `MATLIB.share = false` (or `?matlib=0` on the page) makes every ask a
// fresh material, as before the library: GATE MATLIB renders a sample of every
// migrated family both ways on the recording GL and compares.
// ============================================================
'use strict';
var MATLIB = (() => {
  const SHAPES = {
    std:    { cls: 'MeshStandardMaterial', base: {} },
    cut:    { cls: 'MeshStandardMaterial', base: {} },
    glass:  { cls: 'MeshStandardMaterial', base: { transparent: true } },
    glow:   { cls: 'MeshStandardMaterial', base: {} },
    basic:  { cls: 'MeshBasicMaterial', base: {} },
    shader: { cls: 'ShaderMaterial', base: {} },
    depth:  { cls: 'MeshDepthMaterial', base: {} },
    house:  { cls: 'MeshStandardMaterial', base: { color: 0xffffff, roughness: 1, metalness: 0 } },
  };
  const S = { share: true };
  if (typeof location !== 'undefined' && /[?&]matlib=0/.test(location.search || '')) S.share = false;
  const BY_SIG = new Map();      // sig -> material
  const INFO = new WeakMap();    // material -> { sig, users, variants: Map(kind -> material), row }
  const ROWS = [];               // row -> { sig, shape, p }
  const ROW_OF = new Map();      // sig -> row
  const ST = { made: 0, asked: 0, hits: 0, variants: 0 };

  // ---- the only constructor site -----------------------------------------------------------------
  function make(THREE, shape, params) {
    const sh = SHAPES[shape];
    if (!sh) throw new Error('MATLIB: unknown shape ' + shape);
    ST.made++;
    return new THREE[sh.cls](Object.assign({}, sh.base, params || {}));
  }

  // ---- the signature: exact, by identity for textures ----------------------------------------------
  const num = v => Object.is(v, -0) ? '0' : String(v);
  function val(v) {
    if (v === null || v === undefined) return '~';
    if (typeof v === 'number') return num(v);
    if (typeof v === 'boolean' || typeof v === 'string') return String(v);
    if (typeof v === 'function') return 'fn';
    if (v.isTexture) return 't' + v.uuid;
    if (v.isColor) return 'c' + num(v.r) + ',' + num(v.g) + ',' + num(v.b);
    if (v.isVector2) return 'v' + num(v.x) + ',' + num(v.y);
    if (v.isVector3) return 'v' + num(v.x) + ',' + num(v.y) + ',' + num(v.z);
    if (v.isVector4) return 'v' + num(v.x) + ',' + num(v.y) + ',' + num(v.z) + ',' + num(v.w);
    if (Array.isArray(v)) return '[' + v.map(val).join(',') + ']';
    if (typeof v === 'object') return '{' + Object.keys(v).sort().map(k => k + ':' + val(v[k])).join(',') + '}';
    return String(v);
  }
  function sigOf(shape, params, scope) {
    const p = params || {};
    return shape + '|' + (scope || '') + '|' + Object.keys(p).sort().map(k => k + '=' + val(p[k])).join('|');
  }

  // ---- the params table ----------------------------------------------------------------------------
  // a row per distinct record; the floats a shape reads, 4 x 4 a row:
  //   [col.r, col.g, col.b, opacity] [rough, metal, normalScale, cutoff] [emis.r, emis.g, emis.b, emisK] [envK, aoK, flags, 0]
  function row(sig, shape, p) {
    let r = ROW_OF.get(sig);
    if (r !== undefined) return r;
    r = ROWS.length; ROWS.push({ sig, shape, p }); ROW_OF.set(sig, r);
    return r;
  }
  const W = 16;
  function table() {
    const out = new Float32Array(Math.max(1, ROWS.length) * W);
    ROWS.forEach((R, i) => {
      const p = R.p || {}, o = i * W, c = p.color, e = p.emissive, n = p.normalScale;
      if (c && c.isColor) { out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; } else { out[o] = out[o + 1] = out[o + 2] = 1; }
      out[o + 3] = p.opacity === undefined ? 1 : p.opacity;
      out[o + 4] = p.roughness === undefined ? 1 : p.roughness; out[o + 5] = p.metalness || 0;
      out[o + 6] = n && n.isVector2 ? n.x : 1; out[o + 7] = p.alphaTest || 0;
      if (e && e.isColor) { out[o + 8] = e.r; out[o + 9] = e.g; out[o + 10] = e.b; }
      out[o + 11] = p.emissiveIntensity === undefined ? 1 : p.emissiveIntensity;
      out[o + 12] = p.envMapIntensity === undefined ? 1 : p.envMapIntensity; out[o + 13] = p.aoMapIntensity === undefined ? 1 : p.aoMapIntensity;
      out[o + 14] = (p.transparent ? 1 : 0) + (p.side === 2 ? 2 : 0) + (p.flatShading ? 4 : 0);
    });
    return { data: out, rows: ROWS.length, width: W };
  }

  // ---- one material per record ----------------------------------------------------------------------
  function shared(THREE, shape, params, scope) {
    ST.asked++;
    const sig = sigOf(shape, params, scope);
    const r = row(sig, shape, params);
    if (!S.share) { const m = make(THREE, shape, params); INFO.set(m, { sig, users: 1, variants: null, row: r, fresh: true }); return m; }
    let m = BY_SIG.get(sig);
    if (m) { ST.hits++; INFO.get(m).users++; return m; }
    m = make(THREE, shape, params);
    INFO.set(m, { sig, users: 1, variants: null, row: r, shape, params });
    BY_SIG.set(sig, m);
    return m;
  }
  // a sibling for another draw kind ('inst', 'skin', 'batch'): the same record, its own object, made once. A material
  // this library did not share (a scoped fresh one under the A/B, a caller's own) is its own answer.
  function variant(THREE, m, kind) {
    const I = m && INFO.get(m);
    if (!I || I.fresh || !I.params || !kind) return m;
    if (!I.variants) I.variants = new Map();
    let v = I.variants.get(kind);
    if (v) return v;
    v = make(THREE, I.shape, I.params);
    // what a caller set on the record's material after it was made (the prop library's env0, its glow and its env
    // factor) is carried over, and kept in step by `each`
    v.userData = Object.assign({}, m.userData);
    for (const k of ['envMapIntensity', 'emissiveIntensity', 'name']) if (m[k] !== undefined) v[k] = m[k];
    // the material's own hook: an own property on a bench, kept aside as _atmoHook where the game's ATMO serves every
    // hook wrapped (atmo.js's prototype accessor) - an array shape's hook IS the shape, so it must reach every sibling
    const hook = I.hook || (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') ? m.onBeforeCompile : null);
    if (hook) v.onBeforeCompile = hook;
    if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) v.customProgramCacheKey = m.customProgramCacheKey;
    if (I.arr) arrExpose(v, I.arr);
    I.variants.set(kind, v); INFO.set(v, { sig: I.sig + '#' + kind, users: 0, variants: null, row: I.row, of: m, arr: I.arr || null });
    ST.variants++;
    return v;
  }
  // the material and its variants: a caller that sets a value on a record's material sets it on all of them
  function each(m, fn) { fn(m); const I = m && INFO.get(m); if (I && I.variants) for (const v of I.variants.values()) fn(v); }
  function users(m) { const I = m && INFO.get(m); return I ? I.users : 0; }
  // one user gone; the last one disposes the material (and its variants) and forgets its signature
  function release(m) {
    const I = m && INFO.get(m);
    if (!I) { if (m && m.dispose) m.dispose(); return; }
    if (--I.users > 0) return;
    if (BY_SIG.get(I.sig) === m) BY_SIG.delete(I.sig);
    each(m, x => x.dispose());
  }
  // ================================================================================================================
  // THE ARRAY SHAPES (AS4a-rest, G941): ONE MATERIAL PER SHAPE, THE RECORD A ROW, THE MAPS ARRAY LAYERS
  // ================================================================================================================
  // A record's material differs from its neighbour's by its maps and its numbers. Here both become DATA: the numbers
  // a ROW of a float table (`rows`: 8 texels a row - colour and opacity, roughness / metalness / normal scale / ao,
  // the layers, the flat maps' constants), the maps LAYERS of texture arrays, and the geometry carries its row per
  // vertex (`mlRow`). So the parts of a prop that wore a dozen records are ONE geometry drawn ONCE by ONE material
  // - the shape's (std: opaque, unlit), per side and flat shading and per set of PAGES.
  //
  // THE PAGES. A page is one texture array: layers of ONE kind (color - sRGB, normal, data - the arm map), one size
  // and one KTX2 codec + alpha (the transcoder picks the GPU format from those, so a page is one format by
  // construction - BC7 on a desktop for both codecs, but ETC2 / ASTC apart on a phone). A layer is a KTX2 twin
  // (AS3, src/viewer/ktx2_twins.js) as the workers transcoded it - the SAME transcode the record's own 2D texture
  // takes (KTX2.load is one per url): the same blocks, the same mips, sampled the same. "Raw otherwise": a map with
  // no twin, or a page with KTX2 off, keeps its record's material (the caller asks `twinOf` first).
  //   A page is OPEN until three first uploads it: every layer asked for lands in it, and it grows (nothing is on the
  //   GPU yet: the layers' data wait in the transcodes). Its first upload SEALS it at the layers it holds - a later
  //   layer opens the next page (a new material for the props that land there), so a page is NEVER re-allocated nor
  //   re-uploaded whole: a layer that lands after the seal is uploaded alone (three's layerUpdates). In the game every
  //   prop the loading builds is asked for before the loading's 'upload' step, which seals the pages it finds.
  //   The page keeps no copy of the layers: its `mipmaps` are assembled from the transcodes when three reads them to
  //   upload, and dropped after (onUpdate) - the transcodes are what the records' own textures hold anyway.
  //   A layer whose twin FAILS (a fetch, a transcode, another format): its rows fall back - a colour map to the
  //   twin's mean colour (the table's), a normal or an arm map to none - and the page's slot stays black.
  //
  // THE SHADER (`hook`): three's MeshStandardMaterial, its map / roughness / metalness / normal / ao chunks read from
  // the row and the arrays - three's own arithmetic, in its order (color x map, roughness x arm.g, metalness x arm.b,
  // the normal through the same derivative tangent frame, the ao on the indirect light and the specular occlusion).
  // Every array is sampled OUTSIDE any branch (a row changes between neighbouring pixels at a triangle's edge, and a
  // derivative in a divergent branch is undefined: house_tarr.js's rule) and used by the row's say-so. ONE program
  // for every page set (the hook's text is the key).
  //
  //   MATLIB.arr.on                       ?matarr=0 (or share off) -> false: every caller keeps its records
  //   MATLIB.arr.twin(url, kind)          the KTX2 twin a layer can be made of, or null (no twin, KTX2 off)
  //   MATLIB.arr.layer(THREE, tw)         -> { page, index } (one per twin url and kind)
  //   MATLIB.arr.row(THREE, r)            -> the row index for r = { col, opacity, rough, metal, norScl, ao,
  //                                          map / nor / arm: { page, index } | [r, g, b] (flat) | null, mean }
  //   MATLIB.arr.material(THREE, o)       -> the shape's material for o = { side, flat, pages: { map, nor, arm } }
  //   MATLIB.arr.stats()                  pages, layers, rows, materials, uploads, fallbacks
  const ARR = { on: true };
  if (typeof location !== 'undefined' && /[?&]matarr=0/.test(location.search || '')) ARR.on = false;
  const AST = { pages: 0, sealed: 0, layers: 0, landed: 0, failed: 0, rows: 0, mats: 0, uploads: 0, bytes: 0, partial: 0 };
  const POOLS = new Map();        // 'kind|w x h|codec|alpha' -> [page]
  const LAYERS = new Map();       // twin url + '|' + kind -> { page, index, rows: Set }
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  function twin(url, kind) {
    if (!ARR.on || !S.share || typeof url !== 'string' || typeof KTX2_TWINS !== 'function' || typeof KTX2 === 'undefined') return null;
    const t = KTX2_TWINS(url, kind); if (!t || KTX2.off(t.fam)) return null;
    return (t.w && t.h && t.codec) ? Object.assign({ kind }, t) : null;
  }
  function newPage(THREE, key, tw) {
    const pg = { id: ++AST.pages, key, kind: tw.kind, w: tw.w, h: tw.h, list: [], sealed: false, format: null, type: null, levels: 0, cache: null };
    const t = new THREE.CompressedArrayTexture([], tw.w, tw.h, 0);
    t.image.depth = 0;
    // THE LAYERS, ASSEMBLED WHEN THREE READS THEM (to upload; dropped once it has): every layer that landed, or only the
    // ones a sealed page is sent (layerUpdates), the rest zero
    Object.defineProperty(t, 'mipmaps', { configurable: true, enumerable: true, set() {}, get() {
      if (pg.cache) return pg.cache;
      const upd = t.layerUpdates, n = t.image.depth, ref = pg.list.find(L => L.mips);
      if (!ref) return [];
      const out = [];
      for (let l = 0; l < pg.levels; l++) {
        const per = ref.mips[l].data.byteLength;
        if (upd.size) {
          // A SEALED PAGE IS SENT ITS NEW LAYERS ONLY: three slices each one out of the level's data by its index
          // (subarray(i * per, (i + 1) * per)) - handed the layer's own bytes, no full-depth copy
          const at = i => { const L = pg.list[i]; return L && L.mips ? L.mips[l].data : new Uint8Array(per); };
          out.push({ data: { BYTES_PER_ELEMENT: 1, byteLength: per * n, length: per * n, subarray: a => at(Math.round(a / per)) }, width: ref.mips[l].width, height: ref.mips[l].height });
          continue;
        }
        const data = new Uint8Array(per * n);
        pg.list.forEach((L, i) => { if (L.mips) data.set(L.mips[l].data, i * per); });
        out.push({ data, width: ref.mips[l].width, height: ref.mips[l].height });
      }
      return (pg.cache = out);
    } });
    t.onUpdate = () => { AST.uploads++; if (!pg.sealed) { pg.sealed = true; AST.sealed++; } pg.cache = null; };
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = false; t.flipY = false;
    if (tw.kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;   // the props' own (props.js PROP_ANISO)
    t.name = 'matlib:page:' + key + '#' + pg.id;
    pg.tex = t; pg.uniform = { value: t };
    let list = POOLS.get(key); if (!list) POOLS.set(key, list = []);
    list.push(pg);
    return pg;
  }
  function layer(THREE, tw) {
    // G1230: under the budget's mip skip (ktx2.js) a layer lands at half its side - its page is that size (its own pool)
    if (KTX2.dim && KTX2.dim(tw.w) !== tw.w) tw = Object.assign({}, tw, { w: tw.w >> 1, h: Math.max(1, tw.h >> 1), skip: 1 });
    const lk = tw.url + '|' + tw.kind + (tw.skip ? '|skip' : '');
    let L = LAYERS.get(lk);
    if (L) return L;
    const key = tw.kind + '|' + tw.w + 'x' + tw.h + '|' + tw.codec + '|' + (tw.alpha ? 'a' : '');
    const list = POOLS.get(key), last = list && list[list.length - 1];
    const pg = last && !last.sealed ? last : newPage(THREE, key, tw);
    L = { page: pg, index: pg.list.length, url: tw.url, kind: tw.kind, mean: tw.mean, mips: null, failed: false, rows: new Set() };
    pg.list.push(L); pg.tex.image.depth = pg.list.length; pg.cache = null;
    LAYERS.set(lk, L); AST.layers++;
    KTX2.load(tw.url, tw.fam).then(r => {
      if (pg.format === null) { pg.format = r.format; pg.type = r.type; pg.levels = r.mipmaps.length; pg.tex.format = r.format; pg.tex.type = r.type;
        if (pg.levels < 2) pg.tex.minFilter = THREE.LinearFilter; }
      if (r.format !== pg.format || r.mipmaps.length !== pg.levels || r.width !== pg.w || r.height !== pg.h) throw new Error('another format, size or mip count than its page');
      L.mips = r.mipmaps; AST.landed++;
      for (const m of r.mipmaps) AST.bytes += m.data.byteLength;
      pg.cache = null;
      if (pg.sealed) { pg.tex.addLayerUpdate(L.index); AST.partial++; }
      pg.tex.needsUpdate = true;
    }).catch(e => {
      L.failed = true; AST.failed++;
      if (typeof console !== 'undefined') console.warn('matlib: the layer ' + tw.url + ' did not land (' + (e && e.message || e) + '): its rows fall back');
      for (const r of L.rows) rowFallback(r, L);
    });
    return L;
  }

  // ---- the rows: 8 texels (RGBA32F) a row, packed 1024 texels wide ---------------------------------------------------
  //   0 colour rgb, opacity       1 roughness, metalness, normal scale, ao intensity (0: none)
  //   2 (emissive: unused)        3 layers: map, normal, arm, - (>= 0 a layer of the material's page; -1 none; -2 flat)
  //   4 the flat map's colour, linear   5 the flat normal's texel   6 the flat arm's texel   7 -
  const RW = 1024, RN = 8;
  const RT = { cap: 0, n: 0, data: null, tex: null, uniform: { value: null }, sig: new Map(), recs: [] };
  function rowTex(THREE, need) {
    if (RT.tex && need <= RT.cap) return;
    let cap = Math.max(128, RT.cap); while (cap < need) cap *= 2;
    const data = new Float32Array(cap * RN * 4);
    if (RT.data) data.set(RT.data);
    const t = new THREE.DataTexture(data, RW, cap * RN / RW, THREE.RGBAFormat, THREE.FloatType);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.name = 'matlib:rows';
    t.needsUpdate = true;
    const old = RT.tex;
    RT.tex = t; RT.data = data; RT.cap = cap; RT.uniform.value = t;
    if (old) old.dispose();
  }
  function rowWrite(i, r) {
    const o = i * RN * 4, D = RT.data, lay = x => (x && x.page) ? x.index : Array.isArray(x) ? -2 : -1;
    D.fill(0, o, o + RN * 4);
    D[o] = r.col[0]; D[o + 1] = r.col[1]; D[o + 2] = r.col[2]; D[o + 3] = r.opacity === undefined ? 1 : r.opacity;
    D[o + 4] = r.rough; D[o + 5] = r.metal; D[o + 6] = r.norScl === undefined ? 1 : r.norScl; D[o + 7] = r.ao ? 1 : 0;
    D[o + 12] = lay(r.map); D[o + 13] = lay(r.nor); D[o + 14] = lay(r.arm); D[o + 15] = -1;
    if (Array.isArray(r.map)) { D[o + 16] = lin(r.map[0]); D[o + 17] = lin(r.map[1]); D[o + 18] = lin(r.map[2]); D[o + 19] = 1; }
    if (Array.isArray(r.nor)) { D[o + 20] = r.nor[0] / 255; D[o + 21] = r.nor[1] / 255; D[o + 22] = r.nor[2] / 255; D[o + 23] = 1; }
    if (Array.isArray(r.arm)) { D[o + 24] = r.arm[0] / 255; D[o + 25] = r.arm[1] / 255; D[o + 26] = r.arm[2] / 255; D[o + 27] = 1; }
    if (RT.tex) RT.tex.needsUpdate = true;
  }
  // a layer that did not land: its colour becomes the twin's mean (flat, as G903 ships a constant), a normal or an arm none
  function rowFallback(i, L) {
    const r = RT.recs[i]; if (!r) return;
    for (const k of ['map', 'nor', 'arm']) if (r[k] === L) r[k] = k === 'map' && L.mean ? L.mean.map(v => Math.round(v)) : null;
    if (!r.arm) r.ao = false;
    rowWrite(i, r); AST.fallbacks = (AST.fallbacks || 0) + 1;
  }
  function arow(THREE, r) {
    const ref = x => (x && x.page) ? 'p' + x.page.id + '.' + x.index : Array.isArray(x) ? 'f' + x.join(',') : '-';
    const sig = [r.col.map(num).join(','), num(r.opacity === undefined ? 1 : r.opacity), num(r.rough), num(r.metal), num(r.norScl === undefined ? 1 : r.norScl),
      r.ao ? 1 : 0, ref(r.map), ref(r.nor), ref(r.arm)].join('|');
    let i = RT.sig.get(sig);
    if (i !== undefined) return i;
    if (RT.n >= 65535) throw new Error('matlib: 65 535 rows (the geometry carries a row in 16 bits)');
    i = RT.n++; rowTex(THREE, RT.n);
    const rec = Object.assign({}, r, { col: r.col.slice() });
    RT.recs[i] = rec; RT.sig.set(sig, i); AST.rows++;
    for (const k of ['map', 'nor', 'arm']) if (rec[k] && rec[k].page) { rec[k].rows.add(i); if (rec[k].failed) rowFallback(i, rec[k]); }
    rowWrite(i, rec);
    return i;
  }

  // ---- the shape ------------------------------------------------------------------------------------------------------
  const NO_PAGE = { value: null };
  const ARR_VERT_PARS = '\nattribute float mlRow;\nflat varying float vMlRow;\n';
  const ARR_FRAG_PARS = `
uniform highp sampler2D mlRows;
uniform highp sampler2DArray mlMap, mlNor, mlArm;
flat varying float vMlRow;
vec4 mlFetch(int k) { int t = int(vMlRow + 0.5) * ${RN} + k; return texelFetch(mlRows, ivec2(t % ${RW}, t / ${RW}), 0); }
mat3 mlFrame(vec3 eye_pos, vec3 surf_norm, vec2 uv) {
  vec3 q0 = dFdx(eye_pos.xyz), q1 = dFdy(eye_pos.xyz);
  vec2 st0 = dFdx(uv.st), st1 = dFdy(uv.st);
  vec3 N = surf_norm, q1perp = cross(q1, N), q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x, B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B)), scale = (det == 0.0) ? 0.0 : inversesqrt(det);
  return mat3(T * scale, B * scale, N);
}
`;
  // three's chunks, from the row (the arrays sampled unconditionally, at layer 0 where the row has none)
  const ARR_MAP = `
  vec4 mlC = mlFetch(0), mlP = mlFetch(1), mlL = mlFetch(3);
  vec4 mlTA = texture(mlMap, vec3(vUv, max(mlL.x, 0.0)));
  vec4 mlTN = texture(mlNor, vec3(vUv, max(mlL.y, 0.0)));
  vec4 mlTR = texture(mlArm, vec3(vUv, max(mlL.z, 0.0)));
  if (mlL.x < -1.5) mlTA = mlFetch(4);
  if (mlL.y < -1.5) mlTN = mlFetch(5);
  if (mlL.z < -1.5) mlTR = mlFetch(6);
  diffuseColor = vec4(mlC.rgb, mlC.a);
  if (mlL.x > -0.5 || mlL.x < -1.5) diffuseColor *= mlTA;
  bool mlHasArm = mlL.z > -0.5 || mlL.z < -1.5;
`;
  const ARR_ROUGH = '  float roughnessFactor = mlP.x;\n  if (mlHasArm) roughnessFactor *= mlTR.g;\n';
  const ARR_METAL = '  float metalnessFactor = mlP.y;\n  if (mlHasArm) metalnessFactor *= mlTR.b;\n';
  const ARR_NORMAL = `
  mat3 mlTbn = mlFrame(- vViewPosition, normal, vUv);
  #ifdef DOUBLE_SIDED
    mlTbn[0] *= faceDirection;
    mlTbn[1] *= faceDirection;
  #endif
  if (mlL.y > -0.5 || mlL.y < -1.5) {
    vec3 mapN = mlTN.xyz * 2.0 - 1.0;
    mapN.xy *= vec2(mlP.z);
    normal = normalize(mlTbn * mapN);
  }
`;
  const ARR_AO = `
  if (mlP.w > 0.0) {
    float ambientOcclusion = ( mlTR.r - 1.0 ) * mlP.w + 1.0;
    reflectedLight.indirectDiffuse *= ambientOcclusion;
    #if defined( USE_ENVMAP ) && defined( STANDARD )
      float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
      reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
    #endif
  }
`;
  function arrEdit(sh, miss) {
    const rep = (src, a, b) => { if (src.indexOf(a) < 0) { miss.push(a); return src; } return src.replace(a, () => b); };
    sh.vertexShader = rep(sh.vertexShader, '#include <common>', '#include <common>' + ARR_VERT_PARS);
    sh.vertexShader = rep(sh.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n  vMlRow = mlRow;');
    let f = rep(sh.fragmentShader, '#include <common>', '#include <common>' + ARR_FRAG_PARS);
    f = rep(f, '#include <map_fragment>', ARR_MAP);
    f = rep(f, '#include <roughnessmap_fragment>', ARR_ROUGH);
    f = rep(f, '#include <metalnessmap_fragment>', ARR_METAL);
    f = rep(f, '#include <normal_fragment_maps>', ARR_NORMAL);
    f = rep(f, '#include <aomap_fragment>', ARR_AO);
    sh.fragmentShader = f;
    return sh;
  }
  // the textures a material reads through its hook, where the loading's upload walk sees them (app.js uploadSliced
  // walks a material's own texture properties): the pages' and the rows'
  function arrExpose(m, o) {
    const get = u => ({ configurable: true, enumerable: true, get: () => u.value });
    Object.defineProperty(m, 'mlRowsTex', get(RT.uniform));
    for (const k of ['map', 'nor', 'arm']) Object.defineProperty(m, 'ml' + k[0].toUpperCase() + k.slice(1) + 'Page', get(o.pages[k] ? o.pages[k].uniform : NO_PAGE));
  }
  function material(THREE, o) {
    const pages = o.pages || {}, side = o.side || 0, flat = !!o.flat;
    const sig = 'arr|std|' + side + '|' + (flat ? 1 : 0) + '|' + ['map', 'nor', 'arm'].map(k => pages[k] ? pages[k].id : '-').join(',');
    let m = BY_SIG.get(sig);
    if (m) { ST.hits++; INFO.get(m).users++; return m; }
    rowTex(THREE, 1);
    const params = { color: new THREE.Color(1, 1, 1), roughness: 1, metalness: 0, side: side === 2 ? THREE.DoubleSide : side === 1 ? THREE.BackSide : THREE.FrontSide,
      flatShading: flat, envMapIntensity: 1, defines: { STANDARD: '', USE_UV: '' } };
    m = make(THREE, 'std', params);
    const U = { mlRows: RT.uniform, mlMap: pages.map ? pages.map.uniform : NO_PAGE, mlNor: pages.nor ? pages.nor.uniform : NO_PAGE, mlArm: pages.arm ? pages.arm.uniform : NO_PAGE };
    const hook = function (sh) { Object.assign(sh.uniforms, U); arrEdit(sh, []); };
    hook.toString = () => 'matlib.arr.std';   // the program key: ONE program for every page set (the samplers are uniforms)
    m.onBeforeCompile = hook;
    m.name = 'matlib:arr';
    m.userData.env0 = 1.0;
    const arr = { pages, side, flat };
    arrExpose(m, arr);
    INFO.set(m, { sig, users: 1, variants: null, row: -1, shape: 'std', params, hook, arr });
    BY_SIG.set(sig, m); AST.mats++;
    return m;
  }
  const arrStats = () => Object.assign({}, AST, { on: ARR.on, rowsCap: RT.cap, pools: [...POOLS.entries()].map(([k, l]) => k + ':' + l.map(p => p.list.length + (p.sealed ? 's' : '')).join('/')) });
  const arr = { get on() { return ARR.on && S.share; }, set on(v) { ARR.on = !!v; }, twin, layer, row: arow, material, stats: arrStats, edit: arrEdit,
    rowOf: i => RT.recs[i] || null, rowData: () => ({ data: RT.data, n: RT.n, width: RW, per: RN }), pages: () => [...POOLS.values()].flat(), isArr: m => !!(m && INFO.get(m) && INFO.get(m).arr) };

  const stats = () => ({ asked: ST.asked, made: ST.made, hits: ST.hits, variants: ST.variants, shared: BY_SIG.size, rows: ROWS.length, share: S.share });

  return {
    SHAPES, make, shared, variant, each, users, release, sigOf, row, table, stats, arr,
    rowOf: m => { const I = m && INFO.get(m); return I ? I.row : -1; },
    get share() { return S.share; }, set share(v) { S.share = !!v; },
  };
})();
if (typeof window !== 'undefined') window.MATLIB = MATLIB;
if (typeof module !== 'undefined' && module.exports) module.exports = MATLIB;
