#!/usr/bin/env node
// GATE DMGFALL (DMG-FALL) - every separated piece comes down before the game ends the flight, node only, on the user's
// validated builds. The user, 25 Oct: "detached parts hang metres high". The diag (Mon 26 Oct 02:45, 11 runs) found no
// piece free in the air once the CG had stopped, but the game's watch (app.js G1868) ended the flight 3 s after the
// solver's over whatever its pieces did: 4 of 11 still moved there, and a break-up IN THE AIR is over at the parting
// (30_solver.js compEvent) - its halves froze mid-fall. The watch now waits for the solver's own pieces too (DMG.rest:
// every node at rest; DMG.fall: one still coming down; WATCH_PIECES / WATCH_FALL), and this gate flies the watch's rule.
// The checks:
//   1. THE FREEZE (per build and case): the watch's rule played on the solver's clock - its freeze is the first frame
//      the pieces are still (DMG.rest, or past WATCH_PIECES with nothing falling, or past WATCH_FALL), plus WATCH_HOLD.
//      At the freeze no piece off the core (3 nodes or more, the solver's own pieces: pieceOf) has its lowest point
//      more than 0.3 m over the ground. Cases: 30 m/s into a trunk on the centreline and 2.5 m out, the 6 m/s drop,
//      and a break-up from the air (a flown pull to nz 9 at 58 m/s, 400 m up, then the nose down under power into the ground)
//   2. ONE RULE: app.js's watch reads D.rest and D.fall with the constants this gate plays; sim_host.js sends them under
//      the physics worker; the HUD's word strips a break-up's own 'broke up:' (no "BROKE UP: broke up:")
//   3. A WHOLE FLIGHT: the circuit on the Cub never crashes, DMG.rest stays null (the rest is a crash's only)
//   REPORT: the pieces at the freeze, each with its live cover ties' lift over its weight (a piece held up by its
//   covering: > 0.2 W) - the open question of DMG-FALL's fix b
// Run: node tools/_dmg_fall_check.js [--only=freeze,rule,ops]   (one final `GATE DMGFALL: PASS|FAIL`; children 3 at once)
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const argv = process.argv.slice(2);
const WATCH_PIECES = 12, WATCH_FALL = 40, WATCH_HOLD = 3, H_AIR = 0.3, LIFT_W = 0.2;
const LAND = ['cub', 'jodel', 'metal'], CASES = ['fly0', 'fly25', 'drop6', 'air'];

// ---- a child: one build, one case; JSON on its last line ----
if (argv[0] === '--part') {
  const [key, cid] = argv.slice(1);
  const L = require('./_treecrash_lib.js'), S = require('./_dmg_scar_lib.js');
  const def = L.defOf(key), n = def.nodes.length, AIR = cid === 'air';
  const c0 = AIR ? null : S.CASES.find(x => x.id === cid), elev = AIR ? 0 : c0.elev;
  const out = { key, cid, over: null, rest: null, freeze: null, pcs: null, crashed: false, reason: null };
  const read = sim => {
    const P = sim.pieceOf(), ties = sim.coverTies ? sim.coverTies() : null, by = new Map();
    for (let i = 0; i < n; i++) { const r = P[i]; if (!by.has(r)) by.set(r, { n: 0, hMin: 1e9, hMax: -1e9, m: 0, lift: 0, ties: 0 }); const q = by.get(r);
      const h = sim.p[i * 3 + 1] - (def.nodes[i].r || 0) - elev; q.n++; q.m += def.nodes[i].m; q.hMin = Math.min(q.hMin, h); q.hMax = Math.max(q.hMax, h); }
    if (ties) for (let j = 0; j < ties.n; j++) { if (ties.torn[j] >= 0) continue;
      const a = ties.a[j], b = ties.b[j]; if (P[a] === P[b]) continue;
      const dy = sim.p[b * 3 + 1] - sim.p[a * 3 + 1], Lt = Math.hypot(sim.p[b * 3] - sim.p[a * 3], dy, sim.p[b * 3 + 2] - sim.p[a * 3 + 2]) || 1e-9, Fy = (ties.F[j] || 0) * dy / Lt;
      const qa = by.get(P[a]), qb = by.get(P[b]); qa.ties++; qa.lift += Fy; qb.ties++; qb.lift -= Fy; }
    // the core: the body frame's piece (30_solver.js REFS - the nose frame first), as compEvent reads a break-up
    const nf = [].concat(def.refs.noseFrame || [], def.refs.tailMid || []).filter(i => i >= 0 && i < n)[0], core = nf != null ? P[nf] : null;
    return [...by.entries()].filter(([, q]) => q.n >= 3).sort((x, y) => y[1].n - x[1].n)
      .map(([r, q], i) => ({ n: q.n, core: core != null ? r === core : i === 0, hMin: +q.hMin.toFixed(3), hMax: +q.hMax.toFixed(2), m: +q.m.toFixed(1), ties: q.ties, liftW: +(q.lift / (q.m * 9.81)).toFixed(3) }));
  };
  let still = null, done = false;
  const onFrame = sim => {
    if (done) return;
    const D = sim.damage();
    if (D.over && out.over == null) out.over = sim.t;
    if (out.over == null) return;
    const tw = sim.t - out.over;
    if (still == null && (D.rest != null || (tw > WATCH_PIECES && !D.fall) || tw > WATCH_FALL)) { still = sim.t; out.rest = D.rest; }
    if (still != null && sim.t - still >= WATCH_HOLD) { out.freeze = sim.t; out.pcs = read(sim); done = true; }
  };
  let sim;
  if (AIR) {
    const r = L.pull(key, { nz: 9, V: 58, hold: 0.3, secs: 4, onFrame });
    // the Cub and the Jodel hold their wing through the pull (nz 6.5 / 5.7): then the nose goes down under power, into
    // the ground from 400 m - the high-speed break-up that throws pieces up (the metal Cessna's, 20:05 Mon 26 Oct: a
    // 17.7 kg piece 0.4-2 m up at 13 m/s at the old freeze); a nose-down input is the pull's sense reversed (pull()'s sgn -1)
    sim = L.lastRun.sim; out.nz = +r.nzMax.toFixed(2); sim.ctl.de = sim.damage().crashed ? 0 : 0.5; sim.ctl.thr = sim.damage().crashed ? 0 : 1;
    for (let f = 0; f < 60 * (WATCH_FALL + WATCH_HOLD + 30) && !done && Number.isFinite(sim.p[1]); f++) { if (sim.damage().crashed) { sim.ctl.de = 0; sim.ctl.thr = 0; } sim.step(1 / 60); onFrame(sim); }
  } else {
    const secs = WATCH_PIECES + WATCH_HOLD + 12;
    const c = Object.assign({}, c0, { run: (k, o) => c0.run(k, Object.assign(o, { secs })) });
    sim = S.runCase(key, c, { onFrame }).sim || L.lastRun.sim;
    // a case's run can end before the watch does (drop6 is 300 frames): the game's clock goes on, so the sim does too
    for (let f = 0; f < 60 * (WATCH_FALL + WATCH_HOLD + 10) && !done && Number.isFinite(sim.p[1]); f++) { sim.step(1 / 60); onFrame(sim); }
  }
  const D = sim.damage(); out.crashed = D.crashed; out.reason = D.reason; out.brokeUp = !!D.brokeUp; out.broken = (D.broken || []).length; out.finite = L.finite(sim);
  if (!done && out.over != null) out.pcs = read(sim);   // (the run ended before the freeze: read at its end, flagged)
  out.ended = done;
  console.log(JSON.stringify(out));
  process.exit(0);
}
if (argv[0] === '--ops') {
  const L = require('./_treecrash_lib.js');
  const r = L.circuit('cub', {}), D = L.lastRun.sim.damage();
  console.log(JSON.stringify({ crashed: D.crashed, rest: D.rest, finite: L.finite(L.lastRun.sim) }));
  process.exit(0);
}

// ---- the parent ----
const only = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean), on = s => !only.length || only.includes(s);
let fails = 0;
const yes = (ok, msg) => { console.log((ok ? '  PASS ' : '  FAIL ') + msg); if (!ok) fails++; };
const child = args => new Promise(res => cp.execFile(process.execPath, ['--max-old-space-size=3072', __filename, ...args], { cwd: __dirname, maxBuffer: 1 << 26 },
  (e, so, se) => { const last = String(so || '').trim().split('\n').pop(); try { res(JSON.parse(last)); } catch (x) { res({ err: (e && e.message) || 'no JSON', tail: String(se || so || '').slice(-400) }); } }));
const pool = async (jobs, k) => { const out = new Array(jobs.length); let i = 0; await Promise.all(Array.from({ length: k }, async () => { while (i < jobs.length) { const j = i++; out[j] = await jobs[j](); } })); return out; };

(async () => {
  console.log('GATE DMGFALL - every separated piece down before the flight ends (WATCH_PIECES ' + WATCH_PIECES + ' s, WATCH_FALL ' + WATCH_FALL + ' s, WATCH_HOLD ' + WATCH_HOLD + ' s; in the air: lowest point > ' + H_AIR + ' m)');
  if (on('freeze')) {
    console.log('1. THE FREEZE');
    const jobs = []; for (const k of LAND) for (const c of CASES) jobs.push(() => child(['--part', k, c]));
    const rs = await pool(jobs, +(process.env.DMGFALL_JOBS || 3));
    for (const r of rs) {
      if (r.err) { yes(false, 'a run did not report: ' + r.err + ' ' + (r.tail || '')); continue; }
      const tag = r.key + ' ' + r.cid + (r.nz != null ? ' (pull nz ' + r.nz + ')' : '');
      if (r.over == null) { console.log('  ---- ' + tag + ': no crash (' + (r.crashed ? r.reason : 'intact') + ') - nothing to watch'); if (r.cid !== 'drop6') yes(false, tag + ' crashed'); continue; }
      const off = (r.pcs || []).filter(q => !q.core), air = off.filter(q => q.hMin > H_AIR), hang = off.filter(q => q.liftW > LIFT_W);
      console.log('  ---- ' + tag + ': over ' + r.over.toFixed(2) + ' s "' + r.reason + '"' + (r.brokeUp ? ' (broke up)' : '') + ', pieces still ' + (r.rest != null ? r.rest.toFixed(2) + ' s' : 'NOT (the cap)') + ', freeze ' + (r.freeze != null ? r.freeze.toFixed(2) : '-') + ' s, ' + (r.pcs || []).length + ' pieces');
      for (const q of r.pcs || []) console.log('       ' + (q.core ? 'core ' : 'piece') + ' n=' + q.n + ' ' + q.m + ' kg h ' + q.hMin.toFixed(2) + '..' + q.hMax.toFixed(2) + ' m, ties ' + q.ties + ' lift ' + q.liftW.toFixed(2) + ' W' + (q.hMin > H_AIR && !q.core ? '  <-- IN THE AIR' : '') + (q.liftW > LIFT_W && !q.core ? '  (held by its covering)' : ''));
      yes(r.ended && r.finite, tag + ': the watch froze it (' + (r.ended ? 'at ' + r.freeze.toFixed(2) + ' s' : 'NEVER in the run') + '), finite');
      yes(!air.length, tag + ': no piece off the core in the air at the freeze (' + air.length + ' of ' + off.length + (air.length ? ', the highest ' + Math.max(...air.map(q => q.hMin)).toFixed(2) + ' m' : '') + ')');
      if (hang.length) console.log('  REPORT ' + tag + ': ' + hang.length + ' piece(s) lifted > ' + LIFT_W + ' W by their covering at the freeze');
    }
  }
  if (on('rule')) {
    console.log('2. ONE RULE');
    const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const app = src('src/viewer/app.js'), host = src('src/viewer/sim_host.js');
    const k = app.match(/const WATCH_PIECES = (\d+), WATCH_FALL = (\d+);/), h = app.match(/const WATCH_REST = \d+, WATCH_HOLD = (\d+);/);
    yes(!!k && +k[1] === WATCH_PIECES && +k[2] === WATCH_FALL && !!h && +h[1] === WATCH_HOLD, "app.js's watch constants are the gate's (WATCH_PIECES " + (k ? k[1] : '?') + ', WATCH_FALL ' + (k ? k[2] : '?') + ', WATCH_HOLD ' + (h ? h[1] : '?') + ')');
    yes(/D\.rest != null \|\| \(tw > WATCH_PIECES && !D\.fall\) \|\| tw > WATCH_FALL/.test(app), "app.js's watch waits for the solver's pieces (D.rest, D.fall)");
    yes(/rest: d\.rest, fall: d\.fall/.test(host), 'sim_host.js sends rest and fall to the page (the physics worker)');
    yes(/replace\(\/\^broke up:\\s\*\/i, ''\)/.test(app) && !/\(up \? 'BROKE UP' : 'CRASHED'\) \+ \(D && D\.reason \? ': ' \+ D\.reason/.test(app), "the HUD's word strips a break-up's own 'broke up:'");
  }
  if (on('ops')) {
    console.log('3. A WHOLE FLIGHT');
    const r = await child(['--ops']);
    yes(!r.err && !r.crashed && r.rest == null && r.finite, 'the Cub\'s circuit: no crash, DMG.rest null (' + JSON.stringify(r).slice(0, 160) + ')');
  }
  console.log('GATE DMGFALL: ' + (fails ? 'FAIL' : 'PASS'));
})();
