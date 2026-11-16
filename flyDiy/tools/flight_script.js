#!/usr/bin/env node
// flight_script.js - SCRIPTED FLIGHTS (PILOT, 15 Nov 2026). The user (via A0): "We will also need scripted runs for the
// performance round, and we probably need them now too. We could possibly cut testing time with the scripted flight(s)
// sequenced in steps and deep logging."
//
// ONE SCENARIO FORMAT, TWO RUNNERS:
//   node   the solver + THE PILOT (43_pilot.js) through the GAME'S OWN HOST (src/viewer/sim_host.js makeSimHost, as
//          _tour_lib.js gameHost builds it: the page's placement off the walked stand, the garage's shakedown, the game's
//          day ticked every step, the 'start' and 'leg' commands app.js posts) on Jolene with every solid thing near a strip
//          (_tour_lib tourWorld) - fast, for tests (GATE FLIGHTSCRIPT)
//   page   the game on the GPU through page_rig.js (LOOK-1) - frame times per step, for the perf round (to come, Thu)
//
// THE SCENARIO (JSON; the library in tools/flight_scripts/):
//   { "name": "home_circuit", "what": "...",
//     "plane": "list:50"  (a row of builds/lists/plane_lists.json) | "builds/x.json" (from flyDiy/),
//     "from": "HOME", "to": "HOME"   (the first leg's aerodromes: the start is the From's stand, the page's placement),
//     "day": "game" (the new player's day: 8 kt from 250, 16:00 midsummer) | "calm" | { a day spec },
//     "persona": "expert" | "club" | "student" | "bush" | "hamfist"   (43 PILOT_PROFILES; default expert),
//     "steps": [ { "name", "do", "until": {...}, "capS", "allow": [...] }, ... ] }
//   do      board        nothing flies: the aeroplane is checked (mass, fuel, no damage)
//           start        the first leg begins (the page's Go: 'start')
//           leg          a next leg { "to": id } from where the aeroplane stopped (the page's nextLeg: 'leg')
//           lift         { "by": m } the aeroplane raised (or lowered) in place, its speeds kept - the pilot finds itself that
//                        much higher where it was (DESCENT, 15 Nov: "high on final"; the in-game twin is the player handing
//                        the autopilot back high). Read the step after it, not this one
//           (absent)     nothing new: the step watches the flight go on
//   until   (all must hold, read every step; a step with no until passes at once)
//           phase        a phase or a list of phases (43's: TAXI, HOLD, LINEUP, ROLL, LIFTOFF, CLIMB, ENROUTE, DOWNWIND,
//                        BASE, FINAL, FLARE, ROLLOUT, STOPPED, ...)
//           agl          the CG at least this many metres over the ground
//           engine       true: every engine running
//           stoppedAt    an aerodrome id: STOPPED on its strip (38b_dest flightWhere, as the tour judges a landing)
//           declined     true: the pilot declined the take-off at the hold, its reason said (43 go / no-go)
//   capS    the step's time cap (sim seconds); past it the step FAILS with its WHY
// A STEP'S FLIGHT FIGURES ('step' line .fly): the least air speed and the most sink while airborne, the highest and lowest CG,
//   and at its first touch (airborne, then wheels down): the sink, the air speed and the pitch - a landing step's table row.
//   No prop strike is a pass condition of EVERY step (the faults below) unless the step allows it
// trees  (the scenario's, optional) [[x, z, r, h], ...]: standing canopy h metres tall within r of (x, z), added to the node
//   world's canopyH - the page's trees where the node world has none (the runway model's obstacle cone reads canopyH)
//   allow   faults this step tolerates: 'yield', 'prop-strike', 'dent', 'declined' (a break, a crash, NaN, ABORT: never)
// A FAILED STEP STOPS THE RUN (never run on blind): its WHY = the fault or the unmet conditions, the phase, the pilot's
// goal and conditions (ap.status), its last verdicts, the position and the speeds.
//
// THE DEEP LOG: one JSONL per run (--out <dir>, default D:/Dev/pilot_runs/flight_script): a 'run' line (the scenario,
// the build, the day, the git sha), a 'sample' line every second (the step, the phase, the pilot's goal, the position,
// AGL, ground and air speed, the vertical speed, pitch / bank / heading, throttle / brake / flaps, fuel), a 'say' line
// for each verdict the pilot speaks, a 'step' line per step (start / end, phases, the position and speeds at its end,
// the verdicts said in it, the solver's ms per step p50 / p99 / max, ok or the WHY) and an 'end' line.
//
// USAGE
//   node tools/flight_script.js home_circuit                 a library scenario (tools/flight_scripts/<name>.json)
//   node tools/flight_script.js path/to/scenario.json        any scenario file
//   node tools/flight_script.js --list                       the library
//   options: --out <dir> · --log <file.jsonl> · --quiet · --runner node (default; 'page' from Thu)
//   exit 0 = every step passed, 1 = a step failed (the WHY printed and logged), 2 = a bad scenario
// AS A MODULE: const FS = require('./flight_script.js'); const R = FS.runNode(scenario, { log: file, quiet: true });
//   R = { ok, steps: [...], failed: { step, why } | null, t, wall, log }
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const LIB = path.join(T, 'flight_scripts');
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const D2 = 180 / Math.PI;

// ---- the scenario -------------------------------------------------------------------------------------------------
function loadScenario(arg) {
  const f = /\.json$/i.test(arg) ? path.resolve(arg) : path.join(LIB, arg + '.json');
  const S = JSON.parse(fs.readFileSync(f, 'utf8'));
  S.file = f;
  return S;
}
const DO = new Set(['board', 'start', 'leg', 'lift']);
const UNTIL = new Set(['phase', 'agl', 'engine', 'stoppedAt', 'declined']);
const ALLOW = new Set(['yield', 'prop-strike', 'dent', 'declined']);
function checkScenario(S) {
  const bad = [];
  if (!S.plane) bad.push('no plane');
  if (!S.from) bad.push('no from');
  if (S.trees != null && !(Array.isArray(S.trees) && S.trees.every(q => Array.isArray(q) && q.length === 4 && q.every(Number.isFinite)))) bad.push('trees: a list of [x, z, r, h]');
  if (!Array.isArray(S.steps) || !S.steps.length) bad.push('no steps');
  (S.steps || []).forEach((st, i) => {
    const tag = 'step ' + (i + 1) + ' (' + (st.name || '?') + ')';
    if (!st.name) bad.push(tag + ': no name');
    if (st.do && !DO.has(st.do)) bad.push(tag + ': do "' + st.do + '" unknown');
    if (st.do === 'leg' && !st.to) bad.push(tag + ': a leg needs its to');
    if (st.do === 'lift' && !(typeof st.by === 'number' && isFinite(st.by))) bad.push(tag + ': a lift needs its by (metres)');
    for (const k of Object.keys(st.until || {})) if (!UNTIL.has(k)) bad.push(tag + ': until.' + k + ' unknown');
    for (const a of st.allow || []) if (!ALLOW.has(a)) bad.push(tag + ': allow "' + a + '" unknown');
    if (st.until && !(st.capS > 0)) bad.push(tag + ': a step that waits needs its capS');
  });
  return bad;
}
// a plane: 'list:N' (the plane lists' row N) or a build file (from flyDiy/)
function planeOf(p) {
  const m = /^list:(\d+)$/.exec(String(p));
  if (m) {
    const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'lists', 'plane_lists.json'), 'utf8'));
    const row = L.planes.find(r => r.n === +m[1]);
    if (!row || !row.file) throw new Error('plane ' + p + ': no such row with a file in builds/lists/plane_lists.json');
    return { key: path.join(ROOT, row.file), name: row.name + (row.reg ? ' (' + row.reg + ')' : '') + ' [' + p + ']', file: row.file };
  }
  return { key: path.resolve(ROOT, p), name: path.basename(p), file: p };
}
function gitSha() {
  try { return require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch (e) { return null; }
}
const pct = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// ---- the node runner ----------------------------------------------------------------------------------------------
function runNode(S, opt) {
  const o = opt || {};
  const bad = checkScenario(S);
  if (bad.length) throw new Error('bad scenario ' + (S.name || '') + ': ' + bad.join('; '));
  const C = require(path.join(T, 'flight_core.js'));
  const IN = require(path.join(T, 'island_node.js'));
  const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
  const TR = require(path.join(T, '_tour_lib.js'));
  const say = o.quiet ? () => {} : (s => console.log(s));
  const out = o.log || path.join(o.out || 'D:/Dev/pilot_runs/flight_script', (S.name || 'scenario') + '_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.jsonl');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const fd = fs.openSync(out, 'w');
  const J = obj => fs.writeSync(fd, JSON.stringify(obj) + '\n');
  const wall0 = Date.now();
  const P = planeOf(S.plane);
  const def = TR.defOf(C, PT, P.key);
  const TW = TR.tourWorld(C, IN, fs);
  const W = TW.W;
  // the scenario's standing trees (the page's canopy the node world lacks): on top of the world's own canopyH
  if (Array.isArray(S.trees) && S.trees.length) {
    const can0 = typeof W.canopyH === 'function' ? W.canopyH.bind(W) : null;
    W.canopyH = (x, z, r) => { let h = can0 ? can0(x, z, r) : 0; for (const q of S.trees) if (Math.hypot(x - q[0], z - q[1]) <= q[2] + (r || 0)) h = Math.max(h, q[3]); return h; };
  }
  const A = id => { const a = W.aerodromes.find(q => q.id === id); if (!a) throw new Error('no aerodrome ' + id + ' on Jolene'); return a; };
  const from = A(S.from), to = A(S.to || S.from);
  const day = S.day === 'calm' ? null : (S.day && typeof S.day === 'object' ? S.day : undefined);   // undefined = the game's
  const H = TR.gameHost(C, W, def, from, to, { day, profile: S.persona || undefined });
  const sim = H.sim;
  J({ type: 'run', scenario: S.name, what: S.what || null, file: path.relative(ROOT, S.file || '').replace(/\\/g, '/'), runner: 'node',
      plane: P.name, build: P.file, from: S.from, to: S.to || S.from, persona: S.persona || 'expert', game: H.game, sha: gitSha(),
      world: { obstacles: TW.obstacles, trunks: TW.trunks }, at: new Date().toISOString() });
  say('flight_script (node): ' + S.name + ' - ' + P.name + ', ' + S.from + ' > ' + (S.to || S.from) + ', ' + (S.persona || 'expert') +
      ', day ' + (day === null ? 'calm' : day ? 'given' : 'the game\'s') + ' | log ' + out);

  const dt = 1 / 60, EVERY = Math.max(dt, +(opt.every || 1));   // --every S: the samples' period (1 s; 0.1 to read a flare)
  let t = 0, vSaid = 0, failed = null, curFrom = S.from;
  const D0 = sim.damage ? JSON.parse(JSON.stringify(sim.damage())) : { yields: 0, breaks: 0 };
  // the state every condition and sample reads
  const state = () => {
    const ap = H.ap, cg = sim.cgPos(), v = sim.cgVel(), out = sim.out || {};
    const gh = W.terrainH(cg[0], cg[2]), wh = typeof W.waterH === 'function' ? W.waterH(cg[0], cg[2]) : -Infinity;
    const ax = sim.axes(), xA = ax[0], nl = Math.hypot(xA[0], xA[2]) || 1e-9;
    const Va = Math.hypot(v[0] - (out.windX || 0), v[1] - (out.windY || 0), v[2] - (out.windZ || 0));
    return { ap, ph: ap.phase, cg, v, agl: cg[1] - Math.max(gh, wh), Vg: Math.hypot(v[0], v[2]), Va, vs: v[1],
             pitch: (out.pitch || 0) * D2, bank: Math.atan2(ax[2][1], ax[1][1]) * D2, hdg: ((Math.atan2(-xA[2] / nl, -xA[0] / nl) * D2) + 360) % 360,
             onG: sim.wheelsOnGround ? sim.wheelsOnGround() : null };
  };
  const engOK = () => !sim.eng || !sim.eng.length || sim.eng.every(e => e && e.running !== false);
  const whereId = (x, z) => { const w = typeof C.flightWhere === 'function' ? C.flightWhere(W, x, z) : null; return w && w.aero ? w.aero.id : null; };
  const declinedSaid = ap => ap.report && ap.report.outcome === 'declined' ? ((ap.report.verdicts || []).find(v => v.code === 'takeoff-declined') || {}).note || 'declined (no reason said)' : null;
  // the conditions a step waits for: [ok, the unmet ones said]
  const until = (U, s) => {
    const miss = [];
    if (U.phase != null) { const L = [].concat(U.phase); if (!L.includes(s.ph)) miss.push('phase ' + s.ph + ', wants ' + L.join('|')); }
    if (U.agl != null && !(s.agl >= U.agl)) miss.push('AGL ' + r1(s.agl) + ' m, wants >= ' + U.agl);
    if (U.engine && !engOK()) miss.push('an engine not running');
    if (U.stoppedAt != null) {
      const at = s.ph === 'STOPPED' ? whereId(s.cg[0], s.cg[2]) : null;
      if (s.ph !== 'STOPPED' || at !== U.stoppedAt) miss.push(s.ph !== 'STOPPED' ? 'not STOPPED (' + s.ph + ')' : 'stopped on ' + (at || 'no strip') + ', wants ' + U.stoppedAt);
    }
    if (U.declined && !declinedSaid(s.ap)) miss.push('no take-off declined');
    return miss;
  };
  // the faults that end a step whatever it waits for (unless allowed)
  const faultOf = (st, s) => {
    const al = new Set(st.allow || []);
    if (!isFinite(s.cg[0]) || !isFinite(s.cg[1])) return 'the solver went NaN';
    const Dm = sim.damage ? sim.damage() : null;
    if (Dm && (Dm.over || Dm.crashed)) return 'the damage ended the flight: ' + (Dm.reason || 'crashed');
    if (Dm && Dm.breaks > (D0.breaks || 0)) return (Dm.breaks - (D0.breaks || 0)) + ' member(s) broke';
    if (Dm && Dm.yields > (D0.yields || 0) && !al.has('yield')) return (Dm.yields - (D0.yields || 0)) + ' member(s) yielded' + (Dm.firstYield ? ' (first: ' + JSON.stringify(Dm.firstYield) + ')' : '');
    if (Dm && Dm.propStrike && !D0.propStrike && !al.has('prop-strike')) return 'the propeller struck' + (Dm.propAt ? ' (' + Dm.propAt.what + ', t ' + r1(Dm.propAt.t) + ')' : '');
    if (Dm && Dm.dented && !D0.dented && !al.has('dent')) return 'the airframe dented';
    if (s.ph === 'ABORT') return 'the take-off was rejected (ABORT)';
    const dec = declinedSaid(s.ap);
    if (dec && !al.has('declined') && !(st.until && st.until.declined)) return 'the take-off was declined: ' + dec;
    return null;
  };
  const why = (st, s, what) => ({
    what, phase: s.ph, goal: s.ap.status ? s.ap.status.goal : null,
    conds: s.ap.status ? (s.ap.status.conds || []).filter(c => !c.ok).map(c => c.what + ' ' + c.have + (c.unit || '') + ' (wants ' + c.want + ')') : [],
    said: ((s.ap.report && s.ap.report.verdicts) || []).slice(-3).map(v => v.code + '@' + v.t + (v.note ? ': ' + String(v.note).slice(0, 200) : '')),
    pos: [r1(s.cg[0]), r1(s.cg[1]), r1(s.cg[2])], agl: r1(s.agl), Vg: r1(s.Vg), Va: r1(s.Va), vs: r1(s.vs), where: whereId(s.cg[0], s.cg[2]),
  });
  const sample = (si, s) => {
    const c = sim.ctl || {};
    J({ type: 'sample', t: r1(t), step: si, ph: s.ph, goal: s.ap.status ? s.ap.status.goal : null,
        x: r1(s.cg[0]), y: r1(s.cg[1]), z: r1(s.cg[2]), agl: r1(s.agl), Vg: r1(s.Vg), Va: r1(s.Va), vs: r1(s.vs),
        pitch: r1(s.pitch), bank: r1(s.bank), hdg: r1(s.hdg), onG: s.onG, thr: r2(c.thr || 0), brake: r2(c.brake || 0), flap: r2(c.flap || 0),
        de: r2(c.de || 0), da: r2(c.da || 0), dr: r2(c.dr || 0), beta: r1(((sim.out && sim.out.beta) || 0) * D2), slip: s.ap.slip ? [r2(s.ap.slip.k), s.ap.slip.sg, r2(s.ap.slip.dr)] : null,
        fuel: sim.fuel ? r1(sim.fuel.litres) : null,
        // (the ground under the CG - world.surface's code - the soft layer's sink when one is met (SNOW-MUD out.softZ), the shaft rpm)
        surf: typeof W.surface === 'function' ? W.surface(s.cg[0], s.cg[2]) : null, softZ: (sim.out && sim.out.softZ != null) ? r2(sim.out.softZ) : null,
        rpm: sim.out && sim.out.rpm && sim.out.rpm.length ? Math.round(sim.out.rpm[0]) : null });
  };
  // the verdicts the pilot speaks, as they come (a new pilot per leg: its report restarts)
  let apSeen = null;
  const hear = (si, s) => {
    if (s.ap !== apSeen) { apSeen = s.ap; vSaid = 0; }
    const V = (s.ap.report && s.ap.report.verdicts) || [];
    for (; vSaid < V.length; vSaid++) J({ type: 'say', t: r1(t), step: si, code: V[vSaid].code, note: V[vSaid].note || null, apT: V[vSaid].t });
  };

  const results = [];
  for (let si = 0; si < S.steps.length && !failed; si++) {
    const st = S.steps[si], t0 = t, phases = [], said = [], ms = [];
    const vFrom = (H.ap.report && H.ap.report.verdicts || []).length;
    let s = state();
    // the step's action
    if (st.do === 'board') {
      const Dm = sim.damage ? sim.damage() : null;
      const m = [];
      if (!(sim.totalM > 0)) m.push('no mass');
      if (sim.fuel && !(sim.fuel.litres > 0)) m.push('no fuel');
      if (Dm && (Dm.breaks || Dm.crashed)) m.push('damaged before the flight');
      if (m.length) failed = { step: si, name: st.name, why: why(st, s, 'not ready to board: ' + m.join(', ')) };
    } else if (st.do === 'start') H.queueCmd({ cmd: 'start' });
    else if (st.do === 'lift') {
      for (let i = 0; i < sim.n; i++) sim.p[i * 3 + 1] += st.by;   // (sim_host simHostPlace's own move: every node, the speeds kept)
      s = state();
    } else if (st.do === 'leg') {
      const here = whereId(s.cg[0], s.cg[2]) || curFrom;
      H.queueCmd({ cmd: 'leg', from: here, to: st.to });
      curFrom = here;
    }
    // the wait
    let miss = st.until ? until(st.until, s) : [];
    const fly = { iasMin: null, sinkMax: null, hMax: null, hMin: null, touch: null };
    let wasAir = !s.onG;
    const cap = st.capS || 0;
    while (!failed && miss.length) {
      if (t - t0 >= cap) { failed = { step: si, name: st.name, why: why(st, s, 'the cap: ' + cap + ' s passed with ' + miss.join('; ')) }; break; }
      const h0 = process.hrtime.bigint();
      H.step();
      ms.push(Number(process.hrtime.bigint() - h0) / 1e6);
      t += dt;
      s = state();
      if (phases[phases.length - 1] !== s.ph) phases.push(s.ph);
      if (!s.onG) {
        if (s.agl > 3) { fly.iasMin = fly.iasMin == null ? s.Va : Math.min(fly.iasMin, s.Va); fly.sinkMax = fly.sinkMax == null ? s.vs : Math.min(fly.sinkMax, s.vs); }
        fly.hMax = fly.hMax == null ? s.cg[1] : Math.max(fly.hMax, s.cg[1]); fly.hMin = fly.hMin == null ? s.cg[1] : Math.min(fly.hMin, s.cg[1]);
        wasAir = true;
      } else if (wasAir && !fly.touch) { fly.touch = { t: r1(t), sink: r2(s.vs), Va: r1(s.Va), pitch: r1(s.pitch), ph: s.ph }; wasAir = false; }
      else wasAir = false;
      hear(si, s);
      if (Math.floor(t / EVERY) !== Math.floor((t - dt) / EVERY)) sample(si, s);
      const f = faultOf(st, s);
      if (f) { failed = { step: si, name: st.name, why: why(st, s, f) }; break; }
      miss = until(st.until, s);
    }
    if (!failed) { hear(si, s); const f = faultOf(st, s); if (f && st.until) failed = { step: si, name: st.name, why: why(st, s, f) }; }
    for (const v of ((H.ap.report && H.ap.report.verdicts) || []).slice(vFrom)) said.push(v.code);
    const ok = !failed;
    const rec = { type: 'step', i: si, name: st.name, do: st.do || null, ok, t0: r1(t0), t1: r1(t), dur: r1(t - t0), phases,
                  end: { ph: s.ph, pos: [r1(s.cg[0]), r1(s.cg[1]), r1(s.cg[2])], agl: r1(s.agl), Vg: r1(s.Vg), Va: r1(s.Va), where: whereId(s.cg[0], s.cg[2]),
                         fuel: sim.fuel ? r1(sim.fuel.litres) : null },
                  fly: { iasMin: fly.iasMin == null ? null : r1(fly.iasMin), sinkMax: fly.sinkMax == null ? null : r1(fly.sinkMax),
                         hMax: fly.hMax == null ? null : r1(fly.hMax), hMin: fly.hMin == null ? null : r1(fly.hMin), touch: fly.touch },
                  said, solverMs: ms.length ? { n: ms.length, p50: r2(pct(ms, 0.5)), p99: r2(pct(ms, 0.99)), max: r2(Math.max(...ms)) } : null,
                  why: failed ? failed.why : null };
    J(rec); results.push(rec);
    say('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + String(si + 1).padStart(2) + ' ' + st.name.padEnd(26) + ' t ' + r1(t0) + ' > ' + r1(t) + ' s' +
        (phases.length ? '  ' + phases.join('>') : '') + (said.length ? '  [' + said.join(', ') + ']' : ''));
    if (failed) {
      const w = failed.why;
      say('       WHY: ' + w.what);
      say('       phase ' + w.phase + (w.goal ? ', the pilot: ' + w.goal : '') + (w.conds.length ? ' (' + w.conds.join('; ') + ')' : ''));
      say('       at ' + w.pos.join(', ') + (w.where ? ' (' + w.where + ')' : '') + ', AGL ' + w.agl + ' m, ground ' + w.Vg + ' m/s, air ' + w.Va + ' m/s, vs ' + w.vs + ' m/s');
      for (const v of w.said) say('       said ' + v);
    }
  }
  const wall = Date.now() - wall0;
  const R = { ok: !failed, steps: results, failed, t: r1(t), wall, log: out };
  J({ type: 'end', ok: R.ok, passed: results.filter(r => r.ok).length, of: S.steps.length, t: R.t, wallMs: wall, failed: failed ? { step: failed.step, name: failed.name, what: failed.why.what } : null });
  fs.closeSync(fd);
  say((R.ok ? 'PASS' : 'FAIL') + ' ' + S.name + ': ' + results.filter(r => r.ok).length + ' of ' + S.steps.length + ' steps, ' + R.t + ' s flown, ' + (wall / 1000).toFixed(0) + ' s wall');
  return R;
}

module.exports = { loadScenario, checkScenario, planeOf, runNode, LIB };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  if (argv.includes('--list') || !argv.length) {
    console.log('usage: node tools/flight_script.js <name | scenario.json> [--out dir] [--log file.jsonl] [--quiet] [--runner node]\nthe library (tools/flight_scripts/):');
    for (const f of fs.readdirSync(LIB).filter(f => f.endsWith('.json')).sort()) {
      const S = JSON.parse(fs.readFileSync(path.join(LIB, f), 'utf8'));
      console.log('  ' + f.replace(/\.json$/, '').padEnd(16) + ' ' + S.plane.padEnd(8) + ' ' + (S.what || ''));
    }
    process.exit(argv.length ? 0 : 2);
  }
  const runner = opt('runner', 'node');
  if (runner !== 'node') { console.error('the ' + runner + ' runner is not built yet (the page runner: Thu 19 Nov)'); process.exit(2); }
  let S;
  try { S = loadScenario(argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--log' && argv[argv.indexOf(a) - 1] !== '--runner')); }
  catch (e) { console.error('flight_script: ' + e.message); process.exit(2); }
  const bad = checkScenario(S);
  if (bad.length) { console.error('flight_script: bad scenario ' + S.name + ':\n  ' + bad.join('\n  ')); process.exit(2); }
  const R = runNode(S, { out: opt('out', undefined), log: opt('log', undefined), quiet: argv.includes('--quiet'), every: opt('every', undefined) });
  process.exit(R.ok ? 0 : 1);
}
