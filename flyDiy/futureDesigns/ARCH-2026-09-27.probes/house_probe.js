// ARCH-2026-09-27 probe (node only, not a gate): time + size every HOUSE_GEN preset at lod 0 / 1 in node (the gate's stub THREE)
const fs = require('fs'), path = require('path'), vm = require('vm');
const TOOLS = require('path').join(__dirname, '..', '..', 'tools');
const src = fs.readFileSync(path.join(TOOLS, '_house_check.js'), 'utf8');
const stub = src.slice(src.indexOf('function makeTHREE()'), src.indexOf('const win = {};'));
const makeTHREE = new Function(stub + '; return makeTHREE;')();
const win = {};
const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['_house_kit.js', '_house_gen.js', '_shed_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_tram_gen.js', '_sport_gen.js', '_marine_gen.js', '_hangar_gen.js', '_tower_gen.js'])
  vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
const HG = win.HOUSE_GEN;
const rows = [];
const meas = b => { let t = 0, v = 0, bags = 0; for (const k of HG.BAGS) { const d = b.bags[k].data(); if (d.idx.length) bags++; t += d.idx.length / 3; v += d.pos.length / 3; } return { t, v, bags }; };
// warm the JIT
for (let i = 0; i < 3; i++) for (const n of Object.keys(HG.PRESETS)) { const p = HG.PRESETS[n]; if (p.mill || p.station) continue; HG.build(Object.assign({}, HG.DEF, p, p.wing ? { wing: 0 } : {}), 0); }
for (const n of Object.keys(HG.PRESETS)) {
  const p = HG.PRESETS[n]; if (p.mill || p.station) continue;
  const P = Object.assign({}, HG.DEF, p, p.wing ? { wing: 0 } : {});
  let t0 = process.hrtime.bigint(); const hi = HG.build(P, 0); const ms0 = Number(process.hrtime.bigint() - t0) / 1e6;
  t0 = process.hrtime.bigint(); const lo = HG.build(P, 1); const ms1 = Number(process.hrtime.bigint() - t0) / 1e6;
  rows.push({ n, ms0, ms1, ...Object.fromEntries(Object.entries(meas(hi)).map(([k, v]) => [k + '0', v])), ...Object.fromEntries(Object.entries(meas(lo)).map(([k, v]) => [k + '1', v])) });
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
console.log('presets', rows.length);
for (const r of rows) console.log(r.n.padEnd(22), 'lod0', r.ms0.toFixed(1) + 'ms', r.t0 + 't', r.v0 + 'v', r.bags0 + 'bags', '| lod1', r.ms1.toFixed(1) + 'ms', r.t1 + 't', r.v1 + 'v');
console.log('median lod0 ms', med(rows.map(r => r.ms0)).toFixed(1), 'tris', med(rows.map(r => r.t0)), 'verts', med(rows.map(r => r.v0)));
console.log('median lod1 ms', med(rows.map(r => r.ms1)).toFixed(1), 'tris', med(rows.map(r => r.t1)), 'verts', med(rows.map(r => r.v1)));
console.log('mean lod0 verts', (sum('v0') / rows.length).toFixed(0), 'tris', (sum('t0') / rows.length).toFixed(0), ' mean lod1 verts', (sum('v1') / rows.length).toFixed(0), 'tris', (sum('t1') / rows.length).toFixed(0));
console.log('median bags lod0', med(rows.map(r => r.bags0)));
