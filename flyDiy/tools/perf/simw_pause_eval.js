// simw_pause_eval.js - THE PLAYER'S HOLDS UNDER THE PHYSICS WORKER, IN A REAL BROWSER (G1096, SIMW-BENCH 2026-09-30)
//
//   node tools/rollout_perf.js --secs 30 --q simw=1 --eval @tools/perf/simw_pause_eval.js   (and --q simw=0)
//
// A headed rollout_perf page flies on the WORKER'S real-time clock (the rig clock is lockstep: headless only). After the
// recording window this: (1) PAUSE - clicks the pause button, lets the click's frame land (300 ms), reads the CG, the
// sim time and the worker's step, waits 5 s, reads them again; resumes. (2) THE SETTINGS SCREEN's hold - a graphics
// pick made the way the menu makes it (GFX.set + FLYDIY_SETTLE: the flight held while the screen is up), read at the
// click and when the screen is gone; the steps flown across it must be the few frames before the hold took. (3) A RIG'S
// PLACEMENT (FLIGHT_PROBE.place) under the pause: the CG where it was asked, and still there 2 s later.
// An expression: rollout_perf awaits it and prints the JSON.
(async () => {
  const P = window.FLIGHT_PROBE, s = P.sim(), b = document.getElementById('bPause'), SW = window.FLYDIY_SIMW || null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const read = () => ({ cg: s.cgPos(), t: s.t, step: SW ? SW.state().lastStep : null, phase: P.ap().phase });
  const d3 = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
  const out = { worker: SW ? SW.state().phase : 'inline (?simw=0)' };
  // (1) the pause button
  if (/pause/i.test(b.textContent)) b.click();
  await wait(300);
  const a0 = read(); await wait(5000); const a1 = read();
  out.pause = { phase: a0.phase, cgMovedM: d3(a0.cg, a1.cg), dtS: a1.t - a0.t, dStep: a1.step != null ? a1.step - a0.step : null, speed: Math.hypot(...s.cgVel()) };
  b.click();   // run
  await wait(3000);
  // (2) the settings screen's hold: shadows off and back on (each re-keys the lit programs: the screen comes up)
  const setting = async (k, v) => {
    const r0 = read(), t0 = performance.now();
    GFX.set(k, v); if (typeof FLYDIY_SETTLE === 'function') FLYDIY_SETTLE(k);
    let shown = false;
    for (let i = 0; i < 400; i++) { await wait(50); const st = window.BOOT && BOOT.state; if (st && st !== 'gone') shown = true; if (shown && st === 'gone') break; if (!shown && i > 40) break; }
    const r1 = read();
    return { change: k + '=' + v, screen: shown, screenS: (performance.now() - t0) / 1000, dtS: r1.t - r0.t, cgMovedM: d3(r0.cg, r1.cg) };
  };
  out.settings = [await setting('shadows', 'off')];
  await wait(2000);
  out.settings.push(await setting('shadows', 'full'));
  await wait(2000);
  // (3) a rig's placement under the pause: 40 m over the ground 300 m east of where it stands
  if (/pause/i.test(b.textContent)) b.click();
  await wait(300);
  const c0 = s.cgPos(), w = P.world(), X = c0[0] + 300, Z = c0[2], Y = w.terrainH(X, Z) + 40;
  const got = await P.place({ at: [X, Y, Z], zeroV: true });
  const p0 = read(); await wait(2000); const p1 = read();
  out.place = { asked: [X, Y, Z].map(v => +v.toFixed(3)), answered: got && got.map(v => +v.toFixed(3)), offM: d3(p0.cg, [X, Y, Z]), after2sMovedM: d3(p0.cg, p1.cg), speed: Math.hypot(...s.cgVel()) };
  return out;
})()
