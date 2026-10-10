#!/usr/bin/env node
// GATE SIMWORKER — THE SOLVER ON ITS OWN THREAD FLIES THE PAGE'S FLIGHT, TO THE BIT (G810).
//
//   node tools/_simworker_check.js              -> "GATE SIMWORKER: PASS|FAIL"
//   node tools/_simworker_check.js --selftest   -> negative verification
//   --steps=N (lockstep length, default 600)  --secs=S (the real-time run, default 3.5)
//
// futureDesigns/ARCH-2026-09-27.md §2.4: "the worker host driven by
// worker_threads in node with a scripted input list must produce the same FNV
// hash of p and v as the inline loop over N steps". Two sides, on Jolene with
// its premises, the build on HOME's stand and the pilot taxiing it out:
//
//   THE PAGE     this process, set up as the page is (the core's globals, the
//                cage's scripts, THREE stubbed - tools/physics_perf.js's
//                loadPanel), the WHOLE island boot, and the flight written
//                from app.js: applyRoute's placement, mkPilot, and loop()'s
//                `script(1/60); sim.step(1/60)` with the day ticked after;
//                the page's actions (a lever, ROLL, the manual hand, the key,
//                an impulse, the day) done the way app.js does them;
//   THE HOST     src/viewer/sim_host.js in a worker_threads Worker holding
//                the CORE ONLY (what the browser's Blob imports) and the
//                TRIMMED boot, driven through src/viewer/sim_view.js - the
//                same actions as the view's writes, stamped by step index.
//
//   1 THE BLOB   simHostSource's worker script run in a worker-like global
//                (importScripts reading the files it names) flies 120 steps
//                of the analytic world to the page's bits - the browser's
//                glue, CORE picked out of the imported bundle. First, because a
//                premises world writes the process's AIRFIELD_SITES
//                (20_world.js) and this flight reads the analytic HOME.
//   1b THE STALL (G1365, SIM-STALL) the same Blob's host on a FAKE clock: a 60 Hz
//                page beating once a frame (sim_view.js frame), then 60 s with
//                no frame drawn, then the page back - the host holds
//                SIM_HOST_STALL_MS past the last beat (the aeroplane < 3 m from
//                where the page last drew it, 216 m unheld) and goes on from
//                there at real time, the lost wall time not owed. And in 3,
//                on the real thread: a 1.5 s page freeze held, the replay
//                running through it to the bit.
//   2 LOCKSTEP   the stock build and the metal Cessna, N steps: every step's
//                FNV of p and v equal, and at the end the view's reads (p,
//                cgPos, cgVel, axes, bodyOrigin, totalM, wheels, out, fuel,
//                eng, the pilot's phase and clock) equal the page's sim's;
//                the world-version counter moved with the day.
//   3 REAL TIME  the host on its own clock for S seconds against a synthetic
//                60 Hz render loop, the actions sent UNSTAMPED at wall
//                moments; then its applied-command LOG replayed on the page's
//                inline loop reproduces every published snapshot to the bit
//                (ARCH §2.4's replay point). PRINTED: the transport round
//                trip, a snapshot's one-way latency, the pose age, the
//                view's cost on the render thread, the host's step ms and
//                dilation, the buffers allocated once the pool is warm.
//   4 THE BOOT   the trimmed boot fetched the page's way (simHostFetchBoot:
//                the manifest, gzip through DecompressionStream) equals
//                simHostTrimBoot(island_node's) byte for byte - as it was
//                BEFORE the page's world stamped it (27_premises.js
//                stampTtype writes ttype and cover in place: the host must
//                never be handed a boot a world was made on) - and carries
//                no albedo / tint / ori1 / ndvi / far tree; its size printed.
//   5 THE BUILD  tools/build.js's MANIFEST carries sim_host.js and
//                sim_view.js, index.html publishes SIM_HOST and SIM_VIEW.
//
// NEGATIVE-VERIFIED (--selftest): the page's loop with the impulse one step
// late, with the day not ticked, and with the step before the script must
// each be caught against the host's hashes.
'use strict';
const { Worker, isMainThread, parentPort } = require('worker_threads');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

// ---- THE HOST'S THREAD: the core and the host, nothing of the page
if (!isMainThread) {
  const CORE = require(path.join(ROOT, 'tools', 'flight_core.js'));
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  SH.simHostBody(CORE, SH, { post: (m, tr) => parentPort.postMessage(m, tr || []), on: f => parentPort.on('message', f),
                             close: () => parentPort.close() });
  return;
}

const argv = process.argv.slice(2);
const SELF = argv.includes('--selftest');
const argN = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const N = argN('steps', 600), SECS = argN('secs', 3.5), RENDER_MS = 8;
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const wallNow = () => performance.timeOrigin + performance.now();
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const f3 = x => (x == null || !isFinite(x) ? String(x) : x.toFixed(3));
const fnv = (...arrs) => {
  let h = 2166136261;
  for (const a of arrs) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; }
  return h;
};
const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false; return true; };

// ---- THE PAGE: the core's globals and the cage's scripts, as physics_perf.js loadPanel sets them
const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
for (const k of Object.keys(C)) global[k] = C[k];
{
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(__dirname, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(__dirname, '_cage_join.js')).CAGE_JOIN_ENGINES;
}
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
const IN = require(path.join(__dirname, 'island_node.js'));

// THE PAGE'S FLIGHT, inline: app.js applyRoute + mkPilot + loop()'s step block + the page's actions
function pageFlight(world, spec, opt) {
  opt = opt || {};
  const def = buildGen(spec), sim = makeSim(def, world);
  let flNav = null;
  const mkPilot = () => {                                  // app.js mkPilot ('auto': the pilot, normal style)
    const p = makePilot(sim, def, world, { style: 'normal', shakedown: () => null });
    if (!flNav) flNav = navMake({ waypoints: world.aerodromes });
    p.setNav(flNav);
    return p;
  };
  const aeroById = id => world.aerodromes.find(a => a.id === id) || world.aerodromes[0];
  function applyRoute() {                                   // app.js applyRoute, HOME, the circuit, the stand
    const from = aeroById('HOME'), to = from;
    if (typeof sim.stance === 'function') sim.stance();
    const st = siteOf(from.id);
    const stand = st ? st.stand : null;
    if (stand) { placeAtStand(sim, from, stand); ap.setRoute(from, to); ap.departFrom(from, to, st); }
    else { placeAtAerodrome(sim, from); ap.setRoute(from, to); }
  }
  sim.reset(0);
  let ap = mkPilot();
  applyRoute();
  let started = false, manual = false, hand = null;
  const GROUND = ['DEPART', 'TAXI', 'LINEUP', 'HOLD', 'STOP', 'ROLL', 'LIFTOFF', 'ROLLOUT', 'STOPPED', 'ABORT', 'PUTDOWN'];
  function resyncPhase() {                                  // app.js resyncPhase
    const onG = sim.wheelsOnGround(), cg = sim.cgPos(), v = sim.cgVel();
    const agl = cg[1] - world.terrainH(cg[0], cg[2]);
    const Vg = Math.hypot(v[0], v[2]);
    const wasGround = GROUND.indexOf(ap.phase) >= 0;
    if (onG === 0 && agl > 10 && wasGround) return 'CLIMB';
    if (onG >= 2 && Vg < 15 && !wasGround) return 'ROLLOUT';
    return ap.phase;
  }
  const F = { def, sim, world, steps: 0, get ap() { return ap; } };
  F.act = {                                                 // what the page's buttons, keys and cockpit do
    ctl: sim.ctl,
    set starterOk(f) { sim.starterOk = f; },                // cockpit.js: the bus's word, permanent
    start() { started = true; },
    hold() { started = false; },
    manual(on) {                                            // app.js setManual, less the UI
      if (on === manual) return;
      manual = on;
      if (!on) { ap.reEngage({ phase: resyncPhase() }); if (ap.budget) ap.budget = Math.max(ap.budget, ap.t + 300); }
    },
    hand(h) { hand = h; },                                  // INP's state; INP.write puts it on the levers each step
    setEngine(i, patch) { sim.setEngine(i, patch); },
    impulse(i, ix, iy, iz) { sim.impulse(i, ix, iy, iz); },
    setDay(o) { world.setDay(o); },
    reset() { sim.reset(0); ap = mkPilot(); applyRoute(); started = false; },
  };
  function script(dt) {                                     // app.js script(), its non-UI lines
    if (!started) { sim.ctl.brake = 0.6; return; }
    if (manual) {
      if (hand) for (const k of ['de', 'da', 'dr', 'thr', 'brake', 'flap']) if (hand[k] != null) sim.ctl[k] = hand[k];
      if (ap.box && ap.box.on) ap.update(dt); else ap.t += dt;
    } else ap.update(dt);
  }
  F.step = () => {
    if (opt.stepFirst) { sim.step(1 / 60); script(1 / 60); }   // (--selftest: the order swapped)
    else { script(1 / 60); sim.step(1 / 60); }
    // DAY_CLOCK.tick on the sim's clock and the craft's place (day_clock.js), per step as the host does
    if (!opt.noDay) { const cg = sim.cgPos(); world.dayTick(1 / 60, sim.t, cg[0], cg[2]); }
    F.steps++;
  };
  F.hash = () => fnv(sim.p, sim.v);
  return F;
}
// a host command, as the page's action it stands for (the replay of the host's log)
function actCmd(F, c) {
  const A = F.act;
  switch (c.cmd) {
    case 'ctl': for (const k of Object.keys(c.set)) if (k !== 'eng') A.ctl[k] = c.set[k]; break;
    case 'start': A.start(); break;
    case 'hold': A.hold(); break;
    case 'manual': A.manual(!!c.on); break;
    case 'hand': A.hand(c.ctl); break;
    case 'setEngine': { const was = F.sim.starterOk; if ('starterOk' in c) F.sim.starterOk = () => c.starterOk; A.setEngine(c.i, c.patch); F.sim.starterOk = was; if (was === undefined) delete F.sim.starterOk; break; }
    case 'impulse': A.impulse(c.i, c.ix || 0, c.iy || 0, c.iz || 0); break;
    case 'setDay': A.setDay(c.day || {}); break;
    case 'reset': A.reset(); break;
    default: throw new Error('actCmd: ' + c.cmd);
  }
}

// THE SCRIPTED INPUTS: [step, action on a sim-like S] - S is the page's F.act, or the view
const tw = def => (def.refs.tw != null && def.refs.tw >= 0 ? def.refs.tw : def.refs.mains[0]);
const EVENTS = (def, late) => [
  [10, S => { S.ctl.thr = 0.2; }],                      // a lever before ROLL: the hold writes the brake only
  [30, S => S.start()],
  [150 + (late || 0), S => S.impulse(tw(def), 0, 30, 0)],   // a knock under the tail
  [200, S => { S.manual(true); S.hand({ de: 0.1, da: -0.05, dr: 0.2, thr: 0.35, brake: 0, flap: 0.25 }); }],
  [260, S => S.hand({ de: -0.05, da: 0.05, dr: -0.2, thr: 0.5, brake: 0.1, flap: 0 })],
  [330, S => S.manual(false)],
  [380, S => S.setEngine(0, { key: 'off' })],
  [430, S => { S.starterOk = () => true; S.setEngine(0, { key: 'both', start: true }); }],
  [500, S => S.setDay({ rate: 600, diurnalC: 8 })],   // the day at 600x with a diurnal swing: the air's density moves with the clock
  [540, S => { S.ctl.brake = 0.3; }],
];
const RT_EVENTS = def => [
  [0.3, S => S.start()],
  [1.0, S => S.impulse(tw(def), 0, 20, 0)],
  [1.5, S => { S.manual(true); S.hand({ de: 0.05, da: 0, dr: -0.15, thr: 0.4, brake: 0, flap: 0 }); }],
  [2.3, S => S.manual(false)],
  [2.8, S => S.setDay({ rate: 1 })],
];
// the view as S: its writes are the commands
const viewActs = v => ({
  ctl: v.ctl,
  set starterOk(f) { v.starterOk = f; },
  start: () => v.send({ cmd: 'start' }),
  hold: () => v.send({ cmd: 'hold' }),
  manual: on => v.send({ cmd: 'manual', on }),
  hand: h => v.hand(h),
  setEngine: (i, p) => v.setEngine(i, p),
  impulse: (i, a, b, c) => v.impulse(i, a, b, c),
  setDay: o => v.send({ cmd: 'setDay', day: o }),
  reset: () => v.reset(),
});
function runPage(F, events, n, hashes) {
  const at = new Map(); for (const [k, f] of events) at.set(k, (at.get(k) || []).concat([f]));
  if (hashes) hashes[0] = F.hash();
  for (let k = 0; k < n; k++) {
    for (const f of at.get(k) || []) f(F.act);
    F.step();
    if (hashes) hashes[k + 1] = F.hash();
  }
}

// ---- the host's thread, from here
function startHost() {
  const w = new Worker(__filename);
  const H = { w, snaps: [], waiters: [], errors: [] };
  w.on('message', m => {
    if (m.kind === 'error') { H.errors.push(m.error); console.log('  host error: ' + m.error); }
    const i = H.waiters.findIndex(x => x.kind === m.kind && (!x.pred || x.pred(m)));
    if (i >= 0) { const x = H.waiters.splice(i, 1)[0]; x.res(m); return; }
    if (H.onMsg) H.onMsg(m);
  });
  w.on('error', e => { H.errors.push(String(e && e.stack || e)); console.log('  host thread error: ' + e); });
  H.post = (m, tr) => w.postMessage(m, tr || []);
  H.next = (kind, pred) => new Promise(res => H.waiters.push({ kind, pred, res }));
  return H;
}
const snapHash = (R, f) => { const S = R.slots, N3 = R.n * 3; return fnv(f.subarray(S.HEAD, S.HEAD + N3), f.subarray(S.HEAD + N3, S.HEAD + 2 * N3)); };
const tick = () => new Promise(r => setImmediate(r));

(async () => {
  const T0 = Date.now();
  const PLACE = { from: 'HOME', to: 'CIRCUIT', stand: true }, PILOT = { kind: 'auto' };
  const specOf = f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return genMigrateSpec(j.spec || j); };
  const BUILDS = [['stock', specOf(path.join(__dirname, 'fixtures', 'build_v9_stock_2026-09-15.json'))],
                  ['cessnaMetal', specOf(path.join(ROOT, 'bugReports', 'cessnaMetal (1).json'))],
                  // G2678 (BELLY-POD-2): THE POD FLOWN ON THE WORKER - the user's Cub with a 0.60 m belly pod, which sits on
                  // the pod's aft nodes at rest (it strikes three-point: GATE POD's refusal) and scrapes them as it taxis:
                  // the pod's mass, drag and its scraping contacts on the host's thread, to the page's bits
                  ['cubPod', (sp => Object.assign(sp, { pod: { on: 1, depth: 0.6 } }))(specOf(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json')))]];
  const premises = fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8');
  const fullBoot = IN.islandBoot('jolene');
  const trimmed = SH.simHostTrimBoot(fullBoot);

  const diskFetch = u => {
    const rel = u.replace(/^[a-z]+:\/\/[^/]*\//, '').split('?')[0];
    const b = fs.readFileSync(path.join(ROOT, ...rel.split('/')));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(b.toString('utf8'))),
                             arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) });
  };
  // the boot's bytes before any world is made on them: 27_premises.js stampTtype writes the premises' ttype
  // (and cover) codes INTO the island's grids, in place - so the host is handed (or fetches) a boot no world has
  // stamped, and the fetch path below is compared with these digests, not with the page's stamped arrays
  const digest = a => (a && a.byteLength != null ? require('crypto').createHash('md5').update(a).digest('hex') : JSON.stringify(a));
  const pristine = {}; for (const k of SH.SIM_HOST_KEYS) pristine[k] = digest(k.split('.').reduce((o, s) => o && o[s], trimmed));
  // ---- 1 THE BLOB (first: a premises world writes the process's AIRFIELD_SITES - 20_world.js - and the page's
  // analytic flight below must read the core's own; the host's thread has its own core)
  console.log('1 THE BLOB (simHostSource in a worker-like global)');
  const src = SH.simHostSource('https://page/flyDiy/', 'B1', 'c0re');
  const urls = [];
  const out = [];
  const ctx = { console, performance, setTimeout, clearTimeout, TextDecoder, Response, Blob, DecompressionStream, fetch: diskFetch,
                postMessage: (m) => out.push(m), close: () => {} };
  ctx.self = ctx;
  ctx.importScripts = u => { urls.push(u); vm.runInContext(fs.readFileSync(path.join(ROOT, ...u.replace('https://page/flyDiy/', '').split('?')[0].split('/')), 'utf8'), ctx, { filename: u }); };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'sim_host_blob.js' });
  const spec0 = BUILDS[0][1];
  ctx.onmessage({ data: { cmd: 'init', world: {}, spec: spec0, place: PLACE, pilot: PILOT, withV: true } });
  ctx.onmessage({ data: { cmd: 'batch', list: [{ cmd: 'start', k: 10 }] } });
  ctx.onmessage({ data: { cmd: 'steps', n: 120 } });
  const rdy = out.find(m => m.kind === 'ready'), last = out.filter(m => m.kind === 'snap').pop();
  const Fn = pageFlight(makeWorld(0, {}), spec0);
  runPage(Fn, [[10, S => S.start()]], 120);
  ok(urls.length === 2 && /src\/viewer\/sim_host\.js\?v=B1$/.test(urls[0]) && /tools\/flight_core\.js\?v=c0re$/.test(urls[1]),
     'the Blob imports sim_host.js and the built core by URL next to the page, versioned (' + urls.map(u => u.replace('https://page/flyDiy/', '')).join(', ') + ')');
  ok(!!rdy && !!last && !out.some(m => m.kind === 'error') && snapHash(rdy, new Float64Array(last.buf)) === Fn.hash(),
     'the Blob\'s host flies 120 steps of the analytic world to the page\'s bits' + (out.some(m => m.kind === 'error') ? ' - ' + out.find(m => m.kind === 'error').error.split('\n')[0] : ''));

  // ---- 1b THE STALL (G1365, SIM-STALL - the user, 3 Oct: a 79 s freeze, "when it unfreezes, I find it miles away")
  // The same Blob's host, its clock swapped for a fake one (the host reads `performance` / `setTimeout` off its global at
  // each call): the page beats once a frame at 60 Hz (sim_view.js frame), then draws nothing for 60 s, then beats again
  console.log('1b THE STALL (the Blob\'s host on a fake clock: a 60 Hz page, a 60 s freeze, the page back)');
  {
    let clk = 1e6, tid = 0;
    const timers = [];
    ctx.performance = { timeOrigin: 0, now: () => clk };
    ctx.setTimeout = (f, ms) => { const id = ++tid; timers.push({ id, at: clk + Math.max(1, +ms || 0), f }); return id; };   // (node's: 1 ms at least)
    ctx.clearTimeout = id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); };
    const until = to => {   // the host's timers due by `to`, in order, the clock on each
      for (;;) {
        let j = -1; for (let i = 0; i < timers.length; i++) if (timers[i].at <= to && (j < 0 || timers[i].at < timers[j].at)) j = i;
        if (j < 0) break;
        const tm = timers.splice(j, 1)[0]; clk = Math.max(clk, tm.at); tm.f();
      }
      clk = to;
    };
    const send = m => ctx.onmessage({ data: m });
    const S = rdy.slots, snaps = () => out.filter(m => m.kind === 'snap').map(m => new Float64Array(m.buf));
    const at = f => ({ k: f[S.STEP], cg: [f[S.CG], f[S.CG + 1], f[S.CG + 2]], v: Math.hypot(f[S.CGV], f[S.CGV + 2]) });
    const dist = (a, b) => Math.hypot(a.cg[0] - b.cg[0], a.cg[1] - b.cg[1], a.cg[2] - b.cg[2]);
    const frames = secs => { const end = clk + secs * 1000; while (clk < end - 1e-6) { until(clk + 1000 / 60); send({ cmd: 'beat' }); } };
    send({ cmd: 'steps', n: 180 });                       // 5 s in: the pilot taxiing out
    send({ cmd: 'run' });
    frames(1);
    const A = at(snaps().pop());
    until(clk + 60000);                                   // THE FREEZE: no frame drawn, no beat, 60 s
    const B = at(snaps().pop());
    send({ cmd: 'state' }); const HB = out.filter(m => m.kind === 'state').pop();
    const n0 = out.length;
    frames(1);                                            // the page back
    const after = out.slice(n0).filter(m => m.kind === 'snap').map(m => new Float64Array(m.buf));
    const C = at(after[after.length - 1]), maxRan = Math.max(...after.map(f => f[S.RAN]));
    send({ cmd: 'state' }); const HC = out.filter(m => m.kind === 'state').pop();
    send({ cmd: 'pause' });
    const held = B.k - A.k, moved = dist(A, B);
    console.log('  at the freeze: step ' + A.k + ', ' + f3(A.v) + ' m/s (60 s of that is ' + (A.v * 60).toFixed(0) + ' m); held after ' + held + ' steps, ' +
                f3(moved) + ' m on; the page back: ' + (C.k - B.k) + ' steps in its first second (at most ' + maxRan + ' a turn), ' +
                'stalls ' + HC.stalls + ', ' + f3(HC.stallS) + ' s let go');
    ok(A.v > 1 && held <= Math.ceil(SH.SIM_HOST_STALL_MS / 1000 * 60) + 1 && moved < 3 && HB.stalled && !HC.stalled,
       'a 60 s page freeze: the host HOLDS ' + SH.SIM_HOST_STALL_MS + ' ms past the last beat (' + held + ' steps), the aeroplane ' + f3(moved) + ' m from where the page last drew it (< 3; ' + (A.v * 60).toFixed(0) + ' m unheld)');
    ok(Math.abs((C.k - B.k) - 60) <= 2 && maxRan <= 2 && HC.stalls === 1 && Math.abs(HC.stallS - (60 - SH.SIM_HOST_STALL_MS / 1000)) < 0.05 && dist(B, C) < 2 * A.v + 1,
       'the page back: the flight goes on from where it held at real time (' + (C.k - B.k) + ' steps in the first second, at most ' + maxRan + ' a turn) - the ' + f3(HC.stallS) + ' s lost not owed, no teleport');
  }

  // the host boots its world while the page boots its own
  const host = startHost();
  const readyP = host.next('ready'), snap0P = host.next('snap');
  host.post({ cmd: 'init', world: { boot: trimmed, premises }, spec: BUILDS[0][1], place: PLACE, pilot: PILOT, withV: true });
  let t = Date.now();
  const world = makeWorld(0, { island: ISLAND_GEN.makeIsland(fullBoot), premises });
  console.log('the page\'s world (the whole boot): ' + (Date.now() - t) + ' ms');

  // ---- 2 LOCKSTEP ------------------------------------------------------------
  console.log('2 LOCKSTEP (' + N + ' steps a build, Jolene + premises, HOME\'s stand)');
  const hostHashes = {};
  let lastReady = null;
  for (let b = 0; b < BUILDS.length; b++) {
    const [name, spec] = BUILDS[b];
    let ready, snap0;
    if (b === 0) { ready = await readyP; snap0 = await snap0P; }
    else {
      const rp = host.next('ready'), sp = host.next('snap');
      host.post({ cmd: 'init', world: 'keep', spec, place: PLACE, pilot: PILOT, withV: true });
      ready = await rp; snap0 = await sp;
    }
    lastReady = ready;
    if (b === 0) console.log('  the host: init ' + ready.initMs.toFixed(0) + ' ms, the trimmed boot ' + (ready.boot.bytes / 1048576).toFixed(1) + ' MiB');
    const pageDef = buildGen(spec);
    const view = SV.makeSimView(pageDef, { ready, post: (m, tr) => host.post(m, tr) });
    ok(!view.mismatch && ready.defSig === SV.simViewDefSig(pageDef), name + ': the host\'s aeroplane is the page\'s (' + ready.defSig + ', ' + ready.n + ' nodes, ' + ready.substeps + ' substeps)');
    const wv0 = new Float64Array(snap0.buf)[ready.slots.WV];   // the world's version at this flight's step 0 (G815)
    view.take(snap0);
    // the scripted inputs through the view, stamped
    for (const [k, f] of EVENTS(pageDef)) { view.at(k); f(viewActs(view)); view.flush(); }
    view.at(null);
    // the host steps on its thread while the page flies inline
    const hs = [snapHash(ready, new Float64Array(snap0.buf))];
    let lastMsg = null;
    const got = new Promise(res => {
      host.onMsg = m => { if (m.kind !== 'snap') return; hs.push(snapHash(ready, new Float64Array(m.buf))); if (lastMsg) view.take(lastMsg); lastMsg = m; if (hs.length === N + 1) res(); };
    });
    host.post({ cmd: 'steps', n: N, every: true });
    t = Date.now();
    const F = pageFlight(world, spec);
    const ph = [];
    runPage(F, EVENTS(F.def), N, ph);
    const pageMs = Date.now() - t;
    await got;
    host.onMsg = null;
    hostHashes[name] = hs;
    let first = -1; for (let k = 0; k <= N; k++) if (hs[k] !== ph[k]) { first = k; break; }
    ok(first < 0, name + ': every step\'s FNV(p, v) equal, 0..' + N + (first < 0 ? ' (final ' + ph[N].toString(16) + ', page ' + pageMs + ' ms)' : ' - FIRST DIVERGES AT STEP ' + first + ' (page ' + ph[first].toString(16) + ', host ' + hs[first].toString(16) + ')'));
    // the view's reads at the newest snapshot = the page's sim
    view.take(lastMsg);
    const fr = view.frame(Infinity);
    const sim = F.sim, ap = F.ap, S = ready.slots, fB = view.snapshot();
    ok(fr.alpha === 1 && same(view.p, sim.p), name + ': the view\'s p at the newest snapshot is the page\'s, bit for bit');
    ok(same(view.cgPos(), sim.cgPos()) && same(view.cgVel(), sim.cgVel()) && view.totalM === sim.totalM,
       name + ': cgPos / cgVel / totalM are the solver\'s (' + view.cgPos().map(f3).join(', ') + '; ' + view.totalM.toFixed(2) + ' kg)');
    ok(same(view.axes().flat(), sim.axes().flat()) && same(view.bodyOrigin(), sim.bodyOrigin()), name + ': axes and bodyOrigin are the solver\'s');
    ok(view.wheelsOnGround() === sim.wheelsOnGround() && JSON.stringify(view.wheelContacts()) === JSON.stringify(sim.wheelContacts()) &&
       view.stats().smax === sim.stats().smax, name + ': wheels (' + view.wheelsOnGround() + ') and the strain are the solver\'s');
    const plain = o => JSON.stringify(SH.simHostPlain(o, 3, ['hydro']));
    if (pageDef.parts.podFrame) {
      // the pod's own nodes ARE flown: four, and the lowest at the ground the mains stand on (the scrape branch)
      const pn = pageDef.parts.podFrame.nodes, mains = pageDef.refs.mains;
      const gY = Math.min(...mains.map(i => sim.p[3 * i + 1] - sim.r[i]));
      const podY = Math.min(...pn.map(i => sim.p[3 * i + 1]));
      ok(pn.length === 4 && pn.every(i => pageDef.nodes[i].r === 0 && !mains.includes(i) && i !== pageDef.refs.tw) && podY - gY < 0.03,
         name + ': the pod\'s 4 nodes are flown (r 0: not wheels) and its lowest is on the ground the mains stand on (' + f3(podY - gY) + ' m)');
    }
    ok(plain(view.out) === plain(sim.out),
       name + ': out is the solver\'s (V ' + f3(view.out.V) + ' m/s, thrust ' + f3(view.out.thrust) + ' N)');
    ok(plain(view.fuel) === plain(sim.fuel) && plain(view.eng) === plain(sim.eng) &&
       SV.SIM_VIEW_LEVERS.every(k => view.ctl[k] === sim.ctl[k]) && JSON.stringify(view.ctl.eng) === JSON.stringify(sim.ctl.eng),
       name + ': fuel, eng and the levers are the solver\'s (fuel ' + f3(view.fuel.kg) + ' kg, engine ' + (view.eng[0] && view.eng[0].running ? 'running' : 'stopped') + ')');
    ok(view.ap.phase === ap.phase && view.ap.t === ap.t && JSON.stringify(view.ap.status) === JSON.stringify(SH.simHostPlain(ap.status, 4)),
       name + ': the pilot\'s snapshot is the pilot\'s (' + ap.phase + ', t ' + f3(ap.t) + ' s)');
    // (G815: the version is the WORLD's, kept across flights on a kept world - this flight's one setDay moved it by one)
    ok(fB[S.WV] === wv0 + 1 && fB[S.LATE] === 0 && fB[S.STEP] === N && view.state().strays === 0,
       name + ': the world-version counter moved with the day (' + wv0 + ' -> ' + fB[S.WV] + '), no command late, step index ' + fB[S.STEP]);
    // the interpolation. G1100 (POSE-SMOOTH): T maps through the moment the newest state was DUE (a lockstep publish: its
    // publishing), less the view's delay; the pair that holds that moment is found in the RING (the newest five), clamped
    // at the ring's oldest and at the newest
    if (b === 0) {
      const fBd = fB[S.DUE] > 0 ? fB[S.DUE] : fB[S.WALL], dt = 1000 / 60, D = view.delay(), rg = view.ring(), K = rg.length;
      const half = view.frame(fBd + (D.delayS * 1000 - 0.5 * dt));   // tau = tB - 0.5 step: halfway from A to B
      const q = view.p[3];
      const qA = rg[K - 2][S.HEAD + 3], qOld = rg[0][S.HEAD + 3];
      const two = view.frame(fBd + (D.delayS * 1000 - 2.25 * dt));   // tau = tB - 2.25 steps: a quarter from ring[K-4] to ring[K-3]
      const q2 = view.p[3], q2a = rg[K - 4][S.HEAD + 3], q2b = rg[K - 3][S.HEAD + 3];
      view.frame(fBd - 10 * dt);
      const qP = view.p[3];
      view.frame(fBd + 10 * dt + D.delayS * 1000);
      const qB = view.p[3];
      // (the wall clock is ~1.8e12 ms since the epoch: its last bit is 2e-4 ms, a 1e-5 of a step)
      ok(K === 5 && Math.abs(half.alpha - 0.5) < 1e-3 && q === qA + (qB - qA) * half.alpha && qB === sim.p[3] && qA !== qB &&
         Math.abs(two.alpha - 0.75) < 1e-3 && q2 === q2a + (q2b - q2a) * two.alpha && qP === qOld && qOld !== qA,
         'the view interpolates at T less its delay (' + (D.delayS * 60).toFixed(2) + ' steps) in its ring of ' + K + ': alpha ' + half.alpha.toFixed(3) + ' halfway between the two newest, ' +
         two.alpha.toFixed(3) + ' between the 4th and 3rd newest 2.25 steps back, clamped to the ring\'s oldest and the newest snapshot');
    }
  }

  // ---- 3 REAL TIME -------------------------------------------------------------
  console.log('3 REAL TIME (' + SECS + ' s on the host\'s own clock, a 60 Hz render loop busy ' + RENDER_MS + ' ms a frame)');
  const [rtName, rtSpec] = BUILDS[0];
  const rp = host.next('ready'), sp = host.next('snap');
  host.post({ cmd: 'init', world: 'keep', spec: rtSpec, place: PLACE, pilot: PILOT, withV: true });
  const R = await rp, s0 = await sp;
  const pageDef = buildGen(rtSpec);
  const view = SV.makeSimView(pageDef, { ready: R, post: (m, tr) => host.post(m, tr) });
  const rtHashes = new Map();
  const S = R.slots;
  const lat = [], takeMs = [], frameMs = [], ages = [];
  let frames = 0;
  const onSnap = m => {
    const f = new Float64Array(m.buf);
    if (frames > 10) lat.push(wallNow() - f[S.WALL]);   // steady state: the first frames carry the run's start
    rtHashes.set(f[S.STEP], snapHash(R, f));
    const a = performance.now(); view.take(m); takeMs.push(performance.now() - a);
  };
  onSnap(s0);
  host.onMsg = m => { if (m.kind === 'snap') onSnap(m); };
  // the transport alone: a snapshot-sized buffer there and back, transferred (the host paused)
  const rtt = [];
  for (let i = 0; i < 200; i++) {
    const buf = new ArrayBuffer(R.len * 8), a = performance.now();
    const pong = host.next('pong');
    host.post({ cmd: 'ping', t: a, buf }, [buf]);
    await pong; rtt.push(performance.now() - a);
  }
  const events = RT_EVENTS(pageDef).slice();
  host.post({ cmd: 'run' });
  const tStart = wallNow(), period = 1000 / 60;
  let allocWarm = null;
  const fly = async secs => { const t1 = wallNow(); while (wallNow() - t1 < secs * 1000) {
    const tf = wallNow();
    while (events.length && (tf - tStart) / 1000 >= events[0][0]) { events.shift()[1](viewActs(view)); }
    view.flush();
    const a = performance.now(); const fr = view.frame(tf); frameMs.push(performance.now() - a);
    if (fr && frames > 10) ages.push(fr.ageMs);
    const busyEnd = wallNow() + RENDER_MS; while (wallNow() < busyEnd);
    frames++;
    if (frames === 60) allocWarm = view.state().allocs;
    while (wallNow() - tf < period) { const wait = period - (wallNow() - tf); if (wait > 2) await new Promise(r => setTimeout(r, wait - 1)); else await tick(); }
  } };
  await fly(SECS);
  // G1365 (SIM-STALL): THE PAGE FREEZES on the real thread - 1.5 s with no frame drawn (no beat): the host holds 250 ms past
  // the last beat and goes on from there when the frames come back (the replay below runs through it, step for step)
  const sq = async () => { const p = host.next('state'); host.post({ cmd: 'state' }); return p; };
  const kF = (await sq()).steps;
  await new Promise(r => setTimeout(r, 1500));
  const HF = await sq();
  await fly(0.5);
  const HR = await sq();
  console.log('  the page frozen 1.5 s: ' + (HF.steps - kF) + ' steps while it was (' + (HF.stalled ? 'held' : 'NOT HELD') + '), ' + (HR.steps - HF.steps) + ' in the half second after; ' +
              HR.stalls + ' stall, ' + f3(HR.stallS) + ' s let go');
  ok(HF.stalled && HF.steps - kF <= 15 + 6 && HR.steps - HF.steps >= 20 && HR.stalls === 1 && HR.stallS > 1.0 && HR.stallS < 1.6,
     'the worker thread holds through a 1.5 s page freeze (' + (HF.steps - kF) + ' steps, <= 21) and goes on after it (' + (HR.steps - HF.steps) + ' steps in 0.5 s, ' + f3(HR.stallS) + ' s let go)');
  const pp = host.next('snap');
  host.post({ cmd: 'pause' });
  await pp;
  await tick();
  const st = host.next('state'); host.post({ cmd: 'state' }); const HS = await st;
  const lg = host.next('log'); host.post({ cmd: 'log' }); const LOG = await lg;
  host.onMsg = null;
  const steps = HS.steps, vs = view.state();
  console.log('  transport: a ' + (R.len * 8 / 1024).toFixed(1) + ' KB snapshot buffer there and back (transferred) p50 ' + f3(pct(rtt, 0.5)) + ' / p99 ' + f3(pct(rtt, 0.99)) + ' ms');
  console.log('  a snapshot\'s one-way latency (published -> taken; the render loop is busy ' + RENDER_MS + ' ms of each frame) p50 ' + f3(pct(lat, 0.5)) + ' / p90 ' + f3(pct(lat, 0.9)) + ' / max ' + f3(Math.max(...lat)) + ' ms');
  console.log('  the pose age at the render (now less when the host held the drawn state; interpolated at T - 1 step) p50 ' + f3(pct(ages, 0.5)) + ' / p90 ' + f3(pct(ages, 0.9)) + ' ms');
  console.log('  the render thread\'s physics: take ' + f3(pct(takeMs, 0.5)) + ' / max ' + f3(Math.max(...takeMs)) + ' ms a snapshot, frame ' + f3(pct(frameMs, 0.5)) + ' / max ' + f3(Math.max(...frameMs)) + ' ms a frame');
  console.log('  the host: ' + steps + ' steps in ' + SECS + ' s + the freeze, step ' + f3(HS.stepMs) + ' ms (eased), dilation ' + f3(HS.dilation) + ', dropped ' + f3(HS.droppedS) + ' s (' + HS.guarded + ' turns), ' +
              rtHashes.size + ' snapshots, buffers allocated ' + HS.allocs + ' (' + (HS.allocs - (allocWarm || 0)) + ' after the first second), ' + frames + ' frames drawn');
  ok(steps >= 30 && rtHashes.size >= 10, 'the host\'s clock ran (' + steps + ' steps, ' + rtHashes.size + ' snapshots)');
  ok(LOG.list.length === RT_EVENTS(pageDef).length + LOG.list.filter(e => e.c.cmd === 'hand').length && LOG.late === 0,
     'every action applied once and logged with its step (' + LOG.list.map(e => e.c.cmd + '@' + e.k).join(', ') + ')');
  ok(vs.strays === 0 && !vs.mismatch && vs.diverged === false, 'the view: no stray step, the same aeroplane, not diverged');
  // the replay: the host's log on the page's inline loop
  const F = pageFlight(world, rtSpec);
  const logAt = new Map(); for (const e of LOG.list) logAt.set(e.k, (logAt.get(e.k) || []).concat([e.c]));
  let bad = -1, cmpd = 0;
  if (rtHashes.has(0)) { cmpd++; if (rtHashes.get(0) !== F.hash()) bad = 0; }
  for (let k = 0; k < steps && bad < 0; k++) {
    for (const c of logAt.get(k) || []) actCmd(F, c);
    F.step();
    if (rtHashes.has(k + 1)) { cmpd++; if (rtHashes.get(k + 1) !== F.hash()) bad = k + 1; }
  }
  ok(bad < 0 && cmpd === rtHashes.size, 'the host\'s log replayed inline reproduces all ' + cmpd + ' published snapshots to the bit' + (bad >= 0 ? ' - DIVERGES AT STEP ' + bad : ''));

  // ---- 4 THE BOOT ---------------------------------------------------------------
  console.log('4 THE BOOT');
  t = Date.now();
  const fb = await SH.simHostFetchBoot('http://page/', 'jolene', { fetch: diskFetch });
  const fetchMs = Date.now() - t;
  const differ = SH.SIM_HOST_KEYS.filter(k => digest(k.split('.').reduce((o, s) => o && o[s], fb)) !== pristine[k]);
  ok(!differ.length, 'the page\'s fetch path (the manifest, gzip through DecompressionStream) gives island_node\'s bytes, key for key (' + fetchMs + ' ms)' + (differ.length ? ' - DIFFERS: ' + differ.join(', ') : ''));
  const stamped = SH.SIM_HOST_KEYS.filter(k => digest(k.split('.').reduce((o, s) => o && o[s], trimmed)) !== pristine[k]);
  console.log('  NB the page\'s own boot after its makeWorld: ' + (stamped.length ? stamped.join(', ') + ' stamped in place (27_premises stampTtype) - never hand the host a boot a world was made on' : 'unchanged'));
  const g = fb.grid || {};
  ok(!g.albedo && !g.tint && !g.ori1 && !g.ndvi && !fb.far && g.canopy && g.cover && g.coast && g.lake && g.ttype && fb.payload,
     'the trimmed boot: the height tree + cover / canopy / coast / lake / ttype, no albedo, tint, ori1, ndvi or far tree');
  let fullB = 0; for (const k of Object.keys(IN.worldPack().islands.find(w => w.id === 'jolene').files)) { const v = k.split('.').reduce((o, s) => o && o[s], fullBoot); if (v && v.byteLength) fullB += v.byteLength; }
  console.log('  decoded: trimmed ' + (SH.simHostBootBytes(fb) / 1048576).toFixed(1) + ' MiB of the whole boot\'s ' + (fullB / 1048576).toFixed(1) + ' MiB (ARCH §1.6 estimated 70-80 MB)');

  // ---- 5 THE BUILD ------------------------------------------------------------------
  console.log('5 THE BUILD');
  const BUILD = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  ok(/'sim_host\.js', 'sim_view\.js'/.test(BUILD), 'tools/build.js MANIFEST.viewer.scripts carries sim_host.js and sim_view.js');
  const IDX = path.join(ROOT, 'index.html');
  const html = fs.existsSync(IDX) ? fs.readFileSync(IDX, 'utf8') : '';
  ok(html.includes('window.SIM_HOST = {') && html.includes('window.SIM_VIEW = {') && html.includes('function simHostSource('),
     'index.html publishes SIM_HOST (the starter, the Blob\'s source) and SIM_VIEW');

  // ---- NEGATIVE ---------------------------------------------------------------------
  if (SELF) {
    console.log('SELFTEST (the page\'s loop, perturbed, against the host\'s hashes of build 1)');
    const n2 = Math.min(N, 600), hs = hostHashes[BUILDS[0][0]];
    const cases = [['the impulse one step late', {}, 1], ['the day not ticked', { noDay: true }, 0], ['the step before the script', { stepFirst: true }, 0]];
    for (const [label, opt, late] of cases) {
      const w2 = makeWorld(0, { island: ISLAND_GEN.makeIsland(fullBoot), premises });
      const Fp = pageFlight(w2, BUILDS[0][1], opt), ph = [];
      runPage(Fp, EVENTS(Fp.def, late), n2, ph);
      let first = -1; for (let k = 0; k <= n2; k++) if (hs[k] !== ph[k]) { first = k; break; }
      ok(first >= 0, 'caught: ' + label + (first >= 0 ? ' (diverges at step ' + first + ')' : ' - NOT CAUGHT'));
    }
  }

  host.post({ cmd: 'stop' });
  await Promise.race([new Promise(r => host.w.once('exit', r)), new Promise(r => setTimeout(r, 2000))]);
  ok(host.errors.length === 0, 'the host\'s thread raised nothing');
  console.log('\n' + checks + ' checks, ' + fails + ' failed, ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
  console.log('GATE SIMWORKER: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e && e.stack || e); console.log('GATE SIMWORKER: FAIL (' + (e && e.message) + ')'); process.exit(1); });
