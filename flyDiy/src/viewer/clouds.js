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
  const S = { mode: 'half', steps: 48, lightSteps: 5, sigma: 0.08, seed: 7, base: 0, thick: 0, driftK: 1, powder: 0.6, ambK: 1, sunK: 1,   // period 0 = the type's (A6)
              detail: 0.55, g: 0.75, period: 0, detailPeriod: 700, ms: 0.5, bakeSlices: 6, maxKm: 60, curl: 0.3,
              shadow: 0.8, shadowSoft: 0.6, shadowSteps: 12, shadowEvery: 2, upsample: 1, shimmer: 0, columnK: 0.15, jitter: 0.6, depthK: 1, probeMoveM: 400, hemiUnderCloud: 0.7, inShed: false, veil: 1, veilKm: 9, inCloud: 1,
              erodeK: 1, covGain: 1, calCover: 1, ambDepth: 0.12 };
  const NB = 128, ND = 64;                 // the base and detail noise sides (the shadow tile's side is ATMO.AP.TILE)
  let renderer = null, ready = false, noiseRT = null, detailRT = null, bakeAt = 0, bakeMat = null, fsScene = null, fsCam = null, quad = null;
  let map = null, mapKey = '', weatherTex = null, rt = null, rtPool = null, rtW = 0, rtH = 0, marchMat = null, compMat = null, compMesh = null, frame = 0;
  let maps = [], lays = [];                // the decks (A6): one weather map and one layer per deck; map / lay stay the first's
  let shadowRT = null, shadowMat = null, shadowDirty = true, shadowDrift = [1e9, 1e9];
  let lay = null, dayRef = null, lastCover = 0, stats = { ms: 0, gpuMs: 0, shadowMs: 0, slicesBaked: 0, cover: 0 };
  const drift = [0, 0];
  const U = {
    uNoise: { value: null }, uDetail: { value: null }, uWeather: { value: null }, uDepth: { value: null },
    uInvProj: { value: null }, uCamMat: { value: null }, uCamPos: { value: null }, uRes: { value: null },
    uLogFar: { value: 1 }, uDZ: { value: null }, uGlob: { value: null }, uLayerA: { value: new Float32Array(12) }, uProfA: { value: new Float32Array(12) }, uDriftA: { value: new Float32Array(12) },
    uSun: { value: null }, uSunCol: { value: null }, uMoon: { value: null }, uMoonCol: { value: null },
    uAmbTop: { value: null }, uAmbBot: { value: null }, uScale: { value: 1 }, uSteps: { value: null }, uFrame: { value: 0 },
    uDials: { value: null }, uCloudTex: { value: null }, uKeyTex: { value: null }, uTexel: { value: null }, uUp: { value: 1 },
    uShadowK: { value: null }, uDials2: { value: null }, uDepthK: { value: 1 }, uEye: { value: null }, uShape: { value: null },
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
      // THE SLAB (A6, 2026-09-20): as first baked, the Perlin-Worley sat at p5 0.63 / p95 0.85 (a CPU port of this
      // text, then the probe's percentiles: the same numbers), and the density's erosion lifted that to 0.75-0.89 -
      // ABOVE the coverage threshold (1 - cov) of every column past a quarter cover, so the noise carved nothing:
      // a cloud was its weather texel extruded between the profile's base and cap, a flat-topped slab with
      // straight edges (the user: "blocky shapes, clear bands"). Every octave is stretched to the byte by its
      // measured p2/p98 (perlin fbm 0.366-0.579, worley fbm 0.258-0.720, the dilated pair 0.274-1.0) so the
      // 8-bit texture carries a full-contrast field with its median near a half; the density's erosion SUBTRACTS
      // the worley fbm (uShape.x) instead of remapping from lf - 1, which could only raise the floor.
      if (uBake.z < 0.5) {
        float pf = remap(perlinFbm(p, 4.0), 0.366, 0.579, 0.0, 1.0), w4 = remap(worleyFbm(p, 4.0), 0.258, 0.720, 0.0, 1.0);
        float pw = remap(remap(pf, 0.0, 1.0, w4, 1.0), 0.274, 1.0, 0.0, 1.0);   // Perlin-Worley: the Worley fills the Perlin's lows
        gl_FragColor = vec4(pw, remap(worleyFbm(p, 8.0), 0.258, 0.720, 0.0, 1.0), remap(worleyFbm(p, 16.0), 0.258, 0.720, 0.0, 1.0), remap(worleyFbm(p, 32.0), 0.258, 0.720, 0.0, 1.0));
      } else gl_FragColor = vec4(remap(worleyFbm(p, 2.0), 0.258, 0.720, 0.0, 1.0), remap(worleyFbm(p, 4.0), 0.258, 0.720, 0.0, 1.0), remap(worleyFbm(p, 8.0), 0.258, 0.720, 0.0, 1.0), 1.0);
    }`;

  // ---- THE DENSITY, one text for the march and the shadow --------------------
  // GLSL3 (sampler3D): three defines varying/texture2D for us but NOT gl_FragColor - the out is ours
  const GLSL3_OUT = `layout(location = 0) out highp vec4 outC;
    #define gl_FragColor outC`;
  // SEVERAL DECKS (A6, 2026-09-20): every per-layer number is an array of MAXL, the weather maps a 2D array
  // texture (one slice a deck: a sampler array cannot be indexed by a loop counter in ESSL 3.00, a slice can),
  // and density() takes the deck's index. The globals (sigma, the span, the detail period) are one vec4.
  const MAXL = 3;
  const DENSITY_GLSL = `
    #define MAXL ${MAXL}
    uniform sampler3D uNoise, uDetail; uniform sampler2DArray uWeather;
    uniform vec4 uGlob;             // sigma (/m at full density), the map's span (m), detail period (m), the deck count
    uniform vec4 uLayerA[MAXL];     // per deck: base (m), thickness (m), on (1 / 0), the base noise's period (m)
    uniform vec4 uProfA[MAXL];      // per deck: bot, top, erode (the worley fbm's share subtracted from the base), coverage gain
    uniform vec4 uDriftA[MAXL];     // per deck: drift x, drift z (m, the wind at the deck x the clock), 0, 0
    uniform vec4 uShape;            // detail strength, curl, 0, 0
    float remap(float v, float a, float b, float c, float d) { return c + (clamp((v - a) / (b - a), 0.0, 1.0)) * (d - c); }
    // the profile: 08_cloud_field.js profile(), the same shape (h the fraction of the layer, hs the column's top)
    float profile(int li, float h, float hs) { if (h <= 0.0 || h >= hs) return 0.0; return smoothstep(0.0, uProfA[li].x, h) * (1.0 - smoothstep(uProfA[li].y * hs, hs, h)); }
    vec4 weather(int li, vec3 p) { return texture(uWeather, vec3((p.xz + uDriftA[li].xy) / uGlob.y, float(li))); }
    // density at p in deck li (0..1 x coverage); cheap = no detail (the light march, the shadow)
    float density(int li, vec3 p, vec4 w, bool cheap) {
      float h = (p.y - uLayerA[li].x) / uLayerA[li].y - 0.12 * (w.z - 0.5);   // the base wobbles a twelfth of the deck with the map's lumpiness: one condensation level, not one plane
      float prof = profile(li, h, w.y);
      if (prof <= 0.0 || w.x <= 0.0) return 0.0;
      vec3 q = (p + vec3(uDriftA[li].x, 0.0, uDriftA[li].y)) / uLayerA[li].w;
      vec4 n = texture(uNoise, q);
      float lf = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
      float base = remap(n.r, lf * uProfA[li].z, 1.0, 0.0, 1.0) * prof;   // the worley fbm erodes (subtracts), see the bake's note
      float cov = w.x * mix(0.85, 1.0, w.z) * uProfA[li].w;
      base = remap(base, 1.0 - cov, 1.0, 0.0, 1.0) * min(cov, 1.0);
      if (cheap || base <= 0.0 || uShape.x <= 0.0) return base;
      vec3 qd = (p + vec3(uDriftA[li].x, 0.0, uDriftA[li].y)) / uGlob.z;
      qd.xz += uShape.y * vec2(n.b - 0.5, n.a - 0.5) * 2.0;   // a curl the base noise lends the wisps
      vec3 dn = texture(uDetail, qd).rgb;
      float hf = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
      hf = mix(hf, 1.0 - hf, clamp(h * 8.0, 0.0, 1.0));           // wispy at the bottom, billowy above
      return remap(base, hf * uShape.x, 1.0, 0.0, 1.0);
    }`;

  // ---- the march --------------------------------------------------------------
  const QUAD_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const MARCH_GLSL = () => `
    uniform vec4 uSun, uMoon;   // direction xyz, w: the moon lit?
    uniform vec3 uSunCol, uMoonCol, uAmbTop, uAmbBot;   // sun units
    uniform float uScale, uFrame; uniform vec2 uSteps; uniform vec4 uDials, uDials2;   // dials: powder, g, ms decay, maxKm | jitter, the upper decks' shadow softness, the ambient's depth fall-off, 0
    ${DENSITY_GLSL}
    ${ATMO_GLSL()}
    float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.5663706 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
    float phase(float c, float g) { return 0.7 * hg(c, g) + 0.3 * hg(c, -0.3 * g); }
    // the light march: optical depth toward the sun from p, within deck li (its self-shadow)
    float lightOD(int li, vec3 p, vec3 L) {
      float od = 0.0, t = 0.0, ds = uLayerA[li].y / (uSteps.y * 1.6);
      for (float i = 0.0; i < 8.0; i += 1.0) {
        if (i >= uSteps.y) break;
        t += ds * (0.5 + i);                                       // steps that lengthen with distance
        vec3 q = p + L * t;
        if (q.y > uLayerA[li].x + uLayerA[li].y * 1.05 || q.y < uLayerA[li].x - 20.0) break;
        od += density(li, q, weather(li, q), true) * ds * (0.5 + i);
      }
      return od * uGlob.x;
    }
    // the decks ABOVE li along the light (A6): three cheap steps through each - the deck below stands in the
    // upper deck's shadow; asked once per deck segment per pixel, not per step (a deck's shadow varies slowly
    // over a cloud below it)
    float upperOD(int li, vec3 p, vec3 L) {
      if (L.y < 0.05) return 0.0;
      float od = 0.0;
      for (int j = 0; j < MAXL; j++) {
        if (j == li || uLayerA[j].z < 0.5 || uLayerA[j].x <= uLayerA[li].x) continue;
        float ta = (uLayerA[j].x - p.y) / L.y, ds = uLayerA[j].y / (3.0 * L.y);
        for (int k = 0; k < 3; k++) { vec3 q = p + L * (ta + (float(k) + 0.5) * ds); od += density(j, q, weather(j, q), true) * ds; }
      }
      return od * uGlob.x;
    }
    // the multi-scatter octaves (Wrenninge): sum a^i exp(-od b^i) phase(g c^i), a = b = c = decay
    vec3 sunLight(float od, float cosT, float rho, float dt) {
      float a = 1.0, s = 0.0, k = uDials.z;
      for (int i = 0; i < 3; i++) { s += a * exp(-od * a) * phase(cosT, uDials.y * a); a *= k; }
      float powder = mix(1.0, 1.0 - exp(-2.0 * rho * uGlob.x * dt * 4.0), uDials.x * (0.5 - 0.5 * cosT));   // darker cores away from the sun
      return uSunCol * s * powder;
    }
    // march(o, d, tScene, jitterK): the decks along the ray from o - (radiance / alpha, alpha), or alpha 0.
    // SEVERAL DECKS (A6): each live deck's slab is cut by the ray into a segment [t0, t1]; the segments are
    // walked in the order of their entry (the decks never overlap in height, so along a ray they never
    // interleave), the transmittance carried from one to the next, the step budget shared.
    vec4 march(vec3 o, vec3 d, float tScene, float jitterK) {
      float tMax = min(tScene, uDials.w * 1000.0);
      float s0[MAXL], s1[MAXL]; int ord[MAXL]; int n = 0;
      for (int li = 0; li < MAXL; li++) {
        if (uLayerA[li].z < 0.5) continue;
        float yb = uLayerA[li].x, yt = yb + uLayerA[li].y, t0, t1;
        if (abs(d.y) < 1e-5) { if (o.y < yb || o.y > yt) continue; t0 = 0.0; t1 = tMax; }
        else { float ta = (yb - o.y) / d.y, tb = (yt - o.y) / d.y; t0 = max(0.0, min(ta, tb)); t1 = max(ta, tb); if (t1 <= 0.0) continue; }
        t1 = min(t1, tMax);
        if (t1 <= t0) continue;
        // insertion by the entry distance
        int k = n;
        for (; k > 0; k--) { if (s0[k - 1] <= t0) break; s0[k] = s0[k - 1]; s1[k] = s1[k - 1]; ord[k] = ord[k - 1]; }
        s0[k] = t0; s1[k] = t1; ord[k] = li; n++;
      }
      if (n == 0) return vec4(0.0);
      vec3 col = vec3(0.0); float T = 1.0, tw = 0.0, tsum = 0.0;
      vec3 L = uSun.xyz; float cosT = dot(d, L), cosM = dot(d, uMoon.xyz);
      float N = uSteps.x, budget = N * 4.0 + 64.0, used = 0.0;   // the step budget, shared by the decks
      // a jitter per PIXEL (interleaved gradient noise) breaks the banding; per frame it would shimmer
      // (no history averages it yet - the temporal pass is owed), so uFrame scales it to nothing by default
      float j = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y) + uFrame * 0.618034);
      for (int s = 0; s < MAXL; s++) {
        if (s >= n || T < 0.01) break;
        int li = ord[s]; float t0 = s0[s], t1 = s1[s];
        // THE STEP: N steps over the slab when the path is short; a floor and a ceiling on the step so a
        // grazing path (tens of km through the layer) is marched at a length that resolves a cloud, then
        // 0.4 % of the distance (a far cloud is small on screen; 4N steps reach the horizon); empty air is crossed in strides -
        // three steps where the weather map is clear, one and a half where the column is but the noise
        // is not - and the march stops when the light is gone (T < 1 %) or the path ends
        float dt0 = clamp((t1 - t0) / N, 24.0, 60.0);
        float t = t0 + dt0 * j * jitterK * smoothstep(8000.0, 1500.0, t0);   // the jitter's amplitude (a dial: grain against banding) - near only: far, the fine steps need none and the grain read as blocks
        float upOD = -1.0;                                          // the decks above, asked at the first dense step
        for (int i = 0; i < 320; i++) {
          if (used >= budget || T < 0.01 || t > t1) break;
          used += 1.0;
          float dt = max(dt0, t * 0.004);                          // never finer than ~an eighth of a pixel's footprint: a far cloud is small
          vec3 p = o + d * t;
          vec4 w = weather(li, p);
          if (w.x <= 0.0) { t += dt * 3.0; continue; }
          float rho = density(li, p, w, false);
          if (rho <= 0.0) { t += dt * 1.5; continue; }
          if (upOD < 0.0) upOD = upperOD(li, p, L) * uDials2.y;   // softened like the ground's tile: the light that scatters through and round the deck above
          float h = clamp((p.y - uLayerA[li].x) / uLayerA[li].y, 0.0, 1.0);
          float Tstep = exp(-rho * uGlob.x * dt);
          vec3 Ls = vec3(0.0); float odS = 0.0;
          if (uSun.y > -0.1) { odS = lightOD(li, p, L); Ls += sunLight(odS + upOD, cosT, rho, dt); }
          if (uMoon.w > 0.0) Ls += uMoonCol * exp(-lightOD(li, p, uMoon.xyz)) * phase(cosM, uDials.y);
          // the sky's light: dimmed under a deck above (to half at most - the sides see round it), and inside the
          // cloud by the depth toward the sun (the sun's march, a proxy for the depth under the top: a core is
          // darker than a fringe - the flat grey underside had no such gradation), never below a third
          Ls += mix(uAmbBot, uAmbTop, h) * (0.5 + 0.5 * exp(-upOD)) * (0.35 + 0.65 * exp(-odS * uDials2.z));
          float a = 1.0 - Tstep;
          col += T * Ls * a;
          tw += T * a * t; tsum += T * a;
          T *= Tstep;
          t += dt;
        }
      }
      float alpha = 1.0 - T;
      if (alpha < 0.002) return vec4(0.0);
      // the aerial perspective and the mist at the cloud's transmittance-weighted mean distance
      float tm = tsum > 0.0 ? tw / tsum : s0[0];
      vec3 c = col / max(alpha, 1e-4);
      if (uAtmoAP.z > 0.5) { vec4 ap = apSample(d, tm * 0.001); c = c * ap.a + ap.rgb; c = mistApply(c * uScale, d, tm, o.y) / uScale; }
      return vec4(c * uScale, alpha);
    }`;
  // the fullscreen march: the ray from the inverse projection, the scene's depth from the resolve target
  // THE SCENE'S DEPTH, EITHER CONVENTION (PERF 2026-09-23, app.js): the renderer's buffer is REVERSED
  // float (1 at the near plane, 0 at the far; w = n f / (d (f - n) + n)) where EXT_clip_control is,
  // else logarithmic (w = (far + 1)^d - 1). uDZ = (1 when reversed, near, far); the three reads below
  // are the only places the clouds touch the convention.
  const DZ_GLSL = `uniform vec3 uDZ;
    float dzW1(float dz) { return uDZ.x > 0.5 ? uDZ.y * uDZ.z / (dz * (uDZ.z - uDZ.y) + uDZ.y) + 1.0 : exp2(dz * uLogFar); }   // 1 + the view-axis distance
    bool dzSky(float dz) { return uDZ.x > 0.5 ? dz <= 0.0 : dz >= 0.99999; }
    float wDz(float w) { return uDZ.x > 0.5 ? uDZ.y * (uDZ.z - w) / (max(w, uDZ.y) * (uDZ.z - uDZ.y)) : log2(1.0 + w) / uLogFar; }`;
  const marchFrag = () => `precision highp float; precision highp sampler3D; precision highp sampler2DArray;
    ${GLSL3_OUT}
    layout(location = 1) out highp vec4 outK;
    varying vec2 vUv;
    uniform sampler2D uDepth;
    uniform mat4 uInvProj, uCamMat; uniform vec3 uCamPos; uniform vec2 uRes; uniform float uLogFar;
    ${DZ_GLSL}
    ${MARCH_GLSL()}
    void main() {
      vec2 ndc = vUv * 2.0 - 1.0;
      vec4 v = uInvProj * vec4(ndc, 1.0, 1.0); vec3 dv = normalize(v.xyz / v.w);
      vec3 d = normalize(mat3(uCamMat) * dv), o = uCamPos;
      // the scene's depth (logarithmic: w = (far + 1)^depth - 1, the clip w = the view depth)
      float dz = texture(uDepth, vUv).r;
      outK = vec4(dzW1(dz) * 0.001, 0.0, 0.0, 1.0);    // the distance (km) this texel saw, for the upsample - a half float holds a distance to 0.1 %, a log depth only to 2 %
      float tScene = dzSky(dz) ? 1e9 : (dzW1(dz) - 1.0) / max(1e-4, -dv.z);
      gl_FragColor = march(o, d, tScene, uDials2.x);
    }`;
  // THE DOME MARCH (C3): the same layer on a sphere round the eye - for the reflection probe (the
  // water and the skin reflect the clouds) and the shed's backdrop (one sky) - no scene depth, the
  // eye a uniform (the craft's place in the world; the shed stands at the field), a frame yaw like the
  // dome's, fewer steps (a probe texel is coarse), blended over the dome in linear radiance
  const DOME_VERT = `varying vec3 vD; void main(){ vD = (modelMatrix * vec4(position,1.0)).xyz - cameraPosition; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const domeFrag = () => `precision highp float; precision highp sampler3D; precision highp sampler2DArray;
    ${GLSL3_OUT}
    varying vec3 vD; uniform vec3 uEye;
    ${MARCH_GLSL()}
    void main() {
      vec3 d = normalize(vD);
      { float c = cos(uFrame), s = sin(uFrame); d = vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c); }   // into the world's frame
      vec4 m = march(uEye, d, 1e9, 0.0);
      if (m.a < 0.002) discard;
      gl_FragColor = m;
    }`;
  // THE SKY FRACTION (A6): the share of the celestial dome a deck covers as an observer on the ground sees
  // it - the cover a METAR reports (a 4/8 cumulus sky is half cloud to the eye, sides included, though its
  // shadow takes a third of the ground). Four eyes across the tile, each a 64 x 32 lat-long hemisphere
  // (azimuth along u, elevation along v), the decks marched from 2 m up, the alpha written; read back and
  // weighted by solid angle. The cover fit bisects each deck's coverage gain onto it.
  const SKY_W = 64, SKY_H = 32, SKY_EYES = 4;
  const skyFrag = () => `precision highp float; precision highp sampler3D; precision highp sampler2DArray;
    ${GLSL3_OUT}
    varying vec2 vUv; uniform vec4 uSkyEye;   // the tile's span, the ground height, 0, 0
    ${MARCH_GLSL()}
    void main() {
      float eye = floor(vUv.y * ${SKY_EYES}.0), v = fract(vUv.y * ${SKY_EYES}.0);
      float az = vUv.x * 6.2831853, el = v * 1.5707963;
      vec3 d = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
      vec2 q = (vec2(mod(eye, 2.0), floor(eye * 0.5)) * 0.5 + 0.25) * uSkyEye.x - uDriftA[0].xy;
      vec4 m = march(vec3(q.x, uSkyEye.y + 2.0, q.y), d, 1e9, 0.0);
      gl_FragColor = vec4(m.a, 0.0, 0.0, 1.0);
    }`;
  let skyMat = null, skyRT = null;
  // skyFraction(r): the solid-angle-weighted share of the four hemispheres with alpha over a half
  function skyMats() {
    if (skyMat) return;
    const uni = Object.assign({}, U, { uSkyEye: { value: new THREE.Vector4(40000, 0, 0, 0) } });
    if (typeof ATMO !== 'undefined' && ATMO.apUniforms) { uni.uApAtlas = ATMO.apUniforms.uApAtlas; uni.uAtmoAP = ATMO.apUniforms.uAtmoAP; uni.uMist = ATMO.apUniforms.uMist; }
    else uni.uAtmoAP = { value: new Float32Array(4) };
    skyMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: QUAD_VERT, fragmentShader: skyFrag(), glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, toneMapped: false });
    skyRT = new THREE.WebGLRenderTarget(SKY_W, SKY_H * SKY_EYES, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  }
  // the sky pass drawn once without a readback while the noise still bakes: its program compiles then (a
  // 260 ms step measured when the first fit compiled it mid-flight), not on the first fit
  function warmSky(r) {
    skyMats();
    const prev = r.getRenderTarget();
    quad.material = skyMat; r.setRenderTarget(skyRT); r.render(fsScene, fsCam);
    r.setRenderTarget(prev);
  }
  function skyRender(r) {
    skyMats();
    skyMat.uniforms.uSkyEye.value.set(map ? map.span : 40000, 0, 0, 0);
    const prev = r.getRenderTarget();
    quad.material = skyMat; r.setRenderTarget(skyRT); r.render(fsScene, fsCam);
    r.setRenderTarget(prev);
  }
  function skyShare(px) {
    let s = 0, w = 0;
    for (let j = 0; j < SKY_H * SKY_EYES; j++) { const el = ((j % SKY_H) + 0.5) / SKY_H * Math.PI / 2, sa = Math.cos(el);   // the ring's solid angle
      for (let i = 0; i < SKY_W; i++) { w += sa; if (px[(j * SKY_W + i) * 4] > 0.5) s += sa; } }
    return w > 0 ? s / w : 0;
  }
  // the synchronous read (the rig's instrument: CLOUDS.skyFraction()) - it drains the GPU queue
  function skyFraction(r) {
    skyRender(r);
    const px = new Float32Array(4 * SKY_W * SKY_H * SKY_EYES);
    const prev = r.getRenderTarget(); r.setRenderTarget(skyRT); r.readRenderTargetPixels(skyRT, 0, 0, SKY_W, SKY_H * SKY_EYES, px); r.setRenderTarget(prev);
    return skyShare(px);
  }
  // the fit's read: ASYNC (a PBO and a fence, r186's readRenderTargetPixelsAsync) - the frame never waits on the
  // GPU; the share lands a frame or two later (the synchronous read cost 20-47 ms a step, the frame serialised)
  function skyFractionAsync(r) {
    skyRender(r);
    const px = new Float32Array(4 * SKY_W * SKY_H * SKY_EYES);
    return r.readRenderTargetPixelsAsync(skyRT, 0, 0, SKY_W, SKY_H * SKY_EYES, px).then(b => skyShare(b || px));
  }
  // ATMO's own GLSL: the AP atlas sample + the mist (the splice's functions, verbatim)
  const ATMO_GLSL = () => (typeof ATMO !== 'undefined' && ATMO.GLSL) ? ATMO.GLSL.AP + ATMO.GLSL.MIST : 'uniform vec4 uAtmoAP; vec4 apSample(vec3 d, float k) { return vec4(0.0, 0.0, 0.0, 1.0); } vec3 mistApply(vec3 c, vec3 d, float D, float y) { return c; }';
  // THE COMPOSITE: the march's radiance tone-mapped like the dome, alpha over the frame in display
  // space, through a depth-aware upsample - the four half texels round the pixel weighted by the
  // bilinear weight x the nearness of the depth they saw to the pixel's own (both logarithmic depths
  // turned back into distances), so the ridge keeps its edge; where no texel agrees, plain bilinear
  // INSIDE THE SCENE PASS (A6, 2026-09-20 - the playtest: "a 1-px sky line round the plane over clouds"):
  // the composite was a draw over the RESOLVED frame, and a resolved pixel on the aeroplane's silhouette
  // is a blend of skin and sky whose ONE depth says "skin" - so no cloud was laid there and the sky half
  // of the blend stayed blue over a grey cloud: the line. The composite is a fullscreen quad IN the world
  // scene now, drawn last, depth-tested per MSAA sample against the scene at the cloud's own distance
  // (gl_FragDepth from the march's key, in the renderer's logarithmic convention): the skin's samples
  // reject it, the sky's take it, the resolve blends - the edge is anti-aliased like any other. One draw
  // in the pass, no second resolve (the 7 ms of G425 was a draw into the target AFTER its resolve).
  const COMP_FRAG = () => `varying vec2 vUv; uniform sampler2D uCloudTex, uKeyTex, uDepth; uniform vec2 uTexel; uniform float uUp, uLogFar, uDepthK; uniform mat4 uInvProj;
    ${DZ_GLSL}
    float dist(float dz) { return dzW1(dz); }
    void main() {
      // the cloud's depth: the key (the transmittance-weighted mean distance along this pixel's ray) as the
      // renderer's log depth - log2(1 + w) / log2(far + 1), w the view-axis distance
      { vec2 ndc = vUv * 2.0 - 1.0; vec4 v = uInvProj * vec4(ndc, 1.0, 1.0); vec3 dv = normalize(v.xyz / v.w);
        float w = max(0.0, texture2D(uKeyTex, vUv).r * 1000.0 * (-dv.z));
        gl_FragDepth = wDz(w); }
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
  // THE SHADOW BAKE: the decks' transmittance over the weather tile, in the FIRST deck's drifted uv space
  // (uv = (xz + drift0) / span - the splice projects a ground point along the sun to the first deck's middle
  // and reads there); an upper deck is read where the sun's ray through the first deck's middle crosses ITS
  // middle (the relative shift along the sun), so two decks' shadows land where each really falls
  const shadowFrag = () => `precision highp float; precision highp sampler3D; precision highp sampler2DArray;
    ${GLSL3_OUT}
    varying vec2 vUv; uniform vec2 uShadowK; uniform vec4 uSun;   // steps, sigma gain; the sun for the decks' relative shift
    ${DENSITY_GLSL}
    void main() {
      vec2 xz = vUv * uGlob.y - uDriftA[0].xy;
      float n = max(1.0, uShadowK.x), od = 0.0, mid0 = uLayerA[0].x + 0.5 * uLayerA[0].y;
      for (int li = 0; li < MAXL; li++) {
        if (uLayerA[li].z < 0.5) continue;
        float midj = uLayerA[li].x + 0.5 * uLayerA[li].y;
        vec2 xzj = xz + (uSun.y > 0.05 ? uSun.xz * ((midj - mid0) / uSun.y) : vec2(0.0));
        vec4 w = weather(li, vec3(xzj.x, 0.0, xzj.y));
        if (w.x <= 0.0) continue;
        float dh = uLayerA[li].y / n;
        for (float k = 0.0; k < 32.0; k += 1.0) { if (k >= n) break; vec3 p = vec3(xzj.x, uLayerA[li].x + (k + 0.5) * dh, xzj.y); od += density(li, p, w, true) * dh; }
      }
      gl_FragColor = vec4(exp(-od * uGlob.x * uShadowK.y), 0.0, 0.0, 1.0);
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

  // domeMat(frameYaw, steps): the dome march for a sphere round the eye (the probe, the shed)
  const domeMats = [];
  // domeMat(frameYaw, steps, opts): opts.depthTest - the SHED's sphere is depth-tested (A6, 2026-09-20, the
  // playtest: "in the garage the clouds render on top of the aircraft and the hangar"): drawn after the opaques
  // with no test it painted over the walls and the aeroplane; tested, the walls at 12 m hide it and it shows
  // through the door and the windows, in front of the sky dome at 600 m (the same standard depth the sky
  // writes - neither carries the log-depth chunk, so the two agree with each other and sit behind every
  // opaque). The world's probe keeps no test (its sphere is 20 m round the eye).
  function domeMat(frameYaw, steps, opts) {
    if (!ready) return null;
    const uni = Object.assign({}, U, { uSteps: { value: new THREE.Vector2(steps || 24, 3) }, uFrame: { value: frameYaw || 0 }, uEye: U.uEye });
    if (typeof ATMO !== 'undefined' && ATMO.apUniforms) { uni.uApAtlas = ATMO.apUniforms.uApAtlas; uni.uAtmoAP = ATMO.apUniforms.uAtmoAP; uni.uMist = ATMO.apUniforms.uMist; }
    else uni.uAtmoAP = { value: new Float32Array(4) };
    const m = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: DOME_VERT, fragmentShader: domeFrag(), glslVersion: THREE.GLSL3, side: THREE.BackSide,
      transparent: true, blending: THREE.NormalBlending, depthTest: !!(opts && opts.depthTest), depthWrite: false, toneMapped: false, fog: false });
    domeMats.push(m);
    return m;
  }
  // domeMesh(frameYaw, radius, steps, opts): the sphere itself, drawn after the dome (renderOrder 1)
  function domeMesh(frameYaw, radius, steps, opts) {
    const m = domeMat(frameYaw, steps, opts); if (!m) return null;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius || 20, 32, 20), m);
    mesh.renderOrder = 1; mesh.frustumCulled = false;
    return mesh;
  }
  // probeDirty(): has the layer moved enough since the probe last baked it (the drift, the map, the layer)
  let probeDrift = [1e9, 1e9], probeKey = '';
  function probeDirty() {
    if (!active()) return probeKey !== '';
    const key = mapKey + '|' + layKey;
    const moved = Math.abs(drift[0] - probeDrift[0]) + Math.abs(drift[1] - probeDrift[1]) > S.probeMoveM;
    return key !== probeKey || moved;
  }
  function probeBaked() { probeDrift[0] = drift[0]; probeDrift[1] = drift[1]; probeKey = active() ? mapKey + '|' + layKey : ''; }
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
    U.uGlob.value = new THREE.Vector4(S.sigma, 40000, S.detailPeriod, 1);
    U.uSun.value = new THREE.Vector4(0, 1, 0, 0); U.uMoon.value = new THREE.Vector4(0, 1, 0, 0);
    U.uSunCol.value = new THREE.Vector3(1, 1, 1); U.uMoonCol.value = new THREE.Vector3(); U.uAmbTop.value = new THREE.Vector3(); U.uAmbBot.value = new THREE.Vector3();
    U.uSteps.value = new THREE.Vector2(S.steps, S.lightSteps); U.uDials.value = new THREE.Vector4(S.powder, S.g, S.ms, S.maxKm); U.uTexel.value = new THREE.Vector2();
    U.uShadowK.value = new THREE.Vector2(S.shadowSteps, 1); U.uDials2.value = new THREE.Vector4(S.jitter, 0, 0, 0); U.uEye.value = new THREE.Vector3();
    U.uShape.value = new THREE.Vector4(S.detail, S.curl, 0, 0); U.uDZ.value = new THREE.Vector3(0, 0.5, 1e5);
    const uni = Object.assign({}, U);
    if (typeof ATMO !== 'undefined' && ATMO.apUniforms) { uni.uApAtlas = ATMO.apUniforms.uApAtlas; uni.uAtmoAP = ATMO.apUniforms.uAtmoAP; uni.uMist = ATMO.apUniforms.uMist; }
    else uni.uAtmoAP = { value: new Float32Array(4) };
    marchMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: QUAD_VERT, fragmentShader: marchFrag(), glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, toneMapped: false, transparent: false });
    compMat = new THREE.ShaderMaterial({ uniforms: { uCloudTex: U.uCloudTex, uKeyTex: U.uKeyTex, uDepth: U.uDepth, uTexel: U.uTexel, uUp: U.uUp, uLogFar: U.uLogFar, uDZ: U.uDZ, uDepthK: U.uDepthK, uInvProj: U.uInvProj }, vertexShader: QUAD_VERT, fragmentShader: COMP_FRAG(), depthTest: true, depthWrite: false, transparent: true, toneMapped: true, blending: THREE.NormalBlending });
    compMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat); compMesh.frustumCulled = false; compMesh.renderOrder = 1e6; compMesh.visible = false; compMesh.name = 'cloudComposite';
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
    if (bakeAt >= NB + 1 && !skyMat) { try { warmSky(renderer); } catch (e) { /* the fit compiles it then */ } }   // the sky pass's program, compiled among the bake's frames
    renderer.setRenderTarget(prev);
    stats.slicesBaked = bakeAt;
    shadowDirty = true;
    return bakeAt >= NB + 1;
  }
  // the weather maps as ONE 2D array texture (a slice a deck), rebuilt when any deck's (seed, cover, type) changes
  const N_MAP = 256;
  const inflate = [1, 1, 1];               // per deck: the map's cover over the day's (the cover fit below raises it when the noise carves too much)
  const mapCache = [{}, {}, {}];           // per deck: the weather noise (08_cloud_field caches per seed / type; a re-threshold is a millisecond)
  function mapsFor(L) {
    const key = L.map(l => S.seed + l.index * 1000 + '|' + l.cover.toFixed(3) + '|' + l.type).join(';');
    if (key === mapKey && maps.length === L.length) return maps;
    if (typeof CLOUD_FIELD === 'undefined') return null;
    for (let i = 0; i < MAXL; i++) inflate[i] = 1;
    maps = L.map(l => CLOUD_FIELD.weatherMap({ seed: S.seed + l.index * 1000, cover: l.cover, type: l.type, N: N_MAP, cache: mapCache[l.index] }));
    map = maps[0]; mapKey = key;
    uploadMaps();
    shadowDirty = true; needCal = true; needColumnCal = true; calDueAt = now() + 300; fit = null;   // the fit waits for a slider to settle
    return maps;
  }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);   // a debounce only - never the drift (GATE CLOUD: no wall clock)
  let calDueAt = 0;
  // the decks' maps into the array texture (8-bit: a float texture filters linearly only by extension)
  function uploadMaps() {
    if (weatherTex) weatherTex.dispose();
    const u8 = new Uint8Array(N_MAP * N_MAP * 4 * MAXL);
    maps.forEach((m, li) => { const o = li * N_MAP * N_MAP * 4; for (let i = 0; i < m.data.length; i++) u8[o + i] = Math.round(Math.max(0, Math.min(1, m.data[i])) * 255); });
    weatherTex = new THREE.DataArrayTexture(u8, N_MAP, N_MAP, MAXL); weatherTex.format = THREE.RGBAFormat; weatherTex.type = THREE.UnsignedByteType;
    weatherTex.wrapS = weatherTex.wrapT = THREE.RepeatWrapping; weatherTex.minFilter = weatherTex.magFilter = THREE.LinearFilter; weatherTex.needsUpdate = true;
    U.uWeather.value = weatherTex;
    stats.cover = CLOUD_FIELD.coverFraction(map);
    stats.covers = maps.map(m => +CLOUD_FIELD.coverFraction(m).toFixed(3));
  }
  // refit(): the maps back at the day's cover and the fit asked again (a dial moved what the sky's share measures)
  function refit() {
    if (!maps.length) return;
    for (let i = 0; i < MAXL; i++) inflate[i] = 1;
    for (let i = 0; i < maps.length; i++) remapDeck(i);
    shadowDirty = true; needCal = true; needColumnCal = true; calDueAt = now() + 300; fit = null;
  }
  // one deck's map regenerated at an inflated cover (the cover fit)
  function remapDeck(i) {
    const l = lays[i]; if (!l) return;
    maps[i] = CLOUD_FIELD.weatherMap({ seed: S.seed + l.index * 1000, cover: Math.min(1, l.cover * inflate[i]), type: l.type, N: N_MAP, cache: mapCache[l.index] });
    if (i === 0) map = maps[0];
    uploadMaps();
  }
  // update(day, camera, world): every frame from the world's dayApply - the layer, the map, the light, the drift
  const _T = [0, 0, 0], _E = [0, 0, 0], _Em = [0, 0, 0], _Eg = [0, 0, 0], _Tv = [0, 0, 0], _Ev = [0, 0, 0], _Egv = [0, 0, 0], _w4 = [0, 0, 0, 0];
  const _cc = (typeof THREE !== 'undefined' && THREE.Color) ? new THREE.Color() : null;
  const _vp = (typeof THREE !== 'undefined' && THREE.Vector4) ? new THREE.Vector4() : null, _sc = _vp ? new THREE.Vector4() : null;
  let sunEl = 0, layKey = '', sunKey = 0;
  const drifts = [[0, 0], [0, 0], [0, 0]], winds = [[3, 1], [3, 1], [3, 1]];
  function update(day, camera, world) {
    if (!ready || !day) return;
    dayRef = day;
    const L = CLOUD_FIELD.layers(day, { base: S.base > 0 ? S.base : null, thick: S.thick > 0 ? S.thick : null });
    if (!mapsFor(L)) return;
    lays = L; lay = L[0];
    // the decks' key: the slabs, and every dial that moves what the sky's share measures (the fit reruns on it)
    const lk = L.map(l => l.base + '|' + l.thick + '|' + l.type + '|' + (l.cover > 0.003 ? 1 : 0)).join(';') + '|' + S.erodeK + '|' + S.period + '|' + S.detail + '|' + S.sigma + '|' + S.calCover + '|' + S.steps;
    if (lk !== layKey) { const first = !layKey; layKey = lk; if (!first) refit(); else { shadowDirty = true; needCal = true; needColumnCal = true; } }
    // the clock's seconds for the drift: the day's UT seconds plus a per-date offset (97 days' worth wraps) - a
    // small number, so the noise coordinates keep their precision (a 5e7 m drift left 4 m of float, and the
    // 11 m detail jittered); continuous through a day, a jump at the date's roll
    const secs = (day.utc || 0) + ((day.jdn || 0) % 97) * 86400;
    // the decks' arrays: the slab, the profile (the type's erode x the dial, the coverage gain), the drift (the wind
    // at each deck's base x the clock - an upper deck drifts on its own wind), the noise's period (the type's, or the dial's)
    const LA = U.uLayerA.value, PA = U.uProfA.value, DA = U.uDriftA.value;
    for (let i = 0; i < MAXL; i++) {
      const l = L[i], T = l ? CLOUD_FIELD.TYPES[l.type] : null, o = i * 4;
      if (!l) { LA[o] = LA[o + 1] = LA[o + 2] = LA[o + 3] = 0; continue; }
      let wx = 3, wz = 1;
      if (world && typeof world.wind === 'function') { const w = world.wind(0, l.base, 0, 0); if (w) { wx = w[0] * 1.5; wz = w[2] * 1.5; } }
      winds[i][0] = wx; winds[i][1] = wz;
      // THE DRIFT IS AN INTEGRAL, not a product (CLIMATE K4). `wind x secs` is a
      // POSITION computed from the wind NOW, so the instant the wind changes the
      // whole deck jumps by (dw) x secs - and secs is sixty thousand by the
      // afternoon, which is hundreds of kilometres for a metre per second. With
      // a wind that moves on its own (a front veers 55 deg over two hours) that
      // is no longer tolerable. The link accumulates it over the day's clock
      // instead; for a CONSTANT wind it returns exactly this product, which is
      // how a boot still draws the sky it always drew.
      const LK = (typeof window !== 'undefined') ? window.CLIMATE_LINK : null;
      const dr = (LK && LK.pub.on) ? LK.cloudDrift(i, l.base, S.driftK, secs) : null;
      if (dr) { drifts[i][0] = dr.x; drifts[i][1] = dr.z; }
      else { drifts[i][0] = wx * secs * S.driftK; drifts[i][1] = wz * secs * S.driftK; }
      // THE NOISE PERIOD DIVIDES THE SPAN (G460.4, the user: "a clear seam" - a straight line across the sea
      // from 1000 m): the weather map tiles over the span, but the deck's noise did not, so the shadow tile's
      // two edges disagreed and its wrap line (it drifts with the clouds - it crosses anywhere) was a step in
      // the transmittance. span / round(span / period) is under 1 % from the period asked for.
      const per = q => map.span / Math.max(1, Math.round(map.span / q));
      LA[o] = l.base; LA[o + 1] = l.thick; LA[o + 2] = l.cover > 0.003 ? 1 : 0; LA[o + 3] = per(S.period > 0 ? S.period : T.period);
      PA[o] = T.bot; PA[o + 1] = T.top; PA[o + 2] = T.erode * S.erodeK; PA[o + 3] = S.calCover ? coverGain[i] : S.covGain;
      DA[o] = drifts[i][0]; DA[o + 1] = drifts[i][1]; DA[o + 2] = 0; DA[o + 3] = 0;
    }
    U.uGlob.value.set(S.sigma, map.span, map.span / Math.max(1, Math.round(map.span / S.detailPeriod)), L.length);   // the detail's period divides the span too
    // the clock's seconds for the drift: the day's UT seconds plus a per-date offset (97 days' worth wraps) - a
    // small number, so the noise coordinates keep their precision (a 5e7 m drift left 4 m of float, and the
    // 11 m detail jittered); continuous through a day, a jump at the date's roll
    drift[0] = drifts[0][0]; drift[1] = drifts[0][1];
    const wx = winds[0][0], wz = winds[0][1];   // the first deck's wind (the veil's is scaled from it)
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
    U.uSteps.value.set(S.steps, S.lightSteps); U.uDials.value.set(S.powder, S.g, S.ms, S.maxKm); U.uDials2.value.set(S.jitter, S.shadowSoft, S.ambDepth, 0);
    U.uShape.value.set(S.detail, S.curl, 0, 0);
    lastCover = L.reduce((m, l) => Math.max(m, l.cover), 0);   // any deck with cover keeps the pass live
    // THE VEIL (C4): cirrus over the low layer - a share of the cover by type (a cumulus day carries a thin
    // one, an overcast a fuller), drifted by the upper wind (twice the surface's, veered), lit by the sun's
    // transmittance at its height and the sky's radiance there - ATMO's dome draws it
    if (A && A.U.veil) {
      const VEIL_K = { st: 0.55, sc: 0.4, cu: 0.35, cb: 0.7 };
      const vc = Math.max(0, Math.min(1, day.cloudCover * (VEIL_K[lay.type] || 0.35) * S.veil)) * (S.mode !== 'off' ? 1 : 0);
      const km = S.veilKm, vT = _Tv, vE = _Ev;
      A.sunTransmittance(km, sun[1], vT); A.skyIrradiance(km, sun, vE);
      const sy = Math.max(0, sun[1]), mE = A.U.eMoon.value;
      if (mE > 0 && moon[1] > 0) { A.skyIrradiance(km, moon, _Egv); vE[0] += _Egv[0] * mE; vE[1] += _Egv[1] * mE; vE[2] += _Egv[2] * mE; }
      const v = A.U.veil.value; v[0] = vc; v[1] = -wz * 2.2 * secs * S.driftK; v[2] = wx * 2.2 * secs * S.driftK; v[3] = km * 1000;
      const vs = A.U.veilSun.value, vk = A.U.veilSky.value;
      vs[0] = vT[0] * sy; vs[1] = vT[1] * sy; vs[2] = vT[2] * sy;
      vk[0] = vE[0] / Math.PI; vk[1] = vE[1] / Math.PI; vk[2] = vE[2] / Math.PI;
    }
    // IN CLOUD (C4): the eye inside the layer - the field's density there (the column's proxy: the map's
    // coverage x the profile at the eye's height x the fitted columnK) as a uniform slab in the mist
    if (A && A.MIST && A.MIST.cloud) {
      const c = A.MIST.cloud, ey = U.uEye.value;
      let rho = 0;
      let inL = lay;
      if (S.inCloud && S.mode !== 'off' && ey) for (let i = 0; i < L.length; i++) {   // the deck the eye is in, if any
        const l = L[i];
        if (l.cover > 0.003 && ey.y > l.base && ey.y < l.top) {
          const w = CLOUD_FIELD.sample(maps[i], ey.x, ey.z, drifts[i], _w4), h = (ey.y - l.base) / l.thick;
          rho = S.sigma * w[0] * CLOUD_FIELD.profile(l.type, h, w[1]) * S.columnK * 2.5; inL = l; break;
        }
      }
      c.rho = rho; c.base = inL.base; c.top = inL.top;
    }
    // the shadow's scalars: on only when the layer is live and baked (the tile sampler reads white until then)
    if (U.uEye.value) { if (camera && camera.position) U.uEye.value.copy(camera.position); else if (S.inShed) U.uEye.value.set(0, 0, 0); }   // the shed stands at the field
    // with a deck above the first, the tile's relative shift rides on the sun: re-bake as it moves (a third of a degree)
    const sk = Math.round(sun[1] * 170) * 1000 + Math.round(Math.atan2(sun[2], sun[0]) * 170);
    if (sk !== sunKey) { sunKey = sk; if (L.length > 1) shadowDirty = true; }
    const on = active() && bakeAt >= NB + 1 && S.shadow > 0 && !shadowDirty && !S.inShed ? 1 : 0;
    const fade = Math.max(0, Math.min(1, (sun[1] - 0.02) / 0.13));
    cloudScalars[0] = drift[0]; cloudScalars[1] = drift[1]; cloudScalars[2] = map.span; cloudScalars[3] = on;
    cloudScalars[4] = sun[0]; cloudScalars[5] = sun[1]; cloudScalars[6] = sun[2]; cloudScalars[7] = lay.base + lay.thick * 0.5;
    cloudScalars[8] = S.shadow * fade; cloudScalars[9] = 0; cloudScalars[10] = 0; cloudScalars[11] = 0;
  }
  const active = () => ready && S.mode !== 'off' && !!dayRef && lastCover > 0.003 && !!map;
  // the shadow tile: re-baked when the map, the layer or the noise changed, or the drift moved (every S.shadowEvery frames)
  function bakeShadow(r) {
    if (needCal && now() >= calDueAt) shadowDirty = true;   // the fit is due (a paused clock drifts nothing: the bake would never come round)
    const moved = Math.abs(drift[0] - shadowDrift[0]) + Math.abs(drift[1] - shadowDrift[1]) > 0.5;
    if (!shadowDirty && !(moved && (frame % Math.max(1, S.shadowEvery)) === 0)) return;
    if (!shadowRT) return;
    if (needCal && now() >= calDueAt) { calibrateCover(r); if (needCal) return; }   // a fit step a frame; the tile once it is done
    const h = tBegin('shadow');
    bakeTile(r);
    tEnd(h);
    shadowDrift[0] = drift[0]; shadowDrift[1] = drift[1]; shadowDirty = false;
    if (needColumnCal) calibrateColumn(r);
  }
  // one bake of the tile into the atlas (the viewport and the scissor on the tile's rows, the AP rows untouched)
  function bakeTile(r) {
    const a = AT();
    U.uShadowK.value.set(S.shadowSteps, S.shadowSoft);   // the softness: the light that scatters through and round a cloud (a sigma gain < 1)
    const prev = r.getRenderTarget(), ac = r.autoClear;
    r.getViewport(_vp); r.getScissor(_sc); const st = r.getScissorTest();
    r.setRenderTarget(shadowRT); r.setViewport(0, a.TILE_Y, a.TILE, a.TILE); r.setScissor(0, a.TILE_Y, a.TILE, a.TILE); r.setScissorTest(true); r.autoClear = false;
    quad.material = shadowMat; r.render(fsScene, fsCam);
    r.setScissorTest(st); r.setViewport(_vp); r.setScissor(_sc); r.autoClear = ac;
    r.setRenderTarget(prev);
  }
  // THE COVER IS THE COVER (A6, 2026-09-20): the weather map's covered fraction is the day's cover to the texel
  // THE COVER IS THE COVER (A6, 2026-09-20): the weather map's covered fraction is the day's cover to the texel
  // (GATE CLOUD), but what the eye calls cover is the share of the sky the cloud takes - and the noise, now
  // carving the columns, takes far less of it (a 45 % cumulus map made a 21 % sky). So per deck, once per map
  // (300 ms after the last change - a slider settles first): the deck marched alone over four hemispheres
  // from the ground (skyFraction: the METAR's cover, the share of the dome to an observer's eye, sides
  // included - measured to track the tile's straight-down share within a point), and the MAP'S cover bisected
  // (inflate: 1 .. 1/cover, six regenerations of the deck's map) until the sky's share is the day's. The map,
  // not a coverage gain: a gain saturates the columns and the noise stops carving - the slab comes back
  // (measured: gain 1.9 made a 45 % day a grey ceiling). The gain stays a dial (covGain, 1).
  const coverGain = [1, 1, 1];
  // ONE STEP A FRAME (the user: "are we still safe on the performance side?"): the synchronous fit stalled the
  // frame 200-860 ms (seven readbacks and six map regenerations in a row, each readback draining the GPU
  // queue). It is a state machine now - one march + readback (and at most one 17 ms map) per frame, a dozen
  // frames in all, the on-flags set for the measured deck and restored before the frame's own march.
  let fit = null;
  function calibrateCover(r) {
    const PA = U.uProfA.value, LA = U.uLayerA.value;
    if (!fit) {
      for (let i = 0; i < MAXL; i++) { coverGain[i] = S.covGain; PA[i * 4 + 3] = S.covGain; }
      if (!S.calCover) { needCal = false; return; }
      fit = { i: -1, state: 'next', t0: now(), bakes: 0, pending: false };
    }
    if (fit.pending) return;                        // the read is in flight: the GPU answers in its own time
    if (fit.state === 'next') {
      fit.i++;
      while (fit.i < lays.length && fit.i < MAXL && !(lays[fit.i].cover > 0.003)) fit.i++;
      if (fit.i >= lays.length || fit.i >= MAXL) {   // every deck fitted: the tile next frame
        stats.inflate = inflate.map(v => +v.toFixed(3)); stats.calMs = +(now() - fit.t0).toFixed(1); stats.calBakes = fit.bakes;
        fit = null; needCal = false; needColumnCal = true; shadowDirty = true;
        return;
      }
      fit.state = 'probe'; fit.want = lays[fit.i].cover; fit.lo = 1; fit.hi = Math.min(4, 1 / fit.want); fit.it = 0;
    }
    const on = [LA[2], LA[6], LA[10]], ts = now(), me = fit;
    for (let j = 0; j < MAXL; j++) LA[j * 4 + 2] = j === fit.i ? 1 : 0;
    // the read lands later: the state moves on in its callback, only if this fit is still the live one
    const ask = then => { me.pending = true; me.bakes++; skyFractionAsync(r).then(got => { if (fit !== me) return; me.pending = false; then(got); }, () => { if (fit === me) { me.pending = false; me.state = 'next'; } }); };
    try {
      if (fit.state === 'probe') ask(got => { me.state = got >= me.want ? 'next' : 'bisect'; });
      else if (fit.state === 'bisect') {
        if (fit.it > 0) { if (fit.got < fit.want) fit.lo = inflate[fit.i]; else fit.hi = inflate[fit.i]; }
        if (fit.it >= 6 || fit.hi - fit.lo <= 0.02) { inflate[fit.i] = 0.5 * (fit.lo + fit.hi); remapDeck(fit.i); fit.state = 'next'; }
        else { inflate[fit.i] = 0.5 * (fit.lo + fit.hi); remapDeck(fit.i); ask(got => { me.got = got; me.it++; }); }
      }
    } catch (e) { fit.state = 'next'; fit.pending = false; }   // a read that fails leaves the deck's map
    for (let j = 0; j < MAXL; j++) LA[j * 4 + 2] = on[j];
    (stats.fitSteps = stats.fitSteps || []).push(+(now() - ts).toFixed(1)); if (stats.fitSteps.length > 32) stats.fitSteps.shift();   // each step's ms (the frame's hitch)
  }
  // THE COLUMN CALIBRATED: the CPU column (coverage x the profile's fill x height x sigma) is the
  // field without its noise - it overstates the optical depth ~7x (the noise empties most of a
  // column). Once per map, the GPU tile is read back and columnK fitted so the CPU's mean
  // transmittance over the tile equals the GPU's; sunT (the flare's dimmer) then agrees with the
  // shadow the ground shows.
  let needCal = true, needColumnCal = true;
  function calibrateColumn(r) {
    needColumnCal = false;
    try {
      const gpuMean = tileMean(r);
      if (!(gpuMean >= 0)) return;
      // the CPU column summed over the decks (the tile holds their product; a mean over the tile needs no sun shift)
      const ods = []; for (let j = 0; j < 48; j++) for (let i = 0; i < 48; i++) { let od = 0;
        for (let k = 0; k < lays.length; k++) if (lays[k].cover > 0.003) od += CLOUD_FIELD.columnOD(maps[k], (i + 0.5) / 48 * map.span - drifts[k][0], (j + 0.5) / 48 * map.span - drifts[k][1], lays[k], S.sigma, drifts[k]);
        ods.push(od); }
      const meanT = k => { let t = 0; for (const od of ods) t += Math.exp(-k * od); return t / ods.length; };
      let lo = 0.001, hi = 4;
      for (let it = 0; it < 40; it++) { const mid = 0.5 * (lo + hi); if (meanT(mid) > gpuMean) lo = mid; else hi = mid; }
      S.columnK = 0.5 * (lo + hi); stats.calGpuMean = gpuMean; stats.calCpuMean = meanT(S.columnK);
    } catch (e) { /* a readback that fails leaves the default */ }
  }
  // draw(renderer, camera, target): the aa overlay - the march at its resolution, then the composite over the target
  function draw(r, camera, target) {
    if (compMesh) compMesh.visible = false;
    if (!active() || !target || !target.depthTexture) return;
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    if (!bakeStep()) return;
    frame++;
    tPoll();
    bakeShadow(r);
    const k = S.mode === 'full' ? 1 : 0.5;
    const w = Math.max(8, Math.round(target.width * k)), h = Math.max(8, Math.round(target.height * k));
    if (!rt || rtW !== w || rtH !== h) {
      // the march targets are KEPT PER SIZE (G460.11.1): the water's mirror marches the clouds for its own capture
      // at half the frame's size every capture, and a dispose + allocate per call cost more than the march
      rtPool = rtPool || new Map(); const key = w + 'x' + h;
      rt = rtPool.get(key);
      if (!rt) { rt = new THREE.WebGLRenderTarget(w, h, { count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
        if (rtPool.size >= 3) { const k0 = rtPool.keys().next().value; rtPool.get(k0).dispose(); rtPool.delete(k0); } rtPool.set(key, rt); }
      rtW = w; rtH = h; U.uCloudTex.value = rt.textures[0]; U.uKeyTex.value = rt.textures[1]; U.uTexel.value.set(1 / w, 1 / h);
    }
    U.uDepth.value = target.depthTexture;
    U.uInvProj.value.copy(camera.projectionMatrixInverse);
    U.uCamMat.value.copy(camera.matrixWorld);
    U.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    U.uRes.value.set(w, h); U.uFrame.value = S.shimmer ? (frame % 64) : 0;
    U.uLogFar.value = Math.log2(camera.far + 1);
    U.uDZ.value.set(r.capabilities && r.capabilities.reversedDepthBuffer ? 1 : 0, camera.near, camera.far);
    U.uUp.value = (S.upsample && k < 1) ? 1 : 0; U.uDepthK.value = S.depthK;
    r.getClearColor(_cc); const prevCA = r.getClearAlpha();
    let q = tBegin('bind'); r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(true, false, false); tEnd(q);
    q = tBegin('pass'); quad.material = marchMat; r.render(fsScene, fsCam); tEnd(q);
    r.setRenderTarget(target); r.setClearColor(_cc, prevCA);
    marched = true;
    if (compMesh) compMesh.visible = true;
    if (t0) stats.ms = stats.ms * 0.9 + 0.1 * ((performance.now()) - t0);
  }
  // compositeMesh(): the fullscreen quad the WORLD scene holds (render_world adds it), drawn last in the
  // pass at the cloud's depth - see COMP_FRAG. composite(r) is kept as a no-op for the old post hook.
  let marched = false;
  function compositeMesh() { return compMesh; }
  function composite() {}
  // sunT(x, y, z): the layer's transmittance toward the sun from a world point (the CPU column, the flare's dimmer)
  function sunT(x, y, z) {
    if (!active() || !lay || !map || sunEl < 0.04 || S.shadow <= 0) return 1;
    const s = dayRef.sun; let od = 0;
    for (let i = 0; i < lays.length; i++) {   // every deck whose middle is above the point, along the sun
      const l = lays[i]; if (l.cover <= 0.003) continue;
      const k = (l.base + l.thick * 0.5 - y) / s[1]; if (k < 0) continue;
      od += CLOUD_FIELD.columnOD(maps[i], x + s[0] * k, z + s[2] * k, l, S.sigma, drifts[i]);
    }
    return Math.exp(-od * S.columnK);
  }
  // probe(): what the pass sees - the march target's mean alpha, a noise slice's mean, the depth at the centre, the shadow tile
  let probeMat = null, probeRT = null;
  const PROBE_N = 64;
  function probeMats() {
    if (probeMat) return;
    probeMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uNoise: U.uNoise, uDetail: U.uDetail, uWeather: U.uWeather, uDepth: U.uDepth, uShadow: { value: null }, uWhat: { value: 0 } },
      vertexShader: QUAD_VERT, fragmentShader: `precision highp float; precision highp sampler3D; precision highp sampler2DArray; ${GLSL3_OUT}
        varying vec2 vUv; uniform sampler3D uNoise, uDetail; uniform sampler2DArray uWeather; uniform sampler2D uDepth, uShadow; uniform float uWhat;
        void main() { vec2 tuv = vUv; if (uWhat < 0.5) gl_FragColor = texture(uNoise, vec3(vUv, 0.5)); else if (uWhat < 1.5) gl_FragColor = texture(uDetail, vec3(vUv, 0.5)); else if (uWhat < 2.5) gl_FragColor = texture(uWeather, vec3(vUv, uWhat - 2.0)); else if (uWhat < 3.5) gl_FragColor = vec4(texture(uDepth, vUv).r, 0.0, 0.0, 1.0); else gl_FragColor = texture(uShadow, ${TILE_UV()}); }`,
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
  function tileMean(r) { return tileStat(r).mean; }
  // the tile's mean transmittance and its opaque fraction (texels passing less than half the light)
  function tileStat(r) {
    const px = new Float32Array(4 * PROBE_N * PROBE_N); probeRead(r, 4, px);
    let s = 0, o = 0; for (let i = 0; i < PROBE_N * PROBE_N; i++) { s += px[i * 4]; if (px[i * 4] < 0.5) o++; }
    return { mean: s / (PROBE_N * PROBE_N), opaque: o / (PROBE_N * PROBE_N) };
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
      if (k === 'noise' || k === 'detail') {   // the distribution, not just the mean: a base noise whose p10 sits at 0.6 carves nothing (the slab)
        const r = new Float32Array(PROBE_N * PROBE_N); for (let i = 0; i < r.length; i++) r[i] = px[i * 4]; r.sort();
        out[k + 'P'] = [0.05, 0.25, 0.5, 0.75, 0.95].map(q => +r[Math.floor(q * (r.length - 1))].toFixed(3));
      }
    }
    out.scalars = Array.from(cloudScalars).map(v => +v.toFixed(3));
    return out;
  }
  // hemiUnder(T): the hemisphere's gain under a cloud of transmittance T at the eye - the diffuse light rises as the sun is lost
  // (an overcast day's diffuse is ~1.7x a clear day's), a dial
  const hemiUnder = T => 1 + S.hemiUnderCloud * (1 - Math.max(0, Math.min(1, T)));
  const API = { S, init, install, inject, update, draw, composite, compositeMesh, bakeStep, probe, sunT, hemiUnder, skyFraction: () => (renderer ? skyFraction(renderer) : NaN), tileStat: () => (renderer ? tileStat(renderer) : null), refit, domeMat, domeMesh, probeDirty, probeBaked, rt: () => rt, get active() { return active(); }, get ready() { return ready; }, get layer() { return lay; }, get layers() { return lays; }, get map() { return map; }, get maps() { return maps; }, stats, get baked() { return bakeAt >= NB + 1; }, get installed() { return installed; } };
  if (typeof window !== 'undefined') { window.CLOUDS = API; API.install(); }   // BEFORE any program compiles, like ATMO.install
  return API;
})();
