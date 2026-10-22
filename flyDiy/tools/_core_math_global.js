// T41b (train 41, DMG-MATHLOCAL's loose end): CORE_MATH for a tool that requires a core file ALONE. The core's sin / cos /
// pow live in 00_registry.js (CORE_MATH: fdlibm + V8's e_pow, so the page and node compute the same bits); the bundle
// (tools/flight_core.js, the page, the worker) defines it before every other file, but a tool that requires
// src/core/27_premises.js or 28b_ground_fields.js on its own never ran 00_registry, and threw "CORE_MATH is not defined"
// (train 41's battery: SPLAT, PREMISES, PARKED, TOWNKIT, KITHOST, METKIT, LIFE). Required FIRST by those tools: 00_registry
// evaluated in its own context and its CORE_MATH (the same closure, the same bits) set on the global - once, never over
// a CORE_MATH already there.
'use strict';
if (typeof global.CORE_MATH === 'undefined') {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const c = { Math, Object, Float64Array, Float32Array, Int32Array, Uint32Array, Uint8Array, DataView, ArrayBuffer, Number, console };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '00_registry.js'), 'utf8') + '\n;this.__CM = CORE_MATH;', c, { filename: '00_registry.js' });
  global.CORE_MATH = c.__CM;
}
module.exports = global.CORE_MATH;
