// ============================================================
// THE ENGINEERING BENCH (G64) — where a build earns its numbers.
// CERTIFIED (G208) — where it keeps them.
//
// The user's own framing, and the reason the plaque does not simply appear:
// "let's have a test section. We could run the test to get the plaque numbers,
// but also resurrect the wing loading... That's the engineering section before
// you try and roll out. Once the tests are passed the data gets filled."
//
// So the plaque starts EMPTY. It is a certificate, and a certificate you get
// for free is not one. Running a test fills it. And (G208, the user: "There
// needs to be more decorum around the process of doing this tests,
// certifications need to be awarded. The plane should keep its
// certifications, unless something changes in there") a certificate is now
// AWARDED, DATED, KEPT and WITHDRAWN:
//
//   AWARDED   a test that passes awards its certificate in a card over the
//             view — the stamp, the sticker it earns, the date. A test that
//             fails says what it found and what to turn, and awards nothing.
//   DATED     every result carries the day it was measured.
//   KEPT      every result carries a FINGERPRINT of the aeroplane it was
//             measured on — the join's spec with the cosmetic blocks (paint,
//             finish, meta) removed. A rebuild compares fingerprints and only
//             a build whose physics changed loses its certificates; a new
//             colour, a decal or a name never does. Before G208 every slider
//             pixel cleared the whole bench.
//   WITHDRAWN a certificate the build outgrew stays on the row, struck
//             through, with the reason, until the test is run again.
//   WORN      the awarded certificates are the stickers on the fuselage
//             (stickers.js reads BENCH_STATE().certs) — one roundel per
//             passed test, on both flanks, on the stand and in flight.
//
// AND THE TEST IS WATCHED. A live test freezes the interface (nothing else
// answers while the sim is being stepped) and reports as it goes: the phase
// strip, the clock, the live numbers, the circuit drawn in plan as it is
// flown with height against time under it, the pilot's verdicts as they
// arrive, and an abort. The user: "you may want to 'freeze' the interface
// and report on progress, with as much feedback as possible."
//
// THE TESTS ARE A DECLARED LIST, not a pair of buttons — a new test is a row
// in TESTS below plus whatever it needs on the bridge, and the UI, the
// staleness, the verdict line, the logbook entry, the seal and the sticker
// all follow from the row. Two kinds:
//   instant  a computation. It returns its verdict from `run`.
//   live     it steps the sim, so it starts, is polled, and ends. The bench
//            shows the physical aeroplane while it runs, because watching the
//            wing bend IS the test.
// Neither kind may invent a threshold: the verdicts below are the generator's
// own (`flyableCircuit`) and the rig's own (`state.verdict`). Nothing in this
// file is physics; G208 changed how the tests are run, shown and kept.
// ============================================================

// ---------------------------------------------------------------------------
// THE DECLARED TESTS.
// `needs` names the bridge calls a row uses, so a row that outruns the bridge
// says so instead of throwing halfway through a run. `steps` is the phase
// strip the run card shows for a live test; `stepOf` maps the sim's own
// phase name onto it.
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
      const why = [];
      if ((s.climbRate || 0) < 0.3) why.push('it climbs ' + benchNum(s.climbRate, 2) + ' m/s');
      if ((s.TORun || 0) > 1100) why.push('it needs ' + benchNum(s.TORun, 0) + ' m to take off');
      return {
        verdict: s.flyableCircuit ? 'FLIES A CIRCUIT' : 'WILL NOT FLY A CIRCUIT',
        ok: !!s.flyableCircuit,
        // the plaque is this test's real output; the line here is its headline
        note: benchNum(s.Vs * 3.6, 0) + ' km/h stall · ' +
              benchNum(s.climbRate, 2) + ' m/s climb · ' +
              benchNum(s.TORun, 0) + ' m take-off',
        why: why.join('; '),
        fix: s.flyableCircuit ? '' : 'power against weight: a bigger engine, a coarser '
           + 'propeller, less structure, or more wing area. The plaque\'s rows say which.',
        fills: 'plaque',
        // G208: THE TRIM ADVISOR's first reading — the tunnel's stabiliser
        // setting, in degrees; the elevator is neutral at cruise by its
        // construction (genTrim), so the advice is "start neutral"
        stabDeg: (s.stabTrim != null && isFinite(s.stabTrim)) ? s.stabTrim * 180 / Math.PI : null,
      };
    },
  },
  {
    id: 'load',
    name: 'Wing loading',
    blurb: 'Sandbags to +3.8 g limit and +5.7 g ultimate, FAR 23 normal.',
    kind: 'live',
    needs: ['loadTest', 'loadTestState', 'endLoadTest'],
    steps: ['on its back', 'settling', 'to +3.8 g limit', 'to +5.7 g ultimate', 'holding'],
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
        step: st.phase === 'settle' ? 1 : st.phase === 'hold' ? 4 : (st.n < 3.8 ? 2 : 3),
        live: { g: st.n, tipPct: st.tipPct, phase: st.phase, nTarget: st.nTarget },
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
        fix: st.verdict === 'HELD' ? '' : 'the spar, the struts or the wires gave: a deeper '
           + 'spar, a lift strut or a second bay of bracing carries the ultimate load.',
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
    // It DOES award its own sticker when it passes: a bush rating is a
    // rating.
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
        fix: climbs ? '' : 'thin air takes power and lift together: weight off first, '
           + 'then installed power; a turbocharged or electric powerplant holds its '
           + 'output with height.',
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
    steps: ['taxi', 'take-off', 'climb', 'cruise', 'approach', 'landing', 'crosswind'],
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
        step: benchFlightStep(r.phase),
        live: r,
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
        fix: rep.outcome === 'completed' ? ''
           : 'the phase it stopped in names the problem: a rejected take-off is '
           + 'power or field, a climb that never came is power against weight, '
           + 'a broken circuit is control authority.',
        fills: 'plaque',
        // G208: THE TRIM ADVISOR's measured reading — the elevator the pilot
        // held on the settled cruise leg (41_test_pilot.js report.trimDe)
        trim: (rep.trimDe != null && isFinite(rep.trimDe)) ? rep.trimDe : null,
      };
    },
    stop(api) { api.circuitEnd(); },
  },
];

const benchNum = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d);
// the trim the hand flies is clicks of TRIM_STEP (input.js, 0.02 of full
// elevator per click); the advisor speaks in the same units
const BENCH_TRIM_STEP = 0.02;
const benchTrimWords = de => {
  if (de == null || !isFinite(de)) return null;
  const k = Math.round(de / BENCH_TRIM_STEP);
  if (k === 0) return 'neutral';
  return Math.abs(k) + (Math.abs(k) === 1 ? ' click ' : ' clicks ') + (k > 0 ? 'nose up' : 'nose down');
};

// the test pilot's phase names onto the run card's seven steps
const BENCH_FLIGHT_STEPS = {
  TAXI: 0, LINEUP: 1, ROLL: 1, LIFTOFF: 1, ABORT: 1, CLIMB: 2, DEPART: 3,
  ENROUTE: 3, CRUISE: 3, HOLD: 3, TURNBACK: 3, INBOUND: 4, APPROACH: 4,
  GOAROUND: 4, FLARE: 5, PUTDOWN: 5, ROLLOUT: 5, STOP: 5, STOPPED: 5,
};
function benchFlightStep(phase) {
  if (!phase) return 0;
  const p = String(phase).toUpperCase();
  if (p.indexOf('CROSSWIND') === 0) return 6;
  const k = BENCH_FLIGHT_STEPS[p];
  return k == null ? 3 : k;
}

// ---------------------------------------------------------------------------
// THE FINGERPRINT (G208). The join's spec with what does not fly removed.
// `paint` is colour, `finish` is the material lab's look (sheen, tiling,
// wear — the covering's MASS is a cage row and stays), `meta` is the name
// and the registration. What is left is the aeroplane the tests measured.
// FNV-1a over the JSON: short, stable, and enough to say "this build" —
// a collision would keep a certificate on a different aeroplane, and at 32
// bits over a builder's own handful of edits that is not a real risk.
// ---------------------------------------------------------------------------
const BENCH_COSMETIC = ['paint', 'finish', 'meta'];
function benchStripCosmetic(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const c = JSON.parse(JSON.stringify(spec));
  for (const k of BENCH_COSMETIC) delete c[k];
  return c;
}
function benchHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}
// ...AND THE PHYSICS IT WAS MEASURED UNDER (TAIL CHANTIER 2 P5, ruling (p)):
// GEN_SPEC_V (what the file means) and PHYSICS_V (what the solver answers,
// 60_gen_spec.js) are folded in ahead of the spec, so a certificate earned
// under an older physics does not load VALID over a plaque that now says
// otherwise — it loads withdrawn, with the reason (BENCH_RESTORE).
function benchVersionTag() {
  const sv = (typeof GEN_SPEC_V !== 'undefined') ? GEN_SPEC_V : 0;
  const pv = (typeof PHYSICS_V !== 'undefined') ? PHYSICS_V : 0;
  return 'v' + sv + '|p' + pv + '|';
}
function benchFingerprint(spec) {
  const c = benchStripCosmetic(spec);
  return c ? benchHash(benchVersionTag() + JSON.stringify(c)) : null;
}

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

  let results = {};        // id -> the last result of that test (+when, fp)
  let live = null;         // { test, timer } while a live test runs
  let busy = false;        // suppress the dirty hook while WE are driving
  const cardVals = {};     // id -> { k: string } — the typed test card (G107.1);
                           // survives re-renders, deliberately NOT cleared by
                           // BENCH_DIRTY: the card is the ASK, not a result
  let trimUse = true;      // the advisor's trim accepted as the roll-out default
  let withdrawnNote = ''; // the header's line after a withdrawal

  const usable = t => !!(t.run || t.start) &&
    (t.needs || []).every(k => typeof api[k] === 'function');
  const today = () => new Date().toISOString().slice(0, 10);

  // ---- the fingerprint of the aeroplane on the stand ----------------------
  // Off the join's export — the same spec the tests measure — with the
  // cosmetic blocks removed. Null when there is no join (core-only build, or
  // the editor not up yet), which every caller treats as "cannot say".
  function fpNow() {
    try {
      const J = window.CAGE_JOIN;
      if (!J || typeof J.export !== 'function') return null;
      return benchFingerprint(J.export());
    } catch (e) { return null; }
  }

  // ---- the certificate ---------------------------------------------------
  // `stale` is a result the build outgrew: it stays on its row, struck
  // through, with the reason, and counts for nothing. Withdrawal is the ONLY
  // way a result leaves the bench short of running the test again.
  //
  // AND IT PERSISTS (G107.3): the results — plus the two sheets only a test
  // run can produce — ride in the save envelope through
  // `GARAGE_SPEC.plaque(...)`, and come back through `BENCH_RESTORE` below.
  // A restored result that predates the fingerprint (a save from before
  // G208) is stamped with the loaded build's own, so it is kept exactly as
  // long as a fresh one would be.
  const settled = id => results[id] && !results[id].running && !results[id].stale;
  const awarded = id => settled(id) && results[id].ok;
  const anyRun = () => Object.keys(results).some(settled);
  const anyStale = () => Object.keys(results).some(id => results[id] && results[id].stale);
  // ADVISORY rows (dalt) do not gate the certificate — measured-but-not-a-
  // bush-plane is information, not failure (G107).
  const gating = () => BENCH_TESTS.filter(t => usable(t) && !t.advisory);
  const passed = () => gating().every(t => awarded(t.id));
  const certs = () => BENCH_TESTS.filter(t => awarded(t.id))
    .map(t => ({ id: t.id, when: results[t.id].when || null }));
  const plaqueOn = () => BENCH_TESTS.some(t => settled(t.id) && results[t.id].fills === 'plaque');

  function withdraw(reason) {
    let n = 0;
    for (const id in results) {
      const r = results[id];
      if (!r || r.running || r.stale) continue;
      results[id] = { stale: true, was: r.verdict || '', ok: false,
                      when: r.when || null, why: reason };
      n++;
    }
    if (!n) return;
    withdrawnNote = reason;
    api.plaque(plaqueOn());
    persist();
    stickersChanged();
    render();
  }
  // THE DIRTY HOOK, on a fingerprint (G208). A rebuild used to clear the
  // whole bench; now it asks whether the aeroplane changed. Debounced,
  // because a slider drag rebuilds per pixel and the join's export is not
  // free; a withdrawal 150 ms late is still a withdrawal. A dirty that
  // arrives with nothing settled on the bench does nothing, which is also
  // what keeps the load path's own storms off a restored certificate.
  let dirtyT = null;
  window.BENCH_DIRTY = () => {
    if (busy || live) return;
    if (!anyRun()) return;
    if (dirtyT) clearTimeout(dirtyT);
    dirtyT = setTimeout(() => {
      dirtyT = null;
      if (busy || live || !anyRun()) return;
      const fp = fpNow();
      if (fp == null) return;                       // cannot say: keep
      const changed = Object.keys(results).some(id =>
        settled(id) && results[id].fp && results[id].fp !== fp);
      const unstamped = Object.keys(results).some(id => settled(id) && !results[id].fp);
      if (changed || unstamped) withdraw('the build changed');
    }, 150);
  };
  // ...and the other direction: every SETTLED result mirrors the bench into
  // the store, so the envelope always says what the bench would say.
  function persist() {
    try {
      const G = window.GARAGE_SPEC;
      if (!G || !G.plaque) return;
      if (!Object.keys(results).length) { G.plaque(null); return; }
      G.plaque({ when: today(), trimUse,
                 results: JSON.parse(JSON.stringify(results)),
                 sheets: (typeof api.sheets === 'function') ? api.sheets()
                                                            : null });
    } catch (e) {}
  }
  // the load path calls this LAST, after its own dirty storm (garage.js
  // loadSpec; app.js boot). Restoring is not running: no logbook rows, no
  // ceremony, and never over a live test.
  window.BENCH_RESTORE = pq => {
    if (live) return;
    if (dirtyT) { clearTimeout(dirtyT); dirtyT = null; }
    if (!pq || !pq.results || !Object.keys(pq.results).length) {
      results = {}; withdrawnNote = '';
      api.plaque(false); stickersChanged(); render();
      return;
    }
    busy = true;
    results = JSON.parse(JSON.stringify(pq.results));
    for (const id in results) if (results[id] && results[id].running) delete results[id];
    trimUse = pq.trimUse !== false;
    withdrawnNote = anyStale() ? 'the build changed' : '';
    // THE RESTORE COMPARES, IT DOES NOT STAMP (TAIL CHANTIER 2 P5, ruling
    // (p)). It used to write the LIVE fingerprint onto any certificate that
    // had none — re-certifying a pre-G208 result against whatever aeroplane
    // was on the stand — and never looked at a stored one. Now: a settled
    // certificate whose fingerprint is not the live one (the build changed,
    // or the physics did — PHYSICS_V is in the fingerprint) is WITHDRAWN
    // here with the reason, kept struck through as the dirty hook keeps
    // them; one with no fingerprint at all is withdrawn as certified before
    // fingerprints. Only what was measured on THIS aeroplane under THIS
    // physics loads valid.
    const fp = fpNow();
    if (fp) {
      let changed = 0, unstamped = 0;
      for (const id in results) {
        const r = results[id];
        if (!r || r.stale) continue;
        if (!r.fp) unstamped++;
        else if (r.fp !== fp) changed++;
      }
      if (changed || unstamped) {
        const reason = changed ? 'the build or its physics changed since the certificate'
                               : 'certified before fingerprints';
        for (const id in results) {
          const r = results[id];
          if (!r || r.stale) continue;
          if (!r.fp || r.fp !== fp)
            results[id] = { stale: true, was: r.verdict || '', ok: false,
                            when: r.when || null, why: reason };
        }
        withdrawnNote = reason;
      }
    }
    if (typeof api.restoreSheets === 'function')
      api.restoreSheets(pq.sheets || null);
    api.plaque(plaqueOn());
    busy = false;
    stickersChanged();
    render();
  };
  // app.js labels ROLL OUT off BENCH_STATE, so it has to be told when that
  // changed rather than polling it every frame
  const changed = () => {
    if (typeof window.BENCH_CHANGED === 'function') window.BENCH_CHANGED();
  };
  const stickersChanged = () => {
    try { if (window.STICKERS && window.STICKERS.refresh) window.STICKERS.refresh(); }
    catch (e) {}
  };

  // app.js asks this to label ROLL OUT and to seed the hand's trim; the
  // stickers read `certs`. Never a lock — it is your aeroplane, and building
  // it wrong and learning why is content, not error.
  window.BENCH_STATE = () => {
    const f = results.flight;
    return { any: anyRun(), passed: passed(), results, certs: certs(),
             stale: anyStale(),
             trim: (trimUse && f && !f.stale && !f.running && f.ok
                    && f.trim != null && isFinite(f.trim)) ? f.trim : null };
  };

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

  // a result settles: stamped with the day and the aeroplane, noted in the
  // logbook, persisted, and — when the test was run rather than restored —
  // awarded in the card over the view. `after` runs when the card closes.
  function settle(t, r, fp, after) {
    r.when = today();
    r.fp = fp;
    results[t.id] = r;
    if (r.fills === 'plaque' && r.ok !== undefined) api.plaque(plaqueOn());
    if (!anyStale()) withdrawnNote = '';
    note(t, r);
    persist();
    stickersChanged();
    render();
    award(t, r, after);
  }

  function runOne(t, after) {
    if (live || !usable(t)) { if (after) after(); return; }
    busy = true;
    const errs = sync();
    const fp = fpNow();
    busy = false;
    if (errs && errs.length) {
      // AND THE CERTIFICATE GOES WITH IT. Leaving the last run's plaque up
      // while this run says the build cannot be measured is the same fault
      // G60 fixed for aircraft switching — a plaque reading someone else's
      // certificate — and here it would be reading one for an aeroplane that
      // was never successfully built.
      settle(t, { verdict: 'CANNOT MEASURE THIS BUILD', ok: false,
                  note: errs.join(' · ') }, fp, after);
      api.plaque(false);
      return render();
    }
    if (t.kind === 'live') {
      if (!t.offscreen) api.showPhysical(true);   // the flight flies a 2nd sim
      t.start(api, cardVals[t.id] || {});
      live = { test: t, after, fp, t0: performance.now() };
      results[t.id] = { running: 'starting', ok: false };
      freeze(t);
      render();
      live.timer = setInterval(() => {
        let r;
        try { r = t.poll(api); }
        catch (e) { r = { done: true, verdict: 'threw: ' + e.message, ok: false }; }
        results[t.id] = r;
        if (r.done) endLive(t, r);
        else runCard(t, r);
      }, 120);
      return;
    }
    // an instant test still takes a moment (the tunnel); the card shows
    // first, then the measurement runs, then the award
    freeze(t, true);
    results[t.id] = { running: 'measuring', ok: false };
    render();
    setTimeout(() => {
      let r;
      try { r = t.run(api); }
      catch (e) { r = { verdict: 'threw: ' + e.message, ok: false }; }
      unfreeze();
      settle(t, r, fp, after);
    }, 40);
  }

  function endLive(t, r) {
    clearInterval(live.timer);
    const L = live;
    live = null;
    // the result is read BEFORE the rig is taken down, because taking it down
    // rebuilds the aeroplane back onto its wheels
    busy = true;
    try { t.stop(api); } catch (e) {}
    if (!t.offscreen) api.showPhysical(false);
    busy = false;
    unfreeze();
    if (r && r.aborted) {
      delete results[t.id];
      render();
      if (L.after) L.after();
      return;
    }
    settle(t, r, L.fp, L.after);
  }

  function abortLive() {
    if (!live) return;
    endLive(live.test, { aborted: true, ok: false, verdict: 'ABORTED' });
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
    // sequentially, because a live test owns the sim while it runs, and
    // each award card closes before the next test starts
    const queue = BENCH_TESTS.filter(usable);
    const next = () => {
      const t = queue.shift();
      if (!t) return;
      runOne(t, next);
    };
    next();
  }

  // ---- THE FREEZE AND THE RUN CARD (G208) --------------------------------
  // Built once, on the body, so they sit over the view and not inside the
  // scrolling panel. Guarded throughout: the smoke test's DOM is a stub.
  let UI = null;
  function ui() {
    if (UI) return UI;
    try {
      const body = document.body;
      if (!body || !body.appendChild) return null;
      const mk = (tag, cls, html) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
      };
      const freezeEl = mk('div'); freezeEl.id = 'bFreeze'; freezeEl.hidden = true;
      const run = mk('div'); run.id = 'bRun'; run.hidden = true;
      run.innerHTML =
        '<div class="bRh"><span class="bRk">testing</span><b class="bRn"></b>' +
        '<span class="bRt"></span><button class="bRx">abort</button></div>' +
        '<div class="bRph"></div><div class="bRbar"><i></i></div>' +
        '<div class="bRlive"></div><canvas class="bRtrace" width="760" height="380"></canvas>' +
        '<div class="bRnotes"></div>';
      const aw = mk('div'); aw.id = 'bAward'; aw.hidden = true;
      body.appendChild(freezeEl); body.appendChild(run); body.appendChild(aw);
      const q = s => run.querySelector(s);
      UI = { freeze: freezeEl, run, aw, name: q('.bRn'), clock: q('.bRt'),
             abort: q('.bRx'), ph: q('.bRph'), bar: q('.bRbar i'),
             liveEl: q('.bRlive'), trace: q('.bRtrace'), notes: q('.bRnotes') };
      UI.abort.onclick = abortLive;
      try {
        window.addEventListener('keydown', e => {
          if (e.key === 'Escape' && live) abortLive();
        });
      } catch (e) {}
      return UI;
    } catch (e) { return null; }
  }
  let trace = null;      // { pts, agl, t } for the flight's plan view
  function freeze(t, instant) {
    const U = ui();
    try { document.body.classList.add('benchBusy'); } catch (e) {}
    if (!U) return;
    U.freeze.hidden = false;
    U.run.hidden = false;
    U.name.textContent = t.name;
    U.clock.textContent = '';
    U.abort.hidden = !!instant;
    U.ph.innerHTML = (t.steps || []).map(s => '<span>' + s + '</span>').join('');
    U.bar.className = instant ? 'ind' : '';
    U.bar.style.width = instant ? '' : '0%';
    U.liveEl.innerHTML = instant ? 'in the tunnel: the trim probe, the stance, the mass ledger'
                                 : 'starting';
    U.trace.hidden = t.id !== 'flight' && t.id !== 'load';
    U.notes.innerHTML = '';
    trace = { pts: [], agl: [], t: [], notes: 0 };
    if (!U.trace.hidden) drawTrace(t, null);
  }
  function unfreeze() {
    try { document.body.classList.remove('benchBusy'); } catch (e) {}
    const U = ui();
    if (!U) return;
    U.freeze.hidden = true;
    U.run.hidden = true;
  }
  function runCard(t, r) {
    const U = ui();
    if (!U || U.run.hidden) return;
    const el = (r.t != null) ? r.t : (live ? (performance.now() - live.t0) / 1000 : 0);
    U.clock.textContent = (r.live && r.live.t != null)
      ? 't = ' + benchNum(r.live.t, 0) + ' s' : '';
    const k = r.step == null ? -1 : r.step;
    const spans = U.ph.children || [];
    for (let i = 0; i < spans.length; i++)
      spans[i].className = i < k ? 'done' : i === k ? 'now' : '';
    if (r.progress != null) {
      U.bar.className = '';
      U.bar.style.width = (Math.max(0, Math.min(1, r.progress)) * 100).toFixed(1) + '%';
    }
    const L = r.live || {};
    if (t.id === 'flight') {
      const V = L.V, agl = L.agl;
      U.liveEl.innerHTML =
        '<span>phase <b>' + String(L.phase || '').toLowerCase() + '</b></span>' +
        (V != null && isFinite(V) ? '<span>speed <b>' + benchNum(V * 3.6, 0) + '</b> km/h</span>' : '') +
        (agl != null && isFinite(agl) ? '<span>height <b>' + benchNum(agl, 0) + '</b> m</span>' : '') +
        (L.de != null && isFinite(L.de) ? '<span>elevator <b>' + benchNum(L.de * 100, 0) + '</b> %</span>' : '');
      if (L.pos && trace) {
        trace.pts.push([L.pos[0], L.pos[2]]);
        trace.agl.push(agl != null && isFinite(agl) ? agl : 0);
        trace.t.push(L.t || 0);
        if (L.path) trace.path = L.path;
      }
      const notes = L.notes || [];
      if (trace && notes.length > trace.notes) {
        for (let i = trace.notes; i < notes.length; i++) {
          const d = document.createElement('div');
          d.textContent = 't=' + notes[i].t + ' s · ' + notes[i].code +
            (notes[i].note ? ' — ' + notes[i].note : '');
          U.notes.appendChild(d);
        }
        trace.notes = notes.length;
      }
    } else if (t.id === 'load') {
      U.liveEl.innerHTML =
        '<span>load <b>' + benchNum(L.g, 2) + '</b> g of ' + benchNum(L.nTarget, 1) + '</span>' +
        '<span>tip <b>' + benchNum(L.tipPct, 2) + '</b> % of semispan</span>' +
        '<span>' + (L.phase === 'settle' ? 'settling on the trestles'
                   : L.phase === 'hold' ? 'holding at ultimate' : 'bags going on') + '</span>';
    } else {
      U.liveEl.textContent = r.running || '';
    }
    if (!U.trace.hidden) drawTrace(t, L);
    void el;
  }
  // THE TRACE. Flight: the circuit in plan — the pattern the pilot laid out,
  // the track flown over it, the aeroplane's dot — with height against time
  // in a strip under it. Load: the g ramp with the limit and ultimate marks
  // and the tip deflection beside it.
  function drawTrace(t, L) {
    const U = ui();
    if (!U) return;
    let g;
    try { g = U.trace.getContext('2d'); } catch (e) { return; }
    if (!g) return;
    const W = U.trace.width, Hh = U.trace.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, Hh);
    g.font = '500 20px "IBM Plex Sans", sans-serif';
    if (t.id === 'load') {
      const gNow = (L && L.g) || 0, gT = (L && L.nTarget) || 5.7;
      const x0 = 60, x1 = W - 60, y = Hh * 0.42;
      const X = v => x0 + (x1 - x0) * Math.max(0, Math.min(1, v / gT));
      g.fillStyle = 'rgba(255,248,236,.10)'; g.fillRect(x0, y - 14, x1 - x0, 28);
      g.fillStyle = 'rgba(230,219,201,.75)'; g.fillRect(x0, y - 14, X(gNow) - x0, 28);
      g.fillStyle = 'rgba(244,239,230,.9)';
      for (const [v, lab] of [[1, '1 g'], [3.8, 'limit 3.8 g'], [5.7, 'ultimate 5.7 g']]) {
        if (v > gT + 1e-6) continue;
        g.fillRect(X(v) - 1.5, y - 24, 3, 48);
        g.textAlign = v > 4 ? 'right' : 'center';
        g.fillText(lab, X(v) + (v > 4 ? 6 : 0), y + 54);
      }
      g.textAlign = 'left'; g.font = '600 26px "IBM Plex Mono", monospace';
      g.fillText(benchNum(gNow, 2) + ' g', x0, y - 40);
      g.textAlign = 'right'; g.font = '500 20px "IBM Plex Sans", sans-serif';
      g.fillText('tip ' + benchNum(L && L.tipPct, 2) + ' % of semispan', x1, y - 40);
      // the deflection as a bent line: the semispan, bending by tip %
      const s0 = 60, s1 = W - 60, yb = Hh * 0.82, tip = ((L && L.tipPct) || 0) / 100;
      g.strokeStyle = 'rgba(151,144,127,.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(s0, yb); g.lineTo(s1, yb); g.stroke();
      g.strokeStyle = 'rgba(244,239,230,.95)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(s0, yb);
      for (let i = 1; i <= 24; i++) {
        const f = i / 24;
        g.lineTo(s0 + (s1 - s0) * f, yb - f * f * tip * (s1 - s0) * 0.5);
      }
      g.stroke();
      return;
    }
    // the flight
    const T = trace || { pts: [], agl: [], t: [] };
    const pts = T.pts, path = T.path;
    const planH = Hh * 0.68;
    // bounds over the path and the track
    let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity;
    const take = p => { if (!p) return; const x = p[0], z = p[1];
      if (!isFinite(x) || !isFinite(z)) return;
      xa = Math.min(xa, x); xb = Math.max(xb, x); za = Math.min(za, z); zb = Math.max(zb, z); };
    for (const p of pts) take(p);
    if (path && path.length) for (const p of path) take(Array.isArray(p) ? p : [p.x, p.z]);
    g.fillStyle = 'rgba(151,144,127,.9)'; g.textAlign = 'left';
    if (!isFinite(xa)) { g.fillText('the circuit, as it is flown', 16, 30); return; }
    // a square metre scale; at least 600 m across so a taxi does not zoom in
    const cx = (xa + xb) / 2, cz = (za + zb) / 2;
    const span = Math.max(600, xb - xa, zb - za) * 1.15;
    const sc = Math.min(W - 24, planH - 24) / span;
    const X = x => W / 2 + (x - cx) * sc, Z = z => planH / 2 - (z - cz) * sc;
    // the pattern the pilot laid out
    if (path && path.length > 1) {
      g.strokeStyle = 'rgba(151,144,127,.55)'; g.lineWidth = 2; g.setLineDash([8, 8]);
      g.beginPath();
      path.forEach((p, i) => { const q = Array.isArray(p) ? p : [p.x, p.z];
        if (i) g.lineTo(X(q[0]), Z(q[1])); else g.moveTo(X(q[0]), Z(q[1])); });
      g.stroke(); g.setLineDash([]);
    }
    // the track
    if (pts.length > 1) {
      g.strokeStyle = 'rgba(244,239,230,.95)'; g.lineWidth = 3;
      g.beginPath();
      pts.forEach((p, i) => { if (i) g.lineTo(X(p[0]), Z(p[1])); else g.moveTo(X(p[0]), Z(p[1])); });
      g.stroke();
    }
    if (pts.length) {
      const p = pts[pts.length - 1];
      g.fillStyle = '#e6dbc9';
      g.beginPath(); g.arc(X(p[0]), Z(p[1]), 6, 0, Math.PI * 2); g.fill();
      const p0 = pts[0];
      g.strokeStyle = 'rgba(230,219,201,.8)'; g.lineWidth = 2;
      g.beginPath(); g.arc(X(p0[0]), Z(p0[1]), 6, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = 'rgba(151,144,127,.9)';
    g.fillText(Math.round(span / 1.15) + ' m across', 16, planH - 12);
    // the height strip
    const y0 = planH + 14, y1 = Hh - 8;
    g.fillStyle = 'rgba(255,248,236,.06)'; g.fillRect(12, y0, W - 24, y1 - y0);
    const n = T.agl.length;
    if (n > 1) {
      const aglMax = Math.max(30, ...T.agl), tMax = Math.max(60, T.t[n - 1]);
      g.strokeStyle = 'rgba(244,239,230,.9)'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = 12 + (W - 24) * T.t[i] / tMax, y = y1 - (y1 - y0) * T.agl[i] / aglMax;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = 'rgba(151,144,127,.9)'; g.textAlign = 'right';
      g.fillText('height ' + Math.round(T.agl[n - 1]) + ' m · ' + Math.round(T.t[n - 1]) + ' s', W - 16, y0 + 24);
    }
  }

  // ---- THE AWARD (G208) ------------------------------------------------
  // A passed test: the stamp, the roundel it earns, the date; it closes by
  // itself after a moment or on a click. A failed test: what it found and
  // what to turn, and it waits for the click (a fail is read, not glanced
  // at). `after` runs when the card closes — the run-all queue rides it.
  let awardT = null;
  function award(t, r, after) {
    const U = ui();
    const done = () => {
      if (awardT) { clearTimeout(awardT); awardT = null; }
      if (U) { U.aw.hidden = true; U.aw.onclick = null; }
      if (after) after();
    };
    if (!U || !r) { done(); return; }
    const M = (window.STICKERS && window.STICKERS.META && window.STICKERS.META[t.id]) || null;
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    U.aw.className = r.ok ? '' : 'no';
    U.aw.innerHTML =
      '<div class="bAk">' + (r.ok ? 'certificate awarded' : 'not awarded') + '</div>' +
      '<div class="bAn">' + esc(t.name) + '</div>' +
      (r.ok ? '<canvas width="300" height="300"></canvas>' : '') +
      '<div class="bAs">' + (r.ok ? 'certified' : 'failed') + '</div>' +
      '<div class="bAv"><b>' + esc(r.verdict) + '</b>' +
      (r.note ? '<br>' + esc(r.note) : '') + '</div>' +
      (!r.ok && (r.why || r.fix) ? '<div class="bAf">' +
        (r.why ? esc(r.why) + '<br>' : '') + (r.fix ? '→ ' + esc(r.fix) : '') + '</div>' : '') +
      '<div class="bAd">' + esc(r.when || today()) + (r.ok ? ' · the sticker is on the fuselage' : '') +
      ' · click to close</div>';
    U.aw.hidden = false;
    if (r.ok && M && window.STICKERS && window.STICKERS.roundel) {
      try {
        const cv = U.aw.querySelector('canvas');
        const g = cv.getContext('2d');
        window.STICKERS.roundel(g, 150, 150, 142, { title: M.title, emblem: M.emblem, date: r.when || today() });
      } catch (e) {}
    }
    U.aw.onclick = done;
    awardT = setTimeout(done, r.ok ? 2800 : 9000);
  }

  // ---- the panel ---------------------------------------------------------
  function sealCanvas(id, on, size) {
    const M = window.STICKERS && window.STICKERS.META && window.STICKERS.META[id];
    return '<canvas class="' + (on ? '' : 'off') + '" data-seal="' + id + '" width="' + (size * 2) +
           '" height="' + (size * 2) + '" title="' + (M ? M.title.toLowerCase() : id) +
           (on ? ' · certified' : ' · not certified') + '"></canvas>';
  }
  function paintSeals() {
    let cvs;
    try { cvs = rows.querySelectorAll('canvas[data-seal]'); } catch (e) { return; }
    if (!cvs || !cvs.length || !window.STICKERS) return;
    cvs.forEach(cv => {
      const id = cv.dataset ? cv.dataset.seal : cv.getAttribute('data-seal');
      const M = window.STICKERS.META[id];
      if (!M) return;
      try {
        const g = cv.getContext('2d');
        const s = cv.width;
        g.clearRect(0, 0, s, s);
        window.STICKERS.roundel(g, s / 2, s / 2, s / 2 - 2,
          { title: M.title, emblem: M.emblem, small: s < 120,
            date: results[id] && results[id].when });
      } catch (e) {}
    });
  }
  function render() {
    const bits = [];
    const nCert = certs().length, nGate = gating().length;
    const v = live ? '<b class="run">TESTING</b>'
      : anyRun()
      ? (passed() ? '<b class="cert">CERTIFIED</b>'
                  : '<b class="bad">NOT PASSED</b>')
      : anyStale() ? '<b class="stale">WITHDRAWN</b>'
      : '<b class="dim">UNTESTED</b>';
    bits.push('<div class="bHead"><span>engineering bench</span>' + v +
      '<button id="bRunAll">run the tests</button>' +
      '<div class="bSeals">' +
      BENCH_TESTS.map(t => sealCanvas(t.id, awarded(t.id), 34)).join('') +
      '<em>' + (nCert ? nCert + ' of ' + BENCH_TESTS.length + ' certificates'
                        + (passed() ? ' · airworthy' : nGate && !passed() ? '' : '')
                      : withdrawnNote ? 'certificates withdrawn — ' + withdrawnNote
                      : 'no certificate yet') + '</em>' +
      '</div></div>');
    for (const t of BENCH_TESTS) {
      const r = results[t.id] || null;
      const can = usable(t);
      const cls = !can ? 'dim'
        : !r ? ''
        : r.running ? 'run'
        : r.stale ? 'stale'
        : r.ok ? 'cert'
        : (t.advisory ? 'adv' : 'bad');
      let line;
      if (!can) line = 'not built yet';
      else if (!r) line = 'not run';
      else if (r.running) line = r.running;
      else if (r.stale) line = '<s>' + (r.was || '') + '</s><i>withdrawn — ' + (r.why || 'the build changed') + '</i>';
      else line = (r.verdict || '') + (r.when ? '<i>' + (r.ok ? 'certified ' : '') + r.when + '</i>' : '');
      // the advisor's line (G208): after the bench check, the tunnel's trim;
      // after the test flight, the trim the pilot held, and the offer to make
      // it the roll-out default
      let adv = '';
      if (r && !r.running && !r.stale) {
        if (t.id === 'shake' && r.stabDeg != null)
          adv = 'the tunnel set the stabiliser to <b>' + benchNum(r.stabDeg, 1) +
                '°</b> for cruise, elevator neutral — start with the trim at ' +
                '<b>neutral</b>; the test flight measures what the pilot actually holds.';
        if (t.id === 'flight' && r.ok && r.trim != null) {
          const w = benchTrimWords(r.trim);
          adv = 'on the cruise leg the pilot held <b>' + w + '</b> (elevator ' +
                benchNum(r.trim * 100, 0) + ' %). ' +
                '<label><input type="checkbox" id="bTrimUse"' + (trimUse ? ' checked' : '') +
                '> set it as the roll-out trim</label>';
        }
      }
      bits.push('<div class="bT ' + cls + '">' +
        '<div class="bT1">' + sealCanvas(t.id, awarded(t.id), 26) +
        '<span class="bN">' + t.name + '</span>' +
        (can ? '<button data-t="' + t.id + '">' + (r && !r.running && !r.stale ? 'run again' : 'run') + '</button>' : '') +
        '<b>' + line + '</b></div>' +
        '<div class="bB">' + t.blurb + '</div>' +
        // the test card's own fields (G107.1) — values live in cardVals so a
        // re-render (every poll tick) puts back what was typed
        (t.card && can ? '<div class="bCard">' + t.card.map(cfg =>
          '<label>' + cfg.label + ' <input data-card="' + t.id + ':' + cfg.k +
          '" value="' + ((cardVals[t.id] || {})[cfg.k] || '') +
          '" placeholder="' + (cfg.ph || '') + '" inputmode="decimal"> ' +
          cfg.unit + '</label>').join('') + '</div>' : '') +
        (r && r.note && !r.stale ? '<div class="bW">' + r.note + '</div>' : '') +
        (r && !r.ok && !r.stale && !r.running && (r.why || r.fix)
          ? '<div class="bWhy">' + (r.why ? r.why + ' — ' : '') + (r.fix || '') + '</div>' : '') +
        (adv ? '<div class="bAdv">' + adv + '</div>' : '') +
        '</div>');
    }
    rows.innerHTML = bits.join('');
    paintSeals();
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
    const tu = $('bTrimUse');
    if (tu) tu.onchange = () => { trimUse = !!tu.checked; persist(); changed(); };
  }
  render();
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { BENCH_TESTS, BENCH_COSMETIC, benchStripCosmetic, benchHash,
                     benchFingerprint, benchFlightStep, benchTrimWords, benchNum };
