// G2372 (DMG-MATHLOCAL): ns per call - (1) node: the base's fsin / fcos / fpow (9fca23c6: top-level functions) against
// CORE_MATH's (this branch: one closure) and the builtins; (2) a PAGE (headless Chromium): what a VIEWER script's
// Math.sin / Math.cos / Math.pow cost after the core loads - the base's core (the page-wide shadow: fdlibm) against this
// one (the builtins). node ns_per_call.js <base core> <this core>
'use strict';
const path = require('path');
const [baseF, mineF] = process.argv.slice(2).map(f => path.resolve(f));
process.env.FLYDIY_STALE_OK = '1';
const bench = (M, reps) => {   // (monomorphic loops, 2e6 arguments x 5, the median of `reps`)
  const N = 2000000, xs = new Float64Array(N), ys = new Float64Array(N), zs = new Float64Array(N);
  let s = 7; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return (s >>> 0) / 4294967296; };
  for (let i = 0; i < N; i++) { xs[i] = (rnd() - 0.5) * 1.2; ys[i] = rnd() * 2 + 0.01; zs[i] = (rnd() - 0.5) * 48; }
  const out = {};
  const run = (name, f) => { const t = []; for (let r = 0; r < reps; r++) { let acc = 0; const a = performance.now(); for (let k = 0; k < 5; k++) acc += f(); t.push((performance.now() - a) / (5 * N) * 1e6); if (acc === 42) console.log(''); }
    t.sort((a, b) => a - b); out[name] = +t[t.length >> 1].toFixed(2); };
  run('loop', () => { let a = 0; for (let i = 0; i < N; i++) a += xs[i]; return a; });
  run('sin |x|<0.6', () => { let a = 0; for (let i = 0; i < N; i++) a += M.sin(xs[i]); return a; });
  run('cos |x|<0.6', () => { let a = 0; for (let i = 0; i < N; i++) a += M.cos(xs[i]); return a; });
  run('sin |x|<24', () => { let a = 0; for (let i = 0; i < N; i++) a += M.sin(zs[i]); return a; });
  run('pow y^5.2559', () => { let a = 0; for (let i = 0; i < N; i++) a += M.pow(ys[i], 5.2559); return a; });
  return out;
};
if (process.argv[4] === '--row') {   // (one row, its own process: no call site shared between rows)
  const which = process.argv[5], B = require(baseF), C = require(mineF);
  const M = which === 'builtin' ? Math : which === 'base' ? { sin: B.fsin, cos: B.fcos, pow: B.fpow } : C.CORE_MATH;
  console.log('ROW ' + JSON.stringify(bench(M, 5)));
} else (async () => {
  const { execFileSync } = require('child_process'), R = 3, rows = {};
  const add = (tag, r) => { (rows[tag] = rows[tag] || []).push(r); };
  const { chromium } = require('playwright'), br = await chromium.launch();
  for (let rep = 0; rep < R; rep++) {
    for (const [tag, w] of [['node builtin Math', 'builtin'], ['node base fsin / fcos / fpow (9fca23c6, top-level)', 'base'], ['node CORE_MATH (this branch, one closure)', 'core']]) {
      const o = execFileSync(process.execPath, [__filename, baseF, mineF, '--row', w], { encoding: 'utf8', env: process.env });
      add(tag, JSON.parse(o.split('\n').find(l => l.startsWith('ROW ')).slice(4)));
    }
    for (const [tag, f, expr] of [['page after the base core: a viewer script\'s Math', baseF, 'Math'], ['page after this core: a viewer script\'s Math', mineF, 'Math'], ['page: CORE_MATH', mineF, 'CORE_MATH']]) {
      const pg = await br.newPage(); await pg.setContent('<!doctype html><title>ns</title>'); await pg.addScriptTag({ path: f });
      add(tag, await pg.evaluate('(' + bench.toString() + ')(' + expr + ', 5)')); await pg.close();
    }
  }
  await br.close();
  console.log('ns per call: the median of 5 timings x ' + R + ' fresh processes / pages each (2e6 arguments x 5; node ' + process.versions.v8 + ', Chromium headless ' + '141); each cell the median of the ' + R);
  const cols = Object.keys(rows['node builtin Math'][0]), md = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  console.log('  ' + ''.padEnd(54) + cols.map(c => c.padStart(15)).join(''));
  for (const [k, rs] of Object.entries(rows)) console.log('  ' + k.padEnd(54) + cols.map(c => String(md(rs.map(r => r[c]))) + ' [' + rs.map(r => r[c]).join(' ') + ']').map(x => x.padStart(15)).join(' '));
})();
