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
  const S = window.SKIN_SCUFF, SV = S || window.__SS_VIEW, B = window.WX_BENCH, A = window.AEROSKIN, T = window.THREE;   // (SV: the class table, also on ?noscuff)
  if (!B || !A) { console.error('dmg bench: the weathering bench or AEROSKIN missing'); return; }
  const UI = B.UI, CEN = window.__DS_CENSUS || { src: [], links: 0 };
  const DS = { armed: false, meshes: [], copies: new Map(), links: { arm: 0, crash: 0 }, U: S ? S.uniforms(T) : null };
  const draw = () => B.draw();

  function load(spec) { UI.applySpec(spec, 'dmg bench'); draw(); return true; }

  // every drawn AEROSKIN mesh (not the glass's multiply companion), its finish, its class
  function skins() {
    const out = [];
    UI.scene.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.visible || o.userData.aeroCompanion) return;
      // (the editor draws the whole fuselage as ONE multi-material mesh - the covering, the panes, the frame - each
      // group its own material: every AEROSKIN or glass one counts; the glass's multiply companion does not)
      const ms = [].concat(o.material).filter(Boolean);
      if (!ms.some(isAero)) return;
      out.push(o);
    });
    return out;
  }
  const isAero = m => !!(m && m.userData && (m.userData.aeroskin || m.userData.aeroFinish) && m.userData.aeroFinish !== 'glassTint');
  // each vertex's class, by the material of the group its triangles are in (one material: that one's)
  function vclsOf(o) {
    const g = o.geometry, n = g.attributes.position.count, out = new Uint8Array(n), ms = [].concat(o.material);
    const clsM = m => (m && m.userData ? SV.clsOf(m.userData.aeroFinish || '') : 3);
    out.fill(clsM(ms[0]));
    if (Array.isArray(o.material) && g.groups.length) {
      const ix = g.index ? g.index.array : null;
      for (const G of g.groups) { const c = clsM(ms[G.materialIndex]); for (let i = G.start; i < G.start + G.count; i++) out[ix ? ix[i] : i] = c; }
    }
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
    const nose = new T.Vector3(xc - 0.3, box.min.y + 0.08 * L, box.min.z + 0.42 * (box.max.z - box.min.z));
    // a station across the left wing - SNAPPED to one the covering has vertices on (the editor's wing covering has
    // spanwise vertices only at its stations, metres apart): the band reaches one bay either side of it, as a tear's
    // edge sits on the mesh's own vertices in the game
    let cut = xc - 0.31 * span, cutW = 0.3;
    {
      const xs = new Set();
      for (const o of all) { const vc = vclsOf(o), { M } = craftOf(o), pa = o.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) { if (vc[i] !== SV.CLS.fabric) continue; v.fromBufferAttribute(pa, i).applyMatrix4(M);
          if (v.z > box.min.z + 0.6 * (box.max.z - box.min.z) && v.x < xc - 1.2) xs.add(Math.round(v.x * 100) / 100); } }
      const st = [...xs].sort((a, b) => a - b);
      if (st.length > 2) {
        let k = 0; for (let i = 1; i < st.length; i++) if (Math.abs(st[i] - cut) < Math.abs(st[k] - cut)) k = i;
        cut = st[k]; const gap = Math.min(k > 0 ? st[k] - st[k - 1] : 9, k < st.length - 1 ? st[k + 1] - st[k] : 9);
        cutW = Math.max(0.05, Math.min(0.9, 0.95 * gap));
      }
    }
    // the windscreen: the glass mesh that faces FORWARD the most (its area-weighted normal's -y, craft), not the most
    // forward centre (that was the Cub's roof skylight)
    // (by the most forward vertex that faces forward at all: the Cub's skylight faces forward more on average)
    let front = null, fy = Infinity, best = -1;
    for (const o of all) {
      const vc = vclsOf(o); if (!vc.includes(SV.CLS.glass)) continue;
      const { M, N } = craftOf(o), pa = o.geometry.attributes.position, na = o.geometry.attributes.normal; if (!na) continue;
      const q = new T.Vector3(), p = new T.Vector3();
      // (the cabin's glass only: above the aeroplane's mid-height - the metal Cessna's landing-light lens in the cowl is
      // further forward and faces forward too)
      const zMid = box.min.z + 0.5 * (box.max.z - box.min.z);
      for (let i = 0; i < na.count; i++) { if (vc[i] !== SV.CLS.glass) continue; q.fromBufferAttribute(na, i).applyMatrix3(N).normalize(); if (-q.y <= 0.35) continue;
        p.fromBufferAttribute(pa, i).applyMatrix4(M); if (p.z < zMid) continue; const y = p.y; if (y < fy) { fy = y; front = o; best = i; } }
    }
    // the impact: the windscreen's middle - the forward-facing glass within 0.6 m of its most forward point, their mean
    let paneObj = null, paneAt = null;
    if (front) {
      const vc = vclsOf(front), { M, N } = craftOf(front), pa = front.geometry.attributes.position, na = front.geometry.attributes.normal, n = pa.count, q = new T.Vector3(), p = new T.Vector3();
      const c0 = new T.Vector3(); let k = 0; const ok = new Uint8Array(n);
      const zMid2 = box.min.z + 0.5 * (box.max.z - box.min.z);
      for (let i = 0; i < n; i++) { if (vc[i] !== SV.CLS.glass) continue; q.fromBufferAttribute(na, i).applyMatrix3(N).normalize(); if (-q.y <= 0.35) continue;
        p.fromBufferAttribute(pa, i).applyMatrix4(M); if (p.z < zMid2) continue;
        if (p.y < fy + 0.6) { ok[i] = 1; c0.add(p.fromBufferAttribute(pa, i)); k++; } }   // (the screen's middle: the metal Cessna's base hides behind its cowl)
      c0.multiplyScalar(1 / Math.max(1, k));
      let bd = Infinity; for (let i = 0; i < n; i++) { if (!ok[i]) continue; const dd = p.fromBufferAttribute(pa, i).distanceTo(c0); if (dd < bd) { bd = dd; best = i; } }
      paneObj = new T.Vector3().fromBufferAttribute(pa, best); front.updateMatrixWorld(true); paneAt = paneObj.clone().applyMatrix4(front.matrixWorld);
    }
    return { box, L, span, nose, cut, cutW, front, paneObj, paneAt };
  }
  function fill(o, P, full) {
    const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, n = pa.count;
    const vc = vclsOf(o);
    const rec = new Uint8Array(n * 4), dir = new Int8Array(n * 4);
    const { M, Mi, N } = craftOf(o), p = new T.Vector3(), q = new T.Vector3(), d = new T.Vector3();
    const aft = new T.Vector3(0, 1, 0).transformDirection(Mi);   // the slide, aft, in the mesh's own frame
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pa, i).applyMatrix4(M);
      if (na) q.fromBufferAttribute(na, i).applyMatrix3(N).normalize(); else q.set(0, 0, 1);
      const cls = vc[i];
      let c = 0, s = 0, t = 0, soil = 0;
      if (full) { c = 1; s = 1; t = 0.5; soil = p.x < (P.box.min.x + P.box.max.x) / 2 ? 1 : 0; }
      else if (cls !== S.CLS.glass) {
        // a crush on the cowl's left cheek (full within 0.3 m, nothing past 0.8 m); a scrape on the fuselage's belly only
        // (within 0.45 m of the centreline, its front two thirds); a torn band across the left wing - +-0.3 m, wider
        // than the game's 7 cm: a record is per VERTEX, and the editor's wing has none within 7 cm of an arbitrary
        // station (in the game the band starts at the tear's own edge vertices)
        const dn = p.distanceTo(P.nose); c = Math.max(0, Math.min(1, (0.8 - dn) / 0.5));
        const xc = (P.box.min.x + P.box.max.x) / 2;
        if (q.z < -0.2 && Math.abs(p.x - xc) < 0.45 && p.y < P.box.min.y + 0.65 * P.L) { s = Math.min(1, (-q.z - 0.2) / 0.5); soil = p.x < xc ? 1 : 0; }
        if (Math.abs(p.x - P.cut) < P.cutW && p.z > P.box.min.z + 0.6 * (P.box.max.z - P.box.min.z)) t = 1 - Math.abs(p.x - P.cut) / P.cutW;
      }
      rec[i * 4] = Math.round(255 * c); rec[i * 4 + 1] = Math.round(255 * s); rec[i * 4 + 2] = Math.round(255 * t); rec[i * 4 + 3] = Math.round(255 * soil);
      d.copy(aft); if (na) { const nl = new T.Vector3().fromBufferAttribute(na, i); d.addScaledVector(nl, -d.dot(nl)); } d.normalize();
      dir[i * 4] = Math.round(127 * d.x); dir[i * 4 + 1] = Math.round(127 * d.y); dir[i * 4 + 2] = Math.round(127 * d.z); dir[i * 4 + 3] = cls;
    }
    // the glass: the windscreen's pane cracked (its glass vertices within 0.9 m of the impact), slot 0; the rest clean
    if (vc.includes(S.CLS.glass)) {
      const hit = o === P.front;
      for (let i = 0; i < n; i++) { if (vc[i] !== S.CLS.glass) continue; const on = hit && p.fromBufferAttribute(pa, i).distanceTo(P.paneObj) < 0.9 / Math.max(1e-6, craftOf(o).sc);
        rec[i * 4] = on || full ? 255 : 0; rec[i * 4 + 1] = rec[i * 4 + 2] = rec[i * 4 + 3] = 0; dir[i * 4 + 3] = S.CLS.glass; }
      if (hit && P.paneObj) DS.U.uDmgPane.value[0].set(P.paneObj.x, P.paneObj.y, P.paneObj.z, 1);
    }
    const set = (k, arr) => { const a = g.attributes[k]; if (a && a.array.length === arr.length) { a.array.set(arr); a.needsUpdate = true; } else g.setAttribute(k, new T.BufferAttribute(arr, 4, true)); };
    set('aDmg', rec); set('aDmgD', dir);
  }
  // THE ARMING: wrapped copies (as the game's buildModel makes them), the patterns, the programs compiled
  function arm() {
    if (!S) return { err: 'skin_scuff.js not loaded (?noscuff)' };
    const all = skins(), P = DS.P = pattern(all);
    const l0 = CEN.links;
    const copyOf = m => {
      if (!isAero(m)) return m;
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
      return c;
    };
    for (const o of all) {
      if (!o.userData.scuffOrig) o.userData.scuffOrig = o.material;
      o.material = Array.isArray(o.material) ? o.material.map(copyOf) : copyOf(o.material);
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
  function disarm() { for (const o of DS.meshes) if (o.userData.scuffOrig) o.material = o.userData.scuffOrig; DS.armed = false; draw(); }
  function set(o) {
    const U = DS.U, K = U.uDmgK.value;
    if (o.crush != null) K.x = +o.crush; if (o.scrape != null) K.y = +o.scrape; if (o.torn != null) K.z = +o.torn; if (o.relief != null) K.w = +o.relief;
    if (o.glass != null) U.uDmgG.value = +o.glass; if (o.on != null) U.uDmgOn.value = o.on ? 1 : 0;
    draw();
  }
  // THE LAYERS, each on its own preset (the weathering bench's views)
  const VIEW = { crush: 'nose', scrape: 'belly', torn: 'wing', glass: 'pane' };
  // the bench's own views beside the weathering's presets: the three-quarter overview from ahead and above, the underside
  // and each pattern's own close-up, centred on where the pattern is (craft -> the editor's scene through uCraftInv^-1)
  const toScene = c => { const U = A.aeroSharedU(T), M = (U.uCraftInv ? U.uCraftInv.value : new T.Matrix4()).clone().invert(); const v = c.clone().applyMatrix4(M); return [v.x, v.y, v.z]; };
  const pat = () => DS.P || (DS.P = pattern(skins()));
  const OWN = {
    overview: () => [0.62, 0.32, 0.55, null],
    under: () => [0.9, -0.55, 0.9, null],
    nose: () => [0.35, 0.12, 1.5, toScene(pat().nose)],
    belly: () => { const P = pat(); return [0.75, -0.8, 1.2, toScene(new T.Vector3((P.box.min.x + P.box.max.x) / 2, P.box.min.y + 0.35 * P.L, P.box.min.z + 0.1))]; },
    wing: () => { const P = pat(); return [0.5, 1.0, 1.5, toScene(new T.Vector3(P.cut, P.box.min.y + 0.3 * P.L, P.box.max.z - 0.15))]; },
    pane: () => { const c = pat().paneAt; return c ? [0.35, 0.28, 2.6, [c.x, c.y, c.z]] : [0.3, 0.35, 1.5, null]; },
  };
  function look(v) { if (OWN[v]) { const p = OWN[v](); UI.setView(p[0], p[1], p[2], p[3]); draw(); } else B.look(v); }
  function measure(layer, view) {
    const g = { crush: 0, scrape: 0, torn: 0, glass: 0, on: true };
    look(view || VIEW[layer]);
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
    look(view || 'flank');
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
  Object.assign(DS, { load, arm, disarm, set, measure, cost, crashWindow, still, sources, skins, VIEW, look });
  window.DS = DS;
})();
