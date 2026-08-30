// ============================================================
// THE ENGINEERING BENCH (G64) — where a build earns its numbers.
//
// The user's own framing, and the reason the plaque does not simply appear:
// "let's have a test section. We could run the test to get the plaque numbers,
// but also resurrect the wing loading... That's the engineering section before
// you try and roll out. Once the tests are passed the data gets filled."
//
// So the plaque starts EMPTY. It is a certificate, and a certificate you get
// for free is not one. Running a test fills it; touching a slider takes it
// away again, which is the same ruling the load test has carried since it was
// built ("a changed spec loses its certificate") applied to the whole bench.
//
// THE TESTS ARE A DECLARED LIST, not a pair of buttons — the section has to be
// "ready for adding more tests if required", so a new test is a row in TESTS
// below plus whatever it needs on the bridge, and the UI, the staleness, the
// verdict line and the logbook entry all follow from the row. TEST FLIGHT (the
// AP-flown circuit that would add a landing run to the plaque, which
// genShakedown does not compute) is the next row and is declared here with no
// `run` so that the shape of it is on the record.
//
// WHAT A TEST IS ALLOWED TO BE. Two kinds, because the two that exist differ
// in that one way and nothing else:
//   instant  a computation. It returns its verdict from `run`.
//   live     it steps the sim, so it starts, is polled, and ends. The bench
//            shows the physical aeroplane while it runs, because watching the
//            wing bend IS the test.
// Neither kind may invent a threshold: the verdicts below are the generator's
// own (`flyableCircuit`) and the rig's own (`state.verdict`).
// ============================================================

// ---------------------------------------------------------------------------
// THE DECLARED TESTS.
// `needs` names the bridge calls a row uses, so a row that outruns the bridge
// says so instead of throwing halfway through a run.
// ---------------------------------------------------------------------------
const BENCH_TESTS = [
  {
    id: 'shake',
    name: 'Bench check',
    blurb: 'Trim, balance and field length, off the built airframe.',
    kind: 'instant',
    needs: ['shake'],
    // genShakedown: a cruise trim probe for the neutral point, a second sim
    // settled on a flat plane for the stance, and the mass ledger. It has
    // measured all of this since G4; what it has never had is a reason to run.
    run(api) {
      const s = api.shake();
      if (!s) return { verdict: 'not measurable', ok: false };
      return {
        verdict: s.flyableCircuit ? 'FLIES A CIRCUIT' : 'WILL NOT FLY A CIRCUIT',
        ok: !!s.flyableCircuit,
        // the plaque is this test's real output; the line here is its headline
        note: benchNum(s.Vs * 3.6, 0) + ' km/h stall · ' +
              benchNum(s.climbRate, 2) + ' m/s climb · ' +
              benchNum(s.TORun, 0) + ' m take-off',
        fills: 'plaque',
      };
    },
  },
  {
    id: 'load',
    name: 'Wing loading',
    blurb: 'Sandbags to +3.8 g limit and +5.7 g ultimate, FAR 23 normal.',
    kind: 'live',
    needs: ['loadTest', 'loadTestState', 'endLoadTest'],
    // The rig is src/core/65_gen_loadtest.js — the same object GATE LOAD ticks
    // headlessly, so the verdict on screen and the verdict in the battery are
    // one computation. Since G64 it puts the aeroplane ON ITS BACK, which is
    // how the test is really done and the only way the bags can push the wing
    // the way they look like they push it.
    start(api) { api.loadTest(); },
    poll(api) {
      const st = api.loadTestState();
      if (!st) return { verdict: 'no wing to load', ok: false, done: true };
      const pct = Math.max(0, Math.min(1, st.n / Math.max(1e-6, st.nTarget)));
      if (!st.done) return {
        done: false,
        running: st.phase === 'settle' ? 'settling on the trestles'
          : benchNum(st.n, 2) + ' g · tip ' + benchNum(st.tipPct, 2) + ' %',
        progress: pct,
      };
      return {
        done: true,
        verdict: st.verdict || 'HELD',
        ok: st.verdict === 'HELD',
        note: 'limit ' + benchNum(st.limitPct, 2) + ' % of semispan · ultimate '
          + benchNum(st.ultPct, 2) + ' %'
          + (st.ultYield == null ? ''
             : ' · worst member ' + benchNum(st.ultYield, 0) + ' % of yield'
               + (st.worstCls ? ' (' + st.worstCls + ')' : '')),
      };
    },
    stop(api) { api.endLoadTest(); },
  },
  {
    // THE AIR IS NOT ALWAYS THE DATUM (G72). Every other number on this bench —
    // stall, climb, take-off run — is quoted at ISA sea level, and until this
    // row existed that qualifier was invisible: a builder read "320 m take-off"
    // and had no way to learn what their aeroplane does out of a mountain strip
    // in August, which is precisely the question a bush build exists to answer.
    //
    // It runs the SAME two measurements the bench check runs (genClimbAt,
    // genTORunAt), in different air. No new physics and no new threshold: the
    // verdict is the generator's own flyableCircuit bar — 0.3 m/s of climb and
    // 1100 m of run — asked in the air over a hot mountain strip instead of at the datum.
    id: 'dalt',
    name: 'Density altitude',
    blurb: 'The same take-off and climb, out of a hot mountain strip — and where it stops climbing.',
    kind: 'instant',
    needs: ['densAlt'],
    run(api) {
      const d = api.densAlt();
      if (!d) return { verdict: 'not measurable', ok: false };
      const hot = d.cases.filter(c => c.id === 'hot')[0];
      if (!hot) return { verdict: 'not measurable', ok: false };
      const climbs = (hot.climbRate || 0) >= 0.3 && (hot.TORun || 0) <= 1100;
      const why = [];
      if ((hot.climbRate || 0) < 0.3) why.push('climbs ' + benchNum(hot.climbRate, 2) + ' m/s');
      if ((hot.TORun || 0) > 1100) why.push('needs ' + benchNum(hot.TORun, 0) + ' m');
      return {
        verdict: climbs ? 'WORKS HOT AND HIGH'
                        : 'SEA LEVEL ONLY — ' + why.join(', '),
        ok: climbs,
        note: benchNum(hot.densAlt, 0) + ' m density altitude: '
            + benchNum(hot.TORun, 0) + ' m take-off, '
            + benchNum(hot.climbRate, 2) + ' m/s climb on '
            + benchNum((hot.power || 1) * 100, 0) + '% power · service ceiling '
            + (d.serviceCeiling == null
                 ? 'above ' + benchNum(d.ceilingCap, 0) + ' m, which is as far as this model will claim'
                 : benchNum(d.serviceCeiling, 0) + ' m'),
        fills: 'plaque',
      };
    },
  },
  {
    // DECLARED, NOT BUILT (G64). The roadmap's TEST FLIGHT: fly the harness
    // circuit and bring back the landing run, which genShakedown does not
    // compute and the plaque therefore cannot show. Its one open decision —
    // shell out to node, or step the sim in the page — resolves to IN PAGE:
    // index.html is a zero-network single-file artifact and the game already
    // runs this exact sim in the browser. A row with no `run` renders as what
    // it is rather than pretending not to exist.
    id: 'flight',
    name: 'Test flight',
    blurb: 'A full circuit on the autopilot, for the landing run.',
    kind: 'instant',
    needs: ['circuit'],
  },
];

const benchNum = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d);

// ---------------------------------------------------------------------------
// THE BENCH. `api` is the bridge app.js hands over — the same shape garage.js
// takes, plus the rig and the plaque.
// ---------------------------------------------------------------------------
function benchInit(api) {
  const $ = id => document.getElementById(id);
  const host = $('edBench');
  if (!host) return;                       // core-only build

  const rows = document.createElement('div');
  rows.id = 'bTests';
  host.insertBefore(rows, host.firstChild);

  let results = {};        // id -> the last result of that test
  let live = null;         // { test, timer } while a live test runs
  let busy = false;        // suppress the dirty hook while WE are driving

  const usable = t => !!(t.run || t.start) &&
    (t.needs || []).every(k => typeof api[k] === 'function');

  // ---- the certificate ---------------------------------------------------
  // Every editor rebuild invalidates it. `stale` is not a third state on top
  // of the results — it IS the absence of results, so there is one place the
  // question "has this aeroplane been tested" is answered.
  function clearResults() {
    results = {};
    api.plaque(false);
    render();
  }
  // app.js labels ROLL OUT off BENCH_STATE, so it has to be told when that
  // changed rather than polling it every frame
  const changed = () => {
    if (typeof window.BENCH_CHANGED === 'function') window.BENCH_CHANGED();
  };
  window.BENCH_DIRTY = () => { if (!busy) clearResults(); };

  const passed = () => BENCH_TESTS.filter(t => usable(t))
    .every(t => results[t.id] && results[t.id].ok);
  const anyRun = () => Object.keys(results).length > 0;
  // app.js asks this to label ROLL OUT. Never a lock — it is your aeroplane,
  // and building it wrong and learning why is content, not error.
  window.BENCH_STATE = () => ({ any: anyRun(), passed: passed(),
                                results: results });

  // ---- running -----------------------------------------------------------
  // A test measures the aeroplane the JOIN builds, never the editor's meshes,
  // so the bench exports first. That is also what retires `build & fly`: the
  // export is a step inside testing and rolling out, not a button.
  // ...through app.js's own `syncBuild` (G65), which is also what rolling out
  // calls, so a test and a flight can never read different builds. It returns
  // the measurements that could not be taken: one that failed is a FAILED
  // test, not a quieter aeroplane — the join used to swallow it and hand back
  // a plausible generic build with the firewall, the cabin, the gear station,
  // the wing station and all eight tail rows silently absent.
  const sync = () => (typeof api.sync === 'function') ? api.sync() : [];

  function runOne(t) {
    if (live || !usable(t)) return;
    busy = true;
    const errs = sync();
    busy = false;
    if (errs && errs.length) {
      // AND THE CERTIFICATE GOES WITH IT. Leaving the last run's plaque up
      // while this run says the build cannot be measured is the same fault
      // G60 fixed for aircraft switching — a plaque reading someone else's
      // certificate — and here it would be reading one for an aeroplane that
      // was never successfully built.
      results[t.id] = { verdict: 'CANNOT MEASURE THIS BUILD', ok: false,
                        note: errs.join(' · ') };
      api.plaque(false);
      note(t, results[t.id]);
      return render();
    }
    if (t.kind === 'live') {
      api.showPhysical(true);
      t.start(api);
      live = { test: t };
      results[t.id] = { running: 'starting', ok: false };
      render();
      live.timer = setInterval(() => {
        let r;
        try { r = t.poll(api); }
        catch (e) { r = { done: true, verdict: 'threw: ' + e.message, ok: false }; }
        results[t.id] = r;
        render();
        if (r.done) endLive(t, r);
      }, 120);
      return;
    }
    let r;
    try { r = t.run(api); }
    catch (e) { r = { verdict: 'threw: ' + e.message, ok: false }; }
    results[t.id] = r;
    if (r.fills === 'plaque') api.plaque(true);
    note(t, r);
    render();
  }

  function endLive(t, r) {
    clearInterval(live.timer);
    live = null;
    // the result is read BEFORE the rig is taken down, because taking it down
    // rebuilds the aeroplane back onto its wheels
    busy = true;
    try { t.stop(api); } catch (e) {}
    api.showPhysical(false);
    busy = false;
    note(t, r);
    render();
  }

  // the logbook stub (G63's envelope): what was tested, and what it said
  function note(t, r) {
    try {
      if (window.GARAGE_SPEC && window.GARAGE_SPEC.note)
        window.GARAGE_SPEC.note({ id: t.id, verdict: r.verdict || '',
                                  ok: !!r.ok });
    } catch (e) {}
  }

  function runAll() {
    // sequentially, because a live test owns the sim while it runs
    const queue = BENCH_TESTS.filter(usable);
    const next = () => {
      const t = queue.shift();
      if (!t) return;
      runOne(t);
      if (!live) return next();
      const wait = setInterval(() => {
        if (live) return;
        clearInterval(wait); next();
      }, 150);
    };
    next();
  }

  // ---- the panel ---------------------------------------------------------
  function render() {
    const bits = [];
    const v = anyRun()
      ? (passed() ? '<b class="ok">TESTED</b>'
                  : '<b class="bad">NOT PASSED</b>')
      : '<b class="dim">UNTESTED</b>';
    bits.push('<div class="bHead"><span>engineering bench</span>' + v +
      '<button id="bRunAll">run the tests</button></div>');
    for (const t of BENCH_TESTS) {
      const r = results[t.id] || null;
      const can = usable(t);
      const cls = !can ? 'dim' : r ? (r.running ? 'run' : (r.ok ? 'ok' : 'bad')) : '';
      const line = !can ? 'not built yet'
        : r ? (r.running || r.verdict || '') : 'not run';
      bits.push('<div class="bT ' + cls + '">' +
        '<div class="bT1"><span class="bN">' + t.name + '</span>' +
        (can ? '<button data-t="' + t.id + '">run</button>' : '') +
        '<b>' + line + '</b></div>' +
        '<div class="bB">' + t.blurb + '</div>' +
        (r && r.note ? '<div class="bW">' + r.note + '</div>' : '') +
        '</div>');
    }
    rows.innerHTML = bits.join('');
    const all = $('bRunAll');
    if (all) { all.disabled = !!live; all.onclick = runAll; }
    changed();
    rows.querySelectorAll('button[data-t]').forEach(b => {
      b.disabled = !!live;
      b.onclick = () => {
        const t = BENCH_TESTS.filter(x => x.id === b.dataset.t)[0];
        if (t) runOne(t);
      };
    });
  }
  render();
}
