#!/usr/bin/env node
// VEG_BENCH - the island's mountain tops in node, no browser, no GPU (MOUNTAIN-VEG, 15 Nov 2026).
//
// The user, 15 Nov: "our mountain tops are too bare ... Its first task would be to get pictures of the 3d terrain of
// the mountain tops + the terrain types in false colors + the existing vegetation layer. For working purposes, it may
// develop a bench with simplified rendering, so it can work autonomously."
//
//   node tools/veg_bench.js --out <dir> [--areas skyline,ardent,cabin,north] [--w 760] [--eyes 2] [--subalpine 0]
//
// What it reads: the SHIPPED island (tools/island_node.js: the quadtree, the cover/canopy/ndvi/ttype grids), the
// premises fixture (the strips' and the editor's tree excludes), the shipped biome table (src/core/trees_pack.json
// biomes: code -> mix) and 28c_biomes.js codeOf. What it runs: THE FILL'S OWN RULE, point by point on the fill's own
// lattice (render_world.js walkRows: 160 points a 1024 m chunk = 6.4 m, the same hashes, the same jitter, the same
// order of tests) - so a tree here is a tree the game plants, and every refused point says WHICH rule refused it.
// Kept in step by hand: if walkRows / forestHere / openHere / codeAt change, change plantAt below (GATE: none yet;
// the in-game check is TREE_FILL's probe in a page_rig slot).
//
// Not modelled (said on the page): the puddle skip (fillPoolAt), the town's own record trees, the species' per-subject
// split (the species draw here is by species with the altitude band only), the far stand cards (they follow the
// same mix + canopy), the grass ring's tuft shapes (the map shows the mix's tuft density, what the ring plants
// within 90-220 m of the eye and under 90-150 m AGL - from an aeroplane the summit's grass is the ground's colour).
//
// Output per area: <area>_map.png (top-down: relief | terrain code | trees per ha | the refusing rule | ground cover),
// <area>_eye<k>.png (perspective: relief | terrain code | vegetation with the planted trees), <area>.json (stats by
// altitude band, ridge vs slope), and index.html with the legends.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', null);
if (!OUT) { console.error('usage: node tools/veg_bench.js --out <dir> [--areas skyline,ardent,cabin,north] [--w 760] [--eyes 2]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const PW = +opt('w', 760);
const SUBON = opt('subalpine', '1') !== '0';   // 19 SUBALPINE as the game has it (BIOMES.subCode); --subalpine 0 = the game before it (files *_off)
const SFX = (SUBON ? '' : '_off') + (opt('forestedge', '1') !== '0' ? '' : '_fe0');

const IN = require(path.join(ROOT, 'tools', 'island_node.js'));
global.GROUND_FIELDS = require(path.join(ROOT, 'src', 'core', '28b_ground_fields.js'));   // the splat's knobs, as the page has them
const BIOMES = require(path.join(ROOT, 'src', 'core', '28c_biomes.js'));
const PACK = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'trees_pack.json'), 'utf8'));
const fixture = fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8');
const t0 = Date.now();
const W = IN.islandWorld('jolene', { premises: fixture });
const I = W.island, S = W.SURFACE;
const BIO = BIOMES.make(PACK);
BIO.hold(true);   // the knobs once for the run (28c hold; nothing edits them here)
const O = W.premises && W.premises.overlay;
if (O && O.vegAt) BIO.over = (x, z) => O.vegAt(x, z);
console.log('world', Date.now() - t0, 'ms; premises overlay', !!O);

// ---- the fill's constants and helpers (render_world.js, verbatim where marked) ------------------------------------
const FILL = { ng: 160, island: { from: 0.5, full: 6.0, gain: 1.3, min: 0.45, max: 2.4, biomeGain: 3.5, biomeWobble: 8 } };
const CH = 1024, SPC = CH / FILL.ng;
const hsh = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1013904223) | 0;          // verbatim
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, z, cell, seed) => {                                                       // verbatim
  const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const n = (a, b) => hsh(a * 7 + seed * 131, b * 13 + seed * 17);
  return (n(ix, iz) * (1 - sx) + n(ix + 1, iz) * sx) * (1 - sz) + (n(ix, iz + 1) * (1 - sx) + n(ix + 1, iz + 1) * sx) * sz;
};
const H = (x, z) => W.terrainH(x, z);
const ttypeAt = (x, z) => {                                                                  // verbatim
  const wob = FILL.island.biomeWobble;
  const wx = x + (vnoise(x, z, 23, 5) - 0.5) * 2 * wob, wz = z + (vnoise(x + 77, z - 77, 23, 6) - 0.5) * 2 * wob;
  const k = I.cellAt(wx, wz); return k < 0 ? -1 : I.ttype[k];
};
const slopeAt = (x, z, d) => Math.hypot(H(x + d, z) - H(x - d, z), H(x, z + d) - H(x, z - d)) / (2 * d);
const codeAt = (x, z, r) => { const tt = ttypeAt(x, z); if (tt < 0) return -1;
  return BIO.codeOf(tt, Math.atan(slopeAt(x, z, 8)) * 180 / Math.PI, I.canopyAt(x, z), r); };
const polyMix = (x, z) => { if (!BIO.over) return undefined; const o = BIO.over(x, z); return o === undefined ? undefined : (o && BIO.mixes[o]) ? o : null; };
const premTreeEx = (x, z) => !!(O && O.excludeAt && (O.excludeAt(x, z, 'trees') || O.excludeAt(x, z, 'lot')));
const wet = (x, z, h) => h < 1.5 || W.waterH(x, z) > h;
// 19 SUBALPINE: render_world.js's own hooks, verbatim (BIO.subAt: the vegetation's code; BIO.keepAt: the summits' and ridges' thinning)
BIO.subOn = SUBON;
BIO.subAt = (code, x, z) => (!BIO.subOn || !(code === 2 || code === 7 || code === 14)) ? code
  : BIO.subCode(code, H(x, z), vnoise(x, z, 140, 61), hsh(Math.floor(x * 0.731), Math.floor(z * 0.731) + 97));
BIO.keepAt = (code, x, z, h) => {
  if (code !== BIO.SUBALPINE) return 1;
  const Rr = 110, m = (H(x + Rr, z) + H(x - Rr, z) + H(x, z + Rr) + H(x, z - Rr)) / 4;
  return BIO.subKeep(h, h - m);
};

// FOREST-EDGE (the user 16 Nov via A0, the spec of 25 Oct): --forestedge 0 = the game before it (files *_fe0)
const EDGEON = opt('forestedge', '1') !== '0';
BIO.edgeOn = EDGEON;
const EK = BIO.knobs();
// the game's own (28c_biomes edgeField / edgeRamp / edgeLift / edgeCanIn) on render_world's test: the tree's ground is the forest's, no strip
const edgeD = BIO.edgeField((x, z) => W.treeGround(x, z) === S.FOREST_FLOOR && !W.treeAeroBlocked(x, z));

// THE REFUSING RULE, in the walk's own order
const R = { PLANT: 0, LATTICE: 1, AERO: 2, WATER: 3, BARE: 4, EXCL: 5, NOMIX: 6, CLUMP: 7, CANOPY: 8, THIN: 9 };
const RNAME = ['planted', 'lattice gap (10 %)', 'aerodrome / strip clearance', 'water / shore', 'bare ground class (rock, scree, built)',
  'editor "no trees"', 'no mix, or a mix with no trees (snow, scree, shore)', "the mix's clump gap", 'canopy map under 0.5 m (the ramp says none)', 'thinned by the draw (canopy ramp, NDVI, slope, mix density)'];
const RCOL = [[40, 150, 50], [235, 235, 235], [255, 0, 255], [70, 130, 220], [120, 120, 120], [255, 120, 255], [250, 250, 250], [180, 140, 255], [220, 50, 40], [250, 170, 60]];

// one lattice point: { r: reason, x, z, h, can, mix, code, sp }
function plantAt(ix, iz) {
  if (hsh(ix, iz + 31) < 0.1) return { r: R.LATTICE };
  const x = (ix + 0.5) * SPC + (hsh(ix + 7, iz) - 0.5) * SPC * 1.6;
  const z = (iz + 0.5) * SPC + (hsh(ix, iz + 7) - 0.5) * SPC * 1.6;
  const h = H(x, z);
  const pm = polyMix(x, z);
  if (W.treeAeroBlocked(x, z)) return { r: R.AERO, x, z, h };
  const g = W.treeGround(x, z);
  if (wet(x, z, h)) return { r: R.WATER, x, z, h };
  const forest = g === S.FOREST_FLOOR, open = g === S.GRASS;
  const polyOk = pm && g !== S.PAVED && g !== S.GRAVEL && g !== S.WATER;
  if (!forest && !open && !polyOk) return { r: R.BARE, x, z, h, g };
  if (premTreeEx(x, z)) return { r: R.EXCL, x, z, h };
  let can = I.canopyAt(x, z), floored = false, band = 0, ksz = 1, MFx = null;   // band: the share of the NDVI's thinning the edge lifts (1 to edgeFull, 0 at edgeOut)
  if (EDGEON && forest && pm === undefined && BIO.knobs().edgeIn) { const d = edgeD(x, z); if (d < EK.edgeOut) { band = BIO.edgeLift(d); can = Math.max(can, BIO.edgeCanIn(I.canopyAt, x, z) * BIO.edgeRamp(d)); } }
  // THE OUTWARD BAND (render_world walkRows): outside the forest, the wood's own trees at the band's share and size; a refused
  // point falls back to the open ground's rule
  if (EDGEON && !forest && pm === undefined) { const d = edgeD(x, z);
    const bd = (d < 0 && d > -BIO.edgeReachMax()) ? BIO.edgeBandAt(d, x, z) : null;
    if (bd && hsh(ix + 13, iz + 29) <= bd.p) {
      const gx0 = edgeD(x + 6, z) - edgeD(x - 6, z), gz0 = edgeD(x, z + 6) - edgeD(x, z - 6), gl = Math.hypot(gx0, gz0) || 1;
      const xi = x + gx0 / gl * (-d + 10), zi = z + gz0 / gl * (-d + 10);
      const mI = BIO.mixAt(BIO.subAt(codeAt(xi, zi, hsh(ix + 21, iz + 23)), xi, zi)), MF = mI ? BIO.mixOf(mI).forest : null;
      if (MF && MF.count > 0) { const cI = Math.max(BIO.edgeCanIn(I.canopyAt, xi, zi), MF.canopyFloor || 0, 4);
        return { r: R.PLANT, x, z, h, code: BIO.subAt(codeAt(x, z, hsh(ix + 21, iz + 23)), x, z), mix: mI, can: cI, ksz: bd.k, edge: 1, sp: pickSpecies(mI, hsh(ix + 11, iz + 17), h) }; } } }
  const tt = ttypeAt(x, z);
  const code = BIO.subAt(codeAt(x, z, hsh(ix + 21, iz + 23)), x, z);
  const mix = pm !== undefined ? pm : BIO.mixAt(code);
  let kind = mix ? Math.min(1, BIO.density(mix) * SPC * SPC * FILL.island.biomeGain) : 0;
  if (code === BIO.SUBALPINE && kind > 0) kind *= BIO.keepAt(code, x, z, h);
  if ((tt === 3 || tt === 2) && !pm) can = Math.min(can, 3.0);
  if (mix && pm) { const MF = BIO.mixOf(mix).forest; floored = true; can = Math.max(can, (MF && MF.canopyFloor) || 0, 12); }
  if (mix) { const MF = BIO.mixOf(mix).forest; if (MF && MF.canopyFloor > can) { can = MF.canopyFloor; floored = true; }
    const clH = (MF && MF.clumpUp) ? MF.clump + (MF.clumpUp[2] - MF.clump) * (t => t * t * (3 - 2 * t))(Math.max(0, Math.min(1, (h - MF.clumpUp[0]) / Math.max(1, MF.clumpUp[1] - MF.clumpUp[0])))) : (MF ? MF.clump : 0);   // render_world: clumpUp
    if (MF && clH > 0) { const v = vnoise(x, z, MF.clumpM || 30, 41);
      if (v < clH) { const ce = EDGEON ? (MF.clumpEdge || 0) : 0, t = ce > 0 ? (clH - v) / ce : 1;
        if (t >= 1 || hsh(ix + 51, iz + 53) > (MF.clumpEdgeDens === undefined ? 0.8 : MF.clumpEdgeDens) * Math.pow(1 - t, 1.4)) return { r: R.CLUMP, x, z, h, code, mix, can };
        const K = BIO.knobs(); ksz = K.edgeSizeIn + (K.edgeSizeOut - K.edgeSizeIn) * Math.pow(t, 0.8); }
      else MFx = MF; } }
  if (kind <= 0) return { r: R.NOMIX, x, z, h, code, mix, can };
  let p = floored ? 1 : (can - FILL.island.from) / Math.max(0.5, FILL.island.full - FILL.island.from);
  const p0 = p;
  if (I.ndvi && !floored) { const nd = I.ndvi[I.cellAt(x, z)] / 127 - 1, f = Math.max(0.25, Math.min(1, (nd - 0.3) / 0.35)); p *= f + (1 - f) * band; }
  if (slopeAt(x, z, 8) > 0.7) p *= 0.33;
  p *= kind;
  if (p < 1 && hsh(ix + 13, iz + 29) > p) return { r: p0 <= 0 ? R.CANOPY : R.THIN, x, z, h, code, mix, can, p };
  const P0 = { r: R.PLANT, x, z, h, code, mix, can, ksz, sp: pickSpecies(mix, hsh(ix + 11, iz + 17), h) };
  if (!P0.sp && KIND_TREES(mix)) return { r: R.THIN, x, z, h, code, mix, can };   // out of every species' altitude band
  if (MFx && MFx.extra > 0 && hsh(ix + 61, iz + 67) < MFx.extra) {   // the clump's second tree
    const x2 = x + (hsh(ix + 71, iz + 73) - 0.5) * SPC * 0.9, z2 = z + (hsh(ix + 79, iz + 83) - 0.5) * SPC * 0.9;
    if (!premTreeEx(x2, z2)) P0.extra = { r: R.PLANT, x: x2, z: z2, h: H(x2, z2), code, mix, can, ksz: 1, sp: pickSpecies(mix, hsh(ix + 977 + 11, iz + 541 + 17), h) }; }
  return P0;
}

const KIND_TREES = mix => { const M = BIO.mixOf(mix); return !!(M && M.species && Object.keys(M.species).some(k => KIND[k] === 'tree' || KIND[k] === 'dead')); };
// the species, by the mix's proportions and the fill's altitude bands (SPECIES_PREF) - not the per-subject patches
const SPECIES_PREF = { 'cedar_tree.glb': [0, 90], 'realistic_fir_trees_pack_lods_gameready.glb': [0, 160], 'fir_tree_georgeous.glb': [30, 220],
  'spruce_tree.glb': [70, 320], 'larch_tree.glb': [150, 460] };
const KIND = {}; for (const c of PACK.collections) KIND[c.name || c.key || c.id] = c.kind;
const MODEL_H = {}; for (const c of PACK.collections) { const s = c.subjects && c.subjects[0]; if (s && s.h) MODEL_H[c.name || c.key || c.id] = s.h * ((c.place && c.place.size) || 1); }
function pickSpecies(mix, r, h) {
  const M = BIO.mixOf(mix); if (!M || !M.species) return null;
  const pool = [];
  for (const [sp, o] of Object.entries(M.species)) { if (KIND[sp] !== 'tree' && KIND[sp] !== 'dead') continue;
    let w = (o && o.proportion !== undefined) ? o.proportion : 1; const b = SPECIES_PREF[sp];
    if (b) { const out = h < b[0] ? b[0] - h : h > b[1] ? h - b[1] : 0; w *= Math.max(0.25, 1 - out / 60 * 0.75); }
    if (o && Array.isArray(o.alt)) { const [lo, hi, f] = o.alt, fd = Math.max(1, f || 40); w *= h < lo ? Math.max(0, 1 - (lo - h) / fd) : h > hi ? Math.max(0, 1 - (h - hi) / fd) : 1; }   // render_world speciesWeight: a row's altitude band
    if (w > 0) pool.push([sp, w]); }
  let tot = 0; for (const e of pool) tot += e[1]; let a = r * tot;
  if (!(tot > 0)) return null;   // every species out of its band: no tree
  for (const e of pool) { a -= e[1]; if (a <= 0) return e[0]; }
  return pool.length ? pool[pool.length - 1][0] : null;
}

// ---- colours ------------------------------------------------------------------------------------------------------
const CODE_COL = { 0: [31, 78, 121], 1: [58, 123, 213], 2: [214, 190, 90], 3: [138, 109, 59], 4: [232, 217, 160], 5: [165, 159, 148], 6: [110, 106, 102],
  7: [154, 205, 50], 8: [46, 125, 50], 9: [255, 255, 255], 10: [208, 80, 80], 11: [140, 140, 124], 12: [60, 50, 50], 13: [20, 80, 30], 14: [107, 142, 35],
  15: [0, 192, 96], 16: [0, 128, 106], 18: [90, 200, 200], 19: [230, 90, 160] };
const CODE_NAME = Object.assign({}, BIOMES.NAMES);
const shadeOf = (x, z, d) => {   // a NW sun, the relief's own normal
  const dx = (H(x + d, z) - H(x - d, z)) / (2 * d), dz = (H(x, z + d) - H(x, z - d)) / (2 * d);
  const n = [-dx, 1, -dz], l = Math.hypot(...n), L = [-0.5, 0.75, -0.43];
  return Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / l / Math.hypot(...L));
};
const hyps = h => { // a hypsometric tint for the relief panel
  const st = [[0, [92, 130, 80]], [200, [150, 160, 110]], [500, [190, 175, 140]], [800, [205, 200, 195]], [1100, [250, 250, 250]]];
  for (let i = 1; i < st.length; i++) if (h <= st[i][0]) { const t = (h - st[i - 1][0]) / (st[i][0] - st[i - 1][0]); return st[i - 1][1].map((v, k) => v + (st[i][1][k] - v) * t); }
  return st[st.length - 1][1];
};
// trees per hectare: 0 (none) -> sparse -> the forest's full grid (~220/ha)
const densCol = d => { if (d <= 0) return null; const t = Math.min(1, d / 220); return [Math.round(240 - 200 * t), Math.round(240 - 90 * t), Math.round(120 - 90 * t)]; };

// ---- PNG -----------------------------------------------------------------------------------------------------------
const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy ? rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3) : null; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// side-by-side panels with a 6 px gutter
function compose(panels, w, h) {
  const G = 6, TW = panels.length * w + (panels.length - 1) * G, img = Buffer.alloc(TW * h * 3, 255);
  panels.forEach((P, k) => { for (let y = 0; y < h; y++) P.copy(img, (y * TW + k * (w + G)) * 3, y * w * 3, (y + 1) * w * 3); });
  return { img, TW };
}

// ---- the areas ---------------------------------------------------------------------------------------------------
// centres from the fixture (tw_s_summit, mt_s_meteo, w1) and a 200 m peak scan of the shipped DEM
const AREAS = {
  skyline: { name: 'Skyline / tw_ski (tram summit 697 m, peak 687 m)', cx: 200, cz: -7700, half: 1800, marks: [[277, -7868, 'tram summit'], [310, -7844, 'tw_ski stand']],
    // the altiport: from 90 m over the ground 820 m east-north-east, looking at its stand; the tram: 70 m over the ground at mid-span, looking up at the summit station
    eyesAt: [{ name: 'altiport', from: [1000, -7500, 90], at: [250, -7860, 10] }, { name: 'tram', from: [-760, -7900, 70], at: [277, -7868, 20] }] },
  ardent: { name: 'Mount Ardent (1 096 m, meteo station)', cx: 9112, cz: -5850, half: 2200, marks: [[9112, -5882, 'meteo']] },
  cabin: { name: 'The ridges round the Cabin Strip (peaks 876, 790, 786, 742 m)', cx: 300, cz: -15500, half: 3000, marks: [[2670, -15908, 'Cabin Strip'], [4361, -16251, 'Hiking Strip']] },
  north: { name: 'The north summit (853 m) and its ridge', cx: 6176, cz: -2391, half: 2000, marks: [] },
  // FOREST-EDGE: the home field's woods - the western forest's edge over the open muskeg, from 40 m over the field 600 m east
  home: { name: 'Home field and its woods (the forest edges)', cx: -1600, cz: 0, half: 1500, marks: [], eyesAt: [{ name: 'west edge', from: [-1900, -200, 40], at: [-2520, -200, 8] },
    { name: 'west edge ground', from: [-2330, -260, 1.7], at: [-2560, -200, 7] }, { name: 'west edge ground2', from: [-2420, -120, 1.7], at: [-2600, -150, 7] }, { name: 'west edge high', from: [-1500, -200, 160], at: [-2450, -200, 0] },
    { name: 'muskeg 40', from: [-1700, 850, 40], at: [-1700, 1400, 4] }, { name: 'muskeg ground', from: [-1700, 1150, 1.7], at: [-1700, 1400, 5] }] },
};
const want = (opt('areas', Object.keys(AREAS).filter(k => k !== 'home').join(','))).split(',');

function runArea(key) {
  const A = AREAS[key], x0 = A.cx - A.half, z0 = A.cz - A.half, SZ = 2 * A.half;
  const ta = Date.now();
  // 1. the walk, every lattice point of the window
  const ix0 = Math.floor(x0 / SPC) - 1, ix1 = Math.ceil((x0 + SZ) / SPC) + 1, iz0 = Math.floor(z0 / SPC) - 1, iz1 = Math.ceil((z0 + SZ) / SPC) + 1;
  const C = 20, NC = Math.ceil(SZ / C);                         // the 20 m stats cell
  const cnt = new Float32Array(NC * NC), why = Array.from({ length: R.THIN + 1 }, () => new Float32Array(NC * NC));
  const trees = [];
  const bands = {};   // altitude band (50 m) -> { pts, reasons[], planted, ridge: {pts, planted} }
  const ridgeAt = (x, z, h) => h - (H(x + 120, z) + H(x - 120, z) + H(x, z + 120) + H(x, z - 120) + H(x + 85, z + 85) + H(x - 85, z - 85) + H(x + 85, z - 85) + H(x - 85, z + 85)) / 8;
  const spCount = {}, mixStat = {};
  for (let iz = iz0; iz < iz1; iz++) for (let ix = ix0; ix < ix1; ix++) {
    const P = plantAt(ix, iz);
    if (P.x === undefined) continue;
    const ci = Math.floor((P.x - x0) / C), cj = Math.floor((P.z - z0) / C);
    if (ci < 0 || cj < 0 || ci >= NC || cj >= NC) continue;
    const k = cj * NC + ci;
    why[P.r][k]++;
    if (P.mix) { const Q = mixStat[P.mix] || (mixStat[P.mix] = { pts: 0, gap: 0, trees: 0 }); Q.pts++; if (P.r === R.CLUMP) Q.gap++; if (P.r === R.PLANT) Q.trees += P.extra ? 2 : 1; }
    if (P.r === R.PLANT) { cnt[k]++; trees.push(P); spCount[P.sp] = (spCount[P.sp] || 0) + 1; if (P.extra) { cnt[k]++; trees.push(P.extra); spCount[P.extra.sp] = (spCount[P.extra.sp] || 0) + 1; } }
    if (P.r === R.WATER || P.h < 2) continue;
    const b = Math.floor(P.h / 50) * 50, B = bands[b] || (bands[b] = { pts: 0, planted: 0, reasons: new Array(R.THIN + 1).fill(0), codes: {}, ridgePts: 0, ridgePlanted: 0 });
    B.pts++; B.reasons[P.r]++; if (P.r === R.PLANT) B.planted += P.extra ? 2 : 1;
    if (P.code !== undefined) B.codes[P.code] = (B.codes[P.code] || 0) + 1; else { const c0 = ttypeAt(P.x, P.z); B.codes[c0] = (B.codes[c0] || 0) + 1; }
    if (ridgeAt(P.x, P.z, P.h) > 12) { B.ridgePts++; if (P.r === R.PLANT) B.ridgePlanted++; }
  }
  const tWalk = Date.now() - ta;

  // 2. the top-down maps, PW px square each
  const N = PW, pxM = SZ / N;
  const relief = Buffer.alloc(N * N * 3), code = Buffer.alloc(N * N * 3), dens = Buffer.alloc(N * N * 3), reason = Buffer.alloc(N * N * 3), cover = Buffer.alloc(N * N * 3);
  const codeShare = {};
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) * pxM, z = z0 + (j + 0.5) * pxM, h = H(x, z), sh = shadeOf(x, z, pxM), o = (j * N + i) * 3;
    const lit = 0.35 + 0.75 * sh, wt = wet(x, z, Math.max(h, 1.6)) && h < 1.5;
    const hy = hyps(h); for (let q = 0; q < 3; q++) relief[o + q] = Math.min(255, hy[q] * lit);
    const cd = BIO.subAt(codeAt(x, z, hsh(i * 7 + 3, j * 13 + 5)), x, z);
    codeShare[cd] = (codeShare[cd] || 0) + 1;
    const cc = CODE_COL[cd] || [255, 0, 0]; for (let q = 0; q < 3; q++) code[o + q] = Math.min(255, cc[q] * (0.55 + 0.5 * sh));
    const ci = Math.min(NC - 1, Math.floor((x - x0) / C)), cj = Math.min(NC - 1, Math.floor((z - z0) / C)), k = cj * NC + ci;
    const d = cnt[k] / (C * C) * 1e4;   // trees / ha
    const g = 0.55 + 0.5 * sh, base = [hy[0] * 0.25 + 170, hy[1] * 0.25 + 170, hy[2] * 0.25 + 170];
    const dc = densCol(d); for (let q = 0; q < 3; q++) dens[o + q] = Math.min(255, (dc ? dc[q] : base[q]) * g);
    // the dominant refusing rule of the cell (planted wins if anything stands)
    let best = R.PLANT, bv = cnt[k] > 0 ? 1e9 : -1;
    for (let r = 2; r <= R.THIN; r++) if (why[r][k] > bv) { bv = why[r][k]; best = r; }
    if (bv <= 0) best = R.LATTICE;
    const rc = best === R.PLANT ? (dc || RCOL[0]) : RCOL[best]; for (let q = 0; q < 3; q++) reason[o + q] = Math.min(255, rc[q] * g);
    // the ground cover the mix gives (the grass field's tufts + the cover ring's flowers / shrubs / rocks), per m2
    const mix = BIO.mixHere(cd, x, z), M = mix ? BIO.mixOf(mix) : null;
    let tuft = 0, shrub = 0, rock = 0;
    if (M && !wt) { for (const [sp, o2] of Object.entries(M.species || {})) if (o2 && o2.density !== undefined && KIND[sp] === 'cover') tuft += o2.density;
      shrub = (M.forest && M.forest.under) || 0; rock = (M.forest && M.forest.rocks) || 0; }
    const tg = Math.min(1, tuft / 1.5), sg = Math.min(1, shrub / 20), rg = Math.min(1, rock / 15);
    const cv = wt ? [70, 130, 220] : [235 - 150 * tg - 40 * sg + 0 * rg, 235 - 60 * tg - 80 * sg - 60 * rg, 235 - 180 * tg - 60 * sg - 40 * rg];
    for (let q = 0; q < 3; q++) cover[o + q] = Math.max(0, Math.min(255, cv[q] * g));
  }
  // marks: a black ring with a white core
  for (const [mx, mz] of A.marks) { const ci = (mx - x0) / pxM, cj = (mz - z0) / pxM;
    for (const P of [relief, code, dens, reason, cover]) for (let a = 0; a < 64; a++) for (const rr of [6, 7, 8]) { const i = Math.round(ci + rr * Math.cos(a / 10.18)), j = Math.round(cj + rr * Math.sin(a / 10.18));
      if (i >= 0 && j >= 0 && i < N && j < N) { const o = (j * N + i) * 3; const v = rr === 7 ? 255 : 0; P[o] = v; P[o + 1] = rr === 7 ? 40 : 0; P[o + 2] = rr === 7 ? 200 : 0; } } }
  // the planted trees as dots on the density panel (every tree, 1 px dark green) when the scale lets them read
  if (pxM <= 6) for (const T of trees) { const i = Math.floor((T.x - x0) / pxM), j = Math.floor((T.z - z0) / pxM); if (i >= 0 && j >= 0 && i < N && j < N) { const o = (j * N + i) * 3; dens[o] = 20; dens[o + 1] = 70; dens[o + 2] = 25; } }
  const { img, TW } = compose([relief, code, dens, reason, cover], N, N);
  writePNG(path.join(OUT, key + SFX + '_map.png'), TW, N, img);

  // 3. the eyes: a perspective of the window from two sides, the three layers
  const eyes = [];
  const EYEN = +opt('eyes', 2);
  for (const E of (A.eyesAt || [])) {
    const ey = [E.from[0], H(E.from[0], E.from[1]) + E.from[2], E.from[1]], at = [E.at[0], H(E.at[0], E.at[1]) + E.at[2], E.at[1]];
    const P3 = renderEye(A, x0, z0, SZ, ey, at, trees);
    const { img: im2, TW: tw2 } = compose(P3.panels, P3.w, P3.h);
    const f = key + SFX + '_' + E.name + '.png'; writePNG(path.join(OUT, f), tw2, P3.h, im2); eyes.push({ file: f, eye: ey.map(v => v | 0), name: E.name });
  }
  const peak = (() => { let b = [A.cx, A.cz, -1e9]; for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) { const x = x0 + (i + 0.5) * SZ / 60, z = z0 + (j + 0.5) * SZ / 60, h = H(x, z); if (h > b[2]) b = [x, z, h]; } return b; })();
  for (let e = 0; e < EYEN; e++) {
    const az = [-2.4, 0.6, 2.0, -0.6][e];   // from the SW, then the NE (radians, 0 = +x)
    const dist = A.half * 1.05, eh = peak[2] + A.half * 0.55;
    const ex = peak[0] + Math.cos(az) * dist, ez = peak[1] + Math.sin(az) * dist;
    const P3 = renderEye(A, x0, z0, SZ, [ex, eh, ez], [peak[0] - Math.cos(az) * A.half * 0.25, peak[2] - A.half * 0.3, peak[1] - Math.sin(az) * A.half * 0.25], trees);
    const { img: im2, TW: tw2 } = compose(P3.panels, P3.w, P3.h);
    const f = key + SFX + '_eye' + (e + 1) + '.png'; writePNG(path.join(OUT, f), tw2, P3.h, im2); eyes.push({ file: f, eye: [ex | 0, eh | 0, ez | 0] });
  }

  // 4. the stats
  const stat = { key, name: A.name, window: [x0, z0, SZ], peak: peak.map(v => Math.round(v)), walkMs: tWalk, trees: trees.length, species: spCount, bands: {}, mixes: {} };
  for (const m in mixStat) { const Q = mixStat[m], ha = SPC * SPC / 1e4; stat.mixes[m] = { pts: Q.pts, openShare: +(100 * Q.gap / Q.pts).toFixed(1), treesPerHa: +(Q.trees / Q.pts / ha).toFixed(1), treesPerHaInClumps: +(Q.trees / Math.max(1, Q.pts - Q.gap) / ha).toFixed(1) }; }
  for (const b of Object.keys(bands).map(Number).sort((a, c) => a - c)) { const B = bands[b];
    const shares = {}; B.reasons.forEach((n, r) => { if (n && r !== R.LATTICE) shares[RNAME[r]] = +(100 * n / B.pts).toFixed(1); });
    const cs = {}; for (const c in B.codes) cs[CODE_NAME[c] || c] = +(100 * B.codes[c] / B.pts).toFixed(1);
    stat.bands[b] = { landPts: B.pts, treesPerHa: +(B.planted / B.pts / (SPC * SPC) * 1e4).toFixed(1), plantedShare: +(100 * B.planted / B.pts).toFixed(1),
      ridgeShare: +(100 * B.ridgePts / B.pts).toFixed(1), ridgeTreesPerHa: B.ridgePts ? +(B.ridgePlanted / B.ridgePts / (SPC * SPC) * 1e4).toFixed(1) : null, reasons: shares, codes: cs }; }
  // the treeline: the highest 50 m band holding 10+ trees/ha
  let tl = null; for (const b in stat.bands) if (stat.bands[b].treesPerHa >= 10) tl = Math.max(tl || 0, +b);
  stat.treeline50 = tl;
  fs.writeFileSync(path.join(OUT, key + SFX + '.json'), JSON.stringify(stat, null, 1) + '\n');
  console.log(key, 'walk', tWalk, 'ms, trees', trees.length, 'treeline band', tl, 'total', Date.now() - ta, 'ms');
  return { stat, eyes, map: key + SFX + '_map.png' };
}

// ---- the perspective rasteriser: the window's heightfield as triangles (z-buffer, per-vertex colour, a NW sun) -----
function renderEye(A, x0, z0, SZ, eye, at, trees) {
  const w = Math.round(PW * 0.9), h = Math.round(w * 0.62), fov = 0.9;
  const f = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], fl = Math.hypot(...f); f[0] /= fl; f[1] /= fl; f[2] /= fl;
  let r = [f[2], 0, -f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);   // right = f x up
  r = [-r[0], 0, -r[2]];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const fk = (w / 2) / Math.tan(fov / 2);
  const proj = (x, y, z) => { const d = [x - eye[0], y - eye[1], z - eye[2]], cz = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    if (cz < 5) return null; const cx = d[0] * r[0] + d[1] * r[1] + d[2] * r[2], cy = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    return [w / 2 + cx / cz * fk, h / 2 - cy / cz * fk, cz]; };
  const G = Math.min(520, Math.round(SZ / 8)), st = SZ / G;
  const V = [], cols = [[], [], []];
  for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
    const x = x0 + i * st, z = z0 + j * st, hh = H(x, z), sh = shadeOf(x, z, st), lit = 0.3 + 0.8 * sh;
    V.push(proj(x, Math.max(hh, -0.4), z));
    const hy = hyps(hh), seaV = hh < 0.2;
    cols[0].push(seaV ? [70, 120, 190] : hy.map(v => v * lit));
    const cd = BIO.subAt(codeAt(x, z, hsh(i, j)), x, z); const cc = CODE_COL[cd] || [255, 0, 0]; cols[1].push(cc.map(v => v * (0.5 + 0.55 * sh)));
    const ground = seaV ? [70, 120, 190] : [200 * lit * 0.8 + 30, 195 * lit * 0.8 + 30, 175 * lit * 0.8 + 25];
    cols[2].push(ground);
  }
  const panels = [0, 1, 2].map(() => Buffer.alloc(w * h * 3));
  const sky = [[200, 220, 240], [235, 235, 235], [215, 228, 240]];
  panels.forEach((P, k) => { for (let i = 0; i < w * h; i++) { P[i * 3] = sky[k][0]; P[i * 3 + 1] = sky[k][1]; P[i * 3 + 2] = sky[k][2]; } });
  const Z = new Float32Array(w * h).fill(1e30);
  const tri = (a, b, c, ca, cb, cc) => {
    if (!a || !b || !c) return;
    const minx = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxx = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const miny = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxy = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const ar = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(ar) < 1e-9) return;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / ar, w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / ar, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const zz = w0 * a[2] + w1 * b[2] + w2 * c[2], q = y * w + x; if (zz >= Z[q]) continue; Z[q] = zz;
      for (let k = 0; k < 3; k++) { const P = panels[k], A0 = cols[k][ca], B0 = cols[k][cb], C0 = cols[k][cc];
        P[q * 3] = Math.min(255, w0 * A0[0] + w1 * B0[0] + w2 * C0[0]); P[q * 3 + 1] = Math.min(255, w0 * A0[1] + w1 * B0[1] + w2 * C0[1]); P[q * 3 + 2] = Math.min(255, w0 * A0[2] + w1 * B0[2] + w2 * C0[2]); }
    }
  };
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const a = j * (G + 1) + i, b = a + 1, c = a + G + 1, d = c + 1;
    tri(V[a], V[b], V[d], a, b, d); tri(V[a], V[d], V[c], a, d, c);
  }
  // the trees on the vegetation panel: a cone per planted tree, its height ~ the fill's size rule (1.3 x canopy, the
  // model's own height x [0.45, 2.4]), drawn as a vertical stroke tested against the terrain's depth
  const P = panels[2];
  for (const T of trees) {
    const mh = MODEL_H[T.sp] || 12, th = (T.ksz !== undefined && T.ksz < 1) ? Math.max(0.1 * mh, Math.min(FILL.island.max * mh, (T.can || 0) * T.ksz * FILL.island.gain))
      : Math.max(FILL.island.min * mh, Math.min(FILL.island.max * mh, (T.can || 0) * FILL.island.gain)) || 6;
    const b0 = proj(T.x, T.h, T.z), t1 = proj(T.x, T.h + th, T.z); if (!b0 || !t1) continue;
    const dead = KIND[T.sp] === 'dead', small = th < 8;
    const col = dead ? [120, 100, 80] : small ? [70, 150, 40] : [25, 85, 35];
    const y0 = Math.round(t1[1]), y1 = Math.round(b0[1]), x = Math.round(b0[0]), hw = Math.max(0, Math.round(th / b0[2] * fk * 0.18));
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) { const t = (y - y0) / Math.max(1, y1 - y0), half = Math.round(hw * t);
      for (let xx = x - half; xx <= x + half; xx++) { if (xx < 0 || xx >= w) continue; const q = y * w + xx; if (b0[2] - 3 > Z[q]) continue;
        P[q * 3] = col[0]; P[q * 3 + 1] = col[1]; P[q * 3 + 2] = col[2]; } }
  }
  return { panels, w, h };
}

// ---- --edge: THE FOREST BORDER (FOREST-EDGE, the user 16 Nov via A0: "the sides of the forested areas often show the forest
// ground with no trees in them anymore ... a ramp of tree sizes on the surroundings, then bushes"; the spec of 25 Oct: weeds 6-3 m
// outside, shrubs 3-0 m outside, young trees 0-6 m inside, medium 6-20 m, full beyond, never under x0.7). Every lattice point of the
// window by its signed distance to the forest's edge (+ inside the FOREST_FLOOR ground the fill reads, - outside), 2 m bands: the
// share planted, the refusing rule, the canopy map's height and the tree's size factor (the fill's: canopy x gain / the model's
// height, clamped min..max) against the interior's. Map: the forest ground with no tree within 6 m (orange) - the bare rim.
function edgeArea(key) {
  const A = AREAS[key], x0 = A.cx - A.half, z0 = A.cz - A.half, SZ = 2 * A.half, ta = Date.now();
  const g = 2.5, NG = Math.ceil(SZ / g), F = new Uint8Array(NG * NG);
  for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const x = x0 + (i + 0.5) * g, z = z0 + (j + 0.5) * g;
    F[j * NG + i] = W.treeGround(x, z) === S.FOREST_FLOOR && !wet(x, z, H(x, z)) && !W.treeAeroBlocked(x, z) ? 1 : 0; }
  // two chamfer passes (3-4 weights, metres), the distance to the nearest cell of the other side
  const dist = inside => { const D = new Float32Array(NG * NG); const BIG = 1e9;
    for (let k = 0; k < D.length; k++) D[k] = (F[k] === (inside ? 1 : 0)) ? BIG : 0;
    const a = g, b = g * Math.SQRT2;
    for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const k = j * NG + i; if (!D[k]) continue; let v = D[k];
      if (i > 0) v = Math.min(v, D[k - 1] + a); if (j > 0) { v = Math.min(v, D[k - NG] + a); if (i > 0) v = Math.min(v, D[k - NG - 1] + b); if (i < NG - 1) v = Math.min(v, D[k - NG + 1] + b); } D[k] = v; }
    for (let j = NG - 1; j >= 0; j--) for (let i = NG - 1; i >= 0; i--) { const k = j * NG + i; if (!D[k]) continue; let v = D[k];
      if (i < NG - 1) v = Math.min(v, D[k + 1] + a); if (j < NG - 1) { v = Math.min(v, D[k + NG] + a); if (i < NG - 1) v = Math.min(v, D[k + NG + 1] + b); if (i > 0) v = Math.min(v, D[k + NG - 1] + b); } D[k] = v; }
    return D; };
  const Din = dist(true), Dout = dist(false);
  const sd = (x, z) => { const i = Math.floor((x - x0) / g), j = Math.floor((z - z0) / g); if (i < 0 || j < 0 || i >= NG || j >= NG) return null;
    const k = j * NG + i; return F[k] ? Din[k] - g / 2 : -(Dout[k] - g / 2); };
  const ix0 = Math.floor(x0 / SPC), ix1 = Math.ceil((x0 + SZ) / SPC), iz0 = Math.floor(z0 / SPC), iz1 = Math.ceil((z0 + SZ) / SPC);
  const BW = 2, BMIN = -48, BMAX = 60, NB = (BMAX - BMIN) / BW, bins = Array.from({ length: NB }, () => ({ n: 0, planted: 0, can: 0, size: 0, reasons: new Array(R.THIN + 1).fill(0), codes: {} }));
  const deep = { n: 0, planted: 0, can: 0, size: 0 };
  const trees = [];
  const sizeOf = P => { const mh = MODEL_H[P.sp] || 12; return (P.ksz !== undefined && P.ksz < 1) ? Math.max(0.1, Math.min(FILL.island.max, P.can * P.ksz * FILL.island.gain / mh)) : Math.max(FILL.island.min, Math.min(FILL.island.max, P.can * FILL.island.gain / mh)); };
  for (let iz = iz0; iz < iz1; iz++) for (let ix = ix0; ix < ix1; ix++) {
    const P = plantAt(ix, iz); if (P.x === undefined || P.r === R.LATTICE || P.r === R.AERO || P.r === R.WATER) continue;
    const d = sd(P.x, P.z); if (d === null) continue;
    if (P.r === R.PLANT) trees.push([P.x, P.z]);
    const B = d >= BMAX ? deep : d < BMIN ? null : bins[Math.floor((d - BMIN) / BW)]; if (!B) continue;
    B.n++; B.can += P.can || 0; if (B.reasons) B.reasons[P.r]++;
    if (B.codes) { const cd = BIO.subAt(codeAt(P.x, P.z, hsh(ix + 21, iz + 23)), P.x, P.z); B.codes[cd] = (B.codes[cd] || 0) + 1; }
    if (P.r === R.PLANT) { B.planted++; B.size += sizeOf(P); }
  }
  // the map: relief grey, forest ground green, forest ground with no tree within 6 m orange, trees dark dots
  const N = PW, pxM = SZ / N, img = Buffer.alloc(N * N * 3), TC = 6, NT = Math.ceil(SZ / TC), tgrid = new Uint8Array(NT * NT);
  for (const [x, z] of trees) { const i = Math.floor((x - x0) / TC), j = Math.floor((z - z0) / TC);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < NT && b < NT) tgrid[b * NT + a] = 1; } }
  let rimPx = 0, forPx = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) * pxM, z = z0 + (j + 0.5) * pxM, o = (j * N + i) * 3, lit = 0.45 + 0.6 * shadeOf(x, z, pxM), h = H(x, z);
    const gi = Math.min(NG - 1, Math.floor((x - x0) / g)), gj = Math.min(NG - 1, Math.floor((z - z0) / g)), fo = F[gj * NG + gi];
    const near = tgrid[Math.min(NT - 1, Math.floor((z - z0) / TC)) * NT + Math.min(NT - 1, Math.floor((x - x0) / TC))];
    let c = wet(x, z, h) && h < 1.5 ? [90, 130, 190] : [200, 200, 190];
    if (fo) { forPx++; c = near ? [70, 140, 70] : [240, 150, 40]; if (!near) rimPx++; }
    for (let q = 0; q < 3; q++) img[o + q] = Math.min(255, c[q] * lit);
  }
  for (const [x, z] of trees) { const i = Math.floor((x - x0) / pxM), j = Math.floor((z - z0) / pxM); if (i >= 0 && j >= 0 && i < N && j < N) { const o = (j * N + i) * 3; img[o] = 20; img[o + 1] = 60; img[o + 2] = 20; } }
  const file = key + '_edge' + SFX + '.png'; writePNG(path.join(OUT, file), N, N, img);
  const rows = bins.map((B, k) => ({ d: BMIN + k * BW, n: B.n, planted: B.n ? +(B.planted / B.n).toFixed(3) : 0, can: B.n ? +(B.can / B.n).toFixed(2) : 0,
    size: B.planted ? +(B.size / B.planted).toFixed(2) : 0, codes: Object.fromEntries(Object.entries(B.codes).map(([c, v]) => [c, Math.round(100 * v / Math.max(1, B.n))]).filter(e => e[1] >= 3)), reasons: Object.fromEntries(B.reasons.map((v, r) => [RNAME[r].split(' (')[0], B.n ? Math.round(100 * v / B.n) : 0]).filter(e => e[1] > 0)) }));
  const out = { key, name: A.name, file, deep: { n: deep.n, planted: +(deep.planted / Math.max(1, deep.n)).toFixed(3), can: +(deep.can / Math.max(1, deep.n)).toFixed(2), size: +(deep.size / Math.max(1, deep.planted)).toFixed(2) },
    bareForestShare: +(rimPx / Math.max(1, forPx)).toFixed(3), rows, ms: Date.now() - ta };
  fs.writeFileSync(path.join(OUT, key + '_edge' + SFX + '.json'), JSON.stringify(out, null, 1));
  console.log(`${key}: deep (>${BMAX} m in) planted ${out.deep.planted} can ${out.deep.can} size ${out.deep.size}; forest ground with no tree within 6 m ${(100 * out.bareForestShare).toFixed(1)} %; ${out.ms} ms`);
  for (const r of rows) console.log(`  ${String(r.d).padStart(4)}..${String(r.d + BW).padStart(3)} m  pts ${String(r.n).padStart(6)}  planted ${(100 * r.planted).toFixed(0).padStart(3)} %  can ${r.can.toFixed(1).padStart(5)}  size ${r.size.toFixed(2)}  ${Object.entries(r.reasons).filter(([k]) => k !== 'planted').sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + v + '%').join('; ')}`);
  return out;
}
if (opt('edge', null)) {
  const list = opt('edge').split(','), res = list.filter(k => AREAS[k]).map(edgeArea);
  fs.writeFileSync(path.join(OUT, 'edge' + SFX + '.json'), JSON.stringify(res, null, 1));
  console.log('done', Date.now() - t0, 'ms ->', OUT); process.exit(0);
}

const results = [];
for (const k of want) if (AREAS[k]) results.push(runArea(k));

// ---- the page: legends + pictures + the band tables -----------------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sw = c => `<span class="sw" style="background:rgb(${c.join(',')})"></span>`;
const mixOf = c => BIO.mixAt(+c) || '-';
let html = `<!doctype html><meta charset="utf-8"><title>veg bench</title><style>body{font:14px system-ui;margin:16px;background:#fafafa}img{max-width:100%;border:1px solid #ccc}
.sw{display:inline-block;width:14px;height:14px;border:1px solid #888;vertical-align:middle;margin-right:4px}table{border-collapse:collapse;font-size:12px}td,th{border:1px solid #ddd;padding:2px 6px;text-align:right}</style>
<h1>veg_bench - the mountain tops</h1><p>Panels (map): relief | terrain code | trees per ha (dots: every tree) | the rule that refuses | ground cover. Eyes: relief | terrain code | the planted trees.</p>
<h3>Terrain codes (ttype + the derived 12/13/14) -> the biome mix the game plants</h3><p>${Object.keys(CODE_COL).map(c => sw(CODE_COL[c]) + esc((CODE_NAME[c] || c) + ' -> ' + mixOf(c))).join(' &nbsp; ')}</p>
<h3>The refusing rule</h3><p>${RNAME.map((n, i) => i === 1 ? '' : sw(RCOL[i]) + esc(n)).join(' &nbsp; ')}</p>`;
for (const R0 of results) {
  const s = R0.stat;
  html += `<h2>${esc(s.name)}</h2><p>peak ${s.peak[2]} m; ${s.trees} trees planted in the window; treeline (10+ trees/ha) at the ${s.treeline50} m band</p><img src="${R0.map}">` + R0.eyes.map(e => `<img src="${e.file}">`).join('');
  html += '<table><tr><th>band m</th><th>trees/ha</th><th>ridge trees/ha</th><th>ridge %</th><th>codes</th><th>refused by</th></tr>' + Object.entries(s.bands).filter(([b]) => +b >= 300).map(([b, B]) =>
    `<tr><td>${b}</td><td>${B.treesPerHa}</td><td>${B.ridgeTreesPerHa}</td><td>${B.ridgeShare}</td><td style="text-align:left">${esc(Object.entries(B.codes).sort((a, c) => c[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v + '%').join(', '))}</td><td style="text-align:left">${esc(Object.entries(B.reasons).sort((a, c) => c[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v + '%').join('; '))}</td></tr>`).join('') + '</table>';
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('done', Date.now() - t0, 'ms ->', OUT);
