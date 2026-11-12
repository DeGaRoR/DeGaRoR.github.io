#!/usr/bin/env node
// heavy_variants.js - HEAVY-SHADERS (BOOT-PROGRAMS, A0 10 Nov): the cold boot's heaviest links (the 10 Nov naming run: the
// pavement 34 s, the island ground 17 + 14 s, the premises patch 13 s) as text, counted, and their variants written for
// cold_links_bench.js. FXC's link time follows FLOW CONTROL, not size (COLD-LINKS G1310): a loop with constant bounds is
// unrolled, a loop inside it multiplies, a branchy body inside both is paid at every copy.
//   node tools/perf/heavy_variants.js <progs.json> [--only pavement,island-] [--stats] [--dyn <out.json>] [--bisect <out.json> --stubs pv]
// progs.json: cold_links_src.js's [{ name, mark, vs, fs }].
//   --stats  per program: length, loops (constant-bound / other), the deepest nest, the largest unrolled trip product
//            (the constant bounds multiplied down a nest), the body copies an unroll writes (every constant loop's product,
//            summed), ifs, texture reads, functions. (Functions are inlined by FXC: a loop in a function called inside a
//            loop multiplies too - not counted here; read the top loops' bodies)
//   --dyn    THE UNIFORM-BOUND VARIANT (look-neutral): every `for (int i = A; i < B; i++)` / `<=` with literal bounds gets
//            ` + uLoopZ` on its bound, uLoopZ a uniform int the program declares (0 when unset: the same iterations, the
//            same pixels) - a bound the compiler cannot know, so it keeps the loop a loop. --only limits it to programs
//            whose name starts with one of the prefixes (all the file's programs otherwise; the rest are copied as they are)
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const IN = argv.find(a => !a.startsWith('--') && !['--only', '--dyn', '--bisect', '--stubs'].includes(argv[argv.indexOf(a) - 1]));
if (!IN) { console.error('heavy_variants: <progs.json> [--only p1,p2] [--stats] [--dyn out.json]'); process.exit(2); }
const P = JSON.parse(fs.readFileSync(IN, 'utf8'));
const ONLY = opt('only', null) ? opt('only').split(',') : null;
const picked = p => !ONLY || ONLY.some(o => p.name.startsWith(o));

// strip comments (the counts read code only)
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
// a for loop's header: for (int i = A; i <op> B; i++ | ++i | i += 1)
const FOR = /for\s*\(\s*int\s+(\w+)\s*=\s*(-?\d+)\s*;\s*\1\s*(<=|<)\s*([^;]+?)\s*;\s*(?:\1\s*\+\+|\+\+\s*\1|\1\s*\+=\s*1)\s*\)/g;
// the loops and their nesting: each for's body is the statement or the braces after its header
function loops(src) {
  const s = code(src), out = [];
  let m; FOR.lastIndex = 0;
  while ((m = FOR.exec(s))) {
    const lit = /^-?\d+$/.test(m[4].trim());
    const trips = lit ? (+m[4] - +m[2] + (m[3] === '<=' ? 1 : 0)) : null;
    // the body's extent: braces, or up to the next ';' at depth 0
    let i = m.index + m[0].length; while (/\s/.test(s[i])) i++;
    let end;
    if (s[i] === '{') { let d = 0; for (end = i; end < s.length; end++) { if (s[end] === '{') d++; else if (s[end] === '}' && --d === 0) break; } }
    else if (s.startsWith('for', i)) { end = -1; }   // a for right after a for: its body ends with the inner one's (resolved below)
    else { end = s.indexOf(';', i); }
    out.push({ at: m.index, hdrEnd: m.index + m[0].length, var: m[1], bound: m[4].trim(), lit, trips, end });
  }
  // `for (...) for (...) { }`: the outer's body ends where the inner's does
  for (let k = out.length - 1; k >= 0; k--) if (out[k].end === -1 && out[k + 1]) out[k].end = out[k + 1].end;
  // depth and the unrolled product: the constant trips multiplied down the enclosing loops
  for (const L of out) {
    const par = out.filter(o => o !== L && o.at < L.at && o.end >= L.at);
    L.depth = par.length + 1;
    L.product = [L, ...par].reduce((a, o) => a * (o.lit ? o.trips : 1), 1);
  }
  return out;
}
function stats(p) {
  const f = code(p.fs), L = loops(p.fs);
  const fns = (f.match(/\n\s*(?:float|vec[234]|int|bool|void|mat[234])\s+\w+\s*\([^)]*\)\s*\{/g) || []).length;
  return { name: p.name, fsKB: +(p.fs.length / 1024).toFixed(1), vsKB: +(p.vs.length / 1024).toFixed(1), loops: L.length, constLoops: L.filter(l => l.lit).length,
    deepest: L.reduce((a, l) => Math.max(a, l.depth), 0), maxProduct: L.reduce((a, l) => Math.max(a, l.product), 0),
    copies: L.filter(l => l.lit).reduce((a, l) => a + l.product, 0),   // (the loop bodies an unroll writes out, all nests)
    ifs: (f.match(/\bif\s*\(/g) || []).length, tex: (f.match(/\btexture(?:Lod|Grad|Fetch)?\s*\(|\btexelFetch\s*\(/g) || []).length, fns,
    top: L.filter(l => l.lit).sort((a, b) => b.product - a.product).slice(0, 6).map(l => l.var + '<' + l.bound + ' x' + l.product + '@d' + l.depth) };
}
if (argv.includes('--stats') || (!opt('dyn', null) && !opt('bisect', null))) {
  for (const p of P.filter(picked)) console.log(JSON.stringify(stats(p)));
}
const DYN = opt('dyn', null);
if (DYN) {
  const out = P.map(p => {
    if (!picked(p)) return p;
    let n = 0;
    const fsx = p.fs.replace(FOR, (all, v, a, op, b) => /^-?\d+$/.test(b.trim()) ? (n++, all.replace(new RegExp('(' + op + ')\\s*' + b.trim().replace('-', '\\-') + '\\s*;'), '$1 ' + b.trim() + ' + uLoopZ;')) : all);
    // the uniform, after the precision / version lines (three's prefix ends its defines before main's chunks)
    const at = fsx.search(/\n(?!#|precision)[^\n]*\S/);
    const fs2 = fsx.slice(0, at) + '\nuniform int uLoopZ;' + fsx.slice(at);
    console.log('  dyn ' + p.name + ': ' + n + ' loops on uLoopZ');
    return Object.assign({}, p, { name: p.name + ':dyn', fs: fs2 });
  });
  fs.writeFileSync(DYN, JSON.stringify(out));
  console.log('heavy_variants: ' + out.length + ' programs -> ' + DYN);
}
// --bisect <out.json> --stubs pv,pm   THE BISECT (HEAVY-SHADERS, 10 Nov: the uniform-bound loops changed nothing - the time is
//   not the constant loops' unroll). MEASUREMENT ONLY, never a look: per picked program, the original twice (the second with
//   a `#define BIS_COPY` line: another source, so no program cache answers it - the spread between the two is the noise),
//   then one variant per function whose name starts with a --stubs prefix, that function made to return zero at once (the
//   compiler drops its body and everything only it fed) - the link time each one saves names where the time goes.
//   cold_links_bench --batch 4 links them a few at a time.
const BIS = opt('bisect', null);
if (BIS) {
  const PRE = (opt('stubs', 'pv') || '').split(',').filter(Boolean), out = [];
  const ZERO = { float: '0.0', vec2: 'vec2(0.0)', vec3: 'vec3(0.0)', vec4: 'vec4(0.0)', int: '0', bool: 'false', void: '' };
  const copy = (src, k) => src.replace(/^(#version[^\n]*\n)/, '$1#define BIS_COPY ' + k + '\n');
  for (const p of P.filter(picked)) {
    out.push(Object.assign({}, p, { name: p.name + ':base' }), Object.assign({}, p, { name: p.name + ':base2', fs: copy(p.fs, 2) }));
    const DEF = /\n(float|vec[234]|int|bool|void)\s+(\w+)\s*\(([^)]*)\)\s*\{/g; let m; const seen = new Set();
    while ((m = DEF.exec(p.fs))) {
      const [all, ty, fn] = m; if (!PRE.some(x => fn.startsWith(x)) || seen.has(fn)) continue; seen.add(fn);
      const at = m.index + all.length, fs2 = p.fs.slice(0, at) + ' return' + (ZERO[ty] ? ' ' + ZERO[ty] : '') + '; ' + p.fs.slice(at);
      out.push(Object.assign({}, p, { name: p.name + ':stub-' + fn, fs: copy(fs2, 'stub_' + fn) }));
    }
    console.log('  bisect ' + p.name + ': base x2 + ' + seen.size + ' stubs (' + [...seen].join(' ') + ')');
  }
  fs.writeFileSync(BIS, JSON.stringify(out));
  console.log('heavy_variants: ' + out.length + ' programs -> ' + BIS);
}
