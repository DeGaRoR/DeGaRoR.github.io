// Seeded hash noise for the DMG-LOOKS prototypes - written so each function maps 1:1 onto GLSL (no tables, no state).
'use strict';
const fract = x => x - Math.floor(x);
// a 1D / 2D hash in [0,1): the classic sin-free integer hash (portable to GLSL with uint math)
function h1(i, seed) { let x = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return (x >>> 0) / 4294967296; }
function h2(i, j, seed) { return h1(Math.imul(i | 0, 73856093) ^ Math.imul(j | 0, 19349663), seed); }
const sm = t => t * t * (3 - 2 * t);
function v1(x, seed) { const i = Math.floor(x), f = x - i; return h1(i, seed) + (h1(i + 1, seed) - h1(i, seed)) * sm(f); }
function v2(x, y, seed) { const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
  const a = h2(i, j, seed), b = h2(i + 1, j, seed), c = h2(i, j + 1, seed), d = h2(i + 1, j + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
function fbm1(x, seed, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * (v1(x * f, seed + o * 31) * 2 - 1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
function fbm2(x, y, seed, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * (v2(x * f, y * f, seed + o * 31) * 2 - 1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
// mulberry32, for event-time draws on the CPU
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
module.exports = { fract, h1, h2, v1, v2, fbm1, fbm2, rng };
