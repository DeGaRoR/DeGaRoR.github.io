#!/usr/bin/env node
// _clockbake_check.js - GATE CLOCKBAKE (G2664, SIM-CLOCK-GPU for the GAME COORDINATOR, 2026-10-11): A WAIT RE-SHOOTS THE
// SHED'S ROOM PROBE A SLICE A FRAME, ONCE, AND NEVER SKIPS IT.
//
// WHY. G2660 (the laptop rung, the GPU): every Wait in the garage left ONE 267-384 ms task - the room's probe (a 6-face
// CubeCamera of the whole room + its PMREM) shot in one frame, and SHOT TWICE when the jump crossed a mood band
// (shedDayTick's rebake, then setMood fromClock). G2662 coalesces the clock's two requests into one job and shoots it
// over eight garage frames (a face a frame, the room's PMREM + swap, the outdoors' sky).
// HOW. THE PAGE ITSELF, IN NODE (tools/_page_node.js: dev.html's scripts, three r186 on the recording GL, a virtual clock;
// no GPU). The Cub boots into the garage; after 40 frames of rest each case is a jump and 16 frames, counted per frame
// (the GL's draws, every pass) and through window.FLYDIY_ENV_BAKES / the room's scene.environment.
// THE GATE PROVES IT CAN SEE, FIRST: the HAND's mood pick (GARAGE_ENV.setMood: a preset jump + the one-shot bake every
// other caller keeps) must count a one-shot, and its frame's excess over the rest frame must be at least 3 x the rest
// frame's draws (six faces of the room in one frame) - else the count cannot see a whole bake (FAIL). The clock's cases
// are held against THAT frame, never against themselves:
//   WAIT dusk / night / noon   DAY_CLOCK.wait (each a mood band crossed; noon across midnight): ONE job (jobs +1), eight
//                 slices, NO one-shot from the clock, the room's environment replaced exactly once and only after the
//                 six faces (the old probe on screen until the new one is whole), the job done within ten frames, and no
//                 frame's excess over the rest frame above 40 % of the one-shot frame's (a face a frame is ~1/6 of it).
//   node tools/_clockbake_check.js            (core tier; one page process)
// Rigs have no --help.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };

(async () => {
  const { openPage } = require('./_page_node.js');
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8') };
  const P = await openPage({ quiet: true, storage });
  const W = P.win;
  let cur = null, rows = null;
  const total = d => Object.values(d || {}).reduce((s, x) => s + x, 0);
  const envTex = () => { try { const s = W.FLIGHT_PROBE.hangarScene(); return s && s.environment ? s.environment.uuid : null; } catch (e) { return null; } };
  P.onFrame(ph => {
    if (!rows) return;
    if (ph === 'start') cur = total(P.rec.draws);
    else if (ph === 'end' && cur != null) { const E = W.FLYDIY_ENV_BAKES ? W.FLYDIY_ENV_BAKES() : {}; rows.push({ draws: total(P.rec.draws) - cur, step: E.running, env: envTex() }); cur = null; }
  });
  await P.until(() => W.BOOT && W.BOOT.state === 'gone' && W.DAY_CLOCK && W.FLYDIY_ENV_BAKES && W.GARAGE_ENV, 600000);
  ok(!!(W.FLYDIY_HOLDS && W.FLYDIY_HOLDS().inGarage), 'the Cub boots into the garage');
  await P.frames(40);
  rows = []; await P.frames(20); const R0 = rows; rows = null;
  const d0 = R0.map(r => r.draws).sort((a, b) => a - b), restMed = d0[d0.length >> 1];
  ok(restMed > 0, 'the garage at rest draws', restMed + ' draws a frame');
  const run = async (what, fn) => {
    await P.frames(12);
    const E0 = W.FLYDIY_ENV_BAKES(), env0 = envTex();
    rows = []; const out = fn(); await P.frames(16); const R = rows; rows = null;
    const E1 = W.FLYDIY_ENV_BAKES();
    const swaps = []; let last = env0; R.forEach((r, i) => { if (r.env !== last) { swaps.push(i); last = r.env; } });
    const d = { what, out, jobs: E1.jobs - E0.jobs, slices: E1.slices - E0.slices, oneShot: E1.oneShot - E0.oneShot, requests: E1.requests - E0.requests,
      swaps, worst: Math.max(...R.map(r => r.draws)), draws: R.map(r => r.draws), doneAt: R.findIndex(r => r.step === -1) };
    console.log('  ' + what + ': ' + JSON.stringify({ out: d.out, jobs: d.jobs, slices: d.slices, oneShot: d.oneShot, requests: d.requests, swaps: d.swaps, worst: d.worst, draws: d.draws.join(' ') }));
    return d;
  };
  // THE NEGATIVE CONTROL FIRST: the hand's mood pick keeps the one-shot - its frame is the whole bake the cases are held against
  const neg = await run('HAND mood pick (one-shot)', () => { W.GARAGE_ENV.setMood((W.GARAGE_ENV.mood() + 2) % 5); return 'hand'; });
  const negEx = neg.worst - restMed;
  ok(neg.oneShot >= 1 && negEx >= 3 * restMed, 'SELFTEST: the one-shot bake is seen - counted, and its frame draws a whole bake (excess >= 3 x the rest frame)', 'one-shots ' + neg.oneShot + ', excess ' + negEx + ' vs rest ' + restMed);
  const budget = restMed + 0.4 * negEx;
  for (const t of ['dusk', 'night', 'noon']) {
    const c = await run('WAIT ' + t, () => { const r = W.DAY_CLOCK.wait(t); return r && r.ok ? r.jump.why : 'refused: ' + (r && r.why); });
    ok(/^wait:/.test(c.out), c.what + ': the wait is a jump on the ground', c.out);
    ok(c.jobs === 1 && c.oneShot === 0, c.what + ': ONE sliced job, no one-shot bake from the clock', 'jobs ' + c.jobs + ', one-shots ' + c.oneShot + ', requests ' + c.requests);
    ok(c.slices === 8, c.what + ': eight slices (six faces, the room, the outdoors)', c.slices);
    ok(c.swaps.length === 1 && c.swaps[0] >= 6, c.what + ': the room\'s environment replaced ONCE, after its six faces (the old probe on screen until then)', 'swapped at frame ' + c.swaps.join(','));
    ok(c.doneAt >= 0 && c.doneAt <= 10, c.what + ': the job done within ten frames', c.doneAt);
    ok(c.worst <= budget, c.what + ': no frame draws a whole bake (excess <= 40 % of the one-shot frame\'s)', 'worst ' + c.worst + ' <= ' + Math.round(budget) + ' (rest ' + restMed + ', the one-shot frame ' + neg.worst + ')');
  }
  if (P.errors && P.errors.length) console.log('  (page errors: ' + P.errors.slice(0, 3).join(' | ') + ')');
  console.log(fails ? 'CLOCKBAKE FAIL (' + fails + ')' : 'CLOCKBAKE PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CLOCKBAKE FAIL (threw) ' + (e && e.stack)); process.exit(1); });
