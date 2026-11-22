#!/usr/bin/env node
// GARAGE-VIEW, step 4: THE COOK - the measured world and the captures into ONE light scene both hangars share.
//
//   node tools/garage_view/cook.js --measure <dir> --cap <capture dir> [--ground <dir of ground_merge>] --out <dir>
//     -> <out>/scene.json   the scene's table: its origin (world), each mesh's arrays in scene.bin, its texture, its kind
//        <out>/scene.bin    the arrays (Float32 positions / normals / uvs / colours, Uint32 indices), one after another
//        <out>/*.png        the textures: ground_mid / ground_near_<shed> / ground_wide (ground_merge.js's, copied), trees_col +
//                           trees_nrm (the species' impostor sheets as cards: 8 level views a species, tinted as the game tints
//                           them, the normals turned into each card's own tangent frame), props (the buildings and vehicles,
//                           their own triangles textured through the pictures taken from the doors' directions)
// THE SCENE (world metres about `origin`; the runtime turns it into each shed's room frame by the shed's true yaw):
//   ground   the terrain as the game holds it (world.terrainH): 4 m over the mid picture, 2 m under each near picture (a decal,
//            its rim fading), 20 m to the wide picture's edge, then a ring to 32 km (the skyline) in the land's colours
//   trees    every tree the fill draws within --trees m (default 700), each a card of its species' own sheet, at its place,
//            height and sink, facing the middle of the two sheds (the eye never leaves the rooms: 60 m and more away)
//   props    the buildings and the vehicles near, the game's own shapes
//   layers   what stands LOW between the apron and the trees (the shrubs, the ferns, the flowers, the rocks, the barrels, the
//            fences: the cover ring and the small props, which no list exports), as the game draws it, in rings of distance:
//            each ring a strip (the picture with them minus the picture of the ground alone) on a wall at the ring's distance
//   far      everything past 700 m (the far forest, the ridges, the summits, the sea) as ONE band: the game's own pixels,
//            shot from the middle of the sheds with the near plane at 700 m, on a wall at that distance all round
// Nothing here is drawn by hand: every number is the game's (measure.js, census.js, capture.js).
'use strict';
const fs = require('fs'), path = require('path');
const PNG = require('./png.js');
const T = path.join(__dirname, '..');
const C0 = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const MDIR = opt('measure', path.join(T, 'perf', 'garage_view')), CAP = opt('cap', null), GDIR = opt('ground', CAP), OUT = opt('out', path.join(MDIR, 'scene'));
const LCAP = opt('layers', CAP), PCAP = opt('props', CAP);   // the captures the low layers and the things come from (a later run than the far band's and the sheets')
const TREE_R0 = opt('trees', null);
fs.mkdirSync(OUT, { recursive: true });
const M = JSON.parse(fs.readFileSync(path.join(MDIR, 'measure.json'), 'utf8'));
const CEN = JSON.parse(fs.readFileSync(path.join(MDIR, 'census.json'), 'utf8'));
const SITE = M.site || { pack: 'jolene_home', world: 'jolene', fixture: M.fixture || 'island_jolene.json', field: 'HOME', trees: 700, mid: { u: 560, v: 460, out: 110 } };
const W = IN.islandWorld(SITE.world, { premises: fs.readFileSync(path.join(T, 'fixtures', SITE.fixture), 'utf8') });
const S = M.sheds, SEA = M.sea || 0, TREE_R = +(TREE_R0 || SITE.trees || 700);
const ORG = [M.mid.x, S[0].ySite !== null && S[0].ySite !== undefined ? S[0].ySite : S[0].y, M.mid.z];
const Hh = (x, z) => Math.max(W.terrainH(x, z), SEA);
const d0 = [S[0].doorDir.x, S[0].doorDir.z], t0 = [-d0[1], d0[0]];
const s2l = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, l2s = v => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };

// ---- the arrays' file -------------------------------------------------------------------------------------------------
const BIN = []; let binAt = 0;
const put = (arr) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), pad = (4 - (b.length % 4)) % 4, at = binAt; BIN.push(b); if (pad) BIN.push(Buffer.alloc(pad)); binAt += b.length + pad;
  return { at, n: arr.length, t: arr instanceof Float32Array ? 'f32' : arr instanceof Uint32Array ? 'u32' : arr instanceof Uint16Array ? 'u16' : arr instanceof Int8Array ? 'i8' : 'u8' }; };
const SCENE = { v: 1, what: 'GARAGE-VIEW scene: the world round the club hangar and the large hangar', made: new Date().toISOString(), pack: SITE.pack, world: SITE.world, field: SITE.field, fixture: SITE.fixture, rev: M.rev || null, origin: ORG.map(v => +v.toFixed(3)),
  sheds: S.map(s => ({ id: s.id, x: s.x, y: s.ySite !== null ? s.ySite : s.y, z: s.z, ry: s.ry, HW: s.HW, HD: s.HD })), meshes: [], textures: {}, stats: {} };
const mesh = (name, kind, tex, A, extra) => { const m = Object.assign({ name, kind, tex: tex || null, tris: A.idx.length / 3, verts: A.pos.length / 3 }, extra || {});
  // THE BIN'S DIET (GATE GARAGEVIEW's budget; scene 2's bin was 7.7 MB): a normal is three signed bytes (a unit vector needs no float), a
  // card carries none (the page computes it: the quad's own face is the card's facing), an index is 16 bits where the mesh allows
  const B = Object.assign({}, A);
  if (kind === 'cards') delete B.nrm;
  else if (B.nrm) { const q = new Int8Array(B.nrm.length); for (let i = 0; i < q.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(B.nrm[i] * 127))); B.nrm = q; }
  if (B.idx && m.verts <= 65535) B.idx = Uint16Array.from(B.idx);
  for (const k of ['pos', 'nrm', 'uv', 'col', 'idx']) if (B[k]) m[k] = put(B[k]); SCENE.meshes.push(m); return m; };
const L = (x, y, z) => [x - ORG[0], y - ORG[1], z - ORG[2]];

// ---- a draped grid over a frame { o: [x, z], eu, ev, U, V }: nu x nv cells; skip(u, v, i, j) leaves a cell out -------------------
function grid(F, nu, nv, o) {
  o = o || {}; const pos = [], uv = [], col = o.alpha ? [] : null, idx = [], id = new Int32Array((nu + 1) * (nv + 1)).fill(-1);
  const vert = (i, j) => { const k = j * (nu + 1) + i; if (id[k] >= 0) return id[k]; const u = i / nu * F.U, v = j / nv * F.V, x = F.o[0] + F.eu[0] * u + F.ev[0] * v, z = F.o[1] + F.eu[1] * u + F.ev[1] * v;
    const p = L(x, Hh(x, z) + (o.lift || 0) + (o.drop ? o.drop(u, v) : 0), z); pos.push(p[0], p[1], p[2]); const q = o.uvOf ? o.uvOf(u, v, x, z) : [u / F.U, 1 - v / F.V]; uv.push(q[0], q[1]);
    if (col) { const a = o.alpha(u, v); col.push(1, 1, 1, a); } return (id[k] = pos.length / 3 - 1); };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { if (o.skip && o.skip((i + 0.5) / nu * F.U, (j + 0.5) / nv * F.V, i, j)) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
    // wound to face up whatever the frame's handedness
    if (F.eu[0] * F.ev[1] - F.eu[1] * F.ev[0] > 0) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), col: col ? new Float32Array(col) : null, idx: new Uint32Array(idx) };
}
const smoothN = A => { const n = new Float32Array(A.pos.length), p = A.pos, ix = A.idx;
  for (let t = 0; t < ix.length; t += 3) { const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3, e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; } }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; } return n; };

// ================= THE FAR BAND (read first: it decides how far the ground goes) =================================================
const CJ0 = CAP && fs.existsSync(path.join(CAP, 'capture.json')) ? JSON.parse(fs.readFileSync(path.join(CAP, 'capture.json'), 'utf8')) : null;
const FARG = CJ0 ? CJ0.grabs.filter(g => g.kind === 'far' && g.ap === 1 && fs.existsSync(path.join(CAP, g.name + '.png'))) : [];
const FAR = FARG.length >= 6 ? { R: FARG[0].near, eye: FARG[0].eye } : null;

// ================= THE GROUND =================================================================================================
const GJ = GDIR && fs.existsSync(path.join(GDIR, 'ground.json')) ? JSON.parse(fs.readFileSync(path.join(GDIR, 'ground.json'), 'utf8')) : null;
const mos = tag => GJ ? GJ.mosaics.find(m => m.tag === tag) : null;
// THE GROUND PICTURES' OWN PASS (the user, 22 Nov, on the large hangar's back window: "a gap in terrain ... we need to patch that hole").
// Three things a top-down picture of the game's ground gets wrong for an eye that stands on it:
//   WATER   seen straight down the game's water is its deep colour, near black; from the shore it is the sky. A lake 160 m behind
//           Jolene's hangars read as a pit. Where the MEASURED surface is water (measure.json terrain surf 4), the texel takes a
//           water that throws the sky back (WATER_RGB: under the scene's own light it shows at about three quarters of the low sky).
//   FLOOR   under a canopy the game darkens its ground to near black; with the trees hidden for the picture that black is what the
//           tiles hold. A texel darker than a floor in shade goes toward the land's own mean colour x 0.6.
//   BEYOND  what no tile covered (a steep site leaves some), and the land past the picture's frame out to the far band (FB: the
//           wide picture is grown to the grid's whole frame), takes that floor colour, or the water's where the surface is water.
const WATER = 4, WATER_RGB = [124, 156, 181];
const surfAt = (x, z) => { for (const G of [M.terrain && M.terrain.near, M.terrain && M.terrain.mid]) { if (!G || !G.surf) continue;
    const i = Math.round((x - G.x0) / G.step), j = Math.round((z - G.z0) / G.step); if (i >= 0 && j >= 0 && i < G.n && j < G.n) return G.surf[j * G.n + i]; } return 0; };
// groundTex(key, F, FB): the mosaic of frame F rewritten over frame FB (FB = F: in place); returns the key
const groundTex = (key, F, FB) => { const I = PNG.decode(fs.readFileSync(path.join(GDIR, F.file))), d = I.data, ch = I.ch, sum = [0, 0, 0]; let m = 0;
  const lum = o => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
  for (let i = 0; i < I.w * I.h; i += 5) { const o = i * ch; if (lum(o) > 46 && (ch < 4 || d[o + 3] > 200)) { sum[0] += d[o]; sum[1] += d[o + 1]; sum[2] += d[o + 2]; m++; } }
  const f = m ? sum.map(v => v / m * 0.6) : [60, 66, 44];
  FB = FB || F; const ppm = I.w / F.U, W2 = Math.min(4096, Math.round(FB.U * ppm)), H2 = Math.min(4096, Math.round(FB.V * I.h / F.V)), out = new Uint8Array(W2 * H2 * 4);
  // FB's origin in F's own coordinates (the two frames share their axes)
  const ox = FB.o[0] - F.o[0], oz = FB.o[1] - F.o[1], uo = ox * F.eu[0] + oz * F.eu[1], vo = ox * F.ev[0] + oz * F.ev[1]; let nw = 0, nf = 0, nb = 0;
  for (let y = 0; y < H2; y++) { const v = (y + 0.5) / H2 * FB.V;
    for (let x = 0; x < W2; x++) { const u = (x + 0.5) / W2 * FB.U, wx = FB.o[0] + FB.eu[0] * u + FB.ev[0] * v, wz = FB.o[1] + FB.eu[1] * u + FB.ev[1] * v, q = (y * W2 + x) * 4;
      let r, g, b;
      if (surfAt(wx, wz) === WATER) { r = WATER_RGB[0]; g = WATER_RGB[1]; b = WATER_RGB[2]; nw++; }
      else { const us = u + uo, vs = v + vo, sx = Math.floor(us / F.U * I.w), sy = Math.floor(vs / F.V * I.h);
        if (us >= 0 && vs >= 0 && sx < I.w && sy < I.h) { const o = (sy * I.w + sx) * ch, a = ch < 4 ? 1 : d[o + 3] / 255, t = Math.max(1 - a, Math.max(0, Math.min(1, (36 - lum(o)) / 22)));
          r = d[o] + (f[0] - d[o]) * t; g = d[o + 1] + (f[1] - d[o + 1]) * t; b = d[o + 2] + (f[2] - d[o + 2]) * t; if (t > 0.5) nf++; }
        else { r = f[0]; g = f[1]; b = f[2]; nb++; } }
      out[q] = r; out[q + 1] = g; out[q + 2] = b; out[q + 3] = 255; } }
  fs.writeFileSync(path.join(OUT, F.file), PNG.encode(W2, H2, 4, out)); SCENE.textures[key] = { file: F.file, srgb: true };
  (SCENE.stats.groundTex = SCENE.stats.groundTex || {})[key] = { size: [W2, H2], water: +(nw / (W2 * H2)).toFixed(3), floor: +(nf / (W2 * H2)).toFixed(3), beyond: +(nb / (W2 * H2)).toFixed(3), floorRGB: f.map(v => Math.round(v)) };
  return key; };
const copyTex = (key, file) => { fs.copyFileSync(path.join(GDIR, file), path.join(OUT, file)); SCENE.textures[key] = { file, srgb: true }; return key; };
// the frames, the ones ground_merge.js draws its mosaics in (kept in step by ground.json when it is there)
const MU = SITE.mid.u, MV = SITE.mid.v, MO = SITE.mid.out;
const F_MID = mos('mid') || { o: [M.mid.x + d0[0] * (MO - MU / 2) - t0[0] * MV / 2, M.mid.z + d0[1] * (MO - MU / 2) - t0[1] * MV / 2], eu: d0, ev: t0, U: MU, V: MV };
// the wide frame: 20 m cells whose lines fall on the mid picture's edges (670 m each side of it and 580 m behind, 1160 m ahead)
const F_WIDE = mos('wide') || { o: [M.mid.x + d0[0] * (MO - MU / 2 - 180) - t0[0] * (MV / 2 + 680), M.mid.z + d0[1] * (MO - MU / 2 - 180) - t0[1] * (MV / 2 + 680)], eu: d0, ev: t0, U: MU + 180 + 1160, V: MV + 1360 };
{ const A = grid(F_MID, Math.round(F_MID.U / 4), Math.round(F_MID.V / 4)); A.nrm = smoothN(A); mesh('ground:mid', 'ground', mos('mid') ? groundTex('ground_mid', mos('mid')) : null, A, { order: 0 }); }
for (const Sd of S) { const id = Sd.id.replace(/\W/g, '_'), F = mos('near_' + id); if (!F) continue; const rim = 3;
  const A = grid(F, Math.round(F.U / 2), Math.round(F.V / 2), { lift: 0.012, alpha: (u, v) => Math.max(0, Math.min(1, Math.min(u, v, F.U - u, F.V - v) / rim)) }); A.nrm = smoothN(A);
  mesh('ground:near:' + Sd.id, 'decal', copyTex('ground_near_' + id, F.file), A, { order: 1, shed: Sd.id }); }
{ // the wide grid, 20 m: the cells under the mid picture left out but for one ring of them, sunk under it (no crack at the join)
  const st = 20, nu = Math.round(F_WIDE.U / st), nv = Math.round(F_WIDE.V / st);
  const inMid = (x, z, m) => { const dx = x - F_MID.o[0], dz = z - F_MID.o[1], u = dx * F_MID.eu[0] + dz * F_MID.eu[1], v = dx * F_MID.ev[0] + dz * F_MID.ev[1]; return u > m && v > m && u < F_MID.U - m && v < F_MID.V - m; };
  const wxz = (u, v) => [F_WIDE.o[0] + F_WIDE.eu[0] * u + F_WIDE.ev[0] * v, F_WIDE.o[1] + F_WIDE.eu[1] * u + F_WIDE.ev[1] * v];
  // THE LAND GOES ALL THE WAY ROUND, out to the far band (the user, 22 Nov, on the large hangar's back window: "the actual terrain ends at a
  // few dozen / hundred metres ... we need to patch that hole"): the wide picture was shot ahead of the doors and reached 350 m behind
  // them, the grid stopped with it. The grid now covers the far band's whole circle on the same 20 m lattice, and the picture is grown to
  // that frame (groundTex: past its own tiles the land's floor colour, the water's where the measured surface is water).
  let FB = F_WIDE, u0 = 0, v0 = 0;
  if (FAR) { const dx = FAR.eye[0] - F_WIDE.o[0], dz = FAR.eye[2] - F_WIDE.o[1], uc = dx * F_WIDE.eu[0] + dz * F_WIDE.eu[1], vc = dx * F_WIDE.ev[0] + dz * F_WIDE.ev[1], R = FAR.R + 3 * st;
    u0 = Math.min(0, Math.floor((uc - R) / st) * st); v0 = Math.min(0, Math.floor((vc - R) / st) * st);
    const u1 = Math.max(F_WIDE.U, Math.ceil((uc + R) / st) * st), v1 = Math.max(F_WIDE.V, Math.ceil((vc + R) / st) * st);
    FB = { o: [F_WIDE.o[0] + F_WIDE.eu[0] * u0 + F_WIDE.ev[0] * v0, F_WIDE.o[1] + F_WIDE.eu[1] * u0 + F_WIDE.ev[1] * v0], eu: F_WIDE.eu, ev: F_WIDE.ev, U: u1 - u0, V: v1 - v0 }; }
  const nuB = Math.round(FB.U / st), nvB = Math.round(FB.V / st), bxz = (u, v) => [FB.o[0] + FB.eu[0] * u + FB.ev[0] * v, FB.o[1] + FB.eu[1] * u + FB.ev[1] * v];
  const A = grid(FB, nuB, nvB, { skip: (u, v) => { const q = bxz(u, v); return inMid(q[0], q[1], st * 1.5) || (FAR && Math.hypot(q[0] - FAR.eye[0], q[1] - FAR.eye[2]) > FAR.R + 2.5 * st); }, drop: (u, v) => { const q = bxz(u, v); return inMid(q[0], q[1], 0.5) ? -0.35 : 0; },
    uvOf: (u, v) => [u / FB.U, 1 - v / FB.V] });
  A.nrm = smoothN(A); mesh('ground:wide', 'ground', mos('wide') ? groundTex('ground_wide', mos('wide'), FB) : null, A, { order: 0 });
  SCENE.stats.wide = { frame: [F_WIDE.U, F_WIDE.V], grid: [FB.U, FB.V], back: [-u0, -v0] }; }
if (!FAR) { // THE RING (only without a far band): from the wide picture's edge out to 32 km, the land's own heights (the skyline), coloured by what the land is
  const NA = 180, NR = 34, ROUT = 32000, cx = F_WIDE.o[0] + F_WIDE.eu[0] * F_WIDE.U / 2 + F_WIDE.ev[0] * F_WIDE.V / 2, cz = F_WIDE.o[1] + F_WIDE.eu[1] * F_WIDE.U / 2 + F_WIDE.ev[1] * F_WIDE.V / 2;
  const pos = [], col = [], idx = [], canopy = (x, z) => (W.island && W.island.canopyAt) ? W.island.canopyAt(x, z) : 0;
  for (let a = 0; a <= NA; a++) { const th = a / NA * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    // the direction in the wide frame, and where its ray leaves the rectangle (a hair inside: the two meet under the wide grid's rim)
    const rin = Math.min(F_WIDE.U / 2 / Math.max(1e-6, Math.abs(c)), F_WIDE.V / 2 / Math.max(1e-6, Math.abs(s))) - 4, dx = F_WIDE.eu[0] * c + F_WIDE.ev[0] * s, dz = F_WIDE.eu[1] * c + F_WIDE.ev[1] * s;
    for (let r = 0; r <= NR; r++) { const R = rin * Math.pow(ROUT / rin, r / NR), x = cx + dx * R, z = cz + dz * R, h = W.terrainH(x, z), y = Math.max(h, SEA) - (r === 0 ? 0.4 : 0) - R * R / (2 * 6371000 * 7 / 6);
      const p = L(x, y, z); pos.push(p[0], p[1], p[2]);
      const cn = canopy(x, z), k = h <= SEA + 0.05 ? [0.045, 0.085, 0.13] : cn >= 2.5 ? [0.032, 0.058, 0.036] : h > 650 ? [0.16, 0.16, 0.15] : [0.11, 0.13, 0.07];   // linear: the sea, the forest, the bare heights, the open ground
      col.push(k[0], k[1], k[2]); } }
  for (let a = 0; a < NA; a++) for (let r = 0; r < NR; r++) { const i0 = a * (NR + 1) + r, i1 = i0 + NR + 1; idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1); }
  const A = { pos: new Float32Array(pos), col: new Float32Array(col), idx: new Uint32Array(idx) };
  // face up: the ring is wound one way; turn it if its mean normal points down
  A.nrm = smoothN(A); let ny = 0; for (let i = 1; i < A.nrm.length; i += 3) ny += A.nrm[i]; if (ny < 0) { for (let t = 0; t < A.idx.length; t += 3) { const q = A.idx[t + 1]; A.idx[t + 1] = A.idx[t + 2]; A.idx[t + 2] = q; } A.nrm = smoothN(A); }
  mesh('ground:ring', 'ring', null, A, { order: 0, rout: ROUT }); }

// ================= THE FAR BAND: the pictures into one strip, the strip onto a wall at the near plane's distance ==================
if (FAR) {
  const camF = g => { const m = g.cam.mw, pj = g.cam.pj, w = g.info.w, h = g.info.h; return { w, h, I: PNG.decode(fs.readFileSync(path.join(CAP, g.name + '.png'))),
    px: d => { const vx = m[0] * d[0] + m[1] * d[1] + m[2] * d[2], vy = m[4] * d[0] + m[5] * d[1] + m[6] * d[2], vz = m[8] * d[0] + m[9] * d[1] + m[10] * d[2], cw = pj[3] * vx + pj[7] * vy + pj[11] * vz; if (cw <= 1e-6) return null;
      return [((pj[0] * vx + pj[4] * vy + pj[8] * vz) / cw * 0.5 + 0.5) * w, (1 - ((pj[1] * vx + pj[5] * vy + pj[9] * vz) / cw * 0.5 + 0.5)) * h]; } }; };
  const cams = FARG.map(camF), FARS = Object.assign({ low: -1.6, top: 13, w: 8192 }, SITE.far || {}), PW = +opt('farw', FARS.w), E0 = FARS.low * Math.PI / 180, E1 = FARS.top * Math.PI / 180, T0 = Math.tan(E0), T1 = Math.tan(E1), PH = Math.round(PW / (2 * Math.PI) * (T1 - T0));
  const out = new Uint8Array(PW * PH * 4); let covered = 0;
  // the card under the band's light (noon, no cloud): captured -> texture values (the greys)
  const cardG = CJ0.grabs.find(g => g.name === 'card_ground12') || CJ0.grabs.find(g => g.name === 'card_noon'); let lut = null;
  if (cardG) { const m = cardG.cam.mw, pj = cardG.cam.pj, I = PNG.decode(fs.readFileSync(path.join(CAP, cardG.name + '.png'))), K = cardG.card, cs = Math.cos(K.yaw), sn = Math.sin(K.yaw), xs = [[], [], []], ys = [];
    const px = (x, y, z) => { const dx = x - m[12], dy = y - m[13], dz = z - m[14], vx = m[0] * dx + m[1] * dy + m[2] * dz, vy = m[4] * dx + m[5] * dy + m[6] * dz, vz = m[8] * dx + m[9] * dy + m[10] * dz, cw = pj[3] * vx + pj[7] * vy + pj[11] * vz + pj[15]; return cw > 1e-6 ? [((pj[0] * vx + pj[4] * vy + pj[8] * vz + pj[12]) / cw * 0.5 + 0.5) * I.w, (1 - ((pj[1] * vx + pj[5] * vy + pj[9] * vz + pj[13]) / cw * 0.5 + 0.5)) * I.h] : null; };
    for (let i = 0; i < 8; i++) { const lx = ((i % K.grid[0] + 0.5) / K.grid[0] - 0.5) * K.w, lz = ((Math.floor(i / K.grid[0]) + 0.5) / K.grid[1] - 0.5) * K.h, q = px(K.at[0] + lx * cs + lz * sn, K.at[1], K.at[2] - lx * sn + lz * cs); if (!q) continue;
      const acc = [0, 0, 0]; let n = 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const X = Math.round(q[0] + dx), Y = Math.round(q[1] + dy); if (X < 0 || Y < 0 || X >= I.w || Y >= I.h) continue; const o = (Y * I.w + X) * I.ch; acc[0] += I.data[o]; acc[1] += I.data[o + 1]; acc[2] += I.data[o + 2]; n++; }
      if (n) { for (let k = 0; k < 3; k++) xs[k].push(acc[k] / n); ys.push(K.cols[i][0]); } }
    if (ys.length >= 4) lut = [0, 1, 2].map(k => { const X = xs[k].slice(), t = new Uint8Array(256); for (let i = 1; i < X.length; i++) if (X[i] <= X[i - 1]) X[i] = X[i - 1] + 0.01;
      for (let v = 0; v < 256; v++) { let i = 0; while (i < X.length - 2 && v > X[i + 1]) i++; t[v] = Math.max(0, Math.min(255, Math.round(ys[i] + (ys[i + 1] - ys[i]) * (v - X[i]) / (X[i + 1] - X[i])))); } return t; }); }
  for (let j = 0; j < PH; j++) { const te = T1 - (j + 0.5) / PH * (T1 - T0), ce = 1 / Math.hypot(1, te);
    for (let i = 0; i < PW; i++) { const th = (i + 0.5) / PW * 2 * Math.PI, d = [Math.sin(th) * ce, te * ce, -Math.cos(th) * ce]; let r = 0, g = 0, b = 0, a = 0, ws = 0;
      for (const c of cams) { const q = c.px(d); if (!q) continue; const mg = Math.min(q[0], q[1], c.w - q[0], c.h - q[1]); if (mg < 2) continue; const wt = Math.min(1, mg / 60);
        const X = Math.max(0, Math.min(c.w - 2, Math.floor(q[0] - 0.5))), Y = Math.max(0, Math.min(c.h - 2, Math.floor(q[1] - 0.5))), tx = q[0] - 0.5 - X, ty = q[1] - 0.5 - Y, I = c.I, ch = I.ch;
        for (const [ox, oy, wq] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) { const o = ((Y + oy) * I.w + X + ox) * ch, R0 = I.data[o], G0 = I.data[o + 1], B0 = I.data[o + 2], on = (R0 + G0 + B0) > 6 ? 1 : 0;   // the background is black: nothing past the near plane
          r += R0 * wq * wt * on; g += G0 * wq * wt * on; b += B0 * wq * wt * on; a += wq * wt * on; }
        ws += wt; }
      if (!ws || a <= 0) continue; const o = (j * PW + i) * 4, al = a / ws; r /= a; g /= a; b /= a;
      out[o] = lut ? lut[0][Math.round(r)] : r; out[o + 1] = lut ? lut[1][Math.round(g)] : g; out[o + 2] = lut ? lut[2][Math.round(b)] : b; out[o + 3] = Math.round(al * 255); if (al > 0.5) covered++; } }
  // the colour bled one texel past the cut (no dark rim at the skyline)
  { const src = Uint8Array.from(out); for (let j = 1; j < PH - 1; j++) for (let i = 0; i < PW; i++) { const o = (j * PW + i) * 4; if (src[o + 3] > 0) continue; for (const q of [o + PW * 4, o - PW * 4, ((j * PW + (i + 1) % PW)) * 4, ((j * PW + (i + PW - 1) % PW)) * 4]) if (src[q + 3] > 0) { out[o] = src[q]; out[o + 1] = src[q + 1]; out[o + 2] = src[q + 2]; break; } } }
  // THE BAND IN ROWS (GATE ASSETS: no picture over 4096 px; many GPUs stop there): the circle cut in equal arcs laid one under the other,
  // a 4-texel gutter between them (each arc's own edge rows repeated: no bleed from its neighbour under the mips)
  const FROWS = Math.max(1, Math.ceil(PW / 4096)), TW = Math.floor(PW / FROWS), GUT = FROWS > 1 ? 4 : 0, TH = FROWS * PH + (FROWS - 1) * GUT, ftex = new Uint8Array(TW * TH * 4);
  for (let r = 0; r < FROWS; r++) { const y0 = r * (PH + GUT);
    for (let j = -(r ? GUT / 2 : 0); j < PH + (r < FROWS - 1 ? GUT / 2 : 0); j++) { const sj = Math.max(0, Math.min(PH - 1, j)); ftex.set(out.subarray((sj * PW + r * TW) * 4, (sj * PW + r * TW + TW) * 4), ((y0 + j) * TW) * 4); } }
  fs.writeFileSync(path.join(OUT, 'far.png'), PNG.encode(TW, TH, 4, ftex)); SCENE.textures.far = { file: 'far.png', srgb: true };
  // the wall: at the near plane's distance round the eye the band was shot from, its height the strip's own (linear in tan(elevation))
  const NA = 96, NR = Math.round(NA / FROWS), pos = [], uv = [], nrm = [], idx = [];
  for (let r = 0; r < FROWS; r++) { const b0 = pos.length / 3, y0 = r * (PH + GUT), vTop = 1 - (y0 + 0.5) / TH, vBot = 1 - (y0 + PH - 0.5) / TH, e = 0.5 / TW;
    for (let a = 0; a <= NR; a++) { const th = (r + a / NR) / FROWS * 2 * Math.PI, sx = Math.sin(th), sz = -Math.cos(th); for (const [tv, v] of [[T0, vBot], [T1, vTop]]) { const pp = L(FAR.eye[0] + sx * FAR.R, FAR.eye[1] + tv * FAR.R, FAR.eye[2] + sz * FAR.R); pos.push(pp[0], pp[1], pp[2]); uv.push(e + a / NR * (1 - 2 * e), v); nrm.push(-sx * 0.3, 0.95, -sz * 0.3); } }
    for (let a = 0; a < NR; a++) { const i0 = b0 + a * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 2, i0 + 1, i0 + 3); } }
  mesh('far', 'far', 'far', { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint32Array(idx) }, { alphaTest: 0.5, doubleSide: true, R: FAR.R });
  SCENE.stats.far = { strip: [PW, PH], sheet: [TW, TH], rows: FROWS, covered: +(covered / (PW * PH)).toFixed(3), shots: FARG.length, R: FAR.R, card: !!lut };
}

// ================= THE LOW LAYERS: rings of distance, each a strip on its wall ===================================================
if (LCAP && fs.existsSync(path.join(LCAP, 'capture.json'))) {
  const CL = JSON.parse(fs.readFileSync(path.join(LCAP, 'capture.json'), 'utf8')), SL = CL.grabs.filter(g => g.kind === 'slice' && fs.existsSync(path.join(LCAP, g.name + '.png')));
  const rings = Array.from(new Set(SL.map(g => g.ring))).sort((a, b) => a - b);
  if (rings.length) {
    const camS = g => { const m = g.cam.mw, pj = g.cam.pj, w = g.info.w, h = g.info.h; return { w, h, I: PNG.decode(fs.readFileSync(path.join(LCAP, g.name + '.png'))),
      px: d => { const vx = m[0] * d[0] + m[1] * d[1] + m[2] * d[2], vy = m[4] * d[0] + m[5] * d[1] + m[6] * d[2], vz = m[8] * d[0] + m[9] * d[1] + m[10] * d[2], cw = pj[3] * vx + pj[7] * vy + pj[11] * vz; if (cw <= 1e-6) return null;
        return [((pj[0] * vx + pj[4] * vy + pj[8] * vz) / cw * 0.5 + 0.5) * w, (1 - ((pj[1] * vx + pj[5] * vy + pj[9] * vz) / cw * 0.5 + 0.5)) * h]; } }; };
    const tap = (I, x, y, o3) => { const X = Math.max(0, Math.min(I.w - 2, Math.floor(x - 0.5))), Y = Math.max(0, Math.min(I.h - 2, Math.floor(y - 0.5))), tx = Math.max(0, Math.min(1, x - 0.5 - X)), ty = Math.max(0, Math.min(1, y - 0.5 - Y)), c = I.ch, o = (Y * I.w + X) * c, o2 = o + I.w * c;
      for (let k = 0; k < 3; k++) o3[k] = (I.data[o + k] * (1 - tx) + I.data[o + c + k] * tx) * (1 - ty) + (I.data[o2 + k] * (1 - tx) + I.data[o2 + c + k] * tx) * ty; };
    // the card under the layers' sky (covered, no sun shadow): captured -> texture values
    const cardG = CL.grabs.find(g => g.name === 'card_props'); let lut = null;
    if (cardG) { const m = cardG.cam.mw, pj = cardG.cam.pj, I = PNG.decode(fs.readFileSync(path.join(LCAP, cardG.name + '.png'))), K = cardG.card, cs = Math.cos(K.yaw), sn = Math.sin(K.yaw), xs = [[], [], []], ys = [];
      const px = (x, y, z) => { const dx = x - m[12], dy = y - m[13], dz = z - m[14], vx = m[0] * dx + m[1] * dy + m[2] * dz, vy = m[4] * dx + m[5] * dy + m[6] * dz, vz = m[8] * dx + m[9] * dy + m[10] * dz, cw = pj[3] * vx + pj[7] * vy + pj[11] * vz + pj[15]; return cw > 1e-6 ? [((pj[0] * vx + pj[4] * vy + pj[8] * vz + pj[12]) / cw * 0.5 + 0.5) * I.w, (1 - ((pj[1] * vx + pj[5] * vy + pj[9] * vz + pj[13]) / cw * 0.5 + 0.5)) * I.h] : null; };
      for (let i = 0; i < 8; i++) { const lx = ((i % K.grid[0] + 0.5) / K.grid[0] - 0.5) * K.w, lz = ((Math.floor(i / K.grid[0]) + 0.5) / K.grid[1] - 0.5) * K.h, q = px(K.at[0] + lx * cs + lz * sn, K.at[1], K.at[2] - lx * sn + lz * cs); if (!q) continue;
        const acc = [0, 0, 0]; let n = 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const X = Math.round(q[0] + dx), Y = Math.round(q[1] + dy); if (X < 0 || Y < 0 || X >= I.w || Y >= I.h) continue; const o = (Y * I.w + X) * I.ch; acc[0] += I.data[o]; acc[1] += I.data[o + 1]; acc[2] += I.data[o + 2]; n++; }
        if (n) { for (let k = 0; k < 3; k++) xs[k].push(acc[k] / n); ys.push(K.cols[i][0]); } }
      if (ys.length >= 4) lut = [0, 1, 2].map(k => { const X = xs[k].slice(), t = new Uint8Array(256); for (let i = 1; i < X.length; i++) if (X[i] <= X[i - 1]) X[i] = X[i - 1] + 0.01;
        for (let v = 0; v < 256; v++) { let i = 0; while (i < X.length - 2 && v > X[i + 1]) i++; t[v] = Math.max(0, Math.min(255, Math.round(ys[i] + (ys[i + 1] - ys[i]) * (v - X[i]) / (X[i + 1] - X[i])))); } return t; }); }
    // the arc the rings were shot over (the first ring's yaws, the lens's half width more each side), and the strips' rows in one sheet
    const g0 = SL.filter(g => g.ring === rings[0] && g.pass === 'all'), yaws = g0.map(g => g.yaw).sort((a, b) => a - b), hf = Math.atan(Math.tan(g0[0].cam.fov * Math.PI / 360) * g0[0].cam.aspect) * 0.92;
    const A0 = yaws[0] - hf, A1 = yaws[yaws.length - 1] + hf, eye = g0[0].eye, PW = +opt('layw', 4096), ppr = PW / (A1 - A0), EYEH = 2.0, rows = [];
    // THE ROWS FOLLOW THE GROUND (a valley's shed: the first site was a plain, its rows stood at the eye's own height): each ring's strip
    // spans 1 m under the ground to 10 m over it AT THE RING, direction by direction (gnd: the ground's tan(elevation) there, from the eye)
    const gndOf = (th, Rm) => (Hh(eye[0] + Math.sin(th) * Rm, eye[2] - Math.cos(th) * Rm) - eye[1]) / Rm;
    let PH = 0; for (const r of rings) { const g = SL.find(q => q.ring === r), T0 = -1.0 / g.near, T1 = 10 / g.near, h = Math.max(8, Math.ceil(ppr * (T1 - T0))), Rm = Math.sqrt(g.near * g.far), gnd = new Float32Array(PW);
      for (let i = 0; i < PW; i++) gnd[i] = gndOf(A0 + (i + 0.5) / PW * (A1 - A0), Rm);
      rows.push({ r, near: g.near, far: g.far, Rm, T0, T1, y0: PH, h, gnd }); PH += h + 2; }
    const sheet = new Uint8Array(PW * PH * 4), a3 = [0, 0, 0], b3 = [0, 0, 0]; let solid = 0;
    for (const R of rows) { const pairs = []; for (const ga of SL.filter(g => g.ring === R.r && g.pass === 'all')) { const gb = SL.find(g => g.ring === R.r && g.pass === 'ground' && g.k === ga.k); if (gb) pairs.push({ a: camS(ga), b: camS(gb) }); }
      for (let j = 0; j < R.h; j++) { const tj = R.T1 - (j + 0.5) / R.h * (R.T1 - R.T0);
        for (let i = 0; i < PW; i++) { const te = R.gnd[i] + tj, ce = 1 / Math.hypot(1, te), th = A0 + (i + 0.5) / PW * (A1 - A0), d = [Math.sin(th) * ce, te * ce, -Math.cos(th) * ce]; let r = 0, g = 0, b = 0, al = 0, ws = 0;
          for (const P of pairs) { const q = P.a.px(d); if (!q) continue; const mg = Math.min(q[0], q[1], P.a.w - q[0], P.a.h - q[1]); if (mg < 2) continue; const wt = Math.min(1, mg / 60);
            tap(P.a.I, q[0], q[1], a3); tap(P.b.I, q[0], q[1], b3); const df = Math.max(Math.abs(a3[0] - b3[0]), Math.abs(a3[1] - b3[1]), Math.abs(a3[2] - b3[2])), a = Math.max(0, Math.min(1, (df - 7) / 16));
            r += a3[0] * wt; g += a3[1] * wt; b += a3[2] * wt; al += a * wt; ws += wt; }
          if (!ws) continue; const o = ((R.y0 + j) * PW + i) * 4; r /= ws; g /= ws; b /= ws; al /= ws;
          sheet[o] = lut ? lut[0][Math.round(r)] : r; sheet[o + 1] = lut ? lut[1][Math.round(g)] : g; sheet[o + 2] = lut ? lut[2][Math.round(b)] : b; sheet[o + 3] = Math.round(al * 255); if (al > 0.5) solid++; } } }
    fs.writeFileSync(path.join(OUT, 'layers.png'), PNG.encode(PW, PH, 4, sheet)); SCENE.textures.layers = { file: 'layers.png', srgb: true };
    // the walls: the far rings first (the near ones draw over them: alpha tested, depth written)
    const NA = 144, pos = [], uv = [], nrm = [], idx = [];   // (144 columns: the wall bends with the ground, 1.4 degrees a column)
    for (const R of rows.slice().reverse()) { const b0 = pos.length / 3;
      for (let a = 0; a <= NA; a++) { const th = A0 + a / NA * (A1 - A0), sx = Math.sin(th), sz = -Math.cos(th), ga = R.gnd[Math.min(PW - 1, Math.round(a / NA * (PW - 1)))]; for (const [tv, row] of [[R.T0, R.y0 + R.h], [R.T1, R.y0]]) { const pp = L(eye[0] + sx * R.Rm, eye[1] + (ga + tv) * R.Rm, eye[2] + sz * R.Rm); pos.push(pp[0], pp[1], pp[2]); uv.push(a / NA, 1 - row / PH); nrm.push(-sx * 0.3, 0.95, -sz * 0.3); } }
      for (let a = 0; a < NA; a++) { const i0 = b0 + a * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 2, i0 + 1, i0 + 3); } }
    mesh('layers', 'far', 'layers', { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint32Array(idx) }, { alphaTest: 0.5, doubleSide: true });
    SCENE.stats.layers = { rings: rows.map(R => [R.near, R.far]), sheet: [PW, PH], solid: +(solid / (PW * PH)).toFixed(3), arcDeg: +((A1 - A0) * 180 / Math.PI).toFixed(0), card: !!lut };
  }
}

// ================= THE TREES ==================================================================================================
const SHEETS = CAP && fs.existsSync(path.join(CAP, 'sheets.json')) ? JSON.parse(fs.readFileSync(path.join(CAP, 'sheets.json'), 'utf8')) : null;
{ const R = CEN.rec, SER = ['rungs', 'stand', 'snag'], near = []; for (let i = 0; i < CEN.trees.length; i += R) if (Math.hypot(CEN.trees[i + 2] - M.mid.x, CEN.trees[i + 4] - M.mid.z) < TREE_R) near.push(i);
  const sheetOf = (key, ser) => SHEETS ? (SHEETS.find(a => a.key === key && a.series === SER[ser]) || SHEETS.find(a => a.key === key && a.series === 'rungs')) : null;
  // the sheets asked for, in atlas rows; 8 level views a sheet: the border tiles of the hemi-octahedral grid nearest every 45 degrees
  const used = new Map(); for (const i of near) { const key = CEN.keys[CEN.trees[i]], ser = CEN.trees[i + 1], sh = sheetOf(key, ser); if (sh && !used.has(sh.layer)) used.set(sh.layer, sh); }
  const rows = Array.from(used.values()).filter(a => fs.existsSync(path.join(CAP, 'sheet_' + String(a.layer).padStart(3, '0') + '_col_rgb.png')));
  const NV = 8; let atlas = null;
  if (rows.length) {
    const G = rows[0].grid, TS = rows[0].tile, AW = NV * TS, AH = rows.length * TS, colA = new Uint8Array(AW * AH * 4), nrmA = new Uint8Array(AW * AH * 4);
    // render_world.js impDir: the tile's eye direction (the level ones: the grid's border)
    const impDir = (i, j) => { const a = i / (G - 1) * 2 - 1, b = j / (G - 1) * 2 - 1, px = (a + b) / 2, py = (a - b) / 2, v = [px, 1 - Math.abs(px) - Math.abs(py), py], l = Math.hypot(v[0], v[1], v[2]); return v.map(q => q / l); };
    const border = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (i === 0 || j === 0 || i === G - 1 || j === G - 1) { const d = impDir(i, j); if (Math.abs(d[1]) < 0.02) border.push({ i, j, d, az: Math.atan2(d[2], d[0]) }); }
    const views = []; for (let k = 0; k < NV; k++) { const az = -Math.PI + (k + 0.5) / NV * 2 * Math.PI; let best = border[0], bd = 9; for (const b of border) { const dd = Math.abs(Math.atan2(Math.sin(b.az - az), Math.cos(b.az - az))); if (dd < bd) { bd = dd; best = b; } } views.push(best); }
    rows.forEach((sh, r) => { const base = path.join(CAP, 'sheet_' + String(sh.layer).padStart(3, '0')), rd = n => PNG.decode(fs.readFileSync(base + n));
      const cRGB = rd('_col_rgb.png'), cA = rd('_col_a.png'), nRGB = rd('_nrm_rgb.png'), nA = rd('_nrm_a.png'), N = cRGB.w, t = sh.tint || {};
      // the game's tint (trees.js TINT_GLSL): a hue turn in YIQ, the saturation about the luma, the light
      const a0 = -(t.hue || 0) * 6.2831853, c = Math.cos(a0), s = Math.sin(a0), sat = t.sat == null ? 1 : t.sat, light = t.light == null ? 1 : t.light;
      const m = [0.299 + 0.701 * c + 0.168 * s, 0.587 - 0.587 * c + 0.330 * s, 0.114 - 0.114 * c - 0.497 * s, 0.299 - 0.299 * c - 0.328 * s, 0.587 + 0.413 * c + 0.035 * s, 0.114 - 0.114 * c + 0.292 * s, 0.299 - 0.300 * c + 1.250 * s, 0.587 - 0.588 * c - 1.050 * s, 0.114 + 0.886 * c - 0.203 * s];
      views.forEach((vw, k) => { const d = vw.d, X = [d[2], 0, -d[0]], xl = Math.hypot(X[0], X[2]) || 1; X[0] /= xl; X[2] /= xl;   // the bake camera's right: up x d
        const Y = [d[1] * X[2] - d[2] * X[1], d[2] * X[0] - d[0] * X[2], d[0] * X[1] - d[1] * X[0]];                       // its up: d x right
        for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
          // the sheet was read bottom row first and written as it came: the tile (i, j) stands at rows j*TS.. of the picture, its own top at the bottom
          const sx = vw.i * TS + x, sy = vw.j * TS + (TS - 1 - y), so = sy * N + sx, o = ((r * TS + y) * AW + k * TS + x) * 4, al = cA.data[so * cA.ch] / 255;
          if (al > 0.004) { // un-premultiplied, tinted in linear light, back to sRGB
            const lr = s2l(cRGB.data[so * cRGB.ch]) / al, lg = s2l(cRGB.data[so * cRGB.ch + 1]) / al, lb = s2l(cRGB.data[so * cRGB.ch + 2]) / al;
            const rr = lr * m[0] + lg * m[3] + lb * m[6], rg = lr * m[1] + lg * m[4] + lb * m[7], rb = lr * m[2] + lg * m[5] + lb * m[8], yv = 0.2126 * rr + 0.7152 * rg + 0.0722 * rb;
            colA[o] = l2s((yv + (rr - yv) * sat) * light); colA[o + 1] = l2s((yv + (rg - yv) * sat) * light); colA[o + 2] = l2s((yv + (rb - yv) * sat) * light);
            // the normal: the tree's own (0..1 -> -1..1, un-premultiplied by the same coverage), into the card's frame (right, up, toward the eye)
            const nx = (nRGB.data[so * nRGB.ch] / 255 / al) * 2 - 1, ny = (nRGB.data[so * nRGB.ch + 1] / 255 / al) * 2 - 1, nz = (nRGB.data[so * nRGB.ch + 2] / 255 / al) * 2 - 1;
            let tx = nx * X[0] + ny * X[1] + nz * X[2], ty = nx * Y[0] + ny * Y[1] + nz * Y[2], tz = nx * d[0] + ny * d[1] + nz * d[2]; tz = Math.max(0.05, tz); const tl = Math.hypot(tx, ty, tz) || 1;
            nrmA[o] = Math.round((tx / tl * 0.5 + 0.5) * 255); nrmA[o + 1] = Math.round((ty / tl * 0.5 + 0.5) * 255); nrmA[o + 2] = Math.round((tz / tl * 0.5 + 0.5) * 255);
          } else { nrmA[o] = 128; nrmA[o + 1] = 128; nrmA[o + 2] = 255; }
          colA[o + 3] = Math.round(al * 255); nrmA[o + 3] = nA.data[so * nA.ch];
        } });
      sh.row = r; });
    // the colour bled outward under the cut edge (four passes): no dark rim where the mips and the bilinear tap reach past the coverage
    for (let pass = 0; pass < 4; pass++) { const src = Uint8Array.from(colA); for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { const o = (y * AW + x) * 4; if (src[o + 3] > 8) continue; let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= AW || yy >= AH || Math.floor(xx / TS) !== Math.floor(x / TS) || Math.floor(yy / TS) !== Math.floor(y / TS)) continue; const q = (yy * AW + xx) * 4; if (src[q + 3] > 8 || (src[q] | src[q + 1] | src[q + 2])) { r += src[q]; g += src[q + 1]; b += src[q + 2]; n++; } }
        if (n) { colA[o] = r / n; colA[o + 1] = g / n; colA[o + 2] = b / n; } } }
    fs.writeFileSync(path.join(OUT, 'trees_col.png'), PNG.encode(AW, AH, 4, colA)); fs.writeFileSync(path.join(OUT, 'trees_nrm.png'), PNG.encode(AW, AH, 4, nrmA));
    SCENE.textures.trees_col = { file: 'trees_col.png', srgb: true }; SCENE.textures.trees_nrm = { file: 'trees_nrm.png', srgb: false };
    atlas = { AW, AH, TS, views, rows };
  }
  // the cards: each tree's quad, facing the middle of the two sheds at eye height; its view = the tile nearest the line of sight in the tree's own turn
  const pos = [], uv = [], col = [], nrm = [], idx = []; let n = 0; const E0 = [M.mid.x, M.mid.z];
  const vary = (x, z) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return 1 + (2 * (h - Math.floor(h)) - 1) * 0.12; };
  for (const i of near) { const key = CEN.keys[CEN.trees[i]], ser = CEN.trees[i + 1], x = CEN.trees[i + 2], y = CEN.trees[i + 3], z = CEN.trees[i + 4], yaw = CEN.trees[i + 5], s = CEN.trees[i + 6], sy = CEN.trees[i + 7], sh = sheetOf(key, ser);
    if (atlas && (!sh || sh.row === undefined)) continue;
    const cy = sh ? sh.cy : CEN.trees[i + 8] / 2, diam = sh ? sh.diam : CEN.trees[i + 8] * 1.1, vx = E0[0] - x, vz = E0[1] - z, vl = Math.hypot(vx, vz) || 1, nx = vx / vl, nz = vz / vl, rx = nz, rz = -nx;   // right = up x toward-the-eye
    const w2 = diam * s / 2, h2 = diam * sy / 2, yc = y + cy * sy, b = pos.length / 3;
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = L(x + rx * w2 * a, yc + h2 * c, z + rz * w2 * a); pos.push(p[0], p[1], p[2]); nrm.push(nx, 0, nz); }   // (the card's face, level: the page stands the sheet's normal in it)
    let u0 = 0, v0 = 0, du = 1, dv = 1;
    if (atlas) { // the eye's direction in the tree's own frame (the tree is turned by rotation.y = yaw)
      const lx = nx * Math.cos(yaw) - nz * Math.sin(yaw), lz = nx * Math.sin(yaw) + nz * Math.cos(yaw); let k = 0, bd = -9; atlas.views.forEach((vw, q) => { const dd = vw.d[0] * lx + vw.d[2] * lz; if (dd > bd) { bd = dd; k = q; } });
      const e = 0.5 / atlas.TS; u0 = (k + e) / NV; du = (1 - 2 * e) / NV; v0 = 1 - (sh.row + 1 - e) / atlas.rows.length; dv = (1 - 2 * e) / atlas.rows.length; }
    uv.push(u0, v0, u0 + du, v0, u0 + du, v0 + dv, u0, v0 + dv);
    const k = vary(x, z); for (let q = 0; q < 4; q++) col.push(k, k, k);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3); n++; }
  mesh('trees', 'cards', atlas ? 'trees_col' : null, { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), col: new Float32Array(col), idx: new Uint32Array(idx) }, { nrmTex: atlas ? 'trees_nrm' : null, alphaTest: 0.5 });
  SCENE.stats.trees = { cards: n, within: TREE_R, species: atlas ? atlas.rows.map(a => a.key + '|' + a.series) : null, atlas: atlas ? [atlas.AW, atlas.AH] : null };
}

// ================= WHAT STANDS NEAR ===========================================================================================
// (--props a,b: several captures, the first one that holds a thing wins - a slot may end before its last thing)
const PCAPS = String(PCAP || '').split(',').filter(c => c && fs.existsSync(path.join(c, 'capture.json')));
if (PCAPS.length) {
  {
    const things = [], seen = [];
    const f32 = b => { const u = Buffer.from(b, 'base64'); return new Float32Array(u.buffer, u.byteOffset, u.length / 4); }, u32 = b => { const u = Buffer.from(b, 'base64'); return new Uint32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)); };
    const camOf = g => { const m = g.cam.mw, p = g.cam.pj, w = g.info.w, h = g.info.h, t = [m[12], m[13], m[14]];
      return { w, h, pos: t, px: (x, y, z) => { const dx = x - t[0], dy = y - t[1], dz = z - t[2], vx = m[0] * dx + m[1] * dy + m[2] * dz, vy = m[4] * dx + m[5] * dy + m[6] * dz, vz = m[8] * dx + m[9] * dy + m[10] * dz, cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15]; if (cw <= 1e-6) return null;
        return [((p[0] * vx + p[4] * vy + p[8] * vz + p[12]) / cw * 0.5 + 0.5) * w, (1 - ((p[1] * vx + p[5] * vy + p[9] * vz + p[13]) / cw * 0.5 + 0.5)) * h]; } }; };
    for (const CAP of PCAPS) {
    const CJ = JSON.parse(fs.readFileSync(path.join(CAP, 'capture.json'), 'utf8')), PR = (CJ.steps.props && CJ.steps.props.kept) || [];
    // the card under the props' sky: captured -> texture values (ground_merge.js's law, the greys only)
    const cardG = CJ.grabs.find(g => g.name === 'card_props'); let lut = null;
    if (cardG && fs.existsSync(path.join(CAP, cardG.name + '.png'))) { const cam = camOf(cardG), I = PNG.decode(fs.readFileSync(path.join(CAP, cardG.name + '.png'))), K = cardG.card, cs = Math.cos(K.yaw), sn = Math.sin(K.yaw), xs = [[], [], []], ys = [];
      for (let i = 0; i < 8; i++) { const lx = ((i % K.grid[0] + 0.5) / K.grid[0] - 0.5) * K.w, lz = ((Math.floor(i / K.grid[0]) + 0.5) / K.grid[1] - 0.5) * K.h, q = cam.px(K.at[0] + lx * cs + lz * sn, K.at[1], K.at[2] - lx * sn + lz * cs); if (!q) continue;
        const acc = [0, 0, 0]; let n = 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const X = Math.round(q[0] + dx), Y = Math.round(q[1] + dy); if (X < 0 || Y < 0 || X >= I.w || Y >= I.h) continue; const o = (Y * I.w + X) * I.ch; acc[0] += I.data[o]; acc[1] += I.data[o + 1]; acc[2] += I.data[o + 2]; n++; }
        if (n) { for (let k = 0; k < 3; k++) xs[k].push(acc[k] / n); ys.push(K.cols[i][0]); } }
      if (ys.length >= 4) { lut = [0, 1, 2].map(k => { const X = xs[k].slice(), t = new Uint8Array(256); for (let i = 1; i < X.length; i++) if (X[i] <= X[i - 1]) X[i] = X[i - 1] + 0.01;
        for (let v = 0; v < 256; v++) { let i = 0; while (i < X.length - 2 && v > X[i + 1]) i++; t[v] = Math.max(0, Math.min(255, Math.round(ys[i] + (ys[i + 1] - ys[i]) * (v - X[i]) / (X[i + 1] - X[i])))); } return t; }); } }
    for (const pr of PR) { const f = path.join(CAP, 'prop_' + String(pr.i).padStart(2, '0') + '.json'); if (!fs.existsSync(f)) continue; const J = JSON.parse(fs.readFileSync(f, 'utf8')); if (!J.tris) continue;
      if (pr.c && seen.some(c => Math.hypot(c[0] - pr.c[0], c[2] - pr.c[2]) < 2)) continue;   // (an earlier capture holds it)
      const P = f32(J.pos), Nn = f32(J.nrm), Ix = u32(J.idx),
      // (a thing's shots by its index and eye: capture 2 of 22 Nov wrote the thing's name over the grab's)
      shots = CJ.grabs.filter(g => g.kind === 'prop' && g.thing === pr.i).map(g => Object.assign({}, g, { name: 'prop_' + String(pr.i).padStart(2, '0') + '_' + g.eye })).filter(g => fs.existsSync(path.join(CAP, g.name + '.png'))).map(g => ({ g, cam: camOf(g), I: null, bb: [1e9, 1e9, -1e9, -1e9], tri: [] }));
      if (!shots.length) continue;
      // each triangle to the shot that faces it best and holds it whole
      for (let t = 0; t < Ix.length; t += 3) { const a = Ix[t] * 3, b = Ix[t + 1] * 3, c = Ix[t + 2] * 3, cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
        const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]; let fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const fl = Math.hypot(fn[0], fn[1], fn[2]) || 1; fn = fn.map(v => v / fl);
        let best = -1, bs = -9, bq = null;
        shots.forEach((sh, k) => { const q = [cam3(sh.cam, P, a), cam3(sh.cam, P, b), cam3(sh.cam, P, c)]; if (q.some(v => !v || v[0] < 1 || v[1] < 1 || v[0] > sh.cam.w - 2 || v[1] > sh.cam.h - 2)) return;
          const tx = sh.cam.pos[0] - cx, ty = sh.cam.pos[1] - cy, tz = sh.cam.pos[2] - cz, tl = Math.hypot(tx, ty, tz) || 1, sc = Math.abs(fn[0] * tx + fn[1] * ty + fn[2] * tz) / tl; if (sc > bs) { bs = sc; best = k; bq = q; } });
        if (best < 0) continue; const sh = shots[best]; sh.tri.push({ v: [a, b, c], q: bq });
        for (const v of bq) { sh.bb[0] = Math.min(sh.bb[0], v[0]); sh.bb[1] = Math.min(sh.bb[1], v[1]); sh.bb[2] = Math.max(sh.bb[2], v[0]); sh.bb[3] = Math.max(sh.bb[3], v[1]); } }
      things.push({ pr, P, Nn, CAP, lut, shots: shots.filter(sh => sh.tri.length) }); if (pr.c) seen.push(pr.c); }
    }
    // every thing's shots, their used rectangles packed on shelves into one sheet
    const AT = 2048, sheet = new Uint8Array(AT * AT * 4), BK = new Map(); let shelfY = 0, shelfH = 0, cursorX = 0, placed = 0, tris = 0;
    function cam3(cam, P, a) { return cam.px(P[a], P[a + 1], P[a + 2]); }
    // the scale: the rectangles' total area into ~80 % of the sheet
    let area = 0; for (const th of things) for (const sh of th.shots) area += (sh.bb[2] - sh.bb[0] + 4) * (sh.bb[3] - sh.bb[1] + 4);
    const sc = Math.min(1, Math.sqrt(AT * AT * 0.78 / Math.max(1, area)));
    const all = []; for (const th of things) for (const sh of th.shots) all.push({ th, sh, w: Math.ceil((sh.bb[2] - sh.bb[0]) * sc) + 4, h: Math.ceil((sh.bb[3] - sh.bb[1]) * sc) + 4 });
    all.sort((a, b) => b.h - a.h);
    for (const R of all) { if (cursorX + R.w > AT) { cursorX = 0; shelfY += shelfH; shelfH = 0; } if (shelfY + R.h > AT) { R.skip = true; continue; } R.x = cursorX; R.y = shelfY; cursorX += R.w; shelfH = Math.max(shelfH, R.h); placed++;
      const I = PNG.decode(fs.readFileSync(path.join(R.th.CAP, R.sh.g.name + '.png'))), lut = R.th.lut;
      for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const sx = R.sh.bb[0] + (x - 2) / sc, sy = R.sh.bb[1] + (y - 2) / sc, X = Math.max(0, Math.min(I.w - 1, Math.round(sx))), Y = Math.max(0, Math.min(I.h - 1, Math.round(sy))), o = (Y * I.w + X) * I.ch, d = ((R.y + y) * AT + R.x + x) * 4;
        for (let k = 0; k < 3; k++) sheet[d + k] = lut ? lut[k][I.data[o + k]] : I.data[o + k]; sheet[d + 3] = 255; }
      // a SHED of the world is a mesh of its own (a room does not stand its own shed's outside round itself: the page leaves it out)
      const own = /^shed:/.test(R.th.pr.name || '') ? R.th.pr.name : '', Bk = BK.get(own) || (BK.set(own, { pos: [], nrm: [], uv: [], idx: [], c: R.th.pr.c }), BK.get(own));
      for (const tr of R.sh.tri) { const b = Bk.pos.length / 3; for (let k = 0; k < 3; k++) { const a = tr.v[k], p = L(R.th.P[a], R.th.P[a + 1], R.th.P[a + 2]); Bk.pos.push(p[0], p[1], p[2]); Bk.nrm.push(R.th.Nn[a], R.th.Nn[a + 1], R.th.Nn[a + 2]);
          Bk.uv.push((R.x + 2 + (tr.q[k][0] - R.sh.bb[0]) * sc) / AT, 1 - (R.y + 2 + (tr.q[k][1] - R.sh.bb[1]) * sc) / AT); } Bk.idx.push(b, b + 1, b + 2); tris++; } }
    if (tris) { fs.writeFileSync(path.join(OUT, 'props.png'), PNG.encode(AT, AT, 4, sheet)); SCENE.textures.props = { file: 'props.png', srgb: true };
      for (const [own, Bk] of BK) mesh(own ? 'props:' + own : 'props', 'props', 'props', { pos: new Float32Array(Bk.pos), nrm: new Float32Array(Bk.nrm), uv: new Float32Array(Bk.uv), idx: new Uint32Array(Bk.idx) }, own ? { doubleSide: true, at: [Bk.c[0], Bk.c[2]] } : { doubleSide: true });
      SCENE.stats.props = { things: things.length, names: things.map(t => t.pr.name), shots: placed, tris, scale: +sc.toFixed(3), card: things.some(t => !!t.lut), from: PCAPS.map(c => path.basename(c)) }; }
  }
}

SCENE.bytes = binAt;
fs.writeFileSync(path.join(OUT, 'scene.bin'), Buffer.concat(BIN)); fs.writeFileSync(path.join(OUT, 'scene.json'), JSON.stringify(SCENE));
console.log('cook: ' + SCENE.meshes.length + ' meshes, ' + SCENE.meshes.reduce((a, m) => a + m.tris, 0) + ' triangles, scene.bin ' + (binAt / 1024).toFixed(0) + ' kB -> ' + OUT);
for (const m of SCENE.meshes) console.log('  ' + m.name.padEnd(22) + String(m.tris).padStart(7) + ' tris  ' + (m.tex || '(no picture yet)'));
console.log('  stats ' + JSON.stringify(SCENE.stats));
