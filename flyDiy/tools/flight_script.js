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
//   page   the game on the GPU through page_rig.js (LOOK-1) - frame times per step, for the perf round (runPage, 17 Nov; any From via the start chooser)
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
//   options: --out <dir> · --log <file.jsonl> · --quiet · --runner node (default) | page (the GPU, in A0's slot: --cap S --size WxH --repo <a tree to serve>
//            --headed (a visible Chrome) --live (page_rig's native flight wait) --q "k=v&..." (the page's query) --boot S (seconds allowed for the load))
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
const DO = new Set(['board', 'start', 'leg', 'lift', 'skip', 'camera', 'weather', 'time', 'dest', 'minimap', 'load', 'shed', 'rollout', 'wait']);
const PAGE_ONLY = new Set(['skip', 'camera', 'weather', 'time', 'dest', 'minimap', 'load', 'shed', 'rollout']);   // (PERF-TRACE-FORMAT.md: the node runner says it skips them)
const UNTIL = new Set(['phase', 'agl', 'engine', 'stoppedAt', 'declined', 's']);
const ALLOW = new Set(['yield', 'prop-strike', 'dent', 'declined', 'crash']);   // ('crash': the benchmark's CRASHES - the crash is the segment)
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
  let t = 0, vSaid = 0, failed = null, curFrom = S.from, stepT0 = 0;
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
    if (U.s != null && !(t - stepT0 >= U.s)) miss.push((t - stepT0).toFixed(1) + ' s of ' + U.s);
    return miss;
  };
  // the faults that end a step whatever it waits for (unless allowed)
  const faultOf = (st, s) => {
    const al = new Set(st.allow || []);
    if (!isFinite(s.cg[0]) || !isFinite(s.cg[1])) return 'the solver went NaN';
    const Dm = sim.damage ? sim.damage() : null;
    if (Dm && (Dm.over || Dm.crashed) && !al.has('crash')) return 'the damage ended the flight: ' + (Dm.reason || 'crashed');
    if (Dm && (Dm.over || Dm.crashed)) return null;   // (an allowed crash: nothing after it is a fault)
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
    stepT0 = t;
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
    } else if (PAGE_ONLY.has(st.do)) say('  (node: "' + st.do + '" is a page step - skipped)');
    else if (st.do === 'start') H.queueCmd({ cmd: 'start' });
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

// ---- the page runner (FLIGHT-SCRIPT page, Pilot 17 Nov; RIG-PROCEDURE.md + page_rig.js, in A0's GPU slot) -----------------
// THE SAME SCENARIO IN THE GAME ON THE GPU, a player's way: the plane is the garage's working build (its card file seeded as
// flydiy.wip before the first load - LOGGED, RIG-PROCEDURE 2), the conditions / the To / the persona set on the brief's own
// writers (#selCond, #selDest, #selPersona: one element per decision), 'start' is Go until flying (page_rig fly), 'leg' is the
// brief's To then the page's own Fly on (FLIGHT_PROBE.nextLeg), 'lift' is FLIGHT_PROBE.place({ by }). The conditions and the
// faults are read off the page every ~0.25 s of wall clock (the sim runs at the game's pace); each step adds the FRAME TIMES
// (an in-page rAF sampler: n, p50, p99, max, the frames over 50 ms) - the perf round's per-step numbers. v1: the From is
// the garage's field (HOME on Jolene); a scenario from elsewhere is refused, said. The log is the node runner's JSONL
// (runner 'page'), with 'frames' on every step line
async function runPage(S, opt) {
  const o = opt || {};
  const bad = checkScenario(S);
  if (bad.length) throw new Error('bad scenario ' + (S.name || '') + ': ' + bad.join('; '));
  // (a From other than HOME starts through the game's own start chooser - the sandbox's Fly from X, window.FLYDIY_START.go)
  const say = o.quiet ? () => {} : (s => console.log(s));
  const out = o.log || path.join(o.out || 'D:/Dev/pilot_runs/flight_script', (S.name || 'scenario') + '_page_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.jsonl');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const fd = fs.openSync(out, 'w');
  const J = obj => fs.writeSync(fd, JSON.stringify(obj) + '\n');
  const P = planeOf(S.plane);
  let card = (o.seed && o.seed['flydiy.wip']) || fs.readFileSync(P.key, 'utf8');
  if(o.planeName){P.name=o.planeName;P.file='private saved fixture (not exported)';}
  // LOAD (PERF-TRACE-FORMAT: pax + cargo): a 'load' step BEFORE the start loads the seeded card as the contracts load it (ALTIPORT 5's
  // way: the seats filled, the baggage); a load later in the journey is refused, said (v1)
  const iStart = S.steps.findIndex(x => x.do === 'start'), loads = S.steps.filter((x, i) => x.do === 'load' && (iStart < 0 || i < iStart));
  if (loads.length) { const L = loads[loads.length - 1], j = JSON.parse(card), sp = j.spec || j, occ = ((sp.cabin && sp.cabin.occupied) || [1, 1]).length;
    const PR0 = { light: [0, 0], typical: [1, 20], mtow: [Math.max(0, occ - 1), 60] }[L.preset] || [L.pax || 0, L.cargoKg || 0];
    const pax = Math.min(PR0[0], Math.max(0, occ - 1)); sp.cabin = Object.assign({}, sp.cabin, { pax, occupied: Array.from({ length: occ }, (_, i) => i <= pax ? 1 : 0), baggage: PR0[1] });
    sp.cage = Object.assign({}, sp.cage, { cabOcc: pax > 0 ? 1 : (sp.cage && sp.cage.cabOcc) || 0 }); for (let k = 1; k <= pax; k++) sp.cage['paxOcc' + k] = 1;
    card = JSON.stringify(j); say('  load: ' + pax + ' passenger(s), ' + PR0[1] + ' kg of baggage (' + (L.preset || 'given') + ') into the seeded card'); }
  const PR = require(path.join(T, 'page_rig.js'));
  const wall0 = Date.now();
  const rig = await PR.start(Object.assign({ cap: o.cap || 900, size: o.size || '1600x900', seed: { ...o.seed, 'flydiy.wip': card }, headed:!!o.headed, live:!!o.live, q:o.q, init:o.init, boot:o.boot, fallback:o.fallback,onNavigate:o.onNavigate }, o.repo ? { repo: o.repo } : {}, { log: o.quiet ? (() => {}) : (t => say('  rig ' + t)) }));
  const R = { ok: false, steps: [], failed: null, t: 0, wall: 0, log: out };
  try {
    if(o.onReady)R.metadata=await o.onReady(rig);
    J({ type: 'run', scenario: S.name, what: S.what || null, runner: 'page', plane: P.name, build: P.file, from: S.from, to: S.to || S.from,
        persona: S.persona || 'expert', seeded: 'flydiy.wip <- ' + P.file, gpu: rig.gpu, bootS: rig.bootS, sha: gitSha(), at: new Date().toISOString() });
    say('flight_script (page): ' + S.name + ' - ' + P.name + ' (seeded as the working build), ' + S.from + ' > ' + (S.to || S.from) + ' | gpu ' + rig.gpu + ', boot ' + rig.bootS + ' s | log ' + out);
    // the brief, a player's way: the writers set, their own change handlers run
    const setSel = (id, v) => rig.ev(`(() => { const s = document.getElementById(${JSON.stringify(id)}); if (!s) return 'no #' + ${JSON.stringify(id)};
      if (![...s.options].some(o => o.value === ${JSON.stringify(v)})) return 'no option ' + ${JSON.stringify(v)}; s.value = ${JSON.stringify(v)};
      s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
    const brief = [];
    if (S.day === 'calm') brief.push('cond ' + await setSel('selCond', 'calm'));
    if (S.persona) brief.push('persona ' + await setSel('selPersona', S.persona));
    brief.push('to ' + await setSel('selDest', (S.to && S.to !== S.from) ? S.to : 'CIRCUIT'));
    say('  the brief: ' + brief.join(', '));
    // the benchmark's own record in the flight recorder's log (PERF-TRACE-FORMAT section 2)
    await rig.ev(`(() => { try { window.FLIGHT_REC.event('bench', null, null, ${JSON.stringify(JSON.stringify({ scenario: S.name, runner: 'page', file: path.basename(S.file || ''), sha: gitSha(), steps: S.steps }))}); return 1; } catch (e) { return String(e); } })()`);
    // the camera's moves in-page (a rAF loop: one call a step, not one a frame over CDP)
    await rig.ev(`(() => { if (window.__FSB) return 1; window.__FSB = { sweep(view, deg, s, dist) { const P = window.FLIGHT_PROBE; return new Promise(res => {
      const t0 = performance.now(), d = dist || 18; if (view === 'pan360') P.camMode('free'); else P.camMode(view === 'orbit' ? 'orbit' : view);
      const c0 = P.sim().cgPos(); const f = () => { const k = Math.min(1, (performance.now() - t0) / (s * 1000)), a = (deg || 0) * Math.PI / 180 * k;
        if (view === 'orbit') P.camSet(a, 0.25, d); else if (view === 'pan360') P.devFree(c0[0], c0[1] + 8, c0[2], a, 0);
        if (k < 1) requestAnimationFrame(f); else res(1); }; requestAnimationFrame(f); }); } }; return 1; })()`);
    // the frame sampler (rAF intervals, ms), read and emptied per step
    await rig.ev(`(() => { if (window.__FSF) return 1; const F = window.__FSF = { d: [], last: 0, lastRender:-1, renderedOnly:${!!o.playerFrames} }; const f = t => { const frame=window.FLYDIY_RENDERER&&FLYDIY_RENDERER.info.render.frame;if(!F.renderedOnly||frame!==F.lastRender){if(F.last)F.d.push(t-F.last);F.last=t;F.lastRender=frame;}requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`);
    const ST = `(() => { const P = window.FLIGHT_PROBE, ap = P && P.ap(), s = P && P.sim(); if (!ap || !s) return null; const cg = s.cgPos(), v = s.cgVel ? s.cgVel() : [0, 0, 0];
      const D = P.damage ? P.damage() : null, W = P.world ? P.world() : null;
      const w = (typeof flightWhere === 'function' && W) ? flightWhere(W, cg[0], cg[2]) : null;
      const dec = ap.report && ap.report.outcome === 'declined' ? (((ap.report.verdicts || []).find(q => q.code === 'takeoff-declined') || {}).note || 'declined') : null;
      return { t: ap.t, ph: ap.phase, agl: P.agl ? P.agl() : null, cg: cg.map(x => Math.round(x * 10) / 10), Vg: Math.hypot(v[0], v[2]), vs: v[1],
               where: w && w.aero ? w.aero.id : null, over: P.over ? !!P.over() : false, crashed: !!(D && (D.crashed || D.over)), dmg: D ? (D.reason || D.verdict || null) : null,
               declined: dec, nV: ((ap.report && ap.report.verdicts) || []).length,
               said: ((ap.report && ap.report.verdicts) || []).slice(-3).map(q => q.code + '@' + Math.round(q.t) + (q.note ? ': ' + String(q.note).slice(0, 160) : '')) }; })()`;
    const frames = async () => {
      const d = await rig.J(`(() => { const F = window.__FSF; const d = F ? F.d.splice(0) : []; return d; })()`) || [];
      if (!d.length) return null;
      const s = d.slice().sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
      return { n: d.length, p50: r1(q(0.5)), p90:r1(q(.9)), p99: r1(q(0.99)), max: r1(s[s.length - 1]), deliveredFps:r1(1000*d.length/d.reduce((a,b)=>a+b,0)),over50: d.filter(x => x > 50).length,over100:d.filter(x=>x>100).length,freeze250:d.filter(x=>x>=250).length,over1000:d.filter(x=>x>1000).length };
    };
    let failed = null;
    for (let si = 0; si < S.steps.length && !failed; si++) {
      const st = S.steps[si], phases = [], w0 = Date.now();
      if(o.beforeStep)await o.beforeStep(rig,st,si);
      let s = await rig.J(ST);
      await frames();   // (the step's frames start here)
      let t0 = s ? s.t : 0;
      await rig.ev(`(() => { try { window.FLIGHT_REC.mark(${JSON.stringify('seg:' + st.name)}); } catch (e) {} return 1; })()`);
      if (st.do === 'start' && S.from !== 'HOME') {
        const goJs = '(() => { try { const G = window.FLYDIY_START; if (!G || !G.go) return "no start chooser"; G.go({ start: "field:' + S.from + '", to: ' + JSON.stringify(S.to && S.to !== S.from ? S.to : null) + ' }); return "ok"; } catch (e) { return String(e); } })()';
        say('  start from ' + S.from + ': ' + await rig.ev(goJs));
        await new Promise(r => setTimeout(r, 4000)); rig.flying = false; await rig.fly(); s = await rig.J(ST);
      }
      else if (st.do === 'start' || st.do === 'rollout') { rig.flying = false; await rig.fly(); s = await rig.J(ST); }
      else if (st.do === 'skip') say('  skip: ' + await rig.ev(`(() => { const b = document.getElementById('bSkip'); if (b && !b.hidden && !b.disabled) { b.click(); return 'skipped'; } return 'no skip offered'; })()`));
      else if (st.do === 'camera') { await rig.ev(`window.__FSB.sweep(${JSON.stringify(st.view || 'chase')}, ${+(st.sweep || 0)}, ${+(st.s || 5)}, ${st.dist == null ? 'null' : +st.dist})`, ((+(st.s || 5)) + 30) * 1000); }
      else if (st.do === 'weather') say('  weather ' + st.cond + ': ' + await setSel('selCond', st.cond));
      else if (st.do === 'time') say('  time ' + st.hour + ' h: ' + await rig.ev(`(() => { try { window.DAY_CLOCK.set({ localHours: ${+st.hour} }); return 'ok'; } catch (e) { return String(e); } })()`));
      else if (st.do === 'dest') say('  destination ' + st.to + ': ' + await setSel('selDest', st.to));
      else if (st.do === 'minimap') say('  minimap ' + (st.open !== false ? 'open' : 'closed') + ': ' + await rig.ev(`(() => { try { window.FLIGHT_PROBE.panel('map', ${st.open !== false}); return 'ok'; } catch (e) { return String(e); } })()`));
      else if (st.do === 'shed') say('  back to the shed: ' + await rig.ev(`(() => { const b = document.getElementById('bHangar2'); if (b) { b.click(); return 'ok'; } return 'no shed button'; })()`));
      else if (st.do === 'load') { if (si > iStart && iStart >= 0) failed = { step: si, name: st.name, why: { what: 'a load in the journey is not built yet (v1: loads go before the start)' } }; }
      else if (st.do === 'leg') { const r = await setSel('selDest', st.to); const ok = await rig.ev('window.FLIGHT_PROBE.nextLeg()'); say('  leg to ' + st.to + ': ' + r + (ok ? '' : ' (no Fly on)'));
        s = await rig.J(ST); t0 = s ? s.t : 0; }   // (a leg is a new pilot: its clock restarts at 0, the step's with it)
      else if (st.do === 'lift') await rig.ev(`window.FLIGHT_PROBE.place({ by: [0, ${+st.by}, 0] })`);
      else if (st.do === 'board') { if (!s) failed = { step: si, name: st.name, why: { what: 'not ready to board: no sim / pilot on the page' } }; }
      if(o.refreshState)s=await rig.J(ST);   // opt-in ending snapshots; keep an in-progress comparison's protocol fixed
      const U = st.until || null, al = new Set(st.allow || []), cap = st.capS || 0;
      const miss = x => {
        const m = [];
        if (!x) return ['the page has no sim'];
        if (U.phase != null) { const L = [].concat(U.phase); if (!L.includes(x.ph)) m.push('phase ' + x.ph + ', wants ' + L.join('|')); }
        if (U.agl != null && !(x.agl >= U.agl)) m.push('AGL ' + x.agl + ' m, wants >= ' + U.agl);
        if (U.stoppedAt != null && !(x.ph === 'STOPPED' && x.where === U.stoppedAt)) m.push(x.ph !== 'STOPPED' ? 'not STOPPED (' + x.ph + ')' : 'stopped on ' + (x.where || 'no strip') + ', wants ' + U.stoppedAt);
        if (U.declined && !x.declined) m.push('no take-off declined');
        if (U.s != null && !((Date.now() - w0) / 1000 >= U.s)) m.push(((Date.now() - w0) / 1000).toFixed(0) + ' s of ' + U.s);
        return m;
      };
      const fault = x => {
        if (!x) return null;
        if (x.crashed) return al.has('crash') ? null : 'the damage ended the flight: ' + (x.dmg || 'crashed');
        if (x.ph === 'ABORT') return 'the take-off was rejected (ABORT)';
        if (x.declined && !al.has('declined') && !(U && U.declined)) return 'the take-off was declined: ' + x.declined;
        return null;
      };
      let m = U ? miss(s) : [];
      while (!failed && m.length) {
        // (the slot's own deadline: 45 s before the rig's hard cap the run stops, said, and still pulls the log and writes the report)
        if (Date.now() > wall0 + ((o.cap || 900) - 45) * 1000) { failed = { step: si, name: st.name, why: { what: 'the slot time: stopped 45 s before the hard cap, the log kept', phase: s && s.ph } }; break; }
        if (s && s.t - t0 >= cap) { failed = { step: si, name: st.name, why: { what: 'the cap: ' + cap + ' s passed with ' + m.join('; '), phase: s.ph, said: s.said, pos: s.cg, where: s.where } }; break; }
        if (Date.now() - w0 > (cap * 3 + 120) * 1000) { failed = { step: si, name: st.name, why: { what: 'the wall clock: ' + Math.round((Date.now() - w0) / 1000) + ' s for a ' + cap + ' s step (the sim not advancing?)', why: await rig.why() } }; break; }
        await new Promise(r => setTimeout(r, 250));
        s = await rig.J(ST);
        if (s && phases[phases.length - 1] !== s.ph) phases.push(s.ph);
        const f = fault(s);
        if (f) { failed = { step: si, name: st.name, why: { what: f, phase: s.ph, said: s.said, pos: s.cg, where: s.where } }; break; }
        m = miss(s);
      }
      const fr = await frames();
      const rec = { type: 'step', i: si, name: st.name, do: st.do || null, ok: !failed, t0: r1(t0), t1: s ? r1(s.t) : null, phases,
                    end: s ? { ph: s.ph, pos: s.cg, agl: s.agl, where: s.where } : null, said: s ? s.said : [], frames: fr, wallS: r1((Date.now() - w0) / 1000), why: failed ? failed.why : null };
      J(rec); R.steps.push(rec);
      if(o.afterStep)await o.afterStep(rig,st,rec,R);
      say('  ' + (rec.ok ? 'ok  ' : 'FAIL') + ' ' + String(si + 1).padStart(2) + ' ' + st.name.padEnd(26) + ' t ' + rec.t0 + ' > ' + rec.t1 + ' s' + (phases.length ? '  ' + phases.join('>') : '') +
          (fr ? '  | frames ' + fr.n + ', p50 ' + fr.p50 + ' ms, p99 ' + fr.p99 + ', max ' + fr.max + ', ' + fr.over50 + ' over 50 ms' : ''));
      if (failed) { say('       WHY: ' + failed.why.what); for (const v of failed.why.said || []) say('       said ' + v); }
    }
    R.failed = failed; R.ok = !failed;
    if(o.afterFlight)R.afterFlight=await o.afterFlight(rig,R);
    // the flight recorder's log, pulled whole (PERF-TRACE-FORMAT section 3) and the report made from it
    try {
      await rig.ev(`(() => { try { window.FLIGHT_REC.mark('seg:end'); } catch (e) {} window.__FSLOG = window.FLIGHT_REC.rec.logParts().join(''); return window.__FSLOG.length; })()`);
      const n = await rig.J('window.__FSLOG.length'), CH = 4e6, logFile = out.replace(/\.jsonl$/, '') + '.flightlog.json', fdL = fs.openSync(logFile, 'w');
      for (let a = 0; a < n; a += CH) fs.writeSync(fdL, await rig.ev(`window.__FSLOG.slice(${a}, ${a + CH})`, 60000));
      fs.closeSync(fdL);
      const PT = require(path.join(T, 'perf_trace.js')), rep0 = PT.trace(JSON.parse(fs.readFileSync(logFile, 'utf8')), { scenario: S.name, scenarioFile: path.basename(S.file || ''), runner: 'page', logFile });
      const trFile = out.replace(/\.jsonl$/, '') + '.perftrace.json'; fs.writeFileSync(trFile, JSON.stringify(rep0, null, 1)); R.trace = trFile;
      say('  the report: ' + trFile + ' (' + rep0.segments.length + ' segments, ' + rep0.stutters.length + ' frames over 50 ms)');
    } catch (e) { say('  (the flight log could not be pulled: ' + (e && e.message || e) + ')'); }
  } catch (e) {
    R.failed = { step: -1, name: 'rig', why: { what: String(e && e.message || e), why: e && e.why || null } }; R.ok = false;
    say('FAIL the rig: ' + R.failed.why.what);
  } finally {
    R.wall = Date.now() - wall0;
    J({ type: 'end', ok: R.ok, passed: R.steps.filter(r => r.ok).length, of: S.steps.length, wallMs: R.wall, failed: R.failed ? { step: R.failed.step, name: R.failed.name, what: R.failed.why.what } : null });
    fs.closeSync(fd);
    await rig.close();
  }
  say((R.ok ? 'PASS' : 'FAIL') + ' ' + S.name + ' (page): ' + R.steps.filter(r => r.ok).length + ' of ' + S.steps.length + ' steps, ' + (R.wall / 1000).toFixed(0) + ' s wall');
  return R;
}

module.exports = { loadScenario, checkScenario, planeOf, runNode, runPage, LIB };

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
  if (runner !== 'node' && runner !== 'page') { console.error('flight_script: --runner node | page'); process.exit(2); }
  let S;
  try { S = loadScenario(argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--log' && argv[argv.indexOf(a) - 1] !== '--runner')); }
  catch (e) { console.error('flight_script: ' + e.message); process.exit(2); }
  const bad = checkScenario(S);
  if (bad.length) { console.error('flight_script: bad scenario ' + S.name + ':\n  ' + bad.join('\n  ')); process.exit(2); }
  if (runner === 'page') {   // (A GPU RUN NEEDS A0's SLOT: boxlock.sh take gpu first, RIG-PROCEDURE 1)
    // (PERF-TRACE 22 Nov: --headed --live --q --boot reach page_rig too - the user's rule: timing from a VISIBLE browser at the big screen's size)
    runPage(S, { out: opt('out', undefined), log: opt('log', undefined), quiet: argv.includes('--quiet'), cap: +opt('cap', 900), size: opt('size', undefined), repo: opt('repo', undefined),
      headed: argv.includes('--headed'), live: argv.includes('--live'), q: opt('q', undefined), boot: +opt('boot', 0) || undefined })
      .then(R => process.exit(R.ok ? 0 : 1), e => { console.error('flight_script (page): ' + (e && e.message || e)); process.exit(2); });
  } else {
    const R = runNode(S, { out: opt('out', undefined), log: opt('log', undefined), quiet: argv.includes('--quiet'), every: opt('every', undefined) });
    process.exit(R.ok ? 0 : 1);
  }
}
