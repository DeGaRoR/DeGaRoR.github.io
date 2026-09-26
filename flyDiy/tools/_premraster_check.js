#!/usr/bin/env node
// GATE PREMRASTER (G614) - the premises' composed ground as a lattice, and the premises' surface and exclude
// queries on a cell index (27_premises.js). Jolene with its premises:
//   - THE HEIGHT RASTER (opt-in: makeWorld(..., { groundRaster: true })): every modifier is affine in the ground
//     under it, so the stack is A h + B; the lazily baked A / B lattice, read at the point with the exact DEM,
//     against the analytic path (the source) - on random points inside every modifier's box and a 0.25 m grid
//     over HOME's stand: p99 <= 2 mm, p99.9 <= 1 cm, the worst <= 6 cm (a concave pad corner's kinked feather);
//     a pad's interior reads its level (the stand, 1e-9); the solver's ceiling (world.groundMaxRect) still
//     bounds the raster's ground (rectangles round every aerodrome and the stand, sampled on a grid);
//   - THE INDEXES (on by default, exact): world.surface / PM.surfaceAt and PM.excludeAt answer as the linear
//     scans they replaced (surfaceAtScan / excludeAtScan), point for point, on 1.1 M points.
// It reports what the raster costs and saves (the reason it is opt-in: PHYSICS-PERF G614).
//   node tools/_premraster_check.js          -> "GATE PREMRASTER: PASS|FAIL"
'use strict';
const path = require('path'), fs = require('fs');
const C = require(path.join(__dirname, 'flight_core.js'));
for (const k of Object.keys(C)) global[k] = C[k];
const IN = require(path.join(__dirname, 'island_node.js'));
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const boot = IN.islandBoot('jolene');
if (!boot) { console.log('no Jolene in this checkout - skipped'); console.log('GATE PREMRASTER: PASS'); process.exit(0); }
const PREM = fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8');
const W = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: PREM, groundRaster: true });
const O = W.premises.overlay, base = W.premises.base, F = O.frame;
verdict(O.raster && O.raster.on, 'the raster is on when asked for (groundRaster)');
const W0 = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: PREM });
verdict(W0.premises.overlay.raster && !W0.premises.overlay.raster.on, 'and off by default (the analytic ground, the same bits)');
const exact = (x, z) => O.terrainH(x, z, base.terrainH(x, z));
let s = 20260926; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
// ---- 1. the raster against the analytic path
{
  const errs = []; let worst = null;
  const probe = (x, z, tag) => { const d = Math.abs(W.terrainH(x, z) - exact(x, z)); errs.push(d); if (!worst || d > worst.d) worst = { d, x, z, tag }; };
  const mods = new Set(); O.index.rect(-1e6, -1e6, 1e6, 1e6, M => mods.add(M));
  for (const M of mods) { const b = M.bbox; for (let k = 0; k < 300; k++) { const w = F.toWorld(b.x0 + rnd() * (b.x1 - b.x0), b.z0 + rnd() * (b.z1 - b.z0)); probe(w[0], w[1], M.kind + ' ' + M.id); } }
  const st = C.siteOf('HOME').stand;
  for (let x = st.x - 40; x <= st.x + 40; x += 0.25) for (let z = st.z - 40; z <= st.z + 40; z += 0.25) probe(x, z, 'the stand');
  errs.sort((a, b) => a - b); const q = f => errs[Math.floor(f * (errs.length - 1))];
  verdict(q(0.99) <= 0.002 && q(0.999) <= 0.01 && worst.d <= 0.06,
    `the raster against the analytic ground, ${errs.length} points: p50 ${(q(0.5) * 1000).toFixed(3)} mm, p99 ${(q(0.99) * 1000).toFixed(2)} mm, p99.9 ${(q(0.999) * 1000).toFixed(1)} mm, worst ${(worst.d * 1000).toFixed(1)} mm (${worst.tag})`);
  const lvl = W.terrainH(st.x, st.z), lvl0 = exact(st.x, st.z);
  let pad = 0; for (let k = 0; k < 400; k++) pad = Math.max(pad, Math.abs(W.terrainH(st.x + (rnd() - 0.5) * 6, st.z + (rnd() - 0.5) * 6) - lvl0));
  verdict(Math.abs(lvl - lvl0) < 1e-9 && pad < 1e-9, `the stand's pad reads its level (${lvl0.toFixed(3)} m): ${pad.toExponential(1)} m at 400 points round it`);
  const R = O.raster;
  console.log(`  the raster: ${R.baked} tiles baked (${Object.keys(R).filter(k => /^n\d+$/.test(k)).map(k => (16 / +k.slice(1)) + ' m ' + R[k]).join(', ')}), ${R.empty} tiles the ground itself, ${(R.bytes / 1e6).toFixed(1)} MB, ${R.evicted} evicted, ${(R.bakeMs / Math.max(1, R.baked)).toFixed(2)} ms a tile`);
}
// ---- 2. the ceiling still bounds the raster's ground
{
  const rects = [];
  for (const a of W.aerodromes) for (let k = 0; k < 8; k++) { const x = a.x + (rnd() - 0.5) * 500, z = a.z + (rnd() - 0.5) * 500, w = 8 + rnd() * 24; rects.push([x, z, x + w, z + w]); }
  const st = C.siteOf('HOME').stand; for (let k = 0; k < 20; k++) { const x = st.x - 20 + rnd() * 30, z = st.z - 20 + rnd() * 30; rects.push([x, z, x + 11, z + 7]); }
  let bad = 0, n = 0, worst = 0;
  for (const [x0, z0, x1, z1] of rects) {
    const H = W.groundMaxRect(x0, z0, x1, z1);
    for (let x = x0; x <= x1 + 1e-9; x += 0.5) for (let z = z0; z <= z1 + 1e-9; z += 0.5) { const h = W.terrainH(x, z); n++; if (h > H) { bad++; worst = Math.max(worst, h - H); } }
  }
  verdict(bad === 0 && n > 20000, `the ceiling bounds the raster's ground: ${rects.length} rectangles, ${n} points, ${bad} above it${bad ? ' (by ' + worst.toExponential(2) + ' m)' : ''}`);
}
// ---- 3. the indexes answer as the scans
{
  const O0 = W0.premises.overlay;
  let sBad = 0, eBad = 0, wBad = 0, n = 0;
  for (let x = -2500; x <= 2500; x += 5.3) for (let z = -1500; z <= 3500; z += 5.3) {
    n++;
    if (O0.surfaceAt(x, z) !== O0.surfaceAtScan(x, z)) sBad++;
    for (const w of ['trees', 'plots', undefined]) if (O0.excludeAt(x, z, w) !== O0.excludeAtScan(x, z, w)) eBad++;
  }
  const home = C.siteOf('HOME').stand;
  for (let x = home.x - 300; x <= home.x + 300; x += 0.9) for (let z = home.z - 300; z <= home.z + 300; z += 0.9) { n++; if (O0.surfaceAt(x, z) !== O0.surfaceAtScan(x, z)) wBad++; }
  verdict(sBad === 0 && wBad === 0 && eBad === 0 && n > 1e6, `the surface and exclude indexes answer as the scans on ${n} points (${sBad + wBad} surface, ${eBad} exclude differ)`);
  const tm = f => { const t0 = process.hrtime.bigint(); let a = 0; for (let x = home.x - 600; x <= home.x + 600; x += 4) for (let z = home.z - 600; z <= home.z + 600; z += 4) a += f(x, z) ? 1 : 0; return Number(process.hrtime.bigint() - t0) / 1e6; };
  console.log(`  surfaceAt ${tm(O0.surfaceAtScan).toFixed(0)} -> ${tm(O0.surfaceAt).toFixed(0)} ms, excludeAt ${tm((x, z) => O0.excludeAtScan(x, z, 'trees')).toFixed(0)} -> ${tm((x, z) => O0.excludeAt(x, z, 'trees')).toFixed(0)} ms (90 k points, 4 m round the stand)`);
}
console.log('GATE PREMRASTER: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
