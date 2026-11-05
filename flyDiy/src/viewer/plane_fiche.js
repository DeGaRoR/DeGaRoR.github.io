// AIRCRAFT-BOARD PLANE_FICHE (the user, 4 Nov: "the full fiche could be generated and awarded on passed certification"): the
// pictures and the data of an aeroplane's fiche, drawn once in the garage's own page, kept with the plane. The page that
// shows it, the award's moment and the share are Game's (flydiy-notes/PLAN-AIRCRAFT-BOARD-2026-11-04.md).
//   PLANE_FICHE.award(name, title) the stand's plane, on the airworthiness certificate: refused without one ("candidates don't get
//                                 a fiche without the certificate"), nothing drawn when the stored fiche is this build's
//   PLANE_FICHE.generate(opts)    the draw itself: { name, title (shown; else the name), store (false: no IndexedDB), only: [views], onView(view, i, n) } -> the record
//   PLANE_FICHE.get(name)         -> { name, at, fp, hash, data, pics: { view: Blob } } or null
//   PLANE_FICHE.stale(rec)        -> { cert, paint }: the mark's two reasons; the fiche itself stays ("a plane having received
//                                 one does not lose it"): only forget() removes it, and a new one replaces it only once drawn
//   PLANE_FICHE.forget(name)      the plane was deleted
// THE VIEWS: hero (below), above (the user 4 Nov: "a 3/4 top view so we can see all the plane. An inverse hero shot if you will",
// whole, wings on), cutaway (near half: skin and wings off), side / plan / front (orthographic, one scale, for the dimension lines).
// THE DRAW: the game's renderer and scene, into one render target flagged as display-space (aa_resolve.js's rule: tone map and
// sRGB as on the canvas, so the page's programs are reused), each view on black and on white: the difference is the
// background's share, the black draw over alpha the colour (exact for an anti-aliased edge and for glass), cropped to the silhouette.
'use strict';
(function () {
  const DB = 'flydiy-fiches', STORE = 'fiche', Q = 0.85, FOV = 22, FIT = 0.94, SAMPLES = 4;
  const HERO_W = 1200, HERO_H = 960, CUT_W = 1000, CUT_H = 800, ORTHO = 900, PAD = 12;
  // an eye from above: the garage's overhead lights wash a top surface out (5 Nov, measured on the twin and the Tiger Moth: room at 20-50 % brings its colour back, the reflection changes nothing)
  const STUDIO = { key: 1.5, rim: 1.8, room: 1 }, CUT_STUDIO = { key: 1.0, rim: 0.5, amb: 0.3, room: 0.35 };
  const NEAR_OFF = ['wing', 'wing2', 'brace', 'light', 'hinge', 'access'];   // the cutaway's near half also loses these (the user 4 Nov: NEAR WINGS OFF)
  const VIEWS = ['hero', 'above', 'side', 'plan', 'front', 'cutaway'];
  const frames = n => new Promise(res => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : res()); f(); });
  function hashOf(spec) {
    let s; try { s = JSON.stringify(spec); } catch (e) { return ''; }
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36) + '.' + s.length.toString(36);
  }
  const fpNow = () => { try { return window.BENCH_FP ? window.BENCH_FP() : null; } catch (e) { return null; } };
  const specNow = () => { try { return window.GARAGE_SPEC ? window.GARAGE_SPEC.get() : null; } catch (e) { return null; } };
  // ---- the store: Blobs in a database of its own (localStorage's quota would not hold twenty) -------------------------
  function open() {
    return new Promise((res, rej) => {
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = () => { q.result.createObjectStore(STORE, { keyPath: 'name' }); };
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
  async function tx(mode, fn) {
    const db = await open();
    try {
      return await new Promise((res, rej) => {
        const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE));
        t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error);
      });
    } finally { db.close(); }
  }
  // ---- the matte: pure, on two RGBA rows-bottom-up buffers of the same draw -------------------------------------------
  function matte(k, wt, w, h) {
    const bgD = Math.max(1, ((wt[0] - k[0]) + (wt[1] - k[1]) + (wt[2] - k[2])) / 3);   // a corner: all background
    const d = new Uint8ClampedArray(w * h * 4);
    let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < h; y++) {
      const row = (h - 1 - y) * w * 4;
      for (let x = 0; x < w; x++) {
        const i = row + x * 4, o = (y * w + x) * 4;
        const A = 255 * (1 - ((wt[i] - k[i]) + (wt[i + 1] - k[i + 1]) + (wt[i + 2] - k[i + 2])) / 3 / bgD);
        if (A < 2) continue;
        const a = Math.min(255, A), f = 255 / a;
        d[o] = k[i] * f; d[o + 1] = k[i + 1] * f; d[o + 2] = k[i + 2] * f; d[o + 3] = a;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++;
      }
    }
    return { d, n, x0, y0, x1, y1, edge: !!n && (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) };
  }
  function encode(m, w, h) {
    const c = document.createElement('canvas'); c.width = m.x1 - m.x0 + 1; c.height = m.y1 - m.y0 + 1;
    c.getContext('2d').putImageData(new ImageData(m.d, w, h), -m.x0, -m.y0);
    return new Promise(res => c.toBlob(b => res({ blob: b, w: c.width, h: c.height }), 'image/webp', Q));
  }
  // ---- the eye -----------------------------------------------------------------------------------------------------
  // the drawn points (a few hundred a mesh) and the aeroplane's own axes, its air attitude
  function frameOf(T, root) {
    root.updateMatrixWorld(true);
    const box = new T.Box3(), gb = new T.Box3(), pts = [], p = new T.Vector3();
    root.traverseVisible(m => {
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
      gb.copy(g.boundingBox).applyMatrix4(m.matrixWorld); box.union(gb);
    });
    const c = box.getCenter(new T.Vector3());
    root.traverseVisible(m => {
      const pa = m.isMesh && m.geometry && m.geometry.attributes && m.geometry.attributes.position; if (!pa) return;
      const step = Math.max(1, Math.floor(pa.count / 300));
      for (let i = 0; i < pa.count; i += step) pts.push(p.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld).clone().sub(c));
    });
    const fwd = new T.Vector3(0, 0, 1).transformDirection(root.parent.matrixWorld); fwd.y = 0; fwd.normalize();
    const up = new T.Vector3(0, 1, 0), left = new T.Vector3().crossVectors(up, fwd).normalize();
    const ext = { f: [1e9, -1e9], l: [1e9, -1e9], u: [1e9, -1e9] };
    for (const q of pts) for (const [k, ax] of [['f', fwd], ['l', left], ['u', up]]) { const v = q.dot(ax); if (v < ext[k][0]) ext[k][0] = v; if (v > ext[k][1]) ext[k][1] = v; }
    const len = k => Math.max(0.1, ext[k][1] - ext[k][0]), mid = k => (ext[k][0] + ext[k][1]) / 2;
    const cc = c.clone().addScaledVector(fwd, mid('f')).addScaledVector(left, mid('l')).addScaledVector(up, mid('u'));
    return { c, cc, pts, fwd, up, left, len };
  }
  // the lens, the distance that holds every drawn point, the target moved to centre what is seen
  function heroCam(T, F, aspect, yawD, elD) {
    const yaw = yawD * Math.PI / 180, el = elD * Math.PI / 180, { c, pts, fwd, up, left } = F;
    const d = fwd.clone().multiplyScalar(Math.cos(yaw) * Math.cos(el)).addScaledVector(left, Math.sin(yaw) * Math.cos(el)).addScaledVector(up, Math.sin(el)).normalize();
    const cam = new T.PerspectiveCamera(FOV, aspect, 0.05, 2000);
    const tt = Math.tan(FOV * Math.PI / 360), tv = tt * FIT, th = tv * aspect;
    let t = c.clone(), D = 1;
    for (let it = 0; it < 3; it++) {
      cam.position.copy(t).addScaledVector(d, 10); cam.up.copy(up); cam.lookAt(t); cam.updateMatrixWorld(true);
      const rx = new T.Vector3(1, 0, 0).transformDirection(cam.matrixWorld), ry = new T.Vector3(0, 1, 0).transformDirection(cam.matrixWorld);
      const off = c.clone().sub(t); D = 0;
      for (const p0 of pts) { const p = p0.clone().add(off), z = p.dot(d); D = Math.max(D, z + Math.abs(p.dot(rx)) / th, z + Math.abs(p.dot(ry)) / tv); }
      cam.position.copy(t).addScaledVector(d, D); cam.lookAt(t); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
      for (const p0 of pts) { const q = p0.clone().add(c).project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      t.addScaledVector(rx, (x0 + x1) / 2 * tt * aspect * D).addScaledVector(ry, (y0 + y1) / 2 * tt * D);
    }
    cam.position.copy(t).addScaledVector(d, D); cam.lookAt(t);
    return cam;
  }
  function orthoCam(T, F, from, camUp, w, h, s) {
    const cam = new T.OrthographicCamera(-w / (2 * s), w / (2 * s), h / (2 * s), -h / (2 * s), 0.05, 2000);
    cam.position.copy(F.cc).addScaledVector(from, 80); cam.up.copy(camUp); cam.lookAt(F.cc);
    return cam;
  }
  // ---- the cutaway's state: the see-inside build, the near half clipped on clones (a cached material is the next build's) ------
  // THE CLONE TRAP (proved 4 Nov, the twin's white wing): Material.clone() drops onBeforeCompile, how the finishes and liveries reach the shader
  const dup = m => {
    const u = m.userData; m.userData = {}; const c = m.clone(); m.userData = u; c.userData = u;
    c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey;
    if (m.defines) c.defines = Object.assign({}, m.defines);
    return c;
  };
  // the skin's inner face is not metal (a metal back face has only its reflections: black)
  function innerFace(c, m) {
    const ob = c.onBeforeCompile, k0 = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    c.onBeforeCompile = function (s, r) {
      if (ob) ob.call(this, s, r);
      s.fragmentShader = s.fragmentShader.replace('#include <lights_physical_fragment>', 'if (!gl_FrontFacing) { metalnessFactor = min(metalnessFactor, 0.15); roughnessFactor = max(roughnessFactor, 0.7); }\n#include <lights_physical_fragment>');
    };
    c.customProgramCacheKey = () => k0 + '|ficheInner';
  }
  async function stable(T, root) {
    const box = () => { const b = new T.Box3().setFromObject(root); return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].join(); };
    let pb = null;
    for (let i = 0; i < 20; i++) { await frames(3); const bb = box(); if (bb === pb) return; pb = bb; }
  }
  function cutOn(T, R, root, S) {
    const V = window.CAGE_VIEW, st = { mats: [], clones: [], hid: [], added: [] };
    root.updateMatrixWorld(true);
    const F = frameOf(T, root), { c, fwd, left, up } = F, cl = c.dot(left);
    const fus = root.children.find(o => o.isMesh);   // the cut's width: this plane's own fuselage
    let hw = 0.6;
    if (fus) { const s0 = new T.Box3().setFromObject(fus).getSize(new T.Vector3()); hw = (Math.abs(left.x) * s0.x + Math.abs(left.z) * s0.z) / 2 + 0.06; }
    const p1 = new T.Plane(left.clone().negate(), cl), p2 = new T.Plane(left.clone(), -(cl + hw)), made = new Map();
    const swap = (o, fn) => {
      const arr = Array.isArray(o.material), ms = arr ? o.material : [o.material]; let ch = false;
      const nm = ms.map(mt => { const n = mt ? fn(mt) : null; if (n) { ch = true; return n; } return mt; });
      if (ch) { st.mats.push([o, o.material]); o.material = arr ? nm : nm[0]; }
    };
    const halve = m => { const n = dup(m); st.clones.push(n); n.clippingPlanes = [p1]; n.clipIntersection = false; n.side = T.DoubleSide; n.needsUpdate = true; return n; };
    root.traverseVisible(o => {
      if (!o.isMesh) return;
      swap(o, mt => {
        if (!(mt.transparent && Math.abs(mt.opacity - V.xrayA) < 0.015)) return null;   // the see-inside's skin
        let n = made.get(mt); if (n) return n;
        n = dup(mt); made.set(mt, n); st.clones.push(n);
        const glass = (mt.transmission || 0) > 0 || /glass|glaz|perspex|plexi|screen/i.test(mt.name || '');
        if (glass) n.opacity = 0.3; else { n.opacity = 1; n.transparent = false; n.depthWrite = true; innerFace(n, mt); }
        n.clippingPlanes = [p1, p2]; n.clipIntersection = true; n.side = T.DoubleSide; n.needsUpdate = true;
        return n;
      });
    });
    R.localClippingEnabled = true;
    const fb = new T.Box3().setFromObject(fus || root), fc = fb.getCenter(new T.Vector3());
    const fl = Math.abs(fb.getSize(new T.Vector3()).dot(new T.Vector3(Math.abs(fwd.x), 0, Math.abs(fwd.z))));
    for (const [t0, pw] of [[0.3, 7], [-0.05, 5], [-0.33, 4]]) {   // the inside lit, on the cut's side, along the fuselage
      const L = new T.PointLight(0xfff0dc, pw, 0, 2);
      L.position.copy(fc).addScaledVector(fwd, t0 * fl).addScaledVector(left, 1.1).addScaledVector(up, 0.25);
      S.add(L); st.added.push(L);
    }
    for (const k of NEAR_OFF) {
      const Lr = root.children.find(o => o.name === 'cageLayer:' + k); if (!Lr) continue;
      Lr.traverse(o => { if (o.isMesh) swap(o, halve); });
    }
    const En = root.children.find(o => o.name === 'cageLayer:energy');   // a vessel out of the body goes with the near wing
    if (En && fus) {
      const fbb = new T.Box3().setFromObject(fus).expandByScalar(0.05), mb = new T.Box3();
      En.traverse(o => { if (!o.isMesh || !o.geometry) return; mb.setFromObject(o); if (!mb.isEmpty() && !fbb.containsBox(mb)) swap(o, halve); });
    }
    const G = root.children.find(o => o.name === 'cageLayer:gear');
    if (G) for (const o of G.children) if (/L$/.test(o.name) && o.visible) { o.visible = false; st.hid.push(o); }
    return st;
  }
  function cutOff(st) {
    for (const o of st.hid) o.visible = true;
    for (const L of st.added) { if (L.parent) L.parent.remove(L); if (L.dispose) L.dispose(); }
    for (const [o, m] of st.mats.reverse()) o.material = m;
    for (const c of st.clones) { try { c.dispose(); } catch (e) {} }
  }
  // ---- the numbers: what the fiche says, from the bench's own call and the drawn extents ------------------------------
  function numbers(spec, F, title) {
    const d = { span: +F.len('l').toFixed(2), length: +F.len('f').toFixed(2), height: +F.len('u').toFixed(2) };
    const eng = (spec.engines || [])[0] || {}, cab = spec.cabin || {};
    const data = { name: title || (spec.meta && spec.meta.name) || '', reg: (spec.meta && spec.meta.reg) || '', dims: d,
                   wings: (spec.wings || []).length, gear: (spec.gear && spec.gear.type) || '', fuelL: (spec.fuel && spec.fuel.litres) || null,
                   engine: eng.type || '', nEngines: (spec.engines || []).length, seats: cab.seats || null, specs: null };
    try {   // the plaque's call (app.js shakeFetch)
      const s = genShakedown(buildGen(genMigrateSpec(spec)), { corners: false });
      data.specs = { empty: s.empty, allUp: s.mass, Vs: s.Vs, VCruise: s.VCruise, climb: s.climbRate, TORun: s.TORun, engine: s.engineName, propD: s.propD, propBlades: s.propBlades };
    } catch (e) { data.specsError = String(e && e.message || e).slice(0, 120); }
    return data;
  }
  // ---- the draw ------------------------------------------------------------------------------------------------------
  let busy = null;
  async function draw(opts) {
    const T = window.THREE, P = window.FLIGHT_PROBE, root = window.CAGE_UI_SCENE, U = window.CAGE_UI, V = window.CAGE_VIEW;
    if (!T || !P || !root || !root.parent) throw new Error('no aeroplane on the stand');
    const R = P.renderer(), S = P.hangarScene(), cam0 = P.camera(), spec = specNow();
    const only = opts.only || VIEWS, tm = { views: {} }, t0 = performance.now(), pics = {};
    const pitch0 = root.rotation.x, bg0 = S.background, au = R.shadowMap.autoUpdate, lc = R.localClippingEnabled, rt0 = R.getRenderTarget();
    const shotOn = !!(window.SHOT_MODE && !window.SHOT_MODE.on);
    const rt = new T.WebGLRenderTarget(HERO_W, HERO_H, { samples: SAMPLES, type: T.UnsignedByteType, depthBuffer: true });
    rt.texture.colorSpace = T.SRGBColorSpace; rt.isXRRenderTarget = true;   // display-space, as the canvas (aa_resolve.js)
    rt.texture.internalFormat = 'RGBA8';   // the shader encodes; sRGB storage would not take the multisampled buffer's resolve (the first run: every picture empty)
    const room = []; S.traverse(o => { if (o.isLight) room.push(o); }); const roomI = room.map(l => l.intensity);   // (uniforms only: no program changes for this)
    const lights = new T.Group(), key = new T.DirectionalLight(0xfff0dc, STUDIO.key), rim = new T.DirectionalLight(0xe6eeff, STUDIO.rim), amb = new T.AmbientLight(0xfff4e6, 0);
    lights.add(key, key.target, rim, rim.target, amb); S.add(lights);
    const hid = []; let cut = null, xray0 = null, data = null;
    const black = new T.Color(0, 0, 0), white = new T.Color(1, 1, 1);
    try {
      if (shotOn) { window.SHOT_MODE.enter(); await frames(3); }
      S.traverse(m => { if (m.visible && /^studio:pool$/.test(m.name || '')) { m.visible = false; hid.push(m); } });
      R.shadowMap.autoUpdate = false;
      root.rotation.x = 0;   // the air's attitude
      let F = frameOf(T, root);
      data = numbers(spec, F, opts.title || opts.name);   // what the player calls it, not the file's meta (a Tiger Moth's says "Garage Special")
      const place = (F, low, st) => {
        key.intensity = st.key; rim.intensity = st.rim; amb.intensity = st.amb || 0;
        room.forEach((l, i) => { l.intensity = roomI[i] * st.room; });
        key.position.copy(F.c).addScaledVector(F.fwd, 6).addScaledVector(F.left, 5).addScaledVector(F.up, low ? -2 : 3); key.target.position.copy(F.c);
        rim.position.copy(F.c).addScaledVector(F.fwd, -7).addScaledVector(F.left, -2).addScaledVector(F.up, 6); rim.target.position.copy(F.c);
        lights.updateMatrixWorld(true);
      };
      const shoot = async (name, cam, w, h, low, st, F2) => {
        const t1 = performance.now();
        place(F2, low, st);
        cam.layers.mask = cam0.layers.mask; if (typeof UI_LAYER !== 'undefined' && UI_LAYER.blind) UI_LAYER.blind(cam);
        cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
        rt.viewport.set(0, 0, w, h); rt.scissor.set(0, 0, w, h); rt.scissorTest = true;
        const one = col => { S.background = col; R.setRenderTarget(rt); R.render(S, cam); const b = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, b); return b; };
        const k = one(black), wt = one(white);
        R.setRenderTarget(rt0); S.background = bg0;
        const m = matte(k, wt, w, h);
        if (!m.n) throw new Error('the ' + name + ' picture is empty');
        if (m.n === w * h) throw new Error('the ' + name + ' picture drew nothing (the two draws read back the same)');
        if (m.edge) throw new Error('the ' + name + ' picture touches its frame');
                const e = await encode(m, w, h);
        pics[name] = e.blob;
        tm.views[name] = { ms: Math.round(performance.now() - t1), w: e.w, h: e.h, kb: Math.round(e.blob.size / 1024) };
        if (opts.onView) opts.onView(name);
        await frames(2);   // the page breathes between pictures
      };
      const s = ORTHO / Math.max(F.len('f'), F.len('l')), ow = a => Math.round(s * a) + PAD * 2;
      data.pxPerM = +s.toFixed(3);
      if (only.includes('hero')) await shoot('hero', heroCam(T, F, HERO_W / HERO_H, 38, -28), HERO_W, HERO_H, true, STUDIO, F);
      if (only.includes('above')) await shoot('above', heroCam(T, F, HERO_W / HERO_H, 38, 28), HERO_W, HERO_H, false, CUT_STUDIO, F);   // its eye is above: a top surface takes key + rim (the below view's lights wash it out)
      if (only.includes('side')) await shoot('side', orthoCam(T, F, F.left, F.up, ow(F.len('f')), ow(F.len('u')), s), ow(F.len('f')), ow(F.len('u')), false, STUDIO, F);
      if (only.includes('plan')) await shoot('plan', orthoCam(T, F, F.up, F.fwd, ow(F.len('l')), ow(F.len('f')), s), ow(F.len('l')), ow(F.len('f')), false, CUT_STUDIO, F);
      if (only.includes('front')) await shoot('front', orthoCam(T, F, F.fwd, F.up, ow(F.len('l')), ow(F.len('u')), s), ow(F.len('l')), ow(F.len('u')), false, STUDIO, F);
      if (only.includes('cutaway') && U && V) {
        const t1 = performance.now();
        xray0 = V.xray || 0; V.xray = 1; U.build(); await stable(T, root);
        root.rotation.x = 0; root.updateMatrixWorld(true);
        cut = cutOn(T, R, root, S);
        tm.cutSetupMs = Math.round(performance.now() - t1);
        const Fc = frameOf(T, root);
        await shoot('cutaway', heroCam(T, Fc, CUT_W / CUT_H, 50, 28), CUT_W, CUT_H, false, CUT_STUDIO, Fc);
      }
    } finally {
      room.forEach((l, i) => { l.intensity = roomI[i]; });
      if (cut) cutOff(cut);
      R.localClippingEnabled = lc;
      if (xray0 != null) { V.xray = xray0; U.build(); await stable(T, root); }
      R.setRenderTarget(rt0); S.background = bg0; R.shadowMap.autoUpdate = au;
      S.remove(lights); key.dispose && key.dispose(); rim.dispose && rim.dispose(); amb.dispose && amb.dispose(); rt.dispose();
      for (const m of hid) m.visible = true;
      root.rotation.x = pitch0; root.updateMatrixWorld(true);
      if (shotOn) window.SHOT_MODE.exit();
    }
    tm.ms = Math.round(performance.now() - t0);
    api.lastTime = tm;
    return { name: opts.name || (spec.meta && spec.meta.name) || '', at: Date.now(), fp: fpNow(), hash: hashOf(spec), data, pics };
  }
  const api = {
    VIEWS, lastTime: null, _matte: matte, _hashOf: hashOf,
    // one at a time: a second ask waits for the first
    generate(opts) {
      const o = opts || {};
      const run = () => draw(o).then(async rec => { if (o.store !== false && rec.name) await tx('readwrite', s => s.put(rec)); return rec; });
      busy = (busy || Promise.resolve()).catch(() => {}).then(run);
      return busy;
    },
    async award(name, title) {
      let st = null; try { st = window.BENCH_STATE ? window.BENCH_STATE() : null; } catch (e) {}
      if (!st || !st.passed) return { refused: 'no certificate' };
      const had = await api.get(name), h = hashOf(specNow());
      if (had && had.hash === h && had.fp === fpNow()) return { kept: had };
      return { drawn: await api.generate({ name, title }) };   // the old fiche stays until this one is stored
    },
    get(name) { return tx('readonly', s => s.get(name)).then(r => r || null); },
    forget(name) { return tx('readwrite', s => s.delete(name)); },
    stale(rec) {
      if (!rec) return null;
      return { cert: rec.fp != null && rec.fp !== fpNow(), paint: rec.hash !== hashOf(specNow()) };
    },
  };
  window.PLANE_FICHE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
