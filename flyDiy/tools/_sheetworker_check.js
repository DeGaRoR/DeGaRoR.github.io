#!/usr/bin/env node
// GATE SHEETWORKER - THE PERFORMANCE SHEET ON ITS OWN THREAD (G2920-G2924, GARAGE-SHEET).
//
//   node tools/_sheetworker_check.js              -> "GATE SHEETWORKER: PASS|FAIL"   (node, ~1-2 min)
//   node tools/_sheetworker_check.js --selftest   -> negative verification
//   node tools/_sheetworker_check.js --only link,page   -> those sections alone (no core: milliseconds)
//   node tools/_sheetworker_check.js --browser --udd <dir>   -> THE SAME ROW IN CHROME (the box: a real page's main
//                                                    thread against the real Blob worker; a GPU window, not the battery)
//
// The finding (11 Oct, the Deform coordinator's garage_lag --prof): every change that put a new aeroplane on the stand
// ran genShakedown on the page's thread (the room's posts read it, then G1302's post-idle readouts) - the metal Cessna
// ~1.0-1.2 s, the Cub ~0.6 s of the busy time a change. It now runs in bench_worker.js's Blob worker ('sheet'), asked
// through sheet_link.js. Three promises, three sections:
//
//   1 THE THREAD   bench_worker.js's Blob source (benchWorkerSource, with the build and core hashes as the page asks)
//                  run in a REAL thread (worker_threads: the structured clone the browser uses), importScripts reading
//                  the files it names: for the validated five (the Cub, the Jodel, the C172, the C172 on floats, the
//                  twin on floats) + the metal Cessna + two synthetic builds, the sheet that comes back is the
//                  main thread's genShakedown(buildGen(spec), { corners: false }) TO THE BIT (every number by
//                  Object.is - NaN, -0 - every typed array by element, every shared object where it was), the def
//                  signature equal to the main thread's, and the design strip's ledger sheet too.
//   2 THE LINK     sheet_link.js on a fake clock and a fake thread: a drag of ten ticks under a held hand runs ONE
//                  sheet, for the aeroplane it ends on; a newer aeroplane while one computes TERMINATES that thread
//                  and the late answer is dropped; the same aeroplane asked again is not asked twice; a cancel stops
//                  it; no Worker / a thread that dies / two errors -> the link is dead, every waiting job's `fail` is
//                  called (the page computes, as before) and `request` says false; a hand that never lifts does not
//                  starve the readouts (holdMaxMs).
//   3 THE PAGE     app.js asks the thread and never runs the sheet in a rebuild while it is up (the posts keep their
//                  last answer dimmed, the plaque its numbers marked UPDATING), believes an answer only on its key and
//                  the def's signature, keeps it as its own run (shakeKeep), and keeps the old post-idle page path
//                  for no thread (the node page: its Worker shim refuses this Blob - the gates' path unchanged) and
//                  `?sheetw=0`; the editor says when a hand is on a slider; the strip asks its own lane; the build
//                  lists sheet_link.js and the built pages carry it.
//
// NEGATIVE-VERIFIED (--selftest): a sheet one last bit off, a link that posts every tick, a link that never aborts,
// a page that runs the sheet in buildIndicators - each must be caught.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { Worker } = require('worker_threads');
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SELF = process.argv.includes('--selftest');
const BROWSER = process.argv.includes('--browser');
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };

// ---- the builds -----------------------------------------------------------------------------------------------------
const BUILDS = {
  cub: { file: 'builds/cub_2026-09-20_corrected.json' },
  jodel: { file: 'builds/jodel_2026-09-20_corrected.json' },
  c172: { file: 'builds/cessna172_2026-09-20_corrected.json' },
  floats: { file: 'bugReports/cessnaFloatsWOrks.json' },
  twinf: { file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
           patch: j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; } },
  metal: { file: 'bugReports/cessnaMetal (1).json' },
  // two synthetic builds: moved off the validated ones the way a builder does (a longer, narrower wing and a heavier
  // engine on the Cub; a longer cabin, a bigger tail and a wider track on the C172)
  synthA: { file: 'builds/cub_2026-09-20_corrected.json',
            patch: j => { const s = j.spec || j; s.wings[0].span = +(s.wings[0].span * 1.137).toFixed(4); s.wings[0].chord = +(s.wings[0].chord * 0.913).toFixed(4);
                          if (s.engines && s.engines[0] && s.engines[0].power) s.engines[0].power *= 1.21; if (s.cage && s.cage.paxLen) s.cage.paxLen *= 1.07; return j; } },
  synthB: { file: 'builds/cessna172_2026-09-20_corrected.json',
            patch: j => { const s = j.spec || j; if (s.cage) { if (s.cage.paxLen) s.cage.paxLen *= 1.11; if (s.cage.halfW) s.cage.halfW *= 0.94; if (s.cage.stSpan) s.cage.stSpan *= 1.15; }
                          if (s.tail && s.tail.span) s.tail.span *= 1.15; if (s.gear && s.gear.track) s.gear.track *= 1.08; return j; } },
};
function specOf(k) {
  let j = JSON.parse(rd(BUILDS[k].file));
  if (BUILDS[k].patch) j = BUILDS[k].patch(j);
  return j.spec || j;
}

// ---- the comparison: to the bit, shared objects where they were -----------------------------------------------------
// returns null when equal, else the first path that differs
function diff(a, b, p, seenA, seenB) {
  p = p || '$'; seenA = seenA || new Map(); seenB = seenB || new Map();
  if (typeof a === 'number' || typeof b === 'number') return (typeof a === typeof b && Object.is(a, b)) ? null : p + ': ' + a + ' vs ' + b;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (typeof a === 'function' || typeof b === 'function') return p + ': a function (cannot cross a thread)';
    return a === b ? null : p + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b);
  }
  if (seenA.has(a) || seenB.has(b)) return seenA.get(a) === seenB.get(b) && seenA.get(a) !== undefined ? null : p + ': sharing differs';
  seenA.set(a, p); seenB.set(b, p);
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor || a.length !== b.length) return p + ': typed array kind/length';
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return p + '[' + i + ']: ' + a[i] + ' vs ' + b[i];
    return null;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return p + ': array vs object';
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return p + ': keys ' + ka.join(',').slice(0, 120) + ' vs ' + kb.join(',').slice(0, 120);
  for (const k of ka) { const d = diff(a[k], b[k], p + '.' + k, seenA, seenB); if (d) return d; }
  return null;
}
// a last-bit flip somewhere in the sheet (the selftest's tamper)
function flipOne(o) {
  for (const k of Object.keys(o)) if (typeof o[k] === 'number' && Number.isFinite(o[k]) && o[k] !== 0) {
    const f = new Float64Array([o[k]]), u = new Uint32Array(f.buffer); u[0] ^= 1; o[k] = f[0]; return k;
  }
  return null;
}

// ---- 1 THE THREAD ---------------------------------------------------------------------------------------------------
// the Blob's source in a real thread: `self` is the thread's global, importScripts reads the named file (the query
// dropped) into it, postMessage / onmessage are the port's
const THREAD_BOOT = `
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs'), path = require('path'), vm = require('vm');
globalThis.self = globalThis;
const urls = [];
globalThis.importScripts = u => { urls.push(u); const rel = u.replace(workerData.base, '').split('?')[0];
  vm.runInThisContext(fs.readFileSync(path.join(workerData.root, ...rel.split('/')), 'utf8'), { filename: rel }); };
globalThis.postMessage = (m, tr) => parentPort.postMessage(m, tr || []);
parentPort.on('message', d => { if (d && d.__urls) { parentPort.postMessage({ __urls: urls }); return; }
  if (d && d.__plant) { vm.runInThisContext("CORE.genShakedown = function () { throw new Error('planted'); };"); parentPort.postMessage({ __planted: 1 }); return; }
  if (self.onmessage) self.onmessage({ data: d }); });
vm.runInThisContext(workerData.src, { filename: 'bench_worker_blob.js' });
`;
function startThread(src, base) {
  const w = new Worker(THREAD_BOOT, { eval: true, workerData: { src, base, root: ROOT } });
  const waits = [];
  w.on('message', m => { const f = waits.shift(); if (f) f(m); });
  w.on('error', e => { const f = waits.shift(); if (f) f({ error: 'thread: ' + (e && e.message) }); });
  return { ask: m => new Promise(r => { waits.push(r); w.postMessage(m); }), kill: () => w.terminate() };
}

async function sectionThread() {
  console.log('1 THE THREAD (bench_worker.js\'s Blob source in a real thread, against the main thread)');
  const BW = require(path.join(ROOT, 'src', 'viewer', 'bench_worker.js'));
  const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
  const base = 'https://page/flyDiy/';
  const src = BW.benchWorkerSource(base, 'B1', 'c0re');
  ok(/bench_worker\.js\?v=B1/.test(src) && /tools\/flight_core\.js\?v=c0re/.test(src) && /genShakedown/.test(src),
     'the source asks the core by its sha (as the page does with versioned) and hands genShakedown to the body');
  ok(/tools\/flight_core\.js"\)/.test(BW.benchWorkerSource(base)), 'unversioned (the bench\'s own tests) it asks exactly as before');
  const th = startThread(src, base);
  const t0 = Date.now();
  let seq = 0, mainMs = 0, threadMs = 0;
  for (const k of Object.keys(BUILDS)) {
    const spec = specOf(k);
    let def, sh;
    const tm = Date.now();
    try { def = C.buildGen(spec); sh = C.genShakedown(def, { corners: false }); } catch (e) { ok(false, k + ': the main thread could not build it - ' + e.message); continue; }
    mainMs += Date.now() - tm;
    // the job as the page posts it: the spec the def was built from, cloned at the post (after the build)
    const r = await th.ask({ kind: 'sheet', seq: ++seq, key: 'k' + seq, spec: JSON.parse(JSON.stringify(spec)), opts: { corners: false } });
    if (!r || r.error) { ok(false, k + ': the thread answered an error - ' + (r && r.error)); continue; }
    threadMs += r.ms || 0;
    const got = r.sheet;
    if (SELF && k === 'cub') { const f = flipOne(got); console.log('  (selftest: flipped the last bit of ' + f + ')'); }
    const d = diff(got, sh);
    ok(!d && r.kind === 'sheet' && r.seq === seq && r.key === 'k' + seq,
       k + ': the thread\'s sheet is the main thread\'s to the bit (' + Object.keys(sh).length + ' keys' + (d ? '; FIRST DIFF ' + d : '') + ')');
    const sg = BW.benchSheetSig(def);
    ok(!diff(r.sig, sg), k + ': the def signature equal (nodes ' + sg.nn + ', beams ' + sg.nb + ', mass ' + sg.m.toFixed(3) + ' kg)');
  }
  // the design strip's lane: the ledger sheet, the merged spec as it is
  {
    const spec = specOf('jodel');
    const sh = C.genShakedown(C.buildGen(spec), { ledger: true, corners: false });
    const r = await th.ask({ kind: 'sheet', seq: ++seq, key: 'strip', spec, opts: { ledger: true, corners: false } });
    const d = r && !r.error ? diff(r.sheet, sh) : String(r && r.error);
    ok(!d, 'the strip\'s ledger sheet (jodel) equal to the bit' + (d ? ' - ' + d : ''));
  }
  const urls = (await th.ask({ __urls: 1 })).__urls;
  // a sheet that throws: an error message back with its seq, never a hang (the core normalises any spec - even
  // { wings: 'nope' } builds - so the throw is planted in the thread's own genShakedown, the last job on this thread)
  {
    await th.ask({ __plant: 1 });
    const r = await th.ask({ kind: 'sheet', seq: ++seq, key: 'bad', spec: specOf('cub'), opts: {} });
    ok(r && r.kind === 'sheet' && r.seq === seq && /planted/.test(r.error || ''), 'a sheet that throws answers {error} with its seq (the page then computes it, meeting the same error)');
  }
  ok(urls.length === 2 && /bench_worker\.js\?v=B1$/.test(urls[0]) && /flight_core\.js\?v=c0re$/.test(urls[1]), 'the thread imported the two files it names: ' + urls.map(u => u.replace(base, '')).join(', '));
  await th.kill();
  console.log('  (main thread ' + mainMs + ' ms, the thread\'s own runs ' + threadMs.toFixed(0) + ' ms, section ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
}

// ---- 2 THE LINK -----------------------------------------------------------------------------------------------------
function fakeWorld(opts) {
  let t = 0; const timers = [];
  const W = { t: () => t, threads: [], posts: [], kills: 0, held: false, startOk: true };
  const setT = (f, ms) => { const h = { at: t + ms, f, live: true }; timers.push(h); return h; };
  const clearT = h => { if (h) h.live = false; };
  W.advance = ms => {
    const end = t + ms;
    for (;;) {
      const due = timers.filter(h => h.live && h.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      t = due.at; due.live = false; due.f();
    }
    t = end;
  };
  W.start = (onMsg, onErr) => {
    if (!W.startOk) return null;
    const th = { onMsg, onErr, dead: false, jobs: [] };
    W.threads.push(th);
    return { post: job => { if (th.dead) return false; th.jobs.push(job); W.posts.push(job); return true; },
             kill: () => { if (!th.dead) { th.dead = true; W.kills++; } } };
  };
  // the thread answers its last job (or a given one), as a real one would
  W.answer = (job, extra) => { const th = W.threads.find(x => x.jobs.indexOf(job) >= 0); if (!th || th.dead) return false;
    th.onMsg(Object.assign({ kind: 'sheet', seq: job.seq, key: job.key, sheet: { k: job.key }, sig: {} }, extra || {})); return true; };
  W.answerAnyway = (job, extra) => { const th = W.threads.find(x => x.jobs.indexOf(job) >= 0);
    th.onMsg(Object.assign({ kind: 'sheet', seq: job.seq, key: job.key, sheet: { k: job.key }, sig: {} }, extra || {})); };
  W.link = (mk, o) => mk(Object.assign({ start: W.start, held: () => W.held, settleMs: 250, setTimeout: setT, clearTimeout: clearT, now: () => t }, o || {}));
  return W;
}
// the selftest's two broken links: one that posts every request at once, one that never aborts
function brokenEager(o) {
  let w = null, s = 0; const st = { aborted: 0 };
  return { request: (lane, job) => { if (!w) w = o.start(r => job.on(r.sheet, r), () => {}); w.post({ kind: 'sheet', seq: ++s, key: job.key, spec: job.spec }); return true; },
           cancel() {}, pending: () => false, kill() {}, state: () => st, dead: null };
}
// (the newest waits for the computing one to finish; nothing is ever terminated)
function brokenNoAbort(o) {
  let w = null, fly = null, want = null, s = 0; const st = { aborted: 0, dropped: 0, landed: 0 };
  const go = () => { if (fly || !want) return; if (!w) w = o.start(onMsg, () => {}); const j = want; want = null; fly = { seq: ++s, job: j }; w.post({ kind: 'sheet', seq: s, key: j.key }); };
  const onMsg = r => { if (!fly || r.seq !== fly.seq) { st.dropped++; return; } const f = fly; fly = null; st.landed++; f.job.on(r.sheet, r); go(); };
  return { request: (l, j) => { want = j; o.setTimeout(go, o.settleMs); return true; }, cancel() {}, pending: () => false, kill() {},
           state: () => Object.assign({ inFlight: fly && fly.job.key }, st), dead: null };
}

function sectionLink() {
  console.log('2 THE LINK (sheet_link.js on a fake clock and a fake thread)');
  const SL = require(path.join(ROOT, 'src', 'viewer', 'sheet_link.js'));
  let mk = SL.makeSheetLink;
  // (a) a drag of ten ticks under a held hand: ONE sheet, for the last aeroplane
  {
    const W = fakeWorld();
    const L = W.link(SELF ? brokenEager : mk);
    const got = [];
    W.held = true;
    for (let i = 0; i < 10; i++) { L.request('stand', { key: 'drag' + i, spec: { i }, on: (sh, r) => got.push(r.key), fail: () => got.push('fail') }); W.advance(16); }
    W.advance(900);                      // the hand still down: nothing yet
    const during = W.posts.length;
    W.held = false; W.advance(300);
    const posts = W.posts.length;
    if (posts) W.answer(W.posts[posts - 1]);
    ok(during === 0 && posts === 1 && W.posts[0].key === 'drag9' && got.join() === 'drag9',
       'a drag of 10 ticks runs ONE sheet, after the hand lifts, for the aeroplane it ends on (posted during the drag ' + during + ', after ' + posts + ', delivered ' + got.join() + ')');
  }
  if (SELF) mk = brokenNoAbort;
  // (b) the newest wins: a newer aeroplane while one computes terminates that thread; the late answer is dropped
  {
    const W = fakeWorld();
    const L = W.link(mk);
    const got = [];
    const job = k => ({ key: k, spec: { k }, on: (sh, r) => got.push(r.key), fail: () => got.push('fail:' + k) });
    L.request('stand', job('A')); W.advance(260);
    const jA = W.posts[0];
    L.request('stand', job('B'));
    const killedAtOnce = W.kills;
    W.advance(260);
    const jB = W.posts[1];
    const lateDelivered = jA ? W.answer(jA) : false;      // a terminated thread delivers nothing...
    if (jA) W.answerAnyway(jA);                            // ...and an answer that crossed anyway is dropped by its seq
    if (jB) W.answer(jB);
    const s = L.state();
    ok(killedAtOnce === 1 && W.threads.length === 2 && !lateDelivered && got.join() === 'B' && s.aborted === 1 && s.dropped === 1 && s.landed === 1,
       'a newer aeroplane terminates the computing thread at once, runs on a fresh one, and the superseded answer is dropped (kills ' + W.kills + ', threads ' + W.threads.length + ', delivered ' + got.join() + ', aborted ' + s.aborted + ', dropped ' + s.dropped + ')');
    // the same aeroplane asked again while it computes: not asked twice, the newest `on` takes the answer
    L.request('stand', job('C')); W.advance(260);
    const n0 = W.posts.length;
    const got2 = [];
    L.request('stand', { key: 'C', spec: {}, on: (sh, r) => got2.push('second'), fail: () => {} }); W.advance(600);
    W.answer(W.posts[W.posts.length - 1]);
    ok(W.posts.length === n0 && got2.join() === 'second' && L.state().aborted === 1, 'the aeroplane already computing is not asked twice; the latest reader gets the answer');
    // a cancel (the page computed it itself) stops the thread
    L.request('stand', job('D')); W.advance(260);
    const k0 = W.kills;
    L.cancel('stand', 'D');
    ok(W.kills === k0 + 1 && !L.pending('D'), 'a cancel of the computing sheet terminates its thread');
    // the thread is kept warm between jobs: one thread answered A..C after the abort
    ok(W.threads.length <= 3, 'a finished job keeps its thread (threads made: ' + W.threads.length + ')');
  }
  // (c) other lanes queue behind the computing one, never abort it
  {
    const W = fakeWorld();
    const L = W.link(SL.makeSheetLink);
    const got = [];
    L.request('stand', { key: 'S', spec: {}, on: () => got.push('S'), fail: () => {} }); W.advance(260);
    L.request('strip', { key: 'T', spec: {}, on: () => got.push('T'), fail: () => {} }); W.advance(600);
    const posts1 = W.posts.length;
    W.answer(W.posts[0]); W.advance(1);
    W.answer(W.posts[1]);
    ok(posts1 === 1 && W.kills === 0 && got.join() === 'S,T', 'another lane waits for the computing sheet and runs after it (no abort across lanes)');
  }
  // (d) dead links: no Worker, a thread that dies, two errors - fail() for the waiting, request false after
  {
    const W = fakeWorld(); W.startOk = false;
    const L = W.link(SL.makeSheetLink);
    const got = [];
    const took = L.request('stand', { key: 'A', spec: {}, on: () => got.push('on'), fail: why => got.push('fail') });
    W.advance(300);
    ok(took === false && got.length === 0 && L.dead && L.request('stand', { key: 'B', spec: {}, on() {}, fail() {} }) === false,
       'no Worker (the node page): the very first request says false - the caller computes at once, as before - and so does every later one (' + L.dead + ')');
  }
  {
    const W = fakeWorld();
    const L = W.link(SL.makeSheetLink);
    const got = [];
    L.request('stand', { key: 'A', spec: {}, on: () => got.push('on'), fail: () => got.push('failA') }); W.advance(300);
    L.request('strip', { key: 'B', spec: {}, on: () => got.push('on'), fail: () => got.push('failB') });
    W.threads[0].onErr('importScripts failed');
    ok(got.join() === 'failA,failB' && /failed/.test(L.dead || ''), 'a thread that dies fails every job waiting and kills the link');
  }
  {
    const W = fakeWorld();
    const L = W.link(SL.makeSheetLink);
    const got = [];
    const job = k => ({ key: k, spec: {}, on: () => got.push('on:' + k), fail: () => got.push('fail:' + k) });
    L.request('stand', job('A')); W.advance(300); W.answer(W.posts[0], { error: 'boom' });
    const after1 = L.dead;
    L.request('stand', job('B')); W.advance(300); W.answer(W.posts[1], { error: 'DataCloneError' });
    ok(!after1 && got.join() === 'fail:A,fail:B' && !!L.dead && W.threads.length === 2,
       'one error fails its job over to the page (the link lives, on a fresh thread); two in a row kill the link');
  }
  // (f) readers asking for the SAME waiting aeroplane again and again do not push its settle back
  {
    const W = fakeWorld();
    const L = W.link(SL.makeSheetLink);
    let at = null;
    for (let i = 0; i < 20; i++) { L.request('stand', { key: 'S', spec: {}, on() {}, fail() {} }); W.advance(100); if (at == null && W.posts.length) at = W.t(); }
    ok(W.posts.length === 1 && at != null && at <= 400, 'the same aeroplane asked every 100 ms: posted once, at its first settle (t ' + at + ' ms), never starved');
  }
  // (e) a hand that never lifts does not starve the readouts
  {
    const W = fakeWorld(); W.held = true;
    const L = W.link(SL.makeSheetLink, { holdMaxMs: 3000 });
    L.request('stand', { key: 'A', spec: {}, on() {}, fail() {} });
    W.advance(2500); const p0 = W.posts.length;
    W.advance(1000); const p1 = W.posts.length;
    ok(p0 === 0 && p1 === 1, 'a held flag that never clears: the sheet is asked after holdMaxMs (' + p0 + ' -> ' + p1 + ')');
  }
}

// ---- 3 THE PAGE -----------------------------------------------------------------------------------------------------
function sectionPage() {
  console.log('3 THE PAGE (source)');
  let APP = rd('src/viewer/app.js');
  if (SELF) APP = APP.replace('indicatorsStale();\n      if (gInd', 'shakeOf();\n      if (gInd');
  const bi0 = APP.indexOf('function buildIndicators() {');
  const bi = APP.slice(bi0, APP.indexOf('\n  }\n', bi0));
  ok(/SHEET && !SHEET\.dead[^]*?!shakeKnown\(\) && sheetAsk\(\)\) \{\s*indicatorsStale\(\);/.test(bi) && bi.indexOf('shakeOf()') > bi.indexOf('indicatorsStale()'),
     'the posts: with the thread up and no answer known, buildIndicators asks the thread and keeps the standing posts dimmed - before any shakeOf; a link that does not take it (the node page) falls to the page\'s run');
  ok(/function shakeSoon\(\) \{\s*if \(sheetAsk\(\)\) return;\s*shakeSoonPage\(\);/.test(APP), 'G1302\'s post-idle readouts ask the thread first, the page path only when the link does not take it');
  ok(/function sheetLand\(d, key, sh, r\)[^]*?sig\.nn !== ws\.nn[^]*?sig\.m !== ws\.m[^]*?SHEET\.kill\([^]*?shakeKeep\(key, sh\)/.test(APP), 'an answer is believed only on the def\'s signature (else the link is killed) and kept as the page\'s own run');
  ok(/on: \(sh, r\) => sheetLand\(d, key, sh, r\)/.test(APP) && /SHEET\.request\('stand', \{ key, spec: genSpec, opts: \{ corners: false \}/.test(APP), 'the stand asks for the def it has (its key) with the spec its def was built from and the page\'s options');
  ok(/if \(key\) \{ shakeKeep\(key, v\); try \{ if \(SHEET\) SHEET\.cancel\('stand', key\)/.test(APP), 'a sheet the page computed itself (the bench, the roll-out) stops the thread\'s');
  ok(/\[\?&\]sheetw=0/.test(APP) && /BENCH_WORKER\.start\(onMsg, onErr, \{ versioned: true \}\)/.test(APP), '?sheetw=0 keeps the old page path; the thread asks the core by its sha');
  ok(/pqShown && SHEET && !SHEET\.dead\)[^]*?classList\.add\('stale'\)[^]*?UPDATING/.test(APP) && /#plaque\.on\.stale/.test(rd('src/viewer/editor.css')),
     'the plaque keeps its numbers dimmed and says UPDATING while the sheet computes, never blank, never unmarked');
  ok(/try \{ if \(indStale\) buildIndicators\(\); \} catch/.test(APP), 'the dimmed posts are rebuilt when the sheet lands (thread or page)');
  const UI = rd('tools/_cage_ui.js');
  ok(/dragging: \(\) => !!\(DRAG_ON \|\| DRAG_T \|\| DRAG_LATE\)/.test(UI), 'the editor says when a hand is on a slider (or its settle build is owed)');
  const DF = rd('src/viewer/design_flow.js');
  ok(/L\.request\('strip', \{ key, spec, opts,/.test(DF) && /if \(took\) return \{ pending: true \};/.test(DF), 'the design strip asks its own lane and fills in place');
  const BW = rd('src/viewer/bench_worker.js');
  ok(/job\.kind === 'sheet'\) \{[^]*?post\(BW\.benchSheetRun\(CORE, job\)\)/.test(BW), 'the bench worker runs the sheet job');
  const BUILD = rd('tools/build.js');
  ok(/'sim_link\.js', 'sheet_link\.js',/.test(BUILD), 'the build lists sheet_link.js before app.js');
  for (const f of ['dev.html', 'index.html']) {
    const h = rd(f);
    // index.html inlines every script; dev.html names them (its scripts are fetched)
    const has = n => h.includes(n === 'link' ? 'function makeSheetLink(' : 'function benchSheetRun(') || h.includes(n === 'link' ? 'src/viewer/sheet_link.js' : 'src/viewer/bench_worker.js');
    ok(has('link') && has('job') && (h.includes('SHEET_LINK') || h.includes('src/viewer/app.js')), f + ' carries the link, the job and the wiring (built)');
  }
  // the node page's Worker shim lends only the threads a gate asks for: this Blob is refused there, so every gate's
  // page keeps the page path (no gate asks /bench_worker/)
  const PN = rd('tools/_page_node.js');
  ok(/throw new Error\('Worker: ' \+ u \+ ' is not available in the node page'\)/.test(PN), 'the node page refuses an unasked Blob worker (the gates keep the old path)');
}

// ---- THE BROWSER ROW (--browser: the box, Chrome) -------------------------------------------------------------------
async function sectionBrowser() {
  console.log('B THE BROWSER (Chrome: the page\'s main thread against the Blob worker, through sheet_link.js)');
  const http = require('http');
  const MB = require('./master_bench.js');
  const argv = process.argv;
  const udd = (argv[argv.indexOf('--udd') + 1]) || path.join(require('os').tmpdir(), 'sheetw_udd');
  const PAGE = '<!doctype html><meta charset="utf-8"><title>sheet worker</title>' +
    '<script>window.FLYDIY_CORE_SHA="' + (Date.now().toString(36)) + '";</script>' +
    '<script src="tools/flight_core.js"></script><script src="src/viewer/bench_worker.js"></script><script src="src/viewer/sheet_link.js"></script>';
  const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/flyDiy/__sheetw.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
    const f = path.join(ROOT, u.replace(/^\/flyDiy\//, ''));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const b = await MB.browser(udd);
  try {
    await b.cmd('Page.navigate', { url: 'http://127.0.0.1:' + srv.address().port + '/flyDiy/__sheetw.html' });
    await new Promise(r => setTimeout(r, 2500));
    const specs = {}; for (const k of Object.keys(BUILDS)) specs[k] = specOf(k);
    const fn = `(async () => {
      const specs = ${JSON.stringify(specs)};
      ${diff.toString()}
      const out = [];
      const L = makeSheetLink({ start: (m, e) => BENCH_WORKER.start(m, e, { versioned: true }), settleMs: 0 });
      for (const k of Object.keys(specs)) {
        const spec = specs[k];
        const t0 = performance.now(); const def = buildGen(spec); const sh = genShakedown(def, { corners: false }); const mainMs = performance.now() - t0;
        const r = await new Promise(res => { const ok = L.request('stand', { key: k, spec, opts: { corners: false }, on: (s, r) => res(r), fail: why => res({ error: String(why) }) }); if (!ok) res({ error: 'link dead: ' + L.dead }); });
        if (r.error) { out.push({ k, error: r.error }); continue; }
        const sg = BENCH_WORKER.sheetSig(def);
        out.push({ k, d: diff(r.sheet, sh), sig: diff(r.sig, sg), mainMs: Math.round(mainMs), threadMs: Math.round(r.ms), n: Object.keys(sh).length });
      }
      return JSON.stringify({ out, st: L.state(), ua: navigator.userAgent });
    })()`;
    const res = JSON.parse(await b.ev(fn, 600000));
    for (const o of res.out) ok(!o.error && !o.d && !o.sig, o.k + ' in Chrome: the worker\'s sheet is the main thread\'s to the bit' + (o.error ? ' - ' + o.error : o.d ? ' - FIRST DIFF ' + o.d : o.sig ? ' - sig ' + o.sig : '') + ' (main ' + o.mainMs + ' ms, thread ' + o.threadMs + ' ms)');
    ok(res.st.posted === Object.keys(BUILDS).length && !res.st.dead, 'one post a build, the link alive (' + res.ua.replace(/.*Chrome\/(\S+).*/, 'Chrome $1') + ')');
    ok(!b.exc.length, 'no page exceptions' + (b.exc.length ? ': ' + b.exc.slice(0, 3).join(' | ') : ''));
  } finally { await b.close(); srv.close(); }
  // THE GARAGE ITSELF (--port P): the built index.html on the Cub, a hand held on a slider while the aeroplane on the
  // stand changes ten times (GARAGE_SPEC.update: the energy layer's door), then lifted - ONE sheet posted and landed,
  // and NO genShakedown on the page's thread from the first change to the readouts re-reading it
  const pi = argv.indexOf('--port'), PORT = pi >= 0 ? +argv[pi + 1] : 0;
  if (!PORT) { console.log('  (no --port: the garage row skipped)'); return; }
  const s2 = MB.serve(PORT); await new Promise(r => setTimeout(r, 800));
  const g = await MB.browser(udd);
  try {
    const l = await g.load('http://localhost:' + PORT + '/flyDiy/index.html', MB.preScript('builds/cub_2026-09-20_corrected.json'));
    console.log('  garage loaded: ' + l.state + ' in ' + l.sec + ' s');
    await new Promise(r => setTimeout(r, 6000));
    const res = JSON.parse(await g.ev(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const L = window.SHEET_LINK; if (!L) return JSON.stringify({ error: 'no SHEET_LINK on the page' });
      let main = 0; const f0 = window.genShakedown; window.genShakedown = function () { main++; return f0.apply(this, arguments); };
      const s0 = L.state(), G = window.GARAGE_SPEC, sp0 = G.get(), span0 = sp0.wings[0].span;
      const el = document.getElementById('p_wgSpan') || document.querySelector('input[type=range][id^=p_]');
      el.dispatchEvent(new PointerEvent('pointerdown'));
      const held = !!(window.CAGE_UI && window.CAGE_UI.dragging && window.CAGE_UI.dragging());
      for (let i = 1; i <= 10; i++) { G.update({ wings: [Object.assign({}, sp0.wings[0], { span: +(span0 + 0.05 * i).toFixed(3) })] }); await sleep(40); }
      await sleep(1200);
      const sHeld = L.state();
      window.dispatchEvent(new PointerEvent('pointerup'));
      const t0 = performance.now();
      while (performance.now() - t0 < 20000 && (L.state().inFlight || L.state().waiting.length)) await sleep(100);
      await sleep(1500);
      const s1 = L.state();
      // the build put back (untimed)
      G.update({ wings: [sp0.wings[0]] });
      window.genShakedown = f0;
      return JSON.stringify({ held, posted: s1.posted - s0.posted, postedHeld: sHeld.posted - s0.posted, landed: s1.landed - s0.landed, aborted: s1.aborted - s0.aborted,
        main, dead: s1.dead, ms: s1.lastMs });
    })()`, 120000));
    if (res.error) ok(false, 'the garage row: ' + res.error);
    else {
      ok(res.held && res.postedHeld === 0, 'a hand on the slider: nothing posted while it is held (' + res.postedHeld + ')');
      ok(res.posted === 1 && res.landed === 1 && !res.dead, 'ten aeroplanes under one held hand: ONE sheet posted and landed (posted ' + res.posted + ', landed ' + res.landed + ', aborted ' + res.aborted + ', ' + Math.round(res.ms || 0) + ' ms on the thread)');
      ok(res.main === 0, 'genShakedown on the page\'s thread: ' + res.main + ' times through ten stand changes and the re-read');
    }
    ok(!g.exc.length, 'no page exceptions in the garage' + (g.exc.length ? ': ' + g.exc.slice(0, 3).join(' | ') : ''));
  } finally {
    await g.close();
    try { s2.kill(); if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + s2.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  }
}

(async () => {
  if (BROWSER) { await sectionBrowser(); }
  else {
    // --only thread,link,page: a section alone (the link and the page are milliseconds; the thread builds eight aeroplanes)
    const oi = process.argv.indexOf('--only'), only = oi >= 0 ? new Set(process.argv[oi + 1].split(',')) : null;
    if (!only || only.has('thread')) await sectionThread();
    if (!only || only.has('link')) sectionLink();
    if (!only || only.has('page')) sectionPage();
  }
  const pass = fails === 0;
  if (SELF) {
    // each planted fault must be caught: the flipped bit (THE THREAD), the eager link (a), the non-aborting link (b),
    // the sheet in buildIndicators (THE PAGE)
    console.log('GATE SHEETWORKER --selftest: ' + (fails >= 4 ? 'PASS (' + fails + ' planted faults caught)' : 'FAIL (only ' + fails + ' caught)'));
    process.exit(fails >= 4 ? 0 : 1);
  }
  // the verdict line exactly as run_gates.js reads it (^GATE <ID>: PASS$ - a suffix on it reads as a FAIL; train 52's
  // battery held 52b on "PASS (47/47)"), the counts on the line before
  console.log((checks - fails) + '/' + checks + ' checks');
  console.log('GATE SHEETWORKER' + (BROWSER ? ' (browser)' : '') + ': ' + (pass ? 'PASS' : 'FAIL'));
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
