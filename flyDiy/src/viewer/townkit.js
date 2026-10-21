// townkit.js — THE TOWN KIT, DRAWN (C3b of QUEUE-C, G855-G859; ARCH-2026-09-27 §4.2-4.5). tools/town_kit.js (C3a,
// G850) made the SHAPES offline: 30 house archetypes + 3 outbuildings, each a house the sampler really drew, at lod 0,
// lod 1 and the G594 box, every vertex carrying its ROLE (its bag: siding, trim, roof, ...), a STANCE weight and its
// glow; and a 32 B record a house (where, which shape, mirrored, which finish set, the paint, the weather, the dirt,
// the lights, the stretch, the ground at the four corners). This file draws them.
//
//   TOWNKIT.decodePack(bytes)       -> { header, bytes, base }     (the gunzipped pack; tools/town_kit.js encodePack)
//   TOWNKIT.decodeInstances(bytes)  -> { head, rows }             (the gunzipped instance file; town_kit.js instanceFile)
//   TOWNKIT.host(THREE, opts)       -> H                          one town's houses, drawn
//     opts: { pack, rows: [{ x, y, z, yaw (WORLD), arch, mirror, finish, wallCol, trimCol, roofCol, weather, dirt, lights,
//             scale, ground[4], seed }], tarr (house_tarr.js's T), HG (HOUSE_GEN), mode: 'batch' | 'inst',
//             band: { E0, W0, E1, W1 }, castFar }
//     H.group            the THREE.Group to add
//     H.tick(eye)        per frame: each house's rung (lod 0 < E0 < lod 1 < E1 < box), a partner rung inside a band
//     H.relook()         the looks' slots again (house_tarr's stack landed a layer: the slots moved)
//     H.stats            { houses, looks, geos, verts, mb, tickMs, cullMs, draws, ... }
//     H.setHidden(h, v)  (C3c) a house out of every rung from the next tick (Metlakatla: a table's outbuilding the lot
//                        does not plan); H.isHidden(h)
//     H.hitMesh(h, lod)  (C3c) its triangles in its own frame, stretched as drawn - the obstacle raster's input
//     H.dispose()
//
// THE MATERIAL (ARCH §4.2): the TARR town material (G574: one float SLOT per vertex into a table of finishes, the
// finishes' maps in texture arrays) with the slot looked up by (the vertex's ROLE) x (the instance's LOOK): a look is
// a finish set + the wall / trim / roof paint + the weather + the dirt - what HOUSE_GEN.applyFinish makes of those on
// its own finish, read back through house_tarr's slot() into the same table the near town uses. So a kit house is
// shaded by the very GLSL a unique house is (the house generator's hook, house_tarr's edits), its paint and wear per
// instance. MATLIB's `house` shape (AS4a before C3b: ASSETS-2026-09-27 §5.3).
// THE STANCE (ARCH §4.3): the archetype stops at its floor; a vertex's stance weight (1 on the ground, 0 from the
// floor structure up) stretches it down to the instance's own ground - the four corner offsets as a bilinear field,
// sent as its four coefficients (a + b x + c z + d x z in the geometry's own frame) - in the vertex shader, the
// shadow pass's too.
// THE HOST (ARCH §4.2, the user's pick after the measurement below: HANDOVER G857): one THREE.BatchedMesh per material
// (plain / double-sided plain / glass) holding every archetype's lod 0 / lod 1 / box and their mirrored copies (a
// negative scale per instance would flip the winding: three culls by the OBJECT's determinant), each house two
// instances - its rung, and a partner rung while it crosses a band. The rung a geometry draws rides its vertices
// (role + 64 x lod), so the band is the shader's alone: A2-FADES' dithered cross-fade (G801's interleaved-gradient
// noise against the fragment's distance), complementary per pixel, no per-instance state to upload. The shadow pass:
// a depth material with the same stretch, the same band (distance from the EYE, not the light), and no caster past
// castFar. The alternative, one InstancedMesh per archetype x LOD x mirror x material (`mode: 'inst'`), is kept for the
// measurement (`?kithost=inst`).
'use strict';
const TOWNKIT = (() => {
  const PACK_MAGIC = 0x544b4954, VSTRIDE = 16, INST = 32;
  const ML = () => (typeof MATLIB !== 'undefined' ? MATLIB : (typeof window !== 'undefined' && window.MATLIB) || require('./matlib.js'));
  // (G3416) the near ring (town_ring.js: in the world pack ahead of render_premises; a node gate requires it)
  const ringLib = () => (typeof TOWN_RING !== 'undefined' ? TOWN_RING : (typeof window !== 'undefined' && window.TOWN_RING) || (typeof require === 'function' ? require('./town_ring.js') : null));
  const FINISH_KEYS = ['wallSet', 'trimSet', 'roofSet', 'deckSet', 'floorSet', 'postSet', 'stoneSet', 'metalSet'];

  // ---- the bytes (tools/town_kit.js encodePack / instanceFile, read with a DataView) ------------------------------
  const u8 = b => (b instanceof Uint8Array ? b : new Uint8Array(b));
  const utf8 = b => (typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(b) : Buffer.from(b).toString('utf8'));
  function decodePack(b0) {
    const b = u8(b0), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (dv.getUint32(0, true) !== PACK_MAGIC) throw new Error('townkit: not a town kit pack');
    const hl = dv.getUint32(8, true), header = JSON.parse(utf8(b.subarray(12, 12 + hl)));
    return { header, bytes: b, dv, base: 12 + hl + ((4 - ((12 + hl) & 3)) & 3) };
  }
  function decodeInstances(b0) {
    const b = u8(b0), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const hl = dv.getUint32(0, true), stride = dv.getUint32(4, true), head = JSON.parse(utf8(b.subarray(8, 8 + hl)));
    const at = 8 + hl + ((4 - ((8 + hl) & 3)) & 3), rows = [];
    for (let o = at, i = 0; o + stride <= b.length; o += stride, i++) rows.push(readRow(dv, o, i, head.plots));
    return { head, rows };
  }
  // one 32 B record (tools/town_kit.js encodeInstances); plots[i] = [plot, out, seed] (the instance file's head, the city
  // pack's header: the same rows)
  function readRow(dv, o, i, plots) {
    const ai = dv.getUint8(o + 14), pl = plots && plots[i];
    return { i, x: dv.getFloat32(o, true), z: dv.getFloat32(o + 4, true), y: dv.getFloat32(o + 8, true), yaw: dv.getUint16(o + 12, true) / 65536 * 2 * Math.PI,
      arch: ai & 127, mirror: !!(ai & 128), finish: dv.getUint8(o + 15), wallCol: dv.getUint8(o + 16), trimCol: dv.getUint8(o + 17), roofCol: dv.getUint8(o + 18),
      weather: dv.getUint8(o + 19) / 255, dirt: dv.getUint8(o + 20) / 255, lights: dv.getUint8(o + 21) / 255, scale: 1 + dv.getInt8(o + 22) / 500,
      flags: dv.getUint8(o + 23), ground: [0, 1, 2, 3].map(k => dv.getInt16(o + 24 + k * 2, true) / 100),
      plot: pl ? pl[0] : null, out: !!(pl && pl[1]),
      seed: pl && pl[2] !== undefined ? pl[2] : null };   // (C3c: the plot's seed)
  }
  function octDec(a, b) {
    let u = a / 127, v = b / 127;
    const y = 1 - Math.abs(u) - Math.abs(v);
    if (y < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
    const l = Math.hypot(u, y, v) || 1;
    return [u / l, y / l, v / l];
  }
  // ONE LOD, split by the material it wears (kindOf[role]: 'plain' | 'plain2' | 'glass' | null to drop), in the draw
  // layout: position f32 x3, normal i8 x4 (normalized; the 4th is padding), uv f32 x2 (metres), aKit u8 x4 (AO, role +
  // 64 x lod, stance, glow) and, on the glass, aHouseWin f32 x3 (the pane's width, height, dressing: _house_kit setWin)
  function decodeLod(P, meta, lod, kindOf) {
    const { dv, bytes, base } = P, n = meta.verts, vb = base + meta.vb[0], ib = base + meta.ib[0], wb = base + meta.wb[0];
    const WIN = new Set((P.header.winRoles || ['glass', 'pane']).map(k => P.header.bags.indexOf(k)));
    const kind = new Array(n), cnt = {}, map = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = kindOf[bytes[vb + i * VSTRIDE + 13]] || null; kind[i] = k; if (k) { map[i] = cnt[k] || 0; cnt[k] = map[i] + 1; } }
    const out = {};
    for (const k in cnt) out[k] = { n: cnt[k], pos: new Float32Array(cnt[k] * 3), nrm: new Int8Array(cnt[k] * 4), uv: new Float32Array(cnt[k] * 2), kit: new Uint8Array(cnt[k] * 4),
      win: k === 'glass' ? new Float32Array(cnt[k] * 3) : null, idx: [] };
    const q = (v, a, b) => a + v / 65535 * (b - a), pm = meta.pos.min, px = meta.pos.max, um = meta.uv.min, ux = meta.uv.max;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const o = vb + i * VSTRIDE, role = bytes[o + 13], isWin = WIN.has(role);
      const k = kind[i];
      if (k) {
        const T = out[k], j = map[i];
        for (let a = 0; a < 3; a++) T.pos[j * 3 + a] = q(dv.getUint16(o + a * 2, true), pm[a], px[a]);
        const nn = octDec(dv.getInt8(o + 6), dv.getInt8(o + 7));
        for (let a = 0; a < 3; a++) T.nrm[j * 4 + a] = Math.round(nn[a] * 127);
        T.uv[j * 2] = q(dv.getUint16(o + 8, true), um[0], ux[0]); T.uv[j * 2 + 1] = q(dv.getUint16(o + 10, true), um[1], ux[1]);
        T.kit[j * 4] = bytes[o + 12]; T.kit[j * 4 + 1] = role + 64 * lod; T.kit[j * 4 + 2] = bytes[o + 14]; T.kit[j * 4 + 3] = bytes[o + 15];
        if (T.win && isWin) { T.win[j * 3] = bytes[wb + w] * 0.02; T.win[j * 3 + 1] = bytes[wb + w + 1] * 0.02; T.win[j * 3 + 2] = bytes[wb + w + 2]; }
      }
      if (isWin) w += 4;
    }
    const wide = meta.index === 32;
    for (let t = 0; t < meta.tris * 3; t += 3) {
      const a = wide ? dv.getUint32(ib + t * 4, true) : dv.getUint16(ib + t * 2, true), b = wide ? dv.getUint32(ib + t * 4 + 4, true) : dv.getUint16(ib + t * 2 + 2, true),
            c = wide ? dv.getUint32(ib + t * 4 + 8, true) : dv.getUint16(ib + t * 2 + 4, true);
      const k = kind[a]; if (!k || kind[b] !== k || kind[c] !== k) continue;   // a triangle is one bag's (one role) by construction
      out[k].idx.push(map[a], map[b], map[c]);
    }
    for (const k in out) { const T = out[k]; T.idx = T.n > 65535 ? Uint32Array.from(T.idx) : Uint16Array.from(T.idx); T.tris = T.idx.length / 3; }
    return out;
  }
  // THE MIRROR (ARCH §4.3: "a MIRRORED copy of each archetype in the batch"): x negated, the normal's too, the winding
  // turned so the front stays the front
  function mirrorOf(T) {
    const M = { n: T.n, pos: T.pos.slice(), nrm: T.nrm.slice(), uv: T.uv, kit: T.kit, win: T.win, idx: T.idx.slice(), tris: T.tris };
    for (let i = 0; i < T.n; i++) { M.pos[i * 3] = -M.pos[i * 3]; M.nrm[i * 4] = -M.nrm[i * 4]; }
    for (let t = 0; t < M.idx.length; t += 3) { const b = M.idx[t + 1]; M.idx[t + 1] = M.idx[t + 2]; M.idx[t + 2] = b; }
    return M;
  }
  function geometryOf(THREE, T) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(T.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(T.nrm, 4, true));
    g.setAttribute('uv', new THREE.BufferAttribute(T.uv, 2));
    g.setAttribute('aKit', new THREE.BufferAttribute(T.kit, 4));
    if (T.win) g.setAttribute('aHouseWin', new THREE.BufferAttribute(T.win, 3));
    g.setIndex(new THREE.BufferAttribute(T.idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }

  // ---- THE SHADER EDITS (after house_tarr's hook: the generator's hook + the TARR edits) ------------------------
  // the house index: a batch holds two instances a house (its rung, the band's partner) in house order; an instanced
  // mesh carries it as an attribute
  const VDECL = `
attribute vec4 aKit;
#ifdef USE_BATCHING
  #define KIT_HOUSE floor(getIndirectIndex(gl_DrawID) * 0.5 + 0.25)
  #define KIT_M batchingMatrix
#else
  attribute float aKitId;
  #define KIT_HOUSE aKitId
  #ifdef USE_INSTANCING
    #define KIT_M instanceMatrix
  #else
    #define KIT_M mat4(1.0)
  #endif
#endif
uniform highp sampler2D uKitData;
uniform highp sampler2D uKitRoles;
flat varying float vKitLod;
vec4 kitData(float h, int k) { int t = int(h + 0.5) * 2 + k; int w = textureSize(uKitData, 0).x; return texelFetch(uKitData, ivec2(t % w, t / w), 0); }
float kitHash(vec4 p) { return fract(sin(dot(p, vec4(12.9898, 78.233, 37.719, 4.581))) * 43758.5453); }
`;
  // in main, right after begin_vertex (before the house hook's own lines): the look's slot for this role, the rung,
  // THE STRETCH: a vertex's stance weight times the ground field under it (0 at the high corner, down to the others)
  const VMAIN = `
  float kH = KIT_HOUSE;
  vec4 kD0 = kitData(kH, 0), kD1 = kitData(kH, 1);
  float kRole = mod(aKit.y, 64.0);
  vKitLod = floor(aKit.y / 64.0 + 0.01);
  transformed.y += aKit.z * (1.0 / 255.0) * (kD1.x + kD1.y * transformed.x + kD1.z * transformed.z + kD1.w * transformed.x * transformed.z);
  float kitSlot = texelFetch(uKitRoles, ivec2(int(kRole + 0.5), int(kD0.x + 0.5)), 0).r;
`;
  // no slot (a finish the stack cannot carry, or its layer not in yet): the vertex leaves the clip volume
  const VDROP = '\n  if (kitSlot < -0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);' +
    // (G3418) a house the town does not stand (setHidden: its plot edited - it builds unique now): its data's 4th float is 1
    // (0.25: it stands, it casts no shadow - setCast; 0: both)
    '\n  if (kD0.w > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);';
  const FDECL = '\nuniform vec4 uKitBand;\nuniform float uKitBandOn;\nflat varying float vKitLod;\n';
  // A2-FADES' band (G801's interleaved-gradient noise), per rung: lod 0 leaves at E0, lod 1 arrives at E0 and leaves at
  // E1, the box arrives at E1 - complementary, a pixel draws one rung
  const fDither = d => `
  if (uKitBandOn > 0.5) {
    float kN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float kT0 = clamp((${d} - (uKitBand.x - 0.5 * uKitBand.y)) / max(uKitBand.y, 1e-3), 0.0, 1.0);
    float kT1 = clamp((${d} - (uKitBand.z - 0.5 * uKitBand.w)) / max(uKitBand.w, 1e-3), 0.0, 1.0);
    if (vKitLod < 0.5) { if (kN >= 1.0 - kT0) discard; }
    else if (vKitLod < 1.5) { if (kN < 1.0 - kT0 || kN >= 1.0 - kT1) discard; }
    else if (kN < 1.0 - kT1) discard;
  }`;
  function rep(src, a, b, miss) { if (src.indexOf(a) < 0) { miss.push(a); return src; } return src.replace(a, () => b); }
  function editKit(sh, kind, miss) {
    let v = sh.vertexShader;
    v = rep(v, '#include <common>', '#include <common>\n' + VDECL, miss);
    v = rep(v, '#include <begin_vertex>', '#include <begin_vertex>\n' + VMAIN, miss);
    v = rep(v, 'vSlot = aSlot;', 'vSlot = kitSlot;', miss);
    v = rep(v, '#include <project_vertex>', '#include <project_vertex>' + VDROP, miss);
    if (kind === 'glass') {
      v = rep(v, 'attribute float aHouseLit;', '', miss);
      v = rep(v, 'vGlassP = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vGlassP = (modelMatrix * KIT_M * vec4(transformed, 1.0)).xyz;', miss);
      // THE LIGHTS (the record's byte: the lit share of the panes): every pane of the kit CAN glow (its palette index);
      // which ones do is a hash of the pane (its size and dressing, its storey, its wall) and the house
      v = rep(v, 'vHouseLit = aHouseLit;', 'vHouseLit = kitHash(vec4(aHouseWin.x + aHouseWin.y * 7.0, aHouseWin.z, floor(position.y / 2.6), kD0.z + dot(normal, vec3(1.3, 0.7, 2.1)))) < kD0.y ? aKit.w : 0.0;', miss);
    } else {
      v = rep(v, 'attribute float aHouseAO;', '', miss);
      v = rep(v, 'vHouseAO = aHouseAO;', 'vHouseAO = aKit.x * (1.0 / 255.0);', miss);
      // the world point (the noise, the wander, the clouds drift over the town, never repeat with the shape) and the
      // dirt line's height above the ground under the house's middle (G581's uDirtY0, per instance: the slot's is 0)
      v = rep(v, 'vHouseP = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vHouseP = (modelMatrix * KIT_M * vec4(transformed, 1.0)).xyz;', miss);
      v = rep(v, 'vHouseY = vHouseP.y;', 'vHouseY = vHouseP.y - (modelMatrix * KIT_M * vec4(0.0, kD1.x, 0.0, 1.0)).y;', miss);
    }
    sh.vertexShader = v;
    let f = sh.fragmentShader;
    f = rep(f, '#include <common>', '#include <common>' + FDECL, miss);
    f = rep(f, '#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + fDither('length(vViewPosition)'), miss);
    sh.fragmentShader = f;
    return sh;
  }
  // THE WORN GROUND OF A LOT (G3426, the city pack v2 §9.1): an instanced unit grid (x 0..1 along, z -0.5..0.5 across) made the
  // row's rectangle [0, L] x [-w/2, w/2], draped bilinearly on its four corners (aLotC: (0,-w/2) (L,-w/2) (L,+w/2) (0,+w/2),
  // relative to the row's y) + 4 cm; the map in world metres (uLotTile a repeat); its alpha faded over aLotS.w metres from each
  // edge, the fade broken by a value noise on the row's seed, so a strip never reads as a ruled band
  const LOTG_V = `
attribute vec4 aLotC;
attribute vec4 aLotS;
varying vec4 vLotE;
uniform float uLotTile;
`;
  const LOTG_F = `
varying vec4 vLotE;
float lotHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lotNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lotHash(i), lotHash(i + vec2(1.0, 0.0)), f.x), mix(lotHash(i + vec2(0.0, 1.0)), lotHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
  function editLotGround(sh) {
    const miss = [];
    sh.uniforms.uLotTile = sh.uniforms.uLotTile || { value: 2.0 };
    let v = sh.vertexShader;
    v = rep(v, '#include <common>', '#include <common>\n' + LOTG_V, miss);
    v = rep(v, '#include <begin_vertex>', `#include <begin_vertex>
  { float lu = position.x, lv = position.z + 0.5;
    transformed = vec3(lu * aLotS.x, mix(mix(aLotC.x, aLotC.y, lu), mix(aLotC.w, aLotC.z, lu), lv) + 0.04, position.z * aLotS.y);
    vLotE = vec4(min(transformed.x, aLotS.x - transformed.x), 0.5 * aLotS.y - abs(transformed.z), aLotS.z, aLotS.w);
    #ifdef USE_MAP
    vMapUv = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz / uLotTile;
    #endif
  }`, miss);
    sh.vertexShader = v;
    let f = sh.fragmentShader;
    f = rep(f, '#include <common>', '#include <common>\n' + LOTG_F, miss);
    f = rep(f, '#include <alphamap_fragment>', `#include <alphamap_fragment>
  { float fd = max(vLotE.w, 0.05), e = min(vLotE.x, vLotE.y);
    float nz = lotNoise(vec2(vLotE.x * 1.7 + vLotE.z, vLotE.y * 1.7 - vLotE.z * 0.37));
    diffuseColor.a *= smoothstep(0.0, fd, e - (nz - 0.35) * 0.6 * fd); }`, miss);
    sh.fragmentShader = f;
    if (miss.length) console.warn('townkit: the lot ground edits missed', miss);
    return miss;
  }
  // the shadow pass: the same stretch, the band from the EYE (not the light), no caster past castFar
  function editDepth(sh, miss) {
    let v = sh.vertexShader;
    v = rep(v, '#include <common>', '#include <common>\n' + VDECL + 'uniform vec3 uKitEye;\nuniform float uKitCast;\nvarying float vKitD;\n', miss);
    v = rep(v, '#include <begin_vertex>', '#include <begin_vertex>\n' + VMAIN, miss);
    v = rep(v, '#include <project_vertex>', '#include <project_vertex>\n' +
      '  { vKitD = distance((modelMatrix * KIT_M * vec4(transformed, 1.0)).xyz, uKitEye);\n' +
      '    vec3 kO = (modelMatrix * KIT_M * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\n' +
      '    if (kitSlot < -0.5 || kD0.w > 0.2 || distance(kO, uKitEye) > uKitCast) gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }', miss);
    sh.vertexShader = v;
    let f = sh.fragmentShader;
    f = rep(f, '#include <common>', '#include <common>' + FDECL + 'varying float vKitD;\n', miss);
    f = rep(f, '#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + fDither('vKitD'), miss);
    sh.fragmentShader = f;
    return sh;
  }

  // THREE DIALS THE RECORD DOES NOT CARRY. The sampler (HOUSE_GEN.randomHouse) draws a house's paint punch (by how
  // fresh its paint is: weather < 0.4), how far its dirt climbs and its frame's age; the 32 B record keeps the weather
  // and the dirt, not these. They are drawn here from the SAME distributions, off a hash of the record's place (the
  // same house the same draw every time), on a coarse step so records can share a look - DEF's one value for every
  // kit house read as a sameness the unique town never had (GATE KITHOST F reports the rest of the difference)
  function dials(r) {
    const hh = k => { const s = Math.sin(r.x * 12.9898 + r.z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
    const fresh = r.weather < 0.4, step = (v, s) => Math.round(v / s) * s;
    return { paintPunch: +step(fresh ? 0.30 + 0.35 * hh(1) : 0.10 + 0.30 * hh(1), 0.05).toFixed(2),
             dirtH: +step(0.6 + 0.8 * hh(2), 0.1).toFixed(2), frameAge: +step(0.4 + 0.4 * hh(3), 0.1).toFixed(2) };
  }

  // ---- THE HOST -------------------------------------------------------------------------------------------------
  function host(THREE, opts) {
    const o = Object.assign({ mode: 'batch', band: { E0: 150, W0: 40, E1: 1200, W1: 120 }, castFar: 600, hyst: 0.05 }, opts || {});
    const now = o.now || (() => performance.now());   // (GATE CITYHOST's allocation count hands a clock that cannot box)
    const P = o.pack, H0 = P.header, BAGS = H0.bags, HG = o.HG, T = o.tarr, rows = o.rows;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ST = { houses: rows.length, looks: 0, geos: 0, verts: 0, tris: [0, 0, 0], mb: 0, tickMs: 0, tickSum: 0, ticks: 0, cullMs: 0, culls: 0, changes: 0, draws: 0, missing: [], slotless: 0, buildMs: 0, mode: o.mode, visits: 0 };
    const U = { uKitData: { value: null }, uKitRoles: { value: null }, uKitBand: { value: new THREE.Vector4(o.band.E0, o.band.W0, o.band.E1, o.band.W1) },
                uKitBandOn: { value: o.band.W0 > 0 ? 1 : 0 }, uKitEye: { value: new THREE.Vector3() }, uKitCast: { value: o.castFar } };
    // WHAT EACH ROLE WEARS: a probe finish says which bags are glass (glass, pane: shadeGlass), which double-sided (the
    // flag, the star, the awning) and whether the house finishes dither
    const F0 = HG.makeFinish(); HG.applyFinish(Object.assign({}, HG.DEF), F0);
    const kindOf = BAGS.map(b => { const m = F0.MAT[b]; if (!m) return null; if (m.userData && m.userData.glassShaded) return 'glass'; return m.side === THREE.DoubleSide ? 'plain2' : 'plain'; });
    const dith = !!(F0.MAT.siding && F0.MAT.siding.dithering);
    // ---- the geometry: every (archetype, mirror) a row asks for, its three rungs, split by material
    const need = new Map();   // arch*2+mirror -> { a, mirror }
    for (const r of rows) need.set(r.arch * 2 + (r.mirror ? 1 : 0), { a: r.arch, mirror: !!r.mirror });
    const PARTS = new Map();  // key -> [lod] -> { plain, plain2, glass }
    const archBox = new Map();
    for (const [key, nd] of need) {
      const A = H0.archetypes[nd.a];
      if (!A) throw new Error('townkit: no archetype ' + nd.a);
      const lods = A.lods.map((meta, l) => { const parts = decodeLod(P, meta, l, kindOf); if (nd.mirror) for (const k in parts) parts[k] = mirrorOf(parts[k]); return parts; });
      PARTS.set(key, lods);
      if (!archBox.has(nd.a)) { const m = A.lods[0].pos; archBox.set(nd.a, { c: [(m.min[0] + m.max[0]) / 2, (m.min[1] + m.max[1]) / 2, (m.min[2] + m.max[2]) / 2], R: 0.5 * Math.hypot(m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2]) }); }
    }
    const KINDS = ['plain', 'plain2', 'glass'];
    // the roles the loaded geometry carries (a look is read back for these only)
    const USED = new Set();
    for (const lods of PARTS.values()) for (const parts of lods) for (const k in parts) { const K = parts[k].kit; for (let i = 1; i < K.length; i += 4) USED.add(K[i] & 63); }
    // ---- the looks: (finish set, paint x3, weather, dirt) -> a finish HOUSE_GEN makes -> a slot per role
    const LOOK = new Map(), looks = [];
    const lookOf = r => {
      const dl = dials(r);
      const k = [r.finish, r.wallCol, r.trimCol, r.roofCol, Math.round(r.weather * 255), Math.round(r.dirt * 255), dl.paintPunch, dl.dirtH, dl.frameAge].join(',');
      let i = LOOK.get(k);
      if (i === undefined) {
        i = looks.length; LOOK.set(k, i);
        const fs = H0.finishSets[r.finish] || H0.finishSets[0], Pl = Object.assign({}, HG.DEF);
        for (const f of FINISH_KEYS) if (fs[f] !== undefined) Pl[f] = fs[f];
        Object.assign(Pl, { wallCol: r.wallCol, trimCol: r.trimCol, roofCol: r.roofCol, weather: r.weather, dirt: r.dirt }, dl);
        const F = HG.makeFinish(); HG.applyFinish(Pl, F);
        looks.push({ key: k, F });
      }
      return i;
    };
    const houseLook = rows.map(lookOf);
    ST.looks = looks.length;
    const ROLES = new Float32Array(Math.max(1, BAGS.length * looks.length));
    const rolesTex = new THREE.DataTexture(ROLES, BAGS.length, Math.max(1, looks.length), THREE.RedFormat, THREE.FloatType);
    rolesTex.minFilter = rolesTex.magFilter = THREE.NearestFilter; rolesTex.generateMipmaps = false;
    U.uKitRoles.value = rolesTex;
    let waiting = false, tries = 0;
    // A LOOK IS READ BACK UNTIL IT RIDES: a finish whose maps are still decoding classifies as nothing yet (house_tarr
    // classifyMat), one whose layer is not in the stack gives -1 and wishes it; tick() asks again every RETRY frames
    // until every role a geometry carries has its slot (or MAXTRY asks: a finish the stack can never carry stays -1 and
    // its vertices leave the clip volume)
    const RETRY = 30, MAXTRY = 120;
    function relook() {
      let missing = 0, none = 0;
      const rowsML = ML();
      tries++;
      looks.forEach((L, li) => BAGS.forEach((b, r) => {
        if (!USED.has(r)) { ROLES[li * BAGS.length + r] = -1; return; }
        const m = L.F.MAT[b], s = m && kindOf[r] ? T.slot(m) : null;
        let v = -1;
        if (!s) none++;
        else if (s.slot < 0) missing++;
        else { v = s.slot; if (rowsML && rowsML.row) rowsML.row('house|townkit|slot' + s.slot, 'house', { color: m.color, roughness: m.roughness, metalness: m.metalness }); }
        ROLES[li * BAGS.length + r] = v;
      }));
      rolesTex.needsUpdate = true;
      // the table uploaded with the new rows; a layer wished for is built (the stack's ready signal calls relook again)
      const complete = T.end();
      waiting = !complete || missing > 0 || none > 0;
      ST.slotless = none; ST.missingLayers = missing; ST.waiting = waiting; ST.tries = tries;
      return !waiting;
    }
    // ---- the per-house data: [look, lights, seed, 0] [a, b, c, d] (the ground field in the GEOMETRY's frame)
    const TW = 1024, N = rows.length, TH = Math.max(1, Math.ceil(N * 2 / TW));
    const DATA = new Float32Array(TW * TH * 4);
    const M = [], C = [], RAD = [];
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), yAx = new THREE.Vector3(0, 1, 0);
    rows.forEach((r, h) => {
      // the table's corners (-L/2,-w/2) (+L/2,-w/2) (+L/2,+w/2) (-L/2,+w/2) are in the ARCHETYPE's frame, where a mirror
      // swapped -x and +x; a mirrored COPY's own x is the archetype's negated - the house's frame again - so its corners
      // are the table's swapped back. The field over the footprint's own lengths (the stretch is the matrix's, after)
      const A = H0.archetypes[r.arch], L = A.foot.L, W = A.foot.w, g = r.ground;
      const [c0, c1, c2, c3] = r.mirror ? [g[1], g[0], g[3], g[2]] : g;
      const a = (c0 + c1 + c2 + c3) / 4, b = ((c1 + c2) - (c0 + c3)) / (2 * L), c = ((c2 + c3) - (c0 + c1)) / (2 * W), d = (c0 - c1 + c2 - c3) / (L * W);
      const o0 = h * 8;
      DATA[o0] = houseLook[h]; DATA[o0 + 1] = r.lights; DATA[o0 + 2] = ((Math.abs(Math.sin(r.x * 12.9898 + r.z * 78.233)) * 43758.5453) % 1) * 97; DATA[o0 + 3] = 0;
      DATA[o0 + 4] = a; DATA[o0 + 5] = b; DATA[o0 + 6] = c; DATA[o0 + 7] = d;
      q.setFromAxisAngle(yAx, r.yaw);
      mtx.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.scale || 1, 1, 1));
      M.push(mtx.clone());
      const bx = archBox.get(r.arch), cl = new THREE.Vector3(r.mirror ? -bx.c[0] : bx.c[0], bx.c[1], bx.c[2]).applyMatrix4(mtx);
      C.push(cl); RAD.push(bx.R * Math.max(1, r.scale || 1));
    });
    const dataTex = new THREE.DataTexture(DATA, TW, TH, THREE.RGBAFormat, THREE.FloatType);
    dataTex.minFilter = dataTex.magFilter = THREE.NearestFilter; dataTex.generateMipmaps = false; dataTex.needsUpdate = true;
    U.uKitData.value = dataTex;
    // ---- the materials: MATLIB's `house` shape with house_tarr's hook and the kit's edits
    const mats = {}, lib = ML();
    const hooked = (kind, m) => {
      const Hk = T.hook(kind === 'glass' ? 'glass' : 'plain');
      m.onBeforeCompile = sh => { Hk(sh); Object.assign(sh.uniforms, U); const miss = []; editKit(sh, kind, miss); if (miss.length) { ST.missing = miss; console.warn('townkit: the', kind, 'edits missed', miss); } };
      m.customProgramCacheKey = () => 'townkit:' + kind;
      m.userData.townkit = kind;
      return m;
    };
    for (const k of KINDS) mats[k] = hooked(k, lib.shared(THREE, 'house', { side: k === 'plain2' ? THREE.DoubleSide : THREE.FrontSide, dithering: dith }, 'townkit:' + k));
    const depthOf = scope => {
      const d = lib.shared(THREE, 'depth', {}, scope);
      d.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); const miss = []; editDepth(sh, miss); if (miss.length) { ST.missing = miss; console.warn('townkit: the depth edits missed', miss); } };
      d.customProgramCacheKey = () => 'townkit:depth';
      return d;
    };
    const depth = depthOf('townkit:depth');
    // (G3417) the same look on materials of their own, for plain meshes (the town host's far cells): a material drawn by a
    // BatchedMesh and a plain Mesh in one frame changes its program at every switch (three's needsProgramChange)
    const matsBy = new Map();
    function matsFor(tag) {
      let m = matsBy.get(tag);
      if (!m) { m = {}; for (const k of KINDS) m[k] = hooked(k, lib.shared(THREE, 'house', { side: k === 'plain2' ? THREE.DoubleSide : THREE.FrontSide, dithering: dith }, 'townkit:' + tag + ':' + k)); matsBy.set(tag, m); }
      return m;
    }
    // the instanced arm's own records (MATLIB.variant copies a hook only when it is the material's own property; the
    // game's ATMO keeps it behind its accessor), made when that arm is
    // ---- the geometry, made once per part
    const GEO = new Map();   // key*3 + lod -> { kind: BufferGeometry }
    for (const [key, lods] of PARTS) lods.forEach((parts, l) => {
      const G = {};
      for (const k of KINDS) if (parts[k] && parts[k].tris) { G[k] = geometryOf(THREE, parts[k]); ST.geos++; ST.verts += parts[k].n; ST.tris[l] += parts[k].tris; ST.mb += (parts[k].n * (12 + 4 + 8 + 4 + (parts[k].win ? 12 : 0)) + parts[k].idx.byteLength) / 1048576; }
      GEO.set(key * 3 + l, G);
    });
    PARTS.clear();
    const group = new THREE.Group(); group.name = 'townkit'; group.userData.batch = true;
    const rung = new Int8Array(N).fill(-1), partner = new Int8Array(N).fill(-1);
    // (C3c, G862) a house the town does not stand (Metlakatla's lot planned another outbuilding than the table's): no
    // rung at all, from the next tick
    const hidden = new Uint8Array(N), noCast = new Uint8Array(N);
    // (G3418) the shader's flags in the house's data (its 4th float): 1 hidden (view and shadow drop it), 0.25 no shadow
    const flagOut = h => { const w = hidden[h] ? 1 : noCast[h] ? 0.25 : 0; if (DATA[h * 8 + 3] !== w) { DATA[h * 8 + 3] = w; dataTex.needsUpdate = true; } };
    const keyOf = r => r.arch * 2 + (r.mirror ? 1 : 0);
    // ================= THE BATCH HOST =================
    const B = {};
    function batchBuild() {
      for (const k of KINDS) {
        let nv = 0, ni = 0;
        for (const G of GEO.values()) if (G[k]) { nv += G[k].attributes.position.count; ni += G[k].index.count; }
        if (!nv) continue;
        const bm = new THREE.BatchedMesh(2 * N, nv, ni, mats[k]);
        bm.name = 'townkit:' + k; bm.perObjectFrustumCulled = true; bm.sortObjects = false;
        bm.castShadow = true; bm.receiveShadow = true; bm.customDepthMaterial = depth; bm.userData.batch = true;
        const ids = new Map();
        for (const [gk, G] of GEO) if (G[k]) ids.set(gk, bm.addGeometry(G[k]));
        const any = ids.values().next().value;
        for (let h = 0; h < N; h++) for (let s = 0; s < 2; s++) { const id = bm.addInstance(any); if (id !== 2 * h + s) throw new Error('townkit: instance ids out of order'); bm.setMatrixAt(id, M[h]); bm.setVisibleAt(id, false); }
        // the cull's cost, measured (G585: "the cost moved, not measured"): the per-instance walk runs in onBeforeRender,
        // once a pass (the shadow pass calls it too)
        const obr = bm.onBeforeRender;
        bm.onBeforeRender = function () { const t = performance.now(); const r = obr.apply(this, arguments); ST.cullMs += performance.now() - t; ST.culls++; return r; };
        // the object's own sphere (three's first test) from every house at its largest rung, with room for the stretch
        for (let h = 0; h < N; h++) { const gid = ids.get(keyOf(rows[h]) * 3); if (gid !== undefined) bm.setGeometryIdAt(2 * h, gid); }
        bm.computeBoundingSphere(); bm.boundingSphere.radius += 20;
        B[k] = { bm, ids };
        group.add(bm);
      }
    }
    function batchSet(h, slot, lod) {
      const r = rows[h], gk = keyOf(r) * 3 + lod;
      for (const k in B) {
        const { bm, ids } = B[k], id = 2 * h + slot, gid = lod >= 0 ? ids.get(gk) : undefined;
        if (gid === undefined) bm.setVisibleAt(id, false);
        else { bm.setGeometryIdAt(id, gid); bm.setVisibleAt(id, true); }
      }
    }
    // ================= THE INSTANCED ALTERNATIVE (the measurement's other arm) =================
    const I = new Map();   // gk*3 + kindIndex -> { mesh, ids }
    const matsI = {}; let depthI = null;
    let instDirty = true;
    function instBuild() {
      const cap = new Map();
      for (const r of rows) cap.set(keyOf(r), (cap.get(keyOf(r)) || 0) + 1);
      for (const [gk, G] of GEO) KINDS.forEach((k, ki) => {
        if (!G[k]) return;
        const n = cap.get(Math.floor(gk / 3));
        const mi = matsI[k] || (matsI[k] = hooked(k, lib.shared(THREE, 'house', { side: k === 'plain2' ? THREE.DoubleSide : THREE.FrontSide, dithering: dith }, 'townkit:inst:' + k)));
        const im = new THREE.InstancedMesh(G[k], mi, n);
        const ida = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); G[k].setAttribute('aKitId', ida);
        im.name = 'townkit:inst:' + k; im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = true;
        im.customDepthMaterial = depthI || (depthI = depthOf('townkit:inst:depth')); im.userData.batch = true;
        I.set(gk * 3 + ki, { im, ida }); group.add(im);
      });
    }
    function instFlush() {
      for (const E of I.values()) E.n = 0;
      const put = (h, lod) => {
        if (lod < 0) return;
        const gk = keyOf(rows[h]) * 3 + lod;
        for (let ki = 0; ki < 3; ki++) { const E = I.get(gk * 3 + ki); if (!E) continue; E.im.setMatrixAt(E.n, M[h]); E.ida.array[E.n] = h; E.n++; }
      };
      for (let h = 0; h < N; h++) { put(h, rung[h]); put(h, partner[h]); }
      for (const E of I.values()) {
        E.im.count = E.n; E.im.instanceMatrix.needsUpdate = true; E.ida.needsUpdate = true;
        E.im.visible = E.n > 0; if (E.n) E.im.computeBoundingSphere();
      }
      instDirty = false;
    }
    if (o.mode === 'inst') instBuild(); else batchBuild();
    relook();
    ST.buildMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    // ================= THE TICK: each house's rung, and its partner inside a band =================
    // G3416 (CITY-B) THE NEAR RING: the tick walked all N houses every frame wherever the eye was (Metlakatla's 522 from
    // 6.4 km, every one at its box). A house past its REACH - its radius plus the farthest band edge (E1 + W1 / 2, or the hard
    // switch's E1 with its hysteresis) - is at its FAR STATE whatever the eye does: the box rung alone (o.farRung, 2; the town
    // host passes -1 for a house of a far cell: the cell's merged mesh draws it), no partner. The ring (town_ring.js) keeps the houses within reach + move of the
    // eye; the tick walks those only, a house leaving is put to its far state once. The rungs are the ones the full walk
    // made (GATE KITHOST E; GATE CITYHOST holds the two equal along a flight). ?kitring=0 (o.ring false): the full walk.
    const bandOn = () => U.uKitBandOn.value > 0.5;
    const FAR_RUNG = o.farRung === undefined ? 2 : o.farRung;
    const reachOf = h => RAD[h] + Math.max(o.band.E1 + o.band.W1 / 2, o.band.E1 * (1 + o.hyst)) + 1;
    const RL = o.ring === false || o.select ? null : ringLib();
    let RG = null, farAll = true;
    function farOne(h) {
      const p = hidden[h] ? -1 : FAR_RUNG;
      if (p === rung[h] && partner[h] === -1) return;
      if (o.mode === 'batch') { if (p !== rung[h]) batchSet(h, 0, p); if (partner[h] !== -1) batchSet(h, 1, -1); } else instDirty = true;
      rung[h] = p; partner[h] = -1; ST.changes++;
    }
    if (RL) { RG = RL.make({ cell: 256, move: 40, onLeave: farOne }); for (let h = 0; h < N; h++) RG.add(h, C[h].x, C[h].z, reachOf(h)); }
    let frame = 0, visits = 0, changed = 0;
    // one house's rung from the eye (the full walk's body, unchanged)
    function stepOne(h, eye) {
      const { E0, W0, E1, W1 } = o.band, on = bandOn();
      const d = C[h].distanceTo(eye), R = RAD[h];
      let p, pq = -1;
      if (on) {
        if (d - R > E1 + W1 / 2) p = 2;
        else if (d + R < E0 - W0 / 2) p = 0;
        else if (d - R > E0 + W0 / 2 && d + R < E1 - W1 / 2) p = 1;
        else if (d < (E0 + E1) / 2) { p = 0; pq = 1; }
        else { p = 1; pq = 2; }
      } else {
        // the hard switch, with hysteresis
        const cur = rung[h], k = o.hyst;
        const e0 = E0 * (cur === 0 ? 1 + k : 1 - k), e1 = E1 * (cur === 2 ? 1 - k : 1 + k);
        p = d < e0 ? 0 : d < e1 ? 1 : 2;
      }
      if (hidden[h]) { p = -1; pq = -1; }
      visits++;
      if (p !== rung[h] || pq !== partner[h]) {
        if (o.mode === 'batch') { if (p !== rung[h]) batchSet(h, 0, p); if (pq !== partner[h]) batchSet(h, 1, pq); } else instDirty = true;
        rung[h] = p; partner[h] = pq; changed++;
      }
    }
    function tickBegin(eye) {
      if (waiting && tries < MAXTRY && ++frame % RETRY === 0) relook();
      U.uKitEye.value.copy(eye);
      visits = 0; changed = 0;
    }
    function tickEnd(ts) {
      if (o.mode === 'inst' && instDirty) instFlush();
      ST.changes += changed; ST.visits = visits;
      ST.tickMs = now() - ts; ST.tickSum += ST.tickMs; ST.ticks++;
    }
    function tick(eye) {
      const ts = now();
      tickBegin(eye);
      if (RG) {
        if (farAll) { farAll = false; for (let h = 0; h < N; h++) farOne(h); RG.dirty(); }   // (the first tick, a new band: every house to its far state once)
        RG.updateEye(eye);
        const L = RG.list, n = RG.n;
        for (let k = 0; k < n; k++) stepOne(L[k], eye);
      } else for (let h = 0; h < N; h++) stepOne(h, eye);
      tickEnd(ts);
    }
    // (the town host, o.select: the caller says which houses are near - its near cells' - and puts the rest far)
    function tickSome(eye, ids, from, count) {
      const ts = now();
      tickBegin(eye);
      for (let k = from; k < from + count; k++) stepOne(ids[k], eye);
      tickEnd(ts);
    }
    function drawsNow() {
      let n = 0;
      if (o.mode === 'batch') { for (const k in B) if (B[k].bm._multiDrawCount) n++; }
      else for (const E of I.values()) if (E.im.visible && E.n) n++;
      return n;
    }
    function rungs() { const c = [0, 0, 0, 0, 0]; for (let h = 0; h < N; h++) { if (rung[h] < 0) c[4]++; else c[rung[h]]++; if (partner[h] >= 0) c[3]++; } return { lod0: c[0], lod1: c[1], box: c[2], partners: c[3], none: c[4] }; }
    // (C3c, G862) A KIT HOUSE IS SOLID: its triangles at `lod` (1: the generator's far mesh, ~1 000 a house) in the
    // house's own frame - turned by its yaw about (x, y, z) of its record, y from the record's ground - the stretch
    // along the ridge and THE STANCE applied as the vertex shader applies them (VMAIN: the stance weight times the
    // ground field), for the obstacle raster (render_premises shapeOf's frame)
    function hitMesh(h, lod) {
      const r = rows[h], G = GEO.get(keyOf(r) * 3 + (lod === undefined ? 1 : lod));
      if (!G) return null;
      const o0 = h * 8, a = DATA[o0 + 4], b = DATA[o0 + 5], c = DATA[o0 + 6], d = DATA[o0 + 7], sx = r.scale || 1;
      const pos = [], idx = [];
      for (const k of KINDS) {
        const g = G[k]; if (!g) continue;
        const Pa = g.attributes.position.array, Ka = g.attributes.aKit.array, Ia = g.index.array, base = pos.length / 3, n = Pa.length / 3;
        for (let i = 0; i < n; i++) { const x = Pa[i * 3], y = Pa[i * 3 + 1], z = Pa[i * 3 + 2]; pos.push(x * sx, y + Ka[i * 4 + 2] / 255 * (a + b * x + c * z + d * x * z), z); }
        for (let t = 0; t < Ia.length; t++) idx.push(base + Ia[t]);
      }
      return { pos, idx };
    }
    function dispose() {
      for (const G of GEO.values()) for (const k in G) G[k].dispose();
      for (const k in B) B[k].bm.dispose();
      for (const E of I.values()) E.im.dispose();
      dataTex.dispose(); rolesTex.dispose();
      if (group.parent) group.parent.remove(group);
    }
    return {
      group, tick, relook, dispose, U, stats: ST, rows, mats, matsFor, depth, rungs, drawsNow, hitMesh,
      setHidden(h, v) { hidden[h] = v ? 1 : 0; if (RG && !RG.has(h)) farOne(h); flagOut(h); },   // (C3c; G3416: a far house hides now - the ring will not visit it; G3418: the shader's flag)
      isHidden: h => !!hidden[h],
      setCast(h, v) { noCast[h] = v ? 0 : 1; flagOut(h); }, mayCast: h => !noCast[h],   // (G3418: the city pack's flag 8 - an outbuilding too small to cast)
      get waiting() { return waiting; },
      get band() { return o.band; },
      setBand(b) { Object.assign(o.band, b || {}); U.uKitBand.value.set(o.band.E0, o.band.W0, o.band.E1, o.band.W1); U.uKitBandOn.value = o.band.W0 > 0 ? 1 : 0; rung.fill(-1); partner.fill(-1);
        if (RG) { for (let h = 0; h < N; h++) RG.add(h, C[h].x, C[h].z, reachOf(h)); RG.reMax(); farAll = true; } },
      tickSome, farOne, reachOf, ring: () => RG,   // (G3416: the town host drives the rungs of its near cells' houses)
      get visible() { return group.visible; }, set visible(v) { group.visible = !!v; },
      centre: h => C[h], radius: h => RAD[h], matrix: h => M[h], look: h => houseLook[h], lookCount: () => looks.length,
      // (GATE KITHOST's eyes)
      dataOf: h => DATA.subarray(h * 8, h * 8 + 8), rungOf: h => [rung[h], partner[h]], roleTable: () => ROLES, usedRoles: () => USED,
      geoId: (kind, h, lod) => { const E = B[kind]; if (!E || lod < 0) return undefined; return E.ids.get(keyOf(rows[h]) * 3 + lod); },
    };
  }

  // ==================================================================================================================
  // THE TOWN HOST (G3417-G3420, CITY-B; futureDesigns/CITY-2.0-PLAN-2026-10-20.md, METLA-2.0-HANDOVER.md §4). A SOWN town
  // drawn ONLY from its cooked pack - CITY-A's format v1 (futureDesigns/CITY-PACK-FORMAT.md; tools/city_cook.js writes it,
  // src/core/city_packs.json + media/city/<island>/<town>/c_<i>_<j>.<h8>.bin):
  //   - FAR CELLS: one static merged Mesh a cell (the cook's far mesh: its SHELL - walls and roofs - alone, G3423: the lots'
  //     ground is not drawn, the terrain shows; the roads' bucket is left to the town's own roads, which draw at every
  //     distance), its matrix composed once (matrixAutoUpdate and matrixWorldAutoUpdate off), one draw, no shadow;
  //   - NEAR CELLS (the eye within the switch of the cell's box: o.far, the cook's lod.far 1 km, a dial - setSwitch): the instanced
  //     kit (the house host above, BatchedMesh: three objects for the whole town), each near cell's kit rows on their rungs;
  //     the cell's far mesh hidden;
  //   - the near props (within lod.propFar of a cell's box): one InstancedMesh a prop key's part (cast / flat apart),
  //     filled with those cells' rows when that set changes.
  // NO PER-PLOT Object3D: the census is the cells + the kit's three batches + the props' meshes, whatever the town holds.
  // THE TICK walks the cell ring (town_ring.js) and the near cells' rows only: an idle far town is a subtraction and two
  // comparisons a frame, and allocates nothing (GATE CITYHOST).
  //   TOWNKIT.decodeCityCell(bytes)          -> one cell (gunzipped): its header, far mesh (decoded), kit rows, props
  //   TOWNKIT.cityOf(townEntry, cells)       -> the town as one city: rows and props concatenated in cell order, ranges a cell
  //   TOWNKIT.town(THREE, opts)              -> T
  //     opts: { pack (decodePack), city (cityOf), tarr, HG, farMats { shell }, propGeo(key) -> [{ geometry, material }]
  //             | null (not landed yet: T.propsAgain() when it has), onCell(ci, near), lod (city.lod), far (m), lotMats [post, deck],
  //             lotGround(tex) -> material, band, now }
  //     T.group, T.tick(eye), T.freeze() (once the group stands in the scene), T.stats, T.kit (the house host), T.cellNear(ci),
  //     T.census(), T.propsAgain(), T.dispose()
  // v2 (G3405, CITY-A): far = the shells alone with their owners' ranges, the lots section, the town's lot kit. v1 is still read
  // (a v1 cell has no lots); render_premises asks for v2 (the format's own rule: the host refuses what it does not draw)
  const CITY_MAGIC = 0x59544943, CITY_V = 2, CITY_VS = [1, 2], CITY_VSTRIDE = 12, CITY_PSTRIDE = 20, CITY_LSTRIDE = 32;
  const LOTKIT_MAGIC = 0x544b544c, LOTKIT_VSTRIDE = 16;
  const SRGB_LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; SRGB_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function decodeCityCell(b0) {
    const b = u8(b0), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (dv.getUint32(0, true) !== CITY_MAGIC) throw new Error('townkit: not a city cell');
    const v = dv.getUint32(4, true); if (CITY_VS.indexOf(v) < 0) throw new Error('townkit: city cell v' + v + ' (this host reads v' + CITY_VS.join(' / v') + ')');
    const hl = dv.getUint32(8, true), head = JSON.parse(utf8(b.subarray(12, 12 + hl)));
    const base = 12 + hl + ((4 - ((12 + hl) & 3)) & 3);
    const sec = k => { const s = head.sec[k]; return s ? b.subarray(base + s[0], base + s[0] + s[1]) : b.subarray(0, 0); };
    // the far mesh: positions to f32 in the cell's frame (from the box's low corner), the octahedral normals to i8 x 4, the
    // sRGB colours to linear f32, the bucket a vertex
    const F = head.far, n = F.verts, B = head.box, vb = sec('vb'), vd = new DataView(vb.buffer, vb.byteOffset, vb.byteLength);
    const sx = (B[3] - B[0]) / 65535, sy = (B[4] - B[1]) / 65535, sz = (B[5] - B[2]) / 65535;
    const pos = new Float32Array(n * 3), nrm = new Int8Array(n * 4), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = i * CITY_VSTRIDE;
      pos[i * 3] = vd.getUint16(o, true) * sx; pos[i * 3 + 1] = vd.getUint16(o + 2, true) * sy; pos[i * 3 + 2] = vd.getUint16(o + 4, true) * sz;
      const nn = octDec(vd.getInt8(o + 6), vd.getInt8(o + 7));
      nrm[i * 4] = Math.round(nn[0] * 127); nrm[i * 4 + 1] = Math.round(nn[1] * 127); nrm[i * 4 + 2] = Math.round(nn[2] * 127);
      col[i * 3] = SRGB_LIN[vb[o + 8]]; col[i * 3 + 1] = SRGB_LIN[vb[o + 9]]; col[i * 3 + 2] = SRGB_LIN[vb[o + 10]];
    }
    const ib = sec('ib').slice(), idx = F.index === 32 ? new Uint32Array(ib.buffer, 0, ib.byteLength >> 2) : new Uint16Array(ib.buffer, 0, ib.byteLength >> 1);
    const ks = sec('kit'), kit = ks.length ? decodeInstances(ks.slice()) : { head: { plots: [] }, rows: [] };
    const ps = sec('props'), pd = new DataView(ps.buffer, ps.byteOffset, ps.byteLength), np = Math.floor(ps.byteLength / CITY_PSTRIDE);
    const props = { n: np, x: new Float32Array(np), y: new Float32Array(np), z: new Float32Array(np), yaw: new Float32Array(np), key: new Uint16Array(np), owner: new Uint16Array(np), flags: new Uint8Array(np), kind: new Uint8Array(np) };
    for (let i = 0; i < np; i++) { const o = i * CITY_PSTRIDE;
      props.x[i] = pd.getFloat32(o, true); props.y[i] = pd.getFloat32(o + 4, true); props.z[i] = pd.getFloat32(o + 8, true); props.yaw[i] = pd.getUint16(o + 12, true) / 65536 * 2 * Math.PI;
      props.key[i] = pd.getUint16(o + 14, true); props.owner[i] = pd.getUint16(o + 16, true); props.flags[i] = ps[o + 18]; props.kind[i] = ps[o + 19]; }
    // the lots (v2, CITY-PACK-FORMAT §9.1): 32 B rows - origin, yaw, length and width (cm), the piece, the flags, the owner,
    // the seed, the ground at the four corners (cm, relative to y)
    const ls = sec('lots'), ld = new DataView(ls.buffer, ls.byteOffset, ls.byteLength), nl = Math.floor(ls.byteLength / CITY_LSTRIDE);
    const lots = { n: nl, x: new Float32Array(nl), y: new Float32Array(nl), z: new Float32Array(nl), yaw: new Float32Array(nl), len: new Float32Array(nl), wid: new Float32Array(nl),
                   piece: new Uint8Array(nl), flags: new Uint8Array(nl), owner: new Uint16Array(nl), seed: new Uint16Array(nl), g: new Float32Array(nl * 4) };
    for (let i = 0; i < nl; i++) { const o = i * CITY_LSTRIDE;
      lots.x[i] = ld.getFloat32(o, true); lots.y[i] = ld.getFloat32(o + 4, true); lots.z[i] = ld.getFloat32(o + 8, true); lots.yaw[i] = ld.getUint16(o + 12, true) / 65536 * 2 * Math.PI;
      lots.len[i] = ld.getUint16(o + 14, true) / 100; lots.wid[i] = ld.getUint16(o + 16, true) / 100; lots.piece[i] = ls[o + 18]; lots.flags[i] = ls[o + 19];
      lots.owner[i] = ld.getUint16(o + 20, true); lots.seed[i] = ld.getUint16(o + 22, true);
      for (let k = 0; k < 4; k++) lots.g[i * 4 + k] = ld.getInt16(o + 24 + k * 2, true) / 100; }
    return { v, head, i: head.cell[0], j: head.cell[1], box: B, far: { n, tris: F.tris, pos, nrm, col, idx, buckets: F.buckets || [], draws: F.draws || [], owners: F.owners || [] }, kit, props, lots };
  }
  // THE TOWN'S LOT KIT (v2, §9.2): the fence's pieces cooked once - a piece's mesh split by its role (0 post, 1 deck: the fence
  // finish's two materials), in the piece's own frame (metres; uv in metres); a 'ground' or an 'old' piece has no mesh
  function decodeLotKit(b0) {
    const b = u8(b0), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (dv.getUint32(0, true) !== LOTKIT_MAGIC) throw new Error('townkit: not a lot kit');
    const hl = dv.getUint32(8, true), head = JSON.parse(utf8(b.subarray(12, 12 + hl)));
    const base = 12 + hl + ((4 - ((12 + hl) & 3)) & 3);
    const pieces = head.pieces.map(P => {
      const out = Object.assign({}, P, { parts: [] });
      if (!P.verts || !P.vb || !P.ib) return out;
      const vb = b.subarray(base + P.vb[0], base + P.vb[0] + P.vb[1]), vd = new DataView(vb.buffer, vb.byteOffset, vb.byteLength);
      const ib = b.slice(base + P.ib[0], base + P.ib[0] + P.ib[1]), idx = new Uint16Array(ib.buffer, 0, ib.byteLength >> 1);
      const n = P.verts, X = P.box, U = P.uv || [0, 0, 1, 1], role = new Uint8Array(n);
      const pos = new Float32Array(n * 3), nrm = new Int8Array(n * 4), uv = new Float32Array(n * 2), ao = new Float32Array(n);
      for (let i = 0; i < n; i++) { const o = i * LOTKIT_VSTRIDE;
        for (let a = 0; a < 3; a++) pos[i * 3 + a] = X[a] + vd.getUint16(o + a * 2, true) / 65535 * (X[3 + a] - X[a]);
        const nn = octDec(vd.getInt8(o + 6), vd.getInt8(o + 7)); for (let a = 0; a < 3; a++) nrm[i * 4 + a] = Math.round(nn[a] * 127);
        uv[i * 2] = U[0] + vd.getUint16(o + 8, true) / 65535 * (U[2] - U[0]); uv[i * 2 + 1] = U[1] + vd.getUint16(o + 10, true) / 65535 * (U[3] - U[1]);
        ao[i] = vb[o + 12] / 255; role[i] = vb[o + 13]; }
      // a triangle is one role's (its first vertex's), re-indexed into its role's own arrays
      for (let r = 0; r < 2; r++) {
        const map = new Int32Array(n).fill(-1), I = []; let m = 0;
        for (let t = 0; t < idx.length; t += 3) { if (role[idx[t]] !== r) continue; for (let q = 0; q < 3; q++) { const v = idx[t + q]; if (map[v] < 0) map[v] = m++; I.push(map[v]); } }
        if (!I.length) continue;
        const Pp = new Float32Array(m * 3), Nn = new Int8Array(m * 4), Uv = new Float32Array(m * 2), Ao = new Float32Array(m);
        for (let v = 0; v < n; v++) { const k = map[v]; if (k < 0) continue; Pp.set(pos.subarray(v * 3, v * 3 + 3), k * 3); Nn.set(nrm.subarray(v * 4, v * 4 + 4), k * 4); Uv.set(uv.subarray(v * 2, v * 2 + 2), k * 2); Ao[k] = ao[v]; }
        out.parts.push({ role: r, n: m, pos: Pp, nrm: Nn, uv: Uv, ao: Ao, idx: Uint16Array.from(I) });
      }
      return out;
    });
    return { head, pieces };
  }
  // the town as one city: the cells in the manifest's order, their kit rows and props concatenated (a cell a range)
  function cityOf(town, cells, lotKit) {
    const rows = [], out = [];
    let np = 0; for (const c of cells) np += c.props.n;
    const P = { n: np, x: new Float32Array(np), y: new Float32Array(np), z: new Float32Array(np), yaw: new Float32Array(np), key: new Uint16Array(np), flags: new Uint8Array(np), kind: new Uint8Array(np), owner: new Uint16Array(np) };
    let nl = 0; for (const c of cells) nl += c.lots ? c.lots.n : 0;
    const LT = { n: nl, x: new Float32Array(nl), y: new Float32Array(nl), z: new Float32Array(nl), yaw: new Float32Array(nl), len: new Float32Array(nl), wid: new Float32Array(nl),
                 piece: new Uint8Array(nl), flags: new Uint8Array(nl), owner: new Uint16Array(nl), seed: new Uint16Array(nl), g: new Float32Array(nl * 4) };
    let po = 0, lo = 0;
    cells.forEach((c, ci) => {
      const r0 = rows.length;
      for (const r of c.kit.rows) rows.push(Object.assign(r, { i: rows.length, cell: ci }));
      for (const k of ['x', 'y', 'z', 'yaw', 'key', 'flags', 'kind', 'owner']) P[k].set(c.props[k], po);
      const cl = c.lots || { n: 0 };
      if (cl.n) for (const k of ['x', 'y', 'z', 'yaw', 'len', 'wid', 'piece', 'flags', 'owner', 'seed', 'g']) LT[k].set(cl[k], k === 'g' ? lo * 4 : lo);
      const B = c.box;
      out.push({ ci, i: c.i, j: c.j, key: c.i + ',' + c.j, box: [B[0], B[2], B[3], B[5]], o: [B[0], B[1], B[2]], rows: [r0, c.kit.rows.length], props: [po, c.props.n], lots: [lo, cl.n],
                 far: c.far, plots: c.head.plots || [], uniques: c.head.uniques || [], objects: c.head.objects || [], v: c.v });
      po += c.props.n; lo += cl.n;
    });
    // (v2: lod.far is the switch, nearIn / nearOut = far -/+ 50; a v1 pack has nearIn / nearOut alone)
    const lod = Object.assign({ far: 1000, nearIn: 950, nearOut: 1050, kitE0: 150, kitE1: 1200, propFar: 600, lotFar: 400, castFar: 600, farGain: 0.2 }, town && town.lod);
    return { town, lod, keys: (town && town.propKeys) || [], cells: out, rows, props: P, lots: LT, lotKit: lotKit || null };
  }
  function town(THREE, opts) {
    const o = Object.assign({ move: 40 }, opts || {});
    const city = o.city, cells = city.cells, NCELL = cells.length, rows = city.rows, NH = rows.length, L = o.lod || city.lod;
    const band = Object.assign({ E0: L.kitE0, W0: 40, E1: L.kitE1, W1: 120 }, o.band || {});
    const now = o.now || (() => performance.now());
    const t0 = now();
    if (!o.farMats || !o.farMats.shell) throw new Error('townkit.town: o.farMats { shell } (the far town\'s material, the page\'s)');
    // the near kit: the house host, driven per near cell (o.select: no ring of its own); a far cell's rows draw nothing
    const K = o.kit || host(THREE, { pack: o.pack, rows, tarr: o.tarr, HG: o.HG, mode: 'batch', band, castFar: L.castFar, select: true, farRung: -1, now });
    for (let h = 0; h < NH; h++) if (!(rows[h].flags & 8)) K.setCast(h, false);   // (the cook's flag 8: this row may cast)
    const group = new THREE.Group(); group.name = 'premises:town'; group.userData.batch = true;
    K.group.name = 'town:kit'; group.add(K.group);
    const ST = { cells: NCELL, houses: NH, near: 0, nearHouses: 0, propCells: 0, visits: 0, cellVisits: 0, switches: 0, tickMs: 0, tickSum: 0, ticks: 0, buildMs: 0,
                 farDraws: 0, farTris: 0, propsNear: 0, lotCells: 0, lotsNear: 0, castOn: false, census: 0 };
    // ---- the far cells: one static Mesh a cell, its SHELL alone (walls and roofs, one draw); hidden while the cell is near.
    // (G3423, the user 20 Oct: "no flat lot squares" - the cook's lots bucket is not drawn, near or far: the terrain's texture
    // shows; the roads bucket neither - the town's own roads draw at every distance)
    const mats = [o.farMats.shell];
    const FAR = new Array(NCELL).fill(null), GF = new Array(NCELL);
    for (const c of cells) {
      const F = c.far; if (!F || !F.n) continue;
      const bk = name => F.buckets.find(q => q.name === name) || null, W = bk('walls'), R = bk('roofs');
      const shell = [];
      if (W && R && W.first + W.count === R.first) shell.push({ start: W.first, count: W.count + R.count, materialIndex: 0 });
      else for (const q of [W, R]) if (q && q.count) shell.push({ start: q.first, count: q.count, materialIndex: 0 });
      if (!shell.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(F.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(F.nrm, 4, true));
      g.setAttribute('color', new THREE.BufferAttribute(F.col, 3)); g.setIndex(new THREE.BufferAttribute(F.idx, 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      GF[c.ci] = shell;
      g.groups = shell;
      const m = new THREE.Mesh(g, mats);
      m.name = 'town:far:' + c.key; m.position.set(c.o[0], c.o[1], c.o[2]);
      m.castShadow = false; m.receiveShadow = true; m.userData.batch = true; m.userData.townCell = c.ci;
      m.updateMatrix(); m.matrixAutoUpdate = false;
      group.add(m); FAR[c.ci] = m; ST.farDraws += GF[c.ci].length; ST.farTris += F.tris;
    }
    // ---- A NEAR INSTANCE TABLE (the props, G3420; the near lots, G3424): rows (x, y, z, yaw, a scale x / y / z or none, a
    // shear k - y += x k, the lot pieces' rise - or none, a key, a cast bit, a hide bit) a cell a range; one InstancedMesh a key's part, cast and flat apart (o.geo(key) null while the asset loads:
    // make() again when it has); the rows of the cells switched on are written in place (no Matrix4) when that set changes
    let frozen = false;
    function instTable(D) {
      const R = D.rows, KN = D.keys.length, SL = new Array(KN * 2).fill(null), cnt = new Int32Array(KN * 2);
      if (!R.hide) R.hide = new Uint8Array(R.n);
      for (let i = 0; i < R.n; i++) cnt[R.key[i] * 2 + R.cast[i]]++;
      function make() {
        let made = 0;
        if (!R.n || !D.geo) return 0;
        for (let k = 0; k < KN; k++) {
          if ((SL[k * 2] || !cnt[k * 2]) && (SL[k * 2 + 1] || !cnt[k * 2 + 1])) continue;
          let G = D.geo(D.keys[k]); if (!G) continue;
          if (!Array.isArray(G)) G = [G];
          for (let cs = 0; cs < 2; cs++) {
            const slot = k * 2 + cs; if (!cnt[slot] || SL[slot]) continue;
            const parts = G.map((g, i) => {
              const im = new THREE.InstancedMesh(D.perMesh ? D.perMesh(g.geometry, cnt[slot]) : g.geometry, g.material, cnt[slot]);
              im.name = 'town:' + D.name + ':' + D.keys[k] + (cs ? ':cast' : '') + (i ? '#' + i : ''); im.count = 0; im.visible = false; im.castShadow = !!cs; im.receiveShadow = true; im.frustumCulled = false;
              im.userData.batch = true; im.userData.sharedGeo = true; im.matrixAutoUpdate = false;
              group.add(im); if (frozen) { im.updateMatrixWorld(true); im.matrixWorldAutoUpdate = false; }   // (a frozen town: posed by hand)
              return im;
            });
            SL[slot] = { parts, cap: cnt[slot], n: 0, rows: new Int32Array(cnt[slot]) }; made++;   // (rows: which row each instance is - the gate's, the census')
          }
        }
        return made;
      }
      // the rows of the ring's cells whose `on` is set; answers [cells on, rows written]
      const res = new Int32Array(2);
      function write(on) {
        let pc = 0, pn = 0;
        for (let k = 0; k < SL.length; k++) if (SL[k]) SL[k].n = 0;
        const RLst = RG.list, rn = RG.n, S3 = !!R.sx, SK = !!R.k, H = R.hide;
        for (let q = 0; q < rn; q++) {
          const ci = RLst[q]; if (!on[ci]) continue;
          pc++;
          const rg = D.range(ci), p0 = rg[0], n = rg[1];
          for (let i = p0; i < p0 + n; i++) {
            if (H[i]) continue;
            const P = SL[R.key[i] * 2 + R.cast[i]]; if (!P) continue;
            const a = P.parts[0].instanceMatrix.array, j = P.n * 16, cy = Math.cos(R.yaw[i]), sy = Math.sin(R.yaw[i]);
            const kx = S3 ? R.sx[i] : 1, ky = S3 ? R.sy[i] : 1, kz = S3 ? R.sz[i] : 1;
            // rotY(yaw) x [[kx, 0, 0], [k, ky, 0], [0, 0, kz]]: the x column carries the shear (y rises with the piece's x)
            a[j] = cy * kx; a[j + 1] = SK ? R.k[i] : 0; a[j + 2] = -sy * kx; a[j + 3] = 0; a[j + 4] = 0; a[j + 5] = ky; a[j + 6] = 0; a[j + 7] = 0;
            a[j + 8] = sy * kz; a[j + 9] = 0; a[j + 10] = cy * kz; a[j + 11] = 0; a[j + 12] = R.x[i]; a[j + 13] = R.y[i]; a[j + 14] = R.z[i]; a[j + 15] = 1;
            if (D.extra) D.extra(P, i);   // (the worn ground: its own per-instance channels)
            P.rows[P.n] = i; P.n++;
          }
        }
        for (let k = 0; k < SL.length; k++) {
          const P = SL[k]; if (!P) continue;
          for (let q = 0; q < P.parts.length; q++) {
            const im = P.parts[q];
            if (q && P.n) im.instanceMatrix.array.set(P.parts[0].instanceMatrix.array.subarray(0, P.n * 16));
            if (im.count !== P.n || P.n) { im.count = P.n; im.visible = P.n > 0; im.instanceMatrix.needsUpdate = true; if (D.extraDirty) D.extraDirty(im); }
          }
          pn += P.n;
        }
        res[0] = pc; res[1] = pn;
        return res;
      }
      function each(fn) { for (const P of SL) if (P) for (const im of P.parts) fn(im); }
      return { slots: SL, make, write, each, count: cnt, rowsHide: () => R.hide };
    }
    // ---- the near props: within lod.propFar of a cell's box, cast by the cook's flag 2
    const PR = city.props;
    const propCast = new Uint8Array(PR.n); for (let i = 0; i < PR.n; i++) propCast[i] = (PR.flags[i] & 2) ? 1 : 0;
    // the rows the pack does not draw (G3424): a landmark's props (kind 4) and a unique plot's (flag 2) - the unique path builds
    // them with their owner; an edited plot's (setPlotHidden) - it builds unique too
    const plotFlag = (ci, k) => { const q = cells[ci].plots[k]; return q ? q[4] : 0; };
    const propHide = new Uint8Array(PR.n);
    cells.forEach((c, ci) => { for (let i = c.props[0]; i < c.props[0] + c.props[1]; i++) if (PR.kind[i] === 4 || (PR.kind[i] !== 3 && (plotFlag(ci, PR.owner[i]) & 2))) propHide[i] = 1; });
    const PT = instTable({ name: 'prop', rows: { n: PR.n, x: PR.x, y: PR.y, z: PR.z, yaw: PR.yaw, sx: null, key: PR.key, cast: propCast, hide: propHide }, keys: city.keys, range: ci => cells[ci].props, geo: o.propGeo });
    const PROPS = PT.slots;
    PT.make();
    // ---- THE NEAR LOTS (G3424-G3426, v2 §9): within lod.lotFar of a cell's box, near only; three tables over the lot rows -
    //   MESH pieces (post, bay, gate, gatepost): the lot kit's piece by role (0 post, 1 deck: o.lotMats, the fence finish),
    //     scaled length / piece.len along x and SHEARED (y += x / piece.len x the rise from corner 0 to corner 1); flag 1 casts;
    //   OLD fences (flag 4): the prop `propKeys[piece.prop]` scaled length / piece.len along x, on the ground under its middle;
    //   GROUND pieces (flag 2): the worn ground (o.lotGround(tex): the page's material), a unit grid draped on the row's four
    //     corners + 4 cm in the vertex shader (editLotGround), its alpha faded over piece.fade from each edge, broken by noise
    //     on the row's seed; no shadow.
    // No lawn, no lot square: the cook writes none (the user, 20 Oct).
    const LR = city.lots, KITL = city.lotKit, LK = KITL ? KITL.pieces : [];
    const LOT_IN = L.lotFar, LOT_OUT = L.lotFar * 1.1;
    const lnear = new Uint8Array(NCELL);
    let lotDirty = false;
    const lotHide = new Uint8Array(LR.n), isMesh = new Uint8Array(LR.n), isOld = new Uint8Array(LR.n), isGround = new Uint8Array(LR.n);
    const lotY = new Float32Array(LR.n), lotSx = new Float32Array(LR.n), lotK = new Float32Array(LR.n), ones = new Float32Array(LR.n).fill(1), lotCast = new Uint8Array(LR.n);
    const oldKey = new Uint16Array(LR.n);
    cells.forEach((c, ci) => { for (let i = c.lots[0]; i < c.lots[0] + c.lots[1]; i++) {
      const P = LK[LR.piece[i]], f = LR.flags[i], g0 = LR.g[i * 4], g1 = LR.g[i * 4 + 1], pl = P && P.len > 0 ? P.len : 1;
      if (plotFlag(ci, LR.owner[i]) & 2) lotHide[i] = 1;
      if (!P) { lotHide[i] = 1; continue; }
      lotCast[i] = f & 1 ? 1 : 0;
      if (f & 2) isGround[i] = 1;
      else if (f & 4) { isOld[i] = 1; oldKey[i] = P.prop || 0; lotSx[i] = LR.len[i] / pl; lotY[i] = LR.y[i] + 0.25 * (g0 + g1 + LR.g[i * 4 + 2] + LR.g[i * 4 + 3]); }
      else { isMesh[i] = 1; lotSx[i] = LR.len[i] > 0 ? LR.len[i] / pl : 1; lotK[i] = (g1 - g0) / pl; lotY[i] = LR.y[i] + g0; }
    } });
    // the three tables share the lot rows; each hides the others' (a row is one kind)
    const hideBut = flag => { const h = new Uint8Array(LR.n); for (let i = 0; i < LR.n; i++) h[i] = lotHide[i] || !flag[i] ? 1 : 0; return h; };
    const lotRange = ci => cells[ci].lots;
    const pieceKeys = LK.map(P => P.name || String(P.id));
    const PIECE_GEO = new Map();
    const pieceGeo = name => {
      const P = LK[pieceKeys.indexOf(name)]; if (!P || !P.parts.length || !o.lotMats) return null;
      let G = PIECE_GEO.get(name);
      if (!G) { G = P.parts.map(q => { const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(q.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(q.nrm, 4, true));
          g.setAttribute('uv', new THREE.BufferAttribute(q.uv, 2)); g.setAttribute('aHouseAO', new THREE.BufferAttribute(q.ao, 1));
          g.setIndex(new THREE.BufferAttribute(q.idx, 1)); g.computeBoundingSphere();
          return { geometry: g, material: o.lotMats[q.role] || o.lotMats[0] }; });
        PIECE_GEO.set(name, G); }
      return G;
    };
    const LT_MESH = instTable({ name: 'lot', rows: { n: LR.n, x: LR.x, y: lotY, z: LR.z, yaw: LR.yaw, sx: lotSx, sy: ones, sz: ones, k: lotK, key: LR.piece, cast: lotCast, hide: hideBut(isMesh) },
                                keys: pieceKeys, range: lotRange, geo: pieceGeo });
    const LT_OLD = instTable({ name: 'lot:old', rows: { n: LR.n, x: LR.x, y: lotY, z: LR.z, yaw: LR.yaw, sx: lotSx, sy: ones, sz: ones, key: oldKey, cast: lotCast, hide: hideBut(isOld) },
                               keys: city.keys, range: lotRange, geo: o.propGeo });
    // the worn ground: one InstancedMesh a texture set; each mesh its own unit grid (its per-instance channels ride the geometry)
    const texKeys = [...new Set(LK.filter(P => P.kind === 'ground').map(P => P.tex || 'dirt'))].sort();
    const groundKey = new Uint16Array(LR.n); for (let i = 0; i < LR.n; i++) if (isGround[i]) groundKey[i] = Math.max(0, texKeys.indexOf(LK[LR.piece[i]].tex || 'dirt'));
    const zeroCast = new Uint8Array(LR.n);
    const GRID = (() => { const N = 4, pos = [], nrm = [], idx = [];   // x in [0, 1] (along), z in [-0.5, 0.5] (across)
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { pos.push(i / N, 0, j / N - 0.5); nrm.push(0, 1, 0); }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2); }
      return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) }; })();
    const groundGeo = k => { if (!o.lotGround) return null; const mt = o.lotGround(k); if (!mt) return null;
      if (!mt.userData.lotGround) { const pb = mt.onBeforeCompile; mt.onBeforeCompile = function (sh, r) { if (pb) pb.call(this, sh, r); editLotGround(sh); sh.uniforms.uLotTile.value = mt.userData.lotTile || 2; }; mt.userData.lotGround = 1;
        const ck = mt.customProgramCacheKey ? mt.customProgramCacheKey.bind(mt) : () => ''; mt.customProgramCacheKey = () => ck() + '|lotGround'; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(GRID.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(GRID.nrm, 3));
      g.setIndex(new THREE.BufferAttribute(GRID.idx, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      return [{ geometry: g, material: mt }]; };
    const LT_GROUND = instTable({ name: 'lot:ground', rows: { n: LR.n, x: LR.x, y: LR.y, z: LR.z, yaw: LR.yaw, sx: null, key: groundKey, cast: zeroCast, hide: hideBut(isGround) },
      keys: texKeys, range: lotRange, geo: groundGeo,
      // a mesh its own geometry (the instanced channels are the geometry's): aLotC the four corners, aLotS (length, width, seed, fade)
      perMesh: (g, n) => { const q = g.clone(); q.setAttribute('aLotC', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)); q.setAttribute('aLotS', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)); return q; },
      extra: (P, i) => { const g = P.parts[0].geometry, C = g.attributes.aLotC.array, Sx = g.attributes.aLotS.array, j = P.n * 4, Pc = LK[LR.piece[i]];
        C[j] = LR.g[i * 4]; C[j + 1] = LR.g[i * 4 + 1]; C[j + 2] = LR.g[i * 4 + 2]; C[j + 3] = LR.g[i * 4 + 3];
        Sx[j] = LR.len[i]; Sx[j + 1] = LR.wid[i]; Sx[j + 2] = LR.seed[i]; Sx[j + 3] = Pc && Pc.fade > 0 ? Pc.fade : 0.6; },
      extraDirty: im => { im.geometry.attributes.aLotC.needsUpdate = true; im.geometry.attributes.aLotS.needsUpdate = true; } });
    const LOT_TABLES = [LT_MESH, LT_OLD, LT_GROUND];
    for (const T of LOT_TABLES) T.make();
    // ---- the cell ring: a cell at its box's centre, its reach the farthest switch (nearOut, propFar, castFar) + its half-diagonal
    // THE SWITCH (G3423, the user 20 Oct: "at 1 km, a dial; 2 km the fallback"; v2 §3: lod.far, in at far - 50, out at far + 50):
    // o.far (m) puts it there; without it the cook's own (lod.nearIn / nearOut: 950 / 1 050). T.setSwitch(m) moves it live.
    let NEAR_IN = o.far > 0 ? o.far - 50 : L.nearIn, NEAR_OUT = o.far > 0 ? o.far + 50 : L.nearOut;
    const PROP_IN = L.propFar, PROP_OUT = L.propFar * 1.1;
    const near = new Uint8Array(NCELL), pnear = new Uint8Array(NCELL), BX = new Float64Array(NCELL * 4);
    const ids = new Int32Array(Math.max(1, NH));   // the near cells' rows, contiguous (rebuilt when the near set changes)
    let nIds = 0, nearDirty = false, propDirty = false, castOn = false;
    function setFar(ci) {
      near[ci] = 0; ST.switches++;
      const m = FAR[ci]; if (m) m.visible = true;
      const c = cells[ci], r0 = c.rows[0], rn = c.rows[1];
      for (let h = r0; h < r0 + rn; h++) K.farOne(h);
      nearDirty = true;
      if (o.onCell) o.onCell(ci, false);
    }
    function setNear(ci) {
      near[ci] = 1; ST.switches++;
      const m = FAR[ci]; if (m) m.visible = false;
      nearDirty = true;
      if (o.onCell) o.onCell(ci, true);
    }
    const RL = ringLib(); if (!RL) throw new Error('townkit.town: no TOWN_RING (town_ring.js)');
    const RG = RL.make({ cell: 256, move: o.move, onLeave: ci => { if (near[ci]) setFar(ci); if (pnear[ci]) { pnear[ci] = 0; propDirty = true; } if (lnear[ci]) { lnear[ci] = 0; lotDirty = true; } } });
    const ringAdd = () => cells.forEach((c, ci) => {
      const b = c.box; BX[ci * 4] = b[0]; BX[ci * 4 + 1] = b[1]; BX[ci * 4 + 2] = b[2]; BX[ci * 4 + 3] = b[3];
      RG.add(ci, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(NEAR_OUT, PROP_OUT, L.castFar * 1.1) + 0.5 * Math.hypot(b[2] - b[0], b[3] - b[1]) + 1);
    });
    ringAdd();
    // the dial: the switch at m (the cells re-reached; each cell re-decides at the next tick)
    function setSwitch(m) { if (!(m > 100)) return; NEAR_IN = m - 50; NEAR_OUT = m + 50; ringAdd(); RG.reMax(); }
    const boxD = (ci, x, z) => { const q = ci * 4, dx = Math.max(BX[q] - x, 0, x - BX[q + 2]), dz = Math.max(BX[q + 1] - z, 0, z - BX[q + 3]); return Math.sqrt(dx * dx + dz * dz); };
    // the near set changed: the rows' list
    function nearRebuild() {
      nearDirty = false; nIds = 0; let nc = 0;
      const RLst = RG.list, rn = RG.n;
      for (let q = 0; q < rn; q++) {
        const ci = RLst[q]; if (!near[ci]) continue;
        nc++;
        const c = cells[ci], r0 = c.rows[0], n = c.rows[1];
        for (let h = r0; h < r0 + n; h++) ids[nIds++] = h;
      }
      ST.near = nc; ST.nearHouses = nIds;
    }
    // the lots' cells changed: their rows into the three tables
    function lotRebuild() {
      lotDirty = false; let n = 0, c = 0;
      for (let t = 0; t < LOT_TABLES.length; t++) { const r = LOT_TABLES[t].write(lnear); c = r[0]; n += r[1]; }
      ST.lotCells = c; ST.lotsNear = n; ST.visits += n;
    }
    // the props' cells changed: their rows into the instances
    function propRebuild() {
      propDirty = false;
      const r = PT.write(pnear);
      ST.propCells = r[0]; ST.propsNear = r[1]; ST.visits += r[1];
    }
    // THE TICK: the cell ring, each ring cell's two switches (the kit, the props), the near rows on their rungs, the shadow's switch
    function tick(eye) {
      const ts = now();
      ST.visits = 0; ST.cellVisits = 0;
      RG.updateEye(eye);
      const RLst = RG.list, rn = RG.n, ex = eye.x, ez = eye.z, cf = L.castFar * (castOn ? 1.1 : 0.9);
      let cast = false;
      for (let q = 0; q < rn; q++) {
        // the box distance inline, by Math.sqrt (a double handed to a call V8 does not inline - Math.hypot is one - is boxed:
        // three heap numbers a cell a frame)
        const ci = RLst[q], b = ci * 4, dx = Math.max(BX[b] - ex, 0, ex - BX[b + 2]), dz = Math.max(BX[b + 1] - ez, 0, ez - BX[b + 3]), d = Math.sqrt(dx * dx + dz * dz);
        ST.cellVisits++;
        if (near[ci]) { if (d > NEAR_OUT) setFar(ci); }
        else if (d < NEAR_IN) setNear(ci);
        if (pnear[ci]) { if (d > PROP_OUT) { pnear[ci] = 0; propDirty = true; } }
        else if (d < PROP_IN) { pnear[ci] = 1; propDirty = true; }
        if (lnear[ci]) { if (d > LOT_OUT) { lnear[ci] = 0; lotDirty = true; } }
        else if (d < LOT_IN) { lnear[ci] = 1; lotDirty = true; }
        if (near[ci] && d < cf) cast = true;
      }
      if (nearDirty) nearRebuild();
      if (propDirty) propRebuild();
      if (lotDirty) lotRebuild();
      if (nIds) { K.tickSome(eye, ids, 0, nIds); ST.visits += K.stats.visits; }
      // shadows near only: the kit's batches cast while a near cell is within castFar (the depth pass culls each caster past it)
      if (cast !== castOn) castSet(cast);
      ST.tickMs = now() - ts; ST.tickSum += ST.tickMs; ST.ticks++;
    }
    // (out of tick: a closure in tick over its locals would make tick allocate its context on every call)
    function castSet(v) { castOn = v; ST.castOn = v; K.group.traverse(m => { if (m.isMesh) m.castShadow = v; }); }
    // the far cells' and the props' matrices composed once the group stands in the scene, then off the walk (a frozen
    // parent never re-walks a child added after it froze: what is added later is posed by hand)
    function freeze() {
      group.updateMatrixWorld(true);
      for (const m of FAR) if (m) m.matrixWorldAutoUpdate = false;
      PT.each(im => { im.matrixWorldAutoUpdate = false; });
      for (const T of LOT_TABLES) T.each(im => { im.matrixWorldAutoUpdate = false; });
      frozen = true;
    }
    // every Object3D the town puts in the scene graph (the walk's and the cull's count)
    function census() { let n = 0; group.traverse(() => { n++; }); ST.census = n; return n; }
    // a prop's asset landed: its meshes made, the near cells' rows into them at the next tick
    function propsAgain() { if (PT.make()) propDirty = true; if (LT_OLD.make() + LT_GROUND.make() + LT_MESH.make()) lotDirty = true; }
    // AN EDITED PLOT (its seed is not the pack's: it builds unique - one build path): its kit rows, its props and lot rows go,
    // and its far cell draws its shell AROUND it (the owners' ranges, v2 §5.1: up to 2 more draws while the edit stands)
    const plotHidden = new Set();
    function setPlotHidden(ci, k, v) {
      const key = ci * 65536 + k; if (v === plotHidden.has(key)) return;
      if (v) plotHidden.add(key); else plotHidden.delete(key);
      const c = cells[ci], q = c.plots[k]; if (!q) return;
      for (const r of [q[2], q[3]]) if (r >= 0) K.setHidden(c.rows[0] + r, v);
      for (let i = c.props[0]; i < c.props[0] + c.props[1]; i++) if (PR.kind[i] !== 3 && PR.kind[i] !== 4 && PR.owner[i] === k) PR_HIDE[i] = v || (plotFlag(ci, k) & 2) ? 1 : 0;
      for (let i = c.lots[0]; i < c.lots[0] + c.lots[1]; i++) if (LR.owner[i] === k) { lotHide[i] = v || (plotFlag(ci, k) & 2) ? 1 : 0;
        LT_MESH_H[i] = lotHide[i] || !isMesh[i] ? 1 : 0; LT_OLD_H[i] = lotHide[i] || !isOld[i] ? 1 : 0; LT_GROUND_H[i] = lotHide[i] || !isGround[i] ? 1 : 0; }
      shellGroups(ci);
      propDirty = true; lotDirty = true; nearDirty = true;
    }
    const PR_HIDE = propHide, LT_MESH_H = LT_MESH.rowsHide(), LT_OLD_H = LT_OLD.rowsHide(), LT_GROUND_H = LT_GROUND.rowsHide();
    // the shell's groups for a cell: its walls and roofs, less its hidden plots' ranges
    function shellGroups(ci) {
      const m = FAR[ci]; if (!m) return;
      const c = cells[ci], own = c.far.owners || [];
      const cut = []; for (const w of own) if (w[0] === 0 && plotHidden.has(ci * 65536 + w[1])) cut.push([w[3], w[3] + w[4]]);
      cut.sort((a, b) => a[0] - b[0]);
      const out = [];
      for (const g of GF[ci]) { let s0 = g.start; const e0 = g.start + g.count;
        for (const [a, b] of cut) { if (b <= s0 || a >= e0) continue; if (a > s0) out.push({ start: s0, count: a - s0, materialIndex: 0 }); s0 = Math.max(s0, b); }
        if (e0 > s0) out.push({ start: s0, count: e0 - s0, materialIndex: 0 }); }
      m.geometry.groups = out;
    }
    // start: every cell far (its far mesh drawn; the kit's rows hidden until a cell comes near)
    for (let h = 0; h < NH; h++) K.farOne(h);
    K.group.traverse(m => { if (m.isMesh) m.castShadow = false; });
    census();
    ST.buildMs = Math.round(now() - t0);
    function dispose() {
      K.dispose();
      for (const m of FAR) if (m) m.geometry.dispose();
      PT.each(im => im.dispose());
      for (const T of LOT_TABLES) T.each(im => im.dispose());
      for (const G of PIECE_GEO.values()) for (const q of G) q.geometry.dispose();
      if (group.parent) group.parent.remove(group);
    }
    return { group, tick, freeze, census, dispose, propsAgain, setPlotHidden, stats: ST, kit: K, ring: RG, cells, rows, far: FAR, props: PROPS, lod: L,
             lots: { mesh: LT_MESH, old: LT_OLD, ground: LT_GROUND, near: ci => !!lnear[ci], lotIn: LOT_IN, lotOut: LOT_OUT, isMesh, isOld, isGround, hide: lotHide, texKeys }, propHide,
             cellNear: ci => !!near[ci], propNear: ci => !!pnear[ci], nearIds: () => ids.subarray(0, nIds), propIn: PROP_IN, propOut: PROP_OUT, boxDist: boxD,
             farGroups: ci => GF[ci], setSwitch, get nearIn() { return NEAR_IN; }, get nearOut() { return NEAR_OUT; },
             get visible() { return group.visible; }, set visible(v) { group.visible = !!v; } };
  }

  const api = { decodePack, decodeInstances, decodeLod, mirrorOf, octDec, editKit, editDepth, host, dials, VDECL, VMAIN, FINISH_KEYS, decodeCityCell, decodeLotKit, cityOf, town, readRow, editLotGround, CITY_MAGIC, CITY_V, LOTKIT_MAGIC };
  if (typeof window !== 'undefined') window.TOWNKIT = api;
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TOWNKIT;
