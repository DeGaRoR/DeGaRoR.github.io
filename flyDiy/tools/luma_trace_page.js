// LUMA TRACE (LIGHT-SMOOTH G1350-G1359, 2026-10-03): the picture's brightness frame by frame, in the page.
// The user: "luminosity adjustments happen all of a sudden, one frame over the other", "frequent white flashes, single
// frame", "some random frames are entirely pale blue sky". Each requestAnimationFrame callback that DREW (the renderer's
// frame counter moved) is followed, in the same task - the drawing buffer still holds the frame - by a drawImage of the
// canvas into a 48 x 27 2D canvas: the mean display luma, its spread over the cells, the rgb mean, and beside it the
// light's state that frame (the eased light, the exposure, the eye, the probe's bakes and fade, the clouds' shadow flag,
// the camera). A frame whose mean moves more than LT.flag from the one before keeps its 48 x 27 cells (LT.snaps).
// Injected by tools/luma_trace.js through live_driver's /run; LT.start() / LT.stop() / LT.dump().
window.LT = (() => {
  const W = 48, H = 27;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const st = { pngs: 8, prevC: NaN, on: false, rows: [], snaps: [], lastFrame: -1, prevMean: NaN, flag: 0.04, t0: 0, maxRows: 20000 };
  const R = () => (window.FLIGHT_PROBE && FLIGHT_PROBE.renderer) ? FLIGHT_PROBE.renderer() : null;
  function cap() {
    const r = R(); if (!r) return;
    const f = r.info.render.frame;
    if (f === st.lastFrame) return;            // nothing drawn this callback (the cap skipped it): the buffer is not this frame's
    st.lastFrame = f;
    const c = r.domElement;
    g.drawImage(c, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    let s = 0, s2 = 0, rs = 0, gs = 0, bs = 0, blue = 0, cs = 0, cn = 0;
    const L = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const R8 = d[i * 4] / 255, G8 = d[i * 4 + 1] / 255, B8 = d[i * 4 + 2] / 255, l = 0.2126 * R8 + 0.7152 * G8 + 0.0722 * B8;
      L[i] = l; s += l; s2 += l * l; rs += R8; gs += G8; bs += B8;
      if (B8 > R8 + 0.06 && l > 0.45) blue++;   // a pale-blue sky cell
      const x = i % W, y = (i / W) | 0;
      if (x >= 16 && x < 32 && y >= 9 && y < 20) { cs += l; cn++; }   // the frame's centre third: the aeroplane in a chase or orbit view
    }
    const n = W * H, mean = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
    const LE = window.LIGHT_EASE, WL = window.WORLD, P = window.POST_FX, WR = window.WORLD_RIG, cam = window.FLIGHT_PROBE && FLIGHT_PROBE.camera ? FLIGHT_PROBE.camera() : null;
    const ps = WR && WR.probeState ? WR.probeState() : null;
    const row = [+(performance.now() - st.t0).toFixed(1), +mean.toFixed(4), +sd.toFixed(4), +(rs / n).toFixed(3), +(gs / n).toFixed(3), +(bs / n).toFixed(3), +(blue / n).toFixed(3),
      WL && WL.hemi ? +WL.hemi.intensity.toFixed(4) : null, WL && WL.sun ? +WL.sun.intensity.toFixed(3) : null, +r.toneMappingExposure.toFixed(4), P ? +P.stats.eyeK.toFixed(4) : null,
      ps ? ps.bakes : null, ps ? +ps.fade.toFixed(3) : null, window.CLOUDS ? CLOUDS.shadowOn : null, LE ? +LE.cT.toFixed(3) : null,
      cam ? +cam.position.y.toFixed(1) : null, f, +(cs / Math.max(1, cn)).toFixed(4)];
    if (st.rows.length < st.maxRows) st.rows.push(row);
    const centre = cs / Math.max(1, cn);
    if (Number.isFinite(st.prevMean) && (Math.abs(mean - st.prevMean) > st.flag || Math.abs(centre - st.prevC) > 1.5 * st.flag) && st.snaps.length < 60)
      st.snaps.push({ i: st.rows.length - 1, d: +(mean - st.prevMean).toFixed(4), cells: Array.from(L, v => Math.round(v * 255)), png: st.pngs-- > 0 ? c.toDataURL('image/jpeg', 0.8) : null });
    st.prevMean = mean; st.prevC = centre;
  }
  window.__ltCap = () => { if (st.on) { try { cap(); } catch (e) { st.err = String(e); } } };   // a re-injection replaces it
  if (!window.__ltRaf) {
    const raf0 = window.requestAnimationFrame.bind(window);
    window.__ltRaf = raf0;
    window.requestAnimationFrame = cb => raf0(t => { cb(t); if (window.__ltCap) window.__ltCap(); });
  }
  const COLS = ['t', 'mean', 'sd', 'r', 'g', 'b', 'blue', 'hemiI', 'sunI', 'exposure', 'eyeK', 'probeBakes', 'probeFade', 'cloudShadowOn', 'cT', 'camY', 'frame', 'centre'];
  return {
    st, COLS,
    start() { st.rows = []; st.snaps = []; st.pngs = 8; st.lastFrame = -1; st.prevMean = NaN; st.t0 = performance.now(); st.on = true; return 'on'; },
    stop() { st.on = false; return st.rows.length; },
    dump() { return JSON.stringify({ cols: COLS, rows: st.rows, snaps: st.snaps, err: st.err || null }); },
  };
})();
'LT ready';
