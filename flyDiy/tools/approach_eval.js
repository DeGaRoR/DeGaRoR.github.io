// approach_eval.js - A DESCENT OVER THE GRASS, FOR rollout_perf --eval (A2-FADES G671, 2026-09-27)
//
//   node tools/rollout_perf.js --secs 10 --eval @tools/approach_eval.js [--page index_before.html] ...
//
// The playtest's "grass too late on approach": the cover ring was dropped over 150 m AGL and planted from
// nothing on the way down. This carries the paused aeroplane (every node shifted each frame, velocities
// zeroed: the camera and the streamers follow it as in flight) down a straight slope onto the stand it
// rolled out at - from 2.25 km out and 320 m over the ground, 50 m/s, 45 s - and records, every frame, the
// frame time and the ring's state. The verdicts: how much of the ring was still to plant when its height term
// OPENED (aglK > 0.05, ~146 m) and when it was WHOLE (60 m), and what the frames cost on the way.
// An expression: rollout_perf awaits it and prints the JSON.
(async () => {
  const P = window.FLIGHT_PROBE, s = P.sim(), w = P.world(), ring = window.TREE_FILL && TREE_FILL.cover && TREE_FILL.cover();
  if (!ring) return { error: 'no cover ring' };
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  const cg0 = s.cgPos(), v0 = s.cgVel();
  let hx = v0[0], hz = v0[2]; { const l = Math.hypot(hx, hz); if (l > 0.5) { hx /= l; hz /= l; } else { hx = 1; hz = 0; } }
  const D = 2250, V = 50, T = D / V, A0 = 320, A1 = 12;
  const at = t => { const k = Math.min(1, t / T), x = cg0[0] - hx * D * (1 - k), z = cg0[2] - hz * D * (1 - k);
    return [x, w.terrainH(x, z) + A0 + (A1 - A0) * k, z]; };
  // G1096: the CG put at p on the sim that flies (FLIGHT_PROBE.place: under the physics worker the page's sim is a view)
  const place = p => P.place({ at: p, zeroV: true });
  await place(at(0));
  await new Promise(r => setTimeout(r, 2000));   // the eye settles at the start (and the ring drops what it held at the stand)
  const rows = [], t0 = performance.now();
  let last = t0, open = null, whole = null;
  await new Promise(done => {
    const tick = () => {
      const now = performance.now(), t = (now - t0) / 1000;
      place(at(t));
      const st = ring.stat();
      const row = { t: +t.toFixed(2), dt: +(now - last).toFixed(1), agl: Math.round(st.agl), k: +(+st.aglK || 0).toFixed(3), live: st.live, q: st.queued, pm: st.plantMs != null ? +st.plantMs.toFixed(2) : null, inst: st.instances };
      last = now; rows.push(row);
      if (!open && row.k > 0.05) open = row;
      if (!whole && row.k >= 0.999) whole = row;
      if (t < T + 3) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  const dts = rows.map(r => r.dt).sort((a, b) => a - b), q = f => dts[Math.min(dts.length - 1, Math.floor(dts.length * f))];
  const pm = rows.filter(r => r.pm != null).map(r => r.pm);
  const band = (lo, hi) => { const R = rows.filter(r => r.agl <= hi && r.agl > lo); const d = R.map(r => r.dt).sort((a, b) => a - b);
    return { frames: R.length, dtMed: d[d.length >> 1] || 0, dtP90: d[Math.floor(d.length * 0.9)] || 0, pm: R.filter(r => r.pm != null).reduce((a, r) => a + r.pm, 0) / Math.max(1, R.length) }; };
  return { secs: T, frames: rows.length, dtMed: q(0.5), dtP90: q(0.9), dtMax: dts[dts.length - 1],
           plantMsMean: pm.length ? +(pm.reduce((a, b) => a + b, 0) / pm.length).toFixed(2) : null,
           above260: band(260, 1e4), from260to150: band(150, 260), from150to60: band(60, 150), below60: band(-1, 60),
           open, whole, end: rows[rows.length - 1],
           trace: rows.filter((r, i) => i % 15 === 0).map(r => [r.t, r.agl, r.k, r.live, r.q, r.inst]) };
})()
