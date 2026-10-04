#!/usr/bin/env node
// town_cook_node.js - TOWN-COOK (G1430-G1434): the node proof of the town variant cooked and fetched by variant.
//   node tools/perf/town_cook_node.js [--before <git rev>] [--out file.json] [--quick]
// --before: the commit whose manifest is "today" (default: origin/claude/metla-load-g1405, the base). Nothing is written
// but --out.
// 1. THE FETCHERS, their own code over this checkout's files (a fetch that reads the disk and counts): build.js's island
//    loader (the script cut from the BUILT index.html, run in a vm with the page's globals stubbed), sim_host.js
//    simHostFetchBoot, house_worker.js fetchCook (its source cut from the file). Per case (?town=0, ?town=1, no query and
//    no pref, a pv-7 'nearby' pref, a pv-6 'nearby' pref): the raster cells fetched, their bytes; against TODAY (the
//    before-manifest's every cell: the three fetchers took them all).
// 2. THE BAKES (the page's two compositions, as makeWorld and render_premises compose them): the first, at makeWorld,
//    WITHOUT the generators (index.html composes before the world pack's tags run), then the full one (the catalogue).
//    Readers: every modifier tile of the town variant on a 2 m grid (834 176 reads - METLA-LOAD's sweep: any reader
//    anywhere), and a scripted overflight (HOME's stand -> Metlakatla -> 3 km past it, every 50 m: the wheels' point and
//    a 4 x 4 km grid at 64 m round it). Lazy bakes counted on the overlay (raster.baked).
// 3. THE READ ERROR: the build read (terrainHBuild) against the wheels' terrainH on the same 834 176 points.
// 4. TOWN OFF BIT-IDENTICAL: the default variant's world on today's cells and on this cook's - every read equal.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib'), cp = require('child_process');
process.env.FLYDIY_GROUND_RASTER = '1';
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BEFORE = opt('before', 'origin/claude/metla-load-g1405'), OUT = opt('out', null), QUICK = argv.includes('--quick');
const PC = require(path.join(ROOT, 'tools', 'premises_cook.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const R = { before: BEFORE, fetch: {}, bakes: {}, error: {}, townOff: {} };
const log = s => console.log(s);
const MB = b => (b / 1e6).toFixed(2) + ' MB';   // (10^6 bytes, the cook's own unit)

// ---- the disk as the network ------------------------------------------------------------------------------------------
function diskFetch(rec) {
  return url => {
    const rel = String(url).replace(/^.*?\/flyDiy\//, '').replace(/^\.\//, '').replace(/\?.*$/, '');
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) return Promise.resolve(new Response(null, { status: 404 }));
    const buf = fs.readFileSync(f);
    if (rec) rec.push({ url: rel, bytes: buf.length });
    return Promise.resolve(new Response(buf, { status: 200 }));
  };
}
const rasterOf = list => list.filter(x => /\/premises\/r_/.test(x.url));
const sum = list => list.reduce((s, x) => s + x.bytes, 0);
const manifestNow = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'premises_packs.json'), 'utf8')).islands.find(w => w.id === 'jolene');
const manifestBefore = JSON.parse(cp.execSync('git show ' + BEFORE + ':flyDiy/src/core/premises_packs.json', { cwd: ROOT, maxBuffer: 1 << 26 }).toString()).islands.find(w => w.id === 'jolene');
// today's shipped bytes of a cell list (the files at BEFORE: content-addressed names, so a name on disk now is the same file)
const shipOf = cells => cells.reduce((s, c) => s + (fs.existsSync(path.join(ROOT, c.src)) ? fs.statSync(path.join(ROOT, c.src)).size : NaN), 0);

// ---- 1. the fetchers ----------------------------------------------------------------------------------------------------
async function loaderCase(search, pref) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
  const src = scripts.find(s => s.includes('FLYDIY_TOWN_VARIANT') && s.includes('premises_packs.json'));
  if (!src) throw new Error('the island loader is not in index.html (run node tools/build.js)');
  const rec = [], store = new Map(pref ? [['flydiy.gfx', JSON.stringify(pref)]] : []);
  const win = { FLYDIY_BOOT: Promise.resolve(), console: { log() {}, warn() {} } };
  const ctx = { window: win, location: { search }, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    fetch: diskFetch(rec), URLSearchParams, Response, Blob, DecompressionStream, TextDecoder, Uint8Array, Promise, JSON, Object, Error, console: win.console, setTimeout };
  ctx.self = win; vm.createContext(ctx);
  vm.runInContext('(function (window) {' + src.replace(/^<script>|<\/script>$/g, '') + '\n})', ctx)(new Proxy(win, { get: (t, k) => (k in t ? t[k] : ctx[k]), set: (t, k, v) => { t[k] = v; return true; } }));
  await win.FLYDIY_BOOT;
  const r = rasterOf(rec), pc = win.ISLAND_BOOT && win.ISLAND_BOOT.premCook;
  return { variant: win.FLYDIY_TOWN_VARIANT, cells: r.length, ship: sum(r), raw: pc && pc.raster ? pc.raster.reduce((s, c) => s + c.bytes.length, 0) : 0, urls: r.map(x => x.url).sort(), all: sum(rec) };
}
async function simHostCase(variant) {
  const rec = [];
  const boot = await SH.simHostFetchBoot('http://h/flyDiy/', 'jolene', { raster: true, variant, fetch: diskFetch(rec) });
  const r = rasterOf(rec);
  return { cells: r.length, ship: sum(r), raw: boot.premCook.raster.reduce((s, c) => s + c.bytes.length, 0), urls: r.map(x => x.url).sort() };
}
async function houseWorkerCase(variant) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'house_worker.js'), 'utf8');
  const i = src.indexOf('  function fetchCook('), j = src.indexOf('\n  }\n', i);
  const rec = [];
  const fetchCook = new Function('fetch', src.slice(i, j + 4) + '\nreturn fetchCook;')(diskFetch(rec));
  const pc = await fetchCook('http://h/flyDiy/', 'jolene', variant);
  const r = rasterOf(rec);
  return { cells: r.length, ship: sum(r), raw: pc.raster.reduce((s, c) => s + c.bytes.length, 0), urls: r.map(x => x.url).sort() };
}

// ---- 2-4. the worlds ------------------------------------------------------------------------------------------------------
const { C, IN, PG, GENS, CAT } = PC.headless();
const fixture = fs.readFileSync(PC.fixturePath('jolene'), 'utf8');
const recOf = V => { let r = PG.unwrap(fixture).rec; if (V.drop.length) r = PG.dropPlaces(r, V.drop).rec; return r; };
const cellsOf = (M, variant) => M.raster.cells.filter(c => !variant || !c.in || c.in.indexOf(variant) >= 0)
  .map(c => ({ ci: c.c[0], cj: c.c[1], sig: c.sig, bytes: new Uint8Array(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, c.src)))) }));
function worlds(V, cells) {
  const boot = IN.islandBoot('jolene', { noCook: true }); boot.premCook = { raster: cells };
  const W = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: PG.envelope(null, recOf(V)) });
  return W;
}
const full = W => W.premises.set(recOf(W.__V), { catalogue: CAT, globals: GENS, build: r => (GENS[r.gen] ? GENS[r.gen].build(r.P, 0) : null), pool: [] });
// every modifier tile of a cell list, on a 2 m grid (8 x 8 a 16 m tile), in the world - OFF the lattice's nodes (+0.37,
// +1.13 m: a tile's nodes sit on the odd metres of the frame, where the raster IS the composer to 1e-13 m)
function sweepPoints(O, cells) {
  const pts = [];
  for (const c of cells) {
    const idx = PG.rasterCellIndex(c.bytes);
    for (const k of idx.at.keys()) {
      const i = Math.round(k / 131072), j = k - i * 131072;
      for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) { const w = O.frame.toWorld(i * 16 + 0.37 + 2 * a, j * 16 + 1.13 + 2 * b); pts.push(w[0], w[1]); }
    }
  }
  return Float64Array.from(pts);
}
const bakedOf = W => W.premises.overlay.raster.baked | 0;
function readAll(W, pts) { const b0 = bakedOf(W), t0 = Date.now(); for (let n = 0; n < pts.length; n += 2) W.terrainH(pts[n], pts[n + 1]); return { bakes: bakedOf(W) - b0, ms: Date.now() - t0 }; }
function overflight(W, from, over) {
  const b0 = bakedOf(W), dx = over[0] - from[0], dz = over[1] - from[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, end = L + 3000;
  let reads = 0;
  for (let s = 0; s <= end; s += QUICK ? 200 : 50) {
    const x = from[0] + ux * s, z = from[1] + uz * s;
    W.terrainH(x, z); reads++;
    for (let a = -2000; a <= 2000; a += 64) for (let b = -2000; b <= 2000; b += 64) { W.terrainH(x + a, z + b); reads++; }
  }
  return { bakes: bakedOf(W) - b0, km: +(end / 1000).toFixed(1), reads };
}
function readError(W, pts) {
  const d = [];
  for (let n = 0; n < pts.length; n += 2) d.push(Math.abs(W.terrainHBuild(pts[n], pts[n + 1]) - W.terrainH(pts[n], pts[n + 1])));
  d.sort((a, b) => a - b);
  const q = p => +(d[Math.min(d.length - 1, Math.floor(p * d.length))] * 1000).toFixed(3);
  return { reads: d.length, p50mm: q(0.5), p99mm: q(0.99), p999mm: q(0.999), maxMm: +(d[d.length - 1] * 1000).toFixed(3), over10mm: d.filter(v => v > 0.01).length, nonzero: d.filter(v => v > 0).length };
}

(async () => {
  const t0 = Date.now();
  log('TOWN-COOK node proof - before = ' + BEFORE);
  // ---- 1
  log('\n1. THE FETCHERS (raster cells fetched; bytes shipped = on the wire, raw = gunzipped and kept on the boot object)');
  const today = { cells: manifestBefore.raster.cells.length, ship: shipOf(manifestBefore.raster.cells), raw: manifestBefore.raster.cells.reduce((s, c) => s + c.raw, 0), urls: manifestBefore.raster.cells.map(c => c.src).sort() };
  R.fetch.today = { cells: today.cells, ship: today.ship, raw: today.raw };
  log('   today (every cell, any variant, each of the three fetchers): ' + today.cells + ' cells, ' + MB(today.ship) + ' shipped, ' + MB(today.raw) + ' raw');
  const cases = [['?town=0', null, 'off'], ['?town=1', null, 'on'], ['', null, 'on'], ['', { pv: 7, town: 'nearby' }, 'off'], ['', { pv: 6, town: 'nearby' }, 'on'], ['', { pv: 7, town: 'all' }, 'on']];
  for (const [q, pref, want] of cases) {
    const L = await loaderCase(q, pref), name = 'loader ' + (q || 'no query') + (pref ? ' pref ' + JSON.stringify(pref) : '');
    const same = L.urls.join() === today.urls.join();
    R.fetch[name] = { variant: L.variant, cells: L.cells, ship: L.ship, raw: L.raw, sameAsToday: same };
    log('   ' + name.padEnd(42) + ' -> ' + L.variant.padEnd(7) + ' ' + String(L.cells).padStart(3) + ' cells, ' + MB(L.ship) + ' shipped, ' + MB(L.raw) + ' raw' + (same ? '  (= TODAY, file for file)' : '') + ((want === 'on') !== (L.variant === 'town') ? '  WRONG VARIANT' : ''));
  }
  for (const v of ['default', 'town', undefined]) {
    const S = await simHostCase(v), H = await houseWorkerCase(v);
    R.fetch['sim_host ' + v] = { cells: S.cells, ship: S.ship, raw: S.raw, sameAsToday: S.urls.join() === today.urls.join() };
    R.fetch['house_worker ' + v] = { cells: H.cells, ship: H.ship, raw: H.raw, sameAsToday: H.urls.join() === today.urls.join() };
    log('   sim_host     variant ' + String(v).padEnd(9) + ' -> ' + String(S.cells).padStart(3) + ' cells, ' + MB(S.ship) + ' shipped' + (S.urls.join() === today.urls.join() ? '  (= TODAY, file for file)' : ''));
    log('   house_worker variant ' + String(v).padEnd(9) + ' -> ' + String(H.cells).padStart(3) + ' cells, ' + MB(H.ship) + ' shipped' + (H.urls.join() === today.urls.join() ? '  (= TODAY, file for file)' : ''));
  }
  const per = manifestNow.raster.fetched || {};
  R.fetch.shipped = { all: manifestNow.raster.bytes, perVariant: per, before: manifestBefore.raster.bytes };
  log('   shipped in the repo: raster ' + manifestNow.raster.cells.length + ' cells, ' + MB(manifestNow.raster.bytes.ship) + ' (before ' + manifestBefore.raster.cells.length + ' cells, ' + MB(manifestBefore.raster.bytes.ship) + ')');

  // ---- 2 / 3: town on
  const VT = PC.VARIANTS.find(v => v.name === 'town'), VD = PC.VARIANTS.find(v => v.name === 'default');
  for (const [tag, M, variant] of [['before', manifestBefore, null], ['after', manifestNow, 'town']]) {
    log('\n2. TOWN ON, ' + tag + ' (' + (variant ? 'the town page\'s cells' : 'today\'s: every cell') + ')');
    const cells = cellsOf(M, variant);
    const W = worlds(VT, cells); W.__V = VT;
    const O1 = W.premises.overlay, r1 = O1.rasterCooked;
    const allTown = cellsOf(manifestNow, 'town');
    const pts = sweepPoints(O1, allTown);
    const firstBoot = bakedOf(W);
    const s1 = readAll(W, pts);
    log('   first composition (makeWorld, no generators): cells ' + JSON.stringify(r1) + ', bakes in makeWorld ' + firstBoot + ', the sweep (' + pts.length / 2 + ' reads) ' + s1.bakes + ' bakes');
    const O2 = full(W), r2 = O2.rasterCooked;
    const s2 = readAll(W, pts);
    const home = C.siteOf('HOME').stand;
    let cx = 0, cz = 0, nT = 0; for (const c of manifestNow.raster.cells) if (c.in.length === 1 && c.in[0] === 'town') { const w = O2.frame.toWorld((c.c[0] + 0.5) * 256, (c.c[1] + 0.5) * 256); cx += w[0]; cz += w[1]; nT++; }
    const fly = overflight(W, [home.x, home.z], [cx / nT, cz / nT]);
    const e = readError(W, pts);
    R.bakes['town on ' + tag] = { first: { cells: r1, makeWorld: firstBoot, sweep: s1.bakes }, full: { cells: r2, sweep: s2.bakes, sweepMs: s2.ms }, overflight: fly };
    R.error['town on ' + tag] = e;
    log('   full composition (the catalogue, render_premises\'): cells ' + JSON.stringify(r2) + ', the sweep ' + s2.bakes + ' bakes (' + s2.ms + ' ms)');
    R.metlakatla = { centre: [Math.round(cx / nT), Math.round(cz / nT)], home: [Math.round(home.x), Math.round(home.z)] };
    log('   Metlakatla\'s centre (the town\'s own cells\' centroid) ' + R.metlakatla.centre.join(',') + ' (metla_ab --over-at); HOME\'s stand ' + R.metlakatla.home.join(','));
    log('   overflight HOME -> Metlakatla (' + (Math.hypot(cx / nT - home.x, cz / nT - home.z) / 1000).toFixed(1) + ' km) -> 3 km past: ' + fly.km + ' km, ' + fly.reads + ' reads, ' + fly.bakes + ' bakes');
    log('   build read vs terrainH on the sweep: p50 ' + e.p50mm + ' / p99 ' + e.p99mm + ' / p99.9 ' + e.p999mm + ' / max ' + e.maxMm + ' mm; ' + e.over10mm + ' over 10 mm; ' + e.nonzero + ' reads differ at all');
  }

  // ---- 4: town off
  log('\n4. TOWN OFF: today\'s cells (every cell) against this cook\'s default cells - the default world, every read');
  {
    const Wa = worlds(VD, cellsOf(manifestBefore, null)), Wb = worlds(VD, cellsOf(manifestNow, 'default'));
    Wa.__V = VD; Wb.__V = VD;
    const pts = sweepPoints(Wa.premises.overlay, cellsOf(manifestNow, null));
    const cmp = () => { let diff = 0; for (let n = 0; n < pts.length; n += 2) { const a = Wa.terrainH(pts[n], pts[n + 1]), b = Wb.terrainH(pts[n], pts[n + 1]); if (!Object.is(a, b)) diff++; } return diff; };
    const d1 = cmp(); const k1 = [Wa.premises.overlay.rasterCooked, Wb.premises.overlay.rasterCooked], b1 = [bakedOf(Wa), bakedOf(Wb)];
    full(Wa); full(Wb);
    const d2 = cmp(); const k2 = [Wa.premises.overlay.rasterCooked, Wb.premises.overlay.rasterCooked], b2 = [bakedOf(Wa), bakedOf(Wb)];
    R.townOff = { reads: pts.length / 2, firstDiffer: d1, fullDiffer: d2, cells: { first: k1, full: k2 }, bakes: { first: b1, full: b2 } };
    log('   ' + pts.length / 2 + ' reads (every tile of both variants, 2 m): first composition ' + d1 + ' differ (cells ' + JSON.stringify(k1) + ', bakes today/now ' + b1.join('/') + '), full ' + d2 + ' differ (cells ' + JSON.stringify(k2) + ', bakes ' + b2.join('/') + ')');
  }
  log('\n' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
