#!/usr/bin/env node
// ===========================================================================
// TERRAIN BAKE — the adaptive quadtree baker (futureDesigns/WORLD-V2.md).
// ===========================================================================
// Source in, one asset out. The SOURCE is anything with
//
//     { bounds: {x0, z0, x1, z1}, terrainH(x, z), surface?(x, z) }
//
// which is exactly the shape `makeWorld()` already returns — so this runs
// against the analytic world TODAY, with no external data, and against a
// GeoTIFF-backed sampler later without a line changing. That is WORLD-V2 §11's
// W2-before-W4: prove the structure on a world whose right answer is already
// known, then point it at one that is not.
//
// WHAT IT PRODUCES. A quadtree whose LEAF DEPTH follows an error budget, so a
// bog is cheap and a gully is not. Each leaf is a (PATCH+1)² grid of int16
// heights; its position comes from the tree address, so nothing but height is
// ever stored. See §2 of the spec.
//
// THE FIRST JOB OF THIS SCRIPT IS TO TELL US IF THE BUDGET IS REAL. WORLD-V2
// §4 estimates ~31 600 leaves and ~40 MB for Ursoy from arithmetic on assumed
// zone areas. Those are estimates, and `--report` exists to replace them with
// measurements before anybody builds a renderer on top of them.
//
//   node tools/terrain_bake.js --report
//   node tools/terrain_bake.js --eps 1.5 --max-depth 12 --out bench/terrain/e1p5
//
// WHERE THE OUTPUT GOES, and why the tool enforces it. `media/` is the SHIPPED
// store: GATE MEDIA requires every file under it to be named by a baked
// manifest, because "orphans are how a 400 MB directory happens one forgotten
// file at a time". A bench bake is a developer artefact — reproducible in
// seconds, interesting to nobody but the person tuning eps — so it belongs in
// the gitignored `bench/`, and writing one into `media/` is refused below
// rather than left to the gate to notice. It was left to the gate to notice
// once, on 2026-09-01, and the gate did its job.
//
// DETERMINISM. Fixed iteration order, integer addresses, no Math.random, and
// the source is itself deterministic. Same flags give the same bytes — which
// GATE TERRAIN will hold us to.
// ===========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

// ---- flags ---------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
};
const num = (name, def) => { const v = flag(name, null); return v === null ? def : +v; };

const CFG = {
  patch:    num('patch', 32),          // cells per patch edge; (patch+1)² vertices
  minDepth: num('min-depth', 4),
  maxDepth: num('max-depth', 13),
  eps:      num('eps', 2.0),           // metres of vertical error allowed
  seaLevel: num('sea', 0),
  // Under closed canopy the ground is not visible, so error there costs
  // nothing to hide (WORLD-V2 §2.1). This is a physical argument, not
  // laziness — and it is a MULTIPLIER on eps, applied per node.
  forestBias: num('forest-bias', 2.5),
  out:      flag('out', null),          // default under bench/, see writeGuard
  report:   !!flag('report', false),
  seed:     num('seed', 0),
};

// ---- where output may go -------------------------------------------------
// A bake reaches `media/` only when a manifest names it, and that day the
// manifest is what should be writing it. Until then this is a hard refusal
// with the reason attached, because a message that explains itself is the
// difference between a fixed mistake and a repeated one.
function writeGuard(out) {
  const rel = path.relative(path.join(__dirname, '..'), path.resolve(out));
  if (rel.split(path.sep)[0] === 'media') {
    console.error(
      `\n  REFUSED: --out '${out}' is under media/.\n\n` +
      `  media/ is the SHIPPED asset store and GATE MEDIA requires every file\n` +
      `  in it to be named by a baked manifest. A bench bake has no manifest,\n` +
      `  so it would ship to players as an orphan and go red on the next gate\n` +
      `  run. Write it to bench/ instead:\n\n` +
      `      --out bench/terrain/${path.basename(out)}\n\n` +
      `  When the terrain asset really does ship, the thing writing it into\n` +
      `  media/ will be the manifest bake, not this bench tool.\n`);
    process.exit(2);
  }
}

// ---- the sources ---------------------------------------------------------
// Both satisfy ONE interface — { bounds, terrainH, surface? } — which is the
// shape makeWorld() already returns, so the baker never learns where its
// heights came from.
//
//   analytic   the procedural world. Needs nothing, so the structure can be
//              proved against a world whose right answer is already known.
//   grid       a raw float32 raster from tools/island_prep.py. This is Ursoy.
//
// THERE IS NO GeoTIFF READER HERE ON PURPOSE. Mosaicking, reprojecting and
// clipping are GDAL's job and island_prep.py does them; what arrives here is
// numbers and a JSON sidecar. See that script's header.
function loadSource() {
  const which = flag('source', 'analytic');
  if (which === 'analytic') {
    const core = require(path.join(__dirname, 'flight_core.js'));
    const w = core.makeWorld(CFG.seed);
    return { name: `analytic seed ${CFG.seed}`, bounds: w.bounds,
             terrainH: w.terrainH, surface: w.surface, SURFACE: w.SURFACE };
  }
  if (which === 'grid') return loadGrid(flag('grid', null));
  throw new Error(`unknown source '${which}' — 'analytic' or 'grid'`);
}

// A raster on disk, sampled bilinearly. Out-of-grid reads return sea rather
// than throwing: the baker walks a SQUARE quadtree over a domain that may be
// wider than the data, and the honest answer off the edge of an island is
// water.
function loadGrid(prefix) {
  if (!prefix) throw new Error('--source grid needs --grid <prefix> ' +
    '(the output of tools/island_prep.py)');
  const meta = JSON.parse(fs.readFileSync(prefix + '.json', 'utf8'));
  const buf = fs.readFileSync(prefix + '.f32');
  const a = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const { w, h, x0, z0, cell } = meta;
  if (a.length !== w * h)
    throw new Error(`grid ${prefix}: sidecar says ${w}x${h}=${w*h} cells, ` +
                    `file holds ${a.length}`);
  const x1 = x0 + w * cell, z1 = z0 + h * cell;
  // the quadtree is square; take the larger side and let the rest be sea
  const side = Math.max(x1 - x0, z1 - z0);
  const terrainH = (x, z) => {
    const u = (x - x0) / cell - 0.5, v = (z - z0) / cell - 0.5;
    const i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i >= w - 1 || j >= h - 1) {
      // nearest-clamp inside, sea outside
      if (i < -1 || j < -1 || i > w - 1 || j > h - 1) return 0;
      const ci = Math.max(0, Math.min(w - 1, Math.round(u)));
      const cj = Math.max(0, Math.min(h - 1, Math.round(v)));
      return a[cj * w + ci];
    }
    const fu = u - i, fv = v - j;
    const p = j * w + i;
    return (a[p] * (1 - fu) + a[p + 1] * fu) * (1 - fv) +
           (a[p + w] * (1 - fu) + a[p + w + 1] * fu) * fv;
  };
  return {
    name: `grid ${path.basename(prefix)} (${w}x${h} @ ${cell} m, ${meta.crs || '?'})`,
    bounds: { x0, z0, x1: x0 + side, z1: z0 + side },
    terrainH, surface: null, SURFACE: null,
  };
}

// ---- zones ---------------------------------------------------------------
// Zones are DATA, not structure (WORLD-V2 §7): a list of
//   { shape:'circle', x, z, r, minDepth, why }
//   { shape:'rect',   x0, z0, x1, z1, minDepth, why }
// Adding one re-bakes its subtree and nothing else. Absent file = no zones,
// which is the honest default for a world that has no airfields yet.
function loadZones() {
  const p = flag('zones', path.join(__dirname, '..', 'src', 'core', 'zones.json'));
  if (!fs.existsSync(p)) return [];
  const z = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(z) ? z : (z.zones || []);
}
const zoneMinDepth = (zones, x0, z0, x1, z1) => {
  let d = 0;
  for (const q of zones) {
    let hit = false;
    if (q.shape === 'circle') {
      // nearest point of the node box to the centre
      const nx = Math.max(x0, Math.min(q.x, x1));
      const nz = Math.max(z0, Math.min(q.z, z1));
      hit = Math.hypot(nx - q.x, nz - q.z) <= q.r;
    } else {
      hit = !(q.x1 < x0 || q.x0 > x1 || q.z1 < z0 || q.z0 > z1);
    }
    if (hit && q.minDepth > d) d = q.minDepth;
  }
  return d;
};

// ===========================================================================
// THE TREE
// ===========================================================================
// A node is { d, ix, iz, kids|null, h:Float64Array|null }.
// Leaves carry their (P+1)² height grid; internal nodes carry theirs too,
// because the renderer needs ancestors for distance LOD (WORLD-V2 §3.1, the
// +33%) and because rebuilding them at load costs more than storing them.

function bake(src, zones) {
  const P = CFG.patch, N = P + 1;
  const { x0, z0, x1, z1 } = src.bounds;
  const W = x1 - x0, H = z1 - z0;
  if (Math.abs(W - H) > 1e-6)
    console.warn(`! domain is not square (${W} x ${H}); the quadtree squares it`);
  const SIDE = Math.max(W, H);

  const stats = { tested: 0, samples: 0, byDepth: new Map(), sea: 0, forest: 0 };

  // Sample a node's own (P+1)² grid.
  const gridOf = (d, ix, iz) => {
    const s = SIDE / (1 << d);                 // node side in metres
    const ox = x0 + ix * s, oz = z0 + iz * s;
    const step = s / P;
    const g = new Float64Array(N * N);
    for (let j = 0; j < N; j++) {
      const zz = oz + j * step;
      for (let i = 0; i < N; i++) g[j * N + i] = src.terrainH(ox + i * step, zz);
    }
    stats.samples += N * N;
    return g;
  };

  // THE ERROR METRIC. Sample the node at the resolution it WOULD have one
  // level down (2P+1 across), then ask how far the coarse grid's bilinear
  // interpolation misses those in-between points. That is exactly "does
  // subdividing buy anything", and it is the whole reason a flat bog stops
  // early while a gully keeps going.
  const errorOf = (d, ix, iz) => {
    const s = SIDE / (1 << d);
    const ox = x0 + ix * s, oz = z0 + iz * s;
    const M = 2 * P + 1, step = s / (2 * P);
    let worst = 0, hi = -Infinity, lo = Infinity;
    // fine row cache: we need the row above and the current row
    let prev = null;
    for (let j = 0; j < M; j++) {
      const zz = oz + j * step;
      const row = new Float64Array(M);
      for (let i = 0; i < M; i++) row[i] = src.terrainH(ox + i * step, zz);
      stats.samples += M;
      for (let i = 0; i < M; i++) {
        const v = row[i];
        if (v > hi) hi = v;
        if (v < lo) lo = v;
      }
      // odd columns on even rows: interpolate horizontally
      if ((j & 1) === 0) {
        for (let i = 1; i < M; i += 2) {
          const e = Math.abs(0.5 * (row[i - 1] + row[i + 1]) - row[i]);
          if (e > worst) worst = e;
        }
      } else if (prev) {
        // odd rows: every point is interpolated from the row above and below,
        // so we need the NEXT even row before we can judge. Defer by keeping
        // the odd row and testing it when the following even row arrives.
        prev.odd = row;
      }
      if ((j & 1) === 0) {
        if (prev && prev.odd) {
          const a = prev.even, b = row, o = prev.odd;
          for (let i = 0; i < M; i++) {
            const e = Math.abs(0.5 * (a[i] + b[i]) - o[i]);
            if (e > worst) worst = e;
          }
        }
        prev = { even: row, odd: null };
      }
    }
    return { err: worst, hi, lo };
  };

  const build = (d, ix, iz) => {
    stats.tested++;
    const s = SIDE / (1 << d);
    const nx0 = x0 + ix * s, nz0 = z0 + iz * s, nx1 = nx0 + s, nz1 = nz0 + s;

    const zMin = zoneMinDepth(zones, nx0, nz0, nx1, nz1);
    const { err, hi } = errorOf(d, ix, iz);

    // eps for THIS node: the base budget, relaxed under canopy.
    let eps = CFG.eps;
    let forested = false;
    if (src.surface && src.SURFACE) {
      // one probe at the centre is enough to bias a whole patch; the metric
      // above is what actually protects the geometry.
      const sc = src.surface(nx0 + s / 2, nz0 + s / 2);
      forested = (sc === src.SURFACE.FOREST_FLOOR);
      if (forested) { eps *= CFG.forestBias; stats.forest++; }
    }

    // SEA. A node entirely under water is not looked at from a cockpit and
    // nobody lands on it, so it stops at min depth. This is where the "half
    // the domain is constant sea" saving actually comes from — it is a rule,
    // not a property of the compressor.
    const allSea = hi < CFG.seaLevel;
    if (allSea) stats.sea++;

    const mustSplit = d < zMin || d < CFG.minDepth;
    const maySplit  = d < CFG.maxDepth && !allSea && err > eps;

    if (mustSplit || maySplit) {
      return { d, ix, iz, h: gridOf(d, ix, iz), kids: [
        build(d + 1, ix * 2,     iz * 2),
        build(d + 1, ix * 2 + 1, iz * 2),
        build(d + 1, ix * 2,     iz * 2 + 1),
        build(d + 1, ix * 2 + 1, iz * 2 + 1),
      ] };
    }
    stats.byDepth.set(d, (stats.byDepth.get(d) || 0) + 1);
    return { d, ix, iz, h: gridOf(d, ix, iz), kids: null };
  };

  const root = build(0, 0, 0);
  // THE BALANCER MAKES NODES IT DOES NOT SAMPLE. It splits a leaf to satisfy
  // 2:1 and hands the children `h: null`; the codec refuses those, correctly,
  // because a patch with no heights is a hole in the world. Filling them is
  // the baker's job and it has to happen AFTER balancing, so `gridOf` travels
  // out of here with the tree.
  return { root, stats, SIDE, gridOf };
}

// ===========================================================================
// 2:1 BALANCE (restricted quadtree). Neighbouring leaves may differ by at most
// one level; that single invariant is what bounds the crack problem to one
// case and lets the renderer use skirts (WORLD-V2 §2.2).
// ===========================================================================
function balance(root, src, SIDE) {
  const leaves = new Map();                    // "d:ix:iz" -> node
  const walk = n => { if (n.kids) n.kids.forEach(walk); else leaves.set(`${n.d}:${n.ix}:${n.iz}`, n); };
  walk(root);

  let added = 0, pass = 0;
  for (;;) {
    pass++;
    const todo = [];
    for (const n of leaves.values()) {
      // a neighbour two levels finer anywhere on an edge forces a split
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = n.ix + dx, nz = n.iz + dz;
        if (nx < 0 || nz < 0 || nx >= (1 << n.d) || nz >= (1 << n.d)) continue;
        // deepest leaf under that neighbour address
        let deepest = 0;
        for (const [k, m] of leaves) {
          if (m.d <= n.d + 1) continue;
          const sh = m.d - n.d;
          if ((m.ix >> sh) === nx && (m.iz >> sh) === nz) { deepest = Math.max(deepest, m.d); }
        }
        if (deepest > n.d + 1) { todo.push(n); break; }
      }
    }
    if (!todo.length) break;
    for (const n of todo) {
      if (n.kids) continue;
      leaves.delete(`${n.d}:${n.ix}:${n.iz}`);
      n.kids = [[0,0],[1,0],[0,1],[1,1]].map(([a,b]) => {
        const c = { d: n.d + 1, ix: n.ix * 2 + a, iz: n.iz * 2 + b, kids: null, h: null };
        leaves.set(`${c.d}:${c.ix}:${c.iz}`, c);
        return c;
      });
      added += 4;
    }
    if (pass > 24) { console.warn('! balance did not converge in 24 passes'); break; }
  }
  return { added, passes: pass };
}

// ===========================================================================
// REPORT — the point of version one.
// ===========================================================================
function report(res, bal) {
  const P = CFG.patch, N = P + 1, PATCH_BYTES = N * N * 2;
  let leaves = 0, nodes = 0;
  const byDepth = new Map();
  const walk = n => {
    nodes++;
    if (n.kids) n.kids.forEach(walk);
    else { leaves++; byDepth.set(n.d, (byDepth.get(n.d) || 0) + 1); }
  };
  walk(res.root);

  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  console.log('\n  depth   cell (m)      leaves');
  console.log('  ' + '-'.repeat(34));
  for (const d of depths) {
    const cell = res.SIDE / ((1 << d) * P);
    console.log(`  ${String(d).padStart(5)}   ${cell.toFixed(2).padStart(8)}   ${String(byDepth.get(d)).padStart(9)}`);
  }
  const mb = b => (b / 1048576).toFixed(1);
  console.log('  ' + '-'.repeat(34));
  console.log(`  leaves            ${leaves}`);
  console.log(`  nodes (with LOD)  ${nodes}   (+${((nodes/leaves - 1) * 100).toFixed(0)}%)`);
  console.log(`  raw               ${mb(nodes * PATCH_BYTES)} MB   @ ${PATCH_BYTES} B/patch`);
  console.log(`  compressed 2-4x   ${mb(nodes * PATCH_BYTES / 4)} - ${mb(nodes * PATCH_BYTES / 2)} MB`);
  console.log(`\n  sea nodes stopped early   ${res.stats.sea}`);
  console.log(`  forest-biased nodes       ${res.stats.forest}`);
  console.log(`  balance split             ${bal.added} (in ${bal.passes} passes)`);
  console.log(`  terrainH samples          ${(res.stats.samples / 1e6).toFixed(1)} M`);
  return { leaves, nodes, bytes: nodes * PATCH_BYTES };
}

// ===========================================================================
function main() {
  const t0 = Date.now();
  const src = loadSource();
  const zones = loadZones();
  console.log(`terrain_bake — source: ${src.name}`);
  console.log(`  bounds ${JSON.stringify(src.bounds)}`);
  console.log(`  patch ${CFG.patch}  depth ${CFG.minDepth}..${CFG.maxDepth}  ` +
              `eps ${CFG.eps} m  forest x${CFG.forestBias}  zones ${zones.length}`);

  const res = bake(src, zones);
  const bal = balance(res.root, src, res.SIDE);
  // fill the grids the balancer's new nodes do not have (see bake's note)
  let filled = 0;
  (function fill(n) {
    if (!n.h) { n.h = res.gridOf(n.d, n.ix, n.iz); filled++; }
    if (n.kids) n.kids.forEach(fill);
  })(res.root);
  if (filled) console.log(`  filled ${filled} balancer node(s)`);
  const sum = report(res, bal);
  console.log(`\n  baked in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  if (CFG.report || !CFG.out) {
    console.log('\n  (report only — pass --out bench/terrain/<name> to write the asset)');
    return;
  }

  // ---- serialise -------------------------------------------------------
  const codec = require('./terrain_codec.js');
  const meta = {
    bounds: src.bounds, side: res.SIDE, patch: CFG.patch,
    minDepth: CFG.minDepth, maxDepth: CFG.maxDepth, eps: CFG.eps,
    source: src.name,
  };

  // ROUND TRIP BEFORE WRITING. A format is not written until it has been read
  // back and compared — this is GATE TERRAIN's seed, and running it here means
  // a broken codec can never reach disk.
  process.stdout.write('  round-trip … ');
  const rt = codec.roundTrip(res.root, meta);
  console.log(`worst ${rt.worst.toExponential(2)} m vs step ` +
              `${rt.step.toExponential(2)} m — ${rt.ok ? 'OK' : 'FAIL'}`);
  if (!rt.ok) { console.error('  refusing to write a codec that does not round-trip'); process.exit(1); }

  const enc = rt.enc;
  writeGuard(CFG.out);
  const dir = path.dirname(CFG.out);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CFG.out + '.json', JSON.stringify(enc.header, null, 1));
  fs.writeFileSync(CFG.out + '.topo', enc.topology);
  fs.writeFileSync(CFG.out + '.bin',  enc.payload);

  const kb = b => (b / 1048576).toFixed(2);
  const total = enc.topology.length + enc.payload.length;
  console.log(`\n  MEASURED, not estimated:`);
  console.log(`    topology        ${kb(enc.topology.length)} MB  (${enc.header.nodes} nodes, 1 bit each)`);
  console.log(`    payload raw     ${kb(enc.rawPayloadBytes)} MB  (predicted + varint)`);
  console.log(`    payload gzip    ${kb(enc.payload.length)} MB`);
  console.log(`    ASSET TOTAL     ${kb(total)} MB`);
  console.log(`    vs int16 raw    ${kb(sum.bytes)} MB  ->  ` +
              `${(sum.bytes / total).toFixed(2)}x`);
  console.log(`\n  wrote ${CFG.out}.{json,topo,bin}`);
}

if (require.main === module) main();
module.exports = { bake, balance };
