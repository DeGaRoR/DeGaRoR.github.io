#!/usr/bin/env node
// _patchworker_check.js - GATE PATCHWORKER (PERF-WORLDBUILD, 22 Nov 2026): THE PATCH SAMPLED FROM THE HOUSE WORKER'S ANSWERS IS
// THE PATCH THE PAGE SAMPLED ITSELF, BYTE FOR BYTE.
//
// With ?patchw=1 render_premises.js asks the house worker, for every 2 m vertex of the premises' patch, the three things it
// asked the core itself (the ground's build read, the pavement at the point with and without the side's reach) and applies
// its own laws to the answers (patchFieldsAsk / PATCHF). Two page processes in node (tools/_page_node.js, the house worker
// on a thread), each booted through the ONE LOADING to the garage with the geometry's arrays kept:
//   inline   the default: the page asks the core
//   worker   ?patchw=1
// CHECKS: the worker child read EVERY chunk of the patch from the worker (none sampled on the page, no miss); for each
// family the world step builds - the patch (every level of every block), the strips, the roads, the paved polygons, the
// guardrails, the poles, the far terrain - the same meshes, vertices, triangles and DIGEST (every attribute's and index's
// bytes). REPORT (never ratcheted): the world step's main-thread seconds by family on both sides, the worker's own ms.
//   node tools/_patchworker_check.js                      the two children, the verdict (~4 min)
//   node tools/_patchworker_check.js --child inline|worker <out.json>
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const now = () => Number(process.hrtime.bigint()) / 1e6;
const FAMILY = { 'patch ground': 'patch', 'patch ground: its fields': 'patch', 'patch block': 'patch', 'ground under the premises': 'patch', materials: 'patch', strips: 'strips', roads: 'roads', paved: 'paved' };
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
  const P = await openPage({ quiet: true, hooks, query: side === 'worker' ? 'patchw=1' : '', workers: /house_worker\.js/, idb: fs.mkdtempSync(path.join(os.tmpdir(), 'pw-idb-')), workerWaitMs: 900000 });
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
  fs.writeFileSync(out, JSON.stringify({ side, build: W.FLYDIY_BUILD, patchw: W.FLYDIY_PATCHW ? Object.assign({}, W.FLYDIY_PATCHW) : null, hw: W.HOUSE_WORKER && W.HOUSE_WORKER.stats ? W.HOUSE_WORKER.stats() : null, warns: (P.logs || []).filter(l => /house worker|patch/i.test(String(l)) && /^warn/.test(String(l))).slice(0, 6), reuse: !!(W.PAVEMENT && W.PAVEMENT.REFINE && W.PAVEMENT.REFINE.reuseHeight), poly: stats, census,
    ms: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Math.round(v)])), mem: { heapPeakMB: MB(MEM.heap), heapPeakStripsMB: MB(MEM.strips), buffersPeakMB: MB(MEM.buffers) } }));
  process.exit(0);
}

(async () => {
  if (argv.includes('--child')) return child(argv[argv.indexOf('--child') + 1], argv[argv.indexOf('--child') + 2]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patchworker-')), R = {}, bad = [];
  for (const side of ['inline', 'worker']) {
    const f = path.join(dir, side + '.json');
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', __filename, '--child', side, f], { stdio: ['ignore', 'inherit', 'pipe'], maxBuffer: 1 << 28 });
    if (r.status || !fs.existsSync(f)) { console.log('  FAIL the ' + side + ' child: exit ' + r.status + ' ' + String(r.stderr).slice(-1200)); console.log('GATE PATCHWORKER: FAIL'); process.exit(1); }
    R[side] = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  const A = R.inline, B = R.worker;
  const PWs = B.patchw || {};
  console.log('GATE PATCHWORKER - build ' + B.build + '; the worker child: ' + JSON.stringify(PWs) + ' | the house worker ' + JSON.stringify({ patchChunks: B.hw && B.hw.patchChunks, patchMs: B.hw && B.hw.patchMs, kept: B.hw && B.hw.kept }));
  if (!(A.patchw && A.patchw.on === false)) bad.push('the inline child ran with the worker\'s fields');
  if (!(PWs.on === true && PWs.why === 'asked')) bad.push('the worker child did not ask the worker (' + PWs.why + ')');
  if (!(PWs.asked > 0 && PWs.used === PWs.asked && PWs.here === 0)) bad.push('not every chunk was read from the worker (' + PWs.used + ' of ' + PWs.asked + ', ' + PWs.here + ' sampled on the page)');
  if (!(B.hw && B.hw.kept === 0)) bad.push('the worker copied arrays instead of transferring them');
  if (B.warns && B.warns.length) bad.push('the page warned: ' + B.warns.join(' | '));
  console.log('  family           meshes    vertices   triangles   digest inline      digest worker');
  for (const k of [...new Set([...Object.keys(A.census), ...Object.keys(B.census)])].sort()) {
    const a = A.census[k] || {}, b = B.census[k] || {}, same = a.digest === b.digest && a.meshes === b.meshes && a.verts === b.verts && a.tris === b.tris;
    console.log('  ' + k.padEnd(16) + String(b.meshes).padStart(7) + String(b.verts).padStart(12) + String(b.tris).padStart(12) + '   ' + a.digest + '   ' + b.digest + (same ? '' : '   DIFFER'));
    if (!same) bad.push(k + ': the two builds differ (' + a.meshes + ' / ' + b.meshes + ' meshes, ' + a.verts + ' / ' + b.verts + ' vertices, ' + a.digest + ' / ' + b.digest + ')');
  }
  for (const k of ['premises:patch', 'pavement', 'road', 'pave']) if (!B.census[k] || !(B.census[k].verts > 0)) bad.push('no ' + k + ' geometry was built: the gate compared nothing');
  console.log('  the world step by family, the page\'s thread, node ms (inline -> worker): ' + ['patch', 'strips', 'roads', 'paved', 'other'].map(k => k + ' ' + (A.ms[k] || 0) + ' -> ' + (B.ms[k] || 0)).join(', '));
  for (const b of bad) console.log('  FAIL ' + b);
  console.log('GATE PATCHWORKER: ' + (bad.length ? 'FAIL' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE PATCHWORKER: FAIL'); process.exit(1); });
