// diag.js - THE SELF-TEST (G1997, HW-COVERAGE; A0 for the user, 2026-10-06: "cover most computers" - the way to
// diagnose a machine nobody here can reach)
//
// One URL a tester opens: index.html?diag. The page loads as it always does (the one loading, B9: the shed and the
// world), then this module - loaded ONLY under ?diag (build.js MANIFEST.lazy + the loader's own test: zero bytes and zero
// cost otherwise) - rolls the aeroplane out, pauses it on its stand, fixes the camera and measures the SAME view for a
// few seconds per VARIANT: the preset as it is, then one thing changed at a time - each heavy graphics row off, each big
// owner of the world's triangles hidden, the readbacks and the GPU timer off, the lower presets - each back as it was
// before the next. Every reading is the flight recorder's (flight_recorder.js: per rendered frame the interval, the loop's
// JavaScript, the GPU timer around the frame, the draws and triangles); one frame's draws and triangles BY OWNER are
// counted once (renderer.renderBufferDirect, potato_census.js's attribution). The report: the browser, the graphics card
// and what its WebGL says (the extensions that pick a path: timer queries, clip control, parallel compile, compressed
// formats), the screen, the preset, the load's steps, the census and the variants' table with THE WORST OFFENDER (the
// variant that saves the most GPU time - frame time without a timer) - on screen, downloadable as JSON and as text, and
// kept in localStorage (flydiy.diag.last). ~3 minutes after the load on a working machine.
// The graphics are put back exactly as they were (every row; the saved choice), the runtime step-down (gfx_settings.js
// HW) is held while it measures, and nothing here runs, is fetched or is drawn without ?diag.
// ?diag=quick: fewer variants (the rows only). ?diag&ktx2=0: the same with the KTX2 path off (the button at the end
// reloads that way and merges the two reports).
(function () {
  'use strict';
  const W = window;
  if (W.FLYDIY_DIAG) return;
  const Q = (W.location && W.location.search) || '';
  const QUICK = /[?&]diag=quick/.test(Q);
  const T = { SETTLE_MS: 2500, WIN_MS: 5000, LOAD_MS: 15 * 60000, SCREEN_MS: 180000 };
  const D = W.FLYDIY_DIAG = { state: 'waiting for the game', variants: [], report: null, T };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const now = () => performance.now();
  async function until(fn, ms, every) { const t0 = now(); while (now() - t0 < ms) { let ok = false; try { ok = !!fn(); } catch (e) {} if (ok) return true; await sleep(every || 250); } return false; }
  const B = () => W.BOOT;
  const quiet = () => { const b = B(); return !b || (b.state === 'gone' && !(typeof b.busy === 'function' && b.busy())); };
  const inShed = () => !!(W.document.body && W.document.body.classList.contains('mode-ws'));
  const r1 = x => (x === x && x != null ? Math.round(x * 10) / 10 : null);

  // ---- the panel ---------------------------------------------------------------------------------------------------
  const css = '#diagBox{position:fixed;left:12px;bottom:12px;z-index:95;width:min(560px,94vw);max-height:70vh;overflow:auto;background:rgba(22,21,19,.94);' +
    'color:#f1ece2;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:10px 12px;font:400 12px/1.4 ui-monospace,Consolas,monospace;box-shadow:0 8px 30px rgba(0,0,0,.4)}' +
    '#diagBox h3{margin:0 0 4px;font:600 13px system-ui,sans-serif}#diagBox table{border-collapse:collapse;width:100%;margin-top:6px}' +
    '#diagBox td,#diagBox th{padding:1px 6px 1px 0;text-align:right;white-space:nowrap}#diagBox td:first-child,#diagBox th:first-child{text-align:left}' +
    '#diagBox .worst{color:#ffb35c}#diagBox button{margin:6px 6px 0 0;font:600 12px system-ui,sans-serif;padding:4px 10px;border-radius:5px;border:1px solid #777;background:#2c2a26;color:#f1ece2;cursor:pointer}';
  let box = null;
  function ui() {
    if (box || !W.document.body) return box;
    const st = W.document.createElement('style'); st.textContent = css; W.document.head.appendChild(st);
    box = W.document.createElement('div'); box.id = 'diagBox';
    box.innerHTML = '<h3>flyDiy self-test</h3><div id="diagState"></div><div id="diagTable"></div><div id="diagBtns"></div>';
    W.document.body.appendChild(box);
    return box;
  }
  function say(s) { D.state = s; ui(); const el = W.document.getElementById('diagState'); if (el) el.textContent = s; }
  function table() {
    ui(); const el = W.document.getElementById('diagTable'); if (!el) return;
    const base = D.variants.find(v => v.id === 'base');
    const rows = D.variants.map(v => '<tr' + (D.report && D.report.worst && D.report.worst.id === v.id ? ' class="worst"' : '') + '><td>' + esc(v.label) + '</td><td>' + (v.fps != null ? v.fps.toFixed(1) : '-') +
      '</td><td>' + (v.gpuMs != null ? v.gpuMs.toFixed(1) : '-') + '</td><td>' + (v.workMs != null ? v.workMs.toFixed(1) : '-') + '</td><td>' + (v.draws != null ? v.draws : '-') +
      '</td><td>' + (v.mtris != null ? v.mtris.toFixed(2) : '-') + '</td><td>' + (base && v !== base && v.gpuMs != null && base.gpuMs != null ? (base.gpuMs - v.gpuMs).toFixed(1) : '') + '</td></tr>').join('');
    el.innerHTML = '<table><tr><th>variant</th><th>fps</th><th>GPU ms</th><th>JS ms</th><th>draws</th><th>M tris</th><th>saves</th></tr>' + rows + '</table>';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function button(label, fn) { ui(); const b = W.document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; W.document.getElementById('diagBtns').appendChild(b); return b; }
  function download(name, text, type) {
    try { const u = URL.createObjectURL(new Blob([text], { type })); const a = W.document.createElement('a'); a.href = u; a.download = name; W.document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (e) { console.warn('diag download:', e); }
  }

  // ---- the readings ------------------------------------------------------------------------------------------------
  const REC = () => (W.FLIGHT_REC && !W.FLIGHT_REC.off ? W.FLIGHT_REC.rec : null);
  const med = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  // the rendered frames from recorder frame f0 on (a hidden gap, a frame under a screen left out)
  function readFrom(f0) {
    const R = REC(); if (!R) return null;
    const F = R.F || {}, dt = [], gpu = [], work = [], calls = [], tris = [];
    for (let f = f0; f < R.frame; f++) {
      const r = R.row(f); if (!r || !(r.dt === r.dt)) continue;
      const fl = r.flags | 0; if ((F.away && (fl & F.away)) || (F.boot && (fl & F.boot))) continue;
      dt.push(r.dt); if (r.gpu === r.gpu) gpu.push(r.gpu); if (r.work === r.work) work.push(r.work); if (r.calls === r.calls) calls.push(r.calls); if (r.tris === r.tris) tris.push(r.tris);
    }
    const sum = dt.reduce((a, b) => a + b, 0);
    return { frames: dt.length, fps: sum > 0 ? 1000 * dt.length / sum : null, medMs: med(dt), p90Ms: dt.length ? dt.slice().sort((a, b) => a - b)[Math.floor(dt.length * 0.9)] : null,
             gpuMs: med(gpu), gpuN: gpu.length, workMs: med(work), draws: med(calls), mtris: tris.length ? med(tris) / 1e6 : null };
  }
  // one rendered frame's draws and triangles by OWNER (the world scene's top-level child; potato_census.js's keys) and by target
  const rootOf = o => { let p = o; while (p.parent && p.parent.parent) p = p.parent; return p; };
  const keyOf = o => { const r = rootOf(o); return (r.name || (r.isMesh || r.isInstancedMesh ? (r.type + ':' + ((r.material && (r.material.name || r.material.type)) || '')) : r.type)) || '?'; };
  async function census() {
    const R = W.FLIGHT_PROBE && W.FLIGHT_PROBE.renderer && W.FLIGHT_PROBE.renderer(); if (!R) return null;
    const byOwner = {}, byTarget = {}; let target = 'canvas';
    const rbd = R.renderBufferDirect, srt = R.setRenderTarget;
    R.setRenderTarget = function (t) { target = t ? (t.width + 'x' + t.height + (t.samples ? ' s' + t.samples : '') + (t.isWebGLCubeRenderTarget ? ' cube' : '')) : 'canvas'; return srt.apply(this, arguments); };
    R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      try {
        let n = geometry.index ? geometry.index.count : (geometry.attributes.position ? geometry.attributes.position.count : 0);
        if (group) n = Math.min(n, group.count); if (geometry.drawRange.count !== Infinity) n = Math.min(n, geometry.drawRange.count);
        let inst = object.isInstancedMesh ? object.count : (geometry.isInstancedBufferGeometry ? geometry.instanceCount : 1); if (!(inst >= 0) || inst === Infinity) inst = 1;
        const tris = object.isMesh && !material.wireframe ? n / 3 * inst : 0;
        const add = (M, k) => { const e = M[k] || (M[k] = { draws: 0, ktris: 0 }); e.draws++; e.ktris += tris / 1000; };
        add(byOwner, keyOf(object)); add(byTarget, target);
      } catch (e) {}
      return rbd.apply(this, arguments);
    };
    const Rc = REC(), f0 = Rc ? Rc.frame : 0;
    await until(() => !Rc || Rc.frame > f0 + 1, 15000, 16);   // one whole rendered frame inside the wrap
    R.renderBufferDirect = rbd; R.setRenderTarget = srt;
    const out = M => Object.fromEntries(Object.entries(M).sort((a, b) => b[1].ktris - a[1].ktris).map(([k, v]) => [k, { draws: v.draws, ktris: Math.round(v.ktris) }]));
    return { byOwner: out(byOwner), byTarget: out(byTarget) };
  }

  // ---- the variants ------------------------------------------------------------------------------------------------
  const G = () => W.GFX;
  let orig = null, origStr = null;
  async function screensDone() { await sleep(300); await until(quiet, T.SCREEN_MS, 250); }
  function gfxSet(k, v) { const g = G(); if (!g) return; g.set(k, v); if (k !== 'fps' && typeof W.FLYDIY_SETTLE === 'function') W.FLYDIY_SETTLE(k); }
  async function measure(id, label, apply, undo) {
    say('measuring: ' + label + ' (' + (D.variants.length + 1) + ' / ' + D.plan + ')');
    let err = null;
    try { if (apply) await apply(); } catch (e) { err = 'apply: ' + (e && e.message); }
    await screensDone(); await sleep(T.SETTLE_MS);
    const R = REC(), f0 = R ? R.frame : 0;
    await sleep(T.WIN_MS);
    const m = readFrom(f0) || {};
    const v = Object.assign({ id, label }, m, err ? { err } : {});
    try { if (undo) await undo(); } catch (e) { v.err = (v.err ? v.err + '; ' : '') + 'undo: ' + (e && e.message); }
    await screensDone();
    D.variants.push(v); table();
    return v;
  }
  // a graphics row to `to` (skipped where it is already there)
  const rowV = (k, to, label) => ({ id: k + '=' + to, label: label || (k + ' ' + to), skip: () => !G() || G().get()[k] === to,
    apply: () => gfxSet(k, to), undo: () => gfxSet(k, orig[k]) });
  function restoreGfx() {
    const g = G(); if (!g || !orig) return;
    if (g.PRESETS[orig.preset] && g.get().preset !== orig.preset) g.set('preset', orig.preset);
    for (const o of g.OPTIONS) if (g.get()[o.k] !== orig[o.k] && !o.reload) g.set(o.k, orig[o.k]);
    try { if (origStr != null) W.localStorage.setItem('flydiy.gfx', origStr); } catch (e) {}
  }

  // ---- THE CALIBRATION (the laptop's trace, 2026-10-06: the GPU process slept ~140 ms a frame in the driver with ~1 ms of
  // CPU - the GPU itself was the wall - and the card read ~3x under its rating in the SHED too, ~5x in the world): the same
  // four small tests on every machine, on a WebGL2 context of their own, timed with the GPU timer - ALU (a dependent FMA
  // chain), TEXTURE (32 mip-mapped taps a pixel), TINY TRIANGLES (2 M half-pixel triangles: the world's far ground and
  // trees), BLEND FILL (half-float, 32 layers) - each the median of 5 batches after 2 warm-ups. Reported as rates, against
  // this card's rating (SPEC, FP32 TFLOPS at boost) and against the reference box's 3080 on the same tests (REF): 'the card
  // runs at X % of its class' separates a machine that is slow everywhere (clocks, power, a driver state) from a slow path
  // in the game's own content (the variants above). The game's own renders are muted while it runs.
  const SPEC = [[/RTX\s*4090/i, 82.6], [/RTX\s*4080/i, 48.7], [/RTX\s*4070/i, 29.1], [/RTX\s*4060/i, 15.1], [/RTX\s*3090/i, 35.6], [/RTX\s*3080/i, 29.8], [/RTX\s*3070/i, 20.3],
    [/RTX\s*3060/i, 12.7], [/RTX\s*3050/i, 9.1], [/RTX\s*2080/i, 10.1], [/RTX\s*2070/i, 7.5], [/RTX\s*2060/i, 6.5], [/0x00002191/i, 4.6], [/GTX\s*1660\s*Ti/i, 5.4],
    [/GTX\s*1660/i, 5.0], [/GTX\s*1650/i, 2.9], [/GTX\s*1080/i, 8.9], [/GTX\s*1070/i, 6.5], [/GTX\s*1060/i, 4.4], [/GTX\s*1050\s*Ti/i, 2.1], [/GTX\s*1050/i, 1.9],
    [/GTX\s*980/i, 5.0], [/GTX\s*970/i, 3.9], [/GTX\s*960/i, 2.3], [/GTX\s*760/i, 2.3], [/GTX\s*660/i, 1.9], [/Iris.*Xe/i, 2.1], [/UHD.*6[23]0|HD.*6[23]0/i, 0.42],
    [/RX\s*6600/i, 8.9], [/RX\s*580/i, 6.2], [/RX\s*570/i, 5.1]];
  // the reference box (RTX 3080, i7-13700KF; G1997, measured by this code - HANDOVER G1997): null until measured
  const REF = { gpu: 'RTX 3080', alu: null, tex: null, tri: null, fill: null };
  async function bench() {
    const cv = W.document.createElement('canvas'); cv.width = cv.height = 8;
    const gl = cv.getContext('webgl2', { antialias: false, depth: false, powerPreference: 'high-performance' });
    if (!gl) return { err: 'no WebGL2 context' };
    const X = gl.getExtension('EXT_disjoint_timer_query_webgl2'); gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_color_buffer_half_float');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info'), name = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    const N = 1024;
    const target = (internal, fmt, type) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, internal, N, N);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return fb; };
    const fb8 = target(gl.RGBA8), fb16 = target(gl.RGBA16F);
    const FSQ = '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const vaoQ = gl.createVertexArray(); gl.bindVertexArray(vaoQ); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ITER = 512;
    const pALU = prog(FSQ, '#version 300 es\nprecision highp float; uniform float u; out vec4 o; void main(){ vec4 a = vec4(gl_FragCoord.xy * 1e-3, u, 1.0); vec4 c = vec4(0.1, 0.2, 0.3, 0.4) * u;\n' +
      ' for (int i = 0; i < ' + ITER + '; i++) { a = a * a * 0.999 + c; } o = a; }');
    const TAPS = 32;
    const pTEX = prog(FSQ, '#version 300 es\nprecision highp float; uniform sampler2D t; uniform float u; out vec4 o; void main(){ vec2 q = gl_FragCoord.xy / 1024.0; vec4 a = vec4(0.0);\n' +
      ' for (int i = 0; i < ' + TAPS + '; i++) { a += texture(t, q * (1.0 + float(i) * 0.37) + vec2(float(i) * 0.013, u)); } o = a / ' + TAPS + '.0; }');
    const pFILL = prog(FSQ, '#version 300 es\nprecision mediump float; uniform float u; out vec4 o; void main(){ o = vec4(0.01, 0.02, 0.03, 0.5) + u * 1e-4; }');
    const pTRI = prog('#version 300 es\nin vec2 p; uniform float u; void main(){ gl_Position = vec4(p + u * 1e-6, 0.0, 1.0); }', '#version 300 es\nprecision mediump float; out vec4 o; void main(){ o = vec4(0.5); }');
    // the texture: 2048 x 2048 RGBA8 noise, mip-mapped
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texStorage2D(gl.TEXTURE_2D, 12, gl.RGBA8, 2048, 2048);
    { const px = new Uint8Array(2048 * 2048 * 4); let s = 12345; for (let i = 0; i < px.length; i++) { s = (s * 1103515245 + 12345) >>> 0; px[i] = s >>> 24; }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 2048, 2048, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); }
    // the triangles: a 1000 x 1000 grid of quads over the target (2 M triangles of ~half a pixel each)
    const G = 1000, vtx = new Float32Array((G + 1) * (G + 1) * 2), idx = new Uint32Array(G * G * 6);
    for (let y = 0, k = 0; y <= G; y++) for (let x = 0; x <= G; x++) { vtx[k++] = x / G * 2 - 1; vtx[k++] = y / G * 2 - 1; }
    for (let y = 0, k = 0; y < G; y++) for (let x = 0; x < G; x++) { const a = y * (G + 1) + x; idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + G + 1; idx[k++] = a + 1; idx[k++] = a + G + 2; idx[k++] = a + G + 1; }
    const vaoT = gl.createVertexArray(); gl.bindVertexArray(vaoT);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, vtx, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.viewport(0, 0, N, N); gl.disable(gl.DEPTH_TEST);
    let u = 1;
    const draw = (p, vao, fb, n, fn) => { gl.useProgram(p); gl.bindVertexArray(vao); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.uniform1f(gl.getUniformLocation(p, 'u'), (u = u * 0.999 + 0.001));
      for (let i = 0; i < n; i++) fn(); };
    const T3 = () => gl.drawArrays(gl.TRIANGLES, 0, 3), TG = () => gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
    // one batch, timed: the GPU timer's ms (a disjoint batch is read again), else the wall with a finish and a 1-pixel read
    const px1 = new Uint8Array(4);
    async function timeBatch(fn) {
      if (X) {
        const q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); fn(); gl.endQuery(X.TIME_ELAPSED_EXT); gl.flush();
        for (let i = 0; i < 400; i++) { await sleep(10); if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; }
        const ok = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(X.GPU_DISJOINT_EXT);
        const ms = ok ? gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 : null; gl.deleteQuery(q); return ms;
      }
      gl.finish(); const t0 = now(); fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); return now() - t0;
    }
    async function test(fn) { for (let i = 0; i < 2; i++) await timeBatch(fn); const m = []; for (let i = 0; i < 5; i++) { const v = await timeBatch(fn); if (v != null) m.push(v); } return med(m); }
    const out = { gpu: name, timer: !!X, spec: null };
    try {
      gl.disable(gl.BLEND);
      const aluMs = await test(() => draw(pALU, vaoQ, fb8, 8, T3));            // 8 x 1 M px x 512 iterations x 24 flops (4-wide: 2 FMA + 1 mul)
      out.aluMs = r1(aluMs); out.alu = aluMs ? Math.round(8 * N * N * ITER * 24 / (aluMs * 1e6)) : null;   // GFLOP/s
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const texMs = await test(() => draw(pTEX, vaoQ, fb8, 4, T3));
      out.texMs = r1(texMs); out.tex = texMs ? Math.round(4 * N * N * TAPS / (texMs * 1e6)) : null;        // G texel / s
      const triMs = await test(() => draw(pTRI, vaoT, fb8, 4, TG));
      out.triMs = r1(triMs); out.tri = triMs ? Math.round(4 * G * G * 2 / (triMs * 1e3)) : null;            // M triangles / s
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const fillMs = await test(() => draw(pFILL, vaoQ, fb16, 32, T3));
      gl.disable(gl.BLEND);
      out.fillMs = r1(fillMs); out.fill = fillMs ? Math.round(32 * N * N / (fillMs * 1e6) * 10) / 10 : null;   // G pixels / s
    } catch (e) { out.err = String(e && e.message || e).slice(0, 300); }
    const sp = SPEC.find(([re]) => re.test(name)); out.spec = sp ? sp[1] : null;
    if (REF.alu && out.alu) out.vsRef = { alu: +(out.alu / REF.alu).toFixed(3), tex: REF.tex && out.tex ? +(out.tex / REF.tex).toFixed(3) : null,
      tri: REF.tri && out.tri ? +(out.tri / REF.tri).toFixed(3) : null, fill: REF.fill && out.fill ? +(out.fill / REF.fill).toFixed(3) : null };
    // this card against its own rating: the 3080's measured ALU per rated TFLOP is the yardstick (the test's own efficiency)
    if (REF.alu && out.alu && out.spec) { const per = REF.alu / 29.8; out.ofClass = Math.round(100 * out.alu / (per * out.spec)); }
    try { const L = gl.getExtension('WEBGL_lose_context'); if (L) L.loseContext(); } catch (e) {}
    return out;
  }
  async function benchMuted() {
    const R = W.FLIGHT_PROBE && W.FLIGHT_PROBE.renderer && W.FLIGHT_PROBE.renderer();
    const r0 = R && R.render; if (R) R.render = function () {};   // the game's frames draw nothing while the tests run
    try { await sleep(300); return await bench(); } finally { if (R) R.render = r0; }
  }
  D.bench = bench;

  // ---- the run -----------------------------------------------------------------------------------------------------
  async function run() {
    if (/[?&]diag=bench/.test(Q)) {   // the calibration alone (~15 s, no game needed)
      ui(); say('waiting for the game to load, then measuring this graphics card (about 15 s)…');
      await until(() => W.BOOT && quiet() && inShed(), T.LOAD_MS, 500);   // (the load's own GPU work would be in the numbers)
      say('measuring this graphics card (about 15 s)…');
      const b = await benchMuted(); D.report = { kind: 'flydiy-diag', v: 1, at: new Date().toISOString(), bench: b, browser: { ua: W.navigator.userAgent } };
      try { W.localStorage.setItem('flydiy.diag.last', JSON.stringify(D.report)); } catch (e) {}
      say('done: ' + benchWords(b)); button('download report (.json)', () => download('flydiy-bench-' + stamp() + '.json', JSON.stringify(D.report, null, 1), 'application/json'));
      return;
    }
    ui(); say('waiting for the game to load (the self-test starts once the shed is up)…');
    const t0 = now();
    if (!(await until(() => W.BOOT && W.GFX && W.FLIGHT_PROBE && quiet() && inShed(), T.LOAD_MS, 500))) { say('the game did not finish loading in 15 min - the report has what there is'); }
    const loadS = (now() - t0) / 1000;
    try { origStr = W.localStorage.getItem('flydiy.gfx'); } catch (e) {}
    orig = G() ? G().get() : null;
    if (G() && G().hw && G().hw.hold) G().hw.hold(true);
    // the roll-out, the stand, the pause, the fixed camera
    say('rolling out to the stand…');
    const bGo = W.document.getElementById('bGo'); if (bGo) bGo.click();
    await until(() => !inShed() && quiet(), T.SCREEN_MS, 250);
    await sleep(4000);
    const bP = W.document.getElementById('bPause'); if (bP && !bP.hidden && /pause/i.test(bP.textContent || '')) bP.click();
    const FP = W.FLIGHT_PROBE;
    try { if (FP.camModeNow && FP.camModeNow() !== 'orbit') FP.camMode('orbit'); await sleep(500); FP.camSettle(); const c = FP.cam(); FP.camSet(c.azT, c.elT, c.distT); } catch (e) {}
    await sleep(2000);
    say('counting the frame by owner…');
    const cen = await census();
    // the plan
    const V = [{ id: 'base', label: 'as it is (' + (orig ? orig.preset : '?') + ')' }];
    const rows = [['shadows', 'off'], ['glare', 'off'], ['cover', 'off'], ['mist', 'off'], ['ground', 'plain'], ['terrain', 6], ['scenery', 'low'],
                  ['rails', 'off'], ['poles', 'off'], ['clouds', 'off'], ['water', 'simple'], ['mirror', 'off'], ['aa', 'off'], ['bloom', 'off'], ['eye', 'off'], ['scale', 0.5]];
    for (const [k, v] of rows) { const r = rowV(k, v); if (!r.skip()) V.push(r); }
    if (!QUICK) {
      V.push({ id: 'catcher=off', label: 'frame catcher off (its copy + query)', skip: () => !(W.POST_FX && W.POST_FX.catcher && W.POST_FX.catcher.on),
        apply: () => { W.POST_FX.catcher.on = false; }, undo: () => { W.POST_FX.catcher.on = true; } });
      // the biggest owners of the frame's triangles and draws, each hidden (the census's keys; at most 8)
      const WS = W.WORLD && W.WORLD.scene;
      if (cen && WS) {
        const tot = Object.values(cen.byOwner).reduce((a, e) => ({ d: a.d + e.draws, t: a.t + e.ktris }), { d: 0, t: 0 });
        const big = Object.entries(cen.byOwner).filter(([k, e]) => e.ktris >= 0.03 * tot.t || e.draws >= 0.05 * tot.d).slice(0, 8).map(([k]) => k);
        for (const k of big) {
          const list = WS.children.filter(c => keyOf(c) === k);   // (keyOf: the world scene's top-level child - the census's owner)
          if (!list.length) continue;
          let was = null;
          V.push({ id: 'hide:' + k, label: 'hidden: ' + k, apply: () => { was = list.map(o => o.visible); list.forEach(o => { o.visible = false; }); }, undo: () => { list.forEach((o, i) => { o.visible = was[i]; }); } });
        }
      }
      const craft = W.FLIGHT_PROBE.craft && W.FLIGHT_PROBE.craft();
      if (craft) V.push({ id: 'hide:craft', label: 'hidden: the aeroplane', apply: () => { craft.visible = false; }, undo: () => { craft.visible = true; } });
      V.push({ id: 'timer=off', label: 'GPU timer off (frame time only)', skip: () => !(W.FLIGHT_REC && W.FLIGHT_REC.gpuTimer && W.FLIGHT_REC.gpuTimer()),
        apply: () => W.FLIGHT_REC.gpuTimer(false), undo: () => W.FLIGHT_REC.gpuTimer(true) });
      const ORDER = ['laptop', 'potato', 'retro', 'current', 'gamer', 'ultra'], i = orig ? ORDER.indexOf(orig.preset) : -1;
      for (let j = i - 1; j >= 0 && j >= i - 2; j--) { const p = ORDER[j]; V.push({ id: 'preset=' + p, label: 'preset ' + p, apply: () => gfxSet('preset', p), undo: () => restoreGfx() }); }
      V.push({ id: 'base2', label: 'as it is, again (drift)' });
    }
    const plan = V.filter(v => !v.skip || !v.skip());
    D.plan = plan.length;
    for (const v of plan) await measure(v.id, v.label, v.apply, v.undo);
    restoreGfx();
    say('measuring the graphics card itself (the game paused, about 15 s)…');
    let b = null; try { b = await benchMuted(); } catch (e) { b = { err: String(e && e.message) }; }
    if (G() && G().hw && G().hw.hold) G().hw.hold(false);
    D.report = report(cen, loadS);
    D.report.bench = b;
    try { W.localStorage.setItem('flydiy.diag.last', JSON.stringify(D.report)); } catch (e) {}
    table(); say('done - ' + (D.report.worst ? 'the worst offender: ' + D.report.worst.label + ' (saves ' + D.report.worst.saves + ' ms of ' + D.report.worst.of + ')' : 'no single offender') + '. Download the report and send it.');
    button('download report (.json)', () => download('flydiy-diag-' + stamp() + '.json', JSON.stringify(D.report, null, 1), 'application/json'));
    button('download report (.txt)', () => download('flydiy-diag-' + stamp() + '.txt', text(D.report), 'text/plain'));
    if (!/[?&]ktx2=0/.test(Q)) button('again without KTX2 (reloads)', () => { try { W.sessionStorage.setItem('flydiy.diag.prev', JSON.stringify(D.report)); } catch (e) {} W.location.search = Q + (Q ? '&' : '?') + 'ktx2=0'; });
    else { let prev = null; try { prev = JSON.parse(W.sessionStorage.getItem('flydiy.diag.prev') || 'null'); } catch (e) {} if (prev) D.report.withKtx2 = prev; }
  }
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);

  function glInfo() {
    const R = W.FLIGHT_PROBE && W.FLIGHT_PROBE.renderer && W.FLIGHT_PROBE.renderer(), gl = R && R.getContext && R.getContext();
    if (!gl) return null;
    const ex = gl.getSupportedExtensions() || [], dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const want = ['EXT_disjoint_timer_query_webgl2', 'EXT_clip_control', 'KHR_parallel_shader_compile', 'EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'EXT_float_blend',
      'OES_texture_float_linear', 'EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc', 'WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc', 'EXT_texture_filter_anisotropic', 'WEBGL_multi_draw', 'OVR_multiview2'];
    const P = n => { try { return gl.getParameter(gl[n]); } catch (e) { return null; } };
    return { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION), glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION), attrs: gl.getContextAttributes(),
      ext: Object.fromEntries(want.map(n => [n, ex.indexOf(n) >= 0])), extCount: ex.length,
      maxTex: P('MAX_TEXTURE_SIZE'), max3D: P('MAX_3D_TEXTURE_SIZE'), maxLayers: P('MAX_ARRAY_TEXTURE_LAYERS'), maxSamples: P('MAX_SAMPLES'), maxRB: P('MAX_RENDERBUFFER_SIZE'),
      maxVSTex: P('MAX_VERTEX_TEXTURE_IMAGE_UNITS'), maxFSTex: P('MAX_TEXTURE_IMAGE_UNITS'), maxViewport: P('MAX_VIEWPORT_DIMS') ? Array.from(P('MAX_VIEWPORT_DIMS')) : null,
      programs: R.info && R.info.programs ? R.info.programs.length : null, memory: R.info ? Object.assign({}, R.info.memory) : null,
      aa: W.FLYDIY_AA && W.FLYDIY_AA.report ? W.FLYDIY_AA.report() : null };
  }
  function report(cen, loadS) {
    const base = D.variants.find(v => v.id === 'base') || {};
    const useGpu = base.gpuMs != null;
    let worst = null;
    for (const v of D.variants) {
      if (/^(base|base2|timer=off|preset=)/.test(v.id)) continue;
      const s = useGpu ? (v.gpuMs != null ? base.gpuMs - v.gpuMs : null) : (v.medMs != null && base.medMs != null ? base.medMs - v.medMs : null);
      if (s != null && (!worst || s > worst.s)) worst = { s, v };
    }
    const BL = W.BOOT && W.BOOT.log ? W.BOOT.log.filter(e => e.k === 'step' && e.ms != null).map(e => ({ id: e.id, ms: e.ms, at: e.t })) : [];
    const ua = W.navigator.userAgent, chrome = /Chrome\/([\d.]+)/.exec(ua);
    return {
      kind: 'flydiy-diag', v: 1, at: new Date().toISOString(), url: W.location.href.replace(/[?#].*$/, '') + Q,
      build: W.FLYDIY_BUILD || null, version: W.STORAGE && W.STORAGE.local ? W.STORAGE.local : null,
      browser: { ua, chrome: chrome ? chrome[1] : null, cores: W.navigator.hardwareConcurrency || null, memGB: W.navigator.deviceMemory || null,
        screen: (W.screen.width || 0) + 'x' + (W.screen.height || 0), window: W.innerWidth + 'x' + W.innerHeight, dpr: W.devicePixelRatio,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null },
      welcome: W.WELCOME ? { gpu: W.WELCOME.env && W.WELCOME.env.gpu, decision: W.WELCOME.decision ? { suggest: W.WELCOME.decision.suggest, why: W.WELCOME.decision.why, gpuCls: W.WELCOME.decision.gpu && W.WELCOME.decision.gpu.cls } : null } : null,
      gl: glInfo(), gfx: orig, budget: W.GFX && W.GFX.budget ? W.GFX.budget() : null, hwstep: W.GFX && W.GFX.hw ? W.GFX.hw.state() : null,
      pace: W.FLYDIY_PACE && W.FLYDIY_PACE.state ? W.FLYDIY_PACE.state() : null,
      load: { seconds: r1(loadS), steps: BL }, census: cen,
      variants: D.variants.map(v => ({ id: v.id, label: v.label, frames: v.frames, fps: r1(v.fps), medMs: r1(v.medMs), p90Ms: r1(v.p90Ms), gpuMs: r1(v.gpuMs), gpuN: v.gpuN, workMs: r1(v.workMs), draws: v.draws, mtris: v.mtris != null ? Math.round(v.mtris * 100) / 100 : null, err: v.err })),
      worst: worst ? { id: worst.v.id, label: worst.v.label, saves: r1(worst.s), of: r1(useGpu ? base.gpuMs : base.medMs), by: useGpu ? 'GPU ms' : 'frame ms' } : null,
    };
  }
  function text(R) {
    const L = [];
    L.push('flyDiy self-test ' + R.at + '  build ' + R.build);
    L.push('browser Chrome ' + (R.browser.chrome || '?') + ' · ' + R.browser.cores + ' threads · ' + (R.browser.memGB || '?') + ' GB · screen ' + R.browser.screen + ' · window ' + R.browser.window + ' · DPR ' + R.browser.dpr);
    if (R.gl) { L.push('GPU ' + R.gl.renderer); L.push('WebGL ' + Object.entries(R.gl.ext).map(([k, v]) => (v ? '+' : '-') + k).join(' ')); L.push('depth ' + (R.gl.aa ? R.gl.aa.depth + ', target ' + R.gl.aa.buf + ', samples ' + R.gl.aa.samples : '?') + ' · programs ' + R.gl.programs + ' · textures ' + (R.gl.memory && R.gl.memory.textures)); }
    L.push('preset ' + (R.gfx ? R.gfx.preset : '?') + (R.welcome && R.welcome.decision ? ' (the welcome suggested ' + R.welcome.decision.suggest + ')' : '') + ' · load ' + R.load.seconds + ' s');
    L.push('load steps: ' + R.load.steps.map(s => s.id + ' ' + (s.ms / 1000).toFixed(1)).join(', '));
    if (R.census) L.push('the frame by owner (draws / k tris): ' + Object.entries(R.census.byOwner).slice(0, 12).map(([k, v]) => k + ' ' + v.draws + '/' + v.ktris).join(', '));
    L.push('');
    L.push(['variant', 'fps', 'frame ms', 'GPU ms', 'JS ms', 'draws', 'M tris'].join('\t'));
    for (const v of R.variants) L.push([v.label, v.fps, v.medMs, v.gpuMs, v.workMs, v.draws, v.mtris].join('\t') + (v.err ? '\t' + v.err : ''));
    L.push('');
    if (R.bench) L.push('THE CARD ITSELF: ' + benchWords(R.bench));
    L.push(R.worst ? 'WORST OFFENDER: ' + R.worst.label + ' - saves ' + R.worst.saves + ' of ' + R.worst.of + ' ' + R.worst.by : 'no single offender');
    return L.join('\n');
  }
  function benchWords(b) {
    if (!b || b.err) return 'the calibration failed (' + (b && b.err) + ')';
    return 'ALU ' + b.alu + ' GFLOP/s, texture ' + b.tex + ' Gtexel/s, tiny triangles ' + b.tri + ' Mtri/s, blend fill ' + b.fill + ' Gpix/s' +
      (b.vsRef ? ' - against the reference RTX 3080: ALU ' + Math.round(100 * b.vsRef.alu) + ' %, texture ' + Math.round(100 * b.vsRef.tex) + ' %, triangles ' + Math.round(100 * b.vsRef.tri) + ' %, fill ' + Math.round(100 * b.vsRef.fill) + ' %' : '') +
      (b.ofClass != null ? ' - this card runs at ' + b.ofClass + ' % of its rating (' + b.spec + ' TFLOPS)' + (b.ofClass < 50 ? ': FAR UNDER IT - its clocks, its power limit or its driver state, not the game' : '') : (b.spec ? ' (rated ' + b.spec + ' TFLOPS)' : '')) + (b.timer ? '' : ' (no GPU timer: wall time)');
  }
  D.text = () => (D.report ? text(D.report) : '');
  D.run = run;
  run().catch(e => { say('the self-test stopped: ' + (e && e.message)); try { restoreGfx(); } catch (x) {} if (G() && G().hw && G().hw.hold) G().hw.hold(false); });
})();
