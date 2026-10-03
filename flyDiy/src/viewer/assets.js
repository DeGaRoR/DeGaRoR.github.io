// assets.js — the ONE way the page fetches an external binary asset.
//
// Since 2026-09-01 geometry lives as .bin files under media/geo/ (and
// textures as images under media/tex/), so somebody has to own the fetch, the
// cache and the failure story. This is that somebody: everything that wants
// bytes (app.js's MODEL_LOAD, props.js's propWarm, whatever the world grows
// next) calls ASSET_FETCH and nothing else touches the network.
//
// The contract:
//   ASSET_FETCH(url) -> Promise<Uint8Array>. Two callers racing for one URL
//   share one request. A failed fetch REJECTS and stays cached as the
//   rejection: hammering a missing file with retries would just turn one 404
//   into thirty. Callers degrade the way this project already degrades a
//   missing payload — the thing is absent, not the page broken.
//   THE BYTES ARE THE CALLER'S ONCE DELIVERED (AS1, G907). The map held every
//   fetched Uint8Array for the life of the page, so the consumers' own
//   `BINS.delete` after a decode (props.js, animals.js, app.js MODEL_DECODE)
//   freed nothing: every bin stayed in the heap next to its decoded arrays.
//   A settled fetch now leaves the map. Each bin URL has ONE consumer (436
//   files, 436 keys), and each consumer keeps its own answer for the page's
//   life (PROP_WARMS / PROP_BUILT, the animals' WARMS / BUILT, MODEL_LOAD's
//   loadCache, the trees' WARM + BINS), so no asset is fetched twice; a
//   second ask of a released URL would fetch again (the service worker's
//   media cache answers it), never fail.
//
// URLs arrive ALREADY prefixed: the baked manifests resolve
// FLYDIY_ASSET_BASE at their own eval (tools/_media_lib.js BASE_DECL), so
// what reaches here is fetchable as-is from the page's own location.
//
// Node note: the gates never load this file — they read the same .bin files
// through tools/_media_lib.js readGeo (fs + the same gunzip) and hand the
// bytes to the codecs directly. If this ever runs where
// fetch is missing, every call rejects and every consumer takes its
// asset-absent path, which is the honest degradation.
//
// GEOMETRY ARRIVES GZIPPED (G930, AS5a). GitHub Pages sends a .bin raw, so
// every file under media/geo/ is ONE gzip stream named `<stem>.<h8>.gz.bin`
// (tools/_media_lib.js says why the name carries the transport). The suffix
// decides, never a sniff of the bytes: a `.gz.bin` body goes through the
// platform's DecompressionStream (the world pack's decoder, build.js
// ISLAND_LOADER) and callers get the AS-IS bytes the baker hashed - the same
// Uint8Array, off/len and all, the codecs read before. A browser without
// DecompressionStream rejects, which is the asset-absent path every caller
// already has (such a browser cannot boot the island either).
//
// ASSET_FETCH_FRESH(url) is the same fetch and decode with no cache, for the
// one caller that retries past a cached rejection (tools/_cage_char.js).
//
// A FLAT MAP IS A NUMBER (G903, AS0b). A baked map whose every channel is a
// constant (std < 2 at 256 px, the asset census's FLAT_STD) ships as that
// constant: the material record holds [r, g, b] (0-255, the map's mean)
// where the path was, and no file exists. TEX_FLAT(rgb, colorSpace) is the
// texture for it: ONE 1x1 DataTexture per (colour, colour space), shared by
// every material that binds it. The consumer binds it in the slot the file
// went to, so the shader, the program and the look are the ones the file
// gave (the GPU sampled that same mean everywhere) - 4 bytes instead of up
// to 21 MiB (the seven white 2048^2 char specular maps). A consumer tells a
// constant from a path with Array.isArray, locally - so a gate's stub context
// that never meets a flat map needs nothing from here. Shared: a consumer may
// set wrap / repeat / anisotropy on it (a constant does not care), never
// write its pixel.
(() => {
  'use strict';
  const FLAT = new Map();   // 'r,g,b|cs' -> THREE.DataTexture
  function texFlat(rgb, colorSpace) {
    const key = rgb.slice(0, 3).join(',') + '|' + (colorSpace || '');
    let t = FLAT.get(key);
    if (t) return t;
    t = new THREE.DataTexture(new Uint8Array([rgb[0], rgb[1], rgb[2], 255]), 1, 1, THREE.RGBAFormat);
    if (colorSpace) t.colorSpace = colorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.name = 'flat:' + key;
    t.userData.flat = rgb.slice(0, 3);   // the constant, for a consumer that re-packs maps (house_tarr.js)
    t.needsUpdate = true;
    FLAT.set(key, t);
    return t;
  }
  const G = typeof window !== 'undefined' ? window : globalThis;
  G.TEX_FLAT = texFlat;
})();
(() => {
  'use strict';
  const BUFS = new Map();   // url -> Promise<Uint8Array>
  const GZ_BIN = /\.gz\.bin$/;
  function load(url) {
    if (typeof fetch !== 'function')
      return Promise.reject(new Error('asset fetch: no fetch() here for ' + url));
    return fetch(url).then(r => {
      if (!r.ok) throw new Error('asset fetch: ' + url + ' -> ' + r.status);
      if (!GZ_BIN.test(url)) return r.arrayBuffer();
      if (typeof DecompressionStream !== 'function' || !r.body)
        throw new Error('asset fetch: no DecompressionStream here for ' + url);
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }).then(b => new Uint8Array(b));
  }
  function assetFetch(url) {
    let p = BUFS.get(url);
    if (p) return p;
    p = load(url);
    // a rejected promise with no local catch would print an unhandled-
    // rejection per consumer; one silent tap keeps the console readable while
    // every real caller still sees (and reports) the rejection itself
    p.catch(() => {});
    BUFS.set(url, p);
    p.then(() => { if (BUFS.get(url) === p) BUFS.delete(url); }, () => {});   // delivered: the caller keeps it (G907)
    return p;
  }
  if (typeof window !== 'undefined') { window.ASSET_FETCH = assetFetch; window.ASSET_FETCH_FRESH = load; }
})();
// GPU_ONLY_GEO(geometry) - G1200 (MEM-DIET): A GEOMETRY THAT IS ONLY DRAWN GIVES ITS CPU COPY BACK ONCE UPLOADED. Each
// attribute's (and the index's) array is swapped for an empty one of its type in three's onUploadCallback: the bytes
// live on the GPU, `count` (a stored property) still draws them, the bounds are computed first (frustum culling and
// Box3.setFromObject read those, never the array). ONLY for a geometry nothing reads again on the CPU - no raycast, no
// physics, no terrainH, no merge or re-sink from it, never re-uploaded (a rebuild makes a NEW geometry) - the textures'
// gpuOnly rule (render_world.js G907) for geometry. One renderer draws the world (app.js), so one upload is the only one.
// ?gpuonly=0 keeps every copy (the A/B).
// GPU_ONLY_GEO.flush(renderer) - G1230 (MEM-BUDGET): UPLOAD AS YOU BUILD. A draw-only geometry gave its bytes back at
// its first draw - first light, the end of the load - so every copy the world built was held through the whole load
// (the peak). flush() uploads the ones still waiting NOW: each drawn once by a stand-in mesh (the same geometry, a plain
// material, no culling) into a 1x1 target with its draw range at 0 - three's own path uploads every attribute (the
// render list's objects.update) and the index (the binding setup) and draws nothing; the release above then runs. The
// world's build calls it as each slice ends (app.js buildWorldSliced, the town step). ?geoflush=0: as before (the A/B).
(() => {
  'use strict';
  const off = typeof location !== 'undefined' && /[?&]gpuonly=0(?:&|$)/.test(location.search || '');
  const stats = { geos: 0, bytes: 0, flushed: 0, flushes: 0 };
  const noFlush = typeof location !== 'undefined' && /[?&]geoflush=0(?:&|$)/.test(location.search || '');
  const PEND = new Set();
  function release() { const a = this.array; if (a && a.length) { stats.bytes += a.byteLength; this.array = new a.constructor(0); } }
  function gpuOnlyGeo(g) {
    if (off || !g || !g.attributes) return g;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingBox) g.computeBoundingBox();
    for (const k in g.attributes) { const a = g.attributes[k]; if (a && !a.isInterleavedBufferAttribute && a.onUpload) a.onUpload(release); }
    if (g.index && g.index.onUpload) g.index.onUpload(release);
    stats.geos++;
    if (!noFlush) { PEND.add(g); g.addEventListener('dispose', () => PEND.delete(g)); }
    return g;
  }
  const waiting = g => { const p = g.attributes.position; return !!(p && p.array && p.array.length); };
  let FL = null;
  function flush(renderer) {
    if (!PEND.size || !renderer || typeof renderer.render !== 'function' || typeof THREE === 'undefined' || !THREE.WebGLRenderTarget) return 0;
    const list = [...PEND].filter(waiting); PEND.clear();
    if (!list.length) return 0;
    if (!FL) { FL = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), rt: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }),
                      mat: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }) };
                FL.scene.matrixWorldAutoUpdate = false; }
    const keep = list.map(g => [g, g.drawRange.start, g.drawRange.count]), meshes = [];
    for (const g of list) { g.setDrawRange(0, 0); const m = new THREE.Mesh(g, FL.mat); m.frustumCulled = false; m.matrixAutoUpdate = false; FL.scene.add(m); meshes.push(m); }
    const rt0 = renderer.getRenderTarget(), ac = renderer.autoClear, ie = renderer.info ? renderer.info.autoReset : true;
    try {
      renderer.autoClear = false; if (renderer.info) renderer.info.autoReset = false;
      renderer.setRenderTarget(FL.rt); renderer.render(FL.scene, FL.cam);
    } catch (e) { if (typeof console !== 'undefined') console.warn('geometry flush:', e && e.message); }
    finally {
      renderer.setRenderTarget(rt0); renderer.autoClear = ac; if (renderer.info) renderer.info.autoReset = ie;
      for (const m of meshes) FL.scene.remove(m);
      for (const [g, s0, c0] of keep) g.setDrawRange(s0, c0);
    }
    stats.flushes++; stats.flushed += list.length;
    return list.length;
  }
  gpuOnlyGeo.stats = stats;
  gpuOnlyGeo.flush = flush;
  if (typeof window !== 'undefined') window.GPU_ONLY_GEO = gpuOnlyGeo;
})();
