#!/usr/bin/env node
// _pavexact_check.js - GATE PAVEXACT (PERF-WORLDBUILD, 22 Nov 2026): THE TWO EXACT PAVEMENT SHORT-CUTS BUILD THE SAME ISLAND,
// BYTE FOR BYTE.
//
// Codex's two short-cuts of 20-21 Nov are the DEFAULT since this gate:
//   pavepolybound  27_premises.js dEdgeOf: a paved polygon whose box lies beyond the caller's finite reach is not measured
//                  (its distance could not be the answer); ?pavepolybound=0 measures every one, as before;
//   pavereuse      pavement.js stripGeometry / roadGeometry / polyGeometry: the heights the refinement read are the heights
//                  the vertices are written with (one memo, kept through the emission); ?pavereuse=0 reads them again.
// Both are exact by construction; this gate is the proof on the whole island. Two page processes in node
// (tools/_page_node.js, the house worker on a thread, as the page runs it), each booted through the ONE LOADING to the
// garage with the geometry's arrays kept:
//   old   ?pavepolybound=0&pavereuse=0
//   new   the defaults
// CHECK: for each family the world step builds from the premises record - the patch (every level of every block), the
// strips (merged), the roads, the paved polygons, the guardrails, the poles, the far terrain - the same number of meshes,
// vertices and triangles and the same DIGEST (every mesh's name and every attribute's and index's bytes, the meshes
// sorted). REPORT (never ratcheted: node milliseconds on a shared box): the world step's seconds by family and its heap
// peak on both sides (pavereuse keeps the refinement's memo alive through the emission).
//   node tools/_pavexact_check.js                      the two children, the verdict (~4 min)
//   node tools/_pavexact_check.js --child old|new <out.json>
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const now = () => Number(process.hrtime.bigint()) / 1e6;
const FAMILY = { 'patch ground': 'patch', 'patch block': 'patch', 'ground under the premises': 'patch', materials: 'patch', strips: 'strips', roads: 'roads', paved: 'paved' };
const famOf = label => FAMILY[label] || (/^strip /.test(label) ? 'strips' : /^pavement:/.test(label) ? 'roads' : 'other');

async function child(side, out) {
  const { openPage } = require('./_page_node.js');
  const T = {}, MEM = { heap: 0, buffers: 0, strips: 0 };
  const sample = strips => { const m = process.memoryUsage(); if (m.heapUsed > MEM.heap) MEM.heap = m.heapUsed; if (m.arrayBuffers > MEM.buffers) MEM.buffers = m.arrayBuffers; if (strips && m.heapUsed > MEM.strips) MEM.strips = m.heapUsed; };
  const hooks = { afterScript(n, P) { const W = P.win;
    if (typeof W.GPU_ONLY_GEO === 'function' && !W.GPU_ONLY_GEO.__keep) { W.GPU_ONLY_GEO = function () {}; W.GPU_ONLY_GEO.__keep = true; }   // the arrays kept for the digest
    const orig = W.buildWorldSceneSteps; if (typeof orig !== 'function' || orig.__px) return;
    const wrapped = function () { const g = orig.apply(this, arguments); let label = 'setup', k = 0;
      return { next(v) { const t = now(), r = g.next(v), f = famOf(String(label)); T[f] = (T[f] || 0) + now() - t;
          if (!(k++ & 7) || f === 'strips') sample(f === 'strips');
          if (!r.done && r.value !== undefined) label = r.value; return r; },
        return(v) { return g.return ? g.return(v) : { done: true, value: v }; }, throw(e) { return g.throw(e); }, [Symbol.iterator]() { return this; } }; };
    wrapped.__px = true; W.buildWorldSceneSteps = wrapped; } };
  const P = await openPage({ quiet: true, hooks, query: side === 'old' ? 'pavepolybound=0&pavereuse=0' : '', workers: /house_worker\.js/, idb: fs.mkdtempSync(path.join(os.tmpdir(), 'px-idb-')), workerWaitMs: 900000 });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 3600000);
  const census = {}, seen = new Set();
  const fam = o => { const n = o.name || ''; if (o.userData && o.userData.farTerrain) return 'far terrain'; const m = /^(premises:patch|pavement|road|pave|rail|poles)/.exec(n); return m ? m[1] : null; };
  W.WORLD.scene.traverse(o => { if (!(o.isMesh || o.isLine || o.isPoints) || !o.geometry || seen.has(o.geometry)) return; const f = fam(o); if (!f) return; seen.add(o.geometry);
    const g = o.geometry, e = census[f] || (census[f] = { meshes: 0, verts: 0, tris: 0, bytes: 0, parts: [] }); e.meshes++;
    const h = crypto.createHash('sha256'); h.update(o.name || '');
    for (const k of Object.keys(g.attributes).sort()) { const a = g.attributes[k].array; if (!a || !a.buffer) { h.update(k + ':freed'); continue; } e.bytes += a.byteLength; h.update(k); h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
    const pa = g.attributes.position; if (pa) { e.verts += pa.count; e.tris += g.index ? g.index.count / 3 : pa.count / 3; }
    if (g.index && g.index.array) { const a = g.index.array; e.bytes += a.byteLength; h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
    e.parts.push(h.digest('hex').slice(0, 16)); });
  for (const k of Object.keys(census)) { const e = census[k]; e.digest = crypto.createHash('sha256').update(e.parts.sort().join(',')).digest('hex').slice(0, 16); delete e.parts; e.tris = Math.round(e.tris); }
  let stats = null; try { const w = W.FLIGHT_PROBE.world(), O = w.premises && w.premises.overlay; stats = O && O.pavePolyStats ? O.pavePolyStats() : null; } catch (e) { stats = null; }
  const MB = v => Math.round(v / 1048576);
  fs.writeFileSync(out, JSON.stringify({ side, build: W.FLYDIY_BUILD, reuse: !!(W.PAVEMENT && W.PAVEMENT.REFINE && W.PAVEMENT.REFINE.reuseHeight), poly: stats, census,
    ms: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Math.round(v)])), mem: { heapPeakMB: MB(MEM.heap), heapPeakStripsMB: MB(MEM.strips), buffersPeakMB: MB(MEM.buffers) } }));
  process.exit(0);
}

(async () => {
  if (argv.includes('--child')) return child(argv[argv.indexOf('--child') + 1], argv[argv.indexOf('--child') + 2]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pavexact-')), R = {}, bad = [];
  for (const side of ['old', 'new']) {
    const f = path.join(dir, side + '.json');
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', __filename, '--child', side, f], { stdio: ['ignore', 'inherit', 'pipe'], maxBuffer: 1 << 28 });
    if (r.status || !fs.existsSync(f)) { console.log('  FAIL the ' + side + ' child: exit ' + r.status + ' ' + String(r.stderr).slice(-1200)); console.log('GATE PAVEXACT: FAIL'); process.exit(1); }
    R[side] = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  const A = R.old, B = R.new;
  console.log('GATE PAVEXACT - build ' + B.build + '; old: polygon bound ' + (A.poly && A.poly.enabled) + ', height reuse ' + A.reuse + ' | new: ' + (B.poly && B.poly.enabled) + ', ' + B.reuse);
  if (!(A.poly && A.poly.enabled === false && A.reuse === false)) bad.push('the old side did not run the old paths (?pavepolybound=0&pavereuse=0)');
  if (!(B.poly && B.poly.enabled === true && B.reuse === true)) bad.push('the new side did not run the short-cuts by default');
  console.log('  family           meshes    vertices   triangles   digest old         digest new');
  for (const k of [...new Set([...Object.keys(A.census), ...Object.keys(B.census)])].sort()) {
    const a = A.census[k] || {}, b = B.census[k] || {}, same = a.digest === b.digest && a.meshes === b.meshes && a.verts === b.verts && a.tris === b.tris;
    console.log('  ' + k.padEnd(16) + String(b.meshes).padStart(7) + String(b.verts).padStart(12) + String(b.tris).padStart(12) + '   ' + a.digest + '   ' + b.digest + (same ? '' : '   DIFFER'));
    if (!same) bad.push(k + ': the two builds differ (' + a.meshes + ' / ' + b.meshes + ' meshes, ' + a.verts + ' / ' + b.verts + ' vertices, ' + a.digest + ' / ' + b.digest + ')');
  }
  for (const k of ['premises:patch', 'pavement', 'road', 'pave']) if (!B.census[k] || !(B.census[k].verts > 0)) bad.push('no ' + k + ' geometry was built: the gate compared nothing');
  console.log('  the world step by family, node ms (old -> new): ' + ['strips', 'patch', 'roads', 'paved', 'other'].map(k => k + ' ' + (A.ms[k] || 0) + ' -> ' + (B.ms[k] || 0)).join(', '));
  console.log('  the polygon queries (old / new): ' + JSON.stringify(A.poly) + ' / ' + JSON.stringify(B.poly));
  console.log('  heap peak in the world step, MB (old -> new): JS heap ' + A.mem.heapPeakMB + ' -> ' + B.mem.heapPeakMB + ', during the strips ' + A.mem.heapPeakStripsMB + ' -> ' + B.mem.heapPeakStripsMB + ', typed arrays ' + A.mem.buffersPeakMB + ' -> ' + B.mem.buffersPeakMB);
  for (const b of bad) console.log('  FAIL ' + b);
  console.log('GATE PAVEXACT: ' + (bad.length ? 'FAIL' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE PAVEXACT: FAIL'); process.exit(1); });
