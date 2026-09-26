#!/usr/bin/env node
// analyze_log.js - READS A FLIGHT LOG (G620: src/viewer/flight_recorder.js, the graphics flyout's `save log`)
// and says what the frame did, phase by phase - and scores the ROLLOUT targets.
//
//   node tools/analyze_log.js <flydiy-flightlog-*.json[.gz]> [--gate] [--json out.json] [--worst N] [--all]
//
// Prints:
//   - the session: build, browser, GPU, screen / canvas / DPR, graphics settings, aeroplane, the recorder's cost,
//     the loading screens (each run of the boot's steps with their ms). Times are PAGE time (s since the page began)
//   - per PHASE (boot, shed, stand, taxi, take-off, climb, cruise, descent, approach, landing, paused): frames,
//     seconds, mean fps, the fps percentiles (p50 / p10 / p1 - the frame interval's p50 / p90 / p99 inverted), the
//     worst interval, the seconds slower than 30 fps, and the mean CPU split / GPU / draws
//   - the WORST frames (default 20, after the reveal): the interval, what the frame BEFORE it did (a long
//     interval is the previous frame's work plus whatever ran between the two - the split says which), the
//     time outside the loop, and the events in the interval (long tasks and the scripts that held them, shader
//     links, premises built, settings, GC-ish drops, marks)
//   - seconds slower than 30 fps and the longest such stretch; frames over 100 ms; long tasks over 1 s
//   - THE ROLLOUT TARGETS (PASS / FAIL each): no frame over 100 ms after the reveal; never more than 3 s in a
//     row below 30 fps; the stand and the taxi at a median of 50 fps or better; no task over 1 s.
//     `--gate` exits 1 when any fails (else the tool exits 0 whatever it finds).
//
// DEFINITIONS (they are the scorer's, so they are written down):
//   - a FRAME is a rendered one (the frame cap's skipped refreshes are not frames); its interval `dt` is rAF's
//     own clock since the rendered frame before it, so a freeze is an interval like any other.
//   - an interval that spans the page being HIDDEN (a tab away) is not a frame: dropped from everything.
//   - the REVEAL is the FIRST roll-out screen gone (the `reveal` event; the boot's state 'gone' on the set 'rollout';
//     a screen that gives up on its hard timeout lifts early, and what follows is in plain sight); frames under a
//     loading screen (the boot flag) are the `boot` phase, frames in the shed the `shed` - neither counts for a target.
//   - SLOWER THAN 30 FPS: an interval over 35 ms (1000/30 and 5 % for the display's jitter); a STRETCH is a run
//     of them that may carry up to two quick frames inside it as long as its own mean stays under 30 fps (a
//     33/50 ms alternation is 24 fps, and a stretch). Its length is the sum of its intervals.
//   - the PHASE: the loading screens -> boot; the shed -> shed; the sim paused -> paused; else from the
//     autopilot's phase where it names one (DEPART/TAXI/LINEUP/HOLD/STOP ground; ROLL / LIFTOFF take-off;
//     CLIMB; CRUISE / ENROUTE; APPROACH / INBOUND / FLARE / GOAROUND approach; ROLLOUT landing) and from the
//     aeroplane itself under the hand or an unknown phase (CG under 3 m above the ground = on the ground;
//     < 0.5 m/s stand, >= 15 m/s take-off, else taxi; in the air climb / descent over 1.5 m/s, else cruise).
//     STAND is any ground phase at under 0.5 m/s.
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');

function load(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  return JSON.parse(buf.toString('utf8'));
}

const GROUND_AP = new Set(['DEPART', 'TAXI', 'LINEUP', 'HOLD', 'STOP', 'STOPPED', 'ROLL', 'ROLLOUT']);
const PHASE_ORDER = ['boot', 'shed', 'stand', 'taxi', 'take-off', 'climb', 'cruise', 'descent', 'approach', 'landing', 'paused'];

// the log as frames: an array of plain rows (the columns by name) and the header's tables
function frames(log) {
  const H = log.header || {}, Fr = log.frames || {}, cols = H.cols || Object.keys(Fr).filter(k => Array.isArray(Fr[k]) && k !== 't');
  const n = (Fr.t || []).length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = { i, t: Fr.t[i] };
    for (const c of cols) { const a = Fr[c]; r[c] = a ? (a[i] == null ? NaN : a[i]) : NaN; }
    out[i] = r;
  }
  return out;
}

function analyze(log, opt) {
  opt = opt || {};
  const H = log.header || {}, FL = H.flags || { garage: 1, running: 2, held: 4, manual: 8, away: 16, freeze: 32, boot: 64, gpuForeign: 128, noRender: 256 };
  const SL = H.slots || ['script', 'solver', 'world', 'prem', 'cover', 'fill', 'scene', 'hud', 'mirror', 'render', 'shadow', 'shader', 'other'];
  const phNames = (H.codes && H.codes.phase) || [''], camNames = (H.codes && H.codes.cam) || [''];
  const rows = frames(log);
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], detail: e[3] })).sort((a, b) => a.t - b.t);
  // the reveal: the FIRST roll-out screen gone - from then on the player sees the world (a loading screen that gives up
  // on its hard timeout lifts early and its steps finish in plain sight: a second `reveal` later, and those frames count)
  let revealT = null;
  const reveals = events.filter(e => e.kind === 'reveal').map(e => e.t);
  if (reveals.length) revealT = reveals[0];
  if (revealT == null && H.revealAt != null && H.revealAt >= 0) revealT = H.revealAt;
  const t0 = rows.length ? rows[0].t : 0;
  // the phase of each frame
  for (const r of rows) {
    const fl = r.flags | 0, ph = phNames[r.phase | 0] || '';
    r.away = !!(fl & FL.away) || !(r.dt === r.dt);
    r.cam = camNames[r.cam | 0] || '';
    r.ap = ph;
    let p;
    if ((fl & FL.held) || (fl & FL.boot)) p = 'boot';
    else if (fl & FL.garage) p = 'shed';
    else if (!(fl & FL.running)) p = 'paused';
    else {
      const manual = !!(fl & FL.manual), spd = r.spd === r.spd ? r.spd : 0, agl = r.agl === r.agl ? r.agl : 0, vs = r.vs === r.vs ? r.vs : 0;
      const known = !manual && ph;
      if (known && (ph === 'ROLL' || ph === 'LIFTOFF')) p = 'take-off';
      else if (known && ph === 'ROLLOUT') p = 'landing';
      else if (known && GROUND_AP.has(ph)) p = spd < 0.5 ? 'stand' : 'taxi';
      else if (known && ph === 'CLIMB') p = 'climb';
      else if (known && (ph === 'CRUISE' || ph === 'ENROUTE' || ph === 'TURNBACK')) p = 'cruise';
      else if (known && (ph === 'APPROACH' || ph === 'INBOUND' || ph === 'FLARE' || ph === 'GOAROUND')) p = 'approach';
      else if (agl < 3) p = spd < 0.5 ? 'stand' : spd >= 15 ? 'take-off' : 'taxi';
      else p = vs > 1.5 ? 'climb' : vs < -1.5 ? 'descent' : 'cruise';
    }
    r.ph = p;
    r.after = revealT != null && r.t > revealT;
  }
  const pct = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN;
  // ---- per phase
  const byPhase = {};
  for (const r of rows) {
    if (r.away) continue;
    const P = byPhase[r.ph] || (byPhase[r.ph] = { frames: 0, ms: 0, dts: [], slowMs: 0, split: {}, gpu: 0, gpuN: 0, calls: 0, tris: 0, work: 0 });
    P.frames++; P.ms += r.dt; P.dts.push(r.dt); P.work += r.work || 0;
    if (r.dt > 35) P.slowMs += r.dt;
    for (const s of SL) P.split[s] = (P.split[s] || 0) + (r[s] || 0);
    if (r.gpu === r.gpu) { P.gpu += r.gpu; P.gpuN++; }
    P.calls += r.calls || 0; P.tris += r.tris || 0;
  }
  const phases = [];
  for (const name of PHASE_ORDER.concat(Object.keys(byPhase).filter(k => PHASE_ORDER.indexOf(k) < 0))) {
    const P = byPhase[name]; if (!P) continue;
    const s = P.dts.slice().sort((a, b) => a - b);
    const split = {}; for (const k of SL) split[k] = P.split[k] / P.frames;
    phases.push({ phase: name, frames: P.frames, seconds: P.ms / 1000, meanFps: P.frames * 1000 / P.ms,
      fpsP50: 1000 / pct(s, 0.5), fpsP10: 1000 / pct(s, 0.9), fpsP1: 1000 / pct(s, 0.99), worstMs: s[s.length - 1],
      slowS: P.slowMs / 1000, workMs: P.work / P.frames, split, gpuMs: P.gpuN ? P.gpu / P.gpuN : null, gpuFrames: P.gpuN,
      calls: P.calls / P.frames, ktris: P.tris / P.frames / 1000 });
  }
  // ---- the frames that count for the targets: after the reveal, off the loading screens
  // the frames the targets score: after the reveal, in the world (a loading screen and the shed are not the roll-out's)
  const scope = rows.filter(r => !r.away && r.ph !== 'boot' && r.ph !== 'shed' && (opt.all || (revealT != null && r.after)));
  const scopeName = opt.all ? 'every frame off the loading screens' : revealT != null ? 'after the reveal' : 'NO REVEAL IN THIS LOG (never rolled out) - nothing to score';
  // ---- slower than 30 fps: stretches
  const stretches = [];
  {
    let run = null, pendN = 0, pendMs = 0, prev = null;
    const close = () => { if (run) stretches.push(run); run = null; pendN = 0; pendMs = 0; };
    for (const r of scope) {
      if (prev && r.i !== prev.i + 1) close();   // a gap (the boot, a tab away) ends a stretch
      prev = r;
      if (r.dt > 35) {
        if (run) { run.ms += pendMs + r.dt; run.frames += pendN + 1; run.end = r.t; }
        else run = { start: r.t - r.dt, end: r.t, ms: r.dt, frames: 1, phase: r.ph };
        pendN = 0; pendMs = 0;
      } else if (run) {
        pendN++; pendMs += r.dt;
        if (pendN > 2 || (run.frames + pendN) * 1000 / (run.ms + pendMs) >= 30) close();
      }
    }
    close();
  }
  stretches.sort((a, b) => b.ms - a.ms);
  const slowS = stretches.reduce((a, s) => a + s.ms, 0) / 1000;
  // ---- the worst frames, and what preceded them
  const byI = new Map(rows.map(r => [r.i, r]));
  const evIn = (a, b) => events.filter(e => {
    const end = e.t + (e.ms && (e.kind === 'longtask' || e.kind === 'loaf' || e.kind === 'link' || e.kind === 'linkwait' || e.kind === 'prem') ? e.ms : 0);
    return end >= a && e.t <= b && e.kind !== 'boot';
  });
  const topSplit = r => SL.map(k => [k, r[k] || 0]).filter(x => x[1] >= 0.05).sort((a, b) => b[1] - a[1]);
  const worst = scope.slice().sort((a, b) => b.dt - a.dt).slice(0, opt.worst || 20).map(r => {
    const p = byI.get(r.i - 1) || null;
    return { i: r.i, t: r.t, sinceReveal: revealT != null ? (r.t - revealT) / 1000 : null, dt: r.dt, phase: r.ph, ap: r.ap, cam: r.cam,
      before: p ? { work: p.work, split: topSplit(p), gpu: p.gpu === p.gpu ? p.gpu : null, calls: p.calls, ktris: (p.tris || 0) / 1000, owed: p.owed, taken: p.taken } : null,
      outside: p ? r.dt - (p.work || 0) : null,
      events: evIn(r.t - r.dt, r.t) };
  });
  const over100 = scope.filter(r => r.dt > 100).sort((a, b) => b.dt - a.dt);
  const longTasks = events.filter(e => e.kind === 'longtask' && e.ms > 1000).map(e => {
    const loaf = events.filter(x => x.kind === 'loaf' && x.t <= e.t + e.ms && x.t + x.ms >= e.t);
    return Object.assign({}, e, { afterReveal: revealT != null && e.t > revealT, loaf: loaf.map(x => x.detail) });
  });
  const evCount = {}; for (const e of events) evCount[e.kind] = (evCount[e.kind] || 0) + 1;
  // ---- the loading screens: each run of the boot's steps (the shed's, the roll-out's), from the boot's own log
  const boots = [];
  {
    const BL = (H.boot && H.boot.log) || [];
    let cur = null;
    for (const e of BL) {
      if (e.k === 'run') { cur = { set: e.set, t: e.t, steps: [], goneT: null, shaders: null }; boots.push(cur); }
      else if (cur && e.k === 'step') cur.steps.push({ id: e.id, ms: e.ms == null ? null : e.ms, programs: e.programs });
      else if (cur && e.k === 'shaders') cur.shaders = e.total;
      else if (cur && e.k === 'gone' && cur.goneT == null) cur.goneT = e.t;
    }
    for (const b of boots) b.screenMs = b.goneT != null ? b.goneT - b.t : null;
  }
  // ---- the targets
  const stand = phases.find(p => p.phase === 'stand'), taxi = phases.find(p => p.phase === 'taxi');
  const scoped = ph => { const s = scope.filter(r => r.ph === ph).map(r => r.dt).sort((a, b) => a - b); return s.length ? { frames: s.length, fps: 1000 / pct(s, 0.5) } : null; };
  const st2 = scoped('stand'), tx2 = scoped('taxi');
  const haveScope = scope.length > 0;
  const targets = [
    { id: 'frame100', what: 'no frame over 100 ms after the reveal', ok: haveScope && over100.length === 0,
      got: haveScope ? over100.length + ' over 100 ms' + (over100.length ? ' (worst ' + over100[0].dt.toFixed(0) + ' ms)' : '') : 'no frames to score' },
    { id: 'slow3s', what: 'never more than 3 s in a row below 30 fps', ok: haveScope && !(stretches.length && stretches[0].ms > 3000),
      got: haveScope ? (stretches.length ? 'longest ' + (stretches[0].ms / 1000).toFixed(2) + ' s (' + stretches[0].phase + ')' : 'none') : 'no frames to score' },
    { id: 'stand50', what: 'the stand at a median of 50 fps or better', ok: !!(st2 && st2.fps >= 50),
      got: st2 ? st2.fps.toFixed(1) + ' fps median over ' + st2.frames + ' frames' : 'no stand frames after the reveal' },
    { id: 'taxi50', what: 'the taxi at a median of 50 fps or better', ok: !!(tx2 && tx2.fps >= 50),
      got: tx2 ? tx2.fps.toFixed(1) + ' fps median over ' + tx2.frames + ' frames' : 'no taxi frames after the reveal' },
    { id: 'task1s', what: 'no task over 1 s (the whole log, the loading screens included)', ok: longTasks.length === 0,
      got: longTasks.length + ' over 1 s' + (longTasks.length ? ' (' + longTasks.filter(x => x.afterReveal).length + ' after the reveal; worst ' + Math.max(...longTasks.map(x => x.ms)).toFixed(0) + ' ms)' : '') },
  ];
  return { header: H, t0, revealT, reveals, frames: rows.length, boots, scopeName, scopeFrames: scope.length, phases, worst, stretches: stretches.slice(0, 10), slowS,
    over100: over100.slice(0, 30).map(r => ({ i: r.i, t: r.t, dt: r.dt, phase: r.ph })), over100N: over100.length, longTasks, evCount, targets };
}

// ---- the text ------------------------------------------------------------------------------------------------------
function report(A) {
  const H = A.header, L = [];
  const f1 = x => (x == null || !(x === x) ? '-' : x.toFixed(1)), f0 = x => (x == null || !(x === x) ? '-' : x.toFixed(0));
  const ts = t => (t / 1000).toFixed(1) + ' s';   // page time (performance.now: since the page began to load)
  L.push('FLIGHT LOG ' + (H.sid || '?') + '  started ' + (H.started || '?') + '  saved ' + (H.saved || '?'));
  L.push('  build ' + (H.build || '?') + ' (core ' + (H.core || '?') + ', server ' + (H.server || '?') + ')  world ' + (H.world || '?') + '  ' + (H.url || ''));
  L.push('  browser ' + (H.ua || '?'));
  if (H.gpu) L.push('  GPU ' + (H.gpu.unmaskedRenderer || H.gpu.renderer || '?') + ' (' + (H.gpu.unmaskedVendor || H.gpu.vendor || '?') + ')');
  L.push('  screen ' + (H.screen ? H.screen.w + 'x' + H.screen.h : '?') + '  canvas ' + (H.canvas ? H.canvas.w + 'x' + H.canvas.h : '?') + '  DPR ' + (H.dpr || '?') + '  cores ' + (H.cores || '?') + (H.memGB ? '  ' + H.memGB + ' GB' : ''));
  if (H.gfx) L.push('  graphics ' + Object.keys(H.gfx).map(k => k + '=' + H.gfx[k]).join(' '));
  if (H.pace) L.push('  frame clock ' + H.pace.mode + (H.pace.legacy ? ' (rig clock)' : '') + ', cap ' + H.pace.cap + ', auto went down ' + (H.pace.stats ? H.pace.stats.down : '?') + 'x / up ' + (H.pace.stats ? H.pace.stats.up : '?') + 'x');
  if (H.aircraft) L.push('  aeroplane ' + (H.aircraft.name || H.aircraft.key || '?') + ', ' + (H.aircraft.nodes || '?') + ' nodes, ' + (H.aircraft.massKg || '?') + ' kg');
  if (H.overhead) L.push('  the recorder: ' + (H.overhead.frameUsMean != null ? H.overhead.frameUsMean + ' us a frame, measured live on ' + H.overhead.sampled + ' sampled frames (max ' + H.overhead.frameUsMax + ' us; budget 200)' + (H.overhead.gpuTimerUsMean ? ' + the GPU timer\'s GL calls ' + H.overhead.gpuTimerUsMean + ' us'  : '') : H.overhead.endUsMean + ' us a frame at its end()') + (H.gpuTimer ? '; GPU timer: ' + H.gpuTimer.ok + ' frames timed, ' + H.gpuTimer.disjoint + ' disjoint, another module\'s timer seen ' + H.gpuTimer.foreignFrames + 'x' : '; no GPU timer in this browser'));
  L.push('  ' + A.frames + ' frames' + (A.revealT != null ? ', the reveal at ' + ts(A.revealT) + (A.reveals.length > 1 ? ' (the roll-out screen went ' + A.reveals.length + ' times: ' + A.reveals.map(ts).join(', ') + ')' : '') : ', NO REVEAL (the roll-out screen never went)') + '; events: ' + Object.keys(A.evCount).map(k => k + ' ' + A.evCount[k]).join(', '));
  for (const b of A.boots || []) {
    L.push('  loading screen ' + (b.set || '?') + ': ' + (b.screenMs != null ? (b.screenMs / 1000).toFixed(1) + ' s' : 'never lifted') + (b.shaders ? ', ' + b.shaders + ' shaders' : '') +
      ' - ' + b.steps.map(s => s.id + ' ' + (s.ms != null ? (s.ms >= 1000 ? (s.ms / 1000).toFixed(1) + ' s' : s.ms + ' ms') : '?')).join(', '));
  }
  L.push('');
  L.push('PER PHASE (every frame of the phase, the loading screens their own)');
  L.push('  phase       frames     s   mean  p50  p10   p1 fps   worst ms  <30fps s   cpu ms   gpu ms  draws  ktris   cpu split (ms/frame, top)');
  for (const p of A.phases) {
    const top = Object.keys(p.split).map(k => [k, p.split[k]]).filter(x => x[1] >= 0.05).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0] + ' ' + x[1].toFixed(1)).join(', ');
    L.push('  ' + p.phase.padEnd(10) + String(p.frames).padStart(7) + f0(p.seconds).padStart(6) + f1(p.meanFps).padStart(7) + f0(p.fpsP50).padStart(5) + f0(p.fpsP10).padStart(5) + f0(p.fpsP1).padStart(5) +
      f0(p.worstMs).padStart(11) + f1(p.slowS).padStart(10) + f1(p.workMs).padStart(9) + f1(p.gpuMs).padStart(9) + f0(p.calls).padStart(7) + f0(p.ktris).padStart(7) + '   ' + top);
  }
  L.push('');
  L.push('THE WORST ' + A.worst.length + ' FRAMES (' + A.scopeName + '; an interval is the frame before it plus what ran between them)');
  for (const w of A.worst) {
    L.push('  ' + f0(w.dt).padStart(6) + ' ms at ' + ts(w.t) + (w.sinceReveal != null ? ' (reveal +' + w.sinceReveal.toFixed(1) + ' s)' : '') + '  ' + w.phase + (w.ap ? ' [' + w.ap + ']' : '') + (w.cam ? ' cam ' + w.cam : ''));
    if (w.before) L.push('         the frame before: work ' + f1(w.before.work) + ' ms (' + w.before.split.map(x => x[0] + ' ' + x[1].toFixed(1)).join(', ') + ')' +
      '  gpu ' + f1(w.before.gpu) + '  draws ' + f0(w.before.calls) + '  ' + f0(w.before.ktris) + 'k tris  steps ' + w.before.taken + '/' + w.before.owed + '  outside the loop ' + f1(Math.max(0, w.outside)) + ' ms');
    for (const e of w.events.slice(0, 8)) L.push('         ' + e.kind + (e.ms != null ? ' ' + f1(e.ms) + ' ms' : '') + (e.detail != null ? ': ' + String(e.detail).slice(0, 160) : ''));
    if (w.events.length > 8) L.push('         (+' + (w.events.length - 8) + ' more events)');
  }
  L.push('');
  L.push('SLOWER THAN 30 FPS (' + A.scopeName + '): ' + A.slowS.toFixed(1) + ' s in ' + A.stretches.length + '+ stretches; the longest: ' +
    (A.stretches.length ? A.stretches.slice(0, 5).map(s => (s.ms / 1000).toFixed(2) + ' s at ' + ts(s.start) + ' (' + s.phase + ', ' + s.frames + ' frames)').join('; ') : 'none'));
  L.push('FRAMES OVER 100 MS (' + A.scopeName + '): ' + A.over100N + (A.over100N ? ' - ' + A.over100.slice(0, 12).map(r => f0(r.dt) + ' ms at ' + ts(r.t) + ' ' + r.phase).join('; ') : ''));
  L.push('LONG TASKS OVER 1 S (the whole log): ' + A.longTasks.length);
  for (const e of A.longTasks) L.push('  ' + f0(e.ms) + ' ms at ' + ts(e.t) + (e.afterReveal ? ' (after the reveal)' : ' (before the reveal)') + (e.detail ? ' ' + e.detail : '') + (e.loaf.length ? ' - ' + e.loaf.join(' | ').slice(0, 300) : ''));
  L.push('');
  L.push('THE ROLLOUT TARGETS');
  for (const g of A.targets) L.push('  ' + (g.ok ? 'PASS' : 'FAIL') + '  ' + g.what + ': ' + g.got);
  L.push('ROLLOUT: ' + (A.targets.every(g => g.ok) ? 'PASS' : 'FAIL (' + A.targets.filter(g => !g.ok).map(g => g.id).join(', ') + ')'));
  return L.join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const file = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--json' && argv[argv.indexOf(a) - 1] !== '--worst');
  if (!file) { console.error('usage: node tools/analyze_log.js <flydiy-flightlog.json[.gz]> [--gate] [--json out.json] [--worst N] [--all]'); process.exit(2); }
  const opt = { all: argv.includes('--all') };
  const wi = argv.indexOf('--worst'); if (wi >= 0) opt.worst = +argv[wi + 1];
  const A = analyze(load(file), opt);
  console.log(report(A));
  const ji = argv.indexOf('--json'); if (ji >= 0) fs.writeFileSync(argv[ji + 1], JSON.stringify(A, null, 1));
  if (argv.includes('--gate')) process.exit(A.targets.every(g => g.ok) ? 0 : 1);
}
module.exports = { load, frames, analyze, report };
