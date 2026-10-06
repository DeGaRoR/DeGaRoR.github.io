#!/usr/bin/env node
// _hwcov_check.js - GATE HWCOV (G1995-G1997, HW-COVERAGE): what the user's GTX 1660 Ti laptop found, held in node.
//
// The laptop (i5-9300H, GTX 1660 Ti, 'retro' by its card's name) loaded the garage in 120-137 s and drew the stand and
// the taxi at 3-4 fps for 15 minutes. Three of the game's own mechanisms failed it; each is held here on its own module,
// in a vm, on a VIRTUAL clock (timers queued and run in due order - the page's own shape, not GATE BOOT's immediate one):
//
//   1  THE WATCHDOG (src/viewer/boot.js): a chain that keeps landing steps past the hard timeout is NOT lifted (the
//      laptop's 120 s lift mid-chain); a chain whose keys land but whose steps stopped moving IS lifted on the hard
//      timeout; 'nothing landed for 30 s' still lifts; a chain that moves for ever is lifted at five times the hard
//      timeout; a step's own count rising (sub / phase) is progress.
//   2  THE STEP-DOWN (src/viewer/gfx_settings.js GFX.hw): the decision table (one rung down from retro to potato, potato to
//      laptop, never below laptop, never over 15 fps, never on too few frames, never twice in one state, never an
//      explicit choice); where it stands down (a rig, localhost, ?gfx=, ?hwstep=0; ?hwstep=1 forces it); what is
//      explicit (a pick in the menu - S.own -, a welcome pick other than its suggestion, a custom mix); and the whole
//      loop on a fake recorder: 4 fps on the ground for 13 s on retro -> potato, the step saved (S.hw, flydiy.hwclass),
//      logged ('hwstep'), the settings screen asked for, S.own untouched; no second step in the same state; a fast frame
//      or an explicit pick never steps; the hold (the self-test's) stops it.
//   3  THE REVEAL (src/viewer/flight_recorder.js): reveal() marks it with no roll-out screen at all (the header's revealAt,
//      a 'reveal' event); a screen's own lift within 2 s of it is the same reveal, not a second; app.js's flRevealStart
//      calls it; tools/analyze_log.js infers one for a log that never marked it.
//
//   node tools/_hwcov_check.js            -> "GATE HWCOV: PASS|FAIL"
//   node tools/_hwcov_check.js --selftest -> each check against a broken twin of its module (must FAIL)
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SELFTEST = process.argv.includes('--selftest');
let fails = 0;
const out = [];
const check = (ok, what) => { out.push((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; return ok; };

// ---- a virtual clock: setTimeout / setInterval queued, run in due order -----------------------------------------------
function clock() {
  const C = { t: 0, q: [], seq: 0 };
  C.setTimeout = (fn, ms) => { C.q.push({ due: C.t + Math.max(0, ms || 0), fn, seq: C.seq++ }); return C.seq; };
  C.setInterval = (fn, ms) => { const it = { every: Math.max(1, ms || 1), fn }; const arm = () => C.q.push({ due: C.t + it.every, fn: () => { arm(); fn(); }, seq: C.seq++ }); arm(); return C.seq; };
  const drain = () => new Promise(r => setImmediate(r));   // the promise callbacks a timer started (the page's microtasks)
  C.run = async untilT => {   // run every timer due before untilT (ms), in order, the microtasks drained after each
    await drain();
    for (let n = 0; n < 1e6; n++) {
      C.q.sort((a, b) => a.due - b.due || a.seq - b.seq);
      const e = C.q[0]; if (!e || e.due > untilT) break;
      C.q.shift(); C.t = Math.max(C.t, e.due); e.fn(); await drain();
    }
    C.t = Math.max(C.t, untilT);
  };
  return C;
}

// =====================================================================================================================
// 1  THE WATCHDOG
// =====================================================================================================================
function bootIn(src) {
  const C = clock();
  const sb = { console: { log() {}, warn() {}, error() {} }, document: { getElementById: () => null },
    setTimeout: C.setTimeout, clearTimeout() {}, performance: { now: () => C.t }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(src, sb, { filename: 'boot.js' });
  return { B: sb.BOOT, C };
}
// a chain of n steps, each resolving after `ms` of virtual time (a promise on the clock)
const timedSteps = (C, n, ms, extra) => Array.from({ length: n }, (_, i) => ({ id: 's' + i, label: 's' + i, w: 1,
  fn: () => new Promise(res => { if (extra) extra(i); C.setTimeout(res, ms); }) }));
async function watchdog(src) {
  const R = {};
  { // A: 30 steps of 6 s (180 s) - every one lands: no lift on the way; the landing waits for its frames
    const { B, C } = bootIn(src);
    B.run(timedSteps(C, 30, 6000), { set: 'garage', require: [] });
    let liftAt = null; for (let t = 0; t <= 180500; t += 500) { await C.run(t); if (B.state === 'gone' && liftAt == null) liftAt = t; }
    const atEnd = B.state;
    for (let i = 0; i < 3; i++) B.frame();   // the landing's quiet frames: the screen lifts on its own
    R.A = { liftAt, atEnd, state: B.state, steps: B.log.filter(e => e.k === 'step').length, ready: B.log.some(e => e.k === 'ready'), fail: (B.log.find(e => e.k === 'fail') || {}).reason || null };
  }
  { // B: one step that never finishes while a key keeps landing every 5 s - the chain stopped: the hard timeout lifts it
    const { B, C } = bootIn(src);
    B.run([{ id: 'stuck', label: 'stuck', w: 1, fn: () => { const tick = () => { B.expect('k'); B.landed('k'); C.setTimeout(tick, 5000); }; tick(); return new Promise(() => {}); } }], { set: 'garage', require: [] });
    let liftAt = null; for (let t = 0; t <= 200000; t += 1000) { await C.run(t); if (B.state === 'gone' && liftAt == null) liftAt = t; }
    R.B = { liftAt, fail: (B.log.find(e => e.k === 'fail') || {}).reason || null };
  }
  { // C: nothing at all for 30 s - 'nothing landed for 30 s', as before
    const { B, C } = bootIn(src);
    B.run([{ id: 'dead', label: 'dead', w: 1, fn: () => new Promise(() => {}) }], { set: 'garage', require: [] });
    let liftAt = null; for (let t = 0; t <= 60000; t += 1000) { await C.run(t); if (B.state === 'gone' && liftAt == null) liftAt = t; }
    R.C = { liftAt, fail: (B.log.find(e => e.k === 'fail') || {}).reason || null };
  }
  { // D: one step whose own count rises for ever (sub) - progress, until five times the hard timeout
    const { B, C } = bootIn(src);
    let f = 0;
    B.run([{ id: 'creep', label: 'creep', w: 1, fn: () => { const tick = () => { f += (1 - f) * 0.01; B.sub(f); C.setTimeout(tick, 4000); }; tick(); return new Promise(() => {}); } }], { set: 'garage', require: [] });
    let liftAt = null; for (let t = 0; t <= 700000; t += 2000) { await C.run(t); if (B.state === 'gone' && liftAt == null) liftAt = t; }
    R.D = { liftAt, fail: (B.log.find(e => e.k === 'fail') || {}).reason || null };
  }
  return R;
}

// =====================================================================================================================
// 2  THE STEP-DOWN
// =====================================================================================================================
function gfxIn(src, o) {
  o = o || {};
  const C = clock(), store = new Map(Object.entries(o.store || {}));
  const events = [], settles = [];
  const sb = { console: { log() {}, warn() {}, error() {} }, setTimeout: C.setTimeout, clearTimeout() {}, setInterval: C.setInterval, clearInterval() {},
    performance: { now: () => C.t },
    location: { search: o.search || '', hostname: o.host == null ? 'degaror.github.io' : o.host, reload() {} },
    navigator: { webdriver: !!o.rig, userAgent: 'Mozilla/5.0 Chrome/154' },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    FLIGHT_REC: { event: (k, ms, d) => events.push({ k, d }) },
    FLYDIY_SETTLE: k => settles.push(k),
    BOOT: { state: 'gone', busy: () => false },
    document: { hidden: false, body: { classList: { contains: c => c === 'mode-ws' && !!o.shed } } },
    __ev: {}, addEventListener(k, f) { (sb.__ev[k] = sb.__ev[k] || []).push(f); } };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(src, sb, { filename: 'gfx_settings.js' });
  return { G: sb.GFX, C, sb, store, events, settles };
}
// a fake recorder: one rendered frame every `ms`, on the ground (agl 1, at rest) - frames appended as the clock runs
function fakeRec(env, ms, agl) {
  const rows = [];
  const R = { F: { away: 16, boot: 64 }, N: 65536, get frame() { return rows.length; }, row: f => rows[f] };
  env.sb.FLIGHT_REC.rec = R;
  let last = env.C.t;
  env.C.setInterval(() => { rows.push({ t: env.C.t, dt: env.C.t - last, gpu: ms * 0.95, work: 30, flags: 2, agl: agl == null ? 1 : agl, spd: 0 }); last = env.C.t; }, ms);
  return R;
}
async function stepdown(src) {
  const R = {};
  const { G } = gfxIn(src);
  const D = G.hw.decide;
  R.table = {
    retro4: D({ preset: 'retro', fps: 4, frames: 32, kind: 'ground', stepped: [] }).to,
    potato6: D({ preset: 'potato', fps: 6, frames: 48, kind: 'shed', stepped: [] }).to,
    laptop3: D({ preset: 'laptop', fps: 3, frames: 24, kind: 'ground', stepped: [] }).to,
    gamer14: D({ preset: 'gamer', fps: 14.9, frames: 100, kind: 'ground', stepped: [] }).to,
    retro16: D({ preset: 'retro', fps: 16, frames: 100, kind: 'ground', stepped: [] }).to,
    fewFrames: D({ preset: 'retro', fps: 1, frames: 8, kind: 'ground', stepped: [] }).to,
    twice: D({ preset: 'potato', fps: 4, frames: 32, kind: 'ground', stepped: ['ground'] }).to,
    otherState: D({ preset: 'potato', fps: 4, frames: 32, kind: 'shed', stepped: ['ground'] }).to,
    explicit: D({ preset: 'retro', fps: 4, frames: 32, kind: 'ground', stepped: [], explicit: 'your pick in the menu' }).to,
    custom: D({ preset: 'custom', fps: 4, frames: 32, kind: 'ground', stepped: [] }).to,
  };
  R.off = {
    pages: gfxIn(src).G.hw.offWhy(), localhost: gfxIn(src, { host: 'localhost' }).G.hw.offWhy(), rig: gfxIn(src, { rig: true }).G.hw.offWhy(),
    gfxq: gfxIn(src, { search: '?gfx=retro' }).G.hw.offWhy(), off0: gfxIn(src, { search: '?hwstep=0' }).G.hw.offWhy(),
    forced: gfxIn(src, { host: 'localhost', rig: true, search: '?hwstep=1' }).G.hw.offWhy(),
  };
  const pref = (p, x) => JSON.stringify(Object.assign({}, G.PRESETS[p], { preset: p, build: p, pv: 8, fps: 30, fpsOwn: false }, x || {}));   // a saved choice as the menu writes it (every row)
  const retro = pref('retro');
  R.explicit = {
    welcomeSuggested: gfxIn(src, { store: { 'flydiy.gfx': retro, 'flydiy.welcome': JSON.stringify({ gpu: 'x', preset: 'retro', suggested: 'retro' }) } }).G.hw.explicit(),
    welcomePicked: gfxIn(src, { store: { 'flydiy.gfx': retro, 'flydiy.welcome': JSON.stringify({ gpu: 'x', preset: 'retro', suggested: 'current' }) } }).G.hw.explicit(),
    own: gfxIn(src, { store: { 'flydiy.gfx': pref('retro', { own: true }) } }).G.hw.explicit(),
  };
  { // the loop: retro, 4 fps on the ground
    const env = gfxIn(src, { store: { 'flydiy.gfx': retro } });
    fakeRec(env, 250);
    await env.C.run(20000);
    const g = env.G.get();
    R.loop = { preset: g.preset, build: g.build, own: g.own, hw: g.hw, hwclass: env.store.get('flydiy.hwclass') || null, saved: JSON.parse(env.store.get('flydiy.gfx') || '{}').preset,
      events: env.events.filter(e => e.k === 'hwstep').length, settles: env.settles.slice(), state: env.G.hw.state() };
    await env.C.run(60000);   // still 4 fps on the ground: once per state
    R.loop.after = env.G.get().preset;
  }
  { // a fast frame never steps
    const env = gfxIn(src, { store: { 'flydiy.gfx': retro } }); fakeRec(env, 33); await env.C.run(30000); R.fast = env.G.get().preset;
  }
  { // an explicit pick never steps
    const env = gfxIn(src, { store: { 'flydiy.gfx': pref('retro', { own: true }) } }); fakeRec(env, 250); await env.C.run(30000); R.ownLoop = env.G.get().preset;
  }
  { // in the air: no state measured
    const env = gfxIn(src, { store: { 'flydiy.gfx': retro } }); fakeRec(env, 250, 300); await env.C.run(30000); R.air = env.G.get().preset;
  }
  { // the self-test's hold
    const env = gfxIn(src, { store: { 'flydiy.gfx': retro } }); env.G.hw.hold(true); fakeRec(env, 250); await env.C.run(30000); R.held = env.G.get().preset;
  }
  { // the shed at 4 fps: idle -> a step; the player's hands on the editor (an input every 2 s) -> no reading, no step
    const idle = gfxIn(src, { shed: true, store: { 'flydiy.gfx': retro } }); fakeRec(idle, 250); await idle.C.run(20000);
    const busy = gfxIn(src, { shed: true, store: { 'flydiy.gfx': retro } }); fakeRec(busy, 250);
    busy.C.setInterval(() => (busy.sb.__ev.input || []).forEach(f => f({})), 2000); await busy.C.run(30000);
    R.shed = { idle: idle.G.get().preset, idleKind: (idle.G.get().hw || {}).kind, editing: busy.G.get().preset };
  }
  { // localhost: no timer at all
    const env = gfxIn(src, { host: 'localhost', store: { 'flydiy.gfx': retro } }); fakeRec(env, 250); await env.C.run(30000); R.local = { preset: env.G.get().preset, ticks: env.G.hw.state().ticks };
  }
  return R;
}

// =====================================================================================================================
// 3  THE REVEAL
// =====================================================================================================================
function revealIn(src) {
  let t = 1000;
  const sb = { console: { log() {}, warn() {}, error() {} }, setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    performance: { now: () => t, timeOrigin: 0 }, location: { search: '' }, navigator: { userAgent: 'x' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(src, sb, { filename: 'flight_recorder.js' });
  const FR = sb.FLIGHT_REC;
  const R = {};
  R.api = typeof FR.reveal === 'function';
  if (R.api) {
    FR.reveal('the flight'); t += 500; FR.reveal('again');
    const ev = (FR.rec.events || []).filter(e => (e.kind || e[1]) === 'reveal' || (Array.isArray(e) && e[1] === 'reveal'));
    const H = FR.header ? FR.header() : {};
    R.events = ev.length; R.revealAt = H.revealAt;
    t += 5000; FR.reveal('a second roll-out'); R.second = (FR.rec.events || []).filter(e => (Array.isArray(e) ? e[1] : e.kind) === 'reveal').length;
  }
  return R;
}

// =====================================================================================================================
async function verdicts(boot, gfx, rec, app, ana) {
  out.length = 0; fails = 0;
  const W = await watchdog(boot);
  out.push('1 THE WATCHDOG: A ' + JSON.stringify(W.A) + ' | B ' + JSON.stringify(W.B) + ' | C ' + JSON.stringify(W.C) + ' | D ' + JSON.stringify(W.D));
  check(W.A.fail === null && W.A.liftAt === null && W.A.steps === 30 && W.A.atEnd === 'landing' && W.A.ready && W.A.state === 'gone', '1A a chain landing a step every 6 s for 180 s is never lifted (all 30 steps ran; it lifts on its own landing frames)');
  check(W.B.fail === 'hard timeout' && W.B.liftAt >= 120000 && W.B.liftAt <= 126000, '1B a step that stopped moving (keys still landing) is lifted on the hard timeout (120 s)');
  check(/nothing landed/.test(W.C.fail || '') && W.C.liftAt >= 30000 && W.C.liftAt <= 34000, "1C nothing at all for 30 s: 'nothing landed for 30 s', as before");
  check(W.D.fail === 'hard timeout' && W.D.liftAt >= 600000 && W.D.liftAt <= 606000, '1D a step whose count rises for ever is progress - lifted only at 5x the hard timeout (600 s)');
  const S = await stepdown(gfx);
  out.push('2 THE STEP-DOWN: ' + JSON.stringify({ table: S.table, off: S.off, explicit: S.explicit }));
  const T = S.table;
  check(T.retro4 === 'potato' && T.potato6 === 'laptop' && T.laptop3 === null && T.gamer14 === 'current', '2a one rung down (retro -> potato, potato -> laptop, gamer -> current), never below laptop');
  check(T.retro16 === null && T.fewFrames === null, '2b never over 15 fps, never on too few frames');
  check(T.twice === null && T.otherState === 'laptop', '2c once per state (the ground again: no; the shed after the ground: yes)');
  check(T.explicit === null && T.custom === null, '2d never an explicit choice, never a custom mix');
  check(S.off.pages === '' && !!S.off.localhost && !!S.off.rig && !!S.off.gfxq && !!S.off.off0 && S.off.forced === '', '2e on on a player\'s page; off on localhost, a rig, ?gfx=, ?hwstep=0; ?hwstep=1 forces it');
  check(S.explicit.welcomeSuggested === '' && !!S.explicit.welcomePicked && !!S.explicit.own, '2f explicit = the menu\'s pick (own) or a welcome pick other than its suggestion; the suggestion taken is not');
  out.push('   loop ' + JSON.stringify(S.loop));
  check(S.loop.preset === 'potato' && S.loop.build === 'potato' && S.loop.saved === 'potato' && S.loop.own === false, '2g the loop: 4 fps on the ground on retro steps to potato, saved, not marked as the player\'s pick');
  check(!!(S.loop.hw && S.loop.hw.from === 'retro' && S.loop.hw.to === 'potato' && S.loop.hw.kind === 'ground' && S.loop.hw.fps < 5) && !!S.loop.hwclass && S.loop.events === 1 && S.loop.settles.indexOf('preset') >= 0,
    '2h ...recorded (S.hw, flydiy.hwclass), logged (one hwstep event), under the settings screen');
  check(S.loop.after === 'potato', '2i ...and not again in the same state (still potato a minute on)');
  check(S.fast === 'retro' && S.ownLoop === 'retro' && S.air === 'retro' && S.held === 'retro', '2j a 30 fps frame, an explicit pick, the air, the self-test\'s hold: never a step');
  check(S.shed.idle === 'potato' && S.shed.idleKind === 'shed' && S.shed.editing === 'retro', '2l the shed at 4 fps steps when idle, never while the player edits (' + JSON.stringify(S.shed) + ')');
  check(S.local.preset === 'retro' && S.local.ticks === 0, '2k localhost: no timer at all (' + JSON.stringify(S.local) + ')');
  const RV = revealIn(rec);
  out.push('3 THE REVEAL: ' + JSON.stringify(RV));
  check(RV.api && RV.events === 1 && RV.revealAt >= 0, '3a reveal() marks it with no screen (one event, the header\'s revealAt); a second within 2 s is the same reveal');
  check(RV.second === 2, '3b a later roll-out is its own reveal');
  check(/function flRevealStart\(\) \{[\s\S]{0,400}FLIGHT_REC\.reveal\(/.test(app), '3c app.js flRevealStart calls FLIGHT_REC.reveal (screen or none)');
  check(/revealInferred/.test(ana), '3d analyze_log.js infers the reveal of a log that never marked one');
  return fails;
}

const files = { boot: SRC('src/viewer/boot.js'), gfx: SRC('src/viewer/gfx_settings.js'), rec: SRC('src/viewer/flight_recorder.js'), app: SRC('src/viewer/app.js'), ana: SRC('tools/analyze_log.js') };
if (SELFTEST) (async () => {
  // each check against a broken twin: the old watchdog, a step-down that never steps / ignores the menu's pick, a recorder without reveal()
  const twins = [
    ['the train-36 watchdog (no progress test)', Object.assign({}, files, { boot: files.boot.replace('&& !compiling && !moving)', '&& !compiling)') })],
    ['a step-down that ignores S.own', Object.assign({}, files, { gfx: files.gfx.replace("if (S.own) return 'your pick in the menu';", '') })],
    ['a step-down floor at 3 fps', Object.assign({}, files, { gfx: files.gfx.replace('FLOOR_FPS: 15', 'FLOOR_FPS: 3') })],
    ['a step-down on localhost', Object.assign({}, files, { gfx: files.gfx.replace("return 'localhost (a rig or a dev server)';", "return '';") })],
    ['a recorder without reveal()', Object.assign({}, files, { rec: files.rec.replace('reveal: how => REC.reveal(how),', '') })],
  ];
  let bad = 0;
  for (const [what, f] of twins) { const n = await verdicts(f.boot, f.gfx, f.rec, f.app, f.ana); console.log((n ? 'caught ' : 'MISSED ') + what + ' (' + n + ' checks failed)'); if (!n) bad++; }
  console.log('GATE HWCOV SELFTEST: ' + (bad ? 'FAIL' : 'PASS'));
  process.exit(bad ? 1 : 0);
})();
else (async () => {
  const n = await verdicts(files.boot, files.gfx, files.rec, files.app, files.ana);
  console.log(out.join(String.fromCharCode(10)));
  console.log('GATE HWCOV: ' + (n ? 'FAIL (' + n + ')' : 'PASS'));
  process.exit(n ? 1 : 0);
})();
