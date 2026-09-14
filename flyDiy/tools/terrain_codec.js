// terrain_codec.js — the codec moved into the core (src/core/19_terrain_codec.js,
// 2026-09-14): the game reads the asset now, not only the baker and the
// benches. This shim keeps `require('./terrain_codec')` working for the tools.
module.exports = require('../src/core/19_terrain_codec.js');
