// pave_ab.js - THE PAVEMENT OLD vs NEW, MEASURED IN THE PAGE (AS4b G928), for rollout_perf's --eval:
//   node tools/rollout_perf.js --port <p> --udd <dir> --q 'pave=new' --eval @tools/pave_ab.js [--secs 60]
// One expression. At the end of the recording window it switches the pavement live (PAVE_AB: the builders stand every
// pavement again the other way) ROUNDS times, alternating the order, and per mode measures:
//   census   PAVEMENT.census: pavement meshes, visible, merged, distinct materials, rows, the table's KB; how many of
//            the visible ones the main camera's frustum holds (= the pavement's draws in the main pass)
//   frame    over FRAMES frames of the page's own loop: the main pass's draws (renderer.info.render.calls), every GL
//            draw call, uniform calls and bytes (gl.uniform* wrapped on the context: what three uploads), and the CPU
//            of renderer.render
//   gpu      the pavement ALONE (its meshes on camera layer 30, nothing else drawn) timed with
//            EXT_disjoint_timer_query_webgl2, GPU_N renders, the median; and an empty render (layer 31) as the floor -
//            G1047's method (the depth buffer empty: every pavement pixel shaded, an upper bound)
// Read-only apart from the switch it makes; it leaves the page in the mode it found.
(async () => {
  const W = window.WORLD, R = W.renderer, gl = R.getContext(), P = window.PAVEMENT || (typeof PAVEMENT !== 'undefined' ? PAVEMENT : null);
  if (!P || !P.ab) return { err: 'no PAVEMENT.ab on this page (a pre-G928 build)' };
  const ROUNDS = 3, FRAMES = 60, GPU_N = 40, SETTLE = 90;
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const frames = async n => { for (let i = 0; i < n; i++) await raf(); };
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  // the main pass: the render call that draws WORLD.scene
  let cap = null; const rr = R.render;
  R.render = function (s, c) { if (!cap && s === W.scene) cap = { s, c }; return rr.apply(this, arguments); };
  await frames(3); R.render = rr;
  if (!cap) return { err: 'the main pass was not caught' };
  const isPav = o => o.isMesh && o.material && (P.isTable(o.material) || P.mats.indexOf(o.material) >= 0);
  const inFrustum = () => { const fr = new THREE.Frustum(), pm = new THREE.Matrix4(); cap.c.updateMatrixWorld(); pm.multiplyMatrices(cap.c.projectionMatrix, cap.c.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    let n = 0; cap.s.traverseVisible(o => { if (isPav(o) && (!o.frustumCulled || fr.intersectsObject(o))) n++; }); return n; };
  // the GL counters, on the context instance
  const U = ['uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniform1iv', 'uniformMatrix3fv', 'uniformMatrix4fv'];
  const K = { calls: 0, bytes: 0, draws: 0 };
  const bytesOf = (k, a) => { if (/Matrix/.test(k)) return (a[2] && a[2].length || (k === 'uniformMatrix4fv' ? 16 : 9)) * 4; if (/v$/.test(k)) return (a[1] && a[1].length || 0) * 4; return (+k.charAt(7) || 1) * 4; };
  const orig = {};
  const wrap = () => { for (const k of U) { orig[k] = gl[k]; gl[k] = function () { K.calls++; K.bytes += bytesOf(k, arguments); return orig[k].apply(this, arguments); }; }
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { orig[k] = gl[k]; gl[k] = function () { K.draws++; return orig[k].apply(this, arguments); }; } };
  const unwrap = () => { for (const k in orig) gl[k] = orig[k]; };
  async function frameStats() {
    const per = { draws: [], calls: [], bytes: [], main: [], ms: [] };
    let t = 0, mainCalls = 0;
    R.render = function (s, c) { const t0 = performance.now(); const x = rr.apply(this, arguments); if (s === W.scene) { t += performance.now() - t0; mainCalls = R.info.render.calls; } return x; };
    wrap();
    for (let i = 0; i < FRAMES; i++) { K.calls = K.bytes = K.draws = 0; t = 0; mainCalls = 0; await raf(); per.draws.push(K.draws); per.calls.push(K.calls); per.bytes.push(K.bytes); per.main.push(mainCalls); per.ms.push(t); }
    unwrap(); R.render = rr;
    return { mainDraws: med(per.main), glDraws: med(per.draws), uniformCalls: med(per.calls), uniformBytes: med(per.bytes), renderMs: +med(per.ms).toFixed(2) };
  }
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  async function gpuOf(layer) {
    if (!ext) return null;
    const moved = []; if (layer === 30) cap.s.traverse(o => { if (isPav(o)) { moved.push([o, o.layers.mask]); o.layers.set(30); } });
    const cm = cap.c.layers.mask; cap.c.layers.set(layer);
    const out = [];
    for (let i = 0; i < GPU_N; i++) {
      const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); rr.call(R, cap.s, cap.c); gl.endQuery(ext.TIME_ELAPSED_EXT);
      await raf();
      for (let w = 0; w < 20 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); w++) await raf();
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT) && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
    cap.c.layers.mask = cm; for (const [o, m] of moved) o.layers.mask = m;
    return out.length ? +med(out).toFixed(3) : null;
  }
  const start = P.MODE.table ? 'new' : 'old', out = {};
  // THE VIEWS: where the recording ended (the stand or the taxi, by --secs), then OVER THE VILLAGE - HANDOVER C0's pose
  // (900, -2250) 20 m over the ground, the flight paused (frame_perf's at:900:-2250:20)
  const views = (window.PAVE_AB_VIEWS || 'here,village').split(',');
  for (const view of views) {
    if (view === 'village') {
      const FP = window.FLIGHT_PROBE, w = FP.world(), sm = FP.sim(), cg = sm.cgPos(), X = 900, Z = -2250, dy = w.terrainH(X, Z) + 20 - cg[1];
      for (let i = 0; i < sm.n; i++) { sm.p[i * 3] += X - cg[0]; sm.p[i * 3 + 1] += dy; sm.p[i * 3 + 2] += Z - cg[2]; sm.v[i * 3] = sm.v[i * 3 + 1] = sm.v[i * 3 + 2] = 0; }
      const bP = document.getElementById('bPause'); if (bP && !window.FLYDIY_HELD) bP.click();
      if (FP.camSettle) FP.camSettle();
      await frames(240);
    }
    out[view] = await measureView();
  }
  P.ab(start); await frames(10);
  return { rounds: ROUNDS, frames: FRAMES, gpuRenders: GPU_N, timer: !!ext, views: out };
  async function measureView() {
  const res = { old: [], new: [] };
  for (let r = 0; r < ROUNDS; r++) {
    for (const mode of (r % 2 ? ['new', 'old'] : ['old', 'new'])) {
      const t0 = performance.now(); P.ab(mode); const rebuildMs = +(performance.now() - t0).toFixed(1);
      await frames(SETTLE);
      const c = P.census(W.scene);
      const row = { rebuildMs, meshes: c.meshes, visible: c.visible, merged: c.merged, materials: c.materials, rows: c.rows, tableKB: c.tableKB, verts: c.verts, inFrustum: inFrustum() };
      Object.assign(row, await frameStats());
      row.gpuPavement = await gpuOf(30); row.gpuEmpty = await gpuOf(31);
      res[mode].push(row);
    }
  }
  const sum = {};
  for (const mode of ['old', 'new']) { const L = res[mode]; sum[mode] = {}; for (const k of Object.keys(L[0])) sum[mode][k] = typeof L[0][k] === 'number' ? med(L.map(x => x[k])) : L[0][k]; }
  return { median: sum, runs: res, cam: [cap.c.position.x, cap.c.position.y, cap.c.position.z].map(v => +v.toFixed(1)) };
  }
})()
