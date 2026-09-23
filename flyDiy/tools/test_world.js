// GATE WORLD — world contract v1: golden-hash freeze of the validated seed-0
// world, determinism across instances and seeds, v0-shim surface, tile
// contract, aerodrome invariants, perf budget. Pure data, no rendering.
// Any INTENTIONAL terrain change must re-capture the goldens below with the
// snippet in futureDesigns/WORLD-CONTRACT.md §4, in the same commit.
const { makeWorld } = require('./flight_core.js');

// goldens re-captured 2026-08-04 for W7 domain warp (IQ-style warp + 5th
// octave + warped continental masks — the FIRST session to change home
// h0: meadow hash and anchors 2-4 legitimately moved; the pad anchor
// stays exactly 0 and the DC-3 turnback was re-verified empirically,
// gate-green with unchanged margins). History: pre-hydro GRID 68852648
// TREES fe7ae7d8; stage-1 GRID cdccbc80; stage-2 TREES b097b0ed; stage-3
// GRID 4ade0091 (±4500 sampling); W6 GRID 9dded77 TREES f6287454 (24869),
// MEADOWS 27f288de through W6.
// (W9 stage-4 aerodromes: strip grading is a terrain change, trees
// re-laid with strip exclusion; meadow hash + anchors held)
// (W12 stage-5 cliffs: mountain terracing is a terrain change above
// hm=120; meadow hash + anchors held — the home lowlands are untouched)
// (G455, 2026-09-21: TREES re-captured for G422's APPROACH FANS — the
// pilot track's runway model clears 350 m past each strip's ends
// (25_airfield inBox, read by the tree placement). Bisected on the built
// cores: 24816 at the G422 build, 24711 from the G428 build on; the 105
// missing trees all lie 0–350 m past the ends of the eight strips, none
// elsewhere. Grid, meadows and anchors held: the ground did not move.
// History: TREES a6b54c58 (24816) through W12.)
const GOLDEN_GRID = '69dd5914';
const GOLDEN_TREES = '75835e6e';
const GOLDEN_TREE_COUNT = 24711;
const GOLDEN_MEADOWS = '85de271f';
const GOLDEN_ANCHORS = ['0', '0.21004043626020646', '29.022467498732595', '32.70294769782758'];

const fnv = s => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
};
const gridHash = (W, step) => {
  const n = Math.round(24000 / step), g = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g.push(W.terrainH(-12000 + step * i, -12000 + step * j));
  return fnv(g.join(','));
};
const treesHash = W => fnv(W.trees.map(t => t.x + ',' + t.z + ',' + t.h + ',' + t.s + ',' + t.sp).join(';'));
const meadowsHash = W => fnv(W.meadows.map(m => m.x + ',' + m.z + ',' + m.r + ',' + m.h).join(';'));

const W = makeWorld();
const checks = {};

// --- shim + contract surface ---
checks['shim members'] =
  typeof W.terrainH === 'function' && typeof W.treesNear === 'function' &&
  typeof W.wind === 'function' && typeof W.setWind === 'function' &&
  Array.isArray(W.trees) && Array.isArray(W.meadows) && W.meadows.length === 3 &&
  W.meadows.every(m => [m.x, m.z, m.r, m.h].every(Number.isFinite)) && W.CELL === 64;
checks['v1 members'] =
  W.v === 1 && W.seed === 0 &&
  W.bounds && W.bounds.x0 === -12000 && W.bounds.x1 === 12000 && W.bounds.z0 === -12000 && W.bounds.z1 === 12000 &&
  typeof W.waterH === 'function' && typeof W.surface === 'function' &&
  W.SURFACE && W.SURFACE.GRASS === 0 && W.SURFACE.WATER === 4 &&
  W.TILE === 512 && typeof W.tile === 'function' &&
  Array.isArray(W.aerodromes) && W.aerodromes.length >= 4 && Array.isArray(W.settlements);

// --- golden freeze (seed 0 === pre-contract world, full precision) ---
checks['golden grid hash'] = gridHash(W, 240) === GOLDEN_GRID;
checks['golden trees hash'] = treesHash(W) === GOLDEN_TREES && W.trees.length === GOLDEN_TREE_COUNT;
checks['golden meadows hash'] = meadowsHash(W) === GOLDEN_MEADOWS;
checks['golden anchors'] =
  String(W.terrainH(-320, 0)) === GOLDEN_ANCHORS[0] &&
  String(W.terrainH(-2500, -500)) === GOLDEN_ANCHORS[1] &&
  String(W.terrainH(1234.5, -987.25)) === GOLDEN_ANCHORS[2] &&
  String(W.meadows[0].h) === GOLDEN_ANCHORS[3];

// --- determinism ---
const W0b = makeWorld(0);
checks['default==seed0'] = gridHash(W0b, 240) === GOLDEN_GRID && treesHash(W0b) === GOLDEN_TREES;
const WA = makeWorld(12345), WB = makeWorld(12345);
checks['same-seed identical'] = gridHash(WA, 600) === gridHash(WB, 600) && treesHash(WA) === treesHash(WB);
{
  let same = true;
  for (let ix = -24; ix <= 23 && same; ix++) for (let iz = -24; iz <= 23 && same; iz++) {
    const a = WA.tile(ix, iz).trees, b = WB.tile(ix, iz).trees;
    if (a.length !== b.length) { same = false; break; }
    for (let k = 0; k < a.length; k++)
      if (a[k].x !== b[k].x || a[k].z !== b[k].z || a[k].h !== b[k].h || a[k].s !== b[k].s) { same = false; break; }
  }
  checks['tiles same-seed identical'] = same;
}
checks['seeds differ'] = gridHash(makeWorld(1), 600) !== gridHash(W, 600);

// --- tile contract (on the seed-0 world) ---
{
  const set = new Set(W.trees);
  let count = 0, identity = true, bounded = true;
  for (let ix = -24; ix <= 23; ix++) for (let iz = -24; iz <= 23; iz++) {
    const rec = W.tile(ix, iz);
    count += rec.trees.length;
    for (const t of rec.trees) {
      if (!set.has(t)) identity = false;
      if (Math.floor(t.x / W.TILE) !== ix || Math.floor(t.z / W.TILE) !== iz) bounded = false;
    }
    // rivers/roads/buildings bucketing is owned by GATE HYDRO / GATE SETTLE
  }
  checks['tile union==trees'] = count === W.trees.length && identity;
  checks['tile bounds'] = bounded;
  checks['tile cached'] = W.tile(3, -2) === W.tile(3, -2) && W.tile(40, 40) === W.tile(40, 40);
}

// --- aerodrome invariants ---
{
  const a = W.aerodromes[0];
  let flat = true, maxSlope = 0;
  let prev = null;
  for (let i = 0; i <= 22; i++) {
    const x = 20 - (1080 / 22) * i; // +20 .. -1060 along the centreline
    const h = W.terrainH(x, a.z);
    if (Math.abs(h) > 1e-9) flat = false;
    if (prev !== null) maxSlope = Math.max(maxSlope, Math.abs(h - prev) / (1080 / 22));
    prev = h;
  }
  checks['aero main flat'] = flat && maxSlope < 0.005 && a.elev === 0 &&
    Math.abs(W.terrainH(a.tdz[0], a.tdz[1]) - a.elev) < 1e-9;
  checks['aero main tree-free'] = !W.trees.some(t =>
    Math.abs(t.z - a.z) < a.wid / 2 + 30 && t.x > a.x - a.len / 2 - 30 && t.x < a.x + a.len / 2 + 30);
  const mds = W.aerodromes.filter(d => d.kind === 'meadow');
  checks['aero meadows elev'] = mds.every((d, i) =>
    Math.abs(W.terrainH(d.x, d.z) - d.elev) < 1e-9 && W.meadows[i].h === d.elev);
  checks['aero meadows tree-free'] = mds.every(d =>
    !W.trees.some(t => Math.hypot(t.x - d.x, t.z - d.z) < d.r * 0.8));
}

// --- waterH / surface consistency ---
checks['waterH sea/land'] = W.waterH(0, 4000) === 0 && W.terrainH(0, 4000) < 0 && W.waterH(-520, 0) === -Infinity;
{
  let ok = true, rocks = 0;
  for (let j = 0; j <= 100; j++) for (let i = 0; i <= 100; i++) {
    const x = -12000 + 240 * i, z = -12000 + 240 * j;
    const s = W.surface(x, z);
    if (!(s >= 0 && s <= 7)) ok = false;
    if ((s === W.SURFACE.WATER) !== (W.waterH(x, z) > W.terrainH(x, z))) ok = false;
    if (s === W.SURFACE.ROCK) rocks++; // classifier semantics live in GATE BIOME
  }
  checks['surface consistency'] = ok && rocks > 0 &&
    W.surface(-520, 0) === W.SURFACE.GRASS && W.surface(-450, 0) === W.aerodromes[0].surface;
}

// --- treesNear index contract ---
{
  const T = W.trees[100], out = [];
  const r1 = W.treesNear(T.x, T.z, out);
  const hit = r1 === out && out.includes(100) && out.every(i => Number.isInteger(i) && i >= 0 && i < W.trees.length);
  const snap = out.slice();
  const r2 = W.treesNear(T.x, T.z, out);
  checks['treesNear contract'] = hit && r2 === out && out.length === snap.length && out.every((v, i) => v === snap[i]);
}

// --- wind zero fast path ---
{
  const w1 = W.wind(0, 0, 0, 0), w2 = W.wind(5, 5, 5, 1);
  checks['wind zero-path'] = w1 === w2 && w1[0] === 0 && w1[1] === 0 && w1[2] === 0;
}

// --- perf budget: 1e6 terrainH calls at scattered coords ---
{
  let s = 1, sum = 0;
  const t0 = Date.now();
  for (let i = 0; i < 1e6; i++) {
    s = (s * 1664525 + 1013904223) >>> 0; const x = (s / 4294967296 - 0.5) * 24000;
    s = (s * 1664525 + 1013904223) >>> 0; const z = (s / 4294967296 - 0.5) * 24000;
    sum += W.terrainH(x, z);
  }
  const ms = Date.now() - t0;
  console.log(`perf: 1e6 terrainH calls in ${ms} ms (${(ms / 1000).toFixed(2)} us/call), checksum ${sum.toFixed(3)}`);
  checks['perf terrainH<2.5us'] = ms < 2500;
}

// --- THE ISLAND'S OWN PREMISES (G434): Jolene's record composes on the data world and its field holds -
// HOME with its club hangar and its stand, the sea lane, the hill strip; every stand's pattern sound; no
// record issue.
// MANDATORY SINCE 2026-09-23. These checks used to be skipped with a line when the files were absent,
// because the island lived under the gitignored bench/ and only the machine that baked it had them - so
// in every worktree, every clone and every cloud session this gate printed "skipped" and passed GREEN
// with eight checks dead. That silence is how the default map came to be missing from git for nine days
// without a single red. The world ships now (media/world/<id>, src/core/world_packs.json), every checkout
// has it, and its absence is a defect like any other.
{
  let IN = null; try { IN = require('./island_node.js'); } catch (e) {}
  const fs = require('fs'), path = require('path'), zlib = require('zlib');
  const fx = path.join(__dirname, 'fixtures', 'island_jolene.json');
  let boot = null, bootErr = '';
  try { boot = IN && IN.islandBoot('jolene'); } catch (e) { bootErr = ' (' + e.message + ')'; }
  checks['island: the shipped world loads' + bootErr] = !!boot;
  checks['island: the premises fixture is on disk'] = fs.existsSync(fx);
  if (boot && fs.existsSync(fx)) {
    const C = require('./flight_core.js');
    const WI = IN.islandWorld('jolene', { premises: fs.readFileSync(fx, 'utf8') });
    const O = WI.premises.overlay, ids = WI.aerodromes.map(a => a.id);
    checks['island: HOME, SEA and the hill strip registered'] = ids.includes('HOME') && ids.includes('SEA') && ids.includes('w3') && !WI.aerodromes.some(a => a.id === 'HOME' && !a.premises);
    checks['island: the sea lane is water, on the water'] = (() => { const s = WI.aerodromes.find(a => a.id === 'SEA'); if (!s || s.kind !== 'water') return false; const d = [Math.cos(s.hdg), Math.sin(s.hdg)]; for (let t = 0; t <= s.len; t += 50) for (const c of [-80, 0, 80]) { const x = s.spawn[0] + d[0] * t - d[1] * c, z = s.spawn[1] + d[1] * t + d[0] * c; if (WI.terrainH(x, z) > WI.waterH(x, z) - 1) return false; } return true; })();
    // (the buildings' generators are the bench's, not the core's: their keys are GATE PREMISES's business)
    checks['island: no record issue composed'] = O.records.issues.filter(i => !/no catalogue entry/.test(i)).length === 0;
    const st = C.siteOf('HOME');
    checks['island: HOME has its stand, its way out and the club hangar on the composed ground'] = !!(st && st.stand && st.taxiOut && st.hangar && Math.abs(st.hangar.y - WI.terrainH(st.hangar.x, st.hangar.z)) < 0.05 && Math.abs(st.stand.elev - WI.terrainH(st.stand.x, st.stand.z)) < 0.05);
    for (const id of ['HOME', 'w3']) {
      const a = WI.aerodromes.find(q => q.id === id), s = C.siteOf(id);
      let iss = ['no site']; try { iss = s ? C.sitePatternIssues(C.sitePattern(a, s), a, s, 6, C.patternPath) : ['no site']; } catch (e) { iss = [e.message]; }
      checks['island: ' + id + ' pattern sound' + (iss.length ? ' (' + iss[0] + ')' : '')] = iss.length === 0;
    }
    checks['island: the village sowed its plots (harbour and residential)'] = O.records.plots.some(p => p.zone === 'z_harbour') && O.records.plots.filter(p => p.zone === 'z_village').length >= 10;
    const M = C.siteRunwayModel(WI.aerodromes.find(q => q.id === 'HOME'), WI);
    checks['island: 13/31 approaches under 4 % both ways (the fans clear)'] = M.dir.every(d => d.reqGs < 0.04);
  }

  // --- THE SHIPPED ASSET ITSELF (2026-09-23). GATE MEDIA already holds
  // manifest == media in both directions; these are the three things it cannot
  // see, because to it a stale page and a fresh one look the same.
  const pack = IN ? IN.worldPack() : { islands: [] };
  const isl = (pack.islands || []).find(w => w.id === 'jolene');
  checks['island: the manifest names jolene'] = !!isl;
  if (isl) {
    const srcs = Object.values(isl.files).filter(r => r.src);
    // every payload is one gzip stream and decompresses to the length the bake
    // recorded - a truncated or text-mangled binary is caught here, not as an
    // opaque DecompressionStream failure at boot
    checks['island: every payload gunzips to its declared size'] = srcs.every(r => {
      try { return zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', ...r.src.split('/')))).length === r.raw; } catch (e) { return false; }
    });
    // THE ONE THAT EARNS ITS KEEP: baked the world, forgot to rebuild. The
    // manifest and media/ agree perfectly in that state, so GATE MEDIA is
    // green - but sw.js's WORLD_KEEP is baked into the build, and a stale one
    // lists the PREVIOUS bake's hashes, so the worker would evict each new
    // payload from the cache moments after the page fetched it. (The page
    // itself reads the manifest at runtime and so cannot go stale this way;
    // this check followed the staleness when the manifest stopped being
    // inlined, rather than being dropped with its old premise.)
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    const keep = JSON.parse((sw.match(/const WORLD_KEEP = (\[[^\n]*\]);/) || [0, '[]'])[1]);
    checks['island: sw.js WORLD_KEEP was built against this manifest'] =
      srcs.length > 0 && srcs.every(r => keep.includes(r.src)) && keep.every(s => typeof s === 'string');
    // the CC-BY holders travel with the asset: a source that loses its line in
    // CREDITS.md goes red rather than quietly shipping unattributed
    const cred = fs.readFileSync(path.join(__dirname, '..', 'CREDITS.md'), 'utf8');
    checks['island: every data source is credited in CREDITS.md'] = (isl.sources || []).length > 0 && (isl.sources || []).every(s => cred.indexOf(s) >= 0);
  }
}

const failed = Object.keys(checks).filter(k => !checks[k]);
console.log(`world: seed ${W.seed} | ${W.trees.length} trees | ${W.aerodromes.length} aerodromes | ${Object.keys(checks).length} checks, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL: ${f}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE WORLD: PASS' : 'GATE WORLD: FAIL');
process.exitCode = pass ? 0 : 1;
