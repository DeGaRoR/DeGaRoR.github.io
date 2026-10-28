#!/usr/bin/env node
// GATE PATCHYIELD: execute the shipped sampling/normal loops with a virtual
// work clock. Compare buffers and callback order to the old unsliced span.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '../src/viewer/render_premises.js'), 'utf8').replace(/\r\n/g, '\n');
const at = src.indexOf('    const SK = sinkOf && PL.tolPx > 1'), end = src.indexOf('    // ---- the blocks', at);
assert(at >= 0 && end > at, 'sampling span exists');
const current = src.slice(at, end), old = "    const SK = sinkOf && PL.tolPx > 1 ? new Float32Array(list.length * per) : null;\n    let Y = new Float32Array(list.length * per), Y0 = sinkOf ? new Float32Array(list.length * per) : Y, UV = new Float32Array(list.length * per * 2), KIND = new Uint8Array(list.length);\n    for (let c = 0; c < list.length; c++) {\n      const [ci, cj] = list[c].split(',').map(Number), cx0 = ci * PCH, cz0 = cj * PCH;\n      const kc = KIND[c] = kindOf(cx0, cz0), uvOf = (kc && o.patchUV2) || o.patchUV;\n      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {\n        const v = c * per + j * (n + 1) + i, x = cx0 + i * RES, z = cz0 + j * RES;\n        // the fade: the extent's edge, and the nearest unbuilt neighbour chunk's edge (patchDepth, G752)\n        const r = Math.min(1, patchDepth(x, z) / PATCH_TUCK.tuckW);\n        // AT the ground (G1541), 2 cm under it only where a lot can be (patchDrop; G434.2 had the whole patch 2 cm under:\n        // the lot patches sat at the ground and the 4 cm lift had buried them); the ring sinks 4 m under the patch, so no\n        // fight there (G434: the border tucks under the ring - G752's PATCH_TUCK)\n        Y0[v] = groundB(x, z) - patchDrop(x, z) * r - PATCH_TUCK.tuck * (1 - r) * (1 - r);   // (G1406: the build read)\n        if (sinkOf) { const sk = sinkOf(x, z); Y[v] = Y0[v] - sk; if (sk > 0) sunk++; if (SK) SK[v] = sk; }\n        if (uvOf) { const q = uvOf(x, z); UV[v * 2] = q[0]; UV[v * 2 + 1] = q[1]; }\n      }\n      if (part || (c & 7) === 7) yield 'patch ground';   // (G2063: a chunk a slice in flight)\n    }\n    // the fine normals: each chunk's own grid, as computeVertexNormals made them on the one mesh\n    let NRM = new Float32Array(list.length * per * 3);\n    for (let c = 0; c < list.length; c++) for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {\n      const at = (ii, jj) => Y0[c * per + Math.max(0, Math.min(n, jj)) * (n + 1) + Math.max(0, Math.min(n, ii))];\n      const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n, j + 1);\n      const gx = (at(i1, j) - at(i0, j)) / ((i1 - i0) * RES), gz = (at(i, j1) - at(i, j0)) / ((j1 - j0) * RES);\n      const l = Math.hypot(gx, 1, gz), v = (c * per + j * (n + 1) + i) * 3;\n      NRM[v] = -gx / l; NRM[v + 1] = 1 / l; NRM[v + 2] = -gz / l;\n    }\n";
function run(span, cfg, stop) {
  let clock = 0, samples = 0, normals = 0, sampleTurn = 0, normalTurn = 0;
  const order = [], yields = []; const M = Object.create(Math);
  M.hypot = (...a) => { normals++; normalTurn++; if (cfg.work) clock += 0.25; return Math.hypot(...a); };
  const n = 8, per = (n + 1) * (n + 1);
  const ctx = { Math: M, Date: { now: () => clock }, performance: cfg.date ? undefined : { now: () => clock },
    part: cfg.part ? {} : null, sinkOf: cfg.sink ? (x, z) => ((x + z) % 6 === 0 ? 0.3 : 0) : null,
    PL: { tolPx: cfg.tol }, list: ['0,0', '1,0'], n, per, PCH: 16, RES: 2,
    o: cfg.uv ? { patchUV: (x, z) => [x / 50, z / 50], patchUV2: (x, z) => [x / 75, z / 75] } : {},
    kindOf: x => x >= 16 ? 1 : 0,
    patchDepth: (x, z) => Math.max(0, Math.min(x + 1, 33 - x, z + 1, 17 - z)),
    PATCH_TUCK: { tuckW: 12, tuck: 0.8 }, patchDrop: (x, z) => (x + z) % 4 === 0 ? 0.02 : 0,
    groundB: (x, z) => { samples++; sampleTurn++; order.push([x, z]); if (cfg.work) clock += 1; return 0.1 * x + 0.2 * z + Math.sin(x / 10); } };
  const factory = vm.runInNewContext('(function* () { let sunk = 0; ' + span + '\nreturn { Y, Y0, UV, KIND, NRM, SK, sunk }; })', ctx), g = factory();
  let r;
  while (!(r = g.next()).done) {
    yields.push({ label: r.value, samples: sampleTurn, normals: normalTurn }); sampleTurn = normalTurn = 0;
    if (stop) { const before = samples; g.return(); assert(g.next().done && samples === before, 'cancelled span stops sampling'); return { yields, order }; }
    clock += 1000;   // time between tasks must not consume the resumed task's budget
  }
  return { data: r.value, order, yields, samples, normals };
}
function equalBuffers(a, b) { for (const k of ['Y', 'Y0', 'UV', 'KIND', 'NRM', 'SK']) {
  assert.strictEqual(a[k] === null, b[k] === null, k + ' presence'); if (a[k] !== null) assert(Buffer.from(a[k].buffer, a[k].byteOffset, a[k].byteLength).equals(Buffer.from(b[k].buffer, b[k].byteOffset, b[k].byteLength)), k + ' changed');
} assert.strictEqual(a.sunk, b.sunk); }
let cases = 0;
for (const part of [false, true]) for (const sink of [false, true]) for (const tol of [1, 3]) for (const uv of [false, true]) for (const date of [false, true]) {
  const cfg = { part, sink, tol, uv, date, work: true }, before = run(old, cfg), after = run(current, cfg);
  equalBuffers(after.data, before.data); assert.deepStrictEqual(after.order, before.order, 'query order changed');
  const sy = after.yields.filter(x => x.label === 'patch ground'); assert(sy.length > before.yields.filter(x => x.label === 'patch ground').length, 'expensive sampling yields within chunks');
  assert(sy.every(x => x.samples <= (part ? 2 : 24)), 'sampling work between yields exceeds virtual budget granularity');
  assert(after.yields.some(x => x.label === 'patch normals'), 'normal work cooperates too');
  const cheap = run(current, { ...cfg, work: false }), cheapOld = run(old, { ...cfg, work: false });
  equalBuffers(cheap.data, cheapOld.data); assert.strictEqual(cheap.yields.length, cheapOld.yields.length, 'cheap sampling adds no extra yields');
  cases++;
}
run(current, { part: true, sink: true, tol: 3, uv: true, work: true }, true);
assert(src.indexOf('    const group = new THREE.Group();', end) > end, 'patch mesh construction remains after all sampling/normals');
console.log('  ok   ' + cases + ' full/partial, sink, UV and clock combinations preserve buffers and query order');
console.log('  ok   virtual expensive work yields inside chunks; cheap work keeps original cadence; cancellation stops work');
console.log('GATE PATCHYIELD: PASS');
