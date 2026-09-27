// ============================================================
// THE SOLVER'S OWN THREAD (G810, 2026-09-27; futureDesigns/ARCH-2026-09-27.md
// §2, chantier 1, step 1). The page's loop runs `script(1/60); sim.step(1/60)`
// on the render thread (app.js loop()), so physics and render SUM: the taxi's
// 18-24 ms frame is the solver's 6-11 plus the render's 9-10, and every
// catch-up step G586 owes after a long frame makes the next frame longer. The
// node prototype (futureDesigns/ARCH-2026-09-27.probes/worker_proto.js) moved
// the solver and the pilot into a worker: the render thread's physics went
// from 3-23 ms to 0.02-0.03 ms and the worst frame from 59-125 to 18-34 ms.
//
// This file is that worker's BODY, built the way bench_worker.js is (A9): a
// Blob whose source imports this file and the built core bundle by URL next to
// the page, so it must stay a file the page can fetch. Nothing here is
// physics: the host owns
//   the WORLD   makeWorld on a TRIMMED island boot (SIM_HOST_KEYS: the height
//               tree and the grids the world's physics half reads - cover,
//               canopy, coast, lake, ttype, the lake records; not albedo,
//               tint, ori1, ndvi or the far tree, which only the renderer
//               reads; ARCH §1.6: ~70-80 MB against 638 MB for the whole
//               pack) + the premises record, fetched through the page's own
//               path (simHostFetchBoot) or handed in (the node gate);
//   the SIM     buildGen(spec) -> makeSim, reset, and the page's placement
//               (app.js applyRoute: the stance, the stand or the spawn, the
//               route, departFrom) and its pilot (mkPilot);
//   the STEP    per 1/60 s: the commands due at this step index, the
//               non-UI half of app.js script() (the hold's brake, the hand
//               under MANUAL, ap.update), sim.step(1/60), then the day's
//               physics half (world.dayTick on the sim's own clock - ARCH
//               §2.2: the climate reads the sun, so the day lives here and
//               the sky derives from snapshot t);
//   the CLOCK   its own: steps while sim time is behind wall time
//               (performance.timeOrigin + now(), the same epoch on both
//               threads), one step at a time, at most SIM_HOST_CATCH owed
//               per turn - past that the excess is let go and the DILATION
//               (G612's reading: sim seconds over wall seconds, the last
//               second) says so. Or LOCKSTEP ({cmd:'steps', n}) for a gate;
//   the SNAPSHOT a Float64Array in a TRANSFERRED ArrayBuffer (SIM_SNAP
//               layout: the head, p in float64 - ARCH §2.2, a float32 CG at
//               30 km quantizes to 2-4 mm - optionally v, the fuel nodes'
//               masses) + a small structured-clone `meta` (out, eng, fuel,
//               hydro, wheels, ctl, the pilot's snapshot). The page hands
//               each buffer back ({cmd:'release'}): no allocation per frame
//               once the pool is warm (the head counts every allocation).
//               postMessage with transfer first, as ARCH §2.2 recommends;
//               SharedArrayBuffer needs crossOriginIsolated and is a later,
//               measured option.
//
// INPUTS ARE STAMPED BY STEP INDEX. A command carries `k`, the step before
// which it applies; one that arrives late (or carries none) applies at the
// next boundary and is counted. Every application is LOGGED with the step it
// actually took ({cmd:'log'}), so a flight replays to the bit from its log in
// node (GATE SIMWORKER proves it) - ARCH §2.4's clean replay point.
//
// NOT HERE YET (C1b/C1c): app.js does not use this (behind ?simw=1 next), the
// viewer's obstacles (render_premises hitAdd, the club hangar, the parked
// aircraft), manualEnding's touchdown, the telemetry record(), editor edits.
//
// sim_view.js is the page's side: the read API the page already uses on
// `sim`, over these snapshots. GATE SIMWORKER (tools/_simworker_check.js)
// drives this host in a worker_threads Worker against the inline loop.
// ============================================================

// the trimmed boot: the manifest keys (dotted paths into the boot object, as
// src/core/world_packs.json and tools/island_node.js name them) the world's
// physics half reads. 28_island.js makeIsland takes the rest as optional.
const SIM_HOST_KEYS = ['header', 'topo', 'payload', 'grid.meta', 'grid.cover', 'grid.canopy',
                       'grid.coast', 'grid.lake', 'grid.ttype', 'grid.lakes'];
// the core names the worker's Blob picks out of the imported bundle
const SIM_HOST_CORE = ['ISLAND_GEN', 'makeWorld', 'buildGen', 'makeSim', 'makePilot', 'makeAutopilot',
                       'makeTestPilot', 'navMake', 'siteOf', 'placeAtStand', 'placeAtAerodrome'];
const SIM_HOST_DT = 1 / 60;
const SIM_HOST_CATCH = 4;          // steps owed per turn at most (G586's frame owed 4)
const SIM_HOST_POOL = 3;           // snapshot buffers: the page holds two (interpolation), the host writes the third
const SIM_HOST_LOG = 8192;         // applied commands kept for {cmd:'log'}
// THE SNAPSHOT'S HEAD (float64 slots), then p (3n), then v (3n, when asked), then the fuel nodes' masses
const SIM_SNAP = { SEQ: 0, STEP: 1, T: 2, WALL: 3, STEPMS: 4, DIL: 5, WV: 6, N: 7, FLAGS: 8, CG: 9, CGV: 12,
                   TOTALM: 15, WHEELS: 16, SMAX: 17, LATE: 18, DROPPED: 19, MAXMS: 20, RAN: 21, ALLOCS: 22,
                   RATE: 23, EPOCH: 24, NF: 25, HEAD: 26,
                   F_DIVERGED: 1, F_V: 2, F_RUNNING: 4, F_MANUAL: 8, F_STARTED: 16 };

const simHostGet = (o, k) => { const p = k.split('.'); for (const s of p) { if (o == null) return undefined; o = o[s]; } return o; };
const simHostSet = (o, k, v) => { const p = k.split('.'); for (let i = 0; i < p.length - 1; i++) o = (o[p[i]] = o[p[i]] || {}); o[p[p.length - 1]] = v; };

// the physics half of a boot the page (or island_node.js) assembled - the same
// arrays, not copies
function simHostTrimBoot(boot) {
  if (!boot) return null;
  const out = { id: boot.id, grid: {}, far: null, hydro: boot.hydro || 'blend' };
  if (boot.reclass != null) out.reclass = boot.reclass;
  for (const k of SIM_HOST_KEYS) { const v = simHostGet(boot, k); if (v != null) simHostSet(out, k, v); }
  return out;
}
function simHostBootBytes(boot) {
  let b = 0;
  for (const k of SIM_HOST_KEYS) { const v = simHostGet(boot, k); if (v && v.byteLength) b += v.byteLength; }
  return b;
}

// the trimmed boot fetched the way the page's loader fetches the whole one
// (tools/build.js, the island block): the manifest, then each named payload,
// ONE gzip stream each - through the same URLs, so the page's cache serves the
// worker. opts: { fetch, hydro }.
function simHostFetchBoot(base, name, opts) {
  opts = opts || {};
  const F = opts.fetch || fetch;
  const gz = buf => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(b => new Uint8Array(b));
  return F(base + 'src/core/world_packs.json').then(r => (r.ok ? r.json() : { islands: [] })).then(PACK => {
    const isl = (PACK.islands || []).find(w => w.id === name);
    if (!isl) return null;
    const boot = { id: name, grid: {}, far: null, hydro: opts.hydro || 'blend' };
    return Promise.all(SIM_HOST_KEYS.map(k => {
      const r = isl.files[k];
      if (!r) return null;
      if ('json' in r) { simHostSet(boot, k, r.json); return null; }
      return F(base + r.src).then(res => { if (!res.ok) throw new Error(r.src + ' ' + res.status); return res.arrayBuffer(); })
        .then(gz).then(u => simHostSet(boot, k, r.kind === 'json' ? JSON.parse(new TextDecoder().decode(u)) : u));
    })).then(() => boot);
  });
}

// plain data, for a structured clone: numbers, strings, booleans, arrays and
// objects to `depth`, small typed arrays copied; functions, getters and the
// `skip` keys dropped
function simHostPlain(o, depth, skip) {
  if (o === null || typeof o !== 'object') return typeof o === 'function' ? undefined : o;
  if (ArrayBuffer.isView(o)) return o.length <= 64 ? Array.from(o) : undefined;
  if (depth <= 0) return undefined;
  if (Array.isArray(o)) return o.map(x => simHostPlain(x, depth - 1));
  const r = {};
  for (const k of Object.keys(o)) {
    if (skip && skip.indexOf(k) >= 0) continue;
    const d = Object.getOwnPropertyDescriptor(o, k);
    if (!d || d.get || typeof d.value === 'function') continue;
    const v = simHostPlain(d.value, depth - 1);
    if (v !== undefined) r[k] = v;
  }
  return r;
}

// the pilot's fields that are big and change rarely: sent when the object
// changes (by reference), the rest of the pilot every snapshot
const SIM_HOST_AP_RARE = ['legs', 'path', 'plan', 'taxiOut', 'site'];
const SIM_HOST_AP_SKIP = ['nav', 'sheet'];

// ---- THE HOST: world, sim, pilot, the step and the snapshot; thread-agnostic
// init: { world: { boot, premises, seed, opts, day } | a world to keep,
//         spec (as buildGen takes it), place: { from, to, stand }, pilot: { kind, shakedown, nav },
//         withV, day (tick the day, default true) }
function makeSimHost(CORE, init, keptWorld) {
  const W = init.world || {};
  let world = keptWorld || null;
  if (!world) {
    const island = W.boot ? CORE.ISLAND_GEN.makeIsland(W.boot) : null;
    const wo = Object.assign({}, W.opts || {});
    if (island) wo.island = island;
    if (W.premises != null) wo.premises = W.premises;
    world = CORE.makeWorld(W.seed || 0, wo);
    if (W.day) world.setDay(W.day);
  }
  const def = CORE.buildGen(init.spec);
  const sim = CORE.makeSim(def, world);
  const n = sim.n, withV = !!init.withV, dayOn = init.day !== false;
  const fuelIdx = [];
  for (let i = 0; i < n; i++) if (def.nodes[i].mFuel > 0) fuelIdx.push(i);
  const S = SIM_SNAP, LEN = S.HEAD + 3 * n * (withV ? 2 : 1) + fuelIdx.length;
  const H = { world, def, sim, ap: null, steps: 0, epoch: 0, worldV: 0, late: 0, started: false, manual: false, hand: null,
              queue: [], log: [], logDropped: 0, n, withV, fuelIdx, len: LEN };
  const aeroById = id => world.aerodromes.find(a => a.id === id) || world.aerodromes[0];
  // app.js mkPilot
  function mkPilot() {
    const PK = init.pilot || {}, kind = PK.kind || 'auto';
    if (kind === 'classic') return CORE.makeAutopilot(sim, def, world);
    if (kind === 'test' && typeof CORE.makeTestPilot === 'function') return CORE.makeTestPilot(sim, def, world);
    if (typeof CORE.makePilot === 'function') {
      const sd = PK.shakedown || null;
      const p = CORE.makePilot(sim, def, world, { style: kind === 'auto' ? 'normal' : kind, shakedown: () => sd });
      if (PK.nav !== false && typeof CORE.navMake === 'function') {
        if (!H.nav) H.nav = CORE.navMake({ waypoints: world.aerodromes });
        p.setNav(H.nav);
      }
      return p;
    }
    return CORE.makeTestPilot(sim, def, world);
  }
  // app.js applyRoute; `stand`: true = the site's own, an object = the page's (standFor, the player's door), false = the spawn
  function place() {
    const PL = init.place || {}, ap = H.ap;
    const from = aeroById(PL.from || 'HOME');
    const to = (PL.to == null || PL.to === 'CIRCUIT') ? from : aeroById(PL.to);
    if (sim.hydro) {
      const sea = aeroById('SEA') || { hdg: Math.PI / 2, spawn: [0, 1285], elev: 0 };
      CORE.placeAtAerodrome(sim, sea);
      ap.setRoute(sea, (PL.to == null || PL.to === 'CIRCUIT' || PL.to === 'SEA') ? sea : to);
      return;
    }
    if (typeof sim.stance === 'function') sim.stance();
    const st = typeof CORE.siteOf === 'function' ? CORE.siteOf(from.id) : null;
    const stand = (st && PL.stand !== false) ? (PL.stand && typeof PL.stand === 'object' ? PL.stand : st.stand) : null;
    const stSite = (st && stand && stand !== st.stand) ? Object.assign({}, st, { stand }) : st;
    if (stand) {
      CORE.placeAtStand(sim, from, stand);
      ap.setRoute(from, to);
      ap.departFrom(from, to, stSite);
    } else {
      CORE.placeAtAerodrome(sim, from);
      ap.setRoute(from, to);
    }
  }
  // the step index runs on across a reset (a command stamped before it keeps its place); the epoch counts them
  function fresh() {
    sim.reset(0);
    H.ap = mkPilot();
    place();
    H.started = false; H.epoch++;
  }
  fresh();

  // app.js resyncPhase (the hand given back to the pilot)
  const GROUND = ['DEPART', 'TAXI', 'LINEUP', 'HOLD', 'STOP', 'ROLL', 'LIFTOFF', 'ROLLOUT', 'STOPPED', 'ABORT', 'PUTDOWN'];
  function resyncPhase() {
    const ap = H.ap, onG = sim.wheelsOnGround(), cg = sim.cgPos(), v = sim.cgVel();
    const agl = cg[1] - world.terrainH(cg[0], cg[2]);
    const Vg = Math.hypot(v[0], v[2]);
    const wasGround = GROUND.indexOf(ap.phase) >= 0;
    if (onG === 0 && agl > 10 && wasGround) return 'CLIMB';
    if (onG >= 2 && Vg < 15 && !wasGround) return 'ROLLOUT';
    return ap.phase;
  }
  function writeCtl(set) {
    const c = sim.ctl;
    for (const k of Object.keys(set)) {
      if (k !== 'eng') { c[k] = set[k]; continue; }
      c.eng = Array.isArray(set.eng) ? set.eng.map(e => (e ? Object.assign({}, e) : e)) : null;
    }
  }
  // INP.write's door: the hand's axes every step it is on; an engine lever only where the aeroplane has one
  function writeHand(h) {
    const c = sim.ctl;
    for (const k of ['de', 'da', 'dr', 'thr', 'brake', 'flap']) if (h[k] != null) c[k] = h[k];
    if (Array.isArray(h.eng) && Array.isArray(c.eng))
      for (let i = 0; i < c.eng.length && i < h.eng.length; i++) if (h.eng[i] != null && c.eng[i]) c.eng[i].thr = h.eng[i];
  }
  function apply(c) {
    const ap = H.ap;
    switch (c.cmd) {
      case 'ctl': writeCtl(c.set || {}); break;
      case 'hand': H.hand = c.ctl || null; break;
      case 'start': H.started = true; break;
      case 'hold': H.started = false; break;
      case 'manual':
        if (!!c.on === H.manual) break;
        H.manual = !!c.on;
        if (!H.manual) {
          if (ap.reEngage) ap.reEngage({ phase: resyncPhase() });
          if (ap.budget) ap.budget = Math.max(ap.budget, ap.t + 300);
        }
        break;
      case 'setEngine': {
        // the cockpit's starterOk is the page's (the bus): the view reads it when the key turns and sends it along
        const had = Object.prototype.hasOwnProperty.call(sim, 'starterOk'), was = sim.starterOk;
        if ('starterOk' in c) sim.starterOk = () => !!c.starterOk;
        sim.setEngine(c.i, c.patch);
        if (had) sim.starterOk = was; else delete sim.starterOk;
        break;
      }
      case 'impulse': sim.impulse(c.i, c.ix || 0, c.iy || 0, c.iz || 0); break;
      case 'setCard': if (ap.setCard) ap.setCard(c.card || {}); break;
      case 'setDay': world.setDay(c.day || {}); H.worldV++; break;
      case 'reset': fresh(); break;   // app.js fullReset: a fresh pilot on the same route, held until a 'start'
    }
  }
  // a command queued for step k (the next boundary when absent or past)
  H.queueCmd = c => {
    const k = c.k == null ? H.steps : c.k;
    const e = { k, c };
    let i = H.queue.length;
    while (i > 0 && H.queue[i - 1].k > k) i--;
    H.queue.splice(i, 0, e);
  };
  function applyDue() {
    while (H.queue.length && H.queue[0].k <= H.steps) {
      const e = H.queue.shift();
      if (e.c.k != null && e.c.k < H.steps) H.late++;
      if (H.log.length >= SIM_HOST_LOG) { H.log.shift(); H.logDropped++; }
      H.log.push({ k: H.steps, c: e.c });
      apply(e.c);
    }
  }
  // ONE STEP: app.js loop()'s `script(1/60); sim.step(1/60)`, the commands before it, the day after it
  H.step = () => {
    applyDue();
    const ap = H.ap, dt = SIM_HOST_DT;
    if (!H.started) sim.ctl.brake = 0.6;
    else if (H.manual) {
      if (H.hand) writeHand(H.hand);
      if (ap.box && ap.box.on) ap.update(dt); else ap.t += dt;
    } else ap.update(dt);
    sim.step(dt);
    if (dayOn && world.dayTick) { const cg = sim.cgPos(); world.dayTick(dt, sim.t, cg[0], cg[2]); }
    H.steps++;
  };
  H.diverged = () => !Number.isFinite(sim.p[1]);

  // THE SNAPSHOT: the head, p, v, the fuel masses into `f` (a Float64Array of H.len)
  H.write = (f, x) => {
    const cg = sim.cgPos(), cv = sim.cgVel();
    f[S.STEP] = H.steps; f[S.T] = sim.t; f[S.WV] = H.worldV; f[S.N] = n;
    f[S.FLAGS] = (H.diverged() ? S.F_DIVERGED : 0) | (withV ? S.F_V : 0) | (x.running ? S.F_RUNNING : 0) |
                 (H.manual ? S.F_MANUAL : 0) | (H.started ? S.F_STARTED : 0);
    f[S.CG] = cg[0]; f[S.CG + 1] = cg[1]; f[S.CG + 2] = cg[2];
    f[S.CGV] = cv[0]; f[S.CGV + 1] = cv[1]; f[S.CGV + 2] = cv[2];
    f[S.TOTALM] = sim.totalM; f[S.WHEELS] = sim.wheelsOnGround(); f[S.SMAX] = sim.stats().smax;
    f[S.LATE] = H.late; f[S.EPOCH] = H.epoch; f[S.NF] = fuelIdx.length;
    f[S.SEQ] = x.seq; f[S.WALL] = x.wall; f[S.STEPMS] = x.stepMs; f[S.DIL] = x.dil; f[S.DROPPED] = x.droppedS;
    f[S.MAXMS] = x.maxMs; f[S.RAN] = x.ran; f[S.ALLOCS] = x.allocs; f[S.RATE] = x.rate;
    let o = S.HEAD;
    const p = sim.p, v = sim.v, N3 = 3 * n;
    for (let i = 0; i < N3; i++) f[o + i] = p[i];
    o += N3;
    if (withV) { for (let i = 0; i < N3; i++) f[o + i] = v[i]; o += N3; }
    for (let j = 0; j < fuelIdx.length; j++) f[o + j] = sim.m[fuelIdx[j]];
  };
  const rare = {};
  H.meta = () => {
    const ap = H.ap, A = {};
    for (const k of Object.keys(ap)) {
      if (SIM_HOST_AP_SKIP.indexOf(k) >= 0) continue;
      const d = Object.getOwnPropertyDescriptor(ap, k);
      if (!d || d.get || typeof d.value === 'function') continue;
      const v = d.value;
      if (v === null || typeof v !== 'object') { A[k] = v; continue; }
      if (k === 'route') { A.route = { from: v.from && v.from.id, to: v.to && v.to.id }; continue; }
      if (k === 'report') {
        const sig = (v.verdicts ? v.verdicts.length : 0) + ':' + (v.phases ? v.phases.length : 0) + ':' + v.outcome + ':' + !!v.landing;
        if (rare.report !== sig) { rare.report = sig; A.report = simHostPlain(v, 5); }
        continue;
      }
      if (SIM_HOST_AP_RARE.indexOf(k) >= 0) { if (rare[k] !== v) { rare[k] = v; A[k] = simHostPlain(v, 5); } continue; }
      A[k] = simHostPlain(v, 4);
    }
    for (const k of SIM_HOST_AP_RARE) if (!(k in ap) && rare[k] !== undefined) { rare[k] = undefined; A[k] = null; }
    const HY = sim.hydro;
    return {
      out: simHostPlain(sim.out, 3, ['hydro']),
      eng: simHostPlain(sim.eng, 3),
      fuel: simHostPlain(sim.fuel, 3),
      hydro: HY ? { wet: HY.wet, tick: HY.tick, floats: HY.floats.map(fx => ({ side: fx.side, wet: fx.wet, out: simHostPlain(fx.out, 2), lam: fx.lam.slice() })) } : null,
      wheels: sim.wheelContacts ? sim.wheelContacts() : null,
      ctl: simHostPlain(sim.ctl, 3),
      ap: A,
    };
  };
  // the pilot's rare fields go again after a re-init of the view (a new epoch)
  H.forgetRare = () => { for (const k of Object.keys(rare)) delete rare[k]; };
  H.ready = () => ({ kind: 'ready', n, substeps: def.params.substeps, withV, len: LEN, fuelIdx: fuelIdx.slice(),
                     slots: SIM_SNAP, dt: SIM_HOST_DT, defSig: simHostDefSig(def), epoch: H.epoch });
  return H;
}

// what the page's own buildGen must agree with: the node count and the rest
// pose, FNV over the float64 bytes (a stale tools/flight_core.js in a cache
// would build another aeroplane - the view refuses it)
function simHostDefSig(def) {
  const a = new Float64Array(def.nodes.length * 4);
  def.nodes.forEach((nd, i) => { a[i * 4] = nd.p[0]; a[i * 4 + 1] = nd.p[1]; a[i * 4 + 2] = nd.p[2]; a[i * 4 + 3] = nd.m; });
  const u = new Uint8Array(a.buffer);
  let h = 2166136261;
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0;
  return def.nodes.length + ':' + h.toString(16);
}

// ---- THE THREAD: messages, the clock, the buffers --------------------------
// port: { post(msg, transfer), on(fn(msg)), close() } - self in a browser
// worker, parentPort under node's worker_threads (the gate)
function simHostBody(CORE, SH, port) {
  const S = SH.SIM_SNAP;
  const wallNow = () => performance.timeOrigin + performance.now();
  let H = null, world = null, bootInfo = null;
  let pool = [], allocs = 0, seq = 0;
  let running = false, wall0 = 0, step0 = 0, rate = 1, timer = null;
  // G612's readings: a step's cost (ms, eased), the dilation's window (sim s at the set rate over wall s,
  // decaying over a second) and the sim time let go when the physics cannot hold real time
  const P = { stepMs: 0, simW: 0, wallW: 0, lastWall: 0, droppedS: 0, guarded: 0 };
  const dil = () => (P.wallW > 0.2 ? P.simW / P.wallW : 1);
  const post = (m, tr) => { try { port.post(m, tr || []); } catch (e) { /* the page is gone */ } };
  function publish(ran, maxMs) {
    let buf = null;
    while (pool.length && !buf) { const b = pool.pop(); if (b.byteLength === H.len * 8) buf = b; }
    if (!buf) { buf = new ArrayBuffer(H.len * 8); allocs++; }
    H.write(new Float64Array(buf), { seq: seq++, wall: wallNow(), stepMs: P.stepMs, dil: dil(), droppedS: P.droppedS,
                                     maxMs, ran, allocs, rate, running });
    post({ kind: 'snap', buf, meta: H.meta() }, [buf]);
  }
  function stepTimed() {
    const s0 = performance.now();
    H.step();
    const ms = performance.now() - s0;
    P.stepMs = P.stepMs ? P.stepMs + 0.1 * (ms - P.stepMs) : ms;
    return ms;
  }
  function anchor() { wall0 = wallNow(); step0 = H.steps; P.lastWall = wall0; }
  function pump() {
    timer = null;
    if (!running || !H) return;
    const t = wallNow();
    const dW = Math.min(0.25, Math.max(0, (t - P.lastWall) / 1000));
    P.lastWall = t;
    let owed = Math.floor((t - wall0) / 1000 * 60 * rate) - (H.steps - step0);
    if (owed > SIM_HOST_CATCH) {
      // the physics cannot hold real time: the excess is let go, and the dilation says so
      const drop = owed - SIM_HOST_CATCH;
      wall0 += drop / (60 * rate) * 1000; P.droppedS += drop / 60; P.guarded++;
      owed = SIM_HOST_CATCH;
    }
    let ran = 0, maxMs = 0;
    while (ran < owed) {
      const ms = stepTimed(); ran++;
      if (ms > maxMs) maxMs = ms;
      if (H.diverged()) { running = false; break; }
    }
    const k = Math.exp(-dW);
    P.simW = P.simW * k + ran / 60 / rate; P.wallW = P.wallW * k + dW;
    if (ran) publish(ran, maxMs);   // one snapshot a turn: the newest state is the only one the page draws
    if (!running) return;
    const next = wall0 + (H.steps - step0 + 1) / (60 * rate) * 1000;
    timer = setTimeout(pump, Math.max(0, next - wallNow()));
  }
  function stopClock() { running = false; if (timer) { clearTimeout(timer); timer = null; } }
  function initHost(m) {
    stopClock();
    const keep = m.world === 'keep' ? world : null;
    const t0 = performance.now();
    H = SH.makeSimHost(CORE, m, keep);
    world = H.world;
    pool = []; seq = 0;
    for (let i = 0; i < SIM_HOST_POOL; i++) pool.push(new ArrayBuffer(H.len * 8));
    allocs = 0;
    const r = H.ready();
    r.initMs = performance.now() - t0; r.boot = bootInfo;
    post(r);
    publish(0, 0);
  }
  function onMsg(m) {
    if (!m) return;
    try {
      switch (m.cmd) {
        case 'init':
          if (m.world && m.world.fetch) {
            const F = m.world.fetch, t0 = performance.now();
            SH.simHostFetchBoot(F.base, F.name, { hydro: F.hydro }).then(boot => {
              bootInfo = { fetchMs: performance.now() - t0, bytes: boot ? SH.simHostBootBytes(boot) : 0 };
              initHost(Object.assign({}, m, { world: Object.assign({}, m.world, { boot, fetch: null }) }));
            }).catch(err => post({ kind: 'error', error: String(err && err.stack || err) }));
            return;
          }
          if (m.world && m.world.boot) bootInfo = { bytes: SH.simHostBootBytes(m.world.boot) };
          initHost(m);
          return;
        case 'release': if (m.buf) pool.push(m.buf); return;
        case 'run': if (H && !running) { running = true; anchor(); pump(); } return;
        case 'pause': stopClock(); if (H) publish(0, 0); return;
        case 'rate': rate = m.x > 0 ? m.x : 1; if (running) anchor(); return;
        case 'steps': {
          // LOCKSTEP: exactly n steps now, a snapshot after each (`every`) or after the last
          if (!H) return;
          stopClock();
          const n = m.n | 0, each = !!m.every;
          let maxMs = 0, ran = 0;
          while (ran < n) {
            const ms = stepTimed(); ran++;
            if (ms > maxMs) maxMs = ms;
            if (each) publish(1, ms);
            if (H.diverged()) break;
          }
          if (!each) publish(ran, maxMs);
          return;
        }
        case 'snap': if (H) publish(0, 0); return;
        case 'resend': if (H) { H.forgetRare(); publish(0, 0); } return;   // a new view: the pilot's rare fields again
        case 'log': if (H) { post({ kind: 'log', list: H.log.slice(), dropped: H.logDropped, late: H.late }); if (m.clear) H.log.length = 0; } return;
        case 'ping': post({ kind: 'pong', t: m.t, tw: wallNow(), buf: m.buf }, m.buf ? [m.buf] : []); return;
        case 'state': post({ kind: 'state', running, rate, stepMs: P.stepMs, dilation: dil(), droppedS: P.droppedS, guarded: P.guarded,
                             allocs, steps: H ? H.steps : 0, late: H ? H.late : 0, queued: H ? H.queue.length : 0 }); return;
        case 'stop': stopClock(); H = null; world = null; if (port.close) port.close(); return;
        case 'batch': if (H) for (const c of m.list || []) H.queueCmd(c); return;
        default: if (H) H.queueCmd(m);
      }
    } catch (err) {
      post({ kind: 'error', error: String(err && err.stack || err) });
    }
  }
  port.on(onMsg);
}

// the Blob's source: this file and the built core bundle, by URL next to the
// page, then the body. `ver` busts a stale cache: FLYDIY_BUILD for this file,
// FLYDIY_CORE_SHA for the core (the inlined core's own hash).
function simHostSource(base, ver, coreVer) {
  const q = v => (v ? '?v=' + encodeURIComponent(v) : '');
  return 'self.module = { exports: {} };\n' +
    'importScripts(' + JSON.stringify(base + 'src/viewer/sim_host.js' + q(ver)) + ');\n' +
    'const SH = self.module.exports; self.module = { exports: {} };\n' +
    'importScripts(' + JSON.stringify(base + 'tools/flight_core.js' + q(coreVer)) + ');\n' +
    'const CORE = { ' + SIM_HOST_CORE.map(k => k + ": typeof " + k + " !== 'undefined' ? " + k + ' : undefined').join(', ') + ' };\n' +
    'SH.simHostBody(CORE, SH, { post: function (m, tr) { self.postMessage(m, tr || []); },\n' +
    '  on: function (f) { self.onmessage = function (e) { f(e.data); }; }, close: function () { self.close(); } });\n';
}

// ---- the page's side --------------------------------------------------------
// One worker per flight. Null when there is no worker to be had (file://, no
// Worker) - the caller keeps the inline loop, byte for byte (ARCH §2.3).
function simHostStart(onMessage, onError) {
  try {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' ||
        typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return null;
    const base = new URL('.', location.href).href;
    const W = typeof window !== 'undefined' ? window : {};
    const url = URL.createObjectURL(new Blob([simHostSource(base, W.FLYDIY_BUILD, W.FLYDIY_CORE_SHA)], { type: 'text/javascript' }));
    const w = new Worker(url);
    const kill = () => { try { w.terminate(); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {} };
    w.onmessage = e => { try { onMessage(e.data); } catch (err) { console.warn('sim worker message:', err); } };
    w.onerror = err => { kill(); if (onError) onError(err && err.message || 'worker failed'); };
    return {
      post: (m, tr) => { try { w.postMessage(m, tr || []); return true; } catch (e) { return false; } },
      base, kill,
    };
  } catch (e) { return null; }
}

if (typeof window !== 'undefined') {
  window.SIM_HOST = { start: simHostStart, source: simHostSource, trimBoot: simHostTrimBoot, fetchBoot: simHostFetchBoot,
                      KEYS: SIM_HOST_KEYS, SNAP: SIM_SNAP };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { SIM_HOST_KEYS, SIM_HOST_CORE, SIM_HOST_DT, SIM_HOST_CATCH, SIM_SNAP, simHostTrimBoot, simHostBootBytes,
                     simHostFetchBoot, simHostPlain, makeSimHost, simHostDefSig, simHostBody, simHostSource, simHostStart };
