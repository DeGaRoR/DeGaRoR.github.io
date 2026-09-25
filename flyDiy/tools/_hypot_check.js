#!/usr/bin/env node
// GATE HYPOT (PHYSICS PERF 2026-09-24) - hyp2 / hyp3 (00_registry.js) are Math.hypot TO THE BIT.
// The solver's per-substep loops call them in place of Math.hypot (7x cheaper); the trajectory
// is unchanged only while every call answers exactly what Math.hypot answers. Random triples over
// forty decades, realistic metre-scale ones, and the specials (0, -0, NaN, Infinity with NaN, the
// subnormals, the overflow edge), compared with Object.is.
//   node tools/_hypot_check.js          -> "GATE HYPOT: PASS|FAIL"
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const hyp2 = C.hyp2, hyp3 = C.hyp3;
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
verdict(typeof hyp2 === 'function' && typeof hyp3 === 'function', 'hyp2 / hyp3 exported by flight_core');
if (typeof hyp2 === 'function' && typeof hyp3 === 'function') {
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const wide = () => (rnd() * 2 - 1) * Math.pow(10, Math.floor(rnd() * 40) - 20);
  const N = +(process.env.HYPOT_N || 2e6);
  let d3 = 0, d2 = 0, ex = null;
  for (let i = 0; i < N; i++) {
    const x = wide(), y = wide(), z = wide();
    if (!Object.is(Math.hypot(x, y, z), hyp3(x, y, z))) { d3++; ex = ex || [x, y, z]; }
    if (!Object.is(Math.hypot(x, y), hyp2(x, y))) { d2++; ex = ex || [x, y]; }
    const a = rnd() * 10 - 5, b = rnd() * 1e-3, c = rnd() * 3;
    if (!Object.is(Math.hypot(a, b, c), hyp3(a, b, c))) { d3++; ex = ex || [a, b, c]; }
    if (!Object.is(Math.hypot(a, c), hyp2(a, c))) { d2++; ex = ex || [a, c]; }
  }
  verdict(d3 === 0 && d2 === 0, `random: ${2 * N} triples, ${2 * N} pairs - ${d3} / ${d2} differ` + (ex ? ' e.g. ' + ex.join(', ') : ''));
  const SP = [0, -0, 1, -1, NaN, Infinity, -Infinity, 5e-324, 1e-310, 1.7976931348623157e308, 1e154, 3, 4];
  let dsp = 0;
  for (const a of SP) for (const b of SP) {
    if (!Object.is(Math.hypot(a, b), hyp2(a, b))) { dsp++; console.log('   hyp2', a, b, Math.hypot(a, b), hyp2(a, b)); }
    for (const c of SP) if (!Object.is(Math.hypot(a, b, c), hyp3(a, b, c))) { dsp++; console.log('   hyp3', a, b, c, Math.hypot(a, b, c), hyp3(a, b, c)); }
  }
  verdict(dsp === 0, `specials: ${SP.length ** 2 + SP.length ** 3} combinations - ${dsp} differ`);
}
console.log('GATE HYPOT: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
