// CLOUD RIG (B11-EYES, 2026-10-01): hold the camera at exact poses frame by frame (wrapping FLYDIY_AA.render),
// capture the final canvas + the cloud march target, compare frames rendered from the SAME pose.
window.CR = (() => {
  const R = WORLD.renderer, gl = R.getContext(), AA = window.FLYDIY_AA;
  const st = { poses: null, i: 0, want: 0, base: null, caps: [] };
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const orig = AA.__crOrig || AA.render; AA.__crOrig = orig;
  function readRT() {
    const rt = CLOUDS.rt && CLOUDS.rt(); if (!rt) return null;
    const w = rt.width, h = rt.height, ty = rt.texture.type;
    let buf, k = 1;
    if (ty === THREE.FloatType) buf = new Float32Array(w * h * 4);
    else if (ty === THREE.HalfFloatType) buf = new Uint16Array(w * h * 4);
    else { buf = new Uint8Array(w * h * 4); k = 1 / 255; }
    R.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    const a = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = ty === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat(buf[i * 4 + 3]) : buf[i * 4 + 3] * k;
    return { w, h, a };
  }
  AA.render = function (scene, cam) {
    const on = st.want > 0 && st.poses;
    let saved = null;
    if (on) {
      if (!st.base) st.base = { p: cam.position.clone(), q: cam.quaternion.clone() };
      const P = st.poses[st.i % st.poses.length];
      saved = { p: cam.position.clone(), q: cam.quaternion.clone() };
      const off = V().set(P.t[0], P.t[1], P.t[2]).applyQuaternion(st.base.q);
      cam.position.copy(st.base.p).add(off);
      cam.quaternion.copy(st.base.q).multiply(Q().setFromEuler(new THREE.Euler(P.pitch * Math.PI / 180, P.yaw * Math.PI / 180, 0, 'YXZ')));
      cam.updateMatrixWorld(true);
    }
    // hideR: the small meshes near the held eye (the aeroplane, its cabin) hidden on the captured frames - a held camera
    // while the sim runs would otherwise see the aeroplane move through the view
    let hid = null;
    if (on && st.hideR > 0) {
      if (!st.hideList) { st.hideList = []; const c = st.base.p, comp = CLOUDS.compositeMesh && CLOUDS.compositeMesh(), v = V();
        scene.traverse(o => { if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite) || o === comp || !o.visible || !o.geometry) return;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const bs = o.geometry.boundingSphere; if (!bs) return;
          const sc = o.matrixWorld.getMaxScaleOnAxis(), r = bs.radius * sc; if (r > 30) return;
          v.copy(bs.center).applyMatrix4(o.matrixWorld); if (v.distanceTo(c) - r < st.hideR) st.hideList.push(o); }); }
      hid = st.hideList.filter(o => o.visible); for (const o of hid) o.visible = false;
    }
    const r = orig.apply(this, arguments);
    if (hid) for (const o of hid) o.visible = true;
    if (on) {
      const c = R.domElement, w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      st.caps.push({ pose: st.i % st.poses.length, tag: st.poses[st.i % st.poses.length].tag, w, h, px, cl: readRT(), t: performance.now(), simT: window.FLIGHT_PROBE ? FLIGHT_PROBE.sim().t : 0 });
      st.i++; st.want--;
      cam.position.copy(saved.p); cam.quaternion.copy(saved.q); cam.updateMatrixWorld(true);
      if (st.want === 0 && st.done) { const d = st.done; st.done = null; d(); }
    }
    return r;
  };
  // run(poses, n): capture n frames cycling the poses (pose = {tag, pitch, yaw, t:[x,y,z] camera-local m}); keepBase: same base pose as the last run
  function run(poses, n, keepBase, hideR) {
    st.poses = poses; st.i = 0; st.caps = []; if (!keepBase) st.base = null; st.hideR = hideR || 0; st.hideList = null;
    return new Promise(res => { st.done = res; st.want = n; setTimeout(() => { if (st.want > 0) { st.want = 0; res(); } }, 60000); }).then(() => st.caps.length);
  }
  // cmp(a, b): the per-pixel |diff| of two captures, on cloud pixels (the march alpha of either, nearest-upsampled)
  function cmp(A, B, img) {
    const w = A.w, h = A.h, cl = A.cl, cl2 = B.cl;
    const S = { edge: { n: 0, sum: 0, over8: 0, max: 0 }, core: { n: 0, sum: 0, over8: 0, max: 0 }, sky: { n: 0, sum: 0, over8: 0, max: 0 }, all: { n: 0, sum: 0, over8: 0, max: 0 } };
    const out = img ? new Uint8ClampedArray(w * h * 4) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      const d = Math.max(Math.abs(A.px[o] - B.px[o]), Math.abs(A.px[o + 1] - B.px[o + 1]), Math.abs(A.px[o + 2] - B.px[o + 2]));
      let a = 0;
      if (cl) { const cx = Math.min(cl.w - 1, (x * cl.w / w) | 0), cy = Math.min(cl.h - 1, (y * cl.h / h) | 0); a = Math.max(cl.a[cy * cl.w + cx], cl2 ? cl2.a[cy * cl.w + cx] : 0); }
      const k = a >= 0.6 ? S.core : a >= 0.05 ? S.edge : S.sky;
      for (const s of [k, S.all]) { s.n++; s.sum += d; if (d > 8) s.over8++; if (d > s.max) s.max = d; }
      if (out) { const oy = (h - 1 - y) * w + x, q = oy * 4, g = (A.px[o] + A.px[o + 1] + A.px[o + 2]) / 12;
        out[q] = Math.min(255, g + d * 8); out[q + 1] = a >= 0.05 ? Math.min(255, g + 25) : g; out[q + 2] = g; out[q + 3] = 255; }
    }
    const f = s => ({ px: s.n, mean: s.n ? +(s.sum / s.n).toFixed(3) : 0, pctOver8: s.n ? +(100 * s.over8 / s.n).toFixed(3) : 0, max: s.max });
    return { edge: f(S.edge), core: f(S.core), notCloud: f(S.sky), all: f(S.all), img: out };
  }
  // the images as data URLs (the CDP driver writes them): the x8 diff, the frame
  function toURL(rgba, w, h, type) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0); return c.toDataURL(type || 'image/png', 0.9); }
  function diffURL(A, B) { const r = cmp(A, B, true); return toURL(r.img, A.w, A.h, 'image/png'); }
  function frameURL(A) { const w = A.w, h = A.h, o = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, d = ((h - 1 - y) * w + x) * 4; o[d] = A.px[s]; o[d + 1] = A.px[s + 1]; o[d + 2] = A.px[s + 2]; o[d + 3] = 255; }
    return toURL(o, w, h, 'image/jpeg'); }
  // stats of a pair, without the image
  function pair(i, j) { const c = st.caps, r = cmp(c[i], c[j]); return { a: c[i].tag, b: c[j].tag, edge: r.edge, core: r.core, notCloud: r.notCloud }; }
  function cloudInfo() { return { stats: CLOUDS.stats, mode: CLOUDS.S.mode, jitter: CLOUDS.S.jitter, upsample: CLOUDS.S.upsample, rt: (() => { const r = CLOUDS.rt && CLOUDS.rt(); return r ? [r.width, r.height, r.texture.type] : null; })() }; }
  return { st, run, cmp, pair, diffURL, frameURL, cloudInfo };
})();
'CR ready';
