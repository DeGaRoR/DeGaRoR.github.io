// ============================================================
// THE BENCH'S OWN THREAD (A9, 2026-09-21). The user: "the wing loading test
// freezes the interface for much too long without feedback"; "the last
// certification remains stuck on crosswinds".
//
// Two tests step a sim for seconds of wall clock: the sandbag rig (24-200
// solver substeps per frame, stepped in the render loop since G64 — every
// frame of it a hitch) and the crosswind ladder (four to seven departures,
// polled in 60-step bites that block half a second each on a heavy build).
// Both now run HERE, in a Worker built the way the energy panel's readouts
// worker is (tools/_cage_energy.js readoutWorker): a Blob whose source
// imports this file and the built core bundle, is handed the SPEC (a def
// cannot cross a postMessage) and rebuilds the aeroplane on its own thread
// — buildGen is a pure function of the spec, so the worker's nodes are the
// page's nodes in the same order.
//
// ONE PHYSICS. Nothing here measures: the rig is 65_gen_loadtest.js's
// makeLoadTest and the ladder is 42_crosswind.js's makeCrosswindProbe, the
// same objects GATE LOAD and GATE TAKEOFF tick headlessly. This file only
// decides WHEN to step them and WHAT to post back:
//   load     the rig, paced to real time (the bags going on is the thing the
//            user watches), a snapshot at most every 33 ms carrying the
//            rig's state and the node positions — the page writes them into
//            its own sim so the aeroplane on the stand bends exactly as the
//            worker's does (poseModel, updateLoadViz read sim.p and nothing
//            else);
//   loadfix  THE ADVISOR — the same rig again on the levers a builder can
//            actually turn (lift struts, an aluminium or carbon wing, a
//            metre off the span), one verdict line per variant as each
//            arrives, MEASURED rather than asserted: on the jodel card a
//            thicker aerofoil moved the tip by nothing and five spar
//            stations made it worse, so neither is offered;
//   xwind    the ladder, one message per departure (the rung's wind, whether
//            it stayed between the lines, why not), then the result.
// The page falls back to the same functions on its own thread (file://, the
// smoke harness, a worker that fails), budgeted per frame so a fallback is
// slower, never a freeze.
// ============================================================

// ---- the jobs, thread-agnostic --------------------------------------------
// CORE is { buildGen, makeSim, makeLoadTest, makeCrosswindProbe, makeWorld,
// genSurfKey } — the page's globals, or the worker's imported bundle.

// the rig's cfg from a spec: the fuselage material (the yield allowable) and
// the wing's own construction row (G213)
function benchLoadCfg(CORE, spec, cfg) {
  return Object.assign({
    material: (spec && spec.fuselage && spec.fuselage.material) || undefined,
    wingMaterial: (spec && typeof CORE.genSurfKey === 'function')
      ? CORE.genSurfKey(spec, 'wing', 0) : undefined,
  }, cfg || {});
}

// A LOAD RUN. `job.p0` is the page's live node positions BEFORE its own
// makeLoadTest inverted them (the stand's pose — standOnWheels is a rigid
// rotation a fresh sim does not have), so both rigs invert the same
// aeroplane. Without it the worker starts from reset(0), which GATE LOAD
// does too. `frac` is the card's progress: settle 0-0.2, ramp 0.2-0.9,
// hold 0.9-1 — the phases the rig itself walks, in its own cfg's seconds.
function benchLoadRun(CORE, job) {
  const spec = job.spec;
  const def = CORE.buildGen(spec);
  const sim = CORE.makeSim(def, null);
  sim.reset(0);
  if (job.p0 && job.p0.length === sim.p.length) sim.p.set(job.p0);
  const cfg = benchLoadCfg(CORE, spec, job.cfg);
  const rig = CORE.makeLoadTest(sim, def, cfg);
  const settleS = cfg.settleS != null ? cfg.settleS : 2.0;
  const rampS = cfg.rampS != null ? cfg.rampS : 4.0;
  const holdS = cfg.holdS != null ? cfg.holdS : 1.5;
  let steps = 0, t = 0;
  const frac = () => {
    const st = rig.state;
    if (!st.ok) return 1;
    if (st.done) return 1;
    if (st.phase === 'settle') return 0.2 * Math.min(1, t / Math.max(1e-6, settleS));
    if (st.phase === 'hold') return 0.9 + 0.1 * Math.min(1, (t - settleS - rampS) / Math.max(1e-6, holdS));
    return 0.2 + 0.7 * Math.min(1, st.n / Math.max(1e-6, st.nTarget || rig.ult || 5.7));
  };
  return {
    kind: 'load',
    ok: !!rig.state.ok,
    rig, sim, def,
    get done() { return !rig.state.ok || !!rig.state.done; },
    // advance up to `n` frames of 1/60 s; returns the frames taken
    pump(n) {
      let k = 0;
      while (k < (n || 1) && rig.state.ok && !rig.state.done) { rig.step(1 / 60); t += 1 / 60; steps++; k++; }
      return k;
    },
    snapshot() {
      const st = rig.state;
      const state = {};
      for (const k in st) state[k] = Array.isArray(st[k]) ? st[k].slice() : st[k];
      state.frac = frac();
      state.t = t;
      return { kind: 'load', state, p: Float64Array.from(sim.p) };
    },
  };
}

// THE ADVISOR'S LEVERS: each one a row the wing page has (its label, so the
// card names a control that exists), applied to the join's own spec. The
// variant is skipped where it would change nothing (struts on a strutted
// wing, aluminium on a wing that already IS aluminium — by its own row or
// by the fuselage's material it follows, `mat` = genSurfKey's answer).
const BENCH_LOAD_LEVERS = [
  { id: 'strut', row: 'fixation', label: 'lift struts',
    when: s => !(s.bracing && s.bracing.type === 'strut'),
    apply: s => { s.bracing = Object.assign({}, s.bracing || {}, { type: 'strut' }); } },
  { id: 'alloy', row: 'construction', label: 'an aluminium wing',
    when: (s, mat) => mat !== 'alloy',
    apply: s => { s.wings[0].material = 'alloy'; } },
  { id: 'carbon', row: 'construction', label: 'a carbon wing',
    when: (s, mat) => mat !== 'carbon',
    apply: s => { s.wings[0].material = 'carbon'; } },
  { id: 'span', row: 'span', label: 'a metre off the span',
    when: s => !!(s.wings && s.wings[0] && s.wings[0].span > 7.5),
    apply: s => { s.wings[0].span = s.wings[0].span - 1; } },
];
// the variants a spec can take, in the order the card lists them
function benchLoadVariants(spec, CORE) {
  if (!spec || !spec.wings || !spec.wings[0]) return [];
  let mat = spec.wings[0].material || null;
  try { if (CORE && typeof CORE.genSurfKey === 'function') mat = CORE.genSurfKey(spec, 'wing', 0) || mat; } catch (e) {}
  return BENCH_LOAD_LEVERS.filter(L => { try { return L.when(spec, mat); } catch (e) { return false; } })
    .map(L => ({ id: L.id, row: L.row, label: L.label }));
}
// one variant, run to its verdict (headless: the whole rig, no pacing)
function benchLoadVariant(CORE, spec, id, cfg) {
  const L = BENCH_LOAD_LEVERS.filter(x => x.id === id)[0];
  if (!L) return null;
  const s = JSON.parse(JSON.stringify(spec));
  L.apply(s);
  const run = benchLoadRun(CORE, { spec: s, cfg });
  if (!run.ok) return { id, row: L.row, label: L.label, verdict: 'no wing to load' };
  for (let i = 0; i < 60 * 60 && !run.done; i++) run.pump(1);
  const st = run.rig.state;
  return { id, row: L.row, label: L.label, verdict: st.verdict, limitPct: st.limitPct,
           ultPct: st.ultPct, ultYield: st.ultYield, worstCls: st.worstCls,
           mass: run.sim.totalM };
}

// A CROSSWIND RUN: the ladder as the probe steps it, one rung reported as
// it lands. The probe is the page's (42_crosswind.js makeCrosswindProbe);
// `poll(ms)` is its own budgeted step, so pacing here is just the budget.
function benchXwindRun(CORE, job) {
  const def = CORE.buildGen(job.spec);
  const world = (typeof CORE.makeWorld === 'function') ? CORE.makeWorld() : null;
  const probe = CORE.makeCrosswindProbe(def, Object.assign({ world }, job.opts || {}));
  let seen = 0, last = null, result = null;
  return {
    kind: 'xwind',
    get done() { return !!result; },
    // step for `ms` of wall clock; returns the rungs that landed meanwhile
    pump(ms) {
      if (result) return [];
      const r = probe.poll(ms || 60);
      last = r;
      if (r && r.done) result = r.result;
      const runs = probe.runs || (result && result.runs) || [];
      const fresh = runs.slice(seen).map(r => ({ w: r.w, ok: r.ok, roll: r.roll, e: r.e, why: r.why }));
      seen = runs.length;
      return fresh;
    },
    snapshot() {
      const runs = probe.runs || (result && result.runs) || [];
      return { kind: 'xwind', w: last && last.w, t: last && last.t, frac: last ? (last.done ? 1 : last.frac) : 0,
               runs: runs.map(r => ({ w: r.w, ok: r.ok, roll: r.roll, e: r.e, why: r.why })),
               result: result || null, done: !!result };
    },
  };
}

// ---- the worker's side -----------------------------------------------------
// Stringified into the Blob (so it may close over nothing but its two
// arguments): `CORE` the imported bundle, `BW` this module's exports.
function benchWorkerBody(CORE, BW) {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let cur = null;                       // the one job in flight
  const post = (m, tr) => { try { postMessage(m, tr || []); } catch (e) { postMessage(m); } };
  const loop = () => {
    const J = cur; if (!J) return;
    try {
      if (J.kind === 'load') {
        // paced to real time: the frames due since the start, at most three
        // per turn so a heavy build slows rather than skips
        const due = Math.floor((now() - J.t0) / (1000 / 60)) - J.stepped;
        const k = J.run.pump(Math.max(0, Math.min(3, due)));
        J.stepped += k;
        const st = J.run.rig.state;
        const phaseMoved = st.phase !== J.phase; J.phase = st.phase;
        if (J.run.done || phaseMoved || now() - J.sent >= 33) {
          const s = J.run.snapshot(); s.seq = J.seq;
          s.rate = J.stepped > 0 ? (J.stepped / 60) / Math.max(1e-3, (now() - J.t0) / 1000) : 1;
          J.sent = now();
          post(s, [s.p.buffer]);
        }
        if (J.run.done) { cur = null; return; }
        setTimeout(loop, 4);
        return;
      }
      if (J.kind === 'loadfix') {
        // THE ADVISOR: one lever per turn, its line posted as it lands (the
        // bench asked for it after reading the rig's verdict — the verdict
        // rule is the bench's, not this thread's)
        const v = J.variants[J.i++];
        if (!v) { post({ kind: 'loadfix', seq: J.seq, done: true }); cur = null; return; }
        const r = BW.benchLoadVariant(CORE, J.spec, v.id, J.cfg);
        post({ kind: 'loadfix', seq: J.seq, variant: r, i: J.i, n: J.variants.length });
        setTimeout(loop, 0);
        return;
      }
      if (J.kind === 'xwind') {
        const fresh = J.run.pump(60);
        const s = J.run.snapshot(); s.seq = J.seq; s.fresh = fresh;
        post(s);
        if (J.run.done) { cur = null; return; }
        setTimeout(loop, 0);
        return;
      }
    } catch (err) {
      post({ kind: J.kind, seq: J.seq, error: String(err && err.stack || err) });
      cur = null;
    }
  };
  self.onmessage = e => {
    const job = e.data || {};
    if (job.kind === 'stop') { cur = null; return; }
    try {
      if (job.kind === 'load') {
        const run = BW.benchLoadRun(CORE, job);
        cur = { kind: 'load', run, seq: job.seq, t0: now(), stepped: 0, sent: 0, phase: null };
        if (!run.ok) { const s = run.snapshot(); s.seq = job.seq; post(s, [s.p.buffer]); cur = null; return; }
        loop();
      } else if (job.kind === 'loadfix') {
        const variants = BW.benchLoadVariants(job.spec, CORE);
        post({ kind: 'loadfix', seq: job.seq, variants, start: true });
        cur = { kind: 'loadfix', seq: job.seq, spec: job.spec, cfg: job.cfg, variants, i: 0 };
        loop();
      } else if (job.kind === 'xwind') {
        cur = { kind: 'xwind', run: BW.benchXwindRun(CORE, job), seq: job.seq };
        loop();
      }
    } catch (err) {
      post({ kind: job.kind, seq: job.seq, error: String(err && err.stack || err) });
      cur = null;
    }
  };
}

// the Blob's source: this file and the built core bundle, both by URL next
// to the page (dev.html and index.html sit in flyDiy/), then the body
function benchWorkerSource(base) {
  return 'self.module = { exports: {} };\n' +
    'importScripts(' + JSON.stringify(base + 'src/viewer/bench_worker.js') + ');\n' +
    'const BW = self.module.exports; self.module = { exports: {} };\n' +
    'importScripts(' + JSON.stringify(base + 'tools/flight_core.js') + ');\n' +
    'const CORE = { buildGen, makeSim, makeLoadTest, makeCrosswindProbe, makeWorld, genSurfKey };\n' +
    '(' + benchWorkerBody.toString() + ')(CORE, BW);\n';
}

// ---- the page's side --------------------------------------------------------
// One worker per test (a test owns its thread; abort terminates it). Null
// when there is no worker to be had — the caller runs the job on the page.
function benchWorkerStart(onMessage, onError) {
  try {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' ||
        typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return null;
    const base = new URL('.', location.href).href;
    const url = URL.createObjectURL(new Blob([benchWorkerSource(base)], { type: 'text/javascript' }));
    const w = new Worker(url);
    const kill = () => { try { w.terminate(); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {} };
    w.onmessage = e => { try { onMessage(e.data); } catch (err) { console.warn('bench worker message:', err); } };
    w.onerror = err => { kill(); if (onError) onError(err && err.message || 'worker failed'); };
    return {
      post: (job, tr) => { try { w.postMessage(job, tr || []); return true; } catch (e) { return false; } },
      kill,
    };
  } catch (e) { return null; }
}

if (typeof window !== 'undefined') {
  window.BENCH_WORKER = { start: benchWorkerStart, loadRun: benchLoadRun, loadVariants: benchLoadVariants,
                          loadVariant: benchLoadVariant, xwindRun: benchXwindRun, loadCfg: benchLoadCfg,
                          LEVERS: BENCH_LOAD_LEVERS };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { benchLoadCfg, benchLoadRun, benchLoadVariants, benchLoadVariant, benchXwindRun,
                     benchWorkerBody, benchWorkerSource, benchWorkerStart, BENCH_LOAD_LEVERS };
