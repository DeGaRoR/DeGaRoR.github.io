// ============================================================
// RAIN AROUND YOU (RAIN step 1b, LOOK-1, 16 Nov 2026; the user: "a proper, very optimized job", never "a couple of
// particles"; flydiy-notes/studies/RAIN-STUDY-2026-11-16.md section 3 (b)).
//
// STATELESS STREAKS IN CAMERA-WRAPPED BOXES. One quad, drawn instanced; nothing per drop lives on the CPU or in a
// buffer. The vertex shader makes each drop from its instance id: a hashed seed in a box of side L (three nested boxes,
// co-prime sizes 11 / 27 / 61 m, the near one densest), moved by the fall and the wind (an offset the CPU wraps in double
// precision), wrapped round the eye - so the drops stand still in the world, fall and drift, and the eye flies through
// them. Each drop is a streak along its velocity RELATIVE TO THE EYE x an exposure: parked they fall straight, at 50 m/s
// they come at you from the point you fly to (Wang & Wade's FS2004 cone, in 3D). The streak is clamped in length (world
// and screen), its width at least ~1 px with the alpha paying for the extra width (a far streak never reads thick).
//
// LIGHT: a little of the sky's ambient, and the forward-scatter boost when the sun is BEHIND the drop (Garg & Nayar: a
// streak is bright backlit, nearly invisible otherwise). At night: the landing light's cone lights the drops in it.
// WHERE IT DOES NOT RAIN: the hardware depth test against the real scene (the drops are real 3D points), the CABIN box
// (an oriented box in the aircraft's frame: a drop inside it collapses to nothing), and up to 8 ROOF boxes (oriented,
// in the world: under a roof, below its top, no drop).
//
// COST: 1 draw, 0 samplers, 0 textures, one 4-vertex quad; the instance count is the local rain x the tier's count, so
// a dry day draws nothing - and the program is only made (compiled) the first time it rains near the eye (app.js: lazy).
// ============================================================
var RAIN_FX = (function () {
  'use strict';
  // the tiers (gfx_settings 'rain'): per box [size m, drops at full rain]; 'off' draws no streak
  const TIERS = Object.freeze({
    off:  Object.freeze({ boxes: [] }),
    lean: Object.freeze({ boxes: [[11, 2400], [27, 1600]] }),
    full: Object.freeze({ boxes: [[11, 6000], [27, 6000], [61, 6000]] }),
  });
  // the look (the F9 world editor's "rain" block reads and writes these; EXPORT carries them)
  const LOOK = {
    exposure: 0.05,     // s - the streak's length = the relative speed x this (a camera's shutter)
    maxLen: 2.4,        // m - the longest streak in the world
    maxNdc: 0.12,       // the longest streak on screen (NDC units, ~6 % of the screen's height)
    width: 0.0025,      // m - the drop's width in the world (2.5 mm)
    minPx: 1.1,         // px - never thinner on screen; the alpha falls by the ratio instead
    opacity: 0.32,      // the streak's peak alpha
    ambient: 0.55,      // x the sky's ambient colour
    back: 3.0,          // the forward-scatter boost when backlit (x the sun's colour)
    backPow: 10,        // its tightness
    vFall: 6.5,         // m/s - a 2 mm drop (Gunn & Kinzer 1949)
    nearFade: 1.2,      // m - no streak closer than this (fades in to 2 x)
    cockpitK: 0.35,     // in the cockpit at speed: the density's floor (the windscreen carries the rest)
    cockpitV: 40,       // m/s - the airspeed at which the cockpit's density reaches its floor
    cabinHalf: [0.8, 0.7, 1.1],   // m - the dry box round the head in the cockpit (camera axes: right, up, back); the real cabin is a later step
  };
  const MAX_ROOFS = 8;

  const VERT = [
    // (a three ShaderMaterial, GLSL3: three declares position, viewMatrix, projectionMatrix and maps varying)
    // THE DEPTH CONVENTION (the soft run, 16 Nov eve: no streak drew): the renderer is reversed-z where EXT_clip_control is, else
    // LOGARITHMIC (app.js) - a custom shader must take three's logdepthbuf chunks as dust.js and spray.js do, or it fails the depth test
    '#include <common>',
    '#include <logdepthbuf_pars_vertex>',
    'uniform vec3 uCam;',                 // the eye (world)
    'uniform vec4 uBoxA[3];',             // per box: L, the first instance id, the drawn count, the count at full rain
    'uniform vec3 uOff[3];',              // per box: (the fall + the wind's drift) - the eye, wrapped into [0, L) on the CPU
    'uniform vec3 uVrel;',                // the drop's velocity relative to the eye (world, m/s)
    'uniform vec4 uLen;',                 // exposure, maxLen, maxNdc, width
    'uniform vec4 uPx;',                  // 2 / viewport width, 2 / viewport height, minPx, nearFade
    'uniform mat4 uCabinInv;',            // world -> the cabin box's frame
    'uniform vec3 uCabinH;',              // its half extents (0 = no cabin)
    'uniform vec4 uRoofA[' + MAX_ROOFS + '];', // per roof: centre x, centre z, cos yaw, sin yaw
    'uniform vec4 uRoofB[' + MAX_ROOFS + '];', // half x, half z, the roof's top (world y), 1 = on
    // position: the quad, x in {-1, 1} across, y in {0, 1} along
    'varying vec2 vQ;',
    'varying float vA;',
    'varying vec3 vDir;',
    'float h1(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }',
    'vec3 h3(float n) { return vec3(h1(n), h1(n + 17.31), h1(n + 41.77)); }',
    'void main() {',
    '  float id = float(gl_InstanceID);',
    '  int b = id < uBoxA[1].y ? 0 : (id < uBoxA[2].y ? 1 : 2);',
    '  vec4 B = uBoxA[b];',
    '  float L = B.x, k = id - B.y;',
    '  gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(0.0); vA = 0.0; vDir = vec3(0.0);',
    '  if (k >= B.z) return;',
    // the drop: its seed in the box, the fall and the drift (uOff, wrapped), wrapped round the eye
    '  vec3 s = h3(k * 1.618 + float(b) * 9301.0);',
    '  vec3 p = mod(s * L + uOff[b], L) - 0.5 * L;',
    '  vec3 w = uCam + p;',
    // the cabin: inside its box, nothing
    '  if (uCabinH.x > 0.0) { vec3 c = (uCabinInv * vec4(w, 1.0)).xyz; if (all(lessThan(abs(c), uCabinH))) return; }',
    // the roofs: under one (inside its footprint, below its top), nothing
    '  for (int i = 0; i < ' + MAX_ROOFS + '; i++) { vec4 A = uRoofA[i], R = uRoofB[i]; if (R.w < 0.5) continue;',
    '    vec2 d = w.xz - A.xy; vec2 q = vec2(d.x * A.z + d.y * A.w, -d.x * A.w + d.y * A.z);',
    '    if (abs(q.x) < R.x && abs(q.y) < R.y && w.y < R.z) return; }',
    // the streak: from the drop back along the relative velocity x the exposure, clamped in the world
    '  vec3 tail = -uVrel * uLen.x; float tl = length(tail); if (tl > uLen.y) tail *= uLen.y / tl;',
    // THE QUAD IN VIEW SPACE (16 Nov eve: the NDC construction - a width from the projected direction - drew no pixel on SwiftShader
    // though every input was right, bisected in seven soft runs; this one never divides by a projected length): the streak from
    // the drop along the tail, the side across both the streak and the line of sight, the half-width the drop's own or minPx pixels
    // at that depth, the on-screen cap (maxNdc) turned into metres at that depth the same way
    '  vec4 v0 = viewMatrix * vec4(w, 1.0);',
    '  vec3 sv = (viewMatrix * vec4(tail, 0.0)).xyz;',
    '  float zc = -v0.z;',
    '  if (zc < 0.05 || zc + sv.z * -1.0 < 0.05) return;',
    '  float dist = length(p);',
    '  float mpp = uPx.y * zc / projectionMatrix[1][1];',                     // metres per pixel at this depth
    '  float slen = length(sv), maxL = uLen.z / uPx.y * mpp;',              // maxNdc in pixels, in metres here
    '  if (slen > maxL) { sv *= maxL / slen; slen = maxL; }',
    // (no vector ?: - SwiftShader drew nothing through one, 16 Nov eve: a guarded division instead; a still drop gets a 1 mm up stub)
    '  sv += vec3(0.0, 1e-3, 0.0) * step(slen, 1e-5); slen = max(length(sv), 1e-5);',
    '  vec3 sd = sv / slen;',
    '  vec3 side = cross(sd, normalize(v0.xyz)); side = side / max(length(side), 1e-5);',
    '  float wMin = uPx.z * mpp, hw = 0.5 * max(uLen.w, wMin), alpha = clamp(uLen.w / max(max(uLen.w, wMin), 1e-6), 0.08, 1.0);',
    '  vec3 vp = v0.xyz + sv * position.y + side * (position.x * hw);',
    '  gl_Position = projectionMatrix * vec4(vp, 1.0);',
    '  #include <logdepthbuf_vertex>',
    // the fades: near the eye, at the box's edge (the wrap never pops), and the box's share of the rain
    '  float edge = 1.0 - smoothstep(0.30 * L, 0.5 * L, max(abs(p.x), max(abs(p.y), abs(p.z))));',
    '  float near = smoothstep(uPx.w, 2.0 * uPx.w, dist);',
    '  vQ = vec2(position.x, position.y); vA = alpha * edge * near;',
    '  vDir = normalize(p);',
    '}'].join('\n');
  const FRAG = [
    // (GLSL3 on a three ShaderMaterial: no gl_FragColor of its own - declared here, like clouds.js GLSL3_OUT; the soft compile check, 16 Nov eve)
    'layout(location = 0) out highp vec4 rainC;',
    '#define gl_FragColor rainC',
    '#include <common>',
    '#include <logdepthbuf_pars_fragment>',
    'uniform vec3 uSun, uSunCol, uSkyCol, uLampPos, uLampDir, uLampCol;',
    'uniform vec4 uLook;',                 // opacity, ambient, back, backPow
    'uniform vec2 uLampCone;',             // cos of the cone's half angle, the lamp's range (m)
    'varying vec2 vQ;',
    'varying float vA;',
    'varying vec3 vDir;',
    'void main() {',
    '  #include <logdepthbuf_fragment>',
    '  if (vA <= 0.0) discard;',
    '  float across = 1.0 - vQ.x * vQ.x;',                         // the drop's profile across (no texture)
    '  float along = smoothstep(0.0, 0.25, vQ.y) * (1.0 - smoothstep(0.6, 1.0, vQ.y));',
    '  float a = uLook.x * vA * across * along;',
    '  if (a < 0.002) discard;',
    '  float back = pow(max(0.0, dot(vDir, uSun)), uLook.w);',    // the sun behind the drop, the eye looking toward it
    '  vec3 col = uSkyCol * uLook.y + uSunCol * back * uLook.z;',
    '  if (uLampCone.y > 0.0) { vec3 L = normalize(vDir); float ca = dot(L, uLampDir); col += uLampCol * smoothstep(uLampCone.x, mix(uLampCone.x, 1.0, 0.4), ca); }',
    '  gl_FragColor = vec4(col * a, a);',                             // premultiplied
    '}'].join('\n');

  // the CPU's half: the boxes' offsets, wrapped in double precision (the fall x a day's seconds is far past a float)
  const wrap = (v, L) => ((v % L) + L) % L;
  function offsets(t, cam, wind, vFall, boxes, out) {
    for (let b = 0; b < 3; b++) {
      const L = boxes[b] ? boxes[b][0] : 1, o = out[b];
      o[0] = wrap(wind[0] * t - cam[0], L); o[1] = wrap(-vFall * t - cam[1], L); o[2] = wrap(wind[1] * t - cam[2], L);
    }
    return out;
  }
  // the density at the eye: the local rain, and in the cockpit at speed a floor (the windscreen carries the rest)
  function density(rain, o) {
    if (!(rain > 0)) return 0;
    let k = Math.min(1, rain);
    if (o && o.cockpit) { const v = Math.max(0, o.V || 0), f = Math.min(1, v / LOOK.cockpitV); k *= 1 - f * (1 - LOOK.cockpitK); }
    return k;
  }
  // the instance ranges for a tier at a density: [first, drawn, full] per box, and the total drawn
  function ranges(tier, k) {
    const T = TIERS[tier] || TIERS.full, R = [];
    let first = 0;
    for (let b = 0; b < 3; b++) {
      const bx = T.boxes[b];
      if (!bx) { R.push([bx ? bx[0] : 1, first, 0, 0]); continue; }
      const full = bx[1], drawn = Math.round(full * Math.max(0, Math.min(1, k)));
      R.push([bx[0], first, drawn, full]); first += full;
    }
    // the shader takes box b's instances from its first id: the drawn ones sit at the start of each box's range, so the
    // instance count is the LAST box's first + drawn (the gaps between boxes are culled in the shader by k >= drawn)
    let last = 0; for (let b = 0; b < 3; b++) if (R[b][2] > 0) last = R[b][1] + R[b][2];
    return { R, count: last };
  }

  // make(THREE) -> { mesh, sync(camera, o), setRoofs(list), dispose }
  function make(THREE) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    g.instanceCount = 0;
    const V3 = () => new THREE.Vector3(), V4 = () => new THREE.Vector4();
    const U = {
      uCam: { value: V3() },
      uBoxA: { value: [V4(), V4(), V4()] }, uOff: { value: [V3(), V3(), V3()] }, uVrel: { value: V3() },
      uLen: { value: V4() }, uPx: { value: V4() },
      uCabinInv: { value: new THREE.Matrix4() }, uCabinH: { value: V3() },
      uRoofA: { value: Array.from({ length: MAX_ROOFS }, V4) }, uRoofB: { value: Array.from({ length: MAX_ROOFS }, V4) },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0, 0, 0) }, uSkyCol: { value: new THREE.Color(0.5, 0.55, 0.6) },
      uLampPos: { value: V3() }, uLampDir: { value: new THREE.Vector3(0, 0, -1) }, uLampCol: { value: new THREE.Color(0, 0, 0) }, uLampCone: { value: new THREE.Vector2(1, 0) },
      uLook: { value: V4() },
    };
    const M = MATLIB.make(THREE, 'shader', { glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms: U,
      // DoubleSide (17 Nov 02:00, THE cause of "no pixel" on SwiftShader AND the RTX): the quad's winding follows the streak's
      // direction on screen - a falling drop's tail points up, its side left, the triangles wind clockwise and three's default
      // FrontSide culled every one; every debug quad drawn right / up (counter-clockwise) drew
      side: THREE.DoubleSide,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }, 'fx / rain / streaks');
    M.toneMapped = true; M.name = 'rain';
    const mesh = new THREE.Mesh(g, M); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = 'rain'; mesh.visible = false;
    const off = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], cam = [0, 0, 0];
    const api = {
      mesh, material: M, drawn: 0, k: 0, tier: 'full',
      // o: { rain (the local rain 0..1), t (s, the day's clock), wind [wx, wz] m/s, eyeVel [x, y, z] m/s, cockpit (bool), V (airspeed),
      //      tier, sun [x y z] (toward the sun), sunCol, skyCol (THREE.Color), cabin { inv (Matrix4 world -> box), half [x y z] } | null,
      //      lamp { pos, dir, col, cosHalf, range } | null }
      sync(camera, o) {
        const tier = o.tier || 'full', k = density(o.rain, o), T = TIERS[tier] || TIERS.full;
        api.k = k; api.tier = tier;
        if (!(k > 0) || !T.boxes.length) { mesh.visible = false; api.drawn = 0; g.instanceCount = 0; return; }
        const rg = ranges(tier, k);
        camera.updateMatrixWorld();
        const me = camera.matrixWorld.elements; cam[0] = me[12]; cam[1] = me[13]; cam[2] = me[14];   // the WORLD eye (a cockpit camera may be parented)
        const wind = o.wind || [0, 0];
        offsets(o.t || 0, cam, wind, LOOK.vFall, rg.R.map(r => [r[0]]), off);
        for (let b = 0; b < 3; b++) { const r = rg.R[b]; U.uBoxA.value[b].set(r[0], r[1], r[2], r[3]); U.uOff.value[b].set(off[b][0], off[b][1], off[b][2]); }
        U.uCam.value.set(cam[0], cam[1], cam[2]);
        const ev = o.eyeVel || [0, 0, 0];
        U.uVrel.value.set(wind[0] - ev[0], -LOOK.vFall - ev[1], wind[1] - ev[2]);
        U.uLen.value.set(LOOK.exposure, LOOK.maxLen, LOOK.maxNdc, LOOK.width);
        const vw = o.viewport || [1920, 1080];
        U.uPx.value.set(2 / vw[0], 2 / vw[1], LOOK.minPx, LOOK.nearFade);
        if (o.cabin && o.cabin.inv) { U.uCabinInv.value.copy(o.cabin.inv); U.uCabinH.value.set(o.cabin.half[0], o.cabin.half[1], o.cabin.half[2]); } else U.uCabinH.value.set(0, 0, 0);
        if (o.sun) U.uSun.value.set(o.sun[0], o.sun[1], o.sun[2]).normalize();
        if (o.sunCol) U.uSunCol.value.copy(o.sunCol); if (o.skyCol) U.uSkyCol.value.copy(o.skyCol);
        if (o.lamp) { U.uLampPos.value.set(o.lamp.pos[0], o.lamp.pos[1], o.lamp.pos[2]); U.uLampDir.value.set(o.lamp.dir[0], o.lamp.dir[1], o.lamp.dir[2]).normalize();
          U.uLampCol.value.copy(o.lamp.col); U.uLampCone.value.set(o.lamp.cosHalf, o.lamp.range); } else U.uLampCone.value.set(1, 0);
        U.uLook.value.set(LOOK.opacity, LOOK.ambient, LOOK.back, LOOK.backPow);
        g.instanceCount = rg.count; api.drawn = rg.R.reduce((a, r) => a + r[2], 0); mesh.visible = rg.count > 0;
      },
      // roofs: [{ x, z, yaw, hx, hz, top }] - the nearest MAX_ROOFS the caller picked; the rest switched off
      setRoofs(list) {
        const A = U.uRoofA.value, B = U.uRoofB.value, L = list || [];
        for (let i = 0; i < MAX_ROOFS; i++) { const r = L[i];
          if (!r) { B[i].set(0, 0, 0, 0); continue; }
          A[i].set(r.x, r.z, Math.cos(r.yaw || 0), Math.sin(r.yaw || 0)); B[i].set(r.hx, r.hz, r.top, 1); }
      },
      dispose() { g.dispose(); M.dispose(); },
    };
    return api;
  }
  const API = { TIERS, LOOK, MAX_ROOFS, VERT, FRAG, make, offsets, density, ranges, wrap };
  if (typeof window !== 'undefined') window.RAIN_FX = API;
  return API;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RAIN_FX;
