#!/usr/bin/env node
// GATE POSEBACK (G1530-G1534, POSE-BACK) - THE DRAWN AEROPLANE NEVER GOES BACKWARD ALONG ITS MOTION, AT ANY FRAME RATE.
//
// The user (4 Oct, a GTX 660 at ~2 fps - frames of 450-600 ms, the frame clock on auto): "Sometimes, the plane went
// backwards. As soon as it took off, it happened that it went a little backward over a frame, strange."
//
// The drawn pose between physics steps is built two ways (HANDOVER G1100-G1101, G1166b, G1365):
//   INLINE  (?simw=0)  app.js PACE (the frame clock: the steps a frame owes, alpha) + POSE_LERP (the pose drawn
//                      between the frame's last two steps at alpha) - both LIFTED OUT OF app.js AS WRITTEN;
//   WORKER  (default)  src/viewer/sim_view.js frame(T) (the ring of the newest snapshots, T less a delay, a starved
//                      frame extrapolated) against src/viewer/sim_host.js's OWN clock (pump / beat / the stall hold),
//                      the host body run in a vm on a FAKE wall clock so a 2 fps page is simulated, not waited for.
// Both fly the REAL solver (tools/flight_core.js, the stock build, the analytic world, the auto pilot from HOME's
// runway) through its TAKE-OFF (~15.6 s): 12 s flown in lockstep first, then the page's frames at a simulated
// 2, 5, 10 and 30 fps (a 60 Hz vsync; the frame's work jittered +-15 %), each under three page profiles:
//   steady  the step block runs 1-3 ms after the frame's rAF timestamp (the loop's top);
//   late    up to 40 % of the frame passes between the rAF timestamp and the step block (a long task first);
//   ragged  one frame in six comes 1-4 vsyncs after the last (an uneven slow page: the user's "sometimes");
//   slowworker  steady frames, and a solver step costs the worker 25 ms: it cannot hold real time and lets the excess
//           go (sim_host.js SIM_HOST_CATCH) - the step cap's dropped time (the worker only).
// Per frame: the drawn CG (the positions the page draws, through the view's / the solver's own CG sums), the
// newest state's, and the solver's own CG at the drawn pose's sim time (every step logged on the host).
// PASS when, on every frame of every run:
//   (a) MONOTONIC   the drawn CG's move along the motion (the newest state's horizontal velocity) is >= -0.5 mm;
//   (b) BOUNDED     the drawn pose is never more than one step AHEAD of the newest state the page holds;
//   (c) TRUE        the drawn CG is within one step's travel of the solver's own CG at the drawn time.
// And the drawn clock (the drawn pose's sim time) never runs backward.
// ALSO:
//   THE INSTRUMENT SEES THE BUG: the worker at 2 fps ragged with the view's old clock (opts.monotonic false, ?poseback=0)
//     must draw backward frames (it did, 1.2 m at the take-off) - else the gate proves nothing;
//   NO CHANGE AT NORMAL FRAME RATES: on even frames at 60 and 30 fps (a 60 Hz vsync) the worker's drawn pose is the SAME
//     BITS with the fix and without it (the clock never held a frame), and the inline pair never held an alpha - so
//     POSE-SMOOTH's judder numbers (G1100-G1101, eye_judder.js) stand as measured;
//   THE INLINE PAIR: one pair drawn at 0.8, then at 0.3 (the clock's accumulator let go: PACE.hold) holds at 0.8; a new
//     pair draws at its own alpha.
//
//   node tools/_poseback_check.js                 -> "GATE POSEBACK: PASS|FAIL"
//   --fps=2,5,10,30   --profiles=steady,late,ragged,slowworker   --paths=worker,inline   --jobs=N (threads, default 3)
//   --view=<file>  --app=<file>    another sim_view.js / app.js (an A/B: the base's files, git show)
//   --trace=<dir>  per-run CSV of every frame (tools/poseback_plot.js draws them)
//   --seed=N
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const FPS = arg('fps', '2,5,10,30').split(',').map(Number);
const PROFILES = arg('profiles', 'steady,late,ragged,slowworker').split(',');
const PATHS = arg('paths', 'worker,inline').split(',');
const VIEW_FILE = path.resolve(arg('view', path.join(ROOT, 'src', 'viewer', 'sim_view.js')));
const APP_FILE = path.resolve(arg('app', path.join(ROOT, 'src', 'viewer', 'app.js')));
const TRACE = arg('trace', null);
const SEED = +arg('seed', 1530);
const JOBS = Math.max(1, +arg('jobs', 3));
const PRE_STEPS = 720, END_T = 19.5;                    // 12 s in lockstep, then the frames until the sim's 19.5 s
const SLOW_STEP_MS = 25;                                 // 'slowworker': a step costs the worker 25 ms - it flies ~2/3 of real time
const VSYNC = 1000 / 60, LAT = 0.3;                      // the display; a message's one-way latency (ms)
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const f2 = x => (x == null || !isFinite(x) ? String(x) : x.toFixed(2));

// ---- the core (fast: the main realm) and the host's body (its own realm, on the fake clock)
const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
const SV = (() => { const m = { exports: {} }; new Function('module', 'window', fs.readFileSync(VIEW_FILE, 'utf8'))(m, undefined); return m.exports; })();
const SPEC = C.genMigrateSpec((j => j.spec || j)(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'build_v9_stock_2026-09-15.json'), 'utf8'))));
const DEF = C.buildGen(SPEC);
const MASS = DEF.nodes.map(nd => nd.m), MTOT = MASS.reduce((a, b) => a + b, 0);
const cgOf = p => { let x = 0, y = 0, z = 0; for (let i = 0; i < MASS.length; i++) { x += p[i * 3] * MASS[i]; y += p[i * 3 + 1] * MASS[i]; z += p[i * 3 + 2] * MASS[i]; } return [x / MTOT, y / MTOT, z / MTOT]; };

// THE FAKE TIMELINE: one clock (ms) for the page and the host; events in time order (ties: in the order queued)
function timeline() {
  const Q = []; let seq = 0;
  const TL = { t: 1e6, at(t, f) { Q.push({ t: Math.max(t, TL.t), s: seq++, f }); },
    run(to) {
      for (;;) {
        let j = -1; for (let i = 0; i < Q.length; i++) if (Q[i].t <= to && (j < 0 || Q[i].t < Q[j].t || (Q[i].t === Q[j].t && Q[i].s < Q[j].s))) j = i;
        if (j < 0) break;
        const e = Q.splice(j, 1)[0]; TL.t = Math.max(TL.t, e.t); e.f();
      }
      TL.t = Math.max(TL.t, to);
    } };
  return TL;
}
// a host: sim_host.js's body in a vm whose performance / setTimeout are the timeline's; the CORE the main realm's,
// its makeSim wrapped to log every step's (t, CG) - the solver's own trajectory, the truth the drawn pose is held to
function makeHost(TL, toPage, stepMs) {
  const ctx = { console, module: { exports: {} } };
  ctx.performance = { timeOrigin: 0, now: () => TL.t };
  let tid = 0; const live = new Set();
  ctx.setTimeout = (f, ms) => { const id = ++tid; live.add(id); TL.at(TL.t + Math.max(1, +ms || 0), () => { if (live.delete(id)) f(); }); return id; };
  ctx.clearTimeout = id => { live.delete(id); };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'sim_host.js'), 'utf8'), ctx, { filename: 'sim_host.js' });
  const SH = ctx.module.exports;
  const log = [];                                       // [t, cgx, cgy, cgz] after every step
  const CORE = {}; for (const k of SH.SIM_HOST_CORE) CORE[k] = C[k];
  CORE.makeSim = (def, world) => {
    const sim = C.makeSim(def, world), step = sim.step.bind(sim);
    // (stepMs: the worker's own cost a step on the fake clock - a CPU-starved worker that cannot hold real time)
    sim.step = dt => { const r = step(dt); const c = sim.cgPos(); log.push([sim.t, c[0], c[1], c[2]]); if (stepMs) TL.t += stepMs; return r; };
    return sim;
  };
  let on = null;
  SH.simHostBody(CORE, SH, { post: m => toPage(m), on: f => { on = f; }, close() {} });
  return { send: m => on(m), log, stepMs: x => { stepMs = x; } };
}
// the solver's CG at sim time t (between the two logged steps that hold it)
function truthAt(log, t) {
  let lo = 0, hi = log.length - 1;
  if (t <= log[0][0]) return log[0].slice(1);
  if (t >= log[hi][0]) return log[hi].slice(1);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (log[m][0] <= t) lo = m; else hi = m; }
  const a = log[lo], b = log[hi], u = (t - a[0]) / (b[0] - a[0]);
  return [1, 2, 3].map(j => a[j] + (b[j] - a[j]) * u);
}
// app.js's blocks, as written (GATE PACE's way): PACE (the frame clock) and POSE_LERP (the drawn pair)
function liftApp(TL) {
  const src = fs.readFileSync(APP_FILE, 'utf8');
  const E1 = '    W.FLYDIY_PACE = api;\n    return api;\n  })();', E2 = '    window.FLYDIY_POSE = api;\n    return api;\n  })();';
  const a = src.indexOf('  const PACE = (() => {'), b = src.indexOf(E1, a), c = src.indexOf('  const POSE_LERP = (() => {'), d = src.indexOf(E2, c);
  if (!(a > 0 && b > a && c > 0 && d > c)) throw new Error('the PACE / POSE_LERP blocks not found in ' + APP_FILE);
  const block = src.slice(a, b + E1.length) + '\n' + src.slice(c, d + E2.length);
  const window = { document: { hidden: false, addEventListener() {} }, navigator: { userAgent: 'Chrome' }, location: { search: '' },
                   localStorage: { getItem: k => (k === 'flydiy.gfx' ? JSON.stringify({ pv: 7, fps: 'auto', fpsOwn: true }) : null) } };
  return new Function('window', 'performance', block + '\nreturn { PACE, POSE_LERP };')(window, { now: () => TL.t });
}
// a seeded uniform
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// the page's frames: the work of each (ms) and where its step block sits after its rAF timestamp
function pageFrames(fps, profile, R) {
  const I = 1000 / fps;
  if (profile === 'even') return () => ({ W: I - 1, x: 1 });   // even frames (each reaches the next vsync the cap allows)
  return () => {
    let W = I * (0.85 + 0.3 * R());
    if (profile === 'ragged' && R() < 1 / 6) W = VSYNC * (1 + Math.floor(R() * 4));
    const x = profile === 'late' ? R() * 0.4 * W : 1 + 2 * R();
    return { W: Math.max(1, W), x: Math.min(x, Math.max(0, W - 0.5)) };
  };
}
const nextVsync = t => Math.ceil((t - 1e6) / VSYNC - 1e-9) * VSYNC + 1e6;

// ---- ONE RUN: a path, a frame rate, a profile -> the frames' rows
// (mono: the view's G1530 clock - false is the old mapping, ?poseback=0)
function run(pathK, fps, profile, mono) {
  const PROF = ['steady', 'late', 'ragged', 'slowworker'];
  const TL = timeline(), R = rng(SEED + fps * 101 + PROF.indexOf(profile) * 7 + (pathK === 'inline' ? 1000 : 0));
  const inbox = [];                                      // host -> page: [arrival, msg]
  const H = makeHost(TL, m => inbox.push([TL.t + LAT, m]), 0);
  const toHost = m => TL.at(TL.t + LAT, () => H.send(m));
  H.send({ cmd: 'init', world: {}, spec: SPEC, place: { from: 'HOME', to: 'CIRCUIT', stand: false }, pilot: { kind: 'auto' }, withV: true });
  const ready = inbox.find(e => e[1].kind === 'ready')[1], S = ready.slots;
  H.send({ cmd: 'batch', list: [{ cmd: 'start', k: 0 }] });
  H.send({ cmd: 'steps', n: PRE_STEPS });
  inbox.length = 0;
  H.stepMs(profile === 'slowworker' ? SLOW_STEP_MS : 0);
  const { PACE, POSE_LERP } = liftApp(TL);
  const frameOf = pageFrames(fps, profile, R);
  const rows = [];
  let T = nextVsync(TL.t + 1), lastSnap = null;
  let view = null;
  if (pathK === 'worker') {
    view = SV.makeSimView(DEF, { ready, post: (m) => { toHost(m); return true; }, now: () => TL.t, monotonic: mono !== false });
    const take = to => { while (inbox.length && inbox[0][0] <= to) { const m = inbox.shift()[1]; if (m.kind === 'snap') { view.take(m); lastSnap = view.snapshot(); } } };
    toHost({ cmd: 'run' });
    let guard = 0;
    while (guard++ < 20000) {
      TL.run(T);
      take(T);                                           // the messages the page took before this rAF
      const pc = PACE.frame(T);
      if (!pc) { T = nextVsync(T + 1); continue; }
      const fr = frameOf();
      TL.run(T + fr.x);                                  // the host runs on while the frame reaches its step block
      const r = view.frame(T);                           // sim_link.js mirror: T = timeOrigin (0 here) + the rAF timestamp
      const f = view.snapshot();
      if (r && f) {
        const cg = view.cgPos();
        rows.push({ T, x: fr.x, tD: r.t, tN: f[S.T], step: f[S.STEP], cg, cgN: [f[S.CG], f[S.CG + 1], f[S.CG + 2]],
                    v: [f[S.CGV], f[S.CGV + 1], f[S.CGV + 2]], wheels: f[S.WHEELS], alpha: r.alpha });
        if (f[S.T] >= END_T) break;
      }
      PACE.end(fr.W, 1, pc.steps, T + fr.W, 0);
      T = nextVsync(T + fr.W);
    }
  } else {
    // INLINE: the loop's step block (app.js: script + sim.step nStep times, POSE_LERP.mark before the last, took after)
    // on a lockstep host (the same solver, stepped exactly as the frame owes), the draw at PACE.alpha
    const sim = { p: new Float64Array(DEF.nodes.length * 3) };
    const stepN = n => { if (n > 0) H.send({ cmd: 'steps', n }); const m = inbox.filter(e => e[1].kind === 'snap').pop(); inbox.length = 0; if (m) lastSnap = new Float64Array(m[1].buf); return lastSnap; };
    stepN(0); H.send({ cmd: 'snap' }); stepN(0);
    sim.p.set(lastSnap.subarray(S.HEAD, S.HEAD + sim.p.length));
    let guard = 0;
    while (guard++ < 20000) {
      TL.run(T);
      POSE_LERP.back();
      const pc = PACE.frame(T);
      if (!pc) { T = nextVsync(T + 1); continue; }
      const fr = frameOf();
      const n = pc.steps;
      if (n > 1) { stepN(n - 1); sim.p.set(lastSnap.subarray(S.HEAD, S.HEAD + sim.p.length)); }
      if (n > 0) { POSE_LERP.mark(sim); stepN(1); sim.p.set(lastSnap.subarray(S.HEAD, S.HEAD + sim.p.length)); POSE_LERP.took(sim); }
      const f = lastSnap;
      const drawn = POSE_LERP.draw(sim, PACE.alpha);
      const cg = cgOf(sim.p);
      const tD = f[S.T] - (drawn ? (1 - POSE_LERP.alpha) / 60 : 0);
      rows.push({ T, x: fr.x, tD, tN: f[S.T], step: f[S.STEP], cg, cgN: cgOf(f.subarray(S.HEAD, S.HEAD + sim.p.length)),
                  v: [f[S.CGV], f[S.CGV + 1], f[S.CGV + 2]], wheels: f[S.WHEELS], alpha: drawn ? POSE_LERP.alpha : 1 });
      POSE_LERP.back();
      PACE.end(fr.W, 1, n, T + fr.W, n);
      if (f[S.T] >= END_T) break;
      T = nextVsync(T + fr.W);
    }
  }
  // the verdicts' readings, frame by frame (the first second of frames skipped: the ring filling, the first pair)
  const out = { rows, back: [], worstBack: 0, worstAhead: -Infinity, worstTrue: 0, clockBack: 0, takeoff: null, frames: 0,
                monoHeld: view ? view.delay().monoHeld : null, lerpHeld: pathK === 'inline' ? POSE_LERP.state().held : null,
                starved: view ? view.delay().starved : null };
  const t0 = rows.length ? rows[0].T + 1000 : 0;
  for (let k = 1; k < rows.length; k++) {
    const a = rows[k - 1], b = rows[k];
    const vh = Math.hypot(b.v[0], b.v[2]); const u = vh > 0.5 ? [b.v[0] / vh, 0, b.v[2] / vh] : null;
    b.ds = u ? (b.cg[0] - a.cg[0]) * u[0] + (b.cg[2] - a.cg[2]) * u[2] : 0;
    const vStep = Math.hypot(b.v[0], b.v[1], b.v[2]) / 60;                   // a step's travel (m)
    b.ahead = u ? (b.cg[0] - b.cgN[0]) * u[0] + (b.cg[2] - b.cgN[2]) * u[2] : 0;   // + = the drawn pose ahead of the newest
    const tr = truthAt(H.log, b.tD);
    b.err = Math.hypot(b.cg[0] - tr[0], b.cg[1] - tr[1], b.cg[2] - tr[2]);
    b.vStep = vStep;
    if (out.takeoff == null && a.wheels > 0 && b.wheels === 0) out.takeoff = b.tN;
    if (b.T < t0) continue;
    out.frames++;
    if (b.ds < -0.0005) out.back.push(k);
    if (b.ds < out.worstBack) out.worstBack = b.ds;
    if (b.ahead - vStep > out.worstAhead) out.worstAhead = b.ahead - vStep;
    if (b.tD <= H.log[H.log.length - 1][0] && b.err / Math.max(vStep, 1e-3) > out.worstTrue) out.worstTrue = b.err / Math.max(vStep, 1e-3);
    if (b.tD < a.tD - 1e-9) out.clockBack++;
  }
  return out;
}

// THE INLINE PAIR, unit (POSE_LERP lifted): one pair at 0.8 then 0.3 holds 0.8; a new pair takes its own alpha
function pairCheck() {
  const TL = timeline(), { POSE_LERP: L } = liftApp(TL);
  const sim = { p: new Float64Array([0, 0, 0, 1, 0, 0]) };
  L.mark(sim); sim.p.set([1, 0, 0, 2, 0, 0]); L.took(sim);
  L.draw(sim, 0.8); const a = sim.p[0]; L.back();
  L.draw(sim, 0.3); const b = sim.p[0], held = L.state().held; L.back();
  L.mark(sim); sim.p.set([2, 0, 0, 3, 0, 0]); L.took(sim);
  L.draw(sim, 0.3); const c = sim.p[0]; L.back();
  return { a, b, c, held };
}
// THE VIEW, unit (sim_view.js on hand-made snapshots: every node moving +x at 10 m/s): a starved frame drawn a step past
// the newest; a PAUSE's snapshot (the same state, not running); then the host re-anchored (fresh DUEs) and a frame soon
// after. The drawn x at each -> the old clock steps back at the pause and after the re-anchor, the G1530 one never.
function viewCheck(mono, pause) {
  const S = SV_SNAP, n = DEF.nodes.length, len = S.HEAD + 3 * n, dt = 1 / 60;
  const view = SV.makeSimView(DEF, { ready: { n, slots: S, dt, withV: false, fuelIdx: [] }, post: () => true, monotonic: mono });
  const snap = (k, due, run) => { const f = new Float64Array(len); f[S.STEP] = k; f[S.T] = k * dt; f[S.DUE] = due; f[S.WALL] = due; f[S.RATE] = 1; f[S.EPOCH] = 1;
    f[S.FLAGS] = run ? S.F_RUNNING : 0; f[S.TOTALM] = MTOT; for (let i = 0; i < n; i++) f[S.HEAD + 3 * i] = 10 * k * dt; view.take({ kind: 'snap', buf: f.buffer, meta: {} }); };
  const xs = [], at = T => { view.frame(T); xs.push(view.p[0]); };
  const D = 1e6, ms = 1000 / 60;
  for (let k = 0; k <= 4; k++) snap(k, D + k * ms, true);
  at(D + 4 * ms + 10);                                   // in the ring
  at(D + 4 * ms + 300);                                  // starved: the newest + a step (the host held: the page slow)
  if (pause) { snap(4, D + 4 * ms, false); at(D + 4 * ms + 320); }   // a pause: the same state, not running
  snap(4, D + 2000, true); snap(5, D + 2000 + ms, true); snap(6, D + 2000 + 2 * ms, true);   // re-anchored at D + 2 s
  at(D + 2000 + 2 * ms + 1);                             // a frame soon after the re-anchor
  at(D + 2000 + 3 * ms + 1);
  return xs;
}
const SV_SNAP = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js')).SIM_SNAP;
function fnvRows(rows) {
  const f = new Float64Array(rows.length * 3); rows.forEach((r, i) => { f[i * 3] = r.cg[0]; f[i * 3 + 1] = r.cg[1]; f[i * 3 + 2] = r.cg[2]; });
  const u = new Uint8Array(f.buffer); let h = 2166136261;
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0;
  return h.toString(16) + ':' + rows.length;
}
// one job on a thread: its verdict numbers (and its rows, for a trace)
if (!isMainThread) {
  const J = workerData;
  const r = run(J.path, J.fps, J.profile, J.mono);
  const keep = r.back.map(k => ({ tN: r.rows[k].tN, ds: r.rows[k].ds }));
  parentPort.postMessage({ J, frames: r.frames, takeoff: r.takeoff, back: keep, worstBack: r.worstBack, worstAhead: r.worstAhead, worstTrue: r.worstTrue,
                           clockBack: r.clockBack, monoHeld: r.monoHeld, lerpHeld: r.lerpHeld, starved: r.starved, hash: fnvRows(r.rows),
                           rows: J.trace ? r.rows.map(b => [b.T - 1e6, b.x, b.tD, b.tN, b.step, ...b.cg, ...b.cgN, ...b.v, b.wheels, b.alpha,
                             (b.ds || 0) * 1000, (b.ahead || 0) * 1000, (b.err || 0) * 1000, (b.vStep || 0) * 1000]) : null });
  return;
}
function pool(jobs) {
  return new Promise(res => {
    const out = new Array(jobs.length); let next = 0, done = 0;
    const go = () => {
      if (next >= jobs.length) return;
      const i = next++;
      const w = new Worker(__filename, { workerData: jobs[i], argv: process.argv.slice(2) });
      w.on('message', m => { out[i] = m; });
      w.on('error', e => { out[i] = { J: jobs[i], error: String(e && e.stack || e) }; });
      w.on('exit', () => { if (!out[i]) out[i] = { J: jobs[i], error: 'the thread exited with no result' }; if (++done === jobs.length) res(out); else go(); });
    };
    for (let k = 0; k < Math.min(JOBS, jobs.length); k++) go();
  });
}

(async () => {
  const custom = VIEW_FILE !== path.join(ROOT, 'src', 'viewer', 'sim_view.js') || APP_FILE !== path.join(ROOT, 'src', 'viewer', 'app.js');
  console.log('GATE POSEBACK: the drawn pose through a take-off at ' + FPS.join(' / ') + ' fps (' + PROFILES.join(', ') + '), ' + PATHS.join(' + ') +
              (custom ? ' [view ' + VIEW_FILE + ', app ' + APP_FILE + ']' : ''));
  if (TRACE) fs.mkdirSync(TRACE, { recursive: true });
  const t0 = Date.now();
  const jobs = [];
  for (const p of PATHS) for (const fps of FPS) for (const profile of PROFILES) {
    if (p === 'inline' && profile === 'slowworker') continue;   // (no worker: the inline loop's own steady frames, run above)
    jobs.push({ path: p, fps, profile, mono: true, grid: true, trace: !!TRACE });
  }
  const extra = !custom && PATHS.includes('worker') && PATHS.includes('inline');
  if (extra) {
    jobs.push({ path: 'worker', fps: 2, profile: 'ragged', mono: false, ab: true, trace: !!TRACE });     // the instrument
    for (const fps of [60, 30]) {                                                                      // normal frame rates
      jobs.push({ path: 'worker', fps, profile: 'even', mono: true, norm: true });
      jobs.push({ path: 'worker', fps, profile: 'even', mono: false, norm: true });
      jobs.push({ path: 'inline', fps, profile: 'even', mono: true, norm: true });
    }
  }
  const res = await pool(jobs);
  for (const r of res) {
    if (r.error) { ok(false, r.J.path + ' ' + r.J.fps + ' fps ' + r.J.profile + ': ' + r.error.split('\n').slice(0, 3).join(' | ')); continue; }
    if (!r.J.grid) continue;
    const tag = r.J.path + ' ' + r.J.fps + ' fps ' + r.J.profile;
    console.log('  ' + tag + ': ' + r.frames + ' frames, take-off at ' + f2(r.takeoff) + ' s; backward frames ' + r.back.length +
                (r.back.length ? ' (worst ' + f2(-r.worstBack * 1000) + ' mm, at ' + r.back.slice(0, 4).map(b => f2(b.tN) + ' s').join(', ') + ')' : '') +
                '; past a step ahead ' + f2(Math.max(0, r.worstAhead) * 1000) + ' mm; off the solver ' + f2(r.worstTrue) + ' steps' +
                (r.monoHeld != null ? '; starved ' + r.starved + ', clock held ' + r.monoHeld : '') + (r.lerpHeld != null ? '; pair held ' + r.lerpHeld : ''));
    ok(r.back.length === 0 && r.clockBack === 0, tag + ': the drawn CG never moves backward along the motion (>= -0.5 mm), the drawn clock never back');
    ok(r.worstAhead <= 0.001, tag + ': never more than one step ahead of the newest state');
    ok(r.worstTrue <= 1.0, tag + ': within one step\'s travel of the solver\'s own CG at the drawn time');
    ok(r.takeoff != null && r.frames > 5, tag + ': the run flies through the take-off');
    if (TRACE && r.rows) {
      const lines = ['T_ms,x_ms,t_drawn,t_newest,step,cgx,cgy,cgz,newx,newy,newz,vx,vy,vz,wheels,alpha,ds_mm,ahead_mm,err_mm,vstep_mm'];
      for (const b of r.rows) lines.push(b.map(v => (typeof v === 'number' ? +v.toFixed(6) : v)).join(','));
      fs.writeFileSync(path.join(TRACE, r.J.path + '_' + r.J.fps + 'fps_' + r.J.profile + '.csv'), lines.join('\n') + '\n');
    }
  }
  if (extra) {
    const ab = res.find(r => r.J.ab);
    if (ab && !ab.error) {
      console.log('  THE OLD CLOCK (?poseback=0), worker 2 fps ragged: backward frames ' + ab.back.length + ', worst ' + f2(-ab.worstBack * 1000) + ' mm' +
                  (ab.back.length ? ' (at ' + ab.back.slice(0, 5).map(b => f2(b.tN) + ' s ' + f2(-b.ds * 1000) + ' mm').join(', ') + ')' : ''));
      ok(ab.back.length > 0 && ab.worstBack < -0.1, 'the instrument sees the bug: the old clock draws the aeroplane backward at 2 fps (worst ' + f2(-ab.worstBack * 1000) + ' mm)');
      if (TRACE && ab.rows) {
        const lines = ['T_ms,x_ms,t_drawn,t_newest,step,cgx,cgy,cgz,newx,newy,newz,vx,vy,vz,wheels,alpha,ds_mm,ahead_mm,err_mm,vstep_mm'];
        for (const b of ab.rows) lines.push(b.map(v => (typeof v === 'number' ? +v.toFixed(6) : v)).join(','));
        fs.writeFileSync(path.join(TRACE, 'worker_2fps_ragged_OLDCLOCK.csv'), lines.join('\n') + '\n');
      }
    }
    for (const fps of [60, 30]) {
      const on = res.find(r => r.J.norm && r.J.path === 'worker' && r.J.fps === fps && r.J.mono), off = res.find(r => r.J.norm && r.J.path === 'worker' && r.J.fps === fps && !r.J.mono);
      const il = res.find(r => r.J.norm && r.J.path === 'inline' && r.J.fps === fps);
      if (!on || !off || !il || on.error || off.error || il.error) continue;
      ok(on.hash === off.hash && on.monoHeld === 0 && on.back.length === 0,
         'even ' + fps + ' fps, worker: the drawn pose the SAME BITS with the G1530 clock and without (' + on.hash + ' / ' + off.hash + '), clock held ' + on.monoHeld + ' frames, none backward');
      ok(il.lerpHeld === 0 && il.back.length === 0, 'even ' + fps + ' fps, inline: the pair never held an alpha (' + il.lerpHeld + '), none backward - POSE-SMOOTH\'s draws as they were');
    }
  }
  if (!custom) {
    const backs = a => a.slice(1).filter((x, i) => x < a[i] - 1e-9).length, r = a => a.map(x => (x * 1000).toFixed(0)).join(' ');
    for (const pause of [false, true]) {
      const xn = viewCheck(true, pause), xo = viewCheck(false, pause);
      ok(backs(xn) === 0 && backs(xo) === 1,
         'the view on hand-made snapshots (drawn x mm: in the ring, starved' + (pause ? ', a PAUSE' : '') + ', two frames after the host re-anchored): G1530 ' + r(xn) + ' - never back; the old clock ' + r(xo) + ' - back');
    }
  }
  const pc = pairCheck();
  ok(pc.a === 0.8 && pc.b === 0.8 && pc.held === 1 && pc.c === 1.3,
     'the inline pair: drawn at 0.8, then asked 0.3 on the same pair -> ' + pc.b + ' (held ' + pc.held + '); a new pair at 0.3 -> ' + pc.c);
  console.log('  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s, ' + jobs.length + ' runs on ' + Math.min(JOBS, jobs.length) + ' threads)');
  console.log('GATE POSEBACK: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
