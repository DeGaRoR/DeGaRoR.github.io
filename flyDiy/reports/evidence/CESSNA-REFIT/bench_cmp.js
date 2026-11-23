// bench_cmp.js old.json new.json : genShakedown of both (the snapshots' own measure), every numeric figure side by side
const path = require('path'), fs = require('fs');
const CORE = require(path.resolve('tools/flight_core.js'));
const sh = f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return CORE.genShakedown(CORE.buildGen(CORE.genMigrateSpec(j.spec || j))); };
const A = sh(process.argv[2]), B = sh(process.argv[3]);
const flat = (o, p = '', out = {}) => { for (const k in o) { const v = o[k]; if (typeof v === 'number' && isFinite(v)) out[p + k] = v; else if (v && typeof v === 'object' && !Array.isArray(v) && p.split('.').length < 3) flat(v, p + k + '.', out); } return out; };
const a = flat(A), b = flat(B);
const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
for (const k of keys) { const x = a[k], y = b[k]; if (x === y) continue;
  const d = (x != null && y != null && x !== 0) ? ((y - x) / Math.abs(x) * 100).toFixed(1) + ' %' : '';
  console.log(k.padEnd(34), String(x != null ? +x.toFixed(4) : '-').padStart(12), '->', String(y != null ? +y.toFixed(4) : '-').padStart(12), d); }
