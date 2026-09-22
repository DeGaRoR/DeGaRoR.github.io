// ============================================================
// WATER — ONE MATERIAL FOR EVERY WATER (H6, G460-G444, 2026-09-21).
//
// The sea, the island's lakes, the analytic world's rivers and lake cells and
// the premises editor's sheet were four stock MeshStandardMaterials: a flat
// colour with a probe reflection, painted plastic from altitude and glass at
// the dock. This module is the one material they all take, and the design
// (futureDesigns/WATER-2026-09-13.md §3, WATER-SHADER-2026-09-21.md) says why
// each term is where it is. The user's rulings on the day it was built:
//   - the WAVE MODEL IS NOT TOUCHED (ruling aq stands): the surface the
//     floats are pushed by is world.waterH(x, z, t) - two Gerstner trains in
//     SEA.W - and this shader evaluates THE SAME closed form from a uniform
//     array (GATE WATER transpiles the shipped GLSL to JS and holds it against
//     waterH to 1e-9). FFT is a slot, not a build (see detailNormal).
//   - INTERACTION IS A SAMPLER INPUT: setInteraction(tex, x0, z0, size) - a
//     world-locked texture of slope + foam the shader adds inside its box.
//     The field that will write it (a wake, a splash, a ripple) is H7.
//   - DEPTH IS ANALYTIC: the coast and lake signed-distance fields the ground
//     already carries (uGPackA.b / .a, 4 m a unit, 128 = the line) give the
//     water column - no depth buffer (the one we have is a frame stale, and
//     the water draws inside the MSAA pass, so it could not read its own).
//
// THREE BANDS, ONE NORMAL (Bruneton 2010, "seamless transitions from geometry
// to BRDF": a wave is geometry at 1 m, a normal at 200 m and roughness at
// 2 km, or it shimmers - the flight-sim sparkle):
//   1. THE FELT BAND - SEA.W, the trains a float feels. Height in the vertex
//      shader (the near patch only; the 400 km plane never moves), the
//      analytic normal and the fold (a virtual Gerstner Q, for the crest foam
//      mask only - waterH has no horizontal term, so neither has the mesh).
//   2. THE DETAIL BAND - detailNormal(xz): ONE function reading ONE tile
//      (uWDetail, baked at boot: a periodic sum of cosines, RG = slope, B =
//      crests, A = noise), twice, at two scales, each scrolled along the wind
//      at its own phase speed sqrt(g L / 2 pi). The physics does not feel it.
//      THE FFT PLUGS IN HERE: a live cascade sets uWDetail to its output and
//      uWDetailK.x to its patch length; not a line of this GLSL changes.
//   3. THE SUB-PIXEL BAND - wSigma2(footprint): the slope variance of every
//      wave finer than the pixel (Cox-Munk total 0.003 + 0.00512 U10, the
//      equilibrium tail's constant variance per octave, the unresolved
//      fraction from the screen-space footprint of the world xz) -> three's
//      own per-pixel ROUGHNESS, so the GGX sun and the PMREM sky do the BRDF:
//      a wide streak from 300 m, sparkles at the dock, no aliasing between.
//
// THE VEHICLE is MeshPhysicalMaterial (ior 1.333: F0 = 0.02, the water's own
// Fresnel) + ONE module-level onBeforeCompile - the AEROSKIN rule (aeroskin.js
// 7-29): scene.environment, the aerial perspective, the mist, the cloud
// shadow and the near shadow all come through three's chunks and ATMO's
// prototype accessor; a hand-written ShaderMaterial gets none. The cache key
// is the hook's SOURCE, so nothing per body is interpolated into the GLSL:
// the body (sea 0 / lake 1 / river 2 / premises 3) is a VERTEX ATTRIBUTE
// aWater = (body, wavy) set where the geometry is built, and every per-body
// number is a uniform row (uWAbs / uWSct / uWBody).
//
// THE CLOCK. The solver's simT is the wave's time (32_hydro reads waterH at
// it); render_world's own seaT accumulator drew the hull in a wave 1/60 s
// per frame away from the one that pushed it, pause or not (ruling ap was
// not honoured). app.js hands sim.t to setTime every step; frame() free-runs
// only when nobody has. The phase reaches the GPU REDUCED - mod(om t - ph,
// 2 pi) per train, in double - so a float32 cos never sees an 8000 rad
// argument (t = 1 h at om 2.3) and parity holds at any sim time.
'use strict';

const WATER = (() => {
  const NTR = 32;                                                 // trains the uniform array holds (seaFrom makes 32: a swell band and a wind sea drawn from the spectrum, G460.3)
  const TWO_PI = 2 * Math.PI;

  // ---- THE FELT BAND IN GLSL: a scalar subset the gate can transpile ----------------------------
  // (float / for / cos / sin / the uniform reads; no swizzles wider than .x .y .z .w, no vec math -
  // gerstnerFromGLSL below turns this exact string into the JS the buoys, the bench and GATE WATER
  // read, so the mirror IS the shader). uWTrA[i] = (A, k, phase, 0) with phase = mod(om t - ph, 2 pi);
  // uWTrD[i] = (dx, dz, Q, felt): waterH's  A cos(k (dx x + dz z) - om t + ph) over the FELT trains
  // (G460.6: the short wind sea is a slope only - the physics does not feel it, so the height does not lift it).
  const GLSL_GERSTNER = `
    float wGerstnerH(float x, float z) {
      float y = 0.0;
      for (int i = 0; i < 32; i++) {
        if (i >= uWTrN) break;
        if (uWTrD[i].w < 0.5) continue;
        y += uWTrA[i].x * cos(uWTrA[i].y * (uWTrD[i].x * x + uWTrD[i].y * z) - uWTrA[i].z);
      }
      return y;
    }`;
  // the slopes and the fold (not transpiled; the same terms differentiated)
  const GLSL_GERSTNER_N = `
    // dy/dx, dy/dz and the fold: J = sum A k Q cos(.) - the virtual Gerstner's horizontal compression,
    // 1 at a crest of the design's Q, negative where a real Gerstner would fold (foam)
    vec3 wGerstnerS(vec2 p, float fp) {
      vec3 s = vec3(0.0);
      for (int i = 0; i < 32; i++) {
        if (i >= uWTrN) break;
        // a train fades out of the SLOPE where its wavelength is under ~12 px and is gone under ~3 px - roughness
        // (wSigma2, which starts at 6 px) carries it from there (G460.7: the felt swell keeps a wider window, 6..2 px -
        // it is the sea's shape from altitude; the wind sea drops first, which is the 300 m eye's cost lever)
        float px = fp * uWTrA[i].y * 0.159155;                                      // footprint / wavelength
        float fade = uWTrD[i].w > 0.5 ? 1.0 - smoothstep(0.15, 0.5, px) : 1.0 - smoothstep(0.08, 0.3, px);
        if (fade <= 0.0) continue;                                                 // (no sin/cos for it: the short trains drop out first with distance)
        float ph = uWTrA[i].y * (uWTrD[i].x * p.x + uWTrD[i].y * p.y) - uWTrA[i].z;
        float ak = uWTrA[i].x * uWTrA[i].y * fade;
        float sn = sin(ph);
        s.x -= ak * uWTrD[i].x * sn;
        s.y -= ak * uWTrD[i].y * sn;
        s.z += ak * uWTrD[i].z * cos(ph);
      }
      // THE CRESTS ARE SHARP (G460.11, the user: "plastic on the surface"): a Gerstner wave's surface is steeper at
      // its crest than its trough by the horizontal motion's Jacobian, 1 / (1 - Q k A cos) - s.z holds that sum
      // (the fold); the slope is divided by it, clamped short of the fold (a rolling crest)
      float wJ = clamp(1.0 - s.z, 0.35, 1.0);
      s.x /= wJ; s.y /= wJ;
      return s;
    }`;

  // ---- the rest of the fragment vocabulary -----------------------------------------------------
  const GLSL_FRAG_PARS = `
    varying vec3 vWP;          // world position (displaced)
    varying vec3 vWP0;         // world position on the still plane (the footprint's: a displaced patch is faceted, and a derivative across its facets steps the roughness row by row in the sun's highlight)
    varying vec2 vWBody;       // (body, wavy) - the vertex attribute, flat across a mesh
    uniform vec4 uWTrA[32]; uniform vec4 uWTrD[32]; uniform int uWTrN;
    uniform vec4 uWWave;       // x: displacement on, y: the longest train's L (m), z: the near patch's half width (m; the displacement fades over its last 40), w: sigma on
    uniform vec4 uWWind;       // x: U10 (m/s), y: ln kMin, z: ln kMax, w: detail on
    uniform vec4 uWDetailK;    // x: tile 0 length (m), y: tile 1 length (m), z: strength, w: slope range of the tile (the bake's)
    uniform vec4 uWDrift;      // xy: tile 0 scroll (m, along the tile's own axes), zw: tile 1
    uniform vec4 uWDir;        // xy: the wind's unit direction (the tile's +x), z: 0, w: 0
    uniform vec4 uWAbs[4];     // rgb: absorption per metre, w: the column's opacity rate per metre
    uniform vec4 uWSct[4];     // rgb: the column's own colour at depth (linear), w: 0
    uniform vec4 uWBody[4];    // x: wave scale, y: detail scale, z: foam threshold, w: depth when there is no field (m)
    uniform vec4 uWMisc;       // x: shore fade width (m), y: lake depth per metre of field, z: lake depth cap (m), w: foam on
    uniform sampler2D uWSdf; uniform vec4 uWGrid; uniform float uWSdfOn;
    uniform sampler2D uWDetail;
    uniform sampler2D uWInter; uniform vec4 uWInterBox;   // x0, z0, 1/size, on
    uniform sampler2D uWMirror; uniform mat4 uWMirrorVP; uniform vec4 uWMirror4; uniform vec2 uWRes;   // the planar mirror (G460.11): its capture's view-projection; x: on, y: the slope's walk as a fraction of the view distance, z: the lod per roughness, w: the mirror's plane y (G460.11.9)
    uniform vec4 uWNear;       // ox, oz, half, on - the near patch's box (the far plane is cut out of it)
    uniform vec4 uWFoam;       // x: the fold's RMS Q sqrt(sum (A k)^2 / 2), y: the whitecap cover (Monahan, of the wind), z: the swell's A (m), w: 0
    uniform int uWDbg;
    ` + GLSL_GERSTNER + GLSL_GERSTNER_N + `
    // THE FIELDS: coast (b) and lake (a), signed metres, the line at 128
    vec2 wField(vec2 xz) {
      if (uWSdfOn < 0.5) return vec2(-1e4, 1e4);
      vec4 t = texture2D(uWSdf, (xz - uWGrid.xy) / uWGrid.zw);
      return vec2((t.b * 255.0 - 128.0) * 4.0, (t.a * 255.0 - 128.0) * 4.0);   // (coast: sea < 0, lake: inside > 0)
    }
    // the water column under this pixel: the sea's shelf (28_island.js seaFloor: -5 m at the line, -14 by
    // 500 m out) capped by a beach slope so the line itself is 0 deep; a lake by its field; else the body's own
    float wDepth(vec2 f, int b) {
      if (uWSdfOn < 0.5) return uWBody[b].w;
      if (b == 0) { float sd = -f.x; float t = clamp(sd / 500.0, 0.0, 1.0); return min(5.0 + 9.0 * t * t * (3.0 - 2.0 * t), max(sd, 0.0) * 0.08); }   // a 1:12 beach to the shelf (G460.5: the shallows read 60 m out)
      if (b == 1) return clamp(f.y * uWMisc.y, 0.0, uWMisc.z);
      return uWBody[b].w;
    }
    // the shore: the surface fades over uWMisc.x metres of the field on the water side of the line
    float wShoreA(vec2 f, int b) {
      if (uWSdfOn < 0.5) return 1.0;
      if (b == 0) return smoothstep(0.0, -uWMisc.x, f.x);
      if (b == 1) return smoothstep(-2.0, 2.0, f.y);   // G413: the lake's own edge (G460.4: centred on the line, over the bed's paint)
      return 1.0;
    }
    // THE DETAIL BAND: one tile, two scales, each scrolled along the wind at its phase speed; RG = slope
    // over [-w, w] (w = uWDetailK.w), B = crests, A = noise. Returns (slope x, slope z, crest, noise).
    // STOCHASTIC TILING (G460.2, the user: "the tiling is really obvious, a matrix"): a periodic tile read
    // straight repeats every L metres and the eye finds the lattice at once. Heitz & Neyret's hex tiling
    // instead: the plane is a lattice of hexagonal cells 1.4 L wide, every cell reads the tile at ITS OWN
    // random offset and turned by its own random angle, and a point blends the three cells round it by
    // its barycentric weights - no two cells agree, so nothing repeats; the blend's weights are normalised
    // by their length, which keeps a zero-mean slope's variance (a plain lerp would flatten the seams).
    // Three taps a tile instead of one; the tile's drift (the phase speed) rides under the cells.
    vec2 wHash2(vec2 c) { vec3 q = fract(vec3(c.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
    vec4 wTileTap(vec2 p, vec2 cellId, float L) {
      vec2 h = wHash2(cellId);
      // (G460.11.1: the turn is +-12 deg, not a full turn - the ripples are the WIND's, anisotropic, and a cell turned
      // 90 deg showed its streaks across its neighbours' as a patch with a hard edge, the user: "harsh transition
      // between the stretched water textures"; the offset alone breaks the lattice)
      float a = (h.x - 0.5) * 0.42, ca = cos(a), sa = sin(a);
      vec2 q = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca) + h * 7.31;      // turned about the origin, shifted
      vec4 t = texture2D(uWDetail, q);
      vec2 sl = t.rg * 2.0 - 1.0;
      return vec4(sl.x * ca + sl.y * sa, -sl.x * sa + sl.y * ca, t.b, t.a);    // the slope turned back
    }
    vec4 wTile(vec2 xz, float L, vec2 drift, float rot) {
      vec2 d = vec2(uWDir.x * cos(rot) - uWDir.y * sin(rot), uWDir.x * sin(rot) + uWDir.y * cos(rot));   // the wind's frame, turned by rot
      vec2 p = vec2(dot(xz, d), dot(xz, vec2(-d.y, d.x)));
      vec2 u = (p - drift) / L;                                                  // tile units, drifting
      // the hex lattice over the UNDRIFTED plane (the cells stand still; the water runs through them)
      vec2 g = p / (1.4 * L);
      vec2 sk = vec2(g.x - 0.57735 * g.y, 1.1547 * g.y);
      vec2 b = floor(sk), f = sk - b;
      vec3 w; vec2 c0, c1, c2;
      if (f.x + f.y > 1.0) { w = vec3(1.0 - f.y, 1.0 - f.x, f.x + f.y - 1.0); c0 = b + vec2(1.0, 0.0); c1 = b + vec2(0.0, 1.0); c2 = b + vec2(1.0, 1.0); }
      else { w = vec3(1.0 - f.x - f.y, f.x, f.y); c0 = b; c1 = b + vec2(1.0, 0.0); c2 = b + vec2(0.0, 1.0); }
      w /= max(length(w), 1.0e-4);
      vec4 t = wTileTap(u, c0, L) * w.x + wTileTap(u, c1, L) * w.y + wTileTap(u, c2, L) * w.z;
      vec2 s = t.xy * uWDetailK.w;                                               // a slope is a slope at any length (the equilibrium tail: the same variance per octave)
      // back to world axes
      return vec4(s.x * d.x - s.y * d.y, s.x * d.y + s.y * d.x, t.z, t.w);
    }
    vec4 detailNormal(vec2 xz, float fp) {
      if (uWWind.w < 0.5) return vec4(0.0, 0.0, 0.0, 0.5);
      // a tile whose length is under twice the footprint is below the pixel: it fades out here and its
      // variance is already in wSigma2
      float f0 = 1.0 - smoothstep(0.15, 0.5, fp / uWDetailK.x), f1 = 1.0 - smoothstep(0.15, 0.5, fp / uWDetailK.y);
      vec4 a = wTile(xz, uWDetailK.x, uWDrift.xy, 0.0) * f0;
      vec4 b = wTile(xz, uWDetailK.y, uWDrift.zw, 0.65) * f1;
      // CAT'S PAWS: the wind is not even over the water - the ripples' strength wanders with a slow field
      // (the tile's own noise read at 45 m, 0.55..1.45), the dark and bright patches a gusty day shows
      float gust = 0.55 + 0.9 * texture2D(uWDetail, xz / 45.0 + vec2(0.37, 0.61)).a;
      return vec4((a.xy + b.xy * 0.6) * uWDetailK.z * gust, max(a.z * f0, b.z * f1), a.w);
    }
    // THE SUB-PIXEL BAND: the slope variance of the waves the pixel cannot resolve
    float wSigma2(float fp) {
      float tot = 0.003 + 0.00512 * uWWind.x;
      float lkc = log(1.0471976 / max(fp, 1.0e-4));   // 2 pi / (6 fp): a wave under 6 px is roughness (the slopes hand over between 12 and 3 px)
      float f = clamp((uWWind.z - lkc) / max(uWWind.z - uWWind.y, 1.0e-3), 0.0, 1.0);
      return tot * f;
    }
    // Cox-Munk's sigma^2 is the TOTAL mean-square slope (both axes); the Beckmann width m^2 = 2 sigma_x^2 = sigma^2;
    // GGX alpha ~ m; three's roughness = sqrt(alpha) -> sigma^(1/2) (G460.7: the 2 was counted twice before)
    float wRough(float s2) { return pow(max(s2, 1.0e-5), 0.25); }
    vec4 wInter(vec2 xz) {
      if (uWInterBox.w < 0.5) return vec4(0.0);
      vec2 uv = (xz - uWInterBox.xy) * uWInterBox.z;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
      vec4 t = texture2D(uWInter, uv);
      return vec4((t.rg * 2.0 - 1.0) * 2.0, t.b, t.a);   // slope over [-2, 2], foam
    }`;

  // ---- THE HOOK: one function object, the program's cache key ----------------------------------
  function hook(sh) {
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aWater; varying vec3 vWP; varying vec3 vWP0; varying vec2 vWBody;\nuniform vec4 uWTrA[32]; uniform vec4 uWTrD[32]; uniform int uWTrN; uniform vec4 uWWave; uniform vec4 uWNear;' + GLSL_GERSTNER)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
        vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
        float wh = 0.0;
        if (aWater.y > 0.5 && uWWave.x > 0.5) wh = wGerstnerH(wp0.x, wp0.z) * (1.0 - smoothstep(uWWave.z - 44.0, uWWave.z - 8.0, max(abs(wp0.x - uWNear.x), abs(wp0.z - uWNear.y))));   // flat 8 m before the box's edge: the last rows lap the far plane's cut at the level (G460.7 - the dashes)
        transformed.y += wh;
        vWP = vec3(wp0.x, wp0.y + wh, wp0.z); vWP0 = wp0; vWBody = aWater;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_FRAG_PARS)
      // the body colour: the column's own colour rising with depth, times what the surface lets in
      .replace('#include <map_fragment>', `
        int wB = int(vWBody.x + 0.5);
        if (wB == 0 && vWBody.y < 0.5 && uWNear.w > 0.5 && abs(vWP.x - uWNear.x) < uWNear.z && abs(vWP.z - uWNear.y) < uWNear.z) discard;
        vec2 wF = wField(vWP.xz);
        float wD = wDepth(wF, wB);
        // THE FOOTPRINT (G460.7): the GEOMETRIC MEAN of the pixel's two axes on the water, not the longer one.
        // At a grazing eye the along-view axis runs to metres while the across-view axis stays centimetres;
        // the longer one put the horizon's roughness at the Cox-Munk total and the far sea reflected the
        // probe's whole hemisphere - a grey-white sheet under the sky. The mean is the isotropic footprint
        // the slope-variance law was written for (Bruneton's Jacobian norm), and the glitter stays sharp
        // along the horizon as it does on a real sea. The felt band's per-train fade reads it too.
        float wFp = clamp(sqrt(length(dFdx(vWP0.xz)) * length(dFdy(vWP0.xz))), 1.0e-4, 1.0e4);
        vec3 wS = wGerstnerS(vWP.xz, wFp) * uWBody[wB].x;
        vec4 wDet = detailNormal(vWP.xz, wFp); wDet.xy *= uWBody[wB].y;
        vec4 wIn = wInter(vWP.xz);
        float wSig = uWWave.w > 0.5 ? wSigma2(wFp) : 0.0;
        // foam: the fold's crests, the tile's crests where the fold is high, the shore's lap, the field's own
        float wFoam = 0.0;
        if (uWMisc.w > 0.5) {
          // WHITECAPS (G460.5): the fold normalised by the steepest crest the trains can make; the fraction
          // of the sea above the threshold is Monahan's cover 3.84e-6 U10^3.41 (7 m/s: 3 %, 10: 10 %, under
          // 4: none), the tile's crest pattern tearing the patch; a lake's threshold row (foam 2) never breaks
          // (the fold in units of its own RMS - 32 trains with random phases add as sqrt(N), so the norm is
          // the RMS, not the sum; the threshold is the Gaussian quantile of the cover, 0.85 sqrt(-2 ln c) - 0.35:
          // 3 % -> 1.9 sigma, 10 % -> 1.5, 0.4 % -> 2.5 - so the fraction of the sea in foam IS the cover)
          float foldN = wS.z / max(uWFoam.x, 1.0e-4);
          float cv = uWFoam.y * (uWBody[wB].z < 1.5 ? 1.0 : 0.0);
          float tq = 0.85 * sqrt(-2.0 * log(max(cv, 1.0e-4))) - 0.35;
          float crest = smoothstep(tq, tq + 0.6, foldN) * (0.45 + 0.55 * wDet.z) * step(0.001, cv);
          // THE SHORE'S LAP: a band of foam over the last 4 m of the field, breathing with the swell's height at
          // the line (the sum of the trains there), torn by the tile's noise
          // (the coast field is a 30 m texel: a band read straight off it is a staircase of bilinear
          // patches, so the band is wide and faint, torn by a 7 m noise and by the swell's pulse - a wash,
          // never a white line)
          float lap = 0.0;
          if (uWSdfOn > 0.5 && wB == 0 && wF.x > -16.0) {
            float hh = clamp(wGerstnerH(vWP.x, vWP.z) / max(uWFoam.z, 0.03), -1.0, 1.0);
            float tear = texture2D(uWDetail, vWP.xz / 7.0 + vec2(0.13, 0.71)).a;
            lap = 0.55 * smoothstep(-14.0, -1.0, wF.x) * smoothstep(0.25, 0.85, tear * (0.65 + 0.35 * hh));
          }
          // THE FIELD'S FOAM (H7) is a coverage, not a paint: torn by the tile's noise at 2.3 m so a wake's
          // trail is a scatter of patches thinning as it decays (the untorn write was a solid white bar
          // 17 m long behind a hull, h7n/wake2.png), solid only where it is fresh
          float tearI = texture2D(uWDetail, vWP.xz / 2.3 + vec2(0.37, 0.11)).a;
          tearI = tearI * 0.7 + 0.3 * texture2D(uWDetail, vWP.xz / 0.65 + vec2(0.81, 0.29)).a;   // (G460.9) a second octave at 0.65 m: bubbles inside the patches
          float fieldFoam = wIn.z * smoothstep(0.15, 0.85, tearI * (0.55 + 0.9 * wIn.z));
          wFoam = clamp(crest + lap + fieldFoam, 0.0, 1.0);
        }
        vec3 wV = normalize(vViewPosition);
        vec3 wUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float wNoV = clamp(dot(wV, wUpV), 0.0, 1.0);
        float wFv = 0.02 + 0.98 * pow(1.0 - wNoV, 5.0);
        vec3 wCol = uWSct[wB].rgb * (1.0 - exp(-2.0 * uWAbs[wB].rgb * wD)) * (1.0 - wFv);
        diffuseColor.rgb = mix(wCol, vec3(0.85), wFoam);`)
      .replace('#include <alphamap_fragment>', `
        float wSA = wShoreA(wF, wB);
        wFoam *= wSA;                                                          // foam is on the water, never on the beach
        diffuseColor.a = max(wSA * (1.0 - exp(-uWAbs[wB].w * wD)), wFoam);
        if (diffuseColor.a <= 0.002) discard;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(max(roughness, wRough(wSig)), 0.9, wFoam);`)
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
        vec3 wNw = normalize(vec3(-(wS.x + wDet.x + wIn.x), 1.0, -(wS.y + wDet.y + wIn.y)));
        vec3 normal = normalize((viewMatrix * vec4(wNw, 0.0)).xyz) * faceDirection;
        // (G460.7: the UP normal, not the swell's - three adds geometryRoughness = |dFdx(nonPerturbedNormal)| to the
        // material's roughness, and the swell's normal changes per pixel at a grazing eye: +0.2..0.3 of roughness on
        // top of the slope-variance law that already holds the sub-pixel swell; the readback read 0.73 where the
        // law said 0.5, and the horizon went a flat pale sheet)
        vec3 nonPerturbedNormal = wUpV * faceDirection;
        // the reflection never looks under the horizon (the probe's lower half is the ground cap)
        vec3 wR = reflect(-wV, normal);
        vec3 wIblN = normalize(mix(normal, wUpV * faceDirection, smoothstep(0.12, -0.05, dot(wR, wUpV))));`)
      // THE ROUGH REFLECTION STAYS ABOVE THE HORIZON (G460.7, the user: "the horizon looks like a grey-white sheet"):
      // three's getIBLRadiance reads the PMREM at the reflected ray with the lobe of `roughness`, and at a grazing
      // eye that lobe straddles the horizon - half the sky, half the probe's ground cap - a flat grey. A sea's
      // rough reflection at grazing is the horizon SKY blurred along the horizon, never the ground: the sample
      // ray is lifted by the lobe's own half-angle (the GGX alpha = roughness^2, ~ the cone's tangent), so the
      // cone's lower edge sits on the horizon, and the specular gets the sky's colour and brightness there.
      .replace('#include <lights_fragment_maps>', (typeof THREE !== 'undefined' && THREE.ShaderChunk && THREE.ShaderChunk.lights_fragment_maps || '')
        .replace(/getIBLRadiance\( geometryViewDir, geometryNormal,/g, 'getIBLRadiance( geometryViewDir, wIblN,'))
      .replace('vec3 iblRadiance = getIBLRadiance( geometryViewDir, wIblN, material.roughness );', `
        vec3 iblRadiance;
        { vec3 rr = reflect(-geometryViewDir, wIblN); float ry = dot(rr, wUpV * faceDirection);
          float lift = material.roughness * material.roughness * 0.9;                  // the lobe's half-angle, as a tangent
          float want = max(ry, lift);                                                  // the ray's up-component the cone needs
          vec3 rr2 = normalize(rr + wUpV * faceDirection * (want - ry));               // lifted along up
          // a normal that reflects the view into rr2: the half vector of (V, rr2)
          vec3 nn = normalize(geometryViewDir + rr2);
          iblRadiance = getIBLRadiance( geometryViewDir, nn, material.roughness );
          // BRUNETON'S MEAN FRESNEL (2010, eq. for a rough sea): a prefiltered lookup has no masking - a rough sea at
          // grazing reflects a third of the mirror's sky, its facets shadowing each other and turning the eye toward
          // the higher, darker sky. meanFresnel = (1 - c)^(5 e^(-2.69 s)) / (1 + 22.7 s^1.5) against Schlick's (1 - c)^5:
          // the ratio, s = sqrt(sigma^2) of the sub-pixel band, applied to the sky's reflection (the sun's GGX has Smith)
          float wSg = sqrt(max(wSig, 0.0)), wC = clamp(dot(geometryViewDir, wUpV * faceDirection), 0.02, 1.0);
          float wF5 = pow(1.0 - wC, 5.0), wFm = pow(1.0 - wC, 5.0 * exp(-2.69 * wSg)) / (1.0 + 22.7 * pow(wSg, 1.5));
          // (G460.11.8: the factor is taken here and applied AFTER the mirror's mix below - with the sky
          // drawn into the capture the mirror supplies the WHOLE reflection, and a dim that rode only the
          // probe would have left the grazing sea a hard mirror again)
          float wMeanF = mix(1.0, clamp(wFm / max(wF5, 1.0e-4), 0.0, 1.0), smoothstep(0.55, 0.15, wC));
          // THE PLANAR MIRROR (G460.11, the user: "we can see tree reflections everywhere, while ours does not mirror
          // anything at all"): the decor - terrain, trees, the craft - captured from the eye mirrored about the water
          // plane (the sky left out: the probe carries the sky and its clouds, at the probe's own cadence), read where
          // this point projects in that capture, the lookup pushed by the wave slope, blurred by the roughness (the
          // capture's mips), and only where the capture has something (its alpha) - the probe's sky elsewhere
          if (uWMirror4.x > 0.5) {
            // THE PROJECTION IS FROM THE STILL SURFACE (G460.11.6, the user: "now for the seams"): the near patch is
            // a 3.75 m grid LIFTED by the swell, so vWP is faceted - and a capture projected through a faceted
            // position creases along every facet edge (straight world-axis lines across the near water, measured at
            // constant world x). The mirror's plane IS the still surface: the lookup comes from vWP0 (undisplaced)
            // and the wave's effect on the reflection is the slope's perturbation below, which is continuous
            // AND THE WAVE'S SLOPE MOVES THE POINT, NOT THE UV (G460.11.9, the user: "fix the perturbation
            // frame too"). The old push was muv += wNw.xz * k: a WORLD vector added to a CAPTURE uv whose x
            // axis is the NEGATIVE of the world's (lookAt with the reflected up re-orthonormalises to a
            // right-handed basis - measured, debug view 13), so a slope moved the reflection the wrong way
            // horizontally, by an amount that ignored the perspective, and in a frame nobody could name.
            // The honest form needs no frame at all. What the capture holds at the projection of a point Q on
            // the plane is the radiance arriving along the FLAT reflection of the eye-ray through Q - so to
            // read the radiance the TILTED facet sends to the eye, take its reflected ray R = reflect(V, n)
            // and follow it from the MIRRORED EYE back to the plane: Q = E' + R (h / R.y), h the eye's height
            // over the water. Q is vWP0 exactly when the surface is flat (proved in GATE WATER), the walk is
            // in metres on the water and so carries the perspective for free, and its direction is the
            // reflection's own. It is CAPPED at uWMirror4.y of the view distance: a facet at grazing has
            // R.y near zero and h / R.y near infinity, and an uncapped walk sends the lookup past the horizon
            vec3 mEye = cameraPosition;
            vec3 mR = reflect(normalize(vWP0 - mEye), wNw);
            float mH = mEye.y - uWMirror4.w, mL = max(distance(vWP0, mEye), 1.0e-3);
            float mT = mH / max(mR.y, min(mH / mL, 0.02));   // the floor never bites the FLAT ray (whose R.y is mH / mL): flat water must give back the point, at any grazing
            float mLim = uWMirror4.y * mL;
            vec3 mD = vec3(mEye.x + mR.x * mT, vWP0.y, mEye.z + mR.z * mT) - vWP0;
            mD *= min(1.0, mLim / max(length(mD), 1.0e-4));
            vec4 mp = uWMirrorVP * vec4(vWP0 + mD, 1.0);
            if (mp.w > 0.0) {
              vec2 muv = mp.xy / mp.w * 0.5 + 0.5;
              if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {
                vec4 mr = textureLod(uWMirror, muv, material.roughness * uWMirror4.z);
                float edge = smoothstep(0.0, 0.06, muv.x) * smoothstep(1.0, 0.94, muv.x) * smoothstep(0.0, 0.06, muv.y) * smoothstep(1.0, 0.94, muv.y);
                // THE CAPTURE IS PREMULTIPLIED (G460.11.2, the user: "there are strange reflections"): the foliage is
                // drawn with alphaToCoverage, so on the multisampled capture a half-covered canopy pixel RESOLVES to
                // alpha 0.5 and a colour weighted by it - blended as-is, half the probe's bright sky leaked through
                // every tree (pale blocky patches in the reflected forest, and blocky because 2 samples quantise the
                // coverage to 0 / 0.5 / 1). The colour is un-premultiplied (the mips filter it consistently) and the
                // canopy is made OPAQUE from a sixth of a sample up - a true gap between the trees (alpha 0) still
                // shows the sky, a thin twig no longer paints the sky over the wood
                vec3 mcol = mr.rgb / max(mr.a, 0.02);
                float mmask = smoothstep(0.06, 0.35, mr.a);
                iblRadiance = mix(iblRadiance, mcol, mmask * edge);
              }
            }
          }
          iblRadiance *= wMeanF; }`)
      .replace('#include <normal_fragment_maps>', '')
      // THE BODY COLOUR IS NOT A LAMBERT SURFACE (G460.5, the user: "it looks very matte blue"): three lights
      // material.diffuseColor by dot(N, L) on the WAVE normal, so every ridge was a painted stripe and the
      // waves read as a matte relief instead of a reflection. The colour of water is light scattered INSIDE
      // it - it depends on the sun over the flat sea, not on the local slope - so the material's diffuse is
      // zeroed (the GGX specular and the IBL keep the wave normal) and the column colour is added lit by the
      // UP normal: each directional light's colour (its shadow and the cloud's already in it) x saturate(up . L)
      // x Lambert, and the ambient + sky irradiance after the loop. The waves now live only in the reflection.
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        vec3 wDiff = material.diffuseContribution; material.diffuseColor = vec3(0.0); material.diffuseContribution = vec3(0.0);
        vec3 wUpN = wUpV * faceDirection;`)
      .replace('#include <lights_fragment_begin>', (typeof THREE !== 'undefined' && THREE.ShaderChunk && THREE.ShaderChunk.lights_fragment_begin || '')
        .replace(/RE_Direct\( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight \);/g,
          'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); reflectedLight.directDiffuse += directLight.color * saturate(dot(wUpN, directLight.direction)) * BRDF_Lambert(wDiff);'))
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += (irradiance + iblIrradiance) * BRDF_Lambert(wDiff);`)
      // the debug views are the LAST word: a plain value, no light, no tone map, no AP (the rig reads them back)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uWDbg == 1) gl_FragColor = vec4(wNw * 0.5 + 0.5, 1.0);
        else if (uWDbg == 2) gl_FragColor = vec4(vec3(roughnessFactor), 1.0);
        else if (uWDbg == 3) gl_FragColor = vec4(vec3(wSig * 8.0), 1.0);
        else if (uWDbg == 4) gl_FragColor = vec4(vec3(wD / 20.0), 1.0);
        else if (uWDbg == 5) gl_FragColor = vec4(vec3(wFoam), 1.0);
        else if (uWDbg == 6) gl_FragColor = vec4(vec3(diffuseColor.a), 1.0);
        else if (uWDbg == 7) gl_FragColor = vec4(float(wB == 0), float(wB == 1), float(wB >= 2), 1.0);
        else if (uWDbg == 8) gl_FragColor = vec4(vec3(wGerstnerH(vWP.x, vWP.z) * 0.5 + 0.5), 1.0);
        else if (uWDbg == 9) { vec2 q = (vWP.xz - uWInterBox.xy) * uWInterBox.z; gl_FragColor = vec4(q, wIn.z, 1.0); }
        else if (uWDbg == 10) gl_FragColor = vec4(0.5 + 3.0 * wIn.x, 0.5 + 3.0 * wIn.y, wIn.z, 1.0);   // the field's slope (G460.10: the wake's V read straight off the sheet)
        else if (uWDbg == 13) { vec4 mp = uWMirrorVP * vec4(vWP, 1.0); vec2 muv = mp.xy / max(mp.w, 1.0e-4) * 0.5 + 0.5; vec2 suv = gl_FragCoord.xy / uWRes; vec2 d = muv - suv; gl_FragColor = vec4(0.5 + 20.0 * d.x, 0.5 + 20.0 * d.y, 0.5, 1.0); }   // (G460.11.4) the projected uv against the pixel's own: grey = they agree
        else if (uWDbg == 12) { vec2 muv = gl_FragCoord.xy / uWRes; vec4 mr = texture2D(uWMirror, muv); gl_FragColor = vec4(mr.rgb / max(mr.a, 0.02) * step(0.06, mr.a), 1.0); }   // (G460.11.4) the capture at the PIXEL'S OWN screen place: for a point on the water plane the projection must agree with it
        else if (uWDbg == 11) { vec4 mp = uWMirrorVP * vec4(vWP, 1.0); vec2 muv = mp.xy / max(mp.w, 1.0e-4) * 0.5 + 0.5; vec4 mr = texture2D(uWMirror, muv); gl_FragColor = vec4(mr.rgb * mr.a + vec3(0.0, 0.0, 0.3) * (1.0 - mr.a), 1.0); }   // the mirror's capture where it lands (G460.11.1: alpha 0 = blue)`);
  }

  // ---- THE PRESETS: one row per body ------------------------------------------------------------
  // abs: absorption per metre (linear rgb), opa: the column's opacity rate per metre; sct: the colour the
  // column shows at depth (linear); wave: the felt band's scale; detail: the tile's; foam: the fold at
  // which a crest breaks; depth: the column when there is no field (the analytic world, the editor)
  // THE COLOUR OF A WATER IS ITS CONSTITUENTS' (G460.11, the user: "you may need different colors for lakes and
  // sea - how to do that properly and principled?"): the bio-optical model of ocean colour (Morel & Prieur 1977,
  // Gordon 1988) - the upwelling reflectance R(lambda) = 0.33 b_b / (a + b_b), absorption a = pure water + CDOM
  // (the yellow substance: tannins, humics - the exponential a_g(440) e^(-0.014 (lambda - 440))) + chlorophyll,
  // backscatter b_b = pure water + particles (sediment); the diffuse attenuation Kd ~ a + b_b. Three bands
  // (620 / 550 / 450 nm for R / G / B). Pure water absorbs red 20 x more than blue (the blue of clear water);
  // CDOM absorbs blue (the brown of a muskeg lake); chlorophyll absorbs blue and red (the green of a bloom);
  // sediment scatters every band (the milk of a glacial river). The ARTIST'S numbers are three per body -
  // CDOM a_g(440) m^-1, chlorophyll mg/m^3, sediment g/m^3 - and the colour follows: a body is never a
  // painted colour. Jerlov's coastal type 3 for this sound (a_g 0.08, chl 1.5, a little sediment); a muskeg
  // lake at a_g 3 (the tannin of the bog: near-black, the reflection IS its colour, as on the photo); a
  // glacial river silted. The old presets painted the sea 10 % blue / 7 % green at depth - a lagoon; real
  // cold coastal water upwells 1-2 %, green over blue, and its blue is the SKY'S reflection.
  const WATER_TYPES = {
    sea:      { cdom: 0.08, chl: 1.5, sed: 0.5 },
    lake:     { cdom: 3.0,  chl: 2.0, sed: 0.3 },
    river:    { cdom: 1.2,  chl: 1.0, sed: 2.5 },
    premises: { cdom: 0.08, chl: 1.5, sed: 0.5 },
  };
  function bodyOptics(w) {
    const AW = [0.28, 0.064, 0.0145];                   // pure water absorption, m^-1 (620 / 550 / 450 nm; Pope & Fry)
    const BBW = [0.0007, 0.0011, 0.0025];               // pure water backscatter (b_bw ~ lambda^-4.3)
    const CG = [Math.exp(-0.014 * (620 - 440)), Math.exp(-0.014 * (550 - 440)), Math.exp(-0.014 * (450 - 440))];   // CDOM's slope
    const APH = [0.012, 0.004, 0.035];                  // chlorophyll-specific absorption per mg/m^3 (the blue and red peaks)
    const BBP = 0.004;                                  // particle backscatter per g/m^3 of sediment, flat
    const sct = [], abs = [];
    for (let c = 0; c < 3; c++) {
      const a = AW[c] + w.cdom * CG[c] + w.chl * APH[c], bb = BBW[c] + w.sed * BBP;
      sct.push(0.33 * bb / (a + bb)); abs.push(a + bb);
    }
    return { sct, abs, opa: Math.max(0.3, Math.min(3, 2.5 * abs[1])) };
  }
  const PRESETS = {};
  for (const k of ['sea', 'lake', 'river', 'premises']) PRESETS[k] = Object.assign(bodyOptics(WATER_TYPES[k]), { wave: 0, detail: 0.7, foam: 2.0, depth: 6 });
  Object.assign(PRESETS.sea, { wave: 1.0, detail: 1.0, foam: 0.62, depth: 14 });
  // a muskeg lake (Jolene's): the column from its field 1.2 m per metre of field to 8 m - the bed shows only along the very edge
  Object.assign(PRESETS.lake, { wave: 0.0, detail: 0.55, foam: 2.0, depth: 4 });
  Object.assign(PRESETS.river, { wave: 0.0, detail: 0.35, foam: 2.0, depth: 1.5 });
  Object.assign(PRESETS.premises, { wave: 0.0, detail: 0.7, foam: 2.0, depth: 6 });
  const BODIES = ['sea', 'lake', 'river', 'premises'];

  // ---- THE DIALS ------------------------------------------------------------------------------
  const S = {
    on: true, displace: true, detail: true, sigma: true, foam: true, dbg: 0,
    tier: 'full',                      // simple | full (gfx_settings); S.on is the dev kill switch (an A/B, not a tier)
    detailL: [3.2, 0.75],              // the two tile lengths (m)
    detailK: 1.0,                      // the detail band's strength
    shoreFade: 3.0,                    // m of field the sea fades over
    lakeK: 1.2, lakeCap: 8.0,          // a lake's depth per metre of its field, and its cap
    foldQ: 0.55,                       // the virtual Gerstner Q of the fold
  };

  // ---- the uniforms (one set; every material instance shares them by reference) -----------------
  let U = null, mat = null, T3 = null;
  const IN = { sdf: null, grid: null, wind: [0, 0], inter: null, box: [0, 0, 0] };   // the inputs, kept so a call before make() is not lost
  const T = { t: 0, set: false, seen: 0, free: 0 };   // the clock: t, whether setTime spoke this frame
  let seaKey = '', trains = [];                       // the trains as last packed
  function makeU(THREE) {
    const v4 = (x, y, z, w) => new THREE.Vector4(x || 0, y || 0, z || 0, w || 0);
    const arr = n => { const a = []; for (let i = 0; i < n; i++) a.push(v4()); return a; };
    U = {
      uWTrA: { value: arr(NTR) }, uWTrD: { value: arr(NTR) }, uWTrN: { value: 0 },
      uWWave: { value: v4(1, 12, 0, 0.5) }, uWWind: { value: v4(0, Math.log(TWO_PI / 20), Math.log(TWO_PI / 0.005), 1) },
      uWDetailK: { value: v4(S.detailL[0], S.detailL[1], S.detailK, 1) }, uWDrift: { value: v4() }, uWDir: { value: v4(1, 0, 0, 0) },
      uWAbs: { value: arr(4) }, uWSct: { value: arr(4) }, uWBody: { value: arr(4) },
      uWMisc: { value: v4(S.shoreFade, S.lakeK, S.lakeCap, 1) }, uWFoam: { value: v4(1, 0, 0, 0) },
      uWSdf: { value: null }, uWGrid: { value: v4(0, 0, 1, 1) }, uWSdfOn: { value: 0 },
      uWDetail: { value: null }, uWInter: { value: null }, uWInterBox: { value: v4() },
      uWMirror: { value: null }, uWMirrorVP: { value: new THREE.Matrix4() }, uWMirror4: { value: v4() }, uWRes: { value: new THREE.Vector2(1920, 1080) },
      uWNear: { value: v4() }, uWDbg: { value: 0 },
    };
    applyPresets();
  }
  function applyPresets() {
    if (!U) return;
    BODIES.forEach((k, i) => { const p = PRESETS[k];
      U.uWAbs.value[i].set(p.abs[0], p.abs[1], p.abs[2], p.opa);
      U.uWSct.value[i].set(p.sct[0], p.sct[1], p.sct[2], 0);
      U.uWBody.value[i].set(p.wave, p.detail, p.foam, p.depth); });
  }

  // ---- THE TILE: a periodic sum of cosines, slopes exact, baked once ----------------------------
  // N x N texels over one tile length; integer wave numbers make it tile by construction; the spectrum
  // is an equilibrium k^-3 in height (k^-2 in slope) over wavelengths L/2 .. L/24 with a cos^2 spread
  // about +x (the wind); the crest channel is the height's own -Laplacian; the alpha a value noise.
  // Deterministic (its own LCG), ~2 ms at 256. `w` is the slope range the RG encode spans.
  function bakeTile(N, seed) {
    N = N || 256;
    let s = (seed || 12345) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    // a PEAKED spectrum (a Pierson-Moskowitz shape in k: k^-3 above the peak at kp cycles, a k^-4
    // roll-off under it - a single dominant long wave read as stripes), a wide cos^2 spread over
    // +-75 deg about +x, 96 waves; integer (ix, iz) keeps the tile periodic
    const waves = [], kp = 6;
    for (let m = 0; m < 96; m++) {
      const kk = 3 + rnd() * 25;                                    // |k| in tile cycles: 3..28
      const th = (rnd() - 0.5) * 2.6;                               // about +x, +-75 deg
      const ix = Math.round(kk * Math.cos(th)), iz = Math.round(kk * Math.sin(th));
      const k = Math.hypot(ix, iz);
      if (k < 2.5) continue;
      const amp = Math.pow(k, -3) * Math.exp(-1.25 * Math.pow(kp / k, 4)) * Math.pow(Math.cos(th), 2) * (0.7 + 0.6 * rnd());
      waves.push({ kx: ix * TWO_PI, kz: iz * TWO_PI, a: amp, ph: rnd() * TWO_PI, k2: k * k * TWO_PI * TWO_PI });
    }
    const h = new Float32Array(N * N), sx = new Float32Array(N * N), sz = new Float32Array(N * N), lap = new Float32Array(N * N);
    let hmax = 0;
    for (let j = 0, p = 0; j < N; j++) for (let i = 0; i < N; i++, p++) {
      const u = i / N, v = j / N; let H = 0, X = 0, Z = 0, L = 0;
      for (const w of waves) { const ph = w.kx * u + w.kz * v + w.ph; const c = Math.cos(ph), sn = Math.sin(ph);
        H += w.a * c; X -= w.a * w.kx * sn; Z -= w.a * w.kz * sn; L -= w.a * w.k2 * c; }
      h[p] = H; sx[p] = X; sz[p] = Z; lap[p] = L; if (Math.abs(H) > hmax) hmax = Math.abs(H);
    }
    // THE CRESTS SHARPEN, THE TROUGHS FLATTEN (G460.11): a Stokes second-order profile h' = h + c h^2 / hmax
    // (c 0.4) - a sum of cosines is a gaussian sea, symmetric, and read as a soft plastic sheen up close;
    // the real chop is cusped. The slopes follow: s' = s (1 + 2 c h / hmax); the Laplacian (the crest mask)
    // keeps its own sign
    { const c = 0.4 / (hmax || 1); for (let p = 0; p < N * N; p++) { const k = 1 + 2 * c * h[p]; sx[p] *= k; sz[p] *= k; h[p] += c * h[p] * h[p]; } }
    // normalise: the tile's height RMS at its own length is set so the slope RMS is ~0.09 per unit
    // strength (a 5 m/s chop over a 3 m tile) - the strength dial and the wind scale it from there
    let srms = 0; for (let p = 0; p < N * N; p++) srms += sx[p] * sx[p] + sz[p] * sz[p];
    srms = Math.sqrt(srms / (N * N)); const g = 0.09 / (srms || 1);
    const W = 0.5;                                                   // the encode's slope range
    let lmin = 1e9, lmax = -1e9; for (let p = 0; p < N * N; p++) { const l = -lap[p] * g; if (l < lmin) lmin = l; if (l > lmax) lmax = l; }
    const data = new Uint8Array(N * N * 4);
    const noise = (i, j) => { const q = ((i * 73856093) ^ (j * 19349663)) >>> 0; return ((q * 2654435761) >>> 0) / 4294967296; };
    for (let j = 0, p = 0; j < N; j++) for (let i = 0; i < N; i++, p++) {
      const cx = Math.max(-W, Math.min(W, sx[p] * g)) / W * 0.5 + 0.5, cz = Math.max(-W, Math.min(W, sz[p] * g)) / W * 0.5 + 0.5;
      const cr = (-lap[p] * g - lmin) / (lmax - lmin || 1);
      const crest = Math.max(0, Math.min(1, (cr - 0.62) / 0.38));
      const n0 = noise(i >> 3, j >> 3), n1 = noise((i >> 3) + 1, j >> 3), n2 = noise(i >> 3, (j >> 3) + 1), n3 = noise((i >> 3) + 1, (j >> 3) + 1);
      const fx = (i & 7) / 8, fz = (j & 7) / 8;
      const nz = (n0 * (1 - fx) + n1 * fx) * (1 - fz) + (n2 * (1 - fx) + n3 * fx) * fz;
      data[p * 4] = Math.round(cx * 255); data[p * 4 + 1] = Math.round(cz * 255); data[p * 4 + 2] = Math.round(crest * 255); data[p * 4 + 3] = Math.round(nz * 255);
    }
    return { data, N, w: W, srms: 0.09, hmax: hmax * g };
  }
  let tile = null;
  function makeTile(THREE) {
    if (tile) return tile;
    const b = bakeTile(256, 12345);
    const t = new THREE.DataTexture(b.data, b.N, b.N, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.flipY = false; t.anisotropy = 8; t.needsUpdate = true;
    tile = t; tile.userData.bake = { N: b.N, w: b.w };
    return t;
  }

  // THE SLOT'S TEST TEXTURE (the dev panel's, the bench's): a Kelvin V (19.47 deg) of 1.2 m ripples
  // astern of the box's centre, the foam fading astern - the shape H7 will write live. RG = slope
  // over [-2, 2], B = foam; `size` metres square, the aeroplane flying +x.
  function paintTestV(THREE, N, size) {
    N = N || 128; size = size || 80;
    const cell = size / N, H = new Float32Array(N * N), FM = new Float32Array(N * N), d = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / N - 0.5) * size, z = (j / N - 0.5) * size;
      for (const sgn of [-1, 1]) { const v2 = z + sgn * Math.tan(19.47 * Math.PI / 180) * x; if (x < 0 && x > -36 && Math.abs(v2) < 4.0) { const r = Math.exp(-v2 * v2 / 4.0); H[j * N + i] += 0.12 * r * Math.sin(x * 5.2 + v2 * 2.0); FM[j * N + i] = Math.max(FM[j * N + i], 0.9 * r * (1 + x / 36)); } }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q = j * N + i, p = q * 4;
      const sx = (H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)]) / (2 * cell), sz = (H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i]) / (2 * cell);
      d[p] = Math.round(Math.max(0, Math.min(1, 0.5 + sx / 4)) * 255); d[p + 1] = Math.round(Math.max(0, Math.min(1, 0.5 + sz / 4)) * 255); d[p + 2] = Math.round(FM[q] * 255); d[p + 3] = 255;
    }
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
    return t;
  }


  // ---- THE INTERACTION FIELD (H7, G460.8; dispersive + two levels G460.10): the wakes, the ripples, the splashes
  // A world-locked heightfield over FIELD_M = 192 m following the aeroplane (aft of the CG under way: a
  // quarter of the box ahead, three quarters of trail), in TWO LEVELS over the same box - a fine sheet of
  // 384^2 (0.5 m a texel: a splash's rings, the chines' short waves) and a coarse one of 96^2 (2 m: the
  // wake's long transverse and diverging waves) - stepped every frame by a DISPERSIVE deep-water step
  // (the user: "the wake of highest quality"): h_tt = -g sqrt(-lap) h, iWave's form (Tessendorf 2004),
  // the vertical derivative as a 13 x 13 convolution. Every wavelength travels at its own speed
  // (omega^2 = g k), so a moving press leaves KELVIN'S V of 19.47 deg with its transverse waves (2 pi
  // V^2 / g: 23 m at 6 m/s) and a ring spreads into a train; a single-speed sheet (the first cut, c =
  // 1.6 m/s) left a stripe of half-angle asin(c / V). THE KERNEL is not iWave's Bessel integral (its
  // truncation to 13 texels leaked a DC term that the usual zero-sum fix turned into a NEGATIVE response
  // at the short waves - exponential growth of the checkerboard): it is designed in the spectrum -
  // R(k) = k exp(-(k / 1.6)^2) inverse-transformed on a 96^2 lattice, Hann-windowed to the support,
  // its DC leak subtracted as a wide gaussian (not a delta), scaled so the response IS |k| at k = 0.5 a
  // texel; the response is then ~|k| over lambda 6..16 texels, half of it at 31, never negative, and
  // a little viscosity (nu lap h) holds the Nyquist modes. A finite kernel can never give |k| to waves
  // much longer than its support (a zero-sum kernel is a Laplacian there) - which is why there are two
  // levels: each takes the band its texel puts inside the kernel's window (3-8 m, 11-32 m), the coarse
  // one stamped with a broader, shallower press (the hull's whole displacement, not its chine).
  // An absorbing rim over the last 4 % of the box (an edge would ring), STAMPS folded into the step (up
  // to FIELD_MAXS a frame: a gaussian press toward a hull's draft, a ring for a splash, foam along a
  // chine), and a DERIVE pass that sums both levels' slopes into the slot's texture (RG the slope over
  // [-2, 2], B the foam - the fine level's own channel, decaying with a 2 s e-fold). The box moves
  // snapped to the fine texel and each step reads its previous state through the move's offset, so the
  // water stands still in the world while the box slides. The physics does not feel the field (a ripple
  // is not a wave the floats ride); the shader adds its slope to the normal and its foam to the mask
  // through the slot G460 opened (setInteraction); the near patch is NOT displaced by it. Cost: the fine
  // step's 169 taps over 384^2 (~25 M) + the coarse (1.5 M) + the derive, ~0.4 ms; the fine level's
  // highest mode has omega dt = 0.07 at 60 Hz (dt clamped at 1/30).
  const FIELD_M = 192, FIELD_MAXS = 16, KERN_P = 6;
  const LEVELS = [{ N: 384 }, { N: 96 }];
  const FIELD_N = LEVELS[0].N;
  // (the damping is PER SECOND - tau, foamTau - not per frame: a per-frame constant killed every wave in half a
  // second on the bench's unlimited 970 fps and let them live three times longer under the rig's 20)
  const F = { on: false, g: 9.81, tau: 8, foamTau: 2, rim: 0.04, nu: 0.04, aft: 0.25, ox: 0, oz: 0, ax: 0, az: 0, ready: false, stamps: [], t: 0,
    L: [], out: null, scene: null, cam: null, quad: null, stepMat: null, deriveMat: null, ready2: false, kern: null, gain: 1,
    coarse: { pressR: 3.5, pressA: 1.2, ringR: 2.5, ringA: 0.4 } };   // the coarse press: the hull's whole displacement (r x 3.5 = the float's length, deeper than the chine's)
  const FIELD_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const FIELD_STEP = `precision highp float; varying vec2 vUv;
    uniform sampler2D uPrev; uniform vec2 uShift;     // the box's move since the last step, in uv (the previous state read shifted)
    uniform vec4 uK;                                   // x: g dt^2 / dx x the kernel's gain, y: damp, z: foam decay, w: the rim (uv)
    uniform float uKern[${(KERN_P + 1) * (KERN_P + 1)}];   // the vertical-derivative kernel's 7 x 7 quadrant (radial: |i| * 7 + |j|)
    uniform float uNu;                                 // the viscosity on the Laplacian (the Nyquist modes' brake)
    uniform vec4 uStampA[${FIELD_MAXS}];               // x, z (uv), r (uv), amp (m)
    uniform vec4 uStampB[${FIELD_MAXS}];               // x: kind (0 press, 1 ring, 2 foam), y: foam, z: 0, w: 0
    uniform int uNStamp;
    uniform float uTexel;
    vec4 prev(vec2 uv) { vec2 q = uv + uShift; if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0); return texture2D(uPrev, q); }
    void main() {
      vec4 c = prev(vUv);
      float h = c.r, hp = c.g, foam = c.b;
      // the vertical derivative sqrt(-lap) h: the 13 x 13 convolution (a plane wave e^(ikx) comes back as |k| h)
      float vd = 0.0, lap = -4.0 * h;
      for (int i = -${KERN_P}; i <= ${KERN_P}; i++) for (int j = -${KERN_P}; j <= ${KERN_P}; j++) {
        int ai = i < 0 ? -i : i, aj = j < 0 ? -j : j;
        float hh = prev(vUv + vec2(float(i), float(j)) * uTexel).r;
        vd += uKern[ai * ${KERN_P + 1} + aj] * hh;
        if (ai + aj == 1) lap += hh;
      }
      float hn = (2.0 * h - hp) * uK.y - uK.x * vd + uNu * lap;
      // the absorbing rim: the amplitude eased to nothing over the last uK.w of uv on every side
      float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float rim = smoothstep(0.0, uK.w, e);
      hn *= mix(0.9, 1.0, rim);
      float fn = foam * uK.z, ds = 0.0;
      for (int i = 0; i < ${FIELD_MAXS}; i++) {
        if (i >= uNStamp) break;
        vec4 a = uStampA[i]; vec4 b = uStampB[i];
        vec2 d = vUv - a.xy; float r2 = dot(d, d) / max(a.z * a.z, 1.0e-8);
        if (r2 > 4.0) continue;
        float g = exp(-r2 * 1.5);
        if (b.x < 0.5) ds += (a.w - hn) * g * 0.5;                                  // a press: the surface pushed toward the hull's draft
        else if (b.x < 1.5) ds += a.w * (1.0 - 2.0 * r2) * g;                       // a ring: a crater with a rim (a splash's first instant)
        fn = max(fn, b.y * g);
      }
      // a stamp DISPLACES the surface - the new height AND the previous move together (no velocity in the
      // stamp itself), and the displacement radiates from there; a stamp on the height alone read as a
      // velocity to the leapfrog and the crater deepened instead of rebounding
      gl_FragColor = vec4(hn + ds, h + ds, clamp(fn, 0.0, 1.0), 1.0);
    }`;
  const FIELD_DERIVE = `precision highp float; varying vec2 vUv;
    uniform sampler2D uState; uniform float uTexel; uniform float uDx;      // the fine level: its texel in uv, in metres
    uniform sampler2D uState1; uniform float uTexel1; uniform float uDx1;   // the coarse level
    void main() {
      float hx = texture2D(uState, vUv + vec2(uTexel, 0.0)).r - texture2D(uState, vUv - vec2(uTexel, 0.0)).r;
      float hz = texture2D(uState, vUv + vec2(0.0, uTexel)).r - texture2D(uState, vUv - vec2(0.0, uTexel)).r;
      float hx1 = texture2D(uState1, vUv + vec2(uTexel1, 0.0)).r - texture2D(uState1, vUv - vec2(uTexel1, 0.0)).r;
      float hz1 = texture2D(uState1, vUv + vec2(0.0, uTexel1)).r - texture2D(uState1, vUv - vec2(0.0, uTexel1)).r;
      vec2 sl = vec2(hx, hz) / (2.0 * uDx) + vec2(hx1, hz1) / (2.0 * uDx1);   // the slope, m/m, both levels
      float foam = texture2D(uState, vUv).b;
      gl_FragColor = vec4(clamp(sl / 4.0 + 0.5, 0.0, 1.0), foam, 1.0);   // the slot's encode: (rg 2 - 1) 2
    }`;
  // fieldKernel(P): the vertical-derivative kernel designed in the spectrum (see the head note): R(k) =
  // k exp(-(k / kc)^2) inverse-transformed on a 96^2 lattice, Hann-windowed to radius P + 1, its DC
  // leak subtracted as a gaussian of 2.5 texels, then scaled (fieldKernelGain) so that a plane wave of
  // k = 0.5 rad per texel comes back as 0.5 x itself; returned as the (P + 1)^2 quadrant (radial)
  function fieldKernel(P, kc, sw) {
    kc = kc || 1.6; sw = sw || 2.5;
    const NG = 96, Q = P + 1, K = new Float32Array(Q * Q);
    for (let i = 0; i <= P; i++) for (let j = 0; j <= P; j++) {
      let v = 0;
      for (let m = -NG / 2; m < NG / 2; m++) for (let n = -NG / 2; n < NG / 2; n++) {
        const kx = 2 * Math.PI * m / NG, ky = 2 * Math.PI * n / NG, k = Math.hypot(kx, ky);
        v += k * Math.exp(-(k / kc) * (k / kc)) * Math.cos(kx * i + ky * j);
      }
      const r = Math.hypot(i, j), w = r <= P + 1 ? 0.5 * (1 + Math.cos(Math.PI * r / (P + 1))) : 0;
      K[i * Q + j] = v / (NG * NG) * w;
    }
    const sum = kernelSum(K, P);
    let gs = 0; for (let i = -P; i <= P; i++) for (let j = -P; j <= P; j++) gs += Math.exp(-(i * i + j * j) / (2 * sw * sw));
    for (let i = 0; i <= P; i++) for (let j = 0; j <= P; j++) K[i * Q + j] -= sum * Math.exp(-(i * i + j * j) / (2 * sw * sw)) / gs;
    return K;
  }
  function kernelSum(K, P) { let s = 0; for (let i = -P; i <= P; i++) for (let j = -P; j <= P; j++) s += K[Math.abs(i) * (P + 1) + Math.abs(j)]; return s; }
  // the kernel's response to a plane wave cos(k x) (k in rad per texel) - the dispersion the sheet actually has
  function kernelResponse(K, P, k) { let r = 0; for (let i = -P; i <= P; i++) for (let j = -P; j <= P; j++) r += K[Math.abs(i) * (P + 1) + Math.abs(j)] * Math.cos(k * i); return r; }
  function fieldKernelGain(K, P) { return 0.5 / kernelResponse(K, P, 0.5); }
  function fieldInit(THREE, renderer) {
    if (F.ready2) return true;
    if (!THREE.WebGLRenderTarget || !THREE.ShaderMaterial || !renderer) return false;
    const mk = (N, type) => { const rt = new THREE.WebGLRenderTarget(N, N, { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
      rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping; return rt; };
    F.L = LEVELS.map(l => ({ N: l.N, dx: FIELD_M / l.N, rt: [mk(l.N, THREE.HalfFloatType), mk(l.N, THREE.HalfFloatType)], ping: 0 }));
    // (half float, not bytes: a byte slot's 0.5 is 127.5, rounded to 128 = a 0.45 deg tilt over the whole box - the glint
    // showed the box as a brighter rectangle with a seam at its edge from 120 m, G460.11)
    F.out = mk(FIELD_N, THREE.HalfFloatType);
    F.scene = new THREE.Scene(); F.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    F.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); F.quad.frustumCulled = false; F.scene.add(F.quad);
    F.kern = fieldKernel(KERN_P); F.gain = fieldKernelGain(F.kern, KERN_P);
    const v4 = () => new THREE.Vector4();
    F.stepMat = new THREE.ShaderMaterial({ vertexShader: FIELD_VERT, fragmentShader: FIELD_STEP, depthTest: false, depthWrite: false,
      uniforms: { uPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uK: { value: v4() }, uKern: { value: F.kern }, uNu: { value: F.nu },
        uStampA: { value: Array.from({ length: FIELD_MAXS }, v4) }, uStampB: { value: Array.from({ length: FIELD_MAXS }, v4) }, uNStamp: { value: 0 }, uTexel: { value: 1 / FIELD_N } } });
    F.deriveMat = new THREE.ShaderMaterial({ vertexShader: FIELD_VERT, fragmentShader: FIELD_DERIVE, depthTest: false, depthWrite: false,
      uniforms: { uState: { value: null }, uTexel: { value: 1 / F.L[0].N }, uDx: { value: F.L[0].dx }, uState1: { value: null }, uTexel1: { value: 1 / F.L[1].N }, uDx1: { value: F.L[1].dx } } });
    F.ready2 = true;
    return true;
  }
  // stamp(x, z, r, amp, foam, kind): a disturbance this frame - r in metres, amp in metres (a press: the
  // surface's target height; a ring: the crater's depth), foam 0..1, kind 'press' | 'ring' | 'foam'
  function stamp(x, z, r, amp, foam, kind) {
    if (F.stamps.length >= FIELD_MAXS) return false;
    F.stamps.push({ x, z, r, amp: amp || 0, foam: foam || 0, kind: kind === 'ring' ? 1 : kind === 'foam' ? 2 : 0 });
    return true;
  }
  // fieldStep(THREE, renderer, cx, cz, dt, vx, vz): the box to the CG (aft of it under way, snapped to the
  // fine texel), each level's previous state read through the move, the stamps folded in (the coarse level's
  // press broader and shallower), the slot's texture derived; called once a frame by app.js before the render
  function fieldStep(THREE, renderer, cx, cz, dt, vx, vz) {
    if (!F.on || !fieldInit(THREE, renderer)) { F.stamps.length = 0; return; }
    if (!(dt > 0)) { F.stamps.length = 0; return; }   // a paused sim is a frozen sheet (the slot keeps its last texture; a 1 ms floor stepped the rings out across a paused lake)
    const dx = F.L[0].dx;
    const sp = Math.hypot(vx || 0, vz || 0);
    if (sp > 0.5) { const k = Math.min(1, dt * 0.5); F.ax += (vx / sp - F.ax) * k; F.az += (vz / sp - F.az) * k; }
    const aft = F.aft * FIELD_M * Math.min(1, sp / 4);
    cx -= F.ax * aft; cz -= F.az * aft;
    const nx = Math.round((cx - FIELD_M / 2) / dx) * dx, nz = Math.round((cz - FIELD_M / 2) / dx) * dx;
    const shift = F.ready ? [(nx - F.ox) / FIELD_M, (nz - F.oz) / FIELD_M] : [0, 0];
    // the caller's target and clear state, read BEFORE the first-use clears (read after them, the first step
    // handed the app back the state target, and every frame after it drew the world into 256^2 - a frozen canvas)
    const prevT = renderer.getRenderTarget(), ac = renderer.autoClear;
    if (!F.ready) {   // a still sea: the state cleared to ZERO (renderer.clear() alone writes the sky's clear colour - the first field stood 0.67 m high everywhere)
      F.ready = true; F.ox = nx; F.oz = nz;
      const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 0);
      for (const L of F.L) { renderer.setRenderTarget(L.rt[0]); renderer.clear(true, false, false); renderer.setRenderTarget(L.rt[1]); renderer.clear(true, false, false); }
      renderer.setClearColor(cc, ca);
    }
    F.ox = nx; F.oz = nz;
    const U = F.stepMat.uniforms;
    // the vertical derivative's gain g dt^2 / dx x the kernel's; dt clamped at 1/30 (a long frame would over-step the kernel's highest mode)
    const dtc = Math.min(1 / 30, Math.max(dt, 1e-3));
    const n = Math.min(FIELD_MAXS, F.stamps.length);
    renderer.autoClear = false;
    for (let li = 0; li < F.L.length; li++) {
      const L = F.L[li], src = L.rt[L.ping], dst = L.rt[1 - L.ping], C = F.coarse;
      U.uPrev.value = src.texture; U.uShift.value.set(shift[0], shift[1]); U.uTexel.value = 1 / L.N;
      U.uK.value.set(F.g * dtc * dtc / L.dx * F.gain, Math.exp(-dtc / F.tau), Math.exp(-dtc / F.foamTau), F.rim);
      let m = 0;
      for (let i = 0; i < n; i++) { const st = F.stamps[i];
        if (li === 1 && st.kind === 2) continue;   // foam is the fine level's
        const rS = li === 1 ? (st.kind === 1 ? C.ringR : C.pressR) : 1, aS = li === 1 ? (st.kind === 1 ? C.ringA : C.pressA) : 1;
        U.uStampA.value[m].set((st.x - nx) / FIELD_M, (st.z - nz) / FIELD_M, Math.max(st.r * rS, L.dx) / FIELD_M, st.amp * aS);
        U.uStampB.value[m].set(st.kind, st.foam, 0, 0); m++; }
      U.uNStamp.value = m;
      F.quad.material = F.stepMat; renderer.setRenderTarget(dst); renderer.render(F.scene, F.cam);
      L.ping = 1 - L.ping;
    }
    F.stamps.length = 0;
    const D = F.deriveMat.uniforms;
    D.uState.value = F.L[0].rt[F.L[0].ping].texture; D.uState1.value = F.L[1].rt[F.L[1].ping].texture;
    F.quad.material = F.deriveMat; renderer.setRenderTarget(F.out); renderer.render(F.scene, F.cam);
    renderer.setRenderTarget(prevT); renderer.autoClear = ac;
    F.t += dt;
    setInteraction(F.out.texture, nx, nz, FIELD_M);
  }
  function fieldOn(on) { F.on = !!on; if (!F.on) { F.ready = false; setInteraction(null); } }
  // fieldProbe(renderer, THREE, level): the state read back (a float buffer): max |h|, the centre row, the foam's mean
  function fieldProbe(renderer, THREE, level) {
    if (!F.ready2 || !renderer.readRenderTargetPixels) return null;
    const L = F.L[level || 0], N = L.N;
    // (a half-float target reads back as Uint16 halves - three refuses a Float32Array for it)
    const rt = L.rt[L.ping]; const raw = new Uint16Array(N * N * 4);
    try { renderer.readRenderTargetPixels(rt, 0, 0, N, N, raw); } catch (e) { return { err: String(e) }; }
    const h2f = h => { const sgn = (h >> 15) ? -1 : 1, ex = (h >> 10) & 31, m = h & 1023; if (ex === 0) return sgn * m * Math.pow(2, -24); if (ex === 31) return m ? NaN : sgn * Infinity; return sgn * (1 + m / 1024) * Math.pow(2, ex - 15); };
    const buf = new Float32Array(raw.length); for (let i = 0; i < raw.length; i++) buf[i] = h2f(raw[i]);
    let mx = 0, fm = 0, n = 0, nan = 0; const rows = [];
    for (let i = 0; i < N * N; i++) { const h = Math.abs(buf[i * 4]); if (h !== h) nan++; else if (h > mx) mx = h; fm += buf[i * 4 + 2]; n++; }
    const c = N >> 1, step = Math.max(1, N >> 5); for (let i = 0; i < N; i += step) rows.push(+buf[(c * N + i) * 4].toFixed(4));
    return { maxH: mx, nan, foamMean: fm / n, row: rows, box: [F.ox, F.oz, FIELD_M], N, dx: L.dx };
  }

  // ---- THE PLANAR MIRROR (G460.11): the decor's reflection, captured from the eye mirrored about the water
  // The IBL is the atmosphere's probe - the sky and its clouds, a flat ground cap: the water reflected NOTHING
  // of the world (the user, on a lake photo: "we can see tree reflections everywhere, while ours does not mirror
  // anything at all"). mirrorRender(THREE, renderer, scene, camera, waterY, opts) renders the scene with a camera
  // mirrored about y = waterY - THE SKY DOME DRAWN FIRST at the mirrored eye (G460.11.3: without it the capture's
  // clear sky was alpha 0 and the water took the PROBE's sky there - so the reflection switched source at every
  // cloud's edge, a hard line across the water, the user: "can't we have the tiles fade into each other? The hard
  // edge looks bad"; one dome draw makes the capture opaque and the reflection one source), the water meshes and
  // the spray hidden (opts.hide), the near plane made OBLIQUE so nothing under the water is captured - into a half-float target with mips, cleared to alpha 0:
  // the shader reads it where a point projects in that capture and keeps the probe's sky where the capture is
  // empty. The capture is AMORTISED: a 'periodic' mode (the default) re-captures when the eye has moved 4 m or
  // turned 3 deg or after `every` seconds (never under 0.25 s; a jump captures at once), 'live' every frame (the rigs that can afford it), 'off' never; only
  // when the eye is under `maxAgl` over the water - higher, the reflection is the sky. Cost: one scene render
  // at a quarter of the frame's pixels when it fires (measured in HANDOVER).
  // (measured under the rig: a capture is 13-22 ms of CPU submission - the world's draw calls + the clouds' march - and
  // 460 ms the first time (its targets and programs)).
  // THE CADENCE (G460.11.4): a capture is the reflection AS SEEN FROM ONE EYE, pasted on the water by projecting
  // through THAT eye's matrix - it stays right only while the eye is near where it was taken. 'periodic' is a
  // cadence for the WORLD's content (the clouds drift, a hull moves), never a licence to let the eye run: the
  // eye's own motion re-captures at 3 m / 3 deg, and a JUMP (over 15 m or 12 deg - a teleport, a camera cut)
  // captures at once whatever the gap. THE CLOCK IS REAL SECONDS: a fake 1/60-a-call clock ran at a fifth of the
  // wall clock under the rig, so a '3 s' refresh was 20 s and the water drew a capture taken 1500 m away - the
  // reflection stretched and smeared (the user: "reflections seem stretched, everything is twice as long")
  const MIR = { mode: 'periodic', every: 3.0, minGap: 0.25, moveM: 3, turnDeg: 3, jumpM: 15, jumpDeg: 12, maxAgl: 60, res: 0.5, perturb: 0.15, lod: 5.0, far: 4000, rt: null, cam: null, last: null, t: 0, lastT: -1e9, on: false, ms: 0 };
  const mirrorTmp = {};
  function mirrorRender(THREE, renderer, scene, camera, waterY, opts) {
    opts = opts || {};
    const eyeAgl = camera.position.y - waterY;
    if (!U || MIR.mode === 'off' || !(eyeAgl > 0.1) || eyeAgl > MIR.maxAgl) { if (MIR.on && U) { MIR.on = false; U.uWMirror4.value.x = 0; } return false; }
    MIR.t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const pos = camera.position, q = camera.quaternion;
    let due = MIR.mode === 'live' || !MIR.last;
    if (!due && MIR.last) {
      const L = MIR.last, moved = Math.hypot(pos.x - L.x, pos.y - L.y, pos.z - L.z), turned = 2 * Math.acos(Math.min(1, Math.abs(q.x * L.qx + q.y * L.qy + q.z * L.qz + q.w * L.qw)));
      const jump = moved > MIR.jumpM || turned > MIR.jumpDeg * Math.PI / 180 || Math.abs(waterY - L.wy) > 0.5;
      due = jump || ((MIR.t - MIR.lastT > MIR.minGap) && (moved > MIR.moveM || turned > MIR.turnDeg * Math.PI / 180 || MIR.t - MIR.lastT > MIR.every || Math.abs(waterY - L.wy) > 0.05));
    }
    if (!due) return false;
    const size = renderer.getDrawingBufferSize ? renderer.getDrawingBufferSize(mirrorTmp.v2 || (mirrorTmp.v2 = new THREE.Vector2())) : { x: 1920, y: 1080 };
    const w = Math.max(64, Math.round(size.x * MIR.res)), h = Math.max(64, Math.round(size.y * MIR.res));
    if (!MIR.rt || MIR.rt.width !== w || MIR.rt.height !== h) {
      if (MIR.rt) MIR.rt.dispose();
      // (a depth texture: the clouds' march reads the capture's depth, as it reads the frame's - and the capture is
      // MULTISAMPLED x2 so that texture is the RESOLVE of the depth, not the attachment itself: the clouds' composite
      // samples it while drawing into the capture, and on a single-sampled target that is a feedback loop WebGL
      // drops the draw of - no cloud in any mirror, G460.11.1)
      MIR.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true, stencilBuffer: true, samples: 2,
        depthTexture: THREE.DepthTexture ? new THREE.DepthTexture(w, h, THREE.UnsignedInt248Type) : null });
      if (MIR.rt.depthTexture) { MIR.rt.depthTexture.format = THREE.DepthStencilFormat; MIR.rt.depthTexture.minFilter = MIR.rt.depthTexture.magFilter = THREE.NearestFilter; }
      MIR.rt.texture.wrapS = MIR.rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (!MIR.cam) MIR.cam = new THREE.PerspectiveCamera();
    const mc = MIR.cam;
    // the eye mirrored about the plane: position, look direction and up reflected in y about waterY
    const fwd = mirrorTmp.fwd || (mirrorTmp.fwd = new THREE.Vector3()), up = mirrorTmp.up || (mirrorTmp.up = new THREE.Vector3()), tgt = mirrorTmp.tgt || (mirrorTmp.tgt = new THREE.Vector3());
    camera.getWorldDirection(fwd); up.set(0, 1, 0).applyQuaternion(q);
    mc.position.set(pos.x, 2 * waterY - pos.y, pos.z);
    fwd.y = -fwd.y; up.y = -up.y;
    tgt.copy(mc.position).add(fwd); mc.up.copy(up); mc.lookAt(tgt);
    mc.fov = camera.fov; mc.aspect = camera.aspect; mc.near = camera.near; mc.far = camera.far;
    mc.updateProjectionMatrix(); mc.updateMatrixWorld(true);
    // the capture: the water's own material, the spray's and the sky dome hidden; the shadow maps reused
    const hidden = [];
    for (const m of (opts.hideMaterials || [])) if (m && m.visible !== false) { m.visible = false; hidden.push(m); }
    const hiddenObj = [];
    for (const o of (opts.hide || [])) if (o && o.visible) { o.visible = false; hiddenObj.push(o); }
    if (mat) { mat.visible = false; hidden.push(mat); }   // every water mesh shares the one material
    const prevT = renderer.getRenderTarget(), ac = renderer.autoClear, sm = renderer.shadowMap.autoUpdate;
    const cc = renderer.getClearColor(mirrorTmp.cc || (mirrorTmp.cc = new THREE.Color())), ca = renderer.getClearAlpha();
    const t0 = performance.now();
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(MIR.rt); renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.clear();
    // THE SKY FIRST (G460.11.3): the dome is a small sphere parented to the MAIN camera, so it rides the wrong eye
    // during the capture and the oblique clip would kill it anyway (the mirrored eye is under the water plane).
    // It is drawn here in a scratch scene, placed at the mirrored eye, under the normal projection - the capture's
    // background, opaque, with the clouds composited over it
    // (G460.11.8: THE DOME IS IN opts.hide - it must be hidden from the SCENE draw, where it rides the
    // main camera - and the hide loop above had already set visible = false, so this pass drew NOTHING
    // and G460.11.3's fix never took effect: the capture's clear sky stayed alpha 0 and the water read
    // the PROBE there, a second sky pasted over the first at every cloud's edge. The dome is made visible
    // for its own draw and hidden again before the scene's. The user: "the cloud reflections look really
    // strange ... my brain does not reconcile it as being the mirrored sky")
    let skyPar = null;
    if (opts.sky) {
      const sky = opts.sky;
      MIR.skyScene = MIR.skyScene || new THREE.Scene();
      skyPar = sky.parent;
      MIR.skyScene.add(sky);
      sky.position.copy(mc.position);
      const skyVis = sky.visible;
      sky.visible = true;
      renderer.autoClear = false;
      renderer.render(MIR.skyScene, mc);
      sky.visible = skyVis;
    }
    // THE CLOUDS ARE IN THE MIRROR (the user: "the lake needs to reflect an accurate sky"): the clouds' own march run
    // for the mirrored eye into this capture (opts.clouds = CLOUDS.draw), composited by the scene's cloud quad -
    // with the FRAME's far (the composite writes its depth against log2(far + 1): a cloud 10 km out under the
    // capture's capped far read as depth > 1 and was clipped - no cloud in the mirror, G460.11.1)
    if (opts.clouds) { try { opts.clouds(renderer, mc, MIR.rt); } catch (e) {} }
    if (skyPar) { const sky = opts.sky; sky.position.set(0, 0, 0); skyPar.add(sky); }
    // the scene's own far CAPPED (the capture's cost is its draw calls; the decor past it is the sky's in the reflection)
    mc.far = Math.min(camera.far, MIR.far); mc.updateProjectionMatrix();
    // the oblique near plane (Lengyel; three's Reflector): the clip plane y = waterY in the mirror camera's view
    { const P = mc.projectionMatrix, n = mirrorTmp.n || (mirrorTmp.n = new THREE.Vector4()), pl = mirrorTmp.pl || (mirrorTmp.pl = new THREE.Plane()), qv = mirrorTmp.qv || (mirrorTmp.qv = new THREE.Vector4());
      mirrorTmp.pn = mirrorTmp.pn || new THREE.Vector3(0, 1, 0); mirrorTmp.pp = mirrorTmp.pp || new THREE.Vector3(); mirrorTmp.pp.set(0, waterY, 0);
      pl.setFromNormalAndCoplanarPoint(mirrorTmp.pn, mirrorTmp.pp);
      pl.applyMatrix4(mc.matrixWorldInverse);
      n.set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant);
      const e = P.elements;
      qv.x = (Math.sign(n.x) + e[8]) / e[0]; qv.y = (Math.sign(n.y) + e[9]) / e[5]; qv.z = -1.0; qv.w = (1.0 + e[10]) / e[14];
      n.multiplyScalar(2.0 / n.dot(qv));
      e[2] = n.x; e[6] = n.y; e[10] = n.z + 1.0; e[14] = n.w; }
    const bg = scene.background; scene.background = null;
    renderer.render(scene, mc);
    scene.background = bg;
    renderer.setClearColor(cc, ca); renderer.setRenderTarget(prevT); renderer.autoClear = ac; renderer.shadowMap.autoUpdate = sm;
    for (const m of hidden) m.visible = true;
    for (const o of hiddenObj) o.visible = true;
    MIR.ms = performance.now() - t0;
    MIR.last = { x: pos.x, y: pos.y, z: pos.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w, wy: waterY }; MIR.lastT = MIR.t; MIR.on = true;
    U.uWMirror.value = MIR.rt.texture;
    U.uWMirrorVP.value.multiplyMatrices(mc.projectionMatrix, mc.matrixWorldInverse);
    U.uWMirror4.value.set(1, MIR.perturb, MIR.lod, waterY);   // w: the mirror's plane, which the slope's walk needs (G460.11.9)
    U.uWRes.value.set(size.x, size.y);
    return true;
  }
  function mirrorOff() { MIR.on = false; MIR.last = null; if (U) U.uWMirror4.value.x = 0; }

  // ---- THE GPU TIMER: the water's own draws, summed a frame (EXT_disjoint_timer_query_webgl2) ----
  // watch(mesh) puts a query round every draw of a water mesh; stats.gpuMs is the last frame's sum of the
  // queries that have come back (a query answers a few frames later). timer.on gates the cost (a query
  // a draw is not free); the perf rig switches it on, the game never does.
  const timer = { on: false, gl: null, ext: null, pending: [], frame: 0, issued: {} };
  const stats = { gpuMs: 0, draws: 0 };
  function watch(mesh, renderer) {
    if (!timer.gl && renderer) { try { timer.gl = renderer.getContext(); timer.ext = timer.gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch (e) { timer.ext = null; } }
    let q = null;
    mesh.onBeforeRender = () => { if (!timer.on || !timer.ext) return; q = timer.gl.createQuery(); timer.gl.beginQuery(timer.ext.TIME_ELAPSED_EXT, q); };
    mesh.onAfterRender = () => { if (!q) return; timer.gl.endQuery(timer.ext.TIME_ELAPSED_EXT); timer.pending.push({ q, f: timer.frame }); timer.issued[timer.frame] = (timer.issued[timer.frame] || 0) + 1; q = null; };
    return mesh;
  }
  // a frame's queries answer a few frames later, not all at once: a frame's sum is published only when
  // every query of that frame has come back
  function timerPoll() {
    timer.frame++;
    if (!timer.ext || !timer.pending.length) return;
    const gl = timer.gl, keep = [], done = {};
    for (const h of timer.pending) {
      if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) { const ms = gl.getParameter(timer.ext.GPU_DISJOINT_EXT) ? 0 : gl.getQueryParameter(h.q, gl.QUERY_RESULT) * 1e-6; gl.deleteQuery(h.q); (done[h.f] = done[h.f] || []).push(ms); }
      else keep.push(h);
    }
    timer.pending = keep;
    for (const f in done) { const all = timer.issued[f] || 0; const got = (timer.got = timer.got || {}); got[f] = (got[f] || []).concat(done[f]);
      if (got[f].length >= all) { stats.gpuMs = got[f].reduce((a, b) => a + b, 0); stats.draws = got[f].length; delete got[f]; delete timer.issued[f]; } }
  }

  // ---- THE MATERIAL --------------------------------------------------------------------------
  function make(THREE, opts) {
    T3 = THREE;
    if (mat) return mat;
    makeU(THREE);
    mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.05, metalness: 0.0, ior: 1.333, specularIntensity: 1.0,
      transparent: true, depthWrite: true, side: THREE.DoubleSide, fog: true,
      envMapIntensity: (opts && opts.envMapIntensity != null) ? opts.envMapIntensity : 1.0,
    });
    mat.name = 'water';
    if (THREE.DataTexture) U.uWDetail.value = makeTile(THREE);
    U.uWDetailK.value.w = tile ? tile.userData.bake.w : 1;
    mat.onBeforeCompile = hook;   // through ATMO's accessor: the key is 'atmo.inject+' + this hook's source
    setTier(S.tier);
    setWind(IN.wind[0], IN.wind[1]); setSDF(IN.sdf, IN.grid && { x: IN.grid[0], y: IN.grid[1], z: IN.grid[2], w: IN.grid[3] }); setInteraction(IN.inter, IN.box[0], IN.box[1], IN.box[2]);
    if (trains.length) setSea({ W: trains });
    return mat;
  }
  function material() { return mat; }
  // the vertex attribute: (body, wavy) on every vertex of a geometry
  function tag(THREE, geo, body, wavy) {
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a[i * 2] = body; a[i * 2 + 1] = wavy ? 1 : 0; }
    geo.setAttribute('aWater', new THREE.Float32BufferAttribute(a, 2));
    return geo;
  }

  // ---- THE INPUTS ----------------------------------------------------------------------------
  function setTime(t) { T.t = t; T.set = true; }
  function time() { return T.t; }
  // the trains: packed when they change; the phases every frame (in double, reduced)
  function setSea(SEA) {
    const W = (SEA && SEA.W) || [];
    trains = W.slice(0, NTR).map(w => ({ A: w.A, k: w.k, om: w.om, dx: w.dx, dz: w.dz, ph: w.ph || 0, felt: w.felt !== false }));
    seaKey = trains.map(w => [w.A, w.k, w.om, w.dx, w.dz, w.ph].join(',')).join('|');
    if (!U) return;
    U.uWTrN.value = trains.length;
    trains.forEach((w, i) => { U.uWTrA.value[i].set(w.A, w.k, 0, 0); U.uWTrD.value[i].set(w.dx, w.dz, S.foldQ, w.felt ? 1 : 0); });
    let Lmax = 0; for (const w of trains) Lmax = Math.max(Lmax, TWO_PI / w.k);
    U.uWWave.value.y = Lmax || 20;
    let sAk2 = 0, Amax = 0; for (const w of trains) { sAk2 += w.A * w.k * w.A * w.k; Amax = Math.max(Amax, w.A); }
    U.uWFoam.value.x = S.foldQ * Math.sqrt(sAk2 / 2); U.uWFoam.value.z = Amax;
    U.uWWind.value.y = Math.log(TWO_PI / (Lmax || 20));
  }
  function seaChanged(SEA) {
    const W = (SEA && SEA.W) || [];
    if (W.length !== trains.length) return true;
    for (let i = 0; i < W.length; i++) { const a = W[i], b = trains[i]; if (a.A !== b.A || a.k !== b.k || a.om !== b.om || a.dx !== b.dx || a.dz !== b.dz || (a.ph || 0) !== b.ph || (a.felt !== false) !== b.felt) return true; }
    return false;
  }
  function setWind(U10, dir) {
    IN.wind = [Math.max(0, U10 || 0), dir || 0];
    if (!U) return;
    U.uWWind.value.x = IN.wind[0];
    U.uWFoam.value.y = Math.min(0.25, 3.84e-6 * Math.pow(IN.wind[0], 3.41));   // Monahan & O'Muircheartaigh's whitecap cover
    if (IN.wind[0] > 0.3) U.uWDir.value.set(Math.cos(IN.wind[1]), Math.sin(IN.wind[1]), 0, 0);
    // the detail band is the wind's: calm air, a glassy tile; the strength saturates by 8 m/s
    U.uWDetailK.value.z = S.detailK * Math.min(1, 0.12 + IN.wind[0] / 8);
  }
  function setSDF(tex, grid) {
    IN.sdf = tex || null; IN.grid = grid ? [grid.x, grid.y, grid.z, grid.w] : null;
    if (!U) return;
    U.uWSdf.value = IN.sdf; U.uWSdfOn.value = IN.sdf ? 1 : 0;
    if (IN.grid) U.uWGrid.value.set(IN.grid[0], IN.grid[1], IN.grid[2], IN.grid[3]);
  }
  // THE INTERACTION SLOT (H7 writes it): a world-locked texture over [x0, x0+size] x [z0, z0+size];
  // RG = slope over [-2, 2] (0.5 = flat), B = foam, A unused. Linear, clamped, no mips.
  function setInteraction(tex, x0, z0, size) {
    IN.inter = tex || null; IN.box = [x0 || 0, z0 || 0, size || 0];
    if (!U) return;
    U.uWInter.value = IN.inter;
    U.uWInterBox.value.set(IN.box[0], IN.box[1], IN.box[2] ? 1 / IN.box[2] : 0, IN.inter ? 1 : 0);
  }
  function setNear(ox, oz, half, on) { if (U) { U.uWNear.value.set(ox, oz, half, on ? 1 : 0); U.uWWave.value.z = half; } }
  function setTier(k) {
    S.tier = k === 'simple' ? 'simple' : 'full';
    S.displace = S.tier === 'full'; S.detail = S.tier === 'full'; S.foam = S.tier === 'full';
    S.sigma = true;
    push();
  }
  function set(o) {
    if (!o) return;
    if ('tier' in o) setTier(o.tier);
    if ('mirror' in o) { MIR.mode = o.mirror === 'live' ? 'live' : o.mirror === 'off' ? 'off' : 'periodic'; if (MIR.mode === 'off') mirrorOff(); }
    for (const k of ['displace', 'detail', 'sigma', 'foam', 'dbg', 'detailK', 'shoreFade', 'lakeK', 'lakeCap', 'foldQ']) if (k in o) S[k] = o[k];
    if ('on' in o) S.on = !!o.on;
    if ('timer' in o) timer.on = !!o.timer;
    if (o.detailL) S.detailL = o.detailL.slice();
    if (o.presets) { for (const k in o.presets) if (PRESETS[k]) Object.assign(PRESETS[k], o.presets[k]); applyPresets(); }
    push();
  }
  function push() {
    if (!U) return;
    U.uWWave.value.x = S.displace ? 1 : 0; U.uWWave.value.w = S.sigma ? 1 : 0;
    U.uWWind.value.w = S.detail ? 1 : 0;
    U.uWDetailK.value.x = S.detailL[0]; U.uWDetailK.value.y = S.detailL[1];
    U.uWMisc.value.set(S.shoreFade, S.lakeK, S.lakeCap, S.foam ? 1 : 0);
    U.uWDbg.value = S.dbg | 0;
    trains.forEach((w, i) => { U.uWTrD.value[i].z = S.foldQ; });
    { let sAk2 = 0; for (const w of trains) sAk2 += w.A * w.k * w.A * w.k; U.uWFoam.value.x = S.foldQ * Math.sqrt(sAk2 / 2); }
    if (mat) mat.visible = S.on;
  }
  // frame(dtWall): the clock (free-running only when setTime did not speak), the reduced phases, the drift
  function frame(dt) {
    if (!T.set) T.t += (dt || 0); else T.seen++;
    T.set = false;
    if (timer.on) timerPoll();
    if (!U) return;
    const t = T.t;
    for (let i = 0; i < trains.length; i++) { const w = trains[i]; let p = (w.om * t - w.ph) % TWO_PI; if (p < 0) p += TWO_PI; U.uWTrA.value[i].z = p; }
    // each tile scrolls along the wind at the phase speed of its own length, wrapped to its tile
    const c0 = Math.sqrt(9.81 * S.detailL[0] / TWO_PI), c1 = Math.sqrt(9.81 * S.detailL[1] / TWO_PI);
    U.uWDrift.value.set((c0 * t) % S.detailL[0], 0, (c1 * t * 0.85) % S.detailL[1], 0.31 * S.detailL[1]);
  }

  // ---- THE MIRROR: the shipped GLSL, transpiled, is the JS the buoys and the gate read -------------
  // (the substitution table is fixed and small; anything the GLSL uses outside it is a gate failure)
  function gerstnerFromGLSL(src) {
    const js = src
      .replace(/float wGerstnerH\(float x, float z\)/, 'function (x, z, A, D, N)')
      .replace(/float y = 0\.0;/, 'let y = 0.0;')
      .replace(/for \(int i = 0; i < 32; i\+\+\)/, 'for (let i = 0; i < 32; i++)')
      .replace(/if \(i >= uWTrN\) break;/, 'if (i >= N) break;')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/uWTrA\[i\]\.x/g, 'A[i][0]').replace(/uWTrA\[i\]\.y/g, 'A[i][1]').replace(/uWTrA\[i\]\.z/g, 'A[i][2]')
      .replace(/uWTrD\[i\]\.x/g, 'D[i][0]').replace(/uWTrD\[i\]\.y/g, 'D[i][1]').replace(/uWTrD\[i\]\.w/g, 'D[i][3]');
    if (/uWTr|float |int /.test(js)) throw new Error('water: the Gerstner GLSL left the transpiler\'s subset');
    return new Function('return ' + js.trim())();
  }
  const gerstnerH = gerstnerFromGLSL(GLSL_GERSTNER);
  // waterH's own arguments: (x, z, t, W) -> the height, through the packed form the GPU sees
  function gerstnerJS(x, z, t, W) {
    const A = [], D = [];
    for (const w of W.slice(0, NTR)) { let p = (w.om * t - (w.ph || 0)) % TWO_PI; if (p < 0) p += TWO_PI; A.push([w.A, w.k, p, 0]); D.push([w.dx, w.dz, 0, w.felt === false ? 0 : 1]); }
    return gerstnerH(x, z, A, D, A.length);
  }
  // the sigma law in JS (the gate's monotonicity check reads the same numbers)
  function sigma2JS(fp, U10, Lmax) {
    const tot = 0.003 + 0.00512 * U10;
    const lkMin = Math.log(TWO_PI / (Lmax || 20)), lkMax = Math.log(TWO_PI / 0.005);
    const lkc = Math.log(Math.PI / Math.max(fp, 1e-4));
    const f = Math.max(0, Math.min(1, (lkMax - lkc) / Math.max(lkMax - lkMin, 1e-3)));
    return tot * f;
  }
  const roughJS = s2 => Math.pow(Math.max(s2, 1e-5), 0.25);

  const API = { NTR, S, PRESETS, BODIES, GLSL: { gerstner: GLSL_GERSTNER, gerstnerN: GLSL_GERSTNER_N, frag: GLSL_FRAG_PARS },
    make, material, tag, hook, setTime, time, bodyOptics, WATER_TYPES, setSea, seaChanged, setWind, setSDF, setInteraction, setNear, set, setTier, frame,
    gerstnerJS, gerstnerFromGLSL, sigma2JS, roughJS, bakeTile, makeTile, paintTestV, watch, stats,
    mirrorRender, mirrorOff, mirror: MIR,
    stamp, fieldStep, fieldOn, fieldProbe, field: F, FIELD_N, FIELD_M, FIELD_LEVELS: LEVELS, fieldKernel, fieldKernelGain, kernelResponse, kernelSum, KERN_P,
    get uniforms() { return U; }, get trains() { return trains; }, get clock() { return T; } };
  if (typeof window !== 'undefined') window.WATER = API;
  return API;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WATER;
