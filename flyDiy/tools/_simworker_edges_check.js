#!/usr/bin/env node
// GATE SIMWORKER-EDGES - EVERY EDGE OF A FLIGHT, FLOWN INLINE AND THROUGH THE PHYSICS WORKER, TO THE BIT (G821, C1c).
//
//   node tools/_simworker_edges_check.js                -> "GATE SIMWORKER-EDGES: PASS|FAIL"
//   --builds=cub,cessna   --json=<file> (both runs' records)   --only=<event,...> (a shorter script, for triage)
//   --realtime   THE REAL-TIME SMOKE instead: ?simw=1&pace=1 (G586's live clock forced in the harness: the page's clock
//                virtual, the worker's real - nothing to compare to the bit), the same script; asserted: every flight
//                placed and live, the pause exact (the worker's step unchanged over the paused frames), the world probe
//                after the edit equal, the divergence's card, no error
//
// THE PAGE ITSELF IN NODE (tools/_page_node.js), twice per build, ONE PROCESS AT A TIME (~3.6-4 GB each):
//   INLINE  dev.html?simw=0 - the loop's `script(1/60); sim.step(1/60)` on the page's thread;
//   SIMW    dev.html?simw=1 - the solver and the pilot in src/viewer/sim_host.js on a real thread (the harness's
//           Worker shim, G815), the page's step block posting its inputs (sim_link.js), LOCKSTEP (the rig clock).
// Both run THE SAME SCRIPT of the player's doors, each fired at the same STEP of the session (the steps the flight
// took, summed over every flight of the page - inline counts the solver's steps, simw the steps posted), so both
// modes act at the same step boundary whatever frames the worker held for (a new flight waits one frame for its
// init). The script, in order (the Cub at 2x; the steps are the session's):
//   rollout   the boot, Roll out (#bGo), the roll-out trip done (B8B9: no screen when nothing is new), the flight
//             started by the roll-out's own callback;
//   pause     #bPause (the worker's clock stops), 30 frames, #bPause again;
//   manual    the hand on (FLIGHT_PROBE.setManual(true): INP.seed reads the levers the pilot left), 300 steps of the
//             hand's neutral, the hand off (ap.reEngage with resyncPhase);
//   edit      THE WORLD EDITOR'S EDIT, as the editor makes it (the sim held, running = false): the premises record's
//             first object moved 4 m, R.setRecord + R.rebuild(null) - the page world recomposed (world.premises.set),
//             its houses and props re-registered (hitAdd / remove); simw: the worker's world probed against the page's
//             (the ground over the island, grid 64, the surface, the obstacles near the edit and near the aeroplane);
//   flyon     Fly on's chain (FLIGHT_PROBE.nextLeg = app.js nextLeg: a fresh pilot departing from here, NO reset);
//   skip      #bSkip - the skip to line-up (placeLinedUp: two resets, the pose asked of a pilot on the stand, the
//             engine running, the pilot handed the HOLD) - a new flight;
//   manualAir the hand on and off again 300 steps later (the take-off's roll and climb: manualEnding's air state);
//   scenery   SCENERY.enter() (the solver held, started = false), 30 frames, SCENERY.leave(), #bGo (the start);
//   restart   #bReset (fullReset: a new flight on the stand, held) then #bGo;
//   shed      #bHangar2 (the trip back: enterGarage, the reset), 60 frames of the shed - THE CONTROL SWEEP (sim.ctl's
//             de / da / dr / flap written every frame on the page's OWN sim: under simw the mirror is down, nothing is
//             posted), then #bGo (the roll-out trip: the aircraft's steps skipped, the stand, the world kept);
//   diverge   sim.impulse(0, 1e300, ...) - G130: the flight diverged (the card, G1800 'sim-diverged', SIM DIVERGED); simw: the
//             worker's snapshot flag read every frame.
// ASSERTED, per build:
//   1 every step both runs reached, flight by flight (a flight = the steps between two resets): p, v, CG FNV and the
//     pilot's phase BIT-IDENTICAL, up to the divergence (the first difference named, with the event before it);
//   2 every frame row of SIMW (the page's own reads at the step shown: cgPos, axes, bodyOrigin, ap.phase) equal to
//     INLINE's at that step of that flight;
//   3 every event fired at the same session step in both runs, and did what it does in both (the skip took, Fly on made
//     a new pilot, the phase after the hand, the ending's outcome);
//   4 the shed's control sweep: the levers the stand wrote, frame by frame, equal in both runs - and under simw no
//     command posted in the shed (the page's own sim, not stepping) and FLYDIY_SIMW not live there;
//   5 the page stepped NO solver during the simw flights (the flights' sims: makeSim's step wrapped), strays 0, every
//     simw flight placed (the placement check) and live, wvBad 0, the world probe after the edit equal;
//   6 no page or worker error.
// DIFFERENCES NAMED, NOT HIDDEN (none of them positions, attitudes or phases): the card for a divergence comes up the
// first frame the worker's flag is seen (inline: the 30th-frame watchdog, up to 29 frames later) - the steps after
// the divergence are NaN in both and not compared; the trace (record(), 10 Hz) samples once a frame under simw.
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

// THE SCRIPT: [event, the session step it fires at (the steps summed over the flights so far)]
const SCRIPT = [
  ['pause', 600], ['manual', 900], ['manualOff', 1200], ['edit', 1500], ['flyon', 1650], ['skip', 1800],
  ['manualAir', 2800], ['manualAirOff', 3100], ['scenery', 3400], ['restart', 3700], ['shed', 4000], ['diverge', 4600], ['end', 4800],
];

// ============================================================ THE CHILD: one page, one mode
async function child() {
  const mode = arg('child'), build = arg('build', 'cub'), out = arg('out');
  const only = arg('only', '') ? arg('only').split(',') : null;
  const script = SCRIPT.filter(e => !only || only.includes(e[0]) || e[0] === 'end');
  const { openPage } = require('./_page_node.js');
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  const S = SH.SIM_SNAP;
  const storage = {};
  if (BUILDS[build]) storage['flydiy.wip'] = fs.readFileSync(path.join(ROOT, BUILDS[build]), 'utf8');
  const R = { mode, build, flights: [], frames: [], events: [], sweep: [], shedPosts: null, mainStepsFlight: 0, otherSteps: 0, errors: [], t: {}, probe: null };
  let rec = false, FP = null, W = null;
  // THE FLIGHTS: inline - every reset of a sim that stepped closes the flight; simw - every worker flight ('ready')
  let cur = null;
  const newFlight = why => { if (cur && !Object.keys(cur.steps).length && !cur.frames.length) { cur.why = why; return; } cur = { why, steps: {}, n: 0, frames: [] }; R.flights.push(cur); };
  let sessionBase = 0;          // simw: the steps of the flights before this one
  // SIMWE_DUMP=flight:from:to (triage): the levers, the engines and the pilot's small fields at those steps of that flight
  const DUMP = (process.env.SIMWE_DUMP || '').split(',').filter(Boolean).map(w => w.split(':').map(Number));
  const dumpAt = k => DUMP.some(D => D.length === 3 && R.flights.length - 1 === D[0] && k >= D[1] && k <= D[2]);
  const apSmall = ap => { const o = {}; for (const k of Object.keys(ap)) { const v = ap[k]; if (v == null || typeof v !== 'object') { if (typeof v !== 'function') o[k] = v; } } return o; };
  R.dump = {};
  const t0 = Date.now();
  const hooks = {
    beforeScript(name, P) {
      if (name !== 'src/viewer/app.js') return;
      const Wn = P.win, mk = Wn.makeSim;
      Wn.makeSim = function () {
        const sim = mk.apply(this, arguments), st = sim.step, rs = sim.reset;
        sim.reset = function () { if (rec && mode === 'inline' && FP && sim === FP.sim() && cur && cur.n > 0) newFlight('reset'); return rs.apply(this, arguments); };
        sim.step = function () {
          const r = st.apply(this, arguments);
          if (!rec) return r;
          if (!FP || sim !== FP.sim()) { R.otherSteps++; return r; }
          R.mainStepsFlight++;
          if (mode === 'inline') {
            cur.n++;
            const cg = new Float64Array(sim.cgPos());
            cur.steps[cur.n] = [fnv(2166136261, sim.p), fnv(2166136261, sim.v), fnv(2166136261, cg), FP.ap().phase, Number.isFinite(sim.p[1])];
            if (dumpAt(cur.n)) R.dump[cur.n] = JSON.parse(JSON.stringify({ ctl: sim.ctl, eng: sim.eng, ap: SH.simHostPlain(FP.ap(), 4, ['nav', 'sheet', 'route', 'legs', 'path', 'plan', 'taxiOut', 'site', 'report']), out: SH.simHostPlain(sim.out, 3, ['hydro']), p0: Array.from(sim.p.slice(0, 6)) }));
          }
          return r;
        };
        return sim;
      };
    },
  };
  // the worker's snapshots and its flights, seen before the page takes them
  let epochReady = false;
  const tap = (w, m) => {
    if (!rec || !m) return;
    if (m.kind === 'ready') { newFlight('worker init'); epochReady = true; return; }
    if (m.kind === 'log') { R.hostLog = (m.list || []).filter(e => e.c && !/^(ctl|windq|obst|release|steps)$/.test(e.c.cmd)).map(e => [e.k, e.c.k, e.c.cmd, e.c.on]).slice(-60); return; }
    if (m.kind !== 'snap' || !epochReady) return;
    const f = new Float64Array(m.buf), n = f[S.N], n3 = 3 * n;
    const k = f[S.STEP];
    if (k < 1 || !cur) return;
    const p = f.subarray(S.HEAD, S.HEAD + n3), v = f.subarray(S.HEAD + n3, S.HEAD + 2 * n3), cg = f.subarray(S.CG, S.CG + 3);
    const ph = m.meta && m.meta.ap && m.meta.ap.phase;
    cur.steps[k] = [fnv(2166136261, p), fnv(2166136261, v), fnv(2166136261, cg), ph != null ? ph : (cur.steps[k - 1] ? cur.steps[k - 1][3] : null), Number.isFinite(p[1])];
    if (k > cur.n) cur.n = k;
    if (dumpAt(k)) R.dump[k] = JSON.parse(JSON.stringify({ ctl: m.meta.ctl, eng: m.meta.eng, ap: m.meta.ap, out: m.meta.out, p0: Array.from(p.slice(0, 6)) }));
  };
  const RT = mode === 'rt';
  const P = await openPage({ quiet: true, storage, hooks, query: mode === 'simw' ? 'simw=1' : RT ? 'simw=1&pace=1' : 'simw=0', workers: /sim_host\.js/, onWorkerMessage: tap });
  W = P.win;
  const doc = W.document, $ = id => doc.getElementById(id);
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  R.t.garage = Date.now() - t0;
  FP = W.FLIGHT_PROBE;
  const SW = W.FLYDIY_SIMW || null;
  const tripDone = kind => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === kind && t.done && W.BOOT.state === 'gone'); };
  const tripN = () => (W.FLYDIY_TRIPS || []).length;
  // (a tree before B8B9 has no FLYDIY_TRIPS: its roll-out and roll-in each show a screen - up, then gone - and end in
  // the world or in the shed)
  const inShedNow = () => !!(doc.body && doc.body.classList && doc.body.classList.contains('mode-ws'));
  const trip = async (kind, press) => {
    if (W.FLYDIY_TRIPS) { const n0 = tripN(); press(); await P.until(() => tripN() > n0 && tripDone(kind), 900000); return; }
    press();
    for (let i = 0; i < 30 && W.BOOT.state === 'gone'; i++) await P.frames(1);
    await P.until(() => W.BOOT.state === 'gone' && (kind === 'rollin' ? inShedNow() : !inShedNow()), 900000);
  };
  // THE SAME FRAMES IN THE SHED IN BOTH RUNS: the day advances with the shed's frames (DAY_CLOCK.tick(fdt)) and the
  // stand's control sweep with its clock - a run that waited longer in the shed would fly another afternoon. 240 frames
  // (the worker makes its world meanwhile, on its own thread; a flight asked before it is ready waits for it)
  await P.frames(240);
  R.worldMs = SW ? SW.state().worldMs : null;
  rec = true; newFlight('roll-out');
  await trip('rollout', () => $('bGo').click());
  R.t.rollout = Date.now() - t0 - R.t.garage;
  const RD = FP.renderer();
  RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  W.TEST_FLIGHT.rate(RATE);
  // the session's step: the steps every flight took so far (simw: posted)
  let lastFlights = SW ? SW.state().flights : 0, lastPosted = 0;
  const sess = () => {
    if (mode === 'inline') return R.flights.reduce((a, f) => a + f.n, 0);
    const s = SW.state();
    if (s.flights !== lastFlights) { sessionBase += lastPosted; lastFlights = s.flights; lastPosted = 0; }
    lastPosted = RT ? s.lastStep : s.stepsPosted;   // (real time: the worker's clock posts no step count - the steps shown)
    return sessionBase + lastPosted;
  };
  const shown = () => (mode !== 'inline' ? SW.state().lastStep : (cur ? cur.n : 0));
  let lastShown = -1, inShed = false;
  P.onFrame(ph => {
    if (ph !== 'end' || !rec) return;
    sess();
    if (inShed) { const c = FP.sim().ctl; R.sweep.push(hx([c.de, c.da, c.dr, c.flap])); return; }
    const k = shown();
    if (k > 0 && k !== lastShown && cur && (mode === 'inline' || SW.live())) {   // (simw: the flight's frames - not the shed's after it)
      lastShown = k;
      const sim = FP.sim(), ap = FP.ap();
      cur.frames.push([k, hx(sim.cgPos()), hx([].concat(...sim.axes())), hx(sim.bodyOrigin()), ap.phase]);
    }
  });
  const until = async (cond, maxFrames) => { for (let i = 0; i < maxFrames && !cond(); i++) await P.frames(1); return cond(); };
  const ev = (name, extra) => { const e = Object.assign({ name, at: sess(), flight: R.flights.length - 1, phase: FP.ap().phase, over: FP.over() }, extra || {}); R.events.push(e); return e; };
  const cmdCount = () => { let n = 0; for (const w of P.workers()) n += w.posted || 0; return n; };
  for (const [name, at] of script) {
    const ok = await until(() => sess() >= at || FP.over(), 20000);
    await P.settleWorkers();   // the worker's answer to the last frame landed, as it has in a browser long before a click
    if (!ok) { R.errors.push('event ' + name + ': the session never reached step ' + at + ' (at ' + sess() + ')'); break; }
    if (name === 'end') { ev('end'); if (SW && process.env.SIMWE_DUMP) { SW.log(); await P.settleWorkers(); await P.frames(1); } break; }
    if (FP.over() && name !== 'diverge') { R.errors.push('event ' + name + ': the flight ended before it (' + (FP.ap().report && FP.ap().report.outcome) + ')'); break; }
    if (name === 'pause') {
      ev('pause'); $('bPause').click(); lastShown = -1;
      await P.frames(2);
      const k0 = SW ? SW.state().lastStep : null;
      await P.frames(30);
      const e = ev('run'); e.stood = sess();
      if (SW) { e.pauseSteps = [k0, SW.state().lastStep]; e.workerRunning = SW.state().view && SW.state().view.running; }
      $('bPause').click();
    } else if (name === 'manual' || name === 'manualAir') {
      FP.setManual(true); ev(name, { manual: FP.manual() });
    } else if (name === 'manualOff' || name === 'manualAirOff') {
      FP.setManual(false); ev(name, { manual: FP.manual(), phaseAfter: FP.ap().phase });
    } else if (name === 'edit') {
      // as the editor does: the sim held (running = false) while the world recomposes, then the flight resumes
      $('bPause').click();
      const PR = W.WORLD && W.WORLD.premisesStart ? W.WORLD.premisesStart() : null;
      const e = ev('edit');
      if (!PR) { e.skipped = 'no premises renderer'; }
      else {
        const WP = FP.world().premises, F = WP.overlay && WP.overlay.frame;
        const rec0 = JSON.parse(JSON.stringify(WP.rec));
        const L = rec0.layers || {}, cg = FP.sim().cgPos();
        const O = (L.objects || []).filter(o => o && typeof o.x === 'number' && typeof o.z === 'number');
        // the object nearest the aeroplane (its obstacles and ground are what the flight could meet); the record's x / z
        // are in the premises' frame
        const wOf = o => (F ? F.toWorld(o.x, o.z) : [o.x, o.z]);
        O.sort((a, b) => { const A = wOf(a), B = wOf(b); return Math.hypot(A[0] - cg[0], A[1] - cg[2]) - Math.hypot(B[0] - cg[0], B[1] - cg[2]); });
        const o = O[0];
        if (!o) e.skipped = 'no object in the record';
        else {
          const [x0, z0] = wOf(o);
          o.x += 4;
          e.object = { id: o.id || null, kind: o.kind || o.gen || null, x0, z0, dist: Math.hypot(x0 - cg[0], z0 - cg[2]) };
          PR.setRecord(rec0); PR.rebuild(null);
          await P.frames(3);
          if (SW) {
            // the two worlds after the edit: the ground over the island, the surface, the obstacles near the object
            const pts = [[x0, 0, z0], [x0 + 4, 0, z0], [x0 + 2, 0, z0 + 3], [cg[0], cg[1], cg[2]], [cg[0] + 10, 0, cg[2] - 10]];
            const mine = SW.probe(pts, 0, 'edit', { grid: 64 });
            await until(() => SW.state().probe && SW.state().probe.tag === 'edit', 600);
            const theirs = SW.state().probe && SW.state().probe.facts;
            const d = [];
            if (!theirs) d.push('no probe back from the worker');
            else {
              for (const k of ['h', 's', 'r']) if (mine.grid && theirs.grid && mine.grid[k] !== theirs.grid[k]) d.push('grid ' + k);
              if (mine.obst && theirs.obst && mine.obst.n !== theirs.obst.n) d.push('obstacles ' + mine.obst.n + ' vs ' + theirs.obst.n);
              pts.forEach((q, i) => { const a = mine.pts[i], b = theirs.pts[i];
                if (!Object.is(a.h, b.h)) d.push('h@' + i); if (JSON.stringify(a.s) !== JSON.stringify(b.s)) d.push('surface@' + i);
                if ((a.ob || []).length !== (b.ob || []).length) d.push('near obstacles@' + i + ' ' + (a.ob || []).length + ' vs ' + (b.ob || []).length); });
            }
            R.probe = { diffs: d, obst: mine.obst, grid: mine.grid, edits: SW.state().premEdits };
          }
        }
      }
      $('bPause').click();
    } else if (name === 'flyon') {
      const ap0 = FP.ap();
      const did = FP.nextLeg();
      ev('flyon', { did, newPilot: FP.ap() !== ap0, phaseAfter: FP.ap().phase });
    } else if (name === 'skip') {
      const b = $('bSkip');
      const e = ev('skip', { disabled: !!(b && b.disabled), hidden: !!(b && b.hidden) });
      if (b && !b.disabled) b.click();
      e.took = !!(W.FLIGHT_PROBE && FP.ap() && FP.ap().phase);
      e.phaseAfter = FP.ap().phase;
    } else if (name === 'scenery') {
      ev('scenery'); W.SCENERY.enter(); await P.frames(30); W.SCENERY.leave();
      $('bGo').click(); ev('sceneryLeft', { started: true });
    } else if (name === 'restart') {
      // (the new flight held for 4 steps - its brake - then started: keyed on steps, as the worker's flight waits a frame for its init)
      ev('restart'); $('bReset').click(); const s0 = sess(); await until(() => sess() >= s0 + 4, 50); $('bGo').click(); ev('restarted');
    } else if (name === 'shed') {
      ev('shed');
      await trip('rollin', () => $('bHangar2').click());
      inShed = true;
      const c0 = cmdCount(), s0 = SW ? SW.state() : null;
      if (SW) R.shedAt = { phase: s0.phase, flights: s0.flights, lastStep: s0.lastStep, flight: s0.flight, boot: W.BOOT.state, set: W.BOOT.set, ws: inShedNow(), ap: FP.ap().phase };
      await P.frames(60);
      R.shedPosts = SW ? { commands: cmdCount() - c0, live: SW.live(), batches: SW.state().batches - s0.batches, stepsPosted: SW.state().stepsPosted } : null;
      inShed = false;
      await trip('rollout', () => $('bGo').click());
      ev('rolledOut');
    } else if (name === 'diverge') {
      ev('diverge');
      FP.sim().impulse(0, 1e300, 1e300, 1e300);
      await until(() => FP.over(), 200);
      ev('diverged', { outcome: FP.ap().report && FP.ap().report.outcome, card: $('phName') ? $('phName').textContent : null });
      break;
    }
  }
  R.phaseEnd = FP.ap().phase;
  if (SW) { const s = SW.state(); R.simw = { phase: s.phase, reason: s.reason, placeOk: s.placeOk, placeDiff: s.placeDiff, wvSent: s.wvSent, wvSeen: s.wvSeen, wvBad: s.wvBad,
    strays: s.strays, snaps: s.snaps, cmds: s.cmds, flights: s.flights, inline: s.inline, legs: s.legs, premEdits: s.premEdits, errors: s.errors, dead: s.dead, prewarmed: s.prewarmed, worldMs: s.worldMs }; }
  R.workers = P.workers();
  R.errors = R.errors.concat(P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20));
  R.mem = Math.round(process.memoryUsage().rss / 1048576);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
  process.exit(0);
}

// ============================================================ THE PARENT
function runChild(mode, build, extra) {
  // SIMWE_KEEP=<dir> (triage): each child's record kept there, and an INLINE one found there reused (the inline run does
  // not change while the worker's side is worked on - delete the file when app.js or the script changes)
  const keep = process.env.SIMWE_KEEP ? path.join(process.env.SIMWE_KEEP, build + '_' + mode + (extra.only ? '_' + extra.only.replace(/,/g, '+') : '') + '.json') : null;
  if (keep && mode === 'inline' && fs.existsSync(keep)) { console.log('  (the inline record reused: ' + keep + ')'); return JSON.parse(fs.readFileSync(keep, 'utf8')); }
  const out = path.join(os.tmpdir(), 'simwedges_' + process.pid + '_' + build + '_' + mode + '.json');
  const a = [__filename, '--child=' + mode, '--build=' + build, '--out=' + out];
  if (extra.only) a.push('--only=' + extra.only);
  const w0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: 'child ' + mode + ' ' + build + ' exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
  R.wallS = (Date.now() - w0) / 1000;
  if (keep) { try { fs.mkdirSync(path.dirname(keep), { recursive: true }); fs.writeFileSync(keep, JSON.stringify(R)); } catch (e) {} }
  return R;
}
function compare(A, B, say) {
  const res = { fails: [], steps: 0, frames: 0 };
  const bad = m => res.fails.push(m);
  if (A.failed) { bad(A.failed); return res; }
  if (B.failed) { bad(B.failed); return res; }
  const FA = A.flights.filter(f => f.n > 0), FB = B.flights.filter(f => f.n > 0);
  say('  flights: inline ' + FA.map(f => f.n).join(' / ') + ' steps; simw ' + FB.map(f => f.n).join(' / '));
  if (FA.length !== FB.length) bad('flights: inline ' + FA.length + ', simw ' + FB.length);
  // the event before a session step (for a difference's name)
  const evAt = (R, fi, k) => { let base = 0; for (let i = 0; i < fi; i++) base += (R === A ? FA : FB)[i].n; const s = base + k; let e = null; for (const x of R.events) if (x.at <= s) e = x.name; return e; };
  for (let i = 0; i < Math.min(FA.length, FB.length); i++) {
    const a = FA[i], b = FB[i];
    let first = null, n = 0, nanFrom = null;
    const ks = Object.keys(b.steps).map(Number).sort((x, y) => x - y);
    for (const k of ks) {
      const x = a.steps[k], y = b.steps[k];
      if (!x) continue;
      if (!x[4] || !y[4]) { if (nanFrom == null) nanFrom = k; if (x[4] !== y[4] && !first) first = { k, what: ['finite ' + x[4] + '/' + y[4]] }; continue; }
      n++;
      const what = [];
      if (x[0] !== y[0]) what.push('p'); if (x[1] !== y[1]) what.push('v'); if (x[2] !== y[2]) what.push('CG'); if (x[3] !== y[3]) what.push('phase ' + x[3] + '/' + y[3]);
      if (what.length && !first) first = { k, what };
    }
    res.steps += n;
    const pub = ks.filter(k => k <= a.n).length;
    if (n + (nanFrom != null ? ks.filter(k => k >= nanFrom).length : 0) < pub) bad('flight ' + i + ': only ' + n + ' of ' + pub + ' published steps compared');
    if (first) bad('flight ' + i + ' (' + a.why + ') step ' + first.k + ' differs: ' + first.what.join(', ') + ' (after event ' + evAt(B, i, first.k) + ')');
    // the page's reads at the step shown
    const byStep = new Map(a.frames.map(r => [r[0], r]));
    let fFirst = null, fn = 0;
    for (const r of b.frames) {
      const q = byStep.get(r[0]); if (!q) continue;
      if (nanFrom != null && r[0] >= nanFrom) continue;
      fn++;
      const what = [];
      if (q[1] !== r[1]) what.push('cgPos'); if (q[2] !== r[2]) what.push('axes'); if (q[3] !== r[3]) what.push('bodyOrigin'); if (q[4] !== r[4]) what.push('phase ' + q[4] + '/' + r[4]);
      if (what.length && !fFirst) fFirst = { k: r[0], what };
    }
    res.frames += fn;
    if (fFirst) bad('flight ' + i + ' page reads at step ' + fFirst.k + ' differ: ' + fFirst.what.join(', '));
    say('    flight ' + i + ' (' + a.why + ' / ' + b.why + '): ' + n + ' steps' + (nanFrom != null ? ' (NaN from step ' + nanFrom + ': the divergence)' : '') + ', ' + fn + ' frames compared');
  }
  // 3 the events
  // (the divergence is SEEN at another step - named in the header: the worker's flag every frame, inline's 30th-frame watchdog)
  const ea = A.events.map(e => e.name + (e.name === 'diverged' ? '' : '@' + e.at)), eb = B.events.map(e => e.name + (e.name === 'diverged' ? '' : '@' + e.at));
  say('  events: ' + A.events.map(e => e.name + '@' + e.at + (e.phaseAfter ? '->' + e.phaseAfter : '') + (e.outcome ? '(' + e.outcome + ')' : '')).join(' '));
  if (ea.join() !== eb.join()) bad('events differ: inline ' + ea.join(' ') + ' | simw ' + eb.join(' '));
  for (let i = 0; i < Math.min(A.events.length, B.events.length); i++) {
    const x = A.events[i], y = B.events[i];
    for (const k of ['phase', 'phaseAfter', 'newPilot', 'outcome', 'card', 'manual', 'disabled', 'over'])
      if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) bad('event ' + x.name + ': ' + k + ' ' + JSON.stringify(x[k]) + ' vs ' + JSON.stringify(y[k]));
  }
  const want = { flyon: e => e.newPilot === true, skip: e => e.disabled === false, diverged: e => e.outcome === 'sim-diverged' };
  for (const e of A.events) if (want[e.name] && !want[e.name](e)) bad('event ' + e.name + ' did not do its thing: ' + JSON.stringify(e));
  // 4 the shed's sweep
  if (A.sweep.length || B.sweep.length) {
    const same = A.sweep.length === B.sweep.length && A.sweep.every((x, i) => x === B.sweep[i]);
    const moved = new Set(A.sweep).size > 1;
    say('  the shed: ' + A.sweep.length + ' / ' + B.sweep.length + ' frames of the control sweep, ' + (same ? 'equal' : 'DIFFERENT') + ', the levers ' + (moved ? 'moving' : 'STILL') +
        (B.shedPosts ? '; simw in the shed: ' + B.shedPosts.commands + ' commands posted, live ' + B.shedPosts.live + ', ' + B.shedPosts.batches + ' step batches' : ''));
    if (!same) bad('the shed\'s control sweep differs');
    if (!moved) bad('the shed\'s control sweep did not move the levers');
    if (B.shedPosts && (B.shedPosts.live || B.shedPosts.batches)) bad('simw in the shed: live ' + B.shedPosts.live + ', ' + B.shedPosts.batches + ' step batches posted');
  }
  // 5 the main thread, the worker's flights, the world
  say('  main-thread solver steps in the flights: inline ' + A.mainStepsFlight + ', simw ' + B.mainStepsFlight + ' (other sims on the page: ' + A.otherSteps + ' / ' + B.otherSteps + ')');
  if (!(A.mainStepsFlight > 0)) bad('the inline run counted no solver step');
  if (B.mainStepsFlight !== 0) bad('the page stepped a flight\'s solver ' + B.mainStepsFlight + ' times under simw');
  if (!B.simw) bad('no FLYDIY_SIMW under ?simw=1');
  else {
    const s = B.simw;
    say('  simw: ' + s.flights + ' flights asked (' + s.inline + ' inline' + (s.reason ? ': ' + s.reason : '') + '), legs ' + s.legs + ', premises edits ' + s.premEdits + ', world version sent ' + s.wvSent + ' seen ' + s.wvSeen +
        ', wvBad ' + s.wvBad + ', strays ' + s.strays + ', the world made in the shed in ' + (s.worldMs != null ? s.worldMs.toFixed(0) + ' ms' : '?'));
    if (s.inline) bad(s.inline + ' flight(s) flown inline under simw: ' + s.reason);
    if (s.strays) bad(s.strays + ' stray sim.step() call(s) on the page');
    if (s.wvBad) bad('the world-version assertion tripped ' + s.wvBad + ' time(s)');
    if (s.errors && s.errors.length) bad('simw errors: ' + s.errors.join(' | '));
    if (!s.prewarmed) bad('the worker\'s world was not made in the shed (prewarm)');
  }
  if (B.probe) { say('  the worlds after the edit: ' + (B.probe.diffs.length ? 'DIFFERENT: ' + B.probe.diffs.join(', ') : 'equal (grid 64 h/s/r, obstacles ' + (B.probe.obst && B.probe.obst.n) + ', the points)') + ', edits ' + B.probe.edits);
    if (B.probe.diffs.length) bad('the worker\'s world after the edit: ' + B.probe.diffs.join(', '));
    if (!(B.probe.edits > 0)) bad('the edit never reached the worker'); }
  else if (B.events.some(e => e.name === 'edit' && !e.skipped)) bad('no world probe after the edit');
  for (const X of [A, B]) {
    if (X.errors.length) bad(X.mode + ' errors: ' + X.errors.slice(0, 3).join(' | '));
    for (const w of X.workers || []) if (w.errors && w.errors.length) bad(X.mode + ' worker errors: ' + w.errors.slice(0, 3).join(' | '));
  }
  say('  wall: inline ' + A.wallS.toFixed(0) + ' s, simw ' + B.wallS.toFixed(0) + ' s; rss ' + A.mem + ' / ' + B.mem + ' MB');
  return res;
}

// the real-time smoke: nothing to compare to the bit - the doors work on the worker's own clock
function smoke(B, say) {
  const fails = [], bad = m => fails.push(m);
  if (B.failed) { bad(B.failed); return fails; }
  const s = B.simw || {};
  say('  events: ' + B.events.map(e => e.name + '@' + e.at + (e.phaseAfter ? '->' + e.phaseAfter : '') + (e.outcome ? '(' + e.outcome + ')' : '') + (e.pauseSteps ? '[' + e.pauseSteps.join('->') + ']' : '')).join(' '));
  say('  simw: ' + s.flights + ' flights asked (' + s.inline + ' inline' + (s.reason ? ': ' + s.reason : '') + '), legs ' + s.legs + ', edits ' + s.premEdits + ', wvBad ' + s.wvBad + ', strays ' + s.strays + '; flights stepped ' + B.flights.filter(f => f.n > 0).map(f => f.n).join(' / '));
  if (s.inline) bad(s.inline + ' flight(s) flown inline: ' + s.reason);
  if (s.wvBad) bad('the world-version assertion tripped ' + s.wvBad + ' time(s)');
  if (s.strays) bad(s.strays + ' stray step(s)');
  if (B.mainStepsFlight !== 0) bad('the page stepped a flight\'s solver ' + B.mainStepsFlight + ' times');
  const pz = B.events.find(e => e.name === 'run');
  if (!pz || !pz.pauseSteps || pz.pauseSteps[0] !== pz.pauseSteps[1]) bad('the pause was not exact: ' + JSON.stringify(pz && pz.pauseSteps));
  const want = ['flyon', 'skip', 'rolledOut', 'diverged'];
  for (const w of want) if (!B.events.some(e => e.name === w)) bad('never reached ' + w);
  const dv = B.events.find(e => e.name === 'diverged'); if (dv && dv.outcome !== 'sim-diverged') bad('the divergence ended ' + dv.outcome);
  const fo = B.events.find(e => e.name === 'flyon'); if (fo && !fo.newPilot) bad('Fly on made no new pilot');
  if (B.probe && B.probe.diffs.length) bad('the worker\'s world after the edit: ' + B.probe.diffs.join(', '));
  if (B.shedPosts && (B.shedPosts.live || B.shedPosts.batches)) bad('in the shed: live ' + B.shedPosts.live + ', batches ' + B.shedPosts.batches);
  if (B.errors.length) bad('errors: ' + B.errors.slice(0, 3).join(' | '));
  for (const w of B.workers || []) if (w.errors && w.errors.length) bad('worker errors: ' + w.errors.slice(0, 3).join(' | '));
  say('  wall ' + B.wallS.toFixed(0) + ' s, rss ' + B.mem + ' MB');
  return fails;
}
function main() {
  const builds = (arg('builds', 'cub,cessna')).split(',').filter(b => b in BUILDS);
  if (argv.includes('--realtime')) {
    let n = 0;
    for (const b of builds) {
      console.log('== ' + b + ': the edges on the worker\'s real-time clock (?simw=1&pace=1)');
      const f = smoke(runChild('rt', b, { only: arg('only', '') }), s => console.log(s));
      for (const x of f) console.log('  FAIL ' + x);
      if (!f.length) console.log('  ok   ' + b + ': every door on the real-time clock');
      n += f.length;
    }
    console.log('GATE SIMWORKER-EDGES (real time): ' + (n ? 'FAIL (' + n + ')' : 'PASS'));
    process.exit(n ? 1 : 0);
  }
  const only = arg('only', '');
  const log = [], say = s => { log.push(s); console.log(s); };
  let fails = 0;
  const all = {};
  for (const b of builds) {
    say('== ' + b + ': the edges, inline vs ?simw=1 (lockstep, ' + RATE + 'x)' + (only ? ' - only ' + only : ''));
    const A = runChild('inline', b, { only }), B = runChild('simw', b, { only });
    all[b] = { inline: A, simw: B };
    const r = compare(A, B, say);
    for (const f of r.fails) say('  FAIL ' + f);
    if (!r.fails.length) say('  ok   ' + b + ': ' + r.steps + ' steps and ' + r.frames + ' frames bit-identical across every edge');
    fails += r.fails.length;
  }
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(all));
  console.log('GATE SIMWORKER-EDGES: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}

if (arg('child')) child().catch(e => { console.error(e && e.stack || e); process.exit(2); });
else main();
