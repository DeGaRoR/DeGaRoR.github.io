#!/usr/bin/env node
// city_cook.js — THE COOKED TOWN (CITY-A, G3400-G3414; futureDesigns/CITY-2.0-PLAN-2026-10-20.md, the format:
// futureDesigns/CITY-PACK-FORMAT.md). A sibling of premises_cook.js and town_kit.js, downstream of both: it reads their
// COMMITTED outputs (the town variant's places cook, the kit pack and its instance table) and the composed record, and
// writes one pack per sown town, cut in 512 m cells of the world:
//   FAR   one static merged mesh a cell, built here (walls + roofs: the kit archetypes' far shells and the uniques' boxes;
//         roads: the town's ribbons; lots: the plots' ground) - 12 B a vertex, quantized in the cell's box, vertex colour
//         = the finish's albedo mean (the G559 rule, the gain the runtime's), two draws a cell
//   NEAR  the kit rows (a TKIN instance file, WORLD frame, townkit.js decodeInstances reads it as is), the props (20 B a
//         row: the places cook's own placements), the uniques (the landmarks: the unique path near)
// A page with the town OFF (PREMISES_GEN.TOWN_OFF) fetches none of it; nothing the town-OFF record keeps is in it.
//
//   node tools/city_cook.js --island jolene --report     # cook in memory, measure, write nothing
//   node tools/city_cook.js --island jolene              # cook into media/city/<island>/<town>/ + src/core/city_packs.json
//
// DETERMINISTIC: no clock, no random, every list sorted before it is written; gzip level 9, mtime 0; a cell whose raw
// bytes are unchanged keeps its shipped gzip (premises_cook keepShipped's rule) - a re-cook of an unchanged town writes
// nothing. GATE CITYCOOK (tools/_citycook_check.js) holds the committed pack to a fresh cook.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'core', 'city_packs.json');
const PACKS = path.join(ROOT, 'src', 'core', 'premises_packs.json');
const KIT_MAN = path.join(ROOT, 'src', 'core', 'townkit_pack.json');
const V = 1;
const MAGIC = 0x59544943;            // 'CITY'
const S = 512;                       // the city cell, world metres (2 x 2 stream cells of render_premises LIVE_CELL)
const VSTRIDE = 12, PSTRIDE = 20, INST = 32;
// the distances the cook assumed - the host reads them from the manifest (CITY-PACK-FORMAT §6)
const LOD = { nearIn: 950, nearOut: 1050, kitE0: 150, kitE1: 1200, propFar: 600, castFar: 600, farGain: 0.2 };
const LIFT = { roads: 0.15, lots: 0.08 };
const ROAD_STEP = 8, LOT_EDGE = 8;
const BUCKETS = ['walls', 'roofs', 'roads', 'lots'];
const UP = [0, 1, 0];               // the ground buckets' normal: draped, flat-coloured, shared vertices (no facets)
// the sown towns: a record prefix on Jolene's zones, cooked from the variant that composes them
const TOWNS = [{ id: 'metlakatla', island: 'jolene', prefix: 'mk_', variant: 'town', base: 'default' }];

// THE MEANS: each scanned set's albedo mean, the 4 x 4 box mean of its shipped _diff map in sRGB bytes (what
// render_premises meanOf draws its canvas to), measured once (PIL, BOX filter) - keyed by the FILE so a re-shot texture
// shows as stale (GATE CITYCOOK: every file named here exists). 'g:' = a ground map (media/tex/ground).
const MEANS = {
  bark: ['bark_diff_256.5ca7f47f.jpg', 139, 121, 79], board: ['board_diff_512.3ce5558b.jpg', 88, 47, 12],
  boxprof: ['boxprof_diff_1k.5fcf796f.jpg', 106, 38, 23], brownwood: ['brownwood_diff_512.1525f1ad.jpg', 144, 121, 95],
  concrete: ['concrete_diff_1k.3790bb7c.jpg', 79, 67, 54], concretec: ['concretec_diff_1k.c88d00ba.jpg', 95, 85, 73],
  corrrust: ['corrrust_diff_1k.603509c0.jpg', 87, 41, 24], corrworn: ['corrworn_diff_1k.8bb5af63.jpg', 120, 119, 116],
  darkwood: ['darkwood_diff_512.94cd2a26.jpg', 53, 46, 37], deckwood: ['deckwood_diff_512.cde8704e.jpg', 110, 52, 14],
  endgrain: ['endgrain_diff_512.1480e59c.jpg', 118, 97, 72], feverbark: ['feverbark_diff_256.406b9c10.jpg', 80, 83, 57],
  galv: ['galv_diff_256.3f02ba2a.jpg', 115, 116, 116], greenwood: ['greenwood_diff_512.e71a8488.jpg', 91, 108, 96],
  greywood: ['greywood_diff_512.ae643c55.jpg', 80, 67, 58], mossy: ['mossy_diff_512.fae026ea.jpg', 97, 111, 36],
  paintwood: ['paintwood_diff_512.b2991f90.jpg', 85, 101, 102], render: ['render_diff_512.acb6938e.jpg', 131, 111, 86],
  rough: ['rough_diff_512.a05ceb5c.jpg', 106, 98, 87], roughwood: ['roughwood_diff_512.1236f9aa.jpg', 109, 103, 48],
  rust: ['rust_diff_512.5658a31a.jpg', 98, 57, 32], shakes: ['shakes_diff_512.9269babd.jpg', 85, 78, 65],
  shingle: ['shingle_diff_1k.b3d380b8.jpg', 87, 86, 82], stain: ['stain_diff_512.bd4e8765.jpg', 20, 17, 6],
  steelgrey: ['steelgrey_diff_512.3f023e20.jpg', 154, 139, 130], steelrust: ['steelrust_diff_512.9e81baee.jpg', 112, 65, 40],
  veneer: ['veneer_diff_256.863751b2.jpg', 227, 212, 185], veneerdark: ['veneerdark_diff_256.64d891e6.jpg', 137, 126, 114],
  veneerpale: ['veneerpale_diff_256.99593336.jpg', 194, 156, 110], veneerwarm: ['veneerwarm_diff_256.89ae0dc3.jpg', 169, 137, 114],
  wornwood: ['wornwood_diff_512.9a8f5894.jpg', 96, 75, 57],
  'g:asphalt': ['asphalt_diff_512.97b52f47.jpg', 90, 90, 85], 'g:concreteA': ['concreteA_diff_512.46078ce4.jpg', 73, 59, 46],
  'g:dirtG': ['dirtG_diff_512.b598cc70.jpg', 99, 82, 63], 'g:grassG': ['grassG_diff_512.1188e448.jpg', 110, 96, 62],
  'g:gravelG': ['gravelG_diff_512.520a980c.jpg', 146, 131, 104], 'g:sandC': ['sandC_diff_512.c491fcd1.jpg', 94, 84, 64],
};
const meanFile = k => (k.startsWith('g:') ? 'media/tex/ground/' : 'media/tex/house/') + MEANS[k][0];
// the sets whose map is a pale base under the house's paint (house_tex.js: a `paint` map) - the palette names the colour
// you GET (_house_gen.js paintHex), so a painted face's far colour is the palette's
const PAINTABLE = new Set(['boxprof', 'paintwood', 'greenwood', 'board', 'darkwood', 'veneer', 'veneerdark', 'veneerwarm', 'veneerpale', 'render']);
// a road's surface (27_premises SURFACE) -> its ground map; a lot's ground (a yard: half gravel, half grass) -> the mean of two
const ROAD_MAP = { 5: 'g:asphalt', 6: 'g:gravelG', 7: 'g:sandC' };
const LOT_MAPS = ['g:dirtG', 'g:grassG'];
const NEUTRAL = { wall: [128, 120, 108], roof: [84, 84, 82] };

// ---------------------------------------------------------------------------------------------------------------
// the small helpers
// ---------------------------------------------------------------------------------------------------------------
const sha16 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
const r3 = v => Math.round(v * 1000) / 1000;
const byId = (a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const cellOf = (x, z) => [Math.floor(x / S), Math.floor(z / S)];
const keyOf = (i, j) => i + ',' + j;
const stemOf = (i, j) => 'c_' + (i < 0 ? 'm' + (-i) : i) + '_' + (j < 0 ? 'm' + (-j) : j);
function colsHex() {
  // HOUSE_GEN.COLS, read off the generator's text (the cook needs no generator): [name, 0xRRGGBB]
  const src = fs.readFileSync(path.join(ROOT, 'tools', '_house_gen.js'), 'utf8');
  const a = src.indexOf('const COLS = ['), b = src.indexOf('];', a);
  const out = [], re = /\['([^']+)', 0x([0-9a-fA-F]{6})\]/g;
  let m; const blk = src.slice(a, b);
  while ((m = re.exec(blk))) out.push(parseInt(m[2], 16));
  if (out.length < 2) throw new Error('city_cook: no HOUSE_GEN COLS in tools/_house_gen.js');
  return out;
}
const hexRGB = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const meanRGB = k => (MEANS[k] ? MEANS[k].slice(1, 4) : null);
const mix = (a, b) => [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), Math.round((a[2] + b[2]) / 2)];
// a face's far colour: the palette where the set takes paint and the house is painted, else the set's mean
function faceRGB(set, col, COLS, dflt) {
  if (col > 0 && col < COLS.length && (!set || PAINTABLE.has(set))) return hexRGB(COLS[col]);
  return meanRGB(set) || dflt;
}
function octEnc(x, y, z) {   // town_kit.js octEnc, line for line (townkit.js octDec reads it)
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let u = x / s, v = z / s;
  if (y < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
  const q = t => Math.max(-127, Math.min(127, Math.round(t * 127)));
  return [q(u), q(v)];
}

// ---------------------------------------------------------------------------------------------------------------
// THE INPUTS: the committed cooks (places, kit) and the composed record
// ---------------------------------------------------------------------------------------------------------------
const gunz = f => zlib.gunzipSync(fs.readFileSync(path.join(ROOT, f)));
function placesOf(island, variant) {
  const P = JSON.parse(fs.readFileSync(PACKS, 'utf8'));
  const I = (P.islands || []).find(w => w.id === island);
  if (!I || !I.places || !I.places.variants[variant]) throw new Error('city_cook: no places cook for ' + island + '/' + variant + ' in premises_packs.json');
  const Vr = I.places.variants[variant], things = [];
  for (const c of Vr.cells) for (const t of JSON.parse(gunz(c.src).toString('utf8')).things) things.push(t);
  return { hash: Vr.hash, things, page: I.places.page, fixture: I.fixture };
}
let KIT = null;
function kitOf() {
  if (KIT) return KIT;
  const man = JSON.parse(fs.readFileSync(KIT_MAN, 'utf8'));
  const TK = require(path.join(ROOT, 'src', 'viewer', 'townkit.js'));
  const pk = gunz(man.pack.src), P = TK.decodePack(pk);
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, man.pack.src))).digest('hex') !== man.pack.sha256) throw new Error('city_cook: the kit pack is not the one townkit_pack.json names');
  const H = P.header, BAGS = H.bags;
  // each archetype's lod-1 positions and roles (the far shell is measured on them)
  const TKA = require(path.join(ROOT, 'tools', 'town_kit.js'));
  const lods = H.archetypes.map(a => {
    const m = a.lods[1], at = r => pk.slice(P.base + r[0], P.base + r[0] + r[1]);
    return TKA.decodeLod(m, at(m.vb), at(m.ib), at(m.wb), BAGS);
  });
  // the archetypes as town_kit.js assign / fits read them (the lod-0 box is the pack's own quantization box)
  const archList = H.archetypes.map(a => ({ id: a.id, split: a.split, kind: a.src && a.src.kind, foot: a.foot, P: a.P, roofKind: a.roofKind,
    bbox: a.lods[0].pos.min.concat(a.lods[0].pos.max) }));
  KIT = { man, TK, H, BAGS, lods, archList, shells: H.archetypes.map((a, i) => shellOf(a, lods[i], BAGS)), tables: new Map() };
  return KIT;
}
function tableOf(island) {
  const K = kitOf();
  if (K.tables.has(island)) return K.tables.get(island);
  const it = (K.man.instances || []).find(x => x.id === island);
  if (!it) throw new Error('city_cook: no kit instance table for ' + island);
  const raw = gunz(it.src), T = K.TK.decodeInstances(raw);
  const out = { raw, hash: sha16(raw), head: T.head, rows: T.rows };
  K.tables.set(island, out);
  return out;
}
let COMPOSED = new Map();
function composedOf(T) {
  const k = T.island + '|' + T.variant;
  if (COMPOSED.has(k)) return COMPOSED.get(k);
  const PC = require(path.join(ROOT, 'tools', 'premises_cook.js'));
  const Vv = PC.VARIANTS.find(v => v.name === T.variant);
  const fixtureText = fs.readFileSync(PC.fixturePath(T.island), 'utf8');
  const { O, rec } = PC.composeVariant(T.island, Vv, fixtureText);
  const PG = PC.headless().PG;
  // the base variant's record (the town OFF): its roads are not the town's
  const Vb = PC.VARIANTS.find(v => v.name === T.base);
  const baseRec = PC.dropOf(PG, PG.unwrap(fixtureText).rec, Vb);
  const baseRoads = new Set(((baseRec.layers && baseRec.layers.roads) || []).map(r => String(r.id)));
  const C = { O, rec, PG, fixture: sha16(fixtureText), record: sha16(JSON.stringify(O.rec)), baseRoads, TOWN_OFF: PG.TOWN_OFF };
  COMPOSED.set(k, C);
  return C;
}

// ---------------------------------------------------------------------------------------------------------------
// THE FAR SHELL of an archetype: walls to the eave on the footprint, the roof as its family's prism - measured on its
// lod-1 roof, in its own frame (x along the ridge: L; z across: w; y up from the ground plane under the high corner)
// ---------------------------------------------------------------------------------------------------------------
const ROOF_ROLES = ['roof', 'roof2', 'roof3', 'rib'];
function shellOf(a, L1, BAGS) {
  const P = a.P, Lh = a.foot.L / 2, Wh = a.foot.w / 2;
  const roof = new Set(ROOF_ROLES.map(k => BAGS.indexOf(k)).filter(i => i >= 0));
  let ry0 = Infinity, ry1 = -Infinity, rx0 = Infinity, rx1 = -Infinity, rz0 = Infinity, rz1 = -Infinity;
  for (let i = 0; i < L1.role.length; i++) {
    if (!roof.has(L1.role[i])) continue;
    const x = L1.pos[i * 3], y = L1.pos[i * 3 + 1], z = L1.pos[i * 3 + 2];
    // the main roof only: what stands over the house's own plan (a porch's or a lean-to's roof is lower and outside)
    if (Math.abs(x) > Lh + 1.2 || Math.abs(z) > Wh + 1.2) continue;
    if (y < ry0) ry0 = y; if (y > ry1) ry1 = y;
    if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (z < rz0) rz0 = z; if (z > rz1) rz1 = z;
  }
  const eave0 = (P.floorY || 0) + Math.max(1, Math.round(P.storeys || 1)) * (P.floorH || 2.7);
  if (!isFinite(ry1)) { ry0 = eave0; ry1 = eave0 + 1; rx0 = -Lh; rx1 = Lh; rz0 = -Wh; rz1 = Wh; }
  const ridge = Math.max(ry1, eave0 + 0.3);
  const eave = Math.min(Math.max(eave0, ry0), ridge - 0.3);
  // where the ridge runs (its z): the mean z of the roof's top vertices
  let zs = 0, zn = 0;
  for (let i = 0; i < L1.role.length; i++) {
    if (!roof.has(L1.role[i])) continue;
    const x = L1.pos[i * 3], y = L1.pos[i * 3 + 1], z = L1.pos[i * 3 + 2];
    if (Math.abs(x) > Lh + 1.2 || Math.abs(z) > Wh + 1.2 || y < ridge - 0.2) continue;
    zs += z; zn++;
  }
  const zr = zn ? zs / zn : 0;
  const fam = a.klass ? a.klass.fam : 'gable';
  const kind = fam === 'hip' ? 'hip' : (fam === 'shed' || Math.abs(zr) > 0.35 * a.foot.w) ? 'shed' : 'gable';
  return { kind, Lh, Wh, eave: r3(eave), ridge: r3(ridge), zr: kind === 'shed' ? (zr >= 0 ? Wh : -Wh) : r3(Math.max(-Wh * 0.8, Math.min(Wh * 0.8, zr))),
           rx: [r3(Math.min(rx0, -Lh)), r3(Math.max(rx1, Lh))], rz: [r3(Math.min(rz0, -Wh)), r3(Math.max(rz1, Wh))] };
}
// the shell's faces in its own frame: [bucket, outward normal, points] (a point: [x, y, z, ground corner index | -1])
// a ground corner index puts the point on the instance's own ground at that corner (the stance's corner, row.ground)
function shellFaces(sh) {
  const { Lh, Wh, eave, ridge, zr, kind } = sh, F = [];
  const top = z => (kind === 'shed' ? eave + (ridge - eave) * (z - -zr) / (2 * zr) : eave);   // shed: eave at -zr, ridge at +zr
  // corners: 0 (-L,-w) 1 (+L,-w) 2 (+L,+w) 3 (-L,+w) (town_kit.js INST's order)
  const C = [[-Lh, -Wh, 0], [Lh, -Wh, 1], [Lh, Wh, 2], [-Lh, Wh, 3]];
  const wall = (a, b, n) => F.push([0, n, [[a[0], null, a[1], a[2]], [b[0], null, b[1], b[2]], [b[0], top(b[1]), b[1], -1], [a[0], top(a[1]), a[1], -1]]]);
  wall(C[3], C[2], [0, 0, 1]); wall(C[1], C[0], [0, 0, -1]); wall(C[2], C[1], [1, 0, 0]); wall(C[0], C[3], [-1, 0, 0]);
  const [x0, x1] = sh.rx, [z0, z1] = sh.rz;
  if (kind === 'gable') {
    F.push([0, [1, 0, 0], [[Lh, eave, Wh, -1], [Lh, eave, -Wh, -1], [Lh, ridge, zr, -1]]]);
    F.push([0, [-1, 0, 0], [[-Lh, eave, -Wh, -1], [-Lh, eave, Wh, -1], [-Lh, ridge, zr, -1]]]);
    F.push([1, [0, 1, -1], [[x0, eave, z0, -1], [x0, ridge, zr, -1], [x1, ridge, zr, -1], [x1, eave, z0, -1]]]);
    F.push([1, [0, 1, 1], [[x1, eave, z1, -1], [x1, ridge, zr, -1], [x0, ridge, zr, -1], [x0, eave, z1, -1]]]);
  } else if (kind === 'shed') {
    const lo = zr > 0 ? z0 : z1, hi = zr > 0 ? z1 : z0;
    F.push([1, [0, 1, 0], [[x0, eave, lo, -1], [x0, ridge, hi, -1], [x1, ridge, hi, -1], [x1, eave, lo, -1]]]);
  } else {
    const hr = Math.max(0, (x1 - x0) / 2 - (z1 - z0) / 2), xm = (x0 + x1) / 2;
    const ra = [xm - hr, ridge, 0, -1], rb = [xm + hr, ridge, 0, -1];
    F.push([1, [0, 1, -1], [[x0, eave, z0, -1], ra, rb, [x1, eave, z0, -1]]]);
    F.push([1, [0, 1, 1], [[x1, eave, z1, -1], rb, ra, [x0, eave, z1, -1]]]);
    F.push([1, [1, 1, 0], [[x1, eave, z0, -1], rb, [x1, eave, z1, -1]]]);
    F.push([1, [-1, 1, 0], [[x0, eave, z1, -1], ra, [x0, eave, z0, -1]]]);
  }
  return F;
}

// ---------------------------------------------------------------------------------------------------------------
// THE CELL BUILDER: buckets of world triangles, then quantized
// ---------------------------------------------------------------------------------------------------------------
function newCell(i, j) {
  return { i, j, key: keyOf(i, j), tri: [[], [], [], []], plots: [], uniques: [], objects: [], kit: [], kitPlots: [], props: [] };
}
// a convex polygon of world points (CCW from outside) into a bucket: its own flat normal unless one is given
function pushPoly(cell, b, pts, rgb, nrm) {
  let n = nrm;
  if (!n) {
    const [a, c, d] = [pts[0], pts[1], pts[2]];
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  }
  const l = Math.hypot(n[0], n[1], n[2]); if (!(l > 1e-12)) return;
  n = [n[0] / l, n[1] / l, n[2] / l];
  for (let k = 1; k + 1 < pts.length; k++) cell.tri[b].push([pts[0], pts[k], pts[k + 1], n, rgb]);
}
// orient a polygon so its winding faces `out` (a world direction): CCW seen from there
function facing(pts, out) {
  const [a, c, d] = [pts[0], pts[1], pts[2]];
  const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  return n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? pts.slice().reverse() : pts;
}
function encodeFar(cell) {
  const tris = [].concat(...cell.tri);
  if (!tris.length) return { box: null, vb: Buffer.alloc(0), ib: Buffer.alloc(0), verts: 0, tris: 0, index: 16, buckets: BUCKETS.map((name, id) => ({ name, id, first: 0, count: 0 })), draws: [] };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) { const v = t[k][a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  const box = [Math.floor(lo[0] * 100) / 100, Math.floor(lo[1] * 100) / 100, Math.floor(lo[2] * 100) / 100,
               Math.ceil(hi[0] * 100) / 100, Math.ceil(hi[1] * 100) / 100, Math.ceil(hi[2] * 100) / 100];
  for (let a = 0; a < 3; a++) if (box[a + 3] - box[a] < 0.01) box[a + 3] = r3(box[a] + 0.01);
  const q = (v, a) => Math.max(0, Math.min(65535, Math.round((v - box[a]) / (box[a + 3] - box[a]) * 65535)));
  // vertices shared within a bucket where position, normal and colour quantize alike
  const verts = [], vmap = new Map(), idx = [], buckets = [];
  for (let b = 0; b < 4; b++) {
    const first = idx.length;
    for (const t of cell.tri[b]) {
      const on = octEnc(t[3][0], t[3][1], t[3][2]);
      for (let k = 0; k < 3; k++) {
        const p = t[k], rec = [q(p[0], 0), q(p[1], 1), q(p[2], 2), on[0], on[1], t[4][0], t[4][1], t[4][2], b];
        const key = rec.join(',');
        let n = vmap.get(key);
        if (n === undefined) { n = verts.length; vmap.set(key, n); verts.push(rec); }
        idx.push(n);
      }
    }
    buckets.push({ name: BUCKETS[b], id: b, first, count: idx.length - first });
  }
  const vb = Buffer.alloc(verts.length * VSTRIDE);
  verts.forEach((r, n) => {
    const o = n * VSTRIDE;
    vb.writeUInt16LE(r[0], o); vb.writeUInt16LE(r[1], o + 2); vb.writeUInt16LE(r[2], o + 4);
    vb.writeInt8(r[3], o + 6); vb.writeInt8(r[4], o + 7);
    vb[o + 8] = r[5]; vb[o + 9] = r[6]; vb[o + 10] = r[7]; vb[o + 11] = r[8];
  });
  const wide = verts.length > 65535, ib = Buffer.alloc(idx.length * (wide ? 4 : 2));
  idx.forEach((v, n) => (wide ? ib.writeUInt32LE(v, n * 4) : ib.writeUInt16LE(v, n * 2)));
  const draws = [];
  const shell = buckets[0].count + buckets[1].count, ground = buckets[2].count + buckets[3].count;
  if (shell) draws.push({ mat: 'shell', first: 0, count: shell });
  if (ground) draws.push({ mat: 'ground', first: shell, count: ground });
  return { box, vb, ib, verts: verts.length, tris: idx.length / 3, index: wide ? 32 : 16, buckets, draws };
}

// ---------------------------------------------------------------------------------------------------------------
// THE PIECES: a kit row's shell, a unique's box, a road's ribbon, a lot's ground
// ---------------------------------------------------------------------------------------------------------------
// the kit row's transform (townkit.js host: compose((x, y, z), rotY(yaw), (scale, 1, 1)) on the mirrored copy)
function rowXform(r) {
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw), sx = (r.mirror ? -1 : 1) * r.scale;
  return {
    p: (x, y, z) => { const lx = x * sx; return [r.x + lx * c + z * s, r.y + y, r.z - lx * s + z * c]; },
    d: (x, y, z) => { const lx = x * (r.mirror ? -1 : 1); return [lx * c + z * s, y, -lx * s + z * c]; },
  };
}
function addShell(cell, r, sh, wallRGB, roofRGB) {
  const X = rowXform(r);
  // the ground corners are in the archetype's frame after the mirror (town_kit.js assign): corner k sits where the
  // DRAWN geometry's sign pattern is k's, so a mirrored row reads the corner of the flipped x
  const cornerAt = (x, z) => { const fx = r.mirror ? -x : x; return fx < 0 ? (z < 0 ? 0 : 3) : (z < 0 ? 1 : 2); };
  for (const [b, out, pts] of shellFaces(sh)) {
    const w = pts.map(p => (p[1] === null ? X.p(p[0], Math.min(0, r.ground[cornerAt(p[0], p[2])]), p[2]) : X.p(p[0], p[1], p[2])));
    pushPoly(cell, b, facing(w, X.d(out[0], out[1], out[2])), b === 0 ? wallRGB : roofRGB);
  }
}
// a placed thing's obstacle shape (premises_cook shapeOfBuilt) as a box: the occupied cells' extent in its own frame,
// stood at `at`, its foot on the composed ground, its top at 85 % of the shape's (the G594 box)
function addBox(cell, at, shape, O, wallRGB, roofRGB) {
  if (!shape || !shape.hi) return false;
  let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
  for (let k = 0; k < shape.hi.length; k++) {
    if (shape.hi[k] === null) continue;
    const i = k % shape.nx, j = Math.floor(k / shape.nx);
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  if (!isFinite(i0)) return false;
  const x0 = shape.ox + i0 * shape.cell, x1 = shape.ox + (i1 + 1) * shape.cell, z0 = shape.oz + j0 * shape.cell, z1 = shape.oz + (j1 + 1) * shape.cell;
  const c = Math.cos(at[3]), s = Math.sin(at[3]);
  const W = (x, z) => [at[0] + x * c + z * s, at[2] - x * s + z * c];
  const top = at[1] + 0.85 * shape.top / 1000;
  const foot = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(p => { const w = W(p[0], p[1]); return [w[0], Math.min(top - 0.5, O.terrainAt(w[0], w[1])), w[1]]; });
  const up = foot.map(p => [p[0], top, p[2]]);
  const dir = (x, z) => [x * c + z * s, 0, -x * s + z * c];
  const sides = [[0, 1, [0, 0, -1]], [1, 2, [1, 0, 0]], [2, 3, [0, 0, 1]], [3, 0, [-1, 0, 0]]];
  for (const [a, b, n] of sides) pushPoly(cell, 0, facing([foot[a], foot[b], up[b], up[a]], dir(n[0], n[2])), wallRGB);
  pushPoly(cell, 1, facing(up, [0, 1, 0]), roofRGB);
  return true;
}
// ear clipping on a simple 2-D polygon (x, z): triangles as index triples, CCW in (x, z)
function earClip(P) {
  const n = P.length; if (n < 3) return [];
  let A = 0; for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
  const V = []; for (let k = 0; k < n; k++) V.push(A > 0 ? k : n - 1 - k);
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => cr(a, b, p) >= 0 && cr(b, c, p) >= 0 && cr(c, a, p) >= 0;
  const out = [];
  let guard = 0;
  while (V.length > 3 && guard++ < 4 * n * n) {
    let cut = false;
    for (let k = 0; k < V.length; k++) {
      const ia = V[(k + V.length - 1) % V.length], ib = V[k], ic = V[(k + 1) % V.length];
      const a = P[ia], b = P[ib], c = P[ic];
      if (cr(a, b, c) <= 1e-12) continue;
      let ear = true;
      for (const m of V) { if (m === ia || m === ib || m === ic) continue; if (inside(P[m], a, b, c)) { ear = false; break; } }
      if (!ear) continue;
      out.push([ia, ib, ic]); V.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (V.length === 3) out.push([V[0], V[1], V[2]]);
  return out;
}
// a lot: the plot's polygon, ear-clipped, each triangle split so no edge passes LOT_EDGE, draped on the ground + the lift.
// (x, z) CCW in the plane is clockwise seen from +y (z runs south): the triangles are wound to face up
function addLot(cell, poly, O, rgb) {
  const T = earClip(poly);
  const at = (x, z) => [x, O.terrainAt(x, z) + LIFT.lots, z];
  for (const t of T) {
    const [a, b, c] = t.map(k => poly[k]);
    const e = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1]));
    const n = Math.max(1, Math.min(8, Math.ceil(e / LOT_EDGE)));
    const P = (u, v) => at(a[0] + (b[0] - a[0]) * u / n + (c[0] - a[0]) * v / n, a[1] + (b[1] - a[1]) * u / n + (c[1] - a[1]) * v / n);
    for (let u = 0; u < n; u++) for (let v = 0; u + v < n; v++) {
      pushPoly(cell, 3, facing([P(u, v), P(u + 1, v), P(u, v + 1)], [0, 1, 0]), rgb, UP);
      if (u + v + 1 < n) pushPoly(cell, 3, facing([P(u + 1, v), P(u + 1, v + 1), P(u, v + 1)], [0, 1, 0]), rgb, UP);
    }
  }
}
// a road: resampled every ROAD_STEP along its polyline, a ribbon of its width; each quad to the cell of its midpoint
function roadQuads(road, O) {
  const pts = road.pts.map(p => O.frame.toWorld(p[0], p[1]));
  const S0 = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / ROAD_STEP));
    for (let m = k ? 1 : 0; m <= n; m++) S0.push([a[0] + (b[0] - a[0]) * m / n, a[1] + (b[1] - a[1]) * m / n]);
  }
  const hw = (road.w || 4) / 2, side = [];
  for (let k = 0; k < S0.length; k++) {
    const p = S0[Math.max(0, k - 1)], q = S0[Math.min(S0.length - 1, k + 1)];
    let tx = q[0] - p[0], tz = q[1] - p[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const L = [S0[k][0] - tz * hw, S0[k][1] + tx * hw], R = [S0[k][0] + tz * hw, S0[k][1] - tx * hw];
    side.push([[L[0], O.terrainAt(L[0], L[1]) + LIFT.roads, L[1]], [R[0], O.terrainAt(R[0], R[1]) + LIFT.roads, R[1]]]);
  }
  const quads = [];
  for (let k = 0; k + 1 < side.length; k++) {
    const m = [(S0[k][0] + S0[k + 1][0]) / 2, (S0[k][1] + S0[k + 1][1]) / 2];
    quads.push({ mid: m, pts: [side[k][0], side[k][1], side[k + 1][1], side[k + 1][0]] });
  }
  return quads;
}

// ---------------------------------------------------------------------------------------------------------------
// THE TOWN
// ---------------------------------------------------------------------------------------------------------------
const toWorldAt = (at, p) => { const c = Math.cos(at[3]), s = Math.sin(at[3]); return [at[0] + p.x * c + p.z * s, at[1] + (p.y || 0), at[2] - p.x * s + p.z * c, (p.ry || 0) + at[3]]; };
const WATER_KEY = /boat|float|pier|dock|jetty|skiff|canoe|kayak/i;
function cookTown(T, opt) {
  opt = opt || {};
  const K = kitOf(), TB = tableOf(T.island), C = composedOf(T), O = C.O, COLS = colsHex();
  const PL = placesOf(T.island, T.variant), BASE = placesOf(T.island, T.base);
  const baseIds = new Set(BASE.things.map(t => String(t.id)));
  const pre = new RegExp('^' + T.prefix.replace(/[^a-z0-9_]/gi, ''));
  const H = K.H, archN = H.archetypes.length;
  const outArch = new Map(); H.archetypes.forEach((a, i) => { if (a.split === 'out' && a.src && a.src.kind) outArch.set(a.src.kind, i); });
  const roleSet = (role, idx) => { const l = H.roleSets[role] || []; return l[Math.max(0, Math.min(l.length - 1, Math.round(idx || 0)))]; };
  // the town's things: the variant's, less the town-OFF record's (CITY-PACK-FORMAT §9)
  const things = PL.things.filter(t => !baseIds.has(String(t.id))).sort((a, b) => byId(a.id, b.id));
  const recPlots = new Map(O.records.plots.filter(p => pre.test(String(p.zone)) && !baseIds.has(String(p.id))).map(p => [String(p.id), p]));
  // the kit table's rows, by plot (C3c's rule: a row only for the plot it was sown from - its seed)
  const kitHouse = new Map(), kitOut = new Map();
  TB.rows.forEach(r => { if (r.plot === null) return; (r.out ? kitOut : kitHouse).set(String(r.plot), r); });
  const cells = new Map(), cellAt = (x, z) => { const [i, j] = cellOf(x, z), k = keyOf(i, j); let c = cells.get(k); if (!c) cells.set(k, c = newCell(i, j)); return c; };
  const stats = { plots: 0, kitPlots: 0, assigned: 0, uniquePlots: 0, outsKit: 0, outsPlaced: 0, outsDropped: 0, items: 0, objects: 0, props: 0, roads: 0, unshaped: 0, missingPlots: [] };
  const lotRGB = mix(meanRGB(LOT_MAPS[0]), meanRGB(LOT_MAPS[1]));
  const propKeys = new Set();
  const propRow = (cell, w, key, owner, flags, kind) => { propKeys.add(key); cell.props.push({ x: w[0], y: w[1], z: w[2], yaw: w[3], key, owner, flags, kind }); };
  const toW = r => { const w = O.frame.toWorld(r.x, r.z); return Object.assign({}, r, { x: w[0], z: w[1], yaw: r.yaw + (O.frame.yaw || 0) }); };
  // the corners' ground under a kit archetype stood at (x, z, yaw) - town_kit.js assign's rule on the composed ground
  const standOut = (ai, at) => {
    const A = H.archetypes[ai], L = A.foot.L, w = A.foot.w, c = Math.cos(at[3]), s = Math.sin(at[3]);
    const g = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => { const lx = q[0] * L / 2, lz = q[1] * w / 2; return O.terrainAt(at[0] + lx * c + lz * s, at[2] - lx * s + lz * c); });
    const y = Math.max(...g);
    return { y, ground: g.map(v => v - y) };
  };
  // A ROW FOR A PLOT THE TABLE DOES NOT KNOW: town_kit.js assign (the fit, the nudge, the mirror, the stretch, the finish)
  // on the places cook's house - its P as sampled, where it stands (the premises frame), the composed ground under it
  const TKA = require(path.join(ROOT, 'tools', 'town_kit.js'));
  const assignRow = t => {
    const hs = t.house, w0 = O.frame.toWorld(hs.x, hs.z), dy = O.frame.yaw || 0;
    const ground = (lx, lz) => {   // the house frame's (lx, lz) -> the composed ground, relative to the house's y
      const c = Math.cos(hs.yaw), s = Math.sin(hs.yaw), px = hs.x + lx * c + lz * s, pz = hs.z - lx * s + lz * c, w = O.frame.toWorld(px, pz);
      return O.terrainAt(w[0], w[1]) - hs.y;
    };
    const pick = t.plot.pick && t.plot.pick !== 'sampler' ? t.plot.pick : null;
    const s0 = { plot: t.plot, P: hs.P, preset: pick, house: { x: hs.x, z: hs.z, y: hs.y, yaw: hs.yaw, ground } };
    const rows = TKA.assign({ houses: [s0], outs: [] }, K.archList, H.finishSets);
    const r = rows[0];
    if (!r || !r.a) return null;
    const w = O.frame.toWorld(r.x, r.z);
    return { x: w[0], y: r.y, z: w[1], yaw: r.yaw + dy, arch: r.a.id, mirror: !!r.mirror, finish: Math.max(0, r.finish), wallCol: Math.round(hs.P.wallCol || 0) & 255,
             trimCol: Math.round(hs.P.trimCol || 0) & 255, roofCol: Math.round(hs.P.roofCol || 0) & 255, weather: hs.P.weather || 0, dirt: hs.P.dirt || 0,
             lights: hs.P.lights ? (hs.P.winLit || 0) : 0, scale: r.scale, flags: r.flags & 255, ground: r.ground };
  };
  for (const t of things) {
    if (t.kind === 'house') {
      const id = String(t.id), p = recPlots.get(id);
      if (!p) { stats.missingPlots.push(id); continue; }
      const anchor = t.at ? [t.at[0], t.at[2]] : (() => { const q = t.plot.poly; let x = 0, z = 0; for (const v of q) { x += v[0]; z += v[1]; } return [x / q.length, z / q.length]; })();
      const cell = cellAt(anchor[0], anchor[1]);
      const pi = cell.plots.length;
      const kr = kitHouse.get(id), water = t.plot.side === 'water';
      // the table's row (C3c's rule: its plot and its seed); a plot the table was not sown from (the record moved on since:
      // a new road's plots) gets its row here, by the kit's own rule (town_kit.js assign) on the places cook's house
      let row = kr && kr.seed === p.seed && pre.test(String(p.zone)) ? toW(kr) : null, assigned = false;
      if (!row && pre.test(String(p.zone)) && t.house && t.house.P) { row = assignRow(t); assigned = !!row; }
      const isKit = !!row;
      let hRow = -1, oRow = -1;
      const Pz = (t.house && t.house.P) || {};
      if (isKit) {
        const r = row; r.flags = (r.flags | 8) & 255;
        if (assigned) stats.assigned++;
        hRow = cell.kit.length; cell.kit.push(r); cell.kitPlots.push([id, 0, p.seed]);
        const fs0 = H.finishSets[r.finish] || {};
        addShell(cell, r, K.shells[r.arch], faceRGB(roleSet('wall', fs0.wallSet), r.wallCol, COLS, NEUTRAL.wall), faceRGB(roleSet('roof', fs0.roofSet), r.roofCol, COLS, NEUTRAL.roof));
        stats.kitPlots++;
      } else {
        if (!addBox(cell, t.at, t.shape, O, faceRGB(roleSet('wall', Pz.wallSet), Pz.wallCol, COLS, NEUTRAL.wall), faceRGB(roleSet('roof', Pz.roofSet), Pz.roofCol, COLS, NEUTRAL.roof))) stats.unshaped++;
        stats.uniquePlots++;
      }
      // THE OUTBUILDING: the one the places cook planned (CITY-PACK-FORMAT §7); the table's row where it is that plan
      const po = t.plot.out;
      if (isKit && po && po.at && outArch.has(po.kind)) {
        const ko = kitOut.get(id), ai = outArch.get(po.kind);
        let r = null;
        if (ko && ko.arch === ai) {
          const w = toW(ko), dyaw = Math.abs(((w.yaw - po.at[3]) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
          if (Math.hypot(w.x - po.at[0], w.z - po.at[2]) <= 2 && dyaw < 0.1) { r = w; stats.outsKit++; }
        }
        if (!r) {
          const st = standOut(ai, po.at), OP = po.P || {};
          const fin = require(path.join(ROOT, 'tools', 'town_kit.js')).finishOf(OP, H.finishSets, H.archetypes[ai].roofKind);
          r = { x: po.at[0], y: st.y, z: po.at[2], yaw: po.at[3], arch: ai, mirror: false, finish: Math.max(0, fin), wallCol: Math.round(OP.wallCol || 0) & 255,
                trimCol: Math.round(OP.trimCol || 0) & 255, roofCol: Math.round(OP.roofCol || 0) & 255, weather: OP.weather || 0, dirt: OP.dirt || 0, lights: 0,
                scale: 1, flags: 1, ground: st.ground };
          stats.outsPlaced++;
        }
        r.flags = (r.flags | 1) & 255;
        if (K.shells[ai].ridge >= 3) r.flags |= 8;
        oRow = cell.kit.length; cell.kit.push(r); cell.kitPlots.push([id, 1, p.seed]);
        const fs1 = H.finishSets[r.finish] || {};
        addShell(cell, r, K.shells[ai], faceRGB(roleSet('wall', fs1.wallSet), r.wallCol, COLS, NEUTRAL.wall), faceRGB(roleSet('roof', fs1.roofSet), r.roofCol, COLS, NEUTRAL.roof));
        for (const q of po.props || []) propRow(cell, toWorldAt(po.at, q), q.k, pi, q.on === 'ground' ? 1 : 0, 5);
      } else if (!isKit && po && po.at) {
        addBox(cell, po.at, po.shape, O, faceRGB(roleSet('wall', (po.P || {}).wallSet), (po.P || {}).wallCol, COLS, NEUTRAL.wall), NEUTRAL.roof);
      } else if (isKit && kitOut.has(id)) stats.outsDropped++;
      cell.plots.push([id, p.seed, hRow, oRow, (isKit ? 1 : 2) | (water ? 4 : 0) | (assigned ? 8 : 0)]);
      // the lot's ground (a water plot's lot is its pier: none)
      if (!water && t.plot.poly && t.plot.poly.length >= 3) addLot(cell, t.plot.poly.map(v => [v[0], v[1]]), O, lotRGB);
      // the props: the house's own (its frame), the car, the boat
      if (t.at) for (const q of t.props || []) propRow(cell, toWorldAt(t.at, q), q.k, pi, (q.on === 'ground' ? 1 : 0) | (WATER_KEY.test(q.k) ? 4 : 0), WATER_KEY.test(q.k) ? 2 : 0);
      if (t.plot.car && t.plot.car.key) propRow(cell, [t.plot.car.x, t.plot.car.y, t.plot.car.z, t.plot.car.ry || 0], t.plot.car.key, pi, 1 | 2, 1);
      if (t.plot.boat && t.plot.boat.key) propRow(cell, [t.plot.boat.x, t.plot.boat.y, t.plot.boat.z, t.plot.boat.ry || 0], t.plot.boat.key, pi, 2 | 4, 2);
      stats.plots++;
    } else if (t.kind === 'item') {
      if (!t.at) continue;
      const cell = cellAt(t.at[0], t.at[2]), ui = cell.uniques.length, P = (t.item && t.item.P) || {};
      cell.uniques.push([String(t.id), String((t.item && t.item.gen) || ''), r3(t.at[0]), r3(t.at[1]), r3(t.at[2]), +t.at[3].toFixed(5)]);
      const wall = typeof P.wallTint === 'number' && P.wallTint > 0 ? hexRGB(P.wallTint) : NEUTRAL.wall;
      if (!addBox(cell, t.at, t.shape, O, wall, NEUTRAL.roof)) stats.unshaped++;
      for (const q of t.props || []) propRow(cell, toWorldAt(t.at, q), q.k, ui, q.on === 'ground' ? 1 : 0, 4);
      if (t.plan && t.plan.out && t.plan.out.at) addBox(cell, t.plan.out.at, t.plan.out.shape, O, wall, NEUTRAL.roof);
      stats.items++;
    } else if (t.kind === 'object') {
      if (!t.at || !t.ob || !t.ob.key) continue;
      const cell = cellAt(t.at[0], t.at[2]), oi = cell.objects.length;
      cell.objects.push([String(t.id), String(t.ob.key)]);
      propRow(cell, t.at, String(t.ob.key), oi, (t.ob.on === 'ground' ? 1 : 0) | 2, 3);
      stats.objects++;
    }
  }
  // THE ROADS: the composed roads of the town (its prefix, not the town-OFF record's), quad by quad
  const roads = O.roads.filter(r => pre.test(String(r.id)) && !C.baseRoads.has(String(r.id)) && r.pts && r.pts.length >= 2).sort((a, b) => byId(a.id, b.id));
  for (const rd of roads) {
    const rgb = meanRGB(ROAD_MAP[rd.surface] || 'g:dirtG');
    for (const q of roadQuads(rd, O)) pushPoly(cellAt(q.mid[0], q.mid[1]), 2, facing(q.pts, [0, 1, 0]), rgb, UP);
    stats.roads++;
  }
  // the prop keys, sorted: a prop row's u16 indexes this list
  const keys = Array.from(propKeys).sort(byId), kidx = new Map(keys.map((k, n) => [k, n]));
  // ---- each cell to bytes
  const out = [];
  for (const cell of Array.from(cells.values()).sort((a, b) => (a.i - b.i) || (a.j - b.j))) {
    const far = encodeFar(cell);
    // the kit section: a TKIN instance file, WORLD frame (town_kit.js instanceFile's layout; the rows town_kit.js encodeInstances')
    const kb = Buffer.alloc(cell.kit.length * INST);
    cell.kit.forEach((r, n) => {
      const o = n * INST, u8 = v => Math.max(0, Math.min(255, Math.round(v)));
      kb.writeFloatLE(r.x, o); kb.writeFloatLE(r.z, o + 4); kb.writeFloatLE(r.y, o + 8);
      const yaw = ((r.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      kb.writeUInt16LE(Math.round(yaw / (2 * Math.PI) * 65536) & 65535, o + 12);
      kb.writeUInt8((r.arch & 127) | (r.mirror ? 128 : 0), o + 14); kb.writeUInt8(r.finish & 255, o + 15);
      kb.writeUInt8(r.wallCol & 255, o + 16); kb.writeUInt8(r.trimCol & 255, o + 17); kb.writeUInt8(r.roofCol & 255, o + 18);
      kb.writeUInt8(u8(r.weather * 255), o + 19); kb.writeUInt8(u8(r.dirt * 255), o + 20); kb.writeUInt8(u8(r.lights * 255), o + 21);
      kb.writeInt8(Math.max(-127, Math.min(127, Math.round((r.scale - 1) * 500))), o + 22); kb.writeUInt8(r.flags & 255, o + 23);
      for (let k = 0; k < 4; k++) kb.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r.ground[k] * 100))), o + 24 + k * 2);
    });
    const khead = Buffer.from(JSON.stringify({ magic: 'TKIN', v: 1, stride: INST, pack: K.man.pack.sha256, frame: 'world', count: cell.kit.length, plots: cell.kitPlots }));
    const kpre = Buffer.alloc(8); kpre.writeUInt32LE(khead.length, 0); kpre.writeUInt32LE(INST, 4);
    const kit = Buffer.concat([kpre, khead, Buffer.alloc((4 - ((8 + khead.length) & 3)) & 3), kb]);
    // the props: by owner kind (plots, uniques, objects) as made, 20 B a row
    const pb = Buffer.alloc(cell.props.length * PSTRIDE);
    cell.props.forEach((q, n) => {
      const o = n * PSTRIDE, yaw = ((q.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      pb.writeFloatLE(q.x, o); pb.writeFloatLE(q.y, o + 4); pb.writeFloatLE(q.z, o + 8);
      pb.writeUInt16LE(Math.round(yaw / (2 * Math.PI) * 65536) & 65535, o + 12);
      pb.writeUInt16LE(kidx.get(q.key), o + 14); pb.writeUInt16LE(Math.min(65535, q.owner), o + 16);
      pb[o + 18] = q.flags & 255; pb[o + 19] = q.kind & 255;
    });
    // the blobs, each 4-aligned
    const blobs = [], sec = {};
    let off = 0;
    for (const [k, b] of [['vb', far.vb], ['ib', far.ib], ['kit', kit], ['props', pb]]) {
      sec[k] = [off, b.length]; blobs.push(b);
      const pad = (4 - (b.length & 3)) & 3; if (pad) blobs.push(Buffer.alloc(pad)); off += b.length + pad;
    }
    const header = { magic: 'CITY', v: V, town: T.id, cell: [cell.i, cell.j], size: S, box: far.box,
      far: { verts: far.verts, tris: far.tris, stride: VSTRIDE, index: far.index, buckets: far.buckets, draws: far.draws },
      plots: cell.plots, uniques: cell.uniques, objects: cell.objects,
      kit: { rows: cell.kit.length, stride: INST }, props: { rows: cell.props.length, stride: PSTRIDE }, sec };
    const hb = Buffer.from(JSON.stringify(header), 'utf8');
    const pre4 = Buffer.alloc(12); pre4.writeUInt32LE(MAGIC, 0); pre4.writeUInt32LE(V, 4); pre4.writeUInt32LE(hb.length, 8);
    const raw = Buffer.concat([pre4, hb, Buffer.alloc((4 - ((12 + hb.length) & 3)) & 3)].concat(blobs));
    out.push({ i: cell.i, j: cell.j, key: cell.key, raw, header,
      n: { plots: cell.plots.length, kitRows: cell.kit.length, props: cell.props.length, uniques: cell.uniques.length, objects: cell.objects.length, farTris: far.tris, farVerts: far.verts, draws: far.draws.length } });
  }
  const hash = crypto.createHash('sha256'); for (const c of out) hash.update(c.key + ':').update(c.raw);
  const sum = k => out.reduce((a, c) => a + c.n[k], 0);
  return {
    town: T, cells: out, hash: hash.digest('hex').slice(0, 16), propKeys: keys, stats, recPlots: Array.from(recPlots.keys()).sort(byId), baseIds,
    inputs: { fixture: C.fixture, record: C.record, places: PL.hash, kitPack: K.man.pack.sha256, kitTable: TB.hash, cook: sha16(fs.readFileSync(__filename)),
              means: sha16(JSON.stringify(MEANS)) },
    counts: { cells: out.length, plots: sum('plots'), kitRows: sum('kitRows'), props: sum('props'), uniques: sum('uniques'), objects: sum('objects'), farTris: sum('farTris'), farVerts: sum('farVerts') },
    archetypes: archN,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// the cell file, read back (the gate's and the host's reference decoder; CITY-PACK-FORMAT §4)
// ---------------------------------------------------------------------------------------------------------------
function decodeCell(raw) {
  if (raw.readUInt32LE(0) !== MAGIC) throw new Error('city_cook: not a city cell');
  const v = raw.readUInt32LE(4), hl = raw.readUInt32LE(8);
  const head = JSON.parse(raw.slice(12, 12 + hl).toString('utf8'));
  const base = 12 + hl + ((4 - ((12 + hl) & 3)) & 3);
  const at = k => raw.slice(base + head.sec[k][0], base + head.sec[k][0] + head.sec[k][1]);
  return { v, head, vb: at('vb'), ib: at('ib'), kit: at('kit'), props: at('props') };
}
function decodeProps(b) {
  const out = [];
  for (let o = 0; o + PSTRIDE <= b.length; o += PSTRIDE)
    out.push({ x: b.readFloatLE(o), y: b.readFloatLE(o + 4), z: b.readFloatLE(o + 8), yaw: b.readUInt16LE(o + 12) / 65536 * 2 * Math.PI,
               key: b.readUInt16LE(o + 14), owner: b.readUInt16LE(o + 16), flags: b[o + 18], kind: b[o + 19] });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// the manifest, the media
// ---------------------------------------------------------------------------------------------------------------
const subOf = T => 'city/' + T.island + '/' + T.id;
function gzOf(raw) { return zlib.gzipSync(raw, { level: 9, mtime: 0 }); }
// a cell whose raw bytes are what was shipped keeps the shipped gzip (premises_cook keepShipped's rule)
function shippedGz(T, c) {
  const dir = path.join(ROOT, 'media', ...subOf(T).split('/')), stem = stemOf(c.i, c.j);
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.startsWith(stem + '.')) continue;
    const gz = fs.readFileSync(path.join(dir, f));
    try { if (zlib.gunzipSync(gz).equals(c.raw)) return gz; } catch (e) { /* not ours */ }
  }
  return null;
}
function manifestTown(R, srcOf) {
  return {
    id: R.town.id, island: R.town.island, prefix: R.town.prefix, variant: R.town.variant, cell: S, frame: 'world', lod: LOD,
    inputs: R.inputs, propKeys: R.propKeys, archetypes: R.archetypes, hash: R.hash, counts: R.counts,
    cells: R.cells.map(c => Object.assign({ c: [c.i, c.j], src: srcOf(c), raw: c.raw.length, gz: c.gz.length, box: c.header.box }, c.n)),
  };
}
function cook(island, opt) {
  opt = opt || {};
  return TOWNS.filter(T => T.island === island).map(T => {
    const R = cookTown(T, opt);
    for (const c of R.cells) c.gz = shippedGz(T, c) || gzOf(c.raw);
    return R;
  });
}

function flag(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
function main() {
  const island = String(flag('island', 'jolene')), report = !!flag('report', false);
  if (!/^[a-z0-9_]+$/.test(island)) { console.error('city_cook: the island id must match /^[a-z0-9_]+$/'); process.exit(2); }
  console.log('city_cook: island ' + island + (report ? '  [--report: nothing is written]' : ''));
  const t0 = Date.now();
  const Rs = cook(island);
  const { writeMedia, pruneMedia } = require('./_media_lib.js');
  const towns = [];
  for (const R of Rs) {
    const keep = [], sub = subOf(R.town);
    const srcOf = c => {
      if (report) return 'media/' + sub + '/' + stemOf(c.i, c.j) + '.' + crypto.createHash('sha256').update(c.gz).digest('hex').slice(0, 8) + '.bin';
      const rel = writeMedia(sub, stemOf(c.i, c.j), 'bin', c.gz); keep.push(rel); return rel;
    };
    const M = manifestTown(R, srcOf);
    towns.push(M);
    const st = R.stats, n = M.counts;
    let gz = 0, raw = 0, maxTris = 0; for (const c of M.cells) { gz += c.gz; raw += c.raw; maxTris = Math.max(maxTris, c.farTris); }
    console.log('  ' + R.town.id + ': ' + n.cells + ' cells of ' + S + ' m, ' + n.plots + ' plots (' + st.kitPlots + ' kit (' + st.assigned + ' assigned here), ' + st.uniquePlots + ' unique), ' + n.kitRows + ' kit rows (outbuildings: ' + st.outsKit + ' the table\'s, ' + st.outsPlaced + ' placed, ' + st.outsDropped + ' table rows not planned), ' + n.uniques + ' uniques, ' + n.objects + ' objects, ' + n.props + ' props (' + R.propKeys.length + ' keys), ' + st.roads + ' roads');
    console.log('    far: ' + n.farTris + ' tris / ' + n.farVerts + ' verts, at most ' + maxTris + ' tris a cell, 2 draws a cell; ' + (raw / 1e3).toFixed(1) + ' KB raw -> ' + (gz / 1e3).toFixed(1) + ' KB gz; hash ' + R.hash);
    if (st.missingPlots.length) console.log('    WARNING: ' + st.missingPlots.length + ' things not in the composed record: ' + st.missingPlots.slice(0, 4).join(' '));
    if (st.unshaped) console.log('    note: ' + st.unshaped + ' uniques without an obstacle shape (no far box)');
    if (!report) { const gone = pruneMedia(sub, keep); if (gone.length) console.log('    pruned ' + gone.length + ': ' + gone.slice(0, 6).join(', ')); }
  }
  console.log('  cooked in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  if (report) { console.log('\nnothing was written (--report).'); return; }
  const man = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { towns: [] };
  const doc = { note: 'GENERATED by tools/city_cook.js - do not edit. The format: futureDesigns/CITY-PACK-FORMAT.md. Every src is one gzip stream; GATE CITYCOOK holds it to a fresh cook.', v: V,
    towns: (man.towns || []).filter(t => t.island !== island).concat(towns).sort((a, b) => byId(a.island + '/' + a.id, b.island + '/' + b.id)) };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
  console.log('  manifest: src/core/city_packs.json\n\nnext: node tools/run_gates.js --only=CITYCOOK,MEDIA --no-build');
}

module.exports = { V, MAGIC, S, LOD, LIFT, BUCKETS, TOWNS, MEANS, PAINTABLE, VSTRIDE, PSTRIDE, INST, OUT, meanFile, cook, cookTown, decodeCell, decodeProps,
  shellOf, shellFaces, earClip, octEnc, stemOf, subOf, cellOf, keyOf, manifestTown, placesOf, kitOf, tableOf, composedOf };
if (require.main === module) main();
