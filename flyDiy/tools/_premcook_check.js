#!/usr/bin/env node
// GATE PREMCOOK (G835, the architecture queue's C2b) - the premises' DATA COOK (tools/premises_cook.js) against a
// fresh cook, the cooked raster against the lazily baked one it stands in for, and a stale cook detected.
//
//   1  THE MANIFEST: src/core/premises_packs.json names the island, both variants, every cell's file on disk.
//   2  FRESH: the cook re-run in memory (the fixture, the generators, the page's own placement code lifted out of
//      render_premises.js) gives the committed cook, byte for byte: every variant's record, its places' hash (the
//      placements, not triangles), every place cell and every raster cell (its signature and its bytes). A red
//      here is a STALE cook - the fixture, a generator, the composer or the page's placement code moved:
//      `node tools/premises_cook.js --island jolene`, then commit media/world/<id>/premises + the manifest.
//   3  THE RASTER, LOADED (makeWorld with the ground raster on and the island's cook, composed as the page does):
//      every cooked cell is taken, none stale; under them the ground is the lazy raster's to 0.05 mm and the
//      analytic's within GATE PREMRASTER's tolerances; nothing is baked there, only decoded; the stand's pad reads
//      its level exactly; the ceiling (groundMaxRect) still bounds the ground.
//   4  A STALE COOK IS DETECTED: a record edit under a cooked cell (a flatten's level +1 cm) is refused by that
//      cell's signature at load - the rest still load - and the refused cell reads the lazy bake of the edited
//      record, exactly; a fixture edit (the record's seed), a generator edit (HOUSE_GEN.randomHouse's length
//      +1 cm) and a page edit (buildHouse's seed) each change the places' hash.
//   5  THE FLAG: off by default (no option, no environment), and the page's loader fetches the raster cells only under
//      it (G841: the places' tallies whatever the flag).
//   6  THE COOK'S TALLIES (G841, C2c): each variant ships its entries' deltas in the record's order; the page generates an
//      entry on the tallies of its rank (premises_build.js makeTallies). PROVED HERE: the queue built BACKWARDS on the
//      committed tallies gives the committed placements, thing for thing - the order the page builds in no longer
//      matters; and the tallies at every rank are the forward cook's running sum.
//
//   node tools/_premcook_check.js   -> "GATE PREMCOOK: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const K = require('./premises_cook.js');
const IN = require('./island_node.js');
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; return !!c; };
console.log('GATE PREMCOOK');
const ID = 'jolene';
if (!IN.islandBoot(ID, { noCook: true })) { console.log('  no ' + ID + ' in this checkout - skipped'); console.log('GATE PREMCOOK: PASS'); process.exit(0); }
const PACK = IN.premisesPack(), ISL = (PACK.islands || []).find(w => w.id === ID);
const { C, PG, GENS, CAT } = K.headless();
const gunz = src => zlib.gunzipSync(fs.readFileSync(path.join(ROOT, ...src.split('/'))));

// ---- 1. the manifest ---------------------------------------------------------------------------------------------
console.log('1. the manifest');
if (!ok(!!ISL, 'src/core/premises_packs.json names ' + ID + ' (tools/premises_cook.js --island ' + ID + ')')) { console.log('GATE PREMCOOK: FAIL'); process.exit(1); }
ok(fs.existsSync(path.join(ROOT, ISL.fixture)), 'its fixture ' + ISL.fixture + ' is on disk');
ok(K.VARIANTS.every(V => ISL.variants.some(v => v.name === V.name)), 'both variants cooked (' + ISL.variants.map(v => v.name).join(', ') + ')');
const files = ISL.raster.cells.map(c => c.src).concat(...Object.values(ISL.places.variants).map(v => v.cells.map(c => c.src).concat(v.tallies ? [v.tallies.src] : [])));
ok(Object.values(ISL.places.variants).every(v => v.tallies && v.tallies.src && v.tallies.n > 0), 'G841: every variant ships its tallies (' + Object.entries(ISL.places.variants).map(([k, v]) => k + ' ' + (v.tallies ? v.tallies.n : 0)).join(', ') + ' entries)');
ok(files.every(f => fs.existsSync(path.join(ROOT, ...f.split('/')))), files.length + ' cell files named, all on disk');
const shipKB = (ISL.raster.bytes.ship + Object.values(ISL.places.variants).reduce((s, v) => s + v.bytes.ship, 0)) / 1024;
console.log('     raster ' + ISL.raster.cells.length + ' cells ' + (ISL.raster.bytes.ship / 1048576).toFixed(2) + ' MB; places ' + Object.entries(ISL.places.variants).map(([k, v]) => k + ' ' + v.cells.length + ' cells ' + (v.bytes.ship / 1024).toFixed(1) + ' KB').join(', ') + ' (total ' + shipKB.toFixed(0) + ' KB)');

// ---- 2. fresh ----------------------------------------------------------------------------------------------------
console.log('2. the cook is fresh');
const t0 = Date.now();
const F = K.cook(ID, { verify: false });
console.log('     re-cooked in memory in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
ok(F.page === ISL.places.page, 'the page\'s placement code (lifted from render_premises.js) is the one cooked (' + F.page + ' / ' + ISL.places.page + ')');
for (const v of F.variants) {
  const m = ISL.variants.find(x => x.name === v.name) || {};
  ok(v.record === m.record, v.name + ': the record is the one cooked (' + v.record + ' / ' + m.record + ')');
  ok(v.places && m.places && v.places.hash === m.places.hash && v.places.things === m.places.things && v.places.failed === 0,
    v.name + ': the placements hash as cooked - ' + (v.places ? v.places.things : '?') + ' things, ' + (v.places ? v.places.hash : '?') + ' / ' + (m.places ? m.places.hash : '?') + (v.places && v.places.failed ? ', ' + v.places.failed + ' FAILED to build' : ''));
  const S = F.places.find(p => p.name === v.name).P, MC = ISL.places.variants[v.name].cells;
  let bad = 0;
  for (const c of S.cells) { const mc = MC.find(x => (x.c === null ? c.i === null : x.c[0] === c.i && x.c[1] === c.j)); if (!mc || mc.sig !== c.sig || !gunz(mc.src).equals(c.buf)) bad++; }
  ok(bad === 0 && S.cells.length === MC.length, v.name + ': every place cell as cooked, byte for byte (' + S.cells.length + ' cells, ' + bad + ' differ)');
  const MT = ISL.places.variants[v.name].tallies;
  ok(!!MT && !!S.tallies && gunz(MT.src).equals(S.tallies.buf) && MT.hash === S.tallies.hash, v.name + ': the tallies as cooked, byte for byte (' + (S.tallies ? S.tallies.n : 0) + ' entries, ' + (MT ? MT.hash : '-') + ')');
}
{
  let bad = 0;
  const key = c => c.c[0] + ',' + c.c[1] + ',' + c.sig;
  const M = new Map(ISL.raster.cells.map(c => [key(c), c]));
  for (const c of F.raster) { const mc = M.get(c.ci + ',' + c.cj + ',' + c.sig); if (!mc || !gunz(mc.src).equals(c.buf)) bad++; }
  ok(bad === 0 && F.raster.length === ISL.raster.cells.length, 'every raster cell as cooked: its signature and its bytes (' + F.raster.length + ' cells, ' + bad + ' differ)');
}

// ---- 3. the raster, loaded ---------------------------------------------------------------------------------------
console.log('3. the raster, loaded');
const fixture = fs.readFileSync(K.fixturePath(ID), 'utf8');
const recOf = drop => { let r = PG.unwrap(fixture).rec; if (drop.length) r = PG.dropPlaces(r, drop).rec; return r; };
const build = r => (GENS[r.gen] ? GENS[r.gen].build(r.P, 0) : null);
// G995: made with THE VARIANT'S OWN RECORD, as the page's is (app.js makeWorld(0, { premises: premisesPlaced, island })):
// a world made with PG.DEF() has another base ground under 32 of the 92 cells, and a gate composing there passed a
// cook the page refused (its signatures) - the page baked those cells lazily
function cookWorld(rec) {
  const boot = IN.islandBoot(ID, { noCook: true });
  boot.premCook = IN.premCook(ID);
  return C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: PG.envelope(null, rec), catalogue: CAT });
}
const VD = K.VARIANTS[0], rec0 = recOf(VD.drop);
const WC = cookWorld(rec0);
let tq = Date.now(); const OC = WC.premises.set(rec0, { catalogue: CAT, globals: GENS, build, pool: [], raster: true }); const tCook = Date.now() - tq;
const WL = K.islandWorld(ID, VD);
tq = Date.now(); const OL = WL.premises.set(rec0, { catalogue: CAT, globals: GENS, build, pool: [], raster: true }); const tLazy = Date.now() - tq;
console.log('     compose + load: ' + tCook + ' ms with the cook, ' + tLazy + ' ms without (the difference: the cells\' signatures and indexes)');
const mine = ISL.raster.cells.filter(c => c.in.indexOf(VD.name) >= 0);
// (G1430: 'town' is cooked whole too, so a 256 m cell can carry one file per variant) rasterLoad takes the first cell of a
// square whose signature is the composition's and SKIPS the square's later ones: the refused are the other variants'
// cells listed before this variant's in their square, or in a square it does not have
const mineAt = new Map(); ISL.raster.cells.forEach((c, i) => { if (c.in.indexOf(VD.name) >= 0) mineAt.set(c.c[0] + ',' + c.c[1], i); });
const refusedWant = ISL.raster.cells.filter((c, i) => c.in.indexOf(VD.name) < 0 && !(mineAt.get(c.c[0] + ',' + c.c[1]) < i)).length;
ok(OC.rasterCooked && OC.rasterCooked.taken === mine.length && OC.rasterCooked.stale === refusedWant,
  VD.name + ': every cooked cell of the variant taken (' + (OC.rasterCooked ? OC.rasterCooked.taken + ' taken, ' + OC.rasterCooked.stale + ' refused' : 'no load') + '; ' + mine.length + ' cooked, ' + refusedWant + ' of the other variant\'s to refuse)');
let s = 20260927; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
const S = OC.rasterCell, Fr = OC.frame;
{
  let worstL = 0, n = 0; const errs = []; let worstA = null;
  for (const c of mine) for (let k = 0; k < 1200; k++) {
    const w = Fr.toWorld((c.c[0] + rnd()) * S, (c.c[1] + rnd()) * S);
    const hc = WC.terrainH(w[0], w[1]), hl = WL.terrainH(w[0], w[1]), ha = OL.terrainH(w[0], w[1], WL.premises.base.terrainH(w[0], w[1]));
    worstL = Math.max(worstL, Math.abs(hc - hl)); const d = Math.abs(hc - ha); errs.push(d); if (!worstA || d > worstA.d) worstA = { d, x: w[0], z: w[1] }; n++;
  }
  errs.sort((a, b) => a - b); const q = f => errs[Math.floor(f * (errs.length - 1))];
  ok(worstL <= 5e-5, 'under the cooked cells the ground is the lazy raster\'s: worst ' + (worstL * 1000).toFixed(4) + ' mm on ' + n + ' points');
  ok(q(0.99) <= 0.002 && q(0.999) <= 0.01 && worstA.d <= 0.06, '...and the analytic ground\'s within PREMRASTER\'s tolerances: p99 ' + (q(0.99) * 1000).toFixed(2) + ' mm, p99.9 ' + (q(0.999) * 1000).toFixed(1) + ' mm, worst ' + (worstA.d * 1000).toFixed(1) + ' mm');
  const R = OC.raster;
  ok(R.baked === 0 && R.decoded > 0, 'nothing baked under the cook, only decoded (' + R.decoded + ' tiles decoded in ' + R.decodeMs.toFixed(0) + ' ms, ' + (R.decodeMs / Math.max(1, R.decoded)).toFixed(3) + ' ms a tile; ' + R.baked + ' baked)');
  const RL = OL.raster;
  console.log('     the lazy raster on the same points: ' + RL.baked + ' tiles baked in ' + RL.bakeMs.toFixed(0) + ' ms (' + (RL.bakeMs / Math.max(1, RL.baked)).toFixed(3) + ' ms a tile)');
}
{
  const st = C.siteOf('HOME').stand, lvl = OL.terrainH(st.x, st.z, WL.premises.base.terrainH(st.x, st.z));
  let pad = 0; for (let k = 0; k < 400; k++) { const x = st.x + (rnd() - 0.5) * 6, z = st.z + (rnd() - 0.5) * 6; pad = Math.max(pad, Math.abs(WC.terrainH(x, z) - lvl)); }
  ok(pad < 1e-9, 'the stand\'s pad reads its level under the cook (' + lvl.toFixed(3) + ' m): ' + pad.toExponential(1) + ' m at 400 points');
  const rects = [];
  for (const a of WC.aerodromes) if (a.id === 'HOME' || a.id === 'w2') for (let k = 0; k < 12; k++) { const x = a.x + (rnd() - 0.5) * 600, z = a.z + (rnd() - 0.5) * 600, w = 8 + rnd() * 24; rects.push([x, z, x + w, z + w]); }
  for (let k = 0; k < 20; k++) { const x = st.x - 20 + rnd() * 30, z = st.z - 20 + rnd() * 30; rects.push([x, z, x + 11, z + 7]); }
  let bad = 0, n = 0;
  for (const [x0, z0, x1, z1] of rects) { const H = WC.groundMaxRect(x0, z0, x1, z1); for (let x = x0; x <= x1 + 1e-9; x += 0.5) for (let z = z0; z <= z1 + 1e-9; z += 0.5) { n++; if (WC.terrainH(x, z) > H) bad++; } }
  ok(bad === 0 && n > 10000, 'the ceiling bounds the cooked ground: ' + rects.length + ' rectangles, ' + n + ' points, ' + bad + ' above it');
}

// ---- 4. a stale cook is detected ---------------------------------------------------------------------------------
console.log('4. a stale cook is detected');
{
  // a flatten under a cooked cell: its level +1 cm
  const r1 = JSON.parse(JSON.stringify(rec0));
  const cellOfLocal = (x, z) => [Math.floor(x / S), Math.floor(z / S)];
  const cooked = new Set(mine.map(c => c.c.join(',')));
  const M = r1.layers.terrain.find(m => m.kind === 'flatten' && m.poly && cooked.has(cellOfLocal(m.poly[0][0], m.poly[0][1]).join(',')));
  if (ok(!!M, 'a flatten under a cooked cell (' + (M ? M.id : '-') + ')')) {
    M.level = (+M.level || 0) + 0.01;
    const W1 = cookWorld(rec0), O1 = W1.premises.set(r1, { catalogue: CAT, globals: GENS, build, pool: [], raster: true });
    const r = O1.rasterCooked || { taken: 0, stale: 0 };
    ok(r.taken > 0 && r.taken < mine.length && r.stale > ISL.raster.cells.length - mine.length, 'the edited cells are refused, the rest load (' + r.taken + ' taken, ' + r.stale + ' refused)');
    const boot = IN.islandBoot(ID, { noCook: true }), WLz = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: PG.envelope(null, rec0), catalogue: CAT });
    WLz.premises.set(r1, { catalogue: CAT, globals: GENS, build, pool: [], raster: true });
    const b = M.poly.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    let diff = 0, n = 0;
    for (let k = 0; k < 2000; k++) { const w = Fr.toWorld(b[0] + rnd() * (b[2] - b[0]), b[1] + rnd() * (b[3] - b[1])); if (W1.terrainH(w[0], w[1]) !== WLz.terrainH(w[0], w[1])) diff++; n++; }
    ok(diff === 0, 'the refused cells read the lazy bake of the edited record, exactly (' + n + ' points on the edited pad, ' + diff + ' differ)');
  }
}
{
  // (on the first 30 things the page queues - a hash of a part moves as the whole's does, in a tenth of the time)
  const V = [VD];
  const placesHash = opt => K.cook(ID, Object.assign({ variants: V, verify: false, noRaster: true, only: 30 }, opt)).variants[0].places.hash;
  const want = placesHash({});
  // a fixture edit: the record's seed
  const fx = JSON.parse(fixture); const fr = fx.premises || fx; fr.seed = (fr.seed | 0) + 1;
  ok(placesHash({ fixtureText: JSON.stringify(fx) }) !== want, 'a fixture edit (the record\'s seed) changes the places\' hash');
  // a generator edit: every sampled house 1 cm longer
  const HG = GENS.HOUSE_GEN, rh = HG.randomHouse;
  HG.randomHouse = function () { const P = rh.apply(this, arguments); P.L += 0.01; return P; };
  let h2; try { h2 = placesHash({}); } finally { HG.randomHouse = rh; }
  ok(h2 !== want, 'a generator edit (HOUSE_GEN.randomHouse, +1 cm) changes the places\' hash');
  // a page edit: buildHouse's seed (G830: the generation half's - src/viewer/premises_build.js genHouse)
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'premises_build.js'), 'utf8');
  const edited = src.replace('plot.seed % 100000, rnd, preset', 'plot.seed % 99991, rnd, preset');
  ok(edited !== src && placesHash({ buildSrc: edited }) !== want, 'a page edit (buildHouse\'s seed, premises_build.js genHouse) changes the places\' hash');
  ok(placesHash({}) === want, '...and the unedited cook gives it back, twice (' + want + ')');
}

// ---- 5. the flag -------------------------------------------------------------------------------------------------
console.log('5. the flag');
{
  if (process.env.FLYDIY_GROUND_RASTER === '1') console.log('     (FLYDIY_GROUND_RASTER=1 in this run: the default is not checked)');
  else {
    const W0 = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(IN.islandBoot(ID)), premises: PG.envelope(null, rec0) });
    ok(!W0.premises.overlay.raster.on && !W0.premises.overlay.rasterCooked, 'off by default: no option, no environment - the analytic ground (the same bits as before)');
  }
  const B = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  const i = B.indexOf('window.FLYDIY_GROUND_RASTER = rq !== \'0\''), k = B.indexOf("fetch('src/core/premises_packs.json')"), j = B.indexOf('if (window.FLYDIY_GROUND_RASTER && pi.raster)', k);
  ok(i > 0 && k > i && j > k, 'the page\'s island loader reads ?raster / flydiy.raster and fetches the raster cells only under the flag (ON unless 0 since 2026-09-27); the places\' tallies whatever it says (G841)');
}

// ---- 6. the cook's tallies: the order does not matter (G841) -------------------------------------------------------
console.log('6. the cook\'s tallies (G841)');
{
  const V = K.VARIANTS[0], MT = ISL.places.variants[V.name].tallies, list = MT ? JSON.parse(gunz(MT.src).toString('utf8')).list : null;
  if (ok(!!list, V.name + ': the tallies read back (' + (list ? list.length : 0) + ' entries)')) {
    const t1 = Date.now();
    const R = K.cook(ID, { variants: [V], verify: false, noRaster: true, tallies: list, reverse: true });
    const S = R.places[0].P, want = ISL.places.variants[V.name];
    let bad = 0; for (const c of S.cells) { const mc = want.cells.find(x => (x.c === null ? c.i === null : x.c[0] === c.i && x.c[1] === c.j)); if (!mc || !gunz(mc.src).equals(c.buf)) bad++; }
    ok(S.hash === want.hash && bad === 0 && S.cells.length === want.cells.length, V.name + ': the queue built BACKWARDS on the cooked tallies gives the cooked placements (' + S.things + ' things, hash ' + S.hash + ' / ' + want.hash + ', ' + bad + ' cells differ; ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s)');
    const PB = require(path.join(ROOT, 'src', 'viewer', 'premises_build.js')), T = PB.makeTallies(list);
    // the forward cook's own state before each entry - the deltas summed in order - against at(rank)
    let made = false; const used = {}, fenced = []; let badR = 0;
    const cu = u => Object.keys(u || {}).filter(k => u[k]).sort().map(k => k + '=' + u[k]).join(',');
    list.forEach((e, r) => {
      const st = T.at(r);
      if (st.made !== made || cu(used) !== cu(st.used) || st.fenced.join('|') !== fenced.join('|')) badR++;
      const d = e[2]; if (d) { if (d.made) made = true; if (d.used) for (const k of Object.keys(d.used)) used[k] = (used[k] || 0) + d.used[k]; if (d.fenced) fenced.push(...d.fenced); }
    });
    ok(badR === 0, V.name + ': makeTallies.at(rank) is the running sum at every rank (' + list.length + ' ranks, ' + badR + ' differ)');
  }
}
console.log('GATE PREMCOOK: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
