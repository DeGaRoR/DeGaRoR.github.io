// ============================================================
// THE PAGE, FLOWN THROUGH THE SOLVER'S THREAD (G815, 2026-09-28; C1b of
// QUEUE-C, futureDesigns/ARCH-2026-09-27.md §2.2-2.5 steps 2-3). Behind
// ?simw=1, default off: without the flag app.js never makes this and its loop
// is the inline loop it always was, byte for byte.
//
// sim_host.js is the worker (C1a, G810); sim_view.js decodes its snapshots.
// This is the glue app.js calls from its loop's step block:
//
//   THE FLIGHT   is the page's own. fullReset / applyRoute build and place
//                the page's sim and pilot as they always did; the first frame
//                that finds a flight it has not seen (a new `ap`) asks the
//                worker for the SAME flight (the spec, the route, the stand the
//                page walked, seated on the ground - G700 - the pilot kind and
//                the page's shakedown) and HOLDS (no step) until the worker's
//                step-0 snapshot is back. That snapshot must equal the page's
//                placed aeroplane to the bit (p, engines, fuel, the pilot's
//                phase) - else this flight stays INLINE, from the page's own
//                untouched state, and says why (state().reason).
//   THE STEP     "post the inputs, take the newest snapshot". The inputs are
//                every write the page makes into the aeroplane, as commands:
//                sim.ctl becomes a recording view of the page's own ctl object
//                (every key the cockpit and the hand write - brake, trim,
//                fuel, the levers, ctl.eng[i].x - collected over the frame);
//                setEngine / impulse; the start (`started`), the manual toggle
//                and the hand (INP.write into a scratch, once a frame: the input
//                is read once a frame, so every step of the frame wrote the same
//                numbers); the world's ops (below). THE RIG CLOCK (PACE.legacy:
//                webdriver, headless, the page in node) is LOCKSTEP: the commands
//                are stamped with the step index they apply before and the frame
//                asks for exactly its steps ({cmd:'steps'}), so the flight is the
//                inline loop's step for step whatever the thread's timing - the
//                picture is one frame behind. A real browser runs the WORKER'S
//                clock ({cmd:'run'}, sim time against wall time, G612's dilation
//                in the worker) and the page interpolates the two newest
//                snapshots at T - 1 step (sim_view.js frame).
//   THE MIRROR   the newest snapshot written INTO the page's own sim and pilot
//                (p, v, the fuel nodes' masses in place; out / eng / fuel / hydro /
//                ctl / the pilot's fields merged), and the reads the solver
//                answers from its closure - t, totalM, cgPos, cgVel, the wheels,
//                stats - answered from the snapshot while the flight is live. So
//                every reader on the page (poseModel, the flex skin, the cockpit,
//                the director, the HUD, the rail) keeps its lines. axes() and
//                bodyOrigin() are the page solver's own, on the written p.
//                sim.step on the page is a counted no-op (a hidden sim writer);
//                sim.reset takes the mirror down first (every re-placement - a
//                reset, the shed, the skip to line-up - starts with one), so the
//                next flight is the page's again and is asked for anew.
//   THE WORLD    one worker per page, its world kept across flights: the
//                trimmed island boot fetched through the page's own URLs
//                (simHostFetchBoot: the cache-first sw.js path, no second
//                download), the premises record the page composed, the page's
//                day (its spec), and the page world's OBSTACLES: the registry's
//                add / move / remove / clear (render_premises hitAdd - houses,
//                props, cars, the parked aeroplanes - the club hangar, the
//                scenery's masts and cars) and the day / weather calls, wrapped on
//                the page world and replayed there as commands; what stood before
//                the worker went up goes first, in id order. Every one bumps the
//                worker world's version, carried in every snapshot and ASSERTED
//                here (lockstep: equal to what was stamped before that step;
//                real time: never ahead, and the lag counted).
// ============================================================
const SIM_LINK = (() => {
  'use strict';
  const WORLD_FNS = ['setDay', 'setWeather', 'setWind', 'setSea'];
  // the pilot's fields assigned whole (never merged into the page's objects: a site or a plan may be shared)
  const AP_WHOLE = ['legs', 'path', 'plan', 'taxiOut', 'site', 'report'];
  const AP_SKIP = ['route', 'nav', 'sheet'];

  const isPlain = o => o !== null && typeof o === 'object' && !Array.isArray(o) && !ArrayBuffer.isView(o);
  // src's fields into dst (dst's own objects kept, so a reader holding one sees the new numbers)
  function merge(dst, src, depth, skip) {
    if (!dst || !src) return;
    for (const k of Object.keys(src)) {
      if (skip && skip.indexOf(k) >= 0) continue;
      const v = src[k];
      const d = Object.getOwnPropertyDescriptor(dst, k);
      if (d && (d.get || d.set)) { if (d.set) dst[k] = v; continue; }
      if (d && d.writable === false) continue;
      const cur = dst[k];
      if (depth > 0 && isPlain(v) && isPlain(cur)) merge(cur, v, depth - 1);
      else if (Array.isArray(v) && ArrayBuffer.isView(cur) && cur.length === v.length) cur.set(v);
      else dst[k] = v;
    }
  }
  // THE PREMISES CATALOGUE'S SCRIPTS (27_premises.js GENERATORS, read off window by collect): the worker imports those
  // the page has, after three (they build with it at load), so its world composes the premises as the page's did
  const GEN_FILES = { HOUSE_GEN: ['tools/_house_kit.js', 'tools/_house_gen.js'], BIG_GEN: ['tools/_big_gen.js'], SHED_GEN: ['tools/_shed_gen.js'],
                      HANGAR_GEN: ['tools/_hangar_gen.js'], TOWER_GEN: ['tools/_tower_gen.js'], TRAM_GEN: ['tools/_tram_gen.js'],
                      TOTEM_GEN: ['tools/_totem_gen.js'], SPORT_GEN: ['tools/_sport_gen.js'], MARINE_GEN: ['tools/_marine_gen.js'] };
  function catalogueScripts(W) {
    const out = [];
    for (const g of Object.keys(GEN_FILES)) if (W[g]) for (const f of GEN_FILES[g]) if (out.indexOf(f) < 0) out.push(f);
    return out.length ? ['vendor/three.min.js'].concat(out) : out;
  }
  const copyEng = e => (Array.isArray(e) ? e.map(x => (x && typeof x === 'object' ? Object.assign({}, x) : x)) : e == null ? null : e);

  // o: { get() -> the app's state, rig() -> PACE.legacy, premises() -> the record the page's world was made on }
  function make(o) {
    const W = typeof window !== 'undefined' ? window : {};
    const S0 = o.get();
    const world = S0.world;
    const st = {
      on: true, phase: 'idle', reason: null, mode: o.rig() ? 'lockstep' : 'realtime',
      flights: 0, inline: 0, stepsPosted: 0, lastStep: 0, snaps: 0, cmds: 0, batches: 0, strays: 0,
      wvSent: 0, wvSeen: 0, wvBad: 0, wvLagFrames: 0, wvMaxLag: 0, placeOk: null, placeDiff: null,
      initMs: null, bootFetchMs: null, bootBytes: null, readyWaitFrames: 0, errors: [], lastError: null,
      physMs: 0, host: null,
      premEdits: 0, prewarmed: false, worldMs: null, legs: 0, diverged: false,
    };
    let host = null, dead = null;          // the worker's handle; why there is none
    let worldSent = false;                 // the worker's world is made (kept across flights)
    let flight = null;                     // { ap, sim, def, epoch, view, ready, live, ... }
    let lastSim = null;                    // G820: the page's sim the worker's last flight flew (null: it flew inline since)
    let running = false, rateSent = 1;
    let wvPend = [];                       // lockstep: [k, version after] of the stamped world commands, in send order
    let opsQ = [];                         // the world's ops since the last flush
    const wvQ = [];                        // real time: [frame, version sent by it] not yet seen in a snapshot
    const baseIds = new Set();
    const placeWait = new Map();           // G1096: a rig's placements the worker has not answered yet (place, below)
    let placeSeq = 0;

    // ---- THE WORLD'S OPS: the page world's registry and day calls, wrapped once ----------------------
    // G820 (C1c): wrapped when the worker is UP (start), not at make: a page whose worker cannot be had (no Worker,
    // file://, the page in node without the shim) keeps its world untouched and its loop the inline one, byte for byte
    const R = world && world.obstacles;
    if (R) for (const r of R.list()) baseIds.add(r.id);   // makeWorld's own (the settle buildings): the worker's world makes them too
    let wrapped = false;
    let windT = NaN, windFirst = null, windFrame = [];
    function wrapWorld() {
    if (wrapped) return;
    wrapped = true;
    if (R) {
      const add = R.add, move = R.move, remove = R.remove, clear = R.clear;
      R.add = function (x) {
        const id = add.apply(this, arguments);
        if (id && host) { const r = R.get(id); opsQ.push({ op: 'add', id, x: r.x, z: r.z, yaw: r.yaw, y0: r.y0, shape: r.shape, tag: r.tag }); }
        return id;
      };
      R.move = function (id, x, z, yaw, y0) { const ok = move.apply(this, arguments); if (ok && host) opsQ.push({ op: 'move', id, x, z, yaw, y0 }); return ok; };
      R.remove = function (id) { const ok = remove.apply(this, arguments); if (ok && host) opsQ.push({ op: 'remove', id }); return ok; };
      R.clear = function () { clear.apply(this, arguments); if (host) opsQ.push({ op: 'clear' }); };
    }
    // G1330 (TREE-HITBOX): THE TRUNKS THE VIEWER DRAWS (world.treeHits: the fill's chunk parts, the woodland, the
    // premises' trees) ride the same queue - a set is its key and its Float32Array (cloned on the post), a drop its key
    const TH = world && world.treeHits;
    if (TH) {
      const set = TH.set, drop = TH.drop, clr = TH.clear;
      TH.set = function (key, arr) { const n = set.apply(this, arguments); if (host) opsQ.push({ op: 'tset', key, arr: TH.get(key) }); return n; };
      TH.drop = function (key) { const ok = drop.apply(this, arguments); if (ok && host) opsQ.push({ op: 'tdrop', key }); return ok; };
      TH.clear = function () { clr.apply(this, arguments); if (host) opsQ.push({ op: 'tclear' }); };
    }
    for (const fn of WORLD_FNS) {
      if (!world || typeof world[fn] !== 'function') continue;
      const f0 = world[fn];
      world[fn] = function () {
        const r = f0.apply(this, arguments);
        if (host) { flushOps(); worldCmd({ cmd: 'world', fn, args: Array.prototype.slice.call(arguments).map(a => (a == null ? a : JSON.parse(JSON.stringify(a)))) }); }
        return r;
      };
    }
    // G820 (C1c): THE WORLD EDITOR'S EDITS. Every edit (and every later rebuild) recomposes the page's world through
    // world.premises.set (render_premises composeNow); the worker's world recomposes on the same record at the same
    // step boundary - its obstacles follow through the registry's own ops (hitAdd / remove), and the version counts it
    const PMS = world && world.premises;
    if (PMS && typeof PMS.set === 'function') {
      const set0 = PMS.set;
      PMS.set = function (rec, extra) {
        const r = set0.apply(this, arguments);
        if (host) { flushOps(); worldCmd({ cmd: 'premises', rec: rec == null ? null : JSON.parse(JSON.stringify(rec)), extra: !!extra }); st.premEdits++; }
        return r;
      };
    }
    // a world command: stamped at the next step while a lockstep flight is live, else applied as it comes
    // THE VIEWERS' WIND QUERIES (atmo.js MIST, clouds.js, render_premises' animals: world.wind(0, y, 0, 0)). The
    // climate's sampler (09_climate.js wind) keeps a linearisation reference keyed on t: the FIRST call at a new t
    // re-centres it, a later call at the same t reuses it. Inline, those viewer calls sit between the frame's steps,
    // and at a flight's first substep (simT = 0) the solver finds t = 0 already the viewers' and samples in full
    // instead of re-centring on the aeroplane - a last-bits difference in step 1, and the worker has no viewers.
    // So the page's world.wind is watched: the first call of each run of one t, per frame (the calls that can move
    // the reference), replayed on the worker's world at the same step boundary ({cmd:'windq'}); at a flight's
    // start, the first call of the page's current run (the reference the inline solver would have found).
    if (world && typeof world.wind === 'function') {
      const w0 = world.wind;
      world.wind = function (x, y, z, t) {
        if (t !== windT) { windT = t; windFirst = [x, y, z, t]; }
        const L = windFrame.length;
        if (L < 32 && (!L || windFrame[L - 1][3] !== t)) windFrame.push([x, y, z, t]);
        return w0.call(this, x, y, z, t);
      };
    }
    }   // wrapWorld
    function worldCmd(c) {
      st.wvSent++;
      const lock = flight && flight.live && st.mode === 'lockstep';
      if (lock) { c.k = flight.posted; wvPend.push([c.k, st.wvSent]); }
      else wvPend.push([-1, st.wvSent]);
      if (flight && flight.live) flight.view.send(c); else post(c);
    }
    function flushOps() { if (!opsQ.length) return; const ops = opsQ; opsQ = []; worldCmd({ cmd: 'obst', ops }); }
    function liveOps() {
      const out = [];
      if (R) for (const r of R.list()) if (!baseIds.has(r.id)) out.push({ op: 'add', id: r.id, x: r.x, z: r.z, yaw: r.yaw, y0: r.y0, shape: r.shape, tag: r.tag });
      if (world && world.treeHits) for (const key of world.treeHits.keys()) out.push({ op: 'tset', key, arr: world.treeHits.get(key) });   // G1330
      return out;
    }

    // ---- THE WORKER -----------------------------------------------------------------------------------
    function post(m, tr) { if (!host) return false; st.cmds++; return host.post(m, tr); }
    function fail(why, err) {
      st.errors.push(why + (err ? ': ' + err : '')); if (st.errors.length > 20) st.errors.shift();
      st.lastError = why;
      try { console.warn('simw: ' + why, err || ''); } catch (e) {}
    }
    function start() {
      if (host || dead) return !!host;
      if (typeof SIM_HOST === 'undefined' || typeof SIM_VIEW === 'undefined') { dead = 'no sim_host.js / sim_view.js'; return false; }
      st.pre = catalogueScripts(W);
      host = SIM_HOST.start(onMsg, err => { fail('the worker died', err); dead = 'the worker died'; host = null; dropFlight('the worker died'); }, { pre: st.pre });
      if (!host) { dead = 'no Worker here (file://, a sandbox)'; st.phase = 'dead'; return false; }
      wrapWorld();
      return true;
    }
    // G820 (C1c): THE WORKER'S WORLD MADE BEFORE THE FIRST FLIGHT (app.js: the boot's end, in the shed) - the trimmed
    // boot fetched and the world made on the worker's thread while the player is in the shed, so the first roll-out
    // (which B8B9 made instant: no screen) does not hold the stand for it. The registry so far goes first.
    function worldMsg() {
      const isl = W.ISLAND_BOOT;
      return { premises: o.premises ? o.premises() : null, seed: 0, day: world.day ? world.day.spec() : null,
               opts: { groundRaster: !!W.FLYDIY_GROUND_RASTER },
               fetch: isl ? { base: host.base, name: isl.id, hydro: isl.hydro, raster: !!W.FLYDIY_GROUND_RASTER, variant: W.FLYDIY_TOWN ? (W.FLYDIY_TOWN.all ? 'town' : 'default') : W.FLYDIY_TOWN_VARIANT } : null, boot: null };
    }
    function prewarm() {
      if (worldSent || dead) return !dead;
      if (!start()) return false;
      const ops = liveOps();
      opsQ = [];
      if (ops.length) worldCmd({ cmd: 'obst', ops });
      post({ cmd: 'mkworld', world: worldMsg() });
      worldSent = true; st.prewarmed = true;
      return true;
    }
    function onMsg(m) {
      if (!m) return;
      if (m.kind === 'error') { fail('host', m.error); if (flight && !flight.view) dropFlight('the host threw while making the flight'); return; }
      if (m.kind === 'state') { st.host = m; return; }
      if (m.kind === 'world') { st.worldMs = m.ms; if (m.boot) { st.bootFetchMs = m.boot.fetchMs != null ? m.boot.fetchMs : null; st.bootBytes = m.boot.bytes; st.cookedCells = m.boot.cooked || 0; } return; }
      if (m.kind === 'probe') { st.probe = m; return; }
      // G1096: a rig's placement done in the worker (its snapshot came just before): mirrored now - a paused page
      // runs no frame to do it - and the rig's promise answered
      if (m.kind === 'placed') { const r = placeWait.get(m.id); placeWait.delete(m.id); if (flight && flight.live && flight.view) mirror(Infinity); if (r) r(m.cg); return; }
      if (!flight) { if (m.kind === 'snap' && host) post({ cmd: 'release', buf: m.buf }, [m.buf]); return; }
      if (m.kind === 'ready') { onReady(m); return; }
      if (m.kind === 'snap') {
        if (!flight.view) { if (host) post({ cmd: 'release', buf: m.buf }, [m.buf]); return; }
        const f = new Float64Array(m.buf), S = flight.ready.slots;
        if (f[S.EPOCH] !== flight.epoch) { post({ cmd: 'release', buf: m.buf }, [m.buf]); return; }   // a flight that is gone
        flight.view.take(m); st.snaps++;
        if (flight.live && f[S.STEP] > 0) checkWV(f[S.STEP], f[S.WV]);
        if (!flight.checked) placeCheck(f);
        // G820 (C1c): LOCKSTEP MIRRORS ON ARRIVAL. The rig's answer lands between two frames (the harness delivers it
        // at the turn's end), and whatever the page does THERE - a click on Fly on, the hand taken (INP.seed reads the
        // levers), the skip's pose asked of the aeroplane - must read the state the inline loop would have: this
        // one. The picture's frame still shows it (one frame behind, as C1b drew it).
        else if (flight.live && st.mode === 'lockstep') mirror(Infinity);
      }
    }
    function checkWV(step, wv) {
      st.wvSeen = wv;
      if (st.mode === 'lockstep') {
        let want = null;
        for (const e of wvPend) if (e[0] < step) want = e[1];
        if (want == null) want = flight ? flight.wv0 : 0;
        if (wv !== want) st.wvBad++;
        while (wvPend.length > 1 && wvPend[1][0] < step) wvPend.shift();
      } else if (wv > st.wvSent) st.wvBad++;
    }

    // ---- A FLIGHT: asked for, checked, then live ---------------------------------------------------
    function eligible(S) {
      if (S.curKey !== 'gen') return 'not the garage aeroplane (' + S.curKey + ')';
      if (!S.sim.hydro && !S.lastStart) return 'no start recorded (applyRoute never ran)';
      return null;
    }
    function dropFlight(why) {
      for (const r of placeWait.values()) r(null);   // G1096: a placement the worker will not answer for this flight
      placeWait.clear();
      if (!flight) return;
      detach();
      if (why) { flight.inline = why; st.reason = why; st.inline++; lastSim = null; }   // (the page's sim flies it: the worker's is not that one any more)
      if (host && running) { post({ cmd: 'pause' }); running = false; }
      st.phase = flight.inline ? 'inline' : 'idle';
    }
    function begin(S) {
      if (flight) detach();
      flight = { ap: S.ap, sim: S.sim, def: S.def, epoch: 0, view: null, ready: null, live: false, checked: false, posted: 0,
                 inline: null, frames: 0, wv0: 0, sent: { started: null, manual: null, over: false }, lastStep: 0, shown: 0 };
      st.flights++; st.placeOk = null; st.placeDiff = null; st.reason = null; st.stepsPosted = 0; st.lastStep = 0;
      const why = eligible(S) || (start() ? null : dead);
      if (why) { flight.inline = why; st.reason = why; st.inline++; st.phase = 'inline'; lastSim = null; return; }
      const ls = S.lastStart;
      // G820 (C1c): the skip to line-up (placeLinedUp - from the button, or the 'lined up' start) is the host's too:
      // the stand the taxi would start from, the pose asked of a pilot planning from it
      const lined = !!(ls && ls.skipped && ls.stand);
      const place = { from: S.fromId, to: S.destId, stand: (ls && (ls.taxi || lined) && ls.stand) ? JSON.parse(JSON.stringify(ls.stand)) : false, seat: true, lineup: lined };
      // ...and the SITE the page's skip plans on: lastStart's, taken when the flight began - an editor's edit since
      // (a parked aeroplane moved: the site's way out round them) is not in it, and the page's pilot plans on it
      if (lined && ls.stSite) { try { place.site = typeof structuredClone === 'function' ? structuredClone(ls.stSite) : JSON.parse(JSON.stringify(ls.stSite)); } catch (e) { place.site = null; } }
      let shake = null;
      try { shake = S.shake ? S.shake() : null; } catch (e) { shake = null; }
      const m = { cmd: 'init', spec: S.genSpec ? JSON.parse(JSON.stringify(S.genSpec)) : null, place,
                  pilot: { kind: S.pilotChoice || 'auto', shakedown: shake, nav: true }, withV: true, day: world.day ? world.day.spec() : null,
                  damage: typeof FLYDIY_DAMAGE === 'boolean' ? FLYDIY_DAMAGE : null };   // G1898: the page's ?damage
      if (cardNext && cardNext.ap === S.ap) m.pilot.card = cardNext.card;
      cardNext = null;
      // G820 (C1c): ONE SIM PER BUILD, as the page's: the worker keeps the sim it flew last when the page flies the same
      // sim object again (a reset, the skip, the shed's round trip), and a sim it makes anew takes the page's sim.out
      // (a reset does not clear it; the pilot's first update reads it when the flight starts `started`)
      m.keepSim = !!(lastSim && lastSim === S.sim);
      try { const o0 = {}; for (const k of Object.keys(S.sim.out || {})) if (k !== 'hydro') o0[k] = S.sim.out[k];
            m.out = typeof structuredClone === 'function' ? structuredClone(o0) : JSON.parse(JSON.stringify(o0)); } catch (e) { m.out = null; }
      lastSim = S.sim;
      if (!worldSent) {
        // the registry so far (the premises stream, the hangar, the parked aeroplanes): before the world is placed on
        const ops = liveOps();
        opsQ = [];
        if (ops.length) worldCmd({ cmd: 'obst', ops });
        m.world = worldMsg();
        m.day = null;
      } else { flushOps(); m.world = 'keep'; }
      worldSent = true;
      flight.t0 = Date.now();
      flight.wv0 = st.wvSent;
      wvPend = wvPend.filter(e => e[0] < 0);   // what came before this flight applies before its step 0
      post(m);
      st.phase = 'init';
    }
    function onReady(m) {
      if (!flight || flight.inline) return;
      st.initMs = m.initMs; if (m.boot) { st.bootFetchMs = m.boot.fetchMs != null ? m.boot.fetchMs : null; st.bootBytes = m.boot.bytes; st.cookedCells = m.boot.cooked || 0; }
      flight.ready = m; flight.epoch = m.epoch;
      // G1166b: ?starvex=0 - a starved frame draws the newest snapshot (the old jump), for an A/B
      const sx = (() => { try { return !/[?&]starvex=0(&|$)/.test(location.search || ''); } catch (e) { return true; } })();
      // ?ringdelay=<ms> - a FIXED ring delay (a stress test: under the snapshots' lateness, the starved frames come often)
      const rd = (() => { try { const x = /[?&]ringdelay=([0-9.]+)/.exec(location.search || ''); return x ? +x[1] / 1000 : null; } catch (e) { return null; } })();
      // G1530: ?poseback=0 - the drawn clock as it was (a later frame may draw an earlier sim time), for an A/B
      const mono = (() => { try { return !/[?&]poseback=0(&|$)/.test(location.search || ''); } catch (e) { return true; } })();
      flight.view = SIM_VIEW.make(flight.def, Object.assign({ ready: m, post: (x, tr) => post(x, tr), starveEx: sx, monotonic: mono }, rd != null ? { delayS: rd } : {}));
      if (flight.view.mismatch) { dropFlight('the worker built another aeroplane (a stale core in a cache?)'); return; }
    }
    // step 0 against the page's placed aeroplane: to the bit, or this flight stays inline
    function placeCheck(f) {
      flight.checked = true;
      const S = flight.ready.slots, sim = flight.sim, n3 = sim.n * 3, V = flight.view;
      const diff = [];
      for (let i = 0; i < n3; i++) if (!Object.is(f[S.HEAD + i], sim.p[i])) { diff.push('p[' + i + '] ' + f[S.HEAD + i] + ' vs ' + sim.p[i]); break; }
      const js = x => JSON.stringify(x);
      const pe = sim.eng ? sim.eng.map(e => ({ running: e.running, key: e.key, crank: e.crank })) : null;
      const we = V.eng ? V.eng.map(e => ({ running: e.running, key: e.key, crank: e.crank })) : null;
      if (js(pe) !== js(we)) diff.push('eng ' + js(pe) + ' vs ' + js(we));
      if (sim.fuel && V.fuel && sim.fuel.kg !== V.fuel.kg) diff.push('fuel ' + sim.fuel.kg + ' vs ' + V.fuel.kg);
      if (flight.ap.phase !== V.ap.phase) diff.push('phase ' + flight.ap.phase + ' vs ' + V.ap.phase);
      st.placeOk = !diff.length; st.placeDiff = diff.length ? diff.join('; ') : null;
      if (diff.length) { dropFlight('the worker placed another aeroplane: ' + diff[0]); return; }
      attach();
    }

    // ---- THE MIRROR: the page's sim answers from the snapshot while the flight is live ----------------
    let saved = null, ctlP = null;
    const patch = { set: null, eng: [] };
    function ctlProxy(real) {
      const els = new WeakMap(), arrs = new WeakMap();
      const elP = (i, el) => { let p = els.get(el); if (!p) { p = new Proxy(el, { set(t, k, v) { t[k] = v; patch.eng.push([i, k, v]); return true; } }); els.set(el, p); } return p; };
      const arrP = a => { let p = arrs.get(a); if (!p) { p = new Proxy(a, {
        get(t, k) { const v = t[k]; return (typeof k === 'string' && /^\d+$/.test(k) && v && typeof v === 'object') ? elP(+k, v) : v; },
        set(t, k, v) { t[k] = v; if (/^\d+$/.test(k)) { (patch.set = patch.set || {}).eng = copyEng(t); patch.eng = []; } return true; } }); arrs.set(a, p); } return p; };
      return new Proxy(real, {
        get(t, k) { const v = t[k]; return (k === 'eng' && Array.isArray(v)) ? arrP(v) : v; },
        set(t, k, v) {
          t[k] = v;
          (patch.set = patch.set || {})[k] = k === 'eng' ? copyEng(v) : v;
          if (k === 'eng') patch.eng = [];
          return true;
        },
      });
    }
    function attach() {
      const F = flight, sim = F.sim, V = F.view;
      const own = k => Object.getOwnPropertyDescriptor(sim, k);
      saved = {};
      for (const k of ['t', 'totalM', 'cgPos', 'cgVel', 'wheelsOnGround', 'wheelContacts', 'stats', 'step', 'setEngine', 'impulse', 'reset', 'ctl']) saved[k] = own(k);
      const realCtl = sim.ctl, orig = { setEngine: sim.setEngine, reset: sim.reset };
      F.realCtl = realCtl;
      ctlP = ctlProxy(realCtl);
      const def = (k, d) => Object.defineProperty(sim, k, Object.assign({ configurable: true, enumerable: true }, d));
      def('t', { get: () => V.t });
      def('totalM', { get: () => V.totalM });
      def('cgPos', { writable: true, value: () => V.cgPos() });
      def('cgVel', { writable: true, value: () => V.cgVel() });
      def('wheelsOnGround', { writable: true, value: () => V.wheelsOnGround() });
      def('wheelContacts', { writable: true, value: () => V.wheels || (saved.wheelContacts && saved.wheelContacts.value ? saved.wheelContacts.value() : null) });
      def('stats', { writable: true, value: () => V.stats() });
      def('step', { writable: true, value: () => { st.strays++; } });
      def('setEngine', { writable: true, value: (i, p) => {
        const c = { cmd: 'setEngine', i, patch: Object.assign({}, p) };
        if (p && p.start && typeof sim.starterOk === 'function') c.starterOk = !!sim.starterOk(i);
        stamp(c); V.send(c);
      } });
      def('impulse', { writable: true, value: (i, ix, iy, iz) => { const c = { cmd: 'impulse', i, ix, iy, iz }; stamp(c); V.send(c); } });
      // every re-placement starts with a reset: the mirror comes down first, the flight is the page's again
      def('reset', { writable: true, value: function () { dropFlight(null); flight = null; st.phase = 'idle'; return orig.reset.apply(sim, arguments); } });
      def('ctl', { writable: true, value: ctlP });
      patch.set = null; patch.eng = [];
      F.live = true; F.shown = F.lastStep = 0; st.diverged = false; st.crashed = false; st.dmg = null;
      st.phase = 'live';
      // step 0: the page's levers as they stand (the cockpit wrote under the hold), then who is flying
      const set = {};
      for (const k of Object.keys(realCtl)) set[k] = k === 'eng' ? copyEng(realCtl.eng) : realCtl[k];
      V.send({ cmd: 'ctl', set, k: 0 });
      if (windFirst) V.send({ cmd: 'windq', q: [windFirst], k: 0 });   // the reference the inline solver's step 1 would find
      // the convection the page's climate holds (its cache's exact inputs: the page's day met that key before the worker lived)
      if (world.climate && world.climate.convState) V.send({ cmd: 'conv', s: world.climate.convState(), k: 0 });
      windFrame = [];
    }
    function detach() {
      if (!saved || !flight) { saved = null; return; }
      const sim = flight.sim;
      for (const k of Object.keys(saved)) {
        if (saved[k]) Object.defineProperty(sim, k, saved[k]); else delete sim[k];
      }
      saved = null; ctlP = null; flight.live = false;
    }
    const stamp = c => { if (st.mode === 'lockstep' && flight) c.k = flight.posted; return c; };
    function mirror(T) {
      const F = flight, V = F.view, sim = F.sim;
      const fr = V.frame(st.mode === 'lockstep' ? Infinity : T);
      const f = V.snapshot(); if (!f) return 0;
      F.drawnT = fr && Number.isFinite(fr.t) ? fr.t : V.t;   // G1100: the sim time the mirrored (drawn) positions stand at
      const S = F.ready.slots;
      sim.p.set(V.p);
      if (V.v && sim.v) sim.v.set(V.v);
      const fi = F.ready.fuelIdx || [], oM = S.HEAD + sim.n * 3 * (F.ready.withV ? 2 : 1);
      for (let j = 0; j < fi.length; j++) sim.m[fi[j]] = f[oM + j];
      merge(sim.out, V.out, 3, ['hydro']);
      if (sim.eng && V.eng) for (let i = 0; i < sim.eng.length && i < V.eng.length; i++) merge(sim.eng[i], V.eng[i], 2);
      if (sim.fuel && V.fuel) merge(sim.fuel, V.fuel, 3);
      if (sim.hydro && V.hydro) {
        const H = sim.hydro, h = V.hydro; H.wet = h.wet; H.tick = h.tick;
        for (let i = 0; i < H.floats.length && i < h.floats.length; i++) { const a = H.floats[i], b = h.floats[i]; a.wet = b.wet; merge(a.out, b.out, 2); for (let j = 0; j < a.lam.length && j < b.lam.length; j++) a.lam[j] = b.lam[j];
          // G1180: the world vertices from the nodes just mirrored (sim_host keeps its tables), the wet panels from the worker
          if (a.ctx && a.ctx.fill && a.out.W) a.ctx.fill(a.out.W);
          if (b.per && a.out.per) { for (const o of a.out.per) o.wet = 0;
            for (let j = 0; j + 15 <= b.per.length; j += 15) { const o = a.out.per[b.per[j]]; if (!o) continue; o.wet = b.per[j + 1]; o.A = b.per[j + 2];
              let q = j + 3; for (const v of [o.c, o.n, o.Fp, o.Fm]) { v[0] = b.per[q++]; v[1] = b.per[q++]; v[2] = b.per[q++]; } } } }
      }
      const c = V.snapCtl;
      if (c) {
        const real = F.realCtl;
        for (const k of Object.keys(c)) {
          if (k !== 'eng') { real[k] = c[k]; continue; }
          if (Array.isArray(c.eng) && Array.isArray(real.eng) && real.eng.length === c.eng.length) c.eng.forEach((e, i) => { if (e && real.eng[i]) Object.assign(real.eng[i], e); else real.eng[i] = e; });
          else real.eng = copyEng(c.eng);
        }
      }
      merge(F.ap, V.ap, 3, AP_SKIP.concat(AP_WHOLE));
      for (const k of AP_WHOLE) if (k in V.ap && F.ap[k] !== V.ap[k]) F.ap[k] = V.ap[k];
      const step = f[S.STEP];
      F.lastStep = step; st.lastStep = step;
      if (f[S.FLAGS] & S.F_DIVERGED) st.diverged = true;
      if (S.F_CRASHED && (f[S.FLAGS] & S.F_CRASHED)) st.crashed = true;   // G1470
      st.dmg = V.dmg || null;
      return step;
    }

    // ---- THE LOOP'S DOORS -------------------------------------------------------------------------------
    // the step block: null = fly this frame inline (no worker, not this flight); else the frame's result
    // { ran: the steps the picture moved on, simDt: their sim seconds, hold: nothing flies yet (the frame owes nothing) }
    // (ts: G1100, the frame's own rAF timestamp - the moment the page draws for, on the vsync the inline loop owes its steps
    // against; none: now)
    function frame(nStep, simRate, ts) {
      if (dead && (!flight || flight.inline)) return null;   // no worker to be had: the page's loop, as it always was
      const S = o.get();
      if (!flight || S.ap !== flight.ap || S.sim !== flight.sim) begin(S);
      const F = flight;
      if (F.inline) return null;
      if (!F.live) { if (!F.view) st.readyWaitFrames++; return { ran: 0, simDt: 0, hold: true }; }
      const t0 = performance.now(), V = F.view;
      F.frames++;
      // the page's inputs since the last frame, as commands
      const cmd = c => { stamp(c); V.send(c); };
      if (S.started !== F.sent.started) { cmd({ cmd: S.started ? 'start' : 'hold' }); F.sent.started = S.started; }
      if (S.manual !== F.sent.manual) { cmd({ cmd: 'manual', on: !!S.manual }); F.sent.manual = S.manual; }
      if (!!S.over !== F.sent.over) {   // G820: the card's latch (the hand's ending stands down), endFlight's outcome with it
        cmd({ cmd: 'over', on: !!S.over, outcome: S.over && F.ap.report ? F.ap.report.outcome || null : null }); F.sent.over = !!S.over;
      }
      if (S.manual && S.INP) {
        const h = { de: null, da: null, dr: null, thr: null, brake: null, flap: null, eng: Array.isArray(F.realCtl.eng) ? F.realCtl.eng.map(() => ({})) : null };
        S.INP.write(h);
        cmd({ cmd: 'hand', ctl: Object.assign({}, h, { eng: h.eng ? h.eng.map(e => (e.thr != null ? e.thr : null)) : null }) });
      }
      if (patch.set || patch.eng.length) { const c = { cmd: 'ctl', set: patch.set || {} }; if (patch.eng.length) c.eng = patch.eng; cmd(c); patch.set = null; patch.eng = []; }
      flushOps();
      if (windFrame.length) { cmd({ cmd: 'windq', q: windFrame }); windFrame = []; }
      if (st.mode === 'lockstep') {
        V.flush();
        post({ cmd: 'steps', n: nStep, dayBatch: true });   // the day once after the frame's steps, as the inline loop ticks it
        F.posted += nStep; st.stepsPosted = F.posted;
      } else {
        if (simRate !== rateSent) { post({ cmd: 'rate', x: simRate }); rateSent = simRate; }
        V.flush();
        if (!running) { post({ cmd: 'run' }); running = true; }
        // the lag: frames since the oldest world version the worker has not shown yet was sent
        wvQ.push([F.frames, st.wvSent]);
        while (wvQ.length && wvQ[0][1] <= st.wvSeen) wvQ.shift();
        st.wvLagFrames = wvQ.length ? F.frames - wvQ[0][0] : 0;
        if (st.wvLagFrames > st.wvMaxLag) st.wvMaxLag = st.wvLagFrames;
      }
      st.batches++;
      mirror(performance.timeOrigin + (typeof ts === 'number' ? ts : performance.now()));
      const ran = Math.max(0, F.lastStep - F.shown);
      F.shown = F.lastStep;
      st.physMs = performance.now() - t0;
      // G820 (C1c): G130's check from the worker - the snapshot's flag, read every frame (the page's own reads the
      // mirrored p every 30th frame, as inline does)
      // simDt (the page's day - DAY_CLOCK - and its script's clock): LOCKSTEP ticks what the frame POSTED, as the inline
      // loop ticks what it stepped, in the same batches - the page's day then stands where the worker's does at every
      // frame's end, and the next flight's init hands the worker that day (G820: the second flight of a page, after a
      // reset, the skip or the shed, was a frame's day behind); real time ticks what the picture moved on
      out.ran = ran; out.simDt = (st.mode === 'lockstep' ? nStep : ran) / 60; out.hold = false; out.diverged = st.diverged; out.crashed = !!st.crashed; out.dmg = st.dmg || null;
      out.drawnT = F.drawnT != null ? F.drawnT : null;   // G1100: the drawn positions' sim time (app.js draws the sea at it)
      return out;
    }
    const out = { ran: 0, simDt: 0, hold: false, diverged: false, crashed: false, dmg: null, drawnT: null };
    // a frame that flies nothing (the shed, the roll-out screen, a pause, the card): the worker's clock stops
    function idle() {
      if (dead) return;
      if (running && host) { post({ cmd: 'pause' }); running = false; }
      // G820 (C1c): the world's changes made while nothing flies (the editor's rebuild under its pause, the scenery
      // mode's streaming) go now - stamped at this boundary in lockstep, as they apply before the next step inline
      if (host && opsQ.length) { flushOps(); if (flight && flight.live && flight.view) flight.view.flush(); }
    }
    // G820 (C1c): THE SHED - no flight is the worker's there. Every way in resets the page's sim, which takes the
    // mirror down (above); but a build committed on the way in (enterGarage's setAircraft for a pending spec) resets a
    // NEW sim and left the old flight's mirror standing on the old one: the flight is let go here, whatever sim it was on
    function shed() {
      idle();
      if (!flight) return;
      dropFlight(null); flight = null;
      st.phase = dead ? 'dead' : 'idle';
    }
    // the roll-out screen: the flight is placed already (fullReset ran before the screen) - the worker makes its world
    // and the same flight under the screen, so the stand does not wait for it when the screen lifts
    function warm() {
      if (dead) return;
      const S = o.get();
      if (!flight || S.ap !== flight.ap || S.sim !== flight.sim) begin(S);
      idle();
    }
    // G820 (C1c): FLY ON (app.js nextLeg, after it made the page's new pilot): the worker's pilot is made anew at the
    // same step boundary, departing from where the last leg ended - no reset, no new flight; the page's new `ap` is
    // this flight's from now on (the mirror writes the worker's pilot into it)
    function leg(from, to) {
      const F = flight; if (!F) return;
      const S = o.get();
      F.ap = S.ap;
      if (F.inline) return;
      if (!F.live) { dropFlight('Fly on before the worker took the flight'); return; }
      const c = { cmd: 'leg', from, to }; stamp(c); F.view.send(c);
      st.legs++;
    }
    // G820 (C1c): THE BENCH'S TEST CARD (app.js startTestFlight: ap.setCard in the roll-out's callback, before this
    // flight is asked of the worker) - kept for the next init of that pilot, or sent at the step when the flight is live
    let cardNext = null;
    function card(c) {
      const F = flight, S = o.get();
      if (F && F.live && F.ap === S.ap) { const x = { cmd: 'setCard', card: Object.assign({}, c) }; stamp(x); F.view.send(x); return; }
      cardNext = { ap: S.ap, card: Object.assign({}, c) };
    }
    // G1096: A RIG'S PLACEMENT (app.js FLIGHT_PROBE.place; sim_host.js simHostPlace): the worker's sim is the one that
    // flies, so the placement is made there, at once, and the page's view takes the snapshot it publishes. A promise of
    // the CG; null when this flight is not the worker's (the page's own sim is written by the caller)
    function place(o) {
      const F = flight;
      if (!F || F.inline || !F.live || !host) return null;
      const id = ++placeSeq;
      st.placed = (st.placed || 0) + 1;
      return new Promise(res => { placeWait.set(id, res); post({ cmd: 'place', id, at: o.at || null, by: o.by || null, zeroV: !!o.zeroV, dv: o.dv || null }); });
    }
    // the worker's readings for the recorder and rollout_perf (one object, rewritten: nothing allocated a frame)
    const P = { live: false, stepMs: NaN, dil: NaN, droppedS: NaN, late: NaN, step: 0, maxMs: NaN };
    function perf() {
      const F = flight, f = F && F.live && F.view ? F.view.snapshot() : null;
      P.live = !!f;
      if (f) { const S = F.ready.slots; P.stepMs = f[S.STEPMS]; P.dil = f[S.DIL]; P.droppedS = f[S.DROPPED]; P.late = f[S.LATE]; P.step = f[S.STEP]; P.maxMs = f[S.MAXMS]; }
      else { P.stepMs = P.dil = P.droppedS = P.late = P.maxMs = NaN; P.step = 0; }
      return P;
    }
    const api = {
      frame, idle, warm, shed, prewarm, leg, perf, card, place,
      state: () => Object.assign({}, st, { dead, flight: flight ? { live: flight.live, inline: flight.inline, posted: flight.posted, frames: flight.frames, epoch: flight.epoch } : null,
                                           view: flight && flight.view ? flight.view.state() : null,
                                           ring: flight && flight.view && flight.view.delay ? flight.view.delay() : null }),   // G1100: the view's ring and delay
      live: () => !!(flight && flight.live),
      dead: () => dead,
      record: () => (o.premises ? o.premises() : null),   // the premises the worker's world is made on (the page's WB.premisesPlaced)
      ask: () => { if (host) post({ cmd: 'state' }); },
      // the world's facts at points, the worker's (state().probe when it lands) and the page's (returned) - the triage
      // of a divergence (sim_host.js simHostProbe)
      // (G820: real time - the registry's ops so far go first, so both answers are of the same world; lockstep keeps its stamps)
      probe: (pts, t, tag, opts) => {
        st.probe = null;
        if (host) { if (st.mode !== 'lockstep' && opsQ.length) { flushOps(); if (flight && flight.live && flight.view) flight.view.flush(); } post({ cmd: 'probe', pts, t, tag, opts }); }
        return SIM_HOST.probe(world, pts, t, null, opts);
      },
      // the harness's door: the host's applied-command log (sim_host.js {cmd:'log'})
      log: () => { if (host) post({ cmd: 'log' }); },
    };
    return api;
  }
  return { make };
})();
if (typeof window !== 'undefined') window.SIM_LINK = SIM_LINK;
if (typeof module !== 'undefined' && module.exports) module.exports = { SIM_LINK };
