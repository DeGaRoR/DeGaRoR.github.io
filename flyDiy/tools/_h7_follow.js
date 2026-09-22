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
