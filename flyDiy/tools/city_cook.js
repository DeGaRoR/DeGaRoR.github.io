#!/usr/bin/env node
// city_cook.js — THE COOKED TOWN (CITY-A, G3400-G3414; futureDesigns/CITY-2.0-PLAN-2026-10-20.md, the format:
// futureDesigns/CITY-PACK-FORMAT.md). A sibling of premises_cook.js and town_kit.js, downstream of both: it reads their
// COMMITTED outputs (the town variant's places cook, the kit pack and its instance table) and the composed record, and
// writes one pack per sown town, cut in 512 m cells of the world:
//   FAR   one static merged mesh a cell, built here (walls + roofs: the kit archetypes' far shells and the uniques' boxes)
//         - 12 B a vertex, quantized in the cell's box, vertex colour = the finish's albedo mean (the G559 rule, the gain
//         the runtime's), ONE draw a cell, each owner's index range named (far.owners). No roads (the pavement draws them
//         at every distance), no flat lot squares anywhere (the user, 20 Oct: the terrain's own texture is the lot)
//   NEAR  the kit rows (a TKIN instance file, WORLD frame, townkit.js decodeInstances reads it as is), the props (20 B a
//         row: the places cook's own placements), the LOTS (v2, 32 B a row: every plot's fence posts, bays, gates and its
//         worn ground - what G3210's Metlakatla bare took down - instanced from the town's LOT KIT, cooked here from
//         VILLAGE_GEN's own fence), the uniques (the landmarks: the unique path near)
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
const V = 2;
const MAGIC = 0x59544943;            // 'CITY'
const S = 512;                       // the city cell, world metres (2 x 2 stream cells of render_premises LIVE_CELL)
const VSTRIDE = 12, PSTRIDE = 20, INST = 32, LSTRIDE = 32;
// the distances the cook assumed - the host reads them from the manifest (CITY-PACK-FORMAT §6)
// `far` is THE DIAL (the user, 20 Oct: the far shells from 1 km; 2 km the fallback): nearIn / nearOut = far -/+ 50
const LOD = { far: 1000, nearIn: 950, nearOut: 1050, kitE0: 150, kitE1: 1200, propFar: 600, lotFar: 400, lotE1: 120, castFar: 600, farGain: 0.2 };
const BUCKETS = ['walls', 'roofs'];
// the sown towns: a record prefix on Jolene's zones, cooked from the variant that composes them
const TOWNS = [{ id: 'metlakatla', island: 'jolene', prefix: 'mk_', variant: 'town', base: 'default' }];

// THE MEANS: each scanned set's albedo mean, the 4 x 4 box mean of its shipped _diff map in sRGB bytes (what
// render_premises meanOf draws its canvas to), measured once (PIL, BOX filter) - keyed by the FILE so a re-shot texture
// shows as stale (GATE CITYCOOK: every file named here exists).
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
};
const meanFile = k => 'media/tex/house/' + MEANS[k][0];
// the sets whose map is a pale base under the house's paint (house_tex.js: a `paint` map) - the palette names the colour
// you GET (_house_gen.js paintHex), so a painted face's far colour is the palette's
const PAINTABLE = new Set(['boxprof', 'paintwood', 'greenwood', 'board', 'darkwood', 'veneer', 'veneerdark', 'veneerwarm', 'veneerpale', 'render']);
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
  const { W, O, rec } = PC.composeVariant(T.island, Vv, fixtureText);
  const H = PC.headless();
  const C = { W, O, rec, PG: H.PG, GENS: H.GENS, fixture: sha16(fixtureText), record: sha16(JSON.stringify(O.rec)), TOWN_OFF: H.PG.TOWN_OFF };
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
  // `own`: the owner the next triangles belong to ([kind, index]: 0 a plot, 1 a unique) - far.owners' ranges
  return { i, j, key: keyOf(i, j), tri: [[], []], own: [0, 0], plots: [], uniques: [], objects: [], kit: [], kitPlots: [], props: [], lots: [] };
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
  for (let k = 1; k + 1 < pts.length; k++) cell.tri[b].push([pts[0], pts[k], pts[k + 1], n, rgb, cell.own]);
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
  if (!tris.length) return { box: null, vb: Buffer.alloc(0), ib: Buffer.alloc(0), verts: 0, tris: 0, index: 16, buckets: BUCKETS.map((name, id) => ({ name, id, first: 0, count: 0 })), draws: [], owners: [] };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) { const v = t[k][a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  const box = [Math.floor(lo[0] * 100) / 100, Math.floor(lo[1] * 100) / 100, Math.floor(lo[2] * 100) / 100,
               Math.ceil(hi[0] * 100) / 100, Math.ceil(hi[1] * 100) / 100, Math.ceil(hi[2] * 100) / 100];
  for (let a = 0; a < 3; a++) if (box[a + 3] - box[a] < 0.01) box[a + 3] = r3(box[a] + 0.01);
  const q = (v, a) => Math.max(0, Math.min(65535, Math.round((v - box[a]) / (box[a + 3] - box[a]) * 65535)));
  // vertices shared within a bucket where position, normal and colour quantize alike
  const verts = [], vmap = new Map(), idx = [], buckets = [], owners = [];
  for (let b = 0; b < BUCKETS.length; b++) {
    const first = idx.length;
    for (const t of cell.tri[b]) {
      // each owner's triangles are contiguous in a bucket (the cook pushes one owner at a time): a run per owner
      const o = owners[owners.length - 1];
      if (!o || o[2] !== b || o[0] !== t[5][0] || o[1] !== t[5][1]) owners.push([t[5][0], t[5][1], b, idx.length, 0]);
      owners[owners.length - 1][4] += 3;
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
  const shell = buckets[0].count + buckets[1].count;
  const draws = shell ? [{ mat: 'shell', first: 0, count: shell }] : [];
  return { box, vb, ib, verts: verts.length, tris: idx.length / 3, index: wide ? 32 : 16, buckets, draws, owners };
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
// ---------------------------------------------------------------------------------------------------------------
// THE LOTS (v2, CITY-PACK-FORMAT §9): what G3210's Metlakatla bare took down, as instanced near-only rows. The fence is
// the village's own (VILLAGE_GEN.buildFence / gateLeaf, premises_build.js genFence's rules), cooked ONCE into the town's
// LOT KIT - a post, a 2.4 m bay, a gate leaf, a gate post, per style, the posts and bays in four hands - and every
// stretch of every plot becomes rows of those pieces, cut exactly as buildFence cuts it (a post every 2.4 m, the gate
// its own bay, its leaf swung by buildFence's own noise). The ground is drawn only where it is WORN (lotGround's
// paths, drive, pad, slab and the dry ground at the house's foot): strips and rectangles with a soft edge, at most
// 8 m a piece. lotGround's lawn tone over the whole lot is not drawn - the user's "no flat lot squares": the terrain is.
// ---------------------------------------------------------------------------------------------------------------
const LOTKIT_MAGIC = 0x544b544c;     // 'LTKT'
const FENCE_HAND = 0.6;              // premises_build.js FENCE_HAND
const BAY = 2.4, GATE_W = 1.0, LOT_VARIANTS = 4, PIECE_MAX = 8;
const FENCE_H = { rail: 1.15, picket: 1.05 };
// the worn ground (lotGround's channels): the full width drawn (the fade included) and the fade, metres; the lot_tex set
const GROUND = {
  path: { tex: 'dirt', fade: 0.55, width: 0.7 + 2 * 0.55 },     // dirtAt: full within 0.35 m of the walk, gone at 0.9
  drive: { tex: 'dirt', fade: 0.6 },                             // the drive's half width + 0.6
  pad: { tex: 'pebble', fade: 0.5 },                             // padAt: the pad + 0.5
  slab: { tex: 'cracked', fade: 0.05 },                          // the commercial slab (slabMesh's set), a hard edge
  dry: { tex: 'dry', fade: 1.2 },                                // dryAt: the house's (and the outbuilding's) rect + 1.2
};
// the lot kit's normals: three's computeVertexNormals, then the bag's own overrides (town_kit.js normalsOf)
function normalsOf(raw) {
  const p = raw.pos, n = new Float32Array(p.length);
  for (let t = 0; t < raw.idx.length; t += 3) {
    const a = raw.idx[t] * 3, b = raw.idx[t + 1] * 3, c = raw.idx[t + 2] * 3;
    const cbx = p[c] - p[b], cby = p[c + 1] - p[b + 1], cbz = p[c + 2] - p[b + 2];
    const abx = p[a] - p[b], aby = p[a + 1] - p[b + 1], abz = p[a + 2] - p[b + 2];
    const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx;
    for (const v of [a, b, c]) { n[v] += x; n[v + 1] += y; n[v + 2] += z; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  (raw.nOv || []).forEach((v, i) => { if (!v) return; const l = Math.hypot(v[0], v[1], v[2]) || 1; n[i * 3] = v[0] / l; n[i * 3 + 1] = v[1] / l; n[i * 3 + 2] = v[2] / l; });
  return n;
}
// a bag's triangles whose centroid passes `keep`, as a town_kit.js LOD (role: 0 post, 1 deck)
function lodOfBag(bag, role, keep) {
  const raw = bag.raw(), nr = normalsOf(raw), L = { pos: [], nrm: [], uv: [], ao: [], role: [], stance: [], lit: [], win: [], idx: [] }, map = new Map();
  const vert = i => {
    let m = map.get(i); if (m !== undefined) return m;
    m = L.role.length; map.set(i, m);
    L.pos.push(raw.pos[i * 3], raw.pos[i * 3 + 1], raw.pos[i * 3 + 2]); L.nrm.push(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]);
    L.uv.push(raw.uv[i * 2], raw.uv[i * 2 + 1]); L.ao.push(raw.ao[i] === undefined ? 1 : raw.ao[i]); L.role.push(role); L.stance.push(0); L.lit.push(0); L.win.push(0, 0, 0);
    return m;
  };
  for (let t = 0; t < raw.idx.length; t += 3) {
    const a = raw.idx[t], b = raw.idx[t + 1], c = raw.idx[t + 2];
    const cx = (raw.pos[a * 3] + raw.pos[b * 3] + raw.pos[c * 3]) / 3;
    const span = Math.max(raw.pos[a * 3], raw.pos[b * 3], raw.pos[c * 3]) - Math.min(raw.pos[a * 3], raw.pos[b * 3], raw.pos[c * 3]);
    if (keep && !keep(cx, span)) continue;
    L.idx.push(vert(a), vert(b), vert(c));
  }
  return L;
}
// buildFence's own noise (j), on the stretch's start and its seed: the gate's swing and a picket's top
const jOf = (a, k0) => (i, k) => { const h = Math.sin((a[0] + i * 3.7) * 12.9898 + (a[1] + k) * 78.233 + k0) * 43758.5453; return (h - Math.floor(h)) * 2 - 1; };
let LOTKIT = null;
function lotKitOf(C) {
  if (LOTKIT) return LOTKIT;
  const VG = C.GENS.VILLAGE_GEN, HK = C.GENS.HOUSE_KIT, HG = C.GENS.HOUSE_GEN;
  const TKA = require(path.join(ROOT, 'tools', 'town_kit.js'));
  const flat = { h: () => 0, waterY: -1e9, size: 1e4 };
  const pieces = [], blobs = [], byName = new Map();
  let off = 0;
  const put = b => { const at = off; blobs.push(b); const pad = (4 - (b.length & 3)) & 3; if (pad) blobs.push(Buffer.alloc(pad)); off += b.length + pad; return [at, b.length]; };
  const mesh = (name, kind, style, variant, len, L) => {
    const e = TKA.encodeLod(L), m = e.meta;
    if (m.index !== 16) throw new Error('city_cook: a lot piece past 65 535 vertices');
    const P = { id: pieces.length, name, kind, style, variant, len, tris: m.tris, verts: m.verts, box: m.pos.min.concat(m.pos.max), uv: m.uv.min.concat(m.uv.max), vb: put(e.blobs[0]), ib: put(e.blobs[1]) };
    pieces.push(P); byName.set(name, P.id); return P;
  };
  const bagsOf = () => ({ post: HK.Bag('post'), deck: HK.Bag('deck') });
  for (const style of ['rail', 'picket']) {
    for (let v = 0; v < LOT_VARIANTS; v++) {
      // one bay between two posts, on flat ground, in the village's hand at a seed of its own
      const bags = bagsOf();
      VG.buildFence(bags, flat, { a: [0, 0], b: [BAY, 0], kind: 'side', style, gap: null }, FENCE_HAND, 1009 + 7919 * v);
      HK.bakeAO([bags.post, bags.deck], { strength: 0.85, range: 0.5, ground: flat.h });
      mesh('post:' + style + ':' + v, 'post', style, v, 1, lodOfBag(bags.post, 0, cx => cx < BAY / 2));
      mesh('bay:' + style + ':' + v, 'bay', style, v, BAY, lodOfBag(bags.deck, 1, null));
      // THE BAY'S LOD 1 (a picket bay is ~450 triangles, ~60 past lod.lotE1): its rails (the triangles that run along the
      // bay, and their end caps) and the pickets as ONE panel, both faces, where they stand
      if (style === 'picket' && v === 0) {
        const L1 = lodOfBag(bags.deck, 1, (cx, span) => span > 0.5 || cx < 0.03 || cx > BAY - 0.03);
        const pk = lodOfBag(bags.deck, 1, (cx, span) => !(span > 0.5 || cx < 0.03 || cx > BAY - 0.03));
        let zs = 0, y0 = Infinity, y1 = -Infinity; const nv = pk.pos.length / 3;
        for (let i = 0; i < nv; i++) { zs += pk.pos[i * 3 + 2]; y0 = Math.min(y0, pk.pos[i * 3 + 1]); y1 = Math.max(y1, pk.pos[i * 3 + 1]); }
        const z = zs / Math.max(1, nv);
        for (const sd of [1, -1]) {
          const b = L1.role.length, q = [[0, y0], [BAY, y0], [BAY, y1], [0, y1]];
          for (const [x, y] of q) { L1.pos.push(x, y, z + sd * 0.004); L1.nrm.push(0, 0, sd); L1.uv.push(x, y); L1.ao.push(0.9); L1.role.push(1); L1.stance.push(0); L1.lit.push(0); L1.win.push(0, 0, 0); }
          if (sd > 0) L1.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); else L1.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
        }
        mesh('bay1:picket', 'bay1', style, 0, BAY, L1);
      }
    }
    // the gate: its leaf hung on the post at x 0, CLOSED (the row's yaw carries the swing), and its two taller posts
    const bags = bagsOf(), j0 = jOf([0, 0], 4111);
    VG.gateLeaf(bags, flat, [0, 0], [1, 0], 0, GATE_W + 0.10, FENCE_H[style], FENCE_HAND, (i, k) => (k === 9 ? -1.5 : j0(i, k)), style);
    HK.bakeAO([bags.post, bags.deck], { strength: 0.85, range: 0.5, ground: flat.h });
    mesh('gate:' + style, 'gate', style, 0, GATE_W, lodOfBag(bags.deck, 1, null));
    mesh('gatepost:' + style, 'gatepost', style, 0, 1, lodOfBag(bags.post, 0, cx => cx < 0.5));
  }
  // each bay names its lod 1 (a rail bay is its own: ~56 triangles)
  for (const P of pieces) if (P.kind === 'bay') P.lod1 = P.style === 'picket' ? byName.get('bay1:picket') : P.id;
  const oldW = HG.YARD_KIT && HG.YARD_KIT.fence_old ? HG.YARD_KIT.fence_old.W : 4.597;
  const P0 = { id: pieces.length, name: 'old', kind: 'old', style: 'old', variant: 0, len: oldW, prop: 'fence_old' };
  pieces.push(P0); byName.set('old', P0.id);
  for (const g of Object.keys(GROUND)) { const P = { id: pieces.length, name: 'ground:' + g, kind: 'ground', style: g, variant: 0, len: 1, tex: GROUND[g].tex, fade: GROUND[g].fade }; pieces.push(P); byName.set(P.name, P.id); }
  LOTKIT = { pieces, blobs, byName, oldW };
  return LOTKIT;
}
// the lot kit file (CITY-PACK-FORMAT §9.2): the piece table names the old fence's prop by its index in the town's keys
function lotKitFile(LK, kidx) {
  const pieces = LK.pieces.map(p => (p.prop ? Object.assign({}, p, { prop: kidx.get(p.prop) }) : p));
  const hb = Buffer.from(JSON.stringify({ magic: 'LTKT', v: 1, roles: ['post', 'deck'], vstride: 16, pieces }), 'utf8');
  const pre = Buffer.alloc(12); pre.writeUInt32LE(LOTKIT_MAGIC, 0); pre.writeUInt32LE(1, 4); pre.writeUInt32LE(hb.length, 8);
  return { raw: Buffer.concat([pre, hb, Buffer.alloc((4 - ((12 + hb.length) & 3)) & 3)].concat(LK.blobs)), pieces };
}
const h16 = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; };
const yawOf = (tx, tz) => Math.atan2(-tz, tx);          // rotY's yaw whose +x is the world direction (tx, tz)
// one plan's lot rows: its fences (cut as buildFence cuts them) and its worn ground
//   plan   the dressed plot (finishPlot's: fences, path, outPath, drive, lot) - the places cook's, premises frame
//   house  { x, z, yaw, P } the house the plan was made round (the dry ground at its foot); out: the outbuilding's
//   T      { h, waterY, size } the composed ground in the premises frame, the zone's water (clipToLand's dry test)
function lotRows(C, LK, plan, house, T, owner, ownerFlag, seedKey) {
  const VG = C.GENS.VILLAGE_GEN, PG = C.PG, O = C.O, rows = [], fenced = { want: 0, got: 0 };
  const P = (x, z) => { const w = O.frame.toWorld(x, z); return [w[0], w[1]]; };
  const dyaw = O.frame.yaw || 0;
  const row = (piece, x, z, yaw, len, width, flags, corners, y) => {
    const w = P(x, z), y0 = y !== undefined ? y : T.h(x, z);
    rows.push({ x: w[0], y: y0, z: w[1], yaw: yaw + dyaw, len, width, piece, flags: flags | ownerFlag, owner, seed: h16(seedKey + '|' + rows.length) & 65535,
                g: corners ? corners.map(v => v - y0) : [0, 0, 0, 0] });
  };
  const k0 = (PG.fnv(String(plan.id)) % 1000) * 7 + 1;      // premises_build.js genDress's fence seed
  (plan.fences || []).forEach((seg0, si) => {
    const seg = VG.clipToLand(T, seg0);
    if (!seg) return;
    const a = seg.a, b = seg.b, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tg = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], yaw = yawOf(tg[0], tg[1]);
    const at = t => [a[0] + tg[0] * t, a[1] + tg[1] * t];
    const style = seg.style === 'old' ? 'old' : seg.style === 'picket' ? 'picket' : 'rail';
    const gate = (g0, g1, open, gstyle) => {
      // the leaf on the post at g0, swung `open` into the plot (gateLeaf: toward [-tg1, tg0]); the two taller posts
      const c = Math.cos(open), s = Math.sin(open), d = [tg[0] * c - tg[1] * s, tg[1] * c + tg[0] * s];
      const p0 = at(g0), y0 = T.h(p0[0], p0[1]);
      row(LK.byName.get('gate:' + gstyle), p0[0], p0[1], yawOf(d[0], d[1]), g1 - g0 - 0.10, 0, 1, [y0, y0, y0, y0], y0);
      for (const t of [g0, g1]) { const q = at(t); row(LK.byName.get('gatepost:' + gstyle), q[0], q[1], yaw, 1, 0, 1); }
    };
    if (style === 'old') {
      // the scanned stretch (genFence: one prop width at a time, on the ground under its middle, the gate's bay left out)
      if (L < 1e-6) return;
      const ry = Math.atan2(tg[0], tg[1]) - Math.PI / 2;
      const parts = seg.gap ? [[0, Math.max(0, seg.gap[0])], [Math.min(L, seg.gap[1]), L]] : [[0, L]];
      fenced.want += L - (seg.gap ? Math.min(L, seg.gap[1]) - Math.max(0, seg.gap[0]) : 0);
      for (const [u0, u1] of parts) {
        if (u1 - u0 < 0.8) continue;
        const ns = Math.max(1, Math.round((u1 - u0) / LK.oldW)), pw = (u1 - u0) / ns;
        for (let i = 0; i < ns; i++) { const q = at(u0 + pw * (i + 0.5)); row(LK.byName.get('old'), q[0], q[1], ry, pw, 0, 4 | 1, null, T.h(q[0], q[1]) - 0.03); fenced.got += pw; }
      }
      if (seg.gap) gate(Math.max(0.3, seg.gap[0]), Math.min(L - 0.3, seg.gap[1]), 0.45 + 0.3 * 0.3, 'rail');
      return;
    }
    if (L < 1.0) return;
    // THE POSTS every 2.4 m along each stretch, the gate its own bay (buildFence, line for line)
    const gap = seg.gap && seg.gap[1] > 0.3 && seg.gap[0] < L - 0.3 ? [Math.max(0.3, seg.gap[0]), Math.min(L - 0.3, seg.gap[1])] : null;
    const ts = [];
    const stretch = (u0, u1) => { const nb = Math.max(1, Math.round((u1 - u0) / 2.4)); for (let i = 0; i <= nb; i++) ts.push(u0 + (u1 - u0) * i / nb); };
    if (gap) { stretch(0, gap[0]); stretch(gap[1], L); } else stretch(0, L);
    fenced.want += L - (gap ? gap[1] - gap[0] : 0);
    const ys = ts.map(t => { const q = at(t); return T.h(q[0], q[1]); });
    ts.forEach((t, i) => { const q = at(t); row(LK.byName.get('post:' + style + ':' + (h16(seedKey + '|p' + si + '|' + i) & 3)), q[0], q[1], yaw, 1, 0, 1, null, ys[i]); });
    for (let i = 0; i + 1 < ts.length; i++) {
      const t0 = ts[i], t1 = ts[i + 1];
      if (gap && Math.abs(t0 - gap[0]) < 1e-6 && Math.abs(t1 - gap[1]) < 1e-6) continue;
      const q = at(t0);
      row(LK.byName.get('bay:' + style + ':' + (h16(seedKey + '|b' + si + '|' + i) & 3)), q[0], q[1], yaw, t1 - t0, 0, 1, [ys[i], ys[i + 1], ys[i + 1], ys[i]], ys[i]);
      fenced.got += t1 - t0;
    }
    if (gap) gate(gap[0], gap[1], 0.45 + 0.3 * jOf(a, k0)(gap[0], 9), style);
  });
  // THE WORN GROUND: a strip or a rectangle from its -x edge's middle `o` along `tg`, cut in pieces of at most 8 m, the
  // fade only on the outer edges (flags 8 x = 0, 16 x = L, 32 z = -w/2, 64 z = +w/2)
  const ground = (kind, o, tg, len, width) => {
    if (!(len > 0.05) || !(width > 0.05)) return;
    const nz = [-tg[1], tg[0]], yaw = yawOf(tg[0], tg[1]);
    const n = Math.ceil(len / PIECE_MAX), m = Math.ceil(width / PIECE_MAX), pl = len / n, pw = width / m;
    for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) {
      const zc = -width / 2 + pw * (k + 0.5), ox = o[0] + tg[0] * pl * i + nz[0] * zc, oz = o[1] + tg[1] * pl * i + nz[1] * zc;
      const cor = [[0, -pw / 2], [pl, -pw / 2], [pl, pw / 2], [0, pw / 2]].map(([u, v]) => T.h(ox + tg[0] * u + nz[0] * v, oz + tg[1] * u + nz[1] * v));
      const edges = (i === 0 ? 8 : 0) | (i === n - 1 ? 16 : 0) | (k === 0 ? 32 : 0) | (k === m - 1 ? 64 : 0);
      row(LK.byName.get('ground:' + kind), ox, oz, yaw, pl, pw, 2 | edges, cor);
    }
  };
  const strip = (kind, p0, p1, width) => { const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (L < 0.05) return; ground(kind, p0, [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L], L, width); };
  // a rectangle in a frame (x, z, yaw: the house frame, rotY's), x in [x0, x1], z in [z0, z1]
  const rect = (kind, f, x0, x1, z0, z1) => {
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw), W = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
    ground(kind, W(x0, (z0 + z1) / 2), [c, -s], x1 - x0, z1 - z0);
  };
  for (const sg of (plan.path || []).concat(plan.outPath || [])) strip('path', sg[0], sg[1], GROUND.path.width);
  if (plan.drive && plan.drive.segs) for (const sg of plan.drive.segs) strip('drive', sg[0], sg[1], plan.drive.width + 2 * GROUND.drive.fade);
  const pd = plan.drive && plan.drive.pad;
  if (pd) { const f = GROUND.pad.fade; ground('pad', [pd.c[0] - pd.tg[0] * (pd.w / 2 + f), pd.c[1] - pd.tg[1] * (pd.w / 2 + f)], pd.tg, pd.w + 2 * f, pd.d + 2 * f); }
  if (plan.lot && plan.lot.kind === 'concrete' && plan.lot.poly && plan.lot.poly.length === 4) {
    const [a, b, , d] = plan.lot.poly, ex = [b[0] - a[0], b[1] - a[1]], ez = [d[0] - a[0], d[1] - a[1]], L = Math.hypot(ex[0], ex[1]);
    if (L > 0.05) ground('slab', [a[0] + ez[0] / 2, a[1] + ez[1] / 2], [ex[0] / L, ex[1] / L], L, Math.hypot(ez[0], ez[1]));
  }
  // the dry ground at the house's foot and the outbuilding's (lotGround's rects, + its 1.2 m ramp)
  if (house && house.P) {
    const Hp = house.P, f = GROUND.dry.fade, big = Hp.big ? 1 : 0;
    const hx = Hp.L / 2 + (big ? 3 : 0), hz0 = -Hp.w / 2 - (big ? 2 : 0), hz1 = Hp.w / 2 + (Hp.porch ? Hp.porchD || 0 : 0) + (big ? (Hp.dock ? Hp.dockD || 0 : 0) + 9 : 0);
    rect('dry', house, -hx - f, hx + f, hz0 - f, hz1 + f);
  }
  const po = plan.out;
  if (po && po.P && isFinite(po.x)) { const f = GROUND.dry.fade; rect('dry', po, -po.P.L / 2 - f, po.P.L / 2 + f, -po.P.w / 2 - f, po.P.w / 2 + f); }
  return { rows, fenced };
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
  const stats = { plots: 0, kitPlots: 0, assigned: 0, uniquePlots: 0, outsKit: 0, outsPlaced: 0, outsDropped: 0, items: 0, objects: 0, props: 0, unshaped: 0, missingPlots: [],
                  lots: 0, fenceWant: 0, fenceGot: 0, lotsBy: {} };
  const propKeys = new Set(['fence_old']);   // (the lot kit's old fence names its prop by index: always a key)
  // THE LOTS: the lot kit, and the ground each plan stands on (the premises frame; clipToLand's water: the zone's)
  const LK = lotKitOf(C), TKA0 = require(path.join(ROOT, 'tools', 'town_kit.js'));
  const zoneRec = new Map(((C.rec.layers && C.rec.layers.zones) || []).map(z => [z.id, z]));
  const waterOf = new Map();
  const Tof = zone => {
    if (!waterOf.has(zone)) waterOf.set(zone, zoneRec.has(zone) ? TKA0.zoneWater(C.PG, C.W, O.frame, zoneRec.get(zone)) : TKA0.SEA);
    return { h: (x, z) => { const w = O.frame.toWorld(x, z); return O.terrainAt(w[0], w[1]); }, waterY: waterOf.get(zone), size: 20000 };
  };
  const addLots = (cell, plan, house, T, owner, ownerFlag, key) => {
    const L = lotRows(C, LK, plan, house, T, owner, ownerFlag, key);
    for (const r of L.rows) { cell.lots.push(r); const k = LK.pieces[r.piece].kind; stats.lotsBy[k] = (stats.lotsBy[k] || 0) + 1; }
    stats.lots += L.rows.length; stats.fenceWant += L.fenced.want; stats.fenceGot += L.fenced.got;
  };
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
      cell.own = [0, pi];
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
      // THE LOT: its fence, its gate, its worn ground (v2, §9) - round the house the plan was made round
      addLots(cell, t.plot, t.house ? { x: t.house.x, z: t.house.z, yaw: t.house.yaw, P: t.house.P } : null, Tof(p.zone), pi, 0, id);
      // the props: the house's own (its frame), the car, the boat
      if (t.at) for (const q of t.props || []) propRow(cell, toWorldAt(t.at, q), q.k, pi, (q.on === 'ground' ? 1 : 0) | (WATER_KEY.test(q.k) ? 4 : 0), WATER_KEY.test(q.k) ? 2 : 0);
      if (t.plot.car && t.plot.car.key) propRow(cell, [t.plot.car.x, t.plot.car.y, t.plot.car.z, t.plot.car.ry || 0], t.plot.car.key, pi, 1 | 2, 1);
      // a commercial lot's parked cars (placeDress: plot.lot.cars, on the ground)
      for (const c of (t.plot.lot && t.plot.lot.cars) || []) if (c && c.key) propRow(cell, [c.x, typeof c.y === 'number' ? c.y : O.terrainAt(...O.frame.toWorld(c.x, c.z)), c.z, c.ry || 0], c.key, pi, 1 | 2, 1);
      if (t.plot.boat && t.plot.boat.key) propRow(cell, [t.plot.boat.x, t.plot.boat.y, t.plot.boat.z, t.plot.boat.ry || 0], t.plot.boat.key, pi, 2 | 4, 2);
      stats.plots++;
    } else if (t.kind === 'item') {
      if (!t.at) continue;
      const cell = cellAt(t.at[0], t.at[2]), ui = cell.uniques.length, P = (t.item && t.item.P) || {};
      cell.own = [1, ui];
      cell.uniques.push([String(t.id), String((t.item && t.item.gen) || ''), r3(t.at[0]), r3(t.at[1]), r3(t.at[2]), +t.at[3].toFixed(5)]);
      const wall = typeof P.wallTint === 'number' && P.wallTint > 0 ? hexRGB(P.wallTint) : NEUTRAL.wall;
      if (!addBox(cell, t.at, t.shape, O, wall, NEUTRAL.roof)) stats.unshaped++;
      for (const q of t.props || []) propRow(cell, toWorldAt(t.at, q), q.k, ui, q.on === 'ground' ? 1 : 0, 4);
      if (t.plan && t.plan.out && t.plan.out.at) addBox(cell, t.plan.out.at, t.plan.out.shape, O, wall, NEUTRAL.roof);
      // the site's lot (its synthetic plot: buildItem dresses it as a plot) - the owner a unique (lot flag 128)
      if (t.plan) addLots(cell, t.plan, t.item ? { x: t.item.x, z: t.item.z, yaw: t.item.yaw, P: Object.assign({ big: 1 }, t.item.P, { L: (t.item.size || P).L, w: (t.item.size || P).w }) } : null, Tof(null), ui, 128, String(t.id));
      stats.items++;
    } else if (t.kind === 'object') {
      if (!t.at || !t.ob || !t.ob.key) continue;
      const cell = cellAt(t.at[0], t.at[2]), oi = cell.objects.length;
      cell.objects.push([String(t.id), String(t.ob.key)]);
      propRow(cell, t.at, String(t.ob.key), oi, (t.ob.on === 'ground' ? 1 : 0) | 2, 3);
      stats.objects++;
    }
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
    // the lots: 32 B a row (CITY-PACK-FORMAT §9.1)
    const lb = Buffer.alloc(cell.lots.length * LSTRIDE);
    cell.lots.forEach((r, n) => {
      const o = n * LSTRIDE, yaw = ((r.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), cm = v => Math.max(0, Math.min(65535, Math.round(v * 100)));
      lb.writeFloatLE(r.x, o); lb.writeFloatLE(r.y, o + 4); lb.writeFloatLE(r.z, o + 8);
      lb.writeUInt16LE(Math.round(yaw / (2 * Math.PI) * 65536) & 65535, o + 12);
      lb.writeUInt16LE(cm(r.len), o + 14); lb.writeUInt16LE(cm(r.width), o + 16);
      lb[o + 18] = r.piece; lb[o + 19] = r.flags & 255; lb.writeUInt16LE(r.owner, o + 20); lb.writeUInt16LE(r.seed, o + 22);
      for (let k = 0; k < 4; k++) lb.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r.g[k] * 100))), o + 24 + k * 2);
    });
    // the blobs, each 4-aligned
    const blobs = [], sec = {};
    let off = 0;
    for (const [k, b] of [['vb', far.vb], ['ib', far.ib], ['kit', kit], ['props', pb], ['lots', lb]]) {
      sec[k] = [off, b.length]; blobs.push(b);
      const pad = (4 - (b.length & 3)) & 3; if (pad) blobs.push(Buffer.alloc(pad)); off += b.length + pad;
    }
    const header = { magic: 'CITY', v: V, town: T.id, cell: [cell.i, cell.j], size: S, box: far.box,
      far: { verts: far.verts, tris: far.tris, stride: VSTRIDE, index: far.index, buckets: far.buckets, draws: far.draws, owners: far.owners },
      plots: cell.plots, uniques: cell.uniques, objects: cell.objects,
      kit: { rows: cell.kit.length, stride: INST }, props: { rows: cell.props.length, stride: PSTRIDE }, lots: { rows: cell.lots.length, stride: LSTRIDE }, sec };
    const hb = Buffer.from(JSON.stringify(header), 'utf8');
    const pre4 = Buffer.alloc(12); pre4.writeUInt32LE(MAGIC, 0); pre4.writeUInt32LE(V, 4); pre4.writeUInt32LE(hb.length, 8);
    const raw = Buffer.concat([pre4, hb, Buffer.alloc((4 - ((12 + hb.length) & 3)) & 3)].concat(blobs));
    out.push({ i: cell.i, j: cell.j, key: cell.key, raw, header,
      n: { plots: cell.plots.length, kitRows: cell.kit.length, props: cell.props.length, lots: cell.lots.length, uniques: cell.uniques.length, objects: cell.objects.length, farTris: far.tris, farVerts: far.verts, draws: far.draws.length } });
  }
  const hash = crypto.createHash('sha256'); for (const c of out) hash.update(c.key + ':').update(c.raw);
  const sum = k => out.reduce((a, c) => a + c.n[k], 0);
  const lotKit = lotKitFile(LK, kidx);
  return {
    town: T, cells: out, hash: hash.digest('hex').slice(0, 16), propKeys: keys, stats, recPlots: Array.from(recPlots.keys()).sort(byId), baseIds,
    inputs: { fixture: C.fixture, record: C.record, places: PL.hash, kitPack: K.man.pack.sha256, kitTable: TB.hash, cook: sha16(fs.readFileSync(__filename)),
              means: sha16(JSON.stringify(MEANS)), lotKit: sha16(lotKit.raw) },
    counts: { cells: out.length, plots: sum('plots'), kitRows: sum('kitRows'), props: sum('props'), lots: sum('lots'), uniques: sum('uniques'), objects: sum('objects'), farTris: sum('farTris'), farVerts: sum('farVerts') },
    archetypes: archN, lotKit,
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
  return { v, head, vb: at('vb'), ib: at('ib'), kit: at('kit'), props: at('props'), lots: head.sec.lots ? at('lots') : Buffer.alloc(0) };
}
function decodeLots(b) {
  const out = [];
  for (let o = 0; o + LSTRIDE <= b.length; o += LSTRIDE)
    out.push({ x: b.readFloatLE(o), y: b.readFloatLE(o + 4), z: b.readFloatLE(o + 8), yaw: b.readUInt16LE(o + 12) / 65536 * 2 * Math.PI,
               len: b.readUInt16LE(o + 14) / 100, width: b.readUInt16LE(o + 16) / 100, piece: b[o + 18], flags: b[o + 19], owner: b.readUInt16LE(o + 20),
               seed: b.readUInt16LE(o + 22), g: [0, 1, 2, 3].map(k => b.readInt16LE(o + 24 + k * 2) / 100) });
  return out;
}
// the lot kit file (§9.2): its header, and each mesh piece's LOD decoded by town_kit.js's own decodeLod
function decodeLotKit(raw) {
  if (raw.readUInt32LE(0) !== LOTKIT_MAGIC) throw new Error('city_cook: not a lot kit');
  const hl = raw.readUInt32LE(8), head = JSON.parse(raw.slice(12, 12 + hl).toString('utf8')), base = 12 + hl + ((4 - ((12 + hl) & 3)) & 3);
  const TKA = require(path.join(ROOT, 'tools', 'town_kit.js'));
  const at = r => raw.slice(base + r[0], base + r[0] + r[1]);
  const meshes = head.pieces.map(p => (p.vb ? TKA.decodeLod({ verts: p.verts, tris: p.tris, index: 16, pos: { min: p.box.slice(0, 3), max: p.box.slice(3) }, uv: { min: p.uv.slice(0, 2), max: p.uv.slice(2) }, win: 0 },
    at(p.vb), at(p.ib), Buffer.alloc(0), ['post', 'deck']) : null));
  return { head, meshes };
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
function shippedGz(T, c, stem0) {
  const dir = path.join(ROOT, 'media', ...subOf(T).split('/')), stem = stem0 || stemOf(c.i, c.j);
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.startsWith(stem + '.')) continue;
    const gz = fs.readFileSync(path.join(dir, f));
    try { if (zlib.gunzipSync(gz).equals(c.raw)) return gz; } catch (e) { /* not ours */ }
  }
  return null;
}
function manifestTown(R, srcOf, kitSrc) {
  return {
    id: R.town.id, island: R.town.island, prefix: R.town.prefix, variant: R.town.variant, cell: S, frame: 'world', lod: LOD,
    inputs: R.inputs, propKeys: R.propKeys, archetypes: R.archetypes,
    lotKit: { src: kitSrc, raw: R.lotKit.raw.length, gz: R.lotKit.gz.length, pieces: R.lotKit.pieces }, hash: R.hash, counts: R.counts,
    cells: R.cells.map(c => Object.assign({ c: [c.i, c.j], src: srcOf(c), raw: c.raw.length, gz: c.gz.length, box: c.header.box }, c.n)),
  };
}
function cook(island, opt) {
  opt = opt || {};
  return TOWNS.filter(T => T.island === island).map(T => {
    const R = cookTown(T, opt);
    for (const c of R.cells) c.gz = shippedGz(T, c) || gzOf(c.raw);
    R.lotKit.gz = shippedGz(T, R.lotKit, 'lotkit') || gzOf(R.lotKit.raw);
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
    const kitSrc = report ? 'media/' + sub + '/lotkit.' + crypto.createHash('sha256').update(R.lotKit.gz).digest('hex').slice(0, 8) + '.bin'
                          : (() => { const rel = writeMedia(sub, 'lotkit', 'bin', R.lotKit.gz); keep.push(rel); return rel; })();
    const M = manifestTown(R, srcOf, kitSrc);
    towns.push(M);
    const st = R.stats, n = M.counts;
    let gz = 0, raw = 0, maxTris = 0; for (const c of M.cells) { gz += c.gz; raw += c.raw; maxTris = Math.max(maxTris, c.farTris); }
    console.log('  ' + R.town.id + ': ' + n.cells + ' cells of ' + S + ' m, ' + n.plots + ' plots (' + st.kitPlots + ' kit (' + st.assigned + ' assigned here), ' + st.uniquePlots + ' unique), ' + n.kitRows + ' kit rows (outbuildings: ' + st.outsKit + ' the table\'s, ' + st.outsPlaced + ' placed, ' + st.outsDropped + ' table rows not planned), ' + n.uniques + ' uniques, ' + n.objects + ' objects, ' + n.props + ' props (' + R.propKeys.length + ' keys)');
    console.log('    far: ' + n.farTris + ' tris / ' + n.farVerts + ' verts, at most ' + maxTris + ' tris a cell, 1 draw a cell; ' + (raw / 1e3).toFixed(1) + ' KB raw -> ' + (gz / 1e3).toFixed(1) + ' KB gz; hash ' + R.hash);
    console.log('    lots: ' + n.lots + ' rows (' + Object.entries(st.lotsBy).map(e => e[0] + ' ' + e[1]).join(', ') + '); fences ' + st.fenceGot.toFixed(0) + ' of ' + st.fenceWant.toFixed(0) + ' m; the lot kit ' + R.lotKit.pieces.length + ' pieces, ' + (R.lotKit.raw.length / 1e3).toFixed(1) + ' KB raw -> ' + (R.lotKit.gz.length / 1e3).toFixed(1) + ' KB gz');
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

module.exports = { V, MAGIC, LOTKIT_MAGIC, S, LOD, BUCKETS, GROUND, TOWNS, MEANS, PAINTABLE, VSTRIDE, PSTRIDE, INST, LSTRIDE, PIECE_MAX, OUT, meanFile, cook, cookTown,
  decodeCell, decodeProps, decodeLots, decodeLotKit, lotKitOf, lotRows, shellOf, shellFaces, octEnc, stemOf, subOf, cellOf, keyOf, manifestTown, placesOf, kitOf, tableOf, composedOf };
if (require.main === module) main();
