// _page_node.js - THE PAGE IN NODE (G1010, GATE FRAMECOST's harness).
//
// dev.html's own scripts, in the page's own order, in ONE vm context - the loading screen, the vendor three.js
// (r186, the real one), the island loader, the core, the models, the editor, app.js - over:
//   - a DOCUMENT (tools/_page_dom.js) holding dev.html's own body markup, so getElementById finds the page's ids;
//   - THE RECORDING WebGL2 (tools/_fake_gl.js makeGL + makeRecorder): every GL call counted, the uniform /
//     buffer / texture bytes, the draws by pass, the programs reflected off the linked GLSL (three uploads
//     exactly the uniforms a driver would give it);
//   - A VIRTUAL CLOCK: performance.now() moves 10 us a call and jumps to the next timer / frame; setTimeout,
//     setInterval, requestAnimationFrame are queued on it and run by the harness's own loop. Math.random is
//     seeded. Nothing waits on the machine: the same tree gives the same counts on every box, every run;
//   - THE DISK for fetch and for images (the served root is flyDiy/, as the page's relative URLs are).
// It is not a browser and draws nothing. Workers, IndexedDB, audio and the service worker are absent (the page
// takes its no-such-thing paths - the solver on the main thread, the bakes unkept). A navigator.webdriver RIG:
// the page's frame clock is G586's one-step-a-call rig clock and the graphics auto-scale stands down.
// ...EXCEPT THE WORKERS ASKED FOR (G815, C1b): `workers: RegExp` (or true: every Blob worker) gives the page a Worker
// whose Blob source matches - a node worker_threads thread running THAT source with importScripts off the disk, a fetch
// off the disk and the page's own message protocol (transfers included). Deterministic delivery: the thread's messages
// reach the page's onmessage only at the harness's turn boundaries (P.tick), and before each turn the harness WAITS
// until the thread has handled everything the page posted (an ack per message) - so a handler that answers
// synchronously (the physics host's lockstep `steps`) is answered before the next frame, run after run. What a thread
// does on its own clock (a fetch, its own timers) lands at the first boundary after it happened. A source that does not
// match gets the no-such-thing path it always got (`new Worker` throws; every caller in src/viewer catches it).
// G830 (C2a): `idb: <dir>` gives the worker threads a FAKE IndexedDB on that directory (a second page process finds what
// the first stored - GATE HOUSEWORKER's warm boot), and a worker handler that returns a PROMISE is acked when it settles.
// AND (AS3, G918, merged in train 17 beside G815):
// It is not a browser and draws nothing. IndexedDB, audio and the service worker are absent (the page takes its
// no-such-thing paths - the bakes unkept). A navigator.webdriver RIG: the page's frame clock is G586's
// one-step-a-call rig clock and the graphics auto-scale stands down.
// WORKERS (AS3, G918): a Worker made from a BLOB holding the Basis transcoder (three's KTX2Loader builds its
// transcoder worker that way; every other worker source still throws, as before) runs in its own vm context, its messages delivered both ways on the VIRTUAL clock's
// next turn, WebAssembly compiled SYNCHRONOUSLY there (a real async compile would land on a real-time turn and
// the counts would move run to run). opts.workers === false: no Worker at all (KTX2.off() then says so). The recording GL answers as a DESKTOP GPU for compressed textures (BC7 / BC1-3 / RGTC, what
// a Windows Chrome exposes): opts.gpuFormats = 'none' takes them away (the KTX2 path then stands down).
//
//   const P = await openPage({ wip: 'default' | <build json text> | null, gfx: { preset: 'gamer', shadows: 'full' },
//                              query: '', hooks: { afterScript(name, P), beforeScript(name, P) } });
//   P.win            the page's window (the vm global)
//   P.rec            the recorder (calls, bytes, draws by phase)
//   await P.until(fn, maxMs)   run the page's clock until fn() is true (or maxMs of virtual time)
//   await P.frames(n)          run n animation frames
//   P.errors                   the page's uncaught errors and console.error lines
//   opts.c2d = 'digest'        (G2220) the 2D canvases keep a digest of what they hold (tools/_c2d_digest.js)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const { makeGL, makeRecorder, THREE_SRC } = require('./_fake_gl.js');
const { makeDocument } = require('./_page_dom.js');
const ROOT = path.join(__dirname, '..');
// the compressed-texture extensions a Windows desktop Chrome exposes (AS3: KTX2Loader.detectSupport reads them)
// the one worker the node page runs: three's KTX2Loader.BasisWorker over basis_transcoder.js
const WORKER_OK = src => src.indexOf('KTX2File') >= 0 && src.indexOf('BASIS') >= 0;
const DESKTOP_TC = ['EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc', 'WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb'];

// ---- the page's script list: dev.html, in order -------------------------------------------------------
function pageScripts(file) {
  const html = fs.readFileSync(path.join(ROOT, file || 'dev.html'), 'utf8');
  const out = [], re = /<script([^>]*)>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) {
    const src = /\bsrc="([^"]+)"/.exec(m[1]);
    out.push({ deferred: /text\/x-flydiy/.test(m[1]), src: src ? src[1].split('?')[0] : null, code: src ? null : m[2] });
  }
  return { html, scripts: out };
}

// ---- image sizes off the bytes (PNG, JPEG, WebP, GIF) --------------------------------------------------
function imageSize(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0x47 && b[1] === 0x49) return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b[0] === 0x52 && b[8] === 0x57 && b[9] === 0x45) {   // RIFF....WEBP
    const t = b.toString('ascii', 12, 16);
    if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
    if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) { if (b[i] !== 0xff) { i++; continue; } const t = b[i + 1], L = b.readUInt16BE(i + 2);
      if (t >= 0xc0 && t <= 0xcf && t !== 0xc4 && t !== 0xc8 && t !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + L; }
  }
  return null;
}

// ---- THE WORKER SHIM (G815) --------------------------------------------------------------------------
// The thread's side: a worker-like global (self, importScripts, postMessage, onmessage, close, fetch off the disk)
// running the page's Blob source. Every page message is acked once its handler has returned; every message to the
// page goes through a MessageChannel the harness reads SYNCHRONOUSLY (receiveMessageOnPort), with a futex bump so the
// harness can sleep on it instead of spinning.
const WORKER_BOOT = `'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { root, src, port, sab, name, idb } = workerData;
// G830: THE FAKE IndexedDB (workerData.idb, a directory): one directory a store, one file a key (base64url of the key),
// the value through v8's structured serializer AT THE CALL (a put clones then, as IDB's does); every request answers on
// a later turn (setImmediate), a transaction completes after its last request. A second page process finds what the
// first stored. Enough of the API for src/viewer/house_worker.js: open / upgradeneeded, objectStoreNames.contains,
// createObjectStore, transaction(stores, mode).objectStore(n).get / put / delete / getAll / getAllKeys (a key range),
// IDBKeyRange.bound.
if (idb) {
  const v8 = require('v8');
  const fname = k => Buffer.from(String(k)).toString('base64url'), kname = f => Buffer.from(f, 'base64url').toString();
  const inR = (r, k) => !r || ((r.lower === undefined || k > r.lower || (k === r.lower && !r.lowerOpen)) && (r.upper === undefined || k < r.upper || (k === r.upper && !r.upperOpen)));
  const keysOf = (dir, r) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(kname).filter(k => inR(r, k)).sort();
  function Tx(names) {
    const tx = { oncomplete: null, onerror: null, onabort: null, error: null, _n: 0, _end: false };
    const done = () => { if (--tx._n === 0) setImmediate(() => { if (tx._n === 0 && !tx._end) { tx._end = true; if (tx.oncomplete) tx.oncomplete({ target: tx }); } }); };
    const req = fn => { const q = { result: undefined, error: null, onsuccess: null, onerror: null }; tx._n++;
      let v, err = null; try { v = fn(); } catch (e) { err = e; }
      setImmediate(() => { if (err) { q.error = err; if (q.onerror) q.onerror({ target: q }); } else { q.result = v; if (q.onsuccess) q.onsuccess({ target: q }); } done(); });
      return q; };
    tx.objectStore = n => { const dir = path.join(idb, n); return {
      // (structuredClone: v8.deserialize's typed arrays sit on node's Buffer memory, which a postMessage cannot transfer)
      get: k => { const f = path.join(dir, fname(k)); return req(() => (fs.existsSync(f) ? structuredClone(v8.deserialize(fs.readFileSync(f))) : undefined)); },
      put: (v, k) => { const b = v8.serialize(v); return req(() => { fs.writeFileSync(path.join(dir, fname(k)), b); return k; }); },
      delete: k => req(() => { fs.rmSync(path.join(dir, fname(k)), { force: true }); }),
      getAllKeys: r => req(() => keysOf(dir, r)),
      getAll: r => req(() => keysOf(dir, r).map(k => structuredClone(v8.deserialize(fs.readFileSync(path.join(dir, fname(k))))))),
      count: r => req(() => keysOf(dir, r).length),
      clear: () => req(() => { for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) fs.rmSync(path.join(dir, f), { force: true }); }),
    }; };
    setImmediate(() => { if (tx._n === 0 && !tx._end) { tx._end = true; if (tx.oncomplete) tx.oncomplete({ target: tx }); } });
    return tx;
  }
  const db = { name: 'fake', version: 1, close() {}, objectStoreNames: { contains: n => fs.existsSync(path.join(idb, n)) },
    createObjectStore: n => { fs.mkdirSync(path.join(idb, n), { recursive: true }); return {}; }, transaction: n => Tx(n) };
  globalThis.indexedDB = { open: () => { const q = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    setImmediate(() => { fs.mkdirSync(idb, { recursive: true }); if (q.onupgradeneeded) q.onupgradeneeded({ target: q, oldVersion: 0 }); if (q.onsuccess) q.onsuccess({ target: q }); }); return q; } };
  globalThis.IDBKeyRange = { bound: (lower, upper, lowerOpen, upperOpen) => ({ lower, upper, lowerOpen: !!lowerOpen, upperOpen: !!upperOpen }),
    lowerBound: (lower, open) => ({ lower, lowerOpen: !!open }), upperBound: (upper, open) => ({ upper, upperOpen: !!open }), only: k => ({ lower: k, upper: k }) };
}
const I32 = new Int32Array(sab);
const toFile = u => {
  u = String(u);
  if (/^[a-z]+:\\/\\//i.test(u)) { const x = new URL(u); u = x.pathname.replace(/^\\/flyDiy\\//, ''); }
  return path.join(root, decodeURIComponent(u.split('#')[0].split('?')[0]).replace(/^\\.?\\//, ''));
};
const send = (m, tr) => { try { port.postMessage(m, tr || []); } catch (e) { port.postMessage({ __error: 'postMessage: ' + (e && e.message) }); } Atomics.add(I32, 0, 1); Atomics.notify(I32, 0); };
globalThis.self = globalThis;
self.importScripts = (...urls) => { for (const u of urls) { const f = toFile(u); vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f }); } };
self.postMessage = (m, tr) => send({ m }, tr);
self.close = () => { send({ __closed: 1 }); setImmediate(() => process.exit(0)); };
self.onmessage = null;
globalThis.fetch = u => { let b = null; try { b = fs.readFileSync(toFile(typeof u === 'string' ? u : u.url)); } catch (e) {}
  return Promise.resolve(b ? new Response(b, { status: 200 }) : new Response('', { status: 404 })); };
process.on('uncaughtException', e => send({ __error: String(e && e.stack || e) }));
process.on('unhandledRejection', e => send({ __error: String(e && e.stack || e) }));
// G830: a handler that returns a promise (the house worker's init, its cache reads) is acked when it settles - the harness's
// turn then waits for the thread's whole answer, as it waits for a synchronous one
parentPort.on('message', d => {
  let r;
  try { if (typeof self.onmessage === 'function') r = self.onmessage({ data: d.m }); }
  catch (e) { send({ __error: String(e && e.stack || e) }); }
  if (r && typeof r.then === 'function') r.then(() => send({ __ack: d.seq }), e => { send({ __error: String(e && e.stack || e) }); send({ __ack: d.seq }); });
  else send({ __ack: d.seq });
});
try { vm.runInThisContext(src, { filename: name }); } catch (e) { send({ __error: String(e && e.stack || e) }); }
`;
// The page's side: the Worker class the page constructs. `live` collects every shim so the harness can drain them.
// G830: A MESSAGE LANDS IN THE PAGE'S REALM. receiveMessageOnPort builds it in this process's own realm, and the page is
// a vm context with intrinsics of its own: a Float32Array from the port is not `instanceof` the page's Float32Array,
// and three.js (WebGLAttributes) refuses it at the first draw ("Unsupported buffer data format") - in a browser the
// message is born in the page's realm. Every typed array in the message is re-viewed through the page's own
// constructor, on the SAME buffer (no copy, the transfer kept).
function toRealm(v, W, seen) {
  if (!v || typeof v !== 'object') return v;
  if (ArrayBuffer.isView(v)) { const C = W[v.constructor.name]; return (C && !(v instanceof C) && !(v instanceof DataView)) ? new C(v.buffer, v.byteOffset, v.length) : v; }
  seen = seen || new Set(); if (seen.has(v)) return v; seen.add(v);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = toRealm(v[i], W, seen); return v; }
  if (v instanceof Map) { for (const [k, x] of v) v.set(k, toRealm(x, W, seen)); return v; }
  if (v instanceof Set) return v;
  for (const k of Object.keys(v)) v[k] = toRealm(v[k], W, seen);
  return v;
}
function makeWorkerClass({ readBlob, allow, live, root, onEvent, postFilter, idb, realm }) {
  const WT = require('worker_threads');
  let nth = 0;
  return class Worker {
    constructor(url) {
      const src = readBlob(url);
      if (src == null || !(allow === true || (allow instanceof RegExp && allow.test(src)))) throw new Error('no worker here (the page-in-node harness)');
      const { port1, port2 } = new WT.MessageChannel();
      const sab = new SharedArrayBuffer(4);
      this._I = new Int32Array(sab); this._port = port1; this._sent = 0; this._acked = 0; this._dead = false;
      this._q = []; this._ls = { message: [], error: [] };
      this.onmessage = null; this.onerror = null;
      this.name = 'worker#' + (++nth);
      this._stats = { posted: 0, received: 0, waitedMs: 0, maxWaitMs: 0, errors: [] };
      this._w = new WT.Worker(WORKER_BOOT, { eval: true, workerData: { root, src, port: port2, sab, name: this.name, idb: idb || null }, transferList: [port2] });
      this._w.on('error', e => { this._q.push({ __error: String(e && e.stack || e) }); Atomics.add(this._I, 0, 1); });
      this._w.on('exit', () => { this._dead = true; });
      live.add(this);
    }
    postMessage(m, transfer) {
      if (this._dead) return;
      if (postFilter) { m = postFilter(this, m); if (m == null) return; }   // a gate's fault injection (G816 --selftest)
      this._sent++; this._stats.posted++;
      this._w.postMessage({ seq: this._sent, m }, transfer || []);
    }
    terminate() { if (this._dead) return; this._dead = true; live.delete(this); try { this._w.terminate(); } catch (e) {} }
    addEventListener(t, f) { (this._ls[t] = this._ls[t] || []).push(f); }
    removeEventListener(t, f) { if (this._ls[t]) this._ls[t] = this._ls[t].filter(x => x !== f); }
    // pull what the thread said; with `wait`, until every page message has been handled (at most maxMs, real time)
    _pull(wait, maxMs) {
      const t0 = Date.now();
      for (;;) {
        const seen = Atomics.load(this._I, 0);
        let r;
        while ((r = WT.receiveMessageOnPort(this._port))) {
          const d = r.message;
          if (d.__ack != null) this._acked = Math.max(this._acked, d.__ack);
          else this._q.push(d);
        }
        if (!wait || this._dead || this._acked >= this._sent) break;
        if (Date.now() - t0 > maxMs) { this._stats.errors.push('drain: no ack after ' + maxMs + ' ms'); break; }
        Atomics.wait(this._I, 0, seen, 20);
      }
      const w = Date.now() - t0; this._stats.waitedMs += w; if (w > this._stats.maxWaitMs) this._stats.maxWaitMs = w;
    }
    // deliver what was pulled, in order, to the page's handlers
    _deliver() {
      const q = this._q; this._q = [];
      for (const d of q) {
        if (d.__closed) { this._dead = true; live.delete(this); continue; }
        if (d.__error != null) {
          this._stats.errors.push(d.__error);
          const ev = { type: 'error', message: d.__error, error: new Error(d.__error) };
          if (typeof this.onerror === 'function') this.onerror(ev);
          for (const f of this._ls.error) f(ev);
          continue;
        }
        this._stats.received++;
        if (realm) toRealm(d.m, realm);   // G830
        const ev = { type: 'message', data: d.m, target: this };
        if (onEvent) onEvent(this, d.m);
        if (typeof this.onmessage === 'function') this.onmessage(ev);
        for (const f of this._ls.message) f(ev);
      }
    }
  };
}

// a seeded generator (mulberry32): the page's Math.random, the same stream every run
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function openPage(opts) {
  let CP = Promise;   // the page's own Promise once its context exists
  opts = opts || {};
  const hooks = opts.hooks || {};
  const rec = makeRecorder();
  const { html, scripts } = pageScripts(opts.page);
  const errors = [], logs = [];
  const quiet = opts.quiet !== false;
  const WORKER_WAIT_MS = opts.workerWaitMs || 120000;

  // ---- the clock -----------------------------------------------------------------------------------
  const clock = { t: 0, step: 0.01 };
  const EPOCH = opts.epoch || Date.UTC(2026, 8, 27, 12, 0, 0);   // (opts.epoch: another wall clock - a value the page bakes from the date shows as a different boot)
  const timers = []; let tseq = 0; let rafQ = [], rafSeq = 0; let frameNo = 0;
  const FRAME = 1000 / 60;
  const now = () => (clock.t += clock.step);
  const addTimer = (fn, ms, args, every) => { const id = ++tseq; timers.push({ id, at: clock.t + Math.max(0, +ms || 0), fn, args, every, seq: id }); return id; };
  const clearTimer = id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); };

  // ---- the window ------------------------------------------------------------------------------------
  const store = () => { const m = new Map(); return { getItem: k => (m.has(String(k)) ? m.get(String(k)) : null), setItem: (k, v) => m.set(String(k), String(v)), removeItem: k => m.delete(String(k)),
    clear: () => m.clear(), key: i => [...m.keys()][i] || null, get length() { return m.size; }, _m: m }; };
  // an ORDINARY global object (no interceptors): the page's globals are plain properties - a contextified sandbox
  // routes every global read (Math, THREE, a core function) through an interceptor, 10-100x slower in the solver
  const win = vm.createContext(vm.constants.DONT_CONTEXTIFY);
  CP = win.Promise;
  const blobs = new Map(); let blobN = 0;
  const readFile = url => {
    url = String(url);
    if (url.startsWith('blob:')) { const b = blobs.get(url); return b ? Buffer.from(b._bytes) : null; }
    if (url.startsWith('data:')) { const i = url.indexOf(','); const meta = url.slice(5, i); return /;base64/.test(meta) ? Buffer.from(url.slice(i + 1), 'base64') : Buffer.from(decodeURIComponent(url.slice(i + 1))); }
    if (/^[a-z]+:\/\//i.test(url)) { const u = new URL(url); if (u.hostname !== 'localhost') return null; url = u.pathname.replace(/^\/flyDiy\//, ''); }
    const rel = decodeURIComponent(url.split('#')[0].split('?')[0]).replace(/^\.?\//, '');
    const f = path.join(ROOT, rel);
    // PAGE_FALLBACK=<repo root> (LOAD-COMPILE G1085): a worktree has none of the gitignored data (assets/*); a path
    // missing here is read from that checkout's flyDiy/, as tools/_serve.js --fallback serves it to the browser
    try { return fs.readFileSync(f); } catch (e) { if (!process.env.PAGE_FALLBACK) return null; try { return fs.readFileSync(path.join(process.env.PAGE_FALLBACK, 'flyDiy', rel)); } catch (e2) { return null; } }
  };
  class Blob {
    constructor(parts, o) { const bufs = (parts || []).map(p => typeof p === 'string' ? Buffer.from(p) : p instanceof Blob ? p._bytes : ArrayBuffer.isView(p) ? Buffer.from(p.buffer, p.byteOffset, p.byteLength) : Buffer.from(p));
      this._bytes = Buffer.concat(bufs); this.type = (o && o.type) || ''; this.size = this._bytes.length; }
    arrayBuffer() { const b = this._bytes; return CP.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
    text() { return CP.resolve(this._bytes.toString('utf8')); }
    stream() { return { _blob: this, pipeThrough: ds => ({ _blob: this, _ds: ds }) }; }
    slice(a, b) { const x = new Blob([]); x._bytes = this._bytes.subarray(a, b); x.size = x._bytes.length; return x; }
  }
  class Response {
    constructor(body, init) {
      let bytes = body == null ? Buffer.alloc(0) : body._ds ? (body._ds.gz ? zlib.gunzipSync(body._blob._bytes) : body._blob._bytes) : body instanceof Blob ? body._bytes : typeof body === 'string' ? Buffer.from(body) : ArrayBuffer.isView(body) ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : Buffer.from(body);
      this._bytes = bytes; this.status = (init && init.status) || 200; this.ok = this.status >= 200 && this.status < 300; this.headers = { get: () => null, has: () => false };
    }
    arrayBuffer() { const b = this._bytes; return CP.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
    text() { return CP.resolve(this._bytes.toString('utf8')); }
    json() { try { return CP.resolve(JSON.parse(this._bytes.toString('utf8'))); } catch (e) { return CP.reject(e); } }
    blob() { return CP.resolve(new Blob([this._bytes])); }
    clone() { return new Response(this._bytes, { status: this.status }); }
    get body() { return { _blob: new Blob([this._bytes]), pipeThrough: ds => ({ _blob: new Blob([this._bytes]), _ds: ds }), getReader: () => { let done = false; return { read: () => CP.resolve(done ? { done: true } : (done = true, { done: false, value: new Uint8Array(this._bytes) })), cancel() {}, releaseLock() {} }; } }; }
  }
  const fetched = [];
  // G912 (AS2): WHAT THE PAGE READ AND DECODED, counted (GATE FRAMECOST reports them per boot step, never ratchets
  // them): fetch / XHR / Image loads and their on-disk bytes (the wire), and the 2D canvas's drawImage / getImageData /
  // putImageData - the CPU packing the ground library moved offline
  const io = { fetches: 0, fetchBytes: 0, imgLoads: 0, imgBytes: 0, c2dDraw: 0, c2dRead: 0, c2dReadBytes: 0, c2dPut: 0, workerMsgs: 0 };
  const fetchFn = (url, o) => {
    const u = typeof url === 'string' ? url : (url && url.url) || String(url);
    fetched.push(u);
    const b = readFile(u);
    io.fetches++; if (b) io.fetchBytes += b.length;
    if (!b) return CP.resolve(new Response('', { status: 404 }));
    return CP.resolve(new Response(b, { status: 200 }));
  };
  // XMLHttpRequest, off the disk: app.js reads the premises fixture SYNCHRONOUSLY at its own evaluation (a missing XHR is a
  // premises-less world, caught and silent); an async one lands on the clock's next turn
  class XMLHttpRequest {
    constructor() { this.readyState = 0; this.status = 0; this.responseType = ''; this.response = null; this.responseText = ''; this._ls = {}; }
    open(m, url, async) { this._url = String(url); this._async = async !== false; this.readyState = 1; }
    setRequestHeader() {} overrideMimeType() {} abort() {} getAllResponseHeaders() { return ''; } getResponseHeader() { return null; }
    addEventListener(t, f) { (this._ls[t] = this._ls[t] || []).push(f); } removeEventListener() {}
    send() {
      const done = () => {
        fetched.push(this._url);
        const b = readFile(this._url);
        io.fetches++; if (b) io.fetchBytes += b.length;
        this.readyState = 4; this.status = b ? 200 : 404;
        if (b) { this.responseText = this.responseType === '' || this.responseType === 'text' ? b.toString('utf8') : '';
          this.response = this.responseType === 'arraybuffer' ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : this.responseType === 'json' ? JSON.parse(b.toString('utf8')) : this.responseText; }
        const ev = { type: b ? 'load' : 'error', target: this };
        for (const k of ['onreadystatechange', b ? 'onload' : 'onerror', 'onloadend']) if (typeof this[k] === 'function') this[k](ev);
        for (const f of (this._ls[ev.type] || []).concat(this._ls.loadend || [])) f.call(this, ev);
      };
      if (this._async) addTimer(done, 0); else done();
    }
  }
  // images: loaded off the disk on the clock's next turn (a task, as a browser's decode lands)
  const loadImage = (img, url) => {
    img.complete = false;
    const b = readFile(url);
    io.imgLoads++; if (b) io.imgBytes += b.length;
    addTimer(() => {
      const s = b && imageSize(b);
      if (!s) { img.complete = true; img.dispatchEvent(new D.Event('error')); return; }
      img.naturalWidth = img.width = s.w; img.naturalHeight = img.height = s.h; img.complete = true;
      img.dispatchEvent(new D.Event('load'));
    }, 0);
    img._decode = () => new CP((res, rej) => addTimer(() => (b && imageSize(b) ? res() : rej(new Error('decode'))), 1));
  };
  // canvases: 2D is a context that draws nothing (and reads back zeros); WebGL is the recording context
  const glLinks = [];
  const make2D = cv => {
    const state = { fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', globalAlpha: 1, lineWidth: 1, textAlign: 'start', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over', imageSmoothingEnabled: true, filter: 'none' };
    const imgData = (w, h) => ({ width: w | 0, height: h | 0, data: new Uint8ClampedArray(Math.max(0, (w | 0) * (h | 0) * 4)), colorSpace: 'srgb' });
    const fns = {
      getImageData: (x, y, w, h) => { io.c2dRead++; io.c2dReadBytes += Math.max(0, (w | 0) * (h | 0) * 4); return imgData(w, h); },
      drawImage: () => { io.c2dDraw++; }, putImageData: () => { io.c2dPut++; }, createImageData: (w, h) => (typeof w === 'object' ? imgData(w.width, w.height) : imgData(w, h)),
      measureText: s => ({ width: String(s).length * 6, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(s).length * 6, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }),
      createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createConicGradient: () => ({ addColorStop() {} }), createPattern: () => ({ setTransform() {} }),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, invertSelf() { return this; }, multiplySelf() { return this; } }), isPointInPath: () => false, isPointInStroke: () => false, getLineDash: () => [],
      getContextAttributes: () => ({ alpha: true }),
    };
    return new Proxy(state, { get: (t, k) => k === 'canvas' ? cv : k in fns ? fns[k] : k in t ? t[k] : (typeof k === 'string' ? () => {} : undefined), set: (t, k, v) => { t[k] = v; return true; } });
  };
  let GLClass = null;
  const makeCanvasContext = (cv, kind, attrs) => {
    // G2220: opts.c2d 'digest' - a 2D context that keeps what each canvas holds (tools/_c2d_digest.js; GATE PARKED 11's atlas)
    if (kind === '2d') return opts.c2d === 'digest' ? require('./_c2d_digest.js').make(cv, io) : make2D(cv);
    if (kind === 'webgl2' || kind === 'webgl' || kind === 'experimental-webgl') {
      if (kind !== 'webgl2') return null;
      const G = makeGL({ rec, links: glLinks, canvas: cv, WebGL2RenderingContext: GLClass, extraExts: opts.gpuFormats === 'none' ? [] : DESKTOP_TC });
      return G.gl;
    }
    if (kind === 'bitmaprenderer') return { transferFromImageBitmap() {} };
    return null;
  };
  let onWrite = null, onLazy = null;
  // a script the page loads ON DEMAND (build.js MANIFEST.lazy, the page's FLYDIY_LAZY - G909: marked data-lazy) runs
  // off the disk on the next timer, then its onload; any other appended script stays inert, as it always was here
  const onScript = el => { const src = el.getAttribute && el.getAttribute('src'); if (src && el.getAttribute('data-lazy') && onLazy) onLazy(el, src); };
  const D = makeDocument({ html, win, makeCanvasContext, loadImage, onWrite: s => onWrite && onWrite(s), onScript });
  const document = D.document;
  const location = { search: opts.query ? '?' + opts.query.replace(/^\?/, '') : '', hash: '', pathname: '/flyDiy/dev.html', hostname: 'localhost', host: 'localhost', port: '', protocol: 'http:',
    origin: 'http://localhost', reload() {}, assign() {}, replace() {} };
  location.href = location.origin + location.pathname + location.search;
  const navigator = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 flydiy-node', webdriver: true, language: 'en-GB', languages: ['en-GB', 'en'],
    platform: 'Linux x86_64', hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 0, onLine: true, cookieEnabled: true, vendor: 'Google Inc.',
    getGamepads: () => [], sendBeacon: () => true, clipboard: { writeText: () => CP.resolve(), readText: () => CP.resolve('') }, mediaDevices: undefined,
    userActivation: { isActive: false, hasBeenActive: false }, storage: { estimate: () => CP.resolve({ usage: 0, quota: 1e9 }), persist: () => CP.resolve(false), persisted: () => CP.resolve(false) } };
  const noopClass = class { constructor() {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  class PerformanceObserver extends noopClass {} PerformanceObserver.supportedEntryTypes = [];
  const mathSeed = seeded(opts.seed || 0x5eed);
  Object.assign(win, {
    console: quiet ? { log: (...a) => logs.push(a.join(' ')), info: (...a) => logs.push(a.join(' ')), debug() {}, warn: (...a) => logs.push('warn: ' + a.map(x => x && x.message || x).join(' ')), error: (...a) => { errors.push(a.map(x => x && x.stack || x && x.message || String(x)).join(' ')); }, trace() {}, group() {}, groupEnd() {}, groupCollapsed() {}, table() {}, time() {}, timeEnd() {}, assert() {}, count() {} } : console,
    document, location, navigator, history: { replaceState() {}, pushState() {}, back() {}, state: null, length: 1 },
    localStorage: store(), sessionStorage: store(),
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, orientation: { type: 'landscape-primary', angle: 0, addEventListener() {} } },
    innerWidth: opts.width || 1920, innerHeight: opts.height || 1080, outerWidth: opts.width || 1920, outerHeight: opts.height || 1080, devicePixelRatio: 1, scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0,
    performance: { now, timeOrigin: EPOCH, mark() {}, measure() {}, getEntriesByType: () => [], getEntriesByName: () => [], clearMarks() {}, clearMeasures() {}, setResourceTimingBufferSize() {}, memory: undefined },
    Date: (() => { const RD = win.Date; class VD extends RD { constructor(...a) { if (a.length) super(...a); else super(EPOCH + Math.floor(clock.t)); } static now() { return EPOCH + Math.floor(clock.t); } } return VD; })(),
    setTimeout: (fn, ms, ...a) => addTimer(fn, ms, a, 0), clearTimeout: clearTimer,
    setInterval: (fn, ms, ...a) => addTimer(fn, ms, a, Math.max(1, +ms || 0)), clearInterval: clearTimer,
    requestAnimationFrame: fn => { const id = ++rafSeq; rafQ.push({ id, fn }); return id; },
    cancelAnimationFrame: id => { rafQ = rafQ.filter(r => r.id !== id); },
    requestIdleCallback: fn => addTimer(() => fn({ didTimeout: false, timeRemaining: () => 8 }), 1, [], 0), cancelIdleCallback: clearTimer,
    queueMicrotask: fn => { CP.resolve().then(fn); },
    fetch: fetchFn, XMLHttpRequest, Response, Blob, File: class extends Blob { constructor(p, n, o) { super(p, o); this.name = n; } },
    Headers: class { constructor() { this.m = new Map(); } get(k) { return this.m.get(k) || null; } set(k, v) { this.m.set(k, v); } has(k) { return this.m.has(k); } },
    Request: class { constructor(u) { this.url = String(u); } },
    DecompressionStream: class { constructor(f) { this.gz = f === 'gzip'; } }, CompressionStream: undefined,
    URL: Object.assign(function (u, b) { return new URL(u, b || location.href); }, { createObjectURL: b => { const u = 'blob:flydiy/' + (++blobN); blobs.set(u, b); return u; }, revokeObjectURL: u => { blobs.delete(u); } }),
    URLSearchParams, TextDecoder, TextEncoder, AbortController, AbortSignal, structuredClone,
    atob: s => Buffer.from(String(s), 'base64').toString('binary'), btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(mathSeed() * 256); return a; }, randomUUID: () => 'f1d10000-0000-4000-8000-' + String(++blobN).padStart(12, '0'), subtle: undefined },
    Image: function Image(w, h) { const e = document.createElement('img'); if (w) e.width = w; if (h) e.height = h; return e; },
    ImageData: class { constructor(a, w, h) { if (typeof a === 'number') { this.width = a; this.height = w; this.data = new Uint8ClampedArray(a * w * 4); } else { this.data = a; this.width = w; this.height = h || a.length / 4 / w; } } },
    ImageBitmap: class {}, Path2D: class { constructor() {} addPath() {} moveTo() {} lineTo() {} closePath() {} rect() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} ellipse() {} roundRect() {} },
    DOMMatrix: class { constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; } },
    createImageBitmap: (src) => CP.resolve({ width: (src && (src.width || src.naturalWidth)) || 1, height: (src && (src.height || src.naturalHeight)) || 1, close() {} }),
    matchMedia: q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null }),
    getComputedStyle: el => { const s = el && el.style; return new Proxy({}, { get: (t, k) => k === 'getPropertyValue' ? (p => (s && s.getPropertyValue(p)) || '') : (s && typeof k === 'string' && s[k]) || (k === 'display' ? 'block' : k === 'width' || k === 'height' ? '0px' : '') }); },
    ResizeObserver: noopClass, MutationObserver: noopClass, IntersectionObserver: noopClass, PerformanceObserver,
    Event: D.Event, CustomEvent: D.CustomEvent, EventTarget: D.EventTarget, KeyboardEvent: D.Event, MouseEvent: D.Event, PointerEvent: D.Event, WheelEvent: D.Event, FocusEvent: D.Event, TouchEvent: D.Event, UIEvent: D.Event, InputEvent: D.Event,
    HTMLElement: D.Element, Element: D.Element, Node: D.Node, Text: D.Text, HTMLCanvasElement: D.HTMLCanvasElement, HTMLImageElement: D.HTMLImageElement, DocumentFragment: D.DocumentFragment, HTMLVideoElement: class {}, SVGElement: D.Element,
    alert() {}, confirm: () => true, prompt: () => null, open: () => null, close() {}, focus() {}, blur() {}, print() {}, scrollTo() {}, scrollBy() {}, postMessage() {}, getSelection: () => document.getSelection(),
    isSecureContext: true, origin: location.origin, name: '', closed: false, frames: [], length: 0, opener: null, visualViewport: null, speechSynthesis: undefined,
  });
  // G815: the Worker shim, only where asked (opts.workers: a RegExp the Blob source must match, or true)
  const workersLive = new Set();
  // ---- WORKERS from blobs (AS3, G918): their own context, messages on the virtual clock, WebAssembly synchronous --
  const syncWasm = Object.assign(Object.create(WebAssembly), {
    instantiate: (b, imports) => { try { if (b instanceof WebAssembly.Module) return Promise.resolve(new WebAssembly.Instance(b, imports));
      const module = new WebAssembly.Module(b); return Promise.resolve({ module, instance: new WebAssembly.Instance(module, imports) }); } catch (e) { return Promise.reject(e); } },
    compile: b => { try { return Promise.resolve(new WebAssembly.Module(b)); } catch (e) { return Promise.reject(e); } },
    instantiateStreaming: undefined, compileStreaming: undefined });
  class BasisWorker {
    constructor(url) {
      const u = String(url), b = u.startsWith('blob:') ? readFile(u) : null;
      // ONLY the Basis transcoder's worker: every other page worker (parked.js's decimation, the sim worker, the bench)
      // throws here as the absent Worker threw before AS3, and takes its main-thread path exactly as it did
      if (!b || opts.workers === false || !(opts.workerOk || WORKER_OK)(b.toString('utf8'))) throw new Error('Worker: ' + u + ' is not available in the node page');
      const ls = this._ls = {}, wls = {}, self = this;
      this.onmessage = null; this.onerror = null; this._dead = false;
      const g = vm.createContext(vm.constants.DONT_CONTEXTIFY);
      Object.assign(g, { console: win.console, WebAssembly: syncWasm, TextDecoder, TextEncoder, URL: win.URL, Blob, performance: win.performance,
        setTimeout: win.setTimeout, clearTimeout: win.clearTimeout, location: { href: location.href, origin: location.origin },
        addEventListener: (t, f) => { (wls[t] = wls[t] || []).push(f); }, removeEventListener: (t, f) => { if (wls[t]) wls[t] = wls[t].filter(x => x !== f); },
        postMessage: (data) => { io.workerMsgs++; addTimer(() => { if (self._dead) return; const ev = { data, target: self };
          if (typeof self.onmessage === 'function') self.onmessage(ev); for (const f of (ls.message || []).slice()) f.call(self, ev); }, 0); } });
      g.self = g; g.globalThis = g;
      this._deliver = data => { if (this._dead) return; const ev = { data, target: g };
        try { if (typeof g.onmessage === 'function') g.onmessage(ev); for (const f of (wls.message || []).slice()) f.call(g, ev); }
        catch (e) { errors.push('worker: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); } };
      try { vm.runInContext(b.toString('utf8'), g, { filename: 'worker:' + u }); }
      catch (e) { errors.push('worker ' + u + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
    }
    postMessage(data) { io.workerMsgs++; addTimer(() => this._deliver(data), 0); }
    addEventListener(t, f) { (this._ls[t] = this._ls[t] || []).push(f); }
    removeEventListener(t, f) { if (this._ls[t]) this._ls[t] = this._ls[t].filter(x => x !== f); }
    terminate() { this._dead = true; }
  }
  win.WebAssembly = WebAssembly;
  // TRAIN 17: ONE Worker for the page, two shims behind it - a Blob holding the Basis transcoder runs in AS3's vm
  // context on the virtual clock (always, unless opts.workers === false); any other Blob runs on G815's threads only
  // where the gate asked for it (opts.workers: a RegExp its source must match, or true); the rest throws, as before
  const Threaded = opts.workers ? makeWorkerClass({ root: ROOT, allow: opts.workers, live: workersLive, onEvent: opts.onWorkerMessage || null, postFilter: opts.workerPostFilter || null, idb: opts.idb || null, realm: win,
      readBlob: url => { const b = readFile(url); return b ? b.toString('utf8') : null; } }) : null;
  function PageWorker(url) {
    const u = String(url), b = u.startsWith('blob:') ? readFile(u) : null, src = b ? b.toString('utf8') : null;
    if (src != null && (opts.workerOk || WORKER_OK)(src)) return new BasisWorker(url);
    if (Threaded) return new Threaded(url);
    throw new Error('Worker: ' + u + ' is not available in the node page');
  }
  if (opts.workers !== false) win.Worker = PageWorker;
  // the one WebGL2 class every context of the page is an instance of
  { const G0 = makeGL({}); GLClass = G0.WebGL2RenderingContext; win.WebGL2RenderingContext = GLClass; }
  win.window = win; win.self = win; win.top = win; win.parent = win; win.frameElement = null;
  // window as an event target (resize, keydown, pagehide ...): the listeners are kept, never fired by the harness
  const WL = {}; win.addEventListener = (t, f) => { (WL[t] = WL[t] || []).push(f); }; win.removeEventListener = (t, f) => { if (WL[t]) WL[t] = WL[t].filter(x => x !== f); };
  win.dispatchEvent = ev => { for (const f of (WL[ev.type] || []).slice()) f.call(win, ev); return true; };
  if (opts.storage) for (const [k, v] of Object.entries(opts.storage)) win.localStorage.setItem(k, v);
  const ctx = win;
  win.Math.random = mathSeed;
  win.onerror = null;

  // ---- running scripts ----------------------------------------------------------------------------------
  const ran = [], scriptMs = {};
  const run = (code, name) => {
    if (hooks.beforeScript) hooks.beforeScript(name, P);
    const w0 = Date.now(); try { vm.runInContext(code, ctx, { filename: name }); ran.push(name); }
    catch (e) { errors.push('script ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e)); }
    scriptMs[name] = Date.now() - w0;
    if (hooks.afterScript) hooks.afterScript(name, P);
  };
  const runFile = rel => { const b = readFile(rel); if (!b) { errors.push('script ' + rel + ': 404'); return; } run(rel === 'vendor/three.min.js' ? THREE_SRC : b.toString('utf8'), rel); };
  onLazy = (el, src) => addTimer(() => { const rel = src.split('?')[0]; const ok = !!readFile(rel); if (ok) runFile(rel); const f = ok ? el.onload : el.onerror; if (typeof f === 'function') f.call(el, { type: ok ? 'load' : 'error', target: el }); }, 1);
  const writes = [];
  onWrite = s => { const m = /<script[^>]*src="([^"]+)"/.exec(s); if (m) writes.push(m[1].split('?')[0]); };

  // ---- the loop: the next timer or the next frame, on the virtual clock --------------------------------
  const flush = () => new Promise(r => setImmediate(r));
  let frameHook = null;
  const P = {
    win, ctx, rec, errors, logs, fetched, clock, glLinks, document, ran, scriptMs, io,
    get frameNo() { return frameNo; },
    onFrame(f) { frameHook = f; },
    // one event: the earliest due timer, or the next vsync if a frame was asked for and comes first
    async tick() {
      await flush();
      if (workersLive.size) { for (const w of [...workersLive]) w._pull(true, WORKER_WAIT_MS); for (const w of [...workersLive]) w._deliver(); await flush(); }
      let ti = -1;
      for (let i = 0; i < timers.length; i++) if (ti < 0 || timers[i].at < timers[ti].at || (timers[i].at === timers[ti].at && timers[i].seq < timers[ti].seq)) ti = i;
      const nextVsync = (Math.floor(clock.t / FRAME) + 1) * FRAME;
      if (rafQ.length && (ti < 0 || nextVsync <= timers[ti].at)) {
        clock.t = Math.max(clock.t, nextVsync);
        const q = rafQ; rafQ = []; frameNo++;
        if (frameHook) frameHook('start', frameNo);
        for (const r of q) { try { r.fn(clock.t); } catch (e) { errors.push('frame: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); } }
        await flush();
        if (frameHook) frameHook('end', frameNo);
        return 'frame';
      }
      if (ti < 0) return 'idle';
      const T = timers[ti];
      clock.t = Math.max(clock.t, T.at);
      if (T.every) { T.at = clock.t + T.every; T.seq = ++tseq; } else timers.splice(ti, 1);
      try { typeof T.fn === 'function' ? T.fn(...(T.args || [])) : vm.runInContext(String(T.fn), ctx); } catch (e) { errors.push('timer: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
      await flush();
      return 'timer';
    },
    async until(cond, maxMs) {
      const t0 = clock.t;
      while (!cond()) { if (clock.t - t0 > (maxMs || 600000)) return false; const k = await P.tick(); if (k === 'idle') { await flush(); if (!cond() && !rafQ.length && !timers.length) return cond(); } }
      return true;
    },
    // G821 (C1c): the workers' answers so far, delivered NOW (every page message handled, what came back handed to the
    // page) - a gate's event between two frames then meets what the page would meet in a browser, where the worker's
    // answer to a frame lands long before a click: the answer to the last frame, not the one before it
    async settleWorkers() { if (!workersLive.size) return; for (const w of [...workersLive]) w._pull(true, WORKER_WAIT_MS); for (const w of [...workersLive]) w._deliver(); await flush(); },
    async frames(n) { const f0 = frameNo; await P.until(() => frameNo >= f0 + n, n * 1000 + 60000); return frameNo - f0; },
    pending: () => ({ timers: timers.length, raf: rafQ.length }),
    // G815: the shim's threads (their counters: posted, received, the harness's waits on them, their errors)
    workers: () => [...workersLive].map(w => Object.assign({ name: w.name }, w._stats)),
    close() { for (const w of [...workersLive]) w.terminate(); },
  };

  // ---- the page, in its order ----------------------------------------------------------------------------
  const deferred = [];
  for (const s of scripts) {
    if (s.deferred) { deferred.push(s); continue; }
    if (s.code && /querySelectorAll\('script\[type="text\/x-flydiy"\]'\)/.test(s.code)) continue;   // the promoter: the harness runs the list itself, below
    if (s.src) runFile(s.src); else run(s.code, 'inline#' + scripts.indexOf(s));
    while (writes.length) runFile(writes.shift());
  }
  // FLYDIY_BOOT: the island's bytes (the loader's fetches resolve at once off the disk)
  let booted = false, bootErr = null;
  if (win.FLYDIY_BOOT && typeof win.FLYDIY_BOOT.then === 'function') win.FLYDIY_BOOT.then(() => { booted = true; }, e => { bootErr = e; booted = true; });
  else booted = true;
  for (let i = 0; i < 200 && !booted; i++) await flush();
  if (bootErr) errors.push('FLYDIY_BOOT: ' + (bootErr && bootErr.message));
  for (const s of deferred) { if (s.src) runFile(s.src); else run(s.code, 'inline#' + scripts.indexOf(s)); await flush(); }
  return P;
}
module.exports = { openPage, pageScripts, imageSize };
