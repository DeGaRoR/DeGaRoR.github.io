#!/usr/bin/env node
// GATE PACE (G586) - the frame clock (src/viewer/app.js PACE): the game's time on the wall clock, the frame
// capped at auto / 60 / 30 / off. The block is lifted out of app.js as written and driven with synthetic
// display refreshes (rAF timestamps), so what is proven is the code that ships:
//   - a 60 Hz screen capped at 30 renders every 2nd refresh, 2 solver steps each - exactly, every frame;
//     capped at 60 every refresh, 1 step each;
//   - a 144 Hz screen, capped at 60 or uncapped: the sim time kept equal to the wall time (to a frame);
//   - a slow frame owes its steps (50 ms -> 3), a hitch at most 4 and forgets the rest;
//   - G1365 (SIM-STALL): a STALL (250 ms or more: a freeze, a tab away) owes nothing of the wall time it lost - the frame
//     after it is an ordinary frame of the cap (its steps, its dt), so a 60 s freeze finds the aeroplane where it was;
//   - AUTO: frames over 18.5 ms drop it to 30 after three readings; at 30 a frame whose one-step work fits
//     60's budget earns a trial of 60; a trial that misses goes back to 30 and holds the next trial off
//     (5 s, doubling, 30 s at most); a trial that holds stays at 60; the auto render scale is told the
//     budget each time; AUTO RECOVERS (G615): hitches (a frame over 3x the cap's interval) are not
//     readings, a 2 s slow burst does not drop it, 14 ms of one-step work at 30 earns the trial;
//   - a RIG (webdriver / headless) and a call with no timestamp keep the old clock: 1 step of 1/60, uncapped;
//   - THE STEP-DEBT GUARD (G612): a frame bound by its own solver (the next refresh after other + steps x step)
//     that cannot hold real time is capped at the cap's steps - the frames stop collapsing, the dilation is
//     reported; one that can hold real time (however heavy) is never touched, and a light 30 reads 100 %.
//   - G620: A FREEZE IS KEPT: a stall of 250 ms or more stays in the readout's history (recent()) and is counted and
//     timed (freezes()) - it was dropped, so a real freeze never showed in the menu's note - while auto's readings
//     still skip it; a gap the page spent hidden (a tab away) is neither a frame nor a freeze.
//   - G1160: a trial that misses 3 of its first 30 refreshes (past a 0.3 s settle) is cut short: ~0.8 s of a juddering
//     60 where a failed trial ran ~2.5 s (the Cub's loop: 7 % of the frames at 60, 16 % before).
//   - G1160: EVEN MEANS EVEN: a trial holds at 58 fps (<= 3 % of the refreshes missed), 60 kept over 56.5 (6 %): the
//     cockpit's cheap frame with a spike every 8th frame (53 fps at 60, kept by G994) settles at an even 30; a rare spike holds 60.
//   - G994: 60 WHERE IT IS EVEN: auto judges a reading on its delivered rate (a trial holds at 55 fps, 60 kept over 52);
//     the latch case is a 17.5 ms loop (even at 60), and the Cub's 21 ms loop (a 48 fps 60) stays a clean 30.
//   - G990: THE AUTO CAP LATCH: on a 60 Hz vsync with the main thread bound by a 21 ms loop (the A-END Cub's taxi: rAF
//     runs late on the vsync it owes, 60's median holds), a drop to 30 comes back to 60 - the trial is the judge, not the
//     one-step work (G615 waited for it under 16.7 ms: never); a frame that cannot hold 60 keeps backing off; a load
//     swinging across the edge does not flap (a drop within 20 s of an up is a missed trial).
//   - G879.1: THE HEAD'S LOOK IS FRAME-RATE-SAFE: the cockpit head (headCam.update, lifted as written) blends the
//     aeroplane's frame a constant tenth toward level - a stateless blend, so no weight on the frame's dt: an aeroplane
//     pitched 11 deg under alternating 16.7 / 50 ms frames holds the look's pitch still (G586 had made it easeK(0.1, dt):
//     the look jumped 0.10 / 0.27 of the pitch frame to frame, the user's "camera frenetically going up and down").
//   node tools/_pace_check.js          -> "GATE PACE: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'app.js'), 'utf8');
const a = src.indexOf('  const PACE = (() => {'), b = src.indexOf('    W.FLYDIY_PACE = api;\n    return api;\n  })();', a);
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
verdict(a > 0 && b > a, 'the PACE block found in app.js');
if (!(a > 0 && b > a)) { console.log('GATE PACE: FAIL'); process.exit(1); }
const block = src.slice(a, b + '    W.FLYDIY_PACE = api;\n    return api;\n  })();'.length);

function make(opts) {
  const store = {}; if (opts.pref) store['flydiy.gfx'] = JSON.stringify(opts.pref);
  const targets = [];
  const clock = { t: 0 }, vis = [];
  const document = { hidden: false, addEventListener: (k, f) => { if (k === 'visibilitychange') vis.push(f); } };
  const window = {
    document,
    navigator: { webdriver: !!opts.rig, userAgent: opts.rig ? 'HeadlessChrome' : 'Chrome' },
    location: { search: opts.search || '' },
    localStorage: { getItem: k => (k in store ? store[k] : null) },
    FLYDIY_AA: { autoTarget: ms => targets.push(ms), autoState: () => ({ on: true, probing: false }) },
  };
  const performance = { now: () => clock.t };
  const PACE = new Function('window', 'performance', block + '\nreturn PACE;')(window, performance);
  const hide = t => { clock.t = t; document.hidden = true; vis.forEach(f => f()); document.hidden = false; };
  return { PACE, targets, clock, hide };
}
// drive: refreshes every `hz`, a frame's work `work(t)` ms (which also delays nothing - the cap is what is tested),
// returns { rendered, steps[], simS, wallS }
function drive(PACE, hz, secs, opt = {}) {
  const dRef = 1000 / hz; let t = PACE.__t || 1000, rendered = 0, sim = 0; const steps = [];   // one clock per instance, never back
  const end = t + secs * 1000;
  while (t < end) {
    const jitter = opt.jitter ? (Math.sin(t * 0.37) * opt.jitter) : 0;
    const f = PACE.frame(t + jitter);
    if (f) { rendered++; steps.push(f.steps); sim += f.steps / 60; PACE.end(opt.work ? opt.work(t) : 5, opt.phys || 2, f.steps, t); }
    t += opt.frameMs ? Math.max(dRef, opt.frameMs(t)) : dRef;
  }
  PACE.__t = t;
  return { rendered, steps, simS: sim, wallS: secs };
}

// 1. 60 Hz, capped at 30: every 2nd refresh, exactly 2 steps each (with a vsync jitter of 0.4 ms)
{
  const { PACE } = make({ pref: { fps: 30 } });
  const r = drive(PACE, 60, 10, { jitter: 0.4 });
  const twos = r.steps.slice(2).every(n => n === 2);
  verdict(Math.abs(r.rendered - 300) <= 2 && twos, `60 Hz capped at 30: ${r.rendered} frames in 10 s, ${twos ? 'every one 2 steps' : 'steps ' + [...new Set(r.steps)].join('/')}`);
  verdict(Math.abs(r.simS - r.wallS) < 0.05, `  the sim ran ${r.simS.toFixed(3)} s in ${r.wallS} s of wall clock`);
}
// 2. 60 Hz capped at 60: every refresh, 1 step each
{
  const { PACE } = make({ pref: { fps: 60 } });
  const r = drive(PACE, 60, 10, { jitter: 0.4 });
  verdict(Math.abs(r.rendered - 600) <= 2 && r.steps.slice(2).every(n => n === 1), `60 Hz capped at 60: ${r.rendered} frames, one step each`);
}
// 3. 144 Hz: capped at 60 (about 60 frames a second) and uncapped (144, steps 0 / 1) - the sim on the wall clock
for (const fps of [60, 'off']) {
  const { PACE } = make({ pref: { fps } });
  const r = drive(PACE, 144, 10);
  const want = fps === 60 ? 600 : 1440;
  verdict(Math.abs(r.rendered - want) <= want * 0.05 && Math.abs(r.simS - r.wallS) < 0.05,
    `144 Hz ${fps === 60 ? 'capped at 60' : 'uncapped'}: ${r.rendered} frames (~${want}), the sim ${r.simS.toFixed(3)} s in ${r.wallS} s`);
}
// 4. a slow frame owes its steps; a hitch owes at most 4 and forgets the rest; a STALL owes nothing (G1365)
{
  const { PACE } = make({ pref: { fps: 'off' } });
  PACE.frame(1000);
  const f1 = PACE.frame(1050);
  const n1 = f1.steps;
  const f2 = PACE.frame(1050 + 200);
  const n2 = f2.steps, d2 = f2.dt;
  const f3 = PACE.frame(1250 + 900);
  const n3 = f3.steps, d3 = f3.dt;
  const f4 = PACE.frame(2150 + 1000 / 60);
  verdict(n1 === 3 && n2 === 4 && Math.abs(d2 - 0.2) < 1e-9 && n3 === 1 && d3 === 1 / 60 && f4.steps === 1,
    `a 50 ms frame owes ${n1} steps (3), a 200 ms hitch ${n2} (4, the rest forgotten - today's, dt ${d2.toFixed(3)}), a 900 ms stall ${n3} (1, dt ${(d3 * 1000).toFixed(1)} ms: the lost time not owed), the next 60th ${f4.steps} (1)`);
  // the user's freeze (3 Oct: 79 s - "when it unfreezes, I find it miles away"): 60 s at the 30 cap, then 60 s visible at 60
  for (const cap of [30, 60]) {
    const { PACE: Q } = make({ pref: { fps: cap } });
    let t = 1000, sim = 0, wall0;
    const go = (ms, k) => { for (let i = 0; i < k; i++) { t += ms; const f = Q.frame(t); if (f) { sim += f.steps / 60; Q.end(5, 1, f.steps, t); } } };
    go(1000 / 60, 120);
    const s0 = sim; wall0 = t;
    go(60000, 1);                                    // the freeze
    const sS = sim - s0, dt = Q.dt;
    go(1000 / 60, 60);                               // a second on
    verdict(sS <= 2 / 60 + 1e-9 && dt <= 2 / 60 + 1e-9 && Math.abs((sim - s0) - (t - wall0 - 60000) / 1000) < 3 / 60 && Q.state().stats.stalls === 1,
      `  capped at ${cap}: a 60 s freeze moves the sim ${(sS * 1000).toFixed(1)} ms (the cap's one frame), dt ${(dt * 1000).toFixed(1)} ms; the next second flies ${(sim - s0 - sS).toFixed(3)} s - real time again, nothing owed (stalls ${Q.state().stats.stalls})`);
  }
}
// 5. AUTO: a frame that misses 60 drops to 30; at 30 a light frame earns a trial; a missed trial backs off
{
  const { PACE, targets } = make({});
  // 60 Hz display, a 22 ms frame (the refreshes it catches are every 2nd -> 33 ms, but the frame itself is what
  // the rAF sees: model it as a 22 ms frame time)
  let r = drive(PACE, 60, 6, { frameMs: () => 22, work: () => 21 });
  let st = PACE.state();
  verdict(st.mode === 'auto' && st.cap === 30 && targets.includes(1000 / 30), `auto: 22 ms frames drop it to 30 (cap ${st.cap}, the scale told ${targets.map(x => x.toFixed(1)).join(' / ')})`);
  // at 30 the frame's work is light (9 ms with one step): it tries 60 - and there the frames hold 16.7 ms
  r = drive(PACE, 60, 12, { work: () => 9 });
  st = PACE.state();
  verdict(st.cap === 60 && st.stats.up >= 1, `auto at 30, a 9 ms frame: a trial of 60 (cap ${st.cap}, ${st.stats.up} up)`);
  r = drive(PACE, 60, 6, { work: () => 9 });
  st = PACE.state();
  verdict(st.cap === 60 && st.stats.trialsFailed === 0, `  the trial holds at 16.7 ms: it stays at 60`);
  // a frame that misses again -> 30; then a light-looking frame at 30 whose trial MISSES (the GPU's: 22 ms at 60)
  drive(PACE, 60, 6, { frameMs: () => 22, work: () => 21 });
  const s1 = PACE.state();
  drive(PACE, 60, 12, { frameMs: t => 22, work: () => 9 });  // light JS, slow frame: the trial misses
  const s2 = PACE.state();
  verdict(s1.cap === 30 && s2.cap === 30 && s2.stats.trialsFailed >= 1 && s2.holdUpS > 0,
    `  a trial that misses (light JavaScript, a 22 ms frame - the GPU's): back to 30, the next trial held ${s2.holdUpS} s (${s2.stats.trialsFailed} failed)`);
}
// 6. the rigs and the harness: the old clock
{
  const { PACE } = make({ rig: true, pref: { fps: 30 } });
  const r = drive(PACE, 60, 2);
  verdict(Math.abs(r.rendered - 120) <= 1 && r.steps.every(n => n === 1) && PACE.state().legacy, `a rig: every refresh a frame of one 1/60 step, whatever the cap (${r.rendered} frames)`);
  const { PACE: P2 } = make({ rig: true, search: '?pace=1', pref: { fps: 30 } });
  verdict(!P2.state().legacy, '  ?pace=1 turns the clock on in a rig');
  const { PACE: P3 } = make({ pref: { fps: 30 } });
  const f = P3.frame(undefined);
  verdict(f && f.steps === 1 && f.dt === 1 / 60, 'a call with no timestamp (the harness): one step of 1/60');
}
// 8. AUTO RECOVERS (G615)
{
  // hitches at 60: one 120 ms frame a second is not a reading - it holds 60
  const { PACE } = make({});
  drive(PACE, 60, 10, { frameMs: t => (Math.floor(t / 1000) !== Math.floor((t + 1000 / 60) / 1000) ? 120 : 1000 / 60), work: () => 9 });
  let st = PACE.state();
  verdict(st.cap === 60 && st.stats.down === 0, `a 120 ms hitch every second at 60: not a reading, it holds 60 (cap ${st.cap}, ${st.stats.down} down)`);
  // a 2 s burst of 22 ms frames (a reveal, a stream item): two slow readings, not three - it holds 60
  const { PACE: P2 } = make({});
  drive(P2, 60, 3, { work: () => 9 });
  drive(P2, 60, 2, { frameMs: () => 22, work: () => 21 });
  drive(P2, 60, 4, { work: () => 9 });
  st = P2.state();
  verdict(st.cap === 60 && st.stats.down === 0, `a 2 s burst of 22 ms frames: it holds 60 (cap ${st.cap})`);
  // after a real drop, 14 ms of one-step work (over the old 12.5, inside 60's 16.7) earns the trial, and it holds
  const { PACE: P3 } = make({});
  drive(P3, 60, 6, { frameMs: () => 22, work: () => 21 });
  const s0 = P3.state();
  drive(P3, 60, 10, { work: () => 14 });
  st = P3.state();
  verdict(s0.cap === 30 && st.cap === 60 && st.stats.up >= 1, `dropped to 30, then 14 ms of one-step work: a trial of 60 that holds (cap ${s0.cap} -> ${st.cap})`);
  // trials that keep missing: the hold never past 30 s
  const { PACE: P4 } = make({});
  drive(P4, 60, 6, { frameMs: () => 22, work: () => 21 });
  let maxHold = 0;
  for (let k = 0; k < 8; k++) { drive(P4, 60, 8, { frameMs: () => 22, work: () => 9 }); maxHold = Math.max(maxHold, P4.state().holdUpS - P4.__t / 1000); }   // (the stub's performance.now() is 0: the hold against the drive's own clock)
  st = P4.state();
  verdict(st.stats.trialsFailed >= 3 && maxHold <= 30, `trials that miss (${st.stats.trialsFailed}): the next held ${maxHold.toFixed(0)} s at most (<= 30)`);
}
// 7. THE STEP-DEBT GUARD (G612): a 60 Hz screen capped at 30, the frame bound by its own work - the next refresh
// after `other + steps x step` ms (the solver's steps run in the frame they are owed) - for 20 s
function driveCpu(PACE, other, step, secs) {
  const R = 1000 / 60; let t = 1000, frames = 0, sim = 0, maxSteps = 0; const end = t + secs * 1000;
  while (t < end) {
    const f = PACE.frame(t);
    if (!f) { t += R; continue; }
    const n = f.steps, work = other + n * step;
    frames++; sim += n / 60; if (t > 3000) maxSteps = Math.max(maxSteps, n);
    PACE.end(work, n * step, n, t, n);
    t = Math.ceil((t + work + 1e-6) / R) * R;
  }
  return { fps: frames / secs, speed: sim / secs, maxSteps };
}
{
  // the runaway: 15 ms of frame and a 16 ms solver step - real time needs 15 / (16.7 - 16) = 21 steps a frame
  const { PACE } = make({ pref: { fps: 30 } });
  const r = driveCpu(PACE, 15, 16, 20), st = PACE.state();
  verdict(r.maxSteps === 2 && r.fps >= 18 && st.stats.guarded > 0,
    `the runaway (15 ms + 16 ms a step, capped at 30): ${r.fps.toFixed(1)} fps (the unguarded clock ~12), at most ${r.maxSteps} steps a frame, ${st.stats.guarded} frames capped`);
  verdict(Math.abs(st.dilation - r.speed) < 0.08 && st.dilation < 0.8 && st.droppedS > 0,
    `  the dilation reported ${(100 * st.dilation).toFixed(0)} % (the sim ran ${(100 * r.speed).toFixed(0)} % of the wall clock), ${st.droppedS.toFixed(1)} s let go, the step read ${st.stepMs.toFixed(1)} ms`);
  // heavy but holdable: 15 ms + 9 ms a step needs 15 / 7.7 = 2 steps - the G586 clock, untouched
  const { PACE: P2 } = make({ pref: { fps: 30 } });
  const r2 = driveCpu(P2, 15, 9, 20), s2 = P2.state();
  verdict(s2.stats.guarded === 0 && Math.abs(r2.speed - 1) < 0.02,
    `heavy but holdable (15 ms + 9 ms a step): no frame capped, the sim at ${(100 * r2.speed).toFixed(0)} % of the wall clock (${r2.fps.toFixed(1)} fps)`);
  // a light 30: 100 %, nothing capped
  const { PACE: P3 } = make({ pref: { fps: 30 } });
  driveCpu(P3, 8, 3, 10); const s3 = P3.state();
  verdict(s3.stats.guarded === 0 && Math.abs(s3.dilation - 1) < 0.02, `a light 30 (8 ms + 3 ms a step): the dilation ${(100 * s3.dilation).toFixed(0)} %, nothing capped`);
}
// 9. G620: a freeze is kept in the readout's history, flagged and counted; auto's reading does not take it; a hidden gap is not one
{
  const { PACE, clock, hide } = make({ pref: { fps: 60 } });
  let t = 1000;
  for (let i = 0; i < 30; i++) { t += 1000 / 60; PACE.frame(t); }
  t += 900; clock.t = t; PACE.frame(t);                            // a 900 ms freeze
  for (let i = 0; i < 10; i++) { t += 1000 / 60; PACE.frame(t); }
  const h = PACE.recent(), fz = PACE.freezes();
  verdict(h.some(x => Math.abs(x - 900) < 1e-6) && fz.n === 1 && Math.abs(fz.maxMs - 900) < 1e-6 && fz.agoS !== null,
    `a 900 ms freeze stays in the readout's history (max ${Math.max(...h).toFixed(0)} ms) and is counted (${fz.n}, worst ${fz.maxMs.toFixed(0)} ms)`);
  // auto's reading: a freeze in a 60-frame reading does not move the median (the reading skips it, as it always did)
  const { PACE: PA } = make({});
  let ta = 1000;
  for (let k = 0; k < 400; k++) { ta += (k % 59 === 30) ? 600 : 1000 / 60; const f = PA.frame(ta); if (f) PA.end(5, 1, f.steps, ta); }
  verdict(PA.state().cap === 60 && PA.state().stats.down === 0, `  auto at 60 fps with a 600 ms freeze every second: still 60 (${PA.state().stats.down} drops) - a freeze is not a frame rate`);
  // hidden across the gap: away, not a freeze, not in the history
  const n0 = PACE.freezes().n, len0 = PACE.recent().length;
  hide(t + 5); t += 4000; PACE.frame(t); t += 1000 / 60; PACE.frame(t);
  const fz2 = PACE.freezes();
  verdict(fz2.n === n0 && fz2.away === 1 && !PACE.recent().some(x => x > 3000), `  a 4 s gap with the page hidden (a tab away): not a freeze (${fz2.n}), counted away (${fz2.away}), not in the history`);
}
// 10. G990: THE AUTO CAP LATCH. A 60 Hz screen and a main thread bound by the loop, as the roll-out rows read it: each
// rAF runs when the thread frees, stamped with the vsync that last passed (Chrome runs late on the vsync it owes), so a
// 21 ms loop lands ~3 frames in 4 on a 16.7 ms interval and doubles the 4th. `base(t)` ms of loop + `step` ms a solver step.
// `strict` (G1160): a frame starts on the NEXT vsync after the thread frees (a spike misses its refresh: the cockpit's)
function driveVsync(PACE, secs, base, step, seed, strict) {
  const R = 1000 / 60; let busy = PACE.__t || 1000, last = -1, rnd = seed || 0;
  const end = busy + secs * 1000, dts = [], caps = [];
  while (busy < end) {
    let ts = strict ? Math.ceil(busy / R - 1e-9) * R : Math.floor(busy / R) * R; if (ts <= last) ts = last + R;
    const start = Math.max(busy, ts); last = ts;
    const f = PACE.frame(ts);
    if (!f) { busy = start + 0.05; continue; }
    rnd = (rnd * 16807) % 2147483647;
    const jit = seed ? ((rnd / 2147483647) - 0.5) * 6 : 0;
    const n = f.steps, work = Math.max(1, base(ts) + jit) + n * step;
    PACE.end(work, n * step, n, ts, n);
    dts.push(f.dt * 1000); caps.push(PACE.state().cap);
    busy = start + work;
  }
  PACE.__t = busy;
  return { dts, caps, med: med0(dts), at60: caps.filter(c => c === 60).length / caps.length };
}
function med0(a) { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; }
{
  // the latch (G994's rule, G1160's evenness): dropped once (8 s of 30 ms frames), then a 17 ms one-step loop - over 60's
  // 16.7, where G615 never came back, and even at 60 (~59 fps delivered, under 3 % missed): back to 60 and it stays
  const { PACE } = make({});
  driveVsync(PACE, 8, () => 30, 2.5);
  const s0 = PACE.state();
  driveVsync(PACE, 60, () => 14.5, 2.5); const st = PACE.state();
  const tail = driveVsync(PACE, 30, () => 14.5, 2.5);
  verdict(s0.cap === 30 && st.cap === 60 && tail.at60 === 1,
    `the latch: dropped to 30, then a 17 ms one-step loop (even at 60) - back to 60 (cap ${s0.cap} -> ${st.cap}, ${st.stats.up} up), the next 30 s all at 60 (${(st.rateFps || 0).toFixed(1)} fps delivered, work read ${(st.workMs || 0).toFixed(1)} ms)`);
  // THE COCKPIT (G1160): a cheap frame (11 ms) with a spike every 8th frame - a refresh missed in every 9, ~53 fps delivered
  // at 60. G994 kept it (over 52): a 60 that judders every 8 frames. Now it settles at 30, where the spike fits the
  // interval and every frame lands even
  const uneven = d => { let n = 0; for (let i = 1; i < d.length; i++) if (Math.round(d[i] / (1000 / 60)) !== Math.round(d[i - 1] / (1000 / 60))) n++; return n / Math.max(1, d.length - 1); };
  { let k = 0; const spike = () => (++k % 8 === 0 ? 25.5 : 8.5);
    const { PACE: PC } = make({});
    const head = driveVsync(PC, 20, spike, 2.5, 0, true), sc = PC.state();
    const tail = driveVsync(PC, 60, spike, 2.5, 0, true);
    verdict(sc.stats.down >= 1 && tail.at60 < 0.2 && uneven(tail.dts.filter((x, i) => tail.caps[i] === 30)) < 0.05,
      `the cockpit (11 ms, a 28 ms spike every 8th frame: ${(d60 => (1000 * d60.length / d60.reduce((a, b) => a + b, 0)).toFixed(1))(head.dts.filter((x, i) => head.caps[i] === 60))} fps while at 60): settles at 30 (${sc.stats.down} down), ${(100 * tail.at60).toFixed(0)} % of the next 60 s at 60 (the trials), the 30 even (${(100 * uneven(tail.dts.filter((x, i) => tail.caps[i] === 30))).toFixed(0)} % uneven)`); }
  // ...and a rare spike (one frame in 40) is not a judder: it holds 60
  { let k = 0; const rare = () => (++k % 40 === 0 ? 25.5 : 8.5);
    const { PACE: PR } = make({});
    const rr = driveVsync(PR, 60, rare, 2.5, 0, true), sr = PR.state();
    verdict(sr.cap === 60 && sr.stats.down === 0 && rr.at60 === 1, `  a rare spike (1 frame in 40): it holds 60 (${sr.stats.down} down, ${(sr.rateFps || 0).toFixed(1)} fps delivered)`); }
  // the Cub's taxi (21 ms of one-step loop: 60's median holds, but it delivers ~48 fps, 1 and 2 steps alternating): a clean 30
  const { PACE: P1 } = make({});
  driveVsync(P1, 8, () => 30, 2.5);
  const r1 = driveVsync(P1, 120, () => 18.5, 2.5), s1 = P1.state();
  verdict(s1.stats.up <= 6 && r1.at60 < 0.1 && s1.stats.cut >= 1,
    `  the Cub's 21 ms loop (60 would judder at ~48 fps): a clean 30 - ${s1.stats.up} trials in 120 s (<= 6), ${(100 * r1.at60).toFixed(0)} % of the frames at 60 (the trials, ${s1.stats.cut} cut short - G1160; < 10, 16 before)`);
  // a frame that cannot hold 60 (26 ms of one-step loop - the metal Cessna's): the trials back off, it stays at 30
  const { PACE: P2 } = make({});
  const r2 = driveVsync(P2, 120, () => 23.5, 2.5), s2 = P2.state();
  verdict(s2.cap === 30 && s2.stats.up <= 6 && r2.at60 < 0.15 && r2.med > 33,
    `  a frame that cannot hold 60 (26 ms): ${s2.stats.up} trials in 120 s (<= 6, the hold doubling to 30 s), ${(100 * r2.at60).toFixed(0)} % of the frames at 60, median ${r2.med.toFixed(1)} ms`);
  // the edge that swings (the loop 23 +-2 ms over 12 s - a taxi turning through the town's view): each light half
  // holds 60's median, each heavy half does not. A drop within 20 s of an up is a trial that missed - the hold doubles:
  // 10 ups in 5 min where the unguarded rule made 24 (a cap change every 6 s)
  const { PACE: P3 } = make({});
  driveVsync(P3, 300, t => 20.5 + 2 * Math.sin(2 * Math.PI * t / 12000), 2.5, 1); const s3 = P3.state();
  verdict(s3.stats.up <= 12 && s3.stats.trialsFailed >= s3.stats.up - 2,
    `  the edge swinging over 12 s: ${s3.stats.up} ups in 300 s (<= 12; 24 without G990's 20 s rule), ${s3.stats.trialsFailed} counted as missed trials`);
}
// G879.1: the head's look under an uneven frame clock (headCam's block lifted from app.js as written)
{
  const THREE = require(path.join(__dirname, '..', 'vendor', 'three.min.js'));
  const END = '    return headCam.p;\n  };';
  const h0 = src.indexOf('  const headCam = { off: new THREE.Vector3()'), h1 = src.indexOf(END, h0);
  const e0 = src.indexOf('  function easeK(k, dt) {'), e1 = src.indexOf('\n', e0);
  verdict(h0 > 0 && h1 > h0 && e0 > 0, "the head's block (headCam .. update) and easeK found in app.js");
  if (h0 > 0 && h1 > h0 && e0 > 0) {
    const code = src.slice(e0, e1) + '\n' + src.slice(h0, h1 + END.length) + '\nreturn headCam;';
    const clock = { t: 1000 };
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 1000);
    const headCam = new Function('THREE', 'camera', 'performance', 'FL', 'inGarage', 'cam', 'flEyeLoc', 'edEye', 'edSit', code)(
      THREE, camera, { now: () => clock.t }, {}, false, {}, null, null, {});
    // the aeroplane pitched 11 deg nose up (the model frame: x aft, y up, z left; the eye looks down -x), the eye 1 m up
    const M = new THREE.Matrix4().makeRotationZ(-11 * Math.PI / 180).setPosition(0, 2, 0);
    const P = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3(-1, 0, 0), d = new THREE.Vector3();
    headCam.update(P, F, M);
    const pit = [];
    for (let i = 0; i < 40; i++) { clock.t += i % 2 ? 50 : 16.7; headCam.update(P, F, M); camera.getWorldDirection(d); pit.push(Math.asin(d.y) * 180 / Math.PI); }
    const lo = Math.min(...pit), hi = Math.max(...pit);
    verdict(hi - lo < 0.01, "  the look's pitch under alternating 16.7 / 50 ms frames: " + lo.toFixed(3) + ' .. ' + hi.toFixed(3) + ' deg (spread < 0.01)');
    verdict(Math.abs(hi - 0.9 * 11) < 0.3, '  a tenth of the way to level: ' + hi.toFixed(2) + ' deg on an aeroplane at 11 (~9.9)');
  }
}
// G1100 (POSE-SMOOTH): THE DRAWN POSE BETWEEN TWO STEPS. POSE_LERP's block lifted from app.js as written, driven by the
// PACE block above through the loop's step block (app.js: the positions marked before the frame's last 60th of steps,
// taken after them, drawn at PACE.alpha, restored after the render). An aeroplane at 30 m/s along x, 1/60 s a step:
// the drawn x against the frame's wall time must be a straight line (0.75 of a step behind) whatever steps the frames owe;
// the newest step's x (the old draw) is not.
{
  const P0 = '  const POSE_LERP = (() => {', P1 = '    window.FLYDIY_POSE = api;\n    return api;\n  })();';
  const q0 = src.indexOf(P0), q1 = src.indexOf(P1, q0);
  verdict(q0 > 0 && q1 > q0, 'the POSE_LERP block found in app.js');
  if (q0 > 0 && q1 > q0) {
    const plBlock = src.slice(q0, q1 + P1.length);
    const mkLerp = () => new Function('window', plBlock + '\nreturn POSE_LERP;')({});
    const V = 30, STEP = 1 / 60;
    const mkSim = () => { const s = { p: new Float64Array([0, 100, 0, 1, 100, 0]) }; s.step = () => { for (let i = 0; i < s.p.length; i += 3) s.p[i] += V * STEP; }; return s; };
    // one run: `ivs(i)` the i-th frame's interval (ms); returns per frame [wall s, drawn x, newest x] and the restores' check
    function run(pref, ivs, frames, simRate, rig) {
      const { PACE } = make({ pref, rig });
      const POSE = mkLerp(), sim = mkSim();
      let t = 1000, restored = true;
      const rows = [], steps = [];
      for (let i = 0; i < frames; i++) {
        t += ivs(i);
        const pc = PACE.frame(t);
        if (!pc) continue;
        POSE.back();
        const nStep = pc.steps * simRate, kPair = pc.legacy ? -1 : nStep - simRate;
        for (let k = 0; k < nStep; k++) { if (k === kPair) POSE.mark(sim); sim.step(); }
        if (kPair >= 0) POSE.took(sim);
        const newest = sim.p[0], keep = Float64Array.from(sim.p);
        const drawn = POSE.draw(sim, PACE.alpha) ? sim.p[0] : newest;
        POSE.back();
        for (let j = 0; j < keep.length; j++) if (!Object.is(keep[j], sim.p[j])) restored = false;
        rows.push([t / 1000, drawn, newest]); steps.push(pc.steps);
        PACE.end(5, 1, pc.steps, t);
      }
      return { rows: rows.slice(4), steps: steps.slice(4), restored, sim, POSE };
    }
    // the worst departure (mm) of x from a straight line in wall time (least squares)
    function wobble(rows, col) {
      const n = rows.length; let st = 0, sx = 0, stt = 0, stx = 0;
      for (const r of rows) { st += r[0]; sx += r[col]; stt += r[0] * r[0]; stx += r[0] * r[col]; }
      const b = (n * stx - st * sx) / (n * stt - st * st), a = (sx - b * st) / n;
      let w = 0; for (const r of rows) w = Math.max(w, Math.abs(r[col] - (a + b * r[0])));
      return { mm: w * 1000, speed: b };
    }
    const hist = s => { const h = {}; for (const k of s) h[k] = (h[k] || 0) + 1; return Object.keys(h).map(k => k + ':' + h[k]).join(' '); };
    const cases = [
      ['60 Hz, frames alternating 16.7 / 33.3 ms (1 and 2 steps)', { fps: 'off' }, i => (i % 2 ? 2000 / 60 : 1000 / 60), 1],
      ['1 then 3 steps (16.7 / 50 ms)', { fps: 'off' }, i => (i % 2 ? 50 : 1000 / 60), 1],
      ['1 / 2 / 3 steps in turn', { fps: 'off' }, i => [1000 / 60, 2000 / 60, 50][i % 3], 1],
      ['an uneven 45 fps (22.2 ms +- 3 ms)', { fps: 'off' }, i => 1000 / 45 + 3 * Math.sin(i * 1.7), 1],
      ['a 60 Hz screen capped at 30 (2 steps each)', { fps: 30 }, () => 1000 / 60, 1],
      ['2x, 1 and 2 frames of steps (2 and 4 steps)', { fps: 'off' }, i => (i % 2 ? 2000 / 60 : 1000 / 60), 2],
    ];
    for (const [name, pref, ivs, rate] of cases) {
      const r = run(pref, ivs, 400, rate);
      const d = wobble(r.rows, 1), o = wobble(r.rows, 2);
      const want = V * rate;
      verdict(d.mm < 0.5 && Math.abs(d.speed - want) < 0.01 * want && r.restored,
        `${name} [steps ${hist(r.steps)}]: the drawn x ${d.mm.toFixed(3)} mm off a straight line at ${d.speed.toFixed(2)} m/s (< 0.5; the newest step's ${o.mm.toFixed(0)} mm), restored bit for bit`);
    }
    // the drawn pose lies between the last two steps on every frame
    {
      const r = run({ fps: 'off' }, i => (i % 2 ? 2000 / 60 : 1000 / 60), 200, 1);
      const lags = r.rows.map(x => (x[2] - x[1]) / V * 60);   // steps behind the newest
      verdict(lags.every(x => x >= -1e-9 && x <= 1 + 1e-9), `  the drawn pose between the last two steps on every frame (${Math.min(...lags).toFixed(2)} .. ${Math.max(...lags).toFixed(2)} of a step behind the newest)`);
    }
    // the solver's trajectory with the draws and without them: the same bits (nothing drawn is fed back)
    {
      const a = run({ fps: 'off' }, i => [1000 / 60, 2000 / 60, 50][i % 3], 300, 1);
      const { PACE } = make({ pref: { fps: 'off' } }); const s = mkSim(); let t = 1000;
      for (let i = 0; i < 300; i++) { t += [1000 / 60, 2000 / 60, 50][i % 3]; const pc = PACE.frame(t); if (!pc) continue; for (let k = 0; k < pc.steps; k++) s.step(); PACE.end(5, 1, pc.steps, t); }
      verdict(a.sim.p.every((x, j) => Object.is(x, s.p[j])), `  the sim stepped with the draws and without them: the same positions to the bit (x ${a.sim.p[0]} m)`);
    }
    // a rig (the old clock): alpha 1, nothing swapped
    {
      const r = run({ fps: 30 }, () => 1000 / 60, 100, 1, true);
      verdict(r.rows.every(x => Object.is(x[1], x[2])) && r.POSE.state().drawn === 0, `  a rig: nothing drawn between steps (${r.POSE.state().drawn} swaps), the newest step as before`);
    }
    // positions moved outside the step block (a reset, a re-placement): the pair is dropped, the newest drawn
    {
      const { PACE } = make({ pref: { fps: 'off' } }); const POSE = mkLerp(), sim = mkSim(); let t = 1000;
      for (let i = 0; i < 10; i++) { t += 2000 / 60; const pc = PACE.frame(t); POSE.back(); for (let k = 0; k < pc.steps; k++) { if (k === pc.steps - 1) POSE.mark(sim); sim.step(); } POSE.took(sim); POSE.draw(sim, PACE.alpha); POSE.back(); PACE.end(5, 1, pc.steps, t); }
      sim.p[0] = -500; sim.p[3] = -499;   // the reset, between frames
      t += 1000 / 60; PACE.frame(t); POSE.back();
      const drew = POSE.draw(sim, 0.5);
      verdict(!drew && sim.p[0] === -500 && POSE.state().dropped === 1, `  the positions moved outside the steps (a reset): the pair dropped, the aeroplane drawn where it now is (x ${sim.p[0]})`);
    }
  }
}
console.log('GATE PACE: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
