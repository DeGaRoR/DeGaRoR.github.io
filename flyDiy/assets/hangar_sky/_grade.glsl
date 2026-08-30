
// GENERATED FROM tools/sky_grade.py - the GLSL half of grade(). Read the two
// together; they are meant to stay a line-for-line pair.
//
// fdSkyGrade returns DISPLAY-LINEAR colour: the graded radiance times the
// row's exposure and the display exposure, clamped to 0..1 exactly as writing
// an 8-bit picture clamps it. The backdrop hands that straight to the
// renderer's tone mapping; the probe pass sRGB-encodes it into a byte target.
#define FD_PI 3.141592653589793
const vec3 FD_LUM = vec3(0.2126, 0.7152, 0.0722);

uniform sampler2D uBase;
uniform sampler2D uGain;
uniform float uK, uGMax, uOutK, uPeak, uSunU, uHB, uEcurve, uSat, uExposure;
uniform float uSunG, uZenG, uHorG, uGndG, uStarWarm;
uniform vec3 uSunT, uZenT, uHorT, uGndT, uSkyWT, uGndWT, uGlowT;
uniform vec2 uSkyW, uGndW;
uniform vec4 uGlow;
uniform vec3 uStar;

vec3 fdS2L(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 fdL2S(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
             step(vec3(0.0031308), c));
}
float fdHash(vec2 p, float s) {
  return fract(sin(dot(p + vec2(s, s * 1.7), vec2(127.1, 311.7))) * 43758.5453123);
}
float fdSq(float x) { return x * x; }   // pow(x, 2.0) is undefined for x < 0

vec3 fdSkyGrade(vec2 uv, vec2 px) {
  // 0 - the radiance back, out of the base picture and its gain map
  vec3 rad = fdS2L(texture2D(uBase, uv).rgb) / uK
             * exp2(texture2D(uGain, uv).rgb * uGMax);

  // flipY is on for both source images, so uv.y = 1 is the zenith
  float e = cos((1.0 - uv.y) * FD_PI);
  float dphi = abs(fract(uv.x - uSunU + 0.5) - 0.5) * 2.0 * FD_PI;

  // 1 - split the disc and its bloom off the sky behind it
  float lo = log(max(uPeak * 1e-3, 1e-6));
  float hi = log(max(uPeak * 0.30, 1e-5));
  float w = clamp((log(max(dot(rad, FD_LUM), 1e-8)) - lo) / (hi - lo), 0.0, 1.0);
  vec3 sunL = rad * w;
  vec3 b = rad * (1.0 - w);

  // 2/3 - the sky by elevation, the ground on its own, both warmed toward the sun
  float t = pow(clamp(e, 0.0, 1.0), uEcurve);
  vec3 up = mix(uHorT * uHorG, uZenT * uZenG, t);
  vec3 dn = uGndT * uGndG;
  up *= mix(vec3(1.0), uSkyWT * uSkyW.x, exp(-fdSq(dphi / uSkyW.y)));
  dn *= mix(vec3(1.0), uGndWT * uGndW.x, exp(-fdSq(dphi / uGndW.y)));
  b *= mix(dn, up, clamp((e + uHB) / (2.0 * uHB), 0.0, 1.0));

  // 4 - the disc goes back, on its own gain and tint
  vec3 c = b + sunL * (uSunT * uSunG);

  // 5 - the glow: sky only, and its amplitude arrived pre-multiplied by the
  // sky level this grade produces, which is what stops it being a halo
  float g = exp(-fdSq(dphi / uGlow.w)) * exp(-fdSq((e - uGlow.y) / uGlow.z))
            * clamp(e / 0.06, 0.0, 1.0);
  c += g * uGlowT * uGlow.x;

  // 6 - saturation, about the luminance already there
  float lv = dot(c, FD_LUM);
  c = max(vec3(lv) + (c - vec3(lv)) * uSat, 0.0);

  // 7 - stars. A FLOAT hash, not the python's 64-bit mix: WebGL1 has no
  // integer bit ops, and stars are noise the light rig never sees.
  if (uStar.x > 0.0) {
    float sn = max(sqrt(max(1.0 - e * e, 0.0)), 0.20);
    float keep = step(fdHash(px, 3.7), uStar.x / sn);
    vec3 tint = vec3(1.0) + (fdHash(px, 23.9) - 0.5) * 2.0 * uStarWarm
                * vec3(1.0, 0.1, -1.0);
    c += keep * clamp((e - 0.01) / uStar.z, 0.0, 1.0)
         * pow(fdHash(px, 11.3), 5.0) * uStar.y * tint;
  }

  return clamp(c * uExposure * uOutK, 0.0, 1.0);
}
