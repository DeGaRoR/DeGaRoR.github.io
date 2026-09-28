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
// The array-backed shapes (a texture-array layer per texture SET, a per-vertex
// slot / per-instance row into the params table) arrive with AS3's arrays; the
// shapes here are the array-free step: the same material objects three already
// draws, made once per distinct RECORD.
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
    if (m.onBeforeCompile && Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) v.onBeforeCompile = m.onBeforeCompile;
    if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) v.customProgramCacheKey = m.customProgramCacheKey;
    I.variants.set(kind, v); INFO.set(v, { sig: I.sig + '#' + kind, users: 0, variants: null, row: I.row, of: m });
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
  const stats = () => ({ asked: ST.asked, made: ST.made, hits: ST.hits, variants: ST.variants, shared: BY_SIG.size, rows: ROWS.length, share: S.share });

  return {
    SHAPES, make, shared, variant, each, users, release, sigOf, row, table, stats,
    rowOf: m => { const I = m && INFO.get(m); return I ? I.row : -1; },
    get share() { return S.share; }, set share(v) { S.share = !!v; },
  };
})();
if (typeof window !== 'undefined') window.MATLIB = MATLIB;
if (typeof module !== 'undefined' && module.exports) module.exports = MATLIB;
