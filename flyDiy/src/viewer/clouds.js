// ============================================================
// THE CLOUDS — a volumetric layer over the world (CLOUDS C1 + C2, 2026-09-15).
//
// Not voxel meshes: a density FIELD sampled by rays, the Guerrilla / Nubis
// method (Schneider 2015, 2017). The weather map (08_cloud_field.js: the
// day's cover and type, the wind's drift) drives 3D Perlin-Worley noise;
// one ray a pixel marches the layer between the day's base and the type's
// top, extinction by Beer-Lambert, a short light march toward the sun at
// every step for the self-shadow, a dual-lobe phase, the multi-scatter
// octaves (Wrenninge 2013), ambient from the sky's irradiance above and the
// ground's below - all in the sun's units (E_sun = 1, ATMO's tables), the
// SAME aerial perspective and mist the scene gets (ATMO.GLSL) at the
// cloud's own mean distance, then tone-mapped in the composite because the
// resolve target is display-space (aa_resolve.js).
//
// THE MARCH runs at half resolution (GRAPHICS `clouds`: off / half / full)
// into its own two-target (the radiance + alpha, and the scene depth it saw),
// stopped at the scene's depth (the resolve target's depth texture - the
// mountains poke through the layer, the aeroplane in front of a cloud is in
// front of it), then composites over the frame before the resolve
// (aa.setOverlay) through a DEPTH-AWARE upsample: each full pixel takes the
// four half texels weighted by how close their depth is to its own, so the
// ridge line keeps its edge and no cloud halo bleeds over the hill (C2).
//
// THE SHADOW (C2, pulled forward from C3 at the user's ask): a top-down bake
// of the layer's transmittance over the weather tile (512^2, twelve heights
// through the layer, the same density the march sees), re-baked as the drift
// moves, INTO THE AERIAL-PERSPECTIVE ATLAS (its upper rows, atmo.js AP_TILE):
// the island's ground program already stands at the 16-sampler limit, and one
// more sampler broke it (measured: the terrain vanished) - so the tile rides
// the one texture every fogged material already binds. ONE chunk splice puts
// it on every lit, fogged material - lights_pars_begin declares cloudShadow()
// (the world point from the fog varying, projected along the sun to the
// layer's middle), lights_fragment_begin multiplies the sun's colour by it -
// so the terrain, the water, the houses, the trees (their own leaf terms take
// it too) and the aeroplane stand in the clouds' shadows; the flare reads the
// same transmittance at the eye (CLOUDS.sunT, the CPU column calibrated to
// the tile). The scalars ride a shared Float32Array through ShaderLib and
// ATMO.inject - the aerial perspective's own paths.
//
// The noise is baked on the GPU into two 3D textures at first use, a few
// slices a frame. A GPU timer (EXT_disjoint_timer_query_webgl2) times the
// pass - the headless frame time was noise; this is the number.
//
// THE UNITS BUG, guarded: a cloud's radiance is E_sun x phase (up to ~4 at
// the silver lining) - in sun units, x U.scale, tone-mapped with the scene;
// never judged at exposure ~1. The moon lights it through eMoon like the dome.
// ============================================================
var CLOUDS = (function () {
  'use strict';
  const S = { mode: 'half', steps: 48, lightSteps: 5, sigma: 0.08, seed: 7, base: 0, thick: 0, driftK: 1, powder: 0.6, ambK: 1, sunK: 1,
              detail: 0.55, g: 0.75, period: 6000, detailPeriod: 700, ms: 0.5, bakeSlices: 6, maxKm: 60, curl: 0.3,
              shadow: 0.8, shadowSoft: 0.6, shadowSteps: 12, shadowEvery: 2, upsample: 1, shimmer: 0, columnK: 0.15, jitter: 0.6, depthK: 1 };
  const NB = 128, ND = 64;                 // the base and detail noise sides (the shadow tile's side is ATMO.AP.TILE)
  let renderer = null, ready = false, noiseRT = null, detailRT = null, bakeAt = 0, bakeMat = null, fsScene = null, fsCam = null, quad = null;
  let map = null, mapKey = '', weatherTex = null, rt = null, rtW = 0, rtH = 0, marchMat = null, compMat = null, frame = 0;
  let shadowRT = null, shadowMat = null, shadowDirty = true, shadowDrift = [1e9, 1e9];
  let lay = null, dayRef = null, lastCover = 0, stats = { ms: 0, gpuMs: 0, shadowMs: 0, slicesBaked: 0, cover: 0 };
  const drift = [0, 0];
  const U = {
    uNoise: { value: null }, uDetail: { value: null }, uWeather: { value: null }, uDepth: { value: null },
    uInvProj: { value: null }, uCamMat: { value: null }, uCamPos: { value: null }, uRes: { value: null },
    uLogFar: { value: 1 }, uLayer: { value: null }, uProfile: { value: null }, uSpanDrift: { value: null },
    uSun: { value: null }, uSunCol: { value: null }, uMoon: { value: null }, uMoonCol: { value: null },
    uAmbTop: { value: null }, uAmbBot: { value: null }, uScale: { value: 1 }, uSteps: { value: null }, uFrame: { value: 0 },
    uDials: { value: null }, uCloudTex: { value: null }, uKeyTex: { value: null }, uTexel: { value: null }, uUp: { value: 1 },
    uShadowK: { value: null }, uDials2: { value: null }, uDepthK: { value: 1 },
  };
  // THE SHADOW'S SHARED UNIFORM: the scalars by reference through ShaderLib and inject(); the tile itself is
  // in ATMO's atlas (uApAtlas, already on every fogged program)
  // uCloudP[0] = (drift x, drift z, span, on), [1] = (sun dir xyz, the layer's middle y), [2] = (strength x fade, 0, 0, 0)
  const cloudScalars = new Float32Array(12);
  const cloudUniforms = { uCloudP: { value: cloudScalars } };
  const AT = () => (typeof ATMO !== 'undefined' && ATMO.AP && ATMO.AP.TILE) ? ATMO.AP : { N: 32, W: 64, H: 32, TILE: 512, TILE_Y: 34, ATLAS_H: 546 };
  // the tile's place in the atlas, in GLSL: u over the tile's 512 of the atlas's width, v over its rows, half a texel in from every edge (no seam bleed)
  const TILE_UV = () => { const a = AT(); return `vec2((0.5 + fract(tuv.x) * ${a.TILE - 1}.0) / ${a.N * a.W}.0, (${a.TILE_Y}.0 + 0.5 + fract(tuv.y) * ${a.TILE - 1}.0) / ${a.ATLAS_H}.0)`; };

  // ---- the noise bake (into a 3D target a slice at a time) ------------------
  const NOISE_GLSL = `
    vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    // inverted Worley, tiling with period F (p in cells)
    float worley(vec3 p, float F) {
      vec3 i = floor(p), f = fract(p); float d = 1.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
        vec3 o = vec3(float(x), float(y), float(z)); vec3 c = mod(i + o + F, F);
        vec3 r = o + hash33(c) - f; d = min(d, dot(r, r));
      }
      return 1.0 - sqrt(d);
    }
    float worleyFbm(vec3 p, float F) { return worley(p * F, F) * 0.625 + worley(p * F * 2.0, F * 2.0) * 0.25 + worley(p * F * 4.0, F * 4.0) * 0.125; }
    // gradient (Perlin) noise, tiling with period F
    float perlin(vec3 p, float F) {
      vec3 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      float n = 0.0;
      for (int x = 0; x <= 1; x++) for (int y = 0; y <= 1; y++) for (int z = 0; z <= 1; z++) {
        vec3 o = vec3(float(x), float(y), float(z)); vec3 g = hash33(mod(i + o, F)) * 2.0 - 1.0;
        float w = (x == 0 ? 1.0 - u.x : u.x) * (y == 0 ? 1.0 - u.y : u.y) * (z == 0 ? 1.0 - u.z : u.z);
        n += w * dot(g, f - o);
      }
      return n * 0.5 + 0.5;
    }
    float perlinFbm(vec3 p, float F) { return perlin(p * F, F) * 0.5 + perlin(p * F * 2.0, F * 2.0) * 0.25 + perlin(p * F * 4.0, F * 4.0) * 0.125 + perlin(p * F * 8.0, F * 8.0) * 0.0625; }
    float remap(float v, float a, float b, float c, float d) { return c + (clamp((v - a) / (b - a), 0.0, 1.0)) * (d - c); }`;
  const BAKE_VERT = `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const BAKE_FRAG = `precision highp float; uniform vec3 uBake; /* x: slice z (0..1), y: size, z: detail? */
    ${NOISE_GLSL}
    void main() {
      vec3 p = vec3((gl_FragCoord.xy) / uBake.y, uBake.x);     // [0,1)^3, tiling
      if (uBake.z < 0.5) {
        float pf = perlinFbm(p, 4.0), w4 = worleyFbm(p, 4.0);
        float pw = remap(pf * 1.25 - 0.1, 0.0, 1.0, w4, 1.0);   // Perlin-Worley: the Worley fills the Perlin's lows
        gl_FragColor = vec4(pw, worleyFbm(p, 8.0), worleyFbm(p, 16.0), worleyFbm(p, 32.0));
      } else gl_FragColor = vec4(worleyFbm(p, 2.0), worleyFbm(p, 4.0), worleyFbm(p, 8.0), 1.0);
    }`;

  // ---- THE DENSITY, one text for the march and the shadow --------------------
  // GLSL3 (sampler3D): three defines varying/texture2D for us but NOT gl_FragColor - the out is ours
  const GLSL3_OUT = `layout(location = 0) out highp vec4 outC;
    #define gl_FragColor outC`;
  const DENSITY_GLSL = `
    uniform sampler3D uNoise, uDetail; uniform sampler2D uWeather;
    uniform vec4 uLayer;        // base (m), thickness (m), sigma (/m at full density), the map's span (m)
    uniform vec4 uProfile;      // bot, top, detail strength, curl
    uniform vec4 uSpanDrift;    // drift x, drift z (m, the wind x the clock), base period (m), detail period (m)
    float remap(float v, float a, float b, float c, float d) { return c + (clamp((v - a) / (b - a), 0.0, 1.0)) * (d - c); }
    // the profile: 08_cloud_field.js profile(), the same shape (h the fraction of the layer, hs the column's top)
    float profile(float h, float hs) { if (h <= 0.0 || h >= hs) return 0.0; return smoothstep(0.0, uProfile.x, h) * (1.0 - smoothstep(uProfile.y * hs, hs, h)); }
    vec4 weather(vec3 p) { return texture(uWeather, (p.xz + uSpanDrift.xy) / uLayer.w); }
    // density at p (0..1 x coverage); cheap = no detail (the light march, the shadow)
    float density(vec3 p, vec4 w, bool cheap) {
      float h = (p.y - uLayer.x) / uLayer.y;
      float prof = profile(h, w.y);
      if (prof <= 0.0 || w.x <= 0.0) return 0.0;
      vec3 q = (p + vec3(uSpanDrift.x, 0.0, uSpanDrift.y)) / uSpanDrift.z;
      vec4 n = texture(uNoise, q);
      float lf = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
      float base = remap(n.r, lf - 1.0, 1.0, 0.0, 1.0) * prof;
      float cov = w.x * mix(0.85, 1.0, w.z);
      base = remap(base, 1.0 - cov, 1.0, 0.0, 1.0) * cov;
      if (cheap || base <= 0.0 || uProfile.z <= 0.0) return base;
      vec3 qd = (p + vec3(uSpanDrift.x, 0.0, uSpanDrift.y)) / uSpanDrift.w;
      qd.xz += uProfile.w * vec2(n.b - 0.5, n.a - 0.5) * 2.0;   // a curl the base noise lends the wisps
      vec3 dn = texture(uDetail, qd).rgb;
      float hf = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
      hf = mix(hf, 1.0 - hf, clamp(h * 8.0, 0.0, 1.0));           // wispy at the bottom, billowy above
      return remap(base, hf * uProfile.z, 1.0, 0.0, 1.0);
    }`;

  // ---- the march --------------------------------------------------------------
  const QUAD_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const marchFrag = () => `precision highp float; precision highp sampler3D;
    ${GLSL3_OUT}
    layout(location = 1) out highp vec4 outK;
    varying vec2 vUv;
    uniform sampler2D uDepth;
    uniform mat4 uInvProj, uCamMat; uniform vec3 uCamPos; uniform vec2 uRes; uniform float uLogFar;
    uniform vec4 uSun, uMoon;   // direction xyz, w: the moon lit?
    uniform vec3 uSunCol, uMoonCol, uAmbTop, uAmbBot;   // sun units
    uniform float uScale, uFrame; uniform vec2 uSteps; uniform vec4 uDials, uDials2;   // dials: powder, g, ms decay, maxKm | jitter, 0, 0, 0
    ${DENSITY_GLSL}
    ${ATMO_GLSL()}
    float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.5663706 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
    float phase(float c, float g) { return 0.7 * hg(c, g) + 0.3 * hg(c, -0.3 * g); }
    // the light march: optical depth toward the sun from p
    float lightOD(vec3 p, vec3 L) {
      float od = 0.0, t = 0.0, ds = uLayer.y / (uSteps.y * 1.6);
      for (float i = 0.0; i < 8.0; i += 1.0) {
        if (i >= uSteps.y) break;
        t += ds * (0.5 + i);                                       // steps that lengthen with distance
        vec3 q = p + L * t;
        if (q.y > uLayer.x + uLayer.y * 1.05 || q.y < uLayer.x - 20.0) break;
        od += density(q, weather(q), true) * ds * (0.5 + i);
      }
      return od * uLayer.z;
    }
    // the multi-scatter octaves (Wrenninge): sum a^i exp(-od b^i) phase(g c^i), a = b = c = decay
    vec3 sunLight(float od, float cosT, float rho, float dt) {
      float a = 1.0, s = 0.0, k = uDials.z;
      for (int i = 0; i < 3; i++) { s += a * exp(-od * a) * phase(cosT, uDials.y * a); a *= k; }
      float powder = mix(1.0, 1.0 - exp(-2.0 * rho * uLayer.z * dt * 4.0), uDials.x * (0.5 - 0.5 * cosT));   // darker cores away from the sun
      return uSunCol * s * powder;
    }
    void main() {
      vec2 ndc = vUv * 2.0 - 1.0;
      vec4 v = uInvProj * vec4(ndc, 1.0, 1.0); vec3 dv = normalize(v.xyz / v.w);
      vec3 d = normalize(mat3(uCamMat) * dv), o = uCamPos;
      // the scene's depth (logarithmic: w = (far + 1)^depth - 1, the clip w = the view depth)
      float dz = texture(uDepth, vUv).r;
      outK = vec4(exp2(dz * uLogFar) * 0.001, 0.0, 0.0, 1.0);    // the distance (km) this texel saw, for the upsample - a half float holds a distance to 0.1 %, a log depth only to 2 %
      float tScene = dz >= 0.99999 ? 1e9 : (exp2(dz * uLogFar) - 1.0) / max(1e-4, -dv.z);
      // the slab [base, top]
      float yb = uLayer.x, yt = uLayer.x + uLayer.y, t0, t1;
      if (abs(d.y) < 1e-5) { if (o.y < yb || o.y > yt) { gl_FragColor = vec4(0.0); return; } t0 = 0.0; t1 = uDials.w * 1000.0; }
      else {
        float ta = (yb - o.y) / d.y, tb = (yt - o.y) / d.y;
        t0 = max(0.0, min(ta, tb)); t1 = max(ta, tb);
        if (t1 <= 0.0) { gl_FragColor = vec4(0.0); return; }
      }
      t1 = min(t1, min(tScene, uDials.w * 1000.0));
      if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }
      // THE STEP: N steps over the slab when the path is short; a floor and a ceiling on the step so a
      // grazing path (tens of km through the layer) is marched at a length that resolves a cloud, then
      // 0.4 % of the distance (a far cloud is small on screen; 4N steps reach the horizon); empty air is crossed in strides -
      // three steps where the weather map is clear, one and a half where the column is but the noise
      // is not - and the march stops when the light is gone (T < 1 %) or the path ends
      float N = uSteps.x;
      float dt0 = clamp((t1 - t0) / N, 24.0, 60.0);
      // a jitter per PIXEL (interleaved gradient noise) breaks the banding; per frame it would shimmer
      // (no history averages it yet - the temporal pass is owed), so uFrame scales it to nothing by default
      float j = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y) + uFrame * 0.618034);
      float t = t0 + dt0 * j * uDials2.x * smoothstep(8000.0, 1500.0, t0);   // the jitter's amplitude (a dial: grain against banding) - near only: far, the fine steps need none and the grain read as blocks
      vec3 col = vec3(0.0); float T = 1.0, tw = 0.0, tsum = 0.0;
      vec3 L = uSun.xyz; float cosT = dot(d, L), cosM = dot(d, uMoon.xyz);
      for (float i = 0.0; i < 256.0; i += 1.0) {
        if (i >= N * 4.0 || T < 0.01 || t > t1) break;
        float dt = max(dt0, t * 0.004);                          // never finer than ~an eighth of a pixel's footprint: a far cloud is small
        vec3 p = o + d * t;
        vec4 w = weather(p);
        if (w.x <= 0.0) { t += dt * 3.0; continue; }
        float rho = density(p, w, false);
        if (rho <= 0.0) { t += dt * 1.5; continue; }
        float h = clamp((p.y - uLayer.x) / uLayer.y, 0.0, 1.0);
        float Tstep = exp(-rho * uLayer.z * dt);
        vec3 Ls = vec3(0.0);
        if (uSun.y > -0.1) Ls += sunLight(lightOD(p, L), cosT, rho, dt);
        if (uMoon.w > 0.0) Ls += uMoonCol * exp(-lightOD(p, uMoon.xyz)) * phase(cosM, uDials.y);
        Ls += mix(uAmbBot, uAmbTop, h);
        float a = 1.0 - Tstep;
        col += T * Ls * a;
        tw += T * a * t; tsum += T * a;
        T *= Tstep;
        t += dt;
      }
      float alpha = 1.0 - T;
      if (alpha < 0.002) { gl_FragColor = vec4(0.0); return; }
      // the aerial perspective and the mist at the cloud's transmittance-weighted mean distance
      float tm = tsum > 0.0 ? tw / tsum : t0;
      vec3 c = col / max(alpha, 1e-4);
      if (uAtmoAP.z > 0.5) { vec4 ap = apSample(d, tm * 0.001); c = c * ap.a + ap.rgb; c = mistApply(c * uScale, d, tm, o.y) / uScale; }
      gl_FragColor = vec4(c * uScale, alpha);
    }`;
  // ATMO's own GLSL: the AP atlas sample + the mist (the splice's functions, verbatim)
  const ATMO_GLSL = () => (typeof ATMO !== 'undefined' && ATMO.GLSL) ? ATMO.GLSL.AP + ATMO.GLSL.MIST : 'uniform vec4 uAtmoAP; vec4 apSample(vec3 d, float k) { return vec4(0.0, 0.0, 0.0, 1.0); } vec3 mistApply(vec3 c, vec3 d, float D, float y) { return c; }';
  // THE COMPOSITE: the march's radiance tone-mapped like the dome, alpha over the frame in display
  // space, through a depth-aware upsample - the four half texels round the pixel weighted by the
  // bilinear weight x the nearness of the depth they saw to the pixel's own (both logarithmic depths
  // turned back into distances), so the ridge keeps its edge; where no texel agrees, plain bilinear
  const COMP_FRAG = `varying vec2 vUv; uniform sampler2D uCloudTex, uKeyTex, uDepth; uniform vec2 uTexel; uniform float uUp, uLogFar, uDepthK;
    float dist(float dz) { return exp2(dz * uLogFar); }
    void main() {
      vec4 c;
      if (uUp < 0.5) c = texture2D(uCloudTex, vUv);
      else {
        // the 3x3 march texels round the pixel, each weighted by a tent on its distance x the nearness
        // of the depth it saw to this pixel's: the jitter's grain averages out, the ridge keeps its edge
        vec2 q = vUv / uTexel - 0.5, b = (floor(q) + 0.5) * uTexel, f = fract(q);
        float dm = dist(texture2D(uDepth, vUv).r);
        vec4 acc = vec4(0.0); float wsum = 0.0; vec4 lin = vec4(0.0); float lsum = 0.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j));
          vec2 uv = b + o * uTexel;
          vec2 dd = abs(o - f);                                         // texel centre to pixel, in texels
          float tw = max(0.0, 1.5 - dd.x) * max(0.0, 1.5 - dd.y);
          vec4 s = texture2D(uCloudTex, uv); s.rgb *= s.a;           // premultiplied: an empty texel must not darken its neighbour's colour
          float dk = texture2D(uKeyTex, uv).r * 1000.0;
          float w = tw / (0.02 + uDepthK * abs(dm - dk) / max(dm, dk));
          acc += s * w; wsum += w; lin += s * tw; lsum += tw;
        }
        c = wsum > 1e-4 ? acc / wsum : lin / max(lsum, 1e-4);
        c.rgb /= max(c.a, 1e-4);
      }
      if (uDepthK < -0.5) { gl_FragColor = vec4(c.aaa, 1.0); return; }   // a debug view: the alpha as grey
      if (c.a < 0.002) discard;
      gl_FragColor = vec4(c.rgb, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.a = c.a;
    }`;
  // THE SHADOW BAKE: the layer's transmittance straight down over the weather tile, uv = (xz + drift) / span
  const shadowFrag = () => `precision highp float; precision highp sampler3D;
    ${GLSL3_OUT}
    varying vec2 vUv; uniform vec2 uShadowK;   // steps, sigma gain
    ${DENSITY_GLSL}
    void main() {
      vec2 xz = vUv * uLayer.w - uSpanDrift.xy;
      float n = max(1.0, uShadowK.x), od = 0.0, dh = uLayer.y / n;
      vec4 w = weather(vec3(xz.x, 0.0, xz.y));
      if (w.x > 0.0) for (float k = 0.0; k < 32.0; k += 1.0) { if (k >= n) break; vec3 p = vec3(xz.x, uLayer.x + (k + 0.5) * dh, xz.y); od += density(p, w, true) * dh; }
      gl_FragColor = vec4(exp(-od * uLayer.z * uShadowK.y), 0.0, 0.0, 1.0);
    }`;
  // THE SPLICE (the shadow on every lit, fogged material): the world point from the fog varying
  // (vAtmoV, atmo.js's), projected along the sun to the layer's middle, the tile sampled there
  const shadowPars = () => `
    #ifdef USE_FOG
    #define CLOUD_SHADOW 1
    uniform vec4 uCloudP[3];
    float cloudShadow() {
      if (uCloudP[0].w < 0.5) return 1.0;
      vec3 L = uCloudP[1].xyz; if (L.y < 0.04) return 1.0;
      vec3 wp = cameraPosition + (vec4(vAtmoV, 0.0) * viewMatrix).xyz;
      vec2 xz = wp.xz + L.xz * ((uCloudP[1].w - wp.y) / L.y);
      vec2 tuv = (xz + uCloudP[0].xy) / uCloudP[0].z;
      float T = texture2D(uApAtlas, ${TILE_UV()}).r;
      return mix(1.0, T, uCloudP[2].x);
    }
    #endif`;
  const SHADOW_APPLY = `
    #ifdef CLOUD_SHADOW
    directLight.color *= cloudShadow();
    #endif`;
  let installed = false;
  function install() {
    if (installed || typeof THREE === 'undefined' || !THREE.ShaderChunk) return false;
    const SC = THREE.ShaderChunk, key = 'getDirectionalLightInfo( directionalLight, directLight );';
    if (!SC.lights_pars_begin || !SC.lights_fragment_begin || SC.lights_fragment_begin.indexOf(key) < 0) return false;
    SC.lights_pars_begin = (SC.lights_pars_begin || '') + '\n' + shadowPars();
    SC.lights_fragment_begin = SC.lights_fragment_begin.replace(key, key + SHADOW_APPLY);
    for (const k of ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'points', 'sprite']) {
      const lib = THREE.ShaderLib[k]; if (lib && lib.uniforms) lib.uniforms.uCloudP = cloudUniforms.uCloudP;
    }
    installed = true;
    return true;
  }
  // inject(shader): the shadow's scalars for a fogged program (called by ATMO.inject - the prototype hook and the explicit calls)
  function inject(sh) {
    if (!sh || !sh.uniforms || sh.uniforms.uCloudP) return;
    if (!/fog_pars_fragment|USE_FOG/.test(sh.fragmentShader || '')) return;
    sh.uniforms.uCloudP = cloudUniforms.uCloudP;
  }

  function init(r) {
    if (ready || !r || typeof THREE === 'undefined' || !THREE.WebGL3DRenderTarget) return ready;
    renderer = r;
    const mk3 = n => { const t = new THREE.WebGL3DRenderTarget(n, n, n, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, generateMipmaps: false, depthBuffer: false, stencilBuffer: false }); t.texture.wrapR = THREE.RepeatWrapping; return t; };
    noiseRT = mk3(NB); detailRT = mk3(ND);
    fsScene = new THREE.Scene(); fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false; fsScene.add(quad);
    bakeMat = new THREE.ShaderMaterial({ uniforms: { uBake: { value: new THREE.Vector3(0, NB, 0) } }, vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    U.uNoise.value = noiseRT.texture; U.uDetail.value = detailRT.texture;
    U.uInvProj.value = new THREE.Matrix4(); U.uCamMat.value = new THREE.Matrix4(); U.uCamPos.value = new THREE.Vector3(); U.uRes.value = new THREE.Vector2(1, 1);
    U.uLayer.value = new THREE.Vector4(1000, 1500, S.sigma, 40000); U.uProfile.value = new THREE.Vector4(0.08, 0.55, S.detail, S.curl);
    U.uSpanDrift.value = new THREE.Vector4(0, 0, S.period, S.detailPeriod); U.uSun.value = new THREE.Vector4(0, 1, 0, 0); U.uMoon.value = new THREE.Vector4(0, 1, 0, 0);
    U.uSunCol.value = new THREE.Vector3(1, 1, 1); U.uMoonCol.value = new THREE.Vector3(); U.uAmbTop.value = new THREE.Vector3(); U.uAmbBot.value = new THREE.Vector3();
    U.uSteps.value = new THREE.Vector2(S.steps, S.lightSteps); U.uDials.value = new THREE.Vector4(S.powder, S.g, S.ms, S.maxKm); U.uTexel.value = new THREE.Vector2();
    U.uShadowK.value = new THREE.Vector2(S.shadowSteps, 1); U.uDials2.value = new THREE.Vector4(S.jitter, 0, 0, 0);
    const uni = Object.assign({}, U);
    if (typeof ATMO !== 'undefined' && ATMO.apUniforms) { uni.uApAtlas = ATMO.apUniforms.uApAtlas; uni.uAtmoAP = ATMO.apUniforms.uAtmoAP; uni.uMist = ATMO.apUniforms.uMist; }
    else uni.uAtmoAP = { value: new Float32Array(4) };
    marchMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: QUAD_VERT, fragmentShader: marchFrag(), glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, toneMapped: false, transparent: false });
    compMat = new THREE.ShaderMaterial({ uniforms: { uCloudTex: U.uCloudTex, uKeyTex: U.uKeyTex, uDepth: U.uDepth, uTexel: U.uTexel, uUp: U.uUp, uLogFar: U.uLogFar, uDepthK: U.uDepthK }, vertexShader: QUAD_VERT, fragmentShader: COMP_FRAG, depthTest: false, depthWrite: false, transparent: true, toneMapped: true, blending: THREE.NormalBlending });
    shadowMat = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U), vertexShader: QUAD_VERT, fragmentShader: shadowFrag(), glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, toneMapped: false });
    shadowRT = (typeof ATMO !== 'undefined' && ATMO.G && ATMO.G.rtAP) ? ATMO.G.rtAP : null;   // the tile lives in the atlas (the flag stays off without it)
    // the GPU timer
    try { const gl = renderer.getContext(); timer.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); timer.gl = gl; } catch (e) { timer.ext = null; }
    ready = true;
    return true;
  }
  // ---- the GPU timer: one query round the pass, read back when it lands ----------
  const timer = { ext: null, gl: null, pending: [], on: true };
  function tBegin(tag) { if (!timer.ext || !timer.on) return null; const q = timer.gl.createQuery(); timer.gl.beginQuery(timer.ext.TIME_ELAPSED_EXT, q); return { q, tag }; }
  function tEnd(h) { if (!h) return; timer.gl.endQuery(timer.ext.TIME_ELAPSED_EXT); timer.pending.push(h); }
  function tPoll() {
    if (!timer.ext || !timer.pending.length) return;
    const gl = timer.gl, keep = [];
    for (const h of timer.pending) {
      if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(timer.ext.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; if (h.tag === 'shadow') { stats.shadowMs = stats.shadowMs * 0.8 + 0.2 * ms; stats.shadowLast = ms; } else if (h.tag === 'pass') { stats.gpuMs = stats.gpuMs * 0.8 + 0.2 * ms; stats.gpuLast = ms; } else stats[h.tag + 'Ms'] = (stats[h.tag + 'Ms'] || 0) * 0.8 + 0.2 * ms; }
        gl.deleteQuery(h.q);
      } else keep.push(h);
    }
    timer.pending = keep.length > 8 ? keep.slice(-8) : keep;
  }
  // a few noise slices a frame until both textures are whole (NB + 1 passes: the detail cube is one)
  function bakeStep() {
    if (bakeAt >= NB + 1) return true;
    const prev = renderer.getRenderTarget();
    quad.material = bakeMat;
    for (let k = 0; k < S.bakeSlices && bakeAt < NB + 1; k++) {
      if (bakeAt < NB) { bakeMat.uniforms.uBake.value.set((bakeAt + 0.5) / NB, NB, 0); renderer.setRenderTarget(noiseRT, bakeAt); renderer.render(fsScene, fsCam); bakeAt++; }
      else { for (let z = 0; z < ND; z++) { bakeMat.uniforms.uBake.value.set((z + 0.5) / ND, ND, 1); renderer.setRenderTarget(detailRT, z); renderer.render(fsScene, fsCam); } bakeAt++; }
    }
    renderer.setRenderTarget(prev);
    stats.slicesBaked = bakeAt;
    shadowDirty = true;
    return bakeAt >= NB + 1;
  }
  // the weather map as a texture, rebuilt when (seed, cover, type) change
  function mapFor(day) {
    const key = S.seed + '|' + (+day.cloudCover).toFixed(3) + '|' + day.cloudType;
    if (key === mapKey && map) return map;
    if (typeof CLOUD_FIELD === 'undefined') return null;
    map = CLOUD_FIELD.weatherMap({ seed: S.seed, cover: day.cloudCover, type: day.cloudType });
    mapKey = key;
    if (weatherTex) weatherTex.dispose();
    const u8 = new Uint8Array(map.data.length); for (let i = 0; i < u8.length; i++) u8[i] = Math.round(Math.max(0, Math.min(1, map.data[i])) * 255);
    weatherTex = new THREE.DataTexture(u8, map.N, map.N, THREE.RGBAFormat, THREE.UnsignedByteType);   // 8-bit: a float texture filters linearly only by extension
    weatherTex.wrapS = weatherTex.wrapT = THREE.RepeatWrapping; weatherTex.minFilter = weatherTex.magFilter = THREE.LinearFilter; weatherTex.needsUpdate = true;
    U.uWeather.value = weatherTex;
    stats.cover = CLOUD_FIELD.coverFraction(map);
    shadowDirty = true; needCal = true;
    return map;
  }
  // update(day, camera, world): every frame from the world's dayApply - the layer, the map, the light, the drift
  const _T = [0, 0, 0], _E = [0, 0, 0], _Em = [0, 0, 0], _Eg = [0, 0, 0];
  const _cc = (typeof THREE !== 'undefined' && THREE.Color) ? new THREE.Color() : null;
  const _vp = (typeof THREE !== 'undefined' && THREE.Vector4) ? new THREE.Vector4() : null, _sc = _vp ? new THREE.Vector4() : null;
  let sunEl = 0;
  function update(day, camera, world) {
    if (!ready || !day) return;
    dayRef = day;
    if (!mapFor(day)) return;
    const prevLay = lay;
    lay = CLOUD_FIELD.layer(day, { base: S.base > 0 ? S.base : null, thick: S.thick > 0 ? S.thick : null });
    if (!prevLay || prevLay.base !== lay.base || prevLay.thick !== lay.thick || prevLay.type !== lay.type) { shadowDirty = true; needCal = true; }
    const T = CLOUD_FIELD.TYPES[lay.type];
    U.uLayer.value.set(lay.base, lay.thick, S.sigma, map.span);
    U.uProfile.value.set(T.bot, T.top, S.detail, S.curl);
    // the drift: the wind at the layer x the clock (the day's own seconds - deterministic on the clock)
    let wx = 3, wz = 1;
    if (world && typeof world.wind === 'function') { const w = world.wind(0, lay.base, 0, 0); if (w) { wx = w[0] * 1.5; wz = w[2] * 1.5; } }
    const secs = (day.jd != null ? (day.jd - 2461000) * 86400 : (day.utc || 0));
    drift[0] = wx * secs * S.driftK; drift[1] = wz * secs * S.driftK;
    U.uSpanDrift.value.set(drift[0], drift[1], S.period, S.detailPeriod);
    // the light: the sun's transmittance at the layer's middle, the sky's irradiance at its top, the ground's light below
    const midKm = (lay.base + lay.thick * 0.5) / 1000, topKm = lay.top / 1000;
    const sun = day.sun, moon = day.moon, A = (typeof ATMO !== 'undefined') ? ATMO : null;
    sunEl = sun[1];
    U.uSun.value.set(sun[0], sun[1], sun[2], 0);
    if (A) {
      A.sunTransmittance(midKm, sun[1], _T); A.skyIrradiance(topKm, sun, _E);
      const sy = Math.max(0, sun[1]);
      U.uSunCol.value.set(_T[0] * S.sunK, _T[1] * S.sunK, _T[2] * S.sunK);
      const mE = A.U.eMoon.value;
      if (mE > 0 && moon[1] > 0) { A.sunTransmittance(midKm, moon[1], _Em); U.uMoonCol.value.set(_Em[0] * mE, _Em[1] * mE, _Em[2] * mE); U.uMoon.value.set(moon[0], moon[1], moon[2], 1); A.skyIrradiance(topKm, moon, _Eg); }
      else { U.uMoon.value.set(moon[0], moon[1], moon[2], 0); _Eg[0] = _Eg[1] = _Eg[2] = 0; }
      // ambient: the sky's radiance (E/pi) at the top; below, half the sky's (the sides see it) + the ground's reflected light
      const alb = day.groundAlbedo != null ? day.groundAlbedo : 0.15, k = S.ambK / Math.PI;
      const gnd = i => alb * (_T[i] * sy + _E[i]) * 0.5;
      U.uAmbTop.value.set((_E[0] + _Eg[0] * mE) * k, (_E[1] + _Eg[1] * mE) * k, (_E[2] + _Eg[2] * mE) * k);
      U.uAmbBot.value.set((0.5 * _E[0] + gnd(0)) * k, (0.5 * _E[1] + gnd(1)) * k, (0.5 * _E[2] + gnd(2)) * k);
      U.uScale.value = A.U.scale.value;
    } else { U.uSunCol.value.set(1, 1, 1); U.uAmbTop.value.set(0.2, 0.25, 0.35); U.uAmbBot.value.set(0.1, 0.1, 0.1); }
    U.uSteps.value.set(S.steps, S.lightSteps); U.uDials.value.set(S.powder, S.g, S.ms, S.maxKm); U.uDials2.value.set(S.jitter, 0, 0, 0);
    lastCover = day.cloudCover;
    // the shadow's scalars: on only when the layer is live and baked (the tile sampler reads white until then)
    const on = active() && bakeAt >= NB + 1 && S.shadow > 0 && !shadowDirty ? 1 : 0;
    const fade = Math.max(0, Math.min(1, (sun[1] - 0.02) / 0.13));
    cloudScalars[0] = drift[0]; cloudScalars[1] = drift[1]; cloudScalars[2] = map.span; cloudScalars[3] = on;
    cloudScalars[4] = sun[0]; cloudScalars[5] = sun[1]; cloudScalars[6] = sun[2]; cloudScalars[7] = lay.base + lay.thick * 0.5;
    cloudScalars[8] = S.shadow * fade; cloudScalars[9] = 0; cloudScalars[10] = 0; cloudScalars[11] = 0;
  }
  const active = () => ready && S.mode !== 'off' && !!dayRef && lastCover > 0.003 && !!map;
  // the shadow tile: re-baked when the map, the layer or the noise changed, or the drift moved (every S.shadowEvery frames)
  function bakeShadow(r) {
    const moved = Math.abs(drift[0] - shadowDrift[0]) + Math.abs(drift[1] - shadowDrift[1]) > 0.5;
    if (!shadowDirty && !(moved && (frame % Math.max(1, S.shadowEvery)) === 0)) return;
    if (!shadowRT) return;
    const h = tBegin('shadow'), a = AT();
    U.uShadowK.value.set(S.shadowSteps, S.shadowSoft);   // the softness: the light that scatters through and round a cloud (a sigma gain < 1)
    const prev = r.getRenderTarget(), ac = r.autoClear;
    r.getViewport(_vp); r.getScissor(_sc); const st = r.getScissorTest();
    r.setRenderTarget(shadowRT); r.setViewport(0, a.TILE_Y, a.TILE, a.TILE); r.setScissor(0, a.TILE_Y, a.TILE, a.TILE); r.setScissorTest(true); r.autoClear = false;
    quad.material = shadowMat; r.render(fsScene, fsCam);
    r.setScissorTest(st); r.setViewport(_vp); r.setScissor(_sc); r.autoClear = ac;
    r.setRenderTarget(prev);
    tEnd(h);
    shadowDrift[0] = drift[0]; shadowDrift[1] = drift[1]; shadowDirty = false;
    if (needCal) calibrateColumn(r);
  }
  // THE COLUMN CALIBRATED: the CPU column (coverage x the profile's fill x height x sigma) is the
  // field without its noise - it overstates the optical depth ~7x (the noise empties most of a
  // column). Once per map, the GPU tile is read back and columnK fitted so the CPU's mean
  // transmittance over the tile equals the GPU's; sunT (the flare's dimmer) then agrees with the
  // shadow the ground shows.
  let needCal = true;
  function calibrateColumn(r) {
    needCal = false;
    try {
      const gpuMean = tileMean(r);
      if (!(gpuMean >= 0)) return;
      const ods = []; for (let j = 0; j < 48; j++) for (let i = 0; i < 48; i++) ods.push(CLOUD_FIELD.columnOD(map, (i + 0.5) / 48 * map.span - drift[0], (j + 0.5) / 48 * map.span - drift[1], lay, S.sigma, drift));
      const meanT = k => { let t = 0; for (const od of ods) t += Math.exp(-k * od); return t / ods.length; };
      let lo = 0.001, hi = 4;
      for (let it = 0; it < 40; it++) { const mid = 0.5 * (lo + hi); if (meanT(mid) > gpuMean) lo = mid; else hi = mid; }
      S.columnK = 0.5 * (lo + hi); stats.calGpuMean = gpuMean; stats.calCpuMean = meanT(S.columnK);
    } catch (e) { /* a readback that fails leaves the default */ }
  }
  // draw(renderer, camera, target): the aa overlay - the march at its resolution, then the composite over the target
  function draw(r, camera, target) {
    if (!active() || !target || !target.depthTexture) return;
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    if (!bakeStep()) return;
    frame++;
    tPoll();
    bakeShadow(r);
    const k = S.mode === 'full' ? 1 : 0.5;
    const w = Math.max(8, Math.round(target.width * k)), h = Math.max(8, Math.round(target.height * k));
    if (!rt || rtW !== w || rtH !== h) {
      if (rt) rt.dispose();
      rt = new THREE.WebGLRenderTarget(w, h, { count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
      rtW = w; rtH = h; U.uCloudTex.value = rt.textures[0]; U.uKeyTex.value = rt.textures[1]; U.uTexel.value.set(1 / w, 1 / h);
    }
    U.uDepth.value = target.depthTexture;
    U.uInvProj.value.copy(camera.projectionMatrixInverse);
    U.uCamMat.value.copy(camera.matrixWorld);
    U.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    U.uRes.value.set(w, h); U.uFrame.value = S.shimmer ? (frame % 64) : 0;
    U.uLogFar.value = Math.log2(camera.far + 1);
    U.uUp.value = (S.upsample && k < 1) ? 1 : 0; U.uDepthK.value = S.depthK;
    r.getClearColor(_cc); const prevCA = r.getClearAlpha();
    let q = tBegin('bind'); r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(true, false, false); tEnd(q);
    q = tBegin('pass'); quad.material = marchMat; r.render(fsScene, fsCam); tEnd(q);
    r.setRenderTarget(target); r.setClearColor(_cc, prevCA);
    marched = true;
    if (t0) stats.ms = stats.ms * 0.9 + 0.1 * ((performance.now()) - t0);
  }
  // composite(renderer): the aa post hook - the march's frame over the RESOLVED frame (the canvas, or
  // whatever the resolve wrote): a second fullscreen draw into the multisampled target would cost a
  // second resolve (7 ms measured); here it is a tenth of a millisecond
  let marched = false;
  function composite(r) {
    if (!marched || !rt) return;
    marched = false;
    const q = tBegin('comp');
    const prevAC = r.autoClear; r.autoClear = false;
    quad.material = compMat; r.render(fsScene, fsCam);
    r.autoClear = prevAC;
    tEnd(q);
  }
  // sunT(x, y, z): the layer's transmittance toward the sun from a world point (the CPU column, the flare's dimmer)
  function sunT(x, y, z) {
    if (!active() || !lay || !map || sunEl < 0.04 || S.shadow <= 0) return 1;
    const ymid = lay.base + lay.thick * 0.5, s = dayRef.sun, k = (ymid - y) / s[1];
    if (k < 0) return 1;
    const od = CLOUD_FIELD.columnOD(map, x + s[0] * k, z + s[2] * k, lay, S.sigma, drift);
    return Math.exp(-od * S.columnK);
  }
  // probe(): what the pass sees - the march target's mean alpha, a noise slice's mean, the depth at the centre, the shadow tile
  let probeMat = null, probeRT = null;
  const PROBE_N = 64;
  function probeMats() {
    if (probeMat) return;
    probeMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uNoise: U.uNoise, uDetail: U.uDetail, uWeather: U.uWeather, uDepth: U.uDepth, uShadow: { value: null }, uWhat: { value: 0 } },
      vertexShader: QUAD_VERT, fragmentShader: `precision highp float; precision highp sampler3D; ${GLSL3_OUT}
        varying vec2 vUv; uniform sampler3D uNoise, uDetail; uniform sampler2D uWeather, uDepth, uShadow; uniform float uWhat;
        void main() { vec2 tuv = vUv; if (uWhat < 0.5) gl_FragColor = texture(uNoise, vec3(vUv, 0.5)); else if (uWhat < 1.5) gl_FragColor = texture(uDetail, vec3(vUv, 0.5)); else if (uWhat < 2.5) gl_FragColor = texture(uWeather, vUv); else if (uWhat < 3.5) gl_FragColor = vec4(texture(uDepth, vUv).r, 0.0, 0.0, 1.0); else gl_FragColor = texture(uShadow, ${TILE_UV()}); }`,
      depthTest: false, depthWrite: false, toneMapped: false });
    probeRT = new THREE.WebGLRenderTarget(PROBE_N, PROBE_N, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  }
  function probeRead(r, what, px) {
    probeMats();
    probeMat.uniforms.uWhat.value = what; probeMat.uniforms.uShadow.value = shadowRT ? shadowRT.texture : null; quad.material = probeMat;
    const prev = r.getRenderTarget();
    r.setRenderTarget(probeRT); r.render(fsScene, fsCam); r.readRenderTargetPixels(probeRT, 0, 0, PROBE_N, PROBE_N, px);
    r.setRenderTarget(prev);
  }
  // the tile's mean transmittance, read through the probe (the atlas is half float; the probe target is float)
  function tileMean(r) {
    const px = new Float32Array(4 * PROBE_N * PROBE_N); probeRead(r, 4, px);
    let s = 0; for (let i = 0; i < PROBE_N * PROBE_N; i++) s += px[i * 4]; return s / (PROBE_N * PROBE_N);
  }
  function probe() {
    if (!ready || !renderer) return null;
    const out = {};
    if (rt) { const px = new Uint16Array(4 * 16 * 16); renderer.readRenderTargetPixels(rt, (rtW >> 1) - 8, (rtH >> 1) - 8, 16, 16, px);
      let a = 0, c = 0; for (let i = 0; i < 256; i++) { a += px[i * 4 + 3]; c += px[i * 4]; } out.marchA = a / 256; out.marchR = c / 256; }
    const px = new Float32Array(4 * PROBE_N * PROBE_N);
    for (const [k, w] of [['noise', 0], ['detail', 1], ['weather', 2], ['depth', 3], ['shadow', 4]]) {
      probeRead(renderer, w, px);
      const m = [0, 0, 0, 0]; let mn = 1e9; for (let i = 0; i < PROBE_N * PROBE_N; i++) { for (let c = 0; c < 4; c++) m[c] += px[i * 4 + c] / (PROBE_N * PROBE_N); if (px[i * 4] < mn) mn = px[i * 4]; }
      out[k] = m.map(v => +v.toFixed(4)); if (k === 'shadow') out.shadowMin = +mn.toFixed(4);
    }
    out.scalars = Array.from(cloudScalars).map(v => +v.toFixed(3));
    return out;
  }
  const API = { S, init, install, inject, update, draw, composite, bakeStep, probe, sunT, rt: () => rt, get active() { return active(); }, get ready() { return ready; }, get layer() { return lay; }, get map() { return map; }, stats, get baked() { return bakeAt >= NB + 1; }, get installed() { return installed; } };
  if (typeof window !== 'undefined') { window.CLOUDS = API; API.install(); }   // BEFORE any program compiles, like ATMO.install
  return API;
})();
