// house_tarr.js — THE TOWN ON TEXTURE ARRAYS (G574, the user: "performance optimization using texture arrays ...
// handling texture arrays and single material"). G566 merged a cell's house bags per DISTINCT material and still
// drew ~2 300 times over Jolene: a house finish is a material each (its paint, its dirt, its weather), so 929 of them
// stayed distinct. Here every finish (clapboard, shingle, trim, ...) is a LAYER of a stack, and what made two
// materials differ travels with the vertex: ONE float, the SLOT, an index into a small float table that carries the
// finish's colour, roughness, metalness, normal scale, its layers and uv transform, its paint and blend mode, its
// dirt, its age, the house's own dirt line / punch / noise and the weather clouds. A cell of the town is then a
// handful of draws: the plain bags on one material, the glass (and the lit windows) on another.
//
//   HOUSE_TARR.make(THREE, opts) -> T                      opts: { px (the layer size, 512), onReady() }
//     T.classify(mesh)   -> null | { kind: 'plain' | 'glass', key }   (can this bag ride the arrays - and on what)
//     T.begin()          the slot registry and the layer wish list start over (a rebake)
//     T.merge(list, kind, side) -> BufferGeometry                      world space, the sag baked, aSlot per vertex
//     T.end()            the table uploaded; returns false (and builds the arrays, then calls onReady) when a layer
//                        the bake asked for is not in the stack yet - the caller keeps its G566 bake until then
//     T.material(kind, side, dith, bare)   the shared town materials
//                        opts.lod = { U, decl, glsl } (G801, render_premises' LOD band): the host's uniforms, their
//                        declaration and a fragment block run first in main - the near rung's dithered exit at the lod-1
//                        edge; a program of its own (the cache key says so)
//     T.lit              { value }: the lamps' factor for the lit panes (render_premises' LAMPS drives it)
//     T.stats            { layers, nrLayers, slots, mb, builds }
//
// THE LOOK IS THE HOUSE'S OWN SHADER, NOT A COPY. The town material's hook is the house generator's (shadeHouse +
// cloudWeather, or shadeGlass) run on the program as it is, then four edits: the finish's uniforms become globals
// filled from the slot at the top of main; the map / roughness / metalness / normal-map chunks sample the arrays; the
// material colour is the slot's; the ridge sag (a vertex-shader bend in the house's own frame) is 0 because the merge
// bakes it into the positions. G581 mended three dials the house shader had never drawn, and the town follows: the
// map's scale (uUvK) is folded into the slot's uv transform and the courses' wander (uWander) rides the slot's spare
// .w, added to the array uv exactly as wanderUV adds it to the house's; the house's world height (uDirtY0) is folded
// into the slot's dirt line; the glass's own envMapIntensity (uGlassEnvK) rides its slot. So the dirt line, the punch,
// the paint blends, the noise, the clouds, the curtains and the lit panes are the very GLSL the house draws with;
// GATE TARR holds the edits.
//
// WHAT RIDES AND WHAT DOES NOT (classify): a MeshStandardMaterial hooked by the house generator ONLY (its raw hook
// is the one shadeHouse / cloudWeather / shadeGlass left - a steel mix, a lot patch or any other hook wrapped over
// it fails the identity), opaque, no vertex colours, no emissive (the glass's own lit term aside), no map beyond
// map / normalMap / roughnessMap, the three sharing one uv transform, their images decoded. Everything else stays on
// G566's per-material merge, unchanged.
//
// THE ARRAYS are built on the CPU (splat_ground.js's recipe and its two rules, learned on ANGLE/D3D: an sRGB array
// upload came back GL_INVALID_VALUE, so the colour layers are linear bytes and the shader decodes; implicit
// texture() only, and here outside any branch). A layer is px x px: 1024 sets are halved, 256 sets doubled. The
// rows are flipped on the canvas (three uploads a plain texture with flipY; an array cannot), so uv means what it
// meant. Colour: diff / paint. Normal + rough: the normal map's rgb, the rough map's green in alpha (what three
// reads). ~1.3 MB a layer at 512 with its mips.
//
// THE LAYERS COOKED OFFLINE (G840, C2c of QUEUE-C; ARCH-2026-09-27 §3.2 (a), §3.4 step 4). That canvas pass - every
// map drawn, read back with getImageData and shuffled on the main thread, ~84 MB with the mips over Jolene - is now
// done ONCE by tools/tarr_cook.js, which runs THIS file's `packer` (the page's own code) in headless Chrome over every
// house texture set and ships each layer as the bytes it made (media/tex/house_tarr/, one gzip stream a layer, named
// in src/viewer/house_tarr_pack.js). The stack FETCHES a layer the pack names (ASSET_FETCH: gunzipped off the thread)
// and copies it into place; a map the pack does not name (a baked canvas sheet, a set added after the cook) and a
// fetch that fails take the canvas pass as before. A cooked map rides the stack before its image has decoded.
//   ?tarrfmt=canvas   the canvas pass for every layer (the A/B's "before", byte for byte)
//   ?tarrfmt=raw      the cooked raw layers (the default when the pack exists)
//   ?tarrfmt=ktx2     reserved for AS3's compressed layers (KTX2 / Basis): the pack's `fmt` and FMTS below are the one
//                     switch - a format is { fetch(src) -> bytes, mk(layers) -> the array texture }; until its loader
//                     lands, ktx2 reads raw
//   ?tarrcheck=1      every cooked layer ALSO drawn by the canvas and compared (stats.check: same / differ / worst)
'use strict';
const HOUSE_TARR = (() => {
  const NS = 9, TW = 1024;   // texels a slot; the table's width
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---- THE LAYER PACKING (G840): one function for the page's canvas fallback AND the offline cook ----------------
  // (tools/tarr_cook.js runs it in headless Chrome and ships its bytes, so a cooked layer IS what the page would draw).
  // albedo(img): a colour map's layer - drawn at px x px, the rows flipped (three uploads a plain texture with flipY,
  // an array cannot), alpha 255; a FLAT map ([r, g, b]) filled with its constant. nr(n, r): the normal map's rgb
  // ((128, 128, 255) without one) and the rough map's green in alpha (255 without one).
  function packer(px, doc) {
    const S = px * px * 4;
    const cnv = doc.createElement('canvas'); cnv.width = cnv.height = px;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const draw = img => { if (Array.isArray(img)) { const d = new Uint8ClampedArray(S); for (let j = 0; j < S; j += 4) { d[j] = img[0]; d[j + 1] = img[1]; d[j + 2] = img[2]; d[j + 3] = 255; } return d; }
      ctx.setTransform(1, 0, 0, -1, 0, px); ctx.clearRect(0, 0, px, px); ctx.drawImage(img, 0, 0, px, px); return ctx.getImageData(0, 0, px, px).data; };
    return {
      albedo(img) { const d = new Uint8Array(S); d.set(draw(img)); for (let k = 3; k < S; k += 4) d[k] = 255; return d; },
      nr(n, r) {
        const d = new Uint8Array(S);
        if (n) d.set(draw(n)); else for (let j = 0; j < S; j += 4) { d[j] = 128; d[j + 1] = 128; d[j + 2] = 255; }
        if (r) { const rd = draw(r); for (let j = 0; j < S; j += 4) d[j + 3] = rd[j + 1]; } else for (let j = 3; j < S; j += 4) d[j] = 255;
        return d;
      },
    };
  }
  // the far town's mean colour of a map (render_premises meanOf, G559): the channel sums of a 4 x 4 draw, the page's
  // canvas settings - cooked too (the pack's `sums`), so the far-town merge reads no pixels either
  let S16 = null;
  function sums16(img, doc) {
    if (!S16) { S16 = doc.createElement('canvas'); S16.width = S16.height = 4; }
    const x = S16.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, 4, 4); x.drawImage(img, 0, 0, 4, 4);
    const d = x.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0;
    for (let i = 0; i < 64; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    return [r, g, b];
  }
  // a map's name in the pack: its media path ('media/tex/house/<file>'), a flat constant 'flat:r,g,b', no map 'none';
  // null for what the cook cannot know (a canvas sheet, a data URL)
  function keyOf(img) {
    if (!img) return 'none';
    if (Array.isArray(img)) return 'flat:' + img.slice(0, 3).join(',');
    const s = typeof img.src === 'string' ? img.src : null, m = s && /media\/tex\/[^?#]+/.exec(s);
    return m ? m[0] : null;
  }
  const keyA = img => { const k = keyOf(img); return k && k !== 'none' ? 'a|' + k : null; };
  const keyN = (n, r) => { const a = keyOf(n), b = keyOf(r); return a && b ? 'nr|' + a + '|' + b : null; };
  // the cooked pack as this page reads it (null: the canvas pass everywhere) - the format switch
  function fmtAsked() {
    try { const q = typeof location !== 'undefined' && location.search ? /[?&]tarrfmt=(\w+)/.exec(location.search) : null; if (q) return q[1]; } catch (e) {}
    try { const v = typeof localStorage !== 'undefined' && localStorage.getItem('flydiy.tarrfmt'); if (v) return v; } catch (e) {}
    return null;
  }
  const FMTS = {
    // the raw layers: the page's own bytes, one gzip stream each (ASSET_FETCH gunzips by the .gz.bin suffix)
    raw: { fetch: (url, G) => G.ASSET_FETCH(url) },
  };
  function cookOf(o) {
    const G = typeof window !== 'undefined' ? window : {};
    const pack = o.pack !== undefined ? o.pack : (G.HOUSE_TARR_PACK || null);
    const want = o.fmt || fmtAsked() || (pack && pack.fmt) || 'raw';
    if (!pack || want === 'canvas' || pack.px !== o.px || !(o.fetch || typeof G.ASSET_FETCH === 'function')) return null;
    const F = FMTS[want] || FMTS.raw, base = typeof FLYDIY_ASSET_BASE !== 'undefined' ? FLYDIY_ASSET_BASE : '';
    return { fmt: FMTS[want] ? want : 'raw', has: k => !!(k && pack.layers[k]), src: k => (k && pack.layers[k]) || null,
             fetch: src => (o.fetch ? o.fetch(base + src) : F.fetch(base + src, G)), sums: k => (pack.sums && pack.sums[k]) || null };   // (o.fetch: GATE TARR's disk)
  }

  // the house generator's hooks, raw: the game's ATMO serves every hook wrapped (atmo.js: the prototype accessor keeps
  // the material's own in _atmoHook); a bench without ATMO has it as an own property
  const rawHook = m => Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') ? m.onBeforeCompile : (m._atmoHook || null);

  // THE EDITS, pure text (GATE TARR runs them on r186's own ShaderLib): `sh` after the house generator's hook
  const PLAIN_U = ['uDirtTop', 'uDirtY0', 'uDirtH', 'uDirtK', 'uSat', 'uCon', 'uAOd', 'uNoiseK', 'uNoiseS', 'uDirtCol', 'uDirtOwn', 'uPaintCol',
                   'uPaintMode', 'uDirtGain', 'uAgeDesat', 'uAgeDark', 'uWander', 'uUvK', 'uCloudK', 'uCloudMode'];
  const GLASS_U = ['uGlassWave', 'uGlassRough', 'uGlassFres', 'uLitK', 'uGlassEnvK'];
  const SAG_DECL = 'uniform float uSag, uSagL, uSagY0, uSagY1;';
  const SAG_ZERO = 'const float uSag = 0.0, uSagL = 1.0, uSagY0 = 0.0, uSagY1 = 1.0;';
  function globals(src, names, miss) {
    const seen = new Set();
    const out = src.replace(/uniform\s+(float|vec3)\s+([\w\s,]+);/g, (all, ty, list) => {
      const ns = list.split(',').map(s => s.trim());
      if (!ns.every(n => names.includes(n))) return all;
      ns.forEach(n => seen.add(n));
      return ty + ' ' + ns.join(', ') + ';';
    });
    for (const n of names) if (!seen.has(n)) miss.push(n);
    return out;
  }
  function rep(src, a, b, miss) { if (src.indexOf(a) < 0) { miss.push(a); return src; } return src.replace(a, () => b); }
  const FETCH = `
uniform highp sampler2D tTab;
flat varying float vSlot;
vec4 tFetch(int i) { int t = int(vSlot + 0.5) * ${NS} + i; return texelFetch(tTab, ivec2(t % ${TW}, t / ${TW}), 0); }
vec3 tCol; float tRough, tMetal;
`;
  // tLoad sits right above main: it assigns the hook's globals and the inlined envmap chunk's, declared below the head
  const PLAIN_LOAD = `
void tLoad() {
  vec4 a = tFetch(0), b = tFetch(1), c = tFetch(2), d = tFetch(3), e = tFetch(4), g = tFetch(5), h = tFetch(6), k = tFetch(7), l = tFetch(8);
  tCol = a.rgb; tRough = a.a; tMetal = b.x; tNS = b.yz; tAlbL = b.w; tNRL = c.x;
  tUvT = vec2(dot(c.yzw, vec3(vTUv, 1.0)), dot(d.xyz, vec3(vTUv, 1.0)));
  uPaintMode = d.w; uPaintCol = e.rgb; uDirtGain = e.a; uDirtOwn = g.rgb; uAgeDesat = g.a;
  uAgeDark = h.x; uDirtTop = h.y; uDirtH = h.z; uDirtK = h.w; uSat = k.x; uCon = k.y; uAOd = k.z; uNoiseK = k.w;
  uNoiseS = l.x; uCloudK = l.y; uCloudMode = l.z; uDirtCol = vec3(0.0); uDirtY0 = 0.0; uWander = l.w; uUvK = 1.0;
  // wanderUV's own offset (the scale is in the transform already)
  tUvT.y += uWander * (hNoise(vec3(vHouseP.x * 0.45, vHouseP.z * 0.45, vHouseP.y * 0.2 + 1.7)) * 2.0 - 1.0)
          + uWander * 0.35 * (hNoise(vec3(vHouseP.x * 2.1, vHouseP.z * 2.1, 3.3)) * 2.0 - 1.0);
}
`;
  const GLASS_LOAD = `
void tLoad() {
  vec4 a = tFetch(0), b = tFetch(1), c = tFetch(2);
  tCol = a.rgb; tRough = a.a; tMetal = b.x; uGlassWave = b.y; uGlassRough = b.z; uGlassFres = b.w; uLitK = c.x * tLit; uGlassEnvK = c.y;
}
`;
  const VERT_HEAD = 'attribute float aSlot;\nflat varying float vSlot;\nvarying vec2 vTUv;\n';
  function editPlain(sh, miss, SC) {
    sh.vertexShader = rep(VERT_HEAD + sh.vertexShader, SAG_DECL, SAG_ZERO, miss);
    sh.vertexShader = rep(sh.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n  vSlot = aSlot; vTUv = uv;', miss);
    let f = globals(sh.fragmentShader, PLAIN_U, miss);
    f = 'uniform highp sampler2DArray tAlb, tNR;\nvarying vec2 vTUv;\n' + FETCH + `
float tAlbL, tNRL; vec2 tNS, tUvT;
vec3 tDecode(vec3 c) { return mix(pow(c * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), c * 0.0773993808, vec3(lessThanEqual(c, vec3(0.04045)))); }
mat3 tFrame(vec3 eye_pos, vec3 surf_norm, vec2 uv) {
  vec3 q0 = dFdx(eye_pos.xyz), q1 = dFdy(eye_pos.xyz);
  vec2 st0 = dFdx(uv.st), st1 = dFdy(uv.st);
  vec3 N = surf_norm, q1perp = cross(q1, N), q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x, B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B)), scale = (det == 0.0) ? 0.0 : inversesqrt(det);
  return mat3(T * scale, B * scale, N);
}
` + f;
    f = rep(f, 'void main() {', PLAIN_LOAD + 'void main() {\n  tLoad();', miss);
    f = rep(f, 'vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( tCol, opacity );', miss);
    // both arrays sampled once each, in uniform control flow (the derivatives), and used by the slot's say-so
    f = rep(f, '#include <map_fragment>', '  vec4 tA = texture(tAlb, vec3(tUvT, max(tAlbL, 0.0)));\n  if (tAlbL >= 0.0) diffuseColor *= vec4(tDecode(tA.rgb), tA.a);', miss);
    f = rep(f, '#include <roughnessmap_fragment>', '  vec4 tN = texture(tNR, vec3(tUvT, max(tNRL, 0.0)));\n  float roughnessFactor = tRough;\n  if (tNRL >= 0.0) roughnessFactor *= tN.a;', miss);
    f = rep(f, '#include <metalnessmap_fragment>', '  float metalnessFactor = tMetal;', miss);
    f = rep(f, '#include <normal_fragment_maps>', '  mat3 ttbn = tFrame(-vViewPosition, normal, tUvT);\n' +
      '  #ifdef DOUBLE_SIDED\n  ttbn[0] *= faceDirection; ttbn[1] *= faceDirection;\n  #endif\n' +
      '  if (tNRL >= 0.0) { vec3 mapN = tN.xyz * 2.0 - 1.0; mapN.xy *= tNS; normal = normalize(ttbn * mapN); }', miss);
    sh.fragmentShader = f;
    return sh;
  }
  function editGlass(sh, miss, SC) {
    sh.vertexShader = rep(VERT_HEAD + sh.vertexShader, SAG_DECL, SAG_ZERO, miss);
    sh.vertexShader = rep(sh.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n  vSlot = aSlot; vTUv = uv;', miss);
    let f = globals(sh.fragmentShader, GLASS_U, miss);
    f = 'uniform float tLit;\n' + FETCH + `
` + f;
    f = rep(f, 'void main() {', GLASS_LOAD + 'void main() {\n  tLoad();', miss);
    f = rep(f, 'vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( tCol, opacity );', miss);
    f = rep(f, '#include <roughnessmap_fragment>', '  float roughnessFactor = tRough;', miss);
    f = rep(f, '#include <metalnessmap_fragment>', '  float metalnessFactor = tMetal;', miss);
    sh.fragmentShader = f;
    return sh;
  }

  function make(THREE, opts) {
    const o = Object.assign({ px: 512, onReady: null, HG: null }, opts || {});
    const HG = () => o.HG || (typeof window !== 'undefined' && window.HOUSE_GEN) || null;
    const stats = { layers: 0, nrLayers: 0, slots: 0, mb: 0, builds: 0, missing: [], cooked: 0, canvas: 0, fmt: 'canvas', fillMs: 0, fetchMs: 0, check: null };
    const COOK = cookOf(o);   // G840: the cooked layers (null: the canvas pass)
    const U = { tAlb: { value: null }, tNR: { value: null }, tTab: { value: null }, tLit: { value: 1 } };
    // the stack: what is IN it (image -> layer) and what the bake wished for
    let ALB = new Map(), NR = new Map();
    let wantA = new Map(), wantN = new Map();
    let building = false;
    // G903: a FLAT map (assets.js TEX_FLAT, a shared 1x1 DataTexture) stands in the stack as its constant: its
    // userData.flat [r, g, b] is the "image" (one array per colour, so one layer per colour), ready at once, and
    // its layer is that colour - the texel the material samples; its uv transform is moot (a constant)
    const flatOf = t => (t && t.userData && t.userData.flat) || null;
    const ready = img => !!img && (Array.isArray(img) || (img.complete && img.naturalWidth > 0) || (!('complete' in img) && img.width > 0));
    const imgOf = t => flatOf(t) || (t && t.image) || null;
    const nrKey = (n, r) => n + '|' + r;
    const ids = new WeakMap(); let nid = 0;
    const idOf = x => { if (!x) return 0; let i = ids.get(x); if (!i) ids.set(x, i = ++nid); return i; };

    // ---- classify ------------------------------------------------------------------------------------------
    const STD_OK = m => m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.transparent && !(m.alphaTest > 0) && m.opacity === 1 &&
      !m.vertexColors && !m.flatShading && !m.wireframe && !m.polygonOffset && m.depthWrite && m.depthTest && m.colorWrite &&
      m.blending === THREE.NormalBlending && m.fog !== false && m.toneMapped !== false && !m.envMap &&
      !m.aoMap && !m.lightMap && !m.metalnessMap && !m.alphaMap && !m.bumpMap && !m.displacementMap && !m.emissiveMap &&
      !(m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b)) && m.side !== THREE.BackSide && !(m.clippingPlanes && m.clippingPlanes.length) &&
      Object.keys(m.defines || {}).every(k => k === 'STANDARD') && !Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey');
    const GEO_OK = (g, need) => g && g.index && !g.morphAttributes.position && need.every(k => g.attributes[k] && !g.attributes[k].isInterleavedBufferAttribute);
    function xform(t) { if (t.matrixAutoUpdate) t.updateMatrix(); const e = t.matrix.elements; return [e[0], e[3], e[6], e[1], e[4], e[7]]; }
    function classify(mesh) {
      if (!mesh || !mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh || Array.isArray(mesh.material)) return null;
      const m = mesh.material, ud = m && m.userData;
      if (!ud || !STD_OK(m)) return null;
      const hook = rawHook(m), side = m.side === THREE.DoubleSide ? 2 : 0, dith = m.dithering ? 1 : 0;
      if (ud.glassShaded && hook === ud.hookGlass && ud.glassU && ud.houseU) {
        if (m.map || m.normalMap || m.roughnessMap) return null;
        if (!GEO_OK(mesh.geometry, ['position', 'normal', 'uv', 'aHouseLit', 'aHouseWin'])) return null;
        return { kind: 'glass', side, key: 'glass:' + side + ':' + dith };
      }
      if (!ud.houseShaded || !ud.houseU || !ud.paint || !ud.dirt) return null;
      if (hook !== (ud.clouded ? ud.hookCloud : ud.hookHouse)) return null;
      if (!GEO_OK(mesh.geometry, ['position', 'normal', 'uv', 'aHouseAO'])) return null;
      const ts = [m.map, m.normalMap, m.roughnessMap].filter(Boolean);
      // (G840: a map the pack cooked rides before its image has decoded - the stack fetches its layer, not its pixels)
      const cookedT = t => !!COOK && (t === m.map ? COOK.has(keyA(imgOf(t))) : COOK.has(keyN(imgOf(m.normalMap), imgOf(m.roughnessMap))));
      for (const t of ts) if (t.channel || (!flatOf(t) && ((!ready(imgOf(t)) && !cookedT(t)) || t.isDataTexture || t.isCompressedTexture))) return null;
      const tx = ts.filter(t => !flatOf(t));
      if (tx.length > 1) { const x0 = xform(tx[0]); if (tx.some(t => xform(t).some((v, i) => Math.abs(v - x0[i]) > 1e-7))) return null; }
      return { kind: 'plain', side, key: 'plain:' + side + ':' + dith };
    }

    // ---- the slots -----------------------------------------------------------------------------------------
    let SLOT = new Map(), ROWS = [];
    function layerA(img) { if (!img) return -1; wantA.set(img, true); return ALB.has(img) ? ALB.get(img) : -2; }
    function layerN(n, r) { if (!n && !r) return -1; const k = nrKey(idOf(n), idOf(r)); wantN.set(k, [n, r]); return NR.has(k) ? NR.get(k) : -2; }
    function slotPlain(m) {
      const ud = m.userData, S = ud.houseU, P = ud.paint, D = ud.dirt;
      // the scale and the wander are wanderUV's: they apply where the material has a map (hUv exists only then)
      const uk = m.map ? D.uUvK.value : 1, wd = m.map ? D.uWander.value : 0;
      const t0 = [m.map, m.normalMap, m.roughnessMap].find(t => t && !flatOf(t)), X = (t0 ? xform(t0) : [1, 0, 0, 0, 1, 0]).map(x => x * uk);
      const la = layerA(imgOf(m.map)), ln = layerN(imgOf(m.normalMap), imgOf(m.roughnessMap));
      const ns = m.normalMap ? m.normalScale : { x: 0, y: 0 };
      const v = [m.color.r, m.color.g, m.color.b, m.roughness,
        m.metalness, ns.x, ns.y, la,
        ln, X[0], X[1], X[2],
        X[3], X[4], X[5], P.uPaintMode.value,
        P.uPaintCol.value.r, P.uPaintCol.value.g, P.uPaintCol.value.b, D.uDirtGain.value,
        D.uDirtOwn.value.r, D.uDirtOwn.value.g, D.uDirtOwn.value.b, D.uAgeDesat.value,
        D.uAgeDark.value, S.uDirtTop.value + (S.uDirtY0 ? S.uDirtY0.value : 0), S.uDirtH.value, S.uDirtK.value,
        S.uSat.value, S.uCon.value, S.uAOd.value, S.uNoiseK.value,
        S.uNoiseS.value, ud.clouded ? ud.uCloudK.value : 0, ud.clouded ? ud.uCloudMode.value : 0, wd];
      return (la === -2 || ln === -2) ? -1 : slotOf(v);
    }
    function slotGlass(m, litBase) {
      const G = m.userData.glassU;
      return slotOf([m.color.r, m.color.g, m.color.b, m.roughness, m.metalness, G.uGlassWave.value, G.uGlassRough.value, G.uGlassFres.value,
                     litBase(G.uLitK), m.envMap ? 1 : m.envMapIntensity, 0, 0]);
    }
    function slotOf(v) {
      const k = v.map(x => Math.fround(+x || 0)).join(',');
      let s = SLOT.get(k); if (s === undefined) { s = ROWS.length; SLOT.set(k, s); ROWS.push(v); }
      return s;
    }

    // ---- the merge -----------------------------------------------------------------------------------------
    // world space (the house's matrixWorld), the ridge sag first (hSag, in the house's own frame: the vertex shader's
    // bend, done once), normals through the normal matrix, the slot per vertex
    function merge(list, kind, litBase) {
      const names = kind === 'glass' ? ['position', 'normal', 'uv', 'aHouseLit', 'aHouseWin'] : ['position', 'normal', 'uv', 'aHouseAO'];
      const slots = list.map(m => kind === 'glass' ? slotGlass(m.material, litBase || (u => u.value)) : slotPlain(m.material));
      let nV = 0, nI = 0;
      list.forEach((m, j) => { if (slots[j] >= 0) { nV += m.geometry.attributes.position.count; nI += m.geometry.index.count; } });
      if (!nV) return { geo: null, used: [] };
      const A = {}; for (const k of names) A[k] = new Float32Array(nV * list.find(m => m.geometry.attributes[k]).geometry.attributes[k].itemSize);
      const S = new Float32Array(nV), I = nV > 65535 ? new Uint32Array(nI) : new Uint16Array(nI), nm = new THREE.Matrix3(), used = [];
      let vo = 0, io = 0;
      list.forEach((m, j) => {
        if (slots[j] < 0) return;
        used.push(m);
        const g = m.geometry, n = g.attributes.position.count, SU = m.material.userData.houseU;
        const sag = SU.uSag.value, L2 = Math.max(SU.uSagL.value * SU.uSagL.value, 0.01), y0 = SU.uSagY0.value, dy = Math.max(SU.uSagY1.value - y0, 0.01);
        m.updateWorldMatrix(true, false);
        nm.getNormalMatrix(m.matrixWorld);
        const e = m.matrixWorld.elements, q = nm.elements;
        for (const k of names) {
          const a = g.attributes[k], s = a.itemSize, src = a.array, dst = A[k];
          if (k === 'position') for (let i = 0; i < n; i++) {
            const x = src[i * 3], z = src[i * 3 + 2]; let y = src[i * 3 + 1];
            if (sag) { const bx = Math.max(0, 1 - x * x / L2), ky = Math.min(1, Math.max(0, (y - y0) / dy)); y -= sag * bx * ky * ky; }
            const o3 = (vo + i) * 3;
            dst[o3] = e[0] * x + e[4] * y + e[8] * z + e[12]; dst[o3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; dst[o3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          } else if (k === 'normal') for (let i = 0; i < n; i++) {
            const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], o3 = (vo + i) * 3;
            const X = q[0] * x + q[3] * y + q[6] * z, Y = q[1] * x + q[4] * y + q[7] * z, Z = q[2] * x + q[5] * y + q[8] * z, l = Math.hypot(X, Y, Z) || 1;
            dst[o3] = X / l; dst[o3 + 1] = Y / l; dst[o3 + 2] = Z / l;
          } else dst.set(src.subarray(0, n * s), vo * s);
        }
        S.fill(slots[j], vo, vo + n);
        const ix = g.index.array; for (let i = 0; i < g.index.count; i++) I[io + i] = ix[i] + vo;
        vo += n; io += g.index.count;
      });
      const geo = new THREE.BufferGeometry();
      for (const k of names) geo.setAttribute(k, new THREE.BufferAttribute(A[k], k === 'aHouseWin' || k === 'position' || k === 'normal' ? 3 : k === 'uv' ? 2 : 1));
      geo.setAttribute('aSlot', new THREE.BufferAttribute(S, 1));
      geo.setIndex(new THREE.BufferAttribute(I, 1));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      return { geo, used };
    }

    // ---- the table and the arrays --------------------------------------------------------------------------
    function begin() { SLOT = new Map(); ROWS = []; wantA = new Map(); wantN = new Map(); }
    function end() {
      const H = Math.max(1, Math.ceil(ROWS.length * NS / TW)), data = new Float32Array(TW * H * 4);
      ROWS.forEach((v, s) => data.set(v, s * NS * 4));
      if (U.tTab.value) U.tTab.value.dispose();
      const t = new THREE.DataTexture(data, TW, H, THREE.RGBAFormat, THREE.FloatType);
      t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
      U.tTab.value = t; stats.slots = ROWS.length;
      const complete = [...wantA.keys()].every(i => ALB.has(i)) && [...wantN.keys()].every(k => NR.has(k));
      if (!complete && !building) build();
      return complete;
    }
    // the stack is rebuilt WHOLE with the union of what it had and what the bake wished for (the layers keep no
    // order worth keeping: every slot is re-numbered by the rebake the ready signal asks for)
    function build() {
      if (typeof document === 'undefined') return;
      building = true; stats.builds++;
      const imgsA = [...new Set([...ALB.keys(), ...wantA.keys()])];
      const pairs = new Map([...[...NR.keys()].map(k => [k, NRsrc.get(k)]), ...wantN.entries()]);
      const px = o.px, S = px * px * 4;
      // decoded or broken (complete either way), or a canvas (a baked sheet: no load to wait for), is settled: a broken map is left out of the stack, its bags stay G566's
      const dec = img => (ready(img) || !('complete' in img) || img.complete) ? Promise.resolve() : new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
      // G840: every layer the pack cooked is FETCHED (its bytes are the packer's); the rest - and a cooked layer whose
      // fetch fails - waits for its images and takes the canvas pass. ?tarrcheck=1 draws the cooked ones too, to compare.
      const CHECK = typeof location !== 'undefined' && /[?&]tarrcheck=1/.test(location.search || '');
      const t0 = now();
      const LA = imgsA.map(img => ({ img, imgs: [img], src: COOK ? COOK.src(keyA(img)) : null, bytes: null }));
      const LN = [...pairs.entries()].map(([k, p]) => ({ k, p, imgs: p.filter(Boolean), src: COOK ? COOK.src(keyN(p[0], p[1])) : null, bytes: null }));
      let failed = 0;
      const get = e => COOK.fetch(e.src).then(b => {
        if (!b || b.length !== S) throw new Error(e.src + ': ' + (b ? b.length : 0) + ' bytes, not ' + S);
        e.bytes = b; return CHECK ? Promise.all(e.imgs.map(dec)) : null;
      }).catch(err => { if (!failed++) console.warn('house_tarr: a cooked layer did not arrive (' + (err && err.message) + ') - the canvas draws it'); e.src = null; e.bytes = null; return Promise.all(e.imgs.map(dec)); });
      Promise.all(LA.concat(LN).map(e => (e.src ? get(e) : Promise.all(e.imgs.map(dec))))).then(() => {
        const t1 = now();
        let P = null; const pk = () => P || (P = packer(px, document));
        const chk = CHECK ? { same: 0, differ: 0, worst: 0, list: [] } : null;
        const cmp = (e, d) => { if (!chk || !e.bytes) return; let n = 0, w = 0; for (let j = 0; j < S; j++) { const x = Math.abs(d[j] - e.bytes[j]); if (x) { n++; if (x > w) w = x; } } if (n) { chk.differ++; chk.worst = Math.max(chk.worst, w); chk.list.push([e.src, n, w]); } else chk.same++; };
        let cooked = 0, drawn = 0;
        const okA = LA.filter(e => e.bytes || ready(e.img)), dA = new Uint8Array(S * Math.max(1, okA.length)), mA = new Map();
        okA.forEach((e, i) => { if (e.bytes) { dA.set(e.bytes, i * S); cooked++; if (chk && ready(e.img)) cmp(e, pk().albedo(e.img)); } else { dA.set(pk().albedo(e.img), i * S); drawn++; } mA.set(e.img, i); });
        const okN = LN.filter(e => e.bytes || e.p.every(x => !x || ready(x))), dN = new Uint8Array(S * Math.max(1, okN.length)), mN = new Map(), src = new Map();
        okN.forEach((e, i) => {
          const [n, r] = e.p;
          if (e.bytes) { dN.set(e.bytes, i * S); cooked++; if (chk && e.p.every(x => !x || ready(x))) cmp(e, pk().nr(n, r)); } else { dN.set(pk().nr(n, r), i * S); drawn++; }
          mN.set(e.k, i); src.set(e.k, [n, r]);
        });
        for (const e of LA.concat(LN)) e.bytes = null;
        stats.cooked = cooked; stats.canvas = drawn; stats.fmt = COOK ? COOK.fmt : 'canvas'; stats.fetchMs = Math.round(t1 - t0); stats.fillMs = Math.round(now() - t1); stats.check = chk;
        const mk = (d, n) => { const t = new THREE.DataArrayTexture(d, px, px, Math.max(1, n));
          t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
          t.onUpdate = () => { t.image.data = null; };   // uploaded once: the bytes are the GPU's now (~1 MB a layer)
          t.needsUpdate = true; return t; };
        if (U.tAlb.value) U.tAlb.value.dispose(); if (U.tNR.value) U.tNR.value.dispose();
        U.tAlb.value = mk(dA, okA.length); U.tNR.value = mk(dN, okN.length);
        ALB = mA; NR = mN; NRsrc = src;
        stats.layers = okA.length; stats.nrLayers = okN.length; stats.mb = +((okA.length + okN.length) * S * 4 / 3 / 1048576).toFixed(1);
        building = false;
        if (o.onReady) o.onReady();
      });
    }
    let NRsrc = new Map();

    // ---- the materials -------------------------------------------------------------------------------------
    const MATS = new Map();
    let baseHooks = null;
    function hooks() {
      if (baseHooks) return baseHooks;
      const H = HG(); if (!H || !H.shadeHouse || !H.cloudWeather) return null;
      const dp = new THREE.MeshStandardMaterial(); H.shadeHouse(dp, H.makeShadeU()); H.cloudWeather(dp, 0, 0);
      const F = H.makeFinish(); H.applyFinish(Object.assign({}, H.DEF), F);
      baseHooks = { plain: rawHook(dp), glass: rawHook(F.MAT.glass) };
      return baseHooks;
    }
    function material(kind, side, dith, bare) {   // bare: without the band even when made with one (G801: an item's bags)
      const band = !!o.lod && !bare, k = kind + ':' + side + ':' + (dith ? 1 : 0) + (band ? ':lod' : '');
      if (MATS.has(k)) return MATS.get(k);
      const B = hooks(); if (!B) return null;
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: side === 2 ? THREE.DoubleSide : THREE.FrontSide, dithering: !!dith });
      const base = B[kind];
      m.onBeforeCompile = sh => {
        base(sh);
        const miss = [];
        (kind === 'glass' ? editGlass : editPlain)(sh, miss, THREE.ShaderChunk);
        if (miss.length) { stats.missing = miss; console.warn('house_tarr: the', kind, 'edits missed', miss); }
        sh.uniforms.tTab = U.tTab;
        if (kind === 'glass') sh.uniforms.tLit = U.tLit; else { sh.uniforms.tAlb = U.tAlb; sh.uniforms.tNR = U.tNR; }
        if (band) {
          Object.assign(sh.uniforms, o.lod.U);
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + o.lod.decl)
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + o.lod.glsl);
        }
      };
      m.customProgramCacheKey = () => 'house_tarr:' + k;
      m.userData.tarr = kind;
      MATS.set(k, m);
      return m;
    }

    return { classify, begin, merge, end, material, lit: U.tLit, U, stats, get ready() { return !!U.tAlb.value && !building; } };
  }

  // the far town's mean of a map (render_premises meanOf): the pack's cooked sums, else the 4 x 4 draw (G840)
  function cookedSums(img) {
    const k = keyOf(img), pack = typeof window !== 'undefined' ? window.HOUSE_TARR_PACK : null;
    return (k && pack && pack.sums && pack.sums[k] && fmtAsked() !== 'canvas') ? pack.sums[k] : null;
  }
  const meanSums = img => cookedSums(img) || sums16(img, document);
  const api = { make, editPlain, editGlass, rawHook, NS, TW, packer, sums16, meanSums, cookedSums, keyOf, keyA, keyN };
  if (typeof window !== 'undefined') window.HOUSE_TARR = api;
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HOUSE_TARR;
