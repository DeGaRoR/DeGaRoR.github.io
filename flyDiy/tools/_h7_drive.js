// _h7_drive.js - the H7 field's rig driver (loaded by a shot's js through a script tag): the field
// pinned at CG (a spot of open sea off the beach), a ring splash on demand, a pressed track at 8 m/s
window.__h7 = (() => { const cg = [2680, 0, 0]; WATER.fieldOn(true);
  const st = { t: 0, ring: 0, wake: 0, probes: [], cg };
  window.__h7tick = () => { st.t += 1 / 60;
    if (st.ring === 1) { WATER.stamp(cg[0], cg[2], 1.6, -0.6, 0.9, 'ring'); st.ring = 2; st.ringT = st.t; }
    if (st.wake > 0) { const s = st.t - st.wake; if (s < 6) { const x = cg[0] - 30 + 8 * s, z = cg[2] + 6; WATER.stamp(x, z, 0.8, -0.15, 0.4, 'press'); } }
    WATER.fieldStep(THREE, window.FLYDIY_RENDERER, cg[0], cg[2], 1 / 60); };
  const raf = () => { window.__h7tick(); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  return st; })();
