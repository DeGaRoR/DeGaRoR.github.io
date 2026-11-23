(async () => {
 const result = { scope: 'Passive graphics-error stress: unchanged saved-night departure, then noon departure. Diagnostic only; no loading or FPS acceptance.', trips: [] };
 window.__PERF_MIST_SCUFF_DIAGNOSTIC = result;
 const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
 const check = () => { if (__GROUND_BENCH.glTrace.length) throw Error('Passive invalid graphics query captured'); };
 for (const preset of ['saved', 'noon']) {
  if (preset === 'noon') { DAY_CLOCK.preset('noon'); DAY_CLOCK.set({ rate: 0 }); }
  const trip = { preset, start: performance.now(), linksBefore: __GROUND_BENCH.programs.length };
  result.trips.push(trip);
  document.getElementById('bGo').click();
  let previous = -1, ready = false;
  const deadline = performance.now() + 110000;
  while (performance.now() < deadline) {
   check();
   const t = FLIGHT_PROBE.sim().t;
   if (document.body.classList.contains('mode-fly') && !document.body.classList.contains('rollShot') && BOOT.state === 'gone' && !BOOT.busy() && previous >= 0 && t > previous) { ready = true; break; }
   previous = t;
   await sleep(250);
  }
  if (!ready) throw Error('Native departure diagnostic deadline');
  trip.worldAt = performance.now(); trip.linksAfter = __GROUND_BENCH.programs.length;
  trip.glError = FLYDIY_RENDERER.getContext().getError();
  check();
  FLYDIY_MENU.act('shed');
  let returned = false;
  for (let i = 0; i < 160; i++) { check(); if (document.body.classList.contains('mode-ws') && BOOT.state === 'gone' && !BOOT.busy()) { returned = true; break; } await sleep(250); }
  if (!returned) throw Error('Diagnostic garage return deadline');
  trip.returnAt = performance.now();
 }
 result.passive = { queryNulls: __GROUND_BENCH.passiveGL.queryNulls, uniformShapes: __GROUND_BENCH.passiveGL.uniformShapes };
 return result;
})()
