// flight_recorder.js - THE FLIGHT RECORDER AND THE FPS METER (G620, the Jolene playtest plan, batch A)
//
// The user plays; this writes down every frame, so a stutter can be read off a file instead of a memory.
// Always on, from the first script to the last frame:
//   - A RING of frames (65 536, ~18 min at 60 fps, ~36 at 30) in preallocated typed arrays - the frame's
//     path allocates NOTHING: one row of numbers a rendered frame, written in place.
//     A row: the wall interval since the last rendered frame (rAF's own clock, a freeze counts), the loop's
//     own work, the solver steps owed and taken, the loop's CPU split (the pilot's script, the solver, the
//     world's update and within it the premises' stream step, the cover ring and the forest's fill, the
//     scene's posing, the HUD, the water's mirror, the render submit, the shadow passes, the shader links,
//     the rest), the GPU time of the frame (EXT_disjoint_timer_query_webgl2, when the browser has it and no
//     other module's timer is running), the draw calls and triangles (renderer.info, every render of the
//     frame summed), where the aeroplane is (position, height above the ground, speed, climb), the
//     autopilot's phase, the camera, the frame cap, the JS heap.
//   - EVENTS beside the rows: long tasks (PerformanceObserver 'longtask', and 'long-animation-frame' with the
//     scripts it names where Chrome has it), shader links and the time the driver held the page for them,
//     the premises built by the stream, the graphics settings changed, the frame cap's switches, the boot's
//     states (the loading screens; `reveal` = the roll-out screen gone), heap drops (GC-ish), page errors,
//     the page hidden/shown, and the player's own MARKS (a click on the meter).
//   - A HEADER: the build, the browser, the GPU (WEBGL_debug_renderer_info), the screen, the canvas, the
//     DPR, the graphics settings, the aeroplane, and the recorder's own cost as measured on this machine.
//   - SAVED to IndexedDB as it goes (a chunk of 1 024 frames when it fills, the partial chunk every 5 s and
//     on pagehide), so a page that froze or was killed still has its log at the next load; the GRAPHICS
//     flyout's `flight log` row downloads this session or the one before as JSON (tools/analyze_log.js reads
//     it). Four sessions are kept.
//
// THE HOOKS. app.js calls begin(ts, pace) once a rendered frame, lap(slot) at the loop's section
// boundaries, push(slot)/pop() round the pilot's script and each solver step, and end(rendered, cg) at the
// bottom; render_world.js pushes/pops round the premises' step, the cover ring and the fill. The timing is
// all performance.now() differences: a lap gives the time since the previous lap to its slot, minus what
// nested pushes (and the renderer wrappers: the shadow map's render, the shader links) took, so the split
// sums to the frame's work exactly. NOTHING HERE CHANGES WHAT THE FRAME DOES: the wrappers call through with
// the same arguments and return the same value; a timer query is begun only when nobody else's is open,
// and yields (ends itself first) the moment another module begins one. `?rec=0` (or localStorage
// flydiy.rec.off = '1') leaves the page unhooked - the A/B for the recorder's own cost.
//
// THE FPS METER (the graphics flyout's `fps meter` row; off by default, remembered in flydiy.rec): the
// rendered frames' rate over the last 2 s, the frame interval's median / p90 / max there, the frame cap
// (auto 60 / 30), the solver steps of the last frame, the CPU work and the GPU time, and a sparkline of the
// last 120 frames (16.7 and 33.3 ms lines; a frame over 100 ms is red to the top). A freeze COUNTS. The meter takes
// no clicks except its yellow dot, which MARKS the moment in the log.
(function () {
  'use strict';
  const W = (typeof window !== 'undefined') ? window : null;
  if (!W) return;
  const perf = (typeof performance !== 'undefined' && performance.now) ? performance : { now: () => Date.now(), timeOrigin: Date.now() };
  const now = () => perf.now();
  const q = (W.location && W.location.search) || '';
  let OFF = /[?&]rec=0/.test(q), NOGPU = /[?&]recgpu=0/.test(q);
  try { if (W.localStorage && W.localStorage.getItem('flydiy.rec.off') === '1') OFF = true; } catch (e) {}
  try { if (W.localStorage && W.localStorage.getItem('flydiy.rec.gpu') === '0') NOGPU = true; } catch (e) {}   // (the GPU timer alone off)

  // ---- the row --------------------------------------------------------------------------------------------
  // the CPU slots (ms): a lap or a push names one; `other` takes the loop's remaining sections
  const SLOTS = ['script', 'solver', 'world', 'prem', 'cover', 'fill', 'scene', 'hud', 'mirror', 'render', 'shadow', 'shader', 'other'];
  const S = {}; SLOTS.forEach((k, i) => { S[k] = i; });
  const NS = SLOTS.length;
  // the columns of a row (the frame's time `t`, ms on performance.now()'s clock, is its own Float64 column)
  const COLS = ['dt', 'work', 'owed', 'taken'].concat(SLOTS).concat(
    ['gpu', 'calls', 'tris', 'x', 'y', 'z', 'agl', 'spd', 'vs', 'phase', 'cam', 'flags', 'cap', 'heap',
     // G820 (C1c): THE PHYSICS WORKER'S (?simw): its step's cost (ms, eased), its dilation (sim s over wall s, the last
     // second) and the steps the picture moved on this frame - NaN when the flight is the page's own (inline)
     'wms', 'wdil', 'wran']);
  const C = {}; COLS.forEach((k, i) => { C[k] = i; });
  const NC = COLS.length, C_SLOT0 = C.script;
  // flags: what the frame was
  const F = { garage: 1, running: 2, held: 4, manual: 8, away: 16, freeze: 32, boot: 64, gpuForeign: 128, noRender: 256 };
  const FREEZE_MS = 250;              // PACE's own line for a stall (app.js): a frame this long is a freeze, kept and flagged

  function make(opt) {
    opt = opt || {};
    const N = opt.frames || 65536;                  // a power of two, a multiple of CHUNK
    const CHUNK = opt.chunk || 1024;
    const clock = opt.now || now;
    const ringF = new Float32Array(N * NC), ringT = new Float64Array(N);
    const acc = new Float64Array(NS);
    // the push stack (a wrapper inside a wrapper nests; 8 deep is more than the frame has)
    const stT = new Float64Array(8), stChild = new Float64Array(8), stSlot = new Int32Array(8);
    // THE CLOCK'S STATE IS IN A Float64Array, not in closure variables: V8 boxes a double stored into a closure's
    // context (a fresh heap number a store), and the frame's path must allocate nothing (GATE FLIGHTREC counts it)
    const V = new Float64Array(14), LAST = 0, T0 = 1, NESTED = 2, LASTTS = 3, HIDDEN = 4, HEAP = 5, HEAPPREV = 6, SELF_US = 7, SELF_MAX = 8, SAMP = 9, SAMP_MAX = 10, SAMP_SUM = 11, SAMP_GL = 12, SAMP_GL_SUM = 13;
    V[HEAP] = NaN; V[HEAPPREV] = NaN; V[HIDDEN] = -1;
    // THE RECORDER TIMES ITSELF, every 17th frame (`samp`; 17 so the samples fall on every phase of the periodic reads
    // - the GPU results every 4th frame, the cap every 16th, the heap every 64th - and the mean is unbiased): each hook adds its own entry-to-exit time to V[SAMP] - the
    // whole cost of a frame's recording, measured live on the player's machine (the header's overhead.frameUsMean) -
    // and the GPU timer's GL calls apart (V[SAMP_GL]: a GL call also waits when the GPU's command buffer is full, a
    // wait the frame's next GL call would have paid). A frame under a loading screen is not a sample.
    let depth = 0, open = false, fi = 0, taken = 0, owed = 0, selfN = 0, samp = false, sampN = 0;
    let calls = 0, tris = 0, lastCap = -1, lastBoot = '', revealAt = -1, freezes = 0;
    // G1995 (HW-COVERAGE): THE REVEAL IS THE FLIGHT'S, NOT THE SCREEN'S. A roll-out whose plan is empty (the world built in
    // the one loading, B9 - every first roll-out of a boot that finished) reveals with no screen at all, and the reveal was
    // only ever marked on a roll-out screen gone: the user's GTX 660 log (4 Oct) and the 1660 Ti log (5 Oct) both read
    // NO REVEAL and the analyzer scored nothing. app.js's flRevealStart now says so (reveal()); the screen's own line stays
    // for a screen that lifts on its own, and one reveal is kept per hand-over (2 s apart)
    let lastReveal = -1e9;
    // G1532b.1 (POTATO-DEEP): THE SKY AT THE REVEAL, and 10 s later (the layer's bake) - the cloud pass's state, the day's cover, the
    // resolve target: the user's train 38 laptop log showed no cloud pass from boot until a preset re-apply, and nothing in the log
    // said why (the box, booted from the same saved graphics, runs it); an event 'sky' answers it from the next log
    function sky(tag) { try { const C = W.CLOUDS, AA = W.FLYDIY_AA, D = W.DAY_CLOCK && W.DAY_CLOCK.day && W.DAY_CLOCK.day(), T = AA && AA.target && AA.target();
      event('sky', clock(), null, { at: tag, clouds: C ? { mode: C.S.mode, ready: C.ready, active: C.active, baked: C.baked, cover: C.stats && +(+C.stats.cover).toFixed(3) } : null,
        day: D ? { cloudCover: D.cloudCover, cloudType: D.cloudType, upper: D.cloudUpper ? D.cloudUpper.length : 0 } : null,
        aa: AA && AA.report ? (r => ({ tier: r.tier, able: r.able, samples: r.samples, target: T ? T.width + 'x' + T.height : null }))(AA.report()) : null }); } catch (e) {} }
    function revealSky() { sky('reveal'); setTimeout(() => sky('reveal+10s'), 10000); }
    function reveal(how) { const t = clock(); if (t - lastReveal < 2000) return; lastReveal = t; revealAt = t; event('reveal', t, null, how || 'the flight'); revealSky(); }
    // G1340 THE SHADER WATCHDOG: the programs three made since the last frame closed (name + what changed in its key against
    // the last program of that name: three's key is comma-joined, '#i:a>b' per differing field) and the link waits since;
    // a frame whose shader time (its slot, or the waits held since the last frame - a wait outside the open frame counts)
    // passes WATCH_MS is an event 'shaderslow' naming them (the user's 79 s frames had a 54 ms slot and 79 s of waits)
    const WATCH_MS = 50, NP = { list: [], more: 0, waitMs: 0, last: new Map() };
    function newProgram(p) {
      const name = (p && p.name) || '', key = String((p && p.cacheKey) || ''), prev = NP.last.get(name);
      let why = 'first of its name';
      if (prev !== undefined) {
        const a = prev.split(','), b = key.split(',');
        if (a.length !== b.length) why = 'key ' + a.length + '>' + b.length + ' fields';
        else { const d = []; for (let i = 0; i < b.length && d.length < 3; i++) if (a[i] !== b[i]) d.push('#' + i + ':' + a[i].slice(0, 16) + '>' + b[i].slice(0, 16)); why = d.length ? d.join(' ') : 'same key, re-made'; }
      }
      NP.last.set(name, key);
      if (NP.list.length < 12) NP.list.push((name || '(unnamed)') + ' ' + why); else NP.more++;
    }
    const probeOut = { garage: false, running: false, held: false, manual: false, phase: '', cam: '', spd: NaN, vs: NaN, agl: NaN, wms: NaN, wdil: NaN, wran: NaN };
    const names = { phase: [''], cam: [''] }, codes = { phase: new Map([['', 0]]), cam: new Map([['', 0]]) };
    const codeOf = (k, s) => { if (typeof s !== 'string') return 0; let c = codes[k].get(s); if (c === undefined) { c = names[k].length; names[k].push(s); codes[k].set(s, c); } return c; };
    // events: [t, kind, ms, detail]; the rare path, so plain arrays (capped)
    const EV_CAP = opt.eventCap || 40000;
    let events = [], evDropped = 0, evSaved = 0;
    // the page's hidden moments (a tab away), on this recorder's clock: a gap spanning one is not a frame, not a freeze
    if (W.document && W.document.addEventListener) W.document.addEventListener('visibilitychange', () => { if (W.document.hidden) V[HIDDEN] = clock(); });
    const rec = {
      sid: opt.sid || (new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '') + '-' + Math.floor(Math.random() * 1e6).toString(36)),
      started: new Date().toISOString(), probe: null, info: null, renderer: null,
      gpu: { ext: null, gl: null, pool: [], pend: [], pendF: [], active: null, activeF: -1, spoiled: false, foreignF: -1e9, ok: 0, bad: 0, foreign: 0 },
    };

    function event(kind, t, ms, detail) {
      if (events.length >= EV_CAP) { events.splice(0, 1000); evDropped += 1000; evSaved = Math.max(0, evSaved - 1000); }
      events.push([Math.round((t == null ? clock() : t) * 100) / 100, kind, ms == null ? null : Math.round(ms * 100) / 100, detail == null ? null : detail]);
    }

    // ---- the frame's clock --------------------------------------------------------------------------------
    function push(s) {
      if (!open) return;
      if (depth < 8) { stT[depth] = clock(); stSlot[depth] = s; stChild[depth] = 0; }
      depth++;
      if (s === 1) taken++;                          // a solver step taken
      if (samp && depth <= 8) V[SAMP] += clock() - stT[depth - 1];
    }
    function pop() {
      if (!open || depth <= 0) return;
      depth--;
      if (depth >= 8) return;
      const tp = clock(), d = tp - stT[depth];
      acc[stSlot[depth]] += d - stChild[depth];
      if (depth > 0) stChild[depth - 1] += d; else V[NESTED] += d;
      if (samp) V[SAMP] += clock() - tp;
    }
    function lap(s) {
      if (!open) return;
      const t = clock();
      acc[s] += (t - V[LAST]) - V[NESTED]; V[NESTED] = 0; V[LAST] = t;
      if (samp) V[SAMP] += clock() - t;
    }
    // a rendered frame starts: ts is rAF's timestamp (the PACE frame's), pc the PACE frame (steps owed)
    function begin(ts, pc) {
      if (open) close(false, null, true);           // the last frame never reached its end (a throw in the loop)
      const t = clock();
      open = true; V[T0] = t; V[LAST] = t; V[NESTED] = 0; depth = 0; taken = 0; calls = 0; tris = 0;
      samp = fi % 17 === 3; if (samp) { V[SAMP] = 0; V[SAMP_GL] = 0; }
      for (let i = 0; i < NS; i++) acc[i] = 0;
      owed = pc && typeof pc.steps === 'number' ? pc.steps : 0;
      const tsN = typeof ts === 'number' ? ts : t;
      const j = (fi & (N - 1)) * NC;
      ringT[fi & (N - 1)] = tsN;
      ringF[j + C.dt] = V[LASTTS] ? tsN - V[LASTTS] : NaN;
      ringF[j + C.flags] = (V[LASTTS] && V[HIDDEN] >= V[LASTTS]) ? F.away : 0;
      V[LASTTS] = tsN;
      if (samp) { const tg = clock(); gpuBegin(); V[SAMP_GL] += clock() - tg; V[SAMP] += tg - t; } else gpuBegin();
    }
    // the frame ends: rendered (false: the loop returned before its render - the boot's hold), the loop's CG
    // (the query ends INSIDE the frame's work: endQuery is a GL call, and a GL call blocks while the GPU's command
    // buffer is full - that wait is the frame's, in `other`, never the recorder's own time)
    function end(rendered, cg) {
      if (!open) return;
      if (samp) { const te = clock(); gpuEnd(false); V[SAMP_GL] += clock() - te; } else gpuEnd(false);
      lap(S.other);
      close(rendered !== false, cg, false);
    }
    function close(rendered, cg, broken) {
      const t = V[LAST], j = (fi & (N - 1)) * NC;
      open = false;
      if (rec.gpu.active) gpuEnd(broken);
      let sum = 0;
      for (let i = 0; i < NS; i++) { ringF[j + C_SLOT0 + i] = acc[i]; sum += acc[i]; }
      const work = t - V[T0];
      ringF[j + C.work] = work;
      ringF[j + C.other] += work - sum;              // rounding and anything between the laps: the split sums to the work
      ringF[j + C.owed] = owed; ringF[j + C.taken] = taken;
      ringF[j + C.gpu] = NaN;
      ringF[j + C.calls] = calls; ringF[j + C.tris] = tris;
      if (cg && cg.length >= 3) { ringF[j + C.x] = cg[0]; ringF[j + C.y] = cg[1]; ringF[j + C.z] = cg[2]; }
      else { ringF[j + C.x] = NaN; ringF[j + C.y] = NaN; ringF[j + C.z] = NaN; }
      let fl = ringF[j + C.flags];
      const dt = ringF[j + C.dt];
      if (dt >= FREEZE_MS && !(fl & F.away)) { fl |= F.freeze; freezes++; event('freeze', ringT[fi & (N - 1)], dt, null); }
      { const sh = Math.max(acc[S.shader], NP.waitMs);   // G1340: the watchdog
        if (sh > WATCH_MS) event('shaderslow', t, sh, NP.list.join(' | ') + (NP.more ? ' | +' + NP.more + ' more' : '') || '(no new program: waits on programs made earlier)');
        NP.list.length = 0; NP.more = 0; NP.waitMs = 0; }
      if (!rendered) fl |= F.noRender;
      if (rec.gpu.foreignF >= fi - 1) fl |= F.gpuForeign;
      const P = probeOut;
      if (rec.probe) { try { rec.probe(P, cg); } catch (e) { rec.probe = null; event('err', t, null, 'probe: ' + String(e && e.message || e)); } }
      if (P.garage) fl |= F.garage; if (P.running) fl |= F.running; if (P.held) fl |= F.held; if (P.manual) fl |= F.manual;
      ringF[j + C.agl] = P.agl; ringF[j + C.spd] = P.spd; ringF[j + C.vs] = P.vs;
      ringF[j + C.wms] = P.wms; ringF[j + C.wdil] = P.wdil; ringF[j + C.wran] = P.wran;
      ringF[j + C.phase] = codeOf('phase', P.phase); ringF[j + C.cam] = codeOf('cam', P.cam);
      // the boot's screen: a state change is an event; the roll-out screen gone is THE REVEAL
      const B = W.BOOT;
      if (B && B.state !== lastBoot) {
        event('boot', t, null, B.state + (B.set ? ' ' + B.set : ''));
        if (B.state === 'gone' && B.set === 'rollout' && !(t - lastReveal < 2000)) { revealAt = t; lastReveal = t; event('reveal', t, null, 'roll-out screen'); revealSky(); }
        lastBoot = B.state;
      }
      if (B && B.state !== 'gone') fl |= F.boot;
      ringF[j + C.flags] = fl;
      const PC = W.FLYDIY_PACE;
      let cap = 0;
      if (PC && PC.state && (fi & 15) === 0) { lastCap = capNow(PC); }
      cap = lastCap;
      ringF[j + C.cap] = cap;
      if ((fi & 63) === 0) heapSample(t);
      ringF[j + C.heap] = V[HEAP];
      fi++;
      if ((fi & (CHUNK - 1)) === 16 && fi > CHUNK) chunkDone((fi >> Math.log2(CHUNK)) - 1);   // a chunk full (16 frames on, for the GPU's late results)
      const d = clock() - t;
      selfN++; V[SELF_US] += d * 1000; if (d * 1000 > V[SELF_MAX]) V[SELF_MAX] = d * 1000;
      if (samp && !broken && !(fl & F.boot)) { V[SAMP] += d; sampN++; V[SAMP_SUM] += V[SAMP]; V[SAMP_GL_SUM] += V[SAMP_GL]; if (V[SAMP] > V[SAMP_MAX]) V[SAMP_MAX] = V[SAMP]; }
      samp = false;
    }
    let capSeen = -2;
    function capNow(PC) {
      const st = PC.state();                          // (every 16th frame: the state object is the pace's)
      const c = st.legacy ? 0 : (st.cap || 0);
      if (c !== capSeen) { if (capSeen !== -2) event('cap', null, null, st.mode + ' ' + c); capSeen = c; }
      return c;
    }
    function heapSample(t) {
      const m = perf.memory;
      if (!m || !m.usedJSHeapSize) return;
      const mb = m.usedJSHeapSize / 1048576;
      if (V[HEAPPREV] === V[HEAPPREV] && V[HEAPPREV] - mb > 8) event('gc', t, null, (V[HEAPPREV] - mb).toFixed(0) + ' MB freed');
      V[HEAPPREV] = mb; V[HEAP] = mb;
    }

    // ---- the GPU's time (EXT_disjoint_timer_query_webgl2) ------------------------------------------------------
    function gpuBegin() {
      const G = rec.gpu;
      if (!G.ext || G.off) return;                  // (G1995: G.off - the self-test's 'timer off' variant, live)
      if ((fi & 3) === 0) gpuPoll();                  // the results read every 4th frame, in a batch (each read is a GL call)
      if (fi - G.foreignF < 120) return;              // another module's timer ran in the last 2 s: not ours to open
      const qy = G.pool.length ? G.pool.pop() : (G.pend.length < 16 ? G.gl.createQuery() : null);
      if (!qy) return;
      G.active = qy; G.activeF = fi; G.spoiled = false;
      G.begin.call(G.gl, G.ext.TIME_ELAPSED_EXT, qy);
    }
    function gpuEnd(broken) {
      const G = rec.gpu;
      if (!G.active) return;
      const qy = G.active; G.active = null;
      if (!G.spoiled) G.end.call(G.gl, G.ext.TIME_ELAPSED_EXT);
      if (G.spoiled || broken) { G.pool.push(qy); return; }
      G.pend.push(qy); G.pendF.push(G.activeF);
    }
    function gpuPoll() {
      const G = rec.gpu, gl = G.gl;
      if (!G.pend.length) return;
      if (!gl.getQueryParameter(G.pend[0], gl.QUERY_RESULT_AVAILABLE)) return;
      const disjoint = gl.getParameter(G.ext.GPU_DISJOINT_EXT);
      while (G.pend.length && gl.getQueryParameter(G.pend[0], gl.QUERY_RESULT_AVAILABLE)) {
        const qy = G.pend.shift(), f = G.pendF.shift();
        if (!disjoint && fi - f < N) { ringF[(f & (N - 1)) * NC + C.gpu] = gl.getQueryParameter(qy, gl.QUERY_RESULT) / 1e6; G.ok++; } else G.bad++;
        G.pool.push(qy);
      }
    }
    // another module begins a TIME_ELAPSED query while ours is open: ours ends first (queries cannot nest) and
    // the frame's GPU time is not measured - theirs works exactly as it did
    function foreignBegin() {
      const G = rec.gpu;
      G.foreignF = fi; G.foreign++;
      if (G.active && !G.spoiled) { G.end.call(G.gl, G.ext.TIME_ELAPSED_EXT); G.spoiled = true; }
    }

    // ---- the renderer's wrappers: the same calls, counted and timed ------------------------------------------
    function attach(renderer, probe) {
      if (probe) { rec.probe = probe.frame || null; rec.info = probe.info || null; }
      if (!renderer || rec.renderer) return api;
      rec.renderer = renderer;
      try {
        const orig = renderer.render;
        if (typeof orig === 'function' && renderer.info && renderer.info.render) {
          renderer.render = function (scene, camera) {
            const r = orig.call(this, scene, camera);
            if (open) { const I = renderer.info.render; calls += I.calls; tris += I.triangles; }
            return r;
          };
        }
      } catch (e) {}
      try {   // G1340: every program three makes, for the watchdog
        const A = renderer.info && renderer.info.programs;
        if (A && !A.__frw) { A.__frw = 1; const push = A.push; A.push = function (p) { try { newProgram(p); } catch (e) {} return push.apply(this, arguments); }; }
      } catch (e) {}
      try {
        const sm = renderer.shadowMap;
        if (sm && typeof sm.render === 'function') {
          const origS = sm.render;
          sm.render = function (a, b, c) { push(S.shadow); try { return origS.call(this, a, b, c); } finally { pop(); } };
        }
      } catch (e) {}
      try {
        const gl = renderer.getContext ? renderer.getContext() : null;
        if (gl && typeof gl.linkProgram === 'function' && !renderer.isWebGPURenderer) wrapGL(gl);
      } catch (e) {}
      return api;
    }
    function wrapGL(gl) {
      rec.gl = gl;
      // the shader links: the call, and the page held while three first asks for the link's status
      const link = gl.linkProgram, infoLog = gl.getProgramInfoLog, param = gl.getProgramParameter;
      let linkN = 0;
      const waiting = new WeakSet();
      gl.linkProgram = function (p) {
        const t = clock(); push(S.shader);
        try { return link.call(gl, p); } finally { pop(); const d = clock() - t; linkN++; waiting.add(p); event('link', t, d, linkN); }
      };
      const held = (fn, p, a) => {
        if (!waiting.has(p)) return fn.call(gl, p, a);
        waiting.delete(p);
        const t = clock(); push(S.shader);
        try { return fn.call(gl, p, a); } finally { pop(); const d = clock() - t; NP.waitMs += d; if (d > 1) event('linkwait', t, d, null); }
      };
      gl.getProgramInfoLog = function (p) { return held(infoLog, p); };
      gl.getProgramParameter = function (p, pn) { return pn === gl.LINK_STATUS ? held(param, p, pn) : param.call(gl, p, pn); };
      // the GPU timer: ours, and a watch on everyone else's
      let ext = null;
      try { if (!NOGPU && !opt.noGpu) ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch (e) {}
      if (ext && typeof gl.beginQuery === 'function') {
        const G = rec.gpu, TE = ext.TIME_ELAPSED_EXT;
        G.gl = gl; G.ext = ext; G.begin = gl.beginQuery; G.end = gl.endQuery;
        gl.beginQuery = function (target, qy) { if (target === TE) foreignBegin(); return G.begin.call(gl, target, qy); };
      }
    }

    // ---- the meter's numbers: the rendered frames of the last 2 s of wall time (a hidden gap left out) --------
    const scratch = new Float64Array(1024);
    const st = { fps: 0, med: 0, p90: 0, max: 0, n: 0, cap: 0, steps: 0, work: 0, gpu: NaN, freezes: 0, lastFreezeMs: 0, frames: 0 };
    function stats(winMs) {
      winMs = winMs || 2000;
      let n = 0, sum = 0, mx = 0, wk = 0, gp = NaN;
      const tEnd = fi ? ringT[(fi - 1) & (N - 1)] : 0;
      for (let k = 1; k <= Math.min(fi, N, 1024); k++) {
        const j = ((fi - k) & (N - 1)) * NC;
        if (tEnd - ringT[(fi - k) & (N - 1)] >= winMs) break;
        const fl = ringF[j + C.flags], dt = ringF[j + C.dt];
        if (!(dt === dt) || (fl & F.away)) continue;
        scratch[n++] = dt; sum += dt; if (dt > mx) mx = dt;
        if (n === 1) st.steps = ringF[j + C.taken];
        wk += ringF[j + C.work];
        const g = ringF[j + C.gpu]; if (g === g && !(gp === gp)) gp = g;
      }
      st.n = n; st.frames = fi;
      if (!n) { st.fps = 0; st.med = st.p90 = st.max = 0; return st; }
      const v = scratch.subarray(0, n); v.sort();
      st.fps = n * 1000 / sum; st.med = v[n >> 1]; st.p90 = v[Math.min(n - 1, Math.floor(n * 0.9))]; st.max = mx;
      st.work = wk / n; st.gpu = gp; st.cap = lastCap; st.freezes = freezes;
      return st;
    }

    // ---- the log: rows and events out --------------------------------------------------------------------------
    function header() {
      const H = {
        format: 'flydiy-flightlog', v: 1, sid: rec.sid, started: rec.started, saved: new Date().toISOString(),
        timeOrigin: perf.timeOrigin || null,
        build: W.FLYDIY_BUILD || null, core: W.FLYDIY_CORE_SHA || null,
        server: (W.STORAGE && W.STORAGE.S && W.STORAGE.S.server) || null, version: REC_VERSION,
        world: W.FLYDIY_WORLD || null, url: (W.location && (W.location.pathname + W.location.search)) || null,
        ua: (W.navigator && W.navigator.userAgent) || null,
        cores: (W.navigator && W.navigator.hardwareConcurrency) || null, memGB: (W.navigator && W.navigator.deviceMemory) || null,
        screen: W.screen ? { w: W.screen.width, h: W.screen.height, availW: W.screen.availWidth, availH: W.screen.availHeight } : null,
        window: { w: W.innerWidth, h: W.innerHeight }, dpr: W.devicePixelRatio || 1,
        cols: COLS, slots: SLOTS, flags: F, freezeMs: FREEZE_MS, codes: names,
        frames: fi, ring: N, events: events.length, eventsDropped: evDropped, revealAt,
        overhead: { frameUsMean: sampN ? +(V[SAMP_SUM] / sampN * 1000).toFixed(1) : null, frameUsMax: +(V[SAMP_MAX] * 1000).toFixed(1), sampled: sampN,
          gpuTimerUsMean: sampN ? +(V[SAMP_GL_SUM] / sampN * 1000).toFixed(1) : null,
          endUsMean: selfN ? +(V[SELF_US] / selfN).toFixed(2) : null, endUsMax: +V[SELF_MAX].toFixed(1), frames: selfN },
        gpuTimer: rec.gpu.ext ? { ok: rec.gpu.ok, disjoint: rec.gpu.bad, foreignFrames: rec.gpu.foreign } : null,
      };
      const R = rec.renderer;
      if (R && R.domElement) H.canvas = { w: R.domElement.width, h: R.domElement.height, cssW: R.domElement.clientWidth, cssH: R.domElement.clientHeight, pixelRatio: R.getPixelRatio ? R.getPixelRatio() : null };
      const gl = rec.gl;
      if (gl) {
        try {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          H.gpu = { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
            unmaskedVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null, unmaskedRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
            version: gl.getParameter(gl.VERSION), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
        } catch (e) {}
      }
      try { if (W.GFX && W.GFX.get) H.gfx = W.GFX.get(); } catch (e) {}
      try { if (W.FLYDIY_PACE && W.FLYDIY_PACE.state) H.pace = W.FLYDIY_PACE.state(); } catch (e) {}
      try { if (W.FLYDIY_AA && W.FLYDIY_AA.tier) H.aa = W.FLYDIY_AA.tier(); } catch (e) {}
      try { if (W.POST_FX && W.POST_FX.catcher) H.catcher = W.POST_FX.catcher.summary(); } catch (e) {}   // G1357: the frame catcher's count and its own cost
      try { if (rec.info) H.aircraft = rec.info(); } catch (e) {}
      if (W.BOOT) H.boot = { t0: W.BOOT.t0, state: W.BOOT.state, log: W.BOOT.log };
      return H;
    }
    const r2 = x => (x === x ? Math.round(x * 100) / 100 : null);
    // rows [a, b) of the frame counter from the ring as columnar JSON text
    function rowsJSON(a, b, parts) {
      parts.push('"t":[');
      for (let f = a; f < b; f++) parts.push((f > a ? ',' : '') + r2(ringT[f & (N - 1)]));
      parts.push(']');
      for (let c = 0; c < NC; c++) {
        parts.push(',"' + COLS[c] + '":[');
        let s = '';
        for (let f = a; f < b; f++) { s += (f > a ? ',' : '') + r2(ringF[(f & (N - 1)) * NC + c]); if (s.length > 65536) { parts.push(s); s = ''; } }
        parts.push(s + ']');
      }
      return parts;
    }
    // the log as a list of strings (a Blob's parts; one string would be tens of MB)
    function logParts() {
      const a = Math.max(0, fi - N);
      const parts = ['{"header":', JSON.stringify(header()), ',"frames":{'];
      parts.push('"n":' + (fi - a) + ',"first":' + a + ',');
      rowsJSON(a, fi, parts);
      parts.push('},"events":' + JSON.stringify(events) + '}');
      return parts;
    }
    // a chunk's rows as a plain record (IndexedDB)
    function chunkRec(k, n) {
      const a = k * CHUNK, m = n == null ? CHUNK : n;
      return { sid: rec.sid, k, n: m, first: a, t: ringT.slice(a & (N - 1), (a & (N - 1)) + m), f: ringF.slice((a & (N - 1)) * NC, ((a & (N - 1)) + m) * NC) };
    }
    let chunkSink = null;
    function chunkDone(k) { if (chunkSink) chunkSink(k); }
    function eventsSince() { const out = events.slice(evSaved); evSaved = events.length; return out; }

    const api = {
      SLOTS, S, COLS, C, F, N, CHUNK, rec,
      attach, begin, end, lap, push, pop, event, stats, header, logParts, chunkRec, eventsSince, reveal,
      codeOf, names,
      get frame() { return fi; }, get open() { return open; }, get events() { return events; },
      set chunkSink(fn) { chunkSink = fn; },
      get freezes() { return freezes; },
      val: (f, c) => ringF[(f & (N - 1)) * NC + c],
      self: () => ({ n: selfN, usMean: selfN ? V[SELF_US] / selfN : 0, usMax: V[SELF_MAX], frameUsMean: sampN ? V[SAMP_SUM] / sampN * 1000 : 0, frameUsMax: V[SAMP_MAX] * 1000, sampled: sampN, gpuTimerUsMean: sampN ? V[SAMP_GL_SUM] / sampN * 1000 : 0 }),
      row: f => { const j = (f & (N - 1)) * NC, o = { t: ringT[f & (N - 1)] }; for (let c = 0; c < NC; c++) o[COLS[c]] = ringF[j + c]; return o; },
    };
    return api;
  }

  // the page hidden / shown: an event, and the store flushed on the way out (the log of a tab closed while hidden)
  if (W.document && W.document.addEventListener) {
    W.document.addEventListener('visibilitychange', () => {
      const h = !!W.document.hidden;
      REC.event('vis', null, null, h ? 'hidden' : 'visible');
      if (h && STORE) STORE.flush(true);
    });
  }

  // =================================================================================================================
  // THE PAGE'S RECORDER: one, from this script on
  // =================================================================================================================
  const REC = make();
  // the loop's view of it: every hook is a no-op until app.js attaches (and for ever under ?rec=0)
  const NOOP = () => {};
  const API = {
    make, SLOTS, COLS, S: REC.S, F: REC.F,
    attach: (renderer, probe) => OFF ? null : REC.attach(renderer, probe),
    begin: REC.begin, end: REC.end, lap: REC.lap, push: REC.push, pop: REC.pop,
    event: (kind, ms, detail) => REC.event(kind, null, ms, detail),
    reveal: how => REC.reveal(how),
    gpuTimer: on => { if (on !== undefined) REC.rec.gpu.off = !on; return !!REC.rec.gpu.ext && !REC.rec.gpu.off; },   // G1995: the GPU timer on / off, live (the self-test)   // G1995: the flight handed to the player (app.js flRevealStart), screen or none
    stats: w => REC.stats(w), header: () => REC.header(), self: REC.self,
    get off() { return OFF; }, rec: REC,
    save: () => save(null), savePrevious: () => save('previous'), mark: note => mark(note),
    hud: on => hudSet(on), hudOn: () => pref.hud,
    mount: (body, H) => mount(body, H),
    mountMeter: (body, H) => mountMeter(body, H), mountLog: (body, H) => mountLog(body, H),   // G760
  };
  if (OFF) { API.begin = API.end = API.lap = API.push = API.pop = NOOP; }

  // ---- the page's events ------------------------------------------------------------------------------------------
  const ev = (k, t, ms, d) => REC.event(k, t, ms, d);
  // Friendly Welcome (A0, 2026-10-02): a lost / restored WebGL context, logged (the GTX 660 drew 0 frames and the log could
  // not say why); capture on the window catches the canvas's non-bubbling events
  try { W.addEventListener('webglcontextlost', e => ev('contextlost', performance.now(), null, (e.target && e.target.id) || null), true);
        W.addEventListener('webglcontextrestored', e => ev('contextrestored', performance.now(), null, (e.target && e.target.id) || null), true); } catch (e) {}
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const types = PerformanceObserver.supportedEntryTypes || [];
      if (types.indexOf('longtask') >= 0) new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          const a = e.attribution && e.attribution[0];
          ev('longtask', e.startTime, e.duration, a ? (a.containerType || '') + (a.containerName ? ' ' + a.containerName : '') + (a.containerSrc ? ' ' + a.containerSrc : '') || null : null);
        }
      }).observe({ type: 'longtask', buffered: true });
      // THE LONG ANIMATION FRAME (Chrome 123+): which script held it - the part a long task cannot name
      if (types.indexOf('long-animation-frame') >= 0) new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          if (e.duration < 100) continue;
          const sc = (e.scripts || []).slice().sort((x, y) => y.duration - x.duration).slice(0, 3)
            .map(s => (s.invoker || '?') + (s.sourceFunctionName ? ' ' + s.sourceFunctionName : '') + (s.sourceURL ? ' @' + String(s.sourceURL).split('/').pop().slice(0, 40) + (s.sourceCharPosition >= 0 ? ':' + s.sourceCharPosition : '') : '') + ' ' + Math.round(s.duration) + 'ms');
          ev('loaf', e.startTime, e.duration, 'blocking ' + Math.round(e.blockingDuration || 0) + 'ms, render ' + Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0) + 'ms' + (sc.length ? '; ' + sc.join('; ') : ''));
        }
      }).observe({ type: 'long-animation-frame', buffered: true });
    }
  } catch (e) {}
  if (W.addEventListener) {
    let errs = 0;
    // G1532b.1 (POTATO-DEEP): the column and, for the first three, the stack - an inlined script's error is a line of index.html
    // (5802 = the whole of three.min.js): without them the user's log could not name the thrower of a per-frame throw
    W.addEventListener('error', e => { if (++errs <= 200) ev('err', null, null, String((e && e.message) || 'error').slice(0, 200) + (e && e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno + (e.colno ? ':' + e.colno : '') : '')
      + (errs <= 3 && e && e.error && e.error.stack ? ' | ' + String(e.error.stack).split('\n').slice(1, 7).map(s => s.trim().replace(/https?:\/\/[^ )]*\//g, '')).join(' < ').slice(0, 600) : '')); });
    W.addEventListener('unhandledrejection', e => { if (++errs <= 200) ev('err', null, null, 'rejection: ' + String(e && e.reason && (e.reason.message || e.reason)).slice(0, 200)); });
    W.addEventListener('pagehide', () => { ev('pagehide', null, null, null); if (STORE) STORE.flush(true); });
  }
  ev('script', null, null, 'flight_recorder.js');
  // the server's build (version.json, uncached) for the header, beside the page's own FLYDIY_BUILD
  let REC_VERSION = null;
  if (!OFF && typeof fetch === 'function') { try { fetch('version.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(v => { REC_VERSION = v; }, () => {}); } catch (e) {} }

  // =================================================================================================================
  // THE STORE: IndexedDB, as it goes
  // =================================================================================================================
  const DBN = 'flydiy-flightrec', KEEP = 4, MAX_CHUNKS = 600;
  const STORE = (() => {
    if (OFF || typeof indexedDB === 'undefined' || !indexedDB) return null;
    let db = null, dead = false, written = 0;
    const pend = [];
    try {
      const rq = indexedDB.open(DBN, 1);
      rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('sessions'); d.createObjectStore('chunks'); d.createObjectStore('events'); };
      rq.onsuccess = () => { db = rq.result; prune(); while (pend.length) pend.shift()(); };
      rq.onerror = () => { dead = true; };
    } catch (e) { dead = true; }
    const put = (store, key, val) => {
      const go = () => { try { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); } catch (e) {} };
      if (db) go(); else if (!dead && pend.length < 64) pend.push(go);
    };
    const key = (sid, k) => sid + ':' + String(k).padStart(6, '0');
    let evBatch = 0, headLen = -1, headAt = 0;
    function prune() {
      try {
        const tx = db.transaction('sessions', 'readonly'), rq = tx.objectStore('sessions').getAllKeys();
        rq.onsuccess = () => {
          const old = (rq.result || []).filter(k => k !== REC.rec.sid).sort();
          const drop = old.slice(0, Math.max(0, old.length - (KEEP - 1)));
          if (!drop.length) return;
          const t2 = db.transaction(['sessions', 'chunks', 'events'], 'readwrite');
          for (const sid of drop) {
            t2.objectStore('sessions').delete(sid);
            const range = IDBKeyRange.bound(sid + ':', sid + ':￿');
            t2.objectStore('chunks').delete(range); t2.objectStore('events').delete(range);
          }
        };
      } catch (e) {}
    }
    function head(force) {   // the header: when the boot's log grew, every 30 s, and on the way out
      const bl = W.BOOT && W.BOOT.log ? W.BOOT.log.length : 0, t = now();
      if (!force && bl === headLen && t - headAt < 30000) return;
      headLen = bl; headAt = t;
      try { put('sessions', REC.rec.sid, JSON.parse(JSON.stringify(REC.header()))); } catch (e) {}
    }
    REC.chunkSink = k => {
      if (k >= MAX_CHUNKS) return;
      put('chunks', key(REC.rec.sid, k), REC.chunkRec(k)); written = k + 1;
      const e = REC.eventsSince(); if (e.length) put('events', key(REC.rec.sid, evBatch++), e);
      head(false);
    };
    // the partial chunk (what the ring holds past the last full one), the new events, the header
    function flush(out) {
      if (dead) return;
      const k = REC.frame >> Math.log2(REC.CHUNK), n = REC.frame - k * REC.CHUNK;
      if (k < MAX_CHUNKS && n > 0) put('chunks', key(REC.rec.sid, k), REC.chunkRec(k, n));
      // a full chunk not yet written (the 16-frame delay)
      if (k > written && k - 1 < MAX_CHUNKS) { put('chunks', key(REC.rec.sid, k - 1), REC.chunkRec(k - 1)); written = k; }
      const e = REC.eventsSince(); if (e.length) put('events', key(REC.rec.sid, evBatch++), e);
      head(!!out);
    }
    if (typeof setInterval === 'function') setInterval(() => flush(false), 5000);
    function get(store, keyOrRange) {
      return new Promise(res => {
        if (!db) { res(null); return; }
        try { const rq = db.transaction(store, 'readonly').objectStore(store)[keyOrRange instanceof IDBKeyRange ? 'getAll' : 'get'](keyOrRange); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); }
        catch (e) { res(null); }
      });
    }
    function sessions() {
      return new Promise(res => {
        if (!db) { res([]); return; }
        try { const rq = db.transaction('sessions', 'readonly').objectStore('sessions').getAllKeys(); rq.onsuccess = () => res((rq.result || []).sort()); rq.onerror = () => res([]); }
        catch (e) { res([]); }
      });
    }
    return { flush, get, sessions, key, get ready() { return !!db; }, get dead() { return dead; } };
  })();

  // ---- the download --------------------------------------------------------------------------------------------------
  function download(parts, name) {
    const blob = new Blob(parts, { type: 'application/json' });
    const a = W.document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    W.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    return blob.size;
  }
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
  // a stored session as columnar JSON: its chunks in order, its events, its header
  function storedParts(sid) {
    const range = IDBKeyRange.bound(sid + ':', sid + ':￿');
    return Promise.all([STORE.get('sessions', sid), STORE.get('chunks', range), STORE.get('events', range)]).then(([H, chunks, evs]) => {
      if (!H) return null;
      chunks = (chunks || []).sort((a, b) => a.k - b.k);
      const COLN = H.cols || REC.COLS, NCOL = COLN.length;
      const parts = ['{"header":', JSON.stringify(H), ',"frames":{'];
      let n = 0; for (const c of chunks) n += c.n;
      parts.push('"n":' + n + ',"first":' + (chunks.length ? chunks[0].first : 0) + ',"t":[');
      const r2 = x => (x === x ? Math.round(x * 100) / 100 : null);
      let first = true;
      for (const c of chunks) { let s = ''; for (let i = 0; i < c.n; i++) { s += (first ? '' : ',') + r2(c.t[i]); first = false; } parts.push(s); }
      parts.push(']');
      for (let col = 0; col < NCOL; col++) {
        parts.push(',"' + COLN[col] + '":[');
        first = true;
        for (const c of chunks) { let s = ''; for (let i = 0; i < c.n; i++) { s += (first ? '' : ',') + r2(c.f[i * NCOL + col]); first = false; } parts.push(s); }
        parts.push(']');
      }
      const all = []; for (const b of (evs || [])) for (const e of b) all.push(e);
      parts.push('},"events":' + JSON.stringify(all) + '}');
      return parts;
    });
  }
  // this session (null) or the one before ('previous'): resolves to { name, bytes } or null
  function save(which) {
    if (which === 'previous') {
      if (!STORE || !STORE.ready) return Promise.resolve(null);
      return STORE.sessions().then(list => {
        const prev = list.filter(s => s !== REC.rec.sid).pop();
        if (!prev) return null;
        return storedParts(prev).then(parts => parts ? { name: 'flydiy-flightlog-' + prev + '.json', bytes: download(parts, 'flydiy-flightlog-' + prev + '.json') } : null);
      });
    }
    // this session: the ring (the last 65 536 frames) - the older chunks of a longer session are in the store
    const name = 'flydiy-flightlog-' + REC.rec.sid + '.json';
    REC.event('save', null, null, name);
    if (STORE) STORE.flush(true);
    const done = parts => ({ name, bytes: download(parts, name) });
    if (REC.frame > REC.N && STORE && STORE.ready) return storedParts(REC.rec.sid).then(p => done(p || REC.logParts()));
    return Promise.resolve(done(REC.logParts()));
  }
  function mark(note) { REC.event('mark', null, null, note || 'the player'); flashHud(); }

  // =================================================================================================================
  // THE FPS METER
  // =================================================================================================================
  const PREF = 'flydiy.rec';
  const pref = { hud: false };
  try { const p = JSON.parse((W.localStorage && W.localStorage.getItem(PREF)) || 'null'); if (p && typeof p.hud === 'boolean') pref.hud = p.hud; } catch (e) {}
  const savePref = () => { try { W.localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  let hudEl = null, hudTxt = null, hudCv = null, hudTimer = 0;
  function hudBuild() {
    const d = W.document;
    hudEl = d.createElement('div');
    hudEl.id = 'fpsMeter';
    // (it takes no clicks - whatever is under it stays usable - but its dot: a click there MARKS the moment in the log)
    hudEl.style.cssText = 'position:fixed;top:10px;right:14px;z-index:9990;padding:6px 8px 5px;border-radius:6px;' +
      'background:rgba(16,20,24,.72);color:#e8e4d8;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
      'pointer-events:none;user-select:none;min-width:190px;box-shadow:0 1px 6px rgba(0,0,0,.35)';
    const dot = d.createElement('div');
    dot.title = 'mark this moment in the flight log (then say what you saw when you send it)';
    dot.style.cssText = 'position:absolute;top:5px;right:6px;width:11px;height:11px;border-radius:50%;background:#f0c040;pointer-events:auto;cursor:pointer;opacity:.85';
    dot.addEventListener('click', e => { e.stopPropagation(); mark('the player (the meter\u2019s dot)'); });
    hudEl.appendChild(dot);
    hudTxt = d.createElement('div'); hudTxt.style.cssText = 'white-space:pre;padding-right:14px';
    hudCv = d.createElement('canvas'); hudCv.width = 240; hudCv.height = 40;
    hudCv.style.cssText = 'display:block;width:190px;height:32px;margin-top:3px';
    hudEl.appendChild(hudTxt); hudEl.appendChild(hudCv);
    d.body.appendChild(hudEl);
  }
  function flashHud() { if (!hudEl) return; hudEl.style.outline = '2px solid #f0c040'; setTimeout(() => { if (hudEl) hudEl.style.outline = ''; }, 400); }
  const f0 = x => (x >= 100 ? x.toFixed(0) : x.toFixed(1));
  function hudPaint() {
    if (!hudEl) return;
    const s = REC.stats(2000);
    const PC = W.FLYDIY_PACE, P = PC && PC.state ? PC.state() : null;
    const cap = !P ? '' : P.legacy ? 'rig clock' : P.mode === 'auto' ? 'auto ' + P.cap : P.mode === 'off' ? 'uncapped' : 'cap ' + P.cap;
    const fr = PC && PC.freezes ? PC.freezes() : null;
    hudTxt.textContent =
      (s.n ? s.fps.toFixed(0) : '--') + ' fps  ' + cap + '  ' + s.steps + ' step' + (s.steps === 1 ? '' : 's') + '\n' +
      'frame ms  med ' + f0(s.med) + '  p90 ' + f0(s.p90) + '  max ' + f0(s.max) + '\n' +
      'cpu ' + f0(s.work) + (s.gpu === s.gpu ? '  gpu ' + f0(s.gpu) : '  gpu n/a') + ' ms' +
      (fr && fr.n ? '  freezes ' + fr.n : '');
    // the sparkline: the last 120 frames' intervals, 0-50 ms; 16.7 / 33.3 ms lines; over 100 ms red to the top
    const g = hudCv.getContext('2d'), w = hudCv.width, h = hudCv.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 0, w, h);
    const y = ms => h - Math.min(1, ms / 50) * h;
    g.fillStyle = 'rgba(160,220,160,.35)'; g.fillRect(0, Math.round(y(1000 / 60)), w, 1);
    g.fillStyle = 'rgba(240,200,90,.35)'; g.fillRect(0, Math.round(y(1000 / 30)), w, 1);
    const n = Math.min(120, REC.frame), bw = w / 120, CF = REC.C.flags, CD = REC.C.dt;
    for (let k = 0; k < n; k++) {
      const f = REC.frame - n + k, dt = REC.val(f, CD);
      if (!(dt === dt) || (REC.val(f, CF) & REC.F.away)) continue;
      g.fillStyle = dt > 100 ? '#e0504a' : dt > 35 ? '#e8b04a' : '#8fd08f';
      const top = dt > 100 ? 0 : y(dt);
      g.fillRect(k * bw, top, Math.max(1, bw - 0.5), h - top);
    }
  }
  function hudSet(on) {
    pref.hud = !!on; savePref();
    if (!W.document || !W.document.body) return pref.hud;
    if (pref.hud) { if (!hudEl) hudBuild(); hudEl.style.display = ''; if (!hudTimer) hudTimer = setInterval(hudPaint, 250); hudPaint(); }
    else { if (hudEl) hudEl.style.display = 'none'; if (hudTimer) { clearInterval(hudTimer); hudTimer = 0; } }
    REC.event('setting', null, null, 'fps meter ' + (pref.hud ? 'on' : 'off'));
    return pref.hud;
  }
  if (pref.hud && W.document) {
    const go = () => { if (W.document.body) hudSet(true); };
    if (W.document.readyState === 'loading') W.document.addEventListener('DOMContentLoaded', go); else go();
  }

  // ---- the graphics flyout's rows (both rails: GFX.mount calls this with its own helpers) --------------------------
  // G760 (the rails regrouped): the meter's switch and the log's row are two rows with two homes - the flight rail's
  // VIEW (the screen) and DEV (the flight log); mount() is both, for a host that keeps one list
  let lastSave = '';
  function mount(body, H) { mountMeter(body, H); mountLog(body, H); }
  function mountMeter(body, H) {
    H.row(body, 'fps meter');
    const refresh = () => { if (H.refresh) H.refresh(); };
    H.pills(body, [{ label: 'off', value: false, title: 'no meter' },
                   { label: 'on', value: true, title: 'the rendered frames per second, the frame time (median / p90 / max over 2 s), the frame cap, the solver steps, the CPU and GPU time, and the last 120 frames. Its yellow dot marks a moment in the flight log.' }],
      o => o.value === pref.hud, o => { hudSet(o.value); refresh(); });
  }
  function mountLog(body, H) {
    H.row(body, 'flight log');
    const st = H.note(body, '');
    const line = () => {
      if (!st) return;
      if (OFF) { st.textContent = 'the recorder is off on this page (?rec=0 or flydiy.rec.off)'; return; }
      const S2 = REC.self();
      st.textContent = 'recording since load: ' + REC.frame + ' frames, ' + REC.events.length + ' events' +
        (STORE ? (STORE.ready ? ', kept in this browser (the last ' + KEEP + ' sessions)' : ', not kept (no browser storage)') : ', not kept') +
        (S2.sampled >= 200 ? ' - its own cost ' + S2.frameUsMean.toFixed(0) + ' us a frame (measured; the budget 200)' + (S2.gpuTimerUsMean ? ', the GPU timer\u2019s calls ' + S2.gpuTimerUsMean.toFixed(0) + ' us' : '') : ' - its own cost: measuring') +
        '.' + (lastSave ? ' ' + lastSave : '');
    };
    line();
    H.pills(body, [{ label: 'save log', value: 'now', title: 'download this session’s flight log (JSON) - send it with a note of what you saw' },
                   { label: 'previous session', value: 'prev', title: 'download the session before this one (after a freeze or a crash and a reload)' }],
      () => false, o => {
        const p = o.value === 'prev' ? save('previous') : save(null);
        p.then(r => { lastSave = r ? 'Saved ' + r.name + ' (' + (r.bytes / 1048576).toFixed(1) + ' MB) to your downloads.' : 'No earlier session in this browser.'; line(); });
      });
    if (typeof setInterval === 'function') { const iv = setInterval(() => { if (!body.isConnected) { clearInterval(iv); return; } line(); }, 2000); }
  }

  W.FLIGHT_REC = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
