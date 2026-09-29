#!/usr/bin/env node
// GATE SIMWORKER-PAGE - THE PAGE FLOWN THROUGH THE WORKER IS THE PAGE FLOWN INLINE, TO THE BIT (G816, C1b).
//
//   node tools/_simworker_page_check.js               -> "GATE SIMWORKER-PAGE: PASS|FAIL"
//   node tools/_simworker_page_check.js --selftest    -> negative verification (each fault must turn it red)
//   --builds=cub,cessna   --secs=S (sim seconds of flight from the roll-out's start, default 40)
//   --json=<file> (both runs' records)
//
// THE PAGE ITSELF IN NODE (tools/_page_node.js, G1010), twice per build, one process at a time (~3.6 GB each):
//   INLINE   dev.html?simw=0 (G820: the worker is the default candidate) - the loop's `script(1/60); sim.step(1/60)` on the page's thread;
//   SIMW     dev.html?simw=1 - the page's step block posts its inputs to src/viewer/sim_host.js running in a REAL
//            thread (the harness's Worker shim: node worker_threads, the same Blob source, the same messages and
//            transfers, the core and the trimmed boot fetched off the disk the page's way) and takes its snapshots.
// Both: the garage boots, `Roll out` (#bGo) is pressed, the roll-out screen runs through the page's own BOOT chain,
// the flight starts when the screen lifts (the roll-out's own start: app.js rollOut(() => { started = true })), the
// sim rate is set to 2x (TEST_FLIGHT.rate: two steps a frame, both runs) and the flight runs --secs seconds of sim
// time: the pilot's DEPART, the taxi out along the stand's route (and, for a long enough --secs, the line-up and the
// take-off). The renderer's draw calls are stubbed after the roll-out in BOTH runs (the picture is not the subject; a
// frame of the recording GL is ~150 ms of node).
// Recorded: INLINE - after every solver step on the page (makeSim's step wrapped): FNV of p, v and the CG bytes and
// the pilot's phase; SIMW - every snapshot the worker publishes (the harness sees each message before the page does):
// the same FNVs off the snapshot's float64 p, v and CG, the phase off its pilot meta. And per rendered FRAME in both:
// the page's own reads at the step the picture shows - sim.cgPos(), sim.axes(), sim.bodyOrigin(), ap.phase (under
// simw: the mirror of the newest snapshot, the picture one frame behind). Asserted:
//   1 every step both runs reached: p, v, CG and the phase BIT-IDENTICAL (the first difference named);
//   2 every frame row of SIMW equal, bit for bit, to INLINE's reads at that same step;
//   3 the page's main thread stepped NO solver during the simw flight (makeSim's step on the page: 0 calls; the
//     mirror's stray counter 0), and the inline run did (the counter works);
//   4 the worker's placement check passed (its step 0 = the page's placed aeroplane), the flight went live, the
//     world-version assertion never tripped (wvBad 0) and the obstacles the page registered reached the worker
//     (its world version > 0);
//   5 no page error, no worker error.
// WHAT HAD TO BE MADE EQUAL (found by this gate, G815; each a last-bits difference in the wind or the ground that the
// flight carried from step 1): (a) the island's COOKED ground-raster cells (the page's loader brings them with the
// raster on - the worker fetches them the same way); (b) the premises CATALOGUE (the page composes with its
// generators on window: a park's lawn is a modifier, and without it 7 cooked cells went stale and baked lazily - the
// worker imports the same generator scripts); (c) the climate's CONVECTION cache (09_climate.js convNow keeps the exact
// inputs of the first moment its rounded key was met - the page's day met it in the garage: carried with
// convState / convSeed); (d) the viewers' wind queries at t = 0 (they hold the climate sampler's reference when the
// flight's first substep runs at simT = 0 - replayed, windq); (e) the day ticked once per frame's batch (dayBatch).
// FLYDIY_SIMW.probe(pts, t, tag, { grid: N, values }) compares the two worlds (the ground, the surface, the relief
// raster, the wind at points, the cooked cells) - the triage of the next difference.
// NEGATIVE-VERIFIED (--selftest, the cub, a short flight): the start STAMPED two steps late under simw (1), a stray
//   `sim.step()` on the page under simw (3), and the worker's world denied the page's obstacles (the harness strips
//   every `obst` command on its way to the thread: 4's world version and its assertion).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILDS = { cub: null, cessna: 'bugReports/cessnaMetal (1).json' };
const RATE = 2;

const fnv = (h, a) => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; return h; };
const hx = arr => Buffer.from(Float64Array.from(arr).buffer).toString('hex');

// ============================================================ THE CHILD: one page, one mode
async function child() {
  const mode = arg('child'), build = arg('build', 'cub'), out = arg('out'), fault = arg('fault', '');
  const SECS = +arg('secs', 40), TOTAL = Math.round(SECS * 60);
  const { openPage } = require('./_page_node.js');
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  const S = SH.SIM_SNAP;
  const storage = {};
  if (BUILDS[build]) storage['flydiy.wip'] = fs.readFileSync(path.join(ROOT, BUILDS[build]), 'utf8');
  const DUMP = +(process.env.SIMWP_DUMP || 0);   // debugging: the first N steps' whole p, v, out, ctl, eng (R.dump)
  const R = { mode, build, dump: {}, steps: {}, frames: [], mainSteps: 0, mainStepsFlight: 0, otherSteps: 0, otherWho: {}, errors: [], t: {} };
  let rec = false, FP = null, W = null, flightSim = null, stepN = 0, epoch = null;
  const t0 = Date.now();
  const hooks = {
    beforeScript(name, P) {
      if (name !== 'src/viewer/app.js') return;
      const Wn = P.win, mk = Wn.makeSim;
      // every sim the page makes: its step counted (on the page's thread), and the flight's recorded after each step
      Wn.makeSim = function () {
        const sim = mk.apply(this, arguments), st = sim.step;
        sim.step = function () {
          R.mainSteps++;
          const r = st.apply(this, arguments);
          if (rec && sim !== flightSim) {
            // another sim on the page (a planner's probe, a sheet's shakedown): not the flight's solver - named, counted
            R.otherSteps++;
            if (R.otherSteps % 500 === 1) { const at = (new Error().stack || '').split('\n').slice(2, 7).map(l => l.trim().replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).join(' < ');
              R.otherWho[at] = (R.otherWho[at] || 0) + 1; }
          } else if (rec) {
            R.mainStepsFlight++;
            if (mode === 'inline') {
              stepN++;
              const cg = new Float64Array(sim.cgPos());
              R.steps[stepN] = [fnv(2166136261, sim.p), fnv(2166136261, sim.v), fnv(2166136261, cg), FP.ap().phase];
              if (stepN <= DUMP) R.dump[stepN] = { p: Array.from(sim.p), v: Array.from(sim.v), out: JSON.parse(JSON.stringify(sim.out, (k, x) => (k === 'hydro' ? undefined : x))), ctl: JSON.parse(JSON.stringify(sim.ctl)), eng: JSON.parse(JSON.stringify(sim.eng)) };
            }
          }
          return r;
        };
        return sim;
      };
    },
  };
  // the worker's snapshots, seen before the page takes them (a transferred buffer is read here, then handed on)
  const tap = (w, m) => {
    if (!rec || !m || m.kind !== 'snap') return;
    const f = new Float64Array(m.buf), n = f[S.N], n3 = 3 * n;
    if (epoch == null || f[S.EPOCH] !== epoch) return;
    const k = f[S.STEP];
    if (k < 1) return;
    const p = f.subarray(S.HEAD, S.HEAD + n3), v = f.subarray(S.HEAD + n3, S.HEAD + 2 * n3), cg = f.subarray(S.CG, S.CG + 3);
    const ph = m.meta && m.meta.ap && m.meta.ap.phase;
    R.steps[k] = [fnv(2166136261, p), fnv(2166136261, v), fnv(2166136261, cg), ph != null ? ph : (R.steps[k - 1] ? R.steps[k - 1][3] : null)];
    if (k <= DUMP) R.dump[k] = { p: Array.from(p), v: Array.from(v), out: m.meta.out, ctl: m.meta.ctl, eng: m.meta.eng };
  };
  // the worker denied the page's obstacles (selftest): the harness strips every `obst` command on its way
  const strip = m => { if (!m) return m; if (m.cmd === 'obst') return null; if (m.cmd === 'batch') return Object.assign({}, m, { list: (m.list || []).filter(c => c.cmd !== 'obst') }); return m; };
  // the start stamped two steps late (selftest): the page's `started` reaching the worker at the wrong boundary
  const late = m => { if (m && m.cmd === 'batch') for (const c of m.list || []) if (c.cmd === 'start' && c.k != null) c.k += 2; return m; };
  const P = await openPage({ quiet: true, storage, hooks, query: mode === 'simw' ? 'simw=1' : 'simw=0', workers: /sim_host\.js/, onWorkerMessage: tap,
                             workerPostFilter: fault === 'noobst' ? (w, m) => strip(m) : fault === 'late' ? (w, m) => late(m) : null });
  W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  R.t.garage = Date.now() - t0;
  W.document.getElementById('bGo').click();
  // (B8B9: a roll-out with nothing new to do shows no screen - its trip in window.FLYDIY_TRIPS says when it is done)
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 900000);
  R.t.rollout = Date.now() - t0 - R.t.garage;
  FP = W.FLIGHT_PROBE;
  const RD = FP.renderer();
  RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  W.TEST_FLIGHT.rate(RATE);
  const SW = W.FLYDIY_SIMW || null;
  flightSim = FP.sim();
  rec = true;
  const stepsNow = () => (mode === 'simw' ? (SW ? SW.state().stepsPosted : 0) : stepN);
  const shown = () => (mode === 'simw' ? (SW ? SW.state().lastStep : 0) : stepN);
  let strayed = false, lastShown = -1;
  const t1 = Date.now();
  P.onFrame((ph) => {
    if (ph !== 'end' || !rec) return;
    if (mode === 'simw' && SW && epoch == null) { const s = SW.state(); if (s.flight && s.flight.live) epoch = s.flight.epoch; }
    const k = shown();
    if (k > 0 && k !== lastShown) {
      lastShown = k;
      const sim = FP.sim(), ap = FP.ap();
      R.frames.push([k, hx(sim.cgPos()), hx([].concat(...sim.axes())), hx(sim.bodyOrigin()), ap.phase]);
    }
  });
  const until = async (cond, maxFrames) => { for (let i = 0; i < maxFrames && !cond(); i++) await P.frames(1); return cond(); };
  await until(() => {
    if (fault === 'stray' && !strayed && stepsNow() > 120) { strayed = true; FP.sim().step(1 / 60); }
    return shown() >= TOTAL;
  }, Math.ceil(TOTAL / RATE) + 3000);
  R.t.flight = Date.now() - t1;
  R.shownEnd = shown(); R.postedEnd = stepsNow();
  R.phaseEnd = FP.ap().phase;
  if (SW) { const s = SW.state(); R.simw = { phase: s.phase, reason: s.reason, placeOk: s.placeOk, placeDiff: s.placeDiff, wvSent: s.wvSent, wvSeen: s.wvSeen, wvBad: s.wvBad,
    strays: s.strays, snaps: s.snaps, cmds: s.cmds, initMs: s.initMs, bootFetchMs: s.bootFetchMs, bootBytes: s.bootBytes, readyWaitFrames: s.readyWaitFrames, errors: s.errors, flights: s.flights, inline: s.inline }; }
  R.workers = P.workers();
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  R.mem = Math.round(process.memoryUsage().rss / 1048576);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
  process.exit(0);
}

// ============================================================ THE PARENT: two pages per build, compared
function runChild(mode, build, extra) {
  const out = path.join(os.tmpdir(), 'simwpage_' + process.pid + '_' + build + '_' + mode + (extra.fault ? '_' + extra.fault : '') + '.json');
  const a = [__filename, '--child=' + mode, '--build=' + build, '--out=' + out, '--secs=' + extra.secs];
  if (extra.fault) a.push('--fault=' + extra.fault);
  const w0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: 'child ' + mode + ' ' + build + ' exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
  R.wallS = (Date.now() - w0) / 1000;
  return R;
}
function compare(A, B, say) {
  const res = { fails: [], stepsCompared: 0, framesCompared: 0 };
  const bad = m => res.fails.push(m);
  if (A.failed) { bad(A.failed); return res; }
  if (B.failed) { bad(B.failed); return res; }
  // 1 every step both reached
  const ka = Object.keys(A.steps).map(Number), kb = new Set(Object.keys(B.steps).map(Number));
  let first = null;
  for (const k of ka.sort((x, y) => x - y)) {
    if (!kb.has(k)) continue;
    res.stepsCompared++;
    const a = A.steps[k], b = B.steps[k];
    const what = [];
    if (a[0] !== b[0]) what.push('p'); if (a[1] !== b[1]) what.push('v'); if (a[2] !== b[2]) what.push('CG'); if (a[3] !== b[3]) what.push('phase ' + a[3] + '/' + b[3]);
    if (what.length && first == null) first = { k, what };
  }
  // the worker publishes once a frame (lockstep: after the frame's 2 steps) - every published step is compared
  const want = [...kb].filter(k => k <= A.shownEnd).length;
  say('  steps compared ' + res.stepsCompared + ' of the ' + want + ' simw published (inline reached ' + A.shownEnd + ', simw showed ' + B.shownEnd + ', posted ' + B.postedEnd + ')');
  if (res.stepsCompared < want || want < 0.4 * A.shownEnd) bad('only ' + res.stepsCompared + ' of ' + want + ' published steps seen in both runs');
  if (first) bad('step ' + first.k + ' differs: ' + first.what.join(', '));
  // 2 the page's reads, frame by frame, at the step shown
  const byStep = new Map(A.frames.map(r => [r[0], r]));
  let fFirst = null;
  // inline shows every other step at 2x; its reads at step k are the same numbers the simw mirror shows at k
  for (const r of B.frames) {
    const a = byStep.get(r[0]);
    if (!a) continue;
    res.framesCompared++;
    const what = [];
    if (a[1] !== r[1]) what.push('cgPos'); if (a[2] !== r[2]) what.push('axes'); if (a[3] !== r[3]) what.push('bodyOrigin'); if (a[4] !== r[4]) what.push('phase ' + a[4] + '/' + r[4]);
    if (what.length && !fFirst) fFirst = { k: r[0], what };
  }
  say('  page reads compared on ' + res.framesCompared + ' frames (simw ' + B.frames.length + ' rows, inline ' + A.frames.length + ')');
  if (res.framesCompared < 0.8 * B.frames.length) bad('page reads: only ' + res.framesCompared + ' of ' + B.frames.length + ' simw frames matched an inline step');
  if (fFirst) bad('page reads at step ' + fFirst.k + ' differ: ' + fFirst.what.join(', '));
  // 3 the main thread's solver
  say('  main-thread solver steps in flight: inline ' + A.mainStepsFlight + ', simw ' + B.mainStepsFlight + ' (strays ' + (B.simw ? B.simw.strays : '?') + ')');
  for (const X of [A, B]) if (X.otherSteps) say('  (' + X.mode + ': ' + X.otherSteps + ' steps of OTHER sims on the page - not the flight: ' + Object.keys(X.otherWho).slice(0, 3).join(' | ') + ')');
  if (!(A.mainStepsFlight > 0)) bad('the inline run counted no solver step (the counter is blind)');
  if (B.mainStepsFlight !== 0) bad('the page stepped a solver ' + B.mainStepsFlight + ' times under simw');
  if (!B.simw) bad('no FLYDIY_SIMW under ?simw=1');
  else {
    const s = B.simw;
    if (s.strays !== 0) bad(s.strays + ' stray sim.step() call(s) on the page under simw');
    // 4 the flight, the placement, the world
    say('  simw: phase ' + s.phase + ', placement ' + s.placeOk + (s.placeDiff ? ' (' + s.placeDiff + ')' : '') + ', world version sent ' + s.wvSent + ' seen ' + s.wvSeen + ', wvBad ' + s.wvBad +
        ', snapshots ' + s.snaps + ', commands ' + s.cmds + ', init ' + (s.initMs != null ? s.initMs.toFixed(0) : '?') + ' ms (boot fetch ' + (s.bootFetchMs != null ? s.bootFetchMs.toFixed(0) : '?') + ' ms, ' +
        (s.bootBytes / 1048576).toFixed(1) + ' MiB), held ' + s.readyWaitFrames + ' frames for it');
    if (s.placeOk !== true) bad('the placement check: ' + s.placeOk + ' ' + (s.placeDiff || s.reason || ''));
    if (s.phase !== 'live') bad('the simw flight is ' + s.phase + (s.reason ? ' (' + s.reason + ')' : ''));
    if (s.wvBad) bad('the world-version assertion tripped ' + s.wvBad + ' time(s)');
    if (!(s.wvSeen > 0)) bad('the worker world never took an obstacle from the page (version ' + s.wvSeen + ')');
    if (s.errors && s.errors.length) bad('simw errors: ' + s.errors.join(' | '));
  }
  // 5 errors
  for (const X of [A, B]) {
    if (X.errors.length) bad(X.mode + ' page errors: ' + X.errors.slice(0, 3).join(' | '));
    for (const w of X.workers || []) if (w.errors && w.errors.length) bad(X.mode + ' worker errors: ' + w.errors.slice(0, 3).join(' | '));
  }
  say('  phases: inline ends ' + A.phaseEnd + ', simw ends ' + B.phaseEnd + '; wall: inline ' + A.wallS.toFixed(0) + ' s (roll-out ' + (A.t.rollout / 1000).toFixed(0) + ' s, flight ' + (A.t.flight / 1000).toFixed(0) +
      ' s), simw ' + B.wallS.toFixed(0) + ' s (roll-out ' + (B.t.rollout / 1000).toFixed(0) + ' s, flight ' + (B.t.flight / 1000).toFixed(0) + ' s); rss ' + A.mem + ' / ' + B.mem + ' MB');
  return res;
}

function main() {
  const SELF = argv.includes('--selftest');
  const builds = (arg('builds', 'cub,cessna')).split(',').filter(b => b in BUILDS);
  const secs = +arg('secs', SELF ? 8 : 40);
  const log = [];
  const say = s => { log.push(s); console.log(s); };
  let fails = 0;
  const all = {};
  if (!SELF) {
    for (const b of builds) {
      say('== ' + b + ': inline vs ?simw=1, ' + secs + ' s of flight from the roll-out at ' + RATE + 'x');
      const A = runChild('inline', b, { secs }), B = runChild('simw', b, { secs });
      all[b] = { inline: A, simw: B };
      const r = compare(A, B, say);
      for (const f of r.fails) say('  FAIL ' + f);
      if (!r.fails.length) say('  ok   ' + b + ': ' + r.stepsCompared + ' steps and ' + r.framesCompared + ' frames bit-identical, 0 solver steps on the page');
      fails += r.fails.length;
    }
  } else {
    // one inline reference, then each fault under simw must be caught
    say('== selftest (cub, ' + secs + ' s)');
    const A = runChild('inline', 'cub', { secs });
    for (const fault of ['late', 'stray', 'noobst']) {
      const B = runChild('simw', 'cub', { secs, fault });
      const r = compare(A, B, () => {});
      const caught = r.fails.length > 0;
      say('  ' + (caught ? 'ok   ' : 'FAIL ') + 'fault ' + fault + ': ' + (caught ? 'caught - ' + r.fails[0] : 'NOT caught'));
      if (!caught) fails++;
    }
  }
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(all));
  console.log('GATE SIMWORKER-PAGE: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}

if (arg('child')) child().catch(e => { console.error(e && e.stack || e); process.exit(2); });
else main();
