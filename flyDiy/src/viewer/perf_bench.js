// ============================================================================================================================
// perf_bench.js - THE IN-GAME BENCHMARK (Game, 17 Nov 2026; PERF-WEEK-METHOD-2026-11-14 line 18, the user's go via A0: "so
// the user can benchmark the phone / potato PC / laptops himself"). A row of the game menu ("Benchmark") opens a card that
// lists Pilot's scenarios (tools/flight_scripts/index.json's { name, what, file } when it stands, else the names below), runs
// one IN THE PAGE and saves the game's FLIGHT RECORDER log by a download (PERF-TRACE-FORMAT.md, Pilot's: ONE producer - every
// step a segment mark 'seg:<name>' in the log, 'seg:end' at the end, the run said once as event 'bench'; tools/perf_trace.js
// makes the report from the log). With the recorder off (?rec=0) its own summary is saved instead. The node / GPU-rig runner is tools/flight_script.js (runPage); this is its rules
// in the page, with no rig:
//   - the plane: the scenario's card seeded as the working build (flydiy.wip), then the page RELOADED with the run armed in
//     sessionStorage - the runner's own seed path, and the boot is measured with it: the loading screen's frames from this
//     script's eval (the frames over 100 ms with the long tasks the browser attributes), the first contact to the garage
//   - THE GARAGE STEPS (the user's targets): the editor's sliders driven by script, input to the next drawn frame (target
//     <= 100 ms); every row of the game menu opened and closed, its longest frame (no freeze, or < 5 s with a spinner)
//   - THE FLIGHT (not on the phone profile, which boots the garage alone): the brief's writers (#selCond, #selPersona,
//     #selDest), 'start' = Go until flying (mode-fly and the sim's clock rising: the time to the world), 'leg' =
//     FLIGHT_PROBE.nextLeg, 'lift' = FLIGHT_PROBE.place({ by }), each step's until / fault / cap as runPage reads them, the
//     frames of every step (n, p50, p99, max, over 50 / 100 ms, the share of even frames - within 1.5x the median)
//   - THE CRASH LAG (optional, last): the aeroplane put 2 m under the ground where it flies, the frames of the 6 s after
//   window.FLYDIY_PERFBENCH = { open(), list() -> Promise<[{name, what}]>, run(name | null, o), last(), download(trace),
//                               _stats(arr), _miss(until, state), _fault(state, step) }   (the pure parts: GATE PERFBENCH)
// The summary (the 'bench' event's detail, and the card): { run: { scenario, plane, build, from, to, persona, at }, device,
//   boot, garage: { sliders, menu }, steps: [ runPage's step line + frames ], crash, end }. Pilot's step kinds: skip, camera
//   (orbit / pan360 sweep, chase / cockpit / free), weather, time, dest, shed, rollout, wait (until.s); minimap and load
//   are said as skipped until the page has their API
// ============================================================================================================================
'use strict';
var FLYDIY_PERFBENCH = (function () {
  const W = typeof window !== 'undefined' ? window : {};
  const KEY = 'flydiy.perfbench.run', LAST = 'flydiy.perfbench.last', V = 1;
  const LIB = ['home_circuit', 'cub_home_taxi', 'float_circuit', 'altiport', 'east_point', 'strip_jumbo', 'rufus_cabin', 'high_final_cub', 'high_final_cessna'];
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());
  const r1 = x => Math.round(x * 10) / 10;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // THE ONE LOG (Pilot, PERF-TRACE-FORMAT.md 17 Nov: "don't make a second trace writer"): the game's flight recorder already logs
  // every frame (the CPU split, GPU, draws) and every event; a step is a SEGMENT mark in it ('seg:' + name, 'seg:end'), the run
  // says what it played once (event 'bench'), and the end saves the recorder's log (FLIGHT_REC.save: a download).
  // tools/perf_trace.js turns that log into the report. With the recorder off (?rec=0) the summary is saved instead
  const recOn = () => !!(W.FLIGHT_REC && !FLIGHT_REC.off && FLIGHT_REC.mark);
  const seg = n => { try { if (recOn()) FLIGHT_REC.mark('seg:' + n); } catch (e) {} };
  const ss = { get: k => { try { return JSON.parse(W.sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
               set: (k, v) => { try { W.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
               del: k => { try { W.sessionStorage.removeItem(k); } catch (e) {} } };

  // ---- THE FRAMES: rAF intervals (ms) and the long tasks, from eval while a run is armed ---------------------------------
  const F = { on: false, d: [], last: 0, long: [], lt: [] };
  function framesOn() {
    if (F.on || typeof requestAnimationFrame !== 'function') return; F.on = true;
    const f = t => { if (F.last) { const g = t - F.last; F.d.push(g); if (g > 100 && F.long.length < 400) F.long.push([Math.round(t), Math.round(g)]); } F.last = t; if (F.on) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    try { new PerformanceObserver(L => { for (const e of L.getEntries()) if (e.duration > 100 && F.lt.length < 400)
      F.lt.push({ at: Math.round(e.startTime), ms: Math.round(e.duration), name: e.name, by: (e.attribution || []).map(a => [a.containerType, a.containerName || a.containerSrc || a.name].filter(Boolean).join(' ')).join('; ') || null }); })
      .observe({ type: 'longtask', buffered: true }); } catch (e) {}
  }
  // the stats of a list of frame intervals: the share of EVEN frames is the user's target 4 (within 1.5x the median); the
  // counts on the game meter's own lines as Codex's flightlog_evidence.js reads them (CODEX review, 17 Nov): orange > 35 ms,
  // over 100, freezes >= 250, over 1 s
  function stats(d) {
    if (!d || !d.length) return null;
    const s = d.slice().sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))], med = q(0.5);
    return { n: d.length, p50: r1(med), p99: r1(q(0.99)), max: r1(s[s.length - 1]), orange35: d.filter(x => x > 35).length, over50: d.filter(x => x > 50).length, over100: d.filter(x => x > 100).length,
             freeze250: d.filter(x => x >= 250).length, over1s: d.filter(x => x > 1000).length,
             even: r1(100 * d.filter(x => x <= 1.5 * med).length / d.length), fps: r1(1000 / med) };
  }
  const takeFrames = () => stats(F.d.splice(0));
  const takeLong = () => ({ frames: F.long.splice(0), tasks: F.lt.splice(0) });

  // ---- THE STEP RULES (runPage's: tools/flight_script.js) ----------------------------------------------------------------
  function state() {
    const P = W.FLIGHT_PROBE, ap = P && P.ap && P.ap(), s = P && P.sim && P.sim();
    if (!ap || !s) return null;
    const cg = s.cgPos(), v = s.cgVel ? s.cgVel() : [0, 0, 0], D = P.damage ? P.damage() : null, Wd = P.world ? P.world() : null;
    const w = (typeof flightWhere === 'function' && Wd) ? flightWhere(Wd, cg[0], cg[2]) : null;
    const vv = (ap.report && ap.report.verdicts) || [];
    const dec = ap.report && ap.report.outcome === 'declined' ? ((vv.find(q => q.code === 'takeoff-declined') || {}).note || 'declined') : null;
    let eng = null; try { const es = s.engines ? s.engines() : null; if (Array.isArray(es) && es.length) eng = es.every(e => e && (e.running || e.on || e.rpm > 300)); } catch (e) {}
    return { t: ap.t, ph: ap.phase, agl: P.agl ? P.agl() : null, cg: cg.map(x => r1(x)), Vg: r1(Math.hypot(v[0], v[2])), vs: r1(v[1]), engine: eng,
             where: w && w.aero ? w.aero.id : null, crashed: !!(D && (D.crashed || D.over)), dmg: D ? (D.reason || D.verdict || null) : null, declined: dec,
             said: vv.slice(-3).map(q => q.code + '@' + Math.round(q.t) + (q.note ? ': ' + String(q.note).slice(0, 160) : '')) };
  }
  // ---- THE LOADS (the user via A0, 17 Nov): TIME-TO-GARAGE (the menu's click -> the garage interactive), TIME-TO-WORLD (Go ->
  // flying with the world settled), WORLD-TO-GARAGE (back to the shed), COLD and WARM (a second launch, the cache kept); each
  // split into phases off the loading screen's own log (BOOT.log: its steps with their ms) - the shaders (the compile and the
  // frames under the overlay, the programs linked), the assets fetched (the resource timings: bytes, ms), the world build, the
  // settle, the impostor bakes. The user's targets: the garage about 20 s, nothing over 30 s
  const LOAD_TARGET_MS = 30000, GARAGE_AIM_MS = 20000;
  const PHASE_OF = id => /^(compile|frames)/.test(id) ? 'shaders' : /^(images|upload)/.test(id) ? 'assets' : /^bake/.test(id) ? 'impostors' : /^settle/.test(id) ? 'settle'
    : /^(world|town|trees|ring|parking|stages|shed)/.test(id) ? 'world' : 'other';
  const programs = () => { try { const i = W.FLYDIY_RENDERER && FLYDIY_RENDERER.info; return i && i.programs ? i.programs.length : null; } catch (e) { return null; } };
  const mark0 = () => ({ t: nowMs(), log: W.BOOT && BOOT.log ? BOOT.log.length : 0, prog: programs() });
  function phases(m0, t1) {
    const P = { shaders: { ms: 0, steps: 0 }, assets: { ms: 0, steps: 0 }, world: { ms: 0, steps: 0 }, settle: { ms: 0, steps: 0 }, impostors: { ms: 0, steps: 0 }, other: { ms: 0, steps: 0 } };
    const L = W.BOOT && BOOT.log ? BOOT.log.slice(m0.log) : [];
    for (const e of L) if (e.k === 'step' && e.ms > 0) { const p = P[PHASE_OF(String(e.id || ''))]; p.ms += e.ms; p.steps++; }
    const sh = L.filter(e => e.k === 'shaders').pop();
    P.shaders.compiled = (programs() != null && m0.prog != null) ? programs() - m0.prog : null;
    if (sh) P.shaders.bar = { done: sh.done, total: sh.total };
    let rs = []; try { rs = performance.getEntriesByType('resource').filter(r => r.startTime >= m0.t - 5 && r.startTime <= t1); } catch (e) {}
    P.assets.fetched = rs.length; P.assets.KB = Math.round(rs.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024);
    P.assets.bodyKB = Math.round(rs.reduce((a, r) => a + (r.decodedBodySize || r.encodedBodySize || 0), 0) / 1024);
    P.assets.spanMs = rs.length ? Math.round(Math.max(...rs.map(r => r.responseEnd)) - Math.min(...rs.map(r => r.startTime))) : 0;
    P.assets.cachedShare = rs.length ? Math.round(100 * rs.filter(r => r.transferSize === 0).length / rs.length) : null;
    return P;
  }
  const verdict = ms => ({ ms: Math.round(ms), s: r1(ms / 1000), ok: ms <= LOAD_TARGET_MS });
  const bootGone = async (maxS, set) => { for (let i = 0; i < maxS * 4; i++) { if (!W.BOOT || BOOT.state === 'gone') return true; await sleep(250); } return false; };
  // one launch's three numbers (the cycle needs a world: not on the phone profile)
  async function loadCycle(A, say) {
    const L = { pass: A.pass, source: null, toGarage: null, toWorld: null, worldToGarage: null };
    try { const nv = performance.getEntriesByType('navigation')[0]; L.source = { sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), transferKB: nv ? Math.round(nv.transferSize / 1024) : null }; } catch (e) {}
    const from = W.__pbClick != null ? W.__pbClick : 0;   // the welcome menu's click when it showed, else the navigation's start
    await bootGone(600);
    const tg = nowMs();
    L.toGarage = Object.assign(verdict(tg - from), { from: W.__pbClick != null ? 'the menu click' : 'the page load', aimMs: GARAGE_AIM_MS, phases: phases({ t: from, log: 0, prog: 0 }, tg) });
    say('launch ' + A.pass + ': the garage in ' + L.toGarage.s + ' s (' + L.toGarage.from + ')');
    if (garageOnly() || !document.getElementById('bGo')) return L;
    await sleep(3000);
    // Go -> flying with the world settled (the roll-out screen gone, the sim's clock rising, then two seconds of frames under 100 ms)
    let m = mark0();
    const flew = await goUntilFlying();
    await bootGone(300);
    for (let i = 0; i < 60; i++) { takeFrames(); await sleep(2000); const fr = takeFrames(); if (fr && fr.max <= 100) break; }
    let t1 = nowMs();
    L.toWorld = Object.assign(verdict(t1 - m.t), { flew, phases: phases(m, t1) });
    say('launch ' + A.pass + ': the world in ' + L.toWorld.s + ' s');
    await sleep(4000);
    // back to the shed (the game's own way), the roll-in screen gone and the garage up (body.mode-ws: the workshop screen - setMode;
    // the 18 Nov 06:00 check waited on a body.garage that is never set and timed out at 120 s)
    m = mark0();
    try { FLYDIY_MENU.act('shed'); } catch (e) {}
    for (let i = 0; i < 480 && !document.body.classList.contains('mode-ws'); i++) await sleep(250);
    await bootGone(300);
    t1 = nowMs();
    L.worldToGarage = Object.assign(verdict(t1 - m.t), { phases: phases(m, t1) });
    say('launch ' + A.pass + ': back in the shed in ' + L.worldToGarage.s + ' s');
    await sleep(2000);
    return L;
  }
  function miss(U, x, el) {
    const m = [];
    if (!U) return m;
    if (U.s != null && !(el >= U.s)) m.push('s ' + (el == null ? '-' : r1(el)) + ', wants >= ' + U.s);   // (until.s: the step's own seconds, the game's clock)
    if (U.s != null && Object.keys(U).length === 1) return m;   // (a wait needs no sim: a pan, a soak)
    if (!x) return ['the page has no sim'];
    if (U.phase != null) { const L = [].concat(U.phase); if (!L.includes(x.ph)) m.push('phase ' + x.ph + ', wants ' + L.join('|')); }
    if (U.agl != null && !(x.agl >= U.agl)) m.push('AGL ' + x.agl + ' m, wants >= ' + U.agl);
    if (U.engine === true && x.engine === false) m.push('an engine is not running');
    if (U.stoppedAt != null && !(x.ph === 'STOPPED' && x.where === U.stoppedAt)) m.push(x.ph !== 'STOPPED' ? 'not STOPPED (' + x.ph + ')' : 'stopped on ' + (x.where || 'no strip') + ', wants ' + U.stoppedAt);
    if (U.declined && !x.declined) m.push('no take-off declined');
    return m;
  }
  function fault(x, st) {
    if (!x) return null;
    const al = new Set((st && st.allow) || []), U = (st && st.until) || null;
    if (x.crashed && !al.has('crash')) return 'the damage ended the flight: ' + (x.dmg || 'crashed');
    if (x.ph === 'ABORT') return 'the take-off was rejected (ABORT)';
    if (x.declined && !al.has('declined') && !(U && U.declined)) return 'the take-off was declined: ' + x.declined;
    return null;
  }
  const flying = () => { const b = W.document && document.body && document.body.classList; return !!(b && b.contains('mode-fly') && !b.contains('mode-ws') && !(W.BOOT && BOOT.state && BOOT.state !== 'gone')); };
  async function goUntilFlying(tries) {
    for (let a = 0; a < (tries || 8); a++) {
      const b = document.getElementById('bGo'); if (b) b.click();
      for (let i = 0; i < 24; i++) { await sleep(500); const s0 = state(); if (flying() && s0) { await sleep(1500); const s1 = state(); if (s1 && s1.t > s0.t) return true; } }
    }
    return false;
  }
  const setSel = (id, v) => { const s = document.getElementById(id); if (!s) return 'no #' + id; if (![...s.options].some(o => o.value === v)) return 'no option ' + v;
    s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; };

  // ---- THE SCENARIOS --------------------------------------------------------------------------------------------------
  async function getJSON(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); }
  async function list() {
    let L = null;
    try { const ix = await getJSON('tools/flight_scripts/index.json'); L = (Array.isArray(ix) ? ix : ix.scenarios || []).map(e => typeof e === 'string' ? { name: e } : e); } catch (e) {}
    if (!L) L = LIB.map(name => ({ name }));
    for (const e of L) { e.file = fileOf(e); if (!e.what) { try { e.what = (await getJSON(e.file)).what || ''; } catch (er) { e.missing = true; } } }
    return L.filter(e => !e.missing);
  }
  const fileOf = e => { const f = e && e.file ? String(e.file) : 'tools/flight_scripts/' + (e && e.name ? e.name : e) + '.json'; return /^tools\//.test(f) ? f : 'tools/flight_scripts/' + f; };
  async function planeOf(p) {
    const m = /^list:(\d+)$/.exec(String(p || ''));
    if (m) { const L = await getJSON('builds/lists/plane_lists.json'); const row = (L.planes || []).find(r => r.n === +m[1]);
      if (!row || !row.file) throw new Error('plane ' + p + ': no such row with a file'); return { file: row.file, name: row.name + (row.reg ? ' (' + row.reg + ')' : '') + ' [' + p + ']' }; }
    return { file: String(p), name: String(p).split('/').pop() };
  }
  const garageOnly = () => !!(W.PROFILE && W.PROFILE.is && W.PROFILE.is('boot', 'garage'));
  function device() {
    let gpu = null; try { const g = W.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(), d = g && g.getExtension('WEBGL_debug_renderer_info'); gpu = d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; } catch (e) {}
    let preset = null; try { const b = W.GFX && GFX.budget ? GFX.budget() : null; preset = b ? b.preset : null; } catch (e) {}
    let prof = null; try { prof = W.PROFILE && PROFILE.name ? (typeof PROFILE.name === 'function' ? PROFILE.name() : PROFILE.name) : null; } catch (e) {}
    // (CODEX's test plan: the settings and the viewport fixed and RECORDED; cold vs warm kept apart - the load's source)
    let canvas = null; try { const c = W.FLYDIY_RENDERER && FLYDIY_RENDERER.domElement; canvas = c ? [c.width, c.height] : null; } catch (e) {}
    let load = null; try { const nv = performance.getEntriesByType('navigation')[0]; load = { sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), transferKB: nv ? Math.round(nv.transferSize / 1024) : null, type: nv ? nv.type : null }; } catch (e) {}
    return { ua: navigator.userAgent, gpu, preset, profile: prof, garageOnly: garageOnly(), screen: [screen.width, screen.height], canvas, load, dpr: W.devicePixelRatio || 1,
             cores: navigator.hardwareConcurrency || null, memGB: navigator.deviceMemory || null, build: W.FLYDIY_BUILD || null };
  }

  // ---- THE RUN -------------------------------------------------------------------------------------------------------
  // run(name | null, { crash }) seeds and reloads; the armed run goes on after the boot (resume, below)
  async function run(name, o) {
    o = o || {};
    const e = name && typeof name === 'object' ? name : (name ? { name } : null);
    const A = { v: V, name: e ? e.name : null, file: e ? fileOf(e) : null, crash: !!o.crash, armedAt: Date.now(), mode: W.FLYDIY_MODE || 'sandbox' };
    if (e) {
      const S = await getJSON(A.file);
      const P = await planeOf(S.plane);
      const card = await (await fetch(P.file, { cache: 'no-store' })).text();
      try { W.localStorage.setItem('flydiy.wip', card); } catch (e) { throw new Error('the working build could not be written: ' + e.message); }
      A.scenario = S; A.plane = P;
    }
    ss.set(KEY, A);
    location.reload();
  }
  const T = { trace: null };
  async function resume(A) {
    ss.del(KEY);   // (never two runs from one arming: a reload in the run starts nothing)
    A.pass = A.pass || 1; A.loads = A.loads || [];
    const tr = T.trace = { what: 'flydiy-perfbench', v: V, run: { scenario: A.name, what: A.scenario ? A.scenario.what || null : null, plane: A.plane ? A.plane.name : null,
      build: A.plane ? A.plane.file : null, from: A.scenario ? A.scenario.from : null, to: A.scenario ? (A.scenario.to || A.scenario.from) : null,
      persona: A.scenario ? (A.scenario.persona || 'expert') : null, at: new Date().toISOString() }, device: null, loads: null, boot: null, garage: null, steps: [], crash: null, end: null };
    const card = ui();
    const PROG = 'flydiy.perfbench.progress';
    const say = t => { if (card) card.log(t); try { const p = JSON.parse(W.sessionStorage.getItem(PROG) || '[]'); p.push(new Date().toISOString().slice(11, 19) + ' ' + t); W.sessionStorage.setItem(PROG, JSON.stringify(p.slice(-200))); } catch (e) {} };
    if (card && A.log) for (const l of A.log) card.log(l);
    const sayK = t => { say(t); (A.log = A.log || []).push(t); };
    // THE LOADS: launch 1 (as cached as the browser happens to be: its source recorded), then launch 2 (warm: the cache kept)
    const LD = await loadCycle(A, sayK);
    A.loads.push(LD);
    if (A.pass === 1) { A.pass = 2; ss.set(KEY, A); sayK('the second launch (warm)...'); await sleep(1500); location.reload(); return null; }
    tr.loads = { cold: A.loads[0] || null, warm: A.loads[1] || null, targets: { garageAimMs: GARAGE_AIM_MS, maxMs: LOAD_TARGET_MS },
                 note: 'cold = the first launch as the browser had it cached (its source: sw / transferKB); a true cold: clear the site\'s cache first' };
    // THE BOOT: the loading screen's frames since eval, the first contact to the garage (ms from the navigation)
    tr.boot = { garageMs: A.loads[1] && A.loads[1].toGarage ? A.loads[1].toGarage.ms : Math.round(nowMs()), loading: takeFrames(), long: takeLong() };
    tr.device = device();
    say('boot: the garage at ' + (tr.boot.garageMs / 1000).toFixed(1) + ' s' + (tr.boot.loading ? ', loading-screen frames max ' + tr.boot.loading.max + ' ms' : ''));
    await sleep(3000); takeFrames(); takeLong();
    tr.garage = { sliders: await sliders(say), menu: await menuRows(say) };
    if (A.scenario && !garageOnly()) await flight(A.scenario, tr, say);
    else if (A.scenario) say('the phone profile boots the garage alone: no flight here (the garage steps are the phone\'s)');
    if (A.crash && !garageOnly() && W.FLIGHT_PROBE && FLIGHT_PROBE.sim && FLIGHT_PROBE.sim()) tr.crash = await crash(say);
    tr.end = { ok: tr.steps.every(s => s.ok), passed: tr.steps.filter(s => s.ok).length, of: A.scenario ? A.scenario.steps.length : 0, at: new Date().toISOString() };
    seg('end');
    try { W.localStorage.setItem(LAST, JSON.stringify(tr)); } catch (e) {}
    if (recOn()) {
      try { FLIGHT_REC.event('bench', null, { scenario: A.name, file: A.file, runner: 'ingame', run: tr.run, device: tr.device, loads: tr.loads, boot: tr.boot, garage: tr.garage, crash: tr.crash, end: tr.end,
        steps: tr.steps.map(x => ({ i: x.i, name: x.name, do: x.do, ok: x.ok, t0: x.t0, t1: x.t1, phases: x.phases, frames: x.frames, why: x.why, worldMs: x.worldMs, kind: x.kind })) }); } catch (e) {}
      try { await FLIGHT_REC.save(); say('done - the flight log is saved (a download): tools/perf_trace.js makes the report'); } catch (e) { say('the log could not be saved: ' + e.message); download(tr); }
    } else { say('the flight recorder is off: the summary is saved instead'); download(tr); }
    if (card) card.done(tr);
    return tr;
  }
  // the editor's sliders: a step up, then back, by script; input to the next drawn frame (rAF after the change, twice)
  async function sliders(say) {
    const R = [], el = [...document.querySelectorAll('input[type=range]')].filter(x => x.offsetParent && !x.disabled).slice(0, 4);
    if (el.length) seg('garage-sliders');
    for (const s of el) {
      const v0 = s.value, step = +s.step || ((+s.max - +s.min) / 50) || 1, ms = [];
      for (let i = 0; i < 8; i++) {
        s.value = String(Math.min(+s.max, Math.max(+s.min, +v0 + (i % 2 ? 0 : step))));
        const t0 = nowMs();
        s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        ms.push(nowMs() - t0); await sleep(120);
      }
      s.value = v0; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
      const st = stats(ms);
      R.push({ id: s.id || s.name || (s.closest('[data-key]') ? s.closest('[data-key]').dataset.key : null) || ('range' + R.length), p50: st.p50, max: st.max, ok: st.max <= 100 });
      await sleep(400);
    }
    say('garage sliders: ' + (R.length ? R.map(r => r.id + ' ' + r.p50 + '/' + r.max + ' ms').join(', ') : 'none on screen'));
    return R;
  }
  // every row of the game menu opened (its page, or its act) and closed: the longest frame of the 3 s after
  async function menuRows(say) {
    const M = W.FLYDIY_MENU, R = [];
    if (!M || !M.open) return R;
    // an ALLOWLIST (18 Nov 03:45: the menu also holds rows that reload or clean the page - updcheck, updclean - and a reload after the
    // run's disarm ends it silently): the game's own pages and panels, never an update, a clean, the log, the full screen or the exits
    const SAFE = new Set(['map', 'contracts', 'controls', 'graphics', 'sound', 'cards', 'gCamera', 'gDisplay', 'gNight', 'gLegend', 'gStudio']);
    M.open(); await sleep(600);
    const keys = [...document.querySelectorAll('#gmPanel [data-g]')].map(b => b.dataset.g).filter(k => SAFE.has(k));
    M.close();
    for (const k of keys) {
      await sleep(500); takeFrames(); takeLong();
      M.open(); await sleep(300);
      seg('menu:' + k);
      const t0 = nowMs(); M.act(k);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const first = Math.round(nowMs() - t0);
      await sleep(3000);
      const fr = takeFrames(), lg = takeLong();
      R.push({ row: k, firstFrameMs: first, max: fr ? fr.max : null, over100: fr ? fr.over100 : null, long: lg.tasks.slice(0, 5), ok: first < 5000 && (!fr || fr.max <= 100) });
      try { if (M.page) M.page(null); M.close(); } catch (e) {}
      try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {}
    }
    say('menu rows: ' + (R.length ? R.map(r => r.row + ' ' + r.firstFrameMs + '/' + r.max + ' ms').join(', ') : 'none'));
    return R;
  }
  async function flight(S, tr, say) {
    const brief = [];
    if (S.day === 'calm') brief.push('cond ' + setSel('selCond', 'calm'));
    if (S.persona) brief.push('persona ' + setSel('selPersona', S.persona));
    brief.push('to ' + setSel('selDest', (S.to && S.to !== S.from) ? S.to : 'CIRCUIT'));
    tr.run.brief = brief;
    let failed = null;
    for (let si = 0; si < S.steps.length && !failed; si++) {
      const st = S.steps[si], phases = [], w0 = Date.now();
      seg(st.name);
      let s = state(); takeFrames(); takeLong();
      let t0 = s ? s.t : 0, extra = null;
      if (st.do === 'start') { const tw = nowMs(); const ok = await goUntilFlying(); extra = { worldMs: Math.round(nowMs() - tw), worldAtMs: Math.round(nowMs()) }; s = state(); t0 = s ? s.t : 0;
        if (!ok) failed = { what: 'Go did not reach a flight (mode-fly and the sim clock rising) in 8 tries' }; }
      else if (st.do === 'leg') { setSel('selDest', st.to); const ok = W.FLIGHT_PROBE && FLIGHT_PROBE.nextLeg ? FLIGHT_PROBE.nextLeg() : false; if (!ok) say('leg to ' + st.to + ': no Fly on'); s = state(); t0 = s ? s.t : 0; }
      else if (st.do === 'lift') { try { FLIGHT_PROBE.place({ by: [0, +st.by, 0] }); } catch (e) {} }
      else if (st.do === 'board') { if (!s) failed = { what: 'not ready to board: no sim / pilot on the page' }; }
      else if (st.do) { const r = await doKind(st); if (r) extra = Object.assign(extra || {}, { kind: r }); s = state(); }
      const U = st.until || null, cap = st.capS || 0;
      const elS = () => (s ? s.t - t0 : (Date.now() - w0) / 1000);
      let m = U ? miss(U, s, elS()) : [];
      while (!failed && m.length) {
        if (s && s.t - t0 >= cap) { failed = { what: 'the cap: ' + cap + ' s passed with ' + m.join('; '), phase: s.ph, said: s.said, pos: s.cg, where: s.where }; break; }
        if (Date.now() - w0 > (cap * 3 + 120) * 1000) { failed = { what: 'the wall clock: ' + Math.round((Date.now() - w0) / 1000) + ' s for a ' + cap + ' s step' }; break; }
        await sleep(250); s = state();
        if (s && phases[phases.length - 1] !== s.ph) phases.push(s.ph);
        const f = fault(s, st); if (f) { failed = { what: f, phase: s.ph, said: s.said, pos: s.cg, where: s.where }; break; }
        m = miss(U, s, elS());
      }
      const rec = Object.assign({ type: 'step', i: si, name: st.name, do: st.do || null, ok: !failed, t0: r1(t0), t1: s ? r1(s.t) : null, phases,
        end: s ? { ph: s.ph, pos: s.cg, agl: s.agl, where: s.where } : null, said: s ? s.said : [], frames: takeFrames(), long: takeLong(), wallS: r1((Date.now() - w0) / 1000), why: failed }, extra || {});
      tr.steps.push(rec);
      say((rec.ok ? 'ok ' : 'FAIL ') + (si + 1) + ' ' + st.name + (rec.frames ? ' | p50 ' + rec.frames.p50 + ', p99 ' + rec.frames.p99 + ', max ' + rec.frames.max + ' ms' : '') + (failed ? ' - ' + failed.what : ''));
    }
  }
  // PILOT'S STEP KINDS (PERF-TRACE-FORMAT.md section 1), in the page: -> a word for the step line, or '' (done)
  async function doKind(st) {
    const P = W.FLIGHT_PROBE;
    switch (st.do) {
      case 'skip': { const b = document.getElementById('bSkip'); if (b) b.click(); return b ? '' : 'no #bSkip'; }
      case 'weather': return setSel('selCond', st.cond) === 'ok' ? '' : 'no such conditions: ' + st.cond;
      case 'dest': return setSel('selDest', st.to) === 'ok' ? '' : 'no such destination: ' + st.to;
      case 'time': { try { W.DAY_CLOCK.set({ localHours: +st.hour }); return ''; } catch (e) { return 'the clock: ' + e.message; } }
      case 'shed': { try { FLYDIY_MENU.act('shed'); } catch (e) {} for (let i = 0; i < 120 && !document.body.classList.contains('mode-ws'); i++) await sleep(500);
        return document.body.classList.contains('mode-ws') ? '' : 'not back in the shed'; }
      case 'rollout': return (await goUntilFlying()) ? '' : 'the roll-out did not reach a flight';
      case 'camera': {
        if (!P || !P.camMode) return 'no camera API';
        const v = st.view || 'chase', sec = +st.s || 0;
        if (v === 'orbit' || v === 'pan360') {
          P.camMode('orbit'); await sleep(200);
          const g = P.camGet ? P.camGet() : { az: 0, el: 0.1, dist: 20 }, sw = (+st.sweep || (v === 'pan360' ? 360 : 180)) * Math.PI / 180, t0 = nowMs(), dur = Math.max(0.5, sec) * 1000;
          for (;;) { const k = Math.min(1, (nowMs() - t0) / dur); P.camSet(g.az + sw * k, g.el, +st.dist || g.dist); if (k >= 1) break; await new Promise(r => requestAnimationFrame(r)); }
        } else { P.camMode(v); if (sec > 0) await sleep(sec * 1000); }
        return '';
      }
      case 'minimap': return 'minimap: not in the page API yet (skipped)';
      case 'load': return 'load: the loading path is not driven yet (skipped)';
      case 'wait': return '';
      default: return 'unknown step kind ' + st.do + ' (skipped)';
    }
  }
  async function crash(say) {
    seg('crash');
    takeFrames(); takeLong();
    const a = W.FLIGHT_PROBE.agl ? FLIGHT_PROBE.agl() : 0;
    try { FLIGHT_PROBE.place({ by: [0, -(Math.max(0, a) + 2), 0] }); } catch (e) { return { error: e.message }; }
    const t0 = nowMs(); await sleep(6000);
    const R = { frames: takeFrames(), long: takeLong(), wallMs: Math.round(nowMs() - t0), state: state() };
    say('crash: max frame ' + (R.frames ? R.frames.max : '-') + ' ms');
    return R;
  }
  function download(tr) {
    try {
      const b = new Blob([JSON.stringify(tr, null, 1)], { type: 'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = 'flydiy_bench_' + (tr.run.scenario || 'garage') + '_' + (tr.run.at || '').replace(/[:.]/g, '-').slice(0, 19) + '.json';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 4000); return true;
    } catch (e) { return false; }
  }
  const last = () => { try { return JSON.parse(W.localStorage.getItem(LAST) || 'null'); } catch (e) { return null; } };

  // ---- THE CARD (a game card: draggable, closable) ---------------------------------------------------------------------
  let CARD = null;
  function ui() {
    if (!W.document || !document.body) return null;
    if (CARD) { CARD.el.hidden = false; return CARD; }
    const el = document.createElement('div'); el.id = 'perfBench'; el.className = 'cdCard';
    el.style.cssText = 'position:fixed;top:72px;right:16px;z-index:2147481000;width:min(360px,calc(100vw - 32px));max-height:70vh;overflow:auto;padding:12px 14px;border-radius:10px;' +
      "background:rgba(24,22,20,.93);color:#eee6d8;font:13px/1.45 'IBM Plex Sans',system-ui,sans-serif;border:1px solid rgba(255,178,87,.5)";
    el.innerHTML = '<div class="cdHandle" style="display:flex;justify-content:space-between;align-items:center;font-weight:600;letter-spacing:.06em;margin-bottom:8px">BENCHMARK' +
      '<button type="button" data-pb="x" style="background:none;border:0;color:#ffb257;font-size:18px;cursor:pointer" aria-label="close">×</button></div>' +
      '<div data-pb="body"></div><pre data-pb="log" style="white-space:pre-wrap;font:12px/1.4 ui-monospace,monospace;color:#cfc6b6;margin:8px 0 0"></pre>';
    document.body.appendChild(el);
    try { if (W.FLYDIY_DRAG && FLYDIY_DRAG.card) FLYDIY_DRAG.card(el, 'perfBench', { handle: '.cdHandle' }); } catch (e) {}   // (every card draggable: the user's rule)
    const body = el.querySelector('[data-pb=body]'), logEl = el.querySelector('[data-pb=log]');
    const btn = (t, f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,178,87,.45);background:rgba(255,178,87,.08);color:#f1e7d6;cursor:pointer;font:inherit'; b.onclick = f; return b; };
    el.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-pb]'); if (t && t.dataset.pb === 'x') el.hidden = true; });
    CARD = { el, log: t => { logEl.textContent += t + '\n'; },
      menu: async () => {
        body.textContent = ''; logEl.textContent = '';
        const p = document.createElement('div'); p.style.cssText = 'color:#a89f90;margin-bottom:6px';
        p.textContent = 'Runs in this page: two launches (cold, then warm) timing the garage, the world and the way back to the shed, then the steps; the flight recorder\'s log is saved at the end (a download).' + (garageOnly() ? ' This profile boots the garage alone: the garage steps only.' : '');
        body.appendChild(p);
        body.appendChild(btn('Garage + menus only', () => run(null)));
        if (!garageOnly()) { let L = []; try { L = await list(); } catch (e) {}
          for (const s of L) body.appendChild(btn(s.name + (s.what ? ' - ' + String(s.what).slice(0, 70) : ''), () => run(s)));
          body.appendChild(btn('The first one, then a crash (the crash lag)', () => L[0] && run(L[0], { crash: true }))); }
        const lt = last(); if (lt) { const q = document.createElement('div'); q.style.cssText = 'color:#a89f90;margin-top:8px'; q.textContent = 'Last run: ' + (lt.run.scenario || 'garage') + ', ' + String(lt.run.at || '').slice(0, 16) + ' - ' + (lt.end && lt.end.ok ? 'every step passed' : 'stopped at a step'); body.appendChild(q); }
      },
      done: tr => { body.appendChild(btn(recOn() ? 'Save the flight log again' : 'Save the summary again', () => (recOn() ? FLIGHT_REC.save() : download(tr)))); } };
    return CARD;
  }
  function open() { const c = ui(); if (c) { c.el.hidden = false; c.menu(); } return !!c; }

  // ---- WIRING: the armed run's frames from eval; the menu row once the menu stands; the resume once the page booted -------
  const armed = ss.get(KEY);
  if (armed && armed.v === V) framesOn();
  if (W.document) {
    let tries = 0;
    // (an armed run answers the welcome menu itself with the mode it was armed in, and times from that click: TIME-TO-GARAGE)
    if (armed && armed.v === V) { let wt = 0; const ans = () => { const b = document.querySelector('button.wmode[data-mode="' + (armed.mode || 'sandbox') + '"]');
      if (b && b.offsetParent && !b.disabled) { W.__pbClick = nowMs(); b.click(); return; } if (++wt < 120 && !W.FLYDIY_MENU) setTimeout(ans, 250); }; setTimeout(ans, 250); }
    const wire = () => {
      if (W.FLYDIY_MENU && FLYDIY_MENU.add) FLYDIY_MENU.add({ k: 'perfbench', label: 'Benchmark', sec: 'Options', before: 'main', act: () => { try { FLYDIY_MENU.close(); } catch (e) {} open(); } });
      else if (++tries < 240) return setTimeout(wire, 500);
      if (armed && armed.v === V) { framesOn(); resume(armed).catch(e => { const c = ui(); if (c) c.log('the run stopped: ' + (e && e.message || e)); }); }
    };
    setTimeout(wire, 0);
  }
  return { open, list, run, last, download, _stats: stats, _miss: miss, _fault: fault, _state: state };
})();
if (typeof window !== 'undefined') window.FLYDIY_PERFBENCH = FLYDIY_PERFBENCH;
if (typeof module !== 'undefined' && module.exports) module.exports = FLYDIY_PERFBENCH;
