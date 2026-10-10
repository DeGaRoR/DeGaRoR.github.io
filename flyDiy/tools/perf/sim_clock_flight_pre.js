// sim_clock_flight_pre.js - G2662 SIM-CLOCK-GPU: rollout_perf's --pre for the flight ABAB (the rate from ?scrate=N).
// No clock set (flydiy.day.v3 removed: the game day, 16:00, rate 1 in the garage); at THE LIFT (the roll-out screen gone,
// out of the garage) DAY_CLOCK.rate(N) - 60: the sun visibly moving, 0: frozen - the same one call on both sides. From
// there it counts the programs linked, the atmosphere LUT re-bakes (ATMO.lut()'s table replaced: bakeT / bakeMS allocate
// a new one), the world probe's bakes and the eased light's applies / writes; sim_clock_flight_eval.js reads them.
try { localStorage.removeItem('flydiy.day.v3'); } catch (e) {}
(function () {
  if (window.__SCF) return;
  var m = /[?&]scrate=([0-9]+)/.exec(location.search);
  var S = window.__SCF = { rate: m ? +m[1] : null, set: false, lut: 0, lutT: null };
  setInterval(function () {
    try {
      if (typeof ATMO !== 'undefined' && ATMO.lut) { var T = ATMO.lut().T; if (T && T !== S.lutT) { if (S.lutT) S.lut++; S.lutT = T; } }
      if (S.set || S.rate == null || !window.BOOT || BOOT.state !== 'gone' || !window.FLYDIY_HOLDS || !window.DAY_CLOCK || !window.FLIGHT_PROBE) return;
      var h = FLYDIY_HOLDS(); if (h.inGarage || h.rollHold) return;
      var R = FLIGHT_PROBE.renderer(), d = FLIGHT_PROBE.world().day, LE = window.LIGHT_EASE;
      S.p0 = R.info.programs ? R.info.programs.length : -1; S.lut0 = S.lut;
      S.pb0 = (window.WORLD && WORLD.probeState && WORLD.probeState()) ? WORLD.probeState().bakes : null;
      S.le0 = LE ? [LE.applies, LE.writes] : null; S.el0 = d.sunEl; S.h0 = d.localSeconds / 3600; S.v0 = d.version;
      S.at = performance.now(); S.set = true; S.rateOut = DAY_CLOCK.rate(S.rate); S.v1 = d.version;
    } catch (e) { S.err = String(e && e.message || e); }
  }, 100);
})();
