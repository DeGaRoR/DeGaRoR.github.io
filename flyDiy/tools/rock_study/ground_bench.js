// ground_bench.js - ROCK-STUDY R1's check: the game's splat_ground.js, unmodified, on the 2 km round Mount Ardent.
//   tools/rock_study/ground_shot.js drives it (stills of ?rocks=0 and ?rocks=1 from the same eyes, the program's size, ms).
// The data: data/patch.* (the 5 m heights, export_patch.js) and data/gpatch.* + data/gisla.json (export_gpatch.js).
'use strict';
(async () => {
const Q = new URLSearchParams(location.search), W = +(Q.get('w') || 1280), H = +(Q.get('h') || 720);
const get = async (u, kind) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return kind === 'json' ? r.json() : r.arrayBuffer(); };
const [PJ, PB, GJ, GB, IS] = await Promise.all([get('data/patch.json', 'json'), get('data/patch.bin'), get('data/gpatch.json', 'json'), get('data/gpatch.bin'), get('data/gisla.json', 'json')]);
const hL = PJ.layout.find(l => l.name === 'h'), HT = new Float32Array(PB, hL.off, hL.len), N = PJ.n, ST = PJ.step;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = Q.get('shadows') !== '0'; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(), SKY = new THREE.Color(0x9fb7d0); scene.background = SKY; scene.fog = new THREE.FogExp2(SKY.clone(), 0.00022);
const camera = new THREE.PerspectiveCamera(50, W / H, 2, 9000);
scene.add(new THREE.HemisphereLight(0xbcd2ee, 0x4a4636, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); scene.add(sun); scene.add(sun.target);
// the sky probe (the bench v1's, ?trond): the game's near ring is a Standard material lit by a PMREM sky probe - a gradient sky
// pre-filtered, at 0.55, the hemisphere lowered to 0.6. ?env=0 without
if (Q.get('env') !== '0') { const sky = new THREE.Scene();
  const sm = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vD; void main(){ float y = vD.y; vec3 zen = vec3(0.25, 0.42, 0.75), hor = vec3(0.75, 0.82, 0.9), gnd = vec3(0.08, 0.09, 0.06);'
      + ' vec3 c = y > 0.0 ? mix(hor, zen, pow(y, 0.6)) : mix(hor * 0.5, gnd, smoothstep(0.0, 0.25, -y)); gl_FragColor = vec4(c, 1.0); }' });
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), sm));
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(sky, 0.02).texture; pm.dispose();
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.55;
  scene.children.filter(o => o.isHemisphereLight).forEach(h => { h.intensity = 0.6; }); }
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.2;   // (the bench v1's)
// ---- the heights (world x, z) ----
const hIJ = (i, j) => HT[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
const hXZ = (x, z) => { const fi = (x - PJ.x0) / ST, fj = (z - PJ.z0) / ST, i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
  return (hIJ(i, j) * (1 - u) + hIJ(i + 1, j) * u) * (1 - v) + (hIJ(i, j + 1) * (1 - u) + hIJ(i + 1, j + 1) * u) * v; };
const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * N * 3), idx = new Uint32Array((N - 1) * (N - 1) * 6);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = (j * N + i) * 3; pos[k] = PJ.x0 + i * ST; pos[k + 1] = hIJ(i, j); pos[k + 2] = PJ.z0 + j * ST; }
for (let j = 0, o = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.set([a, c, b, b, c, d], o); o += 6; }
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
// ---- the island's fields, as render_world packs them ----
const gw = GJ.w, gh = GJ.h, L = GJ.layout, u8 = (o, n) => new Uint8Array(GB, o, n);
const dataTex = (d, fmt) => { const t = new THREE.DataTexture(d, gw, gh, fmt || THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; return t; };
const Bs = u8(L.B[0], L.B[1]), TT = new Uint8Array(gw * gh); for (let k = 0; k < TT.length; k++) TT[k] = Bs[k * 2 + 1];
const oc = SPLAT_GROUND.oneCode(TT, gw, gh), B2 = new Uint8Array(gw * gh * 2); for (let k = 0; k < TT.length; k++) { B2[k * 2] = Bs[k * 2]; B2[k * 2 + 1] = oc[k]; }
const packB = dataTex(B2, THREE.RGFormat); packB.unpackAlignment = 1;
const T4 = new Uint8Array(u8(L.T[0], L.T[1])); if (Q.get('rocks') === '0') for (let k = 3; k < T4.length; k += 4) T4[k] = 255;   // (the game skips the bias on ?rocks=0)
const tint = dataTex(T4); tint.colorSpace = THREE.SRGBColorSpace;
const gU = { uGTint: { value: tint }, uGPackA: { value: dataTex(new Uint8Array(u8(L.A[0], L.A[1]))) }, uGPackB: { value: packB },
  uGGrid: { value: new THREE.Vector4(GJ.x0, GJ.z0, gw * GJ.cell, gh * GJ.cell) },
  uGOverlay: { value: 0.75 }, uGShade: { value: 0.7 }, uGLight: { value: 1.38 }, uGSat: { value: 0.94 }, uGSnow: { value: 890 }, uGShore: { value: 1 },
  uGP90: { value: 15 }, uGMode: { value: 0 }, uGHMax: { value: 1100 }, uGBlur: { value: 0 }, uGWobble: { value: 0 }, uGWaterMap: { value: 1 }, uGCell: { value: GJ.cell },
  uGW1: { value: dataTex(new Uint8Array(gw * gh * 4)) }, uGW2: { value: dataTex(new Uint8Array(gw * gh * 4)) },
  uLOn: { value: [1, 1, 1, 1, 1] }, uLMode: { value: [0, 0, 3, 1, 0] }, uLOp: { value: new Float32Array([1, 1, 0.75, 0.7, 1]) }, uLStart: { value: 1 },
  uFine: { value: new THREE.Vector4(0, 0, 0, 120) }, uRingF: { value: new THREE.Vector4(0.55, 450, 90, 0) } };
const isla = { ttype: Uint8Array.from(IS.ttype), albedo: Uint8Array.from(IS.albedo), grid: null };
const T0 = performance.now();
const LEAN = Q.get('lean') === '1', STRIP = (Q.get('gstrip') || '').split(',').filter(Boolean);
const SPL = SPLAT_GROUND.make(gU, isla, { lean: LEAN });
{ const kq = Q.get('k'); if (kq) { const o = {}; for (const kv of kq.split(',')) { const [k, v] = kv.split(':'); o[k] = +v; } SPL.api.set(o); } }   // ?k=rockOff:0.2,rockGreen:1.4
// ---- the hook: render_world islandGroundHookFor(0, false)'s production text ----
let FS = '';
const hook = sh => {
  Object.assign(sh.uniforms, gU, SPL.uniforms);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPi;\nvarying float vPav;\nattribute vec4 aRM, aRX; attribute vec3 aRD; varying vec4 vRM, vRX; uniform vec4 uRingF;\n')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = aRM; vRX = aRX; if (aRM.w > 1.5) { float rf = 1.0 - smoothstep(uRingF.y - uRingF.z, uRingF.y, distance((modelMatrix * vec4(transformed, 1.0)).xz, cameraPosition.xz));\n  transformed += aRD * rf - vec3(0.0, uRingF.x * (1.0 - rf), 0.0); }\nvWPi = (modelMatrix * vec4(transformed, 1.0)).xyz; vPav = 0.0;\n');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPi;\nuniform vec4 uFine;\nvarying float vPav;\nvarying vec4 vRM, vRX;\n' +
    'uniform sampler2D uGTint, uGPackA, uGPackB, uGW1, uGW2; uniform vec4 uGGrid;\nuniform float uGBlur, uGWobble, uGWaterMap, uGCell;\n' +
    'float gLake(vec2 uv){ return texture2D(uGPackA, uv).a; }\n' +
    'float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
    'float gVnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
    'uniform float uGOverlay, uGShade, uGLight, uGSat, uGSnow, uGShore, uGP90, uGHMax; uniform int uGMode;\n' +
    'uniform int uLOn[5]; uniform int uLMode[5]; uniform float uLOp[5]; uniform int uLStart;\n' +
    'float gLuma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }\n' +
    'vec3 gBlend(vec3 b, vec3 s, int m){\n' +
    '  if (m == 1) return b * s; if (m == 2) return 1.0 - (1.0 - b) * (1.0 - s);\n' +
    '  if (m == 3) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));\n' +
    '  return s; }\n' + SPL.glslCommon)
  .replace('#include <map_fragment>', '#include <map_fragment>\n' +
    '{ vec2 guv = (vWPi.xz - uGGrid.xy) / uGGrid.zw;\n  bool gDeep = vWPi.y < -25.0;\n  vec3 tint = texture2D(uGTint, guv).rgb;\n' +
    '  float lsd = (gLake(guv) * 255.0 - 128.0) * 4.0;\n  vec4 gA = texture2D(uGPackA, guv);\n  float r1 = gA.r;\n  float can = gA.g * 255.0;\n' +
    '  vec3 gN = normalize(cross(dFdx(vWPi), dFdy(vWPi))); gN *= sign(gN.y);\n  float gSlope = acos(clamp(gN.y, 0.0, 1.0));\n' +
    '  float snowA = smoothstep(uGSnow - 60.0, uGSnow + 60.0, vWPi.y) * (1.0 - smoothstep(0.436, 0.698, gSlope));\n  vec3 t = vec3(0.5);\n' +
    '  for (int i = 0; i < 5; i++) {\n    if (i < uLStart || uLOn[i] == 0 || gDeep) continue;\n    vec3 s; float a = 1.0;\n    if (i == 0) s = vec3(0.5);\n' +
    '    else if (i == 1) s = tint;\n    else if (i == 2) s = vec3(r1);\n    else if (i == 3) s = vec3(1.0 - 0.45 * clamp(can / uGP90, 0.0, 1.2));\n' +
    '    else { s = vec3(0.85, 0.88, 0.95); a = snowA; }\n    t = mix(t, gBlend(t, s, uLMode[i]), uLOp[i] * a);\n  }\n' +
    '  if (!gDeep && vPav < 0.999) {\n' + SPL.glslMap + '  }\n' +
    '  float sd = (gA.b * 255.0 - 128.0) * 4.0;\n  if (uGWaterMap > 0.5 && lsd > -1.0) t = mix(t, vec3(0.045, 0.055, 0.035), smoothstep(-1.0, 3.0, lsd));\n' +
    '  float gl = dot(t, vec3(0.299, 0.587, 0.114));\n  t = mix(vec3(gl), t, uGSat) * uGLight;\n  diffuseColor.rgb = t; }')
  .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + SPL.glslNormal)
  .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + SPL.glslRough);
  const GLOSS = ' * smoothstep( 0.9, 0.6, material.roughness )', SC = THREE.ShaderChunk;
  sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', SC.lights_physical_pars_fragment.replace(
    'reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;',
    'reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation' + GLOSS + ';'));
  sh.fragmentShader = (LEAN ? '#define SPLAT_ONE 1\n' : '') + (SPL.api.stripDefs ? SPL.api.stripDefs() : '') + sh.fragmentShader;
  FS = sh.fragmentShader;
};
const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }); mat.onBeforeCompile = hook;
const ground = new THREE.Mesh(geo, mat); ground.castShadow = ground.receiveShadow = true; scene.add(ground);
// ---- the eyes (world coordinates; the study's views, found on the heights) ----
const grad = (x, z, d) => [(hXZ(x + d, z) - hXZ(x - d, z)) / (2 * d), (hXZ(x, z + d) - hXZ(x, z - d)) / (2 * d)];
const slope = (x, z) => { const g = grad(x, z, 5); return Math.atan(Math.hypot(g[0], g[1])) * 180 / Math.PI; };
let best = null;
for (let z = PJ.cz - 450; z <= PJ.cz + 450; z += 15) for (let x = PJ.cx - 450; x <= PJ.cx + 450; x += 15) {
  let s = 0; for (let a = 0; a < 6; a++) s += slope(x + 20 * Math.cos(a), z + 20 * Math.sin(a)); s /= 6;
  if (!best || s > best[2]) best = [x, z, s]; }
const fg = grad(best[0], best[1], 15), fl = Math.hypot(fg[0], fg[1]), dnX = -fg[0] / fl, dnZ = -fg[1] / fl;
const at = (x, z, dy) => [x, hXZ(x, z) + dy, z];
// the bench v1's slope eye: a rocky slope (the raster's rock > 0.6, 26-38 deg) nearest the face
const cL = PJ.layout.find(l => l.name === 'codes'), CODES = new Uint8Array(PB, cL.off, cL.len);
const codeAt = (x, z) => { const i = Math.min(N - 1, Math.max(0, Math.round((x - PJ.x0) / ST))), j = Math.min(N - 1, Math.max(0, Math.round((z - PJ.z0) / ST))); return CODES[(j * N + i) * 4] / 255; };
let sl2 = null;
for (let z = PJ.cz - 400; z <= PJ.cz + 400; z += 10) for (let x = PJ.cx - 400; x <= PJ.cx + 400; x += 10) {
  const sv = slope(x, z); if (codeAt(x, z) < 0.6 || sv < 26 || sv > 38) continue;
  const dd = Math.hypot(x - best[0], z - best[1]); if (!sl2 || dd < sl2[2]) sl2 = [x, z, dd]; }
// THE LANDING (16 Nov, the user: "what would it look like if I was to try and land on that?"): the flattest rocky ground near the
// face (slope under 9 deg, the map's rock over 0.3), approached from the south-west down a 4 deg path - 450 m out, 120 m out, the flare
let ld = null;   // (the gentlest ground under 12 deg with the map's rock within 60 m of it - a strip a bush plane could take - nearest the face)
for (let z = PJ.cz - 450; z <= PJ.cz + 450; z += 10) for (let x = PJ.cx - 450; x <= PJ.cx + 450; x += 10) {
  const sv = slope(x, z); if (sv > 16) continue; const s9 = Math.max(slope(x + 40, z), slope(x - 40, z), slope(x, z + 40), slope(x, z - 40)); if (s9 > 22) continue;
  let rk = codeAt(x, z); for (const [ox, oz] of [[60, 0], [-60, 0], [0, 60], [0, -60], [42, 42], [-42, 42], [42, -42], [-42, -42]]) rk = Math.max(rk, codeAt(x + ox, z + oz)); if (rk < 0.3) continue;
  const sc = sv + Math.hypot(x - best[0], z - best[1]) / 60; if (!ld || sc < ld[2]) ld = [x, z, sc]; }
console.log('LANDING ' + (ld ? 'at ' + ld[0] + ', ' + ld[1] + ' slope ' + slope(ld[0], ld[1]).toFixed(1) : 'none - the face'));
if (!ld) ld = [best[0], best[1], 0];
const land = (out, agl) => { const [tx, tz] = ld, ty = hXZ(tx, tz), ex = tx - 0.7071 * out, ez = tz + 0.7071 * out;
  const ey = Math.max(hXZ(ex, ez) + agl, ty + out * Math.tan(4 * Math.PI / 180) + 2); return [[ex, ey, ez], [tx + 0.7071 * 60, ty + 1, tz - 0.7071 * 60]]; };
const VIEWS = {
  approach: () => land(450, 60), final: () => land(120, 15), flare: () => land(35, 4),
  face: () => { const [tx, tz] = best, ty = hXZ(tx, tz), ex = tx + dnX * 230 + dnZ * 60, ez = tz + dnZ * 230 - dnX * 60; return [[ex, Math.max(hXZ(ex, ez) + 30, ty + 55), ez], [tx, ty + 5, tz]]; },
  near: () => { const [tx, tz] = best, ty = hXZ(tx, tz), ex = tx + dnX * 105 + dnZ * 35, ez = tz + dnZ * 105 - dnX * 35; return [[ex, Math.max(hXZ(ex, ez) + 12, ty + 10), ez], [tx, ty + 10, tz]]; },
  high: () => { const tx = best[0] - dnX * 60, tz = best[1] - dnZ * 60, ty = hXZ(tx, tz), ex = tx + dnX * 620 - dnZ * 160, ez = tz + dnZ * 620 + dnX * 160; return [[ex, Math.max(ty, hXZ(ex, ez)) + 520, ez], [tx, ty - 80, tz]]; },
  // the summit, seen from the south-west at 1.2 km and 300 m over it (the far ridge and its fade)
  far: () => { const tx = PJ.cx, tz = PJ.cz; let top = [tx, tz, -1]; for (let z = tz - 300; z <= tz + 300; z += 10) for (let x = tx - 300; x <= tx + 300; x += 10) { const h = hXZ(x, z); if (h > top[2]) top = [x, z, h]; }
    return [[top[0] - 850, top[2] + 300, top[1] + 850], [top[0], top[2] - 60, top[1]]]; },
  top: () => { const [tx, tz] = best, ty = hXZ(tx, tz); return [[tx + 0.1, ty + 700, tz + 0.1], [tx, ty, tz]]; },
  slope: () => { const [tx, tz] = sl2, ty = hXZ(tx, tz), g = grad(tx, tz, 10), l = Math.hypot(g[0], g[1]), ex = tx - g[0] / l * 70, ez = tz - g[1] / l * 70;
    return [[ex, Math.max(hXZ(ex, ez) + 14, ty + 18), ez], [tx, ty, tz]]; },
  ground: () => { const [tx, tz] = sl2, ty = hXZ(tx, tz), g = grad(tx, tz, 10), l = Math.hypot(g[0], g[1]), ex = tx - g[0] / l * 30, ez = tz - g[1] / l * 30;
    return [[ex, hXZ(ex, ez) + 2.2, ez], [tx, ty + 6, tz]]; },
};
const sAz = Math.atan2(dnZ, dnX) + 1.1, sEl = 32 * Math.PI / 180, SUN = new THREE.Vector3(Math.cos(sAz) * Math.cos(sEl), Math.sin(sEl), Math.sin(sAz) * Math.cos(sEl));
const view = name => { const [e, t] = (VIEWS[name] || VIEWS.face)();
  camera.position.set(e[0], e[1], e[2]); camera.lookAt(t[0], t[1], t[2]); camera.updateMatrixWorld();
  const c = new THREE.Vector3(t[0], t[1], t[2]); sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUN, 1500); sun.target.updateMatrixWorld();
  const r = name === 'high' || name === 'far' ? 900 : (name === 'face' ? 330 : 180), sc = sun.shadow.camera;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 100; sc.far = 3500; sc.updateProjectionMatrix();
  return { eye: e.map(v => +v.toFixed(1)), target: t.map(v => +v.toFixed(1)) }; };
// ---- ready: the arrays built, the program linked ----
while (!SPL.api.ready()) await new Promise(r => setTimeout(r, 100));
// ---- THE ROCK RING (src/viewer/rock_ring.js, the game's module): the outcrops round the eye, built in its worker. The bench's
// inputs: the 5 m heights (hXZ), the 10 m type and NDVI (gpatch), the patch's own 5 m D8 flow (v1's). ?ring=0 off
let RING = null;
if (Q.get('rocks') !== '0' && Q.get('ring') !== '0' && typeof ROCK_RING !== 'undefined') {
  const fL = PJ.layout.find(l => l.name === 'flow'), FLW = new Uint8Array(PB, fL.off, fL.len);
  const TTg = new Uint8Array(gw * gh), NDg = new Uint8Array(gw * gh); for (let k = 0; k < gw * gh; k++) { TTg[k] = Bs[k * 2 + 1]; NDg[k] = Bs[k * 2]; }
  // the boulders' kit: the game's 'rocks' collection, as export_patch.js wrote it (data/rocks.json + rocks.bin); ?boulders=0 none
  let KIT = null;
  if (Q.get('kit') === 'scan') { const [kj, kb] = await Promise.all([get('data/rocks.json', 'json'), get('data/rocks.bin')]);
    const kk = kj.kits.find(k => k.name === 'rocks');
    KIT = kk.subjects.map(s => { const p = s.parts[0];
      return { h: s.h, bb: s.bb, pos: new Float32Array(kb, p.pos, p.nv * 3).slice(), nor: new Float32Array(kb, p.nrm, p.nv * 3).slice(), idx: Uint32Array.from(p.wide ? new Uint32Array(kb, p.idx, p.nt * 3) : new Uint16Array(kb, p.idx, p.nt * 3)) }; }); }
  RING = ROCK_RING.make(THREE, { scene, world: null, camera, splat: SPL, groundMat: mat, groundU: gU, terrainH: hXZ, kit: KIT, bounds: [PJ.x0, PJ.z0, PJ.x0 + PJ.size, PJ.z0 + PJ.size],
    isla: { grid: { x0: GJ.x0, z0: GJ.z0, w: gw, h: gh, cell: GJ.cell }, ttype: TTg, ndvi: NDg },
    flow: { g: FLW, N, x0: PJ.x0 - ST / 2, z0: PJ.z0 - ST / 2, dx: ST } });
}
const buildMs = Math.round(performance.now() - T0);
view(Q.get('view') || 'face');
if (RING && Q.get('relief') === '0') { const o = RING.update; RING.update = () => { o(); RING.group.children.forEach(m => { if (m.material === mat) m.visible = false; }); }; }   // (?relief=0: the boulders alone - a check)
let RSTAT = null; if (RING) { const t = performance.now(); RSTAT = await RING.whenIdle(); RSTAT.wallMs = Math.round(performance.now() - t); }
// ?hang=1: the relief's OPEN EDGES - a vertex on a chunk's side, next to a chunk that has no skin, standing over the ground (the
// 'sheet' seen at eye level): counted and the worst reported to the console (ground_shot keeps the logs)
if (RING && Q.get('hang') === '1') { const C = 62.5, CS = RING.chunkStates(), meshes = RING.group.children.filter(m => m.material === mat && m.geometry.attributes.aRD);
  let n = 0, open = 0, worst = null; const why = {};
  for (const m of meshes) { const P = m.geometry.attributes.position.array, D = m.geometry.attributes.aRD.array;
    for (let v = 0; v < P.length / 3; v++) { const x = P[v * 3], z = P[v * 3 + 2], ox = Math.abs(x / C - Math.round(x / C)) < 1e-4, oz = Math.abs(z / C - Math.round(z / C)) < 1e-4; if (!ox && !oz) continue; n++;
      const h = P[v * 3 + 1] + D[v * 3 + 1] - hXZ(x, z); if (h <= 0.05) continue;
      const nbs = []; if (ox) nbs.push([Math.round(x / C) - 1, Math.floor(z / C)], [Math.round(x / C), Math.floor(z / C)]); if (oz) nbs.push([Math.floor(x / C), Math.round(z / C) - 1], [Math.floor(x / C), Math.round(z / C)]);
      const miss = nbs.map(k => k[0] + ',' + k[1]).filter(k => CS[k] !== 'mesh'); if (!miss.length) continue;
      open++; for (const k of miss) why[CS[k] || 'absent'] = (why[CS[k] || 'absent'] || 0) + 1;
      if (!worst || h > worst.h) worst = { h: +h.toFixed(2), x: +x.toFixed(1), z: +z.toFixed(1), miss: miss.map(k => k + ':' + (CS[k] || 'absent')), dEye: Math.round(Math.hypot(x - camera.position.x, z - camera.position.z)) }; } }
  // LIDS: a relief vertex meant to show (not sunk: its offset over -0.2 m) that lies UNDER the drawn ground's triangle (this mesh's
  // 5 m grid, the (i, j+1)-(i+1, j) diagonal - the game's fine tiles' cut): the ground covers the skin there
  const triB = (x, z) => { const gx = (x - PJ.x0) / ST, gz = (z - PJ.z0) / ST, i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
    return u + v <= 1 ? hIJ(i, j) * (1 - u - v) + hIJ(i, j + 1) * v + hIJ(i + 1, j) * u : hIJ(i + 1, j + 1) * (u + v - 1) + hIJ(i, j + 1) * (1 - u) + hIJ(i + 1, j) * (1 - v); };
  let shown = 0, lids = 0, deep = 0;
  for (const m of meshes) { const P = m.geometry.attributes.position.array, D = m.geometry.attributes.aRD.array;
    for (let v = 0; v < P.length / 3; v++) { if (D[v * 3 + 1] <= -0.2) continue; shown++; const x = P[v * 3], z = P[v * 3 + 2], u = triB(x, z) - (P[v * 3 + 1] + D[v * 3 + 1]); if (u > 0.02) { lids++; deep = Math.max(deep, u); } } }
  console.log('LIDS relief vertices shown ' + shown + ', under the drawn ground ' + lids + ', the deepest ' + deep.toFixed(2) + ' m');
  console.log('HANG chunks ' + Object.keys(CS).length + ' (' + meshes.length + ' meshes), edge vertices ' + n + ', OPEN over the ground ' + open + ', the missing neighbour ' + JSON.stringify(why) + ', worst ' + JSON.stringify(worst)); }
const gl = renderer.getContext(), t1 = performance.now(); renderer.render(scene, camera); gl.finish(); const firstMs = Math.round(performance.now() - t1);
const prog = renderer.info.programs.find(p => p.name && /MeshStandard/.test(p.name)) || renderer.info.programs[0];
const errs = []; renderer.debug.onShaderError = (g, p, vs, fs) => errs.push(String(g.getProgramInfoLog(p) || '') + String(g.getShaderInfoLog(fs) || ''));
// the sampler units the ground program declares (three's own + the hook's + the splat's): every 'uniform ... samplerX a, b;' name
const samplers = (FS.match(/uniform\s+(?:\w+\s+)?sampler\w*\s+[^;]+;/g) || []).reduce((n, d) => n + d.replace(/^.*sampler\w*\s+/, '').split(',').length, 0);
window.ROCK_RING_DBG = () => { if (!RING) return null; const out = []; RING.group.children.forEach(m => { const g = m.geometry, P = g.attributes.position, D = g.attributes.aRD || g.attributes.aDisp; if (!P) return;
  let dy = 0, dmax = 0, dmin = 0, n = 0; for (let v = 0; v < P.count; v += 37) { const x = P.getX(v), y = P.getY(v), z = P.getZ(v); dy = Math.max(dy, Math.abs(y - hXZ(x, z))); if (D) { dmax = Math.max(dmax, D.getY(v)); dmin = Math.min(dmin, D.getY(v)); } n++; }
  out.push({ mat: m.material === mat ? 'ground' : 'rock', nv: P.count, baseOff: +dy.toFixed(2), dYmax: +dmax.toFixed(2), dYmin: +dmin.toFixed(2) }); }); return out.slice(0, 12); };
window.GB = { ready: true, ring: RSTAT, buildMs, firstMs, fsLen: FS.length, samplers, linked: !!(prog && gl.getProgramParameter(prog.program, gl.LINK_STATUS)),
  layers: SPL.api.layers(), trOn: SPL.uniforms.uTrOn ? SPL.uniforms.uTrOn.value : -1, view,
  eyes: Object.fromEntries(Object.keys(VIEWS).map(k => { const [e, t] = VIEWS[k](); return [k, { pos: e.map(v => +v.toFixed(1)), target: t.map(v => +v.toFixed(1)) }]; })),
  render: () => { renderer.render(scene, camera); gl.finish(); },
  viewRing: async name => { view(name); if (RING) { const t = performance.now(); const st = await RING.whenIdle(); st.wallMs = Math.round(performance.now() - t); return st; } return null; },
  measure: n => { const a = []; for (let i = 0; i < n; i++) { const t = performance.now(); renderer.render(scene, camera); gl.finish(); a.push(performance.now() - t); } a.sort((x, y) => x - y); return { median: +a[a.length >> 1].toFixed(1) }; },
  rocks: v => SPL.api.rocks(v), errs, fs: () => FS };
})().catch(e => { window.GB = { error: String(e && e.stack || e) }; console.error(e); });
