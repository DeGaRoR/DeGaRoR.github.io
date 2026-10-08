#!/usr/bin/env node
// ground_link_variants.js - THE GROUND'S PROGRAMS WITH ONE SWITCH CHANGED, WITHOUT A PAGE (GROUND-COST G2075, the bisect of the full
// programs' cold link): takes a cold_links_bench --progs file the game dumped (tools/perf/ground_cost.js --progs: the island ground's
// programs as the driver got them), puts THIS tree's splat text in place of the one inside each fragment shader (splat_ground.js's
// glslCommon, made in node as GATE SPLAT makes it), and writes one --progs file per variant: the defines named after a ':' inserted
// right after the #version line. Each file is then linked cold, alone, by cold_links_bench.js (one fresh profile a file).
//   node tools/perf/ground_link_variants.js <dump_progs.json> <outPrefix> [--only island-ring] base: regs:GS_REGS avrc:GS_AVRC ...
// (a variant 'name:' with no define is the tree's own full program; 'lean:SPLAT_ONE,SPLAT_REG' the lean one)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const [IN, PFX] = argv;
const oi = argv.indexOf('--only'), ONLY = oi >= 0 ? argv[oi + 1] : null;
const VARS = argv.slice(2).filter((a, i, all) => a !== '--only' && all[i + 1 - 0] !== undefined ? true : true).filter((a, i) => a.includes(':') && a !== ONLY);
const G = require(path.join(ROOT, 'src/core/28b_ground_fields.js'));
// splat_ground.js's text as the game splices it (GATE SPLAT's stub harness)
function common() {
  const V4 = class { constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; } set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; } };
  const THREE = { Vector4: V4, Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } },
    Color: class { constructor() { this.r = this.g = this.b = 1; } }, DataArrayTexture: class { constructor() {} }, RGBAFormat: 1, UnsignedByteType: 2 };
  const img = () => ({ complete: true, naturalWidth: 0 });
  const SETS = G.RECIPE.library.map(([key, metres]) => ({ key, metres, px: 512, mean: [0.2, 0.2, 0.2], get diff() { return img(); }, get nor() { return img(); }, get height() { return img(); } }));
  const ctx = { GROUND_FIELDS: G, SPLAT_TEX_SETS: SETS, THREE, console, Promise, Uint8Array, Math, JSON, Object, Array,
    document: { createElement: () => ({ getContext: () => ({}) }) }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '' } };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/viewer/splat_ground.js'), 'utf8'), ctx, { filename: 'splat_ground.js' });
  return ctx.SPLAT_GROUND.make({}, null).glslCommon;
}
const NEW = common();
const progs = JSON.parse(fs.readFileSync(IN, 'utf8')).filter(p => !ONLY || p.name.startsWith(ONLY));
// the splat's segment inside a dumped fragment shader: from its first uniform to the end of sSplat ('return mix(col, mac, mw);' + '}')
const A = 'uniform highp sampler2DArray uSplat, uSplatN;';
const swap = fs => {
  const a = fs.lastIndexOf('\n', fs.indexOf(A)) + 1; if (a <= 0) throw new Error('no splat in a program');
  const e0 = fs.indexOf('return mix(col, mac, mw);', a); const b = fs.indexOf('}', e0) + 1;
  // the new text from its own first uniform line (the SPLAT_REG block before it rides along)
  const na = NEW.indexOf('  // SPLAT_REG (G2075)') >= 0 ? NEW.indexOf('  // SPLAT_REG (G2075)') : NEW.indexOf(A);
  const ne = NEW.indexOf('}', NEW.indexOf('return mix(col, mac, mw);')) + 1;
  return fs.slice(0, a) + NEW.slice(na, ne) + fs.slice(b);
};
for (const v of VARS) {
  const [name, defs] = v.split(':'); const D = (defs || '').split(',').filter(Boolean).map(d => '#define ' + d + ' 1').join('\n');
  const out = progs.map(p => { let fs2 = swap(p.fs); if (D) { const i = fs2.indexOf('\n') + 1; fs2 = fs2.slice(0, i) + D + '\n' + fs2.slice(i); }
    return { name: p.name + ':' + name, vs: p.vs, fs: fs2 }; });
  fs.writeFileSync(PFX + '_' + name + '.json', JSON.stringify(out));
  console.log('  ' + name.padEnd(10) + (D ? D.replace(/\n/g, ' ') : '(the tree as it is)') + '  -> ' + PFX + '_' + name + '.json  (' + out.length + ' programs, fs ' + out.map(o => o.fs.length).join('/') + ')');
}
