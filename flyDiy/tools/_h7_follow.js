// _h7_follow.js - the rig's eye on the floatplane (loaded by a shot's js): the free camera set every frame
// from the CG - __follow('top', h) straight down from h m, __follow('low', d, h) a low eye d m off the
// track looking at the hull, __follow(null) hands the eye back to the rig's numbers; __thr(v) holds the throttle
window.__followMode = null;
window.__follow = (mode, a, b) => { window.__followMode = mode ? { mode, a, b } : null; };
window.__thrV = null; window.__thr = v => { window.__thrV = v; };
(function tick() {
  const m = window.__followMode, s = window.FLIGHT_PROBE && FLIGHT_PROBE.sim && FLIGHT_PROBE.sim();
  if (s && window.__thrV != null) s.ctl.thr = window.__thrV;
  if (m && s && window.DEV_CAM) {
    const c = s.cgPos(), [xA] = s.axes();
    if (m.mode === 'top') { DEV_CAM.pos.set(c[0], c[1] + (m.a || 50), c[2]); DEV_CAM.pitch = -1.55; DEV_CAM.yaw = Math.atan2(xA[0], -xA[2]); }
    else { // low: d m abeam (to the hull's left) and a little astern, h m up, looking at the CG
      const d = m.a || 20, h = m.b || 3, lx = -xA[2], lz = xA[0];
      const ex = c[0] + lx * d - xA[0] * d * 0.6, ez = c[2] + lz * d - xA[2] * d * 0.6;
      DEV_CAM.pos.set(ex, h, ez);
      const dx = c[0] - ex, dz = c[2] - ez, dy = c[1] - h;
      DEV_CAM.yaw = Math.atan2(dx, -dz); DEV_CAM.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    }
  }
  requestAnimationFrame(tick);
})();
// __catchSplash(afterS): unpause, wait for the first float to go wet, let afterS of SIM time pass, pause -
// the splash frozen for the rig's screenshot (the headless page runs the sim slower than the clock)
window.__catchSplash = (afterS) => {
  const b = document.getElementById('bPause'); if (b && !/pause/i.test(b.textContent)) b.click();
  let tWet = -1;
  const poll = setInterval(() => {
    const s = FLIGHT_PROBE.sim(); if (!s.hydro) return;
    const wet = s.hydro.floats.some(f => f.wet > 0);
    if (wet && tWet < 0) tWet = s.t;
    if (tWet >= 0 && s.t - tWet >= (afterS || 0.3)) { clearInterval(poll); const b2 = document.getElementById('bPause'); if (b2 && /pause/i.test(b2.textContent)) b2.click(); }
  }, 30);
};
// __hold(thr): the throttle held AND the heading held with the rudder (a floatplane under power turns on
// its own - p-factor, torque, the water rudder); the rudder's sign is found in the first 1.5 s (a probe
// deflection, the yaw rate read), then a P loop on the heading error keeps the run straight for the Kelvin V
window.__hold = (thr) => {
  const s = FLIGHT_PROBE.sim(); const hdgOf = () => { const [xA] = s.axes(); return Math.atan2(-xA[2], -xA[0]); };
  const H = { hdg0: hdgOf(), t0: s.t, sign: 0, probe: 0.4 };
  window.__thrV = null;
  const tick = () => {
    const hdg = hdgOf(); let err = hdg - H.hdg0; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    s.ctl.thr = thr;
    // (sign: a nose-left pedal is dr > 0 in 32_hydro; the heading here grows nose-right, so a positive error asks for dr > 0)
    s.ctl.dr = Math.max(-0.5, Math.min(0.5, (window.__holdSign || 1) * 1.5 * err));
    requestAnimationFrame(tick);
  };
  tick();
};
// __tow(vx, vz): the hull TOWED at a set velocity - every frame a third of the CG's velocity error is added
// to every point (a straight run for the Kelvin V, the engine and the rudder out of it)
window.__tow = (vx, vz) => { window.__towV = [vx, vz]; window.__thrV = 0;
  const tick = () => { const s = FLIGHT_PROBE.sim(), t = window.__towV; if (!t) return;
    const v = s.cgVel(); const dx = (t[0] - v[0]) * 0.3, dz = (t[1] - v[2]) * 0.3;
    for (let i = 0; i < s.n; i++) { s.v[i * 3] += dx; s.v[i * 3 + 2] += dz; }
    requestAnimationFrame(tick); }; tick(); };
