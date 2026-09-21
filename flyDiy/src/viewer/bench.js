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
    //
    // THE VERDICT RULE (A9, the user: "a lot of planes fail it and there
    // seems to be really no option, especially when the wing geometry is a
    // real plane's"). The row used to fail the certificate on the rig's
    // 'HELD — over yield', a PROXY the rig itself calls coarse (65:361: one
    // lin/rho area per class, the lift strut judged as a wing member —
    // GATE LOAD deliberately does not gate on it). Measured over the 26
    // archetype cards at HEAD: seven failed on the proxy alone, none broke
    // up; fitting lift struts HALVED a jodel's deflection and RAISED its
    // yield figure, because the strut became the worst 'wing' member. So
    // the proxy is now a warning on the card, and the certificate fails on
    // what the rig can actually see: a member that let go (BROKE UP) or a
    // tip past LOAD_TIP_CAP at ultimate (GATE FLEX's reality figures: real
    // wings bend 2-4 % of the semispan at limit, 8 % at 1 g is 'folds in
    // bending'; a sixth of the span at ultimate is not a wing that held).
    // AND THE FIX IS MEASURED: after a failed or warned rig the ADVISOR runs
    // the same rig on the levers the wing page has (bench_worker.js: lift
    // struts, an aluminium or carbon wing, a metre off the span) and prints
    // each tip as it lands. Thickness and spar stations are not offered —
    // measured on the jodel, the first moved nothing and the second made it
    // worse.
    start(api) { api.loadTest(); },
    poll(api) {
      const st = api.loadTestState();
      if (!st) return { verdict: 'no wing to load', ok: false, done: true };
      const nT = Math.max(1e-6, st.nTarget || 5.7);
      const pct = Math.max(0, Math.min(1, st.n / nT));
      // the card's progress over the rig's own phases: settle, ramp, hold
      const prog = st.phase === 'settle' ? 0.1 : st.phase === 'hold' ? 0.95 : 0.2 + 0.7 * pct;
      const thread = st.thread === 'worker' ? 'off the page' : st.thread === 'page' ? 'on the page' : '';
      const slow = (st.rate != null && isFinite(st.rate) && st.rate < 0.85) ? ' · ' + benchNum(st.rate, 1) + '× real time' : '';
      if (!st.done) return {
        done: false,
        running: (st.phase === 'settle' ? 'settling on the trestles'
          : benchNum(st.n, 2) + ' g · tip ' + benchNum(st.tipPct, 2) + ' %') + (thread ? ' · ' + thread : '') + slow,
        progress: prog,
        step: st.phase === 'settle' ? 1 : st.phase === 'hold' ? 4 : (st.n < 3.8 ? 2 : 3),
        live: { g: st.n, tipPct: st.tipPct, phase: st.phase, nTarget: st.nTarget,
                limit: st.limit, ult: st.ult, thread, rate: st.rate },
      };
      const broke = st.verdict === 'BROKE UP';
      const bent = st.ultPct != null && isFinite(st.ultPct) && st.ultPct > LOAD_TIP_CAP;
      const overYield = st.ultYield != null && isFinite(st.ultYield) && st.ultYield >= 100;
      const ok = !broke && !bent;
      const why = broke ? 'a member let go before the ultimate load'
                : bent ? 'the tip bent ' + benchNum(st.ultPct, 1) + ' % of the semispan at ultimate — past the '
                         + LOAD_TIP_CAP + ' % a wing can bend and still be called held' : '';
      return {
        done: true,
        verdict: broke ? 'BROKE UP' : bent ? 'NOT HELD — bent ' + benchNum(st.ultPct, 1) + ' %' : 'HELD',
        ok,
        note: 'limit ' + benchNum(st.limitPct, 2) + ' % of semispan · ultimate '
          + benchNum(st.ultPct, 2) + ' %'
          + (st.ultYield == null ? ''
             : ' · worst member ' + benchNum(st.ultYield, 0) + ' % of the yield proxy'
               + (st.worstCls ? ' (' + st.worstCls + ')' : '')),
        why,
        // the proxy, reported and named for what it is
        warn: overYield ? 'worst member at ' + benchNum(st.ultYield, 0) + ' % of the yield proxy'
                + (st.worstCls ? ' (' + st.worstCls + ')' : '')
                + ' — reported, not failed: one area per member class, the lift strut sized as a wing member' : '',
        fix: ok ? '' : 'the levers below are measured on this wing: fixation (lift struts), '
           + 'construction (an aluminium or carbon wing), span.',
        // the advisor runs after a fail OR a warning
        advise: !ok || overYield,
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
    // A REAL FLIGHT (A9, the user: "the test flight is too long and not
    // cinematic enough — do the three first tests, award the global one
    // after the first actual successful flight"). G107 flew a hidden second
    // sim on the test pilot for 420 s, then the crosswind ladder, and nobody
    // could watch either. This row now HANDS OFF: it rolls the aeroplane
    // out, the pilot flies its own circuit on the real world with the camera
    // cutting to the phases, and the certificate is awarded when the
    // aeroplane ARRIVES — through app.js's logFlight → BENCH_FLIGHT_LOGGED,
    // which also fires for a flight you flew by hand: a landing is a
    // landing. The fingerprint is taken at roll-out (the arming), so an
    // edit made while the aeroplane is out is not what got certified.
    id: 'flight',
    name: 'Test flight',
    blurb: 'A circuit on the pilot, out on the field — awarded on arrival, yours or the pilot’s.',
    kind: 'flown',              // no freeze, no poll: the game is the test
    steps: ['taxi', 'take-off', 'climb', 'cruise', 'approach', 'landing'],
    // THE TEST CARD (G107.1): the two setpoints the game imposes on the
    // flight. Blank = the pilot's own circuit. The pilot clamps an unsafe ask
    // (never below its own approach speed or safe height) and SAYS so, and
    // the plaque prints asked-vs-flown. Units are the UI's; app.js converts.
    card: [{ k: 'alt', label: 'altitude', unit: 'm', ph: 'auto' },
           { k: 'V', label: 'speed', unit: 'km/h', ph: 'auto' }],
    needs: ['testFlight'],
    start(api, cv, fp) {
      const num = s => { const v = parseFloat(s); return isFinite(v) && v > 0 ? v : null; };
      const V = num(cv && cv.V);
      return api.testFlight({ alt: num(cv && cv.alt), V: V ? V / 3.6 : null, fp });
    },
    // the verdict, from what the flight brought back (BENCH_FLIGHT_LOGGED)
    judge(f) {
      const rep = f.report || { verdicts: [], outcome: null, landing: null };
      const L = rep.landing || null, T = f.td || null;
      const eventful = (rep.verdicts || []).length > 0;
      const ok = !!f.arrived;
      return {
        verdict: ok ? (f.manual ? 'ARRIVED, BY HAND' : eventful ? 'FLEW THE CIRCUIT, WITH NOTES' : 'FLEW THE CIRCUIT')
                    : String(f.outcome || rep.outcome || 'no arrival').toUpperCase().replace(/-/g, ' '),
        ok,
        note: (L ? 'landing run ' + benchNum(L.run, 0) + ' m · touchdown '
                 + benchNum(L.sink, 2) + ' m/s · ' + benchNum(L.pastAim, 0) + ' m past the aim'
               : T ? 'touchdown ' + benchNum(T.sink, 2) + ' m/s at ' + benchNum(T.V * 3.6, 0) + ' km/h'
               : 'no landing')
          + (f.t ? ' · ' + benchNum(f.t / 60, 0) + ' min' : '')
          + (eventful ? ' · ' + rep.verdicts.map(v => v.code).join(', ') : ''),
        fix: ok ? ''
           : 'the phase it stopped in names the problem: a rejected take-off is '
           + 'power or field, a climb that never came is power against weight, '
           + 'a broken circuit is control authority.',
        fills: 'plaque',
        // G208: THE TRIM ADVISOR's measured reading — the elevator the pilot
        // held on the settled downwind (43_pilot.js report.trimDe)
        trim: (!f.manual && rep.trimDe != null && isFinite(rep.trimDe)) ? rep.trimDe : null,
      };
    },
  },
  {
    // THE CROSSWIND CARD (A9, the user: "the crosswind test should be
    // separate and offer better feedback"; "the last certification remains
    // stuck on crosswinds"). It was phase seven of the flight test: four to
    // seven departures with the bar pinned at 90-99 % and no verdict of its
    // own. Its own row now, ADVISORY like the density altitude (a crosswind
    // limit is a rating, not airworthiness), run on the bench's thread with
    // one line per rung as it lands, and a verdict that names the limit,
    // the rung that failed and why. The bar is the plaque's own (4 m/s,
    // plaque.js PLAQUE_BOUNDS); the fix line is the plaque's own WHY. The
    // ladder itself is 42_crosswind.js's, untouched.
    id: 'xwind',
    name: 'Crosswind',
    blurb: 'Departures in a rising crosswind, until the roll leaves the strip’s lines.',
    kind: 'live',
    offscreen: true,
    advisory: true,
    needs: ['xwindStart', 'xwindPoll', 'xwindEnd'],
    steps: ['2 m/s', '4 m/s', '6 m/s', '8 m/s', 'bisecting'],
    start(api) { api.xwindStart(); },
    poll(api) {
      const r = api.xwindPoll();
      if (!r) return { done: true, verdict: 'no ladder running', ok: false };
      const runs = r.runs || [];
      const rungLine = q => benchNum(q.w, 1) + ' m/s · ' + (q.ok ? 'airborne, roll ' + benchNum(q.roll, 1) + ' m'
                                                             : (q.why || 'failed') + (q.roll != null ? ', roll ' + benchNum(q.roll, 1) + ' m' : ''));
      if (!r.done) {
        const w = r.w || 0;
        return {
          done: false,
          running: (w > 0 ? 'departing in ' + benchNum(w, 1) + ' m/s across' : runs.length ? 'lining up for the next rung' : 'departing in calm air')
            + (r.t ? ' · t=' + benchNum(r.t, 0) + ' s' : ''),
          progress: r.frac || 0,
          step: runs.length >= 4 ? 4 : Math.min(3, Math.max(0, Math.round(w / 2) - 1)),
          live: { rungs: runs.map(rungLine), w, t: r.t },
        };
      }
      const X = r.result;
      if (!X) return { done: true, verdict: 'NOT MEASURED', ok: false, note: r.error || 'the ladder did not finish' };
      const lo = benchBound('crosswind limit');
      const lim = X.limit == null ? X.cap : X.limit;
      const ok = lim >= lo;
      const first = X.failW != null ? benchNum(X.failW, 1) + ' m/s: ' + (X.failWhy || 'failed') : null;
      return {
        done: true,
        verdict: (X.limit == null ? 'CROSSWIND LIMIT > ' + benchNum(X.cap, 0) : 'CROSSWIND LIMIT ' + benchNum(X.limit, 1)) + ' m/s',
        ok,
        note: runs.map(rungLine).join(' · '),
        why: ok ? '' : 'the limit is under the ' + lo + ' m/s bar' + (first ? ' — first failed at ' + first : ''),
        fix: ok ? '' : benchWhyFix('crosswind limit'),
        rungs: runs.map(rungLine),
        fills: 'plaque',
      };
    },
    stop(api) { api.xwindEnd(); },
  },
  {
    // THE HYDROPLANE TEST (S1, G451.1; the playtest: "hydroplane test +
    // guidance", "should the 172 lift off on stock floats?"). A row the bench
    // shows for a FLOAT build only (`when`): a second sim on the sea lane
    // under the test pilot's water technique, watched like the flight. The
    // verdict says WHY — the hump against the thrust, the step's air, the
    // trim, the floats against the weight (the advisor's reserve) — because
    // "it will not get off the water" without a reason is the bug report
    // this row exists to answer.
    id: 'hydro',
    name: 'Hydroplane',
    blurb: 'Full power from rest on the sea: the hump, the step, the lift-off — and why.',
    kind: 'live',
    offscreen: true,
    when: api => typeof api.hasFloats === 'function' && api.hasFloats(),
    steps: ['afloat', 'the plough', 'the hump', 'on the step', 'lift-off'],
    needs: ['hydroStart', 'hydroPoll', 'hydroEnd'],
    start(api) { api.hydroStart(); },
    poll(api) {
      const r = api.hydroPoll();
      if (!r) return { done: true, verdict: 'no run', ok: false };
      if (r.none) return { done: true, verdict: 'NO WATER TO RUN ON', ok: false, note: 'this world has no sea lane, or the build has no floats' };
      if (!r.done) return {
        done: false,
        running: r.phase + ' · ' + benchNum(r.V * 3.6, 0) + ' km/h · R/W ' + benchNum(r.R, 2) + ' · trim ' + benchNum(r.trim, 1) + '° · t=' + benchNum(r.t, 0) + ' s',
        progress: r.frac,
        step: ['afloat', 'the plough', 'the hump', 'on the step', 'lift-off'].indexOf(r.phase),
        live: r,
      };
      const A = r.adv, why = [], fix = [];
      const off = !!r.lift && !r.bad;
      if (r.bad) why.push('the simulation broke up on the water');
      if (A && A.reserve < 1.8) { why.push('the floats are UNDERSIZED: the pair displaces ' + benchNum(A.reserve, 2) + ' x the weight (1.8 needed)'); fix.push('a bigger float — the catalogue puts ' + benchNum(A.grossKg, 0) + ' kg on the ' + A.recommend); }
      if (!off && r.hump.R >= 0.8 * r.TW) { why.push('the hump costs R/W ' + benchNum(r.hump.R, 2) + ' at ' + benchNum(r.hump.V * 3.6, 0) + ' km/h against ' + benchNum(r.TW, 2) + ' of thrust — no margin to climb it'); fix.push('more thrust or less weight over the hump: a coarser propeller, a bigger engine, fuel off'); }
      if (!off && A && A.narrow) { why.push('the floats are NARROW for the weight (' + A.line.replace(/^.*NARROW: /, '') + ')'); fix.push('the catalogue' + String.fromCharCode(39) + 's row for ' + benchNum(A.grossKg, 0) + ' kg is the ' + A.recommend); }
      if (!off && r.ventMax < 0.5) { why.push('the step never ventilated (air ' + benchNum(r.airMax, 2) + '): the chine sits too deep'); fix.push('a wider or longer float, or less weight — the chine must ride within the step\'s height of the surface'); }
      if (!off && r.trimMax > 14) { why.push('the trim ran to ' + benchNum(r.trimMax, 0) + '° nose-up'); fix.push('the step further aft under the CG, or less back-stick'); }
      if (!off && !why.length) why.push('it reached ' + benchNum(r.Vmax * 3.6, 0) + ' km/h on the water and stayed there (' + String(r.phase).toLowerCase() + ')');
      return {
        done: true,
        verdict: off ? 'LIFTS OFF THE WATER' : r.bad ? 'BROKE UP' : (r.ventMax < 0.5 || r.hump.R >= 0.8 * r.TW) ? 'STUCK AT THE HUMP' : 'STAYED ON THE WATER',
        ok: off,
        note: 'hump R/W ' + benchNum(r.hump.R, 2) + ' at ' + benchNum(r.hump.V * 3.6, 0) + ' km/h · T/W ' + benchNum(r.TW, 2)
            + ' · step air ' + benchNum(r.ventMax, 2) + ' · trim ' + benchNum(r.trimMin, 0) + '…' + benchNum(r.trimMax, 0) + '°'
            + (off ? ' · off at ' + benchNum(r.lift.t, 0) + ' s, ' + benchNum(r.lift.dist, 0) + ' m, ' + benchNum(r.lift.V * 3.6, 0) + ' km/h' : '')
            + (A ? ' · floats ' + benchNum(A.reserve, 2) + ' x the ' + benchNum(A.grossKg, 0) + ' kg (' + A.verdict + ')' : ''),
        why: why.join('; '),
        fix: fix.join('; '),
      };
    },
    stop(api) { api.hydroEnd(); },
  },
];

const benchNum = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d);
// the plaque's own thresholds and fixes (plaque.js), so a card and a row
// can never disagree about a number
const benchBound = label => {
  try { const B = (typeof window !== 'undefined' && window.PLAQUE && window.PLAQUE.BOUNDS) || null;
        return (B && B[label] && B[label].lo != null) ? B[label].lo : 4; } catch (e) { return 4; }
};
const benchWhyFix = label => {
  try { const W = (typeof window !== 'undefined' && window.PLAQUE && window.PLAQUE.WHY) || null;
        return (W && W[label] && W[label].fix) || ''; } catch (e) { return ''; }
};
// THE TIP CAP (A9): the deflection past which the wing loading certificate
// is not awarded, in % of the semispan at the ultimate load. GATE FLEX's
// reality figures (tools/test_flex.js): real aeroplanes bend ~0.3-1 % at
// 1 g, 2-4 % at the 3.8 g limit; 8 % at 1 g is its 'folds in bending' bar.
// Fifteen at 5.7 g is generous to every honest structure and still refuses
// a wing bending a sixth of its span.
const LOAD_TIP_CAP = 15;
// the advisor's line for one measured lever (bench_worker.js): "lift struts
// (fixation): tip 4.1 %" — a control that exists, and the number it buys
const benchLeverLine = v => {
  if (!v) return '';
  const tip = (v.ultPct != null && isFinite(v.ultPct)) ? 'tip ' + benchNum(v.ultPct, 1) + ' %' : (v.verdict || '—');
  const y = (v.ultYield != null && isFinite(v.ultYield)) ? ' · ' + benchNum(v.ultYield, 0) + ' % of yield' : '';
  return v.label + ' (' + v.row + '): ' + (v.verdict === 'BROKE UP' ? 'BROKE UP' : tip + y);
};
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
  if (p.indexOf('CROSSWIND') === 0) return 3;    // the pilot's own crosswind leg is cruise
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
//
// THE SECOND SCHEME (A9, 2026-09-21, the user: "the certificates do not
// seem to be saved with the plane"; "liveries or paint colours should not
// lead to a re-certification"). They WERE saved — the plaque rides every
// save door — and lost at the next load, because the first scheme hashed
// the join's WHOLE export: since G377 that is every cage row (~700, the view
// toggles, the lights, the occupancy among them), the tanks' hue and tint,
// the panel's bezel. A panel row ADDED by any update (one landed between the
// playtest and this fix, `_viewLoops`) changed the hash of every saved
// aeroplane; a tank tint or "show loops" withdrew a live certificate. So:
//   DEVIATIONS  a cage row counts only when it differs from the default
//               aeroplane (`defaults`, the merged page defaults garage.js
//               seeds the design flow from) — a row a later version adds at
//               its default is not a change to this aeroplane;
//   LOOKS OUT   `energy.finish/hue/tint` (and per vessel), `systems.look`
//               weigh nothing (60_gen_spec.js "THE LOOK"); the cage's own
//               state and view rows (`_view*`, explodeD, the lights, who is
//               aboard, the reflector glow, the fastener density) are not
//               the aeroplane either — BENCH_LOOK and BENCH_STATE_ROWS;
//   CANONICAL   keys sorted before hashing, so the join's key order never
//               counts.
// PHYSICS_V stays the honesty handle (ruling (p) below): a certificate never
// loads valid over a plaque the physics moved. Without `defaults` (a
// core-only caller) every non-state cage row counts, as before.
// ---------------------------------------------------------------------------
const BENCH_COSMETIC = ['paint', 'finish', 'meta'];
const BENCH_LOOK = { energy: ['finish', 'hue', 'tint'], vessel: ['finish', 'hue', 'tint'],
                     systems: ['look'] };
const BENCH_STATE_ROWS = /^_view|^(explodeD|dumOn|cabOcc|paxOcc\d+|lightOn|li_reflect|li_beaconRpm|accDetail)$/;
function benchStripCosmetic(spec, defaults) {
  if (!spec || typeof spec !== 'object') return null;
  const c = JSON.parse(JSON.stringify(spec));
  for (const k of BENCH_COSMETIC) delete c[k];
  if (c.energy && typeof c.energy === 'object') {
    for (const k of BENCH_LOOK.energy) delete c.energy[k];
    if (Array.isArray(c.energy.vessels))
      for (const v of c.energy.vessels) if (v && typeof v === 'object')
        for (const k of BENCH_LOOK.vessel) delete v[k];
  }
  if (c.systems && typeof c.systems === 'object')
    for (const k of BENCH_LOOK.systems) delete c.systems[k];
  if (c.cage && typeof c.cage === 'object') {
    const D = (defaults && typeof defaults === 'object') ? defaults : null;
    const out = {};
    for (const k in c.cage) {
      if (BENCH_STATE_ROWS.test(k)) continue;
      const v = c.cage[k];
      if (D && (k in D) && benchSame(v, D[k])) continue;
      out[k] = v;
    }
    c.cage = out;
  }
  return c;
}
// a row equals its default: numbers to 1e-9 (a slider's value is a number a
// file may have printed), else by value
function benchSame(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  return benchCanon(a) === benchCanon(b);
}
// canonical JSON: the same object hashes the same whatever order its keys
// were written in
function benchCanon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(benchCanon).join(',') + ']';
  const ks = Object.keys(v).filter(k => v[k] !== undefined).sort();
  return '{' + ks.map(k => JSON.stringify(k) + ':' + benchCanon(v[k])).join(',') + '}';
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
// `f2` is the scheme above: a certificate hashed under the first scheme can
// never equal one hashed under this, so it loads withdrawn with its own
// reason (BENCH_RESTORE) instead of as a silent "the build changed".
const BENCH_FP_SCHEME = 'f2';
function benchVersionTag() {
  const sv = (typeof GEN_SPEC_V !== 'undefined') ? GEN_SPEC_V : 0;
  const pv = (typeof PHYSICS_V !== 'undefined') ? PHYSICS_V : 0;
  return BENCH_FP_SCHEME + '|v' + sv + '|p' + pv + '|';
}
function benchFingerprint(spec, defaults) {
  const c = benchStripCosmetic(spec, defaults);
  return c ? benchHash(benchVersionTag() + benchCanon(c)) : null;
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
    (t.needs || []).every(k => typeof api[k] === 'function') &&
    (!t.when || t.when(api));                         // S1 (G451.1): a row for this build only (the hydroplane test wants floats)
  // the row buttons are dead while a flight is out (the bench cannot run
  // two things, and the aeroplane is not on the stand)
  const busyNow = () => !!live || !!flown;
  const today = () => new Date().toISOString().slice(0, 10);

  // ---- the fingerprint of the aeroplane on the stand ----------------------
  // Off the join's export — the same spec the tests measure — with the
  // cosmetic blocks removed. Null when there is no join (core-only build, or
  // the editor not up yet), which every caller treats as "cannot say".
  // ...against THE DEFAULT AEROPLANE (A9): the merged page defaults garage.js
  // publishes (GARAGE_SPEC.cageDefaults), so only a row the builder moved
  // counts. Without them (an older garage.js) every row counts, as before.
  function fpNow() {
    try {
      const J = window.CAGE_JOIN;
      if (!J || typeof J.export !== 'function') return null;
      const G = window.GARAGE_SPEC;
      let D = null;
      try { D = (G && typeof G.cageDefaults === 'function') ? G.cageDefaults() : null; } catch (e) { D = null; }
      if (!D && window.CAGE_PAGE && window.CAGE_PAGE.defaults) D = window.CAGE_PAGE.defaults;
      return benchFingerprint(J.export(), D);
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
    if (busy || live || flown) return;
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
    if (live || flown) return;
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
      let changed = 0, unstamped = 0, old = 0;
      for (const id in results) {
        const r = results[id];
        if (!r || r.stale) continue;
        if (!r.fp) unstamped++;
        else if (r.fps !== BENCH_FP_SCHEME) old++;     // A9: the first scheme's hash
        else if (r.fp !== fp) changed++;
      }
      if (changed || unstamped || old) {
        const reason = changed ? 'the build or its physics changed since the certificate'
                     : old ? 'certified under the old fingerprint — run the tests once more'
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
    const wasPassed = passed();
    r.when = today();
    r.fp = fp;
    r.fps = BENCH_FP_SCHEME;      // which scheme hashed it (A9): the restore reads it
    results[t.id] = r;
    if (r.fills === 'plaque' && r.ok !== undefined) api.plaque(plaqueOn());
    if (!anyStale()) withdrawnNote = '';
    note(t, r);
    if (r.advise) startAdvice(t, r);
    persist();
    stickersChanged();
    render();
    // THE MASTER'S MOMENT (A9): the last gating certificate lands, the whole
    // certificate is held — the airworthiness card follows the test's own
    if (!wasPassed && passed()) award(t, r, () => awardMaster(after));
    else award(t, r, after);
  }
  // THE AIRWORTHINESS CERTIFICATE (A9, the user: "we need like a master
  // sticker"): one bigger roundel, the registration and the day, worn on
  // the rear fuselage (stickers.js STICKER_MASTER) for as long as every gating
  // certificate stands
  function awardMaster(after) {
    const U = ui();
    const done = () => {
      if (awardT) { clearTimeout(awardT); awardT = null; }
      if (U) { U.aw.hidden = true; U.aw.onclick = null; }
      if (after) after();
    };
    if (!U || !window.STICKERS || !window.STICKERS.MASTER) { done(); return; }
    const M = window.STICKERS.MASTER;
    const when = (window.STICKERS.masterDate && window.STICKERS.masterDate(window.BENCH_STATE())) || today();
    let reg = '';
    try { const sp = window.GARAGE_SPEC && window.GARAGE_SPEC.get(); reg = (sp && sp.meta && sp.meta.reg) || ''; } catch (e) {}
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    U.aw.className = 'master';
    U.aw.innerHTML =
      '<div class="bAk">airworthiness certificate</div>' +
      '<div class="bAn">' + esc(reg || 'this aeroplane') + '</div>' +
      '<canvas width="360" height="360"></canvas>' +
      '<div class="bAs">airworthy</div>' +
      '<div class="bAv">the bench check, the wing loading and the test flight are held</div>' +
      '<div class="bAd">' + esc(when) + ' · the master roundel is on the fuselage · click to close</div>';
    U.aw.hidden = false;
    U.aw.dataset.test = 'master';
    try {
      const g = U.aw.querySelector('canvas').getContext('2d');
      window.STICKERS.roundel(g, 180, 180, 172, { title: M.title, ring: M.ring, emblem: M.emblem, sub: reg, date: when });
    } catch (e) {}
    U.aw.onclick = done;
    awardT = setTimeout(done, 5000);
    awardCur = { r: null, done };
  }
  // THE ADVISOR (A9): a failed or warned wing loading asks the rig what the
  // wing page's levers would buy, and the answer lands line by line on the
  // award card and under the row — kept with the result, so a saved
  // aeroplane still carries what it was told.
  function startAdvice(t, r) {
    if (typeof api.loadAdvise !== 'function') return;
    r.advice = { lines: [], done: false, n: 0 };
    try {
      api.loadAdvise(job => {
        if (results[t.id] !== r) return;           // the result moved on
        r.advice = { lines: (job.results || []).map(benchLeverLine), done: !!job.done,
                     n: (job.variants || []).length };
        persist();
        render();
        awardAdvice(r);
      });
    } catch (e) { r.advice = { lines: [], done: true, n: 0 }; }
  }
  const adviceHtml = r => {
    const A = r.advice;
    if (!A) return '';
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const head = A.done ? (A.lines.length ? 'measured on this wing — what each lever buys:' : 'no lever to offer on this wing')
                        : 'measuring what would help… ' + A.lines.length + (A.n ? ' of ' + A.n : '');
    return '<div class="bAdvice' + (A.done ? ' done' : '') + '"><span>' + head + '</span>' +
           A.lines.map(l => '<div>' + esc(l) + '</div>').join('') + '</div>';
  };

  function runOne(t, after) {
    if (live || flown || !usable(t)) { if (after) after(); return; }
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
    if (t.kind === 'flown') {
      // THE HAND-OFF (A9): the bench arms the flight with the fingerprint it
      // just took and the game takes it from here — no freeze, no poll; the
      // result arrives through BENCH_FLIGHT_LOGGED when the aeroplane does.
      // A run-all queue ends here: nothing runs while the aeroplane is out.
      results[t.id] = { running: 'rolled out — the pilot is flying', ok: false };
      flown = { test: t, fp, after };
      render();
      let went = false;
      try { went = !!t.start(api, cardVals[t.id] || {}, fp); } catch (e) { went = false; }
      if (!went) { delete results[t.id]; flown = null; render(); if (after) after(); }
      return;
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
  // THE FLIGHT COMES BACK (A9). app.js's logFlight hands every logged
  // flight of the garage's build here: { report, arrived, outcome, t,
  // manual, landing, td, armed: { fp, when } | null }. An armed flight (the
  // bench's own) settles the row whatever it brought — an aeroplane that
  // could not fly comes back SAYING SO, a failed test with a reason. An
  // unarmed flight (you rolled out yourself) awards on an arrival and is
  // otherwise ignored: your crash is not a withdrawal, the fingerprint is.
  let flown = null;
  window.BENCH_FLIGHT_OFF = () => {
    if (!flown) return;
    const F = flown; flown = null;
    if (results.flight && results.flight.running) delete results.flight;
    render();
    if (F.after) F.after();
  };
  window.BENCH_FLIGHT_LOGGED = f => {
    const t = BENCH_TESTS.filter(x => x.id === 'flight')[0];
    if (!t || !f) return;
    const F = flown; flown = null;
    const fp = (f.armed && f.armed.fp) || (F && F.fp) || fpNow();
    if (!F && !f.armed && !f.arrived) return;
    if (results.flight && results.flight.running) delete results.flight;
    const r = t.judge(f);
    settle(t, r, fp, F ? F.after : null);
  };

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
    // each award card closes before the next test starts. A FLOWN row goes
    // last and ends the queue: the aeroplane is out of the shed after it.
    const queue = BENCH_TESTS.filter(t => usable(t) && t.kind !== 'flown')
      .concat(BENCH_TESTS.filter(t => usable(t) && t.kind === 'flown'));
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
    } else if (t.id === 'xwind') {
      U.liveEl.innerHTML = '<span>' + (r.running || '') + '</span>';
      const rungs = L.rungs || [];
      if (trace && rungs.length > (trace.notes || 0)) {
        for (let i = trace.notes || 0; i < rungs.length; i++) {
          const d = document.createElement('div');
          d.textContent = rungs[i];
          U.notes.appendChild(d);
        }
        trace.notes = rungs.length;
      }
    } else if (t.id === 'load') {
      U.liveEl.innerHTML =
        '<span>load <b>' + benchNum(L.g, 2) + '</b> g of ' + benchNum(L.nTarget, 1) + '</span>' +
        '<span>tip <b>' + benchNum(L.tipPct, 2) + '</b> % of semispan</span>' +
        '<span>' + (L.phase === 'settle' ? 'settling on the trestles'
                   : L.phase === 'hold' ? 'holding at ultimate' : 'bags going on') + '</span>' +
        (L.thread ? '<span class="dim">' + L.thread +
          (L.rate != null && isFinite(L.rate) && L.rate < 0.85 ? ' · ' + benchNum(L.rate, 1) + '× real time' : '') + '</span>' : '');
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
      const lim = (L && L.limit) || 3.8, ult = (L && L.ult) || 5.7;
      for (const [v, lab] of [[1, '1 g'], [lim, 'limit ' + lim + ' g'], [ult, 'ultimate ' + ult + ' g']]) {
        if (v > gT + 1e-6) continue;
        g.fillRect(X(v) - 1.5, y - 24, 3, 48);
        g.textAlign = v >= ult - 1e-6 ? 'right' : 'center';
        g.fillText(lab, X(v) + (v >= ult - 1e-6 ? 6 : 0), y + 54);
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
      (r.warn ? '<div class="bAw">' + esc(r.warn) + '</div>' : '') +
      adviceHtml(r) +
      '<div class="bAd">' + esc(r.when || today()) + (r.ok ? ' · the sticker is on the fuselage' : '') +
      ' · click to close</div>';
    U.aw.hidden = false;
    U.aw.dataset.test = t.id;
    if (r.ok && M && window.STICKERS && window.STICKERS.roundel) {
      try {
        const cv = U.aw.querySelector('canvas');
        const g = cv.getContext('2d');
        window.STICKERS.roundel(g, 150, 150, 142, { title: M.title, emblem: M.emblem, date: r.when || today() });
      } catch (e) {}
    }
    U.aw.onclick = done;
    // a card with the advisor on it waits for the measurements (awardAdvice
    // re-arms the close once they are in); a plain pass closes itself
    awardT = (r.advice && !r.advice.done) ? null : setTimeout(done, r.ok ? 2800 : 9000);
    awardCur = { r, done };
  }
  let awardCur = null;
  // the advisor's lines land on the open card; the close is armed when the
  // last one has
  function awardAdvice(r) {
    const U = ui();
    if (!U || U.aw.hidden || !awardCur || awardCur.r !== r) return;
    const old = U.aw.querySelector('.bAdvice');
    const html = adviceHtml(r);
    if (old) old.outerHTML = html;
    else { const d = U.aw.querySelector('.bAd'); if (d) d.insertAdjacentHTML('beforebegin', html); }
    if (r.advice && r.advice.done && !awardT) awardT = setTimeout(awardCur.done, r.ok ? 7000 : 12000);
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
      : flown ? '<b class="run">FLYING</b>'
      : anyRun()
      ? (passed() ? '<b class="cert">AIRWORTHY</b>'
                  : '<b class="bad">NOT PASSED</b>')
      : anyStale() ? '<b class="stale">WITHDRAWN</b>'
      : '<b class="dim">UNTESTED</b>';
    bits.push('<div class="bHead"><span>engineering bench</span>' + v +
      '<button id="bRunAll">run the tests</button>' +
      '<div class="bSeals">' +
      BENCH_TESTS.filter(usable).map(t => sealCanvas(t.id, awarded(t.id), 34)).join('') +
      '<em>' + (nCert ? nCert + ' of ' + BENCH_TESTS.filter(usable).length + ' certificates'
                        + (passed() ? ' · airworthy' : nGate && !passed() ? '' : '')
                      : withdrawnNote ? 'certificates withdrawn — ' + withdrawnNote
                      : 'no certificate yet') + '</em>' +
      '</div></div>');
    for (const t of BENCH_TESTS) {
      const r = results[t.id] || null;
      const can = usable(t);
      if (!can && t.when) continue;                   // S1 (G451.1): a build-conditional row is absent, not dim
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
        (r && r.rungs && r.rungs.length && !r.stale ? '<div class="bRungs">' + r.rungs.map(x => '<div>' + x + '</div>').join('') + '</div>'
          : r && r.note && !r.stale ? '<div class="bW">' + r.note + '</div>' : '') +
        (r && !r.ok && !r.stale && !r.running && (r.why || r.fix)
          ? '<div class="bWhy">' + (r.why ? r.why + ' — ' : '') + (r.fix || '') + '</div>' : '') +
        (r && r.warn && !r.stale && !r.running ? '<div class="bWarn">' + r.warn + '</div>' : '') +
        (r && !r.stale && !r.running ? adviceHtml(r) : '') +
        (adv ? '<div class="bAdv">' + adv + '</div>' : '') +
        '</div>');
    }
    rows.innerHTML = bits.join('');
    paintSeals();
    const all = $('bRunAll');
    if (all) { all.disabled = busyNow(); all.onclick = runAll; }
    changed();
    rows.querySelectorAll('button[data-t]').forEach(b => {
      b.disabled = busyNow();
      b.onclick = () => {
        const t = BENCH_TESTS.filter(x => x.id === b.dataset.t)[0];
        if (t) runOne(t);
      };
    });
    rows.querySelectorAll('input[data-card]').forEach(inp => {
      inp.disabled = busyNow();
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
  module.exports = { BENCH_TESTS, BENCH_COSMETIC, BENCH_LOOK, BENCH_STATE_ROWS, BENCH_FP_SCHEME,
                     benchStripCosmetic, benchCanon, benchSame, benchHash, LOAD_TIP_CAP, benchLeverLine,
                     benchFingerprint, benchFlightStep, benchTrimWords, benchNum };
