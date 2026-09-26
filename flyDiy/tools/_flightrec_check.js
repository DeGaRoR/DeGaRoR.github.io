#!/usr/bin/env node
// GATE FLIGHTREC (G620) - the flight recorder (src/viewer/flight_recorder.js) and its reader (tools/analyze_log.js).
// The module as it ships, on a fake page (a window, a document that can hide, a renderer whose render() calls its
// shadow map's, a WebGL2 context with the timer extension that THROWS if two TIME_ELAPSED queries nest):
//   1. THE ROW: a scripted clock drives frames through the loop's own hooks (begin / push / pop / lap / end) -
//      every CPU slot gets exactly the time its section took, the nested pushes (the premises inside the world, the
//      shadow pass inside the render, a shader link) come out of the enclosing section, the split sums to the work;
//      the wall interval, the steps owed and taken, the draws and triangles summed over the frame's renders, the
//      aeroplane's numbers from the probe, the phase and camera codes.
//   2. FREEZES COUNT: a 400 ms interval is kept, flagged and an event; a gap spent HIDDEN is flagged away, not a
//      freeze; a frame the loop abandoned (a throw) is closed by the next begin.
//   3. THE WRAPPERS CHANGE NOTHING: render / shadow / linkProgram / getProgramParameter return what the originals
//      return with the arguments they were given; the GPU query yields to another module's (theirs works, no
//      nesting), stays off while theirs runs, and times the frame (the fake's 5 ms) otherwise.
//   4. THE RING AND THE STORE'S CHUNKS: past the ring's length the rows wrap, a full chunk is handed on with its
//      own rows, the log's JSON parses and carries the ring's last rows.
//   5. THE READER: analyze_log.js on two scripted sessions - a clean one (every ROLLOUT target PASS) and one with a
//      150 ms freeze, a 4 s stretch at 20 fps in the climb, a 40 fps taxi and a 1.2 s task (the four FAIL, the stand
//      PASS), the phases from the autopilot and from the aeroplane under the hand, the worst frame's events.
//   6. THE COST: 100 000 frames of the loop's real hook sequence on the real clock - the recorder's own time a frame
//      (budget 0.2 ms; asserted under 0.02 ms here, node's clock being faster than a browser's) and its ALLOCATION
//      a frame measured in a child node with a 128 MB young generation (asserted under 8 bytes a frame over the
//      same clock calls done bare).
//   7. THE WIRING: the hooks where the loop needs them (app.js, render_world.js), the module in the build before
//      app.js, the graphics rows, the F8 panel's and the flyout's frame rates reading rendered frames.
//   node tools/_flightrec_check.js         -> "GATE FLIGHTREC: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), v8 = require('v8');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'viewer', 'flight_recorder.js');

// ---- the child: the allocation measurement ------------------------------------------------------------------------
if (process.argv.includes('--alloc')) {
  global.window = { location: { search: '' }, localStorage: { getItem: () => null, setItem() {} } };
  const FR = require(SRC);
  // A CLOCK THAT ALLOCATES NOTHING: integer-valued (V8 never boxes a small integer). A double-valued clock - node's
  // performance.now(), or a typed array's cell - comes back as a fresh heap number from every call V8 does not inline
  // (16-32 bytes; measured), which is the clock read's cost in any caller, not the recorder's; the same for a double
  // passed across a call (the frame's timestamp)
  let CI = 1000, TI = 1000;
  const R = FR.make({ frames: 65536, now: () => (CI += 13) });
  const rend = fakeRenderer(null, { nolog: true }).renderer;
  R.attach(rend, { frame(P, cg) { P.garage = false; P.running = true; P.held = false; P.manual = false; P.cam = 'chase'; P.phase = 'CLIMB'; P.spd = 40.5; P.vs = 2.5; P.agl = 120.5; } });
  const cg = [1.5, 2.5, 3.5], pc = { steps: 2 };
  const frameRec = () => { TI += 33; hookFrame(R, rend, TI, pc, cg); };
  const newUsed = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
  for (let i = 0; i < 300000; i++) frameRec();   // warm: the JIT settles
  const M = 20000, per = [];
  for (let rep = 0; rep < 3; rep++) { global.gc(); const a = newUsed(); for (let i = 0; i < M; i++) frameRec(); per.push((newUsed() - a) / M); }
  process.stdout.write(JSON.stringify({ bytes: Math.min(...per), reps: per }));
  process.exit(0);
}

let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-3 : e);

// ---- the fakes ------------------------------------------------------------------------------------------------------
// a renderer whose render() takes `renderMs` on the clock, calls the shadow map (which takes `shadowMs`), and leaves
// info.render as three's autoReset does: this call's own draws
function fakeRenderer(clock, o) {
  o = o || {};
  const log = [];
  const renderer = {
    info: { render: { calls: 0, triangles: 0 }, autoReset: true },
    shadowMap: { render(lights, scene, cam) { if (!o.nolog) log.push(['shadow', lights, scene, cam]); if (clock) clock.t += o.shadowMs || 0; return 'shadow-ret'; } },
    render(scene, cam) {
      if (!o.nolog) log.push(['render', scene, cam]);
      this.info.render.calls = 0; this.info.render.triangles = 0;
      this.shadowMap.render('L', scene, cam);
      if (clock) clock.t += o.renderMs || 0;
      this.info.render.calls = o.calls || 7; this.info.render.triangles = o.tris || 1000;
      return 'render-ret';
    },
    getContext: () => o.gl || null, domElement: { width: 1920, height: 1080, clientWidth: 1920, clientHeight: 1080 },
  };
  return { renderer, log };
}
// a WebGL2 context with EXT_disjoint_timer_query_webgl2: a result lands 2 frames after its query ends; two open
// TIME_ELAPSED queries THROW (the real GL's INVALID_OPERATION, made loud)
function fakeGL(clock) {
  const TE = 0x88BF, AVAIL = 0x8867, RESULT = 0x8866, DISJ = 0x8FBB, LINK = 0x8B82;
  const S = { active: null, frame: 0, nested: 0, links: 0, begins: [] };
  const gl = {
    QUERY_RESULT_AVAILABLE: AVAIL, QUERY_RESULT: RESULT, LINK_STATUS: LINK, VENDOR: 1, RENDERER: 2, VERSION: 3, MAX_TEXTURE_SIZE: 4,
    getExtension: n => n === 'EXT_disjoint_timer_query_webgl2' ? { TIME_ELAPSED_EXT: TE, GPU_DISJOINT_EXT: DISJ } : null,
    createQuery: () => ({ done: -1 }),
    beginQuery(t, q) { if (t === TE) { if (S.active) { S.nested++; throw new Error('INVALID_OPERATION: a TIME_ELAPSED query is already active'); } S.active = q; S.begins.push(q); } },
    endQuery(t) { if (t === TE) { if (!S.active) throw new Error('INVALID_OPERATION: no active query'); S.active.done = S.frame; S.active = null; } },
    getQueryParameter: (q, p) => p === AVAIL ? (q.done >= 0 && S.frame - q.done >= 2) : 5e6,
    getParameter: p => p === DISJ ? false : 'fake',
    linkProgram(p) { S.links++; p.linked = true; if (clock) clock.t += 2; return 'link-ret'; },
    getProgramInfoLog(p) { if (clock) clock.t += 3; return 'log-of-' + p.id; },
    getProgramParameter(p, pn) { return pn === LINK ? !!p.linked : 'other-' + pn; },
  };
  return { gl, S };
}
// the loop's hook sequence, as app.js runs it (two solver steps; the world with its premises, fill and cover; the
// render with its shadow pass; three renders a frame: a probe, the mirror, the main)
function hookFrame(R, rend, ts, pc, cg) {
  R.begin(ts, pc);
  for (let k = 0; k < pc.steps; k++) { R.push(0); R.pop(); R.push(1); R.pop(); }
  R.lap(12);
  R.push(3); R.pop(); R.push(5); R.pop(); R.push(4); R.pop();
  rend.render(null, null);
  R.lap(2); R.lap(6); R.lap(7);
  rend.render(null, null);
  R.lap(8);
  rend.render(null, null);
  R.lap(9);
  R.end(true, cg);
}

// ---- the page ---------------------------------------------------------------------------------------------------------
const clock = { t: 1000 };
const visHandlers = [];
const visHandler = () => visHandlers.forEach(f => f());
const doc = { hidden: false, readyState: 'complete', body: null, addEventListener: (k, f) => { if (k === 'visibilitychange') visHandlers.push(f); } };
global.window = { location: { search: '' }, localStorage: { getItem: () => null, setItem() {} }, document: doc, BOOT: { state: 'loading', set: 'rollout' } };
const FR = require(SRC);
const An = require(path.join(__dirname, 'analyze_log.js'));
const W = global.window;
verdict(W.FLIGHT_REC === FR && typeof FR.make === 'function', 'the module publishes window.FLIGHT_REC');
const S = FR.rec.S, SL = FR.SLOTS;

// ---- 1. the row -------------------------------------------------------------------------------------------------------
{
  const R = FR.make({ now: () => clock.t, frames: 1024, chunk: 256 });
  const { gl, S: G } = fakeGL(clock);
  const { renderer, log } = fakeRenderer(clock, { renderMs: 3, shadowMs: 1.5, calls: 9, tris: 2500, gl });
  const probe = { frame(P, cg) { P.garage = false; P.running = true; P.held = false; P.manual = false; P.cam = 'chase'; P.phase = 'CLIMB'; P.spd = 41; P.vs = 2.5; P.agl = cg ? cg[1] - 10 : NaN; } };
  R.attach(renderer, probe);
  const adv = ms => { clock.t += ms; };
  let ts = 5000;
  const oneFrame = (steps, extra) => {
    ts += 33.3; clock.t = ts + 0.5;
    R.begin(ts, { steps });
    for (let k = 0; k < steps; k++) { R.push(0); adv(0.2); R.pop(); R.push(1); adv(1.0); R.pop(); }
    adv(0.3); R.lap(S.other);
    adv(0.4); R.push(S.prem); adv(0.5); R.pop(); adv(0.6); R.push(S.cover); adv(0.25); R.pop(); adv(0.5); R.lap(S.world);
    adv(0.4); R.lap(S.scene); adv(0.1); R.lap(S.hud); R.lap(S.mirror);
    if (extra) extra();
    renderer.render('scene', 'cam'); R.lap(S.render);
    adv(0.2); R.end(true, [3, 110, 4]);
  };
  for (let i = 0; i < 4; i++) oneFrame(2);
  const r = R.row(R.frame - 1);
  const want = { script: 0.4, solver: 2.0, other: 0.5, prem: 0.5, cover: 0.25, world: 1.5, scene: 0.4, hud: 0.1, mirror: 0, render: 3.0, shadow: 1.5, shader: 0, fill: 0 };
  let sum = 0; for (const k of SL) sum += r[k];
  const bad = Object.keys(want).filter(k => !near(r[k], want[k], 1e-3));
  verdict(!bad.length, `1 each slot has its section's time (script ${r.script.toFixed(2)}, solver ${r.solver.toFixed(2)}, world ${r.world.toFixed(2)} with prem ${r.prem.toFixed(2)} / cover ${r.cover.toFixed(2)} out, render ${r.render.toFixed(2)} with shadow ${r.shadow.toFixed(2)} out)` + (bad.length ? ' - wrong: ' + bad.map(k => k + ' ' + r[k].toFixed(3) + ' != ' + want[k]).join(', ') : ''));
  verdict(near(sum, r.work, 1e-3) && near(r.work, 10.15, 1e-3), `  the split sums to the work (${sum.toFixed(3)} = ${r.work.toFixed(3)} ms)`);
  verdict(near(r.dt, 33.3, 1e-3) && r.owed === 2 && r.taken === 2, `  the wall interval ${r.dt.toFixed(1)} ms, steps owed ${r.owed} / taken ${r.taken}`);
  verdict(r.calls === 9 && r.tris === 2500, `  draws ${r.calls} and triangles ${r.tris} (renderer.info after each render, summed)`);
  verdict(near(r.agl, 100, 1e-4) && near(r.spd, 41, 1e-4) && near(r.x, 3) && FR.rec.S && R.names.phase[r.phase] === 'CLIMB' && R.names.cam[r.cam] === 'chase' && (r.flags & FR.F.running),
    `  the probe: agl ${r.agl}, speed ${r.spd}, phase ${R.names.phase[r.phase]}, camera ${R.names.cam[r.cam]}, flags ${r.flags}`);
  // a shader link inside the render: its time is the shader slot's, an event, and the page held by the first status read
  oneFrame(1, () => { const p = { id: 7 }; const a = gl.linkProgram(p); const lg = gl.getProgramInfoLog(p); const st = gl.getProgramParameter(p, gl.LINK_STATUS); const o2 = gl.getProgramParameter(p, 35); oneFrame.ret = [a, lg, st, o2]; });
  const r2 = R.row(R.frame - 1);
  const evL = R.events.filter(e => e[1] === 'link' || e[1] === 'linkwait');
  verdict(near(r2.shader, 5, 1e-3) && near(r2.render, 3.0, 1e-3) && evL.length === 2 && evL[1][2] === 3,
    `  a link in the frame: shader ${r2.shader.toFixed(2)} ms (link 2 + the status wait 3), render still ${r2.render.toFixed(2)}, events ${evL.map(e => e[1] + ' ' + e[2]).join(', ')}`);
  verdict(JSON.stringify(oneFrame.ret) === JSON.stringify(['link-ret', 'log-of-7', true, 'other-35']) && G.links === 1,
    `3 the GL wrappers return what the GL returns (${oneFrame.ret.join(', ')}), the link made once`);
  const rl = log.filter(x => x[0] === 'render'), sl = log.filter(x => x[0] === 'shadow');
  verdict(rl.every(x => x[1] === 'scene' && x[2] === 'cam') && sl.every(x => x[1] === 'L' && x[2] === 'scene' && x[3] === 'cam') && renderer.render('a', 'b') === 'render-ret' && renderer.shadowMap.render(1, 2, 3) === 'shadow-ret',
    `  render() and the shadow map's render() pass their arguments and return their values (${rl.length} renders, ${sl.length} shadow passes)`);
  // the GPU: the fake's 5 ms lands on its frame two frames on
  for (let i = 0; i < 12; i++) { G.frame++; oneFrame(1); }
  const withGpu = [];
  for (let f = R.frame - 12; f < R.frame; f++) { const g = R.row(f).gpu; if (g === g) withGpu.push(g); }
  verdict(withGpu.length >= 6 && withGpu.every(g => near(g, 5, 1e-4)) && G.nested === 0, `  the GPU time of the frame: ${withGpu.length} of 12 frames timed so far (read in batches every 4th frame), ${withGpu[0]} ms each, never nested`);
  // another module opens its own TIME_ELAPSED query mid-frame: ours ends first, theirs works, we stay off for 120 frames
  const TE = gl.getExtension('EXT_disjoint_timer_query_webgl2').TIME_ELAPSED_EXT;
  let theirs = 'none';
  G.frame++;
  oneFrame(1, () => { const q = gl.createQuery(); try { gl.beginQuery(TE, q); gl.endQuery(TE); theirs = 'ok'; } catch (e) { theirs = e.message; } });
  const fForeign = R.row(R.frame - 1);
  const beginsAt = G.begins.length;
  for (let i = 0; i < 30; i++) { G.frame++; oneFrame(1); }
  verdict(theirs === 'ok' && G.nested === 0 && (fForeign.flags & FR.F.gpuForeign) && !(fForeign.gpu === fForeign.gpu) && G.begins.length === beginsAt,
    `  another module's timer mid-frame: theirs ${theirs}, ours yielded (frame flagged, no GPU time) and stays off (${G.begins.length - beginsAt} of ours in the next 30 frames)`);
}

// ---- 2. freezes, the hidden gap, the abandoned frame ------------------------------------------------------------------------
{
  const R = FR.make({ now: () => clock.t, frames: 1024, chunk: 256 });
  let ts = 10000;
  const f = (gap, work) => { ts += gap; clock.t = ts; R.begin(ts, { steps: 1 }); clock.t += work || 1; R.end(true, null); };
  f(16.7); f(16.7); f(400); f(16.7);
  const fr = R.row(R.frame - 2);
  const evF = R.events.filter(e => e[1] === 'freeze');
  verdict(near(fr.dt, 400) && (fr.flags & FR.F.freeze) && evF.length === 1 && evF[0][2] === 400 && R.freezes === 1,
    `2 a 400 ms interval is KEPT: dt ${fr.dt}, flagged freeze, an event (${evF.length}), counted (${R.freezes})`);
  const st = R.stats(2000);
  verdict(near(st.max, 400) && st.fps < 10, `  the meter counts it: max ${st.max.toFixed(0)} ms, ${st.fps.toFixed(1)} fps over the window`);
  // hidden in the gap: away, not a freeze
  ts += 5; doc.hidden = true; clock.t = ts; visHandler(); doc.hidden = false;
  f(3000); f(16.7);
  const fa = R.row(R.frame - 2);
  verdict((fa.flags & FR.F.away) && !(fa.flags & FR.F.freeze) && R.freezes === 1, `  a 3 s gap with the page hidden: flagged away (${fa.flags}), not a freeze (still ${R.freezes})`);
  const st2 = R.stats(2000);
  verdict(st2.max < 20, `  ...and the meter leaves it out (max ${st2.max.toFixed(1)} ms)`);
  // a frame the loop abandoned (a throw between begin and end): the next begin closes it
  ts += 16.7; clock.t = ts; R.begin(ts, { steps: 1 }); clock.t += 4; R.lap(S.world);
  const before = R.frame;
  f(16.7);
  verdict(R.frame === before + 2 && near(R.row(before).world, 4) && !R.open, `  a frame abandoned mid-loop is closed by the next begin (its world ${R.row(before).world} ms kept)`);
  // a held frame (the boot's hold: no render) is a row flagged noRender
  ts += 16.7; clock.t = ts; R.begin(ts, { steps: 1 }); R.end(false, null);
  verdict(R.row(R.frame - 1).flags & FR.F.noRender, '  a held frame (the loading screen\'s) is a row flagged noRender');
}

// ---- 4. the ring and the chunks ----------------------------------------------------------------------------------------------
{
  const R = FR.make({ now: () => clock.t, frames: 1024, chunk: 256 });
  const sunk = [];
  R.chunkSink = k => sunk.push(R.chunkRec(k));
  let ts = 0;
  for (let i = 0; i < 3000; i++) { ts += 16; clock.t = ts; R.begin(ts, { steps: 1 }); clock.t += (i % 7); R.lap(S.world); R.end(true, [i, 0, 0]); }
  const ks = sunk.map(c => c.k);
  const okK = ks.length === 11 && ks.every((k, i) => k === i);
  const c5 = sunk[5], NC = FR.COLS.length, cx = FR.COLS.indexOf('x');
  const okRows = c5 && c5.n === 256 && c5.first === 1280 && c5.f[0 * NC + cx] === 1280 && c5.f[255 * NC + cx] === 1535 && c5.t[0] === 1281 * 16;
  verdict(okK && okRows, `4 3000 frames through a 1024 ring: chunks ${ks.join(',')} handed on as they fill, chunk 5 holds frames 1280-1535 (x ${c5 && c5.f[cx]}..${c5 && c5.f[255 * NC + cx]})`);
  const L = JSON.parse(R.logParts().join(''));
  verdict(L.frames.n === 1024 && L.frames.first === 3000 - 1024 && L.frames.x[0] === 1976 && L.frames.x[1023] === 2999 && L.header.format === 'flydiy-flightlog' && L.header.cols.length === NC,
    `  the log's JSON parses: the ring's last ${L.frames.n} frames (x ${L.frames.x[0]}..${L.frames.x[1023]}), the header's ${L.header.cols.length} columns`);
}

// ---- 5. the reader on two scripted sessions ------------------------------------------------------------------------------
function session(script) {
  const R = FR.make({ now: () => clock.t, frames: 65536 });
  const st = { garage: false, running: true, held: false, manual: false, phase: 'DEPART', cam: 'chase', spd: 0, vs: 0, agl: 1.2 };
  R.attach(null, { frame(P) { Object.assign(P, st); } });
  const B = W.BOOT; B.state = 'loading'; B.set = 'rollout';
  let ts = 0;
  const run = (secs, dtMs, set, each) => { Object.assign(st, set || {}); const n = Math.round(secs * 1000 / dtMs); for (let i = 0; i < n; i++) { ts += dtMs; clock.t = ts; R.begin(ts, { steps: 1 }); if (each) each(i); clock.t += 2; R.lap(S.world); R.end(true, [0, 0, 0]); } };
  st.held = true; run(3, 16.7);                              // the roll-out screen, held
  st.held = false; run(1, 16.7);                             // the last frames under the screen
  B.state = 'gone';
  script(run, st, R, () => ts);
  return JSON.parse(R.logParts().join(''));
}
{
  const clean = session(run => {
    run(10, 16.7, { phase: 'DEPART', spd: 0 });           // the stand at 60
    run(10, 18, { phase: 'TAXI', spd: 6 });                // the taxi at 55
    run(5, 16.7, { phase: 'ROLL', spd: 25 });
    run(10, 25, { phase: 'CLIMB', spd: 40, agl: 200, vs: 3 });
    run(5, 30, { phase: 'CRUISE', spd: 50, agl: 400, vs: 0 });
  });
  const A = An.analyze(clean);
  const ph = Object.fromEntries(A.phases.map(p => [p.phase, p]));
  verdict(A.revealT != null && ph.boot && ph.stand && ph.taxi && ph['take-off'] && ph.climb && ph.cruise && near(ph.stand.fpsP50, 1000 / 16.7, 0.1) && near(ph.taxi.fpsP50, 1000 / 18, 0.1),
    `5 a clean session: the phases ${A.phases.map(p => p.phase + ' ' + p.fpsP50.toFixed(0)).join(', ')} fps; the reveal found`);
  verdict(A.targets.every(g => g.ok), '  every ROLLOUT target PASS on it: ' + A.targets.map(g => g.id + ' ' + (g.ok ? 'PASS' : 'FAIL ' + g.got)).join(', '));
  const bad = session((run, st, R, now) => {
    run(10, 16.7, { phase: 'DEPART', spd: 0 });
    run(0.2, 150, { phase: 'DEPART', spd: 0 }, i => { R.event('longtask', clock.t - 140, 145, 'self'); R.event('link', clock.t - 120, 80, 3); });   // a 150 ms freeze (one frame)
    run(3, 16.7, { phase: 'DEPART', spd: 0 });
    run(10, 25, { phase: 'TAXI', spd: 6 });                // the taxi at 40
    run(4, 50, { phase: 'CLIMB', spd: 40, agl: 200, vs: 3 });   // 4 s at 20 fps
    run(3, 16.7, { phase: 'CRUISE', spd: 50, agl: 400, vs: 0 });
    R.event('longtask', now() - 2000, 1200, 'self');
  });
  const B2 = An.analyze(bad), T = Object.fromEntries(B2.targets.map(g => [g.id, g]));
  verdict(!T.frame100.ok && !T.slow3s.ok && T.stand50.ok && !T.taxi50.ok && !T.task1s.ok,
    '  a session with a 150 ms freeze, 4 s at 20 fps climbing, a 40 fps taxi, a 1.2 s task: ' + B2.targets.map(g => g.id + ' ' + (g.ok ? 'PASS' : 'FAIL')).join(', '));
  const w0 = B2.worst[0];
  verdict(w0 && near(w0.dt, 150, 0.01) && w0.phase === 'stand' && w0.events.some(e => e.kind === 'longtask') && w0.events.some(e => e.kind === 'link') && w0.before && w0.before.work > 0,
    `  the worst frame: ${w0 && w0.dt} ms at the stand, with the long task and the link in its interval and the frame before's split`);
  verdict(near(B2.stretches[0].ms, 4000, 60) && B2.stretches[0].phase === 'climb', `  the longest stretch below 30 fps: ${(B2.stretches[0].ms / 1000).toFixed(2)} s in the climb`);
  // under the hand: the phases from the aeroplane itself
  const hand = session(run => {
    run(2, 16.7, { manual: true, phase: 'CLIMB', spd: 0, agl: 1.2, vs: 0 });
    run(2, 16.7, { manual: true, spd: 5 });
    run(2, 16.7, { manual: true, spd: 20 });
    run(2, 16.7, { manual: true, spd: 35, agl: 50, vs: 4 });
    run(2, 16.7, { manual: true, spd: 45, agl: 300, vs: 0.3 });
    run(2, 16.7, { manual: true, spd: 45, agl: 300, vs: -3 });
  });
  const H2 = An.analyze(hand);
  verdict(['stand', 'taxi', 'take-off', 'climb', 'cruise', 'descent'].every(p => H2.phases.some(x => x.phase === p && x.frames > 100)),
    '  under the hand (the autopilot\'s phase ignored): ' + H2.phases.map(p => p.phase + ' ' + p.frames).join(', '));
  // a roll-out screen that gave up early (its hard timeout) and lifted again later: the FIRST reveal counts, and a
  // stall in between is in plain sight
  const two = session((run, st, R) => {
    run(3, 16.7, { phase: 'TAXI', spd: 4 });
    W.BOOT.state = 'landing'; run(0.2, 200, { phase: 'TAXI', spd: 4 });   // (flagged boot again: not scored)
    W.BOOT.state = 'gone'; run(2, 16.7, { phase: 'TAXI', spd: 4 });
  });
  const T2 = An.analyze(two);
  verdict(T2.reveals.length === 2 && T2.revealT === T2.reveals[0] && T2.scopeFrames > 250, `  two reveals (a screen lifted by its timeout, then for good): scored from the first (${T2.reveals.length} reveals, ${T2.scopeFrames} frames scored)`);
  const txt = An.report(B2);
  verdict(/THE ROLLOUT TARGETS/.test(txt) && /ROLLOUT: FAIL/.test(txt) && /THE WORST/.test(txt), '  the report prints (' + txt.split('\n').length + ' lines)');
}

// ---- 6. the cost ----------------------------------------------------------------------------------------------------------
{
  const R = FR.make({ frames: 65536 });
  const rend = fakeRenderer(null, { nolog: true }).renderer;
  R.attach(rend, { frame(P, cg) { P.garage = false; P.running = true; P.held = false; P.manual = false; P.cam = 'chase'; P.phase = 'CLIMB'; P.spd = 40; P.vs = 2; P.agl = 120; } });
  const cg = [1, 2, 3], pc = { steps: 2 };
  let ts = 1000;
  for (let i = 0; i < 30000; i++) { ts += 33.3; hookFrame(R, rend, ts, pc, cg); }   // warm
  // the same sequence without the recorder (its hooks no-ops, the fake renderer's own calls kept): the control
  const Z = { begin() {}, end() {}, lap() {}, push() {}, pop() {} };
  const rend0 = fakeRenderer(null, { nolog: true }).renderer;
  for (let i = 0; i < 30000; i++) hookFrame(Z, rend0, i, pc, cg);
  const M = 100000;
  let t = performance.now();
  for (let i = 0; i < M; i++) hookFrame(Z, rend0, i, pc, cg);
  const ctl = (performance.now() - t) / M;
  t = performance.now();
  for (let i = 0; i < M; i++) { ts += 33.3; hookFrame(R, rend, ts, pc, cg); }
  const rec = (performance.now() - t) / M;
  const own = (rec - ctl) * 1000;
  verdict(own < 20, `6 the recorder's own time: ${own.toFixed(2)} us a frame over ${M} frames of the loop's hook sequence (2 steps, 3 renders, 6 laps; budget 200 us, asserted < 20 us in node); its end() self-timed ${R.self().usMean.toFixed(2)} us`);
  // the allocation, in a child with a young generation big enough that no scavenge interrupts the count
  const { execFileSync } = require('child_process');
  let al = null;
  try { al = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--max-semi-space-size=128', __filename, '--alloc'], { encoding: 'utf8', timeout: 120000 })); } catch (e) { al = { err: String(e.message || e).slice(0, 200) }; }
  verdict(al && !al.err && al.bytes < 4, al && !al.err ? `  its allocation: ${al.bytes.toFixed(2)} bytes a frame over 20 000 frames (the whole hook sequence with its sampled self-timing, a clock that cannot box): the frame's path allocates nothing` : '  the allocation child failed: ' + (al && al.err));
}

// ---- 7. the wiring -----------------------------------------------------------------------------------------------------------
{
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  const app = rd('src/viewer/app.js'), rw = rd('src/viewer/render_world.js'), gfx = rd('src/viewer/gfx_settings.js'), dev = rd('src/viewer/dev_panel.js');
  const { MANIFEST } = require('./build.js');
  const sc = MANIFEST.viewer.scripts;
  verdict(sc.indexOf('flight_recorder.js') >= 0 && sc.indexOf('flight_recorder.js') < sc.indexOf('gfx_settings.js') && sc.indexOf('flight_recorder.js') < sc.indexOf('app.js') && sc.indexOf('flight_recorder.js') < sc.indexOf('render_world.js'),
    `7 the build's MANIFEST loads flight_recorder.js (at ${sc.indexOf('flight_recorder.js')}) before render_world, gfx_settings and app`);
  const L0 = app.indexOf('  function loop(ts) {'), L1 = app.indexOf('\n  }\n', L0), loop = app.slice(L0, L1);
  const iB = loop.indexOf('if (FR) FR.begin(ts, pc);'), iP = loop.indexOf('const pc = PACE.frame(ts);'), iE = loop.indexOf('if (FR) FR.end(true, cg);'), iPE = loop.indexOf('PACE.end(');
  verdict(iP >= 0 && iB > iP && iE > 0 && iE < iPE && /if \(holdRender\) \{ if \(FR\) FR\.end\(false, cg\);/.test(loop),
    '  app.js: begin after the frame clock says the frame is ours, end before PACE.end, end(false) on the boot\'s hold');
  verdict(/if \(FR\) FR\.push\(0\); script\(1 \/ 60\); if \(FR\) FR\.pop\(\);/.test(loop) && /if \(FR\) FR\.push\(1\); sim\.step\(1 \/ 60\); if \(FR\) FR\.pop\(\);/.test(loop) && FR.SLOTS[0] === 'script' && FR.SLOTS[1] === 'solver',
    '  app.js: the pilot\'s script and each solver step pushed (slots 0 and 1 are script and solver)');
  const laps = ['other', 'world', 'scene', 'hud', 'mirror', 'render'].filter(k => loop.indexOf('FR.lap(FR.S.' + k + ')') < 0);
  verdict(!laps.length, '  app.js: the six laps in the loop' + (laps.length ? ' - missing ' + laps.join(', ') : ''));
  verdict(/FRw\.push\(FRw\.S\.prem\)/.test(rw) && /FRw\.push\(FRw\.S\.cover\)/.test(rw) && /FRw\.push\(FRw\.S\.fill\)/.test(rw) && /FRw\.event\('prem'/.test(rw),
    '  render_world.js: the premises step, the cover ring and the fill pushed; a build is an event');
  verdict(/FLIGHT_REC\.mount\(body, H\)/.test(gfx) && /FLIGHT_REC\.event\('gfx'/.test(gfx) && /PC\.freezes/.test(gfx), '  gfx_settings.js: the meter and the log\'s rows mounted, a setting an event, the freezes in the readout');
  verdict(/FLIGHT_REC\.stats\(2000\)/.test(dev) && /function flFpsText\(\)/.test(app) && !/flFps\.n\+\+/.test(app),
    '  the F8 panel and the flyout\'s `frame rate` read rendered frames (no count of hud() calls or rAF callbacks)');
}

console.log('GATE FLIGHTREC: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
