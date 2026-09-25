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
//     T.material(kind, side)   the shared town materials
//     T.lit              { value }: the lamps' factor for the lit panes (render_premises' LAMPS drives it)
//     T.stats            { layers, nrLayers, slots, mb, builds }
//
// THE LOOK IS THE HOUSE'S OWN SHADER, NOT A COPY. The town material's hook is the house generator's (shadeHouse +
// cloudWeather, or shadeGlass) run on the program as it is, then four edits: the finish's uniforms become globals
// filled from the slot at the top of main; the map / roughness / metalness / normal-map chunks sample the arrays; the
// material colour is the slot's; the ridge sag (a vertex-shader bend in the house's own frame) is 0 because the merge
// bakes it into the positions. The material's envMapIntensity is left alone: three r186 feeds that uniform the
// SCENE's environmentIntensity when a material has no envMap of its own (a house's never has), so the glass's 2.3 and
// the pane's 1.9 (applyFinish) have never reached the screen in the game - the town keeps that. So the dirt line, the punch, the paint blends, the noise, the clouds, the curtains
// and the lit panes are the very GLSL the house draws with; GATE TARR holds the edits.
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
'use strict';
const HOUSE_TARR = (() => {
  const NS = 9, TW = 1024;   // texels a slot; the table's width

  // the house generator's hooks, raw: the game's ATMO serves every hook wrapped (atmo.js: the prototype accessor keeps
  // the material's own in _atmoHook); a bench without ATMO has it as an own property
  const rawHook = m => Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') ? m.onBeforeCompile : (m._atmoHook || null);

  // THE EDITS, pure text (GATE TARR runs them on r186's own ShaderLib): `sh` after the house generator's hook
  const PLAIN_U = ['uDirtTop', 'uDirtH', 'uDirtK', 'uSat', 'uCon', 'uAOd', 'uNoiseK', 'uNoiseS', 'uDirtCol', 'uDirtOwn', 'uPaintCol',
                   'uPaintMode', 'uDirtGain', 'uAgeDesat', 'uAgeDark', 'uWander', 'uUvK', 'uCloudK', 'uCloudMode'];
  const GLASS_U = ['uGlassWave', 'uGlassRough', 'uGlassFres', 'uLitK'];
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
  uNoiseS = l.x; uCloudK = l.y; uCloudMode = l.z; uDirtCol = vec3(0.0); uWander = 0.0; uUvK = 1.0;
}
`;
  const GLASS_LOAD = `
void tLoad() {
  vec4 a = tFetch(0), b = tFetch(1), c = tFetch(2);
  tCol = a.rgb; tRough = a.a; tMetal = b.x; uGlassWave = b.y; uGlassRough = b.z; uGlassFres = b.w; uLitK = c.x * tLit;
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
    const stats = { layers: 0, nrLayers: 0, slots: 0, mb: 0, builds: 0, missing: [] };
    const U = { tAlb: { value: null }, tNR: { value: null }, tTab: { value: null }, tLit: { value: 1 } };
    // the stack: what is IN it (image -> layer) and what the bake wished for
    let ALB = new Map(), NR = new Map();
    let wantA = new Map(), wantN = new Map();
    let building = false;
    const ready = img => !!img && ((img.complete && img.naturalWidth > 0) || (!('complete' in img) && img.width > 0));
    const imgOf = t => (t && t.image) || null;
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
      for (const t of ts) if (t.channel || !ready(imgOf(t)) || t.isDataTexture || t.isCompressedTexture) return null;
      if (ts.length > 1) { const x0 = xform(ts[0]); if (ts.some(t => xform(t).some((v, i) => Math.abs(v - x0[i]) > 1e-7))) return null; }
      return { kind: 'plain', side, key: 'plain:' + side + ':' + dith };
    }

    // ---- the slots -----------------------------------------------------------------------------------------
    let SLOT = new Map(), ROWS = [];
    function layerA(img) { if (!img) return -1; wantA.set(img, true); return ALB.has(img) ? ALB.get(img) : -2; }
    function layerN(n, r) { if (!n && !r) return -1; const k = nrKey(idOf(n), idOf(r)); wantN.set(k, [n, r]); return NR.has(k) ? NR.get(k) : -2; }
    function slotPlain(m) {
      const ud = m.userData, S = ud.houseU, P = ud.paint, D = ud.dirt;
      const t0 = m.map || m.normalMap || m.roughnessMap, X = t0 ? xform(t0) : [1, 0, 0, 0, 1, 0];
      const la = layerA(imgOf(m.map)), ln = layerN(imgOf(m.normalMap), imgOf(m.roughnessMap));
      const ns = m.normalMap ? m.normalScale : { x: 0, y: 0 };
      const v = [m.color.r, m.color.g, m.color.b, m.roughness,
        m.metalness, ns.x, ns.y, la,
        ln, X[0], X[1], X[2],
        X[3], X[4], X[5], P.uPaintMode.value,
        P.uPaintCol.value.r, P.uPaintCol.value.g, P.uPaintCol.value.b, D.uDirtGain.value,
        D.uDirtOwn.value.r, D.uDirtOwn.value.g, D.uDirtOwn.value.b, D.uAgeDesat.value,
        D.uAgeDark.value, S.uDirtTop.value, S.uDirtH.value, S.uDirtK.value,
        S.uSat.value, S.uCon.value, S.uAOd.value, S.uNoiseK.value,
        S.uNoiseS.value, ud.clouded ? ud.uCloudK.value : 0, ud.clouded ? ud.uCloudMode.value : 0, 0];
      return (la === -2 || ln === -2) ? -1 : slotOf(v);
    }
    function slotGlass(m, litBase) {
      const G = m.userData.glassU;
      return slotOf([m.color.r, m.color.g, m.color.b, m.roughness, m.metalness, G.uGlassWave.value, G.uGlassRough.value, G.uGlassFres.value,
                     litBase(G.uLitK), 0, 0, 0]);
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
      const all = imgsA.concat([...pairs.values()].flat().filter(Boolean));
      Promise.all(all.map(dec)).then(() => {
        const cnv = document.createElement('canvas'); cnv.width = cnv.height = px;
        const ctx = cnv.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        const draw = img => { ctx.setTransform(1, 0, 0, -1, 0, px); ctx.clearRect(0, 0, px, px); ctx.drawImage(img, 0, 0, px, px); return ctx.getImageData(0, 0, px, px).data; };
        const okA = imgsA.filter(ready), dA = new Uint8Array(S * Math.max(1, okA.length)), mA = new Map();
        okA.forEach((img, i) => { dA.set(draw(img), i * S); for (let k = 3; k < S; k += 4) dA[i * S + k] = 255; mA.set(img, i); });
        const okN = [...pairs.entries()].filter(([, p]) => p.every(x => !x || ready(x))), dN = new Uint8Array(S * Math.max(1, okN.length)), mN = new Map(), src = new Map();
        okN.forEach(([k, [n, r]], i) => {
          const o0 = i * S;
          if (n) dN.set(draw(n), o0); else for (let j = 0; j < S; j += 4) { dN[o0 + j] = 128; dN[o0 + j + 1] = 128; dN[o0 + j + 2] = 255; }
          if (r) { const rd = draw(r); for (let j = 0; j < S; j += 4) dN[o0 + j + 3] = rd[j + 1]; } else for (let j = 3; j < S; j += 4) dN[o0 + j] = 255;
          mN.set(k, i); src.set(k, [n, r]);
        });
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
    function material(kind, side, dith) {
      const k = kind + ':' + side + ':' + (dith ? 1 : 0);
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
      };
      m.customProgramCacheKey = () => 'house_tarr:' + k;
      m.userData.tarr = kind;
      MATS.set(k, m);
      return m;
    }

    return { classify, begin, merge, end, material, lit: U.tLit, U, stats, get ready() { return !!U.tAlb.value && !building; } };
  }

  const api = { make, editPlain, editGlass, rawHook, NS, TW };
  if (typeof window !== 'undefined') window.HOUSE_TARR = api;
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HOUSE_TARR;
