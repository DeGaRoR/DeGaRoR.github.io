// _dmg_scuff_bench.js - THE DAMAGE BENCH's panel and instrument (G2006, DMG-SCUFF). Loaded after the weathering bench on
// tools/_dmg_scuff.html; reads the editor's own renderer / scene / camera through WX_BENCH. Everything is on window.DS.
//   DS.load(spec)       a build into the editor (CAGE_UI.applySpec) - the runner hands the user's Cub, the metal Cessna
//   DS.arm()            every AEROSKIN mesh (and pane) on a WRAPPED COPY of its material (skin_scuff.js wrap - what the
//                       game's buildModel makes with damage on), the record attributes set to the TEST PATTERNS below;
//                       the programs compiled here (renderer.compile): the links counted
//   DS.set(o)           the gains: { crush, scrape, torn, glass, relief, on }
//   DS.measure(layer)   the layer alone at 0 then 1 on its preset: { pct changed, mean } (under 0.5 % a FAIL)
//   DS.cost(view)       frames timed (median of several, a readback a frame): plain (unarmed), armed + intact (the
//                       branch only), armed + every vertex fully damaged - SwiftShader's rasteriser is the CPU, so the
//                       ratio is a fragment-cost estimate, not a frame time
//   DS.still(w, h)      the current view as a JPEG data URL (a render target, as WX_BENCH.snap)
//   DS.sources()        the hash of every shader source compiled since the page loaded, and the links
// THE PATTERNS ARE TEST PATTERNS: a crush round the nose, a scrape on the belly ALONG the aeroplane (its left half on
// grass - the soil stain -, its right half on hard ground), a torn band across the left wing, the front pane cracked.
(function () {
  'use strict';
  const S = window.SKIN_SCUFF, B = window.WX_BENCH, A = window.AEROSKIN, T = window.THREE;
  if (!B || !A) { console.error('dmg bench: the weathering bench or AEROSKIN missing'); return; }
  const UI = B.UI, CEN = window.__DS_CENSUS || { src: [], links: 0 };
  const DS = { armed: false, meshes: [], copies: new Map(), links: { arm: 0, crash: 0 }, U: S ? S.uniforms(T) : null };
  const draw = () => B.draw();

  function load(spec) { UI.applySpec(spec, 'dmg bench'); draw(); return true; }

  // every drawn AEROSKIN mesh (not the glass's multiply companion), its finish, its class
  function skins() {
    const out = [];
    UI.scene.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.visible) return;
      const m = Array.isArray(o.material) ? null : o.material;
      if (!m || !m.userData || !(m.userData.aeroskin || m.userData.aeroFinish) || o.userData.aeroCompanion) return;
      if (m.userData.aeroFinish === 'glassTint') return;
      out.push(o);
    });
    return out;
  }
  // the craft frame (metres: x lateral, y aft, z up) of a mesh's vertices and normals, and back for a direction
  function craftOf(o) {
    const U = A.aeroSharedU(T), CI = U.uCraftInv ? U.uCraftInv.value : new T.Matrix4();
    o.updateMatrixWorld(true);
    const M = new T.Matrix4().multiplyMatrices(CI, o.matrixWorld), Mi = M.clone().invert(), N = new T.Matrix3().getNormalMatrix(M);
    const sc = new T.Vector3().setFromMatrixColumn(M, 0).length();
    return { M, Mi, N, sc };
  }
  // THE TEST PATTERNS (labelled; the game's come from the physics)
  function pattern(all) {
    // the aeroplane's craft box
    const box = new T.Box3(), v = new T.Vector3();
    for (const o of all) { const { M } = craftOf(o), p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(M); box.expandByPoint(v); } }
    const L = box.max.y - box.min.y, span = box.max.x - box.min.x, xc = (box.max.x + box.min.x) / 2;
    const nose = new T.Vector3(xc, box.min.y + 0.12 * L, box.min.z + 0.45 * (box.max.z - box.min.z));
    const cut = xc - 0.31 * span;                          // a station across the left wing
    // the front pane: the glass mesh whose centre is most forward
    let front = null, fy = Infinity;
    for (const o of all) if (o.material.userData.aeroFinish === 'glass') { const { M } = craftOf(o); o.geometry.computeBoundingSphere(); const c = o.geometry.boundingSphere.center.clone().applyMatrix4(M); if (c.y < fy) { fy = c.y; front = o; } }
    return { box, L, span, nose, cut, front };
  }
  function fill(o, P, full) {
    const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, n = pa.count;
    const cls = S.clsOf(o.material.userData.aeroFinish || '');
    const rec = new Uint8Array(n * 4), dir = new Int8Array(n * 4);
    const { M, Mi, N } = craftOf(o), p = new T.Vector3(), q = new T.Vector3(), d = new T.Vector3();
    const aft = new T.Vector3(0, 1, 0).transformDirection(Mi);   // the slide, aft, in the mesh's own frame
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pa, i).applyMatrix4(M);
      if (na) q.fromBufferAttribute(na, i).applyMatrix3(N).normalize(); else q.set(0, 0, 1);
      let c = 0, s = 0, t = 0, soil = 0;
      if (full) { c = 1; s = 1; t = 0.5; soil = p.x < (P.box.min.x + P.box.max.x) / 2 ? 1 : 0; }
      else if (cls !== S.CLS.glass) {
        const dn = p.distanceTo(P.nose); c = Math.max(0, Math.min(1, (1.3 - dn) / 0.5));
        if (q.z < -0.2 && p.y < P.box.min.y + 0.65 * P.L) { s = Math.min(1, (-q.z - 0.2) / 0.5); soil = p.x < (P.box.min.x + P.box.max.x) / 2 ? 1 : 0; }
        if (p.x < P.cut + 0.07 && p.x > P.cut - 0.07 && Math.abs(p.z - P.box.min.z) > 0.2) t = 1 - Math.abs(p.x - P.cut) / 0.07;
      }
      rec[i * 4] = Math.round(255 * c); rec[i * 4 + 1] = Math.round(255 * s); rec[i * 4 + 2] = Math.round(255 * t); rec[i * 4 + 3] = Math.round(255 * soil);
      d.copy(aft); if (na) { const nl = new T.Vector3().fromBufferAttribute(na, i); d.addScaledVector(nl, -d.dot(nl)); } d.normalize();
      dir[i * 4] = Math.round(127 * d.x); dir[i * 4 + 1] = Math.round(127 * d.y); dir[i * 4 + 2] = Math.round(127 * d.z); dir[i * 4 + 3] = cls;
    }
    if (cls === S.CLS.glass) {
      const hit = o === P.front;
      for (let i = 0; i < n; i++) { rec[i * 4] = hit ? 255 : 0; dir[i * 4 + 3] = S.CLS.glass + 0; }
      if (hit) {
        // the impact: the pane's vertex nearest its centre, a third of the way to its lower edge (in its own frame)
        g.computeBoundingBox(); const bb = g.boundingBox, c0 = bb.getCenter(new T.Vector3());
        c0.y = bb.min.y + 0.35 * (bb.max.y - bb.min.y);
        let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const dd = p.fromBufferAttribute(pa, i).distanceTo(c0); if (dd < bd) { bd = dd; best = i; } }
        p.fromBufferAttribute(pa, best); DS.U.uDmgPane.value[0].set(p.x, p.y, p.z, 1);
      }
    }
    const set = (k, arr) => { const a = g.attributes[k]; if (a && a.array.length === arr.length) { a.array.set(arr); a.needsUpdate = true; } else g.setAttribute(k, new T.BufferAttribute(arr, 4, true)); };
    set('aDmg', rec); set('aDmgD', dir);
  }
  // THE ARMING: wrapped copies (as the game's buildModel makes them), the patterns, the programs compiled
  function arm() {
    if (!S) return { err: 'skin_scuff.js not loaded (?noscuff)' };
    const all = skins(), P = pattern(all);
    const l0 = CEN.links;
    for (const o of all) {
      const m = o.material;
      let c = DS.copies.get(m);
      if (!c) {
        const k = m.userData.aeroFinish === 'glass' ? 'glass' : 'live';
        const ud = m.userData; m.userData = {};
        try { c = new m.constructor(); c.copy(m); } finally { m.userData = ud; }
        c.userData = Object.assign({}, ud, { scuff: k });
        if (m.defines) c.defines = Object.assign({}, m.defines);
        for (const q of ['clearcoat', 'clearcoatRoughness', 'transmission', 'envMapIntensity', 'blendDst']) if (m[q] !== undefined) c[q] = m[q];
        c.onBeforeCompile = S.wrap(Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') ? m.onBeforeCompile : null, k, DS.U);
        c.needsUpdate = true;
        DS.copies.set(m, c); c.userData.scuffOrig = m;
      }
      o.material = c;
      fill(o, P, false);
    }
    // the uniform's metres per object unit (the editor's meshes are in its own units)
    if (all.length) DS.U.uDmgM.value = craftOf(all[0]).sc;
    DS.meshes = all; DS.P = P; DS.armed = true;
    DS.U.uDmgOn.value = 1;
    UI.renderer.compile(UI.scene, UI.camera);
    draw();
    DS.links.arm = CEN.links - l0;
    return { meshes: all.length, links: DS.links.arm, front: !!P.front, uDmgM: DS.U.uDmgM.value };
  }
  function disarm() { for (const o of DS.meshes) if (o.material.userData.scuffOrig) o.material = o.material.userData.scuffOrig; DS.armed = false; draw(); }
  function set(o) {
    const U = DS.U, K = U.uDmgK.value;
    if (o.crush != null) K.x = +o.crush; if (o.scrape != null) K.y = +o.scrape; if (o.torn != null) K.z = +o.torn; if (o.relief != null) K.w = +o.relief;
    if (o.glass != null) U.uDmgG.value = +o.glass; if (o.on != null) U.uDmgOn.value = o.on ? 1 : 0;
    draw();
  }
  // THE LAYERS, each on its own preset (the weathering bench's views)
  const VIEW = { crush: 'nose', scrape: 'belly', torn: 'top', glass: 'screen' };
  function measure(layer, view) {
    const g = { crush: 0, scrape: 0, torn: 0, glass: 0, on: true };
    B.look(view || VIEW[layer]);
    set(g); const a = B.shoot();
    g[layer] = 1; set(g); const b = B.shoot();
    set({ crush: 1, scrape: 1, torn: 1, glass: 1 });
    const r = B.diff(a, b); r.layer = layer; r.view = view || VIEW[layer]; r.ok = r.pct >= 0.5;
    return r;
  }
  // THE COST: render N frames (a 1-pixel readback each: the pipeline drained), the median of R rounds
  function timeFrames(N) {
    const R = UI.renderer, gl = R.getContext(), px = new Uint8Array(4), t = [];
    for (let i = 0; i < N; i++) { const t0 = performance.now(); R.render(UI.scene, UI.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b); return t[t.length >> 1];
  }
  function cost(view, N) {
    N = N || 9;
    B.look(view || 'flank');
    const l0 = CEN.links, out = {};
    disarm(); timeFrames(2); out.plain = timeFrames(N);
    arm(); set({ crush: 1, scrape: 1, torn: 1, glass: 1, on: false }); timeFrames(2); out.armedOff = timeFrames(N);
    for (const o of DS.meshes) { const r = o.geometry.attributes.aDmg; r.array.fill(0); r.needsUpdate = true; }
    set({ on: true }); timeFrames(2); out.armedIntact = timeFrames(N);
    for (const o of DS.meshes) fill(o, DS.P, true);
    timeFrames(2); out.armedFull = timeFrames(N);
    for (const o of DS.meshes) fill(o, DS.P, false);
    out.links = CEN.links - l0 - DS.links.arm;   // the links after the first arm (none: the programs were compiled at arm)
    out.ratioFull = +(out.armedFull / out.plain).toFixed(3); out.ratioIntact = +(out.armedIntact / out.plain).toFixed(3);
    draw();
    return out;
  }
  // a crash on an armed aeroplane: the records rewritten (an upload), the branch opened - the links counted
  function crashWindow() {
    const l0 = CEN.links;
    set({ on: false });
    for (const o of DS.meshes) fill(o, DS.P, false);
    set({ on: true, crush: 1, scrape: 1, torn: 1, glass: 1 });
    for (let i = 0; i < 5; i++) UI.renderer.render(UI.scene, UI.camera);
    DS.links.crash = CEN.links - l0;
    return DS.links.crash;
  }
  function still(w, h, q) {
    w = w || 960; h = h || 540;
    const R = UI.renderer, Sc = UI.scene, C = UI.camera;
    draw();
    const rt = new T.WebGLRenderTarget(w, h, { format: T.RGBAFormat }); rt.texture.colorSpace = T.SRGBColorSpace;
    const asp = C.aspect; C.aspect = w / h; C.updateProjectionMatrix();
    const pr = R.getRenderTarget(); R.setRenderTarget(rt); R.setViewport(0, 0, w, h); R.clear(true, true, true); R.render(Sc, C);
    const px = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, px);
    R.setRenderTarget(pr); rt.dispose(); C.aspect = asp; C.updateProjectionMatrix();
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/jpeg', q || 0.88);
  }
  function sources() {
    let h = 0x811c9dc5; for (const s of CEN.src) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return { n: CEN.src.length, hash: h.toString(16), links: CEN.links };
  }
  Object.assign(DS, { load, arm, disarm, set, measure, cost, crashWindow, still, sources, skins, VIEW });
  window.DS = DS;
})();
