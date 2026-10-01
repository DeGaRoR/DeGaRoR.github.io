// latency_probe_page.js - THE CONTROL-TO-PICTURE CHAIN, TIMED IN THE PAGE (G1165, A5-CAP: the user found the cockpit
// view "a tad more laggy than exterior"). Injected by `tools/rollout_perf.js --latency` before the page's first script;
// it changes nothing the game does - it wraps the Worker constructor (to see the physics worker's traffic), the frame
// clock and the worker link's frame, and listens for key events. Every time below is the PAGE's performance.now()
// timebase, except the worker's DUE moments, which are absolute (timeOrigin + now on the worker) and are converted.
//
// One input (a rudder key through CDP; manual flight) is followed through:
//   key     the keydown's own timeStamp
//   post    the first frame that posts the hand with the rudder moved (sim_link: a 'batch' holding 'hand', dr != 0) -
//           the frame's read of the input (INP.update at the loop's top)
//   due     the worker's state that first carries it (a snapshot whose ctl.dr moved): the moment that step was DUE on
//           the worker's clock - the wait for the next step boundary
//   arrive  that snapshot reaching the page - the step's cost, the publishing, the transfer
//   draw    the first rendered frame whose drawn pose is at or past that state's sim time (sim_view's ring, T - delay)
//   present the picture on the glass: the drawing frame's vsync plus one refresh (an ESTIMATE - the compositor and the
//           scan-out are not observable from the page)
// Without the worker (?simw=0) the chain is the inline loop's: the first frame after the key steps with it, and its pose
// is drawn 0.75 of a step behind (G1100's interpolation) - reported as frame0 + 0.75 step.
// Per frame: the drawn pose's AGE - the frame's vsync less the moment the drawn state was due on the worker's clock -
// what the ring's interpolation delay costs, in ms.
(function () {
  if (window.__LAT) return;
  var L = window.__LAT = { on: false, posts: [], snaps: [], keys: [], frames: [], pf: [], eye: [], curTs: 0, ring0: null };
  var NW = window.Worker;
  if (NW) {
    var Wrap = function (u, o) {
      var w = o === undefined ? new NW(u) : new NW(u, o);
      var pm = w.postMessage;
      w.postMessage = function (m) {
        try {
          if (L.on && m && m.cmd === 'batch' && m.list) for (var i = 0; i < m.list.length; i++) {
            var c = m.list[i]; if (c && c.cmd === 'hand' && c.ctl) { L.posts.push([performance.now(), c.ctl.dr || 0]); break; }
          }
        } catch (e) {}
        return pm.apply(w, arguments);
      };
      // registered here, at construction: it runs before the page's onmessage, so the buffer is still the page's
      w.addEventListener('message', function (e) {
        var m = e.data; if (!L.on || !m || m.kind !== 'snap' || !m.buf) return;
        try { var f = new Float64Array(m.buf); L.snaps.push([performance.now(), f[1], f[2], f[26] > 0 ? f[26] : f[3], m.meta && m.meta.ctl ? (m.meta.ctl.dr || 0) : null]); } catch (e) {}
      });
      return w;
    };
    Wrap.prototype = NW.prototype;
    window.Worker = Wrap;
  }
  addEventListener('keydown', function (e) { if (L.on && !e.repeat) L.keys.push([e.timeStamp, e.code]); }, true);
  // once the game is up: the frame clock's frames (every rendered frame's vsync time) and the link's drawn sim time
  L.hook = function () {
    var P = window.FLYDIY_PACE;
    if (P && !P.__lat) { var pf = P.frame; P.frame = function (ts) { var x = pf.apply(this, arguments); if (L.on && x && typeof ts === 'number') { L.pf.push([ts, x.dt * 1000]); L.curTs = ts; } return x; }; P.__lat = 1;
      // G1166: the eye at the frame's end (the camera as it was drawn), the frame's vsync, the ground speed - eye_judder's
      // judderTs on the rolling frames (> 3 m/s), and the ring's starved frames over the window
      var pe = P.end; P.end = function () { var r = pe.apply(this, arguments);
        if (L.on && L.curTs) { try { var FP = window.FLIGHT_PROBE, c = FP && FP.camera && FP.camera(), sm = FP && FP.sim && FP.sim(), o = sm && sm.out;
          if (c) { var e = c.matrixWorld.elements; L.eye.push([L.curTs, e[12], e[13], e[14], o ? (o.Vg != null ? o.Vg : o.V) : 0]); } } catch (er) {} L.curTs = 0; }
        return r; }; }
    var S = window.FLYDIY_SIMW;
    if (S && S.frame && !S.__lat) { var sf = S.frame; S.frame = function (n, r, ts) { var o = sf.apply(this, arguments); if (L.on && o) L.frames.push([typeof ts === 'number' ? ts : performance.now(), o.drawnT != null ? o.drawnT : null, performance.now()]); return o; }; S.__lat = 1; }
    var SW = window.FLYDIY_SIMW; try { L.ring0 = SW && SW.state ? SW.state().ring : null; } catch (e) {}
    return !!P;
  };
  var first = function (a, ok) { for (var i = 0; i < a.length; i++) if (ok(a[i])) return a[i]; return null; };
  var med = function (a) { var s = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; }); return s.length ? s[s.length >> 1] : null; };
  var pct = function (a, p) { var s = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; }); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
  // the moment (page time) the state at sim time t was due: between the two snapshots that hold t
  var dueAt = function (t) {
    var O = performance.timeOrigin, S = L.snaps;
    for (var i = 1; i < S.length; i++) if (S[i - 1][2] <= t && S[i][2] >= t && S[i][2] > S[i - 1][2]) {
      var a = (t - S[i - 1][2]) / (S[i][2] - S[i - 1][2]); return (S[i - 1][3] + (S[i][3] - S[i - 1][3]) * a) - O;
    }
    return null;
  };
  L.report = function () {
    var O = performance.timeOrigin, rows = [];
    for (var i = 0; i < L.keys.length; i++) {
      var k = L.keys[i][0];
      var f0 = first(L.pf, function (x) { return x[0] >= k; });
      // the picture on the glass: a frame's vsync plus one refresh of its own interval (the estimate, above)
      var iv0 = f0 ? f0[1] : null;
      var r = { key: +k.toFixed(1), frame0: f0 ? +(f0[0] - k).toFixed(1) : null, iv: iv0 != null ? +iv0.toFixed(1) : null,
                present0: f0 ? +(f0[0] + iv0 - k).toFixed(1) : null };
      var p = first(L.posts, function (x) { return x[0] >= k && x[1]; });
      var s = p ? first(L.snaps, function (x) { return x[0] >= p[0] && x[4]; }) : null;
      var f = s ? first(L.frames, function (x) { return x[2] >= s[0] && x[1] != null && x[1] >= s[2] - 1e-6; }) : null;   // processed after it arrived, drawing at or past it
      if (p) r.post = +(p[0] - k).toFixed(1);
      if (s) { r.due = +((s[3] - O) - p[0]).toFixed(1); r.arrive = +(s[0] - (s[3] - O)).toFixed(1); }
      if (f) { var fp = first(L.pf, function (x) { return x[0] >= f[0] - 0.5; }), ivf = fp ? fp[1] : iv0 || 16.7;
        r.draw = +(f[0] + ivf - s[0]).toFixed(1); r.total = +(f[0] + ivf - k).toFixed(1); }
      rows.push(r);
    }
    var ages = [];
    for (var j = 0; j < L.frames.length; j++) { var fr = L.frames[j]; if (fr[1] == null) continue; var d = dueAt(fr[1]); if (d != null) ages.push(fr[0] - d); }
    var ivs = L.pf.map(function (x) { return x[1]; });
    // eye_judder.js's judderTs: the eye's change of velocity frame to frame over the frames' own timestamps, mm over a 60th
    var E = L.eye.filter(function (x) { return x[4] > 3; }), dvY = [], dvXZ = [];
    for (var q = 2; q < E.length; q++) {
      var h1 = E[q - 1][0] - E[q - 2][0], h2 = E[q][0] - E[q - 1][0]; if (!(h1 > 0 && h2 > 0 && h1 < 100 && h2 < 100)) continue;
      var vy = (E[q][2] - E[q - 1][2]) / h2 - (E[q - 1][2] - E[q - 2][2]) / h1;
      var vx = (E[q][1] - E[q - 1][1]) / h2 - (E[q - 1][1] - E[q - 2][1]) / h1, vz = (E[q][3] - E[q - 1][3]) / h2 - (E[q - 1][3] - E[q - 2][3]) / h1;
      dvY.push(vy * 1000 * (1000 / 60)); dvXZ.push(Math.hypot(vx, vz) * 1000 * (1000 / 60));
    }
    var rmsA = function (a) { return a.length ? Math.sqrt(a.reduce(function (s, x) { return s + x * x; }, 0) / a.length) : null; };
    var ring1 = null; try { ring1 = window.FLYDIY_SIMW && FLYDIY_SIMW.state ? FLYDIY_SIMW.state().ring : null; } catch (e) {}
    var starved = ring1 && L.ring0 ? { n: ring1.starved - L.ring0.starved, frames: ring1.frames - L.ring0.frames, q: ring1.q, delayMs: +(ring1.delayS * 1000).toFixed(1) } : (ring1 ? { q: ring1.q, delayMs: +(ring1.delayS * 1000).toFixed(1) } : null);
    if (starved && starved.frames) starved.share = +(starved.n / starved.frames).toFixed(4);
    var judderTs = E.length > 10 ? { frames: E.length, eyeY_mm: { rms: +rmsA(dvY).toFixed(3), max: +Math.max.apply(null, dvY.map(Math.abs)).toFixed(3) },
                                     eyeXZ_mm: { rms: +rmsA(dvXZ).toFixed(3), max: +Math.max.apply(null, dvXZ).toFixed(3) } } : null;
    var col = function (k) { return rows.map(function (r) { return r[k]; }); };
    return { simw: L.snaps.length > 0, inputs: rows.length, frameIvMs: med(ivs),
             hops: { frame0: med(col('frame0')), present0: med(col('present0')), post: med(col('post')), due: med(col('due')), arrive: med(col('arrive')), draw: med(col('draw')), total: med(col('total')), totalP90: pct(col('total'), 0.9) },
             poseAgeMs: { med: med(ages), p90: pct(ages, 0.9), n: ages.length }, judderTs: judderTs, starved: starved, rows: rows };
  };
})();
