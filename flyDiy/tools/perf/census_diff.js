#!/usr/bin/env node
// census_diff.js - TOWN-1 (A0 8 Nov: "name the +142 calls - which cells and materials, and how B gets back to M's count").
// Reads a metla_ab.js --out JSON made with --census (on with --shots): per row, approach.census and views[<view>], each
// { frames, perFrame, keys: [[key, draws per frame]] }, a key being  top group | named object | fill chunk + series |
// material | index count (i = instanced) | pass.  Prints side B minus side A per scene, at three levels: the top group and
// the pass; the group, the object's name stem, the material and the pass; and the full key. Positive = B draws more.
//   node tools/perf/census_diff.js <metla_ab.json> [--a P] [--b B] [--top 25]
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const F = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--a' && argv[argv.indexOf(a) - 1] !== '--b' && argv[argv.indexOf(a) - 1] !== '--top');
if (!F) { console.log('usage: node tools/perf/census_diff.js <metla_ab.json> [--a P] [--b B] [--top 25]'); process.exit(1); }
const A = opt('a', 'P'), B = opt('b', 'B'), TOP = +opt('top', 25);
const R = JSON.parse(fs.readFileSync(F, 'utf8')), rows = R.rows || [];
const pick = side => rows.filter(r => r.side === side);
const scenes = side => { const o = {}; for (const r of pick(side)) { if (r.approach && r.approach.census) (o.approach = o.approach || []).push(r.approach.census);
  for (const [v, c] of Object.entries(r.views || {})) if (c && c.keys) (o['view ' + v] = o['view ' + v] || []).push(c); } return o; };
// the mean over a side's runs of the draws per frame, per key at a level
const level = (cs, fn) => { const m = new Map(); for (const c of cs) for (const [k, v] of c.keys) { const kk = fn(k.split('|')); m.set(kk, (m.get(kk) || 0) + v / cs.length); } return m; };
const stem = s => s.replace(/[:#][^|]*$/, '');   // 'chunk:12,4' -> 'chunk', 'road:7' -> 'road'
const LV = [['group + pass', p => p[0] + ' | ' + p[5]], ['group, name stem, material, pass', p => [p[0], stem(p[1]), p[2] ? p[2].replace(/ c.*/, '') : '', p[3], p[5]].join(' | ')], ['full key', p => p.join(' | ')]];
const SA = scenes(A), SB = scenes(B);
if (!Object.keys(SA).length || !Object.keys(SB).length) { console.log('no census for ' + (Object.keys(SA).length ? B : A) + ' in ' + F + ' (sides: ' + [...new Set(rows.map(r => r.side))] + ')'); process.exit(1); }
for (const sc of Object.keys(SB).filter(k => SA[k])) {
  const ca = SA[sc], cb = SB[sc], tot = cs => cs.reduce((s, c) => s + c.perFrame, 0) / cs.length;
  console.log('\n== ' + sc + ': ' + A + ' ' + tot(ca).toFixed(1) + ' draws/frame (' + ca.map(c => c.frames).join(',') + ' fr), ' + B + ' ' + tot(cb).toFixed(1) + ' (' + cb.map(c => c.frames).join(',') + ' fr), ' + B + ' - ' + A + ' ' + (tot(cb) - tot(ca)).toFixed(1));
  for (const [name, fn] of LV) {
    const ma = level(ca, fn), mb = level(cb, fn), d = [];
    for (const k of new Set([...ma.keys(), ...mb.keys()])) { const x = (mb.get(k) || 0) - (ma.get(k) || 0); if (Math.abs(x) >= 0.5) d.push([k, x, ma.get(k) || 0, mb.get(k) || 0]); }
    d.sort((p, q) => Math.abs(q[1]) - Math.abs(p[1]));
    console.log('  -- ' + name + ' (' + d.length + ' keys differ by >= 0.5)');
    for (const [k, x, a, b] of d.slice(0, name === 'group + pass' ? 12 : TOP)) console.log('    ' + (x > 0 ? '+' : '') + x.toFixed(1).padStart(7) + '   ' + A + ' ' + a.toFixed(1).padStart(6) + '  ' + B + ' ' + b.toFixed(1).padStart(6) + '   ' + k);
  }
}
