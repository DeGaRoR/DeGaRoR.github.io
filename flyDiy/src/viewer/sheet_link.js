// ============================================================
// G2920-G2924 (GARAGE-SHEET): THE PERFORMANCE SHEET OFF THE PAGE'S THREAD.
//
// The finding (the Deform coordinator, 11 Oct, garage_lag --prof on master 43): every garage change that put a new
// aeroplane on the stand (GARAGE_SPEC.update -> setAircraft -> enterGarage) ran genShakedown ON THE PAGE - the room's
// CG / neutral-point posts read it when the balance job had not answered yet, and G1302's post-idle shakeSoon ran it
// again for the plaque and the plate: the metal Cessna ~1.0-1.2 s, the Cub ~0.6 s of the busy time per change.
//
// This is the page's side of the sheet's thread: one long-lived Blob worker (bench_worker.js's, `sheet` job: the same
// buildGen and genShakedown from the same spec, the core bundle the page itself inlines, asked by its sha), and the
// rules for when it is asked:
//   - DEBOUNCED: a request waits `settleMs` of quiet, and while a hand is on a slider (`held()`) it waits for the
//     hand - a drag of any length asks ONCE, for the aeroplane it ends on;
//   - ONE IN FLIGHT, THE NEWEST WINS: a request for another aeroplane in the same lane while one is computing
//     TERMINATES that thread at once (a sheet is a single synchronous run: there is no other way to stop it) and the
//     next one starts on a fresh thread; an answer for a superseded request is dropped by its sequence number;
//   - NEVER A WRONG NUMBER: the answer is handed to the job's own `on` with its key; the page checks the key and the
//     def's signature (bench_worker.js benchSheetSig) before it believes it, and keeps it in its own memo (app.js
//     shakeKeep), where every reader then finds it;
//   - A DEAD LINK SAYS SO: no Worker (file://, the node page's harness - which only lends the threads a gate asks
//     for: the thread is made inside the first `request`, so that very call says false), a thread that fails to
//     load, or `kill(why)`: `request` returns false from then on and every waiting job's `fail` is called - the
//     caller runs the sheet on the page exactly as before (G1302's shakeSoon). The node path is the old path,
//     unchanged.
// Thread-agnostic and DOM-free: the timers, the clock and the worker factory are handed in (GATE SHEETWORKER drives
// it with a fake clock and a fake thread).
// ============================================================

// o: { start(onMessage, onError) -> { post(job) -> bool, kill() } | null,
//      held() -> bool, settleMs (250), holdMaxMs (8000: the longest a request waits for a held hand after its last
//      change), setTimeout, clearTimeout, now }
function makeSheetLink(o) {
  const T = o.setTimeout || setTimeout, CT = o.clearTimeout || clearTimeout;
  const now = o.now || (() => Date.now());
  const settleMs = o.settleMs != null ? o.settleMs : 250, holdMaxMs = o.holdMaxMs != null ? o.holdMaxMs : 8000;
  const LANES = [];                         // lane names in first-asked order: 'stand' before the others
  const want = {};                          // lane -> the newest job not yet posted
  const st = { requests: 0, posted: 0, landed: 0, aborted: 0, dropped: 0, errors: 0, threads: 0, waits: 0,
               dead: null, lastMs: null, lastKey: null };
  let w = null, fly = null, seq = 0, timer = null, heldT0 = 0;

  const failAll = why => {
    const jobs = [];
    if (fly) { jobs.push(fly.job); fly = null; }
    for (const l of LANES) if (want[l]) { jobs.push(want[l]); want[l] = null; }
    for (const j of jobs) { try { if (j.fail) j.fail(why); } catch (e) {} }
  };
  const drop = () => { if (w) { try { w.kill(); } catch (e) {} } w = null; };
  function kill(why) {
    if (timer) { CT(timer); timer = null; }
    st.dead = why || 'killed';
    drop();
    failAll(st.dead);
  }
  function onMessage(r) {
    if (!r || r.kind !== 'sheet') return;
    if (!fly || r.seq !== fly.seq) { st.dropped++; return; }
    const f = fly; fly = null;
    st.lastMs = now() - f.t0;
    if (r.error) {
      // the sheet could not be computed there: the page computes it (and meets the same error the old way). Two in a
      // row is a thread that cannot answer at all (a sheet that cannot cross, a broken bundle): the link is dead
      st.errors++;
      drop();
      if (++st.errRun >= 2) { kill('the sheet thread failed twice: ' + r.error); try { if (f.job.fail) f.job.fail(r.error); } catch (e) {} return; }
      try { if (f.job.fail) f.job.fail(r.error); } catch (e) {}
    } else {
      st.errRun = 0;
      st.landed++;
      try { f.job.on(r.sheet, r); } catch (e) { console.warn('sheet:', e); }
    }
    if (!timer) go();                       // a request that arrived while this one ran (another lane, or no abort)
  }
  function onError(why) { kill('the sheet thread failed: ' + (why || '?')); }
  function go() {
    timer = null;
    if (st.dead || fly) return;
    let lane = null;
    for (const l of LANES) if (want[l]) { lane = l; break; }
    if (!lane) return;
    // a hand on a slider: after it (at most holdMaxMs - a held flag that never clears must not starve the readouts)
    if (o.held && o.held() && now() - heldT0 < holdMaxMs) { st.waits++; timer = T(go, settleMs); return; }
    if (!w) {
      w = o.start(onMessage, onError);
      if (!w) { kill('no worker here'); return; }
      st.threads++;
    }
    const job = want[lane]; want[lane] = null;
    const s = ++seq;
    if (!w.post({ kind: 'sheet', seq: s, key: job.key, spec: job.spec, opts: job.opts })) {
      want[lane] = job; kill('the sheet thread refused the job'); return;
    }
    st.posted++; st.lastKey = job.key;
    fly = { lane, key: job.key, seq: s, t0: now(), job };
  }
  // job: { key, spec, opts, on(sheet, answer), fail(why) }. True when the link took it (the answer, or `fail`, comes
  // later); false when the link is dead - the caller computes on the page.
  function request(lane, job) {
    if (st.dead || !job || !job.key) return false;
    if (LANES.indexOf(lane) < 0) LANES.push(lane);
    if (fly && fly.lane === lane) {
      if (fly.key === job.key) { st.requests++; fly.job = job; want[lane] = null; return true; }   // already computing this one
      // superseded: the thread stops now, the newest waits its settle on a fresh one
      st.aborted++;
      drop();
      fly = null;
    }
    // the thread is made HERE, synchronously: where there is none to be had (file://, the node page's harness, which
    // refuses a Blob worker no gate asked for) the caller learns it now and computes as it always did - the same
    // call, the same moment; and a fresh thread loads its core during the settle instead of after it
    if (!w) {
      w = o.start(onMessage, onError);
      if (!w) { kill('no worker here'); return false; }
      st.threads++;
    }
    st.requests++;
    // the same aeroplane asked again while it waits (a second reader stepping down): the newest reader, the same settle
    if (want[lane] && want[lane].key === job.key && timer) { want[lane] = job; return true; }
    want[lane] = job;
    heldT0 = now();
    if (timer) CT(timer);
    timer = T(go, settleMs);
    return true;
  }
  // a lane's request withdrawn (the sheet became known another way: the page computed it)
  function cancel(lane, key) {
    if (want[lane] && (key == null || want[lane].key === key)) want[lane] = null;
    if (fly && fly.lane === lane && (key == null || fly.key === key)) { st.aborted++; drop(); fly = null; if (!timer) go(); }
  }
  // is this key on its way (waiting or computing)?
  const pending = key => !!((fly && fly.key === key) || LANES.some(l => want[l] && want[l].key === key));
  const state = () => Object.assign({}, st, { inFlight: fly ? fly.key : null, waiting: LANES.filter(l => want[l]).map(l => want[l].key),
                                              alive: !st.dead, thread: !!w });
  st.errRun = 0;
  return { request, cancel, pending, kill, state, get dead() { return st.dead; } };
}

if (typeof window !== 'undefined') window.makeSheetLink = makeSheetLink;
if (typeof module !== 'undefined' && module.exports) module.exports = { makeSheetLink };
