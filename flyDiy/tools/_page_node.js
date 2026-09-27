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
//
//   const P = await openPage({ wip: 'default' | <build json text> | null, gfx: { preset: 'gamer', shadows: 'full' },
//                              query: '', hooks: { afterScript(name, P), beforeScript(name, P) } });
//   P.win            the page's window (the vm global)
//   P.rec            the recorder (calls, bytes, draws by phase)
//   await P.until(fn, maxMs)   run the page's clock until fn() is true (or maxMs of virtual time)
//   await P.frames(n)          run n animation frames
//   P.errors                   the page's uncaught errors and console.error lines
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const { makeGL, makeRecorder, THREE_SRC } = require('./_fake_gl.js');
const { makeDocument } = require('./_page_dom.js');
const ROOT = path.join(__dirname, '..');

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

  // ---- the clock -----------------------------------------------------------------------------------
  const clock = { t: 0, step: 0.01 };
  const EPOCH = Date.UTC(2026, 8, 27, 12, 0, 0);
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
    try { return fs.readFileSync(f); } catch (e) { return null; }
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
  const fetchFn = (url, o) => {
    const u = typeof url === 'string' ? url : (url && url.url) || String(url);
    fetched.push(u);
    const b = readFile(u);
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
      getImageData: (x, y, w, h) => imgData(w, h), createImageData: (w, h) => (typeof w === 'object' ? imgData(w.width, w.height) : imgData(w, h)),
      measureText: s => ({ width: String(s).length * 6, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(s).length * 6, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }),
      createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createConicGradient: () => ({ addColorStop() {} }), createPattern: () => ({ setTransform() {} }),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, invertSelf() { return this; }, multiplySelf() { return this; } }), isPointInPath: () => false, isPointInStroke: () => false, getLineDash: () => [],
      getContextAttributes: () => ({ alpha: true }),
    };
    return new Proxy(state, { get: (t, k) => k === 'canvas' ? cv : k in fns ? fns[k] : k in t ? t[k] : (typeof k === 'string' ? () => {} : undefined), set: (t, k, v) => { t[k] = v; return true; } });
  };
  let GLClass = null;
  const makeCanvasContext = (cv, kind, attrs) => {
    if (kind === '2d') return make2D(cv);
    if (kind === 'webgl2' || kind === 'webgl' || kind === 'experimental-webgl') {
      if (kind !== 'webgl2') return null;
      const G = makeGL({ rec, links: glLinks, canvas: cv, WebGL2RenderingContext: GLClass });
      return G.gl;
    }
    if (kind === 'bitmaprenderer') return { transferFromImageBitmap() {} };
    return null;
  };
  let onWrite = null;
  const D = makeDocument({ html, win, makeCanvasContext, loadImage, onWrite: s => onWrite && onWrite(s) });
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
  const writes = [];
  onWrite = s => { const m = /<script[^>]*src="([^"]+)"/.exec(s); if (m) writes.push(m[1].split('?')[0]); };

  // ---- the loop: the next timer or the next frame, on the virtual clock --------------------------------
  const flush = () => new Promise(r => setImmediate(r));
  let frameHook = null;
  const P = {
    win, ctx, rec, errors, logs, fetched, clock, glLinks, document, ran, scriptMs,
    get frameNo() { return frameNo; },
    onFrame(f) { frameHook = f; },
    // one event: the earliest due timer, or the next vsync if a frame was asked for and comes first
    async tick() {
      await flush();
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
    async frames(n) { const f0 = frameNo; await P.until(() => frameNo >= f0 + n, n * 1000 + 60000); return frameNo - f0; },
    pending: () => ({ timers: timers.length, raf: rafQ.length }),
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
