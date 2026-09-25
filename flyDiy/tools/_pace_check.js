#!/usr/bin/env node
// GATE PACE (G586) - the frame clock (src/viewer/app.js PACE): the game's time on the wall clock, the frame
// capped at auto / 60 / 30 / off. The block is lifted out of app.js as written and driven with synthetic
// display refreshes (rAF timestamps), so what is proven is the code that ships:
//   - a 60 Hz screen capped at 30 renders every 2nd refresh, 2 solver steps each - exactly, every frame;
//     capped at 60 every refresh, 1 step each;
//   - a 144 Hz screen, capped at 60 or uncapped: the sim time kept equal to the wall time (to a frame);
//   - a slow frame owes its steps (50 ms -> 3), a stall owes at most 4 and forgets the rest;
//   - AUTO: frames over 18.5 ms drop it to 30 after two readings; at 30 a light frame earns a trial of 60;
//     a trial that misses goes back to 30 and holds the next trial off (20 s, doubling); a trial that
//     holds stays at 60; the auto render scale is told the budget each time;
//   - a RIG (webdriver / headless) and a call with no timestamp keep the old clock: 1 step of 1/60, uncapped.
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
  const window = {
    navigator: { webdriver: !!opts.rig, userAgent: opts.rig ? 'HeadlessChrome' : 'Chrome' },
    location: { search: opts.search || '' },
    localStorage: { getItem: k => (k in store ? store[k] : null) },
    FLYDIY_AA: { autoTarget: ms => targets.push(ms), autoState: () => ({ on: true, probing: false }) },
  };
  const performance = { now: () => 0 };
  const PACE = new Function('window', 'performance', block + '\nreturn PACE;')(window, performance);
  return { PACE, targets };
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
console.log('GATE PACE: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
