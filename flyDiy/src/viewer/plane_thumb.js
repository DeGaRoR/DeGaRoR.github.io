// G3800 PLANE_THUMB (the user, 2 Nov: "what we need now is mostly a VIGNETTE"; A0 3 Nov: the cards' side profile): the
// aeroplane's SIDE PROFILE, the nose to the left, level on its gear as it stands, on the garage studio's dark ground -
// the picture a plane card shows (240 x 120, drawn at 120 x 60 css).
//   PLANE_THUMB.get(key)        -> an image URL or null (null: the card draws its glyph). Keys: 'mine:<save name>' (the
//                                  player's builds, drawn by this page), anything else a baked file under media/thumbs/
//   PLANE_THUMB.saved(name)     the garage saved / loaded <name>: drawn once the page is still, if the stand still shows it
// LIVE_DRAW OFF (A0 4 Nov, L31c): the first draw froze the page 6.1 s on L31b (perf-week list), so saved() does nothing and
// 'mine:' keys read null (the player's own planes keep their glyph); the baked pictures stay. true below turns it back on.
// THE DRAW: the game's own renderer, one orthographic eye from the aeroplane's left (plane_shot.js's profile, ported),
// every visible mesh outside the aeroplane hidden for that one render (the room, the floor, the props), the scene's
// background a radial studio gradient, the fog pushed out of reach (never removed: a define), the shadow map as it is (not redrawn). Rendered into a corner of the
// page's own drawing buffer (no resize, no render target, no readback stall of its own) and copied out in the same task;
// the next frame draws over it. Kept in prefs per save name with the build's hash: an edit redraws it.
'use strict';
(function () {
  const LIVE_DRAW = false;
  const W = 240, H = 120, SS = 2, FILL = 0.9, BG0 = '#2b2724', BG1 = '#0a0908';
  const PREF = 'flydiy.thumb.', BAKED = 'media/thumbs/';
  const cache = new Map();   // key -> url (the session's)
  let bgTex = null, pending = null, bakedLoading = false;
  const tell = key => { try { window.dispatchEvent(new CustomEvent('plane-thumb', { detail: { key } })); } catch (e) {} };
  function loadBaked() {
    if (bakedLoading || typeof fetch !== 'function') return;
    bakedLoading = true;
    fetch(BAKED + 'index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({}))
      .then(j => { api.baked = (j && j.thumbs) || {}; tell('*'); });
  }
  const prefs = () => { try { return window.localStorage; } catch (e) { return null; } };
  // a cheap stable hash of the spec (the cache key: an edited build redraws)
  function hashOf(spec) {
    let s; try { s = JSON.stringify(spec); } catch (e) { return ''; }
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36) + '.' + s.length.toString(36);
  }
  function studioBg(THREE) {
    if (bgTex) return bgTex;
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128, 54, 0, 128, 64, 160);
    gr.addColorStop(0, BG0); gr.addColorStop(1, BG1); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    bgTex = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) bgTex.colorSpace = THREE.SRGBColorSpace;
    return bgTex;
  }
  // the draw: returns a webp/png data URL, or null when the garage is not showing an aeroplane
  function draw() {
    const THREE = window.THREE, P = window.FLIGHT_PROBE, root = window.CAGE_UI_SCENE;
    if (!THREE || !P || !P.renderer || !root) return null;
    const R = P.renderer(), S = P.hangarScene && P.hangarScene(), cam0 = P.camera && P.camera();
    if (!R || !S || !root.parent) return null;
    const t0 = performance.now();
    root.updateMatrixWorld(true);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const fwd = V(0, 0, 1).transformDirection(root.parent.matrixWorld); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) return null;
    fwd.normalize();
    const up = V(0, 1, 0), left = V().crossVectors(up, fwd).normalize();
    // the drawn points' extents along the nose, the left and up (a few hundred a mesh)
    const ext = { f: [1e9, -1e9], l: [1e9, -1e9], u: [1e9, -1e9] }, p = V(), mine = new Set();
    root.traverseVisible(m => {
      mine.add(m);
      const pa = m.isMesh && m.geometry && m.geometry.attributes && m.geometry.attributes.position; if (!pa) return;
      const step = Math.max(1, Math.floor(pa.count / 200));
      for (let i = 0; i < pa.count; i += step) {
        p.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
        const f = p.dot(fwd), l = p.dot(left), u = p.dot(up);
        if (f < ext.f[0]) ext.f[0] = f; if (f > ext.f[1]) ext.f[1] = f;
        if (l < ext.l[0]) ext.l[0] = l; if (l > ext.l[1]) ext.l[1] = l;
        if (u < ext.u[0]) ext.u[0] = u; if (u > ext.u[1]) ext.u[1] = u;
      }
    });
    if (ext.f[0] > ext.f[1]) return null;
    const len = k => Math.max(0.1, ext[k][1] - ext[k][0]), mid = k => (ext[k][0] + ext[k][1]) / 2;
    const cc = V().addScaledVector(fwd, mid('f')).addScaledVector(left, mid('l')).addScaledVector(up, mid('u'));
    const w = W * SS, h = H * SS, s = Math.min(w * FILL / len('f'), h * FILL / len('u'));
    // the eye: from the left, just outside the span (the far plane past the right tip: nothing of the room behind)
    const half = len('l') / 2 + 0.5;
    const cam = new THREE.OrthographicCamera(-w / (2 * s), w / (2 * s), h / (2 * s), -h / (2 * s), 0.05, 2 * half + 1);
    cam.position.copy(cc).addScaledVector(left, half + 0.5); cam.up.copy(up); cam.lookAt(cc);
    if (cam0) cam.layers.mask = cam0.layers.mask;
    if (typeof window.UI_LAYER !== 'undefined' && window.UI_LAYER.blind) window.UI_LAYER.blind(cam);
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    // the page's drawing buffer must hold the frame (a phone's is far larger than 480 x 240)
    const buf = R.getDrawingBufferSize(new THREE.Vector2()), pr = R.getPixelRatio();
    const ss = buf.x >= w && buf.y >= h ? SS : 1, rw = W * ss, rh = H * ss;
    if (buf.x < rw || buf.y < rh) return null;
    // the room out for one render: every visible mesh not the aeroplane's
    const hid = [];
    S.traverseVisible(o => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && !mine.has(o)) { o.visible = false; hid.push(o); } });
    const bg = S.background, fog = S.fog, au = R.shadowMap.autoUpdate, rt = R.getRenderTarget();
    let fogR = null;
    const vp = R.getViewport(new THREE.Vector4()), sc = R.getScissor(new THREE.Vector4()), st = R.getScissorTest();
    let url = null;
    try {
      // NO FOG BY ITS RANGE, NOT BY null (PLANE-RENDERS R1, 7 Nov): fog is a program define (USE_FOG), so taking the fog away
      // recompiled every material in the scene for this one render and again on the next frame - the reading of L31b's
      // 6.1 s first draw. Out of reach, it is uniforms only
      if (fog && fog.isFog) { fogR = [fog.near, fog.far]; fog.near = 1e8; fog.far = 1e9; }
      else if (fog && fog.isFogExp2) { fogR = [fog.density]; fog.density = 0; }
      S.background = studioBg(THREE); R.shadowMap.autoUpdate = false;
      R.setRenderTarget(null);
      // viewport / scissor are in css px (the renderer multiplies by its pixel ratio): the bottom-left corner
      R.setViewport(0, 0, rw / pr, rh / pr); R.setScissor(0, 0, rw / pr, rh / pr); R.setScissorTest(true);
      R.render(S, cam);
      const out = document.createElement('canvas'); out.width = W; out.height = H;
      const g = out.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      // the drawing buffer's bottom-left corner is the canvas element's bottom rows
      g.drawImage(R.domElement, 0, buf.y - rh, rw, rh, 0, 0, W, H);
      url = out.toDataURL('image/webp', 0.86);
      if (!/^data:image\/webp/.test(url)) url = out.toDataURL('image/png');
    } finally {
      for (const o of hid) o.visible = true;
      if (fogR && fog.isFog) { fog.near = fogR[0]; fog.far = fogR[1]; } else if (fogR) fog.density = fogR[0];
      S.background = bg; R.shadowMap.autoUpdate = au;
      R.setRenderTarget(rt); R.setViewport(vp); R.setScissor(sc); R.setScissorTest(st);
    }
    api.lastMs = +(performance.now() - t0).toFixed(1);
    return url;
  }
  function store(name, h, url) {
    cache.set('mine:' + name, url);
    const L = prefs(); if (!L) return;
    try { L.setItem(PREF + 'mine:' + name, JSON.stringify({ h, url })); } catch (e) {}   // quota: the session's cache only
  }
  function standHash() { try { return hashOf((window.GARAGE_SPEC && GARAGE_SPEC.get()) || null); } catch (e) { return ''; } }
  const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 6000 }) : setTimeout(fn, 400));
  // the stand's drawn aeroplane, cheaply: its meshes and their vertices (a rebuild spread over frames changes it)
  function standSig() {
    const root = window.CAGE_UI_SCENE; if (!root) return '';
    let n = 0, v = 0; root.traverseVisible(m => { const pa = m.isMesh && m.geometry && m.geometry.attributes && m.geometry.attributes.position; if (pa) { n++; v += pa.count; } });
    return n + ':' + v;
  }
  // STILL: two idle moments ~0.6 s apart with the same drawn aeroplane (a load's rebuild is over), then fn
  function whenStill(fn, tries) {
    idle(() => { const a = standSig(); setTimeout(() => idle(() => {
      const b = standSig();
      if (a && a === b) fn(); else if ((tries || 0) < 8) whenStill(fn, (tries || 0) + 1);
    }), 600); });
  }
  const api = {
    lastMs: null,
    // the garage saved (or loaded) <name>, now on the stand: one draw once the page is still (a save never waits on it);
    // nothing when the stored picture's hash is this build's
    saved(name, spec) {
      if (!LIVE_DRAW || !name) return;
      const h = hashOf(spec || (window.GARAGE_SPEC && GARAGE_SPEC.get()));
      const L = prefs(); let old = null;
      try { old = L && JSON.parse(L.getItem(PREF + 'mine:' + name) || 'null'); } catch (e) {}
      if (old && old.h === h && old.url) { cache.set('mine:' + name, old.url); return; }
      pending = { name, h };
      whenStill(() => {
        const q = pending; pending = null; if (!q) return;
        if (standHash() !== q.h) return;            // the stand changed under it: drawn the next time it is saved / loaded
        let url = null; try { url = draw(); } catch (e) { url = null; }
        if (url) { store(q.name, q.h, url); tell('mine:' + q.name); }
      });
    },
    // the card's picture: a URL, or null (the card's glyph)
    get(key) {
      if (!key) return null;
      if (cache.has(key)) return cache.get(key);
      if (key.startsWith('mine:')) {
        if (!LIVE_DRAW) return null;                // a stored picture could be stale with no redraw: the glyph
        const L = prefs(); let v = null;
        try { v = L && JSON.parse(L.getItem(PREF + key) || 'null'); } catch (e) {}
        const url = v && v.url || null; cache.set(key, url); return url;
      }
      // the bake's pictures ('stock:<name>', 'cand:<file stem>', 'design:<id>', 'arch:<key>'): its index fetched once, on the first ask;
      // the cards hear 'plane-thumb' (key '*') when it lands and draw again
      if (api.baked == null) { loadBaked(); return null; }
      const f = api.baked[key];
      return f ? BAKED + f : null;
    },
    forget(name) { cache.delete('mine:' + name); const L = prefs(); try { L && L.removeItem(PREF + 'mine:' + name); } catch (e) {} },
    baked: null,   // { key: file } from media/thumbs/index.json (the bake), loaded at boot
    draw, hashOf,
  };
  window.PLANE_THUMB = api;
})();
