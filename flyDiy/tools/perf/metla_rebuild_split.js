#!/usr/bin/env node
// metla_rebuild_split.js - TOWN-GEO (G2063): WHAT THE TOWN ADDS TO THE GARAGE LOAD, PART BY PART, in node. The page
// (tools/_page_node.js, GATE FRAMECOST's hooks) booted to the garage with ?town=0 and with ?town=1, each in its own child:
// the boot steps' wall time (FRAMECOST's bootMark rows), the premises rebuild's own slices (render_premises rebuildSteps,
// timed between its yields and keyed by the label it yielded), the compositions (PREMISES_GEN.compose) and what the
// garage built (the patch's chunks and blocks, the roads, the paved polygons, the cars). Node milliseconds, not the
// box's: compare the two sides, not the absolute.
//   node tools/perf/metla_rebuild_split.js [--out <dir>]          (both sides; a census: boxlock.sh take cpu first)
//   node tools/perf/metla_rebuild_split.js --child off|on <file>  (one side)
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const ms = t0 => Number(process.hrtime.bigint() - t0) / 1e6;

async function child(side, out) {
  const FC = require('../_framecost_check.js'), { openPage } = require('../_page_node.js');
  const C = FC.bootMark.C = { who: null, obr: 0, oar: 0, obs: 0, mobr: 0, umw: 0, um: 0, frustum: 0, terrainH: 0, grHeight: 0, renders: 0, pick: null };
  const base = FC.pageHooks(C, () => null);
  const SL = {}, COMP = [];
  let R = null;
  const add = (k, v) => { SL[k] = (SL[k] || 0) + v; };
  const hooks = {
    beforeScript(n, P) { base.beforeScript(n, P); },
    afterScript(n, P) {
      base.afterScript(n, P); const W = P.win;
      // METLA_KEEPGEO=1: the geometry's arrays kept after upload (GPU_ONLY_GEO a no-op), so a digest can read every mesh's bytes
      if (process.env.METLA_KEEPGEO && typeof W.GPU_ONLY_GEO === 'function' && !W.GPU_ONLY_GEO.__keep) { W.GPU_ONLY_GEO = function () {}; W.GPU_ONLY_GEO.__keep = true; }
      if (W.PREMISES_GEN && !W.PREMISES_GEN.__rs) { const PG = W.PREMISES_GEN, c0 = PG.compose; PG.__rs = true;
        PG.compose = function () { const t0 = process.hrtime.bigint(); try { return c0.apply(this, arguments); } finally { COMP.push({ at: FC.bootMark.cur || '?', ms: +ms(t0).toFixed(1) }); } }; }
      if (W.RENDER_PREMISES && !W.RENDER_PREMISES.__rs) { const RP = W.RENDER_PREMISES, mk = RP.make; RP.__rs = true;
        RP.make = function () {
          const t0 = process.hrtime.bigint(), r = mk.apply(this, arguments); add('make', ms(t0)); R = r;
          if (r && r.rebuildSteps) { const rs = r.rebuildSteps;
            r.rebuildSteps = function* () { const g = rs.apply(this, arguments); let label = 'compose';
              for (;;) { const t = process.hrtime.bigint(); const s = g.next(); add('rebuild:' + label, ms(t)); if (s.done) return s.value; label = String(s.value).replace(/[0-9]+/g, '#'); yield s.value; } }; }
          return r; }; }
    },
  };
  const P = await openPage({ quiet: true, hooks, query: (side === 'on' ? 'town=1' : 'town=0') + (process.env.METLA_QUERY ? '&' + process.env.METLA_QUERY : '') });   // METLA_QUERY: more (towngeo=0)
  const W = P.win, t0 = Date.now();
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 1800000);
  FC.bootMark.close();
  const steps = {}; for (const [k, v] of Object.entries(FC.bootMark.rows)) steps[k] = v.wallMs;
  const st = R && R.stats ? R.stats : {};
  const count = { chunks: st.chunks, patchBlocks: st.patchBlocks, tris: st.tris, roads: W.WORLD && W.WORLD.premises ? (() => { let n = 0; try { W.WORLD.scene.traverse(o => { if (o.isMesh && /^(road|pave|rail|poles):/.test(o.name || '')) n++; }); } catch (e) {} return n; })() : null,
    roadMerged: st.roadMerged, paveMerged: st.paveMerged, roadParts: st.roadParts, paveParts: st.paveParts, traffic: st.traffic, trams: st.trams, animals: st.animals, trees: st.trees, houses: st.houses, queued: st.queued };
  // THE GEOMETRY'S DIGEST: every patch, road, apron, rail and pole mesh in the scene - its name and the bytes of every
  // attribute and the index - hashed, the list sorted (a later build may add them in another order): two trees, or two
  // build paths, made the same ground and roads exactly when the digests are equal
  const crypto = require('crypto');
  const digestNow = () => { const parts = [], inv = {};
  W.WORLD.scene.traverse(o => { const far = !!(o.userData && o.userData.farTerrain); if (!(o.isMesh || o.isLine) || !(far || /^(premises:patch|road|pave|rail|poles|strip|runway)/.test(o.name || '')) || !o.geometry) return;   // (G2063: the far tier too, 'far')
    const H = crypto.createHash('sha256'), g = o.geometry; H.update(o.name + '|' + o.renderOrder + '|' + (o.material && o.material.type));
    o.updateMatrixWorld(true); H.update(Buffer.from(new Float64Array(o.matrixWorld.elements).buffer));
    for (const k of Object.keys(g.attributes).sort()) { const a = g.attributes[k].array; H.update(k); H.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
    if (g.index) { const a = g.index.array; H.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
    parts.push((far ? 'far' : o.name.split(':')[0]) + ':' + H.digest('hex').slice(0, 16));
    // an invariant of the class that merging cannot move: vertices, triangles and the world positions' sums (a mesh
    // merged with others keeps its vertices, wherever they are batched)
    const cls = far ? 'far' : o.name.split(':')[0], I = inv[cls] || (inv[cls] = { v: 0, t: 0, x: 0, y: 0, z: 0 }), pa = g.attributes.position, e = o.matrixWorld.elements;
    if (pa) { I.v += pa.count; I.t += g.index ? g.index.count / 3 : pa.count / 3; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); I.x += e[0] * x + e[4] * y + e[8] * z + e[12]; I.y += e[1] * x + e[5] * y + e[9] * z + e[13]; I.z += e[2] * x + e[6] * y + e[10] * z + e[14]; } }
    for (const an of Object.keys(g.attributes)) { if (an === 'position') continue; const a = g.attributes[an].array; let t = 0; for (let i = 0; i < a.length; i++) t += a[i]; I['a.' + an] = (I['a.' + an] || 0) + t; } });
    for (const k of Object.keys(inv)) for (const q of Object.keys(inv[k])) if (q !== 'v' && q !== 't') inv[k][q] = +(+inv[k][q]).toFixed(1);
  parts.sort();
  const by = {}; for (const q of parts) { const k = q.split(':')[0]; by[k] = (by[k] || 0) + 1; }
  return { inv, n: parts.length, by, all: crypto.createHash('sha256').update(parts.join(',')).digest('hex').slice(0, 16), parts }; };
  const digest = digestNow();
  // G2063: THE TOWN'S GEOMETRY LATER, run to its end (WORLD.townGeoFinish) - its time, the geometry after it (a tree that
  // defers must end on the digest a tree that builds the town at boot starts with), and the programs a compile of the
  // scene asks for that it did not before (a town block or road on a material no program was linked for)
  let later = null, geoSteps = null;
  // METLA_GEOSTEPS=1: the town's deferred build stepped by hand, each step timed under the label it yielded (the longest
  // step is the in-flight frame's cost: render_world slices it at 3 ms a frame, and a step cannot be cut)
  if (process.env.METLA_GEOSTEPS && R && R.geoPending && R.geoPending() && R.geoLaterSteps) {
    const g = R.geoLaterSteps(), by = {}; let label = 'start', bb = null;
    for (;;) { const t = process.hrtime.bigint(), r = g.next(), d = ms(t); const k = label.replace(/[0-9]+/g, '#'), e = by[k] || (by[k] = { n: 0, ms: 0, max: 0 }); e.n++; e.ms += d; e.max = Math.max(e.max, d); if (r.done) { bb = r.value; break; } label = String(r.value); }
    let refreshMs = null; if (bb && W.WORLD.refreshGround) { const t = process.hrtime.bigint(); W.WORLD.refreshGround(bb); refreshMs = +ms(t).toFixed(0); }
    geoSteps = { by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.n, ms: Math.round(v.ms), max: Math.round(v.max) }])), refreshMs, bb, digest: digestNow() };
    console.log('GEOSTEPS ' + JSON.stringify(geoSteps));
  }
  if (W.WORLD.townGeoFinish && R && R.geoPending && R.geoPending()) {
    const Rr = W.FLYDIY_RENDERER, cam = W.FLIGHT_PROBE && (typeof W.FLIGHT_PROBE.camera === 'function' ? W.FLIGHT_PROBE.camera() : W.FLIGHT_PROBE.camera);
    const progs = () => (Rr && Rr.info && Rr.info.programs ? Rr.info.programs.length : 0);
    try { if (Rr && cam) Rr.compile(W.WORLD.scene, cam); } catch (e) {}
    const p0 = progs(), t1 = process.hrtime.bigint(); W.WORLD.townGeoFinish(); const msF = ms(t1);
    try { if (Rr && cam) Rr.compile(W.WORLD.scene, cam); } catch (e) {}
    later = { ms: +msF.toFixed(0), programsNew: progs() - p0, pending: R.geoPending(), stats: R.stats.townGeo || null, digest: digestNow(), box: null };
  }
  fs.writeFileSync(out, JSON.stringify({ side, wall: Date.now() - t0, steps, slices: SL, compose: COMP, count, digest, later, geoSteps, errors: P.errors.slice(0, 8), warns: (P.logs || []).filter(l => /premises|town/i.test(l)).slice(0, 8) }));
  process.exit(0);
}

(async () => {
  if (argv.includes('--child')) return child(opt('child'), argv[argv.indexOf('--child') + 2]);
  const dir = path.resolve(opt('out', path.join(__dirname, 'metla_split'))); fs.mkdirSync(dir, { recursive: true });
  const { spawnSync } = require('child_process');
  for (const side of String(opt('sides', 'off,on')).split(',')) {
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', __filename, '--child', side, path.join(dir, 'split_' + side + '.json')], { stdio: ['ignore', 'inherit', 'pipe'], maxBuffer: 1 << 28 });
    if (r.status) { console.log(side + ' exit ' + r.status + ': ' + String(r.stderr).slice(-1500)); process.exit(1); }
  }
  const L = s => JSON.parse(fs.readFileSync(path.join(dir, 'split_' + s + '.json'), 'utf8')), A = L('off'), B = L('on');
  const tab = (a, b, title) => { console.log('\n' + title + ' (node ms: off -> on, on - off)');
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => Math.max(a[k] || 0, b[k] || 0) > 20).sort((x, y) => ((b[y] || 0) - (a[y] || 0)) - ((b[x] || 0) - (a[x] || 0))))
      console.log('  ' + k.padEnd(30) + String(Math.round(a[k] || 0)).padStart(8) + ' -> ' + String(Math.round(b[k] || 0)).padStart(8) + '   ' + ((b[k] || 0) - (a[k] || 0) >= 0 ? '+' : '') + Math.round((b[k] || 0) - (a[k] || 0))); };
  console.log('boot wall ' + A.wall + ' -> ' + B.wall + ' ms');
  tab(A.steps, B.steps, 'BOOT STEPS');
  tab(A.slices, B.slices, 'THE PREMISES REBUILD BY SLICE');
  console.log('\ncompositions: off ' + JSON.stringify(A.compose) + '\n              on  ' + JSON.stringify(B.compose));
  console.log('counts: off ' + JSON.stringify(A.count) + '\n        on  ' + JSON.stringify(B.count));
  for (const X of [A, B]) if (X.later) console.log('town geometry later (' + X.side + '): ' + X.later.ms + ' ms, programs new ' + X.later.programsNew + ', pending ' + X.later.pending + ', ' + JSON.stringify(X.later.stats) + ', digest after ' + X.later.digest.all + ' ' + JSON.stringify(X.later.digest.by));
  console.log('geometry digest: off ' + A.digest.all + ' ' + JSON.stringify(A.digest.by) + '\n                 on  ' + B.digest.all + ' ' + JSON.stringify(B.digest.by));
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
