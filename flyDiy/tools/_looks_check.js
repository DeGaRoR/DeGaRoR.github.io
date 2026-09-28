#!/usr/bin/env node
// _looks_check.js — GATE LOOKS (B4a-LOOKS G750-G754, the 2026-09-26 Jolene playtest): the world's surfaces meet.
//
// The code under test is the shipped source, its blocks LIFTED and run in node on Jolene (tools/island_node.js, the
// world composed with the fixture's premises as the page composes it) - a block's anchors not found is a FAIL, never a
// silent skip.
//
//   1. THE PATCH'S BORDER (G752, render_premises.js PATCH_TUCK / ringSink / patchDepth). The depth inside the patch is
//      0 on an unbuilt chunk's edge from BOTH sides of it (the old walk missed a chunk's low-x and low-z edges); the
//      rings sink 0 within ring0 of the edge and the full 4 m past ring1; and the two laws together - the patch's tuck
//      and a ring triangle whose vertices sink by the law, at every phase of the ring's 17.6 m grid - leave the drawn
//      ground (the higher of the two) at most 0.6 m under the true ground across a border. The old laws (2.2 m over
//      40 m, 4 m at any built chunk) are measured by the same walk: the playtest's trench (145815 / 152402).
//   2. THE DRAWN LAKES (G751/G753, render_world.js lakeR / lakeTexels / isSea). On Jolene with its premises: the pond
//      beside 02/20 (the lake at 241, 599) is filled by the runway's grade - every one of its field texels erased, no
//      quad; no lake is left "to the sea" unless the coast field puts sea under half its texels (the 29 coastal lakes,
//      East Point's lens among them, get their quads); a natural lake keeps its field.
//   3. THE SEA (G750, water.js, render_world.js). The near patch and the far plane cut each other by ONE test on the
//      still plane (the lap gone); the patch's waves fade to the coast; the far plane is a grid (1 km cells near the
//      island - a 400 km two-triangle quad drifted pixels at the cut), wound up; a river's segment within 20 m of the
//      coast is not drawn (Jolene's mouths, counted).
//   4. THE TEXTURE LIBRARIES (G751, pavement.js library, splat_ground.js). A library whose map has already FAILED
//      calls back (it waited forever: every later pavement kept stale arrays); the failed layer takes the set's mean.
//   5. THE COVER RING (G753, render_world.js okAt) refuses the drawn water as well as the physics'.
//
//   node tools/_looks_check.js   -> "GATE LOOKS: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const read = f => fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
const lift = (src, a, b) => { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i + a.length); return i < 0 || j < 0 ? null : src.slice(i, j); };
console.log('GATE LOOKS');
const RP = read('render_premises.js'), RW = read('render_world.js'), WA = read('water.js'), PV = read('pavement.js'), SG = read('splat_ground.js');

// ---- 1. the patch's border ------------------------------------------------------------------------------------
{
  const blk = lift(RP, '  const PATCH_TUCK = ', '  function buildPatch() {');
  ok(!!blk, '1 the border laws found in render_premises.js (PATCH_TUCK .. buildPatch)');
  ok(RP.includes('const r = Math.min(1, patchDepth(x, z) / PATCH_TUCK.tuckW);') && RP.includes('PATCH_TUCK.tuck * (1 - r) * (1 - r)'), '1 the patch\'s vertices tuck by patchDepth and PATCH_TUCK');
  ok(RW.includes('if (premisesR.ringSink) return premisesR.ringSink(x, z);'), '1 the rings\' groundSink is the premises\' ringSink');
  if (blk) {
    const mk = act => new Function('PCH', 'A', 'B', 'let patchAct = A;\n' + blk + '\npatchB = B;\nreturn { patchDepth, ringSink, PATCH_TUCK };')(64, { act: new Set(act), key: (i, j) => i + ',' + j }, { x0: -1e6, z0: -1e6, x1: 1e6, z1: 1e6 });
    // a 3 x 3 block of built chunks, (0..2, 0..2): the edges x = 0 (low) and x = 192 (high)
    const S = mk(['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2']);
    ok(S.patchDepth(0, 96) === 0 && S.patchDepth(192, 96) === 0, '1 a point ON the patch\'s edge is 0 deep, low side and high side', S.patchDepth(0, 96) + ' / ' + S.patchDepth(192, 96));
    ok(Math.abs(S.patchDepth(10, 96) - 10) < 1e-9 && Math.abs(S.patchDepth(54, 96) - 54) < 1e-9 && S.patchDepth(96, 96) >= 64, '1 depth is the distance to the nearest unbuilt chunk (a chunk with no unbuilt neighbour: the extent\'s)', S.patchDepth(10, 96) + ', ' + S.patchDepth(54, 96));
    ok(S.patchDepth(-5, 96) === 0 && S.patchDepth(300, 96) === 0, '1 outside the patch: 0');
    const P = S.PATCH_TUCK;
    ok(S.ringSink(P.ring0, 96) === 0 && S.ringSink(0, 96) === 0 && Math.abs(S.ringSink(P.ring1 + 1, 96) - P.sink) < 1e-12, '1 the ring sinks 0 at the edge and within ring0, the full sink past ring1', 'ring0 ' + P.ring0 + ' ring1 ' + P.ring1 + ' sink ' + P.sink);
    let mono = true; for (let d = 0, last = -1; d <= 40; d += 0.25) { const s = S.ringSink(d, 96); if (s < last - 1e-12) mono = false; last = s; }
    ok(mono, '1 the ring\'s sink never decreases inward');
    // THE VISIBLE DIP: across a border, at every phase of the ring's 17.6 m grid, the drawn ground = max(ring, patch)
    const dip = (sinkAt, tuckAt) => { const SEG = 2 * 4500 / 512; let worst = 0;
      for (let ph = 0; ph < SEG; ph += 0.4) for (let d = -30; d <= 60; d += 0.25) {
        const k = Math.floor((d - ph) / SEG), a = ph + k * SEG, b = a + SEG, t = (d - a) / SEG;
        const ring = -((1 - t) * sinkAt(a) + t * sinkAt(b)), patch = d >= 0 ? -tuckAt(d) : -Infinity;
        worst = Math.max(worst, -Math.max(ring, patch)); }
      return worst; };
    const now = dip(d => S.ringSink(Math.max(0, d), 96) * (d >= 0 ? 1 : 0), d => { const r = Math.min(1, d / P.tuckW); return 0.02 * r + P.tuck * (1 - r) * (1 - r); });
    const old = dip(d => d > 0 ? 4 : 0, d => { const r = Math.min(1, d / 40); return 0.02 * r + 2.2 * (1 - r) * (1 - r); });
    ok(now <= 0.55, '1 the drawn ground dips at most 0.55 m across a border (the old laws: ' + old.toFixed(2) + ' m)', now.toFixed(2) + ' m');
    ok(old > 1.3, '1 the walk sees the old trench (a check of the check)', old.toFixed(2) + ' m');
  }
}

// ---- 2. the drawn lakes --------------------------------------------------------------------------------------
{
  const blkR = lift(RW, '    const lakeR = (() => {', '    let islandTex = null');
  const blkS = lift(RW, '        const lakeTexels = L => {', '        let filled = 0;');
  ok(!!blkR && !!blkS, '2 the lake field and the sea rule found in render_world.js (lakeR, lakeTexels .. isSea)');
  ok(RW.includes("uGPackA: { value: pk4(ISLA.ori1, ISLA.canopy, ISLA.coast, lakeR) }"), '2 the ground (and the water, the same texture) read the drawn lakes\' field');
  ok(RW.includes('if (lakeR && !lakeTexels(L).inside) { filled++; continue; }'), '2 a lake the premises filled draws no quad');
  let IN = null; try { IN = require(path.join(ROOT, 'tools', 'island_node.js')); } catch (e) {}
  const fx = fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8');
  let W = null; try { W = IN && IN.islandWorld('jolene', { premises: fx }); } catch (e) { console.log('  (island: ' + e.message + ')'); }
  ok(!!W, '2 Jolene composed with its premises (island_node)');
  if (W && blkR && blkS) {
    const t0 = Date.now();
    const env = new Function('ISLA', 'world', 'console', blkR + '\n' + blkS + '\nreturn { lakeR, lakeTexels, isSea };')(W.island, W, { log: m => console.log('  (page: ' + m + ')') });
    const ms = Date.now() - t0;
    const G = W.island.grid, lakes = W.island.lakes;
    ok(ms < 1500, '2 the field is made in the scene\'s build time', ms + ' ms');
    const pond = lakes.find(L => Math.hypot((L.x0 + L.x1) / 2 - 241, (L.z0 + L.z1) / 2 - 599) < 15);
    ok(!!pond, '2 the pond beside 02/20 (241, 599) is a lake of the island', pond && ('level ' + pond.level.toFixed(2)));
    if (pond) { const T = env.lakeTexels(pond); ok(T.inside === 0, '2 02/20\'s pond: the runway\'s grade filled it - no field texel left, no quad, no hole', 'texels left ' + T.inside); }
    let seaNoSea = 0, sea = 0, big = null;
    for (const L of lakes) { if (L.level <= 0.2 || L.cells < 3) continue; if (env.isSea(L)) { sea++; const T = env.lakeTexels(L); if (T.sea * 2 < T.inside) seaNoSea++; }
      if (L.x0 < 9900 && L.x1 > 10100 && L.z0 < -9100 && L.z1 > -9000) big = L; }
    ok(seaNoSea === 0, '2 no lake is left to the sea without the sea under it', sea + ' left to the sea');
    ok(!!big && !env.isSea(big) && env.lakeTexels(big).inside > 0, '2 the lens on the way to East Point (10000, -9050) is a lake with its quad', big && ('level ' + big.level.toFixed(2)));
    // a natural lake keeps its field: the big lake west of the field (-444, 539) has most of its texels
    const nat = lakes.find(L => Math.hypot((L.x0 + L.x1) / 2 + 444, (L.z0 + L.z1) / 2 - 539) < 20);
    if (nat) { let n0 = 0; const i0 = Math.floor((nat.x0 - G.x0) / G.cell), i1 = Math.ceil((nat.x1 - G.x0) / G.cell), j0 = Math.floor((nat.z0 - G.z0) / G.cell), j1 = Math.ceil((nat.z1 - G.z0) / G.cell);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (W.island.lake[j * G.w + i] > 128) n0++;
      const n1 = env.lakeTexels(nat).inside; ok(n1 >= 0.9 * n0, '2 a natural lake keeps its field', n1 + ' of ' + n0); }
    let erased = 0; for (let k = 0; k < env.lakeR.length; k++) if (W.island.lake[k] > 128 && env.lakeR[k] <= 128) erased++;
    ok(W.island.lake !== env.lakeR, '2 the physics\' field is untouched (the renderer\'s is a copy)', erased + ' texels erased in the copy');
  }
}

// ---- 3. the sea ------------------------------------------------------------------------------------------------
{
  ok(WA.includes('if (vWBody.y < 0.5 ? wIn : !wIn) discard;') && WA.includes('bool wIn = abs(vWP0.x - uWNear.x) < uWNear.z && abs(vWP0.z - uWNear.y) < uWNear.z;'),
    '3 the near patch and the far plane cut each other by ONE test on the still plane');
  ok(/wh \*= smoothstep\(-6\.0, -40\.0, sd\)/.test(WA) && WA.includes('uniform sampler2D uWSdf; uniform vec4 uWGrid; uniform float uWSdfOn;\' + GLSL_GERSTNER'), '3 the patch\'s waves fade to the coast (the vertex reads the coast field)');
  const blk = lift(RW, '    const farGeo = (() => {', '    const water = new THREE.Mesh(');
  ok(!!blk, '3 the far plane\'s grid found in render_world.js');
  if (blk) {
    const g = new Function('THREE', 'WSZ', blk + '\nreturn farGeo;')(THREE, 400000);
    const p = g.attributes.position.array, ix = g.index.array; let worst = 0, up = true;
    for (let q = 0; q < ix.length; q += 3) { const a = ix[q] * 3, b = ix[q + 1] * 3, c = ix[q + 2] * 3;
      const cx = (p[a] + p[b] + p[c]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      const ny = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]); if (ny <= 0) up = false;
      if (Math.abs(cx) < 35000 && Math.abs(cz) < 35000) worst = Math.max(worst, Math.abs(p[b] - p[a]), Math.abs(p[c] - p[a]), Math.abs(p[b + 2] - p[a + 2]), Math.abs(p[c + 2] - p[a + 2])); }
    const n = p.length / 3, xs = p.filter((v, k) => k % 3 === 0);
    ok(worst <= 1000 + 1e-6, '3 the far plane\'s cells within 35 km of its middle are 1 km at most', worst + ' m');
    ok(Math.min(...xs) === -200000 && Math.max(...xs) === 200000 && n < 20000, '3 it reaches 200 km every way on under 20 k vertices', n + ' vertices');
    ok(up, '3 every triangle faces up');
  }
  ok(RW.includes('if (coastOf && (coastOf(spts[i][0], spts[i][1]) < 20 || coastOf(spts[i + 1][0], spts[i + 1][1]) < 20)) continue;'), '3 a river segment within 20 m of the coast is not drawn');
}

// ---- 4. the texture libraries ------------------------------------------------------------------------------------
// G751 (a failed map never stalls a library), re-aimed at G911: both arrays are filled from the ground library's
// COOKED layers through GROUND_LIB.pack - a set whose file fails takes its mean colour and the library still calls back
{
  const blk = lift(PV, '  function library(THREE, keys, done, prev) {', '  // THE SHARED LIBRARY');
  ok(!!blk, '4 the pavement library found in pavement.js');
  ok(/GROUND_LIB\.pack\(sets\.map\(m => \(\{ layers: m\.layers, mean: m\.mean, label: m\.key \}\)\)/.test(SG) && !/getImageData|drawImage/.test(SG),
    '4 the splat ground\'s arrays come from the cooked layers (GROUND_LIB.pack) - no canvas in splat_ground.js');
  ok(blk && !/getImageData|drawImage/.test(blk), '4 no canvas in the pavement library either');
  const GLsrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'ground_lib.js'), 'utf8');
  if (blk) {
    // a set whose layer file FAILS and one that lands late
    const S = 512 * 512 * 4;
    const ASSET_FETCH = url => url === 'bad' ? Promise.reject(new Error('404'))
      : new Promise(r => setTimeout(() => { const b = new Uint8Array(2 * S); b[0] = 7; b[S] = 9; r(b); }, 20));
    const GROUND_LIB = new Function('ASSET_FETCH', 'GROUND_TEX', GLsrc + '\nreturn GROUND_LIB;')(ASSET_FETCH, undefined);
    const SETS = { bad: { metres: 3, mean: [0.2, 0.1, 0.05], layers: 'bad' }, ok: { metres: 2, mean: [0.1, 0.1, 0.1], layers: 'ok' } };
    const document = {};
    const warn = []; const con = { warn: m => warn.push(m), log() {} };
    const lib = new Function('PAVEMENT_TEX_SETS', 'document', 'console', 'MATS', 'applyOne', 'GROUND_LIB', blk + '\nreturn library;')(SETS, document, con, [], () => {}, GROUND_LIB);
    let fired = false, L = null;
    lib(THREE, ['bad', 'ok'], x => { fired = true; L = x; });
    setTimeout(() => {
      ok(fired && L && L.ready, '4 a library with a failed layer file calls back (it never did: every later pavement kept stale arrays)');
      if (L && L.texA) { const d = L.texA.image.data, n = L.texN.image.data;
        const enc = v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
        ok(d[0] === enc(0.2) && d[1] === enc(0.1) && d[2] === enc(0.05) && d[3] === 128 && n[2] === 255 && n[3] === 230 && d[S] === 7 && n[S] === 9,
          '4 the failed layer is the set\'s mean colour (sRGB) over a flat normal; the landed one its cooked planes', [d[0], d[1], d[2], d[S], n[S]].join(',')); }
      ok(warn.some(m => /bad layers failed/.test(m)), '4 the failure is said on the console');
      // ---- 5. the cover ring ----
      ok(RW.includes('if (h < 0.3 || world.waterH(x, z) > h - 0.3 || drawnWet(x, z, h)) return false;') && RW.includes('drawnLakeSD = lakeRsd;'), '5 the cover ring refuses the drawn water (drawnWet: the drawn lakes\' field and waterDrawY)');
      console.log('GATE LOOKS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
      process.exit(fails ? 1 : 0);
    }, 300);
  } else { console.log('GATE LOOKS: FAIL (' + fails + ')'); process.exit(1); }
}
