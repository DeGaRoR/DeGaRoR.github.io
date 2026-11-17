#!/usr/bin/env node
// GATE FLIGHTSCRIPT (PILOT, 15 Nov 2026; the user via A0: "scripted runs for the performance round ... the scripted
// flight(s) sequenced in steps and deep logging"): tools/flight_script.js's node runner.
//   1  THE LIBRARY: every scenario in tools/flight_scripts/ is well formed (checkScenario) and its plane resolves (a list
//      row with a file, the file there)
//   2  A BAD SCENARIO IS REFUSED: an unknown condition, a waiting step without its cap, a leg without its To, a lift without
//      its metres, trees not [x, z, r, h]
//   3  A FAILED STEP STOPS THE RUN, SAID: home_circuit with its taxi capped at 5 s fails THAT step with the cap's WHY
//      (the phase, the pilot's goal, the position), no later step runs, the log's end line says so
//   4  THE HOME CIRCUIT FLIES: the Cessna 172 F-HCSN (list:50) off HOME's stand on the game's day - every step passes
//      (board, start-up, taxi to the hold, take-off, climb to 150 m, the circuit to the final, stopped on HOME)
//   5  THE DEEP LOG: every line of its JSONL parses; one 'run' line first, one 'end' line last (ok), a 'step' line per
//      step with its solver ms, a 'sample' line a second (the flight's seconds, +-2); the landing step's flight figures (DESCENT,
//      15 Nov: the table's row) - its least air speed, its most sink, its touch with the sink, the air speed and the pitch
// Usage: node tools/_flightscript_check.js   (exit 0 and 'GATE FLIGHTSCRIPT: PASS', or the failed checks)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const FS = require(path.join(__dirname, 'flight_script.js'));
const fails = [];
const check = (ok, what, detail) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what + (detail ? '  (' + detail + ')' : '')); if (!ok) fails.push(what); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flightscript-'));
const readLog = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return { bad: l.slice(0, 80) }; } });
try {
  // 1 the library
  const names = fs.readdirSync(FS.LIB).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.replace(/\.json$/, ''));   // (index.json: the list Game's in-game Benchmark button reads, not a scenario; the perf scenarios are in perf/)
  check(names.includes('home_circuit') && names.length >= 5, '1 the library holds the home circuit and the standard flights', names.join(', '));
  for (const n of names) {
    const S = FS.loadScenario(n), bad = FS.checkScenario(S);
    let P = null, pe = null;
    try { P = FS.planeOf(S.plane); } catch (e) { pe = e.message; }
    check(!bad.length && P && fs.existsSync(P.key), '1 ' + n + ': well formed, its plane ' + S.plane + ' there', bad.join('; ') || pe || P.file);
  }
  // 2 refused
  const H = FS.loadScenario('home_circuit');
  const B = JSON.parse(JSON.stringify(H));
  B.steps[2].until = { phse: 'HOLD' }; B.steps[3].capS = 0; B.steps.push({ name: 'a leg nowhere', do: 'leg' }); B.steps.push({ name: 'a lift of nothing', do: 'lift' }); B.trees = [[1, 2, 3]];
  const bad = FS.checkScenario(B);
  check(bad.some(b => /until\.phse unknown/.test(b)) && bad.some(b => /needs its capS/.test(b)) && bad.some(b => /needs its to/.test(b)) && bad.some(b => /lift needs its by/.test(b)) && bad.some(b => /^trees:/.test(b)),
        '2 a bad scenario is refused, each fault said', bad.join('; '));
  // 3 a failed step stops the run
  const N = JSON.parse(JSON.stringify(H)); N.name = 'home_circuit_capped'; N.file = H.file;
  N.steps.find(s => /taxi/.test(s.name)).capS = 5;
  const lN = path.join(tmp, 'neg.jsonl');
  const RN = FS.runNode(N, { log: lN, quiet: true });
  const LN = readLog(lN), stN = LN.filter(r => r.type === 'step'), endN = LN[LN.length - 1];
  const fN = stN[stN.length - 1];
  check(!RN.ok && RN.failed && /taxi/.test(RN.failed.name) && /the cap: 5 s/.test(RN.failed.why.what) && RN.failed.why.phase && RN.failed.why.pos.length === 3,
        '3 the capped taxi fails its own step with the WHY', RN.failed ? RN.failed.name + ': ' + RN.failed.why.what + ' | phase ' + RN.failed.why.phase + ', ' + (RN.failed.why.goal || '-') : 'it passed');
  check(stN.length === 3 && fN && !fN.ok && fN.why && endN.type === 'end' && endN.ok === false && endN.failed && endN.failed.step === 2,
        '3 no step after it ran, the log ends on it', stN.length + ' step lines, end ' + JSON.stringify(endN.failed || null));
  // 4 the home circuit
  const lH = path.join(tmp, 'home.jsonl');
  const RH = FS.runNode(H, { log: lH, quiet: true });
  for (const r of RH.steps) check(r.ok, '4 ' + r.name, 't ' + r.t0 + ' > ' + r.t1 + ' s ' + r.phases.join('>') + (r.why ? ' | ' + r.why.what : ''));
  check(RH.ok && RH.steps.length === H.steps.length, '4 the home circuit flew every step, stopped on HOME', RH.t + ' s flown, ' + (RH.wall / 1000).toFixed(0) + ' s wall' + (RH.failed ? ' | failed ' + RH.failed.name + ': ' + RH.failed.why.what : ''));
  // 5 the deep log
  const LH = readLog(lH);
  const badL = LH.filter(r => r.bad), st = LH.filter(r => r.type === 'step'), sm = LH.filter(r => r.type === 'sample');
  check(!badL.length && LH[0].type === 'run' && LH[LH.length - 1].type === 'end' && LH[LH.length - 1].ok === true,
        '5 the JSONL parses, a run line first, an ok end line last', LH.length + ' lines' + (badL.length ? ', unparsed: ' + badL[0].bad : ''));
  check(st.length === H.steps.length && st.every(r => r.dur === 0 || (r.solverMs && r.solverMs.p50 > 0 && r.solverMs.p99 >= r.solverMs.p50)),
        '5 a step line per step, each flown one with its solver ms', st.map(r => r.name + (r.solverMs ? ' p50 ' + r.solverMs.p50 + '/p99 ' + r.solverMs.p99 : '')).join('; '));
  const ldg = st[st.length - 1], lf = ldg && ldg.fly, tc = lf && lf.touch;
  check(!!(lf && lf.iasMin > 5 && lf.sinkMax < 0 && tc && tc.sink <= 0 && tc.sink > -3 && tc.Va > 5 && isFinite(tc.pitch)),
        '5 the landing step flight figures: least air speed, most sink, the touch', JSON.stringify(lf || null));
  check(Math.abs(sm.length - Math.floor(RH.t)) <= 2 && sm.every(r => r.ph && isFinite(r.agl) && isFinite(r.Vg)),
        '5 a sample a second, each with its phase, height and speed', sm.length + ' samples for ' + RH.t + ' s');
} catch (e) {
  check(false, 'the check ran to its end', e.stack.split('\n').slice(0, 3).join(' | '));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails.length ? 'FAILED CHECKS: ' + fails.join(' | ') : 'every check passed');
console.log('GATE FLIGHTSCRIPT: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
