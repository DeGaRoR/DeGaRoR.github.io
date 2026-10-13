#!/usr/bin/env node
// G2370 (DMG-MATHLOCAL): THE CENSUS OF THE CORE'S sin / cos / pow - every Math.sin / Math.cos / Math.pow call in src/core,
// with the enclosing function (the nearest name the scan reads above it) and whether it is the CORE'S (must be
// CORE_MATH.*: its result feeds the simulation, and Chrome's builtins differ from node's in the last bit) or KEPT the
// builtin for a stated reason: pow(x, 2) / pow(x, 0.5) (every engine agrees: x * x and sqrt) and the ground field's GLSL
// text (its constants printed toFixed(6) into a shader - not state). GATE DMGDETERMINISM 4 reads it: a Math.sin / cos /
// general pow left in src/core is a site that bypasses CORE_MATH (red) - after a merge, `--apply` rewrites them.
//   node tools/_core_math_sites.js [--apply] [--json <file>]   (prints the census by file and function)
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'core');
// the kept-builtin sites that are not pow(x, 2 | 0.5): a line's text, by file (not its number: a merge moves lines)
const KEEP_TEXT = { '28b_ground_fields.js': [/\.toFixed\(6\)/] };
function fnAt(lines, i) {
  for (let j = i; j >= 0; j--) {
    const l = lines[j];
    const m = l.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/) || l.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/)
      || l.match(/^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/) || l.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:function|\([^)]*\)\s*=>)/)
      || l.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\(\s*function|\(\s*\(\s*\)\s*=>)/);
    if (m && !/^(if|for|while|switch|catch|return)$/.test(m[1])) return m[1];
  }
  return '(top level)';
}
function argsAt(s, k) {   // s[k] === '(' : the top-level comma-split arguments
  let d = 0, a = [], st = k + 1;
  for (let i = k; i < s.length; i++) { const c = s[i];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) { a.push(s.slice(st, i)); return a; } }
    else if (c === ',' && d === 1) { a.push(s.slice(st, i)); st = i + 1; } }
  throw new Error('unbalanced parentheses at ' + k);
}
// one file: { sites: [{ line, fn, op, core, why, at }], src }
function scanText(f, src) {
  const lines = src.split('\n'), starts = []; { let o = 0; for (const l of lines) { starts.push(o); o += l.length + 1; } }
  const lineOf = off => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= off) lo = m; else hi = m - 1; } return lo; };
  const out = [], re = /\b(Math|CORE_MATH)\.(sin|cos|pow)\(/g; let m;
  while ((m = re.exec(src))) {
    if (m.index > 0 && /[.\w$]/.test(src[m.index - 1])) continue;
    const ln = lineOf(m.index), txt = lines[ln];
    if (txt.slice(0, m.index - starts[ln]).includes('//')) continue;   // (a comment)
    const op = m[2], via = m[1];
    let why = null;
    if ((KEEP_TEXT[f] || []).some(r => r.test(txt))) why = 'shader text';
    if (op === 'pow') { const ex = argsAt(src, m.index + m[0].length - 1)[1].trim(); if (ex === '2' || ex === '0.5') why = 'pow(x, ' + ex + ') - every engine agrees'; }
    out.push({ line: ln + 1, fn: fnAt(lines, ln), op, via, core: !why, why, at: m.index });
  }
  return out;
}
function census(dir) {
  const files = fs.readdirSync(dir || DIR).filter(x => x.endsWith('.js')).sort(), R = [];
  for (const f of files) for (const s of scanText(f, fs.readFileSync(path.join(dir || DIR, f), 'utf8'))) R.push(Object.assign({ f }, s));
  return {
    sites: R,
    core: R.filter(s => s.core && s.via === 'CORE_MATH'), kept: R.filter(s => !s.core && s.via === 'Math'),
    stray: R.filter(s => s.core && s.via === 'Math'),            // a site whose result is state, on the builtin: red
    needless: R.filter(s => !s.core && s.via === 'CORE_MATH'),   // pow(x, 2) on CORE_MATH: harmless, slower
  };
}
module.exports = { census, scanText };
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--apply')) {   // the strays to CORE_MATH (in place)
    for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.js'))) {
      const p = path.join(DIR, f), src = fs.readFileSync(p, 'utf8'), e = scanText(f, src).filter(s => s.core && s.via === 'Math').map(s => s.at);
      if (!e.length) continue;
      let s = src; for (const at of e.reverse()) s = s.slice(0, at) + 'CORE_MATH' + s.slice(at + 4);
      fs.writeFileSync(p, s); console.log(f + ': ' + e.length + ' sites to CORE_MATH');
    }
  }
  const C = census(), G = {};
  for (const s of C.sites) { const g = ((G[s.f] = G[s.f] || {})[s.fn] = G[s.f][s.fn] || { sin: 0, cos: 0, pow: 0, kept: [], stray: [] });
    if (s.core && s.via === 'CORE_MATH') g[s.op]++; else if (s.core) g.stray.push(s.op + ' l.' + s.line); else g.kept.push(s.op + ' l.' + s.line + ' (' + s.why + ')'); }
  for (const f of Object.keys(G)) { const n = Object.values(G[f]).reduce((a, g) => a + g.sin + g.cos + g.pow, 0);
    console.log(f + ' - ' + n + ' on CORE_MATH: ' + Object.entries(G[f]).map(([fn, g]) => fn + ' ' + ['sin', 'cos', 'pow'].filter(o => g[o]).map(o => o + ' ' + g[o]).join(' ')
      + (g.kept.length ? ' [kept builtin: ' + g.kept.join('; ') + ']' : '') + (g.stray.length ? ' [STRAY - the builtin: ' + g.stray.join('; ') + ']' : '')).join(', ')); }
  console.log('TOTAL: ' + C.core.length + ' sites on CORE_MATH, ' + C.kept.length + ' kept the builtin, ' + C.stray.length + ' STRAY, ' + C.needless.length + ' pow(x, 2 | 0.5) on CORE_MATH');
  const jo = argv.indexOf('--json'); if (jo >= 0) fs.writeFileSync(argv[jo + 1], JSON.stringify(C.sites.map(s => { const o = Object.assign({}, s); delete o.at; return o; }), null, 1));
  process.exit(C.stray.length ? 1 : 0);
}
