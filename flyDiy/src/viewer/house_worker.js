// ============================================================
// THE HOUSES' OWN THREAD (G830-G832, 2026-09-29; C2a of QUEUE-C, futureDesigns/ARCH-2026-09-27.md §3.2 (b), §3.4
// step 1). render_premises.js generated every house on the main thread - VILLAGE_GEN.placeHouse, HOUSE_GEN.build at
// lod 0 and lod 1 (the voxel AO bake: 100-200 ms a house), the plot's dressing (finishPlot, the fence's bags and
// bake, the outbuilding's build, the lot patch): the roll-out's town step, and a 100-200 ms frame whenever a site
// streamed in. This file is a Blob worker that does that generation (src/viewer/premises_build.js, the same code the
// page runs inline) and hands back TRANSFERABLE typed arrays - positions, normals, uv, AO, lit, the window slot, the
// index - that the page only stands up as BufferGeometry.
//
// THE USER'S RULE HOLDS: one upfront load. The worker only takes the work off the main thread; the town step and the
// settle (app.js TRIP_STEPS) wait, under the loading screen, for every result within their reach, exactly as they
// waited for the inline builds.
//
// THE WORKER'S WORLD. A house stands on the COMPOSED ground (P.ground reads the premises' terrain - the island's
// heights + every modifier, the cooked raster when the page reads it), so the worker makes that world itself, the
// physics worker's way (sim_host.js simHostFetchBoot: the trimmed island boot through the page's own URLs, one gzip
// stream each; + the island's cooked raster cells under the page's raster flag, as the loader brings them), then
// makeWorld(0, { premises, island }) on the page's own premises text, and at the renderer's make the page's own
// recompose: world.premises.set(rec, { build, pool }) with the record, the tree pool and the generators the page has.
// Started by world_boot.js (FLYDIY_WORLD_COMPOSE) right after the page's own makeWorld, so the ~5 s of it runs beside
// the garage's boot.
//
// THE CACHE (IndexedDB 'flydiy-houses', two stores: 'r' the packed result, 'd' its delta to the village's two
// tallies - premises_build.js's header): a key is
//   FLYDIY_BUILD | HW_V | PREMISES_BUILD.V | the record's hash | the dials (lod 1, the outbuildings' lod) |
//   kind:id:seed | the hash of the tallies BEFORE it
// - a house's output is a pure function of exactly that. A hit applies the stored delta (so what follows is keyed and
// generated as if the house had been built) and reads the arrays back; a second visit generates nothing. Another
// FLYDIY_BUILD's entries are dropped when the worker opens the cache (a new deploy re-builds once). A cache is a
// cache: no IndexedDB (a private window, a refusal, eviction) is a miss, and a miss generates.
//
// ?housew=0 (or localStorage flydiy.housew = '0') turns it off: the page generates inline, as before (the gate's
// reference). file:// or no Worker: off, silently. The editor (PREMISES_HOST_OPEN) builds inline.
// GATE HOUSEWORKER (tools/_houseworker_check.js) is the proof: bit-identical to the inline build for every entry on
// Jolene, no house generation on the page's thread in the town step, a warm cache builds 0.
// ============================================================
'use strict';
const HW_V = 1;
// the page's generator files, in the page's order (build.js MANIFEST.world), by the global each publishes; the worker
// imports those the page has (the lazy two only when the page loaded them)
// (C2c: ground_tex.js before lot_tex.js - since AS2 (G910) the lot's sets are the ground library's view, LOT_TEX_SETS; without it
// the worker threw at its init on train 17 and every house was built on the page)
const HW_FILES = [['HOUSE_TEX_SETS', 'src/viewer/house_tex.js'], ['GROUND_TEX', 'src/viewer/ground_tex.js'], ['LOT_GROUND', 'src/viewer/lot_tex.js'], ['SIGN_TEX_META', 'src/viewer/sign_tex.js'],
  ['HOUSE_KIT', 'tools/_house_kit.js'], ['HOUSE_GEN', 'tools/_house_gen.js'], ['BIG_GEN', 'tools/_big_gen.js'], ['SHED_GEN', 'tools/_shed_gen.js'],
  ['HANGAR_GEN', 'tools/_hangar_gen.js'], ['TOWER_GEN', 'tools/_tower_gen.js'], ['TRAM_GEN', 'tools/_tram_gen.js'], ['TOTEM_GEN', 'tools/_totem_gen.js'],
  ['VILLAGE_GEN', 'tools/_village_gen.js'], ['PREMISES_BUILD', 'src/viewer/premises_build.js']];
const HW_LAZY = [['SPORT_GEN', 'tools/_sport_gen.js'], ['MARINE_GEN', 'tools/_marine_gen.js']];
const HW_DB = 'flydiy-houses';

// ---- THE WORKER'S BODY (thread-agnostic: `port` = { post(m, transfer), on(fn) }) ------------------------------------
function houseWorkerBody(G, port) {
  const st = { world: null, O: null, rec: null, B: null, epoch: -1, db: null, deltas: new Map(), prefix: '', build: '', size: 0,
               built: 0, hits: 0, misses: 0, genMs: 0, initMs: 0, composeMs: 0, err: null, moved: 0, kept: 0, bytes: 0 };
  // a result posted with its arrays TRANSFERRED: each buffer detached here after the post (kept = a copy was made)
  const send = (m, tr) => { port.post(m, tr); for (const b of tr) { if (b.byteLength === 0) st.moved++; else st.kept++; } };
  const sizeOf = tr => tr.reduce((a, b) => a + b.byteLength, 0);
  const C = { G, get PG() { return G.PREMISES_GEN; }, get O() { return st.O; }, get rec() { return st.rec; },
              waterY: () => (st.world && st.world.waterH ? st.world.waterH(0, 0) : -1e9), size: () => st.size,
              game: true, lod1: true, outLod: 1, props: new Set(), pp: true, lotGround: true };
  const now = () => (G.performance ? G.performance.now() : Date.now());
  // ---- the cache ----
  const idbReq = r => new Promise(res => { r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
  function idbOpen() {
    return new Promise(res => {
      let r; try { r = G.indexedDB && G.indexedDB.open(HW_DB, 1); } catch (e) { r = null; }
      if (!r) { res(null); return; }
      r.onupgradeneeded = () => { const db = r.result; for (const s of ['r', 'd']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    });
  }
  async function idbLoad(prefix, build) {
    if (!st.db) st.db = await idbOpen();
    st.deltas = new Map();
    if (!st.db) return;
    try {
      // another build's entries go (a deploy re-builds once); a cache past 6 000 entries starts again
      const keys = (await idbReq(st.db.transaction(['d'], 'readonly').objectStore('d').getAllKeys())) || [];
      const stale = keys.filter(k => String(k).indexOf(build + '|') !== 0);
      if (stale.length || keys.length > 6000) {
        const tx = st.db.transaction(['r', 'd'], 'readwrite'), R = tx.objectStore('r'), D = tx.objectStore('d');
        for (const k of keys.length > 6000 ? keys : stale) { R.delete(k); D.delete(k); }
        await new Promise(res => { tx.oncomplete = res; tx.onerror = res; tx.onabort = res; });
      }
      const range = G.IDBKeyRange.bound(prefix, prefix + '￿');
      const s = st.db.transaction(['d'], 'readonly').objectStore('d');
      const [ks, vs] = await Promise.all([idbReq(s.getAllKeys(range)), idbReq(s.getAll(range))]);
      if (ks && vs) for (let i = 0; i < ks.length; i++) st.deltas.set(ks[i], vs[i]);
    } catch (e) { st.deltas = new Map(); }
  }
  function idbPut(key, r, d) {
    if (!st.db) return;
    try { const tx = st.db.transaction(['r', 'd'], 'readwrite'); tx.objectStore('r').put(r, key); tx.objectStore('d').put(d || 0, key); } catch (e) {}
  }
  function idbGet(key) {
    if (!st.db) return Promise.resolve(undefined);
    try { return idbReq(st.db.transaction(['r'], 'readonly').objectStore('r').get(key)); } catch (e) { return Promise.resolve(undefined); }
  }
  // ---- the messages ----
  async function init(m) {
    const t0 = now();
    st.build = String(m.build || 'dev');
    // what the generators and the core read off `window` in a page; images are the page's (the geometry reads a
    // set's METADATA - house_tex's `ribbed`, sign_tex's aspects - never its pixels)
    G.window = G;
    if (typeof G.Image === 'undefined') G.Image = function Image() { this.complete = false; this.naturalWidth = 0; this.width = 0; this.height = 0; this.src = ''; this.addEventListener = function () {}; this.removeEventListener = function () {}; };
    for (const k of Object.keys(m.flags || {})) G[k] = m.flags[k];
    G.module = { exports: {} };
    G.importScripts(m.urls.three);
    G.module = { exports: {} };
    G.importScripts(m.urls.core);
    G.module = { exports: {} };
    G.importScripts(m.urls.simHost);
    const SH = G.module.exports;
    G.module = undefined;
    // assets.js's shared 1x1 for a FLAT map (G903): the worker's materials are never drawn - a plain texture stands in
    if (typeof G.TEX_FLAT !== 'function') G.TEX_FLAT = () => new G.THREE.Texture();
    for (const [, f] of HW_FILES) G.importScripts(m.urls[f]);
    for (const [g, f] of HW_LAZY) if (m.lazy && m.lazy.indexOf(g) >= 0 && m.urls[f]) G.importScripts(m.urls[f]);
    // the island's trimmed boot, and its cooked raster cells when the page reads them (the loader's rule: a cook that
    // does not arrive is a lazy raster)
    const boot = await SH.simHostFetchBoot(m.base, m.island, { raster: !!m.raster });
    if (!boot) throw new Error('no island "' + m.island + '"');
    if (m.raster && !boot.premCook) boot.premCook = await fetchCook(m.base, m.island);
    const island = G.ISLAND_GEN.makeIsland(boot);
    st.world = G.makeWorld(0, { premises: m.premises, island });
    st.initMs = now() - t0;
    port.post({ cmd: 'ready', ms: st.initMs });
  }
  function fetchCook(base, name) {
    const gz = buf => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(b => new Uint8Array(b));
    return fetch(base + 'src/core/premises_packs.json').then(r => (r.ok ? r.json() : { islands: [] })).then(PP => {
      const pi = (PP.islands || []).find(w => w.id === name);
      if (!pi || !pi.raster) return null;
      const got = [];
      return Promise.all(pi.raster.cells.map(c => fetch(base + c.src).then(res => { if (!res.ok) throw new Error(c.src + ' ' + res.status); return res.arrayBuffer(); })
        .then(gz).then(u => got.push({ ci: c.c[0], cj: c.c[1], sig: c.sig, bytes: u })))).then(() => ({ raster: got }));
    }).catch(() => null);
  }
  async function compose(m) {
    const t0 = now();
    if (!st.world) throw new Error('compose before the world');
    for (const [g, f] of HW_LAZY) if (!G[g] && m.lazy && m.lazy.indexOf(g) >= 0 && m.urls && m.urls[f]) G.importScripts(m.urls[f]);
    const PG = G.PREMISES_GEN;
    const buildFor = r => { const GEN = G[r.gen]; return GEN ? GEN.build(r.P, 0) : null; };
    // the page's own recompose (render_premises.js composeNow, in the game)
    st.rec = m.rec;
    st.O = st.world.premises.set(m.rec, { build: buildFor, pool: m.pool || [] }) || PG.compose(m.rec, st.world.premises.base, { pool: m.pool || [], globals: G, build: buildFor });
    st.epoch = m.epoch;
    st.B = G.PREMISES_BUILD.makeBuilder(C);
    const recHash = PG.fnv(JSON.stringify(m.rec)).toString(36) + '.' + JSON.stringify(m.rec).length.toString(36);
    st.recHash = recHash;
    st.composeMs = now() - t0;
    port.post({ cmd: 'composed', epoch: m.epoch, ms: st.composeMs });
  }
  async function jobs(m) {
    if (m.epoch !== st.epoch || !st.B) { for (const j of m.jobs) port.post({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, miss: 'stale' }); return; }
    const B = st.B, PB = G.PREMISES_BUILD;
    st.size = m.size; C.lod1 = !!m.lod1; C.outLod = m.outLod; C.pp = !!m.pp; C.lotGround = !!m.lotGround;
    if (m.props) C.props = new Set(m.props);
    if (m.state) B.setState(m.state);
    const prefix = [st.build, HW_V, PB.V, st.recHash, (C.lod1 ? 1 : 0) + '.' + C.outLod + '.' + (C.lotGround ? 1 : 0) + '.' + (C.pp ? 1 : 0)].join('|') + '|';
    if (prefix !== st.prefix) { st.prefix = prefix; await idbLoad(prefix, st.build); }
    const pending = [];
    for (const j of m.jobs) {
      const x = B.find(j);
      if (!x) { port.post({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, miss: 'not found' }); st.misses++; continue; }
      // an entry the page builds itself (a hangar's shell): generated here for the TALLIES alone - its delta, no arrays,
      // no cache - so the batch goes on past it
      if (j.tally) {
        try { const m0 = B.mark(); B.gen(j, x); port.post({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, d: B.delta(m0), tally: true }); st.tallies = (st.tallies || 0) + 1; }
        catch (e) { port.post({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, miss: 'error: ' + (e && e.message) }); st.misses++; }
        continue;
      }
      const key = prefix + j.kind + ':' + j.id + ':' + j.seed + ':' + B.stateHash();
      if (st.deltas.has(key)) {
        // A HIT: the tallies move as the build would have moved them; the arrays come back off the disk
        const d = st.deltas.get(key) || null;
        B.applyDelta(d);
        st.hits++;
        pending.push(idbGet(key).then(r => {
          if (r === undefined) { port.post({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, miss: 'cache' }); return; }
          const tr = transfers(r); st.bytes += sizeOf(tr);
          send({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, r, d, hit: true }, tr);
        }));
        continue;
      }
      const t0 = now();
      let out;
      try {
        const m0 = B.mark();
        const R = B.gen(j, x);
        const d = B.delta(m0);
        const p = B.pack(R, G.THREE, x);
        out = { r: p.r, d, tr: p.tr };
      } catch (e) { port.post({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, miss: 'error: ' + (e && e.message) }); st.misses++; continue; }
      const ms = now() - t0; st.genMs += ms; st.built++;
      st.deltas.set(key, out.d);
      idbPut(key, out.r, out.d);   // cloned now, before the arrays leave
      st.bytes += sizeOf(out.tr);
      send({ cmd: 'result', epoch: m.epoch, gen: m.gen, seq: j.seq, r: out.r, d: out.d, ms }, out.tr);
    }
    await Promise.all(pending);
    port.post({ cmd: 'stats', stats: { built: st.built, hits: st.hits, misses: st.misses, genMs: Math.round(st.genMs), initMs: Math.round(st.initMs), composeMs: Math.round(st.composeMs), cache: !!st.db,
      mb: +(st.bytes / 1048576).toFixed(1), moved: st.moved, kept: st.kept, tallies: st.tallies || 0 } });
  }
  // every array a packed result holds (the page takes them: nothing is copied back)
  function transfers(r) {
    const tr = [], seen = new Set();
    const walk = v => { if (!v || typeof v !== 'object') return; if (ArrayBuffer.isView(v)) { if (!seen.has(v.buffer)) { seen.add(v.buffer); tr.push(v.buffer); } return; } if (Array.isArray(v)) { for (const x of v) walk(x); return; } for (const k of Object.keys(v)) if (k !== 'stats' && k !== 'plot' && k !== 'house') walk(v[k]); };
    walk(r);
    return tr;
  }
  // one message at a time, in order (an async step - the fetch, the cache - finishes before the next begins); the
  // returned promise is the harness's (tools/_page_node.js acks a message when it settles), a browser ignores it
  let chain = Promise.resolve();
  port.on(m => {
    chain = chain.then(() => (m.cmd === 'init' ? init(m) : m.cmd === 'compose' ? compose(m) : m.cmd === 'jobs' ? jobs(m) : null))
      .catch(e => { st.err = String(e && e.message || e); port.post({ cmd: 'fail', why: st.err, stack: String(e && e.stack || '') }); });
    return chain;
  });
}

// the Blob's source: this file by URL next to the page, then the body
function houseWorkerSource(url) {
  return 'importScripts(' + JSON.stringify(url) + ');\n' +
    'houseWorkerBody(self, { post: function (m, tr) { self.postMessage(m, tr || []); }, on: function (f) { self.onmessage = function (e) { return f(e.data); }; } });\n';
}

// ---- THE PAGE'S SIDE ---------------------------------------------------------------------------------------------------
const HOUSE_WORKER = (() => {
  const S = { on: false, why: 'not started', w: null, ready: false, failed: false, epoch: 0, composed: -1, stats: {}, got: 0, bytes: 0, initMs: 0, composeMs: 0, t0: 0 };
  let onResult = null, onFail = null, waiters = [];
  const W = typeof window !== 'undefined' ? window : {};
  const wake = () => { const w = waiters; waiters = []; for (const f of w) f(); };
  function off(why) { S.on = false; S.why = why; return null; }
  // the URL of a file as the page itself asked for it (its ?v=, so the HTTP cache serves the worker), else next to the page
  function urlOf(base, f, ver) {
    try { const el = document.querySelector('script[src*="' + f + '"]'); if (el && el.src) return el.src; } catch (e) {}
    return base + f + (ver ? '?v=' + encodeURIComponent(ver) : '');
  }
  function flag() {
    try { const q = new URLSearchParams(location.search).get('housew'); if (q !== null) return q !== '0'; } catch (e) {}
    try { if (localStorage.getItem('flydiy.housew') === '0') return false; } catch (e) {}
    return true;
  }
  // o: { premises (the text the page composed), island (its id) }
  function start(o) {
    if (S.w || S.failed) return S.w ? api : null;
    try {
      if (!flag()) return off('off (?housew=0)');
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return off('no worker here');
      if (!o || !o.island || !o.premises) return off('no island premises');
      const base = new URL('.', location.href).href, ver = W.FLYDIY_BUILD, core = W.FLYDIY_CORE_SHA;
      const urls = { three: urlOf(base, 'vendor/three.min.js'), core: base + 'tools/flight_core.js' + (core ? '?v=' + encodeURIComponent(core) : ''), simHost: urlOf(base, 'src/viewer/sim_host.js', ver) };
      for (const [, f] of HW_FILES.concat(HW_LAZY)) urls[f] = urlOf(base, f, ver);
      const self = urlOf(base, 'src/viewer/house_worker.js', ver);
      const url = URL.createObjectURL(new Blob([houseWorkerSource(self)], { type: 'text/javascript' }));
      const w = new Worker(url);
      S.w = w; S.on = true; S.why = 'starting'; S.t0 = (W.performance || Date).now();
      w.onmessage = e => { try { msg(e.data); } catch (err) { console.warn('house worker message:', err); } };
      w.onerror = err => fail('the worker failed: ' + (err && err.message || err));
      const lazy = HW_LAZY.filter(([g]) => /sport\//.test(o.premises) && g === 'SPORT_GEN' || /marine\//.test(o.premises) && g === 'MARINE_GEN').map(([g]) => g);
      w.postMessage({ cmd: 'init', base, urls, island: o.island, premises: o.premises, raster: !!W.FLYDIY_GROUND_RASTER, lazy, build: ver || 'dev',
                      flags: { FLYDIY_GROUND_RASTER: W.FLYDIY_GROUND_RASTER } });
      S.urls = urls;
      return api;
    } catch (e) { return off('no worker (' + (e && e.message) + ')'); }
  }
  function fail(why) {
    if (S.failed) return;
    S.failed = true; S.on = false; S.why = why;
    console.warn('house worker: ' + why + ' - the page builds the houses itself');
    try { S.w && S.w.terminate(); } catch (e) {}
    if (onFail) try { onFail(why); } catch (e) {}
    wake();
  }
  function msg(m) {
    if (!m) return;
    if (m.cmd === 'ready') { S.ready = true; S.initMs = m.ms; S.why = 'on'; }
    else if (m.cmd === 'composed') { S.composed = m.epoch; S.composeMs = m.ms; }
    else if (m.cmd === 'stats') S.stats = m.stats;
    else if (m.cmd === 'fail') { fail('the worker: ' + m.why); return; }
    else if (m.cmd === 'result') { S.got++; if (onResult) onResult(m); }
    wake();
  }
  // the renderer's side: its composition (a new epoch), its batches of work, its results
  function compose(rec, pool, lazyNames) {
    if (!S.on) return -1;
    const e = ++S.epoch;
    S.w.postMessage({ cmd: 'compose', epoch: e, rec, pool, lazy: lazyNames || [], urls: S.urls });
    return e;
  }
  function post(m) { if (!S.on) return false; try { S.w.postMessage(m); return true; } catch (e) { fail('post: ' + (e && e.message)); return false; } }
  const api = {
    start, compose, post,
    ok: () => S.on && !S.failed,
    set onResult(f) { onResult = f; }, set onFail(f) { onFail = f; },
    // a promise that settles on the worker's next message (the town step waits on it instead of spinning)
    next: () => new Promise(res => { if (!S.on) res(); else waiters.push(res); }),
    stats: () => Object.assign({ on: S.on, why: S.why, ready: S.ready, failed: S.failed, results: S.got, initMs: Math.round(S.initMs), composeMs: Math.round(S.composeMs) }, S.stats),
  };
  return api;
})();

if (typeof window !== 'undefined') window.HOUSE_WORKER = HOUSE_WORKER;
if (typeof module !== 'undefined' && module.exports) module.exports = { HW_V, HW_FILES, HW_LAZY, houseWorkerBody, houseWorkerSource, HOUSE_WORKER };
