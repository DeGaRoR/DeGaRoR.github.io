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
    for (let o = at, i = 0; o + stride <= b.length; o += stride, i++) {
      const ai = dv.getUint8(o + 14);
      rows.push({ i, x: dv.getFloat32(o, true), z: dv.getFloat32(o + 4, true), y: dv.getFloat32(o + 8, true), yaw: dv.getUint16(o + 12, true) / 65536 * 2 * Math.PI,
        arch: ai & 127, mirror: !!(ai & 128), finish: dv.getUint8(o + 15), wallCol: dv.getUint8(o + 16), trimCol: dv.getUint8(o + 17), roofCol: dv.getUint8(o + 18),
        weather: dv.getUint8(o + 19) / 255, dirt: dv.getUint8(o + 20) / 255, lights: dv.getUint8(o + 21) / 255, scale: 1 + dv.getInt8(o + 22) / 500,
        flags: dv.getUint8(o + 23), ground: [0, 1, 2, 3].map(k => dv.getInt16(o + 24 + k * 2, true) / 100),
        plot: head.plots && head.plots[i] ? head.plots[i][0] : null, out: !!(head.plots && head.plots[i] && head.plots[i][1]),
        seed: head.plots && head.plots[i] && head.plots[i][2] !== undefined ? head.plots[i][2] : null });   // (C3c: the plot's seed)
    }
    return { head, rows };
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
  const VDROP = '\n  if (kitSlot < -0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);';
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
  // the shadow pass: the same stretch, the band from the EYE (not the light), no caster past castFar
  function editDepth(sh, miss) {
    let v = sh.vertexShader;
    v = rep(v, '#include <common>', '#include <common>\n' + VDECL + 'uniform vec3 uKitEye;\nuniform float uKitCast;\nvarying float vKitD;\n', miss);
    v = rep(v, '#include <begin_vertex>', '#include <begin_vertex>\n' + VMAIN, miss);
    v = rep(v, '#include <project_vertex>', '#include <project_vertex>\n' +
      '  { vKitD = distance((modelMatrix * KIT_M * vec4(transformed, 1.0)).xyz, uKitEye);\n' +
      '    vec3 kO = (modelMatrix * KIT_M * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\n' +
      '    if (kitSlot < -0.5 || distance(kO, uKitEye) > uKitCast) gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }', miss);
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
    const P = o.pack, H0 = P.header, BAGS = H0.bags, HG = o.HG, T = o.tarr, rows = o.rows;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ST = { houses: rows.length, looks: 0, geos: 0, verts: 0, tris: [0, 0, 0], mb: 0, tickMs: 0, tickSum: 0, ticks: 0, cullMs: 0, culls: 0, changes: 0, draws: 0, missing: [], slotless: 0, buildMs: 0, mode: o.mode };
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
    const hidden = new Uint8Array(N);
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
    const bandOn = () => U.uKitBandOn.value > 0.5;
    let frame = 0;
    function tick(eye) {
      const ts = performance.now();
      if (waiting && tries < MAXTRY && ++frame % RETRY === 0) relook();
      U.uKitEye.value.copy(eye);
      const { E0, W0, E1, W1 } = o.band, on = bandOn();
      let changed = 0;
      for (let h = 0; h < N; h++) {
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
        if (p !== rung[h] || pq !== partner[h]) {
          if (o.mode === 'batch') { if (p !== rung[h]) batchSet(h, 0, p); if (pq !== partner[h]) batchSet(h, 1, pq); } else instDirty = true;
          rung[h] = p; partner[h] = pq; changed++;
        }
      }
      if (o.mode === 'inst' && instDirty) instFlush();
      ST.changes += changed;
      ST.tickMs = performance.now() - ts; ST.tickSum += ST.tickMs; ST.ticks++;
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
      group, tick, relook, dispose, U, stats: ST, rows, mats, depth, rungs, drawsNow, hitMesh,
      setHidden(h, v) { hidden[h] = v ? 1 : 0; }, isHidden: h => !!hidden[h],   // (C3c)
      get waiting() { return waiting; },
      get band() { return o.band; },
      setBand(b) { Object.assign(o.band, b || {}); U.uKitBand.value.set(o.band.E0, o.band.W0, o.band.E1, o.band.W1); U.uKitBandOn.value = o.band.W0 > 0 ? 1 : 0; rung.fill(-1); partner.fill(-1); },
      get visible() { return group.visible; }, set visible(v) { group.visible = !!v; },
      centre: h => C[h], radius: h => RAD[h], matrix: h => M[h], look: h => houseLook[h], lookCount: () => looks.length,
      // (GATE KITHOST's eyes)
      dataOf: h => DATA.subarray(h * 8, h * 8 + 8), rungOf: h => [rung[h], partner[h]], roleTable: () => ROLES, usedRoles: () => USED,
      geoId: (kind, h, lod) => { const E = B[kind]; if (!E || lod < 0) return undefined; return E.ids.get(keyOf(rows[h]) * 3 + lod); },
    };
  }

  const api = { decodePack, decodeInstances, decodeLod, mirrorOf, octDec, editKit, editDepth, host, dials, VDECL, VMAIN, FINISH_KEYS };
  if (typeof window !== 'undefined') window.TOWNKIT = api;
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TOWNKIT;
