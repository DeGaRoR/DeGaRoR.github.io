#!/usr/bin/env node
// woodland_census.js - WHERE THE WOODLAND STANDS AGAINST THE FOREST FILL (G1480, WOODLAND). The page in node
// (tools/_page_node.js, the tree given), Jolene, the user's Cub rolled out; then, island-wide:
//   - the woodland: world.trees (its physics seeds) and every instance the woodland planter dealt (TREE_LOD.drawn's own
//     flag - 0 on a tree whose planter throws), by distance from HOME's stand;
//   - the fill: every plant its walk makes (TREE_FILL.plants: both parts of every 1024 m chunk, full density, nothing built);
//   - for each woodland instance (or seed, when none are dealt) the nearest fill plant: how many stand inside the fill.
// JSON on stdout's last line (WOODCENSUS {...}). ~4-6 GB, minutes: take the CPU lock.
//   node --max-old-space-size=7000 tools/perf/woodland_census.js --tree D:/Dev/wt-wood-a [--wip builds/cub_2026-09-20_corrected.json]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TREE = path.resolve(opt('tree', path.join(__dirname, '..', '..', '..')));
const WIP = opt('wip', 'builds/cub_2026-09-20_corrected.json');
(async () => {
  const { openPage } = require(path.join(TREE, 'flyDiy', 'tools', '_page_node.js'));
  const t0 = Date.now();
  const P = await openPage({ quiet: true, storage: {}, wip: fs.readFileSync(path.join(TREE, 'flyDiy', WIP), 'utf8') });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  W.document.getElementById('bGo').click();
  const tripDone = () => { const Tr = W.FLYDIY_TRIPS; const t = Tr && Tr[Tr.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
  await P.frames(30);
  const w = W.FLIGHT_PROBE.world(), cg = W.FLIGHT_PROBE.sim().cgPos();
  const D = W.TREE_LOD.drawn(cg[0], cg[2], 1e6);
  const wood = []; let fillLive = 0;
  for (let i = 0; i < D.length; i += 4) if (D[i + 3]) wood.push(D[i], D[i + 2]); else fillLive++;
  const seeds = []; for (const T of w.trees) seeds.push(T.x, T.z);
  // the fill's walk over the woodland's box (+ 100 m)
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const T of w.trees) { if (T.x < x0) x0 = T.x; if (T.x > x1) x1 = T.x; if (T.z < z0) z0 = T.z; if (T.z > z1) z1 = T.z; }
  const tw = Date.now();
  const F = W.TREE_FILL.plants(x0 - 100, z0 - 100, x1 + 100, z1 + 100);
  const walkS = (Date.now() - tw) / 1000;
  const C = 8, grid = new Map(); let nFill = 0;
  for (let i = 0; i < F.length; i += 3) { nFill++; const k = Math.floor(F[i] / C) * 65536 + Math.floor(F[i + 1] / C); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(F[i], F[i + 1]); }
  const nearest = (x, z, R) => { let bd = R * R; const cx = Math.floor(x / C), cz = Math.floor(z / C), n = Math.ceil(R / C);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const L = grid.get((cx + a) * 65536 + cz + b); if (L) for (let j = 0; j < L.length; j += 2) { const d = (L[j] - x) ** 2 + (L[j + 1] - z) ** 2; if (d < bd) bd = d; } }
    return Math.sqrt(bd); };
  const within = (x, z, R) => { let n = 0; const cx = Math.floor(x / C), cz = Math.floor(z / C), m = Math.ceil(R / C);
    for (let a = -m; a <= m; a++) for (let b = -m; b <= m; b++) { const L = grid.get((cx + a) * 65536 + cz + b); if (L) for (let j = 0; j < L.length; j += 2) if ((L[j] - x) ** 2 + (L[j + 1] - z) ** 2 <= R * R) n++; }
    return n; };
  const BINS = [3, 6.4, 10, 20, 40];
  const cover = (pts) => { const h = BINS.map(() => 0); let far = 0, dens = 0; const ring = { d1k: 0, d3k: 0 }, ringIn = { d1k: 0, d3k: 0 };
    for (let i = 0; i < pts.length; i += 2) { const x = pts[i], z = pts[i + 1], d = nearest(x, z, 40); let b = BINS.findIndex(v => d <= v); if (b < 0) far++; else h[b]++;
      if (i % 20 === 0) dens += within(x, z, 20);
      const dc = Math.hypot(x - cg[0], z - cg[2]); if (dc <= 1000) { ring.d1k++; if (d <= 10) ringIn.d1k++; } if (dc <= 3000) { ring.d3k++; if (d <= 10) ringIn.d3k++; } }
    const n = pts.length / 2; let acc = 0;
    return { n, bins: BINS.map((v, i) => ({ within: v, n: h[i], cum: (acc += h[i]) })), past40: far, fillWithin20m: n ? +(dens / Math.ceil(n / 10)).toFixed(1) : 0, ring, ringIn }; };
  const out = { tree: TREE, world: W.FLYDIY_WORLD, build: W.FLYDIY_BUILD, cg: cg.map(v => +v.toFixed(1)), worldTrees: w.trees.length,
    woodDealt: wood.length / 2, fillLiveDealt: fillLive, fillWalk: nFill, walkS, box: [x0, z0, x1, z1].map(Math.round),
    placed: W.TREE_PLACE ? W.TREE_PLACE.list().length : null,
    seedsVsFill: cover(seeds), woodVsFill: wood.length ? cover(wood) : null,
    secs: Math.round((Date.now() - t0) / 1000), errors: P.errors.filter(e => /^(script |timer: |frame: )/.test(e)).slice(0, 5) };
  process.stdout.write('\nWOODCENSUS ' + JSON.stringify(out) + '\n');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
