// treesnear_lowpass.js - A LOW PASS OVER THE FOREST, FOR rollout_perf (G1110, TREES-NEAR). A --pre script:
//   node tools/rollout_perf.js --pre @tools/perf/treesnear_lowpass.js --q 'lowagl=60&lowv=55&lowat=8' ...
// `lowat` s after the roll-out screen goes the flight is PAUSED (the pause button: every clock still, the world, the
// streamers and the render running) and the aeroplane is carried along a straight track at `lowv` m/s, `lowagl` m over
// the ground under it, by FLIGHT_PROBE.place (the worker's own placement; sim().p where there is none) - the pass the
// user asked about ("when the plane flies low above the trees") with the eye, the partition and the fill streaming as
// in flight and the solver out of the frame. The track runs along the aeroplane's nose from the start point within
// 4 km of the stand whose 3 km line is the most TREE ground (the tree map, 100 m steps). rollout_perf reads every
// frame over 4 m AGL as 'air'. window.__LOWPASS says where it went (start, heading, forest share, metres flown).
(function () {
  var Q = new URLSearchParams(location.search);
  if (!Q.get('lowagl')) return;
  var AGL = +Q.get('lowagl'), V = +(Q.get('lowv') || 55), AT = +(Q.get('lowat') || 8), L = 3000;
  var S = window.__LOWPASS = { agl: AGL, v: V, state: 'wait' };
  function go() {
    var w = FLIGHT_PROBE.world(), s = FLIGHT_PROBE.sim(), cg = s.cgPos(), ax = s.axes()[0];
    var fx = -ax[0], fz = -ax[2], n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;   // the nose: axes()[0] is xAft
    var I = w.island, best = null, bf = -1;
    for (var gz = -4000; gz <= 4000; gz += 250) for (var gx = -4000; gx <= 4000; gx += 250) {
      var x0 = cg[0] + gx, z0 = cg[2] + gz, f = 0, k = 0;
      for (var t = 0; t <= L; t += 100, k++) { var x = x0 + fx * t, z = z0 + fz * t;
        if (I ? I.effClass(x, z) === I.WC.TREE : w.surface && w.surface(x, z) === w.SURFACE.FOREST_FLOOR) f++; }
      if (f / k > bf) { bf = f / k; best = [x0, z0]; }
    }
    S.start = [best[0] | 0, best[1] | 0]; S.hdg = +(Math.atan2(fz, fx) * 57.3).toFixed(1); S.forest = +bf.toFixed(2);
    var b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
    var t0 = performance.now(), pend = false; S.state = 'flying'; S.flown = 0;
    function step(now) {
      var d = Math.min(L, V * (now - t0) / 1000), x = best[0] + fx * d, z = best[1] + fz * d, y = w.terrainH(x, z) + AGL;
      S.flown = d | 0;
      if (!pend) {
        if (FLIGHT_PROBE.place) { pend = true; Promise.resolve(FLIGHT_PROBE.place({ at: [x, y, z], zeroV: true })).then(function () { pend = false; }, function () { pend = false; }); }
        else { var c = s.cgPos(); for (var i = 0; i < s.n; i++) { s.p[i * 3] += x - c[0]; s.p[i * 3 + 1] += y - c[1]; s.p[i * 3 + 2] += z - c[2]; s.v[i * 3] = s.v[i * 3 + 1] = s.v[i * 3 + 2] = 0; } }
      }
      if (d < L) requestAnimationFrame(step); else S.state = 'done';
    }
    requestAnimationFrame(step);
  }
  var gone = null;
  (function wait() {
    var ok = window.FLIGHT_PROBE && FLIGHT_PROBE.sim && FLIGHT_PROBE.sim() && window.BOOT && BOOT.state === 'gone';
    if (ok && gone === null) gone = performance.now();
    if (ok && performance.now() - gone > AT * 1000) { try { go(); } catch (e) { S.state = 'error ' + e.message; } return; }
    setTimeout(wait, 250);
  })();
})();
