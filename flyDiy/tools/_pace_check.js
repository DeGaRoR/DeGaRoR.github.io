#!/usr/bin/env node
// GATE PACE (G586) - the frame clock (src/viewer/app.js PACE): the game's time on the wall clock, the frame
// capped at auto / 60 / 30 / off. The block is lifted out of app.js as written and driven with synthetic
// display refreshes (rAF timestamps), so what is proven is the code that ships:
//   - a 60 Hz screen capped at 30 renders every 2nd refresh, 2 solver steps each - exactly, every frame;
//     capped at 60 every refresh, 1 step each;
//   - a 144 Hz screen, capped at 60 or uncapped: the sim time kept equal to the wall time (to a frame);
//   - a slow frame owes its steps (50 ms -> 3), a stall owes at most 4 and forgets the rest;
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
//   - G990: THE AUTO CAP LATCH: on a 60 Hz vsync with the main thread bound by a 21 ms loop (the A-END Cub's taxi: rAF
//     runs late on the vsync it owes, 60's median holds), a drop to 30 comes back to 60 - the trial is the judge, not the
//     one-step work (G615 waited for it under 16.7 ms: never); a frame that cannot hold 60 keeps backing off; a load
//     swinging across the edge does not flap (a drop within 20 s of an up is a missed trial).
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
// 4. a slow frame owes its steps; a stall owes at most 4 and forgets the rest
{
  const { PACE } = make({ pref: { fps: 'off' } });
  PACE.frame(1000);
  const f1 = PACE.frame(1050);
  const n1 = f1.steps;
  const f2 = PACE.frame(1050 + 900);
  const n2 = f2.steps;
  const f3 = PACE.frame(1050 + 900 + 1000 / 60);
  verdict(n1 === 3 && n2 === 4 && f3.steps === 1, `a 50 ms frame owes ${n1} steps (3), a 900 ms stall ${n2} (4, the rest forgotten), the next 60th ${f3.steps} (1)`);
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
function driveVsync(PACE, secs, base, step, seed) {
  const R = 1000 / 60; let busy = PACE.__t || 1000, last = -1, rnd = seed || 0;
  const end = busy + secs * 1000, dts = [], caps = [];
  while (busy < end) {
    let ts = Math.floor(busy / R) * R; if (ts <= last) ts = last + R;
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
  // the A-END taxi: dropped once (8 s of 30 ms frames), then the Cub's frame - 18.5 ms of loop + 2.5 ms a step, the
  // one-step work 21 ms (never under 60's 16.7: the G615 latch held it at 30 for good)
  const { PACE } = make({});
  driveVsync(PACE, 8, () => 30, 2.5);
  const s0 = PACE.state();
  const r = driveVsync(PACE, 60, () => 18.5, 2.5), st = PACE.state();
  const tail = driveVsync(PACE, 30, () => 18.5, 2.5);
  verdict(s0.cap === 30 && st.cap === 60 && tail.at60 === 1 && tail.med < 17,
    `the latch: dropped to 30, then a 21 ms one-step loop that lands 60's median - back to 60 (cap ${s0.cap} -> ${st.cap}, ${st.stats.up} up), the next 30 s all at 60, median frame ${tail.med.toFixed(1)} ms (work read ${(st.workMs || 0).toFixed(1)} ms)`);
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
console.log('GATE PACE: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
