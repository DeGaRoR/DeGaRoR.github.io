// DMG-LOOKS PORT KIT: THE SEEDED NOISE, JS AND GLSL, BIT FOR BIT THE SAME RECIPE (futureDesigns/dmg-looks/noise.js's
// h1 / v1 / fbm1). The hash is integer (uint wraps mod 2^32 in GLSL ES 3.00 as Math.imul does), so JS and GLSL agree to
// float rounding. PURE: no THREE, no DOM. window.DMG_LOOKS_NOISE in the page, module.exports in node.
(function () {
  'use strict';
  function h1(i, seed) { let x = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return (x >>> 0) / 4294967296; }
  const sm = t => t * t * (3 - 2 * t);
  function v1(x, seed) { const i = Math.floor(x), f = x - i; return h1(i, seed) + (h1(i + 1, seed) - h1(i, seed)) * sm(f); }
  function h2(i, j, seed) { return h1(Math.imul(i | 0, 73856093) ^ Math.imul(j | 0, 19349663), seed); }
  function v2(x, y, seed) { const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
    const a = h2(i, j, seed), b = h2(i + 1, j, seed), c = h2(i, j + 1, seed), d = h2(i + 1, j + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
  function fbm2(x, y, seed, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * (v2(x * f, y * f, seed + o * 31) * 2 - 1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  function fbm1(x, seed, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * (v1(x * f, seed + o * 31) * 2 - 1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  const GLSL = [
    'float dlH1(int i, int seed) {',
    '  uint x = (uint(i) * 0x27d4eb2du) ^ (uint(seed) * 0x165667b1u);',
    '  x ^= x >> 15u; x *= 0x85ebca6bu; x ^= x >> 13u; x *= 0xc2b2ae35u; x ^= x >> 16u;',
    '  return float(x) / 4294967296.0;',
    '}',
    'float dlV1(float x, int seed) { float fi = floor(x); int i = int(fi); float f = x - fi; float s = f * f * (3.0 - 2.0 * f);',
    '  float a = dlH1(i, seed); return a + (dlH1(i + 1, seed) - a) * s; }',
    '#define DL_OCT 3',
    'float dlFbm1(float x, int seed) { float s = 0.0, a = 0.5, f = 1.0, n = 0.0;',
    '  for (int o = 0; o < DL_OCT; o++) { s += a * (dlV1(x * f, seed + o * 31) * 2.0 - 1.0); n += a; a *= 0.5; f *= 2.03; }',
    '  return s / n; }',
    'float dlH2(int i, int j, int seed) { return dlH1(int(uint(i) * 73856093u ^ uint(j) * 19349663u), seed); }',
    'float dlV2(vec2 p, int seed) { vec2 fl = floor(p); int i = int(fl.x), j = int(fl.y); vec2 f = p - fl; vec2 s = f * f * (3.0 - 2.0 * f);',
    '  float a = dlH2(i, j, seed), b = dlH2(i + 1, j, seed), c = dlH2(i, j + 1, seed), d = dlH2(i + 1, j + 1, seed);',
    '  return a + (b - a) * s.x + (c - a) * s.y + (a - b - c + d) * s.x * s.y; }',
    'float dlFbm2(vec2 p, int seed) { float s = 0.0, a = 0.5, f = 1.0, n = 0.0;',
    '  for (int o = 0; o < DL_OCT; o++) { s += a * (dlV2(p * f, seed + o * 31) * 2.0 - 1.0); n += a; a *= 0.5; f *= 2.03; }',
    '  return s / n; }',
  ].join('\n');
  const API = { h1, v1, fbm1, h2, v2, fbm2, GLSL };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_LOOKS_NOISE = API;
})();
