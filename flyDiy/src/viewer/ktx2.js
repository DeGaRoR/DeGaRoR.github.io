// ===========================================================================
// KTX2 / BASIS UNIVERSAL IN THE PAGE (G917, AS3) - futureDesigns/ASSETS-2026-09-27.md §5.3 M8
// ===========================================================================
// A KTX2 file is a Basis Universal texture (ETC1S or UASTC) with its mips inside. The page does not decode it: three's
// KTX2Loader (vendor/ktx2/ktx2_loader.js, three@0.186, tools/vendor_three.js) hands the bytes to the Basis TRANSCODER
// running in WEB WORKERS (vendor/ktx2/basis_transcoder.js + .wasm), which rewrites the blocks into the compressed
// format this GPU samples natively (BC7 on a desktop, ASTC / ETC2 on a phone, BC1-3 where BC7 is missing). What
// comes back is already GPU-ready: no Image decode, no RGBA copy, no mip generation on the main thread, and a
// quarter of the GPU memory of the RGBA8 texture it replaces (1 B/texel instead of 4 x 4/3 with mips).
//
// LAZY AND UP FRONT. Nothing here loads at page load: the first KTX2 asked for (the shed's props, in the garage's boot;
// the ground library in the roll-out's world step - both under the loading screen, which waits for them) appends the
// loader (FLYDIY_LAZY's map, build.js MANIFEST.lazy) and starts the workers, which fetch the transcoder. The transcodes
// run beside the main thread while the screen is up; the workers stay for a later grow (a road of a new class).
//
// THE FALLBACK. KTX2.off() names why the page will NOT take this path, and every caller then loads what it loaded
// before AS3 (the ground: the raw cooked layers): ?ktx2=0 in the URL (the A/B switch: the old images, for the eye),
// localStorage flydiy.ktx2 = '0', no Worker, no WebAssembly, no renderer yet, or a GPU with no compressed format three
// can target (a transcode to RGBA32 would cost more than the old path). A file that fails to fetch or transcode also
// sends its caller back to the old path (GROUND_LIB: the whole pack, never a half-compressed array).
//
// PER FAMILY, FOR THE EYE: ?ktx2=ground,pier takes the KTX2 path for those families only (the rest load their old
// images) - the look-check's A/B one family at a time (HANDOVER G919). The families: ground (the splat's and the
// pavement's arrays), pier, props (the shed kit).
//
//   KTX2.off(family)      -> null, or the reason (a string); without a family: the page-wide reasons only
//   KTX2.parse(bytes, family) -> Promise<{ mipmaps: [{ data, width, height }], width, height, format, type }> (one
//                            layer; rejects on any failure; the bytes are transferred)
//   KTX2.load(url, family) -> the same, fetched (ASSET_FETCH) and transcoded ONCE per url for the page
//   KTX2.stats()          -> { files, bytes, failed, fallbacks, target, off, workers }
'use strict';
const KTX2 = (() => {
  const stats = { files: 0, bytes: 0, failed: 0, fallbacks: 0, target: null, off: null, workers: 0 };
  const EXTS = ['EXT_texture_compression_bptc', 'WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc'];
  let loader = null, pending = null;
  function off(family) {
    if (typeof window === 'undefined') return 'no window';
    const q = (typeof location !== 'undefined' && location.search) || '';
    if (/[?&]ktx2=0(?:&|$)/.test(q)) return 'ktx2=0';
    const only = /[?&]ktx2=([a-z,]+)(?:&|$)/.exec(q);
    if (only && family && only[1].split(',').indexOf(family) < 0) return 'ktx2=' + only[1] + ' (not ' + family + ')';
    try { if (localStorage.getItem('flydiy.ktx2') === '0') return 'flydiy.ktx2 = 0'; } catch (e) {}
    if (typeof Worker !== 'function') return 'no Worker';
    if (typeof WebAssembly !== 'object' || !WebAssembly) return 'no WebAssembly';
    const R = window.FLYDIY_RENDERER;
    if (!R || !R.extensions || typeof R.extensions.has !== 'function') return 'no renderer';
    if (!EXTS.some(e => R.extensions.has(e))) return 'no compressed texture format';
    return null;
  }
  const BASE = () => (typeof FLYDIY_ASSET_BASE !== 'undefined' ? FLYDIY_ASSET_BASE : '');
  // the loader's script, once: through the page's on-demand map when it has one (the versioned URL), else a tag
  function script() {
    if (typeof THREE !== 'undefined' && THREE.KTX2Loader) return Promise.resolve(true);
    if (typeof FLYDIY_LAZY === 'function' && typeof FLYDIY_LAZY_SRC !== 'undefined' && FLYDIY_LAZY_SRC.ktx2_loader) return FLYDIY_LAZY('ktx2_loader').then(r => !!r[0]);
    return new Promise(res => {
      const s = document.createElement('script'); s.async = false; s.setAttribute('data-lazy', 'ktx2_loader');
      s.onload = () => res(true); s.onerror = () => res(false);
      s.src = BASE() + 'vendor/ktx2/ktx2_loader.js'; s.setAttribute('src', s.src);
      (document.body || document.head).appendChild(s);
    });
  }
  function ready() {
    if (pending) return pending;
    pending = script().then(ok => {
      if (!ok || typeof THREE === 'undefined' || !THREE.KTX2Loader) throw new Error('ktx2: the loader did not load');
      const L = new THREE.KTX2Loader();
      L.setTranscoderPath(BASE() + 'vendor/ktx2/');
      stats.workers = Math.max(1, Math.min(4, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1));
      L.setWorkerLimit(stats.workers);
      L.detectSupport(window.FLYDIY_RENDERER);
      return (loader = L);
    });
    pending.catch(() => {});
    return pending;
  }
  // one file -> its transcoded mip chain. The bytes are TRANSFERRED to a worker (the caller's copy is gone after).
  function parse(bytes, family) {
    const why = off(family);
    if (why) { stats.off = why; return Promise.reject(new Error('ktx2 off: ' + why)); }
    return ready().then(L => new Promise((res, rej) => {
      const buf = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
      const n = buf.byteLength;
      L.parse(buf, t => {
        if (!t || !t.mipmaps || !t.mipmaps.length || t.isCompressedArrayTexture || (t.image && t.image.depth > 1)) { stats.failed++; rej(new Error('ktx2: not a single-layer texture')); return; }
        stats.files++; stats.bytes += n;
        stats.target = stats.target || t.format;
        res({ mipmaps: t.mipmaps, width: t.image.width, height: t.image.height, format: t.format, type: t.type });
        t.mipmaps = []; t.dispose();
      }, e => { stats.failed++; rej(e instanceof Error ? e : new Error('ktx2: ' + e)); });
    }));
  }
  // ONE TRANSCODE PER URL for the page (two maps whose twins fold to one file - tools/ktx2_twins.js - ask for the same
  // url; the bytes are transferred to a worker, so a second parse of the same fetch would find them gone). A failure is
  // not kept: the next ask tries again.
  const LOADS = new Map();
  function load(url, family) {
    let p = LOADS.get(url);
    if (p) return p;
    p = (typeof ASSET_FETCH === 'function' ? ASSET_FETCH(url) : Promise.reject(new Error('ktx2: no ASSET_FETCH'))).then(b => parse(b, family));
    LOADS.set(url, p);
    p.catch(() => { if (LOADS.get(url) === p) LOADS.delete(url); });
    return p;
  }
  return { off, parse, load, ready, stats: () => Object.assign({}, stats, { off: off() }), _stats: stats };
})();
if (typeof window !== 'undefined') window.KTX2 = KTX2;
