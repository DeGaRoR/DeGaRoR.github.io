#!/usr/bin/env node
// GATE CITYHOST - THE TOWN HOST'S RUNTIME (G3415-G3421, CITY-B; futureDesigns/CITY-2.0-PLAN-2026-10-20.md, METLA-2.0-HANDOVER.md
// §0 / §4). The requirement, measured: an idle far town costs ~0 ms of CPU a frame and allocates nothing; no per-house Object3D
// far away; per-frame town JS is O(near ring), never O(town). Headless: the vendored three r186, the real house generator,
// house_tarr.js and MATLIB, the committed town kit (media/townkit/: 33 archetypes, Jolene's 522 records - Metlakatla's
// houses and outbuildings) and a city pack cooked from them by tools/_cityhost_fixture.js (CITY-B's reading of the draft
// format; CITY-A owns the format and the cook).
//
//   A THE RING      src/viewer/town_ring.js on 3 000 items over a random flight with jumps: every item within its reach of
//                   the eye is in the ring (the walks see all they must), nothing in it is past reach + 2 x move, an item
//                   leaves exactly once (onLeave) as it goes, add / move / remove / sweep keep the lists true.
//   B THE KIT RING  townkit.js host (today's Metlakatla on the kit, render_premises KT): the ring's tick against the full walk
//                   of before, house by house, frame by frame, along an approach from 7 km, through the town, a climb and
//                   out, with the band and with the hard switch - the same rungs; from 4 km and more no house is visited.
//   C THE CENSUS    TOWNKIT.town on the city pack: every Object3D it puts in the scene <= cells + archetypes + prop keys + a
//                   small constant (NOT a plot's); the far cells static (matrixAutoUpdate off, matrixWorldAutoUpdate off once
//                   frozen), one draw per material a cell holds, no far shadow.
//   D THE VISITS    a far-only frame (the eye 4-6.4 km out, idle and flying the circuit): 0 cells, 0 houses, 0 props visited.
//   E ALLOCATION    (a child with a 128 MB young generation, a clock that cannot box - GATE FLIGHTREC's method) bytes a tick
//                   over 20 000 ticks: the town host idle far, the town host idle near (in the town), the kit host's ring
//                   idle far, the ring's update idle: < 4 each.
//   F THE SWITCH    the eye flown through the town and out: each cell near / far as its box distance says (in at NEAR, out
//                   at NEAR x (1 + hyst)); a far cell's mesh drawn, its houses on no rung; a near cell's mesh hidden, its
//                   houses on the rungs the full walk gives; the near props and lots exactly the near cells'.
//   G THE METER     flight_recorder.js: town(ms, items, KB) sums into the frame's 'town' / 'townN' / 'townKB' columns (KB NaN
//                   without the probe); the wiring - render_world times the town's calls into it, render_premises' parts
//                   and items (TM, townMeter), rollout_perf's TOWN line and --town-alloc.
//   H THE WIRING    render_premises: the detail walk, the far town's cells, the lots' cells, the settle walk and the traffic
//                   on the ring (?townring=0 the old walks), the far town's scan by generation; the kit host's ring
//                   (?kitring=0); scenery_life's cells on a ring; build.js ships town_ring.js before render_premises; the
//                   procedural path untouched (the village, the editor's premises, the piers: no ring check gates them).
//
// Usage: node tools/_cityhost_check.js     (prints GATE CITYHOST: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const v8 = require('v8');

const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');
global.performance = global.performance || require('perf_hooks').performance;
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
global.MATLIB = require(path.join(ROOT, 'src', 'viewer', 'matlib.js'));
const TARR = require(path.join(ROOT, 'src', 'viewer', 'house_tarr.js'));
const RING = require(path.join(ROOT, 'src', 'viewer', 'town_ring.js'));
const KIT = require(path.join(ROOT, 'src', 'viewer', 'townkit.js'));
const FX = require('./_cityhost_fixture.js');

// ---- the world: the house generator (GATE KITHOST's context), the committed kit, the cities ------------------------------
// THE CITIES: the fixture (tools/_cityhost_fixture.js, always) and the real pack (CITY-A's cook: src/core/city_packs.json and
// its media) when it is in the tree
function world() {
  const W = { THREE, console, Math, JSON, Object, Array, Map, Set, WeakMap, Float32Array, Uint16Array, Uint32Array, Int32Array, Uint8Array,
              Number, String, Boolean, isFinite, Infinity, NaN, Error, Promise, setTimeout, performance };
  W.window = W; W.globalThis = W;
  vm.createContext(W);
  for (const f of ['_house_kit.js', '_house_gen.js']) vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), W, { filename: f });
  const HG = W.HOUSE_GEN;
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'townkit_pack.json'), 'utf8'));
  const it = (man.instances || []).find(i => i.id === 'jolene') || man.instances[0];
  const pack = new Uint8Array(FX.gunzip(fs.readFileSync(path.join(ROOT, man.pack.src))));
  const inst = new Uint8Array(FX.gunzip(fs.readFileSync(path.join(ROOT, it.src))));
  const P = KIT.decodePack(pack), I = KIT.decodeInstances(inst);
  const T = TARR.make(THREE, { HG });
  const propGeo = () => [{ geometry: new THREE.BoxGeometry(1, 1, 1), material: new THREE.MeshBasicMaterial() }];
  const lotMats = [new THREE.MeshStandardMaterial({ color: 0x5a4632 }), new THREE.MeshStandardMaterial({ color: 0x7a6248 })];
  const lotGround = () => new THREE.MeshStandardMaterial({ color: 0x8a7a5a, transparent: true, depthWrite: false });
  const farMats = { shell: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }) };
  const boxOf = city => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const c of city.cells) { x0 = Math.min(x0, c.box[0]); z0 = Math.min(z0, c.box[1]); x1 = Math.max(x1, c.box[2]); z1 = Math.max(z1, c.box[3]); } return [x0, z0, x1, z1]; };
  const cities = [];
  const FXC = FX.cookCity({ KIT, pack, inst });
  const u8b = r => new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
  { const city = KIT.cityOf(FXC.town, FXC.raws.map(r => KIT.decodeCityCell(u8b(r))), KIT.decodeLotKit(u8b(FXC.lotKit)));
    cities.push({ name: 'the fixture', city, box: boxOf(city), bytes: FXC.raws.reduce((a, r) => a + r.length, 0) }); }
  const CP = path.join(ROOT, 'src', 'core', 'city_packs.json');
  if (fs.existsSync(CP)) {
    const M = JSON.parse(fs.readFileSync(CP, 'utf8'));
    for (const town of M.towns || []) {
      const raws = town.cells.map(c => FX.gunzip(fs.readFileSync(path.join(ROOT, c.src))));
      const LKr = town.lotKit && town.lotKit.src ? KIT.decodeLotKit(u8b(FX.gunzip(fs.readFileSync(path.join(ROOT, town.lotKit.src))))) : null;
      const city = KIT.cityOf(town, raws.map(r => KIT.decodeCityCell(u8b(r))), LKr);
      cities.push({ name: 'the pack ' + town.id + ' v' + M.v, city, box: boxOf(city), bytes: raws.reduce((a, r) => a + r.length, 0), real: true, kitPack: town.inputs && town.inputs.kitPack, packSha: man.pack.sha256, v: M.v });
    }
  }
  return { HG, P, I, T, propGeo, farMats, lotMats, lotGround, cities };
}

// ==================================================================================================================
// THE CHILD: the allocation count (node's young generation, no scavenge inside a measured window)
// ==================================================================================================================
if (process.argv.includes('--alloc')) {
  const Wd = world();
  let CI = 1000;
  const now = () => (CI += 13);   // (an integer clock: V8 never boxes a small integer - GATE FLIGHTREC's reason)
  const newUsed = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
  // (warmed 300 000 calls - GATE FLIGHTREC's - and the least of 5 windows: a function still in the interpreter, or optimised
  // in the background mid-window, boxes what its optimised code would not)
  const measure = fn => { for (let i = 0; i < 300000; i++) fn(); const M = 20000, per = []; for (let rep = 0; rep < 5; rep++) { global.gc(); const a = newUsed(); for (let i = 0; i < M; i++) fn(); per.push((newUsed() - a) / M); } return Math.min(...per); };
  const out = { cities: [] };
  for (const C of Wd.cities) {
    const TW = KIT.town(THREE, { pack: Wd.P, city: C.city, tarr: Wd.T, HG: Wd.HG, propGeo: Wd.propGeo, farMats: Wd.farMats, lotMats: Wd.lotMats, lotGround: Wd.lotGround, now });
    const [x0, z0, x1, z1] = C.box, cz = (z0 + z1) / 2;
    const big = C.city.cells.reduce((a, c) => (c.rows[1] > a.rows[1] ? c : a));   // near: the middle of the fullest cell
    const far = new THREE.Vector3(x1 + 6400, 120, cz), nearE = new THREE.Vector3((big.box[0] + big.box[2]) / 2, 60, (big.box[1] + big.box[3]) / 2);
    const r = { name: C.name };
    TW.tick(far); r.townFar = measure(() => TW.tick(far));
    TW.tick(nearE); TW.tick(nearE); r.townNear = measure(() => TW.tick(nearE));
    r.nearHouses = TW.stats.nearHouses; r.propsNear = TW.stats.propsNear;
    out.cities.push(r); TW.dispose();
  }
  const KH = KIT.host(THREE, { pack: Wd.P, rows: Wd.I.rows, tarr: Wd.T, HG: Wd.HG, mode: 'batch', now });
  const RG = RING.make({ cell: 256, move: 40 }); for (let i = 0; i < 2000; i++) RG.add(i, (i % 50) * 30, Math.floor(i / 50) * 30, 600);
  const kfar = new THREE.Vector3(30000, 120, 30000);
  KH.tick(kfar); out.kitFar = measure(() => KH.tick(kfar));
  RG.update(5000, 5000); out.ringIdle = measure(() => RG.update(5000, 5000));
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const fail = []; let checks = 0;
const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra !== undefined ? ' - ' + extra : '')); return ok; };
const say = s => console.log('  ' + s);
const t0 = Date.now();

// ==================================================================================================================
// A THE RING
// ==================================================================================================================
{
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const N = 3000, items = [], left = new Map();
  for (let i = 0; i < N; i++) items.push({ i, x: (rnd() - 0.5) * 12000, z: (rnd() - 0.5) * 12000, r: 100 + rnd() * 900, alive: true });
  const RG = RING.make({ cell: 256, move: 40, onLeave: it => left.set(it, (left.get(it) || 0) + 1), alive: it => it.alive });
  for (const it of items) RG.add(it, it.x, it.z, it.r);
  let ex = 0, ez = 0, missing = 0, extra = 0, badLeave = 0, frames = 0, wasIn = new Set(), dupe = 0;
  for (let f = 0; f < 4000; f++) {
    if (f % 700 === 350) { ex = (rnd() - 0.5) * 10000; ez = (rnd() - 0.5) * 10000; }   // a jump (a location switch)
    else { ex += (rnd() - 0.4) * 60; ez += (rnd() - 0.45) * 60; }
    // moves, removes, re-adds on the way (the stream builds and tears down)
    if (f % 97 === 0) { const it = items[Math.floor(rnd() * N)]; if (RG.reachOf(it) === RG.reachOf(it)) { RG.remove(it); it.gone = true; } }
    if (f % 89 === 0) { const it = items[Math.floor(rnd() * N)]; it.x += 30; RG.add(it, it.x, it.z, it.r); it.gone = false; }
    if (f % 131 === 0) { const it = items[Math.floor(rnd() * N)]; it.alive = false; }   // torn down without telling the ring
    left.clear();
    RG.update(ex, ez); RG.sweep(16);
    frames++;
    const now = new Set(); for (let k = 0; k < RG.n; k++) { if (now.has(RG.list[k])) dupe++; now.add(RG.list[k]); }
    for (const it of items) {
      if (it.gone || (!it.alive && !RG.has(it))) continue;
      const d = Math.hypot(it.x - ex, it.z - ez);
      if (it.alive && d < it.r && !now.has(it)) missing++;
      if (now.has(it) && d > it.r + 2 * RG.move) extra++;
    }
    for (const it of wasIn) if (!now.has(it) && !it.gone && it.alive && (left.get(it) || 0) !== 1 && RG.reachOf(it) === RG.reachOf(it)) badLeave++;
    for (const it of now) if ((left.get(it) || 0) !== 0) badLeave++;
    wasIn = now;
  }
  const dead = items.filter(it => !it.alive && RG.reachOf(it) === RG.reachOf(it)).length;
  check(!missing, 'A every item within its reach of the eye is in the ring', missing + ' misses over ' + frames + ' frames');
  check(!extra, 'A nothing in the ring is past its reach + 2 x move', extra);
  check(!badLeave && !dupe, 'A an item leaves exactly once as it goes, never twice in the list', badLeave + ' bad leaves, ' + dupe + ' duplicates');
  for (let k = 0; k < 4000; k++) RG.sweep(16);
  const dead2 = items.filter(it => !it.alive && RG.reachOf(it) === RG.reachOf(it)).length;
  check(dead2 === 0, 'A the sweep takes the items torn down behind its back out', dead + ' -> ' + dead2);
  say('A the ring: ' + N + ' items, ' + frames + ' frames, ' + RG.stats.rebuilds + ' rebuilds, ' + (RG.stats.visits / RG.stats.rebuilds).toFixed(0) + ' items looked at a rebuild');
}

// ---- the world ----------------------------------------------------------------------------------------------------------
const Wd = world();
const { P, I, HG, T, propGeo, farMats, lotMats, lotGround } = Wd;
say('the world: ' + P.header.archetypes.length + ' archetypes, ' + I.rows.length + ' kit table records; the cities: ' + Wd.cities.map(C => C.name + ' (' + C.city.cells.length + ' cells, '
  + C.city.rows.length + ' kit rows, ' + C.city.props.n + ' props, ' + (C.bytes / 1024).toFixed(0) + ' KB raw, ' + ((C.box[2] - C.box[0]) / 1000).toFixed(2) + ' x ' + ((C.box[3] - C.box[1]) / 1000).toFixed(2) + ' km)').join('; ')
  + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
if (!Wd.cities.some(C => C.real)) say('(src/core/city_packs.json is not in this tree: the town host runs on the fixture alone; CITY-A\'s pack joins every check below once it is)');
// a flight over a box, through its focus (the fullest cell): from 7 km east, in low, a climb to 800 m, out west to 6 km, across
// it north to south, the circuit 5 km out
function flight(box, focus) {
  const [bx0, bz0, bx1, bz1] = box, bcx = focus ? focus[0] : (bx0 + bx1) / 2, bcz = focus ? focus[1] : (bz0 + bz1) / 2;
  const pts = [], add = (x, y, z) => pts.push(new THREE.Vector3(x, y, z));
  for (let x = bx1 + 7000; x > bx0 - 6000; x -= 23) add(x, x > bcx ? 150 : 150 + Math.min(650, (bcx - x) * 0.6), bcz + 37);
  for (let z = bz0 - 2000; z < bz1 + 2000; z += 19) add(bcx - 60, 90, z);
  for (let a = 0; a < 2 * Math.PI; a += 0.004) add(bcx + 5000 * Math.cos(a), 300, bcz + 5000 * Math.sin(a));
  return pts;
}
const farOf = (box, e) => Math.hypot(Math.max(box[0] - e.x, 0, e.x - box[2]), Math.max(box[1] - e.z, 0, e.z - box[3]));

// ==================================================================================================================
// B THE KIT RING against the full walk (today's Metlakatla on the kit)
// ==================================================================================================================
{
  const box = (() => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const r of I.rows) { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x); z1 = Math.max(z1, r.z); } return [x0, z0, x1, z1]; })();
  const PATH = flight(box);
  const KR = KIT.host(THREE, { pack: P, rows: I.rows, tarr: T, HG, mode: 'batch' });
  const KF = KIT.host(THREE, { pack: P, rows: I.rows, tarr: T, HG, mode: 'batch', ring: false });
  const N = I.rows.length;
  let diff = 0, farVisits = 0, farFrames = 0, steps = 0;
  const run = () => { for (const e of PATH) {
    KR.tick(e); KF.tick(e); steps++;
    for (let h = 0; h < N; h++) { const a = KR.rungOf(h), b = KF.rungOf(h); if (a[0] !== b[0] || a[1] !== b[1]) diff++; }
    if (farOf(box, e) > 4000) { farFrames++; farVisits += KR.stats.visits; }
  } };
  run();
  KR.setBand({ W0: 0, W1: 0 }); KF.setBand({ W0: 0, W1: 0 }); run();   // the hard switch
  check(!diff, 'B the kit host\'s ring gives the full walk\'s rungs, house by house, frame by frame (band and hard switch)', diff + ' differences over ' + steps + ' frames x ' + N + ' houses');
  check(farFrames > 300 && farVisits === 0, 'B from 4 km and more the kit host visits no house', farVisits + ' visits over ' + farFrames + ' far frames');
  say('B the kit ring: ' + steps + ' frames; the full walk visits ' + N + ' houses a frame, the ring 0 from 4 km');
  KR.dispose(); KF.dispose();
}

// ==================================================================================================================
// C THE CENSUS, D THE VISITS, F THE SWITCH - on every city
// ==================================================================================================================
for (const CT of Wd.cities) {
  const city = CT.city, box = CT.box, tag = ' [' + CT.name + ']';
  const fc = city.cells.reduce((a, c) => (c.rows[1] > a.rows[1] ? c : a)), PATH = flight(box, [(fc.box[0] + fc.box[2]) / 2, (fc.box[1] + fc.box[3]) / 2]);
  if (CT.real) check(CT.kitPack === CT.packSha && city.rows.every(r => r.arch < P.header.archetypes.length), 'C the pack names the committed kit pack and its archetypes' + tag, CT.kitPack + ' / ' + CT.packSha);
  const TW = KIT.town(THREE, { pack: P, city, tarr: T, HG, propGeo, farMats, lotMats, lotGround });
  const scene = new THREE.Scene(); scene.add(TW.group); TW.freeze();
  {
    const nCells = city.cells.length, nArch = P.header.archetypes.length, nProps = city.keys.length * 2;   // (a prop key: a cast and a flat mesh)
    const nLot = city.lotKit ? city.lotKit.pieces.length * 4 + 4 : 0;   // (a lot piece: 2 roles x cast / flat; the worn grounds' sets)
    const census = TW.census(), bound = nCells + nArch + nProps + nLot + 8;
    check(census <= bound, 'C the town\'s Object3D census is <= cells + archetypes + 2 x prop keys + 4 x lot pieces + 8' + tag, census + ' > ' + bound);
    check(census < city.rows.length / 2 + 16, 'C ... nothing a plot (' + city.rows.length + ' kit rows)' + tag, census);
    let stat = 0, cast = 0, draws = 0, nFar = 0, cellless = 0;
    // G3423 (the user: "no flat lot squares"): the shell alone - one group over the walls and roofs buckets, never the roads' or lots'
    let notShell = 0;
    for (const m of TW.far) if (m) { nFar++; if (m.matrixAutoUpdate || m.matrixWorldAutoUpdate) stat++; if (m.castShadow) cast++; draws += m.geometry.groups.length; if (m.geometry.groups.length !== 1) stat++;
      const c = city.cells[m.userData.townCell], bk = n => c.far.buckets.find(q => q.name === n) || { first: 0, count: 0 }, W = bk('walls'), R = bk('roofs'), g0 = m.geometry.groups[0];
      if (!g0 || g0.start !== W.first || g0.count !== W.count + R.count || W.first + W.count !== R.first) notShell++; }
    for (const c of city.cells) { const W = c.far.buckets.find(q => q.name === 'walls'); if (c.far.n && W && W.count && !TW.far[c.ci]) cellless++; }
    check(!cellless && !stat, 'C every far cell is one static Mesh (matrixAutoUpdate and matrixWorldAutoUpdate off), one draw' + tag, stat + ' of ' + nFar + ', ' + cellless + ' without');
    check(!notShell, 'C ... its walls and roofs alone: no lots\' ground, no road ribbon (the terrain and the town\'s own roads show)' + tag, notShell);
    check(!cast, 'C no far cell casts a shadow' + tag, cast);
    // the far mesh stands where the cell's kit rows stand: each row's centre has far-mesh vertices within its radius
    let lost = 0, rowsN = 0;
    for (const c of city.cells) { const m = TW.far[c.ci]; if (!m) continue; const Pa = m.geometry.attributes.position.array, ox = c.o[0], oz = c.o[2];
      for (let h = c.rows[0]; h < c.rows[0] + c.rows[1]; h++) { rowsN++; const cc = TW.kit.centre(h), R = TW.kit.radius(h) + 2; let hit = false;
        for (let v = 0; v < Pa.length && !hit; v += 3) { const dx = Pa[v] + ox - cc.x, dz = Pa[v + 2] + oz - cc.z; if (dx * dx + dz * dz < R * R) hit = true; }
        if (!hit) lost++; } }
    check(!lost, 'C every kit row has its far shell in its cell\'s mesh (vertices within its radius)' + tag, lost + ' of ' + rowsN);
    say('C the census' + tag + ': ' + census + ' Object3Ds for ' + city.rows.length + ' kit rows and ' + city.props.n + ' props in ' + nCells + ' cells (bound ' + bound + '); far draws ' + draws + ', far triangles ' + TW.stats.farTris + '; built in ' + TW.stats.buildMs + ' ms');
  }
  {
    let v = 0, cv = 0, nh = 0, n = 0;
    const far = new THREE.Vector3(box[2] + 6400, 120, (box[1] + box[3]) / 2);
    for (let f = 0; f < 300; f++) { TW.tick(far); v += TW.stats.visits; cv += TW.stats.cellVisits; nh += TW.stats.nearHouses; n++; }
    for (const e of PATH) { if (farOf(box, e) < 4000) continue; TW.tick(e); v += TW.stats.visits; cv += TW.stats.cellVisits; nh += TW.stats.nearHouses; n++; }
    check(n > 300 && !v && !cv && !nh, 'D a far-only frame (4-6.4 km, idle and flying the circuit) visits no cell, no row, no prop' + tag, v + ' / ' + cv + ' / ' + nh + ' over ' + n + ' frames');
    say('D the visits' + tag + ': ' + n + ' far frames, ' + v + ' rows / props and ' + cv + ' cells visited');
  }
  {
    // the reference: a full-walk host over the same rows (the rungs a near cell's rows must take)
    const REF = KIT.host(THREE, { pack: P, rows: city.rows, tarr: T, HG, mode: 'batch', ring: false, band: Object.assign({}, TW.kit.band) });
    const NC = city.cells.length, near = new Uint8Array(NC), pnear = new Uint8Array(NC);
    let badCell = 0, badMesh = 0, badFarHouse = 0, badNearHouse = 0, badProps = 0, frames = 0, switches = 0, nearMax = 0, visMax = 0, sw2 = 0;
    // the flight twice: the switch at the cook's 1 km, then the dial at 2 km (the user's fallback) - the same rules at its edges
    const NP = PATH.length;
    for (let fi = 0; fi < 2 * NP; fi++) {
      if (fi === NP) { TW.setSwitch(2000); sw2 = switches; }
      const e = PATH[fi % NP];
      TW.tick(e); REF.tick(e); frames++;
      let wantProps = 0;
      for (let ci = 0; ci < NC; ci++) {
        const d = TW.boxDist(ci, e.x, e.z), was = near[ci];
        near[ci] = was ? (d > TW.nearOut ? 0 : 1) : (d < TW.nearIn ? 1 : 0);
        pnear[ci] = pnear[ci] ? (d > TW.propOut ? 0 : 1) : (d < TW.propIn ? 1 : 0);
        if (near[ci] !== was) switches++;
        if (!!near[ci] !== TW.cellNear(ci) || !!pnear[ci] !== TW.propNear(ci)) badCell++;
        const m = TW.far[ci]; if (m && m.visible !== !near[ci]) badMesh++;
        const c = city.cells[ci];
        for (let h = c.rows[0]; h < c.rows[0] + c.rows[1]; h++) {
          const r = TW.kit.rungOf(h);
          if (!near[ci]) { if (r[0] !== -1 || r[1] !== -1) badFarHouse++; }
          else { const q = REF.rungOf(h); if (r[0] !== q[0] || r[1] !== q[1]) badNearHouse++; }
        }
        if (pnear[ci]) for (let i = c.props[0]; i < c.props[0] + c.props[1]; i++) if (!TW.propHide[i]) wantProps++;
      }
      let have = 0; for (const Pq of TW.props) if (Pq) have += Pq.parts[0].count;
      if (have !== wantProps) badProps++;
      nearMax = Math.max(nearMax, TW.stats.near); visMax = Math.max(visMax, TW.stats.visits);
    }
    check(!badCell, 'F each cell near / far as its box distance says (in at nearIn, out at nearOut; its props at propFar)' + tag, badCell + ' over ' + frames + ' frames, ' + switches + ' switches');
    check(!badMesh, 'F a far cell draws its shell, a near one nothing of its far mesh' + tag, badMesh);
    check(!badFarHouse, 'F a far cell\'s kit rows on no rung (its mesh draws them)' + tag, badFarHouse);
    check(!badNearHouse, 'F a near cell\'s kit rows on the rungs the full walk gives' + tag, badNearHouse);
    check(!badProps, 'F the props drawn are exactly the props-near cells\' (less a landmark\'s and a unique plot\'s: the unique path\'s)' + tag, badProps);
    check(sw2 > 10 && switches - sw2 > 10 && TW.nearIn === 1950 && TW.nearOut === 2050, 'F the flight crossed the switch at 1 km and at the dial\'s 2 km' + tag, sw2 + ' / ' + (switches - sw2) + ' switches, ' + TW.nearIn + ' / ' + TW.nearOut);
    say('F the switch' + tag + ': ' + frames + ' frames, ' + switches + ' cell switches, up to ' + nearMax + ' near cells and ' + visMax + ' rows + props visited in a frame (in / out 950 / 1050 m, then the dial 1950 / 2050 m; props ' + TW.propIn + ' m)');
    REF.dispose();
  }
  // F2 the late props (a prop's asset lands after the town is up) and a hidden row (its plot edited: it builds unique)
  {
    let ready = false;
    const T2 = KIT.town(THREE, { pack: P, city, tarr: T, HG, farMats, lotMats, lotGround, propGeo: k => (ready ? [propGeo(k)[0], propGeo(k)[0]] : null) });
    const big = city.cells.reduce((a, c) => (c.rows[1] > a.rows[1] ? c : a)), e = new THREE.Vector3((big.box[0] + big.box[2]) / 2, 80, (big.box[1] + big.box[3]) / 2);
    T2.tick(e);
    const none = T2.props.every(q => !q);
    ready = true; T2.propsAgain(); T2.tick(e);
    let want = 0; for (let ci = 0; ci < city.cells.length; ci++) if (T2.propNear(ci)) { const c = city.cells[ci]; for (let i = c.props[0]; i < c.props[0] + c.props[1]; i++) if (!T2.propHide[i]) want++; }
    const parts = T2.props.filter(Boolean), have = parts.reduce((a, q) => a + q.parts[0].count, 0), same = parts.every(q => q.parts.length === 2 && q.parts[1].count === q.parts[0].count);
    check(none && want > 0 && have === want && same, 'F2 a prop whose asset lands late is drawn at the next tick, every part of it' + tag, none + ' / ' + have + ' of ' + want);
    const h = big.rows[0];
    T2.kit.setHidden(h, true); T2.tick(e);
    const rn = T2.kit.rungOf(h);
    check(rn[0] === -1 && rn[1] === -1 && T2.kit.dataOf(h)[3] === 1, 'F2 a hidden row draws nothing near (no rung, the shader\'s flag)' + tag, JSON.stringify([rn, T2.kit.dataOf(h)[3]]));
    T2.kit.setHidden(h, false); T2.tick(e);
    check(T2.kit.rungOf(h)[0] >= 0 && T2.kit.dataOf(h)[3] === (T2.kit.mayCast(h) ? 0 : 0.25), 'F2 shown again, it takes its rung' + tag);
    const noCast = city.rows.filter(r => !(r.flags & 8)).length, flagged = city.rows.reduce((a, r, i) => a + (T2.kit.mayCast(i) === !!(r.flags & 8) ? 0 : 1), 0);
    check(!flagged, 'F2 a row casts as the cook\'s flag 8 says (' + noCast + ' of ' + city.rows.length + ' cast none)' + tag, flagged);
    T2.dispose();
  }
  // ---- L THE NEAR LOTS (G3424-G3426; v2 §9): near only (lotFar of a cell's box), instanced, the rows as the format draws them
  if (city.lots.n) {
    const LR = city.lots, LK = city.lotKit.pieces, LT = TW.lots, NC = city.cells.length, lnear = new Uint8Array(NC);
    // L1 the lot kit
    const meshP = LK.filter(q => q.verts > 0), badKit = meshP.filter(q => !q.parts.length || q.parts.some(pt => pt.role > 1 || !pt.idx.length)).length;
    check(meshP.length && !badKit, 'L the lot kit decodes: every mesh piece split by its role (post / deck)' + tag, meshP.length + ' mesh pieces, ' + badKit + ' bad');
    const wantOf = (flag, on) => { let n = 0; for (let ci = 0; ci < NC; ci++) if (on[ci]) { const c = city.cells[ci]; for (let i = c.lots[0]; i < c.lots[0] + c.lots[1]; i++) if (!LT.hide[i] && flag[i]) n++; } return n; };
    const haveOf = T => { let n = 0; for (const q of T.slots) if (q) n += q.parts[0].count; return n; };
    let badN = 0, badFar = 0, badCell = 0, frames = 0, maxN = 0, castBad = 0;
    for (const e of PATH) {
      TW.tick(e); frames++;
      let any = false;
      for (let ci = 0; ci < NC; ci++) { const d = TW.boxDist(ci, e.x, e.z); lnear[ci] = lnear[ci] ? (d > LT.lotOut ? 0 : 1) : (d < LT.lotIn ? 1 : 0); if (lnear[ci]) any = true; if (!!lnear[ci] !== LT.near(ci)) badCell++; }
      const hm = haveOf(LT.mesh), ho = haveOf(LT.old), hg = haveOf(LT.ground);
      if (hm !== wantOf(LT.isMesh, lnear) || ho !== wantOf(LT.isOld, lnear) || hg !== wantOf(LT.isGround, lnear)) badN++;
      if (!any && hm + ho + hg) badFar++;
      maxN = Math.max(maxN, hm + ho + hg);
    }
    check(!badCell && !badN, 'L the lot rows drawn are exactly the lot-near cells\' (each kind in its table, a unique plot\'s left to the unique path)' + tag, badCell + ' cells, ' + badN + ' frames off over ' + frames);
    check(!badFar && maxN > 0, 'L near only: no lot row drawn while no cell is within lotFar (' + LT.lotIn + ' m)' + tag, badFar + ' frames; up to ' + maxN + ' rows near');
    // at the fullest cell: every instance is its row, as the format draws it
    const big = city.cells.reduce((a, c) => (c.rows[1] > a.rows[1] ? c : a)), e = new THREE.Vector3((big.box[0] + big.box[2]) / 2, 60, (big.box[1] + big.box[3]) / 2);
    TW.tick(e); TW.tick(e);
    const M4 = new THREE.Matrix4(), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
    let shear = 0, nShear = 0, rises = 0, oldBad = 0, nOld = 0, gBad = 0, nG = 0;
    for (const q of LT.mesh.slots) if (q) { const im = q.parts[0];
      if (im.castShadow !== q.parts.every(x => x.castShadow)) castBad++;
      for (let j = 0; j < q.n; j++) { const i = q.rows[j], P = LK[LR.piece[i]]; M4.fromArray(im.instanceMatrix.array, j * 16);
        v0.set(0, 0, 0).applyMatrix4(M4); v1.set(P.len, 0, 0).applyMatrix4(M4); nShear++;
        const len = LR.len[i] > 0 ? LR.len[i] : P.len, rise = LR.g[i * 4 + 1] - LR.g[i * 4];
        if (Math.abs(rise) > 0.01) rises++;
        const ex = LR.x[i] + Math.cos(LR.yaw[i]) * len, ez = LR.z[i] - Math.sin(LR.yaw[i]) * len;
        if (Math.hypot(v0.x - LR.x[i], v0.z - LR.z[i]) > 1e-3 || Math.abs(v0.y - (LR.y[i] + LR.g[i * 4])) > 1e-3 || Math.hypot(v1.x - ex, v1.z - ez) > 1e-3 || Math.abs(v1.y - v0.y - rise) > 1e-3) shear++; } }
    check(nShear > 0 && !shear, 'L a fence piece stands as the row says: its origin on corner 0, its far end length along its yaw and up by the rise (the shear)' + tag, shear + ' of ' + nShear + ' (' + rises + ' on a rise)');
    for (const q of LT.old.slots) if (q) for (let j = 0; j < q.n; j++) { const i = q.rows[j], P = LK[LR.piece[i]], a = q.parts[0].instanceMatrix.array, sx = Math.hypot(a[j * 16], a[j * 16 + 1], a[j * 16 + 2]); nOld++;
      if (Math.abs(sx - LR.len[i] / P.len) > 1e-4) oldBad++; }
    check(!oldBad, 'L an old-fence row is its prop scaled length / piece.len along x' + tag, oldBad + ' of ' + nOld);
    for (const q of LT.ground.slots) if (q) { const g = q.parts[0].geometry, C = g.attributes.aLotC.array, S = g.attributes.aLotS.array;
      if (q.parts[0].castShadow) castBad++;
      for (let j = 0; j < q.n; j++) { const i = q.rows[j]; nG++;
        for (let k = 0; k < 4; k++) if (Math.abs(C[j * 4 + k] - LR.g[i * 4 + k]) > 1e-4) { gBad++; break; }
        if (Math.abs(S[j * 4] - LR.len[i]) > 1e-4 || Math.abs(S[j * 4 + 1] - LR.wid[i]) > 1e-4 || S[j * 4 + 2] !== LR.seed[i]) gBad++; } }
    check(nG > 0 && !gBad, 'L a worn ground piece carries its row: the four corners, the length, the width, the seed' + tag, gBad + ' of ' + nG);
    for (const q of LT.mesh.slots.concat(LT.old.slots)) if (q) for (let j = 0; j < q.n; j++) if (q.parts[0].castShadow !== !!(LR.flags[q.rows[j]] & 1)) castBad++;
    check(!castBad && LT.lotIn <= TW.lod.castFar, 'L shadows near only: a lot row casts by its flag 1, within lotFar (' + LT.lotIn + ' m <= castFar); the worn ground never' + tag, castBad);
    // L hidden: a unique plot's rows never; an edited plot's rows, props, kit rows and far range leave the draw, and come back
    let uniq = 0; for (const q of LT.mesh.slots.concat(LT.old.slots, LT.ground.slots)) if (q) for (let j = 0; j < q.n; j++) { const i = q.rows[j], ci = city.rows.length ? (() => { for (const c of city.cells) if (i >= c.lots[0] && i < c.lots[0] + c.lots[1]) return c.ci; return -1; })() : -1; if (ci >= 0 && (city.cells[ci].plots[LR.owner[i]] || [])[4] & 2) uniq++; }
    check(!uniq, 'L a unique plot\'s lot rows are never the pack\'s (the unique path builds its fence)' + tag, uniq);
    const ck = big, kPlot = ck.plots.findIndex(q => (q[4] & 1) && q[2] >= 0 && (ck.far.owners || []).some(w => w[0] === 0 && w[1] === ck.plots.indexOf(q)));
    if (kPlot >= 0) {
      const own = ck.far.owners.filter(w => w[0] === 0 && w[1] === kPlot), lotsOf = () => { let n = 0; for (const T of [LT.mesh, LT.old, LT.ground]) for (const q of T.slots) if (q) for (let j = 0; j < q.n; j++) { const i = q.rows[j]; if (i >= ck.lots[0] && i < ck.lots[0] + ck.lots[1] && LR.owner[i] === kPlot) n++; } return n; };
      const before = lotsOf(), h = ck.rows[0] + ck.plots[kPlot][2];
      TW.setPlotHidden(ck.ci, kPlot, true); TW.tick(e);
      const gone = lotsOf(), kr = TW.kit.rungOf(h), G = TW.far[ck.ci] ? TW.far[ck.ci].geometry.groups : [];
      const cut = own.every(w => G.every(g => g.start >= w[3] + w[4] || g.start + g.count <= w[3])), drawn = G.reduce((a, g) => a + g.count, 0);
      TW.setPlotHidden(ck.ci, kPlot, false); TW.tick(e);
      const back = lotsOf(), G2 = TW.far[ck.ci] ? TW.far[ck.ci].geometry.groups : [];
      check(before > 0 && gone === 0 && kr[0] === -1 && cut && drawn + own.reduce((a, w) => a + w[4], 0) === TW.farGroups(ck.ci).reduce((a, g) => a + g.count, 0) && back === before && G2.reduce((a, g) => a + g.count, 0) === drawn + own.reduce((a, w) => a + w[4], 0),
        'L an edited plot leaves the pack\'s draw - its lot rows, its kit rows, its far shell\'s range (the cell draws around it) - and comes back' + tag, [before, gone, back, kr.join('/'), cut, G.length].join(' '));
    }
    let lotMeshes = 0; for (const T of [LT.mesh, LT.old, LT.ground]) T.each(() => { lotMeshes++; });
    say('L the near lots' + tag + ': ' + LR.n + ' rows (' + LT.isMesh.reduce((a, b) => a + b, 0) + ' fence pieces, ' + LT.isOld.reduce((a, b) => a + b, 0) + ' old stretches, ' + LT.isGround.reduce((a, b) => a + b, 0) + ' worn grounds), '
      + lotMeshes + ' instanced meshes, up to ' + maxN + ' rows drawn near (lotFar ' + LT.lotIn + ' m), 0 far');
  } else if (CT.real) say('L the near lots' + tag + ': this pack has no lots section (v' + (CT.v || 1) + '; CITY-A\'s v2 brings it) - checked on the fixture');
  TW.dispose();
}
{
  const TKs = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'townkit.js'), 'utf8');
  check(/if \(kD0\.w > 0\.5\) gl_Position/.test(TKs) && /kitSlot < -0\.5 \|\| kD0\.w > 0\.2 \|\| distance\(kO, uKitEye\)/.test(TKs), 'F2 the view drops a hidden row, the shadow pass a hidden or a no-cast row');
}

// ==================================================================================================================
// E ALLOCATION (the child)
// ==================================================================================================================
{
  const { execFileSync } = require('child_process');
  let al = null;
  try { al = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--max-semi-space-size=128', __filename, '--alloc'], { encoding: 'utf8', timeout: 240000 })); } catch (e) { al = { err: String(e.message || e).slice(0, 300) }; }
  if (al && !al.err) {
    for (const r of al.cities) {
      check(r.townFar < 4, 'E the town host idle far allocates nothing a tick [' + r.name + ']', r.townFar.toFixed(2) + ' bytes');
      check(r.townNear < 4 && r.nearHouses > 50, 'E the town host idle near (' + r.nearHouses + ' rows on their rungs, ' + r.propsNear + ' props) allocates nothing a tick [' + r.name + ']', r.townNear.toFixed(2) + ' bytes');
    }
    check(al.kitFar < 4, 'E the kit host\'s ring idle far allocates nothing a tick', al.kitFar.toFixed(2) + ' bytes');
    check(al.ringIdle < 4, 'E the ring\'s idle update allocates nothing', al.ringIdle.toFixed(2) + ' bytes');
    say('E allocation, bytes a tick over 20 000 ticks: ' + al.cities.map(r => r.name + ' far ' + r.townFar.toFixed(2) + ' / near ' + r.townNear.toFixed(2)).join(', ') + '; kit ring far ' + al.kitFar.toFixed(2) + ', ring idle ' + al.ringIdle.toFixed(2));
  } else check(false, 'E the allocation child ran', al && al.err);
}

// ==================================================================================================================
// G THE METER
// ==================================================================================================================
{
  global.window = { location: { search: '' }, localStorage: { getItem: () => null, setItem() {} }, document: { hidden: false, addEventListener() {} }, BOOT: { state: 'gone', set: 'rollout' } };
  const FR = require(path.join(ROOT, 'src', 'viewer', 'flight_recorder.js'));
  let tc = 1000;
  const R = FR.make({ now: () => tc, frames: 1024, chunk: 256 });
  check(['town', 'townN', 'townKB'].every(k => FR.COLS.includes(k)), 'G the recorder has the town columns', FR.COLS.slice(-4).join(','));
  R.begin(16.7, { steps: 1 }); R.town(1.25, 7, NaN); R.town(0.5, 3, 2.5); tc += 5; R.end(true, [0, 0, 0]);
  const r1 = R.row(R.frame - 1);
  R.begin(33.4, { steps: 1 }); R.town(0.25, 0, NaN); tc += 5; R.end(true, [0, 0, 0]);
  const r2 = R.row(R.frame - 1);
  check(Math.abs(r1.town - 1.75) < 1e-6 && r1.townN === 10 && Math.abs(r1.townKB - 2.5) < 1e-6, 'G town() sums into the frame\'s row', JSON.stringify([r1.town, r1.townN, r1.townKB]));
  check(Math.abs(r2.town - 0.25) < 1e-6 && r2.townN === 0 && r2.townKB !== r2.townKB, 'G ... reset each frame, KB NaN without the probe', JSON.stringify([r2.town, r2.townN, r2.townKB]));
  delete global.window;
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const RW = rd('src/viewer/render_world.js'), RP = rd('src/viewer/render_premises.js'), RPF = rd('tools/rollout_perf.js');
  check(/const tTown = premisesR \? performance\.now\(\) : 0/.test(RW) && /FRw\.town\(ms, n, kb\)/.test(RW) && RW.indexOf('const tTown') < RW.indexOf('premisesR.stream(cg[0], cg[2])') && RW.indexOf('FRw.town(ms, n, kb)') > RW.indexOf('premisesR.tick(premTramLast'),
    'G render_world times the town\'s calls (the stream to the premises\' tick) into the recorder');
  check(/townalloc=1/.test(RW) && /usedJSHeapSize/.test(RW), 'G ... and the allocation probe (?townalloc=1)');
  check(/const TM_PARTS = \[/.test(RP) && /function townMeter\(\)/.test(RP) && /townMeter, townFrame: new Float64Array\(3\)/.test(RP), 'G render_premises meters its parts and items (TM, townMeter, townFrame)');
  check(/TOWN ms\/frame/.test(RPF) && /--town-alloc|flag\('town-alloc'\)/.test(RPF) && /enable-precise-memory-info/.test(RPF) && /townFrames:/.test(RPF), 'G rollout_perf: the TOWN line, the parts, the frames, --town-alloc');
}

// ==================================================================================================================
// H THE WIRING
// ==================================================================================================================
{
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const RP = rd('src/viewer/render_premises.js'), SL = rd('src/viewer/scenery_life.js'), TK = rd('src/viewer/townkit.js');
  const body = name => { const i = RP.indexOf('  function ' + name + '('); if (i < 0) return ''; const j = RP.indexOf('\n  }\n', i); return RP.slice(i, j); };
  const dt = body('detailTick');
  check(/HR\.ring\.update\(e\.x, e\.z\)/.test(dt) && /detailOne\(g, e, K\)/.test(dt) && /else for \(const g of G\.houses\.children\) detailOne/.test(dt), 'H the detail walk visits the near ring (?townring=0: every house)');
  check(/houseFar/.test(RP) && /onLeave: houseFar/.test(RP), 'H a house leaving the ring is put to its far state');
  check(/if \(k === 'houses'\) \{ HFROZE\.n\+\+; houseRing\(c\); \}/.test(RP), 'H a house joins the ring as it freezes (its centre final)');
  const ht = body('hlodTick');
  check(/HRC\.ring\.update\(e\.x, e\.z\)/.test(ht) && /hlodCellTick\(L\[k\], e, hw\)/.test(ht) && /HFROZE\.n !== hlodFroze/.test(ht), 'H the far town\'s cells on a ring, its scan by generation');
  check(/function lotsRing\(/.test(RP) && /if \(RING_ON\) return lotsRing\(ex, ez\)/.test(RP), 'H the lots\' cells on a ring');
  check(/for \(const g of HR\.unsettled\)/.test(body('settleTick')), 'H the settle walk visits the unsettled houses only');
  check(/if \(!pose && RING_ON\) \{ t\.lag = \(t\.lag \|\| 0\) \+ dt; return; \}/.test(RP) && /function trafficCatch\(/.test(RP), 'H a road out of reach waits, its cars caught up as the eye comes back');
  check(/ring: KIT_RING/.test(RP) && /kitring=0/.test(RP), 'H the kit host on its ring (?kitring=0)');
  check(/townring=0/.test(RP) && /window\.TOWN_RING/.test(RP), 'H ?townring=0 is the A/B');
  check(/RING\.update\(eye\.x, eye\.z\)/.test(SL) && /if \(!n && !b\.lastN\) continue;/.test(SL), 'H scenery_life: the cells on a ring, an empty batch not re-uploaded');
  check(/const RL = o\.ring === false \|\| o\.select \? null : ringLib\(\)/.test(TK) && /function town\(THREE, opts\)/.test(TK), 'H townkit: the host\'s ring, the town host');
  const { MANIFEST } = require('./build.js');
  const wl = MANIFEST.world.map(x => x[1]);
  check(wl.indexOf('town_ring.js') >= 0 && wl.indexOf('town_ring.js') < wl.indexOf('render_premises.js'), 'H build.js ships town_ring.js before render_premises.js', wl.slice(-4).join(','));
  // the procedural path untouched: the village, the editor's premises, the piers keep their builds (no city host on them)
  check(/kitOf\(p\) >= 0 \? buildKitLot\(p, R\) : buildHouse\(p, R\)/.test(RP), 'H the unique / kit dispatch is as it was (buildHouse for every non-kit plot: the village, the editor\'s premises, the piers)');
  // the city host, behind its flag (default off) and the town's
  check(/const CITY = \{ want: !!\(KT\.want && !\(typeof location !== 'undefined' && \/\[\?&\]cityhost=0\\b\/\.test/.test(RP), 'H the city host with the town on (KT.want), the default since METLA-ON; ?cityhost=0 the old kit host');
  check(/if \(cityOwn\(p\) === 1\) \{ CITY\.stubs\+\+; return \{ grp: new THREE\.Group\(\), tris: 0, extra: \[\], lights: 0 \}; \}/.test(RP) && /cityOwn\(p\) === 1 \? null : p\.isItem \? 'item'/.test(RP),
    'H a pack entry builds nothing (an unparented entry in HOUSES), is never sent to the worker');
  check(/: cityOwn\(p\) \? cityBuildOne\(p, R\) : kitOf\(p\) >= 0 \? buildKitLot\(p, R\) : buildHouse\(p, R\); if \(h && CITY\.on\) cityBoundBuilt\(p, h\);/.test(RP), 'H the dispatch: the pack\'s first, then the kit lot / the unique house as before');
  check(/if \(CITY\.on\) \{ cityBuild\(\); return null; \}/.test(RP) && /if \(CITY\.on\) \{ cityTick\(e\); return; \}/.test(RP) && /root\.add\(CITY\.host\.group\); CITY\.host\.freeze\(\)/.test(RP), 'H the city host replaces the kit host (built, frozen by hand once in the scene, ticked)');
  check(/T\.inputs\.kitPack !== KT\.man\.pack\.sha256\) throw/.test(RP) && /man\.v !== 2\) throw/.test(RP) && /cells\.some\(c => c\.v !== 2\)\) throw/.test(RP) && /T\.frame !== 'world'\) throw/.test(RP), 'H a pack of another kit, version or frame is refused (the town on the kit as before)');
  check(/CITY\.host\.setPlotHidden\(E\.ci, E\.k, E\.seed !== p\.seed\)/.test(RP), 'H an edited pack plot (another seed) leaves the pack\'s draw - kit rows, props, lot rows, its far shell\'s range - and builds unique (one build path)');
  check(/&& !\(CITY\.on && cityOwn\(p\) === 2\)\) bareMetla\(h, p\);/.test(RP), 'H a pack\'s unique plot keeps its fence (built near only, the town bare elsewhere as before)');
  check(/far: CITY_FAR,/.test(RP) && /\[\?&\]cityfar=\(\[0-9\.\]\+\)/.test(RP) && /lotMats: cityLotMats\(\), lotGround: cityLotGround/.test(RP), 'H the switch\'s dial ?cityfar=, the near lots\' materials (the fence finish, the worn ground)');
  check(/g\.userData\.cityBound = 1; g\.visible = near;/.test(RP) && /if \(g\.userData\.cityBound\) continue;/.test(RP) && /cityBoxD\(ci, cx, cz\) : d\) > CITY\.city\.lod\.nearOut \+ 400/.test(RP),
    'H a pack\'s unique (a landmark, a unique or edited plot) builds 400 m before its cell comes near, draws while it is near, never in the far town\'s bake');
}

const ms = Date.now() - t0;
console.log('  ' + checks + ' checks (' + (ms / 1000).toFixed(1) + ' s)');
if (fail.length) { for (const f of fail) console.log('  FAIL ' + f); console.log('GATE CITYHOST: FAIL'); process.exit(1); }
console.log('GATE CITYHOST: PASS');
