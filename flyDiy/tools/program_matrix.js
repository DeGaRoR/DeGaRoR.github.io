#!/usr/bin/env node
// program_matrix.js - A PROGRAM FAMILY ON ITS REAL AXES, AND TWO LOADS SIDE BY SIDE (PERF-TRACE, 22 Nov 2026)
//
// The cold captures of 22 Nov: the aircraft's skin is 79 programs of ~210 KB, a third of the link queue. PERF-LEAD's
// reading of the code: the finish is a uniform; what multiplies the programs is CONTEXT. This prints a family (every
// program whose owner contains --family, default 'aircraft / skin') along those axes, from one saved flight log:
//   kind      three's type (Standard / Physical) and the surface switch (AEROSKIN_SURF)
//   side      front / FLIP_SIDED / DOUBLE_SIDED
//   near      CRAFT_NEAR_ONLY
//   hook      a hook's body switches (DMG_SCUFF, GD_OFF, FLOWN_FADE ...) and the owner's own suffix (+ scuff, + cutaway, parked)
//   lights    LIGHTS=dir.point.spot.hemi / SHADOWS=dir.point.spot (the scene the program was keyed in)
//   output    TONE= / OUT= (the target's tone mapping and transfer)
//   target    the render target it was keyed for (by its name, where the code names it)
// For each axis: its values with programs, KB of GLSL, pending share and how many were ever DRAWN; then the distinct
// COMBINATIONS (the real variants), largest share first. The body axes need a log from perf-trace-4 or later; an older
// log prints '-' for them and says so.
//
//   node tools/program_matrix.js <flightlog.json[.gz]> [--family "aircraft / skin"] [--top 40] [--json]
//   node tools/program_matrix.js <base.json> --against <other.json> [--label-a BASE --label-b CUBELEAN] [--family ...]
//        two loads: the family's programs, KB, share and drawn in each, per axis value, and the combinations only one has
'use strict';
const fs = require('fs'), path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js')), PR = require(path.join(__dirname, 'program_report.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;

function axes(p) {
  const d = new Set(p.defs || []), has = k => d.has(k), val = pre => { for (const x of d) if (x.indexOf(pre) === 0) return x.slice(pre.length); return null; };
  const body = Array.isArray(p.body);
  const surf = val('AEROSKIN_SURF=');
  const hooks = [...d].filter(x => /^(DMG|GD|BAND)_/.test(x) || x === 'FLOWN_FADE').map(x => x.split('=')[0]).sort();
  const suffix = [...new Set((p.own || []).map(o => { const m = /\)\s*(\+ .+)$/.exec(o); return (/^fleet \//.test(o) ? 'parked' : '') + (m ? ' ' + m[1] : ''); }).map(s => s.trim()).filter(Boolean))].sort();
  return {
    kind: (p.type === 'MeshPhysicalMaterial' || has('PHYSICAL') ? 'Physical' : (p.type || '').replace(/^Mesh|Material$/g, '')) + (surf != null ? ' surf' + surf : '') + (has('USE_CLEARCOAT') ? ' clearcoat' : ''),
    side: has('DOUBLE_SIDED') ? 'double' : has('FLIP_SIDED') ? 'back' : 'front',
    near: has('CRAFT_NEAR_ONLY=1') ? 'near-only' : 'all',
    hook: (hooks.join(' ') || (body ? 'none' : '-')) + (suffix.length ? '  [' + suffix.join(', ') + ']' : ''),
    lights: body ? ((val('LIGHTS=') || 'unlit') + ' / sh ' + (val('SHADOWS=') || 'none')) : '-',
    output: body ? ((val('TONE=') || 'no tone') + ' / ' + (val('OUT=') || '?') + (has('OPAQUE') ? ' opaque' : '') + (has('DITHERING') ? ' dither' : '')) : '-',
    target: p.rt || '?',
  };
}
const AX = ['kind', 'side', 'near', 'hook', 'lights', 'output', 'target'];

function family(log, fam) {
  const rows = PR.programs(log); PR.shares(rows);
  const F = rows.filter(p => p.three && (p.own || []).some(o => o.indexOf(fam) >= 0));
  const hasBody = F.some(p => Array.isArray(p.body));
  const cell = () => ({ programs: 0, kb: 0, shareS: 0, drawn: 0 });
  const add = (c, p) => { c.programs++; c.kb += p.vs != null ? (p.vs + p.fs) / 1024 : 0; c.shareS += (p.share || 0) / 1000; if (p.useT != null) c.drawn++; };
  const byAxis = {}; for (const a of AX) byAxis[a] = new Map();
  const combos = new Map(), tot = cell();
  for (const p of F) { const A = axes(p); add(tot, p);
    for (const a of AX) { let c = byAxis[a].get(A[a]); if (!c) byAxis[a].set(A[a], c = cell()); add(c, p); }
    const k = AX.map(a => A[a]).join(' | '); let c = combos.get(k); if (!c) combos.set(k, c = Object.assign(cell(), { key: k, axes: A, owners: new Set() })); add(c, p); for (const o of (p.own || [])) if (o.indexOf(fam) >= 0) c.owners.add(o); }
  const fin = c => ({ programs: c.programs, kb: Math.round(c.kb), shareS: r1(c.shareS), drawn: c.drawn });
  return { family: fam, hasBody, total: fin(tot), texts: new Set(F.map(p => p.fp)).size,
    axes: Object.fromEntries(AX.map(a => [a, [...byAxis[a]].map(([v, c]) => Object.assign({ value: v }, fin(c))).sort((x, y) => y.shareS - x.shareS || y.programs - x.programs)])),
    combos: [...combos.values()].map(c => Object.assign({ key: c.key, owners: [...c.owners].sort() }, fin(c))).sort((x, y) => y.shareS - x.shareS || y.programs - x.programs) };
}

function text(M, top) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n);
  L.push('FAMILY "' + M.family + '": ' + M.total.programs + ' programs (' + M.texts + ' distinct texts), ' + M.total.kb + ' KB of GLSL, ' + M.total.shareS + ' s of pending share, ' + M.total.drawn + ' ever drawn' +
    (M.hasBody ? '' : '   [this log has no body axes: lights / output / hook read "-" - it needs a build with perf-trace-4]'));
  for (const a of AX) { L.push('  ' + a.toUpperCase()); L.push('  ' + lp('progs', 7) + lp('KB', 8) + lp('share s', 9) + lp('drawn', 7));
    for (const v of M.axes[a]) L.push('  ' + lp(v.programs, 7) + lp(v.kb, 8) + lp(v.shareS, 9) + lp(v.drawn, 7) + '  ' + v.value); }
  L.push('  THE COMBINATIONS (' + M.combos.length + ' distinct; ' + AX.join(' | ') + ')'); L.push('  ' + lp('progs', 7) + lp('KB', 8) + lp('share s', 9) + lp('drawn', 7));
  for (const c of M.combos.slice(0, top || 40)) L.push('  ' + lp(c.programs, 7) + lp(c.kb, 8) + lp(c.shareS, 9) + lp(c.drawn, 7) + '  ' + c.key);
  return L.join('\n');
}
function compare(A, B, la, lb) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n), d = (x, y) => (y - x > 0 ? '+' : '') + r1(y - x);
  L.push('FAMILY "' + A.family + '"   ' + la + ' -> ' + lb);
  L.push('  programs ' + A.total.programs + ' -> ' + B.total.programs + ' (' + d(A.total.programs, B.total.programs) + '), KB ' + A.total.kb + ' -> ' + B.total.kb + ' (' + d(A.total.kb, B.total.kb) + '), pending share ' + A.total.shareS + ' -> ' + B.total.shareS + ' s (' + d(A.total.shareS, B.total.shareS) + '), drawn ' + A.total.drawn + ' -> ' + B.total.drawn);
  for (const a of AX) { const vals = new Map(); for (const v of A.axes[a]) vals.set(v.value, [v, null]); for (const v of B.axes[a]) { const e = vals.get(v.value); if (e) e[1] = v; else vals.set(v.value, [null, v]); }
    L.push('  ' + a.toUpperCase() + '   (programs, share s, drawn: ' + la + ' -> ' + lb + ')');
    for (const [k, [x, y]] of [...vals].sort((p, q) => ((q[1][0] || q[1][1]).shareS) - ((p[1][0] || p[1][1]).shareS)))
      L.push('  ' + lp(x ? x.programs : 0, 6) + ' ->' + lp(y ? y.programs : 0, 4) + lp(x ? x.shareS : 0, 8) + ' ->' + lp(y ? y.shareS : 0, 6) + lp(x ? x.drawn : 0, 6) + ' ->' + lp(y ? y.drawn : 0, 4) + '  ' + k); }
  const ka = new Map(A.combos.map(c => [c.key, c])), kb = new Map(B.combos.map(c => [c.key, c]));
  const onlyA = A.combos.filter(c => !kb.has(c.key)), onlyB = B.combos.filter(c => !ka.has(c.key));
  L.push('  COMBINATIONS only in ' + la + ': ' + onlyA.length + ' (' + onlyA.reduce((s, c) => s + c.programs, 0) + ' programs, ' + r1(onlyA.reduce((s, c) => s + c.shareS, 0)) + ' s)'); for (const c of onlyA.slice(0, 15)) L.push('      ' + lp(c.programs, 3) + lp(c.shareS, 7) + ' s  ' + c.key);
  L.push('  COMBINATIONS only in ' + lb + ': ' + onlyB.length + ' (' + onlyB.reduce((s, c) => s + c.programs, 0) + ' programs, ' + r1(onlyB.reduce((s, c) => s + c.shareS, 0)) + ' s)'); for (const c of onlyB.slice(0, 15)) L.push('      ' + lp(c.programs, 3) + lp(c.shareS, 7) + ' s  ' + c.key);
  return L.join('\n');
}
module.exports = { family, axes, text, compare, AX };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--family', '--top', '--against', '--label-a', '--label-b'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/program_matrix.js <flightlog.json[.gz]> [--family "aircraft / skin"] [--top 40] [--json] [--against other.json --label-a A --label-b B]'); process.exit(2); }
  const fam = opt('family', 'aircraft / skin'), A = family(AL.load(file), fam), other = opt('against', null);
  if (other) { const B = family(AL.load(other), fam); console.log(argv.includes('--json') ? JSON.stringify({ a: A, b: B }) : compare(A, B, opt('label-a', path.basename(file).replace(/\.flightlog\.json.*$|\.json.*$/, '')), opt('label-b', path.basename(other).replace(/\.flightlog\.json.*$|\.json.*$/, '')))); }
  else console.log(argv.includes('--json') ? JSON.stringify(A) : text(A, +opt('top', 40)));
}
