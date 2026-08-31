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
    // ADVISORY (G107, the quality review's finding): "works hot and high" is
    // a capability, not airworthiness — a sound sea-level trainer was reading
    // NOT PASSED on the whole bench because it is not a bush plane. An
    // advisory row still runs, still fills the plaque's thin-air sheet, and
    // still shows its own verdict; it just cannot withhold the certificate.
    advisory: true,
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
    // BUILT AT G107, as declared at G64 — IN PAGE, exactly as the row's open
    // decision resolved: a second sim flies the whole circuit OFFSCREEN on the
    // TEST PILOT (41_test_pilot.js), fast-stepped on a wall-clock budget, and
    // brings back the landing run genShakedown cannot compute plus the
    // pilot's own report — bounded attempts, structured verdicts. An
    // aeroplane that cannot fly comes back SAYING SO ('rejected-takeoff',
    // 'wont-climb'), which is a FAILED test with a reason, not a hang.
    id: 'flight',
    name: 'Test flight',
    blurb: 'A full circuit on the test pilot — the landing run, and the pilot’s verdicts.',
    kind: 'live',
    offscreen: true,           // the circuit flies a second sim, not the stand
    // THE TEST CARD (G107.1): the two setpoints the game imposes on the
    // flight. Blank = the standard circuit. The pilot clamps an unsafe ask
    // (never below its own approach speed or safe height) and SAYS so, and
    // the plaque prints asked-vs-flown. Units are the UI's; app.js converts.
    card: [{ k: 'alt', label: 'altitude', unit: 'm', ph: 'auto' },
           { k: 'V', label: 'speed', unit: 'km/h', ph: 'auto' }],
    needs: ['circuitStart', 'circuitPoll', 'circuitEnd'],
    start(api, cv) {
      const num = s => { const v = parseFloat(s); return isFinite(v) && v > 0 ? v : null; };
      api.circuitStart({ alt: num(cv && cv.alt), Vkmh: num(cv && cv.V) });
    },
    poll(api) {
      const r = api.circuitPoll();
      if (!r) return { done: true, verdict: 'no circuit running', ok: false };
      if (!r.done) return {
        done: false,
        running: r.phase + ' · t=' + benchNum(r.t, 0) + ' s',
        progress: r.frac,
      };
      const rep = r.report, L = rep.landing;
      const eventful = rep.verdicts.length > 0;
      return {
        done: true,
        verdict: rep.outcome === 'completed'
          ? (eventful ? 'COMPLETED, WITH NOTES' : 'FLEW THE CIRCUIT')
          : String(rep.outcome || 'no verdict').toUpperCase().replace(/-/g, ' '),
        ok: rep.outcome === 'completed',
        note: (L ? 'landing run ' + benchNum(L.run, 0) + ' m · touchdown '
                 + benchNum(L.sink, 2) + ' m/s · ' + benchNum(L.pastAim, 0)
                 + ' m past the aim'
                 : 'no landing')
          + (eventful ? ' · ' + rep.verdicts.map(v => v.code).join(', ') : ''),
        fills: 'plaque',
      };
    },
    stop(api) { api.circuitEnd(); },
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
  const cardVals = {};     // id -> { k: string } — the typed test card (G107.1);
                           // survives re-renders, deliberately NOT cleared by
                           // BENCH_DIRTY: the card is the ASK, not a result

  const usable = t => !!(t.run || t.start) &&
    (t.needs || []).every(k => typeof api[k] === 'function');

  // ---- the certificate ---------------------------------------------------
  // Every editor rebuild invalidates it. `stale` is not a third state on top
  // of the results — it IS the absence of results, so there is one place the
  // question "has this aeroplane been tested" is answered.
  //
  // AND IT PERSISTS (G107.3, ruling 4's last unpaid debt on this panel): the
  // results — plus the two sheets only a test run can produce — ride in the
  // save envelope through `GARAGE_SPEC.plaque(...)`, and come back through
  // `BENCH_RESTORE` below. The one rule that makes this safe in a tree where
  // loading a build FIRES THE DIRTY HOOK (applySpec, the join, the boot
  // seed all rebuild): a dirty that arrives with NOTHING on the bench never
  // touches the store. Withdrawal is only withdrawal when there was
  // something to withdraw; the load path's own storms always arrive over an
  // empty bench, so the certificate they carried survives them.
  function clearResults() {
    const had = Object.keys(results).length > 0;
    results = {};
    api.plaque(false);
    if (had) try {
      if (window.GARAGE_SPEC && window.GARAGE_SPEC.plaque)
        window.GARAGE_SPEC.plaque(null);
    } catch (e) {}
    render();
  }
  // ...and the other direction: every SETTLED result mirrors the bench into
  // the store, so the envelope always says what the bench would say.
  function persist() {
    try {
      const G = window.GARAGE_SPEC;
      if (!G || !G.plaque || !Object.keys(results).length) return;
      G.plaque({ when: new Date().toISOString().slice(0, 10),
                 results: JSON.parse(JSON.stringify(results)),
                 sheets: (typeof api.sheets === 'function') ? api.sheets()
                                                            : null });
    } catch (e) {}
  }
  // the load path calls this LAST, after its own dirty storm (garage.js
  // loadSpec; app.js boot). Restoring is not running: no logbook rows, no
  // re-persist, and never over a live test.
  window.BENCH_RESTORE = pq => {
    if (live) return;
    if (!pq || !pq.results || !Object.keys(pq.results).length) return;
    busy = true;
    results = JSON.parse(JSON.stringify(pq.results));
    if (typeof api.restoreSheets === 'function')
      api.restoreSheets(pq.sheets || null);
    api.plaque(Object.keys(results).some(id =>
      results[id] && results[id].fills === 'plaque'));
    busy = false;
    render();
  };
  // app.js labels ROLL OUT off BENCH_STATE, so it has to be told when that
  // changed rather than polling it every frame
  const changed = () => {
    if (typeof window.BENCH_CHANGED === 'function') window.BENCH_CHANGED();
  };
  window.BENCH_DIRTY = () => { if (!busy) clearResults(); };

  // ADVISORY rows (dalt) do not gate the certificate — measured-but-not-a-
  // bush-plane is information, not failure (G107).
  const passed = () => BENCH_TESTS.filter(t => usable(t) && !t.advisory)
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
      persist();
      return render();
    }
    if (t.kind === 'live') {
      if (!t.offscreen) api.showPhysical(true);   // the flight flies a 2nd sim
      t.start(api, cardVals[t.id] || {});
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
    persist();
    render();
  }

  function endLive(t, r) {
    clearInterval(live.timer);
    live = null;
    // the result is read BEFORE the rig is taken down, because taking it down
    // rebuilds the aeroplane back onto its wheels
    busy = true;
    try { t.stop(api); } catch (e) {}
    if (!t.offscreen) api.showPhysical(false);
    busy = false;
    // a live test can fill the plaque too (G107: the test flight's landing
    // run) — the same honour runOne has always paid its instant rows
    if (r && r.fills === 'plaque') api.plaque(true);
    note(t, r);
    persist();
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
      const cls = !can ? 'dim'
        : r ? (r.running ? 'run' : (r.ok ? 'ok' : (t.advisory ? 'adv' : 'bad')))
        : '';
      const line = !can ? 'not built yet'
        : r ? (r.running || r.verdict || '') : 'not run';
      bits.push('<div class="bT ' + cls + '">' +
        '<div class="bT1"><span class="bN">' + t.name + '</span>' +
        (can ? '<button data-t="' + t.id + '">run</button>' : '') +
        '<b>' + line + '</b></div>' +
        '<div class="bB">' + t.blurb + '</div>' +
        // the test card's own fields (G107.1) — values live in cardVals so a
        // re-render (every poll tick) puts back what was typed
        (t.card && can ? '<div class="bCard">' + t.card.map(cfg =>
          '<label>' + cfg.label + ' <input data-card="' + t.id + ':' + cfg.k +
          '" value="' + ((cardVals[t.id] || {})[cfg.k] || '') +
          '" placeholder="' + (cfg.ph || '') + '" inputmode="decimal"> ' +
          cfg.unit + '</label>').join('') + '</div>' : '') +
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
    rows.querySelectorAll('input[data-card]').forEach(inp => {
      inp.disabled = !!live;
      inp.oninput = () => {
        const [id, k] = inp.dataset.card.split(':');
        (cardVals[id] || (cardVals[id] = {}))[k] = inp.value;
      };
    });
  }
  render();
}
