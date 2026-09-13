// THE FLOAT IN WATER — the shim. The model moved into the core as
// src/core/32_hydro.js (H1, G382): flight_core.js carries it as HYDRO for
// every gate, the bench loads the core file itself, and this file keeps the
// H0 check's require('./_hydro_gen.js') working. Build first
// (node tools/build.js), as for every other gate.
'use strict';
module.exports = require('./flight_core.js').HYDRO;
