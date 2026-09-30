#!/usr/bin/env node
// GATE METKIT - METLAKATLA ON THE KIT (C3c of QUEUE-C, G860-G864; src/viewer/kit_lot.js, render_premises.js KT,
// townkit.js's host). Headless: Jolene composed WITH the town, as the page composes it (tools/premises_cook.js's world:
// the island made with the record, W.premises.set), the generators and premises_build.js / kit_lot.js in the cook's vm;
// the committed kit (src/core/townkit_pack.json: the pack and the instance table in media/townkit/); the host on the
// vendored three r186 (GATE KITHOST's context).
//
//   A THE TABLE     every plot Metlakatla's zones sow is in the instance table with ITS seed (a kit plot); no plot of
//                   the village, no site item (the churches, the cannery, the school: the landmarks stay unique) is;
//                   one house row and at most one outbuilding row a plot.
//   B THE LOT       KIT_LOT.gen on every kit plot places the house EXACTLY where the kit's sowing placed it (x, y, z,
//                   yaw, L, w - tools/town_kit.js sow: the zone's water, the zone's rules, the pick) and the table's row
//                   stands there (the kit's nudge: 2 m at most, the same yaw); the PLAN of the lod-1 build is the lod-0
//                   build's (the stair, the stoop, the front, the jetty, the pier's modules and boats, the people, the
//                   yard, the lamps, the ground occluders: what finishPlot, the lot patch and the props read) on a sample.
//   C NO HOUSE      a kit lot keeps no house geometry: its bags are the pier's piles and the jetty (deck / post cut to
//                   the landing's box) alone; the plan build ran at lod 1 without the AO bake.
//   D THE TIDE      the zone's water (PREMISES_GEN.zoneWaterY, the sower's own rule; compose reads it through the same
//                   function): the harbour's is the sea (0); every water plot's house stands against it (P.water, its
//                   P.waterY the zone's) and gets its landing (the jetty) and, when its P asks for a pier, the pier.
//                   REPORTED: the unique path's tide on Jolene (world.waterH(0, 0): -Infinity) - left as it is for every
//                   place but Metlakatla.
//   E THE WORKER    a kit lot packs and unpacks (premises_build.js pack / unpack, the worker's wire) to the same arrays,
//                   stats and plan; the builder answers a 'kit' job (find by id + seed, gen) - KIT_LOT.extend.
//   F THE OUTBUILDINGS  planned in plot order (the table's order) every kit plot's outbuilding is the table's (the
//                   kind, 2 m, the yaw - render_premises ktOutMatch's rule); REPORTED the kinds.
//   G THE HOST      every kit plot's rows in one host; each kit house SOLID: its lod-1 triangles, stretched as drawn
//                   (hitMesh), rasterise to an obstacle whose top is the house's; setHidden takes a house out of every
//                   rung.
//   H THE WIRING    render_premises: the kit only with the town on (FLYDIY_TOWN.all, mk_ zones) and not ?townkit=0; the
//                   job kind 'kit'; the placement by kitOf; the town step, the prefetch and the stream wait for the
//                   kit's load; the lots' outbuilding decision; house_worker.js imports kit_lot.js and extends its
//                   builder; build.js: kit_lot.js lazy; the premises cook's lifted spans untouched by the kit.
//
// Usage: node tools/_metkit_check.js     (prints GATE METKIT: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');
const fail = []; let checks = 0;
const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1) + ' s';

global.performance = global.performance || require('perf_hooks').performance;
const PC = require('./premises_cook.js');
const TK = require('./town_kit.js');
const KIT = require(path.join(ROOT, 'src', 'viewer', 'townkit.js'));

// ---- the page's composition, with the town ---------------------------------------------------------------------
const H = PC.headless();
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'kit_lot.js'), 'utf8'), H.ctx, { filename: 'kit_lot.js' });
const { W, O, rec } = PC.composeVariant('jolene', { name: 'town', drop: [] });
const PG = H.PG, GENS = H.GENS, PB = GENS.PREMISES_BUILD, KL = GENS.KIT_LOT, HG = GENS.HOUSE_GEN;
console.log('  composed with the town (' + secs() + ')');

// ---- the committed kit -----------------------------------------------------------------------------------------
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'townkit_pack.json'), 'utf8'));
const it = (MAN.instances || []).find(i => i.id === 'jolene');
const gz = f => zlib.gunzipSync(fs.readFileSync(path.join(ROOT, f)));
const I = KIT.decodeInstances(gz(it.src));
const PK = KIT.decodePack(gz(MAN.pack.src));
const houseRow = new Map(), outRow = new Map();
let dupRows = 0;
I.rows.forEach((r, i) => { const M = r.out ? outRow : houseRow; if (M.has(r.plot)) dupRows++; M.set(r.plot, i); });

// ---- A the table -----------------------------------------------------------------------------------------------
const mk = O.records.plots.filter(p => /^mk_/.test(String(p.zone)));
const vill = O.records.plots.filter(p => !/^mk_/.test(String(p.zone)));
const kitPlot = p => { const i = houseRow.get(p.id); return i !== undefined && I.rows[i].seed === p.seed && /^mk_/.test(String(p.zone)) ? i : -1; };
const kp = mk.filter(p => kitPlot(p) >= 0);
check(mk.length > 300 && kp.length === mk.length, 'A every plot Metlakatla sows is a kit plot (in the table, its seed)', kp.length + ' of ' + mk.length);
check(I.rows.every(r => r.seed !== null && r.seed !== undefined), 'A every row carries its plot\'s seed');
check(vill.every(p => kitPlot(p) < 0), 'A no plot of the village is a kit plot (the village keeps its unique houses)', vill.filter(p => kitPlot(p) >= 0).length + ' of ' + vill.length);
check(O.records.items.length > 30 && O.records.items.every(x => !houseRow.has(x.id)), 'A no site item is in the table (the landmarks stay unique)', O.records.items.filter(x => /^mk_/.test(String(x.id))).length + ' Metlakatla items');
check(!dupRows, 'A one house row and at most one outbuilding row a plot', dupRows + ' duplicates');
console.log('  A ' + kp.length + ' kit plots of ' + mk.length + ' sown; the village ' + vill.length + ' plots, ' + O.records.items.length + ' site items unique (' + secs() + ')');

// ---- the builder, as the page makes it ---------------------------------------------------------------------------
const mkBuilder = () => KL.extend(PB.makeBuilder({ G: GENS, PG, O, rec, waterY: () => (W.waterH ? W.waterH(0, 0) : -1e9), size: () => 20000, game: true, lod1: true, outLod: 1,
  props: new Set(), pp: false, lotGround: false, world: W }));
const B = mkBuilder();

// ---- B the lot, C no house, D the tide, F the outbuildings -----------------------------------------------------
const S = TK.sow({ outbuildings: false });
const sown = new Map(S.houses.map(s => [s.plot.id, s]));
const zones = new Map(rec.layers.zones.map(z => [z.id, z]));
let placed = 0, rowFar = 0, keptBad = 0, jettyOut = 0, tris = 0, planTris = 0, water = 0, wetOk = 0, jetties = 0, piers = 0, pierWant = 0;
let outs = 0, outMatch = 0, outNone = 0; const outKinds = {};
const bad = [], LOTS = new Map();
const tG = Date.now();
for (const p of kp) {
  const R = KL.gen(B, p), h = R.house, s = sown.get(p.id), row = I.rows[kitPlot(p)];
  LOTS.set(p.id, R);
  if (s && Math.abs(h.x - s.house.x) < 1e-9 && Math.abs(h.z - s.house.z) < 1e-9 && Math.abs(h.y - s.house.y) < 1e-9 && Math.abs(h.yaw - s.house.yaw) < 1e-12 && h.P.L === s.P.L && h.P.w === s.P.w) placed++;
  else if (bad.length < 4) bad.push(p.id);
  const dyaw = Math.abs(((h.yaw - row.yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  if (!(Math.hypot(row.x - h.x, row.z - h.z) <= 2.01 && dyaw < 1e-3)) rowFar++;
  // C: the bags
  const jt = R.built.stats.jetty;
  for (const k of Object.keys(R.built.bags)) {
    const bag = R.built.bags[k]; if (!bag.tris) continue;
    if (k === 'pile') continue;
    if ((k === 'deck' || k === 'post') && jt) {
      const d = bag.data();
      for (let t = 0; t < d.idx.length; t += 3) {
        const c = [0, 1, 2].map(a => (d.pos[d.idx[t] * 3 + a] + d.pos[d.idx[t + 1] * 3 + a] + d.pos[d.idx[t + 2] * 3 + a]) / 3);
        if (!(Math.abs(c[0] - jt.x) <= jt.w / 2 + 0.2 && c[2] >= jt.z0 - 0.2 && c[2] <= jt.z1 + 0.2 && c[1] <= jt.y + 0.7)) { jettyOut++; break; }
      }
      continue;
    }
    keptBad++;
  }
  tris += R.built.stats.tris; planTris += R.built.stats.kitLot.planTris;
  // D: the tide
  if (p.side === 'water') {
    water++;
    const zw = PG.zoneWaterY(W, O.frame, zones.get(p.zone), -Infinity);
    if (h.P.water && Math.abs(h.P.waterY - (zw - h.y)) < 1e-9 && Math.abs(R.Tv.waterY - zw) < 1e-12) wetOk++;
    if (jt) jetties++;
    if (h.P.pier && jt) { pierWant++; if (R.built.stats.pier && R.built.stats.pier.modules.length) piers++; }
  }
  // F: the outbuilding
  const oi = outRow.get(p.id);
  if (oi !== undefined) {
    outs++;
    const orow = I.rows[oi], A = PK.header.archetypes[orow.arch], o = p.out;
    if (o) outKinds[o.kind] = (outKinds[o.kind] || 0) + 1;
    const dy = o ? Math.abs(((o.yaw - orow.yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) : 9;
    if (o && A.src && A.src.kind === o.kind && Math.hypot(o.x - orow.x, o.z - orow.z) < 2.1 && dy < 0.15) outMatch++;
  } else if (p.out) outNone++;
}
const genMs = Date.now() - tG;
check(placed === kp.length, 'B every kit lot places its house where the kit\'s sowing placed it', placed + ' of ' + kp.length + (bad.length ? ' (' + bad.join(', ') + ')' : ''));
check(!rowFar, 'B the table\'s row stands on its lot (the kit\'s nudge: 2 m at most, the same yaw)', rowFar + ' rows off');
check(!keptBad, 'C a kit lot keeps no house bag (the pier\'s piles and the jetty alone)', keptBad + ' lots');
check(!jettyOut, 'C every kept deck / post triangle is the jetty\'s (inside the landing\'s box)', jettyOut + ' lots');
check(tris < planTris * 0.02, 'C the kit lots keep < 2 % of the plan builds\' triangles', tris + ' of ' + planTris);
const kl = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'kit_lot.js'), 'utf8');
check(/HG\.build\(Object\.assign\(\{\}, house\.P, \{ ao: 0 \}\), 1, F\)/.test(kl), 'C the plan build is lod 1 with no AO bake');
console.log('  B/C ' + kp.length + ' lots generated in ' + (genMs / 1000).toFixed(1) + ' s (' + (genMs / kp.length).toFixed(1) + ' ms a lot, the dressing included); kept ' + tris + ' of the plans\' ' + planTris + ' triangles');
{
  // B: the lod-1 PLAN is the lod-0 build's - what the lot reads, on a sample (every water plot + every 12th)
  const pick = kp.filter((p, i) => p.side === 'water' || i % 12 === 0);
  const planOf = st => JSON.stringify({ stair: st.stair, stoop: st.stoop && { x: st.stoop.x, z: st.stoop.z, w: st.stoop.w, depth: st.stoop.depth, side: st.stoop.side },
    front: st.front && { x: st.front.x, z: st.front.z, y: st.front.y }, jetty: st.jetty, groundAO: st.groundAO,
    pier: st.pier && { modules: st.pier.modules, boats: st.pier.boats.map(b => ({ key: b.key, x: b.x, z: b.z, ry: b.ry, y: b.y })) },
    people: st.people, yard: st.yard, path: st.path });
  // (the LAMPS are not in it: the wall lamps and the porch lights are drawn at lod 0 alone - they are the house's walls'
  // and the kit house has its own walls; a kit lot has none, REPORTED)
  let same = 0, lamps = 0; const diff = [];
  for (const p of pick) {
    const h = LOTS.get(p.id).house, P = Object.assign({}, h.P); delete P.spread;
    const a = HG.build(Object.assign({}, P, { ao: 0 }), 1), b = HG.build(P, 0);
    if (planOf(a.stats) === planOf(b.stats)) same++; else if (diff.length < 3) diff.push(p.id);
    lamps += (b.stats.lit && b.stats.lit.lights.length) || 0;
  }
  console.log('  B REPORT: the sample\'s unique houses carry ' + lamps + ' wall lamps / porch lights (' + (lamps / pick.length).toFixed(1) + ' a house); a kit lot none (the kit house\'s windows glow by its lights byte)');
  check(same === pick.length, 'B the lod-1 plan build plans the lot as the lod-0 build does (stair, stoop, front, jetty, pier, people, yard, occluders, path)', same + ' of ' + pick.length + (diff.length ? ' (' + diff.join(', ') + ')' : ''));
}
const hz = rec.layers.zones.find(z => z.id === 'mk_z_harbour');
const hw = PG.zoneWaterY(W, O.frame, hz, -Infinity);
check(hz && hw === 0, 'D the harbour reads the sea (0)', String(hw));
check(water > 5 && wetOk === water, 'D every water plot\'s house stands against its zone\'s water', wetOk + ' of ' + water);
check(jetties >= water - 2 && piers === pierWant && pierWant >= jetties - 1, 'D the water plots get their landing (the jetty) where the stair comes down in the water, and the pier off it', 'jetties ' + jetties + ' of ' + water + ', piers ' + piers + ' of ' + pierWant);
const uniTide = W.waterH ? W.waterH(0, 0) : -1e9;
console.log('  D the harbour\'s water ' + hw + '; ' + water + ' water plots: ' + jetties + ' jetties (the other stairs land on the beach), ' + piers + ' piers | REPORT the unique path\'s tide (world.waterH(0, 0)): ' + uniTide + ' - kept for every place but Metlakatla');
check(outs > 20 && outMatch === outs, 'F planned in the table\'s order, every kit plot\'s outbuilding is the table\'s (kind, 2 m, yaw)', outMatch + ' of ' + outs);
check(!outNone, 'F no lot plans an outbuilding the table does not have', outNone + ' lots');
console.log('  F ' + outs + ' outbuildings in the table for Metlakatla: ' + JSON.stringify(outKinds) + ' (' + secs() + ')');

// ---- E the worker's wire ---------------------------------------------------------------------------------------
{
  const B2 = mkBuilder();
  const THREE = H.ctx.THREE;   // (the generators' own THREE: the bags are its meshes)
  // the first water plot with a jetty, and a land plot: through the worker's find / gen / pack, the page's unpack
  const wp = kp.find(p => p.side === 'water' && LOTS.get(p.id).built.stats.jetty) || kp[0], lp = kp.find(p => p.side !== 'water');
  let same = 0, n = 0;
  for (const p of [wp, lp]) {
    const j = { kind: 'kit', id: p.id, seed: p.seed };
    const x = B2.find(j);
    check(x === p, 'E the builder finds a \'kit\' job\'s plot by id and seed', p.id);
    check(B2.find({ kind: 'kit', id: p.id, seed: p.seed + 1 }) === null, 'E ...and refuses another seed (a stale composition builds on the page)');
    const R = B2.gen(j, x), R0 = LOTS.get(p.id);
    const pk = B2.pack(R, THREE, x), U = B2.unpack(pk.r, THREE, Object.assign({}, p));
    n++;
    let ok = U && U.kind === 'house' && JSON.stringify(PB.plain(U.house, PB.SKIP)) === JSON.stringify(PB.plain(R0.house, PB.SKIP));
    for (const k of Object.keys(R0.built.bags)) {
      const a = R0.built.bags[k].data(), b = U.built.bags[k] ? U.built.bags[k].data() : null;
      if (!R0.built.bags[k].tris) { if (b && b.idx.length) ok = false; continue; }
      if (!b || b.idx.length !== a.idx.length || Array.from(b.pos).some((v, i) => Math.abs(v - a.pos[i]) > 1e-5)) ok = false;
    }
    if (ok) same++;
  }
  check(same === n, 'E a kit lot crosses the worker\'s wire whole (the house, the kept bags)', same + ' of ' + n);
  check(B2.gen({ kind: 'house', id: lp.id, seed: lp.seed }, lp).built.bags.siding.tris > 0, 'E a \'house\' job is still the unique house (the extension answers \'kit\' alone)');
}

// ---- G the host: the town's rows, solid ----------------------------------------------------------------------------
{
  const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  global.MATLIB = require(path.join(ROOT, 'src', 'viewer', 'matlib.js'));
  const TARR = require(path.join(ROOT, 'src', 'viewer', 'house_tarr.js'));
  const Wc = { THREE, console, Math, JSON, Object, Array, Map, Set, WeakMap, Float32Array, Uint16Array, Uint32Array, Int32Array, Uint8Array,
               Number, String, Boolean, isFinite, Infinity, NaN, Error, Promise, setTimeout, performance };
  Wc.window = Wc; Wc.globalThis = Wc;
  vm.createContext(Wc);
  for (const f of ['_house_kit.js', '_house_gen.js']) vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), Wc, { filename: f });
  const HGr = Wc.HOUSE_GEN, T = TARR.make(THREE, { HG: HGr });
  // render_premises ktBuild's rows: every kit plot's house and outbuilding, in the world through the premises frame
  const rows = [];
  I.rows.forEach(r => { const p = O.records.plots.find(q => q.id === r.plot); if (!p || kitPlot(p) < 0) return; const w = O.frame.toWorld(r.x, r.z); rows.push(Object.assign({}, r, { x: w[0], z: w[1], yaw: r.yaw + (O.frame.yaw || 0) })); });
  const tH = Date.now();
  const HOST = KIT.host(THREE, { pack: PK, rows, tarr: T, HG: HGr, mode: 'batch' });
  const hostMs = Date.now() - tH;
  check(rows.length === kp.length + outs && HOST.rows.length === rows.length, 'G the host holds every kit plot\'s house and outbuilding', HOST.rows.length + ' = ' + kp.length + ' + ' + outs);
  const OB = require(path.join(TOOLS, 'flight_core.js')).OBSTACLES;
  let solid = 0, topOk = 0, cells = 0, hTris = 0;
  const tR = Date.now();
  rows.forEach((r, h) => {
    const m = HOST.hitMesh(h, 1); if (!m || !m.idx.length) return;
    hTris += m.idx.length / 3;
    const sh = OB.rasterise(m.pos, m.idx, 1.0); if (!sh) return;
    solid++;
    // the obstacle's top is the lod-1 mesh's top (above the record's ground: the ridge)
    let yMax = -1e9; for (let i = 1; i < m.pos.length; i += 3) if (m.pos[i] > yMax) yMax = m.pos[i];
    if (Math.abs(sh.top - yMax) < 1e-4 && yMax > 2) topOk++;
    cells += sh.cells;
  });
  const rMs = Date.now() - tR;
  check(solid === rows.length, 'G every kit house and outbuilding rasterises to an obstacle', solid + ' of ' + rows.length);
  check(topOk === solid, 'G ...whose top is its roof\'s', topOk + ' of ' + solid);
  HOST.setHidden(0, true); HOST.tick(new THREE.Vector3(rows[0].x, rows[0].y + 2, rows[0].z));
  check(HOST.rungOf(0)[0] === -1 && HOST.rungOf(0)[1] === -1 && HOST.rungOf(1)[0] >= 0, 'G a hidden house takes no rung (the others do)', JSON.stringify([HOST.rungOf(0), HOST.rungOf(1)]));
  console.log('  G the host: ' + HOST.rows.length + ' instances, ' + HOST.stats.geos + ' geometries, ' + HOST.stats.mb.toFixed(1) + ' MB, ' + HOST.lookCount() + ' looks, built in ' + hostMs + ' ms; the obstacles: ' + Math.round(hTris) + ' lod-1 triangles rasterised in ' + rMs + ' ms, ' + cells + ' cells of 1 m (' + secs() + ')');
  HOST.dispose();
}

// ---- H the wiring --------------------------------------------------------------------------------------------------
{
  const rp = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  const need = [
    [/window\.FLYDIY_TOWN && window\.FLYDIY_TOWN\.all && [^\n]*!\/\[\?&\]townkit=0\\b\/\.test\(location\.search \|\| ''\)/, 'the kit only with the town on, and not ?townkit=0'],
    [/some\(z => \/\^mk_\/\.test\(String\(z\.id\)\)\)\) KT\.want = true/, '...and only when the record has Metlakatla\'s zones'],
    [/kitOf\(p\) >= 0 \? 'kit' : 'house'/, 'the worker\'s job kind \'kit\''],
    [/kitOf\(p\) >= 0 \? buildKitLot\(p, R\) : buildHouse\(p, R\)/, 'a kit plot placed by buildKitLot'],
    [/j\.kind === 'house' \|\| j\.kind === 'kit' \? j\.p : null/, 'a kit lot\'s plan unpacked onto its plot'],
    [/const kw = ktWait\(\); if \(kw\) return \{ done: false/, 'the town step waits for the kit\'s load'],
    [/if \(ktWait\(\)\) \{ HWQ\.prefetch = /, 'the prefetch waits for the kit'],
    [/if \(ktWait\(\)\) return 0;/, 'the stream waits for the kit'],
    [/\/\^mk_\/\.test\(String\(p\.zone\)\) \? i : -1/, 'a kit plot is an mk_ zone\'s plot of the table, its seed'],
    [/p\.isItem \|\| p\.isPark \|\| p\.isObject \|\| p\.isFence \|\| p\.rec\) return -1/, 'no site item, park, object or fence is ever a kit plot'],
    [/const D = R\.dress && kitOut \? Object\.assign\(\{\}, R\.dress, \{ out: null \}\) : R\.dress;/, 'the kit\'s outbuilding or the lot\'s, never both'],
    [/KT\.host\.setHidden\(h, true\)/, 'the table\'s outbuilding hidden where the lot built its own'],
    [/ktHit\(grp, plot\)/, 'the kit house\'s obstacle with its lot'],
    [/if \(KT\.host\) KT\.host\.relook\(\)/, 'the stack\'s ready signal re-reads the kit town\'s looks'],
    [/kitTown: KT, kitTownStats: ktStats/, 'the census reads the kit town'],
  ];
  for (const [re, what] of need) check(re.test(rp), 'H render_premises: ' + what);
  // the premises cook lifts the page's placement code (its page hash): the kit's code is outside every span
  const lifted = PC.liftPage(rp);
  check(!/\bKT\b|kitOf|buildKitLot|KIT_LOT/.test(lifted), 'H the premises cook\'s lifted spans hold none of the kit\'s code (the cook\'s page hash is the base\'s)');
  const hw = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'house_worker.js'), 'utf8');
  check(/\['KIT_LOT', 'src\/viewer\/kit_lot\.js'\]/.test(hw) && /if \(G\.KIT_LOT\) G\.KIT_LOT\.extend\(st\.B\)/.test(hw) && /get world\(\) \{ return st\.world; \}/.test(hw), 'H house_worker.js imports kit_lot.js, extends its builder, gives it the world');
  const bj = fs.readFileSync(path.join(TOOLS, 'build.js'), 'utf8'), lz = bj.slice(bj.indexOf('  lazy: ['), bj.indexOf('  viewer: {'));
  check(lz.indexOf("['src/viewer', 'kit_lot.js']") > 0 && bj.slice(bj.indexOf('  world: ['), bj.indexOf('  lazy: [')).indexOf("'kit_lot.js']") < 0, 'H build.js: kit_lot.js on the lazy list');
}

console.log('  ' + checks + ' checks, ' + secs());
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE METKIT: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
