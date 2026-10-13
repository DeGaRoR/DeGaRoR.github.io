#!/usr/bin/env node
// _clockbake_check.js - GATE CLOCKBAKE (G2664, SIM-CLOCK-GPU for the GAME COORDINATOR, 2026-10-11/12): A WAIT RE-SHOOTS THE
// SHED'S ROOM PROBE A SLICE A FRAME, ONCE, AND NEVER SKIPS IT.
//
// WHY. G2660 (the laptop rung, the GPU): every Wait in the garage left ONE 267-384 ms task - the room's probe (a 6-face
// CubeCamera of the whole room + its PMREM) shot in one frame, and SHOT TWICE when the jump crossed a mood band
// (shedDayTick's rebake, then setMood fromClock). G2662 coalesces the clock's two requests into one job and shoots it
// over eight garage frames (a face a frame, the room's PMREM + swap, the outdoors' sky).
// HOW. THE PAGE ITSELF, IN NODE (tools/_page_node.js: dev.html's scripts, three r186 on the recording GL, a virtual clock;
// no GPU). The Cub boots into the garage; each case fires its action INSIDE a frame (a requestAnimationFrame callback,
// so every draw it causes is counted) and records 16 frames: the GL's draws per frame split by pass (main = the
// garage camera's render, shadow = three's shadow pass, other = everything else: the cube faces, PMREM, the skies),
// window.FLYDIY_ENV_BAKES and the room's scene.environment.
//   WAIT dusk / night / noon  DAY_CLOCK.wait (each a mood band crossed; noon across midnight): ONE job, eight slices, NO
//                 one-shot from the clock, the room's environment replaced exactly once and only after its six faces
//                 (the old probe on screen until the new one is whole), the job done within ten frames.
// THE CONTROL IS THE OLD PATH ITSELF (window.FLYDIY_CLOCKSLICE = false: a one-shot per request, what shipped in 44.1):
// the same three waits must count two one-shots each (the rebake and the mood) and NO job, and their worst frame's
// OTHER-pass draws must exceed the fixed path's by at least 6 x one face's (a whole bake leaves the frame with the fix)
// - else the count cannot see the bake (FAIL). The jump frame's draws by pass are printed for both paths.
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
  const snap = () => Object.assign({ main: 0, shadow: 0, other: 0 }, P.rec.draws);
  const envTex = () => { try { const s = W.FLIGHT_PROBE.hangarScene(); return s && s.environment ? s.environment.uuid : null; } catch (e) { return null; } };
  P.onFrame(ph => {
    if (!rows) return;
    if (ph === 'start') cur = snap();
    else if (ph === 'end' && cur) { const s = snap(), E = W.FLYDIY_ENV_BAKES ? W.FLYDIY_ENV_BAKES() : {};
      const d = { main: s.main - cur.main, shadow: s.shadow - cur.shadow, other: s.other - cur.other };
      rows.push({ draws: d.main + d.shadow + d.other, by: d, step: E.running, env: envTex() }); cur = null; }
  });
  await P.until(() => W.BOOT && W.BOOT.state === 'gone' && W.DAY_CLOCK && W.FLYDIY_ENV_BAKES && W.FLIGHT_PROBE, 600000);
  ok(!!(W.FLYDIY_HOLDS && W.FLYDIY_HOLDS().inGarage), 'the Cub boots into the garage');
  // the pass labels: the garage camera's render = main, three's shadow pass = shadow, the rest (cube faces, PMREM) = other
  const R = W.FLIGHT_PROBE.renderer(), gcam = () => W.FLIGHT_PROBE.camera();
  const rr = R.render; R.render = function (sc, cam) { const prev = P.rec.phase; P.rec.phase = cam === gcam() && prev !== 'shadow' ? 'main' : (prev === 'shadow' ? 'shadow' : 'other'); try { return rr.apply(this, arguments); } finally { P.rec.phase = prev; } };
  const SM = R.shadowMap; if (SM && SM.render) { const sr = SM.render; SM.render = function () { const prev = P.rec.phase; P.rec.phase = 'shadow'; try { return sr.apply(this, arguments); } finally { P.rec.phase = prev; } }; }
  await P.frames(40);
  rows = []; await P.frames(20); const R0 = rows; rows = null;
  const d0 = R0.map(r => r.draws).sort((a, b) => a - b), restMed = d0[d0.length >> 1];
  const s0 = R0.map(r => r.by.shadow).sort((a, b) => a - b), restShadow = s0[s0.length >> 1];
  ok(restMed > 0, 'the garage at rest draws', restMed + ' draws a frame');
  const run = async (what, fn) => {
    await P.frames(12);
    const E0 = W.FLYDIY_ENV_BAKES(), env0 = envTex();
    let out = null; W.requestAnimationFrame(() => { out = fn(); });   // the action inside a counted frame
    rows = []; await P.frames(16); const Rr = rows; rows = null;
    const E1 = W.FLYDIY_ENV_BAKES();
    const swaps = []; let last = env0; Rr.forEach((r, i) => { if (r.env !== last) { swaps.push(i); last = r.env; } });
    const wi = Rr.reduce((b, r, i) => r.draws > Rr[b].draws ? i : b, 0);
    const d = { what, out, jobs: E1.jobs - E0.jobs, slices: E1.slices - E0.slices, oneShot: E1.oneShot - E0.oneShot, requests: E1.requests - E0.requests,
      steps: Rr.map(r => r.step), swaps, worst: Rr[wi].draws, worstBy: Rr[wi].by, otherMax: Math.max(...Rr.map(r => r.by.other)), draws: Rr.map(r => r.draws), others: Rr.map(r => r.by.other), shadows: Rr.map(r => r.by.shadow),
      // done = the frame after the job's LAST running frame (-1: it never ran)
      doneAt: (k => k < 0 ? -1 : k + 1)(Rr.map(r => r.step >= 0).lastIndexOf(true)) };
    console.log('  ' + what + ': ' + JSON.stringify({ out: d.out, jobs: d.jobs, slices: d.slices, oneShot: d.oneShot, requests: d.requests, swaps: d.swaps, worst: d.worst, worstBy: d.worstBy, other: d.others.join(' '), shadow: d.shadows.join(' ') }));
    return d;
  };
  const wait = t => () => { const r = W.DAY_CLOCK.wait(t); return r && r.ok ? r.jump.why : 'refused: ' + (r && r.why); };
  const fixed = [];
  for (const t of ['dusk', 'night', 'noon']) fixed.push(await run('WAIT ' + t + ' (sliced)', wait(t)));
  W.FLYDIY_CLOCKSLICE = false;
  const old = [];
  for (const t of ['dusk', 'night', 'noon']) old.push(await run('WAIT ' + t + ' (the old one-shot path)', wait(t)));
  W.FLYDIY_CLOCKSLICE = true;
  // one face: the median other-pass draws of the sliced jobs' face frames (frames 1-5 carry a face each)
  const faces = fixed.flatMap(c => c.others.slice(1, 6)).sort((a, b) => a - b), face = Math.max(1, faces[faces.length >> 1]);
  ok(old.every(c => c.oneShot >= 2 && c.jobs === 0), 'CONTROL: the old path counts two one-shots per mood-crossing wait (the rebake and the mood) and no job', old.map(c => c.oneShot + '/' + c.jobs).join(' '));
  for (let i = 0; i < fixed.length; i++) {
    const c = fixed[i], o = old[i];
    ok(/^wait:/.test(c.out), c.what + ': the wait is a jump on the ground', c.out);
    ok(c.jobs === 1 && c.oneShot === 0, c.what + ': ONE sliced job, no one-shot bake from the clock', 'jobs ' + c.jobs + ', one-shots ' + c.oneShot + ', requests ' + c.requests);
    ok(c.slices === 8, c.what + ': eight slices (six faces, the room, the outdoors)', c.slices);
    ok(c.swaps.length === 1 && c.swaps[0] >= 6, c.what + ': the room\'s environment replaced ONCE, after its six faces (the old probe on screen until then)', 'swapped at frame ' + c.swaps.join(','));
    ok(c.doneAt >= 7 && c.doneAt <= 11, c.what + ': the job ran over its eight frames and was done within eleven', 'done at frame ' + c.doneAt);
    ok(o.otherMax - c.otherMax >= 6 * face, c.what + ': a whole bake left the jump frame (the old path\'s worst other-pass frame exceeds the fix\'s by >= 6 faces)', 'old ' + o.otherMax + ' vs fixed ' + c.otherMax + ', one face ' + face);
  }
  if (P.errors && P.errors.length) console.log('  (page errors: ' + P.errors.slice(0, 3).join(' | ') + ')');
  console.log(fails ? 'GATE CLOCKBAKE: FAIL (' + fails + ')' : 'GATE CLOCKBAKE: PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('GATE CLOCKBAKE: FAIL (threw) ' + (e && e.stack)); process.exit(1); });
