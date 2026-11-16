// ============================================================================
// rock_ring.js - ROCK-STUDY: THE ISLAND'S ROCK AS GEOMETRY round the eye (the bench v1's 1.25 m relief, the user's look)
//
// 64 m CHUNKS within `reach` of the eye's ground point, each built ONCE in a WORKER (rock_ring_core.js: the macro, the
// Blender masses, the 1.25 m outcrop mesh) from inputs sampled here on a 2.5 m lattice - the ground's own height
// (world.terrainH, as the cover ring plants on), the map's rock share (the 10 m terrain type), the imagery's NDVI and the
// drainage (D8 on the hydrology's heights: ctx.flow). The outcrops rise OUT of the ground (their seam sinks under it: no
// z-fight with the ground drawn there), cast and take shadows, and wear the v1 rock material (below) with the macro's colour,
// green chance, crevices and each mass's tone in their vertex attributes - their OWN program (the ground programs' link
// is not touched; the tiles are the splat's array layers: no new texture). Toward `reach` the relief folds back under the
// ground (no pop). Nearest chunks first, `perFrame` builds in flight.
//
//   ROCK_RING.make(THREE, ctx) -> ring
//     ctx = { scene, world, camera, splat (SPLAT_GROUND.make's result: its uniforms - arrays, grades, layers), terrainH(x, z),
//             isla (the island: grid, ttype, ndvi), flow { g Uint8Array N*N, N, x0, z0, dx } | null, K (knobs) }
//     ring.update()        once a frame, after the camera
//     ring.get() / set(o)  the dials: on, reach, chunk, step, lift, amp, unit, sink, perFrame
//     ring.stat()          chunks live / queued, vertices, triangles, worker ms (sum, last), main ms (sum)
//     ring.whenIdle()      a promise: every chunk in reach built (the bench's stills)
//     ring.dispose()
// ============================================================================
'use strict';
var ROCK_RING = (() => {
  const DEF = { on: 1, reach: 450, chunk: 64, step: 1.25, M: 24, hs: 2.5, lift: 0.6, amp: 1.5, unit: 12, sink: 0.35, perFrame: 2, fadeBand: 90 };
  const workerSrc = () => {
    const core = (typeof ROCK_RING_CORE_SRC !== 'undefined') ? ROCK_RING_CORE_SRC : null;
    return core + '\nonmessage = e => { const r = ROCK_RING_CORE.chunk(e.data); postMessage({ id: e.data.id, r }, [r.pos.buffer, r.disp.buffer, r.nor.buffer, r.idx.buffer, r.attr.buffer]); };';
  };
  // ---- the material: the bench v1's rock (sTrond) on the outcrops - the slab hex-tiled with each tap's frame turned to the
  // fall line about its own vertex, the face plain on the side planes, blended by slope 42-58 deg; the 'cliff' photograph's
  // micro detail (biplanar, out by 180 m); the macro colour, the green and the crevices from the vertex attributes
  function material(THREE, U, L) {
    const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uSplat: U.uSplat, uSplatN: U.uSplatN, uSGrade: U.uSGrade, uSLum: U.uSLum, uSFilt: U.uSFilt,
        uRL: L.uRL, uRK: L.uRK, uRFade: L.uRFade });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aR0, aR1; attribute vec3 aDisp; uniform vec4 uRFade;\nvarying vec4 vR0, vR1; varying vec3 vRW; varying vec3 vRN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
          '  { vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz; float f = 1.0 - smoothstep(uRFade.y - uRFade.z, uRFade.y, distance(wp.xz, uRFade.xw));\n' +
          '    transformed += aDisp * f - vec3(0.0, uRFade.x * (1.0 - f), 0.0); }\n' +
          '  vR0 = aR0; vR1 = aR1; vRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL)
        .replace('#include <map_fragment>', '#include <map_fragment>\n  Smp rk = rRock(vRW, normalize(vRN)); diffuseColor.rgb = rk.c.rgb; gRN = rk.n.xyz; gRR = rk.n.w;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(normal + (viewMatrix * vec4(gRN, 0.0)).xyz);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = gRR;');
    };
    m.customProgramCacheKey = () => 'rock-ring-v1';
    return m;
  }
  const GLSL = `
uniform highp sampler2DArray uSplat, uSplatN;
uniform vec4 uSGrade[24]; uniform float uSLum[24]; uniform vec4 uSFilt;
uniform vec4 uRL;   // the layers: slab, face, cliff (micro), grassRock (green)
uniform vec4 uRK;   // slab m, face m, brightness, micro on
varying vec4 vR0, vR1; varying vec3 vRW; varying vec3 vRN;
vec3 gRN = vec3(0.0); float gRR = 0.9;
struct Smp { vec4 c; vec4 n; };
float rH1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 rH2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float rVn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rH1(i), rH1(i + vec2(1, 0)), f.x), mix(rH1(i + vec2(0, 1)), rH1(i + vec2(1, 1)), f.x), f.y); }
float rLuma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// a layer read: colour (sRGB decoded, graded) + height, normal (tangent xy) + roughness
Smp rFetch(float L, vec2 uv){
  Smp o; o.c = texture(uSplat, vec3(uv, L), uSFilt.x); o.c.rgb = o.c.rgb * o.c.rgb;   // (the tiles RAW, as the bench v1 drew them: the splat's grade is the far ground's)
  o.n = texture(uSplatN, vec3(uv, L), uSFilt.x); return o; }
vec2 rVst(vec2 v){ return vec2(v.x + 0.5 * v.y, v.y * 0.8660254) * 0.5; }
vec3 rHw3(float a, float wa, float b, float wb, float c, float wc, float k){
  float ma = max(max(a + wa, b + wb), c + wc) - k; vec3 w = vec3(max(a + wa - ma, 0.0), max(b + wb - ma, 0.0), max(c + wc - ma, 0.0));
  return w / max(w.x + w.y + w.z, 1e-5); }
// a slab tap: its frame turned to the fall line (+-15 deg per vertex), about the vertex; the normal back in world x / z
Smp rSlabTap(vec2 st, vec2 V, vec2 dn){
  vec2 r = rH2(V); float a = (r.y - 0.5) * 0.52; float ca = cos(a), sa = sin(a);
  vec2 dv = vec2(ca * dn.x - sa * dn.y, sa * dn.x + ca * dn.y), du = vec2(dv.y, -dv.x);
  vec2 q = st - rVst(V);
  Smp o = rFetch(uRL.x, vec2(dot(q, du), dot(q, dv)) + r * 7.3);
  vec2 t = o.n.xy * 2.0 - 1.0; vec2 g = t.x * du + t.y * dv; o.n = vec4(g.x, 0.0, g.y, o.n.a); return o; }
Smp rRock(vec3 P, vec3 nG){
  float slope = degrees(acos(clamp(nG.y, 0.0, 1.0))), d = distance(P, cameraPosition);
  float fw = smoothstep(42.0, 58.0, slope);
  Smp o; o.c = vec4(0.0); o.n = vec4(0.0); Smp sl = o, fa = o;
  if (fw < 0.999) {
    vec2 dn = length(nG.xz) > 0.02 ? normalize(nG.xz) : vec2(0.0, 1.0);
    vec2 st = P.xz / uRK.x;
    vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (st * 2.0);
    vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
    float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
    vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
    vec2 v1 = base + vec2(s, s), v2 = base + vec2(s, 1.0 - s), v3 = base + vec2(1.0 - s, s);
    Smp a = rSlabTap(st, v1, dn), b = rSlabTap(st, v2, dn), c = rSlabTap(st, v3, dn);
    vec3 h = rHw3(a.c.a, w.x, b.c.a, w.y, c.c.a, w.z, 0.08);
    sl.c = a.c * h.x + b.c * h.y + c.c * h.z; sl.n = a.n * h.x + b.n * h.y + c.n * h.z;
  }
  float fx = nG.x * nG.x, fz = nG.z * nG.z, kx = fx / max(fx + fz, 1e-6);
  if (fw > 0.001) {
    Smp a = o, b = o;
    if (kx > 0.08) { a = rFetch(uRL.y, P.zy / uRK.y + vec2(0.37, 0.0)); vec2 t = a.n.xy * 2.0 - 1.0; a.n = vec4(0.0, t.y, t.x, a.n.a); }
    if (kx < 0.92) { b = rFetch(uRL.y, P.xy / uRK.y); vec2 t = b.n.xy * 2.0 - 1.0; b.n = vec4(t.x, t.y, 0.0, b.n.a); }
    float k = smoothstep(0.3, 0.7, kx); fa.c = mix(b.c, a.c, k); fa.n = mix(b.n, a.n, k);
  }
  if (fw <= 0.001) o = sl; else if (fw >= 0.999) o = fa;
  else { float ma = max(sl.c.a + 1.0 - fw, fa.c.a + fw) - 0.1; vec2 h = vec2(max(sl.c.a + 1.0 - fw - ma, 0.0), max(fa.c.a + fw - ma, 0.0)); h /= max(h.x + h.y, 1e-5);
    o.c = sl.c * h.x + fa.c * h.y; o.n = sl.n * h.x + fa.n * h.y; }
  // the PBR micro detail: the 'cliff' photograph at 6.86 m, its brightness over its mean and its normal - biplanar, out by 180 m
  float kd = (1.0 - smoothstep(60.0, 180.0, d)) * uRK.w;
  if (kd > 0.01) {
    vec2 a2 = pow(vec2(length(nG.xz), abs(nG.y)), vec2(4.0)); float wTop = a2.y / max(a2.x + a2.y, 1e-6);
    // (the two side planes BLENDED across the diagonal - a hard switch drew a seam where the surface faced 45 deg; the second
    // read only inside the band)
    Smp t1 = rFetch(uRL.z, P.xz / 6.86), tx = t1, tz = t1; float kxs = smoothstep(0.35, 0.65, kx);
    if (kxs > 0.001) tx = rFetch(uRL.z, P.zy / 6.86 + 0.53);
    if (kxs < 0.999) tz = rFetch(uRL.z, P.xy / 6.86 + 0.53);
    vec2 n1 = t1.n.xy * 2.0 - 1.0, nx2 = tx.n.xy * 2.0 - 1.0, nz2 = tz.n.xy * 2.0 - 1.0;
    float lS = mix(rLuma(tz.c.rgb), rLuma(tx.c.rgb), kxs);
    float rel = clamp((rLuma(t1.c.rgb) * wTop + lS * (1.0 - wTop)) / max(uSLum[int(uRL.z + 0.5)], 1e-3), 0.35, 2.2);
    o.c.rgb *= mix(1.0, rel, 0.65 * kd);
    vec3 nS = mix(vec3(nz2.x, nz2.y, 0.0), vec3(0.0, nx2.y, nx2.x), kxs);
    o.n.xyz += (vec3(n1.x, 0.0, n1.y) * wTop + nS * (1.0 - wTop)) * 1.8 * kd;
    o.c.a = mix(o.c.a, o.c.a * 0.75 + (t1.c.a * wTop + mix(tz.c.a, tx.c.a, kxs) * (1.0 - wTop)) * 0.25, kd);
  }
  // the macro (vertex): its colour; the hollows and veins hold the green
  float hm = o.c.a;
  o.c.rgb *= vR0.rgb;
  float n1 = rVn(P.xz / 7.0 + 3.1), n2 = rVn(P.xz / 1.7 - 9.4);
  float crackM = max(1.0 - smoothstep(0.10, 0.32, hm), vR1.x * 0.9);
  o.c.rgb *= mix(1.0, 0.55, vR1.x) * (0.9 + 0.2 * vR1.y);   // the masses' crevices darker, each mass its own tone
  float up = smoothstep(0.80, 0.96, nG.y) * (0.35 + 0.65 * n1);
  float G = clamp(vR0.w * 1.15 + crackM * 0.6 + up * 0.55, 0.0, 1.0) * (0.55 + 0.6 * n2);
  G = max(G, vR1.w);   // (the seam, under the ground: the green it emerges from)
  float gw = clamp((G * 1.35 - hm) * 3.0, 0.0, 1.0);
  float rough = o.n.w;
  if (gw > 0.003) {
    vec3 gr = texture(uSplat, vec3(P.xz / 5.0, uRL.w), uSFilt.x).rgb; gr *= gr; gr *= vec3(0.50, 0.60, 0.36);   // (raw, darkened to v1's olive: the game's normalised grassRock reads blue-green)
    vec3 green = mix(vec3(0.045, 0.058, 0.022) * (0.8 + 0.6 * n2), gr, smoothstep(0.3, 0.8, G));
    o.c.rgb = mix(o.c.rgb, green, gw); o.n.xyz *= 1.0 - 0.6 * gw; rough = mix(rough, 0.97, gw);
  }
  o.c.rgb *= uRK.z;
  o.n.w = clamp(mix(rough, 0.9, smoothstep(250.0, 700.0, d)), 0.05, 1.0);
  return o;
}
`;
  function make(THREE, ctx) {
    const S = Object.assign({}, DEF, ctx.K || {});
    try { const q = /[?&]ring=0/.test(location.search); if (q) S.on = 0; } catch (e) {}
    const SP = ctx.splat, U = SP.uniforms, LIB = () => SP.api.layers();
    const L = { uRL: { value: new THREE.Vector4(-1, -1, -1, -1) }, uRK: { value: new THREE.Vector4(16, 24, 1, 1) }, uRFade: { value: new THREE.Vector4(0.6, S.reach, S.fadeBand, 0) } };
    const mat = material(THREE, U, L);
    const group = new THREE.Group(); group.name = 'rock-ring'; ctx.scene.add(group);
    const chunks = new Map(), queue = [], inflight = new Map();
    const ST = { built: 0, workerMs: 0, workerLast: 0, mainMs: 0, verts: 0, tris: 0 };
    let worker = null, seq = 0, cx0 = NaN, cz0 = NaN;
    try { if (typeof Worker !== 'undefined' && typeof ROCK_RING_CORE_SRC !== 'undefined') worker = new Worker(URL.createObjectURL(new Blob([workerSrc()], { type: 'text/javascript' }))); } catch (e) { worker = null; }
    const I = ctx.isla, IG = I && I.grid;
    const share = (x, z) => {   // the map's rock share at (x, z): the 10 m type, bilinear on 'is rock' (6)
      if (!IG || !I.ttype) return 0; const fx = (x - IG.x0) / IG.cell - 0.5, fz = (z - IG.z0) / IG.cell - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const at = (a, b) => { if (a < 0 || b < 0 || a >= IG.w || b >= IG.h) return 0; return (I.ttype[b * IG.w + a] & 127) === 6 ? 1 : 0; };
      return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v; };
    const ndvi = (x, z) => { if (!IG || !I.ndvi) return 0.5; const i = Math.max(0, Math.min(IG.w - 1, Math.floor((x - IG.x0) / IG.cell))), j = Math.max(0, Math.min(IG.h - 1, Math.floor((z - IG.z0) / IG.cell)));
      return I.ndvi[j * IG.w + i] / 255 * 2 - 1; };
    const F = ctx.flow;
    const flow = (x, z) => { if (!F) return 0.3; const fx = (x - F.x0) / F.dx - 0.5, fz = (z - F.z0) / F.dx - 0.5, i = Math.max(0, Math.min(F.N - 2, Math.floor(fx))), j = Math.max(0, Math.min(F.N - 2, Math.floor(fz))), u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j)), k = j * F.N + i;
      return ((F.g[k] * (1 - u) + F.g[k + 1] * u) * (1 - v) + (F.g[k + F.N] * (1 - u) + F.g[k + F.N + 1] * u) * v) / 255; };
    const inputs = (x0, z0) => {
      const C = S.chunk, M = S.M, hs = S.hs, nh = Math.round((C + 2 * M) / hs) + 1, n = nh * nh;
      const H = new Float32Array(n), R = new Float32Array(n), V = new Float32Array(n), Fl = new Float32Array(n); let any = 0;
      for (let j = 0; j < nh; j++) for (let i = 0; i < nh; i++) { const x = x0 - M + i * hs, z = z0 - M + j * hs, k = j * nh + i;
        H[k] = ctx.terrainH(x, z); R[k] = share(x, z); V[k] = ndvi(x, z); Fl[k] = flow(x, z); if (R[k] > 0) any = 1; }
      return any ? { x0, z0, C, M, hs, nh, H, R, V, F: Fl, step: S.step, K: { lift: S.lift, amp: S.amp, unit: S.unit, sink: S.sink, ndvi: S.ndvi, ndviMid: S.ndviMid, off: S.off, hLo: S.hLo, hHi: S.hHi, jointDirt: S.jointDirt, wet: S.wet } } : null;
    };
    const place = (key, r) => {
      const c = chunks.get(key); if (!c || !r.nv) { if (c) c.empty = true; return; }
      const t0 = performance.now(), g = new THREE.BufferGeometry(), nv = r.nv;
      // the ground position (the DEM) in 'position', the relief in aDisp (the fade folds it back); the normals are the RELIEF's,
      // the worker's (central differences across the chunk's edge: no seam)
      g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
      g.setIndex(new THREE.BufferAttribute(r.idx, 1)); g.setAttribute('aDisp', new THREE.BufferAttribute(r.disp, 3));
      const a0 = new Float32Array(nv * 4), a1 = new Float32Array(nv * 4);
      for (let v = 0; v < nv; v++) { for (let k = 0; k < 4; k++) { a0[v * 4 + k] = r.attr[v * 8 + k]; a1[v * 4 + k] = r.attr[v * 8 + 4 + k]; } }
      g.setAttribute('aR0', new THREE.BufferAttribute(a0, 4)); g.setAttribute('aR1', new THREE.BufferAttribute(a1, 4));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = true; group.add(mesh);
      c.mesh = mesh; ST.built++; ST.verts += nv; ST.tris += r.nt; ST.workerMs += r.ms; ST.workerLast = r.ms; ST.mainMs += performance.now() - t0;
    };
    const build = (key, x0, z0) => {
      const t0 = performance.now(), inp = inputs(x0, z0); ST.mainMs += performance.now() - t0;
      if (!inp) { chunks.get(key).empty = true; return; }
      if (worker) { inp.id = ++seq; inflight.set(inp.id, key); worker.postMessage(inp, [inp.H.buffer, inp.R.buffer, inp.V.buffer, inp.F.buffer]); }
      else place(key, ROCK_RING_CORE.chunk(inp));
    };
    if (worker) worker.onmessage = e => { const key = inflight.get(e.data.id); inflight.delete(e.data.id); if (key && chunks.has(key)) place(key, e.data.r); };
    const drop = key => { const c = chunks.get(key); if (c && c.mesh) { group.remove(c.mesh); c.mesh.geometry.dispose(); ST.verts -= c.mesh.geometry.attributes.position.count; ST.tris -= c.mesh.geometry.index.count / 3; } chunks.delete(key); };
    const sync = () => {   // the layers and knobs from the splat (its arrays may grow)
      const li = LIB(), ix = k => li.indexOf(k);
      L.uRL.value.set(ix('trondSlab'), ix('trondFace'), ix('cliff'), ix('grassRock'));
      const K = SP.api.knobsLive ? SP.api.knobsLive() : SP.api.knobs();
      L.uRK.value.set(S.slabM || 24, S.faceM || 40, S.bright === undefined ? 1 : S.bright, S.micro === undefined ? 1 : S.micro);
      return K && K.rocks && L.uRL.value.x >= 0 && L.uRL.value.y >= 0;
    };
    const ring = {
      update() {
        const on = S.on && sync() && SP.api.ready && SP.api.ready(); group.visible = !!on; if (!on) return;
        const cam = ctx.camera.position; L.uRFade.value.set(S.sink + 0.2, S.reach, S.fadeBand, cam.z);   // (sink, reach, band, the eye's z; its x: uREyeX)
        const C = S.chunk, ccx = Math.floor(cam.x / C), ccz = Math.floor(cam.z / C);
        if (ccx !== cx0 || ccz !== cz0) { cx0 = ccx; cz0 = ccz;
          const R = Math.ceil(S.reach / C) + 1, want = new Set();
          for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const x0 = (ccx + i) * C, z0 = (ccz + j) * C, d = Math.hypot(x0 + C / 2 - cam.x, z0 + C / 2 - cam.z);
            if (d > S.reach + C * 0.75) continue; const key = (ccx + i) + ',' + (ccz + j); want.add(key);
            if (!chunks.has(key)) { chunks.set(key, { x0, z0, d }); queue.push([d, key, x0, z0]); } }
          for (const key of [...chunks.keys()]) if (!want.has(key)) drop(key);
          queue.sort((a, b) => a[0] - b[0]); }
        let n = 0; while (queue.length && n < S.perFrame && inflight.size < 4) { const [, key, x0, z0] = queue.shift(); if (chunks.has(key)) { build(key, x0, z0); n++; } }
      },
      get: () => Object.assign({}, S),
      set(o) { const rebuild = ['chunk', 'step', 'lift', 'amp', 'unit', 'sink', 'ndvi', 'ndviMid', 'off', 'hLo', 'hHi', 'jointDirt', 'wet', 'M', 'hs'].some(k => k in o && o[k] !== S[k]);
        Object.assign(S, o); if (rebuild) { for (const k of [...chunks.keys()]) drop(k); queue.length = 0; cx0 = cz0 = NaN; } return ring.get(); },
      stat: () => ({ chunks: [...chunks.values()].filter(c => c.mesh).length, queued: queue.length, inflight: inflight.size, verts: ST.verts, tris: ST.tris,
        built: ST.built, workerMs: Math.round(ST.workerMs), workerLastMs: ST.workerLast, mainMs: Math.round(ST.mainMs), worker: !!worker }),
      whenIdle: () => new Promise(res => { const tick = () => { ring.update(); if (!queue.length && !inflight.size) res(ring.stat()); else setTimeout(tick, 30); }; tick(); }),
      dispose() { for (const k of [...chunks.keys()]) drop(k); ctx.scene.remove(group); mat.dispose(); if (worker) worker.terminate(); },
      material: mat, group,
    };
    // the fade's eye x: a uniform of its own (uRFade carries sink, reach, band, eye z)
    const uEyeX = { value: 0 };
    const ob = mat.onBeforeCompile; mat.onBeforeCompile = sh => { ob(sh); sh.uniforms.uREyeX = uEyeX;
      sh.vertexShader = sh.vertexShader.replace('uniform vec4 uRFade;', 'uniform vec4 uRFade; uniform float uREyeX;').replace('distance(wp.xz, uRFade.xw)', 'distance(wp.xz, vec2(uREyeX, uRFade.w))'); };
    const up0 = ring.update; ring.update = () => { up0(); uEyeX.value = ctx.camera.position.x; };
    return ring;
  }
  return { make, DEF };
})();
if (typeof window !== 'undefined') window.ROCK_RING = ROCK_RING;
