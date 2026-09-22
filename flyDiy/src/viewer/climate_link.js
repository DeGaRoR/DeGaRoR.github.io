// ============================================================
// THE CLIMATE'S LINK TO THE PICTURE (CLIMATE K4, 2026-09-22).
//
// The climate (src/core/09_climate.js) is pure and knows nothing of three.js.
// This is the one place the renderer asks it what the air is doing, once a
// frame, and hands the answer to everything that should show it: the sea's
// ripples, the windsocks, the smoke and the spray, the trees' sway, and the
// clouds' drift.
//
// WHY A LINK AND NOT A DOZEN CALLS. Every one of these used to read its own
// copy of the wind - `windBase`, a CONDITIONS row, a constant 3,1 in clouds.js
// - and they disagreed the moment anything moved. One object, filled once,
// read by all of them: if the sock and the ripples and the smoke ever point
// different ways again it is because they were given different numbers here,
// and that is a bug with one address.
//
// WHAT IT PUBLISHES (`CLIMATE_LINK.pub`, re-filled in place, no allocation):
//   surf   [wx, wz, spd, dirFromDeg]  the 10 m wind, smoothed over ~2 s
//   cam    [wx, wz, phase]            the wind at the CAMERA and a sway phase
//   gust   0..1                       how rough it is where the craft is
//   haze   { visibilityKm, rho0, top, H }   what the mist would read
//   sea    { A, L, dir }              the sea state the wind is making
//
// THE TWO CLOCKS, again (the rule 09_climate.js states): the sway phase and
// the smoothing run on the FRAME's own dt, the clouds' drift on the DAY's utc.
// Neither ever reads the wall clock, so a paused sim under a moving day, or a
// moving sim under a frozen day, both behave.
// ============================================================
var CLIMATE_LINK = (function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const D2R = Math.PI / 180;
  const deg = v => (((v % 360) + 360) % 360);
  // the published block: one object, filled in place
  const pub = {
    on: false,
    surf: [0, 0, 0, 0],
    cam: [0, 0, 0],
    gust: 0,
    haze: null,
    sea: null,
    utc: 0,
  };
  // The sway uniform every leaf, tuft and impostor can share (x, z, phase, gain).
  // WRITING IT FROM OUTSIDE DOES NOT STICK: frame() fills it every frame, which
  // is the point. To move the trees, move the WIND - CLIMATE_LINK.setWind().
  let uWind = null;
  function uniform(THREE) {
    if (!uWind && THREE) uWind = { value: new THREE.Vector4(0, 0, 0, 0) };
    return uWind;
  }
  const S = {
    tauSurf: 2.0,        // s: the 10 m wind's smoothing, so a sock does not twitch on a gust
    tauCam: 0.5,         // s: the sway's wind
    swayK: 0.6,          // the flutter's rate per m/s of wind
    swayGain: 1,         // the graphics tier's switch (0 = no bend, no recompile)
    waterEvery: 0.2,     // m/s of change before the ripples are told
    waterDeg: 3,         // and degrees
  };
  let world = null, lastU = -1e9, lastDir = -1e9;
  const sm = [0, 0, 0];

  function bind(w) { world = w || null; pub.on = !!(w && w.climate); return pub.on; }

  // frame(cg, camPos, dt, simT): the once-a-frame ask. `cg` the craft, `camPos`
  // the eye, `dt` the frame's seconds, `simT` the solver's clock.
  function frame(cg, camPos, dt, simT) {
    if (!world || !world.climate) { pub.on = false; return pub; }
    pub.on = true;
    const c = world.climate, day = world.day;
    dt = Math.max(0, Math.min(0.25, dt || 0));
    // ---- the 10 m wind, where the craft is ---------------------------------
    // The climate's own surface wind is the declared base with the front's hand
    // already on it; the smoothing is only so that a sock and the ripples do not
    // jitter frame to frame.
    const sw = c.surfaceWind();
    const kS = dt > 0 ? 1 - Math.exp(-dt / S.tauSurf) : 1;
    pub.surf[0] += (sw.base[0] - pub.surf[0]) * kS;
    pub.surf[1] += (sw.base[2] - pub.surf[1]) * kS;
    pub.surf[2] = Math.hypot(pub.surf[0], pub.surf[1]);
    // the direction a wind is FROM, which is how every instrument says it
    pub.surf[3] = pub.surf[2] > 0.05 ? deg(Math.atan2(-pub.surf[0], pub.surf[1]) / D2R) : 0;
    // ---- the wind at the eye, and the sway's phase -------------------------
    if (camPos) {
      c.sample(camPos.x, camPos.y, camPos.z, simT || 0, sm);
      const kC = dt > 0 ? 1 - Math.exp(-dt / S.tauCam) : 1;
      pub.cam[0] += (sm[0] - pub.cam[0]) * kC;
      pub.cam[1] += (sm[2] - pub.cam[1]) * kC;
      // THE PHASE IS INTEGRATED, never `t * rate`: the rate itself changes with
      // the wind, and a product would jump the whole forest the moment it did.
      pub.cam[2] += Math.hypot(pub.cam[0], pub.cam[1]) * S.swayK * dt;
      if (pub.cam[2] > 1e6) pub.cam[2] -= 1e6;                 // keep the float honest
    }
    // the one uniform every leaf, tuft and card reads (trees.js publishes it)
    const TW = W.TREE_WIND;
    if (TW && TW.value && TW.value.set) TW.value.set(pub.cam[0], pub.cam[1], pub.cam[2], S.swayGain);
    if (uWind && uWind !== TW) uWind.value.set(pub.cam[0], pub.cam[1], pub.cam[2], S.swayGain);
    // ---- how rough it is, for the spray and the smoke ----------------------
    if (cg) {
      c.sample(cg[0], cg[1], cg[2], simT || 0, sm);
      const steady = Math.hypot(pub.surf[0], pub.surf[1]);
      pub.gust = Math.min(1, Math.abs(Math.hypot(sm[0], sm[2]) - steady) / Math.max(1, steady));
    }
    // ---- what the mist and the sea would read ------------------------------
    pub.haze = c.haze ? c.haze() : null;
    pub.sea = world.sea || null;
    pub.utc = day ? day.utc : 0;
    // ---- the ripples, on CHANGE only ---------------------------------------
    // WATER.setWind touches four uniforms and the detail band's own numbers; it
    // is not worth doing at 60 Hz for a wind that moves over minutes. It used to
    // be reached ONLY from the CONDITIONS select, so ripples and whitecaps never
    // moved at all unless somebody picked a preset.
    const u = pub.surf[2], d = pub.surf[3];
    if (Math.abs(u - lastU) > S.waterEvery || Math.abs(deg(d - lastDir + 180) - 180) > S.waterDeg) {
      lastU = u; lastDir = d;
      if (W.WATER && W.WATER.setWind) W.WATER.setWind(u, Math.atan2(pub.surf[1], pub.surf[0]));
    }
    return pub;
  }

  // cloudDrift(i, base, driftK): how far deck `i` has been carried by the wind
  // at its own height, as the INTEGRAL over the day's clock.
  //
  // WHY AN INTEGRAL AND NOT w x t. clouds.js drifts each deck by
  // `wind * secs * driftK`, which is a POSITION computed from the wind NOW - so
  // the moment the wind changes, the whole sky jumps by (dw) x secs, and secs is
  // sixty thousand at four in the afternoon. A constant wind gives exactly the
  // old number (that is the check below), and a front's veer now slides the sky
  // instead of teleporting it.
  const acc = [];
  function cloudDrift(i, base, driftK, utc) {
    if (!world || !world.climate) return null;
    const c = world.climate;
    let a = acc[i];
    if (!a) {
      // the first frame seeds the accumulator with the OLD closed form, so a
      // fresh boot draws exactly the sky it drew before this file existed
      const w0 = c.sample(0, base, 0, 0, sm);
      a = acc[i] = { x: w0[0] * 1.5 * driftK * utc, z: w0[2] * 1.5 * driftK * utc, utc };
      return a;
    }
    const dU = utc - a.utc;
    if (dU !== 0) {
      // the wind at the deck's own height, over the deck's own span of clock
      const w = c.sample(0, base, 0, 0, sm);
      a.x += w[0] * 1.5 * driftK * dU;
      a.z += w[2] * 1.5 * driftK * dU;
      a.utc = utc;
    }
    return a;
  }
  function reset() { acc.length = 0; lastU = -1e9; lastDir = -1e9; }

  // ---- what a RIG needs (the vegetation session asked, K4.3) ---------------
  // A measuring rig drives the page from outside and had no way in: it could
  // find TREE_WIND but writing it does not stick (frame() rewrites the uniform
  // every frame, which is right), and it could not reach the climate at all
  // without knowing FLIGHT_PROBE. So the link hands over the two things a rig
  // actually needs - the climate itself, and a wind it can set - and says
  // plainly that the uniform is not one of them.
  const climate = () => (world && world.climate) ? world.climate : null;
  // setWind(spec) - through the DAY, so the panel, the pref, the URL and the
  // solver all see the same change a rig makes. `CLIMATE_LINK.setWind({ kts: 25,
  // dirDeg: 270, gust: 0.4, refH: 10 })` is a windy afternoon from a probe.
  function setWind(spec) {
    if (!world) return false;
    const CK = W.DAY_CLOCK;
    if (CK && CK.set) CK.set({ wind: spec || null }); else world.setDay({ wind: spec || null });
    return true;
  }
  const API = { pub, S, bind, frame, cloudDrift, reset, uniform, climate, setWind,
                get uWind() { return uWind; } };
  if (typeof window !== 'undefined') window.CLIMATE_LINK = API;
  return API;
})();
