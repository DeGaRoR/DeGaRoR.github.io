#!/usr/bin/env node
// GATE PATCHFAR - THE FAR CORRIDOR, MERGED (G3088 HOME-FRAME).
//   node tools/_patchfar_check.js
// A0's census at HOME (13 Oct, tools/perf/home_census_1013.json): the fine patch's 512 m blocks along the user's roads,
// past 3 km, were 164 draws (render -0.6, loop -0.7 ms) - each a THREE.LOD at its coarsest level. render_premises merges a
// 2 km super-cell's coarsest levels into one mesh, shown (its blocks hidden) only while every block is past its coarsest
// level's distance. This gate LIFTS the page's own helpers (between the 'PATCH FAR (G3088) BEGIN / END' markers of
// src/viewer/render_premises.js - the code under test is the page's, never a copy) and holds:
//   1  THE MERGE IS THE BLOCKS: every merged vertex is its block's vertex moved by the block's place less the origin (the
//      float32 of the same sum), every triangle the block's triangle, the normals and the uvs copied, a block without the
//      pavement's sink attribute zeros there, a merge past 65 535 vertices indexed 32-bit
//   2  THE SWITCH IS THREE'S RULE: the merge shows only when every block's LOD (three's LOD.update: the last level iff the
//      distance reaches it, levels sorted, hysteresis 0) would draw its coarsest level - on 3 % past it, off at it; no
//      eye, nothing merged
//   3  THE PAGE: the coarsest level kept per block before its upload, a super-cell merged again with its blocks (a part
//      rebuild, a removed block), the switch in the tick, ?patchfar=0 the blocks alone, the merge in the block's material
// Exits non-zero on any red; prints GATE PATCHFAR: PASS / FAIL.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
const fail = []; let checks = 0;
const check = (ok, what, detail) => { checks++; if (!ok) fail.push(what + (detail ? ' - ' + detail : '')); return ok; };

const a = SRC.indexOf('// ---- PATCH FAR (G3088) BEGIN'), b = SRC.indexOf('// ---- PATCH FAR (G3088) END');
if (!check(a >= 0 && b > a, '0 the page has the PATCH FAR helpers between their markers')) { for (const f of fail) console.log('  ! ' + f); console.log('GATE PATCHFAR: FAIL'); process.exit(1); }
const ctx = { Math, Float32Array, Uint16Array, Uint32Array, isFinite };
vm.createContext(ctx);
vm.runInContext(SRC.slice(a, b) + '\n;this.H = { farMergeArrays, farWant, FAR_SC, FAR_HYST };', ctx);
const H = ctx.H;

// 1 THE MERGE: blocks as the patch makes their coarsest level - a grid of chunks at 16 m with skirts, its own place
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function block(nCh, lp, withPav) {
  const m = 4, vPer = (m + 1) * (m + 1) + 4 * (m + 1), nV = nCh * vPer;
  const pos = new Float32Array(nV * 3), nrm = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), pav = withPav ? new Float32Array(nV) : null, idx = [];
  for (let v = 0; v < nV; v++) { pos[v * 3] = (rnd() - 0.5) * 512; pos[v * 3 + 1] = (rnd() - 0.5) * 40; pos[v * 3 + 2] = (rnd() - 0.5) * 512; nrm[v * 3 + 1] = 1; nrm[v * 3] = rnd() * 0.1; uv[v * 2] = rnd(); uv[v * 2 + 1] = rnd(); if (pav) pav[v] = rnd(); }
  for (let t = 0; t < nV * 2; t++) idx.push(Math.floor(rnd() * nV), Math.floor(rnd() * nV), Math.floor(rnd() * nV));
  return { pos, nrm, uv, pav, idx, lp };
}
{
  const origin = [3072, 41.5, -1024];
  const B = [block(3, [2304, 38, -1280], true), block(5, [2816, 45.25, -1280], false), block(2, [2304, 40, -768], true)];
  const M = H.farMergeArrays(B, origin);
  let nV = 0, nI = 0; for (const q of B) { nV += q.pos.length / 3; nI += q.idx.length; }
  check(M.nV === nV && M.nI === nI && M.pos.length === nV * 3 && M.idx.length === nI, '1 the merge holds every vertex and index of its blocks (' + nV + ' / ' + nI + ')');
  let badV = 0, badA = 0, badT = 0, v0 = 0, i0 = 0, badPav = 0;
  const f32 = Math.fround;
  for (const q of B) {
    const n = q.pos.length / 3;
    for (let k = 0; k < n; k++) {
      for (let c = 0; c < 3; c++) if (M.pos[(v0 + k) * 3 + c] !== f32(q.pos[k * 3 + c] + (q.lp[c] - origin[c]))) badV++;
      for (let c = 0; c < 3; c++) if (M.nrm[(v0 + k) * 3 + c] !== q.nrm[k * 3 + c]) badA++;
      for (let c = 0; c < 2; c++) if (M.uv[(v0 + k) * 2 + c] !== q.uv[k * 2 + c]) badA++;
      if (M.pav[v0 + k] !== (q.pav ? q.pav[k] : 0)) badPav++;
    }
    for (let k = 0; k < q.idx.length; k++) if (M.idx[i0 + k] !== q.idx[k] + v0) badT++;
    v0 += n; i0 += q.idx.length;
  }
  check(badV === 0, '1 every merged vertex is its block\'s, moved by the block\'s place less the origin', badV + ' wrong');
  check(badA === 0 && badT === 0, '1 the normals, the uvs and every triangle carried as they were', badA + ' / ' + badT + ' wrong');
  check(badPav === 0, '1 the pavement\'s sink attribute: the blocks\' own, zeros for a block without it', badPav + ' wrong');
  check(M.idx instanceof Uint16Array, '1 a small merge indexed 16-bit');
  const big = H.farMergeArrays(Array.from({ length: 40 }, (_, k) => block(40, [512 * (k % 4), 0, 512 * Math.floor(k / 4)], false)), [1024, 0, 1024]);   // 40 x 1 800 vertices
  check(big.nV > 65535 && big.idx instanceof Uint32Array, '1 a merge past 65 535 vertices indexed 32-bit (' + big.nV + ')');
  const none = H.farMergeArrays([block(1, [0, 0, 0], false), block(1, [512, 0, 0], false)], [256, 0, 0]);
  check(none.pav === null, '1 no block with the sink attribute: none on the merge');
}

// 2 THE SWITCH vs three's LOD.update (vendor/three.min.js r186: distance = |camera - LOD| / zoom; level i shown while
//   distance >= its distance, the levels sorted, hysteresis 0) - the merge stands in only where every block draws its last level
{
  const lastLevel = (eye, q, levels) => { const d = Math.hypot(eye.x - q[0], eye.y - q[1], eye.z - q[2]); let i = 0; for (let k = 1; k < levels.length; k++) { if (d >= levels[k]) i = k; else break; } return i === levels.length - 1; };
  const blocks = []; for (let k = 0; k < 12; k++) { const d1 = 300 + rnd() * 300, d2 = d1 + rnd() * 600, d3 = d2 + rnd() * 1500; blocks.push({ q: [rnd() * 2048, 30 + rnd() * 20, rnd() * 2048, d3], levels: [0, d1, d2, d3] }); }
  const need = blocks.map(x => x.q);
  let wrongOn = 0, ons = 0, offs = 0;
  for (let t = 0; t < 4000; t++) {
    const eye = { x: -6000 + rnd() * 14000, y: 20 + rnd() * 900, z: -6000 + rnd() * 14000 };
    for (const shown of [false, true]) {
      const w = H.farWant(eye, need, shown);
      if (w) { ons++; if (!blocks.every(x => lastLevel(eye, x.q, x.levels))) wrongOn++; } else offs++;
    }
  }
  check(wrongOn === 0 && ons > 200 && offs > 200, '2 the merge shows only where three\'s LOD draws every block at its coarsest level (' + ons + ' on, ' + offs + ' off, ' + wrongOn + ' wrong)');
  const q = [0, 0, 0, 1000], at = d => ({ x: d, y: 0, z: 0 });
  check(!H.farWant(at(1010), [q], false) && H.farWant(at(1031), [q], false), '2 off -> on 3 % past the coarsest level\'s distance (no flicker on the line)');
  check(H.farWant(at(1000), [q], true) && !H.farWant(at(999.9), [q], true), '2 on -> off at it (never a block drawn coarser than three would)');
  check(!H.farWant(null, [q], false) && !H.farWant(at(5000), [], false), '2 no eye, no block: nothing merged');
  check(H.FAR_SC === 2048 && H.FAR_HYST === 0.03, '2 the super-cell 2 km (4 x 4 blocks), the switch-on margin 3 %');
}

// 3 THE PAGE
{
  check(/if \(FAR\.on && L === PL\.res\.length - 1\) FAR\.src\.set\(bk, \{/.test(SRC) && /pos: pos\.subarray\(0, v \* 3\)/.test(SRC), '3 each block\'s coarsest level kept as it is built (before its upload releases the arrays)');
  check(/farRebuild\(part \? part\.blocks : null\);/.test(SRC) && /FAR\.src\.delete\(bk\); const old = patch\.children\.find/.test(SRC) && /if \(!part\) \{ FAR\.src\.clear\(\); FAR\.cells\.clear\(\); FAR\.group = null; \}/.test(SRC), '3 a super-cell merged again with its blocks: a part rebuild\'s, a removed block\'s; a whole patch starts over');
  check(/freezeTick % 10 === 5 && FAR\.cells\.size && o\.eye\) farTick\(o\.eye\(\)\)/.test(SRC) && /c\.mesh\.visible = w; for \(const l of c\.lods\) l\.visible = !w;/.test(SRC), '3 the tick switches each super-cell (its merge or its blocks, never both)');
  check(/\[\?&\]patchfar=0\(&\|\$\)/.test(SRC) && /new THREE\.Mesh\(g, mem\[0\]\[1\]\.mat\)/.test(SRC) && /mesh\.receiveShadow = true; mesh\.name = 'premises:patchfar'; mesh\.renderOrder = -0\.3;/.test(SRC), '3 ?patchfar=0 the blocks alone; the merge in the blocks\' material, the patch\'s order and shadows');
  check(/if \(mem\.length < 2\) continue;/.test(SRC) && /blocks: patch\.children\.filter\(c => c\.isLOD\)\.length/.test(SRC), '3 a super-cell of one block is left alone; the patch\'s block count counts blocks');
}

if (fail.length) { for (const f of fail) console.log('  ! ' + f); console.log('GATE PATCHFAR: FAIL (' + fail.length + ')'); process.exit(1); }
console.log('  ' + checks + ' checks');
console.log('GATE PATCHFAR: PASS');
