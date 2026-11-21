#!/usr/bin/env node
// world_build_node.js - PERF-WORLDBUILD (22 Nov 2026): WHERE THE WORLD BUILD GOES, STEP BY STEP, IN NODE.
// The page in node (tools/_page_node.js, GATE FRAMECOST's hooks) booted to the garage, the boot's steps timed on the
// machine's own clock (the page's clock is virtual), and inside the 'world' step every slice of render_world's
// buildWorldSceneSteps (the premises' rebuildSteps and the ground's own generators are yield*'d through it, so their
// labels are seen here too) timed between two yields and filed under the label that OPENED it (a `yield 'terrain'`
// stands before the terrain's work). One V8 CPU profile over the boot gives each boot step and each world label its
// own top self-time functions (the samples falling in its windows).
//
// WHAT IT ANSWERS: each step's ms; its LONGEST uninterruptible slice (a slice the generator cannot cut is a main-thread
// task of that length, whatever the caller's budget: the >50 ms list is the boot's long tasks, on node); the functions
// under it. Node milliseconds, not the box's: compare ratios and before/after on the same machine, never the absolute.
// The page takes its no-Worker paths unless --workers (the house worker on a worker_threads thread, a cold fake
// IndexedDB): then what the browser runs off the main thread is off it here too.
//
//   nice -n 19 node --max-old-space-size=6144 tools/perf/world_build_node.js --out <dir> [--query 'town=1'] [--workers]
//                   [--no-prof] [--census] [--drain] [--label before]
// Writes <dir>/world_build_<label>.json (+ .cpuprofile) and prints the tables. One node process (+1 thread with --workers).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'world_build_node'))), LABEL = opt('label', 'run');
const QUERY = opt('query', ''), WORKERS = has('workers'), PROF = !has('no-prof'), CENSUS = has('census'), DRAIN = has('drain');
const now = () => Number(process.hrtime.bigint()) / 1e6;   // ms, the machine's clock

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const FC = require('../_framecost_check.js'), { openPage } = require('../_page_node.js');
  const C = FC.bootMark.C = { who: null, obr: 0, oar: 0, obs: 0, mobr: 0, umw: 0, um: 0, frustum: 0, terrainH: 0, grHeight: 0, renders: 0, hb0: 0, hb1: 0, ht0: 0, ht1: 0, hms0: 0, hms1: 0, pick: null };
  const base = FC.pageHooks(C, () => null);
  // ---- the windows: [t0, t1, key] on the machine's clock; the boot's steps, and the world step's slices by label
  const WIN = { boot: [], world: [], settle: [] };
  const STEP = {};           // world label -> { n, ms, max }
  const LONG = [];           // every slice over 50 ms: { label, ms, step }
  const SETTLE = { n: 0, ms: 0, max: 0, over50: 0, over100: 0 };
  let bootCur = null, bootAt = 0;
  const bootOpen = k => { const t = now(); if (bootCur) WIN.boot.push([bootAt, t, bootCur]); bootCur = k; bootAt = t; };
  // the profiler: started with the first script, so its clock and ours are tied at one instant
  let session = null, profT0 = 0;
  if (PROF) { const inspector = require('inspector'); session = new inspector.Session(); session.connect();
    await new Promise(r => session.post('Profiler.enable', r));
    await new Promise(r => session.post('Profiler.setSamplingInterval', { interval: 500 }, r));
    await new Promise(r => session.post('Profiler.start', r)); profT0 = now(); }
  const wrapGen = (W) => {
    const orig = W.buildWorldSceneSteps; if (typeof orig !== 'function' || orig.__wb) return;
    const wrapped = function () {
      const g = orig.apply(this, arguments); let label = 'setup';
      const it = { next(v) { const t = now(), r = g.next(v), t1 = now(), d = t1 - t;
          const k = String(label).replace(/[0-9]+/g, '#'), e = STEP[k] || (STEP[k] = { n: 0, ms: 0, max: 0 });
          e.n++; e.ms += d; if (d > e.max) e.max = d; WIN.world.push([t, t1, k]);
          if (d > 50) LONG.push({ label: String(label), ms: +d.toFixed(1), step: bootCur });
          if (!r.done && r.value !== undefined) label = r.value;
          return r; },
        return(v) { return g.return ? g.return(v) : { done: true, value: v }; }, throw(e) { return g.throw(e); },
        [Symbol.iterator]() { return this; } };
      return it; };
    wrapped.__wb = true; W.buildWorldSceneSteps = wrapped;
  };
  const hooks = {
    beforeScript(n, P) { base.beforeScript(n, P); },
    afterScript(n, P) {
      base.afterScript(n, P); const W = P.win;
      if (n === 'src/viewer/boot.js' && W.BOOT && !FC.bootMark.__wb) { FC.bootMark.__wb = true;   // the boot's rows, their windows on our clock too
        const o = FC.bootMark.open, c = FC.bootMark.close;
        FC.bootMark.open = function (k) { const r = o.apply(this, arguments); bootOpen(k); return r; };   // (open closes the row before it: ours after)
        FC.bootMark.close = function () { bootOpen(null); return c.apply(this, arguments); };
        bootOpen('garage:scripts'); }
      if (typeof W.buildWorldSceneSteps === 'function') wrapGen(W);
      // --census: the geometry's arrays kept after upload (GPU_ONLY_GEO a no-op), so the families can be sized and hashed
      if (CENSUS && typeof W.GPU_ONLY_GEO === 'function' && !W.GPU_ONLY_GEO.__keep) { W.GPU_ONLY_GEO = function () {}; W.GPU_ONLY_GEO.__keep = true; }
    },
  };
  const wk = WORKERS ? { workers: /house_worker\.js/, idb: fs.mkdtempSync(path.join(os.tmpdir(), 'wb-idb-')), workerWaitMs: 900000 } : {};
  const t00 = Date.now();
  const P = await openPage(Object.assign({ quiet: true, hooks, query: QUERY }, wk));
  const W = P.win;
  // the settle step's own slices: WF.worldUpdate, a call a row (wrapped once the world stands)
  let wuWrapped = false;
  const wrapUpdate = () => { const WF = W.WORLD; if (wuWrapped || !WF || typeof WF.worldUpdate !== 'function') return; wuWrapped = true;
    const wu = WF.worldUpdate; WF.worldUpdate = function () { const t = now(); try { return wu.apply(this, arguments); } finally { const t1 = now(), d = t1 - t;
      if (bootCur && /:settle$/.test(bootCur)) { SETTLE.n++; SETTLE.ms += d; if (d > SETTLE.max) SETTLE.max = d; if (d > 50) SETTLE.over50++; if (d > 100) SETTLE.over100++; WIN.settle.push([t, t1, 'worldUpdate']); } } }; };
  await P.until(() => { wrapUpdate(); return W.BOOT && W.BOOT.state === 'gone'; }, 3600000);
  FC.bootMark.close();
  const wall = Date.now() - t00;
  // ---- --drain: THE PREMISES' STREAM, ITEM BY ITEM (the en-route freeze, PERF-REPORT-1: "1 built, 123 queued", 1.40 s).
  // The stream as the flight runs it (render_premises stream: the house worker generates, the page places), from every
  // aerodrome in turn, ONE item a call (the bank emptied before each: the page's clock is virtual here), each call timed
  // on the machine's clock and filed under the entry at the queue's head - what one placement costs the main thread
  let drain = null;
  if (DRAIN && W.WORLD && W.WORLD.premises && W.WORLD.premises.stream) {
    const R = W.WORLD.premises, S = R.streamState, HQ = R.hw, rows = [], world = W.FLIGHT_PROBE && W.FLIGHT_PROBE.world ? W.FLIGHT_PROBE.world() : null;
    const head = () => { const j = HQ && HQ.order.length ? HQ.jobs.get(HQ.order[0]) : null; return j ? { id: j.p.id, kind: j.kind || (j.p.isPark ? 'park' : j.p.isObject ? 'object' : '?'), here: !!j.here, remote: !!j.remote } : null; };
    const tD = Date.now(); let calls = 0, idle = 0;
    for (const a of (world && world.aerodromes) || []) {
      for (let guard = 0; guard < 40000 && Date.now() - tD < 900000; guard++) {
        S.bank = 0; const h = head(), q0 = R.stats.queued, t = now(); let n = 0;
        try { n = R.stream(a.x, a.z); } catch (e) { rows.push({ at: a.id, err: String(e && e.message) }); break; }
        const d = now() - t; calls++;
        if (n > 0) { idle = 0; rows.push({ at: a.id, ms: +d.toFixed(1), n, id: h && h.id, kind: h && h.kind, here: h && h.here, left: R.stats.queued }); }
        else if (!(S.near > 0)) break;
        else { if (++idle > 3000) { rows.push({ at: a.id, stuck: S.near, head: h }); break; } await P.frames(1); }   // the worker's answers land at a turn boundary
        if (q0 === 0 && !n) break;
      }
    }
    rows.sort((x, y) => (y.ms || 0) - (x.ms || 0));
    const byKind = {}; for (const r of rows) if (r.ms !== undefined) { const e = byKind[r.kind] || (byKind[r.kind] = { n: 0, ms: 0, max: 0, over50: 0, over100: 0 }); e.n++; e.ms += r.ms; e.max = Math.max(e.max, r.ms); if (r.ms > 50) e.over50++; if (r.ms > 100) e.over100++; }
    for (const k of Object.keys(byKind)) byKind[k].ms = Math.round(byKind[k].ms);
    drain = { calls, built: rows.filter(r => r.ms !== undefined).length, left: R.stats.queued, wallMs: Date.now() - tD, byKind, worst: rows.slice(0, 40), odd: rows.filter(r => r.err || r.stuck).slice(0, 10) };
  }
  let profile = null;
  if (session) { profile = await new Promise(r => session.post('Profiler.stop', (e, p) => r(p && p.profile))); session.disconnect(); }

  // ---- the profile's samples filed under the windows ------------------------------------------------------------
  const top = {};   // window set -> key -> [[fn, ms], ...]
  if (profile) {
    fs.writeFileSync(path.join(OUT, 'world_build_' + LABEL + '.cpuprofile'), JSON.stringify(profile));
    const byId = new Map(); for (const nd of profile.nodes) byId.set(nd.id, nd);
    const name = nd => { const cf = nd.callFrame, u = (cf.url || '').replace(/\\/g, '/').split('/').slice(-1)[0]; return (cf.functionName || '(anon)') + ' ' + u + ':' + (cf.lineNumber + 1); };
    // sample i's time on our clock: the profile's own microseconds from its start, tied at profT0
    const ts = new Float64Array(profile.samples.length); let acc = 0;
    for (let i = 0; i < ts.length; i++) { acc += profile.timeDeltas[i]; ts[i] = profT0 + acc / 1000; }
    const file = (wins) => { const out = {}; let w = 0; const S = wins.slice().sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < ts.length; i++) { const t = ts[i]; while (w < S.length && S[w][1] < t) w++; if (w >= S.length) break; if (S[w][0] > t) continue;
        const k = S[w][2]; if (k == null) continue; const dt = (i + 1 < ts.length ? profile.timeDeltas[i + 1] : 0) / 1000, nd = byId.get(profile.samples[i]); if (!nd) continue;
        const fn = name(nd), o = out[k] || (out[k] = {}); o[fn] = (o[fn] || 0) + dt; }
      const r = {}; for (const k of Object.keys(out)) r[k] = Object.entries(out[k]).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, v]) => [f, Math.round(v)]); return r; };
    top.boot = file(WIN.boot.filter(w => w[2])); top.world = file(WIN.world); top.settle = file(WIN.settle);
  }
  // ---- --census: what the world step's geometry weighs, by family (the size a bake would ship, raw) and its digest ---
  let census = null;
  if (CENSUS && W.WORLD && W.WORLD.scene) { const crypto = require('crypto'); census = {};
    const fam = o => { const n = o.name || ''; if (o.userData && o.userData.farTerrain) return 'far terrain'; const m = /^(premises:patch|pavement|road|pave|rail|poles|strip|runway|chunk)/.exec(n); return m ? m[1] : null; };
    const seen = new Set();
    W.WORLD.scene.traverse(o => { if (!(o.isMesh || o.isLine || o.isPoints) || !o.geometry || seen.has(o.geometry)) return; const f = fam(o); if (!f) return; seen.add(o.geometry);
      const g = o.geometry, e = census[f] || (census[f] = { meshes: 0, verts: 0, tris: 0, bytes: 0, H: crypto.createHash('sha256'), parts: [] }); e.meshes++;
      const h = crypto.createHash('sha256'); h.update(o.name || '');
      for (const k of Object.keys(g.attributes).sort()) { const a = g.attributes[k].array; if (!a || !a.buffer) continue; e.bytes += a.byteLength; h.update(k); h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
      const pa = g.attributes.position; if (pa) { e.verts += pa.count; e.tris += g.index ? g.index.count / 3 : pa.count / 3; }
      if (g.index && g.index.array) { const a = g.index.array; e.bytes += a.byteLength; h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
      e.parts.push(h.digest('hex').slice(0, 16)); });
    for (const k of Object.keys(census)) { const e = census[k]; e.digest = crypto.createHash('sha256').update(e.parts.sort().join(',')).digest('hex').slice(0, 16); delete e.H; delete e.parts; e.tris = Math.round(e.tris); e.MB = +(e.bytes / 1048576).toFixed(1); } }
  const boot = {}; for (const w of WIN.boot) if (w[2]) boot[w[2]] = (boot[w[2]] || 0) + (w[1] - w[0]);
  const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : { n: v.n, ms: Math.round(v.ms), max: Math.round(v.max) }]));
  const worldMs = Object.values(STEP).reduce((s, e) => s + e.ms, 0);
  const res = { label: LABEL, query: QUERY, workers: WORKERS, build: W.FLYDIY_BUILD || null, node: process.version, cpus: os.cpus()[0].model, wall,
    boot: round(boot), world: { ms: Math.round(worldMs), slices: W.__WORLD_SLICES || null, steps: round(STEP), long: LONG.sort((a, b) => b.ms - a.ms) },
    settle: Object.assign(round({ x: SETTLE }).x, { over50: SETTLE.over50, over100: SETTLE.over100, state: W.FLYDIY_WORLD_SETTLE || null }), census, drain, top,
    errors: P.errors.slice(0, 10) };
  fs.writeFileSync(path.join(OUT, 'world_build_' + LABEL + '.json'), JSON.stringify(res, null, 1));
  // ---- the tables ---------------------------------------------------------------------------------------------
  const pad = (s, n) => String(s).padEnd(n), num = (v, n) => String(v).padStart(n);
  console.log('WORLD BUILD IN NODE (' + LABEL + '): wall ' + (wall / 1000).toFixed(1) + ' s, build ' + res.build + ', query "' + QUERY + '", workers ' + WORKERS);
  console.log('\nBOOT STEPS (ms)');
  for (const [k, v] of Object.entries(res.boot).sort((a, b) => b[1] - a[1])) if (v >= 20) console.log('  ' + pad(k, 28) + num(v, 8));
  console.log('\nTHE WORLD STEP BY LABEL: ms, slices, the longest slice (ms) - total ' + res.world.ms + ' ms');
  for (const [k, v] of Object.entries(res.world.steps).sort((a, b) => b[1].ms - a[1].ms)) if (v.ms >= 10) console.log('  ' + pad(k, 34) + num(v.ms, 8) + num(v.n, 7) + num(v.max, 8) + (top.world && top.world[k] ? '   ' + top.world[k].slice(0, 3).map(f => f[0].split(' ')[0] + ' ' + f[1]).join(', ') : ''));
  console.log('\nSLICES OVER 50 ms IN THE WORLD STEP: ' + LONG.length + (LONG.length ? ' - ' + LONG.slice(0, 25).map(l => l.label + ' ' + Math.round(l.ms)).join(', ') : ''));
  console.log('\nSETTLE: ' + JSON.stringify(res.settle));
  if (census) { console.log('\nGEOMETRY BY FAMILY (raw bytes of every attribute + index; the digest of all its meshes)');
    for (const [k, e] of Object.entries(census).sort((a, b) => b[1].bytes - a[1].bytes)) console.log('  ' + pad(k, 18) + num(e.meshes, 6) + ' meshes' + num(e.verts, 10) + ' v' + num(e.tris, 10) + ' t' + num(e.MB, 8) + ' MB  ' + e.digest); }
  if (drain) { console.log(String.fromCharCode(10) + 'THE PREMISES STREAM, ONE ITEM A CALL: ' + drain.built + ' placed in ' + drain.calls + ' calls, ' + drain.left + ' left; by kind ' + JSON.stringify(drain.byKind));
    for (const r of drain.worst.slice(0, 25)) console.log('  ' + num(r.ms, 8) + ' ms  ' + pad(r.kind + (r.here ? ' (here)' : ''), 16) + pad(r.id, 28) + ' from ' + r.at + ', ' + r.left + ' left');
    if (drain.odd.length) console.log('  odd: ' + JSON.stringify(drain.odd)); }
  if (res.errors.length) console.log('\nPAGE ERRORS: ' + res.errors.join(' || ').slice(0, 1200));
  process.exit(0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
