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
//                   [--no-prof] [--census] [--drain] [--units] [--wx] [--mats] [--label before]
// Writes <dir>/world_build_<label>.json (+ .cpuprofile) and prints the tables. One node process (+1 thread with --workers).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'world_build_node'))), LABEL = opt('label', 'run');
const QUERY = opt('query', ''), WORKERS = has('workers'), PROF = !has('no-prof'), CENSUS = has('census'), DRAIN = has('drain'), UNITSON = has('units'), WXON = has('wx'), MATSON = has('mats');
const now = () => Number(process.hrtime.bigint()) / 1e6;   // ms, the machine's clock

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const FC = require('../_framecost_check.js'), { openPage } = require('../_page_node.js');
  const C = FC.bootMark.C = { who: null, obr: 0, oar: 0, obs: 0, mobr: 0, umw: 0, um: 0, frustum: 0, terrainH: 0, grHeight: 0, renders: 0, hb0: 0, hb1: 0, ht0: 0, ht1: 0, hms0: 0, hms1: 0, pick: null };
  const base = FC.pageHooks(C, () => null);
  // ---- the windows: [t0, t1, key] on the machine's clock; the boot's steps, and the world step's slices by label
  const WIN = { boot: [], world: [], settle: [] };
  const STEP = {};           // world label -> { n, ms, max }
  const UNITS = [], STRIPSEQ = [];   // --units: every pavement geometry built (strip / road / paved polygon); the 'strip*' slices in order
  const COMPOSE = [];   // every composition of the premises record: the boot step it ran in, its ms
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
          if (/^strips?( |$)/.test(String(label))) STRIPSEQ.push({ after: String(label), ms: +d.toFixed(1) });
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
      // the record's compositions (PREMISES_GEN.compose: makeWorld's at the boot's scripts, the renderer's at its make, an edit's)
      if (W.PREMISES_GEN && !W.PREMISES_GEN.__wbc) { const PG = W.PREMISES_GEN, c0 = PG.compose; PG.__wbc = true;
        PG.compose = function () { const t = now(); try { return c0.apply(this, arguments); } finally { COMPOSE.push({ at: bootCur || '?', ms: +(now() - t).toFixed(1), opts: arguments[2] ? Object.keys(arguments[2]).sort().join(',') : '' }); } }; }
      // --units: PAVEMENT's three geometry builders, a call a row - its ms, its vertices, where it lies; and the same call
      // WITHOUT its refinement (the regular rows: G2115's bisection and a bumpy strip's fine rows off), built beside it and
      // thrown away: what a coarse form of the same strip or road would cost and weigh
      if (UNITSON && W.PAVEMENT && !W.PAVEMENT.__wb) { const PAV = W.PAVEMENT; PAV.__wb = true;
        for (const [fn, kind] of [['stripGeometry', 'strip'], ['roadGeometry', 'road'], ['polyGeometry', 'pave']]) { const f = PAV[fn]; if (typeof f !== 'function') continue;
          PAV[fn] = function (T, o) { const t = now(), g = f.apply(this, arguments), ms = now() - t;
            const u = { kind, ms: +ms.toFixed(1), verts: 0, x: NaN, z: NaN, len: kind === 'strip' ? o.len : (o.road && o.road.length) || null, wid: o.wid || o.w || null, micro: o.refineMin > 0, refine: kind === 'strip' ? o.refine !== false && o.sinkD0 != null : !!o.refine, step: bootCur };
            try { const pa = g.attributes.position; u.verts = pa.count; if (!g.boundingSphere) g.computeBoundingSphere(); u.x = +g.boundingSphere.center.x.toFixed(1); u.z = +g.boundingSphere.center.z.toFixed(1); u.r = Math.round(g.boundingSphere.radius);
              if (kind === 'strip') { u.cx = o.cx; u.cz = o.cz; }
              if (u.refine) { const t2 = now(), g2 = f.call(this, T, Object.assign({}, o, { refine: false, refineMin: 0, refineMinV: 0 })); u.coarseMs = +(now() - t2).toFixed(1); u.coarseVerts = g2.attributes.position.count; g2.dispose(); } } catch (e) { u.err = String(e && e.message); }
            UNITS.push(u); return g; }; } }
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
  // the composed-terrain raster's own counters (27_premises grStats: tiles baked / decoded / evicted, the cache's bytes)
  const rasterStat = () => { try { const w = W.FLIGHT_PROBE.world(), O = w.premises && w.premises.overlay; return O && O.raster ? Object.assign({}, O.raster) : null; } catch (e) { return null; } };
  const rasterEnd = rasterStat();
  // ---- --mats: THE PREMISES' MATERIAL OBJECTS (a house makes its finish anew: ~27 materials a placement). Under the
  // premises' root: the material OBJECTS, the distinct PROGRAM shapes among them (type, hook text, cache key, defines, which
  // maps, side, transparency, alphaTest, vertex colours - what three keys a program on) and the distinct LOOKS (the shape +
  // the values: colours, roughness, metalness, opacity, the maps' identities, the userData uniforms). objects >> looks =
  // materials that could be shared per finish (a first-draw saving at every streamed house)
  const matsOf = () => { if (!(MATSON && W.WORLD && W.WORLD.scene)) return null; const crypto = require('crypto'); const seen = new Set(), shapes = new Map(), looks = new Map(), byOwner = {};
    const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap', 'lightMap', 'bumpMap'];
    const num = v => (typeof v === 'number' ? +v.toPrecision(7) : v && v.isColor ? v.getHexString() : v && v.isVector2 ? [v.x, v.y] : v && v.isVector3 ? [v.x, v.y, v.z] : v && v.isVector4 ? [v.x, v.y, v.z, v.w] : v && v.isTexture ? 'tex:' + v.uuid : typeof v === 'boolean' || typeof v === 'string' ? v : v == null ? null : '?');
    const uni = m => { const o = {}; const walk = (pre, g, d) => { if (!g || typeof g !== 'object' || d > 2) return; for (const k of Object.keys(g).sort()) { const u = g[k]; if (u && typeof u === 'object' && 'value' in u) o[pre + k] = num(u.value); else if (u && typeof u === 'object' && !u.isTexture && !u.isObject3D && !u.isMaterial && !ArrayBuffer.isView(u)) walk(pre + k + '.', u, d + 1); } }; walk('', m.userData, 0); if (m.uniforms) walk('u.', m.uniforms, 1); return o; };
    const root = (() => { let r = null; W.WORLD.scene.traverse(o => { if (!r && o.name === 'premises') r = o; }); return r; })();
    (root || W.WORLD.scene).traverse(o => { if (!o.material) return; for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { if (!m || seen.has(m)) continue; seen.add(m);
      let ck = ''; try { ck = m.customProgramCacheKey ? String(m.customProgramCacheKey()) : ''; } catch (e) { ck = 'throws'; }
      const hook = m.onBeforeCompile ? crypto.createHash('sha1').update(String(m.onBeforeCompile)).digest('hex').slice(0, 8) : '';
      const shape = JSON.stringify([m.type, ck, hook, m.defines || null, MAPS.map(k => (m[k] ? 1 : 0)).join(''), m.side, !!m.transparent, m.alphaTest || 0, !!m.vertexColors, !!m.flatShading, !!m.fog, !!o.isInstancedMesh, !!o.isSkinnedMesh, m.blending]);
      const look = shape + JSON.stringify([num(m.color), num(m.emissive), m.roughness, m.metalness, m.opacity, m.emissiveIntensity, m.envMapIntensity, MAPS.map(k => (m[k] ? m[k].uuid : 0)), m.polygonOffset ? [m.polygonOffsetFactor, m.polygonOffsetUnits] : 0, m.depthWrite, uni(m)]);
      shapes.set(shape, (shapes.get(shape) || 0) + 1); looks.set(look, (looks.get(look) || 0) + 1);
      let own = o; while (own.parent && own.parent !== root && own.parent.parent) own = own.parent; const on = String(own.name || own.type).replace(/[0-9]+/g, '#').slice(0, 24); byOwner[on] = (byOwner[on] || 0) + 1; } });
    const top = M => [...M.values()].sort((a, b) => b - a).slice(0, 8);
    return { root: !!root, objects: seen.size, shapes: shapes.size, looks: looks.size, mostSharedLook: top(looks), mostSharedShape: top(shapes), byOwner: Object.fromEntries(Object.entries(byOwner).sort((a, b) => b[1] - a[1]).slice(0, 14)),
      houses: (() => { try { const st = W.WORLD.premises.stats; return { houses: st.houses, objects: st.objects, queued: st.queued }; } catch (e) { return null; } })() }; };
  let mats = MATSON ? { garage: matsOf(), drained: null } : null;
  // ---- --wx: A WEATHER CHANGE ON THE MAIN THREAD (render_world wxGroundFrame: a weather strip's row re-applied, a bumpy
  // one RE-DRAPED - y per vertex, then computeVertexNormals). The world's update at the stand timed twice as it is (the
  // floor), then once after each change of the ground's rung (world.setGround): the difference is the re-drape's
  let wx = null;
  if (WXON && W.WORLD && W.WORLD.worldUpdate && W.FLIGHT_PROBE) { const world = W.FLIGHT_PROBE.world(); let st = null; try { st = W.FLYDIY_TOWN_AT(); } catch (e) { st = null; }
    if (world && world.setGround && st) { const cg = [st[0], st[1] + 1.5, st[2]], one = () => { const t = now(); try { W.WORLD.worldUpdate(cg); } catch (e) { return -1; } return +(now() - t).toFixed(1); };
      wx = { floor: [one(), one(), one()], steps: [] };
      for (const level of ['soft', 'dry', 'firm', 'soft', null]) { world.setGround(level); wx.steps.push({ level: String(level), scales: world.wearScales ? world.wearScales() : null, ms: one(), again: one() }); } } }
  // ---- --drain: THE PREMISES' STREAM, ITEM BY ITEM (the en-route freeze, PERF-REPORT-1: "1 built, 123 queued", 1.40 s).
  // The stream as the flight runs it (render_premises stream: the house worker generates, the page places), from every
  // aerodrome in turn, ONE item a call (the bank emptied before each: the page's clock is virtual here), each call timed
  // on the machine's clock and filed under the entry at the queue's head - what one placement costs the main thread
  let drain = null;
  if (DRAIN && W.WORLD && W.WORLD.premises && W.WORLD.premises.stream) {
    const R = W.WORLD.premises, S = R.streamState, HQ = R.hw, rows = [], world = W.FLIGHT_PROBE && W.FLIGHT_PROBE.world ? W.FLIGHT_PROBE.world() : null;
    const head = () => { const j = HQ && HQ.order.length ? HQ.jobs.get(HQ.order[0]) : null; return j ? { id: j.p.id, kind: j.kind || (j.p.isPark ? 'park' : j.p.isObject ? 'object' : '?'), here: !!j.here, remote: !!j.remote } : null; };
    const tD = Date.now(), budget0 = S.budget; let calls = 0, idle = 0;
    S.budget = 1e-9;   // one entry a call: the bank is spent by the first placement (the page's clock moves 10 us a read here)
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
    S.budget = budget0;
    rows.sort((x, y) => (y.ms || 0) - (x.ms || 0));
    const byKind = {}; for (const r of rows) if (r.ms !== undefined) { const e = byKind[r.kind] || (byKind[r.kind] = { n: 0, ms: 0, max: 0, over50: 0, over100: 0 }); e.n++; e.ms += r.ms; e.max = Math.max(e.max, r.ms); if (r.ms > 50) e.over50++; if (r.ms > 100) e.over100++; }
    for (const k of Object.keys(byKind)) byKind[k].ms = Math.round(byKind[k].ms);
    if (mats) mats.drained = matsOf();   // the whole stream placed: every entry of the default town
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
  // ---- --units: the table by unit and by distance from the stand ---------------------------------------------------
  let units = null;
  if (UNITSON) { let st = null; try { st = W.FLYDIY_TOWN_AT ? W.FLYDIY_TOWN_AT() : null; } catch (e) { st = null; }
    const world = W.FLIGHT_PROBE && W.FLIGHT_PROBE.world ? W.FLIGHT_PROBE.world() : null, AD = (world && world.aerodromes) || [];
    const dist = (x, z) => (st ? Math.round(Math.hypot(x - st[0], z - st[2])) : null);
    for (const u of UNITS) { u.d = dist(u.x, u.z); if (u.kind === 'strip') { let best = null, bd = 1e9; for (const a of AD) { const d = Math.hypot(a.x - u.cx, a.z - u.cz); if (d < bd) { bd = d; best = a; } } u.id = best && bd < 5 ? best.id : '?'; } }
    const BANDS = [[0, 1500], [1500, 3000], [3000, 6000], [6000, 1e9]], bandOf = d => BANDS.findIndex(b => d >= b[0] && d < b[1]);
    const by = {}; for (const u of UNITS) { const k = u.kind, b = bandOf(u.d == null ? 1e8 : u.d), e = (by[k] || (by[k] = BANDS.map(() => ({ n: 0, ms: 0, verts: 0, coarseMs: 0, coarseVerts: 0 }))))[b]; e.n++; e.ms += u.ms; e.verts += u.verts; e.coarseMs += u.coarseMs !== undefined ? u.coarseMs : u.ms; e.coarseVerts += u.coarseVerts !== undefined ? u.coarseVerts : u.verts; }
    // the patch: its blocks (a THREE.LOD each), the near level's vertices by band; its time shared by them
    const patch = BANDS.map(() => ({ blocks: 0, verts0: 0, vertsAll: 0 }));
    if (W.WORLD && W.WORLD.scene) W.WORLD.scene.traverse(o => { if (!o.isLOD || o.name !== 'premises:patch' || !o.levels) return; const b = bandOf(dist(o.position.x, o.position.z) || 0), e = patch[b]; e.blocks++;
      o.levels.forEach((L, i) => { const pa = L.object && L.object.geometry && L.object.geometry.attributes.position; if (!pa) return; if (!i) e.verts0 += pa.count; e.vertsAll += pa.count; }); });
    const pMs = ['patch ground', 'patch block', 'ground under the premises'].reduce((a, k) => a + (STEP[k] ? STEP[k].ms : 0), 0), pV = patch.reduce((a, e) => a + e.verts0, 0) || 1;
    for (const e of patch) e.ms = Math.round(pMs * e.verts0 / pV);
    const hw = W.HOUSE_WORKER && W.HOUSE_WORKER.stats ? W.HOUSE_WORKER.stats() : null;
    units = { stand: st ? [Math.round(st[0]), Math.round(st[2])] : null, bands: BANDS.map(b => b[0] + '-' + (b[1] > 1e8 ? '' : b[1])), by, patch, list: UNITS.slice().sort((a, b) => b.ms - a.ms), stripSeq: STRIPSEQ,
      aerodromes: AD.map(a => ({ id: a.id, kind: a.kind, len: a.len, wid: a.wid, d: dist(a.x, a.z), premises: !!a.premises })), houseWorker: hw }; }
  const boot = {}; for (const w of WIN.boot) if (w[2]) boot[w[2]] = (boot[w[2]] || 0) + (w[1] - w[0]);
  const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : { n: v.n, ms: Math.round(v.ms), max: Math.round(v.max) }]));
  const worldMs = Object.values(STEP).reduce((s, e) => s + e.ms, 0);
  const res = { label: LABEL, query: QUERY, workers: WORKERS, build: W.FLYDIY_BUILD || null, node: process.version, cpus: os.cpus()[0].model, wall,
    boot: round(boot), world: { ms: Math.round(worldMs), slices: W.__WORLD_SLICES || null, steps: round(STEP), long: LONG.sort((a, b) => b.ms - a.ms) },
    settle: Object.assign(round({ x: SETTLE }).x, { over50: SETTLE.over50, over100: SETTLE.over100, state: W.FLYDIY_WORLD_SETTLE || null }), census, drain, units, compose: COMPOSE, raster: rasterEnd, mats, wx, stripw: W.FLYDIY_STRIPW ? Object.assign({}, W.FLYDIY_STRIPW, { jobs: undefined }) : null, top,
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
  console.log('COMPOSITIONS: ' + JSON.stringify(COMPOSE));
  console.log('RASTER (at the garage): ' + JSON.stringify(rasterEnd));
  if (res.stripw) console.log('STRIP WORKER: ' + JSON.stringify(res.stripw) + ' | house worker ' + JSON.stringify(W.HOUSE_WORKER && W.HOUSE_WORKER.stats ? W.HOUSE_WORKER.stats() : null));
  if (mats) console.log('PREMISES MATERIALS: ' + JSON.stringify(mats));
  if (wx) console.log('WEATHER CHANGE (ms a world update): ' + JSON.stringify(wx));
  if (census) { console.log('\nGEOMETRY BY FAMILY (raw bytes of every attribute + index; the digest of all its meshes)');
    for (const [k, e] of Object.entries(census).sort((a, b) => b[1].bytes - a[1].bytes)) console.log('  ' + pad(k, 18) + num(e.meshes, 6) + ' meshes' + num(e.verts, 10) + ' v' + num(e.tris, 10) + ' t' + num(e.MB, 8) + ' MB  ' + e.digest); }
  if (drain) { console.log(String.fromCharCode(10) + 'THE PREMISES STREAM, ONE ITEM A CALL: ' + drain.built + ' placed in ' + drain.calls + ' calls, ' + drain.left + ' left; by kind ' + JSON.stringify(drain.byKind));
    for (const r of drain.worst.slice(0, 25)) console.log('  ' + num(r.ms, 8) + ' ms  ' + pad(r.kind + (r.here ? ' (here)' : ''), 16) + pad(r.id, 28) + ' from ' + r.at + ', ' + r.left + ' left');
    if (drain.odd.length) console.log('  odd: ' + JSON.stringify(drain.odd)); }
  if (units) { const NL = String.fromCharCode(10);
    console.log(NL + 'BY UNIT (--units): the stand at ' + JSON.stringify(units.stand) + '; bands (m from the stand) ' + units.bands.join(' | '));
    for (const k of Object.keys(units.by)) console.log('  ' + pad(k, 7) + units.by[k].map(e => e.n + ' u ' + Math.round(e.ms) + ' ms ' + e.verts + ' v (coarse ' + Math.round(e.coarseMs) + ' ms ' + e.coarseVerts + ' v)').join(' | '));
    console.log('  ' + pad('patch', 7) + units.patch.map(e => e.blocks + ' blocks ' + e.ms + ' ms ' + e.verts0 + ' v at 2 m (' + e.vertsAll + ' all levels)').join(' | '));
    console.log('  the dearest units:');
    for (const u of units.list.slice(0, 30)) console.log('    ' + pad(u.kind + (u.id ? ' ' + u.id : ''), 20) + num(u.ms, 8) + ' ms' + num(u.verts, 9) + ' v  ' + num(u.d, 6) + ' m  len ' + Math.round(u.len || 0) + (u.micro ? ' bumpy' : '') + (u.coarseMs !== undefined ? '  coarse ' + u.coarseMs + ' ms ' + u.coarseVerts + ' v' : ''));
    console.log('  the strip slices in order (work filed under the label BEFORE it): ' + units.stripSeq.map(q => q.after + ' ' + Math.round(q.ms)).join(', '));
    console.log('  aerodromes: ' + units.aerodromes.map(a => a.id + ' ' + a.d + ' m').join(', '));
    console.log('  house worker: ' + JSON.stringify(units.houseWorker)); }
  if (res.errors.length) console.log('\nPAGE ERRORS: ' + res.errors.join(' || ').slice(0, 1200));
  process.exit(0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
