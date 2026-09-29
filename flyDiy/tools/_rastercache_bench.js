#!/usr/bin/env node
// _rastercache_bench.js - THE RASTER TILE CACHE, TIMED (G735, B1b; a micro-benchmark, not a gate).
//
// The premises' ground raster (27_premises.js grHeight, G614) caches its 16 m tiles up to GR_CAP bytes. Before G735
// it kept every EMPTY tile (null: the ground itself) in the one insertion-ordered map and evicted by scanning it from
// the front for the first baked tile (past up to 18 596 nulls an eviction in FRAMECOST's boot), oldest-in first: a
// tile the solver reads every frame went when it was the oldest. G735 threads the baked tiles on an LRU list.
//
// ONE TRACE, TWO CORES, each in its own child process (a core's globals are the process's): Jolene, its premises
// composed with the cooked raster (FLYDIY_GROUND_RASTER=1: the page's default since RASTER-ON), then per "frame" a
// sweep of the ring (a row of a 2 m lattice over every modifier's box, walked in order - the forest fill's and the
// cover's reads, the tiles that fill the cache) and the HOT set (4 wheel points on HOME's stand x 20 substeps - the
// solver's reads, the tiles an LRU keeps). The heights under the points are the island's own (precomputed outside
// the clock); the clock times O.terrainFast(x, z, h) - the raster's read, the cache in it - over the whole trace.
// Every answer is kept: the two cores' answers are compared BIT FOR BIT (the cache holds what the bake / decode
// makes; which tiles it evicted must not change a bit).
//   node tools/_rastercache_bench.js                       the base = origin/claude/train-16-base's committed core
//   node tools/_rastercache_bench.js --base <file|rev>     another core (a file, or a git rev's tools/flight_core.js)
//        (a rev's COMMITTED core is only as fresh as its last build commit - trains commit source only: build the base
//        in a worktree and pass its tools/flight_core.js, as G738 did)
//   node tools/_rastercache_bench.js --reps 5               repeats per core (the median is reported)
//   node tools/_rastercache_bench.js --trace <file>         THE PAGE'S OWN READS instead of the synthetic trace: every
//        premises raster read of a FRAMECOST census, in the page's order (FRAMECOST_RASTER_TRACE=<file> node
//        tools/_framecost_check.js --census cub), replayed on the page's composition (Metlakatla cut)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

if (opt('child')) {
  // ---- the child: one core, the trace, the clock -------------------------------------------------------------------
  process.env.FLYDIY_GROUND_RASTER = '1';
  const C = require(path.resolve(opt('child')));
  for (const k of Object.keys(C)) global[k] = C[k];
  const IN = require(path.join(__dirname, 'island_node.js'));
  const boot = IN.islandBoot('jolene');
  let PREM = fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8');
  const TRACE = opt('trace');
  if (TRACE) {   // the page's composition: Metlakatla cut (world_boot.js THE TOWN SWITCH, G590)
    const U = C.PREMISES_GEN.unwrap(PREM), D = C.PREMISES_GEN.dropPlaces(U.rec, ['mk_']);
    if (D.n) PREM = C.PREMISES_GEN.envelope(U.name, D.rec, U.plaque, U.log);
  }
  const W = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: PREM, groundRaster: true });
  const O = W.premises.overlay, base = W.premises.base, F = O.frame;
  const mods = []; O.index.rect(-1e6, -1e6, 1e6, 1e6, M => { if (!mods.includes(M)) mods.push(M); });
  if (TRACE) {
    // the page's own reads, in its order (tools/_framecost_check.js FRAMECOST_RASTER_TRACE: x, z, h triples)
    const buf = fs.readFileSync(TRACE), T3 = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8), n = T3.length / 3, out = new Float64Array(n);
    const R0 = Object.assign({}, O.raster);
    const t0 = process.hrtime.bigint();
    for (let i = 0, k = 0; i < n; i++, k += 3) out[i] = O.terrainFast(T3[k], T3[k + 1], T3[k + 2]);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6, R = O.raster;
    fs.writeFileSync(opt('out'), Buffer.from(out.buffer));
    process.stdout.write(JSON.stringify({ n, ms, nsPerRead: ms * 1e6 / n, baked: R.baked - R0.baked, decoded: R.decoded - R0.decoded, empty: R.empty - R0.empty,
      evicted: R.evicted - R0.evicted, tiles: R.tiles, mb: +(R.bytes / 1048576).toFixed(1), bakeMs: +(R.bakeMs - R0.bakeMs).toFixed(0), decodeMs: +(R.decodeMs - R0.decodeMs).toFixed(0), mods: mods.length }) + '\n');
    process.exit(0);
  }
  // the trace (deterministic): every modifier's box on a 2 m lattice, row by row, cut into frames of ROW points
  const pts = [];
  mods.sort((a, b) => a.ord - b.ord);
  for (const M of mods) { const b = M.bbox; for (let z = b.z0; z <= b.z1; z += 2) for (let x = b.x0; x <= b.x1; x += 2) pts.push(F.toWorld(x, z)); }
  const st = C.siteOf('HOME').stand, hot = [[st.x - 1.1, st.z + 0.4], [st.x + 1.1, st.z + 0.4], [st.x, st.z - 4.8], [st.x + 0.2, st.z + 9.5]];
  const ROW = 400, SUB = 20;
  const xs = [], zs = [];
  for (let i = 0; i < pts.length; i += ROW) {
    for (let k = i; k < Math.min(pts.length, i + ROW); k++) { xs.push(pts[k][0]); zs.push(pts[k][1]); }
    for (let s = 0; s < SUB; s++) for (const [x, z] of hot) { xs.push(x + s * 0.01); zs.push(z); }
  }
  const n = xs.length, X = Float64Array.from(xs), Z = Float64Array.from(zs), H = new Float64Array(n), out = new Float64Array(n);
  for (let i = 0; i < n; i++) H[i] = base.terrainH(X[i], Z[i]);
  const R0 = Object.assign({}, O.raster);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) out[i] = O.terrainFast(X[i], Z[i], H[i]);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const R = O.raster;
  fs.writeFileSync(opt('out'), Buffer.from(out.buffer));
  process.stdout.write(JSON.stringify({ n, ms, nsPerRead: ms * 1e6 / n, baked: R.baked - R0.baked, decoded: R.decoded - R0.decoded, empty: R.empty - R0.empty,
    evicted: R.evicted - R0.evicted, tiles: R.tiles, mb: +(R.bytes / 1048576).toFixed(1), bakeMs: +(R.bakeMs - R0.bakeMs).toFixed(0), decodeMs: +(R.decodeMs - R0.decodeMs).toFixed(0), mods: mods.length }) + '\n');
  process.exit(0);
}

// ---- the parent: the two cores, interleaved ----------------------------------------------------------------------
const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rcbench-'));
let baseCore = opt('base', 'origin/claude/train-16-base');
if (!fs.existsSync(baseCore)) {
  const f = path.join(tmp, 'base_core.js');
  fs.writeFileSync(f, execFileSync('git', ['show', baseCore + ':flyDiy/tools/flight_core.js'], { cwd: ROOT, maxBuffer: 1 << 28 }));
  baseCore = f;
}
const cores = { before: baseCore, after: path.join(__dirname, 'flight_core.js') };
const REPS = +opt('reps', 3), res = { before: [], after: [] };
for (let r = 0; r < REPS; r++) for (const [k, core] of Object.entries(cores)) {
  const o = path.join(tmp, k + '.bin');
  const p = spawnSync(process.execPath, ['--max-old-space-size=4096', __filename, '--child', core, '--out', o].concat(opt('trace') ? ['--trace', path.resolve(opt('trace'))] : []), { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (p.status !== 0) { console.log(k + ' FAILED: ' + (p.stderr || p.stdout).slice(-1500)); process.exit(1); }
  res[k].push(Object.assign(JSON.parse(p.stdout.trim().split('\n').pop()), { bin: o + r }));
  fs.renameSync(o, o + r);
}
const med = (a, f) => { const v = a.map(f).sort((x, y) => x - y); return v[v.length >> 1]; };
console.log('THE RASTER TILE CACHE (Jolene, the cooked raster; ' + res.after[0].n + ' reads: ' + (opt('trace') ? 'the page\'s own, in its order (' + path.basename(opt('trace')) + '; Metlakatla cut as the page composes)' : res.after[0].mods + ' modifiers\' boxes on a 2 m lattice in rows of 400, 4 wheel points x 20 substeps between rows') + '; ' + REPS + ' runs each, interleaved)');
for (const k of ['before', 'after']) {
  const a = res[k];
  console.log('  ' + k.padEnd(7) + ' ' + med(a, x => x.ms).toFixed(0).padStart(6) + ' ms (' + a.map(x => x.ms.toFixed(0)).join(' / ') + '), ' + med(a, x => x.nsPerRead).toFixed(0) + ' ns a read; decoded ' + a[0].decoded
    + ' (' + a[0].decodeMs + ' ms), baked ' + a[0].baked + ' (' + a[0].bakeMs + ' ms), empty ' + a[0].empty + ', evicted ' + a[0].evicted + ', left ' + a[0].tiles + ' tiles / ' + a[0].mb + ' MB');
}
// bit for bit: every answer of every run of both cores
const ref = fs.readFileSync(res.before[0].bin);
let same = true;
for (const k of ['before', 'after']) for (const x of res[k]) if (!fs.readFileSync(x.bin).equals(ref)) same = false;
console.log('  answers: ' + (same ? 'IDENTICAL, bit for bit (' + res.after[0].n + ' Float64s x ' + (2 * REPS) + ' runs)' : 'DIFFER'));
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(same ? 0 : 1);
