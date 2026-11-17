// ============================================================================
// rock_ring.js - ROCK-STUDY: THE ISLAND'S ROCK AS GEOMETRY round the eye (the bench v1's 1.25 m relief, the user's look)
//
// 62.5 m CHUNKS within `reach` of the eye's ground point, each built ONCE in a WORKER (rock_ring_core.js: the macro, the
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
//             isla (the island: grid, ttype, ndvi), flow { g Uint8Array N*N, N, x0, z0, dx } | null,
//             kit ([{ h, bb, pos, nor, idx }] - the 'rocks' collection's subjects: the boulders) | null, K (knobs) }
//     ring.update()        once a frame, after the camera
//     ring.get() / set(o)  the dials: on, reach, chunk, step, lift, amp, unit, sink, perFrame
//     ring.stat()          chunks live / queued, vertices, triangles, worker ms (sum, last), main ms (sum)
//     ring.whenIdle()      a promise: every chunk in reach built (the bench's stills)
//     ring.dispose()
// ============================================================================
'use strict';
var ROCK_RING = (() => {
  // (chunk and margin are WHOLE multiples of the 1.25 m step and the 2.5 m input lattice: 64 m left every chunk's last column
  // 0.25 m short of its neighbour's first - a crack - and phased each chunk's inputs differently)
  const DEF = { on: 1, farOn: 1, farReach: 2000, reach: 450, chunk: 62.5, step: 1.25, M: 37.5, hs: 2.5, lift: 0.6, amp: 1.5, unit: 12, sink: 0.35, perFrame: 2, fadeBand: 90, macro: 1 };
  const workerSrc = () => {
    const core = (typeof ROCK_RING_CORE_SRC !== 'undefined') ? ROCK_RING_CORE_SRC : null;
    return core + '\nlet KIT = ROCK_RING_CORE.kitPrep(null);\nonmessage = e => { if (e.data.kit) { KIT = ROCK_RING_CORE.kitPrep(e.data.kit); return; } if (e.data.mt) { const m = ROCK_RING_CORE.macroTile(e.data); postMessage({ id: e.data.id, m }, [m.A.buffer, m.B.buffer]); return; } const r = ROCK_RING_CORE.chunk(e.data, KIT); postMessage({ id: e.data.id, r }, [r.pos.buffer, r.disp.buffer, r.nor.buffer, r.idx.buffer, r.attr.buffer]); };';
  };
  // ---- the material: the bench v1's rock (sTrond) on the outcrops - the slab hex-tiled with each tap's frame turned to the
  // fall line about its own vertex, the face plain on the side planes, blended by slope 42-58 deg; the 'cliff' photograph's
  // micro detail (biplanar, out by 180 m); the macro colour, the green and the crevices from the vertex attributes
  function material(THREE, U, L) {
    const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });   // (the cover lies 0.15 m proud of the ground: it wins the depth test)
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uSplat: U.uSplat, uSplatN: U.uSplatN, uSGrade: U.uSGrade, uSLum: U.uSLum, uSFilt: U.uSFilt,
        uRL: L.uRL, uRK: L.uRK, uRFade: L.uRFade, uRB: L.uRB, uRMean: L.uRMean, uRT: L.uRT, uTrW: U.uTrW, uTrS: U.uTrS });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aR0, aR1; attribute vec3 aDisp; uniform vec4 uRFade;\nvarying vec4 vR0, vR1; varying vec3 vRW; varying vec3 vRN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
          '  { vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz; float f = 1.0 - smoothstep(uRFade.y - uRFade.z, uRFade.y, distance(wp.xz, uRFade.xw));\n' +
          '    transformed += aDisp * f - vec3(0.0, uRFade.x * (1.0 - f), 0.0); }\n' +
          '  vR0 = aR0; vR1 = aR1; vRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL)
        .replace('#include <map_fragment>', '#include <map_fragment>\n  Smp rk = rRock(vRW, normalize(vRN)); diffuseColor.rgb = rk.c.rgb; gRN = rk.n.xyz; gRR = rk.n.w;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = gRB > 0.5 ? normalize((viewMatrix * vec4(gRN, 0.0)).xyz) : normalize(normal + (viewMatrix * vec4(gRN, 0.0)).xyz);')
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
vec3 gRN = vec3(0.0); float gRR = 0.9; float gRB = 0.0;   // (gRB 1: a boulder - gRN is then its whole world normal)
uniform vec4 uRB;   // the boulders: the cliff photo's scale (m), its raw mean luminance, the slab's mean luminance; the micro's mean luminance
uniform vec3 uRMean;   // the slab's raw mean colour (linear): the boulders' tone
uniform vec4 uRT;   // the boulders: tone (x), contrast (v1 2)
uniform vec4 uTrW, uTrS;   // the splat's blend with the grass: the film (hue, amount), the value match (uTrS.w) - the ground's rock and the boulders alike
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
// a hex-tiled read (the splat's sTile): three rotated, offset taps on a triangle lattice, height-blended - no repeat
Smp rHex(float L, vec2 st){
  vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (st * 2.0);
  vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
  vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
  vec2 v1 = base + vec2(s, s), v2 = base + vec2(s, 1.0 - s), v3 = base + vec2(1.0 - s, s);
  Smp a, b, c;
  { vec2 r = rH2(v1); float an = r.x * 6.2832; mat2 R = mat2(cos(an), sin(an), -sin(an), cos(an)); a = rFetch(L, R * (st - rVst(v1)) + r * 7.3); }
  { vec2 r = rH2(v2); float an = r.x * 6.2832; mat2 R = mat2(cos(an), sin(an), -sin(an), cos(an)); b = rFetch(L, R * (st - rVst(v2)) + r * 7.3); }
  { vec2 r = rH2(v3); float an = r.x * 6.2832; mat2 R = mat2(cos(an), sin(an), -sin(an), cos(an)); c = rFetch(L, R * (st - rVst(v3)) + r * 7.3); }
  vec3 h = rHw3(a.c.a, w.x, b.c.a, w.y, c.c.a, w.z, 0.2);
  Smp o; o.c = a.c * h.x + b.c * h.y + c.c * h.z; o.n = a.n * h.x + b.n * h.y + c.n * h.z; return o; }
// a slab tap: its frame turned to the fall line (+-15 deg per vertex), about the vertex; the normal back in world x / z
Smp rSlabTap(vec2 st, vec2 V, vec2 dn){
  vec2 r = rH2(V); float a = (r.y - 0.5) * 0.52; float ca = cos(a), sa = sin(a);
  vec2 dv = vec2(ca * dn.x - sa * dn.y, sa * dn.x + ca * dn.y), du = vec2(dv.y, -dv.x);
  vec2 q = st - rVst(V);
  Smp o = rFetch(uRL.x, vec2(dot(q, du), dot(q, dv)) + r * 7.3);
  vec2 t = o.n.xy * 2.0 - 1.0; vec2 g = t.x * du + t.y * dv; o.n = vec4(g.x, 0.0, g.y, o.n.a); return o; }
// THE BOULDER (the bench v1's rockMat): the game's 'cliff' photograph TRIPLANAR on the rock's world planes (blended by the
// normal^4), its normal map on each plane's own axes (the whiteout swizzle, x1.6); its colour re-toned to the trondhjemite's
// (the photo's luminance over its mean x the slab's mean colour x the rock's own tone); the crease darker; MOSS on what looks
// up, filling the low texels first; the foot darker into the ground. vR0 = tone, foot; vR1 = crease, hash, 2, 0
Smp rBoulder(vec3 P, vec3 N){
  vec3 w = pow(abs(N), vec3(4.0)); w /= w.x + w.y + w.z;
  vec3 p = P / uRB.x;
  vec4 cx = vec4(0.0), cy = vec4(0.0), cz = vec4(0.0), nx = vec4(0.5, 0.5, 1.0, 1.0), ny = nx, nz = nx;
  if (w.x > 0.02) { cx = texture(uSplat, vec3(p.zy, uRL.z), uSFilt.x); nx = texture(uSplatN, vec3(p.zy, uRL.z), uSFilt.x); }
  if (w.y > 0.02) { cy = texture(uSplat, vec3(p.xz + 0.37, uRL.z), uSFilt.x); ny = texture(uSplatN, vec3(p.xz + 0.37, uRL.z), uSFilt.x); }
  if (w.z > 0.02) { cz = texture(uSplat, vec3(p.xy + 0.71, uRL.z), uSFilt.x); nz = texture(uSplatN, vec3(p.xy + 0.71, uRL.z), uSFilt.x); }
  vec4 col = cx * w.x + cy * w.y + cz * w.z; col.rgb *= col.rgb;
  vec3 tX = nx.xyz * 2.0 - 1.0, tY = ny.xyz * 2.0 - 1.0, tZ = nz.xyz * 2.0 - 1.0; tX.xy *= 1.6; tY.xy *= 1.6; tZ.xy *= 1.6;
  vec3 nX = vec3(tX.xy + N.zy, abs(tX.z) * N.x).zyx, nY = vec3(tY.xy + N.xz, abs(tY.z) * N.y).xzy, nZ = vec3(tZ.xy + N.xy, abs(tZ.z) * N.z);
  Smp o; o.n.xyz = normalize(nX * w.x + nY * w.y + nZ * w.z);
  float gr = nx.a * w.x + ny.a * w.y + nz.a * w.z;
  // (v1: the photo through the game's own 'cliff' grade - luminance only, contrast x2 about its mean - then x the trondhjemite's mean / the
  // graded mean x 0.9: the gain cancels in the ratio)
  float rl = rLuma(col.rgb) / max(uRB.y, 1e-3);
  // (the tone: the slab's mean through the slab's own grade - gain and saturation, the rail's editor - x the rail's boulder tone;
  // the contrast v1's x2 by default, the rail's 'boulder contrast')
  vec4 sg = uSGrade[int(uRL.x + 0.5)]; vec3 tone = uRMean * sg.rgb; tone = mix(vec3(rLuma(tone)), tone, sg.a);
  o.c.rgb = tone * max(1.0 + (rl - 1.0) * uRT.y, 0.05) * vR0.rgb * 0.9 * uRT.x;
  o.c.rgb *= mix(vec3(1.0), uTrW.rgb, uTrW.a) * uTrS.w;   // (the blend with the grass: as the ground's rock)
  float h = col.a;
  o.c.rgb *= mix(1.0, 0.75, clamp(vR1.x * 2.5, 0.0, 1.0));   // the crease
  float up = smoothstep(0.62, 0.92, N.y);
  if (up > 0.01) { vec3 g = texture(uSplat, vec3(P.xz / 7.0 + 0.13, uRL.w), uSFilt.x).rgb; g *= g; g *= uSGrade[int(uRL.w + 0.5)].rgb;   // (the game's own grass)
   
    float mk = clamp((up * 0.95 - h) * 3.0, 0.0, 1.0) * 0.85; o.c.rgb = mix(o.c.rgb, g, mk); gr = mix(gr, 1.0, mk); }
  o.c.rgb *= mix(0.8, 1.0, smoothstep(0.0, 0.22, vR0.w));   // the foot
  o.n.w = clamp(mix(0.42, 0.7, gr) + 0.3 * smoothstep(0.85, 0.95, gr), 0.3, 1.0);
  o.c.a = h; return o;
}
Smp rRock(vec3 P, vec3 nG){
  if (vR1.z > 1.5) { gRB = 1.0; return rBoulder(P, nG); }
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
  // THE PBR MICRO DETAIL (the bench v1's): the game's 'cliff' photograph at its natural 6.86 m, HEX-tiled and TRIPLANAR on the
  // smooth normal (weights ^8) - its LUMINANCE over its mean modulates our colour and its NORMAL is added to ours (x1.8); out by
  // 60-180 m. A plane is read only where it weighs
  float kd = (1.0 - smoothstep(60.0, 180.0, d)) * uRK.w;
  if (kd > 0.01) {
    vec2 a8 = pow(vec2(length(nG.xz), abs(nG.y)), vec2(8.0)); vec2 h2 = nG.xz * nG.xz; h2 *= h2;
    float f8 = h2.y / max(h2.x + h2.y, 1e-8); vec3 tw = vec3(a8.x * (1.0 - f8), a8.y, a8.x * f8) / max(a8.x + a8.y, 1e-6);
    Smp t; t.c = vec4(0.0); t.n = vec4(0.0);
    if (tw.y > 0.01) { Smp q = rHex(uRL.z, P.xz / 6.86); vec2 n2 = q.n.xy * 2.0 - 1.0; t.c += q.c * tw.y; t.n.xyz += vec3(n2.x, 0.0, n2.y) * tw.y; }
    if (tw.x > 0.01) { Smp q = rHex(uRL.z, P.zy / 6.86); vec2 n2 = q.n.xy * 2.0 - 1.0; t.c += q.c * tw.x; t.n.xyz += vec3(0.0, n2.y, n2.x) * tw.x; }
    if (tw.z > 0.01) { Smp q = rHex(uRL.z, P.xy / 6.86); vec2 n2 = q.n.xy * 2.0 - 1.0; t.c += q.c * tw.z; t.n.xyz += vec3(n2.x, n2.y, 0.0) * tw.z; }
    float rel = clamp(rLuma(t.c.rgb) / max(uRB.w, 1e-3), 0.35, 2.2);
    o.c.rgb *= mix(1.0, rel, 0.65 * kd);
    o.n.xyz += t.n.xyz * 3.0 * 0.6 * kd;
    o.c.a = mix(o.c.a, o.c.a * 0.75 + t.c.a * 0.25, kd);
  }
  // the macro's height into the blend's height (v1: the green fills the macro's low places first)
  o.c.a = clamp(o.c.a * 0.6 + vR1.z * 0.6 - 0.1, 0.0, 1.0);
  // the macro (vertex): its colour; the hollows and veins hold the green
  float hm = o.c.a;
  o.c.rgb *= vR0.rgb;
  float n1 = rVn(P.xz / 7.0 + 3.1), n2 = rVn(P.xz / 1.7 - 9.4);
  float crackM = max(1.0 - smoothstep(0.10, 0.32, hm), vR1.x * 0.9);
  o.c.rgb *= mix(1.0, 0.55, vR1.x) * (0.9 + 0.2 * vR1.y);   // the masses' crevices darker, each mass its own tone
  float up = smoothstep(0.80, 0.96, nG.y) * (0.35 + 0.65 * n1);
  float G = clamp(vR0.w * 1.15 + crackM * 0.6 + up * 0.55, 0.0, 1.0) * (0.55 + 0.6 * n2);   // (the bench v1's)
  G = max(G, vR1.w);   // (the seam, under the ground: the green it emerges from)
  float gw = clamp((G * 1.35 - hm) * 3.0, 0.0, 1.0);
  float rough = o.n.w;
  if (gw > 0.003) {
    vec3 gr = texture(uSplat, vec3(P.xz / 5.0, uRL.w), uSFilt.x).rgb; gr *= gr; gr *= uSGrade[int(uRL.w + 0.5)].rgb;   // (the game's own grass, graded as the game grades it)
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
    const L = { uRB: { value: new THREE.Vector4(3.43, 0.2, 0.25, 0) }, uRMean: { value: new THREE.Vector3(0.3, 0.27, 0.22) }, uRL: { value: new THREE.Vector4(-1, -1, -1, -1) }, uRK: { value: new THREE.Vector4(16, 24, 1, 1) }, uRFade: { value: new THREE.Vector4(0.6, S.reach, S.fadeBand, 0) }, uRT: { value: new THREE.Vector4(1, 2, 0, 0) } };
    const mat = material(THREE, U, L);
    const group = new THREE.Group(); group.name = 'rock-ring'; ctx.scene.add(group);
    const chunks = new Map(), queue = [], inflight = new Map();
    const ST = { built: 0, workerMs: 0, workerLast: 0, mainMs: 0, verts: 0, tris: 0 };
    let worker = null, seq = 0, cx0 = NaN, cz0 = NaN, KIT0 = null;
    try { if (typeof Worker !== 'undefined' && typeof ROCK_RING_CORE_SRC !== 'undefined') worker = new Worker(URL.createObjectURL(new Blob([workerSrc()], { type: 'text/javascript' }))); } catch (e) { worker = null; }
    const I = ctx.isla, IG = I && I.grid;
    const share = (x, z, code) => {   // the map's share of a type at (x, z): the 10 m type, bilinear on 'is it' (6 rock, 5 scree, 8 / 13 forest)
      if (!IG || !I.ttype) return 0; const fx = (x - IG.x0) / IG.cell - 0.5, fz = (z - IG.z0) / IG.cell - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const at = (a, b) => { if (a < 0 || b < 0 || a >= IG.w || b >= IG.h) return 0; return (I.ttype[b * IG.w + a] & 127) === code ? 1 : 0; };
      return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v; };
    const ndvi = (x, z) => { if (!IG || !I.ndvi) return 0.5; const i = Math.max(0, Math.min(IG.w - 1, Math.floor((x - IG.x0) / IG.cell))), j = Math.max(0, Math.min(IG.h - 1, Math.floor((z - IG.z0) / IG.cell)));
      return I.ndvi[j * IG.w + i] / 255 * 2 - 1; };
    const flow = (x, z) => { const F = typeof ctx.flow === 'function' ? ctx.flow() : ctx.flow; if (!F) return 0.3; const fx = (x - F.x0) / F.dx - 0.5, fz = (z - F.z0) / F.dx - 0.5, i = Math.max(0, Math.min(F.N - 2, Math.floor(fx))), j = Math.max(0, Math.min(F.N - 2, Math.floor(fz))), u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j)), k = j * F.N + i;
      return ((F.g[k] * (1 - u) + F.g[k + 1] * u) * (1 - v) + (F.g[k + F.N] * (1 - u) + F.g[k + F.N + 1] * u) * v) / 255; };
    // the LOD band of a chunk at d m: [rung of its boulders, small blocks on] - a chunk rebuilds when the eye moves it across one
    const band = d => d < 200 ? 0 : (d < 250 ? 1 : 2);
    const inputs = (x0, z0, d) => {
      const C = S.chunk, M = S.M, hs = S.hs, nh = Math.round((C + 2 * M) / hs) + 1, n = nh * nh;
      const H = new Float32Array(n), R = new Float32Array(n), V = new Float32Array(n), Fl = new Float32Array(n), Sc = new Float32Array(n), Fo = new Float32Array(n); let any = 0;
      for (let j = 0; j < nh; j++) for (let i = 0; i < nh; i++) { const x = x0 - M + i * hs, z = z0 - M + j * hs, k = j * nh + i;
        H[k] = ctx.terrainH(x, z); R[k] = share(x, z, 6); V[k] = ndvi(x, z); Fl[k] = flow(x, z); Sc[k] = share(x, z, 5); Fo[k] = Math.max(share(x, z, 8), share(x, z, 13)); if (R[k] > 0) any = 1; }
      const b = band(d), cam = ctx.camera.position;
      return any ? { x0, z0, C, M, hs, nh, H, R, V, F: Fl, Sc, Fo, rung: b === 0 ? 0 : 1, eye: [cam.x, cam.z], reach: S.reach, step: S.step, K: { lift: S.lift, amp: S.amp, unit: S.unit, sink: S.sink, ndvi: S.ndvi, ndviMid: S.ndviMid, off: S.off, hLo: S.hLo, hHi: S.hHi, jointDirt: S.jointDirt, wet: S.wet, scatter: S.scatter, boulders: S.boulders, proud: S.proud } } : null;
    };
    // a chunk's two meshes: the RELIEF wears the GROUND'S OWN material (ctx.groundMat - the near ring's: every type's PBR sets,
    // height-blended, the rock among them; the bench v1's skirt wore the ground's), its macro in aRM / aRX, its offset in aRD (the
    // ground's vertex stage folds it back toward the reach); the BOULDERS wear the bench v1's rock material (this file's)
    const unmesh = c => { for (const k of ['mesh', 'bmesh']) if (c[k]) { group.remove(c[k]); ST.verts -= c[k].geometry.attributes.position.count; ST.tris -= c[k].geometry.index.count / 3; c[k].geometry.dispose(); c[k] = null; }
      ST.boulderTris -= c.boulders || 0; c.boulders = 0; };
    const place = (key, r) => {
      const c = chunks.get(key); if (!c) return;
      const t0 = performance.now();
      unmesh(c);   // (a rebuild across a LOD band)
      if (r.nv) {
        const g = new THREE.BufferGeometry(), nv = r.nv;
        g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
        g.setIndex(new THREE.BufferAttribute(r.idx, 1));
        const rd = new THREE.BufferAttribute(r.disp, 3), a0 = new Float32Array(nv * 4), a1 = new Float32Array(nv * 4);
        for (let v = 0; v < nv; v++) for (let k = 0; k < 4; k++) { a0[v * 4 + k] = r.attr[v * 8 + k]; a1[v * 4 + k] = r.attr[v * 8 + 4 + k]; }
        const A0 = new THREE.BufferAttribute(a0, 4), A1 = new THREE.BufferAttribute(a1, 4);
        g.setAttribute('aRD', rd); g.setAttribute('aRM', A0); g.setAttribute('aRX', A1);
        g.setAttribute('aDisp', rd); g.setAttribute('aR0', A0); g.setAttribute('aR1', A1);   // (the same buffers, for this file's material when there is no ground's)
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, ctx.groundMat || mat); m.castShadow = m.receiveShadow = true; group.add(m); c.mesh = m; ST.verts += nv; ST.tris += r.nt; }
      if (r.B) {
        const B = r.B, g = new THREE.BufferGeometry(), nb = B.nv;
        g.setAttribute('position', new THREE.BufferAttribute(B.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(B.nor, 3));
        g.setIndex(new THREE.BufferAttribute(B.idx, 1)); g.setAttribute('aDisp', new THREE.BufferAttribute(new Float32Array(nb * 3), 3));
        const a0 = new Float32Array(nb * 4), a1 = new Float32Array(nb * 4);
        for (let v = 0; v < nb; v++) for (let k = 0; k < 4; k++) { a0[v * 4 + k] = B.attr[v * 8 + k]; a1[v * 4 + k] = B.attr[v * 8 + 4 + k]; }
        g.setAttribute('aR0', new THREE.BufferAttribute(a0, 4)); g.setAttribute('aR1', new THREE.BufferAttribute(a1, 4));
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; group.add(m); c.bmesh = m;
        ST.verts += nb; ST.tris += B.idx.length / 3; c.boulders = B.idx.length / 3; ST.boulderTris = (ST.boulderTris || 0) + c.boulders; }
      if (!r.nv && !r.B) c.empty = true;
      ST.built++; ST.workerMs += r.ms; ST.workerLast = r.ms; ST.mainMs += performance.now() - t0;
    };
    const build = (key, x0, z0) => {
      const c0 = chunks.get(key), cam = ctx.camera.position, d = Math.hypot(x0 + S.chunk / 2 - cam.x, z0 + S.chunk / 2 - cam.z); c0.band = band(d);
      const t0 = performance.now(), inp = inputs(x0, z0, d); ST.mainMs += performance.now() - t0;
      if (!inp) { chunks.get(key).empty = true; return; }
      if (worker) { inp.id = ++seq; inflight.set(inp.id, key); worker.postMessage(inp, [inp.H.buffer, inp.R.buffer, inp.V.buffer, inp.F.buffer]); }
      else place(key, ROCK_RING_CORE.chunk(inp, KIT0 || (KIT0 = ROCK_RING_CORE.kitPrep(ctx.kit || null))));
    };
    if (worker && ctx.kit) worker.postMessage({ kit: ctx.kit });
    if (worker) worker.onmessage = e => { const key = inflight.get(e.data.id); inflight.delete(e.data.id); if (!key) return;
      if (key.startsWith('f:')) { if (farChunks.has(key.slice(2))) farPlace(key.slice(2), e.data.r); } else if (chunks.has(key)) place(key, e.data.r); };
    const drop = key => { const c = chunks.get(key); if (c) unmesh(c); chunks.delete(key); };
    // the splat's rock* knobs that are the ring's (the world rail's rows, persisted and exported with the splat's): read each frame,
    // a change of a geometry knob rebuilds the chunks
    const KMAP = { rockRing: 'on', rockRingReach: 'reach', rockLift: 'lift', rockAmp: 'amp', rockProud: 'proud', rockBoulders: 'boulders', rockScatter: 'scatter', rockMacro: 'macro' };
    const sync = () => {   // the layers and knobs from the splat (its arrays may grow)
      { const K0 = SP.api.knobsLive ? SP.api.knobsLive() : SP.api.knobs(), o = {};
        for (const k in KMAP) { if (K0[k] === undefined) continue; let v = +K0[k]; if (k === 'rockRingReach' && S.reachCap) v = Math.min(v, S.reachCap); if (v !== S[KMAP[k]]) o[KMAP[k]] = v; }   // (a tier's cap holds the reach)
        if (Object.keys(o).length) ring.set(o); }
      const li = LIB(), ix = k => li.indexOf(k);
      const T4 = SP.api.trond ? SP.api.trond() : ['trondSlab', 'trondFace', 'cliff', 'grassRock'];   // (the rail's picks: code 6's row)
      L.uRL.value.set(ix(T4[0]), ix(T4[1]), ix(T4[2]), ix(T4[3]));
      { const set = k => (typeof SPLAT_TEX_SETS !== 'undefined' && SPLAT_TEX_SETS.find(x => x.key === k)) || {}, mc = set(T4[2]).mean || [0.2, 0.2, 0.2], ms = set(T4[0]).mean || [0.3, 0.27, 0.22];
        const lc = 0.2126 * mc[0] + 0.7152 * mc[1] + 0.0722 * mc[2]; L.uRB.value.set(6.86 * 0.5, lc, 0.2126 * ms[0] + 0.7152 * ms[1] + 0.0722 * ms[2], lc); L.uRMean.value.set(ms[0], ms[1], ms[2]); }
      const K = SP.api.knobsLive ? SP.api.knobsLive() : SP.api.knobs();
      L.uRT.value.set(K.rockBoulderTone === undefined ? 1 : +K.rockBoulderTone, K.rockBoulderCon === undefined ? 2 : +K.rockBoulderCon, 0, 0);
      L.uRK.value.set(S.slabM || 16, S.faceM || 24, S.bright === undefined ? 1 : S.bright, S.micro === undefined ? 1 : S.micro);
      return K && K.rocks && L.uRL.value.x >= 0 && L.uRL.value.y >= 0;
    };
    // THE FAR LAYER (the bench v1's big blocks to 2 km): 500 m chunks from the reach out, boulders only, seated on the DEM; a far
    // chunk rebuilds once the eye has moved 200 m from where it was built (its near / far split is the eye's distance then)
    const FAR = { C: 500, M: 40, hs: 10, step: 5 }, farChunks = new Map(), farQueue = [];
    const farInputs = (x0, z0) => {
      const C = FAR.C, M = FAR.M, hs = FAR.hs, nh = Math.round((C + 2 * M) / hs) + 1, n = nh * nh, cam = ctx.camera.position;
      const H = new Float32Array(n), R = new Float32Array(n), V = new Float32Array(n), Fl = new Float32Array(n), Sc = new Float32Array(n), Fo = new Float32Array(n); let any = 0;
      for (let j = 0; j < nh; j++) for (let i = 0; i < nh; i++) { const x = x0 - M + i * hs, z = z0 - M + j * hs, k = j * nh + i;
        H[k] = ctx.terrainH(x, z); R[k] = share(x, z, 6); V[k] = ndvi(x, z); Fl[k] = flow(x, z); Sc[k] = share(x, z, 5); Fo[k] = Math.max(share(x, z, 8), share(x, z, 13)); if (R[k] > 0 || Sc[k] > 0) any = 1; }
      return any ? { far: true, x0, z0, C, M, hs, nh, H, R, V, F: Fl, Sc, Fo, step: FAR.step, eye: [cam.x, cam.z], reach: S.reach, farReach: S.farReach || 2000,
        K: { off: S.off, hLo: S.hLo, hHi: S.hHi, scatter: S.scatter, ndvi: S.ndvi, ndviMid: S.ndviMid } } : null; };
    const farBuild = (key, x0, z0) => { const c = farChunks.get(key), cam = ctx.camera.position; c.eye = [cam.x, cam.z];
      const t0 = performance.now(), inp = farInputs(x0, z0); ST.mainMs += performance.now() - t0;
      if (!inp) { c.empty = true; return; }
      if (worker) { inp.id = ++seq; inflight.set(inp.id, 'f:' + key); worker.postMessage(inp, [inp.H.buffer, inp.R.buffer, inp.V.buffer, inp.F.buffer]); }
      else farPlace(key, ROCK_RING_CORE.chunk(inp, KIT0 || (KIT0 = ROCK_RING_CORE.kitPrep(ctx.kit || null)))); };
    const farPlace = (key, r) => { const c = farChunks.get(key); if (!c) return; const t0 = performance.now();
      unmesh(c);
      if (r.B) { const B = r.B, g = new THREE.BufferGeometry(), nb = B.nv;
        g.setAttribute('position', new THREE.BufferAttribute(B.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(B.nor, 3));
        g.setIndex(new THREE.BufferAttribute(B.idx, 1)); g.setAttribute('aDisp', new THREE.BufferAttribute(new Float32Array(nb * 3), 3));
        const a0 = new Float32Array(nb * 4), a1 = new Float32Array(nb * 4);
        for (let v = 0; v < nb; v++) for (let k = 0; k < 4; k++) { a0[v * 4 + k] = B.attr[v * 8 + k]; a1[v * 4 + k] = B.attr[v * 8 + 4 + k]; }
        g.setAttribute('aR0', new THREE.BufferAttribute(a0, 4)); g.setAttribute('aR1', new THREE.BufferAttribute(a1, 4)); g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; group.add(m); c.bmesh = m;
        ST.verts += nb; ST.tris += B.idx.length / 3; c.boulders = B.idx.length / 3; ST.boulderTris = (ST.boulderTris || 0) + c.boulders; ST.farBoulderTris = (ST.farBoulderTris || 0) + c.boulders; }
      else c.empty = true;
      ST.workerMs += r.ms; ST.mainMs += performance.now() - t0; };
    const farUpdate = cam => {
      const C = FAR.C, R = Math.ceil((S.farReach || 2000) / C) + 1, ccx = Math.floor(cam.x / C), ccz = Math.floor(cam.z / C), want = new Set();
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const x0 = (ccx + i) * C, z0 = (ccz + j) * C;
        const dmin = Math.hypot(Math.max(0, Math.abs(x0 + C / 2 - cam.x) - C / 2), Math.max(0, Math.abs(z0 + C / 2 - cam.z) - C / 2)), dmax = Math.hypot(Math.abs(x0 + C / 2 - cam.x) + C / 2, Math.abs(z0 + C / 2 - cam.z) + C / 2);
        if (dmin > (S.farReach || 2000) || dmax < S.reach) continue;
        if (ctx.bounds && (x0 < ctx.bounds[0] || z0 < ctx.bounds[1] || x0 + C > ctx.bounds[2] || z0 + C > ctx.bounds[3])) continue;   // (a bench's patch: no ground beyond it)
        const key = (ccx + i) + ',' + (ccz + j); want.add(key);
        const c = farChunks.get(key);
        if (!c) { farChunks.set(key, { x0, z0 }); farQueue.push([dmin, key, x0, z0]); }
        else if (c.eye && Math.hypot(c.eye[0] - cam.x, c.eye[1] - cam.z) > 200 && !farQueue.some(q => q[1] === key)) farQueue.push([dmin, key, x0, z0]); }
      for (const key of [...farChunks.keys()]) if (!want.has(key)) { const c = farChunks.get(key); unmesh(c); farChunks.delete(key); }
      farQueue.sort((a, b) => a[0] - b[0]); };
    // ---- THE MACRO TEXTURE (the bench v1's macro_mult / macro_rock / macro_nh, which the ground read a pixel at a time): three
    // levels round the eye - 1 m to +-512 m, 2 m to +-1 km, 4 m to +-2 km - each 1024^2 in two layers (A: mult rgb / 1.5, expo;
    // B: normal x z, veg, height) of ONE texture array (one sampler on the ground's programs). TOROIDAL: a world tile always
    // lands in the same texels (uv = xz / the level's extent, repeat), so a move of the eye recomputes only the tiles that enter;
    // the shader reads a level inside its VALID square (uTrMR: the tiles done round its centre), the finest first, faded at the
    // edges. Tiles in a worker of their own (the ring's chunks keep theirs), nearest first.
    const MTN = 1024, MTT = 8, MTL = [{ st: 1, hs: 2.5, M: 25 }, { st: 2, hs: 5, M: 30 }, { st: 4, hs: 10, M: 40 }];
    MTL.forEach(l => { l.T = MTN / MTT * l.st; l.ext = MTN * l.st; l.res = new Map(); l.c = null; });
    const MT = { on: !!(U.uTrMT && U.uTrMR && U.uTrMX), tex: null, data: null, queue: [], inflight: new Map(), dirty: new Set(), lastUp: 0, built: 0, ms: 0, kSig: '' };
    let mworker = null;
    if (MT.on) {
      MT.data = new Uint8Array(MTN * MTN * 4 * 6);
      MT.tex = new THREE.DataArrayTexture(MT.data, MTN, MTN, 6); MT.tex.format = THREE.RGBAFormat; MT.tex.type = THREE.UnsignedByteType;
      MT.tex.wrapS = MT.tex.wrapT = THREE.RepeatWrapping; MT.tex.minFilter = THREE.LinearMipmapLinearFilter; MT.tex.magFilter = THREE.LinearFilter;
      MT.tex.generateMipmaps = true; MT.tex.anisotropy = 4; MT.tex.needsUpdate = true;
      U.uTrMT.value = MT.tex;
      try { if (worker) mworker = new Worker(URL.createObjectURL(new Blob([workerSrc()], { type: 'text/javascript' }))); } catch (e) { mworker = null; }
    }
    const mtKey = () => [S.ndvi, S.ndviMid, S.off, S.hLo, S.hHi, S.jointDirt, S.wet].join(',');
    const mtInputs = (L, tx, tz) => {
      const l = MTL[L], C = l.T, M = l.M, hs = l.hs, x0 = tx * C, z0 = tz * C, nh = Math.round((C + 2 * M) / hs) + 1, n = nh * nh;
      const H = new Float32Array(n), R = new Float32Array(n), V = new Float32Array(n), Fl = new Float32Array(n);
      for (let j = 0; j < nh; j++) for (let i = 0; i < nh; i++) { const x = x0 - M + i * hs, z = z0 - M + j * hs, k = j * nh + i;
        H[k] = ctx.terrainH(x, z); R[k] = share(x, z, 6); V[k] = ndvi(x, z); Fl[k] = flow(x, z); }
      return { mt: 1, x0, z0, C, st: l.st, M, hs, nh, H, R, V, F: Fl, K: { ndvi: S.ndvi, ndviMid: S.ndviMid, off: S.off, hLo: S.hLo, hHi: S.hHi, jointDirt: S.jointDirt, wet: S.wet } };
    };
    const mtPut = (L, tx, tz, m) => {   // a tile's texels into its slot of the level's two layers
      const l = MTL[L], T = m.T, ox = (((tx % MTT) + MTT) % MTT) * T, oz = (((tz % MTT) + MTT) % MTT) * T;
      for (const [src, layer] of [[m.A, 2 * L], [m.B, 2 * L + 1]]) { const base = layer * MTN * MTN * 4;
        for (let b = 0; b < T; b++) MT.data.set(src.subarray(b * T * 4, (b + 1) * T * 4), base + ((oz + b) * MTN + ox) * 4);
        MT.dirty.add(layer); }
      l.res.set(tx + ',' + tz, 1); MT.built++; MT.ms += m.ms;
    };
    const mtRect = L => {   // the valid square: the largest k with every tile of [c - k, c + k - 1]^2 done
      const l = MTL[L]; if (!l.c) return [0, 0, 0, 0];
      let k = 0; for (let q = 1; q <= MTT / 2; q++) { let ok = true;
        for (let j = -q; j < q && ok; j++) for (let i = -q; i < q && ok; i++) if (!l.res.has((l.c[0] + i) + ',' + (l.c[1] + j))) ok = false;
        if (ok) k = q; else break; }
      return k ? [(l.c[0] - k) * l.T, (l.c[1] - k) * l.T, (l.c[0] + k) * l.T, (l.c[1] + k) * l.T] : [0, 0, 0, 0];
    };
    const mtUpdate = cam => {
      if (!MT.on) return;
      const on = S.macro !== 0;
      U.uTrMX.value.set(MTL[0].ext, MTL[1].ext, MTL[2].ext, on ? 1 : 0); if (!on) return;
      const sig = mtKey(); if (sig !== MT.kSig) { MT.kSig = sig; MTL.forEach(l => { l.res.clear(); l.c = null; }); MT.queue.length = 0; MT.inflight.clear(); }
      MTL.forEach((l, L) => {
        const c = [Math.round(cam.x / l.T), Math.round(cam.z / l.T)];
        if (!l.c || c[0] !== l.c[0] || c[1] !== l.c[1]) { l.c = c;
          for (const key of [...l.res.keys()]) { const [a, b] = key.split(',').map(Number); if (a < c[0] - MTT / 2 || a >= c[0] + MTT / 2 || b < c[1] - MTT / 2 || b >= c[1] + MTT / 2) l.res.delete(key); }
          MT.queue = MT.queue.filter(q => q[1] !== L || (q[2] >= c[0] - MTT / 2 && q[2] < c[0] + MTT / 2 && q[3] >= c[1] - MTT / 2 && q[3] < c[1] + MTT / 2));
          for (let j = -MTT / 2; j < MTT / 2; j++) for (let i = -MTT / 2; i < MTT / 2; i++) { const tx = c[0] + i, tz = c[1] + j, key = tx + ',' + tz;
            if (l.res.has(key) || MT.queue.some(q => q[1] === L && q[2] === tx && q[3] === tz) || [...MT.inflight.values()].some(q => q[0] === L && q[1] === tx && q[2] === tz)) continue;
            const dmin = Math.hypot(Math.max(0, Math.abs((tx + 0.5) * l.T - cam.x) - l.T / 2), Math.max(0, Math.abs((tz + 0.5) * l.T - cam.z) - l.T / 2));
            MT.queue.push([dmin * (1 + 0.15 * L), L, tx, tz]); }
          MT.queue.sort((a, b) => a[0] - b[0]); }
      });
      // a tile a frame to the worker (two in flight); the main thread's part is the inputs (~4-6 k samples)
      while (MT.queue.length && MT.inflight.size < 2) { const [, L, tx, tz] = MT.queue.shift();
        const t0 = performance.now(), inp = mtInputs(L, tx, tz); ST.mainMs += performance.now() - t0;
        if (mworker) { inp.id = ++seq; MT.inflight.set(inp.id, [L, tx, tz, MT.kSig]); mworker.postMessage(inp, [inp.H.buffer, inp.R.buffer, inp.V.buffer, inp.F.buffer]); }
        else { mtPut(L, tx, tz, ROCK_RING_CORE.macroTile(inp)); break; } }
      // the upload: the touched layers, at most every 250 ms (the mips are regenerated with them)
      const now = performance.now();
      if (MT.dirty.size && (now - MT.lastUp > 250 || (!MT.queue.length && !MT.inflight.size))) { MT.lastUp = now;
        for (const layer of MT.dirty) MT.tex.addLayerUpdate(layer); MT.dirty.clear(); MT.tex.needsUpdate = true;
        MTL.forEach((l, L) => { const r = mtRect(L); U.uTrMR.value[L].set(r[0], r[1], r[2], r[3]); }); }
    };
    if (mworker) mworker.onmessage = e => { const q = MT.inflight.get(e.data.id); MT.inflight.delete(e.data.id); if (!q || q[3] !== MT.kSig) return;
      const l = MTL[q[0]]; if (!l.c || Math.abs(q[1] - l.c[0] + 0.5) > MTT / 2 || Math.abs(q[2] - l.c[1] + 0.5) > MTT / 2) return;   // (the window moved on)
      mtPut(q[0], q[1], q[2], e.data.m); };
    const ring = {
      update() {
        const rk = sync(), on = S.on && rk && SP.api.ready && SP.api.ready(); group.visible = !!on;
        if (rk && SP.api.ready && SP.api.ready()) mtUpdate(ctx.camera.position); else if (MT.on) U.uTrMX.value.w = 0;   // (the macro texture is the material's: on with the rock, whatever the ring)
        if (!on) return;
        const cam = ctx.camera.position; L.uRFade.value.set(S.sink + 0.2, S.reach, S.fadeBand, cam.z);   // (sink, reach, band, the eye's z; its x: uREyeX)
        if (ctx.groundU && ctx.groundU.uRingF) ctx.groundU.uRingF.value.set(S.sink + 0.2, S.reach, S.fadeBand, 0);   // (the ground's vertex stage folds the relief)
        const C = S.chunk, ccx = Math.floor(cam.x / C), ccz = Math.floor(cam.z / C);
        if (ccx !== cx0 || ccz !== cz0) { cx0 = ccx; cz0 = ccz;
          const R = Math.ceil(S.reach / C) + 1, want = new Set();
          for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const x0 = (ccx + i) * C, z0 = (ccz + j) * C, d = Math.hypot(x0 + C / 2 - cam.x, z0 + C / 2 - cam.z);
            if (d > S.reach + C * 0.75) continue; const key = (ccx + i) + ',' + (ccz + j); want.add(key);
            if (!chunks.has(key)) { chunks.set(key, { x0, z0, d }); queue.push([d, key, x0, z0]); } }
          for (const key of [...chunks.keys()]) if (!want.has(key)) drop(key);
          queue.sort((a, b) => a[0] - b[0]); }
        // a chunk the eye has moved across a LOD band rebuilds (its old mesh stands until the new one lands)
        if (!(ring._t = (ring._t || 0) + 1) || ring._t % 30 === 0) for (const [key, c] of chunks) { if (c.band === undefined || c.empty) continue;
          const d = Math.hypot(c.x0 + C / 2 - cam.x, c.z0 + C / 2 - cam.z); if (band(d) !== c.band && !queue.some(q => q[1] === key)) queue.push([d, key, c.x0, c.z0]); }
        let n = 0; while (queue.length && n < S.perFrame && inflight.size < 4) { const [, key, x0, z0] = queue.shift(); if (chunks.has(key)) { build(key, x0, z0); n++; } }
        if (S.farOn !== 0) { if (!(ring._f = (ring._f || 0) + 1) || ring._f % 20 === 0) farUpdate(cam);
          if (!queue.length && n < S.perFrame && inflight.size < 4 && farQueue.length) { const [, key, x0, z0] = farQueue.shift(); if (farChunks.has(key)) farBuild(key, x0, z0); } }
      },
      get: () => Object.assign({}, S),
      set(o) { const rebuild = ['chunk', 'step', 'lift', 'amp', 'unit', 'sink', 'proud', 'scatter', 'boulders', 'ndvi', 'ndviMid', 'off', 'hLo', 'hHi', 'jointDirt', 'wet', 'M', 'hs'].some(k => k in o && o[k] !== S[k]);
        Object.assign(S, o); if (rebuild) { for (const k of [...chunks.keys()]) drop(k); queue.length = 0; } if (rebuild || 'reach' in o) cx0 = cz0 = NaN; return ring.get(); },
      // the chunks' states by key (cx,cz in chunk units): 'mesh' | 'empty' (no rock: no skin) | 'blank' (built, no vertex) | 'queued' (a check's)
      chunkStates: () => { const o = {}; for (const [k, c] of chunks) o[k] = c.mesh ? 'mesh' : (c.empty ? 'empty' : (c.band !== undefined ? 'blank' : 'queued')); return o; },
      stat: () => ({ chunks: [...chunks.values()].filter(c => c.mesh).length, queued: queue.length, inflight: inflight.size, verts: ST.verts, tris: ST.tris,
        built: ST.built, boulderTris: ST.boulderTris || 0, farChunks: [...farChunks.values()].filter(c => c.bmesh).length, farBoulderTris: ST.farBoulderTris || 0, workerMs: Math.round(ST.workerMs), workerLastMs: ST.workerLast, mainMs: Math.round(ST.mainMs), worker: !!worker,
        macro: MT.on ? { tiles: MT.built, queued: MT.queue.length, inflight: MT.inflight.size, workerMs: Math.round(MT.ms), rects: MTL.map((l, L) => mtRect(L)) } : null }),
      whenIdle: () => new Promise(res => { const tick = () => { ring.update(); if (!queue.length && !inflight.size && !(S.farOn !== 0 && farQueue.length) && !(MT.on && S.macro !== 0 && (MT.queue.length || MT.inflight.size || MT.dirty.size))) res(ring.stat()); else setTimeout(tick, 30); }; tick(); }),
      dispose() { for (const k of [...chunks.keys()]) drop(k); ctx.scene.remove(group); mat.dispose(); if (worker) worker.terminate(); if (mworker) mworker.terminate(); if (MT.tex) { MT.tex.dispose(); U.uTrMX.value.w = 0; } },
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
