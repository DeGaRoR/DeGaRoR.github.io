#!/usr/bin/env node
// premises_cook.js — THE DATA COOK (G835, the architecture queue's C2b; futureDesigns/ARCH-2026-09-27.md §3.2 (a)).
// A sibling of world_prep.js: world_prep ships the TERRAIN; this ships what the premises compose into, cooked
// offline, so a page can one day (C2c) stop composing it on its main thread.
//
//   node tools/premises_cook.js --island jolene --report     # cook in memory, measure, write nothing
//   node tools/premises_cook.js --island jolene              # cook into media/world/<id>/premises + the manifest
//
// WHAT IS COOKED, per 256 m cell, each cell ONE gzip stream under a content-hashed .bin, one manifest naming every
// one (src/core/premises_packs.json):
//   RASTER  (r_<i>_<j>) G614's composed-terrain raster - every modifier is affine in the ground under it, so the
//           stack is A h + B, baked per 16 m tile of the premises frame - in 256 m cells of that frame. Quantized
//           (27_premises.js rasterCellDecode: A in 2^-24, B in 2^-15 m off the tile's own level; the ground itself
//           and the tile's pad exact): a cooked tile reads the lazily baked one to 0.04 mm at 600 m. Each cell
//           carries a SIGNATURE of what it was baked from (O.rasterCellSig) and the page loads only the cells whose
//           signature its own composition gives - so a cook is never wrong, at worst it is not used.
//   PLACES  (p_<i>_<j>) in 256 m cells of the WORLD (render_premises.js LIVE_CELL, the stream's own squares): what
//           the page builds, as data - see cookPlaces below.
//
// VARIANTS. The page composes the record with Metlakatla dropped unless the GRAPHICS 'town' row says 'all'
// (app.js TOWN, G590): 'default' drops ['mk_'], 'town' drops nothing. Both are cooked; a cell whose bytes are the
// same in both is one file (content-addressed), so the second variant costs only the cells the town changes.
//
// THE PRICE, out loud (world_prep's rule): every cooked byte is in git history for ever. The places are
// KILOBYTES (placements, not triangles). The raster is MEGABYTES - a lattice is not a placement - and that is why
// it is cut per cell with a per-cell signature: an edit re-cooks, and adds to the history, only the cells it
// moved; writeMedia is content-addressed, so a re-cook of an unchanged cell writes nothing. Do not re-cook to try
// a threshold; cook when the fixture or the generators change (GATE PREMCOOK says when).
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TOOLS = __dirname;
const OUT = path.join(ROOT, 'src', 'core', 'premises_packs.json');
const VARIANTS = [{ name: 'default', drop: ['mk_'] }, { name: 'town', drop: [] }];   // app.js TOWN.off
const CELL = 256;          // render_premises.js LIVE_CELL, and the raster's cell (16 tiles of 16 m)
const LEVEL = 9;

// ---------------------------------------------------------------------------------------------------------------
// THE HEADLESS WORLD: flight_core (the composer, the world), Jolene off the shipped pack, and the generators in a vm
// on a THREE stub - GATE PREMISES's recipe - so the catalogue is the page's (a node compose without them misses the
// items' ground blocks: 5 modifiers of Jolene's 43)
// ---------------------------------------------------------------------------------------------------------------
function stubTHREE() {
  function Col(c) { this.hex = c; }
  Col.prototype.setHex = function (h) { this.hex = h; };
  Col.prototype.multiplyScalar = function (k) { const c = this.hex, f = v => Math.round(v * k); this.hex = (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255); return this; };
  Col.prototype.clone = function () { return new Col(this.hex); };
  function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); this.color = new Col((o && o.color) || 0); }
  Mat.prototype.clone = function () { return new Mat(this); };
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; this.count = a.length / n; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = Array.isArray(i) ? { array: i, count: i.length } : i; } computeVertexNormals() { this.attributes.normal = { array: new Float32Array((this.attributes.position || { array: [] }).array.length) }; } }
  class Object3D { constructor() { this.children = []; this.userData = {}; this.name = ''; } add(c) { this.children.push(c); c.parent = this; return this; } }
  class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this.isMesh = true; } }
  class Group extends Object3D {}
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class Texture { constructor(img) { this.image = img; this.repeat = new Vec2(1, 1); } }
  return { BufferAttribute, BufferGeometry, Mesh, Group, Object3D, Texture, Vector2: Vec2, Color: Col,
           MeshLambertMaterial: Mat, MeshStandardMaterial: Mat, MeshBasicMaterial: Mat, MeshPhysicalMaterial: Mat,
           DoubleSide: 2, FrontSide: 0, RepeatWrapping: 1000, SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear' };
}
// the page's world pack (build.js) - the generators the premises build with
const GEN_FILES = ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_sport_gen.js', '_marine_gen.js', '_shed_gen.js', '_hangar_gen.js', '_tower_gen.js', '_tram_gen.js', '_totem_gen.js', '_village_gen.js'];
let HL = null;
function headless() {
  if (HL) return HL;
  const C = require(path.join(TOOLS, 'flight_core.js'));
  const IN = require(path.join(TOOLS, 'island_node.js'));
  const GENS = {};
  const ctx = { window: GENS, THREE: stubTHREE(), console, Math, JSON, Float32Array, Float64Array, Uint8Array, Uint16Array, Uint32Array, Int32Array, Object, Array, Set, Map, Number, String, Boolean, isFinite, isNaN, parseInt, parseFloat };
  ctx.globalThis = ctx;
  // G903 (AS0b): a flat map is a constant the generators turn into assets.js's shared 1x1 (TEX_FLAT); the cook's stub THREE has
  // no DataTexture and the placements never read a texel, so a stub texture carrying the constant stands in
  ctx.TEX_FLAT = (rgb, cs) => { const t = new ctx.THREE.Texture(null); t.userData = { flat: rgb.slice(0, 3) }; t.colorSpace = cs || ''; return t; };
  vm.createContext(ctx);
  for (const f of GEN_FILES) vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
  const PG = C.PREMISES_GEN;
  HL = { C, IN, GENS, PG, CAT: PG.collect(GENS), ctx };
  return HL;
}

// the island's world, MADE WITH PREMISES as the page's is (app.js: makeWorld(0, { premises, island })) - an island
// made without any cuts the analytic world's old pad into the ground round (-520, 0), 500 m from HOME
// (20_world.js ISL_CUT), and a cook on that ground is a cook of another world (G835's first cook was: every cell's
// signature missed the page's). The variants are composed onto it below the way the page's premises host does -
// world.premises.set(rec, { build, pool }) with the generators as the globals. The boot is read WITHOUT its cook:
// what is cooked must not be read off an earlier cook.
// G995 (A5-LOAD): ...AND MADE WITH THE VARIANT'S OWN RECORD, as the page's is (app.js premisesPlaced: the fixture,
// Metlakatla cut unless the town is on). A world made with PG.DEF() stands the analytic HOME alone; the page's stands
// the premises' strips (HOME among them), and the island's base ground under 32 of the 92 default cells differed (to
// 0.30 m at their corners) - their signatures refused the cook in the page, which baked them lazily: the 1.6-2.4 s
// raster slices of the roll-out's world step, and 0.2-0.3 s of makeWorld inside the boot's script task. One world per
// (island, variant, fixture); islandWorld(id) with no variant keeps the old DEF world (the gate's own probes).
const WORLDS = new Map();
function islandWorld(id, variant, fixtureText) {
  const { C, IN, PG, CAT } = headless();
  let prem = PG.envelope(null, PG.DEF()), key = id;
  if (variant) {
    const txt = fixtureText !== undefined ? fixtureText : fs.readFileSync(fixturePath(id), 'utf8');
    let rec = PG.unwrap(txt).rec;
    if (variant.drop.length) rec = PG.dropPlaces(rec, variant.drop).rec;
    prem = PG.envelope(null, rec);
    key = id + '|' + variant.name + '|' + crypto.createHash('sha256').update(txt).digest('hex');
  }
  if (WORLDS.has(key)) return WORLDS.get(key);
  const boot = IN.islandBoot(id, { noCook: true });
  if (!boot) throw new Error('premises_cook: no island "' + id + '" in src/core/world_packs.json');
  const W = C.makeWorld(0, Object.assign({ island: C.ISLAND_GEN.makeIsland(boot), premises: prem }, variant ? { catalogue: CAT } : {}));
  WORLDS.set(key, W);
  return W;
}
function fixturePath(id) { return path.join(TOOLS, 'fixtures', 'island_' + id + '.json'); }
function composeVariant(id, variant, fixtureText) {
  const { PG, GENS, CAT } = headless();
  const W = islandWorld(id, variant, fixtureText);
  let rec = PG.unwrap(fixtureText !== undefined ? fixtureText : fs.readFileSync(fixturePath(id), 'utf8')).rec;
  if (variant.drop.length) rec = PG.dropPlaces(rec, variant.drop).rec;
  const O = W.premises.set(rec, { catalogue: CAT, globals: GENS, build: r => (GENS[r.gen] ? GENS[r.gen].build(r.P, 0) : null), pool: [], raster: true });
  return { W, O, rec };
}

// ---------------------------------------------------------------------------------------------------------------
// THE RASTER: tiles -> cells -> bytes (27_premises.js rasterCellIndex / rasterTileDecode read them)
// ---------------------------------------------------------------------------------------------------------------
function zz(v) { return v < 0 ? -2 * v - 1 : 2 * v; }
function residuals(q, N, out, at) {
  for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++, k++) {
    const p = i && j ? q[k - 1] + q[k - N] - q[k - N - 1] : i ? q[k - 1] : j ? q[k - N] : 0;
    const z = zz(q[k] - p);
    if (!(z < 4294967296)) throw new Error('premises_cook: a residual past 2^32 (' + z + ')');
    out[at + k] = z;
  }
}
function encodeTile(T, PG) {
  const N = T.N, NN = N * N, u = new Int32Array(NN), k = new Int32Array(NN);
  const QA = PG.GRQ_A, QB = PG.GRQ_B;
  for (let n = 0; n < NN; n++) {
    const a = T.A[n];
    if (!(a >= -1e-12 && a <= 1 + 1e-12)) throw new Error('premises_cook: A outside [0, 1] (' + a + ') - the quantization assumes a blend');
    u[n] = Math.round((1 - a) * QA);
    if (u[n] < 0) u[n] = 0; else if (u[n] > QA) u[n] = QA;
  }
  // b0: the commonest level under A = 0 (a pad), exact; the ground itself (A = 1, B = 0) exact by the flag
  const cnt = new Map(); let b0 = 0, best = 0;
  for (let n = 0; n < NN; n++) if (u[n] === QA) { const c = (cnt.get(T.B[n]) || 0) + 1; cnt.set(T.B[n], c); if (c > best) { best = c; b0 = T.B[n]; } }
  let a1b0 = 1;
  for (let n = 0; n < NN; n++) if (u[n] === 0 && Math.abs(T.B[n]) > 1e-9) { a1b0 = 0; break; }
  for (let n = 0; n < NN; n++) {
    const d = T.B[n] - b0;
    k[n] = d === 0 ? 0 : Math.round(d * QB);
    if (!(Math.abs(k[n]) < 268435456)) throw new Error('premises_cook: B out of the cell format\'s range (' + T.B[n] + ')');
  }
  return { b0, flags: a1b0, u, k, N };
}
function encodeCell(tiles, PG) {
  const enc = tiles.map(t => ({ t, e: encodeTile(t.T, PG) }));
  let nodes = 0; for (const x of enc) nodes += x.e.N * x.e.N;
  const base = 16 + 24 * enc.length, buf = Buffer.alloc(base + 8 * nodes);
  buf.write('FDGR', 0, 'latin1'); buf[4] = 1; buf.writeUInt32LE(enc.length, 8); buf.writeUInt32LE(nodes, 12);
  const ru = new Float64Array(nodes), rk = new Float64Array(nodes);
  let first = 0;
  enc.forEach((x, n) => {
    const o = 16 + n * 24;
    buf.writeInt32LE(x.t.i, o); buf.writeInt32LE(x.t.j, o + 4); buf[o + 8] = x.t.T.n; buf[o + 9] = x.e.flags;
    buf.writeUInt32LE(first, o + 12); buf.writeDoubleLE(x.e.b0, o + 16);
    residuals(x.e.u, x.e.N, ru, first); residuals(x.e.k, x.e.N, rk, first);
    first += x.e.N * x.e.N;
  });
  for (let m = 0; m < nodes; m++) {
    const a = ru[m], b = rk[m];
    for (let p = 0; p < 4; p++) { buf[base + p * nodes + m] = Math.floor(a / Math.pow(256, p)) % 256; buf[base + (4 + p) * nodes + m] = Math.floor(b / Math.pow(256, p)) % 256; }
  }
  return buf;
}
// the worst |cooked - baked| of a cell's tiles on the ground h (the decode is the page's)
function cellError(buf, tiles, PG, hMax) {
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.length), idx = PG.rasterCellIndex(u8);
  let worst = 0, exactPad = 0, exactGround = 0;
  for (const t of tiles) {
    const D = PG.rasterTileDecode(idx, idx.at.get(t.i * 131072 + t.j));
    for (let n = 0; n < D.A.length; n++) {
      const e = Math.abs(D.A[n] - t.T.A[n]) * hMax + Math.abs(D.B[n] - t.T.B[n]);
      if (e > worst) worst = e;
      if (t.T.A[n] === 0 && D.A[n] === 0 && D.B[n] === t.T.B[n]) exactPad++;
      if (t.T.A[n] === 1 && t.T.B[n] === 0 && D.A[n] === 1 && D.B[n] === 0) exactGround++;
    }
  }
  return { worst, exactPad, exactGround };
}
// THE REACH (the bytes' ruling): a lattice is not a placement - Jolene's default record is 8 638 tiles, 5.6 M
// nodes, 5.65 MB shipped for every cell - so the raster ships only the cells where the ground is read hardest: the
// whole 256 m cells within REACH.stand of the stands of REACH.fields (the roll-out's walks, the taxi, the take-off
// roll: HOME's stand is 510 m off its runway's centre). Whole cells, so a loaded cell answers for every tile of it;
// everywhere else the raster bakes lazily, as G614 left it. Measured (default record, --report): HOME's stand
// 1 km -> 30 cells, 1.37 MB; + 300 m round HOME's and w2's runways -> 51 cells, 2.19 MB; every strip's 600 m and
// every stand's 1 km -> 77 cells, 4.63 MB. REACH.runway (metres off a strip's centreline, null: none) adds strips.
const REACH = { stand: 1000, runway: null, fields: ['HOME'] };
// EVERY CELL FOR THE VARIANT THE PAGE FLIES (2026-09-27, RASTER-ON): with the raster on in the page, every tile outside
// the reach was baked LAZILY on its first read - and the render side reads the ground island-wide while the world
// is made, so the roll-out's world step grew one 13.4 s task (4.6 s before; node: 8 638 tiles, 4.6 s of bakes).
// The default variant (Metlakatla off, the page's default) is cooked whole; 'town' keeps REACH (it is opt-in).
const EVERYWHERE = new Set(['default']);
function rasterAnchors(O) {
  const segs = [], pts = [], only = REACH.fields ? new Set(REACH.fields) : null;
  for (const a of O.aerodromes) {
    if (REACH.runway === null || a.kind === 'water' || !(a.len > 0) || (only && !only.has(a.id))) continue;
    const c = Math.cos(a.hdg), s = Math.sin(a.hdg), h = a.len / 2;
    segs.push({ id: a.id, a: [a.x - c * h, a.z - s * h], b: [a.x + c * h, a.z + s * h] });
  }
  for (const r of O.runways) if (r.site && r.site.stand && isFinite(r.site.stand.x) && !(only && !only.has(r.id))) pts.push({ id: r.id, p: [r.site.stand.x, r.site.stand.z] });
  return { segs, pts };
}
function cellInReach(O, ci, cj, anchors) {
  const S = O.rasterCell, F = O.frame, w = F.toWorld((ci + 0.5) * S, (cj + 0.5) * S), half = S * Math.SQRT1_2;
  for (const q of anchors.pts) if (Math.hypot(w[0] - q.p[0], w[1] - q.p[1]) - half <= REACH.stand) return true;
  for (const g of anchors.segs) {
    const dx = g.b[0] - g.a[0], dz = g.b[1] - g.a[1], L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((w[0] - g.a[0]) * dx + (w[1] - g.a[1]) * dz) / L2)) : 0;
    if (Math.hypot(w[0] - g.a[0] - dx * t, w[1] - g.a[1] - dz * t) - half <= REACH.runway) return true;
  }
  return false;
}
function cookRaster(O, PG, opt) {
  const cells = new Map(), R = O.rasterCell, TS = O.rasterTile, per = R / TS, anchors = rasterAnchors(O);
  const t0 = Date.now();
  let tiles = 0, nodes = 0;
  const cellAt = (i, j) => {
    const ci = Math.floor(i / per), cj = Math.floor(j / per), key = ci + ',' + cj;
    let c = cells.get(key);
    if (c === undefined) cells.set(key, c = (opt && opt.everywhere) || cellInReach(O, ci, cj, anchors) ? { ci, cj, tiles: [] } : null);
    return c;
  };
  O.rasterEach((i, j, T) => { cellAt(i, j).tiles.push({ i, j, T }); tiles++; nodes += T.N * T.N; }, (i, j) => !!cellAt(i, j));
  for (const [k, c] of cells) if (!c || !c.tiles.length) cells.delete(k);
  const bakeMs = Date.now() - t0;
  const out = [];
  let worst = 0, raw = 0;
  for (const [, c] of cells) {
    const buf = encodeCell(c.tiles, PG);
    if (opt && opt.verify !== false) { const e = cellError(buf, c.tiles, PG, 600); worst = Math.max(worst, e.worst); }
    raw += buf.length;
    out.push({ ci: c.ci, cj: c.cj, sig: O.rasterCellSig(c.ci, c.cj), tiles: c.tiles.length, buf });
  }
  out.sort((a, b) => (a.ci - b.ci) || (a.cj - b.cj));
  return { cells: out, tiles, nodes, raw, bakeMs, worst, anchors: anchors.segs.map(g => g.id).concat(anchors.pts.map(q => q.id + ':stand')) };
}

// ---------------------------------------------------------------------------------------------------------------
// THE PLACES: the page's own code, lifted. render_premises.js decides where each house stands and how its plot is
// dressed (buildHouse: VILLAGE_GEN.placeHouse on the composed ground, the zone's rules, the pick's preset; dressPlot:
// VILLAGE_GEN.finishPlot - the path, the fences, the outbuilding, the car, the boat, the drive, the lot; buildItem:
// a site item and the synthetic plot it dresses; syncHouses: what is queued, and posOf / LIVE_CELL: in which 256 m
// cell of the world). Those functions are LIFTED out of the shipped file at cook time (GATE STAND's convention - the
// code under test is the page's, never a copy kept here) and run on the generators headless, with the THREE-side
// calls stubbed: placeBuilt (the meshes), hitAdd (the obstacle - computed here from the build's own bags), the fence
// geometry, the props registry (null) and the lot patch's mesh (measured, not kept).
// What the cook keeps, per queued thing, is DATA - kilobytes:
//   house   the plot as sown and as dressed (finishPlot's plan: cat, path, fences, out, outPath, car, boat, drive,
//           lot), where the house stands (placeHouse: x, y, z, yaw in the premises frame; `at` in the world), its
//           resolved P (every parameter HOUSE_GEN.build reads - less P.ground, a function of the composed ground the
//           builder re-makes, and P.spread, the generator's shared table), the props its build stands (people, yard,
//           pier, lamps: key and pose in the house's frame), and its OBSTACLE SHAPE (29_obstacles.js rasterise on the
//           build's own bags, render_premises shapeOf's filters: no ghost material, no flat mesh; the props are the
//           props' own shapes, per key - not merged here); the outbuilding the same, in plot.out
//   item    the composed item (gen, P, x, z, yaw), `at`, its lot's plan (the synthetic plot buildItem dresses), props,
//           shape
//   park / object / fence   the composed record, `at` for an object (the page's obY: `y`, or the composed ground +
//           dy); no build
// NOT cooked, measured: the lot patches' meshes and the roads' ribbons are MEGABYTES of triangles regenerable from
// the above (C2c's worker). The fence ownership between two plots (a shared edge is fenced once - FENCED) follows the
// order things are built in: the page builds by distance from the aircraft, the cook in the record's order (the
// queue's own), so a shared edge may be the other neighbour's here - the same fence.
// ---------------------------------------------------------------------------------------------------------------
const RP_FILE = path.join(ROOT, 'src', 'viewer', 'render_premises.js');
const LIFTS = [
  ['  const extentWorld = () =>', '  // ---- the ground, with the overlay and the wear'],
  ['  function buildHouse(plot) {', '  // THE DRESSING (v5)'],
  ['  let SPREAD = null;', '  // THE SLAB (G401)'],
  ['  const objectSeed = ob =>', '  // a park on its plot'],
  ['  const parkSeed = pk =>', '  // A HOUSE\'S THRIFT (G557'],
  ['  function posOf(p) {', '  // THE QUEUE BY CELL (G592)'],
  ['  const LIVE_CELL = 256;', '  const qPos = p =>'],
];
function liftPage(src) {
  src = src || fs.readFileSync(RP_FILE, 'utf8');
  const parts = [];
  for (const [a, b] of LIFTS) {
    const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error('premises_cook: render_premises.js no longer has "' + a.trim() + '" .. "' + b.trim() + '" - the cook lifts the page\'s own placement code; follow it');
    parts.push(src.slice(i, j));
  }
  return parts.join('\n');
}
const pageHash = () => crypto.createHash('sha256').update(liftPage()).digest('hex').slice(0, 16);
// render_premises shapeOf's filters, on a build's bags in the build's own frame (placeBuilt stands the meshes at the
// group's origin, so the group frame IS the bags' frame); cell as hitAdd's (1.0 a house, an item)
function shapeOfBuilt(built, F, HG, cell, OB) {
  const pos = [], idx = [];
  const add = (bag, mt) => {
    if (!bag || !mt) return;
    const d = bag.data(); if (!d.idx.length) return;
    if (mt.transparent && (mt.opacity < 0.5 || mt.depthWrite === false)) return;       // smoke, skirts, glows, glass
    const P = Float32Array.from(d.pos), base = pos.length / 3;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < P.length; i += 3) { if (P[i] < y0) y0 = P[i]; if (P[i] > y1) y1 = P[i]; }
    if (y1 - y0 < 0.15) return;                                                         // a flat thing is the ground's
    for (let i = 0; i < P.length; i++) pos.push(P[i]);
    for (const q of d.idx) idx.push(base + q);
  };
  for (const k of (built.BAGS || HG.BAGS)) add(built.bags[k], F.MAT[k]);
  add(built.bags.smoke, F.MAT.smoke);
  if (!idx.length) return null;
  const S = OB.rasterise(pos, idx, cell);
  if (!S) return null;
  const mm = a => Array.from(a, v => (isFinite(v) ? Math.round(v * 1000) : null));
  return { cell: S.cell, ox: S.ox, oz: S.oz, nx: S.nx, nz: S.nz, top: Math.round(S.top * 1000), lo: mm(S.lo), hi: mm(S.hi) };   // mm; d (the push field) is the chamfer of the occupied cells, re-made on load
}
function propsOfBuilt(built) {
  const st = built.stats || {}, out = [];
  const p = (k, x, z, ry, y, on) => out.push(on ? { k, x, y, z, ry, on } : { k, x, y, z, ry });
  if (st.pier) for (const m of (st.pier.modules || []).concat(st.pier.boats || [])) p(m.key, m.x, m.z, m.ry, m.y);
  for (const q of st.people || []) p(q.key, q.x, q.z, q.ry, q.y);
  for (const q of st.yard || []) p(q.key, q.x, q.z, q.ry, q.y, q.on);
  if (st.lit && st.lit.lights) for (const L of st.lit.lights) if (L.prop) p(L.prop, L.mx, L.mz, L.ry, L.my);
  return out;
}
// JSON-safe, deterministic: functions, the generator's shared tables and the builds dropped; typed arrays as arrays
const DROP = new Set(['spread', 'built', 'toWorld', 'ground', '_w', '_d', 'entry', 'plot', 'grp', 'rec']);
function clean(v, depth) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'function') return undefined;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'object') return v;
  if ((depth | 0) > 12) return null;
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (v instanceof Set) return Array.from(v).map(x => clean(x, depth + 1));
  if (Array.isArray(v)) return v.map(x => { const c = clean(x, (depth | 0) + 1); return c === undefined ? null : c; });
  const o = {};
  for (const k of Object.keys(v)) { if (DROP.has(k)) continue; const c = clean(v[k], (depth | 0) + 1); if (c !== undefined) o[k] = c; }
  return o;
}
function cookPlaces(W, O, opt) {
  const { GENS, PG, C, ctx } = headless();
  const code = liftPage(opt && opt.pageSrc);
  const OB = C.OBSTACLES, THREE = ctx.THREE;
  const hits = [], lots = { n: 0, bytes: 0 };
  let dressed = null;
  // the lot patch (--report only: it is the page's own lotGround, run to be measured - C2c re-makes it from the plan)
  const win = Object.assign({}, GENS, opt && opt.measureLots ? {
    LOT_GROUND: { mesh: (T3, grp, L) => { lots.n++; for (const k of ['pos', 'uv', 'splat', 'tone', 'alpha', 'idx']) if (L && L[k]) lots.bytes += (L[k].length || 0) * 4; } },
  } : {});
  const G = { houses: new THREE.Group(), lots: new THREE.Group() };
  const placeBuilt = (parent, house, built, F, HG) => Object.assign(new THREE.Group(), { __house: house, __built: built, __F: F, __HG: HG });
  const hitAdd = (grp, tag, cell) => { hits.push({ grp, tag, cell }); return 0; };
  const HOUSES = new Map(), queue = [], STREAM = {}, stats = {};
  const body = '"use strict";\n' + code + '\n' +
    'const dressPlot0 = dressPlot; dressPlot = function (plot) { const r = dressPlot0.apply(this, arguments); __dressed(plot); return r; };\n' +
    'fenceGroup = function () { return null; };\n' +
    'return { buildHouse, buildItem, syncHouses, posOf, cellKey, LIVE_CELL, W, H, litOf };';
  const make = new Function('window', 'O', 'world', 'rec', 'PG', 'G', 'THREE', 'o', 'placeBuilt', 'hitAdd', 'hitDrop', 'propReg', 'slabMesh', 'queueCells', 'STREAM', 'stats', 'HOUSES', 'queue', '__dressed', body);
  const P = make(win, O, W, O.rec, PG, G, THREE, { game: true, onBuilt: null }, placeBuilt, hitAdd, () => {}, () => null, () => null, () => {}, STREAM, stats, HOUSES, queue, pl => { dressed = pl; });
  if (P.LIVE_CELL !== CELL) throw new Error('premises_cook: the page\'s LIVE_CELL is ' + P.LIVE_CELL + ', the cook\'s ' + CELL);
  P.syncHouses();
  const cells = new Map(), t0 = Date.now();
  const cellOf = key => { let c = cells.get(key); if (!c) cells.set(key, c = { key, things: [] }); return c; };
  const atOf = h => { const w = O.frame.toWorld(h.x, h.z); return [w[0], h.y, w[1], h.yaw + O.frame.yaw]; };
  const shapeOfHit = tag => { for (let i = hits.length - 1; i >= 0; i--) if (hits[i].tag === tag && hits[i].grp.__built) { const g = hits[i].grp; return shapeOfBuilt(g.__built, g.__F, g.__HG, hits[i].cell, OB); } return null; };
  let n = 0, failed = [];
  const sown = new Map();                 // what the composition queued, per cell, before anything was built: the cell's inputs
  const only = opt && opt.only ? opt.only : Infinity;
  for (const p of queue.slice(0, only)) {
    const w = P.posOf(p), key = w ? P.cellKey(w[0], w[1]) : '*';
    const rec = p.rec || p, input = clean(rec);
    let thing;
    hits.length = 0; dressed = null;
    try {
      if (p.isPark) thing = { kind: 'park', park: clean({ key: rec.key, gen: rec.gen, plan: rec.plan, level: rec.level, seed: rec.seed, fences: rec.fences, items: (rec.items || []).map(it => it.id) }) };
      else if (p.isObject) { const ow = O.frame.toWorld(rec.x, rec.z); thing = { kind: 'object', ob: input, at: [ow[0], typeof rec.y === 'number' ? rec.y : O.terrainAt(ow[0], ow[1]) + (+rec.dy || 0), ow[1], rec.yaw + O.frame.yaw] }; }
      else if (p.isFence) thing = { kind: 'fence', fences: clean(rec.fences) };
      else if (p.isItem) {
        const r = P.buildItem(rec);
        if (!r) thing = { kind: 'item', item: input, failed: 'no generator' };
        else {
          const out = dressed && dressed.out ? Object.assign(clean(dressed.out), { shape: shapeOfHit('outbuilding') }) : undefined;
          thing = { kind: 'item', item: input, at: atOf(rec), plan: dressed ? Object.assign(clean(dressed), out ? { out } : {}) : null, props: propsOfBuilt(r.built), shape: shapeOfHit('item') };
        }
      } else {
        const r = P.buildHouse(p);
        if (!r) thing = { kind: 'house', plot: input, failed: 'no generator' };
        else {
          const plot = clean(p);
          if (p.out && p.out.built) plot.out = Object.assign(plot.out || {}, { at: atOf(p.out), props: propsOfBuilt(p.out.built), shape: shapeOfHit('outbuilding') });
          thing = { kind: 'house', plot, house: { x: r.house.x, y: r.house.y, z: r.house.z, yaw: r.house.yaw, seed: r.house.seed, P: clean(r.house.P) }, at: atOf(r.house), props: propsOfBuilt(r.built), shape: shapeOfHit('house') };
        }
      }
    } catch (e) { failed.push(p.id + ': ' + (e && e.message)); thing = { kind: 'failed', error: String(e && e.message) }; }
    thing.id = p.id; thing.seed = p.seed;
    cellOf(key).things.push(thing); n++;
    (sown.get(key) || sown.set(key, []).get(key)).push([p.id, p.seed, input]);
  }
  const out = [];
  for (const [key, c] of cells) {
    c.things.sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
    const [i, j] = key === '*' ? [null, null] : key.split(',').map(Number);
    const json = JSON.stringify({ v: 1, cell: key, things: c.things });
    // the cell's inputs: what the composition queued there (sown, not dressed) and the composed ground at its corners
    const probes = [];
    if (i !== null) for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) probes.push(O.terrainAt((i + x) * CELL, (j + z) * CELL));
    const ins = (sown.get(key) || []).slice().sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
    const sig = 'p1-' + crypto.createHash('sha256').update(JSON.stringify([ins, probes])).digest('hex').slice(0, 16);
    out.push({ key, i, j, n: c.things.length, sig, buf: Buffer.from(json, 'utf8') });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const hash = crypto.createHash('sha256'); for (const c of out) hash.update(c.key + ':').update(c.buf);
  return { cells: out, things: n, failed, ms: Date.now() - t0, hash: hash.digest('hex').slice(0, 16), lots, page: pageHash() };
}

// ---------------------------------------------------------------------------------------------------------------
// THE COOK (in memory): what the manifest would say and the bytes each cell would ship - the gate reads this too
// ---------------------------------------------------------------------------------------------------------------
const cellStem = (tag, i, j) => tag + '_' + (i < 0 ? 'm' + (-i) : i) + '_' + (j < 0 ? 'm' + (-j) : j);
const h8 = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
function cook(id, opt) {
  opt = opt || {};
  const { PG } = headless();
  const fixtureText = opt.fixtureText !== undefined ? opt.fixtureText : fs.readFileSync(fixturePath(id), 'utf8');
  const variants = [], rasterCells = new Map(), placeSets = [], log = opt.log || (() => {});
  for (const V of (opt.variants || VARIANTS)) {
    const t0 = Date.now();
    const { W, O, rec } = composeVariant(id, V, fixtureText);
    const tc = Date.now() - t0;
    const R = opt.noRaster ? { cells: [], tiles: 0, nodes: 0, raw: 0, bakeMs: 0, worst: 0, anchors: [] } : cookRaster(O, PG, EVERYWHERE.has(V.name) ? Object.assign({}, opt, { everywhere: true }) : opt);
    const Pl = opt.places === false ? null : cookPlaces(W, O, opt);
    if (Pl) for (const c of Pl.cells) c.gz = zlib.gzipSync(c.buf, { level: LEVEL });
    for (const c of R.cells) {
      const key = c.ci + ',' + c.cj + ',' + c.sig;
      const had = rasterCells.get(key);
      if (had) { if (!had.buf.equals(c.buf)) throw new Error('premises_cook: cell ' + key + ' has one signature and two contents - the signature misses an input'); had.in.push(V.name); continue; }
      rasterCells.set(key, Object.assign(c, { in: [V.name] }));
    }
    const recH = crypto.createHash('sha256').update(JSON.stringify(O.rec)).digest('hex').slice(0, 16);
    if (Pl) {
      let raw = 0, ship = 0; for (const c of Pl.cells) { raw += c.buf.length; ship += c.gz.length; }
      log('  ' + V.name.padEnd(8) + ' places: ' + Pl.things + ' things in ' + Pl.cells.length + ' cells, ' + (raw / 1e3).toFixed(1) + ' KB raw -> ' + (ship / 1e3).toFixed(1) + ' KB gz, cooked in ' + Pl.ms + ' ms, hash ' + Pl.hash + (Pl.failed.length ? ', FAILED ' + Pl.failed.length + ': ' + Pl.failed.slice(0, 3).join('; ') : ''));
      if (opt.measureLots) log('           (not cooked: ' + Pl.lots.n + ' lot patches, ' + (Pl.lots.bytes / 1e6).toFixed(1) + ' MB of mesh arrays - C2c re-makes them from the plans)');
    }
    placeSets.push({ name: V.name, P: Pl });
    variants.push({ name: V.name, drop: V.drop, record: recH, mods: O.n, places: Pl ? { things: Pl.things, cells: Pl.cells.length, hash: Pl.hash, failed: Pl.failed.length } : null,
      raster: { tiles: R.tiles, cells: R.cells.length, nodes: R.nodes, raw: R.raw, worstMm: +(R.worst * 1000).toFixed(4) } });
    log('  ' + V.name.padEnd(8) + ' compose ' + tc + ' ms, ' + O.n + ' modifiers; raster ' + R.tiles + ' tiles (' + R.nodes + ' nodes) in ' + R.cells.length + ' cells within reach of ' + R.anchors.join(' '));
    log('           baked ' + R.bakeMs + ' ms, ' + (R.raw / 1e6).toFixed(2) + ' MB raw, worst |cooked - baked| ' + (R.worst * 1000).toFixed(4) + ' mm at 600 m');
  }
  const cells = Array.from(rasterCells.values()).sort((a, b) => (a.ci - b.ci) || (a.cj - b.cj) || (a.sig < b.sig ? -1 : 1));
  for (const c of cells) c.gz = zlib.gzipSync(c.buf, { level: LEVEL });
  return { id, fixture: 'tools/fixtures/island_' + id + '.json', variants, raster: cells, places: placeSets, page: pageHash() };
}

function manifestIsland(K, srcOf, placeSrcOf) {
  let raw = 0, ship = 0;
  const cells = K.raster.map(c => { raw += c.buf.length; ship += c.gz.length; return { c: [c.ci, c.cj], sig: c.sig, src: srcOf(c), raw: c.buf.length, tiles: c.tiles, in: c.in }; });
  const places = { v: 1, cell: CELL, page: K.page, variants: {} };
  for (const S of K.places) if (S.P) {
    let r = 0, g = 0;
    places.variants[S.name] = { hash: S.P.hash, things: S.P.things, cells: S.P.cells.map(c => { r += c.buf.length; g += c.gz.length; return { c: c.i === null ? null : [c.i, c.j], sig: c.sig, src: placeSrcOf(c), raw: c.buf.length, n: c.n }; }) };
    places.variants[S.name].bytes = { raw: r, ship: g };
  }
  return {
    id: K.id, fixture: K.fixture, cooked: new Date().toISOString().slice(0, 10),
    variants: K.variants,
    raster: { v: 1, tile: 16, cell: CELL, qa: 16777216, qb: 32768, reach: REACH, bytes: { raw, ship }, cells },
    places,
  };
}

function flag(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}

function main() {
  const id = String(flag('island', 'jolene'));
  if (flag('reach-stand', null) !== null) REACH.stand = +flag('reach-stand');
  if (flag('reach-runway', null) !== null) REACH.runway = +flag('reach-runway');
  if (flag('fields', null) !== null) REACH.fields = flag('fields') === 'all' ? null : String(flag('fields')).split(',');
  const report = !!flag('report', false);
  const noPrune = !!flag('no-prune', false);
  if (!/^[a-z0-9_]+$/.test(id)) { console.error('premises_cook: the island id must match /^[a-z0-9_]+$/'); process.exit(2); }
  if (!fs.existsSync(fixturePath(id))) { console.error('premises_cook: no fixture ' + path.relative(ROOT, fixturePath(id))); process.exit(2); }
  console.log('premises_cook: island ' + id + (report ? '  [--report: nothing is written]' : ''));
  const K = cook(id, { log: s => console.log(s), measureLots: true });
  const { writeMedia, pruneMedia } = require('./_media_lib.js');
  const sub = 'world/' + id + '/premises', keep = [];
  const srcOf = c => {
    const stem = cellStem('r', c.ci, c.cj);
    if (report) return 'media/' + sub + '/' + stem + '.' + h8(c.gz) + '.bin';
    const rel = writeMedia(sub, stem, 'bin', c.gz); keep.push(rel); return rel;
  };
  const placeSrcOf = c => {
    const stem = c.i === null ? 'p_none' : cellStem('p', c.i, c.j);
    if (report) return 'media/' + sub + '/' + stem + '.' + h8(c.gz) + '.bin';
    const rel = writeMedia(sub, stem, 'bin', c.gz); keep.push(rel); return rel;
  };
  const isl = manifestIsland(K, srcOf, placeSrcOf);
  console.log('  ---');
  for (const v in isl.places.variants) { const P = isl.places.variants[v]; console.log('  places ' + v + ': ' + P.cells.length + ' cells, ' + (P.bytes.raw / 1e3).toFixed(1) + ' KB raw -> ' + (P.bytes.ship / 1e3).toFixed(1) + ' KB'); }
  console.log('  raster: ' + isl.raster.cells.length + ' cells (' + K.variants.map(v => v.name + ' ' + v.raster.cells).join(', ') + '), raw ' + (isl.raster.bytes.raw / 1e6).toFixed(2) + ' MB -> ship ' + (isl.raster.bytes.ship / 1e6).toFixed(2) + ' MB');
  if (report) { console.log('\nnothing was written (--report).'); return; }
  const pack = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { islands: [] };
  pack.note = 'GENERATED by tools/premises_cook.js from tools/fixtures/island_<id>.json - do not edit. Every src is one gzip stream; GATE PREMCOOK holds it to a fresh cook.';
  pack.v = 1;
  pack.islands = (pack.islands || []).filter(w => w.id !== id).concat([isl]).sort((a, b) => a.id < b.id ? -1 : 1);
  fs.writeFileSync(OUT, JSON.stringify(pack, null, 1) + '\n');
  console.log('  manifest: src/core/premises_packs.json');
  if (!noPrune) { const gone = pruneMedia(sub, keep); if (gone.length) console.log('  pruned ' + gone.length + ': ' + gone.slice(0, 8).join(', ') + (gone.length > 8 ? ' ...' : '')); }
  console.log('\nnext: node tools/_premcook_check.js && node tools/_media_check.js');
}

module.exports = { VARIANTS, CELL, REACH, headless, cookPlaces, liftPage, pageHash, shapeOfBuilt, clean, islandWorld, composeVariant, cookRaster, encodeCell, cellError, cook, manifestIsland, cellStem, fixturePath, OUT };
if (require.main === module) main();
