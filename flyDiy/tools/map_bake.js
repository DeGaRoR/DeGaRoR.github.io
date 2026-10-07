#!/usr/bin/env node
// map_bake.js - THE 2-D ISLAND MAP (G2250, MAP-MENU; futureDesigns/GAME-2026-10-06.md §8.2: "the island as a 2-D map,
// not the 3-D world, baked once in node from the island data: shore, height tint, forest, roads, runways, ~1-2 MB,
// phone-safe"). One indexed PNG and the projection that places anything on it:
//
//   media/map/jolene_map.<h8>.png    the picture: the shore (the coast grid's waterline, two depth bands), the height
//                                    tint (bands) under a hillshade, the forest (WorldCover's tree class), the lakes,
//                                    the premises record's roads, the 8 runways AT TRUE SCALE AND HEADING (a water
//                                    lane as a lighter lane), the hangar plots (BASE_OFFERS), a 1 km grid (5 km bold)
//                                    labelled in km from the world origin, a km scale bar and a north mark
//   media/map/jolene_proj.<h8>.json  the projection: px = (x - x0) / mpp, py = (z - z0) / mpp (north up: -z is north),
//                                    the aerodromes (id, name, kind, x, z, hdg, len, wid, the surface, the elevation),
//                                    the plots, and the picture's name, size and hash
//   src/viewer/map_pack.js           window.MAP_PACK = that projection - the MAP screen's lazy script (build.js
//                                    MANIFEST.lazy 'map_pack'), so the page learns the hashed names without a fetch
//   media/map/jolene_art.<h8>.jpg    (G2324, MAP-SIMPLE) THE PICTURE THE SCREEN SHOWS: the user's own AI-generated painting
//                                    of the island (GAME-2026-10-06.md §R.2, ruled 7 Oct), rubber-sheeted onto the real
//                                    coastline IN THIS FRAME (futureDesigns/game/map-mock/rubbersheet.py), shipped as its
//                                    committed bytes (ART_SRC; no re-encode) and named by their hash. Its size must be the
//                                    frame's (w x h) or the bake stops. The projection records it as `art`, beside the
//                                    island record's wildlife hotspots (`hotspots`) and places of interest (`pois`) the
//                                    screen draws over it - the game draws every site itself, never the painting's own
//                                    runways (they drift ~0.5-0.8 km)
//
// DETERMINISTIC: the same island, record and code give the same bytes (no clock, no random; one zlib stream at a
// fixed level, filter 0 on every row). GATE MAPBAKE (tools/_mapbake_check.js) re-bakes in memory and compares, then
// checks every runway's pixels against its footprint in the projection, and the size budget.
//
//   node tools/map_bake.js            bake, write, prune media/map/ of anything this bake did not emit
//   node tools/map_bake.js --report   bake in memory, say what it would write, write nothing
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');

// ---- THE LOOK (a muted chart: the UI's bone and ink around it, the land quiet so markers read) -----------------------
const MPP = 12;                     // metres per pixel: the island's ~23 x 31 km land in ~2200 x 2800 px
const MARGIN = 900;                 // metres of sea round the land's box
const BANDS = [0, 12, 35, 70, 120, 190, 270, 370, 490, 630, 800, 980];   // the height tint's band floors, m
const SHADES = 5;                   // hillshade levels (NW light), per band
const LAND = [[201, 210, 178], [207, 213, 180], [214, 216, 184], [220, 218, 190], [224, 218, 194], [226, 215, 196],
              [226, 211, 197], [225, 208, 200], [228, 214, 208], [233, 224, 218], [239, 234, 229], [246, 244, 240]];
const FOREST = [0.78, 0.86, 0.72];  // the forest's multiply on the band colour
const SHADE_K = [0.80, 0.88, 0.96, 1.03, 1.08];
const C = {
  deep: [150, 178, 192], mid: [163, 189, 201], shallow: [180, 202, 211], lake: [170, 196, 208], lane: [199, 219, 228],
  gridSea: [140, 168, 183], gridSeaMaj: [124, 152, 168],
  paved: [92, 86, 80], gravel: [150, 128, 104], track: [168, 146, 118],
  hard: [72, 68, 66], grass: [118, 140, 92], plot: [176, 96, 52],
  ink: [40, 36, 34], paper: [250, 247, 240],
};
const ROAD_MIN_PX = 0.55, RWY_GROW_PX = 0.5;
// (G2324) THE PAINTING: its committed source (the approved mock's, the user's AI map) and the sea at its edge
const ART_SRC = 'futureDesigns/game/map-mock/map_ai2.jpg', ART_EDGE = '#004279';
// the places of interest the map names from the middle zoom (§R.2: Metlakatla, the mine, the lodge, the cannery,
// Tamgas Hill): the island record's sites by id - their positions are the record's; the hill is the island's summit
const POI_SITES = [['mk_hall', 'Metlakatla'], ['mn_s_mine', 'the mine'], ['tw_s_summit', 'the lodge'], ['mk_mw_cannery', 'the cannery']];
const POI_SUMMIT = 'Tamgas Hill';   // a road is at least ~1 px; a runway's rectangle grows half a pixel (a 12 m strip is still a line)

// ---- THE PALETTE (index -> rgb), built once, in a fixed order -------------------------------------------------------
function palette() {
  const P = [], idx = {};
  const add = (k, rgb) => { idx[k] = P.length; P.push(rgb.map(v => Math.max(0, Math.min(255, Math.round(v))))); };
  for (let b = 0; b < BANDS.length; b++) for (let f = 0; f < 2; f++) for (let s = 0; s < SHADES; s++) {
    const base = LAND[b], k = SHADE_K[s];
    add('l' + b + '_' + f + '_' + s, base.map((v, i) => v * (f ? FOREST[i] : 1) * k));
  }
  for (const k of Object.keys(C)) add(k, C[k]);
  return { P, idx };
}

// ---- THE TINY FONT (5 x 7, drawn at 2x): the grid's km labels, the scale bar, the north mark ------------------------
const GLYPH = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  'k': ['10000', '10000', '10010', '10100', '11000', '10100', '10010'], 'm': ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
};

// ---- THE PNG (indexed, 8-bit; filter 0 on every row; one zlib stream at level 9) ------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, pix, pal) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const plte = Buffer.alloc(pal.length * 3); pal.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; });
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; Buffer.from(pix.buffer, pix.byteOffset + y * w, w).copy(raw, y * (w + 1) + 1); }
  const idat = zlib.deflateSync(raw, { level: 9, memLevel: 9, strategy: zlib.constants.Z_DEFAULT_STRATEGY });
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
// the decoder the gate reads the committed picture with (this encoder's own output: indexed, filter 0)
function decodePNG(buf) {
  let o = 8, w = 0, h = 0, pal = null; const id = [];
  while (o < buf.length) {
    const n = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 3) throw new Error('not an 8-bit indexed PNG'); }
    else if (t === 'PLTE') { pal = []; for (let i = 0; i < n; i += 3) pal.push([d[i], d[i + 1], d[i + 2]]); }
    else if (t === 'IDAT') id.push(d);
    o += 12 + n;
  }
  const raw = zlib.inflateSync(Buffer.concat(id)), pix = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { if (raw[y * (w + 1)] !== 0) throw new Error('row ' + y + ' is filtered'); raw.copy(Buffer.from(pix.buffer), y * w, y * (w + 1) + 1, (y + 1) * (w + 1)); }
  return { w, h, pix, pal };
}

// (G2324) a JPEG's frame size, from its SOF marker (the painting is shipped as committed: nothing decodes it here)
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  let o = 2;
  while (o + 9 < buf.length) {
    if (buf[o] !== 0xff) { o++; continue; }
    const m = buf[o + 1], n = buf.readUInt16BE(o + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), progressive: m === 0xc2 };
    o += 2 + n;
  }
  throw new Error('no SOF marker');
}
// the animal registry's key -> { kind (land / sea / air), label }: read off each manifest's own fields
// (src/animals/<key>_animal.js, the files animals_index.json lists - the same rows ANIMALS.reg serves the minimap)
function animalRegistry() {
  const dir = path.join(ROOT, 'src', 'animals'), out = {};
  for (const f of JSON.parse(fs.readFileSync(path.join(dir, 'animals_index.json'), 'utf8'))) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8'), g = k => (new RegExp('"' + k + '":"([^"]*)"').exec(t) || [])[1];
    if (g('key')) out[g('key')] = { kind: g('kind') || 'land', label: g('label') || g('key') };
  }
  return out;
}

// ---- THE ISLAND --------------------------------------------------------------------------------------------------
function loadIsland() {
  const { islandBoot, islandWorld } = require('./island_node.js');
  const Cx = require('./flight_core.js');
  const recText = fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8');
  const rec = JSON.parse(recText);
  const boot = islandBoot('jolene', { noCook: true });
  if (!boot) throw new Error('map_bake: no island "jolene" in src/core/world_packs.json');
  const W = islandWorld('jolene', { premises: recText });
  return { Cx, rec, grid: boot.grid, W };
}

// where each hangar plot stands (GAME-PREMISES' plots; their place in the world is the premises record's, session 3 -
// until then: the site's hangar, else its stand, else - a water base - the shore beside the lane)
function plotsOf(Cx, W, land) {
  const out = [];
  const offers = Cx.BASE_OFFERS || {};
  for (const aero of Object.keys(offers)) {
    const a = W.aerodromes.find(x => x.id === aero); if (!a) continue;
    const st = Cx.siteOf ? Cx.siteOf(aero) : null;
    let n = 0;
    for (const id of Object.keys(offers[aero].plots)) {
      let x, z;
      if (st && st.hangar) { x = st.hangar.x; z = st.hangar.z; }
      else if (st && st.stand) { x = st.stand.x; z = st.stand.z; }
      else {
        // the lane's centre, then across it until the shore, 30 m up the bank
        const ux = -Math.sin(a.hdg), uz = Math.cos(a.hdg);
        let best = null;
        for (const sgn of [1, -1]) for (let d = 0; d < 3000; d += 10) { const px = a.x + ux * d * sgn, pz = a.z + uz * d * sgn; if (land(px, pz)) { if (!best || d < best.d) best = { d, x: px + ux * 30 * sgn, z: pz + uz * 30 * sgn }; break; } }
        x = best ? best.x : a.x; z = best ? best.z : a.z;
      }
      // a second plot of the same field stands beside the first (HOME.2), 60 m on
      x += n * 60; n++;
      const P = offers[aero].plots[id];
      out.push({ id, aero, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, shells: P.shells, water: !!P.water, derelict: !!P.derelict });
    }
  }
  return out;
}

function bake() {
  const { Cx, rec, grid, W } = loadIsland();
  const M = grid.meta, GW = M.w, GH = M.h, cell = M.cell;
  const gi = (x, z) => { const i = Math.floor((x - M.x0) / cell), j = Math.floor((z - M.z0) / cell); return (i < 0 || j < 0 || i >= GW || j >= GH) ? -1 : j * GW + i; };
  // the coast grid, bilinear: > 128 inland (signed m/4 from the waterline)
  const coastAt = (x, z) => {
    const fx = (x - M.x0) / cell - 0.5, fz = (z - M.z0) / cell - 0.5, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const g = (a, b) => (a < 0 || b < 0 || a >= GW || b >= GH) ? 0 : grid.coast[b * GW + a];
    return (g(i, j) * (1 - tx) + g(i + 1, j) * tx) * (1 - tz) + (g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx) * tz;
  };
  const land = (x, z) => coastAt(x, z) > 128;
  // the land's box (the coast grid), with the margin, on whole kilometres
  let lx0 = 1e9, lx1 = -1e9, lz0 = 1e9, lz1 = -1e9;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (grid.coast[j * GW + i] > 128) {
    const x = M.x0 + i * cell, z = M.z0 + j * cell;
    if (x < lx0) lx0 = x; if (x > lx1) lx1 = x; if (z < lz0) lz0 = z; if (z > lz1) lz1 = z;
  }
  const X0 = Math.floor((lx0 - MARGIN) / 1000) * 1000, Z0 = Math.floor((lz0 - MARGIN) / 1000) * 1000;
  const w = Math.ceil((Math.ceil((lx1 + cell + MARGIN) / 1000) * 1000 - X0) / MPP), h = Math.ceil((Math.ceil((lz1 + cell + MARGIN) / 1000) * 1000 - Z0) / MPP);
  const X1 = X0 + w * MPP, Z1 = Z0 + h * MPP;   // the frame IS the picture: x1 - x0 = w * mpp exactly
  const wx = i => X0 + (i + 0.5) * MPP, wz = j => Z0 + (j + 0.5) * MPP;
  const { P, idx } = palette();
  // sanity of the frame: the home strip is land, the seaplane lanes are water
  for (const a of W.aerodromes) {
    const wet = a.kind === 'water';
    if (wet === land(a.x, a.z)) throw new Error('map_bake: ' + a.id + ' reads ' + (wet ? 'land' : 'water') + ' on the coast grid - the frame is wrong');
  }

  // 1. heights (land only) and the class of every pixel
  const H = new Float32Array(w * h), cls = new Uint8Array(w * h);   // cls: 0 deep, 1 mid, 2 shallow, 3 lake, 4 land, 5 forest
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = wx(i), z = wz(j), k = j * w + i, c = coastAt(x, z);
    if (c <= 128) { const d = (128 - c) * 4; cls[k] = d < 90 ? 2 : d < 300 ? 1 : 0; continue; }
    const g = gi(x, z);
    if (g >= 0 && grid.lake && grid.lake[g] > 128) { cls[k] = 3; continue; }   // the lake grid: signed m/4, 128 = the edge, + inside
    H[k] = Math.max(0, W.terrainH(x, z));
    cls[k] = (g >= 0 && grid.cover && grid.cover[g] === 10) ? 5 : 4;
  }
  // 2. the land's colour: band x forest x hillshade (NW light, 45 deg, x1.6)
  const pix = new Uint8Array(w * h);
  const band = hh => { let b = 0; while (b + 1 < BANDS.length && hh >= BANDS[b + 1]) b++; return b; };
  const Lx = -Math.SQRT1_2, Lz = -Math.SQRT1_2, Ly = 1, Ln = Math.hypot(Lx * Math.SQRT1_2, Ly * Math.SQRT1_2, Lz * Math.SQRT1_2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, c = cls[k];
    if (c < 3) { pix[k] = idx[c === 0 ? 'deep' : c === 1 ? 'mid' : 'shallow']; continue; }
    if (c === 3) { pix[k] = idx.lake; continue; }
    const hx = (H[j * w + Math.min(w - 1, i + 1)] - H[j * w + Math.max(0, i - 1)]) / (2 * MPP) * 1.6;
    const hz = (H[Math.min(h - 1, j + 1) * w + i] - H[Math.max(0, j - 1) * w + i]) / (2 * MPP) * 1.6;
    const nx = -hx, ny = 1, nz = -hz, nn = Math.hypot(nx, ny, nz);
    const lam = (nx * Lx + ny * Ly + nz * Lz) / (nn * Math.hypot(Lx, Ly, Lz));   // 0.707 on the flat
    const s = Math.max(0, Math.min(SHADES - 1, Math.round((lam - 0.707) * 9 + 2)));
    pix[k] = idx['l' + band(H[k]) + '_' + (c === 5 ? 1 : 0) + '_' + s];
  }
  void Ln;
  // 3. the grid: 1 km lines a shade darker, 5 km two (the sea its own two blues)
  const darker = (k, n) => {
    const v = pix[k];
    if (v === idx.deep || v === idx.mid || v === idx.shallow || v === idx.lake) { pix[k] = n > 1 ? idx.gridSeaMaj : idx.gridSea; return; }
    if (v < BANDS.length * 2 * SHADES) { const s = v % SHADES; pix[k] = v - Math.min(s, n); }
  };
  for (let km = Math.ceil(X0 / 1000); km * 1000 <= X1; km++) { const i = Math.round((km * 1000 - X0) / MPP); if (i < 0 || i >= w) continue; for (let j = 0; j < h; j++) darker(j * w + i, km % 5 === 0 ? 2 : 1); }
  for (let km = Math.ceil(Z0 / 1000); km * 1000 <= Z1; km++) { const j = Math.round((km * 1000 - Z0) / MPP); if (j < 0 || j >= h) continue; for (let i = 0; i < w; i++) darker(j * w + i, km % 5 === 0 ? 2 : 1); }

  // 4. the roads (the premises record, world frame: its anchor is the origin)
  const anc = (rec.frame && rec.frame.anchors && rec.frame.anchors['*']) || { x: 0, z: 0, yaw: 0 };
  if (anc.x || anc.z || anc.yaw) throw new Error('map_bake: the premises frame is not the world frame (anchor ' + JSON.stringify(anc) + ')');
  const toPx = (x, z) => [(x - X0) / MPP, (z - Z0) / MPP];
  const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  const roads = (rec.layers.roads || []).slice().sort((a, b) => (a.cls === 'paved') - (b.cls === 'paved'));   // the paved on top
  for (const r of roads) {
    const col = idx[r.cls === 'gravel' ? 'gravel' : r.cls === 'track' ? 'track' : 'paved'];
    const half = Math.max((r.w || 6) / 2 / MPP, ROAD_MIN_PX);
    const pts = r.pts.map(p => toPx(p[0], p[1]));
    for (let s = 0; s + 1 < pts.length; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1];
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - half - 1)), i1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + half + 1));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by) - half - 1)), j1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + half + 1));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (segDist(i + 0.5, j + 0.5, ax, ay, bx, by) <= half) pix[j * w + i] = col;
    }
  }
  // 5. the plots: a 36 m square outline each, in the plots' colour
  const plots = plotsOf(Cx, W, land);
  for (const p of plots) {
    const [cx, cy] = toPx(p.x, p.z), r = 18 / MPP;
    for (let j = Math.floor(cy - r - 1); j <= Math.ceil(cy + r + 1); j++) for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r + 1); i++) {
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const dx = Math.abs(i + 0.5 - cx), dy = Math.abs(j + 0.5 - cy), m = Math.max(dx, dy);
      if (m <= r + 0.5 && m >= r - 0.6) pix[j * w + i] = idx.plot;
    }
  }
  // 6. the runways LAST, at true scale and heading: the record's rectangle (len along hdg, wid across) grown half a pixel
  const aeros = W.aerodromes.map(a => {
    const S = Cx.stripSurface(a);
    return { id: a.id, name: a.name, kind: a.kind, x: +a.x.toFixed(2), z: +a.z.toFixed(2), hdg: +a.hdg.toFixed(5), len: a.len, wid: a.wid,
             surface: { key: S.key, word: S.word, cls: S.cls }, elev: Math.round(a.elev || 0), altiport: !!a.altiport };
  });
  for (const a of aeros) {
    const col = idx[a.surface.cls === 'water' ? 'lane' : a.surface.cls === 'grass' ? 'grass' : 'hard'];
    const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg), gl = a.len / 2 + RWY_GROW_PX * MPP, gw = a.wid / 2 + RWY_GROW_PX * MPP;
    const R = Math.hypot(gl, gw) / MPP + 2, [cx, cy] = toPx(a.x, a.z);
    for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) {
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const rx = wx(i) - a.x, rz = wz(j) - a.z, al = rx * ux + rz * uz, cr = -rx * uz + rz * ux;
      if (Math.abs(al) <= gl && Math.abs(cr) <= gw) pix[j * w + i] = col;
    }
  }
  // 7. the labels: km from the world origin every 5 km along the top and left edges, the scale bar, the north mark
  const text = (s, x, y, sc, col) => {
    let cx = x;
    for (const ch of s) { const g = GLYPH[ch] || GLYPH[' ']; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === '1')
      for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) { const i = cx + q * sc + b, j = y + r * sc + a; if (i >= 0 && j >= 0 && i < w && j < h) pix[j * w + i] = col; }
      cx += 6 * sc; }
    return cx - x;
  };
  const box = (x0, y0, x1, y1, col) => { for (let j = Math.max(0, y0); j < Math.min(h, y1); j++) for (let i = Math.max(0, x0); i < Math.min(w, x1); i++) pix[j * w + i] = col; };
  const SC = 2;
  for (let km = Math.ceil(X0 / 5000) * 5; km * 1000 <= X1; km += 5) { const i = Math.round((km * 1000 - X0) / MPP); const s = String(km); const tw = s.length * 6 * SC; box(i + 3, 3, i + 3 + tw + 4, 3 + 7 * SC + 4, idx.paper); text(s, i + 5, 5, SC, idx.ink); }
  for (let km = Math.ceil(Z0 / 5000) * 5; km * 1000 <= Z1; km += 5) { const j = Math.round((km * 1000 - Z0) / MPP); const s = String(-km); const tw = s.length * 6 * SC; box(3, j + 3, 3 + tw + 4, j + 3 + 7 * SC + 4, idx.paper); text(s, 5, j + 5, SC, idx.ink); }
  {
    // the scale: 5 km in 1 km blocks, ink and paper, bottom left
    const kmPx = 1000 / MPP, x0 = 40, y0 = h - 70, bh = 10;
    box(x0 - 8, y0 - 30, x0 + 5 * kmPx + 70, y0 + bh + 10, idx.paper);
    for (let k = 0; k < 5; k++) box(Math.round(x0 + k * kmPx), y0, Math.round(x0 + (k + 1) * kmPx), y0 + bh, k % 2 ? idx.paper : idx.ink);
    box(x0, y0, Math.round(x0 + 5 * kmPx), y0 + 1, idx.ink); box(x0, y0 + bh - 1, Math.round(x0 + 5 * kmPx), y0 + bh, idx.ink);
    for (let k = 0; k <= 5; k++) text(String(k), Math.round(x0 + k * kmPx) - 5, y0 - 22, SC, idx.ink);
    text('km', Math.round(x0 + 5 * kmPx) + 16, y0 - 4, SC, idx.ink);
    // north: an arrow and N, top right
    const nx = w - 60, ny = 50;
    box(nx - 22, ny - 34, nx + 24, ny + 50, idx.paper);
    for (let r = 0; r < 26; r++) box(nx - Math.floor(r / 2.4), ny - 26 + r, nx + Math.floor(r / 2.4) + 1, ny - 25 + r, idx.ink);
    text('N', nx - 5, ny + 4, SC, idx.ink);
  }
  const png = encodePNG(w, h, pix, P);
  // (G2324) THE WILDLIFE HOTSPOTS: the record's animal objects (premises frame = world, asserted above), the same the
  // in-game minimap marks (app.js THE ANIMAL HOTSPOTS, G498): one per hotspot, never one an animal
  const REG = animalRegistry();
  const hotspots = (rec.layers.objects || []).filter(o => o.kind === 'animal').map(o => {
    const A = REG[o.key] || { kind: 'land', label: o.key };
    return { id: o.id, key: o.key, x: o.x, z: o.z, n: o.n || 1, r: o.r || 0, kind: A.kind, label: A.label };
  });
  // THE PLACES OF INTEREST: the named sites, and the summit (the highest land pixel of the height field)
  const siteAt = {}; for (const st of (rec.layers.sites || [])) siteAt[st.id] = st;
  const pois = POI_SITES.map(([id, label]) => { const st = siteAt[id]; if (!st) throw new Error('map_bake: no site ' + id + ' in the island record'); return { id, label, x: st.at.x, z: st.at.z }; });
  { let k = 0; for (let i = 1; i < H.length; i++) if (H[i] > H[k]) k = i; const i = k % w, j = (k - i) / w;
    pois.push({ id: 'summit', label: POI_SUMMIT, x: Math.round(wx(i)), z: Math.round(wz(j)), elev: Math.round(H[k] / 10) * 10 }); }
  // THE PAINTING: the committed bytes, in this frame exactly
  const art = fs.readFileSync(path.join(ROOT, ART_SRC)), as = jpegSize(art);
  if (as.w !== w || as.h !== h) throw new Error('map_bake: ' + ART_SRC + ' is ' + as.w + ' x ' + as.h + ', not the frame\'s ' + w + ' x ' + h);
  const proj = {
    v: 1, island: 'jolene', mpp: MPP, x0: X0, z0: Z0, x1: X1, z1: Z1, w, h,
    rule: 'px = (x - x0) / mpp, py = (z - z0) / mpp; north up (-z is north); the grid labels are km from the world origin (north positive)',
    aerodromes: aeros, plots, hotspots, pois,
    look: { rwyGrowPx: RWY_GROW_PX, colours: { hard: idx.hard, grass: idx.grass, lane: idx.lane, plot: idx.plot } },
    credit: 'Jolene Island: Annette Island, Southeast Alaska, renamed (USGS 3DEP IFSAR, ESA WorldCover; flyDiy/CREDITS.md)',
  };
  return { png, proj, pix, w, h, P, idx, art, artSize: as };
}
// the projection as written: the bake's, with the two pictures' names, sizes and hashes (write() and GATE MAPBAKE)
function projOf(r, img, artImg) {
  const { sha8 } = require('./_media_lib.js');
  return Object.assign({}, r.proj, { img, imgBytes: r.png.length, imgHash: sha8(r.png),
    art: { img: artImg, bytes: r.art.length, hash: sha8(r.art), w: r.artSize.w, h: r.artSize.h, edge: ART_EDGE, src: ART_SRC,
           credit: 'the island painted by the user with an AI image generator, rubber-sheeted onto the real coastline (flyDiy/CREDITS.md)' } });
}

function write(r) {
  const { writeMedia, pruneMedia } = require('./_media_lib.js');
  const img = writeMedia('map', 'jolene_map', 'png', r.png), art = writeMedia('map', 'jolene_art', 'jpg', r.art);
  const proj = projOf(r, img, art);
  const projBuf = Buffer.from(JSON.stringify(proj, null, 1) + '\n');
  const pj = writeMedia('map', 'jolene_proj', 'json', projBuf);
  const gone = pruneMedia('map', [img, art, pj]);
  const pack = Object.assign({ proj: pj }, proj);
  const js = '// GENERATED by tools/map_bake.js (G2250 MAP-MENU) - do not edit. The 2-D island map\'s projection and its picture\'s\n' +
    '// content-hashed name: the MAP screen\'s lazy script (build.js MANIFEST.lazy \'map_pack\'), loaded when the screen opens.\n' +
    'window.MAP_PACK = ' + JSON.stringify(pack) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'src', 'viewer', 'map_pack.js'), js);
  return { img, art, pj, gone, pack };
}

module.exports = { bake, projOf, encodePNG, decodePNG, jpegSize, MPP, RWY_GROW_PX, ART_SRC, ART_EDGE };

if (require.main === module) {
  const t0 = Date.now();
  const r = bake();
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log('map_bake: ' + r.w + ' x ' + r.h + ' px at ' + MPP + ' m/px, ' + r.P.length + ' colours, ' + kb(r.png.length) + ', ' + r.proj.aerodromes.length + ' runways, ' + r.proj.plots.length + ' plots, ' + r.proj.hotspots.length + ' hotspots, ' + r.proj.pois.length + ' places; the painting ' + r.artSize.w + ' x ' + r.artSize.h + ', ' + kb(r.art.length) + '; ' + (Date.now() - t0) + ' ms');
  if (process.argv.includes('--report')) process.exit(0);
  const o = write(r);
  console.log('wrote ' + o.img + ', ' + o.art + ', ' + o.pj + ', src/viewer/map_pack.js' + (o.gone.length ? '; pruned ' + o.gone.join(', ') : ''));
}
