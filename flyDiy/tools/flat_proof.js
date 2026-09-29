#!/usr/bin/env node
// flat_proof.js - THE LOOKS DID NOT CHANGE (G903, AS0b): every flat map the bakers replaced by its constant.
//
//   node tools/flat_proof.js [--base <ref>] [--tol 2]      (default base: origin/claude/batch-a-base)
//
// A flat map (every channel's std < 2 at 256 px, tools/media_lib.py flat_const) now ships as [r, g, b] in its
// material record, and the consumer binds a 1x1 of that colour (src/viewer/assets.js TEX_FLAT) in the slot the
// file went to. The GPU sampled the file's texels before; it samples the constant now. So the proof is the
// file's MEAN: the old file, decoded at FULL resolution from git at <base>, must average to the constant within
// <tol> codes on every channel (the constant is the 256 px BOX mean, rounded).
//
// How the pairs are found, with no per-family table: every src/ record the tree changed since <base> is
// evaluated twice in a stub context (old bytes from git, new from disk) - registerChar / registerPropPack
// payloads and the file's top-level `const NAME =` values - and the two are walked together: wherever the old
// held a media path (a string, or a stub Image's src through a getter) and the new holds [r, g, b], that is
// one replacement. Needs python + Pillow (the bakers' own dependency).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BASE = opt('base', 'origin/claude/batch-a-base'), TOL = +opt('tol', 2);
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'buffer', maxBuffer: 1 << 30 });

function evalRecord(src, file) {
  const out = [];
  class Image { set src(v) { this._src = v; } get src() { return this._src; } }
  const ctx = { Image, FLYDIY_ASSET_BASE: '', console: { log() {}, warn() {} }, window: {}, module: { exports: {} },
    registerChar: c => out.push(['char', c]), registerCharAnim: () => {}, registerPropPack: p => out.push(['pack', p]),
    registerAnimal: a => out.push(['animal', a]), registerAnimalClips: () => {} };
  ctx.exports = ctx.module.exports; ctx.globalThis = ctx;
  const names = [...src.matchAll(/^const ([A-Z][A-Z0-9_]*) =/gm)].map(m => m[1]);
  const grab = '\n;__grab({' + names.map(n => `${n}: (typeof ${n} !== 'undefined') ? ${n} : null`).join(', ') + '});';
  ctx.__grab = o => { for (const k in o) out.push([k, o[k]]); };
  try { vm.runInNewContext(src + grab, ctx, { filename: file }); } catch (e) { return { err: e.message }; }
  return { vals: out };
}

const isC = v => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number');
const pathOf = v => typeof v === 'string' ? (/media\//.test(v) ? v.slice(v.indexOf('media/')) : null)
  : (v && typeof v === 'object' && typeof v.src === 'string' && /media\//.test(v.src)) ? v.src.slice(v.src.indexOf('media/')) : null;
function walk(a, b, where, pairs, seen) {
  if (isC(b)) { const p = pathOf(a); if (p) pairs.push({ where, path: p, c: b }); return; }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || seen.has(a)) return;
  seen.add(a);
  const keys = new Set([...Object.getOwnPropertyNames(a), ...Object.getOwnPropertyNames(b)]);
  for (const k of keys) {
    let x, y; try { x = a[k]; y = b[k]; } catch (e) { continue; }
    walk(x, y, where + '.' + k, pairs, seen);
  }
}

const changed = git('diff', '--name-only', BASE, '--', 'src/').stdout.toString().split('\n')
  .filter(f => f.endsWith('.js')).map(f => f.replace(/^flyDiy\//, ''));
const pairs = [];
for (const f of changed) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) continue;
  const oldB = git('show', `${BASE}:flyDiy/${f}`);
  if (oldB.status !== 0) continue;
  const A = evalRecord(oldB.stdout.toString('utf8'), f), B = evalRecord(fs.readFileSync(abs, 'utf8'), f);
  if (A.err || B.err) continue;                 // not a record (a consumer the session edited)
  B.vals.forEach(([k, v], i) => {
    const o = A.vals[i]; if (!o || o[0] !== k) return;
    if (k !== 'pack') return walk(o[1], v, f + ':' + k, pairs, new Set());
    // a prop pack names its maps by id (a sha12 of the bytes; a flat map's id names its colour), so the pairs
    // are made through each material slot: old texs[old id] -> new texs[new id]
    for (const pk in v.props) for (const mk in (v.props[pk].mats || {})) for (const s of ['map', 'nor', 'arm', 'emisMap', 'aoMap']) {
      const om = o[1].props[pk] && o[1].props[pk].mats[mk], ni = v.props[pk].mats[mk][s], oi = om && om[s];
      if (ni && oi && isC(v.texs[ni])) { const p = pathOf(o[1].texs[oi]); if (p) pairs.push({ where: `${f}:${pk}/${mk}.${s}`, path: p, c: v.texs[ni] }); }
    }
  });
}
if (!pairs.length) { console.log('flat_proof: no replaced map found against ' + BASE); process.exit(1); }

// the old files, from git, decoded at full resolution: the per-channel mean
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'flat_proof_'));
const uniq = [...new Set(pairs.map(p => p.path))], tmpOf = {};
uniq.forEach((p, i) => { const r = git('show', `${BASE}:flyDiy/${p}`); if (r.status === 0) { tmpOf[p] = path.join(tmp, i + path.extname(p)); fs.writeFileSync(tmpOf[p], r.stdout); } });
const PY = "import sys,json\nfrom PIL import Image, ImageStat\nout={}\nfor p in sys.stdin.read().splitlines():\n  im=Image.open(p).convert('RGB'); s=ImageStat.Stat(im); out[p]=[s.mean, im.size]\njson.dump(out, sys.stdout)";
const py = ['python3', 'python'].find(p => spawnSync(p, ['-c', 'import PIL'], { encoding: 'utf8' }).status === 0);
if (!py) { console.log('flat_proof: needs python + Pillow'); process.exit(1); }
const r = spawnSync(py, ['-c', PY], { input: Object.values(tmpOf).join('\n'), encoding: 'utf8', maxBuffer: 1 << 26 });
if (r.status !== 0) { console.log(r.stderr); process.exit(1); }
const M = JSON.parse(r.stdout);
let worst = 0, bad = 0;
const rows = new Map();
for (const p of pairs) {
  const m = tmpOf[p.path] && M[tmpOf[p.path]];
  if (!m) { bad++; console.log('  MISSING at base: ' + p.path); continue; }
  const d = Math.max(...m[0].map((x, i) => Math.abs(x - p.c[i])));
  worst = Math.max(worst, d); if (d > TOL) bad++;
  const k = p.path;
  if (!rows.has(k)) rows.set(k, { k, px: m[1].join('x'), mean: m[0].map(x => x.toFixed(2)).join(','), c: p.c.join(','), d, n: 0 });
  rows.get(k).n++;
}
for (const x of [...rows.values()].sort((a, b) => a.k < b.k ? -1 : 1))
  console.log(`  ${x.d <= TOL ? 'ok ' : 'BAD'} ${x.k.padEnd(62)} ${x.px.padStart(9)}  mean ${x.mean.padEnd(20)} -> [${x.c}]  |d| ${x.d.toFixed(2)}${x.n > 1 ? '  (' + x.n + ' slots)' : ''}`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`flat_proof: ${rows.size} replaced maps (${pairs.length} record slots) vs ${BASE}; worst |mean - constant| ${worst.toFixed(2)} codes (tol ${TOL}) - ${bad ? 'FAIL' : 'PASS'}`);
process.exit(bad ? 1 : 0);
