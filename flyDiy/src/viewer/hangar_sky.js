// GENERATED FILE - DO NOT EDIT. Built by tools/sky_tex_prep.js
// from assets/hangar_sky/ — ONE panorama (alps_field_8k.hdr) graded into
// 6 hours by tools/sky_grade.py, each measured exactly as a
// delivered sky would be. The four Kloppenheim panoramas this set replaced
// were retired on 2026-08-29: a whole day out of one picture costs less than
// six baked ones, and a new hour costs a row of uniforms rather than an asset.
//
// One row per hour: the light rig measured off that hour's own graded
// radiance — where the sun is, what colour it is, how directional it is — and
// the uniforms the fragment shader needs to make its picture. hangar.js's
// moods ARE these rows.
const HANGAR_SKIES = (() => {
  const rows = [
    { key: 'alps', name: 'AFTERNOON',
      // measured off alps_field_8k.hdr (graded: as-is): sun hard (direct 0.803), level 1
      sunUV: [0.60046, 0.26631], hasSun: true,
      yaw: 1.56791,   // sun 126° off the door axis
      keyI: 2.8, kc: 0xffdca8, hemi: 0.272, top: 0.562,
      hemiSky: 0xc6daff, hemiGnd: 0x343422,
      env: 1.21, lamp: 70, ex: 0.92,
      bg: 0x151511, card: 0xf2ecdc, panel: 2.6, shaft: 0.055,
      u: { k: 1.157859, outK: 1.157859, peak: 116483.382813, sunU: 0.60046, hb: 0.026, ecurve: 1, sat: 1, exposure: 1, sunG: 1, sunT: [1, 1, 1], zenG: 1, zenT: [1, 1, 1], horG: 1, horT: [1, 1, 1], gndG: 1, gndT: [1, 1, 1], skyW: [1, 1], skyWT: [1, 1, 1], gndW: [1, 1], gndWT: [1, 1, 1], glow: [0, 0, 1, 1], glowT: [0, 0, 0], star: [0, 0, 1], starWarm: 0 } },
    { key: 'ggolden', name: 'GOLDEN',
      // measured off alps_field_8k.hdr (graded: golden): sun diffuse (direct 0.2923), level 0.62
      sunUV: [0.60046, 0.26634], hasSun: true,
      yaw: 1.56791,   // sun 126° off the door axis
      keyI: 1.204, kc: 0xffb95f, hemi: 0.4, top: 0.827,
      hemiSky: 0xbbc6ff, hemiGnd: 0x443913,
      env: 0.75, lamp: 110, ex: 0.9,
      bg: 0x121009, card: 0x97a0cd, panel: 1.454, shaft: 0.1,
      u: { k: 1.157859, outK: 1.157859, peak: 116483.382813, sunU: 0.60046, hb: 0.026, ecurve: 0.85, sat: 1.22, exposure: 0.62, sunG: 0.055, sunT: [1, 0.55, 0.22], zenG: 0.62, zenT: [0.42, 0.55, 1], horG: 1.05, horT: [1, 0.8, 0.58], gndG: 0.7, gndT: [1, 0.8, 0.56], skyW: [1, 1.1], skyWT: [1, 0.72, 0.42], gndW: [1, 1.4], gndWT: [1, 0.82, 0.6], glow: [0.071336, 0.26, 0.2, 0.85], glowT: [1, 0.6, 0.26], star: [0, 0, 1], starWarm: 0 } },
    { key: 'gsunset', name: 'SUNSET',
      // measured off alps_field_8k.hdr (graded: sunset): sun diffuse (direct 0.0586), level 0.42
      sunUV: [0.60046, 0.26637], hasSun: true,
      yaw: 1.56791,   // sun 126° off the door axis
      keyI: 0.724, kc: 0xff813f, hemi: 0.276, top: 0.571,
      hemiSky: 0xdeb9ff, hemiGnd: 0x412d08,
      env: 0.508, lamp: 140, ex: 0.92,
      bg: 0x100b06, card: 0x967cac, panel: 0.924, shaft: 0.075,
      u: { k: 1.157859, outK: 1.157859, peak: 116483.382813, sunU: 0.60046, hb: 0.026, ecurve: 0.65, sat: 1.28, exposure: 0.55, sunG: 0.0002, sunT: [1, 0.4, 0.12], zenG: 0.3, zenT: [0.3, 0.4, 1], horG: 0.85, horT: [1, 0.58, 0.34], gndG: 0.26, gndT: [1, 0.66, 0.44], skyW: [1.45, 0.85], skyWT: [1, 0.46, 0.18], gndW: [1.35, 1.1], gndWT: [1, 0.56, 0.3], glow: [0.093335, 0.155, 0.135, 0.62], glowT: [1, 0.44, 0.14], star: [0, 0, 1], starWarm: 0 } },
    { key: 'gdusk', name: 'DUSK',
      // measured off alps_field_8k.hdr (graded: dusk): sun diffuse (direct 0.0529), level 0.2
      sunUV: [0.60046, 0.26638], hasSun: true,
      yaw: 1.56791,   // sun 126° off the door axis
      keyI: 0.265, kc: 0xff9e8d, hemi: 0.173, top: 0.358,
      hemiSky: 0xaca7ff, hemiGnd: 0x383829,
      env: 0.242, lamp: 170, ex: 0.98,
      bg: 0x0d0c0a, card: 0x53507b, panel: 0.432, shaft: 0.045,
      u: { k: 1.157859, outK: 1.157859, peak: 116483.382813, sunU: 0.60046, hb: 0.026, ecurve: 0.55, sat: 1.15, exposure: 0.55, sunG: 0.00002, sunT: [1, 0.5, 0.22], zenG: 0.075, zenT: [0.24, 0.32, 0.9], horG: 0.3, horT: [0.78, 0.6, 0.66], gndG: 0.115, gndT: [0.7, 0.74, 1], skyW: [1.3, 0.6], skyWT: [1, 0.52, 0.3], gndW: [1.1, 0.9], gndWT: [1, 0.78, 0.62], glow: [0.034005, 0.105, 0.09, 0.46], glowT: [1, 0.4, 0.2], star: [0, 0, 1], starWarm: 0 } },
    { key: 'gnight', name: 'NIGHT',
      // measured off alps_field_8k.hdr (graded: night): sun diffuse (direct 0.2227), level 0.07
      sunUV: [0.60046, 0.26634], hasSun: true,
      yaw: 1.56791,   // sun 126° off the door axis
      keyI: 0.076, kc: 0xeff2ff, hemi: 0.078, top: 0.161,
      hemiSky: 0x7b98ff, hemiGnd: 0x272b27,
      env: 0.085, lamp: 190, ex: 1.02,
      bg: 0x080909, card: 0x252d4c, panel: 0.398, shaft: 0.03,
      u: { k: 1.157859, outK: 61.954336, peak: 116483.382813, sunU: 0.60046, hb: 0.026, ecurve: 1.2, sat: 0.78, exposure: 1, sunG: 0.00003, sunT: [0.86, 0.9, 1], zenG: 0.0011, zenT: [0.16, 0.25, 0.66], horG: 0.0021, horT: [0.3, 0.4, 0.82], gndG: 0.0016, gndT: [0.32, 0.4, 0.66], skyW: [1.15, 0.7], skyWT: [0.74, 0.76, 1], gndW: [1, 1], gndWT: [1, 1, 1], glow: [0.000165, 0.14, 0.12, 0.75], glowT: [0.55, 0.64, 1], star: [0.0022, 0.001356, 0.06], starWarm: 0.3 } },
    { key: 'gcovered', name: 'OVERCAST',
      // measured off alps_field_8k.hdr (graded: covered): sun diffuse (direct 0.0946), level 0.72
      sunUV: [0.60044, 0.26639], hasSun: true,
      yaw: 1.56803,   // sun 126° off the door axis
      keyI: 0.534, kc: 0xfffaf6, hemi: 0.357, top: 0.738,
      hemiSky: 0xd4e3ff, hemiGnd: 0x303129,
      env: 0.871, lamp: 120, ex: 0.98,
      bg: 0x131311, card: 0xb6c3dc, panel: 1.498, shaft: 0.035,
      u: { k: 1.157859, outK: 1.157859, peak: 116483.382813, sunU: 0.60046, hb: 0.026, ecurve: 1.7, sat: 0.5, exposure: 0.3, sunG: 0.01, sunT: [1, 1, 1], zenG: 0.85, zenT: [0.84, 0.89, 0.98], horG: 1, horT: [0.93, 0.95, 0.99], gndG: 0.66, gndT: [0.95, 0.97, 1], skyW: [1, 1], skyWT: [1, 1, 1], gndW: [1, 1], gndWT: [1, 1, 1], glow: [0.072638, 0.45, 0.55, 3.2], glowT: [0.95, 0.97, 1], star: [0, 0, 1], starWarm: 0 } },
  ];
  // no row carries a picture: the shader makes every one of them from the
  // single base panorama below
  return rows;
})();

// ---- the runtime grade: ONE panorama, every hour --------------------------
// base.jpg is the alps display equirect. gain.png is log2(radiance /
// display-linear) PER CHANNEL over 17.1 stops — zero
// everywhere the base did not clip, which is why it costs a tenth of a
// megabyte and not eight. Together they put the float radiance back in front
// of the shader, and every row above is then a set of uniforms, not a picture.
// The two files live under media/tex/sky/ (hash-in-filename); gradeTextures
// hands their URLs straight to new Image(), exactly as it did the data URIs.
const HANGAR_SKY_GRADE = (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  return {
    k: 1.157858550545688, gmax: 17.056949615478516, peak: 116483.3828125,
    glsl: "\r\n// GENERATED FROM tools/sky_grade.py - the GLSL half of grade(). Read the two\r\n// together; they are meant to stay a line-for-line pair.\r\n//\r\n// fdSkyGrade returns DISPLAY-LINEAR colour: the graded radiance times the\r\n// row's exposure and the display exposure, clamped to 0..1 exactly as writing\r\n// an 8-bit picture clamps it. The backdrop hands that straight to the\r\n// renderer's tone mapping; the probe pass sRGB-encodes it into a byte target.\r\n#define FD_PI 3.141592653589793\r\nconst vec3 FD_LUM = vec3(0.2126, 0.7152, 0.0722);\r\n\r\nuniform sampler2D uBase;\r\nuniform sampler2D uGain;\r\nuniform float uK, uGMax, uOutK, uPeak, uSunU, uHB, uEcurve, uSat, uExposure;\r\nuniform float uSunG, uZenG, uHorG, uGndG, uStarWarm;\r\nuniform vec3 uSunT, uZenT, uHorT, uGndT, uSkyWT, uGndWT, uGlowT;\r\nuniform vec2 uSkyW, uGndW;\r\nuniform vec4 uGlow;\r\nuniform vec3 uStar;\r\n\r\nvec3 fdS2L(vec3 c) {\r\n  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));\r\n}\r\nvec3 fdL2S(vec3 c) {\r\n  c = clamp(c, 0.0, 1.0);\r\n  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,\r\n             step(vec3(0.0031308), c));\r\n}\r\nfloat fdHash(vec2 p, float s) {\r\n  return fract(sin(dot(p + vec2(s, s * 1.7), vec2(127.1, 311.7))) * 43758.5453123);\r\n}\r\nfloat fdSq(float x) { return x * x; }   // pow(x, 2.0) is undefined for x < 0\r\n\r\nvec3 fdSkyGrade(vec2 uv, vec2 px) {\r\n  // 0 - the radiance back, out of the base picture and its gain map\r\n  vec3 rad = fdS2L(texture2D(uBase, uv).rgb) / uK\r\n             * exp2(texture2D(uGain, uv).rgb * uGMax);\r\n\r\n  // flipY is on for both source images, so uv.y = 1 is the zenith\r\n  float e = cos((1.0 - uv.y) * FD_PI);\r\n  float dphi = abs(fract(uv.x - uSunU + 0.5) - 0.5) * 2.0 * FD_PI;\r\n\r\n  // 1 - split the disc and its bloom off the sky behind it\r\n  float lo = log(max(uPeak * 1e-3, 1e-6));\r\n  float hi = log(max(uPeak * 0.30, 1e-5));\r\n  float w = clamp((log(max(dot(rad, FD_LUM), 1e-8)) - lo) / (hi - lo), 0.0, 1.0);\r\n  vec3 sunL = rad * w;\r\n  vec3 b = rad * (1.0 - w);\r\n\r\n  // 2/3 - the sky by elevation, the ground on its own, both warmed toward the sun\r\n  float t = pow(clamp(e, 0.0, 1.0), uEcurve);\r\n  vec3 up = mix(uHorT * uHorG, uZenT * uZenG, t);\r\n  vec3 dn = uGndT * uGndG;\r\n  up *= mix(vec3(1.0), uSkyWT * uSkyW.x, exp(-fdSq(dphi / uSkyW.y)));\r\n  dn *= mix(vec3(1.0), uGndWT * uGndW.x, exp(-fdSq(dphi / uGndW.y)));\r\n  b *= mix(dn, up, clamp((e + uHB) / (2.0 * uHB), 0.0, 1.0));\r\n\r\n  // 4 - the disc goes back, on its own gain and tint\r\n  vec3 c = b + sunL * (uSunT * uSunG);\r\n\r\n  // 5 - the glow: sky only, and its amplitude arrived pre-multiplied by the\r\n  // sky level this grade produces, which is what stops it being a halo\r\n  float g = exp(-fdSq(dphi / uGlow.w)) * exp(-fdSq((e - uGlow.y) / uGlow.z))\r\n            * clamp(e / 0.06, 0.0, 1.0);\r\n  c += g * uGlowT * uGlow.x;\r\n\r\n  // 6 - saturation, about the luminance already there\r\n  float lv = dot(c, FD_LUM);\r\n  c = max(vec3(lv) + (c - vec3(lv)) * uSat, 0.0);\r\n\r\n  // 7 - stars. A FLOAT hash, not the python's 64-bit mix: WebGL1 has no\r\n  // integer bit ops, and stars are noise the light rig never sees.\r\n  if (uStar.x > 0.0) {\r\n    float sn = max(sqrt(max(1.0 - e * e, 0.0)), 0.20);\r\n    float keep = step(fdHash(px, 3.7), uStar.x / sn);\r\n    vec3 tint = vec3(1.0) + (fdHash(px, 23.9) - 0.5) * 2.0 * uStarWarm\r\n                * vec3(1.0, 0.1, -1.0);\r\n    c += keep * clamp((e - 0.01) / uStar.z, 0.0, 1.0)\r\n         * pow(fdHash(px, 11.3), 5.0) * uStar.y * tint;\r\n  }\r\n\r\n  return clamp(c * uExposure * uOutK, 0.0, 1.0);\r\n}\r\n",
    base: B + 'media/tex/sky/base.f14bc399.jpg',
    gain: B + 'media/tex/sky/gain.337591c8.png',
  };
})();
