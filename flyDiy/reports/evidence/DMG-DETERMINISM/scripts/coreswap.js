// node -r ./coreswap.js : FDCORE=<file> replaces tools/flight_core.js
const M = require('module'), orig = M._resolveFilename;
if (process.env.FDCORE) M._resolveFilename = function (req, ...a) { const r = orig.call(this, req, ...a); return /flight_core\.js$/.test(r) ? process.env.FDCORE : r; };
